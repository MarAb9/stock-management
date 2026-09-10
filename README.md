# Gestion de stock — CSL Berkane

Application interne pour les consommables, équipements, mouvements et inventaires du Conseil Scientifique Local de Berkane.

## Démarrage

1. Démarrer Docker Desktop, puis lancer `docker compose up --build -d`.
2. Exécuter `docker compose exec backend php artisan migrate --seed`.
3. Lancer l’interface avec `cd frontend; npm start`.
4. Ouvrir `http://localhost:4200`.

Compte local : `admin@csl-berkane.local` / `change-me-local`. Définir `LOCAL_ADMIN_EMAIL` et `LOCAL_ADMIN_PASSWORD` avant le seed pour changer ces identifiants.

## Règles métier

`stock_movements` est immuable. `stock_balances` est la projection opérationnelle par produit, emplacement et lot. Les sorties et transferts s’exécutent dans une transaction verrouillée et refusent un stock négatif. Un inventaire validé génère des ajustements traçables.

## Vérifications

- `cd frontend; npm run build`
- `docker compose exec backend php artisan migrate --seed`
- `docker compose exec backend php artisan test`

Les PDF d’état de stock, bons de mouvement et procès-verbaux sont exposés par l’API; le CSV d’état est compatible Excel.
