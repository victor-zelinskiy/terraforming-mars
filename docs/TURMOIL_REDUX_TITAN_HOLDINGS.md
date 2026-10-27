# TR84 Titan Holdings — рычаг, «включая эти», делегаты по цене с карты, текст по дополнениям

Седьмая из восьми НОВЫХ корпораций Turmoil Redux (реестр `common/cards/turmoilReduxCorporations.ts`). Карта —
`src/server/cards/turmoilRedux/TitanHoldings.ts` (шапка SCAN READING / RULE READINGS), спек правил —
`tests/cards/turmoilRedux/TitanHoldings.spec.ts`, e2e — `tests/e2e/console-titan-holdings.spec.ts` (фикстуры `titan`,
`titan-two`), промт — `docs/claude/prompts/redux-corp-titan-holdings.md`.

**Скан:** 50 M€ + 2 производства M€, метки Земля + Юпитер; ЭФФЕКТ `[планетарная метка] : [рычаг]` — «после розыгрыша
метки Марса, Земли, Венеры, Юпитера или Луны (включая эти) положите 1 рычаг на эту карту»; ДЕЙСТВИЕ двумя строками
`2 [рычаг] → [фигура] OR` / `4 [рычаг] → [фигура][фигура]`. Без ПО, без первого действия, без `compatibility`.

## 1. Новый ресурс карт `Leverage` («рычаг»)

Прошёл по таблице EVA §2 (`docs/TURMOIL_REDUX_EVA_MECHS.md`) — следующей карте с рычагом ничего:

| Слой | Точка |
| --- | --- |
| enum | `CardResource.LEVERAGE = 'Leverage'` (литерал НЕСУЩИЙ) |
| спрайт | `assets/resources/leverage.png` 512² RGBA (семья премиум-спрайтов; `scripts/import-resource-icon.mjs <png> Leverage` — новый общий импорт) |
| легаси-классы | `cards_v2.less` `@card_resource_types` + `resources.less` `@resource_types` (+ `leverage`) |
| клиентские таблицы | `cardResources.ts`, `CardListModel.ts`, `ConsoleExtrasExplorer.vue` (множественное — СВОЙ ключ `Leverage resources`: английское слово неисчисляемое) |
| коммит действия | ничего: `CARD_RESOURCE_NEEDLES` выводит иглу любого ресурса карты из его спрайта |
| причина | `actionReasons.ts` — `'${0} of ${1} leverage on this card'` (RU «из 2 рычагов») |
| локаль | `console.json` «Рычаг», `ui.json` «Рычаги» |

Рычаг — не платёжная единица и не ПО. **Слово «влияние» для него запрещено** (это слово Карьеры и выплат Парламента —
глоссарий §3; гард `parliamentGlossary.spec`: ни одно RU-значение ключа с `leverage` не говорит «влияни»).

## 2. Эффект — один предикат, «включая эти» — тот же хук

`titanTags(card)` — печатные метки из `TITAN_TAGS = [MARS, EARTH, VENUS, JOVIAN, MOON]`, дубли сохраняются, wild — ничего.
Хук `onCardPlayed` кладёт `qty` одним `addResourceTo` (одна запись реакции на розыгрыш); двойник `cardPlayedForecast` —
ОДИН `exact` факт на метку (`reasonTag`, `printedEffect: 0`). «Включая эти»: `Player.playCorporationCardScoped` зовёт
`onCardPlayed(корпорация)` — Titan платит себе 2 тем же хуком (запись реакции с причиной — сама карта), без `addResources`.
Луна в предикате всегда — без дополнения метку Луны не разыграть; меняется только ТЕКСТ (§4).

## 3. Действие — декларативно; два общих закона, закрытых классом

`action: {or: [{spend: {resourcesHere: 2}, sendDelegates 1}, {spend: {resourcesHere: 4}, sendDelegates 2}], autoSelect}`.

- **(а) Предикат знает ветки `or`.** `delegateIsTheActionsResult(card, behavior)` принимает действие ИЛИ одну из его
  `or`-веток. Без этого ветка Titan при пустой области голосования была бы исполнима — «заплатил и не поставил».
  Теперь: ветка отказана (`Executor.canExecute`), причина «Нет резолюций на голосовании» до причины резерва, плитка
  отключена с причиной.
- **(б) Цена-ресурс внутри ответа для ДЕКЛАРАТИВНОЙ ветки.** Executor больше не списывает `spend.resourcesHere` до
  гранта, когда делегат — весь результат: цена передаётся фасаду (`PlaceDelegatesOptions.price`) → Redux
  `PlaceDelegatesOnResolution(…, {price})` (CHECK → PAY → PLACE, журнал «spent 2 [leverage] from Titan Holdings for a
  delegate»); классика платит сразу, как апстрим. Превью (`stepsForBehavior`) строит дверь с той же `price` — превью =
  исполнение. Это та же форма, что у bespoke-переписи (`censusGrant`), теперь даром для любой декларации.
- Резерв 1 при ветке за двух — ветка отказана (собственный гейт резерва Executor: цена за двух покупает двух).
- `resourceRole: {kind: 'delegate', price: 2}` — одна цена за делегата в обеих ветках; `holderActionGood` роли не
  выводит (делегат — не «plain good»), декларация главнее.

Консоль: две печатные строки = ДВЕ плитки «Действий карт» (по строке на ветку, как у переписи); плитка → staged-дверь
`delegateGrant` («Выбрать резолюцию») → Парламент на всю сцену, квитанция `{2|4, leverage}` (`stagedVoteReceiptOf` —
первая цена ветки), цена-ресурс карты — дорога TR15 (`spendDepartsElsewhere`, жетон Парламента).

## 4. Текст по дополнениям — `metadata.textVariants`

Владелец: «…или Луны» — только при включённой Луне. Лицо печатает только иконки; текст живёт в информации карты
(генерируется `make:cards` статично). Механизм — один и общий:

- `CardMetadata.textVariants: [{text, unless: ['moon' | 'venus'], variant}]` (`common/cards/CardTextVariant.ts`;
  `resolveCardText` — самый специфичный вариант, чьи дополнения все выключены). Оба ключа — английские i18n-ключи,
  оба переведены; генератор аудирует их как ключи блока.
- ОДИН клиентский читатель `cardTextFor(key)` (`client/cards/cardTextVariants.ts`): дополнения текущей игры ставит
  `setTranslationContext` (оболочка, на каждом применённом виде), вне игры — печатный текст. Вызывается ПЕРВЫМ в
  `translateText` — досье, «Информация», просмотр, композер получают вариант без правок по месту.
- Подписи `infoText` не перечисляют метки никогда. Гарды: `TitanHoldings.spec` правило 6, клиентский
  `cardTextVariants.spec` (вариант, перевод, RU у каждого варианта).

## 5. Глиф «планетарной метки»

`CardRenderItemType.PLANET_TAG` + `CardRenderer.planetTag()` + ОДИН SVG `assets/misc/planet-tag.svg` (белый диск метки со
стальным ободом, ринговая планета тушью — как на скане), маппинг в `premiumCardIcons.ts`. Луна на лице не рисуется ни при
каких флагах.

## 6. Старт — корпорация платит себе видимо

Отложенный розыгрыш корпорации в очереди стартовой церемонии — тоже дверь «Сработает» (`queueForecastCard` берёт
`kind: 'corp'` рядом с прелюдией): превью розыгрыша корпорации уже несёт её собственные факты (сервер добавляет
разыгранную карту в набор реакторов). Срабатывание приходит по записи сервера (кольцо `cardReactions`).

## 7. Генератор подписей — кадры с одинаковой сигнатурой

Две строки действия Titan имеют один набор значков (`action(res-leverage,delegates)` и `~2`) — токен их не различает.
`applyShortCaptions`: подписи БЕЗ `tokens`, по одной на кадр, ложатся в печатном порядке (порядок автора, не догадка).

## Что наследует следующая карта

- с рычагом — ничего (таблица §1);
- с текстом по дополнениям — `metadata.textVariants` + RU обоих ключей;
- с действием-`or`, где ветка — «N отсюда → делегат» — отказ при пустой области и цена внутри ответа даром.
