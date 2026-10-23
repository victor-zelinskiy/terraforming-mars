# Промт исполнителю · Lakefront Resorts (R38, корпорация Turmoil) — ПЕРВАЯ из четырёх корпораций «на месте» (§3.1; после T07 в списке остались только они): Здание; 54 M€; ЭФФЕКТ «когда ЛЮБОЙ океан размещён — +1 пр. M€» и «ваш бонус за соседство с океаном 3 M€ вместо 2» — ПОЛНАЯ премиум-адаптация (владелец: «максимально под все наши премиум-механики»): лицо корпорации, инфо-модель, двойники прогноза живого хука (`tilePlacedForecast` / `tilePlacedPreview` — по §3.1 п. 6 ОБЯЗАТЕЛЬНЫ), честный `+3` во всех местах, где поле считает соседство (досье клетки, превью размещения, такт выплаты), чужой океан → моя нотификация (гард покрытия), стартовая сцена, «Разыграно», «Информация», журнал, бот-двойник C35 не трогается · ПОЛИРОВКА (≈ 60 %) «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА»: игроки жалуются — «всё мигает как на дискотеке, особенно при ускоренном подсчёте»; по коду: BZ сделал счёт СВЕТОМ, но X = `timeScale(6)` ТОЙ ЖЕ хореографии (`HURRY_SCALE = 6`, `--eg-pace` на каждом CSS-переходе 260–300 мс) → ≈ 80 зажиганий мест за ≈ 2 с вспышками по ~45 мс — стробоскоп по построению; нужна ДРУГАЯ хореография перемотки (один проход света, одометр итогов), бюджет света на любом темпе и пробник вспышек

> **Статус: СДАНО 2026-10-23** (c159574f3d корпорация · 59044a5999 стенд + 13 из 22 · 6120b50a86 финал CI, PL-965…975; батч владельца: M1 «один проход», бюджет как сделано, пробник яркости — гард). Выдан: HEAD `70dd0d6535` (T07 + CH сданы и записаны; дерево чистое). Реестр: footer «PL-965», последний раздел **CH** →
> **эта задача берёт CI**; номера — по footer В МОМЕНТ записи. **Лор и арт УЖЕ ЕСТЬ**: `assets/text/lore_texts.json:482` ключ `R38` (EN владельца) + RU
> в `src/locales/ru/lore_texts.json:482`; арт `assets/card-images/R38.webp` (манифест `cardArtManifest.json:415`) — импортировать НЕ нужно (проверить
> `make:cards` → `cardInfoAudit`). Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\corporations\Turmoil - Lakefront Resorts.png`.
> `ListAgents` до первого коммита (сосед может держать стейдж — `git commit -- <paths>`). **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- lakefront …`;
> exit 2/3/4 → спросить; финал — TIMING, `--exclusive --workers=1`).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:58–60` списки; `:131` — почему корпорации не входят в гарды литералом модуля; **`:147` п. 5 MarsBot
— «человеческая версия — отдельная карта, бот не трогается»; `:149` п. 6 — «карта с ЭФФЕКТОМ (живой хук) — двойник прогноза ОБЯЗАТЕЛЕН,
`effectForecastParity` падает с именем карты»**; `:211` строка Lakefront «премиум-адаптация (лор, инфо-модель, превью) · ждёт»), `docs/claude/
turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T06 (хук `onCardPlayedByAnyPlayer` + двойник — образец «эффект на чужое действие»), T15
(ответ своих карт на тайл в досье клетки — PL-078), T03 (гард паритета стенда). **Контракты корпорации:** `.claude/rules/game-logic.md` (хуки
CO-LOCATED — инвариант 8), `docs/claude/console/unavailability-reasons.md`, `docs/claude/board-information.md` / `.claude/rules/board.md` (факты клетки —
read-only, `BoardInformationEngine`), `docs/claude/effect-forecast.md` (если есть — иначе заголовок `src/server/models/effectForecast.ts`), память
`notification-why-layer`, `cross-player-coverage-guard`, `notification-source-and-glance-rule`, `resource-flight-live-ends-direction` (T06 M1 — плашка-приёмка
под чипом чужого места; «ожидает»), `marsbot-corporations-framework` (бот-двойник: C35 — свой объект; коллизия выбора по `original`), `card-lore-archive-entry`,
`card-information-model`, `premium-card-renderer`, `ru-card-names-already-exist` (имена корпораций — ЛАТИНИЦЕЙ: `zz_corporation_names.json:84`). **Контракты
полировки:** память **`finale-count-as-light-direction`** (владелец 2026-10-22 + СДЕЛАНО + гочи: замороженные часы, скринкаст 4K пустой, LoAF, слои),
`final-greenery-session`, `campaign-champion-ceremony` (бит чемпиона — замок), `polish-direction-smoothness`, `ceremony-on-the-real-object`,
`endgame-experience-implemented`, `polish-priority-tv4k-no-deck-only`, `perf-measure-on-gpu-not-swiftshader`, `e2e-gpu-cold-shader-cache-stall`;
`docs/claude/console/endgame-workspace.md` (§ Ceremony machine `:203`, § THE STAGE HOLDS ITS LAYERS `:87`, § Input `:474`, § E2E harness law `:513`),
`.claude/rules/console-ui.md` § THE FINALE IS A CEREMONY (`:600–607`, закон 4 «the count ARRIVES AS LIGHT»), `.claude/rules/animations.md`, CLAUDE.md
«Project goals» 3 (**Ark Nova: short easings, subtle, no hard pop-ins; default to calm**) и инвариант 6 (одна система движения, холды, reduced motion),
реестр BZ (`gameplay-polish-ledger.md:2269+` — числа бокса «до/после», PL-861…870, PL-870: батч M1/M2/M3 без ответа — умолчания взяты). Журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **корпорации с `onTilePlaced` и двойниками** — `corporation/TharsisRepublic.ts:39–110` (`infoText`, `onTilePlaced`, **`tilePlacedForecast`
:78**, **`tilePlacedPreview` :104** — «два независимых эффекта с одного города — два факта»), `corporation/MiningGuild.ts:36–110` (те же три + `boardType`),
`base/ArcticAlgae.ts:38–75` (ОКЕАН «кем угодно»: `forecast.deferred(forecast.sourceOf(this, cardOwner, 'tile-placed'), …)`, `placementPreviews.stockChange(…,
'Ocean placed anywhere', …)`) — ближайший образец для Lakefront; **фасад соседства** — `Player.ts:370` (`oceanBonus = OCEAN_BONUS`, сериализуется `:3450/3531`),
`boards/MarsBoard.ts:291` (`megacredits: oceans × player.oceanBonus`), `boards/BoardInformationEngine.ts:643–690` («Adjacent oceans: ${0} × ${1} M€» — читает
`player.oceanBonus`: честен по построению), `Game.ts:2397–2417` (`events.withSource({kind:'oceanBonus'})` — событие уже типизировано), клиент
`tilePlacement/adjacencyPayoutBeat.ts:263` (`oceanBonusFor` — такт выплаты по СЕРВЕРНОЙ раскладке `OceanAdjacencyBonusModel`), `journal/journalEventChild.ts:327/394`
(`oceanBonus` — вид ребёнка), `notifications/notificationCauseView.ts:249`; **бот-двойник** — `automa/corps/MarsBotLakefrontResorts.ts` (C35: белый куб —
бит памяти; `bot.oceanBonus = 3` `:84`), `common/automa/MarsBotCorpData.ts:1023–1034` (`original: CardName.LAKEFRONT_RESORTS` — ключ коллизии выбора),
e2e `console-bot-corp-card-cube.spec.ts` («Turmoil is off in this config, so the collision rule cannot hand the bot a different corporation» — с
адаптацией это меняется!); **гарды** — `tests/notifications/crossPlayerCoverageGuard.spec.ts` (три ноги доказательства; `:380` `C35: botOnly` — человеческая
Lakefront ещё не классифицирована), `tests/models/effectForecastParity.spec.ts`, `effectForecastCoverage.spec.ts`, `tests/cards/cardInformation.spec.ts`,
`premiumScope.spec.ts`, `CardMetadata.spec.ts`, `armedPlayEffectCoverage.spec.ts`, `tests/client/components/premiumCard/{PremiumCard,premiumCardViewModel}.spec.ts`
(`:473` `isCorporation` — лицо корпорации), `tests/cards/turmoil/LakefrontResorts.spec.ts` (один `it('Should play')`), `TurmoilCardsUnderRedux.spec.ts:35–45,
108–114` (корпорации: `dealt.corporations` — пин «как после последней адаптации»); лого — `card/CardCorporationLogo.vue:453/700` (`'bespoke'` — текстовый
логотип; премиум-лицо берёт арт `R38`); **финал** — `console/endgame/consoleEndgameDirector.ts:1–60` (директор: тайм-лайн GSAP, `attach`, зажигание,
HURRY `:94–97`, `:479–495` — `tl.timeScale(HURRY_SCALE)`, возврат `:313–331` на `preRank`), `consoleEndgameScript.ts:39–140` (`CEREMONY_MS`, биты `category /
subIntro / sub` с `lightMs / staggerMs / growMs / settleMs`, **`HURRY_SCALE = 6` :105**, `igniteOffsets` :171), `components/console/ConsoleEndgameWorkspace.vue`
(`onLight` — canvas 256×128 `paintLightWash`, `onIgnite`, `onCount` → textContent, `onRankFlip`, `onCrown`, `onWinnerFx`), `styles/console_endgame.less` (1551
строка; 12 `@keyframes`, 16 `animation:`, 38 `box-shadow`; `--eg-pace` на переходах `:264–267`, `:280`, `:337–341`, `:402–403` — 260–320 мс × pace),
`consoleEndgamePodium.ts` (планировщик), юниты `tests/client/console/consoleEndgameCeremony.spec.ts` / `consoleEndgamePodium.spec.ts`, e2e
**`console-finale-podium.spec.ts`** (A/B/C′/H/D/G/I; пробник init-script; TIMING), `consoleEndgameHarness.ts` (закон харнесса — ответы через страницу),
`console-endgame.spec.ts`, `console-campaign-endgame.spec.ts`, `console-endgame-boundary.spec.ts`; стоп-кадры 4K `screenshots/t08/after/tv4k/stills{,-x}/`,
макеты `screenshots/t08/mockups/tv4k/`, бенч `screenshots/t08/{before,after}/tv4k/finale-rich-5p-{natural,x}.json`, раскадровки FHD `screenshots/t08/{before,after}/fhd/story-*/`.

---

## Диагноз (подтверждён файл:строка, числами BZ и кадрами на `70dd0d6535`; перепроверить на своём HEAD)

### Корпорация — живой хук без двойников, честный `+3` без пина
1. **Карта в премиум-скоупе рендерится, но не «понимается».** `LakefrontResorts.ts`: `bespokePlay` → `player.oceanBonus = 3` (upstream-семантика, сериализуется),
   `onDiscard` → 2, `onTilePlaced` → океан (кем угодно) → `GainProduction(M€, {log: true})` с `Priority.OPPONENT_TRIGGER` для чужого. НЕТ `infoText`, НЕТ
   `tilePlacedForecast` / `tilePlacedPreview` (§3.1 п. 6 — `effectForecastParity` упадёт с именем карты, как только строка уйдёт из hold-back), в
   `crossPlayerCoverageGuard` — только бот `C35: botOnly` (`:380`); человеческая Lakefront как источник «чужой океан → моё производство» не классифицирована.
2. **`+3` уже честен там, где читают `player.oceanBonus`** (`BoardInformationEngine:646/651/666/688`, `MarsBoard:291`, такт выплаты по серверной раскладке) —
   пинить тестами, не переделывать; проверить ВСЕ места, где `OCEAN_BONUS`/«2 M€» могли быть зашиты литералом: `grep -rn "OCEAN_BONUS\|× 2 M€\|2 M€ per ocean"
   src/client src/server/models src/common` — каждое попадание либо читает игрока, либо дефект.
3. **Двойники и покрытие:** `tilePlacedForecast` (композер: «Lakefront Resorts: +1 пр. M€» при розыгрыше карты, которая ставит океан — и у СОПЕРНИКА, когда
   океан ставлю я: прогноз «чужая выплата»), `tilePlacedPreview` (досье клетки океана / превью размещения — «ответ ваших карт на тайл», PL-078-класс), гард
   покрытия — семейство «tile-placed opponent trigger» (как Arctic Algae); нотификация чужого океана — плашка-приёмка T06 M1 под чипом моего места с
   источником «Lakefront Resorts»; журнал — `GainProduction {log: true}` ✓ + ребёнок `oceanBonus` ✓.
4. **Бот-коллизия меняется.** Пока Lakefront в hold-back, на столе с Turmoil человек её не получал — боту C35 ничего не мешало. После адаптации: человек
   выбирает Lakefront → бот НЕ может получить C35 (и наоборот) по ключу `original` (`MarsBotCorpData:1026`) — пин в спеке `AutomaCorporations`; комментарий
   e2e `console-bot-corp-card-cube` (`:12–13`) устаревает — поправить словами, не логикой.
5. **Остальное:** имя — латиницей (`zz_corporation_names.json:84`; `turmoil_corporations.json:2` `""` — пустое значение того же ключа: проверить, что `make:json`
   не ругается и что отрисовка берёт латиницу — иначе удалить пустую строку); RU описания (`"You start with 54 M€."` → «Вы начинаете с 54 M€» — без точки,
   свой ключ) и эффекта (`:4`) — в голос набора; лицо: премиум-тема корпорации (`isCorporation`), `corpBox('effect')` — две строки эффекта существующими
   значками (`oceans(all)` : `production(M€)`; `emptyTile + ocean : 3 M€`); стартовая сцена (пик корпорации — 54 M€ в превью, без первого действия);
   «Разыграно» — герой корпорации; «Информация › корпорация» — инфо-модель; `cardInfoAudit` — арт есть.

### Финал — та же хореография в шесть раз быстрее
6. **Стробоскоп по построению.** BZ: категория = ОДИН свет (canvas) + зажигание КАЖДОГО места слева направо (`igniteOffsets`: лид + 5 × stagger 160 мс) +
   тик итога на своём зажигании + рост сегмента + плита категории (crossfade) + фокус чипа рельса; подшаги РТ/Карт — повторное зажигание всех мест под
   удержанным светом. 7 категорий + подшаги ≈ 16 битов × 5 мест ≈ **80 зажиганий за ≈ 13,5 с** (≈ 6/с — уже на грани «мигает»). X = `tl.timeScale(6)` +
   `--eg-pace` на ВСЕХ CSS-переходах (260–320 мс → **43–53 мс**) → те же 80 зажиганий за **≈ 2 с (≈ 40/с)** при длительности каждого ниже порога восприятия
   плавности — это и есть «дискотека при ускорении». Порог комфорта (и WCAG 2.3.1): **≤ 3 вспышек/с**; премиум-ощущение — ни одно световое событие короче
   ≈ 240 мс ни на каком темпе.
7. **Свет «падает и отпускает» на КАЖДОЙ категории** (`light(… 'fall')` / `'release'` — `director:256/266/281/308`): 7 × (включение + выключение) заливки
   подиума + плита категории меняет лицо — ещё 14–21 перепад яркости всей сцены за подсчёт; при ×6 — за 2 с.
8. **Ускорение = сжатие, не другая режиссура.** `hurry()` (`:479–495`) только меняет `timeScale`; скрипт битов один (`ceremonyBeats`). Перемотка должна быть
   СВОЕЙ хореографией: один непрерывный проход, одометр, без событий на место — «быстро И приятно» (владелец) недостижимо делением длительностей.
9. **Что стоит и остаётся:** подиум TR69 (места-лица, планировщик), свет вместо тел (BZ), возврат ×1 к `preRank`, ранжирование FLIP + коронация в полном
   темпе, бит чемпиона кампании (замок), слои PL-868, пробник C′/H и бенч LoAF, харнесс (закон «через страницу»), replay «Повторить подсчёт» с
   замороженными часами для стоп-кадров.

## Правила корпорации (спек пинит каждое)
1. 54 M€; метка Здание; без первого действия. Эффект 1: ЛЮБОЙ океан (свой, чужой, нейтральный/бот, стандартный проект, карта, резолюция Redux, бонус
   клетки) → +1 пр. M€ владельцу; НЕ океан-на-суше без тайла океана (`Board.isUncoveredOceanSpace`), не «океан» Ares-типа вне правила upstream — апстрим
   байт-в-байт. Эффект 2: `oceanBonus = 3` с розыгрыша; соседство считает `oceans × 3` везде (размещение, превью, досье, Ares/Nomads-ходы — `consoleNomadMove`
   читает `oceanBonus` модели ✓); сброс/замена корпорации → 2 (Merger/upstream).
2. Чужой океан → у меня ОДНА нотификация с источником-корпорацией; журнал — строка производства + ребёнок; «почему» — корпорация.
3. Прогнозы: розыгрыш карты с океаном — факт «+1 пр. M€ · Lakefront Resorts» у владельца (и у соперника-владельца при моём океане); превью размещения
   на клетке океана — тот же факт; клетка рядом с океаном — «соседние океаны N × 3 M€».
4. Бот-коллизия (правило 4 диагноза); save / load — `oceanBonus` ✓ (пин); MarsBot-двойник C35 — ни строки.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения T04…T07 / BZ-умолчания не переспрашивать, кроме п. 6–8)
1. **RU** — имя латиницей (политика); описание «Вы начинаете с 54 M€.»; эффект — «Эффект: когда размещается любой океан, увеличьте производство M€ на
   1 шаг. Ваш бонус за соседство с океанами — 3 M€ вместо 2 M€.»; лор RU — существующий (`ru/lore_texts.json:482`), не трогать.
2. **Инфо-модель** — два `effect-short`: «Any ocean placed: +1 M€ production» · «Ocean adjacency: 3 M€ instead of 2» (ключи грепнуть); прогнозы — по
   образцу Arctic Algae / Tharsis (два НЕЗАВИСИМЫХ факта — два источника `tile-placed`).
3. **Стенд корпорации** — `console-lakefront-resorts.spec.ts` (FUNCTIONAL, tv4k + fhd): (а) стартовая сцена — пик Lakefront: лицо с артом R38, «54 M€», без
   первого действия; (б) композер «Aquifer» (СП) / карта с океаном — прогноз «+1 пр. M€ · Lakefront»; размещение → производство тикает на рельсе с
   источником-корпорацией («Разыграно»-герой или плита — существующий путь эффекта корпорации); (в) досье клетки у океана — «1 × 3 M€»; город рядом → такт
   выплаты +3 по серверной раскладке; (г) соперник ставит океан → моя плашка-приёмка «+1 пр. M€ · Lakefront Resorts» (T06 M1), «ожидает» снимается; (д) бот в
   этой партии — НЕ C35; (е) «Информация › корпорация» — две строки эффекта. Фикстура `lakefront-resorts` (Redux + Turmoil-карты, p1 = Lakefront, бот —
   любая другая корпорация), `lakefront-resorts-opponent` (океан соперника).
4. **Объём** — корпорация ≈ 40 %, финал ≈ 60 %.
5. **ФИНАЛ — ЗАКОН БЮДЖЕТА СВЕТА** (диагноз 6–7) — (а, рекомендовано) на ЛЮБОМ темпе: ≤ 1 светового события на экране одновременно, ни одно короче
   `CEREMONY_MS.minEvent ≈ 240 мс` (пол, который темп НЕ масштабирует), ≤ 3 перепадов яркости сцены в секунду; свет НЕ падает/отпускает на каждой категории —
   ОДИН свет живёт весь подсчёт и СКОЛЬЗИТ по рельсу категорий (плита — его дом; категория = сдвиг света, не новое включение); зажигание места — мягкий
   подъём без атаки (ease-out ≥ 400 мс, без «кольца-вспышки»), один раз на категорию (подшаги — под тем же подъёмом, без повторного зажигания);
   (б) только пол длительности + ≤ 3/с, свет как есть.
6. **ПЕРЕМОТКА = СВОЯ ХОРЕОГРАФИЯ** (диагноз 8) — (а, рекомендовано) X → скрипт `hurried` вместо `timeScale`: оставшиеся категории — ОДИН непрерывный
   проход света слева направо по рельсу (≈ 1,2–1,8 с на всё, тем короче, чем меньше осталось), итоги мест — ОДОМЕТР (непрерывный `onCount` к финальной
   сумме с `power2.out`, без ступеней по категориям), сегменты растут одной заливкой, плита категории СКОЛЬЗИТ вслед за светом (без crossfade), чипы рельса
   гаснут/зажигаются одним гребнем; подшаги схлопнуты; `preRank` — вдох ×1; дальше без изменений (ранжирование, коронация, чемпион); второй X — no-op;
   reduced motion → `hurried` без света; `finalizeCeremony` — только сеть/перезагрузка; (б) `timeScale(3)` + объединение зажиганий в один гребень на категорию
   — проще, но «быстро» теряется (13,5 → 4,5 с).
7. **Естественный темп** (диагноз 6, вторая половина) — (а, рекомендовано) те же законы 5: один скользящий свет, одно мягкое зажигание на место и категорию,
   тик итога на зажигании, без подшаговых перезажиганий; суммарно ≈ 11–13 с; (б) как есть + пол длительности.
8. **Коронация** — без изменений по смыслу (FLIP + `ceremonyFx`); «вспышка победителя» — проверить по тому же бюджету: одна волна, ≥ 400 мс атака, без
   стробирующих повторов; бит чемпиона кампании — замок (не ускоряется).
9. **Пробник вспышек** (приёмка владельца «реально приятно и быстро» — измеримо) — (а) DOM-события: счётчик зажиганий/с, мин. длительность события,
   одновременных светов ≤ 1 (init-script, как C′); (б) ЯРКОСТЬ: по FHD-скринкасту (4K отдаёт пустые кадры — гоча BZ) средняя яркость области подиума
   кадр-к-кадру → перепады > порога = «вспышка»; вспышек/с ≤ 3 на обоих темпах; (в) 4K — стоп-кадры по замороженным часам (`page.clock`, `runFor(16)`) на 6
   точках естественного и 6 точках перемотки; бенч LoAF как в BZ (худший кадр ≤ 120 мс).

## 0. Рабочее дерево
1. `git log --oneline -1` → `70dd0d6535` на выдаче. `ListAgents` + `SendMessage` живым соседям: твои файлы — `turmoil/LakefrontResorts.ts` + спек,
   `common/cards/turmoilReduxAdaptation.ts`, `tests/notifications/crossPlayerCoverageGuard.spec.ts` (классификация), `tests/automa/AutomaCorporations*.spec.ts`
   (коллизия), `console/endgame/{consoleEndgameScript,consoleEndgameDirector}.ts`, `ConsoleEndgameWorkspace.vue`, `console_endgame.less`, e2e финала и
   корпорации, `ru/{turmoil_corporations,card_info,ui,console}.json`, доки. Коммиты — ПО ХАНКАМ / явными путями; после коммита — `git reset -q --
   package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot lakefront` → `npm run e2e:remote -- lakefront <spec> --exclusive --workers=1`
   (финал — TIMING; корпорация — FUNCTIONAL, можно без эксклюзива); кадры «до» — клиент HEAD (`TM_E2E_SHOTS_TAG=before`); exit 2/3/4 — СТОП и `AskUserQuestion`;
   `pumpFrames` + эксклюзив для любых чисел финала (гоча BZ «стенд не в условиях»).
3. **Стенд корпорации** — решение 3. **Стенд финала** — расширить `console-finale-podium.spec.ts`: C′ и H получают ПРОБНИК БЮДЖЕТА (решение 9а: зажиганий/с,
   мин. длительность, одновременных ≤ 1 — красный при нарушении на любом темпе), новая сцена **J «ПЕРЕМОТКА — ОДИН ПРОХОД»** (X на второй категории → один
   свет, одометр без ступеней, ≤ 3 перепадов/с, остаток ≤ 2 с, затем ×1 ранжирование и коронация), сцена **K «яркость»** (FHD-скринкаст, решение 9б — свой
   спек `console-finale-flash-budget.spec.ts`, TIMING), G/I — `hurried` под reduced motion; бенч `finale-rich-5p-{natural,x}.json` «до/после» — те же поля,
   что BZ (+ `ignitionsPerSec`, `minEventMs`, `flashesPerSec`).
4. Фикстуры: корпорация — решение 3; финал — существующие `finale-rich-5p` / `-2p` через харнесс (закон «через страницу»).

## 1. Сервер — корпорация (≈ 25 %)
`LakefrontResorts.ts`: `infoText` (решение 2), `tilePlacedForecast` + `tilePlacedPreview` (двойники `onTilePlaced`, те же ранние выходы — `isUncoveredOceanSpace`;
источник `sourceOf(this, cardOwner, 'tile-placed')`; чужой океан — факт у владельца), RU, `card_info`, строка долой + пин (`TurmoilCardsUnderRedux`: корпорации
= [Lakefront]). Спек: правила 1–4 (все виды океана; `oceanBonus` 3 в `MarsBoard.adjacencyBonus`-раскладке и в `BoardInformationEngine`; чужой океан →
событие с источником; прогнозы = исполнение (`effectForecastParity`); модель карты для лица; save/load; коллизия бота). Гарды: `crossPlayerCoverageGuard` —
классификация человеческой Lakefront (семейство «tile-placed» — та же сцена, что Arctic Algae), `effectForecastCoverage`, `cardInformation`, `cardLore`
(R38 ✓), `premiumScope`, `CardMetadata`, `armedPlayEffectCoverage`, `PremiumCard` / `premiumCardViewModel` (лицо корпорации с двумя строками эффекта).

## 2. Клиент — корпорация (≈ 15 %)
Ожидается НОЛЬ новых компонентов: проверить лицо (арт R38, тема корпорации, две строки эффекта с `oceans(all)` / `emptyTile`+`ocean`), стартовую сцену,
«Разыграно»-героя, «Информация › корпорация», нотификацию чужого океана (T06 M1 — существующая приёмка), такт выплаты +3 (`adjacencyPayoutBeat` по
серверной раскладке), досье клетки «N × 3 M€». Всё, что не так, — дефект общего слоя: чинить там, с тестом, не в карте.

## 3. Клиент — ГЛАВНОЕ: «ФИНАЛ — ПРЕМИУМ, НЕ ДИСКОТЕКА» (≈ 60 %)
### 3.А Измерить «до» и макеты (первым делом)
Бенч BZ на базе (`finale-rich-5p-{natural,x}`) + новые поля решения 9 → таблица «до»: зажиганий/с · мин. событие мс · одновременных · перепадов/с ·
худший кадр — на ×1 и под X. Макеты ПОВЕРХ ЖИВОЙ СЦЕНЫ 4K по замороженным часам (гоча BZ: `page.clock.install()` до загрузки → итоги → «Повторить
подсчёт» → шаги): **M1** — решения 5а + 6а + 7а (скользящий свет, одометр); **M2** — 5а + 6б (×3 с гребнем); **M3** — M1, где перемотка — «занавес»:
один проход света с одновременным одометром всех мест и плитой «ИТОГИ ПОДСЧЁТА», без прохода по категориям → батч владельцу (решения 5, 6, 7, 9б)
ДО реализации; раскадровка перемотки FHD (CDP-скринкаст) для каждого макета — владелец должен «почувствовать» перемотку, а не прочитать её.
### 3.Б Скрипт и директор
`consoleEndgameScript.ts`: `CEREMONY_MS.minEvent` (пол, не масштабируется темпом), `hurriedBeats(from)` — свой список битов (`sweep` с `fromIdx`, `odometer`
к финальным суммам, `preRank`); `igniteOffsets` — один подъём на категорию; `consoleEndgameDirector.ts`: `hurry()` = остановить тайм-лайн на границе
бита, уложить `hurriedBeats` с текущего места (все `attach`-твины — под ним), НЕ `timeScale`; `onCount` — одометр (один твин на место до суммы);
`onLight` — режим `glide` (свет не отпускается, скользит к следующей плите) вместо `fall/release` на каждой категории; `onIgnite` — атака ≥ `minEvent`;
reduced motion → `hurried` без света; сеть — от уложенной длины (PL-865 ✓). Спеки: `consoleEndgameCeremony.spec` (пол длительности на обоих темпах; один
свет; `hurried` — один `sweep`, одометр монотонен, `preRank` ×1; второй X — no-op; reduced motion), `consoleEndgameScript.spec` (`hurriedBeats` из любой
точки; сумма = `ceremonyBeats`-итогам).
### 3.В Краска
`console_endgame.less`: переходы зажигания/света — атака ≥ 400 мс ease-out, затухание длиннее атаки; `--eg-pace` ОСТАЁТСЯ только там, где темп законен
(не на зажигании и не на свете — пол), `box-shadow`-свечения без шага (анимировать `opacity` слоя-свечения, не `box-shadow` — слои PL-868); «кольцо» зажигания
— убрать или ≥ 400 мс; `prefers-reduced-motion` — без света; `will-change` остаются (PL-868). Dead-selector guard чистый.
### 3.Г Регрессия
`console-finale-podium` (все сцены + J/K), `console-endgame`, `console-endgame-overview`, `console-endgame-boundary`, `console-campaign-endgame` (чемпион —
замок), `draft-finale-probe`, `tv-profile-screens` — по 2 повтора, `--exclusive --workers=1`, `pumpFrames`; бенч «после» — та же таблица; хуки, задетые
сценой, — тем же диффом (инвариант 14); красный читать по аннотации `build` и нагрузке.

## 4. Лицо, локаль, лор, арт
Лор и арт есть (проверить `cardInfoAudit`); RU — решение 1 (ключи корпорации — свои); новые EN-ключи инфо-модели / пробника (`grep` ДО добавления); глагол X —
«Ускорить подсчёт» остаётся (пока есть что ускорять); RU чужих ключей не переписывать.

## 5. Тесты
1. Спек корпорации; гарды §1 после удаления строки; `TurmoilCardsUnderRedux` (пин корпораций); `AutomaCorporations` (коллизия); `e2eLiveness`, `lessDeadSelectorGuard`,
   `glyphLiteralGuard`, `consoleTvTypeFloor`, `cursorGrammarGuard`, `flightLayerZOrder`.
2. Юниты §3.Б; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §0.3, §3.Г; `npm run e2e:affected` + перевод задетых хуков.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым** стоп-кадрами по часам; FHD — скринкаст-раскадровка ОБОИХ темпов; Deck)
`screenshots/lakefront/{tv,fhd,deck}/`: (а) корпорация: стартовая сцена → композер с прогнозом → океан → тик производства → досье клетки «× 3» → такт +3 →
плашка чужого океана → «Информация»; (б) финал ДО / ПОСЛЕ: 6 стоп-кадров естественного темпа (свет скользит, зажигание мягкое), 6 стоп-кадров перемотки
(один проход, одометр), ранжирование, коронация; (в) ТАБЛИЦА бюджета «до/после» (зажиганий/с · мин. событие · одновременных · перепадов/с · худший кадр ·
длительность подсчёта ×1 и после X) — в реестр; (г) раскадровка FHD перемотки — та, что владелец смотрит глазами: «это премиум-перемотка или дискотека?»

## 7. Полировка по пути
1. Реестр: раздел **CI** «ФИНАЛ — БЮДЖЕТ СВЕТА И СВОЯ ХОРЕОГРАФИЯ ПЕРЕМОТКИ · LAKEFRONT — ПЕРВАЯ КОРПОРАЦИЯ НА МЕСТЕ» — диагноз 1–8 строками (классы:
   «та же хореография быстрее», «событие короче порога», «свет включается на каждой категории», «живой хук без двойников», «честный коэффициент без
   пина»); числа «до/после»; номера — по footer. PL-870 (батч BZ) — закрыть ответами владельца из этого батча.
2. Бэклог `weak-visuals-backlog` — «финал: дискотека» → DONE; «три оставшиеся корпорации» — в список с пометкой «по образцу Lakefront».
3. Доки: `endgame-workspace.md` — § Ceremony machine: «ДВА скрипта (natural / hurried), бюджет света (`minEvent`, ≤ 1 свет, ≤ 3/с), скользящий свет»;
   `.claude/rules/console-ui.md` § THE FINALE — закон 4 дополнить («…and NEVER as a strobe: one light that glides, a floor under every luminous event that no
   pace scales, a hurry that is its OWN choreography — never `timeScale` of the natural one»); `.claude/rules/animations.md` — строка о `minEvent` для церемоний;
   `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — Lakefront «СДАНА» (12 из 22; шаблон для Pristar / Terralabs / Utopia); память `finale-count-as-light-direction`
   — дополнить «ИТЕРАЦИЯ 2»; запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — бенч «до» с новыми полями + макеты M1–M3 перемотки (раскадровки FHD) → батч; корпорация — параллельно.
2. Порядок: корпорация (двойники + инфо + спек + гарды + строка долой) → стенд корпорации → бенч/макеты финала → (после батча) 3.Б скрипт/директор →
   3.В краска → стенд J/K + пробник → регрессия → раскадровки → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву (CI) и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — лицо корпорации с артом; затем таблица бюджета финала ДО / ПОСЛЕ, раскадровки перемотки (M1–M3 и реализация), кадры корпорации,
   регрессия, решения 1–9 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (6 с раскадровками, 5, 7, 9б — рекомендация первой), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Перемотка через `timeScale` естественной хореографии; событие света короче пола на любом темпе; больше одного света одновременно; crossfade плиты на
  каждой категории; тела через сцену (закон 4); пропуск ранжирования / коронации / чемпиона; `setTimeout` вместо холда; `box-shadow`-анимации; ломать
  слои PL-868; числа финала без эксклюзива и `pumpFrames`; 4K-скринкаст как доказательство (пустые кадры).
- Трогать бот-двойник C35 (`MarsBotLakefrontResorts.ts`, `MarsBotCorpData`), переписывать семантику `oceanBonus` (upstream), литерал «2 M€» где-либо на клиенте,
  второй расчёт соседства; хук вне файла карты (инвариант 8); RU чужих ключей; `title`; литерал кнопки; текст ниже пола TV.
- Файлы соседей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
