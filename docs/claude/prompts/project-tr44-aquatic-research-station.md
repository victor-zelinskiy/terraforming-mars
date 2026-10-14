# Промт исполнителю · TR44 Aquatic Research Station («Подводная исследовательская станция») — синяя, 16, Животное + Город + Здание, плашка Зелёных: «Разместите ГОРОД ПОВЕРХ ТАЙЛА ОКЕАНА В ИГРЕ, игнорируя прочие ограничения размещения. Океан под ним по-прежнему платит соседям»; действие «+1 животное сюда; можно +1 data на ЛЮБУЮ карту»; 1 ПО за 2 животных · ГЛАВНОЕ — НОВАЯ МЕХАНИКА «ДВА ТАЙЛА НА ОДНОЙ КЛЕТКЕ»: честная физика (океан остаётся океаном, город — обычным городом), ясная РАЗНИЦА с составным океанским городом (Ocean City / New Holland = ОДИН тайл) и визуально, и в правилах, и ПРЕМИАЛЬНАЯ ПОСАДКА города на воду

Выдан 2026-10-13. Инфраструктура набора стоит (TR01–TR43, TR45, TR46, TR48, TR50, TR51, TR66 сданы; **TR52 в работе у СОСЕДА** — итерация
«Сброс»; TR47, TR49 пропущены владельцем) — **ничего из неё не повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`
(§0 «Новая механика? — сначала её инфраструктура сквозным контрактом, потом карта»; постоянный **§7**: агент САМ ищет места доработки;
**«Профили»** — TV 4K сперва; **«Бесшовность — workspace-архитектура»**; **«Премиум-планка»**; **«Качество полировки»** — сильная рабочая
концепция или откат, оба конца каждого полёта ВИДИМЫ, сданное перепроверяется), журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,board,console-ui,animations,premium-card,tests}.md`
(законы: **WORKSPACE IS ONE FLOW**, **PHYSICAL CAUSALITY** — «каждая анимация отвечает: откуда, зачем, куда», **закон 27** — адрес pre-select,
законы TR51 — **одна грамматика выбора**, **все выборы — до коммита**, **отказ — кнопка внутри выбора**), контракты поля —
`docs/claude/console/tile-replacement.md` (§ THE THIRD case — ярус, **§ THE TRUTHFUL STACK** — «стопка рисуется как лежат фишки», § THE FOURTH
case — переезд), `docs/claude/console/board-placement-flow.md` (двухфазное размещение, ретикл, § A MOVE), `docs/TURMOIL_REDUX_RE_SETTLEMENT.md`
(контракт «тайл переезжает»), `docs/TURMOIL_REDUX_COMPOSTING_INITIATIVE.md` (перепись тайлов — дверь TR44), `docs/claude/board-information.md`,
`docs/SPECIAL_TILE_AUDIT.md`. Память: `board-piece-keeps-its-kind` (**решение владельца 2026-10-04: фишка не меняет тип от переноса; спецтайл ПОД
показывается мини-значком**), `remove-and-replace-placement-preview` (§ «Поверх ОКЕАНОВ»), `tr39-move-reward`, `turmoil-redux-project-cards`
(§ TR14 — «города НАД океаном не переселяются: ОСОБЫЙ тайл нельзя подменить другим»; § TR45 — `marsTilePiecesOn` дверь TR44).

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-13, дословно):** «тут новая механика расположение города поверх океана, у нас уже есть океанские города как 1 тайл,
а тут это как два независимых надо чтобы игрок четко понимал разницу как визуально так и геймплейно, а также чтобы визуально было понятно что это
два тайла и была хорошая премиальная подача размещения тайла. Кейс новый и требует хорошой проработки».
Три требования: **(1) ФИЗИКА ДВУХ ТАЙЛОВ** — на клетке лежат ДВЕ фишки, и движок знает обе: океан остаётся простым океаном (считается в 9,
платит соседям, двигается / снимается ИЗ-ПОД города — FAQ свода стр. 18), город — обычным городом (ярусы, переезд, ПО за озеленения, Мэр);
**(2) РАЗНИЦА С СОСТАВНЫМ ТАЙЛОМ** — Ocean City / New Holland = ОДИН составной тайл «город И океан» (решение владельца в переписи TR45 и в
TR14 4-bis), TR44 = ДВА; разница читается с дивана (картинка клетки) и в правилах (досье, подсмотр, журнал); **(3) ПОДАЧА** — посадка города на
воду — премиальная фраза по закону причинности: откуда летит, куда садится, что отвечает вода, что платит.
Решения — агент ищет сам; ниже диагноз и рекомендованная архитектура, финал — по кадрам 4K в батче владельцу.

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, файл:строка на `a6b42a9e39` — подтвердить ДО правки):**
1. **Движок умеет только СОСТАВНОЙ тайл поверх океана.** `PlaceTile.ts:48–56` — для `on: 'upgradeable-ocean' | 'upgradeable-ocean-new-holland'`
   пишет `tile.covers = space.tile` (Ares Ocean City / Farm / Sanctuary, promo New Holland); `MarsBoard.canCover :755–769` пускает поверх океана
   ТОЛЬКО `OCEAN_UPGRADE_TILES`; обычный `CITY` поверх `OCEAN` — `Game.addTile :2100` бросает «occupied». `Tile.ts:10` — `covers?: Tile`
   сериализуется с тайлом (Ocean City уже живёт на этом), **никто, кроме survey-семьи Ares, его не читает** (`SurveyCard.ts:56`, `MiningGuild.ts:65`,
   `GeologicalExpedition.ts:62`, `CuriosityII.ts:69` — все как «бонус клетки не выдаётся»).
2. **«Есть ли тут океан» читается по ВЕРХНЕМУ тайлу.** `Board.isOceanSpace :369` — `OCEAN_TILES.has(tile.tileType)`; `getOceanSpaces :140–158`
   (счётчик 9 океанов, TR43, `Countable.oceans`, `OceanRequirement`, `RemoveOceanTile.ts:17`, `tileRemovalStep` RX33) — по `tile.tileType`;
   `oceanAdjacencyBonus :266–269` — через `isOceanSpace`; **`capitalAdjacencyVp.ts:33` читает `OCEAN_TILES.has(tile.tileType)` НАПРЯМУЮ** (шапка
   `:3` обещает «the SAME set `Board.isOceanSpace` reads» — вторая арифметика, которая разойдётся с первой в день TR44). Обычный `CITY` с
   `covers: OCEAN` для всех них — НЕ океан: ни +2 M€ соседям, ни счёт в 9, ни TR43, ни ПО Столицы. Составной тайл этого не замечает, потому что
   сам в `OCEAN_TILES`.
3. **Клиент НЕ ЗНАЕТ, что под тайлом.** `SpaceModel.ts:23–30` несёт `tileType`, `color`, `stackHeight` — `covers` не экспортируется
   (`ServerModel.ts:894–896`). Картинка стопки (`BoardSpace.vue:1–50`, `tierArtClassOf :200–206`, `topArt / buriedArtClass :305–323`,
   `common/boards/cityStack.ts` `stackTopTile` / `stackBuriedTile :62–80`): нижний ярус носит арт тайла КЛЕТКИ, верх — обычный город, спецгород под
   ярусом отмечен миниатюрой `.board-stack__under` (`board.less:1150–1200`, тёмная гекс-плашка в нижней вершине, 84 % арта), счётчик «×N» —
   ярусы ГОРОДА. `stackBuriedTile` возвращает только спецГОРОД — океан под городом ему нечем назвать. `BoardSpaceTile.klass :196–222`: пока
   посадка удерживает клетку — рисует ВОДУ (`heldPrevTileOf`), после релиза — `topArt ?? tileType` от края до края (`tile_city.png` заполняет
   гекс целиком, `board.less:915–917`) → **вода исчезает под городом**; у составного тайла вода нарисована В арте, у обычного города — нет.
4. **Посадка «поверх океана» УЖЕ есть как ЯЗЫК, но для составного тайла.** `verifyPlacement` (`tilePlacementModel.ts:770–778, 849–853`) и
   `detectFreshPlacements :857–905` читают диф `OCEAN → не-OCEAN` как посадку с `covers`; герой держит воду под полётом (`consoleTilePlacement.ts:
   211–214, 540, 583` — бонусов клетки нет, `:789–792` — брызги `playCoverSplash`, `OCEAN_SPLASH_MS` 460, `tilePlacementDirector.ts:881`); удалённая
   сцена то же (`consoleRemotePlacement.ts:396–410` «held cover keeps painting the water», `:846–850`). Т.е. ПОЛЁТ и БРЫЗГИ TR44 получает даром —
   но ПОСЛЕ релиза клетка красится как п. 3. Ярус (`§ THE THIRD case`): подлёт → зависание (`tierHoverPoint`) → вертикальный спуск → контакт →
   пыль (`playStackDust`, `dust :57`) → реальная клетка красит стопку (`cityStackScene.ts` — `loading` / `contact`, `board.less:1083–1130`);
   геометрия посадки яруса — `stackLandingRect :287`, `STACK_STEP_PX 3.5 / STACK_SCALE 0.86 :281–282` (зеркало `@stack-step / @stack-scale`
   `board.less:1049–1050` — менять парой, спек пинит).
5. **Переезды и снятие знают только ОДИН тайл на клетке.** `cityMove.cityStandsOnOcean :60–67` (TR14 4-bis) блокирует `OCEAN_UPGRADE_TILES` с
   причиной `city-stands-on-ocean`; `liftTopCity` (`server/boards/cityStack.ts:91–116`) при высоте 1 уносит тайл ЦЕЛИКОМ и оставляет клетку
   ПУСТОЙ (`space.tile = undefined`); `oceanMove.isPlainOcean :60–66` — `tile.tileType === OCEAN`, прочие океаны — `upgraded-ocean` (`:91–99`);
   `Game.moveOceanTile :2477–2503` — `from.tile = undefined`; `Game.removeTile :2753–2767` — сносит ВСЮ клетку (`tile`, `player`, `stackHeight`);
   `verifyMove` (`tilePlacementModel.ts:740–747`) — пара океана «A: простой ничейный океан → ПУСТО, B: ПУСТО → океан»; `detectFreshRemovals
   :930–949` — только `TILED → EMPTY`. **FAQ свода стр. 18 (дословно):** «*Can I use "Canyon Carving" on the ocean that is under the "Aquatic
   Research Station"? — Yes. When you do this, remove only the ocean at the bottom of the stack, and keep the city in place.*» и рядом:
   «*Can I use "Re-settlement" on a stack of cities? — Yes… remove only the top-most city from the stack, and leave the city underneath in its
   place.*» → свод сам называет это СТОПКОЙ из двух фишек, и ни одна не меняет типа.
6. **Перепись TR45 ждёт.** `marsTileCensus.ts:100–112` `marsTilePiecesOn` — «TR44 adds its buried ocean here in one line»; таблица
   `tests/boards/marsTileCensus.spec.ts:38–55` — строка «Ocean City → ONE tile»; TR44 добавляет строку «город поверх океана → 2: city 1 + ocean 1».
7. **Досье / инспектор / слова.** `BoardInformationFacts.ts:26–28` — виды размещения (`'upgradeable-ocean' | 'upgradeable-ocean-new-holland' |
   'city-tier' | 'ocean-removal' | 'city-move' | 'ocean-move'`), `PlacementType.ts` — их серверный близнец; `previewContext` (`BoardInformationEngine.ts:
   148–175`: `covering = hasRealTile`, `bonusesCovered`, `stacking = kind === 'city-tier'`), `withHypotheticalTile :1555–1575` уже ставит
   `{tileType, covers: ctx.covering ? savedTile : undefined}` (`:1567`); `placementScoringFacts :1140–1160` — ПО города по `countsAsCity`;
   `baseCellStatus :359–410` / `countsAsFor :315` / `cellDescription :344–357` — по `tileType`; `placedTileType :2669–2690`; `MOVE_FAMILIES :1607–1620`.
   Клиент: `placementDossier.ts:113–126` `KIND_TITLE` (`'upgradeable-ocean' → 'Ocean'`), `swatchForKind :229–238`; `consolePlacementNextStep.ts:
   220–235` `shapeOf`; `ConsoleBoardInput.vue:580–586` — арм героя (`stacking` по `placementType`); `ConsoleBoardCursor.vue:32` — «призрак тайла над
   тайлом = второй объект» (для позы ПОДЪЁМА; у TR44 второй объект — ПРАВДА). Причины: `PlacementIllegalReason.ts:34` `requires-ocean-tile`, `:73`
   `city-stands-on-ocean`, `:79` `upgraded-ocean`, слова `:139–143`; RU — `ui.json:889–929`, `board_info.json`. Имена соседей в RU: «Океанский
   город», «Океанская ферма» (`ares_cards.json:11–12`), «Новая Голландия» (`promo.json:16`); «Ярус города» (`ui.json:449`).
8. **Действие.** `Behavior.ts:70, 208–235` — `addResourcesToAnyCard` без `optional` (только `mustHaveCard` / `min`; «добавить на ЛЮБУЮ» ВСЕГДА
   спрашивает куда — `Executor.ts:588–628`, `AddResourcesToCard.ts:97–104`; нет держателя → named skip `SKIP_REASON.noHolder :191`). Закон отказа
   (`console-ui.md` § AN OPTIONAL CHOICE DECLINES WITH A BUTTON; `optionalChoice.ts`): отказ = RT внутри выбора, маркер сервера `{kind: 'skip'}`
   (`optionMetadata.skip()`) на `OrOptions`; «выбор, чей единственный ответ — пик, ЕСТЬ этот пик». Образцы: TR48 Supercomputer (`action:
   {addResourcesToAnyCard: {DATA, 2}}`, К-T1 — исход «+N» под ролью каждого держателя), TR43 (`OrBehavior.optional`). Держатели data в скоупе — 11.
9. **Реестр:** раздел AF (TR52, PL-260…268) последний; footer «Следующий свободный номер **PL-269**» → TR44 берёт раздел **AG**; номер объявлять
   ДО записи (сосед TR52 пишет реестр параллельно — читать footer в момент записи). Открытые строки на маршруте: PL-032/033 (не наши), PL-128;
   TR14 «переезд на опасность Ares = два такта» (журнал § TR14 «несделанное»).

**Обязательное чтение до кода:** `src/server/Game.ts:2082–2160` (`addTile`: `canCover`, `coveringExistingTile`, бонусы — `grantPlacementBonuses
:2255–2312`: печатный бонус пропускается при покрытии, **соседство с ДРУГИМИ океанами платится и при покрытии (`:2280`)**), `:2313–2360`
(`simpleAddTile`), `:2412–2503` (`moveCityTile` / `moveOceanTile`), `:2753–2767` (`removeTile`), `IGame.ts:100` (`AddTileOptions`); `boards/
{Board.ts:340–440, MarsBoard.ts:70–180, 266–275, 326–380, 590–640, 755–769, PlaceTile.ts, PlacementType.ts, PlacementPreviewContext.ts,
cityStack.ts, cityMove.ts, oceanMove.ts, tileMove.ts, capitalAdjacencyVp.ts, BoardInformationEngine.ts:76–130, 140–260, 315–420, 1140–1240,
1555–1620, 2660–2695}`, `deferredActions/{MoveTile.ts, RemoveOceanTile.ts}`, `parliament/resolutions/ResolutionTileRemoval.ts`; `common/
{TileType.ts:140–160, boards/cityStack.ts, boards/marsTileCensus.ts, models/SpaceModel.ts, boards/BoardInformationFacts.ts, inputs/
PlacementIllegalReason.ts}`; `server/models/ServerModel.ts:860–900`. Клиент: `components/BoardSpace.vue` целиком, `components/board/
BoardSpaceTile.vue`, `src/styles/board.less:900–1210` (океан / город / стопка / метка), `console/tilePlacement/{tilePlacementModel.ts,
consoleTilePlacement.ts, tilePlacementDirector.ts, consoleRemotePlacement.ts, cityStackScene.ts, placementMove.ts, placementFlow.ts}`,
`components/console/{ConsoleBoardInput.vue, ConsoleBoardCursor.vue, ConsoleBoardSection.vue}`, `console/{placementDossier.ts,
consolePlacementNextStep.ts, boardPeek.ts}`, `components/board/boardInfoState.ts`. Карты-соседи: `turmoilRedux/{IchtiologyGrant.ts (плашка Зелёных,
шапка), CanyonCarving.ts, ReSettlement.ts, CompostingInitiative.ts, Supercomputer.ts (действие «на ЛЮБУЮ»)}`, `ares/OceanCity.ts`,
`promo/NewHolland.ts`, `base/{Herbivores.ts (ПО 1/2), Birds.ts}`. Тесты-образцы: `tests/boards/{cityMove, oceanMove, oceanMovePreview,
marsTileCensus, placementPreviewConsistency, placementEffectConsistency}.spec.ts`, `tests/client/components/console/{tilePlacementModel,
tileMoveScene, placementMove, placementFlow}.spec.ts`, e2e `console-parliament-skyscrapers` (сэмплер вертикального спуска), `console-canyon-carving`,
`console-re-settlement`, `console-placement-{confirm,dossier,relations}`, `console-tile-replacement`, фикстура `ichtiology-grant`
(`tests/e2e/fixtures/generate.ts:2056–2100` — Зелёные правят стартовым правилом + океаны `addOcean(p2)`), `FixtureName` (`consoleStart.ts:2334`).
Реестр: PL-041, PL-133, PL-141, PL-162, PL-165, PL-188. Память: `board-piece-keeps-its-kind`, `remove-and-replace-placement-preview`,
`tr39-move-reward`, `storyboard-catches-what-the-probe-passes`, `polish-premium-bar`, `polish-quality-no-regressions`,
`perf-measure-on-gpu-not-swiftshader`, `fixed-layer-is-a-stacking-context`, `owner-batches-pending-polish-decisions`, `ab-baseline-head-client-in-snapshot`,
`e2e-board-cursor-legal-only`, `concurrent-session-edits-same-files`.

Номера строк сняты с `a6b42a9e39` — перед правкой перечитать.

**Что это за карта.** Синяя (ACTIVE, `ActionCard`), **16**, метки **Животное + Город + Здание**, требование **Зелёных**, держатель ЖИВОТНЫХ,
**1 ПО за 2 животных**: *«(Action: Add 1 animal resource to this card. You may also add 1 data resource to ANY card.) Requires the Greens to be
ruling or that you have 2 delegates there. Place a city ON TOP OF AN OCEAN TILE IN PLAY, IGNORING OTHER PLACEMENT RESTRICTIONS. The ocean
underneath still grants its adjacency bonus when placing tiles next to it.»*

**Оценивается — в этом порядке веса.**
1. **ФИЗИКА ДВУХ ТАЙЛОВ ВО ВСЁМ ДВИЖКЕ** (≈ 30 %) — ОДНО чтение «какие фишки лежат на клетке» для сервера и клиента; океан под городом —
   простой океан везде, где движок спрашивает об океанах (9, соседство, TR43, требования, Столица, перепись = 2, переезд TR39 ИЗ-ПОД города —
   FAQ, снятие RX33 — решение 7); город — обычный город везде (Мэр, ПО, ярус RX20, переезд TR14 — решение 6); составные тайлы Ares / promo —
   НИ ОДНОГО изменения поведения (регрессия их спеков и TR14 / TR39 / TR45 / RX33 — зелёная).
2. **КАРТИНКА И РАЗНИЦА** (≈ 25 %) — клетка читается как ДВЕ фишки с дивана на 4K (закон правдивой стопки: город — ярус над водой, вода —
   основание, океан под городом ОТМЕЧЕН); рядом с Ocean City разница очевидна без подписи; инспектор / досье / подсмотр / журнал говорят
   «два тайла» и «океан платит соседям».
3. **ПОСАДКА И СЦЕНЫ ПЕРЕЕЗДА** (≈ 25 %) — посадка города на воду — премиальная фраза (вода отвечает, город садится ярусом, соседние
   океаны платят, без мёртвого времени, без обрыва у соперника); океан, уезжающий ИЗ-ПОД города (TR39), и город, уезжающий С воды (TR14) —
   фишка, которая едет, едет СВОИМ артом, та, что остаётся, НЕ исчезает ни на кадр.
4. **Остальное** (≈ 20 %) — действие (животное + необязательная data по закону отказа), лицо, лор, спеки, e2e, §6.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Поверх океана** | только `OCEAN_UPGRADE_TILES` (`canCover :755–769`); `covers` пишет `PlaceTile :50–51`; читают — survey-семья Ares |
| **«Есть океан»** | `isOceanSpace :369`, `getOceanSpaces :140–158` (`upgradedOceans` default true, `wetlands` false), `isUncoveredOceanSpace :378` (`BASE_OCEAN_TILES` — «океан РАЗМЕЩЁН») |
| **Переезды / снятие** | `cityStandsOnOcean`, `liftTopCity` (клетка пустеет), `isPlainOcean`, `moveOceanTile` (`from.tile = undefined`), `removeTile` (вся клетка), `tileRemovalStep` + `RemoveOceanTile` (`{upgradedOceans: false}`) |
| **Модель клетки** | `SpaceModel` без `covers`; `stackHeight` ≥ 2 только |
| **Картинка** | правдивая стопка: база = тайл клетки, ярусы = обычные города, метка спецгорода `.board-stack__under`, счётчик ×N; `tile_city.png` от края до края |
| **Герой / remote** | диф `OCEAN → X` = посадка с `covers`; вода держится под полётом; брызги 460; ярус — спуск краном + пыль + `cityStackScene` |
| **Превью** | `previewContext` (`covering`, `bonusesCovered`, `stacking`), `withHypotheticalTile` ставит `covers`; виды размещения — 13; `KIND_TITLE`, `swatchForKind`, `shapeOf` |
| **Перепись** | `marsTilePiecesOn` — одна функция; Ocean City = 1 |
| **Действие** | `addResourcesToAnyCard` без `optional`; закон отказа читает `skip`-маркер `OrOptions` |
| **Фикстуры** | `parliamentFixture` (Зелёные правят — как `ichtiology-grant*`), `addOcean(p2)`; `bootFixtureSeats(…, {arrange})` |
| **Арт / лор / имя** | **арта `Mars Arts/TR44.png` НЕТ** (в `Downloads/Mars Arts/` только TR45, 46, 48, 50, 51) — **попросить у владельца в батче**; лор ПРИДУМАН (`turmoil-redux-invented-lore.md:21`: «Finally, an aquarium where the fish get to watch us.» / «Наконец-то аквариум, где рыбы смотрят на нас.» — «ждёт карту» → «в коде»); `CardName` — между `ICHTIOLOGY_GRANT` и `COMPOSTING_INITIATIVE` (`CardName.ts:1117–1118`), манифест — между TR43 (`:234`) и TR45 (`:238`) |
| **Реестр** | footer «**PL-269**»; TR44 — раздел **AG** |

### Чтение скана (`…\Projects\Card_-_TR44.png`)
Цена **16**, СИНЯЯ рамка (ACTIVE). Плашка «MIN» у цены — **эмблема Зелёных** (дерево) = ТРЕБОВАНИЕ `{party: PartyName.GREENS}`, не метка. Метки
справа, по порядку печати: **Животное** (лапа), **Город**, **Здание**. Название «AQUATIC RESEARCH STATION». Верхнее поле — действие: **→ [животное]
[data]\*** (красная стрелка, значок животного, значок data со звёздочкой «на ЛЮБУЮ карту») + текст «(Action: Add 1 animal resource to this card.
You may also add 1 data resource to ANY card.)» → `b.action('…', (eb) => eb.empty().startAction.resource(CardResource.ANIMAL).resource(CardResource.DATA).asterix())`
(сверить с ПЕЧАТЬЮ: ОДНА стрелка, ДВА значка справа от неё, звёздочка только у data; форма — как у соседей с двумя результатами). Нижнее поле —
слева **[город] над [синий гекс со стрелкой вниз]** — ОДИН составной значок «город ПОВЕРХ океана» (гекс города, под ним гекс океана со стрелкой
вниз), не две иконки набора. В рендер-DSL готового узла нет (Ocean City рисует СВОЙ спецтайл `b.tile(TileType.OCEAN_CITY, false, true)`, TR16 / TR19
— `b.city().asterix()`, TR39 — `b.oceans(1)`): завести **ОДИН новый узел «тайл поверх тайла»** (город + океан + стрелка), которым рисуют лицо, значок
вида размещения в досье и «ДАЛЕЕ» композера — не ad-hoc CSS в трёх местах. Текст: «(Requires the Greens to be ruling or that
you have 2 delegates there. Place a city ON TOP OF AN OCEAN TILE IN PLAY, IGNORING OTHER PLACEMENT RESTRICTIONS. The ocean underneath still grants
its adjacency bonus when placing tiles next to it.)». **ПО — «1/2 [животное]»** на бейдже Марса → `victoryPoints: {resourcesHere: {}, per: 2}`
(форма Herbivores). Внизу слева — фиолетовый ромб Turmoil (модуль, без `compatibility`; ▲ Колоний и значка Венеры НЕТ). Цитаты НЕТ → лор из
реестра придуманного. Подпись арта — «Jacek Irzykowski». Номер «TR44».

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/AquaticResearchStation.spec.ts`; контракт двух тайлов — своими спеками, §4)
1. **Требование** — плашка Зелёных: правят (стартовое правило в 1-м поколении считается) или 2 СВОИХ делегата на их резолюции; при розыгрыше;
   TR36 порог ТРЕБОВАНИЯ не снижает.
2. **Куда ставится — на ПРОСТОЙ ОКЕАН, на котором НИЧЕГО НЕ СТОИТ** («an ocean tile in play»): любой `TileType.OCEAN` на поле — чей угодно (океан
   ничей), на клетке-резерве или на суше (Artificial Lake), MarsBot-овский тоже. **НЕ** цель: составной океан (Ocean City / Farm / Sanctuary /
   New Holland / Wetlands — это ДРУГОЙ тайл, причина `occupied` — «уже стоит тайл», как у `upgradeable-ocean` сегодня), океан, на котором УЖЕ стоит
   город TR44 (`occupied`), пустой резерв океана (`requires-ocean-tile`), суша без океана (`requires-ocean-tile`). Нет ни одного простого океана →
   карта НЕИГРАБЕЛЬНА с причиной «Нет тайла океана, на который можно поставить город» (одна причина; `unplayableReason` co-located или общий
   помощник вида).
3. **«IGNORING OTHER PLACEMENT RESTRICTIONS»** — соседство с другими городами разрешено (правило города «не рядом с городом» не действует);
   Land Claim чужой — не бывает на океане; Ноктис — не океан. Правило Красного города («рядом нельзя озеленение») — не про нас.
4. **НА КЛЕТКЕ ЛЕЖАТ ДВЕ ФИШКИ** (контракт §1): верх — ОБЫЧНЫЙ `CITY` (`tile.card = AQUATIC_RESEARCH_STATION`, `space.player` = игрок), низ —
   прежний `OCEAN` (`tile.covers`, ничей). Город — город везде: `isCitySpace`, `countCities` (Мэр, Metropolist, New Holland «4 города», RX21
   «города на Марсе»), ПО за соседние озеленения, триггеры «город размещён» (Pets, TR30, Martian Census, Tharsis…), ярус RX20 ставится на него
   (`canStackCity`). Океан — океан везде: `isOceanSpace` (соседство +2 M€ для ВСЕХ тайлов рядом — текст карты; Столица рядом — +1 ПО за него),
   `getOceanSpaces()` (счёт 9: НЕ меняется от розыгрыша), `getOceanSpaces({upgradedOceans: true, wetlands: true})` (TR43, Cyanobacteria, требования
   «N океанов»), `getOceanSpaces({upgradedOceans: false})` (снятие RX33 / Красные / Dry Deserts, переезд TR39 — ВКЛЮЧАЕТ океан под городом: FAQ),
   перепись TR45 (`marsTilePiecesOn` → `[{city, 1}, {ocean, 1}]`; с ярусом RX20 — `[{city, 2}, {ocean, 1}]`). **НЕ** срабатывает: «когда ВЫ размещаете
   океан» (`isUncoveredOceanSpace` — океан не размещался: Arctic Algae, Polaris, Lakefront Resorts — нет), печатный бонус клетки (уже выдан
   океану — `coveringExistingTile`, survey-семья Ares видит `covers`).
5. **Что платит розыгрыш**: печатный бонус клетки — НЕТ (покрыт); соседство с ДРУГИМИ океанами — ДА (+2 M€ за каждый, `oceanBonus` игрока;
   океан ПОД городом — не сосед, не платит); Ares-соседи, пассивы партий (Марс вперёд: +1 сталь + карта — «тайл / город на Марсе»), принятый
   закон — как у любого размещения (`grantPlacementBonuses` с `coveringExistingTile = true`); `tile-placed` с `CITY`, `tilesPlaced` +1;
   строка журнала называет ПОКРЫТИЕ («placed a city on top of the ocean at <клетка>» — ключ новый, Grep).
6. **Переезд города TR14** (решение 6, рекомендация «да»): город TR44 — ОБЫЧНЫЙ город, `cityStandsOnOcean` его НЕ блокирует (4-bis — про
   СОСТАВНОЙ тайл, у которого нет другого места); уезжает ВЕРХНЯЯ фишка (при стопке — верхний ярус, как сегодня; при одиночном городе —
   он сам с `card`), **ОКЕАН ОСТАЁТСЯ на клетке ничьим простым океаном** (`space.tile = covers`, `space.player = undefined`), счёт океанов не
   меняется, Столица рядом не теряет; на новой клетке — обычная посадка города. Ни одна фишка не меняет типа (закон владельца).
7. **Переезд океана TR39 ИЗ-ПОД города** (FAQ стр. 18 — НЕ решение, правило): океан под городом TR44 — ИСТОЧНИК переезда (`isPlainOcean` →
   «простой океан есть на клетке: сверху или под обычным городом»); уезжает ТОЛЬКО океан, **город остаётся** (`from.tile` теряет `covers`,
   `player` стоит); клетка-резерв с городом на ней: больше не океан (`isOceanSpace` false — соседям не платит, в 9 не считается — счёт падает
   на 1 и восстанавливается посадкой на B — итог 0 как у любого переезда), печатный бонус резерва под городом НЕ освобождается (на нём стоит
   город); +1 РТ переезда — как сегодня (`lastTileMoveReward`, PL-133). Составной океан — по-прежнему `upgraded-ocean`.
8. **Снятие океана ИЗ-ПОД города** (RX33 Water Export, действие Красных `RemoveOceanTile`, Dry Deserts — решение 7, рекомендация «да», та же
   физика «remove only the ocean at the bottom of the stack»): `Game.removeTile` на клетке «город над океаном» снимает ТОЛЬКО океан — город и
   владелец стоят; `tile-removed` с `OCEAN`; счёт океанов −1; Столицы рядом пересчитываются (PL-041). Досье снятия НАЗЫВАЕТ это («Океан уйдёт
   из-под города; город останется»).
9. **Ярус RX20 на городе TR44**: стопка из обычных городов над океаном (`stackHeight` 2, океан в `covers`); картинка — вода-основание, два яруса,
   «×2», метка океана; переезд TR14 со стопки — верхний ярус, основание (город над океаном) стоит; перепись — 3.
10. **Действие** (раз за поколение): **+1 животное СЮДА** всегда (`addResources: 1`); **«можно +1 data на ЛЮБУЮ карту»** — необязательно: цель —
    любая СВОЯ карта-держатель data (свой стол + SRR; соперник — никогда; TR43 правило 3), никогда авто (одна цель — тоже шаг), **отказ — RT
    внутри выбора** (закон AE: «выбор, чей единственный ответ — пик, ЕСТЬ этот пик»; плашка «Не добавлять data» в строке вопроса); нет держателя
    → data пропущена ПО ИМЕНИ (`SKIP_REASON.noHolder` — класс), животное идёт, действие доступно. Прогноз ответа стола: Martian Fiber (+1 M€ за
    data — TR46 класс PL-189), роль держателя под каждым кандидатом (К-T1 TR48). ОДИН POST из композера.
11. **ПО**: 1 за каждые 2 животных на карте (округление вниз; `resourcesHere` + `per: 2`); обозреватель счёта и значок карты — класс Herbivores.
12. **Метки и ответы стола**: метка Животного будит Decomposers (+1 микроб — розыгрыш карты с меткой животного), TR38 Biological Simulations
    (+1 data), Ecological Zone (+1 животное); метка Здания + НЕОТРИЦАТЕЛЬНЫЙ значок ПО («1/2») → **TR16 Administration District добирает карту**
    (`hasNonNegativeVictoryPointsIcon` — сверить, что переменный значок «1/2» читается как неотрицательный, как у TR13 / TR33); метка Здания — оплата
    сталью (панель предлагает сталь); РАЗМЕЩЕНИЕ города — Pets / Immigrant City / Tharsis Republic / TR30 Red Museum / Martian Census (ярус-класс
    «a tier is a tile placed» — здесь целый город). Прогноз (`cardPlayedForecast` + `tilePlacedPreview`) называет всё ДО нажатия; живой путь —
    порядок движка; превью ↔ исполнение паритетом (`replayBatch`, ноль переспросов).
13. **Оплата**: 16 M€ или сталь (Здание); розыгрыш — staged-размещение (клетка выбирается ДО оплаты — `docs/TILE_PLAY_STAGED_COMMIT.md`; паритет
    staged ↔ live в спеке карты — гард `stagedPlacementParity` набор не включает).
14. **MarsBot** карту не играет; его океаны — цели (правило 2); его тайлы рядом с океаном под городом получают +2 M€ (бот: `oceanBonus` 2).
15. **Save / load**: `covers` уже сериализуется; новое поле модели клиента (`under`) — только вид; старые сейвы — без изменений.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **RU-имя «Подводная исследовательская станция»** (Grep — не занято; длинно: проверить лестницу длины в крошке «ДЕЙСТВИЯ КАРТ › … › НАСТРОЙКА»
   и в плашке руки на 4K / fhd; если режется — **«Подводная станция»**). Лор — из реестра придуманного (EN / RU выше).
2. **МОДЕЛЬ «ДВА ТАЙЛА» = ОБЫЧНЫЙ `CITY` + `covers: OCEAN`** (контракт §1), НЕ новый составной `TileType` в `OCEAN_TILES` ∩ `CITY_TILES`. Причина —
   акцент владельца: составной тайл — это ровно «1 тайл» (Ocean City), а здесь город обязан оставаться обычным городом (переезд, ярус, Мэр), а океан —
   обычным океаном (переезд ИЗ-ПОД — FAQ, снятие, перепись 2). Альтернатива «составной тайл + флаг» отвергнута: каждое правило из 4–9 пришлось бы
   пробивать исключением.
3. **КАРТИНКА КЛЕТКИ — выбор владельца по кадрам 4K** (агент делает концепции на ОДНОМ стенде: TR44 над океаном РЯДОМ с Ocean City Ares и с
   обычным городом и обычным океаном, покой + увеличение + зум подсмотра; кладёт в батч):
   - **(а) «ЯЗЫК СТОПКИ» (рекомендация).** Та же правдивая стопка, что у RX20: **вода — основание** (полный гекс `tile_ocean.png` в масштабе
     `@stack-scale` с швом-тенью под ярусом), **город — ярус** над ней (`translateY(−@stack-step) scale(@stack-scale)` — та же геометрия, что
     у стопки, чтобы посадка `stackLandingRect` и картинка совпали пиксель в пиксель), куб владельца на ярусе, **метка океана** `.board-stack__under`
     (миниатюра `tile_ocean.png` на тёмной плашке — закон «спрятанная фишка отмечена миниатюрой»; с дивана 3,5 px ободка воды не прочесть, метка
     читается), счётчика «×1» НЕТ (счётчик — ярусы ГОРОДА; появляется с RX20 как «×2»). Разница с Ocean City: составной арт одной фишки vs две
     фишки с видимым швом и меткой. Плюс: ноль новых CSS-языков, посадка яруса и переезд со стопки УЖЕ знают эту геометрию.
   - **(б) «ПОНТОН».** Город в полный гекс, вокруг — кольцо воды (ободок 2–3 px из арта океана + тонкая световая кромка «берега»), метка океана
     внизу. Читается крупнее, но вводит третий язык рядом со стопкой и составным тайлом.
   - **(в) Составной арт «город на воде» для TR44** — ОТВЕРГНУТО акцентом (это и есть «1 тайл»).
   Рекомендация — (а): одна физика, один язык, одна геометрия для картинки, посадки и обоих переездов.
4. **ПОСАДКА — выбор по кадрам** (сцена «город садится на воду»; агент снимает раскадровку (а) и (б) на 4K GPU):
   - **(а) «НИЗКАЯ ДУГА + ВОДА ОТВЕЧАЕТ» (рекомендация).** Обычный полёт тайла (`TILE_FLIGHT_MS` 520, арка, масштаб, тень), посадка В ЛИФТ ЯРУСА
     (`stackLandingRect(hex, 2)`-геометрия — проекция ретикла и прокси садятся туда, где клетка потом красит ярус), касание = **брызги**
     (`playCoverSplash` — уже язык покрытия океана) + **один затухающий «поплавок»** города (1 бобок ≈ 2 px / 260 мс, `power2.out`, без второго
     качания — спокойно, Ark Nova), реальная клетка красит стопку в кадре касания (класс `cityStackScene.contact` без счётчика), куб падает на
     ярус, **потом** соседние океаны платят (существующий OCEAN beat — монета рождается у общего берега КАЖДОГО соседа-океана; океан ПОД городом
     молчит — он не сосед), затем ответ стола. Соперник — та же фраза удалённой сценой (вода держится под полётом — уже есть).
   - **(б) «КРАН» (язык яруса).** Подлёт → зависание над водой → вертикальный спуск → контакт + брызги вместо пыли. Физически честно («ставлю на
     стопку»), но спуск краном — язык «на СВОЙ город»; на воду сажают с лёту.
   Reduced motion — кроссфейд 160 мс + покраска стопки; брызг нет. Длительность сцены ≤ обычной посадки города + брызги (A/B).
5. **РЕТИКЛ НАД ОКЕАНОМ** — призрак города В ЛИФТЕ яруса над водой (проекция «на тайл»: второй объект — ПРАВДА, не ошибка; квайет-зона бонусов не
   нужна — клетка покрыта), подпись «поверх океана» в баре досье; законные клетки = простые океаны без всего (правило 2), метки отношений — соседние
   океаны тоном `ocean` (они платят), озеленения рядом тоном `score`.
6. **TR14 переселяет город TR44 — ДА** (правило 6; альтернатива «нет, как 4-bis» — против: 4-bis обосновано тем, что СОСТАВНОЙ тайл нельзя
   подменить; у TR44 город — обычная фишка, FAQ про стопку: «remove only the top-most»).
7. **RX33 / Красные / Dry Deserts снимают океан ИЗ-ПОД города — ДА** (правило 8; альтернатива — только TR39 по букве FAQ, снятие — нет: против,
   физика одна; в досье снятия и в подсказке кандидата сказано «город останется»).
8. **Действие «можно +1 data»** — knob **`AddResource.optional`** (зеркало `OrBehavior.optional` TR43) с читателями: `Executor` (оборачивает
   `AddResourcesToCard` в форму «пик + `skip`-маркер» — ту, что читает `optionalChoiceOf(...).pick`; нет держателя → named skip, как сегодня),
   превью действия (шаг цели помечен необязательным → плашка RT «Не добавлять data» в композере), `collectActionBehaviorReasons` (причина
   держателя — не причина действия), `make:cards` / `cardInformation` (капшен «можно»). Альтернатива — bespoke `OrOptions` в карте: против
   (центральная семья, хуки в карте).
9. **«ЛЮБАЯ карта» = своя** (TR43 / TR48 прецедент).
10. **Перепись TR45**: город над океаном = **2 тайла** (решено в TR45: «стопка океан + город = 2»); Ocean City остаётся 1.
11. **e2e: ОДИН новый спек** `tests/e2e/console-aquatic-research-station.spec.ts` с 3–4 фикстурами (§4); соседи — существующими спеками.
12. **Батч — ПЕРВЫМ после кадров концепций**, одним `AskUserQuestion` (≤ 4 вопроса, рекомендация первым): (1) картинка (решение 3) с путями к
    кадрам «TR44 рядом с Ocean City»; (2) посадка (решение 4) с раскадровками; (3) переезд TR14 + снятие RX33 из-под города (решения 6–7) одним
    вопросом; (4) арт `TR44.png` (попросить) + строки «ждёт владельца» на маршруте (`grep` в момент батча).

---

## 0. Рабочее дерево
HEAD `a6b42a9e39`. **СОСЕД (сессия TR52, итерация «Сброс») АКТИВЕН** — незакоммичены его `src/client/components/console/{ConsoleShell.vue,
ConsoleRevealOverlay.vue, deckDraw/ConsoleDeckDrawLayer.vue, discardPile/*}`, `src/client/console/{consoleWsStageLayout.ts, deckDraw/*,
discardPile/*}`, `src/styles/{common.less, console_board_bonus.less, console_deck_draw.less, console_tv.less, console_discard_pile.less}`,
`tests/client/components/console/{consoleWsStageLayout,deckDrawModel}.spec.ts`, промт TR52. **Не трогать и не коммитить его файлы**; перед
правкой `ConsoleShell.vue` / `console_tv.less` / реестра — ListAgents + SendMessage соседу (память `concurrent-session-edits-same-files`).
Коммиты — только через временный индекс (`GIT_INDEX_FILE` абсолютным путём; **read-tree → commit ОДНОЙ командой** при активном соседе; `git reset
-q` после; ханки одного файла — НЕ `--unidiff-zero`), `git add` своими путями; после коммита — `git restore --staged package.json
package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr44`, `TM_E2E_ROOT=.e2e-tr44`; 4K — `--workers=1` или `TM_E2E_GPU=1`; **тайминги —
A/B на одном снапшоте** (память `ab-baseline-head-client-in-snapshot`), перф — и в GPU-режиме.

## 1. Сервер — КОНТРАКТ «ДВА ТАЙЛА НА КЛЕТКЕ» (коммит 1), затем карта (коммит 2)
**Одно чтение.** В `src/common/boards/` (рядом с `cityStack.ts` — или в нём) — **пьесы клетки**: чистые функции над структурной клеткой
`{tile?: {tileType, covers?: {tileType}}, stackHeight?}` (сервер) и `{tileType, under?, stackHeight?}` (клиент): `buriedTileOf(cell)` — фишка
ПОД верхней (спецгород под ярусами — как сегодня `stackBuriedTile`; **океан под обычным городом** — новое), `hasPlainOcean(cell)` («на клетке есть
простой океан — сверху или под обычным городом»), `isPlainOceanTop(cell)` («сверху — простой океан, на нём ничего»). Читатели — ВСЕ места
диагноза 2 и 5: `Board.isOceanSpace` (→ `hasPlainOcean` ∨ `OCEAN_TILES` верха), `getOceanSpaces` (`{upgradedOceans: false}` = простые океаны
ВКЛЮЧАЯ покрытые; составные — по флагу как сегодня), `getAvailableSpacesForType('upgradeable-ocean' | '-new-holland' | 'city-over-ocean')` и
`illegalReasonFor` — по `isPlainOceanTop` (составной и TR44-покрытый → `occupied`), `oceanMove.isPlainOcean` → `hasPlainOcean`, `cityStandsOnOcean`
— без изменений (составной), `marsTilePiecesOn` — `+ {ocean, 1}` при погребённом океане (строка таблицы спека), `capitalAdjacencyVp.ts:33` —
с прямого `OCEAN_TILES` на ту же пьесу (ПО Столицы за океан под городом — спек). **Ни одного `tile.covers` и ни одного `OCEAN_TILES.has(верх)` «есть ли
океан» в карте, в движке или в клиенте напрямую** — только через пьесы (гард: grep-спек по `src/server` на `OCEAN_TILES.has(` вне `TileType.ts` /
пьес, по образцу `lessDeadSelectorGuard`).
**Три писателя.** (1) `Game.addTile` — knob **`AddTileOptions.overOcean`** (зеркало `stacking`): `canCover` пускает обычный `CITY` на
`isPlainOceanTop`-клетку ТОЛЬКО с ним; `simpleAddTile` пишет `covers` (переносит запись из `PlaceTile :50–51` сюда ОДНИМ местом для всех трёх
видов — Ocean City не меняет поведения); `PlaceTile` передаёт knob для вида `'city-over-ocean'`; `withHypotheticalTile` уже ставит `covers`.
(2) `liftTopCity` при высоте 1 и погребённом океане — клетка остаётся `{tileType: OCEAN}` ничьей (не пустой), уезжающий тайл — без `covers`;
`Game.moveOceanTile` при покрытом источнике — `from.tile` = верх без `covers`, `player` стоит. (3) `Game.removeTile` при покрытом океане — снимает
только океан (решение 7); `recordTileRemoved(OCEAN)`. Спеки: `tests/boards/cellPieces.spec.ts` (таблица пьес: пусто · океан · город · город над
океаном · стопка над океаном · Ocean City · Wetlands · Столица под ярусом), `oceanMove.spec` / `cityMove.spec` (+ источник из-под города; TR44-город
едет; составной — нет), `marsTileCensus.spec` (+ строка), `tests/game/TwoTileCell.spec.ts` (addTile с knob и без; бонусы розыгрыша — правило 5;
`isOceanSpace` / счёт 9 / TR43 / Столица / Мэр до и после; TR39 из-под; TR14 с воды; `removeTile` из-под; RX20 ярус сверху; save / load),
регрессия: `OceanCity.spec`, `NewHolland.spec`, `OceanFarm`, `ReSettlement.spec`, `CanyonCarving.spec`, `CompostingInitiative.spec`,
`WaterExport` / `ResolutionTileRemoval.spec`, `placementPreviewConsistency`, `placementEffectConsistency`.
**Вид размещения `'city-over-ocean'`** (`PlacementType` + `BoardPlacementKind` + `placedTileType → CITY` + `previewContext`: `countsAsCity`,
`covering`, `bonusesCovered`, НОВЫЙ факт `ocean-under-city` «Океан под городом по-прежнему платит +${0} M€ тайлам рядом» из `oceanNeighbourRuleFact`
— тот же источник правила; `KIND_TITLE` «Город на океан»; `swatchForKind → CITY`; `shapeOf` — «поставьте город поверх океана»; причины правила 2).
Инспектор клетки после розыгрыша: `baseCellStatus` — `tileLabel` «Город на океане», `countsAs: ['city', 'ocean']`, описание «Два тайла: город стоит на
тайле океана. Океан по-прежнему платит соседям.» + факты ПО города + `oceanNeighbourRuleFact`. Досье снятия / переезда океана — «из-под города,
город останется».
**Карта** `src/server/cards/turmoilRedux/AquaticResearchStation.ts`: `CardName.AQUATIC_RESEARCH_STATION = 'Aquatic Research Station'`; `ActionCard`,
ACTIVE, 16, `[Tag.ANIMAL, Tag.CITY, Tag.BUILDING]`, `requirements: {party: PartyName.GREENS}`, `resourceType: ANIMAL`, `victoryPoints: {resourcesHere:
{}, per: 2}`; `behavior: {tile: {type: TileType.CITY, on: 'city-over-ocean'}}` — или `city: {on: …}`: что честнее для `tile.card` и статистики
«город размещён», решает агент — спек пинит «лёг ОБЫЧНЫЙ `CITY` с `card` и `covers`»; `action: {addResources: 1, addResourcesToAnyCard: {type:
CardResource.DATA, count: 1, optional: true}}` (решение 8); без `compatibility`; шапка — чтение скана + правила 1–15 + «лор придуман». Хуков в карте
— ноль (всё — классы). Гарды §3 чеклиста: `cardPlayReplayCoverage`, `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`,
`effectForecastCoverage`, `actionPreviewCoverage`, `make:cards` 0 / 0 / 0.

## 2. Клиент — ГЛАВНОЕ
1. **Модель**: `SpaceModel.under?: TileType` (`ServerModel` — из пьес, только когда есть погребённая фишка); `verifyPlacement` / `detectFreshPlacements`
   — диф `OCEAN → CITY(+under)` уже читается как покрытие; **`verifyMove`** — две новые пары: «океан ИЗ-ПОД города» (A: `CITY+under` → `CITY`, тот же
   владелец; B: ПУСТО → `OCEAN` ничей; прокси — ОКЕАН без куба) и «город С ВОДЫ» (A: `CITY+under` → `OCEAN` ничей; B: ПУСТО → `CITY` владельца; прокси
   — город с кубом); `detectFreshRemovals` — «снятие из-под» (A: `CITY+under` → `CITY`): прокси ухода — океан. Чистые юниты на каждую пару.
2. **Картинка** (решение 3): `BoardSpace.vue` рисует пьесы — база = `under ?? tileType`, ярусы — как сегодня, верх — `stackTopTile`; `buriedArtClass` —
   из `buriedTileOf` (метка океана); `board-space--stack-special` ⇒ «клетка с погребённой фишкой» (счётчик стоит на месте при появлении метки);
   геометрия стопки `--stack-n` при `under` без ярусов = 2; `.board-stack__tier` основание-вода со швом. Подсмотр L3 (`boardPeek`) и зум клетки — те же
   классы. Гард: юнит `BoardSpace.spec` (клетка `CITY+under` → один `[data-stack-tier]` с артом океана, `[data-stack-under-tile]` океан, без
   `[data-stack-count]`; со `stackHeight: 2` — «×2»; Ocean City — ни того, ни другого).
3. **Посадка** (решение 4): `armTilePlacement({…, overOcean: placementType === 'city-over-ocean'})`; герой — прокси в `stackLandingRect`, брызги на
   касании, покраска стопки в кадре касания (`cityStackScene.contact` без счётчика — или новый флаг `afloat`), куб на ярус, соседние океаны платят
   (`lastOceanBonus` — как сегодня), ответ стола; удалённая сцена — та же фраза (`holdRemoteReveal(space, OCEAN)` уже держит воду). Ретикл — призрак
   в лифте яруса (решение 5). Длительность — A/B против посадки обычного города.
4. **Сцены переезда / снятия** — одна картина «фишка, которая едет, едет своим артом; та, что остаётся, не исчезает ни на кадр»: TR39 из-под —
   прокси-океан выскальзывает из-под яруса (старт в геометрии основания), город ОСЕДАЕТ на гекс (зеркало `unloading`: ярус → полный гекс, метка
   гаснет — одна CSS-фраза на правилах клетки), B — обычная посадка океана + РТ (PL-133); TR14 с воды — город поднимается с яруса (куб на прокси),
   вода остаётся полным гексом, метка гаснет; RX33 из-под — тот же уход океана, что у `playTileDeparture`, город оседает. У соперника — по записи
   сервера (`tileMoveRecords.pairTileMoves` + новая пара). Спек `tileMoveScene.spec` пинит константы.
5. **Композер розыгрыша** (`КАРТЫ В РУКЕ › ПОДВОДНАЯ … › РОЗЫГРЫШ`): «ДАЛЕЕ: поставьте город поверх океана» с значком «тайл поверх тайла» (тот же
   узел, что на лице); staged-размещение (B-лестница как у TR14/TR39); досье клетки: «Город на океан» · «Бонуса клетки нет — он уже выдан океану» ·
   «+2 M€ × N — соседние океаны» (с клетками) · «ПО: +1 за озеленение рядом» · «Океан под городом по-прежнему платит соседям» · «Стопка: нет».
6. **Композер действия** (`ДЕЙСТВИЯ КАРТ › … › НАСТРОЙКА`): «+1 [животное] на эту карту» (герой — капсула, ACTION COMMIT: волна с печатного значка в
   капсулу) + шаг цели data (класс TR48: кандидаты с ролью и исходом «N → N+1», RT-плашка «Не добавлять data»; ноль держателей — строка «Нет карты для
   data» и пропуск по имени) → ОДИН POST → животное на капсулу, data — жетоном с печатного «[data]*» в миниатюру цели (PL-163 класс).

## 3. Лицо, локаль, лор, арт
`renderData` (чтение скана) → витрина EN / RU, миниатюра, рука, композер; узел «тайл поверх тайла» — ОДИН в рендер-DSL (лицо + досье + «ДАЛЕЕ»).
Ключи — Grep по всем `src/locales/<lang>/*.json` ПЕРЕД каждым: имя, описание, `Action: …` (`turmoil_redux_cards.json`), `action-short` при
бюджете > 52 (RU руками), заголовок промпта «Place a city on top of an ocean tile», вид «City over ocean», причина «No ocean tile to place a city
on», факты досье / инспектора, строка журнала покрытия, «Не добавлять data», слова снятия / переезда из-под города. Лор — `lore_texts.json` «TR44» +
RU; реестр придуманного — «в коде». Арт — попросить; до получения — `make:cards` без арта (гард арта скажет).

## 4. Тесты
Сервер — §1. Клиент: юниты пьес (`cellPieces`), `BoardSpace`, `tilePlacementModel` (пары `verifyMove` / `detectFreshRemovals` / `verifyPlacement`
покрытия городом), `tileMoveScene`, `placementDossier` (вид), `consolePlacementNextStep` (фраза), `optionalChoice` (пик с data — RT). **e2e — ОДИН**
`tests/e2e/console-aquatic-research-station.spec.ts` (fhd + **4K**, `--repeat-each=4`, state-waits, `TM_E2E_STORYBOARD=1`, `placeTile` двухфазный,
`walkToSpace`; красный — второй клиент) с фикстурами (`parliamentFixture`, Зелёные правят стартовым правилом, как `ichtiology-grant`):
1. **`aquatic-research-station`** — TR44 в руке, 20 M€, 0 стали; три простых океана красного кластером: O1 (цель) с соседями — O2 (платит +2),
   озеленение синего G (ПО +1), пустой резерв R рядом с O1 (для теста 2), свободная суша L рядом с O1 (для теста 3). Композер → «ДАЛЕЕ» → поле
   (законные = ровно 3 океана; на R — `requires-ocean-tile`, на суше — то же; призрак в лифте) → досье O1 (строки п. 2.5) → два нажатия →
   посадка: вода не исчезает ни в одном сэмпле (`.board-space-tile--ocean` ∨ `[data-stack-tier]` с артом океана на каждом тике), брызги, стопка
   в кадре касания, куб, монета с O2, «+2 M€»; после: `[data-stack-under-tile]` = океан, нет «×», инспектор O1 — «Город на океане · два тайла»;
   HUD океанов 3/9 не дрогнул; красный видит посадку (вода под полётом). Длительность ≤ посадки обычного города + 460.
2. **`aquatic-research-station-canyon`** — TR44 УЖЕ стоит на O1 (фикстура через `addTile` с knob), TR39 Canyon Carving в руке (плашка Зелёных —
   та же!): уровень источника — O1 ЗАКОНЕН (досье: «Океан уйдёт из-под города; город останется»), Ocean City-подобных нет; клетка R; сцена —
   океан выскальзывает, город оседает (ярус → гекс, метка гаснет), на R обычная посадка + РТ; после — O1: город без метки, `isOceanSpace` false
   (инспектор: «Резерв океана занят городом»), HUD 3/9 → 3/9 (переезд), TR43-счёт не меняется.
3. **`aquatic-research-station-action`** — TR44 в табло с 1 животным, держатели data (TR48 с 0, TR15 с 2), «Действия карт»: настройка (животное
   на капсулу; шаг цели data с исходами), RT-отказ → ОДИН POST → животное 1 → 2, data нет; повтор-вариант с целью TR48 — жетон в миниатюру.
4. **`aquatic-research-station-twins`** (стенд + контактный лист; e2e-проверка картинки, если дёшево): `aresExtension: true`, Ocean City красного на O3,
   TR44 синего на O1 — у O1 метка и ярус, у O3 — ни того, ни другого; зум подсмотра обеих.
Регрессия на своём снапшоте, до / после: `console-canyon-carving`, `console-re-settlement`, `console-parliament-skyscrapers`, `console-composting-
initiative`, `console-ichtiology-grant`, `console-placement-{confirm,dossier,relations,navigation,source}`, `console-tile-replacement`,
`console-staged-play`, `console-hazard-placement`, `console-auto-tile-landing`, `console-board-card-bonus-concurrency`, `console-parliament-*`
с RX33 (Water Export), `aaa-driver-canary`; `npm run e2e:affected`; гарды `e2eLiveness`, `e2eDriverGuard`, `glyphLiteralGuard`,
`lessDeadSelectorGuard`, `offMarsCellPlacement`. `npm run build:test` обязателен.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Контактный лист: (1) клетка «город над океаном» рядом с Ocean City, обычным городом, обычным океаном и стопкой RX20 — покой, зум, подсмотр L3,
fhd и 4K: **видно ли с дивана, что фишек ДВЕ, и чем это отличается от Ocean City**; (2) раскадровка посадки целиком (композер → поле → досье →
полёт → касание → брызги → стопка → куб → монеты соседей → ответ стола → уход workspace) — по каждому моменту «что здесь слабо?» с кадром;
(3) раскадровка TR39 из-под города и (если решение 6) TR14 с воды — обе стороны (свой / соперник); (4) «Действия карт» с RT-отказом; (5) витрина
EN / RU, рука (плашка, «Можно разыграть» / причина «нет океана»), обозреватель счёта (ПО 1/2). Пробник долей блоков (`auditStage`) на композере
и на сцене посадки; `type ladder` на досье.

## 6. ПОЛИРОВКА ПО ПУТИ (≈ 20 % — но карта тянет контракт, так что бюджет = всё сверх карты)
Реестр: раздел **AG** «два тайла на клетке: пьесы клетки · город над океаном · посадка на воду · океан из-под города». **Открытые на маршруте —
сперва воспроизвести:** PL-128 (раскадровка «Действий карт» на 4K — здесь делается для TR44), TR14 «переезд на опасность Ares = два такта»
(журнал § TR14). **Кандидаты:** К-W1 инспектор клетки с составным тайлом (Ocean City) — говорит ли он «ОДИН тайл: считается городом и океаном»
(контраст с TR44 должен быть сформулирован обоими); К-W2 досье `upgradeable-ocean` (Ocean City) — «Бонуса клетки нет» без причины «он уже выдан
океану» (класс для обоих видов); К-W3 метка `.board-stack__under` на 4K — читается ли миниатюра океана / Столицы с дивана (размер в TV-токенах?);
К-W4 монета соседнего океана при посадке НА воду — рождается у общего берега, а не из-под города; К-W5 ретикл над занятой клеткой — призрак и
кольцо не спорят с кубом владельца океана (куба нет — океан ничей) и с меткой; К-W6 HUD «N/9» при переезде из-под города — не дрогнуть (PL-133
класс); К-W7 подсмотр TR45 — клетка с двумя фишками подсвечивается ОДИН раз, состав «город 1 · океан 1» перекликается с метками. Только-Deck —
не полируем (PL-105).
**Правила** — `board.md` § «ДВА ТАЙЛА НА КЛЕТКЕ — пьесы» (одно чтение, три писателя, составной тайл = одна фишка), `console-ui.md` § «ФИШКА, КОТОРАЯ
ЕДЕТ» (дополнение к правдивой стопке: океан под городом), `tile-replacement.md` § THE FIFTH case (посадка на воду; уход из-под), `board-placement-
flow.md` (вид `'city-over-ocean'` в таблице семей), `TURMOIL_REDUX_RE_SETTLEMENT.md` §2 (клетка после подъёма с воды), чеклист §4 (строка «город
поверх океана»), `docs/TURMOIL_REDUX_AQUATIC_RESEARCH_STATION.md` — НОВЫЙ документ контракта (карта ввела контракт, который наследует следующая).

## 7. Режим работы
**Коммиты**: (1) контракт пьес + три писателя + вид размещения + спеки сервера (регрессия соседей зелёная); (2) карта + спек + локаль + лор (+ арт,
когда придёт); (3) модель клиента + картинка + юниты (кадры концепций → **батч**); (4) посадка (герой + remote) + ретикл + досье; (5) сцены из-под /
с воды (TR39, TR14, RX33) + пары `verifyMove`; (6) действие (knob `optional` + композер); (7) e2e; (8) документы — журнал § TR44 (таблицы: правила,
решения, раскадровки, A/B), правила, контракт-документ, чеклист, реестр AG, реестр лора, промт. **Коммиты полировки** — `Polish (TR44 · two tiles on
one cell): PL-### — …`. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой —
`npm run make:css` + `npm run build:server`. **Не пушить.** Батч — после кадров концепций (коммит 3), ДО посадки.
Гочи: `turmoilReduxExpansion: true` в `testGame`; Ares в фикстуре-близнеце — `aresExtension: true` (Ocean City требует 6 океанов — ставить `addTile`
напрямую); полная перегенерация фикстур перетасует ВСЕ Redux-фикстуры — добавлять только свои JSON; `FixtureName` — строка ДО сборки (webpack
типизирует `screenshots/**`); `@stack-step` / `STACK_STEP_PX` — менять парой; слой `position: fixed` — всегда контекст наложения; rect-пробник краску не
читает — видимость воды под полётом проверять классом клетки на каждом тике; 4K-раскадровка идёт ≈ 0,3× — тайминги по пробнику; e2e-сэмплер —
`setInterval`; курсор поля ходит только по законным клеткам — R3 для осмотра отказа; `eqeqeq` без исключения для null; `rtk grep` с фиксированной
строкой виснет — Grep-инструмент; RTK-хук съедает `\\` — такие правки Edit-инструментом; `npm run build:server`, не голый `tsc`; юниты — на тихой
машине; сосед пишет реестр — footer читать в момент записи.
**В отчёте:** таблица правил 1–15 с доказательствами; таблица «что получил даром / что потребовало руки» (форма TR39); кадры «TR44 рядом с
Ocean City»; раскадровки посадки и ухода из-под; A/B длительности; что выбрал владелец и почему; регрессия (юниты / гарды / lint / e2e по
классам); новые ключи; лор; **раздел «ПОЛИРОВКА»** — с СОБСТВЕННЫМИ находками. **Явно — всё, что не получилось, и почему.**

## 8. Нельзя
Новый составной `TileType` для TR44 (решение 2); `tile.covers` в карте или в клиенте мимо пьес; две арифметики «есть ли океан» (`isOceanSpace` и
локальная проверка); город, под которым вода пропадает хоть на кадр (посадка, релиз, переезд, зум); картинка, где TR44 неотличим от Ocean City;
фишка, меняющая тип в кадре (город → составной, океан → «часть города»); `removeTile`, сносящий город вместе с океаном; переезд TR39 с
`upgraded-ocean` на TR44-океан; `verifyMove` «на глаз» без объявленной пары; `v-if`-моргание клетки; `setTimeout` вместо удержания; `filter` для
теней; авто-цель data при одном держателе; отказ data строкой списка или через B; пост-коммитный выбор; `title`; литерал имени карты в
`src/client/**`; литерал кнопки контроллера; определение промта по заголовку; `compatibility`; e2e сверх одного спека; полировка только-для-Deck;
`shardPlan.json`; файлы соседа TR52 и `.polish1/*` в своём коммите; пуш и красные коммиты.
