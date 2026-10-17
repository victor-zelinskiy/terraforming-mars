# Промт исполнителю · TR69 Floating Biodomes («Парящие биокуполы») — синяя, 10, Венера ≥ 10 %, метки Растения + Венера, держатель АЭРОСТАТОВ: «2 аэростата сюда» при розыгрыше; действие «1 растение → аэростат на ЛЮБУЮ карту Венеры ИЛИ 3 аэростата отсюда → озеленение (+1 кислород)» — ОДНА ДЕКЛАРАЦИЯ класса TR40 с ветвью-ТАЙЛОМ (первой в наборе), озеленение ставится из композера ПО ЗАКОНУ STAGED (D5), не живым промптом после · ГЛАВНОЕ — ИТЕРАЦИЯ «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ»: «Финальный подсчёт» / «Итоги партии» на 4K из пяти полосок над пустой дугой в подиум — победитель-герой с лицом корпорации, места с лицами, медальоны категорий языком ячейки ПО, подсчёт течёт жетонами, обзор «Счёт» и «Игроки» в масштабе проёма, профиль TV у финала

Выдан 2026-10-17. Инфраструктура набора стоит (TR01–TR61, TR65, TR66, TR67 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строки «ДЕРЖАТЕЛЬ с `or`-ДЕЙСТВИЕМ „купи ресурс ИЛИ потрать его на товар“» (TR40), «N ресурса на ЛЮБУЮ карту»
(TR56 / TR58), «PRE-SELECT» (`:123`), «требование СУЩЕСТВУЮЩЕГО вида» (`:85`); постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Премиум-планка»** — герой ≥ трети,
пустота ≤ трети, одна самая громкая вещь, чипы в масштабе СЦЕНЫ, пробник долей, макеты в батч ПЕРВЫМ, гард долей; **«Качество полировки»**), журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,console-ui,board,animations,tests,localization}.md`. **Главные контракты итерации:**
`docs/claude/console/endgame-workspace.md` ЦЕЛИКОМ (Files `:16`, § The VM is a RE-PROJECTION `:31`, § STABILITY — три аудированные регрессии `:53`, § Track geometry `:82`, § Ceremony machine `:95`,
§ CAMPAIGN CHAMPION `:118`, § THE BOUNDARY IS A TEARDOWN `:176`, § Collapse `:234`, § The road BACK IN `:274`, § The head's HANDOFF and the post-game PLATES (PL-576) `:306`, § Input `:317`, § Presentation
modes `:345` — «five players stay one screen with no scroll (e2e-guarded at 4K)», § E2E harness law `:353`, § «Обзор партии» `:367`), `endgame-overview.md` (§ The scene contract `:24` — two layers of ONE
root, `.con-eg` PARKS, never `display`; § Tabs `:49`; § The information architecture `:64`; § Performance `:114`), `docs/ENDGAME_STORYTELLING.md`; `.claude/rules/console-ui.md:53–55` (финал — full-bleed,
`endgameStageUp`, free roam, `sealLiveGameSurfaces`), `:159–161`, `:201`; законы CLAUDE.md «A WORKSPACE IS ONE FLOW» (п. 3), «Physical causality», инварианты 1 (никогда по тексту), 3 (никакого автовыбора),
5 (`title` запрещён), 6 (одна система движения; критическая анимация — animation hold, release = собственный сигнал), 7 (только чтение — VM не считает очки сам), 9 (английский текст = ключ i18n), 12 (глифы).
Для карты: `docs/TILE_PLAY_STAGED_COMMIT.md` § 9-ter (действия синих карт — D5), `docs/claude/console/variant-choice.md:26–35` (общий ряд режется, свой ряд печатается целиком), `board-placement-flow.md`.
Память: `endgame-experience-implemented`, `campaign-champion-ceremony`, `final-greenery-session` (финал на поле = одна сессия), `hidden-vp-final-reveal`, `final-scoring-reveal-segment-sync`, `private-score-display`,
`tr55-score-cell` (ячейка ПО — язык), `tr60-information-dossier` (медальоны счёта — «the finale's podium line»), `tr58-cursor-living-object`, `polish-area-premium-visual-first`, `weak-visuals-backlog`,
`polish-premium-bar`, `polish-priority-tv4k-no-deck-only`, `polish-direction-smoothness`, `storyboard-catches-what-the-probe-passes`, `bot-turn-review-out-of-polish-scope`, `turmoil-redux-forestry-mechs` (TR40 —
образец), `concurrent-session-edits-same-files`, `e2e-fixture-generator-gotchas`, `shell-template-escapes`.

**ОБЛАСТЬ ПОЛИРОВКИ ВЫБРАНА ПРИ ПОДГОТОВКЕ (поручение владельца 2026-10-17 — «промт на эту карту и новую область для полировок»).** Метод — память `polish-area-premium-visual-first`: свежий обход 4K (GPU)
двух открытых кандидатов бэклога — предигровые экраны (меню · «Мои партии» · «Мои кампании» · профиль · настройки · откат · создатель) и ФИНАЛ на столе из ПЯТИ и ДВУХ игроков (церемония → итоги →
обзор, шесть вкладок) — с числовым пробником. Предигровые: меню и настройки — на планке; лобби «Мои партии» / «Мои кампании» / «Откат» / «Профиль» — диалог ≈ 1536 × 345 px на экране 3840 × 2160 (6 %
экрана), создатель — ряды на верхних 30 % высоты, 17–27 подписей 24–30 px — читаемо, второй эшелон (в бэклог с числами). **ФИНАЛ — хуже всего и важнее всего:** кульминация каждой партии для каждого
игрока, а на 4K это пять полосок высотой 60 px в рядах 168 px на 29–72 % высоты экрана над пустой дугой горизонта (заливка 5 %), без единого лица корпорации, жетона или медальона; у двух игроков —
«крупный формат» (ряды 336 px, полоса 104 px) — те же две полоски; в обзоре «Счёт» — матрица на верхних 40 % (заливка 7–10 %), «Игроки» — 56 %. PL-576 (TR61, по пути) уже починил смену заголовка и плашки
действий и ОСТАВИЛ полосы с пометкой «читаются при 2 игроках, судить при 4–5» — я снял при 5 и при 2: композиция одна и та же. Разбор хода бота — вне полировок (владелец).
Итерация (≈ 85 %): **А. «ПОДИУМ»** — композиция итогов на весь проём: победитель-герой, места с лицами, медальоны, дуга — сцена (≈ 35 %); **Б. «СЧЁТ ТЕЧЁТ»** — хореография подсчёта на новой геометрии:
жетоны категорий прибывают в счёт, переворот мест — физический, победный такт (≈ 25 %); **В. «ОБЗОР В МАСШТАБЕ»** — вкладки «Счёт» и «Игроки» заполняют проём объектами (≈ 15 %); **Г. «ПРОФИЛЬ TV»** —
у финала и обзора нет ни одного TV-правила (≈ 10 %). Карта (≈ 15 %) — декларация + staged-хук превью + роль держателя с товаром-тайлом.

## ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (HEAD `a89cb29abf`, дерево чистое; рядом — сессия `terraforming-mars-6e` (хвосты стола PL-619…625: файлы `played/**`, `consolePlayedModel.ts`, `console_played.less`,
реестр BC) — финала не касается; кадры 4K GPU — `screenshots/tr69/tv4k/*.png`, листы `screenshots/tr69/sheet-w{1,2}-*.jpg`; числа — `screenshots/tr69/tv4k/probe.jsonl`, `geometry.jsonl`; 2 игрока на
подготовке TR60 — `screenshots/tr60/tv4k/w2-0{0..4}*.png`; стенд подготовки — `screenshots/tr69/walk.stand.spec.ts` (вне git; W2 — пять игроков, W3 — геометрия 5p / 2p); файл:строка подтвердить на своём HEAD)

**Числа (4K 3840 × 2160; пол TV 32 px; кегль эффективный):**

| экран | ряды (y, % высоты) | ряд / полоса, px | кегли: имя · корп · итог · заголовок | заливка / низ содержимого | ниже пола |
| --- | --- | --- | --- | --- | --- |
| итоги · 5 игроков (`--n5`) | 623–1559 (29–72 %) | 168 / 60 (ширина полосы 2332) | 42 · **29** · 86 · 58 | 5 % / 97 % (плашки у низа) | 16 (корп 29, лента «Победитель» 30, подписи в полосе 31) |
| итоги · 2 игрока (`--n2`) | 708–1448 (33–67 %) | 336 / 104 | 64 · 38 · 86 · 58 | — | лента 30 |
| обзор · «Счёт» (5p / 2p) | — | полосы матрицы 0,8rem = 32 px | 33–34 | 10 % / **40 %** · 7 % / 40 % | 1 |
| обзор · «Игроки» | — | — | 30–36 | 12 % / 56 % | 17 (заголовки групп 30, «РТ» 27) |
| обзор · «Обзор» (digest) | — | — | 29–40 | 25 % / 87 % | 20 (корп 29, «ПО» 25) |

1. **Итоги — таблица над пустотой.** `ConsoleEndgameWorkspace.vue`: `.con-eg` с плотностью `con-eg--n{2..5}` (`:38`, `densityN` `:536`), шапка `:39–51`, рельс категорий `:62–68`, РЯДЫ `:80–198` (лента
   `:89–92`, место `:128`, имя / корпорация ТЕКСТОМ `:132–143`, полоса с сегментами `:145–157`, подписи в полосе `:159`, чип `+N` `:165–171`, итог `:186–197`), низ — тай-брейк `:205–221`, заметка победителя
   `:222–234`, плашки действий `:236–249` (PL-576). Корпорация — строка 29 px (`.con-eg__corp`), ни лица, ни куба в масштабе сцены; победитель — золотая рамка и лента 30 px (`rowClass` `:984–998`); дуга
   горизонта — `.con-endgame::before` (`console_endgame.less:85–96`, радиальный градиент у `50 % 142 %`) — декорация под пустотой, не сцена. Токены плотности: `--n2` `:156` (ряд 8,4rem, полоса 2,6, имя 1,6,
   итог 3,3, корп 0,95), `--n3` `:177`, база n4 `:125–145`, `--n5` `:197` (ряд 4,2rem, полоса 1,5, имя 1,05, корп 0,72); рамка `max-width: 88rem` (`:150`) = 3520 px на 4K — весь проём, но ряды занимают
   его верхние 40 %. Кадры `w2-02-actions.png`, `w3-5p-results.png`, `w3-2p-results.png`, `screenshots/tr60/tv4k/w2-02-results.png`.
2. **Подсчёт — полосы растут, но ничего не прибывает.** Машина: `consoleEndgameState.ts:45` (`idle → entering → scoring → settling → ranking → [tiebreak] → winner → [champion] → actions`), такты
   `consoleEndgameScript.ts:27–73` (`CEREMONY_MS`: enter 640; focus / grow / settle / pause 220 / 640 / 240 / 270; sub 300 / 390 / 500; preRank / rankFlip / placesIn / winnerHold 720 / 820 / 340 / 480; winner
   1500; actionsIn 360), директор `consoleEndgameDirector.ts:61` (одна GSAP-таймлайн, счётчики к абсолютным целям `:84–99`, страховочный таймер `:329–349`), порядок категорий `SCORE_CATEGORY_TABLE`
   `consoleEndgameModel.ts:148` (tr, milestones, awards, greenery, city, moon, tracks, delta, cards, titles, penalty), геометрия `consoleEndgameLayout.ts` (`buildRowGeometry` `:61`, `planValueLabels` `:196`),
   победный залп `fireWinnerFx` `:1194` (`ceremony/ceremonyFx.ts:73`), пропуск — `skipCeremony` `:1072` → `finalizeCeremony` (`consoleEndgameState.ts:173`, атомарный settle). Язык ячейки ПО (TR55 —
   `scoreCell/maVp.ts:56` `flyMaVp`, `vpShareLedger.ts:147, 203`) и медальоны досье (TR60 — `info/ConsoleDossierScore.vue:12–32`, комментарий `:54` называет однорядную раскладку «the finale's podium line»,
   `ConsoleScoreDisc.vue:8–15`, `dossierMedallions` `infoDossierModel.ts:58`, цвета `.con-eg-cat--*` `console_endgame.less:33–46` уже общие с `console.less:18028`) в финале НЕ используются.
3. **Обзор: «Счёт» и «Игроки» — верхняя половина.** `ConsoleOvTabScore.vue`: полоса стоящих `:11–27`, матрица `:30–53` (ряд на категорию, `--ov-n` полос, дорожки 0,8rem `console_endgame_overview.less:797`,
   колонка имён 17rem `:743`), контекст-зона `:57–75` фиксированных 7,6rem (`:828–830`), вложенная сетка `:78–100`; `ConsoleOvTabPlayers.vue`: кольцо чипов `:12–20`, идентичность `:25–33` (корпорация —
   СТРОКА), группы `:36–89` (метки, ДиН текстом `maText` `:63–67`, источники `:69–75`, метрики с полосой только при сравнимости `:77–87`); пейн — `height: 100 %` (`:200–203`), содержимое — по контенту
   (`flex: 0 0 auto` `:736`, `grid-auto-rows: min-content` `:1633`). VM `consoleOverviewModel.ts`: «Счёт» `:138–166` несёт `leaders` / `decisive`; `OvPlayerCard` `:281–317` — `corporation` склеенной строкой без
   `CardName` (`:862`), ДиН — сырой `MADetail` (`:872–873`), лица корпораций — НИГДЕ. Digest (`ConsoleOvTabDigest.vue`) плотен (87 %) — не трогать.
4. **Профиля TV нет.** `console_tv.less` — 0 правил для `con-eg` / `con-egov` / `con-endgame`; в `console_endgame.less` и `console_endgame_overview.less` нет блока `con-profile-tv` — только `zoom ×
   --con-ui-scale` у обзора (`:1252, :1349, :1739, :1830`); 16 текстов итогов и 17–20 текстов вкладок ниже пола 32 px. Handheld — лестница `console_endgame.less:1130–1154`.
5. **Хорошее, НЕ ломать:** оверлей-контракт обзора (две слоя одного корня, `.con-eg` паркуется opacity + visibility, НИКОГДА `display`; `measureTrack` переживает парковку; `leaving` — кроссфейд поверх; фазы
   на `gsap.delayedCall` через `consoleMotionMs`); три аудированные регрессии § STABILITY `:53`; граница-teardown (`consoleEndgameSeal.ts:57`), «Свернуть» и read-only free roam, дорога обратно из «Мои партии»;
   обязательный ~5 с такт чемпиона кампании (`:118`, стили `console_endgame.less:960–1127`); пропуск X — атомарный settle; PL-576 (передача заголовка 130 / 40 / 300 мс, плашки со знаком на грамматике
   курсора); «five players stay one screen with no scroll» (e2e 4K — `console-endgame.spec.ts:314` четыре игрока, `console-endgame-overview.spec.ts:469` пять); закон e2e-харнесса `:353`; скрытый счёт
   (`hidden-vp-final-reveal`) — числа открываются ТОЛЬКО здесь; приватный счёт не маскирует финал.
6. **Бэклог рядом (не в объёме):** лобби «Мои партии» / «Мои кампании» / «Откат» / «Профиль» — диалог 6 % экрана 4K (`w1-games-00.png`, `w1-campaigns-00.png`); создатель — ряды на 30 % высоты
   (`w1-creator-*.png`); кикер создателя 30 px.

## Обязательное чтение до кода
`docs/claude/console/endgame-workspace.md`, `endgame-overview.md`, `docs/ENDGAME_STORYTELLING.md` (`:34` — факт экономики TR61 без читателя, PL-608), `docs/claude/console/score-cell.md`,
`information-workspace.md:203–300` (LIVE SCORE — «one system with the finale»); `src/client/components/console/{ConsoleEndgameWorkspace,ConsoleEndgameOverview,ConsoleOvTabScore,ConsoleOvTabPlayers,
ConsoleOvTabDigest,ConsoleOvChart,ConsoleVpBadge}.vue`, `info/{ConsoleDossierScore,ConsoleScoreDisc}.vue`, `src/client/console/endgame/{consoleEndgameState,consoleEndgameScript,consoleEndgameDirector,
consoleEndgameModel,consoleEndgameLayout,consoleEndgameSeal,consoleOverviewModel,consoleOverviewState}.ts`, `console/scoreCell/{maVp,vpShareLedger,vpReasonText}.ts`, `console/liveScoreModel.ts`,
`console/infoDossierModel.ts:40–140`, `console/ceremony/ceremonyFx.ts`, `src/common/events/endgameFacts.ts` (`FactType` `:34–40`, `productionIncome` `:785`), `src/common/VictoryPointsBreakdown.ts:200–206`;
стили `console_endgame.less` (`:33–46, 76–96, 125–201, 355–375, 587–594, 779–810, 881–931, 960–1127, 1130–1159`), `console_endgame_overview.less` (`:61–74, 189–203, 736–830, 1633`), `console_tv.less`;
спеки `tests/client/components/console/{consoleEndgameCeremony,consoleEndgameLayout,consoleEndgameModel,consoleEndgameSeal,consoleOverviewModel,consoleOverviewBot,consoleOverviewState}.spec.ts`,
`tests/client/components/endgame/*` (18 файлов), e2e `console-endgame` (`:108` 2p, `:314` 4K 4p), `console-endgame-overview` (`:265` 2p, `:469` 4K 5p), `console-endgame-boundary:62`,
`console-campaign-endgame:35, 157`, харнесс `consoleEndgameHarness.ts` (`createTable` `:278`, `journeyToEndgame` `:581`). Карта: `turmoilRedux/ForestryMechs.ts` (TR40 — декларация слово в слово),
`ReprocessingPlant.ts:103–119` (TR58 — растения / аэростаты на ЛЮБУЮ карту), `AuroraStation.ts:60–80` (TR27 — единственный держатель аэростатов набора; «сама карта — кандидат»), `venusNext/Stratopolis.ts:26–38`
(фильтр по метке Венеры `AddResource.tag`, печать аэростата с пузырём Венеры), `behavior/Behavior.ts:93–96, 208–211`, `behavior/Executor.ts:63–73, 127–150, 219–225, 336–378, 615–624, 712–714`,
`deferredActions/AddResourcesToCard.ts:207–254`, `Game.ts:1792–1794, 2865–2870`, `models/actionFutility.ts:141–144, 268`, `models/actionUnavailableReasons.ts:54, 136–141`, `models/actionPreview.ts:85–86,
344–351, 943, 980–981`, `promo/CometAiming.ts:70–95` (staged-ветка `or`), `cards/actionPreviews.ts:519` (`stagedActionPlacement`), `cardPlayPreview.ts:301–305` (титул и клетки озеленения),
`holderActionGood.ts:54–60, 128–138`, `common/cards/holderRole.ts:51–64`, `turmoilRedux/CargoMechs.ts:155` (TR61 — объявленная роль `repeat`), `client/console/holderRoles.ts:214, 287, 330`;
гарды `tests/boards/stagedPlacementParity.spec.ts`, `tests/models/actionBranchPrinted.spec.ts:149–240`, `tests/cards/requirementProse.spec.ts:115`, `tests/cards/holderActionGood.spec.ts:52`,
`tests/client/console/holderRoles.spec.ts:188–193`; последняя запись журнала (TR65 — формат).

## Что это за карта
**Скан:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR69.png`. Правила набора — `…\TM Turmoil Redux\Turmoil Redux Rules.pdf` (текст — `C:/tmp/redux-rules.txt`).
Арт: в `C:\Users\zelin\Downloads\Mars Arts\` файла `TR69.png` **НЕТ** (есть TR60, TR61, TR65, TR67) — спросить владельца (решение 3).
**Синяя (ACTIVE), 10 M€, требование Венера ≥ 10 %, метки Растения и Венера, ресурс — АЭРОСТАТ, без ПО.**

### Чтение скана
Синяя рамка; цена **10**; MIN-плашка «10 %» с иконкой шкалы Венеры — ТРЕБОВАНИЕ `{venus: 10}`. Две метки — Растения (зелёный лист), Венера (синяя «V»). Заголовок «FLOATING BIODOMES». Два ряда
действия: «[растение] → [аэростат с пузырём Венеры]* OR» (звёздочка — на ЛЮБУЮ карту Венеры) / «3 [аэростат] → [озеленение с красной точкой кислорода]»; текст: «(Action: Pay 1 plant to add a floater resource
to ANY Venus card, OR spend 3 floaters from here to place a greenery tile and increase oxygen 1 step.)». Низ: «[аэростат] [аэростат]» и «(Requires Venus 10%. Add 2 floater resources to this card.)». Значка
ПО нет. Слева — «V» модуля Венеры (`compatibility: 'venus'` — как у Венерианских карт набора) и фиолетовый ромб Redux. Лор: «Not quite a "Pie in the Sky." Though you could probably grow the ingredients?».
Кредит арта: TVF International. Номер TR69. Печать: `eb.plants(1).startAction.resource(CardResource.FLOATER, {secondaryTag: Tag.VENUS}).asterix()` / `b.or()` / `eb.resource(CardResource.FLOATER, 3)
.startAction.greenery()` (озеленение печатает свою точку кислорода — сверить с лицом Mangrove / Protected Valley); низ — два аэростата.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/FloatingBiodomes.spec.ts`)
1. **Требование** — Венера ≥ 10 % (`requirements: {venus: 10}` — прецеденты `venusNext/FreyjaBiodomes.ts:23`, `NeutralizerFactory.ts:20`, `VenusMagnetizer.ts:21`); Morning Star Inc. смягчает на 2 шага,
   Adaptation Technology / Inventrix — своё; проза требования — гард `requirementProse` (`:115` — субъект Венеры). При розыгрыше; действие — при любой Венере.
2. **Розыгрыш** — `behavior: {addResources: 2}` — 2 аэростата на ЭТУ карту (своя цель, исключение инварианта 3).
3. **Действие — ОДНА ДЕКЛАРАЦИЯ класса TR40:** `action: {or: {behaviors: [A, B], autoSelect: true}}`; движок: `Executor.canExecute` — хоть одна ветка (`:63–73`), `execute` оставляет живые (`:336–352`),
   одна + `autoSelect` — сразу (`:367–368`), две — `OrOptions` `effect-choice` (`:374`).
4. **A — `{spend: {plants: 1}, addResourcesToAnyCard: {type: CardResource.FLOATER, count: 1, tag: Tag.VENUS}}`:** фильтр по метке поддержан (`AddResource.tag` `Behavior.ts:208–211` → `restrictedTag`
   `Executor.ts:238, 615` → `AddResourcesToCard.holders` `:231–236` — Венера или Wild; прецедент Stratopolis `:26–31`); САМА КАРТА — кандидат (метка Венеры, держатель; `holders()` себя не исключает
   `:207–241`; исключение `:248–254` только для `mustHaveCard` + `resourcesHere` — не наш случай); цель ВСЕГДА спрашивается (`autoSelect: false` `:624`) — шаг «КУДА» (TR56); цена — растения + налог Красных на
   РТ не касается A (`canExecute` `:127–150`); без растений — причина класса «Not enough plants».
5. **B — `{spend: {resourcesHere: 3}, greenery: {}}`:** `greenery` объявлен («places a greenery tile and ALSO raises the oxygen», `Behavior.ts:93–96`), `canExecute` требует законную клетку (`:219–225`),
   `execute` откладывает `PlaceGreeneryTile` (`:712–714`) → `Game.addGreenery` поднимает кислород САМ (`Game.ts:2868–2870`) и начисляет РТ озеленения Redux (`ParliamentHandler.onGreeneryPlaced` `:2865`);
   **`global: {oxygen: 1}` НЕ добавлять** — двойной подъём; при максимуме кислорода тайл всё равно ставится, подъёма нет (`:1792–1794`) — ветка НЕ бесполезна (`models/actionFutility.ts:141–144`, док `:268`:
   «a greenery's tile is a yield at any oxygen»); нет клетки — причина `PLACEMENT` «No space available for the tile» (`actionUnavailableReasons.ts:54, 136–141`); мало аэростатов — класс PL-197 «N из 3 аэростатов
   на этой карте» (`RESOURCES_HERE_SHORT[FLOATER]` — проверить, есть ли строка; нет — добавить, гард `resourcesHereReason` назовёт карту); налог Красных на РТ озеленения — движок.
6. **Озеленение — STAGED из композера, не живой промпт после (решение 4):** декларативный строитель шагов печатает `boardPlacement` БЕЗ `staged` (`actionPreview.ts:980–981`, «collected AFTER submit» `:943`) →
   композер отдаёт поле только шагу со `staged` (`ConsoleActionComposer.vue:5680–5693` → `onCardActionsStagedPlacement` `flow: 'action'` `ConsoleShell.vue:21841–21854`). Карта объявляет `actionPreview`
   (хук переопределяет декларативное превью `actionPreview.ts:85–86` — прецедент staged-ветки `or` CometAiming `:70–95`): `orBranches(this, [A с `addToCardStep` по `restrictedTag`, B с
   `boardPlacementStep('greenery', {tileType: GREENERY, staged: stagedActionPlacement(player, {title: <титул живого промпта озеленения — `cardPlayPreview.ts:301–305`>, on: 'greenery', sourceCard, tileType})})`])`;
   превью ≡ исполнение (гард `stagedPlacementParity` — секция ACTION, байт-в-байт включая title; `actionBranchAvailability`); «A Подтвердить» паркует батч, поле открывается синтетическим промптом, B —
   чистый возврат в композер со снапшотом, подтверждение клетки — ОДИН POST `[...batch, {type: 'space', spaceId}]` (D5, `TILE_PLAY_STAGED_COMMIT.md` § 9-ter); церемония посадки карты не играет (карта
   уже на столе), волна награды от тайла — та же.
7. **Роль держателя** — решение 5: B платит ТАЙЛ — `holderActionGood.ts` `goodOf` для `greenery` уходит в default «a tile … not a plain good» (`:134–135`) → вся карта `undefined` (`:59–60`) → спутник ДОП.
   РЕСУРСЫ говорит «хранилище».
8. **Печатные ряды — две ветки:** ряд A и ряд B — свои (`variant-choice.md:26–35` — свой ряд печатается целиком); гард `actionBranchPrinted` (`:149–240`); токенайзер читает озеленение как «greenery forest»
   (`actionBranchView.ts:212`); консоль — ОДНА плитка «Действий карт», две плитки-исхода.
9. **Ответы стола:** на подъём Венеры — нет (ветки не поднимают Венеру); на озеленение / кислород — Arctic Algae, Nitrophilic Moss…, Redux-партии (Зелёные — `global: true` РТ) — прогноз сервера; Aphrodite —
   нет; Celestic / Dirigibles (аэростаты как деньги за карты Венеры — `Player.ts:1315`) — ОПЛАТА розыгрыша аэростатами с ДРУГИХ карт: TR69 — карта Венеры, Dirigibles платят за неё; метка Растений —
   семена / микробы как оплата (`:1314, 1316`); Hoverlord — веха (7 аэростатов, `milestones/Hoverlord.ts:6–18`), TR69 держит аэростаты и считается; Venus Waystation — скидка.
10. **MarsBot** карту не играет; save / load — обычная карта (аэростаты, флаг действия); превью чисты (staged-превью не ставит тайл).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **Имя RU** — «Парящие биокуполы» («Биокуполы Фрейя» — другая карта; «Парящ…» только в лоре). Альтернатива «Аэробиокуполы».
2. **Лор** — EN слово в слово (ключ `TR69`); RU: «Не совсем «пирог в небе» — зато ингредиенты для него тут, пожалуй, можно вырастить.»
3. **Арт** — нет файла; лицо без арта до выдачи (первая строка отчёта).
4. **Озеленение из композера** — (а, рекомендовано) STAGED (правило 6): клетка выбирается до отправки, один POST; (б) живой промпт после — ветка B заканчивается «ждите» и поле открывается отдельным вопросом
   (нарушает «один flow»).
5. **Роль держателя с товаром-ТАЙЛОМ** — (а, рекомендовано) новый вид товара `{kind: 'tile', tile: 'greenery'}` в `ActionGood` (как `repeat` у TR61 — `holderRole.ts:64`), вывод в `holderActionGood.ts:128–138`
   принимает `greenery` / `ocean` / `city`, читатель `holderRoles.ts` (строка «3 аэростата → озеленение»), спутник и шаг цели TR56 говорят, на что идут аэростаты; гарды `holderActionGood.spec`, `holderRoles.spec`;
   (б) хранилище — честный гэп в доке карты.
6. **Оба варианта живы** — (а) `OrOptions` effect-choice в композере — две плитки-исхода (стандарт TR40); (б) нет.

**ИТЕРАЦИЯ «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» (решения 7–11):**
7. **Подиум** (часть А) — (а, рекомендовано) победитель — ГЕРОЙ (лицо корпорации в масштабе сцены — `PremiumCard` / `ConsoleCardFaceLite`, куб цвета, имя, итог языком ячейки ПО — `ConsoleVpBadge`,
   медальоны категорий — `ConsoleScoreDisc`, лента «ПОБЕДИТЕЛЬ»), остальные места — ранжированный ряд с лицами (меньше героя, те же медальоны, итог), полоса счёта остаётся ИНСТРУМЕНТОМ подсчёта под
   лицом (ширина — по месту), дуга горизонта — СЦЕНА (герой стоит НА ней, не над пустотой); плашки действий — как сейчас (PL-576); 2–5 игроков — одна композиция с токенами плотности (n2 — два героя
   лицом к лицу «дуэль», n5 — герой + четыре места); низ содержимого ≥ 85 %, пустота ≤ трети; скрытый счёт открывается здесь же (без регресса `hidden-vp-final-reveal`); (б) ряды как сейчас, только в масштабе
   проёма (ряды на всю высоту, полосы 2×, корпорация с мини-лицом).
8. **Счёт течёт** (часть Б) — (а, рекомендовано) на каждом такте категории (`CEREMONY_MS` focus / grow / settle) из рельса категорий в счёт КАЖДОГО места летит жетон категории (язык `flyMaVp` /
   `vpShareLedger` — ячейка ПО тикает на касании), медальон загорается на посадке, полоса растёт синхронно (директор — одна таймлайн, holds не меняются); `rankFlip` — физический переезд мест (строки уже
   переставляются — теперь с лицами, FLIP), `winner` — лента + залп как сейчас; пропуск X — атомарный settle (жетоны не летят, всё на местах); reduced motion — снапы; чужой финал (зритель проиграл) — те же
   такты; (б) только полосы на новой геометрии, без жетонов.
9. **Обзор в масштабе** (часть В) — (а, рекомендовано) вкладка «Счёт» — табло: категории × места с медальонами и лицами вместо матрицы 0,8rem-дорожек, «РАЗБИВКА» — в той же плите; «Игроки» — карточка
   игрока с лицом корпорации (VM `OvPlayerCard.corporation` → `CardName`, не строка — `consoleOverviewModel.ts:862`), медальоны ДиН вместо `maText`; оба — низ содержимого ≥ 85 %; «Обзор» (digest),
   «Хронология», «Карты», «Параметры» — не трогать, кроме пола TV; (б) только пол TV и масштаб дорожек.
10. **Профиль TV** (часть Г) — (а, рекомендовано) блок `con-profile-tv` для финала и обзора: токены плотности `--n2…--n5` в rem шкалы TV, корпорация / лента / подписи в полосе / заголовки групп ≥ пола,
    гард `consoleTvTypeFloor` + e2e-пробник эффективного кегля в `.con-endgame` / `.con-egov`; (б) только пол.
11. **Дуга как сцена** — (а, рекомендовано) `.con-endgame::before` (`console_endgame.less:85–96`) становится горизонтом под героем (градиент — к подножию героя), планета Марса не рисуется (финал — full-bleed,
    `console-ui.md:53`); (б) оставить декорацией.

## 0. Рабочее дерево
1. `git log --oneline -1` → `a89cb29abf` на выдаче. **Рядом жива сессия `terraforming-mars-6e`** (хвосты стола PL-619…625) — на момент выдачи у неё НЕЗАКОММИЧЕНЫ: `.claude/rules/console-ui.md`,
   `docs/claude/console/played-table.md`, `consolePlayedCategoryModel.ts`, `consolePlayedModel.ts`, `played/ConsolePlayedCategoryView.vue`, `played/ConsolePlayedOverlay.vue`, `src/locales/ru/console.json`,
   `console_played.less`, спеки `ConsolePlayedOverlay` / `consolePlayedCategoryModel` / `consolePlayedModel`, e2e `console-played-perf-probe` / `console-played-table` (сверить `git status` — список мог
   измениться); её файлы (+ реестр BC, `TURMOIL_REDUX_STRATEGIC_SHIFT.md`) не трогать до её коммита; **`console-ui.md` и `ru/console.json` — общие: свои строки добавлять ПОСЛЕ её коммита**, иначе ханки
   смешаются. **Сначала** `ListAgents` + процессы playwright
   (память `pasted-prompt-author-may-still-run`); `SendMessage` о порядке по `console_tv.less` (твой — новый блок финала / обзора; её — блок стола), `ConsoleShell.vue` (твоё — только бар `'endgame'` `:9168`),
   `.claude/rules/console-ui.md`, реестру (номера — по footer в момент записи). Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q --
   package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить. ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки клиента — неиспользуемый импорт роняет `npm run build:client` всем сессиям.
2. Снапшот e2e — свой: `npm run e2e:snapshot tr69` + `TM_E2E_ROOT=.e2e-tr69`; ⚠ перед снапшотом — `npm run build:server` (на подготовке серверные исходники были новее `build/`); кадры «до» — клиент HEAD в
   своём снапшоте (память `ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`, ANGLE d3d11 — `screenshots/tr69/pw.config.ts`). ⚠ Скриншот 4K ≈ 1 с — хронометраж только пробником. Снапшот
   подготовки `.e2e-tr69prep` удалён.
3. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки. Для карты: TR69 на столе с аэростатами 3 / 2 / 0, растения 1 / 0, Венера ≥ 10 % / < 10 % (розыгрыш), вторая карта Венеры-держатель (Dirigibles
   / Stratopolis) для шага «КУДА», стол без клетки под озеленение (редко — проверить `canExecute`), кислород на максимуме. Для финала: НАСЫЩЕННЫЙ стол — `createTable` 5 и 2 игроков через `journeyToEndgame`
   даёт пок. 1 (бедно: «Хронология» / «Карты» пусты) — для обзора и подсчёта по всем категориям нужна партия с ДиН, картами ПО, городами (образец «enrichTable» в `console-endgame-overview.spec.ts:265` —
   локальный; вынести в харнесс), + MarsBot-стол (профиль бота в обзоре `endgame-overview.md:123`), + кампания (чемпион — `console-campaign-endgame`).
4. **Пробник:** кегль эффективный (`fontSize × currentCSSZoom`), текст в SVG исключать, лица `.pcard` — свой масштаб (мерить ширину лица); доли — низ содержимого, чернила, доля героя (образец W2 / W3 в
   `screenshots/tr69/walk.stand.spec.ts`, `geometry.jsonl`).

## 1. Сервер — карта (≈ 12 %)
1. `src/server/cards/turmoilRedux/FloatingBiodomes.ts` — `ActionCard` (ACTIVE), заголовок = чтение скана + правила 1–10; константы `FLOATERS_ON_PLAY = 2`, `PLANTS_PER_FLOATER = 1`, `FLOATERS_PER_GREENERY = 3`;
   титулы ветвей — экспорт (ключи `play_prompts.json`); `requirements: {venus: 10}`; `tags: [Tag.PLANT, Tag.VENUS]`; `compatibility: 'venus'` (сверить с другими Венерианскими картами набора — TR24 / TR27);
   `resourceType: CardResource.FLOATER`; `behavior: {addResources: 2}`; `action: {or: {behaviors: [A, B], autoSelect: true}}` (правила 4–5); **`actionPreview` хук** (правило 6 — staged-ветка B, A через
   `addToCardStep` с фильтром метки; `index` 0 / 1, доступность каждой ветки — свой гейт, карта-уровень — `canAct`); `renderData` по скану; `infoText` `action-short` для обоих рядов (образец TR40 `:132`).
   `CardName.ts` (`FLOATING_BIODOMES = 'Floating Biodomes'` после `STRATEGIC_SHIFT`, `:1137`), `TurmoilReduxCardManifest.ts` (после `:314`), `npm run make:cards`, `card_info.json` RU, `turmoil_redux_cards.json`,
   `lore_texts.json` ×2.
2. Роль держателя (решение 5а): `holderRole.ts` — вид `tile`; `holderActionGood.ts:128–138`; читатель `holderRoles.ts`; спеки.
3. `RESOURCES_HERE_SHORT[FLOATER]` — проверить / добавить (`actionReasons.ts:37–53`).

## 2. Клиент — карта (≈ 3 %)
- Композер «Действий карт»: ОДНА плитка, две плитки-исхода; A — шаг «КУДА» (адреса — только карты Венеры с аэростатами, включая себя); B — staged-размещение озеленения с поля (D5 — существующий путь
  `onCardActionsStagedPlacement`), B с поля — возврат в композер со снапшотом; коммит — универсальный ACTION COMMIT (аэростаты уходят с карты в печатную иконку озеленения — PL-104 «вбок»); e2e
  `console-staged-play:317` — образец (Aquifer Pumping).

## 3. Клиент — ГЛАВНОЕ: «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» (≈ 85 %)
### 3.А «ПОДИУМ» (решения 7, 11)
- `ConsoleEndgameWorkspace.vue` ряды `:80–198` → композиция подиума: герой (лицо корпорации — `CardName` корпорации уже в модели игрока; `PremiumCard` lightweight / `ConsoleCardFaceLite` с артом; куб;
  имя; итог — `ConsoleVpBadge`; медальоны — `ConsoleScoreDisc` по `SCORE_CATEGORY_TABLE`; лента), места — ряд лиц; полоса подсчёта под лицом; дуга — сцена; токены плотности `--n2…--n5` переописать под
  подиум (n2 — дуэль); VM — RE-PROJECTION (`:31` — ни одного числа, которого нет в `victoryPointsBreakdown`); `measureTrack` / `buildRowGeometry` переживают новую геометрию (гард `consoleEndgameLayout.spec`);
  «five players one screen, no scroll» — гард 4K остаётся; бот — профиль бота (`endgame-overview.md:123`) с его лицом корпорации (MarsBot-корпорации — свои сущности, лицо даёт человеческая карта за ней —
  `docs/claude/marsbot-corporations.md`).
- Пробник долей ДО / ПОСЛЕ: герой ≥ трети высоты проёма, низ содержимого ≥ 85 %, пустота ≤ трети — таблица в реестре; три макета (`addStyleTag`) — в батч ПЕРВЫМ.

### 3.Б «СЧЁТ ТЕЧЁТ» (решение 8)
- Директор `consoleEndgameDirector.ts` — те же такты `CEREMONY_MS`, та же одна таймлайн, те же `onCount` к абсолютным целям; на такте категории — жетон категории из рельса в ячейку каждого места
  (`flyMaVp` / `vpShareLedger` — язык TR55; holds — существующий `winnerHold` / safety-net `:329–349`), медальон загорается на посадке, полоса растёт синхронно; `rankFlip` — FLIP мест с лицами; пропуск X —
  `finalizeCeremony` снимает всё в конечное состояние одним кадром (как сейчас); reduced motion — снапы; закон «ничего не меняется одним кадром» вне пропуска (`polish-direction-smoothness`).
- Чемпион кампании (`:118`) — поверх подиума, его такты и стили (`console_endgame.less:960–1127`) без изменений по смыслу; e2e `console-campaign-endgame` зелёный.

### 3.В «ОБЗОР В МАСШТАБЕ» (решение 9)
- «Счёт»: табло с медальонами и лицами (`ConsoleOvTabScore.vue:30–53` матрица → табло; дорожки 0,8rem → в масштабе сцены; контекст-зона 7,6rem → по содержимому); «Игроки»: карточка с лицом
  (`OvPlayerCard.corporation` → `CardName` в `consoleOverviewModel.ts:862`; ДиН — медальоны `ConsoleScoreDisc` вместо `maText` `:63–67`); оверлей-контракт обзора (две слоя, парковка без `display`,
  `paneStage` двухфазный, `revealed[tab]`) — без изменений; «five chips» (e2e `:469`) и «no scroll / no clipped names» — остаются.

### 3.Г «ПРОФИЛЬ TV» (решение 10)
- Блок `con-profile-tv` в `console_endgame.less` / `console_endgame_overview.less` (или в `console_tv.less` — согласовать с соседом по блоку стола): токены плотности, кегли ≥ пола; e2e-пробник
  эффективного кегля; Deck — своя ступень (лестница `:1130–1154` остаётся).

## 4. Лицо, локаль, лор, арт
`renderData` по чтению скана; `description` слово в слово; RU-кураторство `card_info.json` («Требуется Венера 10 %. Добавьте на эту карту 2 аэростата.»; строки действий «Заплатите 1 растение: аэростат на
любую карту Венеры» / «Потратьте 3 аэростата отсюда: озеленение и +1 кислород» — формы `card_info.json:27, 478`); титулы ветвей — новые ключи; лор / арт — решения 2–3; новые строки финала (подписи
подиума, медальонов) — английские ключи (grep ДО), RU чужих не переписывать; глоссарий финала — «ПОБЕДИТЕЛЬ», «ПО», «РТ» как есть.

## 5. Тесты
1. `tests/cards/turmoilRedux/FloatingBiodomes.spec.ts` — правила 1–10 (требование Венеры; розыгрыш 2 аэростата; A — цель с фильтром метки, себя включая, без растений — причина; B — озеленение + кислород ОДИН
   раз, при максимуме кислорода — тайл без подъёма, РТ Redux озеленения, нет клетки — `PLACEMENT`, 2 аэростата — PL-197; обе живы → `OrOptions`; превью — две ветки, B staged, паритет; роль держателя;
   Dirigibles платят за TR69; save / load; чистота превью).
2. Гарды зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `requirementProse`, `effectExtraction`, `premiumCardViewModel`, `premiumCardIcons`, `effectForecastCoverage`,
   `countedPlayForecast`, `actionFutility`, `actionBranchPrinted`, `actionBranchAvailability`, `stagedPlacementParity` (секция ACTION — TR69), `resourcesHereReason`, `holderActionGood`, `holderRoles`,
   `readingParamsGuard`, `glyphLiteralGuard`, `e2eLiveness`, `consoleTvTypeFloor`.
3. Клиент (финал): `consoleEndgameLayout.spec` (новая геометрия, `measureTrack`), `consoleEndgameCeremony.spec` (такты + жетоны: пропуск — всё на местах, reduced motion), `consoleEndgameModel.spec` (без
   новых чисел — RE-PROJECTION), `consoleOverviewModel.spec` (`corporation: CardName`, медальоны ДиН), `consoleOverviewBot.spec`, `consoleEndgameSeal.spec` (граница не тронута).
4. e2e `tests/e2e/console-floating-biodomes.spec.ts` (fhd + tv4k): **A** ветка A — «КУДА» с двумя держателями Венеры (себя включая), коммит; **B** ветка B — staged: A в композере → поле при нетронутом
   `gameAge` → B → композер восстановлен → клетка → ОДИН POST → озеленение + кислород +1 (сервер), журнал; **C** обе мертвы — причины в порядке; **D** максимум кислорода — тайл есть, кислород нет.
   e2e `tests/e2e/console-finale-podium.spec.ts` (fhd + tv4k + deck): **A** итоги 5 игроков — герой ≥ трети высоты, низ ≥ 85 %, пустота ≤ трети, ни одного текста ниже пола вне `.pcard`, без прокрутки, пять
   мест; **B** 2 игрока — дуэль; **C** подсчёт — раскадровка пробником (жетон на каждом такте категории, ячейка тикает на касании, `rankFlip` — FLIP, пропуск X — конечное состояние одним кадром, ничего не
   меняется одним кадром вне пропуска); **D** обзор «Счёт» / «Игроки» — низ ≥ 85 %, пять медальонных колонок, лица; **E** бот и кампания (чемпион) — без регресса; **F** скрытый счёт — открывается только здесь;
   **G** reduced motion.
5. Перевести в том же диффе: `console-endgame` (`:108`, `:314`), `console-endgame-overview` (`:265`, `:469`), `console-endgame-boundary`, `console-campaign-endgame`, `console-parliament-results-honesty`
   (если читает финал), харнесс `consoleEndgameHarness.ts` (`finaleStage`, witness) — `npm run e2e:affected` + grep по `con-eg__row`, `con-eg__bar`, `con-eg__corp`, `con-eg__total`, `con-ovs__`, `con-ovpl__`.
6. `npm run build:test`, `npm run lint`; юниты — на тихой машине, последовательно.

## 6. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**, GPU)
Кадры «до / после» в `screenshots/tr69/{fhd,tv4k,deck}/`: (а) итоги 5 / 4 / 3 / 2 игроков на НАСЫЩЕННОЙ партии; (б) раскадровка подсчёта (≥ 12 кадров: вход → категории с жетонами → переворот мест →
победитель → плашки); (в) пропуск X; (г) бот; (д) чемпион кампании; (е) обзор — «Счёт» и «Игроки»; (ж) скрытый счёт; (з) карта TR69 — композер с двумя плитками, «КУДА», staged-поле, коммит. Пробник
долей ДО / ПОСЛЕ — таблицей в реестре. Каждый кадр — своим глазом: «похоже ли это на финал премиальной игры — кто победил, чем, и как это прозвучало?»; три лучших предложения по подиуму — МАКЕТАМИ
(CSS поверх живой сцены через `addStyleTag`) в батч владельцу ПЕРВЫМ (§7.5).

## 7. ПОЛИРОВКА ПО ПУТИ
1. **PL-608** — факт экономики TR61 (`productionIncome`, `ENDGAME_STORYTELLING.md:34`) без читателя: читатель — вкладка «Игроки» (доход по поколениям) или «Хронология»; если в объём не входит — строка в бэклог.
2. **Бэклог** `weak-visuals-backlog`: № 13 / финал — `DONE (TR69, PL-…)`; предигровые (№ 17 / 22) — дополнить числами подготовки (лобби-диалоги 6 % экрана 4K, создатель 30 % высоты); новые находки — пунктами.
3. **Доки** — `endgame-workspace.md` (§ Presentation modes → подиум; § Ceremony machine — жетоны; Files), `endgame-overview.md` (§ information architecture — «Счёт» / «Игроки»), `ENDGAME_STORYTELLING.md`
   (итерация), `docs/claude/marsbot-corporations.md` — если лицо бота на подиуме потребовало правила.

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — насыщенная фикстура финала + кадры 4K «до» (5 и 2 игрока, обзор) своим стендом + пробник долей / геометрии.
2. Порядок: карта + спек + роль → клиент карты (staged-ветка) → макеты подиума (3 варианта) → А подиум → Б жетоны подсчёта → В обзор → Г профиль TV → e2e → обход «до / после» → реестр / доки. Каждый шаг —
   коммит по ханкам.
3. **Реестр:** footer на выдаче «Следующий свободный номер **PL-626**», последний раздел **BC** (TR65; сосед `terraforming-mars-6e` может дописать в BC и сдвинуть footer); TR69 берёт раздел **BD** — букву и
   номера объявлять В МОМЕНТ записи по текущему footer.
4. Документы: `docs/TURMOIL_REDUX_FLOATING_BIODOMES.md` (карта + § «ВЕТКА-ТАЙЛ ИЗ КОМПОЗЕРА» (декларация + staged-хук, роль-тайл) + § «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» — подиум, жетоны, обзор, профиль TV, доли
   до / после, что не ломать, кадры) + правки доков §7.3 + закон в `.claude/rules/console-ui.md` («THE FINALE IS A CEREMONY — the winner is the hero (a corporation face, a cube, the score cell, the
   medallions), the places are faces on the horizon, the count ARRIVES as tokens, the bar is the counting instrument under the face; the overview's Score and Players tabs show the same objects at scene scale;
   the finale carries a TV profile») + строки в чеклист §4 («`or`-действие с веткой-ТАЙЛОМ — декларация + `actionPreview` со `stagedActionPlacement` (CometAiming), паритет; `greenery` поднимает кислород
   САМ — `global` не добавлять»; «товар держателя `tile`») + запись в журнале.
5. Отчёт владельцу: первой строкой — арт; затем кадры 4K «до / после» итогов (5 и 2 игрока) и раскадровка подсчёта, таблица долей, решения 1–11 с тем, что сделано по умолчанию, ОДИН батч
   `AskUserQuestion` (решения 7 (с макетами), 8, 9, 11 — рекомендация первой; 1–6, 10 — в отчёте по умолчанию), гэпы честно.
6. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Добавлять `global: {oxygen: 1}` к ветке B (двойной подъём); ставить озеленение живым промптом после коммита, если принято staged; считать кандидатов цели на клиенте (только `SelectCard` сервера с
  `restrictedTag`); авто-выбирать цель при одном держателе.
- Считать очки в VM финала (только RE-PROJECTION `victoryPointsBreakdown`); показывать скрытый счёт раньше финала; парковать `.con-eg` через `display`; `setTimeout` вместо holds директора; менять число
  одним кадром вне пропуска X; ломать три аудированные регрессии § STABILITY, границу-teardown, «Свернуть» / free roam, дорогу обратно, такт чемпиона; прокрутку при 5 игроках на 4K; второй залп.
- Шрифт ниже пола TV вне `.pcard`; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); состояние только цветом; `filter` / `text-shadow` на состоянии.
- Трогать разбор хода бота (реворк — вне полировок); трогать файлы соседа (`played/**`, `console_played.less`, блок стола в `console_tv.less`, раздел BC реестра); переписывать RU чужих ключей; ломать селекторы
  стендов без перевода в том же диффе; полный regen фикстур; `git stash`; bare `git push`.
