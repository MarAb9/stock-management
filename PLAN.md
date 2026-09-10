# Plan d’implémentation

Le projet existant utilise Angular 21 (composants standalone), Laravel 13, Sanctum et DomPDF. Les migrations couvrent produits, lots, soldes, mouvements, équipements et inventaires. Aucun dépôt Git n’est initialisé dans ce workspace.

1. Fiabiliser le moteur commun : décimales exactes, lots appartenant au produit, expiration, FEFO réparti sur plusieurs lots, conservation des mouvements, audit transactionnel et contraintes PostgreSQL.
2. Fiabiliser l’inventaire par emplacement et lot : verrouillage, comptages complets, ajustements liés à la session, refus des validations répétées ou devenues obsolètes.
3. Compléter les équipements : affectation, transfert, retour, maintenance et historique consultable.
4. Compléter les référentiels, fichiers privés, paramètres institutionnels, documents et rapports filtrables.
5. Relier les écrans aux opérations réelles : création/modification, recherche et pagination serveur, formulaires, erreurs, confirmations, états vides et navigation mobile.
6. Sécuriser l’accès avec Sanctum et sessions HttpOnly, CSRF, limitation des tentatives et audit sans secrets.
7. Vérifier migrations, règles métier, parcours Angular, PDF, build et configuration de déploiement. Documenter les résultats mesurés et les limites.

Les dépendances existantes sont conservées. Laravel Boost est ajouté uniquement au développement conformément à `backend/AGENTS.md`. Les données d’essai restent séparées de la configuration de production.
