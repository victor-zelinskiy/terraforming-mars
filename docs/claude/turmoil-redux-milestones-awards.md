# Turmoil Redux — milestones & awards

The Redux box prints its own milestones and awards. They were implemented one by one; this file is the registry and
the checklist a further one follows. **The series is CLOSED (2026-11-06): 3 milestones + 2 awards, all in every random
pool under Redux.**

## Registry

| Name | Kind | Rule (printed) | Status |
| --- | --- | --- | --- |
| **Activist** | milestone | Advance your Agenda marker at least 3 steps from its starting position (i.e. to the step that gives you 2 Influence). | DONE 2026-11-05 — `src/server/milestones/turmoilRedux/Activist.ts` |
| **Aeronaut** | milestone | Have a combined 4 fighter or mech resources across your cards. | DONE 2026-11-06 — `src/server/milestones/turmoilRedux/Aeronaut.ts` |
| **Dataminer** | milestone | Have 7 data resources across your cards. | DONE 2026-11-06 — `src/server/milestones/turmoilRedux/Dataminer.ts` |
| **Influencer** | award | Furthest on the Agenda track. | DONE 2026-11-06 — `src/server/awards/turmoilRedux/Influencer.ts` |
| **Politologist** | award | Highest number of cards with a party requirement. (Event cards count.) | DONE 2026-11-06 — `src/server/awards/turmoilRedux/Politologist.ts` |

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

## Aeronaut — the decisions

- **Score = `getResourceCount(FIGHTER) + getResourceCount(MECH)`** — the engine's count on the player's cards (Farmer's
  reading); either kind alone reaches 4. Declares `cardResourceCount = [FIGHTER, MECH]`, so a fighter / mech gain is never
  «for nothing» while the milestone is live (`models/actionFutility.ts`).
- **Pools:** `compatibility: 'turmoilRedux'` (fighters are base, mechs exist only under Redux), `random: 'both'`.
- **Synergy:** `Aeronaut ↔ Excentric = 5` (the most resources on cards — Hoverlord's weight). No exclusion group.
- **RU:** «Аэронавт» · «Имейте на ваших картах в сумме не менее 4 истребителей и мехов» (`Fighter` → истребитель, `Mech` → мех).
- **Art:** `assets/ma/aeronaut.png` + `maArtFit.json` (631c56d9eb).

## Dataminer — the decisions

- **Score = `getResourceCount(DATA)`**, threshold 7; declares `cardResourceCount = [DATA]` (Aeronaut's shape).
- **Pools:** `compatibility: 'turmoilRedux'`, `random: 'both'`. **Synergy:** `Dataminer ↔ Excentric = 5`. No exclusion group.
- **RU:** «Датамайнер» · «Имейте на ваших картах не менее 7 единиц данных» (the RU cards say «единицы данных»).
- **Art:** `assets/ma/dataminer.png` + `maArtFit.json` (ed674abe47).

## Influencer — the decisions

- **Score = `Parliament.agendaOf(player)`** — the award twin of Activist (same marker, same reading); 0 without a Parliament.
- **Pools:** `compatibility: 'turmoilRedux'`, `random: 'both'`.
- **Never beside Activist:** both sit in the random exclusion group `agenda-track` (`MilestoneAwardExclusions.ts`) —
  a milestone and an award for the same marker would be one race scored twice. Synergy `Activist ↔ Influencer = 9`
  (Terraformer ↔ Benefactor's weight) and `Influencer ↔ T. Politician = 4` (Activist's).
- **RU:** «Карьерист» (the track is «Карьера» — glossary § 4) · «Дальше всех продвинутый маркер Карьеры».
- **Art:** `assets/ma/influencer.png` + `maArtFit.json` (4dce233d2d).

## Politologist — the decisions

- **Score = played cards with `hasPartyRequirement`** — the ONE reading of «a card with a party requirement»
  (`cards/requirements/partyRequirementCards.ts`: a `party`-kind requirement of any party; chairman / party leaders /
  delegates on resolutions / influence are other kinds). `playedCards` holds the events pile too, so «(Event cards
  count)» is the plain count; a card in hand never counts.
- **Pools:** `compatibility: 'turmoilRedux'`, `random: 'both'`. No exclusion group — a party requirement is a SUBSET of
  «a requirement», not the same vector; synergy `Politologist ↔ Forecaster = 6` (LIMITED's ceiling — the pair stays
  possible), `↔ Tactician = 5`, `↔ T. Politician = 3`.
- **RU:** «Политолог» · «Наибольшее количество карт с требованием партии (события тоже считаются)».
- **Art:** `assets/ma/politologist.png` + `maArtFit.json` (3453186363).

## Checklist for a further Redux milestone / award

1. Class in `src/server/milestones/turmoilRedux/` (or `src/server/awards/turmoilRedux/`) reading the ENGINE's own number.
2. Name in `MilestoneName.ts` / `AwardName.ts` under `// Turmoil Redux` — it must equal the art slug's source.
3. Manifest row: `compatibility: 'turmoilRedux'`, `random: 'both'`.
4. Synergy rows / an exclusion group only when a real overlap exists (`MilestoneAwardSynergies.ts`, `MilestoneAwardExclusions.ts`).
5. RU name + condition in `src/locales/ru/milestones.json` / `awards.json` — grep the exact key in all of `src/locales/ru/` first
   (the build throws on a duplicate). `tests/ma/MilestoneAwardDeduplication.spec.ts` checks the Redux pool's RU names
   and conditions separately (`RANDOM_POOLS`).
6. Spec under `tests/milestones/turmoilRedux/` (or `tests/awards/…`); extend the Redux case in `tests/ma/MilestoneAwardSelector.spec.ts`.
7. Icon: `assets/ma/<slug>.png` + `scripts/measure-ma-art.ps1` → `maArtFit.json`.
