# Development Roadmap

This document tracks the project's phases, milestones, and progress toward a production-ready RealWorld API implementation.

## Project Overview

Building a fully-featured RealWorld backend in NestJS with PostgreSQL, deployed on Render, with automated testing and CI/CD gates. The implementation follows the RealWorld API spec and includes user authentication, article management, comments, and file storage.

## Current Status

**Overall Progress:** Core API implemented; file upload (with bounded server-side image
validation/normalization) and isolated E2E infrastructure complete.

**Last Updated:** 2026-09-18

## Phases

| Phase   | Name                                                | Status       | Spec Date      | Notes                                                                                                                                                                                                                                                                                                           |
| ------- | --------------------------------------------------- | ------------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1      | Core API scaffolding & authentication               | Complete     | —              | NestJS, Prisma, PostgreSQL, JWT                                                                                                                                                                                                                                                                                 |
| P2      | Article management                                  | Complete     | —              | CRUD, pagination, timestamps                                                                                                                                                                                                                                                                                    |
| P3      | Comments & favorites                                | Complete     | —              | Article-associated comments, favorite toggle                                                                                                                                                                                                                                                                    |
| P4      | Article listing & pagination                        | Complete     | 2026-08-24     | Query filters, cursor pagination                                                                                                                                                                                                                                                                                |
| P5      | Profile & follow system                             | Complete     | 2026-08-26     | User profiles, follow/unfollow                                                                                                                                                                                                                                                                                  |
| P6      | Article favorites                                   | Complete     | 2026-08-28     | Favorite/unfavorite toggle                                                                                                                                                                                                                                                                                      |
| P7      | Docker development environment                      | Complete     | 2026-09-04     | Compose setup, workspace mounts, development workflow                                                                                                                                                                                                                                                           |
| P8      | CI/CD & Render deployment                           | Complete     | 2026-09-03     | GitHub Actions gates, manual Render deploy, health checks                                                                                                                                                                                                                                                       |
| P9      | Extensible authentication                           | Complete     | 2026-09-08     | Passport/JWT strategy, login/registration                                                                                                                                                                                                                                                                       |
| P10     | File upload & avatar management                     | Complete     | 2026-09-08     | Multipart upload sets/replaces the avatar; `User.image` holds the S3 key with a `FOR UPDATE` row lock ordering concurrent replacements; `StorageDriver` seam with a single S3-compatible implementation                                                                                                         |
| P11     | Isolated E2E test foundation                        | Complete     | 2026-09-11     | Shared local/CI Compose flow, per-suite PostgreSQL/MinIO isolation, before-each reset, thin contexts and hybrid fixtures; 15.47s median wall time, 20.6% over baseline                                                                                                                                          |
| P12     | Server-side avatar image validation & normalization | Complete     | 2026-09-14     | Declared-MIME allowlist narrowed to jpeg/png/webp; Sharp decode/validate/resize uses the shared bounded Piscina worker pool (max 2 threads, 2x queue, 10s task timeout, 30s shutdown drain); every accepted avatar re-encoded to a static 512x512 WebP, stripping source metadata; generic 422/503 on rejection |
| P13     | Google account link confirmation email              | Complete     | 2026-09-16     | Durable email confirmation via BullMQ, Redis, and SMTP for Google account link collisions; single-use 32-byte token with SHA-256 hash persistence, 15m TTL, 60s cooldown; preserves existing passwords and sessions; atomic transaction confirmation; daily 04:00 expired link cleanup                      |
| **P14** | **Article draft preview over gRPC**                 | **Complete** | **2026-09-18** | **JWT-protected draft preview (`POST /v1/articles/preview`) using NestJS hybrid application architecture; loopback-only gRPC transport (`127.0.0.1:50051`) with unary `Analyze` RPC; deterministic metadata (Unicode whitespace normalization, 160-char excerpt, word count, reading time ceil(words/200)); REST boundary with 300 ms deadline and 503 fallback; opt-in E2E harness; zero DB persistence or Kafka events; single Render Free process.** |

## Milestones

### M1: MVP (Complete)

- User registration & login
- Article CRUD
- Comments on articles
- Favorite articles
- Follow/unfollow users

**Criteria met:** All endpoints functional, E2E coverage established.

### M2: Production readiness (In Progress)

- Automated deployment pipeline
- Database-aware health checks
- File storage infrastructure
- Comprehensive test coverage

**Target:** File upload (P10/P12) and Google account link confirmation (P13) verified and documented; pending release to `main` and a production deploy.

## Success Metrics

| Metric                        | Target                                                       | Current                                                |
| ----------------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| Unit test suites              | ≥ 20                                                         | 57                                                     |
| Unit tests                    | ≥ 200                                                        | 480                                                    |
| Image processing worker suite | n/a — dedicated real-Sharp gate                              | 1 suite / 2 tests                                      |
| E2E test suites               | ≥ 10                                                         | 30                                                     |
| E2E tests                     | ≥ 50                                                         | 132                                                    |
| CI gates                      | Lint, typecheck, test, build, test:worker, e2e, docker-image | All 8 delivery gates passing locally and containerized |
| Code review gates             | Type safety, style, no security issues                       | Spec and quality reviews approved                      |

## Known Limitations

- Rate limiting not yet implemented (affects file upload bandwidth per user)
- Declared avatar MIME type at the multipart layer is still client-supplied header only;
  the decoded-image validation in the Piscina/Sharp worker is the real content boundary
  (magic-byte-equivalent validation is no longer deferred — see P12)
- Orphan object sweep on failed post-commit deletes requires manual intervention or next-upload retry
- TOCTOU race on email/username uniqueness can orphan one object (rare, infrastructure-level)
- Bucket anonymous-download policy (`docker/minio-init.sh`) is scoped to the `public/`
  prefix, but avatar keys live under `avatars/{userId}/` — this pre-existing mismatch is
  unresolved; avatar URLs are not anonymously retrievable under the current policy
- Gates verified on one CI architecture (linux/amd64); no multi-architecture Sharp binary
  coverage is claimed

## Next Steps

1. Deploy to Render and verify E2E against production
2. Begin scope for enhanced file management (bulk delete, expiration policy)
3. Consider rate limiting and file quota per user
4. Evaluate scheduled cleanup job for orphaned objects
5. Resolve the avatar key / bucket-policy prefix mismatch (either move avatars under
   `public/` or extend the anonymous-download policy) before relying on public avatar URLs

## Related Documentation

- [System Architecture](./system-architecture.md)
- [Project Changelog](./project-changelog.md)
- [API Documentation](./api/README.md)
- [File Upload Design Spec](./superpowers/specs/2026-09-08-file-upload-design.md)
