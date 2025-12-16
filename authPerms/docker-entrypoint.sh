#!/bin/sh
set -e

echo "🚀 Démarrage du microservice AuthPerms..."

# Attendre que la base de données soit prête (si nécessaire)
if [ "$WAIT_FOR_DB" = "true" ]; then
  echo "⏳ Attente de la base de données..."
  until nc -z $DB_HOST $DB_PORT; do
    sleep 1
  done
  echo "✅ Base de données prête!"
fi

# Exécuter les migrations (si nécessaire)
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "🔄 Exécution des migrations..."
  node dist/scripts/run-migrations.js
fi

# Démarrer l'application
echo "🎯 Démarrage de l'application..."
exec "$@"