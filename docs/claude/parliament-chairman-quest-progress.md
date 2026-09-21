# «Председательство» — журнал прогресса

Промт: `docs/claude/prompts/parliament-chairman-quest.md` (выдан 2026-09-21).
Задача идёт ПАРАЛЛЕЛЬНО «Заседанию v5+»; общие файлы трогаются только добавлением.

## Диагноз (подтверждён по коду перед правкой)

1. `ConsoleParliamentAgenda.vue` · вотчер `lastAdvanceSeq` уже играет `playAgendaGlide` при
   `reason === 'quest'` вне заседания; `playAgendaGlide` первой строкой берёт `parliamentRootEl()`
   и при `undefined` схлопывается в `pulseAgendaStep` — то есть при игроке на доске показ
   «играет в пустоту».
2. `ChairmanSeat.seat()` спрашивает игрока (`chairman-seat`) только когда все семь делегатов стоят
   на резолюциях — в типичной партии промпта нет вообще.
3. `ChairmanSeat.onQuestCompleted()` первой строкой вызывал `advanceAgenda` (РТ / `drawCard`
   начислялись молча), и только потом `seat()`.

## Блок A · сервер: ворота задания

СТАТУС: **СДАН** (12118/0 по `npm run test:server`, `build:test` и `eslint` чисто).

Что сделано:

- **Маркер.** `ChairmanQuestPromptMeta {generation}` в `PlayerInputModel.ts`, поле `chairmanQuestPrompt`
  на `PlayerInput` + `markChairmanQuest()`, централизованная сериализация в `ServerModel.getWaitingFor`
  (ворота всегда верхнеуровневый промпт). Детект — только по маркеру; заголовок
  `'You completed the chairman quest'` (ключ УЖЕ существует — его печатает `ConsoleParliamentSeatPick`)
  нужен журналу и запасному рендереру.
- **Pending.** `SerializedParliament.SerializedPendingAction` += `{kind: 'chairman-quest'; player}`.
  В отличие от двух соседей эта запись стоит ДО необратимой половины.
- **`ChairmanSeat.onQuestCompleted`** больше не применяет ничего: логирует факт, пишет запись,
  дефёрит ворота с `Priority.BACK_OF_THE_LINE`.
- **Порядок после ответа: кресло → шаг Повестки** (`applyQuest`). Если `seat()` упёрся в выбор
  резолюции, шаг делает `seatPrompt.finish` — строго ПОСЛЕ ответа на выбор.
- **Один журнальный корень** на весь ответ (`events.beginAction(player, {kind:'parliament'},
  {category:'parliament'})`) — на нём будет стоять нотификация блока C.
- **Перезагрузка.** `ChairmanSeat.rebuildPrompts` восстанавливает ОБА вида pending.
- **Граница поколения.** `Game.postProductionPhase` перед стартом политической фазы вызывает
  `ChairmanSeat.deferPendingQuestGates` и, если что-то передефёрено, дренирует очередь и
  перезаходит. Нормально недостижимо (ворота встают внутри своего хода и блокируют игрока) —
  это сеть на потерянный при релоаде дефер.

Пробники (`tests/parliament/ChairmanQuestGate.spec.ts`, 8 шт.) — см. раздел «Пробники» ниже.

Переписанные старые спеки (поведение изменилось — награда теперь за воротами):
`QuestTracker.spec.ts`, `AquiferContest.spec.ts`, `ArchitectureAward.spec.ts`,
`BiodomeContest.spec.ts`, `CentralPowerGrid.spec.ts`, `ClimateResearch.spec.ts`.
Общий хелпер — `answerQuestGate(game, player)` / `questGateOf(player)` в `parliamentArrange.ts`.

## Блок B · консоль: flow «Председательство»

СТАТУС: не начат.

## Блок C · нотификации

СТАТУС: не начат.
