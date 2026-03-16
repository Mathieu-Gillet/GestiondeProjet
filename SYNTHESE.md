# Synthèse du projet — IT Project Tracker

## Contexte

Outil interne de suivi de projets IT destiné à deux pôles (Développement, Réseau), avec gestion des rôles, visualisation Kanban et calendrier Gantt.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Backend | Node.js 24, Express 4, SQLite (node:sqlite natif) |
| Frontend | React 18, Vite, TailwindCSS, Zustand, @dnd-kit |
| Déploiement | Docker (multi-stage build, node:22-alpine) |

---

## Fonctionnalités réalisées

**Gestion des projets**
- Kanban drag & drop (colonnes : Idées / En cours / En attente / Terminé)
- Fiches projet avec titre, description, pôle, priorité, dates, tags, membres, responsable
- Commentaires et journal d'activité par projet

**Calendrier Gantt**
- Vue annuelle par projet (fil + bulles début/fin)
- Déplacement des bulles pour ajuster les dates (pointer events natifs)
- Swap automatique si croisement des bulles
- Zone "sans date" droppable pour retirer les dates d'un projet

**Droits & accès (RBAC)**
- **Admin** : accès complet, gestion des comptes
- **Lead** : création/modification dans son pôle uniquement
- **Membre** : lecture seule, limité à son pôle

**Administration**
- Création, modification et suppression de comptes utilisateurs
- Filtrage par pôle côté serveur (membres ne voient pas l'autre pôle)

---

## Architecture clé

- API REST Express avec validation Zod et JWT
- Store Zustand avec mises à jour optimistes côté client
- SQLite embarqué (pas de service externe requis)
- Conteneur unique : build React servi en statique par Express

---

## Pistes d'évolution

- **Authentification SSO / LDAP / Active Directory** — intégration avec l'annuaire d'entreprise (Passport.js + stratégie LDAP ou SAML)
- **Notifications** — alertes par email ou webhook (projets en retard, commentaires)
- **Tableau de bord / KPIs** — taux d'avancement par pôle, charge par responsable
- **Export** — PDF, CSV ou export Gantt pour reporting direction
- **API Webhooks** — intégration avec GitLab/GitHub pour synchroniser l'état des projets
- **Multi-équipes** — ajout d'un niveau organisation au-dessus des pôles
- **Pièces jointes** — upload de fichiers liés aux projets (maquettes, cahiers des charges)
- **Mode hors-ligne** — PWA avec synchronisation différée
