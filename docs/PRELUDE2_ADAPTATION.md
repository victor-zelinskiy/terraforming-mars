# Prelude 2 — включение в премиум-скоуп, hold-back-список, замена

**Статус 2026-10-30: ЛЕСА ПОСТАВЛЕНЫ · 5 / 54 · СДАНЫ P76 Ishtar Expedition, P85 Summit Logistics (первая политическая), P68 Ceres Tech Market (первая с действием), P80 Red Appeasement (первый розыгрыш-пас) и P78 L1 Trade Terminal (первый пассивный эффект торговли и первый мультивыбор разыгранных карт), остальные — в hold-back-списке.** Модуль `prelude2` добавлен в
`PREMIUM_SCOPE_MODULES` (`src/common/cards/premiumScope.ts`) по образцу классического Turmoil
(`docs/TURMOIL_REDUX_CLASSIC_CARDS.md`, 2026-10-21 → 2026-10-25): скоуп = «модуль минус список», список — ворклист.
Адаптация идёт по одной карте, отдельными задачами, по ворклисту §4; список — временный костыль и удаляется, когда
опустеет (§2.4). **Полное включение дополнения (тумблер в создателе, MarsBot) подтверждается владельцем ОТДЕЛЬНО,
когда адаптированы все карты** — до этого Prelude 2 не предлагается игроку нигде.

Связанные документы: процедура скоупа `docs/claude/expansion-adaptation-checklist.md` (ЧТО значит «карта
адаптирована» — таблица подсистем и гарды); прецедент `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` (§3.2 — контракт
карты-замены, по которому пойдёт Corridors of Power); свод Redux — `Turmoil Redux rulebook v1.0.pdf` p.1 («9 new
Prelude cards (and **1 replacement prelude**)»).

---

## 1. Что такое Prelude 2 в этом форке

- **Манифест** `src/server/cards/prelude2/Prelude2CardManifest.ts`: 24 проекта (P68…P91), 25 прелюдий (P43…P67),
  5 корпораций (PC01…PC05) — 54 карты. Все проекты и часть прелюдий — с `compatibility` (Venus / Colonies / Turmoil).
- **Опция** `prelude2Expansion` есть на сервере (`GameCards` включает манифест по ней), но **в консольном создателе
  тумблера НЕТ** (`createGameMeta.ts` `PREMIUM_EXPANSIONS` — только модули в скоупе; `createGameState.ts` пробрасывает
  `prelude2: on('prelude2')`, которого никто не включает). Автома: `automaCompatibility.ts` объявляет
  `expansion:prelude2` КОНФЛИКТОМ («per the official rules, and out of POC scope») — хвост полного включения (§5).
- **Политические карты** (`compatibility: 'turmoil'`, 14 штук: 11 проектов + 3 прелюдии) под Redux раздаются ТОЛЬКО с
  маркером `politics: 'redux' | 'both'` в манифесте (`CardFactorySpec.isCompatibleWith`); классического Turmoil в
  создателе нет, поэтому адаптация политической карты = и перевод её чтений на `game.politics`, и маркер, одним
  диффом (гард §2.5).
- **Замена**: набор Redux печатает ОДНУ замену прелюдии — скан `…/TM Turmoil Redux/Preludes/Replacement - Corridors
  of Power.png`. Classic Corridors of Power под Redux не раздаётся никогда (§3.2).

---

## 2. Механизм (что сделано 2026-10-29)

### 2.1 Скоуп
`src/common/cards/premiumScope.ts`: `'prelude2'` в `PREMIUM_SCOPE_MODULES`; `inPremiumScope` получил второе
карточное исключение — `case 'prelude2': return !PRELUDE2_CARDS_HELD_BACK.has(name)` (первое — заменённая классика
Turmoil). Все ≈30 гардов и пять исходников читают `inPremiumScope` ПО КАРТЕ (модульный список — лишь предфильтр
манифестов/директорий), поэтому модуль с полным списком ничего не меняет: `make:cards` 0 / 0 / 0, гарды зелёные.

### 2.2 Hold-back-список (ВРЕМЕННЫЙ)
ИМЕНА — `src/common/cards/prelude2Adaptation.ts` (клиент читает скоуп: плейграунд лица, флаги экстракции эффектов /
действий — `src/server` импортировать нельзя); ПРЕДИКАТ и ре-экспорт — `src/server/cards/prelude2/prelude2Adaptation.ts`:

- `PRELUDE2_CARDS_TO_ADAPT_IN_PLACE` — 53 карты (24 проекта + 24 прелюдии + 5 корпораций), с пометкой у каждой:
  номер, гейт, форма (декларативная / bespokePlay / действие / хук / ПОЛИТИЧЕСКАЯ);
- `PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT` — `[CORRIDORS_OF_POWER]`;
- `PRELUDE2_CARDS_HELD_BACK` — объединение, единственное, что читают `GameCards` и `inPremiumScope`;
- `isPrelude2CardHeldBack(name)` — опций не читает: карта списка попадает в колоду только через манифест Prelude 2,
  поэтому ответ один при любом столе.

### 2.3 Раздача
`GameCards.getCards`: `filterHeldBackPrelude2` стоит после `filterBannedCards` / `filterReplacedCards` и **до**
`addCustomCards` — гарантированная карта (`customProjectCards` / `customPreludes` / `customCorporationsList`,
`docs/DEV_GUARANTEED_CARDS.md`) по-прежнему попадает на стол: это dev-путь проверить одну карту до того, как её
строка уйдёт из списка. В dev-пикере создателя карты `prelude2` не предлагаются (модуля нет в `GUARANTEED_MODULES`) —
только API / конфиг.

Список **default-include**: карта манифеста, которой нет в списке, раздаётся и входит во все гарды. Поэтому гард
пинит состав манифеста (54 имени на 2026-10-29): карта, пришедшая с апстрим-синком, роняет его, пока её не
классифицируют.

### 2.4 Конец костыля
Адаптация карты заканчивается **удалением её строки** из списка (и больше ничем в этом файле). Когда уйдёт
последняя строка — удалить `src/common/cards/prelude2Adaptation.ts`, серверный предикат,
`GameCards.filterHeldBackPrelude2` и ветку `case 'prelude2'` в `inPremiumScope`; спек
`tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts` уходит с ними, кроме пина манифеста и раздела замены (как у
Turmoil → `TurmoilReplacementsUnderRedux.spec`). Постоянная часть — строка Corridors of Power в реестре замен (§3.2).
**Тумблер «Prelude 2» в создателе, строка в `DECK_COMPOSITION_EXPANSIONS` и снятие конфликта Автомы — отдельное
решение владельца после последней карты** (§5), не часть удаления списка.

### 2.5 Гарды
`tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts` (13 тестов):
- список называет только карты манифеста Prelude 2, без дублей; два вида строк не пересекаются (замена — ровно
  Corridors of Power);
- состав манифеста пинится (54 имени);
- при открытых гейтах (Prelude + Venus + Colonies + политический движок) раздаётся ровно «манифест − список» — под
  классикой целиком, под Redux политическая карта только с маркером; при выключенном Prelude 2 — ничего;
- гарантированная карта из списка всё равно попадает в колоду (проект, прелюдия, корпорация);
- скоуп читает тот же список; исключение — только для модуля `prelude2`;
- **политическая карта, ушедшая из списка, помечена `politics: 'redux' | 'both'`** (иначе — адаптирована и нигде не
  раздаётся);
- заменяемая карта под Redux не раздаётся ни при каком способе удержания; строка замены, ушедшая без `cardsToRemove`,
  падает.

`tests/cards/premiumScope.spec.ts`: модульный список (11), «манифест минус список», исключение только для `prelude2`,
суженный список держит исключение.

---

## 3. Что значит «адаптирована»

### 3.1 Карта «на месте» (53 карты)
Маршрут — `docs/claude/expansion-adaptation-checklist.md` целиком (таблица подсистем — что нужно карте каждой
формы, и какой гард это требует). Коротко, по форме карты (пометки в списке):
1. **Декларативная** (`behavior` без bespoke) — превью / информация / причины / лицо автоматически; работа —
   лор (`assets/text/lore_texts.json` по `cardNumber`, EN + RU), RU `card_info.json` по аудиту `make:cards`, арт
   (`assets/card-images/<P##>.webp`, при отсутствии — процедурный фолбэк, не гэп), спек карты. Карта с ПОИСКОМ ПО
   МЕТКЕ («draw N X cards» — P76): блок поиска засевается из одного дескриптора, описание со словом «draw» берёт строку
   `ACCEPTED` гарда `cardInformation` (прецедент Aqueduct Systems), а стенд ставится фикстурой с ПОСЕЯННОЙ лентой
   (`stackDeckTop`) — иначе лента и стопка «СБРОШЕННЫЕ» не видны. Журнал серии: `docs/claude/prelude2-cards-progress.md`.
2. **bespokePlay / `play()`** — ко-локированный `cardPlayPreview` (результат показан даже без выбора; каждая цель
   ПОКАЗАНА — Special Permit «украсть 4 растения», Recession «каждый соперник»), `metadata.infoText` по блоку на бонус,
   `skipped`-запись при пустой цели. Розыгрыш, который ЗАКАНЧИВАЕТ ход (P80 — «это считается пасом»): карта объявляет
   `playCountsAsPass`, превью несёт `passes`, композер читает пас тем же чтением, что кнопка «Пас» (реестр CT), а закон
   общий: любое действие, после которого сервер отдаёт ход, уводит экран только через `screenHandoff`.
   Bespoke-половина требования («никто не спасовал») — именованный `unplayableReason` + `requirementFootnote` на лице.
   Bespoke с ПОРОГОМ АВТО-ПРИМЕНЕНИЯ (P78: «≤ 3 кандидатов — кладём молча») — всегда промпт, превью по форме Astra
   (`mergeCardSteps`), а в композере кандидатов не больше мест и каждый — выигрыш → ПОСЕЯНЫ ВСЕ (реестр CU).
3. **Действие** (`ActivePreludeCard` — Board of Directors, Floating Trade Hub, World Government Advisor; активные
   проекты) — `actionPreview` + `actionUnavailableReason`; у Venus Orbital Survey снять строку
   `SAFE_WITHOUT_INFORMATION` в `tests/cards/actionCaption.spec.ts`; правило длиннее бюджета подписи браузера действий —
   курированный `action-short` (P68). Bespoke-действие со СБРОСОМ (P68): `discardOptions()` один на живой промпт и
   шаг превью, `min` — одно число; выплата склада — волной семейства сброса, сцена ухода — даром (реестр CS).
4. **Живой хук** (`onCardPlayed` — Soil Bacteria, Ecotec, Spire, Palladin Shipping, Sagitta; `onColonyAdded` — Colony
   Trade Hub; `onProductionGain` — Suitable Infrastructure; `onResourceAdded` — Main Belt Asteroids;
   `onIncreaseTerraformRating` — Terraforming Deal; `onGlobalParameterIncrease` — Venus Contract) — ДВОЙНИК ПРОГНОЗА
   обязателен (`effectForecastCoverage` / `effectForecastParity` падают с именем карты).
5. **ПОЛИТИЧЕСКАЯ** — чтения через фасад `game.politics` (никакого `Turmoil.getTurmoil`), делегаты через
   `placeDelegates` (Redux — `PlaceDelegatesOnResolution`), требование партии = «правит ИЛИ ≥2 своих делегатов»,
   Кельвинисты = Зелёные (`normalizeParty`), требование председательства — `ChairmanRequirement`; маркер
   `politics: 'redux'` в манифесте; спек карты — таблица Redux через `tests/parliament/parliamentArrange.ts`.
   ⚠ Партия, которая правит / открыта делегатами, даёт и свой ЭФФЕКТ: «Учёные» — «+1 любая метка», и он входит в
   каждый подсчёт меток играбельной карты Учёных (P85 — на 1 M€ больше видимых меток; база называет долю `wild`).
6. **Корпорация** — MarsBot уже играет собственных двойников (Spire — `tests/automa/MarsBotSpire.spec.ts`); человеческая
   карта — отдельная адаптация, бот не трогается.
7. **Удалить строку** из `PRELUDE2_CARDS_TO_ADAPT_IN_PLACE`; прогнать ворклист гардов + `make:cards` (0 / 0 / 0) +
   `make:json`.

Гочи, известные ДО начала (чеклист § gotchas): Focused Organization — `AndOptions`-вложенный `SelectCard` (известный
узкий гэп, премиум-`AndOptions` отложен); Project Eden — три размещения подряд (океан + город + озеленение) в одном
розыгрыше прелюдии; WG Project — «возьми 3 прелюдии, сыграй 1» (reveal-пик прелюдий внутри розыгрыша); Recession —
кросс-игроковая потеря (`crossPlayerCoverageGuard`, уведомления).

### 3.2 Карта-замена (1 карта — Corridors of Power)
Контракт — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2, с поправками на прелюдию:
1. Класс `src/server/cards/turmoilRedux/CorridorsOfPowerRedux.ts`, имя `CardName.CORRIDORS_OF_POWER_REDUX =
   'Corridors of Power:redux'`; регистрация в `preludeCards` Redux-манифеста с `compatibility: 'prelude'` (как TRP1) +
   **`cardsToRemove: [CardName.CORRIDORS_OF_POWER]`**.
2. Реестр замен `src/common/cards/turmoilReduxReplacements.ts` получает `kind: 'prelude'` и строку
   (скан `Preludes/Replacement - Corridors of Power.png`, что меняет); номер — по `replacementCardNumber`
   (следующий после TR77 корпорации; решить при авторстве — порядок номеров ≠ порядок сдачи).
3. Арт и лор — классической карты через `metadata.reimplements: CardName.CORRIDORS_OF_POWER` (ключ `P47`).
4. **Тем же диффом** — строка долой из `PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT`; гард «a replacement that crossed
   stands in cardsToRemove» требует всё вместе. Classic Corridors of Power вне скоупа НАВСЕГДА: после удаления списка
   ветка `case 'prelude2'` в `inPremiumScope` сменяется чтением реестра замен (как у `turmoil`).

---

## 4. Ворклист — 54 карты (состояние 2026-10-30: 49 в списке, P76, P85, P68, P80 и P78 сданы)

| № | Карта | Вид · гейт | Форма | Статус |
| --- | --- | --- | --- | --- |
| P68 | Ceres Tech Market | ACTIVE · Colonies | behavior + bespoke action | СДАНА 2026-10-30 |
| P69 | Cloud Tourism | ACTIVE · Venus | bespokePlay, ПО за 3 флотера | в списке |
| P70 | Colonial Envoys | EVENT · Colonies + ПОЛИТ (Unity) | декларативная, делегат за колонию | в списке |
| P71 | Colonial Representation | ACTIVE · Colonies + ПОЛИТ | декларативная | в списке |
| P72 | Envoys from Venus | EVENT · Venus + ПОЛИТ | декларативная, 2 делегата | в списке |
| P73 | Floating Refinery | ACTIVE · Venus | behavior + bespoke action | в списке |
| P74 | Frontier Town | AUTOMATED · ПОЛИТ (Mars First) | bespokePlay, город | в списке |
| P75 | GHG Shipment | EVENT · ПОЛИТ (Кельвинисты = Зелёные) | декларативная | в списке |
| P76 | Ishtar Expedition | EVENT · Venus | декларативная, поиск по метке | СДАНА 2026-10-29 75d6ce23e4 |
| P77 | Jovian Envoys | EVENT · ПОЛИТ | декларативная, 2 делегата | в списке |
| P78 | L1 Trade Terminal | ACTIVE · Colonies | behavior + bespokePlay | СДАНА 2026-10-30 |
| P79 | Microgravity Nutrition | AUTOMATED · Colonies | bespokePlay | в списке |
| P80 | Red Appeasement | EVENT · ПОЛИТ (Reds) | behavior + bespokePlay | СДАНА 2026-10-30 |
| P81 | Soil Studies | EVENT · Venus + Colonies | декларативная | в списке |
| P82 | Special Permit | EVENT · ПОЛИТ (Greens) | bespokePlay, кража 4 растений (цель ПОКАЗАНА) | в списке |
| P83 | Sponsoring Nation | AUTOMATED · ПОЛИТ | декларативная, 3 РТ + 2 делегата | в списке |
| P84 | Stratospheric Expedition | EVENT · Venus | декларативная | в списке |
| P85 | Summit Logistics | AUTOMATED · ПОЛИТ | декларативная | СДАНА 2026-10-29 |
| P86 | Unexpected Application | EVENT · Venus | декларативная | в списке |
| P87 | Venus Allies | AUTOMATED · Venus + Colonies | декларативная | в списке |
| P88 | Venus Orbital Survey | ACTIVE · Venus | bespoke action (`actionCaption` SAFE-строка) | в списке |
| P89 | Venus Shuttles | ACTIVE · Venus | behavior + bespoke action | в списке |
| P90 | Venus Trade Hub | ACTIVE · Colonies + Venus | эффект-карта | в списке |
| P91 | WG Project | AUTOMATED · ПОЛИТ (председатель) | bespokePlay, 3 прелюдии → 1 | в списке |
| P43 | Applied Science | PRELUDE | декларативная | в списке |
| P44 | Atmospheric Enhancers | PRELUDE · Venus | behavior + bespokePlay | в списке |
| P45 | Board of Directors | PRELUDE | behavior + действие | в списке |
| P46 | Colony Trade Hub | PRELUDE · Colonies | behavior + `onColonyAdded` | в списке |
| P47 | Corridors of Power | PRELUDE · ПОЛИТ | **ЗАМЕНА** (§3.2) | в списке |
| P48 | Early Colonization | PRELUDE · Colonies | behavior + bespokePlay | в списке |
| P49 | Floating Trade Hub | PRELUDE | действие | в списке |
| P50 | Focused Organization | PRELUDE | behavior + действие (AndOptions-гэп) | в списке |
| P51 | High Circles | PRELUDE · ПОЛИТ | `PartyRequirement` + behavior + bespokePlay | в списке |
| P52 | Industrial Complex | PRELUDE | bespokePlay | в списке |
| P53 | Main Belt Asteroids | PRELUDE | bespokePlay + `onResourceAdded` | в списке |
| P54 | Nobel Prize | PRELUDE | behavior + bespokePlay | в списке |
| P55 | Old Mining Colony | PRELUDE · Colonies | behavior + bespokePlay | в списке |
| P56 | Planetary Alliance | PRELUDE · Venus | behavior + bespokePlay | в списке |
| P57 | Preservation Program | PRELUDE | bespokePlay | в списке |
| P58 | Project Eden | PRELUDE | три размещения + сброс 3 | в списке |
| P59 | Recession | PRELUDE | behavior + bespokePlay (кросс-игроковая) | в списке |
| P60 | Rise to Power | PRELUDE · ПОЛИТ | декларативная, 3 делегата | в списке |
| P61 | Soil Bacteria | PRELUDE | behavior + `onCardPlayed` | в списке |
| P62 | Space Lanes | PRELUDE | декларативная | в списке |
| P63 | Suitable Infrastructure | PRELUDE | behavior + `onProductionGain` | в списке |
| P64 | Terraforming Deal | PRELUDE | `onIncreaseTerraformRating` | в списке |
| P65 | Venus Contract | PRELUDE · Venus | behavior + `onGlobalParameterIncrease` | в списке |
| P66 | Venus L1 Shade | PRELUDE · Venus | декларативная | в списке |
| P67 | World Government Advisor | PRELUDE | behavior + действие | в списке |
| PC01 | Nirgal Enterprises | CORP | декларативная | в списке |
| PC02 | Palladin Shipping | CORP | behavior + `onCardPlayed` + действие | в списке |
| PC03 | Sagitta Frontier Services | CORP | behavior + bespokePlay + `onCardPlayed` | в списке |
| PC04 | Ecotec | CORP | behavior + `onCardPlayed` | в списке |
| PC05 | Spire | CORP | `onCardPlayed` (двойник бота есть) | в списке |

Сдавая карту — переписать строку таблицы («СДАНА <дата> <коммит>»), обновить статус-шапку (N / 54).

---

## 5. Хвост полного включения (решение владельца после последней карты)
- Тумблер «Prelude 2» в `PREMIUM_EXPANSIONS` (`createGameMeta.ts`) + зависимость `EXPANSION_REQUIRES` (прелюдии
  Prelude 2 раздаются только с Prelude — `getPreludeCards` без прелюдий откатывается на колоду Prelude 1 ради Valley
  Trust) + строка в `DECK_COMPOSITION_EXPANSIONS` (счётчик колоды).
- Автома: снять конфликт `expansion:prelude2` в `automaCompatibility.ts`, если бот играет с Prelude 2 по правилам
  форка (как Promo / Ares), и покрыть `AutomaCompatibility.spec`.
- Дев-пикер гарантированных карт получает модуль сам (`GUARANTEED_MODULES` = base + `PREMIUM_EXPANSIONS`).
