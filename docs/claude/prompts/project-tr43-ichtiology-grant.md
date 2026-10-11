# Промт исполнителю · TR43 Ichtiology Grant («Ихтиологический грант») — зелёная ДЕКЛАРАЦИЯ: «+1 M€-производство за каждый океан в игре» + «2 животных ИЛИ 4 микроба на ЛЮБУЮ карту» (первый в скоупе `or` НА РОЗЫГРЫШЕ с вложенной целью-картой) ≈ 20 % · ГЛАВНОЕ — БОЛЬШАЯ ИТЕРАЦИЯ НАДЁЖНОСТИ PRE-SELECT: выбор, сделанный игроком в композере, НИКОГДА не спрашивается второй раз — адресованный ответ вместо угадывания по типу, гард воспроизведения розыгрыша, свидетель «переспросили» в каждом e2e

Выдан 2026-10-11. Инфраструктура набора стоит (TR01–TR42, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md` (§0 скан + арт, §1 пять точек касания, §4 «бесплатно / требует руки», постоянный **§7**: агент САМ
ищет места доработки; **«Профили»** — TV 4K сперва; **«Бесшовность — workspace-архитектура»**; **«Премиум-планка»** — при карте-декларации полировка =
всё сверх карты; **«Качество полировки»** — сильная рабочая концепция или откат, память `polish-quality-no-regressions`), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,
console-ui,animations,premium-card,tests}.md`, аудит pre-collect — **`docs/claude/action-prompt-audit.md`** (классы 1–7; § CLASS 6 «Residual hazard»
— та самая фраза, которую эта итерация реализует: *«the honest instrument is to make the batch state what each response was collected FOR»*).

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-11, дословно):** «надо очень внимательно дать агенту задачу проработать работу pre-select — сейчас они часто не
работают; пример Sponsored Academies: выбор карты на сброс потом идёт отдельным промтом, хотя был pre-select; подобные примеры встречаются часто и
на других картах; это скорее всего регрессия — либо от каких-то полировок, либо от мержа с upstream; нужна полноценная большая итерация, чтобы
довести механизм до надёжной и всегда рабочей архитектуры без повторных забагованных промтов, когда пользователь уже сделал выбор».
Это — часть II промта и **больше половины задачи**. Карта TR43 выбрана для неё не случайно: её собственный розыгрыш = `or`-выбор + цель-карта,
т.е. два pre-select'а в одном батче, и она первой проходит по починенному механизму. Ревизия ПРОШЛЫХ полировок (`${0}`, полёты из пустоты) — у
другого агента (`docs/claude/prompts/polish-remediation-iteration-1.md`): **не трогать его области** (см. §0).

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, НЕ прогоном — первым делом воспроизвести юнитом, затем расширить на весь механизм):**
1. **Корень Sponsored Academies — `src/server/inputs/deferredInputBatch.ts`, `hiddenInfoPrompt` (≈ :366–386).** С коммита **`186ddae340`
   (2026-09-28, «UI rework», работа над Redux-Венерой)** любой `SelectCard` с маркером `discardPrompt` считается «скрытой информацией»: `replayBatch`
   паркует хвост батча НЕТРОНУТЫМ (`i > 0 && hiddenInfoPrompt` ≈ :112–121), а `drainBatchTail` на том же тесте делает `break` (≈ :186–190) —
   значит **пре-собранный сброс НЕ ПРИЗЕМЛЯЕТСЯ НИКОГДА**: промт `DiscardCards` (`DiscardCards.ts:49–60` → `markDiscardPrompt`) встаёт живым, консоль
   честно обслуживает его экраном руки в режиме сброса (`consoleTaskRouter.ts:91, :295` `handSelect`) — игрок видит «переспросили». Батч Академий:
   `[{projectCard, payment}, {type:'card', cards:[X]}]` (`SponsoredAcademies.ts:58–63` defer `DiscardCards(source: cardSource(this), exchange:
   discardForCards(3))` при `Priority.SPONSORED_ACADEMIES`; превью `:91–104` `selectCardStep` по руке без себя). До 09-28 тот же ответ ложился
   позиционно. **Это НЕ merge с upstream** (синки трогали в батче только `clearWarnings`, память `upstream-sync-2026-06-14`) — это форковая
   полировка одного случая, сломавшая СЕМЬЮ.
2. **Зачем ступень добавили** — Redux-Венера: торговля → бонус владельца «добери 1, затем сбрось 1» (`Colony.ts:727–740`, сброс при
   `Priority.SUPERPOWER` ПОСЛЕ добора). Пре-собранная ЦЕЛЬ награды (`{type:'card', cards:[Dirigibles]}`) встречала сброс: тот же тип → отказ по
   значению → «расхождение» → хвост выброшен (цель переспрошена), а при совпадении имени карта руки СЪЕДАЛАСЬ чужим вопросом. Пин —
   `tests/colonies/VenusRedux.spec.ts:555–576` (парковка цели, `parkedBatchTailLength === 1`, после ручного сброса цель садится). **Чинили правилом
   уровня ВИДА промта («каждый сброс — скрытая информация»), а дефект — в том, что ответ не знает, ДЛЯ КАКОГО вопроса он собран.**
3. **Почему ни один гард не поймал:** `tests/inputs/deferredInputBatch.spec.ts` (секции :92 / :257 / :491 / :846 / :1403 / :1585) — ни одного случая
   сброса; `cardPlayPreviewCoverage` / `consolePlayPreviewCoverage` проверяют ФОРМУ шагов (hostable), но НЕ ВОСПРОИЗВОДЯТ батч против живого
   розыгрыша; `actionPromptCoverage.spec.ts` чек 5 (`churn`, :313–320) гоняет только ДЕЙСТВИЯ; e2e с Академиями нет (`grep` по `tests/e2e/*.spec.ts`
   пуст — только фикстуры); свидетель `armLeakWitness` (`parliamentDrive.ts:295`, 36 спеков) ловит ТОЛЬКО stranded (не обслуженный) промт — а
   переспрошенный сброс ОБСЛУЖЕН, он невидим для детектора по построению.
4. **Структурный корень всей семьи:** батч несёт ответы без заявления, ЗА ЧТО они собраны. Все ступени после первой версии — догадки по ТИПУ
   ответа или ВИДУ промта: `stagedFor` только для `space | party | colony` (`InputResponse.ts:85–108, :138–156, :184–217`; `stagedAddress`
   ≈ :230–240), `hiddenInfoPrompt` для deck-pick и сбросов, `reconcileBatchResponse` (обёртка `or`), `jumpedTheQueue` по `type`. Каждая новая
   карта-класс добавляла ступень, и каждая ступень — новый способ сломать соседей. Остаточная опасность «interloper того же типа» записана в
   аудите ещё 2026-08-28 и так и стоит.

**Обязательное чтение до кода:** `src/server/inputs/deferredInputBatch.ts` целиком (контракт парковки: hidden-info, адресованные ячейки,
baselines, `expireSupersededStagedTail`, `parkBatchTail`, `clearBatchTail`), `src/server/routes/PlayerInputBatch.ts:94–99` + `PlayerInput.ts:
108–122` (`validatePromptId` → `expireSupersededStagedTail` → `process` → `drainBatchTail`), `src/server/Player.ts:2486` (`clearBatchTail` в
`takeAction`), `src/client/console/consolePlayCardComposer.ts:1–100` (контракт батча розыгрыша: `[play, …pre, {or,index,response}, …steps]`),
`:148–235` (`playChoiceMode`: `handPick` / `playedTarget` / `inline` / `repeat` / `followup`), `src/client/console/consoleActionComposer.ts`
(`buildActionBatch`, `ComposerChoice`), `src/client/console/transport/gameTransport.ts:502–513` (`submitBatch` — `promptId` на голове),
`src/client/console/promptSource.ts:1–25` (ЧЕТЫРЕ формы источника промта — клиентский читатель; серверного близнеца нет), `src/server/inputs/
discardPrompt.ts` + `src/server/deferredActions/DiscardCards.ts` (маркер сброса; 7 вызовов: Ender, OldMiningColony, ProjectEden, SponsoredAcademies,
`Colony.ts:727/:887`, ColonialAffairs, ParadigmBreakdown), `src/server/inputs/choiceContext.ts` (`cardEffect`, `colonySource`, `ChoiceContextSource`),
`tests/inputs/deferredInputBatch.spec.ts` (форма пинов), `tests/colonies/VenusRedux.spec.ts:540–580`, `tests/models/actionPromptCoverage.spec.ts`
(чек 5 — образец «превью обещает → живой путь исполняет»), `tests/models/{cardPlayPreviewCoverage,consolePlayPreviewCoverage}.spec.ts`,
`docs/claude/action-prompt-audit.md` § CLASS 6–7, память `action-precollect-contract` (6 классов течи), `precollected-batch-tail-parks`,
`console-hand-pick-bridge`, `stale-prompt-identity-gate`. Для карты: `src/server/behavior/Behavior.ts:42–70, :216–250` (`or`, `addResourcesToAnyCard`,
`OrBehavior {behaviors, autoSelect, title}` — knob'а «необязательный or» НЕТ), `src/server/behavior/Executor.ts:62–68` (ни одной исполнимой ветки
`or` → КАРТА НЕИГРАБЕЛЬНА), `:229–247` (`mustHaveCard` → `getCards().length === 0` → ветка неисполнима), `:328–365` (исполнение `or`: фильтр
исполнимых, 1 + `autoSelect` → `cb(undefined)`, иначе `OrOptions` с `choiceContext 'effect-choice'`), `:573–600` (`addResourcesToAnyCard` → `AddResourcesToCard`,
подъём перед размещением), `src/server/deferredActions/AddResourcesToCard.ts:80–96, :139–175` (`autoSelect: false` для «любой карты»; `getCards` =
СВОЙ стол + SRR, `cardBeingPlayed` только для превью), `src/server/cards/actionPreviews.ts:228` (`addToCardStep`), `:716–734` (`SKIP_REASON.noHolder`,
`skippedAddToCard`), `src/server/deferredActions/skippedEffect.ts:25` (`recordSkippedEffect`), `src/server/models/cardPlayPreview.ts:185–215`
(`deriveCardPlayBranches`: индекс среди исполнимых, `autoResolve` → −1) и близнец `actionPreview.ts:134–160` (`subAvailability`,
`deriveDeclarativeBranches`), `actionPreview.ts:404–412` (чип «+N to a card» только при держателе), `src/server/behavior/Counter.ts:142`
(`oceans` = `getOceanSpaces({upgradedOceans: true, wetlands: true})`), `src/server/cards/pathfinders/HydrogenProcessingPlant.ts:20` (`production:
{energy: {oceans: {}, per: 2}}` — прецедент счётного производства по океанам), `src/server/cards/promo/Vermin.ts:36–53` (`or` с `addResourcesToAnyCard
{mustHaveCard: true}` + `autoSelect: true` — форма; это ДЕЙСТВИЕ), `src/server/cards/turmoilRedux/BiologicalSimulations.ts:1–112` (класс Зелёных,
чтение скана, `requirements: {party: PartyName.GREENS}`; её триггер считает ПО МЕТКАМ — TR43 несёт обе), `src/client/components/console/
ConsolePlayCardConfirm.vue:109` (хост `ConsolePlayedTargetStep` при `sub.kind === 'playedTarget'`), `:3236–3238, :3413` (спуск в hand-pick / played-target),
`src/client/console/consolePlayCardComposer.ts:608` (`variantGroupNav` — ряд вариантов ветки), `tests/e2e/console-biological-simulations.spec.ts:1–50`
(розыгрыш с руки + ответ стола летит — (A)), `tests/e2e/console-self-target.spec.ts:1–60` (геометрия шага цели), `tests/e2e/fixtures/generate.ts:
1267–1295` (фикстура Зелёных по стартовому правилу; `addOcean` импортирован `:30`), `scripts/import-card-art.mjs` (шапка — импорт арта по ключу),
`assets/text/lore_texts.json:543` («TR42»), `src/locales/ru/turmoil_redux_cards.json:159`. Память: `turmoil-redux-biological-simulations`,
`turmoil-redux-forestry-mechs` (`or`-декларация), `polish-premium-bar`, `polish-seamless-workspace-architecture`, `polish-quality-no-regressions`,
`tr-prompts-carry-polish-budget`, `owner-batches-pending-polish-decisions`, `git-temp-index-race`.

Номера строк сняты с `2c2d88c6c1` — перед правкой перечитать.

**Что это за карта.** Зелёная (AUTOMATED), **10**, метки **микроб + животное** (два кружка справа: светло-зелёный с микробами и тёмно-зелёный с
лапой), требование **Зелёных** (плашка у цены — класс TR15 / TR38), без ПО: *«Requires the Greens to be ruling or that you have 2 delegates there.
Increase your M€ production 1 step for each ocean in play. Add 2 animals or 4 microbes to ANY card.»* Декларация в три строки: `production:
{megacredits: {oceans: {}}}` + `or` из двух `addResourcesToAnyCard`. Карта ≈ 20 % — из них половина уходит на ОДИН новый knob общего слоя
(«необязательный `or`», правило 4) и на то, что TR43 — **первый в скоупе розыгрыш с `or`, в ветке которого стоит шаг цели-карты** (все пять
`or`+`addResourcesToAnyCard` в скоупе — ДЕЙСТВИЯ: Vermin, Aerial Mappers, Thermophiles, Atmo Collectors, Applied Science; `or` на розыгрыше —
Lunar Exports / Artificial Photosynthesis — без шагов). Путь «вариант → встроенная цель → один POST» надо ПРОВЕРИТЬ, не предполагать.

**Оценивается — в этом порядке веса.**
1. **PRE-SELECT НАДЁЖЕН ПО ПОСТРОЕНИЮ** (часть II, ≈ 55 %): воспроизведённый юнит Академий (красный → зелёный); закон АДРЕСА (каждый пре-собранный
   ответ говорит, для какого источника и какой роли собран; сервер сажает ответ ТОЛЬКО на свой промт, чужой — паркует нетронутым, свой с отказом —
   честный переспрос); `hiddenInfoPrompt` — снова только deck-pick; `VenusRedux.spec` зелёный тем же законом; гард ВОСПРОИЗВЕДЕНИЯ розыгрыша по
   всему скоупу с пустым ворклистом (падает в обе стороны); свидетель «ПЕРЕСПРОСИЛИ» в клиенте и в каждом e2e; свип с таблицей «кто переспрашивал
   сегодня». Без этого карта не сдаётся.
2. **Карта верна** (≈ 15 %): требование Зелёных; производство = число океанов на поле (все, чьи угодно, с апгрейдами и Wetlands); `or` по
   держателям (обе / одна / ни одной) — карта играбельна всегда, пропуск НАЗВАН; цель никогда не авто; обе метки будят соседей (TR38: +2 data одним
   ответом); превью ↔ живой путь побайтно через `replayBatch`.
3. **Маршрут карты на 4K** (≈ 20 %): плитка руки → композер (чип производства с базисом «Океаны: 3», ряд вариантов, встроенный шаг цели в зоне
   выбранного варианта, крошка `КАРТЫ В РУКЕ › ИХТИОЛОГИЧЕСКИЙ ГРАНТ › ЦЕЛЬ`) → A = ОДИН POST → посадка: волна производства на рельс, 2 жетона
   животных из ПЕЧАТНОГО значка карты в капсулу держателя, ответ TR38 «+2» тактом позже → поле. Раскадровка целиком.
4. **Остальная полировка** (≈ 10 %) — §6.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Требование партии** | `requirements: {party: PartyName.GREENS}` (`BiologicalSimulations.ts:112`); правят по стартовому правилу или 2 своих делегата на резолюции; TR36 порог требования НЕ снижает (FAQ p.19); причина `PARTY_REQUIREMENT_REASON` (`unplayableReasons.ts`), плашка руки «N из 2» — класс TR15 |
| **Счётное производство** | `Countable.oceans` (`Countable.ts:21`) → `Counter.ts:142` считает `getOceanSpaces({upgradedOceans: true, wetlands: true})` — ВСЕ океаны поля; базис чипа `countableBasis` (`actionPreview.ts` ≈ :400, `behavior/countedBasis.ts`) — проверить, что `oceans` — именованный базис («Океаны в игре: N»), иначе добавить к семье TR33 |
| **`or` на розыгрыше** | `OrBehavior {behaviors, autoSelect, title}` (`Behavior.ts:246–250`) — knob'а «если ни одна ветка неисполнима — пропустить блок, карту не блокировать» НЕТ: `Executor.canExecute:62–68` возвращает `false` для ВСЕЙ карты; превью: `deriveCardPlayBranches` (`cardPlayPreview.ts:185–215`) / `deriveDeclarativeBranches` (`actionPreview.ts:140–160`) — индекс среди исполнимых, `autoResolve` → −1; причина ветки — `subAvailability` → `collectActionBehaviorReasons` (`models/actionUnavailableReasons.ts:65`; текст для `mustHaveCard` — проверить) |
| **«На любую карту»** | `addResourcesToAnyCard` (`Behavior.ts:70`); форк-инвариант «никакого мгновенного применения при одном кандидате» (`Behavior.ts:230–236`, `AddResourcesToCard.ts:80–96` `autoSelect: false`); `getCards` = СВОЙ стол (+ SRR) — соперники никогда (`:139–175`); при `count > 0` и нуле держателей — `skippedAddToCard` + `recordSkippedEffect(SKIP_REASON.noHolder)` (`actionPreviews.ts:716–734`, `skippedEffect.ts:25`); чип «+N to a card» только при держателе (`actionPreview.ts:404–412`) |
| **Батч розыгрыша** | `buildPlayCardBatch` (`consolePlayCardComposer.ts:78–100`): `[play, …pre, {type:'or', index, response: optionResponse ?? {type:'option'}}, …steps]`; ветка с индексом −1 и без `optionInput` — ничего; классификация шага `playChoiceMode` (`:148–235`): кандидаты на столе → `playedTarget` (встроенный шаг), из руки → `handPick`, `or`/`amount`/`player` → `inline` |
| **Реплей батча** | `replayBatch` (`deferredInputBatch.ts` ≈ :98–166): hidden-info → парк нетронутым (≈ :112–121); `stagedMismatch` → парк (≈ :131–135); `reconcileBatchResponse`; отказ → `jumpedTheQueue` (по `type` + staged) → парк, иначе ДРОП; `drainBatchTail` (≈ :176–220): `break` на hidden-info / `stagedMismatch`, `stagedParkStale` → дроп; `hiddenInfoPrompt` (≈ :366–386) = `deckPickPrompt` **+ `discardPrompt` с `186ddae340`**; адрес только у `space | party | colony` (`stagedAddress` ≈ :230–240); `clearBatchTail` ← `Player.takeAction` (`Player.ts:2486`) |
| **Маршруты** | `PlayerInputBatch.ts:94–99` (`validatePromptId` → `replayBatch`); `PlayerInput.ts:108–122` (`expireSupersededStagedTail` → `process` → `drainBatchTail`); клиент `gameTransport.ts:502–513` |
| **Sponsored Academies** | `venusNext/SponsoredAcademies.ts:58–63` (DiscardCards + `cardSource(this)` + `discardForCards(3)`, `Priority.SPONSORED_ACADEMIES` — ступень ПОСЛЕ `OLYMPUS_CONFERENCE`, `Priority.ts:30–33`), превью `:91–104`; консоль: `handPick` → мост `consoleHandPick.ts`; ответ `{type:'card', cards:[X]}` |
| **Redux-Венера** | `Colony.ts:727–740`: сброс бонуса владельца при `SUPERPOWER` после добора; пин парковки `tests/colonies/VenusRedux.spec.ts:555–576` |
| **Гарды pre-collect** | `actionPromptCoverage.spec.ts` чек 5 (`churn` :313–320) — ДЕЙСТВИЯ; `cardPlayPreviewCoverage` / `consolePlayPreviewCoverage` — форма; `deferredInputBatch.spec.ts` — без сброса; `promptMarkerGuard.spec.ts` — у каждого производителя промта в скоупе есть структурный маркер (= источник есть у каждого промта — на это опирается закон адреса); e2e `armLeakWitness` (`parliamentDrive.ts:295`) — только stranded |
| **Источник промта** | клиент `promptSource.ts:1–25`: `choiceContext.source` / `placementContext.source` / `discardPrompt.source` / `SelectProductionToLoseModel.source` → один `PromptSourceView`; на сервере ОДНОГО читателя нет |
| **Композер (клиент)** | `ConsolePlayCardConfirm.vue:109` хостит `ConsolePlayedTargetStep` (`sub.kind === 'playedTarget'`), `:3236–3238` спуск, `:3413`; ряд вариантов — `variantGroupNav` (`consolePlayCardComposer.ts:608`); шаги ВЕТКИ — `branchChoices` (память `console-hand-pick-bridge`) |
| **Фикстуры / e2e** | `parliamentFixture('biological-simulations', …)` (`generate.ts:1267–1295`: Зелёные по стартовому правилу, `moveToDeckTop` + стол/рука); `addOcean(p)` (`generate.ts:30`, пример `:3187`); e2e-образец розыгрыша с ответом стола — `console-biological-simulations.spec.ts` (A) |
| **Арт / лор / имя** | `Mars Arts/TR43.png` ЕСТЬ (1536×1024) → `node scripts/import-card-art.mjs "<путь>" TR43` + `npm run make:cards`; `lore_texts.json:543` («TR42» — рядом «TR43»); `turmoil_redux_cards.json:159` |
| **Реестр** | footer говорит «следующий PL-160», но **PL-161 уже занята** соседом (ярус Агенды, `:435`); ревизия полировок зарезервировала раздел **V** — TR43 берёт раздел **W**; номер объявлять ДО записи по `grep` |

### Чтение скана (`…\Projects\Card_-_TR43.png`)
Цена **10**, зелёная рамка (AUTOMATED). Плашка у цены — **эмблема Зелёных** (дерево в оранжевой рамке) = ТРЕБОВАНИЕ `{party: GREENS}`, не метка.
Два кружка метки справа: **микроб** (светло-зелёный) и **животное** (тёмно-зелёный, лапа). Название «ICHTIOLOGY GRANT» (орфография карты —
`Ichtiology`, не `Ichthyology`; имя в `CardName` — как напечатано). Тело: верхняя строка **[M€-производство 1] / [океан]** = +1 ступень за каждый
океан; нижняя — **2 [животное]* OR 4 [микроб]*** — звёздочка = «на ЛЮБУЮ карту». Текст в скобках — полное правило. Лор: *«♪ Ocean Man, take me by
the hand, take me to the land that you understand ♪»* (с нотами). Внизу слева — фиолетовый шестиугольник Turmoil (значок модуля → без
`compatibility`), ▲ Колоний нет. Без ПО. «Getty Images» — подпись скана, не часть лица.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/IchtiologyGrant.spec.ts`)
1. **Требование** — плашка Зелёных: правят (стартовое правило — в 1-м поколении играбельна без делегатов) или 2 СВОИХ делегата на их резолюции;
   проверяется при розыгрыше; TR36 Council Seat порог ТРЕБОВАНИЯ не снижает.
2. **Производство M€ = число океанов НА ПОЛЕ в момент розыгрыша** — все, чьи угодно, включая апгрейженные (Ares) и Wetlands (`Counter.ts:142` — закон
   `Countable.oceans`, не своя арифметика); 0 океанов → +0, и ноль НАЗВАН базисом в чипе («0 → 0 · Океаны: 0» — класс TR33 «переменная величина не
   исчезает с экрана»); 9 океанов → +9. Считается ОДИН раз, при розыгрыше; позднее появившиеся океаны ничего не добавляют.
3. **«На ЛЮБУЮ карту» = любую СВОЮ карту, способную держать этот ресурс** (чтение апстрима `AddResourcesToCard.getCards`: свой стол + SRR; чужие —
   никогда). Цель никогда не применяется автоматически, даже при единственном держателе (инвариант 3): шаг цели показан, игрок видит
   `current → resulting` на карте-держателе.
4. **`or` с `mustHaveCard` на обеих ветках + `autoSelect: true`** (форма Vermin): ветка без держателя НЕ предлагается (показана недоступной с
   причиной); единственная доступная ветка — без `OrOptions` (превью даёт индекс −1, батч шлёт ГОЛЫЙ ответ цели). **Ни одного держателя обоих
   видов → карта ОСТАЁТСЯ ИГРАБЕЛЬНОЙ**: производственная строка стоит сама по себе, а правило игры — «карту можно разыграть, даже если часть
   эффекта применить нельзя». Сегодня `Executor.canExecute:62–68` делает такую карту неиграбельной — это неверное чтение для TR43 (и для любой
   карты, где `or` — бонус при основном эффекте). Решение 3: **knob `OrBehavior.optional: true`** в общем слое: при нуле исполнимых веток
   `canExecute` блок не блокирует карту, `execute` пишет ОДИН названный пропуск («2 животных / 4 микроба — нет карты-носителя»:
   `recordSkippedEffect(player, SKIP_REASON.noHolder, …)` с обоими эффектами в `SkippedEffect`), превью (оба `derive*Branches`) отдаёт ОДНУ общую
   ветку с `warningNote` и обе вариантные ветки серыми с причиной (инвариант 2: показывать недоступное, не прятать). Паритет превью ↔ исполнение —
   спеком по трём наборам держателей (обе / одна / ни одной).
5. **Порядок в живом пути:** производство — мгновенно при `execute`; `or` → `player.defer(OrOptions)` при `DEFAULT` (`Executor:328–365`); выбранная
   ветка → `AddResourcesToCard` при `GAIN_RESOURCE_OR_PRODUCTION`. Батч: `[play, {or, index, {option}}, {card}]`, при коллапсе — `[play, {card}]`.
   Обе формы ОБЯЗАНЫ приземляться целиком — спек через `replayBatch` на свежей игре (первый карточный пин части II).
6. **Две метки будят соседей ПО МЕТКАМ:** TR38 Biological Simulations получает **+2 data одним ответом** (её правило 3 — «карта с микробом И животным
   платит 2»), Decomposers +1 микроб за животное/растение/микроб-метку… (одна карта — одно срабатывание по его правилу), Viral Enhancers,
   Ecological Zone (животное за животное-метку). Прогноз (`partyFacts` / `cardPlayedForecast`) называет их ДО нажатия; ответ стола ЛЕТИТ (закон 24,
   PL-124) — здесь впервые с цифрой «2» на одном жетоне.
7. **Журнал:** строка производства с числом («+3 M€ production — Oceans in play: 3» через базис, если семья так печатает), строка ресурса («added 2
   animals to Pets»), строка пропуска при нуле держателей. Нотификация сопернику: чипы в порядке событий.
8. **MarsBot** карту не играет (колода бота — метки); держателей у бота нет; против бота «любая карта» всё равно только своя.
9. **Save / load:** ничего нового (производство и ресурсы — обычные поля).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, не блокер)
1. RU-имя **«Ихтиологический грант»** (альтернатива «Грант на ихтиологию»).
2. Лор RU: **«♪ Океанский человек, возьми меня за руку, отведи в тот край, что тебе понятен ♪»** (песня Ween «Ocean Man»; ноты сохранить; альтернатива —
   оставить строку по-английски как цитату).
3. **Knob `OrBehavior.optional`** (правило 4) вместо `bespokePlay` с `OrOptions`: декларация, со-локация, авто-покрытие превью/причин/прогноза; это
   КЛАСС (любая карта «основной эффект + бонус-выбор по держателю»). Имя knob'а — на усмотрение агента, но ОДИН knob на оба `derive*Branches` и оба
   пути `Executor`. Альтернатива — bespoke с `orOptionsStep` + `addToCardStep` (допустимо, если knob потянет за собой правки > 3 файлов общего слоя).
4. Заголовки веток — EN-ключи **`Add 2 animals to ANY card`** / **`Add 4 microbes to ANY card`** (Grep по всем `src/locales/<lang>/*.json` ДО добавления —
   `Add 1 microbe to ANY card` уже есть у Vermin, форму повторить); RU «Добавить 2 животных на любую карту» / «Добавить 4 микроба на любую карту».
5. **Оба варианта видны всегда**; недоступный — серый с причиной держателя («Нет карты для животных» — текст `collectActionBehaviorReasons`, если
   он там честный; иначе — ключ семьи `SKIP_REASON.noHolder`); при коллапсе ряд вариантов НЕ исчезает (серый + выбранный), шаг цели стоит в зоне
   выбранного.
6. **Ответ стола «+2 data» — ОДИН жетон с цифрой 2** в группе EFFECT RESOLUTION посадки (закон 24), не два жетона и не тик без полёта; проверить
   кадрами 4K, что цифра читается с дивана.
7. **e2e: ДВА спека** — `console-ichtiology-grant.spec.ts` (три фикстуры §4: обе / одна / ни одной) и **`console-sponsored-academies.spec.ts`**
   (воспроизведение дефекта владельца: hand-pick сброса в композере → ОДИН POST → ни одного `handSelect` после; второе место видит внешний добор).
   Оба — fhd + 4K, оба со свидетелем «ПЕРЕСПРОСИЛИ».
8. **Батч владельцу — ПЕРВЫМ, одним `AskUserQuestion`:** решения 1–3; **архитектурный выбор части II** (закон адреса — §6.II; если агент видит
   более дешёвую ПОЛНУЮ альтернативу — предложить с рекомендацией, не делать молча); неотвеченные строки батча TR41 (PL-145…PL-150 / PL-067 / PL-052 —
   сверить статусы в реестре: часть уже закрыта соседом 2026-10-11) и К-W1 TR42, если открыты.

---

## 0. Рабочее дерево
HEAD `2c2d88c6c1`; дерево чистое, кроме `docs/claude/prompts/polish-remediation-iteration-1.md` (untracked — промт ДРУГОГО агента, не трогать, не
коммитить). **Тот агент будет работать ПАРАЛЛЕЛЬНО** в `consoleResourceTransfer.ts`, `consoleActionCommit*.ts`, `holderRoles.ts`,
`consolePlayedTargetModel.ts`, **`ConsolePlayedTargetStep.vue`** (шаг цели — он же у TR43!), `consoleTest.ts` (общий e2e-скан `${`), `console-ui.md`,
реестр (раздел V, PL-160+). ListAgents / SendMessage ДО первой правки этих файлов и ДО записи в реестр; свои правки шага цели класть ПОВЕРХ его
коммитов. Общие файлы (`deferredInputBatch.ts`, `InputResponse.ts`, `ActionPreviewModel.ts`, `actionPreviews.ts`, композеры, локали, реестр, журнал,
правила) — только через временный индекс (`GIT_INDEX_FILE` абсолютным путём; **read-tree → commit ОДНОЙ командой** при активном соседе — память
`git-temp-index-race`; `git reset -q` после), `git add` своими путями; после коммита — `git restore --staged package.json package-lock.json`.
Свой снапшот: `npm run e2e:snapshot tr43`, `TM_E2E_ROOT=.e2e-tr43`; 4K — `--workers=1`. Реестр: раздел **W** «маршрут pre-select: адресованный ответ ·
or-розыгрыш с целью · ответ стола на две метки», номера — по `grep` в момент записи (PL-161 занята).

## 1. Сервер
**Общий слой (коммит 1):** knob `OrBehavior.optional` (`Behavior.ts:246–250` + doc-комментарий с правилом игры) → `Executor.canExecute` (блок `or` при
`optional` не блокирует карту) → `Executor.execute` (ноль исполнимых → `recordSkippedEffect` одним фактом; `SkippedEffect` с эффектами обеих веток —
`skippedAddToCard` расширить списком или двумя вызовами одной причины, решить по тому, как журнал печатает) → `deriveCardPlayBranches` /
`deriveDeclarativeBranches` (ноль доступных + `optional` → одна ветка `index: -1` с `warningNote` + обе вариантные ветки `available: false` с причиной —
проверить, что композер рисует «общая + серые варианты» без пустого ряда). Спек `tests/behavior/*` (или существующий спек Executor'а): паритет
превью ↔ исполнение, пропуск назван, карта без knob'а — как прежде (регрессия Vermin / Aerial Mappers / Thermophiles / Lunar Exports).
**Карта** `src/server/cards/turmoilRedux/IchtiologyGrant.ts`: `CardName.ICHTIOLOGY_GRANT = 'Ichtiology Grant'` (после `GREEN_ALLEGIANCE`,
`CardName.ts:1116`), манифест `TurmoilReduxCardManifest.ts:222+`, без `compatibility`; AUTOMATED, 10, `[Tag.MICROBE, Tag.ANIMAL]`, `requirements:
{party: PartyName.GREENS}`, `behavior: {production: {megacredits: {oceans: {}}}, or: {optional: true, autoSelect: true, behaviors: [{title: 'Add 2
animals to ANY card', addResourcesToAnyCard: {type: ANIMAL, count: 2, mustHaveCard: true}}, {title: 'Add 4 microbes to ANY card', addResourcesToAnyCard:
{type: MICROBE, count: 4, mustHaveCard: true}}]}}`; шапка файла — чтение скана + правила 1–9 (форма TR38). Никаких хуков: превью, причины, прогноз
соседей, чипы, журнал — всё из декларации; если что-то НЕ встало само (базис «Океаны», прогноз TR38 «+2»), это дефект общего слоя — чинить там.
**Спек** `IchtiologyGrant.spec.ts`: требование (правят / 2 делегата / 1 делегат + TR36 → нет); производство 0 / 3 / 9, апгрейженный океан и Wetlands
считаются, чужие океаны считаются; `or`: обе ветки → `OrOptions` из 2 с `choiceContext`; одна → голый `SelectCard` цели; ни одной → без промта, пропуск
записан, карта играбельна (`canPlay` true при Зелёных и 10 M€); цель не авто при одном держателе; **превью ↔ живой путь через `replayBatch`** для
трёх наборов (батч собран как композер — `[play, {or,index,{option}}, {card}]` / `[play, {card}]`; после реплея `waitingFor` undefined,
`parkedBatchTailLength === 0`, ресурсы легли); TR38 на столе → +2 data; журнал; MarsBot.

## 2. Клиент
Для карты нового кода быть НЕ ДОЛЖНО — но путь «ряд вариантов → встроенный шаг цели в зоне выбранного варианта → ОДИН POST» для РОЗЫГРЫША
никто не проходил (см. «Что это за карта»). Проверить и закрепить e2e: (а) ряд вариантов из `branches[]` превью, выбор ветки → `branchChoices` этой
ветки → `playedTarget` → спуск в `ConsolePlayedTargetStep` (Teleport в зону, крошка `КАРТЫ В РУКЕ › ИХТИОЛОГИЧЕСКИЙ ГРАНТ › ЦЕЛЬ`, B — уровень назад с
сохранённым вариантом); (б) коллапс при одном держателе — ряд остаётся, шаг цели сразу; (в) ноль держателей — серые варианты + строка пропуска, A
доступен; (г) посадка (`consolePlayedHero.ts`): волна производства с базисом на рельс, **2 жетона животных рождаются на ПЕЧАТНОМ значке животного
карты** (грамматика PL-124: причина видна) и летят в капсулу Pets, счётчик тикает на касании; ответ TR38 «+2» — следующим тактом (`TOUCHDOWN_TICK_GAP_MS`);
оба конца каждого полёта ВИДИМЫ (память `polish-quality-no-regressions`) — держатель на столе в кадре посадки, иначе честная деградация в тик с
чипом. Любое отклонение — дефект общего слоя (композер / герой), чинится классом с гардом, не заплаткой на карту.

## 3. Лицо, локаль, лор
`renderData`: `b.production((pb) => pb.megacredits(1)).slash().oceans(1).br; b.resource(CardResource.ANIMAL, {amount: 2, digit}).asterix().or()
.resource(CardResource.MICROBE, {amount: 4, digit}).asterix()` — форма Imported Nitrogen (`base/ImportedNitrogen.ts:32–33`), `.or()` / `.asterix()` /
`.oceans()` — `CardRenderer.ts:158, :564, :568`; требование — плашка партии из `requirements` (лицо TR38). `description` —
текст скана дословно. RU-имя — `turmoil_redux_cards.json`; лор — `assets/text/lore_texts.json` «TR43» (EN с нотами) + RU-перевод в `src/locales/ru/lore_texts.json`; ключи веток и
причины — Grep ДО добавления (сборка падает на дубле). Арт — `import-card-art.mjs` + `make:cards`; проверить витрину EN / RU и миниатюру.

## 4. Тесты
Юнит карты (§1); спек knob'а; **часть II (§6.II)**: `deferredInputBatch.spec.ts` — случай Академий (красный до фикса), случай «адрес не совпал — парк
нетронутым», «адрес совпал — отказ = дроп», «ответ без адреса — позиционно как прежде», Redux-Венера тем же законом; **`tests/models/
cardPlayReplayCoverage.spec.ts`** — гард воспроизведения розыгрыша (§6.II.4); клиентские спеки сборщиков батча (адрес в каждом ответе) и свидетеля.
**e2e** (решение 7): фикстуры `ichtiology-grant` (Зелёные по стартовому правилу, 3 океана `addOcean`, на столе синего Pets + Tardigrades + TR38 с 2 data,
карта в руке, 20 M€; красный — спокойная корпорация, второе место), `ichtiology-grant-one` (только Pets), `ichtiology-grant-none` (держателей нет);
`sponsored-academies` (рука: Академии + 3 карты, 20 M€; красный — второе место). Прогнать соседей: `console-biological-simulations`,
`console-self-target`, `console-staged-play`, `console-sponsor-play-outcome`, `console-trade-target-step`, TR03 / TR07 / TR12 / TR14 / TR15 / TR21
(адресованные хвосты — их закон СТАНОВИТСЯ общим), `npm run e2e:affected`. Гарды-ворклисты после карты: `actionPromptCoverage`,
`cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`, `effectForecastCoverage`, `promptMarkerGuard`, `e2eLiveness`, `glyphLiteralGuard`.
`npm run build:test` обязателен.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Витрина EN / RU (плашка Зелёных, две метки, «[M€] / [океан]», «2 [животное]* OR 4 [микроб]*»); плитка руки (играбельна / «1 из 2»); композер при 3 океанах
(чип «1 → 4 · Океаны: 3» — читается ли БАЗИС с дивана), ряд вариантов + шаг цели (Pets / Tardigrades с `current → resulting`), коллапс, ноль держателей
(строка пропуска — честно и не тише чипов), крошка; A → раскадровка посадки целиком (производство · 2 жетона · ответ TR38 «+2» · поле); журнал;
нотификация красного. По КАЖДОМУ моменту — вердикт «что здесь слабо?» с кадром.

## 6. ПОЛИРОВКА — часть II и всё сверх карты (премиум-планка)
### I. Маршрут карты — кандидаты (глазами НЕ подтверждено)
- **К-V1 · Ряд вариантов + вложенный шаг на 4K** — первый розыгрыш такого вида: композиция зоны (ряд ≤ трети, шаг цели ≥ трети, пустота ≤ трети).
- **К-B1 · Базис «Океаны: 3» в чипе производства** — `oceans` именован (`countedBasis.ts:25`); проверить, что композер и журнал печатают его по-русски
  («Океаны в игре: 3») и что ноль не исчезает («0 → 0 · Океаны: 0»).
- **К-S1 · «+2» одним жетоном** — цифра на жетоне ответа стола (закон 24 печатал «+1»).
- **К-N1 · Пропуск при нуле держателей** — строка в композере + строка журнала + чип нотификации: один словарь (`SKIPPED_LABEL`).

### II. ИТЕРАЦИЯ PRE-SELECT — надёжность по построению (главное)
**Закон (в `console-ui.md` как 27 и в `server.md`): ПРЕ-СОБРАННЫЙ ОТВЕТ АДРЕСОВАН. Каждый ответ, собранный композером, говорит, ДЛЯ КАКОГО источника
и КАКОЙ роли он собран; сервер сажает его только на промт с тем же адресом; чужой промт — очередь прыгнула, ответ ждёт нетронутым; свой промт,
отказавший по значению, — честное расхождение, переспрос по делу. Никаких правил уровня «вид промта» (ни «каждый сброс скрыт», ни «тот же тип =
тот же вопрос»).**
1. **Воспроизвести** (коммит «red»): юнит в `deferredInputBatch.spec.ts` — Академии: рука из 4, батч `[play, {card: X}]` через `replayBatch`;
   сегодня: `waitingFor` = `SelectCard` с `discardPrompt`, `parkedBatchTailLength === 1`, после `drainBatchTail` — по-прежнему; ожидание: X сброшен,
   3 добрано, `waitingFor` undefined, парк пуст. Второй юнит — Redux-Венера (`VenusRedux.spec:555–576`) остаётся как есть и обязан остаться зелёным.
2. **Адрес на СЕРВЕРЕ:** (а) `PreselectAddress = {source: ChoiceContextSource, role: 'discard' | 'target' | 'handPick' | 'choice' | 'amount' | 'player' |
   'payment' | 'placement' | 'party' | 'colony'}` в `src/common/models/…`; (б) **ОДИН серверный читатель `promptAddress(input): PreselectAddress |
   undefined`** — близнец клиентского `promptSource.ts` над теми же четырьмя формами (`discardPrompt.source` → `discard`; `choiceContext.source` → роль по
   классу инпута: `SelectCard` → `target` / `handPick` (по `discardPrompt`/кандидатам — структурно, никогда по заголовку), `OrOptions` → `choice`,
   `SelectAmount` → `amount`, `SelectPlayer` → `player`, `SelectPayment(Deferred)` → `payment`; `placementContext.source` / `SelectSpace.sourceCard` →
   `placement`; `votePrompt`/`supportPrompt` → `party`; `SelectColony.choiceContext` → `colony`); (в) ответы: одно поле адреса на ВСЕХ типах
   `InputResponse` (сегодняшний `stagedFor: CardName` у `space | party | colony` — частный случай: либо расширить до `PreselectAddress`, либо оставить
   как alias на проводе с конвертацией в одном месте — решить по тому, сколько e2e-драйверов читают `stagedFor`; Grep); валидация формы в
   `InputResponse.ts` (`matches`); (г) `replayBatch` / `drainBatchTail`: для ответа С адресом — `promptAddress(waitingFor)` равен → `process` (отказ =
   расхождение → дроп хвоста, честный переспрос); не равен или промт без адреса → парк нетронутым; `stagedMismatch` / `jumpedTheQueue` /
   `expireSupersededStagedTail` / `parkedStagedPlacement` / baselines ячеек — частные случаи того же сравнения (свести к одному, не держать два
   закона); ответ БЕЗ адреса — сегодняшний позиционный путь (обратная совместимость — и гард, что в скоупе таких не осталось); (д)
   **`hiddenInfoPrompt` → только `deckPickPrompt`** (ступень сброса удалить вместе с комментарием; Redux-Венера держится несовпадением роли
   `target ≠ discard`); (е) `reconcileBatchResponse` остаётся (обёртка `or` при коллапсе — это форма, не адрес).
3. **Адрес в ПРЕВЬЮ и в СБОРЩИКАХ:** `ActionPreviewStep.for?: PreselectAddress` (`ActionPreviewModel.ts`) проставляется в ОДНОМ месте на семью —
   `actionPreviews.playPreview(card, …)` / `actionPreview(card)` / `cardPlayPreview` walker: каждому `input`-шагу без адреса — `{source: cardSource(card),
   role по kind}`; превью торговли — колония; стандартные проекты — `standardProject`; хостимые шаги Парламента — как есть (адресованы). Клиент:
   `ComposerChoice.address` ← `step.for`; **каждый сборщик батча** (`buildPlayCardBatch`, `buildActionBatch`, стандартные проекты, композер торговли,
   `repeatActionResponses`, Гидросеть, staged play / vote / colony) штампует адрес в ответ — одной функцией `addressed(response, choice)`, не в семи
   местах руками. Гард: `cardPlayPreviewCoverage` + `actionPreviewCoverage` — у каждого `input`-шага в скоупе есть `for` (ворклист пуст, падает в обе
   стороны); клиентский спек сборщиков — каждый ответ после головы адресован.
4. **Гард ВОСПРОИЗВЕДЕНИЯ розыгрыша** `tests/models/cardPlayReplayCoverage.spec.ts` — близнец чека 5 `actionPromptCoverage` для РОЗЫГРЫШЕЙ: каждая
   in-scope карта проекта с ≥ 1 `input`-шагом, 3 профиля (чистый; science-interlopers — Olympus Conference с ресурсом + Pharmacy Union + TR38 на столе;
   Красные правят с налогом, если он в форке живой — проверить по аудиту § CLASS 4), превью read-only → батч как у композера (`buildPlayCardBatch` —
   чистый модуль без Vue; прецедент импорта клиентского модуля в серверный раннер — `GreenAllegiance.spec.ts:29` `notificationModel`; ответы как у
   чека 5: первая карта / min / M€) → `replayBatch` на СВЕЖЕЙ игре с картой в
   руке → `runAllActions` → ассерты: `waitingFor` пуст ИЛИ это объявленный follow-up (`followup` / `boardPlacement` / `reveal` / `note`) с адресом НЕ из
   батча; `parkedBatchTailLength === 0` (непосаженный ответ = ложь превью). `LEFTOVER_PRESELECT_WORKLIST` — пуст, падает в обе стороны. **Результат
   первого прогона ДО фикса = таблица «кто переспрашивает сегодня» в отчёте и в журнале** (ожидание: Академии; всё сверх — находки владельцу).
5. **Свидетель «ПЕРЕСПРОСИЛИ» в клиенте:** `src/client/console/preselectWitness.ts` — после `submitBatch` запоминает адреса отправленных ответов; при
   применении следующего вида, если `waitingFor` (включая узлы дерева `OrOptions`) несёт адрес из этого набора — `console.warn('RE-ASKED PRE-SELECT
   …')` (dev — плюс панель детектора утечек класса stranded; prod — только warn). e2e: `armPreselectWitness` в `consoleTest.ts` для КАЖДОГО спека
   (как скан `${` ревизии — согласовать с соседом, он правит тот же файл) — красный тест при любом переспросе на любом маршруте.
6. **Свип и документы:** таблица всех производителей батча и всех `followup`-шагов в скоупе (почему не пре-собраны — каждая строка с причиной;
   `followup` без причины = кандидат в реестр); `docs/claude/action-prompt-audit.md` § CLASS 8 «ответ без адреса» (корень 186ddae340, закон, гарды);
   память `action-precollect-contract` — седьмой класс; `precollected-batch-tail-parks` — обновить («парк по адресу, не по типу»); чеклист §4 —
   строка «pre-select: шаг с адресом, гард воспроизведения».
**Не принимается:** вернуть ступень сброса под другим именем; «починить Академии» исключением для `SPONSORED_ACADEMIES`; оставить два закона
(адрес + тип) рядом; свидетель только в одном спеке; гард с непустым ворклистом «на потом».

### III. Чеклист §7 — остальное
Открытые строки на маршруте — сперва воспроизвести: PL-149 (пауза коммита 4K), PL-128 (бесшовность розыгрыша с хостимым шагом), PL-159 (`v-show`
всегда смонтированных секций). Только-Deck — не полируем (PL-105).

## 7. Режим работы
**Коммиты:** (1) knob `optional` + паритет (общий слой, регрессия пяти `or`-карт); (2) карта + спек + локаль + лор + арт; (3) **pre-select «red»** —
юнит Академий (падает); (4) закон адреса на сервере + `hiddenInfoPrompt` без сброса + `VenusRedux` зелёный + юниты; (5) адрес в превью и сборщиках +
гарды покрытия + свидетель; (6) гард воспроизведения + таблица свипа; (7) e2e — четыре фикстуры, два спека, свидетель в `consoleTest.ts`; (8) документы
— журнал § TR43 (карта + вся итерация с таблицей свипа), аудит § CLASS 8, `console-ui.md` 27 / `server.md`, чеклист §4, реестр раздел W, память (в
отчёте — какие файлы памяти обновить). **Коммиты полировки маршрута** — отдельно (`Polish (TR43 route): PL-### — …`), с «до / после» и гардом.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой — `npm run make:css` +
`npm run build:server`. **Не пушить.** Батч владельцу — после воспроизведения (3) и ДО закона (4): архитектурный выбор — его.
Гочи: `coloniesExtension: true` + `turmoilReduxExpansion: true` в `testGame` для Redux-карт; старый бандл новую карту не рисует — стенд на своей
сборке; на 4K ждать `.con-hand:not(.con-hand--transit)` до `focusCard`; имена кадров скринкаста = время получения; `python3` — заглушка Store; `eqeqeq`
без исключения для null; bash heredoc с длинным RU — Write; `node -e` с бэктиками — Edit; `rtk grep` с фиксированной строкой виснет — Grep-инструмент;
`/* */` внутри JSDoc закрывает комментарий; `npm run build:server`, не голый `tsc`; `build:client` может молча «compiled with 1 error» — проверять
`main.js` mtime; при активном соседе временный индекс — одной командой; юниты — на тихой машине, не во время e2e.
**В отчёте:** таблица свипа «кто переспрашивал до / после»; закон адреса — что изменилось в каждом из семи сборщиков; вердикты по моментам (§5) с
кадрами 4K; батч владельцу и ответы; регрессия (юниты / гарды / lint / e2e по классам, соседние спеки адресованных хвостов); новые ключи; подтверждение
решений 1–8; арт. **Явно — всё, что не получилось сделать, и почему.**

## 8. Нельзя
Определять промт или адрес по заголовку; правило уровня «вид промта» в реплее батча; исключение для одной карты; молчаливый дроп припаркованного
ответа; два закона посадки рядом; `setTimeout` вместо холда; `title`; литерал имени карты в `src/client/**`; литерал кнопки контроллера;
`compatibility`; `bespokePlay` там, где декларация с knob'ом; клиентская арифметика океанов; карта, у которой батч что-либо переспрашивает (даже «честно»);
e2e «на ещё одну карту» сверх двух спеков; полировка только-для-Deck; правка файлов соседа-ревизора без SendMessage; `shardPlan.json`;
незакоммиченные чужие файлы в своём коммите; пуш и красные коммиты.
