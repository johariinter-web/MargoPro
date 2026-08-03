# Abonnement Premium — intégration FedaPay

**Date :** 2026-08-02
**Statut :** Approuvé
**Contexte :** MargoPro distingue déjà un plan gratuit (max 5 produits) et un plan Premium (`config.isPremium`, `frontend/lib/hooks/usePlan.ts`), mais rien ne permet de payer réellement : le bouton "Renouveler" dans `/abonnement` affiche juste une modale "Bientôt disponible". `isPremium` existe comme simple champ de config synchronisé comme n'importe quel autre — rien ne l'empêche aujourd'hui d'être modifié côté client sans jamais passer par un vrai paiement.

## Problème

- `frontend/app/abonnement/page.tsx` : bouton "Renouveler (+30 jours)" → modale "Bientôt disponible", aucun paiement réel déclenché.
- `frontend/lib/hooks/usePlan.ts` : `computePlanStatus` lit `config.isPremium` / `config.trialStart`, mais rien dans le code ne positionne jamais `isPremium` à `true` — ce chemin n'existe simplement pas encore.
- Aucune trace de FedaPay dans le code. `flutterwave-react-v3` est présent dans `frontend/package.json` mais n'est référencé nulle part (`grep` vide) — dépendance morte à retirer.
- MargoPro n'a aujourd'hui aucune route serveur HTTP (principe affiché du projet : "Pas de backend HTTP dans le MVP"). Le statut Premium ne peut pas reposer uniquement sur ce que dit l'appareil du client — sinon n'importe qui pourrait se donner Premium en modifiant ses données locales avant synchronisation. Une petite route serveur devient donc nécessaire, strictement limitée au paiement (première exception documentée au principe "pas de backend").
- FedaPay n'offre pas de véritable abonnement récurrent invisible pour le Mobile Money (vérifié dans leur documentation) : même un prélèvement déclenché par notre serveur envoie une demande de confirmation (code PIN) sur le téléphone du client. « Automatique » veut donc dire : le client n'a rien à ouvrir ni cliquer dans MargoPro, mais doit tout de même confirmer sur son téléphone au moment du prélèvement.

## Design

### Vue d'ensemble du flux

1. **Premier paiement / renouvellement manuel** — Le client ouvre `/abonnement`, clique "Renouveler". L'app appelle une route serveur (`POST /api/paiement/creer`) qui crée une transaction FedaPay avec la clé secrète (jamais exposée au client), avec le montant fixe et l'identifiant Supabase du client en métadonnée personnalisée. La route renvoie un jeton de paiement ; l'app ouvre FedaPay Checkout (widget hébergé par FedaPay — Mobile Money, Wave, carte) avec ce jeton. Le client paie.
2. **Confirmation** — FedaPay notifie une route webhook (`POST /api/webhooks/fedapay`) du changement de statut. Le webhook ne fait jamais confiance au contenu reçu : il vérifie la signature FedaPay, puis effectue toujours une requête directe à l'API FedaPay pour lire le vrai statut de la transaction (recommandation de sécurité de FedaPay elle-même — ne jamais se fier à un statut transmis en clair). Si le statut confirmé est "approuvé" : met à jour dans Supabase le compte du client identifié par la métadonnée — `isPremium = true`, `premiumExpiresAt = maintenant + 30 jours`.
3. **Renouvellement automatique** — Une tâche planifiée quotidienne (Vercel Cron, `GET /api/cron/renouvellement`) recherche les comptes Premium dont `premiumExpiresAt` est atteint et qui ont un client FedaPay enregistré (créé au premier paiement), puis déclenche un prélèvement direct Mobile Money (`sendNow`) vers ce client. Celui-ci reçoit une demande de confirmation sur son téléphone (code PIN), sans avoir besoin d'ouvrir MargoPro. La confirmation est traitée exactement comme à l'étape 2, par le même webhook.
4. **Échec ou non-confirmation** (refus, oubli, solde insuffisant) — Rien ne se passe côté MargoPro : pas de Premium accordé. `isPremium` redevient effectivement inactif dès que `premiumExpiresAt` est dépassé (vérifié par `usePlan.ts` à chaque ouverture de l'app — aucune action serveur nécessaire pour "désactiver"). Le client peut relancer un paiement manuel à tout moment via "Renouveler" (étape 1). Le réseau Mobile Money informe déjà le client en cas de solde insuffisant (SMS opérateur) ; pas de notification MargoPro dédiée dans cette version.

### Sécurité

- Créer une transaction (`/api/paiement/creer`) exige une session Supabase valide — déjà garanti par le verrou d'authentification du 2026-07-28 (`frontend/middleware.ts`), qui protège aussi les futures routes `/api/*` puisqu'elles ne sont pas dans la liste des chemins publics.
- Le webhook vérifie la signature FedaPay (secret dédié, différent des clés API) avant tout traitement, puis revérifie systématiquement le statut réel de la transaction auprès de l'API FedaPay — jamais uniquement sur la base du contenu du webhook ou d'un paramètre d'URL.
- Les 3 nouvelles routes serveur sont les seules exceptions au principe "pas de backend" du projet — strictement scopées au paiement, pas de serveur permanent (fonctions Vercel).

### Prix et configuration

- 3500 FCFA/mois — défini une seule fois dans le code (constante), jamais répété en dur.
- Clés FedaPay (publique + secrète) et secret webhook en variables d'environnement Vercel — jamais commit dans le code ni partagées dans la conversation.
- Mode test à privilégier si Juanita obtient ses clés sandbox du support FedaPay (démarche en cours) ; sinon, test prudent en mode réel avec un montant minimal avant ouverture à de vrais clients — décision à reconfirmer avec elle au moment de coder si le sandbox n'est toujours pas disponible.

### Hors scope pour cette version (décisions déjà prises)

- Rappel par email avant renouvellement automatique — pas de service d'email dans le projet actuellement, cadrage séparé prévu après coup.
- Notification MargoPro dédiée en cas d'échec de paiement — le SMS de l'opérateur Mobile Money suffit pour cette version.

## Ce qui change dans le code

- **Nouveau** `frontend/app/api/paiement/creer/route.ts` — crée la transaction FedaPay pour l'utilisateur connecté (session Supabase requise), renvoie le jeton de paiement.
- **Nouveau** `frontend/app/api/webhooks/fedapay/route.ts` — vérifie la signature FedaPay, revérifie le statut réel auprès de l'API FedaPay, met à jour `isPremium` / `premiumExpiresAt` dans Supabase pour le client concerné.
- **Nouveau** `frontend/app/api/cron/renouvellement/route.ts` + configuration Vercel Cron (déclenchement quotidien) — repère les abonnements à échéance et déclenche le prélèvement Mobile Money automatique.
- **Modifié** `frontend/app/abonnement/page.tsx` — bouton "Renouveler" branché sur `/api/paiement/creer` + FedaPay Checkout, au lieu de la modale "Bientôt disponible".
- **Modifié** `frontend/lib/hooks/usePlan.ts` et le type de config — nouveau champ `premiumExpiresAt` (distinct de `dateAbonnement`, qui aujourd'hui ne sert qu'à l'affichage d'un compteur de 30 jours indépendant du vrai statut Premium — cette confusion existante n'est pas corrigée dans ce chantier au-delà de l'ajout du bon champ).
- **Supprimé** dépendance `flutterwave-react-v3` de `frontend/package.json` (jamais utilisée dans le code).

## Étape manuelle (hors code)

- Juanita configure l'URL du webhook dans le tableau de bord FedaPay (section Webhooks) une fois le code déployé — adresse exacte fournie à ce moment-là.
- Juanita ajoute les clés FedaPay (publique, secrète) et le secret webhook dans les variables d'environnement Vercel.
- Migration Supabase pour ajouter `premiumExpiresAt` (et un identifiant client FedaPay) à la table `config` — écrite avec le plan d'implémentation, exécutée par Juanita comme d'habitude.
- Juanita confirme l'obtention (ou non) de clés FedaPay sandbox auprès du support avant le début du codage.
