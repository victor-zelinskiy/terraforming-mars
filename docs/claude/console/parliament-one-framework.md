# ONE FRAMEWORK — the Parliament on the frame of «Действия карт» and the effects explorer

Turmoil Redux, 2026-10-24 (slices С0–С5; prompt `docs/claude/prompts/parliament-one-framework.md`). Replaces
`docs/TURMOIL_REDUX_PARLIAMENT_V2.md` § 3–4 and `docs/TURMOIL_REDUX_PARLIAMENT_UI_REWORK.md` § 3 / § 5 (the party
composer `.con-pact` and the party effects strip `.con-pfx`).

**The law, in one line:** an effect or an action of ANY source is drawn by the frame of the effects explorer /
«Действия карт»; a party and an enacted law are a BADGE on that frame, never a second component.

The owner's two examples it answers: in «Информация › ЭФФЕКТЫ» the party effects stood ON TOP in a strip of their
own visual language and the cursor never reached them; the Reds' «draw 2, then discard 2» had its own composer, its
own draw zone, its own result panel (`megacredits − mcBefore`) and three `setTimeout` beats, while AI Central's
«draw 2» — the same physical event — ran on the card frame.

## The contract as shipped

### К1 · the source is a TYPE, never a card name
- `components/effects/effectSource.ts` — `EffectSource = {kind: 'card', name} | {kind: 'party', party} | {kind: 'law',
  resolution}`, `sourceKey()` (`card:<name>` · `party:<id>` · `law:<id>`).
- `console/parliament/politicalSources.ts` — ONE answer to «what does this seat hold from the Parliament» (law →
  ruling party → the board's order — decision Р1; the access road via `accessRoadOf`). The explorer, «Действия карт»,
  Information's galleries all read it.
- The action workspace still carries a political tile key (`PARTY_<party>` / `RESOLUTION_<id>`) in its
  `cardName`-typed fields (the tile, the composer, the descent draft, the staged return). It enters them through ONE
  door, `consoleCardActions.politicalSourceKey(key)`; every reader that must tell the two apart asks
  `partyOfTileKey` / `resolutionOfTileKey`; the composer's own entry is a `PoliticalActionEntry` with a typed
  `source` and a `sourceKey`. ⚠ Re-typing those fields to `CardName | PoliticalKey` is the next step (it cascades
  through the composer's `cardName` readers) — named, not done.

### К2 · effects are GROUPS of the explorer (С1)
- `console/parliament/politicalEffects.ts` — a party's passive / the law's standing face become `EffectEntry`s with
  a political `source`: the PRINTED `effect()` nodes (`passiveEffectNodesOf`, the cards' own reader), the family off
  the signature, the meta line = the ACCESS reading (glossary § 5; a law «Доступен всем»; RX42's veto in the warning
  ink). No statistic, no «За партию» block (decision Р8 — the seam is `withEffectSource`'s `effect-triggered`
  events, already keyed by `EventSource`).
- The group plate: emblem in the resource chip's place · «ЭФФЕКТ ПАРТИИ» / «ЭФФЕКТ, ПОКА ПРИНЯТА» · the name
  (`partyNameKey`) · the accent edge. The SAME `.con-efx__tile`, focus rows, facets, zone count, X (party / law
  zoom entries), detail layer (the plaque / the law's face in the hero slot).
- DELETED: `ConsolePartyEffectsStrip.vue` + spec, `.con-pfx` (LESS + TV), its locale keys.

### К3 · actions — ONE composer (С2 the Reds · С3 the Scientists, the Industrialists, Unity · С4 the laws)
A party's or an enacted law's tile in «Действия карт» descends into THE `ConsoleActionComposer`:
- **hero**: the party's plaque (`ConsolePartyPlaque size="hero"`, decision Р2) / the law's face, in the card hero's
  box; `data-composer-source="party:<id>" | "law:<id>"`.
- **rows by the PROMPT's shape, never by the party**: `SelectOption` → commit only (the Reds, Trade Industries) ·
  an `or` card pick → a target row with the sole-candidate seed (the Scientists, Manufacturing Run) · an `and` of
  two `or`s → one row per part, each a palette of the one variant grammar (the Industrialists' «lower → raise»;
  `andOptionParts` / `composeAndResponse`) · a hand pick → the album door (Open IP Trade) · a repeat marker → the
  repeat slot (R&D Funding — Viron's slot) · a declared bill → a PAYMENT STEP of the composer (Trade Industries;
  `paymentStep(price, {cause})`, addressed) · a promised play → the law's PLAY SLOT (Live Experiments —
  `consolePlayPick` bridge, the card lands in the composer's receiving stage) · Unity → the colonies as a step.
- **ONE POST**: `politicalBatch.buildPoliticalBatch` nests the branch's answer inside the action menu's option
  (`[{type: 'or', index, response}, ...addressed steps]`); the menu index comes from `parliamentPromptBridge`.
- **ONE outcome record**: the claim keyed by the source's key, the Reds' batch in the composer's own draw zone
  (the same beat stage, `runBatchArrival` off `.con-deckstack__pile`) — the A/B probe П3 measures the Reds' landed
  slots ≡ AI Central's ±1 px on tv4k and fhd.
- **the discard is an owed STEP** of `card-actions` (`politicalDiscardOwed` → `owed-step`; the hand layer
  `action-hand`; crumb «СБРОС КАРТ»), and its payout is a WAVE off the plaque's printed icon, seeded in the apply
  block from the prompt's own rate × the thrown cards' printed tags (`discardExchangeBeat.ts`) — never a panel,
  never `megacredits − mcBefore` (decision Р3).
- **the law's steps owe the flow** (`lawStepOwed`: its card landing in the stage — PL-726; its live play pick —
  PL-727) and the conclusion holds on them through `ownsPrompt`.

### К4 · the server gives a political action what it gives a card (С0)
`models/politicalActionPreview.ts` (`PoliticalActionPreview` = the card preview with `source`, over the very prompt
the menu nests; `answer: 'option' | 'or' | 'direct'`; a law's shape — repeat / bill / play — `lawShape`);
`/api/action-preview?source=party:<id>|law:<id>`; draws name their source; every party / law prompt carries
`choiceContext`; the prompt's stage is the definition's; `PARTY_ACTION_USES_PER_GENERATION` is one constant;
`potentialActions.futilePartyActions`.

### К6 · the badge
Kicker («ДЕЙСТВИЕ ПАРТИИ» / «ЭФФЕКТ ПАРТИИ»; a law «…, ПОКА ПРИНЯТА») + emblem + accent edge, nothing more
(decision Р5). Uses: the tile's «N из M в этом поколении» chip (`sourceUsesText`).

### К5 · the Parliament's step «ВАШИ ЭФФЕКТЫ» is a HOST (С6, decision Р4)
The seat's Parliament actions as the «Действия карт» groups (read-only, Information's builder; A — the bench's door),
its standing effects as `ConsoleEffectsExplorer` (the third host, its own `EffectsExplorerUi` —
`parliament/parliamentEffectsHost.ts`). Two zones, ONE cursor (the explorer's pose gated while the actions zone owns
the cursor). Deleted: `.con-parl-fx__*`, `parliamentEffectsStepModel.ts`, 8 locale keys.

## Deleted → shared (С5)

| Deleted | Now |
| --- | --- |
| `parliament/ConsolePartyActionComposer.vue` (+ 4 specs: Bill · Play · Repeat · Resource) | `ConsoleActionComposer` (+ `composerPolitical.spec`, `composerLawPlay.spec`, `consoleActionComposer.spec` § and-parts / perCardTotals, `politicalBatch.spec`, `actionPreviewPolitical.spec`) |
| `console_party_action.less` (`.con-pact*`, TV) | `console.less` § `.con-composer` (+ `__playslot*`, `__playstage`) |
| `consoleCardActionsUi.partyFlow` / `ConsolePartyFlow` | the composer's own phases + `consoleCardActionsUi.draft` (the descent key) |
| `consoleCardActionsUi.billZone` + the shell's bill hosting (`partyBillStanding`, `stepArrived`) | the bill is a composer payment step, answered in the ONE POST |
| `submit-party` / `onCardActionsSubmitParty` | `submit-batch` / `onCardActionsSubmitBatch` (+ `armLawPlayLanding`) |
| `party-owed` (conclusion reason), `partyFlowOwed` | `owed-step` (`politicalDiscardOwed`) · `lawStepOwed` (`ownsPrompt`) |
| `partyResult` + `PARTY_SUBMIT_SAFETY_MS` · `PARTY_RESULT_BEAT_MS` · `PARTY_RESULT_AWAIT_MS` | the ACTION COMMIT's wave + the rail half (no timer is a beat) |
| `composesInCardComposer` / `ONE_FRAMEWORK_PARTIES` (the migration's set) | — (every political source is composed by the card composer) |
| `[data-pact-play-face]`, `.con-pact--resolution .con-pact__hero` | `[data-law-play-face]`, `.con-cardactions .con-composer__actlaw` |

Guard **П0** `tests/console/oneFrameworkGuard.spec.ts` (server runner): none of the deleted names in `src/client` /
`src/styles`, no `partyTileKey(…) / resolutionTileKey(…) as CardName`, no `*Composer*.vue` under
`components/console/parliament/`, the legacy files gone — fails with the list of offenders.

## Gotchas
- **The bill's address must be stamped explicitly** (`for: {...promptAddressOf(input), source: cause}`): the
  `choiceContext` of a payment is serialized centrally, not by its `toModel`, so the preview's copy had no source.
- **`paletteOf` needs a part floor of 1** for the Industrialists' rows (two palettes of one production each).
- **The law's receiving stage is a LAYER with a latch** (`[data-law-landing]`): the stage stands from the commit to
  the scene's `closing`, or the card lands on a stage that already left.
- **A repeat's preview is the CHOSEN card's** (scope `chain`): the server attributes the copied action's draw to the
  card that ran.
- **e2e `answeredDownTo` reads «sublist CLOSED and no missing row»** — a sublist open hides its rows, so a count of
  zero alone is true while the answer is still being picked.

## Honest gaps (named in the С7 report)
- The overview's «ВАШИ ЭФФЕКТЫ» BLOCK still reads `parliamentEffectItems` (the sitting's holds keep the previous
  government) — moving it onto `politicalSources` is the next step; the step itself is the host (С6, below).
- `ConsoleArmedEffectsSection` (TR49 «взведено») is the same anti-pattern (a strip with no focus) — the next candidate.
- Open IP Trade's sale terminal scene is replaced by the ACTION COMMIT's token; Trade Industries' CTA verb is the
  generic one (not «Купить флот»), and its fleet beat is the formula's 1 → 2 read — no fleet result surface.
- `openWith.resume` is now read by nothing (a reload mid-discard re-opens the composer at its setup with the hand
  step in its zone) — the restore of the committed pose is the next step.
