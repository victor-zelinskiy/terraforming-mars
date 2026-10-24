# THE TRACK MARKER — one language for a player's place on a track

> The owner, 2026-10-24: the Career's markers become «точки в том же языке, что на гидросети … можно даже движения
> перейти на тот же фреймворк, чтобы если дальше будет дорабатываться — дорабатывалось вместе (единый премиум язык)».

Two tracks show where each player STANDS: the Hydronetwork's stops and the Parliament's Career. They speak ONE language
and are moved by ONE director. A change to the language or to the motion is a change to both.

## The disc — `src/styles/console_track_marker.less`

| Mixin | What it is |
| --- | --- |
| `.con-track-marker(@size)` | the resting disc: the owner's colour (`player_bg_color_*` paints the background), a lit cap, a firm dark ring |
| `.con-track-marker-viewer()` | the viewer's own disc: the track's ACCENT as a glow (the disc's colour stays the owner's) |
| `.con-track-marker-settle()` | the one-shot settle (keyframes `con-track-marker-settle`) when a glide has just locked its real disc in |
| `.con-track-proxy-body(@size)` | the flying copy |
| `.con-track-proxy-phases()` | the director's phase modifiers (`--charge` · `--glide` · `--lock` · `--pulse`), called on the block the phase class extends |

A track names only its accent — `--con-track-accent: r, g, b` on the disc's host and on its proxy — and its size:

| Track | Disc | Proxy | Accent |
| --- | --- | --- | --- |
| Hydronetwork (`.con-hydro__stop-marker`, `.con-hydromarker`) | .65rem | .75rem | aqua 79, 201, 216 |
| Career (`.con-parl__agenda-dot`, `--proxy`) | .8rem (Deck .66rem) | .8rem | the career's gold 230, 195, 74 |

## The motion — `src/client/console/hydroMarker/hydroMarkerDirector.ts`

`runHydroMarkerGlide({marker, from, to, reduced, skipCharge, onPhase})` — charge · glide · arrive · lock · release, every
duration through `motionMs()`, reduced motion without lift or pulse. Both tracks hand it a proxy and two measured rects
and write `onPhase` onto the proxy's class (the Career did not before — its proxy now wears the same charge, trail and
seat ring). The Career's walk (`ConsoleParliamentAgenda.playAgendaWalk`, phrased by `agendaWalkDirector.ts`) is one call
per leg; the disc it locks in settles with the shared one-shot.

## Hooks (unchanged — contracts)

`[data-agenda-markers]`, `.con-parl__agenda-cube[data-agenda-cube]` (+ `--hidden`), `.con-parl__flight--agenda`;
`[data-hydro-marker]`, `.con-hydro__stop-marker`, `.con-hydromarker`. A delegate FIGURE is never a track marker
(`parliament-delegate-figure.md` § 3).
