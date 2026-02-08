# Backend-only container for Fly.io / Render / etc.
# Builds TypeScript server into dist-server/ and runs it on port 3000.

FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client + compile backend
RUN npx prisma generate && npm run build:backend

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3000
CMD ["node", "dist-server/server.js"]

