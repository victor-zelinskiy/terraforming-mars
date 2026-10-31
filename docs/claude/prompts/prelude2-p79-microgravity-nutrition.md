# Промт исполнителю · P79 Microgravity Nutrition («Космическое питание») — СЕМНАДЦАТАЯ карта Prelude 2, не политическая, Colonies (`docs/PRELUDE2_ADAPTATION.md` §3.1, форма 3 → 1 — BESPOKE-РОЗЫГРЫШ, который становится ДЕКЛАРАТИВНЫМ): зелёная (автоматическая), 11 M€, метки Микроб + Растения, 1 ПО; «+1 произв. M€ за каждую вашу колонию» — `bespokePlay` руками (`getColoniesCount` → `production.add`) там, где форк уже имеет декларацию СО СЧЁТНЫМ БАЗИСОМ (`production: {megacredits: {colonies: {colonies: {}}}}` — Ecology Research, Cassini Station; класс CR P85 / P71: плита руки «[произв. M€] +N», «РАСЧЁТ» с термином колоний). Карта — ≈ 15 % · ПОЛИРОВКА (≈ 85 %) — владелец, 2026-10-31 (кадр `sm_mars_sreenshots/20261031221501_1.jpg`): **«большая итерация доработки R3 "Сработает" на розыгрыше прологов — убрать из центра экрана, сделать компактную и лаконичную подачу внизу и доработать бесшовное переключение на осмотр (R3)»**: на экране «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ» ответ стола стоит ДВАЖДЫ — под картой очереди в центре экрана («Можно разыграть ⚡ [+2] R3» — строка чтения DE) и в полосе статуса внизу («⚡ Сработает: [+2] R3»); R3 открывает слой «ЭФФЕКТЫ», который разворачивается ИЗ НИЖНЕЙ полосы, а очередь гаснет до 16 % и полка исчезает — вместо «той же сцены на уровень глубже»

> **Статус: ВЫДАН 2026-10-31.** HEAD `e2eb1484cd` (P77 СДАНА — раздел **DH**; ворклист **16 / 54**; журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись СЕМНАДЦАТАЯ).
> **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты (композиция — тоже, §4); `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> ⚠ **СОСЕДИ** (`ListAgents`: `terraforming-mars-45`, `-5b` — заняты). В момент выдачи ГРЯЗНЫ: **`ConsoleStartScene.vue`** (+36 строк — полевая починка директора старта, фаза 2), `startDirector.ts`, `ConsoleShell.vue`,
> `tests/e2e/consoleStart.ts`, `generate.ts`, `timingSpecs.ts`, `tests/console/startDirector.spec.ts` + вся ветка «standing» Парламента (`ConsoleParliamentVoteMode.vue`, `voteInfoModel.ts`, `ConsoleLawStanding.vue`,
> резолюции, фикстуры `parliament-standing-*`). **`ConsoleStartScene.vue` — ТВОЙ ГЛАВНЫЙ файл: начинать §4 ТОЛЬКО когда его диф соседа закоммичен** (`git status` чист по нему) — до того: карта (§1–§2),
> фикстуры (объявленный ханк `generate.ts`), свидетель «ДО» на HEAD, чистые модули (`startQueueLayout.ts`, `effectForecastModel.ts` — проверить, не грязны). `SendMessage` занятым: список файлов §0, просьба назвать
> момент коммита `ConsoleStartScene.vue`. `package.json` / `package-lock.json` (`MM`) — не твои.
> Промты-образцы: `prelude2-p85-summit-logistics.md` (класс CR — базис счёта, термин колоний «только при Colonies»), `prelude2-p71-colonial-representation.md` (счёт колоний: тайл с двумя своими кубиками — 2),
> **`prelude2-p47-corridors-of-power-redux.md` § 4** (сдан как DE — «развёртывание прологов одним взглядом»: солвер `startQueueLayout`, строка чтения `[data-qcard-reading]`, сокет полки, героиня `scale 1.06` — ЭТО
> ТА СЦЕНА, которую ты продолжаешь; её решения не откатывать, а ДОВЕСТИ: строка чтения стала вторым местом ответа стола), `prelude2-p73-floating-refinery.md` § 4 (грамматика «значение громче подписи», «коммит —
> плита»), `docs/claude/console/effect-forecast.md` (законы 1–9: «каждая поверхность, рисующая ответ стола, — ДВЕРЬ»; «слой — УРОВЕНЬ ВНУТРИ хоста, никогда своя поверхность»; «ничего больше не движется»),
> `docs/claude/console/start-first-action.md` §§ «THE QUEUE'S PRELUDE IS A FORECAST DOOR TOO», «THE DEPLOYMENT AT ONE GLANCE», `docs/claude/console/effects-explorer.md`, `docs/claude/console/start-flow-motion.md`.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P79.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\Microgravity Nutrition.png` (в `Downloads` корнем, как P68 / P77).
> Лор — СО СКАНА, дословно: «Stimulating bone and muscle growth to compensate for the effects of low gravity» (без точки — добавить; гард лора); ключа `P79` в `lore_texts.json` НЕТ (grep).
> Реестр: последний раздел **DH** (P77), последний номер **PL-1280** → эта задача берёт **DI**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p79` → `npm run e2e:remote -- p79 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL; сцена — ТРИ профиля
> (fhd · tv4k · deck); переход R3 — запись (`MutationObserver` + `setInterval` 16 мс); раскадровка — TV (`TM_E2E_STORYBOARD=1`).
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 1 и п. 3**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76…P77 — не переоткрывать: термин колоний только при Colonies (P85 CR), счёт колоний
по кубикам (P71), генератор не выводит блок счётного СКЛАДА — но счётное ПРОИЗВОДСТВО проверить отдельно (P75 PL-1158), «развёртывание прологов одним взглядом» (TRP0 DE), лист настройки (P73 DC)),
`docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7, **CLAUDE.md § A WORKSPACE IS ONE FLOW** (условия 1–4: встроено, непрерывная крошка, «та же фраза на уровень глубже» — RELEASE → UNFOLD → REVEAL, B — один
уровень; «frame, band, rail and the carried card do not move»), § HEADER grammar, `.claude/rules/console-ui.md` § A STATUS LINE NEVER REPEATS THE FACE («before a polish adds a fact to any line, name the zone of
the screen that already shows it»), § VISUAL RESTRAINT, § PAD OWNERSHIP FOLLOWS THE SURFACE, § THE WORKSPACE BAND (тайминг чужих токенов), `.claude/rules/animations.md` (одна система движения, холды),
`docs/CONSOLE_SURFACE_MOTION.md` (`workspaceDescend` — RELEASE / RECEDE / UNFOLD / CASCADE), CLAUDE.md инварианты 4, 5, 6, 12, 14, 15. Память: `rules-first`, `upstream-spec-encodes-upstream-rules`,
`e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `start-polish-reliability-1` + `field-opening-index` (директор старта — фазы 1–2 ДЕЙСТВУЮТ: защёлки и директора не трогать), `commit-at-end-of-work`,
`push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `twin-session-continuation`, `trivial-card-prompts-no-owner-questions`, `visual-restraint-no-glow`, `prelude2-adaptation`.

**Образцы — по частям.** Карта: `prelude2/MicrogravityNutrition.ts` (AUTOMATED, 11, `[MICROBE, PLANT]`, `victoryPoints: 1`, `bespokePlay` → `getColoniesCount` → `production.add(M€, N, {log: true})`, рендер
`production(megacredits(1).slash().colonies(1, {size: SMALL}))`, `description` — RU есть `ru/cards.json:700`), манифест `Prelude2CardManifest.ts:76` (`compatibility: 'colonies'` — политического маркера НЕ нужно),
RU-имя «Космическое питание» (`:699`). Декларативные образцы: **`colonies/EcologyResearch.ts:25`** (`production: {plants: {colonies: {colonies: {}}}}`), `pathfinders/CassiniStation.ts:21` (`energy … all`),
`prelude2/ColonialRepresentation.ts:18` (счётный склад, P71 — спек-форма Redux-таблицы с колониями), `behavior/Counter.ts:247–256` («THE ONE reading of the player's own colonies»), `models/actionPreview.ts:424–470`
(`countableBasis` — термин колоний; `:691` — счётное ПРОИЗВОДСТВО несёт `basis`), `Player.getColoniesCount` (`Player.ts:816`). Сцена: **`ConsoleStartScene.vue`** — очередь `:445–510` (`__qcard`, пилюля A `__slot-a` `:478–490`,
**строка чтения `__qread` `:491–505`**: вердикт + `ConsoleForecastRow` (`queueAnswerShown` — `forecastRowPresent`) — ЭТО «центр экрана» с кадра владельца), **полоса статуса `:956–990`** (`__statusrail` → `__status-inner`:
имя · состояние · **`__status-answer [data-start-prelude-forecast]` → `ConsoleForecastRow @open=openQueueForecast`** — ЭТО «внизу»; `con-forecast--descend` пульс), комната слоя `:690–700` (`__fxhost [data-forecast-host]` →
`ConsoleForecastLayer host="start"`; комната позиционирована ПОД первое действие: `left: calc(var(--con-fa-seat-w) + 3.4rem)` — `console.less:29225`), класс корня `con-start--queuefx` (`:16` — `firstActionFxOpen &&
!firstActionPanelShown`; стили `console.less:29391–29400`: очередь `opacity .16`, полка `opacity 0`), `queueForecastCard / queueForecast / queueForecastShown / queueForecastCanOpen / startForecast / startFxStage`
(`:3046–3090`), `openQueueForecast` (`:8547` — `armForecastRow` по `[data-start-prelude-forecast]` → `openForecastHost('start', …)`), бар `queueEffects` (`:4190`), `forecastHostIntent` (`:5853`), `queueReadingText /
queueAnswerShown` (`:5187`); чистые: `console/startQueueLayout.ts` (`startQueueLayout`, `startQueueReading :102` — вердикт), `console/effectForecastModel.ts:193` (`compactForecastChips`), `:432–446`
(`forecastLayerAvailable` / `forecastRowPresent`), `console/consoleForecastHost.ts:71–120` (`openForecastHost`, `pulseForecastDoor`, `foldForecastHost`, `forecastHostIntent`), **`console/consoleForecastFocusMotion.ts`**
(фраза: RELEASE строки 120 → RECEDE колонки 170 → UNFOLD панели из прямоугольника строки 280 @70 → CASCADE зон 175; обратно — FOLD 200; `browseOf` = `[data-forecast-browse]` хоста, `rowOf` = `[data-forecast-row]`
хоста; `unfoldedFrom`), компоненты `ConsoleForecastRow.vue` (чипы + глиф R3; `--bare` без подписи), `ConsoleForecastLayer.vue` (`.con-fxlayer` absolute в хосте, `.con-fxpanel`), `ConsoleEffectsExplorer.vue` (режим
`forecast`: фильтры `con-efx__filters`, список, досье `con-efx__detail`), стили `console.less:34275–34300` (`.con-fxlayer`, `.con-fxpanel`), `:28859–28930` (`__qread`, `__slot-a` после solved), `effects_overlay.less`.
Стенды: **`console-start-queue-scene.spec.ts`** (DE: размер из коробки, строка под каждой, героиня, сокет), **`console-proteus.spec.ts:107–200`** (A: «Сработает» на полосе статуса, R3 → слой, крошка «· ЭФФЕКТЫ», B
складывает), `console-titan-holdings.spec.ts:163`, `console-lotus-innovations` (первое действие — `[data-start-firstact-forecast]`), `console-corridors-of-power.spec.ts:130` (`[data-qcard-reading]`),
`console-effect-forecast.spec.ts:212` (эталон фразы в композере: строка → слой → досье → назад, no-scroll), `console-forecast-doors.spec.ts` (двери колоний / стандартных проектов), `console-start-motion`,
`start-scene-profiles`. Хуки сцены и дверей читают **≥ 21 спек** (`data-start-prelude-forecast` 5 · `data-qcard-reading` 2 · `data-forecast-*` 20+) — контракт 14. Кадры: владельца (выше), `screenshots/proteus/tv4k/A-01-second-prelude.png`
(дверь), **`A-02-layer.png`** (слой открыт: панель по центру, очередь погасла, полка исчезла), `screenshots/effect-forecast/tv-4k/2-layer-groups.png` (эталон слоя в композере).

---

## Диагноз (подтверждён файл:строка на `e2eb1484cd`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, форма — bespoke без базиса.** `bespokePlay` считает колонии сам; превью розыгрыша — проверить: гард `cardPlayPreviewCoverage` (bespoke без `cardPlayPreview` — красный или в исключениях); плита руки
   «[произв. M€] +N» и «РАСЧЁТ: колонии N» — только у декларации (`countableBasis` на `production` — `:691`). Декларация `production: {megacredits: {colonies: {colonies: {}}}}` байт в байт воспроизводит
   `getColoniesCount` (Counter `:253` — «THE ONE reading»); апстримный спек (Луна → +1) — зелёный без правки.
2. **Чтение скана (§0):** «11» — цена; плашки требования НЕТ; метки — Микроб (зелёный круг с микробом) и Растения; зелёная (автоматическая); ряд — коричневая плита производства «[1 M€] / [колония]»; текст «(Increase
   your M€ production 1 step for each colony you have.)»; «P79»; справа — ПО «1» (бурый круг); слева внизу — Prelude 2 · Colonies; лор — курсив.
3. **Что даром (проверить «до»):** ПО-чип «1»; оплата — M€ (ни стали, ни титана); «Сработает» — реакторы на Микроб / Растения в скоупе (Decomposers, Arklight, Viral Enhancers, Ecological Zone — grep `onCardPlayed`
   ∧ `Tag.MICROBE | Tag.PLANT`); журнал «+N произв. M€» с причиной; 0 колоний → «+0» названо (превью — чип «0 → 0 · колоний нет», не молчание; класс P85 — термин колоний есть, Colonies на столе); MarsBot-стол с
   `prelude2Expansion` БРОСАЕТ → карта в руку без опции.
4. **Spec апстрима** (`tests/cards/prelude2/MicrogravityNutrition.spec.ts`): одна колония → произв. 1. Байт в байт.

### Сцена «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ» — ответ стола и R3 (кадр владельца)
- **D1. Ответ стола — ДВАЖДЫ.** Под сфокусированной картой очереди: «Можно разыграть · ⚡ [+2] R3» (`__qread` — строка чтения DE, S2: «вердикт + ответ стола»); в полосе статуса: «⚡ Сработает: [+2] R3». Один факт, два
   места, две кнопки R3 (бейдж глифа дважды). Закон § STATUS LINE нарушен самой строкой чтения — ответ стола УЖЕ стоит в полосе; DE добавила его под карту «чтобы сравнить две прелюдии без фокуса» — но сравнение
   даёт ВЕРДИКТ, а не ответ стола.
- **D2. Центр экрана.** Строка чтения висит под пилюлей A в геометрическом центре полосы (карта очереди центрирована), поверх пустоты над полкой — глаз читает её как плавающую подпись, не привязанную ни к
  карте (зазор `padding-top: 2rem` под пилюлей), ни к полосе.
- **D3. Дверь разворачивается НЕ ОТТУДА.** `openQueueForecast` армирует прямоугольник `[data-start-prelude-forecast]` (полоса СНИЗУ), а панель слоя стоит в `__fxhost` — комнате ПЕРВОГО ДЕЙСТВИЯ (`left: seat + 3.4rem`,
  по центру); UNFOLD идёт из нижней полосы в центр — «фраза на уровень глубже» ломается: поверхность не вырастает из своего прямоугольника, а прилетает.
- **D4. Хост гаснет вместо «парковки на месте».** `con-start--queuefx`: очередь `opacity .16`, полка `opacity 0` (кадр A-02: пустая сцена + панель). В композере фраза — колонка РЕЦЕДИТ в точку нажатия
  (`descendRecede`), герой стоит; здесь `[data-forecast-browse]` у очереди НЕТ (`browseOf` → null — RECEDE пропущен), гасится CSS-классом. Карта-источник ответа (прелюдия) — должна стоять как герой композера.
- **D5. Слой не знает размера сцены.** Панель — на всю высоту `__fxhost` (комната первого действия), очередь под ней; на 4K панель ≈ 60 % ширины, остальное — погасшая сцена.
- **D6. Обратный путь.** B / R3: FOLD в `unfoldedFrom` (нижняя полоса), очередь всплывает CSS-транзишеном 160 мс — две разные системы движения на одной фразе (gsap-таймлайн + CSS opacity).

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Зелёная, 11, Микроб + Растения, 1 ПО, без требования; P79; `compatibility: 'colonies'`; оплата — M€.
2. Розыгрыш → +N произв. M€, N = свои кубики колоний (тайл с двумя своими — 2; `ColoniesHandler.coloniesOf`); 0 → +0, названо.
3. Превью = исполнение (декларативное, read-only): чип «[произв. M€] N → N+K» с базисом «колонии K»; плита руки «+K»; «РАСЧЁТ» — термин колоний; журнал — одна строка.
4. Раздача: Prelude 2 + Colonies (без Colonies — не раздаётся по `compatibility`); save / reload — обычная карта; MarsBot — никогда не играет.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU / текст** — имя и описание оставить (RU есть); лор RU — «Стимуляция роста костей и мышц, чтобы компенсировать последствия низкой гравитации.»
2. **Декларация вместо bespoke** — `behavior: {production: {megacredits: {colonies: {colonies: {}}}}}`, `bespokePlay` долой; `infoText` — только если `make:cards` не засеет блок счётного производства (проверить; P75 PL-1158
   был про склад). Апстримный `it` — зелёный без правки.
3. **Свой e2e-стенд — ДА**, `tests/e2e/console-microgravity-nutrition.spec.ts`, фикстура `microgravity-nutrition` (рецепт Prelude 2 + Colonies — `generate.ts:10032` / `:10148`; НЕ Redux-обязательный — если рецепт серии
   требует Redux, Colonies там уже есть): p1 — кубики на Луне и Титане (2), 20 M€, P79 в руке; клетки: (1) рука — плита «[произв. M€] +2», РАСЧЁТ «колонии 2»; (2) композер — чип «произв. M€ 0 → 2», ПО-чип; (3) A →
   ОДИН POST → карта в «РАЗЫГРАНО», производство тикает (жетон с печатной плиты производства — PL-001-for-plays / R33), сервер — произв. +2. Второй стол `-zero` НЕ нужен (превью «0» — серверный спек).
4. **«СРАБОТАЕТ» НА РОЗЫГРЫШЕ ПРОЛОГОВ — ОДНО МЕСТО ВНИЗУ, ОДНА ФРАЗА НА УРОВЕНЬ ГЛУБЖЕ** (§4 — композиция ПРИНЯТА, исполнять).
5. **Журнал серии / доки / реестр** — §7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача.

## 0. Рабочее дерево
1. `git log --oneline -3`; `ListAgents`; `git status`. `SendMessage` занятым: твои файлы — карта (`prelude2/MicrogravityNutrition.ts`, спек, `prelude2Adaptation.ts` — одна строка, арт P79, `lore_texts.json` — одна строка,
   `ru/{lore_texts,console}.json`, `src/genfiles/*`), сцена (**`ConsoleStartScene.vue` — ТОЛЬКО блоки `__qread`, `__statusrail`/`__status-answer`, `__fxhost`, корневой класс `--queuefx`, методы `openQueueForecast` /
   `queueForecast*` — ПОСЛЕ коммита соседа**; `console.less` — блоки `con-start__qread`, `--queuefx`, `__fxhost`, `__status-answer`, `.con-fxlayer` в хосте `start`; `console_tv.less` — их строки),
   `console/consoleForecastFocusMotion.ts` (параметризация фразы для хоста без browse-колонки — если нужна), `console/consoleForecastHost.ts`, `console/startQueueLayout.ts` (`startQueueReading`), `effectForecastModel.ts`
   (если компактная форма строки — новая функция), фикстуры (`generate.ts` — объявленный ханк), стенды, доки, журнал, реестр. **НЕ трогать**: директора старта (`startDirector.ts`, `startStageDirector`,
   `startBoardExcursion`), защёлки, teleport сводки, FLIP стадий, полёты на полку, сцену первого действия (`__firstact` и его дверь — `openFirstActionForecast`: та же комната, но свой хост-кейс; трогать ТОЛЬКО если
   §4 переносит комнату для обоих — тогда объявить), композеры.
2. e2e — только бокс; `FIXTURES=microgravity-nutrition npm run e2e:fixtures` (имя в `FixtureName` ДО сборки); сцена — фикстуры DE / Proteus (`console-start-queue-scene`, `console-proteus` A) — без новых; `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 10 %)
- `MicrogravityNutrition.ts`: декларация (решение 2); лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P79.png" P79` → `make:cards`); строка `MICROGRAVITY_NUTRITION` долой;
  `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт; новый `describe`: правила 1–4 — 0 / 1 / 2 колонии, тайл с двумя своими кубиками — 2, превью с базисом «колонии» (read-only), плита руки, журнал одна строка, раздача
  без Colonies — нет, MarsBot-стол (карта в руку), save / reload.

## 2. Клиент — карта (≈ 5 %)
Даром после решения 2: плита руки, РАСЧЁТ, жетон производства с печатной плиты. Дыры — строка реестра + правка в общем слое.

## 3. «ДО» — первым делом (на HEAD, до правок сцены)
Свидетель (§4.6) + раскадровка ×3 профиля на стендах DE / Proteus / Titan Holdings (ответ стола на корпорацию) / Lotus (первое действие — контроль, что его дверь не трогается): (а) очередь с ответом стола — где
стоят строки ответа (две?), их прямоугольники; (б) запись перехода R3: откуда UNFOLD (прямоугольник `unfoldedFrom`), что гаснет (очередь / полка — opacity по сэмплам), сколько кадров панель «прилетает» из полосы в
комнату, где стоит панель относительно карты-источника; (в) B — обратная фраза, кадры с двумя системами движения; (г) deck — то же. Таблица «ДО» — база для «ПОСЛЕ».

## 4. ГЛАВНОЕ — «СРАБОТАЕТ» НА РОЗЫГРЫШЕ ПРОЛОГОВ: ОДНО МЕСТО ВНИЗУ, ОДНА ФРАЗА НА УРОВЕНЬ ГЛУБЖЕ (решение 4)
**Цель (владелец):** убрать ответ стола из центра экрана; внизу — компактная лаконичная подача; R3 — бесшовное переключение на осмотр эффектов и обратно. Закон: ответ стола стоит на сцене ОДИН раз, в полосе внизу;
слой «ЭФФЕКТЫ» — та же сцена на уровень глубже: вырастает ИЗ полосы ВВЕРХ в пространство очереди, карта-источник (сфокусированная прелюдия) СТОИТ как герой композера, крошка получает хвост «· ЭФФЕКТЫ», B / R3 —
обратная фраза тем же таймлайном. Ничего сверх: ни новых слов, ни второго числа, ни света.
1. **ОДНО МЕСТО (D1, D2).** Строка чтения под картой (`__qread`) теряет `ConsoleForecastRow`: под каждой картой остаётся ТОЛЬКО вердикт словом (DE S2 сохраняет сравнение «можно / сгорит / сначала X»); ответ стола —
   ТОЛЬКО в полосе статуса (`__status-answer`), для сфокусированной карты. `queueAnswerShown` → всегда false / удалить вместе с `__qread-answer`; `console-start-queue-scene` (б) и `console-corridors-of-power:130`
   перенацелить на «вердикт без чипов» в том же диффе. Если у карты НЕТ вердикта и нет ответа — строки нет (и пустая коробка не рендерится; солвер резерв под строку держит — геометрия DE не меняется).
2. **КОМПАКТНАЯ ПОДАЧА ВНИЗУ (D1).** Полоса статуса — одна строка из трёх зон: имя карты (слева, как есть) · состояние («Можно разыграть» — как есть) · ответ стола (справа): кикер «⚡ СРАБОТАЕТ» тихими tracked-caps
   (кегль кикера строки чтения), чипы — `ConsoleForecastRow --bare` (без подписи; подпись — кикер), глиф R3 — ОДИН, на правом краю полосы, после чипов (`GamepadGlyph stickR` — как сейчас в строке). Число чипа —
   громче кикера (≥ 1.4 ×). Высота полосы — не меняется (`--con-ws-foot-h`-семья: полоса фиксирована, одна строка с многоточием ТОЛЬКО у имени карты — чипы и глиф не режутся; при нехватке ширины ответ
   сворачивается в «⚡ +N» одним чипом с глифом, никогда не исчезает молча). Пульс двери `con-forecast--descend` — остаётся ТОЛЬКО на этой строке.
3. **ДВЕРЬ РАСТЁТ ИЗ ПОЛОСЫ ВВЕРХ (D3, D5).** Комната слоя для ОЧЕРЕДИ — не `__fxhost` первого действия, а своя: `[data-forecast-host]` на колонке очереди (`__queuecol`) с панелью `.con-fxlayer`, чей нижний край = верх
   полосы статуса, а верх = верх колонки очереди (панель занимает пространство ОЧЕРЕДИ, не всю полосу; ширина — как у сетки очереди, центр по центру очереди); UNFOLD — из прямоугольника строки ответа в полосе
   (`armForecastRow` по `[data-start-prelude-forecast] [data-forecast-row]` — уже так) ВВЕРХ в эту панель; полоса статуса СТОИТ (её строка ответа — RELEASE содержимого, как в композере, и возвращается на FOLD).
   Первое действие (`__firstact`) сохраняет свою комнату `__fxhost` и свой хост-кейс — `startForecast` / `startFxStage` уже различают двери; `ConsoleForecastLayer` — ОДИН инстанс, но его контейнер выбирается
   по двери (teleport в комнату двери или два места монтирования с `v-if` по двери — выбрать то, что не ломает `forecastHostIntent` / `effectForecastOpen('start')`; одна открытая панель на сцену).
4. **ГЕРОЙ СТОИТ, ОСТАЛЬНОЕ ПАРКУЕТСЯ НА МЕСТЕ (D4).** Грамматика композера: сфокусированная прелюдия (карта-источник ответа) НЕ гаснет — она стоит слева от панели как герой (`data-forecast-hero` на её слоте:
   панель открывается правее неё в пространстве очереди; на одной карте — панель справа от неё; при 3–4 картах — несфокусированные паркуются `descendRecede` в точку нажатия / свою позицию, как колонка композера,
   через `[data-forecast-browse]` на обёртке НЕсфокусированных карт — либо параметризовать `browseOf` для хоста `start`: «все `.con-start__qcard` кроме `--focused`»); полка «РАЗЫГРАНО» — не исчезает (её
   прямоугольник — цель полётов), а паркуется тем же RECEDE в своё место (opacity ≤ .16 через gsap в том же таймлайне — не CSS-класс `--queuefx`; класс остаётся как маркер состояния для стилей без транзишенов).
   `con-start--queuefx` — больше не несёт `transition` (одна система движения: таймлайн `consoleForecastFocusMotion`). Крошка — хвост «РОЗЫГРЫШ · ЭФФЕКТЫ» (как есть).
5. **ОБРАТНО — ТЕМ ЖЕ ТАЙМЛАЙНОМ (D6).** B / R3: CASCADE-out зон → FOLD панели в прямоугольник строки → RETURN припаркованных карт и полки (`descendReturn`) → строка ответа возвращает содержимое; герой не двигался.
   Фокус после возврата — на той же карте; пилюля A и вердикты — на месте в каждом сэмпле. Уход сцены / смена стадии при открытом слое — `foldForecastHost('start')` мгновенно (как есть).
6. **СВИДЕТЕЛЬ** — НОВЫЙ `tests/e2e/console-start-forecast-door.spec.ts` (FUNCTIONAL, ×3 профиля; фикстуры DE «две прелюдии» + Proteus A (ответ стола у второй прелюдии) + Titan Holdings (ответ у корпорации)):
   (а) на сцене РОВНО ОДИН `[data-forecast-row]` и ОДИН глиф R3 (`[data-forecast-row] .con-forecast__key`), оба — внутри `[data-start-prelude-forecast]`; под картами — нет `.con-forecast`; (б) полоса статуса: высота
   постоянна до / во время / после слоя; имя · состояние · ответ в одной строке, ответ правее состояния, глиф — последний элемент; (в) запись R3: первый кадр панели — внутри прямоугольника строки ответа (UNFOLD
   оттуда), последний — панель над полосой в пространстве очереди (низ панели ≤ верх полосы + 2 px, верх ≥ верх колонки очереди − 2 px); сфокусированная карта — тот же прямоугольник в каждом сэмпле (±1 px) и
   `opacity ≥ .95`; несфокусированные и полка — `opacity ≤ .2` к концу фразы и обратно ≥ .95 после B; ни одного CSS-транзишена opacity на `.con-start__queue` / `.con-start__played` (computed `transition-property`
   без opacity); (г) крошка «· ЭФФЕКТЫ» ровно пока слой стоит; бар — команды слоя; (д) B → всё в исходных прямоугольниках (±1 px), фокус на той же карте, 0 POST; (е) первое действие (Lotus) — его дверь и комната не
   изменились (регрессия в том же свидетеле); (ж) `expectFits`, пол ТВ-типографики, ноль ореолов. ПЕРВЫМ ДЕЛОМ — «ДО»: (а), (в) ДОЛЖНЫ быть красными (иначе переписать свидетель, не правку).
7. **ЧЕГО НЕ ДЕЛАТЬ.** Не менять содержание слоя «ЭФФЕКТЫ» (`ConsoleEffectsExplorer` — общий, DC / CN); не трогать комнату и дверь первого действия сверх §4.3; не менять солвер DE (размер карт, сокет, героиню
   `scale 1.06`); не трогать директора / защёлки / teleport / FLIP стадий; не переименовывать хуки (`data-start-prelude-forecast`, `data-forecast-*`, `data-qcard-reading`, `con-start--queuefx`) — удалённый
   `__qread-answer` переводится в спеках тем же диффом; не добавлять в полосу фактов лица (цена, метки, ПО).

## 5. Тесты
1. Спек карты; гарды: `Prelude2CardsHeldBack`, `premiumScope`, **`cardPlayPreviewCoverage`** (декларативная — покрыта), `cardInformation` (блок счётного производства), `premiumCardViewModel`, `cardLore`,
   `crossPlayerCoverageGuard`, `glowRestraintGuard` (ратчет `console.less` не растёт), `consoleTvTypeFloor`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `universalSiblingSelectorGuard`, `readingParamsGuard`,
   `embeddedSurfaceShadeGuard`, `e2eLiveness`, `tests/client/i18n.spec.ts`; юниты `startQueueLayout.spec` (чтение без ответа стола), `effectForecastModel.spec` (компактная форма, если добавлена),
   `consoleForecastHost.spec` / `consoleForecastFocusMotion` (если параметризованы), `startStageDirector.spec` / `startDirector.spec` — не тронуты и зелёные.
2. `build:server`, `build:test`, `lint` (включая `lint:client`), `make:cards` 0 / 0 / 0, `make:json`; полные `test:server` / `test:client` на тихой машине.
3. e2e: стенд карты; свидетель двери «до / после»; `npm run e2e:affected`; регрессия — **`console-start-queue-scene`** (перенацелен), **`console-proteus`** (A), `console-titan-holdings`, `console-lotus-innovations`,
   `console-corridors-of-power`, `console-start-motion`, `start-shelf-art`, `console-start-summary-fit`, `console-prelude-burn-gate`, `console-start-prompt-pad`, `start-scene-profiles`, `console-effect-forecast`
   (эталон фразы — не тронут), `console-forecast-doors`, `console-aerospace-company`, `console-medical-institute`, канарейка; аннотация `build` у красного (сосед коммитит в тот же файл — STALE ≠ твоё).

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p79/tv4k/`: (а) рука — плита «+2»; (б) композер — чип производства с РАСЧЁТОМ; (в) коммит — жетон производства с печатной плиты; **ДО / ПОСЛЕ** сцены: (г) очередь с ответом стола — одно место внизу,
под картами только вердикты; (д) кадры фразы R3 — 0 / 25 / 50 / 75 / 100 % (панель растёт из полосы вверх, герой стоит, соседи паркуются); (е) слой открыт; (ж) кадры обратной фразы; (з) первое действие (Lotus) —
без изменений; fhd / deck — (г), (е). Своим глазом: «ответ стола — один, внизу, лаконичный? R3 — та же сцена на уровень глубже, карта стоит, панель выросла из строки и вернулась в неё?»

## 7. Полировка по пути / доки
1. Реестр **DI** «P79 · «СРАБОТАЕТ» НА РОЗЫГРЫШЕ ПРОЛОГОВ — ОДНО МЕСТО ВНИЗУ, ОДНА ФРАЗА НА УРОВЕНЬ ГЛУБЖЕ (строка чтения без ответа стола, компактная полоса с одним R3, дверь растёт из полосы в пространство
   очереди, герой стоит — соседи и полка паркуются таймлайном, обратно тем же) · СЧЁТНОЕ ПРОИЗВОДСТВО ПО КОЛОНИЯМ — ДЕКЛАРАЦИЯ» — D1–D6 строками «что было / что стало / где» + находки прохода; номера — по footer.
2. Доки: журнал серии (P79, семнадцатая запись); `PRELUDE2_ADAPTATION.md` (17 / 54; строка); `docs/claude/console/start-first-action.md` §§ «THE QUEUE'S PRELUDE IS A FORECAST DOOR TOO» / «THE DEPLOYMENT AT ONE
   GLANCE» — переписать п. 2 (строка чтения — только вердикт) и абзац двери (комната очереди, фраза); `docs/claude/console/effect-forecast.md` § The surfaces — строка хоста `start` (две комнаты, одна панель);
   `.claude/rules/console-ui.md` — одна строка; память `prelude2-adaptation.md` (17 / 54).

## 8. Режим работы
1. Читать до кода. Порядок: карта (декларация) + спек + строка долой → лор / арт → `make:cards` → фикстура + стенд карты → «ДО» (§3) + свидетель (красный) → [ждать коммит соседа по `ConsoleStartScene.vue`] →
   4.1 → 4.2 → 4.3 → 4.4 → 4.5 → свидетель «ПОСЛЕ» ×3 → регрессия → реестр → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «ДО / ПОСЛЕ» (таблица свидетеля × профили, кадры фразы); POST (один); гарды и `make:cards`; ратчет ореолов; регрессия на боксе (аннотация `build`);
   решения 1–5 (что сделано по каждому); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Оставлять ответ стола в двух местах; второй глиф R3 на сцене; прятать ответ молча при нехватке ширины; факты лица в полосе; второе число / подпись сверх кикера и чипов.
- Разворачивать панель НЕ из прямоугольника строки; гасить хост CSS-классом с транзишеном (одна система — таймлайн фразы); двигать героя, полосу статуса, крошку, бар; менять геометрию полки-цели и сокета;
  `v-if`-моргание; ореол / петля; `title`; литерал кнопки; кегль ниже пола ТВ.
- Трогать `ConsoleStartScene.vue` до коммита соседа; директора / защёлки / teleport / FLIP / полёты старта; дверь и комнату первого действия сверх §4.3; содержание слоя «ЭФФЕКТЫ»; композеры; переименовывать хуки.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; переоткрывать находки P76…P77 и решения DE (кроме названного: ответ
  стола под картой).
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` / `--no-verify`; коммитить чужие файлы
  (`package.json` / `package-lock.json`); пересборку во время прогона e2e на боксе.
