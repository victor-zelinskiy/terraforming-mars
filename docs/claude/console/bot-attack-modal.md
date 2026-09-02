# The MarsBot attack — a compact mandatory modal

> `src/common/models/BotAttackPromptModel.ts` · `src/server/automa/AutomaAttackPrompt.ts` ·
> `src/client/console/botAttack/*` · `src/client/components/console/ConsoleBotAttack.vue` ·
> `src/styles/console_bot_attack.less`
> Guards: `tests/automa/AutomaBotAttackPrompt.spec.ts` ·
> `tests/client/components/console/botAttackModel.spec.ts` ·
> `tests/e2e/console-bot-attack.spec.ts`

## The defect

A hostile MarsBot effect reached the client as an ordinary `SelectCard` over the
victim's own tableau. The console's router classified it `cardSelect: 'target'`
and the generic full-screen card browser served it: **one card blown up to half a
4K screen**, under a raw English sentence whose only trace of the attacker was
the source card's English name in brackets —

```
Select the highest-scoring animal/microbe card to remove 1 resource from (Invasive Species)
```

Every question the moment owes the player was unanswered: that they had been
**attacked**, by **whom**, with **which of the bot's cards**, and — the one that
decides the choice — **what each candidate costs**. None of it could be
recovered client-side without parsing that English string, which cross-cutting
invariant 1 forbids outright (i18n rewrites `Message.message` in place, so a
text match stops matching after the first render).

## The root cause, stated once

**The prompt carried no structured context at all.** It was an anonymous card
pick, and every gap above follows from that single fact: the router had nothing
to route on, the surface had nothing to explain with, and the preview had
nothing to compute from.

## When this surface exists at all — a lone candidate is NO choice

**The modal rises only when the victim genuinely has something to decide.**
`selectHighestScoringCubeAttack` narrows the demand to the tied top-rate holders
of ONE victim, and that set is very often a single card. Asking about it put a
mandatory announcement, a chip, a press to open, a target selection and a commit
press in front of a player whose only possible answer was «ОК» — a speed bump
wearing the clothes of a decision.

So `resolveCubeRemoval` (`AutomaBonusCards.ts`) forks on `targets.length`:

* **one candidate** — the bot takes that cube DURING ITS OWN TURN
  (`removeResourceFrom(..., {removingPlayer: bot})`, so the LawSuit hook and the
  cross-player event rescue are unchanged). The turn script records a resolved
  `attack` step (`outcome: 'hit'`, `removed: 1`, `before`/`after`, plus the new
  `cardResource` naming WHICH cube left);
* **several tied candidates** — unchanged: `outcome: 'target-chooses'`, the
  deferred `SelectCard`, this whole surface.

**This is not a hole in cross-cutting invariant 3.** That rule protects a player
from CONFIRMING a target they could not see — it is about the player's own
choices. Here the player chooses nothing; the loss is delivered, and delivery is
the notification system's job:

| carrier | what it says |
| --- | --- |
| the bot-turn notification | the viewer's own red band «▼ ВЫ ПОТЕРЯЛИ [🦠] −1» — `viewerImpactOfBotTurn` reads the attack step's `cardResource`, so the card is `critical`/negative on its FIRST frame (the atomic-delivery contract) |
| its summary line | «Бот убрал 1 ресурс с карты «Птицы» игрока …» — the removal's own log line, deliberately NOT consumed into the attack step, because a resource chip cannot name the CARD |
| «Разбор хода» | the attack line, now with the specific animal/microbe sprite instead of the demand's pair |
| the journal | unchanged — the full record it always kept |

⚠️ The bot-turn card is the ONLY hostile presentation here: `diffNegativeNotifications`
skips any chain rooted in `automa-turn` precisely so one attack never produces
two cards. A future cube attack that resolves OUTSIDE a bot turn would take the
ordinary negative-notification path instead.

## The marker — `botAttackPrompt`

`BotAttackPromptMeta` is the whole meaning of the moment, as data:

| field | what it answers |
| --- | --- |
| `attacker` / `victim` | who did this, to whom (seat colours — the shell's own vocabulary) |
| `source` | **which object of the bot's** — `{kind:'bonusCard', bonusCard}` today, `{kind:'projectCard', card}` reserved |
| `effect` | `'removeCardResource'` — the extension point; a new effect is a value here plus a preview shape, **never a second marker** |
| `cardResource` / `amount` | what leaves, and how much (absent `cardResource` = a mixed candidate set; read the per-target one) |
| `restrictionKey` | the RULE that narrowed the candidates, as an English i18n key |
| `targets[]` | per candidate: `resources {before,after}`, the CARD's own `victoryPoints`, and the player's total `score` |

Serialized on **`SelectCard.toModel`**, not centrally — a hostile effect may
legitimately wrap its pick in an `OrOptions` (a skip branch, a bot-storage
branch), and a centrally-decorated marker arrives stripped by nesting. Same
reasoning as `discardPrompt` / `deckPickPrompt` / `draftPrompt`.

### The preview is authoritative, and read-only

`AutomaAttackPrompt.cardResourceAttackPrompt` derives every figure through the
**real scoring sources**:

* `resourceVictoryPoints(owner, card, −amount)` — the card's own `victoryPoints`
  descriptor, evaluated by the owner's own `Counter`. That is what makes «1 ПО за
  каждые ДВЕ фишки» read correctly instead of assuming one cube is one point.
* the total is read **once** (`player.getVictoryPoints().total`) and moved by that
  card's own delta — exact, because nothing else in the tableau changes.

Three rules the shape enforces:

1. **`victoryPoints` absent** ⇒ the card scores nothing from this resource at
   all. A `0 → 0` row there would be noise.
2. **`victoryPoints` present but equal** ⇒ the card DOES score per resource and
   this removal happens to land inside the same bracket. It is kept and marked
   `static`, because silence would read as «this card scores nothing» — the
   opposite of true, and exactly the comparison the choice is about.
3. **`score` present only when it MOVES**, and it is a different figure from the
   card's own points — never one number under two labels.

Nothing is mutated to produce any of it (guarded: the cube is still on the card
after the whole prompt has been built and serialized).

## The surface (iteration 2 — the visual repair)

Iteration 1 got the DATA right and the DRESS wrong: a bordeaux plate with a red
frame, a green-framed source box, a red-ringed target card and a cyan full-width
button — four design systems on one panel, which read as a combat UI borrowed
from another game. Iteration 2 changed no architecture and rebuilt the surface
out of what the project already owns.

**It inherits, it does not invent.** The plate is `.con-decision__panel`'s glass
byte-for-byte (cold graphite-blue, its cool inset hairline, its radius, its drop
shadow, its type scale); the focus ring is `@sem-focus`; the commit is the
composer CTA's three-state language (`--held` graphite / `--ready` mint /
`--focused` cyan); the pending target ring is the shared step's own, recoloured.

**Red is SEMANTIC and appears in exactly four places** — the attack kicker, the
bridge chip, the chosen target's pending-removal ring, and a negative delta. It
never tints the plate.

**The composition is a causal sentence**, and the panel is content-sized
(`width: auto` + a 34rem reading measure on the header), so one candidate
centres the row instead of leaving half a modal empty:

```
◈ АТАКА · ● БОТ
Бот применяет карту «Инвазивные виды»
Выберите свою карту и удалите с неё 1 ресурс.
Доступны карты животных и микробов с наибольшей стоимостью ПО.

ИСТОЧНИК                                    [ ТИХОХОДКИ ]
[ the bot's real card ] ──  −1 🦠  ──▸           Ресурсы 1 → 0
                                                  Ⓐ Удалить 1 ресурс
```

### The bot's name — ONE resolver, never a literal

`displayNameForColor` (`marsBotDisplay.ts`) → the `'MarsBot'` i18n key → «Бот».
Nothing in the flow spells the name out: the kicker is one word plus the shell's
own seat chip, the headline takes the name as **parameter 0**
(`'${0} plays ${1}'`), and the mandatory ANNOUNCEMENT carries it as a
`LogMessageDataType.PLAYER` token — which `translateMessage` resolves through
that very same key, so `consoleTaskSummary` stays pure. A locale change
re-labels every one of them with no code path of its own.

⚠️ The kicker is «АТАКА · БОТ», not «АТАКА БОТА»: a Russian genitive cannot be
produced from an interpolated nominative, and a second, case-inflected name
source is exactly what the one-helper rule forbids. The source dock's kind chip
was renamed `'Bot card'` for the same reason — `'MarsBot card'` put the raw name
into a Russian label.

### The source is the REAL card, on screen, unprompted

The dock draws `BonusCardFace` (the same renderer the bot board, the turn
theater and the fullscreen inspect use) at its readable size: `zoom:
var(--con-ui-scale)` over a fixed 300 px box, so a px-authored text face
integrates into the rem space at every profile. `L3 Источник` is **gone** — with
the card inline it would open a viewer onto what the player is already looking
at, and a competing inspect verb with nothing of its own is noise.

### One canonical hint per press

The ROW names the act («Удалить 1 ресурс»); the ONE command bar names the press
(the project's generic `'Confirm action'`). That split is the composer's own
(`commitFocusVerb`) — before it, both places said «Удалить 1 ресурс».

## The surface — routing

`botAttack` is a **native COMPOSITE kind** (`NATIVE_COMPOSITE_KINDS`): its own
band surface, not host-served, not a shell section, not a scene — and therefore
minimizable, with the board-home restore card as its way back.

It is deliberately **not a workspace**. The player opened nothing, so there is no
flow to descend into and nothing to come back to: a content-sized panel in the
modal band (`.con-ws-band()` + the `con-ws` marker) over the shared moderate
`.con-shade`.

```
◆ АТАКА MARSBOT                          ← the event, in the bot's seat colour
«Инвазивные виды» активирует эффект       ← WHICH card (its localized name)
Выберите одну из своих карт и снимите с неё 1 ресурс.
◈ Выбрать можно только карты животных или микробов с наибольшей стоимостью ПО.

ИСТОЧНИК                    [ the player's own candidates ]
[ the bot's own card face ]
                            ТИХОХОДКИ → Ресурсы на этой карте 1 → 0
                            [ Удалить 1 ресурс · Тихоходки          Ⓐ ]
```

### What it REUSES (the point of the exercise)

* **`ConsolePlayedTargetStep`** — the very selector the card-play and blue-action
  composers use to point at a card on the table, in its `remove` direction. No
  second card grid, no second navigation model, no second idea of what a
  candidate looks like. Two additive props were all it needed:
  `hostStatesAsk` (the host's header already states the ask, so the step's own
  contract line and its single-owner bar do not render) and the model's new
  `direction` axis.
* **`ConsoleSourceDock`** — the console's one answer to «кто это сделал»,
  extended to draw MarsBot's own **`BonusCardFace`** (the same face the bot
  board, the turn theater and the fullscreen inspect all use). Never a fake
  project card.
* **`consoleCommitGate`** — the one authority on «may this be confirmed yet», so
  the commit row can never show a live Ⓐ it would refuse to run.

### `PlayedTargetDirection` — the shared `add` / `remove` axis

The selector already had a `takesFromTarget` boolean, used for one thing
(self-harm marking). It is now the shorthand for `direction: 'remove'`, and the
direction is **published on the contract** so the paint can key on it
(`data-direction` on the step's root). The legacy boolean keeps working
byte-for-byte — both composers derive it from the sign of a step's amount — and
an explicit `direction` wins when both are given. Guarded in
`consolePlayedTargetModel.spec.ts` § direction.

## The interaction — no accidental removal

**Nothing is selected on open.** The cursor rests on the first candidate so the
pad has somewhere to start; a cursor is not a choice.

1. D-pad moves between candidates; the status rail reads the focused one.
2. **A selects** — the card takes the pending-removal pose (red ring + red ✓,
   `data-direction='remove'`) and the cursor moves to the commit row.
3. **A on the commit row removes**, and the row says so: «Удалить 1 ресурс ·
   Тихоходки», with the same verb on the command bar.

Two deliberate presses on two visibly different rows, with the preview in
between — the console's own pre-select → commit grammar. Walking UP from the
commit row re-opens the choice.

`X` inspects the focused candidate, `L3` the source (the console-wide
inspection grammar). **B is never an answer**: a mandatory attack cannot be
declined, so B sets it aside and the chip keeps signalling it.

## Integration with the mandatory framework

`botAttack` is in `ALWAYS_INTERRUPTIVE` — a hostile effect is raised during the
BOT's turn on a player who did not ask for it, so it is **announced, never
opened**. The consequences fall out of the existing framework with no new
machinery:

* while the gate holds, `admits('host')` is false ⇒ `nativeCompositeTask` is
  undefined ⇒ **the modal is not mounted**, so it can never appear over a
  workspace the player is working in, nor take focus, nor collapse anything;
* the player's chip carries the demand (`ConsoleStatusStrip.attention`), and the
  board-home plate opens it on A (`openMandatoryAnnounce` falls through to the
  composite auto-mount);
* several prompts keep their FIFO order — the beat is DERIVED, so the next one
  simply becomes current when this one is answered;
* a reconnect re-derives everything: the deferred queue re-runs, the prompt is
  rebuilt with a FRESH preview, and the marker rides every re-serialization.

A server refusal rolls the commit beat back through the same mechanism every
other committing console surface uses (`abortBotAttackCommit`, called beside
`abortConsoleActionCommit` on both the rejected-response and network-failure
branches of `WaitingFor.fetchPlayerInput`).

## Two traps this surface paid for

**A fit engine may never read its own output.** The panel is content-sized, so
the selector's zone must NOT grow with its content — otherwise the step sizes
its cards against a box its own cards produced. `.con-botattack__stage` is a
**fixed** `15.5rem` (`flex: 0 1 auto`, shrink-only) and carries `data-ws-band`,
so the step's budget is a constant. It also keeps a lone target modest — never
the hero the full-screen picker made of it.

⚠️ **And the `data-ws-band` box must contain ONLY the step.** With the commit row
inside it the step measured `band.bottom − root.top` — a budget that included
the button's own space — overflowed by exactly that much, and the step's scroll
area grew a rail. The commit is the PANEL's foot instead, which also makes the
source card and the target card centre on each other rather than on a column
that holds a rail and a button too.

**One entrance, one owner.** The surface is registered with the surface-motion
director (`data-motion-surface="bot-attack"`), which owns the band family's
arrival *and* the shared shade. A second, CSS-authored entrance on the same
element is not a nicety but a conflict — a filling animation overrides inline
styles, so the two fight over `opacity`/`transform` for the whole overlap.

## The dev seam — `customBonusCards`

The automa twin of the existing `customProjectCards`: bonus card ids lifted to
the **top of MarsBot's bonus deck**, after the shuffle, so the setup pulls the
chosen one into the starting action deck and it fires within the bot's first few
turns. Ids the option set does not actually include are ignored, so a stale
request can never seat a card the game has no rules for. It is what makes the
e2e above a real scenario rather than an injected one — and what makes any
future bot effect reachable for its own probe.

⚠️ Only the deck's **TOP** card joins the STARTING action deck, shuffled among
3 projects — so a single-entry list has a 1-in-4 chance of firing before the
human has taken one action. Seat a filler ahead of the subject
(`customBonusCards: ['B03', 'B02']`) when the scenario needs setup time: the
subject then waits in the bonus deck and joins the action deck at the next
Research Phase (`AutomaResearch.finishActionDeck`). The e2e needs exactly that —
a TIE cannot be built inside one turn's two actions, since only one base card
enters play already holding cubes.

## Adding the next MarsBot attack

1. Build the context with `cardResourceAttackPrompt(...)` (or a sibling builder
   for a new `BotAttackEffect`) at the prompt's construction, **co-located with
   the rule that raises it**.
2. `markBotAttackPrompt(...)` on the input.
3. Add the effect's explanation keys to `botAttackModel.ts` + `ru/console.json`.

## Two things that are NOT this surface

* **«КАРТЫ 0/1» in the footer** is the HAND DOCK's own readout —
  `playableCount / count`, i.e. «0 of the 1 card in your hand can be played
  right now». It is not a target-picker page indicator and not a zero-index
  bug; this modal renders no pager at all.
* **`L3 Источник`** was retired here only. Every other post-commit stage keeps
  it — the console-wide grammar (`X` = the current object, `L3` = the source)
  applies wherever the source is off screen.

Nothing in the router, the shell, the gate, the leak detector or the styles
needs to change: the whole shell is driven by `effect`, `amount` and the
server's own candidate set.
