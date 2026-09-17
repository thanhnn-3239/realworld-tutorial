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
│  │  - AuthController (login, register, link confirm)    │   │
│  │  - GoogleAuthController (OAuth start, callback)      │   │
│  │  - UsersController (GET/PUT user)                    │   │
│  │  - ArticlesController (CRUD, list, filter, paginate) │   │
│  │  - CommentsController (CRUD on articles)             │   │
│  │  - ProfilesController (GET, follow/unfollow)         │   │
│  │  - HealthController (readiness check)                │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Services (Business Logic)                           │   │
│  │  - UsersService, ArticlesService, CommentsService    │   │
│  │  - ProfilesService, AuthService, AccountResolver     │   │
│  │  - ProviderLinkService (pending links, confirmation) │   │
│  │  - EmailQueueProducer & EmailProcessor (worker)      │   │
│  │  - SmtpMailSender (SMTP transport adapter)           │   │
│  │  - AvatarReplacementService (locked swap of the key) │   │
│  │  - FileStorageService -> StorageDriver (S3)          │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Infrastructure                                      │   │
│  │  - Passport/JWT & Google OAuth strategies            │   │
│  │  - BullMQ background job queues with Redis           │   │
│  │  - Multer for multipart file handling                │   │
│  │  - Prisma ORM with PostgreSQL adapter                │   │
│  │  - Winston logger                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
           │                  │                │
           ▼                  ▼                ▼
┌──────────────────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│   PostgreSQL Database    │ │    Redis     │ │  Storage Driver          │
│  ┌────────────────────┐  │ │  (BullMQ)    │ │  (S3-compatible)         │
│  │ User               │  │ └──────────────┘ └──────────────────────────┘
│  │ AuthProvider       │  │         │
│  │ PendingAuthProvider│  │         ▼
│  │   Link             │  │   SMTP Server
│  │ Article, Comment   │  │   (Mailpit locally,
│  │ Favorite, Follow   │  │    outbound provider in prod)
│  └────────────────────┘  │
└──────────────────────────┘
```

## Core Components

### NestJS Application

- **Framework:** NestJS 11 with TypeScript 5.7 in strict mode
- **Port:** 3000
- **Health Check:** GET /health (database- and Redis queue-aware)
- **Swagger Docs:** GET /docs
- **Database Connection:** Prisma ORM with PostgreSQL native adapter
- **Job Queue:** BullMQ backed by Redis with separate producer and worker connection policies

### Authentication

- **Strategy:** JWT via Passport and Google OAuth 2.0
- **Token Location:** `Authorization: Bearer <jwt>`
- **Protected:** All user-specific and write operations
- **Registration:** Creates new user account (or passwordless account on Google sign-in)
- **Login:** Email + password, or Google sign-in; returns JWT token pair
- **Account Linking:** Email collisions return `202 Accepted` requiring one-time email confirmation; existing passwords and sessions are preserved

### API Endpoints (by feature)

| Feature        | Endpoints                                                                                   | Status                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Authentication | POST /register, POST /login, POST /refresh, POST /logout                                    | Complete                                                                                    |
| Google Auth    | GET /auth/google, GET /auth/google/callback, POST /auth/google/link/confirm                 | Complete                                                                                    |
| Users          | GET /user, PUT /user                                                                        | Complete                                                                                    |
| Articles       | GET /articles, POST /articles, PUT /articles/:slug, DELETE /articles/:slug                  | Complete                                                                                    |
| Comments       | POST /articles/:slug/comments, DELETE /articles/:slug/comments/:id                          | Complete                                                                                    |
| Favorites      | POST /articles/:slug/favorite, DELETE /articles/:slug/favorite                              | Complete                                                                                    |
| Profiles       | GET /profiles/:username, POST /profiles/:username/follow, DELETE /profiles/:username/follow | Complete                                                                                    |
| File Upload    | PUT /user (multipart image upload)                                                          | Complete (implementation); pending production deploy — see `docs/development-roadmap.md` M2 |

## Key Layout

Avatar keys are generated by `buildStorageKey('avatars/{userId}', extension)`
(`AvatarReplacementService.replace`) as `avatars/{userId}/{uuid}.webp` — the extension is
always `webp` because `ImageProcessingService.process` normalizes every accepted avatar to
that format before the key is built.

- **Single implementation:** `S3StorageDriver` (`src/file-storage/drivers/s3-storage.driver.ts`) is
  the only class behind the `STORAGE_DRIVER` token. It requires `STORAGE_BUCKET` and
  `STORAGE_PUBLIC_URL` at construction (`file-storage.config.ts#requireConfig`) and fails at boot,
  not on first upload, if either is missing.
- **URL shape:** `S3StorageDriver.url(key)` joins the configured `STORAGE_PUBLIC_URL` with the key —
  no app route serves these files; the object store answers the request directly.
- **Known bucket-policy mismatch (out of scope):** `docker/minio-init.sh` grants anonymous
  download only under the bucket's `public/` prefix (`mc anonymous set download
local/$BUCKET/public`). Avatar keys live under `avatars/{userId}/`, not `public/`, so this
  policy does not currently grant anonymous read access to avatar objects even though
  `FileStorageService.publicUrl` still returns a URL for them. This mismatch predates this
  change set and is **not resolved** by it — recorded here as a known gap, not a claim that
  avatar URLs are anonymously retrievable.

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
      └─ Return 409 before image processing or storage write

2. IMAGE PROCESSING (before storage, outside the transaction)
   └─ ImageProcessingService.process() decodes, validates, and normalizes
      the upload via the bounded Piscina/Sharp pool (see Image Processing
      below) — reject here (422/503) means no bytes are ever uploaded
   └─ Only the normalized 512x512 WebP output continues to step 3

3. UPLOAD VIA STORAGEDRIVER (outside the transaction)
   └─ I/O latency must not hold a database row lock
   └─ New key held in memory; if the transaction fails, this key is deleted

4. TRANSACTION (single ACID boundary)
   ├─ SELECT "image" FROM "User" WHERE id = ? FOR UPDATE (UsersRepository.lockImage)
   │  └─ Row lock acquired here; a concurrent replacement of the same user waits,
   │     then reads the key this transaction commits — never the key both started from
   └─ UPDATE User row with the new key

5. POST-COMMIT CLEANUP (best-effort)
   └─ DELETE the previous key via StorageDriver (idempotent)
      └─ Failure logged; the object is orphaned — no metadata row survives to retry it
```

### Consistency Properties

| Failure Point                                                | Result                                                                            |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| Image decode/validation fails                                | `422`; nothing uploaded; DB unchanged                                             |
| Image processing pool unavailable/timeout/unexpected failure | `503`; nothing uploaded; DB unchanged                                             |
| Upload to storage fails                                      | 502; DB unchanged; previous key retained                                          |
| Transaction fails (before commit)                            | Compensation delete removes the newly uploaded object; original DB error returned |
| Compensation delete also fails                               | Both errors logged; new object orphaned; observable only in logs                  |
| Previous-key delete fails (after commit)                     | `200` returned; the orphaned object is only logged, never retried                 |

**Key insight:** The transaction cannot span the storage backend because it is not ACID-compliant. Instead:

- We verify all preconditions _before_ touching storage
- A row lock, not a metadata table, is what orders two concurrent replacements of the same user
- Cleanup after commit is best-effort; a failed delete there is a logged orphan, not a retried operation

### Why This Order

1. **Conflict check first:** Fail fast before any image processing or storage work.
2. **Process before upload:** A decode/validation rejection must never reach storage —
   only a normalized, already-validated image is ever written.
3. **Upload before transaction:** Avoid holding a row lock during storage I/O latency.
4. **Lock the row first inside the transaction:** `UsersRepository.lockImage` runs `SELECT ... FOR UPDATE` before the `UPDATE`, so a second replacement of the same user blocks until the first commits, then reads the key the first one just wrote.
5. **Cleanup after commit:** One committed transaction is better than risking a partial update.

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

## Image Processing: Piscina/Sharp Boundary

Avatar uploads are decoded, validated, and normalized synchronously inside the
same request as the `PUT /user` call, before storage or the database
transaction — no external job queue or async completion. `WorkerPoolModule`
(`src/worker-pool/`) owns the process-wide Piscina instance, while
`ImageProcessingModule` (`src/image-processing/`) owns Sharp policy and its worker.
`ImageProcessingService.process()` remains the image-facing entry point.

### Why a worker pool, not in-process Sharp

Sharp/libvips decode and resize work is CPU-bound and can take long enough on a
large or adversarial input to block the Node event loop. Running it in Piscina
worker threads keeps that CPU work off the main thread, and bounding the pool
keeps a burst of concurrent uploads from starving the whole process.

```
UsersController → AvatarReplacementService → ImageProcessingService (facade)
                                                    │
                                                    ▼
                                      PiscinaPoolService (shared infrastructure)
                                                    │  workerPath, task, transferList
                                                    ▼
                                    Worker thread: image-processing.worker.ts
                                           sharp.concurrency(1) pinned once
                                       decode → validate → resize → encode WebP
```

- **Shared pool bounds** (`src/worker-pool/constants/piscina-pool.constants.ts`):
  `maxThreads = clamp(1, 2,
availableParallelism() - 1)`; `maxQueue = maxThreads * 2`. A task submitted
  once the live Piscina `queueSize` is at `maxQueue`, or after
  `onApplicationShutdown` has flipped the pool into closing, is rejected before
  it is ever admitted (`PiscinaPoolService.assertAccepting`) — never queued
  unbounded.
- **Reusable task dispatch:** Piscina is created without a default worker file.
  Internal feature services supply an absolute `workerPath`, optional named export,
  timeout, and transfer list per call. Valid worker paths are checked once and cached;
  paths never come from request data.
- **Per-task timeout:** Each `run()` call sets its own 10s default
  (`DEFAULT_TASK_TIMEOUT_MS`)
  `AbortController` timer. On expiry the controller aborts the in-flight Piscina
  task (not just the caller's wait) and the pool maps it to an internal
  timeout error; `ImageProcessingService` turns any pool/worker-level failure —
  timeout, saturation, or an unexpected worker exception — into a generic `503
Image processing unavailable`, never echoing the underlying cause to the
  caller.
- **Graceful shutdown:** `PiscinaPoolService` implements
  `OnApplicationShutdown`. On shutdown it flips an in-memory `closing` flag
  (so any `run()` racing the shutdown is rejected immediately) and calls
  `pool.close()`, which uses Piscina's own `closeTimeout` (30s,
  `CLOSE_TIMEOUT_MS`) to force-destroy any worker still mid-task rather than
  hang the process on shutdown.
- **`sharp.concurrency(1)` per worker thread:** libvips concurrency is
  process-global, so each worker thread pins it to 1 once at module load
  (`image-processing.worker.ts`) — otherwise a single decode/resize could fan
  out across more CPU cores than the pool's thread bound intends to allocate.
- **Zero-copy transfer:** Both directions (`ImageProcessingService` supplies the
  input transfer list, `moveWorkerSuccess` handles the worker output) use Piscina's
  `transferList`/`move()` to transfer the underlying `ArrayBuffer` instead of
  structured-cloning it, so a multi-megabyte image is never copied across the
  thread boundary.

### Validation and normalization (in the worker)

The worker (`image-processing.worker.ts`) validates the **decoded** image
against the named profile (`avatar`, `image-processing-profiles.constants.ts`)
before doing any resize work:

1. Read header metadata only (`sharp(input).metadata()`); a decode failure is
   the generic `INVALID_IMAGE` code.
2. Reject if the decoded format is not one of the profile's `acceptedFormats`
   (`jpeg`, `png`, `webp`) — independent of the request's declared MIME type.
3. Reject multi-frame/animated input (`metadata.pages > maxPages`, `maxPages:
1`).
4. Reject if the auto-oriented shortest side is below `minShortestSide` (256px)
   or the decoded pixel count exceeds `limitInputPixels` (16,000,000).
5. Only after all checks pass: `autoOrient()` → `resize({ width: 512, height:
512, fit: 'cover', position: 'centre' })` → `.webp({ quality: 82 })`.

Every one of these rejections maps to the same generic `422 Invalid avatar
image` at the `ImageProcessingService` facade — the specific internal error
code (`image-processing-error-codes.constants.ts`) is only ever logged, never
returned to the caller.

**Metadata stripping:** Sharp's default output does not carry forward EXIF or
other source metadata unless explicitly requested, so the encoded 512x512 WebP
written to storage carries none of the original image's metadata (camera
info, GPS, ICC profile, etc.) — this is a byproduct of always re-encoding
through `.resize().webp()` rather than a separate strip step.

**Original bytes never reach storage:** `AvatarReplacementService.replace`
uploads only `processed.data` — the worker's re-encoded output — never
`file.buffer`, the original upload.

## Google Account Linking & Email Delivery Architecture

### Background & Collision Flow

When a user signs in with Google using an email address that matches an existing password account,
the Google identity is not automatically attached. Instead, the application triggers a durable
confirmation flow:

```
1. Google Callback Collision
   ├─ Existing account detected with different/missing Google provider
   ├─ ProviderLinkService issues a 32-byte base64url random token
   ├─ Persists only SHA-256 hash to PendingAuthProviderLink (15m TTL, 60s cooldown)
   ├─ Enqueues background job 'auth-provider-link-confirmation' to BullMQ 'email' queue
   └─ Responds with 202 Accepted { "status": "confirmation_required" }
      (Password, sessions, and credentials remain completely untouched)

2. BullMQ & SMTP Delivery
   ├─ BackgroundJobsModule: producer uses maxRetriesPerRequest: 1; worker uses null
   ├─ EmailProcessor (WorkerHost) consumes job from Redis
   ├─ Checks expiration against Date.now(); skips expired jobs
   ├─ Renders confirmation URL with raw token query parameter
   └─ Dispatches outbound mail via SmtpMailSender (Mailpit locally, SMTP in prod)
      (Retries up to 3 times with exponential backoff starting at 5s)

3. Atomic Confirmation (POST /v1/auth/google/link/confirm)
   ├─ User submits raw token from email
   ├─ Single Prisma transaction:
   │  ├─ Find unexpired row by SHA-256(rawToken)
   │  ├─ Conditionally claim/delete row (id, tokenHash, unexpired)
   │  ├─ Query existing AuthProvider by provider & sub
   │  ├─ Idempotent success if already linked to same user
   │  ├─ 409 Conflict if linked to different user
   │  └─ Create AuthProvider row for target user
   └─ Responds with 200 OK { "confirmed": true } (no login tokens issued)

4. Scheduled Cleanup
   └─ ExpiredProviderLinkCleanupService runs daily at 04:00 ('0 0 4 * * *')
      to remove expired pending links.
```

### Security & Privacy Boundaries

- **Token Storage:** Raw tokens exist only in memory, transiently in the BullMQ payload, and in the sent email link. PostgreSQL stores only the 64-character lowercase hex SHA-256 digest.
- **Log Sanitation:** Logs never record recipient email addresses, raw tokens, confirmation URLs, SMTP credentials, or full job payloads.
- **Single-Use & Concurrency Guard:** Deleting the pending link inside the atomic transaction enforces single-use. Replay attacks or sequential re-submissions return a generic 400. Concurrent submissions resolve via the AuthProvider uniqueness constraint.

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
- **Suite size:** see `docs/project-changelog.md` for the current exact count (count, not line coverage — no coverage threshold is enforced)
- **Mocks:** AWS SDK (S3 driver), Prisma collaborators, and (for `ImageProcessingService`/`AvatarReplacementService` unit specs) the shared `PiscinaPoolService` — no real worker thread is spun up here
- **Command:** `pnpm test`

### Image Processing Worker Integration Tests

- **Runner:** Jest with a dedicated config (`test/jest-worker.json`) that only matches
  `image-processing-worker.integration-spec.ts`
- **Why separate:** This suite runs `processImageTask` through the **compiled `dist`
  artifact** inside a **real Piscina worker thread**, proving the built output actually
  works end-to-end — not "mocked vs real Sharp": the unit specs
  (`image-processing.worker.spec.ts`) already run real Sharp decodes in-process,
  but against TS source and never through Piscina or
  the compiled build. It defines its own local `createTestImage` helper rather than
  reusing `test/support/avatar-image-fixture.factory.ts`. Kept out of the standard suite
  so a slow or environment-sensitive compiled/native-thread test never blocks the fast
  unit run
- **Command:** `pnpm test:worker --runInBand`

### E2E Tests

- **Runner:** Jest with real PostgreSQL and MinIO
- **Suite size:** 26 focused suites — see `docs/project-changelog.md` for the current exact test count
- **Real I/O:** Actual database transactions, real object writes to MinIO via `S3StorageDriver`
- **Isolation:** One cloned database and one run-namespaced bucket per suite; application tables and bucket contents reset before each test
- **Fixtures:** Thin `useE2eSuite`/`useDatabaseSuite` contexts; Prisma creates prerequisites while HTTP exercises the behavior under test
- **Parallelism:** Four Jest workers run files concurrently; tests within a file remain sequential
- **Configuration:** Local and CI create the ignored `.env.e2e` from committed `.env.e2e.example`; suite database/storage values are injected through `ConfigService`, never written to shared process env
- **Lifecycle:** Compose project `realworld-e2e` runs PostgreSQL, MinIO, and a one-off app container. Local may retain services; CI always removes containers and volumes
- **Command:** `make test-e2e`

### CI Gates

- Prisma Client validation
- TypeScript typecheck (strict mode)
- ESLint code style
- Unit tests (mocked)
- Production build
- Image processing worker integration tests (`pnpm test:worker --runInBand`, real Sharp decodes)
- E2E tests (real PostgreSQL + MinIO)
- Docker image runtime checks: non-root user, expected `/app` layout, presence of the
  compiled worker artifact (`dist/image-processing/workers/image-processing.worker.js`),
  and that `sharp`/`piscina` resolve at runtime inside the production image

## Performance Considerations

### Database Queries

- **Indexed:** Author/article lookups, comment queries, follow relationships
- **Pagination:** Limit + offset for large result sets
- **Transactions:** Serializable isolation on writes to prevent TOCTOU races

### File Storage

- **Multipart Upload:** 5 MiB per file
- **Concurrency (HTTP layer):** No rate limiting on `PUT /user` itself (design limitation; TODO)
- **Concurrency (CPU worker pool):** Bounded independently of HTTP concurrency — at most
  `clamp(1, 2, availableParallelism() - 1)` Piscina worker threads, a queue capped at twice
  that thread count, and a 10s default task timeout. Image processing currently uses this
  shared budget; requests beyond the queue bound get a `503` rather than piling up unbounded
  (see [Image Processing](#image-processing-piscinasharp-boundary))
- **I/O:** StorageDriver calls (network, S3-compatible) happen outside the DB transaction to avoid row locks

### Caching

- None currently; stateless API design allows horizontal scaling

## Security

### Authentication

- JWT tokens signed with HS256
- Passwords hashed with bcrypt (cost factor 10)
- No plaintext secrets in code or logs

### File Upload

- Declared MIME type allowlist at the multipart layer (jpeg, png, webp — GIF removed;
  see [Known Gaps](#known-gaps) below)
- Size limit (5 MiB, counted from streamed multipart bytes by Multer)
- Decoded-image validation in the Piscina/Sharp worker: real format, single-frame,
  minimum/maximum dimensions — rejects content a spoofed declared MIME type could otherwise
  smuggle through the first check (see [Image Processing](#image-processing-piscinasharp-boundary))
- Every accepted avatar is re-encoded (never stored as originally uploaded), which also
  strips source metadata (EXIF, ICC profile, GPS, etc.)
- Generated keys prevent enumeration
- Served with declared Content-Type (prevents XSS in same-origin scenario)

### Known Gaps

- **Declared MIME type is still client-supplied header only:** the multipart `fileFilter`
  check is a fast pre-filter, not a security boundary by itself — the decoded-image
  validation in the worker is what actually constrains accepted content
- **Rate limiting:** Not implemented; TODO
- **Bucket-policy/prefix mismatch:** see [Key Layout](#key-layout) — avatar objects are not
  covered by the current anonymous-download bucket policy; recorded as a known gap, not
  addressed here
- **CORS:** Not configured; API assumed to be on its own origin or behind API Gateway

## Related Documentation

- [Development Roadmap](./development-roadmap.md)
- [Project Changelog](./project-changelog.md)
- [API Documentation](./api/README.md)
- [File Upload Design Spec](./superpowers/specs/2026-09-08-file-upload-design.md)
