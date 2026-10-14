# Промт исполнителю · TR47 Ecological Experiment («Экологический эксперимент») — красное событие, 18, Наука + Растение + Событие, плашка Учёных: «Поднимите КАЖДЫЙ марсианский глобальный параметр на 1 шаг и добавьте 3 data на ЛЮБУЮ карту. ЗАТЕМ опустите на 1 шаг каждый марсианский параметр, который НЕ на максимуме (снимите любой океан по выбору; РТ, который вы получили, остаётся)» · ГЛАВНОЕ — НОВЫЙ КЛАСС «ПАРАМЕТР ВВЕРХ И ОБРАТНО» (шкалы поднимаются на глазах у всех, награды подъёма остаются, не достигшие максимума шкалы опускаются назад — одной честной сценой, без потери РТ) + ИТЕРАЦИЯ ПОЛИРОВКИ «ЧТО ОТКРОЕТСЯ»: при наведении на снимаемый тайл он становится ПРОЗРАЧНЫМ и игрок видит, ЧТО под ним (печатный бонус клетки / фишка, которая остаётся) — во ВСЕХ случаях выбора тайла для снятия и подъёма

Выдан 2026-10-14. Инфраструктура набора стоит (TR01–TR46, TR48, TR50–TR52, TR66 сданы; TR49 пропущена владельцем) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§0 «Новая механика? — сначала её инфраструктура сквозным контрактом, потом карта»; §4 —
строки «карта ОТВЕЧАЕТ НА ШАГ ШКАЛЫ» (TR24), «ДЕЙСТВИЕ „цена с рельса → ШАГ ШКАЛЫ“» (TR41), «ПЕРЕМЕЩАЕТ ТАЙЛ» (TR14 / TR39), «ТАЙЛ ПОВЕРХ ТАЙЛА» (TR44);
постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Бесшовность — workspace-архитектура»**; **«Премиум-планка»**;
**«Качество полировки»** — сильная рабочая концепция или откат, оба конца каждого полёта ВИДИМЫ, сданное перепроверяется), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,board,
console-ui,animations,premium-card,tests}.md` (законы: **WORKSPACE IS ONE FLOW**, **PHYSICAL CAUSALITY** — «каждое изменившееся число имеет полёт
или строку причины на том же экране», **закон 27** — адрес pre-select, **все выборы — до коммита** (TR51), **отказ — кнопка внутри выбора**, **A BOARD
BEAT WAITS FOR A BOARD THE PLAYER CAN SEE** — парк доски и история шкал, **A SERVER'S PROJECTION MAY RIDE THE EVENT AS A FACT** — PL-041 / PL-133,
**«ДВА ТАЙЛА НА КЛЕТКЕ — ПЬЕСЫ»** — TR44), контракты — `docs/TURMOIL_REDUX_WATER_EXPORT.md` (§6 пикер снятия, §7 сцена ухода тайла),
`docs/TURMOIL_REDUX_HEAT_CAPTURE.md` / `docs/TURMOIL_REDUX_GAS_EXPORT.md` (мировой ход ВНИЗ — `parameterRoom`, названные пределы, `unrewarded`),
`docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md` §4 (члены слива парка — «ШАГ ШКАЛЫ ПЛАТИТ»), `docs/TURMOIL_REDUX_AQUATIC_RESEARCH_STATION.md` (океан из-под
города), `docs/claude/console/board-placement-flow.md` (ретикл, § A MOVE — поза `--pickup`), `docs/claude/console/tile-replacement.md`
(§ A pure REMOVAL — remote-стейдж), `docs/claude/board-information.md`, `docs/claude/terraforming-progress-hud.md`, `docs/TILE_PLAY_STAGED_COMMIT.md`
(staged-океан розыгрыша; класс «бонусный океан 0 °C встаёт ВПЕРЕДИ своего тайла»). Память: `tr39-move-reward` (PL-133 — награда переезда
публикуется сервером и играет последним тактом), `tr44-aquatic`, `plasma-fans` (PL-147 пороги шкал в прогнозе, TV-класс дуг), `scale-marker-never-lags`,
`board-beat-park`, `board-piece-keeps-its-kind`, `stall-2026-10-14` (поле: PL-290…; `cinematicBeat`, стенд вне git с `// @ts-nocheck`).

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-14, дословно):** «тут новая необычная механика которая требует очень тщательной проработки — шкалы должны подняться у всех
игроков а затем те что не на максимум уменьшится обратно (полученный бонус шкал остается). Промт какой океан убирать (если они не стали на максимум)
идет игроку как выбор на доске — тут особо важно что при наведении тайл становился прозрачным и было видно ЧТО под ним откроется (какой печатный
бонус или другой тайл) — это надо проработать во всех кейсах когда мы выбираем какой тайл снять — это бери в работу как полировка — ИГРОК ВСЕГДА
ДОЛЖЕН ПОНИМАТЬ ЧТО ИМЕННО ОН ОТКРОЕТ НА ДОСКЕ И КАКОЙ БОНУС РАЗМЕЩЕНИЯ СНОВА СТАНЕТ ДОСТУПЕН. Карта должна быть сделана реально качественно».
Три требования: **(1) ВВЕРХ И ОБРАТНО — честно и на глазах у всех**: три шкалы поднимаются (жетоны РТ, пороги), всё заработанное остаётся, затем те,
что не на максимуме, опускаются назад ОДНОЙ сценой с названной причиной «без потери РТ» — у игрока И у соперников (параметры общие: «у всех игроков» =
каждый видит ход шкал на своём экране); **(2) ВЫБОР ОКЕАНА — на доске, как шаг этого же розыгрыша** (крошка растёт, не новый экран);
**(3) ПОЛИРОВКА «ЧТО ОТКРОЕТСЯ» — класс для ВСЕХ пикеров снятия / подъёма тайла**: RX33 Water Export, действие Красных и Dry Deserts (классический
Turmoil — та же ступень), уровень источника TR39 (океан) и TR14 (город), Kaguya Tech (снять своё озеленение и поставить город), океан под городом TR44, сам
TR47: под курсором тайл прозрачен, под ним видны печатные бонусы клетки или фишка, которая остаётся; досье говорит словами, ЧТО откроется и какой
бонус снова станет доступен (или почему не откроется ничего). Решения — агент ищет сам; ниже диагноз и рекомендованная архитектура, финал — по кадрам
4K в батче владельцу.

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, файл:строка на `2f769a5e35` — подтвердить ДО правки):**
1. **Движок УМЕЕТ опускать шкалы, но только «ни для кого».** `Game.increaseTemperature :1964–2057` и `increaseOxygenLevel :1779–1842` принимают
   отрицательные шаги: ветка понижения (`:1971–1980`, `:1789–1802`) НЕ платит РТ, НЕ будит пороги (`claimCrossedScaleBonuses :1771` — заявки не
   снимаются: крышка порога, пройденная вверх, остаётся), НЕ зовёт `globalParameterRaised` (TR24 / Aphrodite молчат — верно) и пишет ПОДПИСАННОЕ
   событие `recordGlobalParameterChange(rewarded ? player : undefined, …, −1)` (`EventRecorder.ts:973`: `player: undefined` = «никто в своё имя»).
   Прецеденты карт: `pathfinders/MagneticFieldStimulationDelays.ts:24–25` (−2 / −2 первому игроку), `HydrogenProcessingPlant.ts:19` (`global: {oxygen: -1}`
   — декларативно, предупреждение `maxoxygen-reduce` в `Executor.ts:88–90`), классические Красные `turmoil/parties/Reds.ts:196–213`; мировые ходы Redux —
   RX12 `GasExport.ts:139`, RX14 `HeatCapture.ts:128–160` (**ОДНА арифметика «места» `common/parliament/parameterRoom`** — потолок / пол / пороги подъёма,
   `atLimit` НАЗЫВАЕТСЯ, `unrewarded: true` = режим Мирового правительства). Потолок — ранний `return` (`:1965`, `:1780`), подъём при максимуме — ничего и
   молча; `Executor.canExecute :83–101` ставит `maxtemp` / `maxoxygen` / `maxoceans` ПРЕДУПРЕЖДЕНИЯМИ (официальное правило: карта играбельна, шаг не делается).
2. **Снятие океана — две ступени, одна честная.** `deferredActions/RemoveOceanTile.ts` — голый `SelectSpace` без маркеров, при пустом наборе молча
   `undefined` (Красные, Dry Deserts); `parliament/resolutions/ResolutionTileRemoval.ts:60–108` — честная форма RX33: ДВЕ названные причины
   (`OCEANS_AT_MAX_REASON`, `NO_REMOVABLE_OCEAN_REASON` — `common/parliament/tileRemoval.ts`, там же `tileRemovalRoom`), маркеры `placementEffect: 'remove'`,
   `placementType: 'ocean-removal'`, `tileType: OCEAN`, `committedPlacement(…, source)`, снятие — `Game.removeTile` (после TR44 — `liftOcean`: из-под города
   уходит только вода). Легальный набор `MarsBoard.getAvailableSpacesForType('ocean-removal') :123` = `getOceanSpaces({upgradedOceans: false})`
   (`hasPlainOcean :631` — океан под городом TR44 ВКЛЮЧЁН). Факты досье `BoardInformationEngine.tileRemovalFacts :1303–1325`: «океанов N → N−1», «**бонусы
   клетки НЕ возвращаются; океан, поставленный сюда позже, заплатит их снова**», «РТ никто не теряет», «Город остаётся» (TR44), Столица −1 ПО.
   **Ни слова о том, ЧТО ОТКРОЕТСЯ** (какой печатный бонус лежит под снимаемым океаном) — хотя `printedBonusFacts :492–521` умеет это сказать.
3. **Поле: тайл под курсором снятия НЕ прозрачен, и ретикл рисует над ним ВТОРОЙ объект.** `ConsoleBoardInput.vue:567–572` — для `'remove'` герой не
   армится (уход — событие доски, `consoleRemotePlacement.liftRemote :745`, `markCellVacated`, осадка `board.less:438–446`); `ConsoleBoardSection.
   cursorArtClass :568–584` исключает призрак только для `marker` / `bonus-only` / `movePick` — при `tileType: OCEAN` на промте снятия **проекция океана
   ложится НА реальный океан** (проверить стендом RX33; для источника переезда уже решено позой `--pickup`: «призрак тайла над тайлом — второй объект»,
   `ConsoleBoardCursor.vue:31–33`). `placementRenderState.ts:21–31` — закон «ОДИН владелец — кинематика»: `hiddenTiles` снимает спрайт только в такте
   отъезда (Kaguya), а «любая другая занятая цель держит тайл видимым — базовый тайл есть информация»; владелец это уточняет: **ИНФОРМАЦИЯ — это и то, что
   ПОД тайлом**. Механика есть наполовину: `BoardSpace.vue:26` рисует `<bonus>` только при `showBonus :385–395` (пусто / cleared); `board.less:428–430`
   `--placement-cleared` гасит спрайт; `.board-space-bonus` (`:641–660`, z 0) — иконки печатного бонуса; `applyVacatePreview` (`tilePlacementModel.ts:
   1048–1057`) открывает бонус под поднимающимся тайлом — но в СЦЕНЕ, после коммита, не пока игрок целится. Инспектор занятой клетки (`boardCellInfo :76–120`)
   печатные бонусы не перечисляет (только `isPlaceable`). Досье снятия (`placementDossier.dossierSections :718–803`): `remove-ocean` → «ЭФФЕКТ КЛЕТКИ»,
   `remove-ocean-no-tr` → «ПРАВИЛА ПОЛЯ», `remove-capital` → «ДРУГИЕ ИГРОКИ»; уровень источника переезда — секция «ЭТОТ ОКЕАН / ЭТОТ ГОРОД» + «что
   остаётся» (PL-289), «ПРЕЖНЯЯ КЛЕТКА» с бонусом — ТОЛЬКО на уровне клетки назначения (`departure`). Kaguya (`promo/KaguyaTech.ts:85–103`): досье даёт
   бонус (`cleared`), поле держит озеленение до кинематики.
4. **История шкал читает ДИФФ двух видов — ход «вверх и обратно» в ОДНОМ ответе даёт ноль.** `boardBeatPark.ts` держит ПОКАЗАННЫЕ значения и сливает
   «settle → глайд → окно → члены (`scaleStepRatingBeat` — по жетону РТ на шаг с кромки маркера, `scaleStepRewardBeat` — TR24) → батч»; `scaleStepRatingBeat`
   читает «рейтинг вырос ровно на шаги шкал» из диффа двух видов. Если температура поднялась и опустилась в одном ответе (океаны на максимуме — вопроса о
   снятии нет), дифф = 0: маркер не шелохнётся, **+N РТ тикнет без причины** — ровно класс PL-133 / PL-041: ФАКТ движения публикует сервер (кольца с `seq`:
   `game.tileMoves`, `cardAdjacencyPayouts`, `scaleStepRewards`, `lastTileMoveReward`). HUD-ридауты: `ConsoleFlipValue` — **«a DECREASE snaps with no
   flip»** (`docs/claude/terraforming-progress-hud.md:6`) — понижение в полосе статуса сегодня схлопывается без такта; дельта-чипы «−1» есть. Маркер дуги
   (`AnimatedScaleMarker`) ездит в обе стороны (память `scale-marker-never-lags`); крышки порогов (`boardBeatDisplayClaims`) при откате ниже порога
   остаются заявленными — правильно (бонус получен).
5. **Прогноз знает только подъём.** `effectForecast.scaleBonusPass :557–620` — пороги ПОДЪЁМА (8 % → шаг температуры и ЕГО пороги курсором, −24 / −20 пр.
   тепла, 0 °C океан, потолок → `skipped`); `withImpliedRating` (`actionPreviews.ts:182`, выходной проход всех дверей) — implied «+1 РТ» после чипа шкалы.
   `cardPlayPreview.ts:116–119`: **хук `cardPlayPreview` ЗАМЕНЯЕТ декларативное превью целиком** — двери «дополнить хвостом» нет; `deriveCardPlayBranches` /
   `stepsForBehavior` (`actionPreview.ts:708–803`) — порядок шагов = порядок дефера исполнителя (`addResourcesToAnyCard → … → ocean → city → greenery → tile`),
   океан розыгрыша — staged-шаг. `Executor.ts:551–558` поднимает температуру, затем кислород (синхронно), `:688–698` откладывает `PlaceOceanTile` (DEFAULT),
   `:588–625` поднимает пик data до `PLAY_CARD_RESOURCE_CHOICE` при наличии размещения (спрашивается ДО океана — пре-сбор); бонусный океан 0 °C — `PlaceOceanTile`
   из `increaseTemperature :2039–2042` (DEFAULT, источник `{kind: 'system', name: 'Temperature bonus step'}`) — ЖИВОЙ промт после розыгрыша (класс фикстуры
   `staged-interposer`, `generate.ts:532–545`). `Priority.ts`: `BACK_OF_THE_LINE` — последняя ступень очереди.
6. **Фикстуры и сеттеры:** `scientificBreakthroughFixture` (`generate.ts:2641–2668` — `seatEnacted(parliament, quietResolutionOf(SCIENTISTS))`, второй клиент —
   красный), `setTemperature` / `setOxygenLevel` / `maxOutOceans` / `addOcean` (`:504–506`, `:540`), `aquaticFixture` (станция над океаном). E2E соседей:
   `console-parliament-water` (RX33: «the first player removes an ocean and both clients see it leave»), `console-canyon-carving` (TR39, уровень источника),
   `console-re-settlement` (TR14), `console-tile-replacement` (Kaguya: «the greenery LEAVES, its bonus surfaces»), `console-aquatic-research-station` (океан
   из-под города), `console-staged-play` (бонусный океан 0 °C впереди staged-тайла), `console-plasma-fans` (шаг шкалы от действия), `console-scale-marker`.
7. **Слова:** «Tile removal» → «Снятие тайла» (`console.json:241`), «Removal» → «Снятие» (`parliament.json:2`), «The ocean tile leaves the board» / «Nobody
   loses TR» / «The city stays» (`board_info.json:89–112`), «Экологич…» — только «Экологическая зона» / «Экологическая разведка» / «Эксперты-экологи»
   (имя свободно). Лор ПРИДУМАН (`turmoil-redux-invented-lore.md:22`: «The results were inconclusive. The jungle was not.» / «Результаты оказались
   неоднозначными. Джунгли — нет.» — «ждёт карту» → «в коде»). Арт `Mars Arts/TR47.png` ЕСТЬ. `CardName` — между `RESEARCH_STARTUPS` (`:1120`) и
   `SUPERCOMPUTER` (`:1121`); манифест — между TR46 (`:242`) и TR48 (`:246`).
8. **Реестр:** последний раздел AI (TR44, PL-287…289, 320…328); footer «Следующий свободный номер **PL-329**»; TR47 берёт раздел **AJ** — номер и букву
   объявлять В МОМЕНТ записи (соседи заняли AG / AH параллельно — TR44 ушёл в AI). Открытые строки на маршруте: PL-325 (подсмотр TR45 на клетке с двумя
   фишками на экране), PL-293 (всплески растра при полёте копий — механизм открыт), «a DECREASE snaps with no flip» (без номера).

**Обязательное чтение до кода:** `src/server/Game.ts:1764–1842, 1955–2060` (шкалы, заявки порогов, бонусный океан), `:2753–2790` (`removeTile` /
`liftOcean`), `deferredActions/{RemoveOceanTile.ts, PlaceOceanTile.ts, Priority.ts, skippedEffect.ts}`, `parliament/resolutions/{ResolutionTileRemoval.ts,
reds/HeatCapture.ts, reds/GasExport.ts, WinnerParameterStep.ts}`, `common/parliament/{parameterMove.ts, tileRemoval.ts}`, `behavior/Executor.ts:80–105,
545–560, 585–630, 685–700`, `models/{cardPlayPreview.ts:100–160, actionPreview.ts:700–810, effectForecast.ts:530–625, 1085–1135}`, `cards/actionPreviews.ts`
(`withImpliedRating`, `globalGain`, `skippedAddToCard`, `warningNote`), `boards/BoardInformationEngine.ts:76–130, 140–260, 486–540, 1285–1325`,
`boards/MarsBoard.ts:105–135, 615–640`, `events/EventRecorder.ts:965–990`, `IGame.ts` (кольца `tileMoves` / `cardAdjacencyPayouts`, `lastTileMoveReward`),
`models/ServerModel.ts` (их экспорт). Клиент: `console/boardBeatPark.ts` целиком, `console/scaleStepReward/*`, `components/board/{scaleMarkerArrival.ts,
AnimatedScaleMarker.vue, ArcScale.vue}`, `components/console/ConsoleStatusStrip.vue` + `ConsoleFlipValue.vue`, `console/tilePlacement/{consoleRemotePlacement.ts:
700–800, tilePlacementModel.ts:920–960, 1040–1070, remoteRevealHold.ts, placementMove.ts}`, `components/console/{ConsoleBoardInput.vue:300–360, 540–600,
ConsoleBoardCursor.vue, ConsoleBoardSection.vue:540–610, ConsoleContextPanel.vue}`, `components/{BoardSpace.vue, board/BoardSpaceTile.vue, board/
placementRenderState.ts, board/Bonus.vue}`, `src/styles/board.less:400–460, 600–720`, `console/{placementDossier.ts, consolePlacementNextStep.ts,
consoleTaskSummary.ts:185–200, consoleTaskRouter.ts:355–445}`, `console/parliament/{parliamentWorldBeat.ts, tileRemovalModel.ts, worldMoveModel.ts}`
(как Redux РИСУЕТ ход шкалы вниз у заседания — переиспользовать язык), `console/played/consolePlayedHero.ts` (рельс розыгрыша — РТ розыгрыша),
`console/transport/gameTransport.ts` (`seedRewardHolds`). Карты-образцы: `turmoilRedux/{ScientificBreakthrough.ts (плашка Учёных, bespoke-порядок
«цена → эффект»), CanyonCarving.ts (переезд + PL-133), PlasmaFans.ts (шаг шкалы), AquaticResearchStation.ts}`, `pathfinders/MagneticFieldStimulationDelays.ts`,
`promo/KaguyaTech.ts`. Тесты-образцы: `tests/parliament/{HeatCapture, GasExport, WaterExport}.spec.ts`, `tests/boards/{oceanMove, waterExportRemoval*,
TwoTileCell, placementPreviewConsistency, placementEffectConsistency}.spec.ts`, `tests/client/console/boardBeatPark.spec.ts`, `tests/client/components/
console/{scaleStepRatingBeat, waterExportRemovalScene, tileMoveScene}.spec.ts`, `tests/models/{cardPlayReplayCoverage, effectForecastCoverage}.spec.ts`.
Память: `board-beat-park`, `tr39-move-reward`, `plasma-fans`, `scale-marker-never-lags`, `tr44-aquatic`, `board-piece-keeps-its-kind`,
`storyboard-catches-what-the-probe-passes`, `polish-premium-bar`, `polish-quality-no-regressions`, `perf-measure-on-gpu-not-swiftshader`,
`e2e-board-cursor-legal-only`, `concurrent-session-edits-same-files`, `ab-baseline-head-client-in-snapshot`.

Номера строк сняты с `2f769a5e35` — перед правкой перечитать.

**Что это за карта.** Красная (EVENT), **18**, метки **Наука + Растение + Событие**, требование **Учёных**, без ПО: *«Requires the Scientists to be
ruling or that you have 2 delegates there. Increase each Mars global parameter 1 step, and add 3 data resources to ANY card. Then decrease each Mars
global parameter that isn't at maximum by 1 step. (Remove any ocean you like; keep the TR you gained.)»*

**Оценивается — в этом порядке веса.**
1. **КЛАСС «ВВЕРХ И ОБРАТНО» ВЕРЕН И ВИДЕН** (≈ 30 %) — правила 1–14 спеком; качели — ФАКТ сервера (не дифф), сцена шкал у игрока и у соперника:
   подъём с жетонами РТ и порогами → (вопрос снятия) → откат ТРЁХ шкал одной фразой с причиной «без потери РТ», без мёртвого времени, без обрыва;
   параметр, достигший максимума, остаётся и назван; HUD не схлопывается.
2. **ПОЛИРОВКА «ЧТО ОТКРОЕТСЯ» — ОДИН КЛАСС ДЛЯ ВСЕХ ПИКЕРОВ СНЯТИЯ / ПОДЪЁМА** (≈ 30 %) — тайл под курсором прозрачен, бонус / фишка под ним
   видны с дивана, досье говорит словами, ретикл без второго объекта; работает в RX33, TR47, у источника TR39 / TR14, у Kaguya, над океаном TR44;
   переведённые e2e соседей зелёные.
3. **МАРШРУТ TR47 НА 4K** (≈ 25 %) — композер читает ДВЕ фазы и итог до нажатия; staged-океан; посадка; история шкал вверх; data на миниатюру;
   шаг «СНЯТИЕ ОКЕАНА» в крошке; откат; соперник видит всё; журнал / нотификации честны.
4. **Остальное** (≈ 15 %) — лицо, лор, локаль, §6.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Понижение шкалы** | отрицательные шаги в `increaseTemperature` / `increaseOxygenLevel`: без РТ, без порогов, подписанное событие; потолок — молчаливый `return`; `parameterRoom` — одна арифметика места (RX12 / RX14) |
| **Снятие океана** | `RemoveOceanTile` (голый, молчит) · `tileRemovalStep` (маркеры, две причины, `liftOcean`); набор `{upgradedOceans: false}` ВКЛЮЧАЕТ океан под городом |
| **Поле при снятии** | тайл непрозрачен; ретикл — проекция океана НАД океаном (проверить); `hiddenTiles` только в такте отъезда; `showBonus` только пусто / cleared; бонус открывается `applyVacatePreview` в сцене |
| **Досье снятия** | «уходит», «бонусы не возвращаются», «РТ никто не теряет», «Город остаётся», Столица −1; что ОТКРОЕТСЯ — нет |
| **История шкал** | парк → слив по ДИФФУ видов; жетон РТ на шаг с маркера; крышки порогов не снимаются; HUD: понижение — snap без флипа |
| **Прогноз** | `scaleBonusPass` — пороги подъёма; implied РТ; хук `cardPlayPreview` ЗАМЕНЯЕТ декларативное превью |
| **Порядок очереди** | data (`PLAY_CARD_RESOURCE_CHOICE`) → океан карты (DEFAULT, staged) → бонусный океан 0 °C (DEFAULT, живой) → … → `BACK_OF_THE_LINE` |
| **Фикстуры** | Учёные принятой резолюцией (`seatEnacted`), сеттеры шкал, второй клиент — красный; `aquaticFixture` |
| **Арт / лор / имя** | арт ЕСТЬ; лор придуман (`:22`); `CardName` между TR46 и TR48 |
| **Реестр** | footer **PL-329**; раздел **AJ** (объявить в момент записи) |

### Чтение скана (`…\Projects\Card_-_TR47.png`)
Цена **18**, КРАСНАЯ рамка (EVENT). Плашка «MIN» у цены — **эмблема Учёных** (колба) = ТРЕБОВАНИЕ `{party: PartyName.SCIENTISTS}`, не метка. Метки
справа, по порядку печати: **Наука** (атом), **Растение** (лист), **Событие** (жёлтый диск со стрелкой вниз). Название «ECOLOGICAL EXPERIMENT». Один
ряд: **[кислород] [температура] [океан]** (три значка марсианских параметров — Венеры НЕТ) **3 [data]\*** (три data на ЛЮБУЮ карту), вертикальная
черта, **«THEN»**, **− [кислород] [температура] [океан]** → `b.oxygen(1).temperature(1).oceans(1).nbsp.resource(CardResource.DATA, {amount: 3}).asterix()
.nbsp.text('THEN', …).minus().oxygen(1).temperature(1).oceans(1)` (сверить с ПЕЧАТЬЮ: порядок значков O₂ · t° · океан; «3» как число перед одним
значком data; «THEN» — печатное слово ряда, образец разделителя — `b.text('THEN')` у соседей с «затем»-рядом, если есть; иначе ОДИН узел-разделитель
рендер-DSL, которым пользуются лицо и композер). ПО нет. Цитаты НЕТ → лор из реестра. Внизу слева — фиолетовый ромб Turmoil (модуль, без
`compatibility`; ▲ Колоний и значка Венеры НЕТ). Подпись арта — «ON-A». Номер «TR47».

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/EcologicalExperiment.spec.ts`; класс «вверх и обратно» — своими спеками, §4)
1. **Требование** — плашка Учёных: правят или 2 СВОИХ делегата на их резолюции; при розыгрыше; TR36 порог ТРЕБОВАНИЯ не снижает.
2. **ВВЕРХ — каждый МАРСИАНСКИЙ параметр на 1 шаг обычным подъёмом**: температура +2 °C, кислород +1 %, океан +1 (= РАЗМЕЩЕНИЕ тайла океана — выбор
   клетки, печатный бонус и соседство клетки, Ares); Венера — НЕ марсианский параметр, не трогается. Каждый сделанный шаг платит игроку **+1 РТ**
   (`{global: true}`: Зелёные Redux отвечают, TR24 / Aphrodite — нет (Марс)), будит пороги подъёма: −24 / −20 °C → +1 пр. тепла; **0 °C → бонусный океан**
   (второе размещение, +1 РТ); **8 % O₂ → +1 шаг температуры** (+1 РТ, с ЕГО порогами). Параметр УЖЕ на максимуме → шаг не делается, РТ нет — НАЗВАНО до
   нажатия («температура на максимуме — шаг не делается»), карта играбельна (официальное правило; `maxtemp` — предупреждение). Океаны на 9 → океан не
   ставится, РТ нет — названо.
3. **+3 data на ЛЮБУЮ карту** — любая СВОЯ карта-держатель data (свой стол + SRR, соперник — никогда; TR43 правило 3), ОБЯЗАТЕЛЬНО (без «may»), цель —
   pre-select в композере, никогда авто (один держатель — тоже шаг); нет держателя → пропуск ПО ИМЕНИ (`skippedAddToCard`), карта играбельна.
   Спрашивается ДО океана (`PLAY_CARD_RESOURCE_CHOICE`), садится адресно (закон 27).
4. **ЗАТЕМ — после того как ВСЁ, что породил подъём, разрешено** (океан карты, бонусный океан 0 °C, шаг температуры от 8 %, data): каждый марсианский
   параметр, который **НЕ на максимуме ПОСЛЕ подъёма**, опускается на 1 шаг: температура −2 °C (никогда ниже −30), кислород −1 % (никогда ниже 0),
   океаны −1 = **снять ЛЮБОЙ простой океан по выбору игрока** (чей угодно, только что поставленный — тоже, океан под городом TR44 — тоже: город остаётся;
   составной — никогда). Параметр, который подъём довёл ДО максимума, **остаётся** (в этом смысл эксперимента); параметр на максимуме ещё до
   розыгрыша — ни вверх, ни вниз («на максимуме: без изменений» — названо). Нет ни одного простого океана при океанах < 9 → названный пропуск
   (`NO_REMOVABLE_OCEAN_REASON`).
5. **ОСТАЁТСЯ ВСЁ, ЧТО ДАЛ ПОДЪЁМ**: РТ (по шагу, бонусный океан, шаг от 8 %), пр. тепла порогов, бонус клетки и соседство поставленного океана, data.
   **Откат НЕ платит и НЕ забирает**: РТ не возвращается, пороги не пере-взводятся (заявки стоят — `claimCrossedScaleBonuses`), бонус клетки снятого
   океана не возвращается (следующий океан там заплатит снова), Столица рядом со снятым океаном — −1 ПО (факт на событии, класс PL-041), пассивы
   партий на откат не отвечают. Событие понижения — `global-parameter-changed` с ОТРИЦАТЕЛЬНЫМИ шагами **С АВТОРОМ** (это эффект карты игрока —
   `increaseTemperature(player, −1)` БЕЗ `unrewarded`: отрицательная ветка и так не платит, а событие должно назвать, кто опустил; `unrewarded` — режим
   Мирового правительства и мировых ходов «ни для кого» — здесь ложь об авторе); снятие — `tile-removed` с актором.
6. **Выбор океана — ШАГ ЭТОГО ЖЕ РОЗЫГРЫША на доске**: промт с серверными маркерами (`placementEffect: 'remove'`, `placementType: 'ocean-removal'`,
   `tileType: OCEAN`, `committedPlacement(…, {kind: 'card', card})`), никогда авто (один океан — тоже вопрос, инвариант 3), крошка «КАРТЫ В РУКЕ ›
   ЭКОЛОГИЧЕСКИЙ ЭКСПЕРИМЕНТ › СНЯТИЕ ОКЕАНА» (`FOLLOW_UP_STEP_STAGES` — ключ «Removal» / «Снятие»), workspace уступает доску и возвращается (как
   бонусный океан 0 °C), бар — «A Снять океан» / двухфазный лок, досье — факты снятия + «ЧТО ОТКРОЕТСЯ» (§2.2). Выбор ПОСЛЕ коммита честен: он
   зависит от того, куда лёг океан (и бонусный) — закон TR51 не нарушен (ответ не был известен до «A»); свидетель `postCommitGuard` знает эту
   форму (`placementEffect 'remove'` с источником-картой — не «выбор, ответ на который был известен»).
7. **Порядок второй половины** (решение 2, рекомендация): при океанах < 9 — СНАЧАЛА вопрос «какой океан», затем в ответе на него — откат ВСЕХ трёх
   (снятие, −2 °C, −1 %) ОДНОЙ фразой; при океанах на максимуме — вопроса нет, откат температуры / кислорода приходит в ответе последнего промта
   подъёма (или самого розыгрыша). Так одна сцена «ОБРАТНЫЙ ХОД» в одном ответе — и ровно поэтому нужен ФАКТ качелей (правило 8).
8. **КАЧЕЛИ — ФАКТ СЕРВЕРА** (класс PL-133 / `scaleStepRewards`): розыгрыш публикует запись `parameterSwing` (кольцо с `seq`, как `tileMoves`): по
   параметру — `before · peak · after`, шаги вверх / вниз, заявленные пороги, РТ за подъём, `atMax` («остался на максимуме»), снятая клетка; клиент
   играет ВВЕРХ (из диффа / парка — как сегодня, с жетонами) и ВНИЗ (из записи — без жетонов, с подписью «−1 · РТ остаётся»), никогда из диффа,
   который для «вверх и обратно» равен нулю. Не сериализуется (презентационное кольцо; после перезагрузки — честный дифф).
9. **Метки и ответы стола**: Наука → Olympus Conference / Mars University / Pharmacy Union — вопросы стола ПРЕ-шагами композера (закон TR51);
   Растение → Decomposers (+1 микроб), Ecological Zone (+1 животное), Viral Enhancers (+1 растение); Событие — в стопку событий (Media Group +3 M€),
   метка Науки события из счёта уходит (правило движка); +3 data → Martian Fiber (+1 M€ за data — класс TR46); РТ подъёма → Зелёные Redux (+2 M€ за шаг).
   Прогноз (`cardPlayedForecast`, `scaleBonusPass`, `withImpliedRating`) называет всё до нажатия: implied РТ, пороги, ответы, откат.
10. **Превью = исполнение** (`replayBatch`, ноль переспросов): батч `[play, {card: data}, {space: ocean, staged}]`; бонусный океан и снятие — честные
    follow-up'ы, названные в «ДАЛЕЕ» (бонусный — только когда 0 °C пересекается).
11. **Журнал**: строки подъёма (движок), размещение, data, «decreased the temperature 1 step (0 °C → −2 °C) — the TR stays», «decreased oxygen…»,
    «removed an ocean tile from <клетка>» с актором, пропуски по имени («Oxygen is at its maximum — not lowered»).
12. **Соперник**: нотификация розыгрыша с качелями («+1 → −1» по шкалам, снятая клетка, «+N РТ у синего»), на доске — та же история шкал вверх /
    вниз и уход океана (`liftRemote`), Столица теряет — названо (PL-041).
13. **MarsBot** карту не играет; его океаны — кандидаты; его журнал хода читает поле.
14. **Save / load**: шкалы и поле — движок; кольцо качелей — не сериализуется; перезагрузка между вопросом и откатом — промт снятия перестраивается
    (`committedPlacement`), откат — в ответе.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **RU-имя «Экологический эксперимент»** (Grep — свободно); лор — из реестра придуманного (EN / RU выше).
2. **Порядок второй половины — (а) сначала вопрос о снятии, откат трёх шкал в его ответе** (правило 7; рекомендация: одна сцена, одна причина).
   Альтернатива (б): опустить температуру / кислород сразу в ответе розыгрыша, снятие — отдельным вопросом (две сцены отката, второй ответ пустой).
3. **Качели — факт сервера** (правило 8; рекомендация). Альтернатива — клиент читает события журнала из ответа: против (журнал — не канал сцены,
   события приходят своим маршрутом).
4. **ПОЛИРОВКА «ЧТО ОТКРОЕТСЯ» — концепция по кадрам 4K** (агент снимает ДО / ПОСЛЕ на четырёх стендах: RX33 `parliament-water`, TR39 `canyon-carving`,
   TR14 `re-settlement`, Kaguya `tile-replacement` + TR44-клетка из `aquatic-*`):
   - **(а) «ПРОСВЕТ» (рекомендация).** Кандидат под курсором: тайл (и его куб) уходит в полупрозрачность (opacity ≈ 0,35, без `filter`), под ним
     КРАСЯТСЯ печатные бонусы клетки (`<bonus>` показан — те же иконки, что на пустой клетке), фишка, которая ОСТАЁТСЯ (город над океаном TR44, нижние
     ярусы стопки), — непрозрачна; ретикл — поза `--pickup` (кольцо на реальном тайле, без призрака); досье — новая секция **«ОТКРОЕТСЯ»** (ключ
     `uncovers`): печатные бонусы клетки чипами (`printedBonusFacts(space, false)` под своим id `uncover-*`, timing `future` — «снова доступны следующему
     тайлу»), «Резерв океана снова примет океан: +1 РТ и бонус» (клетка-резерв), «Клетка суши снова свободна» (Artificial Lake), «Ничего не откроется —
     на клетке остаётся город» (TR44), «Бонуса нет» (клетка без печати) — ОДНА строка на факт (PL-287); у Kaguya — «откроется и ТУТ ЖЕ будет получено»
     (`cleared`). Соседи, которые теряют (Столица), — слой отношений тоном `penalty`. Ничего не анимируется, пока игрок целится (закон досье): просвет
     — мгновенный класс, без перехода > 100 мс.
   - **(б) «ПОДЪЁМ»**: тайл приподнимается на 2 px и светлеет (поза подъёма источника переезда), бонус под ним — то же (а) + мотив движения.
   - **(в) Только досье** (без просвета на поле) — отвергнуто акцентом.
   Рекомендация — (а): один класс для всех пикеров, поле и досье говорят одно, движения нет (игрок целится).
5. **Скоуп полировки**: все пикеры снятия / подъёма — RX33, TR47, действие Красных + Dry Deserts (общая ступень — даром), уровень источника TR39 / TR14,
   Kaguya Tech (`hiddenTiles`), океан под городом TR44, Lunar Mine Urbanization (Луна — вне скоупа, структурно получает). НЕ скоуп: накрытие опасности
   Ares (опасность не снимают выбором; бонус под ней не выдаётся — `bonusesCovered`), Desperate Measures (защита, не снятие).
6. **HUD-ридаут при понижении** — обратный флип (сейчас snap) — строка реестра, сделать здесь (К-E6).
7. **«ANY card» = своя** (TR43 / TR48 прецедент).
8. **e2e: ОДИН новый спек** `tests/e2e/console-ecological-experiment.spec.ts` (§4); полировка — в переведённых спеках соседей (инвариант 14).
9. **Батч — ПЕРВЫМ после кадров концепций**, одним `AskUserQuestion` (≤ 4 вопроса, рекомендация первым): (1) концепция просвета (решение 4) с
   путями к кадрам ДО / ПОСЛЕ на четырёх стендах; (2) порядок отката (решение 2); (3) факт качелей (решение 3) + обратный флип HUD (решение 6);
   (4) строки «ждёт владельца» на маршруте (`grep` в момент батча).

---

## 0. Рабочее дерево
HEAD `2f769a5e35`. **СОСЕД АКТИВЕН** — незакоммичены его `src/server/{Game.ts, IGame.ts, deferredActions/DeferredActionsQueue.ts, routes/
ApiGameJournalEvents.ts}`, `src/client/components/notifications/{NotificationLayer.vue, notificationState.ts}`, `src/client/components/console/
ConsoleActionComposer.vue`, `src/client/console/{actionPreviewStore.ts, consoleBatchArrivalMotion.ts}`, `.claude/rules/console-ui.md`, реестр, спеки
`consoleOutcomeStage` / `notificationState` / `settleBatchProxies` / `openEventCorrelations` / e2e `console-research-startups` / `wsStageParity`, новый
`tests/console/branchOutcomeClaimPlan.spec.ts`. **TR47 тоже трогает `Game.ts` / `IGame.ts` (кольцо качелей) и реестр** — ListAgents + SendMessage соседу
ДО первой правки этих файлов (память `concurrent-session-edits-same-files`); его ханки — не в своих коммитах. Коммиты — только через временный индекс
(`GIT_INDEX_FILE` абсолютным путём; **read-tree → commit ОДНОЙ командой** при активном соседе; `git reset -q -- <свои пути>` после — реальный индекс
держит старые блобы; ханки одного файла — НЕ `--unidiff-zero`), `git add` своими путями; после коммита — `git restore --staged package.json
package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr47`, `TM_E2E_ROOT=.e2e-tr47`; 4K — `--workers=1` + `TM_E2E_GPU=1`; **тайминги — A/B на одном
снапшоте, на тихой машине** (память `ab-baseline-head-client-in-snapshot`; TR44: под нагрузкой ×3).

## 1. Сервер
**Коммит 1 — КЛАСС «ВВЕРХ И ОБРАТНО» (общий слой), без карты.**
(а) **Снятие — ОДНА ступень с маркерами.** `RemoveOceanTile` становится честной: набор `getOceanSpaces({upgradedOceans: false})`, маркеры RX33
(`placementEffect 'remove'`, `placementType 'ocean-removal'`, `tileType OCEAN`, `placementContext = committedPlacement(title, source)` — источник
карты / резолюции / партии через `cause`), пустой набор → `recordSkippedEffect(player, SKIP_REASON…, …)` с `NO_REMOVABLE_OCEAN_REASON` (никогда молчаливый
`undefined`), `andThen(space)` для вызывающего; `tileRemovalStep` (RX33) строит промт ЕЮ и оставляет себе только `ctx.report` + условие
`OCEANS_AT_MAX_REASON`; Красные / Dry Deserts получают маркеры даром (их спеки — без изменений поведения). Арифметика «можно ли снимать» —
`tileRemovalRoom` (общая).
(б) **Откат параметра — ОДНА функция** `Game.lowerParameters(player, parameters, {reason})` → для каждого: `parameterRoom({parameter, steps: −1}, table)`
→ при `atLimit` сверху (на максимуме) — названный пропуск («<параметр> is at its maximum — not lowered», `recordSkippedEffect`), при `moves` —
`increaseTemperature(player, −1)` / `increaseOxygenLevel(player, −1)` БЕЗ `unrewarded` (правило 5), журнальная строка с `before → after` и «the TR stays»;
океан — через ступень (а). Никакой второй арифметики «на максимуме ли» в карте.
(в) **Факт качелей** `game.parameterSwings` (кольцо, `seq` от `gameAge` — форма `recordTileMove` / `publishCardAdjacencyPayout`) с записью
`ParameterSwingModel {source: {card}, player: color, up: [{parameter, before, after, tr, claimed: [...]}], down: [{parameter, before, after} | {parameter,
atMax: true}], removed?: {space, tile}, seq}` → `GameModel.parameterSwings`; писатель — ОДИН (`recordParameterSwing`), зовётся из второй половины карты
(после отката); спек: запись совпадает с событиями `global-parameter-changed` того же ответа (гард паритета).
(г) **Превью декларативной карты + бесподобный ХВОСТ** — одна дверь: `models/cardPlayPreview.declarativeCardPlayPreview(player, card)` (сегодняшний
путь `base + deriveCardPlayBranches`) экспортируется, хук карты зовёт его и ДОПОЛНЯЕТ ветки хвостом (эффекты «затем» + шаги), выходные проходы
(`withImpliedRatings`, `withPreselectAddresses`) — как прежде. Запрещено переписывать первую половину руками.
(д) **Чтение отката для превью** — `actionPreviews.parameterSwingTail(player, raise)`: курсор шкал ПОСЛЕ подъёма (тот же, что `scaleBonusPass` ведёт
по порогам: 8 % → температура; 0 °C → +1 океан) → по параметру `parameterRoom(−1)` → чип «−1» (`globalGain` с отрицательным шагом, `current → resulting`
от ПИКА) или нота «на максимуме — остаётся» (`warningNote`-класс, тон `info`, не `warning`: это не потеря), океан — чип «−1 [океан] · снимите любой»
с SHOW-шагом «снятие на доске» в «ДАЛЕЕ»; итоговая строка «ИТОГ: параметры без изменений / +N РТ остаётся / +3 data / бонусы порогов» — числа от того же
курсора. Спек: превью ↔ исполнение на трёх столах (ниже максимума / один на максимуме / каскад 0 °C + 8 %).
Спеки коммита 1: `tests/game/ParameterSwing.spec.ts` (откат трёх, на максимуме — названо, пол, авторство событий, РТ не трогается, заявки стоят, Столица,
кольцо), `RemoveOceanTile.spec` (маркеры, пропуск по имени, из-под города), регрессия `WaterExport.spec` / `HeatCapture.spec` / `GasExport.spec` / классика
Красных / Dry Deserts / `placementPreviewConsistency` / `placementEffectConsistency`.
**Коммит 2 — карта** `src/server/cards/turmoilRedux/EcologicalExperiment.ts`: `CardName.ECOLOGICAL_EXPERIMENT = 'Ecological Experiment'`; EVENT, 18,
`[Tag.SCIENCE, Tag.PLANT]` (событие — тип), `requirements: {party: PartyName.SCIENTISTS}`; **первая половина — ДЕКЛАРАЦИЯ**: `behavior: {global:
{temperature: 1, oxygen: 1}, ocean: {}, addResourcesToAnyCard: {type: CardResource.DATA, count: 3}}` (порядок исполнителя: температура → кислород →
data-пик впереди → staged-океан); **вторая половина — `bespokePlay` одной отложенной ступенью `Priority.BACK_OF_THE_LINE`** («после всего, что породил
подъём»): `tileRemovalRoom` → при `removes` — ступень (а) с `cause: cardSource(this)` и `.andThen(space → lowerParameters(['temperature', 'oxygen']) →
recordParameterSwing)`; при `atMax` — `lowerParameters(['temperature', 'oxygen'])` → запись сразу; хуки co-located: `cardPlayPreview` (дверь (г) + хвост
(д)), `cardPlayedForecast` — нет (метки будят соседей сами). Без `compatibility`. Шапка — чтение скана + правила 1–14 + «лор придуман».
Гарды §3 чеклиста: `cardPlayReplayCoverage` (батч `[play, {card}, {space}]` — три профиля, follow-up'ы названы), `cardPlayPreviewCoverage`,
`consolePlayPreviewCoverage`, `effectForecastCoverage`, `promptMarkerGuard`, `make:cards` 0 / 0 / 0.

## 2. Клиент — ГЛАВНОЕ
1. **Сцена «ОБРАТНЫЙ ХОД»** (`console/scaleSwing/` — модель + директор, чистые юниты): читает `parameterSwings` (новое `seq` — как `tileMoveRecords`),
   играет ПОСЛЕ истории подъёма (член слива парка — после `scaleStepRatingBeat` и TR24; у соперника — тот же член, запись общая) и после ухода океана
   (`liftRemote` / сцена снятия — её `onCleared`): три маркера отступают ПО ОЧЕРЕДИ (океан-счётчик → температура → кислород, или порядок владельца),
   каждый — глайд назад (маркер `AnimatedScaleMarker` умеет), крышки порогов СТОЯТ, подпись у маркера «−1 · РТ остаётся» одним тактом (класс чипа
   шкалы — `scaleBonusZones` / дельта-чип TV-класса), HUD-ридаут — ОБРАТНЫЙ флип (решение 6, `ConsoleFlipValue`); параметр `atMax` — маркер не движется,
   у него коротко горит крышка «МАКС» (одна и та же плашка, что у заявленного порога); никакого жетона РТ, никакой монеты. Reduced motion — snap +
   подпись. Удержание — НАЗВАННОЕ (`scale-swing`, bounded), в парке — член; дифф видов в этой сцене НЕ читается.
2. **ПРОСВЕТ (решение 4)** — ОДИН класс: `placementRenderState.peekTiles: ReadonlySet<SpaceId>` (владелец — биндер: фокус-кандидат пикера с
   `placementEffect 'remove'`, уровня источника переезда (`moveLevel === 'source'`), `hiddenTiles`-цели; снимается при смене клетки / выходе); `BoardSpace`:
   `--peek` → верхняя фишка (и куб) в `opacity`, `showBonus` true (иконки под тайлом; проверить z-порядок `.board-space-bonus` над спрайтом), фишка, что
   остаётся, — непрозрачна (`piecesOf`: у TR44-клетки вода просвечивает, город стоит); `ConsoleBoardSection.cursorArtClass` → `''` для `'remove'` +
   поза `pickup` (кольцо на реальном тайле); слой отношений — Столица тоном `penalty`. Сервер: факты «ОТКРОЕТСЯ» в `tileRemovalFacts` и в источнике
   переезда (`moveSourcePreview`) и у `cleared` — `uncoverFacts(space)` (одна функция: печатные бонусы `future`, резерв / суша / «город остаётся» / «бонуса
   нет»); `placementDossier` — секция `uncovers` «ОТКРОЕТСЯ» между «ЭФФЕКТ КЛЕТКИ» и «ДРУГИЕ ИГРОКИ»; инспектор занятой клетки (hover) — та же функция
   строкой «Под тайлом: …» (K-E1). Гарды: юнит `BoardSpace.spec` (peek: бонус виден, верх прозрачен, остающаяся фишка — нет), `placementDossier.spec`
   (секция), `tileRemovalFacts` спек; e2e — переведённые `console-parliament-water` (просвет + «ОТКРОЕТСЯ: [2 растения]»), `console-canyon-carving` и
   `console-re-settlement` (источник), `console-tile-replacement` (Kaguya), `console-aquatic-research-station` (из-под города — «город остаётся»).
3. **Маршрут розыгрыша**: композер «КАРТЫ В РУКЕ › ЭКОЛОГИЧЕСКИЙ ЭКСПЕРИМЕНТ › РОЗЫГРЫШ» — две фазы чипов («ВВЕРХ» · «ЗАТЕМ ВНИЗ» — печатное «THEN»
   как разделитель ряда) + «ИТОГ», шаг цели data (класс TR48 с ролями), «ДАЛЕЕ: поставьте океан» (+ «бонусный океан 0 °C» при пересечении, + «снятие
   океана на доске»); staged-океан; «A» → ОДИН POST → посадка карты → история шкал ВВЕРХ (жетоны РТ с маркеров, пороги, ответ Зелёных) → data жетонами
   на миниатюру цели (PL-162 / PL-328) → [бонусный океан: доска] → **шаг «СНЯТИЕ ОКЕАНА»** (крошка растёт, workspace уступает доску, просвет под курсором,
   досье «ОТКРОЕТСЯ», двухфазный лок) → ответ → уход океана (`liftRemote`, осадка) → **«ОБРАТНЫЙ ХОД»** трёх шкал → возврат / конец flow (одна концовка).
   Соперник: та же история на своём экране (парк → подъём → уход → откат).
4. **Слова**: «Then decrease…» в описании; ключи композера «Up», «Then down», «Stays at maximum», «−1 · the TR stays», секция «Uncovers», факты «Cell
   bonus available again», «The ocean reserve will take an ocean again», «The land is free again», «Nothing is uncovered — a city stays on the cell»,
   «No printed bonus», кикер шага «Ocean removal» / «Снятие океана» (есть «Снятие» / «Снятие тайла»), журнальные строки отката. Grep перед каждым.

## 3. Лицо, локаль, лор, арт
`renderData` (чтение скана; разделитель «THEN» — один узел для лица и композера) → витрина EN / RU, миниатюра, рука, композер. Ключи — Grep по всем
`src/locales/<lang>/*.json` ПЕРЕД каждым (имя, описание, `card_info` капшены — ряд > 52 знаков → `infoText` + RU). Лор — `lore_texts.json` «TR47» + RU; реестр
придуманного — «в коде». Арт — `node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR47.png" TR47` + `npm run make:cards`.

## 4. Тесты
Сервер — §1. Клиент: юниты сцены качелей (модель: порядок, `atMax`, reduced motion, член парка; директор: таймлайн без `setTimeout`), `BoardSpace`
(peek), `placementDossier` (секция), `ConsoleBoardSection` (поза для `'remove'`), `boardBeatPark` (член «swing»), `consolePlacementNextStep` (фраза
снятия), `optionalChoice` не трогается. **e2e — ОДИН** `tests/e2e/console-ecological-experiment.spec.ts` (fhd + **4K**, `--repeat-each=4`, `TM_E2E_GPU=1`,
state-waits, `TM_E2E_STORYBOARD=1`, свидетели `preselectGuard` / `postCommitGuard` / `transferWitness`; красный — второй клиент) с фикстурами
(`parliamentFixture`, Учёные — `seatEnacted(quietResolutionOf(SCIENTISTS))`, как `scientific-breakthrough`):
1. **`ecological-experiment`** — температура −12, O₂ 4 %, ТРИ простых океана красного на клетках с РАЗНЫМИ печатными бонусами (растения · сталь + карта ·
   без бонуса) + свободный резерв с бонусом для нового океана; у синего TR48 Supercomputer (0 data) и 20 M€. Композер: «ВВЕРХ» (−12 → −10 +1 РТ · 4 → 5 %
   +1 РТ · океан +1 РТ · +3 data) / «ЗАТЕМ ВНИЗ» (−10 → −12 · 5 → 4 · океаны N → N−1 «снимите любой») / «ИТОГ +3 РТ»; шаг цели data; staged-океан на
   резерв → «A» → ОДИН POST → посадка → три жетона РТ с маркеров (рейтинг тикает на касаниях) → data на миниатюру TR48 → крошка «… › СНЯТИЕ ОКЕАНА»,
   поле: курсор по четырём океанам — под каждым ПРОСВЕТ (спрайт полупрозрачен, иконки бонуса видны; у клетки без бонуса — ничего), досье «ОТКРОЕТСЯ:
   [2 растения]» / «Бонуса нет»; выбор ТОЛЬКО ЧТО поставленного — досье честно («бонус уже получен, снова доступен»); два нажатия → уход океана →
   ОБРАТНЫЙ ХОД: три маркера назад, подписи «−1 · РТ остаётся», HUD флипает назад, рейтинг НЕ меняется; сервер: t −12, O₂ 4, океаны 3, РТ +3, data 3;
   красный — нотификация с качелями и та же сцена.
2. **`ecological-experiment-max`** — температура +6, O₂ 13 %, океанов 8: подъём доводит все три до максимума (+3 РТ), «ЗАТЕМ ВНИЗ» в композере — три
   ноты «остаётся на максимуме», вопроса о снятии НЕТ, сцена отката — три крышки «МАКС» без движения; сервер: всё на максимуме, РТ +3.
3. **`ecological-experiment-cascade`** — температура −2, O₂ 7 %, океанов 5: композер называет каскад ДО нажатия (0 °C → бонусный океан +1 РТ;
   8 % → +1 шаг температуры +1 РТ); маршрут: посадка → подъём → data → бонусный океан на доске (живой промт, класс `staged-interposer`) → снятие
   (из 7) → откат: 2 → 0 °C, 8 → 7 %, 7 → 6 океанов; РТ +5; `postCommitGuard` молчит (оба follow-up'а названы).
4. **`ecological-experiment-under-city`** — станция TR44 над океаном (аранжировка `aquaticFixture`), ещё один простой океан: кандидат под городом —
   просвет: город непрозрачен, вода просвечивает, досье «Ничего не откроется — на клетке остаётся город»; снятие из-под — крышка (TR44) + откат.
Регрессия на своём снапшоте, до / после: `console-parliament-water`, `console-canyon-carving`, `console-re-settlement`, `console-tile-replacement`,
`console-aquatic-research-station`, `console-staged-play`, `console-plasma-fans`, `console-scale-marker`, `console-venusian-census`, `console-parliament-*`
(RX12 Gas Export, RX14 Heat Capture, RX23 Mohole Contest — мировые ходы шкал), `console-placement-{confirm,dossier,relations,navigation}`,
`console-supercomputer` (data на миниатюру), `aaa-driver-canary`; `npm run e2e:affected`; гарды `e2eLiveness`, `e2eDriverGuard`, `glyphLiteralGuard`,
`lessDeadSelectorGuard`, `cellPiecesGuard`, `serverDerivedCacheGuard`. `npm run build:test` обязателен.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Контактный лист: (1) **просвет ДО / ПОСЛЕ** на четырёх стендах (RX33, TR39, TR14, Kaguya) + TR44-клетка: видно ли с дивана, ЧТО под тайлом, и
говорит ли досье то же; ретикл без второго объекта; (2) раскадровка TR47 целиком (композер двух фаз → staged-океан → посадка → подъём с жетонами →
data → снятие с просветом → уход → откат → конец) — по каждому моменту «что здесь слабо?» с кадром; (3) откат у соперника (второй клиент);
(4) стенд `-max` (крышки «МАКС») и `-cascade` (бонусный океан впереди снятия); (5) витрина EN / RU, рука (плашка, «Можно разыграть», причина при
отсутствии Учёных), журнал обоих игроков, нотификация красного. Пробник долей блоков (`auditStage`) на композере; `type ladder` на досье и на
подписях маркеров; «пауза» измеряется (`longtask`), не чувствуется.

## 6. ПОЛИРОВКА ПО ПУТИ (≈ 20 % — но здесь владелец ЗАКАЗАЛ итерацию: бюджет полировки = просвет во всех пикерах + сцена отката)
Реестр: раздел **AJ** «вверх и обратно · факт качелей · просвет снимаемого тайла · «ОТКРОЕТСЯ» в досье». **Открытые на маршруте — сперва воспроизвести:**
PL-325 (подсмотр TR45 на клетке с двумя фишками — здесь не главное, но стенд TR44 рядом), «a DECREASE snaps with no flip» (решение 6 — номер здесь).
**Кандидаты:** К-E1 инспектор занятой клетки (hover) — «Под тайлом: [бонус]» той же функцией `uncoverFacts` (сейчас молчит); К-E2 ретикл при снятии —
проекция океана над океаном (диагноз 3) — закрыть позой `pickup`; К-E3 нотификация соперника о мировом ходе вниз (RX12 / RX14) — читает ли она
«−1 без потери РТ» тем же языком, что карта (одна фраза для мирового хода и для карты); К-E4 «ПРЕЖНЯЯ КЛЕТКА» на уровне НАЗНАЧЕНИЯ переезда и
«ОТКРОЕТСЯ» на уровне ИСТОЧНИКА — одна функция, одни слова (не два чтения одного бонуса); К-E5 Kaguya: поле держит озеленение непрозрачным до
кинематики — после просвета дом бонуса виден уже при прицеле; К-E6 обратный флип HUD; К-E7 дельта-чип «−1» на дуге при откате — в тоне потери
(`cost`) или нейтральном (это не потеря игрока — РТ остаётся)? — решить одним тоном с подписью «РТ остаётся»; К-E8 крышка «МАКС» — та же плашка, что
у заявленного порога (не третий язык). Только-Deck — не полируем (PL-105).
**Правила** — `game-logic.md` § «ПАРАМЕТР ВВЕРХ И ОБРАТНО» (одна функция отката, названные пределы, авторство события, факт качелей — никогда дифф),
`board.md` § «ЧТО ОТКРОЕТСЯ» (одна функция фактов под тайлом — снятие / источник переезда / cleared / hover), `console-ui.md` § «ПРОСВЕТ СНИМАЕМОГО
ТАЙЛА» (один класс рендера для всех пикеров, поза ретикла, ничего не движется при прицеле) и § «ОБРАТНЫЙ ХОД ШКАЛ» (член слива парка, без жетонов,
крышки стоят, HUD флипает назад), `animations.md` (такты отката, reduced motion), чеклист §4 (строка «карта поднимает и опускает параметры»),
`docs/TURMOIL_REDUX_ECOLOGICAL_EXPERIMENT.md` — НОВЫЙ документ контракта (класс, который наследует следующая карта с «затем» / с понижением).

## 7. Режим работы
**Коммиты**: (1) общий слой: ступень снятия с маркерами + `lowerParameters` + кольцо качелей + дверь превью + хвост (спеки, регрессия RX33 / RX12 / RX14 /
Красных); (2) карта + спек + локаль + лор + арт; (3) просвет: `peekTiles` + `BoardSpace` + ретикл + `uncoverFacts` + секция досье + юниты (кадры ДО /
ПОСЛЕ четырёх стендов → **батч**); (4) перевод e2e соседей под просвет (тем же диффом — инвариант 14); (5) сцена «ОБРАТНЫЙ ХОД» (модель + директор + член
парка + HUD-флип + соперник) + A/B длительности; (6) e2e TR47 (четыре фикстуры); (7) документы — журнал § TR47 (правила с доказательствами, таблица
«даром / руками», раскадровки, A/B), правила, контракт-документ, чеклист, реестр AJ, реестр лора, промт. **Коммиты полировки** — `Polish (TR47 · the
uncovered cell): PL-### — …`. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой —
`npm run make:css` + `npm run build:server`. **Не пушить.** Батч — после кадров просвета (коммит 3), ДО сцены отката.
Гочи: `turmoilReduxExpansion: true` в `testGame`; сеттеры шкал ДО `runAllActions`; каскад 0 °C в юнитах — `setTemperature(game, -2)`; полная
перегенерация фикстур перетасует ВСЕ Redux-фикстуры — добавлять только свои JSON; `FixtureName` — строка ДО сборки (webpack типизирует `screenshots/**`,
стенд вне git — `// @ts-nocheck`); маркер `AnimatedScaleMarker` под `display: none` — SNAP (парк держит значения, сцена ждёт видимой доски);
`position: fixed` слой — всегда контекст наложения; rect-пробник краску не читает — просвет проверять классом клетки + `getComputedStyle(opacity)` на
каждом тике; 4K-раскадровка идёт ≈ 0,3× — тайминги по пробнику; e2e-сэмплер — `setInterval`; курсор поля ходит только по законным клеткам — чужие
клетки смотреть через R3 (`KeyV`); `eqeqeq` без исключения для null; `rtk grep` с фиксированной строкой / `'` виснет — Grep-инструмент; RTK-хук
съедает `\\` — такие правки Edit-инструментом; `npm run build:server`, не голый `tsc`; снапшот только после конца сборки; юниты — на тихой машине;
реестр — footer и букву раздела читать в момент записи; `cinematicBeat(page, ms, why)` вместо `waitForTimeout`.
**В отчёте:** таблица правил 1–14 с доказательствами; «даром / руками»; кадры просвета ДО / ПОСЛЕ по четырём стендам; раскадровки подъёма и отката
(своя и чужая сторона); A/B длительности сцены; что выбрал владелец и почему; регрессия (юниты / гарды / lint / e2e по классам); новые ключи; лор.
**Раздел «ПОЛИРОВКА»** — с СОБСТВЕННЫМИ находками. **Явно — всё, что не получилось, и почему.**

## 8. Нельзя
Вторая арифметика «на максимуме ли» / «есть ли что снять» мимо `parameterRoom` / `tileRemovalRoom`; `unrewarded` на откате карты (это ложь об
авторе); откат, который трогает РТ, пере-взводит пороги или возвращает бонус клетки; сцена отката из ДИФФА видов (ноль при «вверх и обратно»);
жетон РТ или монета на откате; маркер, схлопывающийся без такта (snap вне reduced motion); авто-выбор океана при одном кандидате; снятие составного
океана; снятие, уносящее город (TR44 — `liftOcean`); голый `SelectSpace` без маркеров для снятия; второй объект над снимаемым тайлом (призрак);
просвет, обещающий бонус, который коммит не даст (под опасностью Ares, под городом); досье, молчащее о том, что откроется; анимация в досье или
на поле, пока игрок целится; `v-if`-моргание клетки; `setTimeout` вместо удержания; `filter` для прозрачности состояний (только `opacity`);
пост-коммитный выбор, ответ на который был известен до «A» (снятие — нет: зависит от размещения); `title`; литерал имени карты в `src/client/**`;
литерал кнопки контроллера; определение промта по заголовку; `compatibility`; e2e сверх одного спека (соседи — переводом существующих); полировка
только-для-Deck; `shardPlan.json`; файлы соседа в своём коммите; пуш и красные коммиты.
