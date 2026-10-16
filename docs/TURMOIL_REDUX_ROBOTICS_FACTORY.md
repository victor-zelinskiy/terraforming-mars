# TR56 Robotics Factory («Фабрика роботов») + the iteration «КУДА ЛЯЖЕТ»

**Status.** Shipped 2026-10-16. The prompt: `docs/claude/prompts/project-tr56-robotics-factory.md`. The rule lives in
`.claude/rules/console-ui.md` § THE VARIANT CHOICE IS ONE GRAMMAR («a payload names its addresses on every level») and
`docs/claude/console/variant-choice.md` § 7. Ledger: section AU (`docs/claude/gameplay-polish-ledger.md`).

## 1 · The card

Green, 7 M€, a Building tag, the INDUSTRIALISTS' plate (the TR15 class — they rule, or 2 of the player's own delegates
on their resolution; TR36 lowers no requirement). «Add 3 mech resources to ANY card, OR 3 fighter resources to ANY
card, OR 6 floater resources to ANY card.» Lore: «Funnily enough, the line wasn't drawn at robot labor. No, it was sex
robots that was a step too far.» (RU «Как ни странно, черту провели вовсе не на роботах-рабочих. Перебором сочли
секс-роботов.»). Art: none yet (`Mars Arts/TR56.png` is not delivered — the face stands without art).

- **ONE declaration, no hook** — TR43's optional `or` with three branches: `{optional: true, autoSelect: true,
  behaviors: [{title, addResourcesToAnyCard: {type, count, mustHaveCard: true}} × 3]}` in the printed order (mechs ·
  fighters · floaters). A branch with no holder is not offered (greyed with its reason in the composer, never hidden);
  a lone available branch collapses to its bare target pick (the preview's index −1, the batch `[play, {card}]`); no
  holder of any kind still PLAYS the card — the Building tag counts — with three named skips (`skippedOrBranch`).
- **«ANY card» is any of the player's own** (`AddResourcesToCard.getCards`: the tableau + Self-replicating Robots'
  hosts); the target is never applied automatically, a single holder included.
- **The Building tag**: Construction Mechs (TR17) pays for it with mechs, and the factory may put 3 back on that same
  card — the price leaves the capsule at the play, the gain lands after (2 → 1 → 4 with one mech paid).
- **The target step's title tells the truth** (`AddResourcesToCard.buildSelectCard`): «Add resources to this card» is a
  SELF-target's word only (the lone candidate IS the asking card); a lone FOREIGN holder names the payload («Select a
  card — Fighter: +3»). In a play composer «эту карту» read as the card being played.

Spec: `tests/cards/turmoilRedux/RoboticsFactory.spec.ts` (rules 1–10 — the requirement, the three holder sets the
preview names, both batch forms through `replayBatch`, the mech payment, the journal, the bot, save / load, a pure
preview). Fixtures: `robotics-factory`, `-one`, `-none`, `-mechpay`, `-locked`.

## 2 · «КУДА ЛЯЖЕТ» — what it replaces

«Put N of a resource on ANY card» is ONE question asked on two levels — WHAT (the variant) and WHERE (the target) — and
before this iteration each level spoke as if the other did not exist (TR43's frames, `screenshots/ichtiology-grant/
tv4k-*`):

1. the variant TILE said one fact three times — the print «2 [animal]*», the sentence «Добавить 2 животных на любую
   карту», the chip «+2 на карту» — and never WHERE: the holder set, the very thing that differs between kinds, was
   met only one level down;
2. the unanswered target ROW read «ДОБАВИТЬ РЕСУРСЫ НА ЭТУ КАРТУ» (the server's single-candidate title — a lie inside a
   play composer) over an amber «Выберите карту-получатель…», with the commit rail saying the same once more;
3. the target STEP was titled «Выберите разыгранную карту» (table jargon), the payload nowhere on screen, its crumb
   tail «ВЫБОР»;
4. a lone candidate stood in the top-left corner of a 2100 px zone (one owner is always `tabs` — PL-170's centring
   was written for `split` only; TR43's e2e measured the stretched owner box and stayed green), and its tag read
   «ПО 0 → 1» while the count «0 → 2» lived only in the rail;
5. a change of variant after a target was answered left the answer in place: every branch numbers its steps from
   `step#0`, so going back to the first kind painted the row ANSWERED while the batch held nothing for it.

## 3 · One language, every level

- **The tile carries its ADDRESSES** (`VariantChoiceOption.destinations` ← `variantDestinationsOf(branch)`): the server's
  candidates of the branch's ONE gain-to-a-card pick (a step with a positive `amount`, or the branch's option beside a
  «to a card» gain) — up to three faces fanned (`ConsoleCardFaceLite`, the live models: each capsule states what the
  card already holds) beside the count «N карты на выбор» or the one holder's name. A printed payload with its
  addresses drops the sentence and the «+N на карту» chip (the print said them). A refused option has no addresses —
  its reason speaks. Both composers (the action composer's variant tiles too).
- **The target ROW is the question and its answer in ONE line** (`ConsoleComposerTargetRow` — one component in both
  composers): the label «КУДА: [the branch's print]» never changes; unanswered, the value is the STRIP of the
  server's candidates (up to five live faces, «+N ещё», a door ›; the card being played is a ↰ handle); answered, the
  chosen card's miniature (a flight end — `data-composer-card`), its name and owner, and the step's own TAG read again
  beside it (no sentence repeating the tag's «+18» — `tagSays`; a threshold's words stay: «Хватит на делегата: 3 / 3»). Both values share ONE grid cell at ONE height (the miniature's) and
  change by a phrase (`con-tgtrow-swap` — opacity + a hair of scale). A pick with no payload keeps its role word (a
  spend's source asks «Выберите карту-источник» — PL-056); a pick asked by somebody else than the composer's card
  names its asker first («КОЛОНИЯ · ТИТАН · КУДА: 1 [аэростат]» — TR23's ledger, `asker`, PL-471).
- **The target STEP is one level deeper of the same phrase**: the contract line reads «◈ КУДА: [печать] · Доступных
  целей: N» (`PlayedTargetContract.payload` ← `playedTargetPayloadOf`); in the play composer the print FLIES in from the
  tile it was chosen on and flies HOME on the way back (A answered, B) — `played/payloadCarry.ts`, the descend grammar's
  FLIP, the other level's groups surfacing from inside; reduced motion — no carry); a pick with no payload reads
  «Выберите карту на столе». The crumb's tail is «ЦЕЛЬ» in both
  composers (`stageName` → 'Target'; the action composer through `consoleCardActionsUi.targetStage`).
- **The composition**: a lone visible owner is content-sized and centred in either mode (`.con-ptsel[data-owners='1']`);
  the solver's solo ceiling already makes one candidate the protagonist.
- **The TAG leads with the count** (`PlayedTargetTag.lead`): «[мех] 2 → 5 · [M€] +15 [Стр.]», «[аэростат] 0 → 6 ·
  [карта] ✓», «[истребитель] 1 → 4 · ПО 1 → 4»; plain storage IS the count (no lead). A good within reach reads ✓ alone
  (a fraction after the count — «0 → 6 · 6/1» — read one number twice); a short one keeps its fraction («2/3»). ONE
  renderer for the tag (`ConsolePlayedTargetTag`) under the step's cards and beside the answered row's miniature. A tag
  that says two things (the count AND its consequence — `playedTargetTagStacked`) STACKS under a card: the count, the
  consequence under it; the step reserves the two lines for every cell (`data-tag-lines="2"`,
  `PLAYED_TARGET_TAG_ROW_H2`) — on one line it outgrew a 4K card of seven (PL-470).
  The one-line readings (the rail under the cursor, the answered row) leave the tag's digits to it
  (`playedTargetReadingImpacts` — impacts marked `inTag`); the full sections keep them.
- **A change of variant takes the variant's answers with it** (`keepPlayAnswers` — the play's `pre#…` answers survive, a
  branch's `step#…` / `option` go), the target result included, in both composers; the row returns to the NEW kind's
  strip by the swap, the column does not move.
- **The column comes back clamped** (`SettledColumn.suspend(false)` re-clamps after the patch): the host resumes from a
  `pre` watcher while the step is still in the DOM, so the clamp used to measure the step and the returning review
  overflowed its pinned column — at 4K the answered composer scrolled its heading away.
- **The landing**: the play's «+N» on ANOTHER card is born on the PRINTED icon of that resource in the on-play row
  (`consolePlayedHero.heroGainOrigin`, generalized from the card's own gains) — a row of alternatives prints each
  branch's own resource, so it is the chosen branch's icon; the witness reads `printed:mech`. A mech price leaves its
  pay row first (PL-163), the gain is born after.

## 4 · Measured (the stand `screenshots/tr56/stand.spec.ts`, frames `screenshots/tr56/{tv4k,fhd,deck}/{before,after}/`)

«Before» is HEAD `816c47f68d`'s client (the card on the server, the iteration not yet) in its own snapshot.

| | 4K before → after | fhd before → after |
| --- | --- | --- |
| the step's crumb tail | ВЫБОР → ЦЕЛЬ | ВЫБОР → ЦЕЛЬ |
| the lone candidate's row against its zone (CM) | −665 px → 10 px off centre (zone 2106) | −421 → 5 (zone 1231) |
| two candidates (floaters) | −375 → 7 | −277 → 3 |
| the lone candidate's height | 1051 / 1804 = 0.58 (unchanged — already the protagonist) | 525 / 908 = 0.58 |
| the target row | 180 (two lines, no faces) → 177 (one line, the strip) | 80 → 88 |
| the answered composer | 1793 / 1597 — scrolled, the heading gone → 1639 / 1639 | 730 / 725 → 682 / 682 |
| the column at a change of variant | 239 → 239 → 393 → 393 | 289 → 289 → 282 → 282 |
| seven candidates (TR29 B) | tags cut to «+:» (PL-470) → whole, on two lines | — |

The landing (the TR56 e2e on the GPU, `TM_E2E_GPU=1`, tv4k): A — «−1» born on `payrow:constructionMechs` at 161 ms,
touching the printed cost at 1093, landed 1409; «+3» born on `printed:mech` at 3026, touching Construction Mechs at 3896,
landed 4146. D (three mechs, the price) — 130 / 993 / 1233, then 2993 / 3792 / 4066. Deck: the composer scrolled before
and scrolls after (722 → 835 px of content in 638 — the addresses and the strip); nothing is cut.

## 5 · Guards

`tests/cards/turmoilRedux/RoboticsFactory.spec.ts`; `tests/console/variantChoiceModel.spec.ts` (TR56's row sliced into
three prints; `variantDestinationsOf`); `tests/client/components/console/ConsoleVariantChoice.spec.ts` (the addresses);
`consolePlayedTargetPreview.spec` (the lead, the reading impacts), `consolePlayedTargetModel.spec` (the payload, the
protagonist in three zones × 1 / 3 / 7), `consolePlayCardComposer.spec` (`keepPlayAnswers`), `settledColumn.spec` (the
re-clamp), `holderRoles.spec` (the tags); e2e `console-robotics-factory` (fhd + tv4k: A–E), the translated
`console-expedition-mechs`, `console-spaceship-recycling`, `console-supercomputer`, `console-aerial-mappers`,
`console-colony-vesta`, `console-composite-surfaces`, `console-ecological-experiment`; the transfer witness's
`printed:<sprite>` anchor.

## 6 · Traps

- A rect is not a layout: the cursor LIFTS its tile (`translateY`), so «one row» is measured by `offsetTop`.
- A `pre` watcher sees the old DOM: anything measured there for the state it is switching TO is measured on the
  wrong content (the settled column's resume).
- The owner box of a lone `tabs` group is STRETCHED — measuring its centre proves nothing about the cards inside it.
- `step#0` is every branch's first step — a per-choice record keyed by it must be cleared on a change of variant.
