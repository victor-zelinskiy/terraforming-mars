---
name: verify
description: Build, run and drive this Terraforming Mars fork to observe a change at its real surface (console-native shell / desktop UI / server API).
---

# Verify — Terraforming Mars (vize1215 fork)

The surface is a **browser**. The server serves the *built* client from
`build/`, so a client/style change is invisible until you rebuild.

## Handle

```bash
npm run build            # server (tsc) + client (webpack) + css/json — ~2 min
npm run build:client     # client only — ~60 s (enough for .vue/.less/.ts client edits)
npm start &              # serves http://localhost:8080 from build/
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/   # 200 = up
```

Playwright is the driver: `npx playwright test tests/e2e/<spec>.ts --reporter=list`
(config points at `BASE_URL`, default `http://localhost:8080`; it does NOT
start the server — do that yourself).

## Getting into a game (no UI clicking needed)

Create one through the public API, then open the player URL. Copy a full
`NewGameConfig` from `tests/e2e/tv-profile-screens.spec.ts` — **every field is
required**; a partial config 400s.

```ts
const created = await request.post('/api/creategame', {data: newGameConfig()});
const {players} = await created.json();
await page.goto(`/player?id=${players[0].id}&console=1`);   // console native
await page.waitForSelector('.con-start__frame, .con-root', {timeout: 45_000});
await page.waitForSelector('.con-load', {state: 'detached'}).catch(() => {});
```

Config knobs that make driving tractable:
- `testMode: true` → the player starts with 500 of every resource (afford
  anything) and fewer cards, so the start wizard is short.
- `prelude: false` → the start wizard can't stall. With preludes on, a prelude
  needing a card in hand (Eccentric Sponsor) blocks the wizard with 0 cards.
- `seed` + `randomMA: 'No randomization'` + `shuffleMapOption: false` →
  deterministic board. Hazards (Ares) still land at fixed cells per seed.

## Driving console-native (keyboard bridge)

`consoleKeyBridge` maps keys onto the pad semantics — see
`src/client/console/composables/consoleActionModel.ts` (`CONSOLE_KEY_BUTTON`):

| Key | Pad | Meaning |
|---|---|---|
| `Enter` | A | confirm / pick focused |
| `Escape` | B | back |
| `KeyQ` / `KeyE` | LB / RB | prev / next section |
| `Comma` | LT | basic-actions wheel (**Standard Projects** = center slot) |
| `Period` | RT | quick wheel / "continue" in the start wizard |
| `KeyX` | X | secondary (inspect) |
| `KeyR` | view | journal |
| Arrows | d-pad | nav (board cursor moves cell-by-cell during placement) |

**Reaching a tile placement** (the shortest path): walk the start wizard
(alternate `Enter` / `Period` until `.con-start__frame` is gone) → `Comma` →
`Enter` (Standard Projects) → `ArrowDown` ×2 → `Enter` (a placing project) →
the board opens with the right panel in placement mode.

Prefer **adaptive loops over fixed key sequences** — a fixed walk drifts the
moment a step's focus differs. Loop on a DOM/text condition:

```ts
const startScene = page.locator('.con-start__frame');
for (let i = 0; i < 14 && await startScene.count() > 0; i++) {
  await key(page, i % 2 === 0 ? 'Enter' : 'Period', 1100);
}
```

Assert on the right panel's text (`.con-context`) — it's the console's
explaining surface and reads in Russian (`src/locales/ru/*.json`).

## Gotchas

- Playwright's `expect` is **not chai** — `.to.not.eq()` throws. Use
  `.not.toBe()` / `.toContain()`. (Mocha specs under `tests/` DO use chai;
  don't mix the two idioms.)
- `screenshots/`, `test-results/`, `playwright-report/` are gitignored — safe
  to write evidence there.
- The e2e specs are separate from the Mocha suites; `npm run test:e2e` runs all
  of `tests/e2e/`.
- Timings: the deal cinematic + entry animations need ~3.5 s of settle after
  the shell mounts, and ~1 s after each wizard keypress.

## Worth driving

- `tests/e2e/tv-profile-screens.spec.ts` — the console screen gallery across
  display profiles (also the reference for wizard-walking).
- `tests/e2e/console-hazard-placement.spec.ts` — a solo **Ares** game driven to
  a tile placement next to a hazard; asserts the placement panel names the
  forced production reduction. The pattern for any "does the right panel
  explain X" check.
