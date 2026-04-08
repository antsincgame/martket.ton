# Образ API: Node 20 slim — без нативной сборки SQLite; данные в Appwrite.
FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=8081

EXPOSE 8081

CMD ["node", "server.js"]
