<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript implementation of the RealWorld Conduit backend specification, featuring PostgreSQL, Prisma ORM, and Render CI/CD deployment.

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

### SunLint is advisory, not a CI gate

SunLint remains available locally through `pnpm lint` (plus `pnpm lint:changed` and `pnpm lint:security`) but is deliberately excluded from `ci`, which runs `pnpm lint:ci` instead. Its CLI exits non-zero whenever any violation exists, regardless of severity - `handleExit()` counts violations and never reads severity - so it cannot express "report warnings, reject errors". The per-rule severity configuration its own documentation describes is not implemented in the shipped CLI, and roughly 43% of the warnings it reports here are false positives from rules written for TypeORM rather than Prisma. Treat its output as advice to read, not a gate to satisfy.

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

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
