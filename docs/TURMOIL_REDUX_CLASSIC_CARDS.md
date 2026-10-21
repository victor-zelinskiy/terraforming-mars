# Классические карты Turmoil под Turmoil Redux — включение, hold-back-список, замены

**Статус 2026-10-21: ОБЩИЙ КОД ВКЛЮЧЕНИЯ СДАН. Адаптировано 0 из 22 — все 22 карты в hold-back-списке.**
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
`src/server/cards/turmoil/turmoilReduxAdaptation.ts`:

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
   берут `Turmoil.getTurmoil(game)`; перевод на фасад — ОДНА общая правка при первой из этих карт
   (`influence` → `politics.addInfluenceBonus(player, 1, source)`; `sendDelegates` → Redux-шаг
   `PlaceDelegatesOnResolution` TR03 вместо `SendDelegateToArea`, доступность — `delegatesInReserve`).
   Cultural Metropolis — `bespokePlay` с `Turmoil.getAvailableDelegateCount` + `SendDelegateToArea {count: 2}`
   → тот же Redux-шаг (две фишки на ОДНУ резолюцию — «in 1 party»).
2. **Премиум-скоуп.** Модуль `turmoil` сегодня вне всех SCOPE-точек (`docs/claude/expansion-adaptation-checklist.md`
   — «the frontier»), а SCOPE задаётся **по модулю, не по карте**. Рекомендация: при ПЕРВОЙ адаптированной
   карте добавить `turmoil` во все SCOPE-точки (список — чеклист, шаг 1) и закрыть, что напечатают гарды.
   Ожидание: большинство классических карт декларативны (требование + `behavior`), поэтому гарды должны
   быть почти зелёными; бесподобные — Cultural Metropolis (и четыре заменяемые, которые на месте не
   адаптируются). Альтернатива — держать `turmoil` вне скоупа до последней карты — означает, что первые
   адаптированные карты поедут на стол без превью / причин / инфо-модели; не рекомендуется.
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
6. **Удалить строку** из `TURMOIL_CARDS_TO_ADAPT_IN_PLACE`; гард «with Turmoil Redux on, deals exactly…»
   подтверждает раздачу.

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

## 4. Ворклист — 22 карты (статус на 2026-10-21: все «ждёт»)

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
| Diaspora Movement | зелёная, 7, Юпитер, 1 ПО; Красные; 1 M€ за метку Юпитера в игре | требование партии | скоуп + спек Redux | ждёт |
| GMO Contract | синяя, 3, Микроб + Наука; Зелёные; эффект 2 M€ за метку животного/растения/микроба | требование партии | скоуп + спек Redux | ждёт |
| PR Office | зелёная, 7, Земля; Союз; +1 РТ, 1 M€ за метку Земли | требование партии | скоуп + спек Redux | ждёт |
| Parliament Hall | зелёная, 8, Здание, 1 ПО; Марс прежде всего; +1 пр. M€ за 3 метки Здания | требование партии | скоуп + спек Redux | ждёт |
| Red Tourism Wave | событие, 3, Земля; Красные; 1 M€ за пустую клетку у ваших тайлов | требование партии | скоуп + спек Redux | ждёт |
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

- **Executor `behavior.turmoil`** по-прежнему читает классику — общая правка при первой карте, которой она
  нужна (Event Analysts / Martian Media Center); до неё эти две карты на Redux-столе упали бы на
  `Turmoil.getTurmoil` — поэтому они в списке.
- **Глобальные события / Chaotic Variant** — вне скоупа (спека §1.1).
- **Вехи/награды классики** (Politician, Lobbyist, T. Politician — `compatibility: 'turmoil'` в MA-манифесте)
  — не карты, решаются отдельно (анализ, п. 3).
- **Terraformer = 26** под Turmoil — `Q-12` спеки, не тронуто.
- **Клиент**: `GameSetupDetail.vue` показывает ссылку на рулбук Turmoil только при `expansions.turmoil`;
  под Redux адаптированные классические карты появятся без неё — это десктоп-поверхность, не трогать.
- **Replacement-пролог Corridors of Power** (`prelude2`) — модуль вне скоупа создателя.
