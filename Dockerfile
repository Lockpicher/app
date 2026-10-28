FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server.mjs ./
# server.mjs importa estos dos módulos en tiempo de ejecución (auth + guardia SSRF)
COPY src/lib/apiGuard.mjs ./src/lib/apiGuard.mjs
COPY src/lib/webScraperServer.ts ./src/lib/webScraperServer.ts

EXPOSE 80

CMD ["node", "--use-system-ca", "server.mjs"]
