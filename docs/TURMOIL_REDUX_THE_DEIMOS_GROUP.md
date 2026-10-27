# TR83 · The Deimos Group — шестая новая корпорация Turmoil Redux

> Статус: СДЕЛАНО 2026-10-27. Карта — `src/server/cards/turmoilRedux/TheDeimosGroup.ts`; спек правил —
> `tests/cards/turmoilRedux/TheDeimosGroup.spec.ts`; клиент — `tests/client/console/deimosFirstActionStep.spec.ts`;
> e2e — `tests/e2e/console-the-deimos-group.spec.ts` (TIMING), фикстура `deimos`.

## 1. Скан и правила

50 M€, метка МАРСА. Слева «50» + белая фигура делегата — **первое действие: добавьте делегата на любую резолюцию**.
Бокс EFFECT одной строкой: «+2 [влияние] [плашка требования партии, перечёркнутая]» — **у вас +2 влияния; при розыгрыше
карт вы можете игнорировать все требования партий**. Без ПО, действия, ресурсов, производства. Лиловый ромб — сам модуль
(`compatibility` нет). Лор и арт — свои, TR83.

## 2. Три существующие декларации — ни одной новой механики

| Печать | Декларация | Читатель |
| --- | --- | --- |
| Первое действие | `firstAction: {text, turmoil: {sendDelegates: {count: 1}}}` | Executor → `politics.placeDelegates` → `PlaceDelegatesOnResolution` (`SelectParty`, `votePrompt.source === 'grant'`, делегат ИЗ РЕЗЕРВА; пустая область голосования — именованный пропуск) |
| +2 влияния | `behavior: {turmoil: {influenceBonus: 2}}` | леджер Парламента `addInfluenceBonus(player, 2, 'The Deimos Group')` — диск, «+2» с подсказкой дарителя, «Информация», выплаты, TR04, журнал `influence-changed` |
| Игнор требований партий | `partyRequirementWaiver: {}` (БЕЗ `nextCardOnly`) | `Card.waivesPartyRequirements` → `IPlayer.partyRequirementWaiver` → `PartyRequirement.satisfies`; `requirementEasingOf` — `effective: 'waived'`, `oneShot: false` |

Инфраструктурные правки — только расширения существующего:
- `Behavior.turmoil.influenceBonus` — литерал `1` → `number` (Executor `> 0` с суммой, чип превью `current → current + N`).
- `Player.partyRequirementWaiver()` — **стоячий вейвер называется первым** (решение 2): рядом со взведённой «Закулисной
  сделкой» требование снято корпорацией; заряд TR70 по закону TR49 всё равно тратится следующей картой.
- `PartyRequirementWaiver.nextCardOnly` — комментарий: отсутствие = стоячий вейвер.

## 3. Парламент знает вейвер — одним полем места

`ParliamentPlayerModel.partyRequirementWaiver?: {source, oneShot}` (сервер — `player.partyRequirementWaiver()` +
`partyWaiverIsOneShot`). Два читателя:
- **досье плашки партии** (`accessReasonRows` ctx `waiver`) — «Требование этой партии на картах: снято — «The Deimos
  Group»»; одноразовый — «… снято на один розыгрыш — «Закулисная сделка»» (и уступает «выполнено», если печатная дорога
  уже выполняет требование);
- **проекция голоса** — `unlocksRequirement: false` при СТОЯЧЕМ вейвере (одноразовый оставляет чип: требование
  откроется картам после следующей).

`access().satisfiesRequirement` не тронут: требование — карты, эффект — Парламента (FAQ p.19). Вейвер эффекта партии
не даёт.

## 4. Первое действие в консоли — шаг партии над стартом

Дорога знамени TR77, обобщённая: ОДИН предикат `firstActionPartyStep(wf)` (`bannerPrompt` ∨ `votePrompt.source ===
'grant'`, `consoleTaskRouter.ts`) читают сигнал `ConsoleShell.startPartyStepDue` (восходящий фронт — спада foreground
после подтверждения первого действия нет) и push кадра `parliament` над стартом (субъект — корпорация, стадия
`partyStepStageOf` → «ГОЛОСОВАНИЕ», фаза committed, B «Свернуть»). Секция Парламента сама вооружает режим голосования
до первого рендера (`bridge.grant` → `armGrantVoteFlow`) и берёт крошку стека (`sceneStepOfStart`) — «СТАРТ ПАРТИИ ›
THE DEIMOS GROUP › ГОЛОСОВАНИЕ». Ответ — ОДИН POST; делегат летит ИЗ РЕЗЕРВА игрока на ленту выбранной карты
(существующий полёт режима голосования). Брифинг стадии «ПЕРВОЕ ДЕЙСТВИЕ» рисует шаг `delegateGrantFollowUp` строкой
«1 делегат на резолюцию после подтверждения — выбор в Парламенте» (`delegateGrantFollowUpRow(step, 'confirm')`).

## 5. Рука, композер, журнал — даром

Карта с требованием партии в руке владельца: плашка руки — зачёркнутая кассета партии (`data-hand-ease="waive ✓"`) без
«один розыгрыш»; композер — строка требования «требование игнорируется · The Deimos Group»; R3 — модификатор
«Постоянный»; журнал — «… ignored the party requirement of … thanks to The Deimos Group» (`requirement-eased`, kind
`waive`). «ВЗВЕДЕНО» стоячий вейвер не показывает (`armedPlayEffects` — только `nextCardOnly`).

## 6. Что наследует следующая корпорация

- Первое действие, задающее вопрос Парламенту, — строка в `firstActionPartyStep` (маркер), ничего больше в оболочке.
- Стоячая «скидка требований» — `partyRequirementWaiver: {}`; поле места и проекции уже читают её.
- Бонус влияния любого размера — `influenceBonus: N`.

## 7. Решения владельца (по умолчанию)

1. Влияние — леджер, не хук `getInfluenceBonus`. 2. Стоячий вейвер называется первым. 3. Парламент читает вейвер одним
полем места; `access()` печатный. 4. Первое действие — Парламент в режиме голосования поверх старта. 5. Фигура уходит из
РЕЗЕРВА. 6. Одна подпись эффекта на кадр. 7. e2e — `console-the-deimos-group` (A — старт, B — фикстура). 8. Объём без
полировки сверх строк.

Известное: RU-словарь этого понятия смешан с TR70 — композер «Снято: …», строка требования «требование игнорируется»;
плашка Парламента взяла «снято» (как композер). Чужие RU-ключи не переписаны (инвариант 9).
