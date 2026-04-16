FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install -g npm@11 && npm ci --omit=dev

COPY . .

RUN chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=8081

EXPOSE 8081

CMD ["node", "--import", "tsx", "server.ts"]
