# Turmoil Redux — milestones & awards

The Redux box prints its own milestones and awards. They are implemented one by one; this file is the registry and
the checklist each next one follows.

## Registry

| Name | Kind | Rule (printed) | Status |
| --- | --- | --- | --- |
| **Activist** | milestone | Advance your Agenda marker at least 3 steps from its starting position (i.e. to the step that gives you 2 Influence). | DONE 2026-11-05 — `src/server/milestones/turmoilRedux/Activist.ts` |
| Influencer | award | — | not started (the glossary already reserves its star icon, § 4a) |

## Activist — the decisions

- **Score = `Parliament.agendaOf(player)`.** Every marker starts OFF the track at 0 (`Parliament.agenda`), so the
  position IS the steps walked — by any engine (sitting winner, chairman quest, a card, a law: all `ChairmanSeat.walkAgenda`).
  Threshold 3 = the second influence step (`influenceAtAgenda(3) === 2`). A table without a Parliament reads 0.
- **Pools:** `compatibility: 'turmoilRedux'`, `random: 'both'` — offered by LIMITED / UNLIMITED / ALL, with or without
  `modularMA`, whenever Redux is on; never under classic Turmoil (the two are mutually exclusive) or without a Parliament.
  NOT forced into the fixed (NONE) board sets — those stay the official layouts (the fork's Ares precedent).
- **Synergy:** `Activist ↔ T. Politician = 4` (Career steps come mostly from winning sittings, which delegates buy).
  No exclusion group — they are not one scoring vector.
- **MarsBot:** its marker walks the same track, so `getScore` is honestly its player metric (the default «unchanged»
  branch of `AutomaMAEvaluation`). Today it never reaches a bot table: a MarsBot game draws no random MAs
  (`automaConflicts` → `rule:randomMilestonesAwards`). If a Redux MA ever lands in a fixed bot set, add it to
  `PLAYER_METRIC` in `tests/automa/AutomaMilestoneNormalization.spec.ts`.
- **RU:** «Активист» (the key `Activist` moved from `console.json` — the underworld resource name, same value — into
  `milestones.json`, so the pool guard reads it); the condition speaks the glossary (§ 4: «маркер Карьеры», never «Повестка»).
- **Art:** `assets/ma/activist.png` + its `maArtFit.json` entry (43dda30819) — the slug is derived from the name.

## Checklist for the next Redux milestone / award

1. Class in `src/server/milestones/turmoilRedux/` (or `src/server/awards/turmoilRedux/`) reading the ENGINE's own number.
2. Name in `MilestoneName.ts` / `AwardName.ts` under `// Turmoil Redux` — it must equal the art slug's source.
3. Manifest row: `compatibility: 'turmoilRedux'`, `random: 'both'`.
4. Synergy rows / an exclusion group only when a real overlap exists (`MilestoneAwardSynergies.ts`, `MilestoneAwardExclusions.ts`).
5. RU name + condition in `src/locales/ru/milestones.json` / `awards.json` — grep the exact key in all of `src/locales/ru/` first
   (the build throws on a duplicate). `tests/ma/MilestoneAwardDeduplication.spec.ts` checks the Redux pool's RU names
   and conditions separately (`RANDOM_POOLS`).
6. Spec under `tests/milestones/turmoilRedux/` (or `tests/awards/…`); extend the Redux case in `tests/ma/MilestoneAwardSelector.spec.ts`.
7. Icon: `assets/ma/<slug>.png` + `scripts/measure-ma-art.ps1` → `maArtFit.json`.
