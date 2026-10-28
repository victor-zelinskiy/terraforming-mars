# TR78 Arwind Inc. — ходьба по Карьере, ответ стола на одной сцене

Первая из восьми НОВЫХ корпораций набора Turmoil Redux (не замена). Скан — `…/TM Turmoil Redux/Corporations/Corporation -
Arwind Inc.png`, арт `assets/card-images/TR78.webp`, лор TR78 (EN `assets/text/lore_texts.json`, RU `src/locales/ru/lore_texts.json`).
Промт — `docs/claude/prompts/redux-corp-arwind-inc.md`. Карта — `src/server/cards/turmoilRedux/ArwindInc.ts`.

**Печатное:** 38 M€ + 1 производство титана, метка Космос, держатель истребителей, без ПО, без первого действия.
**Действие:** положите 1 истребитель на любую карту (декларация `addResourcesToAnyCard` — как у Celestic).
**Эффект 1:** каждый раз, когда ваш маркер Карьеры продвигается на 1 шаг, положите 1 истребитель на любую карту.
**Эффект 2:** при розыгрыше карты с меткой Космоса истребители с ЭТОЙ карты можно тратить как 4 M€ каждый.

## 0. Переделка 2026-10-28 — три закона владельца

Первая сдача (2026-10-26/27) спрашивала игрока по шагу, заставляла нажимать на единственную карту, после его же выбора
играла сцену срабатывания второй раз и встраивалась в Парламент тремя разными способами. Владелец назвал это
некачественным; законы переделки:

1. **ХОДЬБА — ОДИН ОТВЕТ.** Эффект печатан «за шаг», но ходьба из N шагов — ОДИН вопрос на N единиц (раскладка общего шага
   `AddResourcesToCards` при N ≥ 2 и ≥ 2 держателях, иначе выбор одной карты) — никогда N вопросов подряд. Хук —
   `ICard.onAgendaWalked`, один вызов на ходьбу.
2. **АСКЕР ОДИН — НЕ ВОПРОС.** Если единственный держатель — сама корпорация, единицы ЛОЖАТСЯ сразу (фиксированная
   самоцель, исключение инварианта 3), и игрок видит СЦЕНУ: карта поднимается на месте, истребители рождаются на её
   печатном эффекте и садятся в её капсулу. Никакого нажатия на единственную карту.
3. **РАССКАЗАНО ОДИН РАЗ.** Ответ, данный игроком на сцене (выбор / раскладка), играет сцена приёма от лица аскера; запись
   фреймворка срабатывания, пришедшая с коммитом, ОТНОСИТСЯ к этой сцене (`declareHeldAnswers`) и не поднимает карту второй
   раз у края рейла; карточка ленты не строится.

И ОДНА СЦЕНА для всех четырёх ходьб — «ОТВЕТ СТОЛА» (§6).

## 1. Номер — реестр новых корпораций

`src/common/cards/turmoilReduxCorporations.ts` — восемь строк в порядке папки сканов (Arwind Inc. TR78 … Veynon Dynamics
TR85); строка с `authored` — зарегистрированная карта. Гард `TurmoilReduxCardManifest.spec`: номер > 77 — строка этого
реестра, корпорация, без `reimplements`; `within(1, 85)`. Замены (TR71…TR77) — свой реестр `turmoilReduxReplacements.ts`.

## 2. Хук ходьбы — ОДНА дверь на четыре причины, ОДИН вызов на ходьбу

`ICard.onAgendaWalked(player, walk: AgendaWalkContext {from, to, steps, cause})` зовётся ВНУТРИ единственной ходьбы
`ChairmanSeat.walkAgenda` ОДИН раз — после бонуса последнего шага и записи ходьбы (`lastAdvance`, событие
`agenda-advanced`), для каждой карты стола ходящего (корпорация включена), под `events.withEffect(player, card,
'agenda-step', …, cause)`; **причина записи срабатывания называет ходьбу** (`CardReactionCause.walk {reason, from, to}` —
клиент выбирает хост сцены по ней, не по `lastAdvance`). MarsBot не спрашивается. Причины: ходьба карты (TR04, TR12, TR37,
TR42, TR73, TR76 — синхронно в `bespokePlay`), задание председателя (`applyQuest` / `seatPrompt.finish`), шаг победителя
заседания (`ParliamentPhase.stepAgenda`), шаг закона (`payAgendaGrant`, RX39). Конец трека режет список шагов честно;
ходьба без шага не зовёт; шаг с ветированным РТ (RX42) — в списке.

## 3. Ответ: приземление, вопрос, запись для перезагрузки

`parliament/AgendaWalkReactions.ts`:
- `reactionStep(player, reactor, resource, count, meta, {cardBeingPlayed})` — ОДИН билдер: общий `AddResourcesToCards`
  (`autoSelect: false`, `cause` — корпорация, маркер `agendaWalkPrompt {source, reason, from, to, card?, resolution?}` —
  на ОБЕИХ формах: `SelectCard.toModel` и `AndOptions.toModel`). Форму решает сам шаг: N ≥ 2 над ≥ 2 держателями — раскладка
  (`cardResourceDistributionPrompt`), иначе выбор.
- `answerResourceOnAgendaWalk(player, reactor, walk, resource, perStep)` — живой хук: держателей нет → шаг именует потерю;
  **аскер один (`askerAlone`) → `addResourceTo` сразу** (`'landed'`); иначе вопрос: причина `card` — `defer` (класс движка:
  один запрос); `phase` / `quest` / `resolution` — запись `pendingActions {kind: 'card-reaction', player, card, resource,
  count, reason, from, to, resolution?}` + `defer`; ответ снимает запись; `rebuildAgendaReactions` (из
  `ParliamentHandler.rebuildPendingPrompts`) переспрашивает после перезагрузки (и кладёт сам, если второй держатель ушёл).
- Заседание ждёт вопроса по построению: `drive()` дренирует очередь после шага `agenda` — единицы ложатся ДО поддержки и
  принятия. Модель публикует `phase.pending` с ключом `AGENDA_REACTION_PENDING_KEY`; раннее закрытие во время паузы не
  предлагается. **Паузы нет**, когда аскер один: цепочка проходит в один ответ.

## 4. Pre-select при розыгрыше — ОДНА строка

Пара хуков прогноза `onAgendaWalked ↔ agendaWalkedForecast` (`FORECAST_HOOK_PAIRS`, гард `effectForecastCoverage`) и шаг 0 в
`effectForecast.cardPlayedFacts`: собственная ходьба разыгрываемой карты (`agendaWalkForecast`) отвечается столом ОДНИМ
фактом: аскер один — `exact` «+N [истребитель] on this card» (движок штампует `host`), вопроса нет, единицы ложатся с
розыгрышем; второй держатель — `asks` с ТЕМ ЖЕ промптом (`reactionStep(...).previewPrompt()` — раскладка или выбор,
`cardBeingPlayed` считается держателем), адрес `{role: 'and' | 'card', source: corporation}`. Композер розыгрыша:
- выбор — строка «вопроса стола» как у любой реакции (`data-reaction-card`), единственный держатель посеян (T14);
- **раскладка — строка `distribute`** (`consoleActionComposer.distributionLanesOf`, kind `'distribute'`): по дорожке на
  держателя (миниатюра — `data-composer-card`, имя, «было → станет», положено «+k»), фокусная дорожка — кант, ←→ между
  дорожками, LB/RB единица туда/обратно, RT — остаток; «Осталось N» / «Разложено N» на краю строки. Раскладка открывается
  ПУСТОЙ (заполнение по умолчанию — автовыбор) и держит коммит до точной суммы; ответ — ОДИН `and`
  (`cardResourceDistributionResponse`), адресованный; `deferredInputBatch` кладёт его на свой промпт.

## 5. Платёжная единица `arwindFighters`

Четвёртая карточная единица по таблице касаний EVA §3 (`docs/TURMOIL_REDUX_EVA_MECHS.md` §9): `Spendable` +
`CARD_FOR_SPENDABLE_RESOURCE`, `Payment` (`ARWIND_FIGHTER_VALUE = 4`, плоско), `Player.paymentOptionsForCard`
(ПЕЧАТНАЯ метка Космоса), `pay()` — списание С ЭТОЙ карты, оба промпт-модели, `SelectPaymentDeferred` (false),
`paymentModelUtils`, `paymentPlan` (дорожка «Истребители», спрайт `fighter`), `railValueModel` (`space` —
«4 M€ · Космос»), десктоп-остатки. **Защищённая** (решение 7): TR29 Spaceship Recycling тратит «1 истребитель с ЛЮБОЙ своей
карты», поэтому стартовая смесь оплаты её не сеет (`PROTECTED_UNITS` рядом с `floodgateSteel`); игрок поднимает дорожку сам.

## 6. «ОТВЕТ СТОЛА» — одна сцена на четыре ходьбы (консоль)

Модуль `console/parliament/tableAnswerBeat.ts` + компонент `parliament/ConsoleParliamentTableAnswer.vue` (`.con-tans`):
ГЕРОЙ — лицо аскера (`data-reaction-home` — фреймворк срабатывания поднимает его НА МЕСТЕ, строка эффекта подсвечена; закон
17 «СРАБАТЫВАНИЯ»), под ним одна тихая строка «ШАГ КАРЬЕРЫ · from → to · +N [истребитель]»; ЗОНА — либо КВИТАНЦИЯ (ряд
лиц получателей кроме аскера, `ConsoleTableReceipt`; доля аскера садится в его капсулу на герое), либо ВОПРОС
(`[data-embed-slot="parliament-answer"]` — шелл телепортирует туда выбор / раскладку хоста задач). Сцена ничего не титулует
(хвост крошки — «ИСТРЕБИТЕЛЬ», `agendaReactionStageKey` / `agendaReactionResourceKey`), ввод не держит.

Бит — DETECT → SEED → OWE → PLAY:
- DETECT (`detectTableAnswers`) — свежие записи `cardReactions` зрителя канала `agenda-step` с причиной-ходьбой (кольцо
  потребляется по `seq`, первый вид ничего не играет); получатели с «было/стало» по двум видам.
- SEED (`seedTableAnswers`, в блоке apply ПЕРЕД `seedCardReactionHolds`) — хост по причине: `quest` → живой поток задания;
  `phase` / `resolution` → заседание (стоит или ещё впереди — мягкие ворота); `card` → хост ходьбы (`agendaWalkHostFor`).
  Есть хост → капсулы держатся (`beginPanelRewardHold`) и строки ОБЪЯВЛЕНЫ (`declareHeldAnswers`) — сеятель срабатывания
  ПРИВЯЗЫВАЕТ запись к сцене, сам не летит, лента карточку не строит; хоста нет → запись остаётся цепочке фреймворка
  (реактор у края рейла). Запись РЕЗЕРВИРУЕТСЯ за сценой (`reserveCardReaction(seq, TABLE_ANSWER_RESERVATION)` до
  посева сеятеля): нефильтрованный захват сцены розыгрыша («все привязанные группы» — `heroAnswerFlight`) её пропускает,
  берёт только полёт сцены с тем же именем (первый прогон на боксе 2026-10-28: герой розыгрыша забирал ответ ходьбы и
  поднимал аскера у края рейла впустую). TOLD-запись резервируется как `table-answer:told` — её не берёт никто; и сеятель
  не занижает ОБЪЯВЛЕННУЮ строку card-resource ниже объявления (`Math.max` — сцена приёма ничего не держит, и сырой цикл
  обнулял её строку во вторую цепочку). **TOLD:** ответ, данный игроком (сцена приёма `promptReceive` / раскладка
  `runTableAnswerPayout`), отмечен ДО блока apply (`noteTableAnswerTold`) — посев только объявляет, не должает.
- PLAY (`playTableAnswer`) — хост открыл сцену (`paneIn` после входа) → `cardReactionAnswerFlight({rows})` → `prepare`
  (аскер поднят на месте) → по получателю: жетоны `tokensOf`, рождение `originOf` (печатный значок эффекта), посадка в
  капсулу на сцене (лестница назначений: `.con-tans [data-tans-card] .pcard__res` / `[data-receipt-card]`), тик на касании →
  чтение → `onDone` (оседание) → сцена складывается. Холд `parliament-table-answer` (блокирующий, потолок 16 с, только при
  стоящем хосте).

Хосты:
- **Задание** — `chairmanQuestDirector.afterAgenda`: сначала квитанция (`ctx.playTableAnswer`, бит `reaction`, крошка
  «ПРЕДСЕДАТЕЛЬСТВО › ИСТРЕБИТЕЛЬ»), потом вопрос (`owesReaction` → поток держится, секция ставит вопрос —
  `askTableAnswer`, шелл телепортирует выбор после `consoleParliamentUi.answerZone`); падение промпта →
  `endTableAnswerAsk` + `noteChairmanQuestReactionAnswered` → A закрывает. Сцена — СВОЙ вид стейджа секции
  (`con-parl__stage--answer`, разворот над столом грамматикой смены тела).
- **Заседание** — СЛОЙ панели награды (`ConsoleParliamentSitting` `:answerUp` → `.con-sit__answer` над шасси герой+зона;
  поле `sittingFieldOf(…, answer)`): шаг победителя — на странице ПРИНЯТИЯ после ПОВЕСТКИ (`beatTableAnswer` с причиной
  `phase`; вопрос — пауза как прежде: `careerPausedAt` → `onCareerTold` → `askTableAnswer`; возобновление —
  `careerResumeOwed`); шаг закона — на странице НАГРАДЫ после КАРЬЕРЫ (`beatTableAnswer` с причиной `resolution`; вопрос —
  дверь шага закона как прежде, зона — слоя). Лента во время бита `answer` держит строку шага.
- **Ходьба карты** (рука / старт / свой Парламент) — `ConsoleParliamentSection.playOwedWalk`: после чтения ходьбы
  `playWalkAnswer` (бит `answer` потока ходьбы, крошка — слово единицы) → квитанция на своём стейдже → `onDone`. Живой вопрос
  причины `card` (композер не собрал) обслуживается как любой живой выбор рабочего пространства руки.

Шелл: `parliamentAnswerTask` (любой `agendaWalkPrompt` не-`card` при стоящем Парламенте; `quest` — только при живом потоке)
держит хост до `answerZone` и телепортирует в `[data-embed-slot="parliament-answer"]` — ПЕРЕД общей зоной заседания, которую
тот же промпт тоже бы совпал. Транспорт: ворота раскладки (`detectTableAnswerPayout` / `runTableAnswerPayout` — жетоны с лица
аскера на капсулы раскладки, коммит удержан; `transportHolds.tableAnswer`), посев `seedTableAnswers`.

## 7. Что наследует следующая корпорация-реактор

Хук `onAgendaWalked` + `answerResourceOnAgendaWalk` («ресурс на любую карту» — приземление / выбор / раскладка) + двойник
`agendaWalkedForecast` — и сцена «ОТВЕТ СТОЛА» со всеми хостами приходит даром (маркер решает хост, слово стадии — из
ресурса). Вопрос другой формы — новая ветка в `AgendaWalkReactions` с той же записью для перезагрузки, никогда вторая
функция ходьбы. Реактор, который ОТВЕЧАЕТ на что-то ещё (TRP9: микроб/данные после метки Науки), может взять ту же сцену:
DETECT по своему каналу + причине, хост по своему потоку.

## 8. Спеки

`tests/parliament/AgendaWalkHook.spec.ts`, `tests/cards/turmoilRedux/ArwindInc.spec.ts`, `tests/console/agendaReaction.spec.ts`,
`tests/client/console/tableAnswerBeat.spec.ts`, `tests/client/console/parliamentSittingSeed.spec.ts` (пауза и возобновление),
e2e `tests/e2e/console-arwind-inc.spec.ts` (A · A2 · B · B2 · C · C2 · D; фикстуры `arwind-walker` · `arwind-walker-two` ·
`arwind-chairman-quest` · `arwind-chairman-quest-solo` · `arwind-sitting-win` · `arwind-sitting-win-solo` · `arwind-pay-space`;
свидетель `transferWitness`: якоря `reactor:Arwind Inc.:*` → `answer:<карта>`, `asker:*` → `slot:<карта>`; проба
«рассказано один раз» считает ТОЛЬКО лицо аскера в слое срабатывания — другой реактор того же ответа (хартия правящей партии
на M€ шага Карьеры) встаёт там законно; красное печатает имена всех лиц и трейл `reaction:*` директора).
