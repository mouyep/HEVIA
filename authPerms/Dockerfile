# Étape de construction
FROM node:18-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le code source
COPY src/ ./src/
COPY migrations/ ./migrations/

# Compiler TypeScript
RUN npm run build

# Étape d'exécution
FROM node:18-alpine

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs
RUN adduser -S authperms -u 1001

# Copier les fichiers construits depuis l'étape de construction
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Copier les autres fichiers nécessaires
COPY .env.example ./
COPY docker-entrypoint.sh ./

# Définir les permissions
RUN chown -R authperms:nodejs /app
USER authperms

# Exposer le port
EXPOSE 3001

# Point d'entrée
ENTRYPOINT ["sh", "docker-entrypoint.sh"]

# Commande par défaut
CMD ["node", "dist/app.js"]