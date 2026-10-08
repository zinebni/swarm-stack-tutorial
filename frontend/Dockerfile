# ─────────────────────────────────────────────────────────────
#  Dockerfile  —  Image pour le front-end (Nginx reverse proxy)
# ─────────────────────────────────────────────────────────────
#
#  On utilise l'image officielle Nginx "alpine" (légère).
#  Le rôle de ce conteneur est double :
#    1. Servir les fichiers HTML statiques du front-end
#    2. Agir comme reverse proxy vers l'API Node.js
#
FROM nginx:1.25-alpine

# Supprimer la configuration Nginx par défaut
# et la remplacer par la nôtre (voir nginx.conf)
RUN rm /etc/nginx/conf.d/default.conf

# Copier notre configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copier les fichiers HTML du front-end
COPY html/ /usr/share/nginx/html/

# Port 80 exposé (sera mappé dans stack.yml)
EXPOSE 80
