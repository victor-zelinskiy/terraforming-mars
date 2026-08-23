# LESS debt cut by selectors — the legacy card model and the desktop screen styles die

**Date:** 2026-08-22 · **Status:** DONE, verified · **Commit:** `40f5911c39` (+ merge `5b8c2ccea0`) · **Context:** the follow-up to desktop-removal waves 1–4 + the transport/board-input reworks (`TRANSPORT_REWORK.md`): the LESS layer still carried the deleted UI's styles mixed with live shared ones.

## Method
A live-class corpus was built first (import-graph BFS from `main.ts` → 884 reachable files; static `class=`, `:class` bindings, script literals, dynamic prefix builders), then EVERY top-level selector in the target files was classified against it, and **every deletion candidate was deep-grepped across `src/**` before deletion** — zero-hit = dead, anything else investigated. Cut by SELECTORS, never by files: live styles moved to honest homes.

## What moved / died (net −10 510 lines; `build/styles.css` 3 423 966 → ~3.11 MB, −9 %; gzip −72 KB)
| File | Before | After |
| --- | --- | --- |
| `cards.less` | 2 909 | **deleted** — live render-DSL styles re-homed to NEW **`card_render_dsl.less`** (1 177) |
| `cards_scifi.less` | 1 630 | **deleted entirely** (every selector required the `.card-container.filterDiv` compound only legacy `Card.vue` emitted) |
| `cards_v2.less` | 3 031 | 2 591 (33 legacy-chrome blocks cut; corp-logo tree + DSL styles stay) |
| `player_home.less` | 5 108 | **deleted** — live App-chrome re-homed to NEW **`app_chrome.less`** (435: alert dialog, main-container, root tokens other files read) |
| `journal.less` | 1 384 | 1 046 (desktop journal chassis + 4 orphaned keyframes) |
| `hydronetwork.less` / `preferences.less` | | dead `#player-home` rules removed |

**Saves the deep checks caught** (each would have been a silent visual regression): `card-container`/`card-content*` live via turmoil `GlobalEvent` + console composers; the bare icon language (`.production`, `.resource`, `.tile`, …) live on colonies/turmoil/help; `points-big`/`cards-count`/`card-requirements` emitted from DSL innerHTML; `.megacredits` is an `:extend` target of the journal's resource token; `journal-preview-*` are `<Transition name>` classes of all five popovers; `card-plus--small`/`card-or--tiny`/`card-vspace--*` live via the symbol-size map; keyframes referenced BY NAME from console.less kept.

## Verification
`make:css` clean · webpack 0 errors · vue-tsc clean · client 4 330/4 330 in the branch (4 325/4 325 on merged main — the delta is the board-input spec swap, not this cut) · server 9 572/9 572 · e2e workspace-band 6/6 in-branch + wheel-commit/placement-dossier 7/7 on merged main · **visual A/B against the pre-cut CSS**: playground 0 diff px, loaded game + journal 2 px, the menu delta proven boot-loader animation by a same-css control run · an injected DSL computed-style probe (18 checks) byte-identical.

## Post-cut regressions caught (both the same blind spot — DYNAMIC class emission)
1. **`.plants` / `.fighter`** — `BenefitGlyph` (colony track / trade / bonus slots) builds its icon class from the server's enums at runtime (`resource.toLowerCase()`), so NO string literal exists in any template and the live-class corpus could not see it; `.plants` was additionally an `:extend(.plant)` alias. Ganymede (the plants colony) rendered empty icon boxes on the track and both bonus rows. Restored in `card_render_dsl.less`; **guard added**: `tests/styles/resourceIconDefinitions.spec.ts` pins every `Resource` enum value + the shipped card-resource set BY ENUM, not by grep.
2. (Earlier, same session, same shape at the FILE level: the `wgt-icon--*` family and `.placement-reason-host` died with their deleted files while their consumers lived — `tests/styles/wgtIconDefinitions.spec.ts` guards that family.)

**The lesson for any future corpus-based cut**: a class emitted by lowercasing a server enum, an `:extend` alias, a `<Transition name>`, or innerHTML is invisible to a source-literal grep — guard those families by ENUM/contract, and treat «zero grep hits» as «needs a consumer-side proof», not as «dead».

## Remaining style debt (known, minor)
`preferences.less` keeps historical `cards_scifi` attributions in comments and a couple of `.player_home_block--*` rules for DOM that no longer renders (the PreferencesDialog page itself is an upstream-era screen pending a product decision); `language_hacks.less` inert selectors; `hand-soft-reason*` kept-as-uncertain.
