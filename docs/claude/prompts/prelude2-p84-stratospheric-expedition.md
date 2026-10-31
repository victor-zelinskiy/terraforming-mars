# Промт исполнителю · P84 Stratospheric Expedition («Экспедиция в стратосферу») — ДЕВЯТНАДЦАТАЯ карта Prelude 2, не политическая, Venus (`docs/PRELUDE2_ADAPTATION.md` §3.1, форма 1 — ДЕКЛАРАТИВНАЯ): красная (EVENT), 12 M€, метки Венера + Космос, 1 ПО; «Добавьте 2 аэростата на ЛЮБУЮ карту. Доберите 2 карты Венеры» — `behavior: {addResourcesToAnyCard: {count: 2, type: FLOATER}, drawCard: {count: 2, tag: VENUS}}` — ОДНО НАЖАТИЕ, ДВА ЭФФЕКТА РАЗНОЙ ПРИРОДЫ: пре-коллектом выбранный держатель (T14 / CU — «КУДА ЛЯЖЕТ») получает 2 аэростата, затем поиск по метке Венеры в колоде (лента + лоток, класс P76). Карта — ≈ 15 % (всё даром: пре-коллект цели, поиск по метке, оплата титаном за Космос, ПО-жетон) · ПОЛИРОВКА (≈ 85 %) — выбрана сама: **СОБЫТИЕ ПЛАТИТ ЛИЦОМ** — сцена «КАРТЫ В РУКЕ › <карта> › РАЗЫГРАНО» для СОБЫТИЯ: сейчас событие переворачивается РУБАШКОЙ ЕЩЁ В ПОЛЁТЕ (`HERO_FLIP_START_T .32 → .82`), ложится на стопку «СОБЫТИЯ» в правом нижнем углу пустой полосы, и все его награды — ПО, РТ, склад, аэростаты на держателя — рождаются ИЗ РУБАШКИ (`heroRewardSourceSelectors` → `.con-recv__backpile`; гэп P76 №1 «вынесено владельцу», не чинился 2026-10-29…11-01); вдобавок у ЛЮБОЙ карты складская награда рождается из ТЕЛА карты, а не с печатного значка (гэп P76 №2 — `heroGainOrigin` знает только канал `card-resource`; ACTION COMMIT той же карты рождает с значков — две двери одного закона расходятся). Физическая правда (CLAUDE.md § Physical causality: «a card always leaves from its real on-screen source … where did this come from»): событие разыгрывают ЛИЦОМ, оно платит со своих печатных значков, и ТОЛЬКО ПОТОМ переворачивается и ложится на стопку. P84 — стенд: два разных рождения (аэростаты → на выдвинувшегося держателя; добор → лента поиска) + ПО-жетон с печатного «1» + оплата титаном с рельса

> **Статус: ВЫДАН 2026-11-01.** HEAD `890f086476` (P81 — карта `9b610fccaf` в main, раздел **DJ** (PL-1300…1311) — ЛИСТ РОЗЫГРЫША ещё доделывается соседом; ворклист **18 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись ДЕВЯТНАДЦАТАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты (включая решение 3 — оно МЕНЯЕТ два записанных закона,
> владелец предупреждён в выдаче промта; если владелец отзовёт — `AskUserQuestion` не нужен, стоп по его слову); `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> ⚠ **СОСЕДИ** (`ListAgents`: `terraforming-mars-b0` — занят, `-7b` / `-84` — свободны). Грязны в момент выдачи: `ConsolePlayCardConfirm.vue`, `ConsolePaymentPanel.vue`, `ConsoleShell.vue`,
> `ConsoleTaskHost.vue`, `ConsoleColoniesSection.vue`, `ConsoleParliamentSection.vue`, `ConsoleSourceDock.vue`, `consoleLeakDetector.ts`, `paymentPlan.ts`, **`played/payloadCarry.ts`**, `promptSource.ts`,
> `screenDirector.ts` (+ `scripts/screen-shadow-report.mjs`), `Game.ts`, `PlayerInputModel.ts`, `console-ui.md`, `workspace-band.md`, доки серии. **Твоя область — ЧИСТА**: `consolePlayedHero.ts`,
> `playedHeroModel.ts`, `playedHeroDirector.ts`, `receivingStageModel.ts`, `ConsolePlayedReceivingStage.vue`, `ConsolePlayedHeroLayer.vue`, `ConsolePlayedEventsPile.vue`; `payloadCarry.ts` — НЕ трогать
> (сосед); `workspace-band.md` / `console-ui.md` — свои абзацы объявленным ханком ПОСЛЕ коммита соседа. ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`; `SendMessage` занятому со списком §0.
> `package.json` / `package-lock.json` (`MM`) — не твои.
> Промты-образцы: **`prelude2-p76-ishtar-expedition.md`** (событие + поиск по метке — стенд `console-ishtar-expedition`, фикстура `ishtarExpeditionFixture` с лентой `ISHTAR_TAPE`; ЕГО «Найдено» №1 / №2 —
> ровно то, что ты чинишь), `prelude2-p78-l1-trade-terminal.md` (класс CU — посев всех кандидатов, цель «КУДА» пре-коллектом; `console-l1-trade-terminal`), `prelude2-p82-special-permit.md` (свидетель
> идентичности как форма «ДО/ПОСЛЕ»), `docs/claude/console/workspace-band.md` § РОЗЫГРЫШ КАРТЫ / § РТ РОЗЫГРЫША / § ЦЕНА РОЗЫГРЫША С РЕЛЬСА (PL-107 — такт ПОСТАВКИ: «у события после посадки иконок нет —
> она лежит рубашкой» — ТА ЖЕ причина, по которой цена уходит ДО взлёта; после решения 3 у события ЕСТЬ лицо после посадки), `docs/claude/console/play-card-result.md`, `played-table.md`,
> `docs/claude/console/card-draw-motion.md` (лента поиска), `.claude/rules/console-ui.md` § A CARD PLAY'S RESULT BELONGS TO THE WORKSPACE (гейт посадки, `playLandingHolding`, «ONE PRESS, SEVERAL EFFECTS»),
> § THE ENDS OF A FLIGHT ARE VISIBLE (T06 — конец как ОБЪЕКТ, перемер при рождении; `heroRewardPlace` — первое ВИДИМОЕ место), § ПРИЁМ РЕСУРСА КАРТОЙ (PRESENT · PAY · READ · RETURN —
> `receiveOnStage`, PL-1146 волна приёма), § ЯЧЕЙКА ПО (TR55 — ПО-жетон с печатного `.pcard__vp`, `data-vp-emit`), `.claude/rules/animations.md`, CLAUDE.md § Physical causality, § Project goals 3.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P84.png` (**проверено: 1536×1024** — скрипт примет без `--force`).
> Скан — `C:\Users\zelin\Downloads\Stratospheric Expedition.png` (в `Downloads` корнем).
> Лор — СО СКАНА, дословно: «Investigating suitability for atmospheric projects at different altitudes on Venus» (без точки — добавить; гард лора); «STRONGHOLD GAMES» на арте — издатель, не лицо.
> Реестр: последний раздел **DJ** (P81), последний номер **PL-1311** → эта задача берёт **DK**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p84` → `npm run e2e:remote -- p84 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL (порядок —
> запись `MutationObserver` + `setInterval` + `transferWitness`), темп посадки — TIMING и только A/B против HEAD в одном снапшоте (`ab-baseline`); раскадровка — TV (`TM_E2E_STORYBOARD=1`) + fhd.
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 1**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P76…P81 — не переоткрывать, КРОМЕ двух гэпов P76 «Найдено» №1–2, которые эта задача закрывает:
№1 «награда события рождается на РУБАШКЕ», №2 «складская награда — из центра карты, не из печатного значка»; №3 reload — не трогать), `docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7, CLAUDE.md
§ Physical causality, § A WORKSPACE IS ONE FLOW (RELEASE → UNFOLD → REVEAL; «frame, band, rail and the carried card do not move»), инварианты 4, 6, 14, 15, 16, 17 (`reactivePredicate` — любой предикат, который
читает кэш). Память: `rules-first`, `upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `ab-baseline-head-client-in-snapshot`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`,
`push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `trivial-card-prompts-no-owner-questions`, `visual-restraint-no-glow`, `panel-reward-hold-is-shared` (сцена отпускает только свои холды),
`hand-pick-played-card-hidden`, `prelude2-adaptation`.

**Образцы — по частям.** Карта: `prelude2/StratosphericExpedition.ts` (EVENT, 12, `[VENUS, SPACE]`, `victoryPoints: 1`, `addResourcesToAnyCard: {count: 2, type: FLOATER}` — без `mustHaveCard` (нет держателя →
розыгрыш состоится, аэростаты — ИМЕНОВАННЫЙ пропуск: `Behavior.ts:70, :225–243` — проверить предупреждение превью «аэростаты некуда положить»), `drawCard: {count: 2, tag: VENUS}`, рендер
`resource(FLOATER, 2).asterix().cards(2, {secondaryTag: VENUS})` — звёздочка ПЕЧАТНАЯ («на любую карту»), `description` — RU есть `ru/cards.json:709`), манифест `Prelude2CardManifest.ts:78` (`compatibility: 'venus'`),
RU-имя «Экспедиция в стратосферу» (`:708`); апстримный спек — один `it` (Jovian Lanterns + Search for Life → `SelectCard`, 2 карты Венеры в руке). Сцена розыгрыша: **`console/played/consolePlayedHero.ts`**
(2451 строка) — фазы `PlayedHeroPhase` (`playedHeroModel.ts:36–45`: `armed → shipping → preparing → flying → landed → showing-result → returning …`), ПОЛЁТ `:1040–1130` (прокси героя, `heroFlipAt` —
`playedHeroModel.ts:93–95, :229–240`: `HERO_FLIP_START_T .32 / END .82` — переворот в СЕРЕДИНЕ дуги, лицо/рубашка меняются на 90°), ПОСАДКА → `showing-result` `:1570–1700` (такт награды: `TRANSFER_READ_MS` →
`heroRewardSourceSelectors` → `receiveSteps` держателей (`receiveStepOnStage`, PL-1146) → `railWaveWithPrintedVp` → ПО-жетон → РТ `flyRailReward(heroRailOrigin)` → `told` → `skippablePause`),
**`heroRewardSourceSelectors` `:1951–1972`** (лестница мест: `[data-embed-source-slot]` → `.con-recv [data-recv-front] .con-recv__face` → `[data-recv-front]` → **`.con-recv__backpile`** → стол «Разыграно»
→ **`.con-played__family--event .con-played__backstack`** — «An EVENT lands face-down on the events backstack — its rewards emerge from the pile (the card's honest on-table location)»), `heroRewardPlace`
`:2203–2213` (первое ВИДИМОЕ место), **`heroGainOrigin` `:2230–2245`** (ТОЛЬКО `card-resource`: печатный значок ресурса в ON-PLAY-ряду вне `.pcard-effect`; иначе `undefined` → общая точка карты), `heroWildOrigin`,
`heroTagOrigin`, `heroRailOrigin` (`:1976–1980` — «an EVENT lies face-down on its pile — and the token is born on that place»), `vpReleaseOnTouchdown`, `pendingWaveSpecs`; **`ConsolePlayedReceivingStage.vue`**
`:40–62` (назначение «events» — `.con-recv__backcol` → `.con-recv__backpile` (`--deep`) → `[data-recv-front].con-recv__front--back` с `con-card-back` при `revealed` — «the incoming card lands face-down on top
(the flip rides the hero arc)»), `:63–75` (face-up назначение — слои, полоски, `[data-recv-front] .con-recv__face`), `:144–156` (слой ВЫДВИЖЕНИЯ держателей `.con-recv__emerge` — `[data-played-key]`,
`ConsolePlayedCardLite` с живой капсулой), `.con-recv__air` `:41` («The air above the shelf — also the emergence presentation space»), `receivingStageModel.ts` (`ReceivingPlan` — zoom / slotW / cardH,
`isEvents :296`), `ConsolePlayedHeroLayer.vue` (прокси полёта), `playedHeroDirector.ts`, `ConsolePlayedEventsPile.vue` (стопка «Разыграно»); ACTION COMMIT — образец рождения со значков:
`consoleActionCommit.ts` `resolveGainIconEnds` / `resolveSpendIconOrigins` (k-й жетон — на k-й значок; производство — на плите; `data-graphic-node` + спрайт-URL), `consoleActionCommitRail.ts`.
Законы, которые задача МЕНЯЕТ (решение 3): `.claude/rules/console-ui.md` § «…AND SO IS A CARD PLAY'S» («an EVENT's from its face-down pile»), `workspace-band.md` § РТ РОЗЫГРЫША (`:441` «у СОБЫТИЯ — на
стопке рубашкой»), § ЦЕНА РОЗЫГРЫША (`:472` «у события после посадки иконок нет»), `playedHeroModel.ts:93` («The event flip occupies the MIDDLE of the arc»); стенды, которые их пинят: **`console-play-tr-reward.spec.ts`**
(`:18`, `:39–41` — Bribed Committee: «the TR token from the event's pile»), **`console-x87-shipment-to-earth.spec.ts:29–30, :454–461`** («the TR is born on the face-down pile»),
`console-play-landing-geometry.spec.ts:72, :159, :571, :602` (геометрия посадки события — «against the pile's back»), `console-ghg-shipment`, `console-ishtar-expedition`, `console-strategic-shift`,
`console-played-table`, `console-l1-trade-terminal` — 8 спеков читают `__backstack` / `recv:front` / стопку события (контракт 14: перенацелить в том же диффе). Кадры «как сейчас»:
`screenshots/p76/tv4k/story-play/t01034.jpg` (событие лежит рубашкой в углу пустой полосы), `t01343.jpg` («+3» ПО тикнул, жетон родился из рубашки), `screenshots/x87-shipment-to-earth/` (если есть).

---

## Диагноз (подтверждён файл:строка на `890f086476`; перепроверить на своём HEAD)

### Карта
1. **Декларация полная.** `addResourcesToAnyCard {count: 2}` → композер розыгрыша: пре-коллект «КУДА» (T14 — один держатель посеян и показан; CU — ≤ мест → все посеяны; держателей ≥ 2 → выбор одного:
   `autoselect: false`), `drawCard {count: 2, tag: VENUS}` → лента поиска (P76). Проверить «до»: (а) превью без держателя аэростатов — именованный пропуск («Аэростаты некуда положить — 2 аэростата
   пропадут», инвариант 4), карта играбельна; (б) порядок двух эффектов одного нажатия на сцене: аэростаты на держателя (PRESENT · PAY · READ · RETURN) → ПО-жетон → лента поиска (`ONE PRESS, SEVERAL
   EFFECTS — the surfaces go in turn`: лента ждёт семью `followUp`); (в) оплата — Космос → титан (ленты титан + M€ → панель `compact` с LB/RB; при одной ленте — `line` P81, если сдана).
2. **Чтение скана (§0):** «12» — цена; метки — Венера, Космос; стрелка — событие; ряд — «[аэростат][аэростат]* [карта·V][карта·V]»; текст «(Add 2 floaters to ANY CARD. Draw 2 Venus cards.)»; «P84»; ПО «1»
   (бурый круг); слева внизу — Prelude 2 · Venus; лор — курсив.
3. **Что даром (проверить «до»):** оплата титаном; «Сработает» — реакторы на Венеру / Космос / событие; MarsBot-стол с `prelude2Expansion` БРОСАЕТ → карта в руку без опции; после reload посреди ленты —
   отдельная сцена (гэп P76 №3 — не трогать).
4. **Spec апстрима** — один `it` — байт в байт.

### Сцена «РАЗЫГРАНО» для СОБЫТИЯ (кадры P76 `t01034` / `t01343`)
- **E1. Награда из рубашки.** Событие переворачивается в середине полёта и ложится рубашкой на стопку; ВСЕ награды (ПО-жетон, РТ, склад, ресурс на держателя) рождаются из `.con-recv__backpile` —
  «честное место на столе», но место БЕЗ ПРИЧИНЫ: рубашка не печатает ни «+3», ни «1 ПО», ни аэростатов. Закон «где это взялось» (CLAUDE.md § Physical causality) нарушен для каждого события; физическая игра:
  событие разыгрывают лицом, применяют, потом кладут рубашкой.
- **E2. Складская награда — из тела карты (любая карта).** `heroGainOrigin` отвечает только каналу `card-resource`; `stock` / `production` / `tr` (кроме печатного РТ) / `vp` (TR55 — свой бейдж) у `railWaveWithPrintedVp`
  рождаются в общей точке карты; у ACTION COMMIT те же каналы рождаются с печатных значков (`resolveGainIconEnds`). Гэп P76 №2.
- **E3. Пустая сцена.** Полоса «РАЗЫГРАНО» события — пустое стекло с одинокой рубашкой в правом нижнем углу (стопка стоит в полке, `.con-recv__air` над полкой пуст): герой сцены — карта, которую игрок только
  что разыграл, — не виден.
- **E4. Переворот в полёте.** `HERO_FLIP_START_T .32 → .82`: карта переворачивается ДО посадки — игрок не видит лица в момент, когда карта «платит»; у не-события лицо стоит фронтом стопки (`[data-recv-front]
  .con-recv__face`) и платит оттуда.
- **E5. Держатель и лицо — два места.** Аэростаты на держателя: держатель ВЫДВИГАЕТСЯ над полкой (`.con-recv__emerge`, PL-1146), жетоны летят от рубашки события к капсуле держателя — источник без значка, цель с
  значком: половина закона.

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Красная (EVENT), 12, Венера + Космос, 1 ПО, без требования; P84; `compatibility: 'venus'`; оплата — M€ + титан.
2. Розыгрыш: 2 аэростата на ОДНУ любую свою карту-держатель (вопрос всегда, даже при одном держателе — T14 посев; нет держателя → именованный пропуск, карта играется), затем 2 карты Венеры из колоды
   (лента поиска: вскрыто N · получено 2 · сброшено N−2, сброс по имени в порядке вскрытия); ПО 1.
3. Превью = исполнение (декларативное, read-only): шаг цели «2 [аэростат] → карта», чип «+2 карты · с меткой Венеры», ПО-чип; пропуск аэростатов назван; раздача — Venus + Prelude 2; save / reload — обычная
   карта; MarsBot — никогда.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **RU / текст** — имя и описание оставить (RU есть); лор RU — «Исследование пригодности разных высот Венеры для атмосферных проектов.» (планка `docs/claude/ru-translation-standard.md` — прочесть ДО).
2. **Свой e2e-стенд — ДА**, `tests/e2e/console-stratospheric-expedition.spec.ts`, фикстуры одного рецепта `stratosphericExpeditionFixture(name, variant)` (форма `ishtarExpeditionFixture`: `soloActionPhase({venusNextExtension,
   prelude2Expansion})`, P84 в руке, лента `STRATO_TAPE` на верху колоды — 4 карты, из них ровно 2 с меткой Венеры, `stackDeckTop`): **`stratospheric-expedition`** — на столе Dirigibles (3 аэростата) и
   Floating Habs (0) → выбор держателя; 10 M€ + 2 титана (оплата 12 = 2 титана × 3 + 6 M€ — две ленты); **`stratospheric-expedition-sole`** — один Dirigibles → посеян и показан (T14); **`-noholder`** —
   держателей нет → превью называет пропуск, розыгрыш состоится, лента — да. Сухой прогон на копии (`Game.deserialize(structuredClone)`): `SelectCard` держателя → ответ → 2 аэростата, рука +2 Венеры, сброс +2
   по имени. Клетки: (1) рука — плита играбельна; (2) композер — шаг цели (сеянный / выбор), чип «+2 карты · Венера», ПО «1», оплата титан + M€; (3) A → ОДИН POST → **сцена по решению 3** (запись): карта
   летит ЛИЦОМ и садится лицом над полкой; титан + M€ тикают с посадкой; 2 аэростата рождаются на ПЕЧАТНЫХ значках аэростатов лица (k-й на k-м), держатель выдвинулся над полкой, жетоны садятся в его
   капсулу (тик на касании), держатель возвращается; ПО-жетон с печатного «1» в ячейку ПО (TR55); карта ПЕРЕВОРАЧИВАЕТСЯ и ложится рубашкой на стопку «СОБЫТИЯ» (счёт стопки тикает на посадке); ТОЛЬКО ЗАТЕМ
   лента поиска (крошка «… › ДОБОР КАРТ», источник L3 — P84); взятие → рука; флоу уходит; `transferWitness` `endsOverGlass` пуст, каждое рождение — на видимом значке (`reactor`-подобный якорь `play:<card>:<sprite>`);
   (4) `-noholder` — пропуск назван в превью и на сцене (строка «аэростаты пропали — некуда положить» в такте награды, без жетонов), лента — как в (3).
3. **СОБЫТИЕ ПЛАТИТ ЛИЦОМ** (класс, раздел DK; меняет записанные законы — §4).
4. **НАГРАДА РОЗЫГРЫША — С ПЕЧАТНОГО ЗНАЧКА ДЛЯ КАЖДОГО КАНАЛА** (класс, тот же раздел; §4.4).
5. **Журнал серии / доки / реестр** — §7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача.

## 0. Рабочее дерево
1. `git log --oneline -3`; `ListAgents`; `git status`. `SendMessage` занятому: твои файлы — карта (`prelude2/StratosphericExpedition.ts` — лор только, спек, `prelude2Adaptation.ts` — одна строка, арт P84,
   `lore_texts.json` — одна строка, `ru/lore_texts.json`, `src/genfiles/*`), сцена (`console/played/consolePlayedHero.ts`, `playedHeroModel.ts`, `playedHeroDirector.ts`, `receivingStageModel.ts`,
   `components/console/played/ConsolePlayedReceivingStage.vue`, `ConsolePlayedHeroLayer.vue`, стили сцены приёма (`console.less` — блоки `.con-recv*` объявленным ханком; `console_tv.less` — их строки),
   `consoleActionCommit.ts` — ТОЛЬКО если `resolveGainIconEnds` экспортируется для общего чтения (одна функция на две двери)), фикстуры (`generate.ts` — объявленный ханк), 8 перенацеленных спеков + свой,
   доки (`workspace-band.md` / `console-ui.md` — абзацы объявленным ханком после коммита соседа), журнал, реестр. **НЕ трогать**: композер розыгрыша (P81 в работе), `payloadCarry.ts`, ленту поиска
   (`deckDraw/**`), стол «Разыграно» (`ConsolePlayedOverlay`, `playedCategoryView`) сверх стопки событий как ЦЕЛИ, директор экрана соседа.
2. e2e — только бокс; `FIXTURES=stratospheric-expedition,stratospheric-expedition-sole,stratospheric-expedition-noholder npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 10 %)
- `StratosphericExpedition.ts`: без правок правил; лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P84.png" P84` → `make:cards`); строка `STRATOSPHERIC_EXPEDITION` долой;
  `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный `it` — байт в байт; новый `describe`: правила 1–3 — один держатель — вопрос всё равно (`autoselect: false`), два — выбор, ноль — именованный пропуск + розыгрыш состоялся + лента; поиск: сброс по
  имени в порядке вскрытия, ровно 2 Венеры; превью (цель, добор, ПО, пропуск) read-only; оплата титаном; раздача; MarsBot-стол; save / reload.

## 2. Клиент — карта (≈ 5 %)
Даром: шаг «КУДА» с посевом, лента поиска, ПО-чип, оплата. Проверить «до» клеткой (3) стенда — это и есть кадр «ДО» для §4.

## 3. «ДО» — первым делом
Свидетель посадки (§4.6) + раскадровка «ДО» на HEAD: P84 (аэростаты + поиск + ПО), Bribed Committee (`play-tr-reward` — событие с РТ и −2 ПО), X87 (событие с ценой с рельса — такт поставки ДО взлёта),
P76 Ishtar (титан + поиск), не-событие с складом (Terraforming Ganymede) и с ресурсом на держателя (TR56-форма). Таблица «ДО»: сценарий × (где родился каждый жетон: селектор места + «значок / тело / рубашка»,
момент переворота, что видно в `.con-recv__air`).

## 4. ГЛАВНОЕ — «СОБЫТИЕ ПЛАТИТ ЛИЦОМ · НАГРАДА — С ПЕЧАТНОГО ЗНАЧКА» (решения 3–4)
**Цель:** на сцене «РАЗЫГРАНО» событие ведёт себя как в физической игре — разыграно лицом, платит со своих значков, потом переворачивается и ложится на стопку; и у ЛЮБОЙ карты каждая награда розыгрыша рождается
там, где напечатана (как у ACTION COMMIT). Движение — Ark Nova: короткие изинги, без поп-инов; ничего сверх существующих тактов, кроме одного — переворота ПОСЛЕ оплаты.
1. **ПОЛЁТ ЛИЦОМ (E4).** Прокси героя летит и садится ЛИЦОМ (переворот из дуги убран: `heroFlipAt` для события = 0 на всём полёте; константы `HERO_FLIP_*` — переименовать в константы такта переворота §4.3);
   цель посадки события — НЕ стопка, а ФРОНТ-ЛИЦО над стопкой: назначение «events» в `ConsolePlayedReceivingStage` получает `[data-recv-front] .con-recv__face` (та же лестница, что у face-up семьи, с
   `ConsolePlayedCardLite` лицом), стоящее В ВОЗДУХЕ над полкой (`.con-recv__air` — «emergence presentation space») на оси стопки событий, размером героя плана (`plan.zoom`); стопка под ним — как есть.
   Геометрия посадки (`console-play-landing-geometry`) перенацеливается на лицо.
2. **ОПЛАТА С ЛИЦА (E1, E5).** Такт награды для события — ТОТ ЖЕ, что для face-up карты: `heroRewardSourceSelectors` → первое видимое место = фронт-лицо события; аэростаты рождаются на печатных значках
   аэростатов (`heroGainOrigin`, k-й на k-м), держатель выдвигается рядом (PL-1146), жетоны садятся в капсулу; ПО-жетон — с печатного бейджа `.pcard__vp` (TR55 `data-vp-emit`); РТ — с печатного РТ (`heroRailOrigin`
   — ветка «рубашка» удаляется); ответ стола — с печатной метки (`heroTagOrigin`). Такт поставки (PL-107, цена с рельса ДО взлёта) — НЕ трогать: он всё равно до взлёта.
3. **ПЕРЕВОРОТ ПОСЛЕ ОПЛАТЫ (E3).** Новый бит сцены: после `told` (все жетоны события родились и сели; `stageAbsorbs` пусты) лицо ПЕРЕВОРАЧИВАЕТСЯ на месте (`rotateY` 0 → 180 на оси, ≈ 320 мс `motionMs`, `MOTION_EASE`;
   рубашка `con-card-back` на 90°) и ОПУСКАЕТСЯ на стопку (короткое `y` + `scale` к `plan.cardH` стопки, ≈ 220 мс; счёт стопки «СОБЫТИЯ N» тикает на касании; `--deep` при N > 1); потом — следующая поверхность
   (лента поиска / возврат карт / уход). Reduced motion — переворот = смена лица/рубашки без твина, посадка мгновенна. Холд — существующий сцены (`playLandingHolding`), бит бюджетируется в `sceneSafety`, не таймером.
   Событие, за которым идёт ВСТРОЕННАЯ стадия (лента поиска в зоне руки): переворот — ДО открытия ленты (поверхности по очереди; `followUp` ждёт лицо, а не рубашку).
4. **КАЖДЫЙ КАНАЛ — СО СВОЕГО ЗНАЧКА (E2, решение 4).** `heroGainOrigin` расширяется на `stock` / `production` / `tr` / `wild` через ОДНУ грамматику значков ACTION COMMIT (`resolveGainIconEnds`: k-й жетон на k-м
   значке ресурса ON-PLAY-ряда вне `.pcard-effect` / `.pcard-action`; производство — на плите производства; `data-graphic-node` + спрайт-URL; никаких пер-карточных таблиц) — вынести в общий модуль
   (`played/heroIconOrigins.ts` или экспорт из `consoleActionCommit.ts`), обе двери читают его; лицо без такого значка → общая точка карты, как сейчас (честный деград, названный в трейле `play:no-icon`).
   `railWaveWithPrintedVp` получает `origins` так же, как `payGains`.
5. **МАТЕРИАЛ.** Ничего нового не светится: переворот — форма; стопка — как есть; ноль ореолов (ратчет `console.less` не растёт).
6. **СВИДЕТЕЛЬ** — НОВЫЙ `tests/e2e/console-event-pays-face-up.spec.ts` (FUNCTIONAL, fhd + tv4k; корпус §3): (а) прокси события летит ЛИЦОМ (в каждом сэмпле полёта `rotateY` 0 / лицо видно — по `data-hero-face` или
   computed transform), садится на `[data-recv-front] .con-recv__face` над полкой; (б) каждый жетон розыгрыша рождён ВНУТРИ прямоугольника своего печатного значка (`transferWitness`: `born` внутри
   `.pcard-ic` нужного спрайта / `.pcard__vp` / плиты производства — по каналу), ни одного рождения на `.con-recv__backpile` / `.con-played__backstack` / теле карты, пока лицо печатает значок; (в) порядок:
   посадка → гейны (держатель выдвинулся → жетоны → вернулся) → ПО → РТ → ответ стола → ПЕРЕВОРОТ → посадка на стопку (счёт тикает) → следующая поверхность (лента) — по записи; (г) стопка «СОБЫТИЯ» читает N+1
   только после касания; (д) не-событие (Ganymede, TR56) — складской жетон со значка, остальное как «до» (регрессия, без переворота); (е) `endsOverGlass` пуст; `[transfer] end not painted` /
   `surface folded under its token` — тишина; (ж) A/B темпа посадки события против HEAD — рост ≤ бит переворота (≈ 0,55 с), всё остальное в допуске. ПЕРВЫМ ДЕЛОМ — «ДО»: (а), (б), (в) ДОЛЖНЫ быть красными.
7. **ЧЕГО НЕ ДЕЛАТЬ.** Не трогать такт поставки (PL-107), ленту поиска, стол «Разыграно» (стопка событий остаётся face-down объектом с счётом; `__backstack` — цель полёта с полки на стол), композер розыгрыша,
   `payloadCarry.ts`; не делать переворот «в воздухе на пути к стопке» снова (это и есть E4); не рождать жетоны на рубашке ни в одной ветке (деград при отсутствии значка — тело ЛИЦА, не стопка).

## 5. Тесты
1. Спек карты; юниты сцены: `playedHeroModel.spec` (переворот события = 0 в полёте; бит переворота после `told`), `consolePlayedHero.spec` / `playedHeroDirector.spec` (лестница мест без рубашки; `heroGainOrigin`
   по каналам — корпус карт скоупа: стек / производство / РТ / ПО / wild / ресурс на держателя → значок найден или названный деград), `receivingStageModel.spec` (план с лицом события); гарды:
   `Prelude2CardsHeldBack`, `premiumScope`, `cardPlayPreviewCoverage`, `cardInformation`, `premiumCardViewModel` (звёздочка печатная), `cardLore`, `crossPlayerCoverageGuard`, `glowRestraintGuard`,
   `transferSurfaceClear` (новый файл с `onLeft` — allow-list с причиной или `surfaceClear`), `reactivityWitness` (предикаты, читающие кэш), `e2eLiveness`, `tests/client/i18n.spec.ts`.
2. `build:server`, `build:test`, `lint` (включая `lint:client`), `make:cards` 0 / 0 / 0, `make:json`; полные `test:server` / `test:client` на тихой машине.
3. e2e: стенд ×3; свидетель «до / после»; перенацеленные **`console-play-tr-reward`** (Bribed Committee: РТ с печатного РТ лица, ПО −2 с бейджа, переворот после), **`console-x87-shipment-to-earth`** (цена ДО
   взлёта как есть; РТ — с лица), **`console-play-landing-geometry`** (события — против лица), `console-ishtar-expedition`, `console-ghg-shipment`, `console-strategic-shift`, `console-played-table`,
   `console-l1-trade-terminal`; `npm run e2e:affected`; регрессия — `console-play-landing-probe`, `console-hand-play-return`, `console-card-reaction` (реактор на событие), `console-special-permit` (событие-атака),
   `console-sponsoring-nation` (зелёная — без изменений), `console-start-*` (прелюдии — не события), `console-flight-paint`, канарейка; аннотация `build` у красного.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`) + fhd
`screenshots/p84/tv4k/`: (а) композер — цель посеяна / выбор, добор, ПО, оплата титаном; **ДО / ПОСЛЕ** сцены: (б) полёт — лицо vs рубашка; (в) посадка лицом над полкой; (г) аэростаты с печатных значков на
выдвинувшегося держателя; (д) ПО-жетон с печатного «1»; (е) переворот и посадка на стопку, счёт «СОБЫТИЯ»; (ж) лента поиска после; (з) Bribed Committee — РТ с лица; (и) Ganymede — склад со значка. Своим
глазом: «я вижу, какую карту разыграл, и откуда взялся каждый жетон? Карта ложится рубашкой ПОСЛЕ того, как заплатила, как на столе?»

## 7. Полировка по пути / доки
1. Реестр **DK** «P84 · СОБЫТИЕ ПЛАТИТ ЛИЦОМ (полёт лицом, посадка над полкой, награды с печатных значков, переворот ПОСЛЕ оплаты, стопка — после) · НАГРАДА РОЗЫГРЫША — С ПЕЧАТНОГО ЗНАЧКА ДЛЯ КАЖДОГО КАНАЛА
   (одна грамматика значков на две двери)» — E1–E5 строками «что было / что стало / где» + закрытие гэпов P76 №1 / №2 ссылкой + находки прохода; номера — по footer.
2. Доки: журнал серии (P84, девятнадцатая запись); `PRELUDE2_ADAPTATION.md` (19 / 54; строка); **`workspace-band.md`** § РОЗЫГРЫШ КАРТЫ / § РТ РОЗЫГРЫША / § ЦЕНА РОЗЫГРЫША — переписать фразы «у СОБЫТИЯ — на
   стопке рубашкой» / «у события после посадки иконок нет» на новый закон (своими ханками, после коммита соседа); **`.claude/rules/console-ui.md`** § «…AND SO IS A CARD PLAY'S» — «an EVENT's from its printed
   icons on its face-up landing, the flip after the pay-back» + одна строка о единой грамматике значков; `docs/claude/console/play-card-result.md` / `played-table.md` — абзац «событие на сцене приёма»;
   память `prelude2-adaptation.md` (19 / 54) + заметка о смене закона.

## 8. Режим работы
1. Читать до кода. Порядок: карта (лор / арт) + спек + строка долой → `make:cards` → фикстуры + стенд (клетки 1–2) → «ДО» корпуса + свидетель (красный) → 4.4 грамматика значков (общий модуль + корпус-юнит) →
   4.1 полёт лицом + цель-лицо → 4.2 оплата с лица → 4.3 переворот после → перенацелить 8 спеков → свидетель «ПОСЛЕ» + A/B → регрессия → реестр → доки / журнал / память. Коммиты по шагам явными путями, после
   каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; таблица «ДО / ПОСЛЕ» рождений (сценарий × канал × место); порядок событий сцены (запись); POST (один); A/B темпа; гарды и `make:cards`; регрессия на
   боксе (аннотация `build`); решения 1–5 (что сделано по каждому); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Рождать жетон на рубашке / стопке / теле карты, пока лицо печатает значок; переворачивать событие до оплаты; таймер вместо бита на часах мотора; второй экземпляр карты (лицо над полкой + рубашка на стопке
  одновременно — переворот и посадка ОДНОГО объекта); менять такт поставки, ленту поиска, стол «Разыграно», композер; автовыбор держателя; прятать пропуск аэростатов.
- Ореол / свечение / петля; `title`; литерал кнопки; `v-if`-моргание; кегль ниже пола ТВ.
- Трогать файлы соседей (шапка; `payloadCarry.ts`, композер розыгрыша, директор экрана); удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; тумблер, `DECK_COMPOSITION_EXPANSIONS`,
  `automaCompatibility`, дев-пикер; переоткрывать находки P76…P81 (кроме гэпов №1–2 P76, которые закрываются здесь).
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; оставить спек, пинящий «рождение на рубашке» (8 спеков — перенацелить тем же диффом); `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`;
  `git stash`; `git add -A`; `--force` / `--no-verify`; коммитить чужие файлы (`package.json` / `package-lock.json`); пересборку во время прогона e2e на боксе.
