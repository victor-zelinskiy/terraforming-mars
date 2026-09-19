# Turmoil Redux — «Заседание парламента»: реализация Э0–Э4

Дата начала: 2026-09-19. Исполнение плана `TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` (§14, этапы Э0 → Э1 →
Э2 → Э3 → Э4) одним автономным прогоном; журнал по ходу — `docs/claude/parliament-sitting-progress.md`.
Каждый этап здесь: оценка → концепция → что изменилось → контракты → бюджеты профилей → проверка →
честные ограничения. В конце — «Передача в Э5» (швы стадии НАГРАДА).

---

## Э0 — механический разрез монолитов

### Оценка

До разреза Парламент жил в двух файлах: `ConsoleParliamentSection.vue` (3520 строк — шапка с зоной мест,
правительство, область голосования, партии, Повестка, режим голосования, кресло, сцена итогов, стадия
принятия, полёты через `Teleport to="body"` внутри секции) и `console_parliament.less` (3392 строки —
шасси, голосование, плакетка партии, грань резолюции, композер партийного действия, осмотр резолюции,
блоки влияния/награды, «Полигон»). Этапы Э1–Э4 трогают разные части — без разреза они делят один файл.

### Концепция разреза

**Ярусы — компоненты, стадия — общая запись.** Каждый ярус экрана (зона мест · правительство · область
голосования · партии · Повестка) и каждая поверхность-стадия (режим голосования · кресло · сцена
итогов · слой принятия · слой полётов) — свой SFC, читающий ОДНУ модульную запись потока
(`parliamentFlow`: зона, стадия, стадия до сабмита, курсор, транзиент голоса). Корень владеет машиной
стадий, грамматикой браузе-слоя, воронкой сабмита и крошкой. Так стадии Э3 («ЗАСЕДАНИЕ») ложатся в тот
же модуль потока, директор Э4 — в свои файлы, а Э3 удаляет `ConsoleParliamentRecap.vue` и
`ConsoleParliamentEnact.vue` целиком.

### Что изменилось (поведение и пиксели — нет; файлы — да)

| Было | Стало |
| --- | --- |
| `ConsoleParliamentSection.vue` (3520) | корень **700** + `parliament/ConsoleParliament{Seats,Government,VotingArea,Parties,Agenda,VoteMode,SeatPick,Recap,Enact,Flights}.vue` |
| `console/consoleParliamentState.ts` | `console/parliament/consoleParliamentFlow.ts` (шелл-запись `consoleParliamentUi` + запись потока `parliamentFlow`, крошка, пульс кресла, корневой элемент) |
| полёты в SFC | `parliament/parliamentFlights.ts` (спеки, длительности, реестр прокси/хендлов, `flyCube`/`flyCard`/`flySeatDelegate`, `placeCubeRect`) + рендер `ConsoleParliamentFlights.vue` |
| `recapPending` в `data()` | `parliament/parliamentDisplayHolds.ts` (`parliamentHolds` — что ярусы ещё показывают до посадки; `seedRecapHolds`) |
| `fitCards()` метод | `parliament/parliamentCardFit.ts` (`fitParliamentCards()`) |
| чтения «как показано» в методах | `parliament/parliamentVoteView.ts` (чистые) |
| `ParliamentInspectRequest` в SFC | `parliament/parliamentInspect.ts` (+ `slotFaceOf`) |
| `commands`/`browseCommands` | `parliament/parliamentCommands.ts` |
| `navigate`/`inspect`/`openAction` | `parliament/parliamentNavigation.ts` |
| хуки `<transition>` стадии | `parliament/parliamentStageMotion.ts` |
| `console_parliament.less` (3392) | `console_parliament.less` (1178, шасси) + `_vote` (328) + `_sitting` (116) + `console_party_plaque` (227) + `console_resolution_face` (200) + `console_party_action` (309) + `console_resolution_inspect` (429) + `console_influence_yield` (481) + `console_resolutions_playground` (149); `common.less` импортирует девять |

Отклонения от буквы плана §10 и почему — в журнале прогресса (модульная запись стадии уже на Э0;
компонентов 11, а не 9; модули сверх плана).

### Контракты

- **`parliamentFlow`** (`consoleParliamentFlow.ts`) — одна реактивная запись на секцию: `zone · stage ·
  stageBeforeSubmit · slotIndex · partyIndex · voteEntering · voteLeaving · voteSnapshot · sourceHold ·
  sourceLeaving · landedSeq · flightSeq · concluded · chairPulse`; сбрасывается корнем в `created()` и
  `unmounted()` — семантика прежнего `data()`. Производные: `parliamentStageKind()`, `parliamentVoteUp()`,
  `parliamentSlotsCarried()`, `parliamentStageUp()`, `parliamentVoteInFlight()`; крошка —
  `parliamentCrumbSubject/Stage/Committed`; корневой элемент — `setParliamentRootEl`/`parliamentRootEl`.
- **`parliamentHolds`** (`parliamentDisplayHolds.ts`) — `returns · support · hiddenCubes · lobby ·
  freshFaces · deckPending · govAwaits · parked`; пишет сцена, читают ярусы.
- **`parliamentFlights`** — реактивные `flights`/`cardFlights`; `setFlightEl` из `:ref` рендерера;
  `dropFlight`/`dropFlightsWithPrefix`/`killParliamentFlights`.
- **Корень ↔ дети:** VoteMode — `send({response, from})`, `flow-complete`, `notice`, `inspect`; ответ
  сервера корень маршрутизирует в `answerAfterSubmit()`/`answerWhilePaying()`; SeatPick — `submit(rect)`,
  `inspect`; Recap — `beat(item)`, `close`; Agenda — публичный `playAgendaGlide(move)`.
- **DOM-свидетели** (`data-parl-*`, классы `.con-parl__*`) — множества до/после совпадают (проверено
  сравнением наборов по `git show HEAD:` и новым файлам).

### Проверка

- Пиксельный паритет: временный пробник `tests/e2e/tmp-parl-e0-parity.spec.ts` (удалён после приёмки) —
  три профиля × 10 сцен, устоявшиеся снимки, две базовые линии на старой сборке (маска шума самого
  пробника), сравнение «после» вне маски. **Пробник нашёл две настоящие регрессии разреза**, невидимые
  тип-чеку и юнит-спекам: (1) сброс модульной записи потока в `created()` стирал стадию, которую
  `immediate`-вотчеры открыли до него (кресло и принятие не открывались) → сброс в `beforeCreate()`;
  (2) порядок импортов LESS перевернул каскад «позднего» блока стадии принятия против шасси влияния
  (`.con-parl__enact-yield` ↔ `.con-iyield`, равная специфичность) — выплата под картой потеряла
  центрирование → `console_parliament_sitting.less` импортируется после `console_influence_yield.less`;
  гард `tests/console/parliamentLessOrder.spec.ts`. Полный разбор и таблица шума — в журнале прогресса.
- `git diff --color-moved=dimmed-zebra --color-moved-ws=allow-indentation-change -- src/styles/`: вне
  перемещений — только новые `@import`, шапки-комментарии и строки-обёртки.
- `vue-tsc`, `eslint --no-cache` (новые/изменённые файлы), `npm run build:test`, `npm run test:server`,
  `npm run test:client` — зелёные; `console-shell.js` +0,31 % (brotli +0,39 %).

### Честные ограничения Э0

- Полёты по-прежнему рендерятся `Teleport to="body"` изнутри секции (`ConsoleParliamentFlights.vue`) —
  переезд в шелл-слой оставлен Э4, как и предписано планом.
- `recapSeen`/`localStorage` пока живут в `consoleParliamentFlow.ts` — удаляются в Э3 вместе со сценой.
- Стадия принятия — отдельный слой `ConsoleParliamentEnact.vue` с прежним CSS в `_sitting.less`; Э3
  заменяет его стадией НАГРАДА на общем шасси.
- Пиксельный ноль «по определению» недостижим: иконки `card.webp` (1080), шевроны дока (TV) и растр
  композитного слоя карт после свёртывания режима голосования (TV/Deck) расходятся между прогонами одной
  и той же сборки; приёмка — ноль вне этих классов, при детерминированной геометрии (проверена отдельно).
- Пробник покрывает десять сцен; композер партийного действия и «Полигон» пиксельно не сравнивались —
  их блоки в разрезе не «поздние» (порядок относительно всех остальных сохранён), риск каскада там
  снят по построению, не замером.

---

## Э1 — серверный момент: ворота фазы, сводка в живой модели, протокол в журнале

### Оценка

Прежний драйвер ставил награду ДО того, как игрок видел вердикт: сцена итогов открывалась на `mounted()`
клиента, «видел» хранилось в `localStorage`, а фаза исследования накладывала свой промпт на раздачу.
Сервер не ждал никого — reload пропускал момент, второе устройство показывало его дважды.

### Концепция

**Конец поколения — один серверный поток с ДВУМЯ воротами** (план §3, решение Q2): `assembly` после
принятия и до эффектов — каждый участник подтверждает вердикт и принятие, и только потом закон платит;
`adjourn` после лобби (в финальном поколении — сразу после эффектов) — каждый подтверждает обновлённую
область, и только потом начинается следующее поколение. Ворота — один `SelectOption` на участника с
маркером `parliamentPhasePrompt`; барьер — ключ в `appliedBySeat`, не счётчик: клон, reload и двойной
ответ безопасны по построению; resume переиздаёт только неответившим. Вся правда фазы — в сохранении:
сводка В ПРОЦЕССЕ едет в модели с первого шага (та же форма, что у `lastPhase`), история заседаний — cap 24.

### Что изменилось

| Файл | Что |
| --- | --- |
| `common/parliament/ParliamentTypes.ts` | `ParliamentPhaseStep` += `assembly`, `adjourn`; `ParliamentPhaseStage` |
| `common/models/PlayerInputModel.ts` · `server/PlayerInput.ts` · `models/ServerModel.ts` | маркер `parliamentPhasePrompt {stage, generation, final, seq, awaiting}`; `markParliamentPhase`; `awaiting` считается централизованно при сборке модели |
| `parliament/ParliamentPhase.ts` | `stepGate` · `convene` (один журнальный корень) · `rootContext` (rejoin) · итеративная `drive` · `readReactions` · `finish` → история; `parliamentGatePending / parliamentGateAwaiting / isGatePrompt / gateKey` |
| `events/EventRecorder.ts` | `beginAction(player \| undefined)`; коалесценция `political-phase`; `rejoinAction` |
| `parliament/SerializedParliament.ts` · `Parliament.ts` | `summary.seq / correlationId`; `effects.scan`; `phaseSeq`, `phaseHistory` (cap `PARLIAMENT_PHASE_HISTORY_CAP` = 24); outcome `kind: 'reaction'` + `party`, `trigger` |
| `parliament/ParliamentModel.ts` · `common/models/ParliamentModel.ts` | `phase.summary`, `phase.awaiting`, `phaseHistory`, `seq / correlationId`, `reaction` |
| `journalView.ts` · `notificationIngest.ts` · `ConsoleParliamentRecap.vue` · `winnerRewardModel.ts` | группа `political-phase` не схлопывается; корень не презентуется лентой; `case 'reaction'`; тайл ≠ реакция |
| `ru/parliament.json` | корневая строка с поколением, заголовки ворот, тексты реакции |

### Контракты

- **Порядок опыта = порядок игры:** `winner → agenda → support → enact → ASSEMBLY → effects → refresh → lobby
  → ADJOURN → done`; final: `… → effects → ADJOURN → done`.
- **Ворота**: `parliamentGatePending(game, parliament, stage)` — единственный источник «кто ещё не ответил»
  (модель фазы `awaiting`, маркер промпта `awaiting`, барьер драйвера — всё из него). Стоящий промпт не
  перезаписывается никогда.
- **Журнал**: одна группа на заседание, `summary.correlationId` — её ключ; каждое продолжение фазы
  (ответ на ворота, ответ резолюции, resume) идёт под `rejoinAction(correlationId)`; конец фазы — вне её.
- **`reaction`**: производная от событий рекордера в окне шага (`effects.scan`), одна запись на (партия,
  триггер, ресурс) под `step` шага-причины; резолюция ничего о партиях не знает. Потребитель, которому
  нужна «запись самого шага», фильтрует `kind !== 'reaction'`.
- **Совместимость**: `PARLIAMENT_SAVE_VERSION` = 1; старая фаза в процессе доигрывается (получит `adjourn`
  после `lobby`); `lastPhase` без `seq/correlationId` — честная деградация (без rejoin — как раньше, каждый
  шаг сам себе группа); `Cloner.replacePlayerIds` переносит ключи ворот со своим местом.

### Проверка

- Серверные спеки §13.1 (+9 в `ParliamentPhase.spec`, +2 `ParliamentModel.spec`, +2 `PartyEffects.spec`,
  +3 `politicalPhaseScope.spec`, +1 `journalView.spec`, +4 клиентский `notificationIngest.spec`,
  `e2eFixturesLoad` с проверкой ворот); спеки пяти резолюций адаптированы без изменения числа `it`.
- Фикстуры: единый строитель `parliamentFixture({... stopAt})`, 34 регенерированы, 10 новых
  (`-assembly` / `-adjourn` для RX01–RX05).
- e2e без браузера `console-parliament-gates.spec.ts`: dev-door, два места, «ответ первого не двигает,
  второго — двигает», stale-двойной ответ отклонён.
- Полные прогоны — см. журнал прогресса (раздел Э1 «Итог приёмки»).

### Честные ограничения Э1

- До Э3 промпт ворот в консоли — generic confirm, а лента уведомлений уже не показывает группу
  `political-phase` (её презентер — заседание); журнал полон.
- `phaseHistory` в модели каждого ответа (до 24 сводок); клиентский протокол — вне скоупа (Q8).

---

## Э2 — контракт автора резолюции, таблица адресов, гард по каталогу

### Оценка

Пять резолюций писались по образцу друг друга, но ничто не заставляло шестую отчитаться о каждом шаге, дать
промпту маркер или иметь адрес награды — клиент узнал бы об этом сценой, которая молчит.

### Концепция

**Резолюция — декларация + шаги, которые ОТЧИТЫВАЮТСЯ; клиент знает адреса, не имена.** Таблица адресов
(`rewardAddress.ts`) — `Record` по всему union `kind`: новая награда без строки не собирается. Гард
(`ResolutionContract.spec.ts`) перечисляет каталог сам и прогоняет каждую карту через настоящую фазу — он и
есть worklist для следующих 43 карт.

### Что изменилось

| Файл | Что |
| --- | --- |
| `common/parliament/rewardAddress.ts` (новый) | `REWARD_ADDRESS` (8 видов), `rewardAddressOf(outcome, viewer)` → `RewardDelivery` |
| `client/console/parliament/resolutionFamily.ts` (новый) · `ConsoleResolutionsPlayground.vue` | `familyOf(declaration)`; стенд без таблицы по id |
| `parliament/resolutions/ResolutionCatalog.ts` | dev-примеры по контракту: один шаг — одна запись, интейк для добора, `grantStock` / `drawStep` |
| `tests/parliament/ResolutionContract.spec.ts` (новый) · `rewardAddress.spec.ts` (новый) | гард по каталогу (8 пунктов) · таблица адресов |
| `docs/claude/parliament-resolution-checklist.md` (новый) · `.claude/rules/game-logic.md` · `docs/claude/README.md` | полная и короткая формы контракта |
| `ru/parliament.json` | заголовки пропуска, причины dev-примеров |

### Контракты

- **Один шаг — одна запись** с `kind` из таблицы; пропуск — с переведённой причиной и (если честно известна)
  величиной. **Мутирует ИЛИ спрашивает**; решённое до вопроса — в `ctx.state`.
- **Маркер источника** у каждого промпта; заголовок — только текст.
- **Новый вид награды** = kind + строка адреса + спек ДО первой карты; ожидаемые будущие виды перечислены,
  не добавлены.
- **Клиент не знает имён**: гард ищет id каталога и импорты `resolutions/` по `src/client/**`.

### Проверка

`ResolutionContract.spec` — 5 реальных × (2 матрицы отчётности + маркеры/resume + лицо/локаль + стенд) + 6
dev-примеров + фраза гарда + таблица/union + клиентский grep; `rewardAddress.spec` — 5. Полные прогоны — в
журнале прогресса.

### Честные ограничения Э2

- Уместность причины пропуска — спек карты, не гард; «одна подходящая карта» — общий набор в гарде.
- Образец сломанной карты — `describe.skip` (определение вне каталога не сажается в игру); фраза закреплена
  юнит-тестом.

## Э3 — маршрутизация и каркас flow «ЗАСЕДАНИЕ»

### Оценка

Сцена «Итоги» открывалась по `mounted()` workspace, гейтилась `localStorage` и шла по `setTimeout`-тактам; каждый
вопрос резолюции анонсировался отдельной плитой поверх поля; стадия принятия была второй плитой (`__enact`)
вне chassis. Половина flow — состояние игры, половина — память браузера.

### Концепция

**Политическая фаза — ОДИН flow workspace «Парламент», стадия которого — серверный шаг.** Крошка
`⚖ ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ|ПРИНЯТИЕ|НАГРАДА|ВЫБОР|ПОЛУЧЕНИЕ|РАЗМЕЩЕНИЕ|ОБНОВЛЕНИЕ|ЗАКРЫТИЕ` только
удлиняется; один анонс на поколение («Парламент собрался · поколение N», FLOW-бит `parliament:gen<N>`), A
открывает; вопросы резолюции — двери `followUp` внутри открытого flow, никогда вторая плита; B по фазе
(`committed` → свернуть, `verdict` на ЗАКРЫТИИ → none, бит в полёте → none); reload — та же серверная стадия
(ничего отвеченного не переспрашивается: отвеченные ворота садят курсор на позу «Ждём»); клиентской памяти
«уже видел» нет.

### Что изменилось

| Файл | Что |
| --- | --- |
| `client/console/parliament/consoleSittingFlow.ts` (новый) | чистая позиция заседания: `sittingPositionOf` (шаг · страницы · ворота · ожидание · ask), `sittingStageKey`, `sittingWorkspacePhase`, `sittingPrimaryKey`, `sittingStartPage`, `parliamentSittingFlowBeat` |
| `client/components/console/parliament/ConsoleParliamentSitting.vue` (новый) | host-agnostic поверхность (`embedded`, `mode: live\|review`): пять стадий — ПОЗЫ одной смонтированной поверхности (layer stack), плита пропуска, строка ожидания, поза «Ждём: [кубы]», зона `[data-embed-slot="parliament-stage"]` |
| `ConsoleParliamentSection.vue` | стадия `sitting` на chassis `.con-parl__stage` (та же, что у КРЕСЛА); полевая поза `--field` для размещённого шага (пикер/добор) — офсеты среднего яруса измерены (`--con-parl-mid-top/-bottom`); крошка/фаза/команды/ответ на ворота `{type:'option'}` |
| `consoleParliamentFlow.ts` | удалены `recapSeen`/`localStorage`/`RECAP_*`/`chairTimer`; `stage: 'sitting'`, `sittingPage`, `sittingField`, `consoleParliamentUi.stageStanding` |
| `consoleTaskRouter.ts` | `TaskKind 'parliamentPhase'` по маркеру (выше сырых типов), членство в section-наборах, `taskMinimizable`, `followUpStepStage(kind, wf)` — таблица стадий для промптов с источником-резолюцией (`Choice`/`Intake`/`Placement`) |
| `consoleMandatoryGate.ts` | `MandatoryFlowKind 'parliament-phase'`; в живом заседании вопрос резолюции не образует собственного бита (flow-бит покрывает) |
| `consoleTaskSummary.ts` · `consoleWorkspaceStack.ts` | копия ворот (`Open the sitting` / `Return to the sitting`); строка `parliament`: `serves: ['party','parliamentPhase']`, `yieldsToBoard`, `parkOwnsFlow` |
| `ConsoleShell.vue` | flow-бит заседания, дверь A (`enterWorkspace('parliament', {anchor: phase})`; парк восстанавливается), одна зона `parliament-stage` для пикера и добора, плита заседания, watcher `parliamentSittingFrameLive` (falling edge закрывает phase-anchored корень), дверь `parliamentPhase` в `openShellTaskSurface` |
| `parliamentBeat.ts` (новый) · VoteMode · PartyActionComposer · parliamentFlights · consoleResolutionPayout · Agenda/Government/Parties | ни одного `setTimeout` в дереве кроме `SUBMIT_SAFETY_MS`: биты на часах GSAP (`gsap.delayedCall`), one-shot пульсы гасятся `animationend` |
| удалены | `ConsoleParliamentRecap.vue`, `ConsoleParliamentEnact.vue`, `.con-parl__recap-*`, `--recap`-правила, селектор `parliament-enact` |
| `console_parliament_sitting.less` | поверхность `.con-sit` (позы, ряды-объекты, плита пропуска, зона), полевая поза стадии, «подсветка стадии» на ярусах — статичный золотой шов |
| `ru/parliament.json` | 26 ключей заседания (стадии, глаголы, плита, ряды) |
| гарды | `tests/console/parliamentNoTimers.spec.ts`, `parliamentNoLocalStorage.spec.ts` (статические); `consoleSittingFlow.spec.ts` (чистый); обновлены `consoleTaskRouter/-MandatoryGate/-TaskSummary/-PromptAdmission.spec` |
| e2e | `tests/e2e/console-parliament-sitting.spec.ts` — структурная половина на трёх профилях |

### Контракты

- **Стадия = серверный шаг.** `assembly` → страницы ВЕРДИКТ · ПРИНЯТИЕ · НАГРАДА (A листает, A на последней
  отвечает ворота 1); `effects` → НАГРАДА с шагом (`choice`/`intake`/`placement`/`waiting`/`received`);
  `adjourn` → ОБНОВЛЕНИЕ · ЗАКРЫТИЕ (A на ЗАКРЫТИИ отвечает ворота 2; `final` — сразу ЗАКРЫТИЕ). Локальная
  страница внутри шага — презентация; отвеченные ворота садят курсор на последнюю страницу.
- **Один анонс на поколение**: flow-бит `parliament:gen<N>` (`parliamentSittingFlowBeat`) стабилен на все
  промпты фазы; `mandatoryBeatFor` не образует task-бит для вопроса резолюции при живом flow-бите заседания.
- **Одна зона** `[data-embed-slot="parliament-stage"]` — пикер (`ConsoleTaskHost`) и добор
  (`ConsoleExternalDrawWorkspace embedded`); `taskHeldForWorkspace` держит хост «нигде», пока зона не стоит.
  Тайл победителя — поле: `yieldsToBoard` уводит стек и возвращает его после посадки.
- **Фаза workspace**: `sittingWorkspacePhase` — `committed` до ЗАКРЫТИЯ, `verdict` на ЗАКРЫТИИ, `executing`
  при отправке; B и его подпись — из `backVerbFor`, никогда из ветки.
- **Конец flow = конец фазы**: корень якорится на `Phase.PARLIAMENT`; `parliamentSittingFrameLive` (falling
  edge) закрывает его (`closeWorkspaceRoot`), как у драфта; парк тоже.
- **Ни одного таймера** кроме `SUBMIT_SAFETY_MS`; **ни одной записи на устройство**.

### Проверка

`consoleSittingFlow.spec` 17 · статические гарды 4 · `consoleTaskRouter/-Gate/-Summary/-Admission.spec`
расширены · e2e `console-parliament-sitting` (2 теста × 3 профиля). Полные прогоны и замеры — в журнале
прогресса.

### Честные ограничения Э3

- Локальная страница внутри серверного шага не переживает reload/park: заседание возвращается на первую
  страницу шага (или на позу «Ждём», если ворота отвечены). Компактный реплей пройденных стадий — Э4
  (`resume`-режим директора).
- Стадии — статичные позы: подсветка на ярусах — золотой шов, переходы стадий — смена модификатора
  (chassis'ный UNFOLD/FOLD стадии — при входе/выходе; между позами — Э4).
- Стадия ОБНОВЛЕНИЕ читает `refreshed`/`lobbyRefilled` сводки; сброшенные проигравшие не перечислены (сводка их
  не несёт) — их уход показывает Э4 полётами.
- Стадия НАГРАДА: чтение + плита пропуска + существующие пикер/добор/тайл; физика награды (волна, добор без
  дубля, парковка под тайл и возврат) — Э5.
- Reload во время тайла победителя: плита анонсирует заседание, A отпускает размещение (Парламент не
  открывается поверх поля); после посадки следующие ворота открывают Парламент дверью `parliamentPhase`.

## Э4 — директор заседания: физические беты под hold, 3D-переворот раздачи

### Оценка

Статичные позы Э3 показывали ИТОГ каждой стадии; ничто не двигалось из реального места в реальное. Раздача
резолюций в прежней сцене была плоским прокси (лицо появлялось за кадр), полёты жили в `Teleport to="body"`
секции, кубы возврата летели «из центра карты» без владельца.

### Концепция

**Каждый бет — GSAP-таймлайн под animation-hold; каждый объект летит из измеренного места в измеренное.**
Список бетов — ЧИСТАЯ функция сводки (`sittingBeats(summary, viewer, mode, current)`), порядок = порядок
сервера, бет существует только для факта, который сводка несёт; директор (`sittingDirector.ts`) — единственный
владелец таймлайнов: одна стадия = один master под `holdForGsapAnimation('parliament-sitting:<stage>')` с
`diagnose` и `expire` (потолок снимает КЛИН: убивает полёты, чистит display-holds, снимает peek). A во время
бета = «дожать» (master и каждый полёт → `progress(1)`, посадки срабатывают по порядку), никогда пропуск
стадии. Reduced-motion — позы сразу, те же стадии, те же A. Perf-lite — те же таймлайны (transform/opacity).

### Что изменилось

| Файл | Что |
| --- | --- |
| `client/console/parliament/sittingBeats.ts` (новый) + `tests/console/sittingBeats.spec.ts` | чистый список бетов: `verdict · agenda? · support? · enact · reward×N(зрителя; skip с причиной) · renewal? · lobby? · closing`; `final` — без renewal/lobby; `resume` компактит пройденные стадии, `review` — все; гард «ни одного id каталога» |
| `client/console/parliament/sittingDirector.ts` (новый) | `seedEnactHolds` / `seedRenewalHolds` (display-holds ДО первого кадра), `parkSittingCards` (победитель лицом вверх над своим бывшим слотом, старый закон над правительством), беты ВЕРДИКТ (свет + пульс числа + reveal рядов), ПРИНЯТИЕ (старый закон → зона колоды; карта победителя FLIP-полётом в правительство — лицо правительства ждёт под `govAwaits`; кубы возврата ПО ВЛАДЕЛЬЦУ в резервы/склад; поддержка: ярус партий «выглядывает» (`peek`) и нейтральные кубы садятся на реальные места плашек; reveal плашки и задания; глайд Повестки — свой hold), ОБНОВЛЕНИЕ (проигравшие → зона колоды; раздача с `[data-parl-deck-top]` **с настоящим 3D-переворотом**, каданс посадок ≥ 6 кадров, тик колоды на отделении, лицо слота на посадке, прокси на следующем кадре; кубы поддержки на свежие карты; лобби из резервов), ЗАКРЫТИЕ (reveal карточки); `finishSittingMotion` («дожать»), `killSittingMotion`, `sittingMotion` (stage/peek) |
| `parliamentFlights.ts` | `CardFlightSpec.face/faceUp` (физическое тело), `dealResolutionCard` (born face-down на колоде, `addCard3DTurn` на подлёте, glint `con-deal-proxy--revealing`), `flyCube` возвращает id полёта при рождении (регистрация элемента — следующий рендер), `setFlightEl(id, null)` снимает регистрацию при размонтировании, `finishParliamentFlights` (стаггеры выстреливают сразу, полёты → `progress(1)`) |
| `ConsoleParliamentFlightLayer.vue` (новый, монтирует ШЕЛЛ) · удалён `ConsoleParliamentFlights.vue` | body-level fixed слой: кубы + карты с chassis `Card3DInner` (лицо = тот же lightweight vm, что в слоте — паритет; рубашка; кромка) |
| `ConsoleParliamentSection.vue` | план открытия (`planOpeningMotion`: seed всех holds стадий ≤ текущей, компактный реплей пройденных — resume; в полевой позе реплея нет), очередь моушена после unfold стадии, беты на смену страницы (один раз за монтаж), A во время бета = дожать, peek яруса партий |
| сервер: `SerializedParliament.ts` · `ParliamentPhase.ts` · `ParliamentModel.ts` · `common/models/ParliamentModel.ts` · `Parliament.ts` | `summary.discarded` — проигравшие, сброшенные при обновлении (аддитивно; фильтр retired учитывает) |
| `console_parliament_sitting.less` | позы директора: `--peek`, `--lit`, физический прокси-карта (outer без клипа, рамка на гранях), кроссфейд панели |
| e2e `tests/e2e/console-parliament-sitting-motion.spec.ts` | сэмплер `setInterval` + `MutationObserver` (никогда rAF): траектории (смещение ≥ 60/20 px), `rotateY` 180 → (30…150) → 0 монотонно, лицо слота скрыто в полёте и одно на покое, тик колоды монотонный, hold'ы пусты на покое, бюджеты стадий, «дожать», reduced-motion (ничего в воздухе), perf-lite (`filter: none`) |

### Контракты

- **Бет = факт сводки**; порядок = сервер; ничего не летит без измеренного источника и цели (`rectOf` /
  `placeCubeRect`); недоступный рект = честный пропуск бета (holds чистятся тут же).
- **Один hold на стадию** (`parliament-sitting:<stage>`), `expire` = честное восстановление; глайд Повестки
  держит свой (`parliament-agenda-glide`).
- **«Дожать», не пропустить**: A во время бета → `finishSittingMotion()`; страница не меняется.
- **Лицо переворота**: `Card3DInner` (opacity никогда на теле), `addCard3DTurn` на таймлайне полёта — одно
  движение; лицо слота `visibility: hidden` до посадки (`freshFaces`), прокси уходит на следующем кадре.
- **Ярус партий во время заседания припаркован под стадией; для бета ПОДДЕРЖКА он выглядывает** (стадия
  `opacity .08`), кубы садятся на реальные `.con-pseal__support-place`; peek снимается последней посадкой.

### Проверка

- `tests/console/sittingBeats.spec.ts` — 7; `consoleSittingFlow` 17; гарды `parliamentNoTimers` /
  `parliamentNoLocalStorage` зелёные.
- e2e (`--workers=1`): `console-parliament-sitting-motion.spec.ts` 4/4 на 1080 (сэмплер `setInterval` +
  `MutationObserver` — траектории, `rotateY` 180 → 0, лица, тик колоды, hold-ы, бюджеты, «дожать»,
  reduced-motion, perf-lite); регресс `console-parliament-sitting.spec.ts` 6/6 на трёх профилях.
- `test:server` 12051 passing / 2 pending · `test:client` 5694 · `build:test` 0 · `lint:client` 0 · eslint 0.
- Четыре ловушки, найденные пробником, а не глазом (`<transition>` без `appear`; `:style` против GSAP; id
  полёта при рождении; `:ref` → `null` при размонтировании), с замерами — в `docs/claude/parliament-sitting-progress.md` § Э4.

### Честные ограничения Э4

- Бонус Повестки (чип РТ → HUD / карта → док) не переигрывается: он уже выплачен ДО ворот и счётчик HUD уже
  сдвинулся — полёт к счётчику, который не тикает, был бы ложью; показывается глайд маркера и строка «+1 РТ».
- Подпись «→ резерв player1» у резерва при возврате кубов не реализована (кубы летят по владельцу; подпись —
  вместе с языком Э5).
- Прежний слот победителя: на ассамблее область показывает реальные слоты первыми, пустые — после, так что
  «бывший слот» = первый ПУСТОЙ контур (`[data-parl-slot-empty-card]`), не индекс `winner.slot`.
- Проигравшие при обновлении улетают из СВОИХ слотов (лица свежих карт спрятаны) в зону колоды: отдельного
  элемента сброса в ярусе нет — цель = стопка колоды.
- Видео покадрово не просматривалось (нет инструмента извлечения кадров); эвидентность — сэмплер (rotateY,
  смещения, лица) + скриншоты в полёте `screenshots/parliament-sitting-motion/`.
- Резюме после reload: компактный реплей ВЕРДИКТ→ПРИНЯТИЕ(→ОБНОВЛЕНИЕ) ×0.5 без пауз; локальная страница
  внутри шага по-прежнему не персистится (см. Э3).

## Передача в Э5 — стадия НАГРАДА: адрес → подача

**Что стоит после Э0–Э4.** Заседание — ОДИН flow (`ПАРЛАМЕНТ › ЗАСЕДАНИЕ › <СТАДИЯ>`), стадия = серверный
шаг, страница — локальный курсор; ворота отвечаются A на последней странице; каждый вопрос резолюции —
дверь `followUp` внутри зоны `[data-embed-slot="parliament-stage"]`; директор физически играет
ВЕРДИКТ / ПРИНЯТИЕ / ОБНОВЛЕНИЕ / ЗАКРЫТИЕ под именованными hold-ами; стадия НАГРАДА — статичное чтение
исхода (адрес из `rewardAddressOf`, плита пропуска с причиной, строка ожидания чужого места) на chassis
`.con-sit__reward` с hero-колонкой `[data-parl-sit-hero]` (карта-носитель), полевой позой `--field` для
размещённого шага и встроенным пикером / добором / тайлом. Э5 кладётся в готовые швы — ничего из каркаса
переделывать не нужно.

### Швы, в которые ложится Э5

1. **Бет `reward` в директоре.** `sittingBeats` уже выдаёт ОДИН бет на исход зрителя (`outcome`, `skipped`,
   стадия `reward`); в `playSittingStage` ветка `case 'reward'` — заглушка с комментарием. Э5 добавляет
   `beatReward(tl, ctx, beat)` по образцу `beatEnact`: адрес из `rewardAddressOf(outcome, viewer)` → волна с
   реальной иконки карты-носителя (`[data-graphic-node]` внутри `[data-parl-sit-hero]`, замер — старт чипа
   внутри ректа `.pcard-prod`) в рельсу через `runResourceTransfers`, тик счётчика в кадре касания под
   `beginPanelRewardHold`; реакция партии — с плашки партии яруса (peek уже умеет показать ярус под стадией).
   Hold стадии `parliament-sitting:reward` и «дожать» приходят бесплатно — master уже оборачивает любую ветку.
2. **Приход исхода.** `position.rewardStep` (`consoleSittingFlow.ts`) переходит `reading → received` по
   `phase.outcomes`; watcher секции `sittingStepKey` / `sittingStage` — место, где бет награды запускается на
   СВОЮ запись (ключ `${step}:${part}` — тот же, что у плиты пропуска). Бет играется один раз за монтаж
   (`plannedStages`), resume компактит его как остальные.
3. **Добор без дубля и призрака.** Встроенный `ConsoleExternalDrawWorkspace` в зоне уже без `__source`
   (`.con-sit` прячет док источника — источник стоит в hero-колонке); осталось: `__cause` → строка
   `.con-ws-stage-status`, призрак «В руке» → переукладка `wsStageLayout` ПОСЛЕ `runHandIntake.onLanded`
   (§7.3 плана), переворот take — `Card3DInner` (тот же chassis, что у раздачи), L3 →
   `workspaceSourceZoomOrigin` с хостом-парламентом (`sourceCard` claim-а — резолюция, `ResolutionZoomEntry`).
4. **Тайл победителя.** Ряд стека `yieldsToBoard: true` уже уводит стек на поле и возвращает его на ту же
   стадию (`sittingStartPage` сажает курсор на позу ожидания). Э5 добавляет парковку сцены на время
   размещения и позу «получено» с чипом параметра / РТ (`ParliamentEnactOutcomeModel.parameter`).
5. **Язык чтения ДО выплаты.** Сейчас `voteYieldsOf` (контекст `estimate`, подписи «по вашему текущему
   влиянию» / «если принять сейчас»); Э5 вводит чтение «этой выплаты» до записи (`resolving`, без пересчёта
   суммы на клиенте — из декларации автора и записанного влияния).
6. **Плита пропуска / чужое место** — `consoleTaskSummary.ts` уже отвечает за копию ворот; плата пропуска
   и «→ резерв <игрок>» у резерва — ключи в `ru/parliament.json` (английский текст = ключ; перед добавлением
   grep по всем `src/locales/<lang>/*.json`).

### Что Э4 сознательно оставил Э5 (и позже)

- Бонус Повестки как полёт (чип РТ → HUD / карта → док) — только если HUD научится держать счётчик до
  касания; сегодня — глайд маркера + строка «+1 РТ».
- Подпись «→ резерв <игрок>» при возврате кубов.
- Локальная страница внутри шага не персистится (reload → серверный шаг, курсор на позу ожидания).
- Видео покадрово (инструмент кадров) — эвидентность сегодня сэмплер + скриншоты в полёте.

### Ожидаемо сломанные существующие e2e (по правилам прогона не гонялись — адаптация в конце)

- `console-parliament.spec.ts` — recap-тесты (`.con-parl__recap-item`, фикстуры `parliament-recap*`):
  сцены результатов больше нет, фаза теперь стоит на воротах `assembly` / `adjourn` с плитой заседания.
- `console-parliament-{aquifer,architecture,biodome,powergrid,climate}.spec.ts` — там, где спек трогает
  стадию принятия (`.con-parl__enact--up`, `[data-embed-slot="parliament-enact"]`, плита «Эффект резолюции»)
  или сцену результатов: сейчас это стадии заседания, зона `parliament-stage`, крошка `ЗАСЕДАНИЕ › …`.
- `console-parliament-v2.spec.ts` / `console-parliament-actions.spec.ts` / `console-parliament-vote-fit.spec.ts` —
  только если читают recap или ждут авто-закрытия фазы (теперь ворота отвечает игрок).
- `console-external-draw.spec.ts` — если проверяет док источника / призрак ВНУТРИ парламента (вне заседания
  добор не менялся).
- `consoleStart.ts` `FixtureName` всё ещё перечисляет `-recap` фикстуры — генератор их выдаёт
  (`e2eFixturesLoad` зелёный), спеки на них адаптируются вместе с семейством.
