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
