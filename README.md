## Project Setup

### Prerequisites

- Node.js `22.x`
- pnpm `11.5.1`
- Docker & Docker Compose

### Local Development

1. Start the PostgreSQL database:

```bash
docker compose up -d postgres
```

2. Install dependencies:

```bash
pnpm install
```

3. Generate the Prisma Client and run migrations:

```bash
pnpm exec prisma generate
pnpm exec prisma migrate dev
```

## Compile and Run

```bash
# development
pnpm run start

# watch mode
pnpm run start:dev

# production mode
pnpm run start:prod
```

## Run Tests

```bash
# unit tests
pnpm test --runInBand

# e2e tests (requires running postgres)
pnpm test:e2e --runInBand

# test coverage
pnpm run test:cov
```

## Continuous Integration (CI)

The GitHub Actions workflow `ci` runs for pull requests and pushes to `main`, and can also be started manually. It splits into two parallel jobs along one boundary: whether the work needs a database.

**`quality`** - no database, fails fast on static problems:

1. `pnpm exec prisma generate` - Generate Prisma Client
2. `git diff --exit-code -- src/generated/prisma` - Reject a stale committed Prisma Client
3. `pnpm lint:ci` - Run the repository ESLint and Prettier rules read-only, rejecting any warning
4. `pnpm typecheck` - TypeScript compiler checks
5. `pnpm test --runInBand` - Jest unit tests
6. `pnpm build` - Production bundle build

**`e2e`** - runs against a PostgreSQL service container:

1. `pnpm exec prisma generate` - Generate Prisma Client
2. `pnpm test:e2e --maxWorkers=2` - PostgreSQL-backed E2E tests

A third job, **`ci`**, waits on both and succeeds only when both succeed. Branch protection should require that single `ci` check, so splitting or adding jobs later never breaks the protection rule.

Because the jobs run in parallel, a lint failure no longer hides an E2E failure: one run reports both.

Until GitHub branch protection is configured separately to require `ci`, this workflow reports status but does not by itself gate merges.

## Deployment to Render

The application deploys to the Render Free tier in the Singapore region as a Native Node web service paired with a managed PostgreSQL database.

### Deployment Operations

- **Manual Deploy**: Auto-deploy triggers are disabled (`autoDeployTrigger: off`). Deployments must be triggered via Manual Deploy in the Render Dashboard.
- **Manual Sync**: Changes to `render.yaml` require Blueprint **Manual Sync** in the Render Dashboard.
- **Blueprint Auto Sync**: Render Dashboard Blueprint **Auto Sync** must be disabled separately after creation (a post-sync remote step, not a local guarantee).
- **First Deploy**: Confirms production build, database migration (`pnpm exec prisma migrate deploy`), unversioned `/health` check readiness, and one-time demo seed execution via `initialDeployHook`.
- **Environment Secrets**: Render manages `DEMO_USER_PASSWORD` as a secret (`sync: false`) alongside generated `JWT_SECRET` and database connection strings.
- **Recovery Reseed**: Normal deploys run migrations without reseeding. To reseed manually, run `pnpm exec prisma db seed` with `DEMO_USER_PASSWORD` configured.
- **Environment Lifecycle**: The demo environment is disposable and should not live past 30 days due to Render Free database retention limits.
- **Rollback**: A rollback means reverting to a recent Render app deploy, or full disposable resource recreation for unrecoverable schema/data issues.
- **Approval Boundaries**: Commit, push, and deploy actions remain approval-gated. GitHub branch protection and Render Dashboard Auto Sync configuration require remote operator actions.
