# Добавление резолюции Turmoil Redux — чеклист автора

Пошаговая процедура и КОНТРАКТ (план `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` §4–§5, реализация —
`docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` Э2). Образцы: **RX01 Aquifer Contest** (шаблон семейства: выплата
на карту через общий пикер + океан победителя), **RX02 Architecture Award** (счётный член по картам +
влияние, cap), **RX03 Biodome Contest** (ресурс в склад по влиянию + озеленение победителя), **RX04 Central
Power Grid** (счётный член по МЕТКАМ), **RX05 Climate Research** (последовательная часть: вторая половина
читает итог первой; добор через общий интейк).

Короткая форма лежит в `.claude/rules/game-logic.md` и загружается сама, когда трогаешь
`src/server/parliament/resolutions/**`. Гард контракта — `tests/parliament/ResolutionContract.spec.ts`:
он перечисляет `REDUX_RESOLUTION_CATALOG` сам и падает с именем карты, шага и условия. **Гард — это
worklist:** сначала пиши карту, потом читай, что он назвал.

---

## 0. До кода

- [ ] Правило карты в `docs/TURMOIL_REDUX_SPEC.md` §4.1 (каталог 48 резолюций, механизм/статус) и печатный
  код `RX##` (уникален, по руке).
- [ ] Каждая ВЫПЛАТА карты — один из видов таблицы адресов `src/common/parliament/rewardAddress.ts`
  (`production` · `stock` · `cardResource` · `cards` · `ocean` · `greenery` · `skipped`; `reaction` пишет
  движок). **Нет вида — сначала строка в таблице** (см. §4 ниже), потом карта. «TODO: добавить kind
  позже» не бывает: `REWARD_ADDRESS` — `Record` по всему union, без строки не соберётся.
- [ ] Если механизм новый (потеря ресурсов, шаг Повестки каждому, треки колоний, TR, доступ к партии):
  это новый `kind` + адрес + чип/единица + причина пропуска + спек адреса — ДО первой такой карты.
- [ ] Если карта меняет МИР, а не платит местам (глобальный параметр), это `worldMoves` + `worldSteps` +
  `text.world` — три слоя вместе, см. § МИРОВОЙ ШАГ ниже.

## 1. Файл карты (`src/server/parliament/resolutions/<party>/<Name>.ts`) — что ОБЯЗАН объявить

1. `id` (`RDX_<PARTY>_<NAME>`, постоянный навсегда), `code` (`RX##`), `module: 'turmoilRedux'`, `party`,
   `copies` (физических копий в колоде), `compatibility?`, `renderData` (DSL `CardRenderer.builder`),
   `text` (`name`, `effect?`, `winner?`, `passive?`, `action?`, `quest`) — английские ключи локали, `quest`.
2. `scaled: InfluenceScaledEffect[]` — КАЖДАЯ часть, чья величина зависит от влияния / счёта / итога
   (`unit ∈ {production, stock, cardResource, cards}`; `count` — по образцу RX02/RX04, `sequel` — по RX05,
   `cap` — «max N»; **`cardResource` с `spread: true`** — РАСПРЕДЕЛЕНИЕ по образцу RX06: игрок сам раскладывает
   N единиц по своим держателям). Из этой декларации клиент строит лицо, прогноз голосования, чтение стадии
   НАГРАДА, плиту пропуска и семейство сценариев «Полигона» (`familyOf(definition)`) — автору рисовать нечего.
3. `winnerReward?` — часть победителя как ДАННЫЕ (`winnerReward.ts`: какой тайл, какой параметр двигает).
4. `immediateSteps` / `winnerSteps` — шаги. КАЖДЫЙ шаг **либо мутирует, либо спрашивает** (`EnactStep`:
   вернул `undefined` — всё сделал; вернул промпт — ничего не менял, изменит ответ). В ЛЮБОЙ ветке — включая
   «ничего не сделал» — шаг вызывает `ctx.report(outcome)` **ровно один раз** с `kind` из таблицы адресов;
   у пропуска — `reason` (английский ключ, переведённый в `ru/parliament.json`) и, если честно известна,
   величина, которая была бы выплачена (`amount`). Один шаг = одна запись: две выплаты — два шага.
5. Каждый промпт шага несёт СТРУКТУРНЫЙ маркер источника: `markChoiceContext({source: {kind: 'resolution',
   resolution: ID}})` для выбора, `placementContext` через `committedPlacement(…, SOURCE)` для тайла,
   `ExternalDrawIntake.open / takePromptFor` с `cause.kind === 'resolution'` для добора. Заголовок промпта —
   только текст для журнала; детекция где угодно — только по маркеру.
6. Резюмируемость: то, что шаг решил ДО вопроса (сколько должен, id интейка), хранится в `ctx.state` — повторный
   `run()` после reload не считает заново и не тянет заново (образцы `ANIMALS_OWED_KEY`, `INTAKE_KEY`).
7. `passive?` — с обязательным `forecast` (закон честности прогноза); `action?` — с `preview`. **Живой пассив
   обязан объявить** (RX10): графику эффекта в `renderData` (`b.effect(...)` — одна отрисовка на лицо, список
   эффектов и осмотр), `text.passive` (строка в списке эффектов Информации и стадия НАГРАДА), `forecast`
   (прогноз розыгрыша), для тайлового хука — `placementFacts` (досье клетки: обещание = выплата) и мутации ТОЛЬКО
   под источником резолюции (`withEffectSource` даёт маркер `effect-triggered` → карточка закона в нотификации
   с осмотром резолюции). Гард: «a tile passive without its dossier twin». **Пассив-СКИДКА** (RX14) — хук
   `cardDiscount(player, card)` в разборе цены (`getCardCostBreakdown` → `ParliamentHandler.cardDiscount`),
   источник-резолюция в `discounts` (никогда в остаток), отрисовка источника у всех потребителей разбора,
   `forecast` — двойник скидки есть сам разбор (факта не давать).
   **ПЛАТА** (RX15, семейство БЮДЖЕТ) — `levy: {resource, amount, recipient: 'each'}` + общий шаг `levyStep(id, levy)`
   ПЕРВЫМ в `immediateSteps`; `from: {resolution}` обязателен; частичная уплата и пустой запас названы (раздел RX15 ниже).
8. Ни слова о партиях: реакция правящей партии (Зелёные и т.д.) — данные `PartyEffectDefinition.reactions`,
   запись `kind:'reaction'` делает драйвер фазы из событий рекордера (Э1). Карта платит через `stock.add` /
   `production.add` с `from: {resolution: ID}` — этого достаточно.

## 2. Регистрация

- [ ] Строка в `REDUX_RESOLUTION_CATALOG` (`ResolutionCatalog.ts`). Больше ни один switch не трогается.
- [ ] `npm run make:cards` — манифест клиента (`genfiles/parliament.json`: `scaled`, `winnerReward`, тексты).
- [ ] Локаль: все `text.*`, все `reason` пропусков, все заголовки промптов — ключи в `src/locales/ru/parliament.json`
  (`npm run make:json` бросит на дубликате). Канон: TR → РТ, VP → ПО, tag → метка.

## 3. Что резолюция получает БЕСПЛАТНО (и потому не должна делать сама)

Премиальное лицо · чтение в режиме голосования («одна цифра» + «+N при победе») · fullscreen-осмотр · беты
заседания (вердикт / принятие / обновление не зависят от карты) · **адрес и моушен награды по `kind`** · плиту
пропуска с причиной · строку ожидания для других мест · запись протокола в журнале (одна группа на заседание)
· стенд «Полигон» (семейство сценариев по декларации) · гард-тесты · фикстуры e2e через
`parliamentFixture({resolution, stopAt: 'vote' | 'assembly' | 'effects' | 'adjourn' | 'done', options?})`
· **раскладку ресурса по картам** (RX06): шаг `AddResourcesToCards` сам решает форму вопроса — выбор одной карты
(`N = 1` или держатель один; `autoSelect: false` — показывается всегда) или РАСПРЕДЕЛЕНИЕ (структурный маркер
`cardResourceDistributionPrompt`, сумма ровно N, `InputError` на любую другую, применение после проверки), а
консоль показывает его тем же выбором карт в режиме раскладки (счётчики, остаток, LB/RB/RT, ноль на старте,
неполная отправка невозможна на четырёх уровнях), летит по одному чипу на карту и пишет список в итоги.

### Распределение по картам — строка семейства (RX06, 2026-09-22)

```ts
scaled: [{id: 'floaters', unit: {kind: 'cardResource', resource: CardResource.FLOATER, spread: true},
  perInfluence: 1, count: {id: 'venusJovianTags', per: 1}, recipient: 'each'}],
// шаг:
return new AddResourcesToCards(player, CardResource.FLOATER, owed, {autoSelect: false, cause: SOURCE, from: {resolution: ID},
  pickTitle: message('Add ${0} floater(s) to one of your cards', …), distributeTitle: message('Place ${0} floater(s) on your cards', …)})
  .andThen((placed) => { ctx.report({kind: 'cardResource', resource, amount: owed, cards: placed.map(…), ...(placed.length === 1 ? {card} : {})}); return undefined; })
  .execute();
```

- Запись — ВСЁ ТОТ ЖЕ `kind: 'cardResource'`, расширенный `cards: [{card, amount}]` (список из одной несёт и
  `card`); нового вида исхода нет. Счёт над несколькими метками — `resolutionCountKind = {kind: 'tags', tags: [...]}`
  с разбивкой `byTag` → `countedByTag` в записи (чтение печатает вход по каждой метке).
- «Полигон» открывает семейство `distributed` по `spread: true` (`spreadEffectOf`); сценарии — держатели,
  считающиеся-не-держащие, обе метки на одной карте, нет держателя (названо с величиной). Живой сценарий
  открывает настоящую раскладку — на стенде второй реализации нет.
- Две единицы разом (Greens Budget: животные и микробы) — два шага с двумя единицами, а не новая модель.
- Зависимость от дополнения — `compatibility: ['venus']`, больше ничего: колода, пул в спеках
  (`compatibleWith(game.gameOptions.expansions)`) и лицо (медальон рядом со штампом модуля) читают декларацию.

### Бонусы колоний — план шагов на игрока, реестр, шаг СБРОС (RX07, 2026-09-23)

```ts
scaled: [{id: 'colonyBonuses', unit: {kind: 'colonyBonuses'}, base: 2, perInfluence: 1, influenceStep: 2, recipient: 'each'}],
immediateStepsFor: colonyBonusSteps,   // (player, parliament, game) → шаги по СТОЛУ колоний; ключи `colony:<tile>[:<n>:draw|discard|reveal]`
// каждая запись шага: {..., effect, influence, multiplier: k, colony}
```

- **План шагов на игрока** — `IResolution.immediateStepsFor?(player, parliament, game)` рядом со статическим
  `immediateSteps`; `immediateStepsOf` — один читатель обоих (драйвер, гард, экспорт). Ключи стабильны через reload.
- **Шаг влияния** — `InfluenceScaledEffect.influenceStep` (`perInfluence × ⌊I / step⌋`); множительная единица
  `{kind: 'colonyBonuses'}` — гард формулы сверяет `multiplier` записи.
- **Закон объединения** — запас/производство ×k = одна запись; ресурс на карту = ОДНА раскладка k
  (`AddResourcesToCards`, `autoSelect: false`); добор = ОДИН приём k; Плутон = k ПАР «взять → сбросить», никогда не
  объединять (следующая карта не видна до сброса). Бонус колонии = ТРЕТЬЯ строка тайла (`metadata.colony`), не доход
  торговли: у Миранды это «взять 1 карту».
- **Виды** `discard` (адрес `hand-dock` / `hand` / `discard` / `colony-ledger`) и `colonyBonus` (`hud`, описание
  тайла; потеря — отрицательная сумма, пропуск только при 0). Источник полёта **`colony-row`**
  (`rewardFlightSourceOf`): запись с `colony` рождается на строке реестра, адрес не меняется.
- **Маркер сброса** — `discardPrompt {source: resolution, colonyRepeat: {colonyName, index, total}}`; **никогда
  `colonyBonus`** (он маршрутизирует шаг рабочего пространства КОЛОНИЙ).
- **Реестр** — сервер шлёт `ParliamentPlayerModel.colonyBonuses: [{colony, grant, description}]`; клиент читает
  `colonyLedgerOf` (чистый `common/parliament/colonyLedger.ts` + `colonyLedgerModel.ts`), рисует
  `ConsoleColonyLedger` на панели голосования, в осмотре, в стадии (герой-размер) и на стенде; итоги группируют по
  тайлу. Семейство стенда `colony-bonuses` (`colonyBonusesEffectOf`).
- **Стадия** — реестр = тело страницы НАГРАДА (`sittingFieldOf`: поза до волны, дверь шага после), волны по строкам
  (`beatReward` → `ledgerRowGroups`), сброс = встроенный шаг `'discard'` (`sittingAskOf` по маркеру,
  `sittingStageKey → 'Discarding'` «СБРОС», `RESOLUTION_STEP_STAGES.handSelect`; секция публикует слот фрейма
  парламента вместе с дверью). Док: `docs/TURMOIL_REDUX_COLONIAL_AFFAIRS.md` §3–5.

### Счётный член по ПОЛЮ — когда счёт считает не табло, а доску (RX08, 2026-09-23)

```ts
scaled: [{id: 'production', unit: {kind: 'production', resource: MEGACREDITS}, perInfluence: 1,
  count: {id: 'spaceCities', per: 2}, cap: 6, recipient: 'each'}],
// resolutionCountKind('spaceCities') === {kind: 'board', tiles: 'spaceCity'}
```

- **Вид `board`** в `resolutionCountKind` — третий рядом с `cards` и `tags`; что считается — слово из `BoardCountedTile`
  (`'spaceCity'`; следующее — `'marsCity'` для Migration Funding: одно слово, одна ветка в `spaceCountVerdict`, одна
  строка в `boardCountSpaces` сервера). Никакой особой ветки «для этой карты».
- **Число даёт ДВИЖОК**: `ResolutionCounts.resolutionCount` для `board` не ходит по табло — берёт клетки у
  канонического хелпера (`MarsBoard.getCitiesOffMars(player)` — им же живут награда Cosmic Settler и `behavior/Counter`).
  Предикат космического города в модуле резолюций не переписывается.
- **Объяснение числа — КЛЕТКИ в той же модели**: `ResolutionCountModel.spaces` (`cards` пуст), в записи и модели —
  `countedSpaces` (`SerializedEnactOutcome` / `ParliamentEnactOutcomeModel`), в чтении — `InfluenceYield.countedSpaces`
  (`YieldCount.spaces`, `fixedYield(..., {countedSpaces})`). Второго типа модели счёта нет.
- **Имя клетки — только из существующего слоя информации о доске** (`getSpecialCellInfo(id).title`: «Колония на
  Ганимеде», «Космопорт на Фобосе», «Стэнфордский тор», области Венеры). Клетку без имени никто не крестит:
  «Для вас» печатает ЧИСЛО (`${0} space city(-ies)`) и оставляет правило говорить (`countedCellNames` →
  `parliamentAnnotations`).
- **Глиф счётного объекта** — `CountedObjectGlyph {kind: 'tile', tile}`: `PremiumCountGlyph` рисует его ТЕМ ЖЕ ассетом,
  что печатает лицо для `b.city()`, и той же искрой `.pcard-sym--asterix` (`countedTileIconUrl`). Формула блока чтения
  печатает ДВЕ ставки, когда `count.per ≠ perInfluence` («2 [ед.] / [город*] + 1 [ед.] / [влияние]»).
- **Стенд**: общий предикат клетки `spaceCountVerdict` / `countSpacesToward` (`CountedSpaceFacts` — то, что делят
  серверный `Space` и синтетическая клетка) считает синтетические КЛЕТКИ семейства `counted-board`; паритет с движком
  закреплён спеком по корпусу досок (`ColonizationFunding.spec.ts` § PARITY), а не подразумевается.

### Часть победителя, исполняемая ЧУЖИМ экраном — колония как встроенный шаг заседания (RX09, 2026-09-23)

```ts
winnerReward: {kind: 'colony'},            // данные: объединение WinnerRewardDeclaration (тайл | колония)
winnerSteps: [COLONY_STEP],                // BuildColony без commit-замыкания + committedPlacement(reason, SOURCE)
ctx.report({kind: 'colony', colony: name}); // вид исхода colony: поверхность colonies, единица tile, чтение winner-reward
```

- **Объявление — член объединения, не флаг**: `winnerRewardParameter` отвечает `undefined`, комната/РТ типизированы по
  тайлу (`isWinnerTileReward`); чтение победителя без параметра говорит КТО строит, после записи — ГДЕ (`built`).
- **Шаг спрашивает СТАНДАРТНЫМ промптом движка** (`BuildColony` → `SelectColony`) с `placementContext.source =
  резолюция`; бонус постройки платит сам тайл (`Colony.addColony`), и его вопросы — вопросы ДВИЖКА без источника-резолюции
  (Титан: цель флоатеров; Европа: океан): фаза их ждёт (`drainDeferred`), карта их не переписывает.
- **Заседание признаёт шаг СТРУКТУРНО**: `sittingAskOf` по `wf.type` + источнику, `SITTING_HOSTED_STEPS` (дверь
  публикует слот Парламента), одно слово хвоста в ОБЕИХ таблицах (`sittingStageKey` и `RESOLUTION_STEP_STAGES`), строка
  `frameSteps` хозяина = `embed`. Экран-ФРЕЙМ переживает ответ сервера (кубик летит, бонус спрашивает) — термин `hosting`
  в `sittingFieldOf` + `stepFrameNested` в секции держат поле, дверь и страницу; хвост читает стадию вложенного фрейма.
- **Завершение — ветка хозяина**, не поп: `settleColonyFollowUp` снимает фрейм, Парламент ни сворачивается, ни
  заключается; уступка полю (Европа) закрывается на возврате стека (`resumeStackFromBoardAndSettle`).
- **Нейтральный победитель** — записи нет (у записи есть место), тишины нет: чтение победителя называет его на ленте,
  в fullscreen и на стенде. Гард контракта отвечает на `SelectColony`; стол колоний в гарде аранжируется.
  Док: `docs/TURMOIL_REDUX_COLONY_CONTEST.md`.

### Живой ПАССИВ — «бонусы размещения ×2» как повторная выдача (RX10, 2026-09-23)

```ts
passive: {
  onTilePlaced(player, space, placement) {             // placement.coveringExistingTile — что движок УЖЕ заплатил
    if (space.spaceType === SpaceType.COLONY) return;   // только Марс
    repeatPlacementBonuses(player, space, placement);   // grantSpaceBonuses · grantOceanAdjacencyBonus · Ares — второй раз
  },
  placementFacts(ctx) { /* те же факты досье (printed / ocean) ещё раз под именем резолюции */ },
  forecast(ctx) { /* deferred-факт без числа на каждый тайл на Марсе */ },
},
```

- **Удвоить = выдать второй раз теми же входами движка**: бонусы клетки платятся ДО хука
  (`Game.grantPlacementBonuses`: печатные → океанское соседство (`grantOceanAdjacencyBonus`, выделен) → Ares →
  `ParliamentHandler.onTilePlaced(player, space, {coveringExistingTile})`). Правила не переписываются: что бонус
  делает один раз, то делает и второй (карта — добор, ресурс на карту — вопрос холдеру, платный бонус — второе
  предложение; неоплатимый счёт пропускается ПО ИМЕНИ в момент исполнения — `SelectPaymentDeferred.skipIfUnaffordable`,
  общий страховочный шов и для Frontier Town / Jansson).
- **Видимость пассива — четыре обязательства**: графика чипа (`emptyTile* : adjacencyBonus ×2` — словарь игры);
  строка ЗАКОНА в списке эффектов Информации (`ConsolePartyEffectsStrip`: первая, кикер «Принятая резолюция»,
  золотой шов правительства); **эхо** `lastPlacementBonusEcho` (self-only, как `lastOceanBonus`) → вторая волна
  тех же иконок/той же воды после первой (`data-echo`, холд держит обе доли — счётчик тикает дважды); **карточка
  закона** в нотификации — ответ принятой резолюции на СОБСТВЕННОЕ действие зрителя не подавляется
  (`lawAnswerNotification`: чипы самого эффекта, `effectSource: {kind:'resolution'}`, hold X / CTA
  `inspect-resolution` → `inspectParliament`, второго осмотра нет).
- **Досье клетки честно** — `placementFacts` дублирует факты `printed-placement-bonus` / `ocean-adjacency-bonus`
  под именем резолюции (`BoardInformationEngine.resolutionPassiveFacts`, после партийных фактов);
  гард `placementReduxPreview.spec` § Development Craze: preview == commit.
- Бюджет: юниты карты (17) + гард; клиентские юниты строки и карточки; ОДИН e2e (`console-parliament-craze`):
  озеленение на клетке 2×сталь → эхо → карточка закона → осмотр. Док: `docs/TURMOIL_REDUX_DEVELOPMENT_CRAZE.md`.

### Закон, который ВВОДИТ БОНУС СОСЕДСТВА (RX11, 2026-09-23)

Если пассив добавляет правило, которого у движка нет, — найди его ТОЧНОГО РОДСТВЕННИКА и сделай
ДВОЙНИКА на каждом слое, никогда параллельную копию. Для «озеленения платят за стройку рядом»
родственник — ОКЕАНСКОЕ СОСЕДСТВО:

- **Правило — на ДОСКЕ, вплотную к родственнику** (`MarsBoard.greeneryAdjacencyBonus` рядом с
  `oceanAdjacencyBonus`, та же форма ответа), предикат клетки — КАНОНИЧЕСКИЙ (`Board.isGreenerySpace`),
  никогда не переписанный в карте. Ставка — константа КАРТЫ (`FORESTRY_SUPPORT_ADJACENCY`), а не атрибут
  игрока вроде `player.oceanBonus`.
- **Публикация — ЧЛЕН модели выплаты закона**, никогда второе поле игрока рядом:
  `PlacementLawPayoutModel {printed?, ocean?, greeneries?}` → `player.lastPlacementLawPayout` (self-only, чистится
  в `Player.process` как `lastOceanBonus`). Консоль играет ОДНУ дополнительную волну на размещение,
  каким бы ни был закон (`PlacementLawWave` → `runLawWave`: печатное · океан · рощи, по очереди).
- **Сцена — ТА ЖЕ хореография, палитра в CSS** (`adjacencyPayoutBeat.ts` — бывший `oceanAdjacencyBeat.ts`;
  модификатор `--grove`, прецедент `--ares`). Платящий объект КОНДЕНСИРУЕТ фишку внутри себя и
  отдаёт пиксельного двойника Resource Transfer Framework — летит и садится уже его фишка
  (`.con-transfer__chip`); проба судит о полёте ПО НЕЙ, не по монете.
- **Гейт тайлового пассива — свой**: `ResolutionPlacementContext.firesTilePassive` (тайл ложится И фаза не
  солнечная). На `grantsPlacementBonus` гейтить НЕЛЬЗЯ — оно истинно и при накрытии, а накрытие ПЛАТИТ
  (`coveringExistingTile` гейтит только ПЕЧАТНЫЕ бонусы — океанское соседство тоже платит).
- **Досье — ОДНА СТРОКА НА ПУЛ** с `spaces` (поле подсвечивает платящие клетки само). Арифметика —
  только на первой строке и только когда плательщиков больше одного. Ставка в предложении НАПЕЧАТАНА,
  а не интерполирована: это константа карты, а слот «${n} растения» со значением 1 по-русски не склоняется.
- Бюджет: юниты карты (17) + гард, клиентские юниты волны, ОДИН e2e (`console-parliament-forestry`).
  Док: `docs/TURMOIL_REDUX_FORESTRY_SUPPORT.md`.

### МИРОВОЙ ШАГ · ПОНИЖЕНИЕ ПАРАМЕТРА · ТЕРРАФОРМИРОВАНИЕ БЕЗ РТ (RX12, 2026-09-24)

```ts
worldMoves: [{parameter: 'oxygen', steps: -1, terraformRating: false},
             {parameter: 'venus', steps: 2, terraformRating: false}],
worldSteps: [OXYGEN_STEP, VENUS_STEP],   // один раз за принятие, ключ в `applied`
text: {..., world: 'Oxygen is reduced 1 step unless …'},   // свой блок инспектора
ctx.report({kind: 'globalParameter', amount: room.applied, parameter: {id, before, after}, unrewarded: true});
```

- **МИРОВОЙ ШАГ — у него НЕТ МЕСТА.** `worldSteps` исполняются ОДИН раз за принятие (ключ
  `world:<поколение>:<инстанс>:<шаг>` в `applied`, не в `seatApplied`), после собственной части ВСЕХ мест.
  Область события открывается БЕЗ игрока, источник — резолюция без `owner`, запись — без `player` и с
  `part: 'world'`. Игрок-ручка даётся только движковому API (прецедент ВПМ / `SnowCover`) и не получает
  ничего: гонять мировой эффект per-seat — значит понизить кислород по разу на игрока. Инлайн-обход
  победителя сохранён; его откладывает за мир ТОЛЬКО карта, объявившая `worldSteps` (тайл победителя
  должен лечь в мир, который закон уже сделал). Объявление — на ТРЁХ слоях или ни на одном:
  `worldMoves` (данные) + `worldSteps` (выплата) + `text.world` (предложение); гард ловит любые два из трёх.
- **ПРЕДЕЛ ПАРАМЕТРА НАЗЫВАЕТСЯ ВСЛУХ.** Общая `parameterRoom` (`common/parliament/parameterMove.ts` —
  ОДНА арифметика «текущее → результат» для тайла победителя и для мирового хода; `winnerParameterRoom`
  ей делегирует) отвечает, сколько шагов реально произойдёт. **Пункт КАРТЫ проверяется ПЕРВЫМ, предел
  арифметики вторым**: «если кислород не на максимуме» — правило резолюции, а не потолок (снизу места
  сколько угодно). Молчаливый ранний выход движка НИКОГДА не механизм: каждый непроизошедший ход — запись
  `skipped` с переведённой причиной и журнальная строка.
- **ПОНИЖЕНИЕ — ПОЛНОЦЕННОЕ СОБЫТИЕ.** `recordGlobalParameterChange(player | undefined, parameter, steps)`
  принимает ЗНАК и необязательного автора (`undefined` = закон). Добавляя карту, которая двигает параметр
  вниз, пройди ПОТРЕБИТЕЛЕЙ на знак: `aggregate.accumulateImpact` (net, не «подъём»), `endgameFacts`
  (факт «кто терраформировал» не строится из неположительной суммы), статистика стандартных проектов,
  чипы журнала. Событие аналитическое (тег `global-parameter`), поэтому голый `game.log` карты с ним не
  задваивается.
- **БЕЗ РТ = ПАРИТЕТ С ВПМ** (`IGame.ParameterMoveOptions {unrewarded: true}`, решение D1): ни РТ, ни
  бонусов трека ВНУТРИ солнечного гейта, порог помечен нейтрально — и всё, что ВПМ платит СНАРУЖИ гейта
  (океан на 0 °C, Aphrodite), платится тоже. Политическая фаза — `PARLIAMENT`, поэтому без явного флага
  РТ уходит игроку-ручке. Это ТРАКТОВКА, и разворот к буквальному чтению стоит одного гейта и одного спека.
- **ПОКАЗ — МИРОВОЙ БЕТ**: мир меняется на мире. `parliamentWorldBeat.ts`: OWE (мировая запись, у КАЖДОГО
  зрителя) → YIELD (`yieldStackToBoard` — дверь тайла победителя, но БЕЗ нажатия: нажимать не за что) →
  STORY (парк полевых бетов — единственный презентер закона о шкалах; понижение приходит обычным тоном
  ПОТЕРИ, без празднования и без вспышки порога) → RETURN (тот же уровень, страница НАГРАДЫ читает строку
  планеты). Ожидание ограничено и названо; бет не повторяется.
- **СЛОВА**: осмотр печатает `text.world` + серверные числа, «кто получает РТ» — РОВНО ОДИН раз
  (`worldMoveSentenceOf(..., {credit: false})`, когда предложение закона уже сказало это); лента — член
  `world`; итоги — строка ПЛАНЕТА (по закону панели: только шаг и то, чего шкалы сказать не могут); стенд —
  семейство `world-move` (сценарии = пределы параметров). Док: `docs/TURMOIL_REDUX_GAS_EXPORT.md`.

### Счётный член по ПОКАЗАТЕЛЮ игрока (порог + шаг) — объяснение разбором величины, не списком (RX13, 2026-09-24)

```ts
scaled: [{id: 'megacredits', unit: {kind: 'stock', resource: MEGACREDITS}, perInfluence: 2,
  count: {id: 'terraformRatingSets', per: 2}, recipient: 'each'}],          // потолка нет — `cap` не объявляется
// resolutionCountKind('terraformRatingSets') === {kind: 'threshold', metric: 'terraformRating', over: 15, step: 5}
```

- **Вид `threshold`** в `resolutionCountKind` — четвёртый рядом с `cards` / `tags` / `board`: число = полные шаги
  `step` одного показателя игрока над `over` (`thresholdSets` = `⌊max(0, value − over) / step⌋`) — **ОДНА функция**
  для сервера, чтения и стенда. Что читается — слово из `ResolutionCountMetric` (`'terraformRating'`; следующее —
  шаги производства для Бюджетов: одно слово, одна строка в `ResolutionCounts.metricValue`). Значение — у движка
  (`player.terraformRating`), никогда из слагаемых; порог — константа карты, не стартовый РТ варианта.
- **Объяснение числа — РАЗБОР ВЕЛИЧИНЫ в той же модели**: `ResolutionCountModel.metric` (`value · over · step · sets ·
  toNext`), в записи и модели — `countedMetric`, в чтении — `InfluenceYield.countedMetric`. Списки (`cards`, `spaces`)
  у этого вида пусты; второго типа модели нет. «Для вас» печатает разбор («РТ 24 · порог 15 · 1 полный набор · до
  следующего 1»), ноль наборов — тоже разбор, никогда «ни одной карты».
- **Глиф** — `CountedObjectGlyph {kind: 'metric', metric}`: значок РТ лица (`b.tr()`), без искры и без числа внутри.
  Чтение: «[РТ] 24 → 1 набор + [влияние] 3 → +8 M€» (`data-yield-in="metric"` / `"count"`).
- **Честный прогноз**: шаг Повестки победителя бывает шагом РТ, а рейтинг растёт ДО чтения эффекта
  (`ChairmanSeat.advanceAgenda`) — `winnerForecastCount` считает прогноз счёта по РТ от `значение + 1` той же функцией.
  Иначе панель обещает +8, а сервер платит +10.
- **Стенд** — семейство `counted-metric`: место держит синтетический РТ (`PgSeat.tr`), число считает
  `countMetricToward`; лестница границ наборов + разбор словами.
- Спек-ловушка: фаза производства платит РТ монетами ДО заседания — деньги сверять с `before / after` записи, а не с
  абсолютом. Бот: `terraformRating` у автома-игрока read-only — задавать его не надо, он и так не в парламенте.
  Док: `docs/TURMOIL_REDUX_GENEROUS_FUNDING.md`.

### Пассив-СКИДКА — закон, который вмешивается в ЭКОНОМИКУ карт (RX14, 2026-09-24)

```ts
passive: {
  cardDiscount: (player, card) => card.tags.includes(Tag.BUILDING) ? 3 : 0,   // ОДНА функция: цена, разбор, прогноз
  forecast: () => [],   // двойник скидки — сам разбор (`discountsOf` читает `getCardCostBreakdown`); факт = те же 3 M€ второй раз
},
worldMoves: [{parameter: 'temperature', steps: -2, terraformRating: false}],   // мировой шаг = RX12 дословно, другой параметр
```

- **Скидка живёт в ОДНОЙ функции цены** — `Player.getCardCostBreakdown` (цена И её объяснение): хук пассива
  спрашивается там через `ParliamentHandler.cardDiscount` (чистый ЗАПРОС без области события — в отличие от
  `enactedPassive`; `discount-applied` пишет сама функция цены при оплате) только у участника, держащего закон, и
  ложится в `discounts` с `{kind: 'resolution', id, owner}`. В остаток (`other`) — НИКОГДА: игрок увидит, что цена
  упала, и не узнает почему. Пол цены — общий `Math.max(cost, 0)`; номинал остаётся в разборе. Ни поля скидки у
  игрока, ни второго пути расчёта.
- **Отрисовка источника-резолюции у потребителей разбора** — пройти каждого: плитка скидки слоя «Эффекты» брала
  имя только у карты/корпорации и печатала политический источник как «Прочие скидки» → `forecastItemPoliticalSource`
  (чистая модель) + имя через манифест, эмблема партии; журнал уже знал (`sourceToChild` → `resolutionName`);
  панель оплаты читает `discountTail` (итемизация по замыслу в R3); нотификации скидок не показывают по замыслу.
- **`forecast` у скидки — пустой по построению, не по забывчивости**: закон паритета «факт ↔ `effect-triggered`»
  (`effectForecastParity.spec`) у скидки пары не имеет; её двойник — `discountsOf`, который читает тот же разбор в
  тот же момент. Спек закрепляет: `forecast.discounts` = разбор = оплата, фактов резолюции нет, на карте без метки
  строки нет.
- **Мировой шаг с другим параметром — без нового кода**: `parameterRoom`, рекордер понижения, бет, чтения, иконки,
  строка ПЛАНЕТА уже параметр-агностичны. Зашитым под RX12 оказался только стенд: сценарий предела семейства
  `world-move` объявляет `parameter` и показывается лишь закону, который его двигает.
- Бюджет: юниты карты (32) + гард; клиентские юниты (модель +3, монтируемый эксплорер 3, журнал +1); ОДИН e2e
  (`console-parliament-heat`: такт RX12 с температурой → строка закона → шапка оплаты «10 → 7 · −3» → плитка
  скидки с именем закона). Ловушка генератора фикстур: фильтр `FIXTURES` действует только на ЗАПИСЬ — каждая
  фикстура всё равно строится, и аранжировка, предполагающая посев («ожидаю карту Зелёных на столе»), падает с
  ростом каталога: сажать нужную партию через `seatResolution`, не ждать её от посева. Док:
  `docs/TURMOIL_REDUX_HEAT_CAPTURE.md`.

### ПЛАТА — семейство БЮДЖЕТ: объявление величины + общий шаг; счёт по ШАГАМ ПРОИЗВОДСТВА (RX15, 2026-09-24)

```ts
levy: {resource: Resource.MEGACREDITS, amount: 10, recipient: 'each'},          // объявление — `common/parliament/resolutionLevy.ts`
scaled: [{id: 'megacredits', unit: {kind: 'stock', resource: MEGACREDITS}, perInfluence: 1, count: {id: 'steelTitaniumEnergyProduction', per: 1}, recipient: 'each'},
         {id: 'production', unit: {kind: 'production', resource: MEGACREDITS}, base: 4, perInfluence: 0, recipient: 'each'}],   // плоская часть
immediateSteps: [levyStep(ID, LEVY), MEGACREDITS_STEP, PRODUCTION_STEP],         // печатный порядок = исполняемый: плата ПЕРВОЙ
// resolutionCountKind('steelTitaniumEnergyProduction') === {kind: 'production', resources: [STEEL, TITANIUM, ENERGY]}
```

- **ПЛАТА — объявление величины + общий шаг, `from: {resolution}` обязателен, частичная уплата названа.** Отрицательную
  выдачу в `InfluenceScaledEffect` НЕ втискивать: `scaledAmount` и все чтения построены вокруг «сколько получено», а
  `skipped` при `amount ≤ 0` превратил бы плату в «ничего не произошло». Плата — свой член `ResolutionDefinition.levy`
  и ОДИН исполнитель `levyStep` (`ResolutionLevy.ts`): взятие ограничено запасом (`levyPaid`, никогда ниже нуля),
  списание `stock.add(res, −paid, {from: {resolution}})` — без `from` движок пишет `logIllegalState`; недобор — запись
  `stock` с отрицательным `amount`, `owed` и причиной НА платящей записи (не пропуск); пустой запас — названный
  `skipped` с `owed`; оба всё равно получают выплату и производство — платёжеспособности карта не требует. Гард: плата
  ↔ шаг объявлены вместе, шаг платы ПЕРВЫЙ, `checkLevy` сверяет `owed`, знак и `before − after`.
- **Знак читает адрес, вида `stockLoss` нет**: `rewardAddressOf` — ноль есть пропуск, минус есть ПОТЕРЯ
  (`RewardDelivery.direction: 'loss'`); `waveSpecOf` летит тем же рядом с `direction: 'loss'`. Физика — тот же конвейер
  наоборот (`ResourceTransferSpec.direction`): чип рождается на строке рельсы, летит на ОТРИЦАТЕЛЬНУЮ плитку закона
  (`resolveGainIconOrigins` выбирает тайл M€ по знаку), холд потерь отдельной картой (`stockLoss`), отрыв фиксируется на
  старте (`launched`), прилёт — на посадке. В директоре плата летит ПЕРВОЙ, пауза дыхания, затем выдачи по одной.
- **Счёт по шагам производства — двойник вида `tags` с разбивкой по ресурсам**: `ResolutionCountModel.byResource`,
  в записи и чтении `countedByResource`, значения у `player.production` (никогда из карт; пола не изобретать —
  движок сам держит сталь/титан/энергию ≥ 0, спек это закрепляет), стенд считает синтетический трек той же
  `countProductionToward`; глиф `{kind: 'production', resources}` — производственная плашка с иконками через «+».
- **Чтения — НЕТТО и два горизонта**: плата во главе плиты выплаты той же валюты, нетто в хвосте («−10 → … → +7 = −3»,
  `levyNetEffectOf`); модель платы на три момента (`voteLevyOf` — по `ParliamentPlayerModel.stock`, `resolvingLevyOf`,
  `enactedLevyOf` — по записи); нехватка — «−4 из 10» + нота панели (`levyShortNoteKey`); производство рядом с платой
  несёт горизонт («платит со следующего поколения» — заседание идёт ПОСЛЕ фазы производства); плоская часть
  (`yieldIsFlat`) печатает базу без кластера входов. Итоги: подписанные части, `owed`, нота недобора, строка нетто.
- **Очерёдность поколения** (три утверждения спека): плата берётся из денег, УЖЕ включающих доход; +4 производства
  впервые платят в следующем поколении; счёт от момента не зависит (фаза производства двигает запасы, не трек).
- Следующий бюджет объявляет только суммы и список: `levy.amount` и `count` (по меткам — вид `tags`), шагов не пишет.
  Док: `docs/TURMOIL_REDUX_INDUSTRIALIST_BUDGET.md`.

### Бюджет проверки на карту (решение владельца 2026-09-23)

Состав проверки определяется ОДНИМ вопросом: **что в карте ново?**

- Нет новой механики (только новая формула из существующих членов) → нового e2e НЕТ вовсе: юниты карты + гард
  контракта; общие модели защищены юнитами уже выданных карт (RX02 / RX04 / RX06 / RX07), они дешевле и ловят ту же
  поломку.
- Есть ровно одна новая механика → РОВНО ОДИН новый e2e на карту, покрывающий именно её, на одном профиле
  (три профиля и Deck — только если у карты своя геометрия; у выплаты штатной волной её нет).
- Старые сюиты e2e, галерею и стенд не гонять «для спокойствия». Фикстуры править точечно
  (`FIXTURES=… npm run e2e:fixtures`), тяжёлую новую не городить.
- Визуальная приёмка — несколько кадров НОВОГО на одном профиле в отчёт.

## 4. Таблица адресов (`src/common/parliament/rewardAddress.ts`) — правило добавления вида

Строка есть у КАЖДОГО значения union `kind`; клиентский директор знает адреса, не резолюции. Новый механизм
входит в таблицу ДО первой резолюции, которая его платит:

1. `ParliamentEnactOutcomeModel.kind` (+ `SerializedEnactOutcome.kind`) += `'<kind>'` и поля записи.
2. `REWARD_ADDRESS['<kind>']` — `surface` (где видит) · `source` (откуда летит) · `unit` · `stage` · `reading` ·
   `skipTitle` (ключ, переведён).
3. `tests/parliament/rewardAddress.spec.ts` — ожидания по новой строке; потребители union (`outcomeText`,
   подачи) — исчерпывающие `switch`, компилятор сам покажет места.
4. Ожидаемые будущие виды — **эскизы адресов** лежат в самом `rewardAddress.ts` («FUTURE KINDS — how to add one»,
   финальная полировка D.3): `stockLoss` (волна ОБРАТНО в источник, минус в чтении, счётчик рельсы тикает вниз),
   `agendaStepAll` (все маркеры Повестки
   разом), `colonyTrack` (чип колонии + шаг, экран колоний не открывается), `colonyToWinner` (стадия `choice`,
   общий пикер колонии в зоне стадии), `cityEveryone` (стадия `board` по креслам ПО ОЧЕРЕДИ — маршрут тайла
   победителя, обобщённый на всех), `drawUpTo` (стадия `take`, число из ЗАПИСИ, полная рука — плита пропуска).
   Строки не добавлены нарочно: адрес без плательщика — обещание, которое никто не держит; первая карта вида
   добавляет строку вместе с плательщиком по эскизу, не проектируя подачу с нуля. (`globalParameter` СДАН по
   своему эскизу — RX12 Gas Export: стадия `board`, чтение `world-parameter`, источник `card-icon`.)
5. Резолюция БЕЗ немедленных шагов (пассив, действие) не оставляет стадию НАГРАДА пустой: стадия читает
   `text.passive` («Эффект, пока принята») или `text.action` + адрес «Доступно в «Действиях карт»»
   (`quietRewardPoseOf` в `quietRewardPose.ts`; `ConsoleParliamentSitting` — стадия и закрытие; `voteReadingOf` —
   тот же кикер над графикой в панели голосования вместо «При принятии»); контракт § 9 · THE SEAM требует у пассива `forecast`, у
   действия `preview` и текст декларации у обоих, а у резолюции без немедленных шагов — пассив или действие;
   партии без карт сажают dev-заместителей (`quietResolutionOf`: Красные → `RDX_DEV_COMPOUND`, Учёные →
   `RDX_DEV_SCIENCE`; Союз — пока без заместителя, честная ошибка).

## 5. Что резолюции ЗАПРЕЩЕНО

- Свой экран, компонент, CSS-класс, стадия. Любой `if (resolution === 'RDX_…')` в клиенте — дефект (гард п. 6
  ищет id каталога и импорты из `server/parliament/resolutions` по `src/client/**` вне манифеста и стенда).
- Своя хореография (таймлайн, задержка, `setTimeout`) — директор один.
- Лог-строка вместо `report()`; `report()` с `kind`, которого нет в таблице; два `report()` в одном шаге.
- Шаг, который мутирует И спрашивает (ломает resume). Исключение — интейк (`ExternalDrawIntake`), безопасный
  по построению; новое исключение = новый безопасный интейк в общем слое.
- Промпт без структурного маркера; детект по заголовку.
- Пересчёт выплаты на клиенте (клиент читает `outcome`, никогда «влияние × коэффициент» после факта).
- Реакция партии, записанная внутри резолюции.

## 6. Гард `tests/parliament/ResolutionContract.spec.ts` — что он проверяет (и как читать провал)

Для каждой записи `REDUX_RESOLUTION_CATALOG` с `copies > 0` (dev-примеры — отдельным `describe` без п. 3):

1. **Отчётность** — стол из 3 мест, влияние {0, 1, 3, 5} × таблица {пустая, одна подходящая, насыщенная},
   нейтральный победитель: каждый `immediateStep` даёт ровно одну запись на (место, шаг); игрок-победитель при
   влиянии {1, 3, 5}: `winnerSteps` — ровно одна запись у победителя и ноль у остальных. Провал:
   `«RX05: шаг 'draw' не отчитался при влиянии 0 / таблице 'empty'»`.
2. **Виды** — каждый `kind` ∈ `REWARD_ADDRESS`; каждая причина пропуска переведена.
3. **Маркеры** — каждый промпт шага несёт `choiceContext.source` | `placementContext.source` |
   `externalDrawPrompt.cause`.
4. **Resume** — reload внутри КАЖДОГО вопроса восстанавливает промпт с тем же маркером; ничего не платится дважды.
5. **Декларация ↔ выплата** — `amount` = `scaledAmount(effect, влияние, счёт)` (или `sequelAmount(effect,
   total.after)`); у пропуска — 0 или та же величина; записанное влияние = влияние стола.
6. **Клиент не знает имён** — `src/client/**` без id каталога и без импортов из `resolutions/`.
7. **Лицо и локаль** — `renderData` непуст, все `text.*` переведены, код уникален.
8. **Стенд** — `familyOf(definition)` ∈ `RESOLUTION_FAMILIES`.

Образец сломанной карты (шаг без `report`) и фраза, которую печатает гард, — в `describe.skip` внизу спека.

## 7. Спек карты и фикстуры

- [ ] `tests/parliament/<Name>.spec.ts` по шаблону Aquifer: каталог/код, формула, выплата каждому по СВОЕМУ
  влиянию, победитель ПОСЛЕ шага Повестки, пропуск с именем, reload внутри вопроса, нейтральный победитель,
  MarsBot никогда не спрашивается, модель с цветами. Заседание проходится хелперами
  `tests/parliament/parliamentArrange.ts` (`endGenerationThroughParliament`, `settleParliamentGates`, `answerGate`).
- [ ] Фикстуры: `parliamentFixture('parliament-<name>-<stop>', {resolution: ID, votes, agenda, arrange, stopAt,
  expect})` в `tests/e2e/fixtures/generate.ts`; `FIXTURES=parliament-<name>-vote,… npm run e2e:fixtures`;
  `tests/console/e2eFixturesLoad.spec.ts` проверит загрузку и ворота.
- [ ] Сценарии «Полигона» выводятся из семейства (`familyOf`); ручной сценарий — только для правила-исключения.

## 8. Рецепт одной строкой

Файл карты (§1) → строка в каталоге → `npm run make:cards` → локаль → `npm run test:server` (гард назовёт
пропуски) → спек карты → `FIXTURES=… npm run e2e:fixtures` → e2e заседания параметризован по каталогу. UI-файлов
рецепт не касается; если коснулся — это дефект контракта, и его чинят в общем слое.

## 9. После кода — глоссарий, галерея, пробники (ПОЛИРОВКА 2026-09-19)

1. **Слова** — каждая строка новой резолюции (чтения, заметки, плита пропуска, журнал) по
   `docs/claude/parliament-glossary.md`: резолюция «принимается / принята», игрок «победитель голосования»,
   условие «если победите», «эффект ваш», «председательство». Гард `tests/console/parliamentGlossary.spec.ts`
   красный на запрещённой форме — сначала убедись, что он КРАСНЫЙ на твоей заведомо неверной строке (JS `\b` не
   видит кириллицу).
2. **Кадр** — резолюция должна пройти галерею `tests/e2e/console-parliament-gallery.spec.ts` на своей фикстуре
   (`parliament-<name>-assembly` через `parliamentFixture({stopAt: 'assembly'})`): три профиля × три режима, на
   каждой позе FITS · paint baseline · fx-lite · reduced. Новый вид награды = новая поза в путешествии «REWARD
   variants» + строка в `rewardAddress.ts`.
3. **Рейка** — если стадия резолюции ведёт добор, строка статуса добора обязана пройти `expectRailHonest` и
   `expectDrawRailHierarchy` (честное многоточие, строгий порядок уступки).
4. **Покой** — обзор с твоей резолюцией на столе не двигается под d-pad (`console-parliament-stability.spec.ts`).

## 10. «Заседание v2» (2026-09-21) — для автора резолюции ничего не изменилось

Порядок ворот на сервере (`assembly` теперь ДО `agenda → support → enact`), проход директора на клиенте, дверь
«К полю» и одна стадия ИТОГИ живут в фазе и в консоли, не в карте. Резолюция по-прежнему объявляет только то, что
требует §1: её награда летит из её же напечатанной графики, её тайл ждёт нажатия игрока, её запись попадает в
карточку итогов из `summary` / `outcomes`. Единственное, что стоит знать: **вердикт видит стол «как проголосовали»**
— если резолюция читает что-то в момент ворот сборки (`parliamentPhasePrompt.stage === 'assembly'`), изменения ещё не
применены. Гарды прежние (`ResolutionContract.spec`, галерея, пробники); новые пробники v2 резолюций не касаются.
