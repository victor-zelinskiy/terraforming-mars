# Journal / notification "resource gain not shown" audit

## Symptom (reported)

`СФ-БАКТЕРИИ` (Sulphur-Eating Bacteria) action *"spend any number of microbes here to
gain triple M€"*: the journal + notifications showed only the microbe SPEND
(`СФ-бактерии → −22`) but NOT the M€ the player gained. Same for `Челноки с Титана`
(Titan Shuttles) — spend floaters → gain titanium — the titanium gain didn't show.

## Root cause

The journal and the notification system are built from the STRUCTURED `GameEvent`
stream (`/api/game/journal-events`, `EventRecorder`). A resource change is recorded
ONLY when it flows through `Stock.add()` / `Stock.deduct()` (which call
`events.recordResourceDelta`). These cards instead wrote the gained resource with a
DIRECT field mutation:

```ts
player.megaCredits += megaCreditsGained; // Sulphur-Eating Bacteria
player.titanium   += amount;             // Titan Shuttles
```

`player.megaCredits` is a setter that writes `this.stock.megacredits` DIRECTLY (it does
NOT go through `Stock.add`), so NO `GameEvent` is emitted — the gain is invisible to the
journal/notifications. The SPEND used `player.removeResourceFrom(...)` (which DOES record
a card-resource event), hence "−22" showed while the gain didn't.

## A CLASS, programmatically enumerated

Grep for `player.<standardResource> +=` across all card files. IN-SCOPE (base / corpera /
promo / venus / colonies / prelude) cards that GAIN a resource via a direct write:

| Card | module | gain | spend side |
| --- | --- | --- | --- |
| **Sulphur-Eating Bacteria** | venus | `megaCredits += 3×n` | `removeResourceFrom` (recorded) |
| **Titan Shuttles** | colonies | `titanium += n` | `removeResourceFrom` (recorded) |
| **Sell Patents** (std project) | base | `megaCredits += cards.length` | discard (n/a) |
| **Mons Insurance** (`payDebt`) | promo | claimant `megaCredits += 3` | owner via `deduct` (recorded) |
| **Hired Raiders** (solo branch) | base | `steel += 2` / `megaCredits += 3` | n/a (solo "neutral" steal) |
| **Asteroid Rights** | promo | `titanium += 2` | `this.resourceCount--` (NOT recorded) |
| **Astrodrill** | promo | `titanium += 3` | `this.resourceCount--` (NOT recorded) |

(Out-of-scope cards with the same pattern — Bjorn, Stefan, Trade Advance, Ceres Tech
Market, Valuable Gases, Utopia Invest, Sol Bank, underworld Hired Raiders — are left for
when those expansions are adapted; same one-line fix.)

The MULTIPLAYER Hired Raiders steal is already correct — it goes through
`target.attack(..., {stealing:true})` → `Stock.steal` → `thief.stock.add(...)`, which
records the attacker's gain. Only its SOLO branch wrote the field directly.

## Fix

Replace the direct write with `player.stock.add(Resource.X, n)` (records the event; the
existing manual combined log is kept, so no double-logging). For **Asteroid Rights** and
**Astrodrill** the paired asteroid spend used a raw `this.resourceCount--` (also
unrecorded), so it was converted to `player.removeResourceFrom(this, 1, {log:false})` —
now BOTH the spend and the gain show in the journal. Numerically identical (verified by
the existing card specs); only the event recording is added.

`stock.add`'s `recordResourceDelta` SKIPS a sourceless delta when no action/effect scope
is active (loose bookkeeping) — but the live game always runs an action inside a scope
(the action menu wraps `action()` in `events.beginAction`), so the gain is recorded in
play. (The guard test mirrors that scope.)

## Verification

- `npm run build:server` — clean. ESLint — clean on all changed files.
- New guard `tests/events/resourceGainJournal.spec.ts` — asserts the +M€ (Sulphur-Eating
  Bacteria) and +titanium (Titan Shuttles) gains are recorded as `resource-changed`
  GameEvents inside an action scope (would FAIL if reverted to a direct field write).
- All touched card specs (Sulphur-Eating Bacteria, Titan Shuttles, Mons Insurance,
  Asteroid Rights, Astrodrill, Hired Raiders, Sell Patents) + `tests/events/**` (60) —
  pass.

## Manual scenario to confirm in-game

Play Sulphur-Eating Bacteria's "spend N microbes" action: the journal/notification now
shows BOTH `−N microbes` AND `+3N M€`. Same for Titan Shuttles (`−N floaters` / `+N
titanium`), Asteroid Rights / Astrodrill (`−1 asteroid` / `+titanium`), Sell Patents
(`+M€`), and a victim's Mons Insurance compensation (`+3 M€`).
