# Appareils connectés — sélection unique au lieu de boutons par ligne

**Date :** 2026-07-10
**Statut :** Approuvé
**Contexte :** évolution de [2026-07-01-gestion-appareils-design.md](2026-07-01-gestion-appareils-design.md)

## Problème

Chaque appareil affichait son propre bouton "Gérer" qui se dépliait en 3 boutons (Annuler/Supprimer/Bloquer) sur la ligne. Avec plusieurs appareils, ça devient encombrant visuellement.

## Design

- Les lignes d'appareils non-courants deviennent tapables pour **sélectionner** un seul appareil à la fois (état radio, pas multi-sélection). Retaper la ligne sélectionnée la désélectionne.
- La ligne sélectionnée est mise en surbrillance (fond `T.accentLight`, bordure `T.accent`) avec une coche.
- Une **barre d'action unique** apparaît sous la liste, uniquement quand un appareil est sélectionné :
  - Si l'appareil sélectionné est bloqué → bouton **Débloquer** (pas de confirmation, réversible)
  - Sinon → boutons **Bloquer** et **Supprimer** (avec confirmation avant action, comme avant)
- Après action réussie, la sélection est réinitialisée.
- L'appareil courant reste non-sélectionnable (badge "Cet appareil", pas d'action possible dessus).

## Ce qui change dans le code

- `frontend/components/Appareils.tsx` : remplacer le bouton "Gérer" par ligne + état `confirmingId` par un état `selectedId` (sélection) + une barre d'action globale sous la liste. La logique métier (`handleBlock`, `handleUnblock`, `handleDelete`) reste identique, seule l'UI de déclenchement change.
