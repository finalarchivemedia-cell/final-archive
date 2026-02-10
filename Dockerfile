# Backend-only container for Railway/Fly/Render.
# Uses Bullseye to keep OpenSSL 1.1 compatibility for Prisma engines.

FROM node:20-bullseye AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client + compile backend
RUN npx prisma generate && npm run build:backend

FROM node:20-bullseye AS runner
WORKDIR /app
ENV NODE_ENV=production

# Ensure OpenSSL runtime is present for Prisma query engine
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3000
CMD ["node", "dist-server/server.js"]

