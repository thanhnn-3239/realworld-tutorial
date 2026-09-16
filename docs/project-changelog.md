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

## 2026-09-16

### Feat: Google Account Link Confirmation Email via BullMQ & Redis

- **Severity:** High
- **Status:** Complete
- **Impact:** Google account collisions with existing password accounts no longer automatically
  link or evict password credentials. Instead, the API requires explicit one-time email
  confirmation before attaching the Google identity. Existing passwords and active user
  sessions remain intact throughout.
- **Details:**
  - Added background email processing architecture with BullMQ and Redis (`BackgroundJobsModule`,
    `EmailModule`). Producer connections configure `maxRetriesPerRequest: 1`, worker connections
    configure `maxRetriesPerRequest: null`.
  - Added `PendingAuthProviderLink` model with single-use 32-byte cryptographically random
    token (base64url encoded, SHA-256 digest persisted, 15-minute TTL, 60-second resend cooldown).
  - Outbound email jobs enqueue to BullMQ `email` queue with bounded retries (3 attempts, exponential
    backoff starting at 5s). Nodemailer SMTP sender transmits HTML and plain text confirmation
    emails (Mailpit locally, SMTP provider in production).
  - On Google OAuth callback collision, the server responds with `202 Accepted`
    (`{ "status": "confirmation_required" }`) and enqueues the link confirmation email without
    clearing passwords or revoking refresh tokens.
  - Added `POST /v1/auth/google/link/confirm` accepting `{ "token": "..." }`. The endpoint claims
    and deletes the unexpired pending link in an atomic Prisma transaction, creates the
    `AuthProvider` row, and returns `200 OK` (`{ "confirmed": true }`) idempotently on concurrent
    confirmations (while sequential replays of consumed tokens reject with `400 Bad Request`), without
    issuing application tokens.
  - Added daily scheduled cleanup at 04:00 (`0 0 4 * * *`) via `ScheduleModule` to prune expired
    pending links.
  - Verification & quality gates: lint (`pnpm lint:ci`), typecheck (`pnpm typecheck`), unit tests
    (57 suites / 480 tests), compiled worker tests (1 suite / 2 tests), and full E2E test suite
    with PostgreSQL, Redis, and Mailpit (30 suites / 132 tests) passing cleanly. Multi-stage
    production Docker image verified with compiled application and background queue dependencies.

---

## 2026-09-15

### Refactor: Share and Simplify the Piscina Worker Pool

- **Severity:** Low
- **Status:** Complete
- **Impact:** No public API or avatar-processing behavior changes. Piscina initialization,
  global CPU/queue capacity, timeout, and shutdown now form reusable infrastructure for
  future CPU-heavy tasks.
- **Details:**
  - Added one process-wide `WorkerPoolModule` with method-level generic task/result dispatch;
    internal feature services select their worker path, optional named handler, timeout, and
    transfer list per task
  - Removed every image dependency from `PiscinaPoolService`; Sharp policy, image contracts,
    compiled image-worker path, and 422/503 mapping remain inside `ImageProcessingModule`
  - Deleted the superseded image-owned pool, its three specs, and shared mock harness; merged
    logging assertions into the real image service spec and removed a pass-through result type
  - Combined worker-pool and image-processing source/tests decreased from 25 files / 1,265
    lines to 24 files / 1,045 lines. Production code increased from 18 files / 507 lines to
    20 files / 530 lines because the reusable module/options/generic errors are now explicit
    instead of image-owned
  - Post-refactor verification passed: lint, typecheck, production build, all unit tests (40
    suites / 380 tests), compiled-worker tests (1 suite / 2 tests), both affected avatar E2E
    suites (17 tests), and staged/unstaged `git diff --check`
  - The full 26-suite E2E and Docker-image gates were not rerun; their previous delivery
    evidence remains recorded under 2026-09-14 and the focused runtime contracts above passed

---

## 2026-09-14

### Feat: Bounded Server-Side Avatar Image Validation & Normalization

- **Severity:** High
- **Status:** Complete
- **Impact:** Every accepted avatar upload is now decoded, validated, and re-encoded to a
  fixed shape before storage; the original uploaded bytes are never persisted. Closes the
  previously-logged "magic-byte validation deferred" gap.
- **Details:**
  - `PUT /user` avatar upload: declared-MIME allowlist narrowed to `image/jpeg`,
    `image/png`, `image/webp` (GIF removed — the decoded-format check would reject it
    anyway, so the declared allowlist now matches what can actually pass); Multer limit
    stays 5 MiB (`413` on overflow)
  - `ImageProcessingModule`/`ImageProcessingService` decodes and validates uploaded bytes
    with Sharp through the shared bounded `PiscinaPoolService`; the image module exports only
    its facade and keeps its worker path and policy internal
  - Pool bounds: `maxThreads = clamp(1, 2, availableParallelism() - 1)`, queue capped at
    `2x` that thread count, 10s per-task timeout (aborts the in-flight task, not just the
    caller's wait), `sharp.concurrency(1)` pinned once per worker thread, graceful drain on
    `OnApplicationShutdown` with a 30s Piscina `closeTimeout`
  - Rejected as generic `422 Invalid avatar image` (no internal reason ever reaches the
    caller): undecodable bytes, decoded format outside JPEG/PNG/WebP, multi-frame/animated
    images, shortest oriented side below 256px, decoded pixel count above 16,000,000
  - Rejected as generic `503 Image processing unavailable`: pool/queue saturation, task
    timeout, or any other unexpected worker failure
  - Accepted avatars are always normalized to a static 512x512 WebP (quality 82,
    centre-cropped, auto-oriented) before upload — re-encoding also strips all source
    metadata (EXIF, ICC profile, GPS, etc.) as a byproduct, not a separate step
  - Processing runs synchronously in the same request/response cycle as `PUT /user` — no
    queue, job, or async completion
  - Storage key format (`avatars/{userId}/{uuid}.webp`), the transaction ordering (conflict
    check → process → upload → locked transaction → post-commit cleanup), and the DB-failure
    compensation/previous-object cleanup paths are all unchanged by this work
  - CI: `quality` job now also runs `pnpm test:worker --runInBand` (a dedicated Jest config,
    `test/jest-worker.json`, exercising the compiled worker against real Sharp decodes) after
    `pnpm build`; `docker-image` job's runtime-file assertion now also checks that
    `dist/image-processing/workers/image-processing.worker.js` exists and that `sharp` and
    `piscina` resolve (`require`) inside the production image
  - Full feature-delivery gate run: lint:ci, typecheck, unit (44 suites / 391 tests),
    production build, `test:worker` (1 suite / 2 tests), e2e (26 suites / 111 tests),
    prettier --check, `docker build --target production`, both docker runtime-check
    commands, and `git diff --check` — all exit 0 (see
    [task-8-report.md](../.superpowers/sdd/2026-09-13-piscina-avatar-image-processing/task-8-report.md)
    for the full log)
- **Limitations:**
  - Gates in this session ran on one CI architecture (linux/amd64 in the dev container);
    no multi-architecture Sharp binary coverage is claimed
  - The declared-MIME check at the multipart layer is still client-supplied header only —
    the decoded-image check in the worker is the actual security boundary, not the header
  - Rate limiting on `PUT /user` itself is still not implemented
  - The existing bucket-policy/prefix mismatch (avatar keys live under `avatars/{userId}/`,
    not the `public/` prefix `docker/minio-init.sh` grants anonymous download on) predates
    this change and is **not resolved** by it — avatar URLs are not claimed to be
    anonymously retrievable

---

## 2026-09-11

### Infra: Isolated E2E Test Foundation

- **Severity:** Medium
- **Status:** Complete
- **Impact:** New E2E tests need only a thin suite context and fixtures; local and CI exercise the same containerized PostgreSQL + MinIO topology
- **Details:**
  - Added committed test-only `.env.e2e.example`; `make test-e2e` creates the ignored `.env.e2e` runtime file when missing, while Compose project `realworld-e2e` isolates its containers, network, ports and volumes from development
  - Each suite receives a run-scoped cloned PostgreSQL database and MinIO bucket; application tables and objects reset before every test
  - Central name guards refuse database or bucket cleanup outside the current run namespace and protect the base E2E database
  - `useE2eSuite` exposes request, Prisma, dependency resolution and user/article fixtures; `useDatabaseSuite` serves repository integration tests
  - Suite-specific database and storage values are injected through `ConfigService`; Jest workers do not mutate shared generic environment variables
  - Migrated all 15 prior suites and split oversized files into 26 focused suites, all below 200 lines
  - Local and CI now generate the same `.env.e2e` from the committed template and use one Make/Compose entrypoint; CI prints service logs on failure and always removes the E2E project
  - Four-worker median: 102 tests in 26 suites, Jest 10.59s and full command wall time 15.47s across three green runs (20.6% above the 12.83s baseline)

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

| Gate                    | Status  | Details                                                        |
| ----------------------- | ------- | -------------------------------------------------------------- |
| Prisma Validate         | Passing | Schema consistency checked                                     |
| Typecheck               | Passing | Full TypeScript strict mode                                    |
| Lint (ESLint)           | Passing | Code style & security rules                                    |
| Build                   | Passing | NestJS compilation successful                                  |
| Unit Tests              | Passing | 380 tests across 40 suites                                     |
| Image Processing Worker | Passing | 2 tests across 1 suite (real Sharp decode, `pnpm test:worker`) |
| E2E Tests               | Passing | 111 tests across 26 suites (PostgreSQL, MinIO)                 |

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
