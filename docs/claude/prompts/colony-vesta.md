# Промт исполнителю · колония VESTA (Turmoil Redux, добавление) + русское имя дополнения

Выдан 2026-09-29. Третья Redux‑колония после Плутона (замена) и Венеры (добавление). Контракт и чеклист
следующей плитки — **`docs/claude/turmoil-redux-colonies.md` § 4** (пройти все шесть пунктов); образцы —
`src/server/colonies/VenusRedux.ts` (добавление, `isActive = true`, отказ по держателю),
`PlutoRedux.ts` (отказ «нет держателя»), `Titan.ts` (доход‑ресурс на карту, трек `[0,1,1,1,2,2,3]`).
Арт уже в репо: `assets/colonies-planets/vesta.webp` (`a861cb08c2`). MarsBot для этой плитки **не делаем**
(отдельная задача вместе с поддержкой MarsBot для Redux) — но игра не должна падать, см. § 6.

**Что здесь действительно ново — ОДНО:** доход торговли из **нескольких видов ресурса карт** («мехи ИЛИ
астероиды ИЛИ истребители на любую карту, один вид за торговлю»). У колоний сегодня ровно один вид
(`ColonyMetadata.cardResource`), а у резолюций такой юнит уже есть — RX18 Medical Database
(`docs/TURMOIL_REDUX_MEDICAL_DATABASE.md`: «`resources` — СПИСОК везде, один вид = список из одного»;
`AddResourcesToCard(player, [DATA, MICROBE], N)` объединяет держателей всех видов, вид посадки = вид карты;
клиент рисует юнит одним рядом иконок через «или», `ConsoleYieldUnit`). Задача — дать колониям тот же закон,
не вторую грамматику.

---

## 1. Плитка — по скану и правилам

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Colonies\Vesta.png`; правила (лист): *Placement bonus: Gain
5 steel. Colony bonus: Gain 1 steel. Trade income: Add the indicated number of mech, asteroid, or fighter
resources to any card. You can only pick one resource type per trade. Vesta starts active and any player can
place a colony on it, but only players with a card that can accept mech, asteroid, or fighter resources can
trade with it.* Трек: `0 1 1 1 2 2 3`.

- `ColonyName.VESTA = 'Vesta'` — ДОБАВЛЕНИЕ (в `TURMOIL_REDUX_COLONY_NAMES`, НЕ в `TURMOIL_REDUX_REPLACEMENTS`;
  `isTurmoilReduxAddition` выведет сам). Класс `src/server/colonies/Vesta.ts`, `getColonyModule` → `turmoilRedux`.
- `build: {description: 'Gain 5 steel', type: GAIN_RESOURCES, resource: STEEL, quantity: [5, 5, 5]}`;
  `colony: {description: 'Gain 1 steel', type: GAIN_RESOURCES, resource: STEEL}`;
  `trade: {description: 'Add n mechs, asteroids or fighters to ANY card', type: ADD_RESOURCES_TO_CARD,
  quantity: [0, 1, 1, 1, 2, 2, 3]}`; `shouldIncreaseTrack: 'yes'` (один вид дохода, больше — лучше);
  `lore` — печатная фраза плитки слово в слово (EN = ключ i18n): *Vesta was initially used as a mining outpost
  for surrounding asteroids. Then the idea came to use the material on-site rather than spend extra money
  hauling it to distant factories.*
- **`public override isActive = true`** — как у Венеры/Плутона, с комментарием (у Титана/Кайпера ресурсные
  плитки спят до карты; здесь печатное «starts active»).
- **Никакой второй зависимости**: в отличие от Венеры (Venus Next) плитке ничего не нужно — дилер сдаёт её в
  каждую Redux‑партию. Пул растёт на одну плитку → счётчики в спеках (§ 7).

### Правила чтения (каждое — спеком)
1. **Доход = N ресурсов ОДНОГО вида на ОДНУ карту.** Реализация — общий `AddResourcesToCard(player,
   [MECH, ASTEROID, FIGHTER], {count, cause: colonySource})`: кандидаты = держатели любого из трёх видов
   (`getCards` уже принимает список, WARE‑держатель включён), вид посадки = вид выбранной карты. «Один вид
   за торговлю» выполняется ПО ПОСТРОЕНИЮ — второго вопроса «какой вид?» не задавать. Поведение при одном
   кандидате — как у Титана/Плутона сегодня (не менять контракт колоний в этой задаче).
2. **Отказ — БЕЗУСЛОВНЫЙ**, по печатной фразе: нет карты, принимающей хоть один из трёх видов → торговать
   нельзя на ЛЮБОЙ позиции (в т.ч. на нулевой, где доход 0 — у Плутона/Венеры пропуск при `quantity ≤ 0`
   был их печатным «lower positions»/«3–5», у Весты правило о плитке целиком). Ключ:
   `VESTA_NO_HOLDER_REASON = 'No card of yours can hold the mechs, asteroids or fighters this trade pays'`
   (настоящая дизъюнкция — «or» допустимо). Тот же набор кандидатов, что у выплаты. Сервер публикует через
   существующий `colonyTradeBlocks`; клиентские лестницы — без правок. **Решение владельца** — если он
   предпочтёт пропуск на нулевой позиции, поменять одну строку и спек.
3. Массовая торговля (Trade Advance) с отказом — именованный пропуск в журнале; `COPY_TRADE` — плитка
   выключена с причиной; строитель колонии — любой (бонус колонии 1 сталь никого не спрашивает).
4. Сталь бонусов — через `stock.add`/общий `GAIN_RESOURCES` (рекордер, журнал, чипы в рейл — даром).
5. Сериализация: плитка в старом сейве без неё — просто отсутствует (`deserializeAndFilter`), сейв с ней
   грузится; `customColoniesList` с «Vesta» без расширения — отбрасывается (`reduxReplacementFor` → undefined).

## 2. Блок A · сервер — список видов как ДАННЫЕ колонии

- `ColonyMetadata`: **`cardResources?: ReadonlyArray<CardResource>`** рядом с `cardResource` (в `trade.resource`
  список НЕ класть — там массив уже значит «по позициям»). **ОДИН читатель**
  `colonyCardResources(metadata): ReadonlyArray<CardResource>` = `cardResources ?? (cardResource ? [cardResource] : [])`
  в `ColonyMetadata.ts` рядом с `tradeBenefitAt`. Одновидовые плитки не трогать (`cardResource` остаётся их
  объявлением); Веста объявляет только `cardResources`.
- **Компилятор здесь НЕ ворклист** (список не ломает `=== card.resourceType` и `.toString()`), поэтому
  ворклист — таблица ниже + **гард**: `tests/colonies/colonyCardResourceReader.spec.ts` сканирует `src/` на
  сырое чтение `metadata.cardResource` / `.cardResource` вне allow‑листа (сам читатель, `serialize`, экспорт
  манифеста, `InputColonyMetadata`) и падает с файлом и строкой. Читатели сервера:
  `Colony.giveBonusImpl` (ADD_RESOURCES_TO_CARD → список), `Colony.tradeGrantModel` + `ColonyTradeGrantModel`
  (`cardResources?`), `ColoniesHandler.cardActivatesColony` (совпадение с любым видом списка),
  `colonyTradePreview.ts` (`cardTargetFollowUp` → список; `ColonyTradeFollowUpModel.cardTarget.resources?`),
  `export_card_rendering.ts` (белый список полей манифеста — **добавить `cardResources`**, иначе клиент
  не увидит; `npm run make:cards` → `genfiles/colonies.json`).
- `ColonyDescription`: `[VESTA]: 'Mechs, Asteroids & Fighters'` (компилятор заставит).
- `TURMOIL_REDUX_COLONIES_TILES` в `ColonyManifest.ts`; `ColonyDealer` — без гейта (§ 6 про бота).

## 3. Блок B · клиент — юнит из нескольких видов везде, где рисуется ресурс колонии

- **`BenefitGlyph.vue`**: проп‑список видов; ≥ 2 → ряд иконок через «или» той же грамматикой, что
  `ConsoleYieldUnit` (класс `.con-iyield__or` + `iconClassFor` → `card-resource card-resource-<kind>`);
  размеры юнита у парламентских хостов свои (`console_influence_yield.less`) — колониям задать свои, в
  боксе глифа. Плюс **голый класс `.mech` в `card_render_dsl.less`** (рядом с `.fighter`/`.asteroid` —
  BenefitGlyph рисует ресурс голым классом без префикса) и `mech` в `CARD_RESOURCE_CLASSES`
  гарда `tests/styles/resourceIconDefinitions.spec.ts`.
- Все хосты глифа передают список: `ConsoleColonyTile`, `ConsoleColonyTrackInstrument` (три иконки + «или»
  в `__xcell-glyph` — риск геометрии ячейки, проверить 1080 и 4K), `ConsoleColonyInspect` (строка TRADE
  INCOME и правило «только держатели…» в досье — ОДНИМ предложением, § 3‑bis Венеры), `ConsoleColonyFocusStage`,
  `ConsoleColoniesSection`.
- `colonyTradePlan.ts`: `rewardAtPosition` несёт список; `pushBenefit`/`describeBenefit` — чип с иконками
  видов (одна иконка — ложь); `rewardKey` не склеивает разные списки; пакет награды `colonyRewardPackage`.
- **Полёт награды** (`colonyTradeModel.benefitTransferSpec`): вид чипа = `resourceType` ВЫБРАННОЙ карты
  (закон RX18), не «первый из списка»; без цели полёта нет — как сегодня.
- **«Ресурс пропадёт»** (`benefitResourceLost` в FocusStage и дубль в `ConsoleColoniesSection`) →
  `holdsAnyOf(tableau, kinds)` (уже есть в `influenceYieldModel.ts`, WARE включён). У Весты эта строка
  почти не встретится (отказ раньше), но читатель обязан быть честным.
- Шаг выбора карты‑цели (`colonyTradeTargetStep`): иконка каждого кандидата — его собственный
  `resourceType` (уже так при `resource === undefined`); `TradeStep.cardTarget` — список.
- Легаси‑читатель, который ЖИВ: `ColonyTile.vue` (попап колонии в журнале) — научить списку минимально;
  `Colony.vue` (дебаг `/cards`) — не трогать.
- Досье/лобби: лор в архиве (`colonyLore.spec` скоуп + RU), чип дополнения в лобби читает НОВОЕ русское имя (§ 5).

## 4. Блок C · локаль
Перед каждым ключом `grep -rn '"<ключ>"' src/locales/*/*.json`.
- `ru/colonies.json`: `"Vesta": "Веста"`, `"Mechs, Asteroids & Fighters": "Мехи, астероиды и истребители"`,
  `"Gain 5 steel"` / `"Gain 1 steel"` (проверить — ключи почти наверняка уже есть у базовых плиток, не
  дублировать), `"Add n mechs, asteroids or fighters to ANY card": "Добавьте X мехов, астероидов или
  истребителей на любую карту"` (голос — строка Плутона «Добавьте X единиц данных…»), причина
  `"No card of yours can hold the mechs, asteroids or fighters this trade pays": "Ни одна ваша карта не
  принимает мехи, астероиды или истребители, которые платит эта торговля"` (голос — ключи Плутона/Венеры
  рядом). `ua/colonies.json`: имя «Веста» (причины там не ведутся).
- `ru/lore_texts.json` (ключ = EN‑фраза): «Сначала Веста служила горнодобывающим форпостом для окрестных
  астероидов. Потом пришла мысль перерабатывать материал на месте, а не тратить лишние деньги на доставку
  к далёким заводам.» — сверить голос с соседями‑колониями.
- `colonies.less`: `.Vesta-background { url(./assets/colonies-planets/vesta.webp) … }` + `.Vesta-title`
  (образец `.Venus-Redux-*`; акцент — тёплый серо‑бежевый под реголит, не синий). Затем `npm run make:css`.
  Вес `vesta.webp` 253 КБ против ~50 у Венеры — пересжать тем же `import-planet-art.mjs`, если он даёт
  ручку качества; иначе оставить (диск честный).

## 5. Русское имя дополнения (решение владельца 2026-09-29: «Redux» переводится)
Сейчас `"Turmoil Redux": "Кризис Redux"`. Взять **«Кризис: Возвращение»** (предложение; альтернатива —
«Кризис: Перезагрузка»; владелец подтвердит). Точки: `ru/create_game.json` (ключ модуля);
`ru/parliament.json` — `"Turmoil Redux requires Colonies"` (сейчас значение с латиницей!) →
«Кризис: Возвращение» требует дополнение «Колонии»; `"Redux resolutions showcase"` → «Витрина резолюций
«Кризис: Возвращение»»; e2e `tests/e2e/console-colony-pluto-redux.spec.ts:23,155,163` (утверждение чипа
лобби); комментарии `tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts:16` и
`docs/claude/expansion-adaptation-checklist.md:10`; `docs/claude/parliament-glossary.md` — строка про имя
дополнения (если её нет — добавить, гард глоссария `parliamentGlossary.spec` проверить). `ua/create_game.json`
«Турбулентність Redux» → по аналогии «Турбулентність: Повернення» (одной строкой, без ревизии остального UA).
Имена плиток «Pluto Redux»/«Venus Redux» в RU остаются «Плутон»/«Венера» — не трогать.

## 6. MarsBot — не механика, а НЕПАДЕНИЕ (решение владельца требуется)
`shippingAreaFor` знает области только 11 базовых плиток и замен (`TURMOIL_REDUX_REPLACEMENTS` → область
двойника); у ДОБАВЛЕНИЯ области нет, и `AutomaColonies.addToStorage` бросает «has no MarsBot storage area»
на постройке бота, его торговле и его бонусе колонии при торговле человека. Венера падала только с Venus
Next; **Веста без гейта уронит КАЖДУЮ партию MarsBot + Redux**, как только бот её коснётся, и ~30 спеков
парламента на `testAutomaGame({coloniesExtension, turmoilReduxExpansion})` поедут от сдвига сдачи.
**Рекомендация:** структурный гейт в `ColonyDealer` — «Redux‑ДОБАВЛЕНИЕ без области на Shipping Board не
сдаётся за стол с MarsBot» (`gameOptions.automa !== undefined` ∧ `isTurmoilReduxAddition` ∧
`shippingAreaFor(name) === undefined`), с комментарием «снять при поддержке MarsBot для Redux» и спеком; тогда
два ручных фильтра `VENUS_REDUX` в `CloudDevelopment.spec` / `GasExport.spec` УБРАТЬ (гейт делает то же
честно). Это не реализация бота, а отказ сдавать то, чего бот не умеет. Если владелец скажет «нет гейта» —
запасной путь: общий хелпер «снять неподдерживаемые Redux‑добавления со стола» в `tests/parliament` и
вызов в каждом автома‑спеке (третий inline‑фильтр не писать).

## 7. Тесты
**`tests/colonies/Vesta.spec.ts`** по структуре `VenusRedux.spec.ts`: печатная плитка (активна с начала,
модуль, добавление, лор, описание); бонус размещения 5 стали (три берта), бонус колонии 1 сталь (владельцу
кубика при чужой торговле); доход по каждой позиции 0…3 — с держателем мехов / астероидов / истребителей
по очереди; **держатели двух видов → спрашивается карта, и вид = вид карты** (маркер `cardResources` +
`cardResourceByCard` промпта, как у RX18); один держатель — как у Титана; **отказ без держателя на каждой
позиции, включая нулевую**; держатель WARE снимает отказ; отказ в предложении (`disabledColonies` с
причиной) и на сабмите; `colonyTradeBlocks` публикует; Trade Advance — именованный пропуск; COPY_TRADE
выключен; превью торговли несёт список видов в `cardTarget`; дилер: сдаётся с Redux (± Venus Next, ± другие
модули), не сдаётся без; `customColoniesList` «Vesta» без расширения отбрасывается; сериализация ±.
Счётчики в чужих спеках: `VenusRedux.spec.ts:505` 12 → 13, `PlutoRedux.spec.ts:361` 11 → 12.
**Гард читателя** (§ 2). **Клиентские:** `colonyTradePlan.spec` — секция «многовидовой ресурс» (rewardAtPosition,
чип, describeBenefit, ключ пакета, не склеивается с одновидовым); `colonyLore.spec` — скоуп + RU;
`resourceIconDefinitions.spec` — `mech`; `colonyTradeModel` — вид полёта = вид карты‑цели.
**Фикстуры:** `npm run e2e:fixtures` (сдача Redux‑столов сдвинется) + `e2eFixturesLoad.spec.ts`; при гейте § 6 —
спек дилера с MarsBot.
**РОВНО ОДИН e2e** `tests/e2e/console-colony-vesta.spec.ts` (образец `console-colony-pluto-redux.spec.ts`,
solo, `customColoniesList` с Вестой): плитка (три иконки через «или» в ячейке, ✕ с причиной без держателя),
досье (правило одной фразой, вердикт), затем с держателем (карта астероидов в tableau через фикстуру или
гарантию) → торговля → выбор карты → чип летит в ЕЁ виде → сервер: ресурс на карте, маркер; чип
дополнения в лобби читает новое русское имя. Только state‑waits, `{...NO_PAYMENT}`, рэтчет 0.
Прогнать соседей: `console-colony-pluto-redux`, `console-colony-venus-redux` (переименование чипа!).

## 8. Визуальная приёмка (1080 + 4K, ТРИ кадра)
1. Сетка колоний: плитка Весты — диск, ячейка трека «1 [мех] или [астероид] или [истребитель]» не рвёт бокс.
2. Досье (X): лор, TRADE INCOME с тройным юнитом, правило‑отказ одной фразой, вердикт «нет держателя».
3. Фокус‑стейдж с держателем: разбор награды, выбор карты, посадка чипа нужного вида.

## 9. Режим работы
Экономный, **3 коммита**: (1) модель `cardResources` + читатель + гард + все читатели сервера/клиента
(без Весты — гарды зелёные на 12 плитках); (2) Веста: класс, манифест, дилер (+ гейт бота по решению),
локаль, LESS, спеки, фикстуры; (3) переименование дополнения + e2e + документ (§ 6 «Веста» в
`turmoil-redux-colonies.md`: список видов как данные, безусловный отказ, гейт бота). Перед каждым: `npm run
lint`, `build:test` (обе ступени), `make:cards`, `make:json`, `make:css`. **Не пушить.** Хук версии кладёт
`package.json` в коммит — после коммита `git reset -q HEAD -- package.json package-lock.json`. Гочи: `python`
не `python3`; `cross-env` нет; юниты последовательно; новая плитка сдвигает сдачи Redux‑столов — чужой
красный сперва проверить без Весты в манифесте.

В отчёте: решение по § 2 (список — новое поле, читатель, гард), список читателей с подтверждением;
решение владельца по § 6 и что сделано; принятое русское имя и все точки; три кадра; результат e2e соседей.

## 10. Нельзя
Класть список видов в `trade.resource`. Второй вопрос «какой вид?» игроку. Пропускать отказ на позиции 0
без решения владельца. Первая иконка списка как вид полёта. Третий inline‑фильтр `VENUS_REDUX`/`VESTA` в
спеке. Реализовывать Shipping Board для добавлений. Трогать RU‑имена «Плутон»/«Венера». Пуш.
