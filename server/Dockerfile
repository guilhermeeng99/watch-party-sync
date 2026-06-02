FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY packages/protocol/package.json packages/protocol/package.json
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile=false

FROM deps AS build
COPY . .
RUN pnpm --filter @watch-party-sync/server build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/protocol/package.json packages/protocol/package.json
COPY --from=build /app/packages/protocol/dist packages/protocol/dist
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/server/dist server/dist
RUN pnpm install --prod --frozen-lockfile=false
EXPOSE 8787
CMD ["node", "server/dist/index.js"]
