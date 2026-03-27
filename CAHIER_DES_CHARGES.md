# Cahier des Charges — Application de Suivi de Projets IT

**Version :** 1.0  
**Date :** Mars 2026  
**Statut :** Proposition initiale  
**Destinataires :** Équipe IT (Pôle Dev + Pôle Réseau)

---

## 1. Contexte et Objectifs

### 1.1 Contexte

L'équipe IT est composée de moins de 10 personnes, réparties en deux pôles :
- **Pôle Développement** — suivi des projets applicatifs, sprints, livraisons
- **Pôle Réseau** — suivi des projets d'infrastructure, incidents, évolutions

Chaque pôle dispose d'un **responsable** qui pilote la charge et l'avancement des projets. Actuellement, le suivi repose sur des outils disparates (tableurs, emails, tickets ad hoc) qui ne favorisent pas la visibilité transversale ni la collaboration fluide.

### 1.2 Objectif Principal

Fournir une **application web légère, auto-hébergée et conteneurisée** permettant à l'ensemble de l'équipe de créer, visualiser, prioriser et mettre à jour des projets IT de façon simple et intuitive.

### 1.3 Objectifs Secondaires

- Réduire le temps passé à chercher l'état d'un projet
- Permettre aux responsables de pôle de gérer les priorités par glisser-déposer
- Centraliser les informations dans un outil unique, sans dépendance à un service SaaS externe
- Faciliter les points hebdomadaires et les revues de charge

---

## 2. Périmètre Fonctionnel

### 2.1 Gestion des Projets

| Fonctionnalité | Description |
|---|---|
| Création de projet | Formulaire rapide : titre, description, pôle, responsable, priorité, statut |
| Modification de projet | Édition inline ou modale, accessible en un clic |
| Suppression de projet | Avec confirmation, archivage optionnel |
| Duplication de projet | Pour les projets récurrents ou similaires |
| Affichage en cartes | Vue Kanban par statut (Backlog / En cours / En attente / Terminé) |

### 2.2 Organisation et Navigation

| Fonctionnalité | Description |
|---|---|
| Drag & Drop | Déplacer les cartes entre colonnes de statut et entre les pôles |
| Filtres | Par pôle, par responsable, par priorité, par tag |
| Recherche | Recherche textuelle instantanée sur le titre et la description |
| Tri | Manuel (D&D) ou automatique (par priorité, date) |

### 2.3 Gestion des Utilisateurs

| Fonctionnalité | Description |
|---|---|
| Rôles | Admin, Responsable de pôle, Membre |
| Authentification | Login/mot de passe (pas d'OAuth requis initialement) |
| Périmètre de visibilité | Tous les projets sont visibles par tous les membres |
| Permissions | Seuls les responsables et admins peuvent modifier les statuts et priorités |

### 2.4 Détail d'un Projet

Chaque projet dispose d'une fiche contenant :
- Titre
- Description (texte enrichi léger)
- Pôle (Dev / Réseau)
- Responsable assigné
- Membres impliqués
- Priorité (Critique / Haute / Normale / Basse)
- Statut (Backlog / En cours / En attente / Terminé)
- Date de création et dernière modification
- Date cible / échéance
- Tags libres
- Commentaires / journal d'activité

### 2.5 Tableau de Bord

- Vue d'ensemble de tous les projets par pôle
- Indicateurs rapides : nombre de projets actifs, terminés, en retard
- Filtre rapide par pôle (Dev / Réseau / Tous)

---

## 3. Options d'Architecture Technique

Trois approches sont envisageables selon le niveau de complexité souhaité et les compétences disponibles dans l'équipe.

---

### Option A — Stack Légère (Recommandée pour démarrer vite)

**Technologies :** React + Node.js/Express + SQLite  
**Conteneurisation :** Image Docker unique (mono-conteneur)

**Avantages :**
- Déploiement en une seule commande `docker run`
- Aucune dépendance externe (pas de base de données séparée)
- Fichier SQLite portable, sauvegarde triviale
- Idéal pour une équipe < 10 personnes avec trafic faible

**Inconvénients :**
- Scalabilité limitée (non pertinent ici)
- SQLite peu adapté à une montée en charge future

**Structure Docker :**
```
image unique :
  ├── Frontend React (build statique servi par Express)
  ├── API Express
  └── SQLite (volume monté)
```S
---


> **Recommandation :** Démarrer avec l'**Option A** pour avoir rapidement un outil fonctionnel, puis migrer vers l'**Option B** si le projet prend de l'ampleur ou si une sauvegarde plus robuste est requise.

---

## 4. Contraintes Techniques

### 4.1 Déploiement
- L'application doit être **entièrement conteneurisée via Docker**
- Accessible depuis un navigateur web standard (Chrome, Firefox, Edge)
- Port configurable (défaut : 3000 ou 8080)
- Pas de dépendance à Internet en production

### 4.2 Persistance des données
- Les données doivent **survivre aux redémarrages** du conteneur (volumes Docker) et doivent être mappé dans le /opt/dockerS
- Un mécanisme d'export simple (JSON ou CSV) est souhaitable

### 4.3 Interface
- **Responsive** : accessible sur desktop, compatible tablette
- **Drag & Drop natif** fluide sur les cartes de projets
- Thème clair avec possibilité d'un thème sombre
- Temps de chargement initial < 2 secondes

### 4.4 Sécurité
- Authentification par session (JWT ou cookie sécurisé)
- Pas d'accès sans authentification
- HTTPS recommandé via reverse proxy (Nginx ou Traefik) si exposé hors réseau local

---

## 5. Exigences Non Fonctionnelles

| Exigence | Cible |
|---|---|
| Disponibilité | 99% sur le réseau local |
| Temps de réponse | < 500ms pour les actions courantes |
| Nombre d'utilisateurs simultanés | < 10 |
| Langue de l'interface | Français |
| Navigateurs supportés | Chrome 110+, Firefox 110+, Edge 110+ |

---

## 6. Phases de Développement Suggérées

### Phase 1 — MVP (2–3 semaines)
- Authentification simple
- CRUD Projets
- Vue Kanban avec D&D
- Filtres de base (pôle, statut)

### Phase 2 — Enrichissement (2–3 semaines)
- Fiche projet détaillée (commentaires, historique)
- Gestion des rôles (admin, responsable, membre)
- Tags et recherche
- Notifications visuelles (badge, indicateur de retard)

### Phase 3 — Finition & Déploiement (1–2 semaines)
- Thème sombre
- Export de données
- Documentation utilisateur
- Image Docker finale publiée sur le registry interne

---

## 7. Livrables Attendus

- [ ] Code source versionné (Git)
- [ ] `Dockerfile` et `docker-compose.yml`
- [ ] Script d'initialisation de la base de données
- [ ] Documentation d'installation (`README.md`)
- [ ] Document de base du projet (`PROJECT.md`)
- [ ] Guide utilisateur succinct

---

## 8. Questions Ouvertes à Trancher

1. **Option technique** : A, B ou C ? (voir section 3)
2. **Authentification** : login/mot de passe local suffit-il, ou faut-il envisager une intégration LDAP/AD ?
3. **Notifications** : email ou uniquement dans l'interface ?
4. **Visibilité des projets** : les projets d'un pôle sont-ils visibles par l'autre pôle ?
5. **Historique** : faut-il un journal d'audit des modifications ?
6. **Hébergement** : sur quel serveur/VM sera déployé Docker ? Linux, Windows Server ?

---

*Document rédigé le 10 mars 2026. À valider avec les responsables de pôle Dev et Réseau avant démarrage du développement.*
