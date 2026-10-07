# TR31 · Nationalist Movement («Националистическое движение») — нейтралы приходят ПО КАРТЕ

**Статус: СДАНА 2026-10-07** (сервер, клиент, соперник, e2e — см. §8 «Что не сделано»). Карта проектов набора Turmoil
Redux, первая карта, которая ставит **нейтральный голос**. Печатный текст: «Requires the Reds to be ruling or that you
have 2 delegates there. Add 1 neutral delegate to each Reds and Mars First resolution up for voting, and to each of their
Popular Support Areas as well. Then gain M€ equal to the total number of neutral delegates in use. (Not in the reserve)»
Стоимость 2, метка Марс, ПО нет, требование `{party: REDS}` (вторая плашка Красных после TR30). Лор: «Tribalism is a
helluva drug.» → «Трайбализм — та ещё дурь.»

Вес карты — не в правиле, а в трёх контрактах, которые она заложила первой:

1. **ОДИН ПЛАН — ДВЕ ЧИТКИ без промта** (`RallyNeutralDelegates`): чистый план по печатному порядку и исполнение по нему
   теми же писателями стола, §2;
2. **Запись исхода `lastRally`** — презентационное кольцо (закон TR24), которое клиент играет один раз по `seq`, §3;
3. **Исход с НЕСКОЛЬКИМИ тактами и ПЕРЕСЧЁТОМ, хостимый рукой** (поза `rally`, брат `walk` TR04) и его обобщение —
   «хостимый шаг Парламента» по виду, §4–§5; **нейтральное прибытие ПО КАРТЕ у соперника**, §6.

Промт: `docs/claude/prompts/project-tr31-nationalist-movement.md` (выдан 2026-10-07). Файл карты:
`src/server/cards/turmoilRedux/NationalistMovement.ts`. Спеки: `tests/parliament/RallyNeutralDelegates.spec.ts`,
`tests/cards/turmoilRedux/NationalistMovement.spec.ts`, `tests/client/console/neutralRally.spec.ts`,
`tests/client/console/parliamentRivalVotes.spec.ts` § TR31, `tests/console/parliamentBand.spec.ts` § ДЕЛЕГАТЫ,
`tests/client/components/console/ConsoleNotificationCardCta.spec.ts`; e2e `tests/e2e/console-nationalist-movement.spec.ts`
(фикстуры `nationalist-movement`, `-short-supply`, `-reds-rule`).

---

## 0. Решения владельца (2026-10-07 — приняты по умолчанию, вынесены на подтверждение)

| Вопрос | Решение |
| --- | --- |
| Имя RU | «Националистическое движение» |
| Лор RU | «Трайбализм — та ещё дурь.» |
| Слово этапа в крошке | **«ДЕЛЕГАТЫ»** (`Delegates`); кикер ленты — «НЕЙТРАЛЬНЫЕ ДЕЛЕГАТЫ» (`Neutral delegates`); глоссарий § 9-ter |
| Такты | три такта на одной позе, печатный порядок: ГОЛОСА (Красные → «Марс вперёд») → ПОДДЕРЖКА (Красные → «Марс вперёд») → ПЕРЕСЧЁТ → МОНЕТА; полная область и пустой запас ЧИТАЮТСЯ на плашке спокойным регистром, кубы не летят |
| Пересчёт | проход по столу: каждый нейтрал в игре отмечается по очереди (голоса слотов в порядке стола, затем места шести плашек), счётчик кикера растёт тик за тиком (задача на тик, `RALLY_COUNT_TICK_MS = 120` — 14 за ≈ 1.7 с), затем ОДНА монета «+N» рождается у счётчика и летит на ряд M€ |
| Маркер победителя | двигается НА ПОСАДКЕ куба, который его сдвинул (холд `winnerShown`), композер называет это заранее |
| Соперник | Парламент открыт — кубы прилетают физически (пул → лента / плашка) по записи; не открыт — лента и обзор хода; своих окон нет |
| Выплата | синхронно в `bespokePlay`, без `defer` — ответ несёт запись |

## 1. Правила чтения (каждое закреплено спеком карты)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Требование — Красные у власти или 2 своих делегата на их резолюции; выданный картой эффект дорогой не считается | спек § rule 1 |
| 2 | Получатели голосов — резолюции Красных и «Марс вперёд» НА ГОЛОСОВАНИИ (`slotOf`); Красные правят принятой картой → их резолюции нет → **названный ноль**, не пропуск | `rallyPlan` → `missing`; спек § rule 2 |
| 3 | Нейтральный голос: лидера не меняет (пока на карте куб игрока), ПОБЕДИТЕЛЯ ГОЛОСОВАНИЯ — может (больше голосов; ничья → слот ближе к правительству); доступ к партии не меняется | проекция на копии `Parliament.projection()`; спек § rule 3 |
| 4 | По 1 нейтралу в области обеих партий — всегда; область ≤ 3 → «+0 · область заполнена» | `supportRoomOf`; спек § rule 4 |
| 5 | Печатный порядок, запас судится по ходу: резолюция Красных → резолюция «Марс вперёд» → область Красных → область «Марс вперёд»; пустой запас режет остальных («нейтральных не осталось») | `rallyPlan` ведёт запас вручную; спек § rule 5 (запас 3 / 2 / 1 / 0) |
| 6 | M€ = нейтралов В ИГРЕ ПОСЛЕ размещения = `14 − neutralSupply()` (голоса трёх слотов + шесть областей), ≤ 14 | спек § rule 6 |
| 7 | Один ответ, без вопроса — один POST | спек § rule 7 |
| 8 | Делегаты карты нейтральные: задание «отправить N делегатов» не считает, доступа не дают, Карьеру не двигают; кубы MarsBot — не нейтральные | спек § rule 8 |
| 9 | Журнал — корень розыгрыша: строка на каждый голос, строки поддержки (ключи фазы, партия-подлежащее), M€ с основанием | спек § rule 9 |
| 10 | Save / load — реестр Парламента; запись `lastRally` не сериализуется | спек § rule 10 |

## 2. Сервер — общий шаг `RallyNeutralDelegates` (класс, не карта)

```ts
// src/server/parliament/RallyNeutralDelegates.ts
rallyPlan(parliament, parties, {perResolution: 1, perArea: 1}): NeutralRallyModel   // ЧИСТАЯ
applyRally(player, parliament, plan, {kind: 'card', card}): ParliamentRallyRecord      // по плану, теми же писателями
```

- **План** по печатному порядку: для каждой партии её слот → копия стола (`Parliament.projection()` — та же копия, что у
  `ParliamentModel.projectVote`), голос `'NEUTRAL'` на копию, `copy.winner()` → `{votesBefore, votesAfter, winningBefore,
  winningAfter, tieNote?}`; k-й вердикт стоит на k−1 предыдущих. Партия без слота → `missing`. Затем области:
  `supportRoomOf(current, supply, printed)` — та же арифметика, что `popularSupportRoom` (вынесена в
  `ParliamentTypes.ts`), с запасом, уже потраченным голосами плана (единственное место, где ведётся вручную; спек
  «план == факт при коротком запасе»). Итог — `supply {before, after}`, `inUse {before, after}`, `megacredits = inUse.after`.
- **Исполнение**: `addNeutralVote(slot)` (undefined → `logIllegalState`, куб записан как срезанный), лог
  `'${0} adds 1 neutral delegate to ${1}'`, событие **`neutral-delegates-placed`** (`impact.delegates` с `neutral: true` —
  чип журнала — тёмная фигура); области — через **`payPopularSupport`** (вынесено из `PlaceDelegatesOnResolution.paySupport`:
  ОДИН писатель поддержки карт — TR03 и TR31; `recordPopularSupportGained` + лог фазы с партией-подлежащим, названный
  пропуск по `SUPPORT_LIMIT_REASON`); срезанный голос — `recordSkippedEffect` с меткой `NEUTRAL_VOTE_LABEL`.
- **M€ — у карты**: `stock.add(MEGACREDITS, plan.megacredits, {from: {card}})` + строка с основанием
  `'${0} gains ${1} M€ — ${2} neutral delegate(s) in use'`.
- **Превью == исполнение**: `cardPlayPreview` и `bespokePlay` зовут `rallyPlan` в один момент (промта между ними нет);
  чипы `rallyEffects` (нейтралы «на резолюции» · нейтралы «в Народную поддержку» · M€), SHOW-шаг `rallyStep` →
  `{kind: 'neutralRally', rally}`. Гард `consolePlayPreviewCoverage` классифицирует `neutralRally` как follow-up.

## 3. Запись исхода — `ParliamentModel.lastRally` (закон TR04 / TR24)

`{seq, player, card, winnerBefore, votes: [{instance, resolution, party, seq, votes, winnerAfter, tieNote?}], missing,
votesCut, support: [{party, current, gained, resulting, printed, limit?}], counted: {votes: [{instance, seqs}], support:
[{party, count}]}, inUse, megacredits, generation}` — `seq` от `gameAge` (монотонна через рестарт), **не сериализуется**
(перезагрузка теряет анимацию, не правило), ОДИН писатель — `applyRally`. `counted` — ПОЛНЫЙ список того, что пересчёт
отметит: сцена читает запись, а не стол (стол к тому моменту ушёл вперёд). `winnerAfter` каждого голоса — чтобы маркер
переехал на касании именно того куба, который его сдвинул.

## 4. Клиент — исход, хостимый рукой (`neutralRally.ts`, брат `agendaWalk.ts`)

Пять ступеней TR04 §4, ОДНА функция на ступень:

1. **ОБЕЩАНИЕ** (`promiseNeutralRally`, на A в `onPlayCardConfirmNative`): превью несёт шаг `neutralRally` и розыгрыш идёт из
   спуска руки → рука ДОЛЖНА шаг (`owed-step`). Обещание несёт `known` — цену карты (`actionKnownRailMoves`), чтобы посев
   рельса отличил M€ пересчёта от цены в одном ответе.
2. **ДЕТЕКТ + ПОСЕВ** (`seedNeutralRallyHolds`, в apply-блоке `gameTransport.seedRewardHolds` и `App.update`): запись
   `lastRally` зрителя с выросшим `seq` → хост (`hand` / `parliament` / никто) → холды: новые кубы лент скрыты
   (`parliamentHolds.hiddenCubes`), плашки на ПРЕЖНИХ местах (`supportIncoming` — свой холд, не холд заседания), пул на
   прежнем числе (`poolHeld`, убывает на ОТРЫВЕ), **маркер победителя где стоял** (`winnerShown`, читает
   `parliamentVoteView.winningShownOf`), ряд M€ — `seedRailReward('neutral-rally', {cause: [+N M€], known: цена})`.
   Reduced motion — ничего.
3. **ВХОД** — `ConsoleShell.enterHostedParliamentStep(kind)` (обобщённый `enterAgendaWalkStep`): рука → `committed`, кадр
   `{kind: 'parliament', stage: NEUTRAL_RALLY_STEP_STAGE, phase: 'executing'}`, RELEASE как у TR03 / TR04.
4. **ПОЗА `rally`** (`ParliamentStage` + `'rally'`; секция: `openRallyFlow` по immediate-watcher'у `rallyOwedSeq`,
   объявленному ДО `frameCrumb`): область голосования и плашки — объекты (в полной силе), Карьера и блоки правительства
   отступают (`.con-parl--rally`, только opacity); лента — кикер «НЕЙТРАЛЬНЫЕ ДЕЛЕГАТЫ» · чип нейтрального куба · чип
   резолюции на каждую посадку · чип партии на каждую прочитанную область (с названным нулём спокойным регистром) ·
   счётчик «в игре · k» (тикает на месте — ключ строки от тиков не меняется); d-pad ничего не двигает, A / B = `none`.
   Такты — `neutralRallyDirector.runNeutralRally(record, stage)` (DOM-половина — колбэки секции; порядок и ожидания —
   у директора): **ГОЛОСА** — `flyCube('neutral', пул → [data-instance] [data-seq])`, пул убывает на отрыве, на касании
   куб показан, счётчик голосов тикает, маркер победителя переезжает, если `winnerAfter` этой посадки другой;
   **ПОДДЕРЖКА** — куб из пула в `plaquePlaceSelector(party, current + n + 1)`; `gained = 0` — плашка читает названный
   ноль через `pick` (`rallySupportReading`: «Область поддержки заполнена» / «Нейтральных делегатов не осталось»), вдох
   `SUPPORT_CUBE_STAGGER_MS`; **ПЕРЕСЧЁТ** — `rallyCountOrder(record)` (ленты по слотам, затем места плашек), каждая
   отметка — класс `--counted` на кубе / месте (один флип класса: импульс + кольцо до конца чтения) и тик счётчика
   (задача на тик через `scheduleParliamentBeat`); **МОНЕТА** — `flyRailReward('neutral-rally', () => rect счётчика)`,
   ряд M€ тикает на касании; **ЧТЕНИЕ** `RALLY_READ_MS = 520` → `flow-complete('rally')`.
5. **КОНЕЦ** — `endHandWithHostedStep`: рука и Парламент внутри уходят одной поверхностью; `concludeWorkspaceFlow('hand')`
   читает **`hostedStepOwedTo('hand')` / `hostedStepLiveIn('hand')`** (`hostedParliamentStep.ts` — ОДНА пара функций по
   виду для ходьбы и митинга; `hostedStepToEnter()` — ходьба первой; `dropHostedStepPromises()`).

Холд — `parliament-neutral-rally` с потолком `neutralRallyHoldMs(record)`; деград — `data-parl-rally-degraded` на корне
(первая неизмеримая точка названа, кубы сели на месте); отказ сервера — `failed` героя, обещания сняты; reload посреди
позы — mount не играет (детект по `seq` требует предыдущего вида), стол показывает итог; размонтирование секции —
`releaseNeutralRallyHolds('unmount')` (рельс тикает честно поздно). Хост `parliament` (стол открыт, спуска руки нет):
холды посеяны, но обещание с `known` не делалось → ряд M€ не держится (`mismatch` названа), позы у standalone-стола нет —
кубы появляются с видом (§8).

## 5. Композер — всё сказано ДО нажатия (`ConsolePlayCardConfirm.rallyRows`)

Строки шага, по одной на объект (шесть частей в одну строку fhd не вмещает — К-5): «Делегаты — нейтральные делегаты в
Парламенте» · «Улавливание тепла · 3 → 4 · Принимается — ничья в пользу слота ближе к правительству» (словарь победителя
композера — существующие ключи, глоссарий §1: РЕЗОЛЮЦИЯ «принимается») · «Архитектурная премия · 3 → 4 · Всё ещё не
принимается» · «Красные · 1 → 2 из 3» · «Марс вперёд · +0 · область заполнена» · «В игре 11 → 14»; партия без резолюции
— «Красные — резолюции на голосовании нет»; срезанный голос — «… · +0 · нейтральных не осталось». Чипы: «+2 [нейтрал] ·
на резолюции», «+1 [нейтрал] · в Народную поддержку», «+14 M€». `heroRewardEffectsOf` обобщён в «иконки, которые
доставляет шаг» (`agendaWalk` → tr / cards / agenda / influence, `neutralRally` → megacredits / neutral-delegate) —
посадочная сцена M€ не летит.

## 6. Соперник (`parliamentRivalVotes.ts`)

Запись `lastRally` ЧУЖОГО игрока с выросшим `seq` (`detectRivalRally`, `rallySeenSeq`) → в том же посеве: голоса
`{kind: 'vote', owner: 'neutral', source: 'pool'}` (пул → лента, куб скрыт до касания), места `{kind: 'support', party,
place}` (пул → плашка; плашка не рисует куб до касания — `rivalSupportIncoming`, пул держит — `rivalPoolHeld`). Без
пересчёта и монеты (счёт чужой). Нейтральные кубы заседания по-прежнему заседания: в очередь попадает только ЗАПИСЬ.
Нотификация соперника — корень розыгрыша с чипами «[нейтрал] +4 · +14 M€» и CTA **«Открыть Парламент»** (PL-025 закрыта
классом: `parliamentOutcomeIn(chain)` в `notificationModel` для событий `delegates-placed` / `neutral-delegates-placed` /
`popular-support-*` / `agenda-advanced` не от заседания; консольная карточка печатает подпись действия по `cta`, а не
«Журнал» — `ConsoleNotificationCard.detailLabel`, оболочка на hold-X открывает Парламент).

## 7. Что следующая карта «добавьте нейтрального делегата …» получает даром / что требует руки

| Даром | Требует руки |
| --- | --- |
| `rallyPlan` / `applyRally` с любыми `parties` и `{perResolution, perArea}`; запись `lastRally`; событие и чип; превью `rallyEffects` / `rallyStep`; поза `rally` с тактами по записи; холды; соперник; нотификация с CTA | карта, которая ставит нейтрала на ВЫБРАННУЮ резолюцию (промт) — это дверь, не исход (форма TR03 с `owner: 'NEUTRAL'`); нейтрал на ПРИНЯТУЮ карту (у `applyRally` только слоты голосования); пересчёт с другим основанием (не «в игре») — `counted` строится из стола после `applyRally` |

## 8. Что не сделано / гэпы (явно)

- **Хост `parliament`** (карта сыграна при открытом столе соперника/своём standalone-столе без спуска руки): холды сеются,
  но позу играет только секция внутри руки (`rallyOwedSeq` читает `embedded`); standalone-ярус записи не играет — кубы
  появляются с видом, холды отпускаются на размонтировании. У ходьбы TR04 ярус играет сам; у митинга — следующая карта.
- **B0 с клиентом HEAD не снят**: клиентский реестр карт собирается при сборке — старый бандл не знает карту и не рисует
  её в руке; наблюдать «как есть» можно только со старым директором, которого у митинга не было.
- Reduced motion, перезагрузка посреди позы, чужой ход — по юнитам и коду, глазами не снято.
