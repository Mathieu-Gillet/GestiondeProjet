# IT Project Tracker

> Application web de suivi de projets pour équipe IT — auto-hébergée, conteneurisée Docker.

---

## Vue d'ensemble

**IT Project Tracker** est une application Kanban légère, pensée pour une petite équipe IT bi-polaire (Dev + Réseau), permettant de créer, prioriser et faire évoluer des projets par glisser-déposer depuis n'importe quel navigateur.

---

## Sommaire

- [Structure du projet](#structure-du-projet)
- [Stack technique](#stack-technique)
- [Modèle de données](#modèle-de-données)
- [Rôles et permissions](#rôles-et-permissions)
- [Routes API](#routes-api)
- [Variables d'environnement](#variables-denvironnement)
- [Démarrage rapide](#démarrage-rapide)
- [Docker](#docker)
- [Conventions de code](#conventions-de-code)
- [Roadmap](#roadmap)

---

## Structure du projet

```
it-project-tracker/
│
├── client/                     # Frontend React
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/          # Vue Kanban principale
│   │   │   │   ├── Board.jsx
│   │   │   │   ├── Column.jsx
│   │   │   │   └── ProjectCard.jsx
│   │   │   ├── Project/        # Fiche projet détaillée
│   │   │   │   ├── ProjectModal.jsx
│   │   │   │   └── ProjectForm.jsx
│   │   │   ├── Layout/         # Shell, Sidebar, Header
│   │   │   │   ├── AppShell.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── TopBar.jsx
│   │   │   └── Auth/           # Login
│   │   │       └── LoginPage.jsx
│   │   ├── hooks/              # Custom hooks (useDrag, useProjects, useAuth)
│   │   ├── services/           # Appels API (axios)
│   │   ├── store/              # État global (Zustand ou Context)
│   │   ├── utils/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                     # Backend Node.js / Express
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── projects.js
│   │   │   ├── users.js
│   │   │   └── tags.js
│   │   ├── controllers/
│   │   ├── models/             # Modèles (Sequelize ou requêtes brutes)
│   │   ├── middleware/
│   │   │   ├── auth.js         # Vérification JWT
│   │   │   └── roles.js        # Contrôle des rôles
│   │   ├── db/
│   │   │   ├── init.js         # Initialisation schéma
│   │   │   └── seed.js         # Données de démo
│   │   └── app.js
│   ├── package.json
│   └── .env.example
│
├── docker/
│   ├── Dockerfile              # Multi-stage build
│   └── docker-compose.yml
│
├── docs/
│   ├── CAHIER_DES_CHARGES.md
│   └── USER_GUIDE.md
│
├── .gitignore
├── README.md
└── PROJECT.md                  # Ce fichier
```

---

## Stack technique

### Frontend

| Outil | Rôle |
|---|---|
| React 18 | Framework UI |
| Vite | Bundler / Dev server |
| TailwindCSS | Styling utilitaire |
| @dnd-kit/core | Drag & Drop accessible |
| Zustand | État global léger |
| Axios | Appels HTTP |
| React Router v6 | Navigation |
| date-fns | Formatage des dates |

### Backend

| Outil | Rôle |
|---|---|
| Node.js 20 LTS | Runtime |
| Express 4 | Serveur HTTP |
| better-sqlite3 | Base de données (Option A) |
| — ou pg — | PostgreSQL (Option B) |
| bcryptjs | Hashage des mots de passe |
| jsonwebtoken | Authentification JWT |
| zod | Validation des entrées |

### Infra

| Outil | Rôle |
|---|---|
| Docker | Conteneurisation |
| Docker Compose | Orchestration locale |
| Nginx (optionnel) | Reverse proxy / HTTPS |

---

## Modèle de données

### Table `users`

```sql
CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  username    TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,           -- bcrypt hash
  role        TEXT NOT NULL DEFAULT 'member',  -- 'admin' | 'lead' | 'member'
  pole        TEXT,                    -- 'dev' | 'network' | NULL (admin)
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table `projects`

```sql
CREATE TABLE projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  description  TEXT,
  pole         TEXT NOT NULL,          -- 'dev' | 'network'
  owner_id     INTEGER REFERENCES users(id),
  status       TEXT NOT NULL DEFAULT 'backlog',
                                       -- 'backlog' | 'in_progress' | 'on_hold' | 'done'
  priority     TEXT NOT NULL DEFAULT 'normal',
                                       -- 'critical' | 'high' | 'normal' | 'low'
  position     INTEGER NOT NULL DEFAULT 0,  -- Ordre dans la colonne
  due_date     DATE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table `project_members`

```sql
CREATE TABLE project_members (
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);
```

### Table `tags`

```sql
CREATE TABLE tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6B7280'
);

CREATE TABLE project_tags (
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  tag_id      INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);
```

### Table `comments`

```sql
CREATE TABLE comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  author_id   INTEGER REFERENCES users(id),
  content     TEXT NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Table `activity_log`

```sql
CREATE TABLE activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT NOT NULL,  -- 'created' | 'status_changed' | 'priority_changed' | etc.
  detail      TEXT,           -- JSON { from, to }
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Rôles et permissions

| Action | Admin | Responsable (lead) | Membre |
|---|:---:|:---:|:---:|
| Voir tous les projets | ✅ | ✅ | ✅ |
| Créer un projet | ✅ | ✅ (son pôle) | ❌ |
| Modifier un projet | ✅ | ✅ (son pôle) | ❌ |
| Supprimer un projet | ✅ | ✅ (son pôle) | ❌ |
| Drag & Drop (statut) | ✅ | ✅ (son pôle) | ❌ |
| Ajouter un commentaire | ✅ | ✅ | ✅ |
| Gérer les utilisateurs | ✅ | ❌ | ❌ |
| Voir le tableau de bord | ✅ | ✅ | ✅ |

---

## Routes API

### Authentification

```
POST   /api/auth/login          Connexion → JWT
POST   /api/auth/logout         Déconnexion
GET    /api/auth/me             Profil utilisateur courant
```

### Projets

```
GET    /api/projects            Liste (filtres: pole, status, priority)
POST   /api/projects            Créer un projet
GET    /api/projects/:id        Détail d'un projet
PUT    /api/projects/:id        Modifier un projet
DELETE /api/projects/:id        Supprimer un projet
PATCH  /api/projects/:id/move   Déplacer (statut + position via D&D)
```

### Commentaires

```
GET    /api/projects/:id/comments     Liste des commentaires
POST   /api/projects/:id/comments     Ajouter un commentaire
DELETE /api/comments/:id              Supprimer un commentaire
```

### Utilisateurs (admin)

```
GET    /api/users               Liste des utilisateurs
POST   /api/users               Créer un utilisateur
PUT    /api/users/:id           Modifier un utilisateur
DELETE /api/users/:id           Supprimer un utilisateur
```

### Tags

```
GET    /api/tags                Liste des tags
POST   /api/tags                Créer un tag
DELETE /api/tags/:id            Supprimer un tag
```

---

## Variables d'environnement

Fichier `.env` à la racine du serveur (copier depuis `.env.example`) :

```env
# Serveur
NODE_ENV=production
PORT=3000

# Base de données (Option A - SQLite)
DB_PATH=./data/tracker.db

# Base de données (Option B - PostgreSQL)
# DATABASE_URL=postgresql://user:password@db:5432/tracker

# Authentification
JWT_SECRET=change_me_in_production
JWT_EXPIRES_IN=7d

# Admin initial
SEED_ADMIN_USER=admin
SEED_ADMIN_PASSWORD=changeme
SEED_ADMIN_EMAIL=admin@example.com
```

---

## Démarrage rapide

### Développement local

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-org/it-project-tracker.git
cd it-project-tracker

# 2. Installer les dépendances
cd server && npm install
cd ../client && npm install

# 3. Configurer l'environnement
cp server/.env.example server/.env
# Éditer server/.env selon vos besoins

# 4. Initialiser la base de données
cd server && npm run db:init && npm run db:seed

# 5. Lancer le backend
npm run dev   # Port 3000

# 6. Lancer le frontend (autre terminal)
cd ../client
npm run dev   # Port 5173 (proxy vers 3000)
```

---

## Docker

### Construction de l'image

```bash
docker build -t it-project-tracker:latest -f docker/Dockerfile .
```

### Lancement simple (Option A — SQLite)

```bash
docker run -d \
  --name it-tracker \
  -p 3000:3000 \
  -v it-tracker-data:/app/data \
  -e JWT_SECRET=mon_secret_securise \
  it-project-tracker:latest
```

Accès : http://localhost:3000

### Lancement avec Docker Compose (Option B — PostgreSQL)

```bash
# Copier et configurer
cp docker/.env.example docker/.env

# Démarrer
docker compose -f docker/docker-compose.yml up -d

# Consulter les logs
docker compose logs -f
```

### Exemple `docker-compose.yml`

```yaml
version: '3.9'

services:
  app:
    image: it-project-tracker:latest
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://tracker:tracker@db:5432/tracker
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: tracker
      POSTGRES_PASSWORD: tracker
      POSTGRES_DB: tracker
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "tracker"]
      interval: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

### Exemple `Dockerfile` (multi-stage)

```dockerfile
# ─── Stage 1: Build du frontend ───────────────────────────────────────────────
FROM node:20-alpine AS frontend-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ .
RUN npm run build

# ─── Stage 2: Application finale ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Dépendances backend
COPY server/package*.json ./
RUN npm ci --omit=dev

# Code backend
COPY server/ .

# Frontend compilé
COPY --from=frontend-build /app/client/dist ./public

# Volume pour SQLite
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "src/app.js"]
```

---

## Conventions de code

### Commits (Conventional Commits)

```
feat:     Nouvelle fonctionnalité
fix:      Correction de bug
chore:    Maintenance, dépendances
refactor: Refactoring sans changement de comportement
docs:     Documentation uniquement
style:    Formatage, pas de changement logique
test:     Ajout ou modification de tests
```

Exemples :
```
feat: ajouter le drag & drop entre colonnes
fix: corriger la persistance de la position après rechargement
docs: compléter le guide d'installation Docker
```

### Nommage

- **Composants React** : PascalCase — `ProjectCard.jsx`
- **Hooks** : camelCase avec préfixe `use` — `useProjects.js`
- **Services** : camelCase — `projectService.js`
- **Routes Express** : kebab-case — `/api/projects/:id/move`
- **Variables d'environnement** : SCREAMING_SNAKE_CASE

---

## Roadmap

### v1.0 — MVP

- [x] Authentification JWT
- [x] CRUD Projets
- [x] Vue Kanban (4 colonnes)
- [x] Drag & Drop entre colonnes
- [x] Filtres : pôle, statut
- [x] Déploiement Docker (Option A)

### v1.1 — Enrichissement

- [ ] Fiche projet détaillée avec commentaires
- [ ] Historique d'activité par projet
- [ ] Tags personnalisables
- [ ] Recherche full-text
- [ ] Badges d'alerte (projets en retard)

### v1.2 — Qualité & Ops

- [ ] Thème sombre
- [ ] Export JSON/CSV
- [ ] Migration vers PostgreSQL (Option B)
- [ ] Tests unitaires (Vitest + Supertest)
- [ ] CI/CD GitHub Actions

### v2.0 — Vision long terme

- [ ] Notifications par email (SMTP)
- [ ] Intégration LDAP/Active Directory
- [ ] Vue calendrier (Gantt léger)
- [ ] API webhooks pour intégration externe
- [ ] Application mobile (PWA)

---

*Maintenu par l'équipe IT. Toute contribution passe par une Pull Request reviewée par un responsable de pôle.*
