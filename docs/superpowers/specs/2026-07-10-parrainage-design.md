# Programme de parrainage / affiliation — Design Spec

**Date :** 2026-07-10
**Statut :** Approuvé

## Contexte

MargoPro est sur le point d'être officiellement lancé. La landing page (`eidma-landing`, repo séparé) a déjà un lien "Affiliation" dans le menu (pointant vers `#affiliation`) mais la section n'existe pas encore. Objectif : un programme de parrainage pour faire connaître MargoPro, ouvert à deux publics.

## Objectif

Permettre à deux types de personnes de gagner une récompense en recommandant MargoPro :

1. **Abonnés** (ont déjà l'app) — au choix : 1 mois gratuit tous les 4 filleuls payants, OU 15% de commission récurrente
2. **Non-abonnés** (n'ont pas l'app, ex: influenceurs, connaissances) — 15% de commission récurrente uniquement

## Ce qu'on ne construit pas (V1)

- Détection automatique du paiement du filleul (FedaPay pas encore branché) — Juanita coche manuellement chaque mois
- Versement automatique des commissions (Mobile Money/Moov Money manuel par Juanita)
- Interface d'administration dédiée dans l'app — gestion directe via l'éditeur de tables Supabase
- Auto-inscription immédiate des non-abonnés — validation manuelle via WhatsApp pour commencer (l'automatiser est un axe futur si le volume grandit)
- Toute intégration au 4ᵉ onglet de la page Marges — le parrainage vit uniquement dans Paramètres, aucun fichier de Marges n'est touché

## Règles métier

| | Abonnés | Non-abonnés |
|---|---|---|
| Récompense | Choix à l'inscription : mois gratuit OU commission | Commission uniquement |
| Mois gratuit | 1 mois offert tous les 4 filleuls devenus payants (one-time, cumulable) | — |
| Commission | 15% du montant payé par le filleul, chaque mois, **plafonné à 12 mois par filleul** | Identique |
| Déclencheur | Juanita coche "payant ce mois" pour chaque filleul, manuellement | Identique |
| Versement | Mobile Money/Moov Money par Juanita. Seuil : si le solde d'un affilié atteint **15 000 FCFA**, versement dès que possible ; sinon versement du solde accumulé en fin de mois, quel que soit le montant | Identique |
| Obtention du code | Généré automatiquement dans l'app (Paramètres → Parrainage) | Formulaire WhatsApp sur la landing page → Juanita valide et envoie le code manuellement |
| Suivi | Page de suivi publique par code, sans compte requis | Identique |

---

## Architecture

### Tables Supabase

```sql
create table if not exists public.affiliates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  nom          text not null,
  contact      text not null,
  type         text not null check (type in ('abonne', 'non_abonne')),
  user_id      uuid references auth.users(id) on delete set null,
  recompense   text check (recompense in ('mois_gratuit', 'commission')),
  mois_gratuits_accordes integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists affiliates_user_id_idx on public.affiliates(user_id);

create table if not exists public.parrainages (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references public.affiliates(id) on delete cascade,
  filleul_nom      text not null,
  filleul_contact  text,
  filleul_user_id  uuid references auth.users(id) on delete set null,
  code_utilise     text not null,
  date_inscription timestamptz not null default now()
);
create index if not exists parrainages_affiliate_id_idx on public.parrainages(affiliate_id);

create table if not exists public.parrainage_paiements (
  id                 uuid primary key default gen_random_uuid(),
  parrainage_id      uuid not null references public.parrainages(id) on delete cascade,
  mois               text not null,           -- format 'YYYY-MM'
  montant_paye       numeric not null,        -- montant payé par le filleul ce mois-là
  commission_versee  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (parrainage_id, mois)
);
```

**RLS :**

```sql
alter table public.affiliates enable row level security;
alter table public.parrainages enable row level security;
alter table public.parrainage_paiements enable row level security;

-- Un abonné gère sa propre ligne affilié
create policy "affiliates_owner" on public.affiliates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lecture publique par code (nécessaire pour la page de suivi, sans login) —
-- l'app ne sélectionne que code/nom/mois_gratuits_accordes, jamais `contact`
create policy "affiliates_public_read" on public.affiliates
  for select using (true);

-- Lecture publique des parrainages/paiements rattachés à un affilié (page de suivi)
create policy "parrainages_public_read" on public.parrainages
  for select using (true);
create policy "parrainage_paiements_public_read" on public.parrainage_paiements
  for select using (true);

-- Écriture (nouveau filleul) réservée à l'utilisateur qui vient de s'inscrire,
-- pour rattacher son propre user_id
create policy "parrainages_insert_self" on public.parrainages
  for insert with check (auth.uid() = filleul_user_id);

-- parrainage_paiements : aucune policy insert/update publique — Juanita gère
-- via l'éditeur Supabase (accès service role, ignore RLS)
```

`parrainage_paiements` n'est donc jamais modifié par l'app, seulement par Juanita via l'éditeur de tables Supabase.

La commission d'un filleul se calcule à l'affichage : `somme(montant_paye × 15%)` sur les 12 premières lignes de `parrainage_paiements` (triées par mois), moins ce qui a déjà `commission_versee = true`.

Le mois gratuit se calcule à l'affichage : `nombre de parrainages avec au moins 1 paiement` ÷ 4, arrondi en dessous — comparé à `mois_gratuits_accordes` pour savoir si un nouveau mois gratuit est dû.

### Attribution du filleul au bon affilié

`eidma-landing` (`index.html`) et `margopro.eidma.co` sont deux origines différentes → pas de `localStorage` partagé.

1. Un visiteur arrive sur `eidma.co/?ref=CODE`. Un petit script JS lit le paramètre `ref` et l'ajoute en query string à tous les liens CTA ("Commencer gratuitement") de la page, vers `https://margopro.eidma.co/onboarding?ref=CODE`.
2. L'onboarding MargoPro lit `ref` dans l'URL et le stocke dans `localStorage` (`margo_referral_code`) jusqu'à la création du compte.
3. Une fois le compte créé (premier `SIGNED_IN`), si `margo_referral_code` existe : upsert d'une ligne `parrainages` (recherche de l'`affiliate` par `code`, `filleul_user_id` = nouvel utilisateur). Le `localStorage` est nettoyé après.
4. Si le code n'existe pas (invalide/expiré), on ignore silencieusement — pas d'erreur bloquante pour l'inscription.

---

## Interface

### Landing page (`eidma-landing`)

Nouvelle section `#affiliation` :
- Explication courte du programme (mois gratuit ou commission pour les abonnés, commission pour tous)
- Formulaire WhatsApp pour les non-abonnés : nom + numéro → envoie un message WhatsApp pré-rempli à Juanita (même pattern que la section avis), qui valide et transmet le code manuellement

### App MargoPro — Paramètres

Nouvelle section **"Parrainage"**, sous "Appareils connectés" :
- Génère automatiquement un code au premier affichage (si l'abonné n'en a pas encore)
- Choix de la récompense (mois gratuit / commission) — modifiable
- Affiche le code + lien de partage (WhatsApp)
- Lien vers la page de suivi publique

### Page de suivi publique

Nouvelle page sur `eidma-landing`, ex. `eidma.co/parrainage.html?code=CODE` (pas de login) :
- Liste des filleuls et leur statut (en attente / payant)
- Solde de commission actuel (si récompense = commission)
- Progression vers le prochain mois gratuit (si récompense = mois gratuit)

---

## Gestion des erreurs

- **Code de parrainage invalide/inexistant à l'inscription :** ignoré silencieusement, l'inscription continue normalement.
- **Page de suivi avec un code inconnu :** message "Code introuvable."
- **Génération du code dans Paramètres échoue (réseau) :** message d'erreur, réessai au prochain affichage de la section.

---

## Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `frontend/lib/parrainage.ts` | Génération/lecture du code affilié, calcul du solde de commission et de la progression mois gratuit |
| `frontend/components/Parrainage.tsx` | Section Paramètres — code, choix récompense, lien de suivi |
| `eidma-landing/parrainage.html` | Page de suivi publique par code |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/app/parametres/page.tsx` | Ajout de `<Parrainage />` sous Appareils connectés |
| `frontend/app/onboarding/page.tsx` | Capture du `ref` depuis l'URL, upsert du parrainage après inscription |
| `eidma-landing/index.html` | Section `#affiliation` + script de propagation du `ref` sur les liens CTA |

## SQL de mise en place (Supabase)

Voir les blocs SQL des sections Architecture et RLS ci-dessus — à exécuter dans Supabase → SQL Editor.
