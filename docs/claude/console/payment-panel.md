# Console payment — ONE panel, TWO densities

The console-native payment UI. Everything a player ever pays for — a project
card, a blue-card action, a standalone `SelectPayment` prompt, a colony trade
fee — renders the SAME block, in one of two densities.

> Compact Payment Summary  →  LT  →  Expanded Payment Editor
>
> Same rows · same order · same icons · same numbers · same verdict · same
> geometry. The switch changes DENSITY, never content or position.
>
> …and **the switch only exists where it changes something**: with a single
> alternative source the compact block already IS the editor.

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
//   kind: free | exact | overpay | short | impossible
```

Three lane-count facts come out of the same object, and no host re-derives them:

| Field | Means | Drives |
| --- | --- | --- |
| `configurable` | ≥1 alternative source | paint / a11y («this mix is yours to shape») |
| `quickAdjustEligible` | **exactly 1** alternative | the inline dial: LB/RB + RT МАКС. on the row itself |
| `editorEligible` | **≥2** alternatives | the LT entry — and nothing else |

### Which units can reach the panel at all — `GENERIC_PAYMENT_ORDER`

`paymentLanes` iterates **`GENERIC_PAYMENT_ORDER`** (`paymentModelUtils.ts`) and
narrows it twice: `paymentOptionsAllowResource(prompt.paymentOptions, unit)`,
then «does the player own any». Everything downstream — rows, dial, editor,
verdict, submitted `Payment` — is generic over the resulting lanes.

So **the order is not a preference list, it is the reachable set**: a unit
missing from it is a unit no console payment surface can offer, however loudly
the server says it may be spent. Four of them were absent by omission
(`plants`, `microbes`, `floaters`, `lunaArchivesScience`), which silently
disabled Martian Lumber Corp, Psychrophiles, Dirigibles and Luna Archives
everywhere: the server sent `paymentOptions.plants = true` for a building card
and the client had nowhere to put the lane. The list must stay a **superset of
`SPENDABLE_RESOURCES`** — guarded in `paymentPlan.spec.ts`.

Two rules ride with it:

- **The default mix never cashes in a resource that has another use.**
  `computeDefaultPayment`'s greedy pass exists because steel / titanium / the
  payment-card resources buy nothing else. Heat (temperature) and **plants**
  (greeneries — 8 of them are a tile, a TR step and a VP) are exempt
  (`NON_GREEDY_UNITS` in `PaymentDefaults.ts`): spent up to the MINIMUM the
  price demands and no further, so a card that is only affordable *with* plants
  still opens affordable, and one that is not leaves them alone.
- **A ledger key is not a sprite key.** `paymentUnitIcon` maps
  `microbes → microbe`, `auroraiData → data`, `lunaArchivesScience → science`, …
  The `card-resource-*` classes are generated SINGULAR from the LESS
  `@card_resource_types` list, so the raw keys resolved to classes no stylesheet
  defines and painted an empty box.

**A standard project is NOT a project card** (`buildStandardProjectPaymentOptions`):
it accepts a CLOSED list mirroring `SelectStandardProjectToPlay.process`, never a
spread of the card-play grants — the base options carry `plants`, the server's
standard-project branch has no `plants` term, and offering that lane would end in
«Did not spend enough to pay for standard project» after the player built the mix.

### The editor only exists where it is a second STAGE

`editorEligible` is `lanes.length > 1`, not `> 0`. With one alternative the
expanded editor would render the same rows, with the same numbers and the same
captions, plus a cursor that has exactly one place to stand — the player pressed
LT and arrived where they already were. So:

- the panel draws no «Настроить оплату» hint, and neither command bar offers LT;
- `openPaymentEditor` refuses in both composers (the entry is not merely hidden);
- the play composer's A-on-a-shortfall fallback stays silent too — there is no
  editor to lead the player into, and the fix is the bumpers under their thumbs;
- **RT МАКС. therefore belongs to the inline dial**, in the bar and in the input,
  or the single-lane case would lose «fill it up» along with the editor.

Two or more alternatives keep the editor exactly as it was: the bumpers cannot
express «3 steel AND 1 titanium», so the cursor earns its screen.

**Row order is fixed**: alt lanes in payment order, then M€ — always last,
**always rendered, even at 0 spent**. Both densities render the same list.

**There is no «оплачено автоматически» verdict.** Only the M€ LANE is automatic
(and its own row says so with the «АВТО» badge); the combination it completes
can hold hand-picked resources, so judging the whole mix by that one lane was
saying something false about the others. A covered mix reads `exact`
(«✓ ОПЛАЧЕНО 12 / 12 · ТОЧНАЯ ОПЛАТА») or `overpay` («⚠ ОПЛАЧЕНО 13 / 12 ·
ПЕРЕПЛАТА +1») in EVERY density and every host — one vocabulary.

### The AGGREGATE anti-overpay limit

`laneCap(cost, lane, lanes, counts)` measures a lane's ceiling against
`alternativeContribution(lanes, counts)` = `Σ(used × rate)` over the OTHER
alternative lanes (M€ excluded — it is the auto lane and settles the
remainder). A per-row `ceil(cost / rate)` let every alternative reach the full
price independently: a 12 M€ card took 4 steel ×3 **and** 3 titanium ×4 and
committed 24. The rule now:

- while the combination is below the price, any owned alternative may take one
  more unit;
- the last unit may cross the price ONCE (an indivisible rate remainder — 3
  steel + 1 titanium = 13/12 is legal and reads as `overpay`);
- from that crossing on, `canIncrease` is false on EVERY alternative at once;
- `−` is never blocked, and dropping one source re-opens `+` on all of them.

`dialLaneCount(cost, lane, lanes, counts, step | 'max')` is the ONE mutation
every host's `+` / `−` / `RT МАКС.` goes through, so the limit is enforced in
the state change and not only in the row's paint — a repeat that fires twice
between two renders never reaches a render. `'max'` means «as much of THIS
source as is still useful», never «enough to cover the whole price alone».

## Hosts

| Surface | Density | Entry to the editor |
| --- | --- | --- |
| `ConsolePlayCardConfirm` (play a card) | compact, expands in place | LT · also A on a shortfall-blocked CTA — **both only when `editorEligible`** |
| `ConsoleActionComposer` (blue action) | compact, expands in place | LT on the primary payment choice, **only when `editorEligible`** |
| `ConsoleTaskHost` (standalone `SelectPayment`) | **expanded** (the screen IS the payment) | — (`hint-mode="none"`) |
| `ConsoleColonyTradeConfirm` (trade fee) | **expanded** sub | its own sub row (no inline dial there — that row is the only door, whatever the lane count) |

A host owns ALL input and the `counts` state; the density is a prop. Two hosts
that pay for different things therefore cannot drift apart visually.

Controller grammar on the COMPACT screen (single alternative): LB/RB dial the
lone lane · **RT = MAX** · no LT · A stays the screen's own primary.

Controller grammar in the editor: d-pad ↑↓ walk the editable sources · LB/RB and
←→ dial the focused one · RT = MAX · A = «Готов» (fold back, mix kept) · **LT
toggles back** (the button that opened it) · B = back.

## The layout-shift contract (load-bearing)

The payment block's height must be CONSTANT for a given prompt, whatever the
mix — the composer's CTA must not move while the player dials. Four rules, all
of them are why the code looks the way it does:

1. **The M€ row is always rendered** (`buildPaymentView` appends it at 0 spent).
   A lane that appeared with the mix was the original bug.
2. **Every row reserves `--con-pay-row-h`**, sized for the two-line cell — and
   BOTH densities now draw both lines (the caption naming each number is not a
   detail the quick summary can do without: «4» alone does not say spent, left
   or worth). Compact keeps them dim, expanded lifts them — paint, 0 px.
3. **The numeric columns have fixed widths**, each sized for 3 digits AND for
   its expanded caption. `tabular-nums` alone only fixes digit width, not digit
   count — `9 → 10` would still nudge a neighbour.
4. **`.con-paystatus` is unconditional** and reserves `--con-pay-status-h`
   (two wrapped lines' worth), so an appearing «Переплата» costs 0 px in any
   locale.

And: **`.con-pay--expanded` may only change PAINT** — background, rim, focus,
caption tone. Never a padding, a gap or a height, and (since the captions are
permanent) never an element either. That is what makes LT a zero-pixel
transition. The result hero dims (`--muted`) instead of unmounting;
the CTA relabels («Готов») instead of disappearing.

Guarded by:
- `tests/client/components/console/consolePaymentPanel.spec.ts` — both
  densities render identical rows/values; exact ⇄ overpay adds no element; the
  LT hint appears only for a multi-lane payment.
- `tests/client/components/console/composerRender.spec.ts` (`payment` describe)
  — the blue-action flow: bumpers without a cursor, RT fills the lone lane, LT
  is a NO-OP on a single-alt payment, LT expands a MULTI-lane block in place
  with the CTA dock still mounted, an overpay adds no box.
- `tests/e2e/console-payment-panel.spec.ts` — the real shell: the CTA's
  bounding box is **pixel-identical** across the whole dial range and across
  compact ⇄ expanded, at 1080p / 4K TV / Steam Deck; and where no editor exists
  the LT press changes nothing at all.

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
`Exact payment`, `Overpay`, `Not enough`, `Paid automatically` (the M€ ROW's
aria only — never a verdict), `Back to quick payment`, `of` — plus the
pre-existing `Payment`, `Cost`,
`Paid`, `Remaining`, `Free`, `auto`, `Configure payment`,
`Not enough resources`, `reserved` and the per-unit names.
`paymentUnitLabel()` is the ONE unit→key table (three copies used to drift).
