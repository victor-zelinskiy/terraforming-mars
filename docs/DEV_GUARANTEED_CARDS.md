# Dev tool — «Гарантированные карты» (guaranteed starting cards)

A **development** sub-setting of «Тестовый режим» on the console-native create
screen, visible only to the `admin` seat. It pins chosen cards into the first
hand every player is dealt, so an e2e run or a feature check reaches a specific
card without re-rolling the deal.

Deliberately a **utility**, not a premium surface: plain rows, no card faces, no
cinematics. Console native only — the frozen desktop create form is untouched.

## Where it lives

| Layer | File |
| --- | --- |
| Row + picker overlay | `src/client/components/console/menu/ConsoleRulesDeck.vue`, `ConsoleDevCardPicker.vue` |
| Catalogue (needs the card manifest) | `src/client/components/create/premium/devGuaranteedCards.ts` |
| Picks in the create state | `src/client/components/create/premium/createGameState.ts` (`GuaranteedCardPicks`) |
| Routing into the request | `src/client/components/create/premium/buildCreateGamePayload.ts` |
| Server option | `src/server/game/GameOptions.ts` (`customProjectCards`), `src/server/routes/ApiCreateGame.ts` |
| Deal | `src/server/Game.ts` (`projectDeck.putOnTop`), `src/server/GameCards.ts`, `src/server/cards/Deck.ts` |

## The flow

1. Rules deck shows «Тестовый режим». With it **on** *and* an `admin` seat, a
   nested `DEV` row appears: «Гарантированные карты», value = pick count.
2. A opens the picker — three levels in one overlay:
   - **PICKED** — what is rigged. A/Y remove, View clears, X inspects.
   - **MODULES** — `GUARANTEED_MODULES` = `base` + `PREMIUM_EXPANSIONS` (the
     create screen's single scope access point). A module that is switched OFF
     is still offered and marked «Дополнение выключено» — the guarantee adds the
     card to the pool anyway.
   - **CARDS** — that module's cards, grouped by card TYPE, alphabetical by the
     **localized** title. A toggles, LB/RB jump between type groups, ◄ ► page.
3. X inspects the cursored card fullscreen (the console-wide inspect verb),
   reusing the shared `CardZoomModal`. `ConsoleShell` mounts that modal in-game
   and does not exist pre-game, so the picker **hosts its own instance** behind
   a `<Teleport to="body">` and routes pad intents to it while it is open.

## How the guarantee actually works

There is no new dealing code — it rides the server's existing "cards on top of
the deck" mechanism, so the picks are stored **already split** by target list:

| Card type | Server list | Applied by |
| --- | --- | --- |
| `CORPORATION` | `customCorporationsList` | `corporationDeck.shuffle(...)` |
| `PRELUDE` | `customPreludes` | `preludeDeck.shuffle(...)` |
| `AUTOMATED` / `ACTIVE` / `EVENT` | **`customProjectCards`** (new) | `projectDeck.putOnTop(...)` |

Storing the split lists (rather than one flat list) is load-bearing:
`buildCreateGamePayload.ts` is covered by a **server-runner** spec, and the card
manifest (`@/genfiles/cards.json`) only resolves under webpack/mochapack. Nothing
in the shared create modules may import `devGuaranteedCards.ts`.

### Three traps this had to solve

1. **The solo neutral player eats the top of the project deck.** In a one-player
   game `GameSetup.setupNeutralPlayer` runs *before* anyone is dealt and draws
   (then discards) project cards for its placement bonuses — so ordering the
   deck at construction time silently loses the guarantee. Hence
   `Deck.putOnTop()`: applied **late**, right before the deal loop, and unlike
   `shuffle(cardsOnTop)` it does not re-merge the discard pile (which would
   resurrect cards the game deliberately discarded). It reclaims a named card
   from the discard pile and leaves everything else in place.
2. **A random first player gives the picks to someone else.** The cards land in
   the FIRST hand dealt, and `randomFirstPlayer` defaults to `true`. So when
   anything is guaranteed, `buildCreateGamePayload` pins the creator as first
   player. Dev branch only — an ordinary party is untouched.
3. **Two cards the server refuses to guarantee** (`NOT_GUARANTEEABLE`): Delta
   Project (`Game.newInstance` *throws* when it appears in `customPreludes` — it
   is a global subsystem, not a dealt prelude) and the Beginner Corporation
   (`GameCards.getCorporationCards` strips it from the deck on purpose). They are
   not offered at all — a pick that silently no-ops or breaks creation is worse
   than an absent one.

## Safety

- Double-gated exactly like test mode: `adminUnlocked(state) && rules.testMode`.
  Losing either withdraws the whole branch, so a persisted admin setup can never
  leak picks into a real party.
- Picks persist with the rest of the create setup (`tm_last_game_settings`), which
  is the point — repeated e2e runs keep the rig. The shared state sanitizes only
  the SHAPE; `ConsoleCreateGame` calls `pruneGuaranteedCards` after restoring to
  drop names a later build renamed or removed.
- A restored pick sitting in the wrong list is dropped too — the server would
  otherwise deal it from a deck it does not belong to.

## Tests

| Spec | Covers |
| --- | --- |
| `tests/client/components/create/devGuaranteedCards.spec.ts` | catalogue: scope, grouping/sort, toggling, routing, pruning, the refused cards |
| `tests/client/components/create/premiumCreateGamePersistence.spec.ts` | persisted key set + pick round-trip + blob sanitizing |
| `tests/client/console/menu/consoleCreateModel.spec.ts` | the sub-row's visibility gate, append-only row indexing, count |
| `tests/createGame/buildCreateGamePayload.spec.ts` | routing into the three lists, the test-mode gate, the first-player pin |
| `tests/Game.spec.ts` | the cards really are dealt — including one whose module is off |
| `tests/cards/Deck.spec.ts` | `putOnTop` ordering, discard reclaim, no-ops |
