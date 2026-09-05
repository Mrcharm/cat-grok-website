FROM node:22.13-alpine

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --chown=node:node server ./server

ENV NODE_ENV=production
USER node
EXPOSE 8787
CMD ["pnpm", "start:voice"]
