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

СТАТУС: **СДАН** (client 5787/0, `tests/console` 297/0, `lint:client` и `build:test` чисто).

**Тело остаётся обзором Парламента** (закон 18 `console-ui.md`): новой панели НЕТ, говорит ЛЕНТА,
а объекты (блок задания в правительстве, кресло, маркер Повестки) двигаются на своих местах.

Новые файлы:
- `console/parliament/consoleChairmanQuest.ts` — чистая половина: запись потока, `armChairmanQuestFlow`
  (читает кресло и место делегата ДО ответа), детекторы `detectChairmanQuestAdvance` /
  `detectChairmanChange` и `seedChairmanQuestHolds` — посев в ТОМ ЖЕ синхронном блоке, что применение
  вида (вызывается из `gameTransport.seedRewardHolds` и `App.update`, последним: `enterSitting('')`
  реестра наград флашит бонус Повестки, посеянный до него).
- `console/parliament/chairmanQuestDirector.ts` — такты. Нового моушена НЕТ: глайд маркера — метод
  `ConsoleParliamentAgenda.playAgendaGlide`, кубы — `parliamentFlights.flyCube`, РТ-чип и обложка
  карты — тот же реестр `parliamentRewardBeat`. Бюджет: ЗАДАНИЕ 700 мс, пауза 250 мс,
  ПРЕДСЕДАТЕЛЬСТВО 300 + 480 = 780 мс (без прежнего председателя 180 + 480 = 660 мс),
  ПОВЕСТКА — фраза общего маркер-директора ≈ 1.07 с. Ни одного `setTimeout`: всё через
  `scheduleParliamentBeat` (гард `parliamentNoTimers`), весь поток держит animation hold.

Добавления в общие файлы (только добавлением):
- `parliamentDisplayHolds.ts` + `chairAwaits` (кресло показывает прежнего, пока куб не сел);
- `ConsoleParliamentGovernment.chairmanShown` читает его; блок задания пульсирует и от `flow.questPulse`;
- `parliamentBand.ts` + `BandQuest` и три строки (ЗАДАНИЕ · ПРЕДСЕДАТЕЛЬСТВО · ПОВЕСТКА);
- `consoleParliamentFlow.ts` + стадия `'quest'`, `questPulse`, крошка (`parliamentCrumbSubject(questLive)` /
  `parliamentCrumbStage(sittingTail, questTail)`);
- `ConsoleParliamentSeats.landFlash` звенит и в потоке `quest`;
- роутер (`chairmanQuest` по маркеру), сводка, `serves` парламента, `NATIVE_KINDS`,
  `SECTION_SERVED_KINDS`, `taskMinimizable` = false, `ALWAYS_INTERRUPTIVE` (анонс), маршрут открытия
  в `ConsoleShell` (`anchor: {type: 'always'}` — поток ПЕРЕЖИВАЕТ свой промпт).

Грамматика: A на плите анонса открывает Парламент, поток шлёт подтверждение ПОД читкой (минимальный
бет, который быстрый сервер не срезает); дальше такты идут сами; A во время такта — «дожать»
(не рекламируется, как в заседании), в конце A «Закрыть»; B молчит весь поток. Крайний случай
(все делегаты на резолюциях) — СТАДИЯ потока: директор ждёт (`owesSeatPick`), крошка остаётся
«ПРЕДСЕДАТЕЛЬСТВО › КРЕСЛО», после ответа такты продолжаются.

Пробники: `tests/client/console/chairmanQuestFlow.spec.ts` (10 шт. — см. ниже).

## Блок C · нотификации

СТАТУС: **СДАН** (server 12123/0, client 5787/0, `npm run lint` чисто).

- **Сигнал структурный, не текстовый и не категорийный.** Категория `parliament` общая с голосом и
  действиями партий, поэтому добавлен ТИП СОБЫТИЯ `'chairman-seated'`: `player` — новый председатель,
  `target.player` — прежний (отсутствует, когда кресло было пусто или его сохранил тот же игрок).
  `EventRecorder.recordChairmanSeated`. Прежнего держателя в крайнем случае несёт САМА запись
  `{kind: 'chairman-seat'; player; previous?}` — выбор регулярно отвечают после релоада.
- **Свой журнальный корень у каждого пути**: `applyQuest` и ответ на выбор делегата открывают
  `beginAction(..., {category: 'parliament'})` и первой строкой пишут заголовок группы
  `«${0} takes the chairmanship»` — иначе группа открывалась бы строкой уходящего делегата.
- **Вариант `'chairman'`** в `notificationTypes`, строка в `VARIANT_RELEVANCE` = **`exempt`**
  (через `involves` остальные игроки не получили бы ничего), `variantKind` = `important`,
  подпись `Chairmanship`, глиф `⚖`.
- **Два текста, один факт**: заголовок группы — всем; прежнему председателю модель ПОДМЕНЯЕТ заголовок
  на «Ваш делегат покинул председательство и вернулся в ваш резерв» (адресат структурный —
  `target.player` записи). Выполнившему карточки нет вообще: он прошёл весь поток.
- **Осмотр открывает Парламент**: новый CTA `open-parliament` → `notificationBus.openParliament` →
  `ConsoleShell.onNotificationOpenParliament` (браузный слой, ничего не переигрывается).


## Пробники (раздел 6 промта)

| № | Что утверждает | Где |
| --- | --- | --- |
| 1 | **Сервер молчит до ответа.** Задание выполнено, ворота стоят: маркер на старом шаге, РТ не изменился, рука не выросла, председательство не занято, `lastAdvance` не опубликован. После ответа — всё применилось. Плюс: ворота дефёрятся с `BACK_OF_THE_LINE`. | `tests/parliament/ChairmanQuestGate.spec.ts` (3 it) |
| 2 | **Порядок.** В логе посадка ПРЕДШЕСТВУЕТ шагу; в крайнем случае с выбором резолюции маркер не двигается, пока выбор стоит, и двигается сразу после ответа. | там же (2 it) |
| 3 | **Перезагрузка.** Ворота сериализованы, релоад их восстанавливает, ответ применяет награду один раз; второй релоад ничего не поднимает. | там же |
| 4 | **Граница поколения.** Неотвеченная запись не пускает политическую фазу: ворота перевыставляются, после ответа заседание собирается. | там же |
| 5 | **СЦЕНА ВИДНА** (тот самый пробник, что ловит исходный дефект). Плита стоит и Парламента НЕТ до нажатия A; после A секция смонтирована, трек виден, прокси маркера имеет чернила и над ним ничего не стоит во всех кадрах глайда, он реально перемещается, достигнутый шаг виден в кадре посадки; кресло меняется кубом; крошка всю жизнь несёт «ПРЕДСЕДАТЕЛЬСТВО» и её хвост двигается; законченный поток УХОДИТ. Сэмплер — `MutationObserver` + `setInterval`, никогда rAF. | `tests/e2e/console-parliament-chairman-quest.spec.ts` (фикстура `parliament-chairman-quest`) |
| 6 | **Маркер не опережает.** Посев ставит `agendaAwaits`, и смонтированный `ConsoleParliamentAgenda.shown` рисует куб на СТАРОМ шаге, а не на новом; вне потока ничего не держится. В e2e — то же по кадрам задачного клока. | `tests/client/console/chairmanQuestFlow.spec.ts` + e2e §⑥ |
| 7 | **Бонус по адресу.** Шаг РТ кладёт награду в реестр на достигнутый шаг (чип тикает на касании); шаг КАРТЫ паркует свой `agenda`-батч (и только его); шаг ВЛИЯНИЯ не должен ничего — и маркер всё равно едет. | `tests/client/console/chairmanQuestFlow.spec.ts` (3 it) |
| 8 | **Нотификация проходит фильтр.** В личном режиме её видят и прежний председатель, и игрок, никак не затронутый событием. Плюс сквозной прогон настоящего сервера: два текста, три читателя, включая крайний случай с выбором делегата. | `tests/notifications/notificationFeedPolicy.spec.ts` + `tests/notifications/chairmanNotification.spec.ts` (4 it) |

Дополнительно: маркер ворот и маршрутизация — `tests/client/components/console/consoleTaskRouter.spec.ts`
(строка 30e + полнота `TaskKind`), копия плиты — `consoleTaskSummary.spec.ts`, глоссарий —
`tests/console/parliamentGlossary.spec.ts`.

## Переписанные старые спеки

Поведение изменилось (награда теперь за воротами), поэтому переписаны:
`tests/parliament/QuestTracker.spec.ts`, `AquiferContest.spec.ts`, `ArchitectureAward.spec.ts`,
`BiodomeContest.spec.ts`, `CentralPowerGrid.spec.ts`, `ClimateResearch.spec.ts` — все через общий
хелпер `answerQuestGate(game, player)`. Фикстура `parliament-seat` пересобрана (теперь выбор делегата
поднимается ПОСЛЕ ответа на ворота); `tests/e2e/console-parliament.spec.ts` § кресло — 3/3 зелёные на
трёх профилях.

## Заседание не изменилось

Ни один файл заседания не переписан: в общие файлы добавлены только НОВЫЕ члены
(`parliamentDisplayHolds.chairAwaits`, `parliamentBand.BandQuest` + ветка `ctx.quest`, стадия
`'quest'` в `ParliamentStage`, `questPulse`), ветка `parliamentFlow.stage === 'sitting'` не тронута
нигде. Подтверждение: `tests/console/*` 297/0 (включая `parliamentBand`, `parliamentGlossary`,
`parliamentNoTimers`, `parliamentResults`), `tests/parliament/*` 258/0 (включая `ParliamentPhase`),
client 5787/0, server 12123/0.
