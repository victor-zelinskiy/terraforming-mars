# Turmoil Redux — Cloud Development (RX06): распределение по картам, первая карта Союза, первая карта с зависимостью от дополнения

Дата: 2026-09-22. Продолжение `TURMOIL_REDUX_AQUIFER_CONTEST.md` (§5 — рецепт), `TURMOIL_REDUX_ARCHITECTURE_AWARD.md`,
`TURMOIL_REDUX_BIODOME_CONTEST.md`, `TURMOIL_REDUX_CENTRAL_POWER_GRID.md` и `TURMOIL_REDUX_CLIMATE_RESEARCH.md`.
Промт: `docs/claude/prompts/resolution-rx06-cloud-development.md`.

Cloud Development — шестая настоящая резолюция и три «первых» разом: первая, чья выплата **раскладывается по
нескольким картам игрока** (0..N на карту, сумма ровно N); первая карта **Союза** (четвёртая партия в колоде — и
первое поколение может сложиться без Зелёных на столе); первая, которая **существует только с Venus Next**.
Документ фиксирует форму промпта и записи распределения, решение по общему механизму, раскадровку встроенного
шага, ответ по правилу первого поколения со ссылками на рулбук, что проверено в пути «Союз у власти», и ключи
локали.

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id (ключ сохранения) | `RDX_UNITY_CLOUD_DEVELOPMENT` |
| Каталожный код | **`RX06`** (6-я в алфавитном списке 48 официальных резолюций — спец. §4) |
| Партия | **Unity / Союз** — первая карта партии; эмблема существующая |
| Совместимость | `compatibility: ['venus']` — без Venus Next карты нет нигде (`compatibleWith(expansions)` в `Parliament.ts`) |
| Локализованное имя | «Освоение облаков» |
| Арт | `assets/card-images/RX06.webp` (+ thumb; 1536×1024, 3:2) — `node scripts/import-card-art.mjs "<png>" RX06` → `npm run make:cards` |
| Файл | `src/server/parliament/resolutions/unity/CloudDevelopment.ts` (регистрация в `ResolutionCatalog.ts`) |
| Задание председателя | разыграть 2 метки Венеры (`{goal: {kind: 'tag', tag: VENUS}, count: 2}`) |

**Колода.** Пул растёт до семи карт четырёх партий в Venus-партии и остаётся шестью картами трёх партий без неё —
фильтр по совместимости уже стоял (`dealtInstances(compatibleWith(...))`), спеки, считавшие пул от всего каталога,
переведены на тот же фильтр (`Parliament.spec.ts`, `ParliamentPhase.spec.ts`). Старое сохранение Venus-партии с
шестикарточным пулом загружается и доигрывается: `rebuildAfterRetirement` трогает пул только при снятых id
(спек «an older Venus save…»).

## 2. Правило и принятые трактовки

Печатный текст: *When enacted: Add 1 floater to any of your cards for each Venus and Jovian tag you have + Influence.*
Задание: разыграть 2 метки Венеры.

**Формула:** `N = V + J + I` для **каждого** участника — метки Венеры и Юпитера по каноническому счётчику проекта
(`player.tags.count(tag, RESOLUTION_TAG_COUNTING_MODE)` — `'raw'`: универсальная метка при принятии ни та, ни
другая; карта с обеими метками даёт 2), влияние по реестру Redux после шага победителя по Повестке. Аэростаты
кладутся **только на свои карты, принимающие аэростаты**, каждый — на любую (0..N на карту, сумма ровно N).

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Счёт | ОДИН член над ДВУМЯ метками: `resolutionCountKind('venusJovianTags') = {kind: 'tags', tags: [VENUS, JOVIAN]}`; модель несёт разбивку `byTag` | `resolutionCounts.ts`, `ResolutionCounts.ts`, спек «N = Venus + Jovian tags + influence» |
| Форма шага | `N ≥ 2` **и** держателей `≥ 2` — РАСПРЕДЕЛЕНИЕ (структурный маркер); иначе — обычный выбор карты семейства (`AddResourcesToCard`, `autoSelect: false`, `resourceGainPrompt`) | `AddResourcesToCards.ts`, спек «the shape of the ask» |
| Одна карта | выбор ПОКАЗЫВАЕТСЯ и подтверждается — никогда не кладётся за спиной игрока (инвариант 3) | спек «ONE holder, N = 3: the pick is SHOWN and confirmed» |
| Неверная сумма | `InputError`, промпт стоит, ничего не применено: сначала проверка, потом применение | спек «a sum below N is refused…» |
| Применение | `player.addResourceTo(card, {qty, log: false})` — штатное добавление с событиями рекордера | спек «lands the units where the player put them» |
| Запись | ОДИН `ctx.report({kind: 'cardResource', cards: [{card, amount}, …], card?})` — `card` только у списка из одной | спек «records ONE outcome with the whole list» |
| ПО на рейке | сервер считает `vpByAmount` для каждой карты и каждого k (ступенчатые ПО — Jovian Lanterns: 1 ПО за 2 аэростата) | `actionPreviews.distributionVictoryPoints`, спек «the VP table matches what REALLY applying k floaters scores» |
| Пропуски | `N = 0` → «Нет меток Венеры и Юпитера и нет влияния» (amount 0); нет держателя → «Нет карты, принимающей аэростаты» **с величиной** — выплата названа и пропадает, метка Венеры — не хранилище | спек «the skips — named, with their size» |
| Задание | аэростаты резолюции не двигают задание «2 метки Венеры»; собственный розыгрыш карты с меткой — двигает | спек «the floaters never progress the Venus-tag quest» |
| Возобновляемость | `ctx.state['floatersOwed' / 'floatersCount']`; reload посреди раскладки пересобирает тот же вопрос, платит один раз | спек «recovery» |
| Нейтральный победитель | никого не отменяет | спек «a neutral winner cancels nothing» |
| MarsBot | политика `none`: не считается, не получает, не победитель | спек «MarsBot (mode none)…» |

## 3. Форма промпта и записи (общий механизм)

**Решение по `AddResourcesToCards` — ОДИН механизм, поднятый до контракта, а не вторая реализация.** Старый
отложенный шаг (три карты проектов: Cyanobacteria, Communication Boom, Philares) применял сам при одной карте,
принимал сумму через `Error` и не нёс маркера — и тем самым показывался безликим `composite`. Теперь:

```ts
new AddResourcesToCards(player, CardResource.FLOATER, owed, {
  autoSelect: false,                       // одна карта — ВСЁ РАВНО спрашивается (резолюции); проекты сохраняют дефолт upstream
  cause: SOURCE,                           // choiceContext {source: {kind: 'resolution'}, mode: 'reward'} на промпте
  from: {resolution: CLOUD_DEVELOPMENT_ID},
  pickTitle: message('Add ${0} floater(s) to one of your cards', …),
  distributeTitle: message('Place ${0} floater(s) on your cards', …),
}).andThen((placed: ReadonlyArray<{card: ICard, amount: number}>) => { … ctx.report(...) })
```

- `execute()` → при `!distributes()` (N = 1 или держатель один) — `AddResourcesToCard` с тем же `autoSelect`
  и `cb([{card, amount: N}])`; иначе — `AndOptions` из `SelectAmount(card.name, '', 0, N)` на держателя, помеченный
  `markCardResourceDistribution({amount, cardResource, cards: cardsToModel(…, {showResources: true}), vpByAmount})`.
- Ответ: `{type: 'and', responses: [{type: 'amount', amount: k_i}]}`; `process` СНАЧАЛА проверяет
  `Σk_i === N` (`InputError`), ПОТОМ применяет и вызывает `cb(landed)`.
- На проводе: `AndOptionsModel.cardResourceDistributionPrompt: CardResourceDistributionMeta` — единственный признак
  распределения; заголовок — только текст журнала (инвариант 1).
- Запись: `SerializedEnactOutcome` / `ParliamentEnactOutcomeModel` расширены `cards?: [{card, amount}]` и
  `countedByTag?: [{tag, count}]`; **нового вида исхода нет** — `REWARD_ADDRESS.cardResource` остался, `rewardAddressOf`
  отдаёт `cards` (из списка или из `card` + `amount`).

Три карты проектов на `AddResourcesToCards` получили премиальную поверхность раскладки **бесплатно** (маршрут
по маркеру) и сохранили своё поведение при одной карте (дефолт `autoSelect` — мгновенное применение upstream).

## 4. Встроенный шаг «раскладка» — одно шасси, два режима

Клиентская поверхность — **тот же** выбор карты из сетки (`ConsoleTaskHost`, режим `cardSelect`), в котором
`consoleTaskRouter.taskFor` по маркеру выставляет `mode: 'distribute'`:

- **Чистая модель** `src/client/console/cardResourceDistribution.ts`: `stepSpread` (−1/+1, ограничено: на нуле и без
  остатка возвращает ТО ЖЕ состояние), `pourRemaining`, `spreadComplete`, `spreadBlocked` («Осталось разложить: N»),
  `spreadCardReading` (ресурс `было → станет`, ПО из серверной таблицы ровно для k карты), `spreadVictoryPointsShift`,
  `spreadToPicks` / `spreadFromPicks` (переживает «свернуть» через хранилище пиков). Спек
  `tests/console/cardResourceDistribution.spec.ts`.
- **Сборщик ответа** `cardResourceDistributionResponse(order, placed, amount)` возвращает `undefined` при сумме ≠ N —
  до `gameTransport.submitInput` дело не доходит (`taskResponses.spec.ts`).
- **Четыре уровня против неполной отправки**: старт с нуля (никакого «всё на первую»); A при остатке — кнопка
  отключена с причиной, а `spreadCommit` возвращается, не отправив ничего; сборщик отдаёт «нечего отправлять»;
  сервер отвечает `InputError`. Пробник e2e считает запросы к `player/input` — ноль.
- **Управление** — существующая грамматика количества: d-pad между картами, `bumperL`/`bumperR` −1/+1 на карте в
  фокусе, `triggerR` — весь остаток, `confirm` — подтвердить (`GamepadGlyph`, ни одного литерала).
- **Статус-строка**: карта в фокусе (`Resources on this card: было → станет`, `VP: было → станет` из таблицы для k),
  итог (`data-spread-blocked` «Осталось разложить: N» / `data-spread-ready` «Всё разложено», `data-spread-vp` общий
  сдвиг ПО). Бейджи стадии: «Разложено k/N», «Осталось».
- **Место в сцене**: слот `[data-embed-slot="parliament-stage"]`, резолюция — герой слева; хвост крошки
  `ПАРЛАМЕНТ › ЗАСЕДАНИЕ › РАСКЛАДКА` (`sittingStageKey('reward', 'distribution')`, `SITTING_HOSTED_STEPS`); лента не
  меняет высоту (пробник `bandHeights`), тело меняется грамматикой v5 (ряд партий уходит, шаг раскрывается из-под
  ленты — ни одного кадра пустого тела, пробник `emptyBodyFrames`).
- **Коммит**: `consoleResolutionPayout` переписан на СПИСОК целей — `detectResolutionPayout` читает запись
  `cards`, `runResolutionPayout` летит по одному чипу на карту с иконки резолюции (`carrierIconOrigin`), карта
  тикает в кадре своей посадки (`pickPayoutLanding.landed[card]`).
- **Итоги**: `parliamentResultsModel` несёт список карт (`ResultsPayoutPart.cards`), панель рисует
  `.con-sit__part-card` на карту; `ConsoleInfluenceYield` при `countedByTag.length > 1` печатает вход по каждой
  метке (`data-yield-in="tag:venus"` / `"tag:jovian"`).

### Раскадровка (e2e `console-parliament-cloud.spec.ts`, фикстура `parliament-cloud-enact`)

| Шаг | Что на экране | Свидетель |
| --- | --- | --- |
| 0 | Плита «Парламент» на доме доски, ничего не открылось само | `.con-mandatory`, `.con-parl` = 0 |
| 1 | A → заседание; герой слева (`RX06`), два держателя настоящими лицами, счётчики `0` и `0`, лента тех же размеров, крошка «…› РАСКЛАДКА» | `[data-parl-sit-hero] .pcard.rdx-unity-cloud-development`, `[data-spread]`, `crumbText` |
| 2 | Чтение «откуда число»: метки Венеры 1, Юпитера 1, влияние 2 | `[data-yield-in="tag:venus"]` и т. д. |
| 3 | A при остатке 4 — **ноль запросов**, промпт стоит; LB на нуле — ничего | счётчик `player/input`, `waitingFor.type === 'and'` |
| 4 | RB, RB на карте в фокусе → `+2`, «осталось 2»; d-pad → соседняя; RT → остаток; «Всё разложено», сдвиг ПО +1 (Jovian Lanterns: 1 ПО за 2) | `[data-spread-band]`, `[data-spread-ready]`, `data-spread-vp-shift` |
| 5 | RT без остатка и RB сверх — ничего (переполнения нет) | счётчики не меняются |
| 6 | L3 — осмотр резолюции; раскладка переживает осмотр | `dialog.con-zoom--parliament` |
| 7 | A → ОДИН запрос; два чипа «+2» с иконки резолюции, капсулы карт тикают до `2` и `2` ещё на экране раскладки | пробник `chips === 2`, `.pcard__res-count` |
| 8 | Выбор одной карты у другого места (3 → Atmo Collectors), итоги, A, ворота, поколение 2 | `answerAsksAs`, `turnTo('results')` |
| 9 | Запись: список `[Dirigibles:2, Jovian Lanterns:2]` без `card`; у соседа `card: Atmo Collectors`; Зелёные оплачены `absent` | `lastPhase.outcomes`, `lastPhase.support` |
| 10 | Союз правит: плитка в правительстве, гнёзда void, действие не «нет доступа» | `[data-parl-ruler-slot] [data-party="Unity"] [data-support-void]` |

Замеры прогонов — §7.

## 5. Первое поколение при четырёх партиях и Союз у власти

**Правило сверено с рулбуком (буквальное прочтение подтверждено, сервер не менялся):**
- сетап (стр. 8): пока в слоте ENACTED нет карты, правят Зелёные — «по напечатанному слоту»;
- шаг народной поддержки (стр. 9 — области; стр. 11 — шаг): по кубу получает каждая партия, «not present on any
  card in the Voting Area or Enacted slot». Напечатанный слот — **не карта**;
- FAQ (стр. 17): Зелёные в сетапе допускаются — правитель без карты нормален.

Следствие: в Venus-партии область первого поколения может быть Союз / Марс / Индустриалисты, Зелёные правят без
карты, и сервер платит им как отсутствующей партии. **Клиент:** гнёзда поддержки прячутся по признаку **«правит
ПО ПРИНЯТОЙ КАРТЕ»**, а не по флагу `ruling` (`ConsolePartyPlaque` `rulesByCard`; хост читает `view.enacted`, во
время смены правительства — факт холдов `rulerBeforeByCard`, посеянный `parliamentSittingSeed`); сцена поддержки
получает правящую партию только когда та правит по карте (`sittingDirector.beatSupport`), поэтому куб стартовым
Зелёным садится в ИХ гнёзда в правительстве. Строка поддержки в итогах и раньше исключала партию **принятой карты**
(`summary.enacted.party`).

Спеки: `ParliamentPhase.spec.ts` § THE STARTING-RULE RULER (три партии — Зелёные всегда с картой; Venus — область без
Зелёных → `absent`, буквальное правило), `ParliamentRenewal.spec.ts` сценарий 8 (четыре партии: Зелёные в колоде,
отказ второй карты по площади, перетасовка проигравших посреди раздачи, реплей журнала), `supportScene.spec.ts`
(правитель без карты — «absent», из резерва), `ConsolePartyPlaque.spec.ts` (гнёзда × `ruling` × `rulesByCard`).

**Путь «Союз у власти»** (спек `once enacted, UNITY RULES` + e2e шаг 10 + галерея «overview-unity-rules»):
принятая карта Союза → `rulingParty === UNITY`, эффект правящей партии у каждого участника (свободный путь
торговли), плитка Союза в правительстве с void-гнёздами, действие партии на плитке не «нет доступа»; записи выплат
с `kind: 'reaction'` при торговле — данные партии, не карты (в этой резолюции реакций нет — выплата аэростатами не
двигает ни производство, ни параметры).

## 6. Стенд «Полигон» и галерея

- Новое семейство **`distributed`** (`resolutionFamily.ts`: `spreadEffectOf` — единица `cardResource` с
  `spread: true`; выше `counted-tags`, ниже `sequel`). Сценарии на настоящих картах: Dirigibles (Венера, держит),
  Jupiter Floating Station (Юпитер, держит), Atmo Collectors (держит, не считается), Atmoscoop
  (считается, не держит), Cloud Tourism (обе метки на одной карте), Air-Scrapping Expedition (событие рубашкой
  вверх), Celestic (корпорация), Nobel Prize (универсальная — ни та, ни другая); «нет держателя — названо и
  пропадает»; каждому своё; победитель сначала по Повестке; записанный результат; задание 0/2, 1/2, выполнено;
  **живые**: `parliament-cloud-vote`, `parliament-cloud-enact`.
- Секция пикера для распределения показывает ФАКТЫ раскладки (держатели лицами с «хранится → хранится…+N»), а
  настоящую поверхность открывает живой сценарий — второй реализации раскладки на стенде нет.
- Галерея: тест «the REWARD variant: the DISTRIBUTION…» — вердикт на четырёх партиях (гнёзда стартового
  правителя), раскладка (позы 24 / 24b), итоги (24c), Союз у власти (24d); три профиля × три режима.

## 7. Проверки и прогоны

- **Сервер:** `tests/parliament/CloudDevelopment.spec.ts` (29), `ResolutionContract.spec.ts` (ответ на `AndOptions`),
  `resolutionCounts.spec.ts`, `rewardAddress.spec.ts`, `CommunicationBoom.spec.ts` (N=1 → `SelectCard`, N=3 → помеченный
  `AndOptions`), `ParliamentPhase.spec.ts`, `ParliamentRenewal.spec.ts` (сценарий 8), `supportScene.spec.ts`.
- **Клиент:** `cardResourceDistribution.spec.ts`, `taskResponses.spec.ts`, `consoleTaskRouter.spec.ts` (строка 24d),
  `consoleSittingFlow.spec.ts`, `consoleResolutionPayout.spec.ts` (список целей), `ConsolePartyPlaque.spec.ts`.
- **e2e:** `console-parliament-cloud.spec.ts` (лицо, обзор на четырёх партиях, чтение голосования; раскладка с
  нулевым стартом, нулём запросов, LB/RB/RT, коммит с двумя чипами, запись, Союз у власти — три профиля),
  `console-parliament-gallery.spec.ts` § the DISTRIBUTION.
- **Прогоны** — см. `docs/claude/parliament-sitting-progress.md` § Cloud Development (таблица заполняется по
  результатам).

## 8. Рецепт следующей резолюции — дополнения

К §6 `TURMOIL_REDUX_CLIMATE_RESEARCH.md`:

1. Выплата ресурсом карты, которую игрок **раскладывает** — единица `{kind: 'cardResource', resource, spread: true}`
   и шаг `new AddResourcesToCards(player, resource, N, {autoSelect: false, cause, from, pickTitle, distributeTitle})`
   с `.andThen((placed) => ctx.report({kind: 'cardResource', cards: placed…}))`. Форма вопроса (выбор / раскладка)
   решается шагом, поверхность, полёт по одному чипу на карту, итоги и «Полигон» — общие. Greens Budget (животные
   и микробы разом) — два шага с двумя единицами, а не новая модель.
2. Резолюция, зависящая от дополнения, объявляет `compatibility: [...]` и больше ничего: колода, спеки пула и лицо
   (медальон совместимости рядом со штампом модуля) читают декларацию.
3. Четвёртая партия в колоде — уже норма: область из трёх карт без стартового правителя законна, клиент судит о
   гнёздах правителя по принятой карте.
