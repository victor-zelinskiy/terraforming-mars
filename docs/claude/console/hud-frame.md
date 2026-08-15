# The HUD FRAME — two full-bleed horizontal rails, ONE height token

*(2026-08-15 rework: «архитектурно-визуальный реворк верхнего и нижнего HUD-rail».)*

The top status strip (`ConsoleStatusStrip` / `.con-status`) and the bottom
command bar (the shell instance of `ConsoleCommandBar` inside `.con-footer`)
are the two horizontal borders of the console cockpit. They are **full-bleed
chrome welded to the physical viewport edges** and **strictly equal in
height** — that equality is an architectural invariant carried by ONE token,
never a visual coincidence of two similar constants.

## The tokens (html scope — `console.less` § THE HUD FRAME)

| Token | Base | TV | Handheld | Meaning |
| --- | --- | --- | --- | --- |
| `--con-hud-h` | `2.2rem` | `2.3rem` | `1.7rem` | THE shared rail height. Both rails' `height:`; borders/inner chrome live INSIDE it (`border-box`). |
| `--con-hud-gap` | `.3rem` | `.35rem` | `.25rem` | Breathing between a rail and `.con-main` (= the root's flex `gap`). Border + focus-ring clearance, nothing more. |
| `--con-bar-h` | `var(--con-hud-h)` | — | — | Legacy alias (dock wings etc.). Never redefine per profile. |
| `--con-band-top` / `--con-band-bottom` | `calc(var(--con-hud-h) + var(--con-hud-gap))` | — | — | The modal-band contract — symmetric BY CONSTRUCTION now. |
| `--con-hud-pad-x` (on `.con-root`) | `calc(var(--con-pad-x) + .35rem)` | follows `--con-pad-x: var(--con-safe-x)` | `+ .25rem` | The rails' CONTENT inset: **full-bleed chrome + safe-inset content**. |

Declared on `html.console-mode, html.console-native` (NOT `.con-root`) so
body-level floating layers — the notification stack, the teleported bot
review — anchor to the same numbers. Profiles override the tokens on their
own `html.con-profile-*` scope (equal specificity; source order decides —
`console_tv.less` imports after `console.less`, the handheld block sits
later in the same file).

## The rules that make it hold

- **`.con-root` carries NO padding** (`padding: 0`); the horizontal inset
  lives on `.con-main` as **margin** (margin, not padding — the absolute
  overlays inside `.con-main` (journal / info workspace / context panel)
  must keep anchoring to the same box edges).
- The top rail: `height: var(--con-hud-h)`, `padding: 0 var(--con-hud-pad-x)`,
  `border-radius: 0`, frame accent on the **bottom** edge (inset box-shadow —
  perf-lite safe). The terra underline anchors to the rail's bottom
  (`bottom: .14rem`) instead of buying a padding row; the params row and the
  player chips centre in the one line. Player chips **never wrap** — a
  crowded table ellipsizes `__pname` (`max-width`), the pill never truncates.
- The bottom rail: the base `.con-cmdbar` KEEPS its floating-card look (the
  menus / bot review embed it) — the shell instance is re-dressed by
  **`.con-root .con-footer > .con-cmdbar`** (three classes ON PURPOSE: the
  per-profile `.con-cmdbar` height/padding overrides for the menu bars must
  never re-dress the welded rail). Accent on the **top** edge.
- The hand dock is welded with the bar: `bottom: 0`, the plate is
  `height: var(--con-hud-h)` (FLUSH with the rail — the bay socket no longer
  pokes above the frame; only the CARDS rise over it, as an overlay), pack
  `bottom: .45rem` → static card tops ≈ `4.85rem` from the viewport bottom
  (handheld ≈ `4.1rem`). `.con-board { padding-bottom: 3.05rem }` (handheld
  `2.8rem`) reserves exactly that + the raised pose's `.45rem` lift.
- Floating chrome anchors derive from the token, never from a vh guess:
  `.con-banner` (`hud−.35`), `.con-drafttray` (`hud+.05`), `.con-mandatory`
  (`hud+1.75`), `.con-banner--events` (`hud+4.55`), the console
  `notifications-layer` (`hud+1.9`), `.con-notice`
  (`band-bottom + 1.3`). No per-profile re-anchors remain.
- **Feedback chips flip DOWN in the top rail**: at y=0 a chip popping above
  the readout leaves the screen, so `.con-status` overrides the
  `--global-parameter` / `--misc` host anchors to `bottom: -1.35rem` — a
  transient overlay over the board's top edge.
- The FINAL generation is **colour only**: the label renders the ordinary
  `GEN.` key («ПКЛ.») always; the `--final` class recolours label + value
  gold. Never an added word/badge/icon (the «ФИНАЛЬНОЕ» word is gone, the
  `FINAL GEN.` key is deleted from `ru/console.json`).
- `ConsoleCommandBar.runPlan`'s `barPad` mirrors the `.35rem`/`.25rem`
  breathing of `--con-hud-pad-x` — keep them in step.

## Guards

- `tests/e2e/console-hud-frame.spec.ts` — FHD + forced-TV 4K: computed
  strip height == bar height == the token; strip at y=0 full width; bar at
  the bottom edge full width; root padding `0px`; plate flush with the bar;
  `.con-main` == viewport − 2×(rail+gap); both side rails stretch to it;
  the generation label carries no final marker; the board stage clears the
  dock card tops. Screenshots → `screenshots/hud-frame/<preset>/`.
- `tests/client/components/console/consoleStatusStrip.spec.ts` § generation
  label — ordinary vs final: same `GEN.` text, `--final` class only.
