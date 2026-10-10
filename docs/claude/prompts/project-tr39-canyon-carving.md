# Промт исполнителю · TR39 Canyon Carving («Прорезание каньона») — НОВАЯ МЕХАНИКА: ПЕРЕЕЗД ОКЕАНА. Любой океан снимается и садится на соседнюю клетку (отведённую под океан или не отведённую ни подо что), игрок получает РТ и бонусы клетки · контракт переезда TR14 обобщается на тайл, у которого нет владельца · карта ≈ 80 %, полировка маршрута «поле» ≈ 20 % (визуальная подача + бесшовность, TV 4K первым)

Выдан 2026-10-10. Инфраструктура набора стоит (TR01–TR38, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md` (включая постоянный **§7 «Полировка по пути»** — правило владельца 2026-10-08 (агент САМ
ищет места доработки, визуальная подача — топ-приоритет, слабость принятой сцены → батч владельцу ПЕРВЫМ), правило **«Профили» 2026-10-09
(TV 4K сперва, только-Deck не полируем)** и правило **«Бесшовность — workspace-архитектура» 2026-10-10** (шов чинится в общем механизме с
законом и гардом, не заплатой сцены; доказательство — раскадровка 4K всего flow)), журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,board,console-ui,animations,tests}.md`
(`console-ui.md` § THE PLACEMENT PANEL IS A DOSSIER `:87`, § BOARD PLACEMENT IS TWO-PHASE `:104`, § A BOARD BEAT WAITS FOR A BOARD THE
PLAYER CAN SEE `:109`, § A LANDING WAITS… `:125`).
**Обязательное чтение до кода:** `docs/TURMOIL_REDUX_RE_SETTLEMENT.md` ЦЕЛИКОМ (контракт «тайл переезжает»: §2.1 одна функция, §2.2 набор,
§2.3 один вопрос — один ответ, §2.4 гипотеза превью, §2.5 запись, **§2.6 «что получает следующая карта „передвинь тайл“ даром»**: маркер и форма
ответа, двухуровневый выбор, досье, гипотеза, сцена своя и remote, журнал — **«требует руки: своя функция набора (кто едет и куда) и свой
`moveXTile` в `Game`, если едет не город (сцена и клиент читают вид тайла из маркера и диффа)»**), `src/server/Game.ts:2330–2385`
(`moveCityTile` — ОБРАЗЕЦ: validate → lift → `addTile(…, {moved})` → re-seat → `recordTileMove`), `:2059–2066` (`options.moved`), `:2296–2310`
(`simpleAddTile`: **океан — без владельца**, `space.player = undefined`), `:2311–2323` (`logTileMove` + `recordTileMoved`), `:2604–2630`
(`canAddOcean` / `canRemoveOcean` / **`addOcean` — ЕГО НЕ ЗВАТЬ**: ворота 9 океанов, параметр, `onGlobalParameterIncrease`, Ares `onOceanPlaced`),
`:2632–2636` (`removeTile` — не трогать, чеклист §4), `:2240–2290` (`grantPlacementBonuses`: бонус клетки, `grantOceanAdjacencyBonus` `:2470–2481`,
`TurmoilHandler.resolveTilePlacementBonuses`), `src/server/boards/cityMove.ts` (набор: кто едет / куда / кто стоит и почему — ОБРАЗЕЦ формы
`oceanMove.ts`), `ignoreRestrictionsCity.ts:59–72`, `src/server/deferredActions/MoveCityTile.ts` (общий шаг: один промпт `tileMove`, ответ
`{spaceId, movedFrom}`, named skip), `RemoveOceanTile.ts` (простые океаны — `getOceanSpaces({upgradedOceans: false})`), `src/server/cards/base/
ArtificialLake.ts:21–47` (**океан НА СУШЕ** — `getAvailableSpacesOnLand(player, undefined, false)`: океан не платит соседство опасностей), `src/server/
boards/Board.ts:294–350` (`getAvailableSpacesOnLand`: не Ноктис, не лагерь номадов, не чужая заявка, опасность без защиты — за свою цену;
`canPlaceTile`), `MarsBoard.ts:105–147` (`getAvailableSpacesForType`, `getOceanSpaces`, `getAvailableSpacesForOcean` `:245–248`), `PlacementType.ts`
(`'ocean-removal'`, `'city-move'`), `src/common/boards/TileMove.ts` (`TileMoveSourceModel`: `tiers` / `arrives` — для океана 1 / OCEAN без
правок; `TileMoveFact`, `TileMoveRecordModel`), `src/common/models/PlayerInputModel.ts:1162–1209` (`placementEffect: 'move'`, `tileMove`),
`src/server/boards/BoardInformationEngine.ts:1206` (`previewContext`), **`:1252–1290` (`tileRemovalFacts` — факты УХОДА океана: счётчик падает,
«РТ никто не теряет», Столица теряет соседний океан)**, `:1641` (ПО Столицы по соседним океанам), **`:1806–1812` (`withHypotheticalMove` —
`withCityLifted` + `withHypotheticalTile`)**, `:1814–1850` (`cityMoveScoringFacts` — ОДИН вектор ПО), `docs/TURMOIL_REDUX_WATER_EXPORT.md` §4
(последствия снятия, закреплённые спеком), §6 (маркеры пикера снятия), §7 (сцена ухода — `liftRemote` / `playTileDeparture`, «воду вывозят, а не
испаряют»), §10, `docs/claude/console/tile-replacement.md:203–300` (§ THE FOURTH case — сцена переезда: ОДИН прокси в арте ЕДУЩЕЙ ФИШКИ + куб
владельца, LIFT / CARRY / LANDING одним прогресс-твином, «never a frame with two or none»), `docs/claude/console/board-placement-flow.md:170–232`
(§ A MOVE — уровни `city` / `cell`, поза pickup, вектор, крошка, e2e-драйв: `walkToSpace` + ОДИН Enter на уровне источника), `src/client/console/
tilePlacement/placementMove.ts` (уровни и СЛОВА «Взять город» / «Другой город» — городские), `consoleTilePlacement.ts:520–523` (`departingCube`),
`:639–660`, `:880–945` (`playTileMove`, `revealVacatedBonuses`, `markCellVacated`, `removeMoveProxy`), `consoleRemotePlacement.ts:281–320`
(`pairTileMoves` по записи сервера), `placementDossier.ts:124` (`'city-move': 'City'`), `:697–720` (факты `tile-move`), `src/client/components/journal/
journalEventChild.ts:425–432` («Tile relocation»), `src/server/LogHelper.ts:59–62` (**`logTileMove` печатает «moved their city» — для океана ложь**),
`tests/e2e/console-re-settlement.spec.ts:1–60` (восемь пунктов контракта e2e), фикстура `re-settlement` (`generate.ts:1911–1960`), журнал § TR14
(ловушки: три цепных твина, `verifyMove` требует пустую клетку, окно янтарного контура) и § TR38 (гочи фикстур, `--transit` на 4K). Память:
`polish-seamless-workspace-architecture`, `tr-prompts-carry-polish-budget`, `polish-priority-tv4k-no-deck-only`, `storyboard-catches-what-the-probe-passes`,
`owner-batches-pending-polish-decisions`, `remove-and-replace-placement-preview`, `scale-marker-never-lags`, `board-piece-keeps-its-kind`,
`flip-anchor-is-the-object`, `flight-aims-at-resting-rect`, `e2e-out-of-band-change-needs-second-player`, `turmoil-redux-biological-simulations`.

Номера строк сняты с `77a8ec102e` (дерево чистое на момент выдачи) — перед правкой перечитать. **Батч TR38 владельцу (PL-120 (б)+(в) — композиция
сцены посадки на 4K; К-R1 — роль держателя «data покупает товар действия») НЕ отвечен** — не скоуп этой карты; если владелец ответит по ходу,
решения ложатся в реестр, не в эту задачу.

**Что это за карта.** Зелёная (AUTOMATED), 6, метка **Строительство**, требование **Зелёных** (вторая плашка после TR38), **1 ПО**: *«Remove any 1
ocean tile from the board and place it in an adjacent space that's reserved for ocean or not reserved at all. (You gain TR for this, and the
placement bonus of that space, including adjacency bonuses.)»* Это **переезд ОКЕАНА** — третий переезд тайла в проекте после TR14 (город) и
шестого мирового шага RX33 Water Export (снятие океана). Всё, из чего он состоит, уже стоит: контракт переезда (один вопрос — две клетки,
двухуровневый staged-выбор, досье-гипотеза, сцена одного прокси у себя и у соперника, событие `tile-moved`), снятие океана (факты ухода, фильтр
простых океанов), океан на суше (Artificial Lake), бонусы посадки (`addTile`). Нового — четыре вещи: **(1)** набор «кто едет / куда» для тайла
БЕЗ владельца («any 1 ocean tile» — чужой и нейтральный тоже) с ДВУМЯ семьями клеток назначения; **(2)** писатель `Game.moveOceanTile`, который
НЕ зовёт `addOcean` (счётчик океанов не меняется, ворота 9 не действуют, Ares `onOceanPlaced` не стреляет) и платит РТ явно; **(3)** вид превью
`'ocean-move'` — уход (Столица теряет) + прибытие (РТ, бонус клетки, соседство, партии) БЕЗ строки «океанов N → N+1»; **(4)** общий шаг и словарь
клиента переезда, которые сегодня говорят «город», должны говорить тайлом (обобщение класса, не копия). Карта ≈ 80 %.

**Оценивается — в этом порядке веса.**
1. **ОДИН контракт переезда на два вида тайла.** Шаг `MoveCityTile` и клиентские уровни `placementMove.ts` обобщаются (`MoveTile` с набором от
   вызывающего; уровни `source` / `cell`; слова — по виду тайла из маркера), TR14 без изменения поведения и таймингов (`console-re-settlement` 8 / 8,
   `tileMoveScene.spec` пинит константы). Ни второй функции набора «копией», ни второй сцены.
2. **Честность чисел ДО нажатия и ПОСЛЕ.** Досье источника: «этот океан уходит отсюда», Столица соседа теряет ПО (включая ЧУЖУЮ — потеря
   соперника названа); досье назначения: «+1 РТ», бонус клетки, «+2 M€ за соседний океан» (без самого едущего океана), партии (Зелёные +2 M€ на РТ,
   Марс прежде всего +1 сталь), Столица у B получает; **ни одной строки про счётчик океанов**. После: шкала океанов и HUD «N/9» НЕ ДВИГАЮТСЯ
   (пробник), РТ тикает после посадки, M€ соседства — волной с соседних океанов, ответ Зелёных — тактом после РТ (PL-002 класс).
3. **Сцена — ОДИН физический объект с арта океана, без куба** (у океана нет владельца): отрыв с A (бонус клетки A проступает под ним — синий гекс
   отведённой клетки или земля), перенос через общее ребро, посадка на B; то же у соперника по записи сервера; «never a frame with two oceans or
   none»; раскадровка 4K от A до поля.
4. **Полировка маршрута «поле»** (≈ 20 %): PL-041 (нотификация соперника о переезде — сделать классом: для океана соперник ТЕРЯЕТ ПО Столицы),
   PL-039 (янтарный контур после посадки), словарные лжи «город» (К-4 / К-9 — P0), швы аудита TR38 на маршруте (#15 staged-розыгрыш из руки
   старта / standalone-полосы; #2 `v-if` под-состояний композера), собственные находки.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Писатель переезда** | `Game.moveCityTile` (`:2363–2385`): валидация по набору → `liftTopCity` → `addTile(player, to, tile, {moved: {from}})` → пересадка `adjacency` / `coOwner` / собора → `recordTileMove({from, to, tileType, color})`. `addTile` с `moved` пишет `logTileMove` («moved their city» `LogHelper.ts:60` — **городская строка**) и `recordTileMoved` вместо `tile-placed` (`:2311–2323`); всё остальное — как у размещения: Ares-цены, бонус клетки, соседство океанов, партии, закон, задание, `onTilePlaced` карт |
| **Океан в движке** | `simpleAddTile`: океан — `space.player = undefined` (`:2303–2306`); параметр = `board.getOceanSpaces().length` (`:1274`, `:2605`) — не счётчик; `addOcean` (`:2613–2630`) — ворота `canAddOcean`, `maybeLogMarsIsTerraformed`, `onGlobalParameterIncrease`, `increaseTerraformRating(1, {global: true})`, `recordGlobalParameterChange`, Ares `onOceanPlaced` — **ничего из этого переезд не делает**; `removeTile` (`:2632`) — чеклист §4: не трогать |
| **Простые океаны** | `getOceanSpaces({upgradedOceans: false})` (`MarsBoard.ts:136–147`) — фильтр `RemoveOceanTile` и `'ocean-removal'` (`:114–117`): улучшенный океан (Ocean City / Farm / Sanctuary / New Holland — `OCEAN_UPGRADE_TILES`, `TileType.ts:147`) не снимается; Wetlands (Ares) — в `OCEAN_TILES`, у `getOceanSpaces` свой флаг `wetlands` |
| **Клетки назначения** | «reserved for ocean» = `getAvailableSpacesForOcean(player)` (`MarsBoard.ts:245–248`: `SpaceType.OCEAN`, пусто, без чужой заявки); «not reserved at all» = семья Artificial Lake — `getAvailableSpacesOnLand(player, canAffordOptions, false)` (`Board.ts:294–318`: земля, пусто или незащищённая опасность за свою цену, не Ноктис, не лагерь номадов, не чужая заявка; `false` — океан не платит соседство опасностей); соседство — `getAdjacentSpaces(from)`; порядок — `getAdjacentSpacesClockwise` от восточного соседа (`cityMove.ts:92–100`) |
| **Контракт выбора** | один промпт `tileMove` (`PlayerInputModel.ts:1174–1179`), ответ `{spaceId, movedFrom[, stagedFor]}` (`InputResponse.ts:94–108`), `placementEffect: 'move'`, `placementType: 'city-move'` → нужен `'ocean-move'` (`PlacementType.ts`, `BoardPlacementKind` `BoardInformationFacts.ts:26`, ветка `getAvailableSpacesForType`, `illegalReasonFor`); `TileMoveSourceModel` (`TileMove.ts:22–46`): `tiers: 1`, `arrives: OCEAN` — ложится без правок; `disabledSources` — для «кто стоит и почему» |
| **Шаг и набор — городские по имени и слову** | `MoveCityTile` (`:60–80`: `cityMoveOffer` внутри, `MOVE_CITY_TILE_TITLE`, `NO_SPACE_TO_MOVE_A_CITY_REASON`, `CITY_MOVE_LABEL`); `cityMove.ts` (`MovableCity`, `cityStandsOnOcean`, `isOwnCityOnMars`); клиент `placementMove.ts:42` уровни `'city' \| 'cell'`, «Взять город» / «Другой город» (`:51–56`), `moveSourceOf`, `:127` причина `'not-your-city'`; `placementDossier.ts:124` `'city-move': 'City'`; `consoleTaskSummary.ts:185–195` кикер; `board-placement-flow.md:170–205` «ЭТОТ ГОРОД», «Подтвердить переселение», «Другой город» |
| **Досье** | `withHypotheticalMove` (`:1806–1812`) = `withCityLifted` + `withHypotheticalTile(…, previewContext('city-move', …))`; `cityMoveScoringFacts` (`:1814–1850`) — ПО города одним вектором; `tileRemovalFacts` (`:1252–1290`) — уход океана: «счётчик падает» (`icon: 'ocean'`, `direction: 'cost'`), «РТ никто не теряет», Столица соседа −1 ПО (`specialTileAdjacencyVpFacts` — та же функция на входе `:1641`); прибытие океана — семья размещения океана с собственной строкой параметра (найти по `icon: 'ocean'` / `GlobalParameter.OCEANS` в `BoardInformationEngine.ts` — для переезда ПОДАВИТЬ) |
| **Сцена** | `playTileMove` (`consoleTilePlacement.ts:880–945`): прокси в арте `arrives` + куб владельца (`departingCubePose(landed.moves.color…)` `:522–523` — **у океана куба нет**), LIFT / CARRY / LANDING одним прогресс-твином, `revealVacatedBonuses(from)` `:903`, `markCellVacated` `:928`, `removeMoveProxy` `:942`; remote — `pairTileMoves` по записи `game.tileMoves` (`consoleRemotePlacement.ts:306–320`), ветка `move` до ярусной; посадка — `endTilePlacement` (иконки клетки, вода, Ares, волна закона); снятие океана RX33 — `liftRemote` / `playTileDeparture` (ушедший тайл «вывозят»); шкала океанов — `AnimatedScaleMarker` (`scale-marker-never-lags`), счётчик HUD «N/9» — история board-beat-парка по диффу (при неизменном счётчике истории нет) |
| **Событие и соперник** | `tile-moved` (`TileMoveFact` `TileMove.ts:61–72`) → журнал «Tile relocation» (`journalEventChild.ts:425–432`); **нотификации у переезда нет** (PL-041 открыта: `notificationSemantics` знает только `tile-placed`) |
| **Партии и триггеры на посадке** | Марс прежде всего — тайл на Марсе → +1 сталь (`resolveTilePlacementBonuses` `:2281`); Зелёные — +2 M€ за шаг РТ (`onIncreaseTerraformRatingByAnyPlayer`); карты `onTilePlaced` (Arctic Algae — +2 растения любому океану); задание председателя — цели `tile: 'greenery' \| 'city' \| 'special' \| 'spaceCity'` (`ParliamentTypes.ts:178`) — океана нет; `QuestTracker` `{kind: 'tr'}` — РТ засчитывает (R p.9) |
| **Требование Зелёных** | TR38 — первая плашка: ключи описания `turmoil_redux_cards.json:147`, сгенерированная строка `card_info.json:529` («Требуется: «Зелёные» правят или 2 ваших делегата на их резолюции.») — ЕСТЬ; Зелёные правят по стартовому правилу (ENACTED пуст) — в поколении 1 карта играбельна без делегатов |
| **Лицо** | `b.minus().oceans(1).plus().oceans(1).asterix()` (образец `ReSettlement.ts:125`; `plus` / `minus` `CardRenderer.ts:572–576`), ПО 1 — `victoryPoints: 1` |
| **Лор** | на скане НЕТ → реестр `docs/claude/turmoil-redux-invented-lore.md:20`: EN **«Nature took a million years to carve the first canyon. We had a deadline.»**, RU **«Природе понадобился миллион лет на первый каньон. У нас был дедлайн.»** (статус «ждёт карту» → «сдана»; в шапке карты — «запись придумана») |
| **e2e рядом** | `console-re-settlement` (8 пунктов контракта, два профиля), `console-parliament-water` (снятие океана, два клиента, досье «уходит с поля» / «РТ никто не теряет» `:300–304`), `console-tile-replacement`, `console-placement-confirm`, `console-scale-marker`, `console-parliament-aquifer` (RX03 — океан по закону), `console-play-tr-reward` |
| **Арт** | `Downloads\Mars Arts\TR39.png` — **НЕТ** (есть TR30–TR38). Первым делом попросить у владельца; при сдаче без арта — назвать |

### Чтение скана (`…\Projects\Card_-_TR39.png`)
- **Canyon Carving** · `TR39` · цена **6** · **зелёная (AUTOMATED)** · метка **Строительство** (коричневый диск с домом) · в оранжевой плашке MIN у
  цены — эмблема **Зелёных** (`{party: PartyName.GREENS}`), не метка · **1 ПО** (бейдж на Марсе внизу справа).
- Графика, один ряд: **`− [океан] + [океан]*`** — минус-океан, плюс-океан с астериском (особое правило размещения).
- Текст: *(Requires the Greens to be ruling or that you have 2 delegates there. Remove any 1 ocean tile from the board and place it in an
  adjacent space that's reserved for ocean or not reserved at all. (You gain TR for this, and the placement bonus of that space, including
  adjacency bonuses.))*
- Внизу слева — только значок модуля → `compatibility` не объявляется. Лора нет (реестр придуманного). Художник — Michael Burke.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/CanyonCarving.spec.ts` и `tests/boards/OceanMove.spec.ts`)
1. **Требование** `{party: GREENS}` — при розыгрыше (класс TR15 / TR38); TR36 требование не выполняет.
2. **Что едет — ЛЮБОЙ простой океан на поле**: свой, чужой, нейтральный (у океана нет владельца — `space.player` undefined), на отведённой клетке или
   на суше (после Artificial Lake / этой карты). Улучшенный океан (Ocean City / Farm / Sanctuary / New Holland) и Wetlands — НЕ едут (чтение RX33:
   «ocean tile» = простой океан); в `disabledSources` с причиной `'upgraded-ocean'` (новая `PlacementIllegalReason` или существующая «occupied» — по
   образцу `illegalReasonFor('ocean-removal')`), никогда не скрыты.
3. **Куда — соседняя клетка из ДВУХ семей**: отведённая под океан и пустая (`getAvailableSpacesForOcean`) ИЛИ суша «не отведённая ни подо что» по
   Artificial Lake (`getAvailableSpacesOnLand(player, canAffordOptions, false)`: не Ноктис, не лагерь номадов, не чужая заявка, своя заявка — да,
   незащищённая опасность Ares — за свою цену, соседство опасностей океан не платит). Клетки-колонии (Ганимед / Фобос) — нет. Соседство — по
   `from`. Океан без ни одной такой клетки — в `disabledSources` с `'no-space-to-move'` (как у TR14).
4. **Карта играбельна, если ХОТЬ ОДИН океан может уехать** (`bespokeCanPlay` по набору с `canAffordOptions`); иначе — причина «No ocean tile on the
   board has a free adjacent space» (`unplayableReason`); на поле без океанов — та же причина. Между розыгрышем и шагом поле ушло — named skip
   (`skippedOceanMove`, как `skippedCityMove`).
5. **Переезд — ОДНА функция `Game.moveOceanTile(player, from, to)`** (образец `moveCityTile` `:2363–2385`): валидация по набору → подъём (`from.tile =
   undefined` — ни владельца, ни стопки, ни соседства Ares, ни собора у океана; `stackHeight` не бывает) → `addTile(player, to, {tileType: OCEAN},
   {moved: {from}})` → **`player.increaseTerraformRating(1)`** явно (решение 3 — сегмент карты) → `recordTileMove`. **НЕ `addOcean`**: счётчик океанов
   не меняется, ворота 9 не действуют (при 9 океанах переезд законен и платит РТ), `maybeLogMarsIsTerraformed` / `onGlobalParameterIncrease` /
   `recordGlobalParameterChange` / Ares `onOceanPlaced` — не зовутся. Старая клетка: бонус НЕ возвращается; отведённая под океан клетка снова примет
   океан позже (и он снова заплатит РТ и бонус — правило TM, RX33 §4).
6. **Посадка — обычное размещение океана на B** (через `addTile`): печатный бонус B, **соседство океанов — только с ДРУГИМИ океанами** (A уже
   снят; если B соседствует с A — A не считается), Ares-цены и бонус уборки опасности, Марс прежде всего +1 сталь, Зелёные +2 M€ за РТ, `onTilePlaced`
   карт (Arctic Algae +2 растения), задание «N РТ» засчитывает; `QuestTracker` «tile»-цели океана не знают — ничего.
7. **ПО соседства пересчитываются по доске**: Столица (своя или ЧУЖАЯ) рядом с A — −1 ПО, рядом с B — +1 ПО; Столица рядом с обеими — без изменений.
   Нейтральные и чужие города — ничего (ПО озеленений от океанов не зависят).
8. **Событие** — одно `tile-moved` с `tileType: OCEAN` (`tilesPlaced` не растёт); строка журнала — ТАЙЛОМ («moved an ocean tile · A → B»), не
   «their city» (`logTileMove` — вид тайла из `tile.tileType`); РТ — своей строкой.
9. **Save / load** — ничего нового (запись переезда не сериализуется; сейв хранит доску).
10. **MarsBot** карту не играет; бот как владелец — не бывает (у океана нет владельца); бот ставит океаны по своему профилю — после переезда читает доску.
11. **Один вопрос — один ответ**: состояния «океан снят, клетка не выбрана» на сервере нет; `{spaceId, movedFrom}` — обе клетки; отказ оставляет поле
    как было.
12. **Превью-гипотеза** `'ocean-move'`: `withOceanLifted(from)` + `withHypotheticalTile(player, to, ctx)`; факты ухода A (Столица −1 ПО соседа — чужая
    потеря названа) + прибытия B (РТ +1 «за переезд», бонус клетки, соседство, партии, Столица +1) **без строки счётчика океанов и без «РТ никто не
    теряет»** (здесь РТ дают); Столица у обеих клеток — одна строка «без изменений».

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, не блокер)
1. RU-имя **«Прорезание каньона»** (альтернативы: «Резьба каньона», «Каньон по заказу»).
2. Лор — из реестра придуманного (строка `:20`), статус → «сдана».
3. **РТ переезда — сегмент КАРТЫ** в разбивке счёта (`increaseTerraformRating(1)` без `global`, атрибуция — активная область розыгрыша), не сегмент
   «глобальные параметры» (параметр не двигался). Альтернатива — `{global: true}`.
4. **Назначение = две семьи (правило 3)**, опасности Ares — за свою цену; «ignoring other placement restrictions» карта НЕ печатает → Ноктис, лагерь,
   чужая заявка остаются запретом.
5. **Улучшенные океаны и Wetlands не едут** (правило 2), перечислены отключёнными с причиной.
6. **Обобщение класса, не копия**: `MoveCityTile` → `MoveTile(player, cause, {offer: () => TileMoveOffer, title, constraint, reason, label})` (город и
   океан — два набора, один шаг); клиентские уровни `'city' \| 'cell'` → `'source' \| 'cell'`, слова — по `arrives` маркера («Взять город» / «Взять
   океан», «Другой город» / «Другой океан», «Подтвердить переселение» / «Подтвердить перенос», досье «ЭТОТ ГОРОД» / «ЭТОТ ОКЕАН», кикер); TR14 —
   без изменения поведения (её e2e 8 / 8, спеки без правок).
7. **Куба на прокси океана нет** (у океана нет владельца — `board-piece-keeps-its-kind`); цвет записи `tileMoves.color` = кто переместил (для сцены
   соперника — чей ход), не владелец тайла.
8. **e2e: ОДИН новый спек** `tests/e2e/console-canyon-carving.spec.ts` + фикстура `canyon-carving` (§4).
9. Ключи (Grep-инструментом перед КАЖДЫМ): описание — скан дословно → RU «Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на их
   резолюции. Снимите любой 1 тайл океана с поля и положите его на соседнюю клетку, отведённую под океан или не отведённую ни подо что. (Вы
   получаете за это РТ и бонус размещения той клетки, включая бонусы соседства.)»; `infoText` **«Move an ocean 1 space: +1 TR, its cell's bonuses»**
   → «Перенесите океан на соседнюю клетку: +1 РТ и бонусы клетки»; титул промпта (семья TR16 — титул называет правило) **«Move any ocean tile to an
   adjacent space reserved for ocean or not reserved at all»**; хвост ограничения; причина **«No ocean tile on the board has a free adjacent
   space»**; ярлык пропуска **«Move an ocean»**; журнал **«${0} moved an ocean tile · ${1} → ${2}»**; уровни / досье — решение 6; существующие
   городские ключи не переписывать.

---

## 0. Рабочее дерево
`git status` на момент выдачи: **чисто**, HEAD `77a8ec102e`. ListAgents перед стартом. Общие файлы (`Game.ts`, `MarsBoard.ts`,
`BoardInformationEngine.ts`, `consoleTilePlacement.ts`, `placementMove.ts`, `ConsoleShell.vue`, локали, документы, реестр — нумерацию делим с
соседями: объявить номер ДО записи; следующий **PL-130**, раздел **R**) — только через временный индекс (`GIT_INDEX_FILE` абсолютным путём,
`git reset -q` после), `git add` своими путями; после коммита — `git restore --staged package.json package-lock.json`. Свой снапшот:
`npm run e2e:snapshot tr39`, `TM_E2E_ROOT=.e2e-tr39`; 4K — `--workers=1`. Арт — спросить у владельца сразу.

## 1. Сервер
**Набор** `src/server/boards/oceanMove.ts` (форма `cityMove.ts`): `oceanMoveOffer(player, canAffordOptions?) → {sources: MovableOcean[], disabledSources}`
— `sources` из `getOceanSpaces({upgradedOceans: false})` (простые; Wetlands — вне: `getOceanSpaces` включает их только по флагу `wetlands`, по умолчанию `false` — `MarsBoard.ts:150`);
`destinationsOf(from)` = соседи `from` ∩ (`getAvailableSpacesForOcean(player)` ∪ `getAvailableSpacesOnLand(player, canAffordOptions, false)`), по
часовой от восточного; `disabledSources` — улучшенный океан (`'upgraded-ocean'` / «occupied» по образцу RX33) и `'no-space-to-move'`;
`movableOceans`, `oceanMoveDestinations`, `oceanMoveReasoner` (клетка-сосед другого океана — `'not-adjacent-to-the-tile'`; остальное — общий
конвейер причин). `MovableOcean` = `TileMoveSourceModel`-форма с `tiers: 1`, `arrives: OCEAN`, `card` нет.
**Писатель** `Game.moveOceanTile(player, from, to)` (+ `IGame`) — правило 5 дословно; `logTileMove` — вид тайла из `tile.tileType` (две строки: город /
океан; ключ города не переписывать); `recordTileMoved` — как есть.
**Шаг** — решение 6: `MoveCityTile` → `MoveTile` с набором от вызывающего (тексты — параметры), `ReSettlement.ts` передаёт городской набор, карта —
океанский; `Priority.DEFAULT`; named skip. Если обобщение шага ломает TR14-спеки — это находка класса, сказать; копия шага запрещена.
**Превью** — `PlacementType 'ocean-move'`, `BoardPlacementKind`, `getAvailableSpacesForType` (`oceanMoveDestinations(oceanMoveOffer(…))`),
`illegalReasonFor`; `withHypotheticalOceanMove` (или обобщённый `withHypotheticalMove(kind)`): `withOceanLifted(from)` + `withHypotheticalTile`;
`previewContext('ocean-move', OCEAN, grantsPlacementBonus: true, …)`; факты: уход A — Столица соседа (`tileRemovalFacts`-ветка без строк счётчика и «РТ
никто не теряет»), прибытие B — семья размещения океана минус строка параметра + явный факт «+1 РТ · переезд» (`category: 'placement-effect'`,
`delta: {icon: 'tr', amount: 1}`) + `oceanMoveScoringFacts` (Столица: один вектор на владельца, как `cityMoveScoringFacts`).
**Карта** `src/server/cards/turmoilRedux/CanyonCarving.ts`: `CardName.CANYON_CARVING = 'Canyon Carving'`, манифест без `compatibility`; AUTOMATED, 6,
`[Tag.BUILDING]`, `requirements: {party: PartyName.GREENS}`, `victoryPoints: 1`; `bespokeCanPlay` / `unplayableReason` по `movableOceans`; `bespokePlay` —
`defer(new MoveTile(player, {kind: 'card', card}, oceanSet))`; `cardPlayPreview` — `actionPreviews.placementPreview(this, player, {…, staged: {placementType:
'ocean-move', move, spaces: (c) => oceanMoveDestinations(oceanMoveOffer(player, c))}})` (образец `ReSettlement.ts:160–170`); `metadata`: `cardNumber:
'TR39'`, `infoText`, `renderData` (`b.minus().oceans(1).plus().oceans(1).asterix()`), `description`. Шапка — чтение скана, правила 1–12, «лор придуман».
**Спеки**: `OceanMove.spec.ts` (набор: свой / чужой / нейтральный океан едет; улучшенный — отключён с причиной; две семьи назначений; Ноктис /
колония / чужая заявка / занятая — нет; своя заявка — да; опасность Ares — за цену; без соседей — `'no-space-to-move'`; порядок по часовой);
`CanyonCarving.spec.ts` (требование; играбельность; переезд: счётчик океанов тот же до / после, `canAddOcean` тот же, РТ +1 (сегмент карты), бонус B,
соседство только с другими океанами (A рядом с B не считается), Марс прежде всего +1 сталь, Зелёные +2 M€, Arctic Algae, Столица своя / чужая ±1 ПО, обе
клетки — без изменений; при 9 океанах — законен и платит РТ; старая клетка снова принимает океан; `tile-moved` с OCEAN, `tilesPlaced` не вырос; журнал
«moved an ocean tile»; named skip при ушедшем поле; MarsBot не играет; save / load). Гарды §3 — ворклист пуст; `make:cards` 0 / 0 / 0.

## 2. Клиент
1. **Уровни и слова** (решение 6): `placementMove.ts` — уровни `'source' \| 'cell'`, слова по `arrives` маркера (OCEAN → «океан»); `placementDossier.ts:124`
   — `'ocean-move'`; `consoleTaskSummary.placementKicker` — переезд тайлом; `board-placement-flow.md` § A MOVE — таблица обновлена.
2. **Сцена своя** (`playTileMove`): прокси в арте океана, **без куба** (`departingCubePose` — только при владельце); `revealVacatedBonuses(A)` — на
   отведённой клетке проступает синий гекс с печатным бонусом; `markCellVacated`; посадка — `endTilePlacement` (вода = соседство с ДРУГИМИ океанами,
   иконки B, Ares, волна закона); РТ-чип — с севшего тайла на рельс, Зелёные — тактом после (проверить порядок по классу PL-002 у РАЗМЕЩЕНИЙ: если
   ответ Зелёных тикает с РТ — класс, строка реестра + лечение по образцу `agendaWalkRail`).
3. **Сцена соперника** (`consoleRemotePlacement.ts:306–320`): запись `tileType: OCEAN` → тот же прокси без куба; `holdRemoteReveal` A / B — как у TR14.
4. **Шкала и HUD**: `AnimatedScaleMarker` океанов и «N/9» не двигаются (счётчик тот же) — проверить пробником и глазами: ни history-beat, ни тика.
5. **Нотификация соперника** (PL-041 — сделать классом): `notificationSemantics` для `tile-moved` — «переместил тайл ⟨вид⟩ · A → B», чипы — что
   заплатила посадка; для океана — строка «Столица теряет соседний океан» у владельца Столицы (его потеря — его нотификация, класс `lawAnswer`-семьи
   «закон ответил на чужой ход»).
6. **Гарды**: `tests/console/placementMove.spec.ts` (уровни по виду тайла), `tilePlacementModel.spec` (`verifyMove` — океан: B «пусто → океан», A
   «океан → пусто»; владельца у обеих нет), `tileMoveScene.spec` (константы TR14 те же), юнит досье (`'ocean-move'` без строки счётчика), юнит
   нотификации.

## 3. Лицо, локаль, лор
Арт (когда владелец положит): `node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR39.png" TR39` → `npm run make:cards` (0 / 0 / 0).
Лор — `assets/text/lore_texts.json` ключ `"TR39"` (EN из реестра), RU — `src/locales/ru/lore_texts.json`; реестр `:20` статус → «сдана». Локаль —
решение 9; `card_info.json` — `infoText`; промпт-титул / причина / ярлык — рядом с городскими ключами (титул TR14 лежит в `src/locales/ru/ui.json:518`; причину и ярлык — найти
Grep-ом по их EN-тексту).

## 4. Тесты
Сервер — §1. Клиент — §2.6. **e2e — ОДИН новый** (решение 8) `tests/e2e/console-canyon-carving.spec.ts` (fhd + **4K обязательно**, `--repeat-each=4`,
`{...NO_PAYMENT}`, state-waits, пробник класса `__tr14` (MutationObserver + interval) + ОКЕАНСКИЙ: цифра шкалы океанов / положение кольца / HUD «N/9»
на каждом сэмпле, `TM_E2E_STORYBOARD=1`) с фикстурой `canyon-carving` (`parliamentFixture`, образец `re-settlement` `:1911–1960`: фаза действий синего,
Зелёные правят по стартовому правилу, карта в руке, M€ ≥ 6; Тарсис, доска РАССТАВЛЕНА, не сдана: океан **O1** на отведённой клетке с печатным бонусом;
соседи O1 — пустая отведённая клетка **B1** с бонусом (растение), клетка суши **B2** с бонусом, соседствующая с ДРУГИМ океаном **O2** (+2 M€), **Столица
красного** рядом с O1 и НЕ рядом с B1 / B2 (красный теряет 1 ПО), занятая клетка (озеленение красного) и, если геометрия позволит, Ноктис — причины;
красный — второй клиент, `customCorporationsList: [TERACTOR, THORGATE]`; `expect` — чтение движка по имени: `oceanMoveOffer` даёт O1 с {B1, B2}, O2
без хода или с ходом, Столица в соседях O1, ПО красного = 1). Проверки — восемь пунктов TR14 (`:1–60`) + океанские: (2) уровень источника — курсор
на O1, досье «ЭТОТ ОКЕАН» + «Столица player2 теряет соседний океан · 1 → 0»; (3) A поднимает океан (ничего не отправлено), на B2 досье «+1 РТ»,
бонус, «+2 M€ · 1 соседний океан», партии, **без строки счётчика океанов**; (6) ОДИН прокси в арте океана без куба, ни сэмпла с двумя океанами или
без; **шкала и HUD не двигались ни в одном сэмпле**; РТ тикнул после посадки, +2 M€ после, Зелёные после РТ; (7) красный видит один переезд и
получает нотификацию о потере ПО Столицы (PL-041); (8) сервер: O1 на B2, A пуст, счётчик тот же, РТ +1, 6 M€ уплачено, бонус и 2 M€ получены,
запись одна, flow кончился на поле. Регрессия на своём снапшоте, до / после: `console-re-settlement` (8 / 8 — контракт обобщён), `console-parliament-
water`, `console-tile-replacement`, `console-placement-confirm`, `console-staged-play`, `console-scale-marker`, `console-parliament-aquifer`,
`console-play-tr-reward`, `console-board-card-bonus-concurrency`, `aaa-driver-canary`; `npm run e2e:affected`; гарды `e2eLiveness` + `e2eDriverGuard`.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**, затем fhd; Deck — только регрессия)
Витрина EN / RU (зелёная, плашка Зелёных, ряд «− океан + океан*», ПО 1), рука без доступа — причина «Зелёные» / «нет океана с свободной соседней
клеткой», композер («Разыграть на поле» + строка «Далее: перенос океана»), уровень источника на 4K (кольцо pickup на океане, чужие океаны тоже
предлагаются, улучшенный — отключён с причиной), уровень клетки (вектор, проекция океана на суше и на отведённой клетке, досье обеих семей),
B-лестница, **раскадровка переезда своя и соперника** (отрыв, бонус A проступает, перенос через ребро, посадка, вода с соседей, РТ-чип, Зелёные),
шкала океанов и HUD в покое, журнал («перемещение тайла океана»), нотификация соперника, Столица соперника в его досье / счёте. По КАЖДОМУ
моменту — вердикт «что здесь слабо?» с кадром. Логи прохода — каждая строка находка.

## 6. ПОЛИРОВКА ПО ПУТИ — чеклист §7, правило 2026-10-10 (бесшовность) и батч
Реестр: раздел **R** — маршрут «переезд океана: двухуровневый выбор на поле · досье ухода и прибытия · сцена одного прокси · шкала стоит · соперник».

**1. P0 (вне бюджета):** К-4 / К-9 — словарные лжи «город» на обобщённом пути (`placementMove.ts`, `placementDossier.ts:124`, `logTileMove`,
`consoleTaskSummary`), К-1 — куб на прокси океана, К-3 — строка счётчика океанов в досье прибытия.
**2. Минимум сверх P0 назван заранее:** **PL-041** (нотификация соперника о переезде — классом, для океана с потерей ПО Столицы), **PL-039**
(янтарный контур 60 мс после посадки — воспроизвести на 4K, лечить классом «состояние выбора снимается на коммите»), **шов #15 аудита TR38**
(staged-розыгрыш из руки стартового workspace / standalone-полосы отправляется сразу, выбор приходит живым — воспроизвести с этой картой из
прелюдии «из руки»; строка раздела R с кадром, лечение — батч: граница BOUNDARY (v1) `ConsoleShell.vue:16060–16128`), **шов #2** (под-состояния
композера `v-if` — на маршруте: композер → «Разыграть на поле»: раскадровка 4K перехода руки в поле — RELEASE / UNFOLD или склейка?).
**3. Открытые строки на маршруте — сперва воспроизвести:** PL-039 · PL-040 (переезд на опасность Ares — два такта) · PL-041 · PL-043 (такт выплаты
соседства на `setTimeout` против GSAP — на 4K жетон растворялся; **ЭТОТ маршрут платит соседство океанов** — воспроизвести на 4K; ждёт владельца →
в батч с кадром) · PL-026 (staged play B restore — ждёт владельца) · PL-036 (замена плитки без `claim`) · PL-078 / PL-082 (прогнозы размещения).
**4. Кандидаты, найденные при подготовке** (чтение кода, глазами НЕ подтверждено):
- **К-1 · Куб на прокси** — `departingCubePose(landed.moves.color, …)` (`consoleTilePlacement.ts:522–523`) рисует куб цвета записи; у океана
  владельца нет — прокси без куба (запись `color` = кто переместил, для сцены соперника).
- **К-2 · История счётчика океанов** — board-beat-парк и `AnimatedScaleMarker` читают дифф: счётчик тот же → ничего не должно двигаться; проверить
  пробником на обоих клиентах (а также HUD «N/9» и «история шкал» заседания, если переезд случится в заседании — нет, это розыгрыш).
- **К-3 · Досье прибытия** — семья размещения океана печатает строку параметра (найти по `icon: 'ocean'`); для `'ocean-move'` её нет; «РТ никто не
  теряет» (`:1276`) — тоже нет (РТ дают).
- **К-4 · Слова уровней** — «Взять город» / «Другой город» / «ЭТОТ ГОРОД» / «Подтвердить переселение» / причина `'not-your-city'` (`placementMove.ts:51–56,
  :127`) — для океана ложь; слова по `arrives` маркера.
- **К-5 · Проступание бонуса A** — `revealVacatedBonuses` для отведённой под океан клетки: синий гекс + печатный бонус; для суши (океан после
  Artificial Lake) — земля; кадр обоих.
- **К-6 · Вода при посадке** — `endTilePlacement` «the water»: волна M€ с соседних океанов на рельс — PL-043 на этом маршруте (4K).
- **К-7 · Столица соперника** — досье источника называет чужую потерю; второй клиент: нотификация (PL-041) + счёт; «no silent loss» для соперника.
- **К-8 · Порядок РТ → Зелёные у РАЗМЕЩЕНИЙ** — у действий и ходьбы ответ стола идёт тактом ПОСЛЕ (PL-015 / PL-002); у посадки тайла с РТ (океан,
  озеленение) — проверить раскадровкой: если +2 M€ тикает с РТ или раньше — класс, лечить по образцу `agendaWalkRail` / `answerRailReward`.
- **К-9 · Журнал** — `logTileMove` «moved their city» (`LogHelper.ts:60`) и строка «Tile relocation» (`journalEventChild.ts:429`): вид тайла в строке.
- **К-10 · Улучшенный океан в `disabledSources`** — причина и подпись в досье источника («город над океаном — не едет»), кадр; у RX33 он «occupied».
- **К-11 · Океан на суше после переезда** — клетка суши с океаном: арт океана на коричневом гексе (Artificial Lake precedent) — кадр 4K; досье такой
  клетки потом («океан на суше») — честно?
- **К-12 · Бесшовность входа на поле** — рука (композер) → поле (двухуровневый выбор) → посадка → поле: раскадровка 4K целиком, восемь вопросов шва
  (чеклист §7 «Бесшовность»); крошка «КАРТЫ В РУКЕ › ПРОРЕЗАНИЕ КАНЬОНА › ПОЛЕ › …» — растёт ли хвостом, не перезапускается ли на поле.

Что из метода §7 не сработало или чего не хватило — поправить в чеклисте и сказать в отчёте.

## 7. Режим работы
**Коммиты карты**: (1) сервер — набор, писатель, обобщённый шаг, превью-вид, карта + спеки + локаль + лор + арт (если есть); (2) клиент — уровни /
слова / сцена без куба / remote / досье + юниты; (3) e2e — фикстура + спек; (4) документы — **`docs/TURMOIL_REDUX_RE_SETTLEMENT.md`** (контракт
переезда расширен: §2.2 «набор — по виду тайла», §2.6 → «второй вид тайла сел: что потребовало руки»; нового документа не нужно, если контракт
общий; иначе — `docs/TURMOIL_REDUX_CANYON_CARVING.md` только для того, что НЕ унаследуется), `docs/claude/console/tile-replacement.md` § FOURTH
(вид тайла, без куба), `board-placement-flow.md` § A MOVE (таблица уровней по виду), чеклист §4 (строка переезда → «тайл любого вида: набор + писатель
+ `MoveTile`»), журнал § TR39, реестр раздел R, реестр лора, промт. **Коммиты полировки** — отдельно (`Polish (TR39 walk): PL-### — …`), с «до / после»
(кадры 4K) и гардом; PL-041 — с юнитом нотификации и e2e-проверкой второго клиента. Перед каждым: `npm run lint`, `npm run build:test`,
`npm run make:cards`, `npm run make:json`; перед визуальной проверкой — `npm run make:css` + `npm run build:server`. **Не пушить.** Батч владельцу —
одним `AskUserQuestion` после P0: PL-043 (кадры 4K), шов #15 (граница staged-розыгрыша), PL-026, решения 3 / 5 / 6, слабости принятых сцен — с
рекомендацией первой.
Гочи: `coloniesExtension: true` в `testGame`; старый бандл новую карту не рисует — стенд на своей сборке; **три цепных твина на 4K оставляли тайл
висеть — поза переезда = функция прогресса (TR14)**; `verifyMove` требует пустую клетку назначения (переезд на опасность — PL-040); у соперника в
фикстурах первой фазы открыт стартовый workspace — красный сворачивает его (B) перед сценой; `walkToSpace` + ОДИН Enter на уровне источника
(`placeTile` поднимет что попало); на 4K ждать `.con-hand:not(.con-hand--transit)` до `focusCard`; имена кадров скринкаста = время получения; рост колоды
сдвигает сдачу — свободные столы прибивать корпорациями без первого действия; `python3` — заглушка Store; `eqeqeq` без исключения для null; bash
heredoc с длинным RU — Write; `node -e` с бэктиками — Edit; `rtk grep` с фиксированной строкой виснет — Grep-инструмент; `/* */` внутри JSDoc закрывает
комментарий; `npm run build:server`, не голый `tsc` (alias).
**В отчёте:** что встало само (контракт TR14), что потребовало руки (набор, писатель, вид превью, слова), правила 1–12 спеком, вердикты по моментам
подачи (§5) с кадрами 4K, батч владельцу и ответы, регрессия (TR14 8 / 8), гарды, новые ключи, подтверждение решений 1–9, арт. **Раздел «ПОЛИРОВКА»**
— с перечнем СОБСТВЕННЫХ находок сверх §6. **Явно — всё, что не получилось сделать, и почему.**

## 8. Нельзя
`addOcean` / `PlaceOceanTile` / `removeTile` для переезда (ворота 9, параметр, Ares, Whales — чужие пути); вторая функция переезда или второй
шаг копией (`MoveCityTile` обобщается); вторая сцена переезда / второй прокси / куб на океане; городские слова на океанском пути; строка счётчика
океанов в досье переезда; клиентский вывод правила (соседство, «отведена ли клетка» — только списки маркера); `v-if`-переход между уровнями;
таймер вместо сигнала посадки; литерал имени карты в `src/client/**`; литерал кнопки контроллера; `title`; определение промпта по заголовку;
`compatibility`; e2e «на ещё одну карту» сверх одного спека; полировка только-для-Deck (PL-105); правка таймингов принятой сцены TR14 без A/B
(`tileMoveScene.spec` пинит константы); `shardPlan.json`; незакоммиченные файлы соседа; пуш и красные коммиты.
