FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/db/package.json packages/db/
COPY packages/config/package.json packages/config/
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
RUN pnpm install --no-frozen-lockfile
COPY tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @fedites/db seed --help >/dev/null 2>&1 || true
RUN pnpm --filter @fedites/api... build || true

FROM node:22-alpine
WORKDIR /repo
RUN corepack enable
COPY --from=build /repo ./
EXPOSE 8787
CMD ["pnpm", "--filter", "@fedites/api", "start"]
