# MargoPro — Contexte du projet

## Qu'est-ce que MargoPro ?

MargoPro est un outil de gestion simple pour les petits commerçants d'Afrique francophone. Il permet de gérer son stock, calculer ses marges, suivre ses ventes et visualiser ses performances — sans internet, depuis un téléphone.

## Cible utilisateur

Commerçants informels (épiceries, boutiques, marchés) en Afrique francophone. Peu ou pas de formation comptable. Utilisent WhatsApp et Wave au quotidien. Connexion internet instable ou inexistante.

## Stack technique

- **Frontend** : Next.js 15 App Router, TypeScript, Tailwind CSS, PWA (next-pwa)
- **Stockage** : IndexedDB via Dexie.js — 100% local, zéro backend serveur
- **Backend** : Module TypeScript pur (`backend/`) — logique métier importée directement par le frontend, pas de serveur HTTP
- **Déploiement** : Vercel (frontend uniquement)

## Architecture

```
MargoPro/
├── frontend/     # Next.js PWA
│   ├── app/      # Pages (App Router)
│   ├── components/
│   └── lib/      # IndexedDB + hooks React
├── backend/      # Logique métier pure TypeScript (pas de serveur)
├── CLAUDE.md
└── README.md
```

## Principes de développement

- **Offline-first** : tout fonctionne sans internet. IndexedDB est la source de vérité.
- **Mobile-first** : min 32px pour les données clés, boutons min 48px, pas de menus cachés
- **Ultra-simple** : maximum 4 champs par formulaire, termes simples en français
- **Pas de jargon** : "bénéfice" pas "résultat net", "stock" pas "inventaire"

## Identité visuelle

| Élément | Valeur |
|---|---|
| Couleur principale | Vert émeraude `#059669` (emerald-600) |
| Fond | Blanc cassé `#FAFAF9` (stone-50) |
| Alertes | Orange vif `#F97316` (orange-500) |
| Texte clé | min 32px (`text-2xl`) |
| Boutons | min 48px hauteur |
| Mode sombre | Supporté via `dark:` Tailwind |

## Fonctionnalités MVP

1. **Gestion de stock** — Ajouter/modifier/supprimer des produits (nom, qté, prix achat, prix vente). Alerte si stock < seuil.
2. **Calculateur de marge** — Prix achat + curseur marge → prix de vente en temps réel. Mode inverse possible.
3. **Suivi des ventes** — Enregistrer une vente, historique jour/semaine/mois, CA et bénéfice.
4. **Tableau de bord** — 3 chiffres en grand : gains du jour, stock total, meilleur produit.

## Configuration utilisateur

Au premier lancement, l'utilisateur configure :
- Nom de son commerce
- Devise (FCFA XOF, FCFA XAF, GNF, CDF, MGA, MAD...)

Ces données sont stockées dans IndexedDB table `config`.

## Commandes utiles

```bash
# Démarrer le dev
cd frontend && npm run dev

# Build production
cd frontend && npm run build

# Vérifier les types
cd frontend && npm run type-check
```

## À ne pas faire

- Pas de backend HTTP dans le MVP (tout est local)
- Pas de compte utilisateur (pas d'auth)
- Pas de synchronisation cloud (v2)
- Pas de texte < 16px
- Pas de menus hamburger
