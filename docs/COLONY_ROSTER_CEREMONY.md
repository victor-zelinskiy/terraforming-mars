# СОСТАВ КОЛОНИЙ — плитка входит в игру и уходит из неё (фреймворк)

**Статус: v1 сдан 2026-10-03 вместе с TR10 Fringe Colony.** Плитка колонии, ВХОДЯЩАЯ в игру, УХОДЯЩАЯ из неё или
ЗАМЕНЁННАЯ на своём месте, — событие и для сервера (один писатель, одно типизированное событие, один маркер промпта),
и для экрана (планета уходит со своего места как объект, новая приходит как объект, плитка собирается вокруг неё).
Потребители сегодня: **TR10 Fringe Colony** (замена + колония), **Aridor** (первое действие — добавить плитку),
**соло-сетап** («уберите одну плитку»), **MarsBot-Aridor C30** (сетап бота), **Maria / Prospecting** (серверный путь).

Карта: `docs/TURMOIL_REDUX_FRINGE_COLONY.md`. Промт: `docs/claude/prompts/project-tr10-fringe-colony.md`.
§8 — что НЕ сделано в v1 (читать до того, как опираться на фреймворк).

---

## 1. Сервер — ОДИН писатель состава

`src/server/colonies/ColoniesHandler.ts` (гард единственного писателя — `tests/colonies/ColonyRoster.spec.ts`: ни один
другой файл `src/server` не пишет `game.colonies` / `game.discardedColonies`, кроме дилера и `Game.ts`):

```ts
seatColonyTile(game, player, tile, cause?: EventSource): void                  // вход: push + sort по имени + активация + лог + событие
retireColonyTile(game, player | undefined, tile, cause?: EventSource): void    // уход: остальные смыкают ряд; в резерв — КАК В КОРОБКЕ
replaceColonyTile(game, player, outgoing, incoming, cause?: EventSource): void // АТОМАРНО, тот же индекс, без sort, ОДНА строка журнала
colonyTileOccupiedReason(colony): string | undefined                           // «no colonies, tiles, or trade fleets on it»: колония → флот
colonyTileIsVacant(colony): boolean
colonyTileWillEnterActive(colony, game): boolean                               // ОДНО чтение «войдёт активной» (и проекция, и вход)
```

- **«Как в коробке»** — снятая плитка возвращается в резерв НОВОЙ инстанцией своего класса (трек 1, активность по
  классу, никого на ней): ровно то, из чего `ColonyDealer.restore` пересобирает резерв на загрузке. Спек «вживую ==
  после save/load». `restore` теперь сортирует резерв по имени — как сдача.
- **Стол MarsBot** — входящая плитка садится по правилу стола (активна, трек на `MARSBOT_COLONY_TRACK_START`), одной
  веткой во входе (`enterPlay`); это же чинит плитку C30.
- **Событие** `colony-roster-changed` (`GameEvent.ts`), `impact.colonyRoster: ColonyRosterChange = {kind: 'add' |
  'remove' | 'replace', removed?, added?, slot}` (`src/common/colonies/ColonyRoster.ts`), журнально-видимое, под живым
  скоупом; `cause` называет источник там, где скоупа нет (соло-сетап — `{kind: 'system'}`).
- Тексты логов Aridor / сетапа не менялись; замена пишет `'${0} replaced the ${1} colony tile with ${2}'`.

## 2. Маркер `rosterChange` — проекция, которую клиент не выводит сам

`SelectColonyModel.rosterChange?: ColonyRosterPrompt` (сериализуется `SelectColony.toModel` — вложение-безопасно):

```ts
type ColonyRosterPrompt = {
  kind: 'add' | 'remove' | 'replace';
  outgoing?: ReadonlyArray<{colony, reason?}>;       // remove / replace: КАЖДАЯ плитка в игре, порядок стола
  incoming?: ReadonlyArray<{colony, entersActive, build?: {slot} | {skipped}}>;   // add / replace: по записи на кандидата
};
```

Клиент не решает, кто кандидат на уход, войдёт ли плитка активной и встанет ли куб. У `replace` выбираемые
`coloniesModel` — плитки РЕЗЕРВА; уходящие живут в `outgoing`. Статус каталожной плитки читается из
`incoming[].entersActive`, НИКОГДА из `isActive` каталожной модели (она сериализуется неактивной всегда).

## 3. ОДИН вопрос — ОДИН ответ: четвёртая форма `SelectColonyResponse`

`{type: 'colony', colonyName: <входящая>, replaces: <уходящая>, stagedFor?}`. Валидатор принимает ровно пять наборов
ключей; у промпта `kind: 'replace'` ответ без `replaces` — ошибка, `replaces` вне `outgoing` / с причиной — ошибка (её
текстом); у прочих промптов `replaces` — ошибка; `replaces` + `fleetDock` — не ответ. Между снятием и посадкой нет
состояния сервера: стола с дырой не существует. Адрес staged-хвоста — существующая ветка `colony` в
`deferredInputBatch` (`choiceContext.source.card === stagedFor`).

## 4. Общий шаг `ReplaceColonyTile`

`src/server/deferredActions/ReplaceColonyTile.ts`: `new ReplaceColonyTile(player, cause, {build, canAffordOptions?})`,
`Priority.DEFAULT`; `previewSelectColony()` — read-only близнец, `previewSkip()` — названный пропуск превью.
«Колония, если возможно» — ОДНА функция причин постройки `Colonies.buildBlockedReason(colony, {allowDuplicate?,
canAffordOptions?, active?})` (ей же фильтрует `getPlayableColonies` и называет отключённые плитки `BuildColony`).
Нет пустой плитки / пуст резерв → `recordSkippedEffect` (метка «Colony tile»); колония не встала → `recordSkippedEffect`
(метка «Colony on the new tile», причина постройки). Превью карты — существующий `actionPreviews.colonyPickStep(card,
step)` (параметр обобщён до `ColonyPickSource`): пятой staged-цели нет, режим решает маркер промпта.

**Следующая карта «добавь / убери / замени плитку»** = `seat` / `retire` / `ReplaceColonyTile` + `colonyPickStep`; клиент
читает маркер и получает уровни, стейдж, церемонию и посадку даром.

## 5. Клиент — модуль `src/client/console/colonyRoster/`

| Файл | Что |
| --- | --- |
| `colonyRosterModel.ts` | чистый: уровень пика (`rosterLevel`), `rosterDiff` двух столов, `reanchorColonyCursor`, чтение стейджа (`rosterStageReading` — три факта), такты (`rosterBeats`) и их длина |
| `consoleColonyRoster.ts` | контроллер: состояние, ДВА темпа, холд `colony-roster`, presented-состав, черновик замены |
| `colonyRosterDirector.ts` | GSAP: DEPART · ARRIVE (масштаб плитки и стейджа), RESEAT двумя половинами |
| `console_colony_roster.less` | ПОЗЫ между тактами: свободная орбита, проекция героя, «исходящее место», призрак куба, квитанция |

### 5.1 Два темпа, по одному владельцу

- **Свой поток — армированный гейт транспорта** (форма постройки): `armColonyRosterChange` на A (до POST) →
  `detectColonyRosterChange(prev, next)` (дифф видов ДОЛЖЕН быть армированным изменением, иначе вид просто применяется)
  → `runColonyRosterCeremony` при УДЕРЖАННОМ коммите (`transportHolds.colonyRoster`, стоит ПЕРЕД гейтом постройки: куб
  садится на планету, которая уже пристыковалась) → коммит → `landColonyRoster` шелла (LANDING).
- **Зритель — посев из диффа** в блоке apply: `seedColonyRosterHolds(before, after)` зовётся из
  `gameTransport.seedRewardHolds` И из `App.update` (poll / WS). Сеется ТОЛЬКО пока сетка колоний стоит на экране
  (`registerColonyRosterHost` — проба шелла); свой гейт помечает сыгранное изменение, чтобы посев не сыграл его второй раз.

### 5.2 Законы (каждый — проверяемое утверждение)

1. **Плитка — МЕСТО, планета — ОБЪЕКТ.** Двигается только диск (`.con-planet` — один компонент у плитки, стейджа и
   досье). Плитка не летает, не масштабируется, не пульсирует; собирается и разбирается по opacity.
2. **Грамматика одна, порядок зеркальный.** Приход: планета → структура → слова. Уход: слова → структура → планета.
3. **Слот существует раньше объекта.** Свободная орбита: бокс плитки, приглушённая пластина, пунктирное кольцо на месте
   диска (`.con-coltile--orbit`).
4. **Откуда — куда — почему.** Уходящая планета уходит «в глубину» со своего диска; приходящая у зрителя — «из глубины»
   над своим слотом, в своём потоке — герой стейджа из позы проекции.
5. **Реагирует только тронутое, один раз.** Соседние плитки не подсвечиваются и не уступают.
6. **Сетка не пересчитывается на глазах.** Замена не меняет ни одного бокса (гард e2e: слоты прочих плиток до == после);
   изменение числа плиток — один пересчёт под припаркованным слоем либо в такте RESEAT.
7. **Курсор — ИМЯ.** `colonyRailNames` + `reanchorColonyCursor`: вставка перед фокусом не переводит его на другую
   колонию; ушедшая плитка отдаёт фокус преемнику по слоту.
8. **Один владелец темпа** (§5.1).
9. **Холд назван, реактивен и ограничен**: поставщик `colony-roster` с `expire` и `diagnose`; каждый такт кончается ровно
   один раз — по завершению И по прерыванию; A во время церемонии «дожимает» такт (`hurryColonyRoster`).
10. **Нечем мерить — признаться**: `data-colony-roster-degraded` на корне секции; reduced motion — конечные позы.
11. **Presented-состав один**: `presentedColonyRoster(colonies)` — единственный читатель списка плиток сетки.

### 5.3 Такты (базовые мс, через `motionMs()`)

| Такт | мс | Масштаб плитки (зритель) | Масштаб стейджа (свой поток) |
| --- | --- | --- | --- |
| DEPART | 560 | слова 0–140 → структура справа налево 60–220 → диск 160–560 (scale 0.55, opacity 0) | подпись «Снимается» → диск «исходящего места»; у голого снятия — герой |
| ARRIVE | 900 | диск 80–540 (`power3.inOut`) → структура 520–760 → слова 760–900 | диск героя из позы проекции 80–540, стыковка на 540 (поза снята одним классом), покой до 900 |
| RESEAT | 140 + 200 | содержимое отпускает → стол отпущен, один `fit()` → содержимое возвращается | не играется (сетка припаркована) |
| LANDING | 420 + 680 | — | стейдж складывается ДОМОЙ в слот стола существующей фразой (дом перенацелен `retargetColonyFocusHome` на rect покоя плитки ПОСЛЕ `fit()`), сетка — КВИТАНЦИЯ, одно чтение |

### 5.4 Пик состава — уровни одного flow

`rosterChange` → акт `roster` (`colonyPickIntent`). `remove` — всегда стол; `add` — всегда каталог резерва; `replace` —
стол, пока уходящая не выбрана (`colonyRosterDraft.outgoing`), затем каталог. Смена уровня — RESEAT
(`reseatRosterLevel`). B: стейдж → сетка; каталог замены → стол (уходящая снова не выбрана); стол → как прежде.
Стейдж: композиция постройки (если колония встанет) либо пика + чтение состава (`ConsoleColonyFocusStage`, проп `roster`:
«исходящее место», поза проекции, три факта). Подтверждение — `ConsoleShell.onColonyRosterConfirm` (staged-дверь —
адресованный хвост `commitStagedTail`; живая дверь — ответ промпта).

## 6. Журнал

`colony-roster-changed` — своя строка под источником: «Плитка колонии · − Церера · + Ио»; чип — ЧИСТОЕ число плиток
(«+1» добавление, «−1» снятие, у замены чипа нет: стол не изменил размер, а пилюля суммирует чипы одного значка).

## 7. Спеки

`tests/colonies/ColonyRoster.spec.ts`, `tests/deferredActions/ReplaceColonyTile.spec.ts`,
`tests/inputs/deferredInputBatch.spec.ts` § the replacement, `tests/routes/PlayerInputBatch.spec.ts` § the replacement,
`tests/console/colonyRosterModel.spec.ts`, `tests/client/console/colonyRoster.spec.ts`, e2e
`tests/e2e/console-fringe-colony.spec.ts` (фикстура `fringe-colony`, fhd + tv4k) и
`tests/e2e/console-colony-roster.spec.ts` (Aridor — добавление плитки на том же пути, fhd + tv4k).

## 8. Что НЕ сделано в v1 (записано, не спрятано)

- **Зритель не прогнан в e2e и не смотрен глазами.** Посев и такты сетки (DEPART → RESEAT → ARRIVE) покрыты юнитами
  контроллера; спека «второй игрок стоит на сетке, первый играет TR10» нет.
- **Aridor прогнан e2e, соло-сетап — нет.** `tests/e2e/console-colony-roster.spec.ts` (fhd + tv4k, реальная соло-игра с
  `customCorporationsList: ['Aridor']`) ведёт первое действие через стартовый воркспейс: каталог резерва (плиток стола на
  нём нет), статус входа на каждой плитке, стейдж `data-colony-roster="add"` в позе проекции, «Добавить плитку» → на
  сервере ровно +1 плитка, шаг колоний уходит, стартовый поток доходит до поля, деградаций нет. Кадры стейджа и поля
  после A смотрены на fhd. ЧЕГО В СПЕКЕ НЕТ: порядка тактов ARRIVE / LANDING на стартовом воркспейсе (проба TR10 их
  меряет только для замены) и раскадровки «до» со старым путём. **Соло-сетап (`kind: 'remove'`) не прогнан ни руками, ни
  e2e** — код общий (`onColonyRosterConfirm` → гейт → LANDING), но на экране его никто не видел.
- **Слоя полётов `ConsoleColonyRosterLayer.vue` нет.** Диск анимируется на своём месте (в глубину / из глубины), планету
  из каталожной плитки в героя несёт существующий FLIP спуска, из героя в слот — существующая складка. Отдельного
  прокси-диска «из источника в измеренный слот» нет.
- **Проход света по треку и lock-пульс маркера на ARRIVE стейджа не сделаны** — трек стоит зажжённым с открытия стейджа;
  гасить его ради прохода было бы бликом.
- **«Дожать» (A во время церемонии) и reduced motion** проверены только юнитами.
- **Продолжения награды постройки** (цель-карта Титана, океан Европы, добор Плутона) на новом пути руками не пройдены;
  staged-дверь не делает `claimColonyBuildOutcome` (исход розыгрыша заявляет сама рука).
- **Нотификация замены** не несёт собственной пилюли (чипа нет — см. §6); строка события есть в журнале.
- **Причина сворачивания чужого стейджа** («Плитка колонии «…» снята со стола») не называет игрока и карту: дифф видов их
  не несёт.
- **`ColonyDealer.restore` и `customColoniesList`**: резерв после загрузки собирается из полного пула опций и
  кастомный список игнорирует (на столе с кастомным списком резерв после загрузки шире). Спек «вживую == после
  загрузки» этого не вскрыл (стол без кастомного списка) — не чинилось.
