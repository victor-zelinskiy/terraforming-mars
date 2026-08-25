# Rail VALUE BADGES — the left rail's passive information layer

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
