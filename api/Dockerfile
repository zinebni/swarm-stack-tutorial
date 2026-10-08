# ─────────────────────────────────────────────────────────────
#  Dockerfile  —  Image pour l'API Node.js
# ─────────────────────────────────────────────────────────────
#
#  Utilise l'image officielle Node.js en version "alpine"
#  (très légère, basée sur Alpine Linux ~5 MB).
#  C'est une bonne pratique pour les images de production.
#
FROM node:20-alpine

# Définir le dossier de travail dans le conteneur
WORKDIR /app

# ── Copier d'abord uniquement les fichiers de dépendances ──
# Cela permet à Docker de mettre en cache cette couche.
# Si package.json ne change pas, npm install ne sera pas
# relancé à chaque build → gain de temps.
COPY package.json package-lock.json* ./

# Installer les dépendances Node.js
RUN npm install --production

# ── Copier le reste du code source ──
COPY server.js .

# Exposer le port sur lequel l'API écoute
# (informatif, Swarm gère le réseau overlay)
EXPOSE 3000

# Commande de démarrage
CMD ["node", "server.js"]
