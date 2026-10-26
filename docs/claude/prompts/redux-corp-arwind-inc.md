# Промт исполнителю · Arwind Inc. — ПЕРВАЯ из восьми НОВЫХ корпораций набора Redux (не замена): 38 M€ + 1 пр. титана, метка Космос; **ДЕЙСТВИЕ: положите 1 истребитель на ЛЮБУЮ карту**; **ЭФФЕКТ 1: каждый раз, когда ваш маркер Карьеры продвигается на 1 шаг, положите 1 истребитель на ЛЮБУЮ карту**; **ЭФФЕКТ 2: при розыгрыше карты с меткой Космоса истребители С ЭТОЙ КАРТЫ платят по 4 M€** · ДВЕ новые инфраструктуры сквозным контрактом: (а) ХУК ШАГА КАРЬЕРЫ `onAgendaStep` внутри ОДНОЙ ходьбы `walkAgenda` — одна дверь на все четыре причины (карта · задание председателя · победа в заседании · закон); (б) ЧЕТВЁРТАЯ карточная платёжная единица `arwindFighters` (тропа `mechs`, Космос, 4) · **ГЛАВНОЕ — КУДА ЛОЖИТСЯ ИСТРЕБИТЕЛЬ:** от розыгрыша карты — PRE-SELECT в композере розыгрыша (вопрос стола, посев единственной цели, адресованный ответ); от задания председателя / принятия резолюции / закона — ВСТРОЕННЫЙ ШАГ ВНУТРИ workspace Парламента на ТОЙ ЖЕ поверхности выбора цели, что у всех «ресурс на любую карту» (`ConsolePlayedTargetStep`), с максимально бесшовным входом → выбором → возвратом в поток Парламента — эту часть проработать тщательнее всего

> **Статус: ВЫДАН 2026-10-26.** HEAD `955897496c` (TR52 › бот: групповой шаг цели). Дерево НЕ чистое — соседи держат
> `ConsolePlayCardConfirm.vue`, `ConsoleParliamentVoteMode.vue`, `consoleParliamentVoteMotion.ts`, `workspaceDescend.ts`,
> `GreeneryStandardProject.ts`, `consoleStart.ts`, `fixtures/generate.ts`, спек Scientific Breakthrough (`git status`); `ListAgents`
> перед каждой серией коммитов, коммиты ТОЛЬКО `git commit -- <paths>`. **Скан** — `C:\Users\zelin\Downloads\TM Turmoil Redux\
> Corporations\Corporation - Arwind Inc.png` (в папке ещё 7 новых: Ferrus Academy, Hartlan Heating, Lotus Innovations, Proteus, The
> Deimos Group, Titan Holdings, Veynon Dynamics — Arwind первая). **Арт ГОТОВ** — `C:\Users\zelin\Downloads\Mars Arts\Arwind Inc.png`
> (промт арта `docs/claude/prompts/corporation-art-arwind.md`) → `node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\
> Arwind Inc.png" TR78` → `npm run make:cards` (размер не 1536×1024 — `--force`). **Лор — СО СКАНА**, ключа нет ни в EN, ни в RU:
> EN в `assets/text/lore_texts.json` под `TR78`: «Arwind doesn't just want to be a spaceship manufacturer. It wants to be THE spaceship
> manufacturer, with a de facto monopoly on the whole business. And it has sought to achieve this via exclusive government contracts.»;
> RU в `src/locales/ru/lore_texts.json` (ключ = английский текст): «Arwind не просто хочет строить космические корабли. Она хочет быть
> ЕДИНСТВЕННЫМ их производителем — с фактической монополией на всю отрасль. И добивается этого через эксклюзивные государственные
> контракты.» Имя — латиницей (`zz_corporation_names.json`, как `Septem Tribus:153`). Реестр полировки: следующий свободный **PL-1026**,
> последний раздел CL; **своего раздела нет** (полировки нет) — дефекты общего слоя строками. **e2e — ТОЛЬКО Steam Machine**
> (`npm run e2e:snapshot arwind` → `npm run e2e:remote -- arwind <spec>`; сцены полёта / заседания — TIMING `--exclusive --workers=1`;
> exit 2/3/4 — стоп и `AskUserQuestion`).

Процедура — **чеклист `docs/claude/turmoil-redux-card-checklist.md` §0** («новая механика? — СНАЧАЛА её инфраструктура сквозным контрактом,
образец меха `docs/TURMOIL_REDUX_EVA_MECHS.md` §2–§3, потом карта» — здесь ДВЕ), §1 (п.4: эффект-платёжная единица ОБЯЗАН нести
`.equals().megacredits(N)`; ресурс — `b.resource(CardResource.FIGHTER)`, отдельных билдеров не заводить), §2 (арт/лор), §3 (гарды-ворклист),
**§5 политика e2e** (новая механика → свой спек), §6. Корпорация-образец — **TR77 `turmoilRedux/SeptemTribusRedux.ts`** (шапка SCAN READING /
RULE READINGS, `corpBox('effect')`, две `effect-short` с `tokens`, бюджет 52 символа; но у Arwind НЕТ первого действия и НЕТ `reimplements` —
свой арт TR78, свой лор). Декларативное действие корпорации «ресурс на любую карту» — **`venusNext/Celestic.ts:22`** (`action:
{addResourcesToAnyCard: {type, count}}`). **Контракты консоли:** `CLAUDE.md` § A WORKSPACE IS ONE FLOW (четыре условия стадии: встроена ·
крошка непрерывна · переход «та же фраза на уровень глубже» · B один уровень), § COMMIT BOUNDARY (`owed-step`, `FOLLOW_UP_STEP_STAGES`),
§ EMBEDDED STEP SURFACES (`consoleWorkspaceStack.ts`, `.claude/rules/console-ui.md`), **`docs/claude/console/composer-preselect.md`**
(T14: `nextCursorAfterAnswer`, прибытие на коммит, `soleCandidateOf` + «ЕДИНСТВЕННАЯ ЦЕЛЬ»), `docs/claude/console/parliament-sitting.md`
(зона `[data-embed-slot="parliament-stage"]`, `stageHeld` / `deferredStep`, «встроенный шаг называет стадию в баре: ВЫБОР»),
`docs/claude/console/parliament-soft-gates.md` (§3 «заседание поднимается» — вопрос заседания держит `stage-gate` до стоящей сцены;
§6 РАННЕЕ ЗАКРЫТИЕ — чип `asking` «кто отвечает и что» Р-5), `docs/claude/prompts/parliament-chairman-quest.md` §3 (биты ЗАДАНИЕ →
ПРЕДСЕДАТЕЛЬСТВО → ПОВЕСТКА), `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md` (TR04: ходьба — ИСХОД в руке, Парламент — SHOW-шаг
в зоне руки), `docs/TURMOIL_REDUX_EVA_MECHS.md` §3–§4, §7 (единицы `mechs` / `supercomputerData` — таблица касаний), `docs/claude/
parliament-glossary.md` §4 («Карьера» / «маркер Карьеры» / «шаг Карьеры»; «Повестка» ЗАПРЕЩЕНА), §4a (значок шага — нашивка
`b.agendaStep(n)`, память `career-step-insignia`), память `parliament-step-full-stage` (полноразмерный шаг берёт всю сцену, карта-источник
уходит, L3 «Источник»), `visual-restraint-no-glow` (инвариант 15 — Парламент на нуле ореолов), `status-line-no-face-restatement`,
`resolution-texts-card-dose`, `composer-preselect-direction`, инварианты 1–4, 6–9, 12, 13, 15.

**Образцы — по частям:** **ходьба** — `parliament/quests/ChairmanSeat.ts:60–68` (`AgendaWalkCause` — четыре причины `quest | phase | card |
resolution`), **`:106–152` (`walkAgenda` — ОДНА функция: шаг за шагом, `payStep` каждого шага ДО следующего, одна запись `lastAdvance`,
одно событие `agenda-advanced`; карта/закон — в своём скоупе, заседание/задание — `withSource({kind:'parliament'})`)**, `:159–180`
(`payStep` — `tr` / `card` / бот = 1 M€); вызовы: карта — `turmoilRedux/{MinorityRepresentation:108, PartySanctions:96, RedLawyers:116,
GreenAllegiance:132, PoliticalRecognition:104, PoliticalAllianceRedux:97, VoteOfNoConfidenceRedux:129}` (синхронно в `bespokePlay`),
задание — `ChairmanSeat.applyQuest` / `seatPrompt.finish` (`{reason:'quest'}`), заседание — `ParliamentPhase.stepAgenda:398–423`
(`{reason:'phase'}`), закон — `resolutions/ResolutionAgendaGrant.ts:60–100` (`payAgendaGrant`, RX39 Reds Budget, `{reason:'resolution'}`);
**фаза** — `ParliamentPhase.ts:1–45` (шапка: RESUMABLE-драйвер, ключи идемпотентности, «игра, сохранённая пока закон спрашивает,
загружается В вопрос»), **`:287–345` (`drive()` — после КАЖДОГО case `drainDeferred()`: отложенная работа шага может ЖДАТЬ — это и
есть дверь для вопроса хука на шаге `agenda`)**, `:271–284` (`drainDeferred` → `continue()` по ответу), `:228` (`seatsAhead`), `:573+`
(`stepEffects` — как ждёт вопрос места), `SittingAcks.offerEarly` (раннее закрытие — чип `asking`); **хуки карт** — `ICard.ts:326`
(`onDelegatesDiscarded` — образец «вызывается ОДИН раз внутри `events.withEffect(player, card, …)` под ключом шага»), `:350`
(`onRulingPartyChanged`), `:365` (`onResolutionWon` — TR77), `:131` (`agendaWalkForecast` — read-only модель ходьбы карты),
`:202` (`cardPlayedForecast` — прогноз РЕАГИРУЮЩЕЙ карты на розыгрыш), `EventRecorder.ts:423` (`recordAgendaAdvanced`); **«ресурс на любую
карту»** — `deferredActions/AddResourcesToCard.ts` (кандидаты `getCards`, маркер `resourceGainPrompt`, `cause: ChoiceContextSource`,
`holdsOneOf`), `SelectResourceTarget.ts:1–40` (шапка: NO AUTO-SELECT — единственный держатель всё равно СПРАШИВАЕТСЯ; «перезагрузка между
выбором и клеткой теряет очередь — известное поведение движка»), клиент `consoleTaskRouter.ts:771–816` (`case 'card'` → `cardSelect
'target'`), `:397–467` (`FOLLOW_UP_STEP_STAGES` / `followUpStepStage` — слово стадии встроенного шага по ВИДУ промпта), `cardResourceDistribution.ts`,
**`components/console/played/ConsolePlayedTargetStep.vue`** (встроенный шаг цели: без band-геометрии, контракт «КУДА: [печать] N»
`data-ptsel-where` / `data-ptsel-payload`, хосты — `ConsolePlayCardConfirm`, `ConsoleActionComposer`, `ConsoleHydroSection`,
`ConsoleTradeTargetStep`, `ConsoleBotAttack`); **pre-select** — `effectForecastPreviews.ts:131–140` (`tableQuestion(card, player, question)` —
«вопрос стола как шаг превью: реагирующая карта отдаёт прогнозу ТОТ ЖЕ промпт, что деферит живой хук — один билдер в файле карты»),
`:160+` (`asks` — факт с вопросом, `timing`), `models/preselectAddresses.ts` (адрес шага = роль + источник; `NOT_STAMPED`), `inputs/
deferredInputBatch.ts` (ответ ложится ТОЛЬКО на свой адрес; парковка чужого), `.claude/rules/server.md` § pre-select law, память
`table-question-deferrable-discard`; **хостинг шага в Парламенте** — `ConsoleShell.vue:5205–5300` (**`parliamentStageTask` /
`parliamentStagePrompt` — «вопрос принятой резолюции = живой хост-промпт ВНУТРИ заседания», сегодня ТОЛЬКО по `promptSourceResolution(wf)`;
`sittingRiseGatesPrompt` — ворота стадии; `taskEmbedTarget` → `'.con-parl [data-embed-slot="parliament-stage"]'`**), `:9091–9096` (бар
называет СТАДИЮ, не свой кикер — P-13), `:4852 / :8789 / :20432 / :20594` (`hostedStepOwedTo('hand')` — `owed-step` руки), `promptSource.ts:249`,
`ConsoleParliamentSection.vue:348` (`STAGE_ZONE_SELECTOR`), `:2236–2262` (`openQuestFlow` → `startChairmanQuestBeats` · `endQuestFlow` на `done`),
`:2299` (`openStage('walk')`), `:2661` (`openStage`), `consoleParliamentFlow.ts:180` (`ParliamentStage` — `'quest' | 'walk' | 'sitting' | 'banner' …`),
**`parliament/hostedParliamentStep.ts`** (ОДНА пара вопросов шелла о шаге, который розыгрыш должен Парламенту: `owedTo` / `liveIn` / `toEnter`
по ВИДУ — расширяется третьим видом, не второй копией ветки), `parliament/agendaWalk.ts:1–120` (promised → owed → live; `seedAgendaWalkHolds`
в блоке применения вида), `consoleChairmanQuest.ts` + `chairmanQuestDirector.ts` (биты, `AgendaWalkHooks.onLanded`), `sittingDirector.ts:1–80`
(ПРИНЯТИЕ: ПОВЕСТКА → ПОДДЕРЖКА → ПРИНЯТИЕ; «дожать»; `expire`), `parliamentRewardBeat.ts:1–60` (ОЧЕРЕДЬ бонусов шагов Карьеры — по одному
на ПЛАТЯЩИЙ шаг: `takeAgendaBonus(gen, step)` / `markAgendaBonusLanded(step)`), **`bannerCubeStage.ts:1–30` (TR77: «КОРПОРАЦИЯ ПОДНИМАЕТСЯ,
КУБ СЛЕТАЕТ С ЕЁ ПЕЧАТНОГО ЗНАЧКА» — RISE · STAND · CARRY · READ · SINK; один закон для первого действия и заседания)**, `consoleTaskSummary.ts:
149–170, :254` (кикер по `choiceContext.mode` / источнику; «Resolution effect»); **платёжная единица** — `common/inputs/Spendable.ts`
(`SPENDABLE_CARD_RESOURCES` — `mechs` / `constructionMechs` / `supercomputerData` с комментариями «единица называет ОДНУ карту»),
`common/inputs/Payment.ts:48–54, :73–75, :93–95`, `Player.ts:1479–1488` (`paymentOptionsForCard` по метке), `:1600–1604` (`pay()` →
`removeResourcesOnCard(CardName.X, payment.unit, DEFAULT_PAYMENT_VALUES.unit)` — это и есть трекинг), `:2547–2549`, `:2594–2596`,
`inputs/SelectPayment.ts:42–44`, клиент `console/paymentPlan.ts` (`projectCardPaymentOptions`, `PAY_UNIT_LABELS`, **`PAY_UNIT_ICONS`** — иначе
пустой квадрат), `railValueModel.ts` (`CONTEXT_FOR_CARD_UNIT` → бейдж «4 M€ · Космос»), `handTenderPlate.ts`, `paymentModelUtils.ts`
(`GENERIC_PAYMENT_ORDER`), e2e `console-eva-mechs`; **держатели истребителей в скоупе** — `resourceType: CardResource.FIGHTER`: TR08 Formula
Zero, TR28 Earth Army Contract, TR29 Spaceship Recycling, TR35 Mars Army Ships, TR60 Civilian Spacefighters (+ сама Arwind); иконка
`assets/resources/fighter.png`, `cardResources.ts:6` (`card-resource-fighter`), RU «истребитель» (`card_info.json:33, :489–552`); **реестр
номеров** — `common/cards/turmoilReduxReplacements.ts:26–34, :98–112` (TR71…TR77 — ТОЛЬКО замены; `replacementCardNumber`), гард
`tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts:56–96` (`within(1, 77)`; «номер > 70 — строка реестра замен»), `:176–189` (свои
корпорации модуля), манифест `TurmoilReduxCardManifest.ts:82–110, :379–390` (`corporationCards`, `cardsToRemove`); **MarsBot** —
`automa/corps/AutomaCorporations.ts` (двойника Arwind нет — коллизии нет; бот не играет ею); **гарды** — `TurmoilReduxCardManifest.spec`
(номер), `deckComposition.spec` (число Redux-корпораций), `premiumScope.spec`, `devGuaranteedCards.spec`, `cardInformation`, `cardLore`
(TR78 EN+RU), `CardMetadata`, `effectCaption.spec` (≤ 52), **`effectForecastParity`** (живой хук ↔ двойник прогноза — упадёт без двойника),
`cardPlayReplayCoverage.spec` (адрес шага), `crossPlayerCoverageGuard`, `PartyEffectAccessAnnounce` (не задет), `parliamentGlossary.spec`,
`parliamentNoTimers.spec`, `glowRestraintGuard` (Парламент = 0), `oneFrameworkGuard`, `cursorGrammarGuard`, `glyphLiteralGuard`, `i18n.spec`,
`e2eLiveness.spec`, `AgendaStepGlyph.spec` (текст «advances … Agenda marker» ⇔ нашивка).

---

## Диагноз (подтверждён файл:строка на `955897496c`; перепроверить на своём HEAD)
1. **Ходьба трека — ОДНА функция, хука шага НЕТ.** `walkAgenda` платит бонус каждого шага (`payStep`) и пишет одну запись; карт-хуков на
   шаг нет (есть `onResolutionWon` / `onRulingPartyChanged` / `onDelegatesDiscarded` — всё в заседании). Значит эффект 1 Arwind — **НОВЫЙ
   co-located хук `ICard.onAgendaStep?(player, step: {to, bonus?, index, of, cause: AgendaWalkCause})`**, вызываемый ВНУТРИ `walkAgenda` для
   каждого взятого шага СРАЗУ ПОСЛЕ `payStep` (печатный порядок «бонус шага, затем реакции»), по `player.tableau` (корпорация включена, как
   `onCardPlayed`), под `events.withEffect(player, card, 'agenda-step')`; `player.isMarsBot` — не зовётся (у бота своих карт нет; двойника Arwind
   нет). Одна дверь — четыре причины приходят бесплатно: карта (синхронно внутри `bespokePlay`), задание (`applyQuest` / `seatPrompt.finish`),
   заседание (`stepAgenda`), закон (`payAgendaGrant`, RX39 — по шагу на КАЖДОЕ место с Arwind).
2. **Хук ДЕФЕРИТ вопрос, фаза уже умеет ждать.** Реакция = `game.defer(new AddResourcesToCard(player, FIGHTER, {count: 1, autoSelect: false,
   cause: {kind:'corporation', card: ARWIND}, …}))` + НОВЫЙ структурный маркер на модели `SelectCard` — **`agendaStepPrompt: {source: CardName,
   reason: AgendaWalkCause['reason'], step: number, index: number, of: number}`** (сериализуется в `ServerModel.getWaitingFor` рядом с
   `resourceGainPrompt`; консоль по нему решает ХОСТ: `reason:'card'` в руке → композер/рука, иначе → Парламент; никогда по заголовку —
   инвариант 1). В заседании `drive()` зовёт `drainDeferred()` после case `'agenda'` → фаза честно останавливается на вопросе и
   продолжается по ответу (`continue()`); порядок правил сохранён: истребитель лёг ДО поддержки/принятия (RX40 Sponsored Projects считает
   «карты с ресурсами» — порядок наблюдаем). В задании вопрос встаёт в том же ответе, что подтверждение ворот (`applyQuest` → ходьба →
   defer → `process` → `waitingFor` = выбор). Закон — внутри `runSeatStep` места, как любой вопрос закона.
3. **Перезагрузка посреди вопроса в Парламенте теряет истребитель (инвариант 4).** `drive()` ставит `p.step = 'support'` ДО `drainDeferred`;
   очередь не сериализуется — resume проедет мимо вопроса, истребитель пропадёт молча (класс `SelectResourceTarget` — «известное поведение
   движка» — для розыгрыша в одном запросе терпим, для заседания с автосейвом после каждого ответа — нет). Нужна запись в
   `parliament.pendingActions` (`{kind:'card-reaction', player, card: ARWIND, resource: FIGHTER, count, reason, step, index, of}`), снимаемая
   ответом и ПЕРЕИЗДАВАЕМАЯ на resume по образцу `deferPendingQuestGates` (решение 4).
4. **Pre-select при розыгрыше — тропа готова, не хватает двойника.** Композер розыгрыша собирает «вопросы стола» реагирующих карт
   (`tableQuestion` → `asks`-факт с ТЕМ ЖЕ промптом, адрес `{role:'card', source: {kind:'corporation', card: ARWIND}}`), батч кладёт ответ
   только на свой адрес. Карта, которая ходит, уже отдаёт модель ходьбы (`agendaWalkForecast` → `AgendaWalkModel.steps`). Значит двойник Arwind —
   **`cardPlayedForecast(owner, active, playedCard, ctx)`: читает `playedCard.agendaWalkForecast?.(active)`, на каждый шаг — `asks`-факт с
   `tableQuestion(this, player, <тот же AddResourcesToCard.toPlayerInput>)`**, `timing: 'after-card'` (ходьба синхронна в розыгрыше — вопрос
   после собственных выборов карты). Один билдер промпта в файле карты, его читают и живой хук, и прогноз (`effectForecastParity`). Два шага =
   два вопроса одного адреса — проверить, что `replayBatch` кладёт два `own`-ответа на два последовательных своих промпта по порядку
   (`deferredInputBatch.ts`; если нет — адрес несёт `index`). Единственный держатель (Arwind одна на столе) — ПОСЕЯН, ПОКАЗАН, помечен
   «ЕДИНСТВЕННАЯ ЦЕЛЬ» (T14; сервер всё равно спрашивает, батч отвечает).
5. **Хостинг в Парламенте знает только вопрос РЕЗОЛЮЦИИ.** `parliamentStagePrompt` = `promptSourceResolution(wf) !== undefined` → вопрос
   Arwind (источник — корпорация) сегодня поднялся бы ОТДЕЛЬНОЙ плашкой поверх заседания / задания — ровно то, чего владелец не хочет.
   Расширить ОДНО чтение: вопрос с `agendaStepPrompt` и `reason ∈ {phase, quest, resolution}` — вопрос ПАРЛАМЕНТА (в фазе PARLIAMENT — заседания;
   при живом `chairmanQuestFlow` — задания); тот же `taskEmbedTarget` → `[data-embed-slot="parliament-stage"]`, та же `stage-gate` (вопрос
   заседания ждёт стоящей сцены — §3 мягких ворот), тот же бар-по-стадии (`:9091`). `hostedParliamentStep.ts` получает ТРЕТИЙ вид
   (`'reaction'`) — `owedTo` / `liveIn` / `toEnter` по виду, не вторая копия ветки.
6. **Полёт истребителя — закон причинности TR77.** Карта всегда уходит от реального источника: в Парламенте корпорации на сцене нет → **сцена
   `bannerCubeStage` (RISE · STAND · CARRY · READ · SINK) обобщается до «корпорация поднимается в ячейке стола, РЕСУРС слетает с её печатного
   значка»**: истребитель рождается на печатной иконке `[fighter]` строки эффекта Arwind и летит в счётчик ВЫБРАННОЙ карты (лицо-кандидат в зоне
   шага — измеренный адрес, `cardResourceDistribution`/`consoleResourceTransfer`, счётчик тикает на касании). В руке (розыгрыш, pre-select, без
   промпта) — тот же закон внутри SHOW-шага ходьбы: при посадке маркера на шаг (`AgendaWalkHooks.onLanded`) корпорация поднимается в зоне,
   истребитель уходит на карту-цель (её лицо — чип шага ленты «→ [fighter] → <Карта>»), очередь — как бонусы шагов (`parliamentRewardBeat`:
   по записи на шаг, `takeAgendaBonus(gen, step)`-класс, холд отпускается касанием). Reduced motion — без полёта, те же числа.
7. **Платёжная единица — четвёртая на тропе `mechs`.** «fighters HERE» — только истребители НА Arwind, метка Космос, 4 M€: один в один
   `mechs` (EVA, Космос, 5) — таблица касаний `EVA_MECHS.md` §3 (компилятор: `Spendable` / `Payment` / `Player`; молча: `PlayerInputModel`,
   `SelectCardToPlay` / `SelectPayment`, `SelectPaymentDeferred`, `effectForecast.paymentValuesOf`, `paymentModelUtils`, `paymentPlan`
   (`PAY_UNIT_ICONS.arwindFighters = 'fighter'`), `railValueModel` (`'space'`), десктоп-остатки, тесты). Константа `ARWIND_FIGHTER_VALUE = 4`.
   Авто-сев — EVA §4: жадный, ЕСЛИ у истребителей на Arwind нет второго применения (грепнуть скоуп на «spend a fighter from ANY card» —
   TR28/TR29/TR60 тратят СВОИ; если есть потребитель «с любой карты» — защищать как `floodgateSteel`) — решение 7.
8. **Действие — декларативно, никогда не впустую.** `action: {addResourcesToAnyCard: {type: FIGHTER, count: 1}}` (Celestic): превью, причина,
   композер действия с шагом цели — даром; Arwind сама держатель (`resourceType: FIGHTER`) → действие доступно всегда; с единственным
   держателем — посев «ЕДИНСТВЕННАЯ ЦЕЛЬ». ACTION COMMIT: импульс печатной строки действия → истребитель с печатного значка на цель.
9. **Номер.** Реестр знает только замены (TR71–TR77); гард `within(1, 77)` и «> 70 — замена». Новые корпорации набора — своя строка
   контракта: **`common/cards/turmoilReduxCorporations.ts`** (восемь строк в порядке папки сканов: Arwind Inc. TR78, Ferrus Academy TR79,
   Hartlan Heating TR80, Lotus Innovations TR81, Proteus TR82, The Deimos Group TR83, Titan Holdings TR84, Veynon Dynamics TR85; строка —
   `name`, `scan`, `authored?`), гард: «номер > 77 — строка этого реестра, `type === CORPORATION`» (решение 1).
10. **Текст (владелец: понятно, лаконично).** RU: «Вы начинаете с 38 M€ и 1 производством титана.» / «Действие: положите 1 истребитель на любую
    карту.» / «Эффект: каждый раз, когда ваш маркер Карьеры продвигается на 1 шаг, положите 1 истребитель на любую карту. При розыгрыше карты с
    меткой Космоса истребители с этой карты можно тратить как 4 M€ каждый.» Инфо-модель — ДВЕ `effect-short` (≤ 52): «Agenda step: 1 fighter
    onto any card» · «Space tag: fighters here pay 4 M€ each» (`tokens`, `effectChannels` — гоча TR77 ⑥). Досье — печатный текст.
11. **Гочи TR77, которые ударят снова:** ① новый маркер промпта ОБЯЗАН попасть в `taskFor` (`consoleTaskRouter`), иначе `unknown` = застрявший
    промпт; ② сцена-шаг НЕ рисует свой заголовок — `workspaceStackCrumb`; ③ посев в `App.update` получает частичные модели тестов — читать
    опционально; ④ `deckComposition.spec` — корпорация отдельно; ⑤ сетка удержания сцены заседания — 60 с, `expire` реальный (bcfa290743).

## Правила карты (спек `tests/cards/turmoilRedux/ArwindInc.spec.ts` пинит каждое)
1. Печатная: корпорация, 38 M€, `production: {titanium: 1}`, `tags: [Tag.SPACE]`, `resourceType: CardResource.FIGHTER`, без ПО, без первого
   действия; `cardNumber 'TR78'` (решение 1); арт TR78, лор TR78 (EN + RU); имя `'Arwind Inc.'`.
2. Действие: 1 истребитель на любой держатель (себя включая); Arwind всегда кандидат → всегда доступно; кандидаты = `AddResourcesToCard.getCards`
   (правило семьи, WARE-держатель включён); журнал «${player} adds 1 fighter to ${card}».
3. Эффект 1 — по ШАГУ: ходьба на N шагов = N вопросов по порядку (каждый под своим `index/of`); конец трека = шаг не взят = реакции нет;
   вето РТ (RX42) на шаг не влияет (маркер двинулся); все четыре причины зовут хук; бот — никогда; хук под `withEffect` (журнал — чип
   корпорации, нотификации соперникам — семья «ресурс на свою карту» = `none` в `crossPlayerCoverageGuard`); резолюция RX39 с двумя Arwind
   на столе (теоретически — одна копия; пин «один хук на место»).
4. Эффект 2 — единица `arwindFighters`: карта с меткой Космос — да, без неё — нет; стандартный проект — нет; 4 M€ за штуку; списание С
   КАРТЫ (`removeResourcesOnCard`), трекинг платежа; `paymentOptionsForCard` только при `tags ∋ SPACE`; переплата честная (ceil); без
   Arwind на столе единицы нет.
5. Перезагрузка посреди вопроса в заседании / задании — вопрос ПЕРЕИЗДАЁТСЯ (`pendingActions`), истребитель не теряется и не удваивается
   (решение 4); посреди розыгрыша — класс движка (пин «один запрос»).
6. Pre-select: превью розыгрыша карты-ходока у игрока с Arwind несёт N `asks`-фактов с адресом корпорации; батч с N ответами кладёт их на
   свои промпты по порядку; без ответа в батче промпт встаёт живым (fallback) — и консоль хостит его в руке (диагноз 5).
7. Save/load: `pendingActions` round-trip; классический стол Turmoil — Arwind не раздаётся (Redux-манифест); Redux — в выборе корпораций.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; батч — §8)
1. **Номер** — (а, рекомендовано) **TR78**, реестр новых корпораций `turmoilReduxCorporations.ts` (TR78…TR85 в порядке папки сканов),
   гард расширен до `within(1, 85)` + «> 77 — строка реестра корпораций»; (б) свой префикс — нет (один префикс, одно пространство — решение TR77).
2. **Текст** — диагноз 10 (одно предложение на действие, два на эффект); две `effect-short`.
3. **Заседание — вопрос НА шаге `agenda`** — (а, рекомендовано) хук деферит сразу, `drive()` ждёт на `drainDeferred` после `agenda`; остальные
   места видят чип `asking` «victor · Выбор карты» (Р-5 мягких ворот, расширить `seatsAhead` на шаг `agenda` + `pending.input`); раннее закрытие
   им НЕ предлагается (поддержка/принятие ещё впереди — им «ещё могут» показать); (б) отложить вопрос в конец цепочки — нет (печатный порядок,
   RX40 наблюдает).
4. **Честность перезагрузки** — (а, рекомендовано) запись `pendingActions {kind:'card-reaction'}` для причин `phase | quest | resolution`,
   переиздание на resume по образцу `deferPendingQuestGates`; для `card` — один запрос, запись не нужна; (б) класс движка везде — нет.
5. **Источник полёта** — (а, рекомендовано) один закон на три потока: корпорация ПОДНИМАЕТСЯ (обобщённый `bannerCubeStage` → `cardReactionStage`:
   карта + печатный значок + адресат), истребитель с печатного `[fighter]` строки эффекта → счётчик карты-цели; (б) полёт из ячейки «Разыграно» /
   рельса — нет (на 4K ячейки нет на сцене Парламента).
6. **Слово стадии** — (а, рекомендовано) **«ИСТРЕБИТЕЛЬ»** (объект, который кладут; с счётчиком «ИСТРЕБИТЕЛЬ 1/2» при двух шагах; в бар —
   то же слово через `FOLLOW_UP_STEP_STAGES`-класс по маркеру, не по виду `card`), глоссарий §4 — новая строка; (б) общее «ВЫБОР» закона — нет
   (не говорит, ЧТО кладут).
7. **Авто-сев истребителей в оплате** — (а, рекомендовано) жадный, как `mechs` (EVA §4), если в скоупе нет потребителя «истребитель с ЛЮБОЙ
   карты»; (б) защищённый как `floodgateSteel`, если есть — грепнуть и сказать в отчёте.
8. **Pre-select двух шагов** — (а, рекомендовано) две строки композера «шаг ⑦ → [fighter] → ?» / «шаг ⑩ → …», каждая сеет единственную цель;
   курсор после ответа — `nextCursorAfterAnswer`; (б) одна строка «2 × истребитель на одну карту» — нет (две разные карты — честный выбор).
9. **e2e** — `tests/e2e/console-arwind-inc.spec.ts` (НОВАЯ механика — обязателен; tv4k + fhd; TIMING-сцены — эксклюзив): (а) розыгрыш
   карты-ходока (TR37 Red Lawyers — 2 шага) с Arwind и двумя держателями: композер показывает две строки вопроса, посев/«ЕДИНСТВЕННАЯ ЦЕЛЬ»
   при одном держателе, ОДИН POST, рука хостит ходьбу, на каждой посадке — подъём корпорации и полёт истребителя, счётчики цели ТИКАЮТ на
   касании, ни одного промпта после; (б) задание председателя (`arwind-chairman-quest`): плашка → ЗАДАНИЕ → ПРЕДСЕДАТЕЛЬСТВО → КАРЬЕРА →
   **ИСТРЕБИТЕЛЬ встроен в зону сцены (RELEASE/UNFOLD/REVEAL из прямоугольника чтения шага, крошка `ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО › ИСТРЕБИТЕЛЬ`,
   корень и субъект — те же vnode)** → A → POST → подъём/полёт → SINK → поток уходит сам (без второго нажатия, без плашки); B на шаге —
   ничего не отменяет (вопрос обязателен; B = «свернуть» → плашка «ПАРЛАМЕНТ · ВАШ ХОД», A возвращает В ТОТ ЖЕ шаг с тем же курсором);
   (в) заседание (`arwind-sitting-win`: p1 Arwind, p1 победитель): пас → ВЕРДИКТ → ПРИНЯТИЕ: ПОВЕСТКА (маркер, бонус) → **шаг ИСТРЕБИТЕЛЬ в зоне
   сцены, стол под ним** → A → ответ ПРОДОЛЖАЕТ ТО ЖЕ заседание (ПОДДЕРЖКА → ПРИНЯТИЕ → НАГРАДА → ОБНОВЛЕНИЕ → ИТОГИ) без перезапуска страниц,
   без второго ВЕРДИКТА; второе место видит чип `asking` и не висит в «ожидании» без слов; (г) закон (`arwind-reds-budget`): RX39 ходит оба
   места — вопрос у Arwind-места в своём шаге, другое место не спрашивают; (д) оплата (`arwind-pay-space`): карта Космоса с 3 истребителями на
   Arwind — план оплаты сеет 4 M€/шт, дорожка с иконкой истребителя, бейдж «4 M€ · Космос», LT настроить, списание С КАРТЫ (счётчик Arwind
   тикает), карта без Космоса — дорожки нет; (е) действие: единственная цель посеяна, ACTION COMMIT — истребитель с печатного значка;
   (ж) reload посреди (в) — вопрос стоит заново, истребитель один; (з) reduced motion — те же числа без полётов; (и) бот за столом ходит —
   ничего; (к) `glowRestraintGuard` — ноль. Фикстуры в `tests/e2e/fixtures/generate.ts` по образцам `parliament-chairman-quest:6341`,
   `parliament-reds-budget-vote`, `septem-win` (`assignPinnedCorporations`).
10. **Объём** — сервер (хук шага + маркер + ledger + единица + двойник прогноза) ≈ 35 %, карта + лицо + тексты ≈ 10 %, консоль (хост в
    Парламенте — три потока, сцена реакции, pre-select строки, оплата) ≈ 45 %, стенд/доки ≈ 10 %; без полировки.

## 0. Рабочее дерево
1. `git log --oneline -1` → `955897496c`; `ListAgents` и `git status` перед каждой серией коммитов — соседи держат файлы из статуса выше
   (в т.ч. **`ConsolePlayCardConfirm.vue`** — твой композер pre-select: правки туда — ПОСЛЕ коммита соседа или ханками через временный индекс).
   Твои файлы — `turmoilRedux/ArwindInc.ts` + спек, `CardName.ts`, манифест (`corporationCards`), **`common/cards/turmoilReduxCorporations.ts`**
   (новый), `ICard.ts` (хук), `ChairmanSeat.ts` (вызов хука в `walkAgenda`), `Parliament.ts` / `SerializedParliament.ts` (`pendingActions`
   новый вид), `ParliamentPhase.ts` (`seatsAhead` / `asking` на шаге `agenda`), `AddResourcesToCard.ts` + `PlayerInputModel.ts` + `ServerModel`
   (маркер `agendaStepPrompt`), `Spendable.ts` / `Payment.ts` / `Player.ts` / `SelectPayment.ts` / `SelectCardToPlay.ts` / `paymentPlan.ts` /
   `railValueModel.ts` / `paymentModelUtils.ts` (единица), клиент: `consoleTaskRouter.ts` (`taskFor` + стадия), `promptSource.ts`,
   `ConsoleShell.vue` (`parliamentStagePrompt`-семья), `hostedParliamentStep.ts` (+ `agendaReaction.ts` — третий вид), `ConsoleParliamentSection.vue`
   (стадия `'reaction'` в `ParliamentStage`), `chairmanQuestDirector.ts` / `sittingDirector.ts` / `agendaWalkDirector.ts` (бит после посадки),
   `bannerCubeStage.ts` → обобщение, `consoleTaskSummary.ts` (кикер), `ru/{turmoil_redux_cards,card_info,zz_corporation_names,lore_texts,
   parliament}.json`, e2e + фикстуры, доки, `assets/card-images/TR78.webp`. Коммиты — ПО ХАНКАМ / явными путями; после коммита `git reset -q --
   package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot arwind` → `npm run e2e:remote -- arwind <spec> --exclusive --workers=1`;
   кадры «до» — клиент HEAD; exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — ДВЕ инфраструктуры сквозным контрактом, потом карта (≈ 35 % + 10 %)
1. **Хук шага** `onAgendaStep` (ICard, co-located; вызов в `walkAgenda` после `payStep` каждого шага, по `tableau`, `withEffect`, не боту) +
   маркер `agendaStepPrompt` + вид `pendingActions 'card-reaction'` + переиздание на resume + `seatsAhead` / `asking` на шаге `agenda` →
   спек `tests/parliament/AgendaStepHook.spec.ts` (четыре причины · N шагов = N вопросов по порядку · конец трека · бот · reload посреди
   заседания и задания · один раз под ключом · RX39 два места · журнал под чипом корпорации).
2. **Единица `arwindFighters`** — таблица EVA §3 целиком (+ §7 Supercomputer как свежий образец), константа 4, `paymentPlan.spec` § arwindFighters
   (cost 6 / 2 истр. / 20 M€ → 1 истр. + 2 M€; без Космоса — нет дорожки), `effectForecast` группа «Скидки и оплата» подхватила сама.
3. **Карта** `ArwindInc.ts` (шапка SCAN READING / RULE READINGS; `behavior {production: {titanium: 1}}`; `action {addResourcesToAnyCard}`;
   `onAgendaStep` → defer с маркером; `cardPlayedForecast` → `asks` по шагам `agendaWalkForecast` разыгрываемой карты (ТОТ ЖЕ билдер промпта);
   `infoText`; лицо: `megacredits(38)` + коробка производства титана, `corpBox('action')` «→ [fighter]*», `corpBox('effect')` две строки:
   `agendaStep(1).startEffect.resource(FIGHTER).asterix()` и `tag(SPACE)…resource(FIGHTER).equals().megacredits(4)` — нашивка шага по §4a,
   две коробки корпорации — проверить рендер (StormCraft / Eris имеют action-box; если одна коробка — строки через `vSpace`), спек (правила
   1–7), манифест `corporationCards`, реестр корпораций + гард, пикер корпораций под Redux (Arwind в раздаче), RU, лор, арт TR78.

## 2. Консоль (≈ 45 %) — ГЛАВНОЕ: встроенный шаг в потоке Парламента
1. **ОДНО чтение «это вопрос Парламента»** — `promptSource.ts` / `ConsoleShell.parliamentStagePrompt`: `promptSourceResolution(wf) !== undefined
   || agendaStepPromptOf(wf)?.reason ∈ {phase, quest, resolution}`; `taskEmbedTarget` — та же зона `parliament-stage`; `sittingRiseGatesPrompt` —
   те же ворота; `taskFor` → `cardSelect 'target'`; стадия — «ИСТРЕБИТЕЛЬ» по маркеру (решение 6); кикер бара = стадия (`:9091`); плашка
   свёрнутого — «ПАРЛАМЕНТ · ВАШ ХОД» (Р-6). `hostedParliamentStep.ts` — третий вид `'reaction'` (`agendaReaction.ts`: promised при розыгрыше
   ходока с Arwind → owed по ответу с маркером → live при открытии зоны → end по посадке истребителя), `owed-step` конклюзии руки / Парламента.
2. **Задание председателя** — `chairmanQuestDirector`: после посадки бита `agenda` (бонус шага лёг) и ПЕРЕД `done`: если в ответе стоит вопрос
   с маркером `reason:'quest'` → `openStage('reaction')`: зона сцены ОСВОБОЖДАЕТ чтение шага на месте (RELEASE), раскрывается из его
   прямоугольника (UNFOLD), внутри проступает `ConsolePlayedTargetStep` embedded (REVEAL) — лица-кандидаты с `current → resulting` и ПО-дельтой,
   посев единственной цели, строка «КУДА: [fighter] 1», команды «A Положить · X Осмотреть · L3 Источник (Arwind)»; крошка `ПАРЛАМЕНТ ›
   ПРЕДСЕДАТЕЛЬСТВО › ИСТРЕБИТЕЛЬ` — меняется ТОЛЬКО хвост (crossfade в общей ячейке); A → POST → **сцена реакции**: корпорация поднимается
   (RISE·STAND), истребитель с печатного значка → счётчик выбранного лица (CARRY, холд до касания), READ, SINK → `done` → `endQuestFlow` как
   сегодня. Пока вопрос стоит — поток ОБЯЗАН не концовиться (`owed-step`), «дожать» не проскакивает мимо вопроса, двойной A невозможен
   (`none`). B = «свернуть» (`collapse`): состояние и курсор живы, плашка возвращает в тот же шаг.
3. **Заседание** — `sittingDirector`: вопрос с `reason:'phase'` приходит с ответом паса ВМЕСТЕ с вердиктом и записью Повестки, но БЕЗ
   поддержки/принятия (фаза ждёт). Прогулка: ВЕРДИКТ → ПРИНЯТИЕ/ПОВЕСТКА (маркер, бонус) → **стоп на шаге ИСТРЕБИТЕЛЬ в зоне сцены** (стол
   отступает, как под выбором закона) → A → POST → сцена реакции → ответ несёт остальную сводку → директор ПРОДОЛЖАЕТ ту же прогулку с
   ПОДДЕРЖКИ (холды диффятся против `sittingBaselineOf`; страница не перезапускается; `deferredStep` / `stageHeld` — образец «поза, удержанная
   через смену шага в том же ответе»); «дожать» на вопросе — нет (вопрос — стоп). Другие места — чип `asking` «кто · Выбор карты · вас ещё
   могут спросить» (Р-5), без раннего закрытия (решение 3). Закон RX39 (`reason:'resolution'`) — вопрос в шаге места, как вопрос закона сегодня
   (эффекты), тот же хост и та же сцена.
4. **Розыгрыш (pre-select)** — композер розыгрыша: `asks`-факты Arwind → строки вопроса стола «шаг ⑦ → [fighter] → ?» в порядке шагов,
   посев единственной цели, `nextCursorAfterAnswer`, прибытие на коммит; ОДИН POST с адресованными ответами; затем рука хостит ходьбу
   (TR04-поток) и на КАЖДОЙ посадке маркера (`onLanded`) — сцена реакции: корпорация поднимается в зоне, истребитель → лицо карты-цели в чипе
   шага ленты («→ [fighter] → <Карта>»), счётчик тикает на касании; очередь — по записи на шаг (`parliamentRewardBeat`-класс). Fallback: если
   промпт всё же встал живым в руке (`reason:'card'`) — хост = зона руки (та же поверхность, тот же сценарий, крошка `КАРТЫ В РУКЕ › <Карта> ›
   ИСТРЕБИТЕЛЬ`), никогда плашка.
5. **Действие и оплата** — композер действия: шаг цели с посевом (готов); ACTION COMMIT — истребитель с печатного значка; оплата: дорожка
   `arwindFighters` с иконкой истребителя, бейдж «4 M€ · Космос», списание с карты тикает счётчик Arwind в «Разыграно» (PL-104 — цена уходит
   ПЕРВОЙ).
Спеки: `AgendaStepHook.spec` (сервер), `paymentPlan.spec` § arwindFighters, `consoleTaskRouter.spec` (`taskFor` маркер + стадия),
`promptSource.spec`, `hostedParliamentStep.spec` (третий вид), `chairmanQuestDirector.spec` / `sittingBeats.spec` (стоп на вопросе,
продолжение той же прогулки), `cardReactionStage.spec` (обобщённая сцена TR77 — `bannerCubeStage.spec` зелёный), `composerPlay.spec`
(две строки вопроса, посев), `consoleTaskSummary.spec` (кикер), `parliamentGlossary.spec` («ИСТРЕБИТЕЛЬ»), `glowRestraintGuard`,
`oneFrameworkGuard`, `cursorGrammarGuard`, `console-parliament-stability`.

## 3. Тесты и регрессия (≈ 10 %)
Стенд решения 9; гарды §1; регрессия (по 1–2 повтора на боксе): `console-parliament-chairman-quest`, `console-parliament-quest-plate`,
`console-parliament-reds-budget`, `console-minority-representation`, `console-vote-of-no-confidence`, `console-septem-tribus`,
`console-parliament-softgates`, `console-parliament-sitting*`, `console-composer-preselect`, `console-eva-mechs`, `console-corp-first-action`,
`start-scene-profiles`, `tv-profile-screens`; `npm run e2e:affected`; хуки — тем же диффом (инвариант 14); `npm run build:test`.

## 4. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd)
`screenshots/arwind/{tv,fhd}/`: лицо корпорации с артом TR78 (нашивка шага, строка «[Космос] : [fighter] = 4»); композер розыгрыша с двумя
строками вопроса и посевом; рука: посадка маркера → корпорация поднялась → истребитель на цели → счётчик; задание: ЗАДАНИЕ → КАРЬЕРА → кадр
«зона раскрылась из прямоугольника чтения» (три кадра RELEASE/UNFOLD/REVEAL) → выбор → полёт → уход; заседание: ПОВЕСТКА → стоп ИСТРЕБИТЕЛЬ →
ответ → ПОДДЕРЖКА продолжилась; чип `asking` у второго места; оплата Космоса истребителями (план, бейдж, списание). С дивана: «я ни разу не
видел ДРУГОГО экрана — я всё время был в Парламенте, один раз меня спросили куда положить истребитель, и после ответа Парламент просто
продолжился с того места?»

## 5. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer (следующий PL-1026).
2. Доки: новый `docs/TURMOIL_REDUX_ARWIND_INC.md` (хук шага — ОДНА дверь на четыре причины; маркер; ledger; единица; три хоста одного шага;
   сцена реакции; что наследует следующая корпорация-реактор); `TURMOIL_REDUX_EVA_MECHS.md` §9 «четвёртая единица»; `parliament-glossary.md`
   § 4 — стадия «ИСТРЕБИТЕЛЬ»; `parliament-sitting.md` — «вопрос на шаге `agenda`»; `parliament-chairman-quest.md` §3 — бит реакции;
   `parliament-soft-gates.md` §6 — `asking` на `agenda`; чеклист §0 — абзац «НОВАЯ корпорация набора (не замена): реестр
   `turmoilReduxCorporations.ts`, TR78…TR85»; `composer-preselect.md` — строка «вопрос стола реагирующей КОРПОРАЦИИ на ходьбу»; запись в
   журнале; память.

## 6. Режим работы
1. Читать до кода; §1.1 хук + маркер + ledger (спек) → §1.2 единица (спек) → §1.3 карта → §2.1 чтение/хост → §2.2 задание (макет зоны на
   живом Парламенте 4K: один кандидат / три кандидата — батч вместе с решениями 5–6) → §2.3 заседание → §2.4 pre-select → §2.5 → стенд →
   регрессия → раскадровки → доки. Коммит по ханкам на каждом шаге.
2. Отчёт: первой строкой — лицо с артом; затем кадры (задание — три кадра раскрытия + полёт; заседание — стоп и продолжение; композер),
   результат гардов/регрессии, решения 1–10 с тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (6 и 5 с кадрами, 3, 4, 1, 7 —
   рекомендация первой), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Вторая функция ходьбы или хук, вызванный мимо `walkAgenda`; хук мимо `withEffect`; хук боту; auto-select цели на сервере (единственный
  держатель — СПРАШИВАЕТСЯ, посев — только в композере/зоне); детекция промпта по заголовку или по `type:'card'` без маркера; отдельная плашка /
  модалка / второй экземпляр Парламента для вопроса; поверхность выбора, рисующая свой заголовок внутри чужой рамы; `v-if`-свап стадии (BLINK);
  ходьба/заседание, продолжающиеся ПОВЕРХ неотвеченного вопроса; «дожать» сквозь вопрос; потерянный при reload истребитель; истребитель,
  появившийся без полёта от реального источника; ореол/свечение/дыхание на кандидате, значке или сцене (инвариант 15); `title`; литерал кнопки;
  `setTimeout` вместо холда; единица, платящая за стандартный проект или не-Космос; списание истребителей НЕ с Arwind; текст длиннее скана.
- RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
