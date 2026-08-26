# Rail VALUE BADGES + PROTECTION MARKS — the left rail's passive layer

«Сколько M€ заменяет одна единица» и «во сколько ПО конвертируется метка» —
прямо на иконках левого рейла, без открытия payment-редактора и без подсчёта
в уме. Слой ПАССИВНЫЙ: ни фокуса, ни ввода, ни одного пикселя layout-сдвига.

## The read-model (`src/client/console/railValueModel.ts`)

ONE pure module behind both badge families; it restates NO rule:

- **Rates** come from `paymentPlan.rateFor` (exported for exactly this) — the
  same function every console payment surface charges by. Live
  `steelValue`/`titaniumValue` ride the model; card-bound units are
  `DEFAULT_PAYMENT_VALUES`.
- **Eligibility** comes from the server's own grants:
  - steel/titanium — the base-game payment pair (always badged);
  - heat / plants / titanium-anywhere — the standing flags mirrored onto
    `PublicPlayerModel` (`canUseHeatAsMegaCredits` — Helion/Ambient,
    `canUsePlantsAsMegacredits` — Martian Lumber Corp,
    `canUseTitaniumAsMegacredits` — Luna Trade Federation), populated in
    `ServerModel.getPlayerModel` beside `steelValue`. The flags are PUBLIC —
    each derives from the public tableau, and the rail can display an
    inspected seat;
  - a card-bound unit (microbes / floaters / science ×2 / seeds / data /
    graphene / asteroids) is tender exactly while its ENABLING card —
    `CARD_FOR_SPENDABLE_RESOURCE`, the registry `Player.pay()` spends from —
    is in the displayed player's tableau. The same resource TYPE on any other
    holder is storage (Stormcraft floaters never earn the Dirigibles badge).
- **Tag scoring** reads the declarative `victoryPoints` the server's Counter
  scores at endgame (`each` FIRST, floor by `per`; the `'raw'` count excludes
  wild tags, so a wild cell can never carry a coefficient and
  `PublicPlayerModel.tags` is exactly the base the badge's math applies to).
  `'special'` scorers (Agricola's thresholds) are not a linear coefficient →
  no badge (desktop parity).

Both halves are memoized by MODEL IDENTITY (structural sharing keeps
unchanged refs) — the always-mounted rail pays O(1) per response.

## Presentation (ConsoleValueBadge.vue + `.con-valbadge`)

Two variants that differ in SHAPE and MATERIAL, never colour alone:

- `--mc` — the game's own megacredit tile (gold coin, engraved figure),
  pinned to the icon's lower-right corner. A DUAL-RATE text grows the square
  into a gold pill of the same family: «3/2» = LTF titanium (full rate on
  space, −1 anywhere else); «1/2» = a shared-icon chip whose two enabling
  cards pay at different rates (Luna Archives ×1 + Spire ×2 science). Showing
  one rate would lie; the aria names each context.
- `--vp` — the console award-shield silhouette (the `ConsoleVpBadge` family,
  flat fills, no `<defs>`), upper-right of the МЕТКИ medallion. Coefficient
  language is the deleted desktop `PointsPerTag`, ported VERBATIM: vulgar
  fractions (½ ⅓ ⅔), zero integer suppressed, the «2⁄2» two-half-cards
  special case (structural `per === 2` — never the card-name pair the desktop
  hardcoded), «*» for a placement-dependent score.

Geometry: the icon gets a `position:relative` wrapper (`__iconwrap` /
`__medalwrap` — the medal wrapper takes over the medal's flex role so the
shield tracks matrix compression); the badge is absolute, `pointer-events:
none`, offsets in `calc(var(--valbadge-size) * −k)` so every profile keeps
the same overlap. Tokens `--valbadge-size`/`--valbadge-fs` live on
`.con-res-host` and `.con-tagmx`, overridden per profile (TV = the 0.8rem
couch type floor; handheld keeps the production-chip register). Paint is
baseline-safe: seat ring = box-shadow, pulse = transform only.

Micro-motion: ONE one-shot scale pulse on a VALUE change within the same
seat (`scopeKey` = player color — an inspect switch never pulses; reduced
motion skips it entirely). Mount never animates: no «мигание при загрузке».

## Honesty rules the layer must keep

- The badge means «одна единица = N M€ при ДОПУСТИМОЙ оплате» — the aria
  carries the context («за карты с меткой „Здание“», «за любые карты», …)
  from `MC_CONTEXT_KEYS`, mirroring `Player.paymentOptionsForCard`.
- An aggregated ДОП.РЕСУРСЫ chip stays honest: `spendableAmount` (resources
  ON the enabling card) rides the facts, and the aria names the split when
  the chip total includes non-tender holders.
- M€ never carries a badge (it IS the unit); energy never does.
- The VP badge is the MARGINAL RATE of a tag, deliberately not the count and
  not the accrued VP — those are the cell's own number and the score header.

## Guards

- `tests/client/components/console/railValueModel.spec.ts` — the model: base
  rates, live modifiers, grants, enabler-vs-storage, dual-rate merges, the
  full PointsPerTag formatter parity.
- `tests/client/components/console/ConsoleResourcePanel.spec.ts` («value
  badges») — mount-level: presence per key, wide pill, aggregated aria,
  zero-cell shield, atomic seat switch (no pulse), pulse on value change,
  bot rail carries none, the full-house layout.
- `tests/models/ServerModel.spec.ts` — the three flags mirrored publicly.
- `tests/e2e/console-rail-value-badges.spec.ts` — fhd / tv4k / deck: live
  figures (Helion forced), badge pinned inside its row and clear of the
  value column, text inside the plate, ONE row height, no VP shield in a
  fresh game; screenshots to `screenshots/rail-value-badges/`.

---

# PROTECTION MARKS — «этот запас под защитой»

The second half of the same passive layer: a shield pinned to a guarded
stock, so «мои растения не отберут» is answered by a glance at the rail
instead of by remembering which cards are in the tableau.

## The read-model (`src/client/console/railProtectionModel.ts`)

Three server-authoritative inputs, none of them re-derived here:

| Layer | Source | Covers |
| --- | --- | --- |
| stock | `PublicPlayerModel.protectedResources` | the six resource rows |
| production | `PublicPlayerModel.protectedProduction` | each row's brown chip |
| card resources | `PublicPlayerModel.protectedCardResources` (**new**) + the printed `CardModel.protectedResources` (**new**) | the ДОП.РЕСУРСЫ chips |

`protectedResources` / `protectedProduction` already existed and were already
public for every seat — they simply had **zero** client readers. The two new
fields close the card-resource gap: the blanket type shield (Protected
Habitats over animals + microbes, built in `ServerModel.getCardResourceProtections`
from the same `RemoveResourcesFromCard` filter the engine enforces) and the
PRINTED per-card shield (Pets, Bioengineering Enclosure), which rides the card
model because it covers ONE holder's stock.

**Three kinds, three meanings, three materials:**

- `full` — gold body + engraved check: an opponent cannot take it.
- `half` — gold body + «½»: **Botanical Experience**. The rule is *«a removal
  still happens, its amount is halved, rounded up»* (`Math.ceil(qty / 2)` in
  every removal path), NOT «half the stock is safe» — the aria says exactly
  that. The shield stays GOLD: a real rule is in force, and a dimmed shield
  would be invisible at couch distance and would read as «weaker» rather than
  «halved». (This is also why the legacy desktop `.shield_icon_half` — an
  `opacity` + `grayscale` variant — could not be reused: the console paint
  baseline strips `filter`, so it would have rendered as FULL protection.)
- `partial` — hollow shield (graphite body, gold rim + check): a ДОП.РЕСУРСЫ
  chip that aggregates a protected and an unprotected holder (Pets + Birds).
  The aria names the split («под защитой часть запаса: 4 из 7»). Claiming
  `full` there would promise more than the rules give.

A blanket type shield OUTRANKS the partial reading (nothing on that type is
exposed). Marks are computed for the DISPLAYED player, so the Information
Workspace (Y) shows the inspected seat's own shields.

## Presentation (`ConsoleProtectionMark.vue` + `.con-shieldmark`)

The silhouette IS the printed one — the same heraldic shield the card face
prints for Protected Habitats / Pets / Asteroid Deflection System
(`assets/misc/shield-protect.svg`), redrawn inline in flat fills so the three
states differ by material rather than by a stripped filter.

Placement is the corner OPPOSITE the MC coin: the shield takes the icon's
**upper-left**, the coin the lower-right, so the two layers can never collide
(guarded in e2e). Production protection is the same mark at a smaller register
pinned inside the chip's own corner — absolutely positioned, because a glyph
in the chip's flow would widen it and move the value axis the rail contract
guards. Tokens: `--shieldmark-size` on `.con-res-host` / `.con-tagmx`, one
override per profile. Entrance is a single settle on mount (the mark exists
only while the protection does, so a mount IS the moment it was gained);
reduced motion skips it.

## Guards

- `tests/client/components/console/railProtectionModel.spec.ts` — the model:
  full / half, alloys + their production, the blanket type shield, the
  printed per-card shield, the partial split, blanket-outranks-partial, a
  legacy model with no fields.
- `tests/client/components/console/ConsoleResourcePanel.spec.ts` («protection
  marks») — mount-level: presence per row, the `½` glyph, the production mark
  living inside the chip, the aux chip's partial aria, seat switching, the
  passive contract, no marks on the bot rail.
- `tests/models/resourceProtections.spec.ts` — **the projection's first
  guard**: the six-resource matrix over Protected Habitats / Asteroid
  Deflection System / Botanical Experience / Lunar Security Stations /
  Private Security, the printed card flag, and «every seat sees an
  opponent's protections».
- `tests/e2e/console-rail-protection.spec.ts` — the real shell at fhd / tv4k /
  deck: no shield before «Защищённая среда обитания» is played, one after,
  pinned to the icon's upper-left, never overlapping the coin, and row
  heights + icon column pixel-identical before/after.
