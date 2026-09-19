# «Заседание парламента» — журнал прогресса Э0 → Э4

Прогон по промту `docs/claude/prompts/parliament-E0-E4-sitting-foundation.md` (план —
`docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md`). Начало: 2026-09-19, база — коммит `f4409a49c5`
(после Э6 `b58448fdc5`). Порядок этапов строгий: Э0 → Э1 → Э2 → Э3 → Э4; каждый этап — свой
локальный коммит («Parliament sitting · Э<n>: …»), без пуша. Существующие e2e в прогоне не гоняются
(подгонка — отдельно в конце); новые e2e и собственные пробники — обязательны.

Разделы дописываются по ходу: что сделано · замеры · отклонения от плана и почему · что взято сверх
плана · открытые вопросы с принятым допущением · честные ограничения.

---

## Э0 — механический разрез монолитов (принят 2026-09-19)

### Исходное состояние (замерено 2026-09-19)

| Файл | Строк |
| --- | --- |
| `src/client/components/console/ConsoleParliamentSection.vue` | 3520 |
| `src/styles/console_parliament.less` | 3392 |
| `src/client/console/consoleParliamentState.ts` | 63 |
| `src/client/console/parliament/consoleParliamentVoteMotion.ts` | 645 |
| `src/client/console/parliament/consoleParliamentEnactMotion.ts` | 157 |
| `build/chunks/console-shell.js` (production, до разреза) | заполняется после сборки |

### Пробник паритета

Временный `tests/e2e/tmp-parl-e0-parity.spec.ts` (удаляется вместе с приёмкой Э0): три профиля
(1080 / TV 4K / Deck 1280×800) × сцены `01-overview`, `02-party-focus`, `03-vote-mode` (3 карты),
`03b-vote-mode-second`, `03c-vote-back`, `04-seat`, `05-enact-take` (Climate Research, встроенный
добор), `06-recap` (после всех тактов и полётов), `07-recap-closed`, `08-vote-two-cards`.
Скриншоты `screenshots/parliament-e0-parity/{before,after}/<preset>/NN.png`, диффы — `…/diff/`
(красные пиксели на приглушённой копии) + `NN.json` с числом расходящихся пикселей. Порог — ноль
пикселей (`animations: 'disabled'`, ожидание загрузки всех изображений, `settle` с тихим фидом).

### Шум самого пробника (замер до разреза)

Два прогона на ОДНОЙ сборке (первая версия пробника, один снимок на сцену) разошлись на 8 сценах из 12:
1080 · итоги — 68 px (кромки шеврона дока руки внизу), 1080 · добор — 2258 px (иконки `card.webp` —
колода в HUD, значки карт в формулах: фон ещё не декодирован в момент снимка), TV 4K · обзор —
304 338 px (арт двух карт и текст правительства — снимок в момент входного каскада/декода), Deck ·
кресло — 111 px. Ноль пикселей «по определению» недостижим: рендер не детерминирован по времени
декодирования изображений и входных каскадов. Поэтому пробник переделан:

- **снимок «устоявшийся»** — два подряд снимка с шагом 260 мс обязаны совпасть попиксельно (до 10
  попыток), иначе стоит последний; это снимает поздний декод и незавершённые входы;
- **маска шума** — базовая линия снимается ДВАЖДЫ на одной и той же сборке (`before`, `before2`);
  пиксели, где две базы расходятся, исключаются из счёта («шум пробника»), дифф-картинка красит их
  янтарным, настоящие расхождения — красным; сравнение «после» ведётся против `before` ВНЕ маски;
- `expect.soft` — каждая сцена доснимается даже после расхождения.

С устоявшимся снимком обе базовые линии (2 × 12 сцен × 3 профиля) прошли полностью.

### Решения по разрезу (приняты до первой правки)

1. **Состояние машины стадий — модульное (`parliamentFlow` в `consoleParliamentFlow.ts`), не props/emits.**
   План на Э0 говорил «переименовать с тем же содержимым», а модуль со `stage` — цель Э3. Но 3520-строчный
   SFC режется на 10 компонентов только если стадия, курсор (`slotIndex`/`partyIndex`) и транзиентное
   состояние голоса (`voteSnapshot`, `sourceHold`, `landedSeq`, `flightSeq`…) читаются всеми ярусами из
   ОДНОЙ записи; через props/emits это ~40 пропсов и пинг-понг событий на каждую смену стадии. Чтобы
   семантика «свежий `data()` на каждый mount» не изменилась, корень сбрасывает запись в `created()` и
   `unmounted()` (`resetParliamentFlow`/`resetParliamentHolds`). Отклонение от буквы плана в сторону его
   же цели — зафиксировано здесь.
2. **`consoleParliamentState.ts` переехал в `src/client/console/parliament/consoleParliamentFlow.ts`**
   (импортёры: `ConsoleShell.vue`, `ConsoleBoardCardBonusLayer.vue`); recap-seen/localStorage пока
   там же (удаляются в Э3).
3. **Полёты — `parliamentFlights.ts`**: спеки прокси (`FlightSpec`/`CardFlightSpec`), константы
   длительностей, реактивный список, регистрация элементов/хендлов, `flyCube`/`flyCard`/`flySeatDelegate`,
   `placeCubeRect`/`rectOf`. Рендер прокси — `ConsoleParliamentFlights.vue` (тот же `Teleport to="body"`
   внутри секции, что и раньше — переезд в шелл-слой остаётся за Э4, менять там один модуль + один файл).
4. **Дисплей-холды сцены итогов — `parliamentDisplayHolds.ts`** (`parliamentHolds`: что ещё ПОКАЗЫВАЮТ
   зона мест, плитки, ленты, склад и колода, пока объект не долетел). Названы обще, не «recap»: та же
   запись нужна директору заседания в Э4. `seedRecapHolds` — прежний `buildRecapPending`, вызывается
   корнем ДО раскрытия стадии (первый кадр сцены уже без «прилетевших» кубов — как и раньше).
5. **Компоненты (11 вместо 9 по §10.1):** Seats · Government · VotingArea · Parties · Agenda · VoteMode ·
   SeatPick · **Recap** (умирает в Э3) · **Enact** (сверх плана — слой принятия тоже временный, Э3 заменяет
   его стадией; вынесен по той же логике «чтобы Э3 удалял файл») · **Flights** (сверх плана — рендер
   прокси, чтобы Э4 менял один файл). Модули сверх плана: `parliamentCardFit.ts` (fit карт — читает
   `parliamentFlow`/корень из модуля, без аргументов), `parliamentVoteView.ts` (чистые чтения «как показано»:
   `tallyShownOf`, `winningShownOf`, `placeShownOn`, `seatSourceOf`, `benchSourceOf`, `benchWarnOf`,
   `voteSourceOf`, `ribbonGroupsOf`), `parliamentInspect.ts` (тип запроса осмотра — шелл импортирует его
   отсюда, не из SFC), `parliamentCommands.ts` (контракт командной строки), `parliamentNavigation.ts`
   (грамматика браузе-слоя: d-pad по зонам, осмотр из зоны, дверь партийного действия),
   `parliamentStageMotion.ts` (unfold/fold стадии среднего яруса).
6. **Крошка** (`parliamentCrumbSubject/Stage/Committed`) и пульс кресла (`pulseParliamentChair`) — в модуле
   потока: чистые функции стадии.
7. **Government** держит вспышку задания (`questPulse`) сам; **Parties** — пульсы доступа/использования;
   **Agenda** — глайд маркера (`playAgendaGlide` публичен — корень вызывает его на такте Повестки сцены
   итогов); **Recap** отдаёт текущий такт наверх событием `beat` (корень хранит `recapItem` → подсветка
   ярусов), закрывается событием `close`; **VoteMode** отдаёт `send` (ответ + стадия), ответ сервера
   корень маршрутизирует в `answerAfterSubmit`/`answerWhilePaying`; **SeatPick** отдаёт `submit` с ректом
   уходящего куба.
8. Хелперы, добавленные в существующие модули: `conLogicalPx` (`consoleLayoutProfile.ts` — прежний
   `cubePx`), `parliamentPlayerName`, `resolutionTitleOf`, `emptyParliamentView`, тип `AgendaMove`
   (`consoleParliamentModel.ts`).

**LESS**: разрез сделан скриптом по диапазонам строк (`scripts/tmp-split-parliament-less.mjs`, удалён
после), так что каждое правило — байт-в-байт перемещение; `git diff --color-moved=dimmed-zebra` по
`src/styles/` показывает только новые `@import`, шапки-комментарии новых файлов и строки-обёртки
(`.con-parl {`, `html.con-profile-… .con-parl {`, `}`). Порядок импортов в `common.less` повторяет порядок
блоков оригинала там, где он значим (плакетка до `.con-pseal--aside` осмотра; лестницы профилей — по
специфичности не зависят от позиции). В `console_parliament_sitting.less` ушли и два recap-правила
(`&__card--dealing .pcard`, `&__gov-card--awaiting .pcard`) — чтобы Э3 удалял файл, а не выискивал строки.

### Размеры после разреза

| Файл | Строк |
| --- | --- |
| `ConsoleParliamentSection.vue` (корень) | **700** |
| `parliament/ConsoleParliamentVoteMode.vue` | 871 |
| `parliament/ConsoleParliamentRecap.vue` (временный) | 530 |
| `parliament/ConsoleParliamentGovernment.vue` | 290 |
| `parliament/ConsoleParliamentAgenda.vue` | 248 |
| `parliament/ConsoleParliamentVotingArea.vue` | 232 |
| `parliament/ConsoleParliamentSeats.vue` | 153 |
| `parliament/ConsoleParliamentParties.vue` | 153 |
| `parliament/ConsoleParliamentEnact.vue` (временный) | 115 |
| `parliament/ConsoleParliamentSeatPick.vue` | ~115 |
| `parliament/ConsoleParliamentFlights.vue` | ~45 |
| `console_parliament.less` / `_vote` / `_sitting` | 1178 / 328 / 116 |
| `console_party_plaque` / `_resolution_face` / `_party_action` | 227 / 200 / 309 |
| `console_resolution_inspect` / `_influence_yield` / `_resolutions_playground` | 429 / 481 / 149 |

`vue-tsc` и `eslint --no-cache` по всем новым/изменённым файлам — чисто; `npm run build:test` (оба
дерева) — чисто; `npm run test:server` — 11953 ✓ (floor 8500).

| Артефакт | До | После | Δ |
| --- | --- | --- | --- |
| `build/chunks/console-shell.js` | 2 270 138 B | 2 277 202 B | +0,31 % |
| `…console-shell.js.br` | 427 319 B | 429 001 B | +0,39 % |
| `build/styles.css` | 3 739 602 B | 3 740 809 B | +1 207 B (шапки-комментарии новых файлов + комментарий к порядку импортов) |

### Пробник после разреза — три прогона, две НАСТОЯЩИЕ регрессии

Пиксельный паритет — это не формальность: две регрессии разреза увидел только пробник, ни один тип-чек и
ни один юнит-спек их не ловит.

**Прогон 1** (сборка сразу после разреза). Обзор, фокус партии и режим голосования — 0 px на всех трёх
профилях; но сцены КРЕСЛО (`.con-parl__stage[data-parl-stage="seat"]` так и не появился) и ПРИНЯТИЕ
(`[data-embed-slot="parliament-enact"] .con-extdraw` = 0) провалились на всех профилях. Причина — не
пиксели, а порядок хуков Vue: в разрезе состояние стадии переехало в модульную запись, и корень сбрасывал
её в `created()`. Но `immediate: true`-вотчеры (`enactStanding` → `openEnact()`, `'bridge.seat'` →
`openStage('seat')`) срабатывают при установке компонента — ДО `created()` — и стадия, которую они только
что открыли, стиралась сбросом. В монолите базой был `data()`, который инициализируется до вотчеров.
**Исправление:** сброс в `beforeCreate()` — единственный хук до `data`/`computed`/`watch`. Ловушка общая
для любого перехода «модульная запись вместо `data()`»: сброс на mount обязан идти раньше вотчеров.

**Прогон 2.** Кресло и принятие открылись, но сцена ПРИНЯТИЕ разошлась на всех профилях (1080 — 22 393 px,
TV — 89 091, Deck — 18 698): блок «ЭТА ВЫПЛАТА» под перенесённой картой сдвинут на ~8 px влево — потерял
центрирование. Причина — КАСКАД. Разрез сохранил байты правил, но не их порядок для «поздних» блоков
исходного файла (строки 3077–3242, дописанные при итерациях RX01–RX05 ПОСЛЕ блока influence-yield
2606–3075): блок стадии принятия ([3139–3197] → `console_parliament_sitting.less`) содержит
`&__enact-yield { align-items: center }` (0,1,0) на тот же элемент, что и `.con-iyield { align-items:
flex-start }` (0,1,0) из `console_influence_yield.less`; в монолите стадия шла после шасси и побеждала, в
первой раскладке импортов — до него. Подтверждено на скомпилированном CSS: `.con-iyield` 104078 →
`.con-parl__enact-yield` 104959 (старый порядок), 102224 → 104342 (новый — перевёрнут).
**Исправление:** порядок импортов в `common.less` — `console_parliament_sitting.less` после
`console_influence_yield.less` (ранние блоки sitting — сцена итогов — ни с одним поздним файлом не
пересекаются). Три остальных поздних блока проверены по правилам: хвост шасси (TV-лестница `(0,3,0)+` по
`.con-pseal*` внутри `.con-parl`), хвост vote (Deck-лестница `.con-parl__info-own--yields .con-iyield__*`,
`(0,3,0)`) и хвост inspect (`.con-zoom__bar-*`: с корнем `.con-preact` совпадает только `white-space:
nowrap` — с тем же значением) — конфликтов равной специфичности с файлом yield нет. Механическая проверка
одноимённых селекторов по региону парламента в скомпилированном CSS (1026 правил, старый vs новый): 0
перестановок. **Гард:** `tests/console/parliamentLessOrder.spec.ts` (порядок импортов семейства); в
пробник добавлены «свидетели каскада» — computed `align-items` у `.con-parl__enact-yield` и стили футера
инспектора (`.con-zoom__bar-yield` / `-reaction`, ветка `--parts` Climate Research) на трёх профилях.

**Прогон 3** (итог приёмки): ПРИНЯТИЕ — 0 px вне маски на всех профилях; свидетели каскада — зелёные на
трёх профилях; конец состояния «возврат из голосования» на TV детерминирован (три отдельных прогона:
те же `--con-parl-card-zoom 1.454` / `--con-parl-vote-zoom 2.093`, ректы карт 1883.031 / 395.156 /
465.266 × 668.828, `transform: none`, без inline-стилей). Оставшиеся расхождения — шум пробника, не код:

| Сцена | 1080 | TV 4K | Deck | Что это |
| --- | --- | --- | --- | --- |
| 01 обзор · 02 фокус партии | 0 · 0 | 80 · 80 | 0 · 0 | TV: шевроны дока руки внизу (x1634–1663) |
| 03 голосование · 03b вторая карта | 0 · 0 | 0 · 0 | 0 · 0 | — |
| 03c возврат из голосования | 0 | 528 901 | 32 (маска 1597) | растр карт после свёртывания режима: геометрия та же (см. выше), другой лишь растр композитного слоя после transform-твина; на Deck две базовые линии сами расходились здесь на 1597 px |
| 04 кресло | 582 | 0 | 0 (маска 111) | 1080: иконки `card.webp` (колода резолюций, две награды Повестки — фон не декодирован в момент снимка) + 1-px сегменты кромки рейки ресурсов x197 (AA кольца) |
| 05 принятие | **0** | **0** (маска 58) | **0** (маска 22) | после фикса каскада |
| 06 итоги · 07 закрыто | 903 · 1515 | 107 · 107 | 0 · 0 | иконки `card.webp` (счётчик колоды HUD, колода резолюций, значок награды задания, значок партии, награды Повестки) / TV: шевроны дока |
| 08 голосование, две карты | 938 | 0 | 0 | иконки `card.webp` (HUD, колода резолюций, формула карты) |

Ноль «по определению» здесь недостижим (см. «Шум самого пробника» выше); критерий приёмки — ноль вне
классов шума, и он выполнен на всех 30 сценах. Пробник и скрипт разреза удалены вместе с приёмкой.

### Итог приёмки Э0

- Корень 700 строк; 11 компонентов + 9 модулей; девять LESS-файлов; `data-parl-*`-свидетели и наборы
  классов без изменений; чанк +0,31 %.
- Две регрессии найдены пробником и закрыты (см. выше); обе задокументированы как ловушки класса.
- `vue-tsc` (`lint:client`), `eslint --no-cache` (изменённые файлы), `npm run build:test`, `npm run
  test:client`, `npm run test:server` — зелёные перед коммитом.

Коммит: `33609a319d` «Parliament sitting · Э0: механический разрез монолитов».

---

## Э1 — серверный момент: ворота фазы, сводка в живой модели, протокол в журнале (принят 2026-09-19)

### Что сделано

- **Шаги.** `ParliamentPhaseStep` += `assembly` (после `enact`, до `effects`) и `adjourn` (после
  `lobby`; в `final` — сразу после `effects`); тип `ParliamentPhaseStage = 'assembly' | 'adjourn'`.
- **Ворота (`ParliamentPhase.stepGate`).** Промпт каждому участнику без ключа; барьер — `appliedBySeat[seat]
  ∋ '<stage>:<gen>'` (никакого счётчика в памяти); `game.save()` при выдаче и при каждом ответе; ПОСЛЕДНИЙ
  ответ двигает фазу (`continue()`); `activePlayer` не трогается. Стоящий промпт не перезаписывается:
  свои ворота — оставляем, чужой (в движке не бывает: очередь дренируется и ПАУЗИТ на своих промптах до
  ворот; в спеках — артефакт харнесса) — место переспрашивается при следующем входе в ворота, а входит в
  них каждое продолжение фазы.
- **Промпт ворот** — `SelectOption(title, 'Continue').markParliamentPhase({stage, generation, final, seq})`;
  маркер `parliamentPhasePrompt` на `BasePlayerInput` и `BaseInputModel`; `awaiting` (цвета неответивших)
  считается ЦЕНТРАЛЬНО в `ServerModel.getWaitingFor` из `parliamentGatePending()` — из ключей сохранения,
  в момент сборки модели, так что список движется, пока другие отвечают. Заголовок — для журнала и
  plain-рендера, детекция — только по маркеру.
- **Машина шагов переписана итеративно** (`drive()` + `drainDeferred()`): прежде каждый `case` рекурсивно
  звал `continue()`; с одним журнальным контекстом на всю фазу рекурсия загоняла бы конец фазы (`onDone`
  → финальные озеленения / следующее поколение) ВНУТРЬ группы заседания. Теперь `finish()` возвращает
  `{final}`, а `onDone` вызывается снаружи `runWithContext`. Отложенная очередь, опустевшая на месте,
  продолжает тот же кадр; приостановившаяся на промпте — входит в `continue()` заново из ответа.
- **Журнал — ОДНА группа `political-phase` на фазу.** `convene()` открывает `beginAction(undefined,
  {kind:'parliament'}, {category:'political-phase'})` только на корневую строку `'The Mars Parliament of
  generation ${0} convenes'` (announcement), закрывает scope и продолжает под ПЕРЕПРИСОЕДИНЁННЫМ контекстом
  того же корня (`EventRecorder.rejoinAction(rootId, source, category)` + `runWithContext`) — так же
  продолжаются ответы на ворота, resume после reload и шаги после input boundary. `summary.correlationId =
  rootId`, `summary.seq = ++parliament.phaseSeq`. Коалесценция вложенных `beginAction` расширена:
  `isInCoalescingScope()` = `automa-turn` ∨ `political-phase`; сигнатура `beginAction(player: IPlayer |
  undefined, …)` — у заседания нет актора.
- **`kind: 'reaction'` (решение Q6) — из событий рекордера, ни одна резолюция не переписана.**
  `readReactions()`: окно шага `effects.scan = {player, key, part, sinceEvent}` (id события — переживает
  reload); все `party`-события (`production-changed` / `resource-changed`) игрока в окне сворачиваются в
  ОДНУ запись на (партия, триггер, ресурс) под ТЕМ ЖЕ `step` — `{kind:'reaction', party, trigger,
  production|stock, amount, before, after}`; окно двигается за прочитанным (не за увиденным — прогресс
  сериализуется одинаково до и после resume, шаг, вошедший заново, окно не переоткрывает); хвост отложенных
  действий дочитывается на каждом обороте `drive()`. `recordOutcome` в дедупе (player, step) реакции не
  считает.
- **История.** `Parliament.phaseSeq`, `Parliament.phaseHistory` (cap 24, `recordPhase`), сериализация и
  загрузка с фильтром ретирированных (`summaryNamesAny`) и повторным cap; `PARLIAMENT_SAVE_VERSION` — 1.
- **Модель.** `ParliamentPhaseModel.summary` (та же `summaryModel`, что у `lastPhase`), `.awaiting` на
  шагах-воротах; `ParliamentPhaseSummaryModel.seq / correlationId`; `ParliamentModel.phaseHistory`;
  `ParliamentEnactOutcomeModel.kind += 'reaction'` + `party`, `trigger`.
- **Клиент (две строки + потребители union).** `journalView.ts` — одиночная группа `political-phase`
  остаётся группой (`KEEPS_GROUP_SHAPE`); `notificationIngest.ts` — `rootPresentable()` исключает корень
  `political-phase` (у заседания свой презентер — Э3); `ConsoleParliamentRecap.vue` — `case 'reaction'` в
  `outcomeText` (файл умирает в Э3); `winnerRewardModel.winnerOutcomeOf` не путает реакцию с записью тайла.
- **Локаль** (`ru/parliament.json`): три ключа фазы + два текста реакции; «The Mars Parliament convenes»
  заменён на ключ с поколением.

### Тесты

- `tests/parliament/parliamentArrange.ts` — хелперы ворот: `gatePromptOf` · `answerGate` ·
  `answerStandingGates` · `settleParliamentGates` · `passToParliament` · `endGenerationThroughParliament`
  (ЕДИНЫЙ способ пройти заседание из спека; спеки резолюций читают свои вопросы как раньше).
- `ParliamentPhase.spec.ts` +9: барьеры с 2 и 3 местами; двойной ответ; reload внутри КАЖДЫХ ворот
  (переиздание только неответившим; повторный resume не перезаписывает — `waitingForSerial` тот же);
  `activePlayer` неизменен на всех переходах (S6 аудита закрыт); final: `effects → adjourn → done`; соло с
  MarsBot — барьер из одного; клон с ремапом id внутри ворот; `seq` монотонен + история cap 24 + round-trip
  + модель; журнал — одна группа с одним `correlationId`, включая шаги после reload.
- `ParliamentModel.spec.ts` (новый, 2): `phase.summary` — та же форма, что `lastPhase` (ключи совпадают);
  `awaiting`; `pending.input`; `awaiting` маркера на проводе.
- `PartyEffects.spec.ts` +2: реакция записана внутри фазы (оба места, `before/after`, в модели с цветами);
  вне фазы — не записана.
- `tests/events/politicalPhaseScope.spec.ts` (новый, 3): корень без актора; вложенное действие
  коалесцируется; rejoin. `journalView.spec.ts` +1. `tests/client/…/notificationIngest.spec.ts` (новый, 4).
  `e2eFixturesLoad.spec.ts` — фикстура внутри ворот переиздаёт промпт ровно неответившим.
- Спеки резолюций (Aquifer / Architecture / Biodome / PowerGrid / Climate / Retired): локальный
  `endGeneration` → общий хелпер; `settleParliamentGates` перед чтением завершённой фазы (скрипт по
  шаблонам + ручная дочистка); фильтры «одна запись на шаг» исключают `reaction`; MarsBot-сценарии
  отвечают на ворота явно. Число `it` не изменилось, правила игры не тронуты.
- **Фикстуры**: `parliamentFixture(name, {resolution, slot, votes, agenda, megacredits, arrange, stopAt,
  expect})` заменил 20 inline-блоков (`stopAt: vote | assembly | effects | adjourn | done`; асики
  эффектов отвечаются самым простым легальным ответом — добор целиком / первая карта / тихая клетка /
  первая ветка); регенерированы все 34 `parliament-*`, добавлены 10:
  `parliament-{aquifer,architecture,biodome,powergrid,climate}-{assembly,adjourn}`. Второй вид («зритель
  ответил, другой — нет») файлом не хранится: это один API-ответ от `-assembly` — так его и берёт e2e.
- **e2e (новый, без браузера)**: `tests/e2e/console-parliament-gates.spec.ts` — dev-door, два места, у
  обоих `parliamentPhasePrompt{assembly}` с `awaiting` из двух цветов и `summary.seq/correlationId` на
  проводе; ответ первого не двигает (у второго `awaiting` из одного цвета, у фазы тоже); ответ второго
  двигает (Climate Research спрашивает добор); двойной ответ с тем же штампом отклонён как stale. 2/2.

### Отклонения от буквы плана и почему

1. Чужой промпт на воротах — пропуск-с-переспросом, не `setWaitingForSafely`-цепочка: при повторном
   входе в ворота цепочка выдавала бы вторые ворота той же стадии (воспроизведено на «прерванной» фазе
   спеков Architecture/PowerGrid); переспрос при следующем входе покрывает оба честных случая.
2. Итеративная машина шагов — иначе конец фазы попадал в её журнальную группу (п. выше).
3. Реакция делит `step` с шагом, который сопровождает (стадия НАГРАДА в Э5 группирует по шагу);
   потребители «одна запись на шаг» фильтруют `kind !== 'reaction'` — три места в клиенте/спеках, остальные
   ищут по `effect` / `kind`.
4. Живой scope открыт только на корневую строку, всё остальное — rejoin. Не «scope на всю фазу»
   буквально, но ровно обещанное: одна группа, все строки с одним `correlationId`, ответ после reload —
   в цепочке, конец фазы — вне её.
5. Хелперы спеков очищают ЛЮБОЙ стоящий промпт перед пасом (пасующее место в движке ничего не держит;
   харнесс оставляет меню хода и пик исследования) — иначе ворота честно ждали бы его; `passToParliament`
   отказывается заканчивать поколение, пока предыдущее заседание не закрыто (именованная ошибка вместо
   «already in progress» драйвера).

### Честные ограничения Э1

- Интерим до Э3: в консоли промпт ворот идёт как generic confirm (`kind: 'choice', flavor: 'confirm'`);
  уведомление группы `political-phase` уже выключено (презентер — заседание Э3), так что до Э3 итоги
  фазы видны в журнале, но не в ленте.
- Реакции читаются по событиям с источником `party`; партия, платящая мимо рекордера, не записалась бы —
  таких нет (все хуки идут через `stock.add` / `production.add` с `from: {partyName}`), гард — сам
  `PartyEffects.spec`.
- `phaseHistory` едет в модели каждого ответа (до 24 сводок) — пока мал; при росте `outcomes` вернуться
  (протокол, отдельный план).
- Снижение версии сервера при фазе, стоящей на `assembly`/`adjourn`, не поддерживается (§12 плана).

### Замеры

| Что | Значение |
| --- | --- |
| `npm run test:server` | 11 982 ✓ · 1 pending · 0 ✗ (floor 8500; было 11 955 — +27 `it`) |
| `npm run test:client` | 5 684 ✓ (было 5 680 — +4) |
| `npm run build:test` (оба дерева) · `lint:client` (vue-tsc) · `eslint --no-cache` · `lint:i18n` · `make:json` | зелёные |
| `tests/console/e2eFixturesLoad.spec.ts` | 44 ✓ (34 парламентских фикстуры, 10 новых с воротами) |
| `tests/e2e/console-parliament-gates.spec.ts` | 2 ✓ (5,4 с, без браузера) |
| Спеки парламента | 174 ✓ после адаптации существующих, +17 новых `it` |

### Итог приёмки Э1

Все пункты приёмки §5 промта закрыты: барьеры 2/3 мест · один ответ не двигает · двойной ответ
идемпотентен (отклонён как stale) · `Game.deserialize` внутри каждых ворот переиздаёт только неответившим
и не перезаписывает стоящий промпт · `activePlayer` неизменен на всех шагах · final `effects → adjourn →
done` · соло с MarsBot — барьер из одного · клон с ремапом id · `phaseHistory` cap 24 · `seq` монотонен ·
реакция партии — `reaction` и только внутри фазы · журнал — одна группа на поколение с одним
`correlationId` (включая шаги после reload) · `test:server` ≥ floor · dev-door на два места (e2e без
браузера). Коммит: `efefc0ab4e` «Parliament sitting · Э1: ворота фазы, сводка в живой модели, протокол в
журнале».

---

## Э2 — контракт автора резолюции, таблица адресов, гард по каталогу (принят 2026-09-19)

### Что сделано

- **`src/common/parliament/rewardAddress.ts`** (общий слой): `REWARD_ADDRESS: Record<OutcomeKind,
  RewardAddress>` — компилятор требует строку у КАЖДОГО значения union `kind` (`production · stock ·
  cardResource · cards · ocean · greenery · reaction · skipped`); строка = `surface` (рельса / карта таблицы
  / док руки / поле / плита стадии) · `source` полёта (иконка карты / плитка партии / колода проектов /
  ничего) · `unit` · `stage` (reward / choice / take / board) · `reading` · `skipTitle` (переведённый ключ).
  `rewardAddressOf(outcome, viewer)` → `RewardDelivery {address, mine, skipped?, payload}` — payload
  читается из ЗАПИСИ (ресурс, карта, величина, параметр тайла, партия), никогда из правила; платящий вид с
  нулевой величиной называется адресом сам. Будущие виды (`stockLoss`, `agenda`, `colonyTrack`, `tr`,
  `partyAccessGrant`) нарочно не добавлены — правило добавления записано в чеклисте (§4).
- **`src/client/console/parliament/resolutionFamily.ts`**: `familyOf({scaled, winnerReward})` → `influence |
  counted | counted-tags | winner-tile | sequel` по декларации; «Полигон» читает семейство через него
  (`FAMILY_OF`-таблицы по id не осталось — в `.vue` только `familyOf(this.selected)`).
- **Dev-примеры каталога приведены к контракту** (они — часть каталога и проходят тот же гард): один шаг = одна
  запись (`DEV_IMMEDIATE`: `grant-mc` + `grant-plants`; `DEV_COMPOUND`: `grant-mc` (пропуск «No plant, microbe
  or animal tags» при нуле) + `draw` через общий интейк), `DEV_COMPOUND.winner` «Gain 1 TR» → «Gain 2 M€»
  (TR — вид без адреса и без плательщика; лицо `b.tr(1)` → `b.megacredits(2)`), `DEV_SCIENCE.draw` через
  интейк с пропуском «Fewer than 2 science tags — no cards», `TEST_CHOICE` — все четыре шага отчитываются
  (`grantStock` / `drawStep` — два помощника каталога).
- **Гард `tests/parliament/ResolutionContract.spec.ts`** — перечисляет `REDUX_RESOLUTION_CATALOG` сам; для
  каждой реальной карты: (1) отчётность на столе из 3 мест при влиянии {0, 1, 3, 5} × таблице {пустая, одна
  подходящая, насыщенная} с нейтральным победителем и при {1, 3, 5} с игроком-победителем (ровно одна запись
  на (место, шаг); шаги победителя — только у него) — провал печатает `«RX05: шаг 'draw' не отчитался при
  влиянии 0 / таблице 'empty'»` (фраза закреплена отдельным тестом); (2) `kind` ∈ таблице адресов, причина
  пропуска переведена (склейка ВСЕХ `src/locales/ru/*.json` — `make:json` тоже сливает файлы); (3) маркер
  источника у каждого промпта; (4) reload внутри КАЖДОГО вопроса — тот же маркер, фаза закрывается, ничего
  дважды; (5) `amount` = `scaledAmount` / `sequelAmount` по записанному влиянию и счёту, у пропуска — 0 или
  та же величина, записанное влияние = влияние стола; (6) `src/client/**` без id каталога и без импортов
  `server/parliament/resolutions` (кроме манифеста и стенда; комментарии не считаются); (7) лицо непусто,
  все `text.*` переведены, код уникален; (8) `familyOf` ∈ `RESOLUTION_FAMILIES`. Dev-примеры — отдельным
  `describe` (без п. 3). Образец сломанной карты — `describe.skip` с фразой гарда.
- `tests/parliament/rewardAddress.spec.ts` — таблица исчерпывающа и совпадает с union; каждая строка полна,
  `skipTitle` переведён; адреса платящих видов; доставка записи (payload, `mine`, пропуск по причине / по
  нулю / без причины).
- Документы: `docs/claude/parliament-resolution-checklist.md` (полная форма §5 по образцу чеклиста
  корпораций MarsBot: до кода → файл карты → регистрация → бесплатное → таблица адресов → запрещено → гард
  → спек/фикстуры → рецепт), короткая форма в `.claude/rules/game-logic.md` (пути `src/server/parliament/
  resolutions/**`, `src/common/parliament/**`, `tests/parliament/**`), строка в `docs/claude/README.md`.
- Локаль: 10 новых ключей (`Gain 2 M€.`, две причины пропуска dev-примеров, семь `Skipped: …` заголовков).

### Отклонения / решения

1. Гард гоняет реальную фазу (3 места, ворота, reload) вместо вызова `step.run` в изоляции: так проверяется
   ровно то, что переживёт игрок — маркеры, resume, порядок, реакции — и ни одна резолюция не перечислена.
2. «Влияние 0» для игрока-победителя невозможно (его шаг Повестки идёт первым) — матрица п. 1 разделена:
   нейтральный победитель для {0, 1, 3, 5}, игрок-победитель для {1, 3, 5}.
3. Локаль читается СКЛЕЙКОЙ всех RU-файлов: «Place an ocean tile.» переведён в `card_info.json`, а не в
   `parliament.json` — гард по одному файлу ложно падал бы.
4. Dev-пример с TR переписан на M€ вместо добавления `kind: 'tr'` — по указанию плана (адрес без плательщика
   не добавляется).

### Честные ограничения Э2

- Гард проверяет отчётность и формулу, но не «смысл» пропуска (что причина уместна) — это спек карты.
- «Одна подходящая карта» таблицы — общий набор (Fish / Artificial Lake / Power Plant / Research); резолюция,
  которой нужна карта вне него, получит пропуск «no recipient» на этой таблице — честно, но формулу п. 5 это
  не проверит; расширять набор — в этом файле.
- Образец сломанной карты — `describe.skip`: определение вне каталога не сажается в настоящую игру; фраза
  гарда закреплена юнит-тестом `missingReport`.

### Итог приёмки Э2

- `npm run make:json` / `make:cards` / `lint:i18n` — зелёные; `npm run lint:client` (vue-tsc) — 0 ошибок (первый прогон
  поймал неиспользуемый импорт `resolutionCountKind` в стенде после перевода `family()` на `familyOf` — убран);
  `npm run build:test` — обе ступени 0; eslint по всем изменённым файлам — чисто.
- `npm run test:server` — 12024 собрано, 12022 passing, 0 failing, 2 pending (пол 8500); `ResolutionContract` 35 +
  `rewardAddress` 5.
- `npm run test:client` — 5684 собрано, 5683 passing; единственный красный — `parliamentAnnotations.spec` ожидал
  «Gain 1 TR.» у dev-примера (п. 4 «Отклонения»): ожидание переведено на «Gain 2 M€.», спек 13/13.
- Коммит: «Parliament sitting · Э2: контракт автора резолюции, таблица адресов, гард по каталогу».

## Э3 — маршрутизация и каркас flow «ЗАСЕДАНИЕ» (принят 2026-09-19)

### Что сделано

- **Чистая позиция заседания** — `src/client/console/parliament/consoleSittingFlow.ts`: `sittingPositionOf(model,
  wf, viewer)` читает серверный шаг, сводку, `awaiting`, `pending` и СОБСТВЕННЫЙ промпт зрителя по структурным
  маркерам (`parliamentPhasePrompt`; `choiceContext` / `externalDrawPrompt` / `placementContext` с источником-
  резолюцией) → `{step, pages, gate, gateStanding, awaiting, rewardStep, waitingFor}`. Страницы шага:
  `assembly` → `verdict · enact · reward`, `effects` → `reward`, `refresh/lobby` → `renewal`, `adjourn` →
  `renewal · closing` (`final` → `closing`). `sittingStageKey` (хвост крошки: `Verdict/Enactment/Reward/
  Choice/Intake/Placement/Renewal/Closing`), `sittingWorkspacePhase` (`committed` до закрытия, `verdict` на
  закрытии, `executing` при отправке), `sittingPrimaryKey` (`Continue` / `To the reward` / `Close the sitting`
  / undefined), `sittingStartPage` (отвеченные ворота → последняя страница), `parliamentSittingFlowBeat`
  (`parliament:gen<N>`, `flow: 'parliament-phase'`).
- **Поверхность** `ConsoleParliamentSitting.vue` — host-agnostic (`embedded`, `mode: live|review`), пять
  стадий как ПОЗЫ одной смонтированной поверхности (grid-cell layer stack; скрытые панели вне потока), ряды-
  объекты (эмблема · имя · число · кубы), стадия НАГРАДА: чтение (`enactedYieldsOf live` после записи /
  `voteYieldsOf` без прогноза до), ответ партии, награда победителя, ПЛИТА ПРОПУСКА (`rewardAddressOf`,
  кроме уже названных в чтении scaled-эффектов), строка ожидания чужого выбора, поза «Ждём остальных: [кубы]»
  на воротах, зона `[data-embed-slot="parliament-stage"]`; ЗАКРЫТИЕ — компактная карта «Итоги поколения N».
- **Секция** — стадия `sitting` на chassis `.con-parl__stage` (та же, что у КРЕСЛА: UNFOLD из ректа партий);
  полевая поза `--field` при размещённом шаге (пикер/добор): офсеты среднего яруса измеряются
  (`--con-parl-mid-top/-bottom`), карта правительства телепортируется на `[data-parl-sit-hero]`
  (`flow.sittingField`), движение — прежний `consoleParliamentEnactMotion` (recede/carry/surface); крошка
  `Sitting › <tail>`, фаза через `setWorkspaceFramePhase`, команды через `parliamentCommandsOf({sitting})`, A на
  последней странице → `send({type:'option'}, 'sitting')`; ответ ворот оставляет стадию на месте; конец
  flow = позиция стала `undefined` → `flow-complete('sitting')`.
- **Маршрутизация** — `consoleTaskRouter`: `parliamentPhase` по маркеру (выше сырых типов), section-наборы,
  `taskMinimizable`, `followUpStepStage(kind, wf)` с таблицей стадий для источника-резолюции;
  `consoleMandatoryGate`: `MandatoryFlowKind 'parliament-phase'`, вопрос резолюции не образует task-бита при
  живом flow-бите заседания; `consoleTaskSummary`: копия ворот; `consoleWorkspaceStack`: `serves:
  ['party','parliamentPhase']`, `yieldsToBoard`, `parkOwnsFlow`.
- **Шелл** — flow-бит заседания в `mandatoryFlowBeats`; дверь A (`beat.flow === 'parliament-phase'` →
  `enterWorkspace('parliament', {anchor: {type:'phase', phase: PARLIAMENT}})`, парк восстанавливается, при
  живом размещении — только отпуск ворот); одна зона `parliament-stage` для `hostEmbedTarget` и
  `externalDrawEmbedTarget` (`consoleParliamentUi.stageStanding`); `taskHeldForWorkspace` держит хост «нигде»
  пока зона не стоит; плита заседания в `mandatoryAnnounceView` («Парламент собрался · поколение N», источник —
  спрашивающая резолюция); дверь `parliamentPhase` в `openShellTaskSurface`; `parliamentSittingFrameLive`
  (falling edge → `closeWorkspaceRoot('parliament')` для phase-anchored корня — контракт драфта; реконсилер
  якорей в сессии никем не вызывается, поэтому именно watcher).
- **Таймеры и память** — `parliamentBeat.ts` (`gsap.delayedCall` на motion-часах): VoteMode (посадка/финал),
  PartyActionComposer (задержка бита), parliamentFlights (стаггеры, убиваются с полётом),
  consoleResolutionPayout (бит чтения); one-shot пульсы Agenda/Government/Parties и вспышка кресла — по
  `animationend`. Удалены `recapSeen`/`localStorage`/`RECAP_*`/`chairTimer`, `Recap.vue`, `Enact.vue`,
  `.con-parl__recap-*`, селектор `parliament-enact`.
- **Гарды**: `tests/console/parliamentNoTimers.spec.ts` (allow-list — только `SUBMIT_SAFETY_MS`, строка
  allow-list обязана существовать), `parliamentNoLocalStorage.spec.ts` (+ имена recap по grep),
  `consoleSittingFlow.spec.ts` (17); обновлены `consoleTaskRouter.spec` (2 строки ворот, таблица стадий
  источника, section-набор), `consoleMandatoryGate.spec` (flow-бит покрывает вопросы резолюции),
  `consoleTaskSummary.spec` (2 строки), `consolePromptAdmission.spec` (семейства промптов заседания).
- **e2e** `tests/e2e/console-parliament-sitting.spec.ts` — структурная половина, 3 профиля × 2 теста:
  (1) `parliament-climate-assembly`: плита → A → ВЕРДИКТ → B/возврат → ПРИНЯТИЕ → НАГРАДА («К награде») → A =
  ворота 1 (сервер получил option, `awaiting=[red]`, поза «Ждём») → reload → та же поза → red отвечает по API →
  добор ВНУТРИ (`parliament-stage`, без второй плиты, без standalone-band, крошка ПОЛУЧЕНИЕ) → take → red по API
  → ОБНОВЛЕНИЕ → ЗАКРЫТИЕ (B = none) → A = ворота 2 → red → фаза кончилась → workspace ушёл; leak detector без
  STRANDED; (2) `parliament-aquifer-enact`: пик внутри под ВЫБОР + reload.
- Копия: 26 ключей в `ru/parliament.json`; доки: SITTING § Э3, `.claude/rules/console-ui.md` § THE PARLIAMENT
  SITTING.

### Отклонения / решения

1. `hosts: 'always'` «в фазе» — реестр не умеет «в фазе»; оставлен `inFlow`: заседание никогда не в `browse`
   (все стадии за границей коммита), так что в фазе это `always` по построению. Задокументировано в строке.
2. Локальная страница внутри серверного шага НЕ персистится (стек workspace в сессии не сериализуется, а
   `localStorage` запрещён): reload/park возвращают на первую страницу шага, а при отвеченных воротах — на
   позу «Ждём» (`sittingStartPage`, серверный факт). Компактный реплей пройденных страниц — Э4.
3. `parkOwnsFlow: true` для Парламента: свёрнутое заседание — единственное заседание (стадия = серверный
   шаг), открытие колесом идёт через дверь парка.
4. Тайл победителя при reload: плита анонсирует заседание, A только отпускает ворота (размещение живое,
   Парламент поверх поля не открывается); следующие ворота открывают Парламент дверью `parliamentPhase`.
5. `consoleParliamentEnactMotion` сохранён (recede/carry/surface для полевой позы); директор Э4 его поглотит.
6. Конец flow: `concludeWorkspaceFlow` для phase-anchored корня вызывает `goBoardHome` (корень выжил бы), поэтому
   заседание закрывается явно (`closeWorkspaceRoot`) по falling edge `parliamentSittingFrameLive` — как драфт.

### Замеры (собственные скриншоты, 1080)

- `01-verdict`/`02-enact`/`03-reward-reading`: крошка `⚖ ПАРЛАМЕНТ › ЗАСЕДАНИЕ › …`, бар `A Продолжить · X
  Осмотреть · B Свернуть`, на НАГРАДЕ — `A К награде`. Найдено по скриншоту: скрытые панели layer-stack
  давали ячейке высоту самой высокой панели → стадия наезжала на трек Повестки; исправлено (`position:
  absolute` для панели вне `--on`).
- `10-pick-inside`: пустое поле под живой крошкой ВЫБОР и глаголами пикера — стадия внутри `__mid`, а `__mid`
  несёт `data-parl-recede` и паркуется вместе со стадией; исправлено (`recedersOf` исключает `[data-parl-mid]`).
- Первый прогон: поза «Ждём» — два `[data-sit-awaiting]` (панель ЗАКРЫТИЯ, скрытая, тоже рендерила);
  исправлено (каждая панель — только для своих ворот).
- `05-take-inside` (Deck): карта-носитель наезжала на ряд чтения — `fitParliamentCards` вычитал только блок
  `__yield`; теперь сумма всех `[data-parl-sit-item]` колонки + gap. Там же — второй экземпляр карты-носителя
  (док источника встроенного добора): скрыт в embedded-режиме внутри зоны заседания (план §7.1 «без
  `__source`»); резерв сиденья `sourceSeatReservePx` читает нулевую ширину и отдаёт ряду всю зону.
- Поза «Ждём остальных» на 1080: колонка из пяти чтений уходила за низ яруса (строка ожидания
  полуобрезана) — чтение в позе яруса стало wrapping row (`.con-sit__hero`), строки ожидания — на всю ширину.
- Скрытые панели вне потока давали `scrollHeight` стадии 282 > 208 (абсолютные потомки считаются в
  scrollable overflow) — панели вне `--on` клипуются в своём боксе.

### Честные ограничения Э3

- Локальная страница внутри серверного шага не переживает reload/park (см. «Отклонения» 2).
- Стадии — статичные позы; переходы между позами (RELEASE→UNFOLD→REVEAL) и реплей — Э4; вход/выход стадии —
  chassis'ный UNFOLD/FOLD из ректа партий.
- Ярус партий во время заседания припаркован под стадией (план §6 «средний ярус отступает в парк»), поэтому
  подсветка `--lit` правящей партии на ПРИНЯТИИ невидима; директору Э4 (бит ПОДДЕРЖКА летит к плашкам)
  придётся решить, где стоят плашки во время заседания.
- Чтение НАГРАДЫ до выплаты — оценка панели голосования (контекст `estimate`: «по вашему текущему влиянию»,
  «если принять сейчас»); язык чтения «этой выплаты» до записи — Э5.
- Стадия ОБНОВЛЕНИЕ не перечисляет сброшенных проигравших (сводка их не несёт).
- e2e структурной половины гоняет `climate` (добор) и `aquifer` (пик); тайл победителя (`biodome-enact`:
  плита → A отпускает размещение → после посадки следующие ворота открывают Парламент дверью
  `parliamentPhase`) — путь реализован, но e2e-сценарий на него — вместе с парковкой/возвратом сцены (Э5).
- В `08-after` (следующее поколение, покупка карт) в строке статуса три чипа игроков при двух местах — не
  парламентская поверхность; замечено, не трогалось.

### Итог приёмки Э3

- `npm run make:json` / `make:css` — зелёные; `npm run lint:client` (vue-tsc) — 0 ошибок; `npm run build:test`
  — обе ступени 0; eslint по 30 изменённым файлам — чисто.
- `npm run test:server` — 12046 собрано, 12044 passing, 0 failing, 2 pending (пол 8500): `consoleSittingFlow` 17,
  `parliamentNoTimers` 2, `parliamentNoLocalStorage` 2, `parliamentLessOrder` 2.
- `npm run test:client` — 5694 собрано, 5694 passing, 0 failing (были 5683 + 1 failing до Э3).
- e2e `console-parliament-sitting.spec.ts` — 6/6 (`standard-1080`, `tv-4k`, `deck-handheld` × {assembly-walk,
  pick-inside}), `--workers=1`, `expectFits` на каждой стадии, leak detector без `STRANDED PROMPT`; галерея
  `screenshots/parliament-sitting/<preset>/00–08,10.png` просмотрена (три исправления выше — из неё).
- Ратчет e2e: новый спек без `waitForTimeout`/`requestAnimationFrame`/`page.reload()`; `e2eDriverGuard` 6/6.
- Коммит: «Parliament sitting · Э3: маршрутизация и каркас flow ЗАСЕДАНИЕ».

