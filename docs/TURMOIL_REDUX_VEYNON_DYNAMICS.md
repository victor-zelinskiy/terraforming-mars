# TR85 · Veynon Dynamics — восьмая, последняя новая корпорация Turmoil Redux (2026-10-27)

**Печать:** 36 M€ · 1 производство титана · 1 мех на карте; метки Юпитер + Венера; ▲ Колоний (`compatibility: 'colonies'`).
**ЭФФЕКТ:** «Торгуя с треком колонии, сначала можете поднять его на 1 шаг». **ДЕЙСТВИЕ:** «Добавьте 1 мех на ЛЮБУЮ карту
ИЛИ потратьте 1 мех с этой карты, чтобы бесплатно поторговать». Файл: `src/server/cards/turmoilRedux/VeynonDynamics.ts`,
спек `tests/cards/turmoilRedux/VeynonDynamics.spec.ts`, e2e `tests/e2e/console-veynon-dynamics.spec.ts` (фикстуры
`veynon` · `veynon-family` · `veynon-dock`).

**Ни одной новой механики.** Карта — две существующие формы и одна вещь класса.

## 1. Эффект = декларация Trade Envoys, даром

`behavior.colonies.tradeOffset: 1`. Executor прибавляет шаг к `player.colonies.tradeOffset` при розыгрыше (и снимает при
уходе карты); сериализация (`colonyTradeOffset`) и модель игрока — уже были. Каждая торговля с КОЛОНИЕЙ читает ОДИН план
`Colony.tradeTrackPlan` — превью (`buildColonyTradePreview`) и исполнение (`Colony.trade`) одним вызовом:

- колония, чьи клетки досягаемости платят ОДНО и то же (Луна) — трек поднимается без вопроса (больше того же);
- колония с разными наградами (Европа, Redux-Плутон/Венера) — вопрос `IncreaseColonyTrack` «поднять N … / не поднимать»
  (это и есть печатное «можете»), отказы колонии на нижних позициях — отключённые ступени с причиной;
- сдвиг ПУТИ (действие Союза, `bonusTradeOffset`) — одна сумма сервера со стоячим;
- причал (TR06 Water Hauling) — назначение без трека: сдвиг не применяется по построению («с треком колонии»);
- `selfishTrade` (Coordinated Raid) — без сдвига.

Консоль ничего не строила: сцена колонии читает `thisPlayer.colonyTradeOffset` (один экземпляр `ConsoleColoniesSection`
и в «Колониях», и встроенным шагом «Действий карт») и печатает «Ваша торговля сначала продвинет трек +1»
(`[data-colony-track-offset]`) ДО нажатия; ADVANCE-глайд маркера до дохода — общий модуль торговли.
**Единственная правка класса:** `effectSummary.ts` `COLONY_TRADE_OFFSET_CARDS` — жёсткий список носителей
«предторговой заметки» «Эффектов» → `+ VEYNON_DYNAMICS`. Подпись эффекта — существующий ключ Trade Envoys
«You may raise the colony track before trading».

## 2. Действие = форма TR66, ветка A — под-behavior как значение

Бесподобное действие корпорации: `CorporationCard implements IActionCard` (у `ActiveCorporationCard` `canAct` бросает без
стансы `action`, а торговля — не behavior).

- **A «мех на ЛЮБУЮ карту»** — бесплатная: `VEYNON_MECH_TO_ANY_CARD: Behavior = {addResourcesToAnyCard: {type: MECH, count: 1}}`.
  Превью — ходоки `effectsForBehavior` / `stepsForBehavior` над этим ЗНАЧЕНИЕМ, исполнение — `getBehaviorExecutor().execute(…)`
  (форма `CorporationCard.initialAction`). Пик всегда спрашивается (`autoSelect: false`); Veynon сама среди кандидатов,
  поэтому A всегда жива, а единственный кандидат — ПОКАЗАН (композер сеет его «единственная цель», T14), не применён молча.
- **B «1 мех отсюда → бесплатная торговля»** — вторая дверь торговли (`docs/COLONY_TRADE_FLOW.md` § THE SECOND DOOR):
  ветка объявляет `colonyTradeStep(this)`, клиент ничего не отправляет до подтверждения самой торговли, плата прибита к пути
  карты по `OptionMetadata.card` (у корпорации — так же, как у проектной карты: клиент не знает вид источника).
- Порядок веток — печатный (A, затем B); одна живая ветка = всё действие; две — `OrOptions` с `effectChoice`.
- `resourceRole: {kind: 'trade', price: 1}` — мех ЗДЕСЬ покупает торговлю; не платёжная единица (`mechs` читает только
  EVA Mechs), не ПО.

## 3. Вещь класса: ОДНА дверь «потратьте 1 <ресурс> отсюда — торгуйте бесплатно»

Три карты печатают её слово в слово: TFLP (C44, аэростат), TR66 (мех), TR85 (мех). Вместо третьей копии трейдера —
`src/server/colonies/cardTradeDoor.ts`:

- `CardResourceTrader(player, spec)` — `IColonyTrader` пути (`canUse` · `optionText` · `optionMetadata` с `card` · `disabledReason`
  именем · `trade`); `CardTradeDoorSpec` — карта, иконка, цена, ключи строки оплаты и журнала, причина «нет ресурса»,
  способ списания (`recorded` — через `removeResourceFrom`; `field` — прямое уменьшение, которое апстримный TFLP делал всегда:
  дверь объединена, журнал карты не перекроен);
- `cardTradeDoorReason(player, card, spec)` — ОДИН блокер варианта: ресурс на карте, потом `tradeBlockedReason()`;
- `cardTradeDoorOption(player, trader, title, label)` — опция действия: `tradeDestinationPick` (колонии + причалы) →
  `tradeThrough`.

`TradeWithTitanFloatingLaunchPad` / `TradeWithAutomatedConvoys` / `TradeWithVeynonDynamics` — экземпляры модуля (их классы
остались — на них ссылаются спеки), все три стоят в `Colonies.tradeHandlers()`. Превью ветки остаётся в файле каждой карты
(инвариант 8): `cardCost(card, price)` + `colonyTradeStep(card)`.

## 4. Восьмой держатель мехов

Строка таблицы `docs/TURMOIL_REDUX_EVA_MECHS.md` §8: роль `trade` объявлена (`price: 1`); рядом с TR66 — ОДНА группа
`mech:trade` с двумя лицами в спутнике ДОП. РЕСУРСЫ (`holderRoles.spec` § EIGHT); шаг цели «мех на ЛЮБУЮ карту» —
над ВОСЕМЬЮ кандидатами (e2e D: каждый кандидат целиком в своих клип-боксах, у каждого метка исхода).

## 5. Что наследует следующая карта

- **с дверью «ресурс отсюда → бесплатная торговля»** — строка `CardTradeDoorSpec` + экземпляр трейдера в `tradeHandlers`;
  превью — `cardCost` + `colonyTradeStep`; ничего на клиенте.
- **с `colonies.tradeOffset`** — декларация + строка в `COLONY_TRADE_OFFSET_CARDS` (`effectSummary.ts`).
- **корпорация с бесподобным действием из behavior-ветки и бесподобной** — `CorporationCard implements IActionCard`,
  ветка-behavior исполняется Executor-ом как значение, превью — ходоками над ним.

## 6. Гочи

- Раздача корпораций проверяется по ПУЛУ (`GameCards.getCorporationCards()`), не по `drawPile`: каждая новая корпорация
  перетасовывает колоду (Lotus Innovations покраснела на TR85 — переведена на пул).
- `actionPreviewReasonCoverage` спрашивает превью карты, не лежащей на столе: ветка A там «мертва» и требует причину
  («No card can hold this resource») — недостижимую в игре.
