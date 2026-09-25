# RX24 · Open IP Trade (Учёные) — первая резолюция с ДЕЙСТВИЕМ

**Статус: СДАНА 2026-09-25.** Вторая карта Учёных и **первая карта каталога с действием**: «При принятии:
возьмите по карте за каждое влияние. Действие: сбросьте любое число карт; за каждую сброшенную карту
получите 3 M€ и возьмите карту.» Задание председателя: разыграйте 2 зелёные карты. Дополнений не требует.

Тип `ResolutionAction` был объявлен давно и не использовался: путь «действие резолюции → меню игрока →
консоль» построен этой картой целиком, и построен как **член того же семейства, что партийные
действия** — один маркер-близнец, одна модель, один композер, одна сцена. Следующая карта с действием
(Manufacturing Run) повторит этот путь, не строя второго.

Промт: `docs/claude/prompts/resolution-rx24-open-ip-trade.md`. Файл карты:
`src/server/parliament/resolutions/scientists/OpenIpTrade.ts`.

---

## 1. Объявление

```ts
scaled: [{id: 'draw', unit: {kind: 'cards'}, perInfluence: 1, recipient: 'each'}],   // добор = влияние, интейк RX05/RX16
immediateSteps: [DRAW_STEP],
quest: {goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2},              // «2 зелёные карты» — по ТИПУ
action: OPEN_IP_TRADE_ACTION,                                                        // usesPerGeneration · canAct · execute · preview
```

Немедленная часть — путь RX16 без уровня: `ExternalDrawIntake.open` в шаге, `takePromptFor`, фаза владеет
ожиданием; влияние 0 — названный пропуск («No influence»), пустая колода — названный пропуск, короткая —
`drawn < amount` и строка журнала. Бот не участвует.

## 2. Действие резолюции: путь, который повторит следующая карта с действием

| Слой | Партийное действие | Действие резолюции (этой картой) |
| --- | --- | --- |
| маркер промпта | `partyActionPrompt: PartyActionPromptMeta` | **`resolutionActionPrompt: ResolutionActionPromptMeta`** `{resolution, party, stage: 'choose', usesLeft, usesPerGeneration}` — сериализуется на `toModel` `SelectCard` / `SelectOption` / `OrOptions` / `AndOptions` (nesting-safe) |
| выдача в меню | `ParliamentHandler.partyActionOptions` | **`ParliamentHandler.resolutionActionOptions`** рядом (участник · принята карта с `action` · `usesLeft > 0` · `canAct`), подключён в `Player.getActions` одной строкой рядом с партийными |
| контракт карты | `actionInput(player, parliament, meta)` строит промпт, `runPartyAction` — коммит | **`action.execute(player, parliament, meta)` СТРОИТ промпт и ничего не меняет**; ответ — коммит через общий **`runResolutionAction(player, parliament, id, mutate)`** (`resolutions/ResolutionAction.ts`): корневая область под `{kind: 'resolution', id, owner}`, категория `parliament`, строка журнала, **учёт использования ПРИ ОТВЕТЕ** (`recordResolutionActionUse`), мутация |
| учёт | `partyActionUses`, `partyActionUsesLeft` | `resolutionActionUses` (был), **`resolutionActionUsesLeft(player)`** = `usesPerGeneration(player) − uses`; сброс на границе поколения (`resetGenerationUses`) |
| модель клиента | `viewer.partyActions: PartyActionModel[]` | **`viewer.resolutionAction?: ResolutionActionModel`** — общая база `ParliamentActionModel` (`hasAccess · usesLeft · usesPerGeneration · available · reason · preview`); причины: «MarsBot takes no part…», «This resolution action was already used this generation», причина `canAct` |
| счёт колеса | `availablePartyActionCount` | та же функция считает и действие резолюции |
| консоль: источник | `PartyActionSource` → плитка партии | **`ResolutionActionSource`** (`ParliamentActionSource` = объединение; `parliamentActionSources` в `ConsoleCardActions`): плитка с лицом закона в досье, эмблема партии на плите, кикер «Действие резолюции», печатная строка действия (только ряд `b.action` лица), общая лестница статусов (`parliamentSourceStatus`); ключ `RESOLUTION_<id>` (`resolutionTileKey`) |
| консоль: композер | `ConsolePartyActionComposer` (`party`) | **тот же компонент**, prop `resolution` → `kind === 'resolution'`: герой = `premium-card-face` закона; решение = рука как встроенный шаг; сцена продажи; зона исхода добора |
| консоль: мост | `bridge.actions[actionId]` | **`bridge.resolutionAction`** по маркеру; `resolutionActionResponse(bridge, cards)` = `{type: 'or', index, response: {type: 'card', cards}}` |
| дверь из Парламента | A на плите партии → `open-action` | **Y «Действие резолюции»** на любой зоне обзора (`parliamentCommands`: контрол `inspect`) → `open-resolution-action` → `openParliamentResolutionAction` — тот же workspace вложенным шагом («⚖ ПАРЛАМЕНТ › ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ › ВЫБОР…»), спуск с карты правительства (`armResolutionActionDescent`), отказ по `resolutionActionRefusal` |
| запись флоу | `partyFlow {party, actionId, stage}` | тот же `ConsolePartyFlow` с `resolution` (`actionId` необязателен) |
| стенд | — | блок ДЕЙСТВИЕ: печатный ряд, ставка (`IClientResolution.actionPreview` = `action.preview()` без места), синтетическая рука 0 / 1 / 4 |

Что здесь **не** сделано и почему: `execute` резолюции получает `parliament` (нужен коммиту) — партийный
`actionInput` уже получал; DEV-пример `Foundry Subsidy` переведён на контракт «промпт строит, ответ
делает». Сцена продажи патентов **не вызывается как действие**: переиспользована её ФОРМА (мультивыбор на
руке) и СЦЕНА (терминал); сама сцена обобщена — `armPatentSale({cards, payoutPerCard, source, kicker})`.

## 3. Действие карты — чтения

1. Раз за поколение (`usesPerGeneration → 1`); сброс — граница поколения.
2. Держат только участники, пока карта принята: другая карта заняла слот — опция исчезла из меню, модель без
   `resolutionAction`, `usesLeft` 0.
3. Недоступно с причиной, не скрыто: пустая рука («No cards in hand to discard»), потрачено, не свой ход
   (плитка «Не сейчас»).
4. «Любое число» — не ноль: `SelectCard {min: 1, max: рука}`; пустой ответ отвергает сам инпут («Not enough
   cards selected»), поверх — `InputError('Discard at least 1 card')`.
5. Порядок внутри коммита: `discardCardFromHand` каждой → `stock.add(M€, 3N, {from: {resolution}})` →
   `drawCard(N)` — обычный добор своего хода, карты сразу в руку (НЕ внешний интейк). Колода короче N —
   выдано сколько есть, строка «Only ${0} of ${1} card(s) were left in the deck…»; сброшенные карты уходят в
   сброс ДО добора, и при пустой колоде перетасовка может вернуть их же — штатное поведение движка.
6. Журнал: «${0} used the action of ${1}» + «${0} discarded ${1} card(s) for ${2}: gains ${3} M€ and draws
   ${4} card(s)»; каждое событие внутри — под источником закона с владельцем-местом.
7. Задание: зелёная = `CardType.AUTOMATED`; синяя, событие, прелюдия, корпорация — нет; сброс этим действием
   — не розыгрыш; розыгрыш под источником-резолюцией и вне фазы действий — не считается (Q5).

## 4. Один поток через workspace

```
⚡ ДЕЙСТВИЯ КАРТ › ОТКРЫТАЯ ТОРГОВЛЯ ПАТЕНТАМИ › ВЫБОР        (рука — встроенный шаг рядом с героем)
                                                › ПРОДАЖА      (сцена терминала, чип +3N M€ → рельса)
                                                › ДОБОР КАРТ   (раскрытие в зоне исхода того же композера)
```

* **ВЫБОР.** Композер (kind `resolution`) при монтировании отдаёт выбор hand-pick bridge’у
  (`enterConsoleHandPick`) с новыми полями запроса: `hosted: {stage: 'Selection'}` — рука встаёт как ШАГ
  workspace (`card-actions ⊃ hand`, слот `action-hand` **внутри колонки решения**, `con-pact__handzone--inline`),
  а не оверлеем над спрятанным композером; `leaving: 'sale'` — при подтверждении шелл НЕ армирует сцену
  сброса (карты уйдут в терминал); `gainPerCard: {megacredits 3, cards 1}` — салебар продажи «Выбрано: N · +3N M€
  · +N карт · было → станет» (`payout.cards`, `[data-hand-sale-cards]`); `discard` — сырой маркер сервера
  (дискардный скин: «Сбросьте до N карт · Резолюция»; его строка-своп уступает салебару, когда тот есть);
  `source: {kicker: 'Resolution action', card: <имя закона>, resolution: id}` — L3 «Источник» открывает
  осмотр резолюции. A = отметить, L3 = все, RT = «Сбросить N» (недоступно при нуле — `min 1`). B = назад:
  композер закрывается, рука-шаг покидает стек (падение `handPickActive` у хостимой руки без активной продажи).
* **ПРОДАЖА.** `commitResolution(cards)`: `armPatentSale({cards, payoutPerCard: 3, source: 'resolution',
  kicker: имя закона})` — ректы живых слотов схвачены в том же синхронном такте, карты поднимаются,
  переворачиваются, стекаются в терминал; универсальный ACTION COMMIT фиксирует героя (`playCommitBeat`);
  ответ уходит хосту (`onPartyConfirm(response, {expectedCards})`), хост **клеймит добор** под ключом закона
  (`claimWorkspaceOutcome('card-actions', RESOLUTION_<id>, ['draw'], 0, N)`). На фазе `inserting` шелл
  снимает руку-шаг (не `goBoardHome` — ветка по `patentSaleState.source`), workspace остаётся; детект —
  по ответу (карты реально ушли из руки), холд транспорта `runPatentSale` — до посадки чипа на рельсу,
  счётчик тикает на посадке; `partyFlowOwed` держит workspace, пока сцена активна.
* **ДОБОР.** Дверь — `beatMayStart`: бит добора (вытягивание N карт с HUD-стопки в подготовленные слоты
  зоны исхода) не стартует, пока `patentSaleState.active`; каждая фаза продажи перезаряжает бит клейма
  (`rearmWorkspaceOutcomeBeat`), чтобы страховочный таймер клейма (2,6 с) не открыл раскрытие поверх
  неначатого вытягивания при долгом сервере. Когда терминал ушёл — `playConfigRelease` → `playOutcomePhase`
  → `beginBeatFlight` → раскрытие в зоне (`workspaceClaimsDrawReveal` знает `{type: 'resolution'}` —
  сервер называет закон источником добора). Взятие — интейк в руку.
* **Завершение.** Падение клейма (`partyOutcomeOn` false после взятия) → `concludeFlow` → `flow-complete` →
  `concludeWorkspaceFlowOrOwe('card-actions')` — guarded conclusion; из Парламента — обратно в Парламент.
* **Отказ сервера / потеря ответа**: `resetPartySubmit` возвращает `setup`, композер заново открывает выбор с
  прежними отметками (`submitting` ↓ без клейма и без сцены).

## 5. Чтения

* Панель голосования / осмотр: немедленная часть — семейство `influence` («карт: влияние N → N»); действие —
  блок `text.action` (`parliamentAnnotations` группа `group:action`), кикер «Действие, пока принята» у тихой
  награды; правительство печатает «Действие резолюции» над печатной строкой.
* Список действий — плитка с `usesLeft`, причиной и превью ставки «за карту» (`preview`: −1 карта, +3 M€,
  +1 карта, все с `note: 'per card'`); живая сумма — на шаге выбора.
* Стенд «Полигон» — блок ДЕЙСТВИЕ (`data-rxpg-action`): печатный ряд действия, ставка из манифеста,
  синтетическая рука 0 / 1 / 4 → «недоступно · в руке нет карт» / «1 → +3 M€ · +1» / «4 → +12 M€ · +4».
  Причина пустой руки на стенде — тот же ключ, что у сервера (стенд не зовёт `canAct`).

## 6. Бюджет проверки

| Где | Что |
| --- | --- |
| `tests/parliament/OpenIpTrade.spec.ts` | 23: каталог (RX24, Учёные, 1 копия, добор + действие, задание automated ×2, семейство `influence`, ставка действия); принятие — добор всем по влиянию через интейк (withheld, cause, choiceContext), влияние 0 названо, короткая/пустая колода, reload внутри взятия; действие — в меню по маркеру рядом с партийными (SelectCard 1..рука, `discardPrompt.exchange`, маркер на проводе), не предлагается при пустой руке / потраченном / другой карте (модель с причиной), счёт колеса, ноль карт отвергнут и ничего не потрачено, коммит 3 → −3/+9/+3 под источником закона (все события), журнал, короткая колода честна, граница поколения через реальное заседание, reload, MarsBot; задание — automated считается, active/event/prelude нет, сброс этим действием нет, под источником-резолюцией/вне фазы нет; модель |
| `tests/parliament/ResolutionContract.spec.ts` | без правок — зелёный на RX24 и на dev-примере с новым контрактом |
| клиентские юниты | `consoleCardActions` (+3: источник закона рядом с картами, лестница статусов, repeat/ключи), `consoleParliamentModel` (+3: мост по маркеру и ответ, лестница состояния, Y на трёх зонах), `consolePatentSale` (+2: ставка/источник/кикер), `consoleWorkspaceOutcome` (+2: клейм по закону, перезаряд бита) |
| e2e | ОДИН `console-parliament-openip` (standard-1080), фикстура `parliament-openip-enacted` — пробник на своём такте (`setInterval` 40 мс): шаг руки → сцена → чип рождён на ВИДИМОМ терминале у щели с «+6» → сел на ВИДИМУЮ ячейку M€ → счётчик не показывает +6, пока чип летит → раскрытие ПОСЛЕ ухода терминала и посадки чипа → взятие → рука −2 +2, M€ +6, плитка «активирована» |

Гейты: `make:cards`, `make:json`, `lint` (eslint + i18n + vue-tsc), `build:test` (обе ступени), `make:css`.

## 7. Локаль

Сервер (`parliament.json`): имя, эффект, действие, задание, два лога добора при принятии, лог коммита,
лог действия, заголовок промпта, «Discard at least 1 card», «This resolution action was already used this
generation», dev-заголовок; клиент: «Sale» («Продажа»). Переиспользованы: «No cards in hand to discard»,
«No influence», «The project deck is empty», «Only ${0} of ${1} card(s)…», «Resolution action», «Selection»,
«Card draw», «Performing…», «per card».

## 8. Гочи

* **Фикстура `done` открывается на p2** (первый игрок поколения 2 ротируется) — действующее место в e2e —
  красный; хосты `expectViewerOpensGeneration(table, p2)`.
* Рука после `done` = рука старта + аранжированные + добор принятия — ожидание «не меньше N», не «ровно».
* `preview` действия зовётся экспортером **без места** — сигнатура `preview(player?)`; превью карты не
  должно читать игрока (ставка), живая сумма — на клиенте.
* Хостимый hand-pick: `openHandWithReveal({overlay: false})` → `openHandWorkspace()` сажает руку шагом
  верхней рамки (`hosts: 'always'` у `card-actions`); стадия руки публикуется сразу после открытия
  (`setWorkspaceFrameStage('hand', hosted.stage)`).
* Кинематика сброса и сцена продажи спорят за одни карты: `leaving: 'sale'` в запросе — единственный
  переключатель, шелл читает его в `confirmHandSelect`.
