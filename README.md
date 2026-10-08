# 🐳 Docker Swarm — Tutoriel stack.yml complet

> **Projet éducatif** — Simule une vraie application web en microservices déployée avec Docker Swarm.
> Chaque fichier est abondamment commenté pour expliquer le **pourquoi** et le **comment**.

---

## 📐 Architecture de la stack

```
  Navigateur (vous)
        │
        ▼  port 80 (exposé sur l'hôte)
  ┌─────────────────┐
  │  Nginx (proxy)  │  ← service "frontend"  (1 réplique)
  │  + HTML statique│    Dockerfile dans ./frontend/
  └────────┬────────┘
           │  Réseau overlay chiffré "app-net"
           │  Règle : /api/* → http://api:3000
           ▼
  ┌─────────────────┐
  │  Node.js API    │  ← service "api"  (2 répliques = load-balancing)
  │  /api/hello     │    Dockerfile dans ./api/
  │  /api/health    │
  └────────┬────────┘
           │  redis:6379  (nom DNS interne Swarm)
           ▼
  ┌─────────────────┐
  │     Redis       │  ← service "redis"  (1 réplique, sur le manager)
  │  (cache/état)   │    Image officielle redis:7-alpine
  │  NON exposé     │    Volume persistant : redis-data
  └─────────────────┘
```

### Pourquoi cette architecture ?

| Composant | Rôle | Exposé ? |
|-----------|------|----------|
| **Nginx** | Reverse proxy + sert le HTML | ✅ port 80 |
| **Node.js API** | Logique métier + appels Redis | ❌ interne seulement |
| **Redis** | Cache partagé entre replicas de l'API | ❌ interne seulement |

> **Règle de sécurité** : seul Nginx est exposé. L'API et Redis ne sont accessibles qu'en interne via le réseau overlay.

---

## 📁 Structure du projet

```
stackYml-test/
│
├── stack.yml              # ← FICHIER PRINCIPAL : déclare toute la stack
├── stack.secrets.yml      # ← Variante avec Docker Secrets (données sensibles)
├── Makefile               # Raccourcis pour les commandes Docker Swarm
│
├── frontend/              # Service Nginx (reverse proxy + front-end)
│   ├── Dockerfile         # Build de l'image Nginx
│   ├── nginx.conf         # Configuration reverse proxy
│   └── html/
│       └── index.html     # Page HTML du front-end
│
└── api/                   # Service Node.js
    ├── Dockerfile         # Build de l'image Node.js
    ├── package.json       # Dépendances (express, redis)
    ├── server.js          # Code de l'API (commenté)
    └── .dockerignore      # Fichiers exclus du build
```

---

## 🚀 Démarrage rapide

### Prérequis

- Docker Desktop (ou Docker Engine) installé et en cours d'exécution
- Docker Swarm activé (voir étape 1)

### Étape 1 — Initialiser Docker Swarm

```bash
docker swarm init
```

> **Qu'est-ce que ça fait ?**
> Cette commande transforme votre machine en **nœud manager** d'un Swarm.
> Un Swarm est un cluster de machines Docker. Même avec un seul nœud (votre PC),
> toutes les fonctionnalités Swarm sont disponibles.

### Étape 2 — Construire les images Docker

```bash
docker build -t demo-frontend ./frontend
docker build -t demo-api ./api
```

> En production, on utiliserait un **registry** (Docker Hub, GitLab Registry…)
> pour stocker et distribuer les images sur tous les nœuds du Swarm.
>cmd pour creer un registry local:
                 docker service create \
                  --name registry \
                  --publish published=5000,target=5000 \
                  --mount type=volume,source=registry-data,destination=/var/lib/registry \
                  registry:2
>depuis le manager :
docker tag s3-api:v1 127.0.0.1:5000/s3-api:v1
docker push 127.0.0.1:5000/s3-api:v1

docker tag s3-frontend:v1 127.0.0.1:5000/s3-frontend:v1
docker push 127.0.0.1:5000/s3-frontend:v1

>Comment cette image cera acessible par tout les members de mon swarm?




### Étape 3 — Déployer la stack

```bash
docker stack deploy -c stack.yml demo
```

- `stack.yml` → le fichier décrivant les services
- `demo` → le **nom de la stack** (préfixe de tous les services)

### Étape 4 — Vérifier le déploiement

```bash
# Lister les services et leur état
docker stack services demo

# Voir les conteneurs (tâches) en cours
docker stack ps demo
```

Attendez que tous les services soient en état `Running`.

### Étape 5 — Tester l'application

Ouvrez votre navigateur sur **http://localhost**

Ou testez l'API directement :

```bash
# Endpoint principal — change de hostname à chaque appel (load-balancing !)
curl http://localhost/api/hello

# Endpoint de santé — vérifie la connexion Redis
curl http://localhost/api/health
```

---

## 🔍 Concepts Docker Swarm expliqués

### 1. Qu'est-ce qu'une Stack ?

Une **stack** est un groupe de services déployés ensemble à partir d'un fichier `stack.yml`.
C'est l'équivalent d'un `docker-compose.yml`, mais pour la **production sur Swarm**.

```bash
# Déployer
docker stack deploy -c stack.yml <nom>

# Lister les stacks actives
docker stack ls

# Supprimer une stack
docker stack rm <nom>
```

### 2. Services et Répliques

Un **service** est une définition de comment faire tourner un conteneur.
Une **réplique** est une instance (copie) de ce conteneur.

```yaml
# Dans stack.yml :
deploy:
  replicas: 3   # ← 3 conteneurs identiques tournent en parallèle
```

> Avec `replicas: 3` sur l'API, Swarm crée 3 conteneurs et répartit
> le trafic entre eux automatiquement (**load-balancing intégré**).
> Appelez `/api/hello` plusieurs fois → le champ `conteneur` change !

### 3. Réseau Overlay

```yaml
networks:
  app-net:
    driver: overlay      # ← réseau qui s'étend sur tous les nœuds
    driver_opts:
      encrypted: "true"  # ← trafic chiffré entre nœuds
```

- **bridge** : réseau local à un seul hôte (docker-compose classique)
- **overlay** : réseau qui couvre tous les nœuds du cluster Swarm

Les services se trouvent par leur **nom de service** (DNS interne Swarm) :
- `frontend` appelle `api:3000` ✅ (pas besoin d'adresse IP)
- `api` appelle `redis:6379` ✅

### 4. Rolling Update (mise à jour sans downtime)

```yaml
update_config:
  parallelism: 1      # mettre à jour 1 réplique à la fois
  delay: 10s          # attendre 10s entre chaque
  failure_action: rollback  # annuler si ça plante
```

Pour mettre à jour le service API :
```bash
# Rebuilder l'image avec les nouvelles modifs
docker build -t demo-api ./api

# Forcer la mise à jour (rolling update)
docker service update --image demo-api demo_api
```

Swarm remplace les conteneurs **un par un** → zéro interruption de service.

### 5. Health Check

```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

- Swarm vérifie la santé de chaque réplique toutes les 30s
- Si un conteneur répond 3 fois mal → il est redémarré automatiquement
- C'est l'**auto-guérison** (self-healing) de Docker Swarm

### 6. Volumes persistants

```yaml
volumes:
  redis-data:
    driver: local

# Dans le service :
volumes:
  - redis-data:/data
```

Les données Redis survivent aux redémarrages de conteneurs.
En production multi-nœuds → utiliser un stockage distribué (NFS, GlusterFS…)

---

## 🔐 Utilisation des Docker Secrets

Les **secrets** permettent de ne jamais écrire de données sensibles en clair dans les fichiers de configuration.

### Pourquoi ne pas utiliser les variables d'environnement pour les secrets ?

```bash
# ❌ Les vars d'env sont visibles dans "docker inspect" et les logs !
docker inspect demo_api  # → révèle les variables en clair
```

### Comment fonctionnent les secrets Docker ?

1. Le secret est chiffré dans le **Raft log** du Swarm (base de données interne)
2. Il est transmis de façon sécurisée aux nœuds qui en ont besoin
3. Il est monté en **mémoire** (tmpfs) dans `/run/secrets/<nom>`
4. Il disparaît du conteneur quand le service est supprimé

### Mise en pratique

**Étape 1** — Créer le secret dans le Swarm :

```bash
# Depuis une valeur texte
echo "ma_cle_api_super_secrete_1234" | docker secret create api_key -

# Depuis un fichier (ex: certificat SSL)
docker secret create mon_cert ./certificat.pem
```

**Étape 2** — Vérifier que le secret existe :

```bash
docker secret ls
# ID                          NAME      CREATED
# xyz123...                   api_key   2 seconds ago
```

**Étape 3** — Déployer avec les deux fichiers :

```bash
docker stack deploy \
  -c stack.yml \
  -c stack.secrets.yml \
  demo
```

> Docker **fusionne** les deux fichiers. `stack.secrets.yml` ajoute les secrets
> au service `api` sans dupliquer toute la configuration.

**Étape 4** — Dans le conteneur, lire le secret :

```javascript
// server.js — lecture du secret monté comme fichier
const fs = require('fs');
const apiKey = fs.readFileSync('/run/secrets/api_key', 'utf8').trim();
```

**Vérifier dans le conteneur :**
```bash
# Entrer dans un conteneur de l'API
docker exec -it $(docker ps -q -f name=demo_api) sh

# Le secret est là !
cat /run/secrets/api_key
```

---

## 🎯 Commandes utiles — Référence rapide

```bash
# ── STACK ──────────────────────────────────────────────────────
docker stack deploy -c stack.yml demo        # Déployer
docker stack ls                               # Lister les stacks
docker stack services demo                    # Lister les services
docker stack ps demo                          # Lister les tâches
docker stack rm demo                          # Supprimer la stack

# ── SERVICES ───────────────────────────────────────────────────
docker service ls                             # Tous les services
docker service ps demo_api                    # Tâches du service api
docker service logs -f demo_api               # Logs en temps réel
docker service scale demo_api=3               # Scaler à 3 répliques
docker service update --image demo-api demo_api  # Mettre à jour l'image

# ── SECRETS ────────────────────────────────────────────────────
docker secret ls                              # Lister les secrets
docker secret create api_key -                # Créer depuis stdin
docker secret rm api_key                      # Supprimer un secret
docker secret inspect api_key                 # Détails (pas la valeur !)

# ── SWARM ──────────────────────────────────────────────────────
docker swarm init                             # Initialiser le Swarm
docker swarm leave --force                    # Quitter (manager)
docker node ls                                # Lister les nœuds

# ── Docker commands utilise dans le projet ───────────────────
docker service create \
                  --name registry \
                  --publish published=5000,target=5000 \
                  --mount type=volume,source=registry-data,destination=/var/lib/registry \
                  registry:2

docker build -t 127.0.0.1:5000/s3-api:v1 ./api
docker build -t 127.0.0.1:5000/s3-frontend:v1 ./frontend
docker push 127.0.0.1:5000/s3-api:v1
docker push 127.0.0.1:5000/s3-frontend:v1

# ── AVEC LE MAKEFILE ───────────────────────────────────────────
make build          # Construire les images
make deploy         # Déployer la stack
make ps             # Voir les tâches
make logs-api       # Logs de l'API
make scale-api n=3  # Scaler l'API à 3 répliques
make down           # Supprimer la stack

# ── linux commands utiliser────────────────────────────────────────

# autoriser un port sur ubuntu 
 sudo ufw allow 80/tcp 








---

## 🧪 Exercices pratiques

### Exercice 1 — Observer le load-balancing

```bash
# Appeler /api/hello 5 fois rapidement
for i in 1 2 3 4 5; do curl -s http://localhost/api/hello | grep conteneur; done
```

Vous verrez le hostname alterner entre les 2 répliques de l'API → **load-balancing Swarm en action**.

### Exercice 2 — Scaler l'API

```bash
# Passer à 3 répliques
docker service scale demo_api=3

# Vérifier
docker stack ps demo

# Observer le load-balancing avec 3 conteneurs
for i in 1 2 3 4 5 6; do curl -s http://localhost/api/hello | grep conteneur; done
```

### Exercice 3 — Simuler un crash

```bash
# Trouver l'ID d'un conteneur de l'API
docker ps | grep demo_api

# Tuer un conteneur
docker rm -f <ID_CONTENEUR>

# Observer Swarm le redémarrer automatiquement
docker stack ps demo
```

### Exercice 4 — Déployer avec un secret

```bash
# 1. Créer le secret
echo "SECRET_ULTRA_CONFIDENTIEL" | docker secret create api_key -

# 2. Redéployer avec le fichier secrets
docker stack deploy -c stack.yml -c stack.secrets.yml demo

# 3. Appeler /api/hello — "secret_present" devrait être true
curl http://localhost/api/hello
```

### Exercice 5 — Mise à jour sans downtime

```bash
# Pendant la mise à jour, continuez à appeler l'API dans un autre terminal
watch -n 0.5 curl -s http://localhost/api/hello

# Dans ce terminal, déclencher la mise à jour
docker service update --image demo-api demo_api

# Vous verrez les requêtes continuer sans interruption !
```

---

## 📚 Pour aller plus loin

| Sujet | Ressource |
|-------|-----------|
| Documentation Swarm | [docs.docker.com/engine/swarm](https://docs.docker.com/engine/swarm/) |
| Référence stack.yml | [docs.docker.com/compose/compose-file](https://docs.docker.com/compose/compose-file/) |
| Docker Secrets | [docs.docker.com/engine/swarm/secrets](https://docs.docker.com/engine/swarm/secrets/) |
| Réseau overlay | [docs.docker.com/network/overlay](https://docs.docker.com/network/overlay/) |

---

## ⚠️ Notes importantes pour la production

1. **Registry** : en prod, les images doivent être dans un registry accessible par tous les nœuds
2. **Stockage Redis** : utiliser un volume distribué pour les clusters multi-nœuds
3. **Secrets** : ne jamais committer de fichiers de secrets dans git
4. **TLS** : activer TLS sur le Swarm pour sécuriser les communications entre nœuds
5. **Monitoring** : ajouter Prometheus + Grafana pour observer les métriques

---

*Projet éducatif · Pas pour la production telle quelle*
