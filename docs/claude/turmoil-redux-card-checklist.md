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
| карта ДВИГАЕТ МАРКЕР Карьеры на N шагов — `ChairmanSeat.walkAgenda(player, parliament, N, {reason: 'card', card})` СИНХРОННО в `bespokePlay` (без `defer`: ответ несёт запись) + `actionPreviews.agendaWalkModel / agendaWalkEffects / agendaWalkStep` в `cardPlayPreview`: чипы трека / РТ / влияния, SHOW-шаг `agendaWalk`, поза ходьбы в зоне руки, очередь бонусов, событие `agenda-advanced` (`docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md`, TR04) | вторая функция продвижения / второй директор глайда / второй слот бонуса (запрещено); карта, чей шаг КАРТЫ не последний в ходьбе — сцене `agenda-step` нужен сигнал «маркер сел на k» (гэп §7 документа) |
| требование по ВЛИЯНИЮ (`{influence: N}`, с `max` — «не больше N»): вид `INFLUENCE` ЕСТЬ (тропа TR02, TR04) — причина с «сейчас», компактный счётчик «Влияние 2/≤1», бейдж трека | — |
| ПО ЗА МЕТКИ (`victoryPoints: {tag, per}`, TR20): композер розыгрыша читает `ActionPreview.cardVictoryPoints` (сервер, `cardVictoryPointsAtPlay` — тот же `CardVictoryPointsDetail`, что строка обозревателя счёта) и пишет «+N сейчас · [метка] 7 / 3 · ещё 2 до следующего ПО» вместо «по условию»; ноль — ответ, строка не скрывается; гард паритета `tests/models/cardVictoryPointsAtPlay.spec.ts` берёт карту в корпус сам. Ничего в файле карты. Карта без графики эффекта: `renderData` нет, строка ПО структурного текста — `infoText: [{kind: 'victory-points', …}]`, триаж в `NO_MECHANICS_ACCEPTED` | ПО за ресурсы / города / соседство / колонии / `special` остаются «по условию» (розыгрыш ещё может сдвинуть число) — расширять проекцию только с доказательством, что розыгрыш её не меняет |
| карта СТАВИТ ДЕЛЕГАТА на резолюцию (± нейтральные в Народную поддержку её партии) — общий шаг `PlaceDelegatesOnResolution(player, n, {kind: 'card', card}, {support?})` из `bespokePlay` + `actionPreviews.delegateGrantStep(card, step.previewSelectParty())` и `delegateFromReserve` в `cardPlayPreview`: staged-дверь «Выбрать резолюцию», режим голосования в зоне руки, блок «НАРОДНАЯ ПОДДЕРЖКА», посадка куба и нейтральных, адресованный `party`-хвост, три исхода коммита, события `delegates-placed` / `popular-support-gained`, названный пропуск (`docs/TURMOIL_REDUX_POLITICAL_DONATION.md`, TR03) | второй `SelectParty` / свой `placeVote` в файле карты (запрещено); карта с `count > 1` → сперва провести счёт в staged-проекцию (`viewer.vote.projections` считаны для ОДНОГО делегата — §8 документа TR03); выбор числа поддержки игроком (решение владельца: «сколько влезет») |
| ДЕЙСТВИЕ карты СТАВИТ ДЕЛЕГАТА за ресурс этой карты (TR15 / TR24 «перепись»): `PlaceDelegatesOnResolution(player, n, {kind: 'card', card}, {price: {card, count}})` из `action` + `delegateGrantStep` и `cardCost` / `delegateFromReserve` в `actionPreview` — общий `censusAction.ts` (`censusGrant` / `censusVoteReason` / `censusAction` / `censusActionPreview`): одна причина отказа ветки по порядку, цена списывается В ответе шага (не раньше), staged-дверь действия «Выбрать резолюцию» → Парламент в зоне композера, A «Подтвердить», квитанция-чип, ACTION COMMIT на герое, три исхода, уход одной поверхностью (`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md`) | свой `SelectParty` / `placeVote` / ручное снятие ресурса до гранта (запрещено — «заплатил и не поставил»); цена не ресурсом этой карты → новая форма `price`, не второй шаг |
| требование ПАРТИИ (`{party: PartyName.X}`): вид `PARTY` ЕСТЬ (TR15) — причина называет партию и обе дороги («правит» · «N из 2 ваших делегатов на её резолюции» / «её резолюции нет на голосовании») через фасад `politics.partyRequirementStanding`, эмблема партии в плашке MIN (`requirementPartyEmblem` — одна таблица), компакт руки «[эмблема] 1/2», строка правил лица; «есть ли у карты требование партии» — только `hasPartyRequirement` (TR13) | — (доступ, выданный картой, требованием не считается — так считает `Parliament.access()`; второго подсчёта не писать) |
| карта-ПРИЧАЛ («when you trade, you can send the trade fleet to this card to …» — TR06 / TR26 / TR27): `fleetDock: FleetDock` в файле карты (`rewardBlockedReason?` · `previewEffects` · `previewFollowUps?` · `receive`) + `data: {dockedGeneration: -1}` — назначение торговли на пике всех дверей (маркер `fleetDocks`, ответ `{fleetDock}`), гейт торговли, превью `?dock=` с ответом стола на награду (`reactions` — «⚡ сработает» на стейдже до нажатия), событие `fleet-docked`, колонка «ПРИЧАЛЫ» (любое число причалов) и стейдж причала, полёт на ▲ лица, знак флота на лице (и в «Разыграно»), сцена причала ОДНОЙ фразой со слотом награды по КАТЕГОРИИ из данных сервера. **Причал с наградой-РАЗМЕЩЕНИЕМ** (TR06: `previewFollowUps` с нотой) — карта отвечает, уходит своим тактом, поле встаёт чистым. **Причал с ПЛОСКОЙ наградой** (TR26: без follow-up; чипы `trGain` / `stockGain` / `productionChange`) — жетон из печатного значка на рельс, счётчик тикает на касании, реакция стола следом, карта уходит с workspace: в файле карты только `previewEffects` + `receive`. Гард класса по манифесту `tests/colonies/FleetDockManifest.spec.ts` берёт новую карту сам (`docs/TURMOIL_REDUX_WATER_HAULING.md` §9) | награда с ВОПРОСОМ (TR27: цель аэростатов) → `cardTarget` в `previewFollowUps` — категория `question` НАЗВАНА и не построена: нужен шаг цели на стейдже причала (сегодня стейдж пре-собирает только плату) и своя ветка слота REWARD (ресурс на выбранную карту — `card-resource` спека с `targetCard`); плоская награда НЕ стандартным ресурсом и не РТ (карточный ресурс «на эту карту») → строка в `railRewardSpecs` не нужна, это адрес `card-resource` — своя ветка слота; свой `SelectColony` / проверка флота / штамп поколения в файле карты — запрещены |
| карта СНИМАЕТ НАРОДНУЮ ПОДДЕРЖКУ выбранной партии (TR12) — общий шаг `DiscardPopularSupport(player, cause, then?)` из `bespokePlay` (`then` — следующий печатный эффект, в том же ответе) + `actionPreviews.supportDiscardStep(card, step)` в `cardPlayPreview`: маркер `supportPrompt` на шесть областей, staged-дверь «Выбрать партию», режим Парламента `support`, адресованный `party`-хвост, событие `popular-support-discarded`, два такта на одной позе, названный пропуск при пустых областях (`docs/TURMOIL_REDUX_PARTY_SANCTIONS.md`); требование «председатель» — вид `CHAIRMAN` ЕСТЬ, причина названа | свой `SelectParty` / `discardPopularSupport` в файле карты (запрещено); «добавить поддержку выбранной партии» без резолюции → новый `source` у `supportPrompt` + строка `SUPPORT_STEP_STAGES`, не второй режим |
| карта ВЫБИРАЕТ ТРЕК КОЛОНИИ и ставит маркер на максимум — общий шаг `MaximizeColonyTrack(player, cause)` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: кандидаты/отказы/проекция `trackMoves` с сервера, staged-дверь «Выбрать колонию», сетка колоний шагом в зоне руки с проекцией «+N», стейдж `track`, адресованный `colony`-хвост, холд из диффа и ОДИН глайд (`stage` · `rail`), событие `colony-track-moved`, названный пропуск; максимум — только `trackTop(metadata)` (`docs/TURMOIL_REDUX_COLONY_SPONSORS.md`, TR07) | свой `SelectColony` / прямая запись `trackPosition` в файле карты (запрещено); сдвиг НЕ на максимум (на N шагов) → второй режим шага с той же проекцией `trackMoves`, не вторая функция; сдвиг ВНИЗ → отдельное решение (сегодня шаг только вверх) |
| карта ВСКРЫВАЕТ верхнюю карту колоды и проверяет её (TR13) — `drawOrThrow` → `events.recordCardReveal` → `actionReveals.recordReveal(…, check, destination)` ДО сброса + превью `reveal: {check, reward, keepsCard?, pool?}` в `actionPreview`: композер «ПРОВЕРКА» + состав, вердикт, на «ОК» карта летит в док / в сброс, ресурс запаса — на рельс (`docs/CONSOLE_BLUE_ACTION_PARITY.md` ит. 27); «требование партии» — только `hasPartyRequirement` | проверка НЕ метки и НЕ требования партии → новый `RevealCheckIcon` + глиф; карта, ушедшая не в руку и не в сброс → новый `RevealDestination` + ветка `runRevealHandoff`; «ищи до совпадения» — это `drawCard({include})`, другая семантика |
| карта ставит ГОРОД, «ИГНОРИРУЯ ПРОЧИЕ ОГРАНИЧЕНИЯ РАЗМЕЩЕНИЯ» (TR16; TR19 — без соседства) — `cityIgnoringRestrictions(player, {adjacentToOwnCity?}, canAffordOptions?)` + `cityIgnoringRestrictionsReasoner` (`boards/ignoreRestrictionsCity.ts`): земельный набор движка (`getAvailableSpacesOnLand` — океан, Ноктис, лагерь кочевников, чужой Land Claim остаются закрытыми, незащищённая опасность — покрываема) без одного запрета «не рядом с городом»; один набор и одна причина клетки для `bespokePlay` и staged-превью (`placementPreview({staged: {spaces, placementType: 'city', reasoner}})`), причина `not-adjacent-to-your-city`; заголовок промпта называет снятое правило (досье печатает его строкой действия) | свой набор клеток в файле карты; снятие чего-либо, кроме запрета соседства городов; `Board.canPlaceTile` вместо земельного набора (пускает на чужой Land Claim, не пускает на опасность) |
| карта МЕНЯЕТ СОСТАВ ПЛИТОК КОЛОНИЙ — заменяет пустую плитку (TR10), добавляет (Aridor) или убирает: общий шаг `ReplaceColonyTile(player, cause, {build, canAffordOptions?})` из `bespokePlay` (или `ColoniesHandler.seatColonyTile` / `retireColonyTile` / `addColonyTile({cause})`) + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: маркер `rosterChange` (кто может уйти и почему нет, как войдёт каждая плитка резерва, встанет ли колония), четвёртая форма ответа `{colonyName, replaces, stagedFor}`, staged-дверь «Выбрать плитку», уровни стол → резерв → стейдж `roster`, церемония состава гейтом транспорта, LANDING в слот, событие `colony-roster-changed` и строка журнала, названные пропуски (`docs/COLONY_ROSTER_CEREMONY.md`, TR10); требование «поколение ≥ N» — вид `GENERATION` ЕСТЬ | свой `SelectColony` / запись `game.colonies` в файле карты (гард единственного писателя упадёт с именем файла); замена ДВУМЯ промптами (стол с дырой); «плитка из игры навсегда» → новое сериализуемое поле; постройка на входящую плитку НЕ игроком карты → новая опция шага |
| карта ПЕРЕМЕЩАЕТ СВОЙ ТАЙЛ на соседнюю клетку (TR14 «Переселение») — общий шаг `MoveCityTile(player, {kind: 'card', card}, {canAffordOptions?})` из `bespokePlay` + `placementPreview({…, staged: {…, placementType: 'city-move', move}})` в `cardPlayPreview` + `bespokeCanPlay` / `unplayableReason` по `movableCities`: ОДИН вопрос с ответом из двух клеток (`{spaceId, movedFrom}`), staged-коммит с двухуровневым выбором (город → клетка), досье переезда, превью-гипотеза (`withHypotheticalMove`), сцена ОДНОГО прокси у себя и у соперника (запись `game.tileMoves`), строка журнала `tile-moved` — всё общее | другой ВИД тайла или другой набор «кто едет / куда» — своя функция набора в `boards/` и свой писатель в `Game` (образец `moveCityTile`: снять → `addTile(…, {moved})` → запись); `Game.removeTile` не трогать |
| карта кладёт РЕСУРС НА ВЫБРАННУЮ КАРТУ «за каждый город рядом с этим тайлом» — награда, которую РЕШАЕТ КЛЕТКА (TR21 «Дендрарий»): общий модуль `cards/adjacentCityPayout.ts` — `adjacentCityTarget(player, card, resource, legalCells, title)` в `bespokePlay` ДО тайла (шаг `SelectResourceTarget`, `Priority.PLAY_CARD_RESOURCE_CHOICE`, только когда платит хоть одна легальная клетка, единственный держатель всё равно спрашивается), `payPerAdjacentCity(player, card, space, resource, target)` в `.andThen` размещения, `adjacentCityPreviewSteps(step, warning)` в `cardPlayPreview`, `adjacentCityPayoutFacts(player, card, space, resource)` в хуке `placementPreview` (`ctx.placesTile`). Даром: счёт по ЯРУСАМ любых владельцев (`boards/cityStack.adjacentCityTiers` — одна функция и для досье, и для Торгового района), шаг цели в композере БЕЗ числа («+1 за каждый соседний город» — `resourceGainPrompt.amountBasis`), staged-коммит с целью до клетки, строка досье «За N соседних городов → [лицо] цель k → k+N» + «⚡ <реакция> +M» (`grantReactionFacts` — живые `grantForecast` стола), подсветка платящих городов тоном `reward`, названный пропуск без держателя, строка журнала с `basis` («за 3 соседних города»), запись `game.cardAdjacencyPayouts` и сцена «ГОРОДА ПЛАТЯТ» у себя и у соперника (`docs/TURMOIL_REDUX_ARBORETUM.md`) | другой X («за каждый океан / озеленение рядом») → новый `AdjacencyAmountBasis.per` + ключ единицы + своя функция счёта в `boards/` (с `spaces`!) + источник жетона в геометрии сцены (`cityDataPayoutBeat.stageGeometry` знает только города); раскидывание по НЕСКОЛЬКИМ картам — другой шаг (запрещено переиспользовать этот); стандартный ресурс (не карточный) → это не этот шаг, а `stock.add` с источником-клеткой |
| карта кладёт ТАЙЛ НА ПЛИТКУ КОЛОНИИ (TR22 «Нова-Сити»; TR27 возьмёт то же) — общий шаг `PlaceCityOnColonyTile(player, card)` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview` + `bespokeCanPlay` / `unplayableReason` по `ColoniesHandler.cityOnColonyTileBlockedReason`: маркер `tileSite` (проекция сервера: клетка, цвет, «космические города сейчас → после», ПО карты), staged-дверь «Выбрать колонию», призрак города на каждой плитке, стейдж `city`, сцена посадки с коммитом в кадре контакта, место города в трёх хостах, строка журнала, тайл в прогнозе эффектов («⚡ Сработает» для Pets / Tharsis), проекция ПО «свои города с `where`» в композере и в счёте | своя КЛЕТКА: строка в `expansionSpaceColonies.ts` + id в `SpaceName` + `HOSTED_SPACES` (`common/boards/hostedSpaces.ts`) + запись в `specialCellInfo.ts`; писатель связи — ТОЛЬКО `ColoniesHandler.placeCityOnColonyTile` (гард единственного писателя); тайл НЕ города (TR27) — свой арт прокси (`artClass`) и своя запись глифа; контракт — `docs/TURMOIL_REDUX_NOVA_CITY.md` §9 |
| карта (или CEO) платит «ВСЕ ВАШИ БОНУСЫ КОЛОНИЙ» (TR23 «Наука обитаемости»; Productive Outpost и Ивонн уже на слое) — три вызова в файле карты: `gainAllColonyBonuses(player, {via: this.name})` в действии / розыгрыше и `allColonyBonusesLedger` + `allColonyBonusesEffects` в превью (`singleBranch(…, {colonyBonuses})`). Даром: порядок выплаты очереди движка и его чтение (`payoutPhase`), счёт ПО КУБУ с ординатой «n из k», атрибуция `via` на доборе / цели / сбросе (сброс несёт источник-карту + `colonyRepeat`, НЕ `colonyBonus`), единственный держатель показан шагом, названный пропуск без держателя, реестр в композере действия (строка на плитку, слово шага, «× N» при двух кубах), сцена «реестр платит» (строки по очереди из своего значка, добор и сброс слоями в зоне workspace, такт чтения, уход на поле), заявка исхода по `via`, крошка «… › БОНУСЫ КОЛОНИЙ / ДОБОР КАРТ / СБРОС», восстановление из парка (`docs/TURMOIL_REDUX_HABITAT_SCIENCE.md`) | причины недоступности действия карты (`actionUnavailableReason` — «нет своих колоний» общий ключ есть); `times` — множитель строки (Ивонн); реестр в композере РОЗЫГРЫША не построен (носитель на превью есть) — карта с этим правилом ПРИ РОЗЫГРЫШЕ получает прежнюю сцену; бонус-выбор (платное вскрытие) и поздняя цель встают своим обычным экраном; свой порядок выплаты / свой цикл по колониям / свой `DiscardCards` в карте — запрещены |
| карта ОТВЕЧАЕТ НА ШАГ ШКАЛЫ, кто бы его ни сделал («каждый раз, когда Венера терраформирована на 1 шаг» — TR24 «Венерианская перепись»; Aphrodite на том же хуке) — в файле карты `onGlobalParameterRaised(cardOwner, raise)` (своя выплата за `raise.steps` + `recordScaleStepReward(owner, this, raise, gain)`) и `grantForecast` на `{kind: 'global'}`. Даром: ОДИН диспетчер `Game.globalParameterRaised` в позиции Aphrodite для трёх шкал (любой игрок, MarsBot, Солнечная фаза, мировой ход резолюции; понижение и ноль шагов — нет), атрибуция владельца (`effect-triggered` / «вы получили»), прогноз в ШАГАХ у каждого места («⚡ Сработает» в композере карты, поднимающей шкалу), запись кольца `scaleStepRewards` и сцена «ШАГ ШКАЛЫ ПЛАТИТ» (жетоны рождаются у маркера после его прибытия, тики на касаниях, член слива парка — крышка 8 % ждёт последнего касания) у себя и у соперника (`docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md`) | выплата не ресурсом карты и не стоком (производство, РТ) → новая форма `ScaleStepRewardGain` и её адрес в сцене; выплата С ВОПРОСОМ — не этот путь; реакция только на СВОЙ наградной подъём — старый `onGlobalParameterIncrease` (его прогноз — тот же `grantForecast`, проход шкалы спрашивает только поднимающего) |
| карта СТРОИТ КОЛОНИЮ, СНИМАЯ ПРАВИЛО ДВЕРИ (TR25 «Эксклюзивная колония»: «даже если у вас там уже есть колония» / «даже если на плитке 3 колонии») — общий шаг `new BuildColony(player, {allowDuplicate?, ignoreLimit?, title, cause: {kind: 'card', card}, canAffordOptions?})` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview` + `bespokeCanPlay` по `step.hasCandidate()` / `unplayableReason` по `NO_COLONY_TO_BUILD_ON_REASON`. Даром: одна причина на плитку в порядке двери, маркер `buildSites` (причал, «сверх лимита», свои кубы), бонус причала `buildBenefitAt` (четвёртый — последняя напечатанная клетка), единственный писатель кубов `Colony.placeCube`, строка журнала «сверх лимита», staged-дверь «Выбрать колонию» → сетка с призраком куба в причале маркера → стейдж `build` → ОДИН POST с адресованным `colony`-хвостом и ответами шагов бонуса, причал сверх лимита в трёх хостах (модель мест), такт ДОПУСКА перед кубом, продолжение награды в зоне стейджа, «домой» и квитанция сетки, названный пропуск, прогноз «колония построена» (`grantForecast` на `{kind: 'colony'}` — Poseidon) (`docs/TURMOIL_REDUX_EXCLUSIVE_COLONY.md`) | свой `SelectColony` / `addColony` / push в массив кубов в файле карты (гард единственного писателя упадёт с именем файла); сырое `build.quantity[…]` (гард-сканер); снятие ДРУГОГО правила двери (неактивная плитка, РТ) → новый флаг `BuildDoorOptions` со своей причиной и статусом кандидата; перевод декларативной карты-строителя (`behavior.colonies.buildColony`) на staged-дверь — строка в её файле, сама по себе карта остаётся на прежнем пути; реактор `onColonyAddedByAnyPlayer` вне скоупа → близнец `grantForecast` в его файле (сегодня честное `unknown`) |
| ДЕЙСТВИЕ карты даёт ПРЯМОЙ РТ (TR28 Earth Army Contract; UNMI, Caretaker Contract, Equatorial Magnetizer) или его печатный ряд — ТАЙМЛАЙН на своей карте («+N сюда, затем −M отсюда : …» — TR28) — в файле карты только честное превью: чипы в ПЕЧАТНОМ порядке (`cardGain`, `cardCost(card, M, c + N)` — трата читается от счёта, который оставил собственный +N, `trGain`) и ОДНО чтение состояния для превью и исполнения (образец TR28 `activationAt`; исполнитель откладывает декларативный `addResources` — условную половину ставить в очередь за ним). Даром: `ActionCommitKind 'rating'`, жетон РТ из печатного значка на рельс через `railReward` (посев против диффа в apply-блоке, тик на касании, ячейка ПО с ним, ответ стола тактом после), таймлайн из звеньев (капсула героя c → c + N → c + N − M, трата тикает на отлёте, workspace стоит, пока карта — цель или источник), один чип таймлайна в композере и детали «Действий карт» (`docs/claude/console/workspace-band.md` § ACTION COMMIT) | РТ, который принадлежит тайлу или шкале впереди, — НЕ этот путь (он приходит с ними); трата с собственной капсулы БЕЗ выигрыша перед ней (Nitrite / Titan Air-scrapping) — пока прежний путь (PL-064); РТ розыгрыша (`behavior.tr`) — не переведён (PL-001 для розыгрышей) |

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
