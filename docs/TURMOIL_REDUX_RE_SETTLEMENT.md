# Turmoil Redux · TR14 Re-settlement («Переселение»)

Карта проектов набора (2026-10-04). Впервые в проекте: **тайл ПЕРЕЕЗЖАЕТ** — свой город на Марсе уходит с клетки и
встаёт на соседнюю. До этой карты тайл в движке только появлялся (`addTile`) или исчезал (`removeTile`); «снять и
поставить» двумя вопросами оставило бы состояние «город снят, клетка не выбрана», которого у сервера нет и быть не
должно. Поэтому переезд — ОДНА функция движка, ОДИН вопрос с ОДНИМ ответом из двух клеток и ОДИН объект на экране.

Промпт: `docs/claude/prompts/project-tr14-re-settlement.md`. Соседи: `docs/TILE_PLAY_STAGED_COMMIT.md` §9-decies
(двухуровневая клетка staged-розыгрыша), `docs/claude/console/tile-replacement.md` § THE FOURTH case (сцена),
`docs/claude/console/board-placement-flow.md` § A MOVE (уровень источника, поза `--pickup`, вектор),
`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` (требование партии).

## 0. Решения владельца

Подтверждено владельцем: (2) переезд — это РАЗМЕЩЕНИЕ города на новой клетке, все триггеры «город размещён» срабатывают
(2026-10-04). Приняты по умолчанию промпта и ждут подтверждения:

1. RU-имя «Переселение».
3. Город НАД ОКЕАНОМ (Ocean City, New Holland) не переезжает: особый тайл нельзя ни поставить на сушу, ни подменить
   обычным городом — ему «некуда ехать». Он остаётся городом игрока, предлагается ОТКЛЮЧЁННЫМ со своей причиной.
4. Незащищённую опасность Ares можно накрыть переездом (как любым размещением, с её ценой).
5. Печатный бонус освободившейся клетки снова доступен следующему размещению.
6. Собор св. Иосифа едет с одиночным городом; с основанием стопки — остаётся.
7. Некуда ехать — карта неиграбельна с причиной (одна, более фундаментальная — первой).
8. Подъём города — ОДНО нажатие (чистая презентация); двухфазная фиксация — только у клетки назначения.
9. Уголок «на Марсе» — новый `AltSecondaryTag.MARS_TILE` из ассета владельца.
10. Соперник видит ОДИН переезд — по записи сервера, не по геометрии.
11. Кочевники / Kaguya на общий «переезд» не мигрированы.

## 1. Карта и правила

TR14, 7 M€, AUTOMATED, метки Город + Строительство, `requirements: {party: PartyName.MARS}`, 1 ПО, `compatibility` нет.
Ряд лица: «− [город◣на Марсе] + [город]*». Лор — придуман (реестр `docs/claude/turmoil-redux-invented-lore.md`).

| # | Правило | Где закреплено |
| --- | --- | --- |
| 1 | Требование: «Марс вперёд» правит ∨ 2 своих делегата на её резолюции | `ReSettlement.spec` |
| 2 | Переезжает СВОЙ город НА МАРСЕ (`getCitiesOnMars`), Столица в том числе | `cityMove.spec` |
| 3 | Со стопки уходит только ВЕРХНИЙ ярус — обычным городом; основание стоит | `cityMove.spec` |
| 4 | Одиночный тайл уезжает ЦЕЛИКОМ: тайл + карта, владелец, `coOwner`, `adjacency` | `cityMove.spec` |
| 4-bis | Город над океаном остаётся: отключён со своей причиной; единственный такой город → причина №2 | `cityMove.spec`, `ReSettlement.spec` |
| 5 | Назначение — СОСЕДНЯЯ клетка из земельного набора `cityIgnoringRestrictions` (незарезервированная суша; прочие ограничения не действуют) | `cityMove.spec` |
| 6–7 | Бонусы — через `addTile` (печатный, океаны, Ares, закон); переезд = размещение города: триггеры срабатывают | `ReSettlement.spec` |
| 8 | Число городов не меняется | `ReSettlement.spec` |
| 9 | Неиграбельна с ОДНОЙ причиной: нет города на Марсе → нет свободной соседней клетки | `ReSettlement.spec` |
| 10 | Никакого авто-выбора: единственный город и единственная клетка всё равно спрашиваются | `MoveCityTile.spec` |
| 11 | Собор едет с одиночным городом, остаётся с основанием стопки | `cityMove.spec` |
| 12 | ОДНО событие `tile-moved`, одна строка журнала, `tilesPlaced` не растёт | `ReSettlement.spec` |
| 13 | С TR16 в табло розыгрыш добирает карту | `ReSettlement.spec` |
| 14 | MarsBot карту не играет | (как у TR11 / TR18 / TR19 — отдельным спеком не закреплено) |

Следствие правила 7 для экрана: требование карты совпадает с условием эффекта партии «Марс вперёд», поэтому в ЛЮБОМ
разыгрываемом состоянии игрок держит этот эффект — переезд всегда платит +1 сталь (тайл на Марсе) и +1 карту (город на
Марсе). Досье клетки показывает обе строки до подтверждения; карта приходит открытием после сцены.

## 2. Контракт «тайл переезжает»

### 2.1 Одна функция — `Game.moveCityTile(player, from, to)` (+ `IGame`)

Единственный писатель переезда. Проверяет «свой город на Марсе, не над океаном» и «`to` ∈
`cityIgnoringRestrictions(player, {adjacentTo: from})`», снимает верх (`boards/cityStack.liftTopCity` — стопка: высота
−1, тайл `{CITY}`; одиночный: тайл, `adjacency`, `coOwner`, владелец), ставит через **`addTile(player, to, tile,
{moved: {from, stack?}})`** (все выплаты и триггеры — её), переносит `adjacency` / `coOwner` / собор, пишет запись
`tileMoves`. `simpleAddTile(…, moved)` вместо «placed» пишет `LogHelper.logTileMove` и `events.recordTileMoved`.

⚠ Отступление от сигнатуры промпта: параметра `cause` НЕТ — событие едет в живом скоупе, который захватила очередь
отложенных действий (карта разыгрывается → её `MoveCityTile` выполняется в её же скоупе), а не в аргументе.

### 2.2 Набор — `boards/cityMove.ts`

`cityMoveOffer(player, canAffordOptions?) → {sources: MovableCity[], disabledSources: [{space, reason}]}`;
`MovableCity = {from, tileType, card?, tiers, arrives, to[], illegal[]}` (`to` — по часовой от восточного соседа;
`illegal` — клетки, предложенные ДРУГОМУ городу, с причиной `not-adjacent-to-the-city`). `movableCities` — только
источники; `cityMoveDestinations` — объединение; `findCityMove(offer, from, to)` — проверка пары;
`cityMoveReasoner(player, offer)`; `cityMovePromptModel(offer)`. Блокировки: `city-stands-on-ocean`,
`no-space-to-move`. `ignoreRestrictionsCity` получил `adjacentTo?: Space` — правило набора одно.

### 2.3 Один вопрос — один ответ

`SelectSpace.tileMove?: CityMoveOffer` + `onMove(from, to)`; модель — `SelectSpaceModel.tileMove: TileMovePromptModel
{sources: [{from, tileType, card?, tiers, arrives, to, illegal?}], disabledSources?}`, `placementEffect: 'move'`,
`placementType: 'city-move'`. Ответ — **`{type: 'space', spaceId, movedFrom[, stagedFor]}`** (ровно четыре набора
ключей у `isSelectSpaceResponse`). Ошибки `process`: «A move must name the city that moves», «This city cannot be moved
to that space», «This placement does not move a tile». Общий шаг — `deferredActions/MoveCityTile(player, {kind:
'card', card}, {canAffordOptions?})`: нет источника → названный пропуск; иначе `SelectSpace` с `onMove →
game.moveCityTile`.

Staged-хвост (`inputs/deferredInputBatch.ts`): базовые подписи припаркованного хвоста — ПО ОБЕИМ клеткам
(`cellSignature`: `'empty'` или `` `${tileType}x${tiers}` ``); изменилась любая — хвост сброшен. `parkedStagedPlacement`
отдаёт `movedFrom`; `PlayerModel.stagedPlacementPending = {card, spaceId, movedFrom?}`.

### 2.4 Гипотеза превью — `withHypotheticalMove(player, from, to, read)`

`BoardInformationEngine.boardCellPreview(…, {movedFrom})` (`GET /api/game/board-cell-preview?…&from=`): без `to` —
ЧТЕНИЕ ИСТОЧНИКА (`cityMoveSourcePreview`: «Клеток для переселения: N» со `spaces`, «Сейчас приносит: N ПО», стопка;
`placesTile = false`); с `to` — назначение под снятым городом (`withCityLifted`): бонус клетки и соседства как у
размещения, ПО города ОДНИМ вектором (два факта одного пула: `move-city-vp-gain` «у новой клетки» и
`move-city-vp-loss` категории `tile-departure` «у прежней»; или «Без изменений»), факты ухода (`move-vacated` +
бонус, снова доступный), прогресс наград с потерями. Чистота закреплена спеком; `from`, не названный источником, → 204.

### 2.5 Запись — `GameModel.tileMoves`

`TileMoveRecordModel {seq, from, to, tileType, color}` — кольцо на 8, не сериализуется (`seq = gameAge·100 + n`),
прецедент `aresAdjacencyGrants`. Единственное право клиента считать «снятие на A + посадку на B» одним переездом.
Перезапуск сервера теряет анимацию, не правило.

### 2.6 Что получает следующая карта «передвинь тайл» даром

Маркер и форма ответа, двухуровневый выбор на поле (город → клетка) со staged-коммитом и B-лестницей, досье переезда,
превью-гипотеза, сцена героя и remote-сцена по записи, строка журнала. Требует руки: своя функция набора (кто едет и
куда) и свой `moveXTile` в `Game`, если едет не город (сцена и клиент читают вид тайла из маркера и диффа).

## 3. Клиент — ВЫБОР (коммит 3)

Staged-розыгрыш: «Разыграть на поле» ничего не отправляет. Один серверный промпт читается на ДВУХ уровнях
(`tilePlacement/placementMove.ts`: `placementMoveState {from}`, `moveLevelPrompt`):

- **уровень города** — законные клетки = города, которым есть куда ехать; отключённый город несёт свою причину; все
  прочие клетки — «не ваш город» (исключением из исчерпывающих списков сервера, клиент ничего не считает). Ретикл в
  позе `--pickup` (кольцо вокруг настоящего тайла, без призрака). A — «Взять город» (одно нажатие, ничего не
  отправлено);
- **уровень клетки** — законные клетки = назначения этого города в порядке сервера; город в позе «уходит» (тише, под
  пунктирным контуром — настоящий тайл НЕ спрятан), проекция на клетке, вектор от города к клетке (янтарный на
  фиксации). A — фиксация → A «Подтвердить переселение» = ЕДИНСТВЕННЫЙ POST.

B — один уровень за нажатие: фиксация → клетка → город → композер. Бар — чистая функция `placementCommands.ts`.
Досье (`placementDossier.ts`): «ЭТОТ ГОРОД» (чтение источника), «ВЫ ПОЛУЧИТЕ», «ПРЕЖНЯЯ КЛЕТКА», «В КОНЦЕ ИГРЫ ·
ПО города 1 → 2 · у новой клетки +1». Слой связей пропускает оставляемую клетку.

## 4. Клиент — СЦЕНА (коммит 4)

Четвёртый случай транзакции героя (`consoleTilePlacement.ts`) — подробно в `tile-replacement.md` § THE FOURTH case.
Коротко: `armTilePlacement({spaceId, movedFrom})` → `verifyPlacement(…, {movedFrom})` принимает РОВНО объявленную пару
(`verifyMove`) → ОДИН прокси (`depart`-твин с кубиком владельца) рождается 1:1 над городом на A, в том же синхронном
ходе A становится тем, что оставил сервер (`applyVacatePreview`) → ОТРЫВ 0–200 → ПЕРЕНОС 200–620 → ПОСАДКА 620–770
(`playTileMove` — одни часы, одна функция позы) → настоящий тайл красится под прокси, прокси убирается следующим
кадром → обычные награды посадки (`endTilePlacement`). Стопка — «кран наоборот» (`cityStackScene.released /
unloading`). У соперника и у припаркованного пина — `moveRemote` на remote-стейдже по записи `tileMoves`
(`tileMoveRecords.pairTileMoves`); без записи — раздельные такты. Журнал — строка «Перемещение тайла» (`tile-moved`).

Измерено e2e (fhd, свой клиент): передача → посадка 828 мс при базовых 770 (+ два тика), `--vacated` на +408 мс,
прокси убран через 18–60 мс после покраски настоящего тайла; у соперника — 850–880 мс.

## 5. Тесты

Сервер: `tests/boards/cityMove.spec.ts` (32), `tests/boards/cityMovePreview.spec.ts` (17),
`tests/deferredActions/MoveCityTile.spec.ts` (17), `tests/cards/turmoilRedux/ReSettlement.spec.ts` (22),
`deferredInputBatch.spec` § addressed staged move, `ApiGameBoardCellPreview.spec`, `PlayerInputBatch.spec`.
Клиент: `tests/console/placementMove.spec.ts` (18), `placementDossier.spec` § a move, `placementRelations.spec`,
`boardCellPreviewUrl.spec`, `tests/client/components/console/tileMoveScene.spec.ts` (36 — пара, тайминги, геометрия
одного объекта, записи, транзакция героя, remote-стейдж). e2e: `tests/e2e/console-re-settlement.spec.ts`, фикстура
`re-settlement` (fhd + tv4k; `TM_E2E_STORYBOARD=1` — раскадровка обоих клиентов в `screenshots/re-settlement/`).

## 6. Не сделано / известные границы

См. журнал набора (`docs/claude/turmoil-redux-cards-progress.md` § TR14) — там полный список с причинами.
