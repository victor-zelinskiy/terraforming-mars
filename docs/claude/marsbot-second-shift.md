# «ДИНАМИЧЕСКИЙ БАЛАНС» — MarsBot's pace across the game (early: a deck that fills gradually · late: «ВТОРАЯ СМЕНА»)

**Status: SHIPPED 2026-10-28, HIDDEN by the owner's decision the same day; re-calibrated and given its EARLY half 2026-10-29** after the «Cold Carbon Mass» campaign (§ Calibration 2). ONE switch beside the bot's difficulty — «Динамический баланс» (the option key stays `AutomaOptions.secondShift`, so saves and campaigns created with it keep it). The late half: `src/common/automa/SecondShift.ts` + `src/server/automa/SecondShift.ts`, guard `tests/automa/SecondShift.spec.ts`; the early half: `src/common/automa/DynamicBalance.ts` (+ the deck builders `AutomaSetup` / `AutomaResearch` / `AutomaCorporations.dynamicBalanceTrim`), guard `tests/automa/DynamicBalance.spec.ts`.

## The problem (measured, not felt)

The bot's action deck is rebuilt every generation by the rulebook (`AutomaResearch.buildActionDeck`: 3 project cards, 4 on Brutal, +1 for 5 floaters, plus the top bonus and the recurring cards) — a **constant 6–7 actions** whatever the generation. A human engine in Turmoil Redux runs 12–15 turns a generation from the 7th on. Measured on the owner's **25 finished Redux games** (`C:\Projects\Mods\tm-real-games\redux-full`):

- from generation 7 the bot takes **about a third** of the best human's actions;
- it **passes FIRST in 75–91 %** of the late generations, then sits out while the humans keep building;
- its tracks therefore stall exactly when the dividend clauses need them — Manutech's third mark (#15) was reached by **0.2 tracks per game**.

A dividend recalibration alone would only lower the bar; the owner's point was that the bot should **stay in a long generation**, not be paid more for leaving it.

## The rule

> While at least one player is still acting in the generation, MarsBot does not pass when its action deck runs out: it draws an extra project card off the project deck and resolves it exactly as any other action card — up to the difficulty's cap per generation.

The cap is a LADDER of five generation bands (the owner, 2026-10-29 — `SECOND_SHIFT_CAP_LADDER` + `SECOND_SHIFT_BAND_STARTS`; Hard is the owner's own row, the others one step around it), read LIVE at every bot turn from the game's generation, so a game already under way with the switch on takes a new ladder up the moment the server does (no migration, no stored cap):

| Difficulty | 1–4 | 5–6 | 7–8 | 9 | 10+ |
| --- | --- | --- | --- | --- | --- |
| Easy | 0 | 0 | 1 | 1 | 2 |
| Normal | 0 | 1 | 1 | 2 | 3 |
| Hard | 0 | 1 | 2 | 3 | 4 |
| Brutal | 0 | 2 | 3 | 4 | 4 |

Why: before the rule the bot passed LAST in 100 / 100 / 96 / 68 % of the 1st–4th generations and FIRST in 32–44 % of the 5th–6th, 75–90 % of the 7th–8th, 91 % of the 9th — an extra card early only widened a lead it already had. Brutal stays at 4 because its +1 VP per played card compounds with every extra card. (The first ladder, 2026-10-28: Easy 0/1/1 · Normal 1/1/2 · Hard 2/3/4 · Brutal 3/4/4 over 1–6 / 7–9 / 10+.)

## The early half — the BONUS side of the deck fills gradually (2026-10-29)

> With the switch on, the 1st generation's action deck takes NOTHING of its BONUS side — the top card of the bonus deck plus the recurring cards — and the 2nd / 3rd / 4th / 5th at most 1 / 1 / 2 / 3 of its cards, chosen by a shuffle; from the 6th the whole side. The PROJECT cards are never cut.

The action deck is two parts. The PROJECT cards (3 on Hard, +3 for the preludes in the 1st generation) carry the random tags that make one game's bot unlike another's. The BONUS side — the top card of the bonus deck (8–9 cards: Meteor Shower, Invasive Species, R&D, Overachievement, Expedited Construction, Lobbyists, Local Neural Instance, the map's Corporate Competition, Outer System Foothold with colonies) plus the RECURRING cards (Party Politics in Redux, Government Intervention with Venus, Shipping Lines with colonies from the 2nd generation) — is largely the same every game. So the early cut takes from the bonus side, and a shuffle picks what comes in: one game's bot opens with Party Politics, another's with Meteor Shower.

`DYNAMIC_BALANCE_BONUS_SIDE = [0, 1, 1, 2, 3]` (`common/automa/DynamicBalance.ts`), composed by `composeBonusSide` (`server/automa/DynamicBalance.ts`) in BOTH deck builders (`AutomaSetup` — the 1st generation; `AutomaResearch.finishActionDeck` — every rebuild, drafted or not). A deferred TOP card goes back on top of the bonus deck (it comes in with the next deck — never discarded); a deferred RECURRING card sits the generation out; a card the bot's corporation OWNS (Ecoline's B23) is its mechanic, always in and outside the count. Silent (hidden balance). A Redux + Venus + colonies game (the bonus side is FOUR cards a generation from the 2nd: the top card + three recurring — the ladder counts those four, so «3» is three of four and there is nothing above «all»): the bonus side 3 / 4 / 4 / 4 / 4 → 0 / 1 / 1 / 2 / 3 — 3 / 3 / 3 / 2 / 1 turns fewer in the 1st–5th generations. A game with no recurring card (no Redux, no Venus) has a bonus side of one card: its 1st generation goes without it, nothing to cut after. A cap of zero needs no special case: nothing is kept, the top card waits on the bonus deck, Party Politics' generation is marked, the corporation's own card is still in.

Measured (25 Redux Hard games before the rule): the bot made 9.3 / 7.3 / 7.4 turns in the 1st–3rd generations, 3.2 / 4.2 / 4.2 of them from the bonus side, and passed LAST in 100 / 100 / 96 % of them.

**Why the ladder starts at ZERO and runs to the 4th (the owner, 2026-10-29 evening: «early у него всё ещё слишком сильный … а что если в первом поколении сделать у него 0 бонусных карт»).** The first ladder was 1 / 2 / 3, the whole side from the 4th. The same 25 games, read as the bot's lead over the best player after each generation (`victoryPointsByGeneration`): +2.4 / +8.3 / +12.8 / +17.1 / +20.5 after the 1st–5th — the 1st generation adds little (its 3 bonus-side turns beside 6 project turns; across all 136 Hard games a 1st generation with NO bonus-side turn still led by +3.5 against +4.7 with two: the project cards and the rating do it), the 2nd–4th build the lead (+5.9 / +4.5 / +4.3) with the bonus side more than half of the bot's turns there. The marginal value of one bonus-side turn in the 2nd–4th is measurable — 4 turns → +5.7 / +4.0 / +4.0 of lead per generation, 5 turns → +7.0 / +7.3 / +6.0 — ≈ +1.5–3 VP each. So the zero in the 1st generation is the smaller half of the change; the larger is that the 2nd–4th each lose one more bonus-side card than under 1 / 2 / 3 (expected ≈ −2 VP of lead per generation, the lead after the 4th from ≈ +17 toward ≈ +10). What the 1st generation goes without: Government Intervention's parameter step (World Government Terraforming — raised in the solar phase, NO TR for the bot: it moves the game clock, not the bot's score; corrected 2026-10-30, the first write-up said «≈ 1 TR»), Party Politics' TURN (its vote rides the mandate), the random top card (delayed one generation, never lost — it waits on top of the bonus deck). Both ladders were estimated on games before the rule — calibrate on the box's games with the switch on.

**Stretched by one generation — 0 / 1 / 1 / 2 / 3 (the owner, 2026-10-30).** The first campaign under 0 / 1 / 2 / 3: «Binary Oxygen Surge» (`C:\Projects\Mods\tm-real-games\ladder0`, 4 missions, TWO players + bot, Hard, Redux + Venus + colonies + prelude; the bot played 6 project / 0 bonus turns in every 1st generation). The bot's lead over the best player on the TABLE — the campaign's title points subtracted, they are 15 a mission for the bot's «governor» against 10 / 5 for the players and open the 2nd–4th missions at +5 / +15 / +20 before a card is played — by generation: Tharsis 0 / +14 / +19 / +23 / +21 / +36 / +52 → a three-way tie at 164; Hellas −6 / +6 / +1 / +2 / +11 / +31 / +22 → +23; Elysium −11 / −6 / −2 / +13 / +9 / +14 / 0 → +15; Utopia +8 / +2 / +7 / +14 / +12 / +13 / +12 → −18 on the table (the titles made the final +7). Mean after the 1st–4th: −2 / +4 / +6 / +13 against the old corpus's +2 / +8 / +13 / +17 — the 1st generation no longer moves the lead (the bot is behind after it in two missions of four), the 4th (+7 a generation, +15 on Elysium) and the 5th–6th do. The owner's first idea was to withhold PROJECT cards in the 1st–2nd (2 / 1); the corpus puts a project turn's marginal value in those generations at ≈ 0–1 VP (6 vs 7 project turns in the 1st: +4.4 vs +4.7; 3 vs 4 in the 2nd: +5.2 vs +4.3) against a bonus-side turn's +1.5–3, and the cut would have cost the bot a third of its 1st-generation presence for ≈ −1 VP — so the bonus ladder is stretched instead: the 3rd generation keeps one card, the 4th two, the 5th three, the 6th all (expected ≈ −2 VP of lead in each of the 3rd–5th). The campaign's title points are a separate question for the owner. Scripts: `pergame.js` (turns and lead by generation per game), `projval.js` (lead growth by project / bonus turns), `final.js` (win rate and margins) in `%TEMP%\divledger`.

**Party Politics left out keeps its vote** (the owner, 2026-10-29: «важно, чтобы бесплатный делегат из лобби тратился»). The lobbying mandate's tables are drawn with Party Politics' one vote a generation counted in (an empty mandate — 42 % early — means the card's vote alone), so a deck without the card would leave the lobby's free delegate unspent in roughly a fifth of the early generations. `composeBonusSide` marks the generation (`AutomaState.partyPoliticsDeferred`, serialized) and `AutomaLobbying.mandateOf` gives that generation's mandate `carries: 1` (`LobbyMandate.mandateTotal` — the card plus what it carries, never past ALL): the same number of votes, the lobby's delegate first (never held), sent by the lobbying's catch-up before the deck runs out — only the card's own TURN is gone. Guard: `tests/automa/DynamicBalance.spec.ts` § Party Politics left out.

**The first cut (rolled back the same day).** It withheld 2 / 1 / 1 PROJECT cards. The owner: «без проектных карт в начале бот будет в каждой партии играть одинаково по своим бонусным картам — тут разнообразие важнее». A cut that answers what the PLAYERS do (e.g. «the bot passes once everyone has passed») was rejected outright: a pace that follows the table's moves is a hidden lever the players would learn to pull.

## Calibration 2 — «Cold Carbon Mass» (2026-10-29)

The owner's campaign with the switch on (Hard, Turmoil Redux, 4 missions; `C:\Projects\Mods\tm-real-games\cold-carbon`): the bot won all four — 130 : 122, 142 : 112, 164 : 115, 207 : 137. Its lead came first from the rating (TR 74–83 against 50–60), then from the dividends in missions 3–4 (30 and 47 VP). Extra cards actually drawn per generation (projects beyond 3): 0.3 / 0.5 / 1.3 / 2.3 / 2.5 / 3.5 in the 2nd–7th — the old ladder fed the bot in the 4th–6th generations, where it already outlasted the players. The re-calibration moves those cards out: none before the 5th, then 1 / 2 / 3 / 4 on Hard, and a thinner start.

Nothing changes in a generation the bot outlasts (the first four, every short game, every generation where the humans pass first): the trigger is the bot's EMPTY deck while a human is still in the round. A player who passed is not «acting»; the bot itself never counts. When no project card is left to draw, the bot passes.

## HIDDEN BALANCE — the rule is never announced (the owner, 2026-10-28)

«Игрок по сути не должен знать, КОГДА бот возьмёт доп. карту»: a player who knew the moment and the cap could pass «at the right time» to deny the bot its extra cards, and the difficulty would be played around instead of played against. So the rule is part of the difficulty's hidden balance:

- **No journal line of its own.** The extra card is journaled as the ordinary «${bot} played ${card}» — the same line as any action card.
- **No turn step, no review chip.** `MarsBotTurn` has no `second-shift` kind; the turn review reads an extra card's turn as any other.
- **No model field, no counter.** `MarsBotModel` carries nothing of it; the bot screen's decks plate keeps the rulebook's paragraph («passes until the next generation») and shows no count or cap. The hub is the same screen with the rule on or off — e2e `console-bot-second-shift` guards exactly that.
- **The deck count stays honest.** «Колода действий N» is the rulebook's own visible fact; an attentive player can see the bot act off an empty deck. Hiding or inflating the count would be lying, and the exploit is weak anyway: denying the bot one card costs the player their own remaining actions.
- **The only place the rule is named is the creator's switch** beside the bot's difficulty, and its note names NO number («сколько — зависит от сложности»).

The server keeps `AutomaState.secondShift {generation, drawn}` for the cap (serialized, optional on old saves) — state, never a surface.

### The switch (`AutomaOptions.secondShift`)

- **Engine default OFF when the option is absent** — every pre-rule save, fixture and spec keeps its exact behaviour.
- **The creator defaults ON for a new game**: `PremiumCreateGameState.botSecondShift` (persisted; a blob saved before the rule restores ON), sent as `automa.secondShift` by `buildCreateGamePayload`. The console creator shows it as the «Вторая смена» stepper beside the difficulty in the bot editor (◄/► and A flip it); the crew row names «Вторая смена» only when it can fire (on AND cap > 0).
- A campaign inherits it through its stored `NewGameConfig` — `CampaignManager` spreads `gameOptions.automa` when it sets the corporation and the portfolio, so the switch travels with the difficulty.

## The corporation's choice — two looked at, one kept (the owner, 2026-10-28)

The regular action deck is DRAFTED in the owner's games (all 25 measured: draft, Hard) and the corporation's Draft Priority shapes it, so a blind extra card would dilute the bot's tendency. The bot therefore looks at the top TWO cards of the project deck; its priority keeps one (`AutomaCorporations.secondShiftPick` — the draft's own `pickCard`, SILENT: no corp stat, no journal line) and the other goes back ON TOP of the deck. Nobody but the bot saw it, and the table sees exactly one card leave the deck, as with any draw. Corpless: a seeded random pick. The second card is looked at only while it is not the pile's last — taking the last would reshuffle the discard into a new deck, an event a one-card draw would not cause; then the bot takes the top card as it lies. Caps unchanged. A «least advanced track» priority (Aridor) reads the live tracks at that moment. The pace bench still measures blind extra cards — the per-card yield it reports is a floor.

## The engine's one hook

`AutomaController.resolveTurn`: the ONE place the bot would pass asks `SecondShift.take(game)` first — the card goes INTO the action deck, so the turn runs the ordinary project branch (journal «played», the corporation's hook, the human reactors, the lobbying rider, the played pile). `SecondShift.offer` is pure; only `take` draws and bumps the count.

## Manutech now — the first beneficiary

The third mark of «Производственные циклы» moved **#15 → #13** (goals untouched). The FULL recalibration of every track-based clause (C13, C15, C19, C29, …) is deliberately **after** the pace rule has real games behind it — re-marking against pre-rule tracks would bake the stall in. `docs/claude/marsbot-dividends-calibration.md` keeps the C29 row annotated.

## The pace bench

```
npx tsx scripts/marsbot-pace-bench.ts <snapshots-dir> [--cards=3] [--finals=<dir>]
```

Reads mid-game snapshots copied from the box (`~/.config/terraforming-mars/embedded/db/files/history/`), deserializes each with a no-op database, resolves N extra project cards for the bot and measures the track / TR / M€ yield per card, then projects the finals from `--finals` (the finished games) under the policy. It is a MEASURE, not a simulator of the humans — use it to size a cap, never to claim a win-rate.

## Gotchas

- `Game.deserialize` of an action-phase save calls `Game.save` → the bench installs a no-op `IDatabase` first.
- The live tracks are `automa.board.tracks` (`automa.tracks` is the serialized shape).
- `AutomaState.ts` is CRLF — a `\n`-anchored string replace silently misses; use the Edit tool or a CRLF-normalizing helper.
- A hub section of its own for the rule overflowed the decks plate at 4K even at the fit ladder's floor (the first, announced iteration) — one more reason the plate keeps the rulebook's paragraph.
