# Промт исполнителю · P74 Frontier Town («Пограничный город») — ЧЕТЫРНАДЦАТАЯ карта Prelude 2, девятая ПОЛИТИЧЕСКАЯ и ПЕРВЫЙ ГОРОД серии с УМНОЖЕННЫМ печатным бонусом (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 3 + 5 — BESPOKE-РАЗМЕЩЕНИЕ + ПОЛИТИЧЕСКАЯ): зелёная (автоматическая), 11 M€, метки Город + Строительство; требование партии Марса Вперёд («у власти или 2 ваших делегата на его резолюциях»); «−1 произв. энергии; разместите тайл города и получите его печатный бонус размещения ЕЩЁ 2 РАЗА» — `bespokePlay`: `PlaceCityTile` с энерго-фильтром и тройной стоимостью клеток (`bonusMultiplier: 3`), затем в `andThen` ДВАЖДЫ `grantSpaceBonuses` руками МИМО единого механизма множителя, который форк уже построил (TR79 Ferrus Academy: `AddTileOptions.printedBonusMultiplier` → маркер промпта `SelectSpaceModel.printedBonusMultiplier` → досье клетки → запись `tilePlacements` → волна посадки). FAQ владельца (кадр): **«Frontier Town при действующем Development Craze — бонус размещения ШЕСТЬ раз: удвоенный бонус получаете 3 раза»** — а закон RX10 (`DevelopmentCraze.repeatPlacementBonuses`) повторяет печатный бонус ВСЕГДА ×1 (сейчас P74 + Craze = 4, Ferrus + Craze = 3) · РАБОТА КАРТЫ (≈ 30 %): маркер, текст в голосе Redux, множитель через общий механизм, staged-розыгрыш по форме Urbanized Area, композиция закона (правило FAQ), лор, арт, спек · ПОЛИРОВКА (≈ 70 %) — область ИГРОВОГО ПОЛЯ: «НАГРАДА КЛЕТКИ — НА САМОЙ КЛЕТКЕ, СО СВОИМ МНОЖИТЕЛЕМ»: при умноженном размещении поле сейчас молчит — множитель знает только досье справа; на клетках-кандидатах печатный бонус выглядит как обычный, посадка платит «как обычно», а закон добавляет вторую волну без связи с первой

> **Статус: ВЫДАН 2026-10-31.** HEAD `572c9acb1d` (P82 СДАНА — раздел **DB**; P73 — карта `26b5b1cce1` в main, ПОЛИРОВКА НАСТРОЙКИ ДЕЙСТВИЯ ДОДЕЛЫВАЕТСЯ соседом; ворклист **13 / 54**;
> журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись ЧЕТЫРНАДЦАТАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты (композиция поля — тоже, §4);
> `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> **СОСЕДИ** (`ListAgents` в момент выдачи: `terraforming-mars-7a` — свободен, `-19` и `-4d` — заняты). Грязное у соседа P73: `tests/e2e/{consoleStart,consoleTest}.ts`,
> **`tests/e2e/fixtures/generate.ts`**, `tests/e2e/console-floating-refinery.spec.ts` + его фикстуры; композер действия (`ConsoleActionComposer.vue`, блоки композера в `console.less`) — его область.
> ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`; `SendMessage` всем занятым со списком твоих файлов (§0) — особенно `Game.ts`, `DevelopmentCraze.ts`, `BoardInformationEngine.ts`, `BoardSpace.vue`,
> `ConsoleBoardInput.vue`, `ConsoleShell.vue`, слой посадки (`tilePlacement/**`), `generate.ts` (свой объявленный ханк). `package.json` / `package-lock.json` (`MM`) — не твои.
> Промты-образцы: `prelude2-p85-summit-logistics.md` (политическое требование под Redux, стенд `-locked`), `prelude2-p82-special-permit.md` (текст в голосе Redux новым ключом при битом RU апстрима),
> **`turmoilRedux/FerrusAcademy.ts`** (ЕДИНСТВЕННЫЙ потребитель множителя — его шапка `:40–60` описывает «ONE thread from the commit to the tile language's record»), **`base/UrbanizedArea.ts`**
> (ТОЧНЫЙ образец розыгрыша: bespoke-город + `LoseProduction` в `andThen` + `cardPlayPreview` → `placementPreview({staged})` + хук `placementPreview` с фактом «−1 произв. энергии» на клетке),
> `docs/TURMOIL_REDUX_DEVELOPMENT_CRAZE.md` (закон RX10 — пассив «удвоить бонусы размещения и соседства»), `docs/claude/console/board-placement-flow.md` (§ THE TILE LANGUAGE W1–W7, § STAGED,
> досье), `docs/TILE_PLAY_STAGED_COMMIT.md`.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P74.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P74 - Frontier Town.png`.
> Лор — СО СКАНА, дословно: «Claiming the sweet spot» (без точки — добавить; гард лора).
> Реестр: последний раздел в footer — **DB** (P82), P73 возьмёт следующий (ожидаемо **DC**) → тебе ожидаемо **DD**; последний номер **PL-1218** — номера по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p74` → `npm run e2e:remote -- p74 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL (порядок —
> запись `MutationObserver` + `setInterval`); полировка поля — fhd + tv4k (+ deck для пометки клетки); раскадровка — TV (`TM_E2E_STORYBOARD=1`).
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 3 и п. 5**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76…P73 — не переоткрывать: эмблема партии + «N/2» в причине руки (P85), свежий
Redux-стол = Зелёные у власти, стол другой партии — `seatEnacted(quietResolutionOf(<партия>))` (P75 PL-1162), «Сработает» каскадирует ответы партии (P75), подъём только сработавшей карты (P82 · DB)),
`docs/claude/turmoil-redux-card-checklist.md` §0 («карта, ставящая тайл» — `placesTile: true`, Hartlan Heating TR80 отвечает на неё), §3, §7, **`.claude/rules/board.md`**, **`.claude/rules/console-ui.md`**
§ BOARD PLACEMENT IS TWO-PHASE (сетка, ретикл, проекция; «the ghost is masked under the measured bonus cluster — the reward is always foreground»), § THE STAGED BOARD SPEAKS THE PLAY («a cell names
the WHOLE gain»), § THE TILE LANGUAGE (W1–W7: «what a landing pays is ONE wave», «a law's wave … stays a second statement»), § THE PLACEMENT PANEL IS A DOSSIER (законы 1–4, «a non-event costs one word»),
§ ПРОСВЕТ СНИМАЕМОГО ТАЙЛА (атрибут, а не класс, на ячейке — `data-peek`; «a change of the `:class` binding rewrites `className` whole»), § VISUAL RESTRAINT, § STATE DELIVERY (правда раньше истории),
`.claude/rules/animations.md` (холды, одна система движения), `docs/claude/console/card-reaction.md` итерация 4 («ЗАКОН — РЕАКТОР»: волна закона поднимает его лицо). Память: `rules-first` (FAQ — правило),
`upstream-spec-encodes-upstream-rules`, `board-space-class-binding-wipes-imperative`, `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `trivial-card-prompts-no-owner-questions`, `visual-restraint-no-glow`, `prelude2-adaptation`.

**Образцы — по частям.** Карта: `prelude2/FrontierTown.ts` (AUTOMATED, 11, `[CITY, BUILDING]`, `placesTile: true`, `requirements: {party: MARS}`; `productionBox` −1 энергии; `availableSpaces` —
`getAvailableSpacesForCity(player, {cost, bonusMultiplier: 3})` (стоимость платных клеток ×3 — апстрим, спек «Manages triple placement costs»); `bespokeCanPlay` — клетки ∧ `MarsBoard.hasEnergyCoverage`;
**`bespokePlay` — `PlaceCityTile(player, {spaces})` → `andThen`: `LoseProduction(ENERGY 1)` + ДВА `grantSpaceBonuses(player, space)` руками**; рендер `production(−energy 1).city().asterix()` —
звёздочка ПЕЧАТНАЯ (сноска «бонус ещё 2 раза»); `description` классики; RU — `ru/prelude_cards.json:2–3` (имя «Пограничный город»; описание с опечаткой «правищей» и классическим «в ней» — НЕ
ПРАВИТЬ, ключ уйдёт)), манифест `Prelude2CardManifest.ts:74` (`compatibility: 'turmoil'` без `politics`), голос Redux требования Марса Вперёд — `ru/turmoil_cards.json` («Требует, чтобы «Марс вперёд» был
у власти или у вас было 2 делегата на его резолюции…» — grep строку `Mars First is ruling`). Механизм множителя: **`Game.ts:2372`** (`addTile` → `grantPlacementBonuses(…, options?.printedBonusMultiplier)`),
`:2492–2515` (`grantPlacementBonuses` — печатный ×N, соседство океанов ×1, бот — M€ за значки), **`:2905–2920`** (`grantSpaceBonuses(player, space, multiplier)` — «THE ONE PLACE the multiplier applies»),
`:154–160` (`OFFERED_ONCE_SPACE_BONUSES` — платный бонус предлагается раз на каждый множитель), `:2781` (запись `tilePlacements`), `IGame.ts:131` (`AddTileOptions.printedBonusMultiplier`),
**`boards/marsSelectSpaceHelper.ts:114–158`** (маркер промпта), `boards/PlacementPreviewContext.ts:87–92`, **`BoardInformationEngine.ts:202–253`** (`printedBonusFacts(space, covered, multiplier)` — досье
читает ×N), `common/models/PlayerInputModel.ts:1428–1431` (`SelectSpaceModel.printedBonusMultiplier`), клиент — `ConsoleBoardInput.vue:361 / :547`, `ConsoleShell.vue:14596`, `board/boardInfoState.ts:89–156`
(параметр `bonus` в запросе досье), **`deferredActions/PlaceCityTile.ts:16–57`** (опций множителя НЕТ). Staged-розыгрыш: `actionPreviews.ts:~1480–1540` (`placementPreview({staged: {spaces, placementType,
reasoner}})` → `stagedMarsSelectSpace` — множителя НЕТ), `tests/boards/stagedPlacementParity.spec.ts` (паритет staged ↔ live). Закон: **`parliament/resolutions/marsFirst/DevelopmentCraze.ts:100–150`**
(`repeatPlacementBonuses(player, space, placement)` — печатный: `game.grantSpaceBonuses(player, space)` ×1 ВСЕГДА; океан — ещё раз; Ares — ещё раз; эхо `PlacementLawPayoutModel`), `:179–200` (хук
`onTilePlaced` + факты досье для закона), `ParliamentHandler.onTilePlaced(player, space, placement: TilePlacementBonusContext)` `:312`, `common/models/PlacementLawPayoutModel.ts`; фикстура закона —
`parliament-craze-enacted` (`generate.ts`), стенды `console-parliament-craze.spec.ts`, Ferrus — `console-ferrus-academy.spec.ts` (найти grep), кадры `screenshots/ferrus/tv4k/`, `screenshots/parliament-craze/standard-1080/`.
Поле: `src/client/components/BoardSpace.vue` (`<bonus :bonus="space.bonus" v-if="showBonus">` `:28`; просвет `:389–410`), компонент `Bonus`, `ConsoleBoardCursor` (ретикл, проекция), слой отношений
`tilePlacement/placementRelations.ts`, волна посадки `runRewardWave` / `REWARD_WAVE_STAGGER_MS` (`tilePlacement/**` — grep), волна закона `runLawWave` / `lawWaveSpecsOf`, досье `placementDossier.ts`
(`buildDossierRows`, `compactTitleKey`).

---

## Диагноз (подтверждён файл:строка на `572c9acb1d`; перепроверить на своём HEAD)

### Карта
1. **Правила апстрима верны (×3 печатного, океан ×1, стоимость платной клетки ×3), но МИМО механизма форка.** `bespokePlay` платит бонус дважды ПОСЛЕ `addTile`: (а) промпт не несёт
   `printedBonusMultiplier` → досье под курсором обещает ×1 (закон § STAGED BOARD — «a cell names the WHOLE gain» — нарушен на каждой клетке); (б) запись `tilePlacements` знает только первую выплату →
   волна посадки летит ×1, а ещё две выплаты приходят позже отдельными тиками рельса без причины на экране; (в) журнал — три отдельные строки; (г) платный бонус (океан Эллады) предлагается в трёх
   разных местах цепочки, а не «раз на множитель» одним механизмом (`OFFERED_ONCE_SPACE_BONUSES`); (д) закон RX10 срабатывает ВНУТРИ `addTile` ДО двух ручных выплат — порядок истории ломается.
2. **Закон RX10 не знает множителя размещения.** `repeatPlacementBonuses` повторяет печатный бонус ×1; FAQ — «удвоенный бонус получаете 3 раза» = ×6; та же ошибка у Ferrus (×2 + закон = 3, должно 4).
   Соседство океанов — закон удваивает ×1 → ×2 (не умножается на 3 — апстрим «Does not apply to oceans», «2, not 6»).
3. **Staged-розыгрыш.** Зелёная карта с тайлом — ВСЕГДА staged (память CN): нужен `cardPlayPreview` по форме Urbanized Area (те же клетки, та же причина клетки, факт «−1 произв. энергии» на клетке);
   staged-модель множителя не несёт → досье staged-поля тоже ×1 (класс, решение 3).
4. **Чтение скана (§0):** «11» — цена; плашка — эмблема Марса Вперёд (требование); метки — Город, Строительство; зелёная (автоматическая); ряд — «[−энергия] в рамке производства» и «[город]*»;
   текст «(Requires that Mars First is ruling or that you have 2 delegates there. Decrease your energy production 1 step. Place a city tile. GAIN THE PRINTED PLACEMENT BONUS 2 ADDITIONAL TIMES.)»; «P74»;
   слева внизу — Prelude 2 · Turmoil; лор — курсив.
5. **Что даром (проверить «до»):** требование Марса Вперёд под Redux — эмблема + «N/2» (P85 · CR); причина руки при произв. энергии 0 — НАЗВАНА (не голое «нельзя» — проверить `unplayableReasons`
   для энерго-покрытия); причина клетки (энергия, стоимость ×3); Hartlan Heating (TR80) отвечает на `placesTile`; «Сработает» — реакторы на Город / Строительство; рост городской метки на рельсе; тайл-язык
   посадки (W1–W7); MarsBot-стол с `prelude2Expansion` БРОСАЕТ → карта в руку без опции.
6. **Spec апстрима** (`tests/cards/prelude2/FrontierTown.spec.ts`): `canPlay` (энергия × партия), play (растения 3), «Does not apply to oceans» (M€ 2), «Manages triple placement costs» (Эллада). Всё — байт в байт.

### Поле (кадры `ferrus/tv4k/03-silhouettes-locked.png`, `parliament-craze/standard-1080/02-placement-echo.png`)
- **F1. Множитель знает только досье.** На поле клетка-кандидат с «2 [растения]» выглядит одинаково при ×1, ×2 (Ferrus), ×3 (P74), ×6 (P74 + закон) — сравнивать клетки игрок вынужден курсором по одной,
  читая правую колонку. Суть умноженного размещения — ВЫБОР клетки по её печатному бонусу — на поле не видна.
- **F2. Посадка платит «как обычно».** Волна посадки — по жетону за единицу из значка клетки; при ×3 / ×6 значок не говорит, что он платит несколько раз, а число жетонов растёт без формы (или упирается
  в потолок волны — проверить, где он и что говорит сверх потолка).
- **F3. Закон — вторая волна без связи с первой.** Волна закона (RX10, итерация 4 CN) поднимает лицо закона и летит «ещё раз» — правильно второе утверждение, но с ×1 печатного (диагноз 2) и без
  читаемой связи «закон удвоил ЭТУ выплату» (проверить кадр «до»).
- **F4. Журнал.** Три строки «получает растения» вместо одной «бонус клетки ×3».

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Зелёная, 11, Город + Строительство, без ПО; эмблема Марса Вперёд — требование; P74; `compatibility: 'turmoil'` + `politics: 'redux'`; оплата — M€ + сталь (Строительство).
2. Требование: Марс Вперёд у власти ИЛИ ≥ 2 своих делегата на резолюциях Марса Вперёд (фасад); произв. энергии ≥ 1 и хотя бы одна клетка города, которую игрок может оплатить с учётом стоимости ×3.
3. Розыгрыш → staged-клетка города (клетки = живой промпт: энерго-фильтр, стоимость ×3), ОДИН POST; город ставится, печатный бонус клетки — ×3 ОДНОЙ выплатой (`printedBonusMultiplier: 3`), соседство
   океанов — ×1, Ares-соседство — ×1, платный бонус клетки — предложен раз на каждый множитель (механизм `OFFERED_ONCE_SPACE_BONUSES`), затем −1 произв. энергии.
4. **Закон RX10 действует → печатный бонус ×6 (FAQ), соседство океанов ×2**; Ferrus (×2) + закон → ×4; обычный город + закон → ×2 (как сейчас); бот + закон — M€ за значки ×2 (D16, как сейчас).
5. Превью (read-only): чип «−1 произв. энергии», шаг staged-клетки с множителем; досье клетки — печатный бонус ×N (и ×2N при законе — строкой закона, как сейчас для удвоения); раздача — Redux + Prelude 2 —
   с маркером; save / reload посреди staged — как Urbanized Area.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU / текст** — имя «Пограничный город» оставить; НОВЫЙ EN-ключ описания `'Requires that Mars First is ruling or that you have 2 delegates there. Decrease your energy production 1 step. Place a city tile
   and gain its printed placement bonus 2 additional times.'`, RU — «Требует, чтобы «Марс вперёд» был у власти или у вас было 2 делегата на его резолюции. Уменьшите производство энергии на 1 шаг.
   Разместите тайл города и получите его печатный бонус размещения ещё 2 раза.» (термин «бонус размещения» — сверить с `ru/*.json`, взять существующий); лор RU — «Застолбить лучшее место.»; старый ключ с
   опечаткой не трогать (уходит из карты). Рендер — как есть (звёздочка печатная). Манифест — `politics: 'redux'`.
2. **Множитель — ОДИН механизм.** `PlaceCityTile` получает опцию `printedBonusMultiplier` (маркер промпта через `createMarsSelectSpace` + `addTile(…, {printedBonusMultiplier})` — форма Ferrus); `bespokePlay` —
   по форме Urbanized Area (`sourceCard`, `customReasoner` — если причина клетки есть, `andThen` → `LoseProduction`), ручных `grantSpaceBonuses` нет. Апстримные `it` — зелёные без правки (×3 печатного,
   океан 2, стоимость Эллады).
3. **Staged несёт множитель** (класс): `placementPreview({staged: {…, printedBonusMultiplier}})` → `StagedPlacementModel.printedBonusMultiplier` → клиент передаёт его в запрос досье staged-поля (тот же параметр
   `bonus`, что у живого промпта); `stagedPlacementParity.spec` — строка P74 (клетки + множитель = живой промпт).
4. **Закон RX10 повторяет выплату С ЕЁ множителем** (правило FAQ): `TilePlacementBonusContext.printedBonusMultiplier` (из `addTile`), `repeatPlacementBonuses` → `grantSpaceBonuses(player, space, multiplier)`;
   эхо `PlacementLawPayoutModel` несёт множитель (волна закона летит ×N); прогноз / досье закона — тот же множитель (`:179–200` — факты печатного бонуса умножены — проверить, что двойник читает то же число).
   Спеки: `DevelopmentCraze.spec` § multiplied placement (P74 → 6, Ferrus → 4, обычный → 2, океан ×2, бот — без изменений); если существующий `it` пинит «Ferrus + закон = 3» — переписать сознательно со
   ссылкой на FAQ (строка реестра).
5. **Свой e2e-стенд — ДА**, `tests/e2e/console-frontier-town.spec.ts`, фикстуры одного рецепта `frontierTownFixture(name, arrange)` (Redux + Colonies + Prelude 2): **`frontier-town`** — у власти Марс Вперёд
   тихим законом (НЕ RX10: `seatEnacted(quietResolutionOf(MARS))`, проверить, что тихий закон Марса — не Craze), у p1 произв. энергии 1, 20 M€, P74 в руке, известная клетка «2 [растения]» и клетка
   «1 [сталь]» среди кандидатов; **`frontier-town-craze`** — закон RX10 принят (рецепт `parliament-craze-enacted`) → та же клетка платит 12 растений; **`frontier-town-locked`** — Зелёные у власти (свежий стол),
   у p1 1 делегат на резолюции Марса Вперёд → «1/2». Клетки: (1) `-locked` — плита заперта, эмблема Марса «1/2», 0 POST; (2) композер — чип «−1 произв. энергии», дверь на поле; (3) staged-поле: кандидаты
   несут пометку множителя (§4.1), досье клетки «2 [растения]» — «6 [растения] · бонус ×3»; (4) A → блокировка, A → ОДИН POST → город садится, волна посадки ×3 (§4.2), растения 0 → 6 по касаниям,
   произв. энергии 1 → 0; (5) `-craze`: пометка «×6», после волны посадки — волна закона (лицо закона поднимается, ×3 повтора), растения 0 → 12; журнал — одна строка бонуса клетки + строка закона.
   Сервер: растения, произв. энергии, тайл, леджер закона.
6. **НАГРАДА КЛЕТКИ — НА САМОЙ КЛЕТКЕ, СО СВОИМ МНОЖИТЕЛЕМ** (§4 — композиция ПРИНЯТА, исполнять).
7. **Журнал серии / доки / реестр** — §7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача.

## 0. Рабочее дерево
1. `git log --oneline -3`; `ListAgents`; `git status`. `SendMessage` занятым соседям: твои файлы — карта (`prelude2/FrontierTown.ts`, манифест — одна строка, спек, `prelude2Adaptation.ts` — одна строка,
   арт P74, `lore_texts.json` — одна строка, `ru/{prelude2_cards,lore_texts,console}.json`, `src/genfiles/*`), сервер (`deferredActions/PlaceCityTile.ts`, `cards/actionPreviews.ts` (staged — одна опция),
   `boards/marsSelectSpaceHelper.ts` (если нужно для staged), `common/models/…StagedPlacementModel`, `parliament/resolutions/marsFirst/DevelopmentCraze.ts`, `parliament/ParliamentHandler.ts`, `Game.ts` (контекст
   хука — одна строка), `common/models/PlacementLawPayoutModel.ts`), клиент поля (`BoardSpace.vue` / компонент `Bonus` — пометка, `ConsoleBoardInput.vue` / `ConsoleShell.vue` — параметр staged, слой посадки
   `tilePlacement/**` — волна ×N, `placementDossier.ts` — строка бонуса, стили поля), фикстуры (`generate.ts` — объявленный ханк), стенды, доки, журнал, реестр.
2. e2e — только бокс; `FIXTURES=frontier-town,frontier-town-craze,frontier-town-locked npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта и правила (≈ 25 %)
- `FrontierTown.ts`: текст (решение 1), `bespokePlay` через множитель (решение 2), `cardPlayPreview` staged + хук `placementPreview` (факт «−1 произв. энергии» — форма Urbanized Area `:126–150`); манифест.
- `PlaceCityTile` — опция множителя; staged — множитель (решение 3); закон — множитель (решение 4).
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P74.png" P74` → `make:cards`); строка `FRONTIER_TOWN` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек карты**: апстримный блок — байт в байт; `describe('on a Turmoil Redux table')`: правила 1–5 по одному `it` — требование (Марс у власти / 2 делегата / 1 — заперта; энергия 0 — причина названа),
  ОДНА выплата ×3 (запись `tilePlacements` несёт ×3, журнал — одна строка), океан ×1, платный бонус — раз на множитель, порядок «город → бонус → закон → −1 энергии», закон RX10 → 6, превью read-only,
  staged ↔ live паритет, раздача под Redux только с маркером, MarsBot-стол, save / reload.

## 2. Клиент — карта (≈ 5 %)
Даром: причина руки, staged-плита «Разыграть здесь · 11 M€», досье (после решения 3 — ×3), тайл-язык, реакторы. Дыры — строка реестра и правка в общем слое.

## 3. «ДО» — первым делом
Раскадровка «ДО» на боксе: P74 (сейчас, без правок — досье ×1, волна ×1, две поздние выплаты), `frontier-town-craze` (×4 вместо ×6), Ferrus первый город (×2 — что видно на поле и в досье), Ferrus + закон (×3
вместо ×4 — если есть рецепт; иначе — серверный спек). Свидетель посадки (§4.5) «до» — таблица: сценарий × (пометка на поле, число в досье, жетоны волны, тики рельса без причины, строки журнала).

## 4. ГЛАВНОЕ — «НАГРАДА КЛЕТКИ — НА САМОЙ КЛЕТКЕ, СО СВОИМ МНОЖИТЕЛЕМ» (решение 6) — композиция
**Цель:** умноженное размещение — это ВЫБОР клетки по её печатному бонусу; игрок должен видеть множитель на поле одним взглядом, а посадка — рассказать «клетка заплатила N раз» одним утверждением,
закон — «и удвоил ЭТО». Иерархия формой и весом; свет — только курсор и одноразовое событие; ничего не движется, пока игрок указывает (законы поля).
1. **ПОМЕТКА МНОЖИТЕЛЯ НА КЛЕТКЕ (F1).** Пока стоит размещение с множителем > 1 (маркер промпта / staged-модели — СТРУКТУРНО, никогда по заголовку), КАЖДАЯ легальная клетка с печатным бонусом несёт у своего
   кластера бонусов плашку «×N» (N = сколько раз печатный бонус клетки заплатит при этом размещении; при законе RX10 — уже с удвоением: число — СЕРВЕРА, решение 4 даёт его прогнозу; клиент не умножает сам —
   поле читает одно число из промпта / staged-модели или из фактов досье, выбрать одно и назвать его в доке). Плашка — материал (заливка в тоне бонуса поля, тонкий кант, вес цифры), без ореола и пульса;
   стоит в зарезервированном месте кластера (кластер не сдвигается при её появлении — абсолютное позиционирование); на клетках без печатного бонуса — ничего. Состояние пишется АТРИБУТОМ на ячейке
   (`data-bonus-times="3"`) и CSS, никогда классом через `:class` (`board-space-class-binding-wipes-imperative` — фокус и доступность пишутся императивно на тот же элемент). Появление — вместе с сеткой
   легальных клеток (тот же бит), уход — с её уходом. Проекция ретикла не перекрывает плашку (бонус — всегда передний план, закон поля). Deck — та же плашка в масштабе профиля, пол типографики.
2. **ВОЛНА ПОСАДКИ ×N — ОДНО УТВЕРЖДЕНИЕ (F2).** Выплата ×N — одна волна (`runRewardWave`, тайл-язык W4): каждый значок кластера «отдаёт» свои N порций ПО ОЧЕРЕДИ — значок отвечает на каждую порцию
   коротким одноразовым нажатием формы (scale ≤ 1.08, ≤ 120 мс, `@keyframes`, кончается сам), жетоны рождаются на значке, тик рельса — на касании; если число жетонов превышает потолок волны — сверх потолка
   ряд тикает одним жетоном с числом («+4»), а не исчезает молча (инвариант 4); плашка «×N» на севшей клетке гаснет после последней порции (форма, не свет). Темп — существующие числа волны (не замедлять:
   N порций одного значка — внутри шага волны, A/B темпа против HEAD — без роста больше, чем на одну порцию на значок).
3. **ЗАКОН — «И УДВОИЛ ЭТО» (F3).** Волна закона RX10 — по-прежнему ВТОРОЕ утверждение (лицо закона поднимается — итерация 4 CN, подъём только сработавшей карты — DB), но её жетоны рождаются на лице закона
   с тем же ×N (решение 4), а плашка клетки в момент старта волны закона на миг показывает «×N → ×2N» (одноразовая смена цифры кроссфейдом, ≤ 160 мс) — связь «закон удвоил выплату ЭТОЙ клетки» видна на поле.
4. **ДОСЬЕ И ЖУРНАЛ (F4).** Досье: строка печатного бонуса — «6 [растения] · бонус клетки ×3» одной строкой (`buildDossierRows` — один вектор, причина в хвосте), при законе — строка закона, как сейчас, с ×N;
   staged-поле — то же (решение 3). Журнал — ОДНА строка выплаты клетки с множителем (сервер — один `grantSpaceBonuses` с ×N, проверить, что строка лога несёт множитель словом / числом), строка закона — своя.
5. **СВИДЕТЕЛЬ ПОЛЯ** — НОВЫЙ `tests/e2e/console-board-bonus-multiplier.spec.ts` (FUNCTIONAL, fhd + tv4k + deck): сценарии — P74 (×3), P74 + закон (×6), Ferrus первый город (×2), обычный город (×1 — пометок
   НЕТ ни на одной клетке); проверки — (а) каждая легальная клетка с печатным бонусом несёт `data-bonus-times` = серверное число, клетки без бонуса — нет; (б) кластер бонусов не сдвинулся при появлении
   пометки (±1 px); (в) пока курсор ходит по полю — пометки не анимируются (§ «nothing animates while the player points»); (г) жетонов волны посадки = единиц выплаты (до потолка), тиков рельса без причины — 0
   (`transferWitness` `endsOverGlass` пуст, тики только на касаниях); (д) при законе — волна закона после волны посадки, жетоны рождены на лице закона, ×N; (е) в досье и журнале — одно число; (ж) ни одного
   стоячего ореола на плашке (`glowRestraint` в живом DOM). ПЕРВЫМ ДЕЛОМ — прогнать «ДО»: (а), (г), (е) ДОЛЖНЫ быть красными на P74 (иначе переписать свидетель, не правку).
6. **ЧЕГО НЕ ДЕЛАТЬ.** Не перерисовывать сами печатные значки бонусов поля (спрайты клеток — вне задачи); не добавлять плашку на клетки вне размещения; не трогать ретикл / двухфазный коммит / проекцию тайла,
   кроме «не перекрывать плашку»; не трогать тайл-язык вне волны ×N; не умножать на клиенте (число — сервера); не трогать композер действия (сосед P73).

## 5. Тесты
1. Спек карты; `DevelopmentCraze.spec` § multiplied placement; `FerrusAcademy.spec` (регрессия + закон ×4); `PlaceCityTile`-спек § множитель; `stagedPlacementParity.spec` (P74); `BoardInformationEngine` / досье
   (`placementDossier.spec` — строка «×N» одним вектором); `boardInfoState` (параметр `bonus` для staged); юнит пометки (чистая функция «сколько раз платит клетка» — если клиентская, то только чтение
   серверного числа); `greenTilePlacers.spec` (P74 в ворклисте `placesTile`), `cardInformation`, `Prelude2CardsHeldBack`, `premiumScope`, `cardPlayPreviewCoverage`, `requirementProse` (EN + RU Марса Вперёд),
   `premiumCardViewModel`, `cardLore`, `crossPlayerCoverageGuard` (соперник видит посадку и закон своей строкой), `parliamentGlossary`, **`glowRestraintGuard`**, `consoleTvTypeFloor`, `glyphLiteralGuard`,
   `lessDeadSelectorGuard`, `universalSiblingSelectorGuard`, `planetFocusRestyleGuard` (пометка не вешается на класс корня поля), `e2eLiveness`, `tests/Game.spec.ts` «serializes properties» (если тронута запись),
   `tests/client/i18n.spec.ts`.
2. `build:server`, `build:test`, `lint` (включая `lint:client`), `make:cards` 0 / 0 / 0, `make:json`; полные `test:server` / `test:client` на тихой машине.
3. e2e: стенд карты ×3 фикстуры; свидетель поля «до / после»; `npm run e2e:affected`; регрессия — `console-tile-language`, `console-staged-board-clarity`, `console-placement-dossier`, `console-placement-navigation`,
   `console-cell-dossier`, `console-parliament-craze`, `console-ferrus-academy`, `console-hartlan-heating` (реактор на тайл), `console-auto-tile-landing`, `console-flight-paint`, канарейка; аннотация `build` у красного.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p74/tv4k/`: (а) `-locked` — плита заперта, эмблема Марса «1/2»; (б) композер — «−1 произв. энергии», дверь на поле; **ДО / ПОСЛЕ**: (в) staged-поле — кандидаты с пометкой «×3», досье «6 растений · бонус
клетки ×3»; (г) посадка — значок отдаёт три порции, жетоны в ряд растений; (д) `-craze` — пометка «×6», волна закона после посадки; (е) Ferrus ×2; (ж) обычный город — пометок нет; (з) журнал. Своим глазом:
«выбирая клетку, я вижу на ПОЛЕ, сколько раз она мне заплатит? Посадка говорит "три раза" одной волной, а закон — "и удвоил это"?»

## 7. Полировка по пути / доки
1. Реестр (раздел по footer — ожидаемо **DD**) «P74 · НАГРАДА КЛЕТКИ — НА САМОЙ КЛЕТКЕ, СО СВОИМ МНОЖИТЕЛЕМ (пометка ×N на кандидатах, волна ×N одним утверждением, закон удваивает ЭТУ выплату) · МНОЖИТЕЛЬ
   ПЕЧАТНОГО БОНУСА — ОДИН МЕХАНИЗМ (bespoke без ручных выплат, staged несёт множитель, закон RX10 повторяет с множителем — FAQ ×6)» — диагноз 1–3, F1–F4 и решения 2–6 строками «что было / что стало / где»
   + находки прохода; номера — по footer.
2. Доки: журнал серии (P74, четырнадцатая запись); `PRELUDE2_ADAPTATION.md` (14 / 54; строка; §3.1 п. 3 — одно предложение «умноженный печатный бонус — только через `printedBonusMultiplier`, staged несёт его»);
   `docs/TURMOIL_REDUX_DEVELOPMENT_CRAZE.md` — абзац «закон повторяет выплату с её множителем (FAQ: Frontier Town ×6)»; `docs/claude/console/board-placement-flow.md` § THE TILE LANGUAGE — абзац «множитель
   на клетке и в волне»; `.claude/rules/console-ui.md` § THE TILE LANGUAGE — одна строка; память `prelude2-adaptation.md` (14 / 54).

## 8. Режим работы
1. Читать до кода. Порядок: «ДО» (§3) → карта (текст, маркер) + спек апстрима зелёный → множитель через механизм (решение 2) → staged (решение 3) → закон (решение 4) + спеки → лор / арт / RU → `make:cards`
   → фикстуры + стенд карты → свидетель поля «ДО» → пометка (4.1) → волна (4.2) → закон (4.3) → досье / журнал (4.4) → свидетель «ПОСЛЕ» → регрессия → реестр → доки / журнал / память. Коммиты по шагам
   явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; таблица «ДО / ПОСЛЕ» (сценарий × пометка / досье / жетоны / тики без причины / журнал); POST (один); числа выплат (×3 / ×6 / Ferrus ×2 и ×4);
   гарды и `make:cards`; регрессия на боксе (аннотация `build`); решения 1–7 (что сделано по каждому); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Платить множитель руками мимо `printedBonusMultiplier`; умножать соседство океанов на 3 (апстрим «2, not 6»); умножать на клиенте; определять размещение / множитель по заголовку промпта; ломать стоимость ×3
  платных клеток и апстримные `it`; молча менять Ferrus + закон без строки реестра со ссылкой на FAQ.
- Пометку классом через `:class` на ячейке; анимацию пометок, пока курсор ходит; ореол / пульс-петлю / свечение; перекрытие кластера бонусов проекцией; новые слова на клетке сверх «×N»; `title`; литерал
  кнопки; `v-if`-моргание; кегль ниже пола ТВ.
- Трогать файлы соседей (шапка; композер действия — P73); перерисовывать спрайты бонусов поля; двухфазный коммит, ретикл, тайл-язык вне волны ×N.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; переоткрывать находки P76…P73.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` / `--no-verify`; коммитить чужие файлы
  (`package.json` / `package-lock.json`); пересборку во время прогона e2e на боксе.
