# Turmoil Redux — Colony Contest (RX09): колония победителя как ВСТРОЕННЫЙ ШАГ заседания

Дата: 2026-09-23. Продолжение `TURMOIL_REDUX_AQUIFER_CONTEST.md` / `TURMOIL_REDUX_BIODOME_CONTEST.md` (часть
победителя как данные + шаг `winnerSteps`) и `TURMOIL_REDUX_COLONIAL_AFFAIRS.md` (рука как встроенный шаг СБРОС —
фрейм в слоте Парламента). Промт: `docs/claude/prompts/resolution-rx09-colony-contest.md`.

Colony Contest — девятая настоящая резолюция. Выплата всем — самый простой путь семейства (титан по влиянию, чип в
рельсу). **Вся ценность итерации в части победителя: он строит колонию бесплатно, и выбор колонии проходит ВНУТРИ
заседания — экран колоний как встроенный шаг**, со всей цепочкой постройки (полёт кубика, бонус тайла, в том числе
интерактивный) внутри той же зоны стадии. Механику вложения не строили: она уже генерична (таблица `WORKSPACE_KINDS`,
`workspaceHostForStep`, слот двери `publishStepDoor`, гейт `admits('followUp')`); заседание лишь **признало колонию
своим шагом** и получило **ветку `parliament`** на завершении цепочки.

| | Aquifer Contest (RX01) | Colonial Affairs (RX07) | Colony Contest (RX09) |
| --- | --- | --- | --- |
| Часть победителя | океан (`{kind:'tile'}`) | нет | **колония (`{kind:'colony'}`)** |
| Где исполняется | доска («К полю», стек уступает) | — | **экран колоний В ЗОНЕ стадии** (фрейм в слоте Парламента) |
| Шаг заседания | `placement` | `discard` (рука) | **`colony`** (колонии) |
| Запись | `ocean` (параметр до/после) | `discard` / `colonyBonus` | **`colony`** (тайл) |

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id | `RDX_UNITY_COLONY_CONTEST` |
| Каталожный код | **`RX09`** |
| Партия | **Unity / Союз** — четвёртая карта партии |
| Совместимость | не объявляется: Colonies в Redux обязательны (решение Colonial Affairs) |
| RU-название | «Конкурс колоний» |
| Арт | `assets/card-images/RX09.webp` (+ thumb) — `node scripts/import-card-art.mjs "<Mars Arts/Colony Contest_art.png>" RX09` → `npm run make:cards` |
| Файл | `src/server/parliament/resolutions/unity/ColonyContest.ts` (регистрация в `ResolutionCatalog.ts`) |
| Задание председателя | построить 2 колонии (`{goal: {kind: 'colony'}, count: 2}` — `QuestTracker` умел, `questRender` рисует `b.colonies(2)`) |
| Лицо | `b.titanium(1).slash().influence().br; b.colonies(1).voteWinner();` — титан / влияние, колония со звездой победителя; общий `PremiumMechanicsPanel`, ручной разметки нет |

## 2. Правило и трактовки

Печатный текст: *When enacted: Gain titanium equal to your Influence. The player that won this resolution places a
colony for free.* Задание: 2 колонии.

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Титан | 1 × влияние КАЖДОГО участника (победитель — после своего шага Повестки), `stock`, без потолка; ноль влияния — именованный пропуск «Влияния нет» | `ColonyContest.spec` «pays EVERY participant…», «influence 0 is a NAMED skip» |
| Кто строит | только победитель голосования; нейтральный победитель — `winnerSteps` не запускаются (FAQ p.18), титан всё равно получают все | спек «a NEUTRAL winner builds nothing» |
| Запись о нейтральном победителе | записи НЕТ: у записи есть место (`player: PlayerId`), у нейтрального игрока его нет — как у RX01/RX03. Тишины нет: чтение победителя (`winnerRewardModel`) печатает «Победитель — нейтральный: колонию никто не строит» на ленте, в fullscreen и в «Полигоне» | `winnerRewardModel.spec` § COLONY |
| «Бесплатно» | стандартный `BuildColony` БЕЗ `commit`-замыкания стандартного проекта: 0 M€, флот не тратится, действие не считается; `placementContext = committedPlacement(reason, SOURCE)` — источник резолюция | спек «the answer builds the colony FOR FREE» |
| Доступность | обычная (`Colonies.getPlayableColonies`): активный тайл, не полный, без своего кубика; остальные предлагаются ЗАПРЕЩЁННЫМИ с причиной («Colony is full» / «inactive» / «You already have a colony here») | спек «asks the winner right after its titanium…» |
| Бонус постройки | платит сам тайл (`Colony.addColony` → `giveBonus(…, 'build')`) — часть правила. Тихий (Луна: +2 пр. M€) — идёт в счётчик; интерактивный — вопрос ДВИЖКА (источник — колония, не резолюция), фаза ждёт его (`drainDeferred`) | спеки «Titan with two floater holders…», «Europa…» |
| Нет доступной колонии | `BuildColony.execute()` → `undefined` → журнал + `{kind:'skipped', reason:'No colony is available'}`; ничего не подменяет | спек «no available colony…» |
| Задание | бесплатная колония прогресс НЕ двигает (Q5: корень цепочки — политическая фаза, резолюция на стеке событий); две колонии своими действиями — выполнено | спек «the free colony moves no progress (Q5)…» |
| Reload внутри вопроса | шаг пересобирает тот же `SelectColony` (те же тайлы, тот же маркер); постройка и отметка `applied` сохраняются вместе — дважды не строится | спек «a reload inside the question…» |
| Бот | не участвует: ни титана, ни колонии, никогда не победитель | спек «MarsBot…» |

## 3. Общие расширения (что переиспользовано и что выросло)

### 3.1 Объявление части победителя стало ОБЪЕДИНЕНИЕМ (`winnerReward.ts`)

`WinnerRewardDeclaration = WinnerTileReward | WinnerColonyReward` (`{kind:'tile', tile}` | `{kind:'colony'}`).
`winnerRewardParameter` отвечает `undefined` для колонии; `winnerParameterRoom` / `winnerRewardTr` типизированы по тайлу
(`isWinnerTileReward` — сужение). Чтение `WinnerRewardReading.parameter` стало необязательным; у колонии нет комнаты и РТ —
до выбора чтение говорит только КТО строит, после — ГДЕ (`built` = имя тайла). Глаголы «строит / построено»
(`winnerRewardCaptionOf`), правило под блоком победителя (`winnerRewardRuleKey`), глиф `winnerRewardGlyph` → `colony`.
`ConsoleWinnerReward` рисует тайл колонии без строки параметра; построенный тайл встаёт на место параметра.

### 3.2 Вид исхода `colony` (`rewardAddress.ts`)

`{surface: 'colonies', source: 'none', unit: 'tile', stage: 'colonies', reading: 'winner-reward', skipTitle:
"Skipped: the winner's colony"}`. Новая поверхность `colonies` и стадия `colonies` в объединениях. Единица `tile` —
запись без величины никогда не считается пропуском по отсутствию суммы. Поле записи `colony` (уже было у реестра RX07)
для вида `colony` называет тайл постройки. Итоги группируют часть по тайлу (планета + имя) и печатают глиф колонии
(`.con-sit__door-tile--colony`); лента печатает блок победителя с `tile: 'colony'`.

### 3.3 Шаг заседания `colony` (`consoleSittingFlow.ts`) — образец: шаг СБРОС RX07

- `sittingAskOf`: `wf.type === 'colony'` + источник-резолюция в `placementContext` → `'colony'` (структурно; колония
  карты / стандартного проекта — ничей шаг).
- `SITTING_HOSTED_STEPS` содержит `colony`: дверь стадии (`sittingFieldOf` → `publishStepDoor`) публикует слот Парламента
  `[data-embed-slot="parliament-stage"]`, в который `workspaceFrameTarget('colonies')` телепортирует фрейм колоний.
  В набор таск-хоста шаг НЕ входит (`parliamentStageTask` ложен для `colony`).
- Хвост крошки — `sittingStageKey('reward','colony') = 'Colonies'` («КОЛОНИИ»); `RESOLUTION_STEP_STAGES.colony =
  'Colonies'` — то же слово пушит `openColoniesForPrompt` (стадия по источнику промпта), секция колоний без своей стадии
  сохраняет имя двери.
- **`hosting`** (`sittingFieldOf(…, hosting)`): вложенный фрейм ещё стоит (`workspaceFrameHasNested('parliament')`) —
  поле и дверь открыты, пока фрейм не ушёл, хотя позиция сервера уже «получено» (ответ на выбор приходит раньше, чем
  сядет кубик и отыграет бонус тайла). Прогулка держит страницу НАГРАДА (`mayLeave`), `enterServerStep` сажает её на
  страницу шага; хвост крошки читает стадию вложенного фрейма (`sittingTail` → `workspaceStackCrumb().stage`), так что
  тайл «КОЛОНИИ» никогда не откатывается к «НАГРАДЕ», пока кубик летит.
- `WORKSPACE_KINDS['parliament'].frameSteps.colonies` = **`embed`** (было `scene`): колонии, стоящие прямо на Парламенте,
  — только шаг заседания (колонии партийного действия вложены под `card-actions` и по-прежнему берут сцену).

### 3.4 Завершение цепочки — ветка `parliament` (`ConsoleShell.settleColonyFollowUp`)

На падении `colonyFollowUpLive` фрейм колоний снимается (`leaveWorkspace`), и хозяин-Парламент **не сворачивается и
не заключается**: секция сама читает уход фрейма (`stepFrameNested` ↓ → дверь закрывается, карта-герой складывается
домой) и продолжает прогулку (страница НАГРАДА → ОБНОВЛЕНИЕ → ИТОГИ); заседание заканчивается только своими воротами
(«Закрыть заседание»). Ветка оставляет свидетеля `consoleParliamentUi.stepFrameLeftAt` для диагностики.

**Уступка полю (Европа).** Падение `colonyFollowUpLive` может случиться, пока стек УСТУПИЛ доске (океан бонуса
постройки): тогда фрейма в живом стеке нет, и ребро снять его не может. Возврат стека (`resumeStackFromBoardAndSettle`)
после доски проверяет: цепочка колоний уже кончилась → тот же `settleColonyFollowUp` снимает фрейм сразу, и заседание
идёт дальше. Без этого сетка колоний стояла бы в зоне стадии с пустой обязанностью.

### 3.5 Цепочка бонуса постройки — по видам

| Тайл | Бонус | Что происходит в потоке |
| --- | --- | --- |
| Каллисто · Церера · Ганимед · Ио · Луна | производство | счётчик тикает своим дельта-чипом; фрейм снимается по посадке кубика |
| Тритон | 3 титана | то же (stock) |
| **Титан · Энцелад · Миранда** | ресурс на карту | при ДВУХ и более держателях — шаг «Цель бонуса постройки» на фокус-стадии колонии: A открывает пикер получателя (`ConsolePlayedTargetStep` в `.con-colfocus__targetstage`, на уровень глубже, внутри заседания), A берёт карту, X строит; ответ уходит ОДНИМ пакетом (`submitBatch`), сервер не задаёт вопрос отдельно. При одном держателе движок кладёт сам (`AddResourcesToCard` без `autoSelect: false` — поведение колоний, не резолюции) |
| **Европа** | океан | стек уступает доске автоматически (`placementActive` ↑ → `yieldStackToBoard`): Парламент и колонии ждут в отложенном стеке, игрок ставит океан обычным размещением (у промпта нет источника-резолюции — «К полю» заседания здесь не участвует), стек возвращается на ту же глубину, фрейм колоний снимается (`resumeStackFromBoardAndSettle`), прогулка идёт к ИТОГАМ |
| Плутон | взять 2 карты | `player.drawCard(2)` в момент постройки — карты приходят стандартной сдачей внутри экрана колоний (claim `draw` постройки) |

## 4. Проверки

- Сервер: `tests/parliament/ColonyContest.spec.ts` (14) — каталог, лицо, титан и ноль, предложение и запреты, бесплатная
  постройка, пустой стол, нейтральный победитель, Титан (вопрос колонии), Европа (океан движка), reload, задание, бот.
  Гард `ResolutionContract.spec` отвечает на `SelectColony`; стол колоний в гарде АРАНЖИРУЕТСЯ (Луна · Каллисто), чтобы
  бонус случайного тайла не задал вопрос движка без источника-резолюции.
- Клиент: `consoleSittingFlow.spec` (ask / дверь / хвост / `hosting`), `consoleTaskRouter.spec` (стадия по источнику),
  `consoleWorkspaceStack.spec` (parliament ⊃ colonies: embed, слот двери, крошка, `nested-step`),
  `winnerRewardModel.spec` § COLONY, `rewardAddress.spec` (вид `colony`), `parliamentRewardBeat.spec` (чип не летит).
- e2e (РОВНО ОДИН файл, `tests/e2e/console-parliament-colony.spec.ts`, standard-1080): путешествие Титана (волна титана →
  сетка ВНУТРИ рамки Парламента → пикер получателя на уровень глубже → X → возврат → ИТОГИ; крошка непрерывна, двух
  живых тел нет, лента стоит) и отдельное путешествие Европы (заседание уступает доске при живом фрейме, возврат, итоги).
  Фикстура `parliament-colony-assembly`.

## 5. Рецепт: следующая часть победителя, исполняемая ЧУЖИМ экраном

1. Член `WinnerRewardDeclaration` (данные) + вид исхода в `rewardAddress.ts` (поверхность = экран, единица, стадия).
2. Шаг `winnerSteps`, возвращающий стандартный промпт движка с `committedPlacement(reason, SOURCE)`; `ctx.report` в
   ответе.
3. `SittingRewardStep` по структурному маркеру + `SITTING_HOSTED_STEPS` (дверь) + слово хвоста в обеих таблицах.
4. Если экран — ФРЕЙМ (а не таск-хост): строка `frameSteps` хозяина `embed`, ветка хозяина в `settleColonyFollowUp`
   (или её аналог для другого фрейма) и термин `hosting` — фрейм переживает ответ сервера.
