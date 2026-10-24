# The delegate is ONE figure — card, hall, Career and chips speak one silhouette

> Prompt: `docs/claude/prompts/parliament-delegate-figures.md` (2026-10-24). Owner's decisions of the same day: a **bust
> standee** on a disc base · the card stays a **print** · an **18 logical px floor**, chip density yields first, never a
> scroll · **no spin** in flight.

The Parliament used to draw the delegate three ways at once: a white bust PNG on the cards, a `PlayerCube` in the hall,
coloured squares and hollow circles in the chairman's race. The cube is the mark of OWNERSHIP (a city, a greenery, a
colony, a milestone) — not a person standing on a resolution. Now there is one silhouette and one piece.

## 1. One silhouette (`src/client/components/playerToken/delegateGlyph.ts`)

`DELEGATE_PATH` — an egg-shaped head tapering to the chin over a rounded shoulder block, 40 × 52 design units (1 : 1.3),
the scan's figure. Everything that names a delegate draws THIS path:

| Where | How |
| --- | --- |
| Card face, requirement plate | `assets/misc/delegate.svg` (white print, dark rim) — `premiumCardIcons.ts`, `premiumCardViewModel.ts` |
| Neutral delegate on a card / a chip | `assets/misc/delegate-neutral.svg` (graphite print, light rim) — never a CSS-dimmed copy (the console strips `filter`) |
| Journal, resource and Career chips (`resource_icon--delegate`, `HOLDER_ROLE_ICON.delegate`) | the same two SVGs |
| The standard project «delegate», MarsBot's bonus face | the white SVG (the ★ and the ▪ are gone) |
| The piece on the table | `PlayerDelegate.vue` — the same path as a standee |

The bust PNGs (`delegate.png`, `neutral-delegate.png`, `underworld/neutral-delegate.png`) are deleted. Guard:
`tests/parliament/DelegateGlyphParity.spec.ts` — both SVGs draw `DELEGATE_PATH` byte for byte, the component draws no
silhouette of its own, nothing in `src/client` / `src/styles` prints a bust PNG.

## 2. One palette (`src/client/components/playerToken/playerTokenPalette.ts`)

`BASE_RGB` / `STEEL_RGB` / `SYMBOL` and the derived tones moved out of `PlayerCube.vue`. `tokenStyleVars(color, {steel})`
returns the `--pt-*` set (`base · top · left · right · far · back · bottom · edge-hi · glow · symbol`) both pieces paint
with — a player's delegate stands in EXACTLY that player's cube RGB; the neutral delegate is the cube's steel. `neutral`
without `steel` is still bronze (the board's semantics) — the hall always passes `steel`. Guards:
`tests/client/components/playerTokenPalette.spec.ts` (every tone frozen at the pre-extraction cube; the cube's inline
vars = the module's, byte for byte) and `PlayerDelegate.spec.ts` (figure ≡ cube per colour, steel included). Both
pieces carry `data-player-token="<color>"` — the e2e hook for «whose piece is this», cube or figure alike.

## 3. The figure (`PlayerDelegate.vue` + `src/styles/player_delegate.less`)

Anatomy, back to front: the CONTACT SHADOW (a sibling of the body, on the table) · a whisper of GLOW on the upper body ·
the BODY (`__body`: an SVG — the disc's side `--pt-bottom`, its lit top `--pt-right`, the silhouette `--pt-top` with the
cube's depth gradient, a turned-away shade, the satin sheen upper-left, a far-edge rim catch in `--pt-edge-hi`, the cut
edge, AO where it stands in the disc) · the colour-blind glyph on the CHEST (the disc is 3 px tall at the floor).
No `filter` anywhere.

**Size is the HEIGHT** (box 0.8 × size wide). Two ways to size it:
- a PLACE sizes it in rem — `--pd-host` on the place (`.9rem` = 18 logical px is the floor and the fallback), so the
  place, its footprint and the figure live in one rule and scale with the profile's rem;
- a CHIP beside a name sizes it in JS — `:size="figurePx(n)"` over `delegateFigurePx(n)` (`delegateFigureSize.ts`,
  never under 18).

| Place | `--pd-host` / size |
| --- | --- |
| Ribbon slot `__vote-cube` | 1.15rem (23) — handheld .95rem |
| Dense ribbon stack `__vote-stack` | 1.05rem |
| Lobby socket `__socket--seat` · reserve pile `__stack--seat` | 1.05rem — handheld .92rem |
| Threshold places `__place`, plaque `con-pseal__place`, support places `con-pseal__support-place`, effects / status places | .9rem (the floor) |
| Support mode panel | 1.5rem · vote panel's support block 1.1rem |
| The chair | 2.2rem (44, `CHAIR_FIGURE`) — seated in a medallion in the holder's cube colour, the name under it |
| Information › Парламент, the dossier | 28 (JS) |
| Chips: leader, fact rows, dossiers | 18–26 (JS) |

Flight variables (all 0 / 1 at rest — the proxy at the touchdown is pixel-identical to the figure under it):
`--pd-lift` (px the body stands above its base) · `--pd-tilt` (deg, the lean) · `--pd-grow` (toward the camera) ·
`--pd-air` (0 → 1, the shadow pales and spreads) · `--pd-squash`.

**A figure is a delegate that VOTES** (the owner, 2026-10-24): WHOSE row / number is marked by the player's DOT
(`con-parl__seat-dot`, the neutral's steel dot) — the delegates ledger's row, the Career head «Ваше влияние», the
chairman quest's race rows — never by a figure, so every figure on the ledger is one the player can still spend (lobby,
reserve, supply). A player's PLACE on the Career is THE TRACK MARKER's disc (`docs/claude/console/track-marker.md`), the
Hydronetwork's own language — never a figure either.

## 4. A place is a FOOTPRINT (`.pd-footprint(@fig)`)

The elliptical trace the disc stands in (0.68 × the figure's height wide, its top face 0.17 high). Empty = the trace;
filled = the figure standing IN it (the disc covers the trace exactly). States speak through the trace's variables —
never a box around the figure: `--pd-foot-rim`, `--pd-foot-style` (solid / dashed — the dash, not a colour alone, tells a
forecast), `--pd-foot-fill`, `--pd-foot-glow`. `.pd-footprint-target(@rim)` is the place a delegate is about to take
(dashed rim, a calm compositor-only breath); `.pd-footprint-landed(@ring)` is the touchdown — ONE contact ring off the
trace (≤ 240 ms) and the figure settling 2 px down and back. The scale pulse `con-parl-land`, the dashed square ghost
and the retired hex silhouette of the support sockets are gone. In the hall's row plaques the threshold places stay the
seal's two arcs (the trace is switched off there — the arcs ARE the places).

## 5. The flight — «взял → понёс → поставил» (`delegateFlightPose.ts` + `runDelegateFlight`)

One progress, three beats, each on the motion system's own curve:

| Beat | Base ms | Curve | What happens |
| --- | --- | --- | --- |
| TAKEN | 140 | `MOTION_EASE.enter` | the body rises off its footprint (`liftPx` ≈ 0.75 × height), grows ×1.35 toward the camera, leans 8–12° INTO the travel (a column lift barely leans); the shadow stays on the table; `onLifted` — the real figure hides, its footprint shows |
| CARRIED | 380–620 by distance | `MOTION_EASE.convey` | the BASE — and the shadow with it — rides the straight line between the footprints; the body an arc above it; the lean held; **no spin** |
| SET DOWN | 160 | gravity (`MOTION_EASE.exit`), the lean on `MOTION_EASE.settle` | the body comes down onto its base, the lean resolves, the shadow gathers; `onLanded` the frame they meet; the real figure materializes, its place plays `.pd-footprint-landed` |

`delegateFlightMs(distance)` = 140 + clamp(380 … 620) + 160 (the viewer's own vote). The sitting's figures keep their
one tempo (`CUBE_FLIGHT_MS` 480 — the support scene's 90 / 180 ms rhythm is written against it); the beats keep their
proportions inside it. The proxy stands on its BASE (transform origin 50% 100%) and is sized by the figure's height
(`FlightSpec.size`). Reduced motion: the plain glide / the fade-and-drop arrival. Holds, «дожать» and `onInterrupt` are
the existing ones (`progress(1)` writes the rest pose).

**One entry**: `flyDelegate(color, from, to, delayMs, onLanded, {onLifted})` and `placeFigureRect(root, selector)` (a
figure's rect on a place — the front figure of a pile, else the figure the footprint would hold at its `--pd-host`,
standing on the place's floor). Callers: the viewer's vote (`flyOwnDelegate`, distance-paced), a rival's vote and
rally (`parliamentRivalVotes`), the sitting (`sittingDirector`), the support discard, the chairman quest, the seat pick.
`flyCube` / `placeCubeRect` are gone.

**Who carries it**: while another seat's (or a rival card's neutral) figure is in the air, the place it LEFT lights
warm-white (`con-parl__seat-place--carrying`, `[data-parl-carrying]`) — who moves it reads by its place, not by colour
alone.

## 6. Hooks

Unchanged (names are contracts): `data-parl-seat-lobby / -reserve / -chair`, `data-parl-neutral-cube` (a hook name, not a
promise of a cube), `data-seq`, `data-support-place`, `data-pseal-place`, `data-parl-vote-place`, `data-parl-seat-landed`,
`data-parl-flight`, `.con-parl__stack-cube`, `.con-parl__vote-cube`. New: `data-player-token="<color>"` on both pieces,
`.player-delegate` / `.player-delegate--steel`, `data-parl-carrying`. The parliament e2e specs read
`[data-player-token=…]` instead of `.player-cube`.

## 7. Probes

- `tests/e2e/console-player-token-parity.spec.ts` — the `?cubePlayground` stand's «Delegate figures» section: every
  figure's resolved `--pt-*` = its cube's, the box is 0.8 × its height and never under the floor, the prints are the
  SVGs; the storyboard at 4K and at 25 % («the couch») in `screenshots/delegfig/`.
- `tests/console/delegateFlightPose.spec.ts` — rest at both ends, the shadow on the straight line mid-carry, the lean
  bounded and signed, the descent monotonic, the pace.
- `scripts/delegate-figure-preview.ts` — a browserless design preview (sharp) of the figure's layers in every tone.
