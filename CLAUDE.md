# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**IT Project Tracker** — A self-hosted, Docker-containerized Kanban web app for a small IT team (< 10 people) split into two poles: Dev and Network. The project is currently in the **specification phase** — see `Gestion de Projet/PROJECT.md` for the full technical blueprint and `Gestion de Projet/CAHIER_DES_CHARGES.md` for business requirements.

## Planned Architecture

**Monorepo with two independent npm packages:**

- `client/` — React 18 + Vite + TailwindCSS + @dnd-kit (drag & drop) + Zustand (state) + Axios + React Router v6
- `server/` — Node.js 20 + Express 4 + better-sqlite3 (Option A) or PostgreSQL/pg (Option B) + JWT + bcryptjs + zod

**Default target: Option A (SQLite, single Docker image).** Option B (PostgreSQL + Docker Compose) is documented for future migration.

## Development Commands

```bash
# Backend (from server/)
npm install
npm run db:init      # Initialize database schema
npm run db:seed      # Seed demo data (admin/changeme + lead_dev, lead_reseau, alice, bob / password)
npm run dev          # Start Express on port 3000 (uses node --experimental-sqlite)

# Frontend (from client/)
npm install
npm run dev          # Start Vite dev server on port 5173 (proxies /api to port 3000)
npm run build        # Production build → dist/
```

## Docker (production)

```bash
# Copier et configurer le .env
cp docker/.env.example docker/.env
# Éditer docker/.env : définir JWT_SECRET obligatoirement

# Option A — SQLite, mono-conteneur (recommandé)
docker compose -f docker/docker-compose.yml up -d

# Option B — PostgreSQL, deux conteneurs
docker compose -f docker/docker-compose.pg.yml up -d

# Logs
docker compose -f docker/docker-compose.yml logs -f
```

L'image est construite en multi-stage : Stage 1 build le frontend React (`client/`), Stage 2 copie le backend + le `dist/` vers `server/public/` et le sert via Express en production. La DB SQLite est initialisée automatiquement au premier démarrage via `docker/entrypoint.sh`.

## Key Design Decisions

**RBAC:** Three roles — `admin`, `lead` (pole manager), `member`. Only admin and leads can create/edit/delete projects or drag-drop between columns. All users can view and comment.

**Pole scoping:** Each project belongs to either `dev` or `network`. Leads can only manage projects in their own pole. Admin sees and manages all.

**Drag & drop moves** use `PATCH /api/projects/:id/move` which updates both `status` and `position` (ordering within column) atomically.

**JWT stored client-side** — backend validates via `middleware/auth.js` on all protected routes.

## API Structure

All routes are under `/api/`. Key ones:
- `POST /api/auth/login` → returns JWT
- `GET /api/auth/me` → current user profile
- `GET /api/projects?pole=dev&status=in_progress` → filtered list
- `PATCH /api/projects/:id/move` → D&D status+position update
- `GET/POST /api/projects/:id/comments`

## Database Schema (SQLite / PostgreSQL)

Core tables: `users`, `projects`, `project_members`, `tags`, `project_tags`, `comments`, `activity_log`.

Project status values: `backlog` | `in_progress` | `on_hold` | `done`
Priority values: `critical` | `high` | `normal` | `low`
Role values: `admin` | `lead` | `member`
Pole values: `dev` | `network`

## Naming Conventions

- React components: PascalCase (`ProjectCard.jsx`)
- Hooks: `use` prefix camelCase (`useProjects.js`)
- Services (axios wrappers): camelCase (`projectService.js`)
- Express routes: kebab-case paths (`/api/projects/:id/move`)
- Env vars: SCREAMING_SNAKE_CASE

## Journal des modifications — Règle obligatoire

**Toute modification de code apportée au projet DOIT être consignée dans `MODIFICATIONS.md`** immédiatement après avoir été effectuée.

### Format d'entrée à respecter

Chaque modification est ajoutée dans le lot de session en cours (`## Lot N — Retours utilisateurs (session N)`) avec :

```markdown
### N. Composant/Fonctionnalité — titre court

**Avant :** description de l'état précédent

**Après :** description de ce qui a changé

**Comportement :** (optionnel) détails techniques ou logique ajoutée

**Fichiers créés :** (si applicable)
- `chemin/fichier.ext` — rôle du fichier

**Fichiers modifiés :**
- `chemin/fichier.ext` — ce qui a changé
```

Mettre également à jour le **tableau récapitulatif** en fin de fichier si un fichier non encore listé est touché.

---

## Commit Style (Conventional Commits)

```
feat: add drag & drop between columns
fix: fix position persistence after page reload
docs: update Docker installation guide
chore: upgrade dependencies
refactor: extract auth middleware
test: add unit tests for project service
```

## Environment Configuration

Copy `server/.env.example` to `server/.env`. Key vars:
- `JWT_SECRET` — must be changed in production
- `DB_PATH` — SQLite file path (Option A), defaults to `./data/tracker.db`
- `DATABASE_URL` — PostgreSQL connection string (Option B)
- `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_EMAIL` — initial admin account
