# Добавление КАРТЫ ПРОЕКТА Turmoil Redux (TR01–TR70) — чеклист автора

Короткая форма для следующих 69 карт. Образец набора: **TR09 EVA Mechs** («Мехи ВКД»,
`src/server/cards/turmoilRedux/EvaMechs.ts`, документ `docs/TURMOIL_REDUX_EVA_MECHS.md`). Резолюции
набора идут ДРУГИМ путём (`docs/claude/parliament-resolution-checklist.md`) — здесь только карты проектов.
Журнал набора: `docs/claude/turmoil-redux-cards-progress.md`. Общие правила карт — `.claude/rules/game-logic.md`;
процедура скоупа — `docs/claude/expansion-adaptation-checklist.md` (модуль `turmoilRedux` УЖЕ в скоупе, все
22 SCOPE-точки расширены 2026-09-29 — второй раз это делать не нужно).

## 0. До кода

- [ ] Скан карты (`…/TM Turmoil Redux/Projects/Card_-_TR##.png`) и арт (`…/Mars Arts/TR##.png`, 1536×1024).
- [ ] **Чтение скана:** кружки в ПРАВОМ верхнем углу — МЕТКИ; кружки в оранжевой плашке «MIN»/«MAX» рядом с
  ценой — ТРЕБОВАНИЕ, не метки (сверить с текстом «Requires …»); планета под цифрой ПО — фон бейджа ПО.
  Фиолетовый шестиугольник со стрелкой ВНИЗУ СЛЕВА — значок Turmoil («нужен политический движок»): для карты
  Redux-манифеста это сам модуль (ворота колоды), `compatibility: 'turmoil'` НЕ объявляется (в форке этот маркер =
  «апстрим-карта, адаптированная к движку» и требует `politics: 'redux'`); ▲ у арта — Колонии
  (`compatibility: 'colonies'`).
- [ ] Номер `TR##` — двузначный, ноль впереди, единственный в наборе (гард манифеста падает с именем).
- [ ] Шесть карт-ЗАМЕН (Aerial Lenses, Banned Delegate, Political Alliance, Recruitment, Sponsored Mohole,
  Vote of No Confidence) — ЗАРЕЗЕРВИРОВАНЫ: у них другой контракт (замена базовой карты Turmoil), гард
  манифеста не пускает их в набор как обычные карты, пока контракт не написан.
- [ ] Новая механика? (новый ресурс карт, новая платёжная единица, новый вид требования) — сначала её
  инфраструктура сквозным контрактом (образец меха: `docs/TURMOIL_REDUX_EVA_MECHS.md` §2–§3), потом карта.

## 1. Пять точек касания (как у любой карты)

1. Класс `src/server/cards/turmoilRedux/<Name>.ts` — `Card`, или **`ActionCard`** для синей карты с действием.
   Декларативный `behavior`/`action` — превью, причины, прогноз, блок эффектов и статистика приходят даром.
   Бесподобный `bespokePlay`/`canAct` = co-located хуки (`cardPlayPreview`, `actionPreview`,
   `actionUnavailableReason`, `unplayableReason`) в ТОМ ЖЕ файле — центральных таблиц не заводить.
2. `CardName` — секция `// Turmoil Redux` в `src/common/cards/CardName.ts`.
3. Манифест `TurmoilReduxCardManifest.ts` — `[CardName.X]: {Factory: X}` (`compatibility`, если карта
   требует второй модуль).
4. `metadata.renderData` — DSL `CardRenderer.builder`, ряд в ряд по скану; `cardNumber: 'TR##'`.
   Ресурс карт — `b.resource(CardResource.X)`, отдельных билдеров (`b.mech()`) не заводить.
   Эффект-«платёжная единица» ОБЯЗАН нести `.equals().megacredits(N)` (иначе слой объяснимости молчит).
5. Спек `tests/cards/turmoilRedux/<Name>.spec.ts` — метаданные, требование (+ причина), действие
   (+ причина, + превью `declarative`), каждое правило чтения скана, save/load.

## 2. Специфика набора

- **Арт**: `node scripts/import-card-art.mjs "<путь>/TR##.png" TR##` → `npm run make:cards` (манифест арта
  + thumb). Нестандартный размер — только с `--force`.
- **Лор**: EN в `assets/text/lore_texts.json` под ключом `TR##`; RU в `src/locales/ru/lore_texts.json`
  под ключом = английский текст. Паритет — `tests/client/components/card/cardLore.spec.ts` (скоуп
  `turmoilRedux`; красный = имя карты). Цитаты на скане НЕТ → лор ПРИДУМАН под арт и механику и лежит в реестре
  `docs/claude/turmoil-redux-invented-lore.md` (TR14, TR25, TR39, TR44, TR47, TR49, TR52, замена Political Alliance):
  взять оттуда, отметить статус, в шапке карты сказать, что запись придумана. Исключений из гардов лора нет.
- **RU-имя и тексты графики** — `src/locales/ru/turmoil_redux_cards.json`: имя карты, ключи с префиксом
  `Action: …` / `Effect: …` (клиент срезает префикс). Голос — как у соседей в `cards.json`
  («потратьте 1 энергию, чтобы…»).
- **`card_info.json`** — все `missingTranslations` из аудита `src/genfiles/cardInfoAudit.json` + курируемые
  `effect-short` / `action-short` (капшен > 52 символов → `infoText` в карте + RU ключ). ⚠️ Бюджет мерить и по
  RU-переводу из `turmoil_redux_cards.json` РУКАМИ: гарды `effectCaption` / `actionCaption` читают RU только из
  `cards.json` / `card_info.json` / `ui.json` и модульный словарь не видят (TR05: EN-правило 44, RU ≈ 75 → `action-short`).
- Перед КАЖДЫМ ключом: `grep -rn '"<ключ>"' src/locales/*/*.json` — дубль роняет `make:json`.
- **Тестовый режим**: модуль уже в `GUARANTEED_MODULES` (через `PREMIUM_EXPANSIONS`) — карту можно
  гарантировать в первую руку без правок (`docs/DEV_GUARANTEED_CARDS.md`).

## 3. Гарды, которые печатают ворклист (прогнать ВСЕ после карты)

Серверный раннер: `tests/models/{actionBranchAvailability, actionPreviewCoverage, actionPreviewReasonCoverage,
actionPromptCoverage, actionReasonCoverage, cardPlayPreviewCoverage, cardReasonConsistency,
consolePlayPreviewCoverage, corpFirstActionPreview, effectForecastCoverage, effectForecastParity,
variableAmountPreviewGuard, promptMarkerGuard}.spec.ts`, `tests/notifications/crossPlayerCoverageGuard.spec.ts`,
`tests/cards/{cardInformation, requirementProse, effectCaption, actionCaption}.spec.ts`,
`tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts`.
Клиентский раннер (mochapack): `tests/client/components/{card/cardLore, premiumCard/premiumCardViewModel,
premiumCard/premiumCardIcons, effects/effectExtraction, actions/actionExtraction, effects/effectSummaryCoverage,
effects/trackerCoverageGuard, effects/effectFamilyCoverage}.spec.ts`.
Плюс `npm run make:cards` — аудит: 0 `needsCuration` / 0 `seededRunOn` / 0 `missingTranslations`.

## 4. Что карта получает бесплатно / что требует хука

| Бесплатно (декларативная карта) | Требует руки |
| --- | --- |
| превью розыгрыша и действия, причины недоступности, прогноз эффектов, блок эффектов и «Spent as payment», структурный текст (`metadata.information`), капшены из `behavior`, сериализация `resourceCount`, коммит действия в консоли (полёт ресурса в капсулу карты по узлу `res-<ресурс>`), бейдж «N M€ · <контекст>» в спутнике ДОП. РЕСУРСЫ (если ресурс — платёжная единица) | бесподобный `play`/`action` → хуки превью/причин в файле карты; ТРИГГЕР (`onCardPlayed` / `onCardPlayedByAnyPlayer` / `onResourceAdded` / `onProductionGain` / `onTilePlaced`) → близнец прогноза (`cardPlayedForecast` / `grantForecast` / `tilePlacedForecast`) в файле карты тем же предикатом, что живой хук (образец TR05: `forecast.exact` + `actionPreviews.cardGain`; гарды `effectForecastCoverage` / `effectForecastParity`; реакция на ресурс, который не кладёт ни один триггер пула паритета, — гард назовёт карту «не достигнута»: в `TRIGGERS` карту без промпта, кладущую этот ресурс (TR18: Vector Computations для data)); НОВЫЙ ресурс карт → `CardResource` + спрайт `assets/resources/<name>.png` + `@card_resource_types` (cards_v2.less) + `@resource_types` (resources.less) + `cardResources.ts` + `CardListModel.ts` + множественное в `ConsoleExtrasExplorer.vue` + `"<Name>"`/`"<Names>"` в `console.json`/`ui.json`; НОВАЯ платёжная единица → тропа `mechs` (`docs/TURMOIL_REDUX_EVA_MECHS.md` §3) |
| карта-ПУЛ ресурса для оплаты, когда такой ресурс уже платит с ДРУГОЙ карты (TR17 Construction Mechs — второй пул мехов) — карта сама по себе декларативна; спрайт, иглы коммита, множественное — от ресурса | НОВАЯ единица по §3 TR09 (одна единица = одна карта; обобщать существующую до нескольких карт — нельзя: `pay()` теряет однозначность) + строка `PAY_UNIT_SOURCE_LABELS` (две дорожки одного ресурса на одной панели называют карты) + контекст рельса; гард полноты единиц в `paymentPlan.spec` печатает пропущенную точку (`docs/TURMOIL_REDUX_EVA_MECHS.md` §6) |
| требование СУЩЕСТВУЮЩЕГО вида (метки, параметры, «делегаты на резолюциях», «метки одного вида») — причина с «сейчас», чип, строка правил, счётчик руки | НОВЫЙ вид требования → тропа `e68e8db190` (TR02; повтор — TR01 `3f70200dec`), 8 точек: `RequirementType`, поле дескриптора + `requirementType()`, `CardRequirements.compileOne`, класс `<Kind>Requirement`, `Card.populateCount`, строка `buildCardInformation.requirementBlock`, причина + `FULLY_RESTATED_REQUIREMENTS`, клиент `REQUIREMENT_RENDER` + `COUNT_MESSAGE_LABELS`. Причина — `type: 'count'`, НЕ `'tag'`: `reasonParams` при заданном `tag` подменяет число именем метки. Счёт меток — только через `tagRequirementScore` / `Tags.tagTypesInPlay` |
| карта ДВИГАЕТ МАРКЕР Карьеры на N шагов — `ChairmanSeat.walkAgenda(player, parliament, N, {reason: 'card', card})` СИНХРОННО в `bespokePlay` (без `defer`: ответ несёт запись) + `actionPreviews.agendaWalkModel / agendaWalkEffects / agendaWalkStep` в `cardPlayPreview`: чипы трека / РТ / влияния, SHOW-шаг `agendaWalk`, поза ходьбы в зоне руки, очередь бонусов, событие `agenda-advanced` (`docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md`, TR04; шаг КАРТЫ посреди ходьбы и ответ стола на РТ шага после касания — TR37, §3 документа) | вторая функция продвижения / второй директор глайда / второй слот бонуса (запрещено); при A — `agendaWalkRail` композера (реакции прогноза + известные ходы рельса) обещанию ходьбы, иначе ответ Зелёных тикнет с посадкой (PL-002) |
| карта СТАВИТ НЕЙТРАЛЬНЫХ делегатов на резолюции названных партий / в их области БЕЗ выбора — `rallyPlan(parliament, parties, {perResolution, perArea})` (чистый план по печатному порядку, запас по ходу, победитель на копии) + `applyRally(player, parliament, plan, {kind: 'card', card})` СИНХРОННО в `bespokePlay` (запись `lastRally`, событие `neutral-delegates-placed`, поддержка через `payPopularSupport`, названные пропуски) + `actionPreviews.rallyEffects / rallyStep` в `cardPlayPreview`: SHOW-шаг `neutralRally`, поза `rally` в зоне руки (кубы → пересчёт → монета), холды, соперник, нотификация с CTA (`docs/TURMOIL_REDUX_NATIONALIST_MOVEMENT.md`, TR31) | нейтрал на ВЫБРАННУЮ резолюцию (дверь, форма TR03) / на принятую карту / пересчёт с другим основанием; standalone-ярус не играет запись (§8 документа) |
| требование по ВЛИЯНИЮ (`{influence: N}`, с `max` — «не больше N»): вид `INFLUENCE` ЕСТЬ (тропа TR02, TR04) — причина с «сейчас», компактный счётчик «Влияние 2/≤1», бейдж трека | — |
| ПО ЗА МЕТКИ (`victoryPoints: {tag, per}`, TR20): композер розыгрыша читает `ActionPreview.cardVictoryPoints` (сервер, `cardVictoryPointsAtPlay` — тот же `CardVictoryPointsDetail`, что строка обозревателя счёта) и пишет «+N сейчас · [метка] 7 / 3 · ещё 2 до следующего ПО» вместо «по условию»; ноль — ответ, строка не скрывается; гард паритета `tests/models/cardVictoryPointsAtPlay.spec.ts` берёт карту в корпус сам. Ничего в файле карты. Карта без графики эффекта: `renderData` нет, строка ПО структурного текста — `infoText: [{kind: 'victory-points', …}]`, триаж в `NO_MECHANICS_ACCEPTED`. При `per: 1` (TR33) композер пишет «+N сейчас · [метка] N × 1 ПО» без «ещё …»; формула обозревателя называет метку («ваши метки Марса» — `common/cards/tagNames.ts`, `tagCountKey`; новая метка → строка там + RU в `console.json`, гард `tests/console/tagVocabulary.spec.ts`); счёт ПО — RAW (дикая метка, дикая Учёных, R&D Funding, события — не в счёте: закрепить контрастом с `default` в спеке карты) | ПО за ресурсы / города / соседство / колонии / `special` остаются «по условию» (розыгрыш ещё может сдвинуть число) — расширять проекцию только с доказательством, что розыгрыш её не меняет |
| карта СТАВИТ ДЕЛЕГАТА на резолюцию (± нейтральные в Народную поддержку её партии) — общий шаг `PlaceDelegatesOnResolution(player, n, {kind: 'card', card}, {support?})` из `bespokePlay` + `actionPreviews.delegateGrantStep(card, step.previewSelectParty())` и `delegateFromReserve` в `cardPlayPreview`: staged-дверь «Выбрать резолюцию», режим голосования в зоне руки, блок «НАРОДНАЯ ПОДДЕРЖКА», посадка куба и нейтральных, адресованный `party`-хвост, три исхода коммита, события `delegates-placed` / `popular-support-gained`, названный пропуск (`docs/TURMOIL_REDUX_POLITICAL_DONATION.md`, TR03) | второй `SelectParty` / свой `placeVote` в файле карты (запрещено); карта с `count > 1` → сперва провести счёт в staged-проекцию (`viewer.vote.projections` считаны для ОДНОГО делегата — §8 документа TR03); выбор числа поддержки игроком (решение владельца: «сколько влезет») |
| ДЕЙСТВИЕ карты СТАВИТ ДЕЛЕГАТА за ресурс этой карты (TR15 / TR24 «перепись» — data, бесплатный A; TR34 «Мехи армии Марса» — мех, ПЛАТНЫЙ A за энергию; TR35 — истребитель за титан, сдана 2026-10-09 одной декларацией): ОДИН модуль `censusAction.ts` со СПЕКОЙ `CensusSpec {resource, add: {amount, price?: {energy|titanium}}, votePrice, addTitle, voteTitle, shortReason, rows}` — карта объявляет спеку (TR15 / TR24 — общая `DATA_CENSUS` модуля, TR34 — своя в файле карты) и зовёт `censusCanAct` / `censusUnavailableReason` / `censusAction` / `censusActionPreview` / `censusActionRows(b, spec)`: `PlaceDelegatesOnResolution(player, 1, {kind: 'card', card}, {price: {card, count: votePrice}})` из `action` + `delegateGrantStep` и `cardCost` / `delegateFromReserve` в `actionPreview`; одна причина отказа ветки по порядку («N of M <ресурс>» → область → резерв), A с ценой — автопричина стока; оба мертвы — правило TR66 (нет ресурса → цена A; есть — что закрыло голосование); цена B списывается В ответе шага (не раньше) своей строкой журнала «spent N [ресурс] from X for a delegate»; staged-дверь действия «Выбрать резолюцию» → Парламент в зоне композера, A «Подтвердить», квитанция-чип `{votePrice, ресурс}`, ACTION COMMIT на герое, капсула держит СЧЁТЧИК (`stagedVoteCapsuleHeld`) до отрыва жетона цены (PL-100; жетон рождается после ПОСАДКИ импульса — защёлка `afterCommitImpulse`, PL-103), три исхода, уход одной поверхностью (`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` §4–§5). Ключи i18n — по ресурсу (RU склоняет), не шаблон с подстановкой имени; ряд действия длиннее 52 знаков — свой `action-short` с `tokens` на КАЖДЫЙ такой ряд (TR35: A 54 и B 61) | свой `SelectParty` / `placeVote` / ручное снятие ресурса до гранта (запрещено — «заплатил и не поставил»); копия модуля под новый ресурс (запрещено — спека); `canAct(): true` при платном A; цена не ресурсом этой карты → новая форма `price`, не второй шаг; цена A не энергией и не титаном → расширить `CensusStockPrice` и его карту причин |
| требование ПАРТИИ (`{party: PartyName.X}`): вид `PARTY` ЕСТЬ (TR15) — причина называет партию и обе дороги («правит» · «N из 2 ваших делегатов на её резолюции» / «её резолюции нет на голосовании») через фасад `politics.partyRequirementStanding`, эмблема партии в плашке MIN (`requirementPartyEmblem` — одна таблица), компакт руки «[эмблема] 1/2», строка правил лица; «есть ли у карты требование партии» — только `hasPartyRequirement` (TR13) | — (доступ, выданный картой, требованием не считается — так считает `Parliament.access()`; второго подсчёта не писать) |
| карта-ПРИЧАЛ («when you trade, you can send the trade fleet to this card to …» — TR06 / TR26 / TR27): `fleetDock: FleetDock` в файле карты (`rewardBlockedReason?` · `previewEffects` · `previewFollowUps?` · `receive`) + `data: {dockedGeneration: -1}` — назначение торговли на пике всех дверей (маркер `fleetDocks`, ответ `{fleetDock}`), гейт торговли, превью `?dock=` с ответом стола на награду (`reactions` — «⚡ сработает» на стейдже до нажатия), событие `fleet-docked`, колонка «ПРИЧАЛЫ» (любое число причалов) и стейдж причала, полёт на ▲ лица, знак флота на лице (и в «Разыграно»), сцена причала ОДНОЙ фразой со слотом награды по КАТЕГОРИИ из данных сервера. **Причал с наградой-РАЗМЕЩЕНИЕМ** (TR06: `previewFollowUps` с нотой) — карта отвечает, уходит своим тактом, поле встаёт чистым. **Причал с ПЛОСКОЙ наградой** (TR26: без follow-up; чипы `trGain` / `stockGain` / `productionChange`) — жетон из печатного значка на рельс, счётчик тикает на касании, реакция стола следом, карта уходит с workspace: в файле карты только `previewEffects` + `receive`. **Причал с наградой НА КАРТУ** (TR27: два аэростата на карту Венеры) — `rewardTarget(player)` в файле карты СТРОИТ шаг цели (`new AddResourcesToCard(…)`, никогда не в очередь): одна конструкция читается превью (`cardTargetFollowUpOf` — lost · auto · pick, ПО кандидатов) и выплатой (шаг первым, `receive` за ним); даром — ряд «ЦЕЛЬ ТОРГОВОЙ НАГРАДЫ» на стейдже (утверждение при одном держателе, решение при нескольких), шаг цели колонии (`ConsoleTradeTargetStep`, сам причал — «ЭТА КАРТА»), хвост ОДНОГО POST, категория `card` (жетон с каждого печатного значка на карту-получатель, счётчик / «ДОП. РЕСУРСЫ» / ПО — на касании, остальное — `rail`), три исхода (принят / задан вживую / запаркован). Гард класса по манифесту `tests/colonies/FleetDockManifest.spec.ts` берёт новую карту сам (`docs/TURMOIL_REDUX_WATER_HAULING.md` §9–§10) | цель в `previewFollowUps` файла карты (две конструкции цели — гард манифеста упадёт); свой `SelectCard` / `AddResourcesToCard` в `receive`; награда, которая спрашивает НЕ «на какую карту» (игрок, вариант) → новый вид `rewardTarget` и своя ветка категории; свой `SelectColony` / проверка флота / штамп поколения в файле карты — запрещены |
| карта СНИМАЕТ НАРОДНУЮ ПОДДЕРЖКУ выбранной партии (TR12) — общий шаг `DiscardPopularSupport(player, cause, then?)` из `bespokePlay` (`then` — следующий печатный эффект, в том же ответе) + `actionPreviews.supportDiscardStep(card, step)` в `cardPlayPreview`: маркер `supportPrompt` на шесть областей, staged-дверь «Выбрать партию», режим Парламента `support`, адресованный `party`-хвост, событие `popular-support-discarded`, два такта на одной позе, названный пропуск при пустых областях (`docs/TURMOIL_REDUX_PARTY_SANCTIONS.md`); требование «председатель» — вид `CHAIRMAN` ЕСТЬ, причина названа | свой `SelectParty` / `discardPopularSupport` в файле карты (запрещено); «добавить поддержку выбранной партии» без резолюции → новый `source` у `supportPrompt` + строка `SUPPORT_STEP_STAGES`, не второй режим |
| карта ВЫБИРАЕТ ТРЕК КОЛОНИИ и ставит маркер на максимум — общий шаг `MaximizeColonyTrack(player, cause)` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: кандидаты/отказы/проекция `trackMoves` с сервера, staged-дверь «Выбрать колонию», сетка колоний шагом в зоне руки с проекцией «+N», стейдж `track`, адресованный `colony`-хвост, холд из диффа и ОДИН глайд (`stage` · `rail`), событие `colony-track-moved`, названный пропуск; максимум — только `trackTop(metadata)` (`docs/TURMOIL_REDUX_COLONY_SPONSORS.md`, TR07) | свой `SelectColony` / прямая запись `trackPosition` в файле карты (запрещено); сдвиг НЕ на максимум (на N шагов) → второй режим шага с той же проекцией `trackMoves`, не вторая функция; сдвиг ВНИЗ → отдельное решение (сегодня шаг только вверх) |
| карта ВСКРЫВАЕТ верхнюю карту колоды и проверяет её (TR13) — `drawOrThrow` → `events.recordCardReveal` → `actionReveals.recordReveal(…, check, destination)` ДО сброса + превью `reveal: {check, reward, keepsCard?, pool?}` в `actionPreview`: композер «ПРОВЕРКА» + состав, вердикт, на «ОК» карта летит в док / в сброс, ресурс запаса — на рельс (`docs/CONSOLE_BLUE_ACTION_PARITY.md` ит. 27); «требование партии» — только `hasPartyRequirement` | проверка НЕ метки и НЕ требования партии → новый `RevealCheckIcon` + глиф; карта, ушедшая не в руку и не в сброс → новый `RevealDestination` + ветка `runRevealHandoff`; «ищи до совпадения» — это `drawCard({include})`, другая семантика |
| карта ДОБИРАЕТ С ФИЛЬТРОМ — «вскрывайте, пока не найдёте N карт с меткой X / без меток X, Y» (TR32 Red Tech Convention; TR05, Acquired Space Agency, Aqueduct Systems — положительный) — `behavior: {drawCard: {count, tag?, type?, resource?, withoutTags?}}`, полностью декларативно. Даром: поиск движка (`DrawCards` → `Deck.drawByConditionOrThrow`, сброс сразу, перетасовка сброса конечна), исчерпание ключом журнала и `exhausted` в reveal, ОДИН описатель `DrawSearchModel` (`deferredActions/drawSearch.ts`) — хвост чипа композера «+N взять \| без меток …», строка «Далее», структурный текст лица (генератор печатает поиск сам), итог reveal «ВСКРЫТО · ПОЛУЧЕНО · СБРОШЕНО — правило», причина у каждой отсеянной карты в лотке (R3: `failedTags`, медальон лица помечен), счётчик колоды HUD держит вскрытые до сдачи (PL-088), сцена семейства (`docs/claude/console/card-draw-motion.md`) | фильтр НЕ по метке / типу / ресурсу (непрозрачный `include` — описателя нет, причина = проза карты; новый вид фильтра → поле `DrawSearchFilter` + клауза `drawSearchTerms` + ключ); «посмотри N, оставь K» — это `keep` / `pay` (`ChooseCards`, `ConsoleDeckPick`), другая поверхность; корпорация со стартовым фильтрованным добором — свой путь `corpStartingBlocks` |
| карта ставит ГОРОД, «ИГНОРИРУЯ ПРОЧИЕ ОГРАНИЧЕНИЯ РАЗМЕЩЕНИЯ» (TR16; TR19 — без соседства) — `cityIgnoringRestrictions(player, {adjacentToOwnCity?}, canAffordOptions?)` + `cityIgnoringRestrictionsReasoner` (`boards/ignoreRestrictionsCity.ts`): земельный набор движка (`getAvailableSpacesOnLand` — океан, Ноктис, лагерь кочевников, чужой Land Claim остаются закрытыми, незащищённая опасность — покрываема) без одного запрета «не рядом с городом»; один набор и одна причина клетки для `bespokePlay` и staged-превью (`placementPreview({staged: {spaces, placementType: 'city', reasoner}})`), причина `not-adjacent-to-your-city`; заголовок промпта называет снятое правило (досье печатает его строкой действия) | свой набор клеток в файле карты; снятие чего-либо, кроме запрета соседства городов; `Board.canPlaceTile` вместо земельного набора (пускает на чужой Land Claim, не пускает на опасность) |
| карта МЕНЯЕТ СОСТАВ ПЛИТОК КОЛОНИЙ — заменяет пустую плитку (TR10), добавляет (Aridor) или убирает: общий шаг `ReplaceColonyTile(player, cause, {build, canAffordOptions?})` из `bespokePlay` (или `ColoniesHandler.seatColonyTile` / `retireColonyTile` / `addColonyTile({cause})`) + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: маркер `rosterChange` (кто может уйти и почему нет, как войдёт каждая плитка резерва, встанет ли колония), четвёртая форма ответа `{colonyName, replaces, stagedFor}`, staged-дверь «Выбрать плитку», уровни стол → резерв → стейдж `roster`, церемония состава гейтом транспорта, LANDING в слот, событие `colony-roster-changed` и строка журнала, названные пропуски (`docs/COLONY_ROSTER_CEREMONY.md`, TR10); требование «поколение ≥ N» — вид `GENERATION` ЕСТЬ | свой `SelectColony` / запись `game.colonies` в файле карты (гард единственного писателя упадёт с именем файла); замена ДВУМЯ промптами (стол с дырой); «плитка из игры навсегда» → новое сериализуемое поле; постройка на входящую плитку НЕ игроком карты → новая опция шага |
| карта ПЕРЕМЕЩАЕТ ТАЙЛ ЛЮБОГО ВИДА на соседнюю клетку (TR14 «Переселение» — свой город; TR39 «Прорезание каньона» — любой океан) — ОДИН общий шаг `MoveTile(player, {kind: 'card', card}, RULE, {canAffordOptions?})` под правилом вида (`CITY_MOVE_RULE` / `OCEAN_MOVE_RULE` — `MoveCityTile` / `MoveOceanTile` в один конструктор) из `bespokePlay` + `placementPreview({…, staged: {…, placementType: '<вид>-move', move}})` в `cardPlayPreview` + `bespokeCanPlay` / `unplayableReason` по `movableCities` / `movableOceans`: ОДИН вопрос с ответом из двух клеток (`{spaceId, movedFrom}`), staged-коммит с двухуровневым выбором (источник → клетка, слова по семье `placementMove.moveFamily`), досье переезда (`tileMovePreview(kind)`), превью-гипотеза (`withHypotheticalMove` — вид по тайлу на `from`), сцена ОДНОГО прокси у себя и у соперника (запись `game.tileMoves`; куб — только у тайла с владельцем), строка журнала `tile-moved` (`logTileMove` по виду тайла) — всё общее (`docs/TURMOIL_REDUX_RE_SETTLEMENT.md` §2.2, §2.6) | **третий вид тайла** — свой набор в `boards/` в форме `boards/tileMove.ts` (`TileMoveOffer`: кто едет, куда, кто стоит и почему — своими источниками правил), своё правило `TileMoveRule` (вид превью `'<вид>-move'` в `PlacementType` / `BoardPlacementKind` / `getAvailableSpacesForType` / `deriveIllegalReason`, тексты титула / хвоста / причины / ярлыка), свой писатель в `Game` (образец `moveCityTile` / `moveOceanTile`: снять → `addTile(…, {moved})` → [свои выплаты] → запись), семья в `MOVE_FAMILIES` движка + свой `withXLifted`, слова семьи в `placementMove.ts` / `placementCommands.ts` / `placementDossier.ts` / `consolePlacementNextStep.ts`, пара в `verifyMove`; `Game.removeTile` / `addOcean` не трогать |
| карта кладёт РЕСУРС НА ВЫБРАННУЮ КАРТУ «за каждый город рядом с этим тайлом» — награда, которую РЕШАЕТ КЛЕТКА (TR21 «Дендрарий»): общий модуль `cards/adjacentCityPayout.ts` — `adjacentCityTarget(player, card, resource, legalCells, title)` в `bespokePlay` ДО тайла (шаг `SelectResourceTarget`, `Priority.PLAY_CARD_RESOURCE_CHOICE`, только когда платит хоть одна легальная клетка, единственный держатель всё равно спрашивается), `payPerAdjacentCity(player, card, space, resource, target)` в `.andThen` размещения, `adjacentCityPreviewSteps(step, warning)` в `cardPlayPreview`, `adjacentCityPayoutFacts(player, card, space, resource)` в хуке `placementPreview` (`ctx.placesTile`). Даром: счёт по ЯРУСАМ любых владельцев (`boards/cityStack.adjacentCityTiers` — одна функция и для досье, и для Торгового района), шаг цели в композере БЕЗ числа («+1 за каждый соседний город» — `resourceGainPrompt.amountBasis`), staged-коммит с целью до клетки, строка досье «За N соседних городов → [лицо] цель k → k+N» + «⚡ <реакция> +M» (`grantReactionFacts` — живые `grantForecast` стола), подсветка платящих городов тоном `reward`, названный пропуск без держателя, строка журнала с `basis` («за 3 соседних города»), запись `game.cardAdjacencyPayouts` и сцена «ГОРОДА ПЛАТЯТ» у себя и у соперника (`docs/TURMOIL_REDUX_ARBORETUM.md`) | другой X («за каждый океан / озеленение рядом») → новый `AdjacencyAmountBasis.per` + ключ единицы + своя функция счёта в `boards/` (с `spaces`!) + источник жетона в геометрии сцены (`cityDataPayoutBeat.stageGeometry` знает только города); раскидывание по НЕСКОЛЬКИМ картам — другой шаг (запрещено переиспользовать этот); стандартный ресурс (не карточный) → это не этот шаг, а `stock.add` с источником-клеткой |
| карта ставит ГОРОД НА СВОЮ КЛЕТКУ ВНЕ МАРСА, НАРИСОВАННУЮ ПОЛЕМ (TR27 «Станция Аврора» — «рядом с треком Венеры»; как Стратополис / Доун-Сити) — `behavior: {city: {space: SpaceName.X}}`: посадка авто-тайла над видимым полем, счёт городов, Мэр | своя КЛЕТКА: строка `expansionSpaceColonies.ts` (`expansion` — один модуль или НЕСКОЛЬКО: клетка есть только там, где карту можно сыграть) + id в `SpaceName` + `<board-space>` в `Board.vue` + отступ в `console.less` (keep-px, ПОСТРОЕНИЕМ от соседей — пересчитать и проверить место на трёх профилях, не доверять числу: шаг дуги TR27 лёг на маркер шкалы температуры) + запись в `specialCellInfo.ts`; гард `tests/console/offMarsCellPlacement.spec.ts` (нарисована ⇔ не hosted, плечо фланга); НЕ строка `HOSTED_SPACES` (`docs/TURMOIL_REDUX_WATER_HAULING.md` §10.5) |
| карта кладёт ТАЙЛ НА ПЛИТКУ КОЛОНИИ (TR22 «Нова-Сити») — общий шаг `PlaceCityOnColonyTile(player, card)` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview` + `bespokeCanPlay` / `unplayableReason` по `ColoniesHandler.cityOnColonyTileBlockedReason`: маркер `tileSite` (проекция сервера: клетка, цвет, «космические города сейчас → после», ПО карты), staged-дверь «Выбрать колонию», призрак города на каждой плитке, стейдж `city`, сцена посадки с коммитом в кадре контакта, место города в трёх хостах, строка журнала, тайл в прогнозе эффектов («⚡ Сработает» для Pets / Tharsis), проекция ПО «свои города с `where`» в композере и в счёте | своя КЛЕТКА: строка в `expansionSpaceColonies.ts` + id в `SpaceName` + `HOSTED_SPACES` (`common/boards/hostedSpaces.ts`) + запись в `specialCellInfo.ts`; писатель связи — ТОЛЬКО `ColoniesHandler.placeCityOnColonyTile` (гард единственного писателя); тайл НЕ города — свой арт прокси (`artClass`) и своя запись глифа; контракт — `docs/TURMOIL_REDUX_NOVA_CITY.md` §9 |
| карта (или CEO) платит «ВСЕ ВАШИ БОНУСЫ КОЛОНИЙ» (TR23 «Наука обитаемости»; Productive Outpost и Ивонн уже на слое) — три вызова в файле карты: `gainAllColonyBonuses(player, {via: this.name})` в действии / розыгрыше и `allColonyBonusesLedger` + `allColonyBonusesEffects` в превью (`singleBranch(…, {colonyBonuses})`). Даром: порядок выплаты очереди движка и его чтение (`payoutPhase`), счёт ПО КУБУ с ординатой «n из k», атрибуция `via` на доборе / цели / сбросе (сброс несёт источник-карту + `colonyRepeat`, НЕ `colonyBonus`), единственный держатель показан шагом, названный пропуск без держателя, реестр в композере действия (строка на плитку, слово шага, «× N» при двух кубах), сцена «реестр платит» (строки по очереди из своего значка, добор и сброс слоями в зоне workspace, такт чтения, уход на поле), заявка исхода по `via`, крошка «… › БОНУСЫ КОЛОНИЙ / ДОБОР КАРТ / СБРОС», восстановление из парка (`docs/TURMOIL_REDUX_HABITAT_SCIENCE.md`) | причины недоступности действия карты (`actionUnavailableReason` — «нет своих колоний» общий ключ есть); `times` — множитель строки (Ивонн); реестр в композере РОЗЫГРЫША не построен (носитель на превью есть) — карта с этим правилом ПРИ РОЗЫГРЫШЕ получает прежнюю сцену; бонус-выбор (платное вскрытие) и поздняя цель встают своим обычным экраном; свой порядок выплаты / свой цикл по колониям / свой `DiscardCards` в карте — запрещены |
| карта ОТВЕЧАЕТ НА ШАГ ШКАЛЫ, кто бы его ни сделал («каждый раз, когда Венера терраформирована на 1 шаг» — TR24 «Венерианская перепись»; Aphrodite на том же хуке) — в файле карты `onGlobalParameterRaised(cardOwner, raise)` (своя выплата за `raise.steps` + `recordScaleStepReward(owner, this, raise, gain)`) и `grantForecast` на `{kind: 'global'}`. Даром: ОДИН диспетчер `Game.globalParameterRaised` в позиции Aphrodite для трёх шкал (любой игрок, MarsBot, Солнечная фаза, мировой ход резолюции; понижение и ноль шагов — нет), атрибуция владельца (`effect-triggered` / «вы получили»), прогноз в ШАГАХ у каждого места («⚡ Сработает» в композере карты, поднимающей шкалу), запись кольца `scaleStepRewards` и сцена «ШАГ ШКАЛЫ ПЛАТИТ» (жетоны рождаются у маркера после его прибытия, тики на касаниях, член слива парка — крышка 8 % ждёт последнего касания) у себя и у соперника (`docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md`) | выплата не ресурсом карты и не стоком (производство, РТ) → новая форма `ScaleStepRewardGain` и её адрес в сцене; выплата С ВОПРОСОМ — не этот путь; реакция только на СВОЙ наградной подъём — старый `onGlobalParameterIncrease` (его прогноз — тот же `grantForecast`, проход шкалы спрашивает только поднимающего) |
| карта ОТВЕЧАЕТ НА ТАЙЛ ресурсом НА СЕБЯ, и условие решает КЛЕТКА («после того как вы разместили на Марсе город или особый тайл НЕ РЯДОМ С ОЗЕЛЕНЕНИЕМ ИЛИ ОКЕАНОМ — +2 data сюда», TR30 «Красный музей»; Pets / TR15 — тот же класс без условия) — в файле карты ОДИН предикат для трёх близнецов: живой хук `onTilePlaced` (выплата через `cards/tilePayout.payTileToCard(owner, this, space, this, resource, n, {cause: 'tile-placed'}, {log: true})` — синхронно, или в той же отложенной ступени, что была), `tilePlacedForecast` (клетка неизвестна — `forecast.deferred` БЕЗ чипов с нотой «Depends on the cell…», форма Mining Guild), `tilePlacedPreview` (флаги контекста — тайла ещё нет; подходящая клетка — грант и `forecastReaction(fact, answers)` под ним; неподходящая — `noEffectHere` с ВИДОМ и ЧИСЛОМ помехи). Даром: «на Марсе» — `Board.onMarsGrid`, особый тайл — `isSpecialTile`, запись класса и сцена «ТАЙЛ ПЛАТИТ КАРТЕ» (жетоны рождаются на севшем тайле у кромки к карте / чипу, капсула и производная ячейка ПО на касаниях, несколько записей одной посадки по очереди, ярус, у соперника — к чипу владельца после посадки), ответ стола под строкой своей причины в досье (`docs/TURMOIL_REDUX_RED_MUSEUM.md`) | второй предикат (досье считает одно, хук другое); `Board.isCitySpace(space)` в досье; соседи по пустым океанским КЛЕТКАМ; запись подачи мимо `payTileToCard` (сканер `tests/cards/tilePayout.spec.ts`); выплата СТОКОМ или ПРОИЗВОДСТВОМ на тайл (Rover Construction, Immigrant City) — не этот путь, у неё сцены нет (реестр К-1) |
| карта СТРОИТ КОЛОНИЮ, СНИМАЯ ПРАВИЛО ДВЕРИ (TR25 «Эксклюзивная колония»: «даже если у вас там уже есть колония» / «даже если на плитке 3 колонии») — общий шаг `new BuildColony(player, {allowDuplicate?, ignoreLimit?, title, cause: {kind: 'card', card}, canAffordOptions?})` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview` + `bespokeCanPlay` по `step.hasCandidate()` / `unplayableReason` по `NO_COLONY_TO_BUILD_ON_REASON`. Даром: одна причина на плитку в порядке двери, маркер `buildSites` (причал, «сверх лимита», свои кубы), бонус причала `buildBenefitAt` (четвёртый — последняя напечатанная клетка), единственный писатель кубов `Colony.placeCube`, строка журнала «сверх лимита», staged-дверь «Выбрать колонию» → сетка с призраком куба в причале маркера → стейдж `build` → ОДИН POST с адресованным `colony`-хвостом и ответами шагов бонуса, причал сверх лимита в трёх хостах (модель мест), такт ДОПУСКА перед кубом, продолжение награды в зоне стейджа, «домой» и квитанция сетки, названный пропуск, прогноз «колония построена» (`grantForecast` на `{kind: 'colony'}` — Poseidon) (`docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md`) | свой `SelectColony` / `addColony` / push в массив кубов в файле карты (гард единственного писателя упадёт с именем файла); сырое `build.quantity[…]` (гард-сканер); снятие ДРУГОГО правила двери (неактивная плитка, РТ) → новый флаг `BuildDoorOptions` со своей причиной и статусом кандидата; перевод декларативной карты-строителя (`behavior.colonies.buildColony`) на staged-дверь — строка в её файле, сама по себе карта остаётся на прежнем пути; реактор `onColonyAddedByAnyPlayer` вне скоупа → близнец `grantForecast` в его файле (сегодня честное `unknown`) |
| ДЕЙСТВИЕ карты даёт ПРЯМОЙ РТ (TR28 Earth Army Contract; UNMI, Caretaker Contract, Equatorial Magnetizer) или его печатный ряд — ТАЙМЛАЙН на своей карте («+N сюда, затем −M отсюда : …» — TR28) — в файле карты только честное превью: чипы в ПЕЧАТНОМ порядке (`cardGain`, `cardCost(card, M, c + N)` — трата читается от счёта, который оставил собственный +N, `trGain`) и ОДНО чтение состояния для превью и исполнения (образец TR28 `activationAt`; исполнитель откладывает декларативный `addResources` — условную половину ставить в очередь за ним). Даром: `ActionCommitKind 'rating'`, жетон РТ из печатного значка на рельс через `railReward` (посев против диффа в apply-блоке, тик на касании, ячейка ПО с ним, ответ стола тактом после), таймлайн из звеньев (капсула героя c → c + N → c + N − M, трата тикает на отлёте, workspace стоит, пока карта — цель или источник), один чип таймлайна в композере и детали «Действий карт» (`docs/claude/console/workspace-band.md` § ACTION COMMIT) | РТ, который принадлежит тайлу или шкале впереди, — НЕ этот путь (он приходит с ними); трата с собственной капсулы БЕЗ выигрыша перед ней — это строка ниже (TR29) |
| ДЕРЖАТЕЛЬ с ТРИГГЕРОМ НА МЕТКИ + ДЕЙСТВИЕ С ПРОИЗВОДСТВОМ (TR38 Biological Simulations — «метка микроба / животного → +1 data», «2 data → +1 пр. растений»; TR05 — на науку): в файле карты `onCardPlayed` → `player.tags.cardTagCount(card, [...TAGS])` + `addResourceTo(this, {qty, log: true})` и близнец `cardPlayedForecast` (`forecast.exact` + `actionPreviews.cardGain`, причина — свой ключ `OWN_TAG_REASON`-голоса, `reasonTag` = сработавшая метка — ИКОНКА причины и ИСТОЧНИК чипа ответа стола); действие `{spend: {resourcesHere}, production}` декларативно. Даром: превью, причина «Not enough resources on this card», ACTION COMMIT (трата с капсулы поглощается у печатного РЕЗУЛЬТАТА по закону TR29, жетон производства рождён в `.pcard-prod`), ответ Зелёных на шаг производства (`PartyEffects.onProductionChanged` + факт `greens-production`) — тактом ПОСЛЕ касания, **ответ стола на РОЗЫГРЫШ летит** (К-S1 / PL-124: держатель выходит из полосы, чип с печатной метки → капсула, тик на касании; факты `asks` / `unknown` не летят), e2e `console-biological-simulations` (A, B) | `onNonCardTagAdded` «на всякий случай» (меток микроба / животного не с карты в движке нет); триггер без близнеца (гард `effectForecastCoverage`); роль держателя `store` (роль «data покупает товар действия» — класс TR02 / TR05 / TR23 / TR38, батч владельцу К-R1) |
| карта МЕНЯЕТ ЗАКОН ДОСТУПА к эффекту партии (TR36 Council Seat — «достаточно 1 делегата»): хук **в файле карты** `partyEffectDelegates = N` (`ICard`), `Parliament.effectDelegatesOf(player)` читает табло вживую (минимум по картам, кламп `[1, PARTY_EFFECT_DELEGATES]`, источник — карта), `access()` судит `byDelegates` по порогу владельца, `satisfiesRequirement` — по константе (FAQ стр. 19); модель несёт `effectDelegates` / `effectDelegatesBy`; клиент читает ОДНИМ помощником `effectDelegatesOf` (гард `parliamentThresholdGuard.spec.ts`), места ▢▢ остаются двумя — лишнее VOID в потоке; `cardPlayPreview` — ноты «что откроется сейчас» (`councilSeatOpenings`), `bespokePlay` — только журнал по той же выборке (`docs/TURMOIL_REDUX_COUNCIL_SEAT.md` §2) | грант (`grantPartyEffect`) вместо порога (это Septem Tribus — «эффект независимо от кубов»); порог в требовании / `partyRequirementStanding` / `unlocksRequirement`; чтение табло по имени карты в Парламенте; константа порога в `.vue`; новое сериализуемое поле; порог ВЫШЕ двух (карта «нужно 3») — кламп режет до 2, нужен свой контракт |
| ДЕЙСТВИЕ ТРАТИТ ресурс с ЛЮБОЙ СВОЕЙ карты (TR29 Spaceship Recycling — «потратьте 1 истребитель с ЛЮБОЙ своей карты») и/или это ДВА ВАРИАНТА С ОБЩЕЙ ПЛАТОЙ — в файле карты ОДНА конструкция источника (`new RemoveResourcesFromCard(player, R, n, {source: 'self', blockable: false, autoselect: false, cause})` — её спрашивают и превью, и действие) и ОДНА конструкция цели (`AddResourcesToCard(…, {autoSelect: false, cause})`); превью: источник — card-level `preSteps` (шаг `input` с `amount: −n`, `cardResource`, `vpBox` из `targetVictoryPoints` над `previewTargetCards()`), варианты — `orBranches` (чип `cardResourceCost` на стороне платы каждого, вариант без цели — `available: false` с `targetReason`, тогда `orBranches` авторазрешает единственную ветку и сервер НЕ спрашивает `OrOptions`), цель — `addToCardStep` в шагах ветки; `action()` — `game.defer(removal)` → `.andThen` → `player.defer(OrOptions…markChoiceContext(effectChoice(this)))` (печатный порядок = порядок вопросов). Даром: строка источника в композере (кандидаты, близнецы с причиной, `current → resulting` и ПО каждого), роль ответа («Карта-источник» / «Карта-получатель»), строка журнала траты класса («${0} spent ${1} ${2} from ${3}»), коммит: жетон траты из капсулы реального источника (герой / миниатюра в ряду), тик источника и его ПО на отлёте, результат рождается на значке выбранного варианта после касания, мех / ресурс «на карту из ряда цели» садится на её миниатюру, workspace стоит до касания (`spendLinkSpecs`, `docs/claude/console/workspace-band.md` § ACTION COMMIT) | своя строка журнала траты (класс пишет её сам; `log: false` — только если строка карты конкретнее); трата с ЧУЖОЙ карты (атака — Predators) — не этот путь; декларативная `spend.resourceFromAnyCard` — мёртвая ветвь DSL (автовыбор, без шага превью) — не использовать |
| ДЕРЖАТЕЛЬ с `or`-ДЕЙСТВИЕМ «купи ресурс ИЛИ потрать его на товар» (TR40 Forestry Mechs — «1 энергия → мех ИЛИ 1 мех → +1 пр. растений»; TR34 / TR35 — тот же A, но B — голос, и там модуль переписи) — **ОДНА ДЕКЛАРАЦИЯ класса Local Shading**: `action: {or: {behaviors: [{spend: {energy: 1}, addResources: 1, title}, {spend: {resourcesHere: 1}, production: {plants: 1}, title}], autoSelect: true}}`; ни `canAct`, ни `action()`, ни причины в файле. Движок (спек TR40 пинит): оба варианта живы → `OrOptions` `effect-choice` ОТЛОЖЕННЫМ промптом (`player.defer` — `action()` возвращает `undefined`, спек читает `popWaitingFor` после `runAllActions`); один жив → без вопроса (исключение инварианта 3); оба мертвы → причины карты-уровня В ОБЪЯВЛЕННОМ ПОРЯДКЕ (A первым = энергия — то, на что игрок может повлиять); превью на две ветки — `index` 0 / 1 (или −1 одинокой), чипы у мёртвой ветки тоже; прогноз ветки — в `byBranch[pos]` как `conditional` с `condition.chosen = {certainty: 'exact'}` (композер с фиксированной веткой восстанавливает); титулы под-вариантов — ключи `play_prompts.json`; капшен B — `action-short` с `tokens: ['production(<res>)']` (образец Local Shading), чтобы встать к СВОЕМУ ряду; в консоли карта с `or` — ДВЕ плитки «Вариант 1 / или Вариант 2» одной карты, у каждой свой композер с фиксированной веткой. Модуль переписи `censusAction.ts` сюда не подходит (его B — голос). | — |

## 5. Политика e2e

**Один спек на карту с НОВОЙ механикой** (`tests/e2e/console-<card>.spec.ts` + фикстура в
`tests/e2e/fixtures/generate.ts`, имя в `FixtureName`), ни одного на «просто ещё одну карту» — её путь уже
доказан соседями. Правила драйвера — `.claude/rules/tests.md`: `{...NO_PAYMENT}`, только state-waits
(`settle` / `pressUntil*`; `waitForTimeout` у нового файла = 0 по рэтчету), примитивы `consoleStart.ts`
(`bootFixture`, `openCardActions`, `openActionFocus`, `playCardFromHand`, `reloadConsole`), `test`/`expect` из
`./consoleTest`. Стабильность — `--repeat-each=4`. `shardPlan.json` не править.

## 6. Документы

Запись в `docs/claude/turmoil-redux-cards-progress.md` (что нового, решения, оставшиеся гэпы); документ карты
`docs/TURMOIL_REDUX_<NAME>.md` — только если карта ввела НОВЫЙ контракт, который наследует следующая.

## 7. Полировка по пути (≈ 20 % сил каждой карты, с TR26)

Каждая карта — проход исполнителя через кусок живой игры. Что на этом пути сломано или ниже планки
`CLAUDE.md` (north star · «workspace — один flow» · физическая причинность · ничего не движется, пока игрок
целится) — работа этой же задачи: чинится отдельными коммитами, классом и с гардом; что не влезло или требует
решения владельца — строка реестра **`docs/claude/gameplay-polish-ledger.md`** и достаётся следующей карте.
Осмотр, реестр и отчёт по ним — часть сдачи, как спек карты.

**Скоуп.** ИГРОВОЙ ПРОЦЕСС консольного шелла: поле, рельсы, рука, композеры, workspaces, сцены и полёты, журнал и
нотификации в партии, досье, строка команд, тексты. НЕ скоуп: главное меню, лобби, создание партии, кампания,
настройки, системное меню, dev-инструменты, Electron, остатки десктопа, «решения владельца по умолчанию».

**Профили (решение владельца 2026-10-09).** Полировка идёт в первую очередь на **TV 4K** — главном продукте форка, затем fhd.
Полировок, нужных ТОЛЬКО Deck (1280 × 800, handheld), не делаем — ни правкой, ни строкой реестра «ждёт владельца»: такая находка
записывается сразу «не чиним» со ссылкой на это решение (PL-105) или не записывается вовсе. Осмотр карты снимается на 4K
обязательно; Deck — только как регрессия соседних гардов, а не как поле для находок.

**Бесшовность — workspace-архитектура (правило владельца 2026-10-10, память `polish-seamless-workspace-architecture`).**
Два критерия полировки в этом порядке: **визуальная подача на TV 4K**, затем **бесшовность**. Бесшовность — не эффект
одной сцены: её даёт архитектура workspace («один intent = один flow на одном стеке кадров»). Каждый flow снимается
ЦЕЛИКОМ раскадровкой 4K (`TM_E2E_STORYBOARD=1`, от нажатия до поля) и читается по восьми вопросам шва:
(1) **Встроено?** — этап, который открыл игрок, стоит в зоне хоста (та же инстанция, Teleport), не отдельной полосой;
(2) **Крошка растёт?** — корень и субъект те же узлы весь flow, анимируется только хвост, встроенная поверхность не
титулует себя; (3) **Фраза, не склейка?** — COMMIT → RELEASE на месте → UNFOLD из rect ушедшего → REVEAL, без `v-if`-моргания,
без кадра без объекта, без пустой зоны > ~400 мс; (4) **B = уровень назад?** — глагол и подпись от одной функции фазы,
«свернуть» сохраняет выбор / курсор / раскрытую карту; (5) **Конец — одна концовка?** — закончивший flow уходит на поле;
(6) **Результат переживает поверхность?** — награда отделяется в слой приложения и летит в ИЗМЕРЕННОЕ место;
(7) **Причина видна?** — каждое изменившееся число имеет полёт или строку причины на том же экране; (8) **Бар честен?** —
ни одного глагола, который ничто не принимает. Шов чинится в ОБЩЕМ механизме (стек кадров, хостимый шаг, слоёвый стек
зоны, концовка, воронка релиза, сцена посадки) с законом в `console-ui.md` и гардом; **заплата одной сцены не
принимается**; композиционная правка принятой сцены — кадрами 4K владельцу. Образцы: PL-124 (ответ стола на розыгрыш —
группа EFFECT RESOLUTION, закон 24), PL-120 (а) (хостимый шаг входит с коммита посадки, закон 25).

**Премиум-планка (правило владельца 2026-10-10, память `polish-premium-bar`; введено осмотром TR40).** «Агент должен сам уметь находить
слабые места и доводить проект до совершенства, пока мы добавляем новые карты — визуал должен становиться как эталон премиальной
карточной игры». Правило 80/20 остаётся, но когда карта — декларация в 20 строк, 20 % становятся 80 %: бюджет полировки — ВСЁ сверх
карты. Планка — не «нет дефектов», а «как у эталона»: **композиция** экрана (герой ≥ трети зоны, пустота зоны ≤ трети, каждый блок
знает, зачем он там, панель якорится к герою), **иерархия** (одна самая громкая вещь на экране, остальное — тише ступенями),
**типографика** по лестнице rem (ни одного текста в 23 px страницы на 4K — урок TR33; пробник `type ladder` стенда TR40: каждый
текстовый лист сцены → размер × вес × число, читать как данные), **чипы и значки в масштабе СЦЕНЫ**, а не HUD (спрайты ресурсов 512 × 512
— запас есть), **стекло** панелей одной семьи (радиусы, рамки, тени — сверять по кадрам трёх workspace), **состояния читаются без
цвета** (вес / форма), **движение** спокойное и ПРИЧИННОЕ (каждый полёт отвечает «откуда, зачем, куда»), ни одного мёртвого времени
> ~400 мс, ни одного `v-if`-моргания, ни одной склейки, **бар** честен на каждом кадре. Эталоны: Asmodee Steam-версия — плотность;
Ark Nova (BGA) — движение; премиальные цифровые ККИ — подача карты-героя и тактильный отклик нажатия. **Метод:** каждая сдача карты
снимает ГЛАВНЫЙ workspace своего маршрута на TV 4K — покой и раскадровку КАЖДОЙ стадии — и читает каждый кадр по планке (пробник
долей блоков `auditStage`: доля героя, доля содержания, доля пустоты; лестница шрифтов; слои под каждым «чужим» глифом); результат —
таблица «момент · кадр · что слабо · предложение · класс / батч» в реестре; три лучших предложения — МАКЕТАМИ (кадр ПОСЛЕ на своей
сборке: CSS поверх живой сцены через `addStyleTag`, пусть грубый) в батч владельцу ПЕРВЫМ; принятое — классом с A/B и гардом долей.
Образец: TR40 — «Действия карт» (реестр, раздел S: PL-137…PL-140, макеты `screenshots/tr40/frames/walk3/`). **Принятое
закрепляется ГАРДОМ ДОЛЕЙ в e2e того же маршрута** (итерация TR40, 2026-10-10): герой ≥ 25 % зоны «Действий карт» на 4K и паттерн
приглушённого рельса (`console-biological-simulations` B), протагонист сцены посадки ≥ ⅓ высоты зоны на fhd и 4K (там же, A) —
число из пробника, не из глаза; **«пауза» измеряется, а не чувствуется**: `PerformanceObserver('longtask')` в пробнике сцены (когда
главный поток замер), CPU-профиль через CDP (`(program)` ≠ JS → не искать в коде), трейс рендерера `tests/e2e/traceProbe.ts`
(`TM_E2E_TRACE=1`: UpdateLayoutTree / Layout / Paint по именам в окне часов пробника — ЧТО делал поток) — образцы в
`screenshots/tr40/stand.spec.ts` (сцена A) и `console-red-lawyers` (подъём Парламента).
**Шкалы глобальных параметров** (введено осмотром TR41): каждая карта, двигающая параметр (действие, розыгрыш, СП), снимает на 4K
покой четырёх дуг и раскадровку истории шага (маркер · РТ-жетон с маркера · ответ стола · жетоны «шаг шкалы платит» · крышка порога)
и читает по планке: цифры делений и маркер — в масштабе СЦЕНЫ (лестница `type ladder` над `.con-board` / `.con-status`: цифры дуг
против значений HUD — одно число, одна громкость), текущее значение читается ПЕРВЫМ, бейджи типа шкалы и чипы порогов различимы с
дивана, состояние чипа — формой (куб / кольцо), ритм истории без мёртвого времени (между последним жетоном и крышкой), композер
называет всё, что шаг платит (РТ, порог) ДО нажатия. Стенд-образец `screenshots/tr41/stand.spec.ts` (`auditScales`, макеты M1–M3);
реестр, раздел T (PL-145…PL-148).

**Два рода находок.**
- **ДЕФЕКТ** — неверно или сломано: ложь на экране (превью ≠ факту, статус ≠ состоянию), результат раньше причины,
  прыжок или моргание (`v-if` вместо фразы), кадр с двумя копиями или БЕЗ объекта, обрезанный текст, наложение,
  мёртвая кнопка, глагол в строке команд, который ничто не принимает, отключённое без причины, тихая потеря,
  зависший холд, stranded, скролл на стандартном экране, красный или флейкующий спек с причиной в продукте.
- **СЛАБОСТЬ** — работает, но не премиум: число поменялось без видимой причины; полёт не из своего источника;
  резкая склейка; мёртвое время (> ~400 мс ничего не движется и нечего читать); два такта внахлёст; движение
  под курсором; неровные отступы, сбитая базовая линия; текст, обрезанный при свободном месте; две формулировки
  одного понятия; блок, пересказывающий соседнюю зону; слабая иерархия; статус, не различимый без цвета.

**Метод (приёмка карты и осмотр — ОДИН проход).**
1. Каждый кадр приёмки читается дважды: «карта сделала, что обещала?» и «что здесь сломано или слабо, чьё бы оно
   ни было?» — по вопросам: *причинность* (причина → путь → результат?) · *непрерывность* (ни моргания, ни
   пустой полосы, крошка только растёт?) · *неподвижность* · *читаемость* · *честность* · *грамматика*
   (A / B / X / L3) · *ритм* · *отделка*.
2. **РАСКАДРОВКА, а не скриншот покоя.** Главную сцену карты снять CDP-скринкастом (`TM_E2E_STORYBOARD=1` в спеке
   карты — образец `console-unmi-liner.spec.ts § storyboard`) и просмотреть КАЖДЫЙ кадр от нажатия до покоя,
   включая весь экран, а не только место, куда смотрит пробник. Три из четырёх находок TR26 (жетон за краем
   экрана, ячейка ПО впереди рейтинга) были видны только так: пробник мерил «рейтинг = N до касания» и был зелёным.
3. **Трасса пробника читается как данные, а не как «зелёный».** Числа вне экрана (`y < 0`), разрывы семплов,
   значение, которое пробник не проверяет, но печатает, — находки.
4. **Соседи маршрута**: каждая поверхность, по которой прошла карта, проходится ещё раз в её ДРУГИХ ролях и
   глазами ДРУГОГО места за столом (второй клиент: что видит соперник там, где у владельца причина видна?).
5. Логи прохода (`[console-overflow]`, leak-детектор, истёкший холд, Vue-warn, красный запрос) и красные /
   флейкующие соседние спеки — с причиной, не с повтором.
6. Открытые строки реестра на этом маршруте — сперва воспроизвести.
Находка СРАЗУ получает строку реестра с доказательством (кадр, трасса, лог) и шагами — до решения, чинить ли.

**Сейчас или записать.** Чинится в этой задаче, если ВСЁ верно: игровой процесс; причина понята и названа
классом; лекарство — классом, а не заплатой; его можно закрепить гардом и доказать A/B; оно не меняет решения
владельца и документированный контракт. `ждёт владельца` — если правка меняет композицию экрана, поведение
кнопки, тайминги уже принятой сцены, или стоит дороже остатка бюджета.

**Порядок и бюджет.** **P0** — дефект на маршруте самой карты (включая общий слой, на котором она стоит): чинится
ВСЕГДА, в 20 % не входит. P1 — дефект у соседей маршрута → P2 — слабость на маршруте → P3 — слабость у соседей →
P4 — старые строки реестра по этому маршруту. Минимум сдачи: осмотр проведён, реестр дополнен, все P0 закрыты,
бюджет потрачен на P1–P4 либо список исчерпан.

**Трек Карьеры — постоянный пункт осмотра каждой карты, двигающей маркер** (TR04, TR12, TR37, …; с TR37, 2026-10-09):
подача на TV 4K (узлы, значки, рельс, шапка «ДАЛЕЕ», уровень влияния — штрих не тоньше ~4 px на 2160, узел не меньше
`--con-parl-node` TV-профиля), движение маркера (дуга / лифт в масштабе профиля — `conLogicalPx`, bloom узла, такт
влияния одним классом), награда шага (РТ-чип с узла на рельс и ответ стола ПОСЛЕ касания; карта — обложка с узла
по сигналу «маркер сел», посадка в док до следующего лега), вход хостимого шага ОДНОЙ фразой (бар не читает
глаголов композера с подъёма Парламента, поза ходьбы на первом сэмпле, крошка «КАРЬЕРА» с подъёма); термин трека —
по словарю §4 («Карьера» или слово, выбранное владельцем, — ОДНО во всех строках: кикер, крошка, лента, журнал,
счёт). Раскадровка входа и ходьбы — на 4K, по кадру за такт (`TM_E2E_STORYBOARD=1`).

**Дисциплина правки.** Каждая правка — ОТДЕЛЬНЫЙ коммит `Polish (TR## walk): PL-### — …`; к ней «до / после»
(кадры или замер) из СВОИХ снапшотов, гард по размеру дефекта (юнит или сканер раньше, чем e2e), правка правила
или документа, если это закон. Правка не меняет кадры и тайминги потоков, которые она не называет. Никаких
рефакторингов «заодно». Закрыть находку ослаблением спека нельзя; промолчать о непочиненной — тоже.

**Что оплачено опытом TR26 (первая задача по схеме).**
- e2e и тяжёлые процессы НЕ совмещать: `vue-tsc` / `mochapack` / сборка рядом с прогоном дали 2-секундные дыры
  в семплах и «корабль не сел» — красный, которого нет в продукте. A/B таймингов — только на тихой машине,
  последовательно, «до» и «после» одним запуском.
- «До» снимается ПЕРВЫМ делом и только сборкой с чистым клиентом; промежуточный снапшот после «обобщения без
  видимых изменений» дешевле, чем искать, какой из трёх коммитов сдвинул сестру.
- Бюджет 20 % легко съедают P0 (у TR26 — четыре): P1–P4 тогда остаются строками. Это нормальный исход, если
  строки честные; раздувать задачу ради P3 не надо.

**Что оплачено опытом TR33 (2026-10-08).**
- **Скриншот подсказал, ВЫЧИСЛЕННЫЙ стиль доказал.** Имя карты в колонке превью обозревателя «выглядело мелко» на 4K —
  пробник `getComputedStyle(...).fontSize` по цепочке предков показал 23px, не rem: текст без собственного размера наследует
  немасштабируемые 23px страницы и совпадает с `1.15rem` ТОЛЬКО на 1080. Дешёвый вопрос к любой новой поверхности на 4K:
  «есть ли текст ровно 23px?» (PL-095).
- **Проверка внутри `if (элемент есть)` не доказывает ничего, пока не доказано, что элемент там бывает.** Свип 4K / Deck спека
  обозревателя жал A на ПЕРВОЙ двери хаба (мёртвой в этой партии), таблица не открывалась, и `expectFits` таблицы на 4K не
  исполнялся ни разу — переполнение на 46 px жило под зелёным спеком. Новый гард в ветке — сперва `expect(…).toHaveCount(1)`
  на сам объект.
- Общий `test-results/` не изолирован снапшотом: параллельный прогон Playwright соседней сессии удаляет чужие артефакты
  (`video.saveAs ENOENT`) — такой красный не о продукте; читать сообщение, не повторять вслепую.

**Что оплачено опытом TR34 (2026-10-09).**
- **Имя кадра скринкаста — время ПОЛУЧЕНИЯ, не время кадра.** CDP-кадры именуются `Date.now() − t0` в Node при приёме; на
  загруженной машине (параллельный пробник + сервер) они отстают от пробника страницы на 200–450 мс, и «сокет пуст 220 мс после
  посадки» читался на кадре, снятом ДО посадки. Правило: сверять кадры с пробником по ВИДИМОМУ событию (смена текста бара,
  появление прокси), не по числам в имени; подозрение на «кадр без объекта» подтверждать DOM-пробником 10 мс (классы,
  `visibility`, `opacity`, бокс) и контактным листом региона (`System.Drawing` в PowerShell режет JPEG без sharp) — так сняли
  ложный P0 посадки куба (реестр § L).
- **Две независимые тактовые — находка, даже когда порядок случайно верный.** Импульс ACTION COMMIT идёт на часах мотора,
  полёт куба — от ответа сервера; на стенде порядок менялся между прогонами (B0 TR15: куб сел раньше кольца; TR34: кольцо
  раньше куба). Сцена, чей порядок зависит от латентности, — слабость по §7 («два такта внахлёст»), фиксировать с обоими кадрами.
- **Сетка «Действий карт» двумерна, а карта с «ИЛИ» внутри ОДНОЙ строки — одна плитка.** `walkFocusUntil` ходит ←→; на столе
  из ≥ 2 карт нужен цикл → → ↓ ← ← ↓ (`openAction` в `console-rail-landing.spec.ts`, память `e2e-action-centre-grid-walk`), а
  регулярка варианта «…2$» не найдёт карту TR29 — у неё одна плитка с «*ИЛИ*».
- **Rect-пробник не читает КРАСКУ, а `position: fixed` — всегда контекст наложения (PL-101, TR34).** Полётный слой
  Парламента стал fixed 2026-09-20 с комментарием «без z-index дети конкурируют на корне своими 11499» — ложно: fixed
  открывает контекст наложения без z, слой сидел на уровне 0 `.con-root`, и три недели каждый куб и жетон летел ПОД
  `.con-main` (z 1) и под лентой (11480+), пока «источник виден · цель видна · прокси двигался» и DOM (`op=1, vis=visible,
  z=11499`) были зелёными. `elementsFromPoint` тут не свидетель вовсе — `pointer-events: none` элемент он не видит, список
  «над точкой» — это то, что ПОД жетоном. Свидетель краски прокси: PNG в момент полёта (`page.screenshot` по условию на
  rect, стенд `tr34-b-token-flight.png`) или `el.style.pointerEvents = 'auto'` на один вызов `elementsFromPoint` — прокси
  должен вернуться ПЕРВЫМ. У shell-mounted слоя полётов — явный `z-index` уровня его прокси.

**Что оплачено опытом TR35 (2026-10-09).**
- **Принятый кадр предыдущей карты — тоже свидетель, не только её журнал.** Значок роли «делегаты» (PL-030) журнал TR34 описал
  словами «[мех] 2 · делегаты», а на его же кадре значка нет — серый «пузырь» между чипами; пробник DOM (бокс, `position`,
  `display`) показал `span` 36 × 27 `static inline`: правила стояли в соседнем BEM-блоке LESS (`.con-res` вместо `.con-res-aux`) и
  скомпилировались в класс без элемента. Дешёвый вопрос к новому значку / маркеру: «какой у него бокс и `position`?» — и гард класса
  «шаблон ↔ свой блок стилей» (`tests/console/satelliteStyleGuard.spec.ts`, PL-102), а не e2e.
- **«Одна цепочка на часах мотора» проверяется по КАЖДОМУ звену.** PL-100 сцепил цену → куб, а импульс → цену оставил на ответе
  сервера; пробник 10 мс с полосой и кольцом импульса (`.con-commit-sweep`, `.con-commit-ring`) рядом с жетоном показал жетон в
  полёте раньше кольца (PL-103). Если звено — следствие коммита, а стартует от ответа, ему нужна защёлка мотора (`afterCommitImpulse`).
- **Отлёт — не прилёт наоборот.** Дуга награды «бросок вверх над высшим концом» на ОТЛЁТЕ со строки рельса проходит над чужими
  счётчиками (титан над сталью и плашкой M€); контактный лист региона рельса это показывает, пробник «тик на отлёте» — нет (PL-104).
- **Скринкаст под нагрузкой присылает кадры другого размера** (половинные) — контактный лист с фиксированной обрезкой режет их
  пустыми; читать размер кадра, не только имя (`screenshots/tr35/sheet.ps1` — `System.Drawing`, обрезка + сетка + подпись времени).

**Что оплачено опытом TR36 (2026-10-09).**
- **Карта, меняющая ЗАКОН, а не стол, проверяется по всем ЧИТАТЕЛЯМ закона, а не по одной сцене.** Пять клиентских мест решали порог
  константой; гард класса «константа читается ОДНИМ помощником» дешевле любого e2e и ловит шестое место до того, как оно родится.
  Перед кодом — grep константы по `src/client/**`: каждое вхождение = поверхность, которая солжёт.
- **Чужой словарь прячется в текстовом рендере токена.** `translateMessage` печатал PARTY-токен через апстримный `turmoil.json`
  («Ученые»), а плитка «Действий карт» — `$t(group.party)` тем же ключом: обе поверхности прошли мимо гарда словаря, потому что он
  ходит только по деревьям Парламента (PL-109 / PL-110). Новый текст с именем партии — только через `partyNameKey`; кадр 4K «Действий
  карт» показал это раньше, чем какой-либо спек.
- **Второй клиент в фикстуре Парламента — всегда корпорации без первого действия** (`customCorporationsList: [TERACTOR, THORGATE]`,
  ловушка TR24 / TR30): иначе консоль соперника стоит в «СТАРТ ПАРТИИ › ПЕРВОЕ ДЕЙСТВИЕ», и колесо не открывается — красный спек
  о продукте ничего не говорит.
- **Фрагмент `/* … */` внутри JSDoc закрывает комментарий** — спек-гард с таким примером в шапке не парсится ни tsx, ни tsc; esbuild
  называет НЕ ту строку (первую, где лексер окончательно сбивается).
- **Сплит чипа по роли ПЕРЕНОСИТ e2e-адрес.** PL-030 обещал «ни один e2e-адрес не сдвинут» (Тардиграды), но data переписи ушла на
  `data:delegate`, и пробник `console-red-museum` § соседи читал плоский `data` (чип Волокна с нулём) — красный жил день, потому что ни
  TR34, ни TR35 этот спек в регрессию не брали. Правило: при сплите спутника grep `data-aux-resource="<ресурс>"` по `tests/e2e/**`
  и переводить каждый адрес на ключ роли; регрессия — объединение списка промта и `npm run e2e:affected`, не только своя семья.

**Правило заимствованной поверхности (PL-060 / PL-066, 2026-10-06).** Заимствовал у композера поверхность — строку
«Сработает», чипы ответа стола, досье, — заимствуй и её ГЛАГОЛЫ: сверь бар и клавиши с оригиналом (`e2e:affected` этого
не ловит — хук тот же, глагола просто нет). «Ответ стола» без двери R3 «Эффекты» — дефект, не результат. И в обратную
сторону — **везде, где стол ОТВЕЧАЕТ на действие игрока** (РТ, в том числе от шага шкалы; производство; ресурс на карте;
шкала; тайл; колония), ответ стоит ДО нажатия и открывает слой: композеры, стейдж причала, стейдж колонии, стандартные
проекты; досье клетки называет ответ без двери (его закон). Новая поверхность с ответом стола = хост
`consoleForecastHost.ts` + `ConsoleForecastDoor` / `ConsoleForecastLayer` + крошка + бар, и строка в реестре, если
дверь не дверь.
