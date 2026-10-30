# THE SITTING'S RESULTS — the card's LEDGER, and «ПОДРОБНОСТИ ВЫПЛАТ» — why every seat got exactly what it got

> The owner, 2026-10-24: the sitting's results show «who got what for the enacted resolution» concisely, and that stays;
> the player must be able to open a clear breakdown of it as an EMBEDDED step of the same workspace — «осмотреть
> подробности — на X (по паттерну), A — дальше». The owner, 2026-10-30 (P71 · ledger CY): the card is «максимально
> понятная премиальная компактная подача сути того, что игроки получили; всё помещается и использует максимум свободного
> пространства»; the breakdown «детально объясняет, почему игроки получили то, что получили; при необходимости — скролл».

## The card — a LEDGER of TOTALS, solved (`ConsoleParliamentSitting.vue` panel `results`)

Three zones by ROLE — ПРИНЯТА · ВЫПЛАТЫ · СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ — over a quiet FOOT («ЕЩЁ В ЗАСЕДАНИИ»):

- **ВЫПЛАТЫ** is the card's body: ONE ROW PER SEAT, rows of equal height sharing the who column (subgrid — the longest
  name sets it, never cut); the role in a word with the crown on its OWN line under the name (never `margin-left: auto`
  beside it — the crown lay over «Бот»); the viewer's row a cyan kant, the winner's a gold one. A row prints the seat's
  **TOTALS** (`parliamentResultsModel.resultsTotalsOf`), never a chip per record: one token per unit (a supply resource,
  a production step, cards drawn, a resource onto a card with the card's mini name), a LEVY netted into its own unit (the
  budget's «−10 → +7 = −3» IS the M€ token), the ruling party's answer flowing into its unit (its seal marks the source),
  the cards thrown away right after the cards drawn (Pluto's three pairs read «+6 [card] · ⌫3», never six chips), an
  OBJECT (a tile, a parameter's step, a Career walk, a payout that asked nobody) as ONE record drawn by the one record
  renderer, the skips last as one line each. Under the tokens one quiet MARKS row says where they came from — icons only:
  a planet with the law's «×k», a party's seal, the crown. The invariant (spec'd): per unit Σ totals = Σ records, every
  record — a skip included — counted in exactly one total (`data-sit-total-records`). MarsBot's colony bonus is the M€ it
  TOOK (`botMegacredits`, D16) — never the tile's printed text.
- **ПРИНЯТА** — the enacted face sized by the column's HEIGHT; the seals' handover under it (PL-112, untouched).
- **СЛЕДУЮЩЕЕ ГОЛОСОВАНИЕ** exists only when it has something to say: the fresh faces at a size whose caption reads
  (three that do not fit go 2 + 1), the support seals, the no-delegate exception. No fresh resolutions → no row (the
  old «Новые резолюции —» placeholder is gone) and a column only as wide as the seals.

**THE SOLVER** (`console/parliament/resultsLayout.ts`, pure, spec'd over 3 profiles × 1–4 seats × 1–8 totals × with /
without fresh): the card is measured ONCE per pose (a ResizeObserver on the card — the stage, never the viewport; in rem,
so one budget holds on every profile), and the zones' widths, the faces' zooms and the ledger's TOKEN TIER (`hero` →
`regular` → `compact`) are decided from what the card has to say — the largest tier whose estimate fits every row; a
seat that does not fit even `compact` (a theoretical edge) folds its tail into «+N» behind X, named. The numbers reach
the card as variables (`--sit-total-size` · `--sit-row-pad` · `--sit-enacted-zoom` · `--sit-fresh-zoom` ·
`--sit-enacted-w` · `--sit-next-w`); `data-sit-tier` names the tier. Nothing scrolls, nothing leaves its row, no
`overflow: hidden` «solution». The reveal: the director's cascade walks the zones AND each ledger row in turn (35 ms).

The law «the panel never prints what is visible in another zone» (console-ui § THE PARLIAMENT SITTING, law 18) holds:
no influence, no formula, no composition on the card — those are the breakdown's.

Guard: `expectResultsContained` (`tests/e2e/parliamentDrive.ts`) — nothing leaves the card, a row's pieces stay in
their row, no two rows intersect, the crown never covers the name, no name or total is cut, a fresh face keeps its
caption's size, and in the breakdown nothing leaves its seat's column sideways; run by
`console-parliament-results-fit.spec.ts` over the owner's two frames and four more tables on three profiles.

## The door — the console's inspection grammar (unchanged)

On the RESULTS page (the card revealed, a law that paid some seat — `ConsoleParliamentSection.payoutDetailsDoor`):

| Press | On the card | Inside the step |
| --- | --- | --- |
| **X** «Осмотреть» | opens the step — X inspects the CURRENT object, and on this page that is the payouts | folds it back (unadvertised — the bar names B) |
| **L3** «Источник» | the enacted law in the fullscreen inspector — the SOURCE of the payouts | the same |
| **A** | onward — closes the sitting, as before | the same (the sitting closes from inside the step too) |
| **B** | — (the results page owns no B) | folds the step back («Назад») |
| ↑/↓ · right stick | — | scroll the breakdown (`ConsoleScrollArea`) |

The crumb's tail grows forward one level: «ЗАСЕДАНИЕ › ИТОГИ · ВЫПЛАТЫ». The step titles nothing. **On this page A
stands LAST on the bar**: the bar's right zone packs from the right edge, so the last command keeps its place while its
neighbours change between the card and the step.

## The phrase — one level deeper on the same card (unchanged)

The enacted law's column (the carried object) never moves; the ledger / world / next-vote columns and the foot RELEASE
in place (`.con-sit__results--details`, opacity only); the step never SIZES the card (`contain: size`) and UNFOLDS out
of the rect the ledger held (`con-sitpd-enter`), the law's strip and the seats' columns surfacing in turn (reduced
motion: at once). X / B fold it back. Never a `v-if` blink: the step mounts inside a `<transition>`.

## The breakdown — a COLUMN PER SEAT (`payoutDetailsModel.ts`, pure, spec'd)

Over the columns, ONE strip of the LAW (it does not scroll): the card's own formula of every scaled part (ONCE, never
per seat), the rule of WHO of a grant («Победителю и каждому с влиянием от N» / «Каждому игроку»), and — once — the
seats a winner-only part was never owed to («Не положено — только победителю голосования: …»).

Under it a column per paid seat (2–4 side by side, equal width; the Deck stacks them), its four blocks on SHARED rows
(subgrid — a block reads across the seats), read top-down as a derivation:

| Block | What it says | Read from |
| --- | --- | --- |
| head | the seat · the crown and «Победитель голосования · голосов: N» | the summary's winner |
| ВЛИЯНИЕ — only where the law READ it | the number the law read; what it was MADE OF — «Карьера 1 · шаг 1» + a term per giver by NAME («Колониальное представительство +1»); what it MEANT for this law — the seat's recorded reading of every part whose formula reads influence (Colonial Affairs' ×k, a rate, a cap) and the clause of a threshold grant | the SERVER's SNAPSHOT `summary.influenceRead` (`ParliamentPhase.noteInfluenceRead` — once per seat at its first step; never the live `influenceSources`: a card played after the sitting would rewrite the past); an older save prints the number alone; `enactedYieldsOf`, `grantEligibility` |
| ИЗ ЧЕГО — a line per SOURCE | a colony tile with its ×k (and «кубиков: N» when more than one) and its records merged into the line's totals; the levy (its plate «−10», «из 10» when short — the net is ИТОГО's); a part that does NOT read influence with its own reading (counted cards / tiles / tags, the sum before the cap); the winner's reward; the ruling party's answer under its seal | the records (`ConsoleSitPayoutPart` — the ONE record renderer); `enactedLevyOf`, `enactedYieldsOf` |
| ИТОГО | the seat's totals | `ConsoleSitTotals` over `resultsTotalsOf` — the SAME renderer and function as the card's row (e2e compares them token for token) |

Every number is a field of a record or of the snapshot — nothing is recounted. Each scaled part's reading is printed
exactly ONCE (the influence block when its formula reads influence, else on its line — spec'd). MarsBot (a seat no law
pays) has a column only where it received something; a world record is the planet line, never a seat's.

Files: `parliamentResultsModel.ts` (totals) · `resultsLayout.ts` (the solver) · `payoutDetailsModel.ts` ·
`sittingPayoutDetailsState.ts` · `ConsoleSitTotals.vue` · `ConsoleSitPayoutPart.vue` · `ConsoleSittingPayoutDetails.vue` ·
`console_parliament_sitting.less` · `console_parliament_payout_details.less`. Specs: `tests/console/parliamentResults.spec.ts`
§ TOTALS, `tests/console/resultsLayout.spec.ts`, `tests/console/payoutDetailsModel.spec.ts`,
`tests/parliament/InfluenceRead.spec.ts`; e2e `console-parliament-results-ledger`, `console-parliament-results-fit`,
`console-parliament-payout-details`.
