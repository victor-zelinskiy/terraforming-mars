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
| карта-ПРИЧАЛ («when you trade, you can send the trade fleet to this card to …» — TR06 / TR26 / TR27): `fleetDock: FleetDock` в файле карты (`rewardBlockedReason?` · `previewEffects` · `previewFollowUps?` · `receive`) + `data: {dockedGeneration: -1}` — назначение торговли на пике всех дверей (маркер `fleetDocks`, ответ `{fleetDock}`), гейт торговли, превью `?dock=`, событие `fleet-docked`, колонка «ПРИЧАЛЫ» и стейдж причала, полёт на ▲ лица, знак флота на лице, холд сцены и уход в размещение (`docs/TURMOIL_REDUX_WATER_HAULING.md`, TR06) | награда с ВОПРОСОМ (TR27: цель аэростатов) → `cardTarget` в `previewFollowUps` + шаг цели на стейдже причала (сегодня стейдж пре-собирает только плату — §9 документа); награда без размещения (TR26) → сцена причала не заканчивается размещением: концовка обычной торговли, холд не нужен |
| карта СНИМАЕТ НАРОДНУЮ ПОДДЕРЖКУ выбранной партии (TR12) — общий шаг `DiscardPopularSupport(player, cause, then?)` из `bespokePlay` (`then` — следующий печатный эффект, в том же ответе) + `actionPreviews.supportDiscardStep(card, step)` в `cardPlayPreview`: маркер `supportPrompt` на шесть областей, staged-дверь «Выбрать партию», режим Парламента `support`, адресованный `party`-хвост, событие `popular-support-discarded`, два такта на одной позе, названный пропуск при пустых областях (`docs/TURMOIL_REDUX_PARTY_SANCTIONS.md`); требование «председатель» — вид `CHAIRMAN` ЕСТЬ, причина названа | свой `SelectParty` / `discardPopularSupport` в файле карты (запрещено); «добавить поддержку выбранной партии» без резолюции → новый `source` у `supportPrompt` + строка `SUPPORT_STEP_STAGES`, не второй режим |
| карта ВЫБИРАЕТ ТРЕК КОЛОНИИ и ставит маркер на максимум — общий шаг `MaximizeColonyTrack(player, cause)` из `bespokePlay` + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: кандидаты/отказы/проекция `trackMoves` с сервера, staged-дверь «Выбрать колонию», сетка колоний шагом в зоне руки с проекцией «+N», стейдж `track`, адресованный `colony`-хвост, холд из диффа и ОДИН глайд (`stage` · `rail`), событие `colony-track-moved`, названный пропуск; максимум — только `trackTop(metadata)` (`docs/TURMOIL_REDUX_COLONY_SPONSORS.md`, TR07) | свой `SelectColony` / прямая запись `trackPosition` в файле карты (запрещено); сдвиг НЕ на максимум (на N шагов) → второй режим шага с той же проекцией `trackMoves`, не вторая функция; сдвиг ВНИЗ → отдельное решение (сегодня шаг только вверх) |
| карта ВСКРЫВАЕТ верхнюю карту колоды и проверяет её (TR13) — `drawOrThrow` → `events.recordCardReveal` → `actionReveals.recordReveal(…, check, destination)` ДО сброса + превью `reveal: {check, reward, keepsCard?, pool?}` в `actionPreview`: композер «ПРОВЕРКА» + состав, вердикт, на «ОК» карта летит в док / в сброс, ресурс запаса — на рельс (`docs/CONSOLE_BLUE_ACTION_PARITY.md` ит. 27); «требование партии» — только `hasPartyRequirement` | проверка НЕ метки и НЕ требования партии → новый `RevealCheckIcon` + глиф; карта, ушедшая не в руку и не в сброс → новый `RevealDestination` + ветка `runRevealHandoff`; «ищи до совпадения» — это `drawCard({include})`, другая семантика |
| карта ставит ГОРОД, «ИГНОРИРУЯ ПРОЧИЕ ОГРАНИЧЕНИЯ РАЗМЕЩЕНИЯ» (TR16; TR19 — без соседства) — `cityIgnoringRestrictions(player, {adjacentToOwnCity?}, canAffordOptions?)` + `cityIgnoringRestrictionsReasoner` (`boards/ignoreRestrictionsCity.ts`): земельный набор движка (`getAvailableSpacesOnLand` — океан, Ноктис, лагерь кочевников, чужой Land Claim остаются закрытыми, незащищённая опасность — покрываема) без одного запрета «не рядом с городом»; один набор и одна причина клетки для `bespokePlay` и staged-превью (`placementPreview({staged: {spaces, placementType: 'city', reasoner}})`), причина `not-adjacent-to-your-city`; заголовок промпта называет снятое правило (досье печатает его строкой действия) | свой набор клеток в файле карты; снятие чего-либо, кроме запрета соседства городов; `Board.canPlaceTile` вместо земельного набора (пускает на чужой Land Claim, не пускает на опасность) |
| карта МЕНЯЕТ СОСТАВ ПЛИТОК КОЛОНИЙ — заменяет пустую плитку (TR10), добавляет (Aridor) или убирает: общий шаг `ReplaceColonyTile(player, cause, {build, canAffordOptions?})` из `bespokePlay` (или `ColoniesHandler.seatColonyTile` / `retireColonyTile` / `addColonyTile({cause})`) + `actionPreviews.colonyPickStep(card, step)` в `cardPlayPreview`: маркер `rosterChange` (кто может уйти и почему нет, как войдёт каждая плитка резерва, встанет ли колония), четвёртая форма ответа `{colonyName, replaces, stagedFor}`, staged-дверь «Выбрать плитку», уровни стол → резерв → стейдж `roster`, церемония состава гейтом транспорта, LANDING в слот, событие `colony-roster-changed` и строка журнала, названные пропуски (`docs/COLONY_ROSTER_CEREMONY.md`, TR10); требование «поколение ≥ N» — вид `GENERATION` ЕСТЬ | свой `SelectColony` / запись `game.colonies` в файле карты (гард единственного писателя упадёт с именем файла); замена ДВУМЯ промптами (стол с дырой); «плитка из игры навсегда» → новое сериализуемое поле; постройка на входящую плитку НЕ игроком карты → новая опция шага |

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
