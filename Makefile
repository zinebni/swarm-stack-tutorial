# ─────────────────────────────────────────────────────────────
#  Makefile  —  Commandes utiles pour le tutoriel
#  Simplifier les commandes Docker Swarm courantes
# ─────────────────────────────────────────────────────────────
#  Usage: make <commande>
#  Exemple: make build    puis    make deploy
# ─────────────────────────────────────────────────────────────

STACK_NAME = demo

# ── Construire les images Docker ──────────────────────────────
build:
	docker build -t demo-frontend ./frontend
	docker build -t demo-api ./api

# ── Initialiser Swarm (nécessaire une seule fois) ─────────────
init-swarm:
	docker swarm init

# ── Déployer la stack principale ──────────────────────────────
deploy:
	docker stack deploy -c stack.yml $(STACK_NAME)

# ── Déployer avec les secrets ─────────────────────────────────
deploy-secrets:
	docker stack deploy -c stack.yml -c stack.secrets.yml $(STACK_NAME)

# ── Créer le secret api_key ───────────────────────────────────
create-secret:
	echo "ma_cle_api_super_secrete_1234" | docker secret create api_key -

# ── Lister les services de la stack ──────────────────────────
services:
	docker stack services $(STACK_NAME)

# ── Voir les tâches (conteneurs) en cours ────────────────────
ps:
	docker stack ps $(STACK_NAME)

# ── Voir les logs d'un service ────────────────────────────────
logs-api:
	docker service logs -f $(STACK_NAME)_api

logs-frontend:
	docker service logs -f $(STACK_NAME)_frontend

logs-redis:
	docker service logs -f $(STACK_NAME)_redis

# ── Supprimer la stack ────────────────────────────────────────
down:
	docker stack rm $(STACK_NAME)

# ── Supprimer la stack et quitter le Swarm ────────────────────
clean:
	docker stack rm $(STACK_NAME)
	docker swarm leave --force

# ── Scaler l'API (ex: make scale-api n=3) ────────────────────
scale-api:
	docker service scale $(STACK_NAME)_api=$(n)

.PHONY: build init-swarm deploy deploy-secrets create-secret services ps \
        logs-api logs-frontend logs-redis down clean scale-api
