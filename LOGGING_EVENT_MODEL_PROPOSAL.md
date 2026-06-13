# Structured Game-Event Model — аудит и архитектурное предложение

> Цель: превратить серверный лог из «текстовой истории» в **структурированный event-stream**, пригодный
> для агрегируемой статистики — для `insightEngine.ts`, overlay-статистики эффектов, post-game analytics
> и более умного журнала. Документ — фундамент, не косметика.
>
> Статус: **АНАЛИЗ + АРХИТЕКТУРА (Phase 0 ещё не реализована)**. Все пути и сигнатуры сверены с кодом.

---

## 0. TL;DR и рекомендация

**Рекомендуемый вариант — C (гибрид), но с конкретной реализацией:**

* `LogMessage` остаётся **display-слоем** без изменений (журнал, локализация, сериализация — не трогаем).
* Рядом появляется **`GameEvent`** — структурированный, append-only, факт-ориентированный поток,
  эмитится в тех же chokepoints, что сегодня вызывают `game.log`.
* Связующее звено — **`EventRecorder`** на `Game` с **scope-стеком** (correlation/action chains).
* Аналитика на клиент уходит **не сырым потоком, а агрегатами** (bounded payload).
* **Оценочная стоимость (M€-equivalent) — отдельный слой**, никогда не в фактах.

**Почему именно так (главный вывод аудита):** в коде уже есть абстракция источника
`From` (`src/server/logs/From.ts`), и она уже протянута через все «хорошо логируемые» точки мутаций
(`Stock.add`, `Production.add`, `addResourceTo`, `increaseTerraformRating`). Атрибуция «кто это сделал»
наполовину готова — но выбрасывается в плоский текст. Надстройка над этим швом даёт широкое покрытие
почти бесплатно и без риска для журнала.

---

# ЧАСТЬ I. ТЕХНИЧЕСКИЙ АУДИТ

## 1. Модель логирования сегодня

### 1.1. Типы (всё в `src/common/logs/`)

`LogMessage` — `src/common/logs/LogMessage.ts`:

```ts
class LogMessage implements Message {
  playerId?: PlayerId;     // приватное сообщение «только этому игроку»
  timestamp = Date.now();  // НЕдетерминированно (только для отображения)
  type?: LogMessageType;   // хранится только если != DEFAULT (экономия памяти)
  message: string;         // шаблон с ${0} ${1}
  data: Array<LogMessageData>;
}
```

`LogMessageType` (`LogMessageType.ts`): `DEFAULT=0`, `NEW_GENERATION=1`, `ANNOUNCEMENT=2`.

`LogMessageDataType` (`LogMessageDataType.ts`) — 15 типов токенов:
`STRING, RAW_STRING, PLAYER(Color), CARD(CardName), AWARD, MILESTONE, COLONY, _STANDARD_PROJECT(мёртвый),
PARTY, TILE_TYPE, SPACE_BONUS, GLOBAL_EVENT, UNDERGROUND_TOKEN, SPACE(SpaceId), CARDS(CardName[])`.

**Вывод:** в `LogMessage` НЕТ поля для структурированной нагрузки. Есть только шаблон + типизированные
токены для рендера. Числа хранятся как `RAW_STRING` (`MessageBuilder.number()`), то есть «+3» в логе —
это строка, не число; распарсить её обратно в статистику нельзя.

### 1.2. Создание

Единая точка — `game.log()` (`src/server/Game.ts:1720`):

```ts
log(message, f?: (b: LogMessageBuilder) => void, options?: {reservedFor?: IPlayer}) {
  const builder = new LogMessageBuilder(message);
  f?.(builder);
  const logMessage = builder.build();
  logMessage.playerId = options?.reservedFor?.id;
  this.gameLog.push(logMessage);
  this.gameAge++;            // ← монотонный счётчик событий лога
}
```

`player.log()` **не существует** — карты пишут через `player.game.log(...)`.

Builder: `MessageBuilder` (`src/server/logs/MessageBuilder.ts`) + `LogMessageBuilder`
(добавляет `.forNewGeneration()`, `.announcement()`, `.from(From)`, `.build()`).
Метод `.from(from)` — это **уже готовый конвертер источника в токен** (player→PLAYER, card→CARD, и т.д.).

`LogHelper` (`src/server/LogHelper.ts`) — 11 канонических хелперов:
`logAddResource, logRemoveResource, logTilePlacement, logBoardTileAction, logColonyTrackIncrease/Decrease,
logVenusIncrease, logDrawnCards, logRevealedCards, logStealFromNeutralPlayer, logMoveResource`.

### 1.3. Хранение, сериализация, выдача

* Хранение: `game.gameLog: Array<LogMessage>` (`Game.ts:111`).
* Сериализация: **прямо как есть** — `SerializedGame.gameLog` (`SerializedGame.ts:43`), `gameAge`.
* Выдача: `GET /api/game/logs` (`src/server/routes/ApiGameLogs.ts`):
  * без `generation` → `gameLog.filter(messagesForPlayer).slice(-50)`;
  * с `generation` → `getLogsForGeneration(...)`;
  * `full` → `Log.applyData(...)` (текстовый экспорт).
* Доступ: `messagesForPlayer` (`routes/GameLogs.ts`) — приватные видит только владелец `playerId`.

### 1.4. Локализация

Сервер хранит **английские шаблоны**; перевод — на клиенте (`src/client/directives/i18n.ts`,
`translateMessage`/`translateText`). Для нашей задачи это плюс: структурированные события несут
**enum/ключи**, а не переведённый текст — локализацию не ломаем.

### 1.5. Undo / replay / save-load

* Undo = полный `Game.deserialize()` из БД (`GameLoader.ts:174`); `gameLog` загружается как есть.
  Логи **не перематываются** вручную — они часть снапшота.
* «Replay» в коде (Playwrights и т. п.) — это переигрывание *действий карты*, **не** логов.
* **Важный вывод для нас:** раз снапшот восстанавливает всё состояние, то если `gameEvents`
  положить в `SerializedGame`, undo **автоматически** обрежет event-stream до восстановленной точки.
  Нужно лишь сериализовать счётчик `seq`, чтобы id не коллизировали после повторного действия.

---

## 2. Точки мутаций состояния и их логирование

Главное: существует набор **chokepoints** с общей сигнатурой `options: {log?, from?}`. Это идеальные
места для эмита структурного события.

| Мутация | Файл / метод | Логируется? | Несёт `from`? |
|---|---|---|---|
| Сток-ресурсы +/− | `player/Stock.ts:9` `add(res, n, {log,from,stealing})` → `logUnitDelta` | если `log:true` | **да** |
| Производство +/− | `player/Production.ts:11` `add(res, n, {log,from})` | если `log:true` | **да** |
| Ресурсы НА карту + | `Player.ts:557` `addResourceTo(card,{qty,log,from})` → `LogHelper.logAddResource` | если `log:true` | **да** |
| Ресурсы С карты − | `Player.ts:525` `removeResourceFrom(card,n,{log})` (inline log) | по умолч. `true` | нет (есть removingPlayer) |
| TR +/− | `Player.ts:336` `increaseTerraformRating(n,{log,from,global})` | если `log:true` | **да** |
| Температура | `Game.ts:1335` `increaseTemperature(player,n)` | **нет прямого** (только TR/бонусы как сайд-эффект) | **нет** |
| Кислород | `Game.ts:1237` `increaseOxygenLevel(player,n)` | **нет прямого** | **нет** |
| Венера | `Game.ts:1273` `increaseVenusScaleLevel(player,n)` | **нет прямого** | **нет** |
| Океан | `Game.ts:1629` `addOcean` → `addTile` | через TR/бонусы | **нет** |
| Розыгрыш карты | `Player.ts:868` `'${0} played ${1}'` | да (только факт) | — |
| **Оплата / скидка** | `Player.ts:727` `getCardCost`, `playCard` | **НЕТ ВООБЩЕ** | — |
| Доход в фазу производства | `Player.ts` `finishProductionPhase` (прямые `+=`) | **НЕТ** | — |
| Спенд в Executor | `behavior/Executor.ts` `spend` ветки | **НЕТ** (deduct без log) | нет |
| Взятие карт | `DrawCards.ts` `keepAll` → `LogHelper.logDrawnCards` | да | source-опция |
| Тайлы (бонусы) | `Game.ts` `grantSpaceBonus` | да (ресурсные пути) | частично |
| Milestone claim | `Player.ts:1104` `'${0} claimed ${1} milestone'` | да | — |
| Award fund | `Game.ts:654` `'${0} funded ${1} award'` | да | — |
| Колония: трейд/билд/трек | `colonies/Colony.ts`, `LogHelper.logColonyTrack*` | да | частично |

`logUnitDelta` (`player/StockBase.ts:116`) — центральный текст-форматтер дельты. Уже умеет
варианты «gained/lost», «production», «because of \${from}», «stolen by». То есть **факт уже известен в
числовом виде в момент лога** — мы его просто не сохраняем структурно.

---

## 3. Ключевой шов: абстракция `From` (фундамент решения)

`src/server/logs/From.ts`:

```ts
type From =
  | {player: IPlayer} | {card: ICard} | {card: CardName}
  | {globalEvent: IGlobalEvent} | {globalEvent: GlobalEventName}
  | {party: IParty} | {partyName: PartyName};
```

Это и есть «source entity» из ТЗ (§15). Она уже:

* принимается `Stock.add`, `Production.add`, `addResourceTo`, `increaseTerraformRating`;
* конвертируется в лог-токен через `LogMessageBuilder.from()`.

**Дыры в `From`:**
1. Не сериализуема как есть (держит ссылки на объекты) → нужен **serializable projection** `EventSource`.
2. Не несёт *владельца* карты (только имя). Для агрегации «по карте» имени достаточно; владельца берём из
   активного scope.
3. Многие call-sites её **не передают** (global params, spend, production income) → атрибуция теряется,
   хотя источник известен из контекста действия. Это решает scope-стек (см. Часть IV).

---

## 4. Скидки — главная чёрная дыра

`Player.getCardCost` (`Player.ts:727`):

```ts
getCardCost(card) {
  let cost = card.cost;
  cost -= this.colonies.cardDiscount;                       // Iapetus
  for (const c of this.tableau) cost -= c.getCardDiscount?.(this, card) ?? 0;  // Earth Catapult, ...
  this.removedFromPlayCards.forEach(...);                   // Playwrights
  if (SPACE && Unity up04) cost -= 2;                       // партийная политика
  return Math.max(cost, 0);
}
```

`playCard` (`Player.ts:852`) логирует только `'${0} played ${1}'`. **Нигде не фиксируется:**
сколько стоила карта без скидки, какая скидка, от какого источника, сколько M€ сэкономлено суммарно.
Это именно тот «hidden value», который хочет показывать overlay и insightEngine
(«Earth Catapult сэкономил 22 M€»). Сегодня данные **полностью теряются**.

Аналогично теряется экономия на:
* стандартных проектах — `StandardProjectCard.getAdjustedCost` (`getStandardProjectDiscount`);
* колониальном трейде (`tradeDiscount`/`tradeOffset`);
* `colonies.cardDiscount` (Iapetus).

**Точка перехвата:** `getCardCost` должен уметь вернуть *breakdown* `{base, finalCost, discounts:[{source, amount}]}`,
а `checkPaymentAndPlayCard`/`playCard` — эмитнуть `payment` + `discount-applied` события.

---

## 5. Пассивные эффекты и триггеры

Хуки на `ICard` (`src/server/cards/ICard.ts`):
`onCardPlayed/ByAnyPlayer, onStandardProject, onTilePlaced, onIncreaseTerraformRatingByAnyPlayer,
onGlobalParameterIncrease, onResourceAdded, onProductionGain, onProductionPhase, onColonyAddedByAnyPlayer,
onIdentificationByAnyPlayer, onClaim, onNonCardTagAdded(ByAnyPlayer)`.

Диспетчинг:
* `onCardPlayed` — `Player.ts:934` (свои + чужие табло, `playersInGenerationOrder`).
* `onTilePlaced` / `onIdentification` — `Game.triggerForAllCards` (`Game.ts:1458/1467`).
* `onProductionGain` — `Production.add` loop (`Production.ts:34`).
* `onColonyAddedByAnyPlayer` — `Colony.ts:101`.
* `onResourceAdded` — `Player.addResourceTo` (`Player.ts:570`).

**Что теряется:** большинство карт *честно* пишут результат (`{log:true, from:{card:this}}`),
поэтому в тексте видно «Victor получил 3 M€ из Media Group». Но **теряется ЛИНКОВКА**:
* какое именно событие *запустило* эффект (играли событие? положили город?);
* что это часть цепочки «розыгрыш A → сработал эффект B → скидка C → ресурс D»;
* счётчик «сколько раз сработал этот эффект».

Полностью «тихие» триггеры (даже без result-лога): `PointLuna.onCardPlayed` (драфт карт логируется как
обычное взятие, без «PointLuna сработал»), `Xavier.onProductionPhase` (сброс состояния), часть авто-выборов
deferred-действий.

---

## 6. Потребитель: `insightEngine.ts`

`src/client/components/endgame/insightEngine.ts` (909 строк) — **чистый** candidate-based анализатор.
8 независимых анализаторов (`analyzeVerdict/Timeline/VictoryReasons/CategoryBattles/Momentum/Parameters/Cards/Race/ProfileLine`)
эмитят `InsightCandidate{id,group,priority,severity,icon,badge,color,textKey,params,suppresses}`;
`selectInsights` ранжирует и дедуплицирует по `group`.

Вход — `InsightContext` (строится в `endgameModel.ts` из `VictoryPointsBreakdown` + `vpByGeneration` +
`globalParameterSteps`). **Сейчас insightEngine НЕ потребляет никакой event-stream.** Он видит только
финальный счёт по категориям и VP-по-поколениям.

`VictoryPointsBreakdown` (форк уже расширил): `terraformRatingBreakdown{base,temperature,oxygen,oceans,venus,cards}`,
`detailsCards[].kind ('resource'|'conditional'|'fixed'|'penalty')`.

Существующая статистика на игроке (`PublicPlayerModel`): `actionsThisGeneration(CardName[])`,
`actionsTakenThisGame`, `tags(Record)`, `tradesThisGeneration`, `victoryPointsByGeneration`,
`globalParameterSteps`. **Нет:** счётчика сыгранных карт, impact-по-картам, M€-equivalent, ROI.

**Вывод:** insightEngine идеально готов принять новый анализатор (`analyzeEngineValue`,
`analyzeDiscounts`, `analyzeHiddenValue`), как только появятся **агрегаты по источникам**. Архитектура
расширяема без переписывания.

---

# ЧАСТЬ II. ЧТО СЕЙЧАС ТЕРЯЕТСЯ (missed events)

1. **Скидки и экономия M€** — полностью (§4). Самый ценный пробел.
2. **Линковка триггеров** — «что запустило эффект» и «цепочка действий» (§5).
3. **Счётчики срабатываний эффектов** — нигде не считаются.
4. **Атрибуция глобальных параметров к источнику** — `increaseTemperature/Oxygen/Venus` не несут `from`;
   есть только `globalParameterSteps` агрегатом по игроку, без «какая карта».
5. **Доход в фазу производства** — `finishProductionPhase` пишет напрямую, без события.
6. **Спенд в Executor** — `spend.plants/energy/resourcesHere` без лога.
7. **Числовые величины как факты** — в логе всё `RAW_STRING`, обратно не парсится.
8. **VP в момент получения** — VP считаются только в конце (`calculateVictoryPoints`), нет «когда/из чего».
9. **Оплата** — какими ресурсами и сколько фактически заплачено (кроме разрозненных resource-логов).
10. **ROI / hidden value** — VP на 1 M€, engine-value без прямых VP — невычислимо из текущих данных.

---

# ЧАСТЬ III. ПРЕДЛАГАЕМАЯ СТРУКТУРНАЯ МОДЕЛЬ

Новые типы — в `src/common/` (общие для сервера и клиента; сервер эмитит, клиент агрегирует/показывает).

### 3.1. Источник (serializable projection `From`)

```ts
// src/common/events/EventSource.ts
export type EventSource =
  | {kind: 'card';            card: CardName; owner?: Color}      // синяя/зелёная/событие
  | {kind: 'corporation';     card: CardName; owner?: Color}
  | {kind: 'standardProject'; card: CardName}
  | {kind: 'milestone';       name: MilestoneName}
  | {kind: 'award';           name: AwardName}
  | {kind: 'colony';          name: ColonyName}
  | {kind: 'globalEvent';     name: GlobalEventName}
  | {kind: 'party';           name: PartyName}
  | {kind: 'globalParameter'; parameter: GlobalParameter}        // solar phase и пр.
  | {kind: 'production'}                                         // доход фазы производства
  | {kind: 'system'};                                            // setup / нейтральный
```

`owner` — заполняется рекордером из активного scope (восстанавливает то, чего нет в `From`).

### 3.2. Импакт — ТОЛЬКО факты (см. §16 ТЗ)

```ts
// src/common/events/EventImpact.ts
export type EventImpact = {
  stock?: Partial<Units>;                 // сток-ресурсы, signed
  production?: Partial<Units>;            // производство, signed
  cardResources?: ReadonlyArray<{cardResource: CardResource; target?: CardName; amount: number}>;
  tr?: number;
  globalParameter?: {parameter: GlobalParameter; steps: number};
  cardsDrawn?: number;
  cardsDiscarded?: number;
  vp?: number;                            // ПРЯМОЙ грант VP (редко в середине игры)
  tilesPlaced?: number;
  megacreditsPaid?: number;               // фактически уплачено
  megacreditsSaved?: number;              // СКИДКА (экономия), не трата
};
```

Никаких «estimated value» — оценка живёт отдельным слоем (Часть VI.4).

### 3.3. Событие

```ts
// src/common/events/GameEvent.ts
export type GameEventType =
  | 'action'                  // верхнеуровневое действие игрока (root scope)
  | 'payment'                 // уплачено + сэкономлено
  | 'discount-applied'
  | 'resource-changed'        // сток
  | 'production-changed'
  | 'card-resource-changed'
  | 'tr-changed'
  | 'global-parameter-changed'
  | 'cards-drawn'
  | 'tile-placed'
  | 'vp-granted'
  | 'effect-triggered'        // сработал пассивный эффект (обёртка над импактом)
  | 'milestone-claimed' | 'award-funded'
  | 'production-phase-income';

export type EventVisibility = 'journal' | 'analytics';   // показывать в журнале vs только аналитика
export type EventTag = 'discount' | 'passive-effect' | 'card-impact'
  | 'attack' | 'engine' | 'production' | 'terraforming';

export type GameEvent = {
  id: number;                 // монотонный seq внутри партии (ключ порядка)
  generation: number;
  phase: Phase;
  player?: Color;             // бенефициар/актор
  type: GameEventType;
  source?: EventSource;       // что вызвало
  target?: {player?: Color; card?: CardName};  // для атак/кросс-игрок эффектов
  trigger?: GameEventType;    // тип события-триггера (для effect-triggered)
  impact: EventImpact;        // факты
  correlationId: number;      // id корневого action — связывает цепочку
  parentId?: number;          // непосредственная причина (вложенность цепочки)
  visibility: EventVisibility;
  tags?: ReadonlyArray<EventTag>;
};
```

**Детерминизм:** ключ порядка — `id` (seq), не `timestamp`. Никакого `Date.now()` в логике/дедупе
(опциональный display-timestamp допустим как метаданные). События эмитятся синхронно в детерминированном
движке → воспроизводимы.

### 3.4. Visible vs analytics-only (§7 ТЗ — не зашумить журнал)

`visibility` решает, попадает ли событие в журнал. Правило по умолчанию:
* `action`, `milestone-claimed`, `award-funded`, крупные `tile-placed` → `journal`;
* `discount-applied`, `effect-triggered`, мелкие `resource-changed` под действием → `analytics`
  (в журнале — свёрнуто под родительский `action` через `correlationId`).

Журнал при этом **продолжает рендериться из `LogMessage`** (Часть VII): группировка по `correlationId` —
это Phase 3, а не обязательное условие. Event-stream и текст-лог независимы.

---

# ЧАСТЬ IV. РАСШИРЕНИЕ СЕРВЕРНОГО API

### 4.1. `EventRecorder` + scope-стек на `Game`

```ts
// src/server/events/EventRecorder.ts
type Scope = {id: number; source?: EventSource; player?: Color; parentId?: number; rootId: number};

export class EventRecorder {
  private seq = 0;                   // ← сериализуется (undo-safe)
  private scopes: Array<Scope> = [];
  public readonly events: Array<GameEvent> = [];   // ← сериализуется (опц.)

  beginScope(opts: {source?: EventSource; player?: Color; type?: GameEventType}): number {
    const parent = this.scopes.at(-1);
    const id = ++this.seq;
    this.scopes.push({id, source: opts.source, player: opts.player,
                      parentId: parent?.id, rootId: parent?.rootId ?? id});
    // верхнеуровневый scope сам по себе — событие 'action'
    return id;
  }
  endScope() { this.scopes.pop(); }

  record(e: Omit<GameEvent,'id'|'correlationId'|'parentId'|'generation'|'phase'>) {
    const top = this.scopes.at(-1);
    this.events.push({
      ...e, id: ++this.seq,
      correlationId: top?.rootId ?? this.seq,
      parentId: top?.id,
      generation: this.game.generation, phase: this.game.phase,
      source: e.source ?? top?.source,     // ← восстановление атрибуции из контекста
      player: e.player ?? top?.player,
    });
  }
}
```

**Где `beginScope`/`endScope`:** в точках входа верхнеуровневого действия —
`Player.takeAction`/`playCard`/`action()`, `StandardProjectCard.payAndExecute`, конверсии, трейд,
`fundAward`/`claimMilestone`, и обёртка фазы производства. Диспетчинг пассивных хуков
(`onCardPlayed` loop, `triggerForAllCards`, `Production.add` loop) оборачивается **вложенным** scope с
`source:{card}` + `type:'effect-triggered'`, и `trigger` = тип запускающего события → цепочка
восстанавливается автоматически.

**Где `record`:** в тех же chokepoints, что уже зовут `game.log`:
`Stock.add`, `Production.add`, `addResourceTo`/`removeResourceFrom`, `increaseTerraformRating`,
`increaseTemperature/Oxygen/Venus`, `addOcean`, `DrawCards`, `getCardCost`/`playCard` (payment+discount).

**Конвертер:** `fromToEventSource(from: From, game): EventSource` — переиспользует логику
`LogMessageBuilder.from()` (player→color, card→name+owner). Один раз и переиспользуется везде.

**Ключевое преимущество scope-стека:** он **восстанавливает атрибуцию, которую отдельные call-sites
теряют** (global params, spend, production income), потому что верхнеуровневое действие знает источник.
Это снимает необходимость протягивать `from` через десятки сигнатур.

### 4.2. Скидки — единственное точечное изменение сигнатуры

`getCardCost` дополнить вариантом с breakdown (не ломая текущий):

```ts
getCardCostBreakdown(card): {base: number; final: number; discounts: Array<{source: EventSource; amount: number}>};
getCardCost(card) { return this.getCardCostBreakdown(card).final; }  // обратная совместимость
```

В `checkPaymentAndPlayCard`/`playCard` эмитим `discount-applied` (per source) + `payment`.

### 4.3. Сериализация (backward-compatible)

`SerializedGame` += `gameEvents?: Array<GameEvent>` и `eventSeq?: number` (оба опциональные → старые
сейвы грузятся с пустым потоком, аналитика деградирует мягко). Агрегаты **не** сериализуем — они
пересчитываемы из потока (Часть V).

---

# ЧАСТЬ V. АГРЕГАЦИЯ СТАТИСТИКИ

Чистые редьюсеры над потоком (`src/common/events/aggregate.ts`) — детерминированы, тестируемы,
пересчитываемы (значит, для старых партий просто дадут меньше данных).

```ts
type SourceStats = {
  source: EventSource;
  triggerCount: number;
  stock: Units; production: Units;
  cardResources: Partial<Record<CardResource, number>>;
  tr: number; cardsDrawn: number;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  megacreditsSaved: number; vp: number;
};

aggregateBySource(events): Map<sourceKey, SourceStats>;     // → overlay эффектов, top-cards
aggregateByPlayer(events): Map<Color, PlayerStats>;         // → insight «кто получил больше от пассивок»
aggregateByGeneration(events): Array<GenStats>;             // → таймлайн engine-value
aggregateByAction(events): Map<correlationId, ActionStats>; // → журнал-цепочки
```

`sourceKey` = `${kind}:${card|name}`. Агрегаты **bounded** числом карт/игроков → дёшево слать на клиент.

**Доставка на клиент (контроль payload):** во время партии **сырой поток не шлём**. Шлём только агрегаты:
* для overlay эффектов — `SourceStats` по картам текущего игрока (десятки записей);
* для endgame — агрегаты считаются один раз при показе экрана конца.

Опции доставки (выбрать в Phase 2): (а) новое поле в `PublicPlayerModel` (`effectStats`), либо
(б) отдельный route `GET /api/game/stats?id=` (лениво, как `/logs`). Сырой `gameEvents` доступен только
для endgame/replay/debug.

---

# ЧАСТЬ VI. ИСПОЛЬЗОВАНИЕ ДАННЫХ

### VI.1. `insightEngine.ts`

Добавить агрегаты в `InsightContext` и новые анализаторы (паттерн уже расширяемый):
* `analyzeDiscounts` — «34 M€ сэкономлено скидками за партию» (из `aggregateBySource`, tag `discount`).
* `analyzeEngineValue` — двигатель без прямых VP: суммарный impact карты vs её VP.
* `analyzeHiddenValue` — «самая impactful карта без VP» (макс. факт-импакт, `vp===0`).
* `analyzePassiveBeneficiary` — кто больше всех получил от пассивок (`aggregateByPlayer`, tag `passive-effect`).

### VI.2. Overlay эффектов (ЭФФЕКТЫ)

Сейчас overlay показывает графику эффекта (client-derived из `renderData`). Добавляем под каждый
блок `SourceStats` этой карты: «сработал N раз · +12 растений · сэкономил 18 M€ · добрал 3 карты ·
+5 животных». Данные — `aggregateBySource` для `displayedPlayer`. Никакого парсинга текста.

### VI.3. Журнал

Phase 3: группировка `LogMessage` по `correlationId` (через мостик event→log по id) → сворачиваемые
цепочки: «Victor сыграл X ↳ Effect A сэкономил 2 M€ ↳ Effect B +1 растение». Не обязательно для
фундамента; делается, когда поток стабилен.

### VI.4. Value normalization (§16 ТЗ — отдельно факты и оценка)

Факты живут в `EventImpact`/`SourceStats`. **Оценочная стоимость** (M€-equivalent: 1 растение ≈ X M€,
1 карта ≈ Y M€) — отдельная чистая функция `valuation(stats): {mcEquivalent, breakdown}` **только в
клиентской аналитике/insightEngine**, никогда не в персистентных событиях. Можно эволюционировать
эвристики без миграции данных.

---

# ЧАСТЬ VII. ПЛАН ВНЕДРЕНИЯ (без большого риска)

### Phase 0 — фундамент (POC)
* Типы `EventSource`/`EventImpact`/`GameEvent` в `src/common/events/`.
* `EventRecorder` + scope-стек на `Game`; `fromToEventSource`.
* Сериализация `gameEvents?`/`eventSeq?` (опц.).
* `beginScope/endScope` в `playCard` (+ обёртка `onCardPlayed`-диспетчинга).
* `record` в 4 общих chokepoints (`Stock.add`, `Production.add`, `addResourceTo`, `increaseTerraformRating`) —
  широкое покрытие почти даром (они уже несут `from`).
* Тесты: цепочка «сыграл карту → пассивка → ресурс» даёт связанные события с общим `correlationId`.

### Phase 1 — скидки + линковка триггеров (наивысшая ценность)
* `getCardCostBreakdown` + `payment`/`discount-applied` события.
* Вложенные scope для всех пассивных хуков (`triggerForAllCards`, `Production.add` loop, колонии) →
  `effect-triggered` + `trigger` + `parentId`.
* `aggregateBySource`/`aggregateByPlayer` + тесты на «Earth Catapult сэкономил N M€».

### Phase 2 — добор тихих мутаций + доставка
* `increaseTemperature/Oxygen/Venus`, `addOcean`, `finishProductionPhase`, `spend`, `DrawCards`.
* Доставка агрегатов на клиент (поле модели или `/api/game/stats`).
* `aggregateByGeneration`/`aggregateByAction`.

### Phase 3 — потребители
* Новые анализаторы insightEngine; статистика в overlay эффектов; группировка журнала по `correlationId`;
  опц. value-normalization слой.

---

# ЧАСТЬ VIII. РИСКИ И ОГРАНИЧЕНИЯ (и как закрыты)

| Ограничение (§17 ТЗ) | Как закрыто |
|---|---|
| Не сломать журнал | `LogMessage` не трогаем; event-stream независим. |
| Не сломать save/load | `gameEvents?`/`eventSeq?` опциональны; старые сейвы грузятся пустыми. |
| Не сломать undo/replay | Поток — часть снапшота; undo обрезает его автоматически; `seq` сериализуется → нет коллизий id. |
| Не сломать локализацию | События несут enum/ключи, не текст. |
| Контроль payload | Сырой поток на клиент не шлём; только bounded-агрегаты. |
| Журнал не зашумить | `visibility:'analytics'` для мелочи; журнал по-прежнему из `LogMessage`. |
| Backward-compat старых игр | Агрегаты пересчитываемы → старая партия = меньше данных, без падений. |
| Детерминизм/воспроизводимость | Порядок по `seq`, эмит синхронный, без `Date.now` в логике. |
| Без грязного хардкода | Обобщённая модель (source/target/type/impact/tags); спецслучаи — точечно. |

---

# ЧАСТЬ IX. POC — что реализовать первым (Phase 0)

Минимальный, но проверяемый срез:

1. `src/common/events/{EventSource,EventImpact,GameEvent,aggregate}.ts` — типы + `aggregateBySource`.
2. `src/server/events/EventRecorder.ts` + `fromToEventSource.ts`; `game.events: EventRecorder`.
3. Врезка `record(...)` в `Stock.add`/`Production.add`/`addResourceTo`/`increaseTerraformRating`
   (когда уже формируется лог — рядом эмитим событие; **никаких поведенческих изменений**).
4. `beginScope/endScope` вокруг `playCard` и `Player.onCardPlayed`-диспетчинга.
5. Сериализация `gameEvents?`/`eventSeq?` в `SerializedGame` (round-trip).
6. Тесты (mocha): MediaGroup — сыграл событие → `effect-triggered` (+3 M€) с `correlationId` =
   `action` розыгрыша; Pets — город → `card-resource-changed` (+1 animal) залинкован к размещению;
   `aggregateBySource` суммирует срабатывания.

Это даёт реальный, связанный поток на самых частых картах и проверяет correlation/aggregation —
ровно «passive effect trigger + resource added + production/resource change» из acceptance-критериев.

---

# Открытые решения (для согласования)

1. **Хранилище варианта** — подтверждаю гибрид (C): отдельный `GameEvent` + `LogMessage` как display.
2. **Доставка агрегатов** — поле `PublicPlayerModel.effectStats` vs отдельный `/api/game/stats`
   (склоняюсь к ленивому route, как `/logs`, чтобы не раздувать модель каждого тика).
3. **Объём Phase 0 POC** — реализовать сейчас целиком или сначала только типы+рекордер+тесты.

---

# ЧАСТЬ X. РЕАЛИЗОВАНО (Phase 1 — фундамент + первое внедрение)

**Статус: сделано, протестировано, серверный набор зелёный (7122 passing, 0 failing), линт затронутых
файлов чистый.** Поведение игры не изменено — слой чисто аддитивный, read-only по отношению к игровому
состоянию.

### X.1. Что добавлено

Типы (`src/common/events/`): `EventSource` (+ `sourceKey`, `isCorporationSource`), `EventImpact`,
`GameEvent` (+ `GameEventType`, `EventTrigger`, `EventVisibility`, `EventTag`), `aggregate.ts`
(`aggregateBySource` / `aggregateByPlayer` / `aggregateCorporationImpact` / `aggregateByGeneration` /
`toEffectOverlayStat`).

Сервер: `src/server/events/EventRecorder.ts` (scope-стек, `beginAction`/`beginEffect`/`beginCopiedAction`/
`withEffect`/`withCopiedAction`, ленивый `effect-triggered` маркер, захват/восстановление контекста
`captureContext`/`runWithContext`, `record*` хелперы, `serialize`/`restore`) + `fromToEventSource.ts`.

Интеграция: `Game.events` (+ сериализация `gameEvents?`/`eventSeq?` в `SerializedGame`, restore в
`deserialize`, поле в `IGame`); проброс correlation через `DeferredActionsQueue.push`/`run` (+ поле
`eventContext` в `DeferredAction`); chokepoints — `Stock.add`, `Production.add`, `Player.addResourceTo`/
`removeResourceFrom`/`increaseTerraformRating`/`decreaseTerraformRating`, `DrawCards.keepAll`; roots/wraps —
`Player.playCard` (+ `getCardCostBreakdown` → discount/payment), `playActionCard`/`getPlayCeoOPGAction`,
`onCardPlayed`/`onCardPlayedByAnyPlayer` диспетчинг; copy — `Viron`.

Тесты: `tests/events/EventStream.spec.ts` — пассивный триггер (Media Group, **через границу deferred**),
ресурс на карту (Decomposers), скидка (Earth Catapult), copy-цепочка (VIRON), corp-action root, сериализация
round-trip, и проверка «loose bookkeeping не пишется».

Все обращения к рекордеру **устойчивы к отсутствию `game`** (`this.game?.events?...`) — изолированные
unit-тесты `Stock`/`Production`/`Player` создают игрока без игры, и слой просто молчит там.

### X.2. Доставка на клиент (раздельно по потребителям) — ПРОЕКТ

Сырой `GameEvent[]` на клиент во время партии **не уходит**. Маршруты (lazy, как `/api/game/logs`):

- **`GET /api/game/stats/effects?id=&playerId=`** — lightweight. Возвращает
  `Array<EffectOverlayStat>` (`toEffectOverlayStat` по картам игрока): `{sourceKey, card, triggerCount,
  megacreditsSaved, cardsDrawn, stock, production, cardResources, tr}`. Для overlay ЭФФЕКТЫ. Маленький,
  ограничен числом карт.
- **`GET /api/game/stats/endgame?id=`** — rich. Полные агрегаты для `insightEngine`: `aggregateBySource`,
  `aggregateByPlayer`, `aggregateByGeneration`, `aggregateCorporationImpact` по каждой корпорации, top
  sources, discount stats. Считается ОДИН раз при показе экрана конца.
- **`GET /api/game/stats/source?id=&source=`** (опц.) — drill-down по одному источнику.

Никаких событий в `PublicPlayerModel` (не раздуваем каждый тик).

### X.3. Модель Corporation Impact (для будущего раздела insightEngine)

`aggregateCorporationImpact(events, corpName, owner?)` уже считает по двум каналам:
(а) события с `source = эта корпорация` (стартовый эффект, пассивки, действия);
(б) события, чей **correlation-root** — действие этой корпорации (то, что породило её действие, включая
скопированное через VIRON). Возвращает `SourceStats`: `triggerCount` (сколько раз корпорация сработала/
использовалась), `stock`/`production`/`cardResources`/`tr`/`cardsDrawn`/`megacreditsSaved`/`vp`. Этого
достаточно для ответов «сколько раз сработал эффект корпорации», «сколько M€/ресурсов/карт/производства она
дала», «сколько действий использовано».

### X.4. VIRON / copy-repeat linkage (реализовано)

`Viron.action` оборачивает `card.action(player)` в `events.withCopiedAction(player, this, copiedCard, …)`:
эмитится `copied-action` (source = corporation VIRON, target = скопированная карта), и весь импакт
скопированного действия (через chokepoints, в т.ч. отложенный) садится в эту цепочку → атрибутируется VIRON
через `aggregateCorporationImpact`. Это даёт будущую аналитику «VIRON сработал N раз и через копирование дал
+X». **Project Inspection** и **Robotic Workforce/Cyberia** используют тот же `withCopiedAction` — помечено в
матрице как 🟡 (одна строка обёртки).

### X.5. Известное ограничение (честно)

Correlation-контекст переживает **синхронные цепочки** и **границу deferred-очереди**, но **рвётся на
границе player-input** (`.andThen` у `SelectCard`/`OrOptions` исполняется на следующем HTTP-запросе, вне
восстановленного контекста). Для copy-механик это обойдено явным self-root `copied-action`. Полный проброс
через input-колбэки (stamp контекста на player-input) — отдельная Phase-2 задача; на текущем покрытии
(пассивки, on-play, оплата, скидки, действия, VIRON) ограничение не проявляется.

### X.6. Coverage matrix

См. `LOGGING_EVENT_COVERAGE_MATRIX.md` — полный перечень 37 корпораций в скоупе + правило-категоризатор для
всех ~200 карт + Phase-3 worklist (точечные обёртки `onTilePlaced`/`onProductionGain`/`onColonyAdded`/
`onGlobalParameterIncrease`/`onStandardProject`, std-project скидки, Project Inspection/Robotic Workforce).

---

# ЧАСТЬ XI. PHASE 2 — честная атрибуция + cause/effect фундамент журнала + данные overlay

**Статус: сделано, протестировано (7136 серверных тестов зелёные), линт затронутого + vue-tsc новых
клиентских модулей чисты. Поведение игры не изменено.** Двигались строго по §19: данные → bridge/viewmodel
(rendering — следующая фаза).

### XI.1. Закрыты ВСЕ pending attribution wraps (§12)
Каждый диспетчинг пассивок обёрнут в `events.withEffect(player, card, trigger, fn)` → корректный
`source` + `effect-triggered` маркер: `onTilePlaced` (Game.triggerForAllCards MARS), `onProductionGain`
(Production.add), `onColonyAddedByAnyPlayer` (Colony.addColony), `onGlobalParameterIncrease` (Venus +
Temperature loops), `onStandardProject` (StandardProjectCard), `onNonCardTagAdded`
(Player.triggerOnNonCardTagAdded). Copy-маркеры: **Project Inspection** + **Robotic Workforce / Cyberia
Systems** (`withCopiedAction`). **Std-project скидки**: записываются в `payAndExecute` (НЕ в
`getAdjustedCost` — та зовётся на каждой проверке affordability), + новый **standard-project root scope**.
Все вызовы рекордера устойчивы к отсутствию `game` (`?.events?.`) и без `!` (lint).

### XI.2. Снято известное ограничение — correlation через границу player-input
`Player.setWaitingFor` захватывает активный scope (`waitingForContext`), `Player.process` восстанавливает
его вокруг `waitingFor.process(...)`; `DeferredActionsQueue.run` теперь вызывает `setWaitingFor` ВНУТРИ
scope действия (continuation — снаружи). Итог: «размести город (выбери клетку) → сработал Pets» остаётся
ОДНОЙ цепочкой даже через несколько HTTP-запросов. `waitingForContext` транзиентен (не сериализуется —
сейв посреди промпта мягко теряет привязку).

### XI.3. Журнальный bridge LogMessage ↔ GameEvent (вариант C, реализован)
`LogMessage` получил опциональные `correlationId` / `parentId` / `role` (`JournalEntryRole =
'root-action' | 'effect-result' | 'detail'`). `game.log` стампит их из активного scope
(`EventRecorder.stampJournal`): первый лог action/copied-scope → `root-action`, эффекты → `effect-result`,
прочее → `detail`; лог вне scope → без стампа (плоская строка, как сейчас). **Группировка — по
структурному `correlationId`, без парсинга текста.** `effect-triggered` маркер эмитится лениво при ПЕРВОМ
из (лог | impact). `LogMessage` не сломан (поля опциональны), локализация не затронута (поля не текст).

### XI.4. JournalViewModel (Phase A, готов)
`src/client/components/journal/journalView.ts` `buildJournalView(messages)` → `Array<JournalNode>`
(`group{header, children}` | `message`): группирует по `correlationId`, заголовок = `root-action` (или
первый), одиночные группы схлопываются в плоскую строку, несгруппированные/legacy/NEW_GENERATION — плоско.
Чистый, unit-протестирован (`tests/events/journalView.spec.ts`). **Это и есть «grouped layout без
клиентского парсинга текста».** Скидки/оплата — НЕ строки журнала, но несут тот же `correlationId` → доступны
на expand из `GameEvent` stream.

### XI.5. Данные overlay эффектов (Required outcome 1 — слой данных + viewmodel)
- `aggregate.ts`: `SourceStats.lastTrigger` + **`effectOverlayStats(events, owner)`** → lightweight
  `EffectOverlayStat[]` ТОЛЬКО по картам/корпорациям игрока (не сырой поток, не endgame-аналитика).
- `src/client/components/effects/effectSummary.ts`: **`EffectSummaryProvider` registry + `getEffectSummary`**
  — default generic + **bespoke провайдеры** (Pets, Pharmacy Union) → §10 «у каждого эффекта может быть своя
  сводка». Pure, unit-протестирован (`tests/events/effectSummary.spec.ts`), включая empty-state.

### XI.6. Доказательства (тесты на 5 сценариях)
`tests/events/EventStream.spec.ts`: Pets (onTilePlaced → animal атрибутирован Pets), Arctic Algae (ocean →
+2 plants), Media Group (группа «сыграл событие ↳ +3 M€»), Earth Catapult (discount correlated к play-логу),
VIRON (copied-action группа). + `journalView.spec.ts` (5) + `effectSummary.spec.ts` (4).

### XI.7. Осталось — ФАЗА RENDERING (следующий шаг, по §19 — последняя)
1. **Effects overlay Vue-панель**: HTTP-route `GET /api/game/stats/effects?id=` (отдаёт
   `effectOverlayStats`), клиентский fetch/state, summary-панель в `EffectsOverlay` на hover/focus (рендер
   `getEffectSummary` через `iconClassFor`; + ru-ключи `Saved`/`Gained`/`Production`/`Added`/`Cards drawn`/
   `Times triggered`/`Never triggered yet`/`Animals gathered from cities`/`Corporation ability`).
2. **Premium grouped journal rendering**: `JournalFeed`/`JournalEntry` рендерят `buildJournalView` (header
   жирнее, дети компактные + connector); expand тянет `GameEvent` детали (скидки) по `correlationId`.
Всё это — чистый rendering поверх готовой и протестированной модели; данные парсить из текста НЕ нужно.

---

# ЧАСТЬ XII. PHASE 3a — PREMIUM CAUSE/EFFECT ЖУРНАЛ (rendering, СДЕЛАНО)

**Статус: реализовано и протестировано — 7137 серверных тестов + client mount-тест зелёные, eslint+vue-tsc+make:json чисты.** Журнал перешёл с плоского списка на premium grouped narrative feed.

### XII.1. Серверные дополнения (минимальные, аддитивные)
- `LogMessage.category?: JournalActionCategory` — стампится на root-логе из активного scope.
- `EventRecorder.beginAction(player, source, {category})` + `beginCopiedAction` → `'copied-action'`; `stampJournal` проставляет категорию на `root-action`-логе. Категории: `card-play` (playCard), `card-action`/`corporation-action` (playActionCard), `ceo-action`, `standard-project` (payAndExecute), `copied-action`.
- **Скидка как grouped-деталь:** `playCardImpl` после строки «сыграл X» пишет компактный `'${0} saved ${1} M€ playing with ${2}'` (role `detail`, ru-ключ добавлен) — даёт целевой вид §16 EarthCatapult без новых top-level строк (квит, группируется, сворачивается).

### XII.2. JournalViewModel + рендеринг
- `journalView.ts buildJournalView` → `JournalGroupNode{header, children, category}` | `message`. Группировка ТОЛЬКО по `correlationId`/`role`/`category` (структурно, без парсинга текста); legacy/system/divider/одиночные — плоско (fallback).
- **`JournalGroup.vue`** — premium блок: доминантный root-заголовок (категорийный акцент-шард + время + усиленный текст) → connector-линия → компактные дочерние строки (ветка-tick, тусклее) → collapse/expand для длинных цепочек (>3, «+N»/«Свернуть»). Hover подсвечивает группу.
- **`JournalFeed.vue`** — рендерит узлы (group → `JournalGroup`, иначе flat `JournalEntry`), **group-aware фильтр** (группа остаётся, если совпал заголовок ИЛИ любой ребёнок; matched-дети подсвечены, остальные приглушены — контекст сохранён), per-row fresh-анимация через `freshSet`, стабильные ключи групп (`g<correlationId>`). Live-append/scroll/«New events» — сохранены (детект по сырому количеству, независим от фильтра).
- `JournalPanel.vue` — передаёт сырые `messages` + `filter` + `color` (фильтрация ушла в feed).
- Стили `journal.less`: `.journal-group*` — категорийные акценты (`--jg-accent` per `card-play`/`card-action`/`corporation-action`/`ceo-action`/`standard-project`/`copied-action`/`generic`), connector, иерархия, collapse-toggle, fresh; reduced-motion учтён. Переиспользует `JournalTokenRenderer` (card/player чипы, «показать на карте» — работает в детях и заголовке).

### XII.3. Сценарии (§16) — покрыты
Pets (под размещением города/SP), Media Group (под розыгрышем события), Arctic Algae (под океаном), Earth Catapult (скидка-деталь), Standard project (SP — это root-группа), VIRON (copied-action группа). Тесты: `tests/events/EventStream.spec.ts` (атрибуция + группировка + категория), `journalView.spec.ts` (чистая группировка + category + fallback + фильтр-порядок), `tests/client/components/journal/JournalGroup.spec.ts` (mount: рендер/collapse/expand/filter).

### XII-bis. Polish-итерация — единый grouped cluster + top-level режим (СДЕЛАНО)
Журнал доведён от «дерева под строкой» до **цельного premium-кластера**:
- **Grouped surface:** `JournalGroup` теперь — единая стеклянная поверхность с **категорийным spine** слева
  (`.journal-group__spine`), который связывает root-заголовок и дочерние строки в ОДНО событие; дети
  «ветвятся» от spine короткими tick-ами (`.journal-group__tick`), индент уменьшен (ближе к root), между
  группами — больше воздуха. Простые действия без последствий остаются плоскими строками.
- **Per-group collapse УБРАН.** Вместо него — **top-level переключатель `Подробно / Сводка`** в шапке
  (`JournalPanel`, состояние в `journalState.detail`, переживает remount). Сводка: только root + компактный
  счётчик последствий (`↳ N`). Подробно: все строки.
- **Компактные context-aware дети:** `JournalGroup.childTokens` отбрасывает ведущий player-чип, когда он
  совпадает с актором root (строка читается как последствие «получил 2 растения», а не самостоятельное
  действие); чужой игрок (Pets соперника) — чип сохраняется как значимая цель. Скидка → «сэкономил N M€
  благодаря …» как тихая деталь.
- Тесты обновлены (`JournalGroup.spec`: cluster/spine, summary-count, drop/keep player-chip, filter). ru:
  `Detailed`/`Summary`/`Consequences`. Чисто: eslint + vue-tsc + make:json; серверный набор не затронут (7137).
- **Следующий polish (опц.):** дети из структурного `GameEvent.impact` (иконки ресурсов + порядок
  «источник → результат», напр. «Pets · Victor → +1 🐾») — нужен lightweight events-route; текущая
  токен-компакция уже даёт читаемый cause/effect без него.

### XII-ter. Event-driven narrative children — источник никогда не теряется (СДЕЛАНО)
Дочерние строки журнала переведены с token-compaction на **structured `GameEvent` → `source → impact`**
(LogMessage остаётся fallback для старых/неподдержанных логов). 7143 серверных + журнальные client-тесты зелёные.

**Сервер (источники-метки + bounded доставка):**
- `EventSource` += `spaceBonus` / `oceanBonus`; `GameEvent` += `space?` / `tile?` (для tile-placed).
- `EventRecorder.withSource(source, fn)` — override источника для вложенных мутаций без своего `from`;
  `recordTilePlaced(player, space, tile)`.
- Инструментировано: `Game.simpleAddTile` → `tile-placed` (со space+tile); `grantPlacementBonuses` →
  бонус клетки в `withSource({kind:'spaceBonus'})`, ocean-adjacency M€ в `withSource({kind:'oceanBonus'})`.
- **Bounded route `GET /api/game/journal-events?id=&generation=`** (`ApiGameJournalEvents`) — отдаёт ТОЛЬКО
  события запрошенного поколения (как и логи), не весь поток. Типы — публичные экономические факты
  (без per-player редакции).

**Клиент (formatter + рендер):**
- `journalEventChild.ts buildEventChildren(events, rootId, rootPlayer)` (pure, unit-тест) → `JournalChildVM[]`:
  effect-triggered/copied-action маркеры **сворачивают** дочерние impact в одну строку («Pets · Victor → +1 🐾»);
  source-метка через kind (card-чип / «Бонус клетки» / «Бонус океанов» / «Производство» / параметр / «Размещение»);
  редундантный source (== root) опускается; получатель-чип только если ≠ актора root; tile-placed → «show on map».
- `JournalChildRow.vue` рендерит source → impact (card-чип / метка, recipient-чип, impact-чипы с реальными
  иконками через `iconClassFor`, кнопка «показать на карте»).
- `JournalGroup` использует event-children при наличии событий (иначе fallback на компакт-LogMessage); summary-
  счётчик считает по event-children. `JournalFeed` строит `Map<correlationId, GameEvent[]>` и пробрасывает в группы.
  `JournalPanel` параллельно фетчит события поколения (length-guard против churn на silent-поллах).
- Стили `.journal-child-row*` (source-метка, impact-чипы, prod-tint) в journal.less; ru: Cell bonus/Ocean bonus/
  Global parameter/Game rule/Placement/copied (Production/Temperature/Oxygen/Oceans/Venus переиспользованы).
- Тесты: `tests/events/journalEventChild.spec.ts` (6: spaceBonus/oceanBonus/Pets-fold/tile/redundant-drop/impactChips),
  `JournalGroup.spec` event-mode.

Итог §16/§12: «получил 2 растения» → «Бонус клетки → +2 🌿»; «получил 2 M€ за океаны» → «Бонус океанов → +2 M€»;
Pets → «Pets · Victor → +1 животное»; Media Group/Earth Catapult(скидка)/VIRON(copied) — все через source → impact.

**Fix «источник пустой»:** КАЖДАЯ строка теперь имеет явный источник (§3) — убрано подавление source==root.
Оплата: `pay()` обёрнут в `withSource({kind:'payment'})` (новый kind) → «Оплата → −25 M€»; собственные результаты
действия (напр. +1 произв. M€ у City SP) показывают чип карты-источника; «висячая» стрелка для редкого
source=none убрана. (Подтверждено отладкой: `spaceBonus`/`oceanBonus`/`tile-placed` корректно проставляются и
в реальном `player.process()`-пути — пустой источник на скриншоте был от несобранного клиента; **нужен rebuild**.)

### XII.4. Осталось (follow-up)
- **Effects-overlay rendering** (Vue-панель + route `/api/game/stats/effects` + fetch; данные/провайдеры готовы — Часть XI.5).
- Журнал: богатые **expand-детали из `GameEvent`** (доставка событий генерации отдельным lightweight-route) — сейчас скидка показана через компактный лог-детали; полный «expand тянет GameEvent» — следующий шаг.
