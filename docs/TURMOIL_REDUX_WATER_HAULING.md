# TR06 · Water Hauling («Перевозка воды») — с картой ТОРГУЮТ: контракт «карты-причала»

**Статус: сдана 2026-10-01** — сервер (`d60dd3fc12`), карта (`4bc3b91c50`), клиент (`5a3138a3ad`), e2e + документы (4/4).
Девятая карта проектов набора Turmoil Redux и ПЕРВАЯ из класса «карта-причал» (TR06 · TR26 UNMI Liner · TR27 Aurora
Station): карта — ещё одно НАЗНАЧЕНИЕ торгового действия рядом с тайлами колоний.

Печатный текст: «Effect: Once per generation, when you trade, you can send the trade fleet to this card to place an
ocean tile.» + «Gain an extra trade fleet.» Стоимость 12, ACTIVE, метки Земля + Космос, требования и ПО нет.
Лор: «Water is worth more than gold when you're dealing with an arid planet.» → «Вода дороже золота, когда имеешь
дело с засушливой планетой.»

Файлы: `src/server/cards/turmoilRedux/WaterHauling.ts`, `src/server/colonies/{ITradeDestination, FleetDock,
FleetDockDestination, tradeDoor, tradePerformed, tradeFleetGain}.ts`. Спеки: `tests/cards/turmoilRedux/WaterHauling.spec.ts`
(правила 1–10), `tests/colonies/FleetDock.spec.ts` (класс, на тестовом причале с наградой TR26-формы),
`tests/inputs/SelectColony.spec.ts` § two forms, `tests/routes/ApiGameColonyTradePreview.spec.ts` § dock,
`tests/models/skippedEffectRecord.spec.ts` § Sky Docks, `tests/parliament/QuestTracker.spec.ts` § deferred root.

---

## 0. Решения владельца

| Вопрос | Решение |
| --- | --- |
| Чтение правила | **по своду** (2026-10-01): карта = назначение торговли, плата обычная, колония не участвует |
| RU-имя | «Перевозка воды» (по умолчанию — подтвердить в отчёте) |
| Где стоят причалы | в workspace колоний ОТДЕЛЬНОЙ колонкой «ПРИЧАЛЫ» рядом с сеткой планет |
| После океана | workspace колоний не возвращается (завершённый flow уходит) |

## 1. Чтение правила — три источника и один выведенный пункт

- **FAQ, с. 19:** «…can other players send their trade fleets to it? — No. Only the player that played those cards
  is allowed to **trade with them**.»
- **Союз, с. 3:** «…to trade for free. **If you use this to trade with a colony track**, you may advance it 1 step
  before the trade.» — оговорка осмысленна, только если торговать можно и не с колонией.
- **Текст карты:** «send **the** trade fleet» — флот ЭТОЙ торговли (Aurora Station печатает ту же фразу и флота не даёт).
- **Выведено, не напечатано:** плата вносится как за любую торговлю («when you trade» = торговое действие);
  бесплатно — только бесплатным путём (действие Союза, мех Беспилотных конвоев).

Правила чтения 1–10 — в шапке файла карты, каждое закреплено спеком карты.

## 2. `ITradeDestination` — пути оплаты не знают слова «причал»

```ts
// src/server/colonies/ITradeDestination.ts
type TradeDestinationSource = {kind: 'colony'; name: ColonyName} | {kind: 'card'; card: CardName};   // = формы EventSource
interface ITradeDestination {
  readonly tradeSource: TradeDestinationSource;                              // чем путь называет назначение и чему пишет скидку
  tradeBlockedReason(player, terms?: number | TradeTerms): string | undefined; // СВОЙ гейт назначения (до оплаты)
  trade(player, tradeOptions?: TradeOptions, bonusTradeOffset?: number): void;
}
```

- `IColony extends ITradeDestination` (поведение побайтно прежнее), `FleetDockDestination(card)` — второе.
- `IColonyTrader.trade(destination)`: во всех девяти путях поменялись ТИП и токен лога
  (`MessageBuilder.tradeDestination` — колония как COLONY, причал как CARD) и аргумент скидки
  (`recordTradeDiscount(…, destination.tradeSource, …)` → `tradeDiscountSaved: [{colony | dock, resource, amount}]`).
  `Colony.trade` не тронут. Спек-таблица «путь × причал» (12 строк) — `FleetDock.spec.ts`.
- **«Торговля состоялась»** — модуль `tradePerformed.ts`: `reportTrade` (задание председателя) и
  `payTradeFlatBonuses` (Venus Trade Hub; список `tradeFlatBonuses` читают и превью). Это ДВА вызова, а не один:
  колония держит их в прежних точках (порядок её событий не изменился), причал зовёт в том же порядке вокруг посадки.

## 3. `FleetDock` — co-located контракт класса

```ts
// ICard.fleetDock?: FleetDock   (в файле карты — инвариант 8)
type FleetDock = {
  rewardBlockedReason?(player): string | undefined;        // блокер НАГРАДЫ (океаны кончились); занятость считает модуль
  previewEffects(player): ReadonlyArray<ActionEffect>;      // чипы current → resulting, без мутаций
  previewFollowUps?(player): ReadonlyArray<ColonyTradeFollowUpModel>; // что награда СПРОСИТ (TR27: cardTarget)
  receive(player): void;                                    // сама награда — зовётся ПОСЛЕ посадки флота
};
```

Модуль владеет общим: состояние `card.data = {dockedGeneration}` (занято ⇔ `=== game.generation`, сбрасывать не
нужно; старый сейв без `data` = свободный причал), `fleetDockOffers(player)` (карты табло ВЛАДЕЛЬЦА; одна причина в
порядке «флот уже на карте» → `rewardBlockedReason`), `dockFleet` (штамп, `usedTradeFleets++`, событие
`fleet-docked`, затем `receive` — под источником карты). ⚠ `FleetDock.ts` импортирует ТОЛЬКО типы: его читает
`ModelUtils` до появления классов карт; посадка и назначение живут в `FleetDockDestination.ts` (иначе цикл импортов
через `ParliamentHandler`). По той же причине пик и обёртка двери — в `tradeDoor.ts`, не в `ColoniesHandler`.

## 4. Пик назначения и вторая форма ответа

- `tradeDestinationPick(player, title, label, terms, onDestination)` = `ColoniesHandler.tradeColonyPick` + маркер
  **`SelectColonyModel.fleetDocks: [{card, available, reason?, effects}]`**. Пик с НУЛЁМ колоний и свободным причалом
  — законный промпт.
- Ответ: `{type: 'colony', colonyName}` **или** `{type: 'colony', fleetDock: CardName}` — ровно одно поле
  (`isSelectColonyResponse`). Причал обязан быть `available` в маркере ЭТОГО промпта (иначе `InputError` с его
  причиной) и повторно судится ЖИВЬЁМ перед обработчиком двери — всё ДО оплаты.
- `tradeThrough(player, trader, destination, {headline})` — одна обёртка всех дверей: корень
  `beginAction(destination.tradeSource, {category: 'colony'})`; заголовок пишет только торговое действие
  («traded with …» / «sent a trade fleet to …»), у двери карты заголовок — строка её пути, как и раньше.
- Двери на пике назначения: торговое действие (`Colonies.tradeWithColony`), TR66, TFLP, Союз (запертый путь главной
  двери). **Гэп (вне скоупа, не расширять):** Darkside Smugglers' Union, Collegium Copernicus, Huygens Observatory
  остаются на `tradeColonyPick`; первые две спрашивают `canTrade({colonyOnly: true})`, чтобы свободный причал не
  открыл им пустой пик.

## 5. Гейт торговли

`tradeBlockedReason()`: эмбарго → нет свободного флота → **нет открытой колонии И нет доступного причала** (тогда
причина колоний, как раньше). `potentialTradeCount()` = `min(колонии + доступные причалы, свободные флоты)`.

## 6. Событие, модель, превью

- `GameEvent 'fleet-docked'` (`player`, `target.card`, источник — карта, journal). Журнал: строка под картой
  «[флот] −1» (`journalEventChild`), корень группы — заголовок «${0} sent a trade fleet to ${1}».
- `CardModel.fleetDocked?: Color` — ЦВЕТ владельца флота (лицо рисует знак в его ливрее), публично, для любого
  зрителя, пока поколение не сменилось.
- `GET api/game/colony-trade-preview?id&dock=<card>` → `FleetDockPreviewModel {card, available, reason?,
  megacreditsPayment?, energyMix?, effects, followUps, flatBonuses?}`; `colony` и `dock` взаимоисключающи; чужая /
  не-причал карта → 204. Платёжная часть — один строитель `tradePaymentPreview` на оба превью.

## 7. Два классовых исправления, найденных картой

1. **«Получите торговый флот» на пределе 4** (`behavior.colonies.addTradeFleet`; в скоупе Sky Docks, Space Port,
   Space Port Colony): чип превью «флотов N → N+1» / «4 → 4 · предел» + предупреждение, после розыгрыша —
   `effect-skipped` теми же словами (`colonies/tradeFleetGain.ts`).
2. **Отложенный шаг внутри `withSource` терял корень действия**: `captureContext` берёт только верхнюю область,
   `currentRoot()` отвечал «ничьё действие», и РТ отложенного океана (причала, бонуса колонии) не шёл в задание
   председателя, хотя тот же прирост «сразу» — шёл. Не-корневая область теперь помнит корень (`EventContext.root`).

Сдвиг сид-сдачи Redux (новая карта в колоде): два спека `ParliamentPhase.spec.ts` починены классом — нейтральное
лидерство СЧИТАЕТСЯ, колода бота пуста и на его открывающем ходу.

RU: семь строк платы пути потеряли «с колонией на» (их токен назначения теперь колония ИЛИ карта) — осознанная правка
чужих переводов, все использования — только эти логи.

## 8. Клиент — ОДИН flow от обзора колоний до океана

**Колонка «ПРИЧАЛЫ»** (`ConsoleColoniesSection` → `.con-colonies__docks`, плитка `ConsoleFleetDockTile`). Не слот сетки
планет: раскладки сетки спроектированы по числу тайлов, а колонка — узкий столбец справа (`--con-colonies-docks-w`
8rem, на Deck 7rem). Ширина — токен, поэтому фит сетки (`fit()`) просто измеряет то, что осталось; карточки
колонки делят её высоту (`fitDocks` → `--con-dock-zoom`). Источник — `fleetDockModel.fleetDockViews`: карты табло
ЗРИТЕЛЯ с `ClientCard.fleetDock` (экспорт `make:cards`) + вердикт живого пика (`SelectColonyModel.fleetDocks` →
`TradeColonyContext.docks`); вне окна торговли — публичная модель (`CardModel.fleetDocked`). Колонки нет в
пиках, где действие — не торговля (постройка, сетап, каталог). Плитка = премиум-лицо карты + одна строка статуса
(свободен · «Флот на карте · вернётся в следующем поколении» · причина) — через ТУ ЖЕ лестницу, что тайл колонии
(`fleetDockReason` → `colonyTradeReason`: причал = всегда активное назначение без визитёра, его собственный отказ —
`colonyBlock`). Ход на плитке не читается (как у колонии).

**Курсор** — второй зоной кольца обзора (`colonyCursorStep`, чистая функция): ▶ с последней плитки ряда входит в
колонку на высоте ряда, ◀ возвращает на ту же плитку, ↑/↓ ходят по колонке с ощутимым краем. Индекс сетки не
трогается, пока курсор в колонке. X на причале — штатный осмотр карты (живая модель, знак флота на ▲). Торговля
без открытых колоний: вход «Торговля» жив, обзор открывается с курсором на свободном причале
(`landColonyCursorOnTradeable`).

**Стейдж причала** (`ConsoleFleetDockStage`, `colonyFocusState.dock`). Сосед фокус-стейджа колонии в том же
регионе на тех же хуках спуска: плитка — источник раскрытия, карта — несомый объект (`data-colony-focus-planet` на
НЕзумленной обёртке: FLIP-транслейт внутри CSS `zoom` масштабируется). Герой — полное премиум-лицо. Пути оплаты —
ТЕ ЖЕ ряды и ТА ЖЕ модель, что у колонии (`ConsoleTradePayRows` + `tradePayModel`; фокус-стейдж колонии переведён на
них же), шаг оплаты M€ и микс Delta Works — общие `paymentPlan` + `ConsolePaymentPanel`. РЕЗУЛЬТАТ — только чипы
сервера (превью `?dock=`, на проводе — маркер пика) + флот «2 → 1» + нота `'After confirming: place an ocean
tile'`. Крошка «КОЛОНИИ › ПЕРЕВОЗКА ВОДЫ › ТОРГОВЛЯ», стейдж себя не титулует. Грамматика: ОДИН глагол A, метка
следует за курсором и публикуется в `fleetDockUi` (на другом пути — «Выбрать», на строке оплаты — «Выбрать», на
выбранном пути — «Торговать» или «Продолжить к оплате» при нескольких миксах; курсор сам ничего не выбирает) ·
X «Осмотреть» карту · B «Назад». Отказ — ОДНА причина на стейдже (`[data-fleet-dock-verdict]`), A мёртв.
Голый пик двери карты (`pickMode`) отвечает `{type: 'colony', fleetDock}` один.

**Подтверждение** — шелл `onFleetDockConfirm`: стражи двойного нажатия, ОДИН строитель батча
(`buildTradeBatch({fleetDock})` → `tradeDestinationResponse`), квитанция (`holdPresentation`: путь оплаты и чипы
прибиты на границе коммита), `armTradeFleet({kind: 'card', card})`, `submitBatch`. `armColonyTrade` не армится,
исход не клеймится. Отказ сервера: флот возвращается (батарея abort), стейдж отдаётся как был (`fleet.active`
падает без посева сцены).

**Полёт** — тот же директор и тот же слой, цель — карта (`TradeFleetTarget`; `colonyName` остаётся колониальной
половиной цели, поэтому ни один читатель колонии не изменился). Лестница ИЗМЕРЕННЫХ якорей: ▲ на лице-герое стейджа
(`.con-fleetdock [data-fleet-berth="card:…"]`) → ▲ на плитке колонки → нет rect: полёта нет, фазы идут, гейт
разрешается. ⚠ **Найдено картой и закрыто классом**: быстрый сервер отвечал (~200 мс), пока слой ещё мерил якоря
rAF-пробником (на медленном кадре 4K), и `runTradeFleet` без директора отпускал гейт через 120 мс — вид
применялся, корабль так и не взлетал. Теперь слой объявляет окно измерения (`setTradeFleetLaunchPending`), гейт в
нём ждёт директора (сеть `LAUNCH_WAIT_MS` 1.5 с), а пробник тикает на `probeTick`. Колониальная торговля
получает ту же починку (её кадры и тайминги не менялись — исправлена только гонка, в которой полёт пропадал).

**Знак флота на лице** (B5): `CardModel.fleetDocked` = цвет ВЛАДЕЛЬЦА (не `true`) → `PremiumCard` отдаёт
состояние причала инъекцией (`premiumFleetDock.ts`), `PremiumFleetMark` монтируется ТОЛЬКО на узле ▲ печатного
`trade` и только у карты-причала: слот `[data-fleet-berth="card:<имя>"]` — absolute, ноль лейаута, всегда разложен
(посадочный якорь), флот в нём — `ColonyFleetIcon` в ливрее владельца (тот же корабль, что прокси полёта: кроссфейд
прокси → знак без подмены картинки; PNG `trade-fleet.png` не принял бы ливрею без `filter`, который консоль
вырезает). Виден везде, где видна карта; карта не тускнеет. Обозреватель эффектов — плашка состояния
«Флот на карте · вернётся в следующем поколении». Отдельный компонент — потому что computed/inject в КАЖДОМ узле
механики дорожали монтирование лица (замер A/B — см. отчёт).

**Сцена после посадки и уход в размещение** (`fleetDockScene.ts`). Blocking-холд `'trade-fleet-dock'`
(`diagnose` + `expire`) сеется в `gameTransport.seedRewardHolds` — тем же блоком, что apply, и только пока стоит
стейдж этой карты; admission `placement` ждёт его. Фазы: `seeded` → **answer** (импульс коммита по печатному
«▲ : [океан]», значок океана отвечает один раз — `runActionCommitMotion`, kind `global`) → **read** (680 мс — ритм
CARDLAND колонии) → **leave** (карта уходит ТАКТОМ, знак флота — с ней) → **conclude**: `flow-complete` →
шелл `onFleetDockFlowComplete` → ОДНА охраняемая концовка корня стека (`concludeWorkspaceFlowOrOwe`), стейдж не
сворачивается отдельно — уходит ВМЕСТЕ с workspace; холд отпускается, когда корень workspace покинул документ
(MutationObserver — конец ухода, не таймер). Отказ концовки → стейдж сворачивается, холд падает, размещение встаёт
где стоит. `colonyFollowUpLive` держит фрейм, пока сцена идёт (иначе `settleColonyFollowUp` дорисовал бы свой
completeFlow поверх). Прерывание (размонтирование стейджа до `conclude`) — отпуск сразу; размещение серверное и не
теряется.

**Юниты:** `fleetDockModel.spec` (колонка, лестница, статусы, курсор, печатный ряд), `fleetDockScene.spec` (посев
только при стейдже, blocking, отпуск по отцеплению корня, гонка запуска, цель полёта), `tradePayModel.spec`
(паритет рядов), `premiumFleetDock.spec` (слот на ▲, ливрея, не-причал без слота), `colonyTradePlan.spec`
(`{fleetDock}` в батче), `turnIntents.spec` (`docks`), `consoleColoniesModel.spec` (фокус причала).
**e2e:** `tests/e2e/console-water-hauling.spec.ts` (fhd + tv4k, фикстура `water-hauling`).

## 8a. Замеры приёмки (2026-10-01, headless Chromium)

**Фит сетки планет** (шесть колоний + один причал, `--coltile-scale` с колонкой / без неё):

| Профиль | Без колонки | С колонкой 8rem (Deck 7rem) | Потеря |
| --- | --- | --- | --- |
| fhd 1920×1080 | 1.443 | 1.281 | −11.2 % |
| tv4k 3840×2160 | 1.420 | 1.258 | −11.4 % |
| Deck 1280×800 | 0.992 | 0.835 | −15.8 % |

Посылка промта «сетка упирается в высоту, колонка займёт свободную ширину» неверна: при шести колониях сетка
упирается в ШИРИНУ, поэтому любая колонка справа отнимает масштаб. Колонку сузили 9.4 → 8rem (Deck 7.6 → 7rem):
уже — карта в плитке перестаёт читаться. Альтернатива (ряд причалов ПОД сеткой, в вертикальном запасе) — решение
владельца. `[console-overflow]` — 0 на всех трёх профилях. На 4K пять подписей ячеек тайлов («ТОРГОВ…») обрезаны
и С колонкой, и БЕЗ неё — это профиль TV тайла колонии, не регрессия причала.

**Тайминг** (fhd): посадка → чистое поле ≈ 2.5 с (ответ карты ~700 мс · чтение ~690 · уход карты + workspace
~800–990); базовая торговля с колонией ≈ 2.1 с до возврата в обзор.

**Монтирование лица** (A/B, спек VP-свипа): с `PremiumFleetMark` 1.66–1.97 с против HEAD 2.0–2.2 с (вариант
с computed в каждом узле механики давал 2.3 с — отвергнут).

**e2e** `console-water-hauling.spec.ts`: 16/16 (×4) и 8/8 (×2) на `--workers=1`; 4K с двумя воркерами голодает
по rAF/компоновщику — спек это пишет в шапке.

**Регрессия соседей** (`npm run e2e:affected`: 19 файлов, 45 тестов, 2 воркера, свой снапшот): клиент до 3/4 —
45/45; мой клиент — 43/45 на первом прогоне: канарейка (таймаут 30 с на холодном старте воркера рядом с 4K-спеком)
и Pluto TRADE (`glideOverBlankStage` — сброс трека начался, пока `.con-colfocus__main` ещё не вернул непрозрачность
≥ 0.9: отпуск позы стоит на таймере `WORKING_AREA_BACK_MS` против CSS-перехода, а коммит 3/4 этот путь не трогает).
Оба не воспроизвелись в повторах: канарейка 4/4, Pluto 14/14 (1 воркер ×4, 2 воркера ×6, 2 воркера под нагрузкой
Miranda + 4K ×4).

## 8b. Не сделано и почему

- **Darkside Smugglers' Union / Collegium Copernicus / Huygens Observatory** остаются на `tradeColonyPick` (вне
  скоупа промта — не расширять); первые две не открывают пустой пик благодаря `canTrade({colonyOnly: true})`.
- **TR27-шаг «цель на карте»** (`previewFollowUps` → `cardTarget`) — контракт есть, клиентский шаг не сделан:
  у Water Hauling вопроса нет.
- **Ключ `'Fleets ${0} → ${1}'` не заведён** — флот «2 → 1» на стейдже показан общим чипом.
- **Кадр «Полигон»** не снимался — лицо показано через штатный просмотр карты (X на причале).
- **Кадр шага оплаты M€** (Helion / микс) не снят: в фикстуре нет второго источника; шаг — общий
  `ConsolePaymentPanel`, его покрывают колониальные спеки.
- **Раскадровка 4K** без последнего кадра «уход workspace» (fhd — полная).
- Решения по умолчанию к подтверждению владельцем: RU-имя, колонка «ПРИЧАЛЫ», без возврата в обзор колоний.

## 9. Что наследуют сёстры

- **TR26 UNMI Liner** — награда БЕЗ поверхности (+1 РТ): `fleetDock.receive` = `increaseTerraformRating`, чип РТ
  летит со значка карты на рельс, flow сворачивается как обычная торговля; требование — Союз.
- **TR27 Aurora Station** — награда С ВОПРОСОМ: цель аэростатов = `cardTarget` в `previewFollowUps` (тот же
  пре-сбор, что цель награды колонии) + 1 производство M€; флота не даёт.
