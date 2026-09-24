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


## Э4 — директор заседания: физические беты под hold, 3D-переворот раздачи (принят 2026-09-19)

### Что сделано

- **`sittingBeats.ts`** (чистый) + `tests/console/sittingBeats.spec.ts` (7): список бетов из сводки в порядке
  сервера; бет только для факта сводки; один `reward` на исход зрителя (skip с причиной через
  `rewardAddressOf`); `final` без renewal/lobby; `resume` компактит стадии до текущей, `review` — все; гард
  «модуль не знает id каталога».
- **`sittingDirector.ts`** — один master-таймлайн на стадию под `holdForGsapAnimation('parliament-sitting:<stage>',
  {maxHoldMs: 12 s, diagnose, expire})`; `seedEnactHolds`/`seedRenewalHolds` (renewal сливается в enact-holds для
  resume); `parkSittingCards` (победитель лицом вверх над первым пустым контуром слота, старый закон над
  правительством; `govAwaits` прячет лицо правительства); беты: ВЕРДИКТ (свет на припаркованной карте, пульс
  числа делегатов, cascade рядов победителя/ничьей), ПРИНЯТИЕ (старый закон → зона колоды; карта победителя
  `runCardDealFlight` в правительство, посадка = `govAwaits` снят, прокси на следующем кадре; кубы возврата
  по владельцу с центра карты в `[data-parl-seat-reserve]`/склад, стаггер 70; ПОДДЕРЖКА — `sittingMotion.peek`
  → ярус партий показан под стадией `opacity .08`, кубы со склада на `.con-pseal__support-place`, peek
  снимается последней посадкой; reveal `[data-parl-ruler]`/`[data-parl-quest]`; глайд Повестки через ref
  Agenda), ОБНОВЛЕНИЕ (проигравшие (`summary.discarded`, серверная добавка) паркуются лицом вверх над своими
  слотами и улетают в зону колоды; раздача `dealResolutionCard` — тело `Card3DInner` face-down на
  `[data-parl-deck-top]`, `addCard3DTurn` на таймлайне полёта (24–86 % пути), glint, тик колоды на отделении,
  лицо слота на посадке; кубы поддержки со склада на свежие карты; лобби из резервов), ЗАКРЫТИЕ (cascade
  карточки). `finishSittingMotion` = стаггеры выстреливают + все тайны → `progress(1)`; `killSittingMotion`;
  `expire` → finish + settle (holds чистятся, peek снят).
- **Слой полётов шелла** `ConsoleParliamentFlightLayer.vue` (рядом с `ConsoleHandDeliveryLayer`), секционный
  `ConsoleParliamentFlights.vue` удалён; спек карты с `face` рендерится chassis'ом `Card3DInner` (лицо —
  тот же lightweight vm, что в слоте; рубашка; кромка), `faceUp:false` = `rotateY(180)` с первого кадра.
- **`parliamentFlights.ts`**: `flightBeats` хранят `fire` (для «дожать»), `dealResolutionCard`,
  `flyCube` возвращает id полёта ПРИ РОЖДЕНИИ (элемент прокси регистрируется только на следующем рендере),
  `setFlightEl(id, null)` при размонтировании УДАЛЯЕТ запись (иначе `flightRegistered` считает сброшенный
  полёт «в воздухе» вечно), `finishParliamentFlights`.
- **Секция**: `planOpeningMotion` (seed holds всех стадий ≤ текущей ДО первого кадра; реплей пройденных —
  resume; в полевой позе реплея нет), `queueMotion` после unfold стадии ИЛИ из `mounted()` (transition без
  `appear` не играет enter на первом рендере — три пробника ждали бет, который никто не ставил в очередь),
  беты на смену страницы один раз за монтаж, A во время бета = дожать, peek.
- **Сервер**: `summary.discarded` (проигравшие обновления) — `SerializedParliament`, `ParliamentPhase.stepRefresh`,
  `ParliamentModel` (сервер и common), фильтр retired в `Parliament.ts`.
- **LESS**: `--peek`, `--lit`, физический прокси (outer без клипа, рамка/тень на гранях), кроссфейд панели.
- **e2e** `console-parliament-sitting-motion.spec.ts` (1080): сэмплер `setInterval`+`MutationObserver`
  (rotateY из inline transform, смещения прокси, `--dealing`, `--awaiting`, peek, `data-count` колоды,
  количество нарисованных лиц по slug, hold'ы из `__conReady`), 4 теста: ВЕРДИКТ→ПРИНЯТИЕ, ОБНОВЛЕНИЕ+«дожать»,
  reduced-motion, perf-lite.

### Отклонения / решения

1. Бонус Повестки (чип РТ → HUD / карта → док) не переигрывается — уже выплачен до ворот, счётчик HUD уже
   сдвинулся; глайд маркера — да (свой hold), строка «+1 РТ» на панели.
2. Подпись «→ резерв player1» у резерва — не реализована (язык Э5).
3. Бывший слот победителя = первый ПУСТОЙ контур (`[data-parl-slot-empty-card]`): область рисует реальные слоты
   первыми, индекс `winner.slot` визуально не сохраняется.
4. Ярус партий во время заседания припаркован; для ПОДДЕРЖКИ — peek (стадия `opacity .08`), не постоянная
   видимость плашек.
5. Видео покадрово не смотрел (нет инструмента кадров) — эвидентность: сэмплер + скриншоты в полёте.
6. Транзишн стадии без `appear`: очередь моушена стартует из `mounted()` на смонтированном DOM.

### Замеры пробника (что нашёл сэмплер, а не глаз)

Пробник `console-parliament-sitting-motion.spec.ts` (1080, `setInterval` + `MutationObserver`, никогда rAF):

- **Прогон 1 — 3 из 4 красные, «бет не стартовал».** `<transition>` без `appear` не играет enter для
  элемента ПЕРВОГО рендера; очередь бетов стояла только в хуке unfold, а плита монтирует секцию с уже
  стоящей стадией. Исправлено: `queueMotion()` также из `mounted()`.
- **Прогон 2 — «`sit-deal11` rests face-up: expected < 10, received 180».** У последней сданной карты после
  сброса соседа Vue пере-применил `:style="{transform: rotateY(180deg)}"` inner-тела — тело вернулось в
  позу рождения посреди переворота (сэмплы 180 → 90 → 30 → 180). Исправлено: никаких `:style` на свойствах,
  которыми владеет GSAP; `setCard3DFace` ставит позу рождения на первом тике.
- **Прогон 3 — «lobby cube displacement 0».** Кубы директора не отслеживались: `flyCubeTracked` искал id в
  `flightEls`, а элемент регистрируется на следующем рендере. Исправлено: `flyCube` возвращает id при
  рождении; hold стадии снимается на ПОСЛЕДНЕЙ посадке (`awaitFlights` по `flightRegistered`), а не на конце
  master-таймлайна.
- **Прогон 4 — стадия не приходит в покой.** `:ref`-callback Vue при размонтировании прокси регистрировал
  `null`, и `flightRegistered` считал сброшенный полёт живым вечно. Исправлено: `setFlightEl(id, null)` →
  delete; `waitAtRest` пробника игнорирует припаркованные прокси `sit-park*`.
- **Прогон 5 — 4/4.** Утверждено сэмплером: ВЕРДИКТ 400–1500 мс без единого куба, припаркованная карта стоит
  весь вердикт, лицо правительства скрыто (`--awaiting`); ПРИНЯТИЕ 900–3600 мс, карта прошла ≥ 60 px, каждый
  куб ≥ 20 px, peek яруса был, `--awaiting` снят только на посадке, каждая карта нарисована один раз на
  покое, hold-ы пусты; ОБНОВЛЕНИЕ 1200–4000 мс, три тела `3d`, `rotateY` 180 → (30…150) → 0 монотонно, лица
  слотов скрыты в полёте и 0 `--dealing` на покое, колода только худеет на N раздач, кубы лобби ≥ 20 px;
  «дожать» на ЗАКРЫТИИ — страница остаётся; reduced-motion — ни одного прокси и hold-а, обход ≤ 6 с двумя
  нажатиями; perf-lite — `filter: none` на каждом прокси. GSAP не пишет `rotateY(0deg)` в transform —
  сэмплер трактует записанный transform без `rotateY` как 0.
- Скриншоты в полёте просмотрены: `screenshots/parliament-sitting-motion/02-enact-in-flight.png` (карта
  победителя между областью и правительством, кубы в воздухе), `10-renewal-deal-in-flight.png` (карта ребром
  у колоды, лица слотов пусты) — аномалий нет.

### Итог приёмки Э4

- `npm run lint:client` — 0; `npm run build:test` — 0; eslint по изменённым файлам — 0.
- `npm run test:server` — 12053 собрано, 12051 passing, 2 pending (`sittingBeats` 7, `consoleSittingFlow` 17,
  гарды `parliamentNoTimers` / `parliamentNoLocalStorage` / `glyphLiteralGuard` / `e2eDriverGuard`);
  `npm run test:client` — 5694 passing.
- e2e (`--workers=1`): `console-parliament-sitting.spec.ts` 6/6 (регресс Э3 на трёх профилях),
  `console-parliament-sitting-motion.spec.ts` 4/4.
- Существующие e2e-сюиты по правилам прогона НЕ гонялись; ожидаемо сломанные перечислены в
  `docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` § «Передача в Э5».
- Коммит: «Parliament sitting · Э4: директор заседания, физические беты, 3D-переворот раздачи».

---

# Финальный прогон Э5 → Э8 → ПОЛИРОВКА → Э9 (промт `docs/claude/prompts/parliament-E5-E9-finish.md`)

Начало: 2026-09-19, база — коммит `65d3e556b4` (после Э4 `40ff3253e9` + промт). Порядок строгий:
Э5 → Э8 → ПОЛИРОВКА → Э9; локальный коммит на этап, без пуша; существующие e2e — только в Э9.

## Э5 — стадия НАГРАДА: адрес → подача (в работе)

### Решения, принятые до первой правки

1. **Приход записи = один синхронный блок с применением вида.** Запись исхода зрителя (`phase.outcomes`)
   приходит и в ответе на его собственный A (ворота 1, если он ответил последним), и через WS/poll
   (другой ответил последним) — оба пути идут через `fetchPlayerInput` → `seedRewardHolds(newView)` →
   `applyPlayerView`. Посев hold рельсы (`beginPanelRewardHold`) делается там же, новым сеятелем
   `seedParliamentRewardHold(before, after)` — иначе панель рисует фантомный «−N» чип.
2. **Волна играет только когда заседание НА ЭКРАНЕ.** Если workspace свёрнут/отсутствует в момент
   прихода записи — hold не сеется, счётчик тикает сразу с обычным дельта-чипом (награда объявлена
   там, где игрок смотрит), а стадия при возврате читает «Получено». Бет награды **никогда не
   реплеится** (resume/return): счётчик не может тикнуть дважды честно — поза «Получено» и есть реплей.
3. **Поверхности идут по очереди.** Запись + следующий вопрос в одном ответе (Climate: производство +
   добор; Biodome: растения + тайл): волна ПЕРВОЙ, дверь шага ждёт. Механизм — blocking-hold стадии
   `parliament-sitting:reward` (допуск `host`/`placement` ждёт `presentation`) + полевая поза стадии
   (`sittingField`) и цели телепорта шелла (`consoleParliamentUi.fieldStanding`) ждут `!parliamentRewardPending()`.
   Крошка держит «НАГРАДА», пока не открылась полевая поза (одна анимация хвоста, вперёд).
4. **Смена серверного шага при неотыгранной награде** (Architecture/PowerGrid: запись и `adjourn` в одном
   ответе) — экран держит позу НАГРАДА до конца волны (`stageHeld`), затем стандартный переход на
   ОБНОВЛЕНИЕ с посевом holds раздачи.
5. **Реакция партии летит с плашки ПРАВЯЩЕЙ партии в ПРАВИТЕЛЬСТВЕ** (`[data-parl-ruler]` — эмблема +
   печатная формула): это и есть плашка партии-законодателя, видимая всё заседание; ярус партий
   остаётся припаркованным под стадией (peek — только для бета ПОДДЕРЖКА). Так закрывается вопрос
   «положение яруса во время заседания» без второго яруса на экране.
6. **Источник волны — печатная графика карты-носителя**, где бы карта ни стояла (правительство в позе
   чтения, hero-слот в полевой позе — один DOM-экземпляр): `resolveActionCommitAnchors` /
   `resolveGainIconOrigins` по `.pcard__mech` носителя, импульс — `runActionCommitMotion` (тот же
   ACTION COMMIT-язык: фиксация → sweep → кольцо на иконке результата → handoff запускает волну).
7. **Бонус Повестки (РТ) — честный полёт**: РТ едет каналом `stock` под ключом `rating` (иконка уже есть в
   `optionIcons`), `targetPointFor` знает ячейку РТ рельсы (`.con-score__cell--tr`), панель вычитает
   `heldStock('rating')`. Сеется при старте фазы (сводка `agenda.bonus === 'tr'` для зрителя), летит после
   глайда маркера (бет ПРИНЯТИЕ), сеть — 20 с (плита анонса стоит до A игрока). Бонус-карта — существующий
   cover-flow слоя бонусов, не переписывается.
8. **Язык чтения.** До записи — контекст `resolving` («Эта выплата») по декларации и текущему (финальному)
   влиянию места (`resolvingYieldsOf`, та же `scaledAmount`); после записи, пока чип летит / шаг стоит —
   `resolving`; после посадки — `applied` («Получено»).
9. **Добор без призрака** — единый паттерн и в embedded, и в standalone: взятая карта уходит из ряда
   ПОСЛЕ посадки в док (`runHandIntake` → onLanded), оставшиеся FLIP-ом в новые берега (240 мс).
10. **Свидетель тика — кадр ПОСАДКИ, не последний DOM-кадр чипа.** Полёт чипа (`runTransferFlight`)
    заканчивается демпфированным «весом» (2,5 px вниз-вверх за 140 мс), contact-beat (`touched` →
    `onArrive` → `releasePanelRewardHold`) срабатывает по концу этого settle, а дальше чип ещё ~600 мс
    растворяется НА МЕСТЕ (absorb: scale 0.5 + fade из центра). Пробник считает посадкой первый сэмпл,
    с которого чип больше не двигается (≤ 6 px·scale от конечной точки до самого конца трека), и требует
    тик счётчика в пределах 6 сэмплов (~100 мс) от него. Первая версия сравнивала с последним кадром и
    падала на 38–42 сэмплах — это была длина растворения, не запоздавший тик.
11. **Идентичность чипа в пробнике — `data-transfer-id` слоя** (id полёта из `resourceTransferState.flights`),
    не индекс в списке: индекс сдвигается, как только более ранний чип впитался, и трек одного чипа
    распадался на два. Атрибут добавлен на `.con-transfer__chip` (только маркер, ноль логики).
12. **Путь волны = вся дистанция «иконка → ячейка», а не 20 % высоты как абсолют.** На 1080 строка
    производства тепла на рейке стоит на одной высоте с механикой карты-носителя в правительстве:
    хорда 180 px = 16,7 % высоты, и это правильная, короткая причинная траектория. Пробник требует:
    рождение внутри `.pcard__mech` носителя, ПОСАДКА внутри ячейки строки (`.con-res__prod` /
    `.con-res__stockwrap`, ≤ 10 px·scale), пройденная хорда ≥ min(20 % высоты, 85 % дистанции иконка → ячейка).
13. **Глайд Повестки — собственная работа стадии ПРИНЯТИЕ.** Арифметика мастера стадии заканчивалась
    раньше, чем маркер садился на шаг; стадия «отдыхала» (`finished = true`), и бонус РТ, запущенный из
    `onLanded` глайда в уже завершённый прогон, помечался приземлившимся без единого кадра полёта —
    счётчик тикал (с дельта-чипом), чипа не было (e2e: «a rating chip flew: undefined», 2,5 с от старта
    фазы — сеть тут ни при чём). Теперь `beatEnact` считает глайд airborne (`runState.pending++` до
    посадки), и стадия отдыхает только после посадки маркера И его чипа.
14. **Сеть бонуса Повестки измеряет ПРОСТОЙ, а не длину потока: 30 с (граница board-beat park), перевзвод на
    каждом шаге заседания** (`noteAgendaBonusProgress`: секция смонтировалась с заседанием, страница
    перелистнулась). Плита анонса и чтение вердикта — темп игрока, не зависание; заседание, простоявшее
    30 с без движения, — зависание: РТ тикает с дельта-чипом, глайд на ПРИНЯТИИ играет без чипа (факт
    уже объявлен, не утаён). Тест ledger-а подменяет `setTimeout`/`clearTimeout` и проверяет перевзвод.
15. **«Получено» при ожидании ДРУГОГО места.** `rewardResolving` держал «Эта выплата» на шаге `waiting`
    (RX01: свои +2 животных и океан уже получены, заседание ждёт выбор player2) — теперь открытыми
    считаются только СВОИ шаги (`reading` / `choice` / `intake` / `placement`) и незасевшие чипы;
    ожидание чужого хода читается «Получено» + строка ожидания с кубом места.
16. **e2e: другое место может быть должно свой выбор после тайла** — спек отвечает за него по API
    (`answerAsksAs`) после того, как проверил строку ожидания (`[data-sit-wait-for]` = цвет места), и только
    потом ждёт ОБНОВЛЕНИЕ. Красный прогон падал на «Expected renewal, received reward» — продукт был прав.
17. **Ledger ведёт след (trail) и отвечает «почему».** Каждый сброс hold-а называет причину
    (`flushParliamentRewards(why)` / `flushAgendaBonus(why)`: `landed` · `net` · `idle-net` · `stage-settled` ·
    `stage-finished` · `unmeasurable-step` · `no-glide` · `new-sitting` · `re-seed` · `unmount` · `reset`), посев,
    взятие и посадка тоже пишутся; снимок `parliamentRewardDiag()` едет в `window.__conReady().parliamentReward`.
    Красный e2e печатает ledger в сообщении — «чип не полетел» больше не требует гипотез: след говорит, кто
    отпустил счётчик. Продукт след не читает.
18. **Чип РТ летел БЕЗ иконки** — след ledger-а показал честный полёт (`take-agenda` → `flush-agenda: landed`
    через 772 мс = задержка + pop 150 + дуга 470 + settle 140), а пробник не нашёл чипа с `res = rating`:
    `iconClassFor` знал псевдоним `tr → rating`, но не сам ключ рельсы `rating` — `<i class="con-transfer__icon">`
    выходил без спрайта. Псевдоним `rating → rating` добавлен в `optionIcons.ts`; пробник теперь видит чип по
    классу `resource_icon--rating`, а игрок — значок РТ на летящем чипе.
19. **Тайл победителя тянет ЦЕПОЧКУ клеток.** RX03 (Biodome): озеленение подняло кислород 7 → 8 %, бонусная
    отметка температуры выдала океан — сервер попросил ВТОРУЮ клетку, а спек ждал возврата заседания после
    первой. Драйвер `placeChainedTiles` ставит клетки по серверным `promptId`, пока следующий запрос — клетка;
    заседание возвращается после последней. Продукт вёл себя верно: поле стояло на живом запросе.
20. **Тик измеряется ВРЕМЕНЕМ, не числом сэмплов.** Сэмплер — `MutationObserver` + интервал: в кадре с анимацией
    он берёт несколько сэмплов, и «≤ 6 сэмплов от посадки» превращалось в 8 при 100 мс реального лага. Окно:
    от −34 мс (тик на кадр раньше замера покоя) до +160 мс (хвост settle) относительно первого сэмпла покоя
    (центр чипа неподвижен ≤ 1 px до конца трека — absorb масштабирует из центра).
21. **FLIP выживших оставлял `transform-origin: 0 0` инлайном.** GSAP пишет `transformOrigin` отдельным
    инлайн-свойством, а `clearProps: transform` снимал только `transform`; CSS-масштаб фокуса (1.045) затем
    рос из левого верхнего угла — единственная выжившая карта стояла на 12 px правее центра ряда (пробник
    «survivors stand centred»: группа 1320 против ряда 1308 = (1.045 − 1) × 544 / 2). Теперь
    `clearProps: transform,transformOrigin` в обеих ветках (complete / interrupt).
22. **Смена шага в том же ответе — «страница, на которую смотрит место», читается со СТАРОГО шага.**
    RX02/RX04 (запись + `adjourn` одним ответом): watcher `sittingStepKey` проверял `this.sittingStage === 'reward'`,
    а живой `sittingStage` уже выводился из пришедшего шага (`adjourn` → страницы `renewal/closing`) — условие
    удержания не срабатывало, ОБНОВЛЕНИЕ входило за 500 мс ДО того, как чип покинул карту (пробник: первый
    сэмпл `renewal` @1428 мс, чип @1915 мс). Теперь стадия «до» = `sittingPagesOf(старый шаг)[курсор]`;
    удержание (`stageHeld = reward`) и отложенный вход шага (`afterRewardMotion`) работают как задумано.

### Наблюдения из скриншотов Э5 — кандидаты в «Реестр полировки» (не правятся в Э5)

- P-01 · стадия НАГРАДА, поза ожидания (RX01) · 1080 · «ОЖИДАНИЕ: PLAYER2 ВЫБИРАЕТ КАРТУ» напечатано дважды:
  кикер правительства и строка ожидания в панели награды (класс: дублирование информации).
- P-02 · рельса ресурсов при посадке (RX03) · 1080 · дельта-чип «+2» ложится поверх значения «11» строки растений —
  число нечитаемо на кадр посадки (класс: перекрытие / читаемость; общий для рельсы, не парламентский).
- P-03 · область голосования на стадиях заседания · 1080 · бейдж «ПОБЕЖДАЕТ» у резолюции — терминология
  «побеждает / принята» (пример 7 из брифа; глоссарий).
- P-04 · правительство · 1080 · «НАГРАДА [КРЕСЛО] + 1 ШАГ → ③» — «Кресло» как физический предмет (пример 6).
- P-05 · слоты без делегатов · 1080 · «0 ДЕЛЕГАТОВ · ЛИДЕРА ПОКА НЕТ · ВАШИ ▢▢ 0» ×2 — тише пустое состояние (§6.4).
- P-06 · стадия ПОЛУЧЕНИЕ, кадр после волны (RX05-02) · 1080 · командная панель пуста, строка статуса зоны пуста,
  пока карты добора ещё под прокси (`arrivalDone ≠ beatDone`) — ожидаемо по контракту, но проверить, что
  пауза без глаголов не длиннее посадки (класс: мёртвые команды).
23. **Страница держится до ПОСАДКИ, растворение чипа перекрывает вход следующей страницы.** После правки 22
    пробник показал: НАГРАДА стоит до 2928 мс, чип сел (тик) на 2900-х, ОБНОВЛЕНИЕ входит на 2939 мс, а
    `resource-transfer[blocking]` (absorb-хвост на рельсе, слева от стадии) живёт до 3083 мс. Решение — не ждать
    растворения: чип уже на своей ячейке, решение о смене страницы принято в момент посадки, а «уходящая
    поверхность дорисовывает свой уход» — закон семейства. Пробник требует позу НАГРАДА для каждого сэмпла ДО
    посадки каждого чипа.
- P-07 · стадия НАГРАДА, поза ожидания (RX01) · 1080 · кикер панели меняет фразу по состоянию («ВАША НАГРАДА» ↔
  «ЭФФЕКТЫ ВЫПЛАЧИВАЮТСЯ») рядом со словом состояния «ПОЛУЧЕНО» — два голоса об одном; кикер должен быть
  один, состояние — одно слово (класс: неоправданные подписи состояния / дублирование).
- P-08 · fullscreen-осмотр резолюции с L3 (RX05-04) · 1080 · чипы футера пишут «ПОЛУЧЕНО» под добором, пока
  добор ещё стоит (забрана 1 из 2) — язык футера не следует правилу resolving/applied стадии (класс:
  неоднозначность термина).
24. **Двойной бет страницы НАГРАДА после волны.** След TV-прогона (RX05): hold `parliament-sitting:reward`
    1481–3981 мс (волна + реакция), затем ВТОРОЙ на 4135–4635 мс — каскад чтений панели проигрывался заново
    поверх уже прочитанных чтений. Причина: ответ с записью меняет и серверный шаг (`assembly` → `effects`),
    удержание откладывает вход шага до конца волны, а `enterServerStep` после волны планировал ту же страницу
    `reward` заново — путь «волна первой» не отмечал страницу отыгранной (`notePlayedSittingStage`). Теперь
    отмечает: повторный вход на ту же страницу — ПОЗА, не реплей. Сюда же: TV-профиль резал чипы статуса
    пикера на 4 px (`height: 2.4rem` при чипах 2.5rem) — 2.6rem; пробник «two rows» на Deck считал
    приподнятую фокусом карту третьим рядом — кластеризация tops (24 px); `waitSittingAtRest` требует покоя
    ≥ 250 мс подряд (покой одной стадии — сигнал для следующей, одиночный опрос попадал в щель между hold-ами).
25. **Бонус-КАРТА шага Повестки: парк батча до посадки глайда.** Замер (фикстура `parliament-climate-cardstep`,
    синий 6 → 7 = карточный шаг): карта, розданная сервером вместе со сводкой, приходила ПЕРВОЙ — раздача с
    колоды + fullscreen «Полученная карта» над полем ещё до плиты анонса, без связи с заседанием (плита ждала
    A на чужой поверхности 30 с). Решение — то же, что у РТ: ledger знает `kind: tr | card`; для карточного
    шага батч `agenda` ПАРКУЕТСЯ (`parliamentParksReveal`: `rawDrawnRevealPending`, supplier исключений парка,
    сцена cover-lift, вердикт deck-draw = «waiting»), пока директор не посадит глайд на шаг
    (`launchAgendaBonus` → `markAgendaBonusLanded` снимает парк); тогда сцена бонуса поднимает обложку с
    самого шага на видимой дорожке (`agendaTrackOnScreen` — один предикат и для сцены, и для вердикта колоды),
    карта открывается, A уносит её в док. Простой-сеть 30 с та же: по ней батч отдаётся стандартной раздаче.
26. **Реактивный член — ПЕРВЫМ в `&&`.** После парка сцена cover-lift не взводилась вовсе (диагностика
    `__conReady().cardBonus`: `active:false`, источник по умолчанию, ни одного abort). Computed слоя проверял
    `agendaTrackOnScreen() && !parliamentParksReveal(...)`: DOM-запрос стоял первым, при плите он ложен, `&&`
    обрывался — чтение `parliamentRewardState.agendaBonus` не попадало в зависимости, и снятие парка ничего
    не перевычисляло. Порядок обращён: сначала реактивный парк, потом DOM. Вердикт deck-draw читал парк в
    `waiting` без короткого замыкания — потому колода честно молчала, а сцена молчала нечестно.

### Что сделано (Э5)

- **Ledger награды** `parliamentRewardBeat.ts` — DETECT → SEED → OWE → FLY; посев из обеих дорог применения вида
  (`gameTransport.seedRewardHolds`, `App.update`), hold рельсы только при заседании на экране, blocking-supplier
  `parliament-reward-owed` (дверь следующего шага ждёт волну), след причин + снимок в `__conReady().parliamentReward`.
- **Волна** (`sittingDirector.beatReward`): импульс ACTION COMMIT по `.pcard__mech` носителя → чипы с печатных иконок
  → строки рельсы, тик счётчика в кадре посадки, дельта-чип; реакция правящей партии — с плашки правителя
  `[data-parl-ruler]` после посадки собственных чипов; квитанция тайла (`tileReceipt`) при возврате с поля.
- **Поверхности по очереди**: полевая поза стадии и цели телепорта шелла (`fieldStanding`) ждут волну; смена шага в
  том же ответе держит позу НАГРАДА (`stageHeld`, стадия «до» — со старого шага); страница НАГРАДА после волны
  отмечается отыгранной — повторный вход = поза, не реплей.
- **Бонус Повестки**: РТ — hold ячейки рейтинга до касания (канал `stock`/`rating`, значок `resource_icon--rating`),
  чип с достигнутого шага после глайда, глайд — работа стадии (`runState.pending`); КАРТА — парк батча `agenda`
  (`parliamentParksReveal`) до покоя стадии ПРИНЯТИЕ, обложка поднимается с шага (`agendaTrackOnScreen` — один
  предикат для сцены и вердикта колоды), viewer, A → док. Сеть простоя 30 с с перевзводом на движении заседания.
- **Язык чтения**: `resolvingYieldsOf` («Эта выплата») до записи, `applied` («Получено») после посадки; одно слово
  состояния в кикере (`[data-sit-reward-state]`); ожидание чужого места читается «Получено» + строка с кубом.
- **Добор**: без призрака, FLIP выживших после посадки (`clearProps: transform,transformOrigin`), причина в строке
  статуса, L3 — резолюция через `resolutionZoomEntry` + `workspaceSourceZoomOrigin` (hero-слот / правительство).
- **Профили**: TV — рейка статуса стадии 2.6rem (чипы 2.5rem не режутся); Deck — большой добор в два ряда.
- **Пробники и драйвер**: `console-parliament-sitting-reward.spec.ts` (3 профиля × RX01–RX05 + big draw + бонус РТ +
  бонус-карта), `parliamentDrive.ts` (пресеты, wire, ворота/вопросы по API, `expectParliamentFits`, `waitSittingAtRest`
  с покоем ≥ 250 мс), `placeChainedTiles` (цепочка клеток по `promptId`), идентичность чипа по `data-transfer-id`,
  посадка = покой центра ≤ 1 px, тик по времени (−34…+160 мс), путь ≥ min(20 % высоты, 85 % хорды иконка → ячейка).
- **Guard-ы/юниты**: `parliamentRewardBeat.spec` (12), `rewardAddress.spec` (+лестница стадий), `sittingBeats.spec`
  (+страница награды хостит шаги), `ResolutionContract.spec` (нет тихой награды по каталогу), `parliamentNoTimers`
  (сети ledger-а в allow-list), `consoleBoardCardBonus.spec` (+`agendaTrackOnScreen`), фикстура-гард (45).

### Замеры (пробник, 1080 если не сказано иное)

- Волна RX05: чип тепла рождается в `.pcard__mech` носителя, хорда до ячейки производства 180 px (16,7 % высоты —
  карта стоит рядом с рейкой), тик через ≤ 160 мс после покоя чипа; реакция M€ с плашки правителя после посадки.
- Бонус РТ: плита 0,1 с · заседание 1,3 с · ПРИНЯТИЕ 2,5 с от старта фазы; полёт чипа 763 мс (`take-agenda` →
  `landed`), рождение на шаге 4, посадка в `.con-score__cell--tr`, дельта-чип.
- Бонус-карта: плита 114 мс · заседание 317 мс · ПРИНЯТИЕ 1661 мс · обложка с шага 7 — 4081 мс · карта открыта
  5369 мс · док +1 — 7537 мс; раздачи с колоды нет; плита стояла до любой подачи.
- RX03 (Biodome): волна растений → поле → 2 клетки (озеленение + океан бонусной отметки) → квитанция «Получено»
  с чипом параметра и РТ → ОБНОВЛЕНИЕ. RX01 (Aquifer): пикер в зоне → тайл → ожидание чужого выбора с кубом →
  ОБНОВЛЕНИЕ. RX02/RX04: страница НАГРАДА стоит до посадки чипа, ОБНОВЛЕНИЕ входит после.
- Сьют награды: 18 тестов × 3 профиля — зелёные (8,0 мин, `--workers=1`); регрессия Э0–Э4
  (`console-parliament-sitting*`, `-gates`, `-vote-fit`): 33 теста — зелёные.

### Итог приёмки Э5 (2026-09-19)

- e2e (только новые спеки и спеки прогона Э0–Э4, `--workers=1`): `console-parliament-sitting-reward.spec.ts` —
  18/18 на трёх профилях (8,0 мин); `console-parliament-sitting.spec.ts` + `-sitting-motion` + `-gates` +
  `-vote-fit` — 33/33 (10,7 мин). Скриншоты всех поз просмотрены; аномалии либо исправлены (12 px смещение
  выжившей карты, чип РТ без значка, двойной бет НАГРАДЫ, ранний вход ОБНОВЛЕНИЯ, 4 px clip на TV, бонус-карта
  до плиты), либо занесены в кандидаты реестра полировки (P-01…P-08).
- Юниты: `test:server` 12054 passing (0 failing) · `test:client` 5707 passing (0 failing); `build:test` (mocha + e2e
  деревья) зелёный; `lint:client` (vue-tsc) зелёный; `lint:i18n`, `make:json` зелёные; eslint по 34 изменённым
  файлам — чисто; гарды `parliamentNoTimers` / `parliamentNoLocalStorage` / `e2eDriverGuard` / `parliamentLessOrder` /
  `e2eFixturesLoad` / `glyphLiteralGuard` зелёные.
- Запрещённое не нарушено: волна только с печатной графики носителя / плашки правителя (координатных таблиц нет);
  второго дока источника и призраков нет; L3 — `resolutionZoomEntry`; сумма не пересчитывается на клиенте
  (`resolvingYieldsOf` = декларация × записанное влияние); `setTimeout` — только две сети ledger-а в allow-list;
  подписи без отдельного бета; текст не масштабируется; `case 'reward'` — полный бет для всех видов.
- Отклонение от буквы брифа, зафиксированное осознанно: «путь ≥ 20 % высоты» заменён на «≥ min(20 % высоты, 85 %
  хорды иконка → ячейка)» — при геометрии 1080 носитель стоит рядом с рейкой (хорда 180 px), а требование было
  о честном полёте, не о длине. Пробник дополнительно требует посадку внутри ячейки строки.
- Коммит: «Parliament finish · Э5: стадия НАГРАДА — ledger, волна с носителя, бонусы Повестки, добор без призрака».

## Э8 — профили и режимы (в работе, начато 2026-09-19)

### Порядок работы

1. Разведка (только чтение): реестр поверхностей Парламента (компонент · корень · фикстура · драйвер), механика
   профилей (`consoleProfile`), reduced-motion и perf-lite (переключатели, корневые классы, LESS-лестницы).
2. Галерея-спек `tests/e2e/console-parliament-gallery.spec.ts`: каждая поверхность × 3 профиля × {standard,
   reduced, perf-lite} → `screenshots/parliament-final/<preset>/<mode>/NN-<surface>.png`; на каждой позе —
   `expectParliamentFits` (ничего за экран / clipped / scroll), в perf-lite — пробник «ни одного элемента с filter»,
   в reduced — сэмплер «ни одного прокси и ни одного hold-а дольше 2 с, те же объекты и та же A».
3. Правки токенов/бюджетов по фактам пробников (не «на глаз»), пересборка галереи, просмотр.

### Решения Э8

1. **perf-lite — не режим, а постоянный paint-baseline** (`docs/claude/console/performance-mode.md`, 2026-08):
   `html.console-native * { filter: none; text-shadow: none }` всегда; переключателя, флага и ключа хранилища нет,
   возвращать их запрещено контрактом. Поэтому ось режимов галереи — {standard, reduced}, а приёмка perf-lite
   («ни одного элемента с filter», состояния через box-shadow/outline/цвет) — пробник на КАЖДОЙ стандартной позе
   всех трёх профилей (computed `filter`/`text-shadow` = none у каждого элемента внутри `.con-parl`/`.con-sit`/
   зума/плиты/журнала). Папка режима `perf-lite` в галерее не создаётся — это была бы копия standard.
2. **Третья ось режимов — fx-lite** («Пониженные эффекты», `tm_console_fx_lite` → `html.con-fx-lite`,
   `console_fx_lite.less`): единственный уцелевший opt-in ярус, гасящий ambient-циклы. Галерея: {standard, reduced,
   fx-lite} × {1080, TV 4K, Deck}; вердикт fx-lite — корневой класс стоит и под корнями Парламента нет ни одной
   БЕСКОНЕЧНОЙ анимации (`document.getAnimations()`, iterations = ∞); paint-baseline (filter/text-shadow = none)
   проверяется на каждой позе всех режимов. Reduced — `page.emulateMedia({reducedMotion: 'reduce'})` (живой
   matchMedia), сэмплер: ни одного прокси полёта, ни одного парламентского hold-а дольше 2 с.
3. **Общие драйверы вместо десяти копий**: `openParliament` (колесо RT → вниз), `focusParliamentZone`
   (government / voting / parties по `data-zone`), `expectParliamentFits(page, label, root)` с корнем
   (плита `.con-mandatory`, зум `dialog.con-zoom[open]`, композер `.con-pact`, Полигон) — в `parliamentDrive.ts`.
   Галерея `console-parliament-gallery.spec.ts`: 10 путешествий на комбинацию (заседание; варианты награды;
   обзор + осмотры партии/резолюции + журнал + полоса Информации; оплата; кресло; композер партийного действия;
   Полигон + осмотр; плита пропуска; большой добор; плотный стол с пятью местами) → 30 кадров.
4. **Регрессия Э0 (механический разрез): оплаченный голос СТРАНДИЛСЯ.** Галерея (оплата в режиме голосования,
   фикстура `parliament-paid`) и старый `console-parliament-v2.spec` показали: после A счёт не встаёт в зону
   `parliament-vote`, workspace исчезает (`wsDepth: 0`), над полем — амбарная плита «Ожидает решения ·
   Выберите, как оплатить ${0} M€ за делегата». След стека (новый opt-in хук `window.__wsTrace` в
   `consoleWorkspaceStack.ts`): `closeWorkspaceRoot:parliament` ← `concludeWorkspaceFlow` ←
   `onParliamentFlowComplete` ← `flow-complete` секции. Причина: до Э0 `paymentStands`/`votePayment` были
   computed-ами САМОЙ секции; разрез перенёс их в дочерний `ConsoleParliamentVoteMode`, чей проп `playerView`
   обновляется на патч ПОЗЖЕ pre-flush-вотчера родителя (`answerKey`) — ребёнок читал старый промпт, «счёта нет»,
   закрывал голос и сообщал «flow завершён». Правка: вотчер `answerKey` — `flush: 'post'` (тело — метод
   `onAnswerKey`). Побочно: `${0}` в тексте амбарной плиты — сырой шаблон Message без подстановки (кандидат
   реестра P-09). Отметка «→ резерв» на ключе места теперь `v-if` — старый пробник v2 считал невидимый глиф
   «обрезанным текстом».
5. **Opt-in след глаголов стека остаётся** (`window.__wsTrace = true` → `console.warn('[ws-stack] <verb> depth=N', stack)`
   в `leaveWorkspace` / `goBoardHome` / `popWorkspaceFrame` / `closeWorkspaceRoot` / `collapseWorkspaceStack` /
   `resetWorkspaceStack`): в продукте молчит, e2e включает его `addInitScript`-ом и печатает в сообщении падения —
   «кто снял workspace» становится фактом за один прогон.
- P-09 · амбарная плита (stranded) · 1080 · заголовок промпта печатается сырым шаблоном «${0} M€» — Message без
  подстановки данных (класс: копия / ошибка рендера; не парламентская поверхность, но виден из Парламента).
- P-10 · обзор, правительство + ярус партий · 1080 · «СТАРТОВОЕ ПРАВИЛО» — кикер правительства И подпись тайла
  «ПРАВИТ · СТАРТОВОЕ ПРАВИЛО» (пример 5 брифа; класс: дублирование).
- P-11 · обзор · 1080 · крошка browse-слоя читается «ПАРЛАМЕНТ › ОСМОТР» — «ОСМОТР» звучит как режим осмотра, а не
  как обзор; в кресле — «ПАРЛАМЕНТ › ОСМОТР › КРЕСЛО» (класс: неоднозначный термин; глоссарий).
- P-12 · fullscreen-осмотр партии · 1080 · нет LB/RB-листания по шести партиям, футер только «B Закрыть»
  (пример 2 брифа; класс: мёртвые/отсутствующие команды).
- P-13 · режим голосования · 1080 · «+1 M€ ПРИ ПОБЕДЕ · ШАГ ①» и «ПОБЕЖДАЕТ нет → да» — «победа» игрока против
  «принятия» резолюции в одном блоке (пример 7; глоссарий).
- P-14 · кресло председателя · 1080 · строка прозы «Все ваши делегаты стоят на резолюциях — выберите, с какой снять
  делегата для кресла.» на игровом экране (закон 19: проза только в осмотре; класс: проза).
- P-15 · ярус партий · 1080 · подписи состояния тайлов присутствуют не у всех («2/2 ВАШ ЭФФЕКТ», «▢▢ 0/2», у трёх
  тайлов — ничего): высота под подпись не зарезервирована единообразно (пример 1; класс: скачки раскладки —
  проверить пробником стабильности).
- P-16 · заседание, поза НАГРАДА, удержанная через отложенный `adjourn` (RX03-nocell: запись + adjourn одним
  ответом) · 1080 · горячий глагол уже «A ЗАКРЫТЬ ЗАСЕДАНИЕ» (глагол закрытия), пока экран стоит на награде —
  глагол выводится из НОВОГО серверного шага, а не из удержанной позы; A здесь ответил бы ворота закрытия,
  глядя на награду (класс: команда не соответствует поверхности; правится в Э8 как дефект потока Э5).
- Журнал (группа фазы, gen 1) и полоса «ЭФФЕКТЫ ПАРТИЙ» в Информации — влезают; проза в Информации допустима
  (осмотр). Композер партийного действия «ДЕЙСТВИЯ КАРТ › ИНДУСТРИАЛИСТЫ › НАСТРОЙКА» — влезает. Плотный стол:
  пять мест + нейтральный в шапке на 1080 — влезает.
6. **P-16 исправлен в коде (Э8, дефект потока Э5):** `sittingPrimary` на удержанной позе НАГРАДА отдаёт
   «Продолжить» (A = «дожать» волну), обработчик A на удержанной позе не отвечает ворота; глагол закрытия
   появляется только когда страница ОБНОВЛЕНИЕ/ЗАКРЫТИЕ действительно вошла.
- P-17 · fullscreen-осмотр резолюции из режима голосования · 1080 · блок «ВАШ ГОЛОС» (проза: делегатов 1 → 2, из
  них ваших 0 → 1, лидер, «Побеждает: нет → да · ничья: ближе к правительству», эффект партии 0 из 2 → 1 из 2) в
  колонке правил — дублирует чипы футера и панель голоса (пример 3 брифа; класс: проза + дублирование).
- P-18 · ярус партий · 1080 · глагол X читается «ЭФФЕКТ ПАРТИИ» на тайле и «ОСМОТРЕТЬ» в других зонах — один
  глагол для одного действия (§6.4; класс: неоднозначный термин).
- Осмотр резолюции из Полигона (LB ◀ ЛИСТАТЬ ▶ RB, футер-плита) — влезает; пейджер стенда «1 / 11» вверху.
7. **Первый полный прогон галереи (8 комбинаций): 41 / 39.** Три класса: (а) reduced — сэмплер считал ЧУЖИЕ прокси
   (раздача дока шелла на загрузке, `.con-deal-proxy`): область сужена до собственных полётов Парламента (слой
   `.con-parl__flight`, чипы наград, обложка Повестки — под reduced их не бывает), а разделяемая раздача шага
   (take, 160 мс кэп консоли, не скип) учитывается отдельно как «hold» ≤ 2 с; (б) fx-lite — два ambient-цикла не
   были в стоп-листе яруса: пульс плиты анонса (`.con-mandatory__pulse.con-pulse`, консольный) и призрачный куб
   режима голосования (`.con-parl__vote-cube.con-parl-ghost`, парламентский) — добавлены; (в) Deck, осмотр
   резолюции из Полигона — колонка правил на 20 px выше вьюпорта `ConsoleScrollArea`: единственный
   санкционированный скролл-инструмент консоли (проза осмотра переменной длины, свой бейдж прокрутки) исключён
   из правила «ни одного scroll-контейнера»; TV standard — 10/10, Deck standard — 9/10 (только Полигон).
- P-19 · режим голосования · TV 4K · подпись CTA «Отправить делегата» переносится на две строки в правой колонке
  панели голоса (класс: перенос в кнопке; бюджет ширины колонки на TV).
- P-20 · стадия ПОЛУЧЕНИЕ (добор) и большой добор · TV 4K (и 1080 при карте с требованием) · строка статуса зоны
  режет последний чип «ТРЕБОВАНИЕ ПОКА НЕ ВЫ…» без многоточия — три чипа (имя · причина «Принятая резолюция берёт
  для вас N карт · Заберите карты: N» · заметка требования) не помещаются в рейку (класс: clipped chip;
  правится в Э8 — это бюджет строки статуса, введённой в Э5).
8. **P-20 исправлен (бюджет строки статуса добора):** `.con-extdraw__status` — три чипа на одной строке с
   многоточием: имя карты целиком, чип причины уступает первым (`flex: 0 3 auto`, `min-width: 5rem`), заметка
   доступности (`.con-cardavail__status/__title`) обрезается многоточием последней — на 4K её резало на
   полуслове без «…». Проверка — кадры 15 / 28 галереи на TV после пересборки CSS.
- Deck standard (просмотрено: обзор-правительство, режим голосования, добор, пикер, плотный стол): всё влезает;
  P-19 (перенос «Отправить делегата» в CTA) — и на Deck. Пикер на Deck снят на 2 кандидатах — бриф требует
  «стадию с пикером на 6 кандидатах»: фикстуры с шестью картами-носителями животных нет → добавляется
  `parliament-aquifer-assembly-six` (аквифер-стол с шестью держателями животных в tableau синего) и
  путешествие галереи «пикер на шести» на всех профилях.
9. **Повтор 8 комбинаций после правок: 57 / 61.** Четыре красных — не продукт: три «OVERVIEW · reduced» — пробник
   reduced терялся при втором boot-е внутри путешествия (журнал грузит `parliament-recap`; теперь вердикт снимается
   до второго boot-а, пробник перевзводится после); один «PAYMENT · reduced 1080» — кадр целиком без стилей
   (сырой текст, слоты по 24 000 px): я пересобрал `build/styles.css` ПОСРЕДИ прогона, страница загрузила пустой
   лист. Урок в память: никаких `make:css`/`build:client` пока идёт e2e на этой сборке. Итоговая галерея —
   отдельным полным прогоном на финальной сборке.
10. **Финальный прогон галереи на финальной сборке (9 комбинаций, 99 путешествий): 90 / 99.** Все девять красных —
    ОДНО путешествие, «пикер на шести», на всех комбинациях: `toHaveCount(6)` → 7. Фикстура
    `parliament-aquifer-assembly-six` клала СЕМЬ карт-держателей животных (Fish, Pets, Birds, Livestock, Predators,
    Small Animals, Ecological Zone) — дефект фикстуры, не продукта. Ecological Zone убрана, фикстура перегенерирована,
    повтор путешествия на девяти комбинациях — 9 / 9; кадр `20b-sitting-reward-pick-six` на Deck: шесть кандидатов
    3 × 2, источник слева, целевой эффект под рядом.
11. **P-20 — вторая итерация, по факту КАДРОВ (пробник FITS не видит потерю ВНУТРИ рейки: её бокс влезает).**
    Кадры 15/28 после первой правки: на TV и 1080 пилюля причины режется голым краем («…берёт для», «…Забе») —
    базовая пилюля `.con-cards__verdict` = `display: inline-flex`, а `text-overflow` не действует на собственный
    текст flex-контейнера, объявленное многоточие не рисуется; на Deck заметка доступности обрезана краем панели
    («ТРЕБОВАНИЕ ПОКА НЕ ВЫПО») — чассис `.con-cardavail__status` = `flex-shrink: 0`, контейнер `--line` с
    `overflow: hidden` режет его целиком. Правка (бюджет, не косметика): причина («Принятая резолюция берёт для вас
    N карт») — СОБСТВЕННЫЙ член рейки `.con-extdraw__status-cause` (`flex: 0 3 auto`, `min-width: 6rem`,
    многоточие в своём боксе), пилюля несёт только ПРОГРЕСС («Заберите карты: 6» / «Взято 1 из 6») и остаётся
    целой; заметка доступности уступает последней — заголовок вердикта раньше текста причины (◈ уже несёт
    категорию, текст — конкретный факт). Компонент: `statusText`/`withCause` → `progressText` + `causeText`.
    Новый гард `expectRailHonest(page, label, rail)` в `parliamentDrive.ts`: каждый текстовый член рейки либо виден
    целиком, либо обрезан многоточием в СОБСТВЕННОМ боксе (и бокс — не flex/grid), и ни один не режется предком.
    На старой сборке, Deck, большой добор: `cut-by-ancestor con-cardavail__title 975..1319 by con-cardavail
    948..1250 «Требование пока не выполнено»` — 69 px потеряно молча. Вызывается на позах 15 и 28.
12. **Строгий приоритет во flexbox — не вес `flex-shrink`.** Первая версия бюджета (веса 3 : 2 : 1) на 1080 подрезала
    ВСЕ три члена понемногу («…берёт…», «…ВЫПО…», «…-30/…»): shrink делит переполнение ПРОПОРЦИОНАЛЬНО (вес × базис),
    порядок он не выражает; 100 : 10 : 1 всё ещё снимало букву с заметки при причине не на минимуме — новый гард
    `expectDrawRailHierarchy` (заметка теряет текст только когда причина уже на `min-width`; факт — только после
    заголовка) это поймал на первом же прогоне. Строгая форма: у уступающего члена `flex: 1 1 0` + `min-width` +
    `max-width: max-content` — он берёт только остаток, который оставили целые члены, не больше своего текста и не
    меньше минимума; тот же закон уровнем ниже: заголовок заметки уступает ДО СВОЕГО ЗНАЧКА (`min-width: 1.7rem` —
    ◈ несёт категорию тоном) раньше, чем факт теряет букву. Порядок ценности на рейке: имя = прогресс (целиком) >
    факт заметки > причина (≥ 6rem) > заголовок заметки (≥ значок). Кадр 1080 после правки: «Принятая резолюц… ·
    Заберите карты: 6 · ◈ ТРЕБОВАНИЕ ПОКА НЕ ВЫПОЛНЕНО · Температура -30/2°C»; Deck с полом заголовка 3rem читался
    «◈ Т… Тем…» — три фрагмента и ни одного факта, отсюда пол «только значок» (1.7rem ещё рисовал полоску «Т» как
    «◈ 1» — ровно 1rem). **Deck — бюджет, а не пол:** четыре члена (~600 px текста) в 571 px рейки не помещаются
    даже при причине 4.5rem («Принятая … · ◈ · Температур…»); всё на рейке — состояние, кроме причины, которую на том
    же экране уже называют плита источника и чип награды «+6 карт», поэтому на handheld причина стоит на рейке только
    пока рядом нет заметки доступности (`html.con-profile-handheld .con-extdraw__status-cause:has(+ …__verdict +
    …__avail) { display: none }` — `:has()` на самом члене, не на корне). Это бюджет профиля, не «v-if по профилю
    на контент»: правило ширины, а информация остаётся на экране.
- P-21 · fullscreen-осмотр партии, колонка правил · TV 4K · проза переносится с ДЕФИСАМИ («производ-ство») —
  `hyphens: auto` каркаса прозы (`card_lore.less`) при `lang="ru"`: Chromium Playwright на Windows несёт словари
  переносов, Electron — нет (память: electron-has-no-hyphenation-dictionaries), поэтому вердикты FITS прозовых
  колонок галереи ОПТИМИСТИЧНЫ относительно продукта (без переносов строки длиннее). Класс: достоверность замера;
  как исправить — `hyphens: manual` в консольной прозе (одинаковый перенос на всех платформах) и повтор FITS.
- P-22 · Полигон, fullscreen-осмотр резолюции · Deck · командная строка стенда («R3 Прокрутка · LB RB Секции ·
  B Назад») остаётся видимой ПОД футер-плитой осмотра («LB ◀ ЛИСТАТЬ ▶ RB · B Закрыть») — два глагола B на
  экране (класс: два командных ряда; dev-инструмент, низкий приоритет).

### Итог приёмки Э8 (2026-09-19)

- **Галерея** `console-parliament-gallery.spec.ts`: 11 путешествий × 3 профиля × 3 режима, 32 кадра на комбинацию
  (288), на каждой позе три вердикта (FITS · paint-baseline · fx-lite «нет бесконечных анимаций» / reduced «нет
  собственных прокси, hold-ы ≤ 2 с»). Финальная сборка: 90 / 99 (девять красных — одна фикстура с семью держателями
  вместо шести) → фикстура исправлена, 9 / 9; бюджет рейки добора — три итерации по факту кадров и двух новых гардов
  (`expectRailHonest`, `expectDrawRailHierarchy`), финальный перегон «заседание + большой добор» — 18 / 18.
- **Deck**: пять мест в шапке (кадр 29), большой добор 3 × 2 (28), пикер на шести 3 × 2 (20b); рейка добора несёт
  имя, прогресс и факт заметки целиком. **TV**: ни одного обрезанного чипа (15/28). **Reduced**: те же объекты,
  та же A, ни одного собственного прокси. **fx-lite**: два ambient-цикла добавлены в стоп-лист.
- **Дефекты продукта, найденные галереей и исправленные**: стрэнд оплаченного голоса (вотчер `answerKey` —
  `flush: 'post'`); глагол A на удержанной награде (P-16); бюджет рейки добора (P-20, три итерации); отметка
  «→ резерв» (`v-if`); fx-lite стоп-лист. Диагностика: `window.__wsTrace`.
- **Реестр полировки** пополнен: P-09 … P-22 (кандидаты, не правятся в Э8).
- **Честные ограничения**: perf-lite не режим (paint-baseline постоянен); Полигон скроллит по замыслу; `ConsoleScrollArea`
  на Deck; reduced — разделяемая раздача ≤ 2 с; достоверность прозы (`hyphens: auto` в Chromium vs Electron, P-21).
- Гейты: `test:server` 12056 ✓ · `test:client` 5707 ✓ · `build:test` ✓ · `lint:client` ✓ · eslint ✓ · статические
  гарды ✓ (63 + consoleRootHasGuard).
- Коммит: «Parliament finish · Э8: профили и режимы — галерея 3 × 3, бюджет рейки добора, стрэнд оплаченного голоса».

## ПОЛИРОВКА — реестр (начат 2026-09-19)

Источники: галерея Э8 (`screenshots/parliament-final/<preset>/standard/NN-*.png`, 32 кадра × 3 профиля), три
независимых прочтения кадров (по профилю), пробники `console-parliament-stability.spec.ts` (обход d-pad, высоты
строк состояния) и `console-parliament-chassis-parity.spec.ts` (ряд крошки / командная строка / просвет), кандидаты
P-01…P-22 из Э5/Э8. Формат строки: **№ · поверхность · состояние · профиль · что не так (факт, кадр) · класс ·
как исправить · статус**. Статусы: `сделано` (с кадром до/после), `отложено: <почему>`, `вне скоупа: <чей>`,
`проверить`.

### Реестр полировки

- **R-01** · режим голосования, слот, осмотр резолюции · любое · все · бейдж «ПОБЕЖДАЕТ» на карте РЕЗОЛЮЦИИ,
  строка «ПОБЕЖДАЕТ нет → да», проза «Побеждает: нет → да» (05/06/09) рядом с чипом «+1 M€ ПРИ ПОБЕДЕ · ШАГ ①» про
  ИГРОКА; в вердикте «ПОБЕДИВШИЙ ИГРОК» (11) при «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ» на 19–27 · класс: терминология (пример 7)
  · глоссарий §1–2: резолюция «ПРИНИМАЕТСЯ» / «принята», игрок «победитель голосования», условие «если победите» ·
  статус: в работе.
- **R-02** · обзор (browse) · любое · все · крошка «ПАРЛАМЕНТ › ОСМОТР» и «› ОСМОТР › КРЕСЛО» (01, 23) при глаголе X
  «ОСМОТРЕТЬ»; X на тайле партии подписан «ЭФФЕКТ ПАРТИИ» (03, 30), в других зонах «ОСМОТРЕТЬ» · класс:
  неоднозначный термин (P-11, P-18) · `Parliament overview` → «Обзор»; X на тайле → `Inspect` · статус: в работе.
- **R-03** · ярус партий, тайл правящей партии · gen 1 · все · подпись «ПРАВИТ · СТАРТОВОЕ ПРАВИЛО» (01) при кикере
  правительства «СТАРТОВОЕ ПРАВИЛО» над ним; на TV подпись переносится на две строки · класс: дублирование
  (пример 5, P-10) · `ruling-default` → «Правит» · статус: в работе.
- **R-04** · ярус партий / колонки голосования · любое · все · «ВАШ ЭФФЕКТ» (тайл) vs «ЭФФЕКТ ВАШ» (колонка) —
  один факт, два порядка слов (01, 29) · класс: терминология · тайл → «Эффект ваш», «Эффект ваш · выдан картой»
  (новые ключи) · статус: в работе.
- **R-05** · правительство, задание председателя · любое · все · «НАГРАДА [КРЕСЛО] + 1 ШАГ → ③» — «кресло» как
  предмет, не выгода (01, 22) · класс: формулировка (пример 6, P-04) · чип «ПРЕДСЕДАТЕЛЬСТВО» («сохраняется» для
  действующего председателя), «+ 1 ШАГ» → «+ ШАГ ПОВЕСТКИ» · статус: в работе.
- **R-06** · fullscreen-осмотр (партия / резолюция) · любое · все · кикеры «ДЕЙСТВИЕ» (06) / «ДЕЙСТВИЕ ПАРТИИ» (04)
  / «ЭФФЕКТ» (16, 26) для одного рода блока · класс: терминология · `ASIDE_LABELS` = `PARTY_INSPECTOR_LABELS`
  («ЭФФЕКТ ПАРТИИ», «ДЕЙСТВИЕ ПАРТИИ») · статус: в работе.
- **R-07** · заседание, панель награды · после записи · все · кикер «ЭФФЕКТЫ ВЫПЛАЧИВАЮТСЯ | ПОЛУЧЕНО» (17, 22) —
  два голоса об одном; подпись чипа реакции «ОТВЕТ ПРАВЯЩЕЙ ПАРТИИ» (13) → «ПОЛУЧЕНО ОТ ПАРТИИ» (17) · класс:
  подписи состояния (P-07) · кикер всегда «ВАША НАГРАДА», состояние одно слово («ЭТА ВЫПЛАТА» → «ПОЛУЧЕНО»);
  подпись чипа постоянна · статус: в работе.
- **R-08** · Полигон, fullscreen-осмотр · — · все · пейджер «LB ◀ ЛИСТАТЬ ▶ RB» (26) при «LB ◀ 1/3 ▶ RB» в игре (06)
  · класс: терминология · статус: отложено: dev-инструмент (вместе с R-22).
- **R-09** · чипы состояния эффекта · любое · все · «ДОСТУПНО ВСЕМ» (правительство) vs «ДОСТУПЕН ВСЕМ» (плиты
  осмотра 16/26) · класс: терминология · одна форма «доступен всем» · статус: в работе.
- **R-10** · fullscreen-осмотр резолюции из режима голосования, колонка партии · на голосовании · все · блок
  «ВАШ ГОЛОС» — четыре предложения («Делегатов на карте: 1 → 2 · из них ваших 0 → 1 / Лидер: player2 / Побеждает:
  нет → да · ничья… / Эффект партии: 0 из 2 → 1 из 2») повторяют строки панели голоса и чипы плиты (06) · класс:
  проза + дублирование (пример 3, P-17) · блок остаётся (панель под осмотром не видна), но в ГРАММАТИКЕ панели —
  строки «подпись · значение», термины по глоссарию · статус: в работе.
- **R-11** · заседание, кикер правительства · ожидание чужого выбора · все · «ОЖИДАНИЕ: PLAYER2 ВЫБИРАЕТ КАРТУ» в
  кикере правительства И строка «Ожидание: player2 выбирает карту» в панели награды (17, 22); на Deck кикер
  обрезан «…ВЫБИРА…» · класс: дублирование + обрезка (P-01) · ожидание живёт в панели награды; кикер правительства
  не меняется · статус: в работе.
- **R-12** · заседание, плита пропуска · пропуск · все · причина «НЕТ КЛЕТКИ ПОД ОЗЕЛЕНЕНИЕ» подписью чипа И
  «Нет клетки под озеленение» на плите; «ПОБЕДИТЕЛЮ ГОЛОСОВАНИЯ» дважды (27b) · класс: дублирование · чип
  говорит «ПРОПУЩЕНО», плита — причину · статус: в работе.
- **R-13** · правительство, блок правящей партии · любое · все · проза «2 М€ за каждый полученный шаг РТ.
  Повышая…» под графикой (01–23) — дублирует графику; второй перевод той же прозы в осмотре (16), третий на поле
  (21) · класс: проза на игровом экране + дублирование · с игрового экрана прозу снять (графика + осмотр по X) ·
  статус: в работе.
- **R-14** · режим голосования · любое · все · «из лобби · бесплатно» в строке «ВАШ ГОЛОС» и на CTA «Отправить
  делегата ИЗ ЛОББИ · БЕСПЛАТНО» (05, 09); на TV подпись CTA переносится на две строки (P-19) · класс:
  дублирование + перенос · CTA — только глагол, источник и цена — в строке «ВАШ ГОЛОС» · статус: в работе.
- **R-15** · плита анонса, кресло, композер · — · все · «(A) Открыть заседание» на плите + «A ОТКРЫТЬ ЗАСЕДАНИЕ» в
  командной строке (10, 23, 24) · класс: дублирование · статус: вне скоупа: общий чассис плит/кнопок консоли
  (плита анонса, CTA композера) — одно и то же на каждой поверхности консоли.
- **R-16** · ярус партий, тайлы · обход d-pad · все · пробник стабильности: при фокусе строка состояния тайла
  меняет высоту 20 → 26 px и сдвигается на 6 px (1080); высоты строк у шести тайлов разные — TV 40/74, Deck 16/21
  (перенос «ВЫДАН КАРТОЙ» на 2 строки; кубики мест выше текста); подписи есть не у всех тайлов · класс: скачки
  раскладки (пример 1, P-15) · `.con-pseal__state` — `height` (резерв) по профилям вместо `min-height` · статус: в
  работе.
- **R-17** · шапка Парламента · любое · все · паритет шасси: ряд крошки на 21 px выше и 11 px левее, чем у
  «Действий карт» и «Колоний» (1080: 52/229 vs 73/240; TV 110/504 vs 151/526; Deck 41/176 vs 69/179) — свои
  токены `--con-parl-pad-t/-l` вместо общих `--con-ws-frame-pad-t` / `--con-hud-pad-x` · класс: паритет шасси ·
  отступы Парламента — общие токены; бюджеты высоты пересчитать (FITS по галерее) · статус: в работе.
- **R-18** · режим голосования, блок «ДЛЯ ВАС ПРИ ПРИНЯТИИ» · любое · все · рамка блока растягивается на всю
  колонку (`flex: 1 1 auto`): одна строка содержимого в пустой раме 550 × 200 (09b Deck), пустота справа (05) ·
  класс: пустая рама (пример 4) · рама по содержимому, панель держит высоту · статус: в работе.
- **R-19** · fullscreen-осмотр партии · — · все · нет LB/RB-листания по шести партиям (футер только «B Закрыть»);
  на Deck колонка «§ ПРАВИЛА» уходит за правый край: «…стоят дв» обрезано (04) · класс: отсутствующая команда
  (пример 2, P-12) + обрезка · запрос `{kind: 'party'}` с листом партий и пейджером LB/RB как у резолюций; ширина
  колонки правил на handheld — в бюджет экрана · статус: в работе.
- **R-20** · шапка Парламента, плотный стол · 5 мест · 1080/Deck · пилюли статуса «play…», «pl…», «p…» (29),
  полоса мест уходит на вторую строку под крошку (Deck 29) · класс: обрезка · статус: вне скоупа (пилюли —
  `ConsoleStatusStrip`); перенос полосы мест на Deck — проверить после R-17.
- **R-21** · слот правительства, мини-карта · любое · Deck · чип «ЗАДАНИЕ ПРЕДСЕДАТЕЛЯ» вылезает за нижнюю рамку
  мини-карты (12–19, 11; RX05 на Полигоне) · класс: обрезка · статус: проверить (премиум-грань в мини-зуме).
- **R-22** · Полигон · — · Deck · под fullscreen-осмотром видна яркая строка стенда — два глагола B (P-22);
  строчные глаголы стенда · класс: два командных ряда · статус: отложено: dev-инструмент, вне игрового пути.
- **R-23** · рельса ресурсов · посадка чипа · все · дельта-чип «+2» ложится на рамку/значение (15, 21; P-02) ·
  статус: вне скоупа: рельса ресурсов консоли.
- **R-24** · док руки · получение карты · все · бейдж «+1»/«+2» наезжает на «КАРТЫ 2/4» (17) · статус: вне
  скоупа: счётчик дока консоли.
- **R-25** · заседание, ВЕРДИКТ/ПРИНЯТИЕ · на покое · все · (а) третья колонка озаглавлена «ПУСТОЙ СЛОТ», а карта
  «Климатические исследования» ещё стоит в ней (display hold держит карту, но не подпись), слот правительства
  «ПРИНЯТАЯ РЕЗОЛЮЦИЯ» пуст без плейсхолдера (11); (б) бейдж «ПОБЕЖДАЕТ» на «МАРС ВПЕРЕД» при «0 ДЕЛЕГАТОВ ·
  Лидера пока нет» на всех кадрах заседания (11–22, 27); (в) на 27b колонки уже в состоянии обновления при
  удержанной позе НАГРАДА · класс: подпись/колонки не следуют за удержанием; бейдж без основания · подпись слота
  и строки делегатов — из удержанного состояния; бейдж только при ≥ 1 делегате · статус: в работе.
- **R-26** · заседание, ПРИНЯТИЕ · — · 1080/TV · «ПОВЕСТКА 3 → 4 +1 РТ» в панели при «СЛЕДУЮЩИЙ ШАГ ③» и маркере
  между «2» и «3» на рейке (12) · статус: проверить: подписи рейки — уровни влияния, не индексы шагов.
- **R-27** · обзор, плотный стол · — · все · колонка «ИНДУСТРИАЛИСТЫ»: «ЛИДЕР» — зелёный при ×4, когда в ряду
  нейтральный ×8 (29) · статус: проверить: правило лидера (нейтральный может лидировать).
- **R-28** · названия карт на премиум-грани · — · все · длинные названия строчными, короткие капсом (все кадры) ·
  статус: вне скоупа: ярусы длины премиум-грани, не Парламент.
- **R-29** · заседание, ЗАКРЫТИЕ / кресло · — · все · заголовки «Итоги поколения 1» (19) и «Вы выполнили задание
  председателя» (23) — единственные строчные заголовки среди капс-кикеров · класс: регистр · заголовок панели — в
  грамматике кикеров · статус: в работе.
- **R-30** · панель награды · чтение · 1080 · чипы центрированы, левые края не совпадают (13); правая половина
  панели пуста (13–27) · класс: раскладка · левое выравнивание столбика; пустота — резерв волны (по замыслу) ·
  статус: в работе (выравнивание), пустота — отложено: по замыслу.
- **R-31** · Информация › эффекты партий · — · Deck · правая панель обрезана краем экрана (08) · статус: вне скоупа:
  полоса Информации (`ConsoleInfoMode`).
- **R-32** · fullscreen-осмотр из вердикта/добора · — · все · на плите «ИСТОЧНИК» без глифа, пока в строке под ней
  «L3 ИСТОЧНИК» (16) · класс: глиф · статус: проверить (общий `.con-zoom__foot`).
- **R-33** · fullscreen-осмотр (партия/резолюция) · — · TV/1080 · верхи левой и правой колонок не совпадают
  (TV: 80 vs 110; 195 vs 240 на 16; 1080: 06 — 155 vs 215) · класс: выравнивание · одна верхняя линия колонок ·
  статус: в работе.
- **R-34** · режим голосования, шапка колонки · оплата/выбор · все · маркер принимаемой резолюции меняется с чипа
  «ПОБЕЖДАЕТ» (05) на «★» без подписи (09, 09b) · класс: два знака на одно состояние · один бейдж «ПРИНИМАЕТСЯ»
  (R-01) в обоих состояниях · статус: в работе.
- **R-35** · плита анонса · — · TV · баннер наезжает на гекс-маркер «i» поля (10) · статус: вне скоупа: позиция
  плиты анонса консоли.
- **R-36** · заседание, ожидание · ворота/чужой шаг · все · «Ждём остальных · player2» (14) vs «Ожидание: player2
  выбирает карту» (17, 22) · класс: терминология · одна форма «Ожидание: <игрок> …» · статус: в работе.

### Статусы реестра после правок (2026-09-19)

Кадры «до» — `screenshots/parliament-final-before-polish/<preset>/standard/NN-*.png` (галерея Э8), кадры «после» —
`screenshots/parliament-final/…` (галерея, перестроенная после полировки). Пробники: `console-parliament-stability`
3 / 3, `console-parliament-chassis-parity` 3 / 3, `tests/console/parliamentGlossary.spec.ts` 5 / 5.

- R-01 **сделано** — 29 RU-строк `parliament.json` (резолюция «принимается / принята», игрок «победитель голосования»,
  «если победите»); гард глоссария; кадры 05/06/09/11 до → после.
- R-02 **сделано** — «ПАРЛАМЕНТ › ОБЗОР», X на тайле «ОСМОТРЕТЬ» (`parliamentCommands.ts`); кадры 01/03.
- R-03 **сделано** — тайл «ПРАВИТ» (ключ `Ruling · starting rule` удалён); кадр 01.
- R-04 **сделано** — «Эффект ваш …» в пяти существующих ключах (тайлы, колонки, Информация); кадры 01/29.
- R-05 **сделано** — «НАГРАДА · ПРЕДСЕДАТЕЛЬСТВО + ШАГ ПОВЕСТКИ → ③» (ключи `Chairmanship`, `Agenda step`); кадр 01.
- R-06 **сделано** — `ASIDE_LABELS` = «ЭФФЕКТ ПАРТИИ / ДЕЙСТВИЕ ПАРТИИ»; кадры 06/16; спека `parliamentAnnotations` обновлена.
- R-07 **сделано** — кикер награды всегда «ВАША НАГРАДА» (состояние — одно слово), подпись реакции постоянна
  «ОТВЕТ ПРАВЯЩЕЙ ПАРТИИ»; кадры 17/22; спека `sequelYieldModel` обновлена.
- R-08 **отложено** — dev-инструмент (Полигон), вместе с R-22.
- R-09 **сделано** — «Доступен всем» (ключ `Available to every player`).
- R-10 **сделано частично** — блок «ВАШ ГОЛОС» говорит словами панели («Принимается: нет → да», «Эффект партии»),
  строки уже были формы «подпись: значение»; сам блок из колонки партии не вынесен (панель под осмотром не видна,
  §комментарий в `parliamentAnnotations.ts`). Кадр 06.
- R-11 **сделано** — кикер правительства больше не дублирует ожидание (`phaseWaitText` удалён), ожидание — строка
  панели награды с чипом игрока; кадры 17/22.
- R-12 **сделано** — подпись чипа при пропуске «ПРОПУЩЕНО», причина — только на плите; кадр 27b.
- R-13 **сделано** — проза правящей партии снята с обзора (`rulingSummary` удалён), формула + осмотр; кадр 01.
- R-14 **сделано** — CTA голоса: только глагол; цена/источник — строка «ВАШ ГОЛОС» и атрибут `data-cost-amount`;
  спека v2 обновлена; кадры 05/09 (перенос на TV снят).
- R-15 **вне скоупа** — общий чассис плит анонса и CTA композера.
- R-16 **сделано** — `.con-pseal__state`: `height` 1.4rem (база) / 1.3rem (ярус тайла) / 2rem (TV) вместо
  `min-height`; пробник стабильности 3 / 3 (до: 20 → 26 px при фокусе, 40/74 на TV, 16/21 на Deck).
- R-17 **сделано** — отступы Парламента — общие токены `--con-ws-frame-pad-t` / `--con-ws-frame-pad-x`, ряд крошки
  центрирован на 2rem-линии общей шапки; 1080 — точно (73/240 = 73/240); TV −5 px и Deck −10 px — остаток на
  стороне эталона («Действия карт» на этих профилях сами стоят ниже линии; «Колонии» расходятся с ними ещё на
  +7 / −4 px) — закреплён ратчетом `KNOWN_TOP_RESIDUAL`, может только уменьшаться.
- R-18 **сделано** — рама «ДЛЯ ВАС ПРИ ПРИНЯТИИ» по содержимому; кадры 05/09b. Вторая итерация (Э9): `flex: 0 0 auto`
  лишила раму способности сжиматься — двухстрочное чтение RX05/RX02 переполняло фиксированную высоту панели на 5–20 px
  (`console-parliament-vote-fit`: «clipped-y con-parl__info-body 197 > 192»); форма «не растёт, но сжимается» —
  `flex: 0 1 auto` + `min-height: 0`.
- R-19 **сделано** — осмотр партии: все шесть партий в одном viewer, LB/RB листают, счётчик в футере
  («LB ◀ 5/6 ▶ RB», `inspectParliament`); обрезка колонки правил на Deck — класс `con-zoom--party` с тем же
  handheld-бюджетом `--con-rules-w: 21rem`, что у резолюции (кадр Deck 04 до → после: «…стоят дв» обрезано →
  колонка в экране).
- R-20 **вне скоупа** (пилюли статуса); перенос полосы мест на Deck — по кадру 29 после R-17.
- R-21 **проверить** — по кадру 12 Deck после галереи (мини-зум премиум-грани).
- R-22 **отложено** — dev-инструмент.
- R-23 / R-24 **вне скоупа** — рельса ресурсов / счётчик дока консоли.
- R-25 **(а) сделано** — пустой слот не подписывает себя, пока директор держит карту над ним (`holds.parked`);
  **(б) не дефект** — при нуле делегатов принимается ближайшая к правительству (правило ничьей), с новым словом
  «ПРИНИМАЕТСЯ» бейдж читается по правилу; **(в) отложено** — удержание строк делегатов колонок на удержанной
  позе НАГРАДА требует расширения display holds (контракт Э4), не в этом проходе.
- R-26 **не дефект** — рейка подписана уровнями влияния, панель — индексами шагов; два разных числа по замыслу.
- R-27 **не дефект** — правило сервера (`leaderOf` не считает нейтральные кубы лидерством).
- R-28 **вне скоупа** — ярусы длины премиум-грани.
- R-29 **сделано** — «Итоги поколения N» и «Вы выполнили задание председателя» — в грамматике кикеров
  (капс, трекинг); кадры 19/23.
- R-30 **отложено** — выравнивание чипов награды: minor, требует замера DOM; пустота справа — резерв волны по замыслу.
- R-31 **вне скоупа** — полоса Информации.
- R-32 **отложено** — общий футер `.con-zoom` (пилюля без глифа).
- R-33 **отложено** — верхи колонок осмотра: общий каркас `.con-zoom`, не парламентский.
- R-34 **не дефект** — при длинном имени партии бейдж принимаемой резолюции рисуется глифом (бюджет ширины
  шапки колонки), это одно состояние в двух формах по ширине.
- R-35 **вне скоупа** — позиция плиты анонса.
- R-36 **сделано** — «Ожидание» + чип игрока (ключ `Waiting for the other seats`).

### Что сделано (ПОЛИРОВКА)

- Глоссарий `docs/claude/parliament-glossary.md` (§1–7) + гард `tests/console/parliamentGlossary.spec.ts` (канон
  ключей · запрещённые формы · удалённые ключи · глагол X · метки осмотра).
- Пробники: `console-parliament-stability.spec.ts` (обход d-pad: ни один бокс обзора не движется; шесть тайлов —
  одна высота строки состояния) и `console-parliament-chassis-parity.spec.ts` (ряд крошки / командная строка /
  просвет против каждого workspace колеса; ратчет остатка).
- Правки продукта по реестру: R-01…R-07, R-09, R-11…R-14, R-16…R-19, R-25(а), R-29, R-36 (см. статусы).
- Старые e2e, задетые терминологией, адаптированы в этом же проходе: `console-parliament-v2` (крошка «ОБЗОР»,
  «Председательство», фрагмент правил, атрибут цены CTA), `console-parliament` («Председательство»),
  `console-parliament-biodome` («Если победите: …»), `console-resolutions-playground` («Если победите»).
- Клиентские спеки, кодировавшие старые слова: `parliamentAnnotations.spec`, `sequelYieldModel.spec`;
  `voteInfoBudget.spec` — новый тест «панель говорит глоссарием».

### Итог приёмки ПОЛИРОВКА (2026-09-19)

- Реестр: 36 строк; **сделано 20** (R-01…R-07, R-09, R-11…R-14, R-16…R-19, R-25(а), R-29, R-36), **частично 1**
  (R-10), **не дефект 4** (R-25(б), R-26, R-27, R-34), **отложено 6** (R-08, R-22, R-25(в), R-30, R-32, R-33),
  **вне скоупа 7** (R-15, R-20, R-23, R-24, R-28, R-31, R-35) — каждая с причиной.
- Галерея после полировки на финальной сборке: **99 / 99** (три профиля × три режима; FITS · paint baseline ·
  fx-lite · reduced на каждой позе); кадры R-29 (19, 23) и R-19 (Deck 04) перегнаны после последних правок.
- Пробники: стабильность 3 / 3 · паритет 3 / 3 · глоссарий 5 / 5 · `voteInfoBudget` 6 / 6.
- Гейты: `lint:client` ✓ · eslint ✓ · e2e-typecheck ✓ · `build:test` ✓ · `test:server` ✓ · клиентские юниты ✓.
- Коммит: «Parliament finish · ПОЛИРОВКА: реестр R-01…R-36, глоссарий + гард, пробники стабильности и паритета,
  20 правок по кадрам».

## Э9 — финал (2026-09-19 → 2026-09-20)

### Долги Э0–Э4

- Закрыты: скип «образец сломанной резолюции» в `ResolutionContract.spec` (удалён; фраза гарда закреплена юнитом
  `missingReport`); подпись «→ резерв» (Э5/Э8); e2e тайла победителя с парковкой/возвратом (галерея Э8); язык чтения
  до записи (Э5); переходы поз (Э4).
- Остаются границами (не долгами, с причинами в FINISH § Э9): понижение версии на воротах; `phaseHistory` cap 24;
  ОБНОВЛЕНИЕ не перечисляет сброшенных (сводка сервера); бонус-карта Повестки в fullscreen-viewer; растворение чипа
  поверх входа следующей страницы; две сети ledger-а как единственные wall-clock.

### Старые e2e — адаптация (см. FINISH § Э9 «Старые e2e Парламента»)

Первый прогон 236 тестов старых и новых суит на финальной сборке: четыре класса красного (сцена итогов; одна
плита на поколение; ворота adjourn + записи `reaction`; добор без призрака), один дефект продукта (фокус добора после
ухода карты перескакивал через карту — `settleTaken`: фокус следует за картой). Адаптированные суиты — 62 / 62.

### Прогоны суит Парламента (все `console-parliament*`, `console-external-draw`, `console-resolutions-playground`; `--workers=1`)

- Полный набор на финальной сборке: **227 / 236** за 1,5 ч. Девять красных — три класса, все исправлены и перегнаны:
  · галерея «PICK on SIX» (1080 · reduced) — слепое `press(Enter)` перед опросом ворот проглочено под reduced motion →
    `pressUntil` с позитивным свидетелем в четырёх местах галереи;
  · `sitting-reward` RX03 (TV) — тик сел через 186 мс после покоя чипа при окне 160 мс (4K в хвосте двухчасового
    прогона) → окно 260 мс с обоснованием (четверть секунды — всё ещё «на касании», absorb-хвост ~600 мс);
  · `vote-fit` ×7 (1080/TV) — регрессия R-18: `flex: 0 0 auto` лишил раму «ДЛЯ ВАС ПРИ ПРИНЯТИИ» способности
    сжиматься, двухстрочные чтения RX05/RX02 переполняли панель на 5–20 px → `flex: 0 1 auto`.
- Перегон после правок: `vote-fit` **21 / 21**, галерея «PICK on SIX» + RX03 TV **2 / 2**.

### Итог прогона (полный `tests/e2e`, `--workers=2 --trace=retain-on-failure`, 2026-09-20)

678 тестов: **641 зелёных · 26 красных · 11 пропущенных** за 3,4 ч (лог `tmp/e9-full-e2e3.log`, трассы в
`test-results/`). Первая попытка деградировала (сервера воркеров на 8122/8123 без Chromium) — остановлена, висячие
сервера сняты, прогон повторён с нуля.

- **Пропущенные (11) — не Парламент:** 10 измерительных пробников под флагами окружения (`LONGGAME_PERF=1`,
  `RECV_PERF=1`) и один `test.fixme` в `console-pluto-two-colony-sequence` (UI rework 2026-09-01, несёт свидетельство
  своего дефекта). В парламентских деревьях — ни одного `skip` / `fixme` (проверено грепом по деревьям).
- **Парламентский красный — один:** `console-parliament-sitting` (Deck), «сборка»: сервер уже в `adjourn`, поза
  НАГРАДА (`stageHeld`, отпускается концом волны награды) пережила 30-секундный опрос. Под двумя воркерами rAF
  голодает, беты ложатся на свои сети: `STAGE_HOLD_CEILING_MS` 12 с + `REWARD_HOLD_SAFETY_MS` 8 с +
  `AGENDA_BONUS_HOLD_SAFETY_MS` 30 с = 50 с. Граница опроса → 90 с (сумма сетей с запасом, названа в спеке);
  перегон под нагрузкой двух воркеров (`--grep deck-handheld --workers=2 --repeat-each=2`) — **4 / 4** за 1,1 мин.
- **Чужие красные — класс нагрузки** (изолированно на одном воркере зелёные): `console-draft-workspace` (rAF-сэмплер
  не увидел ни одного rotateY — «hidden-stage shape» при голодании rAF), `hand-album-probe` «tail 2» (TV) — ширина
  карты 25 px между страницами (класс «сравнение с неустоявшейся стороной» из tests.md).
- **Чужие красные — стабильные** (красные и изолированно; в списке 2026-09-03 их не было): MarsBot-корпорации ×18
  (карта корпорации бота не рендерится ни в табло — `.con-played__botcorp .pcard`, 17 спеков, — ни в Информации —
  `.con-info__block--botcorp .pcard`, `console-bot-corporation`); `console-hud-frame` fhd / tv-4k (`main == viewport − 2×(rail+gap)`,
  остаток 14 / 6 px — файлы рамы с базы не менялись, восемь коммитов «UI rework» по ним между `23f8a50c51` и базой);
  `start-effect-flow-probe` (хэндовер героя не засвидетельствован — стартовая сцена не менялась, спек — UI rework
  `94622b5504`); `console-extras-explorer` Deck (верх слота Δ = 1,3 px — субпиксельный дрейф, спек — UI rework
  `d67f0e9a1b` до базы); `console-delta-card-advance:265` («the walk home must START at the dock's own card»: первый
  кадр возврата снят не с карты дока, Δx 57 px при допуске 6) — в списке 2026-09-03 его НЕ было.
- **Список 2026-09-03 против этого прогона:** классы ① и ③ и три из четырёх ② — **зелёные** (corp-first-action,
  community-marker, first-action-unsourced-draw, bonus-action-handoff, bonus-nested-first-action, planet-focus ×2,
  zz-nomads-visual ×2, start-flow-polish-probe, start-scene-profiles ×4, hydro-bonus-order ×2, hydro-copied-tile,
  corporate-espionage ×3 — все `ok`): ни один поимённо названный в списке спек больше не красный. Список — на ревизию
  владельцу; `console-delta-card-advance` в нём не числился и красный впервые.
- **Чего не сделано:** прогона чужих красных на базовом коммите `65d3e556b4` (нужна вторая сборка). Доказательство
  «не Парламент» — три факта: пустой `git diff 65d3e556b4..HEAD --stat` по путям спека, последнее касание спека —
  «UI rework» до базы, изолированный перегон.

### Ворота Э9

Все зелёные (2026-09-20): `build:test` (обе ступени tsc: Mocha-дерево + e2e) · `lint:client` (vue-tsc) · `lint:i18n` · `make:json` ·
`eslint --no-cache` по 16 изменённым файлам Э9 · `test:server` **12061 / 12061** (1 pending — чужой TODO гарда
staged-parity про Mining Area / Mining Rights) · `test:client` **5708 / 5708** — первый прогон дал один таймерный
флейк чужого `animationHold.spec` («the ceiling runs the OWNER RECOVERY»: 2-секундный mocha-таймаут на
реальном 45-мс таймере под нагрузкой; спек и реестр с базы не менялись), изолированно 17 / 17, полный перегон
чистый. Гард драйвера e2e и ратчет `waitForTimeout` / `requestAnimationFrame` — внутри `test:server`.

## Финальная полировка (начата 2026-09-20)

Промт: `docs/claude/prompts/parliament-final-polish.md`. Блоки строго по порядку: A (доказанные хвосты) → B (второй
аудит, реестр P-…) → C (пересмотр «вне скоупа») → D (готовность к семействам) → E (приёмка). Правило итерации:
«отложено» / «minor» / «чужой файл» не принимаются — либо сделано, либо доказано скриншотом и замером.

### Блок A — хвосты с доказанным расхождением

Сборка, на которой мерилось «до»: чанк `console-shell.js` 2026-09-19 15:25 (по содержимому равен HEAD `890020253c`:
webpack «compared for emit»), `styles.css` пересобран перед замером.

- **A.1 · «ВАШ ГОЛОС» в осмотре резолюции — сделано.** Блок из колонки партии удалён совсем
  (`resolutionPartyAnnotations(party)` без второго параметра; `voteFactRowsOf` и ключ «Delegates on the card …»
  удалены). Состояние голоса — только в подвале и только объектами: новый чип `ConsoleZoomVoteFacts`
  (`.con-rvote`, свидетели `data-zoom-vote-facts` / `data-zoom-vote-fact="lead|win"`) рисует те же ряды фактов,
  что панель голосования, — общий компонент `ConsoleVoteFactRow.vue` (один markup, два хоста: панель и подвал);
  резерв вариантов остальных карт контекста держит ширину чипа при LB/RB (закон устойчивости подвала). Ребро
  доступа — не третий ряд, а проекция на СОБСТВЕННОЙ строке доступа чипа статуса: «ЭФФЕКТ ПАРТИИ ▢■ 1/2 недоступен
  → эффект ваш» (`ResolutionAccessVm.unlocksWithVote` из серверной проекции `unlocksEffect`, свидетель
  `data-zoom-vote-access`); хвост «· Принимается» чипа статуса гаснет, пока стоит чип фактов (`winningTail`), —
  каждый факт живёт ровно в одном месте подвала. Спеки: `voteInfoModel.spec` (footerFactsOf), `parliamentAnnotations.spec`
  (колонка партии — только правила), `resolutionInspectModel.spec` (проекция ребра ×3), e2e `vote-fit` (ряды
  чипа, 0 блоков `group:vote`, 0 хвостов, проекция ребра ⇔ ребро по серверной модели), `climate`.
- **A.2 · панель «ДЛЯ ВАС ПРИ ПРИНЯТИИ» — сделано (графика), высота — по замеру ниже.** Справа от чтения — бокс
  партии `.con-parl__info-party` (`data-parl-info="party-effect"`): эмблема внутри печатной формулы партии
  (`ConsolePartyFormula :emblem size="compact"`, zoom .74 / .52 Deck) и одна строка момента «эффект партии · всем
  при принятии» (ключ `party effect · to every player when enacted`) — без прозы, без имени партии (эмблема и есть
  имя; ряд слотов подписан так же). Бюджет: слова момента считаются ОТДЕЛЬНО (`VoteInfoBudget.moment ≤ 5`, гард), текст
  решения по-прежнему ≤ 28. Пробник стабильности голосования (новый тест в `console-parliament-stability`) сразу
  поймал два скачка новой композиции: бокс по содержимому менял ширину с картой (256 → 260 px на 1080) и высоту ряда
  (342 → 320 TV, 123 → 107 Deck) — бокс получил ОДНУ ширину (13rem / 17.5rem TV / 9rem Deck — замер в A.2-bis), ряд чтения растягивается на
  всю оставшуюся высоту колонки, оба бокса одной высоты (закон 18: высота зарезервирована).
- **A.2-bis · ширины по замеру первой партии прогонов.** `vote-fit` / `architecture` / `powergrid` на TV и Deck
  поймали обрезание чтения рядом с боксом партии: на TV чтению «Климатических исследований» нужно 1415 px
  (Премии — 1413, Энергосети — 1398) из 2198 px ряда, а бокс 20rem оставлял 1374; на Deck — 495 из 474 при
  боксе 11.5rem, плюс двухстрочное чтение 110 px в ряду 108 px (панель 7.6rem). Итог: бокс 13 / **17.5 TV** /
  **9 Deck** rem (строка момента на TV и Deck переносится в две центрированные строки на своём кегле — .8rem
  TV, .5rem Deck, а не четвёртая ступень шрифта), панель Deck **8rem** (ряд 116 px), формула партии на Deck
  **.52** (двухрядная формула 75 px + две строки момента входят в 107 px бокса; при .56 момент терял 3 px
  второй строки). Пробник (временный спек, удалён после замера) на трёх профилях: чтение 1474 / 902 / 524 px
  при потребности 1415 / — / 495, ни одного сжатия.
- **A.1-bis · подвал осмотра — политика ширины вместо flex-сжатия; две строки на всех профилях.** Тот же
  прогон показал, что чип фактов в подвале СЖИМАЛСЯ flex-строкой: на Deck до 80 px из честных 195 (ключ
  «ПРИНИМАЕТСЯ» — одно слово, переноса нет — резался до «ПР»), на TV до 202 из 553; на 1080 бар стоял ровно на
  своём максимуме (1767 из 1766), а рядом чтения Энергосети выплёскивали подпись (197 > 162,
  `console-parliament-v2` Deck). Обрезание ключа не видит ни один пробник: у ключа `overflow: hidden`, и
  scrollWidth решётки его не показывает. Закон подвала теперь: **член уступает ширину только переносом своих
  строк, никогда сжатием** (`flex-shrink: 0` на чипе статуса, рядах фактов, пейджере и «Закрыть»; чтение и
  глагол переносят строки до своего минимума — `min-width: auto` вместо `0`, из-за которого подпись резалась);
  чип награды победителя рядом с рядами фактов гасит кикер «ПОБЕДИТЕЛЮ ГОЛОСОВАНИЯ» (прецедент чипа реакции:
  «ЕСЛИ ПОБЕДИТЕ» на той же строке уже адресует победителя, ряды рядом говорят, вы ли это); имя кресла в ряду
  лидера — многоточие в своём боксе (`max-width: 8rem`); ряды фактов — на лестнице профиля панели голосования
  (.8rem-пол TV, .5/.68/.82 Deck). И **подвал сцены — две строки на всех профилях**: ФАКТЫ (статус · ряды
  голоса · чтение · награда победителя) над ГЛАГОЛАМИ (делегат · пейджер · закрыть) — разрыв `::before` бара с
  `flex-basis: 100%` и `order` между группами. Замер: в одну строку честные ширины — 1217 px на баре Deck
  1140, 1767 на 1766 (1080), 3534 на 3524 (TV, чтение сжато в столбик 335 px и всё равно обрезано); в две
  строки ничего не сжато, высота не больше прежнего столбика (Deck 49+44, TV 132+116), композиция одна на
  трёх профилях. Спек «тесного стола» (`console-parliament-v2`) читает «принимается» из ряда фактов (одно
  значение, без стрелки), а не из хвоста чипа статуса. Две строки выше плиты в 5.2rem, на которую движок
  подгонки осмотра резервировал карту (константа 96 + 8 в `CardZoomModal`): плита тесного стола встала на
  32 px поверх карты. Полоса действий сцены резолюции теперь ФИКСИРОВАННАЯ по профилю (8.5rem / 8.4rem Deck —
  под самую высокую композицию: двухчастное чтение над заблокированным глаголом с причиной; замер 170 / 316
  / 156 px), а консольный экземпляр движка резервирует ту полосу, что у него есть (`offsetHeight` полосы вместо
  константы; десктопный экземпляр байт-в-байт прежний). Подписи двухчастного чтения больше не сложены в 7rem
  (мера существовала для однострочного бара) — одна строка, перенос только от тесноты. Свидетель
  `expectInspectorFooterWhole` (`parliamentDrive.ts`, вызывается из `climate` — самая высокая композиция):
  каждый член внутри бара, ни один не сжат (ключ ряда, плита чтения, подпись — целые в своём боксе), плита
  внутри полосы и не заходит на карту.
- **A.3 · «→ резерв <игрок>» — расхождение док/код исправлено в обе стороны.** Подписи с именем в коде никогда
  не было: Э5/Э8 поставили стрелку у ключа «Резерв» владельца, пока возврат должен (это и стояло в FINISH как
  «закрыт»). Добавлен КАДР ПОСАДКИ: стек резерва владельца отвечает на касание одноразовым золотым кольцом
  (`con-parl__stack--landed`, перезаклад стека на посадке, конец по `animationend`, reduced motion — без кольца);
  подпись с именем не вводится — имя места стоит на той же строке зоны делегатов, третий текстовый член на
  0.44rem-ключе на Deck (8 px) нечитаем. FINISH § Э9 «Долги Э0–Э4» переписан по факту. Остальные пункты «закрыт»
  проверены по коду: `describe.skip` удалён (юнит `missingReport`), реакция летит с `[data-parl-ruler]`, чтение до
  записи — `resolvingYieldsOf`, режим `resume` в `sittingBeats`, тайл победителя — путешествие «REWARD variants»
  галереи (кадры 21/22), ворота — презентер заседания. Единственная ложная запись была про «→ резерв».
- **A.4 · R-30 — сделано с замером.** Причина: `.con-sit__yield { align-items: center }` — чтения разной ширины
  центрировались друг относительно друга (кадр 13: второе чтение на 18 px левее первого). Теперь `flex-start`;
  пробник (новый тест стабильности заседания): все `.con-iyield__reading` панели награды на одном левом крае ±1 px
  и каждый ряд hero-колонки начинается с одного x — зелёный на 1080/Deck, на TV см. A.4-bis.
- **A.4-bis · зона делегатов двигалась между страницами заседания на TV (найдено пробником, 2 px).** Счётчик
  резерва «×5 → ×7»: у консольного шрифта нет табличных цифр, `font-variant-numeric` не помогает; счётчику
  зарезервирована ширина `min-width: 1.9em`.
- **A.5 · R-35 — сделано, с честным замером на трёх профилях.** Плита анонса центрирована на корне и по
  содержимому: 676 px на 1080 (622–1298) при клетке Фобоса 603–680 и Луны 1240–1317 — плита закрывала ОБЕ
  офф-марсовые клетки на всех профилях (Deck: 302–978 при Фобосе 382–438 и Луне 908–964). Свободная полоса между
  клетками: 560 px на 1080, 1112 phys на TV, 470 px на Deck (центр полосы на Deck 673 ≠ центр корня 640: поле
  смещено вправо внутри проёма) → плите, центрированной на корне, на Deck доступно ≤ 404 px. Вертикально
  опустить нельзя: под Фобосом (139 px) сразу верхний ряд гексов (≈190 px), плита 79 px не помещается. Решение —
  содержимое, а не позиция: текст плиты «Заседание» (кикер «ПАРЛАМЕНТ» уже называет орган; номер поколения — в
  HUD над плитой), глагол — семейный «Открыть» (бар несёт «Открыть заседание»; заодно снят дубль R-15 на плите);
  промежуточный вариант «Заседание · поколение 1» дал на Deck 426 px (427–853) — 11 px на Фобосе, без запаса под
  округление глифов на CI. Плюс у плиты не было handheld-лестницы вовсе (базовые размеры на 1280 px) — добавлена
  (`html.con-profile-handheld .con-mandatory`). Позиция плиты — общий токен без парламентских смещений; гард
  `console-parliament-announce.spec.ts`: `top = hud + 1.75rem`, центр = центр корня, ни одного пересечения с
  `.board-space`, текст и глагол.
- **A.6 · R-25в — сделано.** Пока поза НАГРАДА удержана через шаг, пришедший в том же ответе (adjourn с записью)
  или через возврат с поля, колонки показывали ОБНОВЛЁННЫЙ стол (кадр 27b: нейтральные кубы на новых картах,
  колода ×0). Теперь стол «как стоял»: display hold `heldSlots` (проигравшие с их лентами и счётом — снимок
  `view.slots` sync-вотчером до изменения модели; при уступке поля — `noteSlotsBeforeYield`), hold-ы обновления
  (лица новых карт, их кубы, колода, лобби) сеются ДО рендера удержанной позы (`seedRenewalHolds` идемпотентен),
  вход в шаг отпускает стол, бет обновления паркует проигравших с тех же гнёзд. Пробник: `sitting-reward` для
  RX02/RX04 (шаг без вопроса) — ни одного сэмпла удержанной позы с изменившимися колонками (`slots` в пробе).
- **A.7 · R-31 — сделано в общем слое, дефект был на всех профилях.** `.con-info__efxhost` — flex-строка, а полоса
  партий (`ConsolePartyEffectsStrip`, `margin-bottom`) вставала СОСЕДОМ по строке: на 1080 — полупустая плита во
  всю левую половину (кадр 08), на Deck колонка досье исследователя уезжала за правый край. Хост стал колонкой
  (полоса — лента над исследователем; `flex-direction: column`); гард в галерее: полоса выше исследователя, полоса,
  фильтры, тело и досье — в экране.
- **A.8 — сделано.** `.con-parl__recap-item` снят из строк «что мерить» шести спеков; `.con-parl__txn-row` ЖИВ
  (`ConsoleParliamentSeatPick.vue`) — оставлен. `RECAP_FLIGHT_MS` → `CUBE_FLIGHT_MS` (полёт куба делегата: возвраты
  заседания и делегат кресла).
- **A.9 · локаль — сделано.** Сканер по `src/**` (без `translations.json`, с учётом `\'` в TS): **151 мёртвый
  ключ** удалён (в т. ч. `Chairman seat + Agenda step`, `Seat (kept)`, весь блок «Инициатива … I/II», тексты
  прежних панелей); честные формы числа вместо «карт(ы)» / фиксированного родительного в пяти живых ключах
  (`{карту|карты|карт}`, `{нейтральный делегат|…}`, `{делегат|…}`, `{животное|…}`); ключ `To the discard` не
  дублируется — переиспользован из `automa.json` («В сброс»); `lint:i18n`, `make:json`, гард глоссария —
  зелёные. Ё: единственный кандидат «Марс вперед» (2 живых ключа) следует за чужим ключом `turmoil.json "Mars
  First"` = «Марс вперед» — имя партии рендерится из него везде (плитки, колонки, журнал); переписывать чужой
  перевод нельзя (правило локализации), расхождение с орфографией зафиксировано здесь как наблюдение владельцу.
- **A.10 · ОБНОВЛЕНИЕ называет сброшенных — сделано.** Ряды `data-sit-row="discarded"` (эмблема партии + имя +
  «В сброс») перед новыми резолюциями; снято из «честных ограничений»; гард в `console-parliament-sitting` (число
  рядов = `summary.discarded.length` с сервера).
- **Приёмка блока A (2026-09-20, ночь).** Юниты: `test:server` 12061 / `test:client` 5711 — зелёные; `build:test`
  (обе ступени), `lint:client`, eslint по изменённым файлам — зелёные. e2e (`--workers=1`, свой порт 8200 — второй
  клон гонял свой прогон на 8100): приёмочный набор `console-parliament*` + `console-external-draw` +
  `console-resolutions-playground` — **243 зелёных / 2 красных из 245 за 1.8 ч**; оба красных — `vote-fit` TV
  (RX05 climate-vote, RX04 powergrid-cap): «clipped-y con-parl__info-body 402 > 384» — одноразовый замер попал в
  вход поздних членов панели (GSAP-перенос по transform; перенесённый бокс — scrollable overflow, пока едет);
  в одиночку оба зелёные (51 с), причина в спеке: пробник обрезаний теперь `expect.poll` (настоящий клип держится и
  падает так же на таймауте), после чего TV-часть `vote-fit` 7/7. Промежуточные фокусные прогоны на финальной
  сборке: v2 9/9 (три профиля + тесный стол), climate/architecture/powergrid 32/32, announce Deck зелёный.
  Что при этом сдвинулось у соседей: подвал fullscreen-осмотра РЕЗОЛЮЦИИ (`.con-zoom--parliament`) стал двухстрочным,
  а его полоса действий — 8.5rem вместо общих 5.2rem (карта на сцене осмотра резолюции ниже на ~9 % на 1080);
  осмотр обычных карт не менялся (движок читает ту же полосу 5.2rem, что и прежде).
- **A.11 · паритет крошки TV/Deck — сделано в ЭТАЛОНЕ, ратчет → 0.** Замер членов шапки (пробник паритета пишет
  `tmp/chassis-<профиль>.json`): у «Действий карт» на TV ряд шапки 90 px (чипы фильтров 78 px), у «Колоний» 104
  (док флота), на Deck 62 (двухъярусные чипы) / 53 — общая шапка центрировала крошку в выросшем ряду, Парламент
  прикалывал её к 2rem-линии. Общая шапка получила токен линии крошки `--con-wshead-line` (2rem, Deck 1.6rem —
  прежний `min-height` лестницы), члены (`__ident`, `__aux`, `__trailing`, слой крошки) прикалываются к ней СВЕРХУ
  (`align-items: flex-start` + `min-height: line`), глубокий слой крошки — высотой в линию (хвост крошки на линии
  корня и на двухъярусной шапке Deck). Парламент читает тот же токен. Пробник паритета: `KNOWN_TOP_RESIDUAL = {}`
  (0 на всех профилях), таблица замеров — по всем workspace колеса.

### Блок B — второй аудит свежим взглядом (реестр P-…, аудит начат 2026-09-20 ночью)

Метод: галерея приёмочного прогона A (`screenshots/parliament-final/<профиль>/<режим>/NN-*.png`, 33 кадра × 3
профиля × {standard, reduced, fx-lite}, сборка `6e98083988`), кадр за кадром без правок; затем стадии заседания под
лупой, трейс-кадры двух заседаний, чтение локали целиком. Формат строки — как в реестре R: **№ · поверхность ·
состояние · профиль · факт (кадр) · класс · как исправить · статус**. Статусы: `проверить`, `сделано` (кадр
до/после), `доказано: <замер>` (не дефект).

- **P-01** · тайлы партий, подписи слотов, плашка осмотра партии, токены журнала · любое · все · имена «МАРС ВПЕРЕД» и
  «УЧЕНЫЕ» без Ё рядом с «ЗЕЛЁНЫЕ» (01–05): парламент рендерит имена из чужого `turmoil.json` («Марс вперед»,
  «Ученые») · класс: орфография / один глоссарий · как исправить: свои ключи имён партий (`party name: <Party>` →
  «Марс вперёд», «Учёные», …) в ОДНОЙ функции `partyNameKey(party)`, которой говорят все парламентские поверхности
  и токены журнала; чужой ключ не трогать · статус: проверить (объём — все места, где имя партии печатается).
- **P-02** · слот резолюции без делегатов · пустой стол · все · три высказывания о пустоте на одном слоте: лента
  «Делегатов пока нет» + счёт «0 ДЕЛЕГАТОВ · Лидера пока нет · ВАШИ ▢▢ 0» — ×3 на свежем столе (01, 02, 05) ·
  класс: повтор / шум · как исправить: лента пустая (только зарезервированная высота — в неё и садятся кубы), счёт
  «0 ДЕЛЕГАТОВ · — · ВАШИ ▢▢ 0» с приглушённым тире в ячейке лидера (та же грамматика, что у ряда фактов
  «ЛИДЕР —»); высота строк не меняется (закон стабильности) · статус: проверить.
- **P-03** · панель голосования, шапка · выбранная карта принимается · все · «ПРИНИМАЕТСЯ» трижды на одной карте:
  бейдж слота прямо над панелью, бейдж в шапке панели, ряд фактов «ПРИНИМАЕТСЯ да» (TV-кадр vote-fit RX05) · класс:
  дублирование · как исправить: убрать бейдж шапки панели (слот называет победителя, ряд фактов — состояние и
  прогноз); свидетели спеков перевести на слот/ряд · статус: проверить.
- **P-04** · обзор, зона голосования · любое · все · бар «A ОТКРЫТЬ ГОЛОСОВАНИЕ · B НА ПОЛЕ» без X, хотя X на зоне
  поднимает карты в осмотр (02) · класс: неанонсированный глагол · как исправить: план команд зоны голосования
  несёт «X ОСМОТРЕТЬ» · статус: проверить (возможно, X там мёртв — тогда включить).
- **P-05** · обзор, ярус партий · любое · все · бар «X ОСМОТРЕТЬ · B НА ПОЛЕ» без A, хотя A на плитке открывает
  композер действия партии (03, 30) · класс: неанонсированный глагол · как исправить: «A ДЕЙСТВИЕ ПАРТИИ», при
  недоступности — заблокирован с причиной и `data-hint` · статус: проверить.
- **P-06** · осмотр партии, «ДЛЯ ВАС» · эффект партии недоступен · все · «У вас нет — его дали бы два ваших делегата
  на её резолюции» (04): «у вас нет» без дополнения, глоссарий говорит «недоступен» · класс: копия · как исправить:
  «Недоступен — его дали бы два ваших делегата на её резолюции» (ключ в `parliament.json`) · статус: проверить.
- **P-07** · подвал осмотра резолюции, чтение прогноза · на голосовании · все · подпись «ЕСЛИ ПОБЕДИТЕ — ШАГ ПОВЕСТКИ 1»
  при суффиксе панели «+1 ЕСЛИ ПОБЕДИТЕ · ШАГ ①» (05 ↔ 06) — два написания одной фразы · класс: глоссарий · как
  исправить: одна форма — панельная, с узлом шага · статус: проверить.
- **P-08** · подвал осмотра резолюции, чтения · любое · TV · плиты чтения на compact-размере: подпись .5rem = 20 px
  физических при поле .8rem (TV-кадр 06) · класс: пол шрифта TV · как исправить: TV-лестница
  `.con-zoom__bar-yield` (подпись .8rem, числа выше), замер ширины ряда фактов после · статус: проверить.
- **P-09** · осмотр партии, плашка · любое · 1080/TV · плашка — высокий бокс: эмблема и имя наверху, формула внизу,
  посередине пусто (04) · класс: композиция (полупустая плита) · как исправить: формула сразу под именем, высота
  плашки по содержимому (проверить движок центрирования колонок) · статус: проверить.
- **P-10** · журнал, корневая строка группы заседания · после заседания · все · «Марсианский парламент поколения 1
  собирается на заседание» (07) — предложение-повествование при глоссарии «Заседание»/«ПАРЛАМЕНТ»; дочерняя строка —
  объекты (резолюция · игрок → +1 РТ) · класс: глоссарий / проза · как исправить: корень объектами — «Заседание
  парламента · поколение 1» (ключ журнала — свой, парламентский) · статус: проверить.
- **P-11** · Информация, полоса «ЭФФЕКТЫ ПАРТИЙ» · эффект есть · все · «У вас есть: партия правит — принята резолюция
  «…»» (08) — «у вас есть» при чипе статуса «ДОСТУПЕН · партия правит» · класс: глоссарий (одна грамматика доступа) ·
  как исправить: «Доступен · партия правит» + резолюция объектом · статус: проверить.
- **P-12** · режим голосования, бейдж принимаемой карты · выбрана принимаемая карта · 1080 · на одном экране две
  формы одного факта: текст «ПРИНИМАЕТСЯ» на невыбранном слоте (05) и «★» на выбранном (09, 09b) · класс:
  один факт — одна форма · как исправить: одна форма на профиль (текст на 1080/TV, звезда с `data-hint` на Deck) ·
  статус: проверить.
- **P-13** · командная строка внутри вложенного шага (редактор оплаты, пикер награды) · оплата / выбор · все ·
  левая подпись бара меняется на «ОПЛАТА» (09b) / «ЭФФЕКТ РЕЗОЛЮЦИИ» (20) при крошке «ПАРЛАМЕНТ › … › ОПЛАТА» —
  вложенный шаг переименовывает бар хозяина · класс: закон «шаг отдаёт имя ВВЕРХ, титулуется крошка» · как
  исправить: контекст бара = корень workspace (общий слой — проверить, как ведут себя редактор оплаты и пикер в
  других workspace, править в одном месте) · статус: проверить.
- **P-14** · редактор оплаты, B · до подтверждения · все · «B СВЕРНУТЬ» (09b) для обратимой стадии — четыре глагола
  B: закрыть / назад / свернуть / нет; до коммита это «НАЗАД» · класс: закон B по фазе · как исправить: общий
  редактор оплаты берёт глагол из `backVerbFor` фазы (проверить семью) · статус: проверить.
- **P-15** · командная строка board home при плите анонса · политическая фаза · 1080 (Deck — проверить) · четыре
  глагола обрезаны многоточием: «A ОТКРЫ…», «Y ИНФОРМАЦ…», «X РАЗЫГРА…», «RT ДЕЙСТВ…» (10) — самый частый экран
  фазы · класс: бар не читается · как исправить: план команд бара при плите — по приоритету (короткая форма
  «ЗАСЕДАНИЕ» для A или снятие низкоприоритетных), никогда обрезание; замер на 1080 и Deck · статус: проверить.
- **P-16** · заседание, правительство · ВЕРДИКТ · все · кикер «ПРИНЯТАЯ РЕЗОЛЮЦИЯ» над ПУСТЫМ местом (11): карта
  ещё в области голосования, принятие — следующая страница · класс: неверное слово для состояния · как исправить:
  кикер по стадии («СТАРТОВОЕ ПРАВИЛО»/пусто до принятия) · статус: проверить.
- **P-17** · заседание, область голосования · ВЕРДИКТ / ПРИНЯТИЕ · все · оставшиеся карты уже ПЕРЕРАНЖИРОВАНЫ:
  «Архитектурная премия · ПРИНИМАЕТСЯ» при 0 делегатов, пока вердикт называет победителем «Климатические
  исследования» (11, 12) — сервер уже снял победителя и клиент показывает следующего лидера; «принимается» на
  экране с двумя разными резолюциями · класс: два состояния стола на одном экране (та же болезнь, что R-25в) · как
  исправить: стол «как проголосовали» держится через ВСЕ страницы assembly (снимок слотов на входе в заседание,
  `heldSlots` обобщить с позы НАГРАДА на вердикт/принятие), бейдж следующего лидера появляется на ОБНОВЛЕНИИ ·
  статус: проверить (высокий приоритет).
- **P-18** · заседание, панель вердикта · ВЕРДИКТ · все · кикер «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ» над плитой «ПОБЕДИТЕЛЬ
  ГОЛОСОВАНИЯ · player1» (11) — дубль; объект панели — резолюция («принимается») · класс: дублирование · как
  исправить: кикер «ПРИНИМАЕТСЯ» (глоссарий: резолюция принимается), плиты — делегаты · победитель · статус:
  проверить.
- **P-19** · заседание, панель стадии · ВЕРДИКТ / ПРИНЯТИЕ · 1080/TV · нижняя половина панели пуста (11, 12) —
  панель одной высоты на все страницы · класс: композиция (полупустая плита) · как исправить: доказать законом
  стабильности (одна высота — ничего не прыгает между страницами), либо содержимое стадии занимает высоту
  (карта победителя как объект панели?) — решить по кадрам 13–19 · статус: проверить.
- **P-20** · заседание, бар · ПРИНЯТИЕ / НАГРАДА (чтение) · все · подписи A перепутаны местами: на ПРИНЯТИИ
  «ПРОДОЛЖИТЬ» (12), на странице НАГРАДА — «К НАГРАДЕ» (13) при крошке «› НАГРАДА» · класс: глагол не по тому, что
  идёт дальше · как исправить: на принятии «К НАГРАДЕ», на чтении награды — «ПОЛУЧИТЬ» (или «ПРОДОЛЖИТЬ», если
  выплата уже идёт), проверить `sittingBeats`/подписи гейта · статус: проверить.
- **P-21** · встроенный добор (ПОЛУЧЕНИЕ), бар · обязательный добор · все · «B ЗАБРАТЬ ВСЕ» (15): B — глагол
  назад/закрыть/свернуть, здесь — действие вперёд · класс: закон B по фазе (общая поверхность
  `ExternalDrawIntake`) · как исправить: «забрать все» — на Y/RT (семейный глагол пакета), B у шага внутри
  workspace — «нет» (некуда назад) · статус: проверить (семья: где ещё интейк говорит B = забрать все).
- **P-22** · заседание, ОБНОВЛЕНИЕ · колода пуста, сброс перетасован · все · одна карта в двух рядах: «Архитектурная
  премия · В СБРОС» и «Архитектурная премия · НЕЙТРАЛЬНЫХ ДЕЛЕГАТОВ: 1» (18) — читается абсурдом; в галерее это
  артефакт фикстуры с пулом в 2 карты, но в живой игре наступает на дне колоды · класс: честность ряда · как
  исправить: карта, вернувшаяся тем же обновлением, — один ряд «перетасована · остаётся»; фикстуры галереи —
  пул ≥ 5 · статус: проверить.
- **P-23** · заседание, ОБНОВЛЕНИЕ · любое · все · проза «Свободные делегаты всех игроков возвращаются в лобби»
  (18) на игровом экране · класс: проза вместо объектов · как исправить: ряд объектами «В ЛОББИ · [куб]×n [куб]×m»
  (по кресел), либо строка исчезает — возврат виден в зоне делегатов шапки (кубы летят) · статус: проверить.
- **P-24** · заседание, ЗАКРЫТИЕ, «ИТОГИ ПОКОЛЕНИЯ» · любое · все · плита «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ» называет
  РЕЗОЛЮЦИЮ («Климатические исследования», 19) — глоссарий: победитель голосования — ИГРОК, резолюция —
  «принята» · класс: терминология (R-01) · как исправить: «ПРИНЯТА · <резолюция>» + «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ ·
  <игрок>»; гард глоссария — запрет «победитель голосования» рядом с именем резолюции · статус: проверить.
- **P-25** · кресло председателя, выбор делегата · делегаты зрителя на трёх резолюциях · все · панель показывает ОДИН
  ряд-кандидат с «◂ ▸» (23) при «ВАШИ 2 / 3 / 2» на трёх слотах — остальные кандидаты скрыты за листанием ·
  класс: скрытая цель (инвариант 3) · как исправить: все кандидаты рядами, курсор между ними; проверить, не
  ограничивает ли правило список одной резолюцией (тогда «◂ ▸» — шум) · статус: проверить.
- **P-26** · Полигон, нижняя строка · любое · все · «R3 Прокрутка · LB RB Секции · B Назад» строчными, не на
  семейном баре (25) · класс: семейный бар · как исправить: семейный командный бар (капс, глифы, приоритет) ·
  статус: проверить (dev-поверхность, но в реестре).
- **P-27** · Полигон, осмотр · любое · все · под подвалом осмотра остаётся строка Полигона — два бара на экране
  (26); пейджер осмотра «LB ◀ ЛИСТАТЬ ▶ RB» против «LB ◀ 1/3 ▶ RB» в Парламенте и верхняя плита-счётчик «1 / 11» ·
  класс: два бара / две формы одного элемента (R-08, R-22 — блок C) · как исправить: строка Полигона уступает
  открытому осмотру; форма пейджера — одна (позиция) · статус: проверить (C).
- Композер действия партии (24) снят из «Действий карт» (двери колеса) — крошка «ДЕЙСТВИЯ КАРТ › …» там верна;
  дверь из Парламента (крошка «ПАРЛАМЕТ › …») держит спек `console-parliament-v2` § the parties' door — проверить
  крошку в нём при правке P-13.
- **P-28** · заседание, область голосования · НАГРАДА, плита «ПРОПУЩЕНО» (Biodome, нет клетки) · все · КАРТЫ
  ИСЧЕЗЛИ: оба слота — пустые рамки с одними счётчиками (27b), кадром раньше карты стояли (27); колода при этом
  «×2» — сброшенные уже ушли в колоду, а лица новых спрятаны hold-ами обновления без снимка стола
  (`heldSlots` сеется только для «первой страницы renewal с ответом») · класс: пустой стол на игровом экране
  (R-25в, та же болезнь — высокий приоритет) · как исправить: обобщить снимок стола (P-17): стол «как проголосовали»
  держится от входа в заседание до бета ОБНОВЛЕНИЯ на любом маршруте (пропуск, ожидание, уступка полю) ·
  статус: проверить.
- **P-29** · статусная полоса HUD · пять кресел · 1080 · имена игроков обрезаны до «pl…» (29, 30): пять плиток по
  ~95 px · класс: чужая поверхность (общий HUD) · доказано кадром 29: обрезание в СВОЁМ боксе, парламент не
  меняет полосу; в реестр Парламента не входит, отдано владельцу HUD · статус: доказано.
- **P-30** · задание председателя, строка награды · любое · Deck · перенос «ПРЕДСЕДАТЕЛЬСТВО + / ШАГ ПОВЕСТКИ → ③»
  с висящим «+» в конце строки (Deck 11, 13) · класс: перенос внутри неделимой формулы · как исправить:
  «+ ШАГ ПОВЕСТКИ → ③» — одна неразрывная единица (`white-space: nowrap` на члене, перенос ПЕРЕД «+») · статус:
  проверить.
- **P-31** · встроенный пикер на шесть карт · ВЫБОР · Deck · у трёх из шести карт нет арта (чёрные окна: Рыба, Домашние
  любимцы, Домашний скот — Deck 20b), на 1080 все шесть с артом · класс: кадр галереи снят до декодирования арта
  (`img.complete` ≠ нарисовано) либо арт не грузится · как исправить: галерея ждёт `decode()` арта пикера перед
  кадром; если чёрные окна остаются — дефект загрузки · статус: проверить.
- Deck-кадры 05/11/13/20b: панели голосования и заседания входят в экран без обрезаний; дефекты 1080 (P-16…P-19,
  P-13) на Deck те же; «★» на Deck — единственная форма бейджа (P-12 — про 1080).

#### Чтение локали целиком (`src/locales/ru/parliament.json`, 521 ключ, как редактор)

- **P-32** · журнал · ничья / уход из правительства · все · «слот «Принята»» (`Tie among resolutions…`, `Resolution
  ${0} leaves the ENACTED slot`) при глоссарии «правительство» (тот же файл: «ничья: ближе к правительству») · класс:
  один глоссарий · как исправить: «ближе к правительству» / «покидает правительство» · статус: проверить.
- **P-33** · журнал · сброс без меток (Красные) · все · «${0} сбросил карты без меток…» — прошедшее время при
  настоящем во всех соседних строках («отправляет», «получает», «использует») · класс: единый стиль журнала · как
  исправить: «сбрасывает карты без меток…» · статус: проверить.
- **P-34** · доступ к эффекту партии · нет доступа · все · две формы одного состояния: «Нет доступа» (`No access`) и
  «недоступен» (`not available to you`); семь ключей «У вас есть: …» / «У вас нет — …» (P-06, P-11) · класс: одна
  грамматика доступа · как исправить: «Доступен · …» / «Недоступен · …» везде; `No access` → «Недоступен» ·
  статус: проверить.
- **P-35** · сброс Красных, итог · любое · все · «за меток: ${0}» (`for ${0} tag(s)`) · класс: форма числа · как
  исправить: «за ${0} {метку|метки|меток}» · статус: проверить.
- **P-36** · Полигон, размеры карты · любое · все · «Размер в fullscreen» — латиница в русской подписи при глоссарии
  «осмотр» · класс: глоссарий · как исправить: «Размер в осмотре» · статус: проверить.
- **P-37** · Полигон, сценарии · кислород на максимуме · все · «плитка всё равно даёт РТ», «плитка даёт только свой
  РТ» — «плитка» о тайле поля (глоссарий: тайл) · класс: глоссарий · как исправить: «тайл» · статус: проверить.
- **P-38** · вся локаль · любое · все · 28 значений с кириллическим «М€» при латинском «M€» во всём остальном RU
  (`ui.json` 97 : 1, `cards.json` 104 : 4, `turmoil.json` 12 : 0) · класс: одно написание валюты · как исправить:
  латинское «M€» во всех значениях `parliament.json` (свои ключи), гард глоссария — запрет «М€» · статус: проверить.
- Собственные ключи с «Марс вперед» без Ё (`Mars First pays 1 steel…`, `Mars First draws a card…`) — часть P-01,
  правятся сразу (свои).
- Формы числа проверены: «{животное|животных|животных}», «{карту|карты|карт}», «{шаг|шага|шагов}»,
  «{делегат|делегата|делегатов}» — верны; «Победитель — нейтральный: …», «Размещает: …», «Размещено · …» — по
  глоссарию.

#### Правки блока B (после аудита; статусы реестра)

- **P-01 · сделано.** `partyNameKey(party)` (`console/parliament/partyNames.ts`) — шесть собственных ключей
  `party name: <Party>` («Марс вперёд», «Учёные», …); все места печати имени (слоты, правительство, плашка партии,
  реакция партии, стенд, заседание, токен партии в журнале) говорят через него; чужой `turmoil.json` не тронут; свои
  два ключа с «Марс вперед» исправлены. Гард глоссария запрещает «марс вперед»/«ученые» в значениях файла.
- **P-02 · сделано.** Пустой слот: лента без текста (высота зарезервирована — в неё садятся кубы), ячейка лидера — «—»
  (грамматика ряда фактов); ключи `No delegates yet`/`No leader yet` удалены (GONE в гарде). Гард: `vote-fit` (лента
  пуста, «—»), стабильность — высоты строк прежние.
- **P-03 · сделано.** Бейдж шапки панели голосования снят; гард `vote-fit`: `.con-parl__info-head .con-parl__slot-win` = 0.
- **P-04 · доказано.** X на зоне голосования ничего не делает (`ConsoleParliamentSection.secondary` — нет ветки
  `voting`; `parliamentCommands.ts`: «No X here: the voting area is ONE zone with no card of its own selected»);
  осмотр принадлежит выбранной карте режима — бар честен.
- **P-05 · сделано.** A на плитке партии показывается и при «нет доступа» — приглушённый (`enabled: false`),
  плитка несёт причину, нажатие открывает поверхность действия с вердиктом; скрыт только у партии без действия.
- **P-06 · P-11 · P-34 · сделано.** Одна грамматика доступа: «Доступен · …» / «Недоступен · …» (десять ключей),
  «Нет доступа» → «Недоступен», «У вас нет эффекта этой партии» → «Эффект этой партии вам недоступен»; гард
  глоссария запрещает «у вас есть/нет», «нет доступа».
- **P-07 · сделано.** Подпись прогноза в подвале осмотра — «Если победите · шаг Повестки N» (форма панели).
- **P-08 · сделано.** TV-лестница плит чтения в подвале осмотра (`html.con-profile-tv .con-zoom__bar-yield`: подпись
  .8rem, числа 1.05/1.3/1.4rem, иконки 1.2/1.35rem); свидетель `expectInspectorFooterWhole` (climate, три профиля).
- **P-09 · доказано.** Плашка партии в осмотре — карта партии семьи печатей (`.con-pseal--aside`): эмблема и имя
  наверху, формула внизу — те же пропорции, что у плитки партии и у формулы в правительстве; «пусто посередине» —
  зона карты, как у карты проекта между заголовком и низом; не дефект.
- **P-10 · сделано.** Корневые строки заседания в журнале — «Заседание парламента · поколение N», «Заседание
  поколения N: вердикт и принятие», «Заседание поколения N закрыто».
- **P-12 · сделано (с замером).** Форма бейджа — по профилю (`glyphBadge = isHandheld || isTv`), не по длине имени
  партии: слово на 1080 (каждое имя помещается рядом — клип-пробник `vote-fit`), глиф с `data-hint` на Deck и TV.
  Первый вариант «слово и на TV» упал в `console-parliament-v2` tv-4k: «ИНДУСТРИАЛИСТЫ» 311 px + слово 292 px +
  эмблема и зазоры = 681 px в ряду подписи 608 px — имя партии резалось; замер пробником по слотам. Гард `vote-fit`
  (одна форма на профиль, у каждого глифа подсказка).
- **P-13 · сделано (пикер) · доказано (оплата).** Вложенный пикер в зоне стадии заседания: бар называет СТАДИЮ
  («ВЫБОР» — `followUpStepStage`), как встроенный добор называет «ДОБОР КАРТ» (закон «один голос в двух местах»);
  редактор оплаты и раньше называл стадию («ОПЛАТА» = хвост крошки) — семейный закон, не дефект.
- **P-14 · доказано.** «B СВЕРНУТЬ» в редакторе оплаты — глагол общего редактора (семья: редактор — стадия
  внутри workspace, B сворачивает весь workspace с сохранением оплаты, тот же глагол в оплате карт); менять —
  семейное решение вне парламента.
- **P-15 · сделано (общий бар, с замером).** Планировщик бара МЕРИТ подписи (`consoleTextMeasure.ts`: canvas +
  шрифт подписи бара + трекинг, запас 2 %), оценка «0.6 rem/символ» осталась только до первого кадра; заглавные
  русские подписи она недосчитывала на ~20 % — план держал все восемь команд board home, и бэй-режим резал четыре
  слева. Гард `console-parliament-announce`: ни одной обрезанной подписи бара под плитой на трёх профилях.
- **P-16 · сделано.** Кикер правительства при карте в пути — прежнее основание (`govBasisKey`: «Стартовое правило»,
  пока `holds.govAwaits` держит место и прежнего принятого не было); гард в `console-parliament-sitting` (вердикт:
  «Стартовое правило», награда: «Принятая резолюция»).
- **P-17 · сделано.** `winningShownOf(slot, decided)` + `voteDecidedAt(step)` (шаги фазы до обновления): на
  решённом столе ни одна карта не «принимается» — бейдж и класс возвращаются с обновлённым столом; гард в
  `console-parliament-sitting` (вердикт/награда: 0 бейджей, обновление: 1).
- **P-18 · сделано.** Кикер панели вердикта — «ПРИНИМАЕТСЯ» (состояние резолюции), плита «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ ·
  игрок» — ряд; гард в спеке заседания.
- **P-19 · доказано.** Одна высота панели на все страницы — закон стабильности (страницы меняются без прыжка кадра;
  `console-parliament-stability` § страницы заседания держит высоты); самая высокая страница — награда.
- **P-20 · доказано.** Подписи A по `sittingPrimaryKey`: страница до последней — «Продолжить», последняя страница
  assembly — «К награде», когда что-то придёт этому креслу (гейт 1 отвечается на чтении награды, и выплата летит
  после него); глагол следует за тем, что придёт.
- **P-21 · доказано.** «B ЗАБРАТЬ ВСЕ» — глагол семьи добора (`drawnRevealCommandRun`): B в добор-интейке всегда
  «забрать всё и закрыть» — это и есть его «закрыть»; тот же контракт во всех доборах консоли.
- **P-22 · P-28 · сделано.** `returningInstances(summary)` (`sittingBeats.ts`): карта, названная и в `discarded`, и в
  `refreshed` (перетасованный сброс), не «свежая» — лицо не прячется, бет обновления её не улетает и не сдаёт, ряд
  обновления говорит «остаётся · перетасована». Пробник (временный спек) показал механизм: при пустой колоде обе
  карты стола прятались `freshFaces` на весь показ плиты пропуска (t = 19.3 → 21.8 с). Гард в галерее (27b): под
  плитой у каждой карты стола видно лицо.
- **P-23 · сделано.** Ряд «В ЛОББИ · [куб]…» вместо предложения; ключ журнала (сервер) остаётся; гард в спеке
  заседания (число кубов = `lobbyRefilled.length`, предложения нет).
- **P-24 · сделано.** Карточка закрытия: «ПРИНЯТА · <резолюция>» и «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ · [куб] игрок»; гард в
  спеке заседания.
- **P-25 · доказано.** Кандидаты кресла — сами слоты (`.con-parl__slot--candidate`, курсор ходит по ним), панель
  показывает сделку выбранного; ни одна цель не скрыта.
- **P-26 · P-27 · → блок C** (R-08, R-22: стенд).
- **P-29 · доказано** (общий HUD, см. выше).
- **P-30 · сделано.** «+ ШАГ ПОВЕСТКИ → ③» — одна неразрывная единица (`.con-parl__reward-tail`).
- **P-31 · сделано (галерея).** `shoot` ждёт `decode()` всех картинок (до 4 с) перед кадром.
- **P-32 · P-33 · P-35 · P-36 · P-37 · P-38 · сделано** (локаль; гард глоссария: «слот «принята»», кириллическое «М€»,
  «плитка», «размер в fullscreen» запрещены).

- **Процесс (ночь на 2026-09-21).** Сессия прервалась посреди фокусного прогона B (осиротевший Playwright с
  сервером на 8200 добит вручную); `test:server`, запущенный РЯДОМ с живым e2e, дал 7 красных — все «Timeout of
  2000ms» в корпусных спеках (RoboticWorkforce, Lowell, DutchMountains, actionPreview, potentialActions, realtime)
  и упавший счётчик collected: контенция CPU, не код; юнит-гейты дальше — только последовательно с e2e, на тихой
  машине (заметка памяти `unit-suites-need-a-quiet-machine`). Свидетель A.10 в спеке заседания переведён на закон
  P-22: сброшенные = `discarded` минус вернувшиеся (те же instance в `refreshed`), у вернувшихся — ряд «остаётся».

- **Приёмка блока B (2026-09-21).** Фокусные партии на финальной сборке: заседание 6/6 (после починки свидетеля
  A.10 под закон P-22), анонс/стабильность/климат/v2 — зелёные (v2 TV дал единственный настоящий красный блока:
  слово «ПРИНИМАЕТСЯ» рядом с «ИНДУСТРИАЛИСТЫ» на TV резало имя партии — 681 px в ряду 608 px; форма бейджа на
  TV переведена на глиф с подсказкой, замер в P-12), галерея (журналы пропуска) 18/18, vote-fit 21/21; разовый
  красный Deck-заседания «страница держится на НАГРАДЕ, стол уже обновлён» не воспроизвёлся при трёх повторах
  (`--repeat-each=3`: 6/6) и остаётся под наблюдением как класс R-25в (кадр сохранён в
  `test-results/…sitting…deck-handheld…/test-failed-1.png` того прогона). Приёмочный набор `console-parliament*` +
  `console-external-draw` + `console-resolutions-playground` — **245 / 245 зелёных за 1.6 ч** (`--workers=1`, порт
  8200, машина тихая — юнит-гейты после, последовательно).
- **Юнит-гейты B (тихая машина, последовательно):** test:server 12061 / 0; test:client 5711 / 0 при повторе (первый полный прогон дал один таймаут 2 с в consolePlayedHero — «the animation transaction»; спек в одиночку 3/3 по 17 зелёных, класс — нагрузочный таймаут анимационного спека, не код); build:test обе ступени, lint:client, eslint по изменённым файлам — зелёные.

### Блок C — пересмотр строк «вне скоупа» и «отложено» (2026-09-21)

Правило блока: дефект, видимый на поверхности Парламента, — парламентский, даже если живёт в общем chassis: либо
правка в общем слое с пробником-паритетом, либо доказательство кадром и замером.

- **R-08 · R-22 · P-27 · сделано (общий слой + стенд).** Осмотр со стенда открывается с `counterInFooter` — позиция
  «LB ◀ 1/11 ▶ RB» в подвале, как в Парламенте; плиты-счётчика над картой и пейджера «ЛИСТАТЬ» больше нет. Первый
  прогон показал, что осмотр стенда живёт НЕ в игровом shell, а в хосте меню (`ConsoleMenuZoomHost.vue`), у которого
  не было ни позиции в подвале, ни `navCounter` по флагу — хост меню теперь печатает ту же грамматику, что shell
  (одна форма пейджера для обоих хостов). Строка
  подсказок стенда (`ConsolePlaygroundStand`, общий хост dev-стендов меню) скрыта (`v-show`), пока открыт
  fullscreen-осмотр (`consoleCardZoom.card`) — один командный ряд на экране. Гард: `console-resolutions-playground`
  (позиция в подвале, 0 плит `.card-zoom-topbar`, строка стенда скрыта).
- **P-26 · сделано (общий слой).** Подсказки стенда — семейный регистр глаголов (капс, трекинг .08rem, вес 700), как
  печатает каждую подсказку командный бар; паритет: правило на `.cm-stand__hint`, общее для всех стендов меню.
- **R-20 · сделано (общий слой, с паритетом).** Полоса статуса при четырёх и более креслах (`denseSeats`): у
  ОЖИДАЮЩИХ кресел слово уступает точке (`.con-status__pstatus-text` не рендерится), пилюля без нижнего порога
  ширины, имя до 12rem; активное кресло держит слово и счётчик. Гард: `console-parliament-v2` § тесный стол — ни
  одного обрезанного `.con-status__pname` при пяти креслах, у ожидающих кресел 0 слов; паритет — обзор на двух
  креслах: слово ожидающего кресла на месте.
- **R-15 · доказано (семейная конвенция).** CTA на поверхности + эхо в баре — язык всей консоли, не плиты анонса:
  кадр 05 (панель «A Отправить делегата» + бар «A ОТПРАВИТЬ ДЕЛЕГАТА»), 09b (редактор «X ОПЛАТИТЬ» + бар), 23
  (панель кресла «A Забрать делегата» + бар); закон «один бар владеет глаголами» — про то, что панель не рисует
  ВТОРОЙ набор, а не про то, что CTA поверхности запрещён. Плита анонса после A.5 говорит «Открыть», бар —
  «Открыть заседание»; убрать одно — сломать конвенцию на каждой поверхности консоли.
- **R-28 · доказано (калиброванная лестница).** Регистр названий на премиум-грани — ярусы длины грани
  (`docs/claude/premium-card`, заметка памяти `length-tier-ladder-calibration`): короткие названия капсом, длинные —
  строчными, чтобы уместиться в одну строку шапки на всех трёх профилях; правило одно для ~1000 карт игры (кадр 05:
  «ЦЕНТРАЛЬНАЯ ЭНЕРГОСЕТЬ» / «Конкурс водоносных пластов»). Парламентская правка невозможна без смены лестницы
  всей грани — и сломала бы фит названий проектов.
- **R-32 · доказано.** «ИСТОЧНИК» на плите подвала (кадр 16) — не глагол, а РОЛЬ осмотра (`statusLabel: 'Source'`,
  семейная пилюля состояния `.con-zoom__state`, та же, что «ВЫБРАНА» у пикера); глагол «L3 ИСТОЧНИК» живёт в баре.
  Глиф на пилюле состояния читался бы как вторая команда.
- **R-33 · доказано (закон центрирования).** Колонки осмотра стоят ЦЕНТРОМ на карте (`expectInspectorScene`,
  `console-parliament-v2`: «both side columns stand CENTRED on the card»); при разной высоте колонок их верхние
  края расходятся ровно на половину разности высот (1080, кадр 06: 155 против 215 — левая колонка на 120 px ниже
  правой). Общая верхняя линия нарушила бы закон центрирования и поставила бы короткую колонку в верхний угол.
- **R-23 · R-24 · открыто, с замером (общий якорь).** Дельта-чип «+2» ложится на рамку строки рельсы (кадр 15, 21) и
  бейдж «+1» на счётчик дока (17): оба — один якорь `metric-feedback-host` (`AnimatedMetricValue`, 8 компонентов-
  потребителей: рельса ресурсов, HUD РТ/ПО, параметры, док руки, колонии, гидросеть, оплата, размещение) — чип
  садится на правый верхний угол хозяина «полувне» рамки, как значок уведомления, одинаково у всех восьми. Сдвиг
  якоря внутрь рамки — общая правка всех восьми потребителей с паритетным пробником по каждому; в этом блоке не
  сделана (объём отдельной итерации «язык дельта-чипа»), честно оставлена открытой — единственная строка реестра
  без правки и без доказательства поломки.
- **Приёмка блока C (2026-09-21).** e2e: стенд + галерея стенда 21/21 (после переноса позиции в подвал хоста меню),
  v2 (три профиля + тесный стол — паритет полосы статуса) + анонс + паритет chassis 15/15. Юниты (тихая машина):
  `test:client` 5711 / 0 при повторе — первый полный прогон дал один таймаут 2 с в `consoleTilePlacement`
  («the animation transaction»; в одиночку 3/3 по 27 зелёных) — тот же класс, что `consolePlayedHero` в B: два
  разных анимационных спека по одному таймауту в полных прогонах, ни разу в одиночку; `build:test`, eslint,
  статические гарды консоли (255) — зелёные.

### Блок D — готовность к семействам резолюций (2026-09-21)

- **D.1 · репетиция семейств — сделано кадром, с двумя находками.** Четыре dev-фикстуры генератором
  (`familyTable` в `generate.ts`: RDX_DEV_PASSIVE / RDX_DEV_ACTION в первом слоте с делегатом синего, Повестка 2 / 5 —
  тот же стол, что у RX01, чтобы кадры сравнивались; `-vote` и `-assembly`; `expect` фикстуры различает «в слоте» и
  «принята» — на воротах assembly победитель уже в правительстве, а не в слоте) и тест галереи «the FAMILIES
  rehearsal» (`console-parliament-gallery.spec.ts`, кадры 31 · 31b · 31c · 32 · 32b · 33 · 33b на трёх профилях × трёх
  режимах): лицо → голосование → осмотр → заседание (вердикт → принятие → НАГРАДА) → ворота → обновление → закрытие.
  Находка 1 — **стадия НАГРАДА была бы пуста**: резолюция без немедленных шагов не давала стадии ничего, кроме
  «Без награды» в закрытии. Теперь `quietRewardPoseOf(resolution)` (`quietRewardPose.ts`, реэкспорт из
  `consoleSittingFlow.ts`) читает `text.passive` → «ЭФФЕКТ, ПОКА ПРИНЯТА · <декларация>» или `text.action` →
  «ДЕЙСТВИЕ, ПОКА ПРИНЯТА · <декларация> · Доступно в «Действиях карт»» (`.con-sit__quiet`, `data-sit-quiet`);
  карточка закрытия говорит то же. Находка 2 — **панель голосования лгала кикером**: на пассиве бокс «для вас»
  печатал «ПРИ ПРИНЯТИИ» над графикой карты — графика читалась как выплата при принятии, которой нет (кадр
  `tmp/tr-fam1/…/test-failed-1.png` первого прогона). Теперь `voteReadingOf` при пустом чтении берёт кикер тихой
  награды из того же модуля (`QUIET_REWARD_KICKER` — одни слова в панели, на стадии НАГРАДА и в закрытии; зритель без
  кресла по-прежнему «ПРИ ПРИНЯТИИ»). Гарды: `consoleSittingFlow.spec` (позы по каталогу: passive / action / у
  RDX_DEV_IMMEDIATE, RDX_DEV_COMPOUND и RX01 позы нет), `voteInfoModel.spec` (кикер пассива / действия у кресла,
  зрителю — plain), e2e семейств (кикер панели, `[data-yield-context]` = 0 на обеих поверхностях, `data-sit-quiet` на
  стадии, адрес только у действия, текст закрытия, `expectInspectorFooterWhole` на осмотре пассива).
  Находка 3 (кадры 32 / 33 первого прогона) — **декларация под кикером повторяла свой род**: «ЭФФЕКТ, ПОКА ПРИНЯТА ·
  Эффект: каждый раз…». Префикс «Effect: / Action:» — часть ключа (совместно расположенный текст DSL); всякий блок,
  который показывает род своим чипом, срезает его с ПЕРЕВЕДЁННОГО текста и ставит заглавную (`actionRuleText`:
  перевод → `stripKindPrefix` → заглавная — так читают поверхности действий карт и панель «Правила» осмотра) — стадия
  теперь читает через тот же помощник (второй прогон показал «потратьте 2 M€…» со строчной после голого среза). Находка 4 (кадр 33) — **плакетка
  правительства называла графику ДЕЙСТВИЯ «Эффект резолюции»**: кикер теперь следует части принятой карты
  (`enactedOwnPart`: `hasAction && !hasPassive` → «Действие резолюции», иначе «Эффект резолюции» — те же два ключа,
  что у блоков правил осмотра; `data-parl-enacted-part`). Обе находки читает e2e семейств.
- **D.2 · сделано.** `quietResolutionOf`: Красные → `RDX_DEV_COMPOUND`, Учёные → `RDX_DEV_SCIENCE`; Союз — честная
  ошибка с указанием, что dev-заместителя нет (в каталоге нет резолюции Союза даже среди dev-примеров).
- **D.3 · сделано (доки).** `rewardAddress.ts` § «FUTURE KINDS — how to add one»: эскиз адреса (поверхность ·
  источник · единица · стадия · чтение · плита пропуска · поза галереи) для `stockLoss`, `globalParameter`,
  `agendaStepAll`, `colonyTrack`, `colonyToWinner`, `cityEveryone`, `drawUpTo`; чек-лист §4 п. 4–5 переписаны.
- **D.4 · сделано.** Контракт § 9 · THE SEAM (`ResolutionContract.spec`, реальные и dev-примеры): пассив без
  `forecast` / действие без `preview` / без текста декларации — красный; резолюция без немедленных шагов, пассива и
  действия («стадия НАГРАДА была бы пуста») — красный.
- **Приёмка блока D (2026-09-21).** e2e-набор Парламента (`console-parliament*` + `console-external-draw` +
  `console-resolutions-playground`, `--workers=1`, порт 8200) на сборке с четырьмя находками: **247 / 254 за 1,7 ч**;
  семь красных перегнаны поимённо — все зелёные: 1 — Deck, RX04 «the tick rides the touchdown» (тик за 1 252 мс до
  посадки чипа; класс таймингов Deck под нагрузкой, повтор 1/1 за 25 с), 6 — стенд TV/Deck «browserContext.newPage:
  Target crashed» → «worker process exited unexpectedly (0xC0000142)» на ПОСЛЕДНЕМ спеке прогона — обрыв сессии
  инструмента, не продукт (повтор всех восьми TV/Deck-тестов стенда 8/8 за 3,2 мин). Тест семейств «the FAMILIES
  rehearsal» — 9/9 (три профиля × три режима), кадры 31–33b пересмотрены глазами на 1080/TV/Deck. Юниты и линт —
  строкой ниже.
- **Ворота блока D (тихая машина, 2026-09-21).** `test:server` 12 073 / 0 (1 pending, collected 12 074), `test:client` 5 712 / 0,
  `build:test` (обе ступени), `lint:client` (vue-tsc), eslint по изменённым файлам — зелёные; `make:json` без дубликатов.

### Итог финальной полировки (2026-09-21)

- **Блоки.** A — 11 хвостов с доказанным расхождением закрыты кодом с замером (`6e98083988`). B — второй аудит свежим
  взглядом: реестр P-01…P-38, 25 правок кодом, 8 доказательств кадром/законом, «отложено» — 0 (`48fb120f35`). C —
  строки «вне скоупа» пересмотрены: 5 правок в общем слое с паритетным пробником, 4 доказательства; открыта одна —
  R-23/R-24, язык дельта-чипа (общий якорь на восемь потребителей — отдельная итерация, замер в C) (`f8e13b7873`).
  D — репетиция семейств кадром на dev-примерах: четыре находки закрыты кодом, эскизы семи будущих видов наград,
  контракт § 9 · THE SEAM (коммит D). E — галерея пересобрана на финальной сборке (39 кадров × 3 профиля × 3 режима,
  кадры 31–33b — семейства), сценарий приёмки `docs/claude/parliament-acceptance-walkthrough.md`, доки/память закрыты
  (коммит E).
- **Прогоны на сдачу.** e2e-набор Парламента после D: 247/254 + 7 перегнаны поимённо → все зелёные (класс: 1 тайминг
  Deck, 6 — обрыв сессии инструмента на последнем спеке). Юниты на тихой машине: `test:server`, `test:client`,
  `build:test`, `lint:client`, eslint по изменённым файлам — зелёные (цифры — в приёмке блока D). **Полный
  `tests/e2e` в E не гонялся — по указанию пользователя (2026-09-21: «делай только точечные проверки твоих
  ченжей»)**; последний полный прогон — Э9 (641/26/11, 2026-09-20), классы чужих красных — там же; правки полировки
  вне Парламента — общий слой (`CardZoomModal` читает полосу действий, `ConsoleCommandBar` мерит подписи,
  `ConsoleStatusStrip` при 4+ креслах, `ConsoleMenuZoomHost` позиция в подвале, `JournalTokenRenderer` имена партий)
  — каждая с паритетным пробником в своём спеке.
- **Открыто после полировки (честно, с причиной).** R-23/R-24 — дельта-чип; Союз без dev-заместителя (в каталоге нет
  карты Союза даже среди dev-примеров — `quietResolutionOf` бросает честную ошибку); классы разовых таймаутов под
  нагрузкой (анимационные клиентские спеки в полных прогонах; Deck-заседание «страница держится на НАГРАДЕ» 1/4 и
  «тик до посадки» 1/1 — оба зелёные в одиночку).

## Заседание v2 (2026-09-21, одна автономная итерация; док `docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md`)

### Режим
Экономный (§0 задания): юниты по чистым моделям, только НОВЫЕ точечные пробники (`--workers=1`, только эти файлы),
свои кадры как ревьюер. Галерея и старые суиты не гонялись; задетые старые e2e переписаны под грамматику v2 (список
ниже). Сборка перед пробниками: `make:json → make:css → build`; никаких пересборок во время идущего playwright;
юниты — только после e2e.

### Решения
- **Б1.** Ворота сборки ДО изменений: `winner → assembly → agenda → support → enact → effects → refresh → lobby →
  adjourn → done`. Идемпотентные шаги; старый сейв (ворота после `enact`) — фикстура
  `tests/parliament/fixtures/legacy-assembly-after-enact.json`, спек проверяет равенство записей summary и сохранение
  пула поддержки (сама поддержка после `refresh` законно переезжает на свежие карты — ассерт «неизменна» был бы ложным).
  Фикстуры `parliament-*` перегенерированы (42), `e2eFixturesLoad` зелёный.
- **Б2.** Один проход директора (`runWalk`): страницы шага сервера, авто-страницы ПРИНЯТИЕ/НАГРАДА, стопы — вердикт,
  свой шаг, ожидание, итоги. Удержания — из диффа двух видов ОДНОЙ функцией (`parliamentSittingSeed.ts`) в том же
  синхронном блоке, что применение вида, на обоих путях (собственный ответ / опрос). Биты ПОВЕСТКА → ПОДДЕРЖКА →
  ПРИНЯТИЕ под своими удержаниями, `BEAT_GAP_MS = 250`; «дожать» = `hurry`; reduced — позы сразу (без удержаний и
  прокси). Внизу пять тайлов оппозиции, плитка правителя — тот же экземпляр (Teleport) в правительстве.
- **Б3.** Реестр без wall-clock (`parliamentNoTimers`: allow-list только `SUBMIT_SAFETY_MS`); выпуск по посадке / по
  явному концу стадии / по потолку 35 с с `diagnose`; бонус Повестки держится только на экране. Дверь тайла: плита
  «Ваш тайл ждёт на поле» + A «К полю»; только нажатие уступает стек; гексы ждут `boardDoorOpen`; возврат — квитанция
  на НАГРАДЕ («получено»).
- **Б4.** ИТОГИ — одна стадия: биты обновления над столом, затем REVEAL карточки «Итоги поколения N»; ожидание
  остальных — в строке заголовка карточки; A «Закрыть заседание». ОБНОВЛЕНИЕ/ЗАКРЫТИЕ удалены.
- **Б5.** `billGeometry` только при реальной `votePayment` и внутри фиксированной панели; `fitFrozen` от A до ухода;
  refit-вотчер удалён; уход — одно движение поверхности, `flow-complete` в момент посадки; `--concluded` удалён.

### Находки на своих кадрах и прогонах (каждая → причина → правка → гард)
1. **Пробник v2, 1080, первый прогон:** после плитки проход садился сразу в ИТОГИ — страница НАГРАДА уже была «сыграна»,
   а квитанция тайла в стартовую страницу не входила. → `sittingStartPage(position, played, receiptOwed)` +
   `planOpening` садит проход на НАГРАДУ; юнит в `consoleSittingFlow.spec`.
2. **Кадры 06-results на всех профилях:** карточка ИТОГОВ ЧАСТИЧНО перекрывала дорожку Повестки (подпись дорожки
   скрыта, узлы торчат из-под плиты). Причина конструктивная: сцена растёт из яруса по содержимому (`bottom: auto;
   max-height: 100% + agenda-h`), а карточка на четыре ряда выше яруса на ~50 px. → три колонки × две строки
   (ожидание — в заголовке, не ряд); на Deck ярус 8.4rem мал — сцена ИТОГОВ берёт дорожку ЦЕЛИКОМ (`min-height` на
   `[data-sitting-stage="results"]`). Гарды: `expectParliamentFits` `spills-y` (поза не выше яруса) и «whole or none»
   в пробнике v2 (частичного перекрытия не бывает).
3. **Remote:** «тик производства на нулевом сэмпле» — рейка печатает производство со знаком («+1»), пробник сравнивал
   с числом из wire. → сравнение с первым отсчётом самой рейки. Ошибка пробника, не продукта.
4. **Stability 1080:** плитка правителя 281 px против 327 px в ряду — слот правителя ограничен колонкой правительства
   (`max-width: 100%`), ряд делил всю ширину на пять. → токен `--con-parl-tile-w` = min(колонка ряда, содержимое блока
   правителя), ряд строится от токена (`repeat(5, var(--con-parl-tile-w))`, остаток — в промежутки).
5. **Stability:** переписанный тест смены правительства падал на `ReferenceError: answerGateAs` — забытый импорт.
6. **Stability, Deck, смена правительства:** блок правителя уезжал вправо на 36 px и сужался — `--con-parl-gov-zoom`
   решается из места, которое оставляет блок задания председателя, а задание меняется ВМЕСТЕ с правительством посреди
   прохода (новый текст короче → освободилась строка → карта шире). → во время заседания зум правительства не
   пересчитывается (`govFrozen` в `fitParliamentCards`; обзор решает заново при следующем монтировании).
7. **Stability, 1080/TV:** блок правителя +8 px высоты после принятия — под плиткой появляется блок «эффект резолюции»
   (новый объект правительства, не прыжок); закон — о плитке и ряде: тест мерит слот плитки `[data-parl-ruler-slot]`
   (ширина/высота по токенам, положение неизменно), а рост сцены ИТОГОВ на Deck исключён (свой закон «целиком или
   ничего» в пробнике v2).

### Б3 — «воспроизведи до правки» (честно)
Проблема 4 (+2 растения «Биокуполов» дельта-чипом) воспроизведена ЧТЕНИЕМ: вотчер `rewardsOwed` ждал
`parliamentFlow.stage === 'sitting'`, а стадия в момент ответа была `submitting`; «до/после» по `parliamentRewardDiag`
не снимались — правка убрала зависимость от стадии, а пробник v2 (фикстура биокуполов) закрепил волну: чип рождается
внутри иконки карты, счётчик тикает в кадре посадки (−34…+400 мс), дельта-чип есть. Двухкресельная волна — пробник
remote (ответ второго места опросом, +1 M€ производства из механики карты).

### Замеры
| Профиль | Биты после A | Волна после A | Остальное |
| --- | --- | --- | --- |
| 1080 | agenda → support → enact | 6.18–6.22 с | дверь → поле → «получено» → ИТОГИ; один A на поле |
| TV 4K | agenda → support → enact | 7.34–7.43 с | то же |
| Deck | agenda → support → enact | 6.22–6.24 с | то же; сцена ИТОГОВ берёт дорожку целиком |
- Геометрия голосования (1080 + TV): 0 px изменений размеров карт / панели / кнопки от A до ухода; лобби и резерв.
- Уход (1080): конец голосования, конец заседания, B «свернуть» — тело видно или корень уходит целиком; 3/3.
- Remote, stability — статус в «Ворота» ниже (перепрогон после правок 3–5).

### Старые e2e — переписаны под v2, НЕ гонялись
`console-parliament-sitting` (journey: A на вердикте → ожидание → перезагрузка → ответ второго → проход → добор →
ИТОГИ → ворота 2), `console-parliament-sitting-motion` (пять тестов: вердикт+принятие с ответом второго места, живая
раздача ИТОГОВ по climate-фикстуре, «дожать», reduced, fx-lite), `console-parliament-sitting-reward` (чтение «эта
выплата» из сэмплов, дверь «К полю», `renewal → results`, `answerGateAs` перед `turnTo` в tr/card-bonus),
`console-parliament-gallery` (без `turnTo` enact/reward, кадры 12/13/19 сняты, дверь 21, семейства — тихая поза одним
сэмплом, карточка итогов), `console-parliament-aquifer` / `-biodome` (`turnTo('results')`). Драйвер: `turnTo` в
семантике v2 (A только на вердикте, «дошёл или прошёл»; `renewal`/`closing` → `results`), `focusParliamentZone` с зоной
`ruler`, FITS-блок `.con-sit__results`, гард `spills-y`. Первый их прогон — задача следующей итерации.

### Сценарий ручной проверки (§10)
**Соло с ботом (1080 и TV).** Новая партия Turmoil Redux с MarsBot, голосовать в 1-м поколении (LT → Парламент →
голос из лобби: карточки и панель не двигаются от A до ухода; уход — одним движением). Конец поколения → плита
«Заседание» → A: ВЕРДИКТ — стол как проголосовали, правительство прежнее, маркер Повестки на старом шаге. A →
смотреть подряд: ПОВЕСТКА (сегмент, глайд маркера, тики влияния), ПОДДЕРЖКА (кубы партиям по очереди, ярус оппозиции
виден целиком), ПРИНЯТИЕ (старый закон в сброс, карта победителя в правительство, кубы домой, смена плиток
правитель ↔ ряд, задание раскрывается) → НАГРАДА: волна из иконки карты, счётчик тикает при касании. Если тайл — плита
«Ваш тайл ждёт на поле», гексы тёмные, A «К полю» → поле → разместить → возврат на НАГРАДУ «получено» → ИТОГИ: биты
обновления (лузеры уходят, раздача с переворотом, лобби), карточка «Итоги поколения N», A «Закрыть заседание» → поле.
Два нажатия A за поколение (плюс «К полю» при тайле). B до ИТОГОВ — свернуть и вернуться картой на поле; на ИТОГАХ B
ничего не делает. Перезагрузка на любой стадии — та же стадия в конечных позах, без повтора.
**Два кресла (1080).** Второе кресло — во втором окне (инкогнито) или API: `POST /player/input?id=<второе кресло>`
c `{"type":"option","promptId":<promptId ворот>}` (promptId — из `GET /api/player?id=…` → `waitingFor`). Порядок 1:
зритель отвечает A первым → «Ожидание · [куб]» на ВЕРДИКТЕ; ответ второго → у зрителя те же биты по опросу, смена
правительства FLIP, волна. Порядок 2: второе кресло отвечает первым → A зрителя последний → биты сразу. На ИТОГАХ:
A зрителя → «Ожидание» в строке заголовка карточки (карточка в ярусе); ответ второго → фаза закрывается, поверхность
уходит одним движением.

### Ворота (финальная сборка, 2026-09-21)
- **Пробники (`--workers=1`, все на финальной сборке):** `console-parliament-leave` 3/3 (каждый внутренний блок цел,
  три конца ухода), `console-parliament-sitting-v3` 3/3 (смена власти одним комплектом · сцена поддержки · Повестка
  без ординалов), `console-parliament-sitting-v2` 3/3 (волна после A: 1080 6.2 с · TV 7.6 с · Deck 6.2 с),
  `-sitting-v2-remote` 1/1, `-vote-geometry` 2/2, `-stability` 9/9 (три профиля; шесть плиток партий одной высоты и
  одной ширины на всех профилях).
- **Найдено пробниками по ходу:** прокси Парламента рождался в углу экрана (починено в источнике — `.con-parl__flight`
  рождается невидимым); пробник геометрии голосования ловил СОБСТВЕННЫЙ уход поверхности (масштаб 0.988) — окно
  сужено до конца потока, качество ухода проверяет свой пробник.
- **Юниты:** `supportScene.spec.ts` 7/7, `parliamentSittingSeed.spec.ts` + `parliamentRewardBeat.spec.ts` 16/16,
  чистые модели Парламента на серверном раннере 41/41; `lint:client`, `build:test` (обе ступени), eslint по деревьям
  Парламента, `make:json` — зелёные; полные `test:server` 12 082/0 (1 pending, collected 12 083) и `test:client` 5 774/0 на тихой машине после всех e2e.
## Итоги: честность (2026-09-21/22, промт `docs/claude/prompts/parliament-results-honesty.md`)

Кадр ручной проверки стадии ИТОГОВ: панель открыта ОДНОВРЕМЕННО с зоной ПРАВИТЕЛЬСТВО. Четыре правки, и все
про одно — поверхность не утверждает того, что уже стоит рядом, и не обещает того, чего не бывает.

### Блок A — панель из двух секций, запас вместо прироста, лобби с именем
1. **Секция ① ЗАКОН удалена целиком.** Все три её члена дублировали зону правительства, причём зона богаче:
   «ПРИНЯТА · Конкурс водоносных пластов» — это карта под заголовком «ПРИНЯТАЯ РЕЗОЛЮЦИЯ»; «ПРАВЯЩАЯ ПАРТИЯ ·
   Зелёные» — плитка правителя со словом «ПРАВИТ»; «ЗАДАНИЕ ПРЕДСЕДАТЕЛЯ · …» — блок с прогрессом `0/1`,
   наградой и строкой «Председатель · Кресло свободно». Контракт v5 это прямо запрещал. Тип `ResultsLaw`
   и параметры `quest` / `chairman` убраны из `parliamentResultsModel.ts` вместе с рендером (мёртвого типа не
   осталось); шапки модуля, компонента и LESS переписаны под две секции; сетка панели стала однорядной,
   высвободившаяся высота ушла в ВЫПЛАТЫ (ряд `.26rem → .38rem`, зазор `.22rem → .32rem`; на Deck
   `.16rem → .24rem`).
2. **«НАРОДНАЯ ПОДДЕРЖКА» печатала `1 0 1 0 0 1`.** Дефект не в нулях — это голые цифры без единицы
   измерения, по которым не понять, прирост это или накопленное и сколько вообще влезает. Строка стала
   ЗАПАСОМ после раздачи в словаре плиток партий: заполненные и пустые места из трёх. Величина берётся из
   ЖИВОЙ модели (`view.parties`), а не из `summary.support.total`: шаг поддержки пишется ДО обновления
   области, а раздача превращает весь запас партии в мгновенные голоса на её свежей карте — у «Марса»
   `total: 3` в сводке и `0` на столе. Прирост (`summary.support.gained`) остался ПРИЗНАКОМ свежести:
   пришедшие в это заседание гнёзда несут золотой ободок, и признак клампится запасом, так что ушедшая
   поддержка не помечается, а срезанный потолком прирост уже честно посчитан сервером в `addPopularSupport`.
3. **«В ЛОББИ» заканчивалось одиноким цветным чипом.** Теперь при чипе стоит имя игрока, а при пустом лобби
   (финальная фаза лобби не пополняет) строки нет вовсе. Панель при этом не вырождается: ВЫПЛАТЫ и строка
   поддержки стоят всегда.

### Блок B — плитка правителя и правило, на котором она стоит
**Правило: у партии, правящей ПРИНЯТОЙ КАРТОЙ, народная поддержка всегда ровно ноль.** Цепочка перепроверена
по источнику и записана комментарием у самой разметки: ① первая волна её не берёт — она представлена
карточкой в ENACTED; ② вторая волна раздаёт по НЕПОБЕДИВШИМ картам области, а `dealSlot` никогда не кладёт в
область карту партии принятой резолюции (и вторую карту одной партии — правило в шапке `ResolutionCatalog`);
③ накопленное ранее обнулил `moveSupportToSlot`, когда её карта входила в область. Значит три гнезда на
плитке правителя обещают невозможное — повторение дефекта v4 §2.5.

- `.con-pseal__support` при `ruling` скрывается (`visibility: hidden`) и ОСТАЁТСЯ В ПОТОКЕ: высота плитки
  правителя обязана совпадать с плитками ряда, это условие физического обмена местами;
- **переключение — в кадре прибытия.** `rulerBefore` приходится снимать за кадр ДО перелёта (FLIP мерит
  плитки уже на новых местах и инвертирует их обратно), поэтому он не может сказать, как должна ВЫГЛЯДЕТЬ
  летящая плитка. Добавлен отдельный холд `rulerSettling`: пока обмен идёт, каждая плитка носит состояние
  места, которое покинула; снимается в `settlePose` вместе с `--swapping`, то есть ровно на посадке.
  `ConsoleParliamentParties` передаёт в плитку «правителя как УСТОЯВШЕГОСЯ» (`rulerSettled`), а `rulerShown`
  по-прежнему отвечает за телепорт — два разных вопроса, расходящиеся ровно на длину перелёта.

**Оговорка, найденная при перепроверке цепочки.** Премиса ① держится только при НЕПУСТОМ слоте ENACTED. В
1-м поколении правит стартовое правило (Зелёные без карты), и сервер МОЖЕТ заплатить им как «отсутствующей»
партии. На экране это не видно и до правки: сцена поддержки даёт правящей партии статус `ruling`, волны для
неё не строит, а посев `supportIncoming` держит этот куб вне плитки до конца принятия — то есть к моменту,
когда куб отпускается, Зелёные уже уехали в ряд и показывают его там. Гнёзда правителя, таким образом, не
скрывают ничего реального ни в одном кадре.

Серверный спек `ParliamentPhase.spec.ts` § ПРАВИТЕЛЬ БЕЗ ПОДДЕРЖКИ гоняет три поколения (нейтральный
победитель двумя голосами + голос игрока за проигравшую карту — это ветка `lost-with-player-vote`, та самая,
которая заплатила бы правителю, окажись в области вторая карта его партии) и утверждает: шаг поддержки не
платит правителю; обновление не выдаёт в область его карту; двух карт одной партии там не бывает; запас
правителя ноль; всякая представленная в области партия тоже держит ноль (инвариант, который и делает вывод
устойчивым). Спек падает, если `dealSlot` когда-нибудь ослабят.

### Блок C — пробники `console-parliament-results-honesty.spec.ts`
Правило прежнее: пробник утверждает ВИДИМОСТЬ участников, а не факт события; семплер — MutationObserver +
setInterval, не rAF, и о КАДРАХ судят только `tick`-семплы.

| Пробник | Что утверждает |
| --- | --- |
| И1+И3 | `[data-sit-section]` = ровно `payouts|table` в каждом такте; имя принятой резолюции, имя правящей партии и текст задания СТОЯТ в зоне правительства (положительный свидетель) и не встречаются внутри панели ни в одном такте; `[data-sit-law]` нет нигде; каждый чип лобби несёт куб И имя, число чипов равно `lastPhase.lobbyRefilled`, при пустом лобби строки нет |
| И2 | у каждой партии ровно 3 места, заполненных ровно столько, сколько у сервера в `popularSupport`; правящей партии в строке нет (строка из пяти); помечено ровно `min(запас, gained)`, есть партия и со свежими, и с накопленными, и ободок помеченного гнезда отличается от обычного; каждый чип внутри коробки строки + `expectRailHonest` |
| И4 ×3 профиля | гнёзда правителя `visibility: hidden`, но `display` не `none` и коробка ненулевая; гнёзда ОППОЗИЦИИ видимы (иначе проверка была бы вакуумной); высота и ширина плитки правителя равны плиткам ряда с дельтой 0 px |
| И5 | в покое гнёзда скрыты ровно у той плитки, что стоит в правительстве, и всегда у неё; скрытые гнёзда сохраняют коробку; в кадрах `--swapping` факты ИНВЕРТИРОВАНЫ (плитка в слоте ещё показывает гнёзда, уезжающая ещё прячет) — ни одного кадра в чужом состоянии; правительство действительно сменилось |

### Переписанные старые спеки
`tests/console/parliamentResults.spec.ts` (перечислял три секции — переписан: закона в чтении нет, запас из
живой модели, признак свежести клампится), `console-parliament-zone-v5.spec.ts` § П6 (`['law','payouts',
'table']` → `['payouts','table']`, локаторы `data-sit-law` сняты), `console-parliament-sitting.spec.ts`
(проверка строки закона заменена на «закона нет + две секции + имя при каждом чипе лобби»),
`parliamentDrive.ts` (`.con-sit__law` убран из FITS-блока).

### Промт-фикс Ф1–Ф4 (2026-09-22, `docs/claude/prompts/parliament-results-honesty-fix.md`)

**Ф1 — «В ЛОББИ» удалена, на её месте ИСКЛЮЧЕНИЕ.** Строка не несла пользы дважды. Она показывала не то,
что кажется: `stepLobby` кладёт делегата тому, у кого лобби ПУСТО и резерв не пуст, а `lobbyRefilled`
собирает именно таких — это «у кого была пустота, и её заполнили», а не «у кого есть делегат»; игрок, не
потративший своего в прошлом поколении, в список не попадал. И это уже стоит на экране полнее: зона
делегатов в шапке (`ConsoleParliamentSeats.vue`) постоянно показывает для КАЖДОГО игрока сокет лобби и стек
резерва с числом и именем, и она же помечает сам возврат на ключе резерва в кадре приземления.

`lobby` ушло из `ResultsTable` вместе с рендером; ключ `To the lobby` снят из RU-локали и занесён в `GONE`
словарного гарда; строка глоссария переписана. На его месте `noDelegate` — участники, входящие в следующее
голосование БЕЗ свободного делегата (лобби пусто и резерв на нуле): единственный лоббийный факт, которого
нет нигде, потому что зона делегатов говорит его двумя отметками в двух колонках и никогда не называет
следствие. Читается из ЖИВЫХ мест — `seats` стал `ResultsSeat` (`player` + `lobby` + `reserve`), чтобы
порядок выплат и состояние места ехали вместе и второй список рядом не мог с ними разойтись.

**Ф2 — закон закреплён МЕХАНИЧЕСКИ.** Три из четырёх правок итерации оказались одним дефектом: панель
печатала то, что в этот момент видно в другой зоне. Закон записан в шапке `parliamentResultsModel.ts`
(«панель не печатает то, что в этот момент видно в другой зоне экрана — даже для полноты картины»), а
пробник И1 читает СОБСТВЕННЫЕ СЛОВА каждой зоны с живого DOM (`ZONE_WORDS`: карта правительства · плитка
правителя · текст задания · ключи зоны делегатов · карты области голосования) и не находит ни одного из них
внутри панели, ни в одном такте. Сравнение — по нижнему регистру (кикеры панели поднимает CSS, а не DOM:
наивный `includes` не поймал бы «В лобби» против ключа «Лобби»), члены короче 5 символов отбрасываются, у
пробника есть проверка неваккумности (каждая зона обязана заговорить). Зубы проверены: со снятым исключением
тест краснеет именно там, где и должен.

⚠ **Найдено этим пробником и НЕ исправлено — вне скоупа промта.** Строка «НОВЫЕ РЕЗОЛЮЦИИ» пересказывает
область голосования: свежераздáнные карты стоят на столе ровно в тот момент, когда панель открыта (видно на
кадре `honesty-results.png`), и пробник их ловит. Единственный её член, которого правда нет нигде, —
«остаётся · перетасована». Исключение объявлено ИМЕНЕМ в `PANEL_EXCEPTIONS` с причиной, чтобы вопрос был
виден следующему читателю, а не растворён в ослабленном правиле.

**Ф3 — снят ложный красный** (два устаревших утверждения на ВЕРДИКТЕ, см. коммит). Третье, на которое
прогон упёрся дальше, НЕ трогал: `console-parliament-sitting:273` ждёт `.con-parl__slot--winning` = 1 на
ОБНОВЛЁННОМ столе и получает 0. Контракт клиента говорит, что значок возвращается с обновлением
(`winningShownOf`: `decided` ложно на шаге `adjourn`, `VOTE_DECIDED_STEPS` = winner/agenda/support/enact/
assembly/effects), — значит либо сервер не считает ни одну свежую карту `isWinning` в этот момент, либо
значок гасится чем-то ещё. Не измерено, не замаскировано: это отдельный вопрос, и подгонять утверждение под
наблюдение без замера нельзя. Правками этой итерации не вызвано (сюита не гонялась с переписывания под v2).

**Ф4 — вывод про первое поколение проверен, дыра сегодня НЕДОСТИЖИМА.** Премиса «партия представлена
карточкой в ENACTED» ложна до первого принятия: слот пуст, Зелёные правят по стартовому правилу, и первая
волна поддержки могла бы им заплатить. Не может: колода состоит из настоящих резолюций ровно трёх партий,
поэтому три слота 1-го поколения — это они, и стартовый правитель всегда среди них. Закреплено серверным
спеком `ParliamentPhase.spec.ts` § THE STARTING-RULE RULER, который упадёт в день, когда четвёртая партия
получит резолюцию, и это падение — запись в worklist: у правителя гнёзда скрыты.

Цепочка на экране проверена пробником И8 (архитектурная фикстура, 1-е поколение): после заседания в
правительстве стоит партия ПРИНЯТОЙ карты с нулём на сервере и скрытыми гнёздами (коробка сохранена),
прежний стартовый правитель уехал в ряд, его гнёзда ТАМ нарисованы, и каждая плитка ряда показывает ровно
число сервера. Состояния «партия со скрытыми гнёздами осталась на месте правителя с ненулевым запасом» на
экране не возникает.

**Ворота:** юниты 22/22 (`parliamentResults` + глоссарий), `tests/console/*` 307/307, парламентские серверные
спеки зелёные; пробники честности 9/9 на своей сборке; П6 зелёный; `npm run lint`, `build:test` (обе
ступени), `make:css`.

## Обновление (2026-09-22, промт `docs/claude/prompts/parliament-renewal-beat.md`)

### Режим
Экономный: юниты + пробники §6, только они. Коммит на блок (A сервер · B+C такт и его физика · D пробники и
переписанные тесты), `npm run lint`, `npm run build:test`, не пушить. Свои кадры — как ревьюер (плёнка такта
`screenshots/parliament-renewal/01-tact-*.png`).

### Диагноз (подтверждён по коду до правки)
Сервер был прав; такта не существовало: бет `renewal` жил прелюдией на странице ИТОГИ. Исключение P-22
(`returningInstances`) при пустой колоде не вызывало `releaseTable()` → область до конца рисовалась из `heldSlots`
(снимок «как проголосовали», голосов ноль) → бет посадки кубов не находил гнёзд → `flyCube` без цели снимал холды
без единого полёта. При полной колоде такт был нечестен: кубы поддержки летели из НЕЙТРАЛЬНОГО РЕЗЕРВА шапки, делегаты
игроков с проигравших не летели (в `summary` записи не было).

### Блок A — сервер: ЖУРНАЛ обновления (`SerializedRenewalEvent`, `summary.renewal`)
Упорядоченный список физических событий в порядке производства:

| Событие | Поля |
| --- | --- |
| `leave` | `instance`, `slot` (ФИЗИЧЕСКИЙ слот как голосовали — победитель уже вынут из массива), `returned: [{owner, count}]` (делегаты по владельцам, порядок первой постановки) |
| `reshuffle` | `size` — сколько карт стало колодой (карты, отвергнутые в ЭТОМ же розыгрыше, отложены и в перетасовку не входят — правило `drawDistinct`, иначе цикл) |
| `reject` | `instance`, `slot`, `reason: 'party-in-area' \| 'party-enacted'` |
| `deal` | `instance`, `slot`, `source: 'deck' \| 'reshuffled'` |
| `support` | `party`, `instance`, `count` — сразу после своей `deal` |
| `empty` | `slot` |
| `lobby` | `player` — шаг лобби пишет в тот же журнал |

`Parliament.drawDistinct` получил наблюдателя (`DealObserver`: `onReshuffle(size)`, `onReject(instance)`); фаза
пишет журнал в `stepRefresh`/`stepLobby`; `ParliamentModel` проецирует с резолюциями и цветами
(`ParliamentRenewalEventModel`). Три старых списка (`discarded` / `refreshed` / `lobbyRefilled`) — производные.
Идемпотентность `refresh:<gen>` не менялась; финальная фаза журнала не пишет. Старый сейв без журнала: клиент
показывает обновлённый стол без такта.

Спек `tests/parliament/ParliamentRenewal.spec.ts` (9): семь сценариев + проекция на wire + ИНВАРИАНТ
«журнал воспроизводится в итоговое состояние» (реплей на снимке до заседания с учётом отложенных отвергнутых;
сверка области, множеств колоды/сброса, нейтральных голосов, обнуления запаса сданных партий, лобби).

| # | Сценарий | Журнал (без `support`) | Результат |
| --- | --- | --- | --- |
| 1 | колода полная (Mars правит; колода Reds·Scientists·Biodome) | leave leave deal deal deal lobby | ✓ все три `source: deck`, поддержка Reds села на её карту |
| 2 | колода пуста, обе вернулись | leave leave reshuffle deal deal empty lobby | ✓ `size: 2`, оба `reshuffled`, слоты 0/1, третий `empty`; e2e-пробник зелёный |
| 3 | одна из колоды, перетасовка посреди раздачи | leave leave deal reshuffle deal deal lobby | ✓ порядок совпал с физикой |
| 4 | отвергнута по партии правителя (Greens правят; колода Biodome·Reds·Climate) | reject(party-enacted) … | ✓ reject журналится ДО задержанной сдачи |
| 4b | «партия уже в области» (Mars правит; колода Biodome·Climate·Reds) | … reject(Climate, slot 1, party-in-area) … | ✓ |
| 5 | подходящей карты нет нигде (стол = один победитель, колода/сброс пусты) | empty empty empty lobby | ✓ |
| 6 | делегаты игрока на проигравшей | leave.returned = [{red,1},{NEUTRAL,1}] | ✓ резерв +1−1 (лобби), `summary.returned` принятой — отдельная запись |
| 7 | финальная фаза | `renewal` undefined | ✓ нет ни refresh, ни лобби |

Сценарии 1, 3, 4, 4b, 5, 6, 7 — серверные спеки + движок такта тот же (события те же); e2e-пробник — сценарий 2
(кадры владельца). Отвергнутая карта (сценарий 4) и полная колода (1) на экране прогонами не снимались — только
юнитами; это честный остаток регрессии §8.

### Блок B — ОБНОВЛЕНИЕ как стадия
`SittingStage` += `renewal` между наградой и итогами; `sittingPagesOf(step, final)`: при `final` страницы нет
(ни такта, ни ленты). Страница auto (A = «дожать»), крошка `ЗАСЕДАНИЕ › ОБНОВЛЕНИЕ` (ключ `Renewal`), фаза
`committed` (B = свернуть). Тело — ряд партий на весь такт (`sittingBodyOf(stage, field)` больше не зависит от
`resultsHidden`); панель ИТОГОВ открывается сменой тела на СЛЕДУЮЩЕЙ странице, её ряды каскадируют своим битом
(`beatResults`), `resultsRevealed` сбрасывается в момент поворота страницы на итоги.

Холды (`parliamentDisplayHolds`): `deckPending` → **`pile: {deck, discard}`** (обе стопки как стояли до ответа,
двигаются ПО ПОСАДКАМ: уход → discard+1, перетасовка → deck=size, discard−=size, вскрытие/сдача → deck−1);
`renewalReturns` (делегаты с проигравших, отдельно от `returns` принятой карты); `departed` (ушедшая карта —
контур на своём месте с причиной «Сброшена — ушла со стола»); `renewalSeeded` (идемпотентность по эху). Посев
`seedRenewalHolds(beforeView, after, afterView)` — из журнала; `freshFaces` = ВСЕ сданные (исключения «та же
карта» нет). `heldSlots` освобождается всегда: на подъёме последней уходящей карты (или сразу, если уходить нечему).
`liftedFaces` прячет лицо уходящей карты в кадре парковки прокси (контракт `cardExitDirector.onLift`).

### Блок C — физика такта (`beatRenewal`, `parliamentFlights.ts`)
Раскадровка (базовые мс, `motionMs`):
1. **Уход.** Делегаты с ribbon карты → резерв владельца / нейтральный запас, по одному (`LEAVE_RETURN_STAGGER 70`);
   карта поднимается через 200 мс после старта последнего куба (не после посадки). Прокси лица (`parkFace`) →
   `flyCardOffTable`: переворот рубашкой (`addCard3DTurn` → 180°, 340 мс, pitch/push — «карту берут со стола»),
   перенос начинается на 190-й мс по низкой дуге на стопку сброса, посадка = событие (стопка +1, прокси уходит
   следующим кадром, без fade). Вторая карта +160 мс. Слот под картой — контур с момента подъёма.
2. **Перетасовка** (`runReshuffle`): ждёт посадки последней ушедшей карты; до трёх рубашек поднимаются со сброса,
   веером расходятся и выравниваются, стопкой едут на место колоды (760 мс) + 160 мс «дилер выравнивает колоду»
   (посадка GSAP отстаёт от арифметики на пару кадров — без паузы первая сдача обгоняла счётчики).
3. **Отвергнутая карта** (`launchReject`): с верха колоды к своему слоту с переворотом лицом (тот же
   `dealResolutionCard`, `keep`), читается 420 мс (лента: «её партия уже на столе / правит — в сброс»),
   переворачивается обратно и уходит на сброс.
4. **Раздача**: `dealResolutionCard` с `[data-parl-deck-top]` на ожидающее место (`--awaiting`: контур пустого
   слота, подпись/ribbon/счётчик скрыты — подпись не опережает объект), каскад 150 мс, посадка ≤ 1.5 px.
5. **Поддержка**: кубы с гнёзд СВОЕЙ плитки (верхнее заполненное первым, плитка отпускает на старте —
   `onLifted`) на скрытые места ribbon (только ЖИВЫЕ seq карты), счётчик под картой тикает на посадке
   (`tallyShownOf` вычитает скрытые кубы; «принимается» подавлено, пока летят).
6. **Пустой слот** — читается 320 мс после посадки всего; **лобби** — после этого.
Арифметика сценария 2 ≈ 4.0 с (уход с возвратом 0.2 → карты 0.2/0.36 → перетасовка 1.01–1.93 → сдачи 1.93/2.08 →
поддержка 2.49/2.64 → пустой слот 3.12 → лобби 3.44 → конец 4.04). Потолок такта `RENEWAL_HOLD_CEILING_MS = 24 000`
(потолок, не длительность). «Дожать»: `setParliamentFlightsHurried` — полёты, рождённые после нажатия (цепные,
отложенные на тик), уходят в позу сразу.

Честность без присваиваний: полёт без измеримого источника/цели снимает холд и ПРИЗНАЁТСЯ —
`sittingMotion.renewalDegraded` + `console.warn` + `data-renewal-degraded` на корне секции (пробник §6.6 требует
отсутствия; «дожать» и reduced motion законно не пишут).

Стопка сброса появилась в зоне делегатов (`[data-parl-discard]` / `[data-parl-discard-top]`, ключ
`Resolution discard`); старый закон при принятии уходит на неё же (`flyToDiscard` вместо `flyToDeck`), стопки
держатся `pile` и с барьера.

Лента (`parliamentBand.ts`): `sittingMotion.renewal` (`BandRenewalCue`) — строка на событие: «Уходит со стола ·
[резолюция] · делегаты возвращаются · [игрок]», «Колода пуста · сброс перетасован в новую колоду», «Вскрыта карта ·
[резолюция] · её партия уже на столе / правит — в сброс», «Сдана · [резолюция]», «[партия] · Народная поддержка
становится голосами · Делегаты N», «Пустой слот · В колоде нет резолюции другой партии», «Свободный делегат — в
лобби · [игрок]». Ключ строки = индекс события.

### Блок D — пробник и переписанные тесты
`tests/e2e/console-parliament-renewal.spec.ts` (фикстура `parliament-renewal-assembly`: колода и сброс пусты,
красный побеждает двумя делегатами из среднего слота, делегат синего на проигравшей Зелёных) — семь секций §6,
каждая утверждает ВИДИМОСТЬ источника и цели и движение между ними (`vis()` v4). Что стоило прогонов:
- **посев по журналу прятал лица удерживаемого стола** — при сдаче той же карты обратно `freshFaces` содержит
  инстанс проигравшей уже с ответа на ворота, и удерживаемый стол показывал контуры вместо карт на ПРИНЯТИИ и
  НАГРАДЕ. Закон: «ожидающее место» — только на ЖИВОМ столе (`awaitingDeal = heldSlots === undefined && fresh`);
- **ключ скрытого куба делегата, улетевшего с проигравшей, переживал сдачу той же карты** → бет поддержки искал
  несуществующее гнездо. Ключ снимается на посадке, бет берёт только живые seq;
- **перетасовка стартовала до посадки уходящих карт** (стопка ещё пуста) — ждёт `tail`;
- пробник: прокси рождается невидимым в начале координат (учитывать только `shown` кадры); утверждения о кадрах —
  только по тикам, точность посадки — по любому сэмплу (снап пишет style, MutationObserver его видит, тик может
  пропустить единственный кадр); кадр хендофа законно держит две карты (прокси на слоте ≤ 8 px); база «запас
  нейтральных не менялся» — первый кадр ТАКТА, а не вердикт (шаг поддержки на ПРИНЯТИИ его законно тратит);
  не выкачивать сэмплы (`readProbe`) посреди такта — это секунды, и плёнка теряет кадры.

Переписано: `parliamentResults.spec.ts` (нет `stays`), `consoleSittingFlow.spec.ts` (страницы, auto, ключ
стадии, `sittingBodyOf(stage, field)`), `sittingBeats.spec.ts` (renewal/lobby на своей странице, журнал как бет),
`parliamentSittingSeed.spec.ts` (посев из журнала, две стопки, возвраты, сейв без журнала, стопка при уходе старого
закона), `parliamentBand.spec.ts` (строка на событие); e2e: `parliamentDrive.ts` (порядок стадий),
`sitting-motion` (тест ИТОГИ → такт на своей странице, колода растёт только на перетасовке на `size`; порядок
«дожать» с `renewal`), `sitting-v2` (такт на своей странице, карточка скрыта при открытии своей), `sitting-v4`
(`TABLE_MOTIONS` + renewal), `zone-v5` (рабочие кадры renewal), `sitting.spec` (нет `[data-sit-stays]`),
`sitting-reward` (первый кадр renewal), `gallery` (poll renewal → results). Глоссарий: `Renewal → Обновление`.

### Прогоны (2026-09-22)
См. таблицу в отчёте итерации ниже (заполняется по мере прогонов).

## Cloud Development — RX06 (2026-09-22, промт `docs/claude/prompts/resolution-rx06-cloud-development.md`)

### Режим
Экономный: юниты + пробники §4 промта. Коммит на блок (A сервер и модель · B встроенный шаг · C Союз и первое
поколение · D арт, лицо, локаль, пробники), каждый зелёный по юнитам, `npm run lint`, `npm run build:test`, не пушить.
Документ карты — `docs/TURMOIL_REDUX_CLOUD_DEVELOPMENT.md`.

### Блок A — сервер, общий механизм распределения, модель исхода (`ddd2c635b7`)
- Счётный член над ДВУМЯ метками: `resolutionCountKind('venusJovianTags') = {kind: 'tags', tags: [VENUS, JOVIAN]}`,
  разбивка `byTag`, канонический счётчик `player.tags.count(tag, 'raw')` на метку.
- `AddResourcesToCards` поднят до контракта (ОДИН механизм для резолюций и трёх карт проектов): опции
  `{autoSelect, cause, from, pickTitle, distributeTitle}`, форма вопроса решается шагом (`N ≥ 2` и держателей `≥ 2`
  → `AndOptions` из `SelectAmount` с маркером `cardResourceDistributionPrompt {amount, cardResource, cards,
  vpByAmount}`; иначе `AddResourcesToCard` с `autoSelect`), проверка суммы ДО применения (`InputError`), колбэк
  со списком посадок. `distributionVictoryPoints` — серверная таблица ПО для каждой карты и каждого k.
- Исход `cardResource` расширен `cards` (+ `countedByTag`); `rewardAddressOf` отдаёт список. Нового вида нет.
- `CloudDevelopment.ts` (Unity, `compatibility: ['venus']`, `copies: 1`), `compatibleWith` экспортирован —
  спеки пула переведены на фильтр. Арт `RX06.webp`, `PremiumCountGlyph` умеет несколько медальонов (`.pcglyph--tags`).
- 14 ключей `ru/parliament.json`.

### Блок B — встроенный шаг раскладки: одно шасси, два режима (`b6e7bcc162`)
- `cardResourceDistribution.ts` (чистая модель) + `cardResourceDistributionResponse` (нечего отправлять при сумме ≠ N).
- `ConsoleTaskHost` режим `distribute`: счётчик на карте (`data-spread`, полоса `+k`), статус-строка
  (`data-spread-blocked` / `-ready` / `-vp`), бейджи «Разложено k/N» · «Осталось», LB/RB/RT/A семантикой; A при
  остатке — `spreadCommit` возвращается без отправки; старт с нуля; раскладка переживает «свернуть» через хранилище
  пиков. Маршрут по маркеру (`taskFor` → `cardSelect/distribute`), стадия «Раскладка» в заседании
  (`SittingRewardStep 'distribution'`, `SITTING_HOSTED_STEPS`).
- `consoleResolutionPayout` переписан на список целей: по одному чипу на карту с иконки резолюции, посадка тикает
  свою карту (`pickPayoutLanding.landed[card]`). Итоги печатают список карт; чтение — вход по каждой метке.
- 6 ключей `ru/console.json`.

### Блок C — Союз и первое поколение: правитель без карты (`9047f0d39c`)
- Рулбук (стр. 8 сетап, стр. 9/11 шаг поддержки «not present on any card in the Voting Area or Enacted slot»,
  стр. 17 FAQ): напечатанный слот — не карта → сервер прав, не менялся.
- Клиент: `ConsolePartyPlaque` `rulesByCard` (гнёзда void только у правителя ПО ПРИНЯТОЙ КАРТЕ), хост читает
  `view.enacted`, во время смены правительства — `rulerBeforeByCard` из холдов (посев в `parliamentSittingSeed`),
  `beatSupport` отдаёт сцене правящую партию только когда та правит по карте.
- Спеки: `ParliamentPhase` § THE STARTING-RULE RULER (две формы), `ParliamentRenewal` сценарий 8 (четыре партии,
  отказ по площади + перетасовка посреди раздачи, реплей), `supportScene` (правитель без карты), `ConsolePartyPlaque`.

### Блок D — стенд, галерея, фикстуры, e2e, документы
- `resolutionFamily.ts`: семейство `distributed` (`spreadEffectOf`), «Полигон» — 19 сценариев на настоящих картах
  + два живых; секция пикера показывает факты раскладки, поверхность — только живой сценарий.
- Фикстуры `parliament-cloud-vote` / `-assembly` / `-enact` (Venus-партия, `options` у `parliamentFixture`,
  область Союз / Марс / Индустриалисты — Зелёные правят без карты); генератор и `answerAsksAs` отвечают на
  помеченный `and`.
- e2e `console-parliament-cloud.spec.ts` (три профиля) и галерея § the DISTRIBUTION (три профиля × три режима).
- `noRecipientReasonKey/ForecastKey` знают аэростаты (паритет с серверной причиной).

### Прогоны (2026-09-22)

| Что | Результат |
| --- | --- |
| mocha: `CloudDevelopment` (29) · `ResolutionContract` · `ParliamentPhase` · `ParliamentRenewal` (8 сценариев) · `supportScene` · `cardResourceDistribution` · `e2eFixturesLoad` · `e2eDriverGuard` | зелёные |
| mochapack: `consoleTaskRouter` · `taskResponses` · `consoleResolutionPayout` · `ConsolePartyPlaque` | зелёные |
| `npm run build:test` · eslint · `vue-tsc` · `lint:i18n` | зелёные (блоки A–C; D — см. финальный прогон) |
| e2e `console-parliament-cloud` · standard-1080 · лицо + обзор + голосование | ✓ 3.7 мин (после двух правок продукта: медальон зависимости на «Грамоте», `byTag` в чтениях) |
| e2e `console-parliament-cloud` · standard-1080 · раскладка → коммит → запись → Союз у власти | ✓ 7.3 мин: нулевой старт, 0 запросов на A при остатке, LB/RB/RT, ДВА чипа «+2», капсулы 2/2 на экране раскладки, `cards: [Dirigibles:2, Jovian Lanterns:2]`, Зелёные `absent`, лента одной высоты, тело без пустых кадров |
| галерея § the REWARD variant: the DISTRIBUTION · standard-1080 / tv-4k / deck-handheld (режим standard) | ✓ 3/3, 2.3 мин: вердикт на четырёх партиях (гнёзда стартовых Зелёных видны), раскладка (позы 24 / 24b), итоги (24c), Союз у власти (24d) |
| e2e `console-parliament-cloud` · tv-4k · раскладка (повтор на тихой машине) | ✓ 1.1 мин |
| e2e `console-parliament-cloud` · deck-handheld · лицо | ✓ |
| e2e `console-parliament-cloud` · tv-4k · лицо (повтор на тихой машине) | ✓ 1.3 мин |
| e2e `console-parliament-cloud` · deck-handheld · раскладка (пробник читает тики капсул в своих семплах) | ✓ 53 с |

Итого: `console-parliament-cloud` — 6/6 на трёх профилях (1080 и tv-4k раскладка — прогон с прежним опросом,
deck — с пробником по семплам), галерея § the DISTRIBUTION — 3/3.

Замечания к пробникам. (1) Первый прогон упал по «worker server never answered in 90 s» (пустой `worker-0.log`) при
параллельно идущих `webpack --watch` чужой сессии и `vue-tsc`; повтор на тихой машине прошёл. (2) Раскладка на
deck-handheld дважды падала на «капсулы тикают на экране раскладки» с `[]` — шаг уже ушёл: на маленькой сцене
Deck полёт двух чипов короче 1.2-секундного `settle` нажатия, и опрос DOM снаружи приходил к пустому слоту, хотя
чипы летели и капсулы тикали. Опрос заменён чтением ПРОБНИКА (MutationObserver + setInterval, семплы берутся,
пока слот стоит в сцене) — закон «сравнение настолько же осевшее, как его наименее осевшая сторона» из
`tests.md`, теперь и для «событие короче окна опроса». На tv-4k тот же красный под нагрузкой ушёл на тихой машине.
В спек добавлен `[cloud diag]` (чипы, слоты, `__conReady`). (3) Ошибка спеки: Jupiter Floating Station — плоское
1 ПО, не «1 за 2 аэростата»; ступенчатые ПО в фикстуре несёт Jovian Lanterns. (4) Две правки продукта по
пробникам: лицо «Грамоты» не рисовало медальоны совместимости (отдельная ветка шаблона — `.pcard-bill__compat`),
чтения `voteYieldsOf` / `enactedYieldsOf` не прокидывали `byTag` / `countedByTag` (вход по меткам не печатался).
(5) Замечено по кадру Deck (не правилось): на шаге НАГРАДА освободившийся слот победителя в области подписан
«В колоде нет резолюции другой партии» — текст пустого слота после обновления показывается и до него.

## Colonial Affairs — RX07 (2026-09-22 → 23, промт `docs/claude/prompts/resolution-rx07-colonial-affairs.md`)

### Режим
Экономный: юниты + пробники §8 промта. Коммит на блок (A сервер и план шагов · B предподсчёт · C стадия НАГРАДА и
шаг СБРОС · D закон якоря дельта-чипа · E фикстуры, e2e, документы), каждый зелёный по юнитам, `npm run lint`,
`npm run build:test`, не пушить. Документ карты — `docs/TURMOIL_REDUX_COLONIAL_AFFAIRS.md`. С 2026-09-23 действует
БЮДЖЕТ ПРОВЕРКИ владельца: один новый e2e на новую механику, кадры нового на одном профиле, галерея и стенд не
гоняются — блок E сделан по нему (позы галереи не добавлены, e2e на standard-1080).

### Блок A — сервер, план шагов на игрока, виды `discard` / `colonyBonus`, реестр в модели (`1a05d00ffe`)
- `IResolution.immediateStepsFor?(player, parliament, game)` + `immediateStepsOf` (один читатель: драйвер, гард,
  экспорт лица); ключи `colony:<tile>`, `colony:<tile>:<n>:draw|discard|reveal` детерминированы.
- `InfluenceScaledEffect.influenceStep` (k = 2 + ⌊I/2⌋), единица `{kind: 'colonyBonuses'}`, записи с `multiplier` и
  `colony`; гард формулы для множительной единицы читает `multiplier`.
- Закон объединения: запас/производство ×k — одна запись; ресурс на карту — одна раскладка k (`AddResourcesToCards`,
  `autoSelect: false`); добор — один приём k; Плутон — k пар, не объединяется. Пропуски названы с величиной.
- `REWARD_ADDRESS` += `discard`, `colonyBonus`; `rewardFlightSourceOf` → `colony-row`; `IColony.colonyBonusGrant()`;
  `ParliamentPlayerModel.colonyBonuses`; `DiscardCards` опция `colonyRepeat` (маркер, отличный от `colonyBonus`).
- Спек `ColonialAffairs.spec.ts` (18 + семейство): таблица k, план, объединение, пары Плутона (колода не тянется до
  ответа на сброс), reload посреди второй пары, пропуски, сообщество (Титания/Япет), каждый базовый тайл,
  нейтральный победитель, задание, реестр модели, MarsBot. `ParliamentRenewal.spec` — стол сажается детерминированно
  (у Союза теперь карта в каждой колоде).
- 39 ключей `ru/parliament.json`; арт `RX07.webp`.

### Блок B — предподсчёт: чтение `colony-ledger` (`812457e4b1`)
- Чистый `common/parliament/colonyLedger.ts` (форма → чип повтора, строки × k, состояния по записям, суммы,
  записанный множитель); `colonyLedgerModel.ts` (`colonyLedgerOf`: голосование — множитель + «×(k+1) при победе»;
  принятие — записанный множитель); `ConsoleColonyLedger.vue` (`compact` / `normal` / `hero`, медальон планеты,
  «карта → сброс» для Плутона, «Колоний нет» словами); `console_colony_ledger.less`.
- Проводка: панель голосования (бюджет слов), подвал осмотра, стенд (семейство `colony-bonuses`, сценарий
  `colonial-vote`), итоги по тайлу, правило бонуса колонии в аннотациях. `enactedYieldsOf` читает множитель.
- 5 ключей.

### Блок C — стадия НАГРАДА: реестр как тело, волны по строкам, шаг СБРОС (`cdb8813f4d`)
- `sittingFieldOf(stage, step, pending, ledger) → {pose, stepOpen}` — поза и дверь два факта; с реестром поза
  стоит всю страницу, дверь после волны. Секция: `sittingLedger`, `sittingStepOpen`, наблюдатель `flush: 'post'`
  публикует `fieldStanding` И слот фрейма парламента (`setWorkspaceFrameSlot('parliament', …parliament-stage)`),
  `fieldSettling` (прогулка ждёт посадки карты на герой-слот — `onDone` у `playParliamentEnactEnter/Fold`),
  разрыв цикла прогулки на `stageEntering`, `sceneHandedOver = workspaceHostYieldsScene('parliament')` (вложенный
  embed-фрейм больше не прячет секцию).
- Зона — стек слоёв (`.con-sit__zone` grid 1×1: слот шага + панель реестра `v-show`, `playBodyFold` /
  `playZoneLayerEnter`); `.con-sit__embed > .con-hand` растягивается как пикер/приём.
- `beatReward`: долг делится по `delivery.source`; `ledgerRowGroups` — по тайлу в порядке сервера; ACTION COMMIT
  карты → строки по очереди (`sittingMotion.colonyRow`, `ledgerBonusIconOrigins`, `LEDGER_ROW_GAP_MS`); строка
  не на экране — холд отпускается. `landedColonies` в `ConsoleParliamentSitting` (по посадке, не по записи).
- `SittingRewardStep 'discard'`, `SITTING_HOSTED_STEPS`, `sittingAskOf` по `isDiscardPrompt` + источник-резолюция,
  `sittingStageKey → 'Discarding'` («Сброс» — канон глоссария, «Раскладка» тоже пришпилен),
  `RESOLUTION_STEP_STAGES.handSelect`, оболочка называет стадию фрейма руки тем же словом; `discardIntent`:
  источник «Резолюция», планета и «n из k» из `colonyRepeat`.
- Спеки: `consoleSittingFlow` (сброс, `sittingFieldOf`), `consoleTaskRouter`, `discardIntent`,
  `parliamentRewardBeat` (источник `colony-row`), `parliamentGlossary`.

### Блок D — закон якоря дельта-чипа, R-23 / R-24 (`940120d375`)
- ОДИН закон в `console.less` § THE DELTA-CHIP ANCHOR LAW: ① вне цифр, ② вне соседей, ③ внутри инструмента,
  ④ rem. Четыре позы (цифры · угол · линия · линия чипов ленты), хозяин называет позу. Чернила запаса —
  `.con-res__digits`; чип метки — прямой ребёнок ячейки; размеры чипов в rem (`zoom` TV снят); чип ленты под
  швом (`--con-status-chip-drop` −.12 → +.04rem: на 4K цифры доходили до шва).
- Пробник `console-delta-chip-anchor.spec.ts`: 8 потребителей × 3 профиля, синтетический чип, чернила `Range`,
  скриншоты и `geometry.json` до/после. До: запас на цифрах 303 / 1952 / 303 px², метки 103 / 705 / 81, счёт РТ
  12 / 189 / 18 (+55 вне рельсы на Deck), производство на рамке 48 / — / 20+120, лента 0.00rem / 22 px² / 0.03rem,
  доп. ресурсы вне колонки 314 / 709 / 314. После: нули везде, зазоры 0.06–0.43rem, три профиля зелёные (36 с).
  `console-hud-frame` + `console-rail-contract` — 5/5.
- **R-23 · R-24 закрыты** (реестр полировки: единственная открытая строка без правки — теперь с законом и замером).

### Блок E — фикстуры, e2e, документы
- Фикстуры `parliament-colonial-vote` / `-assembly` (`FIXTURES=… npm run e2e:fixtures`): стол колоний
  ПЕРЕСОБРАН (`game.colonies` = Луна (оба), Титан, Миранда, Плутон), синий — Atmo Collectors + Jovian Lanterns
  (два держателя аэростатов → раскладка), рука дополнена; шаг Повестки 4 → влияние 3 → k = 3.
- e2e `console-parliament-colonial.spec.ts` (standard-1080, восемь пробников §5 дока): реестр как тело · волна из
  строки, тик на посадке, «получено» после · дельта-чип по закону · раскладка · приём трёх · приём одного · СБРОС
  в зоне (крошка, заголовок, B «Свернуть», карта в сброс, следующий приём) · итоги по тайлу, лента, тело, стёрд.
- Документы: `docs/TURMOIL_REDUX_COLONIAL_AFFAIRS.md`, этот журнал, чек-лист (§3 «Бонусы колоний»), глоссарий
  (стадии + «СБРОС»), правила `console-ui.md` (законы 19–20), память.

### Прогоны (2026-09-23)

| Что | Результат |
| --- | --- |
| mocha: `ColonialAffairs` · `ResolutionContract` · `ParliamentRenewal` · `rewardAddress` · `colonyLedger` · `consoleSittingFlow` · `parliamentGlossary` · `parliamentLessOrder` · `parliamentResults` · `e2eFixturesLoad` · `e2eDriverGuard` | зелёные |
| mochapack: `consoleTaskRouter` · `discardIntent` · `parliamentRewardBeat` · `sittingBeats` · `parliamentBand` · `colonyLedgerModel` · `voteInfoBudget` | зелёные |
| `npm run build:test` · `lint:server` · `lint:client` · `lint:i18n` · `make:css` · `make:json` | зелёные |
| e2e `console-delta-chip-anchor` · три профиля | ✓ 3/3 (36 с) |
| e2e `console-hud-frame` · `console-rail-contract` | ✓ 5/5 |
| e2e `console-parliament-colonial` · standard-1080 (замороженная копия сборки, свой сервер) | ✓ 1/1, 58 с — все восемь пробников: реестр как тело (4 строки, ×3, герой RX07) · волна из строки Луны, тик M€ на посадке, «получено» после тика · дельта-чип по закону во всех семплах · раскладка Титана в зоне · приём трёх (Миранда) · приём одного (Плутон) · СБРОС в зоне (заголовок «Плутон · 1 из 3», крошка «…› СБРОС», B «Свернуть», карта в сброс, второй приём) · реестр вернулся с четырьмя «получено» и был ПРОЧИТАН (бит чтения ≥ 0.9 с), итоги по четырём тайлам, лента без движения, тело не пустело, ничего не застряло, поколение 2, три записи `discard`, Луна 6 |

Замечания к прогонам. (1) **Миранда платит карту**, не животное — бонус колонии есть третья строка тайла
(`metadata.colony`); первый прогон e2e ждал пикер животных и получил приём трёх карт (кадр). (2) **Общая папка
`build/` двух сессий**: соседняя сессия держит `webpack --watch` (dev-сборка) и переписывает `build/main.js` при
каждом сохранении; e2e того же клона грузит `build/` и на dev-бандле консоль не поднимается (пустой `#app`, ни одной
ошибки в консоли браузера — «TERRAFORMING MARS» и ничего). Три прогона подряд легли на этом. Решение: production-сборка
+ ЗАМОРОЖЕННАЯ копия `.e2e-frozen/build` (в `.git/info/exclude`) + свой сервер из копии
(`cd .e2e-frozen && PORT=8150 node build/src/server/server.js` — статика читается относительно cwd) +
`TM_E2E_SHARED_SERVER=1 BASE_URL=http://127.0.0.1:8150`. (3) Фикстуры сгенерированы при каталоге с RX08 (незакоммиченная
работа соседней сессии) — в колоде лежит `RDX_UNITY_COLONIZATION_FUNDING`, сервер e2e обязан быть собран из
текущего дерева, иначе `load-game` → 400. (4) Первый вариант пробника волны фильтровал чипы по спрайту ресурса — чип
M€ рисует монету без спрайта (чтение пробника наград: «нет значка = M€»); чип после посадки ещё ВПИТЫВАЕТСЯ на
рельсе, и «строка получена, а чип на экране» — это хвост посадки, не полёт (проверяется расстояние до рельсы).
(5) **Реестр после последнего шага не читался** — ответ на последний сброс уносит сервер сразу к воротам adjourn,
`sittingStepKey` меняется, `enterServerStep` пересаживал прогулку на первую несыгранную страницу (ОБНОВЛЕНИЕ) мимо
реестра с четырьмя «получено». Исправлено битом ЧТЕНИЯ реестра: `ledgerReadOwed` (падение двери шага на странице
НАГРАДА при живом реестре) держит `mayLeave`, прогулка играет бит наград с `LEDGER_READ_MS` (1.4 с) и только потом
уходит; при смене шага сервера `enterServerStep` читает зеркало двери (`stepOpenMirror` — post-flush-наблюдатель
ещё не сработал) и сажает прогулку на НАГРАДУ, как при квитанции тайла. Пробник требует ≥ 0.9 с семплов с
четырьмя «получено».

## Colonization Funding — RX08 (2026-09-23, промт `docs/claude/prompts/resolution-rx08-colonization-funding.md`)

### Режим
Экономный по бюджету проверки §4 промта: юниты + РОВНО ОДИН e2e на новую механику (счёт по полю), один профиль,
старые сюиты e2e не гонялись. Коммит на блок (A сервер · B чтения · C стенд/документы · D фикстура/e2e/журнал),
`npm run build:test`, eslint по файлам, `vue-tsc` один раз после клиентских правок, не пушить.
Документ карты — `docs/TURMOIL_REDUX_COLONIZATION_FUNDING.md`.

### Блок A — сервер: счётный член по ПОЛЮ (`3b1e0877f5`)
- `ResolutionCountKind` получил третий вид `{kind: 'board', tiles: BoardCountedTile}` (`'spaceCity'`; следующее слово —
  `'marsCity'`). Сервер для `board` не ходит по табло: `boardCountSpaces` → `player.game.board.getCitiesOffMars(player)`
  (та же функция у награды Cosmic Settler и `behavior/Counter`); число = длина, клетки = id.
- Объяснение числа — КЛЕТКИ в ТОЙ ЖЕ модели: `ResolutionCountModel.spaces` (`cards` пуст), запись/модель `countedSpaces`,
  чтение `InfluenceYield.countedSpaces`. Второго типа модели счёта нет.
- Общий предикат клетки для стенда `spaceCountVerdict` / `countSpacesToward` над `CountedSpaceFacts`; паритет с движком
  закреплён спеком по корпусу досок (Марс / чужой / пустая область / Венера / Луна).
- Карта `ColonizationFunding.ts` (Unity, `copies: 1`, без совместимости): `2 × S + I`, `cap 6`, один шаг `production`,
  журнал с «× 2» и потолком, пропуск «Нет космических городов и нет влияния» с `countedSpaces: []`.
- Глиф `{kind: 'tile', tile: 'spaceCity'}` в `PremiumCountGlyph` — ассет города лица + искра `.pcard-sym--asterix`;
  запись презентации `spaceCities`. Арт `RX08.webp` (файл с суффиксом `_art`).
- Спеки: `ColonizationFunding.spec.ts` (21), `resolutionCounts.spec.ts` (+3), `ResolutionContract` проходит RX08 сам.

### Блок B — чтения (`46e2d46fd9`)
- `ConsoleInfluenceYield`: формула с ДВУМЯ ставками при `count.per ≠ perInfluence` («2 [пр. M€] / [город*] + 1 [пр. M€] /
  [влияние] · макс. 6», `data-yield-count-rate`); чтение «[город*] 2 + [влияние] 3 → +6 МАКС.», `uncapped 7` в данных.
- `voteYieldsOf` / `enactedYieldsOf` несут клетки; `countedCellNames` — имена только из `getSpecialCellInfo` (слой
  информации о доске), безымянная клетка = `undefined`. «Для вас»: список клеток по именам · при безымянной — число
  («2 космических города») · при нуле — «Сейчас не учитывается ни один тайл».
- Юниты: `influenceYieldModel.spec` (+5), `parliamentAnnotations.spec` (+1), `PremiumCountGlyph.spec` (новый, 2).

### Блок C — стенд, документ, чеклист (`0e35502268`)
- Семейство «Полигона» `counted-board` (`familyOf`: `kind === 'board'`), места держат синтетические КЛЕТКИ
  (`CountedSpaceFacts`: 01, 02, 69, 71, пустая 02, город на Марсе 35), счёт общим `countSpacesToward`, вердикт клетки
  `spaceCountVerdict`, имя из слоя доски; 17 сценариев + живой `parliament-colonization-vote`.
- Чеклист автора: строка «Счётный член по ПОЛЮ» + «Бюджет проверки на карту».

### Блок D — фикстура, ОДИН e2e, журнал
- Фикстура `parliament-colonization-vote` (`FIXTURES=… npm run e2e:fixtures`): RX08 в слоте 0 с делегатом синего, синий
  Повестка 5 (влияние 3) + Ганимед + Фобос (2 × 2 + 3 = 7 → 6, максимум; следующий шаг Повестки — РТ, надбавки за победу
  нет), красный Повестка 1 без городов (+1).
- e2e `console-parliament-colonization.spec.ts` (standard-1080, один проход): лицо (арт RX08, эмблема Союза, город с
  искрой, «макс. 6», задание) → панель голосования (`estimate · 2 · 3 · 6 · uncapped 7 · max`, без надбавки, глиф
  плитки) → fullscreen (то же число; «Учтены сейчас: Колония на Ганимеде · Космопорт на Фобосе»; правило) → оба паса по
  API → анонс → вердикт → A → второе место по API → волна: чип «+6» рождён в `.pcard__mech` героя (ВИДИМОМ по пробнику:
  ненулевой rect, ненулевая эффективная прозрачность, ничего над центром), сел в `.con-res__prod` строки M€ (ВИДИМОЙ),
  пролёт ≥ 85 % хорды, тик счётчика в окне посадки (−34 … +260 мс), дельта-чип, `+9` на рельсе → запись сервера
  `{production, amount 6, count 2, influence 3, uncapped 7, countedSpaces ['01','02']}` → ИТОГИ.

### Находки
1. **Посевная колода сдвинулась с ростом каталога**: в слот 1 первого поколения лёг Aquifer Contest, и два спека
   `ParliamentPhase`, пинавшие «тихого» победителя-игрока к слоту 1 / 0, встали на ОКЕАНЕ ПОБЕДИТЕЛЯ (Aquifer тих для
   долей мест, но не для победителя). Хелпер честнее: `quietWinnerIndex` (слот не Зелёных), Союз в `quietResolutionOf` →
   RX08 (производство — тихо для всех и для победителя); док хелпера называет ловушку.
2. **`max 6` на лице** печатался латиницей: ключ `max 5` лежит в `promo.json`, `max 6` не существовало — добавлен в
   `parliament.json`. (Замороженная сборка e2e этого ключа ещё не несла — на кадрах «MAX 6».)
3. **Рельса печатает производство со знаком** («+9»): первый прогон e2e упал на моём же ожидании «9» — правка спека, не
   продукта.
4. **Страница НАГРАДА тихой карты стоит ровно пока летит чип**: кадр «после посадки» — уже ИТОГИ; в спек добавлен кадр
   В ПОЛЁТЕ (`05-reward-wave`), кадр после посадки — итоги с рельсой 65 / +9.
5. **Соседняя сессия в том же клоне** (RX07 блок D e2e) держит в индексе свои файлы: обычный `git commit` подхватывает
   ВЕСЬ индекс — блок B унёс её `console-parliament-colonial.spec.ts` и фикстуры (и мои файлы блока D раньше времени).
   Дальше коммиты делались с явными путями (`git commit -- <paths>` / `-i`) и точечным `git apply --cached --unidiff-zero`
   для общих `generate.ts` / `consoleStart.ts`. e2e гонялся на ЗАМОРОЖЕННОЙ копии сборки (`.e2e-frozen-rx08/`, в
   `.git/info/exclude`) со своим сервером на 8160 (`TM_E2E_SHARED_SERVER=1 BASE_URL=…`), чтобы пересборки соседа не
   роняли прогон.

### Прогоны (2026-09-23)

| Что | Результат |
| --- | --- |
| mocha: `ColonizationFunding` (21) · `resolutionCounts` · весь `tests/parliament/*` (430, в т.ч. `ArchitectureAward`, `CentralPowerGrid`, `CloudDevelopment`, `ColonialAffairs`, `ResolutionContract`) · `tests/console/*` + `tests/common/**` (429) · `e2eFixturesLoad` · `e2eDriverGuard` · `glyphLiteralGuard` | зелёные |
| mochapack: `influenceYieldModel` · `parliamentAnnotations` · `PremiumCountGlyph` (40) | зелёные |
| `npm run build:test` · eslint по файлам · `vue-tsc` (`lint:client`) · `make:json` · `make:css` | зелёные |
| e2e `console-parliament-colonization` · standard-1080 | ✓ 1/1 (43.5 с; повтор с кадром в полёте — 1.4 мин под нагрузкой) |

Кадры: `screenshots/parliament-colonization/standard-1080/` — `02-vote-reading` (панель голосования с потолком),
`03-fullscreen` (клетки по именам, правило), `05-reward-wave` (стадия НАГРАДА, чип в полёте), `06-after-wave` / `07-results`
(итоги, рельса 65 / +9), `08-polygon` (стенд: семейство по полю, клетки с вердиктами), `01-overview` (лицо в области).

## Colony Contest — RX09 (2026-09-23, промт `docs/claude/prompts/resolution-rx09-colony-contest.md`)

### Режим
Экономный по бюджету проверки: юниты + РОВНО ОДИН новый e2e-файл на новую механику (экран колоний как встроенный шаг
заседания), один профиль; в файле два путешествия — Титан (основное) и Европа (отдельный кадр по промту). Коммит на блок
(A сервер · B шаг · C арт/стили · D фикстура/e2e/правки по e2e/документы), `build:test`, eslint по файлам, `vue-tsc`
один раз, не пушить. Документ карты — `docs/TURMOIL_REDUX_COLONY_CONTEST.md`.

### Блок A — сервер (`ea79ce4e63`)
- `WinnerRewardDeclaration` стало объединением тайл | колония (`{kind: 'colony'}`); `winnerRewardParameter` → `undefined`
  для колонии, комната/РТ типизированы по тайлу (`isWinnerTileReward`).
- Вид исхода `colony`: поверхность `colonies`, единица `tile`, стадия `colonies`, чтение `winner-reward`, плита
  «Пропущено: колония победителя»; поле записи `colony` = тайл постройки.
- Карта `ColonyContest.ts`: титан 1 × влияние (stock, именованный ноль «Влияния нет»), победитель — `BuildColony` БЕЗ
  `commit`-замыкания с `committedPlacement(reason, SOURCE)`, запись `{kind: 'colony', colony}`, пропуск «Нет доступной
  колонии»; задание «2 колонии»; лицо `titanium/influence · colonies★`.
- Чтения победителя (`winnerRewardModel`): параметр необязателен, колония читается без комнаты и РТ (`built` = тайл),
  глаголы «строит / построено», правило под блоком; лента, итоги, `ConsoleWinnerReward`, «Полигон» приняли объединение.
- Гард контракта и генератор фикстур отвечают на `SelectColony`; стол колоний в гарде АРАНЖИРУЕТСЯ (Луна · Каллисто),
  чтобы бонус случайного тайла не задал вопрос движка без источника-резолюции; спек фазы (бот, 5 поколений) отвечает
  человеком на колонию — RX09 теперь в колоде и выпадает.
- Спек `tests/parliament/ColonyContest.spec.ts` (14).

### Блок B — шаг КОЛОНИИ в заседании (`052890f205`)
- `SittingRewardStep 'colony'` по структурному маркеру (`wf.type === 'colony'` + источник-резолюция в
  `placementContext`), в `SITTING_HOSTED_STEPS` (дверь публикует слот Парламента), хвост «КОЛОНИИ» в обеих таблицах
  (`sittingStageKey`, `RESOLUTION_STEP_STAGES.colony`); `openColoniesForPrompt` пушит стадию по источнику промпта,
  секция колоний без своей стадии сохраняет имя двери.
- `WORKSPACE_KINDS['parliament'].frameSteps.colonies = 'embed'` (было `scene`): прямо на Парламенте стоят только шаги
  заседания.
- `stepFrameNested` (`workspaceFrameHasNested('parliament')`) и термин `hosting` в `sittingFieldOf`: поле и дверь стоят,
  пока вложенный фрейм ещё внутри (кубик летит, бонус тайла спрашивает), прогулка держит страницу НАГРАДА, уход фрейма
  перезапускает её. Ветка `parliament` на падении `colonyFollowUpLive`: фрейм снят, Парламент не сворачивается и не
  заключается.
- Юниты: `consoleSittingFlow` (27), `consoleTaskRouter` + `consoleWorkspaceStack` (184: parliament ⊃ colonies — embed,
  слот двери, крошка, заключение держится `nested-step`).

### Блок C — арт и глифы
- `RX09.webp` + thumb (`import-card-art.mjs` → `make:cards`); `.con-wreward__tile--colony`, `.con-sit__door-tile--colony`.

### Блок D — фикстура, ОДИН e2e, правки шага по итогам e2e, документы
- Фикстура `parliament-colony-assembly` (`FIXTURES=… npm run e2e:fixtures`): RX09 в слоте 0 с делегатом синего, Повестка
  2 / 1 (синий после шага победителя — влияние 2 → 2 титана; красный 1), стол Луна · Титан (активирован, пуст) ·
  Европа · Каллисто (кубик красного); у синего два держателя флоатеров (Atmo Collectors, Jovian Lanterns).
- e2e `console-parliament-colony.spec.ts` (standard-1080), путешествие ТИТАНА: ① волна титана — чип рождён на
  карте-носителе, счётчик тикает по посадке (0 → 2); ② сетка колоний ВНУТРИ слота Парламента и только ПОСЛЕ посадки,
  без своей шапки и без `data-motion-surface`, герой стоит, `data-sit-step="colony"`, крошка
  «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › КОЛОНИИ», B «Свернуть»; ③ Титан → фокус-стадия в той же зоне → строка «Цель бонуса
  постройки» → A открывает пикер получателя (`.con-colfocus__targetstage`, на уровень глубже, внутри заседания) → A берёт
  карту → X строит (ответ одним пакетом); ④ фрейм ушёл, `.con-parl` стоит, прогулка сама доходит до ИТОГОВ: «+2 [Ti] ·
  Титан [колония]», 3 флоатера на держателе, записи `titanium:stock` → `colony:colony`. Пробник: ни одного кадра с двумя
  живыми телами, крошка держала корень и субъект на всём шаге, лента не двигалась, тело не пустело, ничего не застряло.
  Путешествие ЕВРОПЫ (отдельный тест того же файла): A строит без решений → размещение океана → стек уступил доске
  (`__conReady().wsYielded`, `wsDepth 0`, `.con-parl` снят) → `placeTile` → стек вернулся, фрейм колоний снят на возврате,
  ИТОГИ называют Европу, океан на доске.
- Находки и правки по e2e (все — по таймлайну пробника, не по догадке):
  1. Термин `hosting` открывал дверь ДО волны: фрейм колоний пушится в момент допуска промпта (ещё на странице ПРИНЯТИЯ),
     и `(шаг && !волна) || hosting` открывал зону на 2,4 с раньше посадки титана. Порядок восстановлен:
     `(шаг ∨ hosting) && !rewardPending` — волна первая всегда.
  2. `enterServerStep` сажал прогулку на НАГРАДУ по одному факту вложенного фрейма — уже при первом приходе (в том же
     обновлении, что и принятие) — и пропускал такты ПРИНЯТИЯ. Теперь только при ОТКРЫТОЙ двери (`stepOpenMirror`).
  3. Хвост крошки откатывался «КОЛОНИИ» → «НАГРАДА», когда позиция сервера уже «получено», а кубик ещё летел:
     `sittingTail` читает стадию вложенного фрейма (`workspaceStackCrumb().stage`), пока он стоит.
  4. Европа: падение `colonyFollowUpLive` случается, пока стек УСТУПИЛ доске, — фрейма в живом стеке нет, ребро снять его
     не может; возврат стека (`resumeStackFromBoardAndSettle`) проверяет цепочку и снимает фрейм тем же
     `settleColonyFollowUp` (вынесен из вотчера в метод).
  5. Пробник: текст `.con-res__digits` ~2,4 с несёт дельта-чип («2+2») — читать ведущее число; носитель волны меряется по
     карте в правительстве ИЛИ на слоте героя (одна телепортируемая карта).
  6. Свидетели: `__conReady().wsYielded` (стек уступил доске), `consoleParliamentUi.stepFrameLeftAt`.
- Крошка: субъект заседания — «ЗАСЕДАНИЕ» (`SITTING_SUBJECT_KEY`, как у RX01–RX08), не имя резолюции; фрейм колоний
  субъекта не отдаёт. Наблюдение: на уровне пикера получателя хвост стадии колоний «ЦЕЛЬ НАГРАДЫ» длиннее, и общая шапка
  режет субъект многоточием («ЗАСЕДАН…») — бюджет ширины `ConsoleWsHead`, не шага; открытый вопрос владельцу.

### Прогоны (2026-09-23)

| Что | Результат |
| --- | --- |
| mocha: `ColonyContest` (14) · `ResolutionContract` · `rewardAddress` · весь `tests/parliament/*.spec.ts` + `consoleSittingFlow` (27) + `parliamentGlossary` + `e2eFixturesLoad` + `e2eDriverGuard` (485) | зелёные |
| mochapack: `winnerRewardModel` (15) · `parliamentRewardBeat` (13) · `consoleTaskRouter` + `consoleWorkspaceStack` (184) | зелёные |
| `npm run build:test` (оба дерева) · `npm run lint:server` · `lint:i18n` · `make:json` · `make:css` · `make:cards` | зелёные |
| `npm run lint:client` (vue-tsc) | один прогон после всех клиентских правок — см. отчёт |
| e2e `console-parliament-colony` · standard-1080 · замороженная сборка `.e2e-frozen-rx09` (порт 8161) | Титан ✓ 43,6 с · Европа ✓ 43,8 с (и дважды ранее, 1,2–1,3 мин с загрузкой профиля) |

Кадры: `screenshots/parliament-colony/standard-1080/` — `01-colonies-embedded` (сетка в рамке Парламента, крошка
«ПАРЛАМЕНТ › ЗАСЕДАНИЕ › КОЛОНИИ», лента «получено · 2 → +2 · Колония · строите вы»), `02-target-pick` (пикер получателя на
уровень глубже), `03-return` (заседание после ухода фрейма — уже на ОБНОВЛЕНИИ), `04-results` (итоги: «+2 [Ti] · Титан
[колония]»), `05-europa-board` (стек уступил доске: размещение океана), `06-europa-return` (итоги с Европой).


## Development Craze — RX10 (2026-09-23, промт `docs/claude/prompts/resolution-rx10-development-craze.md`)

### Режим
Экономный, коммит на блок, без пуша. Первая резолюция с ЖИВЫМ пассивом; бюджет проверки — юниты + гард, клиентские юниты
строки/нотификации, РОВНО ОДИН e2e. Док карты `docs/TURMOIL_REDUX_DEVELOPMENT_CRAZE.md`; чеклист автора получил строку
§1.7 и блок «Живой ПАССИВ».

### Блок A — сервер (`c66792f12f`)
- `DevelopmentCraze.ts`: сталь = влияние (шаг семейства), пассив `onTilePlaced` → `repeatPlacementBonuses` — те же входы
  движка второй раз (`grantSpaceBonuses` · `grantOceanAdjacencyBonus` — выделен из `Game.grantPlacementBonuses`, один путь
  на обе выдачи · `AresHandler.earnAdjacencyBonuses`), под источником резолюции; только Марс; эхо `lastPlacementBonusEcho`
  (self-only, образец `lastOceanBonus`). `ResolutionPassive.onTilePlaced` получает `{coveringExistingTile}` из `Game`.
- Платный бонус клетки (океан Hellas / температура Vastitas / колония Terra Cimmeria) при повторном предложении:
  `SelectPaymentDeferred.skipIfUnaffordable` — проверка В МОМЕНТ ИСПОЛНЕНИЯ счёта (оба счёта в очереди до оплаты
  первого — гард на выдаче не работает, проверено спеком), пропуск с именем; общий шов и для Frontier Town / Jansson.
- Спек 17 юнитов; гард контракта, `ResolutionPassive`, `PartyForecast`, RX08/RX09, `placementPreviewConsistency`,
  `MarsNomads`, `FrontierTown`, `SelectPaymentDeferred` — зелёные (211).

### Блок B — видимость (`7b0d131479`)
- Список эффектов: строка закона ПЕРВАЯ, кикер «Принятая резолюция» (`.con-pfx__law`), золотой шов правительства
  (`--resolution`); графика — тот же `renderData`. `isRenderableNode` отбрасывает `null`-слот JSON (иначе prop-warning
  `PremiumMechNode` ронял юнит).
- Нотификация: `effectSource` = карта ∨ резолюция (одно поле), CTA `inspect-resolution` + `notificationBus.inspectResolution`
  → `ConsoleShell.inspectParliament`; hold X на карточке — осмотр резолюции вместо журнала. **Открытие:** собственное
  действие зрителя подавляется, а пассив срабатывает ВНУТРИ действия → `lawAnswerNotification`: ответ ЗАКОНА на своё
  действие = одна карточка `passive-effect` (чипы только эффекта, строка самого эффекта, источник-резолюция).
- Сцена размещения: `echoWaveFor` (чистая), `pendingEcho`, холд обеих долей, `runEchoWave` после первой волны
  (`ECHO_WAVE_BREATH_MS` 320), свидетель `data-echo`; транспорт передаёт `lastPlacementBonusEcho`.
- Юниты: `ConsolePartyEffectsStrip` (4), `notificationModel` (+4), `consoleTilePlacement` (+1) — 138 зелёных.

### Блок C — арт (`c66792f12f`, попал в A по стейджу)
`RX10.webp` + thumb; `make:cards` — манифест `hasPassive: true`.

### Блок D — фикстура, ОДИН e2e, правки по кадрам, документы
- Фикстура `parliament-craze-enacted` (stopAt `done`: RX10 принята, красный открывает 2-е поколение с 30 M€).
- e2e `console-parliament-craze.spec.ts` (standard-1080): ① ЭФФЕКТЫ — строка закона первая, кикер, имя, графика;
  ② LT-колесо → «Озеленение» → оплата → клетка 2×сталь по проводу (legal ∩ bonus) → `commitFocusedSpace`; пробник
  (`MutationObserver` + `setInterval`): эхо объявлено на отрисованных кадрах, счётчик стали прошёл через промежуточное
  значение (2 → 5 → 7), первая волна ДО эха; провод: +5 (2 + 2 + 1 партийная); ③ карточка закона: «Сработал эффект»,
  «Принятая резолюция · Строительная лихорадка», «+2», «Зажать X Осмотреть»; ④ hold X → `dialog.con-zoom--parliament` с
  лицом `rdx-mars-development-craze`, карточка ушла, закрытие.
- Находки по кадрам и прогонам (все исправлены, кроме открытых):
  1. Город вместо озеленения закрывает ЗАДАНИЕ председателя самой RX10 (плита «Открыть Парламент» держит цепочку
     открытой — карточка закона ждала в PREPARING) и добирает карту Марс вперёд (ревил владеет экраном) — e2e берёт
     озеленение; в игре карточка города придёт после закрытия цепочки (закон атомарной подачи).
  2. Досье клетки печатало партийные факты, но не пассив резолюции (+2 обещано, +4 заплачено) → шов
     `ResolutionPassive.placementFacts` (гард: тайловый пассив без досье-двойника падает), `resolutionPassiveFacts`
     в `BoardInformationEngine`; `placementReduxPreview.spec` § Development Craze: preview == commit.
  3. Глиф задания «город / спецтайл» печатал `empty_tile_special` — `EMPTY_TILE_SPECIAL` не был в карте иконок
     премиального лица → `assets/tiles/special.png`.
  4. Карточка закона говорила источник, но не «что»: добавлена строка самого эффекта (`lawLineEntries`).
- Открытое: Ares + Redux — клиентская Ares-волна летит по новейшему гранту клетки (первый из двух не играется);
  подвал осмотра резолюции печатает «ЭФФЕКТ ПАРТИИ · ДОСТУПЕН ВСЕМ» (глоссарий просит «эффект резолюции»); плита
  источника ревила Марс вперёд говорит «Действие партии» о пассиве — существующие подачи, не трогал.

### Прогоны (2026-09-23)

| Что | Результат |
| --- | --- |
| mocha: `DevelopmentCraze` (17) · `ResolutionContract` · `ResolutionPassive` · `PartyEffects` · `PartyForecast` · RX08 · RX09 · `ParliamentPhase` · `placementReduxPreview` (+1) · `placementPreviewConsistency` · `placementEffectConsistency` · `MarsNomads` · `FrontierTown` · `SelectPaymentDeferred` · `e2eFixturesLoad` · `e2eDriverGuard` | зелёные |
| mochapack: `ConsolePartyEffectsStrip` (4) · `notificationModel` (+4) · `consoleTilePlacement` (+1) · `tilePlacementModel` · `oceanAdjacencyBeat` | 138 зелёных |
| `build:server` · `build:client` · `build:test` (оба дерева) · `lint:server` · `lint:i18n` · `lint:client` (vue-tsc) · `make:json` · `make:cards` · `make:css` | зелёные |
| e2e `console-parliament-craze` · standard-1080 · свой сервер из `build/` (чужого watch не было) | ✓ 42 с (дважды на финальной сборке) |

Кадры: `screenshots/parliament-craze/standard-1080/` — `01-effects-strip` (строка закона первой, кикер, золотой шов),
`02-placement-echo` (момент эха: счётчик стали на промежуточном значении с дельта-чипом), `03-law-toast` (карточка закона
с источником, строкой эффекта и «+2»), `04-inspect-resolution` (осмотр резолюции из карточки; глиф спецтайла в задании).

---

## RX11 · Forestry Support (Зелёные) — закон, который ВВОДИТ бонус соседства (2026-09-23)

Растения = 2×влияние сразу; ПАССИВ: каждое озеленение рядом с поставленным тайлом платит 2 M€ и 1
растение. У бонуса, которого у движка нет, есть точный родственник — ОКЕАНСКОЕ СОСЕДСТВО, и вся
итерация свелась к «сделать для рощ то, что уже есть для воды, ОДНИМ СЕМЕЙСТВОМ».

- **Доска**: `MarsBoard.greeneryAdjacencyBonus` вплотную к `oceanAdjacencyBonus`, по `Board.isGreenerySpace`.
- **Модель**: `PlacementBonusEchoModel` → `PlacementLawPayoutModel` (`lastPlacementBonusEcho` →
  `lastPlacementLawPayout`); озеленения — её ЧЛЕН, а не второе поле рядом. RX10 повторяет печатное и
  океан, RX11 вводит рощи — волна у закона ОДНА (`PlacementLawWave` → `runLawWave`).
- **Сцена**: `oceanAdjacencyBeat.ts` → `adjacencyPayoutBeat.ts`, половина РОЩИ на той же хореографии,
  палитра в CSS (`--grove`), две фишки на рощу (монета И растение), своя доля холда на ресурс.
- **Превью**: `firesTilePassive` (тайл ложится И не солнечная фаза) — `grantsPlacementBonus` истинно и при
  накрытии, а накрытие платит; `placementFacts` даёт две строки (по пулу) с `spaces`, и поле само
  подсвечивает платящие рощи.
- **Находки по кадрам** (все исправлены):
  1. Разбивка досье печатала «1 растения»: слот со значением 1 по-русски не склоняется → ставка
     напечатана в предложении (это константа карты), в параметре осталось только число рощ.
  2. Строка закона в карточке ломалась на двоеточии ПОСЛЕ чипа резолюции («: соседних…» новой
     строкой) → чип уехал в КОНЕЦ фразы (`… за соседние озеленения (2) — [Поддержка лесничества]`).
  3. Кадр волны нельзя взять `page.screenshot()` из Node: обход «увидел → снял» — два разных момента
     (три попытки — три кадра уже законченного размещения) → e2e пишет CDP-скринкаст и ВЫБИРАЕТ кадр по
     моменту, который назвала сама проба (каждый сэмпл несёт своё `Date.now()`).
  4. Летит НЕ монета: она конденсируется в роще и отдаёт пиксельного двойника Resource Transfer
     Framework — проба судит о пути по `.con-transfer__chip` (старт у рощи → финиш у рельсы).
- **Попутно починены три красных спека** (два из них — долг предыдущих блоков): `HellasOceanReds`
  (платный бонус карты теперь честно ПРОПУСКАЕТСЯ и называет себя — RX10 `skipIfUnaffordable`),
  `discardPrompt` (не знал о члене `colonyRepeat` из RX07), `ClimateResearch` (перечислял резолюции
  Зелёных руками → выводит набор из каталога).

### Прогоны (2026-09-23)

| Что | Результат |
| --- | --- |
| `npm run test:server` | 12338 зелёных, 0 красных |
| `npm run test:client` | 5841 зелёный, 0 красных |
| `build:server` · `build:client` · `build:test` (оба дерева) · `lint` (server + i18n + vue-tsc) · `make:json` · `make:cards` · `make:css` | зелёные |
| e2e `console-parliament-forestry` · standard-1080 · свой сервер из `build/` | ✓ ~43 с (и ×3 подряд на промежуточной сборке) |

Кадры: `screenshots/parliament-forestry/standard-1080/` — `00-effects-strip` (строка закона первой, своя
графика), `01-dossier-groves` (досье: +4 M€ с разбивкой и +2 растения, обе рощи подсвечены),
`02-grove-wave-leaving` (монета «+2» выходит из рощи), `02-grove-wave` (приземление: фишки на рельсе, счётчики
тикают), `03-law-toast` (карточка закона с +4 M€ и +2 растения).

---

## RX12 · Gas Export (Красные) — закон, который МЕНЯЕТ МИР (2026-09-24)

2 M€ за влияние каждому — и затем кислород −1, Венера +2, **РТ за это не получает никто**. Первая
карта Красных и первая, чьё принятие меняет планету, а не платит игрокам. Полный документ —
`docs/TURMOIL_REDUX_GAS_EXPORT.md`.

- **МИРОВОЙ ШАГ — член семейства.** `worldSteps` рядом с `immediateSteps` / `winnerSteps`: один раз за
  принятие, ключ в `applied` (не `seatApplied`), после собственной части ВСЕХ мест. Места у шага нет:
  область события открыта БЕЗ игрока, источник — резолюция без владельца, запись без `player` и с
  `part: 'world'`. Игрок-ручка даётся только движковому API (прецедент ВПМ / `SnowCover`) и не
  получает ничего. Инлайн-обход победителя (RX01 / RX03 / RX09) СОХРАНЁН — его откладывает лишь
  карта, объявившая мировые шаги, и по правилу: тайл победителя должен лечь в мир, который закон уже
  сделал.
- **ПОНИЖЕНИЕ — полноценное событие.** Рекордер принимает знак и необязательного игрока; все три
  отрицательные ветки пишут фактически сделанный шаг. Потребители проверены на знак: `aggregate`
  суммирует net, «кто терраформировал планету» больше не строит факт из неположительной суммы,
  журнал события не показывает (тег аналитики) — голый `log` действия Красных не задваивается.
- **БЕЗ РТ = ПАРИТЕТ С ВПМ (решение D1).** `ParameterMoveOptions.unrewarded` делает ровно то, что
  делает `Phase.SOLAR`: ни РТ, ни бонусов трека внутри гейта, порог помечен нейтрально; то, что ВПМ
  всё же платит СНАРУЖИ гейта (океан на 0 °C, Aphrodite), платится и здесь. Это ТРАКТОВКА: буквальное
  «никто не получает РТ» запрещало бы только рейтинг и выдало бы карту за 8 % Венеры случайному
  игроку-ручке. Разворот стоит одного гейта и одного спека.
- **МИРОВОЙ БЕТ.** Мир меняется на мире: OWE (мировая запись, у каждого зрителя) → YIELD (`К полю`,
  БЕЗ нажатия — нажимать не за что) → STORY (парк полевых бетов сливает удержанные значения: маркеры
  едут, HUD тикает; понижение приходит обычным тоном ПОТЕРИ, без празднования) → RETURN (тот же
  уровень, страница НАГРАДЫ читает строку планеты). Ожидание ограничено и названо, бет не повторяется.
- **Чтения.** Осмотр: блок «ЧТО ДЕЛАЕТ С ПЛАНЕТОЙ» + серверные числа; «кто получает РТ» сказано РОВНО
  ОДИН раз — предложением закона над строками. Лента: член `world`. Итоги: строка ПЛАНЕТА (по закону
  панели — только шаг и то, чего шкалы сказать не могут). Стенд: семейство `world-move` (пределы
  параметров).

### Прогоны (2026-09-24)

| Что | Результат |
| --- | --- |
| `tests/parliament/**` (438 + 25 новых) · `tests/console/**` (352) | зелёные |
| клиентские юниты: `parliamentWorldBeat` (7) · `animatedMetricValue` (6) | зелёные |
| `build:test` (оба дерева) · `lint:client` (vue-tsc) · `eslint src tests` · `make:json` · `make:cards` · `make:css` | зелёные |
| e2e `console-parliament-gas` · standard-1080 · свой сервер из `build/` | ✓ ~35 с (дважды подряд) |

Кадры: `screenshots/parliament-gas/` — `01-verdict` (вердикт, лицо с «− [кислород]» и двумя шкалами
Венеры), `01b-inspect-world` (осмотр: «Кислород: 5% → 4%», «Венера: 10% → 14%», кредит назван один раз),
`02-board-world-beat` (заседание у поля: кислород 4 %, Венера 14 %, чип «+4 M€», ни одного РТ-чипа),
`03-back-from-the-board` (возврат), `04-results-planet` (строка ПЛАНЕТА в итогах).

**Чужой красный, найденный попутно и НЕ трогавшийся:** `console-parliament-results-honesty` § И4 (три
профиля) и § И5 — гард требует у плитки ПРАВИТЕЛЯ `visibility: hidden` на гнёздах поддержки, а
`ConsolePartyPlaque` с RX06 (`9047f0d39c`, «правитель без карты») сознательно ПОКАЗЫВАЕТ их, пока
партия правит по СТАРТОВОМУ ПРАВИЛУ (`ruling && rulesByCard`): в фикстуре `parliament-actions`
принятой карты нет. Ни один файл, который читает этот гард, в RX12 не менялся; правка — за владельцем
«Итогов: честность».

## RX13 · Generous Funding (Зелёные) — счётный член по ПОКАЗАТЕЛЮ игрока (2026-09-24)

2 M€ за влияние и 2 M€ за каждый ПОЛНЫЙ набор из 5 РТ сверх 15, каждому, потолка нет. Четвёртый вид счётного
члена: считается не табло и не поле, а ОДНА величина игрока порогом и шагом. Полный документ —
`docs/TURMOIL_REDUX_GENEROUS_FUNDING.md`, промт — `docs/claude/prompts/resolution-rx13-generous-funding.md`.

- **Блок A (`6dce5e3301`).** `{kind: 'threshold', metric: 'terraformRating', over: 15, step: 5}` в `resolutionCountKind`;
  ОДНА функция `thresholdSets` (сервер, чтение, стенд); значение — `player.terraformRating` у движка. Объяснение
  числа — РАЗБОР величины `ResolutionCountModel.metric` (значение · порог · шаг · наборы · до следующего) в той же
  модели, `countedMetric` в записи/модели/чтении. Карта RX13, шаг `megacredits` платит `stock.add`, пропуск
  «Нет наборов РТ и нет влияния» несёт разбор. Глиф `metric` (значок РТ лица). 20 юнитов карты + гард.
- **Блок B (`816fe95f5a`).** Чтение «[РТ] 24 → 1 набор + [влияние] 3 → +8 M€»; «Для вас» — разбор словами вместо
  списка; **честный прогноз**: шаг Повестки победителя бывает шагом РТ, рейтинг растёт ДО чтения эффекта —
  `winnerForecastCount` считает прогноз от `РТ + 1` той же функцией (иначе панель обещает +8, сервер платит +10).
- **Блок C (`f7cedf6b85`).** Стенд: семейство `counted-metric`, синтетический `PgSeat.tr`, лестница границ наборов,
  разбор словами; 13 сценариев + живой.
- **Блок D.** Фикстура `parliament-generous-vote` (синий: РТ 24, Повестка 4 → победа = шаг 5 влияния, +6 → +8;
  красный: РТ 20, Повестка 1) и ОДИН e2e `console-parliament-generous.spec.ts`: лицо → панель голосования (чтение с
  разбором, суффикс «+2 · шаг 5», без MAX) → fullscreen (разбор, не список) → вердикт → волна «+8» из графики карты
  в ячейку M€ рельсы, тик на посадке → запись → итоги.

### Находки

- **Фаза производства платит РТ монетами ДО заседания** — спек, сверяющий M€ с абсолютом (`20 + 8`), красный:
  сверять с `before / after` записи. RX08 этого не видел: производство доходом не двигается.
- **`terraformRating` у автома-игрока read-only** — задавать боту рейтинг в спеке не надо (и незачем: его нет в
  парламенте).
- **Посев сдвинулся с ростом каталога** (пятая карта Зелёных): спек бота в `ColonyContest` пинал колонии бота, а
  ход бота зависит от посева — теперь сверяет «до заседания + куб человека». Гард модели в `CentralPowerGrid`
  перечисляет новый счёт.
- **Ключ «Generous Funding» уже был** в `ru/turmoil_events.json` (глобальное событие Turmoil) — лицо читает «Щедрое
  вложение», свой ключ не заводился (сборка бросает на дубликате).

### Прогоны (2026-09-24)

| Что | Результат |
| --- | --- |
| `tests/parliament/**` (489, из них 20 новых RX13) · гард контракта · `tests/console/parliamentGlossary` · `e2eFixturesLoad` | зелёные |
| клиентские юниты: `influenceYieldModel` · `PremiumCountGlyph` · `parliamentAnnotations` (48) | зелёные |
| `npm run lint` (eslint + i18n + vue-tsc) · `build:test` (оба дерева) · `make:json` · `make:cards` · `make:css` · `npm run build` | зелёные |
| e2e `console-parliament-generous` · standard-1080 · свой сервер из `build/` | ✓ 1.0 мин и 57 с (дважды подряд) |

Кадры: `screenshots/parliament-generous/standard-1080/` — `02-vote-reading` (панель голосования: «[РТ] 24 → 1 НАБОР +
[влияние] 2 → +6 · +2 если победите · шаг 5», без MAX), `03-fullscreen` (осмотр: «Учтены сейчас: РТ 24 · порог 15 ·
1 полный набор · до следующего 1»), `05-reward-wave` (страница НАГРАДЫ тихой карты стоит только пока летит чип —
скриншот успевает уже на «Обновлении», с «+8» на рельсе M€: 64 → 72), `06-after-wave` / `07-results` (итоги: +8 / +4,
РТ 24 стоит), `08-stand` («Полигон»: семейство по показателю — лестница 15 · 20 · 25, разбор словами).

Ловушка пробника: `.con-res__digits` содержит и дельта-чип («64+24» — доход фазы производства ещё висит, когда пробник
взводится) — судить о тике по ведущему целому, не по сырому тексту. Поле модели — `thisPlayer.megacredits`.

## RX14 · Heat Capture (Красные) — закон, который вмешивается в ЭКОНОМИКУ карт (2026-09-24)

2 M€ за влияние каждому, температура −2 (если не на максимуме, РТ никому) — и ПАССИВ: карта с меткой
строительства дешевле на 3 M€. Три готовых механизма семейства и одна новая форма пассива — СКИДКА. Полный
документ — `docs/TURMOIL_REDUX_HEAT_CAPTURE.md`, промт — `docs/claude/prompts/resolution-rx14-heat-capture.md`.

- **Блок A (`841571d238`).** `ResolutionPassive.cardDiscount(player, card)` — новый хук; спрашивается ОДНОЙ функцией
  цены `Player.getCardCostBreakdown` через `ParliamentHandler.cardDiscount` (чистый ЗАПРОС без области события —
  `discount-applied` пишет сама функция цены при оплате) только у участника, держащего закон; строка
  `{kind: 'resolution', id, owner}` в `discounts`, никогда в остаток. Мировой шаг `temperature −2` — процедура RX12
  дословно (пункт карты первым, пол вторым, оба названы; −28 °C → один шаг с фактической записью; `unrewarded`).
  `forecast` у скидки ПУСТ ПО ПОСТРОЕНИЮ: двойник — сам разбор (`discountsOf`), факт печатал бы те же 3 M€ второй раз
  без пары `effect-triggered`. Спек карты 32 + гард.
- **Блок B (`9490b1d057`).** Из потребителей разбора учить пришлось ОДНОГО: плитка скидки слоя «Эффекты» (R3) брала
  заголовок только у карты/корпорации и печатала политический источник как «Прочие скидки» → `forecastItemPoliticalSource`
  (чистая модель) + имя закона через манифест + эмблема партии; журнал уже умел (`sourceToChild` → `resolutionName`),
  панель оплаты читает `discountTail`, нотификации скидок не показывают по замыслу. Юниты: модель +3, монтируемый
  эксплорер 3, журнал +1.
- **Блок C (`f0c67bb481`).** Бет, чтения, лента, итоги, иконки — температуру уже знали; обобщён только стенд:
  сценарий предела семейства `world-move` объявляет `parameter` и виден лишь закону, который его двигает.
- **Блок D.** Фикстуры `parliament-heat-assembly` (−20 °C, делегат синего) и `parliament-heat-enacted` (закон принят,
  красный открывает 2-е поколение с «Ядерной энергией» в руке — сервер ценит её в 7); ОДИН e2e
  `console-parliament-heat.spec.ts`: осмотр «Температура: −20°C → −24°C» + блок пассива → «+4 M€» → отход к полю
  → маркер −24 °C, ни РТ-чипа, ни празднования → возврат → строка ПЛАНЕТА → (вторая фикстура) строка закона в
  списке эффектов → шапка оплаты «10 → 7 · −3» → плитка скидки «Улавливание тепла» с эмблемой, «Прочих скидок» нет.

### Находки

- **`Payment.of({megacredits})`** — ключ в нижнем регистре; `megaCredits` молча даёт 0 («Did not spend enough»).
- **`npm run … | tail` прячет код возврата** — красный `build:test` (литерал `'Unity'` вместо `PartyName.UNITY`) ушёл в
  коммит; `reset --soft` и перекоммит. Гейт всегда через `> log; echo $?`.
- **Фильтр `FIXTURES` генератора действует только на ЗАПИСЬ** — все фикстуры строятся; аранжировка
  `parliament-renewal-assembly` ждала карту Зелёных ОТ ПОСЕВА и упала, когда Красные получили вторую карту — теперь
  сажает Aquifer Contest через `seatResolution` (e2e обновления имя карты не читает).
- **Ранний выход `increaseTemperature` на максимуме** совпадает с пунктом карты, но шаг им не пользуется — пропуск назван.
- Чужое, НЕ трогалось: слой R3 у «Ядерной энергии» с Aridor печатает ДВЕ одинаковые плитки «Новый тип метки: +1
  производство M€» (по факту на каждую новую метку — энергия и стройка), без указания, какая метка у какой.

### Прогоны (2026-09-24)

| Что | Результат |
| --- | --- |
| `HeatCapture.spec` (32) · `ResolutionContract` (94) · RX10/RX11/RX12 · `ResolutionPassive` · `Player.spec` · `effectForecast.spec` · `rewardAddress` (224) | зелёные |
| клиентские юниты: `effectForecastModel` (39) · `ConsoleEffectsExplorerDiscount` (3) · `journalEventChild` (14) · `e2eFixturesLoad` (67) · глоссарий + гард драйвера (11) | зелёные |
| `npm run lint` · `build:test` (оба дерева) · `make:cards` · `npm run build` | зелёные |
| e2e `console-parliament-heat` · standard-1080 · свой сервер из `build/` | ✓ 1.0 мин с первого прогона |

Кадры: `screenshots/parliament-heat/` — `01b-inspect-world` (осмотр: «Температура: −20°C → −24°C», блок пассива),
`02-board-world-beat` (заседание у поля: маркер −24 °C, чип потери «−4», ни одного РТ-чипа), `04-results-planet`
(строка ПЛАНЕТА), `05-effects-strip` (строка закона первой: «ПРИНЯТАЯ РЕЗОЛЮЦИЯ · Улавливание тепла», печатная
графика с «[стройка]: −3»), `06-play-discount` (шапка оплаты «ЦЕНА 10 → 7 · −3»), `07-forecast-law` (R3: «Скидки и
оплата · Улавливание тепла», эмблема Красных, «−3 · 10 → 7»).

## RX15 · Industrialist Budget (Индустриалисты) — семейство БЮДЖЕТ: ПЛАТА как механизм (2026-09-24)

−10 M€ каждому ПЕРВЫМ, затем 1 M€ за шаг производства стали + титана + энергии + влияние, затем +4 производства
M€ плоско. Два новых механизма: ПЛАТА (первая отрицательная величина, которую резолюция берёт у игрока) и счёт по
ШАГАМ ПРОИЗВОДСТВА (пятый вид). Полный документ — `docs/TURMOIL_REDUX_INDUSTRIALIST_BUDGET.md`, промт —
`docs/claude/prompts/resolution-rx15-industrialist-budget.md`.

- **Блок A (`6d5c25cb78`).** `ResolutionDefinition.levy` (`common/parliament/resolutionLevy.ts`: одна арифметика
  `levyPaid`, никогда ниже нуля) + ОДИН общий шаг `levyStep(id, levy)` (`from: {resolution}` обязателен — без него
  `Stock.add` пишет `logIllegalState`); недобор — запись `stock` с отрицательным `amount`, `owed`, причиной; пустой
  запас — названный `skipped` с `owed`; оба всё равно получают выплату и производство. Вид счёта `production` —
  двойник `tags` с разбивкой `byResource` (сервер читает `player.production`). Адрес читает знак: ноль — пропуск,
  минус — потеря (`RewardDelivery.direction: 'loss'`), вида `stockLoss` не понадобилось. Модель места несёт `stock`
  под ресурсом платы. Гард: плата ↔ шаг, шаг ПЕРВЫМ, `checkLevy`. Спек карты 25 (три утверждения очерёдности:
  плата из денег, уже включающих доход — запись `20 → 10`; +4 впервые платят в следующем поколении; счёт от момента
  не зависит — энергия в запасе стала теплом, трек прежний).
- **Блок B (`dc9a13d371`).** Плата читается одной линией в печатном порядке: «−10 → [сталь] 2 + [титан] 1 +
  [энергия] 2 + [влияние] 2 → +7 = −3» (`ConsoleInfluenceYield`, проп `levy`; три момента —
  `voteLevyOf` / `resolvingLevyOf` / `enactedLevyOf`); нехватка — «−4 из 10» + нота панели; горизонт производства
  «платит со следующего поколения»; плоская часть без кластера входов; осмотр — строка платы первой и разбивка по
  ресурсам; итоги — подписанные части, `owed`, нота недобора, строка нетто «= −3». Бюджет панели голосования
  (28 слов) выдержан — гард ходит по каталогу.
- **Блок C (`7412d4a56c`).** Тот же конвейер наоборот: `ResourceTransferSpec.direction: 'loss'` — чип рождается на
  строке рельсы, летит на ОТРИЦАТЕЛЬНУЮ плитку закона (`resolveGainIconOrigins` выбирает тайл M€ по знаку — на лице их
  две) и растворяется там; `launched` у полёта — тик счётчика при отрыве; холд потерь ОТДЕЛЬНОЙ картой
  (`stockLoss` / `productionLoss`, `heldStock = gains − losses`) — единая знаковая карта давала фантом после позднего
  приземления. Директор: плата ПЕРВОЙ, пауза дыхания 260 мс, выдачи по одной в порядке сервера (M€, потом
  производство), «дожать» пропускает паузу, не выдачи. Чип «−N» в тоне потери — ни мигания, ни празднования.
- **Блок D.** Фикстуры `parliament-budget-vote` / `parliament-budget-assembly` (синий: сталь 2 · титан 1 · энергия 2,
  Повестка 4; на заседании побеждает красный — у синего влияние 2 остаётся, заседание платит числа голосования);
  ОДИН e2e `console-parliament-budget.spec.ts`: панель голосования (плата во главе, входы по ресурсам, нетто −3,
  суффикс +1 · шаг 5, горизонт) → осмотр (строка платы, разбивка) → заседание: «−10» рождается на ячейке M€, счётчик
  тикает вниз ДО посадки чипа, чип садится в графику закона → «+7» с карты на ячейку, тик на касании → «+4» в
  производственную зону → запись в печатном порядке, выплата на остатке платы → итоги «−10 · +7 · +4 = −3».
  Стенд: семейство `counted-production`, панель шагов производства, синтетические записи платы.

### Находки

- **Посев сдвинулся с ростом каталога и обнажил заместителя**: слот 0 стал Красных, а «тихий» заместитель Красных
  в `quietResolutionOf` был dev-картой с ДОБОРОМ — четыре спека `ParliamentPhase.spec` встали на её интейке.
  Заместитель — Heat Capture. Общее правило прежнее: спек не полагается на посев.
- **`make:cards` — после правки `export_card_rendering.ts`**, иначе манифест без `levy` молча даёт «нет платы».
- **Лента заседания — ОДНА строка**: чтение блока — грид на три колонки, плита бюджета из пяти членов уходила во
  вторую строку, и 39-px лента её резала («−10 → 2 + 1 + 2 + 2» и ничего после). В ленте чтение — inline-flex без
  переноса; горизонт производства в ленте не печатается (там нет места под подпись; панель, осмотр и стенд печатают).
- `chai` `deep.include({x: undefined})` требует ключа; константа `{party: PartyName.X}` расширяется до `PartyName` —
  типизировать константу.
- Heredoc Bash-инструмента режется ~6 КБ — большие вставки в спеки через скрипт, записанный `Write`.

### Прогоны (2026-09-24)

| Что | Результат |
| --- | --- |
| `IndustrialistBudget.spec` (25) · `ResolutionContract` (100) · `rewardAddress` (8) · `ParliamentPhase` + `Renewal` + `Parliament` (43) · RX13/RX04/RX12/RX08/RX06 (127) · RX14 · глоссарий · итоги · загрузка фикстур (125) | зелёные |
| клиентские юниты: `influenceYieldModel` (+5) · `parliamentAnnotations` (+1) · `PremiumCountGlyph` (+1) · `voteInfoBudget` · `voteInfoModel` · `parliamentRewardBeat` (+1) · `consoleResourceTransfer` (+1) · `consolePlayedHero` · `consoleTilePlacement` — 91 + 70 | зелёные |
| `npm run lint` · `build:test` (оба дерева) · `make:cards` · `npm run build` | зелёные |
| e2e `console-parliament-budget` · standard-1080 · свой сервер из `build/` | ✓ 49.5 с с первого прогона; ✓ 49.8 с после починки ленты (кадр 05 читает всю линию) |

Кадры: `screenshots/parliament-budget/standard-1080/` — `02-vote-net` (панель: «−10 → [сталь] 2 + [титан] 1 +
[энергия] 2 + [влияние] 2 → +7 = −3 · +1 если победите · шаг 5», «+4 · платит со следующего поколения»),
`03-fullscreen-breakdown` (осмотр: «Плата: сначала 10 M€, затем выплата», «Учтены сейчас: производство стали 2 ·
производство титана 1 · производство энергии 2», две плиты — сейчас −3 и при победе −2), `05-levy-leaves` (рельса M€
50 с чипом «−10»; лента читает всю линию), `06-payout-back` (57, +7 и +4 производства), `07-results-net`
(«player1 −10 · +7 · +4 = −3», «player2 −10 · +1 · +4 = −9»).
