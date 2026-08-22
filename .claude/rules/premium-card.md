---
description: The premium card face (.pcard) — scope gate, routing, icons/art, mechanics order, host CSS hooks.
paths:
  - "src/client/components/premiumCard/**"
  - "src/client/components/card/**"
  - "src/client/cards/**"
  - "src/styles/premium_card.less"
  - "src/styles/card*.less"
  - "tests/client/components/premiumCard/**"
---

# Premium card face rules

Project / prelude / corporation / CEO cards render through `PremiumCard.vue` (`.pcard`, design space **320×460 @ zoom 1**). CEOs joined in desktop-removal wave 4: theme `ceo` (cool graphite + champagne), the procedural identity band (`.pcard-ceo-ident` — no L-card ships art, the band IS the intended face), the once-per-game marker (`{kind:'opg'}` → `.pcard-opg`), `printedLayout` mechanics (authored order, NO on-play rail) and the PROSE RULE zone (`vm.prose` → `.pcard__prose`, length tiers via `proseTierFor` — never clamped, never scrolled; falls back to the render data's dropped `plainText`). Standard projects stay on the legacy renderer until their own pass.

- **The ONE scope gate is `premiumCardTheme.isPremiumFaceType`** — every routing point consults it; widening scope is a one-line change there.
- **Routing:** hosts import `card/CardFace.vue` (a zero-visual-logic facade registered locally as `Card`) — never legacy `Card.vue` directly. The zoom modal routes inside `CardZoomCard.vue` via the GLOBALLY registered `premium-card-face` (a static import would close a type cycle and collapse `vue-tsc` to `{}`).
- **Data flow:** `CardModel + ClientCard → premiumCardViewModel.buildPremiumCardViewModel → PremiumCard`. The VM layer is PURE (no Vue/DOM/i18n, unit-tested under the server runner); mechanics are a walk of the SAME render DSL, nodes kept as REFERENCES (no copies, no drift); plain prose rows are dropped (the face is icons-only).
- **Canonical mechanics order:** actions → passive effects → the on-play zone («при розыгрыше») **LAST**, via `orderMechGroups` (a stable sort by kind-rank). The structured card TEXT is ordered the same way (`orderInfoGroups`). A new group kind gets a rank in BOTH — never hardcode order at a call site, never move on-play back above effects/actions.
- **The VP badge prints a RELATION, never two adjacent symbols.** `vpRelationOf` classifies the printed dynamic VP ONCE (`per` → «N / [icon]» · «N / K [icon]»; `conditional` → «[icon] : N», a flat amount behind a threshold; `variable` → «?»; `plain` → a bare numeral) and the badge RENDERS that verdict — never a second derivation at the call site, never a per-card table. ⚠️ `target` is a render field: the per-one builders copy `points` into it, so a denominator is only a `target` that is both `> 1` and `!== points`. The operator never dangles (no icon ⇒ no «/»), and the badge's `--pcard-vp-safe` reserve is a GUARANTEE, not the plate's width — read the measured note in `premium_card.less` before touching either.
- **Icons:** `premiumCardIcons.ts` is the ONE mapping (item type / tag / card-resource / tile / expansion → raw asset URL, inline-styled). Legacy icon classes are CSS-scoped under `.card-container` and must not be reused. A tile VARIANT resolves from the render node's FLAG (e.g. `isAres`) via `TILE_VARIANT_PRIORITY`, never from `TileType`. Unmapped → labelled fallback chip + one-shot dev warn.
- **Art:** `assets/card-images/<cardNumber>.webp`, availability baked into `src/genfiles/cardArtManifest.json` by `make:cards`. Missing art is NOT a gap — the procedural theme fallback is intentional (~130/1000 have real art). The `<img>` failure chain is one-shot (art → `-1.webp` → procedural), never a loop.
- **Host CSS/JS hooks** that size or state-style a card face use **`:is(.card-container, .pcard)`**; `CARD_NATURAL_W` is 320. Rules keyed on legacy internals (`.filterDiv`, `.card-hover-tall`, `.card-content`) stay legacy-only by design.
- **Never nest a literal `.card-container` inside `.pcard`** — hosts zoom `:is(.card-container, .pcard)` descendants, so it would be zoomed twice (corp logo styles are scoped `:is(.card-container, .pcard-corp-stage)` for exactly this reason).
- The corporation identity plate is **light (warm parchment) on purpose** — several wordmarks are dark-inked and were designed against the legacy white face. Don't re-darken it.
- No `backdrop-filter`, no runtime SVG filters, no infinite animations; `prefers-reduced-motion` honoured. Quality tiers `pcard--tier-thumb|normal|full` (`lightweight` prop for dense boards).
- **Adding a card is usually free** (the face renders BY TYPE). Per-card work only for a new tile-art variant, a new icon, or new art. Widen the playground + guard `SCOPE` when widening module scope.
- Visual acceptance surface: `?premiumCardsPlayground`. Guards: `premiumCardViewModel.spec.ts` (the no-graphics list is PINNED — a new mechanics-less card fails with its name) + `premiumCardIcons.spec.ts` + `PremiumCard.spec.ts`.

## Deep reference
`docs/claude/cards/premium-card-renderer.md`, `card-information-model.md`, `fullscreen-card-viewer.md`, `card-lore-archive-entry.md`, `card-action-buttons.md`.
