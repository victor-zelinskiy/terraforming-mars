# RX18 · Medical Database (Учёные) — раскладка по НЕСКОЛЬКИМ видам ресурса

**Статус: СДАНА 2026-09-24.** Карта стоит на готовой раскладке RX06 Cloud Development (общий `AddResourcesToCards`,
маркер `cardResourceDistributionPrompt`, шаг `distribute` в `ConsoleTaskHost`, семейство `distributed`) и приносит
одно новое свойство: **единица выплаты бывает ДВУХ ВИДОВ — данные или бактерия**. Это первая карта семейства, где
множество получателей собирается из держателей ДВУХ видов сразу, и первая, где вид каждой единицы определяет КАРТА,
на которую её положили, а не отдельный вопрос игроку.

Печатный текст: *When enacted: Add 1 data or microbe resource to any card for every Science tag you have + Influence.
(Each resource can be different, and can go on a different card.)* Задание председателя: 2 метки науки.
`compatibility` не объявляется — бактерии базовый ресурс, карта раздаётся в каждой партии Redux; держатели данных
(Pathfinders / Луна / Underworld) лишь расширяют круг получателей.

Промт: `docs/claude/prompts/resolution-rx18-medical-database.md`. Файл карты:
`src/server/parliament/resolutions/scientists/MedicalDatabase.ts`.

| | RX06 Cloud Development | **RX18 Medical Database** |
| --- | --- | --- |
| Счётчик | метки Венеры + Юпитера (`venusJovianTags`) | **метки науки (`scienceTags`)** — обычный счёт по одной метке, как RX04 |
| Единица | ОДИН вид (аэростат) | **ДВА вида: данные ИЛИ бактерия** — `unit.resources: [DATA, MICROBE]` |
| Держатели | карты, принимающие аэростаты | **объединение держателей данных и бактерий, порядок табло, без дублей (WARE — держатель любого)** |
| Вид единицы | вид шага | **вид КАРТЫ, принявшей единицу** (`cards[].resource`) |
| Маркер раскладки | `cardResource: 'floater'` | **`cardResources: ['data','microbe']` + `cardResourceByCard: {карта: вид}`; `cardResource` отсутствует** |
| Запись | `resource: FLOATER`, список карт | **`resources: [DATA, MICROBE]` всегда; `resource` — только когда ВСЕ единицы легли одним видом; список с видом на карту** |
| Чтение единицы | одна иконка | **«[данные] или [бактерия]» — одна отрисовка (`ConsoleYieldUnit`), не две строки** |

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id | `RDX_SCIENTISTS_MEDICAL_DATABASE` |
| Каталожный код | **`RX18`** |
| Партия | **Scientists / Учёные** — вторая карта партии (после RX16 Joint Research) |
| Совместимость | не объявляется |
| RU-название | «Медицинская база данных» |
| Арт | `assets/card-images/RX18.webp` (+ thumb; 1536×1024) — `node scripts/import-card-art.mjs "<Mars Arts/Medical Database_art.png>" RX18` → `npm run make:cards` |
| Задание председателя | 2 метки науки (`{goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2}`; на скане — круг науки ×2) |

## 2. Правило, как оно понято

1. **N = метки науки + влияние**, у каждого участника своё. Метки — канонический счётчик проекта в контексте
   принятия (`RESOLUTION_TAG_COUNTING_MODE = 'raw'`): Research даёт 2, универсальная метка — не метка науки.
   Новый id счёта `scienceTags` → `{kind: 'tags', tags: [Tag.SCIENCE]}`; разбивки по меткам нет (метка одна),
   список карт с вкладом каждой (`countedUnits`) объясняет число.
2. **Каждая единица кладётся отдельно и может лечь на свою карту** — `spread: true`, механизм RX06.
3. **Вид единицы следует из КАРТЫ.** У карты один `resourceType`, поэтому «данные или бактерия» — не второй вопрос,
   а объединение держателей: `AddResourcesToCards(player, [DATA, MICROBE], N)` собирает держателей ОБОИХ видов
   (порядок табло, каждый один раз, `CardResource.WARE` — держатель любого), игрок раскладывает, и запись о посадке
   несёт вид ПРИНЯВШЕЙ карты. Карта `WARE` хранит счётчик, а не вид — её единица журналится ресурсом карты
   (`Ware`); отдельный вопрос о виде на ней ничего бы не менял. Спек это закрепляет.
4. **Держателей может не быть вовсе** — выплата названа С ВЕЛИЧИНОЙ и пропадает: «No card can hold data or
   microbes» (`amount: owed`), отдельно от «No science tags and no influence» (`amount: 0`).
5. **Бот** в Парламенте не участвует.

**Факт, определивший план проверки:** в премиум-скоупе нет ни одной карты с ресурсом `DATA` — в обычной партии все
держатели RX18 — карты бактерий, и запись читается как у RX06 (`resource: Microbe`). Ветка данных проверяется
юнитами на синтетической карте (`fakeCard({resourceType: DATA})`), смешанный случай — на стенде (реальные карты
Pathfinders в клиентском манифесте: Martian Culture, Cryptocurrency).

## 3. Блок A — сервер: общий слой над СПИСКОМ видов

| Слой | Что заведено |
| --- | --- |
| `AddResourcesToCard` | конструктор принимает `CardResource \| ReadonlyArray<CardResource> \| undefined`; `resourceTypes` — список (один вид = список из одного), геттер `resourceType` отвечает ОДНИМ видом только для списка из одного; `getCards()` — держатели ЛЮБОГО из видов (`holdsOneOf`, WARE включён); маркер `resourceGainPrompt` при нескольких видах (или «любой») несёт `cardResources` (виды по порядку объявления) и `cardResourceByCard` (вид каждого кандидата — его собственный) |
| `AddResourcesToCards` | то же над списком; пустой список — ошибка конструктора; пик-форма строится над ТЕМ ЖЕ списком; `ResourcePlacement` += `resource` (вид принявшей карты, `holderResourceOf`); маркер раскладки: один вид — `cardResource`, несколько — `cardResources` + `cardResourceByCard` |
| Хелперы (в `AddResourcesToCard.ts`) | `cardResourceKinds` (нормализация аргумента), `holdsOneOf`, `holderResourceOf`, `holderResourceIcons` — ОДНО место, откуда и пик, и раскладка знают, что такое «держатель списка видов» |
| Объявление | `InfluenceYieldUnit` `{kind: 'cardResource', resources: ReadonlyArray<CardResource>, spread?}` — `resource` → `resources` ВЕЗДЕ (Aquifer, Cloud Development — списки из одного); второго вида объявления нет |
| Запись | `SerializedEnactOutcome` / `ParliamentEnactOutcomeModel`: `resources?` (виды по объявлению), `cards[].resource?` (вид карты); `resource` — один вид, когда все единицы легли им |
| Адрес | `RewardPayload.resources?`, `cards[].resource?` (свой, иначе один вид записи) |
| Старые вызывающие | Cyanobacteria, Communication Boom, Colonial Affairs, RX06 — сигнатура та же (один вид), поведение байт-в-байт (`AddResourcesToCards.spec` «one kind as a list of one»); RX06 и RX07 теперь пишут вид на карту в список записи |

Шаг карты (`RESOURCES_STEP`, ключ `resources`): счёт и величина фиксируются в `ctx.state` (`resourcesCount` /
`resourcesOwed`); N = 0 — пропуск «No science tags and no influence»; `step.getCards().length === 0` — пропуск с
величиной; иначе общий шаг решает форму, а `andThen(placed)` пишет одну запись: `resources: [DATA, MICROBE]`,
`cards: [{card, amount, resource}]`, `resource` при одном виде посадки, `card` при одной карте. Журнальные строки:
`${0} placed ${1} resource(s) from ${2}: ${3} science tag(s) + ${4} influence`, посадка на карту — штатная строка
`addResourceTo` с ресурсом КАРТЫ (`RESOURCE`-токен: `Microbe` / `Data` / `Ware`).

## 4. Блок B — чтения

- **Единица из двух видов — ОДНА отрисовка.** `YieldIcon {family: 'card-resource', resources}`; компонент
  `ConsoleYieldUnit` (`classes: string[]`) рисует один вид тем самым `<i class="con-iyield__unit">`, что и раньше
  (без обёртки — соседские селекторы хостов живы), несколько — иконки через `<small class="con-iyield__or">или</small>`
  (ключ `or` — существующий). Блок `ConsoleInfluenceYield` печатает так формулу, результат, суффикс «если победите»,
  голову платы и нетто; лента заседания (`ConsoleParliamentBand`) — плиту пропуска (`units`); итоги
  (`parliamentResultsModel.units` + `ConsoleParliamentSitting`) — агрегат части и значок вида у каждой карты списка.
- **Панель голосования**: «[метка науки] 2 + [влияние] 1 → +3 [данные] или [бактерия]», суффикс «+1 если победите».
  Бюджет слов панели (28) карта проходит — гард каталога `voteInfoBudget`.
- **Честная нота «нет получателя»** читает держателей ЛЮБОГО из видов (`holdsAnyOf`, WARE включён):
  «нет подходящей карты — данные или бактерии пропадут»; компактная — причина сервера «Нет карты, принимающей данные
  или бактерии». `noRecipientReasonKey` / `noRecipientForecastKey` принимают СПИСОК видов (список из одного — прежние
  строки).
- **Полёт чипов** — по виду КАРТЫ: `ResolutionPayoutTarget.resource` (свой из записи, иначе один вид записи);
  запись без вида ни на записи, ни на карте не летит (`detectResolutionPayout` → undefined) — чип не носит иконку, за
  которую не ручается.
- **Шаг раскладки** (`ConsoleTaskHost`): лента-счётчик на карте и строка «Ресурсы на этой карте» носят вид ЭТОЙ карты
  (`spreadResourceOf` → `cardResourceByCard[card] ?? cardResource`); источник-док находит эффект по любому из видов
  (`scaledEffectForCardResource(resolution, cardResources ?? cardResource)`); обычный пик над списком читает вид
  кандидата из `cardResourceByCard` (`consolePlayedTargetPreview`).
- **Осмотр «Для вас»** — правило «Считается каждая метка науки: карта с двумя метками даёт 2. Универсальные метки не
  считаются.» + учтённые карты с вкладом (общая ветка `tags`).

## 5. Блок C — шаг раскладки и стенд

Шаг переиспользован целиком. Сетка получателей — держатели обоих видов, каждый с иконкой своего вида на ленте
счётчика; подтвердить неполную раскладку нельзя на четырёх уровнях (бар, обработчик, строитель ответа, сервер) — в
строке статуса «Осталось разложить: N»; LB/RB/RT как в RX06; вырожденный случай «держатели одного вида» — обычная
раскладка без следов второго вида (в маркере виды всё равно оба: это свойство ШАГА, а у карт — свой).

**Стенд «Полигон»** — семейство `distributed`; сценарий несёт `holds` (виды, которые принимают его держатели) и
показывается только закону, чья единица покрывает все эти виды: сценарии RX06 (`holds: [FLOATER]`) не видны под
RX18, и наоборот; при смене закона внутри семейства стенд открывает первый сценарий нового закона (`scenarioList`
watcher). Сценарии RX18: смешанный (Research + GHG Producing Bacteria + Martian Culture: 3 метки + 1 → 4 на держателя
бактерий и держателя данных), только бактерии, только данные, две метки на одной карте, универсальная метка, один
держатель (пик), нет держателя (названо с величиной), ноль, запись, живой `parliament-medical-enact`. Держатели
стенда — `holdersAt(resources, i)` над клиентским манифестом (WARE включён), запись стенда — вид на карту и
`resource` только при одном виде посадки.

## 6. Блок D — лицо, фикстуры, e2e

- **Лицо** по скану: «[данные] OR [бактерия] / [метка науки] + [влияние]» (`b.resource(DATA).or().resource(MICROBE)
  .slash().tag(SCIENCE).plus().influence()`); сноска задания — метка науки ×2.
- **Фикстуры** (`tests/e2e/fixtures/generate.ts`, `medicalTable`): `parliament-medical-vote` (синий — GHG Producing
  Bacteria + Regolith Eaters, Повестка 2 = влияние 1; красный — Tardigrades, Повестка 5) и `parliament-medical-enact`
  (фаза остановлена ВНУТРИ раскладки синего: 4 единицы на два держателя бактерий, маркер с обоими видами; красному —
  пик 3 на Tardigrades). Стол: Учёные / Mars First / Индустриалисты через `seatResolution`.
- **РОВНО ОДИН e2e** `tests/e2e/console-parliament-medical.spec.ts` (standard-1080): лицо (данные OR бактерия /
  наука + влияние, эмблема Учёных, RX18); панель «[наука] 2 + [влияние] 1 → +3» с единицей из двух иконок через
  «или», суффикс +1; осмотр — правило и учтённые карты; раскладка внутри заседания — счётчики с нуля, RB → «+1» с
  иконкой бактерии на ленте карты, **A на неполной раскладке не шлёт запрос**, строка статуса называет остаток, RB +
  RT → 2/2, коммит ОДНИМ запросом, два чипа `+2` с бактерией, капсулы тикают до 2/2, табло сервера согласно; пик
  красного; итоги; запись: `resources: [Data, Microbe]`, `resource: Microbe`, список `{card, amount, resource}`.
  Отдельный describe — стенд: смешанный сценарий, единица из двух видов, сценарии RX06 не перечислены.

## 7. Проверка

- Серверные юниты `tests/parliament/MedicalDatabase.spec.ts` (23): каталог и объявление, формула, семейство; счёт по
  меткам науки (Research 2, вердикт карты без метки, универсальная метка, паритет с каноном по корпусу); форма вопроса
  (N = 1 над держателями двух видов — пик над обоими с маркером видов и картой→вид; один держатель N = 3 — показанный
  пик; распределение над объединением держателей в порядке табло с маркером, таблицей ПО, без применения); смешанная
  посадка (единицы по виду карты, журнал с ресурсом карты, запись без `resource`, с `resources` и списком с видами);
  посадка одним видом (`resource: MICROBE`); держатель WARE; сумма ≠ N отвергается; каждому своё; нейтральный
  победитель; два пропуска; reload внутри раскладки и внутри пика; задание, модель, бот, финальный счёт.
- `tests/deferredActions/AddResourcesToCards.spec.ts` (+6) и `AddResourcesToCard.spec.ts` (+1): список из одного =
  прежнее поведение; объединение держателей; посадка по виду карты; WARE; неверная сумма; пик над списком; пустой
  список.
- Гард `ResolutionContract.spec`; регрессия `CloudDevelopment`, `AquiferContest`, `ColonialAffairs`,
  `CentralPowerGrid` (перечисление id счёта), `rewardAddress`, `Parliament*`, `QuestTracker`, `ChairmanQuestGate`,
  `PartyPresentation`, `RetiredResolutions`, `Cyanobacteria`, `CommunicationBoom`, `Will`, `NobelLabs`, глоссарий,
  `e2eFixturesLoad`, `resolutionCounts`, `JovianTaxRights` — зелёная.
- Клиентские юниты `tests/client/components/console/MedicalDatabaseReadings.spec.ts` (9): манифест, представление
  счёта, иконка из двух видов и поиск эффекта по любому из них, нота «нет получателя» над списком, блок с «или» (RX06 —
  одна иконка без «или»), компонент единицы, полёт смешанной записи (и отказ без вида), адрес и итоги с видами;
  `influenceYieldModel`, `consoleResolutionPayout`, `parliamentResults`, `voteInfoBudget`, `ConsoleInfluenceYield` —
  зелёные.
- ОДИН e2e — § 6.

### Находки

- **Два ключа уже были в `parliament.json`**: «Play 2 science tags» (задание другой сущности) и «No card can hold data
  or microbes» (отказ действия партии Учёных, `PartyEffects.ts`) — пропуск карты разделяет его перевод («Ни одна карта
  не хранит данные или бактерии»), своя строка не заводилась. Дубликат в ОДНОМ файле ловит `npm run lint:i18n`
  (`translation_audit`), а не `make:json` (JSON.parse сворачивает повтор молча) — гонять аудит, не только сборку.
- **Корневой комментарий в `<template>` делает однокорневой компонент фрагментом** — `ConsoleYieldUnit` держит
  комментарий в `<script>`, чтобы один вид рендерился голым `<i>` (соседские селекторы хостов).
- **Журнал посадки несёт ресурс токеном `RESOURCE`**, не строкой — спек проверяет `LogMessageDataType.RESOURCE`.
- **`fakeCard` не переживает reload** (`Card [Data Vault] not found` в `Game.deserialize`) — сценарии с
  сохранением строятся на реальных картах; виды маркера при этом всё равно оба.
- Стенд: сценарий семейства должен объявлять `holds`, иначе он показывается под каждым законом семейства — RX06
  под RX18 читался бы «держателей нет».
