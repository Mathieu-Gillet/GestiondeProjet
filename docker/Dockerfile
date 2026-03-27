# ─── Stage 1 : Build du frontend React ────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci --prefer-offline

COPY client/ .
RUN npm run build

# ─── Stage 2 : Application de production ──────────────────────────────────────
FROM node:22-alpine AS production

WORKDIR /app

# su-exec : drop de privilèges après correction des permissions du volume
RUN apk add --no-cache su-exec

# Utilisateur non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Dépendances backend (production uniquement)
COPY server/package*.json ./
RUN npm ci --omit=dev --prefer-offline

# Code backend
COPY server/ .

# Frontend compilé → servi statiquement par Express
COPY --from=frontend-build /app/client/dist ./public

# Répertoire de données SQLite (le volume sera monté ici)
RUN mkdir -p /app/data

# Entrypoint (s'exécute en root pour corriger les permissions du volume)
COPY docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

VOLUME ["/app/data"]
EXPOSE 3000

# Pas de USER ici : l'entrypoint tourne en root, corrige /app/data,
# puis bascule vers appuser via su-exec avant de lancer Node.
ENTRYPOINT ["/entrypoint.sh"]
