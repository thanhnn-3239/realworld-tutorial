# Development Roadmap

This document tracks the project's phases, milestones, and progress toward a production-ready RealWorld API implementation.

## Project Overview

Building a fully-featured RealWorld backend in NestJS with PostgreSQL, deployed on Render, with automated testing and CI/CD gates. The implementation follows the RealWorld API spec and includes user authentication, article management, comments, and file storage.

## Current Status

**Overall Progress:** Core API implemented; file upload infrastructure complete but unreleased.

**Last Updated:** 2026-09-09

## Phases

| Phase   | Name                                  | Status                      | Spec Date      | Notes                                                             |
| ------- | ------------------------------------- | --------------------------- | -------------- | ----------------------------------------------------------------- |
| P1      | Core API scaffolding & authentication | Complete                    | —              | NestJS, Prisma, PostgreSQL, JWT                                   |
| P2      | Article management                    | Complete                    | —              | CRUD, pagination, timestamps                                      |
| P3      | Comments & favorites                  | Complete                    | —              | Article-associated comments, favorite toggle                      |
| P4      | Article listing & pagination          | Complete                    | 2026-08-24     | Query filters, cursor pagination                                  |
| P5      | Profile & follow system               | Complete                    | 2026-08-26     | User profiles, follow/unfollow                                    |
| P6      | Article favorites                     | Complete                    | 2026-08-28     | Favorite/unfavorite toggle                                        |
| P7      | Docker development environment        | Complete                    | 2026-09-04     | Compose setup, workspace mounts, development workflow             |
| P8      | CI/CD & Render deployment             | Complete                    | 2026-09-03     | GitHub Actions gates, manual Render deploy, health checks         |
| P9      | Extensible authentication             | Complete                    | 2026-09-08     | Passport/JWT strategy, login/registration                         |
| **P10** | **File upload & avatar management**   | **Implemented, unreleased** | **2026-09-08** | **Multipart upload sets/replaces the avatar; `User.image` holds the S3 key with a `FOR UPDATE` row lock ordering concurrent replacements; `StorageDriver` seam with a single S3-compatible implementation** |

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

**Target:** Release file upload feature after verification and documentation.

## Success Metrics

| Metric            | Target                                 | Current     |
| ----------------- | -------------------------------------- | ----------- |
| Unit test suites  | ≥ 20                                   | 33          |
| Unit tests        | ≥ 200                                  | 331         |
| E2E test suites   | ≥ 10                                   | 15          |
| E2E tests         | ≥ 50                                   | 76          |
| CI gates          | Lint, typecheck, test, build           | All passing |
| Code review gates | Type safety, style, no security issues | All passing |

## Known Limitations

- Rate limiting not yet implemented (affects file upload bandwidth per user)
- Magic-byte file validation deferred (MIME type only, safe under current CDN setup)
- Orphan object sweep on failed post-commit deletes requires manual intervention or next-upload retry
- TOCTOU race on email/username uniqueness can orphan one object (rare, infrastructure-level)

## Next Steps

1. Release file upload feature on main branch after final verification
2. Deploy to Render and verify E2E against production
3. Begin scope for enhanced file management (bulk delete, expiration policy)
4. Consider rate limiting and file quota per user
5. Evaluate scheduled cleanup job for orphaned objects

## Related Documentation

- [System Architecture](./system-architecture.md)
- [Project Changelog](./project-changelog.md)
- [API Documentation](./api/README.md)
- [File Upload Design Spec](./superpowers/specs/2026-09-08-file-upload-design.md)
