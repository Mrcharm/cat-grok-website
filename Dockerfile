FROM node:22.22.2-alpine

WORKDIR /app
RUN npm install --global corepack@0.35.0 && corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

COPY --chown=node:node server ./server

ENV NODE_ENV=production
USER node
EXPOSE 8787
CMD ["pnpm", "start:voice"]
