# Промт исполнителю · Парламент Turmoil Redux — ОДИН ФРЕЙМВОРК: партийные и законные ЭФФЕКТЫ живут в эксплорере «Эффекты» как группы той же сетки, партийные и законные ДЕЙСТВИЯ идут через ОДИН композер «Действий карт» (добор «Красных» = добор «Центра ИИ» байт в байт), партия — БЕЙДЖ поверх оригинального каркаса, а не второй каркас; `ConsolePartyEffectsStrip` (`.con-pfx`), `ConsolePartyActionComposer` (`.con-pact`), `partyFlow`, `submit-party`, `party-owed` — УДАЛЕНЫ; сервер отдаёт партийному/законному действию то же `ActionPreview`, тот же источник добора и тот же контекст выбора, что карте

> **Статус: ВЫДАН 2026-10-24.** HEAD `8512b6f9fc` (версия 1.2.1869). Рядом работают другие сессии: перед стартом `git status` + `ListAgents`.
> На выдаче в дереве чужое: `assets/text/lore_texts.json` (M) и `docs/claude/prompts/replacement-aerial-lenses.md` (A) — не трогать. Промт
> Pristar (`classic-corp-pristar.md`) называл файлы соседа `ConsolePartyPlaque.vue`, `parliamentEffectsModel.ts`, `console_party_plaque.less`,
> `parliamentEffectsStep.spec.ts`, `partyAlliance.spec.ts` — Pristar СДАН (`2348d22b97`), но перепроверить, что они чисты, прежде чем их править.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- onefw <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`). Это многодневная работа
> вертикальными срезами на `main`: каждый коммит зелёный, конечное состояние закреплено гардом (§ 9.П0). **Не пушить.**

---

## Суть (слова владельца, 2026-10-24)

«Сейчас мы как будто бы написали ВТОРОЙ ФРЕЙМВОРК для одной и той же задачи: функционально дублируем то, что уже было реализовано, и вдобавок
сделали новый визуальный язык. Эффекты и действия партий МОГУТ иметь свои обозначения, но это должно быть ПОВЕРХ оригинального фреймворка, а
не параллельная имплементация. Добор и сброс от действия „Красных“ — это просто активация ещё одного действия; даже если это не действие синей
карты, это не важно — приводим к одному визуальному языку, максимум метку партии оставляем.»

Два примера владельца, оба подтверждены кодом (§ Диагноз): (1) в Информации › ЭФФЕКТЫ партийные эффекты стоят СВЕРХУ отдельной полосой, в своём
визуале, и фокус до них не доходит; (2) добор «Красных» — добранные карты мелкие и не на том месте, где их кладёт «Центр ИИ».

**Закон этой итерации — три «ОДИН»:**
1. **ОДНА МОДЕЛЬ ИСТОЧНИКА.** Эффект и действие имеют ИСТОЧНИК: карта · партия · принятый закон. Источник — дискриминированный тип, никогда не
   поддельный `CardName` (`partyTileKey` сегодня притворяется именем карты).
2. **ОДНО СЕМЕЙСТВО ПОВЕРХНОСТЕЙ.** Эффект любого источника — плитка эксплорера «Эффекты» (`.con-efx`), в его сетке, в его фокус-рядах, с его
   фасетами, дозорной строкой и слоем деталей. Действие любого источника — плитка «Действий карт» (`.con-cardactions`), его композер
   (`ConsoleActionComposer`), его зона исхода, его ACTION COMMIT, его шаги (рука · колонии · повтор · оплата · розыгрыш). Партия/закон отличаются
   БЕЙДЖЕМ: кикер плиты, эмблема, кромка акцента — и ничем более.
3. **ОДИН ПОТОК.** Фазы — `consoleWorkspaceFlow.ts`; двери шагов — `followUp` / `owed-step`; сабмит — `submit-batch` → `gameTransport`; завершение —
   `concludeWorkspaceFlow` с пятью именованными удержаниями. Никакого `partyFlow`, `submit-party`, `party-owed`, таймеров-«тактов».

Прецеденты, на которые опираться: «Стандартные проекты» на каркасе «Действий карт» (`docs/claude/console/standard-projects-workspace.md` — меню-образная
поверхность перенесена на композер/шаги/заключение); форма «ресурс на карту» RX37, обобщённая ПО ФОРМЕ ПРОМПТА, а не по партии (`df964fad00`);
эксплорер как хост-агностик с режимом прогноза вторым хостом (`docs/claude/console/effects-explorer.md` § Reuse contract) — и в прогнозе он УЖЕ
рисует партийный источник эмблемой (`ConsoleEffectsExplorer.vue:181-182`, `:1001-1042`); «Информация › ДЕЙСТВИЯ» = те же плитки «Действий карт»
read-only («один компонент, два хоста» — TR60 6a).

## Образцы — по частям (читать ДО кода)

`CLAUDE.md` (⭐ «A WORKSPACE IS ONE FLOW», COMMIT BOUNDARY, инварианты 1–3, 5–7, 10, 12, 14) · `.claude/rules/console-ui.md` · `docs/claude/console/workspace-band.md`
§ EMBEDDED OUTCOMES / ACTION COMMIT / WORKSPACE DESCEND / BATCH ARRIVAL · `docs/claude/console/workspace-embed.md` (шесть правил) ·
`docs/claude/console/effects-explorer.md` · `docs/claude/console/card-draw-motion.md` § Законы семейства · `docs/claude/console/composer-preselect.md` ·
`docs/claude/parliament-glossary.md` (§ 1, 3, 5, 8-bis) · `docs/CONSOLE_BLUE_ACTION_PARITY.md` (ит. 16, 19, 22–24) · `docs/TURMOIL_REDUX_SPEC.md` § 1.2, § 3.3,
§ 6.3–6.4 (исходный замысел: «строка в explorer „Эффекты“ с не-карточным источником», «партийные действия как плитки → stage → embedded steps») ·
`docs/TURMOIL_REDUX_PARLIAMENT_V2.md` § 3–4 и `docs/TURMOIL_REDUX_PARLIAMENT_UI_REWORK.md` § 3/§ 5 (то, что эта итерация ЗАМЕНЯЕТ) ·
`docs/TURMOIL_REDUX_OPEN_IP_TRADE.md` § 2/§ 4, `TURMOIL_REDUX_LIVE_EXPERIMENTS.md` § 1/§ 3, `TURMOIL_REDUX_MANUFACTURING_RUN.md` § 4.1 (законные
действия, которые переезжают). Код: `ConsoleEffectsExplorer.vue` + `effectsExplorerModel.ts` + `effectExtraction.ts`; `ConsoleCardActions.vue` +
`consoleCardActions.ts` + `ConsoleActionComposer.vue` + `consoleWorkspaceOutcome.ts` + `consoleActionCommit*.ts`; `ConsolePartyActionComposer.vue`
(что удаляется — прочитать ЦЕЛИКОМ, чтобы ничего из его обязательств не потерять); сервер `PartyEffects.ts`, `ParliamentHandler.ts:98-160`,
`resolutions/IResolution.ts`, `Player.ts:1820-1841` / `:3164-3202`.

## Диагноз (подтверждён файл:строка на `8512b6f9fc`; перепроверить на своём HEAD)

### Д1. Эффекты: полоса над эксплорером вместо групп в нём
- `ConsoleInfoMode.vue:213-227` — маршрут `effects` монтирует ТРИ поверхности столбиком: `ConsoleArmedEffectsSection` (`.con-armsec`), **`ConsolePartyEffectsStrip`
  (`.con-pfx`)** и под ними `ConsoleEffectsExplorer`. Полоса — свой компонент (172 строки), своя модель прямо в `rows()` (`:90-146`), своя копия
  («Party effects», «From the Parliament: the ruling party and every party with two of this player's delegates»), свой LESS (`console_party_action.less:403-444`,
  TV `:523-528`: фиолетовый градиент, фиолетовое кольцо, эмблема 3.4rem, формула `.95×ui`, «почему» мятным) — ни одного токена `--efx-*`.
- **Фокус не доходит**: у плиток полосы нет `data-effect-key`; фокус-ряды эксплорера `flatKeys`/`rows` строятся ТОЛЬКО из `playerEffects(cards)`
  (`ConsoleEffectsExplorer.vue:574`, `effectsExplorerModel.ts:230-289`), d-pad ходит `stepActionRows(this.rows, …)` (`:1421-1438`). `ExplorerEffectInput.cardName: CardName`
  (`effectsExplorerModel.ts:74-82`), `EffectEntry.cardName: CardName` (`effectExtraction.ts:42-80`) — модель не знает источника, кроме карты.
- **Зона лжёт**: сводка «ЭФФЕКТЫ» считает `effectsZoneCounts(playerEffects(tableau))` (`ConsoleInfoMode.vue:699-700`) — партийные/законные эффекты в счёт
  и в фасеты не входят; X («Осмотреть», `:1515`) до них не добирается; каскад деталей перечисляет `.con-pfx` отдельной строкой (`:1165`, там же
  мёртвый селектор `.con-armed-sec` — у секции корень `.con-armsec`).
- **Третья модель того же**: сцена Парламента строит «ВАШИ ЭФФЕКТЫ» из `parliamentEffectsModel.parliamentEffectItems` (дороги доступа, партия/закон,
  состояние действия), полоса — из своего `rows()` (по `access.hasEffect` + закон первым), шаг «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» — из `parliamentEffectsStepModel.ts`;
  три ответа на вопрос «что у меня есть от Парламента», три семейства плиток (`.con-pfx__*`, `.con-parl__effects-*`, `.con-parl-fx__*`).
- **Асимметрия**: «Информация › ДЕЙСТВИЯ» (`info/ConsoleInfoActionGallery.vue:84-100`) строит ТОЛЬКО карточные записи и передаёт `[]` источников
  Парламента — партийные действия там отсутствуют, при том что партийные эффекты в «ЭФФЕКТЫ» вклеены сверху.

### Д2. Действия: второй композер со своей зоной добора, своим потоком и своим сабмитом
- Плитка «Красных» СТОИТ в сетке «Действий карт» (`ConsoleActionGroupView.vue:26-42`, `:97-99`: плита с эмблемой и кикером «Party action», канва —
  `ConsolePartyFormula`) — но нажатие расходится: `ConsoleCardActions.vue:2284-2287` `if (tile.party !== undefined || tile.resolutionAction !== undefined) { this.openPartyAction(tile); return; }`,
  шаблон `:330` (`ConsoleActionComposer`) против `:355` (**`ConsolePartyActionComposer`**, 2237 строк; 45 общих импортов с `ConsoleActionComposer.vue`).
- Композер ветвится ПО ПАРТИИ: `PartyComposerKind = 'industrialists' | 'scientists' | 'reds' | 'unity' | 'resolution'` (`:550-594`), `kind === 'reds'` в
  CTA/командах/ответах (`:395`, `:414`, `:1165`, `:1184`, `:1213`, `:1737`) — тогда как RX37 уже показал правильный путь: форма «ресурс на карту» читается
  по ФОРМЕ ПРОМПТА (`resourceForm`), а не по партии.
- **Своя зона добора** `.con-pact__revealzone` / `__beatstage` / `__beatrow` / `__beatslot` / `__beatstatus` (`:161-185`; LESS `console_party_action.less:289-303`) —
  копия `.con-composer__revealzone--draw` / `__beat*` (`console.less:36373-36475`). Общий каркас этапа знает только композер карты:
  `:is(.con-task, .con-reveal__card, .con-composer__beatstage, .con-deckpick__frame).con-ws-stage-frame` (`console.less:1141`, голова `:1158`, статус `:1343`,
  TV `console_tv.less:597`) — подготовленные слоты «Красных» не совпадают с ректами, в которые реально ложатся карты; гнёзда слотов
  (`.con-composer__beatslot::before`, `:36460-36475`) у `.con-pact__beatslot` отсутствуют.
- **Почему карты мелкие и не там** (по CSS, замерить кадром до правки): `.con-cardactions__pact` — `align-content: start` (`console_party_action.less:357-364`),
  `.con-pact` — grid без шаблона строк (`:2-8`), `.con-pact__main` — flex-колонка (`:22`), `.con-pact__source` — `align-self: start` (`:18`) → у зоны нет
  определённой высоты, `[data-embed-slot] > * { height: 100% }` разрешается в auto, и фит ревила падает на ПОЛ `Math.max(200 * ui, …)`
  (`ConsoleRevealOverlay.vue:2338`, то же `:2103`). Композер карты стоит `position: absolute; inset: 0` + `grid-template-rows: minmax(0, 1fr)` (`console.less:36140-36181`),
  а его `--draw`-зона берёт ВЕСЬ остаток сцены (`:36407-36413`). Показательно: для ЗАКОНА ту же дыру уже латали третьим правилом —
  `.con-pact--resolution { align-content: stretch; grid-template-rows: minmax(0, 1fr) }` (`:536-546`), для «Красных» — нет. Это и есть цена второго
  семейства: каждая починка каркаса делается дважды, и второй раз — забывается.
- **Старая копия такта добора** («ported», `ConsolePartyActionComposer.vue:2057-2234`): заголовок заранее говорит результат («Cards received», `:1245-1247`)
  вместо «Берём карту из колоды» (PL-206, `ConsoleActionComposer.vue:1982-1996`); ждёт голым `requestAnimationFrame` (`:2092`, `:2194`, `:2214`) вместо
  `probeTick`; держит счётчик колоды сырым `holdDeckDisplay` (`:2126`) вместо `holdBeatDeck`/`adoptDeckSeed` (PL-088); без потока сброса и ожидания
  поиска; меряет `row.parentElement` вместо `closest('.con-composer__beatstage')`; свой `scheduleParliamentBeat`.
- **Свой поток**: `consoleCardActionsUi.partyFlow` (`consoleCardActions.ts:495-540`: `stage: 'setup' | 'committed' | 'result'`, `mcBefore`, `fleetBefore`) рядом с
  типизированными фазами `consoleWorkspaceFlow.ts`; своё удержание `'party-owed'` (`ConsoleShell.vue:8809`, `partyFlowOwed` `:8230-8270`) рядом с пятью
  именованными (`consoleWorkspaceFlow.ts:268-289`); свой сабмит `submit-party` → `onCardActionsSubmitParty` (`ConsoleShell.vue:448`, `:17070`) рядом с
  `submit-batch` (`:447`, `:17148`); своя маршрутизация исхода `partyOutcomeOn` (`ConsoleCardActions.vue:1075-1079`, `:1374-1377`, `:1964-1968`:
  «A PARTY's / the LAW's drawn batch presents in the party composer's own zone — the card composer's outcome record stays undefined for it»).
- **Своя панель результата** `.con-pact__result` / `[data-pact-result]` («Cards discarded N · Paid M€ for K tag(s)»), выплата читается КЛИЕНТОМ как
  `megacredits − mcBefore` (`ConsoleCardActions.vue:3186-3195`) — инвариант 7 (клиент не пересчитывает правила) и 2 (сервер авторитетен);
  такты — `setTimeout` (`PARTY_SUBMIT_SAFETY_MS` 6000 · `PARTY_RESULT_BEAT_MS` 1800 · `PARTY_RESULT_AWAIT_MS` 4000, `:555-560`) — инвариант 6.
- **Поддельное имя карты**: `cardName` плитки/клейма = `partyTileKey(party)` / `resolutionTileKey(id)` (`consoleCardActions.ts:163-206`, `partyActionKey.ts`);
  `workspaceOutcomeState.sourceCard === composer.cardName`; ACTION COMMIT получает `actionNode: undefined` и `sourceCard: 'party:Reds'`
  (`ConsolePartyActionComposer.vue:1816-1824`) — импульс метёт всю `.pcard__mech`, хотя `PremiumMechanicsPanel` под плашкой УЖЕ печатает `data-graphic-node`.

### Д3. Сервер: партийное действие — не действие
- Опции меню: карточные действия — ОДНА `SelectCard('Perform an action from a played card', {selectBlueCardAction: true})` (`Player.ts:1820-1841`);
  партийные и законные — отдельные top-level опции `ParliamentHandler.partyActionOptions / resolutionActionOptions` (`Player.ts:3197-3202`), каждая —
  собственный `actionInput` определения. Это ПРАВИЛЬНО (наличие опции = доступность, инвариант 2) и не меняется; меняется то, что вокруг.
- Протокол: `PartyEffectDefinition` (`PartyEffects.ts:57-102`) и `ResolutionDefinition.action` (`resolutions/IResolution.ts:108-144`) — мимо `IActionCard`;
  это допустимо (партия — не карта), но у них НЕТ того, что клиенту даёт карта: `ActionPreview` (ветви · шаги · прогноз · тщетность) — только
  `preview: ActionEffect[]` (`common/models/ParliamentModel.ts:308-347`); нет `actionReasons`/`actionFutility`; у «Красных» нет `markChoiceContext`
  (у Индустриалистов есть, `:315`).
- Добор «Красных» — `player.drawCard(2)` БЕЗ источника (`PartyEffects.ts:371`) → reveal `{type: 'party'}` из контекста (`DrawCards.ts:37-38`); карта даёт
  `{source: {type: 'card', cardName}}` (`Executor.ts:533-541`). Клейм на клиенте подбирает партийный добор по поддельному ключу
  (`consoleWorkspaceOutcome.ts:766-777`).
- Стадия промпта по имени партии: `party === PartyName.REDS ? 'confirm' : 'choose'` (`ParliamentHandler.ts:122`). Лимит `1` захардкожен трижды
  (`Parliament.ts:1212`, `PartyEffects.ts:400`, `:492`). Прогноз партийных пассивов — ручной `partyFacts` (`models/effectForecast.ts:295-336`) поверх
  уже объявленных `reactions`/`tileAnswer`.
- Журнал/события — ОК и остаются: `runPartyAction` открывает корень `{kind: 'party'}` категории `parliament` (`PartyEffects.ts:459-469`), сброс и выплата
  идут через `discardCardFromHand` / `stock.add(…, {from: {partyName}})`; персист `pendingActions` переживает перезагрузку.

## Целевой контракт (это и есть ТЗ; каждый пункт — с гардом)

### К1. Источник — тип, не имя карты (общий слой клиента)
`EffectSource = {kind: 'card', name: CardName} | {kind: 'party', party: ReduxParty} | {kind: 'law', resolution: ResolutionId}` (и тот же тип для действия)
в `src/client/components/effects/` + `actions/`; `EffectEntry` / `ActionEntry` несут `source` (карточные — как раньше, `cardName` остаётся удобством для
`kind === 'card'`); ключи v-for — `sourceKey(source)` (`card:<name>` / `party:<id>` / `law:<id>`). Один помощник «что у игрока есть от Парламента» —
`politicalSources(parliament, viewerColor)` в `src/client/console/parliament/` (дороги доступа через `accessRoadOf`, партии по порядку стола, закон —
`hasPassive`/`hasAction` из манифеста) — им кормятся эксплорер, «Действия карт», обе галереи Информации И блок сцены (`parliamentEffectItems` сводится
к нему или удаляется). `partyTileKey`/`resolutionTileKey` перестают быть `CardName`.

### К2. Эффекты — группы эксплорера
- `playerEffects(tableau)` → `playerEffects(tableau, political?)`: пассив партии (`passiveRenderData`, у которой есть непустая строка — пустой builder
  = `[[]]`) и ПОСТОЯННАЯ часть закона (`renderData`, группы `effect`; разовые выплаты — никогда) становятся `EffectEntry` с `source.kind` party/law,
  `renderRoot` = их печатный корень (тот же DSL, что рисуют лицо, инспектор и плашка — «одна формула на партию»), `description` = `text.passive`.
- Группа = ИСТОЧНИК: плита — эмблема на месте чипа ресурса, имя по `partyNameKey` / `text.name`, кикер-бейдж «ЭФФЕКТ ПАРТИИ» (закон — «ЭФФЕКТ, ПОКА
  ПРИНЯТА», глоссарий § 1/§ 3), кромка — акцент партии. Плитка — ТОТ ЖЕ `.con-efx__tile` (`--efx-*`, семейный рельс, `--focused`), семейство — `effectFamily`
  с `sourceKind: 'party' | 'law'` (`classifyEffectSignature` его уже принимает).
- Мета-строка (лестница честности): у политического источника нет статистики — строка = ЧТЕНИЕ ДОСТУПА глоссария § 5 («Доступен · партия правит» /
  «Доступен · два ваших делегата на её резолюции» / «… по альянсу» / «… выдан картой»), у закона — «действует для всех»; никаких нулей и «не срабатывал».
- Фокус-ряды, фасеты, счётчики зоны (`effectsZoneCounts`), X (`partyEffectZoomEntry` / `resolutionZoomEntry` — есть в `cardZoomTypes.ts`), слой деталей
  (герой — `ConsolePartyPlaque` / `PremiumResolutionFace` в слоте героя, печатное правило, чтение доступа; блок «За партию» не рисуется — честно
  пусто) — всё общее. Порядок групп — решение Р1.
- `ConsolePartyEffectsStrip.vue`, `.con-pfx` (LESS + TV), её ключи локали и спек — УДАЛИТЬ. `ConsoleArmedEffectsSection` (TR49 «взведено») — тот же
  антипаттерн (полоса без фокуса, «the party strip's precedent»): в этой итерации НЕ трогать, но в отчёте назвать как следующий кандидат.
- «Информация › ДЕЙСТВИЯ» получает источники Парламента тем же `buildParliamentTile` (чужое место — read-only, как у карт).

### К3. Действия — один композер, бейдж на плите
- `ConsoleCardActions.vue:2284-2287` — ветка `openPartyAction` исчезает: плитка партии/закона открывает ТОТ ЖЕ `ConsoleActionComposer` с `entry.source`
  партии/закона. Герой — слот карты-героя, в нём `ConsolePartyPlaque size="hero"` (решение Р2) или лицо закона `PremiumResolutionFace`; размер бокса
  героя — тот же, что у карты, во всех фазах (правило «дети колонки героя одинаковы в каждой фазе»).
- Строки решения строятся ПО ФОРМЕ ПРОМПТА, никогда по партии: `SelectOption` → только коммит (Красные, Trade Industries, Live Experiments);
  `or` из `SelectCard` → целевые строки с предвыбором единственной цели (Учёные, Manufacturing Run — T14); **`and` из двух `or`** (Индустриалисты:
  «понизить» → «повысить») — композер ПОЛУЧАЕТ поддержку `and` (строка на участника, ОДНА грамматика вариантов `ConsoleVariantChoice`, палитры
  производств из `58bda86eb4` переносятся как палитры этой строки); `SelectCard` руки → шаг «рука» (Open IP Trade — ВЫБОР); `markRepeatActionPrompt` →
  повтор (`consoleRepeatPick`, как Вирон — R&D Funding); `SelectPayment` → шаг оплаты в зоне (`action-bill` → общий слот оплаты композера; Trade
  Industries, Live Experiments); обещанный розыгрыш (`ResolutionPlayModel.play`) → слот «КАРТА» + мост `consolePlayPick` (RX36 — его сцена посадки
  остаётся, но хост — ОДИН композер: `sourceSelector` → лицо героя). Союз — колонии шагом (`con-composer__colonyzone`, слот `action-colonies`).
- Исход — ОДНА запись `outcomeFlow` «Действий карт»: клейм `claimWorkspaceOutcome('card-actions', sourceKey, ['draw'], …)` на сабмите →
  `{kind: 'pending'}` → `{kind: 'draw'}`; батч ложится в `con-composer__revealzone--draw` с подготовленной сценой такта (`fitBeatStage` /
  `beginBeatFlight` / `runBatchArrival` / `handOffBeatBatch` — без копий), колода отвечает с `.con-deckstack__pile`. **Кадр добора «Красных» и «Центра ИИ»
  на одном профиле неразличимы** (§ 9.П3).
- Обязательный сброс «Красных» — шаг «рука» ТОГО ЖЕ композера (слой `action-hand`, прецедент сброса Плутона TR23 `ConsoleActionComposer.vue:805`),
  дверь — `owed-step` по маркеру `partyActionPrompt.stage === 'discard'` (обобщить детектор `followUpStepOwed` на семейство маркеров, не на партию),
  хвост крошки «СБРОС КАРТ» (глоссарий § 5 резервирует его за хвостом Красных): `⚡ ДЕЙСТВИЯ КАРТ › КРАСНЫЕ › НАСТРОЙКА → ДОБОР КАРТ → СБРОС КАРТ`.
- Выплата «Красных» — ACTION COMMIT, не панель: токены рождаются на печатной иконке «2 M€ / [метки]» плашки (анкер — `data-graphic-node`
  `PremiumMechanicsPanel`) и летят в ряд M€, ряд тикает на касании; сумма — ответ сервера (рельсовая половина коммита читает движение ряда ЭТОГО
  ответа; `known`-ходы как у TR23), никогда `megacredits − mcBefore`; «меток нет — M€ нет» называет себя чипом-пропуском у той же иконки (инвариант 4,
  сервер уже пишет это в журнал). `.con-pact__result`, `partyResult`, все три таймера — удалить. Trade Industries: флот = тот же механизм
  (`fleetBefore` → чтение ответа через рельс/`ColonyFleetIcon` в волне), без «результата» отдельной поверхностью.
- Завершение — `workspaceConclusionFor` / `concludeWorkspaceFlow` с ИМЕНОВАННЫМИ удержаниями; `partyFlow`, `party-owed`, `submit-party`,
  `onCardActionsSubmitParty` — удалить (то, что в нём про RX36 — посадка карты закона — переезжает в `onCardActionsSubmitBatch`/`staged-play` общего
  композера; `lawPlayLanding*` остаётся сценой посадки, но её хост и источник — общий композер).
- Доступность: плитка партии/закона читает ОДНО превью сервера (К4) той же лестницей статусов, что карта (`parliamentSourceStatus` сводится к общей),
  заблокированное — выключено С ПРИЧИНОЙ (инвариант 2/5). Счётчик колеса (`potentialAvailability.ts:71`) уже суммирует — оставить.

### К4. Сервер — партийному/законному действию то же, что карте
1. `ActionPreview` с ключом-источником (`card` | `party` | `law`): тот же построитель, что для карты, над тем же деревом промпта, которое вкладывает
   меню (`actionInput` / `execute` в пробе — `withPlayProbe` уже есть у закона): `branches`, `steps`, `forecast`, `futile`; `/api/action-preview` принимает
   источник; `potentialActions` считает тщетные политические так же, как карточные. `ParliamentActionModel.preview: ActionEffect[]` остаётся как
   быстрый чип плиты, но композер читает `ActionPreview`.
2. Добор — с явным источником: `player.drawCard(2, {source: {type: 'party', party}})`; закон — `{type: 'resolution', id}` (контракт `CardDrawRevealSource`
   уже знает оба).
3. `markChoiceContext({source: {kind: 'party' | 'resolution', …}, trigger, mode})` на КАЖДОМ промпте партии/закона (Красные, Учёные, стадии законов) —
   как у Индустриалистов.
4. `stage` промпта — из определения / формы промпта, не из `party === REDS`; `PARTY_ACTION_USES_PER_GENERATION` — одна константа, читаемая
   `redsDiscardPrompt` и `toClientPartyEffect`.
5. (Если влезает в бюджет, иначе — строкой в отчёте.) `partyFacts` прогноза — из объявленных `reactions`/`tileAnswer`, не ручной таблицей.
6. НЕ меняется: категория `parliament` и заголовок журнала (Р6), `pendingActions`, бот (свои примитивы), `TradeWithUnity`.

### К5. Сцена Парламента
Блок «ВАШИ ЭФФЕКТЫ» на обзоре — СВОДКА сцены (v8 § 6, принят владельцем) — остаётся, но питается `politicalSources` (К1). Внутренний шаг
«ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» становится ХОСТОМ: правая колонка — `ConsoleEffectsExplorer` (третий хост, `cards` + политические источники с фильтром
«только Парламент», свой `EffectsExplorerUi`), левая — плитки действий `ConsoleActionGroupView` read-only (как «Информация › ДЕЙСТВИЯ»), A на
плитке — та же дверь `openWith`; `.con-parl-fx__*` и `parliamentEffectsStepModel.ts` — удалить (решение Р4). Бюджет обзора (`console-parliament-info-budget`)
меряет ОБЗОР, не шаг — не должен измениться.

### К6. Бейдж партии — одна грамматика везде
Плита группы/плитки/героя: кикер «ДЕЙСТВИЕ ПАРТИИ» / «ЭФФЕКТ ПАРТИИ» (закон — «ДЕЙСТВИЕ, ПОКА ПРИНЯТА» / «ЭФФЕКТ, ПОКА ПРИНЯТА»), эмблема партии на месте
чипа, кромка `--parl-accent`; дорога доступа — знак (крона / два куба / эмблема партнёра / карта), как на скамье v8; использования — чип «N из M в этом
поколении» (`sourceUsesText`). Без собственных фонов, градиентов, шрифтов, размеров (решение Р5). Имя партии — только `partyNameKey` (гард глоссария).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте ОДНИМ `AskUserQuestion`)
| № | Вопрос | По умолчанию | Альтернатива |
| --- | --- | --- | --- |
| Р1 | Порядок политических групп в эксплорере | ПЕРВЫМИ: закон → правящая → партии по порядку стола (e2e законов ждут «закон первой»), затем корпорация и карты | после корпорации, перед картами проектов |
| Р2 | Герой партийного действия в композере | `ConsolePartyPlaque size="hero"` в боксе героя карты (одна формула, одно лицо партии) | синтезированное карточное лицо партии |
| Р3 | Выплата «Красных» / флот Trade Industries | волна ACTION COMMIT с печатной иконки в рельс; панели результата нет | одна строка «ПОЛУЧЕНО» под рядом сброса (нет: второй язык результата) |
| Р4 | Шаг «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» | хост эксплорера + плиток действий (третий хост) | оставить свои плитки (нет: третье семейство) |
| Р5 | Бейдж | кикер + эмблема + кромка акцента, ничего более | только эмблема |
| Р6 | Журнал/события | категория `parliament`, заголовок «использовал действие партии» — без изменений | категория `card-action` |
| Р7 | Объём | 4 партийных + 5 законных действий — все в один композер; `ConsolePartyActionComposer.vue` УДАЛЁН в конце серии | законные — следующей итерацией (только если упёрлись; тогда тонкий адаптер и честная строка, не второй композер) |
| Р8 | Статистика «За партию» для политических эффектов | не в этой итерации; мета = чтение доступа; шов назван в отчёте (`withEffectSource` уже пишет `effect-triggered` с источником party/resolution — агрегат можно ключевать `EventSource`) | сделать сейчас |
| Р9 | Превью | серверный `ActionPreview` с источником (К4.1) | клиентская сборка из `preview: ActionEffect[]` (нет: инварианты 2/7) |

## 0. Рабочее дерево
1. `git log --oneline -1` → `8512b6f9fc` на выдаче. `ListAgents` + `SendMessage` соседям: твои файлы — всё под `src/client/console/parliament/`,
   `src/client/components/console/parliament/`, `ConsoleCardActions.vue`, `ConsoleActionComposer.vue`, `ConsoleEffectsExplorer.vue`, `ConsoleInfoMode.vue`,
   `info/ConsoleInfoActionGallery.vue`, `consoleCardActions.ts`, `effectsExplorerModel.ts`, `effectExtraction.ts`, `actionExtraction.ts`, `consoleWorkspaceOutcome.ts`,
   `consoleActionCommit*.ts`, `ConsoleShell.vue` (только названные методы), `console.less` § `.con-efx` / `.con-composer`, `console_party_action.less`,
   `console_parliament_chamber.less` § effects, сервер `parliament/**`, `models/actionPreview*`, `models/effectForecast.ts`, `common/models/{ParliamentModel,ActionPreviewModel,PlayerInputModel}.ts`,
   `ru/{console,turmoil_redux,parliament}.json` (свои ключи), перечисленные тесты, доки. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>`);
   после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine**: `npm run build` → `npm run e2e:snapshot onefw` → `npm run e2e:remote -- onefw <spec…>`; кадры «до» — клиент HEAD в
   своём снапшоте `.e2e-onefw-before` (`ab-baseline-head-client-in-snapshot`), прогон тем же стендом с `TM_E2E_SHOTS_TAG=before`. Exit 2/3/4 — СТОП и
   `AskUserQuestion`; `TM_E2E_BESIDE_GAME` / `TM_E2E_LAPTOP_OVERRIDE` агент не ставит. Тайминги и раскадровки — `--exclusive --workers=1`.
3. В фикстуру `parliament-actions` добавить «Центр ИИ» в стол игрока (чистый добор 2 без цены) — A/B-пара «Красные против Центра ИИ» на ОДНОЙ фикстуре,
   одном профиле, одном снапшоте.

## Порядок срезов (каждый — зелёный коммит; порядок обязателен, потому что К3 читает К4.1)
- **С0 Сервер** (К4.1–4.4): превью с источником + добор с источником + контекст выбора + одна константа. Гарды: `ResolutionContract.spec` (`checkSeam`
  расширить: у действия есть `ActionPreview`), `PartyEffects.spec` (+ источник ревила, + `choiceContext`), `actionPromptCoverage.spec`, новый спек превью
  политического источника. ≈ 12 %.
- **С1 Источник + эксплорер** (К1, К2): тип источника, `politicalSources`, политические группы в сетке, фокус/фасеты/зона/X/детали, удаление полосы,
  «Информация › ДЕЙСТВИЯ» с источниками Парламента. ≈ 25 %.
- **С2 Красные в общем композере** (К3 — ПЕРВЫМИ, это пример владельца): плитка → композер (герой-плашка, коммит) → клейм → добор в `--draw`-зоне →
  шаг «рука» СБРОС КАРТ → волна выплаты → заключение. A/B-пробник § 9.П3 ЗЕЛЁНЫЙ до перехода к С3. ≈ 20 %.
- **С3 Учёные · Индустриалисты (`and`) · Союз** в общем композере. ≈ 10 %.
- **С4 Законы** RX24 · RX26 · RX28 · RX36 · RX37 в общем композере (шаги по `resolutionActionPrompt.stage` и форме промпта). ≈ 15 %.
- **С5 Удаление**: `ConsolePartyActionComposer.vue`, `partyFlow`, `openWith` → общий `openWith(source)`, `submit-party`, `party-owed`, `partyResult`,
  `.con-pact`, `.con-pfx`, `partyActionKey.ts` как `CardName`, мёртвые ключи локали; гард § 9.П0 взведён. ≈ 5 %.
- **С6 Сцена** (К5): шаг «ВАШИ ЭФФЕКТЫ» = хост; блок обзора на `politicalSources`. ≈ 8 %.
- **С7 Доки + реестр + журнал** (§ 12). ≈ 5 %.

## 1–7. Что именно делать в каждом срезе — см. К1–К6; ниже только то, что легко потерять
- Композер: `entry` теряет `required: CardName`-природу — проверить ВСЕ читатели `entry.cardName` (`getCard`, `ConsoleCardFaceLite`, `actionCommitRailKey(card)`,
  `claimWorkspaceOutcome(…, cardName)`, `revealSignal`, `stagedReturn`, `rememberLawPlay`) и перевести на `sourceKey`/`source`; где нужен `CardModel` — у
  политического источника его нет, читатель обязан ответить «ничего», а не упасть.
- ACTION COMMIT для политического источника: `resolveActionCommitAnchors` получает wrap героя (плашка) и `actionNode` = узел действия из
  `actionRenderData` (у партии ОДИН узел действия — он и есть «выбранный вариант»); иконка результата — по URL спрайта, как у карты; у Trade
  Industries/Live Experiments цена с рельса УХОДИТ ПЕРВОЙ в печатную цену (PL-099/PL-104 уже сделано для закона — не потерять при переезде).
- Дверь сброса: сегодня `partyDiscardStepOwed` (`ConsoleShell.vue`) требует `partyFlow`; после — `followUpStepOwed` узнаёт маркер `partyActionPrompt.stage === 'discard'`
  как шаг, ПРИНАДЛЕЖАЩИЙ `card-actions`, пока стоит клейм/фрейм этого источника (структурно, по `workspaceOutcomeState.sourceKey`, не по заголовку);
  перезагрузка посреди сброса восстанавливает ТУ ЖЕ сцену (сервер пересобирает промпт — `rebuildPendingPrompts`).
- Хвосты крошки: `FOLLOW_UP_STEP_STAGES` получает «СБРОС КАРТ» для маркера сброса партии; «ДОБОР КАРТ» — как у карты; стадии законов — как в
  `RESOLUTION_STEP_STAGES` (ВЫБОР · ПРОДАЖА · ДОБОР КАРТ · ОПЛАТА · КАРТА · РОЗЫГРЫШ) — только родитель крошки теперь общий.
- `parliamentSourceStatus` (лестница «использовано / недоступно / не твой ход») сводится к общей лестнице карточной плитки с причиной сервера;
  «N из M в этом поколении» — чип плиты (`sourceUsesText`) остаётся.
- Эксплорер: `packEffectRows` не меняется (группа политического источника — обычная группа, `wide` по числу плиток); `effectFamilyCoverage.spec`
  (корпус) получает политические сигнатуры; `effectsZoneCounts` и `dossierEffectFamilies` принимают расширенный список.
- Глоссарный гард `tests/console/parliamentGlossary.spec.ts:304-317` читает `ConsolePartyEffectsStrip.vue` ПО ПУТИ и требует `title: partyNameKey(party)` —
  перенацелить на новый источник имени (группа эксплорера) в ТОМ ЖЕ коммите, что удаляет файл.
- `console-info-parliament.spec.ts:96-98` запрещает «Эффект партии» / «Эффекты партий» / «Действие резолюции» в разделе Парламента Информации («их
  место — зона „Эффекты“») — наше направление; проверить, что кикеры бейджа живут в эксплорере/«Действиях», а не в разделе Парламента.

## 8. Тесты и регрессия
1. Юниты переписать/перенацелить (в том же диффе, что ломает хук — инвариант 14): `ConsolePartyActionComposer{Bill,Play,Repeat,Resource}.spec` →
   спеки общего композера (`consoleActionComposer.spec` + новые кейсы: `and`-строки, герой-плашка, шаг руки, политическое превью, законные стадии);
   `ConsolePartyEffectsStrip.spec` и `partyEffectThreshold.spec:227-245`, `MetalResearchReadings.spec:140-145` → `effectsExplorerModel.spec` (политические
   группы: порядок, семейство, мета доступа, счётчики) + спек «политические источники»; `composerCursorRule.spec` (три композера → два);
   `consoleCardActions.spec`, `consoleWorkspaceOutcome.spec` (клейм по ключу источника), `consoleParliamentModel.spec`, `ConsoleParliamentEffects.spec`,
   `parliamentEffectsStep.spec` (хост), `partyAlliance.spec`, `armedEffects.spec`, `effectFamilyCoverage.spec`, `parliamentGlossary.spec`, `e2eLiveness.spec`.
2. Сервер: `PartyEffects.spec` (+ источник ревила `{type:'party'}` явный, + `choiceContext`, + превью), `ResolutionContract.spec` (`checkSeam`),
   `OpenIpTrade/LiveExperiments/ManufacturingRun/RdFunding/TradeIndustries.spec` (превью с источником), `ParliamentModel.spec`, `actionPromptCoverage.spec`,
   новый `ActionPreviewPolitical.spec`.
3. e2e перенацелить (хуки `.con-pact__*`, `[data-pact-*]`, `.con-pfx*` → хуки общего композера/эксплорера; «мёртвый хук в отрицательной проверке» запрещён):
   `console-parliament-actions` (Красные `:415-450`: `.con-pact__revealzone .con-reveal` → `.con-composer__revealzone--draw .con-reveal`, `.con-pact__handzone .con-hand--discard` →
   слой `action-hand` композера, `[data-pact-result]` → волна/рельс), `console-parliament-v2:1133-1147`, `-openip`, `-tradeind`, `-rdfunding`, `-live` (`[data-pact-play-*]`,
   `[data-pact-bill]`, `[data-pact-landing]`), `-manufacturing`, `-metal`, `console-composer-preselect` (`[data-pact=…]`), `console-parliament:319-326` и
   `-gallery:453-488` (полоса → группы в сетке; геометрию «полоса над эксплорером» заменить на «группа в фокус-рядах»), `-craze/-forestry/-diverted/-heat/-metal/-unmi-veto/-urban`
   (`.con-pfx__item--resolution` + «Принятая резолюция» + `.con-pfx__title` → группа закона в эксплорере, кикер «ЭФФЕКТ, ПОКА ПРИНЯТА»), драйверы
   `parliamentDrive.ts` (`.con-pact__source/main`), `transferWitness.ts` (`.con-pact__hero` → герой композера). `console-effects-explorer` и `console-deck-draw` —
   без изменений (регрессия каркаса).
4. `npm run build:test`, `npm run lint`, `make:json`, `make:css`; юниты — на тихой машине; `npm run e2e:affected` + перечисленные — на Steam Machine
   (функциональные по умолчанию; § 9.П3 и раскадровки — `--exclusive --workers=1`).

## 9. Пробники (каждый утверждает ВИДИМОСТЬ и ГЕОМЕТРИЮ, не факт события)
- **П0 Гард «одного фреймворка»** (юнит, server runner): в `src/` нет `con-pact`, `con-pfx`, `ConsolePartyActionComposer`, `partyFlow`, `submit-party`, `party-owed`,
  `partyTileKey(...) as CardName`; `src/client/components/console/parliament/` не содержит `*Composer*.vue`; падает СПИСКОМ нарушителей (инвариант 11).
- **П1 Фокус доходит**: Информация › ЭФФЕКТЫ на фикстуре с 2 партийными эффектами + законом — d-pad обходит ВСЕ плитки, включая политические (счёт
  `[data-effect-key]` = плитки в `flatKeys`), на политической плитке A открывает слой деталей с плашкой/лицом героем, X — осмотр, B — на один уровень.
- **П2 Зона честна**: число в сводке «ЭФФЕКТЫ» = `total` эксплорера, фасеты считают политические семейства; без Парламента — как раньше.
- **П3 A/B добора** (главный): на `parliament-actions` (+ Центр ИИ) прогнать оба добора на tv4k и standard-1080; ректы `.con-composer__revealzone--draw .con-reveal .con-cards__slot`
  (w · h · top · left) у Красных и у Центра ИИ равны ±1 px; подготовленные слоты такта = ректы посадки (±1 px); ни одного `.con-reveal:not(.con-reveal--embedded)`;
  кадр «до» (HEAD) рядом в раскадровке.
- **П4 Крошка**: `ДЕЙСТВИЯ КАРТ › КРАСНЫЕ › НАСТРОЙКА → ДОБОР КАРТ → СБРОС КАРТ`; корень и имя — те же vnode всю жизнь потока; хвост только растёт; шаг не
  титулует себя (нет своего кикера внутри зоны).
- **П5 Выплата**: токены рождаются на печатной иконке плашки и гаснут на ряду M€ (свидетель переноса `rail:megacredits`), ряд тикает на касании на сумму
  ответа сервера; случай «меток нет» — чип-пропуск у иконки с причиной; `.con-pact__result` отсутствует.
- **П6 Перезагрузка посреди сброса**: та же сцена (композер, шаг руки, крошка), ничего не добирается второй раз, сброс отвечается, выплата играет.
- **П7 `and`-строки Индустриалистов**: две строки-палитры, курсор после ответа САМ на следующую, затем на CTA (CC); Учёные — единственная цель
  посеяна и помечена (T14); Союз — колонии шагом.
- **П8 Законы**: RX24 (ВЫБОР → ПРОДАЖА → ДОБОР КАРТ), RX26 (повтор), RX28 (ОПЛАТА → флот волной), RX36 (КАРТА → РОЗЫГРЫШ, посадка в сцене), RX37 (ресурс на
  карту) — существующие e2e зелёные на общем композере.
- **П9 Сцена**: шаг «ВАШИ ЭФФЕКТЫ» хостит эксплорер; бюджет обзора (`console-parliament-info-budget`) и глоссарный гард — без регрессии; `console-parliament-stability`,
  `-chassis-parity` зелёные.

## 10. Визуальная приёмка = РАСКАДРОВКА (`screenshots/one-framework/`; **TV первым**; fhd; Deck — только сетка эффектов и композер Красных)
1. Информация › ЭФФЕКТЫ: политические группы в сетке рядом с карточными (фокус на партийной плитке) · слой деталей с плашкой-героем.
2. «ДЕЙСТВИЯ КАРТ»: обзор с плитками партий среди синих карт (бейдж читается, ничего не «чужое») · композер Красных: НАСТРОЙКА → ДОБОР КАРТ
   **рядом с тем же кадром Центра ИИ** → СБРОС КАРТ → кадр волны выплаты → поле после заключения.
3. Индустриалисты (`and`) · Учёные (цель посеяна) · Open IP Trade · Live Experiments (слот КАРТА).
4. Шаг «ПАРЛАМЕНТ › ВАШИ ЭФФЕКТЫ» как хост.
С дивана: «это то же самое действие, что у синей карты, — только с печатью партии?» и «я вижу, что эффект партии — просто ещё один эффект в моём
списке, и могу до него дойти?»

## 11. Доки и реестр
1. Реестр `docs/claude/gameplay-polish-ledger.md`: новый раздел (букву и номера объявлять В МОМЕНТ записи по текущему footer; на выдаче последний —
   CI, PL-984) — «ОДИН ФРЕЙМВОРК: ПАРЛАМЕНТ НА КАРКАСЕ ДЕЙСТВИЙ И ЭФФЕКТОВ»; туда же PL-784 (источник импульса мал) и PL-785 (пустые полосы «ДЛЯ ВАС»),
   если закрылись переездом.
2. Доки: `docs/TURMOIL_REDUX_PARLIAMENT_V2.md` § 3–4 и `docs/TURMOIL_REDUX_PARLIAMENT_UI_REWORK.md` § 3/§ 5 — пометить «ЗАМЕНЕНО: один композер,
   см. …» с отсылкой на новую `docs/claude/console/parliament-one-framework.md` (контракт К1–К6 как сдан, карта удалённого → общего, гочи);
   `docs/TURMOIL_REDUX_OPEN_IP_TRADE.md` § 2 (строка «тот же компонент `ConsolePartyActionComposer`» → общий композер), `TURMOIL_REDUX_LIVE_EXPERIMENTS.md` § 3,
   `TURMOIL_REDUX_MANUFACTURING_RUN.md` § 4.1; `docs/claude/console/effects-explorer.md` (§ Reuse contract: политические источники, третий хост — сцена;
   § Guards); `docs/claude/console/workspace-band.md` § EMBEDDED OUTCOMES (клейм по ключу источника); `docs/CONSOLE_BLUE_ACTION_PARITY.md` (запись
   итерации «политические источники на том же каркасе»); `docs/claude/parliament-glossary.md` (новые кикеры бейджа, если вводятся; хвост «СБРОС КАРТ»
   закреплён); `.claude/rules/console-ui.md` — ОДНА строка-закон: «Эффект/действие любого источника рисуется каркасом эксплорера/„Действий карт“;
   партия и закон — бейдж, никогда второй компонент»; `CLAUDE.md` — не трогать (кроме одной фразы в абзаце про Парламент, если владелец скажет).
3. Журнал: `docs/claude/parliament-v7-progress.md` — раздел «Один фреймворк (2026-10-24 →)», срез за срезом: что удалено, что стало общим, где
   упёрлись.

## 12. Режим работы
1. Читать до кода; `SendMessage` соседям; С0 → С1 → С2 (стоп: П3 зелёный, кадры A/B владельцу в отчёте) → С3 → С4 → С5 → С6 → С7. Коммит по ханкам,
   каждый зелёный по юнитам, линту, `build:test`; спек отключается только с пометкой среза возврата.
2. Отчёт: первой строкой — кадр A/B добора «Красные | Центр ИИ» (tv4k); затем список удалённого (файлы, строки, селекторы, ключи), список ставшего
   общим, результат П0–П9, решения Р1–Р9 с тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (Р1, Р2, Р7 — рекомендация первой), гэпы честно
   (в т. ч. `ConsoleArmedEffectsSection` как следующий кандидат и шов статистики Р8).
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 13. Нельзя
- Чинить «Красных» CSS-ом внутри `.con-pact` (латка `--resolution` показала цену: второе семейство требует вторых починок) — зона ОДНА, композер ОДИН;
  ветвить композер по партии (`kind === 'reds'`) — только по форме промпта; поддельный `CardName` у источника; второй клейм/второй `outcomeFlow`;
  `v-if`-свап поверхностей; детекция по заголовку (инвариант 1); таймеры как такты (инвариант 6); `megacredits − mcBefore` и любой пересчёт правил на
  клиенте (инвариант 7); скрывать недоступное вместо «выключено с причиной»; автовыбор цели без показа; свой кикер внутри встроенной зоны; свой
  фон/градиент/шрифт у политической плитки; новая проза на обзоре Парламента; литерал кнопки вне `glyphSets.ts`; `title`.
- Оставлять `ConsolePartyActionComposer.vue` «на всякий случай» (Р7); удалять e2e-проверку вместо её перенацеливания; мёртвый хук в отрицательной
  проверке; трогать `ConsoleArmedEffectsSection`, бота, `TradeWithUnity`, категорию событий, `pendingActions`.
- Файлы соседей до их коммита; `assets/text/lore_texts.json`; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте;
  `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`; перегоны старых сюит без причины; красные коммиты.
