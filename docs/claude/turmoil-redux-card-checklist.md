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
  `turmoilRedux`; красный = имя карты).
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
| превью розыгрыша и действия, причины недоступности, прогноз эффектов, блок эффектов и «Spent as payment», структурный текст (`metadata.information`), капшены из `behavior`, сериализация `resourceCount`, коммит действия в консоли (полёт ресурса в капсулу карты по узлу `res-<ресурс>`), бейдж «N M€ · <контекст>» в спутнике ДОП. РЕСУРСЫ (если ресурс — платёжная единица) | бесподобный `play`/`action` → хуки превью/причин в файле карты; ТРИГГЕР (`onCardPlayed` / `onCardPlayedByAnyPlayer` / `onResourceAdded` / `onProductionGain` / `onTilePlaced`) → близнец прогноза (`cardPlayedForecast` / `grantForecast` / `tilePlacedForecast`) в файле карты тем же предикатом, что живой хук (образец TR05: `forecast.exact` + `actionPreviews.cardGain`; гарды `effectForecastCoverage` / `effectForecastParity`); НОВЫЙ ресурс карт → `CardResource` + спрайт `assets/resources/<name>.png` + `@card_resource_types` (cards_v2.less) + `@resource_types` (resources.less) + `cardResources.ts` + `CardListModel.ts` + `ICON_NEEDLES` (commit-motion) + множественное в `ConsoleExtrasExplorer.vue` + `"<Name>"`/`"<Names>"` в `console.json`/`ui.json`; НОВАЯ платёжная единица → тропа `mechs` (`docs/TURMOIL_REDUX_EVA_MECHS.md` §3) |
| требование СУЩЕСТВУЮЩЕГО вида (метки, параметры, «делегаты на резолюциях», «метки одного вида») — причина с «сейчас», чип, строка правил, счётчик руки | НОВЫЙ вид требования → тропа `e68e8db190` (TR02; повтор — TR01 `3f70200dec`), 8 точек: `RequirementType`, поле дескриптора + `requirementType()`, `CardRequirements.compileOne`, класс `<Kind>Requirement`, `Card.populateCount`, строка `buildCardInformation.requirementBlock`, причина + `FULLY_RESTATED_REQUIREMENTS`, клиент `REQUIREMENT_RENDER` + `COUNT_MESSAGE_LABELS`. Причина — `type: 'count'`, НЕ `'tag'`: `reasonParams` при заданном `tag` подменяет число именем метки. Счёт меток — только через `tagRequirementScore` / `Tags.tagTypesInPlay` |
| карта СТАВИТ ДЕЛЕГАТА на резолюцию (± нейтральные в Народную поддержку её партии) — общий шаг `PlaceDelegatesOnResolution(player, n, {kind: 'card', card}, {support?})` из `bespokePlay` + `actionPreviews.delegateGrantStep(card, step.previewSelectParty())` и `delegateFromReserve` в `cardPlayPreview`: staged-дверь «Выбрать резолюцию», режим голосования в зоне руки, блок «НАРОДНАЯ ПОДДЕРЖКА», посадка куба и нейтральных, адресованный `party`-хвост, три исхода коммита, события `delegates-placed` / `popular-support-gained`, названный пропуск (`docs/TURMOIL_REDUX_POLITICAL_DONATION.md`, TR03) | второй `SelectParty` / свой `placeVote` в файле карты (запрещено); карта с `count > 1` → сперва провести счёт в staged-проекцию (`viewer.vote.projections` считаны для ОДНОГО делегата — §8 документа TR03); выбор числа поддержки игроком (решение владельца: «сколько влезет») |

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
