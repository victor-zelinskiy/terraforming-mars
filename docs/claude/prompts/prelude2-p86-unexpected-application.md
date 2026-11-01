# Промт исполнителю · P86 Unexpected Application («Неожиданное применение») — ДВАДЦАТАЯ карта Prelude 2, не политическая, Venus (`docs/PRELUDE2_ADAPTATION.md` §3.1, форма 1 — ДЕКЛАРАТИВНАЯ): красная (EVENT), 4 M€, метка Венера; «Сбросьте 1 карту, чтобы повысить шкалу Венеры на 1 шаг» — `behavior: {spend: {cards: 1}, global: {venus: 1}}`. ЕДИНСТВЕННАЯ карта скоупа с `spend.cards`: сброс — ЦЕНА розыгрыша, и сегодня эта цена НЕ пре-коллектится (превью декларации не знает `spend.cards`), поэтому после нажатия «A Разыграть» сервер оставляет живой `SelectCard` и консоль открывает ВТОРОЙ экран — руку в режиме сброса ПОСЛЕ розыгрыша. Владелец: «главное — бесшовный вход как pre-select выбора карты на сброс». Карта ≈ 25 % (шаг превью для `spend.cards` + дверь ухода сброшенной карты на нажатии — класс PL-1128, названный P68) · ПОЛИРОВКА ≈ 75 % — две задачи владельца: **(А) счётчик «СБРОШЕНО» стопки стола иногда остаётся «0» после сброса** (счёт тикает ТОЛЬКО на физическом касании — `landOnPile` внутри GSAP-таймлайна; любой путь, где касание не состоялось — сторож `guarded`, стоп rAF, аборт арбитра живости, деградация сцены добора — оставляет стопку с «0»: правда сервера никогда не сверяется) и **(Б) при открытии «Продажи патентов» не виден веер раскрытия руки из дока** — полёт тел руки ИДЁТ, но ПОД непрозрачной панелью «Стандартных проектов»: слой тел `.con-handreveal-layer` под `con-ws--dockcover` опускается на `z 11469` всякий раз, когда нет `con-root--dock-intake`, а лиз интейка эпизода открытия отпускается в `finally` сразу после УСТАНОВКИ таймлайна, не после его конца (`openHandWithReveal` ↔ `runHandOpenEpisode`); правило «эпизод полёта никогда не сосуществует с dockcover-поверхностью — открытие руки заменяет workspace латерально» (`console.less:2100–2106`) устарело 2026-08-13, когда продажа стала ШАГОМ внутри workspace, и 2026-10-25, когда каждый хостимый пик стал открывать руку физически. Владелец: «сделай хорошую полировку, чтобы ВСЕ подобные сцены были видны и хорошо проработаны» — значит ВСЕ хостимые открытия руки (продажа в стандартных проектах, сброс Плутона в секции колоний (`--footer-behind` → слой на `z −2`, без исключения для интейка вовсе), сброс Красных в Парламенте, пик композера, шаг старта, живой шаг закона) — ОДИН закон слоя + ОДИН свидетель.

> **Статус: ВЫДАН 2026-11-01.** HEAD `c2df05a548` (ДИРЕКТОР ЭКРАНА фаза 0 — раздел **DL**, последний номер **PL-1332**; P84 сдана `1da5a8abe1` + `5b63085c07`, раздел DK; ворклист **19 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись ДВАДЦАТАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты; `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> ⚠ **СОСЕДИ** (`ListAgents`: `terraforming-mars-d9` — занят, `-4f` — свободен). Грязны в момент выдачи: **`ConsolePlayCardConfirm.vue`** (лист розыгрыша P81 — сосед), `ConsolePaymentPanel.vue`, `paymentPlan.ts`,
> `played/payloadCarry.ts`, `screenDirector.ts`, `consoleLeakDetector.ts`, **`console.less`**, `console_payment.less`, `console_tv.less`, **`tests/e2e/consoleTest.ts`**, **`tests/e2e/fixtures/generate.ts`**, `consoleStart.ts`,
> ~15 e2e-спеков (canyon-carving, colony-sponsors, exclusive-colony, green-allegiance, minority-representation, nova-city, political-donation, re-settlement, red-lawyers, soil-studies, variant-settle, play-composer-sheet, …),
> `console-ui.md`, `README.md`, `workspace-band.md`, реестр, журнал серии. **Твоя область — ЧИСТА**: `models/actionPreview.ts` (`stepsForBehavior`), `behavior/Executor.ts`, `inputs/discardPrompt.ts`,
> `cardDiscard/*` (`consoleCardDiscard.ts`, `discardDirector.ts`, `discardModel.ts`), `discardPile/discardPile.ts`, `ConsoleDiscardPile.vue`, `handDock/handRevealDirector.ts`, `handDock/consoleDockAccent.ts`,
> `ConsoleHandRevealLayer.vue`, `played/consolePlayedHero.ts`, `ConsoleStdProjectsScreen.vue`, `conWsPresenceBridge.ts`. В ГРЯЗНЫХ файлах твои правки — ТОЛЬКО объявленным ханком через temp-index (`split-commits-by-hunk-temp-index`:
> НИКОГДА `git apply --unidiff-zero`; проверка — eslint/parse STAGED-блоба + diff blob↔worktree = только чужие ханки): `ConsolePlayCardConfirm.vue` — одно место (взвод сцены сброса на нажатии), `console.less` — два правила z,
> `consoleTest.ts` — один сторож, `generate.ts` — одна фикстура; `ConsoleShell.vue` сейчас чист — если к твоему шагу испачкан, тот же приём. ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`; `SendMessage` занятому со списком §0.
> `package.json` / `package-lock.json` (`MM`) — не твои.
> Промты-образцы: **`prelude2-p68-ceres-tech-market.md`** (КЛАСС, который эта карта переносит на дверь РОЗЫГРЫША: пре-селект сброса в альбоме → сцена ухода армируется на НАЖАТИИ, источник — тело карты в ДОКЕ; запись журнала P68
> «Найдено» №1 и «Что даром» — PL-1125 / PL-1126 / **PL-1128** «сброс из РОЗЫГРЫША с пре-коллектом — та же дверь»), `prelude2-p84-stratospheric-expedition.md` (закон бюджета владельца: ни одной новой миллисекунды; событие
> платит лицом), `prelude2-p81-soil-studies.md` (ЛИСТ РОЗЫГРЫША — композер, в котором стоит твоя строка сброса), `docs/claude/console/composer-preselect.md` (T14 — единственный кандидат ПОСЕЯН и ПОКАЗАН),
> `docs/claude/console/workspace-band.md` § «Один язык сброса — два входа» (`:1384`), § РОЗЫГРЫШ КАРТЫ / § ЦЕНА РОЗЫГРЫША С РЕЛЬСА (PL-107 — такт ПОСТАВКИ `shipPrice`), `docs/claude/console/hand-album.md` § THE SINGLE
> OWNER (`:222–296`; «THE COVER CONTRACT MOVED WITH THE CARDS» `:260–265`), `docs/claude/console/hand-dock-presence.md` (интейк — ОГРАНИЧЕННЫЙ ЛИЗ), `docs/claude/console/standard-projects-workspace.md` § The hosted step's
> ONE entry (`:178–196`), `.claude/rules/console-ui.md` § A CARD FROM THE HAND IS CHOSEN IN THE HAND (④ «пик — ФРАЗА, не склейка»; «…every route that stands the album for a pick OPENS the hand physically»),
> § HAND DOCK presence, § «СБРОС — ОБЪЕКТ СТОЛА» (правило 3 «счёт тикает на КАСАНИИ … reveal без сцены подтягивает до счёта сервера» — ровно половина закона, вторую половину ты пишешь), § STATE DELIVERY (правда раньше
> истории — инвариант 16), `.claude/rules/animations.md`, `.claude/rules/server.md` § «…a parked answer lands only on ITS OWN prompt — the ADDRESS decides», CLAUDE.md § Physical causality, § Project goals 3–4, инвариант 17.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P86.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\Unexpected Application.png` (в `Downloads` корнем).
> Лор — СО СКАНА, дословно: «Wouldn't something similar work on Venus?» (вопросительный знак — конец; гард лора); «EKATERYNA ZUBAL» на скане — художник, не лицо.
> Реестр: последний раздел **DL**, последний номер **PL-1332** → эта задача берёт **DM**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p86` → `npm run e2e:remote -- p86 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL; стопка под нагрузкой и
> веер под хостом — TIMING (`--exclusive --workers=1`); раскадровка — TV (`TM_E2E_STORYBOARD=1`).
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 1**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P68 — класс сброса из шага; P84 — закон бюджета; не переоткрывать),
`docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7, `docs/claude/ru-translation-standard.md` (читать ДО любого RU-текста: «шкала Венеры», не «показатель Венеры» — **существующий RU карты нарушает планку, см. решение 1**),
CLAUDE.md § A WORKSPACE IS ONE FLOW, инварианты 3, 4, 6, 14, 15, 16, 17. Память: `rules-first`, `upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `ab-baseline-head-client-in-snapshot`,
`e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `split-commits-by-hunk-temp-index`, `trivial-card-prompts-no-owner-questions`,
`visual-restraint-no-glow`, `hand-pick-always-album`, `hand-pick-played-card-hidden`, `panel-reward-hold-is-shared`, `prelude2-adaptation`.

**Образцы — по частям.** Карта: `prelude2/UnexpectedApplication.ts` (EVENT, 4, `[VENUS]`, `spend: {cards: 1}`, `global: {venus: 1}`, рендер `minus().cards(1).venus(1)`, `description` — RU есть `ru/cards.json:712`,
RU-имя «Неожиданное применение» `:711`), манифест `Prelude2CardManifest.ts:79` (`compatibility: 'venus'`), апстримный спек `tests/cards/prelude2/UnexpectedApplication.spec.ts` (3 `it`: нельзя без второй карты; розыгрыш →
`SelectCard` без себя → сброс в `discardPile`; «не считает себя»). СЕРВЕР: **`behavior/Executor.ts:179–185`** (`canExecute`: нужна ≥ 1 ДРУГАЯ карта в руке) и **`:472–490`** (`execute`: `player.defer(new SelectCard(message('Select
${0} card(s) to discard'), undefined, cards, {min, max}).markDiscardPrompt(cardDiscard(card, {min, max})).andThen(… inplaceRemove + projectDeck.discard …; this.execute(remainder)))` — остаток поведения (шаг Венеры) ВНУТРИ
коллбэка сброса: сброс — ПЕРВЫЙ деферред розыгрыша, цена раньше результата по порядку исполнения), `inputs/discardPrompt.ts:33` (`cardDiscard(card, bounds, extras)` — ОДИН строитель маркера), **`models/actionPreview.ts:892`**
(`stepsForBehavior` — «ORDER IS LOAD-BEARING … spend.steel source split → addResourcesToAnyCard → …» — `spend.cards` в списке НЕТ: ни шага, ни предупреждения), `cards/actionPreviews.ts:1122` (`selectCardStep(player, title, label,
cards, {min, max, for, discard, disabled})`), `venusNext/SponsoredAcademies.ts:88–108` (ОБРАЗЕЦ пре-коллекта сброса: `for: {role: 'discard', source: cardSource(this)}`, `discard: {…this.discardOptions()}` — тот же маркер, что у
живого промпта), `models/preselectAddresses.ts:16–22` + `common/inputs/preselectAddress.ts:44–82` (роль `discard` — `card`-пик с `discardPrompt`), `models/unplayableReasons.ts` (причины «нельзя разыграть» — для `spend.cards`
строки нет), `Player.discardCardFromHand(card, {log})` `:2308`. КЛИЕНТ — пре-селект: `ConsolePlayCardConfirm.vue:5205–5250` (дверь пика руки из композера: `enterConsoleHandPick({… discard, leaving: 'none', source: {kicker:
'Play card', card}})`, `handPickOpen`, строка ответа «Сбросить: …» `:3954`), `:1950–1964` (`discardAnswers` — два сброса никогда не называют одну карту), `consoleHandPick.ts:138` (`handPickArmsDiscardTray` — `leaving: 'none'` не
взводит лоток), **`ConsoleActionComposer.vue:6551–6559`** (`armPreselectedDiscards(branch)` — P68: маркер шага + захваченный ответ → `armPreselectedDiscard(names, meta)` на нажатии; **в play-композере этой двери НЕТ** — пре-селект
Sponsored Academies / Strategic Shift уходит из дока МОЛЧА), `consoleCardDiscard.ts:170–190` (`registerPreselectedDiscardArm` / `armPreselectedDiscard`), `ConsoleShell.vue` `armDiscardScene(names, preselected)` (источник —
`discardSourceElement`: слот альбома → зум → **тело в доке `[data-hand-dock-card]`**), транспорт `gameTransport.ts:872–885` (ворота героя розыгрыша — РАНЬШЕ) и `:976–984` (ворота сброса — ПОЗЖЕ: `detectCardDiscard` →
`runCardDiscard`), `played/consolePlayedHero.ts:1199–1240` (`shipPrice` — такт ПОСТАВКИ: счёт закона → `shipStockSpends` ∥ `shipCardPrice` ∥ `shipTargetSpends` ∥ `shipArmedEffects` → один `TRANSFER_BEAT_MS` → подъём).
СТОПКА: `discardPile/discardPile.ts:155–168` (`landOnDiscardPile` — `count++` на касании; `ensureDiscardPileCount(n)` — «никогда не ниже»), `:187–197` (`noteDiscardPileClosed` — счёт в 0 после ухода), `ConsoleDiscardPile.vue`
(`data-discard-pile-count`, `ConsoleFlipValue`), `cardDiscard/consoleCardDiscard.ts:262–330` (`runCardDiscard`: A fixate → B flip → C gather → D hand-off (`trayVisible` → лиз `hand-discard` в `ConsoleCardDiscardLayer.vue:57–66`)
→ `waitForTray(12)` → E+F `runDiscardCarry(spawned, t, () => alive() && landOnPile())` → `runDiscardPileSettle`; `spawned.length === 0` → уход без касания и без лотка), `discardDirector.ts:153–168` (**`guarded` — сторож
`setTimeout(done, budget + 1200)`: при простое rAF промис разрешается БЕЗ `tl.call(onLanded)`**), `:298–363` (`runDiscardCarry` — `tl.call(() => onLanded(i), …, landAt)`; без якоря лотка — честный уход вниз, `onLanded` на 0.8
carry), `:366–403` (`landOnPile` → `noticeDiscardLanding` + `landOnDiscardPile`; `runDiscardTrayWithdraw` — ЧТЕНИЕ 0.58·settle, потом `releaseDiscardPile`), `consoleCardDiscard.ts:333–380` (`endCardDiscard`, ступень арбитра
живости ранг 20 `abortCardDiscard` — уход без касания), `ConsoleRevealOverlay.vue:1758–1785` (лиз `reveal:<id>`; `syncDiscardPileCount` — `ensureDiscardPileCount` ТОЛЬКО при `!deckDrawState.active && !streaming`; `:2879`),
`deckDraw/ConsoleDeckDrawLayer.vue:560, :668, :1204, :1285` (лиз `scene:` / `stream:`; `landOnDiscardPile` в `onLanded` бита — тоже только касание), `consoleDeckDraw.ts:71–73` (PL-280 — reduced motion уже ловил «счёт раньше
касания»). ВЕЕР: `ConsoleShell.vue:15912–15968` (`openHandWithReveal`: `beginDockIntakeAccent('hand-open')` → `openHandWorkspace` → `settledPaint` → `transitionTargets()` → `await runHandOpenEpisode(pairs, stage)` → **`finally
releaseAccent()`**), `handDock/handRevealDirector.ts:410–500` (`runHandOpenEpisode` — строит таймлайн, `installEpisode(...)`, ставит колбэки и ВОЗВРАЩАЕТСЯ — полёт играет ПОСЛЕ резолва; `installEpisode :809` — своего лиза
интейка НЕТ; `:896` — только путь ОТМЕНЫ держит `ep.accentRelease ??= beginDockIntakeAccent('hand-open-cancel')`; `teardown :395–405` отпускает `ep.accentRelease`), `handDock/consoleDockAccent.ts:58–110` (лиз, потолок
`ACCENT_MAX_MS` 6000), `ConsoleShell.vue:3366–3371` (`dockIntakeAccent` → класс `con-root--dock-intake` `:8922`; `con-root--ws-dockcover` `:8906` ← `conWsPresenceBridge.ts:104` (`.con-ws--dockcover` в DOM); `con-root--footer-behind`
`:8928` ← `dockBehindWorkspace`), **`console.less:2096–2109`** (`.con-root--ws-dockcover .con-handdock:not(--receiving) .con-handdock__pack {z: 11469}`; `.con-root--ws-dockcover:not(.con-root--dock-intake) .con-handreveal-layer
{z-index: 11469}` с комментарием-предпосылкой «A flight EPISODE never coexists with a dockcover surface»), `:2110–2120` (`.con-root--footer-behind .con-handreveal-layer {z-index: -2}` — без исключения для интейка),
`console_card_deal.less:644–650` (слой `z 11645`), носители `con-ws--dockcover`: `ConsoleStdProjectsScreen.vue:7`, `ConsoleMaScreen.vue:4`; `ConsoleStdProjectsScreen.vue:170–172` (зона `.con-stdp__step[data-embed-slot="stdp-step"]`),
`console.less:14412–14440` (`&__step` — `position:absolute; inset:0`; `> * {animation: con-stdp-step-in 260ms … 90ms backwards}` — хостимая рука входит из `opacity 0`), `ConsoleShell.vue:17660–17686` (`activateStdItem`
'sell-patents': `sale.active = true` → `armStdpStepOrigin` → `openHandWithReveal({keepTask: true})` → `setWorkspaceFrameStage('hand', 'Card selection')`), `consoleActionOutcomeMotion.ts:97–127` (`playOutcomePhase` — UNFOLD зоны
клипом из ректа строки `PHASE_MS·0.72` ∥ каскад), другие хостимые открытия: `ConsoleShell.vue:14536` (сброс Плутона в секции колоний), `:20646` (мандатный пик), `:20783` (сброс открывает руку), `:20800` (живой шаг закона),
`:20817` (сброс Красных), `:13240` (пик композера `hosted`), `:13285` (`playPickActive`). Кадр «как сейчас»: `screenshots/stdp-workspace/04-sale-step.png` (осевший шаг продажи — две карты уже в альбоме; раскадровки ВХОДА нет —
снять), `screenshots/card-discard/*-4-landed.png` (стопка с «1» после касания — счастливый путь).

---

## Диагноз (подтверждён файл:строка на `c2df05a548`; перепроверить на своём HEAD)

**U1 · Цена «сбросьте 1 карту» не пре-коллектится — розыгрыш распадается на ДВА экрана.** `stepsForBehavior` (`actionPreview.ts:892–935`) объявляет шаги для `spend.steel` (сплит источника), `addResourcesToAnyCard`,
`decreaseAnyProduction`, `removeAnyPlants`, колоний и плиток — `spend.cards` в порядке исполнителя не значится вовсе. Превью P86 — одна ветка без шагов; композер (лист P81) показывает цену «4 M€» и чип «Венера +1», игрок жмёт A,
ОДИН POST розыгрыша уходит БЕЗ ответа на сброс → сервер оставляет `SelectCard` (`Executor.ts:474–480`, маркер `cardDiscard(card)`) → консоль честно обслуживает его `handSelect`-задачей: сцена розыгрыша (событие лицом, P84)
ПЕРЕБИВАЕТСЯ рукой в режиме сброса, крошка «КАРТЫ В РУКЕ › СБРОС КАРТЫ» без карты-источника в хвосте, шаг Венеры приходит третьим экраном. Это ровно картина «вопрос ПОСЛЕ нажатия», которую закон пре-селекта (TR43, `server.md`)
запрещает для всего, что превью МОЖЕТ спросить заранее; `cardPlayReplayCoverage.spec` молчит только потому, что карта ещё в hold-back-списке — удалишь строку, и чек 1 («nothing parked, nothing asked twice») назовёт её.
Порядок известен: сброс — ПЕРВЫЙ деферред (`:474`, остаток — внутри его коллбэка), титул — `message('Select ${0} card(s) to discard')`, кандидаты — рука без самой карты, адрес — `{role: 'discard', source: {kind: 'card', card}}`
(`promptAddressOf` читает его с маркера `discardPrompt.source`, `preselectAddress.ts:82`).

**U2 · Пре-собранный СБРОС розыгрыша уходит из дока МОЛЧА (PL-1128 — названо P68, не чинилось).** В `ConsoleActionComposer.vue:6551–6559` действие взводит сцену сброса на нажатии (`armPreselectedDiscards` → `armDiscardScene(names,
meta)` → источник — тело карты в доке); в `ConsolePlayCardConfirm.vue` такой двери нет: ответ шага-сброса (Sponsored Academies, Strategic Shift, а теперь P86) едет в батче, сервер убирает карту из руки, и `detectCardDiscard`
(`gameTransport.ts:976`) видит `armed === undefined` → никакой сцены: карта исчезает из дока в кадре применения вида, стопка не выходит, счёт стопки не тикает. Нарушение физической причинности (CLAUDE.md) и «No silent loss»
в его визуальной форме.

**U3 · Порядок двух ворот транспорта — результат раньше цены.** Даже с взведённой сценой ворота героя (`gameTransport.ts:872–885`) стоят РАНЬШЕ ворот сброса (`:976–984`): карта улетела бы на стол, легла лицом, оплатила,
и только потом ушла бы сброшенная. У P86 сброс — ЦЕНА (`spend`), и в исполнителе он первый. Закон PL-099/PL-107 (цена с рельса уходит ДО взлёта — такт ПОСТАВКИ `shipPrice`, `consolePlayedHero.ts:1199–1240`) уже знает три
поставки параллельно (склад, ресурс карты, цель); карты из руки среди них нет.

**U4 · Причина «нельзя разыграть» для `spend.cards` не названа.** `Executor.canExecute` (`:179–185`) возвращает `false` без причины; `models/unplayableReasons.ts` не знает `spend.cards` → карта в альбоме «Нельзя разыграть» без
слова (инвариант 2/4: заблокированное — с причиной).

**U5 · RU-текст карты нарушает планку.** `ru/cards.json:712`: «…повысить **показатель** Венеры на 1 шаг» — стандарт (`ru-translation-standard.md:59`) запрещает «показатель Венеры» в пользу «шкалы Венеры». Текст
ВВЕДЁН картой (ключ её собственный) — исправить можно.

**П-А · «СБРОШЕНО: 0» — счёт стопки есть число КАСАНИЙ, не правда сервера.** `discardPileState.count` растёт только в `landOnDiscardPile()` (`discardPile.ts:155–158`), который зовут исключительно колбэки касания таймлайнов:
`runDiscardCarry` → `tl.call(onLanded, landAt)` (`discardDirector.ts:356`; обёрнут `alive()` — `consoleCardDiscard.ts:313`), биты сцены добора (`ConsoleDeckDrawLayer.vue:668, :1285`). Пути, где стопка ВЫХОДИТ (лиз взят,
`v-if` смонтирован, «СБРОШЕНО 0» на экране), а касания нет: (1) **сторож `guarded`** (`discardDirector.ts:162`: `setTimeout(done, budget + 1200)`) — при простое rAF (тяжёлый кадр, компиляция шейдеров на GPU бокса,
фон-вкладка/оверлей gamescope) промис carry разрешается ПО ТАЙМЕРУ, фаза идёт в `landing → settling → endCardDiscard → release`, а `tl.call` срабатывает позже, когда `alive()` уже false — счёт так и не тикнул, стопка ушла с «0»
(или стояла с «0» всё чтение); (2) **аборт** — арбитр живости ранг 20 (`consoleCardDiscard.ts:347–358`), `DISCARD_SAFETY_MS`, ошибка транспорта (`gameTransport.ts:1665`) — `finishCardDiscard` без сверки; (3) **сцена добора**:
`syncDiscardPileCount` ревила (`ConsoleRevealOverlay.vue:2879`) подтягивает счёт ТОЛЬКО когда `!deckDrawState.active && !streaming` — зависший/оборванный флаг сцены держит «0» весь ревил (PL-280 — тот же класс, закрыт
точечно для reduced motion); (4) **`spawned.length === 0`** (`consoleCardDiscard.ts:280–287`: источник неизмерим — карта на другой странице альбома / отфильтрована / док в компактной позе) — честный уход, но если лиз уже стоит
у другого владельца (ревил, колония), стопка видна с «0». Общий корень один: **правда сервера (сколько карт ушло — `cardDiscardTransaction.names` после `detectCardDiscard`, `discardedCards.length` ревила, `hasDiscards` сцены)
никогда не сверяется со счётом стопки при выходе из эпизода** — инвариант 16 «правда раньше истории» в его стопочной форме. Стопка ОБЯЗАНА сказать правду к моменту ЧТЕНИЯ (`runDiscardTrayWithdraw` — 0.58·settle «посмотри на
счёт») и в любом аборте — касание лишь УСКОРЯЕТ правду, никогда не заменяет её.

**П-Б · Веер открытия руки под хостом ИДЁТ, но ПОД ПАНЕЛЬЮ.** Продажа патентов: `activateStdItem` (`ConsoleShell.vue:17660–17686`) → `openHandWithReveal({keepTask: true})` → лиз `beginDockIntakeAccent('hand-open')` →
`runHandOpenEpisode` строит таймлайн, `installEpisode`, ставит `onComplete` и **возвращается** (`handRevealDirector.ts:487–500`) → `finally releaseAccent()` (`ConsoleShell.vue:15966`) — лиз отпущен в тот самый тик, когда тела
ТОЛЬКО ВЗЛЕТАЮТ. `dockIntakeAccentActive()` → false → класс `con-root--dock-intake` снят → правило `console.less:2107` опускает `.con-handreveal-layer` на `z 11469` (под `.con-stdp` 11480+): весь полёт dock → альбом играет
ЗА непрозрачной панелью стандартных проектов, а в зоне шага игрок видит, как хостимая рука ПРОЯВЛЯЕТСЯ (`con-stdp-step-in`, `opacity 0 → 1`) с уже лежащими картами — «сцена-заглушка». Предпосылка правила
(`console.less:2100–2106`: «A flight EPISODE never coexists with a dockcover surface — opening the hand replaces the workspace laterally») ложна с 2026-08-13 (продажа — шаг внутри workspace) и с 2026-10-25 (каждый хостимый
пик открывает руку физически — `console-ui.md` § «every route that stands the album for a pick OPENS the hand physically»). Тот же дефект, хуже: `.con-root--footer-behind .con-handreveal-layer {z-index: -2}` (`:2118`) — БЕЗ
исключения для интейка вовсе: сброс Плутона, хостимый в секции колоний (`ConsoleShell.vue:14536`), и любой хостимый пик в секциях с «подвёрнутым» футером летят под секцией всегда. Путь ОТМЕНЫ эпизода уже держит собственный
лиз (`:896` `hand-open-cancel`) — то есть автор знал, что лиз должен жить с эпизодом, и закрыл один путь из двух. Второй кандидат на том же входе, проверить раскадровкой: UNFOLD зоны `stdp-step` клипом из ректа строки
(`playOutcomePhase`, `PHASE_MS·0.72`) ∥ полёт тел — слоты посадки под клипом, пока развёртка не кончилась; если касание тел раньше конца развёртки — слоты «щёлкают» внутри клипа (хэндовер ждёт зону, см. решение 4).

---

## Решения (приняты; вопросов владельцу нет)

1. **Карта — декларация остаётся; `spend.cards` становится ШАГОМ ПРЕВЬЮ, первым (U1), и уходит через канонический сброс.** В `stepsForBehavior` — ПЕРВЫМ (до сплита стали — в поведении один вид `spend`, конфликта порядка нет;
   комментарий порядка дополнить `spend.cards →`): `selectCardStep(player, message('Select ${0} card(s) to discard', n), 'Discard', hand без card, {min: n, max: n, for: {role: 'discard', source: cardSource(card)}, discard:
   cardDiscard(card, {min: n, max: n})})` — ОДИН строитель маркера для живого промпта и шага (вынести в `Executor` статический/общий `behaviorCardDiscard(card, n)` и звать из обоих мест; гард — байт-паритет `step.input.discardPrompt
   ≡ live.toModel().discardPrompt` и титула). Кандидатов меньше `n` → шаг НЕ объявляется (карта и так не разыгрывается — `canExecute`). Исполнение: `.andThen` переводится на `player.discardCardFromHand(c, {log: true})` (P68:
   запись рекордера, строка журнала «сбросил …», лента/нотификации видят сброс; апстримный спек проверяет `discardPile` — зелёный). Причина (U4): `unplayableReasons.ts` получает ветку `spend.cards` → новый EN-ключ
   «Requires another card in hand to discard» (RU по планке, одна причина — инвариант «ONE blocker»); `Executor.canExecute` без изменений (он уже честен). RU (U5): `ru/cards.json:712` → «Сбросьте 1 карту, чтобы поднять
   шкалу Венеры на 1 шаг.» — сверить глагол шага Венеры с соседними картами набора (`grep "шкалу Венеры" ru/cards.json`) и взять ИХ форму; имя «Неожиданное применение» остаётся. Строка hold-back — долой (и только она);
   `make:cards` 0 / 0 / 0; лор + арт + миниатюра; спек: апстримный блок байт в байт + премиальные `it` (превью = один шаг `card` с маркером и адресом, кандидаты без себя; с одной другой картой — шаг объявлен (T14 — вопрос
   задаётся); без других — не в playable + причина; батч розыгрыша с адресованным ответом → ни одного оставленного промпта (`churn`-образец `cardPlayReplayCoverage`); сброс записан событием + строкой журнала; Венера +1 и РТ +1
   ПОСЛЕ сброса (порядок событий); save/reload посреди (промпт восстановлен с тем же маркером); MarsBot). `cardPlayReplayCoverage` чек 1 и чек 3 («ADDRESSED») — зелёные без строки в ворклисте.

2. **Вход в сброс — БЕСШОВНЫЙ ПРЕ-СЕЛЕКТ из листа розыгрыша (владелец).** Строка шага в композере P81 читает «Сбросьте 1 карту» (`cardPickAskKey(amount, discard)` — P68 PL-1127 уже выправил формулировку для действия;
   проверить, что play-композер зовёт ту же функцию с `discard`), A на ней → альбом «КАРТЫ В РУКЕ › НЕОЖИДАННОЕ ПРИМЕНЕНИЕ › СБРОС КАРТЫ» ФРАЗОЙ (`handStagePickPause/Resume` — отпустить на месте, проявить; никакого кроссфейда
   и `v-if`), кожа сброса с СЫРОГО маркера (кикер источника — карта, глагол «Сбросить», без обмена — сброс покупает шаг Венеры: **плашка «→ [Венера] +1» в строке вопроса альбома, если `discardIntent` умеет только ресурс/карты —
   расширить `exchange` формой `{icon: 'venus', amount: 1}` НЕ надо: это не обмен маркера, а чип результата композера; в альбоме — ничего нового, строка вопроса одна**), разыгрываемая карта НЕ в альбоме (`hand-pick-played-card-hidden`),
   `leaving: 'none'` — ничего не уходит, `data-hand-total` стоит, POST нет; B — на строку; выбор → строка «Сбросить: <карта>»; A → ОДИН POST с `for: {role: 'discard', source: {card: P86}}`. **T14 — единственный кандидат
   (вторая карта в руке одна): альбом открывается с ней ПОСЕЯННОЙ (`selected: [она]`), отмечен «единственная карта» в строке вопроса (слово/кант — не свет), A/RT подтверждает, B назад — вопрос всё равно задаётся** (`composer-
   preselect.md` — проверить, есть ли у моста руки семя; если нет — добавить в `enterConsoleHandPick` параметр семени из `selectable.length === 1 && min === max === 1`, общий для всех пиков руки с одним кандидатом). Отказа (RT) нет —
   сброс обязателен для розыгрыша. Ноль кандидатов — композер не открывается: карта в альбоме «Нельзя разыграть · нужна ещё одна карта в руке» (решение 1).

3. **Сброшенная карта УХОДИТ ИЗ ДОКА НА НАЖАТИИ — как ЦЕНА, до взлёта героя (U2 + U3; класс PL-1128, дверь действия P68 переносится на дверь розыгрыша).** Play-композер на нажатии (`submit` розыгрыша, синхронно до батча —
   там же, где взводится герой) собирает пре-собранные сбросы ветки (маркер шага `discardPrompt` + захваченный ответ `{type: 'card', cards}` — та же форма, что `armPreselectedDiscards` действия: вынести общий
   `preselectedDiscardsOf(steps, captured)` в `cardDiscard/` и звать из обоих композеров) и передаёт их герою: `armPlayedHero(…, {discard: {names, meta}})`. **Сцена героя владеет сбросом как ЧЕТВЁРТОЙ ПОСТАВКОЙ** `shipPrice`
   (`shipDiscardPrice`): карта(ы) уходят из ТЕЛА В ДОКЕ (`[data-hand-dock-card]`, как P68) через ОБЩИЙ директор сброса (`discardDirector`: spawn → fixate → flip → gather → carry → land — без фазы D hand-off: альбома нет), стопка
   стола выходит на `trayVisible` как всегда, счёт тикает на касании; герой ПОДНИМАЕТСЯ, когда пакет ПОКИНУЛ док (отъезд carry, не касание — PL-099/PL-104: ряд тикает на отъезде), посадка на стопку идёт ПАРАЛЛЕЛЬНО полёту героя;
   ворота транспорта `detectCardDiscard` эту карту НЕ подбирают второй раз (герой потребляет взвод: `armPreselectedDiscard` для розыгрыша не зовётся; `cardDiscardTransaction` ведёт директор героя — ИЛИ, проще и честнее: герой
   взводит общий `armCardDiscard` сам и `runCardDiscard` вызывается ИЗ `shipPrice`, а ворота `:976` видят `armed === undefined` после — выбрать то, что не плодит второй транзакции; `transportHolds.cardDiscard` поднимать на время
   поставки). Reduced motion — лестница директора. Сервер отказал (`detectCardDiscard` → `gone.length === 0`) — откат поставки вместе с откатом героя (`rollback`), ничего не улетело. **Закон бюджета (P84, владелец 2026-11-01):
   ни одной новой паузы** — fixate + flip + gather сброса идут ∥ остальным поставкам в тот же `TRANSFER_BEAT_MS`, отъезд carry — сигнал подъёма; суммарно розыгрыш с пре-собранным сбросом НЕ длиннее сегодняшнего «розыгрыш +
   живой экран сброса» (A/B против HEAD на сценарии Sponsored Academies: от POST до следующей поверхности — короче или равно; клетка свидетеля обязательна). **Даром:** Sponsored Academies и Strategic Shift получают сцену ухода
   из дока той же дверью — их стенды (`console-sponsored-academies`, `console-strategic-shift`) перенацелить в том же диффе, если они пинят отсутствие сцены / порядок героя (контракт 14).

4. **Веер под хостом ВИДЕН — лиз интейка живёт С ЭПИЗОДОМ, а не с `await`; «подвёрнутый» футер уступает интейку (П-Б).** `installEpisode` берёт `ep.accentRelease ??= beginDockIntakeAccent('hand-<kind>')` при установке
   (открытие, закрытие, перепагинация — все виды) и отпускает в `teardown` (уже есть `:402`); `openHandWithReveal` / `closeHandWithReveal` / `:22208` свои лизы оставляют на окно подготовки (measure + два кадра) — вложенные лизы
   законны (`consoleDockAccent.ts` — «leases nest»); путь отмены `:896` становится частным случаем общего. `console.less`: `.con-root--footer-behind:not(.con-root--dock-intake) .con-handreveal-layer {z-index: -2}` — тела
   секций (колонии/гидро/драфт) тоже всплывают на время полёта; комментарий-предпосылку `:2100–2106` переписать правдой («an EPISODE lifts the layer for its whole life — a hosted hand opens under a dockcover panel since 2026-08-13»).
   **Хэндовер тел — только на ОТКРЫТУЮ зону**: если раскадровка покажет касание тел раньше конца UNFOLD зоны шага (`playOutcomePhase`), `finalizeOpenForward` ждёт сигнал развёртки хоста (`descend` done — уже есть
   `handRevealState`/`workspaceDescend` регистры; никакого таймера) и лишь потом `holdSlots = false`; тела стоят на слотах (они и есть картинка) — никакой паузы для игрока. Входная CSS-анимация хостимой руки (`con-stdp-step-in`,
   `opacity 0 → 1` 260 мс) НЕ должна прятать слоты, на которые садятся тела: при открытии ФИЗИЧЕСКИМ полётом вход хоста = сам полёт (атрибут на корне хостимой руки `data-hand-arrives="flight"` → `animation: none`; без полёта
   (reduced motion, `runHandOpenEpisode` короткий путь) — прежний вход). Та же проверка для каждого хоста из списка `openHandWithReveal(` (`:13240, :13285, :14536, :16085, :17672, :20646, :20682, :20783, :20800, :20817`):
   стенд-свидетель (§3 (в)) гоняет минимум четыре — продажа (stdp, dockcover), сброс Плутона (секция колоний, footer-behind), сброс Красных (Парламент — проверить класс футера), пик композера розыгрыша (Mars University — рука уже
   хост) — и ПЕЧАТАЕТ для остальных «не покрыт» в отчёт, не притворяясь.

5. **Стопка говорит ПРАВДУ к чтению и в любом аборте (П-А) — одна сверка, один сторож.** `discardPile.ts` получает ОЖИДАНИЕ эпизода: `expectDiscardPileCount(owner, n)` (владелец лиза объявляет, сколько карт ЛЯЖЕТ: хэнд-сброс —
   `cardDiscardTransaction.names.length` после `detectCardDiscard`; сцена добора — число discard-битов; стрим — `req.cards.length`; ревил — `discardedCards.length`), и `settleDiscardPile(owner)` — «эпизод владельца кончается:
   `ensureDiscardPileCount(expected)` ДО чтения» — зовётся из `runDiscardTrayWithdraw` ПЕРЕД задержкой чтения (игрок читает уже правду), из `finishCardDiscard` (аборт любого рода — пока лиз стоит), из конца сцены добора и стрима
   (`allPeeled` / конец сцены, деградация), из `deckDrawLive` → false ревила (есть). `releaseDiscardPile(owner)` при `expected > count` — **СЕНТИНЕЛ** `[discard-pile] released under its count owner=… expected=N count=M` (каждый
   билд; красный на каждом e2e через `consoleTest.ts` рядом с `transferEndsGuard` — один ханк) и самоисцеление: счёт подтягивается в той же строке (правда раньше истории; сентинел — чтобы причина не терялась). Диагностика:
   `data-discard-pile-expected` на корне плиты. Касание остаётся единственным, что ТИКАЕТ с пульсом; сверка тикает без пульса (`ConsoleFlipValue` — обычный флип). Доказательство: unit-спек `consoleCardDiscard.spec` — carry, чей
   таймлайн не доходит до `landAt` (сторож `guarded` стреляет первым: подменить `gsap.ticker`/заморозить время) → к `settling` счёт = ожиданию, сентинела нет; аборт арбитра посреди carry → то же; ревил со «зависшим»
   `deckDrawState.active` → `deckDrawLive` падает → счёт подтянут; плюс TIMING-стенд на боксе под CPU-троттлингом ×6 (CDP `Emulation.setCPUThrottlingRate`) — сброс Марсианского университета ×8: стопка НИКОГДА не уходит с числом
   меньше серверного (читать `data-discard-pile-count` в `MutationObserver` на последнем кадре перед `after-leave`), сентинел молчит; ПОЗИТИВНЫЙ КОНТРОЛЬ — с нарочно выключенной сверкой (`?dpileTruth=0` dev-флаг или инъекция)
   сентинел ЗВУЧИТ хотя бы раз из 8 — иначе стенд ничего не доказывает (урок `screen-director`: «run with no finding proves something only beside its evidence»). **Не чинить причину стопа rAF** — её нет в продукте; чинится то,
   что стопка лгала, когда касание не состоялось. Причины-кандидаты (1)–(4) из П-А — записать в отчёт с тем, что подтвердилось на боксе (трейл: `[card-discard] scene failed`, `[liveness]`, `[hand-reveal] safety snap`).

---

## 0. Разведка (≤ 1 ч) — `ListAgents` + `git status`; перепроверить U1–U5, П-А, П-Б на своём HEAD; `SendMessage` занятому соседу (`-d9`): «беру `actionPreview.ts stepsForBehavior`, `Executor.ts` spend.cards, `discardPrompt.ts`,
`cardDiscard/*`, `discardPile/*`, `handRevealDirector.ts`, `consoleDockAccent.ts`, `consolePlayedHero.ts shipPrice`, `ConsoleStdProjectsScreen.vue`; в `ConsolePlayCardConfirm.vue` — ОДИН ханк (взвод сброса на submit), в `console.less` —
два правила z (`:2107`, `:2118`), в `consoleTest.ts` — один сторож, в `generate.ts` — одна фикстура; остальное твоё». Снять раскадровку «ДО» ОБОИХ дефектов владельца на боксе (`TM_E2E_STORYBOARD=1`, tv4k): вход в продажу патентов
из стандартных проектов (`console-stdp-workspace` до `04-sale-step` — покадрово от нажатия A на строке до оседания; ожидание: тел руки в кадрах НЕТ над панелью, зона проявляется с картами) и сброс под троттлингом (стопка с «0»
при закрытии хотя бы в одном прогоне из 8; если 0 из 8 на боксе — записать честно и доказать класс unit-спеком через сторож `guarded`). «ДО» розыгрыша P86 — временно убрать строку hold-back локально: композер → A → рука в
режиме сброса ПОСЛЕ сцены розыгрыша (кадр).

## 1. Карта (решение 1) — `UnexpectedApplication.ts` не меняется; `Executor.ts` (общий строитель маркера + `discardCardFromHand(log)`), `actionPreview.ts stepsForBehavior` (шаг первым), `unplayableReasons.ts` (причина),
`ru/cards.json:712` (RU по планке), лор EN/RU (`assets/text/lore_texts.json` + `ru/lore_texts.json`), арт P86 (`npm run art:…` по процедуре §3.1), строка hold-back долой, спек. Гарды: `make:cards`, `Prelude2CardsHeldBack`,
`cardPlayReplayCoverage` (чеки 1 и 3), `cardPlayPreviewCoverage`, `cardInformation`, `requirementProse`, `actionPromptCoverage` (не действие — не трогает), `choiceContext`/`promptMarkerGuard` (SelectCard с маркером — есть),
`cardLore`, `premiumCardViewModel`. Коммит + пуш.

## 2. Дверь розыгрыша (решения 2–3) — `cardDiscard/preselectedDiscards.ts` (общий сборщик из шагов+ответов; action-композер переводится на него), `ConsolePlayCardConfirm.vue` (ОДИН ханк: на submit — `preselectedDiscardsOf` → в
`armPlayedHero`; семя T14 для одного кандидата — в мосте руки, если его нет), `consolePlayedHero.ts` (`shipDiscardPrice` в `shipPrice`; подъём на отъезде carry; откат при отказе; `transportHolds.cardDiscard` на поставку),
`consoleCardDiscard.ts` (вход «из дока без альбома» — уже есть у P68; убедиться, что фаза D пропускается без `overlayHandoff` ожиданий), `gameTransport.ts` — ворота `:976` не должны подобрать карту второй раз (проверить `armed`).
Unit: `consolePlayCardComposer.spec` § pre-collected discard arms the hero's shipment; `playedHero*.spec` § the discard ships before the lift (порядок фаз: `shipping` с `discard:carrying` → `flying`); `cardDiscard` § a shipment
from the dock with no album plays no hand-off. Коммит + пуш.

## 3. Стенды (e2e, бокс)
   (а) **`console-unexpected-application.spec.ts`** (FUNCTIONAL, tv4k) на фикстуре `unexpected-application` (соло-фаза действий, Venus + Prelude 2, Teractor; Венера 10 %; рука: P86 + `Research` + `Tardigrades`; варианты
   `-sole` (P86 + одна) и `-none` (P86 одна); M€ 10; сухой прогон в генераторе: розыгрыш → `SelectCard` без P86 → ответ → Венера 12, РТ +1, сброшенная в `discardPile`, рука на 2 короче; `-none`: P86 не в `getPlayableCards`).
   A: рука → P86 → лист розыгрыша с строкой «Сбросьте 1 карту» → A → альбом фразой (свидетель фразы: opacity композера/зоны по кадрам `MutationObserver` — ни одного `v-if`-провала в 0 между кадрами; крошка «КАРТЫ В РУКЕ ›
   НЕОЖИДАННОЕ ПРИМЕНЕНИЕ › СБРОС КАРТЫ»; P86 НЕ в альбоме; `data-hand-total` не меняется; POST нет; `.con-discard-proxy` нет) → B → строка (ничего не отвечено) → A → карта → строка «Сбросить: Tardigrades» → A → ОДИН POST
   (тело: `for.role === 'discard'`, `for.source.card === P86`) → **порядок**: первый `.con-discard-proxy` виден ДО фазы `flying` героя (`data-hero-phase`/`playedHeroState` через `__conReady`), стопка выходит, `data-discard-pile-count`
   → 1 на касании, последний кадр перед её уходом ≥ 1; герой — событие лицом (P84), оплата 4 M€ с рельса; затем история доски: шкала Венеры +1 с жетоном рейтинга от маркера; сервер — Венера 12, РТ +1, ни одного стоящего промпта;
   `preselectGuard` / `postCommitGuard` / `livenessGuard` / сентинел стопки молчат. B: `-sole` — альбом открыт с посеянной единственной картой и отметкой, A подтверждает, в POST — она. C: `-none` — в альбоме P86 с причиной
   «нужна ещё одна карта в руке», композер не открывается. D: reload посреди альбома (пре-селект) — композер восстановлен без POST (`alternate-play-route-keeps-reversible-doors`).
   (б) **`console-discard-pile-truth.spec.ts`** (TIMING, `--exclusive --workers=1`, tv4k): решение 5 — сброс Марсианского университета (фикстура/инъекция `console-card-discard`) под CDP-троттлингом ×6, ×8 повторов: стопка
   уходит только с числом ≥ серверного; плюс позитивный контроль со снятой сверкой (сентинел звучит); плюс сцена добора с отбросами под троттлингом (P84-лента `ishtar-expedition` — `stratospheric-expedition` сосед): счёт ревила =
   числу отброшенных к моменту R3.
   (в) **`console-hosted-hand-open.spec.ts`** (TIMING, tv4k, раскадровка): решение 4 — для хостов (1) продажа патентов (`console-stdp-workspace` boot), (2) сброс Плутона в секции колоний (`console-pluto-bonus-discard` boot),
   (3) сброс Красных (`console-reds-campaign` boot), (4) пик композера (`console-hand-pick-preselect` A): в полёте каждое тело `.con-handbody[data-reveal-card]` ПОКРАШЕНО СВЕРХУ — `elementsFromPoint` в центре тела на ≥ 3 кадрах
   полёта возвращает тело (или его потомка), никогда `.con-stdp`/`.con-colonies`/`.con-parliament`; `con-root--dock-intake` стоит от первого кадра полёта до релиза тел; после релиза тела в `shelf` внутри зоны хоста, слоты
   показаны, ни одного «проявления с картами» (opacity корня хостимой руки не стартует с 0 при `data-hand-arrives="flight"`); для (1) — касание тел не раньше конца развёртки зоны (если решение 4 потребовало ожидания). Кадры —
   `screenshots/hosted-hand-open/<host>/`.
   (г) Регрессия на боксе: `console-card-discard`, `console-pluto-bonus-discard`, `console-colony-pluto-embed`, `console-hand-pick-preselect`, `console-sponsored-academies`, `console-strategic-shift`, `console-ceres-tech-market`,
   `console-stdp-workspace`, `console-stdp-stable-geometry`, `hand-reveal-probe`, `hand-delivery-probe`, `console-hand-open-parity`, `console-effect-decision-embed`, `console-start-sponsor`, `console-event-pays-face-up`,
   `console-ishtar-expedition`, `console-play-landing-probe`, `console-reds-campaign`, канарейка, `npm run e2e:affected`. Любой красный — аннотация `build` ПЕРЕД вердиктом.

## 4. Документы (объявленными ханками, где файл грязен): `console-ui.md` § «СБРОС — ОБЪЕКТ СТОЛА» правило 3 (+ «…и говорит ПРАВДУ к чтению и в любом аборте: `expectDiscardPileCount` / `settleDiscardPile`, сентинел»), § HAND
DOCK presence (лиз — ЭПИЗОДА), § A CARD PLAY'S RESULT… / `workspace-band.md` § ЦЕНА РОЗЫГРЫША (четвёртая поставка — карта из руки), `hand-album.md` § THE COVER CONTRACT (переписать предпосылку), `hand-dock-presence.md`,
`standard-projects-workspace.md` § hosted step's ONE entry (вход = полёт), `docs/claude/action-prompt-audit.md` (класс: `spend.cards` в декларации — шаг превью), `docs/PRELUDE2_ADAPTATION.md` §4 (строка P86 → сдана, 20/54),
журнал серии (запись ДВАДЦАТАЯ: задача · решения · сделано · «до/после» · найдено · что даром), реестр **DM**.

## 5. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «ДО / ПОСЛЕ» тремя блоками (вход в сброс: экранов 2 → 1, POST 1; стопка: прогонов с «0» при уходе N/8 → 0/8 + контроль; веер: кадров с телом над панелью 0 →
≥ 3 на каждом хосте); порядок событий розыгрыша (запись); A/B длительности розыгрыша с пре-собранным сбросом против HEAD (Sponsored Academies: от POST до следующей поверхности, три прогона, медианы — ≤ HEAD); гарды и
`make:cards`; регрессия на боксе (аннотация `build`); решения 1–5 (что сделано по каждому); хосты, НЕ покрытые стендом (в) — списком; гэпы честно; что ушло в пуш.

## 6. Нельзя
- Спрашивать сброс ПОСЛЕ нажатия (второй экран) — это и есть дефект; плоский список имён вместо альбома; автосброс единственной карты без показа (T14 — семя, не применение); таймер вместо сигнала (подъём героя — на отъезде
  carry, сверка стопки — на границах эпизода, лиз — на `teardown`); вторая транзакция сброса на один розыгрыш (ворота `:976` + герой); удлинять розыгрыш (закон бюджета P84: A/B ≤ HEAD); чинить «веер» подъёмом z слоя над всем
  навсегда (кромка дока снова всплывёт над панелями — утечка игровой поверхности v2) — только на время эпизода; свечение/ореол на плите стопки или отметке «единственная карта»; править чужие ханки в грязных файлах; `git apply
  --unidiff-zero`; `--no-verify`; локальный Playwright.
