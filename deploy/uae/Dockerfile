# One container for the site and the speech-token function, for a UAE region
# (for example Azure Container Apps in UAE North). Not built by this repo's checks:
# the checks run deploy/uae/server.mjs directly (deploy/uae/README.md).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY api ./api
COPY deploy/uae/server.mjs ./deploy/uae/server.mjs
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "deploy/uae/server.mjs"]
