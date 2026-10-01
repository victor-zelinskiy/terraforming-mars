# Промт исполнителю · TR13 Political Think Tank («Политический аналитический центр») — двенадцатая карта проектов Turmoil Redux

Выдан 2026-10-01. Инфраструктура набора стоит (TR01–TR09, TR11, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`, правила карт —
`.claude/rules/game-logic.md`. **Обязательное чтение до кода:** `docs/CONSOLE_BLUE_ACTION_PARITY.md` — итерация 26
(«ВЕРДИКТ терминален, говорит ВСЁ и живёт ВНУТРИ», §1–§4 и таблица четырёх дверей `:59–71`), итерация 24 (THE CONCLUSION),
итерация 16 (EMBEDDED OUTCOMES); `docs/claude/console/workspace-band.md` § RESULT HANDOFF (`:805`) и § ПОСАДКА (`:959`);
память `console-verdict-terminal-no-collapse`, `hand-intake-director`, `flight-aims-at-resting-rect`.

**Карта — третья «проверка колоды» в игре (после «Поиска жизни» и «Системы отклонения астероидов») и ПЕРВАЯ, где при
успехе вскрытая карта УХОДИТ В РУКУ, а награда — ресурс запаса, а не ресурс на карте.** Сервер мал. Главное — подача
вердикта: карта честно вскрывается с колоды, вердикт говорит всё, а затем вскрытая карта ФИЗИЧЕСКИ уезжает туда, куда она
ушла: в док руки вместе с +5 M€ на рельс — или в сброс.

| Впервые | Что это | Ближайший образец (уже в коде) |
| --- | --- | --- |
| **Вскрыть ОДНУ карту и ОСТАВИТЬ её при совпадении** | оба существующих вскрытия карту ВСЕГДА сбрасывают (`SearchForLife.ts:98–119`, `AsteroidDeflectionSystem.ts:52–97`); `drawCard({include})` — другая семантика («сбрасывай, пока не найдёшь», High Circles); значение `RevealResult 'kept'` (`src/common/logs/RevealLogMeta.ts:17`) объявлено и не используется | `projectDeck.drawOrThrow` + `actionReveals.recordReveal` (`src/server/cards/actionReveals.ts:22–39`) |
| **Проверка НЕ по метке** | `RevealResultModel.check = {tag: Tag, label}` — метка ОБЯЗАТЕЛЬНА (`src/common/models/RevealResultModel.ts:18–40`); панель вердикта рисует `tagIconUrl(check.tag)` (`ConsoleRevealVerdict.vue`); в превью `tag` уже необязателен (`ActionPreviewModel.ts:159–175`) | — |
| **Награда вердикта — ресурс ЗАПАСА и КАРТА В РУКУ** | вердикт умеет один результат: чип награды + полёт ресурса на карту-источник (`runRevealGainFlight`, `consoleActionRevealMotion.ts:373–422`; такт идёт только если изменился счётчик на карте-источнике). У вскрытой карты нет ни полёта в руку, ни полёта в сброс — она стоит в слоте до «OK» | посадка в док руки — `runHandIntake` (`src/client/console/handDock/handDeliveryDirector.ts:511`); сброс открытой карты — `discardOpenCards` (`cardDiscard/discardOpenCard.ts:52`); чипы на рельс — `runResourceTransfers` |
| **Предикат «у карты есть требование партии»** | хелпера нет — одна инлайн-лямбда в `prelude2/HighCircles.ts:35`; награда Politologist из свода («больше всего карт с требованием партии») не реализована | `requirements: {party}` → `RequirementType.PARTY` (`CardRequirementDescriptor.ts:121–122`) |
| **Значок «любая партия» на лице** | типа рендера нет; TR03 рисует «?» текстовой плашкой `plate('?')` | ассет владельца `C:\Users\zelin\Downloads\TM Turmoil Redux\Assets\Wild Party.png` (фиолетовая пилюля «?»); образец добавления глифа — TR07 `COLONY_TILE`, TR04 `AGENDA_STEP` |

### ⚠ Факт, с которым карта выходит (решение владельца №1)
**Сегодня в партии «Кризис: Возвращение» НЕТ НИ ОДНОЙ карты с требованием партии.** 27 таких карт в репозитории (12
классического Turmoil, 6 Prelude 2, 4 Луны, 5 Pathfinders) в Redux-колоду не попадают: классический манифест несовместим
с Redux (`Game.ts:346–349`), остальным нужен `politics: 'redux'`, которого нет ни у одной (`CardFactorySpec.ts:41–47`); у
одиннадцати сданных карт TR требования партии нет. Требование партии несут карты набора TR14–TR27 и дальше («Requires Mars
First / Unity to be ruling or that you have 2 delegates there») — они ещё не сданы. **До первой из них действие TR13
промахивается всегда.** По умолчанию карта сдаётся сейчас, честно: композер показывает число из сервера «В этой партии
карт с требованием партии: N» и при N = 0 — предупреждение (B1). Альтернатива владельца — придержать карту до первой
карты с требованием партии (самая простая — TR20 Martian Roads). Реализация от выбора не зависит.

### Решения владельца (подтвердить в отчёте, не блокер)
2. RU-имя **«Политический аналитический центр»** (think tank = «аналитический центр», «мозговой центр»; короче — «Мозговой
   центр политики»). ⚠ В репозитории уже есть ДРУГАЯ карта «Think Tank» (Pathfinders, `CardName.ts:807`) — имя ключа
   `POLITICAL_THINK_TANK`, RU-имя не должно совпасть с её переводом (grep).
3. Счётчик «карт с требованием партии в этой партии» считает набор карт ПАРТИИ целиком (колода + сброс + руки + табло) —
   это открытая информация о составе, а не подсказка о скрытой колоде. Число карт, оставшихся именно в колоде, не показывать.

---

## 0. Рабочее дерево
`git status` на момент выдачи ЧИСТ (последние коммиты — TR07 4/4, TR11, «UI rework»). Перед стартом перечитать: соседние
сессии работают в том же клоне. В общих файлах (`CardName.ts`, манифест, словари, `lore_texts.json`, `ConsoleActionComposer.vue`,
`ConsoleCardActions.vue`, журнал) — только своя строка/ветка; `git add` по своим путям, перед коммитом `git status` глазами;
свои новые файлы коммитить сразу; `genfiles/**` руками не править; e2e — из СВОЕГО снапшота (`npm run e2e:snapshot tr13` +
`TM_E2E_ROOT=.e2e-tr13`, 4K — `--workers=1`). Память `concurrent-session-edits-same-files`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR13.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR13.png` (лежит) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR13.png" TR13` → `npm run make:cards`.

- **Political Think Tank** · `cardNumber: 'TR13'` · стоимость **5** · тип **ACTIVE** (синяя) · метка **Марс**.
- **Требования нет** — плашка у цены пуста. **ПО нет.**
- **Действие** (один ряд): `→ [плашка требования с фиолетовой пилюлей «?»]* : [карта]* [5 M€]` — *(Action: Reveal the top
  card of the projects deck. If it has a party requirement, take it into hand and gain 5 M€. Otherwise discard it.)*
  Пилюля «?» в ОРАНЖЕВОЙ ПЛАШКЕ ТРЕБОВАНИЯ = «требование любой партии».
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется (комментарий в манифесте).
- **Лор** EN: *«Which poison would you pick: Losing money in a casino, or betting on political outcomes?»* →
  `assets/text/lore_texts.json` ключ `"TR13"` (после `"TR11"`); RU: **«Какой яд выберете: проигрывать деньги в казино или
  делать ставки на исход политики?»**

### Правила чтения (каждое — закрепить спеком)
1. **Действие бесплатное**, раз в поколение (обычное действие синей карты). Недоступно только при пустой колоде —
   `projectDeck.canDraw(1)`, причина `actionReason.deckEmpty()` (образец — Asteroid Deflection System).
2. **Вскрывается ровно ОДНА карта** — верхняя. Не «ищи до совпадения»: `drawCard({include})` здесь запрещён.
3. **«Party requirement» = у карты есть требование вида `party`** (любой партии). Требование «быть председателем»
   (`CHAIRMAN`, TR12), «лидеры партий», «делегаты на резолюциях» (TR02), влияние (TR04) — НЕ требование партии. Свод даёт
   то же понятие у награды Politologist: «cards with a party requirement (Event cards count)» — события считаются.
4. **Совпадение**: карта уходит В РУКУ игрока (её видели все — она вскрыта), игрок получает 5 M€ (источник — эта карта).
   Выполнено ли требование партии у игрока сейчас — НЕ важно: проверяется наличие требования, а не возможность сыграть.
5. **Промах**: карта уходит в сброс. Ничего не получено — и это НЕ «пропуск эффекта» (исход напечатан на карте), запись
   `effect-skipped` не нужна.
6. Взятая карта — обычная карта в руке: триггеры «когда вы берёте карту» срабатывают как при любом доборе — решить по
   коду: если у форка есть такие хуки на `drawCard`, идти через тот же путь `keep()` (`ChooseCards.ts:144–182`), а не голый
   `cardsInHand.push`.
7. MarsBot карту не играет; автома на чужие вскрытия не реагирует.

## 2. Блок A · сервер

### A1 · Один предикат — `hasPartyRequirement(card)`
Общая функция рядом с требованиями (`src/server/cards/requirements/` или `src/common/cards/`): `card.requirements?.some((r)
=> r.party !== undefined)`. `HighCircles.ts:35` переводится на неё (поведение прежнее). Её же прочитает будущая награда
Politologist — не писать награду, только оставить функцию общей. Рядом — `partyRequirementCardsInGame(game)`: сколько карт
набора ЭТОЙ партии несут требование партии (решение №3) — чистое чтение по составу колоды партии, без подглядывания в
порядок.

### A2 · Модель вскрытия — расширить, не завести вторую
- `RevealResultModel` (`src/common/models/RevealResultModel.ts`): `check?: {tag?: Tag, icon?: RevealCheckIcon, label}` —
  `tag` становится необязательным, добавляется вид значка (`'party-requirement'`); новое поле **`destination: 'discard' |
  'hand'`** — куда ушла вскрытая карта. Старые два вскрытия пишут `'discard'` (поведение прежнее; поле необязательное с
  умолчанием `'discard'` — на случай сейва посреди действия).
- `ActionRevealDescriptor` (`ActionPreviewModel.ts:159–175`): тот же `icon?` в `check`; `reward` остаётся одним
  `ActionEffect`, добавить **`keepsCard?: true`** («при успехе вскрытая карта уходит в руку») и **`pool?: {count: number}`**
  (решение №3: число карт с требованием партии в партии).
- `actionReveals.recordReveal(...)` получает `destination` и принимает `check` без метки. Журнал: совпадение —
  `'${0} revealed and kept ${1}'` с `{reveal: {origin: 'deck', result: 'kept', source}}` (значение `'kept'` уже есть),
  промах — существующая `'${0} revealed and discarded ${1}'`.

### A3 · Карта — `src/server/cards/turmoilRedux/PoliticalThinkTank.ts`
`Card` + `IActionCard`, `CardType.ACTIVE`, `tags: [Tag.MARS]`, `cost: 5`, `cardNumber: 'TR13'`. `export const
POLITICAL_THINK_TANK_REWARD = 5`.
- `canAct` = `projectDeck.canDraw(1)`; `actionUnavailableReason` = `actionReason.deckEmpty()`.
- `action`: `drawOrThrow` → `found = hasPartyRequirement(card)` → `events.recordCardReveal(player, this, {origin: 'deck',
  result: found ? 'kept' : 'discarded', count: 1, found})` → совпадение: карта в руку (правило 6) + `player.stock.add(Resource.MEGACREDITS,
  5, {log: true, from: {card: this}})`; промах: `projectDeck.discard(card)` → `recordReveal(...)` с `destination`.
  Порядок «запись вскрытия ДО сброса» — как у Search For Life.
- `actionPreview`: `actionPreviews.singleBranch(this, player, [], [], {reveal: {deck: 'project', check: {icon:
  'party-requirement', label: 'Party requirement'}, reward: actionPreviews.stockGain(player, Resource.MEGACREDITS, 5),
  keepsCard: true, pool: {count: partyRequirementCardsInGame(game)}}})`.
- `renderData`: `b.action('Reveal the top card of the projects deck. If it has a party requirement, take it into hand and
  gain 5 M€. Otherwise discard it.', (eb) => eb.empty().startAction.partyRequirement().asterix().nbsp.colon().nbsp.cards(1).asterix().megacredits(5))`
  — новый узел DSL `partyRequirement()` → `CardRenderItemType.PARTY_REQUIREMENT` (B4). `infoText` — `action-short` по образцу
  Search For Life («Reveal a card: a party requirement takes it and pays 5 M€»; бюджет 52 по RU мерить РУКАМИ).
- `CardName.POLITICAL_THINK_TANK = 'Political Think Tank'` после `MECH_SPORTS`; строка манифеста с комментарием про значок
  Turmoil. Шапка файла — чтение скана, правила 1–7, факт о составе колоды.
- Строка в `tests/cards/RevealActions.spec.ts` (третье вскрытие).

## 3. Блок B · клиент — вердикт, который отдаёт карту

**Целевой путь игрока (каждая строка — кадр приёмки §6):**
```
ДЕЙСТВИЯ КАРТ › ПОЛИТИЧЕСКИЙ АНАЛИТИЧЕСКИЙ ЦЕНТР › НАСТРОЙКА    «Вскрыть карту» · проверка [?] «Требование партии»
        │ A «Подтвердить»                                         награда «[карта] в руку · +5 M€» · «В этой партии таких карт: N»
        ▼ коммит действия: импульс по ряду → колода отвечает, рубашка летит с `.con-deckstack__pile` в слот, переворот
ДЕЙСТВИЯ КАРТ › … › ВЕРДИКТ     ✓ «Условие выполнено» · ПРОВЕРЕНО [?] требование партии: «Марс вперёд» · НАГРАДА карта + 5 M€
        │ A «OK» · X осмотреть вскрытую · L3 источник                (или ✕ «не выполнено» · «Не получено» · «В сброс»)
        ▼ исход ОТДЕЛЯЕТСЯ: workspace сворачивается, вскрытая карта летит в док руки, чип +5 M€ — на рельс (тик на касании)
          (промах: карта летит в сброс)
ПОЛЕ
```

### B0 · Что уже есть — переиспользовать
Клейм `deck-check` (`branchOutcomeClaimPlan`, `actionPreviewStore.ts:281–299`; `claimWorkspaceOutcome`, `ConsoleCardActions.vue:2702–2758`),
слот и полёт вскрытия (`ConsoleActionComposer.vue:162–196`, `runActionRevealFlight :92–277` — рубашка с настоящей колоды,
переворот ждёт ответ), панель `ConsoleRevealVerdict.vue`, фаза `verdict` (терминальная, B = `none`), `onRevealAck :2446–2456`
→ `releaseWorkspaceOutcome` → `concludeFlow()`, осмотр X / L3. Ничего из этого не переписывать.

### B1 · Композер — честное «до»
Строка проверки: значок «?» + «Требование партии» (вид `icon` из дескриптора — не метка). Награда: ДВА чипа — карта «в
руку» (`keepsCard`) и «+5 M€» с `current → resulting`. Строка состава: «В этой партии карт с требованием партии: N» из
`pool.count`; при N = 0 — предупреждение янтарным регистром («Сейчас условие невыполнимо: таких карт в партии нет») —
действие остаётся доступным (вскрыть и сбросить верхнюю карту — законный ход). Вероятность не печатать (в форке её не
печатают нигде).

### B2 · Вердикт — проверка без метки и два адреса награды
`ConsoleRevealVerdict.vue`: ряд «ПРОВЕРЕНО» рисует значок по `check.icon` (ветка рядом с `tagIconUrl`) и называет НАЙДЕННОЕ
— имя партии из требования вскрытой карты («требование партии: Марс вперёд») либо «не найдено»; ряд «НАГРАДА» — чип карты
«в руку» + чип M€, либо «Не получено» и строка судьбы карты «В сброс». Модель чтения — чистая функция со спеком; SFC
только рисует. Геометрия панели не меняется между успехом и промахом (ряды резервируют высоту).

### B3 · Отдача исхода — «результат переживает поверхность, которая его произвела»
На «OK» (и только на нём) исход отделяется в слой приложения, workspace сворачивается, и лишь затем карта летит к
ИЗМЕРЕННОМУ адресату:
- **успех**: вскрытая карта из слота → док руки (`runHandIntake`, адресат — рект покоя новой карты в доке); чип +5 M€ — со
  значка награды вердикта на рельс, счётчик M€ ДЕРЖИТСЯ холдом от ответа до касания (свой спек холда, отпускать только
  свой — память `panel-reward-hold-is-shared`). Рука на сервере уже содержит карту с ответа: док не должен показать её
  до посадки (тот же приём, что у добора — карта скрыта под прокси).
- **промах**: вскрытая карта из слота → сброс (`discardOpenCards` — «один язык сброса»).
Оба существующих вскрытия получают полёт в сброс тем же путём (их `destination` = `'discard'`) — это закрывает класс «карта
стоит в слоте и исчезает»; если правка для них рискованна по срокам — оставить их как есть и ЯВНО записать гэп.
Длительности — `motionMs()` / `MOTION_EASE`; холды отпускаются касанием; нет rect → конечная поза + свидетель деградации.
Reduced motion — конечные позы. Двери вердикта вне прямой активации (повтор из руки, standalone / embedded оверлей —
`resultRevealPresentation`, `ConsoleRevealOverlay.vue:324–377`): та же панель и тот же исход; если какая-то дверь для этой
карты недостижима — назвать в отчёте, не моделировать.

### B4 · Лицо карты — значок «требование любой партии»
`CardRenderItemType.PARTY_REQUIREMENT`: оранжевая плашка требования с пилюлей «?» внутри — как на скане. Пилюля — ассет
владельца → `assets/misc/wild-party.png` (сохранить альфу и пропорцию; `filter` на консоли вырезан); плашка — тем же
языком, что полоса требований премиум-лица (`.pcard-req`), не картинкой целиком. Тот же значок — в строке проверки
композера и вердикта (один символ на одно понятие). `plate('?')` у TR03 не трогать (там «партия ЭТОЙ резолюции», другое
понятие). Гарды `premiumCardIcons.spec`, `premiumCardViewModel.spec`, `actionExtraction` — ворклист.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: строки вердикта («Condition met / not met»,
«Checked», «Reward», «Not received»), «Reveal a card», `'${0} revealed and discarded ${1}'`, имена партий (`party name: …`).
Новые (ожидается ~9): `"Political Think Tank"` (**имя — решение владельца**); `Action: Reveal the top card of the projects
deck. …` → «Действие: вскройте верхнюю карту колоды проектов. Если у неё есть требование партии, возьмите её в руку и
получите 5 M€. Иначе сбросьте её.»; `action-short`; `'Party requirement'` («Требование партии»); `'party requirement:
${0}'`; `'${0} revealed and kept ${1}'` («${0} вскрывает и забирает ${1}»); `'to hand'` / `'To the discard'` (grep — вероятно
есть); `'Cards with a party requirement in this game: ${0}'`; предупреждение при нуле; лор RU — §1.

## 5. Тесты
**`tests/cards/turmoilRedux/PoliticalThinkTank.spec.ts`**: метаданные (ACTIVE, 5, `[MARS]`, без требований и ПО, TR13);
пустая колода → `canAct` false + причина; совпадение (на верх колоды — `drawPile.push(new WildlifeDome())` или иная карта с
`{party}`): карта в руке, M€ +5 с источником-картой, сброс не вырос, `lastReveal` = `{conditionMet: true, destination:
'hand', check.icon, reward}`, журнал `kept`; промах: карта в сбросе, M€ те же, `destination: 'discard'`, без `effect-skipped`;
вскрыта ровно одна карта (размер колоды −1 в обоих исходах); событие-карта с требованием партии — совпадение; карта с
`chairman` / `partyLeader` / `delegatesOnResolutions` / `influence` — промах; требование партии, НЕ выполненное игроком, —
всё равно совпадение; `pool.count` = 0 на чистом Redux-столе и растёт с картой, добавленной в состав; превью чисто.
**`hasPartyRequirement`** — свой спек + `HighCircles.spec` зелёный без правок. `RevealActions.spec` — строка TR13.
**Гарды чеклиста §3** — ворклист пуст; особо `actionPreviewCoverage`, `actionPromptCoverage`, `actionReasonCoverage`,
`variableAmountPreviewGuard`, `crossPlayerCoverageGuard` (соперник видит «вскрыл и забрал <карта> · +5 M€»); `make:cards` 0 / 0 / 0.
**Клиентские юниты**: модель чтения вердикта (успех / промах / проверка без метки / имя партии), `consoleRevealPresentation`,
план исхода (hand | discard), холд M€ (посев и отпуск только своего), `composerRender` (чипы награды, строка состава, ноль).
**e2e — ОДИН спек** `tests/e2e/console-political-think-tank.spec.ts`, фикстура `political-think-tank` (Redux-стол, имя в
`FixtureName`): синий — карта в табло, действие не использовано; верх колоды закреплён ПОСЛЕ раздачи
(`projectDeck.drawPile.push(...)` в генераторе — `customProjectCards` раздаст карту в стартовые руки, `Deck.shuffle(cardsOnTop)`
перемешивает; память `e2e-fixture-generator-powergrid-break`). **Карта с требованием партии в Redux-наборе пока
отсутствует → на верх кладётся классическая (Wildlife Dome) — СИНТЕТИКА, пометить комментарием; заменить на карту TR,
когда появится.** Второй тест — та же фикстура с картой без требования на верху (вторая запись фикстуры или второй файл).
Пробник — `MutationObserver` + `setInterval`; утверждать ПОРЯДОК:
1. композер: проверка «Требование партии», два чипа награды, строка состава; A → ровно один POST;
2. рубашка летит от `.con-deckstack__pile` в слот; вердикт «выполнено», имя партии, награда; M€ на рельсе — СТАРОЕ число;
   в доке руки новой карты ещё нет;
3. A «OK» → `.con-ws` ушёл ДО посадки карты в док; карта в доке, M€ +5 — после касаний; сервер по API: карта в руке, M€ +5;
4. промах: вердикт «не выполнено», «Не получено»; после «OK» карта в сбросе, рука и M€ прежние;
5. конец на поле: нет `.con-ws`, нет stranded, 0 `[console-overflow]`, 0 ошибок страницы, `data-*-degraded` не появлялся.
Профили fhd + tv4k (`--workers=1`), `--repeat-each=4`, `waitForTimeout` = 0. Регрессия соседей: `console-reveal-landing`,
`console-repeat-reveal-embed`, `console-action-focus`, `console-surface-motion`. `npm run e2e:affected` перед коммитом.

## 6. Визуальная приёмка (fhd + кадр 4K; свой сервер, `.e2e-tr13/`)
1. Витрина: лицо — 5, Марс, ряд «→ [плашка ?]* : [карта]* 5 M€»; значок рядом с чипом требования партии любой карты.
2. Композер при N > 0 и при N = 0 (предупреждение).
3. Вердикт: успех и промах — два кадра одной геометрии.
4. Раскадровка исхода (CDP-скринкаст): «OK» → workspace уходит → карта в воздухе к доку, чип M€ к рельсу → посадка; то же
   для сброса.
5. Журнал и нотификация соперника.

## 7. Режим работы
**3 коммита**, каждый зелёный по юнитам: (1) сервер — предикат, модель вскрытия, карта + лицо (значок) + локаль + арт + лор
+ спеки; (2) клиент — композер, вердикт, исход + юниты; (3) e2e + фикстура + документы. Перед каждым: `npm run lint`,
`npm run build:test`, `npm run make:cards`, `npm run make:json`; код выхода каждого гейта читать ЯВНО (`; echo exit=$?`);
перед визуальной проверкой `npm run make:css` + `npm run build:server`. **Не пушить.**
Документ карты НЕ заводить: контракт вскрытия дописать в `docs/CONSOLE_BLUE_ACTION_PARITY.md` (итерация: «вердикт отдаёт
карту» — `destination`, проверка без метки, два адреса награды) и одной строкой в чеклист набора §4 («карта вскрывает
верхнюю карту колоды → `recordReveal` с `destination`, превью `reveal`»). Журнал набора: что нового, решения владельца,
ФАКТ о составе колоды, гэпы, синтетическая фикстура. Гочи: `python3` — заглушка Store; юниты последовательно; `eqeqeq` без
исключения для null; новая карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в
манифесте и чинить классом.

В отчёте: формы `RevealResultModel` / дескриптора после правки; что стало с двумя старыми вскрытиями; кадры §6 +
раскадровка; e2e на двух профилях и регрессия соседей до / после; что напечатали гарды; новые ключи i18n; **явно — всё,
что не получилось сделать по этому промту, и почему.**

## 8. Нельзя
`drawCard({include})` / любой «ищи до совпадения». Вскрывать больше одной карты. Проверять, ВЫПОЛНЕНО ли требование партии.
Считать требованием партии председателя, лидеров, делегатов, влияние. Вторая модель вскрытия или вторая панель вердикта.
Печатать вероятность или число карт, оставшихся в колоде. Скрывать действие при N = 0. Карта, «исчезнувшая» из слота без
полёта; полёт до «OK»; карта в доке или M€ на рельсе раньше касания; холд на `setTimeout`; `clearPanelRewardHold()`.
Растянутая пилюля; `filter` как носитель состояния; литерал кнопки; `title`. Детект по тексту заголовка. `compatibility:
'turmoil'`. Писать награду Politologist. Трогать `plate('?')` TR03. Трогать чужие незакоммиченные файлы, `shardPlan.json`.
Пуш и красные коммиты.
