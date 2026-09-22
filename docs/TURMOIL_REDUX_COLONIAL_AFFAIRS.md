# Turmoil Redux — Colonial Affairs (RX07): план шагов на игрока, реестр колоний, шаг СБРОС, закон якоря дельта-чипа

Дата: 2026-09-23. Продолжение `TURMOIL_REDUX_CLOUD_DEVELOPMENT.md` (RX06 — распределение по картам), ранее
`TURMOIL_REDUX_AQUIFER_CONTEST.md` (§5 — рецепт), `…_ARCHITECTURE_AWARD.md`, `…_BIODOME_CONTEST.md`,
`…_CENTRAL_POWER_GRID.md`, `…_CLIMATE_RESEARCH.md`. Промт: `docs/claude/prompts/resolution-rx07-colonial-affairs.md`.

Colonial Affairs — седьмая настоящая резолюция и четыре «первых»: первая, чей набор шагов **зависит от игрока**
(план шагов на игрока, а не статический массив); первая, чья стадия НАГРАДА читает **реестр** (строка на тайл, × k)
как своё **тело** и летит **из строк реестра**, а не с иконки карты; первая, у которой стадия принимает
**сброс из руки** как встроенный шаг («ПАРЛАМЕНТ › ЗАСЕДАНИЕ › СБРОС» — рука стоит в зоне заседания); и первая,
в чьём скоупе закрыт открытый пункт реестра полировки **R-23 / R-24** — один закон якоря дельта-чипа на восемь
потребителей. Документ фиксирует правило и трактовки, форму плана и записей (таблица «бенефит → шаг → запись
→ адрес»), реестр, раскадровку стадии, закон якоря с замером до/после, проверки и ключи локали.

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id (ключ сохранения) | `RDX_UNITY_COLONIAL_AFFAIRS` |
| Каталожный код | **`RX07`** |
| Партия | **Unity / Союз** (вторая карта партии после RX06) |
| Совместимость | нет — карта базовая (колонии есть в любой Redux-партии: `coloniesExtension` включён у стола) |
| Локализованное имя | «Колониальные дела» |
| Арт | `assets/card-images/RX07.webp` (+ thumb) — `node scripts/import-card-art.mjs "<png>" RX07` → `npm run make:cards` |
| Файл | `src/server/parliament/resolutions/unity/ColonialAffairs.ts` (регистрация в `ResolutionCatalog.ts`) |
| Задание председателя | разыграть 2 метки космоса (`{goal: {kind: 'tag', tag: SPACE}, count: 2}`) |

## 2. Правило и принятые трактовки

Печатный текст: *When enacted: Gain all your colony bonuses 2 times + 1/2 Influence.* Задание: разыграть 2 метки
космоса. Маркера дополнения нет.

**Формула:** `k = 2 + ⌊I / 2⌋` для **каждого** участника по его собственному влиянию (влияние победителя читается
ПОСЛЕ его шага по Повестке — как везде в семействе). Каждый бонус колонии, на которой стоит куб игрока, платится
k раз. **Бонус колонии** — это печатная выгода тайла для владельца куба, когда там торгует ДРУГОЙ игрок
(`colony.metadata.colony`, третья строка тайла) — не доход торговли и не бонус строительства.

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Шаг влияния | `InfluenceScaledEffect.influenceStep` (новое поле, по умолчанию 1): `perInfluence × ⌊I / step⌋`; RX07 — `{base: 2, perInfluence: 1, influenceStep: 2}`, единица `{kind: 'colonyBonuses'}` | `uncappedAmount` в `influenceScaling.ts`; спек «k table» в `ColonialAffairs.spec.ts` |
| Объединение повторов | запас/производство ×k — ОДНА запись на тайл; ресурс на карту — ОДНА раскладка k (`AddResourcesToCards`, `autoSelect: false`); добор — ОДИН приём k карт; Плутон — **k ПАР** «взять → сбросить», никогда не объединяется (следующая карта не видна до сброса — прецедент торговли) | `colonyBonusStepsOf`; спеки «merging», «Pluto pairs» |
| Порядок | шаги в порядке СТОЛА колоний (`game.colonies`), ключи детерминированы: `colony:<tile>`, `colony:<tile>:<n>:draw` / `:discard` / `:reveal` | спек «keys are deterministic» |
| Возобновляемость | добор помнит `intake.id` в `ctx.state`, сброс — обычный `DiscardCards`; reload посреди второй пары Плутона задаёт тот же вопрос, ничего не платится дважды | спек «a reload in the middle of the SECOND Pluto pair» |
| Пропуски | без колоний — `skipped` с суммой k и причиной «Колоний нет»; нет держателя — «Нет карты, принимающей …»; пустая рука у Плутона — «В руке нет карт для сброса»; пустая колода — «The project deck is empty»; потеря при нуле — «Nothing to lose»; тайл вне пула — «Этот бонус колонии резолюция не выплачивает» (названо с величиной, ничего не выброшено молча) | спеки «skips with size», «empty-hand Pluto», «community Titania/Iapetus» |
| Задание | добор/ресурсы резолюции не двигают «2 метки космоса»; своя метка космоса — двигает | спек «quest» |
| Нейтральный победитель | никого не отменяет; MarsBot (mode `none`) не участвует | спеки |
| Реестр в модели | `ParliamentPlayerModel.colonyBonuses: [{colony, grant, description}]` — сервер шлёт РЕЕСТР места (тайл + печатная выгода), клиент ничего не выводит из модели колоний сам | `ParliamentModel.ts` (server), спек «model ledger» |

## 3. План шагов на игрока (общий механизм) и таблица «бенефит → шаг → запись → адрес»

**`IResolution.immediateStepsFor?(player, parliament, game)`** — второе поле рядом со статическим
`immediateSteps`; `immediateStepsOf(definition, player, …)` — ОДИН читатель обоих (драйвер фазы, гард
контракта, экспорт лица). Драйвер по-прежнему пишет одну запись на (игрок, ключ шага) и не перезапускает шаг —
план строится на игрока в момент его шагов, ключи стабильны через reload.

Единица `{kind: 'colonyBonuses'}` (amount = k). Каждая запись шага несёт `effect`, `influence`, **`multiplier: k`**
и **`colony`**; гард формулы (`checkFormula`) для множительной единицы сверяет `multiplier`, не `amount`.

Два новых вида исхода в `REWARD_ADDRESS` (строка есть у каждого значения union — иначе не компилируется):

| kind | surface | source | unit | stage | reading | skip |
| --- | --- | --- | --- | --- | --- | --- |
| `discard` | `hand-dock` | `hand` | `cards` | `discard` | `colony-ledger` | «Пропущено: сброс» |
| `colonyBonus` | `hud` | `none` | `none` | `reward` | `colony-ledger` | «Пропущено: бонус колонии» (только при 0; потеря — отрицательная сумма, честная выплата) |

**`rewardFlightSourceOf(outcome)`** — новый источник полёта `colony-row`: запись, у которой есть `colony` и чей
адрес летит с иконки карты, рождается на **строке реестра** этого тайла (`[data-colony-row="<tile>"]
[data-colony-bonus]`), никогда с иконки резолюции. Адрес (`address.source`) при этом не меняется — меняется
место рождения (`delivery.source`).

Таблица по форме печатной выгоды (`colonyBonusShape`, `src/common/parliament/colonyLedger.ts` — та же карта
форм читает и сервер, и клиент):

| Форма (тайлы) | Шаг | Запись | Адрес / полёт |
| --- | --- | --- | --- |
| `stock` (Луна 2 M€, Церера, Ио, Тритон, Каллисто…) | `stockStep` — `player.stock.add(k×q)` | ОДНА `stock`, `amount: k×q`, `before/after` | рельса, чип из строки реестра (`colony-row`) |
| `production` (Европа…) | `productionStep` | ОДНА `production` | рельса, `colony-row` |
| `cardResource` (Титан — аэростат, Энцелад — микроб) | `cardResourceStep` → `AddResourcesToCards(k×q, autoSelect: false)`: один держатель — выбор ПОКАЗАН; ≥ 2 держателей и N ≥ 2 — РАСКЛАДКА | ОДНА `cardResource` с `cards: [{card, amount}]` | встроенный шаг «ВЫБОР» / «РАСКЛАДКА» в зоне заседания |
| `venusCardResource` (тайл «Венера») | `venusCardResourceStep` (только карты Венеры) | `cardResource` | то же |
| `draw` (Миранда — «взять 1 карту») | `drawStep` → `ExternalDrawIntake.open(k)` — ОДИН приём k карт | ОДНА `cards` (`drawn`, `intake`) | встроенный приём «ПОЛУЧЕНИЕ» |
| `drawDiscard` (Плутон) | k ПАР: `drawStep(1)` + `discardStep` (`DiscardCards`, маркер `discardPrompt {source: resolution, colonyRepeat: {colonyName, index, total}}`) | `cards` + `discard` (карта) на пару | «ПОЛУЧЕНИЕ» → «СБРОС» (рука — встроенный шаг) |
| `revealBuy` (Ливитт) | `revealBuyStep` — `DrawCards.keepSome(paying)` k раз | `colonyBonus` с описанием тайла | стандартный путь вскрытия |
| `loss` (Титания) | `lossStep` — списание min(запас, k×q) | `colonyBonus`, **отрицательная** сумма (`stock`, `before/after`) | HUD: стандартный дельта-чип рельсы |
| `discount` (Япет) | `discountStep` — `colonies.cardDiscount += k` | `colonyBonus`, `amount: k` | HUD |
| `mcPerEarthTags` / `mcPerHazard` (сообщество) | счёт по столу / по опасным зонам, ×k | `stock` или именованный пропуск | рельса |
| `unsupported` | именованный пропуск | `skipped` | плита пропуска |

`colonyRepeat` — отдельный маркер: `colonyBonus` на `discardPrompt` **маршрутизирует шаг РАБОЧЕГО ПРОСТРАНСТВА
КОЛОНИЙ** (`colonyBonusDiscardOf` в оболочке), и сброс резолюции обязан его НЕ нести — иначе он открыл бы чужой
экран. Клиентское чтение (`discardIntent`) берёт планету и «n из k» из любого из двух.

## 4. Предподсчёт — реестр (блок B)

Чистый общий модуль `src/common/parliament/colonyLedger.ts`: форма печатной выгоды → чип одного повтора
(`colonyLedgerBonusOf`), строки реестра × k с состоянием по ЗАПИСЯМ сервера (`colonyLedgerRows`: `pending` /
`paid` / `skipped` с причиной), суммы по единицам (`colonyLedgerTotals`), записанный множитель
(`recordedMultiplierOf`). Клиентское чтение `colonyLedgerOf(resolution, model, viewer, {enacted, live})`
(`console/parliament/colonyLedgerModel.ts`): при голосовании — множитель по текущему влиянию и «×(k+1) при
победе» (`winSuffixesOf`); при принятии — записанный множитель и состояния строк. Компонент
`ConsoleColonyLedger` (размеры `compact` / `normal` / `hero`): множитель в грамматике yield-блока
(`[влияние] 3 → ×3`), строка на тайл — медальон планеты (арт колоний, посаженный в диск), имя, печатный бонус
одного повтора (для Плутона «карта → сброс»), «× k =», итог; суммы; «Колоний нет» словами, никогда пустой ящик.

Проводка: панель голосования (`data-parl-vote-ledger`; имена тайлов входят в бюджет слов `voteInfoBudget`),
подвал fullscreen-осмотра, стадия НАГРАДА (герой-размер, блок C), стенд «Полигон» (семейство `colony-bonuses`,
сценарий `colonial-vote` с синтетическими кубами Луна/Титан/Миранда/Плутон), итоги заседания группируют выплаты по
тайлу (`data-sit-part-tile`; `discard` — карта, `colonyBonus` — описание тайла). `enactedYieldsOf` читает
множитель записи; пропуск с `colony` — строка реестра, не пропуск эффекта.

## 5. Стадия НАГРАДА: несколько наград — один поток (блок C)

**Поле и дверь — два факта.** `sittingFieldOf(stage, rewardStep, rewardPending, ledger)` → `{pose, stepOpen}`:
для встроенного шага (выбор, раскладка, приём, **сброс**) поза и дверь открываются вместе — после волны, что
пришла с вопросом; с реестром поза стоит **на всю страницу НАГРАДА** (строки реестра — источники волны, тело
должно стоять ДО волны), а дверь шага открывается только когда волна легла. Секция публикует
`consoleParliamentUi.fieldStanding` (телепорты пикера/приёма) и слот фрейма парламента
(`setWorkspaceFrameSlot('parliament', '.con-parl [data-embed-slot="parliament-stage"]')` — для шага, который
является ФРЕЙМОМ, — руки) в одном `flush: 'post'`-наблюдателе `sittingStepOpen`; убирает в `beforeUnmount`.

**Зона — стек слоёв.** `.con-sit__zone` — grid с одной ячейкой: слот встроенного шага
(`[data-embed-slot="parliament-stage"]`, всегда в DOM — телепорт переразрешается только по смене селектора) и
панель реестра `[data-sit-ledger]` (`v-show="!stepOpen"`). Реестр уходит вниз под шаг (`playBodyFold` на своём
слое) и возвращается, когда шаг ушёл (`playZoneLayerEnter`) — никакого `v-if`. Уходящий слой дорисовывает свой
уход рядом с приходящим.

**Волны по строкам.** `beatReward` делит долг по `delivery.source`: `card-icon` (иконка карты — как прежде),
**`colony-row`** (группы по тайлу в порядке сервера — `ledgerRowGroups`), `party-plaque`. Карта фиксируется
одним ACTION COMMIT, на handoff летят строки ПО ОЧЕРЕДИ: `sittingMotion.colonyRow` помечает ОДНУ строку весом
(без мигания), чипы рождаются на печатном значке бонуса строки (`ledgerBonusIconOrigins`), садятся на рельсу,
счётчик тикает на посадке (`markRewardLanded`), следующая строка платит после посадки предыдущей
(`LEDGER_ROW_GAP_MS`). Строка читает «получено» по ПОСАДКЕ (`landedColonies` в `ConsoleParliamentSitting` — из
`rewardLanded` по записям с `colony`), не по приходу записи. Строка не на экране — холд отпускается честно.
Прогулка ждёт посадки карты на герой-слот (`fieldSettling`, `onDone` у `playParliamentEnactEnter`) и конца
разворота тела (`stageEntering`), прежде чем измерять строку.

**Шаг СБРОС — новый член стадии.** `SittingRewardStep` += `'discard'`, `SITTING_HOSTED_STEPS` += `'discard'`;
`sittingAskOf` узнаёт сброс по структурному маркеру (`isDiscardPrompt(wf)` при источнике-резолюции; после
`intake` / `space` / `distribution`); хвост крошки `sittingStageKey('reward', 'discard') = 'Discarding'` → «СБРОС»
(глоссарий, канон в `parliamentGlossary.spec`); `RESOLUTION_STEP_STAGES.handSelect = 'Discarding'` (сброс КАРТЫ —
по-прежнему ничей шаг). Оболочка: `openShellTaskSurface` → `openHandWorkspace()` → `workspaceHostForStep()` даёт
`parliament` (стадии заседания — за границей коммита, `hosts: 'inFlow'`), фрейм руки ВЛОЖЕН, `frameSteps.hand =
'embed'`; стадия фрейма руки называется тем же словом (`followUpStepStage(kind, wf)`); секция не уступает сцену
встроенному фрейму (`sceneHandedOver = workspaceHostYieldsScene('parliament')` — раньше любой вложенный фрейм
прятал секцию целиком). Ответ: `submitHandSelect` → сцена сброса → `leaveHandAfterAnswer` → `handExitVerb` =
`pop` (рука — хозяин-шаг) → следующий приём встаёт в ту же зону.

### Раскадровка (e2e `console-parliament-colonial.spec.ts`, фикстура `parliament-colonial-assembly`, standard-1080)

Стол: синий — Луна (2 M€), Титан (аэростат; держатели Atmo Collectors + Jovian Lanterns → РАСКЛАДКА), Миранда
(«взять 1 карту» → приём 3), Плутон (3 пары), шаг Повестки 4 → влияние 3 → **k = 3**; красный — Луна, k = 2.

| Шаг | Что на экране | Свидетель |
| --- | --- | --- |
| ① | A на вердикте, красный отвечает по API; страница НАГРАДА: герой слева (`RX07`), РЕЕСТР в зоне — четыре строки в порядке стола, «× 3», множитель `3` | `[data-sit-ledger] [data-colony-row]` = Luna·Titan·Miranda·Pluto, `data-colony-ledger-multiplier="3"`, `.pcard.rdx-unity-colonial-affairs` на `[data-parl-sit-hero]` |
| ② | Луна платит 6 M€: чипы рождаются на ячейке бонуса СТРОКИ, строка помечена, пока летят; счётчик M€ тикает на ПОСАДКЕ; строка читает «получено» после посадки | пробник (MutationObserver + setInterval): первый чип M€ в ячейке `[data-colony-bonus]` Луны, `data-colony-row-active`, тик после первого чипа, «received» ≥ тика |
| ③ | дельта-чип «+6» на строке M€ — вне цифр и внутри ряда во всех семплах | `mcDelta.overDigits ≤ 1`, `outsideRow ≤ 1` |
| ④ | РАСКЛАДКА Титана внутри зоны: реестр уступил, крошка «РАСКЛАДКА», RB·RB·→·RT·A — запись `cardResource` с `cards` | `${STAGE} .con-task`, `[data-spread-blocked]` → `[data-spread-ready]`, wire |
| ⑤ | ПРИЁМ ТРЁХ (Миранда ×3 — один приём k) внутри зоны, крошка «ПОЛУЧЕНИЕ», A ×3 | `.con-extdraw--embedded`, 3 слота |
| ⑥ | ПРИЁМ ОДНОГО (первая пара Плутона) — пары не объединяются | 1 слот, `externalDrawPrompt.count === 1` |
| ⑦ | СБРОС: рука стоит В ЗОНЕ заседания в режиме сброса, без своей шапки; заголовок «Сбросьте 1 карту · Плутон · Бонус колонии 1 из 3»; крошка «ПАРЛАМЕНТ › ЗАСЕДАНИЕ › СБРОС»; B = «Свернуть»; A — карта уходит в сброс (`.con-discard-proxy`), рука уходит, встаёт приём второй пары; зона не пустела | `${STAGE} .con-hand.con-hand--embedded.con-hand--discard`, `.con-hand__discard-src`, `.con-hand__discard-seq`, бар, `bodyEmpty === 0` |
| ⑧ | остальные пары по API; реестр вернулся со всеми строками «получено»; ИТОГИ группируют выплаты синего по тайлу; лента не меняла высоту; ничего не застряло; поколение 2; записи: три `discard`, Луна `amount: 6` | пробник, `[data-sit-part-tile]` ×4, `strandedReports`, wire |

Замеры прогона — §7.

## 6. Закон якоря дельта-чипа (блок D, R-23 / R-24)

ОДИН закон в одном месте (`console.less` § THE DELTA-CHIP ANCHOR LAW): чип ±N (`AnimatedMetricValue` →
`.metric-feedback-host`) ① вне ЦИФР, которые называет; ② вне СОСЕДЕЙ (другой ряд/ячейка, чужие цифры);
③ внутри своего ИНСТРУМЕНТА (рельса, колонка доп. ресурсов, док; лента статуса — своя линия чипов под швом);
④ rem-авторский — смещения И сами чипы масштабируются профилем. Четыре ПОЗЫ одной формулы, хозяин называет
только позу: ЦИФРЫ (верхний левый угол чернил правовыровненного числа — `.con-res__digits` внутри резервной
колонки, счёт РТ/ПО), УГОЛ (бейдж на плече собственной эмблемы/плиты — производство (угол ряда), метки (плечо
медальона — чип теперь прямой ребёнок ячейки), доп. ресурсы (левый верх — значок)), ЛИНИЯ (док руки), ЛИНИЯ
ЧИПОВ (лента; сдвиг `--con-status-chip-drop` +.04rem — на 4K цифры доходят до шва). Размеры чипов в rem под
`html.console-native`, `zoom` TV-профиля снят.

Пробник `tests/e2e/console-delta-chip-anchor.spec.ts` (восемь потребителей × три профиля): синтетический чип в
каждом хозяине (те же классы, что рендерит компонент), чернила через `Range`, паритет ①–④ по каждому; скриншоты и
`geometry.json` — `screenshots/delta-chip-anchor/<preset>/`.

| Потребитель | До (1080) | До (4K) | До (Deck) | После (все три) |
| --- | --- | --- | --- | --- |
| рельса · запас | на цифрах 303 px², зазор −0.87rem | 1952 px², −1.10rem | 303 px² | 0 / 0 / внутри; зазор 0.15rem |
| рельса · производство | на рамке ряда 48 px² | зазор 0.17rem | на цифрах 20 px² + рамка 120 px² | угол ряда, 0; зазор 0.06–0.17rem |
| метки | на цифрах 103 px² + медальон | 705 px² | 81 px² | плечо медальона, 0 |
| счёт РТ | на цифрах 12 px² | 189 px² | 18 px² + вне рельсы 55 px² | 0; зазор 0.15rem |
| лента · параметр | зазор 0.00rem | на цифрах 22 px² | зазор 0.03rem | 0; чип под швом, зазор 0.14–0.29rem |
| колода | ✓ | ✓ | ✓ | ✓ (0.36–0.43rem) |
| док руки | ✓ (0.30rem) | ✓ | ✓ | ✓ (0.32–0.34rem) |
| доп. ресурсы | вне колонки 314 px² | 709 px² | на цифрах 12 px² + 314 | левый верх значка, 0 |

Гарды соседей: `console-hud-frame` (линия чипов ленты, ±.35rem от шва) и `console-rail-contract` (чип колоды) —
зелёные после правки.

## 7. Проверки и прогоны

| Что | Результат |
| --- | --- |
| mocha: `ColonialAffairs` (18 + семейство) · `ResolutionContract` · `ParliamentRenewal` · `rewardAddress` · `colonyLedger` · `consoleSittingFlow` · `parliamentGlossary` · `parliamentLessOrder` · `parliamentResults` · `e2eFixturesLoad` · `e2eDriverGuard` | зелёные |
| mochapack: `consoleTaskRouter` · `discardIntent` · `parliamentRewardBeat` · `sittingBeats` · `parliamentBand` · `colonyLedgerModel` · `voteInfoBudget` | зелёные |
| `npm run build:test` · eslint (`lint:server`) · `vue-tsc` (`lint:client`) · `lint:i18n` · `make:css` · `make:json` | зелёные (блоки A–D) |
| e2e `console-delta-chip-anchor` · standard-1080 / tv-4k / deck-handheld | ✓ 3/3 (36 с) после закона; до — 3 красных (таблица §6) |
| e2e `console-hud-frame` + `console-rail-contract` | ✓ 5/5 (1.5 мин) |
| e2e `console-parliament-colonial` · standard-1080 | см. журнал `docs/claude/parliament-sitting-progress.md` § RX07 — прогоны |

Бюджет проверки (решение владельца 2026-09-23): один новый e2e на новую механику, кадры нового на одном
профиле; галерея и стенд не гоняются; позы галереи для реестра и сброса НЕ добавлены (по бюджету) — стенд
«Полигон» несёт семейство `colony-bonuses` (блок B), кадры — `screenshots/parliament-colonial/standard-1080/`.

## 8. Ключи локали (`src/locales/ru/parliament.json`)

Имя и лицо: «Колониальные дела», текст эффекта, «Разыграйте 2 метки космоса», «Все ваши бонусы колоний», «2 раза».
Пропуски: «Колоний нет», «Нет карты, принимающей микробов / данные», «Нет карты Венеры, принимающей ресурсы»,
«В руке нет карт для сброса», «В игре меньше 3 меток Земли», «На Марсе нет опасных зон», «Этот бонус колонии
резолюция не выплачивает», «Пропущено: сброс», «Пропущено: бонус колонии». Заголовки шагов: «Добавьте / Разложите
${0} микробов · животных · ресурсов (карты Венеры)», «Сбросьте 1 карту: бонус колонии ${0}, ${1} из ${2}, от ${3}».
Журнал: строки объявления k, каждого шага и пропуска (§ «${0} gains all colony bonuses …» и далее). Реестр:
«Бонусы колоний», «{раз|раза|раз}», «карта → сброс», правило бонуса колонии (осмотр), «Результат по влиянию,
помноженный на ваши бонусы колоний». Стадия: «Раскладка» (канон), **«Сброс»** (`Discarding`). Всего 47 ключей.

## 9. Честные границы и найденные ловушки

- **Миранда платит КАРТУ**, не животное: бонус колонии — третья строка тайла (`colony`), у Миранды это «взять 1
  карту»; животные — её доход торговли. Первая версия e2e/фикстуры ждала животных — исправлено по кадру.
- **Redux-тайлы** (Плутон Redux, Венера Redux, Веста) не реализованы — их печатные выгоды не в пуле; форма
  `unsupported` называет пропуск с величиной.
- **Общая папка `build/` двух сессий.** Другая сессия держит `webpack --watch` (dev-сборка), переписывающая
  `build/main.js` при каждом сохранении; e2e того же клона грузит `build/` и на dev-бандле не поднимает консоль
  («TERRAFORMING MARS» и пустой `#app`, без единой ошибки). Прогон e2e — с ЗАМОРОЖЕННОЙ копией production-сборки
  (`.e2e-frozen/build`, свой сервер `TM_E2E_SHARED_SERVER=1 BASE_URL=…`, cwd = папка копии — сервер читает
  `build/…` относительно cwd). Заметка в памяти.
- Фикстуры сгенерированы при каталоге, где уже есть RX08 (незакоммиченная работа соседней сессии): в колоде
  фикстуры лежит `RDX_UNITY_COLONIZATION_FUNDING`; e2e-сервер обязан знать её (сборка сервера из текущего
  дерева), иначе `load-game` отвечает 400.
