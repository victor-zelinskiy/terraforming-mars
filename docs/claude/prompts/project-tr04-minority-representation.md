# Промт исполнителю · TR04 Minority Representation («Представительство меньшинств») — восьмая карта проектов Turmoil Redux

Выдан 2026-09-30. Инфраструктура набора стоит (TR09, TR08, TR66, TR02, TR01, TR05, TR03 сданы) — **ничего из неё не
повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`,
правила карт — `.claude/rules/game-logic.md`, парламент — `.claude/rules/console-ui.md` § THE PARLIAMENT SITTING (законы
3, 5, 8, 11, 13, 14, 17, 18, 22) и `docs/claude/parliament-glossary.md`. **Обязательное чтение до кода:**
`docs/TURMOIL_REDUX_POLITICAL_DONATION.md` целиком (хостинг Парламента в зоне руки — эта карта его второй потребитель,
но БЕЗ двери), `docs/claude/prompts/parliament-chairman-quest.md` §2–§4 (единственный сегодня flow «шаг Повестки посреди
хода» — ближайший брат), `docs/claude/console/workspace-band.md` § EMBEDDED OUTCOMES, память
`console-followup-door-sequencing` и `console-door-watcher-misses-mount-and-refresh`.

**Серверная часть карты мала (два шага по треку). Главное в задаче — ПОДАЧА: бесшовный путь «рука → розыгрыш → Парламент
внутри того же flow → маркер идёт по треку ШАГ ЗА ШАГОМ и на КАЖДОМ шаге получает награду → поле» одним flow, и то, что
ходьба по треку становится ОДНИМ правилом консоли (заседание, задание председателя и карта зовут одну и ту же фразу).**
Оценивается именно это.

| Впервые | Что это | Ближайший образец (уже в коде) |
| --- | --- | --- |
| **Карта, которая ДВИГАЕТ МАРКЕР на N шагов** — третий двигатель трека | сегодня маркер двигают ровно два пути и ровно на один шаг: победитель голосования (`ParliamentPhase.stepAgenda`, `:344–366`) и задание председателя (`ChairmanSeat.applyQuest` / `applyBotQuest`); `ChairmanSeat.advanceAgenda` (`src/server/parliament/quests/ChairmanSeat.ts:53–89`) шагает один раз и пишет ОДНУ запись `lastAdvance` | `Parliament.advanceAgenda` (`Parliament.ts:526–535`) — один шаг, бонус шага по `AGENDA_TRACK` (`src/common/parliament/ParliamentTypes.ts:79–116`) |
| **ХОДЬБА ПО ТРЕКУ как правило консоли** (multi-step, награда на каждом шаге, одна фраза для трёх двигателей) | сегодня `ConsoleParliamentAgenda.playAgendaGlide` (`:231–304`) — один глайд from→to без остановок; слот бонуса `parliamentRewardState.agendaBonus` (`parliamentRewardBeat.ts:98`) и холд `AgendaAwaits` (`parliamentDisplayHolds.ts:36`) держат ОДИН шаг; два директора (`sittingDirector.beatAgenda :411–439`, `chairmanQuestDirector.beatAgenda :247–309`) реализуют один и тот же такт дважды | пошаговый глайд по клеткам с импульсом на каждой — `runColonyTrackGlide` (`colonyTradeDirector.ts:247`, `onCellPassed`) и `trackWavePlan` (`colonyTradeModel.ts:436`); сама фраза маркера — `runHydroMarkerGlide` (`hydroMarkerDirector.ts:62`: charge → lift → glide → arrive → lock → release) |
| **Розыгрыш карты входит в Парламент как ИСХОД, не как дверь** — первый show-step, хостимый рукой | TR03 хостит Парламент в зоне руки ради РЕШЕНИЯ (выбор резолюции); здесь решения нет — Парламент показывает РЕЗУЛЬТАТ уже сделанного хода | show-step по записи сервера без вопроса: `openColoniesShowStep` (`parliamentWorldBeat.ts:302–333`, `anchor: always`, `serves: []`); хост шага — `workspaceHostForStep()` (`ConsoleShell.vue:17242–17275`); уход одной поверхностью — `endHandWithHostedStep` + `handLeaveHook` (`:18670–18726`) |
| **Новый вид требования — ВЛИЯНИЕ с `max`** («не больше 1 влияния») | требования по влиянию нет нигде (`RequirementType` знает только два Redux-вида: `DELEGATES_ON_RESOLUTIONS`, `TAGS_OF_ONE_TYPE`) | тропа TR02 `e68e8db190` (8 точек), класс `DelegatesOnResolutionsRequirement`; событие с `max` на не-глобальном счётчике — `AntiTrustCrackdown.ts` (`{corruption: 0, max}`); `InequalityRequirement.satisfies` (`:16–22`) уже умеет `max` |
| **Новый значок «шаг трека» на лице карты** (звезда в квадрате ×2, как на скане) | `CardRenderItemType` знает `INFLUENCE` и `CHAIRMAN`, шага трека нет | `VOTE_WINNER: misc/vote-winner.svg` (`premiumCardIcons.ts:257`) — свой svg-ассет одного значка |
| **Переименование понятия «Повестка» в RU** (решение владельца, отдельный коммит 0) | «Повестка» читается как повестка из военкомата; ~20 RU-строк, ключ `console.json:911 "Agenda"` делит с ресурсом Pathfinders | глоссарий §4 + гард `tests/console/parliamentGlossary.spec.ts:46` |

### Решения владельца (2026-09-30)
1. **Термин трека в RU** — по умолчанию **«Карьера»** («трек Карьеры», «маркер Карьеры», «шаг Карьеры», «Старт карьеры»,
   стадия «КАРЬЕРА»). Трек по правилам — «advancement of their personal goals in Mars parliament» (R p.8): личное
   продвижение игрока в Парламенте, из которого растёт влияние. Отвергнуто: «Авторитет» / «Репутация» — синонимы
   Влияния, два абстрактных числа рядом («Авторитет 3 · Влияние 2») путают; «Курс», «Программа» — «шаг Курса» /
   «шаг Программы» не читаются. **Подтвердить у владельца ДО коммита 0** (он один; карта на него опирается — стадия
   крошки и кикеры). Английский ключ остаётся `Agenda` — меняются только RU-значения и новые ключи.
2. **Хореография = ИСХОД, а не дверь.** У карты нет выбора → в композере обычное «Разыграть карту» = единственный POST.
   Ответ несёт запись ходьбы; карта ложится в «Разыграно» (ритуал обычного розыгрыша), из ТОЙ ЖЕ зоны раскрывается
   Парламент в позе ХОДЬБЫ, маркер идёт два шага с наградой на каждом, чтение, уход одной поверхностью на поле.
   Второго A в Парламенте НЕТ (нечего подтверждать — превью композера уже показало `1 → 3 · +1 влияние · +1 РТ`).
3. **Ходьба — ОДНА функция на сервере и ОДИН директор на клиенте**; заседание и задание председателя становятся её
   вызовами с N = 1 **без изменения таймингов** (e2e `console-parliament-sitting-v4.spec.ts:366–367` держит такт
   ПОВЕСТКИ в окне 700–1450 мс — он должен остаться зелёным без правки чисел).

Принято по умолчанию (подтвердить в отчёте, не блокер): RU-имя карты **«Представительство меньшинств»**; РТ шага, взятого
картой, в разбивке счёта остаётся сегментом трека (`sourceName: 'Agenda track'`), а ПРИЧИНА в журнале / нотификации —
карта; задание председателя вида «получите N РТ» ЗАСЧИТЫВАЕТ РТ шага, взятого картой (см. правило 6).

---

## 0. Рабочее дерево
`git status` на момент выдачи: соседняя сессия держит НЕЗАКОММИЧЕННУЮ работу над плашками партий и заседанием —
`.claude/rules/console-ui.md`, `docs/TURMOIL_REDUX_POLITICAL_DONATION.md`, `ConsoleParliamentParties.vue`,
`ConsolePartyPlaque.vue`, `ConsoleSupportPlaces.vue`, `parliamentDisplayHolds.ts`, `parliamentResultsModel.ts`,
`sittingDirector.ts`, `console_party_plaque.less`, `PoliticalDonation.spec.ts`, `ConsolePartyPlaque.spec.ts`,
`ParliamentPhase.spec.ts`; untracked `tests/e2e/zz-tmp-ruler-stock.spec.ts`. **Три из них — твои файлы задачи**
(`parliamentDisplayHolds.ts`, `sittingDirector.ts`, `console-ui.md`): дождаться коммита соседа (или написать ему —
ListAgents / SendMessage), потом править; в общих файлах — только своя строка/ветка; `git add` только по своим путям;
свои новые файлы коммитить сразу (сосед свипает untracked). `genfiles/**` не править руками. Память:
`concurrent-session-edits-same-files`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR04.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR04.png` (лежит) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR04.png" TR04` → `npm run make:cards`.

- **Minority Representation** · `cardNumber: 'TR04'` · стоимость **6** · тип **EVENT** (жёлтый круг со стрелкой
  вниз в правом верхнем углу — значок события, НЕ метка; `card.tags` пуст) · **меток нет**.
- **Требование** — оранжевая плашка у цены: **«max 1 [значок влияния]»** → `requirements: {influence: 1, max}`.
- **ПО нет.**
- **Графика** (один ряд): **два квадрата со звездой** = «2 шага трека» (по языку значков набора КВАДРАТ = ресурс/единица;
  звезда в квадрате — печатная единица «шаг Agenda», см. память `parliament-quest-icon-language`).
- **Текст:** *(Requires that you have no more than 1 Influence. Advance your Agenda marker 2 steps. (And collect
  bonuses from each step.)*
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется, комментарий в манифесте.
- **Лор** EN: *«You mean to tell me that a shed out in the dunes got the same rep as our whole city?»* →
  `assets/text/lore_texts.json` ключ `"TR04"` (между `"TR03"` и `"TR05"`); RU в `src/locales/ru/lore_texts.json` под
  ключом = английский текст: **«Хотите сказать, что сарай в дюнах представлен так же, как весь наш город?»** («rep» =
  representation — перекличка с именем карты; гард точки в конце).

### Правила чтения (каждое — закрепить спеком)
1. **«No more than 1 Influence» = ПОЛНОЕ влияние игрока** — `game.politics.influence(player)` (уровень трека +
   `influenceBonusOf` + `getInfluenceBonus` карт табло, `Parliament.influence :488–500`), не позиция маркера. Следствие:
   при выполненном требовании позиция ≤ 2 (шаг 3 даёт уровень 2), и два шага ложатся ТОЛЬКО на шаги 1–4 = влияние + РТ
   в каком-то порядке (0→1,2 · 1→2,3 · 2→3,4). Шаг «карта» и конец трека при этом требовании недостижимы — но
   ОБЩАЯ ходьба обязана их уметь (спек с принудительной позицией).
2. **«Advance 2 steps» = два ПОСЛЕДОВАТЕЛЬНЫХ шага, каждый со своим бонусом** («collect bonuses from each step») —
   не «прыжок на +2 с бонусом конечного шага». Шаг влияния платит ничего немедленно (влияние — производная позиции),
   шаг РТ — `increaseTerraformRating(1)`, шаг карты — `drawCard(1, {source: {type: 'agenda'}})`; порядок = порядок шагов.
3. **Конец трека режет честно**: с позиции 11 карта даёт один шаг, с 12 — ноль; срез НАЗВАН (существующая строка
   `'${0} is already at the end of the Agenda track'` — один раз, не на каждый недостающий шаг) и виден в превью ДО
   розыгрыша («1 из 2 · конец трека»); карта играется (событие состоялось, оплата взята). Ноль шагов при 12 — карта
   неиграбельна? **НЕТ**: требование по влиянию уже запрещает (на 12 влияние 5). Спек: 11 → 12 один шаг + строка.
4. **Маркер, которого нет (позиция 0)** — первый шаг ставит куб на шаг 1 (R p.8) — так уже делает `advanceAgenda`;
   с 0 карта даёт 0→1,2: влияние 1, затем РТ.
5. **MarsBot карту не играет** (колода бота — метки); ходьба бота (победитель голосования, задание) — N = 1 как была,
   «карта вместо 1 M€» (`ChairmanSeat.ts:78–81`) остаётся.
6. **РТ шага, взятого картой, — обычный РТ в фазе действий**: стреляет `ParliamentHandler.onTerraformRatingGained`
   (`:207–219`: эффект Зелёных +2 M€, пассив принятой, `QuestTracker.report({kind:'tr'})`). `QuestTracker.eligible`
   (`:64–94`) отказывает корню `political-phase` и стеку `resolution`, но НЕ розыгрышу карты → задание «получите N РТ»
   продвигается. Это по правилам (R p.9: «only from your own actions») — закрепить спеком, не «чинить».
7. **Задание председателя, закрытое этим РТ, встаёт ПОСЛЕ ходьбы** (гейт `BACK_OF_THE_LINE`, `ChairmanSeat.ts:111`) —
   его плашка не смеет открыться поверх идущего маркера (admission `followUp`, B5).
8. **Влияние читается на КАЖДОМ шаге по-новому**: после 1→3 у игрока влияние 2 — прогнозы резолюций
   (`winnerForecastYield`, `influenceYieldModel`) пересчитываются обычным обновлением; никакого своего пересчёта.

## 2. Блок A · сервер

### A1 · ОДНА функция ходьбы — «шагает, платит, записывает»
`ChairmanSeat.advanceAgenda(player, parliament, reason)` → **`ChairmanSeat.walkAgenda(player, parliament, steps, cause)`**
(имя на усмотрение; ОДНА функция для трёх двигателей), где `cause = {reason: 'quest' | 'phase' | 'card', card?: CardName}`:
- цикл `steps` раз: `parliament.advanceAgenda(player)` → `undefined` = конец трека: строка «already at the end» ОДИН раз,
  цикл прерван; иначе шаг записан, бонус ОПЛАЧЕН СРАЗУ (до следующего шага — порядок правил 2), лог
  `'${0} advances on the Agenda track to step ${1}'` на КАЖДЫЙ шаг;
- **ОДНА запись** `parliament.lastAdvance` на всю ходьбу (`seq` +1 один раз — клиент играет запись по её номеру):
  `{seq, player, from, to, steps: [{to, bonus?}] (по порядку, ВСЕ пройденные), reason, card?, generation}`.
  `bonus` верхнего уровня оставить = бонус ПОСЛЕДНЕГО шага (форма старых сейвов и текущих потребителей); все
  потребители переводятся на `steps` (A2). Старый сейв без `steps` → `[{to, bonus}]` при десериализации;
- `withSource({kind: 'parliament'})` — ТОЛЬКО для `quest` / `phase` (как сейчас). Для `card` обёртки НЕТ: ходьба идёт
  внутри розыгрыша карты, и источником каждой строки / дельты РТ остаётся КАРТА (журнал показывает чип карты, нотификация
  соперника — «сыграл карту»). `trAttribution: {sourceType: 'other', sourceName: 'Agenda track'}` — оставить для всех
  трёх (сегмент РТ счёта = «трек», как «Тайлы озеленения» названы по правилу, а не по тому, кто положил тайл);
- **событие рекордера `agenda-advanced`** (новый `GameEvent`, `src/common/events/GameEvent.ts` рядом с
  `'chairman-seated'`): `{kind: 'agenda-advanced', player, from, to, steps: [{to, bonus?}], reason}` — ОДНО на ходьбу,
  пишется после последнего шага. Сегодня у продвижения события нет (только текст лога), и соперник о ходьбе узнаёт
  лишь по дельте РТ. Потребители: `journalEventChild` (строка «[куб] Карьера ① → ③ · +1 влияние · +1 РТ»),
  `notificationModel` (причина — источник события: карта / парламент), статистика — ничего не ломать: реплей / посев
  игнорируют (как `card-effect` TR02). Гард `crossPlayerCoverageGuard` — соперник видит «сыграл карту · Карьера 1 → 3 ·
  +1 РТ» с источником-картой.

### A2 · Запись и модель — расширить, не завести вторую
- `SerializedAdvance` (`SerializedParliament.ts:364–372`) и `ParliamentAdvanceModel` (`src/common/models/ParliamentModel.ts:463–476`):
  `reason: 'quest' | 'phase' | 'card'`, `card?: CardName`, `steps: ReadonlyArray<{to: number, bonus?: 'tr' | 'card'}>`.
- `AgendaAdvance` (`Parliament.ts:91`) не трогать (один шаг — примитив); `summary.agenda` заседания — как есть (один шаг);
  `ParliamentPhase.stepAgenda` и `applyQuest` / `applyBotQuest` зовут `walkAgenda(…, 1, {reason})`.
- Потребители `.bonus`, которые обязаны читать `steps`: `detectAgendaBonus` (`parliamentRewardBeat.ts:259`, только phase —
  оставить), `detectChairmanQuestAdvance` (`consoleChairmanQuest.ts:135–151`), `botTurnReviewModel.ts:452–460`
  (`agenda: {from, to, bonus}` шага `chairman` бота — N = 1, оставить), чип ленты `{kind: 'agenda', to, level?, bonus?}`
  (`parliamentBand.ts:72, 280–290, 374–378`), обложка карты-бонуса `ConsoleBoardCardBonusLayer.vue:264`
  (`step: lastAdvance.to` — при ходьбе шаг карты может быть ПРОМЕЖУТОЧНЫМ → брать шаг из записи, см. B1).

### A3 · Вид требования `INFLUENCE` — тропа TR02, 8 точек + ловушка `max`
`RequirementType.INFLUENCE`; дескриптор `influence?: number` (`CardRequirementDescriptor.ts:29–146`, ветка в
`requirementType()`); `CardRequirements.compileOne`; класс `InfluenceRequirement extends InequalityRequirement`
(`getScore = player.game.politics?.influence(player) ?? 0` — через фасад, никогда в `parliament` напрямую; классический
Turmoil отвечает своим `getInfluence`, вне политики — 0); `Card.populateCount` (`Card.ts:493–520`);
`buildCardInformation.requirementBlock` (`:171–289`, образец `max ?` `:260–268`): EN «Requires that you have no more than
1 Influence.» / «Requires 1 Influence.»; причина `requirementReason` (`unplayableReasons.ts:213–285`) — **`type: 'count'`**,
шаблон с `max` обязан содержать маркер `'or less'` / `'or fewer'` (`MAX_REQUIREMENT_MARKERS`,
`unplayableReasonFormat.ts:59`) — иначе компактный счётчик руки нарисует «≥» вместо «≤»: ключ
`'Requires influence ${0} or less'` (min-форма `'Requires ${0} influence'`), `current` = честное влияние сейчас;
`FULLY_RESTATED_REQUIREMENTS` (`:108–121`) — добавить; клиент `REQUIREMENT_RENDER` (`premiumCardViewModel.ts:230–260`):
`{value: d => d.influence ?? d.count ?? 1, iconUrl: 'assets/misc/influence.png'}` — ТОТ ЖЕ бейдж, что печатают формулы
резолюций и `con-parl__inf-icon` трека («влияние» — один символ везде); `COUNT_MESSAGE_LABELS`
(`unplayableReasonFormat.ts:69–80`) → существующий ключ `'Influence'` («Влияние») для ОБОИХ шаблонов. Гарды
`requirementProse`, `cardReasonConsistency`, `premiumCardViewModel.spec` — ворклист.

### A4 · Карта — `src/server/cards/turmoilRedux/MinorityRepresentation.ts`
`Card`, `CardType.EVENT`, `tags: []`, `cost: 6`, `requirements: {influence: 1, max}`, `cardNumber: 'TR04'`.
`export const MINORITY_REPRESENTATION_STEPS = 2` (спек читает константу). Bespoke:
- `bespokePlay`: `ChairmanSeat.walkAgenda(player, parliament, MINORITY_REPRESENTATION_STEPS, {reason: 'card', card: this.name})`
  **синхронно, без `defer`** (ответ на POST обязан нести запись ходьбы — клиент играет её как исход этого розыгрыша);
  без `game.parliament` (классический Turmoil / нет политики) карта в колоду не попадает — `canPlay` там false, `play`
  без падения (guard: `parliament === undefined` → ничего, `recordSkippedEffect` не нужен: карта не сдаётся).
- `canPlay` — требование само (без `bespokeCanPlay`); причина от общего `requirementReason`.
- `cardPlayPreview(player)` — A5.
- `renderData`: `b.agendaStep(2)` — **новый узел DSL** `CardRenderItemType.AGENDA_STEP` (`CardRenderer.ts` рядом с
  `influence() :234`); `description` — текст скана; `infoText` — по аудиту (два блока: требование печатает
  `requirementBlock`, эффект — «Advance your Agenda marker 2 steps and collect the bonus of each step.»).
- `CardName.MINORITY_REPRESENTATION = 'Minority Representation'` в секции `// Turmoil Redux` (`CardName.ts:1072–1079`,
  после `POLITICAL_DONATION`); строка манифеста с комментарием про значок Turmoil.

### A5 · Превью — эффекты СТРУКТУРНО, шаг СТРУКТУРНО
`actionPreviews.playPreview(card, player, effects, steps)` (`actionPreviews.ts:843–861`):
- `effects`: **чип трека** — новый `agendaWalk(player, steps)` в `actionPreviews.ts`: `{kind: 'agenda', from, to, printed: 2,
  walked: N, steps: [{to, kind: 'influence' | 'tr' | 'card', level?}], influence: {current, resulting}}` — считан ЧИСТО
  (`AGENDA_TRACK` + позиция; сервер знает, что до конца трека; клиент не считает); **плюс** `trGain(1)` на каждый шаг РТ
  и `drawGain(1)` на каждый шаг карты — обязательно ОТДЕЛЬНЫМИ чипами: `grantOfEffect` (`effectForecast.ts:211–239`)
  выводит из чипа `'tr'` факт Зелёных «+2 M€ за РТ» (`partyFacts :252–289`), а из чужого чипа — нет.
- `steps`: **`{kind: 'agendaWalk', walk: AgendaWalkModel}`** в `ActionPreviewStep` (`ActionPreviewModel.ts:389–403`, образец
  `delegateGrant`) — не `note`, не `input`: консоль читает шаг СТРУКТУРНО, чтобы (а) назвать ГРЯДУЩУЮ стадию в крошке сразу
  после A (`FOLLOW_UP_STEP_STAGES`, «хвост только растёт»), (б) держать flow должником шага (`owed-step`) до прихода записи,
  (в) показать в композере строку «Карьера — маркер пройдёт 2 шага в Парламенте». `walk` = та же модель, что чип.
- Гарды: `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage` (новый вид шага = не «gap», классификация в
  `playChoiceMode`, `consolePlayCardComposer.ts:146`), `promptMarkerGuard`, `variableAmountPreviewGuard`.
  `effectForecastCoverage` — карта без триггеров, близнец не нужен. `make:cards` — 0 / 0 / 0.

## 3. Блок B · клиент — ОДИН flow от руки до поля, и ОДНА ходьба

**Целевой путь игрока (каждая строка — кадр приёмки §6; термины при «Карьере»):**
```
КАРТЫ В РУКЕ › ПРЕДСТАВИТЕЛЬСТВО МЕНЬШИНСТВ › РОЗЫГРЫШ   композер: цена 6, «Карьера 1 → 3», «+1 влияние (ур. 2)», «+1 РТ»,
        │ A «Разыграть карту»  → ЕДИНСТВЕННЫЙ POST          строка шага «Карьера — маркер пройдёт 2 шага в Парламенте»
        ▼ ритуал: карта ложится в «Разыграно»; крошка уже несёт хвост КАРЬЕРА (циан → янтарь на ответе);
          маркер на треке СТОИТ на 1, РТ на рельсе ДЕРЖИТ старое число (холды посеяны при apply)
КАРТЫ В РУКЕ › ПРЕДСТАВИТЕЛЬСТВО МЕНЬШИНСТВ › КАРЬЕРА      Парламент в зоне руки, поза ХОДЬБЫ: трек — герой, лента —
        │ (ввод поглощён: B/A = none — beat в полёте)          кикер «КАРЬЕРА» · [куб] · чипы наград заполняются по шагам
        ▼ шаг 1: сегмент 1→2 подсвечен → куб поднимается → скользит → садится на ② → узел цветёт →
          чип РТ летит с узла ② на рельс, РТ тикает на касании
        ▼ шаг 2: сегмент 2→3 → куб → садится на ③ → узел цветёт → тик влияния 1 → 2, «ДАЛЕЕ» перецеливается на ④
        ▼ чтение → поверхность уходит ЦЕЛОЙ (рука + Парламент внутри) → поле
```

### B0 · Что уже есть — переиспользовать, не переписывать
- Парламент **host-agnostic и телепортируем**: одна секция (`ConsoleShell.vue:330–352`), `embedded`, зона руки
  `[data-embed-slot="hand-play"]`, слой-стек `.con-hand__stage`; хостинг шага в руке — `enterStagedVote` (`:18538–18584`:
  `pushWorkspaceFrame({kind: 'parliament', stage, phase, serves: [], anchor: {type: 'always'}, nest, sourceCard})`,
  RELEASE приёмной сцены WAAPI-фейдом, композер размонтируется ДО `finishStagedPlayedLanding` — ловушка ② закона 22);
  конец шага + уход одной поверхностью — `endHandWithHostedStep` / `handLeaveHook` (`:18670–18726`).
- Ходьба одного шага: `playAgendaGlide` (`ConsoleParliamentAgenda.vue:231–304`; прокси `.con-parl__flight--agenda` в `<body>`,
  холд `'parliament-agenda-glide'` 5 с, `consoleParliamentUi.agendaSettling`, `cubeHidden` / `agendaLifted`, bloom узла
  `con-parl-node-bloom`), `shown` (`:140–176` — трек «как показан» под холдом `agendaAwaits`: маркер на `from`, влияние
  старого уровня), watcher `lastAdvanceSeq` (`:188–197`), `segmentLit` (`:214–217`, `sittingMotion.agendaSegment`).
- Бонус шага: `launchAgendaBonus` ×2 (sitting `:375–408`, quest `:280–309`): чип РТ `runResourceTransfers({specs: [spec],
  source: {point: центр .con-parl__step-res шага}, arrival: 'auto', onArrive: markAgendaBonusLanded})`; шаг карты —
  `markAgendaBonusLanded()` отпускает запаркованный reveal `agenda` → сцена `agenda-step` снимает обложку с узла шага
  (`consoleBoardCardBonus.ts:46–62`, `ConsoleBoardCardBonusLayer.vue:264, 353–355`, ждёт `agendaSettling`).
- Леджер: `parliamentRewardState.agendaBonus` (один слот), поставщик холда `'parliament-agenda-bonus-owed'`
  (`parliamentRewardBeat.ts:135–141`), `takeAgendaBonus :423`, `markAgendaBonusLanded :440`, `flushAgendaBonus`,
  `parliamentParksReveal :458`, `beginPanelRewardHold([spec])` (рельс держит старый РТ до касания).
- Посев холдов ИЗ ДИФФА ДВУХ VIEW в том же синхронном блоке, что apply (закон 3): `seedChairmanQuestHolds`
  (`consoleChairmanQuest.ts:172–218`) — образец «детект (чистый) + посев только когда есть кому играть».

### B1 · ХОДЬБА ПО ТРЕКУ — один директор (`src/client/console/parliament/agendaWalkDirector.ts`), глобальное правило
**Фраза** (для записи `{player, from, to, steps}`), один прокси-куб на всю ходьбу:
1. ЛИД: сегмент `k-1 → k` подсвечивается (`AGENDA_SEGMENT_MS = 150`, как сейчас — `sittingMotion.agendaSegment` для ОДНОГО
   сегмента, не всей дистанции);
2. ГЛАЙД одного сегмента `runHydroMarkerGlide` (charge только на ПЕРВОМ шаге — дальше куб «в руке»: lift → glide → arrive →
   lock → pulse; `to` шага k = `from` шага k+1 — второй раз источник не мерить);
3. ПОСАДКА на k: холд `agendaAwaits` сдвигается на `{from: k, to}` (тогда `shown` сам показывает куб на k и влияние
   УРОВНЯ k — переписывать `shown` не нужно), узел k цветёт (`pulseAgendaStep`);
4. НАГРАДА шага k — только то, что шаг платит, и только когда куб коснулся (закон 11):
   - **влияние** — тик `[data-parl-influence]` на новый уровень (ключ `:key` уже перерисовывает), чип «ДАЛЕЕ»
     перецеливается на следующий шаг; ничего не летит (влияние никуда не «приходит» — оно ЧИТАЕТСЯ);
   - **РТ** — существующий полёт чипа с узла шага на рельс, счётчик тикает на касании; следующий сегмент — ТОЛЬКО после
     `onArrive` (причина раньше следствия; холд, не таймер);
   - **карта** — существующая сцена `agenda-step`, шаг = ЭТОТ k (не `lastAdvance.to`); следующий сегмент — после снятия
     обложки (сцена сообщает; `agendaSettling` остаётся true до конца ВСЕЙ ходьбы);
   - `BEAT_GAP_MS = 250` между наградой и следующим лидом.
5. Последний шаг: lock пиксель-в-пиксель → `release` (кроссфейд прокси на реальный куб) → холд отпущен → `onLanded`.
**Леджер бонусов — ОЧЕРЕДЬ**: `agendaBonus` → `agendaBonuses: AgendaBonusOwed[]` (по одному на шаг РТ / карты, в порядке
шагов); `beginPanelRewardHold` — на КАЖДЫЙ чип РТ (рельс держит старое число до касания первого, промежуточное — до
второго); `takeAgendaBonus(step)` берёт СВОЙ шаг; поставщик холда — «очередь не пуста»; `flushAgendaBonus(reason)` сливает
всё. `AgendaAwaits` не меняет форму (директор двигает `from`).
**Холд**: один `beginAnimationHold('parliament-agenda-walk', {maxHoldMs: 5000 + 3000·(N−1)})` на всю ходьбу; директор
`skip()` идемпотентен, teardown при размонтировании — конечные позы (куб на `to`, тик, рельс) сразу, холды отпущены
«честно поздно, никогда не потеряно» (`flushAgendaBonus('unmounted')`, свидетель `noteDegraded`-образца на корне).
**Reduced motion**: `reducedMarkerTimings` на каждый шаг (≈ 0.44 с/шаг), награды — конечные позы сразу; порядок событий тот же.
**Бюджет**: ходьба на 2 шага ≤ 4.0 с базовых (первый шаг ≈ 1.2 с, полёт РТ ≈ 0.6 с, второй шаг ≈ 1.0 с, тик, чтение);
N = 1 — БАЙТ-В-БАЙТ прежний такт (лид 150 + глайд ≈ 1.07 с + награда) — `console-parliament-sitting-v4.spec.ts:366–367`
(700 < ПОВЕСТКА < 1450) зелёный без правки чисел.
**Три вызова одной фразы**: `sittingDirector.beatAgenda` (N = 1 из `summary.agenda`), `chairmanQuestDirector.beatAgenda`
(N = 1 из `chairmanQuestFlow.move`), новая поза ходьбы (B3, N = `steps.length` из записи). `playAgendaGlide` становится
`playAgendaWalk(record, {onLanded})` — один метод секции, старое имя не оставлять «для совместимости».
**Watcher `lastAdvanceSeq`** (`:188–197`): играет ходьбу (N шагов) для любой записи, увиденной на экране, включая
`reason: 'card'` СОПЕРНИКА (его куб идёт по треку, без холдов рельса — РТ не зрителя); запись ЗРИТЕЛЯ с `reason: 'card'`
под посеянным холдом играет ХОСТ (B3), watcher — как и сейчас — при `agendaAwaits !== undefined` молчит.

### B2 · Композер розыгрыша
CTA — обычное **«Разыграть карту»** (двери нет; `playDoorOf` (`consolePlayCardComposer.ts:230–240`) шаг `agendaWalk`
НЕ классифицирует как дверь). В «РЕЗУЛЬТАТЕ»: чип трека **«Карьера 1 → 3»** (значок шага ×2 → или чип с `from → to`;
решение показать на кадре) + чипы **«+1 влияние · уровень 2»** и **«+1 РТ»** из `effects` (уже умеет `trGain`), при
срезе — «1 из 2 · конец трека»; строка следующего шага **«Карьера — маркер пройдёт 2 шага в Парламенте»** (имя грядущей
стадии, не догадка). Оплата — как у любой карты (`ConsolePaymentPanel`, только M€ — меток нет). Неиграбельная при
влиянии 2: «✕ Нельзя разыграть · Влияние: не больше 1 · Сейчас: 2» — из общей причины (`type: 'count'` + маркер `≤`).
Payload подтверждения — обычный (без `staged*`).

### B3 · ИСХОД, хостимый рукой — show-step по записи сервера
- **Детект (чистый)** `detectAgendaWalk(before, after)`: `after.parliament.lastAdvance` с `reason: 'card'`, `seq` вырос,
  `player === viewer`, `card === pendingPlayCard / arm.cardName`. **Посев** в том же синхронном блоке, что apply (закон 3),
  ТОЛЬКО когда есть кому играть: (а) кадр руки жив и спуск стоит (`workspaceFrameDescended('hand')`) — хост рука; (б) иначе,
  если Парламент открыт standalone (`workspaceFrameKnown('parliament')`) — играет его секция (watcher / та же поза);
  (в) иначе — **холдов НЕ сеять** («a hold nobody would ever consume would freeze the track for good»): состояние
  просто обновляется, РТ тикает чипом дельты по закону якоря, журнал + нотификация рассказывают. Посев = `agendaAwaits =
  {player, from, to}` + очередь бонусов (`beginPanelRewardHold` на чипы РТ).
- **Вход** (а): после того как ритуал розыгрыша ЗАВЕРШИЛ посадку карты (семейство `followUp`: «обработано» = hero сел,
  ответ применён), в зону руки толкается кадр `{kind: 'parliament', subject: '', stage: AGENDA_WALK_STEP_STAGE ('Agenda' —
  константа рядом с `DELEGATE_GRANT_STEP_STAGE`, `consoleTaskRouter.ts:345`; в `FOLLOW_UP_STEP_STAGES`), phase:
  'committed', serves: [], anchor: {type: 'always'}, nest: workspaceFrameKnown('parliament'), sourceCard}`; кадр руки —
  `committed`. RELEASE → UNFOLD → REVEAL как у TR03: приёмная сцена и прокси карты отпускают НА МЕСТЕ, Парламент
  поднимается из того же rect (`.con-parl--embedded`, opacity only; `v-if`-смена = блик = дефект). **Имя карты в крошке
  не пропадает ни на кадр**, хвост КАРЬЕРА стоит с момента A (циан → янтарь на ответе), второго «титула» у встроенного
  Парламента нет (стадия отдаётся ВВЕРХ).
- **Ввод во время ходьбы = `none`** (beat в полёте поглощает; B «Свернуть» не предлагается — скрытая секция не может
  измерить rect, а «честно поздно» здесь хуже, чем 3 с ожидания). После `onLanded` — чтение (`CARD_EFFECT_READ_MS`-класс,
  по холду) → **flow ЗАВЕРШАЕТСЯ САМ** через ОДНУ охраняемую концовку (`concludeWorkspaceFlow`; удержание — именованная
  причина `live-outcome` пока ходьба идёт; `owed-step` — пока запись ещё не пришла), шаг + рука уходят ОДНОЙ
  поверхностью (`endHandWithHostedStep` → `handLeaveHook`). Возврата в композер после ответа нет (событие сыграно).
- **Отказ сервера** (требование ушло между превью и POST — соперник не мог его изменить, но `STALE_PROMPT` / потерянный
  ответ возможны): существующая батарея транспорта — композер цел, хвост КАРЬЕРА снимается вместе с фазой `configure`.
- **Reload посреди ходьбы**: запись стоит (`seq` тот же) — mount не играет (закон watcher'а), холдов нет → трек показывает
  итог; журнал — правда. Не изобретать «доигрывание».

### B4 · Поза ХОДЬБЫ секции — «стол и чтение» по закону 18
Средняя зона = ЛЕНТА + ТЕЛО. Лента (`parliamentBand.ts` — новая линия рядом с `questLine :280–290`): кикер **«КАРЬЕРА»**
(`$t` ключа трека — B7), `[куб игрока]`, чипы наград ПО ШАГАМ — чип появляется на ПОСАДКЕ своего шага (не пакетом):
«② +1 РТ» → «③ [значок влияния] 2»; закон 14 — влияние в чипе = ГЛИФ + уровень в одном диске, голого порядкового
числа нет. Тело — трек как стоит (ярус Повестки НЕ уходит в `data-parl-recede`, он герой позы; стол не двигается — «обзор
стоит на месте», d-pad ничего не двигает, фокус-стопов нет — ввод поглощён). Ярусы голосования / правительства —
receded, как в заседании на такте ПОВЕСТКИ. Фит: `expectParliamentFits` на fhd / tv4k / Deck — трек внутри зоны руки
(`.con-hand__stage` — слой-стек, не flex-ряд) целиком, без `[console-overflow]`.

### B5 · Соседи ходьбы — что обязано ждать, что обязано молчать
- **Задание председателя**, закрытое РТ шага (правило 7): гейт `BACK_OF_THE_LINE` приходит в ТОМ ЖЕ ответе → его плашка
  анонса (`consoleMandatoryGate.ts:198–203`) ждёт семейством `followUp`, пока ходьба и её чтение не завершились; затем —
  обычный путь «ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО» (второй маркерный такт — N = 1 той же фразы). Проверить на столе, где
  задание — «получите 1 РТ» (спек + руками).
- **Сцена `agenda-step`** (шаг карты): `armBoardCardBonus({kind: 'agenda-step', step})` — шаг из записи ходьбы, обложка
  снимается с ПРОМЕЖУТОЧНОГО узла, если карта — не последний шаг; `agendaTrackOnScreen()` истинен для хостимой секции
  (селектор `.con-parl:not(.con-parl--handed-over) [data-parl-agenda]`) — проверить, что `.con-hand` не помечает её
  handed-over.
- **Нотификации**: своя — «Представительство меньшинств · Карьера 1 → 3 · +1 РТ · влияние 2» (атомарно, после ходьбы —
  память `notification-atomic-delivery`); соперника — «сыграл карту · Карьера 1 → 3 · +1 РТ», причина — карта, кнопка
  «Открыть Парламент» как у `chairman-seated` (`notificationModel.ts:579–583`) — если дёшево, иначе записать гэп.
- **Инфо-панель** (`ConsoleInfoParliament.vue:27–48`) и прогнозы (`influenceYieldModel`, `voteInfoModel`) читают новое
  влияние обычным обновлением — ничего не трогать, только проверить на кадре после ходьбы.

### B6 · Лицо карты и рука — требование должно ЧИТАТЬСЯ
- **Полоса требований** (`PremiumRequirementsBar.vue`, `.pcard-req`): оператор `max` (`PremiumRequirementOperator` —
  шеврон/бар для 'max' уже есть) + бейдж влияния (`assets/misc/influence.png` — ТОТ ЖЕ, что на треке и в формулах
  резолюций) + «1»; хинт (`data-hint`, `.premium-tooltip()`) — строка `requirementBlock` («Требует влияние не выше 1»).
  На витрине `?premiumCardsPlayground` (чип turmoilRedux) рядом с TR02 («делегаты ≥ 1») — две плашки одного семейства,
  различимы оператором и значком, не цветом.
- **Графика**: `AGENDA_STEP` ×2 — **новый ассет** `assets/misc/agenda-step.svg` (звезда в квадратной плитке, как напечатано;
  стиль — `vote-winner.svg`; `filter` на консоли вырезан paint-baseline'ом — цвет в самом svg). Тот же значок — в чипе
  композера «2 шага» и в превью; в ленте Парламента шаг как единица не рисуется (там — награда шага, закон 14).
  Гарды `premiumCardIcons.spec`, `premiumCardViewModel.spec`, `effectExtraction` — ворклист.
- **Рука**: компактный счётчик «Влияние ≤ 1 · сейчас 2» (маркер `≤` из `MAX_REQUIREMENT_MARKERS`), карта заблокирована
  С ПРИЧИНОЙ, никогда не скрыта (инвариант 2/5).

### B7 · Переименование «Повестка» → «Карьера» — КОММИТ 0, отдельно от карты
- Меняются ТОЛЬКО RU-значения; EN-ключи стоят. `src/locales/ru/parliament.json`: `:3` (описание дополнения), `:93–95`
  (три строки лога), `:122` «Трек Повестки» → «Трек Карьеры», `:180` «Старт карьеры», `:328`, `:371–372`, `:377`,
  `:540–541`, `:566` «шаг Карьеры», `:753`, `:852`, `:1013`, `:1153`. `ui.json:784` «Agendas» — классический Political
  Agendas, НЕ трогать.
- **Коллизия `console.json:911 "Agenda": "Повестка"`**: ключ стоит среди имён ресурсов карт и служит именем ресурса
  `CardResource.AGENDA` (Pathfinders, `MindSetMars.ts`) — там «Повестка» верна. Парламентские `$t('Agenda')`
  (`ConsoleParliamentAgenda.vue:9`, `ConsoleInfoParliament.vue:29, 48`, `ConsoleInfoMode.vue:174`, кикеры
  `parliamentBand.ts:284, 290, 378`, `consoleChairmanQuest.ts:55` стадия) переводятся на СВОЙ ключ с естественным
  английским чтением (инвариант 9 — новый, более специфичный ключ; форма — на усмотрение, критерий: EN-игрок читает
  осмысленное слово в кикере и в хвосте крошки); ресурс Pathfinders остаётся «Повестка».
- Глоссарий §4 (`docs/claude/parliament-glossary.md:41–48`) переписать под «Карьеру» + запретить «Повестка» в парламентских
  строках (`BANNED`); гард `tests/console/parliamentGlossary.spec.ts:46` (`'Agenda step': 'шаг Карьеры'`) и проверка,
  что ни одна RU-строка `parliament.json` не содержит «Повестк». e2e: «ПОВЕСТКА» встречается только в комментариях и
  сообщениях `expect` (проверено: `sitting-motion`, `sitting-reward`, `sitting-v2(-remote)`, `sitting-v3/v4`, `zone-v5`) —
  селекторов нет, `e2eLiveness` не заденет; комментарии можно оставить.
- Документы истории (`docs/TURMOIL_REDUX_*`, `docs/claude/parliament-*`) НЕ переписывать — только глоссарий, правила,
  спека §1.5 (`docs/TURMOIL_REDUX_SPEC.md:169` — одна строка «трек Agenda = «Карьера» в RU»), журнал набора.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: `'Influence'` («Влияние»), `'Agenda step'`,
`'Agenda track'`, `'Agenda start'`, `'end of the track'`, `'next reward'`, `'Play card'`, четыре строки лога трека,
`'Requires ${0} delegate(s) on resolutions'` (образец формы). Новые (ожидается ~12):
- `turmoil_redux_cards.json`: `"Minority Representation": "Представительство меньшинств"` (**имя — решение владельца**);
  описание графики: «Требует не больше 1 влияния. Продвиньте маркер Карьеры на 2 шага и получите бонус каждого шага.»
- `card_info.json`: строки требования («Requires that you have no more than 1 Influence.» → «Требует не больше 1
  влияния.»), эффекта; короткий капшен, если гард потребует (бюджет 52 по RU мерить РУКАМИ — модульный словарь гарды не
  видят, чеклист §2).
- причины: `'Requires influence ${0} or less'` («Требует влияние не выше ${0}»), `'Requires ${0} influence'`.
- `parliament.json` (глоссарий!): строка шага композера `'Agenda — the marker walks ${0} steps in the Parliament'`
  («Карьера — маркер пройдёт ${0} шага в Парламенте»; существует только 2 — форма верна для 2–4, отметить в комментарии),
  срез `'${0} of ${1} · end of the track'` («${0} из ${1} · конец трека»), чип превью `'Agenda ${0} → ${1}'` — ЕСТЬ
  (`:372`), строка журнала события `'${0} advances on the Agenda track ${1} → ${2}'` (если событие печатает свою),
  нотификация соперника — по образцу `delegates-placed`.
- `console.json`: ключ кикера/стадии трека (B7); `lore_texts.json` RU — §1.

## 5. Тесты
**`tests/cards/turmoilRedux/MinorityRepresentation.spec.ts`** (стол `testGame(2, {turmoilReduxExpansion: true,
coloniesExtension: true})`): метаданные (событие, 6, без меток, требование `{influence: 1, max}`, TR04); играбельность:
позиция 0 / 1 / 2 — да, 3 — нет с причиной `'Requires influence ${0} or less'` + `current: 2`; бонус влияния от карты
(`addInfluenceBonus`) поднимает влияние и запрещает; розыгрыш с 1 → позиция 3, РТ +1, влияние 2, `lastAdvance` =
`{from: 1, to: 3, steps: [{to: 2, bonus: 'tr'}, {to: 3}], reason: 'card', card}`, `seq` +1 ОДИН раз, три строки лога в
порядке (шаг 2, РТ, шаг 3); с 0 → 0→1,2; с 11 (принудительно, требование обойти через `agenda.set` + `influenceBonus`
нельзя — тестировать `walkAgenda` напрямую) → один шаг + строка «конец» один раз; шаг карты (`walkAgenda` с 6) → добор с
`source.type === 'agenda'`; событие `agenda-advanced` одно; источник дельты РТ — карта, `trAttribution.sourceName` —
трек; Зелёные правят → +2 M€; задание «получите 1 РТ» — выполнено, гейт встал ПОСЛЕ (порядок очереди); превью:
`effects` = [agenda, tr], `steps` = [agendaWalk], модель == итог розыгрыша (паритет), чистота (снимок до/после).
**`tests/parliament/…`**: `walkAgenda` N = 1 == прежний `advanceAgenda` для заседания и задания (записи побайтно, кроме
`steps`); `ParliamentPhase.spec` / `ChairmanSeat.spec` зелёные без правок ожиданий; сериализация: старый сейв без `steps`.
**Требование**: `tests/cards/requirements/InfluenceRequirement.spec.ts` (min/max, классический Turmoil, без политики);
`requirementProse`, `cardReasonConsistency`, `unplayableReasonFormat.spec` (маркер `≤`).
**Гарды чеклиста §3** — ворклист TR04 пуст; `make:cards` 0 / 0 / 0; `crossPlayerCoverageGuard`; `skippedEffectRecord`
не нужен (срез назван строкой лога, не пропуском).
**Клиентские юниты**: `agendaWalkDirector` (план: N шагов, порядок «посадка → награда → следующий лид», N = 1 == прежние
тайминги, reduced), `parliamentRewardBeat` (очередь: два чипа РТ, `takeAgendaBonus(step)`, flush), `detectAgendaWalk`
(зритель / соперник / повтор `seq` / без хоста — не сеять), `parliamentBand` (линия ходьбы, чипы по шагам, кикер ключом),
`consolePlayCardComposer` (шаг `agendaWalk` — не дверь; строка следующего шага), `consoleWorkspaceStack` (`owed-step`
до записи, `live-outcome` во время), `premiumCardViewModel` (INFLUENCE + max), `parliamentGlossary` (коммит 0).
**e2e — ОДИН спек на новую механику** `tests/e2e/console-minority-representation.spec.ts`, фикстура
`minority-representation` (`parliamentFixture`, `stopAt: 'vote'`, имя в `FixtureName`): синий — карта в руке, 10 M€,
`agenda: [1, 3]` (красный стоит на ③ — конечный шаг ЗАНЯТ: куб садится РЯДОМ с чужим, никогда поверх), три резолюции
посажены как у `political-donation` (`generate.ts:1038`). Пробник — `MutationObserver` + `setInterval`, не rAF; правило
трёх утверждений (закон 17: источник виден, адресат виден, движение было); утверждать ПОРЯДОК, не интервалы:
1. композер: чипы «1 → 3», «+1 влияние», «+1 РТ», строка шага; A → РОВНО ОДИН POST `/player/input`, без хвоста;
2. крошка на КАЖДОМ сэмпле содержит корень и имя карты; хвосты только вперёд: РОЗЫГРЫШ → (РАЗЫГРАНО) → КАРЬЕРА;
   `.con-parl` внутри `.con-hand` (телепорт), второго `.con-ws` нет;
3. до первой посадки: куб синего в `[data-agenda-markers="1"]`, `[data-parl-influence]` = 1, РТ на рельсе = старый;
4. порядок: lock(②) < касание чипа РТ (рельс +1) < lock(③) < тик влияния 1 → 2; в `[data-agenda-markers="3"]` ДВА куба;
   лента: чип ② появился до lock(③);
5. сервер по API: карта среди сыгранных событий, M€ −6, `agenda` синего = 3, РТ +1, влияние 2;
6. конец на поле: нет `.con-ws`, нет stranded, 0 `[console-overflow]`, 0 ошибок страницы, `data-*-degraded` не появлялся.
Профили: fhd + tv4k. `--repeat-each=4`, `waitForTimeout` = 0, `shardPlan.json` не править. Регрессия соседей:
`console-parliament-sitting-v4` (окно ПОВЕСТКИ!), `-sitting-motion`, `-sitting-reward`, `-chairman-quest*`,
`console-political-donation`, `console-hand-workspace`, `console-play-landing-geometry`. Свой снапшот
(`npm run e2e:snapshot tr04` + `TM_E2E_ROOT=.e2e-tr04`), `npm run e2e:affected` перед коммитом.

## 6. Визуальная приёмка (fhd + один кадр 4K; свой сервер, своя папка `.e2e-tr04/`)
1. Витрина (`?premiumCardsPlayground`, чип turmoilRedux): лицо — 6, событие, плашка «≤ 1 [влияние]», ряд «★ ★», рядом TR02.
2. Композер: чипы результата и строка шага; та же рука при влиянии 2 — «✕ Нельзя разыграть · Влияние: не больше 1 ·
   Сейчас: 2» + компактный счётчик руки «Влияние ≤ 1 · сейчас 2».
3. Ритуал: карта на стопке «Разыграно», крошка с хвостом КАРЬЕРА (циан → янтарь).
4. Раскадровка перехода (скринкаст CDP): приёмная сцена гаснет на месте, Парламент поднимается из той же зоны —
   блик = дефект.
5. Ходьба: кадр «куб в воздухе над сегментом 1→2», «чип РТ летит с узла ②», «куб садится на ③ рядом с красным»,
   «тик влияния 2 · ДАЛЕЕ ④»; лента с двумя чипами.
6. Уход одной поверхностью → поле; нотификация; журнал (строка ходьбы с чипом карты); инфо-панель «Влияние 2».
7. Заседание после: такт ПОВЕСТКИ (N = 1) выглядит как раньше — один кадр для сравнения с прежним.

## 7. Режим работы
**5 коммитов**, каждый зелёный по юнитам: (0) переименование RU + глоссарий + гард (после подтверждения владельца;
продукт не меняется); (1) сервер — `walkAgenda`, запись `steps`, событие `agenda-advanced`, вид требования INFLUENCE +
спеки; (2) карта + превью + локаль + арт + лор + значок `AGENDA_STEP` + спеки; (3) клиент — директор ходьбы (три вызова),
очередь бонусов, детект/посев, хостинг исхода в руке, поза и лента, композер + юниты; (4) e2e + фикстура + документы.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной
проверкой `npm run make:css` + `npm run build:server` (не голый `tsc`). **Не пушить.**
**Документ карты ЗАВОДИТЬ** — `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md`: контракт «у трека три двигателя и одна
ходьба» (сервер: одна функция, одна запись со `steps`, одно событие; клиент: один директор, очередь бонусов, посев
только при хосте), «розыгрыш как исход, хостимый рукой» (без двери — чем отличается от TR03), вид требования INFLUENCE,
переименование (что и почему). Дополнить: `.claude/rules/console-ui.md` (закон 23 парламента — одним абзацем: THE TRACK
WALK), чеклист набора §4 (строки «карта двигает маркер → `walkAgenda` + `agendaWalk` чип/шаг» и «требование по
влиянию — вид есть»), глоссарий §4, журнал набора (что нового, решения владельца, гэпы). Гочи: `python3` — заглушка
Store; юниты последовательно; `eqeqeq` без исключения для null; новая карта меняет сид-сдачи Redux-столов — поехавший
чужой спек сперва проверить без карты в манифесте и чинить классом; MarsBot × Venus Redux — известное, отложено; чужой
`webpack --watch` переписывает `build/`; `git commit -- <paths>` + хук версии → `git reset -q HEAD -- package.json
package-lock.json` после коммита.

В отчёте: сигнатуры `walkAgenda` и формы записи / события; план директора для N = 1 и N = 2 (тайминги); как посев решает
«есть кому играть»; семь кадров + раскадровки перехода и ходьбы; результат e2e на двух профилях и окно ПОВЕСТКИ v4 до /
после; что напечатали гарды до / после; новые ключи i18n и список переименованных строк; **явно — всё, что не получилось
сделать по этому промту, и почему** (не «гэп на потом» молча).

## 8. Нельзя
Второй A в Парламенте (дверь у карты без решения). Прыжок маркера на +2 без остановки и без награды на каждом шаге.
Вторая функция продвижения на сервере / второй директор глайда на клиенте / второй слот бонуса. `game.defer` для ходьбы
карты. Считать влияние или шаги на клиенте. Читать `lastAdvance.bonus` там, где шагов больше одного. Посеять холд, который
некому отпустить. Детект по тексту заголовка. Титул / кикер у встроенного Парламента (этап отдаётся ВВЕРХ). `v-if`-смена
сцен, пустой кадр, прокси без измеренного адресата, холд на `setTimeout`. Голое порядковое число шага в ленте (закон 14).
Литерал кнопки. `filter` / `text-shadow` как носитель состояния. `compatibility: 'turmoil'`. Переписывать чужие RU-переводы
вне списка B7 и документы истории. Менять числа таймингов заседания. Трогать незакоммиченные файлы соседа, `shardPlan.json`.
Пуш и красные коммиты.
