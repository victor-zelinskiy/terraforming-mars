# Corporation Impact Analyzer — Iteration 13 audit

The corporation is the identity layer of *Terraforming Mars*: it sets the start, may
carry a passive rule and an activatable action, and usually defines a player's whole
plan. This iteration adds a **dedicated corporation-impact system** on top of the
endgame insight engine (Iterations 5–12), so the final report can call out a corporation
that gave a strong start, became an engine, repeated key actions, or merged into a rare
double-corporation strategy — **but only when the corporation genuinely mattered**.

## 1. Architecture (where each piece lives)

| Layer | File | Role |
| --- | --- | --- |
| **Fact (measured)** | `src/common/events/endgameFacts.ts` → `corporationFacts()` + `FactType 'corporationImpact'` | One fact per (owner, corporation) PLAYED, derived **purely from the event stream**: passive engine, active action, owner early-game tempo, `hasAction`. No new server bridge. |
| **Registry (knowledge)** | `src/client/components/endgame/corporationStories.ts` | Hand-authored archetype, starting capital, `hasAction`, dedup target + per-archetype engine prose. Pure (only `CardName`). |
| **Analyzer (story)** | `src/client/components/endgame/insightEngine.ts` → `analyzeCorporationImpact` + family `corporationImpact` + icon `corp` | Combines fact + registry → premium insights (engine / start / action / Merger / underused). Registered in `FACT_ANALYZERS`. |
| **Story DNA** | `gameStoryDna.ts` → story types `merger_story` / `corporation_identity` + `PlayerArc.corporation` | Lets a corporation HEADLINE the game + carries the corp into the player arc. |
| **Explainability** | `insightDetail.ts` → `CLUSTER_DETAIL` (corporation/corporationStart/corporationUnused/merger) + `buildCorporationDetail()` | Hover popovers for corp insight cards + the arc corp chip. |
| **UI** | `tabs/EndgameOverviewTab.vue` + `endgame.less` | Family teal accent + `◈` glyph + the corporation chip in "How the players played". |

**Key design choice — no server bridge was needed.** The event stream already marks
corp events first-class (`source.kind === 'corporation'`), tags passive impacts
(`passive-effect`), and categorises actions (`corporation-action` / `copied-action`).
So passive/action/economy are read with the existing `aggregateBySource` /
`actionStatsBySource` / `aggregateByPlayerGeneration`. Starting CAPITAL is static
reference data in the registry (cross-checked against the manifest by a test). Old games
without a fetched stream degrade gracefully to no corp insights.

## 2. Full corporation audit (39 in-scope + Merger)

`archetype` drives the engine flavour + arc label; `dedup` is the generic insight the
corp story replaces (evidence-key collapse); `cap` = starting M€ (verified vs. manifest);
`act` = has an activatable action.

| Corporation | Expansion | archetype | cap | act | dedup |
| --- | --- | --- | --- | --- | --- |
| Beginner Corporation | base | generalist | 42 | – | – |
| CrediCor | base | capitalStarter | 57 | – | economy |
| EcoLine | base | plantEngine | 36 | – | – |
| Helion | base | energyEngine | 42 | – | economy |
| Interplanetary Cinematics | base | eventTempo | 30 | – | – |
| Inventrix | base | tagFlex | 45 | – | – |
| Mining Guild | base | metalEconomy | 30 | – | – |
| PhoboLog | base | spaceEngine | 23 | – | economy |
| Tharsis Republic | base | cityEngine | 40 | – | – |
| Thorgate | base | energyEngine | 48 | – | economy |
| UN Mars Initiative | base | terraformEngine | 40 | ✓ | action |
| Saturn Systems | corpera | spaceEngine | 42 | – | – |
| Teractor | corpera | discountHouse | 60 | – | economy |
| Arcadian Communities | promo | cityEngine | 40 | ✓ | – |
| Astrodrill | promo | cardResourceEngine | 35 | ✓ | action |
| Factorum | promo | actionEngine | 37 | ✓ | action |
| Pharmacy Union | promo | terraformEngine | 54 | – | – |
| Philares | promo | cityEngine | 47 | – | – |
| Mons Insurance | promo | disruption | 48 | – | – |
| Recyclon | promo | cardResourceEngine | 38 | – | – |
| Splice | promo | cardResourceEngine | 44 | – | – |
| Tycho Magnetics | promo | actionEngine | 42 | ✓ | action |
| Kuiper Cooperative | promo | spaceEngine | 33 | ✓ | action |
| PolderTech Dutch | promo | cityEngine | 35 | – | – |
| Aridor | colonies | tagFlex | 40 | – | – |
| Arklight | colonies | cardResourceEngine | 45 | – | – |
| Polyphemos | colonies | capitalStarter | 50 | – | economy |
| Poseidon | colonies | colonyEngine | 45 | – | colony |
| Stormcraft Inc. | colonies | cardResourceEngine | 48 | ✓ | action |
| Aphrodite | venus | terraformEngine | 47 | – | – |
| Celestic | venus | cardResourceEngine | 42 | ✓ | action |
| Manutech | venus | metalEconomy | 35 | – | – |
| Morning Star Inc. | venus | tagFlex | 50 | – | – |
| Viron | venus | actionEngine | 48 | ✓ | action |
| Cheung Shing Mars | prelude | discountHouse | 44 | – | economy |
| Point Luna | prelude | cardFlow | 38 | – | – |
| Robinson Industries | prelude | actionEngine | 47 | ✓ | action |
| Valley Trust | prelude | discountHouse | 37 | – | economy |
| Vitor | prelude | generalist | 48 | – | – |
| **Merger** (prelude) | promo | — special — | — | — | grants a SECOND corporation |

## 3. Report against the spec's required points

1. **Audited corporations** — all 39 in-scope + Merger (table above). Guarded by
   `corporationStories.spec.ts` (coverage + manifest cross-check of every cap & `hasAction`).
2. **Exact analyzers** — none are hard-coded per card; every corp routes through ONE
   `analyzeCorporationImpact` driven by its registry `archetype` (17 archetype headlines)
   + measured fact. This is "per-card knowledge" via data, not a switch.
3. **Family / generic analyzers** — the 17 archetypes ARE the families. An out-of-scope /
   unregistered corp with strong measured impact gets a generic `corp.generic.*` insight.
4. **Missing data bridges** — **none required.** Corp passive/action/economy are already
   in the stream; starting capital is static reference data (registry). Documented so the
   next expansion just widens the registry, not the recorder.
5. **Not given special insight (by design)** — Beginner Corporation & Vitor (`generalist`)
   only fire if their measured impact crosses the same thresholds; a corp whose effect is
   a non-measurable flag (Helion heat-as-M€, Inventrix requirement flex) tells a story
   only through its measured economy, never a bare "had a flag".
6. **Start impact** — registry `startingMegacredits` + the fact's `earlyValue`
   (owner generation 1–3 measured economy/gains). The "fast start" insight fires for a
   capital archetype ONLY when backed by measured early tempo (no fake causality).
7. **Passive impact** — `aggregateBySource(passive-effect events)` keyed to the corp →
   triggers, saved M€, resources, production, card-resources, TR, draws.
8. **Action impact** — `actionStatsBySource` (category `corporation-action`/`copied-action`)
   → activations + output. Viron's copies count as activations (its story is repetition).
9. **Merger** — a player with ≥2 corporations → a rare `corp.merger.*` insight; "both
   pulled their weight" vs "only one carried", hero-worthy for the winner, story type
   `merger_story` (uniqueness 0.9), suppresses the single-corp angles.
10. **Player arcs** — `PlayerArc.corporation` (name + archetype label + realized:
    carried/start/underused/merged/present + hover detail) rendered in "How the players played".
11. **Duplicate suppression** — the corp insight adopts the generic's evidence key
    (`economy:<player>` / `colony` / `actionEngine|<player>`) so evidence-dedup keeps the
    richer corp card and demotes the redundant generic economy/colony/action card.
12. **Tests** — `tests/events/corporationFacts.spec.ts` (6), `corporationStories.spec.ts`
    (4 incl. manifest cross-check), `corporationInsights.spec.ts` (7). All green; no
    regressions across 133 endgame + 109 events specs.
13. **Honesty** — no fabricated VP/M€; mixed-unit values are `partial` confidence;
    underused is surfaced only for a near-loss (never a toxic "you misplayed"); lore-led
    prose written fresh (no copyrighted flavour text).

## 4. Remaining frontier (Iteration 14+)

- **Per-corporation bespoke flavour** — every corp currently shares its archetype headline
  (its NAME is in the prose, so it still reads bespoke); a handful of marquee corps could
  get a dedicated `flavorKey` for extra polish.
- **Merger arc shows only the primary corp** (the merger INSIGHT names both); the arc could
  show both corp names.
- **Flag-only corps** (Helion heat-as-M€, Inventrix/Morning Star requirement flex) have no
  measurable signal — they'd need a dedicated server signal to tell a richer story.
- **Expansion scope** — widen `CORPORATION_REGISTRY` (and the coverage test's `IN_SCOPE`
  list) when Turmoil / Moon / Pathfinders / CEOs / etc. enter scope.
