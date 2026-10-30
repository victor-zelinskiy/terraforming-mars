# Промт исполнителю · P82 Special Permit («Специальное разрешение») — ДВЕНАДЦАТАЯ карта Prelude 2, восьмая ПОЛИТИЧЕСКАЯ и ПЕРВАЯ АТАКА серии (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 3 + 5 — BESPOKE + ПОЛИТИЧЕСКАЯ): красная (EVENT), 5 M€, метка растений; требование партии Зелёных («у власти или 2 ваших делегата на их резолюциях»); «Украдите 4 растения у другого игрока» — `bespokePlay` → `StealResources(player, PLANTS, 4, …, mandatory)`; соло — просто +4 растения. Форк-слой: маркер `politics: 'redux'`, текст в голосе Redux, **цель показана всегда** (инвариант 3 — даже одна; MarsBot — ещё одно место стола, его «растения» — склад + M€-прокси `AutomaTargeting.attackableStock`), у розыгрыша нет `cause` (атака не знает, кто её сделал) и нет `cardPlayPreview` (композер пуст, гард покрытия красный) — образец ровно рядом: **Air Raid** (`colonies/AirRaid.ts`). Метка растений события будит реакторы стола (Decomposers, Arklight, Viral Enhancers; событие — Media Group) — карта становится СТЕНДОМ полировки · РАБОТА КАРТЫ (≈ 20 %) · ПОЛИРОВКА (≈ 80 %) — «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА»: владелец (2026-10-31) — «иногда вместе с фактической картой сработавшего эффекта рядом поднимаются ещё ЛЕВЫЕ карты, а иногда карта поднимается с левой картой ПОД ней» — аудит ВСЕЙ архитектуры подъёма фреймворка «СРАБАТЫВАНИЕ КАРТЫ» (CN) и одна гарантия идентичности, проверяемая механически на каждом e2e

> **Статус: ВЫДАН 2026-10-31.** HEAD `2d0eebf585` (P70 СДАНА — серия грантов + каркас Парламента, раздел **DA**; ворклист **11 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись ДВЕНАДЦАТАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты; `AskUserQuestion` — только
> exit 2/3/4 бокса или ветка позади при пуше.
> **Сосед на момент выдачи — один** (`ListAgents`: `terraforming-mars-7a`, занят, рабочее дерево чисто — его задача неизвестна). ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`;
> `SendMessage` ему со списком твоих файлов (§0) — особенно `console/cardReaction/**`, `gameTransport.ts`, `consolePlayedHero.ts`, `consoleActionCommitRail.ts`, `ConsoleShell.vue`,
> `tests/e2e/consoleTest.ts` (общий гард всех спеков). `package.json` / `package-lock.json` (`MM`) — не твои.
> Промты-образцы: **`prelude2-p85-summit-logistics.md`** (политическое требование партии под Redux, стенд `-locked`), `prelude2-p72-envoys-from-venus.md` / `-p70-…` (событие серии,
> текст в голосе Redux), `prelude2-p76-…` (событие: награда на рубашке, стопка «СОБЫТИЯ»). Фреймворк, который ты аудитишь: **`docs/claude/console/card-reaction.md`** (законы 1–10 +
> итерации 2–6 + TR81 / TR82 / TR84 / TR78 / TRP9), `.claude/rules/animations.md` § СРАБАТЫВАНИЕ КАРТЫ, память `card-reaction-framework-prompt` (гочи итераций — НЕ переоткрывать:
> место у кромки рельса (итерация 5, центр проёма ОТМЕНЁН владельцем), темп CALM / QUICK, hurry = темп, хосты, летающие ответ сами, ОБЯЗАНЫ `declareHeldAnswers`).
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P82.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P82 - Special Permit.png`.
> Лор — СО СКАНА, дословно: «Getting access to land cultivated by another corporation» (без точки — добавить; гард лора).
> Реестр: последний раздел **DA** (P70), последний номер **PL-1207** → эта задача берёт **DB**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p82` → `npm run e2e:remote -- p82 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд идентичности —
> FUNCTIONAL (запись `MutationObserver` + `setInterval` 16 мс, не кадры), темп — не трогаешь (стенды фреймворка TIMING — регрессия); раскадровка — TV (`TM_E2E_STORYBOARD=1`).
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 3 и п. 5**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76…P70 — не переоткрывать: награда события на рубашке (P76),
эмблема партии + «N/2» в причине руки (P85), «Сработает» каскадирует ответы ПАРТИИ (P75), **свежий Redux-стол = Зелёные у власти** (PL-1162 — P82 играбельна с первого хода; «запертый» стол
сажает закон другой партии `seatEnacted(quietResolutionOf(REDS))`)), `docs/claude/turmoil-redux-card-checklist.md` §0 («карта-реактор» — здесь карта-ПРИЧИНА), §3, §7, `docs/claude/console/card-reaction.md`
(всё), **память `table-target-zone`** (цель на столе — ОДНА зона, бот — ещё один игрок: плитка-заместитель, атакованный ресурс, никогда M€ / склад словами), `console-bot-attack-modal`,
`.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE (`transferEndVerdict`), § ПРИЁМ РЕСУРСА КАРТОЙ, `.claude/rules/animations.md`, CLAUDE.md инварианты 3, 4, 6, 15, 17.
Память: `rules-first`, `upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `trivial-card-prompts-no-owner-questions`, `visual-restraint-no-glow`, `review-own-artifacts-dont-dismiss-anomalies`, `test-cheap-hypotheses-dont-dismiss`, `prelude2-adaptation`.

**Образцы — по частям.** Карта: `prelude2/SpecialPermit.ts` (EVENT, 5, `[PLANT]`, `requirements: {party: GREENS}`, `bespokeCanPlay` — соло `true`, иначе кандидаты ≥ 4 (`mandatory`);
`bespokePlay` — `new StealResources(player, PLANTS, 4, message(…), true)` **без `cause`**; рендер `text('steal').plants(4, {all, digit})`; `description` классики — RU `ru/cards.json:703` с опечатками
(«правящий», «Украдит…») — НЕ ПРАВИТЬ, ключ уйдёт, решение 2), манифест `Prelude2CardManifest.ts:72` (`compatibility: 'turmoil'` без `politics`), RU-имя «Специальное разрешение» (`ru/cards.json:702`),
голос Redux требования Зелёных — `ru/turmoil_cards.json:20` («Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на их резолюции.»). **Образец бесспорного — `colonies/AirRaid.ts`**
(`:52–68` — `StealResources(…, true, cardSource(this))`, `:80–95` — `cardPlayPreview`: `previewOptions()` → `actionPreviews.orOptionsStep`, `stockGain`), `deferredActions/StealResources.ts`
(`getCandidates` — оппоненты, бот через `AutomaTargeting.attackableStock`, `plantsAreProtected`, Botanical Experience ×2; `execute` — соло `stock.add`, пусто → `recordSkippedEffect`; `buildOptions` /
`previewOptions` — без мутаций). Фреймворк подъёма: **`console/cardReaction/cardReactionDirector.ts`** (1160 строк: сид `seedCardReactionHolds` `:~280–356` — `attached.push(…)` `:329`,
«attached groups nobody claims … are let go» `:356` — а код лишь обрезает при > 24 до 12; **`cardReactionAnswerFlight` `:569–580`** — берёт КАЖДУЮ невостребованную группу, чьи ряды
пересекаются (или ВСЕ при `rows === undefined`), без фильтра по ответу / корню нажатия; `warmFaces` `:369–377`; сворачивание `:595–628` — `dropWarmReactors()` только в конце цепочки),
**`cardReactionStage.ts`** (`warmReactorFaces` `:120–130` — тёплые лица ВСЕ в один слот (`stageSlotsFor(1)`), дедуп по имени; `seatReactor` `:141–153` — забирает тёплое лицо ПО ИМЕНИ;
`dropWarmReactors` `:133`), **`reactorPlaces.ts`** (`liftTargetOf` — `[data-reaction-lift]` внутри, иначе САМ элемент-обёртка; `buriedUnderAnotherCard` / `placeShowsCard` — фиксы 2026-10-30
«поднимается НЕ ТА КАРТА»; `visibleReactorHome` — первый видимый по 4 селекторам; `findReactorPlace` — зарегистрированное место выигрывает), `cardReactionModel.ts` (`planReactionChain`,
`mergeCardReactions`, `reactionStageSlots`), `reactionToldOnStage.ts`, `ConsoleCardReactionLayer.vue` (лица `:key="face.key"`, тёплое — `--warm`), `console_card_reaction.less:31` (`--warm`).
Хосты (кто зовёт `cardReactionAnswerFlight` / `declareHeldAnswers` / `registerReactorPlace`): `grep -rn "cardReactionAnswerFlight(\|declareHeldAnswers(\|registerReactorPlace(" src/client`.
Стенды фреймворка: `console-card-reaction.spec.ts` (MANY · BOARD · FIBER · HURRY · SLOW · RIVAL · SCALE · PARTY · HYDRO), `console-hartlan-heating`, `console-supercomputer`, `console-parliament-forestry`,
`-craze`, `console-lotus-innovations`, `console-titan-holdings`, `console-proteus`, `console-medical-institute`; фикстуры `card-reaction-*`, `hartlan-heating`, `hydro-greens`; якорь свидетеля
`reactor:<card>:<sprite>`; трейл `noteTransferTrail('reaction:*')` (`__conReady().transfer`, `?trail=1`).

---

## Диагноз (подтверждён файл:строка на `2d0eebf585`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, форк-слой — четыре дыры.** (а) нет маркера → гард §2.5 после удаления строки красный; (б) `StealResources` без `cause` → у промпта нет `choiceContext.source` — модалка атаки
   / зона цели не знает, ЧЕЙ это удар (Air Raid передаёт `cardSource(this)`); (в) нет `cardPlayPreview` → гард `cardPlayPreviewCoverage` красный, композер и плита руки не говорят ни цели, ни
   «+4 растения»; (г) текст — классика и с битым RU.
2. **Чтение скана (§0):** «5» — цена; плашка — ЭМБЛЕМА ЗЕЛЁНЫХ (требование партии); метка — растения; стрелка — СОБЫТИЕ; ряд — «STEAL 4 [растения в красной рамке]» (красная рамка — «чужие»);
   текст «(Requires that Greens are ruling or that you have 2 delegates there. Steal 4 plants from any player.)»; «P82»; слева внизу — Prelude 2 · Turmoil; лор — курсив.
3. **Цели.** Только оппоненты с ≥ 4 растениями, не защищёнными (Protected Habitats — нет; Botanical Experience — нужно 8); бот — по `attackableStock`; соло без бота — +4 растения, без вопроса.
   Нет ни одной цели → карта не играется (`bespokeCanPlay`), причина руки обязана НАЗВАТЬ это («нет игрока с 4 растениями» — проверить, что причина не голое «нельзя»); соперник с 3 растениями
   — БЛИЗКИЙ ПРОМАХ: показан недоступным с причиной «3 / 4» (закон «A TAKING step shows its NEAR MISSES») — проверить «до», что делает зона цели игроков.
4. **Что даром (проверить «до»):** требование Зелёных под Redux — эмблема + «N/2» (P85 · CR); оплата — M€; модалка / зона цели атаки (`console-bot-attack-modal`, `table-target-zone`) — если
   промпт с `cause`; полёт 4 растений с места соперника (чип / плитка-заместитель бота) в ряд растений рельса; журнал «крадёт 4 растения у X»; MarsBot-стол с `prelude2Expansion` БРОСАЕТ → карта в руку
   без опции.
5. **Spec апстрима** (`tests/cards/prelude2/SpecialPermit.spec.ts`): `canPlay` 3 / 4, защищённые растения, розыгрыш → `OrOptions` с одной целью, соло, «только игроки с 4+». Всё — байт в байт.

### Подъём сработавшей карты — гипотезы (проверить «до», ни одну не отбрасывать без свидетельства)
- **H1. «Левые» карты рядом — ЧУЖИЕ ГРУППЫ.** `attached` живёт между ответами (обрезка при > 24 — не «отпустить в своём ответе»), а `cardReactionAnswerFlight` забирает ВСЕ невостребованные группы,
  чьи ряды пересекаются с рядами хоста (`rows === undefined` — вообще все): группа прошлого нажатия, которую её хост так и не спросил (сцена прервалась, хост не дошёл до бита ответа, hurry /
  cut), ПОДНИМАЕТСЯ рядом с реактором следующего розыгрыша на том же ряду M€ / растений. Ни корня нажатия (`record.root` = `correlationId`), ни эпохи ответа в фильтре нет.
- **H2. «Левая» карта ПОД поднятой — ТЁПЛОЕ ЛИЦО.** `warmReactorFaces` монтирует лица ВСЕХ групп ответа (и соперника) в ОДИН слот, скрытыми `--warm`, и снимает их только в конце цепочки; группа,
  поднявшаяся НА МЕСТЕ (`domReactorPlace`), свёрнутая (`summarized`), не забранная хостом — оставляет своё тёплое лицо в слое на всю цепочку. Любой путь, который снимает с тёплого лица скрытие
  (твин с отрисованного кадра `opacity .002`, `seatReactor` по ИМЕНИ — два инстанса одной карты, tween `autoAlpha` / инлайн-`visibility`), рисует его в том же прямоугольнике ПОД / НАД поднятым лицом.
- **H3. Подъём на месте поднимает ОБЁРТКУ с несколькими картами.** `liftTargetOf` без `[data-reaction-lift]` поднимает сам элемент хука: если `data-played-key` / `data-composer-card` /
  `data-reaction-home` стоит на обёртке, содержащей ещё одну карту (стопка одинаковых в «Разыграно», слот полки старта с картой «под займом» — `data-played-face` закрыл только один путь, ряд
  миниатюр композера, обёртка героя с законом / партией), scale 1.05 поднимает обе — «карта с картой под ней».
- **H4. Двойной рассказ.** Хост летит ответ сам, но не объявил (`declareHeldAnswers`) → запись идёт standalone: та же карта поднимается ВТОРОЙ раз у кромки рельса после своего полёта (класс известен —
  итерация 6, PL-1102, волна награды заседания; список хостов сверять `grep` ↔ `standaloneOverRawHold` в трейле).
- **H5. Реактор соперника в том же ряду.** `playRivals` ставит лицо соперника на ту же сцену (×0.8, подпись) — если оно встаёт ОДНОВРЕМЕННО с моим реактором в одном ряду, это читается как «левая
  карта рядом». По контракту так задумано (лицо соперника — с подписью) — проверить, что подпись видна и соперник не делит с моим реактором один бит; если делит — разнести во времени (решение 4г).
- **H6. Слой и место одновременно.** Группа поднялась на месте И её тёплое / посаженное лицо встало на сцене (гонка `findReactorPlace` → `undefined` в момент сида, место появилось к подъёму) — два
  экземпляра одной карты (закон «ONE object per card on screen», итерация 3).

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Красная (EVENT), 5, растения, без ПО; эмблема Зелёных — требование; P82; `compatibility: 'turmoil'` + `politics: 'redux'`; оплата — M€.
2. Требование: Зелёные у власти ИЛИ ≥ 2 своих делегата на резолюциях Зелёных (фасад); иначе заперта — эмблема Зелёных + «N/2».
3. Цели: оппоненты с ≥ 4 незащищёнными растениями (Botanical Experience — ≥ 8); бот — `attackableStock`; нет целей → не играется с причиной; соло без бота — +4 растения без вопроса.
4. Розыгрыш → ОДИН промпт атаки с `choiceContext.source {kind: 'card', card: P82}`, цель показана ВСЕГДА (одна — тоже); ответ → у цели −4 (Botanical — −… по апстриму), у игрока +4; метка растений
   события будит реакторы стола (Decomposers +1 микроб, Arklight +1 животное, Viral Enhancers — выбор, Media Group +3 M€ на событие) — записи `cardReactions` с причиной «P82».
5. Превью (read-only, по форме Air Raid): шаг цели `orOptionsStep(previewOptions())`, чип «+4 [растения] N → N+4»; раздача — Redux + Prelude 2 — с маркером; save / reload под вопросом — вопрос снова.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU** — имя «Специальное разрешение» оставить; RU нового ключа описания: «Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на их резолюции. Украдите 4 растения у другого
   игрока.»; лор RU — «Доступ к земле, которую возделала другая корпорация.»; старый ключ с опечатками НЕ трогать (уходит из карты).
2. **Текст** — `metadata.description: 'Requires that Greens are ruling or that you have 2 delegates there. Steal 4 plants from another player.'` (НОВЫЙ ключ; «another» — правда движка: только оппоненты);
   рендер — как есть; манифест — `politics: 'redux'`; `bespokePlay` — `cardSource(this)` в `StealResources` (как Air Raid); `cardPlayPreview` — по форме Air Raid (цель + чип растений); `infoText` —
   только если `make:cards` не засеет блок кражи (проверить).
3. **Свой e2e-стенд — ДА**, `tests/e2e/console-special-permit.spec.ts`, фикстуры одного рецепта `specialPermitFixture(name, arrange)` (Redux + Colonies + Prelude 2; свежий стол — Зелёные у власти):
   **`special-permit`** — 3 места: p2 — 6 растений, p3 — 3 растения (близкий промах); p1 — корпорация Arklight, на столе Decomposers + Media Group (три реактора на одно нажатие: метка растений ×2 +
   событие), 10 M€, P82 в руке; **`special-permit-bot`** — против MarsBot (склад растений бота ≥ 4), те же реакторы; **`special-permit-locked`** — закон Красных принят (Красные у власти), у p1 1 делегат
   на резолюции Зелёных → «1/2». Клетки: (1) `-locked` — плита заперта, эмблема Зелёных «1/2», 0 POST; (2) композер — цель p2 показана (одна доступная — всё равно выбор показан), p3 — промах «3 / 4»,
   чип «+4 растения», «Сработает» — Arklight / Decomposers / Media Group (если ряд прогноза их знает), цена 5, 0 POST; (3) A → цель → ОДИН POST → карта рубашкой в «СОБЫТИЯ» → 4 растения летят с места p2
   в ряд растений (тик на касании) → **реакторы поднимаются РОВНО ТРИ, каждый — свою карту, ни одного лишнего, ничего под ними** (свидетель §3) → флоу уходит; (4) `-bot` — бот как место-цель
   (плитка-заместитель, атакованный ресурс), то же правило подъёма. Сервер: растения p1 +4, p2 −4, микроб на Decomposers, животное на Arklight, +3 M€.
4. **ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА** (§3 — класс, раздел реестра DB): (а) ОДИН вопрос «кто поднимается сейчас» — группы ЭТОГО ответа (кольцо по `seq`, корень нажатия), за вычетом
   объявленных хостами; `attached` живёт ровно один ответ: невостребованная к следующему apply-блоку группа отпускается ЧЕСТНО (её ряды тикают, имя — в состоянии `data-reaction-summarized` /
   трейл `reaction:expired`), `cardReactionAnswerFlight` берёт только группы СВОЕГО ответа (фильтр по эпохе / корню; `rows === undefined` больше не значит «все на свете»); (б) ТЁПЛОЕ ЛИЦО —
   своё на каждый слот, в который группа реально встанет; снимается В ТОТ ЖЕ МОМЕНТ, когда решено, что группа встаёт на месте / свёрнута / забрана без подъёма; слой никогда не держит тёплое лицо
   карты, которой нет в текущей цепочке; `seatReactor` забирает тёплое лицо по КЛЮЧУ группы, не по имени; (в) ПОДЪЁМ НА МЕСТЕ двигает РОВНО ОДНО лицо: цель подъёма содержит ровно один
   хук карточного лица — свой (`CARD_FACE_HOOKS` внутри цели — только она сама), иначе — не место (подъём на сцене); каждый хост, чей хук стоит на обёртке, ставит `[data-reaction-lift]` на тело
   своего лица; (г) ОДИН экземпляр на карту: место и лицо слоя для одной группы взаимоисключающи на всём протяжении (решение «место» фиксируется на подъёме и держится до оседания); реактор
   соперника не встаёт в одном бите с моим (H5 — если «до» покажет, что встаёт); (д) СТОРОЖ — `[reaction] foreign face` (§3) в каждой сборке, красный на каждом e2e-спеке.
5. **Журнал серии / доки / реестр** — §7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача.

## 0. Рабочее дерево
1. `git log --oneline -1` → `2d0eebf585` или новее. `ListAgents` + `git status`; `SendMessage` соседу: твои файлы — карта (`prelude2/SpecialPermit.ts`, манифест — одна строка, спек,
   `prelude2Adaptation.ts` — одна строка, арт P82, `lore_texts.json` — одна строка, `ru/{prelude2_cards,lore_texts}.json`, `src/genfiles/*`), класс (`console/cardReaction/{cardReactionDirector,
   cardReactionStage,reactorPlaces,cardReactionModel}.ts` + спеки, `ConsoleCardReactionLayer.vue`, `console_card_reaction.less`, хосты с хуком на обёртке — `[data-reaction-lift]` одной строкой
   каждый, `tests/e2e/consoleTest.ts` — сторож, новый `tests/e2e/reactionWitness.ts`), фикстуры + стенды, доки, журнал, реестр — своими ханками.
2. e2e — только бокс; `FIXTURES=special-permit,special-permit-bot,special-permit-locked npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 15 %)
- `SpecialPermit.ts`: `description` новым ключом, `cardSource(this)` в `StealResources`, `cardPlayPreview` по форме Air Raid (решение 2); манифест — `politics: 'redux'`.
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P82.png" P82` → `make:cards`); RU; строка `SPECIAL_PERMIT` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт; `describe('on a Turmoil Redux table')`: правила 1–5 по одному `it` — требование (Зелёные у власти на свежем столе / Красные у власти + 2 делегата на
  резолюциях Зелёных / 1 — заперта), цели (4 / 3 / защищённые / Botanical Experience / бот через `attackableStock`), промпт несёт `choiceContext.source` P82, одна цель — всё равно вопрос, ответ
  переносит 4, реакторы — записи с причиной P82 (Decomposers / Media Group — достаточно двух), превью read-only (`previewOptions` не мутирует), раздача под Redux только с маркером, MarsBot-стол,
  save / reload под вопросом.

## 2. Клиент — карта (≈ 5 %)
Даром: причина руки, зона цели атаки с `cause`, полёт растений, журнал. «До» — близкий промах (диагноз 3) и пустая причина «нет цели»; если зона цели игроков не показывает промах — строка
реестра + правка в общем слое (`table-target-zone`), не в карте.

## 3. ГЛАВНОЕ — «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» (≈ 80 %)
**3.1 Свидетель идентичности — СНАЧАЛА, до любых правок.** Новый `tests/e2e/reactionWitness.ts` (`armReactionWitness(page)` → `reactionStory()`), запись `MutationObserver` + `setInterval` 16 мс,
по образцу `transferWitness` / `paintWitness`. Каждый сэмпл:
- **ЗАЯВЛЕНО**: группы цепочки из состояния директора (`cardReactionState.chain.cards` + ключи групп, корень; выставить в `__conReady().reaction`, если ещё нет) и записи кольца этого ответа;
- **НАРИСОВАНО В СЛОЕ**: каждое `.con-reaction__face` с вычисленными `visibility !== hidden` и эффективной `opacity > 0.05` — имя (`data-reaction-card` / `-warm`), ключ, прямоугольник;
- **ПОДНЯТО НА МЕСТЕ**: каждый элемент с `[data-reaction-lifted]` или с не-единичным `transform` среди хуков карточных лиц — имя по хуку; ВСЕ хуки карточных лиц ВНУТРИ цели подъёма;
- **ВЕРДИКТ сэмпла** (красное — с именем карты и причиной): (1) нарисованное / поднятое лицо, чьей группы нет в заявленном → `foreign-face`; (2) два нарисованных лица слоя, чьи прямоугольники
  пересекаются > 20 % площади → `stacked-faces`; (3) цель подъёма на месте содержит хук ДРУГОЙ карты → `lift-carries-another`; (4) одна группа одновременно поднята на месте И нарисована в слое →
  `two-instances`; (5) тёплое лицо нарисовано (visible ∧ opacity > .05) → `warm-painted`.
Прогнать «ДО» на всех стендах фреймворка (`console-card-reaction` — 9 блоков, `hartlan-heating`, `supercomputer`, `lotus-innovations`, `parliament-forestry`, `-craze`, `titan-holdings`, `proteus`,
`medical-institute`) + свой `special-permit` (×2 профиля: fhd, tv4k) + ДВА НОВЫХ сценария, которые бьют в H1 / H3 прицельно: **`STALE`** — два нажатия подряд, где первое оставляет
невостребованную группу (найти хост, чей бит ответа не наступает: hurry → cut посреди цепочки, или закрытие workspace до бита ответа; второе нажатие — реактор на ТОМ ЖЕ ряду), и
**`CASCADE`** — реактор стоит в стопке «Разыграно» / на полке старта под другой картой и поверх неё (FIBER-форма с двумя инстансами). Итог «ДО» — таблица: сценарий × вердикт × карта; кадры
каждого красного — в раскадровку. **Ни одна гипотеза H1–H6 не закрывается словами** — только строкой этой таблицы (красная «до» → зелёная «после» или «не воспроизвелась ни в одном из N»).

**3.2 Чистое ядро — ОДИН вопрос «кто поднимается».** В `cardReactionModel.ts` — `reactionRisers({records, declared, epoch})` → группы, которые этот ответ поднимает, и их способ (место / сцена /
свёрнута), чистая, спек; директор и хосты спрашивают ЕЁ, а не собственные фильтры. Спек — корпус: две группы одного ряда из двух ответов (H1), группа, объявленная хостом (H4), реактор соперника
(H5), два инстанса одной карты (FIBER), пустой ответ.

**3.3 Правки по решению 4 (а–д)** — каждая со своим юнит-спеком:
- (а) `attached` — один ответ; истёкшая группа отпускается честно (тик + имя); `cardReactionAnswerFlight` — фильтр по эпохе / корню; `rows === undefined` — только группы своего ответа. Спек
  `cardReactionDirector.spec` § STALE (группа прошлого ответа не забирается; её ряды не повисают; трейл `reaction:expired`).
- (б) тёплые лица: по слоту группы; снятие в точке решения (место / свёрнута / забрана без подъёма / прервана); `seatReactor` — по ключу группы. Спек `cardReactionStage.spec` § WARM (после
  подъёма на месте тёплого лица этой карты в слое нет; двух лиц одной карты нет; тёплое не рисуется никогда).
- (в) `liftTargetOf` / `visibleReactorHome` — цель с ровно одним хуком лица; обёртки хостов — `[data-reaction-lift]` на теле лица (`grep -rn "data-played-key\|data-composer-card\|data-reaction-home"
  src/client` — каждый хук на обёртке с несколькими картами получает метку лица или перестаёт быть местом). Спек `reactorPlaces.spec` § ONE FACE (обёртка с двумя лицами — не место; метка лица
  выигрывает; `buriedUnderAnotherCard` / `placeShowsCard` — регрессия фиксов 2026-10-30).
- (г) взаимоисключение места и слоя для одной группы; соперник — свой бит (если «до» показал H5).
- (д) СТОРОЖ: директор после каждого шага цепочки (подъём, оседание) проверяет инварианты (1)–(5) §3.1 на живом DOM и пишет `console.warn('[reaction] foreign face …')` с именем и причиной (в каждой
  сборке, как `[transfer] end not painted`); `tests/e2e/consoleTest.ts` — `reactionFaceGuard` красный на этой строке в КАЖДОМ спеке (рядом с `transferEndsGuard`). Без пауз и таймеров; проверка —
  чтение DOM, ничего не двигает.
- Ничего из итераций 3–6 не откатывается: место у кромки рельса, темп, hurry / cut, `declareHeldAnswers`, партии / законы / гидросеть, сцена «ОТВЕТ СТОЛА».

**3.4 «ПОСЛЕ»** — та же таблица по тем же сценариям: все вердикты зелёные; темп стендов TIMING (`console-card-reaction` HURRY / SLOW, `hartlan-heating`) — в их собственных допусках; сторож молчит на
полном `npm run e2e:affected` + стендах фреймворка.

## 4. Лицо, локаль, лор, арт
Арт P82; лор EN + RU; RU описания (решение 1); «резолюция», «Зелёные», «у власти» — глоссарий; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack` (маркер), `premiumScope`, **`cardPlayPreviewCoverage`** (bespoke с превью), `cardInformation`, `requirementProse` (EN + RU требования Зелёных),
   `premiumCardViewModel`, `cardLore`, `crossPlayerCoverageGuard` (атака — у соперника своя строка журнала), `parliamentGlossary`, `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`,
   `e2eLiveness`, `transferSurfaceClear` (новый файл со словом `onLeft` — в allow-list с причиной или `surfaceClear`), `tests/Game.spec.ts` «serializes properties» (если тронуто кольцо), `tests/client/i18n.spec.ts`;
   класс — `cardReactionModel.spec` § risers, `cardReactionDirector.spec` § STALE, `cardReactionStage.spec` § WARM, `reactorPlaces.spec` § ONE FACE.
2. `build:server`, `build:test`, `lint` (включая `lint:client` — vue-tsc ловит type-only импорт, который webpack-чекер пропускает, память CN), `make:cards` 0 / 0 / 0, `make:json`; ПОЛНЫЕ `test:server` /
   `test:client` на тихой машине (CI ловит пины, которых гарды не покрывают — память CN).
3. e2e: свой стенд ×3 фикстуры; свидетель «до / после» (§3.1 / §3.4); `npm run e2e:affected`; стенды фреймворка — §3.1; `console-bot-attack-modal` / Air Raid (атака с `cause`), канарейка.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p82/tv4k/`: (а) `-locked` — плита заперта, эмблема Зелёных «1/2»; (б) композер — цель p2, промах p3 «3 / 4», чип «+4 растения»; (в) коммит — карта рубашкой в «СОБЫТИЯ», 4 растения с места p2;
(г) **ДО / ПОСЛЕ** подъёма реакторов — кадр, где стоят ВСЕ поднятые лица (ровно три, подписаны свидетелем), и кадр «под лицом» (тёплое / второе лицо — если было); (д) `-bot` — бот как цель, подъём;
(е) **ДО / ПОСЛЕ** STALE и CASCADE — красные кадры «до» с вердиктом свидетеля. Своим глазом: «поднимается ровно то, что сработало, по одному экземпляру, и под ним ничего нет?»

## 7. Полировка по пути / доки
1. Реестр **DB** «P82 · ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА — ГРУППА ЖИВЁТ ОДИН ОТВЕТ, ТЁПЛОЕ ЛИЦО НЕ ПЕРЕЖИВАЕТ РЕШЕНИЯ, ПОДЪЁМ ДВИГАЕТ ОДНО ЛИЦО, СТОРОЖ НА КАЖДОМ СПЕКЕ · АТАКА С ПРИЧИНОЙ
   И ПРЕВЬЮ» — H1–H6 строками «что было (вердикт свидетеля «до») / что стало / где» + находки прохода карты; номера — по footer.
2. Доки: журнал серии (P82, двенадцатая запись); `PRELUDE2_ADAPTATION.md` (12 / 54; строка; §3.1 п. 3 — одно предложение «атака bespoke-карты передаёт `cause` и имеет превью по форме Air Raid»);
   **`docs/claude/console/card-reaction.md`** — раздел «ИДЕНТИЧНОСТЬ ПОДЪЁМА» (одиннадцатый закон: «поднимается только группа этого ответа, по одному экземпляру, подъём двигает одно лицо; сторож
   `[reaction] foreign face`»); `.claude/rules/animations.md` § СРАБАТЫВАНИЕ КАРТЫ — одна строка со сторожем; память `card-reaction-framework-prompt` (итерация 7) и `prelude2-adaptation.md` (12 / 54).

## 8. Режим работы
1. Читать до кода. Порядок: карта (описание, маркер, `cause`, превью) + спек + строка долой → лор / арт / RU → `make:cards` → фикстуры + стенд карты → **свидетель + «ДО» по всем сценариям** →
   ядро 3.2 → правки 3.3 (а → б → в → г → д), каждая со спеком и прогоном своих сценариев → «ПОСЛЕ» → регрессия → реестр → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; **таблица свидетеля «до / после»** (сценарий × вердикт × карта); POST на розыгрыш (ОДИН + цель); гарды и `make:cards`; регрессия на боксе
   (аннотация `build`); решения 1–5 (что сделано по каждому); гэпы честно (гипотеза, не воспроизведённая ни в одном сценарии, — названа так); что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Атака без показанной цели (одна — тоже); автовыбор цели; определять промпт по заголовку; голая причина «нельзя» без имени; бот как «склад» словами (только место-цель стола).
- Чинить подъём ПАУЗОЙ, таймером, `opacity: 0` поверх лишнего лица, `overflow: hidden` над слоем или отключением тёплых лиц целиком (прогрев — решение итерации 3, его ценность — без кадра
  раскладки в первом кадре подъёма); убирать сторож «потому что флейкает» — флейк сторожа = гонка, которую он ловит; закрывать гипотезу без строки таблицы свидетеля.
- Откатывать решения итераций 3–6 (место у кромки рельса, темп, hurry / cut, `declareHeldAnswers`, партии / законы / гидросеть, «ОТВЕТ СТОЛА»); ореол / свечение / петля; `title`; литерал кнопки; `v-if`-моргание.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; переоткрывать находки P76…P70.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` / `--no-verify`; коммитить чужие файлы
  (`package.json` / `package-lock.json`); пересборку во время прогона e2e на боксе.
