# THE PREGAME IS A SHOWCASE — the contract of the screens before the game

*TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА» (2026-10-17). Read before touching «Мои партии», «Мои кампании», the creator or any
pregame `.cm-*` surface. The lobby's DATA model is `docs/claude/my-games-lobby.md` — this file is about its SURFACE.*

The pregame is the first thing a player sees on the couch. Before this iteration it was the one large area of the
console that had never been through a 4K pass: «Мои партии» was the confirm-dialog chassis of «Выйти из игры?» (a plate
of 11 % of a 4K screen, 21 of 25 texts under the TV floor), «Мои кампании» the same plate with the campaign's name cut
in a row that was 60 % empty, and the creator three strips on the top 28 % of the screen with a briefing in 25–29 px
print. The fix is ONE grammar — the campaign map's.

## 1. The grammar: head · stage · bar

Every product list before the game is a SCREEN, never a dialog:

- **head** — the stable context («ГЛАВНОЕ МЕНЮ ›»), the title («МОИ ПАРТИИ»), the slice segment (the old `.cm-gametab`
  strip — L3 toggles it, a click works too), the status (a refresh in flight; at rest it holds its place);
- **stage** — the whole opening under the head: a GRID of cards, or one of the honest states;
- **bar** — the menu's own command bar (one bar, never a second one on the screen).

The chassis is `ConsoleLobbyScreen.vue` (`.cm-screen` · `.cm-screen__head` · `.cm-screen__stage`, the unfolding
`.cm-screen__plate`); «Мои партии» (`ConsoleMainMenu`) and «Мои кампании» (`ConsoleCampaignsList`) stand on it. A dialog
(`.cm-overlay`) remains for exactly two things: a CONFIRMATION (delete · exit · Steam) and a FIELD EDITOR (the
participant editor, the profile). A new product list on `.cm-overlay` is the defect this contract exists against.

## 2. A game is a CARD

`ConsoleLobbyCard.vue` over the pure `console/menu/lobbyCardModel.ts` (`gameCardView` / `campaignCardView`, spec'd under the
server runner — `tests/console/lobbyCardModel.spec.ts`). A card is an OBJECT, never a line:

- the **board miniature** (`PremiumMapFingerprint variant="card"`, the SVG of the real layout — the same miniature the
  campaign's mission card draws; never a raster) on its accent ground;
- the **name in the hero voice** — it WRAPS (two lines) rather than cuts; an ellipsis is the last resort of a name longer
  than both (e2e C: `scrollWidth === clientWidth` on every name);
- **ONE state chip**, read by form AND colour (never colour alone — the chip carries its words, its MARK doubles them: a
  diamond to act, a ring to wait, a triangle for a refusal, a bar for an abandoned campaign): `Your turn` · `Turn: Bruno`
  · `Game finished` · the membership refusal (`No seat with your name` / `Several players share your name here` — by the
  identity's NAME, `joinableGames.ts`) · `not responding` (a quiet LAN host) · a campaign's own state
  (`campaignListModel.campaignStateLabelKey`); a long state wraps, it is never cut;
- the generation · the board's name · the crew (cubes and names, the viewer «ВЫ», whose turn — never on a finished game)
  · the expansions' emblems · the AGE (the sort key said out loud, on the lobby's one clock) · «Новая» (`newIds`) · the
  LAN host's name;
- a campaign adds the **route** — one node per mission, the done ones gold, the current one lit, the future ones quiet;
- a card that refuses entry is DIMMED with its reason, never hidden, and never by a whole-element opacity.

The legacy `.cm-game*` / `.cm-camp*` hooks ride the same nodes (`.cm-game`, `.cm-game--cursor`, `.cm-game__name`,
`.cm-game__campaign`, `.cm-game__exp img`, `.cm-camp`), so the lobby's e2e contracts read the card as they read the row.

## 3. The grid is solved from the MEASURED stage

`showcaseGrid(width, height, bounds)` — never from the card count (one card and six are the same geometry):

| profile | columns | card (logical) | rows on the stage |
| --- | --- | --- | --- |
| 1920 logical (FHD, the 4K TV ×2) | 3 | 24–34rem wide, row = (stage − gap) / 2 | 2; a third is a page below |
| Deck 1280×800 | 2 | the same bounds | 2 |

A short list takes as many columns as it has cards (`items`) and stands CENTRED — a showcase, not a column. The cursor
walks the grid (`showcaseStep`): ◀ ▶ the ring (wrapping, the lobby's old rule), ▲ ▼ a row (a row that is not there is a
wall; ▼ into a shorter last row lands on its last card). A third row scrolls inside `ConsoleScrollArea`
(`ensureVisible`) — never a native scrollbar.

## 4. Four honest states, on the stage

`idle / loading / ok / unreachable` (my-games-lobby §4) become the stage's states, in the stage's voice — a glyph disc,
the sentence, a hint (`[data-lobby-state="need-name|loading|error|empty"]`): no name yet · still asking · asked and
failed (RT «Обновить») · asked and none («Начните её через «Новая игра» в главном меню»). With the add-a-host tool on
screen the list is never structurally empty: the «none» sentence stands as a STATEMENT card beside the dashed
«＋ Добавить хост по адресу» card (last in the cursor ring). The three LAN states (a host not responding + its reason ·
a host with no games for this name · a stale row) stand in the BAND over the cards (`.cm-lobby__band`) and on the
cards themselves — none of them is lost.

## 5. The transition is ONE phrase (`console/menu/lobbyScreenMotion.ts`)

Menu → screen: the item column RECEDES (opacity + a step left, the brand stays; the foot with it; the opening deepens by
an overlay's opacity), the screen's PLATE UNFOLDS out of the rect of the pressed item (a FLIP of the plate alone — it
carries no text, so no letter is ever scaled), the head surfaces from inside it, the cards come in a WAVE out of the
centre with a short reading-order step (two cards symmetric about the centre still come in turn). B plays the phrase
back: the cards let go on the spot, the plate folds into the item the cursor still stands on (the cursor never moved),
the column returns. `<transition :css="false">` with JS hooks — never a `v-if` blink; transform / opacity only, on
`consoleMotionMs` + `MOTION_EASE`; every part is held at its first keyframe from the first frame (`fill: backwards`);
reduced motion is a 140 ms crossfade in place (no camera). Measured: the column through 0.33 → 0.05 → 0, the plate from
`scale(0.29, 0.09)` at the item to the identity in ≈ 340 ms, the last card ≈ 600–900 ms after the press.

## 6. The creator is a mission briefing

From the logical 1920 layout up (`CREATE_WIDE_MIN_WIDTH` — ONE threshold for the stylesheet's `@media (min-width:
1900px)` and the cursor's walk, `deckNavStep(…, {wide})`):

- **the mode** — two tiles with an ILLUSTRATION (a real board for a single party; four boards on one lane for a
  campaign, the finale ringed in gold);
- **the crew** — a ROW of seat cards (the cube, the name in the hero voice, the role, the issue in amber, the creator /
  TR tags), the «add» card dashed; ◀ ▶ walk it;
- **the rules** — two columns of full-height rows, the description readable, the switch a real control; ◀ ▶ ▲ ▼;
- **the expansions** — tiles: the emblem (3.5rem), the name, WHAT IT ADDS (`.cm-exp__desc`), the switch;
- **the map** — board cards of a mission card's size (16.5rem — 660 px at 4K), the carousel centred as before;
- **the briefing** — a dossier (22rem): the crew's chips, the board's miniature (10rem), the emblems, the rules, the
  readiness, the CTA;
- **the overlays** — the participant editor, the type pick and the confirmations at the couch's size; the LAUNCH plate
  «ЦЕНТР УПРАВЛЕНИЯ» shows the BOARD as its hero beside the crew and the emblems, its CTA breathing on an opacity layer.

**The Deck 1280×800 is the base contract and does not grow**: every deck still fits it without a scroll (its crew a
vertical list, its rules one column — the base rules above the wide block).

## 7. The TV floor for the whole family

`console_tv.less` § 23: every pregame text ≥ `--con-t-floor` (0.8rem — 32 px at 4K), the secondary voice
`--con-t-secondary`; the showcase and the wide creator are authored ≥ 0.8rem already, § 23 lifts the remaining service
text (the menu's chrome, the field editors, the keyboard's lines, the dossier's small print, the campaign map's small
print, the profiles / friends / rollback / dev surfaces — their floor only). Field rows stand at `--con-hit-min`.

## 8. Guards

| guard | what it pins |
| --- | --- |
| `tests/console/lobbyCardModel.spec.ts` | the card's state by the lobby's facts (membership by name, whose turn, the archive, a LAN host, a stale row), a campaign's route and state; the grid from the measured stage; the cursor's walk; the wave |
| `tests/client/components/consoleCampaignsList.spec.ts` | the campaigns screen: one card per campaign, the order, the tabs, the LAN host, a quiet host |
| `tests/client/console/menu/consoleCreateModel.spec.ts` | the creator's walk, narrow and wide |
| e2e `console-pregame-showcase` (fhd · tv4k · deck) | A the games screen (no `.cm-overlay`, miniatures, ≥ 55 % of the viewport, nothing under the floor, names whole, A enters) · B the honest states · C the campaigns screen · D the phrase (sampled on tasks: the column recedes, the plate unfolds, the wave, B back on the same item) · E the creator (illustrated modes, the crew a row, two rule columns, the expansions read, map cards > 600 px at 4K, the floor) · F the overlays on the floor · H reduced motion |
| e2e `console-campaigns-list` | the campaigns list's behaviour on the new chassis (the fit sweep reads `.cm-screen__stage`) |

## 9. If you extend this

- A new product list before the game stands on `ConsoleLobbyScreen` with a pure card view; never a `.cm-overlay`.
- A new card field goes into `lobbyCardModel` (and, when it comes from the server, into the lobby's `LobbyRecord` and its
  fingerprint — my-games-lobby §7).
- A new creator deck: the wide layout in the `@media (min-width: 1900px)` block, the Deck base untouched, the walk in
  `deckNavStep(…, {wide})`.
