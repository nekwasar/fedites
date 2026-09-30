FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/tokens/package.json packages/tokens/
COPY packages/config/package.json packages/config/
COPY packages/ui/package.json packages/ui/
COPY packages/db/package.json packages/db/
COPY apps/web/package.json apps/web/
RUN pnpm install --no-frozen-lockfile
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
ARG VITE_API_URL=http://127.0.0.1:8787
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @fedites/web... build

FROM nginx:alpine
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
