# THE CONSOLE SYSTEM SURFACE — the settings console + the in-game system menu

**One chassis, two surfaces.** `.con-sys` (`src/styles/console_settings.less`) is the
frame the player meets *outside* the game's own flow — backdrop, glass card, crumb head,
an optional tab band and the foot bar:

| modifier | component | what it is |
| --- | --- | --- |
| `.con-sys--settings` | `ConsoleOptionsPanel.vue` | THE home of every persistent console preference |
| `.con-sys--menu` | `ConsoleSystemMenu.vue` | the in-game Menu-button overlay (actions only) |

Before this iteration they looked like two different products: the settings panel
borrowed the pre-game `.cm-overlay` (gold title, no rail) and the system menu had its
own `.con-sysmenu` glass plus a hand-built diagnostics sub-panel. They now share the
card, the crumb head, the foot bar, the focus language and the profile calibration —
which also means **the settings surface looks identical from either of its two hosts**
(main menu → «Настройки», and in-game → System → «Настройки»).

---

## 1. Why the settings needed a rework at all

The flat list had reached eleven rows with two-line subtitles and no longer fit a TV
screen — the player *scrolled a settings menu*. Three changes fixed it, and they only
work together:

1. **A CATEGORY STRIP.** `consoleSettingsModel.ts` owns the grouping; LB/RB step it, so
   no category ever needs to scroll. It runs **horizontally**, along the axis LB/RB
   moves, and the two chips sit at the ENDS of the very strip they drive
   (`.con-sys__tabs` brackets `.con-set__tabs`) — the affordance is spatial, which is
   why the foot bar spends no line saying «Категория». A vertical rail contradicted
   the gesture: the control moved sideways, the list moved down.
2. **ONE-LINE ROWS + a fixed DETAIL STRIP.** The description moved off the row into a
   big always-mounted strip under the list: better at 2 m *and* half the row height.
3. **A STEPPER, not a cycler.** Every setting is a RING, so `‹ / ›` (d-pad left/right,
   A = forward) step both ways and pips show the position. A five-option row is no
   longer a press-A-four-times affair.

## 2. The categories

`buildConsoleSettings({context, server, lan, desktopVersion})` returns only the
categories that have content in this context.

| id | label | rows | notes |
| --- | --- | --- | --- |
| `interface` | ИНТЕРФЕЙС | Оболочка*, Дисплей | *main menu only — swapping shells mid-game is jarring and the desktop UI is frozen |
| `controls` | УПРАВЛЕНИЕ | Контроллер, Раскладка кнопок, Управление колесом | |
| `graphics` | ГРАФИКА | Скорость анимаций, Плавность анимаций, Производительность | |
| `game` | ПАРТИЯ | Приватный счёт | **in-game only** — a per-game pref keyed by participant id |
| `network` | СЕТЬ | Сервер партий, Видимость в сети | `minor`, main menu only, desktop shell only (launch-time properties) |
| `diagnostics` | ДИАГНОСТИКА | — (a read-only READOUT) | `minor` |

**`minor: true`** is the answer to "dev-only-ish items should be small, unimportant
categories": the strip renders them past a hairline seam, small and dim — reachable,
never competing with the four a player actually tunes. The seam is a RULE, not a
«ДОПОЛНИТЕЛЬНО» caption: in a horizontal strip a caption would out-shout the tabs it
introduces.

A category has **either `rows` or `readout`, never both** (spec-guarded). The readout
groups render **side by side**, which is what lets the whole diagnostics screen land
inside the constant body height instead of scrolling half of itself away.

## 3. The layout-shift contract (load-bearing)

This is the reason settings were moved out of the fixed-shape system menu in the first
place, so the new surface has to honour it harder, not less:

- rows are **one line tall**, description in the detail strip;
- the stepper cell has a **fixed width** and the arrows only change *opacity* on cursor
  — a longer value can never resize the row;
- the detail strip **reserves its description and note lines** always;
- the pip count is constant per row;
- **`.con-set` has a fixed `height`, not `min-height`** — switching category with LB/RB
  must not resize the card either. A tall category scrolls *inside* the pane.

The e2e (`tests/e2e/console-options-settings.spec.ts`) measures all of this: row width
across a value change, detail-strip height across a cursor move, card height and `y`
across a category change.

## 4. Input

| control | settings console | system menu |
| --- | --- | --- |
| ✛ up/down | move the row cursor (a read-only category scrolls its readout instead — the foot says «Прокрутка», not «Навигация») | move the plate cursor |
| ✛ left/right | step the cursored value backwards / forwards, wrapping | — |
| A | step forward | run the plate |
| LB / RB | previous / next category — the chips are ON the strip. **Clamps** at the ends (`stepIndex`); only a VALUE wraps | — |
| B | one logical level up | close / leave the exit stage |

Both hosts (`ConsoleMainMenu`, `GamepadLayer`) route the whole intent through
`handleIntent`. **The menu host hides its own command bar while the settings console is
open** — the console carries its own foot bar (it has to; in-game there is no bar under
it), and two bars printing the same four verbs in two sizes is not a premium surface.

### The keyboard route into the system overlay

The overlay is owned by `GamepadLayer`, which sits on the RAW gamepad stream (the Menu
button's hold gesture toggles the console ↔ desktop shell) — while the keyboard
fallback flows through `consoleKeyBridge` → the console ROUTER, which GamepadLayer is
not part of. Until `consoleSystemMenuBridge.ts` existed, a keyboard player in console
mode **could not open the system overlay at all**, i.e. in-game they could reach neither
the settings nor «В главное меню».

The seam registers a handler that answers `true` for everything it consumed, and the key
bridge asks it **before** the router. Both halves are needed: opening it (`KeyM`) *and*
owning input while it is open — otherwise the arrows would drive the board behind it.
The gamepad path is untouched, so there is exactly one owner and no double handling.

## 5. The head grammar

A tail is for a **descent**, not for a lateral move. The system menu's exit
confirmation is a descent, so its crumb *gains* an amber `› ВЫЙТИ` tail (in a shared grid
cell, crossfaded — a `mode="out-in"` swap empties the cell and reads as a blink) while
the frame stays put and the foot swaps its verbs: a stage, not a second dialog.

The settings console's **category is not a descent**, so its head stays `⚙ НАСТРОЙКИ` and
the strip alone says where you are. Printing it in both places just repeated the
highlighted tab one line above it.

## 6. ONE overlay, one transition

`GamepadLayer` wraps the WHOLE overlay in a single `con-layer` fade (`.con-sys-host`)
and swaps its two members INSIDE it, instantly. Giving each its own transition
crossfaded two full-screen cards over two stacked backdrops for ~200 ms on every
«Настройки» — and left both mounted meanwhile, which is a lie about where input is (an
e2e caught it as two `.con-sys__crumb-root` nodes). The host has to be `position: fixed;
inset: 0` in its own right: the fade drops `opacity` below 1, which makes it the
containing block for the `position: fixed` surface inside it. Guard: `.con-sys` is
asserted to have count 1 in BOTH swap directions.

## 7. The system menu stays FIXED-SHAPE

Plates now carry a subtitle, but every label is **static** — no plate ever relabels in
place, so d-pad navigation cannot move the plates under the cursor. **Never add a
SETTING here** (CLAUDE.md). «Диагностика» is a *deep link*: it opens the settings console
on its `diagnostics` category (`initialCategory`), so the readout has exactly one home,
one implementation and one look.

## 8. Traps paid for in this iteration

- **A second `&` inside a nested profile block re-expands the WHOLE parent.**
  `html.con-profile-tv { .con-sys { &--settings &__card {…} } }` compiles to
  `html.con-profile-tv .con-sys--settings html.con-profile-tv .con-sys__card` — a
  selector that matches nothing. The TV settings card silently kept the action-menu
  width and its row labels were squeezed out of existence. Spell the second class.
  (`grep -n "^html[^{]*html" build/styles.css` finds every instance; three unrelated
  ones still exist in `console_tv.less` / the handheld block.)
- **A lazy `import()` anywhere in a spec's dependency graph silently zeroes that whole
  spec file under mochapack.** The settings model used to import the GSAP ticker bridge
  (which lazily imports gsap) — `consoleOptionsPanel.spec.ts` had been reporting
  "0 passing, success" for its whole life. The bridge now registers through
  `onMotionFpsCapChange` in `main.ts`, so it lives on the BOOTSTRAP side of the seam and
  the model stays unit-testable.
- **`RAW_STRING` params were being translated.** `translateMessage` sent them through
  the dictionary despite the type's own contract ("Raw strings are untranslated") — and
  `game_end.json` keys `'A'` → `'Н'`, so «Раскладка кнопок» rendered «Обмен **Н** / B»:
  the one setting whose job is naming a face button was naming the wrong one. The two
  token renderers (`JournalTokenRenderer`, `LogMessageComponent`) had always treated it
  as raw; `translateMessage` was the odd one out. Guarded by
  `tests/client/directives/translateMessageRawString.spec.ts`.
- **`'This game'` is the victory-point table's «За партию» caption**, not a settings
  category. The ПАРТИЯ category keys `'Game'`.

## 9. Files

| file | role |
| --- | --- |
| `src/client/console/settings/consoleSettingsModel.ts` | the model: categories, rings, descriptions, the readout |
| `src/client/components/console/menu/ConsoleOptionsPanel.vue` | the settings console |
| `src/client/components/console/ConsoleSystemMenu.vue` | the in-game menu (presentation over props) |
| `src/client/console/consoleSystemMenuBridge.ts` | the keyboard seam into the overlay |
| `src/styles/console_settings.less` | the shared chassis (incl. the `.con-sys__tabs` band) + both bodies |
| `src/styles/console_tv.less` § 17 | the couch calibration for both |
| `tests/client/components/console/consoleSettingsModel.spec.ts` | the model contract |
| `tests/client/components/console/consoleOptionsPanel.spec.ts` | navigation, stepping, deep link |
| `tests/e2e/console-options-settings.spec.ts` | the rail, stepper and layout-shift contract (standard + TV) |
| `tests/e2e/console-system-menu.spec.ts` | the in-game menu, its exit stage and the deep link |
