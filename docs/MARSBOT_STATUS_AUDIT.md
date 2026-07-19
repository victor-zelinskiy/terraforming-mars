# MarsBot / Player-chip status — технический аудит

> Read-only аудит перед изменением мгновенного поведения MarsBot. Ничего в игровой
> логике не менялось. Цель — понять, какие статусы хода уже достоверно определимы и
> какую модель безопасно использовать в Player chip (desktop + console native).

## 1. Краткое резюме

**Что уже есть (и это главное):** в форке УЖЕ построен единый resolver-конвейер статусов,
общий для desktop и console:

```
PublicPlayerModel (сервер)
  → actionLabelForPlayer(playerView, player, livePlayersWaitingFor?)   [playerLabels.ts]
  → presentPlayerStatus(label) → {category, glyph, textKey, showCounter} [playerStatusPresenter.ts]
  → рендер: LeftPlayerCard / PlayerStatus / InitialDraftStatusRail (desktop)
            ConsoleStatusStrip (console)
```

Тип статуса — `ActionLabel` (`src/client/components/overview/ActionLabel.ts`), 15 значений
+ пустая строка. Предложенный в задаче `PlayerChipStatus` — по сути ЭТОТ тип. Изобретать
новый не нужно; нужно понять его границы и как честно расширить под бота.

**Что уже покрыто:** `turn` (+ счётчик 1/2), `forcedaction`, `researching`, `drafting`,
`initialdrafting`, `preludes`, `ceos`, `globalsupport`, `delegate`, `next`, `ready`,
`waiting`, `passed`, `none`, и один бот-специфичный `bottheater` («Ходит»).

**Чего нет:** честного «live»-окна хода бота. Промежуточных стадий хода (reveal → resolve
→ placing tile) в статусе нет. `waitingForKind` распознаёт только 2 кросс-фазных промпта
(WGT + делегат) — размещение тайла / оплата / выбор карты во время хода не различаются
(показывается общий `turn`/`forcedaction`).

**Главный вывод по MarsBot:** бот НИКОГДА не виден клиенту как `isActive === true` или
`isWaitingForInput === true`. Его ход резолвится синхронно на сервере, `activePlayer`
уходит с бота ДО сериализации модели, а `setWaitingFor` на боте не вызывается вообще.
Значит статус бота НЕЛЬЗЯ вывести из модели по тем же полям, что у человека. Единственный
существующий «активный» статус бота — `bottheater`, и он управляется КЛИЕНТСКИМ
presentation-состоянием (`botTurnReviewState.open`), а не сервером.

Отсюда честные статусы для бота ПРЯМО СЕЙЧАС:
- **«Ходит» (`bottheater`)** — валидно, но только пока открыт review/театр (клиентское окно).
- **«Спасовал» (`passed`)** — валидно (бот реально попадает в `passedPlayers` при пустой колоде действий).
- **«—» (`none`)** — валидно в END.
- **Счётчик «Действие 1/2» — НЕВАЛИДНО** (у бота нет цикла действий; ровно один флип карты за ход).
- **`researching` / `drafting` — НЕВАЛИДНО** (research/draft бота мгновенны и скрыты, это не окно ожидания).
- **generic `waiting` между ходами — вводит в заблуждение** (бот ничего не ждёт, он уже отыграл).

---

## 2. Где сейчас формируется Player chip status

| Area | File | Function/component | Что показывает | Notes |
| ---- | ---- | ------------------ | -------------- | ----- |
| Resolver (истина «что делает игрок») | `src/client/components/overview/playerLabels.ts:36` | `actionLabelForPlayer()` | Возвращает `ActionLabel` для любого игрока | Единая точка. Порядок: bot-review → isWaiting(+kind) → phase → passed → next → ready → waiting/none |
| Presenter (label → визуал) | `src/client/components/overview/playerStatusPresenter.ts:188` | `presentPlayerStatus()` | `{category, glyph, textKey, showCounter}` | Единая точка маппинга; расширять вместе с `ActionLabel` |
| Тип статуса | `src/client/components/overview/ActionLabel.ts` | `ActionLabel` | 15 значений + `''` | Внутренний ключ, не текст |
| Desktop chip | `src/client/components/overview/LeftPlayerCard.vue:105` | `presentation` computed | Глиф + текст + счётчик `N/2`; классы `--active/--passed/--turn-owner/--turn-burst` | Счётчик только при `showCounter` (label `turn`) |
| Desktop счётчик | `LeftPlayerCard.vue:432` | `actionCounterText`/`actionIndex` | `N/2` | `(actionsTakenThisRound % 2) + 1` |
| Desktop прокидка label | `src/client/components/overview/LeftPlayerPanel.vue:236` | `actionLabelFor(p)` | prop `actionLabel` в каждый `LeftPlayerCard` | Передаёт `livePlayersWaitingFor` |
| Desktop turn-owner рамка | `LeftPlayerPanel.vue:253` | `isTurnOwnerFor(p)` | Рамка цвета игрока | `phase===ACTION && p.isActive`; бот-исключение: `botTurnReviewState.open && p.isMarsBot` |
| Desktop «Automa opponent» | `LeftPlayerCard.vue:36` | template `v-else-if="player.isMarsBot"` | Метка вместо карты корпорации | |
| Desktop legacy top-bar | `src/client/components/overview/PlayerStatus.vue:61` | `getLabelAndTimerClasses()` | Текст статуса + таймер | Используется в SpectatorHome/PlayersOverview |
| Desktop turn-handoff | `src/client/components/overview/TurnHandoffLayer.vue:93` | `owner` computed | Вспышка начала хода + idle-подсказка «Choose an action» | `players.find(p => p.isActive)` при ACTION |
| Desktop initial draft | `src/client/components/initialDraft/InitialDraftStatusRail.vue:58` | `presentationFor(player)` | Тот же chip во время стартового драфта | Тот же конвейер |
| Desktop «не ваш ход» | `src/client/components/WaitingFor.vue:15` | template | «Not your turn…» + список ожидающих | Live-поллинг `/api/waitingfor` |
| Desktop вкладка/фавикон | `WaitingFor.vue:437` | `syncTurnPresentation()` | Спиннер в title вкладки + фавикон | Только для своего хода |
| Console player chips | `src/client/components/console/ConsoleStatusStrip.vue` | `presentation(p)` | Дот + имя + глиф + текст + счётчик `1/2` | ПЕРЕИСПОЛЬЗУЕТ desktop resolver |
| Console «burst» своей активности | `ConsoleStatusStrip.vue` | `myCategory` watcher | Одноразовая cyan-вспышка своего чипа | 2600ms |
| Console центральный баннер | `src/client/components/console/ConsoleShell.vue` | `bannerText` | «Choose a location…» / «Awaiting decision» / title | Специально НЕ «Ваш ход» (это чип) |
| Console InfoMode «Your turn» | `src/client/components/console/ConsoleInfoMode.vue` | `myTurn` + `isPassed` | Мятный «Your turn» / янтарный «passed» | `myTurn` = `hasTurn(playerView)` (ходит по `waitingFor`), НЕ resolver |
| Console бот-дашборд | `src/client/components/console/ConsoleMarsBotSections.vue` | template `automa.*` | Треки/флотеры/деки/storage | Из `GameModel.automa` |

**Дублирования desktop/console нет по логике** — оба идут через `playerLabels.ts` +
`playerStatusPresenter.ts`. Расходятся только Vue-компоненты рендера (`LeftPlayerCard`
vs `ConsoleStatusStrip`) и ДВЕ бот-специфичные детали: console не передаёт
`livePlayersWaitingFor` (третий аргумент resolver), и InfoMode «Your turn» считается
через `hasTurn()` (обход `waitingFor`), а не через resolver.

---

## 3. Какие game/player phases реально существуют

Источник фаз — `src/common/Phase.ts`. Поле `GameModel.phase`.

| Phase/status | Source of truth | Human | MarsBot | Safe for UI now | Notes |
| ------------ | --------------- | ----- | ------- | --------------- | ----- |
| `INITIALDRAFTING` | `game.phase` | ✅ | ⚠️ мгновенно/скрыто | ✅ (человек) | Стартовый драфт (вариант) |
| `RESEARCH` | `game.phase` | ✅ | ⚠️ бот force-`researchedPlayers`, деку строит мгновенно | ✅ (человек); gen1 → `initialdrafting`, gen2+ → `researching` | Бот НЕ покупает |
| `DRAFTING` | `game.phase` | ✅ | ⚠️ бот пикает мгновенно рандомом, без prompt | ✅ (человек) | `AutomaDraft` |
| `PRELUDES` | `game.phase` (в ходе) | ✅ | ❌ у бота нет прологов → сразу pass | ✅ (человек) | gen 1 |
| `CEOS` | `game.phase` (в ходе) | ✅ | ❌ | ✅ (человек) | gen 1 |
| `ACTION` | `game.phase` | ✅ | ⚠️ синхронно, `activePlayer` уходит до сериализации | ✅ (человек); бот — см. §4 | Главный цикл, 2 действия/ход |
| `PRODUCTION` | `game.phase` | ✅ (без ввода) | ❌ бот пропускает фазу | ⚠️ (обычно невидима, симультанна) | `gotoProductionPhase` |
| `SOLAR` | `game.phase` | ✅ (WGT) | роль WGT = бонус-карта B16 | ✅ (`globalsupport`) | |
| `INTERGENERATION` | `game.phase` | — | — | ⚠️ транзитна | Смена first player, инкремент поколения |
| `END` | `game.phase` | ✅ | финальные озеленения мгновенно | ✅ (`none`) | Финал |

Поля состояния (сервер):

| Field | File:line | Set / reset | Значение |
| ----- | --------- | ----------- | -------- |
| `game.activePlayer` | `Game.ts:1369` | set в `startActionsForPlayer`; никогда не null | Чей ход. `isActive = player.id === activePlayer.id` |
| `game.passedPlayers` | `Game.ts:155` | `playerHasPassed` (`Player.pass`); reset в `gotoProductionPhase` | Кто спасовал в этом поколении |
| `game.researchedPlayers` | `Game.ts:156` | барьер research/draft; бот добавляется сразу | size===players → ACTION |
| `player.actionsTakenThisRound` | `Player.ts:178` | inc в `incrementActionsTaken`; reset 0 в `startActionsForPlayer` | Счётчик `1/2` (макс = `availableActionsThisRound`, дефолт 2) |
| `player.waitingFor` | `Player.ts:134` | `setWaitingFor`; clear в `process` | Текущий pending `PlayerInput` — истина «сервер ждёт этого игрока» |
| `player.isMarsBot` | `Player.ts:247` | setup | Флаг бота |

Серверных «человекочитаемых статусов» НЕТ — сервер отдаёт только структурные булевы
(`isActive`, `isWaitingForInput`, `waitingForKind`, `needsToResearch/Draft`,
`actionsTakenThisRound`, `passedPlayers`, `phase`). Все текстовые лейблы — клиент.

---

## 4. MarsBot lifecycle (пошагово)

**Триггер хода:** `Game.playerIsFinishedTakingActions()` → `getPlayerAfter()` = бот →
`Game.startActionsForPlayer(bot)` (`Game.ts:1368`):
```ts
this.activePlayer = player;              // бот становится activePlayer ЗДЕСЬ
if (player.isMarsBot) {
  if (this.phase === Phase.PRELUDES) { this.playerIsFinishedTakingActions(); return; }
  AutomaController.takeTurn(this);       // ВЕСЬ ход — синхронно
  return;                                // НЕ вызывает takeAction()/setWaitingFor()/save()
}
```

**`AutomaController.takeTurn` (по порядку):**
1. Открыть journal-scope `beginAction(bot, undefined, {category:'automa-turn'})` (correlationId хода).
2. `AutomaTurnLog.begin` — снапшот всех игроков (stock/production/TR) + board.
3. (Hard/Brutal, первый ход поколения) hard-claim вехи, если 8+ M€ и давление — иначе скип.
4. (Delta/Гидросеть, первый ход поколения) продвинуть треки, наград не берёт — иначе скип.
5. Пустая колода действий → лог «passed», шаг `{kind:'pass'}`, finish, `return`.
6. Перевернуть ОДНУ карту колоды действий (`revealedCard`).
   - project → резолв тегов слева-направо → advance трека → track-action (каскады: raise param / floaters / **тайл** через `AutomaTilePlacer` / **веха/награда** / TR); нет тега/трек макс → Failed Action (+5 M€, +3 Easy).
   - bonus → `resolveBonusCard` + `routeBonusCard` (тайлы/атаки/колонии/MA/добор), отметить fate (destroyed/recurring/discarded).
7. `AutomaTurnLog.finish` — diff снапшотов → `impact`-шаги + `visual` (тайлы+параметры) + `correlationId`; пишет `lastTurn` + `turnHistory`.
8. Закрыть scope; если флаг pass — `playerHasPassed(bot)`; `playerIsFinishedTakingActions()` (двигает игру дальше).

**Сколько действий за ход:** РОВНО ОДИН флип карты (или pass). Аналога «Действие 1/2»
НЕТ — нет цикла `actionsTakenThisRound`, нет «take your next action». Поколение
заканчивается по истощению колоды (бот пасует, как человек).

**Между поколениями:** production бот пропускает (`gotoProductionPhase` пропускает бота);
research/draft строит деку мгновенно (force-`researchedPlayers`); финальные озеленения —
все разом без prompt; instant-loss (round 20/18) → `instantWin=true` → `gotoEndGame`.

**isActive / isWaitingForInput у бота — ОКОНЧАТЕЛЬНО:**
- `isWaitingForInput` — **НИКОГДА true**. `setWaitingFor` на боте не вызывается нигде в `src/server/automa/`.
- `isActive` — true только внутри синхронного `takeTurn`, но `takeTurn` не делает `save()`/не строит модель, а `activePlayer` уходит с бота до возврата в обработчик запроса. **Ни одна клиентская модель не увидит `isActive===true` у бота.**
- Единственный «live» серверный намёк — `MarsBotModel.revealedCard` (ставится в резолве, чистится в конце) — виден клиенту лишь если ход прервал human-подпромпт И игра сохранилась в этот момент (редко).

**Где ход бота ждёт человека (не мгновенно):** B02 Invasive Species (`SelectCard` человеку),
бонусы владельцам колоний (`GiveColonyBonus`). Промпт приходит как `waitingFor` ЧЕЛОВЕКА
ПОСЛЕ коммита хода бота — бот сам никогда не пауза, никогда не ждущий.

**Как клиент узнаёт о ходе:** только диффом модели. `MarsBotModel.lastTurn`/`turnHistory`
(+`correlationId`) → `recordBotTurnsFromView` → архив (`marsBotTurnArchive.ts`) →
`presentFreshBotTurns` (компактная нотификация `bot-turn` TTL 5s, holdsFlow) + staged
visual commits + review/театр/журнал «Осмотреть ход».

---

## 5. Что можно показывать в Player chip сейчас

**Human, desktop + console (единый resolver, УЖЕ работает):**
`turn` (+1/2), `forcedaction`, `researching`, `drafting`, `initialdrafting`, `preludes`,
`ceos`, `globalsupport`, `delegate`, `next`, `ready`, `waiting`, `passed`, `none`.

**MarsBot, desktop + console — ЧЕСТНО прямо сейчас:**
| Статус | Валидность | Источник |
| ------ | ---------- | -------- |
| «Ходит» (`bottheater`) | ✅ но только пока открыт review/театр | `botTurnReviewState.open` (клиент) |
| «Спасовал» (`passed`) | ✅ | `game.passedPlayers.includes(bot.color)` |
| «—» (`none`) | ✅ | END |
| «Действие 1/2» | ❌ ложь (нет цикла действий) | — |
| «Покупает/драфтит» | ❌ (мгновенно/скрыто) | — |
| generic «Ожидает» между ходами | ⚠️ технически, но читается как «забыт» | fallthrough |

**Условно валидно сейчас (без backend-изменений, только шире клиентское окно):**
`bottheater` можно зажигать не только при открытом review, а во ВСЁМ окне presentation
бота — пока видна компактная `bot-turn` нотификация ИЛИ идёт staged-commit ИЛИ открыт
review. Это честно (бот реально «ходит» в глазах игрока в этот момент) и не выдумывает
серверное состояние.

---

## 6. Что лучше НЕ показывать сейчас

- **Счётчик «Действие 1/2» боту** — прямая ложь: у бота один флип карты за ход, нет
  `actionsTakenThisRound`-цикла. `presentPlayerStatus('bottheater').showCounter === false` — уже правильно, не менять.
- **`researching` / `drafting` / `preludes` / `ceos` боту** — эти фазы у бота мгновенны и
  скрыты (force-`researchedPlayers`, рандом-пик), реального «окна ожидания» нет. Лейбл
  подразумевал бы, что бот «сейчас думает над покупкой» — этого не происходит.
- **`waiting` боту между ходами** — технически «партия идёт, не активен», но бот ничего
  не ждёт (он уже отыграл мгновенно). Читается как «забытый игрок». Лучше `none`/пусто
  вне окна presentation.
- **Любой live «Placing tile / Resolving / Reveal» боту** — сейчас невозможно честно:
  `revealedCard` клиент почти никогда не видит (нет save mid-turn). Это станет валидным
  ТОЛЬКО после staged execution (изменение pacing).
- **`isActive`-производный статус боту** — модель никогда не отдаёт `isActive===true` для бота.

---

## 7. Предложенная модель PlayerChipStatus

**Модель уже существует — это `ActionLabel` + `presentPlayerStatus`.** Не вводить новый
тип; аннотировать и (в будущем) расширить существующий.

Существующие значения:

| Label | Short (RU) | Long/tooltip | Icon (глиф) | Human/Bot/Both | Source | Safe now |
| ----- | ---------- | ------------ | ----------- | -------------- | ------ | -------- |
| `turn` | Действие + 1/2 | Обычный ход, слот действия | dot (pulse) | Human | `phase===ACTION && isActive` | ✅ |
| `forcedaction` | Действие | Триггер-реакция вне слота (Philares) | dot | Human | `isWaiting && !isActive` | ✅ |
| `researching` | Покупка карт | Покупает карты поколения | dot | Human | RESEARCH gen2+ + isWaiting | ✅ |
| `drafting` | Выбор карт | Драфт между поколениями | dot | Human | DRAFTING + isWaiting | ✅ |
| `initialdrafting` | Стартовый выбор | Корпорация + стартовая рука | dot | Human | INITIALDRAFTING / RESEARCH gen1 | ✅ |
| `preludes` | Фаза прологов | Играет прологи | dot | Human | PRELUDES + isWaiting | ✅ |
| `ceos` | Фаза директоров | Играет CEO | dot | Human | CEOS + isWaiting | ✅ |
| `globalsupport` | Поддержка | WGT — поднять параметр | dot | Human | `waitingForKind==='globalsupport'` | ✅ |
| `delegate` | Выбор делегата | Turmoil делегат/партия | dot | Human | `waitingForKind==='delegate'` | ✅ |
| `bottheater` | Ходит | Ход бота (проигрывается клиентом) | dot | **Bot** | `botTurnReviewState.open` (клиент) | ✅ (в окне presentation) |
| `next` | Следующий | Ходит сразу после текущего | chevron | Human | ACTION, предыдущий waiting, 3+ игроков | ✅ |
| `ready` | Готов | Отправил выбор, ждёт остальных | check | Human | симультанная фаза, не waiting, не passed | ✅ |
| `waiting` | Ожидает | Пассивный простой | clock | Human | иначе | ✅ |
| `passed` | Спасовал | Спасовал в поколении | pause | Both | `passedPlayers.includes` | ✅ |
| `none` / `` | — | Ничего не показывать | none | Both | END | ✅ |

Предлагаемые НОВЫЕ значения (только когда дойдёт до pacing):

| Label (proposed) | Short (RU) | Long | Icon | Applies | Source | Safe now |
| ---------------- | ---------- | ---- | ---- | ------- | ------ | -------- |
| `bot-resolving` | Разбирает ход | Резолвит перевёрнутую карту | cpu/gear | Bot | staged execution → `revealedCard` | ❌ требует backend pacing |
| `bot-placing-tile` | Ставит тайл | Размещает озеленение/город/океан | tile | Bot | staged execution → `visual.tiles` | ❌ требует backend pacing |
| `bot-passed` (опц.) | Спасовал | Колода действий пуста | pause | Bot | уже покрыт `passed` | ✅ (можно просто `passed`) |

**Что backend-driven:** `turn/forcedaction/…/passed/none` (структурные булевы сервера).
**Что вычисляется на клиенте:** маппинг фаза→лейбл (`playerLabels.ts`), окно `bottheater`.
**Что опасно на клиенте:** любое «угадывание» серверной стадии, которой нет в модели
(например, «бот ставит тайл» без реального сигнала — это выдумка, пока нет staged pacing).
**Fallback:** `waiting` (человек) / `none` (бот вне окна presentation) / `none` (END).
**Одинаково desktop+console:** ВСЕ, потому что оба идут через один resolver — сохранять инвариант.
**Short label:** есть у всех (`textKey` + счётчик).
**Long tooltip:** сейчас отсутствует — точка роста (можно добавить в presenter).
**Иконка:** уже есть 6 глифов (dot/check/pause/chevron/clock/none); для бота стоит ввести
отдельный глиф (cpu/бот), чтобы «Ходит» бота визуально отличался от человеческого active.

---

## 8. Минимальный безопасный implementation plan (НЕ реализовывать)

- **Шаг 1 — resolver уже общий.** `actionLabelForPlayer` + `presentPlayerStatus` — не
  трогать инвариант «desktop и console через одну точку».
- **Шаг 2 — desktop уже подключён** (`LeftPlayerCard`/`InitialDraftStatusRail`).
- **Шаг 3 — console уже подключён** (`ConsoleStatusStrip`); опционально выровнять:
  прокидывать `livePlayersWaitingFor` третьим аргументом и там (сейчас нет).
- **Шаг 4 — bot fallback БЕЗ backend-изменений:** ввести единый клиентский предикат
  `isBotPresentationActive(botColor)` = (review открыт) ИЛИ (видна компактная `bot-turn`
  нотификация) ИЛИ (идёт staged commit), и зажигать `bottheater` во ВСЁМ этом окне, а не
  только при `botTurnReviewState.open`. Вне окна — `passed` (если в `passedPlayers`) или
  `none`. Отдельный бот-глиф. Это честно и не выдумывает серверное состояние.
- **Шаг 5 — позже, ПОСЛЕ изменения pacing:** добавить `bot-resolving`/`bot-placing-tile`
  под staged execution. Тогда сервер должен отдавать промежуточную стадию (например,
  `revealedCard` + текущий шаг), сериализуемую между стадиями; статусы читают её, а не
  угадывают.

---

## 9. Open questions / uncertainties

- **Окно `bottheater` и компактная нотификация:** сейчас `bottheater` строго на
  `botTurnReviewState.open`. Пока видна компактная `bot-turn` карточка (review НЕ открыт),
  чип бота падает в `passed`/`waiting` — «ход бота идёт, а чип не активен». Нужно ли зажигать
  «Ходит» на всё окно presentation — вопрос UX-политики (рекомендация: да, шаг 4).
- **console vs desktop `livePlayersWaitingFor`:** console не передаёт live-поллинг в
  resolver. В 1v1 против бота эффект минимален, но при мульти-человек это расхождение.
- **`waitingForKind` покрывает только WGT + делегат.** «Ставит тайл / оплата / выбор
  карты» во время хода не различаются (общий `turn`/`forcedaction`). Расширять ли —
  требует серверной классификации `waitingFor` (аналог `detectWaitingForKind`).
- **`revealedCard` как live-сигнал:** технически сериализуется, но клиент видит его только
  при save mid-turn (human-подпромпт внутри хода бота). Как стабильный статус пока не годится.
- **Multi-human + bot:** сервер жёстко 1v1 (один бот). Presentation-окно бота на
  нескольких зрителей не проверялось (задокументированная будущая фича).
- **Staged pacing ещё не спроектирован:** какие именно стадии станут отдельными visual
  boundaries (reveal / каждый тег / каждый тайл / каждая атака) — определяется задачей о
  pacing; статусная модель к ним готова (`MarsBotTurn.steps` уже типизированы:
  pass/reveal/tag/advance/failed/attack/impact/log).
