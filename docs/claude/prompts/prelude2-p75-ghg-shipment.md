# Промт исполнителю · P75 GHG Shipment («Поставка парниковых газов» — решение 1) — СЕДЬМАЯ карта Prelude 2, третья ПОЛИТИЧЕСКАЯ и ПЕРВАЯ В СКОУПЕ С ТРЕБОВАНИЕМ КЕЛЬВИНИСТОВ (под Redux Кельвинисты = Зелёные — свод p.13, `normalizeReduxParty`), «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 1 + 5 — ДЕКЛАРАТИВНАЯ + ПОЛИТИЧЕСКАЯ): событие (красная), 3 M€, метка Космос; «Требует, чтобы Кельвинисты были у власти или у вас было 2 делегата там. Увеличьте производство тепла на 1. Получите 1 тепло за каждый ваш аэростат» — `requirements: {party: KELVINISTS}` (фасад `game.politics` нормализует в Зелёных: требование, standing, причина руки с эмблемой — ДАРОМ), `behavior.production.heat: 1` + `stock.heat: {floaters: {}}` (счётный чип ОДНОГО термина — превью, плита руки, «ПОЧЕМУ» — даром) · РАБОТА КАРТЫ (≈ 20 %): маркер `politics: 'redux'`, `description` новым ключом в голосе Redux, лор, арт, RU-имя, строка долой, спек с Redux-таблицей · ГЛАВНОЕ (≈ 80 %) — КЛАСС «КЛАССИЧЕСКАЯ ПАРТИЯ НА ПРЕМИУМ-ЛИЦЕ — ОДНА ТОЧКА ПЕРЕВОДА» (сегодня плашка лица печатает ТЕКСТ «Kelvinists» вместо эмблемы Зелёных, генератор блока требования пишет «Requires Kelvinists to be ruling…» без RU, описание говорит о партии, которой на столе Redux нет — при том что причина руки УЖЕ называет Зелёных с их эмблемой: три поверхности одной карты называют две разные партии) + КЛАСС-МАЛЫШ «ТЕРМИН АЭРОСТАТОВ НОСИТ ПЕЧАТНЫЙ ГЛИФ» («ПОЧЕМУ» читает «Ваши аэростаты 5» словами, а лицо печатает `[тепло] / [аэростат]`; Floater Leasing получает глиф даром) и ПРОХОД НА БОКСЕ (запертая рука с эмблемой Зелёных «0 из 2» → открытая при Зелёных у власти → композер с «ПОЧЕМУ [аэростат] 5 → +5» и оплатой титаном → ОДИН POST → событие рубашкой на стопку, тепло «+5» и производство тикают на посадке → «Сработает» Manutech → уход)

> **Статус: ВЫДАН 2026-10-30.** HEAD `42f991f6c1` (P69 СДАНА — `c4a260da61` карта · `2e1ca635bb` стенд · `42f991f6c1` доки; ворклист **6 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись СЕДЬМАЯ). **Вопросов владельцу эта задача НЕ задаёт**: карта тривиальная, все решения ниже приняты;
> `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> **ДВА СОСЕДА РАБОТАЮТ** (`ListAgents`: `terraforming-mars-5c`, `terraforming-mars-f8`) — их незакоммиченные файлы: `ConsoleShell.vue`, `ConsoleStartScene.vue`,
> `ConsoleRevealOverlay.vue`, `ConsoleColoniesSection.vue`, `ConsoleColonyFocusStage.vue`, `console/cardReaction/reactorPlaces.ts`, `console/colonyTrade/{colonyResolution,
> consoleColonyTrade}.ts`, `console/parliament/{parliamentRewardBeat,parliamentDoorHandoff}.ts`, `console/screenHandoff.ts`, `console/surfaceMotion/surfaceMotionDirector.ts`,
> `console/terraformedScene/terraformedScene.ts`, `src/styles/console.less`, `package.json` / `package-lock.json`, `playwright.config.ts`, `scripts/e2e-remote.mjs`,
> `.claude/rules/tests.md`, `docs/claude/{e2e-remote,console/terraformed-scene}.md`, `tests/e2e/timingSpecs.ts` и десяток e2e-спеков. **Эти файлы НЕ трогать** (`SendMessage`
> обоим: список своих файлов — §0; доки/журнал/реестр/лор — своими ханками, явными путями). Промты-образцы серии: **`prelude2-p85-summit-logistics.md`** (ПОЛИТИЧЕСКАЯ
> карта: маркер, фасад, стенд `-locked` / ruling, Redux-таблица спека по форме T09), `prelude2-p76-…` (форма §0–§9, чек-лист A–M; «Найдено 1»: награда СОБЫТИЯ
> рождается на РУБАШКЕ — класс, не переоткрывать), `prelude2-p69-…` (класс в общем слое → раздел реестра; решения без вопросов); здесь — только то, чем P75 ОТЛИЧАЕТСЯ.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P75.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P75 - GHG Shipment.png`.
> Лор — СО СКАНА, дословно: «What cannot be used as floater gas can be exported» (без точки на печати — добавить; гард лора).
> Реестр: последний раздел **CV** (P69), последний номер **PL-1154** → эта задача берёт **CW**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p75` → `npm run e2e:remote -- p75 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты —
> ТОЛЬКО профиль TV (`tests.md`: «a card spec runs its table on the TV profile only»).
> **Коммит — сам по окончании, явными путями (`git commit -- <paths>`); сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1 — политические карты и маркер; **§3.1 п. 1 и п. 5** — форма ПОЛИТИЧЕСКАЯ; §2.5 — гард «политическая карта, ушедшая из списка,
помечена `politics: 'redux'`»; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76 / P85 / P68 / P80 / P78 / P69 «Найдено» и «Что даром» — не переоткрывать: у P85 —
причина руки с эмблемой партии и «0/2» (`[data-reason-emblem]`), стенд `-locked`; у P76 — награда события на рубашке стопки «СОБЫТИЯ» (`recv:front`); у P69 — счётный
термин рисует ТОТ ЖЕ печатный item, что лицо), **`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 п. 4** («Кельвинисты = Зелёные (`normalizeParty`)»), `docs/claude/expansion-adaptation-checklist.md`
(«Play-card modal preview» — декларативная авто; «Fullscreen rule text» — `description`, `make:cards`; «Premium card FACE» — плашка партии; «Localization»),
`docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7, `docs/claude/parliament-glossary.md` (ОДИН глоссарий: «у власти» / «правят», «2 ваших делегата на их резолюции»
— гард `parliamentGlossary.spec`). **Контракты** — CLAUDE.md инварианты **1** (структурный маркер, не заголовок), 2, **8** (co-location), **9** (новый ключ, чужой RU не
переписывать), 13 (глоссарий), 14 · 15 · 16; `.claude/rules/game-logic.md` § `metadata.infoText` (строка требования = чип требования — `requirementProse`). Память:
`rules-first` / `redux-rules-outrank-owner-description` (свод Redux p.13 важнее печати), `upstream-spec-encodes-upstream-rules` (апстримный блок спека на КЛАССИЧЕСКОМ столе
— байт в байт, через фасад зелёный), `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `concurrent-session-edits-same-files`, `trivial-card-prompts-no-owner-questions`, `prelude2-adaptation` (гочи P76…P69:
MarsBot-стол с `prelude2Expansion` БРОСАЕТ → карта в руку без опции; Redux-стол требует Colonies в `testGame`; фильтр «Не активированы»; `python` на ноуте — заглушка).

**Образцы — по частям:** ОДНА точка перевода — **`common/parliament/ParliamentTypes.ts:30–45`** (`normalizeReduxParty`: «Kelvinists and Greens are one and the same» —
«The ONE translation point every piece of classic-Turmoil content goes through; nothing else may special-case it»; `REDUX_PARTIES :16–23` — шесть партий, Кельвинистов
нет), фасад — `server/politics/PoliticalOps.ts:167–169, 213–234` (`satisfiesPartyRequirement` и `partyRequirementStanding` нормализуют: `standing.party` = Зелёные),
причина руки — `models/unplayableReasons.ts:349–366` (`partyRequirementReason`: `params: [standing.party, '2']`, `party: standing.party` → эмблема Зелёных; RU —
`ru/parliament.json:1146`), **лицо — `premiumCard/premiumCardViewModel.ts:304–306, 344–346`** (`REQUIREMENT_RENDER[PARTY]` — «A party with no emblem keeps the text
label»; `normalizeRequirement` → `requirementPartyEmblem(descriptor.party)` БЕЗ нормализации), **`premiumCard/partyEmblems.ts:30–32`** (`requirementPartyEmblem`: только
`REDUX_PARTIES` → для Кельвинистов `undefined`), **спек, который это ПИНИТ — `tests/client/components/premiumCard/premiumCardViewModel.spec.ts:625–628`** («A party with
no emblem (the classic engine's Kelvinists) keeps its text label on the plate» — строка к переписыванию), **генератор — `tools/cardInfo/buildCardInformation.ts:299–306`**
(`Requires ${descriptor.party} to be ruling or that you have 2 delegates on its resolution.` — печатает партию как есть; RU строки Зелёных ЕСТЬ — `ru/card_info.json:547`,
Кельвинистов — нет), `requirementBlockId` → `req:party` (ид не зависит от партии), `revealReading.spec.ts:104–107` («a classic party keeps its upstream key» — чтение
ВЕРДИКТА вскрытия; у P75 вскрытия нет — не трогать, записать наблюдением); родственник-замена — `turmoilRedux/AerialLensesRedux.ts:32, 69–70` (замена классической
карты Кельвинистов печатает УЧЁНЫХ — «the printed Scientists, never the normalized Kelvinists») и её спек `tests/cards/turmoilRedux/AerialLensesRedux.spec.ts:118–134`
(«the GREENS ruling is not a road — the plate is the Scientists'» — форма `parliamentTable()` / `seatEnacted(t.parliament, quietResolutionOf(PartyName.GREENS))`);
счётный термин — `models/actionPreview.ts:495–496` (`countableBasis`: `{count, label: 'Your floaters'}` — без глифа), **`console/countedPlay.ts:159–200`** (`countGlyphOf`
— «A term with no printed item (floaters, «resources on this card») reads as words»; таблица `case` по `label`), `common/cards/render/Types.ts:137` (`ICardRenderItem.resource`),
`cards/render/CardRenderer.ts:394` (`resource(FLOATER)` → item `RESOURCE` с `resource` — ТО, что лицо печатает после «/»), `behavior/Counter.ts:194–196`
(`floaters` → `player.getResourceCount(FLOATER)`), `Player.ts:1113–1115` (все СВОИ карты с аэростатами — корпорация Stormcraft тоже), второй носитель —
`colonies/FloaterLeasing.ts` (`production.megacredits: {floaters: {}, per: 3}` — получает глиф даром); «Сработает» — `venusNext/Manutech.ts:41–53` (`onProductionGain`
+ `grantForecast`: +1 тепло на шаг производства тепла); событие — `console/played/consolePlayedHero.ts:1951–1962` (награды события рождаются на стопке «СОБЫТИЯ»);
стенды — `tests/e2e/console-summit-logistics.spec.ts:156–173` (`-locked`: `.con-hand__verdictbar--blocked`, `[data-reason-emblem]` `src` партии, 0 POST),
`console-hartlan-heating.spec.ts:196–199` (`transferWitness`: посадки `rail:heat`), фикстуры — `tests/e2e/fixtures/generate.ts:9265–9313` (`summitLogisticsFixture`:
`parliamentFixture(name, {stopAt: 'vote', options: {prelude2Expansion: true, customCorporationsList}, arrange, expect})`, `seatEnacted` / `seatResolution(…, 0, …)`,
`moveToDeckTop` + `drawOrThrow` в руку, `unplayableReasons(p1, card)[0]` для `-locked`), `tests/parliament/parliamentArrange.ts:151–153` (`quietResolutionOf(GREENS)`
= Aquifer Contest — тихая).

---

## Диагноз (подтверждён файл:строка на `42f991f6c1`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, лицо и текст называют не ту партию.** `prelude2/GhgShipment.ts`: `EVENT`, 3, `[SPACE]`, `requirements: {party: KELVINISTS}`,
   `behavior: {production: {heat: 1}, stock: {heat: {floaters: {}}}}`, `description` из ТРЁХ предложений (требование + два эффекта: «Requires that Kelvinists are in
   power or that you have 2 delegates there. …»), рендер `production(heat 1)` / `heat(1).slash().resource(FLOATER)`. Манифест `:67` — `compatibility: 'turmoil'` БЕЗ
   `politics` → после удаления строки гард §2.5 падает, пока не стоит `politics: 'redux'`. Декларативная → превью, плита руки (`countedPlayEffects`: `stock`
   с переменной), журнал через `stock.add`, `cardPlayPreviewCoverage` — даром.
2. **Чтение скана (§0):** «3» — цена; плашка «[пламя]» — ТРЕБОВАНИЕ «Кельвинисты» (не метка); кружки — Космос (звезда) + СОБЫТИЕ (стрелка вниз); коричневый блок
   `[производство тепла]`; ряд `[тепло] / [аэростат]`; текст «(Requires that the Kelvinists are ruling or that you have 2 delegates there. Increase your heat production
   1 step and gain 1 heat for each floater you have.)»; «P75»; слева внизу — Prelude 2 («<») и Turmoil (шестиугольник — `compatibility: 'turmoil'` → `politics: 'redux'`);
   лор — курсив.
3. **КЛАССИЧЕСКАЯ ПАРТИЯ НА ПРЕМИУМ-ЛИЦЕ — ТРИ ЧИТАТЕЛЯ МИМО ОДНОЙ ТОЧКИ ПЕРЕВОДА (КЛАСС, раздел CW).** Свод p.13: Кельвинисты и Зелёные — одно; `normalizeReduxParty`
   — ЕДИНСТВЕННАЯ точка перевода, «nothing else may special-case it». Фасад её читает: требование удовлетворяют Зелёные у власти / 2 делегата на ИХ резолюции,
   `partyRequirementStanding` отдаёт `party: GREENS`, причина руки печатает «Требуется: у власти «Зелёные» или 2 ваших делегата…» с ЭМБЛЕМОЙ Зелёных. Но:
   (а) **плашка лица** — `normalizeRequirement` зовёт `requirementPartyEmblem(KELVINISTS)` → `undefined` → «text label» «Kelvinists» на карте стола, где такой партии
   нет; спек `premiumCardViewModel.spec:625–628` ПИНИТ это как норму «для классического движка» — движка, которого в продукте нет (создатель без классического Turmoil);
   (б) **генератор** блока требования печатает `Requires Kelvinists to be ruling or that you have 2 delegates on its resolution.` — на столе Redux нет Кельвинистов,
   RU-строки нет (`missingTranslations`), а строка Зелёных с RU ЕСТЬ; осмотр X и «Информация» прочтут одно, рука — другое;
   (в) **`description`** — «Requires that Kelvinists are in power…» (RU апстрима «Кельвинисты в правящей партии или 2 делегата в ней» — вне глоссария).
   P75 — ПЕРВАЯ карта скоупа с требованием Кельвинистов: классические Aerial Lenses и Sponsored Mohole ЗАМЕНЕНЫ набором Redux (замена Aerial Lenses и вовсе печатает
   Учёных), Луна / Pathfinders / Underworld — вне скоупа. Апстримный `requirements: {party: KELVINISTS}` ОСТАЁТСЯ (апстримный спек на классическом столе
   `setRulingParty(game, KELVINISTS)` — байт в байт, фасад классики читает Кельвинистов как есть); нормализуются ЧИТАТЕЛИ премиум-слоя. → решение 3.
4. **Термин аэростатов — словами (класс-малыш, тот же раздел CW).** `countableBasis` даёт `{count: 5, label: 'Your floaters'}`; `countGlyphOf` для `'Your floaters'`
   не имеет `case` → «ПОЧЕМУ» и «ДЛЯ ВАС» читают «Ваши аэростаты 5 → +5», плита руки — «[тепло] +5» (чип — тепло, норма). Лицо печатает `[тепло] / [аэростат]` —
   P69 закрепил: термин носит ТОТ ЖЕ печатный item, что лицо (`PremiumMechNode`). Floater Leasing (Colonies, в скоупе, `per: 3`) читается так же словами. → решение 4.
5. **Что даром (проверить «до», не переоткрывать):** причина руки — Зелёные + эмблема + «0 из 2» / «1 из 2» / `partyOffVote` / вейвер TR70 / `alliedVia`; чипы превью
   — «+1 производство тепла» и «+N тепла» с базой одного термина (`countedPlayEffects` → плита); оплата — M€ + ТИТАН (Космос; 1 титан = 3 M€ = вся цена);
   событие ложится РУБАШКОЙ на стопку «СОБЫТИЯ», награды рождаются на рубашке (P76 «Найдено 1» — класс, не чинить); ряд тепла тикает на посадке, бейдж
   производства тепла — тоже; «Сработает»: **Manutech** (шаг производства тепла → +1 тепло; `grantForecast` есть), Helion — нет (тепло как деньги — не реакция);
   Stormcraft — её аэростаты на корпорации СЧИТАЮТСЯ (`getResourceCount` по всему столу); 0 аэростатов → чип «+0» с честным нулём; журнал — `stock.add` под
   записью розыгрыша; MarsBot-стол — аэростаты БОТА (`automa.floaters`) не считаются (свои карты); раздача под Redux — только с маркером. Хуков-реакторов у P75 нет →
   двойника нет; `OrOptions` нет → «не касается».
6. **Spec апстрима** (`tests/cards/prelude2/GhgShipment.spec.ts`): `canPlay` на классическом столе (`turmoilExtension: true`, `setRulingParty(KELVINISTS)`), `play`
   (Jovian Lanterns 5 + Search for Life 2 → 5 тепла — Search for Life держит НАУКУ, не аэростаты: апстрим так и пинит «только аэростаты»). Оба — байт в байт.
7. **Локаль.** RU-имя «Поставка CO₂» (`ru/cards.json:693` — апстрим) — сужение: GHG = парниковые газы, семья в RU — «Фабрики парникового газа», «Бактерии,
   выделяющие парниковые газы»; RU старого ключа описания (`:694`) — не в голосе глоссария; ключ строки требования Зелёных в `card_info` ЕСТЬ. Лора `P75` и арта нет.

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Событие, 3, Космос, без ПО; P75; `compatibility: 'turmoil'` + `politics: 'redux'`; оплата — M€ + титан (сталь не предлагается).
2. Требование на Redux-столе — Зелёные (нормализация): Зелёные у власти → можно; 2 своих делегата на резолюции Зелёных → можно; 0 / 1 → заперта с причиной «0 из 2» /
   «1 из 2» и эмблемой ЗЕЛЁНЫХ (`reason.party === GREENS`); резолюция Зелёных не на голосовании → `partyOffVote`; дарованный ЭФФЕКТ Зелёных — не дорога (FAQ p.19);
   вейвер TR70 — снято; классический стол — Кельвинисты (апстрим).
3. Розыгрыш → производство тепла +1; тепло += СВОИ аэростаты по всем картам стола (корпорация включая; чужие и бота — нет; наука / микробы — нет); 0 → честный ноль.
4. Превью (декларативное): чип производства, чип тепла с базой `[{count: N, label: 'Your floaters'}]` — глиф аэростата (решение 4); `countedPlayEffects` — то же;
   read-only. Генерируемый текст: блок требования называет ЗЕЛЁНЫХ (решение 3), блоки эффектов — из `behavior`; `make:cards` 0 / 0 / 0.
5. Раздача: Redux + Prelude 2 — в колоде (с маркером); без Prelude 2 — нет; MarsBot-стол (карта в руку без опции) — считаются только аэростаты человека; save / reload — ничего нового.

### Решения — ПРИНЯТЫ (карта тривиальная; вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU** — имя «Поставка парниковых газов» (значение ключа-имени в `ru/cards.json` — прецедент P85 / P68: имя карты — тот же ключ, иного пути нет); RU нового
   ключа описания (решение 2): «Требуется: у власти «Зелёные» или 2 ваших делегата на их резолюции. Увеличьте производство тепла на 1 ступень. Получите 1 тепло за
   каждый ваш аэростат.»; лор RU — «Что не годится в газ для аэростатов, можно экспортировать.» Старые RU-ключи апстрима не трогать.
2. **Текст** — `metadata.description: 'Requires that Greens are ruling or that you have 2 delegates there. Increase your heat production 1 step. Gain 1 heat for each
   floater you have.'` (НОВЫЙ ключ в голосе Redux — лицо и текст говорят правду стола: на нём нет Кельвинистов; форма предложения требования — как у P85 / P80);
   `infoText` не нужен (декларативная: генератор сам сеет оба блока эффектов; требование — из `requirements` через решение 3). KEY-rule word-diff против новой
   `description` — слова совпадают («Greens» — из нормализованной строки генератора).
3. **ОДНА ТОЧКА ПЕРЕВОДА ДЛЯ ПРЕМИУМ-ЧИТАТЕЛЕЙ** (диагноз 3, раздел **CW**) — (а) `partyEmblems.requirementPartyEmblem(party)` → `requirementPartyEmblem(normalizeReduxParty
   (party))` (импорт из `common/parliament/ParliamentTypes.ts` — клиент common читать может; `normalizeReduxParty` БРОСАЕТ на не-Redux-не-Кельвинистах — в скоупе
   других нет, но обернуть честно: `isReduxParty(party) || party === KELVINISTS` → иначе `undefined`, как сейчас); `premiumCardViewModel.normalizeRequirement` кладёт
   в `party` НОРМАЛИЗОВАННУЮ партию (плашка, aria, e2e-хуки читают Зелёных); спек `:625–628` ПЕРЕПИСАТЬ: «the classic Kelvinists wear the GREENS' emblem (rulebook
   p.13 — `normalizeReduxParty`, the one translation point)» + отдельный `it`, что никакой `REDUX_PARTIES` не изменился; (б) `buildCardInformation.ts` PARTY-case:
   `const party = normalizePartyForText(descriptor.party)` → строка «Requires Greens to be ruling…» (RU уже есть), `requirementBlockId` не меняется; гард
   `cardInformation` — строка P75 без `missingTranslations`; `requirementProse` (EN и RU) — строка требования = чип (чип — Зелёные после (а)); (в) `description` —
   решение 2; (г) `unplayableReasons` / фасад — уже нормализованы: спек ПИНИТ (`reason.party === GREENS`, эмблема `/greens/`); (д) `revealReading.spec:104–107`
   («классическая партия хранит апстримный ключ» — вердикт вскрытия) — НЕ трогать, записать в CW наблюдением (кандидат той же точки перевода, когда появится карта
   вскрытия с партией); (е) `turmoil.json` RU «Кельвинисты» — классический UI, не трогать. Сервер `requirements` остаётся `KELVINISTS` (апстримный спек, фасад классики).
4. **ТЕРМИН АЭРОСТАТОВ НОСИТ ПЕЧАТНЫЙ ГЛИФ** (диагноз 4, раздел CW) — `countedPlay.ts` `countGlyphOf`: `case 'Your floaters': return glyph(CardRenderItemType.RESOURCE,
   {resource: CardResource.FLOATER})` — тот же item, что `b.resource(FLOATER)` печатает на лице; `'Resources on this card'` — без глифа (печатного одного item нет —
   оставить словами); спек `countedPlay.spec` § floaters (глиф + чтение «[аэростат] 5 → +5 тепла»; Floater Leasing — тот же глиф, `per: 3` — чип производства, термин 5);
   e2e-хук `[data-count-glyph]` уже есть.
5. **Свой e2e-стенд — ДА**, `tests/e2e/console-ghg-shipment.spec.ts`, ДВЕ фикстуры одного рецепта `ghgShipmentFixture(name, ruling)` по форме `summitLogisticsFixture`
   (Redux + Colonies + Prelude 2 **+ `venusNextExtension: true` в `options`** — `reduxTable` Венеру не включает, а Manutech — корпорация Venus Next;
   `customCorporationsList: [MANUTECH, THORGATE]` — Manutech у p1: «Сработает» +1 тепло на шаг производства, реакция CN на печатном эффекте корпорации; p1 — на столе
   Dirigibles с 3 аэростатами и Floating Habs с 2 (`playedCards.push(new …())` + `resourceCount` напрямую — обе карты Venus) → **5 тепла**; 1 титан (= вся цена 3 M€); P75 в руке;
   `stopAt: 'vote'`): `ghg-shipment` — `seatEnacted(parliament, quietResolutionOf(GREENS))` (Зелёные у власти), `ghg-shipment-locked` — `seatResolution(parliament, 0,
   quietResolutionOf(GREENS))`, 0 делегатов → «0 из 2»; `expect` фикстуры — `unplayableReasons(p1, card)[0]`: `type 'party'`, `party === GREENS`, `current 0`,
   `partyOffVote !== true`; сухой прогон розыгрыша на копии (тепло +5, производство +1, титан 0, M€ без изменений, Manutech +1 тепло → итого +6 тепла на столе
   с Manutech — пинить число ЧЕСТНО: 5 от карты, 1 от корпорации). Клетки: (1) `-locked` — плита заперта, причина с `[data-reason-emblem]` `src` `/greens/` и «0 из 2»,
   X — лицо: плашка с ЭМБЛЕМОЙ ЗЕЛЁНЫХ (не текст), блок требования называет Зелёных; 0 POST; (2) основная — плита руки «[тепло] +5»; композер: чип «+1 производство
   тепла», чип «+5 тепла», «ПОЧЕМУ» = `[аэростат] 5 → +5` (глиф, `[data-count-glyph]`), «Сработает» — Manutech «+1 тепло», оплата: RT → 1 титан, CTA «Разыграть ·
   1 [титан]», 0 POST; A → ОДИН POST → событие рубашкой на стопку «СОБЫТИЯ», жетон цены (титан) уходит с рельса в печатную стоимость, награды рождаются на рубашке
   (`recv:front` — P76, норма) и садятся `rail:heat` (тепло) / бейдж производства тепла тикает; ответ стола — жетон с печатного эффекта Manutech (`reactor:…`) в
   `rail:heat`; флоу уходит; сервер: тепло +6, производство тепла +1, титан 0, карта в стопке событий; `transferWitness`: `endsOverGlass` пуст.
6. **Журнал серии / доки** — запись P75; `PRELUDE2_ADAPTATION.md` — «7 / 54», строка; §3.1 п. 5 — одно предложение («классическая партия в требовании: сервер —
   `KELVINISTS` как у апстрима, премиум-читатели (лицо, генератор, описание) — через `normalizeReduxParty`»); `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 п. 4 — хвост
   предложения про лицо/генератор; память `prelude2-adaptation.md` (7 / 54).
7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `42f991f6c1`. **Сначала** `ListAgents` + процессы; `SendMessage` обоим соседям (их файлы — в шапке): твои файлы — `prelude2/GhgShipment.ts`,
   `Prelude2CardManifest.ts` (одна строка — маркер), `tests/cards/prelude2/GhgShipment.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка долой), арт P75
   (`assets/card-images/P75.webp` + миниатюра, `genfiles/cardArtManifest.json`), `assets/text/lore_texts.json` (одна строка), `ru/{cards,card_info,lore_texts}.json`,
   `src/genfiles/*`; **по решению 3** — `premiumCard/partyEmblems.ts`, `premiumCard/premiumCardViewModel.ts` (одна строка), `tests/client/components/premiumCard/
   premiumCardViewModel.spec.ts`, `tools/cardInfo/buildCardInformation.ts`, `tests/cards/cardInformation.spec.ts` (если нужна строка); **по решению 4** —
   `console/countedPlay.ts`, `tests/client/console/countedPlay.spec.ts`; фикстуры + стенд; доки, журнал, реестр — своими ханками. Коммиты явными путями; пуш после каждого.
2. e2e — только бокс; `FIXTURES=ghg-shipment,ghg-shipment-locked npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 15 %)
- `GhgShipment.ts`: `description` новым ключом (решение 2); `requirements` и `behavior` — без изменений; манифест — `politics: 'redux'`.
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P75.png" P75` → `make:cards`); RU имени / описания / лора (решение 1);
  строка `GHG_SHIPMENT` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт (классический стол); `describe('on a Turmoil Redux table')` по форме AerialLensesRedux `:118–134` / T09: правила 1–5 по одному
  `it` — Зелёные у власти → можно; 2 делегата на резолюции Зелёных → можно; 0 / 1 → причина `party: GREENS`, `current`; `partyOffVote`; эффект Зелёных даром — не
  дорога; вейвер TR70; оплата титаном (сталь — нет); тепло = свои аэростаты по столу (Dirigibles + Stormcraft-корпорация), чужие и микробы — нет; ноль честный;
  превью: чипы + база `'Your floaters'` с числом сервера, read-only; `countedPlayEffects` = то же; раздача под Redux только с маркером; MarsBot-стол (аэростаты
  бота не считаются); save / reload.

## 2. Клиент — карта (≈ 5 %) и классы (§3.Б)
Даром: причина руки с эмблемой Зелёных, чипы, плита, оплата титаном, событие на стопку, журнал, «Сработает» Manutech. Классы — решения 3–4 (§3.Б).

## 3. ГЛАВНОЕ — ПРОХОД ЦЕПОЧКИ И СТЕНД (≈ 80 %)
Форма — чек-лист P76 A–M; здесь — чем P75 отличается:
- **A. Рука.** `-locked`: плита заперта, причина «Требуется: у власти «Зелёные» или 2 ваших делегата…» + эмблема Зелёных + «0 из 2»; при Зелёных у власти —
  играбельна, плита «[тепло] +5» (`data-hand-count`).
- **B. Осмотр X.** Арт P75, лор; ПЛАШКА — эмблема Зелёных (после решения 3; «до» — кадр текстовой метки «Kelvinists» в отчёт); блоки: требование (Зелёные) ·
  производство тепла · тепло за аэростаты; лицо — `[производство тепла]` / `[тепло] / [аэростат]`; «ДЛЯ ВАС» — «[аэростат] 5 → +5 тепла».
- **C. Композер.** Чип «+1 производство тепла · 0 → 1», чип «+5 тепла · N → N+5», «ПОЧЕМУ» — глиф аэростата + 5 (решение 4); «Сработает» — Manutech «+1 тепло»;
  оплата — RT титан (compact ⇄ expanded), CTA «Разыграть · 1 [титан]»; курсор на CTA; 0 POST.
- **D. Коммит.** ОДИН POST; жетон титана уходит с рельса ВБОК в печатную стоимость, ряд титана тикает на уходе; событие ложится рубашкой на стопку «СОБЫТИЯ»; «+5»
  рождается на рубашке (норма P76) → `rail:heat`, ряд тепла тикает на посадке; бейдж производства тепла тикает; ответ стола — Manutech с печатного эффекта → `rail:heat`
  (после награды карты — порядок CN); флоу ЛЕВИТ.
- **E.** Добора нет. **F.** Карта — в стопке событий таблицы «РАЗЫГРАНО»; HUD меток: Космос +1 (событие — метка события в счёт не идёт, как у апстрима).
- **G/H.** Журнал — одна запись: производство тепла, «+5 тепла» (база — если журнал несёт, не выдумывать; PL-1152 — наблюдение P69), ответ Manutech дочерней строкой;
  соперник — «+1 произв. тепла · +5 тепла».
- **I. «Сработает».** Космос — реакторы в скоупе (grep `onCardPlayed` ∧ `Tag.SPACE`); производство тепла — Manutech (в фикстуре); ряд честен.
- **J. Края (сервер).** 0 аэростатов; `partyOffVote`; эффект даром — не дорога; вейвер; Stormcraft.
- **K. Две дороги в консоли** — как у P85 (серверный спек; драйвер голосования не обязателен). **L/M.** Как у P76.

### 3.Б Классы (решения 3–4, раздел CW)
`partyEmblems.ts` (нормализация в `requirementPartyEmblem`, безопасная обёртка) · `premiumCardViewModel.ts` (`party` — нормализованная) · спек лица (строка 625–628
переписана + `REDUX_PARTIES` без изменений) · `buildCardInformation.ts` PARTY-case (нормализация; `req:party` тот же) · `cardInformation.spec` (P75 — без
`missingTranslations`) · `requirementProse` (EN + RU) · `countedPlay.ts` (`case 'Your floaters'`) · `countedPlay.spec` § floaters · `TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 п. 4.
Стили — не нужны; ореол — нет.

## 4. Лицо, локаль, лор, арт
Арт P75; лор EN + RU; RU имени / описания (решение 1); `card_info` RU строки Зелёных уже есть — ничего не коинить; «у власти», «на их резолюции», «аэростат»,
«ступень» — глоссарий / канон; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack` (политическая — маркер), `premiumScope`, `cardPlayPreviewCoverage`, `countedPlayForecast` (декларативный `stock` с
   переменной — плита), `cardInformation` (без `missingTranslations`; KEY-rule против новой `description`; порядок блоков), **`requirementProse`** (EN и RU — Зелёные),
   `premiumCardViewModel` (переписанная строка), `premiumCardIcons`, `cardLore`, `crossPlayerCoverageGuard`, `parliamentGlossary`, `PoliticalThinkTank`-класс (пул карт с
   требованием партии, если пинит состав), `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`, `countedPlay.spec`.
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия — канарейка, `console-summit-logistics` (`-locked` — эмблема Учёных не изменилась), `console-red-appeasement`
   (если есть — `grep -l "Red Appeasement" tests/e2e`), `console-cloud-tourism` (`countedPlay` — набор не задет), `console-ceres-tech-market` (один термин),
   `console-ishtar-expedition` (событие на стопку), `console-hartlan-heating` (ряд тепла), `console-card-reaction` (CN), стенды с плашкой партии (`grep -l
   "data-reason-emblem\|party" tests/e2e/console-martian-census*.spec.ts` и `grep -l "requirementPartyEmblem\|pcard__req" tests/e2e`).

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p75/tv4k/`: (а) `-locked`: плита заперта с эмблемой Зелёных «0 из 2»; (б) осмотр X: плашка — ЭМБЛЕМА Зелёных (и кадр «до» с текстом «Kelvinists»);
(в) композер: чипы, «ПОЧЕМУ» с глифом аэростата, «Сработает» Manutech, оплата титаном; (г) коммит: титан в стоимость, событие рубашкой, «+5» в ряд тепла, бейдж
производства; (д) ответ Manutech; (е) журнал. Своим глазом: «я вижу, КАКАЯ партия нужна (одна и та же на плите, в руке и в тексте), ОТКУДА 5 тепла и ЧЕМ я заплатил?»

## 7. Полировка по пути
1. Реестр **CW** «P75 · КЛАССИЧЕСКАЯ ПАРТИЯ НА ПРЕМИУМ-ЛИЦЕ — ОДНА ТОЧКА ПЕРЕВОДА · ТЕРМИН АЭРОСТАТОВ НОСИТ ПЕЧАТНЫЙ ГЛИФ» — решения 1–4 строками «что было / что стало /
   где» + находки прохода + наблюдение 3(д) (`revealReading`); номера — по footer. Без гэпов — только журнал.
2. Доки: журнал серии (P75); `PRELUDE2_ADAPTATION.md` (7 / 54; строка; §3.1 п. 5); `TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 п. 4; память `prelude2-adaptation.md` (7 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — «до» (юнит или бокс): плашка лица P75 (текст «Kelvinists»?), сгенерированная строка требования, причина руки на `-locked`-столе
   (Зелёные?), «ПОЧЕМУ» (слова?). Порядок: карта (описание, маркер) + спек + строка долой → лор / арт / RU → `make:cards` → решения 3–4 (классы + юниты) → фикстуры + стенд
   (клетки 1–2) → проход A–M + «после» → CW → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после» (три поверхности — одна партия); таблица A–M с кадрами; POST на розыгрыш; гарды и `make:cards`;
   регрессия на боксе (аннотация `build`); решения 1–7 (что сделано по каждому — без вопросов владельцу); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Вторая точка перевода (`if (party === KELVINISTS)` где-либо, кроме `normalizeReduxParty`); менять `requirements` карты на `GREENS` (апстримный спек, фасад классики);
  трогать `normalizeReduxParty`, `REDUX_PARTIES`, `turmoil.json`; `'both'` без причины; читать политику мимо фасада; голую запись в слот Парламента в спеке / фикстуре;
  детектить промпт по заголовку; прятать запертую карту; `title`; литерал кнопки; ореол; таймер вместо холда.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; править файлы
  соседей (шапка); переоткрывать находки P76…P69 (награда события на рубашке — не дефект); чинить `revealReading` в этой задаче; чинить журнал (PL-1152).
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить чужие файлы; пересборку во время прогона e2e на боксе.
