# Milestone / Award random-pool de-duplication audit (vize1215 fork)

Production-quality pass over the random milestones/awards pool. Goal: a random
game must read as a **curated** set — never two elements that share a Russian
name, never two that reward the same thing, and no untranslated names.

## TL;DR — the mechanism

The fix is **systemic**, not a patch for two names:

1. **`src/server/ma/MilestoneAwardExclusions.ts`** — the single source of truth.
   Milestones/awards are grouped by their *scoring vector* (what you must build to
   score them). The random selector picks **at most one MA per group**, so a
   random game can never offer two MAs that chase the same engine. This is the
   primary guard (metadata, not text).
2. **`Accumulator` in `MilestoneAwardSelector.ts`** — rejects any candidate whose
   exclusion group is already represented. Applies to **every random mode**
   (LIMITED / UNLIMITED / ALL / modular / Hollandia fallback). The official
   fixed/NONE board layouts bypass the Accumulator and are untouched.
3. **Russian renames** so every *poolable* MA has a unique Russian name, except
   the few same-effect pairs that are in one exclusion group (and therefore never
   co-occur). Russian-name uniqueness is the UX fallback, enforced by the
   regression test — not a runtime check.
4. **Deprecated clones** — exact/near-exact duplicate definitions are dropped from
   the pool entirely (kept in the manifest for save compatibility).
5. **`tests/ma/MilestoneAwardDeduplication.spec.ts`** — regression guard.

Stable ids, save/replay compatibility, English names, and all fixed boards are
unchanged. Only Russian translations + random-pool metadata changed.

---

## 1. What was found

### Duplicate Russian names among *poolable* milestones/awards

| RU name | Members (type) | English | Effect | Verdict |
| --- | --- | --- | --- | --- |
| **Торговец** | Tradesman (M), Merchant (M), Trader (M) | Tradesman / Merchant / Trader | card-resource variety / 2 of each standard resource / card-resource variety | Trader = clone of Tradesman; Merchant is different |
| **Зоолог** | A. Zoologist (A), Zoologist (A) | A. Zoologist / Zoologist | animal+microbe resources / animal resources | near-duplicate (subset/superset) |
| **Производитель** | Producer (M), A. Manufacturer (A), Manufacturer (A) | Producer / A. Manufacturer / Manufacturer | total production / most blue cards / steel+heat production | three different effects |
| **Инженер** | Engineer (M), A. Engineer (A) | Engineer / A. Engineer | energy+heat production / cards that alter production | different effects |
| **Агроном** | Agronomist (M), Cultivator (A) | Agronomist / Cultivator | plant tags / greenery tiles | different effects |
| **Магнат** | Magnate (A), Mogul (A) | Magnate / Mogul | most green cards / most non-M€ production | different effects |
| **Коллекционер** | T. Collector (M), Collector (A) | T. Collector / Collector | 3 sets of green/blue/red cards / most resource-type variety | different effects |
| **Планировщик** | Landshaper (M), Landscaper (A) | Landshaper / Landscaper | 1 city+1 greenery+1 special tile / largest connected tile group | different effects |
| **Кузнец** | Smith (M), Blacksmith (A) | Smith / Blacksmith | steel+titanium production / most steel+titanium production | same vector |
| **Электрик** | V. Electrician (M), Electrician (A) | V. Electrician / Electrician | power tags / most power tags | same vector |
| **Политик** | T. Politician (A), Politician (A) | T. Politician / Politician | most delegates / party leaders+influence | related (turmoil politics) |
| **Пионер** | Rim Settler (M), Pioneer (M) | Rim Settler / Pioneer | Jovian tags / colonies | different effects |
| **Фермер** | Forester (M, *deprecated*), Farmer (M) | Forester / Farmer | plant production / animal+microbe resources | "Фермер" was a misnomer for Farmer |

> The task mentioned 2× ТОРГОВЕЦ and 2× ЗООЛОГ. The audit found **13 collision
> groups** in total (ТОРГОВЕЦ is actually 3×), plus same-effect/different-name
> duplicates below — so the fix is generic, not hard-coded to two names.

### Same-effect, *different* Russian name (would still make a flat random set)

These pairs reward the identical vector even though their names differ — they
should not co-occur in a random game:

- `Smith` ≈ `Metallurgist` ≈ `Blacksmith` ≈ `Miner` — steel+titanium engine.
- `Gardener` / `Cultivator` — greenery tiles.
- `Builder` / `Contractor` — building tags; `Researcher` / `Scientist` — science
  tags; `Ecologist` / `Biologist` — bio tags; `Terran` / `Investor` — Earth tags;
  `Spacefarer` / `V. Spacefarer` / `Space Baron` — space tags; etc.
- `Legend` / `Promoter` — events; `Tactician` / `Forecaster` — requirement cards;
  `Sponsor` / `Celebrity` — expensive cards; `Planner` / `Visionary` — cards in
  hand; `Networker` / `Entrepreneur` — adjacency-bonus tiles; `Coastguard` /
  `Estate Dealer` — ocean-adjacent tiles; `Edgedancer` / `Suburbian` — edge tiles;
  `Mayor` / `Metropolist` — cities; `Pioneer` / `Colonizer` — colonies;
  `Fundraiser` / `Banker` — M€ production; `Firestarter` / `Thermalist` — heat;
  `C. Forester` / `Botanist` — plant production; `Producer` / `Mogul` — broad
  production; `Tunneler` / `Excavator` — underground tokens; the moon and Jovian
  pairs; etc.

### Exact clones leaking into the pool

- `Metallurgist` (6 steel+titanium production) is a threshold clone of `Smith` (7).
- `Trader` (card-resource variety) is an effect clone of `Tradesman` (same +
  corruption bonus).
- `Terraformer` and `Tycoon` (the classic versions) were replaced on Tharsis /
  Elysium by `Terraformer29` / `Tycoon10`, but left with **no board home and no
  `random` field** they slipped through the LIMITED candidate filter — so LIMITED
  mode could offer *two* terraform-rating or *two* project-card milestones.

### Untranslated names (showed up in Latin in the Russian client)

`Terraformer29`, `Tycoon10` (the canonical Tharsis/Elysium milestones!),
`Purifier`, `Risktaker`, `Tunneler`, `Excavator`, `Kingpin`, `Rugged`, and the
`Farmer` description had **no Russian translation at all**. (`Terraformer29` /
`Tycoon10` are saved by the digit-stripping fallback in the overlays, but the raw
name leaked elsewhere; explicit keys were added.)

---

## 2. Root cause per conflict

- **Different official elements, unlucky identical translation** — most cross-type
  pairs (Агроном, Магнат, Коллекционер, Планировщик, Инженер, Производитель,
  Пионер). Root cause: the Russian translator reused a generic word.
- **Subset/superset near-duplicate** — Зоолог (Zoologist ⊂ A. Zoologist).
- **Threshold/effect clone** — Trader↔Tradesman, Metallurgist↔Smith,
  Terraformer↔Terraformer29, Tycoon↔Tycoon10 (fork's clone-collapse left the base
  variant orphaned).
- **Misnomer** — Farmer ("Фермер") actually scores animal+microbe resources, not
  plants.
- **Fork regression** — the unified ALL pool deliberately switched the synergy
  filter off, which is exactly what used to keep same-vector pairs apart.
- **Missing localization** — expansion MAs never got Russian entries.

---

## 3. What changed

### Russian renames (different effect → name now reflects the mechanic)

| English | Old RU | New RU | Why |
| --- | --- | --- | --- |
| Rim Settler (M) | Пионер | **Юпитерианец** | scores Jovian tags |
| Merchant (M) | Торговец | **Негоциант** | hoard of every standard resource |
| Agronomist (M) | Агроном | **Растениевод** | scores plant tags |
| Landshaper (M) | Планировщик | **Застройщик** | builds a variety of tiles |
| T. Collector (M) | Коллекционер | **Собиратель** | collects card-type sets |
| Farmer (M) | Фермер | **Животновод** | scores animal+microbe resources |
| Engineer (M) | Инженер | **Теплоэнергетик** | energy+heat production |
| Mogul (A) | Магнат | **Промышленник** | most non-M€ production |
| A. Manufacturer (A) | Производитель | **Технолог** | most blue (active) cards |
| Manufacturer (A) | Производитель | **Литейщик** | steel+heat production |

Kept their Russian name (same effect **and** in one exclusion group → never
co-occur, so no rename is invented per the "don't fake uniqueness" rule):
`Smith`/`Blacksmith` (Кузнец), `V. Electrician`/`Electrician` (Электрик),
`Zoologist`/`A. Zoologist` (Зоолог), `T. Politician`/`Politician` (Политик).

### New Russian translations added

`Terraformer29`→Колонист, `Tycoon10`→Олигарх, `Purifier`→Очиститель,
`Risktaker`→Авантюрист, `Tunneler`→Проходчик, `Excavator`→Землекоп,
`Kingpin`→Главарь, `Rugged`→Старожил — plus the missing descriptions (Purifier /
Risktaker / Tunneler / Excavator / Kingpin / Rugged / Farmer).

### Deprecated (dropped from every random pool, kept for save compatibility)

`Metallurgist` (→ canonical `Smith`), `Trader` (→ canonical `Tradesman`),
`Terraformer` (→ `Terraformer29`), `Tycoon` (→ `Tycoon10`).

---

## 4. Random-pool decisions (exclusion groups)

28 groups in `MilestoneAwardExclusions.ts`. The random selector offers at most one
member of each per game. Highlights:

`terraform-rating`, `broad-production`, `mc-production`, `steel-titanium-engine`
(Smith/Blacksmith/Miner), `heat-stock`, `plant-production`, `city-tiles`,
`greenery-tiles`, `colonies`, `adjacency-bonus-tiles`, `ocean-adjacent-tiles`,
`edge-tiles`, `moon-tiles`, `building-tags`, `science-tags`, `power-tags`,
`earth-tags`, `jovian-tags`, `space-tags`, `bio-tags`, `moon-tags`,
`animal-microbe-resources` (Farmer/A. Zoologist/Zoologist), `events`,
`requirement-cards`, `expensive-cards`, `cards-in-hand`, `delegates-politics`,
`underground-tokens`.

Canonical-only (the other variant deprecated, never in the pool):
steel+titanium production (Smith over Metallurgist), card-resource variety
(Tradesman over Trader), terraform rating (Terraformer29 over Terraformer),
project cards (Tycoon10 over Tycoon).

---

## 5. Tests / how to run

`tests/ma/MilestoneAwardDeduplication.spec.ts` (new):

- exclusion-group metadata integrity (valid names, ≤1 group each, no deprecated
  member);
- **no two pool candidates share a Russian name** unless in one exclusion group;
- every pool candidate has a Russian name (no Latin leak);
- the selector never offers two MAs from one group, and never a duplicate Russian
  name in a single game — 1000 draws each in LIMITED / UNLIMITED / ALL / modular;
- explicit ТОРГОВЕЦ and ЗООЛОГ cases; Smith/Blacksmith; deprecated clones;
- fixed/NONE board sets (Tharsis/Hellas/Elysium) are byte-for-byte unchanged.

`tests/ma/MilestoneAwardSelector.spec.ts` — updated the one assertion that relied
on `Trader` being a pool candidate (now `Producer`).

Run:

```
npx mocha --import=tsx --require tests/testing/setup.ts "tests/ma/**/*.spec.ts"
npm run make:json   # asserts no duplicate translation keys
```

Verified green: `build:server`, `make:json`, eslint on the touched files,
`tests/ma`, `tests/milestones`, `tests/awards` (413), `ApiCreateGame`.

---

## 6. Open / debatable cases (documented, not silently decided)

- **`delegates-politics`** groups `T. Politician` (most delegates) and `Politician`
  (party leaders + influence). The vectors are *related* (influence partly derives
  from delegates), not identical — grouped to avoid two near-identical turmoil
  awards and the Политик name clash. Easy to split if a future call wants both.
- **`Forester`** keeps "Фермер" — it is deprecated (random-excluded) and appears
  only as the fixed Amazonis milestone, where it is the sole "Фермер". The
  `Trader` locale entry likewise stays "Торговец" but is deprecated/unused.
- **Other languages** were not retranslated (the request was Russian). The
  exclusion-group guard is language-agnostic, so it already prevents same-*effect*
  pairs in every language; only Russian-*name* uniqueness was done.
- **No runtime Russian-name guard** — the server doesn't load locale JSON. Russian
  uniqueness is guaranteed by the renames + the regression test, with exclusion
  groups (metadata) as the primary runtime guard, exactly as scoped.
