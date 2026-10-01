# Промт исполнителю · TR07 Colony Sponsors («Спонсоры колоний») — десятая карта проектов Turmoil Redux

Выдан 2026-10-01. Инфраструктура набора стоит (TR09, TR08, TR66, TR02, TR01, TR05, TR03, TR04, TR06 сданы) — **ничего из
неё не повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`,
правила карт — `.claude/rules/game-logic.md`, сервер — `.claude/rules/server.md`. **Обязательное чтение до кода:**
`docs/TILE_PLAY_STAGED_COMMIT.md` целиком (STAGED PLAY — эта карта его ЧЕТВЁРТАЯ цель; особо §9-quater «адресованный
хвост» и §9-quinquies «третья цель — резолюция»), `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` §4–§5 (staged vote — ближайший
брат: шаг другого workspace в зоне руки, три исхода коммита), `docs/COLONY_TRADE_FLOW.md` § «THE PRE-TRADE ADVANCE IS ITS
OWN LEG», `docs/claude/console/colony-focus-stage.md` § 7 MODES, `docs/TURMOIL_REDUX_UNITY_BUDGET.md` (волна маркеров RX29),
закон 22 парламента в `.claude/rules/console-ui.md` (его три ловушки общие), память `turmoil-redux-political-donation`,
`tr04-walk-hosted-parliament`, `tr06-fleet-dock`, `panel-reward-hold-is-shared`.

**Серверная часть мала (одна позиция трека). Главное в задаче — ПОДАЧА: бесшовный путь «рука → «Выбрать колонию» →
ритуал розыгрыша → workspace колоний раскрывается в той же зоне → игрок выбирает колонию, видя на КАЖДОМ тайле, куда
встанет маркер → спуск на стейдж колонии → A «Разыграть карту» = ЕДИНСТВЕННЫЙ POST → только теперь маркер идёт по треку
клетка за клеткой до максимума → чтение → поле» одним flow.** До A не отправляется ничего и ничего не двигается.
Оценивается именно это.

| Впервые | Что это | Ближайший образец (уже в коде) |
| --- | --- | --- |
| **ЧЕТВЁРТАЯ цель staged-розыгрыша — КОЛОНИЯ** | сегодня `StagedPlayTarget` = `cell` \| `resolution` (`src/client/console/stagedPlay.ts:70–72`), двери композера — `board` \| `parliament` (`consolePlayCardComposer.ts:225–240`); выбор колонии из розыгрыша всегда приходит ЖИВЫМ промптом после POST | третья цель TR03: `enterStagedVote` (`ConsoleShell.vue:18755`) толкает Парламент в зону руки, `commitStagedVote :18851`, `settleStagedVote :18897` (три исхода), `cancelStagedPlay :19042` |
| **Адресованный хвост `colony`** | `SelectColonyResponse` (`InputResponse.ts:173–182`) — две формы (`colonyName` / `fleetDock` от TR06), адреса нет; `stagedAddress` (`deferredInputBatch.ts:249–255`) знает только `space` и `party`; валидатор сравнивает НАБОР ключей точно | `SelectPartyResponse.stagedFor` + ветка `party` в `stagedMismatch :281–295` (адрес = `choiceContext.source.card` гранта) |
| **Read-only близнец выбора колонии** | семейство `previewSelect*` есть (`previewSelectParty`, `previewSelectCard`, `previewSelectPlayer`), `previewSelectColony` — нет | `PlaceDelegatesOnResolution.previewSelectParty :141` + `actionPreviews.delegateGrantStep :355–358` |
| **Проекция «куда встанет маркер» ДО выбора** | тайл знает только `--effective` от торгового смещения (`ConsoleColonyTile.vue:261–292`, проп `tradeOffset`); инструмент стейджа — проп `effectivePosition` с подписью «Ваша торговля сначала двигает трек» (`ConsoleColonyTrackInstrument.vue:34–36, :211`); «N → MAX» не рисует никто | `--effective` клетка + бейдж `+N` — тот же язык, другой источник числа |
| **Движение маркера по выбору карты, видимое на стейдже** | единственная «установка на максимум» в коде — CEO Наоми: `colony.trackPosition = MAX_COLONY_TRACK_POSITION` голой записью, без лога и события (`ceos/Naomi.ts:44`); волна RX29 ходит ТОЛЬКО по тайлам («never on a focus stage», `ConsoleColonyTradeLayer.vue:858–864`), торговый глайд — сперва по стейджу (`:762`); `holdColonyTracks` зовётся только из такта RX29 (`parliamentWorldBeat.ts:361`), не в блоке apply | `runColonyTrackGlide` (`colonyTradeDirector.ts:254–321`, импульс на клетку `onCellPassed`), `requestColonyTrackWave` (`consoleColonyTrade.ts:1328`), `presentedColonyModel :366` |
| **Значок «трек колонии» на лице** | `CardRenderItemType.COLONY_TILE` есть (`b.colonyTile()`, `CardRenderer.ts:230`), но рисуется ТЕМ ЖЕ ассетом, что `COLONIES` (`assets/tiles/colony.png`, `premiumCardIcons.ts:228, :231`) | ассет владельца `C:\Users\zelin\Downloads\TM Turmoil Redux\Assets\Colony Tile.png` (256×154, прозрачный, «пилюля» плитки колонии); образец добавления глифа — TR04 `agenda-step.svg` (коммит `ecab264da6`) |

### Правила чтения (каждое — закрепить спеком; источник — текст карты + правила «Колоний», свод Redux карту не упоминает)
1. **Требование** «Requires that you have a colony in play» — у игрока ≥ 1 СВОЯ колония: существующее `requirements:
   {colonies: 1}` (`ColoniesRequirement` считает кубы игрока; причина `'Requires ${0} colony(ies)'`, чип `colony.png`).
   Образцы — Space Port Colony, Space Port.
2. **«Choose 1 colony track»** — любой тайл колонии в игре, ЧЕЙ угодно (не только где есть колония игрока), включая тайл
   с пришвартованным флотом (трек от флота не зависит).
3. **Только АКТИВНЫЙ тайл** — у неактивного (Титан, Энцелад, Миранда до своей карты) маркера на треке нет. **Выведено, не
   напечатано**: так читают все пути кода — `Colony.endGeneration` (`:81–84`), мировой шаг RX29 `colonyTrackStep`,
   Market Manipulation (`trackPosition < 6 && isActive`). Неактивный тайл стоит ОТКЛЮЧЁННЫМ с причиной (существующий ключ
   `'This colony is not active yet'` → «Эта колония ещё не активна»).
4. **«Move its marker to the highest (right-most) position»** — УСТАНОВКА, не «+N»: позиция = последняя клетка ЭТОГО тайла
   (`metadata.trade.quantity.length − 1`; у всех тайлов в игре сегодня 6 — но через одну функцию, не константой). Шагов =
   максимум − текущая. Вниз маркер не двигается никогда.
5. **Маркер уже на максимуме** — выбор ничего не изменит → тайл ОТКЛЮЧЁН с причиной «Маркер уже на максимуме» (прецедент
   Market Manipulation). **Ни одного кандидата** (все активные на максимуме) — карта остаётся играбельной (печатное
   требование — только колония; метка Юпитера тоже чего-то стоит), эффект — НАЗВАННЫЙ ПРОПУСК (`recordSkippedEffect`),
   композер говорит это ДО розыгрыша, двери нет. (Решение владельца №2.)
6. **Это не торговля**: задание «совершите N торговель», Venus Trade Hub, флоты — не затронуты. Следующая торговля с этим
   тайлом читает доход на максимуме (у Redux-Плутона снимается отказ нижних позиций — по правилу самой колонии, без кода),
   после неё трек, как всегда, падает к числу построенных колоний.
7. **Журнал**: существующая строка `'${0} increased ${1} colony track ${2} step(s)'` (`LogHelper.ts:71–79`) с шагами =
   максимум − было. Наоми НЕ копировать (голая запись поля без лога).
8. **MarsBot карту не играет** (колода бота — метки); общий трек, сдвинутый игроком, бот читает при своей торговле как
   есть.

### Решения владельца (подтвердить в отчёте, не блокер)
1. **Хореография = РИТУАЛ КАК У TR03** (`TILE_PLAY_STAGED_COMMIT.md` §8-bis): «Выбрать колонию» ничего не отправляет →
   карта ложится в «Разыграно» → из той же зоны раскрывается workspace колоний → выбор → стейдж → A = единственный POST →
   маркер идёт → чтение → уход одной поверхностью на поле. Посадки карты после POST и возврата в композер после коммита нет.
2. Тайл на максимуме и неактивный — отключены с причиной; ноль кандидатов — названный пропуск, карта играбельна (правило 5).
3. RU-имя **«Спонсоры колоний»**.
4. **Значок `COLONY_TILE` переходит на ассет владельца** для ВСЕХ его пользователей — это печатный значок плитки колонии,
   сегодня его рисует чужая картинка: Aridor (Колонии, в скоупе), Early Colonization (prelude2), Maria (CEO), We Grow As
   One (Луна), Prospecting (Underworld). Кадры «до / после» каждого лица — в приёмке. `COLONIES` (куб колонии) не трогать.

### Закон двух уровней (не решение — существующее правило колоний)
«A selects, A confirms — nothing commits on the overview» (`tests/e2e/console-sponsor-colony.spec.ts:9–24`): в сетке A
ВЫБИРАЕТ (спуск на стейдж колонии), на стейдже A ПОДТВЕРЖДАЕТ. B — ровно один уровень: стейдж → сетка → композер.

---

## 0. Рабочее дерево
`git status` на момент выдачи: НЕЗАКОММИЧЕНА работа двух сессий — TR06 4/4 (`tests/e2e/consoleStart.ts`,
`tests/e2e/fixtures/generate.ts`, `tests/e2e/console-water-hauling.spec.ts`, `tests/e2e/fixtures/water-hauling.json`,
`docs/TURMOIL_REDUX_WATER_HAULING.md`, `docs/COLONY_TRADE_FLOW.md`, `docs/claude/turmoil-redux-card-checklist.md`,
`docs/claude/turmoil-redux-cards-progress.md`, `.claude/rules/console-ui.md`) и квитанция торговли
(`src/client/components/console/ConsoleColonyFocusStage.vue`, `src/client/console/colonyTrade/consoleColonyTrade.ts`,
`src/client/console/colonyTrade/colonyTradeReceipt.ts`, `tests/client/components/console/colonyTradeReceipt.spec.ts`,
`docs/claude/console/colony-resolution.md`). **Почти все они — файлы этой задачи.** Серверный блок A и карту (кроме
словарей, если сосед их держит) можно начинать сразу; клиентский блок, e2e и документы — ТОЛЬКО после коммитов соседей
(или согласовать: ListAgents / SendMessage), затем перечитать их файлы заново — номера строк в промте сняты с рабочего
дерева ДО их коммитов. В общих файлах только своя строка/ветка, `git add` по своим путям, свои новые файлы коммитить
сразу, `genfiles/**` руками не править, e2e — из СВОЕГО снапшота (`npm run e2e:snapshot tr07` + `TM_E2E_ROOT=.e2e-tr07`;
4K — только `--workers=1`, память `tr06-fleet-dock`). Тайминги «до / после» — только A/B (память `ab-baseline-head-client-in-snapshot`).
Память `concurrent-session-edits-same-files`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR07.png` (и лист `…\Printables\1-9.png`).
**Арт: `C:\Users\zelin\Downloads\Mars Arts\TR07.png` на момент выдачи ОТСУТСТВУЕТ** — запросить у владельца; всё прочее не
ждёт, импорт (`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR07.png" TR07` → `npm run make:cards`)
— когда файл появится; если не появится до сдачи — назвать в отчёте.

- **Colony Sponsors** · `cardNumber: 'TR07'` · стоимость **5** · тип **AUTOMATED** (зелёная) · метка **Юпитер** (один
  кружок в правом верхнем углу — полосатая планета).
- **Требование** — оранжевая плашка у цены: значок колонии (▲ с куполом) → `requirements: {colonies: 1}`. **ПО нет.**
- **Графика** (один ряд, крупно): `SET [значок плитки колонии] TO MAX`.
- **Текст:** *(Requires that you have a colony in play. Choose 1 colony track. Move its marker to the highest (right-most)
  position.)*
- **Значки слева внизу**: серый ▲ — Колонии → `compatibility: 'colonies'` (как TR66 / TR06); фиолетовый шестиугольник —
  Turmoil: для карты этого манифеста НЕ объявляется (комментарий в манифесте).
- **Лор** EN: *«Next thing you know the colonists will be wearing jerseys with logos on them.»* →
  `assets/text/lore_texts.json` ключ `"TR07"` (после `"TR06"`); RU: **«Глядишь, скоро колонисты будут ходить в майках с
  логотипами.»**

## 2. Блок A · сервер

### A1 · Общий шаг «трек выбранной колонии — на максимум»
`src/server/deferredActions/MaximizeColonyTrack.ts` (имя на усмотрение): `constructor(player, cause: {kind: 'card', card})`.
- `trackTop(colony)` — ОДНА функция максимума тайла (`metadata.trade.quantity.length − 1`), рядом с `colonyTrackRoom`
  (`src/common/parliament/colonyTrackAdvance.ts`) или в `Colony`; клиент читает её же (common).
- Кандидаты — активные тайлы с `trackPosition < trackTop`; отключённые — неактивные и стоящие на максимуме, каждый с ОДНОЙ
  причиной (правила 3, 5).
- `execute()`: кандидатов нет → `recordSkippedEffect` (метка «Трек колонии», причина «все треки на максимуме»; строка в
  `tests/models/skippedEffectRecord.spec.ts`) и `undefined`; иначе `SelectColony(title, 'Select', candidates)`,
  `disabledColonies`, `markChoiceContext(cardEffect(card, undefined, 'effect-choice'))`, маркер **`trackMoves`**
  (A2) → `andThen`: шаги = `trackTop − trackPosition`; 0 (мир сдвинулся между вопросом и ответом) → названный пропуск;
  иначе `colony.increaseTrack(steps)` + `LogHelper.logColonyTrackIncrease(player, colony, steps)` под источником карты.
  Запись событий — та же, что у трековых сдвигов сегодня (grep тег `colony-track`, `ApiGameJournalEvents.ts:50`); новый
  вид события — только если его потребует `crossPlayerCoverageGuard` (соперник обязан увидеть «сыграл карту · трек Луны
  3 → 7» с источником-картой).
- **Read-only близнец** `previewSelectColony(): SelectColonyModel | undefined` — тот же заголовок, кандидаты, отключённые,
  контекст, маркер; `undefined` там же, где `execute()` пишет пропуск. Ничего не мутирует, в очередь не ставит.

### A2 · Маркер промпта — проекция, которую клиент не выводит сам
`SelectColonyModel.trackMoves?: ReadonlyArray<{colony: ColonyName, before: number, after: number}>`
(`PlayerInputModel.ts:923–935`; `SelectColony.toModel :57`) — по записи на каждого КАНДИДАТА. Клиент не считает
«максимум − текущая» и не решает, кто кандидат (инвариант 2). Маркер общий: любой будущий выбор «сдвинуть трек этой
колонии» (Market Manipulation, сёстры набора) читается тем же клиентом — переводить их не нужно.

### A3 · Адресованный хвост `colony` — четвёртая форма закона §9-quater
- Wire: третья форма `SelectColonyResponse` — `{type: 'colony', colonyName, stagedFor: CardName}`; валидатор
  `isSelectColonyResponse` принимает набор `['type', 'colonyName', 'stagedFor']` (сегодня `matches` требует точный набор —
  без этой правки адресованный ответ отвергнется как «не ответ колонии»). `fleetDock` и `stagedFor` вместе — ошибка.
- `deferredInputBatch.ts`: `stagedAddress` — ветка `colony`; `stagedMismatch` для неё: совпадение ⇔ `waitingFor instanceof
  SelectColony && waitingFor.choiceContext?.source.card === address`. Всё остальное — парковка БЕЗ попытки (вклинившийся
  выбор колонии другого эффекта — постройка, торговля, пик Aridor — иначе съел бы ответ); совпадение + отказ `process` =
  честная устарелость → хвост сброшен, вопрос встаёт живым. Baseline-карта клеток не нужна: состав кандидатов фиксирован
  промптом, сдвиг позиции — правило A1 (0 шагов → пропуск). `expireSupersededStagedTail` — покрыть и `colony`.
- Неадресованные ответы `colony` (торговля, причал TR06, постройка, пики) — как были, побайтно.

### A4 · Шаг превью `colonyPick`
`ActionPreviewStep` (`ActionPreviewModel.ts:271`) получает член по образцу `delegateGrant :403`:
`{kind: 'colonyPick', staged: StagedColonyModel}`, `StagedColonyModel = {prompt: SelectColonyModel, sourceCard: CardName}`
(`prompt` — дословно `previewSelectColony()`, с маркером `trackMoves`). Билдер `actionPreviews.colonyPickStep(card, step)`
рядом с `delegateGrantStep :355`; `undefined` без кандидатов — тогда ветка несёт предупреждение (`noteStep('warning', …)`
с той же меткой и причиной, что пропуск A1). **Не `note` и не `input` для двери**: консоль читает шаг СТРУКТУРНО, чтобы
превратить коммит композера в навигацию. Эффекты ветки — без чипов: результат зависит от цели («target-dependent results
are NOT guessed before a target exists»). Классификация — строка в `tests/models/consolePlayPreviewCoverage.spec.ts`
(новый вид шага = не «gap»).

### A5 · Карта — `src/server/cards/turmoilRedux/ColonySponsors.ts`
`Card`, `CardType.AUTOMATED`, `tags: [Tag.JOVIAN]`, `cost: 5`, `requirements: {colonies: 1}`, `cardNumber: 'TR07'`.
- `bespokePlay`: `player.game.defer(new MaximizeColonyTrack(player, {kind: 'card', card: this.name}))`, возврат `undefined`.
  Своего `SelectColony` в файле карты нет.
- `cardPlayPreview(player)`: `actionPreviews.playPreview(this, player, [], [colonyPickStep(this, step)])` (или ветка с
  предупреждением, A4).
- `renderData`: ряд в ряд по скану — `b.text('SET', Size.LARGE, true).colonyTile().text('TO MAX', Size.LARGE, true)`
  (премиум `Size.LARGE` → `pcard-mi__text--lg`, `PremiumMechNode.vue:246–252`; образцы крупных слов — Naomi
  `text('SET ALL')`, Early Colonization); `description` — текст скана; `infoText` — по аудиту `make:cards`.
- `CardName.COLONY_SPONSORS = 'Colony Sponsors'` в секции `// Turmoil Redux` после `WATER_HAULING`; манифест
  `{Factory, compatibility: 'colonies'}`. Шапка файла — чтение скана и правила 1–8.

## 3. Блок B · клиент — ОДИН flow от руки до поля

**Целевой путь игрока (каждая строка — кадр приёмки §6):**
```
КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › РОЗЫГРЫШ          композер: цена 5, «Трек колонии — выбор в «Колониях»»
        │ A «Выбрать колонию»  (НИЧЕГО не отправлено)
        ▼ ритуал: карта ложится в «Разыграно» (счётчики не тикают)
КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › ВЫБОР КОЛОНИИ      колонии в зоне руки: на КАЖДОМ кандидате — призрак маркера на
        │                                               максимуме и «+N»; на максимуме / неактивном — причина
        │ ◀▶▲▼ тайл · A выбрать (спуск) · X осмотреть · L3 источник · B назад (в композер, оплата цела)
КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › ЛУНА · ТРЕК        стейдж колонии: инструмент — маркер на 3, цель на 7 (+4);
        │                                               «торговля здесь: [1 ti] → [4 ti]»
        │ A «Разыграть карту»  → ЕДИНСТВЕННЫЙ POST [projectCard + оплата, {colony, colonyName, stagedFor}]
        ▼ крошка янтарная; маркер стоит на 3 (холд), пока не начнётся ход
        ▼ ход: 3 → 4 → 5 → 6 → 7 клетка за клеткой (каждая пройденная загорается), посадка на 7, табло «3/7 → 7/7»,
          строка «после» отвечает один раз
        ▼ чтение → рука вместе с колониями уходит ЦЕЛОЙ → поле
```

### B0 · Что уже есть — переиспользовать, не переписывать
- STAGED PLAY: `StagedPlayArm`, `PlayComposerDraft`, abort-батарея транспорта (`gameTransport.ts:1208`), ритуал
  `beginStagedPlayLanding :18709`, `reconcileStagedPlayWorldMove :19091`, B через `cancelStagedPlay :19042`.
- Шаг другого workspace в зоне руки: `enterStagedVote :18755` (RELEASE композера и прокси карты на месте, композер
  размонтируется ДО `finishStagedPlayedLanding` — ловушка ② закона 22; «arm ли это мой?» — по СОДЕРЖИМОМУ, не по
  идентичности — ловушка ①), `endHandWithHostedStep :18941` + `handLeaveHook :18966` (рука и шаг уходят ОДНОЙ поверхностью —
  ловушка ③; сегодня знает только Парламент).
- Колонии хостятся рукой уже сегодня (`start ⊃ hand ⊃ colonies`, `consoleWorkspaceStack.ts:940`, e2e
  `console-sponsor-colony.spec.ts`): реестр руки `hosts: 'inFlow'`, слот `[data-embed-slot="hand-play"]`
  (`ConsoleHandSection.vue:369–372`), секция `embedded` (`ConsoleColoniesSection.vue:546`).
- Пик колонии: резолвер `colonyPick` (`ConsoleShell.vue:5461–5493`), режим `pick` секции, спуск на стейдж
  (`confirmColonySelection :15813`), подтверждение `onColonyPickConfirm :15955–16003`.
- Трек: тайл (`.con-coltile__track-cell[data-colony-track-cell="Имя#i"]`, классы `--marker / --effective / --passed /
  --settled`, табло «4/7»), инструмент стейджа (`ConsoleColonyTrackInstrument.vue`, якоря `.con-colfocus__xcell-seat`),
  глайд `runColonyTrackGlide`, холды `holdColonyTracks / releaseColonyTrack(s)` + `presentedColonyModel`, поставщик холда
  `'colony-track-wave'`, замок ввода `isColonyTradeInputLocked()`.

### B1 · Композер розыгрыша — дверь
`playDoorOf` получает `{kind: 'colonies', staged: StagedColonyModel}` для шага `colonyPick`; глагол CTA — новый ключ
**`'Choose the colony'`** («Выбрать колонию»; `'Choose a colony'` уже занят повелительным «Выберите колонию» — это строка
промпта, не глагол кнопки), нижний бар говорит то же (`playComposerFootHints`). Строка следующего шага — новый
`'Colony track — chosen in the Colonies'` («Трек колонии — выбор в «Колониях»») через `playDoorNextStepKey :274`.
Без кандидатов (A4) двери нет: CTA — обычное «Разыграть карту», в РЕЗУЛЬТАТЕ — предупреждение пропуска. Payload
подтверждения несёт `stagedColony` + `composerDraft` по образцу `stagedVote`. Одна классификация — в `playChoiceMode`
и страже `consolePlayPreviewCoverage`.

### B2 · STAGED COLONY — четвёртая цель одного staged-хранилища
- `StagedPlayTarget` получает `{kind: 'colony', pick: StagedColonyModel}`; `stagedColonyOf()` рядом с `stagedVoteOf()`.
  Хранилище одно, `stagedPlayActive()` один, abort-батарея одна. Добавить в батарею сброс трековых холдов и глайда
  (сегодня `abortAllConsoleTransactions` их не трогает).
- Вход — ветка `onPlayCardConfirmNative` рядом с resolution (`:15313–15333`): та же граница v1 — корень стека `hand` и
  спуск жив. Иначе — обычный submit, вопрос придёт живым (B8).
- **Хостинг — обобщить, не копировать.** `enterStagedVote` и новый вход различаются только видом кадра и стадией:
  вынести общий `enterStagedHostedStep(arm, frame)` (RELEASE композера и прокси → push кадра → размонтирование композера
  → `finishStagedPlayedLanding`). Кадр: `{kind: 'colonies', subject: '', stage: 'Colony selection', phase: 'configure',
  serves: [], anchor: {type: 'always'}, sourceCard: arm.cardName}`; кадр руки — `configure`. Секция колоний раскрывается
  из rect, который отпускает приёмная сцена (RELEASE → UNFOLD → REVEAL; `v-if`-смена = блик = дефект). Имя карты в
  крошке не пропадает ни на кадр; встроенная секция себя не титулует — стадия отдаётся ВВЕРХ.
- **Панель флотов**: встроенная секция без причала хоста рисует свою строку-тулбар (`:68–72`) — она крадёт высоту у
  сетки, фит которой высотный. Рука публикует причал в своей шапке (`setColonyFleetBerth`, как `ConsoleCardActions.vue:1488`),
  пока хостит колонии. Чип режима в тулбаре не рисуется: режим называет хвост крошки.
- **B в сетке** = один уровень: кадр колоний снят, композер возвращён штатным entrance из `arm.draft`
  (`setPlayComposerStagedDraft`), оплата / фокус целы, фаза `configure` — ветка `cancelStagedPlay` обобщается по виду
  цели, не дублируется.
- `actionBlockedReason` называет staged-выбор колонии так же, как staged-размещение (одна причина, пока решение открыто).

### B3 · Сетка выбора — проекция на каждом тайле
- Резолвер `colonyPick` получает ВТОРОЙ источник — staged-промпт (как `stagedPlayPrompt` у клетки и мост Парламента у
  резолюции): одна функция, одна модель `ConsoleColonyPick` из живого или staged `SelectColonyModel`. Различий — только
  глагол A на стейдже и B (B5, B8).
- **Тайл** (`ConsoleColonyTile.vue`): проп `tradeOffset` обобщается до ПРОЕЦИРУЕМОЙ позиции тайла (`projectedPosition`
  из `trackMoves` — сетка торговли передаёт `trackPosition + tradeOffset`, поведение торговли побайтно прежнее). На
  кандидате — клетка `--effective` на максимуме (призрак маркера, контур), бейдж `+N`, табло «3/7»; на отключённом —
  `status` с причиной (`tileStatus :1285` — одна функция статуса). Проекция стоит всегда, пока дверь открыта — не «по
  наведению»: игрок сравнивает тайлы, не нажимая.
- **Статус-рейл** тайла в фокусе (`:108–180`, «рейл говорит только то, чего не может тайл»): имя · `3/7 → 7/7` ·
  «торговля здесь: [доход на 3] → [доход на 7]» (`BenefitGlyph`) — либо ОДНА причина.
- Порядок d-pad и фит — как у любой сетки колоний; обзор при прогулке не двигается.

### B4 · Стейдж колонии — интент `track`
Новый `ColonyFocusIntent` **`'track'`** (`consoleColoniesModel.ts:168–190`): композиция отличается от `pick` (там рабочая
половина пуста, рейл — «на текущем уровне»), здесь инструмент — герой.
- Герой — планета + развёрнутый инструмент: `markerPosition` = текущая, `effectivePosition` = максимум; шапка зоны —
  подпись по ПРИЗНАКУ режима, не по тексту: новый ключ `'The marker moves to the top'` («Маркер встанет на максимум») + `+N`
  (сегодня шапка жёстко говорит «Ваша торговля сначала двигает трек» — проп `offsetCaption` / вид смещения).
- Рейл результата: «ТОРГОВЛЯ ЗДЕСЬ» — доход на текущей позиции → на максимуме (два `BenefitGlyph`, у Redux-Венеры —
  фиксированная часть в обоих). Бонус владельцев от трека не зависит — не печатать. Модель чтения — чистая функция
  (`colonyTrackMoveReading(colony, metadata, move)`) со спеком; SFC только рисует.
- Крошка: `КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › ЛУНА · ТРЕК` — грамматика второй двери торговли («<колония> · ТОРГОВЛЯ»);
  стадия — существующий ключ `'Track'` («Трек»; grep — в `ui.json:356`), публикуется вверх (`publishStageName`).
- Команды (`parliamentCommandsOf`-образец для колоний): A **«Разыграть карту»** (существующий `'Play card'` — это и есть
  коммит, второго глагола нет) · B «Назад» (в сетку) · X «Осмотреть» (досье колонии) · L3 «Источник» (карта поверх
  стейджа, не размонтируя его). Литералов кнопок нет (гард `glyphLiteralGuard`).

### B5 · Коммит и три честных исхода
**A на стейдже** = `commitStagedColony(colonyName)` — та же воронка, что `commitStagedVote :18851` (обобщить в один
`commitStagedTail(response)`: цели различаются только хвостом): `markStagedPlayCommitting()`, `claimPlayOutcome`,
`markWorkspaceOutcomeBeatDone`, кадр руки `executing`, кадр колоний `committed` (крошка янтарная, геометрия заморожена,
строки — квитанция без стопов), `submitBatch([...arm.batch, {type: 'colony', colonyName, stagedFor: arm.cardName}])`.
Двойное A поглощено фазой. Played-hero НЕ армить (ритуал уже сыгран).

| Ответ сервера | Признак | Поведение |
| --- | --- | --- |
| **LANDED** | карта в табло, `trackPosition` выбранного тайла = `after` из маркера | холд + ход (B6) |
| **RE-ASKED** (хвост сброшен как устаревший) | `waitingFor` — `colony` с `choiceContext.source.card === arm.cardName` | стоящая сетка / стейдж становится ЖИВОЙ дверью на месте (кадр получает `serves: ['colony']` и якорь `prompt`, B = «Свернуть», крошка янтарная) — без закрытия / открытия |
| **PARKED** (вклинился чужой промпт) | карта в табло, трек не сдвинут, `waitingFor` не наш | коммит реален: шаг уходит БЕЗ хода (ничего не сдвинулось — ничего не идёт), чужой вопрос обслуживается своей поверхностью; трек приходит обычным обновлением + журнал |

Отказ сервера / потерянный ответ — существующая батарея (назад на стейдж, выбор цел, B жив; `STALE_PROMPT` → форс-обновление).
Мир сдвинулся под неотправленным staged — `reconcileStagedPlayWorldMove` без изменений правила.

### B6 · Ход маркера — ОДИН глайд, холд из диффа, только после A
- **Холд в блоке apply** (закон 3 парламента, урок TR04): в том же синхронном блоке, что применяет ответ, при LANDED и
  стоящем стейдже — `holdColonyTracks({[colony]: before})`; иначе маркер на один кадр прыгает на максимум. Сегодня
  `holdColonyTracks` зовётся только из такта RX29 — перенести вызов в посев транспорта для этой цели (одна функция посева,
  не вторая). Холд, который некому отпустить (стейджа нет), не сеять.
- **Один путь глайда**: `requestColonyTrackWave` обобщается до запроса хода с выбором якорей (`stage` — сперва
  `.con-colfocus [data-colony-track-cell]`, затем тайл; `tile` — только тайл, как у RX29 сегодня); третьего глайда и второго
  реестра холдов нет. Стейдж читает ход (`trackGliding :1223` сегодня видит только торговлю).
- **Фраза**: заряд на текущей клетке → шаг по клеткам ровным ритмом торгового глайда (`perCellMs` торговли, без пауз — это
  ОДИН ход, не ступени с наградами) → на каждой пройденной клетке `--passed` загорается на КАСАНИИ, глиф дохода в ней
  отвечает один раз (one-shot до `animationend`) → посадка на максимум, lock-пульс клетки, табло «3/7 → 7/7» перелистывается
  на касании, строка «после» в рейле отвечает один раз → холд отпущен посадкой (не `setTimeout`). Длительности —
  `motionMs()` / `MOTION_EASE`; ввод на время хода — `none` (`isColonyTradeInputLocked()` уже учитывает волну).
  Reduced motion / fx-lite: короткий прямой шаг, конечные позы.
- Нет rect → признаться (свидетель-атрибут образца `noteDegraded`, который e2e требует ОТСУТСТВУЮЩИМ) и встать в конечную
  позу, не «появиться». Прерывания (размонтирование, abort, мир сдвинулся) → конечные позы + отпуск своих холдов.

### B7 · Уход — рука и шаг одной поверхностью
Чтение (класс `CARDLAND_READ_MS`) → `endStagedColony()` = `clearStagedPlay()` + `endHandWithHostedStep()`. Обобщить
`endHandWithHostedStep` / `handLeaveHook` по виду хостимого кадра (сегодня — только Парламент и
`parliamentLeaveRelease`): кадр колоний снимается, охраняемая концовка руки решает, уходит ли рука; уходит — рука
растворяется над полем вместе с колониями внутри, релиз шага едет на её движении. Рука ДЕРЖИТСЯ (розыгрыш ещё что-то
должен — добор от триггера метки) — шаг отпускает на месте, в зоне, куда приходит исход. Парламентская ветка — побайтно
прежняя (`console-political-donation` зелёный без правок).

### B8 · Живая дверь (fallback) — тот же экран
Розыгрыш вне руки-корня (`start ⊃ hand`, standalone, RE-ASKED, reload): обычный submit → живой `SelectColony` с тем же
маркером `trackMoves` → `openColoniesForPrompt` (`:11912`) хостит его там, где стоит flow. Сетка с проекцией, стейдж
`track`, тот же ход после ответа (холд сеется, когда кадр колоний обслуживает этот пик). Отличия от staged-двери — только
A на стейдже («Выбрать» → `submit(colonyResponse)`, `onColonyPickConfirm`) и B («Свернуть»). Одна модель чтения на обе
двери. `console-sponsor-colony.spec.ts` (постройка через `start ⊃ hand ⊃ colonies`) — зелёный без правок.

### B9 · Лицо карты — значок плитки колонии
- Ассет владельца → `assets/misc/colony-tile.png` (сохранить альфу; 256×154 — проверить резкость на 4K в размере лица;
  мылится — сообщить и предложить векторную копию, не апскейлить молча). `premiumCardIcons.ts`: `COLONY_TILE` → новый
  ассет, `COLONIES` остаётся `colony.png` (решение владельца №4). Значок НЕ квадратный: держатель иконки обязан сохранить
  пропорцию (класс-модификатор ширины; растянутая пилюля = дефект). `filter` в консоли вырезан — цвет в самом ассете.
- Ряд «SET [пилюля] TO MAX» крупно, по центру — как на скане; RU-слова на лице (`'SET'` → «ВЫСТАВИТЬ», `'TO MAX'` →
  «НА МАКСИМУМ» — grep, возможно ключи уже есть) — замерить ширину ряда на RU: не влезает в строку — сообщить с кадром и
  предложить форму (не урезать шрифт тихо).
- Требование — существующий чип `colony.png` с «1» (`REQUIREMENT_RENDER`, `premiumCardViewModel.ts:240`).
- Гарды `premiumCardIcons.spec` (строка для `COLONY_TILE`), `premiumCardViewModel.spec` — ворклист.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: `'Colony selection'` («Выбор колонии»,
`colonies.json:181`), `'Colony track'` («Трек колонии», `:171`), `'Track'` («Трек»), `'Play card'`, `'This colony is not
active yet'` (`console.json:311`), `'Requires ${0} colony(ies)'`, лог `'${0} increased ${1} colony track ${2} step(s)'`.
Новые (ожидается ~10):
- `turmoil_redux_cards.json`: `"Colony Sponsors": "Спонсоры колоний"` (**имя — решение владельца**); описание графики:
  «Требует, чтобы у вас была колония. Выберите 1 трек колонии и передвиньте его маркер на высшую (крайнюю правую)
  позицию.»; слова лица `'SET'`, `'TO MAX'` (если нет).
- `card_info.json`: что напечатает аудит; короткий капшен, если гард потребует (бюджет 52 по RU мерить РУКАМИ — модульный
  словарь гарды не видят).
- заголовок промпта `'Select a colony track to move to its highest position'` («Выберите трек колонии — маркер встанет на
  максимум»); причина `'The colony marker is already at its highest position'` («Маркер уже на максимуме»); метка и причина
  пропуска (`'Colony track'` — существует; `'Every colony track is at its highest position'` — «Все треки колоний на
  максимуме»).
- `console.json` / словарь колоний: `'Choose the colony'` («Выбрать колонию»), `'Colony track — chosen in the Colonies'`,
  `'The marker moves to the top'` («Маркер встанет на максимум»), `'Trade here'` («Торговля здесь»).
- `lore_texts.json` RU — §1.

## 5. Тесты
**`tests/cards/turmoilRedux/ColonySponsors.spec.ts`** (`testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true})`):
метаданные (5, AUTOMATED, Юпитер, `{colonies: 1}`, TR07, `compatibility: 'colonies'`); неиграбельна без своей колонии
(причина с `current: 0`), колония соперника не засчитывается; розыгрыш → `SelectColony` с `choiceContext.source.card`,
кандидаты = активные ниже максимума (в т. ч. чужие и с флотом), отключены неактивный и стоящий на максимуме — каждый со
своей причиной, маркер `trackMoves` точен; ответ → трек = максимум, лог с числом шагов, источник — карта; все активные на
максимуме → карта сыграна, пропуск записан (`effect-skipped`), промпта нет; Redux-Плутон: со 2 на максимум → следующая
торговля платит карты без держателя data; `previewSelectColony()` == живой промпт (паритет: заголовок, кандидаты,
отключённые, маркер, контекст); превью чисто (снимок до / после); `colonyPickStep` есть / нет по кандидатам.
**`tests/inputs/deferredInputBatch.spec.ts` § addressed colony**: прямая посадка; вклинившийся `SelectColony` другого
эффекта (постройка, отложенная впереди) → парковка БЕЗ попытки → авто-посадка дренажом; сдвинувшийся между вопросом и
ответом трек → пропуск, не падение; неадресованные `colony` (торговля, причал, постройка) — как раньше.
**`tests/routes/PlayerInputBatch.spec.ts`** — валидатор: три формы `colony` принимаются, `fleetDock` + `stagedFor` вместе
отвергаются.
**Гарды чеклиста §3** — ворклист TR07 пуст; особо `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`,
`cardReasonConsistency`, `promptMarkerGuard`, `crossPlayerCoverageGuard`, `skippedEffectRecord`, `premiumCardIcons`;
`make:cards` 0 / 0 / 0.
**Клиентские юниты**: `consolePlayCardComposer` (дверь `colonies`, глагол, строка шага, ветка без кандидатов),
`stagedPlay` (четвёртая цель), резолвер пика (staged-источник == живой источник на одной модели), проекция тайла (торговля
побайтно прежняя), `colonyTrackMoveReading`, план хода (порядок клеток, ритм, reduced), посев холда (только при стоящем
стейдже), команды сетки и стейджа, обобщённый уход хостимого шага (Парламент не изменился), `consoleWorkspaceStack`
(кадр колоний в руке: `configure` → `committed`, B один уровень).
**e2e — ОДИН спек на новую механику** `tests/e2e/console-colony-sponsors.spec.ts` (не путать с существующим
`console-sponsor-colony.spec.ts`), фикстура `colony-sponsors` (Redux-стол на двоих, имя в `FixtureName`; образцы —
`political-donation`, `water-hauling`): синий — карта в руке, ≥ 10 M€, своя колония на Луне, трек Луны на 2; один тайл на
максимуме; неактивный тайл в игре (если сид его не даёт — синтетика с комментарием, как поддержка в `political-donation`).
Пробник — `MutationObserver` + `setInterval`, не rAF; три утверждения на движение (закон 17: источник виден, адресат
виден, движение было); утверждать ПОРЯДОК, не интервалы:
1. композер: CTA «Выбрать колонию», строка шага; после A — `gameAge` тот же, карта в руке на сервере, ни одного POST
   `/player/input*`;
2. крошка на КАЖДОМ сэмпле содержит корень и имя карты; хвосты только вперёд: РОЗЫГРЫШ → (РАЗЫГРАНО) → ВЫБОР КОЛОНИИ →
   ЛУНА · ТРЕК; `.con-colonies` внутри `.con-hand` (телепорт), второго `.con-ws` нет, тулбара флотов в зоне нет;
3. сетка: у Луны призрак на 7-й клетке и «+4»; тайл на максимуме и неактивный — с причинами; бокс сетки при прогулке не
   меняется (rect); B → композер с той же оплатой; снова вход;
4. A на Луне → стейдж: маркер на 3-й клетке, цель на 7-й, «+4», рейл «торговля здесь»; по-прежнему ни одного POST;
5. A «Разыграть карту» → РОВНО ОДИН POST `input-batch`, хвост `{type: 'colony', colonyName: 'Luna', stagedFor: 'Colony Sponsors'}`;
6. ход: маркер стоит на 3 до старта (холд); `--passed` загорается в порядке 4, 5, 6, 7; табло «7/7» — ПОСЛЕ посадки;
7. сервер по API: трек Луны = 6, карта в табло, M€ −5;
8. конец на поле: нет `.con-ws`, нет stranded, 0 `[console-overflow]`, 0 ошибок страницы, `data-*-degraded` не появлялся.
Профили fhd + tv4k (4K — `--workers=1`). `--repeat-each=4`, `waitForTimeout` = 0, `shardPlan.json` не править. Регрессия
соседей: `console-staged-play`, `console-political-donation`, `console-sponsor-colony`, `console-hand-workspace`,
`console-play-landing-geometry`, `console-parliament-unity` (волна RX29 — ход по тайлам не изменился), `console-colony-trade-probe`,
`-trade-receipt`, `trade-fleet-probe`, `console-water-hauling`, `console-colony-entry-probe`, `console-colony-focus-probe`.
`npm run e2e:affected` перед коммитом.

## 6. Визуальная приёмка (fhd + по кадру 4K и Deck; свой сервер, `.e2e-tr07/`)
1. Витрина (`?premiumCardsPlayground`, чип turmoilRedux): лицо — 5, Юпитер, требование [колония] 1, ряд «SET [пилюля] TO
   MAX» на EN и RU; пять лиц с `COLONY_TILE` «до / после» (Aridor, Early Colonization, Maria, We Grow As One, Prospecting).
2. Композер: CTA «Выбрать колонию» и строка шага; та же рука без своей колонии — причина; стол, где все треки на
   максимуме, — предупреждение пропуска.
3. Ритуал и раскадровка перехода (скринкаст CDP): приёмная сцена гаснет на месте, колонии поднимаются из той же зоны —
   блик / пустой кадр = дефект.
4. Сетка с проекциями на всех кандидатах и причинами на отключённых; статус-рейл тайла в фокусе.
5. Стейдж `track` до коммита: инструмент «3 → 7 · +4», рейл «торговля здесь».
6. Раскадровка хода: маркер на 3 после A · в середине хода · посадка на 7 · табло 7/7; крошка янтарная.
7. Уход на поле; журнал («увеличил трек Луны на 4» с чипом карты); нотификация соперника.

## 7. Режим работы
**4 коммита**, каждый зелёный по юнитам: (1) сервер — `MaximizeColonyTrack` + `trackTop`, маркер `trackMoves`, адресованный
`colony`-хвост, шаг превью `colonyPick` + спеки; (2) карта + лицо (ассет, перевод `COLONY_TILE`) + локаль + лор + спеки
(+ арт, если владелец его положил); (3) клиент — дверь, четвёртая цель, обобщённые вход / коммит / уход хостимого шага,
второй источник пика, проекция тайла, стейдж `track`, холд из диффа, один глайд + юниты; (4) e2e + фикстура + документы.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой
`npm run make:css` + `npm run build:server` (не голый `tsc`). **Не пушить.**
**Документ карты ЗАВОДИТЬ** — `docs/TURMOIL_REDUX_COLONY_SPONSORS.md`: контракт «четвёртая цель staged-розыгрыша —
колония» (адрес хвоста, три исхода, что обобщено из TR03), маркер `trackMoves` и шаг `MaximizeColonyTrack` (их наследует
любая карта «сдвиньте трек выбранной колонии»), проекция тайла и стейдж `track`, холд из диффа и один глайд с выбором
якорей, решения владельца, известные границы. Дополнить: `docs/TILE_PLAY_STAGED_COMMIT.md` (§ четвёртая цель — таблица
«клетка · резолюция · колония»), `.claude/rules/console-ui.md` (один абзац в законах колоний / staged), чеклист набора §4
(строка «карта выбирает трек колонии → `MaximizeColonyTrack` + `colonyPickStep`»), журнал набора. Гочи: `python3` —
заглушка Store; юниты последовательно; `eqeqeq` без исключения для null; соло-фикстура УДАЛЯЕТ колонию (`keepColony`);
новая карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в манифесте и чинить
классом; диагноз трекового flow — по трейлу (`__conColonyDiag()`), не догадками; MarsBot × Venus Redux — известное,
отложено; `git commit -- <paths>` + хук версии → `git reset -q HEAD -- package.json package-lock.json` после коммита.

В отчёте: сигнатуры `MaximizeColonyTrack`, `trackTop`, формы маркера и адресованного ответа; таблица трёх staged-целей
после правки; что обобщено (вход / коммит / B / уход) и чем доказано, что TR03 не изменился; кадры §6 + две раскадровки;
e2e на двух профилях и регрессия соседей до / после; что напечатали гарды; новые ключи i18n; **явно — всё, что не
получилось сделать по этому промту, и почему** (не «гэп на потом» молча).

## 8. Нельзя
Отправлять что-либо до A на стейдже. Двигать маркер до ответа сервера (в т. ч. «превью-ходом»). Авто-выбор колонии (даже
единственной). Коммит из сетки (A в сетке — только спуск). Скрывать неактивный тайл или тайл на максимуме. Считать
кандидатов, максимум или шаги на клиенте. Свой `SelectColony` в файле карты; голая запись `trackPosition` (путь Наоми).
Позиционный (неадресованный) `colony`-хвост у staged-двери. Второе staged-хранилище, вторая копия секции колоний, второй
глайд, второй реестр холдов; копия `enterStagedVote` / `commitStagedVote` вместо обобщения. Холд, посеянный вне блока apply
или некому отпустить; холд на `setTimeout`; `clearPanelRewardHold()`. Титул / кикер у встроенной секции (стадия отдаётся
ВВЕРХ); тулбар флотов, крадущий высоту сетки. `v-if`-смена сцен, пустой кадр, прокси без измеренного адресата. Возврат в
композер после коммита. Растянутая пилюля; `filter` / `text-shadow` как носитель состояния. Литерал кнопки; `title`.
Детект по тексту заголовка. `compatibility: 'turmoil'`. Менять тайминги и кадры торговли и волны RX29. Трогать
незакоммиченные файлы соседей, `shardPlan.json`. Пуш и красные коммиты.
