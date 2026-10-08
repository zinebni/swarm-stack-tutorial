// ═══════════════════════════════════════════════════════════════
//  server.js  —  API Node.js de démonstration pour le tutoriel
//  Docker Swarm / stack.yml
// ═══════════════════════════════════════════════════════════════
//
//  Ce fichier est VOLONTAIREMENT simple et commenté pour
//  permettre de comprendre comment une API tourne dans un
//  service Docker Swarm, comment elle communique avec Redis
//  via le nom DNS interne du service, et comment lire un
//  secret Docker monté en fichier.
//
// ───────────────────────────────────────────────────────────────

const express = require('express');
const redis   = require('redis');
const fs      = require('fs');
const os      = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 1. Lecture des variables d'environnement ──────────────────
//
// Dans stack.yml on passe APP_ENV via la section "environment:".
// Si la variable n'est pas définie, on utilise "development"
// comme valeur par défaut.
const APP_ENV = process.env.APP_ENV || 'development';

// ── 2. Lecture d'un secret Docker (optionnel) ─────────────────
//
// Quand un secret est déclaré dans stack.secrets.yml,
// Docker Swarm le monte automatiquement dans le conteneur
// sous /run/secrets/<nom_du_secret>.
// On utilise fs.readFileSync pour lire son contenu.
// Si le fichier n'existe pas (en dev local), on retourne null.
function lireSecret(nom) {
  const chemin = `/run/secrets/${nom}`;
  try {
    // trim() enlève les sauts de ligne éventuels en fin de fichier
    return fs.readFileSync(chemin, 'utf8').trim();
  } catch (_) {
    // Le secret n'est pas disponible (ex: dev local sans Docker)
    return null;
  }
}

const apiKey = lireSecret('api_key'); // valeur du secret "api_key"

// ── 3. Connexion à Redis ───────────────────────────────────────
//
// Dans Docker Swarm, les services se trouvent mutuellement
// grâce au nom de service défini dans stack.yml.
// Ici le service Redis s'appelle "redis" → c'est son nom DNS.
//
// La variable d'environnement REDIS_HOST permet de surcharger
// ce comportement (utile pour les tests locaux).
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

const redisClient = redis.createClient({
  socket: {
    host: REDIS_HOST,
    port: parseInt(REDIS_PORT),
    // Réessaie la connexion toutes les 2 secondes si Redis
    // n'est pas encore prêt (pratique au démarrage de la stack)
    reconnectStrategy: (tentatives) => Math.min(tentatives * 200, 2000)
  }
});

// Connexion asynchrone — on ne bloque pas le démarrage
redisClient.connect().catch((err) => {
  console.warn('[Redis] Impossible de se connecter :', err.message);
});

// ── 4. Middleware ─────────────────────────────────────────────
// Permet à Express de lire les corps de requête JSON
app.use(express.json());

// ── 5. Route /api/hello ───────────────────────────────────────
//
// Route principale de démonstration.
// Chaque fois qu'elle est appelée :
//   - Elle incrémente un compteur dans Redis
//   - Elle retourne des informations sur le conteneur courant
//
// En Swarm avec replica:2, vous verrez le hostname changer
// à chaque requête → preuve que le load-balancing fonctionne !
app.get('/api/hello', async (req, res) => {
  let compteur = 0;

  // Incrémenter le compteur dans Redis
  // "INCR" crée la clé si elle n'existe pas, puis l'incrémente
  try {
    compteur = await redisClient.incr('demo:compteur_requetes');
  } catch (err) {
    console.warn('[Redis] Erreur INCR :', err.message);
    // On continue même si Redis est indisponible
  }

  res.json({
    message : '👋 Bonjour depuis l\'API Node.js !',

    // hostname = nom du conteneur dans Docker Swarm
    // Utile pour visualiser le load-balancing entre replicas
    conteneur : os.hostname(),

    environnement : APP_ENV,

    // Le compteur montre que Redis est partagé entre les replicas
    requetes_total : compteur,

    secret_present : apiKey !== null,  // true si le secret existe

    heure : new Date().toISOString()
  });
});

// ── 6. Route /api/health ──────────────────────────────────────
//
// Endpoint de santé — utilisé par Docker Swarm pour vérifier
// que le service fonctionne (via HEALTHCHECK dans le Dockerfile
// ou la section healthcheck: dans stack.yml).
app.get('/api/health', async (req, res) => {
  let redisStatut = 'NON CONNECTÉ';

  // On envoie un "PING" à Redis — il doit répondre "PONG"
  try {
    const pong = await redisClient.ping();
    redisStatut = pong === 'PONG' ? 'OK' : pong;
  } catch (err) {
    redisStatut = 'ERREUR : ' + err.message;
  }

  res.json({
    service : 'api-demo',
    statut  : 'OK',
    redis   : redisStatut,
    conteneur : os.hostname(),
    heure   : new Date().toISOString()
  });
});

// ── 7. Démarrage du serveur ───────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ API démarrée sur le port ${PORT}`);
  console.log(`   Environnement : ${APP_ENV}`);
  console.log(`   Redis cible   : ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`   Secret api_key: ${apiKey ? '*** (présent)' : 'absent'}`);
});
