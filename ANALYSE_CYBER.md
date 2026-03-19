# Analyse de sécurité — IT Project Tracker

## Note globale : 5 / 10

Application fonctionnelle avec une base saine, mais déployée sans couche de sécurité réseau et avec plusieurs points de fragilité à corriger avant mise en production réelle.

---

## Points positifs

| Domaine | Constat |
|---|---|
| Mots de passe | Hachage bcrypt (coût adapté) |
| Authentification | JWT signé, stocké côté client |
| Autorisation | RBAC appliqué côté serveur sur chaque route |
| Requêtes SQL | Prepared statements partout — pas d'injection SQL possible |
| Validation des entrées | Schémas Zod sur toutes les routes mutantes |
| Isolation des données | Les membres ne voient que leur pôle (filtrage serveur) |

---

## Vulnérabilités et faiblesses identifiées

### Critique

**1. Pas de HTTPS**
Le trafic (tokens JWT, mots de passe) transite en clair sur le réseau. Un attaquant sur le même segment réseau peut intercepter les credentials.
> Mitigation : reverse proxy nginx ou Traefik avec certificat TLS (Let's Encrypt ou certificat interne).

**2. JWT sans rotation ni révocation**
Les tokens n'expirent pas (ou expirent tardivement) et il n'existe pas de mécanisme de blacklist. Un token volé reste valide jusqu'à son expiration.
> Mitigation : durée d'expiration courte (15–30 min) + refresh token httpOnly, stockage en DB pour révocation.

---

### Élevé

**3. Pas de rate limiting**
Les routes `/auth/login` et toutes les routes API sont exposées sans limite de débit. Brute force de mots de passe possible.
> Mitigation : `express-rate-limit` sur `/auth/login` (ex. 10 tentatives / 15 min par IP), rate limit global sur l'API.

**4. Absence de headers de sécurité HTTP**
Pas de `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`.
> Mitigation : middleware `helmet` (npm) à ajouter en une ligne dans `app.js`.

**5. Secrets en clair dans le code / environnement**
Le secret JWT est défini dans les variables d'environnement sans rotation ni gestion sécurisée (pas de vault).
> Mitigation : utiliser un gestionnaire de secrets (HashiCorp Vault, Docker Secrets, ou variable injectée par CI/CD), documenter la rotation.

---

### Modéré

**6. Pas de protection CSRF**
L'API accepte les requêtes cross-origin sans vérification d'origine stricte. Combiné à l'absence de cookie httpOnly, le risque est limité mais réel si le JWT passe en cookie.
> Mitigation : valider l'en-tête `Origin` ou utiliser un token CSRF si les cookies sont adoptés.

**7. Journalisation insuffisante**
L'`activity_log` ne trace que les actions métier (création, commentaire). Les tentatives d'authentification échouées, les accès refusés (403) et les erreurs serveur ne sont pas loggés avec l'IP source.
> Mitigation : logger les événements de sécurité (échecs auth, 403, 500) dans un fichier séparé ou un service centralisé (ex. Loki, ELK).

**8. Dépendances non auditées**
Aucun processus d'audit des dépendances npm n'est en place.
> Mitigation : `npm audit` dans la CI, ou `Dependabot` sur le dépôt Git.

**9. Pas de timeout de session**
Une session ouverte reste active indéfiniment si l'onglet reste ouvert.
> Mitigation : inactivité détectée côté client (ex. 30 min) + révocation du token côté serveur.

**10. Base SQLite accessible en clair**
Le fichier `.db` n'est pas chiffré. Un accès au volume Docker suffit pour lire toutes les données.
> Mitigation : chiffrement SQLite (SQLCipher), ou migration vers PostgreSQL avec authentification dédiée.

---

## Recommandations prioritaires (roadmap sécurité)

### Court terme (avant mise en production)
1. Activer HTTPS via reverse proxy (nginx + certificat)
2. Ajouter `helmet` dans `app.js`
3. Ajouter `express-rate-limit` sur la route de login
4. Réduire la durée de vie du JWT (< 1h)

### Moyen terme
5. Implémenter refresh token httpOnly + révocation
6. Brancher un LDAP / Active Directory pour centraliser l'authentification et supprimer la gestion locale des mots de passe
7. Mettre en place `npm audit` en CI
8. Logger les événements de sécurité vers un système centralisé

### Long terme
9. Chiffrement du volume de données (SQLCipher ou migration PostgreSQL)
10. Mise en place d'un scanner SAST (ex. Semgrep) sur le pipeline CI
11. Audit de sécurité externe avant extension à d'autres équipes

---

## Conclusion

Le projet constitue une base solide pour un usage interne en réseau de confiance (LAN d'entreprise). Il ne doit **pas** être exposé directement sur Internet sans avoir au minimum appliqué les recommandations "court terme" ci-dessus. L'intégration LDAP/SSO est fortement conseillée pour éviter la gestion de mots de passe locaux, principale surface d'attaque de l'application.
