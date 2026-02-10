# Backend-only container for Railway/Fly/Render.
# Uses Bookworm/OpenSSL 3 to match Prisma debian-openssl-3.0.x engine target.

FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generate Prisma client + compile backend
RUN npx prisma generate && npm run build:backend

FROM node:20-bookworm AS runner
WORKDIR /app
ENV NODE_ENV=production

# Ensure OpenSSL runtime is present for Prisma query engine
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist-server ./dist-server

EXPOSE 3000
CMD ["node", "dist-server/server.js"]

