# CLAUDE.md

> **Priorité absolue : Sécurité > Clarté du plan > Autonomie d'exécution**
> Interdiction de modifier ce fichier sans validation explicite de l'utilisateur.
> Interdiction de sortir du dossier pour lire ou modifier des fichiers en dehors du projet/Dossier et sous-dossier en cours.

---

## Contexte Projet
- **Stack :** *(Next.js 15, TypeScript, Prisma, SQlite)*
- **Tests :** *(a revoir)*
- **Conventions :** *(à compléter : ex. camelCase, composants dans /components, API dans /app/api)*
- **Fichiers critiques :** *(à compléter : ex. schema.prisma, .env.local, middleware.ts)*
- **Docker : l'ensemble du projet doit être construit dans l'idée qu'il va être déployer via docker.**

## Project Overview

**IT Project Tracker** — A self-hosted, Docker-containerized Kanban web app for a small IT team (< 10 people) split into two poles: Dev and Network. The project is currently in the **specification phase** — see `/PROJECT.md` for the full technical blueprint and `/CAHIER_DES_CHARGES.md` for business requirements.


---

## Interdictions Absolues
- Ne jamais modifier `package.json` sans demande explicite
- Ne jamais supprimer de fichier sans confirmation de l'utilisateur
- Ne jamais commit sur `main` directement
- Ne jamais ignorer un test échoué en le supprimant ou en le commentant
- Ne jamais modifier ce fichier `CLAUDE.md` sans validation

---

## Langue
- **Réponses et explications :** français
- **Code (variables, commentaires, messages de commit) :** anglais

---

## Orchestration de Workflow

### 1. Mode Plan par Défaut
- Entrer en mode plan pour TOUTE tâche non triviale (3+ étapes ou décisions architecturales)
- Si quelque chose déraille, STOPPER et re-planifier immédiatement — ne pas continuer à forcer
- Utiliser le mode plan pour les étapes de vérification, pas seulement pour la construction
- Rédiger des spécifications détaillées en amont pour réduire l'ambiguïté

**Déclencher le mode plan si :**
- Modification d'un fichier de config ou de schema
- Nouvelle dépendance à installer
- Refactoring touchant > 2 fichiers
- Toute opération irréversible (migration DB, suppression de données)

### 2. Stratégie de Sous-agents
- Utiliser les sous-agents généreusement pour garder la fenêtre de contexte principale propre
- Déléguer la recherche, l'exploration et l'analyse parallèle aux sous-agents
- Pour les problèmes complexes, mobiliser davantage de ressources de calcul via les sous-agents
- Une tâche par sous-agent pour une exécution ciblée
- Ne pas utiliser les sous-agents pour les tâches simples (< 5 min d'exécution estimée)

### 3. Boucle d'Auto-Amélioration
- Après TOUTE correction de l'utilisateur : mettre à jour `tasks/modifs.md` avec le schéma
- Écrire des règles pour soi-même afin d'éviter la même erreur
- Itérer sans relâche sur ces leçons jusqu'à ce que le taux d'erreur diminue
- Relire les leçons au début de chaque session pour le projet concerné

### 4. Vérification Avant Clôture
- Ne jamais marquer une tâche comme terminée sans prouver qu'elle fonctionne
- Comparer le comportement entre la version principale et ses modifications si pertinent
- Se demander : *"Un ingénieur senior approuverait-il cela ?"*
- Lancer les tests, vérifier les logs, démontrer la correction

### 5. Exiger l'Élégance (Équilibrée)
- Pour les changements non triviaux : faire une pause et demander *"existe-t-il une approche plus élégante ?"*
- Si un correctif semble bricolé : *"En sachant tout ce que je sais maintenant, implémenter la solution élégante"*
- Ignorer cette étape pour les correctifs simples et évidents — ne pas sur-ingénierer
- Remettre en question son propre travail avant de le présenter
- **Critère concret :** si un changement touche plus de 3 fichiers non liés, stopper et re-planifier

### 6. Correction de Bugs Autonome
- Face à un rapport de bug : le corriger directement, sans demander à être guidé
- Pointer vers les logs, erreurs, tests échoués — puis les résoudre
- Zéro changement de contexte requis de la part de l'utilisateur
- Aller corriger les tests CI échoués sans qu'on explique comment

---

## Gestion des Tâches

1. **Planifier d'abord** : Rédiger le plan dans `tasks/todo.md` avec des éléments cochables
2. **Valider le plan** : Vérifier avant de commencer l'implémentation
3. **Suivre la progression** : Marquer les éléments comme terminés au fur et à mesure
4. **Expliquer les changements** : Résumé de haut niveau à chaque étape
5. **Documenter les résultats** : Ajouter une section de revue dans `tasks/modifs.md`
6. **Capitaliser les leçons** : Mettre à jour `tasks/lessons.md` après les corrections

---

## Protocole de Fin de Session
Avant de terminer toute session, toujours :
1. Mettre à jour `tasks/todo.md` (éléments restants et nouveaux)
2. Écrire un résumé de l'état courant dans `tasks/context.md`
3. Committer les changements avec un message conventionnel (`feat:`, `fix:`, `refactor:`, etc.)

---

## Principes Fondamentaux
- **Simplicité avant tout** : Rendre chaque changement aussi simple que possible. Impact minimal sur le code.
- **Pas de paresse** : Trouver les causes profondes. Pas de correctifs temporaires. Standards d'un développeur senior.
- **Impact minimal** : Les changements ne doivent toucher que ce qui est nécessaire. Éviter d'introduire des bugs.