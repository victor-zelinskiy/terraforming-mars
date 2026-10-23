# THE PACKET SHOWCASE — the draft and the research buy on the 4K TV (T10 · CE, 2026-10-23)

The between-generations draft and the research buy (`ConsoleDraftWorkspace`, `.con-draftws` — architecture in
`docs/CONSOLE_FOUNDATION.md` §10c and the memory `console-draft-workspace`) is the most frequent screen between
generations, with a draft and without. On the 4K TV it stood as a form: the four cards in the top 55 % of the opening,
the shelf «ОТОБРАННЫЕ» four empty boxes, the wait an empty field with a check mark, the card read by its name alone.
This is the contract of the showcase that replaced it. Stand: `tests/e2e/console-draft-showcase.spec.ts`; ledger CE.

## 1. The planner — the body is SHARED, solved from the measured box

`console/draft/draftShowcaseLayout.ts` `planDraftShowcase(input)` (pure) shares the workspace BODY between the PACKET
(the stage's cards), the SHELF (the drafted cards as real faces) and the READING row:

- The packet is WIDTH-bound on every grown profile (four cards across the whole width) — the cards cannot grow, so
  the dark the old layout left is what the planner hands to the shelf. The packet takes its largest size first (one
  line across, or the height left over a shelf at its FLOOR), the shelf takes the rest, up to HALF a card (a
  thumbnail never competes with the protagonist).
- **The rack is CONSTANT for the whole draft**: its reference is the draft's widest packet (as many cards as the
  draft takes), so a later, shorter packet grows its own cards into the same stage box and never moves the shelf
  (the memory's law «the rack is a constant» kept).
- **The base profile does not grow**: the Deck (`handheld`) keeps the seat at its floor (5.5 rem) — its contract is
  «fits without a scroll».
- Two compositions (`stack` — the shelf a band under the packet; `side` — a column beside it); the live one is ONE
  constant (`DRAFT_SHOWCASE_COMPOSITION`).
- The component measures (the body, the reading row, the card's unzoomed box, the row's paddings), plans
  synchronously in `fitStage` and publishes custom properties on the root — `--con-draftws-shelf-block` (the
  stage's inset), `--con-draftws-seat-w/-h/-zoom` (the seats and the faces in them), `--con-draftws-wait-scale/-lift`.
  The card row itself stays the shared stage solver's (`wsStageLayout`) over the box the plan leaves.

## 2. The shelf — faces, places, and the wait that brings it forward

- A seat holds the card's real premium face (`Card … lightweight` at `--con-draftws-seat-zoom`); a prepared seat
  names its PLACE («2 · 3 · 4», `[data-shelf-seat]`) — never a bare box.
- The rack is centred and sized by its seats; it moves only by `translate` + `scale` (transitionable, nothing
  re-laid out), so a flight measured on a seat stays true.
- **THE WAIT brings the SAME rack forward** (`.con-draftws--waiting`): lifted to the stage's middle and scaled by the
  planner (on the TV the faces reach ≥ 40 % of the body), its plate dissolving so the faces stand on the stage; the
  pass lane keeps the top. Only the FACES come forward: the shelf's head («ОТОБРАННЫЕ 1/4 · LT») dissolves — scaled with
  the rack it stood over the pass lane's lines (the 4K frame of the stand).
- The owner's batch (2026-10-23): M1 (the shelf a band under the packet — `DRAFT_SHOWCASE_COMPOSITION = 'stack'`), the
  wait brings the shelf forward, the wallet plate + the stamp, the chair everywhere. The Deck's wait stays at the floor
  (decision 10 — PL-927 waits for the owner).

## 3. The reading row — the name, and only what the face cannot print

`console/draft/draftReadingModel.ts` (pure) + `ConsoleDraftReading.vue` (`.con-dread`, `[data-draft-reading]`), in the
reserved status zone under the stage (one line, the stage never reflows):

- the name in the row's hero voice; the requirement's verdict through the hand's own
  `buildCardAvailability(…, 'draft')` — only when there is something to say (only printed requirements speak — money
  will change by the time the card is played).
- **The row never repeats the face** (the owner, 2026-10-23): the cost (the face already prints the discounted
  `calculatedCost`), the tags, the VP and its condition stand on the card right above the row. The first cut of CE
  listed them as icon «facts» and read as overload; `DraftReading` is `{name, availability}` and
  `draftReadingModel.spec` pins it. The general rule: `.claude/rules/console-ui.md` § A STATUS LINE NEVER REPEATS THE
  FACE ABOVE IT.
- On the purchase the WALLET closes the row («ПОКУПКА N × 3 = −M · У ВАС A → B», `draftWalletOf` — the price per card
  the server's `thisPlayer.cardCost`; numbers on `ConsoleFlipValue`).
- **The purchase's verb counts what it buys**: RT «Купить N» (`Buy ${0}`), «Купить 0» when nothing is chosen — never
  «Пропустить»; nothing glows at zero.
- The purchase's money lives ONLY in the wallet plate (`[data-draft-wallet]`) — the header's old financial strip is
  gone; a card chosen for the buy wears «✓ КУПЛЕНО» (`[data-draft-bought]`).
- The floor probe of the stand counts the UI's text, never the text inside a card FACE (a premium face is a graphic
  printed at its own scale).
- Open: PL-924 — a game LOADED straight into the buy after a draft (the removed fixture) showed a degenerate scene; the
  stand reaches the buy by a real draft.

## 4. Guards

`tests/console/draftShowcaseLayout.spec.ts` (three profiles × 1–4 cards × both compositions — nothing outside the body,
the packet first, the seat within floor / ceiling, the rack constant across rounds, the wait's scale, the Deck at its
floor), `tests/client/console/draftReadingModel.spec.ts`, `consoleDraftFlow.spec` § the counted verb; e2e
`console-draft-showcase` (A–E × tv4k / fhd / Deck — the showcase probe: foot, ink, empty band, card share, shelf face
height, the TV floor, clips, scroll).
