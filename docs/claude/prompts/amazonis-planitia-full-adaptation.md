# Промт исполнителю · Amazonis Planitia — полная премиум-адаптация большой (11-рядной) карты

Выдан 2026-11-06. **Базовая адаптация СДАНА** (синк апстрима, окно `369c76aded..19e09fe8e6`, раздел G
`docs/UPSTREAM_DEFERRED_WORKLIST.md`). Движок играет карту, её правила держатся, партию можно создать через API — но
карта стоит в `BOARDS_PENDING_PREMIUM_ADAPTATION` (`src/common/boards/boardPremiumScope.ts`): создатель её не
предлагает, случайные пулы её не тянут, премиум-гарды её освобождают. **Задача этого промта** — провести карту через
КАЖДУЮ поверхность console native и снять её с этого списка. Процедура — `docs/claude/expansion-adaptation-checklist.md`
в части «карта»; эталон уже сделанной фан-карты — `marsbot-map-profiles` (Hollandia / Arabia Terra), правило аудита:
«в премиум-скоупе» = каждая механика карты сыграна e2e на НАСТОЯЩЕЙ доске, а не заявлена.

## Что уже есть (не переписывать — опираться)

- **Доска**: `src/server/boards/AmazonisPlanitiaBoard.ts` (91 гекс, `TILES_PER_ROW = [6…11…6]`, A9-метки строк A–L без
  I, вулканы E1/H7/H9/J8/K7), `BoardBuilder` / `MarsBoard.computeEdges` обобщены за пределы 9 рядов (`65ba6147fa`).
  Колониальные клетки — id с префиксом `c` (`c01`, `c69`…`c80`, вкл. наши Nova City `c79` и Aurora Station `c80`),
  миграция старых сейвов в `GameSetup.migrateColonySpaceIds` + `ColonyDeserializer` (хостовые `Colony.tiles`).
- **Глобальные параметры карты** (`src/common/boards/GlobalParameterMaximums.ts`, `GlobalParameterTracks.ts`,
  `src/common/venus/venusScale.ts`): `game.max` = +14 °C, 18 % O₂, 11 океанов, Venus 33 % (выше 30 % — шаг 1 %).
  Бонусы треков — `game.globalParameterTracks`: −12 °C → +1 произв. растений, 7 % O₂ → карта, 11 % O₂ → шаг
  температуры, 16 % Venus → колония, 22 % Venus → РТ. Выдачу делает НАШ код `Game.increase*` (MarsBot-замены, атрибуция
  РТ, претензии шкал `scaleBonusClaims`). Спеки: `tests/boards/AmazonisPlanitiaTracks.spec.ts` (апстримные).
- **Серверные читатели уже переведены** на карту: превью (`actionPreviews`, `actionPreview`, `Executor`-метаданные),
  `effectForecast` (пороги — по таблице карты), `BoardInformationEngine` (цепочка O₂→температура), Парламент
  (`parameterMove` / `tileRemoval` принимают `boardName` / `maxOceans`), WGA, Turmoil-бамп РТ, MarsBot-хелперы,
  `terraformingProgress(input, max)`.
- **Бонус клетки «стандартный ресурс»** (`SpaceBonus.STANDARD_RESOURCE`): выбор `SelectResource` после размещения;
  реакции карт — `ICard.onStandardResourcePlacementBonus` (Mining Guild, Solar Farm, Geological/Ecological Survey,
  Specialized Settlement), Mining Rights/Area и Boom Town принимают такую клетку.
- **Регионы вех/наград** — по геометрии доски (`board.isSouthern / isPolar / isEquatorial`), статики MarsBot — 9-рядные.
- **Правила**: две делегата на H7 (классический Turmoil; Redux уже ставил все), +1 поколение в стандартном соло,
  45 подземных жетонов на карте (Underworld), `SpaceModel.a9` с сервера, арт `assets/board/mars-large*.png`.

## Что сделать (worklist)

1. **Рендер большой доски в консоли.** Апстримный `27db80e67e` («Render the larger board» — `board--large`,
   LESS-цикл позиций 91 гекса, перепроекция циферблатов, Venus 31–33, сдвиг колониальных клеток) НЕ взят: наша доска
   (`Board.vue` в `ConsoleBoardSection` через `GameBoardView`, `src/styles/board*.less`, `console.less` — позиции
   `.board-space-cNN` флангов) живёт по своим правилам. Фит под 4K-ТВ, без скролла (цель 1 CLAUDE.md), курсор доски и
   навигация паддом по 11 рядам (`placementCursorStart.ts` и соседи), A9-метки на клиенте (клиентская половина
   `17c0acbd5a`: `spacesById`, `BoardSpace` / журнал читают `space.a9` вместо `common/boards/spaces.ts`).
2. **Увеличенные шкалы** — клиент читает максимумы из `getGlobalParameterMaximums(boardName)`, НЕ из констант.
   Сейчас константы в: `ConsoleStatusStrip.vue`, `consoleActionCommit.ts`, `consoleGovernmentSupport.ts`,
   `scaleStepReward/scaleStepRatingBeat.ts`, `scaleStepReward/venusBonusCellBeat.ts`, `GlobalParameterValue.vue`;
   вызовы без карты: `terraformingProgress` / `venusDisplayProgress` (`ConsoleStatusStrip`,
   `gameProgress/terraformingCelebration.ts`), `parameterRoom` (`parliament/worldMoveModel.ts` — передать
   `boardName`), `tileRemovalRoom` (`parliament/tileRemovalModel.ts` — `maxOceans`). Шкала Venus 31–33 % — шаг 1 %
   (`venusScale.ts` из common). Новые пороговые бонусы треков — их ячейки/маркеры/претензии на шкалах и в сцене награды
   шага (`scaleStepReward`). Апстрим `201e359e18` — график конца игры по максимумам карты.
3. **Прогноз/превью новых бонусов треков** — `effectForecast.scaleBonusPass` пока не прогнозирует 7 % карту, 16 %
   колонию и −12 °C растения, а причины («Crossing 8 % oxygen…», «16 % Venus») называют классические значения; то же в
   заметке `BoardInformationEngine` («Reaching 8% oxygen…»). Новые английские ключи + RU (не переписывать чужие).
4. **Клетка «стандартный ресурс»** — премиум-лицо: иконка портрета клетки (`Bonus.vue`), спрайт доски (`board.less`),
   «история посадки» (гард `tests/boards/cellBonusFaceCoverage.spec.ts` её назовёт, как только карта уйдёт из списка),
   досье клетки (`BoardInformationEngine` / `specialCellInfo.ts`), choice-context у промпта выбора ресурса (кто спросил —
   клетка, как `cellGiver()` у колонии MSL), превью Solar Farm / Mining Card / Survey на такой клетке (сейчас — 0, пока
   игрок не выбрал), миниатюра (сейчас нейтральный «?» в `boardMiniatureArt.ts`).
5. **Создатель** — карта в `createGameMeta.ts` (официальная, с акцентом), миниатюра 11 рядов (`boardLayoutGeometry` —
   `MINI_ROWS` фиксирован на 9; гарды `boardLayoutExport` / `boardLayoutGeometry` её назовут), предупреждение «Alt Venus
   + Amazonis Planitia» (апстрим `8424b2e87e` — у нас нет `validateNewGameConfig`, сделать в консольном создателе).
6. **Вехи/награды** — печатный набор `['Terran5', 'Landshaper', 'Merchant3', 'Sponsor', 'Lobbyist']` /
   `['Collector', 'Innovator', 'Constructor', 'Manufacturer', 'Physicist']`. **Lobbyist у нас RETIRED** (Redux FAQ) —
   решение ВЛАДЕЛЬЦА о замене (Redux-аналог), до тех пор `MilestoneAwardSelector` тянет для карты общий пул (ветка
   NONE). Merchant3 / Innovator / Physicist: исключены из всех пулов (`PENDING_ADAPTATION_MA`), в реестре бота —
   `PENDING` (`tests/automa/ma/botMARegistry.spec.ts`): строки `botMARules.ts`, премиум-бейджи (апстрим `9b24651245` —
   только как плейсхолдеры, конвейер `docs/claude/ma-premium-icons-worklist.md`), RU уже есть (Новатор, Физик,
   описание Merchant3). Terran5 / Landshaper — `random: 'modular'` (апстрим расширял до `both`).
7. **MarsBot** — профиль карты (`MarsBotMapProfile`, `AUTOMA_SUPPORTED_BOARDS`), тайбрейкеры (апстрим `d443cfe7ec` —
   сверить), бот на длинных треках (его выдачи за 7 % / 16 % / −12 °C: сейчас карта и колония пропускаются, растения —
   2 M€ как теплo), `AutomaNearBonusPush` уже читает таблицу карты.
8. **Снять карту с `BOARDS_PENDING_PREMIUM_ADAPTATION`** → гарды назовут оставшееся; e2e на НАСТОЯЩЕЙ доске
   (снапшот → бокс, `npm run e2e:remote`): посадка на «стандартный ресурс» с выбором, 7 % / 11 % / 16 % / 22 %,
   Venus 31→33, делегаты H7, 11-й океан, конец партии на +14 °C.

Необязательно: апстримный `c5df02c9b1` (API строк `BoardBuilder.row(r => …)` + сериализуемый `Space.edge`) — чистый
рефакторинг, нужен только если будущие апстримные доски начнут на нём конфликтовать.
