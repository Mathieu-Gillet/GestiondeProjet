# Journal des modifications — IT Project Tracker

> Date : 2026-03-13
> Version de départ : v1.0 (Kanban + Calendrier Gantt de base)

---

## Lot 1 — Retours utilisateurs (session 1)

### 1. Calendrier — barre Gantt unique

**Avant :** Deux bulles circulaires `●━━●` connectées par un fil, chacune déplaçable indépendamment.

**Après :** Une seule barre pleine style Gantt avec trois zones interactives :
- **Poignée gauche `▎`** — redimensionne la date de début (`start_date`)
- **Zone centrale** — déplace toute la barre (les deux dates bougent ensemble, durée conservée)
- **Poignée droite `▎`** — redimensionne la date de fin (`due_date`)

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — composant `ProjectRow` réécrit, nouveau type de drag `'move'`, état `dispStart`/`dispEnd`

---

### 2. Onglet Tâches dans la fiche projet

**Ajouté :** Gestion des tâches au niveau de chaque projet.

Chaque tâche possède :
- Un **titre**
- Une **durée en jours**
- Un **statut** : `todo` / `in_progress` / `done`

Comportement :
- Le total des durées de tâches est comparé à la durée du projet (start → due)
- Si dépassement : avertissement ⚠ avec le nombre de jours en excès
- Barre de progression (tâches terminées / total)
- Cochage/décochage en un clic (admin/lead uniquement)

**Fichiers créés :**
- `server/src/controllers/taskController.js` — CRUD tâches
- `client/src/services/taskService.js` — appels API tâches

**Fichiers modifiés :**
- `server/src/db/init.js` — nouvelle table `tasks`
- `server/src/db/migrate.js` — migration de la table `tasks`
- `server/src/routes/projects.js` — routes `GET/POST/PUT/DELETE /:id/tasks/:taskId`
- `client/src/components/Project/ProjectModal.jsx` — onglet Tâches ajouté

---

### 3. Granularité temporelle — Au plus tôt / Au plus tard

**Ajouté :** Deux nouvelles dates de contrainte sur chaque projet :
- **Au plus tôt** (`earliest_start`) — date à partir de laquelle le projet peut commencer
- **Au plus tard** (`latest_end`) — date limite absolue de fin

Affichage :
- Dans le **formulaire projet** : section dédiée "Contraintes temporelles"
- Dans le **calendrier** : bande semi-transparente en tirets derrière la barre principale
- Dans la **fiche projet** : ligne dans les méta-données

**Fichiers modifiés :**
- `server/src/db/init.js` — colonnes `earliest_start DATE`, `latest_end DATE` sur `projects`
- `server/src/db/migrate.js` — migrations correspondantes
- `server/src/controllers/projectController.js` — champs ajoutés au schéma Zod
- `client/src/components/Project/ProjectForm.jsx` — champs de saisie
- `client/src/components/Calendar/CalendarPage.jsx` — fonction `getConstraintBand()`, rendu de la bande

---

### 4. Drag & drop calendrier amélioré

**Avant :** Seules les bulles de début/fin étaient draggables.

**Après :**
- Les poignées gauche/droite redimensionnent les dates (comportement conservé)
- La **zone centrale** de la barre permet de déplacer le projet entier : les deux dates bougent du même delta, la durée est préservée
- Drop d'un chip "sans date" sur un mois : crée `start_date` au 1er du mois ET `due_date` au dernier jour (au lieu de seulement `due_date`)

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — `handleBarDrag`, `handlePointerMove` (cas `'move'`), `handlePointerUp` (cas `'move'`), `handleDragEnd`

---

### 5. Vue par années dans l'onglet Projets

**Ajouté :** Sélecteur d'année `← 2024 →` en haut du tableau Kanban.

| Année | Comportement |
|-------|-------------|
| Année courante | Kanban normal (4 colonnes) |
| Année passée | Vue archive — projets avec statut `done` ayant une date dans cette année |
| Année future | Vue planifiée — tous projets ayant une date dans cette année |

Le bouton "Année courante" ramène à l'année en cours. La navigation est libre (passé et futur sans limite).

**Fichiers modifiés :**
- `client/src/components/Board/Board.jsx` — état `boardYear`, vue conditionnelle archive/kanban

---

### 6. Collaboration temps réel (SSE) — maintien de SQLite

**Contexte :** Demande initiale de migrer vers JSON pour permettre le travail simultané.

**Décision technique :** SQLite conservé (WAL mode déjà actif = lectures concurrentes sans blocage, bien supérieur à un fichier JSON pour les écritures concurrentes). La collaboration temps réel est assurée par **Server-Sent Events (SSE)**.

**Fonctionnement :**
1. Chaque client ouvre une connexion SSE sur `GET /api/events?token=<jwt>`
2. Le serveur émet un événement à tous les clients connectés à chaque mutation de données
3. Les clients rechargent automatiquement les projets/tâches dès réception

**Événements émis :**
| Événement | Déclencheur |
|-----------|------------|
| `project_created` | Création d'un projet |
| `project_updated` | Modification ou déplacement |
| `project_deleted` | Suppression |
| `tasks_updated` | Ajout/modification/suppression d'une tâche |

**Fichiers créés :**
- `server/src/sse.js` — module `addClient`, `removeClient`, `broadcast`

**Fichiers modifiés :**
- `server/src/app.js` — route SSE `/api/events`
- `server/src/middleware/auth.js` — accepte le token en query param (`?token=`) pour EventSource
- `server/src/controllers/projectController.js` — appels `broadcast()` sur create/update/move/remove
- `server/src/controllers/taskController.js` — appels `broadcast('tasks_updated')` sur CRUD
- `client/src/store/projectStore.js` — actions `initSSE(token)` et `closeSSE()`
- `client/src/components/Layout/AppShell.jsx` — initialisation SSE au montage

---

## Lot 2 — Retours utilisateurs (session 2)

### 7. Fiche projet — layout double panneau

**Avant :** Petite modale centrée `max-w-2xl`.

**Après :** Grande fenêtre **90% de la largeur** (max 1200px) × **85% de la hauteur**, divisée en deux panneaux :

| Panneau gauche (flexible) | Panneau droit (320px fixe) |
|---------------------------|---------------------------|
| Description | En-tête : nombre de tâches + durée totale |
| Méta : dates, responsable, contraintes | Barre de progression |
| Membres, Tags | Liste des tâches (scroll) |
| Onglets : Commentaires / Activité | Formulaire ajout tâche (bas) |

Le panneau tâches est **toujours visible** — plus d'onglet dédié.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — refonte complète du layout

---

### 8. Formulaire de création — élargi avec tâches initiales

**Avant :** Modale étroite `max-w-lg` (512px), sans section tâches.

**Après :** Fenêtre **85% de la largeur** (max 960px), deux colonnes :

| Colonne gauche | Colonne droite |
|----------------|---------------|
| Tous les champs projet | Section "Tâches initiales" |
| | Liste des tâches à créer |
| | Formulaire ajout (titre + durée) |

Les tâches saisies à la création sont enregistrées automatiquement en base après la création du projet. Le bouton de validation indique dynamiquement : `Créer le projet + N tâche(s)`.

En mode **édition**, la colonne droite n'apparaît pas (les tâches sont gérées depuis la fiche projet).

**Fichiers modifiés :**
- `client/src/components/Project/ProjectForm.jsx` — layout 2 colonnes, état `formTasks`, création séquentielle

---

### 9. Navigation temporelle — années futures débloquées

**Avant :** Le bouton `→` dans le sélecteur d'année du Kanban était désactivé (`disabled`) au-delà de l'année courante.

**Après :** Navigation libre vers les années futures (2027, 2028…). La vue affiche les projets **planifiés** pour l'année sélectionnée.

**Fichiers modifiés :**
- `client/src/components/Board/Board.jsx` — suppression du `disabled`, adaptation du libellé et du filtre

---

## Lot 3 — Retours utilisateurs (session 3)

### 10. Calendrier — bouton "Tâches" agrandi et mis en valeur

**Avant :** Petit triangle gris (`w-3 h-3`, `text-gray-300`) visible uniquement au survol.

**Après :** Bouton pill avec texte "Tâches" / "Masquer", bordure colorée indigo, fond blanc/bleu selon l'état. Visible en permanence, état actif clairement distinct (fond indigo plein, texte blanc).

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — composant `ProjectRow`, remplacement du bouton SVG par un pill stylé

---

### 11. Calendrier — les tâches suivent le glissement du projet

**Avant :** Déplacer la barre d'un projet dans le Gantt ne modifiait que les dates du projet. Les tâches restaient à leurs dates d'origine.

**Après :** Quand le projet est glissé en mode `'move'` (zone centrale de la barre), toutes les tâches ayant des dates (`start_date` ou `due_date`) sont automatiquement décalées du même delta en mois.

**Comportement :**
- Calcul du `deltaMonths = dispStart - origStart` à la fin du drag
- Mise à jour de chaque tâche via `taskService.update()` en parallèle (`Promise.all`)
- Cache local `tasksCache` mis à jour pour refléter immédiatement le changement dans le Gantt

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — `handlePointerUp` (cas `'move'`), ajout de `tasksCache` aux dépendances du `useCallback`

---

### 12. Fiche projet — modification d'une tâche existante

**Avant :** Les tâches n'avaient que deux actions : cocher/décocher et supprimer.

**Après :** Un bouton crayon ✏ apparaît sur chaque tâche. En cliquant, la tâche se transforme en formulaire inline permettant de modifier :
- Le **titre**
- La **durée** (jours)
- Les **dates** début et fin
- La **dépendance** (commence après quelle autre tâche)

Boutons "Enregistrer" (sauvegarde via `taskService.update`) et "Annuler" (retour à la vue normale). Une seule tâche en mode édition à la fois.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — état `editingTaskId` / `editingTask`, handlers `handleStartEditTask` / `handleSaveTask`, rendu conditionnel formulaire/vue dans la liste des tâches

---

## Lot 4 — Retours utilisateurs (session 4)

### 13. Calendrier — hauteur des lignes tâches agrandie

**Avant :** Lignes de tâches `min-h-9`, barre `h-3`, dates parfois coupées par la barre de la tâche suivante.

**Après :** Lignes `min-h-14`, barre `h-5` avec le titre de la tâche affiché à l'intérieur, dates décalées à `top: 50% + 12px`. Plus d'écrasement visuel entre les lignes.

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — composant `TaskGanttRow`

---

### 14. Calendrier — clic sur le nom du projet ouvre la fiche

**Avant :** Le titre du projet dans le Gantt était un simple `<span>` non interactif.

**Après :** Le titre est un bouton cliquable (texte indigo au survol, soulignement). Cliquer ouvre directement la fiche projet (`ProjectModal`) sans avoir à retourner dans le Kanban.

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — `ProjectRow` (prop `onProjectClick`), `renderPoleSection` (passage de `setSelected`)

---

### 15. Fiche projet — indentation visuelle des tâches dépendantes

**Avant :** Toutes les tâches avaient le même alignement horizontal dans le panneau droit, quelle que soit leur dépendance.

**Après :** Une tâche ayant un `depends_on` est décalée de `ml-4` et reçoit une bordure gauche orange (`border-l-2 border-l-orange-200`), signalant visuellement la relation de précédence.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — rendu conditionnel `className` sur le conteneur de tâche

---

### 16. Tâches — affectation à un membre du projet

**Avant :** Une tâche n'avait pas de notion d'assignee.

**Après :** Champ `assigned_to` (FK vers `users`) ajouté aux tâches. Un select "Assignée à" apparaît dans le formulaire d'ajout et le formulaire d'édition inline, peuplé des membres du projet. L'assignee est affiché (👤 username) dans la vue normale de la tâche.

**Comportement :** Le select n'apparaît que si le projet a au moins un membre associé.

**Fichiers modifiés :**
- `server/src/db/init.js` — migration `ALTER TABLE tasks ADD COLUMN assigned_to`
- `server/src/controllers/taskController.js` — `assigned_to` dans le schema Zod, les INSERT/UPDATE, et les SELECT (JOIN users)
- `client/src/components/Project/ProjectModal.jsx` — états `newTask`/`editingTask`, selects assignee, affichage

---

### 17. Administration — page de gestion des Tags

**Avant :** Aucune interface pour créer/modifier/supprimer des tags. Les tags n'étaient accessibles qu'en lecture dans les fiches projet.

**Après :** Nouvelle page `/admin/tags` accessible aux **admin et responsables (lead)**. Fonctionnalités :
- Tableau listant tous les tags (nom, couleur hex, aperçu en badge)
- Formulaire de création/édition avec palette de couleurs prédéfinies + color picker + saisie hex
- Suppression avec confirmation
- Aperçu en temps réel du badge pendant la saisie

**Sidebar :** Section "Administration" désormais visible pour admin ET lead. "Comptes" reste réservé aux admins. "Tags" visible pour les deux.

**Fichiers créés :**
- `client/src/components/Admin/AdminTagsPage.jsx` — page complète gestion tags

**Fichiers modifiés :**
- `server/src/controllers/tagController.js` — ajout de `update()`
- `server/src/routes/tags.js` — route `PUT /:id` (admin + lead), `DELETE` ouvert aux leads aussi
- `client/src/services/tagService.js` — méthode `update()`
- `client/src/App.jsx` — route `/admin/tags`
- `client/src/components/Layout/Sidebar.jsx` — lien Tags visible lead+admin, lien Comptes admin seulement

---

## Lot 5 — Retours utilisateurs (session 5)

### 18. Navigation — passage de la sidebar verticale à une barre horizontale

**Avant :** Sidebar fixe à gauche (`w-56`) + TopBar en haut avec champ de recherche.

**Après :** Une unique barre horizontale `h-14` en haut (fond `gray-900`) contenant, de gauche à droite :
- Logo IT + libellé "Project Tracker"
- Liens de navigation : Projets, Calendrier, Archives
- Section Administration (Tags pour admin+lead, Comptes pour admin seul) — séparée par un trait vertical
- Spacer (flex-1)
- Filtre Pôle (segmented pills : Tous / Dev / Réseau) — masqué pour les membres
- Bouton "Nouveau projet" (admin + lead seulement)
- Avatar + username/role + bouton déconnexion

Le champ de recherche a été **supprimé**.

**Fichiers modifiés :**
- `client/src/components/Layout/TopBar.jsx` — réécrit pour intégrer toute la navigation
- `client/src/components/Layout/AppShell.jsx` — layout `flex-col`, suppression de `<Sidebar />`

---

### 19. Module Cartographie des flux métiers

**Ajouté :** Nouveau module complet d'éditeur de diagrammes de flux métiers visuel.

**Fonctionnalités :**
- Liste des diagrammes (grille de cartes) accessible à tous
- Création/suppression de diagrammes (admin + lead uniquement)
- Éditeur canvas interactif basé sur `@xyflow/react` (React Flow v12)
- 7 types de nœuds : Processus, Service/API, Acteur/Rôle, Base de données, Décision, Début, Fin
- Connexion entre nœuds par glisser-déposer depuis les handles
- Panneau d'édition latéral droit (label, description, couleur)
- Palette de nœuds latérale gauche (drag vers canvas)
- Mini-map, contrôles de zoom, grille toggleable
- Sauvegarde persistante (`PUT /api/flows/:id/canvas`) — DELETE + INSERT atomique
- Mode lecture seule pour les membres
- Accès via nouveau lien "Flux métiers" dans la navigation

**Fichiers créés :**
- `server/src/controllers/flowController.js` — CRUD diagrammes + saveCanvas
- `server/src/routes/flows.js` — 6 routes REST (GET, POST, PUT, DELETE, saveCanvas)
- `client/src/services/flowService.js` — wrappers axios
- `client/src/store/flowStore.js` — état Zustand (liste, create, delete)
- `client/src/components/Flows/FlowsPage.jsx` — liste + modal création
- `client/src/components/Flows/FlowEditor.jsx` — canvas principal ReactFlow
- `client/src/components/Flows/NodePalette.jsx` — palette types de nœuds
- `client/src/components/Flows/NodeEditPanel.jsx` — édition nœud sélectionné
- `client/src/components/Flows/nodes/ProcessNode.jsx`
- `client/src/components/Flows/nodes/ServiceNode.jsx`
- `client/src/components/Flows/nodes/ActorNode.jsx`
- `client/src/components/Flows/nodes/DatabaseNode.jsx`
- `client/src/components/Flows/nodes/DecisionNode.jsx`
- `client/src/components/Flows/nodes/StartEndNode.jsx`

**Fichiers modifiés :**
- `server/src/db/init.js` — 3 nouvelles tables (`flow_diagrams`, `flow_nodes`, `flow_edges`) + trigger `updated_at`
- `server/src/app.js` — mount route `/api/flows`
- `client/src/App.jsx` — routes `/flows` et `/flows/:id`
- `client/src/components/Layout/TopBar.jsx` — lien "Flux métiers" ajouté dans NAV_ITEMS

---

### 20. Page "Mon espace" — projets et tâches de l'utilisateur connecté

**Ajouté :** Nouvelle page personnelle accessible à tous les utilisateurs depuis la barre de navigation ("Mon espace").

**Fonctionnalités :**
- En-tête avec avatar, nom, rôle et pôle de l'utilisateur
- Compteurs rapides : nombre de projets, tâches actives, tâches en retard (badge rouge)
- Section **Mes projets** : liste de tous les projets dont l'utilisateur est membre, avec clic pour ouvrir la fiche projet (`ProjectModal`)
- Section **Mes tâches** : toutes les tâches assignées à l'utilisateur (via `assigned_to`), triées par statut puis date d'échéance
  - Filtre "Actives / Toutes" pour afficher/masquer les tâches terminées
  - Indicateur visuel de retard (⚠ en rouge) si `due_date` dépassée et statut ≠ done
  - Affichage du projet source de chaque tâche

**Backend — nouveaux endpoints :**
- `GET /api/users/me/projects` — JOIN sur `project_members` pour retourner les projets de l'utilisateur courant avec ses tags
- `GET /api/users/me/tasks` — SELECT sur `tasks` WHERE `assigned_to = req.user.id`, JOIN `projects` pour le titre et le pôle

**Fichiers créés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — page complète

**Fichiers modifiés :**
- `server/src/controllers/userController.js` — fonctions `myProjects()` et `myTasks()` ajoutées
- `server/src/routes/users.js` — routes `GET /me/projects` et `GET /me/tasks`
- `client/src/App.jsx` — route `/mon-espace`
- `client/src/components/Layout/TopBar.jsx` — lien "Mon espace" ajouté dans NAV_ITEMS

**Dépendance ajoutée :**
- `@xyflow/react` (React Flow v12) installé dans `client/`

---

### 21. Corrections bugs + validation tâches dans Mon espace + renommage site

**Bugs corrigés :**
- `flowController.js` utilisait `const db = require('../db/database')` au lieu de `const { getDb }` → la variable `db` était `undefined`, causant l'erreur "Erreur lors de la création" à la création d'un flux. Corrigé en `const db = getDb()` au niveau module.
- `MonEspacePage.jsx` passait `project={selectedProj}` (objet) à `ProjectModal` qui attend `projectId` (number) → causait "Impossible de charger le projet". Corrigé en `projectId={selectedProj.id}` + refactoring en `setSelectedId`.

**Ajouté :**
- Bouton de validation des tâches (rond cliquable) dans Mon espace : bascule `todo/in_progress → done` et `done → todo`, appelle `taskService.update()`, met à jour l'état local instantanément. Compteur "Terminées" ajouté dans les compteurs rapides.

**Renommage :**
- Titre du site passé de "Project Tracker" à "Gestion de Projets" dans la TopBar.

**Fichiers modifiés :**
- `server/src/controllers/flowController.js` — fix import `getDb`
- `client/src/components/MonEspace/MonEspacePage.jsx` — fix `projectId`, bouton validation tâche, compteur terminées
- `client/src/components/Layout/TopBar.jsx` — renommage "Gestion de Projets"

---

## Récapitulatif des fichiers touchés

### Backend (`server/src/`)

| Fichier | Nature |
|---------|--------|
| `db/init.js` | Colonnes `earliest_start`, `latest_end` sur `projects` ; table `tasks` |
| `db/migrate.js` | Migrations pour les nouvelles colonnes et la table `tasks` |
| `sse.js` | **Nouveau** — module Server-Sent Events |
| `app.js` | Route SSE `GET /api/events` |
| `middleware/auth.js` | Support du token en query param |
| `controllers/projectController.js` | Schéma Zod étendu, broadcasts SSE |
| `controllers/taskController.js` | **Nouveau** — CRUD tâches |
| `routes/projects.js` | Routes tâches `/:id/tasks` et `/:id/tasks/:taskId` |
| `controllers/flowController.js` | **Nouveau** — CRUD diagrammes flux + saveCanvas |
| `routes/flows.js` | **Nouveau** — Routes `/api/flows` |

### Frontend (`client/src/`)

| Fichier | Nature |
|---------|--------|
| `services/taskService.js` | **Nouveau** — service API tâches |
| `store/projectStore.js` | Actions `initSSE`, `closeSSE`, état `_sseSource` |
| `components/Layout/AppShell.jsx` | Initialisation SSE |
| `components/Calendar/CalendarPage.jsx` | Barre Gantt, drag `'move'`, bande contrainte, bouton Tâches pill, suivi au drag, clic titre, hauteur tâches |
| `components/Project/ProjectModal.jsx` | Layout double panneau, tâches, édition inline, indentation dépendances, assignee |
| `components/Project/ProjectForm.jsx` | Layout élargi, tâches initiales à la création |
| `components/Board/Board.jsx` | Sélecteur d'années, vue archive/planifié |
| `components/Admin/AdminTagsPage.jsx` | **Nouveau** — page gestion des tags |
| `components/Layout/Sidebar.jsx` | Liens Admin restructurés (Tags pour lead+admin, Comptes admin seul) *(plus utilisé)* |
| `components/Layout/TopBar.jsx` | Réécrit — navigation horizontale, recherche supprimée, lien Flux métiers |
| `App.jsx` | Routes `/admin/tags`, `/flows`, `/flows/:id` |
| `services/tagService.js` | Méthode `update()` |
| `services/flowService.js` | **Nouveau** — service API flux |
| `store/flowStore.js` | **Nouveau** — état Zustand flux |
| `components/Flows/` | **Nouveau** — 10 composants (FlowsPage, FlowEditor, NodePalette, NodeEditPanel, 6 nodes) |

---

## Commandes après mise à jour

```bash
# Migrer une base de données existante
cd server && npm run db:migrate

# Redémarrer le backend
npm run dev

# Redémarrer le frontend
cd ../client && npm run dev
```
