# Промт исполнителю · «Заседание парламента», фундамент: Э0 → Э1 → Э2 → Э3 → Э4 одним автономным прогоном

Выдан 2026-09-19 по утверждённому плану `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` (§14, §16). Э6 сдан
(`docs/TURMOIL_REDUX_PARLIAMENT_VOTE_ONE_NUMBER.md`). Следующий прогон после этого — Э5 (стадия НАГРАДА:
волна, добор без дубля и призрака, парковка под тайл).

---

Ты — исполнитель ПЯТИ этапов плана `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` в приватном форке
`terraforming-mars` (vize1215): **Э0 → Э1 → Э2 → Э3 → Э4**, строго в этом порядке, одним автономным
прогоном на несколько дней. Тебя никто не будет прерывать и никто не ответит на вопросы посреди работы —
решения принимаешь сам, документируешь и идёшь дальше. Отвечаешь в чате, ведёшь журнал прогресса и пишешь
документы по-русски.

**Главный приоритет — ОЧЕНЬ качественная и ФУНДАМЕНТАЛЬНАЯ реализация с отличной визуальной подачей и
вниманием к деталям.** Не «закрыть пункты плана», а построить архитектуру, в которую следующие 43
резолюции каталога только добавляются. План — минимум, не потолок: **если видишь слабое место или простор
для улучшения в территории этих этапов — бери в работу и прорабатывай глубоко**, фиксируя в документе,
что и почему сделано сверх плана. Единственное, что нельзя, — оставлять полусделанное: каждый коммит
зелёный и цельный.

## 0. Режим работы

- **Порядок:** Э0 → Э1 → Э2 → Э3 → Э4. Этап не начинается, пока предыдущий не принят по его критериям.
  Внутри этапа — сначала контракты/модели/тесты, потом поверхности, потом моушен; «визуал прикрутим в
  конце» запрещено.
- **Коммиты:** локальный коммит на этап (можно несколько внутри этапа, но каждый — зелёный:
  `npm run test:server`, `npm run test:client`, `npm run build:test`, `npm run lint:client`, eslint по
  изменённым файлам). Сообщение: `Parliament sitting · Э<n>: <суть>`. **Пушить нельзя** (`npm run push` —
  только по просьбе пользователя).
- **Существующие e2e не гонять.** Их подгонят в самом конце отдельно, чтобы не распыляться. Ты **можешь и
  должен** писать НОВЫЕ e2e (и гонять только их, `--workers=1`) и снимать собственные скриншоты/видео
  пробниками. В итоговом отчёте перечисли, какие существующие e2e и почему ожидаемо сломаются (по
  селекторам/сценариям), чтобы их подгонка была быстрой.
- **Журнал прогресса** — `docs/claude/parliament-sitting-progress.md`: после каждого этапа (и при каждом
  крупном решении) дописывай раздел: что сделано, замеры, отклонения от плана и почему, что взято сверх
  плана, открытые вопросы с принятым допущением. Пользователь читает его, пока ты работаешь.
- **Если застрял** (три подхода к одной проблеме без прогресса): опиши в журнале прогресса гипотезы и
  замеры, выбери самое честное из работающих решений, помечай допущение — и иди дальше. Никаких
  «пока оставим как есть» без строки в «честных ограничениях».
- **Никакой параллельной работы** субагентами над продуктовым кодом. Субагенты — только для чтения/разведки.

## 1. Прочитай ДО первой правки (обязательно, целиком)

- `CLAUDE.md`; `.claude/rules/console-ui.md` (весь — он большой, но это законы, по которым принимается
  работа); `.claude/rules/animations.md`; `.claude/rules/client-ui.md`; `.claude/rules/game-logic.md`;
  `.claude/rules/server.md`; `.claude/rules/tests.md`; `.claude/rules/localization.md`.
- **`docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` — целиком**: §1 (аудит с `файл:строка`), §2 (концепция),
  §3 (архитектура момента: ворота, что видят игроки, reload), §4 (таксономия адресов), §5 (контракт автора
  и гард), §6 (раскадровка с бюджетом времени), §7 (семейство), §9.2 (серверная почва журнала),
  §10 (декомпозиция — твоя карта файлов), §12 (совместимость сохранений), §13 (проверка), §14 (Э0–Э4:
  приёмка и «НЕЛЬЗЯ»), §15, §16 (решения: «ЗАСЕДАНИЕ», двое ворот, `kind:'reaction'`, протокол вне скоупа).
- `docs/TURMOIL_REDUX_PARLIAMENT_VOTE_ONE_NUMBER.md` (что изменил Э6: `voteInfoModel.ts`, свидетели
  `data-parl-vote-*`, новые фикстуры `parliament-climate-vote-raise` / `parliament-powergrid-vote-cap`).
- `docs/TURMOIL_REDUX_PARLIAMENT_V6.md`, `docs/TURMOIL_REDUX_AQUIFER_CONTEST.md` (стадия принятия,
  общий пикер), `docs/TURMOIL_REDUX_CLIMATE_RESEARCH.md` (встроенный добор), `docs/TURMOIL_REDUX_BIODOME_CONTEST.md`
  (тайл победителю, `appliedBySeat`), `docs/TURMOIL_REDUX_DUMMY_REMOVAL.md` (ретирированные id, `parliamentArrange`).
- `docs/CONSOLE_MODE_CONCEPT.md`, `docs/claude/console/workspace-band.md` (§ EMBEDDED OUTCOMES /
  WORKSPACE DESCEND), `docs/claude/console/workspace-embed.md`, `docs/claude/console/prompt-admission.md`,
  `docs/claude/console/surface-motion.md`, `docs/claude/presentation-flow.md`, `docs/CONSOLE_WORKSPACE_STACK.md`,
  `docs/claude/console/start-flow-motion.md` (директор стадий как образец), `docs/claude/journal.md`,
  `docs/claude/notifications.md`, `docs/claude/marsbot-corporation-checklist.md` (образец чек-листа для Э2).
- Заметки памяти (`C:\Users\zelin\.claude\projects\C--Projects-Mods-terraforming-mars\memory\`):
  `turmoil-redux-parliament-assembly`, `turmoil-redux-climate-research`, `turmoil-redux-biodome-contest`,
  `workspace-flow-conclusion`, `console-followup-door-sequencing`, `workspace-embed-contract`,
  `console-workspace-stack`, `teleport-target-resolves-only-on-to-change`, `board-beat-park`,
  `animation-hold-registry`, `flip-anchor-is-the-object`, `transitiongroup-flip-measures-mid-flush`,
  `flight-aims-at-resting-rect`, `handoff-witness-overlay-window`, `e2e-visual-verify-make-css`,
  `e2e-stale-server-serves-old-chunks`, `e2e-default-viewport-is-720p`, `e2e-raf-probe-dies-headless`,
  `review-own-artifacts-dont-dismiss-anomalies`, `client-suite-false-green-chunking`,
  `mochapack-lazy-import-zeroes-spec`, `e2e-fixture-generator-gotchas`, `bash-heredoc-collapses-backslashes`,
  `console-perf-mode-contract`, `lint-baseline-is-red`.

## 2. Законы, по которым принимается работа (нарушение = дефект, не стиль)

1. Промпт и стадия определяются **серверным маркером**, никогда — заголовком; идентичность —
   `promptIdentityKey(wf)`.
2. Доступность — серверно-авторитетная; заблокированное показывается disabled с причиной.
3. Ни авто-выбора, ни скрытой цели; `current → resulting` до подтверждения.
4. **Никакой тихой потери**: пропущенный эффект называет себя и причину на экране, не только в логе.
5. `title`-атрибут запрещён; подсказки — `.premium-tooltip()` + `data-hint` на не-disabled обёртке.
6. **Одна система моушена**: `motionMs()` / `MOTION_EASE` / `calc(<base>ms * var(--motion-scale,1))`;
   критическая анимация держит **animation hold**, снимаемый её собственным `onComplete`/`onInterrupt`;
   **`setTimeout`/`setInterval` в хореографии запрещены** (статический гард — часть Э3).
7. Read-only остаётся read-only; клиент не пересчитывает выплаты.
8. Хуки резолюции — в файле резолюции; никаких центральных таблиц по id карт.
9. Английский текст = i18n-ключ; `grep` по всем `src/locales/ru/*.json` до добавления; чужие переводы не
   трогать; канон РТ / ПО / метка. Локаль парламента — `ru/parliament.json`; после правки текстов
   эффектов — `npm run make:cards` (перегенерирует `src/genfiles/parliament.json`).
10. Транспорт — модуль, рендерит ничего; сабмит — только `gameTransport.submitInput`.
11. Workspace — ОДИН ПОТОК: встраивание, непрерывная крошка (`ПАРЛАМЕНТ › ЗАСЕДАНИЕ › <СТАДИЯ>`, только
    хвост движется и только вперёд), фазы и B-глаголы из `consoleWorkspaceFlow.ts`, одна guarded-конклюзия
    `concludeWorkspaceFlow`, шесть правил embed-контракта, семейство `followUp` для дверей внутри flow.
12. Кнопка контроллера имеет имя только в `glyphSets.ts`.
13. Слой полётов монтируется **шеллом**, никогда — секцией (`Teleport to="body"` из секции — дефект).
14. Клиентская память «уже видел» (localStorage, модульный флаг как источник истины) запрещена: истина —
    состояние игры.
15. Сериализация: новые поля аддитивны, старые сохранения деградируют честно; фаза в процессе переживает
    reload (`ParliamentPhase.resume`).
16. Три профиля (1080 / TV 4K / Deck 1280×800), `prefers-reduced-motion`, perf-lite (`con-perf-lite`:
    `filter`/`text-shadow` вырезаются; функциональные состояния — `box-shadow`/`outline`) — учитываются в
    каждой поверхности, а не «потом».
17. Свои скриншоты после каждой правки вёрстки; аномалия на них = баг до замера; видео — только на тихой
    машине (`--workers=1`, ничего параллельно).

## 3. Текущее состояние (после Э6, коммит `b58448fdc5`)

- `src/client/components/console/ConsoleParliamentSection.vue` — **3520 строк** (монолит: зона мест,
  правительство, область голосования, партии, Повестка, режим голосования, кресло, сцена итогов `recap`,
  стадия принятия `enact`, полёты в `Teleport to="body"`); `src/styles/console_parliament.less` — **3392**.
- Сцена итогов: `mounted()` → `maybeOpenRecap()` (grep `recap` в SFC — ~90 упоминаний), гейт
  `parliamentRecapSeen`/`localStorage` в `src/client/console/consoleParliamentState.ts:37–63`,
  такты `window.setTimeout` (`RECAP_BEAT_MS = 1000`), раздача плоским прокси
  (`consoleParliamentVoteMotion.ts` `runCardDealFlight` → `runProxyFlight`), лицо по `visibility` на
  посадке. Замер: 10 строк ≈ 9.4 с, переворота нет, лицо `hidden → visible` за один кадр.
- Стадия принятия: `enactStanding` / `openEnact` / `concludeEnact` в SFC; карта-носитель
  `[data-parl-gov-carry]` телепортируется в `[data-parl-enact-hero]`; зона `[data-embed-slot="parliament-enact"]`;
  шелл: `ConsoleShell.vue` ≈`:4409–4431` (`parliamentBillStanding`, `parliamentEnactStanding`,
  `parliamentEnactPrompt`), селекторы зон ≈`:4471–4479`, `openShellTaskSurface` (`party` / `externalDraw`
  ветки ≈`:16281–16306`), `admits()` ≈`:10983`, `rawAdmissionSignals` ≈`:3382–3402`. (После Э6 номера
  строк в шелле сдвинуты на ~40 — ищи по именам.)
- Сервер: `src/server/parliament/ParliamentPhase.ts` (`continue()` `:105–157`, `stepEffects` `:321–392`,
  `finish` `:485–492`, scope только у Повестки `:213` и у каждого (место × шаг) `:367`);
  `SerializedParliament.ts` (`SerializedPhaseProgress` `:146–167`, `SerializedPhaseSummary` `:118–133`,
  `SerializedEnactOutcome.kind` `:61`); `common/models/ParliamentModel.ts` (`ParliamentPhaseModel`
  `:194–202` — без сводки в процессе; `ParliamentPhaseSummaryModel` `:208–223`; `kind` `:159`);
  `server/parliament/ParliamentModel.ts` (`summaryModel` `:291`, `pending.input` `:113`);
  `common/parliament/ParliamentTypes.ts` (`ParliamentPhaseStep` `:157–165`).
- Прецеденты: барьер фазы исследования `Game.ts:1036–1061` + `:1471–1489` (`researchedPlayers`), reload
  `Game.ts:2595–2602`; драфт `Draft.ts:216–248`; маршрут ввода без проверки `activePlayer`
  `routes/PlayerInput.ts:24–55`; опрос отдаёт цвета всех с обязательным вводом `ApiWaitingFor.ts:26–33`;
  планировщик бота стоит при любом `waitingFor` `BotTurnScheduler.ts:298–313`; интейк как проекция
  `deferredActions/ExternalDrawIntake.ts:82–113, :151–182`; маркеры `PlayerInputModel.ts:498–558` +
  `ServerModel.ts:480–553`, `PlayerInput.ts:215 markChoiceContext` / `:314 markExternalDrawPrompt`,
  `inputs/SelectOption.ts:9`.
- Журнал: `EventRecorder.ts` (`beginAction` `:209–235` с коалесценцией `automa-turn` `:211–230`,
  `stampJournal` `:178–199`, `captureContext` `:378–380`, `runWithContext` `:383–393`), корень хода бота
  `AutomaController.ts:45`, `correlationId` на снимке `AutomaTurnLog.ts:330`, карве-аут одиночной группы
  `journalView.ts:76`, исключение из уведомлений `notificationIngest.ts:323–324`.
- Моушен-инструменты: `cardFlight/card3dInner.ts` (`buildCard3DInner` `:92`, `addCard3DTurn` `:209`,
  `setCard3DFace` `:139`; единственный вызывающий — `startDockMotion.ts`), `cardFlight/landingRect.ts`
  (`restingRectOf`), `cardDeal/premiumTurn.ts` + `runBatchArrival` (общий директор раздачи),
  `presentation/animationHold.ts` (`holdForGsapAnimation` `:341`, `registerAnimationHoldSupplier` `:223`,
  опция `expire`), `surfaceMotion/workspaceDescend.ts` (`descendFlipFrom`, `descendRecede`, `descendCascade`,
  `guardedDescend`, `descendPx` `:433`), `resourceTransfer/consoleResourceTransfer.ts`
  (`runResourceTransfers` `:348`, `beginPanelRewardHold` `:146` — понадобится в Э5, сейчас не трогать),
  шелл-уровневые слои полётов (изучи `handDelivery`, `.con-handdelivery-layer`, `cardDeal`) — переиспользуй,
  не изобретай.
- Тесты: `tests/parliament/ParliamentPhase.spec.ts` (6 `it`; reload внутри вопроса `:168`),
  `tests/parliament/parliamentArrange.ts` (стол в спеках — только через него), `tests/e2e/fixtures/generate.ts`
  (recap-фикстуры inline `:646–697`; фильтр `FIXTURES=` `:152`), `tests/console/e2eFixturesLoad.spec.ts`,
  `tests/client/components/console/consoleTaskRouter.spec.ts` (EXHAUSTIVE по `TaskKind`), гард
  `tests/console/embeddedSurfaceShadeGuard.spec.ts`, `tests/gamepad/glyphLiteralGuard.spec.ts`.
- «Полигон»: `ConsoleResolutionsPlayground.vue`, ручная таблица семейств `FAMILY_OF` (≈`:630`), живые
  сценарии через `POST /api/dev/playground-scenario`.

## 4. Э0 — механический разрез монолитов (без изменения поведения)

**Цель.** Разложить `ConsoleParliamentSection.vue` и `console_parliament.less` по §10 плана так, чтобы
следующие этапы шли в своих файлах, а поведение и пиксели остались прежними.

**Что сделать.**
- SFC → девять файлов §10.1 (`ConsoleParliamentSection.vue` ≤ 700 строк — корень: шапка, ярусы как
  дочерние компоненты, ввод по стадии, команды/крошка, fit; `parliament/ConsoleParliamentSeats.vue`,
  `…Government.vue`, `…VotingArea.vue`, `…Parties.vue`, `…Agenda.vue`, `…VoteMode.vue`, `…SeatPick.vue`;
  временно `…Recap.vue` для сцены итогов — она умрёт в Э3, но резать её надо сейчас, чтобы Э3 удалял
  файл, а не вырезал строки из монолита). Состояние — модульное и именованное:
  `consoleParliamentState.ts` → `consoleParliamentFlow.ts` (пока с тем же содержимым).
- LESS → восемь файлов §10.2 (+ `.con-rxpg` в `console_resolutions_playground.less`); `common.less`
  импортирует; профильные ладдеры (`console_tv.less`) переопределяют только токены.
- Полёты кубов/карт: пока оставить как есть (переезд в шелл-слой — Э4), но вынести спецификации в
  `parliament/parliamentFlights.ts`, чтобы в Э4 менять один модуль.

**Приёмка.**
- Пиксельный паритет до/после на трёх профилях для: обзор, фокус партии, режим голосования (2 карты),
  кресло, стадия принятия с добором (`parliament-climate-enact`), сцена итогов после всех тактов
  (`parliament-climate-recap`). Снимай СВОИМ временным пробником (`tests/e2e/tmp-*.spec.ts`, удалить
  после) до разреза и после, сравнивай попиксельно (`pixelmatch`/`sharp` или Playwright `toHaveScreenshot`
  с нулевым порогом); диффы приложить в журнал прогресса.
- `git diff --color-moved=dimmed-zebra` по LESS показывает только перемещения; ни один селектор/значение не
  изменён.
- `vue-tsc` зелёный; размер `build/chunks/console-shell.js` ±1 %; все юнит-спеки зелёные без правок
  ассертов (кроме путей импорта).
- Публичные `data-*`-свидетели существующих e2e не переименованы (перечень — `grep data-parl-` по
  `tests/e2e/`).

**НЕЛЬЗЯ.** «Заодно» чинить; заводить `utils.ts` со всем подряд; менять порядок каскада LESS так, что
меняется специфичность; оставлять SFC > 700 строк.

## 5. Э1 — серверный момент: ворота фазы, сводка в живой модели, протокол в журнале

**Цель.** Конец поколения — один серверный поток с воротами `assembly` и `adjourn`, живой сводкой и одной
группой журнала; всё переживает reload, клон и старые сохранения.

**Что сделать (по §3.1–3.4, §9.2 плана).**
- `ParliamentPhaseStep` += `'assembly'` (после `enact`, до `effects`) и `'adjourn'` (после `lobby`; в
  `final` — после `effects`). `continue()` — новые ветки; `stepGate(stage)` по образцу §3.2: промпт каждому
  участнику без стоящего `waitingFor`, отметка `appliedBySeat[seat] ∋ '<stage>:<gen>'` в колбэке,
  `game.save()` при выдаче и при каждом ответе, барьер — «ни одного неотмеченного участника», никакого
  счётчика в памяти. `activePlayer` не трогается.
- Промпт ворот — `SelectOption` со структурным маркером `parliamentPhasePrompt {stage, generation, final,
  seq, awaiting: Color[]}` (`markParliamentPhase` на `PlayerInput`, сериализация в `ServerModel`
  централизованно). Заголовок — только для журнала.
- `SerializedPhaseSummary` += `correlationId?`, `seq?` (монотонный, `Parliament.phaseSeq`);
  `SerializedParliament` += `phaseHistory?: SerializedPhaseSummary[]` (cap 24, старейшие вытесняются;
  фильтр ретирированных при загрузке — как у `lastPhase`). `PARLIAMENT_SAVE_VERSION` остаётся 1.
- Модель: `ParliamentPhaseModel.summary?: ParliamentPhaseSummaryModel` (сводка В ПРОЦЕССЕ — тот же
  `summaryModel`), `ParliamentModel.phaseHistory`, `parliamentPhasePrompt.awaiting` из
  `playersWithRequiredInputs`-логики (цвета неответивших участников).
- **`kind: 'reaction'`** (решение Q6): ответ правящей партии (Зелёные +M€ производство на Climate Research
  и любая будущая реакция из `PartyEffectDefinition.reactions`) записывается в `summary.outcomes` как
  отдельный исход `{kind:'reaction', party, production|stock, amount, before, after, trigger}`.
  Предпочтительный механизм — драйвер выводит реакции из событий рекордера внутри scope шага (события
  с источником `{kind:'party'}` в корреляции шага), а не правкой каждой резолюции; если найдёшь способ
  чище — обоснуй в документе. Расширь union `kind` и **все** его потребители (компилятор должен
  заставить: `outcomeText`, подачи — исчерпывающие `switch` без `default`).
- Журнал (§9.2): один scope `political-phase` на всю фазу (`beginAction(undefined, {kind:'parliament'},
  {category:'political-phase'})` в `start`, закрытие в `finish`); per-step `beginAction` `:213`/`:367`
  присоединяются к корню коалесценцией (расширить условие `EventRecorder.ts:211–230`); ворота и ответы
  внутри scope; `summary.correlationId = captureContext()?.rootId`; при resume — `runWithContext`, чтобы
  ответ после reload остался в цепочке. Корневая строка — `'The Mars Parliament of generation ${0}
  convenes'` (announcement). Клиентские части журнала (карве-аут `journalView.ts:76`, исключение
  `notificationIngest.ts:323–324`) — сделать здесь же, они на две строки; кнопку обзора НЕ делать (Q8).
- Совместимость (§12): старая фаза в процессе на старых шагах доигрывается; `lastPhase` без `seq` —
  честная деградация; `Cloner.replacePlayerIds` — ворота по `appliedBySeat`; `tests/console/e2eFixturesLoad.spec`
  зелёный на всех существующих фикстурах.
- Фикстуры: общий строитель в `generate.ts` — `parliamentFixture({resolution, seats, influence, tableau,
  stopAt: 'assembly' | 'effects' | 'adjourn' | 'done'})`, замена inline-блоков; регенерация ТОЛЬКО
  парламентских (`FIXTURES=parliament-* npm run e2e:fixtures`); новые `parliament-<rx>-assembly` /
  `-adjourn` для RX01–RX05 (виды: зритель ещё не ответил; зритель ответил, другой — нет).

**Приёмка.** Спеки §13.1 плана зелёные, в том числе: барьеры с 2 и 3 местами; ответ одного не двигает
фазу; двойной ответ идемпотентен; `Game.deserialize` внутри каждых ворот переиздаёт промпт ТОЛЬКО
неответившим и не перезаписывает стоящий `waitingFor`; **`activePlayer` неизменен на всех шагах** (новый
тест — закрывает S6 аудита); `final`: `effects → adjourn → done`; соло с MarsBot — барьер из одного; клон с
ремапом id внутри ворот не переспрашивает ответившего; `phaseHistory` cap 24; `seq` монотонен; реакция
партии записана как `reaction` и только внутри фазы; журнал — одна группа на поколение, `correlationId`
совпадает у всех строк фазы, включая ответ после reload; `npm run test:server` ≥ floor; dev-door живая
партия 2 человека: у обоих стоит `parliamentPhasePrompt{assembly}`, ответ первого не двигает, второго —
двигает (проверь через API, `bootFixtureSeats` даёт id обоих мест).

**НЕЛЬЗЯ.** Счётчик барьера в памяти; `setWaitingFor` поверх стоящего промпта; детект по заголовку;
per-viewer задержка строк журнала; `game.save()` реже, чем при каждом ответе на ворота; правка правил игры.

## 6. Э2 — контракт автора резолюции, таблица адресов, гард по каталогу

**Цель.** Новая резолюция не может пройти без адреса награды и полной отчётности; следующие 43 карты
ложатся без UI-работы.

**Что сделать (по §4–§5 плана).**
- `src/common/parliament/rewardAddress.ts`: `Record<ParliamentEnactOutcomeModel['kind'], RewardAddress>`
  (компилятор требует все ключи, включая `reaction`), `rewardAddressOf(outcome, viewer)`; адрес = {где
  игрок увидит (рельса/карта таблицы/док руки/поле/трек Повестки/плитка партии), источник полёта (иконка
  карты / плитка партии / колода), чип/единица, текст пропуска}. Ожидаемые будущие виды (`stockLoss`,
  `agenda`, `colonyTrack`, `tr`, `partyAccessGrant`) — НЕ добавлять в union сейчас, но задокументировать
  правило добавления (строка в таблице ДО первой такой карты).
- `tests/parliament/ResolutionContract.spec.ts` — §5.4 целиком (8 пунктов), перечисляет
  `REDUX_RESOLUTION_CATALOG`; dev-примеры отдельным `describe`; сообщение провала называет резолюцию, шаг
  и условие («RX05: шаг 'draw' не отчитался при влиянии 0 / пустой таблице»). Тест теста: подсаженный
  сломанный dev-шаг в `describe.skip`-образце показывает сообщение.
- «Полигон»: `FAMILY_OF` → `familyOf(definition)` из декларации (`scaled`/`winnerReward`/`count`/`sequel`);
  ручные сценарии остаются дополнением.
- Документы: `docs/claude/parliament-resolution-checklist.md` (полная форма §5 по образцу
  `marsbot-corporation-checklist.md`) и короткая форма в `.claude/rules/game-logic.md` (пути
  `src/server/parliament/resolutions/**`).

**Приёмка.** Гард проходит на пяти резолюциях и падает на образце; `rewardAddress.spec` исчерпывающ по
`kind`; стенд открывает семейство каждой резолюции без ручной таблицы; `grep` id резолюций по
`src/client/**` (кроме манифеста и стенда) пуст.

**НЕЛЬЗЯ.** Таблица адресов в клиентском файле; «TODO: добавить kind позже»; гард, перечисляющий
резолюции руками.

## 7. Э3 — маршрутизация и каркас flow «ЗАСЕДАНИЕ»

**Цель.** Промпт ворот открывает Парламент в ОДНОМ flow с непрерывной крошкой, стадиями, B-глаголами и
одной заключительной политикой; recap-on-open и `localStorage` удалены; существующие вопросы резолюции
(пик карты, добор, тайл) живут стадиями этого же flow.

**Что сделать (по §3.4, §7.1 плана).**
- `consoleTaskRouter.ts`: `TaskKind 'parliamentPhase'` по маркеру `parliamentPhasePrompt` (выше сырых
  типов); членство (`SHELL_SECTION_KINDS`/`SECTION_SERVED_KINDS`), `taskMinimizable` (свёртывание — через
  collapse workspace), `FOLLOW_UP_STEP_STAGES` для промптов с источником-резолюцией (`choice:contextual`
  → «Выбор», `externalDraw` → «Получение», `space` с `placementContext.source.kind==='resolution'` →
  «Размещение»); `consoleTaskRouter.spec` (EXHAUSTIVE) обновлён.
- `consoleMandatoryGate.ts`: `MandatoryFlowKind 'parliament-phase'`, ключ `parliament:gen<N>` стабилен на
  ВСЕ промпты фазы (ворота 1, вопросы резолюции, ворота 2) — один анонс «Парламент собрался · поколение N»
  на поколение, A открывает Парламент в flow; falling edge закрывает; вопросы резолюции больше не
  анонсируются отдельно (двери внутри открытого flow — `followUp`, `owed-step`).
- `consoleWorkspaceStack.ts`: строка `parliament` — `serves: ['party', 'parliamentPhase']`, `hosts:
  'always'` в фазе, anchor flow — серверный шаг (`game.parliament.phase.step ∈ {assembly, effects, refresh,
  lobby, adjourn}`) — правило 6 embed-контракта (claim с серверным фолбэком, переживает reload).
- Зона стадии — одна: `[data-embed-slot="parliament-stage"]` (заменяет `parliament-enact`; `parliament-vote`
  остаётся у режима голосования); шелл телепортирует туда общий пикер (`ConsoleTaskHost`), встроенный
  добор (`ConsoleExternalDrawWorkspace embedded`) и — по `owed-step` — держит workspace, пока дверь ждёт.
  Тайл победителя: как сегодня — поле (закон board-beat-park; парковка/возврат сцены — Э5, но flow не
  должен разваливаться: после посадки тайла стадия НАГРАДА стоит в позе «получено»).
- `ConsoleParliamentSitting.vue` (host-agnostic: `embedded`, `mode: 'live' | 'review'`; в этом прогоне
  используется только `live`, но API — под оба) со стадиями `verdict → enact → reward (→ choice / intake /
  placement) → refresh → closing` в статичных ПОЗАХ (хореография — Э4): каждая стадия показывает свои
  объекты из `phase.summary` / `lastPhase`, стадия НАГРАДА — чтение исхода зрителя (`ConsoleInfluenceYield`
  контекст `resolving`/`applied`, `ConsoleWinnerReward`) и **плиту пропуска с причиной** (закон 4),
  для чужого места — строку ожидания (`phaseWaitText`), после ответа на ворота — позу «Ждём: [чипы]» по
  `awaiting`.
- Крошка: `⚖ ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ|ПРИНЯТИЕ|НАГРАДА|ВЫБОР|ПОЛУЧЕНИЕ|РАЗМЕЩЕНИЕ|ОБНОВЛЕНИЕ|ЗАКРЫТИЕ`
  через `setWorkspaceFrameSubject/Stage/Phase`; стадии не титулуют себя; фазы: все стадии до ЗАКРЫТИЯ —
  `committed` (B = свернуть → карточка возврата на board home восстанавливает ту же стадию), ЗАКРЫТИЕ —
  `verdict` (B = none, A «Закрыть заседание» = ответ на ворота 2), бет в полёте — none; конец —
  `concludeWorkspaceFlow('parliament')` с именованными hold'ами.
- Ответ на ворота 1 — A на стадии НАГРАДА («К награде»/«Продолжить» — глагол по наличию личной награды);
  ответ на ворота 2 — A на ЗАКРЫТИИ; оба — `gameTransport.submitInput({type:'option'})`; никакого
  авто-ответа.
- Удалить: `Recap.vue` (из Э0), `recap*`, `RECAP_*`, `recapSeen`, `localStorage` в парламенте,
  `.con-parl__recap-*`; статические гарды `tests/console/parliamentNoTimers.spec.ts` и
  `parliamentNoLocalStorage.spec.ts` (§13.3).
- Reload на любой стадии: workspace монтируется в flow по серверному шагу; уже прошедшие стадии — в
  конечных позах (компактный реплей — Э4), текущая — актуальна; `consolePromptAdmission.spec.ts` (новый —
  сегодня спека нет) для семейств `host/section/followUp` с промптами заседания.

**Приёмка.** На фикстуре `-assembly`: анонс → A → крошка `⚖ ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ`; стадии
листаются A до НАГРАДА; A на НАГРАДА = ответ на ворота (сервер получил `option`); поза ожидания при
неответившем втором месте (второе место отвечает по API — `bootFixtureSeats`); вопрос резолюции (пик /
добор / тайл — фикстуры `-enact` всех пяти) приходит стадией внутри без второго анонса и без
standalone-band, добор — в `parliament-stage`; B = свернуть, восстановление на ту же стадию; ЗАКРЫТИЕ → A
→ board home; **reload на любой стадии возвращает в ту же стадию**; `grep localStorage` по парламенту
пуст; `grep setTimeout` — только `SUBMIT_SAFETY`; leak detector не сообщает о STRANDED PROMPT ни на одной
стадии (проверь `[console-leak-detector]` в консоли браузера пробником); новый e2e
`console-parliament-sitting.spec.ts` (структурная половина, три профиля).

**НЕЛЬЗЯ.** Детект стадии по тексту; `v-if`-свап стадий (blink); крошка, теряющая `ЗАСЕДАНИЕ`; клиентская
память «уже видел»; ответ на ворота без нажатия; второй компонент сцены «для reload»; standalone-band для
вопроса резолюции; оставить `parliament-enact` селектор живым в шелле.

## 8. Э4 — директор заседания: физические беты под hold, 3D-переворот раздачи

**Цель.** ВЕРДИКТ / ПОВЕСТКА / ПОДДЕРЖКА / ПРИНЯТИЕ / ОБНОВЛЕНИЕ / ЗАКРЫТИЕ — GSAP-беты под animation-hold
с честной физикой стола: подсветка и счёт вердикта; глайд маркера Повестки; кубы поддержки со склада в
гнёзда партий; карта FLIP-ом из слота в правительство, старая — в сброс, кубы домой по владельцу с
подписью; раздача трёх резолюций с колоды **с настоящим 3D-переворотом**, поддержка садится на новые
карты, лобби заполняется; компактная карточка ЗАКРЫТИЯ. Раскадровка и бюджет — §6 плана
(≈ 9–11 с авто-моушена + два A на поколение).

**Что сделать.**
- `parliament/sittingBeats.ts` — ЧИСТАЯ `sittingBeats(summary, viewer, mode: 'live' | 'resume' | 'review')
  → Beat[]` (порядок = порядок сервера; один `reward-*` на исход зрителя; `reward-skipped` с причиной;
  `final` без ОБНОВЛЕНИЯ; `resume` — компактно ×0.5 без пауз до текущего шага). Юнит-спек.
- `parliament/sittingDirector.ts` — единственный владелец таймлайнов заседания: `beatOf(kind)(ctx) →
  gsap.core.Timeline`, каждый бет под `holdForGsapAnimation('parliament-sitting:<beat>', tl)`, `expire` с
  `diagnose` зарегистрирован (ceiling должен снимать WEDGE, не только счётчик); A во время бета = дожать
  до позы покоя (`tl.progress(1)` с корректным handoff), A в позе покоя = следующая стадия; reduced-motion —
  мгновенные позы с теми же стадиями и теми же A (≤ 2 с на всё); perf-lite — те же кадры без `filter`.
  `consoleParliamentEnactMotion.ts` сливается сюда как бет ПРИНЯТИЕ/стадия.
- Полёты — через **шелл-уровневый слой** (изучи существующие `handDelivery`/`cardDeal` слои и `ProxyBatch`
  — «a flight owns ITS OWN proxies»; расширь общий слой парламентскими прокси, секционный `Teleport`
  удали); источники и цели — измеренные ректы (`restingRectOf` для посадки, RAW для источника); кубы —
  `PlayerCube` того же размера, что место; карта — `Card3DInner` с `perspective` на outer.
- **Раздача с переворотом:** прокси рождается на `[data-parl-deck-top]` рубашкой резолюции, летит в слот
  по дуге, `addCard3DTurn` на подлёте — лицо (премиальная грань резолюции, `lightweight`, та же vm, что в
  слоте — паритет классов `.pcard`) видно только после 90°, посадка-каданс ≥ 6 кадров между картами,
  handoff = показать слот → убрать прокси на СЛЕДУЮЩЕМ кадре (ни blank-кадра, ни двойника); тик счётчика
  колоды на отделении карты. Лицо слота под прокси — `visibility: hidden` до handoff, а не `opacity` (закон
  preserve-3d).
- **Принятие:** одна DOM-инстанция карты (`[data-parl-gov-carry]`) FLIP-ом из слота в правительство
  (`descendFlipFrom`, zoom-компенсация), старая резолюция → сброс прокси, кубы возврата **по владельцу**:
  стаггер 70 мс, у резерва владельца — короткая подпись «→ резерв player1» (`data-hint`-стиль, тихая),
  нейтральные — на склад; плита правящей партии и задание — REVEAL той же фразой RELEASE→UNFOLD→REVEAL.
- **Вердикт:** свет + числа, ничего не летит; при ничьей — одна фраза правила (`tieBreak`).
- **Повестка:** существующий глайд (`agendaGlide`) + бонус (чип РТ → HUD, карта → док) — переиспользовать,
  не переписывать; проверить, что hold глайда снимается на `onInterrupt`.
- **Поддержка / обновление / лобби** — как в §6; «поддержка полна — куб сброшен» — гнездо `3/3` мигает,
  строка названа.
- **Закрытие:** компактная карточка «Итоги поколения N» — только объекты (иконки + числа: победитель,
  закон, моя награда, новые карты), одна строка с именем закона (решение Q5 по умолчанию); A «Закрыть
  заседание».
- Стадия НАГРАДА в этом прогоне: чтение + плита пропуска + существующие пикер/добор/тайл (Э3); её физика
  (волна с иконки карты в рельсу с тиком, добор без дубля и призрака с переворотом, парковка под тайл и
  возврат) — **Э5, следующий прогон**. Но стадия должна быть построена на общем chassis
  (`.con-ws-stage-frame/-head/-row/-status`, `wsStageLayout`) уже сейчас, чтобы Э5 менял только
  содержимое зоны.
- Пробники и e2e: `console-parliament-sitting.spec.ts` (моушен-половина): сэмплер `setInterval` (никогда
  rAF) — переворот (в сэмплах прокси есть `rotateY`, лицо `visible` только после половины поворота, ноль
  двойников после посадки), кубы возврата летят к реальным резервам (траектория, не «появление»),
  hold'ы сняты после ЗАКРЫТИЯ (`activeAnimationHoldLabels()` пуст), длительности стадий в бюджете §6
  ±15 %, A во время бета не пропускает стадию, reduced-motion ≤ 2 с, perf-lite без `filter`; `expectFits`
  и «нет скролл-контейнеров» на каждой стадии; `.con-shade--on` = false внутри. Видео двух полных
  заседаний (`--workers=1`, тихая машина) — просмотреть покадрово самому, кадры с аномалиями приложить в
  журнал прогресса как баги и починить.
- Профили: токены в `console_parliament_sitting.less` / `console_tv.less`; Deck — `descendPx`-множители;
  ничего не масштабируется в тексте (Ark Nova).

**Приёмка.** Видео и пробники по списку выше; `sittingBeats.spec` описывает порядок бетов чисто;
`holdForGsapAnimation` на каждом бете; ни одного объекта, появившегося без движения из реального места;
крошка движется только вперёд; галерея `screenshots/parliament-sitting/<preset>/NN-<stage>.png` × три
профиля × {стандарт, reduced, perf-lite} без замечаний `expectFits`.

**НЕЛЬЗЯ.** `setTimeout`-такты; `visibility`-свап лица вместо переворота; полёт из синтетического дилера
(только `[data-parl-deck-top]` / `.con-deckstack__pile`); прокси в `Teleport` секции; `opacity` на
`preserve-3d`; хардкод координат; отдельный бет для суффиксов/подписей; масштабирование текста.

## 9. Сверх плана — приветствуется (с записью в документ)

Примеры того, что стоит брать, если видишь: строка ожидания с чипами игроков из `awaiting` (вместо
текста); подпись владельца у летящего куба; анонс-плита «Парламент собрался» с эмблемой ⚖ и номером
поколения в семейном стиле мандаторных плит; уведомление ушедшему с экрана «Парламент ждёт вас»;
компактный реплей после reload как отдельный «режим» директора; паритет лиц прокси/слота через общий
пробник; общие helper'ы e2e для Парламента (`tests/e2e/parliamentDrive.ts`: `openParliament`, `expectFits`,
`noScrollContainers`, `answerGateAs(seat)`); чистка мёртвых ключей локали после удаления recap;
`docs/claude/console/parliament-sitting.md` как контракт для будущих агентов. Что НЕ брать: Э5-физику
(кроме chassis), протокол/обзор журнала (Q8), десктоп, классический Turmoil, правила игры.

## 10. Проверка и артефакты

- Порядок сборки перед визуальной проверкой: `npm run make:json` → `npm run make:cards` (если трогал
  каталог/тексты) → `npm run make:css` → `npm run build` (сервер + клиент; серверные правки в Э1 требуют
  `build:server`). Свежесть чанка проверяй по своему свидетелю
  (`node -e "…includes('data-parl-sitting')"`), а не по дате.
- e2e поднимает свой сервер на каждый воркер (`tests/e2e/consoleTest.ts`); процессы на 8080/8092/8896 —
  чужие клоны, не полагайся и не убивай. Только НОВЫЕ спеки: `npx playwright test tests/e2e/console-parliament-sitting.spec.ts
  --workers=1 --reporter=list`. Старые e2e — не гонять (подгонка в конце).
- Юнит: `npm run test:server` / `npm run test:client` (floor’ы; ловушка ленивого импорта `Card.vue`),
  `npm run build:test` после каждой правки спеков, `npm run lint:client` (vue-tsc) зелёный, eslint по
  изменённым файлам чистый (общий `npm run lint` красный по baseline — не твоя проблема, но НОВЫХ ошибок
  быть не должно).
- Фикстуры: `FIXTURES=parliament-* npm run e2e:fixtures`; `tests/console/e2eFixturesLoad.spec.ts` зелёный.
- Скриншоты и видео — смотреть самому как ревьюер (аномалия = баг до замера).
- Документы к сдаче: `docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` (по разделу на этап: оценка → концепция →
  что изменилось → контракты → бюджеты профилей → проверка → честные ограничения; плюс раздел
  «Передача в Э5»: точные швы — зона стадии, chassis, где рождается волна, какие данные уже в модели),
  `docs/claude/parliament-resolution-checklist.md` (Э2), правки `.claude/rules/game-logic.md` (короткая
  форма контракта) и `.claude/rules/console-ui.md` (компактный раздел «ЗАСЕДАНИЕ»: одна фаза — один flow,
  ворота, стадии, B-глаголы, зона `parliament-stage`, запреты), строка в `docs/README.md`, заметки памяти
  (`turmoil-redux-parliament-sitting-foundation` + при необходимости отдельные гочи), журнал прогресса.
- Итоговый отчёт в чат (по-русски, коротко): что построено по этапам; замеры до/после (длительность
  заседания, число анонсов на поколение, ноль таймеров/localStorage, переворот подтверждён); что взято
  сверх плана; список существующих e2e, которые ожидаемо сломались, и почему; честные ограничения;
  готовность швов для Э5.

## 11. Чего делать НЕЛЬЗЯ (сквозной список)

- Пушить; коммитить красное; параллелить продуктовые правки субагентами.
- Гонять существующие e2e-сюиты (только новые).
- Детектить промпт/стадию по тексту; хранить «уже видел» на клиенте; `setTimeout`-хореографию;
  секционные слои полётов; `v-if`-blink между стадиями; второй экземпляр поверхности.
- Пересчитывать выплаты на клиенте; менять правила игры и порядок шагов фазы (кроме вставки ворот);
  трогать десктопный UI и классический Turmoil.
- Начинать Э5-физику и обзор протокола (Q8) «заодно»; оставлять `parliament-enact` живым.
- `title`-атрибут; литералы кнопок; `filter` как носитель состояния; масштабирование текста в моушене;
  `opacity` на `preserve-3d`.
- Сдавать этап без своих скриншотов на трёх профилях и без строки «честные ограничения».

## 12. Готово, когда

Все пять этапов приняты по своим критериям; `test:server` / `test:client` / `build:test` / `lint:client`
зелёные; новые e2e зелёные на трёх профилях с `--workers=1`; галерея скриншотов и два видео просмотрены и
приложены; документы и заметки памяти написаны; журнал прогресса закрыт разделом «Итог прогона»; в
рабочем дереве — только закоммиченное; пуша не было.
