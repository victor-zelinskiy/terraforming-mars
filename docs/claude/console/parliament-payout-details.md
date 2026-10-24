# «ПОДРОБНОСТИ ВЫПЛАТ» — why every seat got exactly what it got

> The owner, 2026-10-24: the sitting's results show «who got what for the enacted resolution» concisely, and that stays;
> the player must be able to open a clear breakdown of it — per resolution, winner-only rewards apart — as an EMBEDDED
> step of the same workspace. Then: «осмотреть подробности — на X (по паттерну), A — дальше».

## The door — the console's inspection grammar

On the RESULTS page (the card revealed, a law that paid some seat — `ConsoleParliamentSection.payoutDetailsDoor`):

| Press | On the card | Inside the step |
| --- | --- | --- |
| **X** «Осмотреть» | opens the step — X inspects the CURRENT object, and on this page that is the payouts | folds it back («Закрыть») |
| **L3** «Источник» | the enacted law in the fullscreen inspector — the SOURCE of the payouts | the same |
| **A** | onward — closes the sitting, as before | the same (the sitting closes from inside the step too) |
| **B** | — (the results page owns no B) | folds the step back («Назад») |
| ↑/↓ · right stick | — | scroll the table (`ConsoleScrollArea`) |

The crumb's tail grows forward one level: «ЗАСЕДАНИЕ › ИТОГИ · ВЫПЛАТЫ». The step titles nothing.

## The phrase — one level deeper on the same card

The enacted law's column (the carried object) never moves; the payouts / world / next-vote columns RELEASE in place
(`.con-sit__results--details`, opacity only); the table UNFOLDS out of the rect the payouts held (`con-sitpd-enter`,
origin over the payouts column) and its sections surface in turn. X / B fold it back. Never a `v-if` blink: the step
mounts inside a `<transition>`.

## The table — a section per RULE (`payoutDetailsModel.ts`, pure, spec'd)

Every number is the server's record (`summary.outcomes` carries every seat's), read by the readers the vote panel and
the results card already stand on — nothing is recomputed.

| Section | Head | A row says why |
| --- | --- | --- |
| `rule` — a scaled effect | the card's own formula (`ConsoleInfluenceYield`, reference) | the seat's RECORDED reading: influence · what was counted · the sum before the cap · the amount (`enactedYieldsOf` with that seat's colour, `person: they`) |
| levy | — | folded INTO the row of the rule that pays in its currency (the reading prints «−10 → … → +7 = −3»); a levy with no such row keeps a section «Что забирает закон» |
| `winner` — a part for the winner alone | ♛ «Награда победителю голосования» · «голосов: N» | the winner's row; the other paid seats named ONCE: «Не положено — только победителю голосования» — never a «0» per seat |
| `grant` — a deed by a rule of WHO (tile grants, Career steps) | «Победителю и каждому с влиянием от N» / «Каждому игроку» | which clause took the seat in or passed it over («Влияние 3 — не ниже линии 2») |
| `reaction` — the ruling party's answer | the party's emblem · «Ответ правящей партии» | — |
| `other` (the colony ledger, …) | the family's title | the parts, grouped by tile |

«Получено» is the results card's own chip renderer — `ConsoleSitPayoutPart.vue`, ONE component for both surfaces, so
the card and the step can never print one record two ways. MarsBot (a seat no law pays) has a row only where it
received something; a world record is the planet line, never a row. Whose row is the player's DOT (a figure is a
delegate that votes).

Files: `payoutDetailsModel.ts` · `sittingPayoutDetailsState.ts` · `ConsoleSittingPayoutDetails.vue` ·
`ConsoleSitPayoutPart.vue` · `console_parliament_payout_details.less`. Spec: `tests/console/payoutDetailsModel.spec.ts`.
