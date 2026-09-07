# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=22.22.3

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
ENV COREPACK_HOME=/usr/local/share/corepack
ENV PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
WORKDIR /app
RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /pnpm /usr/local/share/corepack \
    && corepack enable \
    && corepack prepare pnpm@11.5.1 --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS development
ARG HOST_USER_ID=1000
ARG HOST_GROUP_ID=1000
COPY . .
RUN if [ "${HOST_USER_ID}" = 0 ] || [ "${HOST_GROUP_ID}" = 0 ]; then \
        echo "HOST_USER_ID and HOST_GROUP_ID must be non-zero" >&2; \
        exit 1; \
    fi \
    && apt-get update \
    && apt-get install --yes --no-install-recommends procps \
    && rm -rf /var/lib/apt/lists/* \
    && pnpm db:generate \
    && if getent group "${HOST_GROUP_ID}" >/dev/null 2>&1; then \
           usermod -o -u "${HOST_USER_ID}" -g "${HOST_GROUP_ID}" node; \
       else \
           groupmod -o -g "${HOST_GROUP_ID}" node \
           && usermod -o -u "${HOST_USER_ID}" -g "${HOST_GROUP_ID}" node; \
       fi \
    && chown -R node:node /app /home/node /pnpm
USER node
CMD ["pnpm", "start:dev"]

FROM dependencies AS build
COPY . .
RUN pnpm db:generate && pnpm build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-prod,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM base AS production
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=node:node /app/prisma/migrations ./prisma/migrations
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --chmod=755 --chown=node:node docker/docker-entrypoint.sh /usr/local/bin/docker-entrypoint
RUN mkdir -p /app/logs && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "const port=process.env.PORT||3000;fetch('http://127.0.0.1:'+port+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["docker-entrypoint"]
