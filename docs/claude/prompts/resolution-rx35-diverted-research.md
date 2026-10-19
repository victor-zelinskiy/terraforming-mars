# Промт исполнителю · RX35 Diverted Research (Красные) — ПЕРВЫЙ ЗАМЕНЯЮЩИЙ ПАССИВ: «каждый шаг кислорода/температуры и каждое озеленение/океан, которые вы ПОЛУЧИЛИ БЫ, становятся 1 data — даже на максимуме параметра»

Выдан 2026-10-19. Карта лежала в очереди `Resolutions\skip\` (предпосылка — держатель data в скоупе — выполнена с TR02;
сегодня держателей данных в скоупе 10 карт: Biological Simulations, Habitat Science, Martian Census, Martian Fiber,
Political Science, Red Museum, Research Startups, Supercomputer, Vector Computations, Venusian Census — плюс Pluto Redux
ПЛАТИТ data при торговле).
Владелец достал её из очереди сам. Каталог — `docs/TURMOIL_REDUX_SPEC.md` §4.1 (строка Diverted Research: `Н, П · 4 data
· B, D`), §4.1.1 (задание — «оранжевый квадрат data ×4»).

Процедура автора — `docs/claude/parliament-resolution-checklist.md` (§1 — что обязан объявить файл; § RX10 `:228` — живой
пассив и его твин; § RX14 `:359` — пассив-запрос; § RX30 — реактивный пассив «в позиции живого срабатывания»; §4 `:923` —
таблица адресов; §6 `:962` — гард), гард — `tests/parliament/ResolutionContract.spec.ts`. Журнал —
`docs/claude/parliament-sitting-progress.md` (последняя запись — RX34, формат оттуда), реестр полировок —
`docs/claude/gameplay-polish-ledger.md` (следующий свободный номер в конце файла — на выдаче **PL-704**, раздел **BJ**;
сверить на своём HEAD), правила — `.claude/rules/{game-logic,server,console-ui,board,animations,tests,localization}.md`.
Постоянная часть полировки — `docs/claude/turmoil-redux-card-checklist.md` §7 `:156` («Профили» `:168` — TV 4K сперва;
«Премиум-планка» `:189`; «Качество полировки» `:219`) — ссылаться, не повторять.

**Код — RX35** (RX01–RX34 заняты: `grep -rhn "_CODE: ResolutionCode" src/server/parliament/resolutions/`; проверь на
своём HEAD — рядом могут выдать следующую).

**Образцы — по частям, не целиком:** **RX18 Medical Database** (`scientists/MedicalDatabase.ts`) — выплата data на
карту при принятии (единица `cardResource`, `AddResourcesToCard(s)`, `autoSelect: false`, четыре названных нуля);
**RX01 Aquifer Contest** — «на ОДНУ карту» (здесь — так; не RX06-раскладка); **RX10 Development Craze**
(`marsFirst/DevelopmentCraze.ts`) — живой пассив: `b.effect` одной отрисовкой, `text.passive`, `forecast`, `placementFacts`,
мутации под источником резолюции через ДИСПЕТЧЕР (`ParliamentHandler.enactedPassive` `:174`), карточка закона в
нотификации (`notificationModel.lawAnswerNotification` `:213`); **RX14 Heat Capture** — пассив-ЗАПРОС (хук спрашивается в
одной функции цены); **RX30 Urban Development** — реактивный пассив со своим твином В ПОЗИЦИИ живого срабатывания;
**RX25 Plant Ban** — Красные (партия, стиль); **TR44 Aquatic Research Station** / **TR21 Arboretum** — «data на ЛЮБУЮ карту»
из розыгрыша и действия (`addResourcesToAnyCard` + пре-селект цели; `adjacentCityPayout.ts` — «цель сперва, тайл потом»);
**TR53** (память `tr53-card-receive`) — ОДИН директор приёма ресурса картой в четырёх хостах — этим и летит data.

**Главные контракты этой карты:** `IResolution.ts` (`ResolutionPassive` — три рода хуков сегодня: реактивные
`onTilePlaced`/`onCardPlayed`/…, запросы `cardDiscount`/`resourceValueBonus`/`tagBonus`, твины `forecast`/`placementFacts`/
`cardPlayedForecast`); `ParliamentHandler.ts:160–300` (диспетчер, гейт `participates(player, 'enactment')`);
`Game.ts:1791–1856` (`increaseOxygenLevel`), `:1976–2070` (`increaseTemperature`), `:2856–2870` (`addGreenery`),
`:2883–2905` (`addOcean`), `:2780–2850` (`grantSpaceBonuses` — платные бонусы клетки OCEAN / TEMPERATURE_4MC),
`:1401–1440` (WGT — `Phase.SOLAR` → `rewarded = false`), `:1224–1250` (финальное озеленение после Парламента);
`behavior/Executor.ts:83–101` (предупреждения `maxtemp`/`maxoxygen`/`maxoceans`), `:552–560` (`global`), `:692–716`
(`ocean` ×2 / `greenery`), `:875–895` (`TRSource` превью); `deferredActions/{PlaceGreeneryTile,PlaceOceanTile,
StandardProjectPlacement,AddResourcesToCard}.ts`; `base/standardActions/{ConvertPlants,ConvertHeat}.ts`
(`heatConversionMetadata` — метаданные опции колеса, `futile`); `base/standardProjects/{Greenery,Aquifer,Asteroid}
StandardProject.ts` (pay-on-commit — клетка ПЕРЕД оплатой); `models/effectForecast.ts` (`resolutionFacts` `:336`,
`partyFacts` `:289`, `scaleBonusPass` `:559`, входы `:1305/:1321`); `models/actionFutility.ts` + `cards/actionFutilities.ts`
(«действия без эффекта» — память `futile-actions-iteration`, док `docs/claude/console/futile-actions.md`);
`models/preselectAddresses.ts` + `common/inputs/preselectAddress.ts` (адрес пре-селекта `for: {source, role}` — закон TR43);
`tests/models/actionPromptCoverage.spec.ts` (гард пре-селекта — превью = ОБЕЩАНИЕ о форме живых промптов);
`parliament/quests/QuestTracker.ts:55–90` (`eligible` — корни `political-phase`/`solar-phase` чужие); память
`action-precollect-contract`, `precollected-batch-tail-parks`, `scale-marker-never-lags`, `final-greenery-session`,
`marsbot-turmoil-redux-design` (D3: пассивы боту не применяются — аспект `enactment`), `redux-rules-outrank-owner-description`.

---

## 0. Параллельная работа

Рядом идут другие сессии (стол «Разыграно», приёмка TR69/П6 Парламента). Общие файлы (реестр резолюций
`ResolutionCatalog.ts`, `src/locales/**`, `docs/TURMOIL_REDUX_SPEC.md`, `parliament-sitting-progress.md`,
`gameplay-polish-ledger.md`, `genfiles/**`) — только своя строка, генерируемое руками не править, перед коммитом
перечитывать файл. Память `concurrent-session-edits-same-files`, `git-temp-index-race` (хранить патчи файлом, не heredoc > 5 КБ).

## 1. Карта

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Resolutions\skip\Diverted Research.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\Diverted Research.png` (**без** суффикса `_art` — имя сверь; 1536×1024) →
`node scripts/import-card-art.mjs "<путь>" RX35` → `npm run make:cards`.

- **Партия:** Reds (RU — **Красные**, `party name: Reds` уже в `parliament.json:631`). `compatibility` не объявлять
  (data — ресурс базовых правил форка, держатели есть в turmoilRedux; карта сдаётся в каждую партию Redux).
- **Печатное правило (скан):** верх — `[data] / [влияние]`; ниже крупно **«REPLACE [температура] / [кислород] /
  [океан] / [озеленение] : [data]»**; текст: *«(When enacted: Gain data resources equal to your Influence. Effect:
  REPLACE each increase in Oxygen or Temperature and each Greenery and Ocean tile you would gain with 1 data resource.
  (Even if the parameter is maxed.)»*. Внизу справа — задание **«4 [data]»**. Слева — ромб модуля.
- **Части:** немедленная (data = влияние, каждому) + **ПАССИВ** (замена терраформирования). Части победителя нет,
  мирового шага нет, действия нет.
- **Задание председателя:** `{goal: {kind: 'cardResource', resource: CardResource.DATA}, count: 4}` — вид `cardResource`
  в `QuestGoal` есть (`ParliamentTypes.ts:181`), `QuestTracker` его считает (`:109`), глиф лица рисует
  (`quests/questRender.ts:73`), **но ни одна сданная резолюция его не использовала** — первый живой потребитель:
  проверить лицо (сноска «×4 [data]»), досье задания, прогресс кубиками, путь бота (`botQuestPath`: data у бота = область
  хранения data, см. §A8).
- **Имя RU — решение владельца (§3, Р1); по умолчанию «Перенаправленные исследования».** Лор карта не печатает → по
  правилу `docs/claude/turmoil-redux-invented-lore.md` придумать (арт: техники пакуют ящики образцов и приборы под флагом
  Красных на фоне буровых вышек — «исследования уехали со стройки терраформирования»), строка в таблицу лора, затем в код.

## 2. ЧТЕНИЕ ПРАВИЛА — что заменяется, что нет (каждый пункт — спеком)

Это **ЗАМЕНЯЮЩИЙ** пассив — третий род после реактивных (RX10/RX30: закон ДОПЛАЧИВАЕТ после события) и запросов (RX14/
RX19/RX26: закон ЧИТАЕТСЯ в одной функции). Здесь закон **перехватывает событие ДО того, как оно произошло, и ставит
вместо него другое**: параметр не двигается, тайл не ложится, РТ не растёт, а на карту игрока приходит data. Правила
Redux важнее словесного описания (память `redux-rules-outrank-owner-description`) — читаем по букве.

1. **Что заменяется — ровно четыре вещи:** шаг КИСЛОРОДА, шаг ТЕМПЕРАТУРЫ, тайл ОЗЕЛЕНЕНИЯ, тайл ОКЕАНА, которые
   **получил бы участник Парламента** (`participates(player, 'enactment')`). Каждая единица (шаг / тайл) → **1 data**.
2. **Что НЕ заменяется:** Венера (не названа); «голый» РТ (`behavior.tr`, шаг `tr` трека Повестки, РТ за кресло) — закон
   говорит про ПАРАМЕТРЫ и ТАЙЛЫ, не про рейтинг; ПОНИЖЕНИЯ (`increments < 0` — Gas Export, Heat Capture, обратный ход
   TR47); ход Мирового правительства и любой `unrewarded` ход (никто не «получает» — `Game.ts:1796` `rewarded`);
   город/особый тайл; ресурсы; **бот** (аспект `enactment` у MarsBot выключен — его терраформирование идёт как есть,
   `AutomaTerraformer`/`AutomaTilePlacer` не трогать); чужие игроки вне Парламента.
3. **«Даже если параметр на максимуме»:** замена стоит **ПЕРЕД** проверкой потолка (`Game.ts:1792`, `:1977`, `:2893`):
   кислород 14 % + карта «+1 кислород» → 1 data (сегодня — ничего); 9 океанов + «океан» → 1 data (Whales при этом
   НЕ получает животное — океан перехвачен раньше `PlaceOceanTile.ts:48`); **считаются ПЕЧАТНЫЕ шаги, не обрезанные
   потолком** (решение Р3: кислород 13 % + «+2» → 2 data).
4. **Следствия замены — движковые, ничего не дописывать:** параметр не растёт → нет РТ, нет 2 M€ Зелёных, нет бонусов
   шкалы (8 % → температура, −24/−20 → тепло, 0 °C → океан), не срабатывают реакторы `onGlobalParameterIncrease`, Ares не
   реагирует, «Марс терраформирован» не объявляется; тайл не ложится → нет бонуса клетки, нет соседства, нет РТ за
   озеленение Redux (`ParliamentHandler.onGreeneryPlaced`), нет ПО тайла, нет реакции Mars First; событие
   `global-parameter-change` НЕ пишется (ничего не изменилось). Закон не «обнуляет» — он **подменяет**: вместо
   события-параметра/тайла записывается событие закона с data (§A6).
5. **Озеленение = 1 data, не 2.** Кислород озеленения — часть тайла (`addGreenery` → `increaseOxygenLevel`); тайл
   перехвачен раньше → его кислорода не существует. Карта с печатным `+1 O₂` **и** озеленением (`Executor.ts:886`
   суммирует их только для превью) → 2 data (шаг + тайл) — проверить, что превью не обещает три.
6. **Один розыгрыш — ОДИН вопрос «куда»** (решение Р4): все единицы одной операции (корня событий) копятся и ложатся
   одним `AddResourcesToCard(count = N)` на ОДНУ карту-держатель: Giant Ice Asteroid (темп. +2 и 2 океана) → один выбор
   на 4 data; Lake Marineris → один на 2; Протектед-Вэлли/Мангров (озеленение на океанской клетке) → 1. Форма вопроса —
   выбор ОДНОЙ карты (RX01), **не раскладка** (`spread` не объявлять — ловушка RX34 §2).
7. **Нет держателя → названная потеря, не блок:** «N data от «Перенаправленных исследований» пропадают — нет карты,
   принимающей данные» (`recordSkippedEffect`, инвариант 4, величина честная). Действие остаётся доступным (сервер не
   запрещает терраформировать под законом) — но становится **«без эффекта»** (§A4), и композер говорит об этом до нажатия.
8. **Доступность под законом — потолок и клетка больше не гейт:** `ConvertHeat.canAct` (`maxtemp`), `AsteroidStandard
   Project.canAct`, `Executor.canExecute` предупреждения `maxtemp`/`maxoxygen`/`maxoceans` (`:85–101`), `ConvertPlants.
   canAct` («нет клетки», `:31`), `GreeneryStandardProject.canAct`/`AquiferStandardProject` («нет клетки») — под законом
   неверны: закон ничего не кладёт, клетка ему не нужна, потолок не мешает. **Решение Р5:** гейты по клетке/потолку
   снимаются, пока закон стоит и игрок — участник (предупреждения не выдаются; «нет клетки» не блокирует). Цена
   (8 растений / 8 тепла / M€) остаётся гейтом как была.
9. **Задание председателя «4 data» считает ТОЛЬКО собственные действия:** data с принятия (корень `political-phase`) —
   не считается (`QuestTracker.eligible`, `:55–57` — так уже устроено, закрепить спеком); data, ПЕРЕХВАЧЕННАЯ внутри
   своего действия (корень — действие игрока), — считается (это результат его действия; тот же принцип, что у RX10 — удвоенный
   бонус внутри своего размещения). Решение Р6 — по умолчанию так.
10. **Порядок принятия:** `ParliamentPhase.ts:447` ставит новую карту в слот ДО шагов эффекта → часть победителя СЛЕДУЮЩЕГО
    закона (океан RX01, озеленение RX03, +2 температуры RX23) **не перехватывается** (Diverted Research уже сброшена).
    Спек: RX23 после RX35 — победитель получает температуру и РТ.
11. **Срок закона — до следующего принятия, ВКЛЮЧАЯ финальное озеленение** (решение Р2, по букве): Парламент последнего
    поколения ставит закон, затем `continueAfterParliamentPhase(final)` → `gotoFinalGreeneryPlacement` (`Game.ts:1224`) —
    финальная конвертация растений под законом даёт 1 data, не тайл. Сессия финала (`final-greenery-session`, PL-301…307)
    обязана это ЧЕСТНО показать и спросить держателя вместо клетки (§B5).
12. **Пограничные карты (по букве, спеком, без особых веток):** Flooding — океан перехвачен → соседей нет → кражи нет;
    Icy Impactors — перехват для КРЕДИТУЕМОГО игрока (`creditedPlayer`), первому игроку выбор клетки не приходит;
    Arboretum (TR21) — озеленение перехвачено → «соседних городов» нет → её собственная data = 0, закон платит 1;
    TR47 Ecological Experiment — подъём перехвачен (data), обратный ход — как есть (параметр уйдёт вниз);
    Hellas «6 M€ → океан» и Vastitas «4 M€ → температура» — покупка даёт 1 data, и досье клетки говорит это ДО оплаты
    (`placementFacts`); Europa (постройка колонии → океан) → 1 data; Water Hauling (TR06, награда причала) → 1 data;
    Aquatic Research Station (TR44 — город на океан) — не океан, не трогается; MarsBot как «первый игрок» ни на что здесь
    не влияет.

## 3. Решения владельца — ПРИНЯТЫ ПО УМОЛЧАНИЮ (батч владельцу ПЕРВЫМ, с кадрами где есть; изменит — правишь до кода)

| № | Вопрос | По умолчанию (рекомендация) | Альтернатива |
| --- | --- | --- | --- |
| Р1 | Имя RU | «Перенаправленные исследования» | «Отвлечённые исследования» / «Наука вместо терраформирования» |
| Р2 | Финальное озеленение под законом | **по букве** — перехватывается (закон стоит до конца игры; сессия финала показывает «8 растений → 1 data») | исключить финал (эффект заканчивается с последним действием поколения) — минус §B5 |
| Р3 | «Даже на максимуме»: печатные или обрезанные шаги | **печатные** (13 % + «+2» → 2 data) | обрезанные (→ 1 data) |
| Р4 | Форма «куда»: один вопрос на операцию, ОДНА карта | **да** (накопитель по корню; RX01-форма) | по вопросу на единицу / раскладка RX06 |
| Р5 | Гейты «потолок»/«нет клетки» под законом | **снять** (закон ничего не кладёт) | оставить (кислород 14 % → конвертация тепла недоступна, data не получить) |
| Р6 | Перехваченная data и задание «4 data» | **считается** (внутри своего действия); data принятия — нет | не считать ничего от закона |
| Р7 | Пре-селект: где обязателен | розыгрыш из руки + действия карт + стандартные проекты + конвертации колеса + постройка колонии; остальное — живой промпт (§B1) | только розыгрыш/действия |

## 4. Блок A · сервер — ЗАМЕНЯЮЩИЙ ПАССИВ как член семейства (одна точка решения, движковые входы, страховка, гард-ворклист)

### A1 · Немедленная часть — сборка из готового (RX18/RX01)

```
DATA: {id: 'data', unit: {kind: 'cardResource', resources: [CardResource.DATA]}, perInfluence: 1, recipient: 'each'}
```

Шаг по образцу `MedicalDatabase.RESOURCES_STEP`, но с `AddResourcesToCard` (одна карта; `spread` НЕ объявлять):
`ctx.state` фиксирует `owed` первым проходом; `autoSelect: false` (единственный держатель всё равно ПОКАЗЫВАЕТСЯ —
инвариант 3); `cause: {kind:'resolution', resolution: ID}`, `from: {resolution: ID}`, `title` — английский ключ. **Три
названных нуля:** влияние 0 → «нет влияния» (`skipped`, amount 0); влияние > 0 без держателя → «N data пропадают — нет
карты, принимающей данные» (`skipped`, amount N); записи `cardResource` — `card`, `amount`, `resource: DATA`. Бот —
вне цикла мест. Это всё семейство делает само (лицо, панель голосования, пикер-бит RX01, стенд «Полигон» семейства
`influence`) — своего кода тут нет.

### A2 · Пассив — НОВЫЙ РОД ХУКА в `ResolutionPassive`: `divertTerraforming`

Не `onTerraformRatingGained` (он ПОСЛЕ факта и про РТ), не `onTilePlaced` (тайл уже лёг). Нужен хук, который движок
**спрашивает ДО мутации** и который **сам мутирует вместо неё**:

```ts
/** A TERRAFORMING UNIT the player is about to GAIN — one scale step or one tile. */
export type TerraformingUnit =
  | {kind: 'parameter', parameter: GlobalParameter.OXYGEN | GlobalParameter.TEMPERATURE, steps: number}
  | {kind: 'tile', tile: 'greenery' | 'ocean', count: number};

/** REPLACES the unit (returns true — the engine does NOT perform it; the hook already queued what stands instead). */
divertTerraforming?(player: IPlayer, unit: TerraformingUnit, origin: TerraformingOrigin): boolean;
```

- **Диспетчер — `ParliamentHandler.divertTerraforming(player, unit, origin): boolean`** — ОДНА функция, которую спрашивают
  все входы движка; она (а) гейтит `participates(player, 'enactment')` + ENACTED + наличие хука, (б) открывает область
  `withEffectSource(player, {kind:'resolution', id, owner}, 'terraforming-diverted', …)` (новый канал `EventTrigger` —
  `src/common/events/GameEvent.ts:48/:219`, рядом с `tile-placed`/`tr-increase`; он же `source(channel)` твина и
  канал плана эффектов обозревателя), (в) возвращает вердикт. Хук карты внутри
  области: пишет строку журнала (§A6) и кладёт единицы в **НАКОПИТЕЛЬ** (§A3). `origin` — структурный источник для
  журнала/маркера: `{kind:'card', card} | {kind:'standardProject', card} | {kind:'spaceBonus', space} | {kind:'colony',
  colony} | {kind:'final-greenery'} | {kind:'system', name}` — тот же словарь, что `ChoiceContextSource`/`PlacementContext`.
- **Входы движка (каждый — одна строка «спросить диспетчер, выйти, если true»):**
  1. `Game.increaseOxygenLevel` / `increaseTemperature` — **ПЕРЕД** проверкой потолка (`:1792`, `:1977`), только при
     `rewarded` (не SOLAR, не `unrewarded`) и `increments > 0`; `steps = increments` (печатные, Р3). Venus — нет.
  2. `Executor.execute` — `behavior.ocean` (count 1/2 → ОДИН вызов с `count`), `behavior.greenery` — ПЕРЕД `defer(new
     Place…)` (`:692–716`): перехват на уровне поведения даёт один вызов на карту, а не два промпта.
  3. `PlaceGreeneryTile.execute` / `PlaceOceanTile.execute` — первым делом (бэспоук-карты и бонусы, которые деферят их
     сами: Colony `:910`, Water Hauling, Aquifer Pumping, Water Import, Comet Aiming, Directed/Icy Impactors (для
     `creditedPlayer`), Hellas-бонус `Game.ts:2794`, бонус 0 °C — последний недостижим под законом, но вход один и тот же).
  4. `ConvertPlants.action` — вместо `createMarsSelectSpace`: цена 8 растений списывается, единица перехватывается (под
     законом — `canAct` без гейта клетки). `ConvertHeat` — через вход 1 (ничего своего).
  5. Стандартные проекты Greenery / Aquifer (`payAndExecute` pay-on-commit → `StandardProjectPlacement`): под законом
     клетки не спрашивать — `commit` сразу (оплата → перехват); Asteroid — через вход 1. Превью строк — §A5.
  6. `Game.grantSpaceBonuses` OCEAN / TEMPERATURE_4MC — через входы 3/1 после оплаты (покупка состоится, результат — data;
     досье клетки предупредило — `placementFacts`).
  7. Финальное озеленение (`takeNextFinalGreeneryAction` → конвертация) — через вход 4 (Р2).
  8. Бэспоук `createMarsSelectSpace` с `tileType` GREENERY/OCEAN в скоупе, минуя `Place*Tile`: `PolderTechDutch`,
     `DesperateMeasures` (ares), `Arboretum`, `EcologicalExperiment` — пройти КАЖДЫЙ; остальные callers (`LandClaim`,
     `MiningCard`, `ArcadianCommunities`, `KaguyaTech`, `MarsNomads`, `StJosephOfCupertinoMission`) тайлов озеленения/океана
     не кладут — подтвердить чтением, не угадыванием.
- **СТРАХОВКА — `Game.addGreenery` / `Game.addOcean`:** если вызов дошёл сюда для участника под законом в не-SOLAR фазе
  (пропущенный вход), тайл всё равно НЕ ложится — единица перехватывается здесь (правило исполняется безусловно), а в
  тестовом режиме это **падение** (`assertNoDivertedAtNet` — счётчик, который гард-свип требует равным 0): игрок, выбравший
  клетку зря, — дефект подачи, который ворклист должен назвать, а не правило, которое можно нарушить.
- **ГАРД-ВОРКЛИСТ `tests/parliament/DivertedResearchSweep.spec.ts`** (инвариант 11): под принятым законом с держателем
  прогнать КАЖДУЮ in-scope карту/проект/действие, чьё поведение или бэспоук содержит `global.oxygen/temperature`,
  `ocean`, `greenery` или вызов `Place{Greenery,Ocean}Tile`/`createMarsSelectSpace`(GREENERY|OCEAN) (список строится
  чтением манифестов + статическим grep по исходникам, как `actionPromptCoverage`), и утверждать: параметр не сдвинулся,
  тайла нет, `SelectSpace` НЕ был выдан, data = печатные единицы, страховка не сработала, один промпт «куда» на операцию.
  Падает с именем карты и места. `LEFTOVER_DIVERT_WORKLIST` — пуст и падает в обе стороны.

### A3 · Накопитель «одна операция — один вопрос»

Диспетчер копит единицы корня (`events.currentRoot()`), первый перехват деферит `AddResourcesToCard(player, DATA,
{count: <читается при execute>, autoSelect: false, cause: {kind:'resolution', resolution: ID}, from: {resolution: ID},
title: 'Choose the card for the data diverted from terraforming'})` с приоритетом **позже всех единиц операции**
(`Priority.BACK_OF_THE_LINE` или свой уровень после `PLACE_OCEAN_TILE`/`DEFAULT` — закрепить спеком на Giant Ice Asteroid:
один вопрос, 4). Накопитель — в памяти обработчика, по id корня, никогда не сериализуется; перезагрузка посреди операции —
как у любого `AddResourcesToCard` внутри действия (ничего своего). Нет держателя — один `skipped` на всю операцию с
суммой (§2.7). Титул ОДИН (ключ выше), источник — маркер `cause` (детекция только по маркеру — инвариант 1); роль
пре-селекта — `role: 'diverted-data'` (§A5).

### A4 · Доступность и «без эффекта» под законом (Р5)

- Снять гейты/предупреждения потолка и клетки ОДНИМ предикатом `ParliamentHandler.divertsTerraforming(player)` (чистый
  запрос, как `cardDiscount`): `ConvertHeat.canAct:48`, `AsteroidStandardProject.canAct`, `Executor.canExecute:83–101`,
  `ConvertPlants.canAct:31`, `GreeneryStandardProject.canAct` + `actionUnavailableReason`, `AquiferStandardProject`,
  `Player.canAfford({tr})` (налог Красных классического Turmoil здесь не стоит — проверить, что `tr`-ветка не блокирует).
- Футильность (`models/actionFutility.ts`): вердикт `parameter-maxed` под законом **не выносится** (шаг = data — польза,
  если есть держатель); без держателя — `no-target` с причиной «No card can hold the diverted data» (ключ); у стандартных
  проектов — `standardProjectFutility:272` тем же предикатом; конвертация тепла — `heatConversionMetadata.futile`.
  Спасения (Whales) под законом не считаются — океан не доходит до Whales.

### A5 · Твины честности — ОДИН выходной проход по превью (`models/divertedTerraforming.ts`)

Закон меняет РЕЗУЛЬТАТ каждого превью, где есть шаг/тайл, и добавляет ВОПРОС «куда» → это не факт прогноза «сверху»
(как `forecast` RX10), а **преобразование самого превью**, в одном месте, для всех семейств сразу (так же, как
`preselectAddresses.ts` — один выходной проход `cardPlayPreview.ts:110` / `actionPreview.ts:48`, + стандартные проекты,
+ метаданные опций конвертаций, + постройка колонии):

1. **Чипы:** каждый `global` oxygen/temperature-чип и каждый тайл-чип озеленения/океана ветки помечается
   `diverted: {resolution: ID, data: N}` (новое поле `ActionEffect`; значок печатный остаётся — читатель рисует его
   ЗАЧЁРКНУТЫМ, рядом `+N [data]`); **подразумеваемый РТ** этих шагов (`withImpliedRating`, `trGain` озеленения Redux
   `GreeneryStandardProject:59`) снимается; `basis`/ПО/соседство тайла не обещаются; `TRSource` превью (`Executor:875`)
   под законом читает 0 для перехваченных шкал (иначе налог/эффекты РТ соврут).
2. **Шаг «куда»:** если N > 0 и держателей ≥ 1 — в ветку добавляется `selectCardStep` по держателям (включая
   `cardBeingPlayed`, если разыгрываемая карта — держатель data) с `for: {source: {kind:'resolution', resolution: ID},
   role: 'diverted-data'}`, титул = титул живого промпта (§A3), ПОСЛЕ собственных шагов карты (живой промпт стоит в конце
   очереди — порядок обещания = порядок чейна). N > 0 без держателей — шаг не добавляется, чип читает потерю
   («N data пропадут — нет карты-хранилища»).
3. **Прогноз (`effectForecast.ts`):** преобразование грантов/тайлов делается ДО `partyFacts`/`scaleBonusPass`/
   реакторов (`:1106–1160`, `:1222`): из `grants` удаляются перехваченные `global`-шаги, из `tiles` — озеленения/океаны;
   иначе Зелёные обещают 2 M€ за РТ, которого не будет, а `scaleBonusPass` — бонус шкалы. Сам закон даёт `exact`-факт
   `source('terraforming-diverted')`: «+N [data] вместо …» (effects = `cardResourceGain`), `timing: 'after-card'`.
4. **`placementFacts`** (досье клетки при размещении города/особого тайла под законом): клетка с бонусом OCEAN /
   TEMPERATURE_4MC → факт «покупка даёт 1 data, не океан/шаг»; клетка с бонусом data — как есть.
5. **`forecast` твина** (обязателен гардом) — тот же факт п.3 (читается из того же прохода, чтобы два пути не разошлись).
6. **Гард `ResolutionContract`:** новая проверка «a diverting passive without its preview pass» (хук `divertTerraforming`
   требует зарегистрированного прохода превью — как `onTilePlaced` требует `placementFacts`).
7. **Гард `actionPromptCoverage`:** четвёртый профиль «закон RX35 принят, держатель есть» — обещание (шаг `diverted-data`)
   = живая цепочка (ровно этот промпт, ни одного `SelectSpace`); + `cardPlayReplayCoverage` в том же профиле.

### A6 · Журнал, события, нотификации, статистика

- Строка на перехват под областью закона: `'${0}: ${1} diverts ${2} (${3}) into ${4} data'` — игрок · резолюция · единица
  («1 step of oxygen» / «a greenery tile» — ключи с числом) · источник (карта/проект) · число; при посадке — обычная строка
  `AddResourcesToCard` «added N data to <card> from <resolution>»; при потере — строка `skipped` с величиной.
- Событие: маркер `effect-triggered` с источником-резолюцией (канал `terraforming-diverted`) + дочернее `cardResource`
  (или `skipped`). `global-parameter-change` / `tile-placed` НЕ пишутся. Агрегаты и факты финала (`endgameFacts`,
  `insightEngine`) — проверить, что перехват не считается ни терраформированием, ни «пропущенным шагом» (чистота — тесты).
- Нотификация зрителя-актора: `lawAnswerNotification` (`notificationModel.ts:213`) уже строит карточку закона из маркера
  с чипами «+N [data]» и X-осмотром резолюции — проверить, что чип появляется (посадка на карту — `impactChips`), и что
  заголовок берёт строку журнала перехвата (первое дочернее сообщение). Чужой зритель: обычная карточка действия с
  чипом data и источником — «Карта: «Перенаправленные исследования»» (память `notification-source-and-glance-rule`).

### A7 · Бот

`BotParliamentPolicy` — аспект `enactment` у бота выключен → диспетчер отвечает `false`; спек: бот поднимает кислород под
законом как обычно (РТ, бонусы), бот-«первый игрок» ничего не меняет; задание «4 data» бот ведёт своей областью data
(Pluto Redux / Миранда и т.п. — `botQuestPath`, «тот же объект по-ботовски»).

### A8 · Задание (Р6)

Спеки: data принятия (3 при влиянии 3) → прогресс 0; перехват в собственном действии (+1) → прогресс 1; data из Pluto Redux
/ Supercomputer / Biological Simulations → как было; кресло — на 4-й; бот — своей областью.

## 5. Блок B · пре-селект и чтения (клиент)

### B1 · Где «куда» собирается ДО нажатия (Р7), где — живым промптом

| Поверхность | Под законом | Как |
| --- | --- | --- |
| Розыгрыш из руки (`ConsolePlayComposer`-семейство) | шаг «куда» в композере, чип зачёркнут + `+N [data]` | проход §A5 → `ConsolePlayedTargetStep` (капсулы держателей, TR53) |
| Действия карт (`ConsoleActionComposer`) | то же | то же |
| Стандартные проекты (`ConsoleStdProjectsScreen`, `consoleStdProjects.ts`) | Asteroid: строка «14 M€ → 1 [data]» + шаг «куда» ВМЕСТО `boardExcursion`; Greenery/Aquifer: без похода на поле | модель `target` = держатель, не клетка |
| Колесо LT · конвертация тепла (`ConsoleSpendHeat`, `turnIntents.ts:203`, `heatConversionMetadata`) | «8 [тепло] → 1 [data]», мини-стадия «куда» (как «когда стол отвечает») | метаданные опции несут `diverted` + кандидатов |
| Колесо · конвертация растений (`findConvertPlantsOption`, `turnIntents.ts:257`) | не открывает поле; «8 [растения] → 1 [data]» + «куда» | структурный признак сервера (не по титулу) |
| Колонии · постройка на Europa | в шаге постройки чип бонуса читает «океан → 1 [data]» + «куда» | бонус-пик бриджа RX09 |
| Бонусы клетки Hellas/Vastitas, награда Water Hauling, TR47, финал | **живой промпт** `AddResourcesToCard` (общий пикер, маркер-источник) | хост по месту: поле → плита TR53 |

Живой промпт — ЗАКОННЫЙ fallback, но он обязан быть тем же пикером TR53 с источником-резолюцией (не дженерик-полосой);
гард `actionPromptCoverage` профиля §A5.7 — для композерных семейств течь запрещена.

### B2 · Чтение чипа «перехвачено»

Один рендер для всех чипов (`actionEffectReading.ts`-семейство): печатная иконка остаётся на месте (игрок узнаёт, ЧТО
карта делает), поверх — красная печать Красных/зачёркивание (язык эмблемы партии, не серый «disabled»), справа —
`→ +N [data]` и имя закона в хинте (`.premium-tooltip()`), без потери читаемости на 4K (лестница rem, иконки масштаба
сцены). Нет держателя — тот же чип с подписью потери. Состояние читается без цвета (вес + зачёркивание).

### B3 · Парламент — что существует бесплатно, что сверить

Панель голосования (семейство `influence` + кикер «Эффект, пока принята» — `quietRewardPose`); стадия НАГРАДА (пикер-бит
RX01 — data летит с печатной иконки лица на капсулу держателя); осмотр; «Ваши эффекты» (плитка закона —
`parliamentEffectsModel.ts`); «Информация › Эффекты» (строка закона первой, с графикой `b.effect`); «Полигон» (сценарии
`influence`: влияние 0 / 3, без держателя). Сверить глазами на 4K: графика «REPLACE … : [data]» в эффект-боксе
читается (текст `REPLACE` в `PremiumMechNode` — RX10 рисовал `x2`; если бокс требует стрелку вместо двоеточия — стрелка
приемлема, это словарь эффект-боксов игры, спеку лица — обновить).

### B4 · Рука/альбом

`cardAvailability.ts`: карты с «+кислород/температура/озеленение/океан» под законом НЕ «бесполезны» и не предупреждают о
потолке (§A4); бейдж причины — не нужен; хинт карты — в сводке эффектов видно «перехват».

### B5 · Финал (Р2)

Сессия финального озеленения (`docs/claude/console/final-greenery.md`, PL-301…307): под законом вопрос — не клетка, а
держатель; строка сессии «8 [растения] → 1 [data]»; отказ — как был; зритель видит data, не тайл. Минимум: честно и без
ломки сессии; полноценная постановка — только если бюджет остался (иначе строка в реестр).

## 6. Блок C · показ — «ПЕРЕХВАТ» как такт коммита (один класс, четыре хоста)

**Фраза сцены:** нажатие A → карта-источник механически фиксируется (универсальный ACTION COMMIT) → импульс бежит по
печатной графике и упирается в иконку шага/тайла → **иконка получает печать Красных** (короткий штамп: красный ободок +
зачёркивание в языке эмблемы партии, одним кадром не появляется — `polish-direction-smoothness`) → **из этой иконки
рождается жетон data** → летит на капсулу держателя (директор TR53: PRESENT · PAY · READ · RETURN; держатель виден в
момент посадки — закон «обе стороны полёта видимы», память `polish-quality-no-regressions`) → счётчик карты тикает на
касании → маркер шкалы и планета **не шевелятся** (`scale-marker-never-lags`: сервер не прислал дельты — парку тактов
поля нечего держать; проверить, что `boardBeatPark` не ждёт шаг шкалы и не держит HUD). Ни одной сцены размещения, ни
одного похода камеры к полю.

- **Хосты:** композер розыгрыша · композер действия · workspace стандартных проектов · мини-стадия колеса (тепло/растения).
  Живой промпт с поля (Hellas) — плита TR53 над полем.
- **Принятие (заседание):** существующий пикер-бит (`consoleResolutionPayout.ts`) — data с печатной иконки лица на
  капсулу. Сверить, что иконка `[data]` на лице резолвится как origin (`resolveGainIconOrigins` — иконка верхнего ряда,
  не иконка из эффект-бокса).
- **Нотификация-карточка закона** у актора (§A6) — чип data, hold X → осмотр резолюции (как RX10 ③/④).
- **Чужой ход:** зритель видит обычную карточку с data и источником; без сцены.
- **4K-кадры (обязательные, `screenshots/parliament-diverted/tv4k/`):** 01 панель голосования (формула + кикер пассива);
  02 композер конвертации тепла под законом (чип зачёркнут → `+1 [data]`, шаг «куда»); 03 раскадровка такта коммита
  (печать → рождение → полёт → тик); 04 карточка закона в ленте; 05 стандартный проект «Астероид» под законом (строка без
  похода на поле); 06 композер карты с 2 океанами (один вопрос, «+2 [data]»). Раскадровка `TM_E2E_STORYBOARD=1`, GPU
  (память `perf-measure-on-gpu-not-swiftshader`), трасса читается как данные (память `storyboard-catches-what-the-probe-passes`).
- **Вердикт по каждому моменту подачи** («что здесь слабо?») — таблица «момент · кадр · что слабо · предложение · класс /
  батч» в отчёте; три лучших предложения — в батч владельцу ПЕРВЫМ с грубыми кадрами ПОСЛЕ.

## 7. Блок D · лицо, локаль, доки

- **Лицо по скану:** строка 1 `b.resource(CardResource.DATA).slash().influence()`; строка 2 — пассив ОДНИМ `b.effect`
  (одна отрисовка на лицо/список эффектов/осмотр — RX10): `text('REPLACE')` · `temperature(1)` · `/` · `oxygen(1)` · `/`
  · `oceans(1)` · `/` · `greenery()` · `:` · `resource(DATA)`. Сноска задания — `[data] ×4` (`questRender:73`).
- **Тексты (английские ключи = i18n; грепнуть по всем `src/locales/<lang>/*.json` до добавления):** `effect` — «Add 1 data
  resource per point of your influence to one of your cards.»; `passive` — «Each step of oxygen or temperature you would
  raise and each greenery or ocean tile you would place becomes 1 data resource on one of your cards instead — even when
  the parameter is at its maximum.»; `quest` — «Add 4 data resources to your cards». Причины пропуска, титул пикера,
  строки журнала — ключи в `ru/parliament.json` (TR → РТ, ПО, метка; data → «данные/данных» как `parliament.json:395`).
  Канон глоссария — `docs/claude/parliament-glossary.md`; гард `parliamentGlossary`.
- **Доки:** `docs/TURMOIL_REDUX_DIVERTED_RESEARCH.md` (контракт: род хука, входы движка, страховка, накопитель, проход
  превью, решения Р1–Р7); `parliament-resolution-checklist.md` — новый раздел «ЗАМЕНЯЮЩИЙ ПАССИВ — перехват ДО мутации,
  накопитель, проход превью, гард-свип (RX35)» + строка в §1.7; спек §4.1 — строка каталога `**A · СДАНА RX35**`,
  §4.1.1 — задание `cardResource DATA ×4` ✓; `.claude/rules/game-logic.md` — короткая форма (род хука); журнал
  `parliament-sitting-progress.md` — запись RX35 с «Прогонами»; реестр — раздел BJ; память — одна запись
  `turmoil-redux-diverted-research` (+ строка в `turmoil-redux-history-index`).

## 8. Бюджет проверки

- **Серверные юниты (`tests/parliament/DivertedResearch.spec.ts`):** принятие — data = влияние на выбранную карту; 0 влияния /
  нет держателя — два разных нуля; перезагрузка между принятием и ответом. Пассив — кислород/температура через карту,
  стандартный проект, конвертацию: параметр стоит, РТ стоит, data = шаги, 2 M€ Зелёных нет, бонус шкалы 8 % не крест;
  «даже на максимуме» (14 %, 9 океанов — Whales без животного); печатные шаги (13 % + 2 → 2); озеленение = 1 (не 2), карта
  «+O₂ и озеленение» = 2; Lake Marineris / Giant Ice Asteroid — ОДИН вопрос; нет держателя — названная потеря с суммой,
  действие не заблокировано; Р5 — гейты сняты; Hellas 6 M€ → data; Europa → data; Icy Impactors — кредитуемый; Flooding —
  без кражи; Arboretum — 0 + 1; TR47 — подъём data, обратный ход вниз; WGT и `unrewarded` не перехватываются; понижения
  нет; Венера нет; `tr` нет; бот — как был; RX23 после RX35 — победитель с температурой; финал под законом (Р2); задание
  (§A8); события (§A6); страховка `assertNoDivertedAtNet` = 0 в свипе; **`DivertedResearchSweep`** по всему скоупу;
  `ResolutionContract` 6/6 + новая проверка; `actionPromptCoverage` / `cardPlayReplayCoverage` — профиль закона; чистота
  прохода превью (`purity`-спек: сериализация до/после).
- **Клиентские юниты (mochapack):** чтение чипа «перехвачено» (зачёркнут + data, без держателя — потеря); шаг «куда» в
  композере с `for`; строка стандартного проекта под законом; метаданные конвертации; панель голосования (формула, кикер);
  плитка «Ваши эффекты»; `parliamentGlossary`; `e2eLiveness`.
- **РОВНО ОДИН новый e2e `tests/e2e/console-parliament-diverted.spec.ts`** (профиль standard-1080 + те же кадры на tv4k
  раскадровкой): фикстура `parliament-diverted-enacted` (закон принят; красный открывает поколение 2 с 30 M€, 8 тепла,
  держателем data на столе — Supercomputer/Biological Simulations; кислород 13 %); журнал: ① «Информация › Эффекты» —
  строка закона первой; ② колесо → конвертация тепла → мини-стадия «куда» → A → шкала температуры НЕ сдвинулась
  (пробник по `/api/player` + DOM шкалы), data на карте +1, жетон родился в rect иконки и сел на капсулу (трасса: верхняя
  кромка ≥ 0); ③ карточка закона «Сработал эффект» с «+1 [data]», hold X → осмотр резолюции; ④ стандартный проект «Астероид»
  → строка «→ 1 [data]», без похода на поле, data +1. Фикстуру править точечно (`FIXTURES=… npm run e2e:fixtures`), свой
  снапшот (`npm run e2e:snapshot <task>` + `TM_E2E_ROOT`), `npm run e2e:affected` перед коммитом UI, `preselectGuard` в спеке.
- **Старые сюиты целиком не гонять**; соседи по маршруту (конвертации `console-futile-actions`, `console-parliament-craze`,
  `console-parliament-medical`, std projects, final greenery) — только затронутые.

## 9. Полировка по пути (≈ 20 %, после P0) — кандидаты «глазами не подтверждено»

- `heatConversionMetadata` (`ConvertHeat.ts:24–45`) и колесо LT: сегодня мини-стадия встаёт «когда что-то реагирует»;
  под законом реагирует ВСЕГДА — проверить, что мини-стадия и «одно нажатие» не спорят, а переход в неё — не моргание.
- Чипы предупреждений `maxtemp`/`maxoxygen` в альбоме руки и в композере (`Executor.ts:83–101`, `cardAvailability.ts`) —
  PL-409 (баг предупреждений Луны в Executor, открыт) — если маршрут задет, закрыть классом.
- Пикер «куда» (TR53-плита) — К-R8 «резолюции» (PL-426) открыт: пикер с источником-резолюцией должен рисовать источник
  как закон (эмблема партии + имя), не как карту.
- Такт коммита при результате-ресурсе на карту с ОДНИМ держателем: проверить, что READ-пауза (240 мс) и возврат не
  слипаются с нотификацией закона (два такта внахлёст — слабость из списка §7 чеклиста).
- «Информация › Эффекты»: строка закона с графикой `REPLACE …` — проверить плотность на 4K (эффект-бокс с текстом + 5
  иконок в одной строке списка).

## 10. Режим работы

Экономный, 3–4 коммита (A сервер+гарды · B превью/пре-селект/чтения · C показ+e2e · D доки/локаль), каждый зелёный по
юнитам; `npm run lint`, `npm run build:test` (обязателен — тесты тронуты), `npm run make:cards`, `npm run make:json`,
`npm run make:css` перед визуальной проверкой. **Не пушить.** Гочи: `python3` на машине — заглушка Store, только `python`
(скрипты файлом); `cross-env` в bash нет — `NODE_ENV=… npx mochapack`; посевная колода сдвигается с ростом каталога —
сажать карту через `seatResolution`; heredoc > ~6 КБ в Bash обрезается — большие файлы через Write; RTK-хук ест `\\` в
heredoc-патчах — такие места Edit-инструментом; тяжёлые процессы рядом с e2e — последовательно.

## 11. В отчёте

Подтверждение, что перехват — ОДИН диспетчер и ОДИН проход превью (и сколько входов движка понадобилось — ожидание: 8);
результат гард-свипа (сколько карт/проектов/действий прошло, что в ворклисте и почему); как повёл себя пре-селект в
каждом из пяти композерных семейств и где остался живой промпт; шесть кадров 4K с вердиктами; таблица слабостей
подачи; решения Р1–Р7 — что принято по умолчанию, что владелец изменил; новые ключи i18n; перечень собственных находок
полировки сверх §9.

## 12. Нельзя

Детектировать промпт/перехват по тексту заголовка (только маркеры/каналы). Делать перехват ПОСЛЕ факта (хук на
`onTerraformRatingGained`/`onTilePlaced` — тайл уже лёг, РТ уже вырос). Ставить замену ПОСЛЕ проверки потолка. Ловить
каждый caller своей веткой без диспетчера. Перехватывать Венеру, голый РТ, понижения, ход Мирового правительства, бота.
Отдавать data «автоматом» на единственного держателя (`autoSelect: true`). Объявлять `spread`. Выдавать по вопросу на
единицу внутри одной операции. Блокировать действие из-за отсутствия держателя (потеря — названная). Оставлять чипы
превью с «+1 O₂ +1 РТ» под законом. Двигать маркер шкалы/планету на перехвате. Рисовать результат «из ниоткуда» (жетон
рождается в rect печатной иконки, держатель виден на посадке). Гонять старые сюиты целиком. Пуш и красные коммиты.
