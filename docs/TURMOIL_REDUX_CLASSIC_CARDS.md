# Классические карты Turmoil под Turmoil Redux — включение, hold-back-список, замены

**Статус 2026-10-22: ОБЩИЙ КОД ВКЛЮЧЕНИЯ СДАН. Адаптировано 5 из 22 — T04 Diaspora Movement (первая, с ней — правило
скоупа «модуль минус список» и Executor на фасаде), T06 GMO Contract (первая с живым эффектом — двойник прогноза),
T09 PR Office (декларативная: РТ + счёт меток Земли; `infoText` по блоку на бонус), T08 Parliament Hall
(декларативная: пр. M€ за каждые 3 метки Зданий — блок засеян генератором, `infoText` не нужен), T12 Red Tourism
Wave (первая, чей результат — МНОЖЕСТВО КЛЕТОК: счётная доля несёт свои клетки, L3 показывает их на поле); 17 карт в
hold-back-списке.**
Адаптация идёт по одной карте, отдельными задачами, по ворклисту §4; список — временный костыль и
удаляется, когда опустеет (§2.3).

Связанные документы: спека `docs/TURMOIL_REDUX_SPEC.md` §1.1 (строка «Классические карты Turmoil») и §3.1
(уточнение 2026-10-21); план `docs/TURMOIL_REDUX_ITERATION0_PLAN.md` §2.1 (п. 3 — маркер `politics`, который
для карт манифеста Turmoil НЕ используется); анализ `docs/TURMOIL_REDUX_ANALYSIS.md` («Содержимое манифеста
Turmoil»); чеклист карты набора `docs/claude/turmoil-redux-card-checklist.md` §0; процедура скоупа
`docs/claude/expansion-adaptation-checklist.md`.

---

## 1. Правило набора

Рулбук Turmoil Redux v1.0:

- **p.1, состав**: «70 new Project cards (and **6 replacement projects**)», «8 new Corporation cards (and
  **1 replacement corporation**)», «9 new Prelude cards (and 1 replacement prelude)», «2 new Colony tiles (and
  1 replacement tile)».
- **p.12, сетап**: «If you are playing with the official Turmoil expansion, remove the **Septem Tribus**
  corporation card from it. It is not compatible with Turmoil Redux, and is thus replaced in this expansion.
  Shuffle the project, corporation, and prelude cards into the appropriate decks.»

Вывод: карты официального Turmoil **играются вместе с Redux** (проекты и корпорации — в общие колоды), семь
из них **заменены** Redux-версиями (сканы «Replacement - …»), глобальные события — только в Chaotic Variant
(вне скоупа: при Redux `game.turmoil` не создаётся, `GlobalEventDealer` не строится). Replacement-пролог
(Corridors of Power) — карта модуля `prelude2`, который вне скоупа создателя; здесь не рассматривается.

---

## 2. Механизм (что сделано 2026-10-21)

### 2.1 Включение
`src/server/GameCards.ts`: строка манифеста Turmoil стала
`[gameOptions.turmoilExtension || gameOptions.turmoilReduxExpansion, TURMOIL_CARD_MANIFEST]`. Под Redux
манифест участвует в сборке колод (проекты, корпорации) наравне с остальными; его `globalEvents` этот класс
не читает.

### 2.2 Hold-back-список (ВРЕМЕННЫЙ)
ИМЕНА — `src/common/cards/turmoilReduxAdaptation.ts` (с T04: их читает и премиум-скоуп на обеих сторонах, см. §3.1 п. 2);
ПРЕДИКАТ по `GameOptions` и ре-экспорт тех же массивов — `src/server/cards/turmoil/turmoilReduxAdaptation.ts`:

- `TURMOIL_CARDS_TO_ADAPT_IN_PLACE` — 11 проектов + 4 корпорации, которые остаются теми же картами и
  адаптируются на месте;
- `TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` — 6 проектов + Septem Tribus, которые набор ЗАМЕНЯЕТ;
- `TURMOIL_CARDS_HELD_BACK_UNDER_REDUX` — объединение, единственное, что читает `GameCards`;
- `isTurmoilCardHeldBackUnderRedux(name, options)` — `true` только при `turmoilReduxExpansion && !turmoilExtension`
  (единственная легальная конфигурация Redux — `Game.newInstance` отказывает обоим сразу).

`GameCards.filterHeldBackUnderRedux` стоит после `filterBannedCards` / `filterReplacedCards` и **до**
`addCustomCards`: гарантированная карта (`customProjectCards` / `customCorporationsList`,
`docs/DEV_GUARANTEED_CARDS.md`) по-прежнему попадает на Redux-стол — это dev-путь проверить одну карту до
того, как её строка уйдёт из списка.

**Почему список, а не маркер `politics` на записях манифеста (спека §3.1 / план §2.1 п. 3).** Решение
владельца 2026-10-21: отдельный список-ворклист, по которому идут по одной карте; маркер `politics`
остаётся для записей `compatibility: 'turmoil'` ДРУГИХ модулей (prelude2, moon, pathfinders, ceo, community,
underworld, starwars — их `isCompatibleWith` не изменился). Цена решения: список **default-include** — карта
манифеста Turmoil, которой нет в списке, раздаётся под Redux. Поэтому гард пинит состав манифеста (22 имени
на 2026-10-21): карта, пришедшая с апстрим-синком, роняет его, пока её не классифицируют (строка в список
либо адаптация).

### 2.3 Конец костыля
Адаптация карты заканчивается **удалением её строки** из списка (и больше ничем в этом файле). Когда уйдёт
последняя строка — удалить файл и `GameCards.filterHeldBackUnderRedux`; спек
`tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts` уходит вместе с ними, кроме раздела «the replacements»
(постоянный факт набора, см. 2.4).

### 2.4 Замены (ПОСТОЯННАЯ часть)
`src/server/cards/turmoilRedux/classicReplacements.ts` — реестр семи заменяемых карт: классическое имя, вид,
скан (относительно `…/TM Turmoil Redux/`), что меняет замена (прочитано со сканов 2026-10-21). Классическая
версия **никогда** не попадает в колоду Redux: до замены её держит список, после — `cardsToRemove`
Redux-манифеста (механизм апстрима, `GameCards.filterReplacedCards`). Контракт замены — §3.2.

### 2.5 Гарды
`tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts` (12 тестов):
- список называет только карты манифеста Turmoil, без дублей; «на месте» и «замена» не пересекаются и
  согласованы с реестром замен;
- состав манифеста пинится (22 имени) — новая карта апстрима должна быть классифицирована;
- под Redux раздаётся ровно «манифест − список» (сейчас — ничего), под классикой — весь манифест, без
  движка — ничего; предикат отвечает только за Redux-стол;
- гарантированная карта из списка всё равно попадает в колоду;
- заменяемая карта не раздаётся под Redux ни при каком способе удержания; строка замены, ушедшая из списка
  без `cardsToRemove`, падает.

`tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts` обновлён: reserved-гард читает реестр замен (под
классическим именем Redux-манифест карту не регистрирует); тест «adds nothing to the deck when the expansion
is off» допускает в разнице только адаптированные классические карты.

---

## 3. Что значит «адаптирована»

### 3.1 Карта «на месте» (15 карт)
1. **Политика — через фасад `game.politics`** (`src/server/politics/PoliticalOps.ts`), не `Turmoil.getTurmoil`.
   Требования `party` / `chairman` / `partyLeader` уже идут через фасад (`PartyRequirement`,
   `ChairmanRequirement`, `PartyLeadersRequirement`) — у семи карт с одним требованием политической работы на
   сервере нет. Что читает классику напрямую: **Executor** для `behavior.turmoil.influenceBonus` (Event
   Analysts) и `behavior.turmoil.sendDelegates` (Martian Media Center) — `Executor.ts` `canExecute` / `execute`
   брали `Turmoil.getTurmoil(game)`. **СДЕЛАНО с T04 (2026-10-21):** Executor читает только `game.politics` —
   `canExecute`: `delegatesInReserve(player) < count`; `execute`: `addInfluenceBonus(player, 1, card.name)` и новый
   глагол фасада `placeDelegates(player, count, {oneParty, source})` (Redux — `PlaceDelegatesOnResolution` TR03, одна
   выдача N на одну резолюцию или N выдач по одному для `manyParties`; классика — `SendDelegateToArea` апстрима без
   изменений). Спек `tests/behavior/ExecutorPolitics.spec.ts` (оба стола, `fakeCard`). Строки Event Analysts / Martian
   Media Center / Cultural Metropolis в списке ОСТАЮТСЯ — путь движка готов, их лицо / спек / превью — их задачи.
   Cultural Metropolis — `bespokePlay` с `Turmoil.getAvailableDelegateCount` + `SendDelegateToArea {count: 2}`
   → тот же Redux-шаг (две фишки на ОДНУ резолюцию — «in 1 party»).
2. **Премиум-скоуп = «премиум-модули ∪ (`turmoil` − список)».** (Решение T04, 2026-10-21.) SCOPE задавался ПО МОДУЛЮ, и
   `'turmoil'` в каждом литерале ввёл бы все 22 карты (4 корпорации и 4 бесподобные среди них) в каждый гард разом —
   против «по одной». Теперь ОДИН хелпер `src/common/cards/premiumScope.ts`: `PREMIUM_SCOPE_MODULES` (девять +
   `turmoil`), `PREMIUM_FACE_SCOPE_MODULES` (+ `ceo` — каталог лица), `inPremiumScope({module, name}, modules?)` —
   модуль в списке И не (классическая карта, ещё стоящая в hold-back-списке). Все ≈ 30 гардов и пять исходников
   (`buildCardInformation`, `PremiumCardsPlayground.vue`, `actionExtraction` / `effectExtraction`, `audit_card_art`)
   читают его; гард `tests/cards/premiumScope.spec.ts` отказывает любому рукописному списку модулей в `src/` и `tests/`.
   **Ворклист и скоуп — один объект**: карта входит во все гарды в момент, когда её строка покидает список, — тем же
   удалением, что раздаёт её на стол Redux. Гарды печатают работу (у T04 — одна RU-строка `card_info`).
3. **Лор, арт, инфо-модель, RU.** RU-имена классических карт уже есть в `cards.json`; лор — `assets/text/lore_texts.json` по
   `metadata.cardNumber` карты апстрима;
   `card_info.json` — по аудиту `make:cards`.
4. **Спек карты** получает таблицу Redux: `testGame(n, {turmoilReduxExpansion: true, coloniesExtension: true})`,
   сетап парламента — только через `tests/parliament/parliamentArrange.ts` (`seatResolution` / `seatEnacted`),
   никогда голой записью в слот (правило tests.md «TURMOIL REDUX: A SPEC OR A FIXTURE NEVER ASSUMES THE DEAL»).
   Требование партии в Redux — «правит ИЛИ ≥2 своих делегатов на её резолюции»; Кельвинисты = Зелёные
   (`normalizeParty`).
5. **MarsBot.** Четыре корпорации без политики уже играются ботом как его собственные
   (`console-bot-corp-*.spec.ts`); человеческая версия — отдельная карта, бот не трогается.
6. **Карта с ЭФФЕКТОМ (живой хук `onCardPlayed` / `onCardPlayedByAnyPlayer` / …) — двойник прогноза ОБЯЗАТЕЛЕН** (T06): `cardPlayedForecast` в файле карты читает те же предикаты, что хук (гарды `effectForecastCoverage` /
   `effectForecastParity` падают с именем карты); хук, платящий ЗА МЕТКУ, называет каждую метку отдельным фактом с
   `reasonTag` — сцена розыгрыша рождает ответ стола на печатной метке сыгранной карты
   (`docs/claude/console/resource-transfer.md` §3). Порядок — по живому отложенному (`player.defer` = `AFTER_CARD`,
   `GainResourcesDeferred` = `AFTER_CARD_GAIN`).
7. **Удалить строку** из `TURMOIL_CARDS_TO_ADAPT_IN_PLACE` (`src/common/cards/…`); гард «with Turmoil Redux on, deals exactly…»
   подтверждает раздачу, а пин «the adapted cards, as of the last adaptation» — НАЗВАННЫЙ набор адаптированных (обновить
   его тем же диффом). Дальше прогнать ворклист гардов (чеклист карты §3) и `make:cards`.

### 3.2 Карта-замена (7 карт)
1. **Класс** в `src/server/cards/turmoilRedux/<Name>Redux.ts` (`Card` / `ActionCard` / корпорация), имя
   `CardName.<X>_REDUX = '<X>:redux'` — прецедент апстрима для одноимённой перепечатки: `DEIMOS_DOWN_PROMO =
   'Deimos Down:promo'`, `CAPITAL_ARES = 'Capital:ares'`; клиент режет суффикс для показа
   (`name.split(':')[0]` — журнал, финальный счёт, чипы, лог). Проверить каждое место, где имя карты —
   ключ (лор, арт, RU-имя, `CardRenames`).
2. **Регистрация** в `TURMOIL_REDUX_CARD_MANIFEST` + **`cardsToRemove: [CardName.<X>]`** там же (классическая
   карта уходит из колоды Redux навсегда; под классикой Redux-манифест не включён, поэтому классика цела).
3. **ТЕМ ЖЕ диффом** — строка `CardName.<X>` долой из `TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` (гард «a
   replacement that has crossed stands in the Redux manifest's cardsToRemove» требует всё вместе).
4. **Номер-ключ арта/лора.** Сканы печатают «TR00» у всех шести; `TR01…TR70` заняты, гард манифеста пинит
   `TR\d{2}` в 1…70 — расширить его осознанно (например, `TR71…TR77` в порядке списка или отдельный
   префикс), не переиспользуя номер. Лор Political Alliance уже придуман
   (`docs/claude/turmoil-redux-invented-lore.md`).
5. Reserved-гард: под классическим именем в Redux-манифесте карту зарегистрировать нельзя.
6. Septem Tribus — корпорация с НОВОЙ механикой («кубы на знамёнах партий» → эффект партии): резерв
   `grantPartyEffect` в `PoliticalOps`; требование карты эффект, выданный картой, НЕ выполняет (FAQ p.19,
   `docs/TURMOIL_REDUX_COUNCIL_SEAT.md` §2). Сначала инфраструктура сквозным контрактом, потом карта
   (чеклист §0).

---

## 4. Ворклист — 22 карты (статус на 2026-10-22: 3 сданы, 19 ждут)

Политическая зависимость — что карта читает СЕГОДНЯ (upstream-код). «Путь» — §3.1 или §3.2.

### 4.1 Замены (§3.2) — 6 проектов + 1 корпорация

| Карта | Классика | Политика сегодня | Что меняет замена (скан) | Статус |
| --- | --- | --- | --- | --- |
| Aerial Lenses | зелёная, 2, −1 ПО; Кельвинисты; −2 растения любому, +2 пр. тепла | требование партии | партия → **Учёные** (не Зелёные по общему правилу); стоимость 2 → 3; метка Науки; **−1 ПО убран** | ждёт |
| Banned Delegate | событие, 0; председатель; убрать любого НЕ-лидера | `chairman` + `bespokePlay` (`Turmoil.getTurmoil`, `SelectDelegate`) | «любой делегат с резолюции или из области Народной поддержки» — без оговорки о лидере | ждёт |
| Political Alliance | событие, 4; 2 лидера партий; +1 РТ | `partyLeader: 2` (фасад `partiesLedBy`) | стоимость 4 → 2; «больше всех делегатов на 2 резолюциях сразу» (ничья — кто поставил первым; нейтральные не считаются — это и есть `partiesLedBy`); +1 РТ → **1 шаг Карьеры** | ждёт |
| Recruitment | событие, 2; обмен НЕЙТРАЛЬНОГО НЕ-лидера на своего из запаса | `bespokePlay` (`Turmoil`, `SendDelegateToArea {replace: 'NEUTRAL'}`) | «нейтральный делегат на резолюции» ↔ свой из запаса; без оговорки о лидере; только резолюции | ждёт |
| Sponsored Mohole | зелёная, 5, Здание; Кельвинисты; +2 пр. тепла | требование партии | партия → **Зелёные** (напечатано); **+1 ПО** | ждёт |
| Vote of No Confidence | событие, 5; 1 лидер партии + НЕЙТРАЛЬНЫЙ председатель; заменить его своим, +1 РТ | `partyLeader: 1` + `bespokePlay` (`Turmoil.chairman`, запас) | требование → **≥1 влияния**; снимается ТЕКУЩИЙ председатель, чей бы он ни был (делегат игрока тоже); +1 РТ → **1 шаг Карьеры** | ждёт |
| Septem Tribus (корп.) | 36 M€, wild; действие: 2 M€ за партию с ≥1 делегатом | `compatibility: 'turmoil'`; `Turmoil.parties` | **40 M€**; действие убрано; первое действие — куб на знамя любой партии; эффект: победа на резолюции → куб на знамя её партии; эффект каждой партии с вашим кубом (сверх правящей и дороги 2 делегатов) | ждёт |

### 4.2 На месте (§3.1) — 11 проектов + 4 корпорации

| Карта | Классика | Политика сегодня | Работа | Статус |
| --- | --- | --- | --- | --- |
| Diaspora Movement | зелёная, 7, Юпитер, 1 ПО; Красные; 1 M€ за метку Юпитера в игре | требование партии | скоуп + спек Redux | **СДАНА T04** (2026-10-21): `cardNumber` `TO4`→`T04` (опечатка апстрима — лор/арт ключуются номером), RU описания, арт, лор, спек Redux-стола (15), e2e `console-classic-diaspora` |
| GMO Contract | синяя, 3, Микроб + Наука; Зелёные; эффект 2 M€ за метку животного/растения/микроба | требование партии | скоуп + спек Redux | **СДАНА T06** (2026-10-21): двойник прогноза `cardPlayedForecast` — ОДИН факт на каждую подходящую печатную метку (`reasonTag`, форма Марсианского университета), `AFTER_CARD` (хук откладывает через `player.defer` на `Priority.DEFAULT`); `effect-short`; RU требования и эффекта в голосе набора; арт, лор EN (точка) + RU; спек Redux-стола (21); e2e `console-classic-gmo-contract` — ответ стола ЛЕТИТ с печатной метки сыгранной карты на чернила M€ |
| PR Office | зелёная, 7, Земля; Союз; +1 РТ, 1 M€ за метку Земли | требование партии | скоуп + спек Redux | **СДАНА T09** (2026-10-22): `metadata.infoText` — блок на бонус («Gain 1 TR.» · «Gain 1 M€ for each Earth tag you have, including this.»: декларативный РТ рядом со СЧЁТНЫМ запасом генератор помечает `behavior-partial` → `needsCuration`); RU требования и эффекта в голосе набора («Союз» — «его резолюции»); арт, лор EN владельца + RU; спек Redux-стола (19: две дороги, РТ + M€ за СВОИ метки Земли, порядок журнала движка — запас, затем РТ, вето RX42 по имени, RX35 голый РТ не трогает, бот, save / load); своего e2e нет (класс «РТ розыгрыша» доказан) — розыгрыш входит клеткой G в стенд полётов `console-action-price-fold` (раздел реестра BY) |
| Parliament Hall | зелёная, 8, Здание, 1 ПО; Марс прежде всего; +1 пр. M€ за 3 метки Здания | требование партии | скоуп + спек Redux | **СДАНА T08** (2026-10-22): правила без правок (`production.megacredits {tag: BUILDING, per: 3}` — Counter считает СВОИ метки Зданий, эта включена, пол по 3); инфо-модель — блок ЗАСЕЯН генератором (одиночное счётное производство — `seeded`, не `needsCuration`: в отличие от T09 `infoText` не нужен), RU блока в `card_info`; RU требования и эффекта в голосе набора («Марс вперёд» — «её резолюции»); арт, лор EN владельца + RU; спек Redux-стола (20: две дороги, 2/5/1 + эта → +1/+2/0, чужие не считаются, свой wild — да, метка события — нет, журнал `production-changed` от карты, 1 ПО, прогноз с базисом и ЧЕСТНЫЙ НОЛЬ, бот, save / load); своего e2e нет — 80 % задачи — финал «счёт приходит светом» (раздел реестра BZ) |
| Red Tourism Wave | событие, 3, Земля; Красные; 1 M€ за пустую клетку у ваших тайлов | требование партии | скоуп + спек Redux | **СДАНА T12** (2026-10-22): правила без правок (`bespokePlay` → `getAdjacentEmptySpacesCount`, статику читает награда Tourist — не тронута); co-located `cardPlayPreview` + `countedPlayForecast` — ОДНА фишка «+N M€» с базисом «Пустые клетки рядом с вашими тайлами» и его КЛЕТКАМИ (`ActionEffectBasis.spaces` — новое поле класса: одночленный счёт со своими клетками; `peekGroupsOf` читает его одной группой → L3 «Показать на поле»), ноль назван словами (`ActionEffectBasis.zero` — «Рядом с вашими тайлами нет пустых клеток»); Hermetic Order of Mars читает тот же обход (`RedTourismWave.emptyAreasGain`) — его клетки даром; `infoText` (блок Hermetic'а), RU в голосе набора («тайлы», не «жетоны»), лор EN владельца + RU, арт; спек Redux-стола (24: две дороги, 6/8/7, один раз на клетку, ограниченная/колония/занятая не считаются, чужие тайлы — нет, честный ноль, журнал, статика = клетки = Tourist, превью = результат, бот, save / load); e2e карты `console-classic-red-tourism` (новая проводка peek) — 75 % задачи — полёты «жетон никогда не красится под поверхностью, на которую садится» (раздел реестра CA) |
| Supported Research | зелёная, 3, Наука; Учёные; добор 2 | требование партии | скоуп + спек Redux | ждёт |
| Wildlife Dome | зелёная, 15, Животное + Растение + Здание; Зелёные; озеленение | требование партии | скоуп + спек Redux | ждёт |
| Public Celebrations | событие, 8, 2 ПО; председатель | `chairman` (фасад) | скоуп + спек Redux | ждёт |
| Event Analysts | синяя, 5, Наука; Учёные; +1 влияние | `behavior.turmoil.influenceBonus` — **Executor читает `Turmoil.getTurmoil`** | общая правка Executor → `politics.addInfluenceBonus`; влияние в Redux = Карьера + бонусы карт | ждёт |
| Martian Media Center | синяя, 7, Здание; Марс прежде всего; +2 пр. M€; действие 3 M€ → делегат | `behavior.turmoil.sendDelegates` — **Executor читает `Turmoil.getTurmoil`** | общая правка Executor → `PlaceDelegatesOnResolution` (TR03), доступность по `delegatesInReserve` | ждёт |
| Cultural Metropolis | зелёная, 20, Город + Здание; Союз; −1 пр. энергии, +3 пр. M€, город, 2 делегата в 1 партию | `bespokePlay`: `Turmoil.getAvailableDelegateCount`, `SendDelegateToArea {count: 2}` | 2 фишки на ОДНУ резолюцию через TR03-шаг; `cardPlayPreview` хост | ждёт |
| Lakefront Resorts (корп.) | Здание; нет политики | — | премиум-адаптация (лор, инфо-модель, превью) | ждёт |
| Pristar (корп.) | нет политики | — | премиум-адаптация | ждёт |
| TerraLabs Research (корп.) | Наука + Земля; нет политики | — | премиум-адаптация | ждёт |
| Utopia Invest (корп.) | Здание; нет политики | — | премиум-адаптация | ждёт |

---

## 5. Не сделано / открыто

- ~~**Executor `behavior.turmoil`** читает классику~~ — **сделано с T04** (§3.1 п. 1). Event Analysts / Martian Media
  Center / Cultural Metropolis остаются в списке до своих задач (лицо, спек Redux-стола, превью; у Cultural Metropolis —
  перевод `bespokePlay` на тот же глагол фасада `placeDelegates` с `oneParty: true`).
- **Расхождение номера с апстримом**: `DiasporaMovement.ts` печатает `'T04'`, апстрим — `'TO4'` (буква O). При синке
  взять форковое значение (иначе лор/арт T04 перестанут находиться).
- **Глобальные события / Chaotic Variant** — вне скоупа (спека §1.1).
- **Вехи/награды классики** (Politician, Lobbyist, T. Politician — `compatibility: 'turmoil'` в MA-манифесте)
  — не карты, решаются отдельно (анализ, п. 3).
- **Terraformer = 26** под Turmoil — `Q-12` спеки, не тронуто.
- **Клиент**: `GameSetupDetail.vue` показывает ссылку на рулбук Turmoil только при `expansions.turmoil`;
  под Redux адаптированные классические карты появятся без неё — это десктоп-поверхность, не трогать.
- **Replacement-пролог Corridors of Power** (`prelude2`) — модуль вне скоупа создателя.
