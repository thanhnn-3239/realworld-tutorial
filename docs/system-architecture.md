# System Architecture

High-level overview of the RealWorld API backend, its components, data flow, and consistency boundaries.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   NestJS Application                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Controllers (Endpoints)                             │   │
│  │  - AuthController (login, register)                  │   │
│  │  - UsersController (GET/PUT user)                    │   │
│  │  - ArticlesController (CRUD, list, filter, paginate) │   │
│  │  - CommentsController (CRUD on articles)             │   │
│  │  - ProfilesController (GET, follow/unfollow)         │   │
│  │  - HealthController (readiness check)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services (Business Logic)                           │   │
│  │  - UsersService                                      │   │
│  │  - ArticlesService                                   │   │
│  │  - CommentsService                                   │   │
│  │  - ProfilesService                                   │   │
│  │  - AvatarReplacementService (locked swap of the key) │   │
│  │  - FileStorageService (facade: key naming, MIME      │   │
│  │    map, 502 mapping) -> StorageDriver (S3-compatible)│   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Infrastructure                                      │   │
│  │  - Passport/JWT authentication strategy              │   │
│  │  - Multer for multipart file handling                │   │
│  │  - Prisma ORM with PostgreSQL adapter                │   │
│  │  - Winston logger                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
           │                                   │
           ▼                                   ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│   PostgreSQL Database    │      │  Storage Driver          │
│  ┌────────────────────┐  │      │  (S3-compatible)         │
│  │ User               │  │      └──────────────────────────┘
│  │ Article            │  │
│  │ Comment            │  │
│  │ Favorite           │  │
│  │ Follow             │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

## Core Components

### NestJS Application

- **Framework:** NestJS 11 with TypeScript 5.7 in strict mode
- **Port:** 3000
- **Health Check:** GET /health (database-aware)
- **Swagger Docs:** GET /docs
- **Database Connection:** Prisma ORM with PostgreSQL native adapter

### Authentication

- **Strategy:** JWT via Passport
- **Token Location:** `Authorization: Token <jwt>`
- **Protected:** All user-specific and write operations
- **Registration:** Optional; creates new user account
- **Login:** Email + password; returns JWT token

### API Endpoints (by feature)

| Feature        | Endpoints                                                                                   | Status                  |
| -------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| Authentication | POST /register, POST /login                                                                 | Complete                |
| Users          | GET /user, PUT /user                                                                        | Complete                |
| Articles       | GET /articles, POST /articles, PUT /articles/:slug, DELETE /articles/:slug                  | Complete                |
| Comments       | POST /articles/:slug/comments, DELETE /articles/:slug/comments/:id                          | Complete                |
| Favorites      | POST /articles/:slug/favorite, DELETE /articles/:slug/favorite                              | Complete                |
| Profiles       | GET /profiles/:username, POST /profiles/:username/follow, DELETE /profiles/:username/follow | Complete                |
| File Upload    | PUT /user (multipart image upload)                                                          | Implemented, unreleased |

## Key Layout

Every key `FileStorageService.upload` generates starts with a `public/` visibility prefix:
`public/uploads/{ownerType}/{ownerId}/{uuid}.{ext}`. Nothing private exists yet — this only fixes
the layout so a later `private/` prefix can be added without moving any object already written
under `public/`.

- **Single implementation:** `S3StorageDriver` (`src/file-storage/drivers/s3-storage.driver.ts`) is
  the only class behind the `STORAGE_DRIVER` token. It requires `STORAGE_BUCKET` and
  `STORAGE_PUBLIC_URL` at construction (`file-storage.config.ts#requireConfig`) and fails at boot,
  not on first upload, if either is missing.
- **Bucket policy scopes to the prefix:** `docker/minio-init.sh` sets the bucket's anonymous-download
  policy on the `public` prefix only (`mc anonymous set download local/$BUCKET/public`), not on the
  bucket root, so a later `private/` prefix in the same bucket stays unreadable by default.
- **URL shape:** `S3StorageDriver.url(key)` joins the configured `STORAGE_PUBLIC_URL` with the key —
  no app route serves these files; the object store answers the request directly.

## Storage Consistency Boundary: StorageDriver ↔ PostgreSQL

### Challenge

File upload must coordinate two independent systems:

- **StorageDriver (S3-compatible object storage):** No transactions, write happens outside the database transaction
- **PostgreSQL:** ACID transactions, serializable isolation

**Problem:** If we write to storage first, a database failure orphans the object. If we write to the database first, a storage failure leaves the database pointing to a non-existent object. And if two replacements of the same avatar run concurrently, whichever commits last must be the one whose key survives on the row — the other's object is the one that should be reclaimed.

### Solution: Row Lock + Compensation + Post-Commit Reclamation

The architecture solves this with deliberate ordering, a row lock, and compensation:

```
1. CONFLICT CHECK (before any side effects)
   └─ Validate username uniqueness in database
      └─ Return 409 before storage write

2. UPLOAD VIA STORAGEDRIVER (outside the transaction)
   └─ I/O latency must not hold a database row lock
   └─ New key held in memory; if the transaction fails, this key is deleted

3. TRANSACTION (single ACID boundary)
   ├─ SELECT "image" FROM "User" WHERE id = ? FOR UPDATE (UsersRepository.lockImage)
   │  └─ Row lock acquired here; a concurrent replacement of the same user waits,
   │     then reads the key this transaction commits — never the key both started from
   └─ UPDATE User row with the new key

4. POST-COMMIT CLEANUP (best-effort)
   └─ DELETE the previous key via StorageDriver (idempotent)
      └─ Failure logged; the object is orphaned — no metadata row survives to retry it
```

### Consistency Properties

| Failure Point                            | Result                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| Upload to storage fails                  | 502; DB unchanged; previous key retained                                       |
| Transaction fails (before commit)        | Compensation delete removes the newly uploaded object; original DB error returned |
| Compensation delete also fails           | Both errors logged; new object orphaned; observable only in logs               |
| Previous-key delete fails (after commit) | `200` returned; the orphaned object is only logged, never retried              |

**Key insight:** The transaction cannot span the storage backend because it is not ACID-compliant. Instead:

- We verify all preconditions _before_ touching storage
- A row lock, not a metadata table, is what orders two concurrent replacements of the same user
- Cleanup after commit is best-effort; a failed delete there is a logged orphan, not a retried operation

### Why This Order

1. **Conflict check first:** Fail fast before any storage work.
2. **Upload before transaction:** Avoid holding a row lock during storage I/O latency.
3. **Lock the row first inside the transaction:** `UsersRepository.lockImage` runs `SELECT ... FOR UPDATE` before the `UPDATE`, so a second replacement of the same user blocks until the first commits, then reads the key the first one just wrote.
4. **Cleanup after commit:** One committed transaction is better than risking a partial update.

### Why a row lock instead of an attachment table

An earlier design tracked every upload in a polymorphic `Attachment` table and queried it
for "superseded" rows to clean up. That table did two jobs: it gave the delete step
something to query, and its own row inserts incidentally serialized concurrent writers.
The `FOR UPDATE` lock in `AvatarReplacementService.swap` replaces exactly the second job —
listing the bucket could not substitute for it, because storage has no way to tell which
of two uploads belongs to the transaction that is about to commit; only a database-side
lock can order them. The first job (tracking every key ever written) added a table with no
reader, since `User.image` alone is the only reference an avatar ever needs.

### Idempotency

`StorageDriver.delete` is idempotent: deleting an already-deleted object succeeds. This
matters because both the compensation path (on transaction failure) and the post-commit
reclaim path may call it, and neither should turn a cleanup attempt into a second error.

### Known Limitations

- **TOCTOU race on uniqueness:** The conflict check is a read; the unique constraint fires at commit. A rare race can orphan one object.
- **No scheduled sweep:** An orphan left by a failed post-commit delete is logged, not retried — it stays in storage until removed manually.
- **Unbounded upload rate:** No rate limiting prevents a user from orphaning objects by repeatedly triggering conflicts.

## Data Model

### Tables

#### User

```sql
CREATE TABLE "User" (
  id SERIAL PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  username VARCHAR UNIQUE NOT NULL,
  password VARCHAR,                   -- bcrypt hash; null for provider-only accounts
  bio VARCHAR,
  image VARCHAR,                      -- S3 object key, or null; never a URL, no column default
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);
```

`image` holds the key `FileStorageService.upload` generated for the stored object
(`public/uploads/User/{id}/{uuid}.{ext}`), never a URL. There is no `Attachment` table —
`User.image` is the only record of an avatar, and `FileStorageService.publicUrl(key)`
converts it to an absolute URL at each of the five places a `User` row becomes a response
body: `UsersService`, `AuthService`, `ProfilesService`, `ArticleResponseMapper`, and
`CommentResponseMapper`.

#### Article

```sql
CREATE TABLE "Article" (
  id VARCHAR PRIMARY KEY,
  slug VARCHAR UNIQUE NOT NULL,
  title VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  body TEXT NOT NULL,
  authorId INT NOT NULL REFERENCES "User"(id),
  createdAt TIMESTAMP DEFAULT now(),
  updatedAt TIMESTAMP DEFAULT now()
);
```

#### Comment, Favorite, Follow

(Standard junction/edge tables; see schema.prisma for full definitions)

## Deployment

### Local Development

- **Docker Compose:** PostgreSQL (5432), MinIO (9000), NestJS app (3000)
- **Environment:** `.env` file with `DATABASE_URL`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_URL`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_REGION`
- **Commands:** `make dev` (setup + watch), `make test`, `make test-e2e`

### Production (Render)

- **Deployment:** Manual deploy after merge to main
- **Runtime:** Native Node.js or Docker image (configurable)
- **Database:** Render PostgreSQL
- **Storage:** AWS S3
- **Migrations:** Auto-run on every deploy
- **Health Check:** /health endpoint (database-aware)

## Testing

### Unit Tests

- **Runner:** Jest with ts-jest
- **Suite size:** 331 tests across 33 suites (count, not line coverage — no coverage threshold is enforced)
- **Mocks:** AWS SDK (S3 driver) and Prisma collaborators
- **Command:** `pnpm test`

### E2E Tests

- **Runner:** Jest with real PostgreSQL and MinIO
- **Suite size:** 76 tests across 15 suites
- **Real I/O:** Actual database transactions, real object writes to MinIO via `S3StorageDriver`
- **CI:** GitHub Actions and local compose run this suite against MinIO
- **Command:** `pnpm test:e2e`

### CI Gates

- Prisma Client validation
- TypeScript typecheck (strict mode)
- ESLint code style
- Unit tests (mocked)
- E2E tests (real PostgreSQL + MinIO)
- Production build

## Performance Considerations

### Database Queries

- **Indexed:** Author/article lookups, comment queries, follow relationships
- **Pagination:** Limit + offset for large result sets
- **Transactions:** Serializable isolation on writes to prevent TOCTOU races

### File Storage

- **Multipart Upload:** 5 MiB per file
- **Concurrency:** No rate limiting (design limitation; TODO)
- **I/O:** StorageDriver calls (network, S3-compatible) happen outside the DB transaction to avoid row locks

### Caching

- None currently; stateless API design allows horizontal scaling

## Security

### Authentication

- JWT tokens signed with HS256
- Passwords hashed with bcrypt (cost factor 10)
- No plaintext secrets in code or logs

### File Upload

- MIME type allowlist (jpeg, png, webp, gif)
- Size limit (5 MiB)
- Generated keys prevent enumeration
- Served with declared Content-Type (prevents XSS in same-origin scenario)

### Known Gaps

- **MIME type validation:** Client-supplied header only; magic-byte validation deferred
- **Rate limiting:** Not implemented; TODO
- **CORS:** Not configured; API assumed to be on its own origin or behind API Gateway

## Related Documentation

- [Development Roadmap](./development-roadmap.md)
- [Project Changelog](./project-changelog.md)
- [API Documentation](./api/README.md)
- [File Upload Design Spec](./superpowers/specs/2026-09-08-file-upload-design.md)
