# Промт исполнителю · TR49 Cutting-Edge Design («Новаторская разработка») — красное событие, 2, Наука + Микроб + Событие, плашка Учёных: «Игнорируйте ВСЕ требования глобальных параметров при розыгрыше вашей следующей карты в этом поколении» · ГЛАВНОЕ — НОВЫЙ КЛАСС «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ» (взведённый эффект, который тратится следующей разыгранной картой: Special Design ±2 к требованиям, Indentured Workers −8 M€, Conscription −16 M€, Ecology Experts / TR49 — требования игнорируются) + БОЛЬШАЯ ИТЕРАЦИЯ ПОЛИРОВКИ «ТРЕБОВАНИЕ ПОД ЭФФЕКТОМ»: игрок, выбирая карту на розыгрыш, ВИДИТ, какие такие эффекты взведены, видит их в списке «Эффекты» и в «Сработает», и везде, где напечатано требование карты, видит, что оно смягчено (±2 · источник) или снято (красная черта — язык самого скана)

Выдан 2026-10-15. Инфраструктура набора стоит (TR01–TR48, TR50–TR52, TR66 сданы; TR49 — последняя пропущенная) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§0 «Новая механика? — сначала её инфраструктура сквозным контрактом, потом карта»; §4 —
строки «требование СУЩЕСТВУЮЩЕГО вида» и «требование ПАРТИИ»; постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва;
**«Бесшовность — workspace-архитектура»**; **«Премиум-планка»**; **«Качество полировки»** — сильная рабочая концепция или откат, оба конца каждого
полёта ВИДИМЫ, сданное перепроверяется; **«Правило заимствованной поверхности»** — ответ стола без двери R3 «Эффекты» = дефект), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,
console-ui,animations,premium-card,client-ui,tests}.md` (законы: **WORKSPACE IS ONE FLOW**, **PHYSICAL CAUSALITY** — «каждое изменившееся число имеет
полёт или строку причины на том же экране», **No silent loss**, **Availability is server-authoritative** (инвариант 2 — клиент не выводит ни
правило, ни порог), **закон 27** — адрес pre-select, **все выборы — до коммита** (TR51), **A HOOK THAT ANSWERS IS NOT A HOOK THAT ACTS**),
контракты — `docs/claude/console/unavailability-reasons.md` (§ Requirement ATTAINABILITY — `effectiveCount`, «одна политика голоса»),
`docs/claude/console/effect-forecast.md` (законы 1–9 — ОДНА дверь R3, сервер авторитетен, честность `unknown`), `docs/claude/console/effects-explorer.md`
(семьи, зона, detail-слой), `docs/claude/console/hand-album.md` (плашки плитки, вердикт-бар, док), `docs/claude/console/play-card-result.md` (стадия
«Разыграно», категории результата), `docs/claude/console/information-workspace.md`, `docs/claude/cards/premium-card-renderer.md` (кассета
требований — живая модель), `docs/claude/cards/card-information-model.md`. Память: `card-availability-system` (ОДИН view-model, политика
`availabilityContextFor`, `effectiveCount` на стороне порога, «С учётом ваших модификаторов»), `requirement-rendering-standard` (кассета `.pcard__reqs`
— итерация 4 «плоский медный баннер»), `console-effects-explorer`, `start-hand-requirement-headup`, `unavailability-reason-engines`,
`card-face-needs-live-model`, `polish-premium-bar`, `polish-quality-no-regressions`, `storyboard-catches-what-the-probe-passes`,
`perf-measure-on-gpu-not-swiftshader`, `concurrent-session-edits-same-files`, `ab-baseline-head-client-in-snapshot`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-15, дословно):** «Тут главное — большая итерация полировок, в рамках которой надо доработать все такие карты, которые дают
временный эффект, который распространяется только на розыгрыш следующей карты — чтобы игрок чётко понимал, какие такие эффекты активны, когда
выбирает карту на розыгрыш (и чтобы они отображались в списке эффектов и можно было перейти и осмотреть в «Сработает») — это надо ввести как НОВЫЙ
КЛАСС эффектов на один розыгрыш. Уже есть подобные карты, которые дают изменение требования к глобальным параметрам на +2/−2 на следующую
разыгрываемую — там тоже игроку должно быть во ВСЕХ местах, где отображается требование, видно, что оно подвластно эффекту (проработать премиум-подачу).
Надо учесть все подобные карты в скоупе и хорошо проработать. А новая карта даёт вообще новый тип такого эффекта, который позволяет вообще
игнорировать глобальные параметры для следующей карты.»
Четыре требования: **(1) КЛАСС «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ»** — одна серверная модель взведённого эффекта (кто взвёл, что даёт, когда истечёт), которую
читают ВСЕ поверхности выбора карты; **(2) «ТРЕБОВАНИЕ ПОД ЭФФЕКТОМ» ВЕЗДЕ, ГДЕ ОНО НАПЕЧАТАНО** — кассета премиум-лица (рука, герой композера,
инспектор), плашка плитки руки, вердикт-бар и панель доступности, строка «ДЛЯ ВАС», строка требования композера — смягчено («≥ −14 → −18 · ±2 ·
Особая разработка») или снято (красная диагональ по кассете — графика самого скана TR49); **(3) ВЗВЕДЁННЫЙ ЭФФЕКТ — В «ЭФФЕКТАХ» И В «СРАБОТАЕТ»**:
плитка в обозревателе «ЭФФЕКТЫ» с осмотром источника, факт в прогнозе композера с дверью R3 и нотой «расходуется этим розыгрышем»; **(4) ВЕСЬ
СКОУП**: TR49 (снятие), Special Design (±2), Indentured Workers (−8), Conscription (−16), Ecology Experts (снятие в своём же прологе), Eccentric Sponsor
(−25 в прологе) — и те же поверхности для ПОСТОЯННЫХ смягчений (Inventrix, Adaptation Technology, Morning Star), потому что «требование под эффектом» —
один язык, а «один розыгрыш» — его признак. Решения — агент ищет сам; ниже диагноз и рекомендованная архитектура, финал — по кадрам 4K в батче.

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, файл:строка на `8d80433432` — подтвердить ДО правки):**
1. **Взведённый эффект на сервере — ОДНО поле и ни одного читателя-описателя.** `Player.lastCardPlayed :294` ставится на КАЖДЫЙ розыгрыш (`:1403`, кроме
   `PROXY`), гасится ТОЛЬКО пасом (`pass() :2027`) и физзлом Eccentric Sponsor (`EccentricSponsor.ts:84`); сериализуется (`SerializedPlayer.ts:92`) —
   взвод переживает перезагрузку. Все карты класса читают его сами: `Card.getGlobalParameterRequirementBonus :464–480` — декларативное
   `globalParameterRequirementBonus: {steps, parameter?, nextCardOnly}` (`common/cards/Types.ts:19–26`; Special Design `{2, nextCardOnly}`, Valuable Gases
   `{50, nextCardOnly}` — «50 ensures ignore»); бесподобные `getCardDiscount` с `if (lastCardPlayed === this.name)` — `IndenturedWorkers.ts:27–32` (8),
   `Conscription.ts:31` (16), `EccentricSponsor.ts:71–76` (25); `EcologyExperts.ts:36–42` — бонус требований 50 («magic number high enough to always
   ignore»); `LastResortIngenuity` — дорожки оплаты сталью / титаном через `Player.ts:1150–1165` (Pathfinders — вне скоупа); `DoubleDown.ts:41` читает
   `NEW_PARTNER` (prelude2 — вне скоупа). Сумма бонуса — `Player.getGlobalParameterRequirementBonus :779–793` (стол + `temporaryGlobalParameterRequirementBonus :378`
   (только пробник Ecology Experts `:59–67`) + политика Учёных sp02 (классический Turmoil — `PartyHooks.shouldApplyPolicy :35–54` через
   `Turmoil.ifTurmoilElse`; при политике Redux подтвердить, что всегда `false`) + жетоны Underworld `:631–637`). Скидки — ОДНА функция
   `Player.getCardCostBreakdown :1096–1140` с ИМЕНОВАННЫМИ источниками (`{kind: 'card', card}` — прецедент класса «цена названа»); для требований
   именованного разбора НЕТ: `GlobalParameterRequirement.effectiveThreshold :34–37` отдаёт только ЧИСЛО.
2. **«Игнорировать» сегодня — ЛОЖЬ числом.** Бонус 50 превращает «требования игнорируются» в «порог 56 %» / «−114 °C»: `unplayableReasons.ts:79–85` пишет
   `effectiveCount` только для НЕВЫПОЛНЕННОГО требования, а панель печатает «С учётом ваших модификаторов: ${0}» (`cardAvailability.ts:146–151`,
   `console.json:830`) — с 50 там будет бессмыслица; рельс руки — `unplayableReasonCompact :176–193` (`bound = effectiveCount ?? printed`) печатает
   растянутый порог БЕЗ объяснения. Думающий танк / Aeron (`GlobalParameterRequirement.satisfies :41–66`) — мост ресурсами; при снятии требования
   мост не должен брать ни одной data (проверить: `super.satisfies` с бонусом 50 истинен ДО моста — верно, закрепить спеком).
3. **Карта, ставшая играбельной БЛАГОДАРЯ эффекту, не объясняется НИГДЕ.** Сервер отдаёт ноль причин (`unplayableReasons.spec.ts:208–243` — взведённая
   Special Design = «zero reasons»), рука читает голое «Можно разыграть» (`ConsoleHandSection.vue:399–401`), `buildZoomAvailability :408–423` при
   играбельной карте отдаёт `undefined` (панели нет), панель правил печатает печатное требование без пометки (`ConsoleShell.vue:1083–1089`,
   `zoomCoveredRequirements :9941–9943, 10256–10275` гасит правило только при НЕВЫПОЛНЕННОЙ причине). Якорь от правила к кассете ЕСТЬ:
   `ConsoleCardRulesPanel.vue:257–258` (`req:` → `.pcard__reqs`) — тянуть к нему.
4. **Кассета требований премиум-лица ПЕЧАТНАЯ.** `PremiumRequirementsBar.vue:72–77` — единственный проп `requirements: NormalizedRequirement[]`;
   `premiumCardViewModel.ts:37–60` (модель без порога), `:237–308` (`normalizeRequirement` от дескриптора), `:401–439` (`buildPremiumCardViewModel(clientCard,
   model?)` — живая `model` кормит ТОЛЬКО цену `:214–221`, метки и ресурсы; `:420` требования — от печати). Хосты с живой моделью: плитка руки
   `ConsoleHandSection.vue:275`, герой композера `ConsolePlayCardConfirm.vue:74`, зум `CardZoomCard.vue:47`. Единственный живой ридаут лица —
   `PremiumCostBadge.vue:10–16`: безымянный чип «−N» (взведённые Indentured Workers = анонимные −8).
5. **Рука: плашки и чипы не знают класса.** `countedPlay.ts:48–75` `handForecastPlate` читает ТОЛЬКО `CardModel.agendaWalk` / `countedPlay`;
   `handTenderPlate.ts:39–68` — цена + `lastCardPlayed` только ради LRI (`:58`); `consoleHandGrid.ts:316–349` `shortBlockerLabel` — первая причина;
   `ConsoleShell.vue:6748–6783` `handEntriesAll` (`playable` / `potential`); вердикт-бар `ConsoleHandSection.vue:371–437`; шапка «Можно разыграть: N» `:56`
   (`playableCount :1101–1110`); док `ConsoleHandDock.vue:170–172, 263`. Инспектор «ДЛЯ ВАС» (`ConsoleShell.vue:9957–9969`,
   `consolePlayCardComposer.ts:456–477`, ключ «For you» в `ui.json:69`) — только ходьба и счётный розыгрыш.
6. **Композер: требование и взвод невидимы, скидка — безымянна.** `ConsolePlayCardConfirm.vue:1782–1800` — `requirementReason` только как причина
   блокировки ветки (`consolePlayCardComposer.ts:594–627`), строки требования у композера НЕТ; панель оплаты `ConsolePaymentPanel.vue:22–37` — «ЦЕНА base → final
   · −saved» без источников («источники — в слое R3» по комментарию `:26–27`); `effectForecastModel.ts:374–381` `discountTail {base, final, saved}`;
   `EffectForecastModel.ts:142–223` — члены `facts / byBranch / discounts / paymentValues / coverage`, **члена «смягчение требования» нет**; сервер
   `effectForecast.ts:885–898` `discountsOf` берёт `getCardCostBreakdown` (взведённые Indentured Workers В слое R3 — как «Эффект этой карты»,
   `ConsoleEffectsExplorer.vue:1094–1107`, досье «${0} lowers the printed cost · At payment» `:1230–1238` — ни слова «один розыгрыш»);
   `warningSteps :295–300` — только пропуски (`skippedEffectViews :1844`): **нота «этот розыгрыш израсходует взведённый эффект, который этой карте не
   нужен» не существует**. Превью карты БЕЗ `behavior` (Special Design, TR49) — `cardPlayPreview.ts:165–171` «dynamic, confirm-only, effects: []» —
   композер взводящей карты НЕ называет, что она взведёт.
7. **«ЭФФЕКТЫ» InfoPanel: событие на столе есть, строки нет.** `ConsoleInfoMode.vue:293–305` (`ConsolePartyEffectsStrip :298` — ПРЕЦЕДЕНТ полосы
   не-карточных эффектов над обозревателем; `<ConsoleEffectsExplorer :cards="viewed.tableau">` `:301`; зона `:149–161` «No passive effects», счётчики
   `:715–717`); `effectsExplorerModel.ts:26–36` семьи, `:92–112` лестница семьи, `:362–383` `effectsZoneCounts`; `effectExtraction.ts:251–287`
   `collectEffectNodes` — только `effect()`-узлы / корп-бокс, `:366–375` `playerEffects(tableau)` без фильтра типа. `PublicPlayerModel.tableau` ВКЛЮЧАЕТ
   события (`ServerModel.ts:696` → `PlayedCards.asArray`, `PlayedCards.ts:73, 152–156`), но у Special Design (`b.plate('Global requirements').colon().text('+/- 2')`),
   Indentured Workers (`text('next card').colon().megacredits(-8)`), Conscription узла `effect()` нет — ни строки, ни счёта. Постоянные смягчения
   описаны курируемыми нотами `effectSummary.ts:423–437` (`ADAPTATION_TECHNOLOGY`, `INVENTRIX` — «a rule bonus, not a tally»; RU `ui.json:13, 1104`).
   `CardModel.discount` — только печатный `cardDiscount` (`ModelUtils.ts:65–89`); бесподобные `getCardDiscount` оставляют `undefined`.
8. **Стадия «Разыграно» для события — лицом вниз и молча.** `consolePlayCardResult.ts:34, 94–128` — категории `action | effect | vp | tags | fallback`
   (розыгрыш Special Design показывает «Метки события», `ui.json:1299`); `consolePlayedHero.ts:134–180` — без поля анонса; `ConsolePlayedReceivingStage.vue:51–61`
   (событие садится лицом вниз), `:100–103` (подпись — семья + счёт); `ConsolePlayedEventsPile.vue:1–25`. «Взведено на следующую карту» — КАТЕГОРИИ нет.
9. **Модель клиента.** `PublicPlayerModel.lastCardPlayed` (`PlayerModel.ts:115`, `ServerModel.ts:669`) — единственный сигнал; читатели —
   `paymentPlan.ts:131–181`, `handTenderPlate.ts:58`, `ConsoleTaskHost.vue:1906–1908`, `ConsolePlayCardConfirm.vue:1118` — все ради LRI. Прецедент
   «добавка, не напечатанная нигде, едет СВОИМ полем с именованным источником» — `TagBonusModel` (`PlayerModel.ts:29–47, 185–191`, R&D Funding).
   `ClientCard` не экспортирует `globalParameterRequirementBonus` вовсе.
10. **Журнал / события.** Скидка — строка «saved N M€ playing with X» (`Player.ts:1405–1414`) + событие `discount-applied` (`EventRecorder.ts:819`);
    смягчение / снятие требования — НИ строки, НИ события: розыгрыш «благодаря Особой разработке» ничем не отличается от обычного ни в журнале, ни у
    соперника, ни в статистике эффектов.
11. **Playwrights (community, вне скоупа — назвать, не чинить):** `Playwrights.ts:54–80` держит скидку переигранного события через `removedFromPlayCards`
    (`getCardCostBreakdown :1109–1118`), а бонус требований — через `SpecialDesignProxy` в `playedCards` (`:76–77`); `getGlobalParameterRequirementBonus`
    ходит ТОЛЬКО по `tableau` → переигранный TR49 не взводит ничего. Гэп класса — строка реестра.
12. **Тесты-опоры:** `unplayableReasons.spec.ts:159–270` (attainability, `effectiveCount`, взведённая Special Design не расходуется проверкой),
    `cardDrawRevealAvailability.spec.ts:52–106` (Inventrix / Adaptation / временный бонус — один оценщик для руки и для reveal), `SpecialDesign.spec`,
    `IndenturedWorkers.spec:17–40` («until next card played», «change in generation disables»), `cardAvailability.spec.ts`, `consoleCardAvailabilityPanel.spec.ts`,
    `effectFamilyCoverage.spec.ts` (корпус семей), `effectForecastCoverage` / `effectForecastParity`, `cardPlayPreviewCoverage`. E2e: `console-card-availability`
    (вердикт-бар `.con-hand__reason--bar :72–77`, колонка зума), `console-reveal-availability:225–280` (Inventrix ±2: `effectiveCount` на модели, рельс
    `/${effectiveCount}`, `.con-cardavail__mods`), `console-effect-forecast:31, 67, 237–239, 483–496` (Indentured Workers как `FREE_PRINTED_CARD` — печатный 0,
    НЕ взведённые; хвост скидки), `console-parliament-heat:233–249` (голова оплаты + R3 называют ЗАКОН — прецедент именованного источника),
    `console-effects-explorer`, `console-play-landing-geometry:69–73` (Special Design как посадка события, фикстура `solo-actions`), `console-start-availability`,
    `console-potential-availability:182–183`. Фикстуры с картами класса: Special Design в руке — `solo-actions.json` / `solo-pre-endgame.json` ([5]),
    `mu-research-colony.json` ([12]); Indentured Workers — `effect-forecast.json` ([7], `generate.ts:633`); Inventrix на столе — `hydro-terminal*.json`;
    Adaptation Technology лежит в [1] ≈ 150 Redux-фикстур СЛУЧАЙНО (стандартная рука генератора) — в каждой из них постоянное смягчение ВИДНО → регрессия
    всех спеков руки на своём снапшоте обязательна.
13. **Слова:** «Special Design» → «Особая разработка» (`cards.json:662`) — сестра по имени; «Cutting Edge Technology» → «Новейшие технологии» (`promo.json:42`,
    ЗАНЯТО), «Advanced Alloys» → «Передовые сплавы», «Hi-Tech Lab» → «Передовая лаборатория»; «Global requirements» → «Глобальные параметры» (`UI_cards.json:92`);
    «Play a card from your hand, ignoring its global requirements.» (`card_info.json:223`, Ecology Experts); «With your modifiers: ${0}» (`console.json:830`);
    «Will trigger» → «Сработает» (`:1063`), «Nothing will trigger» (`:1088`), «Effect of this card» (`:1090`), «Discounts and payment» (`:1066`); «For you» → «Для
    вас» (`ui.json:69`). Глиф «игнорировать требования» в DSL ЕСТЬ: `CardRenderItemType.IGNORE_GLOBAL_REQUIREMENTS` ← `b.projectRequirements()`
    (`CardRenderer.ts:658`; Ecology Experts `:30`, Valuable Gases `:29`) — это и есть печатный ряд скана. Лор ПРИДУМАН (`turmoil-redux-invented-lore.md:23`:
    «Engineered for a planet that doesn't exist yet.» / «Спроектировано для планеты, которой ещё нет.» — «ждёт карту» → «в коде»). **Арта
    `Mars Arts/TR49.png` НЕТ** (есть TR47, TR52) — попросить владельца в начале. `CardName` — между `SUPERCOMPUTER` (`:1122`) и `EXPEDITION_MECHS` (`:1123`);
    манифест — между TR48 (`:258`) и TR50 (`:261`).
14. **Реестр:** последний раздел AK (PL-340…343); footer «Следующий свободный номер **PL-344**»; TR49 берёт раздел **AL** — номер и букву объявлять В МОМЕНТ
    записи (сосед активен — см. §0). Открытые строки на маршруте: PL-033 (события журнала без строк), безымянный «−N без источника» чипа цены лица.

**Обязательное чтение до кода:** `src/server/Player.ts:290–300, 365–380, 779–793, 1096–1140, 1370–1415, 2025–2030, 3200–3250`, `cards/Card.ts:50–60, 443–480`,
`common/cards/Types.ts`, `cards/requirements/{GlobalParameterRequirement.ts, CardRequirements.ts, InequalityRequirement.ts}`, `models/unplayableReasons.ts:30–140,
156–230`, `common/cards/UnplayableReason.ts:90–140`, `models/{effectForecast.ts:40–120, 883–923, cardPlayPreview.ts:110–200, ServerModel.ts:605–720, ModelUtils.ts:55–100}`,
`common/models/{PlayerModel.ts, CardModel.ts, EffectForecastModel.ts:130–230, ActionPreviewModel.ts}`, `events/EventRecorder.ts:800–840`, карты: `base/{SpecialDesign,
IndenturedWorkers, AdaptationTechnology}.ts`, `corporation/Inventrix.ts`, `colonies/Conscription.ts`, `prelude/{EcologyExperts, EccentricSponsor, PreludeCard}.ts`,
`pathfinders/{ValuableGases, LastResortIngenuity}.ts` (вне скоупа — образцы формы), `community/{SpecialDesignProxy, Playwrights}.ts`, `venusNext/MorningStarInc.ts`,
`turmoil/parties/{PartyHooks.ts:35–54, Scientists.ts:65–68}`, `underworld/UnderworldExpansion.ts:625–640`, `turmoilRedux/ScientificBreakthrough.ts` (шапка-образец:
красное событие с плашкой Учёных, чтение скана, правила спеком), `inputs/SelectProjectCardToPlay.ts`, `deferredActions/PlayProjectCard.ts`. Клиент:
`components/premiumCard/{PremiumRequirementsBar.vue, premiumCardViewModel.ts:30–60, 200–320, 395–440, PremiumCard.vue:40–50, 200–215, 340–355, PremiumCostBadge.vue}`,
`components/card/CardZoomCard.vue:40–50`, `components/console/{ConsoleHandSection.vue:50–60, 255–440, 820–950, 1095–1115, 1490–1500, ConsoleHandDock.vue:160–175,
255–270, ConsolePlayCardConfirm.vue:70–80, 180–300, 490–565, 1000–1140, 1775–1850, ConsolePaymentPanel.vue:15–40, ConsoleForecastRow.vue, ConsoleCardAvailabilityPanel.vue,
ConsoleCardRulesPanel.vue:240–270, ConsoleInfoMode.vue:140–165, 290–310, 710–720, ConsoleEffectsExplorer.vue:500–600, 1060–1110, 1225–1240,
ConsolePartyEffectsStrip.vue, played/{ConsolePlayedReceivingStage.vue, ConsolePlayedEventsPile.vue}}`, `components/console/ConsoleShell.vue:1035–1110, 6740–6790,
9935–9975, 10250–10280, 22310–22360, 22470–22490`, `console/{cardAvailability.ts, countedPlay.ts:40–80, handTenderPlate.ts, consoleHandGrid.ts:310–350,
consolePlayCardComposer.ts:450–480, 590–630, consoleForecastHost.ts, effectForecastModel.ts:370–430, 480–620, effectsExplorerModel.ts, consoleCardZoom.ts:250–440,
consolePlayCardResult.ts, played/consolePlayedHero.ts:130–180, paymentPlan.ts:125–185}`, `components/effects/{effectExtraction.ts:80–150, 250–290, 360–380,
effectSummary.ts:405–440}`, `components/handCards/unplayableReasonFormat.ts:85–100, 170–195`, `components/console/consoleCardRules.ts`. Тесты — диагноз 12.
Память: `card-availability-system`, `requirement-rendering-standard`, `console-effects-explorer`, `start-hand-requirement-headup`, `card-face-needs-live-model`,
`hand-pick-always-album`, `polish-premium-bar`, `polish-quality-no-regressions`, `storyboard-catches-what-the-probe-passes`, `perf-measure-on-gpu-not-swiftshader`,
`concurrent-session-edits-same-files`, `ab-baseline-head-client-in-snapshot`, `fixed-layer-is-a-stacking-context`.

Номера строк сняты с `8d80433432` — перед правкой перечитать.

**Что это за карта.** Красная (EVENT), **2**, метки **Наука + Микроб + Событие**, требование **Учёных**, без ПО: *«Requires the Scientists to be ruling or
that you have 2 delegates there. Ignore all global parameter requirements when playing your next card this generation.»*

**Оценивается — в этом порядке веса.**
1. **КЛАСС «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ» И «ТРЕБОВАНИЕ ПОД ЭФФЕКТОМ» — ВЕЗДЕ** (≈ 45 %) — одна серверная модель взведённого эффекта и одно чтение
   «требование под модификатором»; видно на ВСЕХ поверхностях выбора карты (полоса «ВЗВЕДЕНО» у руки, плашка плитки, кассета лица в трёх хостах, вердикт-бар
   и панель доступности, «ДЛЯ ВАС», строка требования композера, факт в «Сработает» с дверью R3, плитка в «ЭФФЕКТАХ» с осмотром); для TR49, Special Design,
   Indentured Workers, Conscription, Ecology Experts, Eccentric Sponsor; постоянные Inventrix / Adaptation Technology / Morning Star — тем же языком без
   признака «один розыгрыш»; «игнорировать» — КАК ВИД, никогда числом.
2. **КАРТА TR49** (≈ 20 %) — правила 1–14 спеком; взвод → снятие → расход — честно у игрока, у соперника, в журнале; превью = исполнение.
3. **ФИЗИКА ВЗВОДА И РАСХОДА** (≈ 20 %) — эффект ПОКИДАЕТ взводящую карту и САДИТСЯ в полосу «ВЗВЕДЕНО»; при розыгрыше следующей карты он уходит из полосы
   В кассету требований героя (штамп) / в голову цены (−N) — два полёта с видимыми концами, никакого «число изменилось само».
4. **Остальное** (≈ 15 %) — лицо, лор, локаль, §6.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Взвод** | `lastCardPlayed` — ставится на каждый розыгрыш `Player.ts:1403`, гасится пасом `:2027` / физзлом; сериализуется; публичен в модели (`PlayerModel.ts:115`) |
| **Бонус требований** | сумма `Player.ts:779–793` (стол + временный + sp02 + Underworld); карта — `Card.ts:464–480` (`nextCardOnly`), бесподобные EcologyExperts (50), Valuable Gases (50); порог — `effectiveThreshold :34–37` ЧИСЛОМ |
| **Скидка** | `getCardCostBreakdown :1096–1140` — ИМЕНОВАННЫЕ источники; Indentured Workers / Conscription / Eccentric Sponsor — `getCardDiscount` по `lastCardPlayed` |
| **Причины** | `effectiveCount` только при НЕВЫПОЛНЕННОМ требовании (`unplayableReasons.ts:79–85`); играбельная благодаря эффекту — ноль причин, ноль объяснения |
| **Кассета лица** | печатная (`PremiumRequirementsBar.vue:72–77`, VM `:420`); живая модель кормит только цену; чип цены «−N» без источника |
| **Рука** | плашки — `agendaWalk` / `countedPlay` / цена; «Можно разыграть: N»; вердикт-бар; `lastCardPlayed` читается только ради LRI |
| **Композер** | строки требования нет; скидка без источника в голове; R3 — «Эффект этой карты» без «один розыгрыш»; превью взводящей карты пустое |
| **«ЭФФЕКТЫ»** | только `effect()`-узлы; события класса — без узла → ни строки, ни счёта; полоса партий — прецедент не-карточной полосы |
| **«Разыграно»** | событие лицом вниз, «Метки события»; категории «взведено» нет |
| **Журнал** | скидка — строка + `discount-applied`; смягчение / снятие требования — ничего |
| **Арт / лор / имя** | арта НЕТ; лор придуман (`:23`); `CardName` между TR48 и TR50 |
| **Реестр** | footer **PL-344**; раздел **AL** (объявить в момент записи) |

### Чтение скана (`…\Projects\Card_-_TR49.png`)
Цена **2**, КРАСНАЯ рамка (EVENT). Плашка «MIN» у цены — **эмблема Учёных** (колба) = ТРЕБОВАНИЕ `{party: PartyName.SCIENTISTS}`, не метка. Метки справа, по
порядку печати: **Наука** (атом), **Микроб** (зелёный диск), **Событие** (жёлтый диск со стрелкой вниз — тип карты, не `Tag`). Название «CUTTING-EDGE DESIGN».
Один ряд: **значок «карта с требованиями» (тёмная карточка с планетой) · два квадратика-маркера · «GLOBAL REQS.» ПЕРЕЧЁРКНУТО красной диагональю · звёздочка** —
это печатный глиф апстрима «игнорировать глобальные требования» → `b.projectRequirements().asterix()` (сверить с рендером Ecology Experts / Valuable Gases: тот
же `IGNORE_GLOBAL_REQUIREMENTS`; если звёздочка глифа не рисуется — одним узлом DSL, не текстом). **Красная диагональ по «GLOBAL REQS.» — визуальный язык класса
«снято»: его наследует кассета требований (§2.2).** ПО нет. Цитаты НЕТ → лор из реестра. Внизу слева — фиолетовый ромб Turmoil (модуль, без `compatibility`;
▲ Колоний и значка Венеры НЕТ). Подпись арта — «marinebiodiversity.ca» (подпись арта, не лица). Номер «TR49».

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/CuttingEdgeDesign.spec.ts`; класс — своими спеками, §1)
1. **Требование** — плашка Учёных: правят или 2 СВОИХ делегата на их резолюции; при розыгрыше; TR36 порог ТРЕБОВАНИЯ не снижает (FAQ свода стр. 18–19).
2. **Розыгрыш ничего не даёт сразу — он ВЗВОДИТ**: после розыгрыша `lastCardPlayed = TR49`, и СЛЕДУЮЩАЯ карта этого игрока в этом поколении разыгрывается с
   СНЯТЫМИ требованиями глобальных параметров. Сам TR49 — обычное событие: в стопку событий, Media Group +3 M€, метка Науки события из счёта уходит.
3. **«Все требования глобальных параметров»** = каждое требование класса `GlobalParameterRequirement` — температура, кислород, океаны, Венера (и структурно
   лунные ставки — Луна вне скоупа), и MIN, и MAX, и «≤ 3 океанов». НЕ снимаются: метки, производство, РТ, города / колонии / ресурсы, партия, председатель —
   они не глобальные параметры. Снятое требование — ВЫПОЛНЕНО (не «растянуто на 50»): «Думающий танк» / Aeron Genomics не берут ни одной data (мост не
   спрашивается), `unattainable` не ставится, `additionalProjectCosts` пусты.
4. **Расход — следующая КАРТА любым путём розыгрыша** (из руки; из прелюдии «разыграйте карту с руки»; TR51 «вариант»), **независимо от того, нужен ли ей
   эффект** — семантика `lastCardPlayed` апстрима: Special Design, разыгранная после TR49, ТРАТИТ снятие (и взводит своё ±2). Стандартный проект, действие
   карты, конверсия — НЕ розыгрыш карты, не тратят (закрепить). Эффект, не истраченный до паса, ПРОПАДАЕТ (`pass()`); на следующее поколение не переходит.
   Композер следующей карты ОБЯЗАН сказать, что этот розыгрыш расходует взведённый эффект — особенно когда карте он не нужен (нота, не блок).
5. **Один взвод за раз**: `lastCardPlayed` — одно поле; новый розыгрыш ЗАМЕЩАЕТ взведённое (TR49 после Special Design — ±2 потрачено на TR49, взведено снятие).
   Полоса «ВЗВЕДЕНО» показывает ровно то, что истратит следующий розыгрыш.
6. **Превью = исполнение**: композер TR49 читает «ВЗВЕДЁТ: следующая карта — без требований глобальных параметров» (сам розыгрыш — батч `[play]`, follow-up'ов
   нет); композер СЛЕДУЮЩЕЙ карты — строка требования «[t°] ≥ 0 °C · печатно −20 °C · ИГНОРИРУЕТСЯ · Новаторская разработка» + факт в «Сработает» + нота расхода.
7. **Честность у СОПЕРНИКА**: розыгрыш TR49 — обычная нотификация розыгрыша; взвод виден в «ЭФФЕКТАХ» просматриваемого игрока (публичная модель — как
   `lastCardPlayed`); розыгрыш следующей карты «благодаря» — строка журнала / нотификация с источником (правило 10).
8. **MarsBot** карту не играет (у бота нет руки); его виды / ходы не меняются.
9. **Save / load**: `lastCardPlayed` сериализован — после перезагрузки полоса «ВЗВЕДЕНО» стоит, кассеты смягчены, композер честен (модель выводится заново).
10. **Журнал**: «${player} played ${card}» (движок) + при розыгрыше следующей карты, если хотя бы одно требование ВЫПОЛНЕНО ТОЛЬКО благодаря модификатору —
    строка «${player} played ${card} — its ${parameter} requirement waived by ${source}» / «… eased by ${source} (${printed} → ${effective})» + событие класса
    `requirement-eased` (источник, карта, параметр, печатно → эффективно | waived, `oneShot`) — журнал рисует строку под розыгрышем (роль `detail`, как «saved N M€»),
    нотификация соперника называет, статистика эффектов считает срабатывание источнику (Inventrix и Adaptation Technology тем же событием — класс «требование
    выполнено модификатором», не только «один розыгрыш»).
11. **Прелюдии класса** (Ecology Experts, Eccentric Sponsor): их «следующая карта» выбирается ВНУТРИ их же прелюдии (`PlayProjectCard` → хостимый альбом «Карты в
    руке» в стартовом workspace) — полоса «ВЗВЕДЕНО» и кассеты обязаны стоять и ТАМ (хост-агностичность, `consoleWorkspaceStack`); Ecology Experts переходит с
    «50» на ВИД «снятие» (решение 2), Eccentric Sponsor — на декларативную одноразовую скидку.
12. **Политика Учёных sp02 (классический Turmoil)** — подтвердить спеком, что при политике Redux (`game.politics`, без `game.turmoil`) `shouldApplyPolicy` = `false`;
    если нет — это ПОСТОЯННОЕ смягчение с источником `{kind: 'party'}` на тех же поверхностях.
13. **Метки**: Наука → Olympus Conference / Mars University / Pharmacy Union — вопросы стола ПРЕ-шагами (закон TR51); Микроб → Decomposers (+1 микроб), Splice;
    Событие → Media Group; прогноз называет всё до нажатия (`cardPlayedForecast` соседей — даром).
14. **Playwrights** (community, вне скоупа): переигранный TR49 не взводит — названный гэп в реестре, не чинить.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **RU-имя «Новаторская разработка»** (Grep — свободно; сестра «Особая разработка» = Special Design — одна семья слов; «Новейшие технологии» занято
   промо-картой). Альтернативы: «Передовая разработка», «Авангардный дизайн». Лор — из реестра придуманного (EN / RU выше).
2. **«Игнорировать» — ВИД, не число** (рекомендация): `GlobalParameterRequirementBonus.waive?: true` (с `nextCardOnly`) → `IPlayer.globalRequirementWaiver()`
   → `GlobalParameterRequirement.satisfies` выполнено до моста; `effectiveThreshold` для снятого — не число, а признак; Ecology Experts и TR49 — на виде,
   «magic 50» удаляется из карт (пробник `bespokeCanPlay` Ecology Experts — временный признак снятия, не +50; Valuable Gases вне скоупа — не трогать, но
   класс обязан его ВЫДЕРЖАТЬ структурно). Альтернатива (б): оставить 50 и научить все читатели «≥ 50 = снято» — отвергнуто: число-сентинел течёт в каждый
   новый читатель.
3. **Модель взведённого эффекта — ПУБЛИЧНАЯ** (`PublicPlayerModel.armedPlayEffects`, рекомендация: `lastCardPlayed` уже публичен, событие сыграно на столе,
   «ЭФФЕКТЫ» соперника читают его стол); чтение «требование под эффектом» ПО КАРТЕ — self-only, как `unplayableReasons` (`CardModel.requirementEasing`).
4. **Где живёт полоса «ВЗВЕДЕНО»** — концепция по кадрам 4K (агент снимает ДО / ПОСЛЕ на двух стендах: `special-design-armed`, `cutting-edge-design`):
   - **(а) У РУКИ (рекомендация).** Эффект — про СЛЕДУЮЩУЮ КАРТУ, значит стоит там, где карту выбирают: полоса над альбомом «Карты в руке» (шапка, рядом с
     «Можно разыграть: N») и его сжатый двойник в доке (чип «⚡ ±2» / «⚡ БЕЗ ТРЕБ.»); хостимый альбом (прелюдия) несёт её же; зеркало — плитка в «ЭФФЕКТАХ»
     (решение 5). Миниатюра источника + формула + «до следующего розыгрыша» + X «Осмотреть» (источник в полноэкранном просмотрщике).
   - **(б) В HUD** — чип в полосе статуса рядом с показателями: виден всегда, но далеко от решения; отвергнуто акцентом («когда выбирает карту»).
   - **(в) Только в «ЭФФЕКТАХ»** — отвергнуто: игрок не ходит туда перед каждым розыгрышем.
5. **«ЭФФЕКТЫ» InfoPanel**: секция-полоса «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» по прецеденту `ConsolePartyEffectsStrip` (над обозревателем, своя плитка на эффект,
   descend в detail с героем-источником, правилом и «истечёт: следующий розыгрыш / пас»), счётчик зоны «Активные» учитывает (рекомендация); альтернатива —
   строка внутри семьи `rules` (теряет «истечёт»).
6. **Кассета требований под эффектом** — концепция по кадрам 4K (три состояния на одном листе: печатное · смягчено · снято; хосты — плитка руки, герой
   композера, зум):
   - **(а) Рекомендация.** СМЯГЧЕНО: печатное значение стоит, рядом в той же кассете эффективное «≥ −14 **→ −18**» + компактный бейдж «±2» с
     эмблемой-инициалом источника (одна семья с бейджем `tagBonuses`); цвет — акцент кассеты, вес — читается без цвета. СНЯТО: по ВСЕЙ кассете красная
     диагональ в языке скана (`--waived`: `::after` под углом, не `filter`), значения приглушены, в правом торце штамп «ИГНОР.»; печатные значения остаются
     читаемы (игрок видит, что именно снято). ВЫПОЛНЕНО БЛАГОДАРЯ (decisive) — кассета дополнительно получает «галочку ✓» в торце (состояние = форма).
   - **(б)** Только бейдж в углу кассеты — отвергнуто: не говорит, ЧТО с числом.
   Кассета остаётся печатной у ЧУЖИХ карт и в журнале (нет живой модели — `requirementEasing` self-only).
7. **Нота расхода** в композере СЛЕДУЮЩЕЙ карты: «Этот розыгрыш израсходует «Особая разработка» (±2) — этой карте требование не нужно» — тон `info`, не
   блок (рекомендация; правило 4). Альтернатива — предупреждение-подтверждение: отвергнуто (ещё одно нажатие на пути).
8. **Событие `requirement-eased`** и строка журнала (правило 10) — рекомендация: да, классом (постоянные смягчения тоже).
9. **e2e: ОДИН новый спек** `tests/e2e/console-cutting-edge-design.spec.ts` (§4); соседи — переводом существующих (инвариант 14).
10. **Батч — ПЕРВЫМ после кадров концепций**, одним `AskUserQuestion` (≤ 4 вопроса, рекомендация первым): (1) полоса «ВЗВЕДЕНО» (решение 4) с кадрами;
    (2) кассета под эффектом (решение 6) с листом трёх состояний; (3) «игнорировать — вид» + публичная модель (решения 2–3); (4) строки «ждёт владельца» на
    маршруте (`grep` в момент батча).

---

## 0. Рабочее дерево
HEAD `8d80433432`. **СОСЕД АКТИВЕН** (сессия `terraforming-mars-cd`, незакоммичен footer реестра `docs/claude/gameplay-polish-ledger.md`). TR49 трогает
реестр, `Player.ts` / `ServerModel.ts` / `PlayerModel.ts` / `CardModel.ts` и общие клиентские файлы руки / композера — ListAgents + SendMessage соседу ДО первой
правки общих файлов (память `concurrent-session-edits-same-files`); его ханки — не в своих коммитах. Коммиты — только через временный индекс (`GIT_INDEX_FILE`
абсолютным путём; **read-tree → commit ОДНОЙ командой** при активном соседе; `git reset -q -- <свои пути>` после; ханки одного файла — НЕ `--unidiff-zero`),
`git add` своими путями; после коммита — `git restore --staged package.json package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr49`,
`TM_E2E_ROOT=.e2e-tr49`; 4K — `--workers=1` + `TM_E2E_GPU=1`; **тайминги — A/B на одном снапшоте, на тихой машине** (память
`ab-baseline-head-client-in-snapshot`). **Арт: попросить `Mars Arts/TR49.png` у владельца первым сообщением.**

## 1. Сервер
**Коммит 1 — КЛАСС «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ» (общий слой), без карты.**
(а) **Декларация — в файле карты, одного вида для скидки и для требования.** `CardDiscount.nextCardOnly?: boolean` (`common/cards/Types.ts`) → `Card.getCardDiscount
:443–462` честно читает его (как `getGlobalParameterRequirementBonus` читает свой) → Indentured Workers `cardDiscount: {amount: 8, nextCardOnly: true}`, Conscription
`{16, nextCardOnly}`, Eccentric Sponsor `{25, nextCardOnly}` — бесподобные `getCardDiscount` УДАЛЯЮТСЯ (их спеки — без изменения ожиданий; `ModelUtils.ts:65–89`
начинает отдавать `CardModel.discount` — проверить, что обозреватель «ЭФФЕКТЫ» НЕ зачисляет одноразовую скидку в постоянные: `nextCardOnly` едет в
`CardDiscount` клиента). `GlobalParameterRequirementBonus.waive?: true` (решение 2): `Card.getGlobalParameterRequirementBonus` для `waive` отдаёт 0, а НОВЫЙ
`ICard.waivesGlobalRequirements?(player): boolean` (базовая реализация в `Card` по декларации + `nextCardOnly` ↔ `lastCardPlayed`) читается ОДНОЙ функцией
`IPlayer.globalRequirementWaiver(): EventSource | undefined` (стол + `removedFromPlayCards` для паритета со скидками + временный признак пробника) →
`GlobalParameterRequirement.satisfies` возвращает `true` ДО моста Думающего танка; `effectiveThreshold` → `number | 'waived'`; EcologyExperts → `{waive: true,
nextCardOnly: true}`, `bespokeCanPlay` → `player.temporaryGlobalRequirementWaiver = true` в `try/finally` (поле `temporaryGlobalParameterRequirementBonus`
остаётся для совместимости, но ни одна карта скоупа его не трогает).
(б) **ОДИН читатель взведённого** `cards/armedPlayEffects.ts` → `armedPlayEffectsOf(player): ReadonlyArray<ArmedPlayEffect>` — карта `lastCardPlayed` (стол или
`removedFromPlayCards`) и её ОДНОРАЗОВЫЕ декларации: `{source: {kind: 'card' | 'prelude', card}, effect: {kind: 'requirementShift', steps, parameter?} | {kind:
'requirementWaiver'} | {kind: 'discount', amount} , expires: 'next-play'}`; бесподобная одноразовая механика без декларации (LRI — дорожки оплаты, вне скоупа)
— `ICard.armedPlayEffect?(player)` co-located. **Гард-ворклист** `tests/cards/armedPlayEffectCoverage.spec.ts`: каждая карта скоупа, чей исходник читает
`lastCardPlayed` (grep по `src/server/cards/**` в спеке — как `promptMarkerGuard`), обязана быть описана читателем (б), и описание ПАРИТЕТНО движку:
взведи (`lastCardPlayed = card`) → `getCardCostBreakdown` / `globalRequirementWaiver` / `getGlobalParameterRequirementBonus` дают ровно обещанное; сними —
ноль.
(в) **«Требование под модификатором» — ОДНО чтение по карте** `models/requirementEasing.ts` → `requirementEasingOf(player, card): ReadonlyArray<RequirementEasing>`
— для каждого `GlobalParameterRequirement` карты, когда у игрока есть ненулевой бонус по параметру или снятие: `{key: requirementKey (та же формула
`requirementBlockId`), parameter, printed, effective: number | 'waived', sources: [{source, kind: 'shift' | 'waive', steps?, oneShot: boolean}], decisive:
boolean /* сырым значением НЕ выполнено, с модификаторами выполнено */}`; источники — ИМЕНОВАНЫ (карта / корпорация / партия / жетон Underworld: разбор по
слагаемым `getGlobalParameterRequirementBonus` — вынести его в `requirementBonusBreakdown(player, parameter)` и заставить сумму читать разбор, чтобы два
чтения не разошлись); `effectiveCount` причин — ОТ ТОГО ЖЕ разбора (убрать второе вычисление в `unplayableReasons.ts:81`). Публикация: `CardModel.requirementEasing?`
на картах руки зрителя, `dealtProjectCards` / `draftedCards` / reveal'ов (все хосты `unplayableReasons` — один проход `cardsToModel`), `PublicPlayerModel.armedPlayEffects`
(решение 3), `GameModel` — ничего.
(г) **Прогноз**: `EffectForecast.easings?: ReadonlyArray<RequirementEasingFact>` (от (в) + `consumes: ArmedPlayEffect[]` — что ЭТОТ розыгрыш истратит, включая
ненужное — правило 4) — считается в `effectForecast.ts` рядом с `discountsOf`, дверь R3 рисует семьёй `rules`; `discounts.items` получают `oneShot: true`
для `nextCardOnly`-источников. `cardPlayPreview` взводящей карты: декларативная ветка карты БЕЗ `behavior`, но с `nextCardOnly`-декларацией — чип класса
`arms` («ВЗВЕДЁТ: …», `ActionEffect` нового вида, `certainty: exact`) — `declarativeCardPlayPreview :135–172` вместо «dynamic, effects: []» (гард
`cardPlayPreviewCoverage` берёт карты класса сам).
(д) **Событие `requirement-eased`** (правило 10, решение 8): в `Player.playCard` ДО `lastCardPlayed = selectedCard.name` — `requirementEasingOf(this, card)`
с `decisive` → `events` + строка журнала роли `detail` (как `:1405–1414`); пишется ОДИН раз, из розыгрыша, никогда из превью.
Спеки коммита 1: `armedPlayEffects.spec` (взвод / замещение / расход / пас / перезагрузка), `requirementEasing.spec` (shift / waive / decisive / источники /
паритет с `satisfies` и с `effectiveCount`; Think Tank при снятии — 0 data), `globalRequirementWaiver.spec`, регрессия `SpecialDesign.spec` /
`IndenturedWorkers.spec` / `Conscription.spec` / `EcologyExperts.spec` / `EccentricSponsor.spec` / `unplayableReasons.spec` (блок attainability — `effectiveCount`
прежний) / `cardDrawRevealAvailability.spec` / `effectForecast*.spec` / `cardPlayPreviewCoverage`.
**Коммит 2 — карта** `src/server/cards/turmoilRedux/CuttingEdgeDesign.ts`: `CardName.CUTTING_EDGE_DESIGN = 'Cutting-Edge Design'`; EVENT, 2, `[Tag.SCIENCE,
Tag.MICROBE]`, `requirements: {party: PartyName.SCIENTISTS}`, `globalParameterRequirementBonus: {waive: true, nextCardOnly: true}` — ВСЯ карта декларативна,
`bespokePlay` нет; `renderData` — `b.projectRequirements().asterix()` (чтение скана); `infoText` блок «Ignore all global parameter requirements when playing
your next card this generation.» (`tokens: ['ignore_global_requirements']` — образец `EcologyExperts.ts:24`) + RU; `description` с требованием. Шапка — чтение
скана + правила 1–14 + «лор придуман». Гарды §3 чеклиста: `cardPlayReplayCoverage` (батч `[play]`), `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`,
`effectForecastCoverage`, `promptMarkerGuard`, `requirementProse`, `make:cards` 0 / 0 / 0.

## 2. Клиент — ГЛАВНОЕ
1. **Полоса «ВЗВЕДЕНО» (решение 4)** — `console/armedEffects.ts` (чистый view-model от `armedPlayEffects` + источник-карта из стола; формула эффекта одним
   форматтером: «±2 к требованиям глобальных параметров» / «требования глобальных параметров игнорируются» / «−8 M€ к цене»; «до следующего розыгрыша») +
   `ConsoleArmedEffectsStrip.vue` в шапке альбома «Карты в руке» (рядом с «Можно разыграть: N»), хост-агностична (встроенный альбом прелюдии несёт её же),
   сжатый двойник в доке (`ConsoleHandDock` — чип), X «Осмотреть» → источник в полноэкранном просмотрщике (`openConsoleCardZoom`, контекст без availability),
   пусто — не рендерится (ни резерва высоты: высота строки шапки не меняется — гард `cardStatusContract`-класса). Плашка плитки руки — третий читатель
   `handForecastPlate` (`countedPlay.ts:48–75`): для карты с `requirementEasing` — плашка «[параметр] ±2» / «[параметр] ИГНОР.» (decisive — с ✓), приоритет
   над ценой-тендером решить по кадру.
2. **Кассета требований под эффектом (решение 6)** — `buildPremiumCardViewModel` читает `model.requirementEasing` → `NormalizedRequirement.easing?: {effective,
   sources, decisive, waived}`; `PremiumRequirementsBar.vue` рисует состояния `--eased` / `--waived` / `--decisive` (одни классы на всех хостах; `::after` диагональ
   по кассете в языке скана; бейдж «±2» одной семьи с бейджем `tagBonuses`); печатные значения остаются; `PremiumCostBadge` «−N» получает ИМЯ источника
   из `discounts.items` (PL-класс «число без причины») — через ту же живую модель. Гард: `premiumCardViewModel.spec` (три состояния), юнит бара, `lessDeadSelectorGuard`.
3. **Доступность** — `buildCardAvailability` получает `requirementEasing`: играбельная DECISIVE карта → вердикт «✓ Можно разыграть · благодаря ‹источник›»
   (новая строка `CardAvailabilityReasonView` тона `eased`, одна функция для рельса / line / panel); невыполненная — «С учётом ваших модификаторов» называет
   источники и «один розыгрыш»; `unplayableReasonCompact` для снятого — «ИГНОР.», никогда число; `buildZoomAvailability` для decisive карты ОТДАЁТ панель
   (сегодня `undefined`); панель правил: правило требования с `requirementKey` получает аннотацию «смягчено / снято» вместо подавления (якорь `req:` →
   кассета, `ConsoleCardRulesPanel.vue:257–258`); «ДЛЯ ВАС» (`zoomCardForYouAnnotations`) — третий читатель: «ТРЕБОВАНИЕ ПОД ЭФФЕКТОМ: ±2 · Особая разработка
   (один розыгрыш)» / «ТРЕБОВАНИЯ ИГНОРИРУЮТСЯ: Новаторская разработка».
4. **Композер розыгрыша** — строка «ТРЕБОВАНИЕ» в блоке РЕЗУЛЬТАТ / над оплатой (печатно · сейчас · эффективно · источник; снято — штамп), факты `easings` в
   «Сработает» и плитка в слое R3 (семья `rules`, досье: Why «‹источник› смягчает требование», When «При розыгрыше», «Один розыгрыш — расходуется этим
   розыгрышем»), скидка одноразовая — в группе «Скидки и оплата» с нотой «один розыгрыш» и ИМЕНЕМ в голове цены (`ConsolePaymentPanel` — «−8 · Наёмные
   рабочие»; правило PL-класса «число без причины»; закон 9 effect-forecast — ОДНА дверь), нота расхода (решение 7) в полосе `warningSteps` с тоном `info`.
   Композер ВЗВОДЯЩЕЙ карты (TR49, Special Design, Indentured Workers) — чип «ВЗВЕДЁТ: …» из превью (1 (г)); стадия «Разыграно» — категория `armed`
   (`consolePlayCardResult.ts`): подпись «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ: …» + **полёт**: с лица уходящего события (узел глифа `projectRequirements` /
   плашки «+/− 2» — `data-graphic-node`) чип летит в полосу «ВЗВЕДЕНО» руки (док — измеренный адрес; `transferWitness` знает его); при РАСХОДЕ — чип из полосы
   летит в кассету героя композера / голову цены на коммите розыгрыша (закон ACTION COMMIT: до результата, с откатом при отказе сервера).
5. **«ЭФФЕКТЫ» InfoPanel (решение 5)** — `ConsoleArmedEffectsSection` над обозревателем по прецеденту `ConsolePartyEffectsStrip` (`ConsoleInfoMode.vue:298`):
   плитка на эффект (миниатюра источника, формула, «до следующего розыгрыша»), descend в detail-слой обозревателя (хост-агностичный; герой-источник,
   правило, срок), счётчик зоны «Активные» (`effectsZoneCounts`) учитывает; у соперника — его взвод (публичная модель). Постоянные смягчения (Inventrix,
   Adaptation Technology, Morning Star) остаются в семье `rules` с курируемой нотой — но их ПЛИТКА получает ту же формулу «±2 к требованиям» и ту же
   досье-строку, что одноразовые (один язык).
6. **Соперник и журнал** — строка `requirement-eased` в журнале под розыгрышем (роль `detail`, чип источника), нотификация соперника «‹игрок› разыграл ‹карту› —
   требование снято «Новаторской разработкой»» (`notificationSemantics`), статистика эффектов (`effect-stats`) считает срабатывание источнику → в «ЭФФЕКТАХ»
   у Special Design / TR49 «Срабатываний: 1».
7. **Слова** (Grep перед каждым): «Armed for your next card», «Until your next card play», «Global requirements waived», «Global requirements eased by ${0}»,
   «Requirement eased: ${0}», «Requirements ignored», «Ignored», «One play only», «This play will spend ${0}», «${0} does not need it», «Playable thanks to ${0}»,
   «Arms: …»; RU — «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ», «до следующего розыгрыша», «требования игнорируются», «смягчено на ±2», «ИГНОР.», «один розыгрыш», «этот
   розыгрыш израсходует ${0}», «можно разыграть благодаря ${0}». Ключи взводящих карт апстрима не переписывать (инвариант 9).

## 3. Лицо, локаль, лор, арт
`renderData` (чтение скана — `projectRequirements` + звёздочка) → витрина EN / RU, миниатюра, рука, композер. Ключи — Grep по всем `src/locales/<lang>/*.json`
ПЕРЕД каждым (имя, описание, `card_info` капшены). Лор — `lore_texts.json` «TR49» + RU; реестр придуманного — «в коде». Арт — `node scripts/import-card-art.mjs
"C:/Users/zelin/Downloads/Mars Arts/TR49.png" TR49` + `npm run make:cards` (арта пока НЕТ — просить).

## 4. Тесты
Сервер — §1. Клиент: юниты `armedEffects` (формулы, пусто, источник), `premiumCardViewModel` (три состояния кассеты), бар требований, `cardAvailability`
(eased / decisive / waived compact), `consoleCardAvailabilityPanel`, `effectForecastModel` (группа easings, oneShot скидки), `effectsExplorerModel` (счётчик
зоны с полосой), `consolePlayCardResult` (категория `armed`); гарды `effectFamilyCoverage` / `effectSummaryCoverage` (карты класса — в корпусе), `glyphLiteralGuard`,
`lessDeadSelectorGuard`, `e2eLiveness`, `readingParamsGuard`. **e2e — ОДИН** `tests/e2e/console-cutting-edge-design.spec.ts` (fhd + **4K**, `--repeat-each=4`,
`TM_E2E_GPU=1`, state-waits, `TM_E2E_STORYBOARD=1`, свидетели `preselectGuard` / `transferWitness`; красный — второй клиент) с фикстурами (`parliamentFixture`,
Учёные — `seatEnacted(quietResolutionOf(SCIENTISTS))`, как `scientific-breakthrough`; второй клиент — корпорации без первого действия):
1. **`cutting-edge-design`** — температура −20, O₂ 2 %, рука: TR49, Lake Marineris (нужно 0 °C), Algae (без требований), Special Design. Маршрут: рука —
   Lake Marineris «✕ Нельзя разыграть · Температура −20/≥0 °C»; TR49 «Можно разыграть» (Учёные) → композер «ВЗВЕДЁТ: следующая карта — требования глобальных
   параметров игнорируются» → «A» → событие садится лицом вниз → чип летит в полосу «ВЗВЕДЕНО» (свидетель: оба конца) → рука: полоса стоит, Lake Marineris
   «✓ Можно разыграть · благодаря «Новаторская разработка»», кассета перечёркнута, плашка «ИГНОР.»; Algae — нота «израсходует» в композере; X на Lake Marineris —
   инспектор: панель доступности + «ДЛЯ ВАС» + правило с аннотацией; композер Lake Marineris: строка требования, факт в «Сработает», R3 плитка; «A» → чип из
   полосы в кассету героя → розыгрыш → журнал: строка «requirement waived by» у обоих клиентов; полоса пуста; `InfoPanel › ЭФФЕКТЫ` до розыгрыша: секция
   «ВЗВЕДЕНО» с плиткой TR49 и descend; после — пусто, у TR49 «Срабатываний: 1». Перезагрузка посреди (после взвода) — полоса стоит (`reloadConsole`).
2. **`special-design-armed`** — Special Design взведена (`lastCardPlayed`), температура −18, рука: Lake Marineris (0 °C — всё ещё не хватает: панель «С учётом
   ваших модификаторов: −4 °C · ±2 Особая разработка (один розыгрыш)», кассета «≥ 0 → −4 ±2»), Fish (−2 °C — decisive: «✓ благодаря»), Indentured Workers
   на столе взведён быть не может одновременно (одно поле) — отдельный стол: **`indentured-workers-armed`** — скидка −8 с именем в голове цены и «один
   розыгрыш» в R3, чип в полосе, расход в голову цены на коммите.
3. **Прелюдия** (опционально, если стенд дёшев): `ecology-experts-prelude` — стартовый workspace, прелюдия взведена → хостимый альбом несёт полосу и кассеты.
Регрессия на своём снапшоте, до / после: `console-card-availability`, `console-reveal-availability`, `console-start-availability`, `console-potential-availability`,
`console-draft-workspace`, `console-effect-forecast`, `console-parliament-heat`, `console-effects-explorer`, `console-play-landing-geometry`, `hand-album-*`,
`console-x87-shipment-to-earth` (чип руки), `console-hand-pick-preselect`, `console-scientific-breakthrough` (плашка Учёных), все Redux-спеки с Adaptation
Technology в руке (постоянное смягчение теперь ВИДНО — `npm run e2e:affected` + выборка 4K), `aaa-driver-canary`; гарды `e2eLiveness`, `e2eDriverGuard`.
`npm run build:test` обязателен.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Контактный лист: (1) **лист трёх состояний кассеты** (печатное · смягчено · снято · decisive) на трёх хостах (плитка руки, герой композера, зум) — читается
ли с дивана, что с числом, без цвета; (2) полоса «ВЗВЕДЕНО» в шапке альбома и в доке — иерархия (не громче героя), пустое состояние без прыжка строки;
(3) раскадровка TR49 целиком (композер «ВЗВЕДЁТ» → посадка события → чип в полосу → рука с полосой → композер следующей карты → чип в кассету → розыгрыш →
журнал) — по каждому моменту «что здесь слабо?» с кадром; (4) «ЭФФЕКТЫ» с секцией и detail; (5) соперник (второй клиент): «ЭФФЕКТЫ» просматриваемого,
нотификация, журнал; (6) витрина EN / RU, лор, причина без Учёных. Пробник долей блоков (`auditStage`) на композере; `type ladder` на полосе и на кассете;
«пауза» измеряется (`longtask`).

## 6. ПОЛИРОВКА ПО ПУТИ (здесь владелец ЗАКАЗАЛ итерацию: бюджет = класс на всех поверхностях + физика взвода / расхода)
Реестр: раздел **AL** «эффект на один розыгрыш · требование под эффектом · полоса «ВЗВЕДЕНО» · именованная скидка в голове цены». **Открытые на маршруте —
сперва воспроизвести:** PL-033 (события журнала без строк), безымянный «−N» чипа цены лица (диагноз 4), «Эффект этой карты» в R3 для скидки без узла
(диагноз 6). **Кандидаты:** К-E1 `PremiumCostBadge` «−N» без источника — класс «число без причины» (имя из `discounts.items`); К-E2 голова оплаты
`ConsolePaymentPanel` — «−saved» без имени (закон 9: источник в R3 — но ИМЯ одной строкой в голове не нарушает закон, Heat Capture уже называет закон —
`console-parliament-heat:233–249`); К-E3 `buildZoomAvailability` молчит на играбельной карте — панель «можно разыграть благодаря» как состояние, не отсутствие;
К-E4 компактный счётчик рельса печатает растянутый порог без объяснения (`unplayableReasonCompact :187`) — источник в compact-форме; К-E5 превью карты без
`behavior` = пустой результат (Special Design «Метки события») — категория `armed`; К-E6 политика Учёных sp02 при Redux (правило 12) — гард; К-E7 Playwrights
и класс (правило 14) — строка; К-E8 Adaptation Technology в стандартной руке 150 фикстур — после класса каждая такая рука показывает ±2: осмотреть кадр 4K
`console-scientific-breakthrough` / `console-canyon-carving` на «не громче героя». Только-Deck — не полируем (PL-105).
**Правила** — `game-logic.md` § «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ» (декларация `nextCardOnly` одного вида для скидки и требования; «игнорировать» — вид `waive`,
никогда число; один читатель взведённого; `requirementEasing` — одно чтение, источники именованы, `effectiveCount` от того же разбора; событие
`requirement-eased` пишется розыгрышем), `console-ui.md` § «ТРЕБОВАНИЕ ПОД ЭФФЕКТОМ» (кассета — одни классы на всех хостах, печатное остаётся, снятое —
диагональ скана; полоса «ВЗВЕДЕНО» у руки, хост-агностична; нота расхода — info; взвод и расход — полёты с видимыми концами), `premium-card.md` (живая модель
кормит кассету), `animations.md` (чип взвода / расхода — такты, reduced motion), чеклист §4 (строка «карта ВЗВОДИТ эффект на следующую карту» —
декларация даром: `nextCardOnly` на скидке / бонусе / `waive`; руками — бесподобная механика без декларации → `armedPlayEffect`),
`docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md` — НОВЫЙ документ контракта класса (модель, чтения, поверхности, события; наследует следующая карта с «на
следующую карту»).

## 7. Режим работы
**Коммиты**: (1) общий серверный слой: декларации `nextCardOnly` / `waive`, `globalRequirementWaiver`, читатель взведённого, `requirementEasing` + разбор
бонуса, модели, прогноз `easings` + `oneShot`, превью `arms`, событие `requirement-eased`, миграция Indentured Workers / Conscription / Eccentric Sponsor /
Ecology Experts (спеки, гард-ворклист, регрессия); (2) карта + спек + локаль + лор + арт; (3) кассета под эффектом + плашка плитки + доступность + «ДЛЯ ВАС» +
панель правил (лист трёх состояний 4K → **батч**); (4) полоса «ВЗВЕДЕНО» + док + хостимый альбом + «ЭФФЕКТЫ» секция + detail; (5) композер: строка требования,
«Сработает» / R3, нота расхода, имя скидки в голове, категория `armed` + ДВА полёта (взвод / расход) + A/B длительности; (6) соперник / журнал / нотификация /
стата; (7) e2e TR49 (две–три фикстуры) + перевод соседей; (8) документы — журнал § TR49 (правила с доказательствами, таблица «даром / руками», раскадровки,
A/B), правила, контракт-документ, чеклист §4, реестр AL, реестр лора, промт. **Коммиты полировки** — `Polish (TR49 · the armed effect): PL-### — …`.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой — `npm run make:css` + `npm run
build:server`. **Не пушить.** Батч — после листа кассеты и кадров полосы (коммиты 3–4), ДО композера и полётов.
Гочи: `turmoilReduxExpansion: true` в `testGame`; взвод в юнитах — `player.lastCardPlayed = card.name` ПОСЛЕ `playedCards.push` (читатель ходит по столу);
полная перегенерация фикстур перетасует ВСЕ Redux-фикстуры — добавлять только свои JSON; `FixtureName` — строка ДО сборки (webpack типизирует
`screenshots/**`, стенд вне git — `// @ts-nocheck`); `position: fixed` слой — всегда контекст наложения; rect-пробник краску не читает — состояние кассеты
проверять классом + `getComputedStyle` `::after`; 4K-раскадровка идёт ≈ 0,3× — тайминги по пробнику; e2e-сэмплер — `setInterval`; `eqeqeq` без исключения
для null; `rtk grep` с фиксированной строкой / `'` виснет — Grep-инструмент; RTK-хук съедает `\\` — такие правки Edit-инструментом; `npm run build:server`,
не голый `tsc`; снапшот только после конца сборки; юниты — на тихой машине; реестр — footer и букву раздела читать в момент записи; `cinematicBeat(page, ms,
why)` вместо `waitForTimeout`; ключ «For you» живёт в `ui.json`, не в `console.json`; `title` запрещён — `data-hint` на недизейбленной обёртке.
**В отчёте:** таблица правил 1–14 с доказательствами; «даром / руками»; лист трёх состояний кассеты на трёх хостах; раскадровки взвода и расхода (своя и чужая
сторона); A/B длительности; что выбрал владелец и почему; регрессия (юниты / гарды / lint / e2e по классам); новые ключи; лор.
**Раздел «ПОЛИРОВКА»** — с СОБСТВЕННЫМИ находками. **Явно — всё, что не получилось, и почему.**

## 8. Нельзя
«Игнорировать» числом 50 (ни в карте, ни в читателе — сентинел течёт); второе чтение бонуса требований мимо `requirementBonusBreakdown`; `effectiveCount`,
вычисленный отдельно от `requirementEasing`; клиентское сравнение порога с параметром (инвариант 2 — порог приходит с сервера); кассета, перерисованная
по-разному на разных хостах (одни классы); замена печатного значения эффективным (печатное остаётся); `filter` для диагонали / приглушения (только
`opacity` / `::after`); полоса «ВЗВЕДЕНО» с резервом высоты в пустом состоянии (прыжок шапки); чип взвода из синтетического источника (только с реального
глифа лица); расход, который тикает «−8» в голове цены без полёта из полосы; нота расхода как блокирующее подтверждение; «Сработает» без двери R3 (закон 9);
второй `lastCardPlayed`-ридер в клиенте ради LRI-подобной логики (класс читает модель); хук `armedPlayEffect` в центральной таблице (co-location); литерал
имени карты в `src/client/**`; литерал кнопки контроллера; определение промта по заголовку; `title`; `compatibility`; e2e сверх одного спека (соседи —
переводом); полировка только-для-Deck; `shardPlan.json`; файлы соседа в своём коммите; пуш и красные коммиты; правка `Playwrights` (вне скоупа — строка).
