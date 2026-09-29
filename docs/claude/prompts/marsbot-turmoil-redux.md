# Промт исполнителю · MarsBot в «Кризис: Возвращение» — Party Politics, Лоббирование, награда победителя, задания, колонии Redux

Выдан 2026-09-29 (ред. 2 — по решениям владельца). **Это задание на РЕАЛИЗАЦИЮ по готовому проекту** —
`docs/TURMOIL_REDUX_MARSBOT.md` (концепция, дыры §2, голосование §3, заседание §4, задания §5, что бот
игнорирует §6, колонии §7, подача §8, архитектура §9, решения §10). Читать проект целиком **до первой строки
кода**; здесь — только то, чего проект не досказал, и порядок работ. Решения §10 закрыты; если владелец
изменит строку — сначала правится проект, потом код.

Обязательное чтение перед стартом: `CLAUDE.md` (инварианты 2, 3, 4, 6, 7, 8, 9, 11), `.claude/rules/marsbot-corps.md`,
`.claude/rules/game-logic.md`, `.claude/rules/console-ui.md`, `docs/claude/marsbot-corporation-checklist.md` §4
(примитивы бота — использовать, не дублировать), `docs/claude/parliament-resolution-checklist.md` (контракт
резолюции и драйвера), `docs/AUTOMA_DATA_AUDIT.md` §1/§5/§7, `docs/claude/marsbot-external-reactions-audit.md`
(«вскрытие ≠ разрешение»), `docs/claude/parliament-glossary.md`. Официальный текст: RB-C стр. 6–7
(`C:\Users\zelin\OneDrive\Документы\aa_mars_preset\Automa\TM-Automa-rulebook-C-11-14-2023.pdf`, дампить страницы
ЦЕЛИКОМ через `pypdfium2`, не grep'ом — память `automa-rulebook-c-is-source-of-truth`).

**Главный профиль — 4K TV** для всего, что рисуется; замеры и скриншоты начинаются с него.

---

## 0. Что уже установлено — не перепроверять, а опираться

1. **Redux + MarsBot уже разрешены при создании.** `Game.ts:346-353` отвергает только Redux+классику и Redux без
   Colonies; `automaCompatibility.ts:126` блокирует только классический `turmoil`; вход
   `AutomaSetup.validateOptions` (`AutomaSetup.ts:17-41`) поля `turmoilRedux` не имеет — добавить явно (Э0).
2. **Шов бота — один boolean.** `BotParliamentPolicy.participates(player)` (`BotParliamentPolicy.ts:15-34`),
   `BotParliamentMode = 'none'` (`ParliamentTypes.ts:194-201`), `Parliament.newInstance` жёстко `new Parliament('none')`
   (`Parliament.ts:151`), режим сериализуется (`SerializedParliament.ts:465`) и уходит в модель
   (`ParliamentModel.ts:94`, `common/models/ParliamentModel.ts:83, 462`). **Вызовы, каждому из которых в Э0
   назначается аспект:** `Parliament.ts:162` (лобби при сетапе) · `:221-227` (`participates` / `participants`) ·
   `:295` (резерв) · `:406` (`access` — эффекты партий) · `:458` (влияние) · `:554` (`canVote`) ·
   `ParliamentHandler.ts:143` (действие резолюции) · `:182` (пассив) · `:250` (скидка) · `:272` / `:347` / `:365`
   (ценность / надбавки) · `PlaceDelegatesOnResolution.ts:56` · `QuestTracker.ts:62` · `ParliamentModel.ts:186, 363` ·
   `BoardInformationEngine.ts:656, 710` · `effectForecast.ts:110, 254, 303` · `ParliamentPhase.ts:517` (цикл мест
   эффектов) · `:930` (лобби) · `:985` / `:1005` (ворота) · `worldStepHandle` `:86-89` (первый человек — не трогать).
3. **Драйвер заседания**: шаги `ParliamentTypes.ts:179-189`; `stepWinner` `ParliamentPhase.ts:297-339`; `stepAgenda`
   `:343-365` → `ChairmanSeat.advanceAgenda(...,'phase')`; `stepEffects` `:509-579` + `runSeatStep` `:585-643`
   (шаги победителя идут ИНЛАЙН в цикле мест — для бота-победителя цикл его не содержит, см. Э2); ворота
   `stepGate` `:462-487`, `parliamentGatePending` `:979-986` считает ТОЛЬКО участников. Лидер/победитель —
   `Parliament.ts:332-401` (`leaderOf` над `Slot`, `winner()` над `this.slots`).
4. **Задание председателя**: виды цели `QuestGoal` `ParliamentTypes.ts:96-126` (`production | tag | tile
   greenery/city/special/spaceCity | colony | tr | cardResource | delegates | cardsPlayed | trade`);
   `QuestTracker.eligible` `QuestTracker.ts:55-82` — участие, фаза ACTION, актор корня = игрок, категория корня НЕ
   из `FOREIGN_ROOT_CATEGORIES` (`:50-52` — там `'automa-turn'`), нет источника `resolution` на стеке (Q-5);
   `match` `:85+` — метка по ТОЧНОМУ совпадению (дикая не считается); репорты людей — 9 вызовов
   `QuestTracker.report` в `ParliamentHandler.ts` (метки `card.tags`, тип карты, тайл, колония, торговля, РТ,
   производство `delta`, ресурс карты, делегат) + `PlaceDelegatesOnResolution`. Завершение —
   `ChairmanSeat.onQuestCompleted` `ChairmanSeat.ts:85-94` → ворота `questPrompt` `:103-116`
   (`markChairmanQuest`) → кресло: резерв, иначе лобби (`:190-199`), иначе `seatPrompt` `:212-257`; первый в
   поколении — `Parliament.ts:652-664`; стартовое задание +3 пр. тепла (`ParliamentTypes.ts:134`).
5. **Бот — настоящий `Player`** (`AutomaSetup.ts:62-71`): `megaCredits` (старт 0), `terraformRating` (старт 20,
   `Player.ts:215`; в цикле гандикапа пропущен `Game.ts:523-529`). **Производства у бота нет**: положительное
   изменение БРОСАЕТ (`Production.ts:38-40`), отрицательное регрессирует трек. Метки бота = позиции треков
   (`AutomaTargeting.ts:370-392`). **Производство ↔ трек** — данные планшета `productions` в определении трека
   (`TharsisMarsBot.ts:8-50`), карта `MarsBotBoard.productionToTrack` (`MarsBotBoard.ts:69-122`). Карта для
   бота = 1 M€ (FAQ p.11; `SponsoredAcademies.ts:65`). `ExternalDrawIntake` для бота бросает
   (`ExternalDrawIntake.ts:84`). Хранилища: `automa.floaters`, `automa.shippingStorage` (`AutomaState.ts:42-43`),
   вход `AutomaColonies.addToStorage` (`AutomaColonies.ts:53-63`; Титан → пул флоатеров).
6. **Ход бота**: `AutomaController.ts:86-161`; ветка карты проекта `:120-139` (лог `'${0} played ${1}'`, хук
   корпорации, реакции людей, `AutomaResolver.resolveProjectCard` → `printedTags` `AutomaResolver.ts:36`,
   `resolveTag` `:65` с `onTagResolved` `:82, 90`, затем `playedPile`); ветка бонус-карты `:140-157`
   (`'${0} played the bonus card ${1}'`, `resolveBonusCard` → `routeBonusCard`); ветка обзора —
   `AutomaTurnLog.setBonusBranch` `AutomaTurnLog.ts:384-386` → `MarsBotTurn.branch` `MarsBotTurn.ts:89-97`.
   Колода бота скрыта: модель несёт только `actionDeckSize` (`MarsBotModel.ts:32`).
7. **Бонус-карта = enum + данные + `case`.** `BonusCardId.B21_PARTY_POLITICS` есть (`AutomaTypes.ts:235`), данные —
   заглушка (`BonusCardData.ts:98-101`), `case` в `resolveBonusCardEffect` (`AutomaBonusCards.ts:239-272`)
   отсутствует — вскрытие бросит. Исход `'discard' | 'destroy' | 'return-to-deck'` (`:45`), маршрут
   `routeBonusCard` (`:889-928`, recurring остаются в холдинге `:924-926`). **Recurring с 1-го поколения** —
   образец B16: `AutomaSetup.ts:141-143` + `:162-164` + `AutomaResearch.ts:101-103`.
8. **Флип по цене есть, делимости нет.** `AutomaTilePlacer.breakTie` `AutomaTilePlacer.ts:96-135`,
   `AutomaColonies.flipToPick` `AutomaColonies.ts:109-122`; роли строк `'tie-flip' | 'colony-pick-flip'`
   (`AutomaTurnLog.ts:276-290`, `MarsBotTurn.ts:81`) обзор прячет как бухгалтерию. **Лоббированию флип не нужен** —
   оно читает цену разыгранной карты (`card.cost`).
9. **Образцы списков приоритетов**: сужение `selectMilestoneToClaim` (`AutomaMilestonesAwards.ts:36-69`),
   лексикографический `MarsBotDraftResolver.pickByScore` (`MarsBotDraftResolver.ts:70-88`), ветка «первая
   исполнимая» `pushNearestBonus` (`AutomaNearBonusPush.ts:73-131`, объявляет ветку обзору).
10. **Примитивы бота для ★**: `AutomaTilePlacer` (озеленение/город/океан + тайбрейки), `AutomaTerraformer`,
    `AutomaColonies.botBuildColony` (flip-to-pick, `AutomaColonies.ts:141, 204`), общий `Game.addTile`,
    `onGreeneryPlaced` уже платит боту +1 РТ за тайл (`ParliamentHandler.ts:399-411`).
11. **Колонии**: планшет `ShippingBoardData.ts:35-67` (`exchangeTag`), Плутон Redux уже наследует область
    (`:58-67`); гейт `ColonyDealer.withoutTilesMarsBotCannotUse` `ColonyDealer.ts:58-77`; замены/добавления —
    `AllColonies.ts:44-51`.
12. **Тесты**: `testAutomaGame()` (`tests/automa/AutomaTestGame.ts:37-51`, C01 по умолчанию, `[game, human, bot]`);
    форс колоды — `automa.actionDeck = [{kind:'bonus', id}]` + `humanPasses` (`AutomaTurn.spec.ts:46-58`); прямой
    резолв — `resolveBonusCard` + `routeBonusCard` (`AutomaBonusCards.spec.ts:22-26`); recurring —
    `AutomaResearchPhase.spec.ts:55-66`; стол Парламента — ТОЛЬКО `tests/parliament/parliamentArrange.ts`;
    существующие ветки «MarsBot (mode none)» — `ParliamentPhase.spec.ts:448`, `ChairmanQuestGate.spec.ts:207` и
    ~25 спеков резолюций (например `AquiferContest.spec.ts:435`).
13. **Подача**: своя посадка куба — `ConsoleParliamentVoteMode.vue:932-960`; кольцо посадки резерва —
    `ConsoleParliamentSeats.vue:36, 134`; чужого прилёта в столбик СЕГОДНЯ НЕТ; remote-стейдж тайла —
    `console/tilePlacement/consoleRemotePlacement.ts`; лента исходов не печатает бота (`voteLedgerModel.ts`, гард
    `voteLedger.spec.ts`); лицо бонус-карты — `BonusCardFace.vue`, обзор хода — `BotTurnReviewBody.vue` /
    `botTurnReviewModel.ts`; RU бонус-карт — `src/locales/ru/automa.json`; блок задания/гонки — в
    `ConsoleParliamentGovernment.vue`.

---

## 1. Решения (из §10 проекта — закрыты)

D1 РТ 20 · D2 бот голосует · **D3 выплат резолюций боту НЕТ; по Повестке движется как человек (победа +
задание)** · D4 ★ по объявлению · **D5 бот выполняет задания своей игрой (§5 проекта), не стремясь** ·
**D6 «Лоббирование» по разыгранным картам проекта (§3.2), ручки `LOBBYING_DIVISOR = 3`,
`LOBBYING_DOUBLE_DIVISOR = 9`** · **D7 Венера → `VENUS`, Веста → `SPACE`, гейт дилера снять** · **D8 не делать** ·
D9 `'none'` без миграции, новые партии — `'politics'` · D10 «первый игрок» — ближайший человек.

---

## 2. Законы этой работы (нарушение = баг, не вкус)

1. **Бот никогда не получает `PlayerInput` из парламента.** Любая парламентская точка, вернувшая промпт для
   места бота, — `throw` (прецедент `AutomaHumanTagReactions.ts:70-72`). Развилки — детерминированно или
   `game.rng` / `pickVictim`.
2. **Вердикты — настоящими правилами, гипотетически и чисто.** Чузер не мутирует парламент: лидер — `leaderOf`
   над синтетическим слотом с добавленным голосом, принимаемая карта — та же арифметика, что `winner()`
   (вынести `winnerAmong(slots)`, `winner()` зовёт её — одна правда, инвариант 7).
3. **Один леджер.** Делегаты бота ставятся `placeVote` с настоящим `seq`, возвращаются теми же шагами, что у
   людей; `assertLedger` держится после каждого хода бота и каждого шага фазы (спек).
4. **Ничего молча** (инвариант 4): каждый несостоявшийся голос / лоббирование / ★ / недостижимое задание
   называет себя — строка журнала с причиной + ветка обзора; «ПРОПУЩЕНО · <награда>» с причиной один раз.
5. **Токены, не текст**: `b.player(bot)`, `b.resolution(id)`, `b.card()`, `b.number()`; никаких предрендеров.
6. **Английский текст = ключ** (инвариант 9): грепнуть по всем `src/locales/ru/*.json` до добавления; чужие
   переводы не трогать; канон глоссария — «победитель голосования», «принята», «председатель», «Бот»,
   РТ/ПО/M€ латиницей.
7. **Лоббирование читает цену РАЗЫГРАННОЙ карты** — никаких дополнительных вскрытий; бонус-карты не лоббируют;
   Failed Action карты проекта лоббирование не гасит (карта разыграна, цена напечатана).
8. **`'none'` = сегодняшнее поведение байт-в-байт**; спек, приколачивающий это, — часть Э0.
9. **Вскрытие ≠ разрешение** остаётся законом бота: ничего в этой работе не «играет» карту сверх штатного
   разрешения; реакторы людей на «any player plays a card» срабатывают ровно как сегодня (негативный тест).
10. **Задание бота — только его ход**: корень `automa-turn` с актором-ботом; политическая фаза (★, Повестка),
    чужая торговля на его колонии, стартовые метки корпорации — не считаются. Человек под корнем бота
    (Solar Logistics) не прогрессирует — как сегодня (спек).
11. **Моушен**: блинков нет; JS-длительности `motionMs()`, holds через реестр, `prefers-reduced-motion`.
12. **Desktop не существует** — вся подача только в консоли.
13. **Ничего не удалять «раз бот участвует»**: гард «бот не в ленте исходов» остаётся, переключившись на аспект
    выплат.

---

## 3. Этапы — строго последовательно, каждый со своей проверкой и коммитом

### Э0 · Шов: аспекты участия и режим `'politics'`

- `BotParliamentMode = 'none' | 'politics'`. `ParliamentAspect = 'delegates' | 'winner-reward' | 'enactment' |
  'party-effects' | 'quest' | 'prompts'`. `BotParliamentPolicy.participates(player, aspect)`;
  `Parliament.participates(player, aspect)` и `participants(game, aspect)`. Люди — всегда true. `NoBotPolitics` —
  всё false для бота. `PoliticsBot` — `delegates` + `winner-reward` + `quest` true, остальное false.
- Каждому вызову из §0.2 — аспект: леджер/лобби/резерв/модель мест → `delegates`; `access`/влияние-как-эффект →
  `party-effects`; цикл мест `stepEffects`, пассив/скидка/ценность/надбавка/действие резолюции, читатели выплат в
  модели/форкасте/BoardInformation → `enactment`; `QuestTracker.eligible` → `quest`; ворота
  (`parliamentGatePending`, `stepGate`, ASK-шаги, ворота задания) → `prompts`; `PlaceDelegatesOnResolution` →
  `delegates` + ветка бота (Э5). Влияние (`Parliament.ts:458`) — считать для всех с `delegates` (Повестка бота
  видна), ПРИМЕНЯТЬ только у `enactment` (читатели выплат уже гейтятся).
- `Parliament.newInstance`: `'politics'` для новых партий; `deserialize` — режим из сохранения как есть.
- Модель: `ParliamentPlayerModel.participates` = аспект `delegates`; новое поле `enactment: boolean` (optional в
  типе — клиентские фикстуры); клиентские читатели выплат (`voteLedgerModel`, `seatParliamentReading`,
  `influenceYieldModel`-гейты, ленты) переходят на `enactment`. Гард `voteLedger.spec` «бот не печатается» —
  переформулировать на `enactment === false`.
- `AutomaSetup.validateOptions`: поле `turmoilRedux` во входе, явная строка «разрешено» в матрице
  совместимости (комментарий на проект).
- **Спеки**: `tests/parliament/BotParliamentPolicy.spec.ts` (таблица режим × аспект); все существующие ветки
  «MarsBot (mode none)» остаются зелёными — где они строят парламент через игру, приколотить режим `'none'`
  явно (хелпер `parliamentArrange` / фикстура получает параметр режима); зеркальные кейсы `'politics'`
  добавляются в Э1–Э3. Сериализация: round-trip обоих режимов; сохранение с `'none'` грузится и ведёт себя как
  сегодня; `ParliamentPhase.spec` 5 поколений под обоими режимами (в `'politics'` без B21 у бота делегат просто
  стоит в лобби — ожидаемо).
- **Результат Э0**: поведение людей не изменилось; бот в новом режиме имеет лобби-делегата и резерв, но ещё не
  голосует и не ведёт задание.

### Э1 · «Party Politics» (B21) + «Лоббирование»

- **Транскрипция**: RB-C стр. 6–7 → `docs/AUTOMA_DATA_AUDIT.md`: строка B21 в §5 с полным официальным текстом,
  новый раздел «§15 Turmoil (RB-C p.6–7) → Redux» = таблица §1 проекта.
- **Данные**: `BonusCardData.ts` B21 — имя и текст правила по §3.1 проекта (описание поведения бота, образец
  B19/B25; официальный хвост про флип не печатать — его роль у Лоббирования); RU в `automa.json`.
- **Сдача**: recurring с 1-го поколения при `turmoilReduxExpansion` (образец B16); `AutomaResearch` подхватывает
  сам. Тест: колода 1-го поколения содержит B21, каждое следующее — тоже; в сброс не уходит.
- **Чузер** `src/server/parliament/BotVoteChooser.ts` — чистая `chooseVoteSlot(parliament, bot, game):
  {slotIndex, rule, deficit}` по §3.3 проекта: `win-now` (дефицит 1) → `closest` (наименьший дефицит —
  симуляция по одному делегату через `leaderOf` над синтетическим слотом + `winnerAmong`, не дальше резерва) →
  ничьи `star` (★ по объявлению, которое `BotWinnerReward` умеет — ОДНА функция-предикат, та же, что в Э2) →
  `fewest-human` («люди» = сумма делегатов всех не-бот, не-нейтральных мест) → `nearest-slot`. Спек — ТАБЛИЦА
  сценариев из §3.3 проекта: пустой стол → слот 0 (и ★ на другом слоте → он); человек 1 на A (слот 1), B пуст
  (слот 0) → B; A у человека 2, на C три нейтральных → C; бот лидирует на B одним, человек на A двумя →
  УСИЛИВАЕТ B, не C (концентрация — главный ассерт); человек в отрыве везде → наименьший дефицит, при равенстве
  ★, затем менее оспариваемая; ничья лидерства по раннему первому делегату (бот вторым — не лидер); повторный
  делегат после первого; мультиплеер (сумма людей).
- **Посадка** — одна функция `placeBotDelegate(game, bot, source: 'lobby' | 'reserve', cause)` (`AutomaPolitics.ts`):
  чузер → (платный: `stock.deduct(MEGACREDITS, PARLIAMENT_VOTE_COST)` ДО посадки) → `placeVote` → лог
  `'${0} placed a delegate on ${1}'` / `'${0} paid ${1} M€ and placed a delegate on ${2}'` + вердикт до/после
  (`winnerAmong`) → `QuestTracker.report(bot, {kind:'delegates', amount: 1})` (аспект `quest` уже открыт в Э0;
  до Э3 адаптер бота ещё не считает — это нормально) → `assertLedger`. Ветка обзору:
  `{key: 'politics:<rule>', params: [резолюция, дефицит]}` — RU-фразы: «становится победителем голосования на
  «{0}»», «ближе всего к победе на «{0}»: не хватает {1}», «… — там награда победителя, которую бот исполнит»,
  «… — там меньше всего делегатов людей», «… — ближайший к принятой слот».
- **Резолвер B21** `AutomaPartyPolitics.ts`, `case B21` → исход `'discard'` (recurring — маршрут оставит в
  холдинге): нет парламента / область пуста → строка, ветка `no-vote`, без Failed Action; лобби, иначе резерв
  (бесплатно), ни того ни другого → строка + ветка `no-delegates`; `placeBotDelegate(..., 'lobby' | 'reserve')`
  без оплаты.
- **Лоббирование** `AutomaLobbying.ts`: райдер в ветке карты проекта `AutomaController.ts:120-139` ПОСЛЕ
  `resolveProjectCard`, до/после `playedPile` — но внутри того же хода и той же группы событий, причина
  `{kind: 'lobbying'}` (новая причина шага обзора, образец `secondary-bonus`). `count = cost % 9 === 0 ? 2 : cost %
  3 === 0 ? 1 : 0` (константы-ручки); для каждого: резерв ≥ 1 и `megaCredits >= PARLIAMENT_VOTE_COST` →
  `placeBotDelegate(..., 'reserve', lobbying)`; иначе строка с причиной (`'… cannot lobby: no delegates in
  reserve'` / `'… not enough M€'`) и стоп. Лог триггера: `'${0}: the cost of ${1} (${2}) is divisible by ${3}'`.
- **Спек распределения** `tests/automa/AutomaLobbying.spec.ts` § «measured»: по реальной колоде проектов партии
  (все модули Redux-стола) посчитать долю карт с `cost % 3 === 0` и `cost % 9 === 0` и НАПЕЧАТАТЬ её в выводе
  спека (без ассерта на число) — документирует, что значат ручки; ассерт только на то, что доли в (0, 1).
- **Спеки**: `AutomaPartyPolitics.spec.ts` (лобби первым и бесплатно; лобби пусто → резерв бесплатно; область
  пуста; `'none'` — B21 не сдаётся); `AutomaLobbying.spec.ts` (цена 12 → 1 делегат −5 M€; цена 18 → 2 делегата
  −10 M€ и список заново для второго; цена 14 → ничего; цена 0 → 1; 4 M€ → строка, не ставит; резерв пуст;
  бонус-карта не лоббирует; Failed-Action карта без меток лоббирует; реакторы людей не задеты;
  сохранение/загрузка после хода; `assertLedger`).
- **Результат Э1**: бот голосует непредсказуемо, его кубы в леджере, человек видит это в журнале и обзоре хода
  (подача в столе Парламента — Э4).

### Э2 · Награда победителя боту

- `stepAgenda` для бота-победителя: `advanceAgenda` как есть; бонус `tr` → `increaseTerraformRating(1, {log})`;
  `card` → `stock.add(MEGACREDITS, 1, {log})` + строка `'${0} gains 1 M€ instead of the card (Automa)'` (грепнуть
  существующие ключи FAQ-замены); никакого `ExternalDrawIntake`. Спек: бот побеждает на шагах «карта» и «РТ».
- Драйвер: шаги победителя для места БЕЗ `enactment` (бот) выполняются отдельным проходом ПОСЛЕ цикла мест
  (порядок «мировые → победитель» сохраняется, `ParliamentPhase.ts:551`), через `src/server/automa/BotWinnerReward.ts`
  по объявлению карты (таблица §4 проекта): `winnerReward.tile ocean|greenery` → `AutomaTilePlacer`; `colony` →
  `AutomaColonies.botBuildColony` бесплатно; `parameter` → подъём с РТ; `tileGrant own-city` → ярус на свой город
  (кандидаты — города бота, `breakTie`); всё через общие пути. Причина бота — `events.beginEffect(bot,
  {kind:'resolution', ...})` в той же группе заседания (`rejoinAction`, `correlationId`), как у людей. Исходы —
  `report()` теми же видами; ключи идемпотентности `appliedBySeat` под местом бота — перезагрузка посреди фазы
  не платит дважды (спек с `stopAt`).
- **Гард** `tests/parliament/BotWinnerReward.spec.ts`: по каталогу — каждая карта с `winnerSteps` / `winnerReward` /
  `tileGrant.recipients.winner` разрешается для бота-победителя без `PlayerInput`; неизвестное объявление —
  красный со списком (worklist).
- **По картам**: RX01 (океан; нет клетки → пропуск), RX03 (озеленение + кислород + РТ за тайл; максимум
  кислорода), RX09 (колония; нет доступных → пропуск), RX23 (+2 температуры с РТ), RX20 (ярус; нет своего
  города → пропуск); RX13/RX04-подобная с ботом-победителем: Повестка есть, выплаты нет, человек получает
  своё; нейтральный победитель — как сегодня; финальное поколение с ботом-победителем.
- **Результат Э2**: победа бота на голосовании имеет цену для человека.

### Э3 · Задание председателя у бота

- `QuestTracker.eligible`: `'automa-turn'` уходит из `FOREIGN_ROOT_CATEGORIES` — проверка «актор корня = игрок»
  уже отсекает человека под ходом бота; спек это ПРИКОЛАЧИВАЕТ (Solar Logistics под ходом бота не двигает
  задание человека). Аспект `quest` бота открыт в Э0.
- **Адаптеры** `src/server/automa/BotQuestEvents.ts` — ОДИН модуль, куда штатные пути бота репортят
  (`QuestTracker.report(bot, …)`), по таблице §5 проекта:
  - `tag` — из `AutomaResolver.resolveProjectCard` ДО цикла меток: `{kind:'tag', tags: printedTags(card)}` (Failed
    Action не гасит; дикая не считается сама — точное совпадение в `match`);
  - `cardsPlayed` — там же: `{kind:'cardsPlayed', cardType: card.type}`;
  - `tile` / `colony` / `trade` / `tr` — общие пути уже репортят по актору (`ParliamentHandler` хуки на
    `Game.addTile`, `Colony.addColony`/`trade`, `increaseTerraformRating`) — ПРОВЕРИТЬ, что они зовутся на путях
    бота (`AutomaTilePlacer`, `AutomaColonies.botBuildColony`/`botTrade`, `AutomaResolver` tr-иконки) и
    проходят `eligible` (корень бота, фаза ACTION); где путь бота обходит хук — добавить репорт рядом;
  - `production` — из `MarsBotBoard.advance` (каждый успешный шаг): `{kind:'production', resource: R, amount: 1}`
    для каждого `R` из `productions` трека (обратная карта `productionToTrack`); регресс не репортит;
  - `cardResource` — из `AutomaColonies.addToStorage` + пул флоатеров: вид = ресурс карты колонии (Миранда →
    животные, Энцелад → бактерии, Титан → флоатеры, Плутон Redux → data — вид взять из определения колонии, не
    захардкодить); чужая торговля на колонии бота — корень человека, не считается сама.
- **Достижимость** `src/common/parliament/botQuestPath.ts`: `botQuestReachable(goal, table): boolean` — вид цели
  без адаптера (`tile spaceCity`) ИЛИ `cardResource` вида, которого ни одна область на столе не хранит →
  false; `ParliamentModel` → у задания `botReachable` (для места бота); гард по каталогу: каждый вид цели
  каждой резолюции имеет либо адаптер, либо явную запись «недостижимо» (worklist).
- **Завершение**: `ChairmanSeat.onQuestCompleted(bot)` — ветка бота: без ворот (`prompts` false), Повестка +1
  (бонус `tr` / 1 M€ по Э2), кресло: резерв → лобби → резолюция по правилу §5 проекта (та карта, снятие с
  которой не меняет `winner()` и лидерство бота; ничья — где у бота меньше делегатов; ничья — дальний слот)
  через `Parliament.removeLatestVote`-путь (`Parliament.ts:601`); журнал — те же строки, что у людей; прежний
  председатель получает делегата обратно; шаг обзора хода «quest-completed». `rebuildPrompts` (`:260`) для
  бота ничего не строит.
- **Спеки** `tests/parliament/BotQuest.spec.ts` + `tests/automa/BotQuestEvents.spec.ts`: по одному кейсу на вид
  цели (метка стройки ×2 двумя картами в разных ходах; тип карты; озеленение; город на Марсе; колония;
  торговля; РТ +3; делегаты 4 через лоббирование; +1 пр. стали = один шаг трека стройки, +3 пр. тепла = три
  шага трека тепла, регресс не считает; животное через Миранду; data через Плутон Redux; space city —
  `botReachable === false` и прогресс не растёт); первый в поколении — бот опережает человека и наоборот;
  кресло из резерва / из лобби / с резолюции; прежний председатель-человек получает делегата; человек под
  корнем бота не прогрессирует; `'none'` — ничего из этого.
- **Результат Э3**: гонка за кресло — с настоящим соперником.

### Э4 · Подача: бот как место за столом

- Зона мест, столбики, бейджи «ПРИНИМАЕТСЯ» / «ЛИДЕР», ИТОГИ «ПОБЕДИТЕЛЬ ГОЛОСОВАНИЯ · Бот», маркер Повестки
  бота, строка бота в гонке задания (N/M или «недостижимо для бота» — новый ключ), кресло с кубом бота, лента
  такта задания «ВЫПОЛНЕНО [куб] Бот · ПРЕДСЕДАТЕЛЬСТВО» — проверить, что модели печатают место с
  `participates` (делегаты) и НЕ печатают его в лентах выплат (`enactment`). Зона «ПАРЛАМЕНТ» Информации: у
  места бота ОДНА строка-объяснение (новый ключ, RU по глоссарию §8 — языком карт).
- **Прилёт чужого куба** (новый бит, `parliamentFlow` + `ConsoleParliamentVotingArea` / `Seats`): дельта голосов
  чужого места (по `seq`, не по счётчику) при открытом обзоре/режиме голосования → куб покидает гнездо этого
  места (лобби, затем резерв) и садится в столбик карты физикой своей посадки; два за ход — друг за другом;
  hold через реестр; reduced-motion — мгновенная посадка без блинка (кроссфейд); закрытый workspace — бита
  нет; работает и для людей-соперников.
- **Обзор хода**: карточка B21 с веткой; шаг «Лоббирование» после карты проекта с причиной (`lobbying`) и
  веткой; шаг «задание выполнено → председательство»; e2e-проверка текста регистронезависимо.
- **Заседание у человека-зрителя**: ★ бота — чужой исход: тайл remote-стейджем, колония — экран колоний
  шагом-показом (RX29-мост), параметр — существующий бит; стадия НАГРАДА зрителю НЕ показывает «ВАША НАГРАДА»
  при победе бота (проверить `quietRewardPose` / ledger DETECT на чужого победителя).
- **e2e** `tests/e2e/console-parliament-bot.spec.ts` + строители `parliament-bot-vote` / `parliament-bot-lobby` /
  `parliament-bot-win` / `parliament-bot-chair` в `tests/e2e/fixtures/generate.ts` (бот + Redux + Colonies;
  колода действий бота форсится генератором напрямую — `automa.actionDeck = [...]`, для лоббирования — карта
  проекта с ценой, делящейся на 3, из реальной колоды; стол — `parliamentArrange`; победа бота — `placeVote`,
  не сдача; задание — стол с заданием «2 метки стройки» и две строительные карты в колоде бота): (1) обзор
  открыт, бот голосует → прилёт куба, столбик, бейдж, журнал; (2) лоббирование двумя делегатами за один ход;
  (3) обзор хода; (4) заседание: ИТОГИ называют бота, ★-океан remote-стейджем; (5) бот выполняет задание →
  лента такта, кресло с его кубом, Повестка; три профиля, `expectFits`, ratchet `waitForTimeout` = 0. Скриншоты
  `screenshots/parliament-bot/<profile>/…`. `npm run e2e:fixtures` переписывает ВСЕ фикстуры — чужие
  откатывать `git checkout`.
- **Результат Э4**: человек за столом видит бота как ещё одного игрока — с кубами, без выплат, с честным
  объяснением «почему сюда».

### Э5 · Колонии Redux у бота

- `ShippingBoardData.ts`: `{colony: VENUS_REDUX, exchangeTag: Tag.VENUS}`, `{colony: VESTA_REDUX, exchangeTag:
  Tag.SPACE}` (комментарий — довод §7 проекта; без Venus Next обмен по `VENUS` игнорируется как иконка
  неиспользуемого дополнения — проверить, что `AutomaColonies` так и делает, иначе — как Титан).
- Снять `ColonyDealer.withoutTilesMarsBotCannotUse`; вместо него гард-спек «у каждого тайла, который дилер может
  сдать боту, есть область». `docs/claude/turmoil-redux-colonies.md` — снять пометку «отложено вместе с
  поддержкой MarsBot»; спеки парламента, фильтрующие `VENUS_REDUX` из-за бота (память
  `turmoil-redux-project-cards`: два спека), — фильтр снять.
- Бот строит/торгует на Венере и Весте по официальной абстракции (2 ресурса в область, −1 M€, печатная награда
  игнорируется); человек торгует там, где колония бота → +1 ресурс боту.
- `PlaceDelegatesOnResolution` для бота: детерминированная посадка `placeBotDelegate` × `count` из резерва без
  оплаты и без промпта, строка журнала та же (недостижимо с колоний — тест напрямую через `game.defer`).
- **Спеки**: `VenusAndShippingData.spec` (две области), дилер с ботом сдаёт Redux-добавления (и
  `customColoniesList` с ними), постройка/торговля бота на обоих тайлах, бонус чужой торговли, ветка бота
  `PlaceDelegatesOnResolution`. e2e колоний Redux (`console-colony-venus`, `console-colony-vesta`) — прогнать: их
  фикстуры без бота не должны измениться.
- **Результат Э5**: стол Redux с ботом получает все три тайла Redux.

### Э6 · Финиш

- Полные прогоны: `npm run test:server`, `npm run test:client`, `npm run build:test` (обязательно — тесты тронуты),
  `npm run lint`, e2e-семейства `console-parliament-*`, `console-bot-*`, `console-colony-*`; юниты — только
  последовательно (память `unit-suites-need-a-quiet-machine`); во время playwright ничего не пересобирать.
- Доки: `docs/TURMOIL_REDUX_MARSBOT.md` — раздел «Статус» (что сдано, как проверено, измеренные доли 3/9,
  честные границы); `docs/TURMOIL_REDUX_SPEC.md` §0.1 — строки решений D1–D10 (одной строкой каждая, со ссылкой
  на проект) и §8 «правила Redux для MarsBot» → закрыто; `docs/AUTOMA_DATA_AUDIT.md` §5/§15 (Э1);
  `docs/README.md` — обновить хвост строки проекта «(статус)»; `docs/claude/marsbot-external-reactions-audit.md` —
  строка про лоббирование (не вскрытие, не второе разрешение); память проекта (`marsbot-turmoil-redux`) — что
  сдано и гочи.
- Коммит на этап, `npm run push` (никогда голый `git push`).

---

## 4. Вне скоупа — не делать, даже если рядом

Эффекты партий для бота; влияние как валюта бота; HARD-делегат при сетапе (D8); C37 / B29; глобальные
события / Chaotic; вехи и награды Redux; классический Turmoil; любая desktop-поверхность.
