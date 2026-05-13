# MargoPro

Outil de gestion simple pour les petits commerçants d'Afrique francophone.

**Gérez votre stock, calculez vos marges, suivez vos ventes — sans internet.**

---

## Fonctionnalités

- 📦 **Gestion de stock** — Ajoutez vos produits, suivez les quantités, recevez des alertes stock bas
- 💰 **Calculateur de marge** — Glissez un curseur pour voir instantanément votre prix de vente
- 📊 **Suivi des ventes** — Enregistrez vos ventes, consultez votre chiffre d'affaires
- 🏠 **Tableau de bord** — Vos gains du jour, votre stock total, votre meilleur produit

## Points forts

- ✅ Fonctionne sans internet (100% offline)
- ✅ Installable sur l'écran d'accueil (PWA)
- ✅ Interface en français, ultra-simple
- ✅ Mobile-first, grands boutons, grande police
- ✅ Mode sombre disponible

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Dexie.js (IndexedDB)
- PWA (next-pwa)

## Démarrage rapide

```bash
# Installer les dépendances
cd frontend
npm install

# Lancer en développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000)

## Structure du projet

```
MargoPro/
├── frontend/          # Application Next.js PWA
│   ├── app/           # Pages (App Router)
│   ├── components/    # Composants UI
│   └── lib/           # IndexedDB + hooks
├── backend/           # Logique métier TypeScript (pas de serveur)
├── CLAUDE.md          # Contexte pour Claude Code
└── README.md
```

## Déploiement

```bash
cd frontend
npm run build
# Déployer sur Vercel via `vercel deploy`
```

---

Conçu pour les commerçants d'Afrique francophone 🌍
