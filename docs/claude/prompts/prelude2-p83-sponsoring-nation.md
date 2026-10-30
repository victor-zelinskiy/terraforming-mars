# Промт исполнителю · P83 Sponsoring Nation («Нация-спонсор») — ВОСЬМАЯ карта Prelude 2, четвёртая ПОЛИТИЧЕСКАЯ и ПЕРВЫЙ ДЕКЛАРАТИВНЫЙ РОЗЫГРЫШ, ЧЕЙ ГРАНТ ДЕЛЕГАТОВ — ЖИВОЕ ПРОДОЛЖЕНИЕ БЕЗ ДВЕРИ ПОЛЯ, «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 1 + 5 — ДЕКЛАРАТИВНАЯ + ПОЛИТИЧЕСКАЯ): зелёная (автоматическая), 21 M€, метка Земля; «Требует 4 метки Земли. Получите 3 РТ. Разместите 2 делегатов» — `requirements: {tag: EARTH, count: 4}`, `behavior: {tr: 3, turmoil: {sendDelegates: {count: 2}}}` (под Redux: 2 кубика из РЕЗЕРВА на ОДНУ резолюцию области голосования — шаг `PlaceDelegatesOnResolution`, T03 / TR03 — ДАРОМ: причина резерва, чип «−2 · из резерва», ряд «затем: 2 делегата на одну резолюцию сразу после розыгрыша», именованный пропуск при пустой области; РТ-жетон розыгрыша и ответ Зелёных «+6 M€» в «Сработает» — классы PL-001-for-plays и CW) · РАБОТА КАРТЫ (≈ 15 %): маркер `politics: 'redux'`, `description` в голосе Redux, лор, арт, строка долой, спек с Redux-таблицей по форме T03 · ГЛАВНОЕ (≈ 85 %) — ПРОХОД НА БОКСЕ ТРЁХ СОБЫТИЙ ОДНОГО НАЖАТИЯ ПО ОЧЕРЕДИ (карта ложится → РТ-жетон с печатных РТ-значков в ячейку рейтинга → ответ Зелёных с их хартии в ряд M€ → ТОЛЬКО ПОТОМ голосование встаёт ШАГОМ ТОГО ЖЕ ФЛОУ «КАРТЫ В РУКЕ › НАЦИЯ-СПОНСОР › ГОЛОСОВАНИЕ» → A на резолюции → два кубика из резерва → флоу уходит) и КЛАСС-КАНДИДАТ «ГРАНТ ДЕЛЕГАТОВ РОЗЫГРЫША БЕЗ ДВЕРИ ПОЛЯ — ШАГ ТОГО ЖЕ ФЛОУ, И ЗАВЕРШЕНИЕ ЕГО ДОЛЖНО» (T03 хостит голосование внутри руки ТОЛЬКО потому, что флоу «отступил к полю» и вернулся — `cardGrantOwedTo(wf, yieldedStackCards())`; TR03 спрашивает резолюцию ДО POST — staged-дверь bespoke-карты; колония Венеры держит свой флоу `owed-step`; у P83 ни поля, ни staged-двери: если рука уйдёт раньше, чем допущенный промпт найдёт хоста, голосование встанет ОТДЕЛЬНОЙ лентой «ПАРЛАМЕНТ › ГОЛОСОВАНИЕ» — тот самый дефект T03 в третьей форме; ПРОВЕРИТЬ «ДО» ПЕРВЫМ ДЕЛОМ)

> **Статус: ВЫДАН 2026-10-30.** HEAD `2d9d9e6afd` (P75 СДАНА — `17c508d1b1` карта · `cbeb5f3ef4` доки; ворклист **7 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись ВОСЬМАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты; `AskUserQuestion` —
> только exit 2/3/4 бокса или ветка позади при пуше.
> **ОДИН СОСЕД РАБОТАЕТ** (`ListAgents`: `terraforming-mars-22`) — его незакоммиченные файлы: `ConsolePlayCardConfirm.vue`, `ConsoleCountedWhy.vue`,
> `console/parliament/partyNames.ts`, `turmoilRedux/PoliticalThinkTank.ts` (+ спек), `src/styles/console.less`, `ru/{console,parliament}.json`,
> `tests/client/{components/console/ConsoleCountedWhy,console/revealReading}.spec.ts`, `tests/e2e/console-{ghg-shipment,green-allegiance,x87-shipment-to-earth}.spec.ts`
> (хвосты P75). **Эти файлы НЕ трогать** (`SendMessage`: список своих файлов — §0; `ConsolePlayCardConfirm.vue` — ЕГО: если класс CX потребует правки композера,
> согласовать ханк ДО правки). Промты-образцы серии: **`prelude2-p85-summit-logistics.md`** (политическая: маркер, фасад, стенд `-locked`), `prelude2-p76-…`
> (форма §0–§9, чек-лист A–M), `prelude2-p75-…` (решения без вопросов, класс в общем слое → раздел реестра); родственники вне серии — **`classic-t03-cultural-metropolis.md`**
> («ДВЕ ДВЕРИ ОДНОГО РОЗЫГРЫША»: грант как живой шаг внутри руки, `cardGrantHost.ts`, стенд `console-cultural-metropolis`) и `docs/TURMOIL_REDUX_POLITICAL_DONATION.md`
> (TR03 — staged-голосование ДО POST, полёт кубика из резерва); здесь — только то, чем P83 ОТЛИЧАЕТСЯ.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P83.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P83 - Sponsoring Nation.png`.
> Лор — СО СКАНА, дословно: «Small donors are also welcome» (без точки на печати — добавить; гард лора).
> Реестр: последний раздел **CW** (P75), последний номер **PL-1162** → эта задача берёт **CX**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p83` → `npm run e2e:remote -- p83 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд —
> ТОЛЬКО профиль TV; класс спека — FUNCTIONAL (порядок событий судить по записи `MutationObserver`, не по кадрам: `tests.md` 2026-10-30).
> **Коммит — сам по окончании, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш** (fast-forward; ветка
> позади → спросить владельца, чужое не трогать). Сосед держит `package.json` / `package-lock.json` в индексе — хук версии бампает сам, не чинить.

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 1 и п. 5**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76…P75 «Найдено» / «Что даром» — не
переоткрывать: награда события на рубашке (P76), эмблема партии в причине руки (P85), «Сработает» каскадирует ответы ПАРТИИ (P75 PL-1159), свежий Redux-стол =
Зелёные у власти (PL-1162), генератор не выводит блок счётного склада (PL-1158 — у P83 склада нет)), `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (п. 4 — Redux-таблица
спека; строка T03 в §4 — «ДВЕ ДВЕРИ: клетка staged, голосование — живой шаг внутри руки, `cardGrantHost.ts`»), `docs/claude/expansion-adaptation-checklist.md`
(«Play-card modal preview» — декларативная авто; «Fullscreen rule text» — `:666` «Place N delegates in 1 party» читается по-Redux; «Premium card FACE»),
`docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7, `docs/claude/parliament-glossary.md` (резолюция, резерв, «область голосования» — гард `parliamentGlossary`),
**CLAUDE.md § THE COMMIT BOUNDARY** («ONE PRESS, SEVERAL EFFECTS — THE SURFACES GO IN TURN»: a prompt-routed DOOR asks its own admission family `followUp`; while
that door waits the flow OWES a step — `owed-step` — and its crumb already names the coming stage — `FOLLOW_UP_STEP_STAGES`), `docs/claude/console/workspace-band.md`
§ РОЗЫГРЫШ КАРТЫ (РТ розыгрыша — награда: `playRailTrSpecs`, жетон с печатных РТ-значков, ячейка рейтинга тикает на посадке, ответ стола после),
`.claude/rules/console-ui.md` § DEPTH IS ONE STACK (`workspaceHostForStep` — ближайший живой незавершённый шаг; `pushWorkspaceFrame`; «a host may not fold … while
a step is standing inside it»), § A CARD PLAY'S RESULT BELONGS TO THE WORKSPACE THE PLAY WAS MADE IN (claim `draw`/`pick`/`effect` — «party» среди них НЕТ),
`tests.md` § TURMOIL REDUX: A SPEC OR A FIXTURE NEVER ASSUMES THE DEAL. Память: `rules-first`, `upstream-spec-encodes-upstream-rules` (апстримный блок на
классическом столе — байт в байт), `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `concurrent-session-edits-same-files`, `trivial-card-prompts-no-owner-questions`, `prelude2-adaptation` (гочи P76…P75).

**Образцы — по частям:** поведение — `behavior/Behavior.ts:146–149` (`turmoil.sendDelegates: {count, manyParties?}`), **`behavior/Executor.ts:273–285`**
(`canExecute`: резерв фасада ≥ count, иначе карта не играется — причина «Делегатов в резерве: N из 2» класса T03), `:769–776` (`politics.placeDelegates(player,
count, {oneParty: true, source: card.name})` — ПОСЛЕ `tr`), `parliament/PlaceDelegatesOnResolution.ts:1–60+` (ОДИН шаг «добавить N делегатов на резолюцию»:
`SelectParty` с `votePrompt.source === 'grant'`, `choiceContext.source = {kind: 'card', card}`, кубики из РЕЗЕРВА, пустая область — `recordSkippedEffect`);
превью — `models/actionPreview.ts:716–724` (чип `delegateFromReserve` — `current → resulting` резерва, `note: 'from the reserve'`), **`:1082–1112`**
(ветка: `grant.previewSkip()` → `warningNote` «No resolution is up for a vote»; `delegateDoor` — только у ДЕЙСТВИЙ (`:332`, staged-дверь); иначе
`{kind: 'delegateGrantFollowUp', count, printed}` — ЖИВОЕ продолжение), `cards/actionPreviews.ts:861–864` (`delegateFromReserve`), `:645–647`
(`delegateGrantStep` — staged-дверь TR03); родственники — **`turmoil/CulturalMetropolis.ts`** (та же `turmoil.sendDelegates: {count: 2}`; `description`
«…Place 2 delegates in 1 party.» + строка `ACCEPTED` в `cardInformation.spec:385`), **его спек `tests/cards/turmoil/CulturalMetropolis.spec.ts:116–345`** (ФОРМА
Redux-таблицы P83: `parliamentTable()` / `unityRuling()`, причина резерва «1 of 2» `:223–240`, розыгрыш → ОДИН грант-промпт на 2 с названным дарителем `:257–292`,
пустая область — именованная строка журнала `:294–304`, превью — чип резерва −2 + `delegateGrantFollowUp {count: 2, printed: 2}` `:306–331`, save / reload под
грантом `:333`), `turmoilRedux/PoliticalDonation.ts:89–125` (TR03 — bespoke + `delegateGrantStep`: STAGED-голосование, ответ в батче — НЕ форма P83: P83
декларативна, грант — живой); **хост гранта — `console/cardGrantHost.ts`** («a live grant whose giver is a CARD whose flow stands aside for the board is OWED to that
flow» — `cardGrantOwedTo(wf, carried)`, читается ТОЛЬКО с `yieldedStackCards()` — `ConsoleShell.vue:14179` (возврат с поля), `:20482` (не ставить standalone, пока
флоу у поля); **общая ветка `:20484–20495`**: `partyStep` → `workspaceHostForStep()` → если хост жив и не `parliament` — `pushWorkspaceFrame(parliament внутри
хоста)` — это ветка колонии Венеры («КОЛОНИИ › ВЕНЕРА › ГОЛОСОВАНИЕ», `colonyGrantStepLive`), и она хостит голосование в руке ТОЛЬКО пока кадр руки ещё ЖИВ),
`console/consoleTaskRouter.ts:465–471` (`kind === 'party' && votePrompt.source === 'grant'` → стадия `DELEGATE_GRANT_STEP_STAGE` «ГОЛОСОВАНИЕ» — крошка даром),
`consoleWorkspaceStack.ts:1636–1646` (`yieldedStackCards` — только отступивший к полю стек), `console/consolePlayCardComposer.ts:403–415` (`delegateGrantFollowUpRow`
— ряд «затем …», `after: 'play'` → «Сразу после розыгрыша»), `played/consolePlayOutcomeClaim.ts:334` (виды claim'а розыгрыша: `draw` · `pick` · `effect` [·
`deck-check`] — `party` НЕТ; `delegateGrantFollowUp` в клиенте читают только ряды «затем» — `grep delegateGrantFollowUp src/client`), `ConsoleShell.vue`
`concludeWorkspaceFlow` / `workspaceConclusionFor` (`consoleWorkspaceFlow.ts` — именованные причины удержания `nested-step` · `owed-step` · `live-outcome` ·
`owned-prompt` · `parked`), `colonyFollowUpLive` (`ConsoleShell.vue:14174` — как флоу колоний держит СВОЙ грант); РТ розыгрыша — `played/consolePlayedHero.ts`
(`playRailTrSpecs`; событие — с рубашки; у P83 карта зелёная — с печатных РТ-значков лица на столе), стенд **`tests/e2e/console-play-tr-reward.spec.ts`** (порядок:
цена с посадкой → свои награды → РТ-жетон рождён на печатном РТ → ячейка рейтинга тикает на посадке → M€ Зелёных ПОСЛЕ, по жетону за единицу с хартии), стенд T03
**`console-cultural-metropolis.spec.ts:80–200`** (проба `armStory`: шаги крошки `.con-wshead__step`, `parlOutsideHand` — `.con-parl` вне `.con-hand` или со
своим `con-ws`, двери `[data-parl-vote-door]`, резерв `[data-parl-seat-reserve="<color>"]` `data-count`, `handGoneUnderVote`; дверь карты —
`.con-hand .con-parl--embedded [data-parl-vote-door="card"]`; B «Свернуть» → A возвращает ТОТ ЖЕ шаг; A на резолюции → резерв −2 на сервере), фикстуры —
`generate.ts:9265–9313` (`summitLogisticsFixture`: `parliamentFixture(name, {stopAt: 'vote', options: {prelude2Expansion: true, customCorporationsList}, arrange,
expect})`), `:1418–1430` (`parliamentFixture` — область голосования с тремя резолюциями при `stopAt: 'vote'`; лобби-кубик стоит → резерв 6), `Parliament.ts:396–404`
(`reserve = 7 − голоса − председатель − лобби`), `parliament/parties/PartyEffects.ts:164–178` (Зелёные: `tr-gain` → +2 M€ за шаг — ответ «+6»), требование меток —
`cards/requirements/TagCardRequirement.ts:24–34` (джокеры свои считаются — Учёных под Redux тоже), причина руки `ru/ui.json:171` «Нужно меток: ${0}»; RU описания
апстрима `ru/cards.json:705–706`; `card_info` RU «Add 2 delegates to one resolution.» `:596` — ЕСТЬ.

---

## Диагноз (подтверждён файл:строка на `2d9d9e6afd`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, форк-слой — маркер и текст.** `prelude2/SponsoringNation.ts`: `AUTOMATED`, 21, `[EARTH]`, `behavior: {tr: 3, turmoil: {sendDelegates: {count:
   2}}}`, `requirements: {tag: EARTH, count: 4}`, `description: 'Requires 4 Earth tags. Gain 3 TR. Place 2 delegates.'` (RU есть), рендер `tr(3).br.delegates(2)`.
   Манифест `:68` — `compatibility: 'turmoil'` БЕЗ `politics` → после удаления строки гард §2.5 падает, пока не стоит `politics: 'redux'`. Декларативная →
   превью (чипы «РТ N → N+3», «−2 делегата · из резерва N → N−2»; ряд «затем: 2 делегата на одну резолюцию — сразу после розыгрыша»; пустая область —
   `warningNote`), `cardPlayPreviewCoverage`, журнал — даром.
2. **Чтение скана (§0):** «21» — цена; плашка «4 [Земля]» — ТРЕБОВАНИЕ (4 метки Земли); кружок справа — Земля (метка); зелёная (автоматическая); ряд — ТРИ значка РТ
   + ДВЕ фигуры делегатов; текст «(Requires 4 Earth tags. Raise TR 3 steps and place 2 delegates.)»; «P83»; слева внизу — Prelude 2 («<») и Turmoil (шестиугольник);
   лор — курсив. Печать «place 2 delegates» под Redux = «добавьте 2 делегата на одну резолюцию» (T03 — `ACCEPTED` «only the noun differs»).
3. **ГДЕ ВСТАНЕТ ГОЛОСОВАНИЕ (класс-кандидат CX).** Сервер: `tr: 3` применяется в розыгрыше, грант отложен (`placeDelegates` → `PlaceDelegatesOnResolution`) —
   ответ розыгрыша несёт `waitingFor: party` с `votePrompt.source === 'grant'` и `choiceContext.source = {kind: 'card', card: P83}`. Клиент знает ТРИ двери гранта:
   (а) T03 — флоу отступил к ПОЛЮ (staged-клетка города), вернулся и открыл голосование внутри себя (`cardGrantOwedTo(wf, yieldedStackCards())` — читается только
   с отступившим стеком); (б) TR03 — bespoke staged-голосование ДО POST (`delegateGrantStep`, ответ в батче); (в) колония Венеры — общая ветка `ConsoleShell.vue:20484`:
   `partyStep` → `workspaceHostForStep()` → `pushWorkspaceFrame(parliament внутри хоста)`, которая хостит голосование, пока кадр флоу ЖИВ, а флоу колоний держит
   свой грант `colonyFollowUpLive`. P83 — ни (а), ни (б): декларативный розыгрыш → `delegateGrantFollowUp`; при этом claim розыгрыша (`consolePlayOutcomeClaim`)
   знает `draw` · `pick` · `effect`, НЕ `party`, а `delegateGrantFollowUp` в клиенте читают только ряды «затем». Значит хостинг зависит от ГОНКИ: промпт допущен
   (после сцены посадки, РТ-жетона и ответа Зелёных) — если рука ещё стоит (`workspaceHostForStep() === 'hand'`), ветка (в) поставит голосование внутрь
   («КАРТЫ В РУКЕ › НАЦИЯ-СПОНСОР › ГОЛОСОВАНИЕ» — стадия даром из роутера); если `endPlayCardFlow` → `concludeWorkspaceFlow` уже увёл руку (ничего не должно:
   добора нет, пика нет) — голосование встанет ОТДЕЛЬНОЙ лентой «ПАРЛАМЕНТ › ГОЛОСОВАНИЕ» (дефект T03 в третьей форме: имя карты пропало из крошки, второе место для
   одного нажатия). **ПРОВЕРИТЬ «ДО» ПЕРВЫМ ДЕЛОМ** (фикстура + стенд-проба T03 `armStory`: `parlOutsideHand`, `steps`, `handGoneUnderVote`). → решение 3.
4. **Порядок трёх событий одного нажатия.** Ответ один: карта ложится, РТ +3 (ячейка рейтинга), Зелёные +6 M€ (ответ партии — P75 класс), ПОТОМ вопрос. Контракт
   «THE SURFACES GO IN TURN»: дверь, пришедшая промптом, ждёт свою семью допуска `followUp` — РТ-жетон рождён на печатных РТ-значках лежащей карты и сел в ячейку
   (`console-play-tr-reward`: рейтинг читает N до посадки), M€ Зелёных — по жетону с хартии в ряд M€ ПОСЛЕ, голосование — ПОСЛЕ них, крошка уже называет
   «ГОЛОСОВАНИЕ» (`FOLLOW_UP_STEP_STAGES`), и флоу ДОЛЖЕН шаг (`owed-step`) — не может уйти. Стенд это свидетельствует записью (решение 4).
5. **Что даром (проверить «до», не переоткрывать):** требование — плашка «4 [Земля]», причина руки «Нужно меток: 4» с текущим (джокеры: Research Coordination,
   Учёные под Redux — считаются); резерв < 2 → карта не играется, причина «Делегатов в резерве: N из 2» (T03, общий слой); оплата — M€ (Земля — ни стали, ни титана),
   скидка Teractor −3 на карты Земли в заголовке оплаты (`calculatedCost` 18); чипы превью; плита руки — счётного нет; РТ розыгрыша — жетон (PL-001 for plays), RX42
   вето — честное чтение (`ratingVetoed`), если бы закон стоял; Зелёные у власти на свежем столе (PL-1162) → «Сработает: Зелёные +6 M€» (каскад P75); журнал —
   «+3 РТ» и строка «добавляет 2 делегата на <резолюция>»; MarsBot-стол — грант человека обычный, стол бота с `prelude2Expansion` БРОСАЕТ → карта в руку без опции.
   Реакторы на Землю в скоупе: Martian Zoo (+1 животное), Point Luna (+1 карта — корпорация), Teractor / Earth Office / Earth Catapult / Sky Docks / Valley Trust —
   скидки (заголовок оплаты), Media Group — только события. Хуков-реакторов у P83 нет → двойника нет; `OrOptions` нет → «не касается».
6. **Spec апстрима** (`tests/cards/prelude2/SponsoringNation.spec.ts`): `canPlay` 3 / 4 метки (`tagsForTest`), `play` на классическом столе (РТ 14 → 17,
   `assertAddDelegateAction(…, 2)`). Оба — байт в байт.
7. **Локаль.** RU-имя «Нация-спонсор» (`ru/cards.json:705`) — оставить; RU описания апстрима «Разместите 2 делегатов» (`:706`) — не голос Redux; `card_info`
   строка гранта с RU есть. Лора `P83` и арта нет.

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Зелёная, 21, Земля, без ПО, плашка «4 [Земля]»; P83; `compatibility: 'turmoil'` + `politics: 'redux'`; оплата — только M€ (+ скидки по метке Земли).
2. Требование: ≥ 4 своих меток Земли (`default`: джокеры свои считаются, эффект Учёных — тоже; чужие — нет; событие с меткой Земли — да, пока на столе? — нет:
   метки событий не считаются, как у апстрима `Tags.count`); 3 метки → заперта «Нужно меток: 4» с текущим 3.
3. Резерв < 2 → не играется, причина «Делегатов в резерве: N из 2»; ровно 2 → играется (лобби-кубик — не резерв).
4. Розыгрыш → РТ +3 (Зелёные у власти → +6 M€ ответом партии; RX42 — если игрок первый по РТ, шаги отвергнуты и НАЗВАНЫ), затем ОДИН грант-промпт на 2
   (`SelectParty`, все резолюции области, даритель — карта); ответ → оба кубика из резерва на ОДНУ резолюцию, лобби нетронуто, леджер цел; пустая область →
   карта разыграна, РТ получен, грант — именованная строка журнала (`cannot add delegates … no resolution is up for a vote`).
5. Превью (декларативное, read-only): чипы «РТ N → N+3» (под Зелёными — ответ в прогнозе), «−2 делегата · из резерва N → N−2»; шаги — `[delegateGrantFollowUp
   {count: 2, printed: 2}]`; пустая область — `[note warning «No resolution is up for a vote»]`. Раздача: Redux + Prelude 2 — в колоде (с маркером); без Prelude 2 —
   нет; save / reload под грантом — карта и РТ стоят, вопрос задан снова.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU** — имя «Нация-спонсор» оставить; RU нового ключа описания (решение 2): «Требуется 4 метки Земли. Получите 3 РТ. Добавьте 2 делегата на одну резолюцию.»;
   лор RU — «Малые жертвователи тоже приветствуются.» Старые RU-ключи апстрима не трогать.
2. **Текст** — `metadata.description: 'Requires 4 Earth tags. Gain 3 TR. Add 2 delegates to one resolution.'` (НОВЫЙ ключ в голосе Redux — совпадает со строкой
   генератора `mech:turmoil.delegates`, поэтому строка `ACCEPTED` в `cardInformation.spec` НЕ нужна — в отличие от T03); `infoText` не нужен (все блоки генератор
   выводит: требование, РТ, делегаты — ПРОВЕРИТЬ `make:cards`: если блок РТ не засеялся — `infoText` одним блоком РТ, как P75 PL-1158). Манифест — `politics: 'redux'`.
3. **ГРАНТ БЕЗ ДВЕРИ ПОЛЯ — ШАГ ТОГО ЖЕ ФЛОУ** (диагноз 3, раздел **CX**) — сначала «до» на боксе (фикстура основная; проба `armStory`): (а) если голосование
   УЖЕ встаёт внутри руки («КАРТЫ В РУКЕ › НАЦИЯ-СПОНСОР › ГОЛОСОВАНИЕ», `parlOutsideHand === false`, `handGoneUnderVote === 0`) и флоу уходит ТОЛЬКО после ответа —
   класса нет: записать в журнал «даром — ветка колонии Венеры хостит и розыгрыш», стенд пинит; (б) если рука уходит раньше и Парламент встаёт отдельной лентой
   (или мигает: рука → лента) — класс: завершение розыгрыша ДОЛЖНО грант. Форма — ровно та, которой флоу колоний держит свой (`colonyFollowUpLive`), и та, которой
   T03 держит возвращение (`cardGrantOwedTo`): `cardGrantOwedTo(wf, carried)` получает ВТОРОГО читателя — `carried` ЖИВОГО стека (кадры руки: `subject` / `sourceCard`),
   не только отступившего; `workspaceConclusionFor` розыгрыша держит `owed-step`, пока превью обещало `delegateGrantFollowUp` и грант ещё не отвечен / не пропущен
   (структурно: промпт `party` + `grant` + даритель = карта флоу; ИЛИ ответ уже пришёл без промпта — пустая область, пропуск именован сервером — тогда долг снят);
   бесконечного удержания нет — долг гасится ответом, пропуском или уходом промпта (`gameAge`), срок — как у `owed-step` других дверей; крошка — «ГОЛОСОВАНИЕ» из
   роутера (даром); B на голосовании — «Свернуть» (парк флоу с шагом), A с доски возвращает ТОТ ЖЕ шаг (T03 C-collapsed); юниты: `consoleWorkspaceFlow.spec` /
   `cardGrantHost.spec` § живой стек; `composer-preselect` не задет. НИКАКОЙ правки `ConsolePlayCardConfirm.vue` без согласования с соседом; предпочесть
   `cardGrantHost.ts` + шелл-ветку `:20484` + флоу-модуль.
4. **Порядок — свидетельствуется записью** (диагноз 4): стенд пишет историю (`MutationObserver` + `setInterval`, как T03): момент посадки РТ-жетона (`rail:tr` /
   ячейка рейтинга «N → N+3» — хуки `console-play-tr-reward`), момент посадки M€ Зелёных (`reactor:Greens:megacredit` → `rail:megacredits`), момент появления двери
   `[data-parl-vote-door="card"]` — дверь ПОСЛЕ обоих; рейтинг читает N на каждом сэмпле до посадки. Если дверь поднимается РАНЬШЕ жетонов — это дефект допуска
   (`followUp` семья) — чинить в том же классе CX, не маскировать паузой.
5. **Свой e2e-стенд — ДА**, `tests/e2e/console-sponsoring-nation.spec.ts`, ДВЕ фикстуры одного рецепта `sponsoringNationFixture(name, earthTags)` по форме
   `summitLogisticsFixture` (Redux + Colonies + Prelude 2; `stopAt: 'vote'` — область голосования с тремя резолюциями, свежий стол = Зелёные у власти (PL-1162: +6 M€
   ответом — НЕ сажать закон Единства, Зелёные нужны); `customCorporationsList: [TERACTOR, THORGATE]` — Teractor: метка Земли + скидка −3; p1 — на столе Cartel (Земля)
   и Luna Governor (2 Земли; Colonies ✓) → **4 метки Земли**; 25 M€; резерв 6 (лобби стоит); P83 в руке): `sponsoring-nation` — играбельна (цена 18);
   `sponsoring-nation-locked` — без Luna Governor (2 метки) → заперта «Нужно меток: 4» (`unplayableReasons(p1, card)[0]`: `type 'tag'`, `current 2`); резерв < 2 —
   серверный спек. Сухой прогон розыгрыша на копии: РТ +3, M€ 25 − 18 + 6 = 13, `SelectParty` на 2 с дарителем P83, ответ на резолюцию Зелёных → резерв 6 → 4,
   `votesOf` 2, леджер цел. Клетки: (1) `-locked` — плита заперта, причина «Нужно меток: 4 · 2», 0 POST; (2) основная — композер: чипы «РТ 20 → 23» (число — сервера),
   «−2 делегата · из резерва 6 → 4», ряд «затем: 2 делегата на одну резолюцию — сразу после розыгрыша», «Сработает: Зелёные +6 M€», CTA «Разыграть · 18 M€»
   (скидка Teractor названа в заголовке оплаты), курсор на CTA, 0 POST; A → ОДИН POST → карта ложится в «РАЗЫГРАНО» (зелёная) → РТ-жетон с печатных РТ-значков лица в
   ячейку рейтинга (тик на посадке) → M€ Зелёных с хартии в ряд M€ → голосование ВНУТРИ руки («КАРТЫ В РУКЕ › НАЦИЯ-СПОНСОР › ГОЛОСОВАНИЕ», `parlOutsideHand`
   false, один `.con-parl`), дверь карты `[data-parl-vote-door="card"]`; B — «Свернуть», A с доски — тот же шаг; A на резолюции → кубики из резерва
   (`[data-parl-seat-reserve]` 6 → 4, тики по посадке — TR03), сервер: `votesOf` 2, резерв 4, РТ +3, M€ 13; флоу ЛЕВИТ на доску; `transferWitness`:
   `endsOverGlass` пуст; история — порядок решения 4.
6. **Журнал серии / доки** — запись P83; `PRELUDE2_ADAPTATION.md` — «8 / 54», строка; §3.1 п. 5 — одно предложение («грант делегатов розыгрыша без двери поля —
   шаг того же флоу; завершение должно его»); `docs/claude/console/workspace-band.md` § WORKSPACE DESCEND / владелец шага — абзац, если класс (б); память
   `prelude2-adaptation.md` (8 / 54).
7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `2d9d9e6afd`. **Сначала** `ListAgents` + процессы; `SendMessage` соседу (его файлы — в шапке): твои файлы — `prelude2/SponsoringNation.ts`,
   `Prelude2CardManifest.ts` (одна строка — маркер), `tests/cards/prelude2/SponsoringNation.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка долой), арт P83
   (`assets/card-images/P83.webp` + миниатюра, `genfiles/cardArtManifest.json`), `assets/text/lore_texts.json` (одна строка), `ru/{cards,card_info,lore_texts}.json`,
   `src/genfiles/*`; **по решению 3(б)** — `console/cardGrantHost.ts` (+ спек), `console/consoleWorkspaceFlow.ts` / `consoleWorkspaceStack.ts` (+ спеки),
   `ConsoleShell.vue` (ветка `:20484` и заключение розыгрыша — объявить соседу ДО правки: файл не в его списке, но композер — в его); фикстуры + стенд; доки, журнал,
   реестр — своими ханками. Коммиты явными путями; пуш после каждого.
2. e2e — только бокс; `FIXTURES=sponsoring-nation,sponsoring-nation-locked npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 10 %)
- `SponsoringNation.ts`: `description` новым ключом (решение 2); `behavior` / `requirements` — без изменений; манифест — `politics: 'redux'`.
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P83.png" P83` → `make:cards`); RU (решение 1); строка `SPONSORING_NATION`
  долой; `make:cards` 0 / 0 / 0 (блок РТ — проверить, PL-1158); `make:json`.
- **Спек**: апстримный блок — байт в байт (классический стол, `assertAddDelegateAction`); `describe('on a Turmoil Redux table')` по форме T03 `:116–345`: правила 1–5 по
  одному `it` — 3 / 4 метки (джокер Research Coordination; эффект Учёных у власти — считается), резерв «1 of 2» / ровно 2 (лобби — не резерв), розыгрыш → РТ +3 и
  ОДИН грант на 2 (`votePrompt.source 'grant'`, `count 2`, `printed 2`, `choiceContext.source {kind: 'card', card}`), оба кубика из резерва на одну резолюцию, лобби
  нетронуто, леджер; Зелёные у власти → +6 M€ ответом (событие реакции партии); пустая область — РТ получен, строка журнала; превью — чипы + `delegateGrantFollowUp`,
  пустая область — `note warning`, read-only; раздача под Redux только с маркером; MarsBot-стол (карта в руку); save / reload под грантом.

## 2. Клиент — карта (≈ 5 %) и класс (§3.Б)
Даром: плашка и причина требования, причина резерва, чипы, ряд «затем», скидка в оплате, РТ-жетон, ответ Зелёных, крошка «ГОЛОСОВАНИЕ», полёт кубиков из резерва.
Класс — решение 3(б), если «до» его подтвердит (§3.Б).

## 3. ГЛАВНОЕ — ПРОХОД ТРЁХ СОБЫТИЙ ОДНОГО НАЖАТИЯ И СТЕНД (≈ 85 %)
Форма — чек-лист P76 A–M; здесь — чем P83 отличается:
- **A. Рука.** `-locked`: плита заперта, причина «Нужно меток: 4» с «2»; основная — играбельна, цена 18 (скидка Teractor).
- **B. Осмотр X.** Арт P83, лор; плашка «4 [Земля]»; блоки: требование · 3 РТ · «Добавьте 2 делегата на одну резолюцию»; лицо — `[РТ][РТ][РТ]` / `[делегат][делегат]`.
- **C. Композер.** Чип «РТ N → N+3», чип «−2 делегата · из резерва 6 → 4», ряд «затем: 2 делегата на одну резолюцию — сразу после розыгрыша»; «Сработает» — Зелёные
  «+6 M€» (каскад P75); оплата — заголовок называет скидку, CTA «Разыграть · 18 M€»; курсор на CTA; 0 POST.
- **D. Коммит — три события по очереди.** ОДИН POST; цена с рельса в печатную стоимость; карта ложится в «РАЗЫГРАНО»; РТ-жетон рождён на печатных РТ-значках
  лежащей карты → ячейка рейтинга тикает на посадке (до — N на каждом сэмпле); M€ Зелёных — по жетону с их хартии в ряд M€ ПОСЛЕ; ТОЛЬКО ЗАТЕМ дверь голосования.
- **E. Голосование — шаг того же флоу.** Крошка «КАРТЫ В РУКЕ › НАЦИЯ-СПОНСОР › ГОЛОСОВАНИЕ» (корень и имя — те же vnodes, стадия — хвост); Парламент — ОДИН
  инстанс внутри руки (`parlOutsideHand` false); дверь карты; B — «Свернуть» (парк с шагом), A с доски — тот же шаг; A на резолюции → кубики из резерва на ленту
  резолюции (TR03 — резерв тикает на отрыве, место заполняется на посадке); флоу ЛЕВИТ на доску.
- **F/G/H.** Карта в таблице (зелёная), HUD меток: Земля +1 (5); журнал — «+3 РТ», «+6 M€ (Зелёные)», «добавляет 2 делегата на <резолюция>»; соперник — «+3 РТ · 2
  делегата на <резолюция>».
- **I. «Сработает».** Земля — Martian Zoo / Point Luna (grep `onCardPlayed` ∧ `Tag.EARTH`); Зелёные — ответ на РТ; ряд честен.
- **J. Края (сервер).** Пустая область (именованный пропуск, РТ получен); резерв 1; RX42 вето — чтение честное; 3 метки.
- **K/L/M.** Save / reload под голосованием (T03 `:333`: карта и РТ стоят, вопрос снова — и в консоли: рука восстанавливается с шагом или standalone-Парламент честно
  (reload — «a grant with no such flow keeps the standalone Parliament», `cardGrantHost.ts`) — записать, что увидел); X из голосования — осмотр карты.

### 3.Б Класс «грант без двери поля — шаг того же флоу» (решение 3(б), раздел CX)
`cardGrantHost.ts` — второй читатель над ЖИВЫМ стеком (чистая функция, та же `cardGrantOwedTo`); `consoleWorkspaceFlow.ts` — `owed-step` розыгрыша для гранта
(структурный признак: `party` + `grant` + даритель = карта флоу; снимается ответом / пропуском / уходом промпта); `ConsoleShell.vue:20484` — ветка хостит и розыгрыш
(вероятно, уже хостит — тогда правка только в заключении); спеки `cardGrantHost.spec` § живой стек, `consoleWorkspaceFlow.spec` § owed grant; доки — `workspace-band.md`
абзац; CLAUDE.md не трогать (формулировка «ONE PRESS, SEVERAL EFFECTS» покрывает). Никаких таймеров; удержание именовано; стили не нужны; ореол — нет.

## 4. Лицо, локаль, лор, арт
Арт P83; лор EN + RU; RU описания (решение 1); `card_info` — строка гранта с RU есть, блок РТ — проверить RU; «резолюция», «резерв», «область голосования», «РТ» —
глоссарий / канон; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack` (политическая — маркер), `premiumScope`, `cardPlayPreviewCoverage`, `cardInformation` (KEY-rule против новой
   `description` — без `ACCEPTED`; порядок блоков), `requirementProse` (EN + RU «4 метки Земли»), `premiumCardViewModel`, `premiumCardIcons`, `cardLore`,
   `crossPlayerCoverageGuard`, `parliamentGlossary`, `PoliticalThinkTank`-класс (пул карт с требованием партии — у P83 требование МЕТОК, не партии: не входит),
   `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`; класс — `cardGrantHost.spec`, `consoleWorkspaceFlow.spec`,
   `consoleWorkspaceStack.spec`.
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия — канарейка, **`console-cultural-metropolis`** (дверь (а) не сломана), **`console-political-donation`**
   (staged-дверь TR03), **`console-colony-venus-trade-delegates`** (дверь (в) — колония Венеры), `console-play-tr-reward` (РТ-жетон, Зелёные после), `console-summit-logistics`
   (политическая рука), `console-ghg-shipment` (каскад «Сработает»), `console-parliament-create`, `console-effect-decision-embed` / `console-mu-colony-question` (owed /
   embedded цепочки — если тронуто заключение), `console-deck-pick-collapse` (парк → возврат).

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p83/tv4k/`: (а) `-locked`: плита заперта «Нужно меток: 4»; (б) композер: чипы РТ и резерва, ряд «затем», «Сработает» Зелёных, скидка в оплате; (в) коммит:
карта лежит, РТ-жетон в ячейку, M€ Зелёных в ряд; (г) голосование ВНУТРИ руки с крошкой «… › ГОЛОСОВАНИЕ» (и кадр «до», если лента была отдельной); (д) кубики из резерва
на резолюцию; (е) доска после ухода, журнал. Своим глазом: «я вижу, что ОДНО нажатие дало три вещи ПО ОЧЕРЕДИ, и голосование — продолжение МОЕЙ карты, а не другой экран?»

## 7. Полировка по пути
1. Реестр **CX** «P83 · ГРАНТ ДЕЛЕГАТОВ РОЗЫГРЫША БЕЗ ДВЕРИ ПОЛЯ — ШАГ ТОГО ЖЕ ФЛОУ · ТРИ СОБЫТИЯ ОДНОГО НАЖАТИЯ ПО ОЧЕРЕДИ» — решения 2–4 строками «что было / что
   стало / где» + находки прохода (в т.ч. «до» — даже если класса не оказалось: строка-наблюдение, какая ветка хостит); номера — по footer. Без гэпов — только журнал.
2. Доки: журнал серии (P83); `PRELUDE2_ADAPTATION.md` (8 / 54; строка; §3.1 п. 5); `workspace-band.md` (если класс); память `prelude2-adaptation.md` (8 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — «до» на боксе: фикстура основная + проба T03 (`armStory`): где встаёт голосование, в каком порядке события, уходит ли рука. Порядок:
   карта (описание, маркер) + спек + строка долой → лор / арт / RU → `make:cards` → фикстуры + стенд (клетки 1–2, запись истории) → «до» → решение 3 (класс + юниты,
   если (б)) → проход A–M + «после» → CX → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после» (история: порядок трёх событий и хост голосования); таблица A–M с кадрами; POST на розыгрыш и
   на голосование (ОДИН + ОДИН); гарды и `make:cards`; регрессия на боксе (аннотация `build`); решения 1–7 (что сделано по каждому — без вопросов владельцу); гэпы
   честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Переводить P83 на bespoke / staged-дверь TR03 (`delegateGrantStep`) ради хостинга — карта декларативная, дверь живая; второй Парламент (`.con-parl` вне руки) как
  «решение»; пауза / таймер вместо `owed-step`; хостить по заголовку промпта (только маркеры `votePrompt.source === 'grant'` + `choiceContext.source`); читать
  политику мимо фасада; голую запись в слот Парламента в спеке / фикстуре; `'both'` без причины; прятать запертую карту; `title`; литерал кнопки; ореол.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; править файлы
  соседа (шапка; `ConsolePlayCardConfirm.vue` — только по согласованию); переоткрывать находки P76…P75; ломать двери (а) T03 и (в) колонии Венеры.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить чужие файлы; пересборку во время прогона e2e на боксе.
