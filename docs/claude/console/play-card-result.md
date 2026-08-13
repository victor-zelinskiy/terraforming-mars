# The play-card workspace — RESULT and the «ИЛИ» CHOICE

The right-hand column of «КАРТЫ В РУКЕ › ‹карта› › РОЗЫГРЫШ»
(`ConsolePlayCardConfirm.vue`, embedded in the hand workspace) reads top to
bottom as **what you get → what it costs → commit**. This file is the contract of
the first of those three; the payment block has its own
(`payment-panel.md`), and the commit rail is the tail of both.

| Concern | Where |
| --- | --- |
| Which result units exist at all | `src/client/console/consolePlayCardResult.ts` (pure, never empty) |
| The choice state machine + A's verb | `src/client/console/consolePlayCardComposer.ts` (pure) |
| «May a choice be seeded» | `consoleActionComposer.ts` → `initialVariantSelection` (the shared base — the blue-action branch pick reads the SAME rule; re-exported by the play module) |
| «May this be committed yet» | `src/client/console/consoleCommitGate.ts` (shared with the action composer) |
| Markup + input | `ConsolePlayCardConfirm.vue` |
| Layout | `console.less` § 18/19 (`.con-composer--embed`), profiles in `console_tv.less` |

The column as a whole is **vertically centred against the hero card**
(`justify-content: safe center` on `.con-composer__playright` + `flex: 0 1 auto`
on its scroller — the same two lines the action composer's `__actright` uses).
Every rule below has to hold that: a result section that changes height simply
re-centres, and `cardMid === stackMid` is the assertion any probe should make.

---

## 1 · The result is TWO LEVELS, and the second one is a CLUSTER

```
ВЫБЕРИТЕ РЕЗУЛЬТАТ / РЕЗУЛЬТАТ        ← heading (§3)
[ 1 → 0 производство ] [ 0 → 1 …]     ← LEVEL 1 — what changes NOW
[⟳ Новое действие] [✦ Постоянный эффект] [★ ПО: по условию]
[# Метки: ⚛🌍🪐]                       ← LEVEL 2 — what the card IS afterwards
```

* **Level 1** is the immediate impact chips (`ActionEffectChip`) — or, when the
  card asks a question, the option cards of §2. It stays the louder voice.
* **Level 2** is `.con-composer__rescats`: an **intrinsic cluster**, `display:
  flex; flex-wrap: wrap; align-items: flex-start`, each unit
  `flex: 0 1 auto` (content-sized) with `max-width: min(30rem, 100%)`.

**Never a grid of equal columns.** `repeat(auto-fit, minmax(…, 1fr))` shipped
once and handed «Новое действие» — three words — a third of the band, plus a
full-width row for the tags (`grid-column: 1 / -1`). Three short facts then read
as a settings screen and cost the section twice the height it had earned. Empty
space to the RIGHT of the cluster is the correct outcome, not a hole to fill.

Two consequences worth keeping:
* `align-items: flex-start`, never `stretch` — a unit that happens to carry a
  second line must not inflate the short facts beside it.
* the tag icons stay ONE object for free (`__rescat-tags` is an `inline-flex`,
  i.e. `nowrap`); what they must not be is a band of their own.

A result unit is a **fact, not a control**: calmer background and rim than a
payment row, a focus ring or the commit rail; text and icon sizes are untouched
(the couch has to read them). Wording is nominal because the heading already
supplies the verb — `New action`, `Permanent effect`, `Victory points: by
condition`, `Tags:`.

---

## 2 · The «ИЛИ» choice — focus, selection and commit are THREE things

An on-play `OrOptions` (Artificial Photosynthesis, …) renders as a **comparison**
in `.con-composer__variants`, with a quiet `или` between the options.

### The defect this removes

The screen used to open with a branch already selected, and moving the cursor
re-selected. One green frame therefore meant «you are here» AND «this is your
answer», the commit rail was live from the first frame, and a single A played the
card on a result nobody had chosen.

### The rules now

1. **`initialVariantSelection(branches)`** is the ONE place a selection may be
   seeded — for THIS screen and for the blue-action branch radiogroup, which
   asks the same question (it lives in the shared base for exactly that
   reason; the two screens carried the rule twice until 2026-08-13). It almost
   never seeds: a single branch, or a set the RULES have
   narrowed to exactly one playable branch. Everything else opens **unselected**.
   (A lone playable branch is not a question — demanding a «choice» among one
   door is a ceremony. Verified live on «Эксплуатация источников тепла»: two
   branches, one refused, heading «РЕЗУЛЬТАТ», play available on open.)
2. **Navigation moves the cursor and nothing else.** Selection is a press.
3. **A on a variant SELECTS, and does not move the cursor.** Idempotent — never a
   toggle; a choice that can be un-made by repeating the press has no stable
   state to commit.
4. **The choice is a commit REQUIREMENT** (`rowMissing` is true for every
   *choosable* variant while `selectedPos === undefined`). That is the structural
   half of the guarantee: `computeCommitGate` → `incomplete` →
   `commitAcceptsCursor === false`, so the cursor **cannot reach the commit
   rail** and a repeat / held button / double click has nowhere to land.
5. **`PrimaryActionState 'need-variant'`** outranks payment, steps and
   `blocked-requirement` — nothing downstream is even defined until the question
   is answered. The rail reads «Сначала выберите результат», wears `--held`, has
   no mint glow and **draws no Ⓐ** (`--cta-glyph--mute`; `visibility`, so its box
   is reserved and the label does not move when the play becomes possible).
6. **The A-verb** is `playPrimaryVerb`: `Выбрать` on a variant (never «Далее»),
   `Разыграть` only on the rail.
7. **The mouse speaks the same grammar**: a click on an option selects (so a
   double click cannot commit), a click on the rail commits — and input that did
   not come through the cursor is redirected by `commitRedirectTarget` rather
   than silently ignored.

### The three states on screen

| State | Paint | ✓ |
| --- | --- | --- |
| focus (cursor) | cold cyan ring + lifted surface | no |
| selected (answer) | mint plate + mint ring, survives the cursor leaving | yes |
| focused + selected | mint plate + an **outer** cyan ring (two rings, two facts) | yes |

All of it is `box-shadow` + colour, so `con-perf-lite` keeps every cue. The ✓
slot is reserved in every state (`visibility`), so answering cannot re-wrap the
title beside it, and the commit rail's box is pixel-identical before and after
the choice.

### The layout

```less
.con-composer__variants { container-type: inline-size; display: flex; flex-wrap: wrap; align-items: stretch; }
.con-composer__variant  { flex: 1 1 22rem; min-width: min(19rem, 100%); }
@container (max-width: 47rem) { /* column + a full-width «или» between them */ }
```

⚠️ **`flex-basis: auto` (max-content) is wrong here** and shipped once: a long
sentence claimed the whole line, its twin fell to the next one, and `или` was
stranded beside the first — two options meant to be compared, laid out as a list.
A **basis** says how wide an option *wants* to be; long text then wraps INSIDE
the card, which is what keeps the pair comparable at a glance.

The container query (the project's first) is deliberate: what decides the shape
is the width of **this cluster**, which narrows with the profile, the hand dock
and the nesting depth — no viewport knows it. Below the width two readable
options need, both cards and the separator go full-width, so «или» sits BETWEEN
them instead of riding up next to option 1.

### What must NOT join the options

Results that apply whatever the player picks — the card's tags above all — stay
in the level-2 cluster **below** the options. They never take focus, never wear a
selection ring and must not read as a third option.

---

## 3 · The heading

`Result` → **`Choose the result`** when the card asks a real question
(`hasVariantChoice` = more than one *available* branch). The predicate is the
card's SHAPE, not the player's progress, so the heading is stable for the life of
the preview and answering never re-flows the block under the cursor.

## 4 · i18n

`ru/ui.json`: `Choose the result`, `Choose the result first`, `New action`,
`Permanent effect`, `by condition`; `Tags`, `Select`, `or`, `Result`,
`Victory points` already existed and are reused. (English text IS the key — grep
before coining.)

## 5 · Guards

* `tests/client/components/console/consolePlayCardComposer.spec.ts` —
  `initialVariantSelection` over every branch shape, `need-variant` ahead of
  every other state, «the ИЛИ choice is a commit REQUIREMENT» (the gate refuses
  the commit AND the cursor), and `playPrimaryVerb` = `Select` on a variant.
* `tests/client/components/console/consolePlayCardResult.spec.ts` — the result
  section list is never empty and carries the compact labels.
* `tests/e2e/console-payment-panel.spec.ts` — the commit rail's bounding box is
  pixel-identical across the payment densities (the same rail this file's states
  paint).

The composer itself **cannot be unit-mounted** (it transitively imports
App-adjacent modules, which zeroes a mochapack spec file — see
`client-test-suite-baseline-red`), so everything decidable lives in the pure
modules above and the rest is proven with a throwaway e2e probe.
