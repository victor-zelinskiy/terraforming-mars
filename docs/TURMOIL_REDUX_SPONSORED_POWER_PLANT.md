# TR59 Sponsored Power Plant («Спонсируемая электростанция») + the iteration «ИСТОЧНИК — ТО, ЧТО ЗАПЛАТИЛО ВАМ; КАРТОЧКА — ОДИН ВЗГЛЯД»

**Status.** Shipped 2026-10-16. The prompt: `docs/claude/prompts/project-tr59-sponsored-power-plant.md`. The notification
contract: `docs/claude/notifications.md` § ONE GLANCE and § «ИСТОЧНИК»; the rule: `.claude/rules/console-ui.md` §
A NOTIFICATION ANSWERS THREE QUESTIONS. Ledger: section AY (`docs/claude/gameplay-polish-ledger.md`, PL-540…). Decisions
1–9 were taken at their defaults (see § 6); the owner confirmed 4a · 5a · 6a · 7a (2026-10-16).

## 1 · The card

Green (AUTOMATED), 8 M€, Power + Building tags, the INDUSTRIALISTS' plate (they rule, or 2 of the player's own delegates on
their resolution — the TR15 class; TR36 lowers no requirement), no VP, no resource. «Increase your energy production 3
steps.» ONE declaration — `behavior: {production: {energy: 3}}` (`ENERGY_PRODUCTION = 3`), the face prints THREE energy
icons on the production plate (Fusion Power's print). Lore (EN word for word, key `TR59`): «The power companies saw in Mars a
new opportunity to be deregulated, and they jumped on it.» — RU «Энергокомпании увидели в Марсе новую возможность уйти от
регулирования — и ухватились за неё.» Art: Martin Sawkins (`Mars Arts/TR59.png` arrived during the work — imported).
RU description follows TR54–TR58 («Требует, чтобы «Индустриалисты» были у власти или у вас было 2 делегата на их
резолюции…»). Spec `tests/cards/turmoilRedux/SponsoredPowerPlant.spec.ts` (17): the requirement (ruling / two own delegates /
one is not enough / a rival's do not count / Council Seat changes nothing), +3 production never stock, Thorgate 5 M€, Power
Supply Consortium counts the tag, steel and Construction Mechs pay, Manutech's +3 energy forecast and payout, the preview chip
and its purity, save / load.

## 2 · «ИСТОЧНИК — ТО, ЧТО ЗАПЛАТИЛО ВАМ» (part A)

**The owner's report (2026-10-16).** A player gets «+1 M€» because somebody (a rival, MarsBot) built beside their Ares tile —
and the toast names the BUILDER's card as its source: the card the actor played, «Город» (the standard project), the bot's
bonus card «Ускоренное строительство». The money is the tile's. Frames «before» — `screenshots/tr59/{fhd,tv4k}/before-*.png`
(the stand `tests/e2e/console-notification-source.spec.ts`, fixtures `notification-source-ares` / `-ares-bot`, run on a HEAD
build): human — «ИСТОЧНИК Город»; bot — «ИСТОЧНИК Ускоренное строительство» + three bookkeeping lines; «Закрытая зона» named
nowhere.

**The root — one line.** `AresHandler.earnAdacencyBonus` paid the adjacent tile's owner with no scope of its own, and
`EventRecorder.emit` gave the event the TOP scope's source (`input.source ?? ctx?.source`) — the actor's action. Under a bot
turn (`beginAction(bot, undefined, 'automa-turn')`) there was no source at all, the turn script could not attribute it
(`AutomaTurnLog.impactCausesOf` skips a source-less event), and the client's residual named the bot's revealed card.

**THE RULE (decision 4a).** The SOURCE of a payout to someone who is not the actor is what belongs to the RECIPIENT and paid
them: their tile (the card that put it there, else the tile itself), their card, their corporation, their colony. The actor's
move is the TRIGGER — it rides the cause as a quiet tail («ход: Купольный кратер»), never as its name. An ATTACK and a payout
the actor's card itself decided («each other player draws a card») keep the actor's card — that card did decide it.

| Class | Before | After |
| --- | --- | --- |
| Ares owner benefit (card play / std project / conversion / final greenery / Parliament craze / bot turn) | «ИСТОЧНИК ‹actor's card / Город / bot card›» | «ВАШ ТАЙЛ ‹the tile's card› · за город рядом · ход: ‹actor's move›» — `withEffectSource(owner, {card of the tile}, 'tile-adjacency')`; a tile with no card → new `EventSource` `{kind: 'tile', tileType, owner}` |
| Marketing Experts (+1 to the owner benefit) | merged into the actor's line | its own cause «ВАША КАРТА Специалисты по маркетингу · за размещение города» (`withEffect(owner, ME, 'tile-placed')`) |
| Mining Area / Mining Rights (Ares) | the tile recorded no card — nothing to name | `addTile(…, {card: this.name})` |
| MarsBot turn | residual named the bot's card as the SOURCE of a gain | the payout has its own source (above); a residual GAIN is «ИСТОЧНИК Ход бота · ход: ‹card›»; a residual LOSS keeps the bot's card (it did take it) |
| Detective TV Series (underworld) | «ВАША КАРТА ‹actor's crime card›» (`from: {card: card}` rewrote the owner) | `from: {card: this}` — «ВАША КАРТА Детективный сериал» |
| Mons Insurance → the claimant | under the attacker's scope, in one group with the loss | `withEffectSource(claimant, {Mons, owner: insurer}, 'insurance-claim')`; the aggregates fold only the source owner's own events (`aggregate.ts` `ownersOwn`) — the insurer's stats unchanged (`economicStats.spec`) |
| Colony bonus to the colony's owner | «ИСТОЧНИК Бонус колонии · ‹колония›» | «ВАША КОЛОНИЯ ‹колония› · Бонус колонии · ход: торговля» (client: `benefit: 'colonyBonus'` is only ever paid to a colony's owner) |
| Tharsis / Pets / Rover / Immigrant City (reference) | «ВАША КОРПОРАЦИЯ Tharsis · за размещение города» | the same + «· ход: ‹actor's card›» |
| Attacks (Energy Tapping, Mons on-play, the bot's Meteor Shower) | the attacker's card | unchanged (honest) |
| WGT in the SOLAR phase | S5 asserted a payout | `Game.addTile` grants no placement bonus in SOLAR — no payout, honestly (S5 rewritten; the coverage guard's door row corrected) |
| Moon / Underworld «by any player» fan-outs | bare | out of the premium scope — documented frontier (`notifications.md` § CROSS-PLAYER DELIVERY AUDIT) |

**Client.** `ViewerImpactCause.via` (`notificationSemantics.viaOfRoot` — the root's card / standard project / trade / bonus
card, only when it is NOT the cause itself); `causeLineOf` labels: `Your tile` (own + `tile-adjacency`, or the `tile` kind),
`Your colony`, `Your card`, `Your corporation`, `Source`; the trigger phrases «за город / озеленение / океан рядом», «за тайл
рядом: ‹…›»; the via tail `move: ${0}` («ход: …»). The actor is NOT named in the line — the head's chip is the one identity
statement. The placement dossier already credited the neighbour's tile (`BoardInformationEngine` ~2317) — now both agree.

**The guard.** `tests/notifications/foreignGainSourceGuard.spec.ts` — the class rule over the corpus of foreign-payout classes
(Ares × card play / std project / cardless tile / Marketing Experts / bot turn, Tharsis + Pets, Mons claim, Detective TV, the
Sponsored Academies table payout): every GAIN recorded for a non-actor has a source that is NOT the actor's root source (allow
list with reasons: Sponsored Academies' printed table draw; Mons Insurance, whose source's owner is the insurer). Proven red on
the HEAD `AresHandler` (5 Ares classes, each naming the class, the borrowed source and the event) and green after. The corpus:
S1 rewritten (the tile's card, `own`, `tile-adjacency`, `triggerTile` CITY, the via, the marker), S3 / S7 / S12 assert the tile,
S5 the honest SOLAR path; Ares tiles in the corpus carry their card. A runtime tripwire in the recorder was considered and NOT
added: legitimate table payouts would make it noise without a central card list (invariant 8) — the guard is where the class
rule lives.

## 3 · «ОДИН ВЗГЛЯД» (part B)

**The diagnosis** (frames «before»): up to 21 zones on one toast; the actor named 2–4 times (head chip, cluster tag
«PLAYER2 / БОТ», the transfer arrow); the card of an action twice (kicker + «использовал действие ‹X›»); the type said twice
(«КАРТА СЫГРАНА» + «сыграл ‹X›»); the bot named its bonus card in the cause and again in «… уничтожена»; «из запаса 500 → 495»
under the chip; a «Марс» cluster repeating the HUD; under the viewer's band, three lines of the bot's own bookkeeping
(«получает 1 M€ за бонус соседства» read as the VIEWER's gain); «ЗАЖАТЬ X ЖУРНАЛ · B ЗАКРЫТЬ» in words; seven zones below the
TV floor (the «ИСТОЧНИК» label 22 px at 4K); the card covered the strategy rail's «ДОСТИЖЕНИЯ».

**The hierarchy** (`ConsoleNotificationCard.vue`): (1) WHAT CHANGED FOR YOU — the hero band, a tinted stripe across the card,
the numbers bare and the card's largest (1.35rem / TV 1.75rem), the sign in three channels; (2) WHY — one line per cause hanging
off the band («ВАШ ТАЙЛ Закрытая зона · за город рядом · ход: Город»); (3) WHOSE TURN — the head's actor chip, ONCE; (4) what
the actor got — one quiet line under a hairline, the actor's DOT only (≤ 2 chips); everything else — the journal (hold X). A
card that touched nothing of the viewer's: the type + the CARD alone for a play / an action / a standard project (the verb
said the type twice); the kicker names the action's card only when the headline is not on screen.

**What NO setting may filter** (`notificationContentPolicy.ts`, pinned row by row in `notificationContentPolicy.spec`): the
viewer's band (gains AND losses) and its causes; the actor chip; the viewer's own skipped effect; an attack on the viewer (a
zero outcome included); warnings, the turn prompts, the terraforming-complete announcement; a reveal line, a passive source /
law line, a burst's count.

**The two settings** — the new category «УВЕДОМЛЕНИЯ» (decision 6a): «Быстрые уведомления» (moved from ИНТЕРФЕЙС — WHICH toasts)
and «Содержание уведомлений» (`notificationContentMode.ts`, localStorage `tm_notification_content` — WHAT a toast carries):
- **Кратко** (default, decision 5a): no «Марс» cluster; the actor ≤ 2 chips; one third player's line and one third player's
  skipped line; the actor's own skipped effect and the TR49 requirement-eased line → the journal; a bot card under a band drops
  its bookkeeping, without a band keeps ≤ 2 outcome lines (+ «ещё N»), the viewer's attack lines first;
- **Только моё**: the answer alone — no actor line, no third player, no outcome line that is not an attack on the viewer.
Applied at the ONE moment a model becomes VISIBLE (`notificationState.pushTransient` / `promoteFromQueue` → `presentable`) —
a queued model keeps its whole content, a visible card is never re-rendered (ITERATION 3). The bot's outcome lines are TYPED by
their producer (`NotificationSummaryLine {message, kind, target?, fate?}`; the server stamps `bonus-fate` on the fate line —
the toast drops it when its cause names that card).

**X on a reveal card** (PL-557) opens the reveal viewer — the cards themselves — never the journal; its hint reads «[X] →
Посмотреть».

**Removed / quieted:** the pass card in the console (decision 9a — the status strip's «СПАСОВАЛ» says it); the scope /
before → after line (the regression found what it carried besides the number — «запас или доход?» — so a production delta now
names itself in its UNIT: «ПР. ЭНЕРГИИ −1», `PRODUCTION_UNIT_LABEL`); the cluster tag's actor name; the footer's words (decision 8a — `[X] → Журнал` with a RING filling around
the X glyph on `NOTIF_HOLD_MS`, the lifetime as the row's own track, `[B]`).

**Visual 4K** (`console.less` § THE CONSOLE NOTIFICATION CARD, `console_tv.less` §16 / §25): one plate; every text zone at or
above `--con-t-floor` (e2e computed probe on 4K — the static `consoleTvTypeFloor` sees only what the TV stylesheet declares);
the layer stands in the corner of the CENTRAL OPENING (decision 7a — `right: var(--con-stage-r) + .6rem`, `top:
var(--con-stage-t) + .6rem`, the live edges `useWorkspaceBandGeometry` publishes on <html>), the strategy rail is never covered.

## 4 · Families — rows before / after (Кратко, a typical card)

| Family | Before (zones / text rows) | After |
| --- | --- | --- |
| Ares payout from a rival's std project | head · band · «ИСТОЧНИК Город» · PLAYER2 + 3 chips · footer words — 5 rows | head · band · «ВАШ ТАЙЛ … · ход: Город» · ● + 2 chips · glyph footer — 5 rows, nothing repeated |
| Ares payout from a bot turn | head · band · cause · 3 bookkeeping lines · БОТ chips · footer — 8 rows | head · band · cause · ● chip · footer — 5 rows |
| A rival's play that touched nothing of yours | head · «сыграл ‹X›» · actor cluster · Марс cluster · footer | head · ‹X› · ● ≤ 2 chips · footer |
| An attack on you | head · band + «из запаса A → B» · cause · footer | head · band · cause · footer |
| A bot turn without a band | head · headline · ≤ 3 lines + «+N» · БОТ / Марс clusters · footer | head · headline · ≤ 2 lines + «ещё N» · ● chips · footer |
| A player passed | a card | none in the console (the strip) |

## 5 · Tests

Server: the card spec (17); `crossPlayerDeliveryAudit` (S1–S21; S1/S3/S5/S7/S12 rewritten); `crossPlayerCoverageGuard`;
`foreignGainSourceGuard` (new, 10 — red on HEAD); `economicStats` (Mons stats unchanged); the Ares / automa / events / boards
batch. Client: `notificationContentPolicy.spec` (new), `notificationCauseView.spec` (TR59 block), `notificationSemantics.spec`
(the bot residual), `marsBotPresentation.spec` (typed lines, the fate line, the planet cluster off the presented card),
`consoleOptionsPanel` / `consoleSettingsModel` (the new category). e2e: `console-notification-source` (fhd + tv4k: A rival, B
bot, A2 «Только моё» — the after contract: the anchor, the via, one actor statement, no «Марс», no bookkeeping, clear of the
strategy rail, the 4K floor, the card never changes in place), the translated `console-notification-semantics` (the headline is
the card) and `-premium-bot` (no actor name on a cluster, no «Марс»).

## 6 · Decisions (defaults taken; **the owner confirmed 4a · 5a · 6a · 7a on 2026-10-16**)

1. RU name «Спонсируемая электростанция». 2. Lore EN verbatim + the RU above. 3. Art — arrived, imported. 4a. The source is
what belongs to the recipient; the actor's move is the trigger tail. 5a. One quiet actor line ≤ 2 chips; no «Марс»; no bot
bookkeeping under a band. 6a. «Содержание уведомлений: Кратко · Только моё» in a new category «УВЕДОМЛЕНИЯ». 7a. The corner of
the central opening. 8a. Glyphs only, the ring on X, one row with the lifetime. 9a. No pass card in the console.

## 7 · Open (the ledger, AY)

- A card arrives before its board scene ends (the rival's city still flying, the M€ counter not yet ticked) — the toast and the
  scene are separate traffic; an observation for the smoothness direction.
