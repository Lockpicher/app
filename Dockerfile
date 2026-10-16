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

EXPOSE 80

CMD ["node", "--use-system-ca", "server.mjs"]
