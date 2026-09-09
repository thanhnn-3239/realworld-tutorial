# Project Changelog

All notable changes to this project are documented here. Entries include the date, feature/fix, severity, and impact. Dates reflect specification approval or significant delivery dates.

## Changelog Format

Each entry includes:

- **Date:** When the feature was approved/shipped
- **Type:** Feature (Feat), Fix (Fix), Infrastructure (Infra), or Documentation (Docs)
- **Severity:** Critical, High, Medium, Low
- **Title:** Concise description
- **Impact:** Who/what is affected
- **Details:** Additional context

---

## 2026-09-09

### Feat: File Upload & Avatar Management

- **Severity:** Medium
- **Status:** Implemented, unreleased (on branch `feat/file-upload`)
- **Impact:** Authenticated users can now upload and replace avatar images; stored on S3-compatible object storage (MinIO locally, AWS S3 in production)
- **Details:**
  - PUT /user accepts `multipart/form-data` with `image` field (5 MiB max, supports jpeg/png/webp/gif) to set or replace the avatar
  - Clearing the avatar is JSON-only: `PUT /user` with `image: null`. Any other string value for `image` returns `422`; omitting the field leaves the avatar unchanged
  - `User.image` stores the S3 object key (`public/uploads/User/{id}/{uuid}.{ext}`), never a URL, and has no database default (migration `20260909000000_drop_user_image_default`) — no avatar means `image = NULL`
  - Every response converts the key to an absolute URL via `FileStorageService.publicUrl`, at all five places a `User` row becomes a response body: `UsersService`, `AuthService`, `ProfilesService`, `ArticleResponseMapper`, `CommentResponseMapper`
  - No `Attachment` table: `AvatarReplacementService` takes a `SELECT ... FOR UPDATE` row lock (`UsersRepository.lockImage`) to read the previous key inside the same transaction that writes the new one; the lock is what orders two concurrent replacements of the same user, replacing exactly what the attachment row used to provide
  - Upload happens outside the DB transaction to avoid holding the row lock across the network call
  - The previous key is deleted only after the transaction commits; a failed delete is logged and left as an orphan — no metadata row survives to retry it
  - Failed upload compensation: newly uploaded object deleted if the transaction fails, original DB error returned
  - S3 errors logged with cause before 502 mapping
  - Misconfiguration (missing STORAGE_BUCKET or STORAGE_PUBLIC_URL) fails at boot, not on first upload
  - All gates (typecheck, lint, build, unit, e2e) passing: 331 unit tests / 33 suites, 76 e2e tests / 15 suites
- **Limitations:**
  - Rate limiting not implemented; upload volume per user is unbounded
  - No scheduled sweep: an orphan left by a failed post-commit delete is only logged, never retried
  - TOCTOU race on username uniqueness can orphan one object (rare, infrastructure-level)
  - MIME type validation is client-supplied header only (no magic-byte check; safe under current CDN origin policy)

### Refactor: StorageDriver Seam & Public Key Prefix

- **Severity:** Low
- **Status:** Implemented, unreleased (on branch `feat/file-upload`)
- **Impact:** No public API change. `FileStorageService` now talks to storage through a `StorageDriver`
  port instead of calling the S3 SDK directly; the upload/delete request and response shapes are
  unaffected. The `image` URL shape changes (gains a `public/` path segment) but the field itself and
  its contract are unaffected.
- **Details:**
  - New `StorageDriver` interface (`put`, `delete`, `list`, `url`) behind the `STORAGE_DRIVER`
    injection token; `FileStorageService` depends only on the interface, not `ConfigService`
  - `S3StorageDriver` is the sole implementation, bound directly in `FileStorageModule`
    (`{ provide: STORAGE_DRIVER, useClass: S3StorageDriver }`) — no env-driven backend selection,
    since a selector with one valid value has nothing to select. The token stays exported so a
    second backend can be introduced later without touching any consumer
  - `S3StorageDriver` requires `STORAGE_BUCKET` and `STORAGE_PUBLIC_URL` at construction and fails
    at boot, not on first upload, if either is missing
  - `FileStorageService.upload` now generates keys as
    `public/uploads/{ownerType}/{ownerId}/{uuid}.{ext}` instead of `uploads/{ownerType}/{ownerId}/...`
    — preparation for a later private tier: a `private/` prefix can be added afterward without
    moving any object already written under `public/`
  - `docker/minio-init.sh` scopes its anonymous-download policy to the `public` prefix only
    (`mc anonymous set download local/$BUCKET/public`), not the whole bucket, so a future private
    prefix in the same bucket is not incidentally exposed
  - `test/support/storage-harness.ts` builds its driver the same way the app does, so the e2e suite
    cannot exercise a backend the app itself would not use
  - E2E suite (76 tests / 15 suites) runs against real MinIO
- **Limitations:**
  - No private tier yet: no `temporaryUrl`, no signed routes, no visibility parameter

---

## 2026-09-03

### Infra: CI/CD & Render Deployment

- **Severity:** High
- **Status:** Complete
- **Impact:** Automated deployment pipeline and production environment
- **Details:**
  - GitHub Actions CI gates: Prisma validate, lint, typecheck, unit tests, E2E tests (PostgreSQL + MinIO), production build
  - Manual deploy to Render Free (Singapore)
  - Migrations run before app start; demo seed runs once on first deploy
  - Database-aware health check at /health
  - Blueprint switching supported (native Node vs Docker runtime)

---

## 2026-09-04

### Infra: Docker Development Environment

- **Severity:** Medium
- **Status:** Complete
- **Impact:** All developers use consistent containerized development setup
- **Details:**
  - Docker Compose with PostgreSQL, MinIO, and NestJS app
  - Workspace bind mounts for IDE and pnpm store
  - Single `.env` file usable by both host and container
  - `make dev` orchestrates setup, migration, and watch mode
  - Adminer optional for database inspection

---

## 2026-09-08

### Feat: Extensible Authentication System

- **Severity:** Medium
- **Status:** Complete
- **Impact:** Flexible authentication strategy supporting multiple providers in future
- **Details:**
  - Passport + JWT strategy pattern
  - Supports login and registration flows
  - Token-based authentication on protected endpoints

### Spec: File Upload & Attachment Management Design

- **Severity:** Medium
- **Status:** Designed (implementation in progress)
- **Impact:** Architecture and contract for file storage feature
- **Details:**
  - Defines S3-compatible storage (MinIO/AWS)
  - Polymorphic Attachment table design
  - Avatar replacement lifecycle and failure modes
  - Compensation and post-commit reclamation strategy

---

## 2026-08-28

### Feat: Article Favorites

- **Severity:** Low
- **Status:** Complete
- **Impact:** Users can favorite and unfavorite articles
- **Details:**
  - POST /articles/:slug/favorite to add
  - DELETE /articles/:slug/favorite to remove
  - Favorite count reflected in article response

---

## 2026-08-26

### Feat: Profile & Follow System

- **Severity:** Medium
- **Status:** Complete
- **Impact:** User profiles and social following
- **Details:**
  - GET /profiles/:username for user profile
  - POST /profiles/:username/follow to follow
  - DELETE /profiles/:username/follow to unfollow
  - Following status included in profile response

---

## 2026-08-24

### Feat: Article Listing & Pagination

- **Severity:** Medium
- **Status:** Complete
- **Impact:** Efficient querying of large article datasets
- **Details:**
  - GET /articles with query filters: tag, author, favorited
  - Cursor-based pagination with limit and page parameters
  - Always returns newest first (createdAt descending)
  - Proper empty-result handling (200 with empty data, not 404)

---

## Earlier Phases

### Core API Scaffolding

- **Status:** Complete
- **Details:** NestJS 11, TypeScript 5.7, Prisma 7, PostgreSQL, middleware setup

### Article Management (CRUD)

- **Status:** Complete
- **Details:** Create, read, update, delete articles with timestamps

### Comments & Relationships

- **Status:** Complete
- **Details:** Article comments, comment authorship, comment deletion

### User Authentication (Basic)

- **Status:** Complete
- **Details:** Registration, login, JWT token handling

---

## Test Coverage

| Gate            | Status  | Details                                       |
| --------------- | ------- | --------------------------------------------- |
| Prisma Validate | Passing | Schema consistency checked                    |
| Typecheck       | Passing | Full TypeScript strict mode                   |
| Lint (ESLint)   | Passing | Code style & security rules                   |
| Build           | Passing | NestJS compilation successful                 |
| Unit Tests      | Passing | 331 tests across 33 suites                    |
| E2E Tests       | Passing | 76 tests across 15 suites (PostgreSQL, MinIO) |

---

## Versioning

**Current:** 0.0.1 (development)

**Package Manager:** pnpm 11.5.1

**Node:** 22.x

**Database:** PostgreSQL 16+

---

## Related Documentation

- [Development Roadmap](./development-roadmap.md)
- [System Architecture](./system-architecture.md)
- [API Documentation](./api/README.md)
