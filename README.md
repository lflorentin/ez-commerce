# ez-commerce

Boutique de démonstration en français pour des parcours d’achat en France métropolitaine. Le catalogue reprend des références de marques réelles. Les prix, promotions, délais, stocks, points relais et visuels sont illustratifs.

[Boutique en ligne](https://ez-commerce-lovat.vercel.app/) · [Maquette Figma](https://www.figma.com/design/1CfTaMmuyNpIsB7NVQBbdJ) · [Projet Vercel](https://vercel.com/lf-lorentin/ez-commerce) · [Conditions de vente et préparation commerciale](docs/conditions-de-vente.md)

## Fonctionnalités

- Catalogue de 10 références, recherche sans distinction d’accents, filtres par catégorie, budget, délai, promotion et stock, et tri par prix ou note.
- Six sélections d’événements, activées par le calendrier français. La page d’accueil met en avant la collection de Noël pendant sa période.
- Compte avec cookie de session, panier invité dans le navigateur et panier persistant après identification. Historique des commandes et solde fidélité.
- Fiches avec descriptif, référence fabricant, note agrégée, avis d’acheteurs vérifiés, partage WhatsApp, partage natif et copie du lien pour Instagram.
- Livraison à domicile ou en point relais de démonstration. Prévisualisation de l’adresse avec Google Maps Embed si la clé est configurée. Un lien vers Maps reste disponible en l’absence de clé.
- Stripe Checkout **en environnement de test**, avec confirmation serveur. Un simulateur explicite permet d’essayer la commande sans compte Stripe.

### Règles commerciales

| Règle | Valeur |
| --- | --- |
| Livraison à domicile | 5,49 € |
| Point relais de démonstration | 4,79 € |
| Remise sur le port | 25 % si le sous-total des articles dépasse strictement 20 €, avant crédit fidélité |
| Fidélité | 5 € de crédit par tranche de 100 € effectivement payés en articles, hors livraison |
| Prix, délais et paiement | Montants recalculés en centimes côté serveur. Délais estimés affichés au panier. Les conditions acceptées sont versionnées. |

Ces frais s’inspirent des [tarifs publics Colissimo pour un colis de 250 g](https://www.laposte.fr/tarif-colissimo). Le forfait est un choix de démonstration.

## Démarrer en local

Node.js 24 et npm sont nécessaires. Au premier démarrage le serveur crée une base PostgreSQL locale embarquée et charge les références.

```bash
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:5173, ajouter un article, créer un compte avec des données fictives, choisir un mode de livraison et cliquer sur « Simuler le paiement ». La commande confirmée permet de donner un avis depuis la fiche produit. Un panier de 3 casques à 34,99 € débloque 5 € de crédit. Les données locales sont conservées dans `.data/postgres`.

```bash
npm test
npm run build
```

La suite utilise une base éphémère. Elle couvre le seuil de livraison, le calendrier et un parcours HTTP intégrant le filtrage, l’authentification, le contrôle d’origine, l’isolation des paniers, le stock, la fidélité et les avis. Elle vérifie également la signature, la cohérence du montant et la répétition des webhooks Stripe sur une base de test.

## Architecture

| Composant | Responsabilité |
| --- | --- |
| React / Vite | Interface, navigation, panier invité et formulaires |
| `/api/auth` | Inscription, connexion, session et profil |
| `/api/catalog` | Catalogue, filtres, événements et avis |
| `/api/cart` | Panier persistant avec contrôle du stock |
| `/api/orders` | Commandes, réservation de stock, livraison, fidélité et Stripe |
| PostgreSQL / PGlite local | Persistance, contraintes, index et transactions |

Les quatre fonctions Node.js sont des points d’entrée déployés séparément par Vercel au sein du même projet. Elles partagent PostgreSQL pour que la commande, le stock, le panier et la fidélité restent cohérents dans la même transaction. Une séparation complète par base et par cycle de déploiement nécessiterait des contrats réseau et un mécanisme de compensation des opérations distribuées.

### Mesures de sécurité

Mots de passe dérivés avec scrypt et sel distinct, jetons aléatoires stockés sous forme d’empreinte, cookie HttpOnly, SameSite et Secure sur Vercel, contrôle de l’origine sur les mutations, validation des entrées, limitation des tentatives avec PostgreSQL, requêtes paramétrées, vérification de propriété, transactions de stock et de fidélité, politique CSP et autres en-têtes HTTP. Stripe reçoit les données de carte sur sa page hébergée. La confirmation vérifie la signature du webhook, la devise, le montant et la session avant de marquer la commande comme payée.

Pour héberger les données, utiliser une base de test dédiée en région UE avec TLS vérifié, une connexion de migration distincte et un rôle d’exécution limité à la lecture et aux écritures applicatives. Le code inclut des mesures de défense, sans certification de sécurité ou de conformité réglementaire. Avant une ouverture publique réelle, prévoir audit, vérification d’e-mail/récupération de compte, supervision, politique de conservation, modération et opérations de retour/remboursement.

## Déploiement Vercel et CI

Le dépôt contient `vercel.json` et le workflow GitHub Actions `.github/workflows/ci.yml`. Relier le dépôt dans **Vercel → Settings → Git** pour activer les déploiements Git automatiques. Les poussées sur `main` construisent la version de production et les autres branches alimentent les aperçus suivant les paramètres Vercel. Le build Vercel exécute aussi les tests. Les runners GitHub et les déploiements suivent les quotas de chaque plan. Le plan Vercel Hobby est destiné aux projets personnels non commerciaux.

| Variable | Configuration |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL dédiée à l’environnement, de préférence un pool TLS vérifié. Exécuter `npm run db:migrate` avec les droits de migration avant ouverture. |
| `DEMO_PAYMENT` | `true` active la simulation si Stripe Test est absent. |
| `PUBLIC_ORIGIN` | Origine HTTPS canonique pour un domaine personnalisé. Pour les domaines gérés par Vercel, les variables système de déploiement sont utilisées. |
| `STRIPE_SECRET_KEY` | Clé serveur Stripe commençant par `sk_test_`. |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature de l’endpoint `/api/orders?action=webhook`. Activer `checkout.session.completed` et `checkout.session.expired`. |
| `VITE_GOOGLE_MAPS_EMBED_KEY` | Clé de navigateur restreinte aux domaines du site et à Maps Embed API. Elle est intégrée au build. |

Sans PostgreSQL, le catalogue en ligne reste consultable avec les données initiales et les opérations de compte ou de commande sont indisponibles. Pour tester Stripe localement, utiliser Stripe CLI pour relayer le webhook au serveur et récupérer son secret de signature. Sur un déploiement protégé, Stripe doit pouvoir joindre l’endpoint webhook. Utiliser des variables et une base distinctes pour l’aperçu.

Sources techniques : [Déploiements Git Vercel](https://vercel.com/docs/git) · [Stripe Checkout et traitement de la commande](https://docs.stripe.com/checkout/fulfillment) · [Google Maps Embed](https://developers.google.com/maps/documentation/embed/quickstart).
