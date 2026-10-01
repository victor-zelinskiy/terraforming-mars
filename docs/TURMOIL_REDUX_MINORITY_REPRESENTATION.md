# TR04 · Minority Representation («Представительство меньшинств») — у трека три двигателя и одна ходьба

**Статус: СДАНА 2026-10-01** (клиент и e2e — см. §7 «Что не сделано»). Восьмая карта проектов набора Turmoil Redux,
первое СОБЫТИЕ набора. Печатный текст: «Requires that you have no more than 1 Influence. Advance your Agenda marker
2 steps. (And collect bonuses from each step.)» Стоимость 6, меток нет, ПО нет, требование `{influence: 1, max}`.
Лор: «You mean to tell me that a shed out in the dunes got the same rep as our whole city?» → «Хотите сказать, что
сарай в дюнах представлен так же, как весь наш город?»

Вес карты — не в правиле (два шага по треку), а в двух контрактах, которые она заложила первой:

1. **У трека ТРИ двигателя и ОДНА ходьба** — победитель голосования, задание председателя и карта зовут одну и ту
   же функцию на сервере и одну и ту же фразу на клиенте, §2–§3;
2. **Розыгрыш как ИСХОД, хостимый рукой** — Парламент раскрывается в зоне руки без двери и без второго A, §4.

Плюс вид требования **ВЛИЯНИЕ** (§5) и переименование трека в RU (§6).

Промт: `docs/claude/prompts/` (выдан 2026-09-30). Файл карты: `src/server/cards/turmoilRedux/MinorityRepresentation.ts`.
Спеки: `tests/cards/turmoilRedux/MinorityRepresentation.spec.ts`, `tests/parliament/AgendaWalk.spec.ts`,
`tests/cards/requirements/InfluenceRequirement.spec.ts`, `tests/client/console/agendaWalk.spec.ts`,
`tests/client/console/parliamentRewardBeat.spec.ts` § очередь, `tests/console/parliamentBand.spec.ts` § КАРЬЕРА,
e2e `tests/e2e/console-minority-representation.spec.ts` (фикстура `minority-representation`).

---

## 0. Решения владельца (2026-09-30 — не пересматривать)

| Вопрос | Решение |
| --- | --- |
| Термин трека в RU | **«Карьера»** («трек Карьеры», «маркер Карьеры», «шаг Карьеры», «Старт карьеры», стадия «КАРЬЕРА»). Отвергнуто: «Авторитет» / «Репутация» (синонимы Влияния), «Курс» / «Программа» («шаг Курса» не читается). EN-ключи стоят; парламент печатает трек ключом `Agenda track`, ресурс Pathfinders остаётся `Agenda` = «Повестка» |
| Хореография | **ИСХОД, а не дверь**: обычное «Разыграть карту» = единственный POST; ответ несёт запись ходьбы; карта ложится в «Разыграно», из той же зоны раскрывается Парламент в позе ходьбы; второго A нет |
| Ходьба | **одна функция на сервере, один директор на клиенте**; заседание и задание = та же ходьба с N = 1 без изменения таймингов |
| Имя RU | «Представительство меньшинств» (по умолчанию, подтверждено в отчёте) |
| РТ шага в разбивке счёта | сегмент ТРЕКА (`sourceName: 'Agenda track'` → «Карьера»); причина в журнале / нотификации — карта |
| Задание «получите N РТ» | ЗАСЧИТЫВАЕТ РТ шага, взятого картой (правило 6) |

## 1. Правила чтения (каждое закреплено спеком)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | «No more than 1 Influence» = ПОЛНОЕ влияние (`Parliament.influence`: уровень трека + бонусы + хуки табло), не позиция: позиции 0–2 открыты, с 3 закрыто, бонус +1 на позиции 1 закрывает | `InfluenceRequirement`, спек карты § rule 1 |
| 2 | «Advance 2 steps» = два ПОСЛЕДОВАТЕЛЬНЫХ шага, бонус каждого оплачен ДО следующего шага (журнал: шаг 2 · РТ · шаг 3) | `ChairmanSeat.walkAgenda`, спек карты § rule 2 |
| 3 | Конец трека режет честно: с 11 — один шаг + строка «уже в конце трека» ОДИН раз; с 12 — ноль, записи нет; превью НАЗЫВАЕТ срез до нажатия («1 из 2 · конец трека») | `AgendaWalk.spec` § end of the track, превью |
| 4 | Маркер с позиции 0 первым шагом встаёт на 1 (влияние 1), вторым — РТ шага 2 | `AgendaWalk.spec`, спек карты |
| 5 | MarsBot карту не играет; его ходьба (победитель, задание) — N = 1, «карта = 1 M€» | `ChairmanSeat.payStep` |
| 6 | РТ шага — обычный РТ фазы действий: эффект правящих Зелёных (+2 M€), пассив принятой, `QuestTracker.report({kind: 'tr'})` — задание «получите N РТ» продвигается (R p.9: «only from your own actions») | спек карты § rules 6–7 |
| 7 | Задание, закрытое этим РТ, встаёт ПОСЛЕ ходьбы (гейт `BACK_OF_THE_LINE`); его плашка поднимается после того, как маркер сел | спек карты, e2e § B5 |
| 8 | Влияние читается заново на каждом шаге: после 1 → 3 у игрока 2 — прогнозы резолюций пересчитываются обычным обновлением | инфо-панель, `influenceYieldModel` |

## 2. Сервер — ОДНА функция ходьбы

```ts
// src/server/parliament/quests/ChairmanSeat.ts
export type AgendaWalkCause = {reason: 'quest'} | {reason: 'phase'} | {reason: 'card', card: CardName};
export type AgendaWalk = {from: number; to: number; steps: ReadonlyArray<AgendaAdvanceStep>};   // AgendaAdvanceStep = {to, bonus?: 'tr' | 'card'}
ChairmanSeat.walkAgenda(player, parliament, steps: number, cause: AgendaWalkCause): AgendaWalk | undefined
```

- цикл `steps` раз: `parliament.advanceAgenda(player)` → `undefined` = конец трека: строка «already at the end» ОДИН
  раз, цикл прерван; иначе шаг записан, `payStep` — бонус ОПЛАЧЕН СРАЗУ (РТ → `increaseTerraformRating(1,
  {trAttribution: {sourceType: 'other', sourceName: 'Agenda track'}})`; карта → `drawCard(1, {source: {type:
  'agenda'}})`, боту 1 M€), лог `'${0} advances on the Agenda track to step ${1}'` на КАЖДЫЙ шаг;
- **ОДНА запись** `parliament.lastAdvance = {seq (+1 один раз), player, from, to, bonus (ПОСЛЕДНЕГО шага — форма
  старых читателей), steps: [{to, bonus?}], reason, card?, generation}`; старый сейв без `steps` нормализуется на
  загрузке в `[{to, bonus}]` (`Parliament.deserialize`);
- **ОДНО событие** рекордера `agenda-advanced` (`impact.agenda = {from, to, steps, reason}`, `visibility:
  'journal'`) после последнего шага. До TR04 у продвижения события не было — соперник узнавал о нём по дельте РТ;
- `withSource({kind: 'parliament'})` — ТОЛЬКО для `quest` / `phase`. Ходьба карты идёт внутри розыгрыша и держит
  источник-карту: журнал показывает чип карты, нотификация соперника — «сыграл карту»;
- `ParliamentPhase.stepAgenda` → `walkAgenda(…, 1, {reason: 'phase'})` (summary.agenda — один шаг, как был);
  `applyQuest` / `seatPrompt.finish` / `applyBotQuest` → `walkAgenda(…, 1, {reason: 'quest'})`. Записи N = 1 —
  побайтно прежние плюс `steps`.
- **В файле карты нет `defer`**: ответ на POST обязан нести запись ходьбы — клиент играет её как исход ЭТОГО розыгрыша.

Модель: `ParliamentAdvanceModel.steps` (обязательное), `card?`, `reason: 'quest' | 'phase' | 'card'`; потребители
`.bonus` там, где шагов может быть больше одного, переведены на `steps` (обложка карты-бонуса берёт шаг с `bonus:
'card'`, не `lastAdvance.to`).

### Превью — эффекты и шаг СТРУКТУРНО

```ts
// src/server/cards/actionPreviews.ts
agendaWalkModel(player, printed): AgendaWalkModel   // {from, to, printed, walked, steps: [{to, kind, level?}], influence: {current, resulting}} — чисто
agendaWalkEffects(player, walk): ActionEffect[]     // [чип трека (icon 'agenda', walked, from → to, note 'end of the track' при срезе), trGain, drawGain, чип влияния (icon 'influence')] — в порядке шагов
agendaWalkStep(walk): {kind: 'agendaWalk', walk}    // SHOW-шаг превью (ActionPreviewStep)
```
Чип РТ — отдельный: `grantOfEffect` выводит из него факт Зелёных «+2 M€ за РТ»; из чипа трека — нет. Гард
`consolePlayPreviewCoverage` классифицирует `agendaWalk` как hostable follow-up, не «gap».

## 3. Клиент — ОДИН директор ходьбы (`agendaWalkDirector.ts`)

**Фраза** для записи `{player, from, to, steps}` — по одному ЛЕГУ на шаг:
`ЛИД` (сегмент k−1 → k подсвечен, `AGENDA_SEGMENT_MS = 150`) → `ЛЕГ` (общий `runHydroMarkerGlide`: charge ТОЛЬКО на
первом леге — дальше `skipCharge`, куб «в руке»: lift → glide → arrive → lock → pulse) → `ПОСАДКА` (холд
`agendaAwaits` сдвигается на `{from: k}` — `shown` рисует куб на k и влияние уровня k; узел цветёт; лента растёт
чипом шага) → `НАГРАДА` шага k, только то, что шаг платит, и только по касанию (РТ — чип с узла шага на рельс,
счётчик тикает на касании — следующий сегмент ЖДЁТ `onArrive`; карта — парк reveal отпускается; влияние — тик
`[data-parl-influence]` по перерисовке) → `GAP` (`AGENDA_BEAT_GAP_MS = 250`) → следующий лид; после ПОСЛЕДНЕГО лега
— `release` (кроссфейд прокси на реальный куб) → `onLanded` → награда последнего шага у вызывающего.

- **N = 1 — байт-в-байт прежний такт**: лид 150 + общий глайд ≈ 1.07 с, награда с достигнутого шага
  (`console-parliament-sitting-v4.spec.ts:366–367` — окно 700–1450 мс — без правки чисел). `agendaWalkBudgetMs`
  (чистая) — что фраза стоит до наград; `agendaWalkHoldMs` = 5000 + 3000·(N−1).
- **Три вызова одной фразы**: `sittingDirector.beatAgenda` (N = 1 из `summary.agenda`, лид отдан фразе — такт
  стартует в t = 0), `chairmanQuestDirector.beatAgenda` (N = 1 из `chairmanQuestFlow.move`), поза ходьбы секции
  (N = `steps.length`). DOM-половина — у яруса `ConsoleParliamentAgenda.playAgendaWalk` (прокси, ректы рядов,
  скрытые кубы, сдвиг холда, bloom); порядок и ожидания — у директора (`runAgendaWalk`). Беаты — на моушен-часах
  (`parliamentBeat`), таймеров нет (гард `parliamentNoTimers`).
- **Часы фразы — у вызывающего** (`AgendaWalkStage.beat` / `AgendaWalkHooks.beat`): лид и паузы между легами
  идут через переданный планировщик, ожидания лока и посадки остаются реальными. Заседание передаёт
  `scheduleHurriedParliamentBeat` (реестр полётов, тот же класс, что стаггер полёта): «ДОЖАТЬ» посреди лида
  двигает маркер СЕЙЧАС — как раньше это делал `call` мастера, — а взведённый hurry гасит лид сразу; сам глайд
  играет до лока, как всегда. Без планировщика (поза ходьбы секции, ярус) — моушен-часы. Ловушка, оплаченная
  один раз: лид как `delayedCall` вне мастера hurry не резал — +150 мс под «дожать», и `sitting-motion`
  «ДОЖАТЬ» терял ИТОГИ (гонка пробника с тактом итогов на сдвинутой фазе).
- **Геометрия сцены читается на ПЕРВОМ леге, не до лида** (`stageGeometry()` в `playAgendaWalk`): прокси и
  скрытый куб флашатся, ПОКА идёт лид — как раньше мастер вёл лид параллельно с флашем яруса. Первая версия
  ждала `$nextTick` ДО старта фразы и сериализовала флаш секции (`data-sitting-beat`) с лидом. Часы такта
  N = 1 — это ТОЛЬКО лид + фраза общего маркера; всё, что ярус делает сам, обязано идти параллельно.
- **Фраза стартует ВМЕСТЕ с тактом** (`beatAgenda` зовёт ходьбу синхронно при сборке такта, не `call`-ом
  мастера на 0.01): часы лида и часы мастера читают одно время тикера, маркер уходит на том же тике, на
  котором раньше стрелял `call` мастера на 150 мс. **A/B на одной машине** (клиент HEAD подменён в снапшоте,
  `console-parliament-sitting-v4` Г-П1 ×4, 1080): HEAD 1278–1301 мс (ср. 1289) · ходьба с `call` на 0.01 —
  1305–1325 (ср. 1317, +28 мс) · ходьба со стартом вместе с тактом — 1256–1303 (ср. 1272). Окно 700–1450 —
  без правки чисел; волна `sitting-v2` 1080: HEAD 7134 / 6928 мс, ходьба 6902 / 6929 мс. Числа 1380–1470 и
  9011 мс из промежуточных прогонов — нагрузка машины (соседние сборки), не код: мерить такт только A/B.
- **Леджер бонусов — ОЧЕРЕДЬ** (`parliamentRewardBeat.ts`): `agendaBonus` → `agendaBonuses: AgendaBonusOwed[]`,
  `queueAgendaBonuses(...)` (рельс держит по одному пункту на каждый шаг РТ), `takeAgendaBonus(generation |
  undefined, step?)` берёт СВОЙ шаг, `markAgendaBonusLanded(step?)` отпускает ровно его, `flushAgendaBonus` сливает
  всё, поставщик холда — «очередь не пуста», `parliamentParksReveal` — «есть карта в очереди». Заседание и задание
  кладут очередь из одного.
- **Watcher `lastAdvanceSeq`** яруса играет ходьбу на N шагов для любой записи, увиденной на экране (карта СОПЕРНИКА
  — без холдов рельса), и — единственное исключение — запись ЗРИТЕЛЯ с `reason: 'card'` под холдом, посеянным для
  standalone-Парламента (хост `parliament`).

## 4. Розыгрыш как ИСХОД, хостимый рукой (`agendaWalk.ts`)

Отличие от TR03 (дверь): **ничего не выбирается и ничего не паркуется** — A композера = обычный POST.

1. **ОБЕЩАНИЕ** (`promiseAgendaWalk`, на A в `onPlayCardConfirmNative`): превью ветки несёт шаг `agendaWalk` с
   `walked > 0` и розыгрыш идёт из спуска руки (`workspaceFrameDescended('hand')`, стол не открыт) → рука ДОЛЖНА шаг
   (`owed-step`) до прихода записи. Розыгрыш без спуска (standalone-полоса, открытый стол) обещания не даёт —
   случай (в).
2. **ДЕТЕКТ + ПОСЕВ** (`seedAgendaWalkHolds`, в `gameTransport.seedRewardHolds` и `App.update` — тот же синхронный
   блок, что apply): запись `reason: 'card'` зрителя с выросшим `seq` → хост = `agendaWalkHostFor()`: (а) спуск
   руки → `'hand'`; (б) Парламент известен → `'parliament'`; (в) никого → холдов НЕ сеять (состояние обновляется,
   РТ тикает чипом дельты, журнал и нотификация рассказывают). Посев = `agendaAwaits = {player, from, to}` + очередь
   бонусов + **задание председателя, как оно стояло** (`questWalkBefore` — только если ответ его изменил: РТ шага
   двинул прогресс или закрыл его; `questBeforeWalk` строит вид тем же `buildParliamentView`, какой шаг его закрыл —
   не вычисляется) + `agendaWalkFlow.owed = {…record, host}`; reduced motion ничего не держит. Правительство рисует
   задание ОТКРЫТЫМ со старым прогрессом (2/3), пока награды ходьбы не сели; `releaseAgendaWalkQuest()` — на
   `read` (после награды последнего шага), остальные концовки — `releaseAgendaWalkHolds`. Это НЕ `questBefore`
   заседания: тот рисует задание ЗАКРЫТЫМ и читается `enactmentHeld`.
3. **ВХОД** (`ConsoleShell.enterAgendaWalkStep`, на фазе `closing` сцены посадки при `owed.host === 'hand'`): рука →
   `committed`, `pushWorkspaceFrame({kind: 'parliament', stage: AGENDA_WALK_STEP_STAGE ('Agenda track'), phase:
   'executing', serves: [], anchor: {type: 'always'}, nest, sourceCard})`; RELEASE как у TR03 — сцена посадки и
   прокси карты гаснут НА МЕСТЕ WAAPI-фейдом, Парламент поднимается из того же rect своим CSS-входом
   (`.con-parl--embedded`), композер размонтируется после фейда. Фаза `executing` — ввод поглощён на всю ходьбу (A и
   B = `none`), «Свернуть» не предлагается.
4. **ПОЗА ХОДЬБЫ** секции (`ParliamentStage 'walk'`, `openWalkFlow` из immediate-watcher'а `walkOwedSeq`, объявленного
   ДО `frameCrumb` — первое имя поверхности сразу «КАРЬЕРА», не «Обзор»): трек — герой (`.con-parl--walk` гасит
   верхний ярус и ряд партий опасити), лента — кикер «КАРЬЕРА» · [куб] · чипы по ШАГАМ (чип появляется на посадке
   своего шага; влияние — глиф + уровень в одном диске, закон 14), тело — ряд партий; d-pad ничего не двигает.
   Хосту стадия отдаётся ВВЕРХ (`frameCrumb` embedded → только stage) — второго титула нет.
5. **КОНЕЦ**: `onLanded` → награда последнего шага → `read` (`AGENDA_WALK_READ_MS = 520`, беат на моушен-часах) →
   `beat = 'done'` → `flow-complete('walk')` → `ConsoleShell.onParliamentFlowComplete` → `endHandWithHostedStep` →
   одна охраняемая концовка руки; рука и Парламент внутри уходят ОДНОЙ поверхностью (`handLeaveHook`).
   `concludeWorkspaceFlow('hand')`: `owedStep` += `agendaWalkOwedTo('hand')` (обещано и не пришло; пришло и поза не
   открыта), `outcomeLive` += `agendaWalkLiveIn('hand')` (ходьба идёт: `walk` · `read`).
6. **Отказ сервера** — фаза `failed` героя: `dropAgendaWalkPromise()`, композер цел. **Ответ без записи** (конец
   трека взял всё) — `closing` без `owed`: обещание снято, обычный `endPlayCardFlow`. **Reload посреди ходьбы** —
   mount не играет (закон watcher'а), холдов нет, трек показывает итог.

Крошка: `КАРТЫ В РУКЕ › ПРЕДСТАВИТЕЛЬСТВО МЕНЬШИНСТВ › РОЗЫГРЫШ → РАЗЫГРАНО → КАРЬЕРА` — «РАЗЫГРАНО» остаётся словом
общего ритуала посадки (как у TR03), «КАРЬЕРА» встаёт с толчка кадра.

## 5. Вид требования INFLUENCE (тропа TR02, 8 точек)

`RequirementType.INFLUENCE = 'Influence'`; дескриптор `influence?: number` (+ `max`); `CardRequirements.compileOne` →
`InfluenceRequirement extends InequalityRequirement` (`getScore = player.game.politics?.influence(player) ?? 0` —
через фасад: Redux — `Parliament.influence`, классический Turmoil — `getInfluence`, без политики — 0);
`Card.populateCount`; строка правил «Requires that you have no more than N Influence.» / «…at least N Influence.»;
причина `type: 'count'`: max `'Requires influence ${0} or less'` (маркер «or less» → компактный счётчик руки «Влияние
2/≤1»), min `'Requires ${0} influence'`; `FULLY_RESTATED_REQUIREMENTS`; клиент `REQUIREMENT_RENDER` — бейдж
`assets/misc/influence.png` (тот же, что у узла трека и формул резолюций); `COUNT_MESSAGE_LABELS` → «Влияние».

## 6. Переименование (коммит 0)

Только RU-значения; EN-ключи стоят. `parliament.json`: 17 строк («Повестка» → «Карьера» во всех формах; `Agenda
track` → «Карьера», `Agenda start` → «Старт карьеры»). Коллизия `console.json "Agenda": "Повестка"` (ресурс
Pathfinders) — парламент печатает трек ключом `Agenda track` (`ConsoleParliamentAgenda`, `ConsoleInfoParliament`,
`ConsoleInfoMode`, кикеры `parliamentBand`, стадия `consoleChairmanQuest`). Гард `parliamentGlossary.spec`:
канон трёх ключей, BANNED `/повестк/i`, парламентские поверхности не печатают голый ключ `Agenda`. Глоссарий §4.

## 7. Что не сделано / гэпы (явно)

- **Шаг карты ПОСРЕДИ ходьбы** (не последний): обложка снимается с узла своего шага только когда весь трек
  успокоился (`agendaSettling` держится до конца ходьбы, а сцена `agenda-step` ждёт его) — «честно поздно». Сегодня
  недостижимо ни одной картой (у TR04 при выполненном требовании шаги 1–4); при появлении такой карты сцене нужен
  сигнал «маркер сел на k», а не «трек успокоился».
- **Хвост «РАЗЫГРАНО»** на ритуале остался общим со staged-клеткой и TR03 (промт просил «КАРЬЕРА с момента A»);
  e2e закрепляет «первый — РОЗЫГРЫШ, последний — КАРЬЕРА, только эти три».
- **Случай (б)** — розыгрыш при standalone-открытом Парламенте — руками не прогонялся (в консоли рука и Парламент
  не стоят одновременно; путь закреплён юнитом посева и веткой watcher'а).
- Нотификация соперника: пилюли `[agenda] +2` · `[tr] +1` (чип шагов суммируется как любой gain); кнопки «Открыть
  Парламент» как у `chairman-seated` нет — журнальная строка «Карьера 1 → 3 · Влияние 2» стоит в раскрытии карточки.
