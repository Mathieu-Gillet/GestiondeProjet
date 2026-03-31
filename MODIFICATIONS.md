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

## Lot 6 — Retours utilisateurs (session 6)

### 19. Suppression du module Flux métiers

**Avant :** Module de cartographie de flux métiers complet (FlowsPage, FlowEditor, 6 types de nœuds, tables SQLite flow_diagrams/flow_nodes/flow_edges, routes `/flows` et `/flows/:id`).

**Après :** Toutes les routes, imports et tables du module supprimés. La route `/api/flows` est remplacée par `/api/notifications`.

**Fichiers modifiés :**
- `client/src/App.jsx` — imports et routes flows supprimés
- `client/src/components/Layout/TopBar.jsx` — lien nav "Flux métiers" supprimé
- `server/src/app.js` — route `/api/flows` remplacée par `/api/notifications`
- `server/src/db/init.js` — tables flow_diagrams/flow_nodes/flow_edges supprimées

---

### 20. Système de notifications en cas de changement de statut de tâche

**Avant :** Aucune notification. Les responsables ne savaient pas qu'un membre avait modifié une tâche.

**Après :** Quand un utilisateur change le statut d'une tâche via le ProjectModal ou Mon Espace, le responsable du projet (owner) reçoit une notification. Les notifications s'affichent via une cloche dans la barre de navigation avec badge de comptage non lu. Clic = marque toutes comme lues automatiquement.

**Comportement :**
- Table `notifications` en base (user_id, project_id, task_id, from_user_id, message, read)
- Le changement de statut déclenche un `broadcastToUser(ownerId, 'notification', ...)` via SSE (temps réel si l'owner est connecté)
- Le SSE est maintenant par utilisateur (`Map<userId, Set<res>>` au lieu d'un `Set` global)
- Dropdown dans le TopBar : liste des 20 dernières notifs, lien "Tout marquer lu"

**Fichiers créés :**
- `server/src/controllers/notificationController.js` — list, markRead, markAllRead
- `server/src/routes/notifications.js` — `GET /`, `PATCH /read`, `PATCH /:id`
- `client/src/services/notificationService.js` — list, markRead, markAllRead

**Fichiers modifiés :**
- `server/src/sse.js` — SSE par utilisateur (`addClient(userId, res)`, `broadcastToUser()`)
- `server/src/app.js` — `addClient/removeClient` avec `req.user.id`
- `server/src/db/init.js` — table `notifications` ajoutée
- `server/src/controllers/taskController.js` — notification au owner lors d'un changement de statut
- `client/src/components/Layout/TopBar.jsx` — composant `NotificationBell` + badge + dropdown

---

### 21. Statuts de tâches à 3 états (remplace la case à cocher)

**Avant :** Case à cocher binaire todo ↔ done.

**Après :** Bouton cycle rond à 3 états : `○ À faire` → `◑ En cours` → `● Terminé` → `○ À faire`. Le texte de la tâche passe en bleu/gras quand "En cours". Accessible dans ProjectModal et Mon Espace.

**Comportement :**
- `taskService.patchStatus()` appelle `PATCH /projects/:id/tasks/:taskId/status` — route accessible à tous les utilisateurs authentifiés (y compris les membres)
- Les membres ne peuvent mettre à jour que le statut des tâches qui leur sont assignées
- `handleCycleTask()` dans ProjectModal, `handleToggleDone()` cycle dans MonEspace

**Fichiers modifiés :**
- `server/src/routes/projects.js` — nouvelle route `PATCH /:id/tasks/:taskId/status`
- `server/src/controllers/taskController.js` — fonction `updateStatus()`
- `client/src/services/taskService.js` — méthode `patchStatus()`
- `client/src/components/Project/ProjectModal.jsx` — cycle 3 états + couleur texte
- `client/src/components/MonEspace/MonEspacePage.jsx` — cycle 3 états avec patchStatus

---

### 22. Validation des dates de tâches

**Avant :** Aucune contrainte — une tâche pouvait avoir une date antérieure au projet ou à sa dépendance.

**Après :**
- La date de début d'une tâche ne peut pas être antérieure à la date de début du projet
- Si une tâche dépend d'une autre, sa date de début ne peut pas être antérieure à la date de fin de la tâche précédente
- Validation backend (HTTP 400 avec message explicite) + frontend (`min` sur les `<input type="date">` avec affichage de la date minimale en orange)

**Fichiers modifiés :**
- `server/src/controllers/taskController.js` — validations dans `create()` et `update()`
- `client/src/components/Project/ProjectModal.jsx` — attribut `min` dynamique sur les champs dates (formulaire ajout + édition inline)

---

### 23. Flèches de dépendances dans le Calendrier Gantt

**Avant :** Les liens de dépendances entre tâches n'étaient pas visibles dans le calendrier (seul l'icône ⛓ indiquait une dépendance).

**Après :** Quand un projet est déplié dans le calendrier, des lignes orangées en pointillés (SVG) relient la fin de la barre de la tâche parente à la gauche de la barre de la tâche dépendante, sous forme de chemin orthogonal (L-shape).

**Comportement :** Le composant `DependencyLines` calcule les positions x (en pourcentage 0-100 sur 12 mois) et y (index × 56px) de chaque paire de tâches liées, et les trace via `<path>` SVG avec `vectorEffect="non-scaling-stroke"` pour une épaisseur constante quel que soit le zoom.

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — composant `DependencyLines` + intégration dans `renderPoleSection`

---

## Lot 7 — Retours utilisateurs (session 7)

### 24. Correction cloche de notifications — icône SVG

**Avant :** Path SVG incomplet rendant la cloche illisible.

**Après :** Icône cloche standard en deux `<path>` séparés (corps + anneau de bas).

**Fichiers modifiés :**
- `client/src/components/Layout/TopBar.jsx` — path SVG corrigé

---

### 25. Dépendances tâches dans le calendrier — numéros au lieu de flèches SVG

**Avant :** Flèches pointillées SVG reliant les barres (composant `DependencyLines`).

**Après :** Chaque tâche affiche un badge numéroté circulaire (#1, #2…) à gauche de son nom. Si une tâche dépend d'une autre, elle affiche `→ #N` (badge orange) indiquant le numéro de la tâche parente.

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — `TaskGanttRow` reçoit `taskNum` + `depNum`, `DependencyLines` supprimé, `renderPoleSection` calcule et passe les numéros

---

### 26. Suppression de l'indentation des tâches dépendantes dans ProjectModal

**Avant :** Les tâches avec `depends_on` étaient décalées de `ml-4 border-l-2 border-l-orange-200`.

**Après :** Toutes les tâches sont alignées au même niveau. La dépendance reste visible via le label `⛓ après «titre»`.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — suppression du `ml-4 border-l-2 border-l-orange-200` conditionnel

---

## Lot 8 — Déploiement LXC Proxmox (session 8)

### 27. Module de déploiement LXC — nginx + SSL auto-signé + PM2

**Ajouté :** Dossier `deploy/` contenant tout le nécessaire pour installer l'application dans un conteneur LXC Proxmox sans Docker.

**Architecture cible :**
- nginx écoute sur :80 et :443
- Toutes les requêtes HTTP (:80) sont redirigées 301 vers HTTPS (:443)
- nginx proxifie vers Node.js (port 3000 local)
- La route `/api/sse` bénéficie d'une configuration spéciale (buffering désactivé, timeout 24h)
- Certificat SSL auto-signé valide 10 ans (usage LAN interne)
- PM2 maintient le processus Node.js actif et le relance au boot via systemd

**Fichiers créés :**
- `deploy/setup.sh` — script d'installation complet (Node.js 20, PM2, nginx, cert SSL, build frontend, démarrage)
- `deploy/nginx.conf` — configuration nginx (redirect :80→:443, reverse proxy, config SSE)
- `deploy/ecosystem.config.cjs` — configuration PM2 (flag `--experimental-sqlite`, logs, politique de redémarrage)
- `deploy/update.sh` — script de mise à jour (git pull + rebuild + redémarrage PM2)
- `deploy/README.md` — guide d'installation Proxmox complet

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
| `components/Calendar/CalendarPage.jsx` | Barre Gantt, drag `'move'`, bande contrainte, bouton Tâches pill, suivi au drag, clic titre, hauteur tâches, vue 6 mois, clampage |
| `components/Project/ProjectModal.jsx` | Layout double panneau, tâches, édition inline, indentation dépendances, assignee, ConfirmModal, archive, sous-onglets statut, contraintes tâches |
| `components/ConfirmModal.jsx` | **Nouveau** — modale de confirmation réutilisable |
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

### Déploiement (`deploy/`)

| Fichier | Nature |
|---------|--------|
| `deploy/setup.sh` | **Nouveau** — installation complète LXC (Node.js, PM2, nginx, SSL) |
| `deploy/nginx.conf` | **Nouveau** — reverse proxy HTTPS + redirect :80→:443 + config SSE |
| `deploy/ecosystem.config.cjs` | **Nouveau** — configuration PM2 production |
| `deploy/update.sh` | **Nouveau** — mise à jour (git pull + rebuild + restart) |
| `deploy/README.md` | **Nouveau** — guide d'installation Proxmox |

---

## Lot 9 — Notes de tâches + Export Excel (session 9)

### 28. Champ notes par tâche — expandable au clic

**Avant :** Les tâches ne disposaient d'aucun champ de commentaire ou de suivi personnel.

**Après :** Chaque tâche affiche un bouton "Ajouter des notes" (crayon). Au clic, un textarea s'ouvre sous la ligne de tâche. La sauvegarde se fait automatiquement à la perte du focus (`onBlur`). La couleur du bouton change si des notes existent déjà (amber = notes présentes, gris = vide).

**Comportement :**
- Dans `ProjectModal` : bouton sous les métadonnées de chaque tâche ; seule la tâche en cours d'édition est expandée
- Dans `MonEspacePage` : bouton icône crayon à droite de chaque ligne de tâche
- Les membres ne peuvent modifier les notes que de leurs propres tâches (contrôle backend)
- Sauvegarde via `PATCH /api/projects/:id/tasks/:taskId/notes`

**Fichiers modifiés :**
- `server/src/db/init.js` — migration `ALTER TABLE tasks ADD COLUMN notes TEXT`
- `server/src/controllers/taskController.js` — notes dans taskSchema, create, update ; nouvelle fonction `patchNotes`
- `server/src/routes/projects.js` — route `PATCH /:id/tasks/:taskId/notes`
- `client/src/services/taskService.js` — méthode `patchNotes`
- `client/src/components/Project/ProjectModal.jsx` — state `expandedNotesId` + `notesMap`, bouton + textarea expandable, répartition des panneaux inversée (tâches = `flex-1`, détails = `w-72`)
- `client/src/components/MonEspace/MonEspacePage.jsx` — bouton crayon + textarea dans `TaskRow`, `handleSaveNotes`

### 29. Répartition des panneaux dans ProjectModal

**Avant :** Panneau gauche (détails + commentaires) = `flex-1` ; panneau droit (tâches) = `w-80` (320px fixe).

**Après :** Panneau gauche (détails + commentaires) = `w-72` (288px fixe) ; panneau droit (tâches) = `flex-1` (prend l'espace restant, ~65% du modal).

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — classes CSS des deux panneaux

### 30. Export Excel des projets

**Avant :** Aucune fonctionnalité d'export de données.

**Après :** Bouton "Export Excel [année]" dans la page Projets, visible uniquement pour les admins et leads. Génère un fichier `.xlsx` avec deux feuilles :
- **Projets** : Titre, Pôle, Statut, Priorité, Responsable, Dates, Tâches totales, Tâches terminées, Avancement (%), Description
- **Tâches** : Projet, Pôle, Tâche, Statut, Assignée à, Dates, Durée, Notes

**Comportement :**
- Périmètre : projets `in_progress` ou `done` ayant une activité dans l'année courante
- Téléchargement direct via Axios (`responseType: 'blob'`) + `URL.createObjectURL`
- Route protégée par `requireRole('admin', 'lead')`
- Librairie : SheetJS (`xlsx`)

**Fichiers créés :**
- `server/src/controllers/exportController.js` — génération du fichier xlsx
- `server/src/routes/export.js` — route `GET /api/export/projects`
- `client/src/services/exportService.js` — `downloadProjects()`

**Fichiers modifiés :**
- `server/src/app.js` — enregistrement de la route `/api/export`
- `server/package.json` — ajout dépendance `xlsx`
- `client/src/components/Board/Board.jsx` — bouton export + `handleExport`

---

## Lot 10 — Discussion par tâche + UI améliorée (session 10)

### 31. Remplacement des notes par une discussion par tâche

**Avant :** Chaque tâche avait un textarea "notes" sauvegardé au blur (texte personnel, non structuré).

**Après :** Chaque tâche dispose d'un espace discussion collapsible (clic sur "Discussion"). Les membres du projet peuvent y échanger des messages courts, visibles de tous. Le compteur de messages apparaît dans le bouton quand la discussion est non vide. Suppression possible par l'auteur ou un admin.

**Comportement :**
- Chargement lazy des commentaires à la première ouverture
- `POST /api/projects/:id/tasks/:taskId/comments` — tout utilisateur authentifié
- `GET /api/projects/:id/tasks/:taskId/comments` — tout utilisateur authentifié
- `DELETE /api/projects/:id/tasks/:taskId/comments/:commentId` — auteur ou admin
- Les commentaires projet existants (`GET /api/projects/:id/comments`) filtrent désormais `task_id IS NULL`

**Fichiers modifiés :**
- `server/src/db/init.js` — migration `ALTER TABLE comments ADD COLUMN task_id`
- `server/src/controllers/projectController.js` — `getComments` filtre `task_id IS NULL`, nouvelles fonctions `getTaskComments` + `addTaskComment`
- `server/src/routes/projects.js` — 3 nouvelles routes task comments
- `client/src/services/taskService.js` — méthodes `listComments`, `addComment`, `deleteComment`
- `client/src/components/Project/ProjectModal.jsx` — état `expandedDiscussionId` + `taskCommentsMap` + `newTaskCommentMap`, handlers discussion, UI discussion inline

### 32. Agrandissement des textes et icônes dans le panneau tâches

**Avant :** Titre de tâche en `text-xs`, métadonnées en `text-[10px]`, icône édition `w-3.5 h-3.5`, croix suppression `text-xs`, bouton statut 20×20 px.

**Après :** Titre `text-sm`, métadonnées `text-xs`, icône édition `w-5 h-5`, croix `text-base`, bouton statut 24×24 px.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — classes CSS taille texte et icônes

### 33. Modal projet : taille et répartition 50/50

**Avant :** Modal `90vw / 1200px / 85vh`, panneau gauche `w-72` fixe.

**Après :** Modal `94vw / 1400px / 90vh`, panneau gauche `flex-1` → vrai 50/50 avec panneau droit.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — style modal + classe panneau gauche

---

## Lot 11 — Contraintes tâches + Archive + ConfirmModal + Calendrier 6 mois + Mon espace accordéon (session 11)

### 34. Contraintes temporelles sur les tâches (au plus tôt / au plus tard)

**Avant :** Les tâches n'avaient pas de dates de contrainte (uniquement `start_date` et `due_date`).

**Après :** Deux nouvelles colonnes `earliest_start DATE` et `latest_end DATE` sur la table `tasks`. Affichage dans la fiche projet (ligne ⏰/⏳ sous les dates) et saisie dans le formulaire d'édition inline.

**Fichiers modifiés :**
- `server/src/db/init.js` — 2 migrations `ALTER TABLE tasks ADD COLUMN earliest_start DATE` et `latest_end DATE`
- `server/src/controllers/taskController.js` — champs dans le schema Zod, INSERT, UPDATE
- `client/src/components/Project/ProjectModal.jsx` — champs de saisie dans le formulaire d'édition, affichage dans la vue normale

---

### 35. Protection archive — projets avec statut `done` non modifiables (sauf admin)

**Avant :** Tout lead pouvait modifier/supprimer/déplacer un projet archivé (`done`) ainsi que ses tâches.

**Après :** Quand le statut d'un projet est `done` et que l'utilisateur n'est pas admin, toute tentative de modification retourne HTTP 403 avec le message "Ce projet est archivé. Seul un administrateur peut le modifier." Le frontend affiche un badge "Lecture seule" à la place des boutons Modifier/Supprimer.

**Comportement :**
- Protection dans `projectController.js` : fonctions `update()`, `remove()`, `move()`
- Protection dans `taskController.js` : fonctions `create()`, `update()`, `remove()`
- `canEdit` recalculé dans `ProjectModal` : `false` si projet archivé et rôle ≠ admin

**Fichiers modifiés :**
- `server/src/controllers/projectController.js` — vérification `status === 'done'` dans update/remove/move
- `server/src/controllers/taskController.js` — vérification `status === 'done'` dans create/update/remove
- `client/src/components/Project/ProjectModal.jsx` — `isArchived`, `canEdit` mis à jour, badge "Lecture seule"

---

### 36. ConfirmModal — remplacement des `window.confirm()` natifs

**Avant :** `handleDelete` et `handleDeleteTask` utilisaient `window.confirm()` (boîte de dialogue native du navigateur, sans style).

**Après :** Nouveau composant `ConfirmModal` avec icône d'avertissement, titre, message et boutons "Annuler" / action colorée. Déclenché via état `confirmAction` (null ou `{ title, message, onConfirm }`).

**Fichiers créés :**
- `client/src/components/ConfirmModal.jsx` — modale de confirmation réutilisable

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — import `ConfirmModal`, état `confirmAction`, handlers `handleDelete` et `handleDeleteTask` réécrit, rendu conditionnel en fin de `return`

---

### 37. Panneau tâches — sous-onglets de statut + numérotation

**Avant :** Toutes les tâches étaient listées dans un flux continu dans le panneau droit.

**Après :** Trois onglets (À faire / En cours / Terminé) avec compteurs. Seules les tâches du statut actif sont affichées. Chaque tâche affiche un badge numéroté circulaire basé sur sa position dans la liste complète.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — état `activeTaskTab`, sous-onglets, filtre par statut, numéro de tâche

---

### 38. Calendrier — vue 6 mois + clampage sur la plage visible

**Avant :** Le calendrier affichait toujours les 12 mois de l'année. Les barres sortaient de leur plage visible.

**Après :** Boutons de sélection 12 mois / 6 mois (Jan–Juin / Juil–Déc). Les barres de projets et tâches sont clampées à la plage visible. La ligne "aujourd'hui" est masquée hors plage. Les projets/tâches hors plage ne sont pas rendus.

**Comportement :**
- Variables `firstVisibleMonth`, `lastVisibleMonth`, `numVisibleMonths` dérivées de `calViewMonths` et `calHalf`
- `ProjectRow` et `TaskGanttRow` reçoivent `firstVisibleMonth`/`numVisibleMonths` et calculent positions clampées
- `todayPct` recalculé en tenant compte de la plage visible
- En mode 6 mois : affichage de repères jours (1, 8, 15, 22, 29) sous les en-têtes de mois
- Drag pointer corrigé pour utiliser `numVisibleMonths` dans le calcul de `newMonth`
- `updateProject` appelé en premier dans `handlePointerUp` (type `'move'`) ; les tâches sont mises à jour ensuite en best-effort (try/catch)
- Couleurs des tâches dans le Gantt changées : todo = amber `#F59E0B`, in_progress = orange `#F97316`, done = emerald `#10B981`

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — états `calViewMonths`/`calHalf`, toolbar, `ProjectRow`, `TaskGanttRow`, `todayPct`, `handlePointerMove`, `handlePointerUp`

---

### 39. Mon espace — refonte en accordéon projets + discussion tâches

**Avant :** Deux colonnes séparées "Mes projets" (cartes) et "Mes tâches" (liste).

**Après :** Liste accordéon unique : chaque projet se déplie pour afficher ses tâches assignées. Chaque tâche inclut un bouton de cycle de statut, son numéro, son titre, sa date et un module de discussion collapsible (identique à ProjectModal).

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — réécriture complète (composants `TaskDiscussion`, `TaskItem`, `ProjectAccordion`)

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

---

## Lot 12 — Bug save tâche + largeurs modales + Mon Espace pleine page (session 12)

### 38. Correction bug : impossible de sauvegarder une tâche en cours

**Avant :** Toute tentative de sauvegarde d'une tâche existante (PUT `/projects/:id/tasks/:taskId`) provoquait un `ReferenceError: notes is not defined` côté serveur. La variable `notes` était utilisée dans la logique de construction du `UPDATE` SQL mais absente du destructuring de `result.data`. L'erreur 500 était silencieuse côté client (pas de try/catch).

**Après :** `notes` ajouté au destructuring. Le formulaire d'édition inline dispose désormais d'un try/catch qui affiche l'erreur en rouge dans le formulaire si le serveur rejette la requête.

**Fichiers modifiés :**
- `server/src/controllers/taskController.js` — ajout de `notes` au destructuring ligne 122
- `client/src/components/Project/ProjectModal.jsx` — ajout state `taskError`, try/catch dans `handleSaveTask`, affichage erreur inline, réinitialisation erreur à l'annulation

### 39. Agrandissement des modales (toutes les sous-fenêtres)

**Avant :** Modales de largeur variable : ProjectForm `85vw/960px`, AdminUsers `max-w-md`, AdminTags `max-w-sm`.

**Après :** Toutes les modales élargies pour occuper quasi la totalité de la largeur de la page :
- ProjectForm : `95vw / 1400px max / 92vh`
- AdminUsersPage : `max-w-2xl`
- AdminTagsPage : `max-w-xl`
- ProjectModal : déjà à `94vw/1400px`, inchangé

**Fichiers modifiés :**
- `client/src/components/Project/ProjectForm.jsx` — style width/maxWidth/maxHeight
- `client/src/components/Admin/AdminUsersPage.jsx` — classe `max-w-2xl`
- `client/src/components/Admin/AdminTagsPage.jsx` — classe `max-w-xl`

### 40. Mon Espace — pleine page + cartes projet plus grandes

**Avant :** Conteneur limité à `max-w-4xl mx-auto` (~896px). Cartes projet compactes avec texte `text-sm`, padding `px-4 py-3`, barre de progression `h-1`.

**Après :** Conteneur `w-full` (pleine largeur). Cartes projet élargies : padding `px-6 py-4`, titre `text-base`, badges `text-xs px-3 py-1`, barre de progression `h-2`. Items de tâche : padding `px-4 py-3`, titre `text-base`, icône statut 26×26px. En-tête utilisateur : avatar 14×14, nom `text-2xl`.

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — conteneur, accordéon projet, items tâche, en-tête

---

## Lot 13 — Formulaire création projet : plein écran + tâches complètes (session 13)

### 41. Colonne tâches initiales — fonctionnalités complètes

**Avant :** Lors de la création d'un projet, la colonne droite (tâches) permettait seulement de saisir un `titre` et une `durée`. La colonne était fixée à `w-80` (320px). La modale était limitée à `95vw/1400px`.

**Après :**
- Modale à `98vw / 1600px max / 95vh` — quasi plein écran
- Colonne tâches en `flex-1` (moitié de l'espace, même largeur que la colonne projet)
- Formulaire tâche enrichi avec les mêmes champs que l'édition inline dans la fiche projet :
  - `start_date` / `due_date` avec min dynamique selon la tâche précédente
  - `earliest_start` / `latest_end` (au plus tôt / au plus tard)
  - `depends_on` — sélection parmi les tâches déjà ajoutées dans la liste
  - `assigned_to` — sélection parmi les membres du projet (ou tous les users si aucun membre sélectionné)
- Carte tâche dans la liste : affiche toutes les infos (dates, contraintes, dépendance ⛓, assignation 👤)
- Soumission : création séquentielle des tâches avec résolution des dépendances (`idMap` tempId → realId)

**Fichiers modifiés :**
- `client/src/components/Project/ProjectForm.jsx` — réécriture complète du bloc tâches initiales + état `EMPTY_TASK_INPUT`, `assignableUsers`, `idMap` dans `handleSubmit`

---

## Lot 14 — Style ClickUp barres Gantt + ligne "Aujourd'hui" (session 14)

### 42. Barres Gantt — style ClickUp

**Avant :** Barres plates `h-6` (24px), couleur unique par pôle (indigo/emerald), sans ombre, sans texte à l'intérieur.

**Après :**
- Palette de 10 couleurs vives (`BAR_COLORS`) assignées par `project.id % 10` : violet, orange, sky, pink, emerald, amber, indigo, teal, red, lime
- Barres projet : `height: 32px`, gradient diagonal `linear-gradient(135deg, …)`, reflet blanc en haut, ombre colorée (`boxShadow`), titre du projet en blanc gras à l'intérieur
- Barres tâche : `height: 26px`, palette de couleurs par statut (`TASK_STATUS_COLOR` : `#94A3B8` todo, `#6366F1` in_progress, `#10B981` done), ombre colorée, texte blanc
- Poignées de redimensionnement redessinées (tirets blancs `w-0.5 h-3.5` + fond semi-transparent)
- Hauteur des lignes projet : `min-h-[4.5rem]`

### 43. Ligne "Aujourd'hui" — plus visible

**Avant :** Ligne `w-px bg-red-400/60` (1px, transparente), petit cercle sans label.

**Après :** Ligne de 2px avec dégradé rouge + glow (`boxShadow`), label **"Auj."** en capsule rouge au sommet, cercle rouge sous le label.

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — constantes `BAR_COLORS`, `getBarColor`, `TASK_STATUS_COLOR` ; style barres projet et tâche ; ligne today ; légende statuts tâche

## Lot 15 — UI tâches, membres/tags, modal plein écran (session 15)

### 44. ProjectForm — Boutons membres et tags agrandis

**Avant :** Boutons `px-2.5 py-1 text-xs font-medium` avec `gap-2`, petits et serrés.

**Après :** Boutons `px-5 py-2 text-sm font-semibold border-2` avec `gap-3`, plus grands, mieux espacés, plus lisibles.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectForm.jsx` — style des boutons membres et tags

### 45. ProjectModal — Fenêtre plein écran

**Avant :** Modal `width: 94vw, maxWidth: 1400px, height: 90vh` avec `rounded-2xl` et `p-4` sur l'overlay.

**Après :** Modal `width: 100vw, height: 100vh` sans padding ni bordures arrondies — occupe toute la fenêtre navigateur.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — dimensions et style du conteneur modal

### 46. ProjectModal — Tâches : dates à gauche en gras, notes, sélecteur statut carré

**Avant :** Statut affiché via un bouton rond (○/◑/●) ; dates dans une ligne secondaire discrète ; pas de champ notes visible.

**Après :**
- Colonne de dates (début → fin) à gauche en gras (`w-28 font-bold`), avec assignée juste dessous
- Numéro de tâche conservé en badge rond
- Bouton statut remplacé par un `<select>` carré avec les 3 valeurs (À faire / En cours / Terminé), coloré selon l'état
- Notes affichées en italique sous le titre si renseignées
- Champ "Description / Notes" ajouté dans le formulaire d'ajout et d'édition de tâche

**Comportement :** La sélection dans le `<select>` appelle directement `PATCH /tasks/:id/status` sans cycle — choix direct de l'état.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — vue tâche, formulaires ajout/édition, `TASK_STATUS_CFG`, `handleChangeTaskStatus`

### 47. MonEspacePage — TaskItem : dates à gauche en gras, notes, sélecteur statut carré

**Avant :** Même style que la modal (statut rond, date à droite, pas de notes).

**Après :** Même refonte que §46 : dates en gras à gauche, `<select>` carré pour le statut, notes en italique.

**Comportement :** `handleCycleStatus` accepte désormais `(task, newStatus)` au lieu de cycler automatiquement.

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — `TASK_STATUS_CFG`, `TaskItem`, `handleCycleStatus`

## Lot 16 — Calendrier 6 mois : navigation fine + zoom (session 16)

### 48. Calendrier — navigation semaine/quinzaine et zoom ajustable en vue 6 mois

**Avant :** Vue 6 mois limitée à deux fenêtres fixes (Jan–Juin / Juil–Déc), navigation uniquement par année.

**Après :**
- **Nouveau système de coordonnées jour-par-jour** pour la vue 6 mois (la vue 12 mois est inchangée)
- **Navigation fine** : boutons ← 2 sem / ← 1 sem / 1 sem → / 2 sem → déplacent `viewStartDate` par ±7 ou ±14 jours
- **Zoom** : boutons preset (1 mois / 2 mois / 3 mois / 6 mois) + fine (−7j / +7j) ajustent `viewDays` (plage 30–365 jours)
- **Bouton Auj.** : recentre la fenêtre sur aujourd'hui
- **Ligne "Aujourd'hui"** : ligne rouge avec capsule "Auj." visible dans la vue 6 mois
- **En-tête mois proportionnel** : les colonnes mois sont rendues proportionnellement aux jours réels (pas de largeur fixe)
- **Drag en vue 6 mois** : snap à la semaine (7j), sauvegarde des dates précises (vs snap au mois en vue 12 mois)

**Nouveaux états :**
- `viewStartDate` (Date) — début de la fenêtre visible
- `viewDays` (number, défaut 182) — nombre de jours affichés
- `getVisibleMonthHeaders()` — calcule les en-têtes mois dynamiquement
- `getBarPctsDay()` — calcule la position/largeur d'une barre en %

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — imports date-fns, états, helpers, contrôles, `ProjectRow`, `TaskGanttRow`, grille, drag

## Lot 17 — Layout tâches, modal 90%, Export Excel, renommage GProjet (session 17) Layout tâches, modal 90%, Export Excel, renommage GProjet (session 16)

### 48. Layout tâche — réorganisation gauche→droite

**Avant :** `[Dates] [#] [Statut] [Titre/Notes]` — dates à gauche, titre à droite sans ordre logique.

**Après :** `[#] [Statut select]   [espace flex-1]   [Titre/Notes flex-3]   [Dates w-32/w-36 text-right]` — numéro et statut compacts à gauche, grand espace au milieu, titre/notes centré, dates collées au bord droit en gras.

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — composant `TaskItem`
- `client/src/components/Project/ProjectModal.jsx` — vue normale tâche

### 49. ProjectModal — taille réduite à 90 vw × 90 vh

**Avant :** Modal plein écran `100vw × 100vh` sans marges.

**Après :** Modal `90vw × 90vh` avec `rounded-2xl`, overlay `p-[5vh_5vw]` — laisse une bande visible autour de la fenêtre.

**Fichiers modifiés :**
- `client/src/components/Project/ProjectModal.jsx` — conteneur overlay et modal

### 50. Export Excel — suppression de l'année dans le libellé

**Avant :** Bouton affichait `Export Excel 2026` (année dynamique).

**Après :** Bouton affiche `Export Excel` (l'export exporte toujours l'année en cours côté serveur, sans l'afficher).

**Fichiers modifiés :**
- `client/src/components/Board/Board.jsx` — label du bouton export

### 51. Renommage de l'application en GProjet

**Avant :** App nommée "IT Project Tracker" / "Gestion de Projets" / "Project Tracker".

**Après :** Tous les affichages renommés en **GProjet**, badge logo `IT` → `GP`.

**Fichiers modifiés :**
- `client/index.html` — `<title>`
- `client/src/components/Layout/TopBar.jsx` — badge et label logo
- `client/src/components/Layout/Sidebar.jsx` — badge et label logo
- `client/src/components/Auth/LoginPage.jsx` — titre page de connexion

---

## Lot 18 — Calendrier 6 mois : navigation ← → par mois (session 18)

### 52. Calendrier — remplacement navigation fine par navigation mois

**Avant (Lot 16, annulé) :** Système jour-par-jour complexe (`viewStartDate`, `viewDays`, `getBarPctsDay`, zoom, etc.) ajouté puis rejeté.

**Après :** Retour au système mois-par-mois d'origine + navigation simple en vue 6 mois :
- `calHalf` (0|1 fixe) remplacé par `calStartMonth` (0–6, glissant)
- Boutons **← →** déplacent la fenêtre de 6 mois d'un mois à la fois (min Jan, max Jul)
- Label affiché : `"Jan – Jun 2026"` (adaptatif à la position courante)
- La navigation **par année** reste visible pour les deux modes (12 mois et 6 mois)
- Aucun changement au système de positionnement des barres (100 % mois-based)
- Imports `date-fns` simplifiés : suppression de `addDays`, `subDays`, `addMonths`, `startOfMonth`, `endOfMonth`, `startOfWeek`, `differenceInDays` et de `fr` locale

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — fichier réécrit (suppression vue fine, ajout navigation ← →)

---

## Lot 19 — Refonte UX/UI : multi-vues inspirées Asana (worktree inspiring-bhaskara)

### 53. TopBar — passage au thème clair (light)

**Avant :** Barre de navigation `bg-gray-900 text-white`, boutons inactifs `text-gray-400 hover:bg-gray-800`, filtre pôle sur fond `bg-gray-800`, avatar `bg-gray-600`.

**Après :** Barre blanche `bg-white border-b border-gray-200`, boutons inactifs `text-gray-600 hover:bg-gray-100`, actif `bg-indigo-50 text-indigo-700`, filtre pôle sur `bg-gray-100` avec actif `bg-white shadow-sm`, avatar `bg-indigo-100 text-indigo-700`. Le bouton "Nouveau projet" conserve son fond indigo avec `shadow-sm`.

**Comportement :** La détection de l'onglet "Projets" actif utilise `isProjectsActive = location.pathname.startsWith('/projects') || pathname === '/'`.

**Fichiers modifiés :**
- `client/src/components/Layout/TopBar.jsx` — thème light complet, path "Projets" → `/projects/board`, `isProjectsActive`

---

### 54. Onglets de vue Projets (Tableau / Liste / Chronologie / Tableau de bord)

**Avant :** `/` affichait directement `<Board>` sans sous-navigation.

**Après :** Quatre vues accessibles via des onglets horizontaux sous la TopBar dans toutes les pages projets. Routes dédiées : `/projects/board`, `/projects/list`, `/projects/timeline`, `/projects/dashboard`. La racine `/` et les routes inconnues redirigent vers `/projects/board`.

**Fichiers créés :**
- `client/src/components/Projects/ProjectsLayout.jsx` — barre d'onglets avec 4 vues, border-b indigo sur actif

**Fichiers modifiés :**
- `client/src/App.jsx` — `ProjectsRoute` wrapper, 4 nouvelles routes `/projects/*`, redirect `/` → `/projects/board`

---

### 55. Vue Liste (`ListView`)

**Ajouté :** Nouvelle vue listant tous les projets sous forme de tableau groupé par statut.

**Fonctionnalités :**
- 4 sections collapsibles (Idées / En cours / En attente / Terminé) avec chevron toggle
- En-têtes de colonnes : Nom, Tags (masqués < lg), Assigné, Échéance, Priorité, Pôle
- Chaque ligne : cercle de statut, titre tronqué, avatar + username assigné, date avec indicateur de retard ⚠, badge priorité (pill coloré avec dot), badge pôle
- Bouton "+ Ajouter un projet" (admin/lead) en bas de chaque section → ouvre `ProjectForm`
- Clic sur une ligne → ouvre `ProjectModal`

**Fichiers créés :**
- `client/src/components/List/ListView.jsx` — composants `ListRow`, `ListSection`, `ListView`

---

### 56. Vue Chronologie / Gantt (`TimelineView`)

**Ajouté :** Diagramme de Gantt CSS-based pour les projets ayant une date d'échéance.

**Fonctionnalités :**
- Panneau gauche : liste des projets avec point de priorité coloré et badge pôle raccourci
- Panneau droit : grille de 3 mois glissants avec barres horizontales clampées sur la plage visible
- Couleurs de barres selon statut (gris / bleu / ambre / vert)
- Marqueur rouge "Aujourd'hui" sur la colonne courante
- Navigation ← → par mois + bouton "Aujourd'hui"
- Légende des couleurs et compteur de projets avec dates
- Clic sur barre ou sur ligne → ouvre `ProjectModal`

**Fichiers créés :**
- `client/src/components/Timeline/TimelineView.jsx`

---

### 57. Tableau de bord (`DashboardView`)

**Ajouté :** Vue synthétique avec indicateurs et répartitions visuelles.

**Fonctionnalités :**
- 4 cartes KPI : Total projets, En cours, Critiques, En retard (avec coloration rouge/orange si > 0)
- 3 cartes breakdown :
  - Par statut : 4 barres de progression CSS
  - Par pôle : 2 barres + 2 compteurs colorés indigo/emerald
  - Par priorité : 4 barres colorées
- Barre de taux de complétion globale (`done / total`)

**Fichiers créés :**
- `client/src/components/Dashboard/DashboardView.jsx` — composants `MetricCard`, `BarRow`, `SectionCard`

---

### 58. Polish ProjectCard + Column (Board view)

**Avant :** Carte sans accent latéral, priorité affichée en dot + texte gris, avatar `bg-gray-200`.

**Après :**
- Bordure gauche colorée selon priorité (`border-l-[3px]` : rouge/orange/bleu/gris)
- Priorité rendue en pill colorée (même style que la ListView)
- Avatar assigné `bg-indigo-100 text-indigo-700` (cohérence TopBar)
- Transition `hover:-translate-y-px` pour feedback visuel au survol
- Fond de colonne kanban `bg-gray-50` (au lieu de `bg-gray-100`) — plus léger

**Fichiers modifiés :**
- `client/src/components/Board/ProjectCard.jsx` — `PRIORITY_BORDER`, style border-l, pill priorité, avatar
- `client/src/components/Board/Column.jsx` — fond `bg-gray-50`

---

## Lot 20 — Refonte chronologie : Mon Espace + indicateur liste (session 20)

### 59. Suppression de l'onglet Chronologie de l'espace Projets

**Avant :** 4 onglets dans l'espace Projets — Tableau, Liste, Chronologie, Tableau de bord.

**Après :** 3 onglets — Tableau, Liste, Tableau de bord. L'onglet Chronologie et la route `/projects/timeline` sont supprimés.

**Fichiers modifiés :**
- `client/src/components/Projects/ProjectsLayout.jsx` — entrée Chronologie retirée du tableau `VIEWS`
- `client/src/App.jsx` — import `TimelineView` et route `/projects/timeline` supprimés

---

### 60. Chronologie personnelle dans Mon Espace (3 mois glissants)

**Ajouté :** Nouvel onglet "Chronologie — 3 mois" dans Mon Espace affichant un Gantt CSS des projets et tâches de l'utilisateur sur la fenêtre courante (mois actuel + 2 mois suivants).

**Fonctionnalités :**
- Toggle Liste / Chronologie en haut de page (onglets inline)
- Projets de l'utilisateur en barres colorées par statut (hauteur 44px)
- Tâches de l'utilisateur en barres plus fines (34px) imbriquées sous leur projet, avec tiret de relation visuelle à gauche
- Tâches orphelines (projet non visible) affichées en bas
- Marqueur rouge "Aujourd'hui" — colonne courante
- Clamp automatique des barres sur la fenêtre visible
- Filtre : seuls les projets/tâches ayant au moins une date dans les 3 prochains mois apparaissent
- Légende bas de page : statuts projet + statuts tâche + ligne Aujourd'hui
- Clic sur projet ou barre projet → ouvre `ProjectModal`

**Données :** réutilise les appels API existants `GET /users/me/projects` et `GET /users/me/tasks` (aucun endpoint ajouté).

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — composant `MyTimeline`, imports `date-fns`, état `view`, tab toggle

---

### 62. Tâches — durée en heures en plus des jours

**Avant :** Champ `duration_days` uniquement (entier). Pas de notion d'heures.

**Après :** Nouveau champ `duration_hours` (0-23 h) affiché à côté des jours dans le formulaire et les cartes tâche. Affiché sous la forme `Xj Yh`. Le total dans l'en-tête panneau tâches est mis à jour.

**Fichiers modifiés :**
- `server/src/db/init.js` — ajout colonne `duration_hours INTEGER NOT NULL DEFAULT 0` + migration idempotente
- `server/src/controllers/taskController.js` — validation zod, INSERT et UPDATE incluent `duration_hours`
- `client/src/components/Project/ProjectForm.jsx` — champ numérique heures (0-23) à côté des jours, affichage `Xj Yh`, total panneau mis à jour

---

### 63. Calendrier — granularité demi-mois pour les barres Gantt

**Avant :** Le drag des poignées snappait au mois entier (janvier, février…). Impossible de placer une barre sur la mi-mars par exemple.

**Après :** Snap à 0,5 mois — les poignées s'accrochent au 1er ou au 16 de chaque mois. L'en-tête affiche une séparation visuelle (label « 16 ») au milieu de chaque colonne mois.

**Comportement :**
- `dateToHalf` convertit une date en position demi-mois (0,0 = 1er jan, 0,5 = 16 jan, …)
- `halfToStartDate` / `halfToEndDate` reconvertissent vers des dates réelles (jours 1, 15, 16, ou dernier du mois)
- Le déplacement de barre (move) calcule un `deltaDays` précis et le répercute sur les tâches
- Lignes de grille demi-mois en pointillés dans chaque ligne

**Fichiers modifiés :**
- `client/src/components/Calendar/CalendarPage.jsx` — helpers `dateToHalf/halfToStart/halfToEnd/halfStartLabel/halfEndLabel`, `getSpan` renvoie `startHalf`/`endHalf`, `handlePointerMove` snap 0,5, `handlePointerUp` utilise les helpers, en-tête `MonthHeaderCell` divisé en deux moitiés

---

### 64. Mon Espace — KPI taux horaire mensuel

**Avant :** Aucun indicateur de charge horaire.

**Après :** Nouvelle carte KPI violette affichant la somme des heures des tâches actives de l'utilisateur ayant une échéance dans le mois en cours (convention : 1 jour = 8 h + heures explicites).

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — calcul `monthlyHours`, carte KPI conditionnelle

---

### 65. Mon Espace — Chronologie : vue mensuelle avec jours et navigation

**Avant :** Vue fixe sur 3 mois (mois courant + 2 suivants), colonnes en mois entiers sans détail jour.

**Après :** Vue sur 1 mois unique avec :
- Grille jours en en-tête (numéros 1 → 28/30/31)
- Barres positionnées à la journée près
- Navigation ← → entre mois (boutons précédent/suivant)
- Bouton « Aujourd'hui » pour revenir au mois courant
- Marqueur rouge vertical sur la colonne du jour courant (si mois actif)

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — composant `MyTimeline` réécrit, état `viewMonth`, imports `subMonths`, `getDaysInMonth`, `isSameMonth`

---

### 61. Vue Liste — indicateur de statut non interactif

**Avant :** Cercle vide `w-4 h-4 rounded-full border-2` avec `group-hover:border-indigo-400` — suggérait visuellement une case à cocher cliquable.

**Après :** Petit carré plein `w-2.5 h-2.5 rounded-sm` coloré selon le statut (gris/bleu/ambre/vert), sans bord ni comportement au survol. Clairement un indicateur de couleur, pas un contrôle.

**Fichiers modifiés :**
- `client/src/components/List/ListView.jsx` — constante `STATUS_INDICATOR`, remplacement du rond par le carré plein

---

## Lot 21 — Kanban personnel dans Mon Espace (session 21)

### 66. Mon Espace — Onglet Chronologie remplacé par un Kanban de tâches

**Avant :** L'onglet "Chronologie" affichait un diagramme de Gantt mensuel (barres positionnées à la journée sur une grille de jours).

**Après :** L'onglet "Chronologie" affiche un Kanban personnel à 3 colonnes — **À faire**, **En cours**, **Terminé** — listant toutes les tâches assignées à l'utilisateur. Les tâches peuvent être **glissées-déposées** d'une colonne à l'autre (drag & drop via `@dnd-kit/core`).

**Comportement :**
- Chaque carte tâche affiche le titre, les notes (si présentes), le projet d'appartenance et la date d'échéance (en rouge si dépassée)
- Le drag démarre après 8 px de mouvement (souris) ou 200 ms (tactile) pour éviter les faux clics
- Une `DragOverlay` suit le curseur avec une légère rotation pour un effet naturel
- La mise à jour du statut appelle `PATCH /projects/:id/tasks/:taskId/status` (même API qu'avant)
- Les imports `date-fns` inutilisés (Gantt) sont retirés ; `@dnd-kit/utilities` est utilisé pour `CSS.Translate`

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — suppression de `MyTimeline` + `STATUS_BAR` + `TASK_BAR`, ajout de `TaskKanban` + `KanbanColumn` + `DraggableTaskCard`, mise à jour des imports

---

## Lot 22 — Chronologie Gantt Asana-style dans Mon Espace (session 22)

### 67. Mon Espace — Onglet Chronologie : Gantt interactif avec sélecteur de projet

**Avant :** L'onglet "Chronologie" affichait un Kanban de tâches à 3 colonnes (résultat du lot 21).

**Après :** Vue Gantt style Asana avec :
- **Sélecteur de projet** (dropdown) en haut à gauche — remplace le bouton "+ Ajouter une tâche"
- En choisissant un projet, ses tâches s'affichent groupées en 3 sections repliables : **À faire**, **En cours**, **Terminé**
- **Timeline horizontale scrollable** avec en-tête mois + jours numérotés
- **Barres Gantt colorées** par section (cyan = À faire, jaune = En cours, saumon = Terminé)
- **Drag & drop des barres** via pointer events :
  - Poignée gauche → redimensionne `start_date`
  - Zone centrale → déplace toute la barre (les deux dates bougent ensemble)
  - Poignée droite → redimensionne `due_date`
- **Marqueur "Aujourd'hui"** — ligne verticale indigo sur le jour courant
- Navigation ← / Aujourd'hui / → par semaine
- Fenêtre de 70 jours, colonnes de 42 px/jour

**Comportement technique :**
- Drag : `pointermove` / `pointerup` sur `window`, snap au jour via `Math.round(dx / DAY_W)`
- Sauvegarde : `PUT /projects/:id/tasks/:taskId` (taskService.update) on pointerup
- Les dates sont mises à jour optimistiquement dans `localTasks` pendant le drag, puis persistées

**Fichiers modifiés :**
- `client/src/components/MonEspace/MonEspacePage.jsx` — suppression de `TaskKanban`, ajout de `GanttTimeline` + constantes `DAY_W/ROW_H/SEC_H/…`, `handleTaskDatesChange`, mise à jour des imports (`format`, `addDays`, `subDays`, `differenceInDays`, `isSameDay`, `fr`)
