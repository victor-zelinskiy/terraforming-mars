# Промт исполнителю · TR65 Strategic Shift («Смена стратегии») — красная (событие), 2, без меток, без требования: «Сбросьте с руки любое число карт С ТРЕБОВАНИЕМ. Получите столько же M€ и возьмите столько же карт» — выбор как у «Публичных планов» (множественный альбом руки: A — отметить, R3 — все, RT — с числом), но выбрать можно ТОЛЬКО карты с требованием, выбранное УХОДИТ В СБРОС (скин сброса, не «показа»), и за ним идёт ВСТРОЕННЫЙ шаг добора карт · ГЛАВНОЕ — ИТЕРАЦИЯ «СТОЛ — ЭТО СТОЛ»: «Разыграно» (X) из ящика со стопками-полосками на 4K в стол игрока в масштабе сцены — лица читаемы с дивана, зоны — полки, корпорация — герой, стол занимает проём, соперник — тот же стол, физический подъём в категорию и посадка разыгранной карты сохранены

Выдан 2026-10-17. Инфраструктура набора стоит (TR01–TR61, TR66, TR67 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строки «PRE-SELECT» (`:123` — адрес шага проставляет выходной проход превью), «карта из руки — ТОЛЬКО альбом на
любой глубине»; постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Премиум-планка»** — композиция / иерархия / чипы в масштабе СЦЕНЫ / пробник долей / макеты в батч ПЕРВЫМ /
гард долей; **«Качество полировки»**), журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,console-ui,
animations,tests,localization}.md`. **Главные контракты итерации:** `.claude/rules/console-ui.md` § A CARD FROM THE HAND IS CHOSEN IN THE HAND (`:189` — на любой глубине, никогда из списка имён; отказ —
RT) и `:55` (полоса — центральный проём: модалка не накрывает бар), `:125` (приём ресурса картой — один директор), `:278` (`v-show` стреляет парой enter/leave — мосты выбора), `:396–410` («Разыграно» в
законах полосы); `docs/claude/console/hand-album.md` ЦЕЛИКОМ (§ ADAPTIVE DENSITY — Showcase Pages `:27`, § THE ACTIVE PAGE IS DERIVED FROM THE FOCUS `:90`, § page turn = TRANSFORM SLIDE `:115`, § THE SINGLE
OWNER — hand BODIES `:218`); `docs/claude/console/hud-frame.md` § THE CENTRAL OPENING (`:306`, таблица `:425–430`), `workspace-band.md:47, 101`; `docs/claude/console/information-workspace.md:236`
(встроенный стол — PL-574 / PL-575); законы CLAUDE.md «A WORKSPACE IS ONE FLOW» (п. 3 — `v-if`-подмена = моргание), «Physical causality» (результат переживает поверхность; карта уходит из реального
источника), инварианты 1 (никогда по тексту), 3 (никакого автовыбора), 4 (никакой немой потери), 5 (`title` запрещён), 6 (одна система движения), 9 (английский текст = ключ i18n). Память:
`hand-pick-played-card-hidden` (⚠ разыгрываемая карта НЕ в альбоме своего выбора; «Выбрать все» = **R3** — L3 занят источником), `hand-pick-always-album`, `console-hand-album`, `console-hand-pick-bridge`,
`tr53-card-receive` (один директор приёма), `tr57-reward-scene` (ревил = сцена в проёме), `tr60-information-dossier` (встроенный стол, `EMBEDDED_SCENE_GAIN`, Deck-ступень), `tr58-cursor-living-object`,
`polish-area-premium-visual-first`, `weak-visuals-backlog`, `polish-premium-bar`, `polish-priority-tv4k-no-deck-only`, `polish-direction-smoothness`, `storyboard-catches-what-the-probe-passes`,
`bot-turn-review-out-of-polish-scope`, `concurrent-session-edits-same-files`, `e2e-fixture-generator-gotchas`, `shell-template-escapes`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-17), по смыслу дословно:** «механика должна работать примерно как на „Публичных планах“, только выбрать можно только карты с требованиями, и потом ещё будет идти embedded шаг
добора карт. Отдельно давай внимательно подумаем, в какой ещё области нужна большая итерация визуальных полировок».

**ОБЛАСТЬ ПОЛИРОВКИ ВЫБРАНА ПРИ ПОДГОТОВКЕ.** Метод — память `polish-area-premium-visual-first`: свежий обход 4K (GPU) трёх экранов, которых прошлые обходы не снимали (`screenshots/tr65/`): маршрут «Публичных
планов» (W1 — множественный альбом: на планке — крупные лица, чипы «✓ ВЫБРАНА», R3, бейдж числа на RT, крошка непрерывна), маршрут «Спонсирования науки» (W2 — сброс в композере + встроенный добор «Получены
карты»: на планке), **«Разыграно» (X) на насыщенном столе** (W3 — 20 карт: ящик 53 % экрана поверх затемнённого поля, стопки имён-полосок 13–17 px при поле TV 32 px, 51 текст ниже пола, правая треть
ящика пуста; читать нечего, пока не спустишься в категорию) и создатель партии (W4 — список из 5–6 рядов на 30 % высоты поверх фона, 17–27 подписей 24–30 px — второй кандидат, в бэклог). Из двух открытых
пунктов бэклога (№ 15 «Разыграно», № 17 предигровые экраны) стол — чаще (каждая партия, своё и соперника, в игре) и хуже (на 4K не читается). Разбор хода бота — вне полировок (владелец).
Итерация (≈ 85 %): **А. «СТОЛ В ПРОЁМЕ»** — шасси: стол занимает центральный проём как workspace, а не ящик над полем (≈ 20 %); **Б. «ЛИЦА ЧИТАЕМЫ»** — плотность стола на планировщике альбома: лица в
масштабе сцены, полки по зонам, корпорация — герой (≈ 35 %); **В. «ФИЗИКА СОХРАНЕНА»** — подъём в категорию, X-вьюер и посадка разыгранной карты на новой геометрии (≈ 20 %); **Г. «СОПЕРНИК И ПУСТОТА»** —
LB/RB на том же шасси, бот, пустые состояния объектами (≈ 10 %). Карта (≈ 15 %) — бесподобный розыгрыш из ТРЁХ известных механизмов.

## ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (HEAD `fd0bfe813b`, дерево чистое, соседних сессий нет; кадры 4K GPU — `screenshots/tr65/tv4k/*.png`, листы `screenshots/tr65/sheet-w{1,2,3,4}-*.jpg`; числа —
`screenshots/tr65/tv4k/w5-probe.jsonl`, `w3-probe.json`; стенд подготовки — `screenshots/tr65/walk.stand.spec.ts` (вне git); файл:строка подтвердить на своём HEAD)

**Числа пробника (4K, фикстура `info-dossier` — 20 разыгранных; кегль ЭФФЕКТИВНЫЙ, `fontSize × currentCSSZoom`; пол TV 32 px):**

| экран | корень | доля экрана | содержимое: низ / право ящика | текстов ниже пола | кегли |
| --- | --- | --- | --- | --- | --- |
| «Разыграно» обзор (X) | `.con-played` 3358 × 1315 @ y 673 | 53 % | 97 % / 87 % | **51** (имена лиц 12–20 px) | 12–20 px × 51, 34 px × 13 (подписи зон), 58 px × 1 |
| спуск в «АКТИВНЫЕ 14» | та же | 53 % | 81 % / 96 % | 92 (внутренности лиц) | 15–26 px, лица ≈ 441 px |
| (для сравнения) альбом руки, TR58 | проём | ≈ 100 % | — | лица ≈ 520 px | имя ≈ 21–24 px |

1. **Ящик, а не стол.** `.con-played` — `position: fixed`, `.con-ws-stage-sides()`, `bottom: max(--con-band-bottom, 4.3rem)`, высота по содержимому с крышкой `100vh − band-top − band-bottom`
   (`console_played.less:19–36, 97–100`), z 11400, без собственной шторки и без `data-motion-surface`; на 4K — нижние 60 % экрана, сверху выглядывает затемнённая планета. Монтируется `ConsoleShell.vue:533`
   (`<transition name="con-layer">`), открыт при `playedOpen || playedHeroState.tableOpen` (`:3462`); подвал и док руки отступают (`:3119, :3283`). Кадр `w3-00-played.png`.
2. **Стопки имён-полосок.** Планировщик `consolePlayedModel.ts`: натуральное лицо 320 × 460 (`:40–41`), просвет стопки 75 (`:50`), стопка 2–9 (`:52–53`), лестница зума по числу карт 0,58 → 0,42
   (`playedBaseZoom` `:148–161`), `planPlayedLayout` `:170–177` (zoom = лестница × `uiScale`), бюджет высоты стопки `max(280·s, viewportH − 296·s)` (`ConsolePlayedOverlay.vue:238–240, 459–466`);
   `ConsolePlayedPile.vue` — слот = `peekH` у накрытых, `cardH` у верхней (`:37`), накрытые рисуются дешёвым лицом без арта (`coveredAt` `:99`). Итог на 4K: 14 активных карт = две стопки из 7 полосок по
   ≈ 87 px с именем 13–17 px — с дивана не читается ничего, кроме подписей зон (34 px). Альбом руки на том же экране даёт лица ≈ 520 px (`consoleHandAlbum.ts` — адаптивная плотность, `planHandAlbum`
   `:181`, `pageRowsFor` `:232`, `planAlbumPage` `:330` — ЧИСТЫЙ планировщик, не привязан к руке: вход — бокс, число, профиль).
3. **Композиция.** Четыре зоны в ряд слева направо (корпорация `:69–85`, прелюдии `:86–102`, CEO `:103–119`, активные `:122–138`, автоматические `:139–155`, события `:163–178` — стопка рубашек ≤ 3 + бейдж,
   `ConsolePlayedEventsPile.vue:13–25`), всё внутри `ConsoleScrollArea` (`:43`); правая треть ящика пуста (право 87 %), корпорация — такое же лицо 371 px, как и всё остальное, без веса героя; шапка
   «РАЗЫГРАНО · player1 · 20». TV-блок (`console_tv.less:1964–2008`) — кольца фокуса + типографика, геометрии не касается.
4. **Хорошее, НЕ ломать (физика стола):** навигация ТОЛЬКО по категориям (`pickSpatialTarget` `:840–863`, спеки `ConsolePlayedOverlay.spec` «categories only»); A / X на категории → `ConsolePlayedCategoryView.vue`
   — карты ФИЗИЧЕСКИ поднимаются со своих слотов в сетку и возвращаются (один физический экземпляр, слоты держат место, события переворачиваются в полёте `:122–140`; планировщик `planCategoryView`
   `consolePlayedCategoryModel.ts:120` на `planHandGrid`, зум 0,5–0,9 × uiScale `:83–88`, бюджет полётов `:168`); зона из ОДНОЙ карты открывает вьюер сразу (`:936–944`); X → `openConsoleCardZoom` с
   `slotZoomOrigin` + табличка происхождения (`playedProvenance.ts:57, 83`); стол стоит на сцене, пока карта во вьюере (`console-played-zoom-return`); **ПОСАДКА РАЗЫГРАННОЙ КАРТЫ** — входящая карта добавляется в
   зоны ДО коммита, слот скрыт до ревила (`heroHiddenKey` `:424`), счётчик событий отстаёт до ревила (`:433`), цель посадки — `measureHeroTarget` / `peekHeroTarget` (`:970–1019`: `[data-played-key]
   .con-played__face` или `.con-played__backstack`, 2 стабильных кадра) через `providePlayedHeroTarget` (`:597`; регистр «последний пишущий» — `consolePlayedHero.ts:429`), слой героя
   `ConsolePlayedHeroLayer.vue` (z 11660), сцена приёма в workspace розыгрыша `ConsolePlayedReceivingStage.vue` (своя полка, `[data-recv-front]`, `planReceivingStage` `receivingStageModel.ts:214`) — ОДИН
   директор `runCardReceive({host: 'played'})` (`consolePlayedHero.ts:1760–1766`, TR53); гидратация ≤ 60 лиц синхронно, далее 36 в кадр (`:259, :264, :697`); встроенный режим в «Информации»
   (`ConsoleInfoMode.vue:165`; `forcedColor` `:332`, `fitEmbeddedRoom` `:644–678`, `EMBEDDED_SCENE_GAIN` — PL-568 / PL-575); бар через `consolePlayedUi.ts` (standalone `ConsoleShell.vue:9671–9693`).
5. **Дрейф дока:** `docs/CONSOLE_MODE_CONCEPT.md:409` — X «View toggle (played table)», в коде A / X открывают категорию.
6. **Маршрут карты на планке:** W1 — альбом множественного выбора (`w1-01…04`): чипы «✓ ВЫБРАНА», полоса «Выбрано · +N M€ · было → станет» (`ConsoleHandSection.vue:169–193`), RT с бейджем числа
   (`ConsoleShell.vue:9369–9379`), ответ — строка композера «Травоядные, Технология адаптации +5 M€» (`ConsolePlayCardConfirm.vue:3446–3478`); W2 — скин сброса «СБРОСЬТЕ 1 КАРТУ · −1 → +3» и встроенный
   добор «Получены карты · ПОЛУЧЕНО 3» в крошке «КАРТЫ В РУКЕ › СПОНСИРОВАНИЕ НАУКИ › ДОБОР КАРТ» (`w2-04-commit-04`). **Открыто рядом: PL-259** (`gameplay-polish-ledger.md:793`) — множественный выбор
   `min 0`: RT при нуле выбранных подписан глаголом выбора с бейджем 0 (TR65 — такой же `min 0`; закрыть по пути).

## Обязательное чтение до кода
`docs/claude/console/hand-album.md`, `hud-frame.md:300–430`, `workspace-band.md`, `information-workspace.md:200–260`, `played-target-self.md`; `src/client/components/console/played/{ConsolePlayedOverlay,
ConsolePlayedPile,ConsolePlayedCardLite,ConsolePlayedEventsPile,ConsolePlayedCategoryView,ConsolePlayedHeroLayer,ConsolePlayedReceivingStage}.vue`, `playedProvenance.ts`, `src/client/components/console/
{consolePlayedModel,consolePlayedCategoryModel,consoleHandAlbum}.ts`, `src/client/console/{consolePlayedUi,consolePlayedHero}.ts`, `console/played/receivingStageModel.ts`, `info/ConsoleDossierCards.vue` +
`infoDossierModel.ts:108–137` (ярус истории карт TR60 — ОБЗОР, не стол), `src/styles/console_played.less`, `console_tv.less:1960–2010`, `console_info_dossier.less:331–447`; спеки `tests/client/components/
console/{ConsolePlayedOverlay,ConsolePlayedPile,ConsolePlayedReceivingStage,consolePlayedCategoryModel,consolePlayedHero,consolePlayedModel,playedCardReturn,playedHeroModel,playedProvenance}.spec.ts`,
e2e `console-played-perf-probe` (`PLAYED_PERF=1`, столы 20 / 50 / 100 / 200, профили Deck ×4 CPU и tv-4k), `console-played-zoom-return`, `console-play-landing-{probe,geometry}` (standalone `.con-played`
не стоит во время розыгрыша из workspace; геометрия прокси = реальной карте), `console-recv-perf-probe`, `console-info-workspace:393–447`, `console-workspace-band:342–347`, все 33 спека с `con-played`
(grep). Карта: `promo/PublicPlans.ts` (`:34–55` розыгрыш, `:62–78` превью с `multiSelect` + `disabled`), `venusNext/SponsoredAcademies.ts:55–110` (один построитель маркера сброса для живого промпта и
превью; шаг только при ≥ 2 картах), `parliament/resolutions/scientists/OpenIpTrade.ts:130–182` (сброс → M€ → добор, маркер `exchange: {icon, amount, perCard, draw}`), `ceos/Ender.ts:28–40`
(`DiscardCards(0, max, …, {exchange: discardForCards(1, true)})` → `DrawCards.keepAll(cards.length)`), `deferredActions/DiscardCards.ts:40–95` (авто-сброс при `hand ≤ min`), `inputs/discardPrompt.ts:73–80`,
`inputs/SelectCard.ts:15–48, 113–122, 208–216` (`disabled` сериализуется и никогда не принимается), `actionPreviews.ts:823–882, 1037–1130, 1366–1376`, `common/inputs/preselectAddress.ts:77–117`;
клиент: `console/consoleHandPick.ts:36–62, 148–160`, `components/console/ConsolePlayCardConfirm.vue:3394–3480, 4371–4422, 4872–4886`, `ConsoleHandSection.vue:140, 169–193, 281–294, 1219–1228, 1574`,
`ConsoleShell.vue:7241, 7398–7420, 7443, 9369–9379, 15501–15508`, `console/played/consolePlayOutcomeClaim.ts:96–99, 292–324`, `console/cardDiscard/discardIntent.ts:110–132`, `handPickRouting.ts:38`;
`tests/e2e/console-public-plans.spec.ts` (фикстура `generate.ts:835–850`), `console-sponsored-academies.spec.ts:94–174` (ОДИН POST, адрес `{role: 'discard', source: {card}}`; встроенный добор НЕ закреплён),
`screenshots/public-plans/stand.spec.ts` (идиома альбома), гарды `tests/models/{cardPlayPreviewCoverage,cardPlayReplayCoverage,countedPlayForecast}.spec.ts` (`:245–275` — чип, чьё число меняется
между бедным и богатым столом, падает; «Публичные планы» проходят, не кладя счётный чип в `effects`). Последняя запись журнала (TR61 / TR67 — формат).

## Что это за карта
**Скан:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR65.png`. Правила набора — `…\TM Turmoil Redux\Turmoil Redux Rules.pdf` (текст — `C:/tmp/redux-rules.txt`).
Арт: в `C:\Users\zelin\Downloads\Mars Arts\` файла `TR65.png` **НЕТ** (есть TR60, TR61, TR67) — спросить владельца (решение 3).
**Красная (EVENT), 2 M€, без меток, без требования, без ПО, без ресурса.**

### Чтение скана
Красная рамка; цена **2**; MIN-плашка у цены пуста — требования нет (как у TR66 / TR05). В углу — значок события (жёлтый диск со стрелкой вниз); меток нет. Заголовок «STRATEGIC SHIFT». Нижний блок:
«−X [карта с плашкой MIN]  +X [M€]  +X [карта]» — чёрная карта с ЖЁЛТОЙ плашкой требования в углу (карта с требованием), затем золотой жетон M€ с «X», затем обычная карта; текст: «(Discard as many cards with a
requirement from your hand as you like. Then gain the same amount of M€ and draw that many cards.)». Лор: «Strategy isn't about what you do. It's about what you decide NOT to do.» Кредит арта: gorodenkoff /
istockphoto. Фиолетовый ромб внизу слева — символ модуля, без `compatibility`. Номер TR65. Печать — по скану: «карта с плашкой требования» УЖЕ печатается — `cards(1, {secondaryTag: AltSecondaryTag.REQ})` (`common/cards/render/AltSecondaryTag.ts:4`, как у Cutting Edge
Technology); ряд: `b.minus().cards(1, {secondaryTag: AltSecondaryTag.REQ, text: 'X'}).plus().megacredits(1, {text: 'X'}).plus().cards(1, {text: 'X'})` — сверить с лицом Cutting Edge Technology и печатью «X» у
других карт набора (TR43 «X» на ряду); премиум-лицо (`premiumCardIcons`) должно знать `req` — проверить гард.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/StrategicShift.spec.ts`)
1. **Требования нет**; событие — в стопку событий лицом вниз (стол: зона «СОБЫТИЯ» — то, что полирует итерация).
2. **Карта с требованием** = `card.requirements.length > 0` (`ICard.ts:504`; так считают Forecaster `awards/Forecaster.ts:11`, Nobel Prize `prelude2/NobelPrize.ts:30`, Cutting-Edge Technology
   `promo/CuttingEdgeTechnology.ts:32`, Xavier `ceos/Xavier.ts:43`, бот-Inventrix `automa/corps/MarsBotInventrix.ts:67`): плашка партии (`{party}` → `PartyRequirement`, `requirements/CardRequirements.ts:101`),
   параметры, метки, ресурсы, города, колонии, поколение — всё в одном дескрипторе (`common/cards/CardRequirementDescriptor.ts:29–94`); карта без требования — НЕ кандидат. Сама TR65 — не в наборе (она уже
   покинула руку на живом промпте; в превью — `disabled` с причиной «This card is being played», образец «Публичных планов» `:72–74`; память `hand-pick-played-card-hidden` — в альбоме не показывается).
3. **Выбор — СБРОС, не показ:** живой промпт — `DiscardCards(player, 0, eligible.length, title, {source: cardSource(this), exchange: {icon: 'megacredits', amount: 1, perCard: true, draw: 1}})` (маркер
   `discardPrompt` — скин сброса на консоли, карты УХОДЯТ в сброс; образец Ender `:34–38` + маркер Open IP Trade `:176–179`) с кандидатами ТОЛЬКО из правила 2 (`DiscardCards` сегодня строит `SelectCard` на
   ВСЮ руку `:76–80` — нужна опция кандидатов: `options.cards?` → `SelectCard(…, eligible, {min, max})`, остальная рука — `disabled` с причиной «No requirement on this card»; одна правка модуля, спек);
   `min: 0`, `max: eligible.length`, `showSelectAll: true`; при `eligible.length === 0` — вопроса нет, пропуск ПО ИМЕНИ («Сброшено 0 — нет карт с требованием», `recordSkippedEffect`), карта играется (цена 2 —
   выбор игрока; «действие без эффекта» — признак бесполезности для композера: «нечего сбросить» до нажатия); `hand ≤ min` авто-сброс `DiscardCards.ts:50–59` при `min 0` не срабатывает — проверить.
4. **Затем** (в ТОМ ЖЕ `andThen`, в порядке скана): `stock.add(MEGACREDITS, n, {log: true, from: {card: this}})` → `drawCard(n, {source: {type: 'card', cardName}})` (или `DrawCards.keepAll(player, n)` под
   скоупом карты — как Ender); n = 0 → ничего, без строк; колода короче — «Only N of M cards were left in the deck» (образец Open IP Trade `:160–163`) — никакой немой потери.
5. **Превью = исполнение** (`cardPlayPreview`, образец «Публичных планов» `:62–78` + «Спонсирования науки» `:95–109`): один шаг `selectCardStep(player, title, 'Discard', eligible, {min: 0, max,
   showSelectAll: true, disabled: [self + карты без требования с причиной], multiSelect: {countLabel: 'Cards to discard', revealGain: {resource: MEGACREDITS, amount: 1}, …+ добор на карту — решение 5},
   for: {role: 'discard', source: cardSource(this)}, discard: {min: 0, max, source, exchange}})` — ОДИН построитель маркера для живого промпта и превью (`SponsoredAcademies.discardOptions`); в `effects`
   — НИ ОДНОГО счётного чипа (гард `countedPlayForecast:245–275` — богатый стол меняет число; «Публичные планы» проходят так же); `cardPlayReplayCoverage` строит самый дешёвый ответ (0 карт) — набор
   кандидатов превью ≡ живому.
6. **Адрес ответа** — `{role: 'discard', source: {card: TR65}}` (`preselectAddress.ts:77–117`; e2e «Спонсирования науки» `:146–147`): ответ садится ТОЛЬКО в свой сброс — вопрос университета Марса (метка
   науки на сброшенной? нет — у TR65 меток нет) не встречается, но «две сброса до нажатия не называют одну карту» (`cardsHeldByOtherDiscards` `ConsolePlayCardConfirm.vue:4378`) действует.
7. **Один POST** — весь розыгрыш: `[play, {discard: cards, for}]`; добор n карт — ВНУТРИ ответа сервера, карты приходят на встроенную сцену добора руки (`claimPlayOutcome(card, expectedCards = n)` —
   `consolePlayOutcomeClaim.ts:292–324`; сегодня `draws` суммирует только ФИКСИРОВАННЫЕ чипы `ConsolePlayCardConfirm.vue:4881–4882` → размер ожидания от выбранного числа — правка); сцена добора —
   «Получены карты · ПОЛУЧЕНО n» в крошке `КАРТЫ В РУКЕ › СМЕНА СТРАТЕГИИ › ДОБОР КАРТ` (TR57), standalone-полоса не монтируется ни кадром (проба `console-viron-repeat-draw`).
8. **Ответы стола:** на сброс — Mars University не реагирует (это не розыгрыш науки), TR46 Research Startups отвечает на ПРОДАЖУ патентов, не на сброс (`onPatentsSold` — не звать); на добор — Olympus
   Conference нет; Mons Insurance нет. Metka-реакций нет (меток нет). Прогноз стола — пуст, честно.
9. **Ноль кандидатов — названо ДО нажатия, не канал бесполезности действий:** `ICard.actionFutility` (`actionFutilities.ts`) — только для ДЕЙСТВИЙ; у розыгрыша язык — превью: `warningNote(text,
   {skipped: {label}})` (`actionPreviews.ts:823–834`, образец «Партийных санкций» правило 4 — «the composer says so BEFORE the play and draws no door») + на сервере `recordSkippedEffect` (`effect-skipped`
   с причиной — новая `SKIP_REASON`-строка «No card with a requirement in hand»); карта всё равно играема (решение 6).
10. **MarsBot** карту не играет; save / load — обычное событие; превью чисты (не мутируют руку).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **Имя RU** — «Смена стратегии» (коллизий нет; «Стратегическое планирование базы» — прелюдия, не мешает). Альтернатива «Стратегический разворот».
2. **Лор** — EN слово в слово (ключ `TR65`); RU: «Стратегия — не в том, что ты делаешь. А в том, что решаешь НЕ делать.»
3. **Арт** — нет файла; лицо без арта до выдачи (первая строка отчёта).
4. **Скин выбора** — (а, рекомендовано) альбом множественного выбора «Публичных планов» (A — отметить / снять, R3 — все, RT — «Сбросить» с бейджем числа, полоса «Выбрано N · +N M€ · +N карт · было → станет»)
   В СКИНЕ СБРОСА (маркер `discardPrompt` — шапка «СБРОСЬТЕ ЛЮБОЕ ЧИСЛО · −X → +X M€ +X карт», на коммите карты уходят в сброс лотком — существующая кинематика сброса); карты без требования скрыты
   фильтром «Только подходящие» («Показано X из Y», LT — показать с причиной «Без требования»); (б) скин показа (карты остаются до коммита) — отменяет физику сброса.
2-я выплата: (а) расширить `multiSelect.revealGain` / `gainPerCard` второй выплатой в картах (`gainPerCard.cards` уже есть у Open IP Trade — `consoleHandPick.ts:46–49`, полоса `ConsoleHandSection.vue:
   181–185`; композер его не передаёт `ConsolePlayCardConfirm.vue:4409` — правка) и строка ответа «Травоядные, Лишайник +2 M€ +2 карт»; (б) только M€ в полосе, добор — чипом «+N карт» в результате.
5. **PL-259 по пути** — (а, рекомендовано) при нуле выбранных RT = «Ничего не сбрасывать» (слова отказа, без бейджа) — для ВСЕХ `min 0` (Публичные планы, Astra); (б) оставить.
6. **Ноль кандидатов** — (а, рекомендовано) карта играема, композер говорит «Нечего сбросить: нет карт с требованием» ДО нажатия (предупреждение превью с именованным пропуском — правило 9), шага нет; (б)
   карта неиграема (`bespokeCanPlay` false) — спорно с правилами (событие за 2 M€ можно сыграть ради метки события… меток нет; ради «событий сыграно» — да, считается).

**ИТЕРАЦИЯ «СТОЛ — ЭТО СТОЛ» (решения 7–10):**
7. **Шасси** — (а, рекомендовано) стол стоит в ЦЕНТРАЛЬНОМ ПРОЁМЕ как workspace (`.con-ws-band()` / законы полосы: рельс игрока слева, бар снизу, стол — вся полоса, крошка «РАЗЫГРАНО › player1»), поле
   под ним не просвечивает; закрытие — возврат на поле (как у «Информации»); (б) ящик, как сегодня, но на всю высоту полосы.
8. **Плотность** — (а, рекомендовано) стол планируется ТЕМ ЖЕ чистым планировщиком, что альбом руки (`planHandAlbum` / `planAlbumPage` — showcase-страницы: лицо ≥ масштаба альбома на 4K, имя читается с
   дивана), зоны — ПОЛКИ с подписью и счётом (корпорация · прелюдии · CEO · активные · автоматические · события), стопки имён-полосок уходят; корпорация — ГЕРОЙ (крупнее полки, с ресурсами / действиями
   на лице); страницы — когда полки не помещаются (d-pad листает, активная страница выводится из фокуса, перелистывание — transform-slide по закону альбома); события — стопка рубашек с числом (как сейчас)
   + спуск в их категорию; (б) оставить стопки, но лестницу зума поднять до читаемости и ограничить стопку 3–4.
9. **Физика** — (а, рекомендовано) подъём в категорию и возврат — ТОТ ЖЕ `ConsolePlayedCategoryView` (слоты держат место, один экземпляр), X-вьюер с `slotZoomOrigin`, посадка разыгранной карты —
   тот же `providePlayedHeroTarget` / `measureHeroTarget` на НОВОЙ геометрии полки (цель — реальное лицо на полке, `[data-played-key] .con-played__face` / `.con-played__backstack`), сцена приёма
   `ConsolePlayedReceivingStage` — без изменений (своя полка в workspace розыгрыша); (б) только обзор без физики — запрещено законом «Physical causality».
10. **Соперник, бот, пустота** — (а, рекомендовано) LB/RB — тот же стол (крошка «РАЗЫГРАНО › Rival»), бот — его публичная стопка + табличка происхождения (как сейчас), пустой стол — собранное состояние
    (силуэт полки + одна строка ≥ пола), «только корпорация» — герой и тихая строка; встроенный стол в «Информации» — тот же планировщик с долей проёма (`EMBEDDED_SCENE_GAIN` → доля, PL-568 / 575 не
    регрессируют); (б) соперник и бот — как сейчас.

## 0. Рабочее дерево
1. `git log --oneline -1` → `fd0bfe813b` на выдаче, дерево чистое, соседних сессий нет. **Сначала** `ListAgents` + процессы playwright (память `pasted-prompt-author-may-still-run`); если рядом жива сессия —
   `SendMessage` о порядке по `console.less` / `console_played.less` / `console_tv.less`, `ConsoleShell.vue`, `ConsolePlayCardConfirm.vue`, `.claude/rules/console-ui.md`; её файлы не трогать до её коммита.
   Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`.
   Не пушить. ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки клиента — неиспользуемый импорт роняет `npm run build:client` всем сессиям.
2. Снапшот e2e — свой: `npm run e2e:snapshot tr65` + `TM_E2E_ROOT=.e2e-tr65`; кадры «до» — клиент HEAD в своём снапшоте (память `ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`, ANGLE
   d3d11 — `screenshots/tr65/pw.config.ts`). ⚠ Скриншот 4K ≈ 1 с — хронометраж только пробником. Снапшот подготовки `.e2e-tr65prep` удалён.
3. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки. Нужны: (а) TR65 в руке + 3–4 карты с требованием + 2–3 без (параметр / метка / плашка партии — все виды дескриптора) — `strategic-shift`;
   (б) TR65 без единой карты с требованием — `strategic-shift-none`; (в) одна карта с требованием (`max = 1` — одиночная семантика `ConsolePlayCardConfirm.vue:3398` — проверить, что альбом остаётся
   множественным, как у «Публичных планов» с одной картой); (г) колода короче n; (д) стол: `info-dossier` (20 карт) + стол 50 карт для страниц (перф-проба `console-played-perf-probe` умеет 50 / 100 / 200) +
   соперник с 5 картами + бот.
4. **Пробник под `zoom`:** `fontSize × currentCSSZoom`; лица `.pcard` — свой масштаб, мерить ШИРИНУ лица (≥ масштаба альбома на 4K), не кегль внутри; текст в SVG — исключать.

## 1. Сервер — карта (≈ 10 %)
1. `src/server/cards/turmoilRedux/StrategicShift.ts` — `Card` (EVENT), заголовок = чтение скана + правила 1–10; константы `MEGACREDITS_PER_CARD = 1`, `CARDS_PER_CARD = 1`; `eligibleCards(player)` (правило 2,
   без себя); `bespokePlay` (правило 3–4: `DiscardCards(0, max, title, {source, exchange, cards: eligible})` → `andThen(cards → stock.add → draw)`; 0 кандидатов — пропуск по имени); `cardPlayPreview`
   (правило 5); `description` слово в слово; `renderData` по скану. `CardName.ts` (`STRATEGIC_SHIFT = 'Strategic Shift'` после `CARGO_MECHS`, `:1136`), `TurmoilReduxCardManifest.ts` (после `:310`),
   `npm run make:cards`, `card_info.json` RU, `turmoil_redux_cards.json`, `lore_texts.json` ×2.
2. `DiscardCards` — опция кандидатов (`options.cards` + `disabled` с причиной для остальной руки; `toModel` сериализует `disabledCards` — `SelectCard.ts:208–216`); `discardPrompt.ts` — `exchange.draw`
   уже есть; спек `tests/inputs/discardPrompt.spec.ts` (`:24` — каждый промпт `DiscardCards` помечен; `:53` — авто-сброс не спрашивает) + случай «кандидаты уже руки».
3. Ноль кандидатов — предупреждение превью с именованным пропуском + `recordSkippedEffect` на розыгрыше (правило 9); канал `actionFutility` НЕ трогать — он для действий (память `futile-actions-iteration`).

## 2. Клиент — карта (≈ 5 %): «ПУБЛИЧНЫЕ ПЛАНЫ × СБРОС × ВСТРОЕННЫЙ ДОБОР»
- Композер: шаг множественного сброса → `openHandPick` (`ConsolePlayCardConfirm.vue:4371–4422`) с `discard` (скин сброса) И `gainPerCard: {icon: M€, amount: 1, cards: 1}` (вторая выплата — решение 4);
  полоса альбома читает `cards` (`ConsoleHandSection.vue:181–185`), шапка сброса — `discardIntent.ts:110–132` (`exchange.draw` сегодня читает только партийный композер → общий `discardExchangeFor`
  возвращает и добор); строка ответа «+N M€ +N карт» (`chosenImpact` `:3446–3478`); RT при нуле — решение 5 (`ConsoleShell.vue:9369–9379`, `handSelectPicksValid` `consoleHandSelectModel.ts:73`).
- Коммит: ОДИН POST; `claimPlayOutcome(card, n)` — n из выбранного числа (`:4881–4882` — суммировать и выбор); сброс уходит лотком (существующая кинематика `leaving` — для PRE-SELECT карты уходят на
  коммите, как у «Спонсирования науки»); добор — встроенная сцена «Получены карты» (TR57), крошка `КАРТЫ В РУКЕ › СМЕНА СТРАТЕГИИ › ДОБОР КАРТ`; standalone не монтируется.
- Ноль кандидатов — композер без шага, предупреждение превью (именованный пропуск) до нажатия (решение 6, правило 9).

## 3. Клиент — ГЛАВНОЕ: «СТОЛ — ЭТО СТОЛ» (≈ 85 %)
### 3.А «СТОЛ В ПРОЁМЕ» (решение 7)
- `.con-played` standalone → шасси полосы (`.con-ws-band()` / `hud-frame.md` § THE CENTRAL OPENING): рельс игрока слева, бар снизу, стол — вся полоса; крошка «РАЗЫГРАНО › ‹игрок›» на `ConsoleWsHead`
  (стабильный контекст → изменяемая стадия: `› АКТИВНЫЕ` при спуске); вход / выход — surface-motion (`data-motion-surface`, общая шторка `.con-shade`), не `con-layer`; подвал и док — как у workspace;
  z-порядок относительно task host (11480) и слоя героя (11660) сохранить (обязательная поверхность закрывает стол первой — hard-block watcher).
- Закон «A WORKSPACE IS ONE FLOW»: спуск в категорию — та же фраза на уровень глубже (крошка + подъём карт), B — один уровень назад.

### 3.Б «ЛИЦА ЧИТАЕМЫ» (решение 8)
- Планировщик стола — на `planHandAlbum` / `planAlbumPage` (чистый, вход: бокс полосы, число карт зоны, профиль, `uiScale`); зоны — полки с подписью и счётом; корпорация — герой (своя полка, крупнее);
  события — стопка рубашек + число; страницы — d-pad, активная страница из фокуса, перелистывание — transform-slide; **фокус — по категориям** (как сейчас) ИЛИ по карте внутри полки — решить с
  владельцем в батче (сегодня «per-card cursor is gone by design» — `ConsolePlayedOverlay.vue:7–9`); пробник долей ДО / ПОСЛЕ: ширина лица на 4K (≥ альбома), низ / право содержимого, пустота ≤ трети.
- Гидратация — бюджет сохранить (≤ 60 лиц синхронно, далее по кадрам); перф-проба `console-played-perf-probe` на 50 / 100 / 200 — без регресса на tv-4k и Deck ×4 CPU (память `perf-on-gpu`: мерить и на GPU).
- TV-блок `console_tv.less` — геометрия стола через токены, не только типографика; Deck — своя ступень (гоча TR60).

### 3.В «ФИЗИКА СОХРАНЕНА» (решение 9)
- Подъём в категорию: `ConsolePlayedCategoryView` поднимает карты С ПОЛКИ (новые слоты `[data-played-key]`), слоты держат место, события переворачиваются, возврат — на полку; один экземпляр
  (`ConsolePlayedOverlay.spec` «face-up categories hold their slots while lifted»); зона из одной карты — вьюер сразу.
- Посадка разыгранной карты: `measureHeroTarget` / `peekHeroTarget` читают лицо НА ПОЛКЕ (2 стабильных кадра), `heroHiddenKey` до ревила, счётчик событий отстаёт до ревила; `ConsolePlayedReceivingStage` и
  `runCardReceive({host: 'played'})` — без изменений; e2e `console-play-landing-{probe,geometry}` зелёные (геометрия прокси = реальной карте на новой полке).
- X-вьюер: `openConsoleCardZoom` с `slotZoomOrigin` с полки, табличка происхождения (seat · zone · N of M), стол стоит на сцене (`console-played-zoom-return`).

### 3.Г «СОПЕРНИК И ПУСТОТА» (решение 10)
- LB/RB — тот же стол, крошка меняет игрока без пустого кадра (`cycleViewedPlayer`, категория складывается); бот — публичная стопка + происхождение; пустые состояния — объектами; встроенный стол
  «Информации» (`forcedColor`, `fitEmbeddedRoom`) — тот же планировщик с долей проёма, PL-568 / PL-575 не регрессируют (e2e `console-info-workspace:393–447`, `console-info-dossier`).

## 4. Лицо, локаль, лор, арт
`renderData` по чтению скана; `description` слово в слово; RU-кураторство `card_info.json` («Сбросьте с руки любое число карт с требованием. Затем получите столько же M€ и возьмите столько же карт.»);
титул сброса / причина «Без требования» / строка бесполезности / крошка стола — новые английские ключи (grep ДО, сборка падает на дубликате); RU чужих ключей не переписывать; лор / арт — решения 2–3.

## 5. Тесты
1. `tests/cards/turmoilRedux/StrategicShift.spec.ts` — правила 1–10 (кандидаты по видам требования: параметр / метка / плашка партии / ресурсы; без требования — `disabled` с причиной; сама карта — нет;
   `min 0` без авто-сброса; 0 кандидатов — пропуск по имени, играема; n = 3 → −3 карты, +3 M€, +3 карт в одном ответе; колода короче — строка; адрес `{role: 'discard'}`; чистота превью; save / load).
2. Гарды зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `effectExtraction`, `premiumCardViewModel` (строка арта), `premiumCardIcons`, `effectForecastCoverage`,
   `countedPlayForecast` (без счётного чипа), `actionFutility`, `readingParamsGuard`, `glyphLiteralGuard`, `e2eLiveness`, `consoleTvTypeFloor`, `tests/inputs/discardPrompt.spec.ts` (опция кандидатов).
3. Клиент (карта): `consoleHandPick` / `ConsolePlayCardConfirm` спеки — вторая выплата в картах у композерного пика, RT при нуле (решение 5), `claimPlayOutcome` с n из выбора, `discardIntent`
   (`exchange.draw` в общей шапке).
4. Клиент (стол): `consolePlayedModel.spec` (планировщик полок на альбоме: страницы, герой, uiScale lockstep), `ConsolePlayedOverlay.spec` (категории / карта — по решению, слоты держат место, hero reserve),
   `consolePlayedCategoryModel.spec` (целевые ректы с полки), `ConsolePlayedPile.spec` — переписать под полку или удалить вместе со стопками (с переводом в том же диффе).
5. e2e `tests/e2e/console-strategic-shift.spec.ts` (fhd + tv4k): **A** альбом множественного сброса — только карты с требованием видны, «Показано X из Y», LT показывает остальные с причиной, A / R3 / RT с
   числом, полоса «+N M€ +N карт»; **B** ОДИН POST (перехват), адрес сброса, карты уходят лотком, добор n встроен (standalone-полоса не монтируется ни кадром), рука = −n + n, M€ = −2 + n; **C** 0 кандидатов —
   строка бесполезности, игра без шага; **D** RT при нуле — отказ (решение 5); **E** событие ложится в стопку событий стола (счётчик +1 после ревила).
   e2e `tests/e2e/console-played-table.spec.ts` (fhd + tv4k + deck): **A** стол 20 карт — ширина лица ≥ альбома на 4K, ни одного имени ниже порога читаемости (измерить ширину лица, не кегль), пустота
   ≤ трети, крошка, бар; **B** 50 карт — страницы, листание без пустого кадра; **C** спуск / возврат — слоты держат место (один экземпляр), X-вьюер и возврат; **D** посадка разыгранной карты на полку
   (геометрия прокси = лицу); **E** LB/RB и бот; **F** пустой стол / только корпорация; **G** reduced motion.
6. Перевести в том же диффе: все 33 спека с `con-played` (grep), особенно `console-played-perf-probe`, `console-played-zoom-return`, `console-play-landing-{probe,geometry}`, `console-recv-perf-probe`,
   `console-info-workspace`, `console-info-dossier`, `console-workspace-band`, `console-public-plans`, `console-sponsored-academies` — `npm run e2e:affected` + grep `con-played__pile`, `con-played__peek`,
   `data-played-cat`, «Выбрать / Снять».
7. `npm run build:test`, `npm run lint`; юниты — на тихой машине, последовательно.

## 6. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**, GPU)
Кадры «до / после» в `screenshots/tr65/{fhd,tv4k,deck}/`: (а) стол 20 карт — обзор; (б) стол 50 карт — страницы; (в) раскадровка спуска в категорию и возврата (≥ 8 кадров — карты поднимаются с полки,
слоты держат место); (г) X-вьюер с полки и возврат; (д) посадка разыгранной карты (раскадровка — карта садится на полку, событие — в стопку рубашек); (е) соперник, бот, пустой стол, только корпорация;
(ж) встроенный стол в «Информации»; (з) TR65 — альбом сброса (фильтр, LT, R3, полоса), коммит (лоток сброса → «Получены карты»), строка бесполезности. Пробник долей ДО / ПОСЛЕ — таблицей в реестре.
Каждый кадр — своим глазом: «вижу ли я с дивана, ЧТО у меня на столе, не спускаясь в категорию?»; три лучших предложения по столу — МАКЕТАМИ (CSS поверх живой сцены через `addStyleTag`) в батч владельцу
ПЕРВЫМ (§7.5).

## 7. ПОЛИРОВКА ПО ПУТИ
1. **PL-259** — решение 5 (все `min 0`).
2. **Дрейф дока** — `docs/CONSOLE_MODE_CONCEPT.md:409` («X — View toggle (played table)» → A / X открывают категорию, X в категории — вьюер).
3. **Бэклог** `weak-visuals-backlog`: № 15 `DONE (TR65, PL-…)`; № 17 (предигровые экраны: список рядов на 30 % высоты, выбор режима — две текстовые плитки, карта — четыре плитки 250 px, 17–27 подписей
   24–30 px; кадры `screenshots/tr65/tv4k/w4-*.png`, числа `w5-probe.jsonl`) — следующий кандидат, с кадрами.
4. **Доки** — новый `docs/claude/console/played-table.md` (контракт стола: шасси, планировщик полок, физика подъёма / посадки, страницы, соперник / бот / пустота, перф-бюджет, гарды), правки
   `hud-frame.md` (таблица проёма), `workspace-band.md:47, 101`, `information-workspace.md:236` (встроенный стол — тот же планировщик), `hand-album.md` (планировщик — общий с столом).

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — кадры 4K «до» стола (20 и 50 карт, соперник, бот) своим стендом + пробник (ширина лица, доли).
2. Порядок: карта + спек + `DiscardCards` опция → клиент карты (вторая выплата, n в клейме, PL-259) → макеты стола (3 варианта, `addStyleTag`) → А шасси → Б планировщик полок → В физика (подъём,
   посадка, вьюер) → Г соперник / пустота / встроенный → перф-проба → e2e → обход «до / после» → реестр / доки. Каждый шаг — коммит по ханкам.
3. **Реестр:** footer на выдаче «Следующий свободный номер **PL-610**», последний раздел **BB** (TR61); TR65 берёт раздел **BC** — букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Документы: `docs/TURMOIL_REDUX_STRATEGIC_SHIFT.md` (карта + § «ПУБЛИЧНЫЕ ПЛАНЫ × СБРОС × ВСТРОЕННЫЙ ДОБОР» + § «СТОЛ — ЭТО СТОЛ» — шасси, планировщик, физика, доли до / после, что не ломать,
   кадры) + `docs/claude/console/played-table.md` + правки §7.4 + закон в `.claude/rules/console-ui.md` («THE PLAYED TABLE IS A TABLE — it stands in the central opening, its faces are readable from the
   couch (the hand album's density), its zones are shelves, the corporation is the hero; a category LIFTS off the shelf and a played card LANDS on it — the physics never changes with the layout») +
   строки в чеклист §4 («множественный СБРОС с фильтром кандидатов — `DiscardCards` с `cards` + `disabled`, маркер `exchange {perCard, draw}`, вторая выплата в полосе альбома»; «событие с X = выбор игрока —
   `min 0`, бесполезность при 0 кандидатов названа до нажатия») + запись в журнале.
5. Отчёт владельцу: первой строкой — арт; затем кадры 4K «до / после» стола (20 карт) и спуска, таблица долей, решения 1–10 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (решения 4, 7, 8
   (с макетами; + вопрос «фокус по категориям или по карте»), 9 — рекомендация первой; 1–3, 5, 6, 10 — в отчёте по умолчанию), гэпы честно.
6. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Выбирать карты из СПИСКА имён или своей поверхности (только альбом руки — закон `:189`); показывать разыгрываемую карту в альбоме своего выбора; определять «карта с требованием» по тексту или по
  клиенту (только `card.requirements` сервера — кандидаты и причины приходят в промпте); сбрасывать ДО коммита (PRE-SELECT уходит на ОДНОМ POST); молчать о недоборе из колоды или о нуле кандидатов.
- Счётный чип в `effects` превью (гард `countedPlayForecast`); второй POST на добор; standalone-полоса добора над workspace.
- Ломать физику стола: подъём из слотов, один экземпляр, посадка разыгранной карты по `providePlayedHeroTarget`, стол на сцене под вьюером; `v-if`-моргание при LB/RB и листании; прокрутку как
  замену страницам; регресс перф-пробы (50 / 100 / 200) на tv-4k / Deck; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); состояние только цветом; шрифт ниже пола TV вне `.pcard`.
- Трогать разбор хода бота (реворк — вне полировок); переписывать RU чужих ключей; ломать селекторы 33 спеков без перевода в том же диффе; полный regen фикстур; `git stash`; bare `git push`.
