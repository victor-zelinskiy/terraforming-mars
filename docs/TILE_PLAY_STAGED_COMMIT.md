# Отложенная фиксация розыгрыша карт с тайлами (STAGED PLAY) — исследование

**Статус: решение УТВЕРЖДЕНО владельцем 2026-09-06, реализация в работе.** Дата исследования: 2026-09-06.

**Утверждённые решения (D1–D5):**
- **D1** — добор-до-размещения (Large Convoy, Convoy From Europa, Experimental Forest, Kaguya Tech): единый staged-путь, добор раскрывается ПОСЛЕ подтверждения клетки (вариант «а» §9.1).
- **D2** — multi-tile: **commit = первая клетка**; вторая — живой промпт (§9.2 v1).
- **D3** — фиксированные клетки: мгновенный розыгрыш ТОЛЬКО для внеполевых слотов (`SpaceType.COLONY`: Ganymede, Phobos, Stanford Torus, Luna Metropolis, Dawn City, Stratopolis, Maxwell Base). **Noctis City (клетка НА сетке) идёт staged-путём**: единственная клетка показывается на поле залоченным ретиклом с досье (рядом Ares-зоны и т.п.), подтверждение отправляет обычный батч БЕЗ space-хвоста (сервер кладёт город сам — `NoctisCity.ts` direct `addCity`), B возвращает в workspace.
- **D4** — оппонентам ничего не сигналим (staging не публикует ничего).
- **D5** — действия синих карт: staged-путь будет, но ОТДЕЛЬНОЙ итерацией.

Цель: сохранить привычную последовательность «розыгрыш карты → переход на поле → размещение тайла», но сделать выбор клетки **последним обратимым шагом**: B на поле возвращает в workspace розыгрыша с сохранёнными настройками; необратимость наступает только на подтверждении клетки; успешный сценарий заканчивается на поле, с эффектами и полётами ресурсов **от размещённого тайла**.

Всё в §1–§3 — **факты из кода** (проверено 2026-09-06). §4+ — проектирование.

---

## 1. Почему сегодня возврат невозможен — причинная цепочка (факты)

### 1.1 Клиент

1. «Разыграть» → `ConsoleShell.onPlayCardConfirmNative` (`ConsoleShell.vue:13192`): `buildPlayCardBatch` → `armPlayedHero` (инертен до ответа) → `claimPlayOutcome` → `setWorkspaceFramePhase('hand','executing')` (`:13278`) → **`submitBatch(batch)` (`:13279`) — точка невозврата клиента**. С этой строки B мёртв (`backVerbFor('executing') === 'none'`, `consoleWorkspaceFlow.ts:123`).
2. Ответ сервера несёт новый `waitingFor: SelectSpace`. Hero-сцена завершает флоу (`endPlayCardFlow`), rising edge `placementActive` делает `goBoardHome() + closeConsoleLayers()` (`ConsoleShell.vue:9307-9310`) — **workspace уничтожен, не припаркован** (yield-в-поле умеет только `hydro`: `consoleWorkspaceStack.ts:313`).
3. `space`-промпт не сворачивается: `taskMinimizable('space') === false` (`consoleTaskRouter.ts:373-403`, «always-mounted surface, нечего восстанавливать»).
4. B на поле (`ConsoleShell.vue:12484-12502`): `committing` → проглочен; `locked` → unlock; `navigate` → `cancelPlacement()` **только при `placementContext.cancellable === true`**, иначе честный notice «размещение обязательно». `cancelPlacement()` = `submitInput({type:'cancel'})` (`gameTransport.ts:422-424`); сервер принимает cancel только при `cancellable && onCancel` (`SelectSpace.ts:144-151`).
5. `createMarsSelectSpace` **по умолчанию ставит `committedPlacement('…already underway and cannot be cancelled')`** (`marsSelectSpaceHelper.ts:117-120`). Для карточных размещений это честно — см. 1.2.

### 1.2 Сервер — первая необратимая мутация

`POST player/input-batch` → `replayBatch` → `player.process` → `SelectProjectCardToPlay.payAndPlay` → `Player.checkPaymentAndPlayCard` (чистая валидация) → `Player.playCard`:

- **`events.beginAction(…, {category:'card-play'})` (`Player.ts:1279`)** — первая запись в сериализуемый `game.events.events`;
- **`this.pay(payment)` (`Player.ts:1300`)** — первая rules-visible мутация: ресурсы списаны (`Stock.ts:45`);
- `game.log('${0} played ${1}')` (`:1317`) → `gameAge++` → оппоненты уже поллят `REFRESH`;
- **`selectedCard.play(this)` (`:1344`)** — весь on-play `behavior` исполняется синхронно: production/stock, добор карт, **глобальные параметры, TR** (`Executor.ts:426-522`); размещения деферятся (`Executor.ts:626-658`);
- карта из руки (`:1350-1356`), в `playedCards` (`:1362`) — **метки уже считаются**; `onCardPlayed`-триггеры (`:1380-1382`).

Очередь деферов дренится до `PlaceTile.execute()` → `SelectSpace` → `setWaitingFor` → `notifyStateChange()` (`DeferredActionsQueue.ts:144`). **Отката нет нигде**: catch роутов пишет 400 и всё (`PlayerInput.ts:121-139`); `Player.process` восстанавливает только `waitingFor` (`Player.ts:2846-2853`); батч нетранзакционен (`deferredInputBatch.ts:95-139` — упавший хвост паркуется/отбрасывается, применённое остаётся).

**Вывод:** к моменту, когда игрок видит поле, розыгрыш применён полностью, кроме самого тайла. Граница необратимости — HTTP POST розыгрыша, потому что серверная модель исполнения — «play = синхронная транзакция без отката, тайл = отложенный хвост».

### 1.3 Смежные факты, важные для дизайна

- **Save-гранулярность**: `game.save()` — только по завершении действия (`Player.ts:2411-2425`), при `undoOption:false` — раз в раунд. Внутри действия сохранений нет. Deferred-очередь **не сериализуется** (`Game.ts:604`), перезагрузка процесса mid-`SelectSpace` теряет весь розыгрыш (десериализуется последний save = до розыгрыша).
- **Undo** (upstream) жив: `PlayerInput.ts:57-85` → `GameLoader.restoreGameAt` — «удалить верхние save'ы и пере-десериализовать». Гранулярность не позволяет откатиться «к моменту после розыгрыша, но до тайла».
- **Оппоненты видят всё промежуточное**: карта в таблице, оплата, сырой журнал (`gameAge`-poll + WS invalidate). Атомарно удерживаются только **нотификации** — незакрытый `SelectSpace` держит `openEventCorrelations` (`Game.ts:697-706`, `Player.ts:2867-2869`) и `notificationIngest` стэшит цепочку в PREPARING до закрытия.
- **Готовый прецедент нужной семантики — `StandardProjectPlacement`** (`deferredActions/StandardProjectPlacement.ts`): pay-on-commit, `cancellablePlacement` + `onCancel → pendingPlacementCancelled` (игрок возвращается в меню действий без потерь, `Player.ts:2603-2613`), фильтрация клеток по `canAffordOptions` (деньги проекта ещё в стоке), **re-check доступности на commit** («refused whole», `:88-99`), «ноль оплачиваемых клеток = отмена без потерь» (`:66-74`). Применён ровно к трём std-проектам (City/Greenery/Aquifer) + ConvertPlants; к розыгрышам карт — никогда.
- **Батч-механика** уже умеет «ответ на ещё не заданный промпт»: `reconcileBatchResponse`, парковка хвоста (`parkedTails`), `hiddenInfoPrompt` — хвост никогда не скармливается промпту о скрытой информации (`deferredInputBatch.ts:103-115`).
- **Превью строго read-only** и переиспользует реальные правила (`BoardInformationEngine`, `placementCostFacts` → `MarsBoard.placementCostInfo`; `withHypotheticalTile` восстанавливает ровно три поля `simpleAddTile`); `cardPlayPreview` читает `previewSelect*` деферов, но `PlaceTile` своего `previewSelectSpace` не имеет — размещение в превью «documented exception» (post-submit follow-up).
- Клиентские пикеры (`convertPlantsPending`, `taskSpacePending`) — прецедент **клиентского** placement-этапа: `placementCancellable === true` безусловно, B работает, на сервер до подтверждения ничего не уходит (`ConsoleShell.vue:4953-4958`, `:14907-14918`).
- Полёты «от тайла» уже существуют: `ResourceTransferRun.origins` (per-spec), `measureBoardHexRect`, `fromBoard`, `seedTilePlacementRewardHold` (printed+ocean+Ares). **Карточная** reward-волна пока якорится на карту (`consolePlayedHero.ts:788-811`, run на `:607-619` принимает только общий `source` — точка интеграции).
- Reveal умеет ждать размещение на четырёх уровнях: `rawDrawnRevealPending` вычитает `tilePlacementHolds`; `transportHolds.tilePlacementHero` гейтит применение вида; `boardBeatPark`; `animationHold`.

---

## 2. Инвентаризация карт, размещающих тайлы на Марсе (скоуп: base, corpera, promo, venus, colonies, prelude, ares, delta)

| Группа | Состав | Примеры | Механизм | Ограничения для staged-commit |
|---|---|---|---|---|
| **A. Один тайл, безусловный** (~60 карт + ~14 Ares-подклассов; ≈75% декларативные) | города, океаны, озеленения, спец-тайлы | Open City, Domed Crater, Subterranean Reservoir, Plantation, Nuclear Zone, Ocean City | `behavior.city/ocean/greenery/tile` → `Place*Tile` (DEFAULT/PLACE_OCEAN_TILE); bespoke — фильтры легальности (EcologicalZone, IndustrialCenter, GreatDamPromo, BoomTown, LavaTubeSettlement, KaguyaTech, SolarFarm, MiningCard, NoctisCity, UrbanizedArea, ImmigrantCity) | покрывается полностью |
| **B. Несколько тайлов** | Ice Asteroid, Lake Marineris, Giant Ice Asteroid, Great Aquifer (`ocean:{count:2}` → два независимых FIFO-дефера, `Executor.ts:627-630`); PolderTech Dutch (второй SelectSpace **вложен в andThen первого** — легальный набор второго не существует до ответа на первый) | | | v1: **commit = первая клетка**; вторая — живой промпт (существующий chained-flow `placementWorldVersion` watcher). Возврат «от второй к первой» невозможен без серверного отката — продуктовое решение |
| **C. Условное/пропускаемое размещение** | все океаны при максимуме (`PlaceOceanTile.ts:40-48` — тихий skip, Whales +1), Artificial Lake («playable, no effect»), zero-space silent skips city/greenery | | | «Отказаться от размещения» как опции в правилах НЕТ ни у одной карты скоупа. Skip-ветки означают: staged-этап не армится, карта играется мгновенно как сейчас |
| **D1. Эффекты ДО выбора клетки** | глобальные параметры (GiantIceAsteroid temp+2, Comet, TowingAComet oxygen, MoholeLake, NuclearZone, LavaFlows, DeimosDownPromo temp+3, MetallicAsteroid, MagneticFieldGenerators tr:3); атаки-растения (elevated `PLAY_CARD_PLANT_REMOVAL` — форк-приоритет); resource-choices (elevated `PLAY_CARD_RESOURCE_CHOICE`); **добор ДО клетки: Large Convoy (2), Convoy From Europa (1), Experimental Forest (reveal-until-2-plant-tags), Kaguya Tech (1)** — добор синхронный в `Executor.ts:473-499`, деферных `DrawCards`-перед-`PlaceTile` в скоупе нет | | | атаки/choices уже пре-собираются композером (coverage-страж «0 gaps») — при staged-commit исполняются на commit, обратимы by construction. **Добор — единственный конфликт скрытой информации** (см. §9.1) |
| **D2. Эффекты ПОСЛЕ клетки** | ImmigrantCity/UrbanizedArea/NoctisCity (−production в andThen), SolarFarm (production от клетки), MiningCard (space → выбор steel/titanium → только потом addTile), Flooding (украсть 4 M€ у соседа, с опцией skip), DesperateMeasures (параметр решается клеткой), PolderTech | | | всё post-commit, живые промпты поверх поля — не мешает |
| **E. Фиксированная клетка без выбора** | Ganymede, Phobos, Stanford Torus, Luna Metropolis, Dawn City, Stratopolis, Maxwell Base (`behavior.city.space` → **мгновенный `addCity`**, `Executor.ts:634-643`); Noctis City на картах с его слотом | | | выбора нет → staged-этап не нужен, текущее поведение (рекомендация; см. §9.3) |
| **F. Спец-требования легальности** | NaturalPreserve (isolated), MoholeArea (on ocean), LavaFlows (volcanic), Capital (city-rules), DeimosDown (away-from-cities), NewHolland (upgradeable ocean + city rules), EcologicalZone (adjacency к СВОЕМУ озеленению — требование карты гарантирует существование) | | | легальный набор — функция живого поля, вычислим до розыгрыша тем же кодом, что `canExecute` |
| **G. Легальность зависит от денег** | Ares-стоимости: `Board.canAfford` складывает цену КАРТЫ и цену КЛЕТКИ в один план на этапе `canPlay` (`Executor.ts:193/205/213` с `canAffordOptions`); сами `Place*Tile` считают уже БЕЗ card-cost (карта оплачена). ImmigrantCity/Noctis/Urbanized — energy-coverage фильтр (`MarsBoard.filterForEnergy`) | | | превью staged-набора обязано считать с `canAffordOptions` (cost-inclusive) — точный паттерн `StandardProjectPlacement.placementCanAffordOptions` |
| **H. Другие игроки** | onTilePlaced-фанаут (Philares — ПРОМПТ другому игроку, Arctic Algae, Rover Construction, Tharsis, StJoseph — промпт другому); **Icy Impactors — сам SelectSpace уходит `game.first`, не актору** | | | фанаут = post-commit (после тайла) — не мешает. Icy Impactors естественно вне staged-скоупа (промпт не у актора) |

**Информация, раскрываемая до выбора клетки:** только группа добора D1 (4 карты). **Мутации других игроков до клетки:** только elevated plant-removal (4 карты) — при staged-commit уходит за границу commit. **Глобальные параметры до клетки:** 9 карт — аналогично.

---

## 3. Ключевой вывод исследования (факт → следствие)

Текущая необратимость — не «анимация принимает решение», а серверная модель: **розыгрыш = одна синхронная транзакция без отката, у которой тайл — отложенный хвост**. Любое решение — это выбор, *где держать незакоммиченный розыгрыш*:

1. на клиенте (ничего не отправлять до клетки),
2. на сервере как подготовленное действие (обобщение pay-on-commit),
3. в прошлом (snapshot/rollback поверх undo-механики).

---

## 4. Сравнение вариантов

### Вариант 1 — STAGED PLAY на клиенте: «клетка = хвост батча» ✅ рекомендуется

«Разыграть» **не отправляет ничего**. Клиент входит в staged-этап: презентационный перелёт карты + поле в pre-play placement-режиме (легальный набор — с нового read-only превью сервера). Подтверждение клетки отправляет **существующий** батч с добавленным хвостом `{type:'space', spaceId}` (для B-группы — только первая клетка). Сервер исполняет розыгрыш в **неизменном порядке правил**, `replayBatch` доводит пре-собранные шаги и клетку до их промптов.

- **Корректность:** до commit ни одной мутации/записи/нотификации/раскрытия — «отмена без последствий» выполняется **by construction**, доказывать нечего. Порядок правил не тронут (исполняется старый серверный пайплайн). Идемпотентность — существующие `runId`+`promptId` (+`STALE_PROMPT`-recovery). Отказ хвоста (клетка устарела) = штатная деградация батча: розыгрыш применён, живой `SelectSpace` всплывает → текущее (сегодняшнее) поведение как fallback.
- **Переиспользование:** батч-машинерия, композер и пре-коллект, `placementFlow` (navigate→locked→committing), `ConsoleBoardInput`-воронка, клиентские пикеры (прецедент cancellable client placement), `yieldStackToBoard` (прецедент «стек уступает полю и возвращается»), tile hero + `seedTilePlacementRewardHold`, reveal-парки, abort-батарея.
- **Сложность:** умеренная. Сервер: только read-only превью (`previewSelectSpace` у `Place*Tile` + cost-контекст в board-cell-preview). Клиент: новая реверсивная фаза + staged-хореография.
- **Слабости:** staged-состояние живёт только на клиенте (F5 = возврат к руке; ничего не потеряно — честно); легальный набор в staged-этапе приходит из превью, а не из живого `waitingFor` → обязателен страж «превью-набор == реальный SelectSpace-набор» и деградация при расхождении.

### Вариант 2 — серверный prepared play (обобщение `StandardProjectPlacement` на карты)

Сервер откладывает весь `checkPaymentAndPlayCard` в cancellable-обёртку: сначала `SelectSpace` (cancellable, `onCancel` → назад в меню, ничего не потрачено), commit = исполнить розыгрыш + автоскормить клетку.

- Плюсы: промпт-истина на сервере (легальный набор в `waitingFor`), staged переживает F5 (в пределах жизни кэша), отмена — серверно видимое событие.
- Минусы: хирургия play-пайплайна (`playCard` рассечь на prepare/commit; деферу `PlaceTile`, созданному ВНУТРИ commit, нужно передать заранее выбранную клетку — фактически внутренняя реализация всё равно сводится к «replay клетки», т.е. к варианту 1, но серверными руками); пре-собранные шаги композера надо где-то держать до commit (та же WeakMap-несериализуемость); информационная структура для игрока **идентична варианту 1** (добор всё равно уезжает за commit). Итог: платим большой серверной сложностью за F5-устойчивость этапа, который и так свободно отменяем.

### Вариант 3 — snapshot/rollback (исполнить по-настоящему, cancel = undo к save перед розыгрышем)

Механически прост (save перед play + `restoreGameAt`), но **доказуемо течёт**:
- **скрытая информация**: Large Convoy — игрок увидел 2 добранные карты, отменил, разыграл иначе = чит;
- **публикация**: `gameAge++`/WS уже разослали промежуточное состояние; оппоненты видят розыгрыш и его исчезновение; журнал/ивенты пришлось бы глушить отдельной незиданной механикой;
- пейсинг бота, кампания, `undoCount`-семантика. Отклонён как ядро.

**Рекомендация: вариант 1.** Он единственный, где все восемь требований §3 задания выполняются структурно, а не проверками.

---

## 5. Модель состояний (вариант 1)

| Фаза | Что на экране | B | Публикация |
|---|---|---|---|
| `browse` / `configure` | workspace, композер | close / back (как сейчас) | ничего |
| **`staging` (новая, реверсивная)** | карта визуально ушла в игровую зону (staged-полёт), workspace уступил полю (yield, не destroy), поле в pre-play placement (ретикл, relation-marks, досье с честными Ares-стоимостями) | **navigate → возврат в workspace** (обратный перелёт, композер восстановлен из module-draft: карта, оплата, выборы, фокус); **locked → unlock** | ничего: ни запроса, ни журнала, ни нотификаций, ни WS-события |
| `staging/locked` → второе нажатие | воронка `confirmPlacement` | — | — |
| **`committing`** | placementFlow `committing` поглощает ввод; POST батча | **none** (проглочен — гонка «отмена vs подтверждение» исключена конструктивно) | один POST |
| отказ сервера (400) | abort-батарея: `rollbackPlacementCommit` → `staging/locked`, workspace ещё восстановим; `STALE_PROMPT` → форс-`updatePlayer` | как в staging | сервер ничего не применил (голова батча упала) |
| потерянный ответ | 8s safety → locked; `waitForUpdate(true)` в finally приносит истину; если сервер принял — staged-этап **инвалидируется положительным фактом** (карта в `tableau` / смена `promptId`) и флоу продолжается как принятый. «Успешная отмена» после принятого коммита невозможна: B в committing проглочен, а выход из committing происходит только по выясненному исходу | — | — |
| **`committed`** | tile hero (полёт тайла) → печатные бонусы клетки → Ares/ocean-adjacency → **карточные награды ОТ ТАЙЛА** → follow-ups (вторая клетка B-группы, resource-pick MiningCard, Flooding-выбор, reveal добора поверх поля) | обычные правила обязательного завершения; collapse где положено | всё публикуется одним принятым ответом; нотификации, как и сегодня, соберутся атомарно по закрытию корреляции |

Инвалидация staging: watcher `gameStateVersion` (мир сдвинулся — бот, второй клиент) → пере-fetch превью; исчезнувшая легальность → честный notice + возврат в workspace.

---

## 6. Контракт клиент ↔ сервер

**Новое (read-only, по чек-листу endpoint'ов):**
1. `cardPlayPreview` расширяется секцией `placements[]`: `{step, placementType, tileType, sourceCard, placementEffect, legal: spaceId[], illegal: {id, reason}[]}` — считается `previewSelectSpace()`-хуками `PlaceTile/PlaceCityTile/PlaceGreeneryTile/PlaceOceanTile` (паттерн `previewSelect*` уже существует), теми же `getAvailableSpacesForType` + `computeIllegalReasons`, **с cost-inclusive `canAffordOptions`** (прецедент `StandardProjectPlacement`). Ноль легальных клеток при живом `canPlay` невозможен (canPlay это уже гарантирует), но превью обязано отражать skip-ветки (ocean-max → секции нет).
2. `board-cell-preview` получает параметр pre-play контекста (карта не оплачена: affordability и `cannot-afford` — против остатка ПОСЛЕ цены карты). Кэш-ключ расширяется.

**Отправка:** существующий `player/input-batch`, `responses = [projectCard+payment, …pre-collected steps, {type:'space', spaceId}]`. `promptId` головы — от меню действий (как сейчас). Никаких новых мутационных endpoint'ов.

**Опциональное ужесточение (фаза 2, по желанию):** пометка батча `finalizesPlacement: true` — сервер, зная это, может прогнать голову только после «сухой» валидации хвоста… — отклонено в v1: честная деградация (живой промпт) достаточна и проще, а полная транзакционность батча — та самая переработка движка, которую задача запрещает.

---

## 7. Точки интеграции (клиент)

- `consoleWorkspaceFlow.ts` — фаза `staging` (реверсивная, между `configure` и `executing`); `backVerbFor('staging') = 'back'`.
- `ConsoleShell.onPlayCardConfirmNative` — ветка: превью объявляет мандатное Mars-размещение для актора → вместо `submitBatch` войти в staging (yield стека по прецеденту `yieldsToBoard`; батч сохранён в staging-store).
- Staging-store (module-level draft, прецедент `consoleCardActionsUi.draft`): собранный батч + капчи композера (для восстановления по B и после F5-невосстановления — честный сброс).
- `ConsoleShell.placementActive` — третий клиентский вид placement (`stagedPlayPlacement`), `placementCancellable = true`; легальный набор из превью → `ConsoleBoardInput.wireBoard`/`animateSpaces` (интерфейс «набор клеток» уже отделён от `waitingfor`ного через `taskSpacePending`-путь).
- `ConsoleBoardInput.confirmPlacement` — в staged-режиме воронка ведёт не в `submitInput({space})`, а в `submitBatch(stagedBatch + spaceTail)`; `beginPlacementCommit` и abort-батарея без изменений.
- `consolePlayedHero` — staged-режим сцены: пре-commit половина (лифт/арка/посадка) играет на «Разыграть» и **обратима** (реверс по B, `onInterrupt`-восстановление); на принятом ответе `detectPlayedHero` не переигрывает полёт, а стыкуется к result-битам. Reward-волна карты получает `origins` от тайла + `fromBoard` (run на `consolePlayedHero.ts:607-619` — расширить сигнатуру).
- Порядок сцен на принятом ответе: tile hero (печатные бонусы/adjacency от тайла — уже так) → карточные награды от тайла → reveal добора (уже ждёт `tilePlacementHolds`) → follow-up промпты. `endPlayCardFlow`/`concludeWorkspaceFlow` — конец на поле (workspace уже уступлен, не возвращается).
- Стражи присутствия: leak-detector регистрация staged-поверхности; `actionBlockedReason` называет staged-размещение; нотификации в staging тихи (нечего показывать — ничего не произошло).

---

## 8. Хореография (целевая)

1. «Разыграть» → карта уходит staged-полётом на свою стопку (та же кинематика, что сейчас, но без серверного факта), workspace растворяется к полю (yield), крошка гаснет вместе с ним.
2. Поле: ретикл, relation-слой и досье — как в сегодняшнем placement (тот же превью-канал), с честными Ares-стоимостями против остатка после цены карты.
3. B: поле отпускает, workspace разворачивается из парка, карта возвращается обратным перелётом на свою позицию в композере; выборы/оплата/фокус целы; без дублей и повторных вступительных битов (staged-сцена знает, что уже играла).
4. Подтверждение клетки (двухфазный lock → commit, `tm_place_confirm` уважается) → `committing` → POST.
5. Принято: тайл-прокси летит и садится (существующий hero), бонусы клетки платят от тайла, карточные награды **материализуются от тайла** в рельсу, счётчики тикают на касании; добор раскрывается поверх поля после сеттла; follow-up промпты по очереди (`consolePromptAdmission`). Конец — на поле.
6. Отказ: откат к `locked` (клетка подсвечена, onclick'и перевзведены), alert с причиной; B по-прежнему возвращает в workspace.

---

## 8-bis. Анимационная подача начислений — «карта против клетки» (утверждаемый дизайн)

Требование владельца: начисления должны ощущаться премиально, и должно быть ЧИТАЕМО,
что эффект идёт от КАРТЫ, а что — от размещения тайла (бонус клетки = «забор с поля»).

**Закон одной фразой: всё, что дало ПОЛЕ, поднимается ИЗ-ПОД тайла; всё, что дала
КАРТА, рождается НА тайле из её собственной печатной графики.** Источники разведены
трижды: геометрически (под тайлом / над тайлом), во времени (последовательные биты,
никогда не interleaved) и грамматикой движения (существующая хореография «значки
из-под тайла» против грамматики universal ACTION COMMIT «импульс по печатной графике →
награда из собственных значков»).

### Полная последовательность

1. **Staging — НАСТОЛЬНЫЙ РИТУАЛ: карта ложится на стол (ПЕРЕСМОТРЕНО 2026-09-06,
   реализовано).** В настолке порядок «карта в tableau → тайл на поле», поэтому по
   «Разыграть» играет ПОЛНАЯ посадочная церемония как в старом флоу — лифт из
   композера → дуга → посадка на семейную стопку receiving stage (~1.6 с +
   320 мс read) — но БЕЗ сервера: это пре-commit половина той же hero-транзакции
   (`runStagedPlayedLanding` в `consolePlayedHero.ts`: consume arm, no detect,
   no reveal — прокси И ЕСТЬ лежащая карта, no reward beat, счётчики НЕ тикают).
   Затем handoff: workspace уступает полю, прокси растворяется ВМЕСТЕ с его
   уходом (`finishStagedPlayedLanding` — никогда одинокая карта над полем и
   никогда опустевший слот под стоящей сценой). Ввод на время бита поглощается
   фазой 'executing'; срыв церемонии = обычный abort ('failed' перевзводит CTA,
   композер цел, розыгрыш честно «не сделан»). Во время выбора клетки источник
   виден в досье (`placementSourceView` + L3) — как и в старом флоу, где стол
   тоже уходил с экрана. **B = workspace поднимается и композер восстанавливается
   штатным entrance со всеми капчами** (обратный перелёт «со стопки» сознательно
   НЕ играется: стопки в этот момент нет на экране — полёт из ниоткуда хуже
   честного возврата экрана; литеральный reverse — polish-опция, если
   понадобится). Прежний вариант «карта висит в слоте досье» ОТМЕНЁН — это не
   настольный жест. E2e-свидетель церемонии: MutationObserver-проба в
   `console-staged-play.spec.ts` (прокси летел И receiving stage presenting до
   передачи поля — silent no-flight деград роняет спек).
2. **Commit-сцена, полевые биты (существующие).** Полёт тайла-прокси → touchdown →
   **печатные бонусы клетки**: значки, всегда жившие ПОД тайлом, всплывают и
   передаются чипам (текущая хореография «карта из-под тайла» —
   `seedTilePlacementRewardHold`, физика «забора с поля» не меняется) →
   adjacency-биты: ocean-shore pulse от воды, Ares-янтарь от тайлов-соседей.
3. **Новый бит «ПЕЧАТЬ КАРТЫ» (card seal).** Эхо карты отделяется от слота досье и
   коротким снижением садится на размещённый тайл **карточной плашкой** (геометрия
   `tileCoverRect` — прецедент: ares-добор уже ставит карточную плашку в центр гекса,
   см. [[console-ares-adjacency-flights]] board-tile cover). По печатной графике
   плашки проходит **импульс ACTION COMMIT** (тот же язык, что у активаций синих
   карт), и дальше — category handoff той же грамматики:
   - **ресурсы/производство** — reward-волна материализуется ИЗ собственных значков
     плашки (`data-graphic-node`-якоря premium-face) в рельсу, per-spec `origins`,
     счётчики тикают на касании; `fromBoard: true` (волна рождена над полем и обязана
     уступать поверхностям по board-правилам);
   - **глобальные параметры / TR** — глайд шкалы стартует после card-seal бита
     (boardBeatPark уже секвенирует полевые пакеты; источник-точка глайда — плашка);
   - **добор** — «колода отвечает»: импульс с плашки, существующий deck-pull, reveal
     собирается ПОСЛЕ (уже гейтится `tilePlacementHolds`/deckDrawHolds).
   Плашка растворяется В тайл с коротким card-tint afterglow на гексе («тайл =
   материализованная карта»), счётчик семьи в игровой зоне тикает — карта в таблице.
4. **Follow-ups** — вторая клетка (D2), resource-pick (Mining), Flooding-выбор,
   reveal добора — по очереди через `consolePromptAdmission`, поверх поля.

### Правила против «каши»

- Биты НИКОГДА не перекрываются: полевые (2) заканчиваются до card-seal (3);
  внутри (3) волна одна (значки плашки), не смешивается с чипами клетки.
- Провенанс НЕ подменяет причину: журнал/нотификации атрибутируют как раньше
  (карта / бонус клетки / чужой эффект) — плашка и значки лишь координаты рождения.
- Никаких новых подписей-«киккеров» на плашке: карточное лицо само является
  атрибуцией (имя+арт); печатные значки клетки сами являются атрибуцией поля.
- Отказ сервера: карта возвращается из досье в композер тем же обратным перелётом
  (расширение abort-батареи), никакой плашки, никаких чипов.
- Reduced-motion / perf-lite: биты схлопываются в мгновенные чипы + тики счётчиков
  (существующие degrade-пути runResourceTransfers), порядок битов сохраняется.
- Fixed-слот вне поля (D3, Ganymede-семья): текущая auto-tile посадка; card-seal бит
  играет и там (плашка на севшем тайле) — подача едина для всех тайловых розыгрышей.

## 9. Продуктовые решения, которые нужны (конфликты показаны, не спрятаны)

### 9.1 Добор до размещения (Large Convoy, Convoy From Europa, Experimental Forest, Kaguya Tech)
Полная отмена + бумажный порядок информации несовместимы: по правилам игрок видит добор до выбора клетки, но «увидел → отменил» = чит.
- **(а) рекомендуется:** единый staged-путь; добор раскрывается ПОСЛЕ подтверждения клетки (сервер исполняет в правильном порядке — меняется только момент показа игроку). Игрок видит строго МЕНЬШЕ, чем мог бы по правилам — консервативно, читов нет; на выбор клетки эти карты влияют пренебрежимо (океаны/озеленение).
- (б) для этих 4 карт — старое поведение (commit на «Разыграть», B на поле честно говорит «обязательно»). Точность порядка показа ценой неоднородности UX.

### 9.2 Несколько тайлов (Ice Asteroid, Lake Marineris, Giant Ice Asteroid, Great Aquifer, PolderTech)
v1: commit на первой клетке; вторая — живой промпт (сегодняшний chained-механизм). «Вернуться от второй к первой» требует серверного отката первой — вне рамок. Альтернатива v2 (оба выбора в staged, хвост из двух `space`) возможна для `count:2`-океанов (легальность второй = минус первая клетка), но НЕ для PolderTech (второй набор порождается сервером из первого). Рекомендация: v1, честная крошка «клетка 1 = фиксация».

### 9.3 Фиксированные клетки (Ganymede и семья)
Выбора нет — staged-этап не даёт игроку ничего, кроме задержки. Рекомендация: оставить мгновенный розыгрыш (сегодняшняя auto-tile посадка), инвариант no-auto-select их и так экслюдит как fixed target.

### 9.4 Граница изменения
Staged-путь включается только для: розыгрыш проектной карты (рука/старт-workspace), превью объявляет ≥1 мандатное размещение на Марсе, адресат промпта — сам актор. Всё остальное не тронуто: действия синих карт (Aquifer Pumping, Water Import), std-проекты (уже cancellable!), convert plants, WGT-океан, колонии, bonus-picks, Nomads. Расширение на действия карт — симметричная следующая итерация.

---

## 9-bis. Статус реализации (2026-09-06)

**Сервер (этапы 1–2) — СДЕЛАНО:**
- `StagedPlacementModel` (`src/common/models/ActionPreviewModel.ts`) + `staged?` на
  `boardPlacement`-шаге превью; `title` зеркалит боевой промпт.
- `stagedMarsSelectSpace` (`src/server/boards/marsSelectSpaceHelper.ts`) — read-only
  близнец `createMarsSelectSpace` с cost-inclusive `canAffordOptions`.
- Декларативные карты: авто-обогащение в `cardPlayPreview.ts`
  (`withStagedPlacement`/`stagedForBehavior`, зеркало Executor-блока; исключения:
  colony-coupled, ocean-max, fixed off-grid `city.space`).
- Bespoke: `placementPreview({staged})` + хуки 11 карт (EcologicalZone, NoctisCity
  fixed/обычный, Flooding, IndustrialCenter, GreatDamPromo, SolarFarm, BoomTown,
  LavaTubeSettlement, UrbanizedArea, ImmigrantCity, MiningCard; Ares-подклассы
  наследуют). KaguyaTech НАМЕРЕННО не staged в v1 (replacement-хореография).
- `board-cell-preview?staged=1` — досье ценит Ares-стоимости против денег ПОСЛЕ
  цены карты (гейт `previewableCard`, только сам игрок; фикс
  `placementMegacreditDeficit` — дефицит учитывает `canAffordOptions.cost`).
- Страж паритета `tests/boards/stagedPlacementParity.spec.ts`.

**Клиент (этап 3, v1-скелет) — СДЕЛАНО:**
- `src/client/console/stagedPlay.ts` — staged-состояние (arm/committing) +
  `PlayComposerDraft` (снапшот композера, opaque).
- `consoleWorkspaceStack.ts` — `yieldStackForStagedPlay()` (безусловный yield в
  тот же `boardYielded`) + `discardYieldedStack()` (успех = конец на поле).
- Композер: payload `staged` + `composerDraft`; restore капчей в `applyPreview`
  через one-shot `consolePlayCardUi.stagedDraft`.
- Шелл: третий клиентский пикер `stagedPlayPrompt` (синтетический SelectSpace,
  `placementContext.cancellable: true` + source card) в ОДНОМ резолвере
  `placementSpaceModel` → биндер/ретикл/досье/kicker/planet-focus/L3 работают
  без изменений; `onStagedPlaySpacePicked` (батч + space-хвост; fixed — без
  хвоста); `cancelStagedPlay` (B: resume стека + restore композера);
  `reconcileStagedPlayWorldMove` (мир сдвинулся: карта уже в таблице → finalize,
  иначе отмена + notice); финализация на `placementWorldVersion`.
- Транспорт: `abortStagedPlayCommit()` в abort-батарее.

**Проверено (2026-09-06):** полный серверный сьют 11452✓; страж паритета
`stagedPlacementParity.spec.ts` (72 карты: pre-pay набор == post-pay SelectSpace,
Ares cost-inclusion, skip-семантика); `board-cell-preview` staged-спеки; e2e
`console-staged-play.spec.ts` ЗЕЛЁНЫЙ — play → поле при нетронутом `gameAge` и
карте в руке → B → композер восстановлен → подтверждение клетки = единственный
POST → тайл + таблица → конец на поле. Адаптированы: `console-planet-focus`
(hidden-stage свидетель hand-кейса → информационный: staged открывает поле сразу),
`console-play-landing-probe` (TILE_EVENT-ветка на staged-грамматику).
Card-seal минимум: reward-волна карты летит ОТ ТАЙЛА после hero-битов
(`armStagedSeal`/`seedStagedPlayRewardHold`/`runStagedSealWave`, panel-holds по
закону синхронного сида). CTA при staged: «Разыграть на поле».
Imported Hydrogen / Large Convoy мигрированы (`gainOrAddResourceBranches` →
`withStagedPlacement`).

**Осталось (этап 4+ / residuals):**
- ~~staged-полёт карты~~ **СДЕЛАНО иначе (2026-09-06)**: посадочная церемония в
  «Разыграно» играет ДО поля (см. §8-bis п.1 — настольный порядок); остаётся
  card-seal ПЛАШКА на тайле + импульс ACTION COMMIT + «колода отвечает» от
  плашки (reward-волна от тайла уже есть); литеральный реверс-полёт по B
  (polish; сейчас — штатный restore-entrance композера);
- standalone-band (playFromHand без workspace): без церемонии — посадочной
  сцены там нет; band растворяется прямо в поле;
- ~~анонс второй клетки multi-карт~~ **СДЕЛАНО (2026-09-06)**: серверный маркер
  `followUpPlacements` на первом промпте (staged-превью И живой «первый океан»
  Executor'а — зеркальные; `SelectSpace.toModel` nesting-safe; вторая клетка
  маркера НЕ несёт — отсутствие = «это последнее»). Досье рисует КОНСТАНТНУЮ
  строку-план в шапке (`.con-context__next`, cyan-плашка «Затем ещё одно
  размещение: Океан», `placementFollowUpLine` в placementDossier — от промпта,
  не от клетки → не мерцает при наведении); заголовок «Select space for first
  ocean» демотирован в generic (план-строка говорит это лучше), «second ocean»
  сознательно НЕ демотирован. Стражи: `stagedFollowUpPlacements.spec.ts`
  (staged==live==маркер, второй промпт чист, одиночный океан чист) + e2e
  multi-tile тест в `console-staged-play.spec.ts` (Ice Asteroid: строка на
  первой, отсутствует на второй, обе клетки ставятся);
- границы v1: только hand-корень/standalone (`workspaceStackRootKind()` ≠ start);
  старт-флоу и прелюдии — отдельная итерация (как и синие действия, D5);
- MiningCard tileType-gap (`KNOWN_TILETYPE_GAPS` в parity-спеке — live-промпт без
  tileType, staged Ares-вариантов гадает; фикс co-located в карте);
- ~~KaguyaTech~~ **СНЯТО (2026-09-06 по решению владельца)**: staged-хук добавлен
  (свои озеленения cost-aware + общий reasoner + `hideExistingTile` в staged-модели
  — тот же серверный маркер лицензирует departure-сцену замещения на commit);
  живой промпт заодно получил честный `tileType: CITY` (страж паритета его и
  поймал); e2e `console-tile-replacement` зелёный через staged-путь;
- Olympus-Conference-класс: прерывающий скрытый промпт паркует space-хвост —
  тайл ложится generic-анимацией вместо hero (rules-корректно, only presentation);
- однокадровый standalone-флэш композера при B-restore (teleport-gap до
  републикации зоны) — polish;
- verb нижнего бара («Разыграть») vs CTA «Разыграть на поле» — унифицировать
  через `playPrimaryVerb` ctx.

## 9-ter. Действия синих карт (D5) — СДЕЛАНО (2026-09-07)

Симметричное расширение staged-пути на действия синих карт, размещающие тайл
или двигающие маркер. Тот же закон: «A Подтвердить» в композере НЕ шлёт запрос —
батч (`buildActionBatch`) паркуется, поле открывается синтетическим промптом,
B = чистый клиентский возврат в композер с целыми капчами, подтверждение клетки =
единственный POST `[...batch, {type:'space',spaceId}]`.

**Сервер:**
- `stagedActionPlacement(player, opts)` в `actionPreviews.ts` (без `canAffordOptions`
  — стоимость действия списывается ДО размещения, pre-pay == post-pay по построению,
  задокументировано) + `boardPlacementStep(..., {staged})`.
- Хуки: `AquiferPumping`, `WaterImportFromEuropa` (общий `SELECT_OCEAN_SPACE_TITLE`
  из `PlaceOceanTile`), `CometAiming` (океанская ветка), `MarsNomads` (общий
  `destinationReasoner`, `placementEffect: 'bonus-only'` — перемещение, не тайл),
  `StJosephOfCupertinoMission` (общий `cathedralReasoner`, `'marker'`; заодно снят
  лгавший `tileType`). `IcyImpactors` — принципиальное исключение (клетку выбирает
  `game.first`, актор не размещает — staged некому).
- Секция ACTION в страже паритета `stagedPlacementParity.spec.ts` (byte-equal
  включая `placementEffect`/illegal-reasons/title).

**Клиент:**
- `StagedPlayArm.flow: 'play' | 'action'` + `actionRestore {cardName, nodeIndex,
  composer}`; staged-форк в `ConsoleActionComposer.confirm` ПЕРЕД битом ACTION
  COMMIT (только `publishCommands`, не repeat/stage-reward, корень стека =
  `card-actions`); `stagedComposerSnapshot()`/`applyStagedComposerSnapshot()`
  (selectedPos/капчи/amounts/floaters/payCounts/picks/orDescents/focusIdx).
- `ConsoleCardActions` — relay `@staged-placement` (батч через `buildActionBatch`
  по `performPath`), `mounted` кормит `stagedReturn`/`stagedEntryExists` в
  `actionWorkspaceRestorePlan` (`seat-step`-ветка после repeat/collapsed-гардов;
  поля ОПЦИОНАЛЬНЫ — обязательные сломали существующий клиентский спек).
- Шелл: `onCardActionsStagedPlacement` (flow 'action'), `cancelStagedPlay`
  ветвится по flow (action → `stagedReturn` + resume стека; play — как раньше);
  `reconcileStagedPlayWorldMove` — таблица-свидетель только для flow 'play'.
- Церемония посадки НЕ играет (карта уже в таблице — действию нечего сажать);
  reward-волна card-seal от тайла работает та же.

**Проверено:** build:server/build:test/vue-tsc/eslint/build:client чисто; страж
паритета 17✓ (включая ACTION-секцию); e2e `console-staged-play.spec.ts` тест 3
ЗЕЛЁНЫЙ (Aquifer Pumping: активация → поле при нетронутом `gameAge` → B →
композер восстановлен со снапшотом → повторное подтверждение → клетка → океан
в таблице, конец на поле). Гоча драйвера: commit-верб готового композера — A
(Enter), не X.

**Итоговое покрытие действий с размещением/перемещением** — см. отчёт в конце
этой секции: staged = Aquifer Pumping, Water Import From Europa, Comet Aiming
(океан), Mars Nomads (bonus-only), St. Joseph (marker); исключение — Icy
Impactors (game.first); не тронуты по дизайну: std-проекты и convert plants
(уже pay-on-commit cancellable), колониальная торговля через карту (уже
submit-nothing), repeat/Viron (follow-up скопированного действия — B там
возвращает в staged-композер копии штатно).

## 9-quater. АДРЕСОВАННЫЙ ХВОСТ — класс вклинившихся промптов (2026-09-11)

**Найденный фундаментальный баг (репорт владельца):** «Ядерная зона» при
температуре −4°C — тайл «ставится», бонус «начисляется», тайл исчезает, игра
просит бонусный океан и потом ЗАНОВО просит клетку Ядерной зоны.

**Корень (два слоя):**
1. **Сервер.** `global`/`tr` исполняются в Executor СИНХРОННО, до деферов
   собственных размещений карты; переход температуры через 0°C деферит
   бонусный океан с приоритетом `PLACE_OCEAN_TILE (13)` < `DEFAULT (16)` —
   он всплывает ПЕРВЫМ. Хвост батча `{type:'space'}` был позиционным, а
   `jumpedTheQueue` различал промпты только по ТИПУ: чужой space-промпт
   неотличим от своего. Ocean-карты (Comet, Mohole Lake, Towing a Comet,
   Giant Ice Asteroid) — хвост МОЛЧА СЪЕДАЛСЯ бонусным океаном; land-карты
   (Nuclear Zone, Lava Flows, Metallic Asteroid, Deimos Down promo, Small
   Comet + все ares-наследники) — «Space not available» при совпадающих
   типах читалось как staleness и хвост ВЫБРАСЫВАЛСЯ → live-переспрос.
   Каскад: oxygen 8% → синхронный +1 temp → тот же океан (Towing a Comet).
2. **Клиент.** `placementWorldVersion` при `committing` считал ЛЮБОЙ сдвиг
   версии полным успехом: `discardYieldedStack` + `clearStagedPlay`, реткил
   проекции читался как «тайл исчез», а `runStagedSealWave` (fallback-ветка
   транспорта «staged без tileHeroEvent») летел из ПУСТОГО гекса — «бонус
   начислился» от призрака.

**Фикс — адрес вместо позиции (порядок очереди НЕ тронут, правила = upstream):**
- Wire: `SelectSpaceResponse.stagedFor?: CardName` (валидатор принимает обе
  формы). Клиент штампует его из серверного `StagedPlacementModel.sourceCard`.
- `deferredInputBatch`: адресованный ответ применяется ТОЛЬКО к `SelectSpace`
  с тем же `sourceCard` (каждое собственное размещение несёт его — Executor
  прошивает, bespoke передаёт; каждое threshold/bonus — нет: это и есть
  дискриминатор). Несовпадение = парковка БЕЗ попытки (в replay и в drain);
  совпадение + отказ process = честный staleness → сброс хвоста →
  live-переспрос. `jumpedTheQueue` получил адресный терм.
- Staleness пина — СРАВНЕНИЕ С BASELINE ПАРКОВКИ, никогда «на клетке стоит
  тайл» (2026-09-11, второй заход): бланкетная проверка занятости сломала
  строительство ПОВЕРХ Ares-хазарда («опасная зона только со второго раза»)
  — хазард, стоявший на клетке ПРИ ВЫБОРЕ, оценён досье (8/16 M€ расчистки)
  и выбран осознанно. `stagedParkBaselines` (WeakMap, слабый как сам парк)
  записывает `tileType|'empty'` каждой адресованной клетки В МОМЕНТ парковки
  (staging и парковка — один запрос, окна между ними нет); drain сбрасывает
  хвост только если клетка ИЗМЕНИЛАСЬ за окно интерлопера (эрозия
  заспавнилась, тайл лёг). Прямой путь (без интерлопера) не проверяется
  вовсе — окна не было, membership валидирует process. Исключения
  hiddenTiles/placementEffect больше не нужны: равенство baseline покрывает
  replacement (озеленение==озеленение) и маркеры естественно.
- `expireSupersededStagedTail` (роут одиночного инпута, ДО process): свой
  промпт, отвеченный вручную (очередь ушла вперёд в чужом запросе),
  экспайрит запаркованный пин — он не смеет прилететь во ВТОРОЙ
  однотипный промпт той же карты (второй океан GIA).
- Модель: `PlayerViewModel.stagedPlacementPending {card, spaceId}` (self,
  transient) — серверная правда «закоммичено, клетка зарезервирована, впереди
  ещё промпт»; F5 переживает.
- Клиент: третий честный исход коммита — PARKED: стек всё равно discard
  (коммит реален, B больше ничего не отменяет), но презентационные армы
  переезжают на ПИН (`stagedPinState` в stagedPlay.ts). `runStagedSealWave`
  ДЕРЖИТ волну пока пин запаркован; landed (drain доставил) → волна летит от
  настоящего тайла; dropped (наш sourceCard-промпт встал live) → холды
  отпускаются честно (тик счётчиков, без полёта). Досье интерлопера несёт
  план-строку «Затем ещё одно размещение: <тайл>» из серверного маркера
  (тот же конвейер, что у двух-океанных карт).
- `sourceCard` дошит там, где его не было: PlaceOceanTile действий
  AquiferPumping / WaterImportFromEuropa / CometAiming, bespoke
  LavaTubeSettlement. Страж паритета теперь ТРЕБУЕТ sourceCard на live-промпте
  каждой staged-карты (это адрес хвоста — worklist сам нашёл LavaTube).

**Стражи:** `tests/inputs/deferredInputBatch.spec.ts` § addressed staged cell
(9 спеков: no-interposer, park+auto-land NuclearZone −4°C, Comet
не-съедение, drop-on-occupied-pin, supersede GIA, hazard-при-staging
one-shot + через парковку, hazard-появившийся-за-парковку drop, action
sourceCard); e2e фикстура `staged-hazard` + тест «hazard: … lands on the
FIRST confirm»;
`tests/client/console/stagedPlayPin.spec.ts` (held/dropped/landed волна);
`stagedPlacementParity` sourceCard-ассерт; e2e фикстура `staged-interposer`
(−4°C + Nuclear Zone) + тест «interposer: … PARKS and auto-lands».

**Резидуалы класса:** hazard-СОСЕДСТВО пина, изменившееся за интерлопер
(production-штраф оплачивается молча — редчайший кейс, отмечен);
opponent-interleave деградирует в live-переспрос (drain живёт в нашем роуте);
полировка: hero-сцена авто-приземлённого пина сейчас generic (flyRemote).

## 10. План реализации (этапы отдельной задачи)

1. **Сервер, превью:** `previewSelectSpace` у четырёх `Place*` деферов + `placements[]` в `cardPlayPreview`; pre-play cost-контекст в `board-cell-preview`; CORS-allowlist; спеки.
2. **Страж согласованности:** enumerated coverage-спек по всем in-scope картам-размещателям: превью-набор == набор реального `SelectSpace` (byte-set), включая Ares-геометрии, energy-coverage, EcologicalZone/NewHolland (паттерн `placementPreviewConsistency.spec.ts`).
3. **Клиент, каркас:** фаза `staging`, staging-store, третий placement-вид, воронка commit → батч; B-возврат (yield/restore + module draft композера).
4. **Хореография:** staged-режим `consolePlayedHero` (реверсивный, стыковка к result), reward-origins от тайла, порядок сцен, реверс по B без дублей.
5. **Reconciliation:** gameStateVersion-инвалидация staging, потерянный ответ, `STALE_PROMPT`, leak-detector/blocked-reason/notifications.
6. **Проверки:**
   - server-спек «отмена без следа»: staged-вход + B → `serialize(game)` идентичен байт-в-байт (тривиально: запросов не было — но спек фиксирует контракт);
   - server-спек эквивалентности: батч с хвостом == последовательные сабмиты (финальное состояние, журнал, события);
   - однократность: повтор POST после таймаута → `STALE_PROMPT`, состояние не задвоено;
   - деградация: протухший хвост → розыгрыш применён, живой промпт всплыл, консоль его обслужила;
   - e2e: полный путь (карта → поле → B → workspace с целыми выборами → снова поле → commit → тайл-hero → награды от тайла → добор поверх поля → конец на поле); F5 в staging (возврат к руке без потерь); регрессии std-проектов/convert-plants/синих действий/WGT.

---

## 11. Открытые вопросы (нужно решение владельца)

1. §9.1 — добор до размещения: вариант (а) или (б)?
2. §9.2 — multi-tile: принимаем «commit = первая клетка» в v1?
3. §9.3 — фиксированные клетки без staged-этапа — ок?
4. Нужен ли в staging какой-то сигнал оппонентам («игрок готовит размещение»)? Рекомендация: нет — ничего не произошло, нечего публиковать.
5. Расширять ли staged-путь на действия синих карт в следующей итерации (симметрично, но отдельная работа)?
