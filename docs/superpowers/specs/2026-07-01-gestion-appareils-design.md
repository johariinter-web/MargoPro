# Gestion des appareils connectés — Design Spec

**Date :** 2026-07-01  
**Statut :** Approuvé

## Contexte

MargoPro permet à plusieurs personnes de partager le même compte (email + mot de passe). Le propriétaire veut savoir quels appareils ont accès à son compte et pouvoir bloquer un appareil suspect (ex : un gérant malveillant qui a partagé les identifiants avec un tiers).

## Objectif

Offrir au propriétaire une vue **"Appareils connectés"** dans les Paramètres : liste de tous les appareils ayant accédé au compte, date de dernière activité, et possibilité de bloquer ou débloquer chaque appareil.

## Ce qu'on ne construit pas

- Approbation manuelle des nouveaux appareils avant accès
- Limite de nombre de sessions simultanées
- Notifications push lors d'une nouvelle connexion
- Nommage manuel des appareils par l'utilisateur

---

## Architecture

### Table Supabase — `device_sessions`

```sql
CREATE TABLE device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  device_name  TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_blocked   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, device_id)
);
```

**RLS :**
- `SELECT` : `auth.uid() = user_id`
- `INSERT` : `auth.uid() = user_id`
- `UPDATE` : `auth.uid() = user_id`

### Identifiant d'appareil — `localStorage`

Clé : `margo_device_id`  
Valeur : UUID v4 généré au premier lancement de l'app, jamais effacé.

Si l'utilisateur efface son `localStorage` ou utilise un nouveau navigateur, un nouveau `device_id` est généré → l'appareil apparaît comme nouveau dans la liste.

### Nom d'appareil — auto-généré

Généré depuis `navigator.userAgent` au premier enregistrement. Format : `"[Plateforme] · [Navigateur]"`.

Exemples :
- `"iPhone · Safari"`
- `"Samsung · Chrome"`
- `"Windows · Firefox"`
- `"Android · Chrome"`

Fallback : `"Appareil inconnu"` si le user agent n'est pas reconnu.

---

## Comportement au démarrage de l'app

Déclenché dans le layout principal, après confirmation que l'utilisateur est connecté (session Supabase active).

**Séquence :**

1. Lire `margo_device_id` depuis `localStorage`. Si absent, générer un UUID v4 et le stocker.
2. Vérifier dans Supabase si `device_sessions` contient une ligne avec ce `device_id` et `is_blocked = true`.
3. **Si bloqué :** appeler `supabase.auth.signOut()` et afficher un écran d'erreur : _"Cet appareil a été bloqué par le propriétaire du compte. Contactez-le pour rétablir l'accès."_
4. **Si non bloqué :** upsert silencieux dans `device_sessions` :
   - `device_name` : généré si nouvelle ligne, conservé si existant
   - `last_seen_at` : `now()`
   - `is_blocked` : inchangé

Le upsert utilise `onConflict: 'user_id, device_id'` pour ne créer qu'une ligne par appareil.

---

## Interface — Paramètres

Nouvelle section **"Appareils connectés"** dans la page `/parametres`, après les paramètres existants.

### Liste des appareils

Chaque ligne affiche :
- Icône selon la plateforme (📱 mobile, 💻 desktop)
- Nom de l'appareil
- Badge **"Cet appareil"** si `device_id` correspond à l'appareil actuel
- Badge **"Bloqué"** (rouge) si `is_blocked = true`
- Date de dernière activité (format relatif : "Actif maintenant", "Il y a 2 jours", etc.)
- Bouton **"Bloquer"** pour les appareils actifs non-courants
- Bouton **"Débloquer"** pour les appareils bloqués

L'appareil actuel n'a pas de bouton d'action (on ne peut pas se bloquer soi-même).

### Bloquer un appareil

1. L'utilisateur appuie sur "Bloquer"
2. Dialogue de confirmation : _"Bloquer cet appareil ? Il sera déconnecté et ne pourra plus accéder au compte."_
3. Confirmation → `UPDATE device_sessions SET is_blocked = true WHERE id = ?`
4. La ligne se met à jour avec le badge "Bloqué" et le bouton "Débloquer"

### Débloquer un appareil

1. L'utilisateur appuie sur "Débloquer"
2. Pas de confirmation (action réversible)
3. `UPDATE device_sessions SET is_blocked = false WHERE id = ?`
4. La ligne revient à l'état normal avec le bouton "Bloquer"

---

## Nouveaux fichiers

| Fichier | Rôle |
|---|---|
| `frontend/lib/deviceSession.ts` | Logique : générer/lire `device_id`, générer `device_name`, vérifier blocage, upsert heartbeat |
| `frontend/components/Appareils.tsx` | Composant liste des appareils pour la page Paramètres |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/app/layout.tsx` (ou `RootLayout`) | Appel au check de blocage + heartbeat au démarrage |
| `frontend/app/parametres/page.tsx` | Ajout de la section "Appareils connectés" avec `<Appareils />` |

---

## Gestion des erreurs

- **Supabase indisponible au démarrage :** ne pas bloquer le démarrage de l'app. Si la vérification de blocage échoue (réseau absent), l'appareil garde son accès — offline-first oblige.
- **Supabase indisponible dans Paramètres :** afficher un message "Impossible de charger les appareils. Vérifiez votre connexion."
- **Erreur de blocage/déblocage :** toast d'erreur, état de la liste non modifié.

---

## SQL de mise en place (Supabase)

```sql
-- Table
CREATE TABLE IF NOT EXISTS device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  device_name  TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_blocked   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, device_id)
);

-- Index pour les lectures fréquentes
CREATE INDEX IF NOT EXISTS device_sessions_user_id_idx ON device_sessions(user_id);

-- RLS
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sessions_select" ON device_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "device_sessions_insert" ON device_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_sessions_update" ON device_sessions
  FOR UPDATE USING (auth.uid() = user_id);
```
