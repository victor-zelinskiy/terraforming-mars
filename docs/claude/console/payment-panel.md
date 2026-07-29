# Console payment — ONE panel, TWO densities

The console-native payment UI. Everything a player ever pays for — a project
card, a blue-card action, a standalone `SelectPayment` prompt, a colony trade
fee — renders the SAME block, in one of two densities.

> Compact Payment Summary  →  LT  →  Expanded Payment Editor
>
> Same rows · same order · same icons · same numbers · same verdict · same
> geometry. The switch changes DENSITY, never content or position.

Before this rework the quick summary and the LT editor were two independent
implementations with two visual languages, two number formats (`×2 2 / 4` vs
`4 → 2`) and two totals — and the editor replaced the whole right column, so LT
read as "a separate technical form". A row appearing/vanishing with the mix
(the M€ lane) also resized the panel and shoved the CTA around.

---

## The pieces

| Layer | File | Owns |
| --- | --- | --- |
| Rules + math | `src/client/console/paymentPlan.ts` | lanes, rates, caps, auto-M€, coverage, overpay, **and the presentation model** |
| Panel | `src/client/components/console/ConsolePaymentPanel.vue` | head (title · price · mode hint) + rows + verdict |
| Row | `src/client/components/console/ConsolePaymentSourceRow.vue` | one payment source |
| Verdict | `src/client/components/console/ConsolePaymentStatus.vue` | paid / cost / exact · overpay · shortfall |
| Styles | `src/styles/console_payment.less` | `.con-pay` / `.con-payrow` / `.con-paystatus` + profile tokens |

`buildPaymentView({cost, lanes, counts, mcAvailable})` → `PaymentView` is the
**single source of truth**. If a number is on screen anywhere in a payment
surface, it came from a field of that object. No host re-derives a total, a
remainder or a verdict; the components never mutate and never emit.

```ts
PaymentSourceRow = {
  unit, labelKey, rate,          // what it is and what one unit buys
  available, used, remaining,    // the stock story  (available → remaining)
  contribution,                  // used * rate — its share of the price, in M€
  auto, editable, reserved,      // M€ self-balances; reserve is display-only
  min, max, canDecrease, canIncrease,
  quickAdjust,                   // owns the bumpers on the COMPACT screen
}
PaymentStatus = {kind, cost, paid, delta, labelKey, ok}
//   kind: free | auto | exact | overpay | short | impossible
```

**Row order is fixed**: alt lanes in payment order, then M€ — always last,
**always rendered, even at 0 spent**. Both densities render the same list.

## Hosts

| Surface | Density | Entry to the editor |
| --- | --- | --- |
| `ConsolePlayCardConfirm` (play a card) | compact, expands in place | LT · also A on a shortfall-blocked CTA |
| `ConsoleActionComposer` (blue action) | compact, expands in place | LT on the primary payment choice |
| `ConsoleTaskHost` (standalone `SelectPayment`) | **expanded** (the screen IS the payment) | — (`hint-mode="none"`) |
| `ConsoleColonyTradeConfirm` (trade fee) | **expanded** sub | its own sub row |

A host owns ALL input and the `counts` state; the density is a prop. Two hosts
that pay for different things therefore cannot drift apart visually.

Controller grammar in the editor: d-pad ↑↓ walk the editable sources · LB/RB and
←→ dial the focused one · RT = MAX · A = «Готов» (fold back, mix kept) · **LT
toggles back** (the button that opened it) · B = back.

## The layout-shift contract (load-bearing)

The payment block's height must be CONSTANT for a given prompt, whatever the
mix — the composer's CTA must not move while the player dials. Four rules, all
of them are why the code looks the way it does:

1. **The M€ row is always rendered** (`buildPaymentView` appends it at 0 spent).
   A lane that appeared with the mix was the original bug.
2. **Every row reserves `--con-pay-row-h`**, sized for the TALLER (expanded,
   two-line) cell — so revealing the micro captions costs 0 px.
3. **The numeric columns have fixed widths**, each sized for 3 digits AND for
   its expanded caption. `tabular-nums` alone only fixes digit width, not digit
   count — `9 → 10` would still nudge a neighbour.
4. **`.con-paystatus` is unconditional** and reserves `--con-pay-status-h`
   (two wrapped lines' worth), so an appearing «Переплата» costs 0 px in any
   locale.

And: **`.con-pay--expanded` may only change PAINT** — background, rim, focus,
captions. Never a padding, a gap or a height. That is what makes LT a
zero-pixel transition. The result hero dims (`--muted`) instead of unmounting;
the CTA relabels («Готов») instead of disappearing.

Guarded by:
- `tests/client/components/console/consolePaymentPanel.spec.ts` — both
  densities render identical rows/values; exact ⇄ overpay adds no element.
- `tests/client/components/console/composerRender.spec.ts` (`payment` describe)
  — the blue-action flow: bumpers without a cursor, LT expands in place with
  the CTA dock still mounted, an overpay adds no box.
- `tests/e2e/console-payment-panel.spec.ts` — the real shell: the CTA's
  bounding box is **pixel-identical** across the whole dial range and across
  compact ⇄ expanded, at 1080p / 4K TV / Steam Deck.

## Profiles

Only the tokens at the top of `.con-pay` move per profile
(`html.con-profile-tv`, `html.con-profile-handheld`) — never the structure.
Nothing key is dropped on the handheld: used, remaining, contribution and the
verdict are all asserted visible in the e2e profile matrix.

Perf mode: every functional cue (focus, at-limit pill, idle row, verdict) is
`box-shadow` + colour, never `filter`/`opacity` — `con-perf-lite` strips
filters and must not remove a navigation or a warning cue.

## i18n

Keys live in `src/locales/ru/console.json`: `Used`, `Tops up`, `Contribution`,
`Exact payment`, `Overpay`, `Not enough`, `Paid automatically`,
`Back to quick payment`, `of` — plus the pre-existing `Payment`, `Cost`,
`Paid`, `Remaining`, `Free`, `auto`, `Configure payment`,
`Not enough resources`, `reserved` and the per-unit names.
`paymentUnitLabel()` is the ONE unit→key table (three copies used to drift).
