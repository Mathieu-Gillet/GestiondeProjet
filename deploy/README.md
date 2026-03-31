# Déploiement LXC Proxmox

Guide d'installation de l'IT Project Tracker dans un conteneur LXC Proxmox.

---

## Prérequis Proxmox

Créer un conteneur LXC avec les paramètres suivants dans l'interface Proxmox :

| Paramètre | Valeur recommandée |
|-----------|-------------------|
| Template  | ubuntu-22.04-standard |
| vCPU      | 2 |
| RAM       | 1 Go (512 Mo minimum) |
| Disque    | 8 Go minimum |
| Réseau    | IP fixe recommandée |
| SSH       | Activé |

> **Note :** Télécharger le template Ubuntu depuis Proxmox → Storage → CT Templates → Download depuis le dépôt officiel.

---

## Installation

### 1. Connexion au conteneur

```bash
ssh root@<IP-du-conteneur>
```

### 2. Cloner le dépôt

```bash
apt-get install -y git
git clone https://github.com/Matoudoux/GestiondeProjet.git /opt/tracker
```

### 3. Lancer le script d'installation

```bash
cd /opt/tracker
chmod +x deploy/setup.sh
./deploy/setup.sh
```

Le script installe et configure automatiquement :
- Node.js 20
- PM2 (process manager, démarrage automatique au boot)
- nginx (reverse proxy HTTP→HTTPS)
- Certificat SSL auto-signé (valide 10 ans)
- L'application dans `/opt/tracker`
- La base de données SQLite dans `/opt/tracker/server/data/`

### 4. Vérifier l'installation

```bash
pm2 status            # L'application doit être "online"
systemctl status nginx # nginx doit être "active"
```

---

## Accès à l'application

Ouvrir **`https://<IP-du-conteneur>`** dans le navigateur.

Le navigateur affiche un avertissement de sécurité dû au certificat auto-signé :
- **Chrome / Edge** : Avancé → Continuer vers le site (non sécurisé)
- **Firefox** : Avancé → Accepter le risque et continuer

> Pour supprimer cet avertissement sur le réseau interne, importer `/etc/ssl/certs/tracker.crt`
> dans la PKI de l'entreprise ou dans les certificats approuvés du navigateur.

---

## Configuration

Le fichier d'environnement est généré automatiquement lors du premier lancement :

```bash
nano /opt/tracker/server/.env
pm2 restart tracker
```

Variables importantes :

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Secret JWT (généré automatiquement) |
| `NODE_ENV` | `production` |
| `PORT` | `3000` (interne, nginx proxy vers ce port) |
| `DB_PATH` | Chemin SQLite (défaut : `./data/tracker.db`) |

---

## Mise à jour

```bash
cd /opt/tracker
git pull
sudo ./deploy/update.sh
```

---

## Commandes utiles

```bash
# Application
pm2 status                    # État du processus
pm2 logs tracker              # Logs en temps réel
pm2 logs tracker --lines 100  # 100 dernières lignes
pm2 restart tracker           # Redémarrer l'app
pm2 stop tracker              # Arrêter l'app

# nginx
systemctl status nginx        # État nginx
systemctl reload nginx        # Recharger la config sans coupure
nginx -t                      # Tester la configuration

# Base de données
ls -lh /opt/tracker/server/data/   # Fichier SQLite
```

---

## Sauvegarde

La base de données SQLite est dans `/opt/tracker/server/data/tracker.db`.

Sauvegarde simple :

```bash
cp /opt/tracker/server/data/tracker.db /backup/tracker-$(date +%Y%m%d).db
```

Depuis Proxmox, un snapshot du conteneur LXC sauvegarde l'ensemble (app + données).

---

## Architecture

```
Internet / LAN
      │
      ▼ :80 (HTTP)
   nginx ──────────── redirect 301 ──▶ https://$host$request_uri
      │
      ▼ :443 (HTTPS, certificat auto-signé)
   nginx ──────────── proxy_pass ──▶ Node.js :3000
                      (SSE : /api/sse, timeout 24h, no buffering)
      │
      ▼
  Express (PM2)
      │
      ▼
  SQLite (tracker.db)
```
