# Промт исполнителю · P69 Cloud Tourism («Облачный туризм») — ШЕСТАЯ карта Prelude 2, первая со СЧЁТОМ ПАРАМИ МЕТОК (производство = min(Земля, Венера) с распределением ДЖОКЕРА) и первая с ПО-ПОРОГОМ НА СОБСТВЕННОМ РЕСУРСЕ + действием «ресурс на себя», «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 2 + 3 — bespoke-РОЗЫГРЫШ без вопроса + ДЕКЛАРАТИВНОЕ действие): синяя (активная), 11 M€, метки Юпитер + Венера, Венера (`compatibility: 'venus'`), аэростаты; «Действие: добавьте 1 аэростат на эту карту» — `action: {addResources: 1}` (`ActionCard`; композер «ДЕЙСТВИЙ КАРТ», превью действия, ACTION COMMIT категории `resources` — жетон с печатного значка в капсулу hero-карты, PL-063 — и блок «ПРОГРЕСС ПО» — ДАРОМ); «Увеличьте производство M€ на 1 за каждую ПАРУ меток Земли и Венеры» — `bespokePlay`: `min(raw Earth, raw Venus + 1)`, джокеры (печатный — Research Coordination; «+1 любая метка» Учёных под Redux) раздаются по одному на МЕНЬШУЮ сторону; «1 ПО за каждые 3 аэростата здесь» — `victoryPoints: {resourcesHere, per: 3}` (лицо `1/3 [аэростат]`, живое ПО, роль держателя на спутнике — даром, прецедент Extremophiles) · РАБОТА КАРТЫ (≈ 35 %): ко-локированные `cardPlayPreview` + `countedPlayForecast` на ОДНОЙ функции счёта с `bespokePlay`, `description` одним предложением + `infoText`, лор, арт, RU, строка долой, спек · ГЛАВНОЕ (≈ 65 %) — ПРОХОД ОБОИХ ПУТЕЙ НА БОКСЕ (розыгрыш: плита руки «+2», композер со счётным чипом «+2 производства» и «ПОЧЕМУ», ОДИН POST, журнал; действие: «ДЕЙСТВИЯ КАРТ» › карта › A → ОДИН POST → жетон аэростата с печатного значка в капсулу, счётчик тикает на посадке, флоу уходит; третий аэростат → ячейка ПО тикает на посадке с причиной) и КЛАСС «СЧЁТ ПАРАМИ — ОДИН ТЕРМИН С ДВУМЯ СТОРОНАМИ, ДЖОКЕР РАЗДАН И НАЗВАН» (сегодня «ПОЧЕМУ» знает одну метку, ИЛИ-ряд меток (P85) и СУММУ терминов — пара не выразима ни одним: ряд читается как «за каждую метку», сумма — как «2 + 2 → +2», что арифметически ложь)

> **Статус: ВЫДАН 2026-10-30.** HEAD `25e7aca7b3` (P78 СДАНА — `8175656e5c` карта · `04b935c4db` класс CU + стенд · `6bbd90e9e3` доки; ворклист **5 / 54**;
> журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись ШЕСТАЯ). **ДВА СОСЕДА РАБОТАЮТ** (`ListAgents`: `terraforming-mars-5c`, `terraforming-mars-f8`) — их
> незакоммиченные файлы в дереве: `ConsoleShell.vue`, `ConsoleColoniesSection.vue`, `ConsoleColonyFocusStage.vue`, `played/ConsolePlayedReceivingStage.vue`,
> `console/played/{consolePlayedHero,receivingStageModel}.ts`, `console/resourceTransfer/resourceTransferModel.ts`, `console/screenHandoff.ts`,
> `console/colonyTrade/colonyResolution.ts`, `console/parliament/{parliamentRewardBeat,parliamentDoorHandoff}.ts`, `console/surfaceMotion/surfaceMotionDirector.ts`,
> `console/terraformedScene/terraformedScene.ts`, `src/styles/console.less`, `package.json` / `package-lock.json`, `playwright.config.ts`, `scripts/e2e-remote.mjs`,
> `docs/claude/console/terraformed-scene.md` и десяток e2e-спеков (`console-l1-trade-terminal`, `console-colony-venus-trade`, `console-play-tr-reward`, …).
> **Эти файлы НЕ трогать** (`SendMessage` обоим: список своих файлов — §0; доки/журнал/реестр/лор — своими ханками, явными путями). Судя по
> `ConsolePlayedReceivingStage.vue` + `receivingStageModel.ts`, кто-то чинит PL-1146 (сцена «Разыграно» принимает ресурс только на первую карту стопки) — P69 это не задевает
> (ресурс летит в hero-капсулу собственной карты), но `consolePlayedHero.ts` — их, не твой.
> **Вопросов владельцу эта задача НЕ задаёт**: карта тривиальная, все решения ниже приняты; `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> Промты-образцы серии: `prelude2-p76-…` (форма §0–§9, чек-лист A–M), `prelude2-p85-…` (счётный чип с двумя базами — класс CR),
> `prelude2-p68-…` (ДЕЙСТВИЕ: проход «ДЕЙСТВИЯ КАРТ», стенд с двумя путями одной фикстурой), `prelude2-p78-…` (класс в общем слое → раздел реестра);
> здесь — только то, чем P69 ОТЛИЧАЕТСЯ.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P69.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Venus Next & Prelude 2 - P69 - Cloud Tourism.png`.
> Лор — СО СКАНА, дословно: «Offering unique sports and amazing sunsets in the hotels floating among the clouds» (без точки на печати — добавить; гард лора).
> Реестр: последний раздел **CU** (P78), последний номер **PL-1147** → эта задача берёт **CV**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p69` → `npm run e2e:remote -- p69 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`).
> **Коммит — сам по окончании, явными путями (`git commit -- <paths>`); сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§3.1 п. 1, **п. 2 — bespokePlay: ФИКСИРОВАННЫЙ вычислимый результат ПОКАЗАН до нажатия**, п. 3 — действие, п. 7; §4; §5),
`docs/claude/prelude2-cards-progress.md` (P76 / P85 / P68 / P80 / P78 «Найдено» и «Что даром» — не переоткрывать: у P85 счётный чип с ДВУМЯ базами — класс CR, `ActionEffectBasis.tags`
/ `wild`, `CountedWhy.terms`, и гоча «эффект Учёных под Redux = +1 любая метка входит в КАЖДЫЙ подсчёт меток» — у P69 это джокер, который карта РАЗДАЁТ; у P68 — проход
«ДЕЙСТВИЙ КАРТ» и стенд с двумя путями одной фикстурой), `docs/claude/expansion-adaptation-checklist.md` (строки «Play-card modal preview» — «**a FIXED computable result
MUST be shown even with no choice**»; «Action-confirm modal preview» — декларативное действие авто; «Fullscreen rule text» — bespoke → `infoText`, `make:cards` →
`cardInfoAudit.json`; «Premium card FACE» — авто; «Effect FORECAST» — у P69 хуков-реакторов нет), `docs/claude/turmoil-redux-card-checklist.md` §0, §3, §4, §7,
`docs/claude/console/effect-forecast.md` («ПОЧЕМУ» и «Сработает» — две разные строки композера), `docs/claude/console/workspace-band.md` § ACTION COMMIT (PL-063: «a gain
«on this card» with nothing spent before it is that last link alone — into the hero's capsule, the workspace to the touchdown»), `docs/claude/console/score-cell.md`
(TR55 закон 4: «an action's chain — «on landing» — the contact beat of `noteCardResourceLanding`» — ячейка ПО тикает на посадке третьего аэростата),
`docs/claude/console/resource-transfer.md` (концы полёта видимы, печатный значок — источник: `data-graphic-node`). **Контракты** — CLAUDE.md § A WORKSPACE IS ONE FLOW,
§ ACTION COMMIT, инварианты **7** (превью read-only, одна функция счёта — не вторая реализация правила), **8** (хуки в файле карты), 2 · 6 · 9 · 14 · 15 · 16;
`.claude/rules/game-logic.md` § Co-location, § `metadata.infoText` (ОДИН блок на бонус, порядок = порядку рендера; VP-блок несёт ТОЛЬКО правило ПО). Память:
`card-reaction` (ответ стола — с сервера), `upstream-spec-encodes-upstream-rules` (апстримный блок спека — байт в байт: здесь он кодирует ПРАВИЛО форка тоже),
`e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`, `git-commit-explicit-paths-shared-index`,
`concurrent-session-edits-same-files`, `shell-template-escapes`, `prelude2-adaptation` (гочи P76…P78 — MarsBot-стол с `prelude2Expansion` БРОСАЕТ; гард
`cardInformation` считает «Requires…» прозой требования; авторский `infoText` с токеном строки ЗАБИРАЕТ строку целиком; `effect-short` / `action-short` при > 52 симв.).

**Образцы — по частям:** счётный bespoke-розыгрыш — **`promo/InterplanetaryTrade.ts:33–57`** (ОДНА приватная функция для `bespokePlay`, `countedPlayForecast` и
`cardPlayPreview`; `actionPreviews.counted(productionChange(…), {count, label})` — ЭТО форма P69), `base/MediaArchives.ts`, `colonies/CommunityServices.ts`,
`promo/HermeticOrderofMars.ts` (`spaces` в термине), `cards/ICard.ts:150–165` (`countedPlayForecast` — «the hand tile's plate, the composer's chip and its «ПОЧЕМУ» are
this one reading»; `tests/models/countedPlayForecast.spec.ts` — ворклист «every chip whose number MOVES with the table must be on the plate»); базис —
`common/models/ActionPreviewModel.ts:296–341` (`ActionEffectBasis`: `tag` · `tags` (ИЛИ-ряд, P85) · `wild` · `parts` / `excluded` (перепись TR45) · `spaces` · `zero`),
`cards/actionPreviews.ts:141` (`counted`); читатели — **`console/countedPlay.ts`** (`handForecastPlate`, `countGlyphOf` / `countGlyphsOf`, `summedTermsOf`,
`countedWhyOf`, `countedWhyRow`, `termReading` — «… 5 (в т.ч. любых: 1)»), **`components/console/ConsoleCountedWhy.vue`** (строка «ПОЧЕМУ»: `[data-count-term]`,
`[data-count-term-n]`, `[data-count-wild]`, `data-count-why-total`), `ConsolePlayCardConfirm.vue` (хост строки), инспектор «ДЛЯ ВАС» (`countedWhyRow`), плита руки
(`data-hand-count`); счёт меток — `player/Tags.ts:99–160` (`count(tag, 'raw' | 'default')` — `raw` без джокеров и без Earth Embassy; `default` — с подстановками;
`multipleCount`, `distinctCount`), `tests/TestPlayer.ts:25/59` (`tagsForTest` — и `wild`); джокеры в скоупе — `prelude/ResearchCoordination.ts` (печатный `Tag.WILD`),
Учёные под Redux (`parliament.grantPartyEffect(player, SCIENTISTS)` — апстримный `it` P69 уже это пинит); ПО за N ресурсов — `venusNext/Extremophiles.ts:16`
(`{resourcesHere: {}, per: 3}`), `cards/Card.ts:418–426` (`DynamicVictoryPoints.resource(type, each, per)`), `premiumCard/premiumCardViewModel.ts:151–152`
(`per > 1` → стиль `formula`), `components/actions/actionVpProgress.ts` (блок «ПРОГРЕСС ПО»: порог `per`, «2/3 → 3/3», `crossed`), `common/cards/holderRole.ts` (роль
держателя по `victoryPoints.resourcesHere`); действие «ресурс на себя» — `venusNext/LocalShading.ts` (`action: {addResources: 1}`, тот же текст «Add 1 floater to this
card.» — RU-ключ ЕСТЬ), `venusNext/ExtractorBalloons.ts`, `console/consoleActionCommit.ts:340–392` (категория `resources`: `note === 'on this card'`),
`consoleActionCommitRail.ts` (последнее звено в капсулу hero, `foldWhenClear`); реакторы на метки — `corporation/SaturnSystems.ts:42–55` (Юпитер ЛЮБОГО игрока → +1
производства M€ владельцу; `cardPlayedForecast` есть — «Сработает» честен), `turmoilRedux/TitanHoldings.ts:41–43/158–172` (`TITAN_TAGS` — проверить, входит ли Юпитер /
Венера); фикстуры — `tests/e2e/fixtures/generate.ts` § P68 (`:9315–9362`: 2p, карты в руку через `moveToDeckTop` + `drawOrThrow`, стол через `playedCards.push`, сухой
прогон на копии — `Game.deserialize(structuredClone(game.serialize()))`), § P76 (`prelude2Expansion` + `venusNextExtension` — Венера-стол); стенд с действием —
`tests/e2e/console-ceres-tech-market.spec.ts` (форма: `openCardActions` / `openActionFocus`, `armTransferWitness` / `transferWitness`, раскадровка), с чипом ПО —
`console-nuclear-warhead-utilization.spec.ts` (свидетель ячейки ПО: `rail:vp`).

---

## Диагноз (подтверждён файл:строка на `25e7aca7b3`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, превью — нет.** `prelude2/CloudTourism.ts`: `ActionCard`, `ACTIVE`, 11, `[JOVIAN, VENUS]`, `victoryPoints: {resourcesHere: 1, per: 3}`
   (ЧИСЛО там, где тип говорит `{}` — компилируется, потому что `number` присваиваем `{}`; все карты скоупа пишут `resourcesHere: {}` — нормализовать, косметика),
   `resourceType: FLOATER`, `action: {addResources: 1}`, `description` из ДВУХ предложений (розыгрыш + ПО), рендер `action('Add 1 floater to this card.', …)` +
   `production(pb => pb.megacredits(1).slash().tag(EARTH).tag(VENUS))`. **`bespokePlay` (`:39–64`)**: `earth = count(EARTH, 'raw')`, `venus = count(VENUS, 'raw') + 1`
   («including this» — карта ещё не на столе в момент счёта), Earth Embassy (Луна — вне скоупа; оставить), затем `wild = count(WILD)` (НЕ `raw` — с эффектом Учёных;
   комментарий форка) раздаётся по одному на меньшую сторону, `production = min(earth, venus)`, `production.add(…, {log: true})`. **Нет** `cardPlayPreview`,
   **нет** `countedPlayForecast` → гард `cardPlayPreviewCoverage` («customizes its play … hooked, declarative, or an explicit dynamic fallback») падает с именем карты,
   плита руки пуста, композер показывает розыгрыш БЕЗ результата (производство — скрытый фиксированный результат, ровно то, что чеклист запрещает).
   Манифест `:66` — `compatibility: 'venus'` ✓; политики нет.
2. **Чтение скана (§0):** «11» — цена; плашки требования НЕТ; кружки — планета (Юпитер) + «V» (Венера) — метки; рамка действия `→ [аэростат]` с подписью
   «(Action: Add 1 floater here.)»; ниже коричневый блок производства `1 / [Земля][Венера]` с текстом «(Increase your M€ production 1 step per set of Earth and
   Venus tags you have. 1 VP per 3 floaters here.)» — «set» = ПАРА, «/» = «за каждый набор»; «P69»; ПО-бейдж «1/3 [аэростат]»; слева внизу — Prelude 2 («<») и
   Венера («V»); лор — курсив. Апстримное `description` («…pair … you own. 1 VP for every 3rd floater…») — тот же смысл, две темы в одном ключе (решение 2).
3. **СЧЁТ ПАРАМИ — базис не выразим (КЛАСС, раздел CV).** `ActionEffectBasis` знает: ОДНУ метку (`tag`), ИЛИ-ряд меток (`tags` — P85 «за каждую планетную
   метку»: `countGlyphsOf` рисует РЯД, `termWords` — «Ваши метки (Юпитер, Земля, …)»), долю ДЖОКЕРОВ (`wild` — «в т.ч. любых: N»), перепись (`parts`), сумму терминов
   (`summedTermsOf` — «3 + 2 → +5»). Пара = `min(E, V)` — ни одно: термин `{tags: [EARTH, VENUS], count: 2}` прочтётся «Ваши метки (Земля, Венера) 2 → +2» — игрок с
   3 Землями и 1 Венерой увидит «4?» или «2?» без объяснения; два термина суммой — «Земля 3 + Венера 1 → +1» — арифметическая ложь (3 + 1 ≠ 1). И ДЖОКЕР здесь не
   «доля в счёте», а РАЗДАН картой на конкретную сторону — «в т.ч. любых: 1» у целого ничего не говорит, куда он лёг. → решение 3: новый член базиса — ТЕРМИН-НАБОР.
4. **Что даром (проверить «до» на боксе или в юните, не переоткрывать):** лицо — `1/3 [аэростат]` (`formula`), чип `1 / [E][V]` (`slash().tag().tag()` — P85 /
   Soil Studies рисуют так же), иконка аэростата; действие — `ActionCard.canAct` через `canExecute` (всегда true, кроме «уже использовано»), превью действия авто
   (`singleBranch`: чип «+1 аэростат на эту карту», `note: 'on this card'`), `actionReasonCoverage` — декларативно; «ДЕЙСТВИЯ КАРТ» — композер, блок «ПРОГРЕСС ПО»
   (`actionVpProgress`: порог 3 — «0/3 → 1/3», на третьем — `crossed`, «ПО 0 → 1»), ACTION COMMIT категории `resources` — жетон рождается на печатном `[аэростат]`
   значка действия, садится в капсулу hero-карты, счётчик тикает на посадке, workspace стоит до посадки и уходит (PL-063); на ТРЕТЬЕМ аэростате — ячейка ПО тикает на
   посадке (TR55 закон 4, «on landing»); роль держателя на спутнике «ДОП. РЕСУРСЫ» — ПО-роль (`holderRoleOf`); `actionFutility` — не нужен (добавить аэростат —
   всегда полезно); оплата — ТОЛЬКО M€ (Юпитер — не Космос, Венера — не Стройка: ни титана, ни стали), **но аэростатами Dirigibles / жаром Stormcraft — да**
   (`CARD_FOR_SPENDABLE_RESOURCE`: Венера-карта — PL-163 жетон цены с ряда оплаты); «Сработает» на Юпитер — Saturn Systems (ЛЮБОЙ игрок; forecast-двойник есть) +
   что найдёт `grep -l "onCardPlayed" ∧ JOVIAN|VENUS` по скоупу (Titan Holdings — по `TITAN_TAGS`); MarsBot: корпорации бота, читающие Юпитер (`grep JOVIAN
   src/server/automa/corps`) — дивиденды бота, не твоя работа; стол бота с `prelude2Expansion` БРОСАЕТ (`AutomaSetup.validateOptions`) → спек кладёт карту в руку
   на Венера-стол без опции (гоча P76). Хуков-реакторов у P69 нет → forecast-двойника нет; целей нет → NO-AUTO-SELECT не касается.
5. **Текст карты.** Бespoke без `behavior` → генератор посеет `description` целиком одним блоком «immediate» (две темы в одном блоке), а ПО-группу сгенерирует
   ОТДЕЛЬНО из `victoryPoints` (Extremophiles: «1 VP for every 3rd Microbe on this card.») — ПО-правило дважды; гард `cardInformation` § «VP-only description must
   not seed a phantom on-play block» и § порядок блоков. → решение 2: `description` — одно предложение розыгрыша, `infoText` одним блоком с токеном
   `production(megacredits)`, ПО-блок — даром.
6. **Журнал розыгрыша.** `production.add(…, {log: true})` — типизированная строка под записью розыгрыша; базис («за 2 пары») на событие производства НЕ ложится
   (`countedResourceBasis` — только для `card-resource-changed`). Проверить «до», как сегодня читается журнал P85 (декларативный счёт с `tags`) — если и там без
   причины, это общий кандидат («ПОЧЕМУ в журнале»), записать в реестр наблюдением, НЕ чинить в этой задаче.
7. **Spec апстрима** (`tests/cards/prelude2/CloudTourism.spec.ts`): таблица `playTests` (11 строк, джокер к меньшей стороне), таблица Earth Embassy
   (`moonExpansion: true` — оставить байт в байт, Луна вне скоупа, правило живое), `it` Учёных (форковский — уже есть), `it('action')`. Весь блок — байт в байт.
8. **Локаль.** RU-имя «Облачный туризм» (`ru/prelude_cards.json:16` — апстримный файл Prelude 2 лежит в `prelude_cards.json`, не в `prelude2_cards.json`) — оставить;
   RU двухтемного описания (`:17`) есть — ключ, если разделить, станет НОВЫМ (старый RU не трогать, он апстримный); RU действия — ключ Local Shading, есть.
   Лора `P69` и арта нет.

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Синяя, 11, Юпитер + Венера, ПО `1 за 3 аэростата`, без требования; P69; `compatibility: 'venus'`; оплата — M€ (+ аэростаты Dirigibles / жар Stormcraft на столе);
   титан и сталь НЕ предлагаются.
2. Розыгрыш: `pairs = min(E, V)`, где `E = raw Земля`, `V = raw Венера + 1` (своя метка); каждый джокер (печатный ИЛИ эффект Учёных под Redux) ложится на меньшую
   сторону (при равенстве — на ВЕНЕРУ, как в коде: `earth < venus ? earth++ : venus++` — пинить спеком), ровно один раз; `production.add(M€, pairs)` (0 → запись «+0»? — нет: при 0
   пар производство не меняется, превью — честный ноль с именованной причиной, см. п. 4); Earth Embassy — как апстрим.
3. Действие: 1 аэростат на эту карту, раз в поколение; `canAct` — всегда, пока не использовано; превью действия — один чип `+1 аэростат` «на эту карту»;
   ПО = ⌊аэростаты / 3⌋ (0, 1, 2 → 0; 3 → 1; 5 → 1; 6 → 2) — живой `getVictoryPoints`, лицо, спутник.
4. Превью розыгрыша (`cardPlayPreview`) = `countedPlayForecast` = ОДИН чип `productionChange(M€, pairs)` с базисом-НАБОРОМ (решение 3): стороны `[Земля] E`,
   `[Венера] V` (своя метка включена — и НАЗВАНА: «в т.ч. эта карта: 1»), доля джокера на КАЖДОЙ стороне, `count = pairs`; при 0 пар — чип «+0» и честный ноль
   словами, называющий ПУСТУЮ сторону («Нет меток Земли» / «Нет меток Венеры, кроме этой» — ключи); read-only (снимок состояния до/после); `make:cards` 0 / 0 / 0.
5. Раздача с Venus + Prelude 2 — есть; без Venus — нет; MarsBot-стол — ничего особого; save / reload с открытым композером — ничего нового; действие в том же
   поколении, что розыгрыш, — доступно.

### Решения — ПРИНЯТЫ (карта тривиальная; вопросов владельцу НЕ задавать — `AskUserQuestion` только на exit 2/3/4 бокса или на ветку позади; в отчёте — что сделано по каждому)
1. **RU** — имя «Облачный туризм» оставить; RU нового ключа описания: «Увеличьте своё производство M€ на 1 за каждую пару ваших меток Земли и Венеры (считая метку
   этой карты).»; RU `infoText` — тем же текстом (`card_info.json`); лор RU — «Уникальные виды спорта и невероятные закаты в отелях, парящих среди облаков.»
2. **Текст** — `metadata.description: 'Increase your M€ production 1 step for each pair of Earth and Venus tags you have, this card included.'` (НОВЫЙ ключ; старый
   двухтемный остаётся в RU-файле нетронутым), `infoText: [{text: <тот же>, tokens: ['production(megacredits)']}]` (ОДИН блок; ПО-блок и блок действия — даром);
   `resourcesHere: {}`.
3. **ТЕРМИН-НАБОР в базисе** (диагноз 3, раздел **CV**) — `ActionEffectBasis.set?: ReadonlyArray<{tag: Tag, count: number, wild?: number,
   self?: number}>` — «счёт ПОЛНЫХ НАБОРОВ: `count` термина = min по сторонам; каждая сторона — своя метка, свой счёт, доля джокера, ЛЕГШАЯ на неё, и доля
   собственных меток карты» (исключительно с `tag` / `tags` / `parts`; ключ `label: 'Your tag sets'`, в словах — «пар»); сервер считает ВСЁ (функция карты),
   клиент не делит и не вычитает: `countedPlay.ts` — `countGlyphsOf` для набора = ряд сторон, КАЖДАЯ со своей цифрой (а не ряд иконок с одной цифрой на всех), между
   сторонами — печатный разделитель набора (тот же `PremiumMechNode`-ряд, что лицо рисует после «/»); `termReading` → «[Земля] 2 · [Венера] 2 (в т.ч. [любая] 1 ·
   эта карта 1) → 2 пары → +2 производства M€»; `ConsoleCountedWhy.vue` — ветка набора с `[data-count-set-side="<tag>"]` и `[data-count-set-side-n]`, итог —
   `data-count-why-total = pairs`; инспектор «ДЛЯ ВАС» — та же строка через `countedWhyRow`; плита руки — «[производство M€] +2» (даром, `countedPlay`); честный
   ноль — `zero` термина называет пустую сторону; спеки `countedPlay.spec` (набор: чтение, ноль, джокер на стороне), `ConsoleCountedWhy.spec`. Отвергнуто диагнозом, не
   предлагать: два термина СУММОЙ с подписью «мин.» (читается как сложение); один термин `tags` + число пар (не говорит, откуда число).
4. **Своя метка — названа, не спрятана.** Печать считает метку САМОЙ карты (V + 1); в «ПОЧЕМУ» сторона Венеры несёт «эта карта 1» (`self`), иначе игрок с 0 Венер на
   столе читает «Венера 1» и не верит (вытекает из 3).
5. **Свой e2e-стенд — ДА**, `tests/e2e/console-cloud-tourism.spec.ts`, ТРИ фикстуры одного рецепта (2p, Venus + Prelude 2; Redux НЕ нужен): `cloud-tourism` — у p1
   корпорация с меткой Земли (Teractor) + на столе Cartel (Земля) и Sulphur-Eating Bacteria (Венера) → E = 2, V = 1 + 1 = 2 → **2 пары**; P69 в руке, 15 M€;
   `cloud-tourism-wild` — то же + Research Coordination (печатный джокер) на столе, Венер на столе 0 → E = 2, V = 0 + 1 = 1, джокер → на Венеру → 2 пары, «ПОЧЕМУ» называет
   джокер НА СТОРОНЕ Венеры; `cloud-tourism-vp` — P69 УЖЕ на столе с 2 аэростатами, действие не использовано → A в «ДЕЙСТВИЯХ КАРТ» кладёт третий: «ПРОГРЕСС ПО 2/3 →
   3/3», ячейка ПО рельса тикает на посадке. Клетки: (1) розыгрыш — плита руки «+2», композер: чип «+2 производства M€ (N → N+2)», строка «ПОЧЕМУ» = набор из двух
   сторон с цифрами и итогом «2 пары», курсор на CTA, 0 POST; A → ОДИН POST → карта на стол с бейджем «1/3 [аэростат]», сервер: производство +2; (2) тем же ходом —
   «ДЕЙСТВИЯ КАРТ» › Облачный туризм › композер (чип «+1 аэростат», «ПРОГРЕСС ПО 0/3 → 1/3») → A → ОДИН POST → жетон рождён на печатном значке аэростата
   (`data-graphic-node`), сел в капсулу hero, счётчик `0 → 1` на посадке, флоу ушёл, плитка «Активирована»; `transferWitness`: born `graphic:…`, landed `hero`,
   `endsOverGlass` пуст; (3) `-wild` — «ПОЧЕМУ»: Венера `2 (в т.ч. [любая] 1 · эта карта 1)`; (4) `-vp` — действие: «ПРОГРЕСС ПО 2/3 → 3/3 · ПО 0 → 1», посадка →
   ячейка ПО `+1` на посадке (свидетель `rail:vp`, причина названа), сервер `getVictoryPoints` = 1. Сухой прогон каждой фикстуры на копии (как P68).
6. **Журнал серии / доки** — запись P69; `PRELUDE2_ADAPTATION.md` — «6 / 54», строка; §3.1 п. 2 — одно предложение («bespoke-счёт без вопроса: одна функция счёта
   для `bespokePlay` / `countedPlayForecast` / `cardPlayPreview`; счёт НАБОРАМИ — термин `set`»); `docs/claude/console/effect-forecast.md` или где описан «ПОЧЕМУ» —
   абзац про набор; память `prelude2-adaptation.md` (6 / 54). Наблюдение диагноза 6 — строкой в CV, без правки.
7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `25e7aca7b3`. **Сначала** `ListAgents` + процессы; `SendMessage` обоим соседям (список их файлов — в шапке): твои файлы —
   `prelude2/CloudTourism.ts`, `tests/cards/prelude2/CloudTourism.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка), арт P69 (`assets/card-images/P69.webp`
   + миниатюра, `genfiles/cardArtManifest.json`), `assets/text/lore_texts.json` (одна строка), `ru/{prelude_cards,card_info,lore_texts}.json`, `src/genfiles/*`;
   **по решению 3** — `common/models/ActionPreviewModel.ts`, `console/countedPlay.ts`, `components/console/ConsoleCountedWhy.vue` (+ `console*.less` для ряда набора —
   `console.less` ДЕРЖИТ СОСЕД: стили набора — в тот файл, где живёт `.con-cwhy`, если это не `console.less`; иначе согласовать ханк), `cards/actionPreviews.ts`
   (хелпер `tagSet(...)` рядом с `counted`), спеки `tests/client/console/countedPlay.spec.ts` / `tests/client/components/console/ConsoleCountedWhy.spec.ts` /
   `tests/models/countedPlayForecast.spec.ts`; фикстуры + стенд; доки, журнал, реестр — своими ханками. Коммиты явными путями; пуш после каждого.
2. e2e — только бокс; `FIXTURES=cloud-tourism,cloud-tourism-wild,cloud-tourism-vp npm run e2e:fixtures`; `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 25 %)
- `CloudTourism.ts`: **`private pairCount(player): {earth, venus, wild: {earth, venus}, self: 1, pairs}`** — ЕДИНСТВЕННАЯ реализация счёта (перенести тело
  `bespokePlay` сюда, включая Earth Embassy и раздачу джокера); `bespokePlay` → `production.add(M€, this.pairCount(player).pairs, {log: true})`;
  `countedPlayForecast(player)` → `[counted(productionChange(player, M€, pairs), tagSetBasis(…))]` (термин-набор решения 3: стороны, джокер по сторонам, `self`,
  `count = pairs`, `zero` — ключ пустой стороны); `cardPlayPreview(player)` → `playPreview(this, player, this.countedPlayForecast(player))` (форма Interplanetary
  Trade; шагов нет). Снимок состояния до/после превью в спеке (purity).
- `description` + `infoText` (решение 2); `resourcesHere: {}`; лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P69.png" P69`
  → `make:cards`); RU новых ключей; строка `CLOUD_TOURISM` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт (все три таблицы + Учёные + action); `describe('premium')`: правила 1–5 по одному `it` — лицо/цена/метки/ПО по
  таблице (0…6 аэростатов), оплата только M€ (без титана и стали), с Dirigibles на столе — аэростаты в оплате; превью = forecast = `bespokePlay` число в число на
  таблице `playTests` (включая джокеры и раздачу по сторонам — базис называет, КУДА лёг джокер), `self: 1` на стороне Венеры, ноль пар — чип `+0` + `zero` пустой
  стороны, read-only; `countedPlayEffects` на модели руки = те же чипы; действие — превью один чип «на эту карту», третий аэростат → `getVictoryPoints` 1; раздача с
  Venus + Prelude 2 / без Venus; MarsBot-стол (карта в руку без опции); save / reload.

## 2. Клиент — карта (≈ 10 %) и класс (§3.Б)
Даром: лицо, превью действия, композер действия с «ПРОГРЕСС ПО», ACTION COMMIT в капсулу, ячейка ПО на посадке, спутник. Класс — термин-набор (§3.Б).

## 3. ГЛАВНОЕ — ПРОХОД ОБОИХ ПУТЕЙ И СТЕНД (≈ 65 %)
Форма — чек-лист P76 A–M; здесь — чем P69 отличается:
- **A/B.** Плита руки — «[производство M€] +2» (`data-hand-count`); X — лицо: `→ [аэростат]` / `1 / [E][V]` / ПО `1/3`; блоки: действие · розыгрыш · ПО; лор; «ДЛЯ
  ВАС» — строка набора («[Земля] 2 · [Венера] 2 → 2 пары → +2 производства M€»).
- **C. Композер розыгрыша.** Чип «+2 производства M€ · N → N+2»; «ПОЧЕМУ» — набор из двух сторон, каждая со своей цифрой, джокер и «эта карта» на стороне, итог
  «2 пары»; оплата — только M€ (ни титана, ни стали в оплате — проверить, что композер их НЕ предлагает); курсор на CTA; 0 POST.
- **D. Коммит розыгрыша.** ОДИН POST; цена с рельса; ряд производства M€ тикает на посадке награды из значка карты (награда розыгрыша — из центра карты, гоча P76:
  не переоткрывать); карта в таблицу с бейджем `1/3 [аэростат]` (0 ПО); флоу ЛЕВИТ.
- **E. Действие (тот же ход).** «ДЕЙСТВИЯ КАРТ» › плитка (доступна) › композер: чип «+1 аэростат на эту карту», «ПРОГРЕСС ПО 0/3 → 1/3» → A → ОДИН POST → жетон
  рождён на печатном значке аэростата в рамке действия (`data-graphic-node`, НЕ координаты), сел в капсулу hero, счётчик `0 → 1` на посадке, workspace стоит до
  посадки, уходит; плитка «Активирована». `-vp`: «2/3 → 3/3 · ПО 0 → 1», ячейка ПО рельса `+1` на посадке с причиной (`[data-vp-reason]` или жетон `rail:vp`).
- **F/G/H.** Журнал розыгрыша — строка производства под записью (диагноз 6 — только наблюдение); журнал действия — «+1 аэростат на Облачный туризм»; соперник —
  уведомление о розыгрыше с чипом производства.
- **I. «Сработает».** Юпитер — Saturn Systems (чужой тоже: владелец SS получает), Венера — что найдёт grep; ряд честен, джокер Учёных — на стороне.
- **J. Края (сервер).** Джокер при равенстве сторон → Венера (код), при 3 Землях и 1 Венере два джокера → Венера, Венера; 0 Земель → 0 пар с причиной; Earth Embassy — апстрим.
- **K/L/M.** Как у P76 (save/reload с открытым композером; X из «ДЕЙСТВИЙ КАРТ» — осмотр hero).

### 3.Б Класс «термин-набор» (решение 3, раздел CV)
`ActionPreviewModel.ts`: член `set` с комментарием-контрактом (счёт полных наборов; сервер считает всё); `actionPreviews.ts`: `tagSetBasis(sides, pairs, zero)` — чистый
билдер рядом с `counted`; `countedPlay.ts`: `setSidesOf(term)`, чтение в `termReading` / `countedWhyRow` («N пар» — `{pair|pairs}` группа множественного числа),
`countGlyphsOf` для набора — стороны С цифрами; `ConsoleCountedWhy.vue` — ветка набора (`[data-count-set-side]`), стиль — кант/вес, НИКАКОГО свечения
(`glowRestraintGuard`); спеки; `effect-forecast.md` / доки «ПОЧЕМУ» — абзац; `composer`-юниты P85 (`summedTermsOf`) не меняются (регрессия: стенд P85).

## 4. Лицо, локаль, лор, арт
Арт P69; лор EN + RU; новые ключи: описание (решение 2), `Your tag sets`, «эта карта» («this card»), ключи пустых сторон, `{pair|pairs}`; grep ДО добавления; чужой
RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack`, `premiumScope`, **`cardPlayPreviewCoverage`** (хук), **`countedPlayForecast`** (плита), `cardInformation` (ОДИН блок,
   ПО не дважды, порядок), `requirementProse`, `premiumCardViewModel`, `premiumCardIcons`, `cardLore`, `crossPlayerCoverageGuard`, `actionReasonCoverage`,
   `actionPreviewCoverage`, `actionCaption` (27 симв. — в норме), `effectExtraction` / `actionExtraction` («Flagged» — нет), `holderRoles` (ПО-роль), `e2eLiveness`,
   `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`, спеки класса (§3.Б).
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×3 фикстуры; `npm run e2e:affected`; регрессия — канарейка, `console-summit-logistics` (сумма терминов не изменилась), `console-ceres-tech-market`
   (один термин), `console-action-confirm`, `console-blue-action-receive` (композер действий), `console-nuclear-warhead-utilization` (ячейка ПО — если тронут путь),
   `console-self-target` (hero-колонна), `grep -l "data-count-why\|data-count-term" tests/e2e` — все.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/p69/{tv4k,fhd}/`: (а) плита руки «+2»; (б) композер розыгрыша с чипом и «ПОЧЕМУ»-набором (две стороны, итог «2 пары»); (в) `-wild`: джокер на стороне
Венеры; (г) коммит розыгрыша: ряд производства тикает; (д) «ДЕЙСТВИЯ КАРТ»: композер с «ПРОГРЕСС ПО»; (е) жетон со значка в капсулу, счётчик; (ж) `-vp`: третий
аэростат — ячейка ПО. Своим глазом: «я вижу, СКОЛЬКО пар и ИЗ ЧЕГО они сложились (куда лёг джокер, что своя метка считается), ОТКУДА прилетел аэростат и ПОЧЕМУ
ячейка ПО тикнула?»

## 7. Полировка по пути
1. Реестр **CV** «P69 · СЧЁТ ПАРАМИ — ОДИН ТЕРМИН С ДВУМЯ СТОРОНАМИ, ДЖОКЕР РАЗДАН И НАЗВАН» — решения 2–4 строками + находки прохода + наблюдение диагноза 6;
   номера — по footer. Без гэпов — только журнал.
2. Доки: журнал серии (P69); `PRELUDE2_ADAPTATION.md` (6 / 54; строка; §3.1 п. 2); абзац «ПОЧЕМУ»-набора; память `prelude2-adaptation.md` (6 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — «до» (юнит или бокс): что композер и плита руки показывают для P69 без хука; что «ПОЧЕМУ» нарисует с термином `tags`
   (чтобы отчёт содержал кадр лжи, которую класс убирает); как журнал читает счётное производство P85. Порядок: карта (функция счёта, хуки, описание, `resourcesHere`)
   + спек + строка долой → лор / арт / RU → `make:cards` → решение 3 (класс + юниты) → фикстуры + стенд (клетки 1–4) → проход A–M + «после» → CV → доки / журнал /
   память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после»; таблица A–M с кадрами; POST на розыгрыш и на действие; гарды и `make:cards`; регрессия на
   боксе (аннотация `build`); решения 1–7 (что сделано по каждому — без вопросов владельцу: все приняты в промте); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Вторая реализация счёта (превью / плита / розыгрыш — ОДНА функция карты); клиентская арифметика пар (min, вычитание джокера — только сервер); термин `tags` или
  сумма терминов вместо набора; скрытый фиксированный результат (композер без чипа производства); прятать свою метку в счёте; `title`; литерал кнопки; ореол;
  таймер вместо холда; синтетический источник жетона (только печатный значок).
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; править файлы
  соседей (шапка) — особенно `ConsoleShell.vue`, `consolePlayedHero.ts`, `console.less`; переоткрывать находки P76…P78; чинить журнал производства (диагноз 6) в этой
  задаче; трогать Earth Embassy / Луну.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить чужие файлы; пересборку во время прогона e2e на боксе.
