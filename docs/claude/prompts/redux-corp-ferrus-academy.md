# Промт исполнителю · Ferrus Academy — ВТОРАЯ из восьми НОВЫХ корпораций набора Redux (TR79): 40 M€ + 1 пр. растений, метки Наука + Город; **ПЕРВОЕ ДЕЙСТВИЕ: разместите город, его ПЕЧАТНЫЙ бонус клетки УДВОЕН, затем ваш куб ложится на КАЖДУЮ соседнюю незарезервированную клетку — строить там можете только вы**; **ЭФФЕКТ: когда вы кладёте тайл на клетку со своим кубом — 3 данных на ЛЮБУЮ карту ИЛИ карта** · ТРИ инфраструктуры сквозным контрактом: (а) МНОЖИТЕЛЬ ПЕЧАТНОГО БОНУСА одной посадки — от превью клетки до записи языка тайлов; (б) «ПОСТРОЕНО НА СВОЁМ КУБЕ» — ОДНО чтение движка и ОДИН co-located хук `onOwnMarkerBuilt`, от которого стреляют И Arcadian Communities, И Ferrus (куб — ОДНО состояние поля, без провенанса); (в) НЕЙТРАЛЬНОЕ ИМЯ МАРКЕРА на всех общих поверхностях (источников куба теперь три: Land Claim, Arcadian, Ferrus) · **ГЛАВНОЕ — ПЕРВОЕ ДЕЙСТВИЕ КАК ОДНА ФИЗИЧЕСКАЯ СЦЕНА:** при выборе клетки города на кольце соседей стоят СИЛУЭТЫ кубов (куда лягут — видно до нажатия), досье клетки называет удвоенный бонус и число участков; после посадки города кубы САДЯТСЯ ПО ОДНОМУ по кольцу — как рука ставит их в настолке, никогда одним кадром

> **Статус: ВЫДАН 2026-10-26.** HEAD `07520464bb` (стенд дивидендов). Дерево НЕ чистое — сосед (добор «одно действие — один забор»)
> держит `ConsoleActionComposer.vue`, `deckDraw/ConsoleDeckDrawLayer.vue`, `cardIntake/intakeAssemblyDirector.ts` (`git status`);
> `ListAgents` перед каждой серией коммитов, коммиты ТОЛЬКО `git commit -- <paths>`. **Скан** — `C:\Users\zelin\Downloads\TM Turmoil
> Redux\Corporations\Corporation - Ferrus Academy.png`. ⚠ **ОПЕЧАТКА СКАНА: на плашке 40 M€, в тексте правил 45 — ВЕРНО 40** (владелец
> 2026-10-26: «считаем, что в тексте опечатка, а нарисовано правильно»); строка реестра несёт пометку. **Арт ГОТОВ** —
> `C:\Users\zelin\Downloads\Mars Arts\Ferrus Academy.png` (промт арта `docs/claude/prompts/corporation-art-ferrus-academy.md`) →
> `node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\Ferrus Academy.png" TR79` → `npm run make:cards` (размер не
> 1536×1024 — `--force`). **Лор — СО СКАНА**, ключа нет ни в EN, ни в RU: EN в `assets/text/lore_texts.json` под `TR79`: «At the dawn of
> the terraforming effort 5 rich academics pooled their resources together to form a self-governing research campus for the benefit of
> the sciences. Tuition is astronomical, but the pedigree is valued everywhere.»; RU в `src/locales/ru/lore_texts.json` (ключ = английский
> текст): «На заре терраформирования пятеро богатых академиков сложили средства, чтобы основать самоуправляемый исследовательский кампус
> на благо науки. Плата за обучение астрономическая, но диплом ценится везде.» Имя — латиницей (`zz_corporation_names.json`, как
> `Arwind Inc.:22`). Реестр полировки: следующий свободный **PL-1038**, последний раздел CM; **своего раздела нет** — дефекты общего слоя
> строками. **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:snapshot ferrus` → `npm run e2e:remote -- ferrus <spec>`; сцена посадки кубов —
> TIMING `--exclusive --workers=1`; exit 2/3/4 — стоп и `AskUserQuestion`).

Процедура — **чеклист `docs/claude/turmoil-redux-card-checklist.md` §0** («новая механика? — СНАЧАЛА её инфраструктура сквозным контрактом,
потом карта» — здесь ТРИ), §1, §2 (арт/лор), §3 (гарды-ворклист), **§5 политика e2e** (новая механика → свой спек), §6. Корпорация-образец —
**TR78 `turmoilRedux/ArwindInc.ts`** (шапка SCAN READING / RULE READINGS, `corpBox('effect')`, `effect-short` с `tokens`, бюджет 52 символа,
строка реестра `turmoilReduxCorporations.ts` с `authored`) и промт `redux-corp-arwind-inc.md` (формат отчёта, батч решений). Первое действие
«город» — **`corporation/TharsisRepublic.ts:31`** (`firstAction: {text, city: {}}` → `Executor.ts:719–727` → `deferredActions/PlaceCityTile.ts:42–54`
→ `createMarsSelectSpace` → `game.addCity`), bespoke-первое действие с куб-маркером — **`promo/ArcadianCommunities.ts`** (`initialAction` →
`createMarsSelectSpace(… placementEffect: 'marker', customReasoner)` → `space.player = player`; `firstActionPreview` co-located). **Контракты консоли:**
`CLAUDE.md` § A WORKSPACE IS ONE FLOW, § COMMIT BOUNDARY (`owed-step`), § Physical causality («куда, почему, откуда» — каждая анимация отвечает),
инварианты 1–9, 11, 14, 15; **`docs/claude/console/start-first-action.md`** (стадия «СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ», дискриминатор
`generation === 1`, **БАРЬЕР ЗАВЕРШЕНИЯ** — workspace старта не рисуется, пока цепочка посадки не закончилась), `docs/claude/console/board-placement-flow.md`
(двухфазный confirm, ретикл, ghost тайла под курсором), `docs/claude/board-information.md` (факты клетки, `BoardFact.spaces`, досье TR67),
`docs/claude/console/tile-replacement.md`, память `tile-language-polish` («язык размещения тайлов» — запись клетки `CellBonusPaid`), `visual-restraint-no-glow`
(силуэт куба — МАТЕРИАЛ: заливка/контур/прозрачность, никогда ореол), `reuse-existing-icons-check-scan`, `status-line-no-face-restatement`, `piece-keeps-kind`
(куб не меняет род от источника), `composer-preselect-direction` (T14), `card-intake-one-batch-prompt` (добор карты эффектом = пачка одного действия —
точка добора объявляется `cardIntakeSourceCoverage.spec`, PL-1036).

**Образцы — по частям:** **посадка и бонусы** — `Game.ts:2269` (`addTile`, шапка — `AddTileOptions` `IGame.ts:109–121`: `stacking` / `moved` / `overOcean`),
**`:2313–2321` (Part 3: `arcadianCommunityBonus = !stacking && space.player === player && (tableau.has(ARCADIAN) || бот C18)` — ЕДИНСТВЕННЫЙ момент,
когда маркер отличим: `simpleAddTile:2480` перезаписывает `space.player` тем же игроком)**, `:2340` (`grantPlacementBonuses(player, space, covering,
arcadianBonus)` → `publishTilePlacement(…, cell)` — запись языка тайлов), **`:2445–2500` (`grantPlacementBonuses`: печатный бонус `grantSpaceBonuses`
под `withSource spaceBonus` → `CellBonusPaid {paid, cards}`; океанная прибавка ОТДЕЛЬНО `grantOceanAdjacencyBonus`; Ares; `ParliamentHandler.onTilePlaced`;
`if (arcadianCommunityBonus) defer(Gain 3 M€)`)**, `:2839` (`grantSpaceBonuses` — `MultiSet` кратностей → `grantSpaceBonus(bonus, count, {spaceId})`;
карточный ресурс клетки — `AddResourcesToCard` с `boardPayout`), `:2400–2412` (fan-out `onTilePlaced` под `withEffect(p, c, 'tile-placed')` + «unscoped-door
tripwire»), `IGame.ts:66` (`CellBonusPaid`); **маркеры** — `MarsBoard.ts:472–481` (`getNonReservedLandSpaces`: LAND|COVE|DEFLECTION_ZONE, не Ноктис,
`tile === undefined || hazard`, `player === undefined` — предикат Land Claim), `Board.ts:297–301` (`getAvailableSpacesOnLand` — чужой маркер исключён),
`base/LandClaim.ts:46–56`, `promo/MarsNomads.ts:144` (чужой маркер — не ходит), `common/inputs/PlacementIllegalReason.ts:28,45,98,115` (`owned-by-other` /
`already-marked` «This area is already a community»), `Board.ts:427` (нейтральный куб — ДРУГОЕ: Martian Nature Wonders), `TileType.ts:152`; **превью клетки** —
`ICard.ts:180–197` (`placementPreview(player, space, ctx)` — факты карты-ИСТОЧНИКА на клетку; `tilePlacedPreview` — read-only зеркало `onTilePlaced`, идёт по
ВСЕМ столам; билдеры `cards/placementPreviews.ts:36–260` — `gain`, `cardResourceGain`, `upcomingChoice`, `tileRule`, `noEffectHere`), `boards/PlacementPreviewContext.ts:40–110`
(`stacking` / `placesTile` / `grantsPlacementBonus` / `firesTileTriggers` / `removesTile` — здесь встанет множитель), **`BoardInformationEngine.ts:282–292`**
(порядок фактов: бонус клетки → `arcadianCommunityFact:1649–1667` (id `arcadian-community`, title «Your community area» — ПЕРЕИМЕНОВАТЬ) → `tileTriggerFacts:1613`),
`:1357–1358` (`grantsPlacementBonus` по `placementEffect`), `common/boards/BoardInformationFacts.ts:148–156` (**`spaces?: SpaceId[]` — клетки, делающие факт
истинным; консоль их светит: `ConsoleBoardSection.vue:1468` `relationsFromPreview`**), `:179–194` (`tableAnswer` — «Сработает»), `boardInfoState.ts:120–150`
(параметры превью: `tile`, `card`, `effect`, `staged`, `movedFrom` — множитель едет рядом), `console/placementDossier.ts:1–50` (досье: IDENTITY + секции по намерению);
**сцена посадки** — `console/tilePlacement/consoleTilePlacement.ts:940–985` (полёт тайла → `holdCubeForHeroPlacement` → `paintRealTile` → `disposeTileProxy` →
`dropCubeForHeroPlacement` — «тайл садится, потом куб»), `:1084–1110` (второй вход), `consoleRemotePlacement.ts:513–552, :1208` (чужая посадка), **`board/cubeDropState.ts:100–147`**
(`observeCube`: куб БЕЗ тайла падает СРАЗУ — шесть кубов Ferrus упадут одним кадром до/во время полёта города — это и чиним), `:195–238` (`shouldHoldForOwnerCubePlacement` /
`applyOwnerCubePlacementPreview` / `ownerCubeHoldDurationMs` — маркер-кадр холда для `App.vue:777`), `:150–195` (`hold/drop/restCubeForHeroPlacement`, safety 10 с),
`board/markerPlacementAnimation.ts:1–60` (оверлей-маркеры: baseline-карта, active-карта, `arePlacementAnimationsArmed`, холд = полная анимация, «модалка никогда не
открывается поверх своего объяснения»), `console/tilePlacement/adjacencyPayoutBeat.ts`, `cityDataPayoutBeat.ts` (выплата бонуса клетки — монеты с печатных иконок; ×2 — здесь),
`tilePlacementDirector.ts`; **первое действие** — `Player.ts:314, :2040, :3049–3111` (`pendingInitialActions`, `markStartGamePrompt({kind:'corporationInitialAction'})`),
`console/startFirstAction.ts` (стадия: `corporationInitialAction` + `/api/corp-first-action-preview`), `console/boardExcursion.ts` (выход на поле из workspace старта),
`components/console/ConsoleCorpFirstActionConfirm.vue` (только mid-game shape), e2e `tests/e2e/console-corp-first-action.spec.ts` (Tharsis: стадия → посадка → барьер);
**вопрос после посадки** — `inputs/OrOptions.ts:11–36` (`setDisabledOptions(DisabledOptionModel[])` — вариант ВИДЕН отключённым с причиной), `deferredActions/AddResourcesToCard.ts`
(`autoSelect: false`, `cause`, `getCards` — держатели данных), `pathfinders/GeologicalExpedition.ts:51–80` (`onTilePlaced` → `OrOptions` с `SelectOption` — образец выбора
после посадки), `promo/StJosephOfCupertinoMission.ts:135–160` (маркер-посадка с вопросом), память `variant-choice-outcome-tiles` (ПЛИТКА-ИСХОД вариантного выбора),
`prompt-modal-family`, `played-target-step` (`ConsolePlayedTargetStep.vue` — шаг цели «КУДА: [data] 3»), `consoleTaskRouter.ts` (`taskFor` — новый маркер ОБЯЗАН
попасть, иначе `unknown` = застрявший промпт — гоча TR77 ①); **держатели данных в скоупе** — `resourceType: CardResource.DATA`: 47 файлов, в Redux —
`AquaticResearchStation`, `Arboretum`, `BiologicalSimulations`, `EcologicalExperiment`, `HabitatScience`, `InfluentialDiscovery`, `MartianCensus`, `MartianFiber`,
`PoliticalScience`, … (владелец: «карт с данными от Redux достаточно»); **лицо** — `render/CardRenderer.ts:437` (`community()` — куб игрока, тот же 3D-маркер поля:
`premiumCardIcons.ts:37, :520`), `:564` (`emptyTile`), `:394` (`resource(DATA, 3)`), `:213` (`cards(1)`), `:610` (`or`), `:322` (`city`), `:614` (`asterix`); Land Claim
рисует `b.community().emptyTile()` (:30) — два значка рядом; **реестр** — `common/cards/turmoilReduxCorporations.ts:34` (строка Ferrus — добавить `authored`), гард
`tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts:63–111`; **финал/инсайты** — `endgame/insightEngine.ts:2825–2840` (`arcadianMarkers` / `arcadianBuilds` /
`arcadianMc` — статы Arcadian), `endgame/corporationStories.ts:36, :132` (архетип `cityEngine`); **MarsBot** — `automa/corps/AutomaCorporations.ts`
(`buildOnOwnMarkerPays` — бот C18 Arcadian; двойника Ferrus НЕТ, бот ею не играет — решение владельца 5), `automa/AutomaMarkerPlacer.ts`; **гарды** —
`TurmoilReduxCardManifest.spec` (номер TR79 ↔ строка реестра), `deckComposition.spec`, `premiumScope.spec`, `devGuaranteedCards.spec`, `cardInformation`, `cardLore`
(TR79 EN+RU), `CardMetadata`, `effectCaption.spec` (≤ 52), `effectForecastParity` (`onTilePlaced` ↔ `tilePlacedPreview` — упадёт без зеркала), `cardIntakeSourceCoverage`
(новая точка добора), `crossPlayerCoverageGuard` (эффект — только себе → `none`), `boardInformation*.spec`, `placementDossier.spec`, `glowRestraintGuard` (храповик — рост
падает), `cursorGrammarGuard`, `glyphLiteralGuard`, `i18n.spec`, `e2eLiveness.spec`.

---

## Решения владельца (2026-10-26 — ПРИНЯТЫ, не обсуждаются; батч §8 — только то, что ниже помечено «решить»)
0. **40 M€.** На плашке 40, в тексте 45 — опечатка в тексте. Лицо, `startingMegaCredits`, RU-текст — 40; строка реестра: «scan text says 45 — plate 40 is right».
1. **«Double the placement bonus» = ТОЛЬКО печатный бонус клетки** (иконки на гексе: сталь/титан/растения/карты/тепло/…). Океанная прибавка 2 M€, Ares-соседи,
   партийные пассивы, бонус за снятие опасности — НЕ удваиваются. Город ставится по обычным правилам городов (`getAvailableSpacesForCity`).
2. **Кубы — только на ПУСТЫЕ незарезервированные клетки суши** вокруг города (предикат Land Claim `getNonReservedLandSpaces`, ОДИН на троих: не океанная, не Ноктис,
   без тайла, без чужого куба; опасность Ares наследуется от предиката — не новое правило). **При выборе клетки города игрок ВИДИТ силуэты кубов на кольце** —
   где лягут, видно до нажатия. **После посадки города кубы садятся ПО ОДНОМУ** — физически, по кольцу, никогда одним кадром; премиум-подача.
3. **Данные: игрок сразу видит, что класть некуда** — вариант «3 данных» стоит ОТКЛЮЧЁННЫМ с причиной «нет карты, принимающей данные», никогда не исчезает
   (инварианты 2/4); при единственном держателе — посев «ЕДИНСТВЕННАЯ ЦЕЛЬ» (T14).
4. **Нейтральное имя маркера на ВСЕХ общих поверхностях** — источников куба теперь три (Land Claim, Arcadian, Ferrus). Глоссарий: EN **«marked area»** / RU
   **«отмеченный участок»** (коротко «участок»); куб — «куб игрока». Печатный текст Arcadian («community»/«поселение») — НЕ трогать (печать есть печать).
5. **Бот-Ferrus — вне скоупа.** Бот ею не играет; чужой куб для бота — «зарезервировано другим» (проверить, что автома-размещение читает `space.player`).
6. **Куб Ferrus и куб Arcadian — ОДНО состояние поля** (`space.player` без провенанса; физически неразличимы; оба текста — одно правило резервации). **Эффекты ОБЕИХ
   корпораций стреляют от одного тайла, и игрок ВИДИТ ОБА в правой панели при размещении** (Merger из Prelude 2, мультикорп кампании). Кубы Ferrus — «marked areas»
   для действия Arcadian (община расширяется от кампуса). Никакого поля «чей куб».

## Диагноз (подтверждён файл:строка на `07520464bb`; перепроверить на своём HEAD)
1. **Множителя печатного бонуса НЕТ.** `AddTileOptions` знает `stacking | moved | overOcean`; `grantSpaceBonuses` платит кратность `MultiSet` как есть; превью
   (`PlacementPreviewContext`) — флаги да/нет. Нужна ОДНА нить: **`AddTileOptions.printedBonusMultiplier?: number`** → `grantPlacementBonuses` → `grantSpaceBonuses(player,
   space, multiplier)` (кратность × множитель в ОДНОМ месте — `count * multiplier` в `forEachMultiplicity`; `cards` тоже ×2 → ОДНА пачка добора из 2 карт — закон «одно
   действие — один забор») → `CellBonusPaid.paid` несёт честные ×2 суммы → `publishTilePlacement` → язык тайлов/журнал/сцена выплаты (монеты с печатных иконок:
   КАЖДАЯ иконка платит дважды — решить в §8 п.1). Та же нить в превью: `PlacementPreviewContext.printedBonusMultiplier` (по умолчанию 1) → факты «ВЫ ПОЛУЧИТЕ» клетки
   печатают ×2 с пометкой источника («×2 · Ferrus Academy» — факт-источник `card-trigger` от `placementPreview` корпорации, а не молчаливая подмена чисел). Множитель едет
   от промпта: `SelectSpace` первого действия несёт `printedBonusMultiplier: 2` в СВОЕЙ модели (как `placementEffect` — `SelectSpace.ts:151–156`, nesting-safe), клиент
   отдаёт его параметром превью (`boardInfoState.ts:131+` — рядом с `effect`), сервер превью читает его в контекст. Бот (`botCoveredIconMegacredits`) множителя не видит —
   у бота Ferrus нет. Океан/Ares/партии — мимо множителя по построению (они не в `grantSpaceBonuses`).
2. **Первое действие — bespoke `initialAction`, не `firstAction: {city}`.** Декларативный `city` не умеет ни множителя, ни кубов. Co-located в `FerrusAcademy.ts`:
   `initialAction(player)` = `new PlaceCityTile(player, {title, sourceCard: FERRUS, …})`-класс, но с `createMarsSelectSpace` напрямую (как Arcadian): `placementType: 'city'`,
   `sourceCard`, `printedBonusMultiplier: 2`; `.andThen(space)`: `game.addCity(player, space, {printedBonusMultiplier: 2})` → **в том же синхронном блоке** кольцо:
   `board.getAdjacentSpaces(space).filter(isNonReservedLand)` (предикат ВЫНЕСТИ из `getNonReservedLandSpaces` в `MarsBoard.isNonReservedLand(space)` — один на Land Claim,
   Arcadian-reasoner и Ferrus) → `s.player = player` каждой; ОДНА строка журнала «${player} reserved ${n} areas around the city» с клетками (`LogHelper`, токены клеток —
   журнал-чипы); recorder — запись «markers placed» (стат нейтральный `markedAreas`, не `arcadianMarkers` — диагноз 6). `firstActionPreview` co-located: ветка «город» +
   шаг-заметка «печатный бонус клетки ×2» + «куб на каждую соседнюю свободную клетку» (число неизвестно до клетки — честно «до 6»). Reload между городом и кубами невозможен
   (один `andThen`). `pendingInitialActions` / `corporationInitialAction` / стадия старта — даром.
3. **Силуэты кубов при выборе клетки.** Факты клетки уже умеют называть клетки (`BoardFact.spaces`) и консоль их светит (`relationsFromPreview`). **Co-located
   `placementPreview(player, space, ctx)` Ferrus** (`ICard.ts:180`): факт id `marked-area-reserve`, category `card-trigger`, title «Reserved for you», `spaces` = ТОТ ЖЕ
   предикат на кольце (никогда параллельная выборка), `count` = N, источник — корпорация; только пока `sourceCard === FERRUS && printedBonusMultiplier` (первое действие).
   Консоль: НОВЫЙ класс связи в `relationsFromPreview` → на этих клетках **СИЛУЭТ куба игрока** (`PlayerCube` в цвете игрока, прозрачность ≈ 0.45, контур — материал,
   инвариант 15: НИКАКОГО ореола), стоит пока курсор на клетке, пересчитывается с каждой клеткой (превью уже per-cell), в двухфазном confirm остаётся. Досье: строка «Участки:
   N клеток зарезервированы за вами» (`placementDossier` секция «вы получите» или «правила поля» — решить в §8 п.2) + строки бонуса ×2. Ghost ТАЙЛА под курсором
   (`ConsoleBoardCursor.vue:49`) — как есть; силуэты — на СОСЕДЯХ, не на клетке курсора.
4. **Посадка кубов — шесть кубов падают ОДНИМ КАДРОМ до города.** `observeCube` (`cubeDropState.ts:122–130`): куб без тайла — «drop NOW» (сделано для Land Claim/Arcadian,
   где куб один и он — весь ответ). Для Ferrus ответ = город + N кубов: hero-посадка ведёт город (`consoleTilePlacement.ts:961–985`), а кольцо выпадет само в ту же секунду.
   Нужен **«САТЕЛЛИТНЫЙ» бит hero-посадки**: ДО покраски цветов (тот же синхронный блок, что `holdCubeForHeroPlacement` города) — `holdCubeForHeroPlacement(id)` на КАЖДУЮ
   клетку кольца, получившую цвет без тайла в этом ответе и соседнюю с посаженной (выборка — по диффу ответа, это и есть состояние поля; `eachFreshOwnerCube` — готовый
   обход); после `dropCubeForHeroPlacement` города и его контакта — кубы кольца **по одному**, по часовой от верхнего соседа, шаг ≈ 90 мс через `motionMs`, каждый —
   `dropCubeForHeroPlacement` (та же `pc-place` — куб ставят, не роняют с высоты); **холд регистрируется в реестре холдов** (`animation-hold-registry`) и отпускается
   контактом ПОСЛЕДНЕГО куба — барьер завершения старта (`start-first-action.md`) ждёт его, workspace старта не рисуется раньше; reduced motion — все в `rest` сразу после
   тайла. Чужая посадка (`consoleRemotePlacement.ts`) — тот же бит (сосед-Ferrus ставит кампус у тебя на глазах); App-путь (`App.vue:777`) — `shouldHoldForOwnerCubePlacement`
   уже считает кубы — не ломать. `cubeDropState` safety 10 с — сателлиты укладываются.
5. **«Построено на своём кубе» читается ОДИН раз и платит только Arcadian.** `Game.ts:2319` — `arcadianCommunityBonus` = чтение + получатель в одном выражении. Разделить:
   **`const builtOnOwnMarker = !stacking && space.player === player && space.tile === undefined`** (чистое чтение состояния) → `arcadianCommunityBonus = builtOnOwnMarker &&
   (tableau.has(ARCADIAN) || бот C18)` (как сегодня, движок — бот делит выплату) → **НОВЫЙ co-located хук `ICard.onOwnMarkerBuilt?(player, space)`**, fan-out по `player.tableau`
   в Part 5 после бонусов (там, где defer Arcadian) под `events.withEffect(player, card, 'own-marker-built')`, `builtOnOwnMarker` передаётся явно (после `simpleAddTile` его уже
   не прочесть). Ferrus реализует хук: `game.defer(OrOptions)` — `[3 данных на любую карту]` = `AddResourcesToCard(player, DATA, {count: 3, autoSelect: false, cause:
   {kind:'corporation', card: FERRUS}})`, `[Взять карту]` = `drawCard(1)` под корнем действия (пачка — закон одного забора); без держателей данных — `setDisabledOptions([{…reason:
   'No card can hold data'}])` и вариант «карта» единственный ВКЛЮЧЁННЫЙ (всё равно показан — `OrOptions.reduce()` исключение инварианта 3 допустимо: одна ветка OR). Маркер
   промпта — `choiceContext {source: corporation FERRUS, mode: …}` (структурный; `taskFor` → вариантный выбор плитками-исходами → шаг цели `ConsolePlayedTargetStep`). Зеркало —
   **`tilePlacedPreview`** Ferrus (`ICard.ts:186`): факт `tableAnswer` «Сработает: Ferrus Academy — 3 данных или карта» при `ctx.placesTile && !stacking && space.player === player`
   (превью читает клетку ДО посадки — маркер ещё виден) — `effectForecastParity` требует пару. **Arcadian рядом**: `arcadianCommunityFact` → семья `markedAreaFacts` (id
   `marked-area-*`, title «Your marked area»): строка Arcadian (+3 M€) и строка Ferrus (выбор) стоят ОБЕ — решение 6, e2e (б). Стекинг (этаж на городе) — не маркер, ничего.
6. **Имя маркера — арцадианское на общих поверхностях.** `'already-marked': 'This area is already a community'` (`PlacementIllegalReason.ts:115`, RU «Здесь уже стоит маркер общины»
   `ui.json:938`), `board_info.json:179` «Your community area» → «Ваша община», `insightEngine.ts:2828` статы `arcadian*`, `ui.json:717` «…place the community», токен `community` в
   `infoText.tokens` (Land Claim:28, Arcadian). Нейтрально (решение 4): `'already-marked'` → «This area already holds your marker» / «Здесь уже стоит ваш куб»; факт → «Your marked
   area» / «Ваш участок»; стат → `markedAreas` + `markedAreaBuilds` с ИСТОЧНИКОМ (инсайт Arcadian читает свой источник — текст его истории не меняется); токен `community` —
   иконка та же (куб игрока), подпись токена → «player cube» / «куб игрока». Ключи — НОВЫЕ английские (инвариант 9: RU чужих ключей не переписывать; старые ключи умирают
   вместе с текстами). Печатные тексты Arcadian/Land Claim — как есть.
7. **Хост вопроса эффекта — тот поток, что посадил тайл.** Эффект стреляет на ЛЮБУЮ посадку на свой куб: розыгрыш карты с городом/озеленением (staged play — клетка выбрана ДО
   оплаты), стандартный проект, конверсия растений, финальное озеленение, закон/колония. По закону workspace: вопрос — `owed-step` ТОГО workspace, который посадил (композер
   розыгрыша / стандартные проекты / конверсия), крошка `… › <Карта> › ДАННЫЕ`; у посадки без родителя (финальное озеленение, закон) — плашка семьи «вопрос стола» (CLAUDE.md
   § 1: «результат без естественного родителя»). **Pre-select (T14):** в staged-розыгрыше клетка известна до POST → `tilePlacedPreview`-факт даёт композеру вопрос стола
   (`asks` с ТЕМ ЖЕ промптом — один билдер в файле карты, как `reactionStep` Arwind): плитки «3 данных → [цель]» / «карта», посев единственной цели, ОДИН POST. Fallback —
   живой промпт в том же workspace. Слово стадии — **«ДАННЫЕ»** (объект, который кладут; для варианта «карта» — «КАРТА» через `FOLLOW_UP_STEP_STAGES`-класс по маркеру) — решить §8 п.3.
8. **Лицо.** Стартовая строка: `megacredits(40)` · коробка производства растений · `city().asterix()` · `text('6').community().asterix()`; `corpBox('effect')`: `[community][emptyTile]*
   : resource(DATA, 3)* OR cards(1)`. Скан рисует куб ВНУТРИ гекса — сначала `community().emptyTile()` как Land Claim (`reuse-existing-icons`); составной глиф «куб в гексе» —
   ТОЛЬКО если на 4K лицо читается как два объекта (кадр в батч §8 п.4). Нашивок/новых билдеров не заводить. Две коробки не нужны — одна `effect`.
9. **Текст (владелец: понятно, лаконично).** RU: «Вы начинаете с 40 M€ и 1 производством растений. Первым действием разместите город — печатный бонус его клетки удвоен. Затем
   положите свой куб на каждую соседнюю незарезервированную клетку: строить там можете только вы.» / «Эффект: когда вы кладёте тайл на клетку со своим кубом, положите 3
   данных на любую карту или возьмите карту.» Инфо-модель: `effect-short` «Tile on your marked area: 3 data or a card» (43), `tokens: ['community','data']`; первое действие —
   `{text, tokens: ['city','community']}`. Досье — печатный текст (`resolution-texts-card-dose`).
10. **Гочи TR77/TR78, которые ударят снова:** ① новый маркер промпта ОБЯЗАН попасть в `taskFor`; ② встроенная поверхность НЕ рисует свой заголовок; ③ посев в `App.update`
    получает частичные модели тестов — читать опционально; ④ `deckComposition.spec` — корпорация отдельно; ⑤ `effectForecastParity` падает на хук без зеркала; ⑥ добор
    картой-эффектом вне `src/server/cards` — объявить корень (`cardIntakeSourceCoverage`); ⑦ `glowRestraintGuard` — силуэт через `opacity`/`outline`, не `box-shadow`.

## Правила карты (спек `tests/cards/turmoilRedux/FerrusAcademy.spec.ts` пинит каждое)
1. Печатная: корпорация, **40 M€**, `production: {plants: 1}`, `tags: [Tag.SCIENCE, Tag.BUILDING]`, без ПО; `cardNumber 'TR79'`, арт TR79, лор TR79 (EN + RU), имя `'Ferrus Academy'`.
2. Первое действие: кандидаты = `getAvailableSpacesForCity` (правило соседства городов); посадка → печатный бонус ×2 (клетка «2 стали» → 4; «карта» → 2 карты ОДНОЙ пачкой;
   пустая клетка → ничего ×2 = ничего); океанная прибавка — ×1; Ares-сосед — ×1; `CellBonusPaid.paid` несёт ×2; затем куб на каждую соседнюю `isNonReservedLand` клетку
   (0…6): океанная / Ноктис / с тайлом / с чужим кубом — нет; журнал одной строкой; `space.player` сериализуется (round-trip).
3. Резервация: чужой тайл на клетку с кубом — `throw` (`addTile:2283`), в кандидатах не стоит (`getAvailableSpacesOnLand`), Mars Nomads не ходит, бот не ставит; свой тайл — можно.
4. Эффект: свой тайл на клетку со своим кубом → OrOptions [3 данных на любую карту | карта]; без держателя данных — вариант отключён с причиной, «карта» доступна; с держателем —
   `AddResourcesToCard` спрашивает (NO AUTO-SELECT); город-этаж (стекинг) — нет; чужой тайл — не бывает; куб, поставленный Land Claim или Arcadian — ТОЖЕ стреляет (решение 6);
   Arcadian + Ferrus на одном игроке — +3 M€ И выбор от одного тайла; хук под `withEffect` (журнал — чип корпорации; соперникам — `none`).
5. Превью: клетка города при первом действии — факты ×2 с источником + факт `spaces` кольца с N; клетка с кубом при любой посадке — `tableAnswer` Ferrus (+ строка Arcadian,
   если есть); `effectForecastParity` зелёный; чистота (`BoardInformationEngine` purity-guard).
6. Save/load: куб — `space.player`; промпт эффекта — класс движка (один запрос); классический стол Turmoil — Ferrus не раздаётся; Redux — в раздаче.

## 0. Рабочее дерево
1. `git log --oneline -1` → `07520464bb`; `ListAgents` и `git status` перед каждой серией коммитов — сосед держит `ConsoleActionComposer.vue` (твой pre-select — ПОСЛЕ его коммита или
   ханками через временный индекс), `ConsoleDeckDrawLayer.vue`, `intakeAssemblyDirector.ts`. Твои файлы — `turmoilRedux/FerrusAcademy.ts` + спек, `CardName.ts`, манифест
   (`corporationCards`), `turmoilReduxCorporations.ts` (`authored`), `IGame.ts` / `Game.ts` (множитель, `builtOnOwnMarker`, хук), `ICard.ts` (`onOwnMarkerBuilt`), `MarsBoard.ts`
   (`isNonReservedLand`), `PlacementPreviewContext.ts` / `BoardInformationEngine.ts` (множитель, `markedAreaFacts`), `SelectSpace.ts` + `PlayerInputModel.ts` (`printedBonusMultiplier`),
   `PlacementIllegalReason.ts`, `LandClaim.ts` / `ArcadianCommunities.ts` (общий предикат, нейтральные ключи), клиент: `boardInfoState.ts`, `ConsoleBoardSection.vue`
   (`relationsFromPreview` → силуэты), `placementDossier.ts`, `cubeDropState.ts` + `consoleTilePlacement.ts` + `consoleRemotePlacement.ts` (сателлитный бит), `consoleTaskRouter.ts`,
   `insightEngine.ts`, `ru/{turmoil_redux_cards,card_info,board_info,ui,log_messages,zz_corporation_names,lore_texts}.json`, e2e + фикстуры, доки, `assets/card-images/TR79.webp`.
   Коммиты — ПО ХАНКАМ / явными путями; после коммита `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot ferrus` → `npm run e2e:remote -- ferrus <spec> --exclusive --workers=1`; exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — ТРИ инфраструктуры сквозным контрактом, потом карта (≈ 35 % + 10 %)
1. **Множитель печатного бонуса** (`AddTileOptions` → `grantPlacementBonuses` → `grantSpaceBonuses` → `CellBonusPaid` → `publishTilePlacement`; `SelectSpace` → модель → параметр
   превью → `PlacementPreviewContext` → факты ×2 с источником) → спек `tests/boards/PrintedBonusMultiplier.spec.ts` (сталь ×2 · карты ×2 одной пачкой · океан ×1 · Ares ×1 ·
   стекинг — нет · запись `paid` · превью = посадка).
2. **«Построено на своём кубе»** — `builtOnOwnMarker` одно чтение + хук `onOwnMarkerBuilt` (fan-out, `withEffect`, явный флаг) + `isNonReservedLand` (Land Claim / Arcadian-reasoner /
   Ferrus на одном предикате) + `markedAreaFacts` (Arcadian-строка переименована, Ferrus-строка новая) → спек `tests/boards/OwnMarkerBuilt.spec.ts` (Arcadian платит как раньше ·
   бот C18 как раньше · хук зовётся при кубе любого источника · стекинг — нет · чужой тайл — throw · превью называет оба).
3. **Нейтральное имя** — ключи/RU по диагнозу 6, статы инсайтов с источником; `i18n.spec`, `placementDossier.spec`, `insightEngine.spec` зелёные.
4. **Карта** `FerrusAcademy.ts` (шапка SCAN READING / RULE READINGS с опечаткой 45→40; `behavior {production: {plants: 1}}`; `initialAction` bespoke + `firstActionPreview`;
   `placementPreview` (кольцо `spaces`, ×2-источник); `onOwnMarkerBuilt` + `tilePlacedPreview` (ОДИН билдер промпта на живой хук и прогноз); `infoText`; лицо §8 диагноза; спек
   (правила 1–6); манифест; реестр `authored`; RU; лор; арт TR79).

## 2. Консоль (≈ 45 %) — ГЛАВНОЕ: первое действие как одна физическая сцена
1. **Силуэты** — `relationsFromPreview`: класс `reserve` → `PlayerCube`-силуэт на клетках факта (цвет игрока, прозрачность, контур — без свечения), живёт с курсором, остаётся во
   второй фазе confirm; досье: строка участков + бонус ×2 с источником; «ДАЛЕЕ» стадии старта называет «город · бонус ×2 · кубы вокруг».
2. **Сателлитный бит** посадки (диагноз 4): холд кольца до контакта города → кубы по одному по часовой → холд реестра отпускается последним контактом → барьер старта → workspace
   старта возвращается РОВНО один раз (как `console-corp-first-action`); чужая посадка — тот же бит; reduced motion — без очереди.
3. **Вопрос эффекта** — `taskFor` по `choiceContext.source` корпорации → плитки-исходы «3 данных → …» / «карта» (отключённая плитка с причиной — ВИДНА), шаг цели
   `ConsolePlayedTargetStep` embedded, крошка `<workspace> › <Карта> › ДАННЫЕ`, `owed-step` родителя; без родителя — плашка семьи вопроса стола; данные летят с печатного
   значка `[data]` строки эффекта Ferrus в счётчик цели (закон причинности; ⚠ `cardReactionStage` TR78 НЕ был построен — общий примитив подъёма сработавшей карты выдан промтом `redux-corp-hartlan-heating.md`, 2026-10-26), карта — пачка одного действия (сцена сборки CM).
4. **Pre-select** в staged-розыгрыше (диагноз 7): факт `tilePlacedPreview` → вопрос стола композера → ОДИН POST; fallback — живой промпт в том же workspace.
Спеки: `boardInfoState.spec` (параметр множителя), `placementDossier.spec` (строки), `relationsFromPreview`/`ConsoleBoardSection.spec` (класс `reserve`), `cubeDropState.spec`
(сателлиты: порядок, холд, reduced), `consoleTaskRouter.spec` (`taskFor`), `composerPlay.spec` (вопрос стола), `glowRestraintGuard` (нулевой рост), `cursorGrammarGuard`.

## 3. Тесты и регрессия (≈ 10 %)
Стенд §8 п.5; гарды из шапки; регрессия (1–2 повтора на боксе): `console-corp-first-action`, `console-first-action-draw`, `console-bonus-nested-first-action`, `start-scene-profiles`,
`console-tile-*` / `console-placement-*` (язык тайлов, досье, ретикл), `console-arcadian*` / `console-land-claim*` (если есть — `ls tests/e2e | grep -i "arcad\|claim\|marker"`),
`console-bot-corp-markers`, `console-composer-preselect`, `tv-profile-screens`; `npm run e2e:affected`; хуки — тем же диффом (инвариант 14); `npm run build:test`.

## 4. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd)
`screenshots/ferrus/{tv,fhd}/`: лицо с артом TR79 (40 M€, «6 [куб]*», строка эффекта); стадия ПЕРВОЕ ДЕЙСТВИЕ с «ДАЛЕЕ»; поле: курсор на клетке — силуэты на кольце, досье с
×2 и «N участков», вторая фаза confirm с силуэтами; посадка: город сел → куб города → кубы кольца 1-2-3… (три кадра очереди) → workspace старта вернулся один раз; позже:
клетка с кубом под курсором — «Сработает: Ferrus — 3 данных или карта» (+ строка Arcadian в мультикорп-фикстуре); плитки выбора с отключённой «3 данных» и причиной; полёт данных
с печатного значка на цель. С дивана: «я увидел, куда лягут кубы, ДО того как нажал; город сел, кубы легли по одному, как рукой; потом, строя на своём участке, я сразу увидел,
что данные класть некуда — и взял карту».

## 5. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer (следующий PL-1038).
2. Доки: новый `docs/TURMOIL_REDUX_FERRUS_ACADEMY.md` (множитель бонуса — одна нить; «построено на своём кубе» — одно чтение, один хук, два получателя; предикат маркера — один
   на троих; сателлитный бит; нейтральный глоссарий маркера); `docs/claude/board-information.md` — факт `spaces` как силуэты + множитель в контексте; `start-first-action.md` —
   барьер ждёт сателлиты; `turmoil-redux-card-checklist.md` §0 — абзац «корпорация с первым действием-посадкой: множитель/кольцо»; `parliament-glossary.md` не трогать (не
   Парламент); память.

## 6. Режим работы
1. Читать до кода; §1.1 множитель (спек) → §1.2 хук + предикат (спек) → §1.3 имя → §1.4 карта → §2.1 силуэты (макет на живом 4K: кольцо из 6 / из 2 у края — кадры в батч) →
   §2.2 сателлиты (TIMING-кадры) → §2.3 вопрос → §2.4 pre-select → стенд → регрессия → раскадровки → доки. Коммит по ханкам на каждом шаге.
2. Отчёт: первой строкой — лицо с артом; затем кадры (силуэты, очередь кубов, «оба сработают», отключённая плитка), результат гардов/регрессии, решения §8 с тем, что сделано по
   умолчанию, ОДИН `AskUserQuestion` (п.1, 2, 3, 4 с кадрами), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Второй предикат «незарезервированная клетка»; поле «чей куб» / провенанс маркера; эффект Ferrus, молчащий на куб Land Claim/Arcadian; выплата Arcadian мимо движка (бот C18 делит её);
  хук мимо `withEffect`; auto-select держателя данных на сервере; скрытый (а не отключённый) вариант «3 данных»; детекция промпта по заголовку; множитель, задетый океаном/Ares/партиями;
  ×2 в числах превью без источника; силуэт через `box-shadow`/ореол/дыхание (инвариант 15); кубы кольца, появившиеся одним кадром или ДО посадки города; `setTimeout` вместо холда
  реестра; workspace старта, нарисованный до последнего куба; вопрос эффекта отдельной модалкой поверх живого workspace; ключи «community» переписанные в RU (новые ключи, не правка
  чужих); текст длиннее скана; 45 M€ где бы то ни было.
- RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.

## 8. Батч решений владельцу (по умолчанию — как написано; подтвердить в отчёте ОДНИМ `AskUserQuestion`)
1. **Сцена выплаты ×2** — (а, рекомендовано) КАЖДАЯ печатная иконка клетки платит ДВАЖДЫ: два жетона с одной иконки, счётчик тикает на каждом касании (физично, как две монеты
   в руку); (б) один жетон с бейджем «×2» — нет (не видно удвоения как события).
2. **Где в досье строка участков** — (а, рекомендовано) секция «ВЫ ПОЛУЧИТЕ» с иконкой куба и числом («Участки · 4 клетки — только вы строите здесь»); (б) «правила поля» — нет (это
   приобретение, не ограничение).
3. **Слово стадии вопроса** — (а, рекомендовано) «ДАННЫЕ» для шага цели, плитки выбора — без своего слова (стадия родителя); (б) «ВЫБОР» — нет (не говорит, что кладут).
4. **Глиф эффекта** — (а, рекомендовано) `[куб][пустой гекс]` как Land Claim; (б) составной «куб в гексе» — только если кадр 4K читается как два объекта.
5. **e2e** — `tests/e2e/console-ferrus-academy.spec.ts` (tv4k + fhd; сателлиты — эксклюзив): (а) `ferrus-first-action` (соло, `customCorporationsList: [FERRUS]`, Redux): стадия →
   поле → силуэты на кольце (число = факт `spaces`) → досье ×2 → A → город → кубы по одному → один возврат workspace; (б) `ferrus-build-on-marker` (кубы посеяны, держатель данных
   в столе): посадка озеленения на участок → панель «Сработает» → плитки → цель → полёт данных; (в) `ferrus-no-data-holder`: плитка «3 данных» отключена с причиной, «карта» →
   пачка; (г) `ferrus-with-arcadian` (Merger/мультикорп — `assignPinnedCorporations` двумя; если фикстура не даётся — unit-спек пинит, e2e по одной): панель называет ОБА, от
   одного тайла +3 M€ И выбор; (д) reload посреди (б) — вопрос стоит; (е) reduced motion — те же числа; (ж) `glowRestraintGuard` — нулевой рост. Фикстуры в
   `tests/e2e/fixtures/generate.ts` по образцам `soloGameConfig:1804`, `assignPinnedCorporations:1201`.
6. **Объём** — сервер (множитель + хук/предикат + имя) ≈ 35 %, карта + лицо + тексты ≈ 10 %, консоль (силуэты, сателлиты, вопрос, pre-select) ≈ 45 %, стенд/доки ≈ 10 %; без полировки.
