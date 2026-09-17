# Turmoil Redux — Aquifer Contest (RX01): первая настоящая резолюция и шаблон семейства

Дата: 2026-09-17. Продолжение `TURMOIL_REDUX_PARLIAMENT_V6.md` и `TURMOIL_REDUX_RESOLUTION_INSPECT.md`.

Aquifer Contest — первая резолюция с настоящим эффектом. Этот документ фиксирует: принятые трактовки правил,
архитектуру подключения (сервер · общий слой · клиент), новое семейство каталожных кодов, паттерн
«влияние → рассчитанный результат», стенд в «Полигоне» и **рецепт подключения следующей резолюции**.

---

## 1. Каталожный код: семейство `RX##`

| Что | Где | Значение для Aquifer Contest |
| --- | --- | --- |
| Внутренний id (ключ сохранения) | `ResolutionDefinition.id` | `RDX_GREENS_AQUIFER_CONTEST` |
| Каталожный код (печатный) | `ResolutionDefinition.code` → `IClientResolution.code` → `PremiumCardVM.code` | `RX01` |
| Локализованное название | `text.name` (EN-ключ) → `parliament.json` | «Конкурс водоносных пластов» |

- **Семейство `RX##`** («RX» = Redux resolutions) не пересекается ни с одним префиксом проектов (`###`, `X##`,
  `R##` корпорации, `C##`, `P##`, `T##`, `DP##`, …). Регэксп и проверка: `RESOLUTION_CODE_PATTERN`,
  `isResolutionCode()` в `src/common/parliament/ParliamentTypes.ts`.
- **Правило нумерации**: две цифры = порядковый номер резолюции в **алфавитном списке 48 официальных
  резолюций** Turmoil Redux (`docs/TURMOIL_REDUX_SPEC.md` §4): Aquifer Contest 01, Architecture Award 02,
  Biodome Contest 03, Central Power Grid 04, Climate Research 05, … Water Export 48. Код назначается **руками в
  определении**, никогда не вычисляется из позиции в массиве/колоде.
- Каталог (`ResolutionCatalog`) **отказывает** дубликату кода и коду не по шаблону; `byPrintedCode('RX01')` —
  вход для поиска/отладки. Заглушки и dev-примеры кода не несут.
- Код **есть в модели всех премиальных граней** (`metadata.cardNumber` проектов / код резолюции → `PremiumCardVM.code`,
  `PromptSourceView.code`), но **печатается только по опции** «Настройки» → ИНТЕРФЕЙС → «Номера карт» (**по
  умолчанию выкл.** — номер карты техническая информация): штамп `.pcard__code` рядом со знаком дополнения (скрыт на
  thumb-тире) и код на плашке-чипе источника (`.con-src__plate-code`) читают один реактивный флаг
  `cardNumberDisplayState` (`src/client/components/premiumCard/cardNumberDisplay.ts`, localStorage
  `tm_console_card_numbers`; переключение применяется на лету). Каталожные подписи стенда в «Полигоне» печатают код
  всегда — там код и есть предмет.
- Код — **ключ арта**: `assets/card-images/RX01.webp` (1536×1024, 3:2) через штатный пайплайн
  `node scripts/import-card-art.mjs <png> RX01` → `npm run make:cards` (манифест + миниатюра). Грань резолюции
  с артом получает класс `pcard--resolution-art` (окно 3:2 без кадрирования, нижняя секция берёт остаток);
  без арта — прежняя печать партии (`pcard--resolution-seal`).

## 2. Механика и принятые трактовки

Печатный текст: *When enacted: Add 1 animal resource to any card per point of Influence. The player that won this
resolution places an Ocean tile.* Задание: карта с меткой животных.

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Кому платят животных | **Каждому участнику** по **его** влиянию (не только голосовавшим/победителю; два делегата не условие) | `ANIMALS_STEP`, spec «pays every participant…» |
| Момент расчёта влияния | После продвижения победителя по Повестке (шаг 1 фазы) — драйвер даёт `ctx.influence` после `stepAgenda` | `ParliamentPhase.stepEffects` |
| «to any card» | **Одна выплата на одну свою карту**, принимающую животных (правило хранения карты — `getResourceCards(ANIMAL)`; метка животных ≠ хранилище; 0 накопленных — допустимая цель). Без распределения по нескольким картам — прямого основания в rulebook нет | `ANIMALS_STEP`, комментарий файла |
| Влияние 0 | Запроса нет; журнал + `outcome skipped: 'No influence'` | spec «influence 0 asks nothing» |
| Нет получателя | Выплата **названа и пропадает** (журнал + `outcome skipped: 'No card can hold animals'`); ничего не копится и не конвертируется | spec «no eligible card…» |
| Единственный кандидат | **Показывается и подтверждается** (`autoSelect: false` — закон «to ANY card» форка) | spec «a card with zero animals…» |
| Океан | Только победителю (`winnerSteps`), штатный `PlaceOceanTile`: законные клетки, РТ (фаза PARLIAMENT ≠ SOLAR), бонусы клетки/соседства, реакция Зелёных штатным хуком **один раз**, без оплаты и расхода действия | spec «is the standard placement…» |
| Нейтральный победитель | Океана нет, животные всем сохраняются | spec «a neutral winner…» |
| Океан невозможен | `canAddOcean()` ложно → названо и пропущено (штатная операция всё же вызывается ради правила Whales); нет клеток → пропущено | `OCEAN_STEP` |
| Жизненный цикл | Оба эффекта только при принятии; ключи идемпотентности `effect:<gen>:<instance>:<player>:<step>`; повторное законное принятие — новое поколение = новое применение | spec «a later, legal enactment…» |
| Задание | `{goal: {kind: 'tag', tag: ANIMAL}, count: 1}` через общий `QuestTracker`; добавление животных не засчитывается | spec «adding the animals never progresses…» |

**Контракт шага** (`IResolution.ts`): шаг либо мутирует, либо спрашивает. Шаг животных **фиксирует сумму в
`ctx.state.animalsOwed` при первом запуске** и перечитывает её после перезагрузки: вопрос строится с тем же числом,
с которым платится ответ, даже если влияние изменилось.

## 3. Архитектура

### Сервер
- `src/server/parliament/resolutions/greens/AquiferContest.ts` — определение (`AQUIFER_CONTEST`), константы
  `AQUIFER_CONTEST_ID`, `AQUIFER_CONTEST_CODE`, `AQUIFER_CONTEST_ANIMALS` (декларация масштабирования).
- `ResolutionCatalog.ts` регистрирует её первой; `Greens Motion II` остаётся в каталоге с `copies: 0` (старые
  сохранения читают её как раньше, новые партии её не раздают); пул — 12 карт, по две на партию.
- `EnactContext.report(outcome)` — шаг записывает **что реально сделал** в `SerializedPhaseSummary.outcomes`
  (`SerializedEnactOutcome`: игрок, шаг, `effect` id, вид, ресурс, сумма, карта, клетка, причина пропуска, влияние).
  Один результат на (игрок, шаг). Клиент читает это в `ParliamentPhaseModel.outcomes` (по ходу) и
  `ParliamentPhaseSummaryModel.outcomes` (итог).
- `AddResourcesToCard`: опция `from` (источник для журнала — «добавил 3 животных на Рыбы **от Aquifer Contest**»)
  и `andThen(card)` получает карту-получателя.
- Промпты несут источник штатно: `choiceContext {source: {kind:'resolution', resolution}, mode:'reward'}` у пикера,
  `placementContext = committedPlacement(reason, source)` у океана.

### Общий слой — «влияние → результат»
`src/common/parliament/influenceScaling.ts`:
- `InfluenceScaledEffect {id, unit, perInfluence, base?, cap?, recipient}` — декларация в определении резолюции
  (`ResolutionDefinition.scaled` → экспортируется в `IClientResolution.scaled`).
- `scaledAmount(effect, influence)` — **единственная формула**; сервер платит ею, клиент оценивает ею.
- Контексты `InfluenceYieldContext`: `reference` (без игрока — формула без числа) · `estimate` (текущее влияние) ·
  `forecast` (сценарий «если победите»: маркер Повестки сначала делает шаг) · `resolving` (сумма сервера в живом
  промпте) · `applied` (запись `outcomes`, никогда не пересчитывается).
- **Рассчитанная сумма ≠ возможность получить.** `InfluenceYield.skipped` (EN-ключ причины) — чтение `resolving` /
  `applied`, которое **не приземлилось**: сумма остаётся той, что причиталась («✕ 3», зачёркнуто, янтарь), подпись —
  причина («Нет карты, принимающей животных» / «Влияния нет»). Пропущенная запись `outcomes` никогда не читается как
  «Получено +3» (`enactedYieldsOf` различает `kind: 'skipped'`).

### Клиент
- `src/client/console/parliament/influenceYieldModel.ts` — `voteYieldsOf` (estimate + forecast, одинаковый прогноз
  не повторяется), `enactedYieldsOf` (applied/skipped/reference), `resolvingYieldOf`, `noRecipientNoteOf` (честная
  пометка «нет подходящей карты — животные пропадут»), `noRecipientReasonKey` / `noRecipientForecastKey` (ключи по
  ресурсу — для не-животных общий текст), `cardResourcePluralKey`.
- `ConsoleInfluenceYield.vue` (`.con-iyield`, размеры compact/normal/hero) — один графический блок: формула
  `1 [животное] / [влияние] · каждому/победителю` и чтения `[влияние] N → +M [животное]` с подписью контекста
  (`data-yield-context/-influence/-amount/-skipped`). Хосты: блок собственного эффекта в голосовании
  (`[data-parl-vote-yield]`), футер fullscreen-осмотра (`[data-zoom-yield]`, в игре и в меню), стадия принятия
  (`[data-parl-enact-yield]`), док источника в пикере (слот `#under` `ConsoleSourceDock`), Полигон. Строка «Принятие»
  у правительства **удалена** (на 4K наезжала на правителя; принятая сумма живёт в recap и в футере fullscreen).
- `promptSource.ts`: ветка `resolution` → `PromptSourceView.resolution` + `code` — док рисует **грань резолюции**
  (`PremiumCard vmOverride`, код в её угловом штампе), однострочная плашка-чип (досье размещения) печатает код рядом с
  именем (`.con-src__plate-code`); X/L3 открывают инспектор резолюции (`resolutionZoomEntry`). В чипе имя
  **переносится**, а не режется («Ко…» на Deck был потерей контекста решения).
- **Сначала — честный мандаторный промт** (решение пользователя, 2026-09-17; паттерн драфта между поколениями):
  **каждый** промт резолюции (выбор получателя животных, океан победителя, любой будущий виджет) объявляется
  плашкой на главном экране поля — kicker «Эффект резолюции» («Размещение тайла» для размещения), текст запроса
  сервера и чип источника `[эмблема партии] РЕЗОЛЮЦИЯ Конкурс водоносных пластов` (код — при «Номерах карт»); сам
  выбор ничего не открывает до A. Гейт: `consoleMandatoryGate` (`resolutionPrompt` по маркеру источника →
  `RESOLUTION_ASK_KINDS`, `space`/`cardSelect` включительно, один бит на промт), копирайт: `consoleTaskSummary`
  (`sourceResolution`, A-глаголы «Выбрать карту» / «Разместить тайл»). A на промте выплаты → `openMandatoryAnnounce`
  входит в Парламент (единственная дверь — автоматический вход по приходу промта удалён); A на промте океана →
  размещение оживает само (допуск `placement` ждёт `announce-gate`). Пока плашка ждёт, стадия принятия не встаёт
  даже в открытом вручную Парламенте (`enactPrompt` читает `isMandatoryGateHeld()`).
- **Стадия принятия** — постоянно смонтированный слой `.con-parl__enact` в Парламенте (никогда не `v-if`):
  hero-слот `[data-parl-enact-hero]`, чтение выплаты `[data-parl-enact-yield]` (hero), зона
  `[data-embed-slot="parliament-enact"]`. Встаёт по watcher-у `enactStanding` (промпт-карта с источником-резолюцией
  при `phase.step === 'effects'`, уже открытый игроком с плашки); оболочка держит общий `ConsoleTaskHost`
  (`parliamentEnactStanding`, hold до `consoleParliamentUi.enactStanding`) и телепортирует **тот же экземпляр** в
  зону; крошка `ПАРЛАМЕНТ › ПРИНЯТИЕ › ВЫПЛАТА`.
  - **Одна карта**: грань правительства сама переносится на стадию (`<Teleport defer to="[data-parl-enact-hero]"
    :disabled="!enactCarried">` — цель существует всегда, второй копии нет), `consoleParliamentEnactMotion.ts`
    делает FLIP из её прежнего прямоугольника: обзор отступает (RECEDE), карта шагает вперёд (CARRY), чтение и зона
    поднимаются (SURFACE). Законченная выплата **уходит** вместе с workspace; складывание (FOLD) — только если флоу
    не смог завершиться. Перезагрузка внутри выбора паркует обзор без входа (`mounted`).
  - **L3 = источник** и внутри стадии: встроенный хост с источником-резолюцией (`ConsoleTaskHost.stageSourceResolution`)
    поднимает в инспектор **ту самую** грань со стадии — единый резолвер физического источника
    `workspaceSourceZoomOrigin('resolution:<id>')` получил ветку `[data-parl-enact-hero]`. X остаётся за кандидатом,
    B — «свернуть» (выплата не отменяется; A на карточке возврата восстанавливает тот же выбор).
  - **Полёт выплаты** (`consoleResolutionPayout.ts`, транспортный гейт `transportHolds.resolutionPayout`):
    1. A **фиксирует выбор на месте** (`payoutPickLandsInPlace` — маркеры сервера `resourceGainPrompt` +
       `choiceContext.source.kind === 'resolution'`): выбранная карта остаётся («✓ Выбрана»), остальные гаснут; общий
       «уход героя» к игроку унёс бы получателя до прихода животных.
    2. Ответ сервера с новой записью `cardResource` для зрителя задерживается; фишка «+2 [животное]» летит общим
       `runResourceTransfers` **из чтения выплаты на стадии** в капсулу ресурса выбранной карты (`pcard__res` в слоте
       пикера), капсула тикает при касании (`pickPayoutLanding` → `ConsoleTaskHost.landedCardOf`).
    3. Волна объявлена `inSurface: true` → её hold **notification-only** (`resource-transfer-in-surface`): блокирующий
       hold `resource-transfer` снимает все обязательные поверхности, и пикер размонтировался бы под собственной
       выплатой (так и было — фишка улетала в пустоту). Следующий промпт всё равно ждёт транспортный гейт.
    4. Скоуп тика закрывается **после коммита** вида (`nextTick(endResolutionPayout)` в обоих путях коммита), иначе
       капсула на кадры откатывалась к 0 перед уходом стадии. Отмена/отказ — батарея abort транспорта.
  - **Остальные места ждут честно**: `ParliamentPhasePendingModel.input` (тип живого промпта спрошенного места) →
    у правительства «Ожидание: Красный выбирает карту / размещает тайл».
  - **Океан победителя** — после своей плашки и A — штатное размещение доски; досье показывает источник-резолюцию, и
    `L3 Источник` открывает её инспектор (`ConsoleShell.placementSourceResolution` → `inspectPlacementSource`).
- Recap: строки результатов из `lastPhase.outcomes` (свои первыми, пропуски с причиной). Повестка: значок влияния
  (`assets/misc/influence.png`) у показателя и водяным знаком в узлах уровней.
- Журнал/уведомления: `b.resolution(id)` и `from: {resolution}` — существующие токены; заголовки промптов
  переводят токен резолюции через `translateMessage` (добавлена ветка `RESOLUTION`).

### Полигон
«Полигон» → «Витрина резолюций Redux» (`ConsoleResolutionsPlayground.vue`, реестр `ConsolePlaygroundHub`, deep link
`/?resolutionsPlayground`). Всё на настоящих компонентах, каталоге и общей формуле; игру не трогает (синтетическая
модель парламента на два места + синтетические держатели животных).
- Каталог из манифеста (настоящие по коду · заглушки/dev) — новая резолюция появляется сама.
- Грань в трёх масштабах + колонки инспектора; **X — настоящий fullscreen-осмотр** через общий `consoleCardZoom`
  (в меню его обслуживает `ConsoleMenuZoomHost`, получивший сцену резолюции: партия слева, правила справа, статус и
  чтения влияния в футере по таблице стенда — `ConsoleZoomExtra.parliament {model, viewer}`); LB/RB листают каталог.
- **Сценарии (RT)** — воспроизводимые состояния всего инструмента: «Влияние 0 — выплаты нет», «Влияние 1»,
  «Влияние 3 — несколько животных», «Победитель сначала шагает по Повестке» (Повестка 4 → 5: выплата 3, не 2),
  «Влияние сверх трека» (+1 от карт в оценке и прогнозе), «Нет подходящей карты» (✕ 2 с причиной), «Записанная
  выплата» (applied + пропуск «Влияния нет» у второго места), «Зритель — только формула».
- Параметры поверх сценария (чип «изменён»): View — тестовый игрок (А · Б · зритель), A — влияние 0..5,
  Y — контекст (справочно · предложение · принятие · выполнено), L3 — победитель (А · Б · нейтральный),
  LT — курсор пикера. Блок «Каждому игроку» показывает выплату каждого места по **его** влиянию, шаг Повестки
  победителя и его часть эффекта.
- Общий пикер получателя (`ConsolePlayedTargetStep` + `ConsoleSourceDock` с источником-резолюцией, кодом и ПО по
  правилам карт) — или строка пропуска с той же причиной, что записал бы сервер.
- `ConsolePlaygroundStand.padTarget` — интерактивный стенд получает пад первым (B остаётся у стенда).

## 4. Проверки

- Сервер: `tests/parliament/AquiferContest.spec.ts` (18 спеков: каталог/код, выплаты по влиянию 0/1/3, не-голосовавшие,
  рост влияния победителя, несколько карт, 0 ресурсов, нет получателя, метка ≠ хранилище, квест, океан штатный +
  Зелёные ×1, нейтральный победитель, океан невозможен, перезагрузка внутри выбора/между выплатами/в размещении,
  повторный ответ, повторное принятие, MarsBot, финальный счёт, модель/журнал/строка ожидания других мест).
- Клиент: `influenceYieldModel.spec.ts` (+ пропуск ≠ «получено»), `consoleResolutionPayout.spec.ts` (детект, скоуп
  тика, фиксация на месте), `consoleResourceTransfer.spec.ts` (волна внутри поверхности не блокирует),
  `promptSource.spec.ts` (ветка resolution), `resolutionPremiumFace.spec.ts`, `PremiumCard.spec.ts`.
- e2e (1080 / TV 4K 3840×2160 `consoleProfile=tv` / Deck 1280×800 `handheld`):
  - `console-parliament-aquifer.spec.ts` — грань (арт, код, формула), чтение в голосовании и в футере fullscreen,
    стадия принятия (одна карта на стадии, общий пикер, крошка, чтения ресурса/ПО), L3 → инспектор резолюции,
    B → свернуть → A → тот же выбор, полёт фишки с тиком капсулы (MutationObserver-пробник), размещение океана с
    источником в досье, выплата второму месту по API, итоговые `outcomes`, следующее поколение.
    Фикстуры `parliament-aquifer-vote`, `parliament-aquifer-enact`. Скриншоты `screenshots/parliament-aquifer/<preset>/`,
    запись `PARL_VIDEO=1` → `screenshots/parliament-aquifer/video/` (кадры выплаты и океана).
  - `console-resolutions-playground.spec.ts` — каталог, 8 сценариев с точными чтениями, тестовый игрок/влияние/
    контекст/победитель, настоящий fullscreen, пикер, отсутствие нативного скролла. Скриншоты
    `screenshots/resolutions-playground/<preset>/`.

## 5. Рецепт: следующая резолюция

1. Файл `src/server/parliament/resolutions/<party>/<Name>.ts`: `id: 'RDX_<PARTY>_<NAME>'`, `code: 'RX<NN>'` (номер по
   алфавитному списку §4 спецификации), `party`, `copies: 1`, `renderData` (DSL: `resource().slash().influence()`,
   `oceans(1).voteWinner()` для части победителя), `text {name, effect?, winner?, passive?, action?, quest}`, `quest`,
   `scaled: [{id, unit, perInfluence, base?, cap?, recipient}]` для частей, зависящих от влияния,
   `immediateSteps` / `winnerSteps` (каждый шаг — мутирует **или** спрашивает; сумму фиксировать в `ctx.state`;
   `ctx.report(...)` при мутации/пропуске; источник `{kind:'resolution', resolution: id}` в `cause`/`placementContext`
   **обязателен** — именно по нему каждый вопрос резолюции приходит честным мандаторным промтом с плашкой источника;
   `from: {resolution: id}` в мутациях).
2. Зарегистрировать в `REDUX_RESOLUTION_CATALOG`; заменяемую заглушку оставить с `copies: 0`.
3. RU-ключи в `src/locales/ru/parliament.json` (проверить дубликаты `grep` по всем `src/locales/<lang>/*.json`).
4. Арт: `node scripts/import-card-art.mjs "<png 1536×1024>" RX<NN>` → `npm run make:cards`.
5. Спек `tests/parliament/<Name>.spec.ts` по образцу Aquifer Contest; при новом виде выплаты — новая ветка
   `InfluenceYieldUnit`/`ParliamentEnactOutcomeModel.kind` и её чтение в `outcomeText`; причину пропуска для
   карточного ресурса брать из `noRecipientReasonKey` (для не-животных есть общий ключ), журнал — свой шаблон.
6. Клиент **не требует** отдельных правок: мандаторная плашка (любой виджет из `RESOLUTION_ASK_KINDS`), грань,
   голосование, fullscreen, пикер (фиксация на месте + полёт выплаты для любого `cardResource`-исхода резолюции),
   L3-источник, стадия принятия, recap и Полигон читают манифест и `scaled`. Если новая резолюция спрашивает не
   картой и не клеткой — проверить, куда ведёт A (`openMandatoryAnnounce`: хост-задачи встают сами после гейта). Проверить в «Полигоне» (каталог подхватывает новую карту из реестра; сценарии работают на любой
   `scaled`-декларации).

> **Продолжение:** счётный член («+N за X + влияние, макс. M»), общее правило значка ПО, физический переход принятой
> карты и полёт выплаты производства в итогах фазы — `TURMOIL_REDUX_ARCHITECTURE_AWARD.md` (RX02, §6 — рецепт).
