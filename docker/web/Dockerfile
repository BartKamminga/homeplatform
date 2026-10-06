# syntax=docker/dockerfile:1
# homeplatform-web: Caddy + Caddyfile + gebouwde frontend in één image.
# Build-context = repo-root (frontend/ en Caddyfile.* nodig), zie docker-compose.g4.yml / .acc.yml.
# CADDYFILE kiest de omgeving: Caddyfile.prod (default) of Caddyfile.acc.

FROM node:22-slim AS build
WORKDIR /src/frontend

# Eerst alleen de lockfiles: npm ci-laag blijft gecachet zolang de dependencies niet wijzigen.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/sites/package.json frontend/sites/package-lock.json ./sites/
RUN cd sites && npm ci --no-audit --no-fund

COPY frontend/ ./
RUN cd sites && npm run build

FROM caddy:2
ARG CADDYFILE=Caddyfile.prod
COPY ${CADDYFILE} /etc/caddy/Caddyfile
COPY --from=build /src/frontend/dist /srv/www
