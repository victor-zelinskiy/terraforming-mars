# Промт исполнителю · TR68 Political Recognition («Политическое признание») — зелёная (автоматическая), 8, метка «?» (wild), ПО нет: «требуется 5 других разыгранных карт С ТРЕБОВАНИЯМИ; продвиньте маркер Карьеры на 3 шага (и получите бонусы каждого шага)» — класс ходьбы (TR04 / TR37) + НОВЫЙ вид требования «разыгранные карты с требованиями» (тропа TR02, 8 точек) · ГЛАВНОЕ — ИТЕРАЦИЯ «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА»: «Мои партии» / «Мои кампании» перестают быть диалогом-подтверждением размером 6–11 % экрана 4K и становятся ЭКРАНОМ из карточек партий на грамматике карты кампании; создатель партии — брифинг миссии во весь проём, а не три полоски на верхней трети; каждая подпись предигровых экранов встаёт на пол TV

Выдан 2026-10-17. Инфраструктура набора стоит (TR01–TR61, TR65–TR67, TR69, TR70 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строка «НОВЫЙ вид требования → тропа `e68e8db190`, 8 точек» (`:85`) и строка «карта ДВИГАЕТ МАРКЕР
Карьеры на N шагов» (`:86`); постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Премиум-планка»**; **«Качество полировки»**), журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,console-ui,client-ui,board,animations,tests,localization}.md` (в `client-ui.md:50–56` — раздел ЛОББИ).
**Главные контракты итерации:** `docs/claude/my-games-lobby.md` ЦЕЛИКОМ (§4 — одна модель `lobbyState.ts`, шесть точек контракта; §4a порядок и возраст; §5 — ЧЕТЫРЕ честных состояния и три состояния
LAN — ни одно не теряется; §6 гарды), `docs/CAMPAIGN_MODE_ARCHITECTURE.md` §1.1 (`:298–310` — вход / меню / создатель; ⚠ строки устарели — см. §7.3), `docs/claude/console/scene-transition.md` (§ SEAMLESSNESS `:92` —
четыре закона границы; меню и карта кампании — экраны, знающие о готовности), `docs/claude/console/system-surface.md` (§3 контракт сдвига раскладки `:63`, §5 грамматика головы `:109`, §6 один оверлей —
один переход `:120`; настройки УЖЕ сошли с `.cm-overlay` на общий системный лист — тот же путь ждёт лобби), `docs/claude/console/vueuse-foundation.md:8–9` (семантический ввод `useConsoleInput`;
скроллбар = баг; только `ConsoleScrollArea`), `docs/CONSOLE_MODE_CONCEPT.md` (`:1219` P10, `:1548` P19, `:1925–1931` — предигровое), `docs/claude/console/tv-reading-typography.md` (пол `--con-t-floor`
= 32 px на 4K; rem TV = 40 px — `console_tv.less:47–49`); законы CLAUDE.md «A WORKSPACE IS ONE FLOW» (п. 1 — ВСТРОЕНО, не новая поверхность; п. 3 — `v-if`-подмена = моргание; переход = та же фраза
на уровень глубже: COMMIT → RELEASE → UNFOLD из прямоугольника → REVEAL), «Project goals» 1–4 (один экран без скролла; Steam-плотность; Ark Nova-движение; активный рефреш), инварианты 5 (`title`
запрещён), 6 (одна система движения), 9 (английский текст = ключ), 12 (глифы), 14 (e2e-хук = контракт — спек правится В ТОМ ЖЕ диффе). Память: `polish-area-premium-visual-first`, `weak-visuals-backlog`
(№ 17 / 22 / 24 — эта итерация), `polish-direction-smoothness`, `console-tv-profile`, `console-reading-typography`, `length-tier-ladder-calibration`, `campaign-overview-iteration` (миниатюры досок,
волна ревила из центра — образец), `console-curtain-seamless`, `scene-transition-director`, `tr04-walk-hosted-parliament` (ОДНА ходьба `walkAgenda`, исход в руке без двери), `turmoil-redux-red-lawyers`
(шаг КАРТЫ посреди ходьбы), `turmoil-redux-political-science` (тропа нового вида требования), `bot-turn-review-out-of-polish-scope`, `concurrent-session-edits-same-files`, `e2e-fixture-generator-gotchas`,
`shell-template-escapes`, `e2e-spec-rot-contract`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-17):** «область для полировок выбери сам — приоритет та, где явно плохо проработан визуал». Выбрано ПРЕДИГРОВОЕ: оно первое, что игрок видит на диване, и единственная
крупная область консоли, не прошедшая ни одной итерации 4K (бэклог № 17 / 22 / 24, реестр PL-597 / PL-643 — «следующий худший открытый»). Итерация (≈ 85 %): **А. «ЛОББИ — ЭКРАН, НЕ ДИАЛОГ»** —
«Мои партии» / «Мои кампании» как витрина карточек партий на грамматике карты кампании, переход из меню той же фразой (≈ 40 %); **Б. «СОЗДАТЕЛЬ — БРИФИНГ МИССИИ»** — колоды создателя во весь проём 4K:
карточки мест, плитки дополнений, карты-доски размера миссии, брифинг-досье, плитки режима с иллюстрацией, оверлеи редактора / подтверждения запуска на полу TV (≈ 35 %); **В. «ПОЛ TV ДЛЯ `.cm-*`»** —
блок § 23 профиля TV вырастает из 7 строк в семейство, гард на каждый предигровой экран, Deck 1280×800 остаётся базовым контрактом (≈ 10 %). Карта (≈ 15 %) — ходьба на 3 шага + новый вид требования.

## ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (HEAD `d193b4c24f`; рядом — сессия `terraforming-mars-38` (исполнитель TR70, сцена «Планета показывает»: `App.vue`, `ConsoleShell.vue`, `ConsoleBoardSection.vue`,
`ConsoleStatusStrip.vue`, `gameTransport.ts`, `planetFocus.ts`, `boardBeatPark.ts`, `console.less`, `console_tv.less`, `console-ui.md`, реестр BE — предигрового не касается); кадры 4K GPU —
`screenshots/tr68/tv4k/*.png` (лобби С СОДЕРЖИМЫМ: две партии, одна кампания; создатель: экипаж, редактор, клавиатура, режим), листы `screenshots/tr68/sheet-0{0,1,2,3}.jpg`; пустые состояния, откат, профиль,
колоды правил / дополнений / карты — `screenshots/tr69/tv4k/w1-*`, `w4-*`; числа — `screenshots/tr68/tv4k/probe.jsonl` (эффективный кегль = `fontSize × currentCSSZoom`); стенд подготовки —
`screenshots/tr68/walk.stand.spec.ts` (вне git: две партии через `/api/creategame` с именем сеянной личности + `createCampaign` (создатель — «Alice», `campaignFixtures.ts:68–80`) → «Мои партии» /
«Мои кампании» / карта кампании / создатель); файл:строка подтвердить на своём HEAD)

**Числа (4K TV, rem = 40 px, пол 32 px):**
- **«Мои партии» с двумя партиями** (`w1-games-00…02`): плита `.cm-overlay__card--wide` = `min(38rem, 94vw)` = **1520 × ≈ 600 px — 11 % экрана** (пустое состояние — 1536 × 345, 6 %: обход TR69); меню
  за ней притушено (`cm-menu--dimmed`). **21 из 25 подписей ниже пола:** вкладки «Активные / Завершённые» 26 px, счётчики 24, «ВАШ ХОД» 26, имена игроков 27, «Вы» 21, возраст / поколение / карта 26;
  выше пола — только имя партии 32 и заголовок 44. Главный список продукта — на шасси диалога «Выйти из игры?» (`ConsoleMainMenu.vue:45–46, 302–304`).
- **«Мои кампании» с одной кампанией** (`w1-campaigns-00`): то же шасси, 12 подписей ниже пола; **имя кампании ОБРЕЗАНО многоточием («Distant Mag…») в плите, пустой на 60 %** — строка головы несёт имя +
  «КАМПАНИЯ · МИССИЯ 1 ИЗ 4» + «МИССИЯ ГОТОВА К ЗАПУСКУ» (`ConsoleCampaignsList.vue:47–52`; `.cm-game__name` — `ellipsis` `console_menu.less:452–460`).
- **Эталон рядом** — карта кампании (`w1-campaigns-01-map`, `-02-map-settled`; `.cmap` `ConsoleCampaignMap.vue:2–54`, `console_campaign.less:10`): кикер + заголовок, четыре карточки миссий с НАСТОЯЩИМИ
  миниатюрами досок ≈ 650 × 700 px, табло игроков, командная планка — читается с дивана. Та же сущность (партия) в лобби — строка 1520 × 150.
- **Создатель, колода «Экипаж»** (`w2-00-crew`): три ряда (два места + «Добавить участника») занимают **верхние 28 % высоты**, 72 % — фон; брифинг справа `.cm-launch` 20rem = 800 px с текстом 25–29 px;
  **20 из 47 подписей ниже пола** (кикер «Создание новой партии» 30, «Игрок» 27, «Создатель» 24, «Заполните имя игрока» 27, «Экипаж 2» 25). Колоды правил / дополнений / карты — `w4-0x` (TR69): два столбца
  переключателей, плитки карт `.cm-map` 11rem = 440 px (миниатюра 8.4rem) в полосе 14.4rem = 576 px — 27 % высоты.
- **Редактор участника** (`w2-01-editor`): плита `min(28rem, 92vw)` = 1120 px; подписи полей 30, подсказки 26 (6 ниже пола). **Клавиатура** (`w2-02…03`): `.cm-vk-panel` `min(47rem, 96vw)` = 1880 px, клавиши
  2.8rem = 112 px — размер верный, строка подсказок ≈ 26 px (пробник не нашёл по селектору — перемерить `.cm-vk-panel`). **Выбор режима** (`w2-05…06`): две текстовые плитки `.cm-mode__tile`
  `min(24rem, 42%)` × 13rem = 960 × 520 px без иллюстрации (`console_campaign.less:765–780`). **Подтверждение запуска** — кадра НЕТ (на стенде ввод имени не применился: подтверждать клавишей
  `.cm-vk__key--done`, как `console-profiles.spec.ts:92`) — снять первым делом.
- **Профиль TV** (`console_tv.less:2006–2016`): **7 строк на всё предигровое** (`.cm-item` / `__label` / `__sub`, `.cm-row__name` / `__value`, `.cm-menu__items`, подсказки); ни одной строки для
  `.cm-overlay__card`, `.cm-game__*`, `.cm-gametab*`, `.cm-camp*`, `.cm-field__*`, `.cm-launch__*`, `.cm-launchc__*`, `.cm-map*`, `.cm-mode*`, `.cm-vk*`, `.cm-type*`, `.cm-tabs*`. Медиа ≥ 1900 px
  (`console_menu.less:1606–1611`) — «gentle boost only» (пункты 32rem, брифинг 20rem, ряд 3.4rem). Handheld-правил нет: база спроектирована под Deck 1280×800 (`console_menu.less:2–4`; «каждая колода
  помещается без скролла» — `:964–975`).

1. **Список продукта — модальное подтверждение.** `.cm-overlay` (`console_menu.less:283–292`: `position: fixed; inset: 0; z 11500; .con-backdrop-dim()`) + центрированная плита `.cm-overlay__card`
   (`:293–306`) — ОДНО шасси для «Мои партии» (`ConsoleMainMenu.vue:45–231`), «Мои кампании» (`ConsoleCampaignsList.vue:4–66`), редактора участника (`ConsoleParticipantEditor.vue:2–3`), выбора типа
   (`ConsoleTypePicker.vue:2–3`), подтверждения запуска (`ConsoleLaunchConfirm.vue:2–3`), «Выйти?», «Steam?», удаления. В игре любой список стоит в проёме с крошкой и живёт как поток; настройки уже ушли
   на системный лист (`system-surface.md` §6). Переход меню → лобби = `cm-menu--dimmed` (вуаль `:45`) + появление плиты: подмена, не фраза.
2. **Карточка партии не показывает партию.** `.cm-game` (`console_menu.less:431–545`): имя .9rem, мета .65rem, экипаж .675rem — строка текста; миниатюра доски есть ТОЛЬКО у кампании (`cm-camp__fp`,
   `PremiumMapFingerprint variant="thumb"` `ConsoleCampaignsList.vue:48`), у партии — иконки дополнений `cm-game__exp img`. `PremiumMapFingerprint.vue` — SVG из `genfiles/boardLayouts.json`
   (`boardMiniatureArt.ts`), масштабируется даром — но в лобби его нет.
3. **Создатель — полоски на фоне.** `.cm-create__main` → `ConsoleScrollArea .cm-create__deck` (`ConsoleCreateGame.vue:56–60`) с `fill: true` — колода держит высоту, но её тело (`.cm-deckbody`
   `:964–975`, `.cm-row` `:975–1010` min-height 3rem) — столбик рядов фиксированной высоты: на 4K три ряда + воздух. Карты — лента `.cm-maps__strip` абсолютом в `.cm-maps__viewport` 14.4rem (`:1183–1230`).
   Брифинг — `.cm-launch` 16.8rem / 20rem (`:1273–1300`, золотые уголки — хорошая грамматика, маленький кегль). Плитки режима — текст без арта.
4. **Фон — один PNG 1672 × 941** (`console_menu.less:30–36`, `assets/premium-main-menu-bg.png`; планета, купол и Млечный путь — внутри картинки) растянут на 3840 — мягкий на 4K (проверить кропом кадра).
5. **Хорошее, НЕ ломать / переиспользовать:** (а) **колонка меню** — `.cm-menu__items` 36rem = 1440 px, подпись 1.35rem = 54 px, подстрока .95rem = 38 px (`console_tv.less:2008–2013`) — выше пола, бренд,
   виньетка; (б) **карта кампании** — голова (кикер / заголовок / прогресс `ConsoleCampaignMap.vue:17–25`), сцена с карточками миссий (`:27–54`), одноразовый ревил волной из центра (`:670–690`,
   `--cmap-reveal-delay`), `deferSceneReveal('campaign-model')` + `armSceneDestination` (`:696–705`), `navigateWithCurtain` (`:900, 1027`); (в) **модель лобби** — `lobbyState.ts` (`localRows` /
   `archive`, `tm_joinable_cache`, LAN-хосты `:447`, `setLobbyIdentity` `:987`), `lobbyChannel.ts:15–29` (WS говорит «список изменился», REST приносит список), `lobbyAge.ts`, `joinableGames.ts:21–58`
   (членство — по ИМЕНИ личности; `you` / `ambiguous`), `campaignsState.ts:93`, `campaignListModel.ts`; (г) **ввод** — `installMenuPad` (`consoleMenuPad.ts:51`, `ConsoleMainMenu.vue:964`), `useConsoleInput`,
   `ConsoleMenuZoomHost` (предигровой просмотр карты, берёт пад первым `consoleMenuPad.ts:56`); (д) **модель создателя** — `consoleCreateModel.ts` (`CREATE_DECKS` `:76`, `deckNavStep` `:130`, `crewRows`
   `:199`, редактор `:301–378`, `launchIssues` `:483`, `consoleCreateUi` `:562`), `submitCreateGame.ts:30–56` (POST → `recordLastGameEntered` → занавес `'expedition'`); (е) грамматика брифинга
   (`.cm-launch__corner`, кикер «Mission control», CTA `cm-cta-breathe` `:1478–1486`); (ж) `ConsoleScrollArea` (`ensureVisible`), `.con-motion-clip` / `.con-motion-layer`.
6. **Вне объёма:** разбор хода бота (реворк — владелец); настройки (`.con-sys` — калиброваны §17); профили / друзья / откат (`ConsoleProfilesEditor`, `ConsoleFriendsEditor`, `ConsoleAdminRollback`) — только
   пол TV (В), без перестройки; карта кампании — эталон, не объект (только общий чассис головы, если выносится); LAN-плоскость (`lanDiscovery`, `lanHostRegistry`) — не трогать.

## КОНЦЕПЦИЯ «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА» (обязательная рамка; детали — исполнителю, спорное — решениями владельца)
**Одна грамматика предигрового экрана — та, что уже стоит у карты кампании: голова (кикер · заголовок · статус справа) → сцена во весь проём → командная планка.** Список партий — ЭКРАН на этой
грамматике, не диалог; диалог остаётся только подтверждению (удалить / выйти / Steam) и редактору поля.
- **А. Лобби.** «Мои партии» / «Мои кампании» — витрина КАРТОЧЕК: карточка партии = миниатюра доски (`PremiumMapFingerprint variant="card"`, как у миссии) + имя партии голосом героя + чип состояния
  («ВАШ ХОД» / «ход: Bruno» / «ждёт игроков» / «завершена») + поколение + экипаж (кубы + имена) + иконки дополнений + возраст («11 с назад» — лестница `lobbyAge`) + чип «Новая»; карточка кампании —
  то же + рельс прогресса из четырёх узлов (текущий горит) + «МИССИЯ ГОТОВА К ЗАПУСКУ» своей строкой — **имя никогда не режется, пока в карточке есть место**. Сетка 3 × 2 на 4K (карточка ≈ 1100 × 560 px),
  курсорная карточка — лёгкий лифт (scale ≤ 1.03 + свечение, язык `.cm-map--cursor`), страницы — `ConsoleScrollArea` с `ensureVisible`. **Четыре честных состояния** (загрузка / пусто / ошибка / LAN)
  и три состояния LAN-хоста (`my-games-lobby.md` §5) — на той же сцене, тем же голосом, не строкой в пустой плите; «＋ Добавить хост по адресу» — последняя карточка кольца. Вкладки «Активные / Завершённые»
  — сегмент в голове (L3 — как сейчас), RT «Обновить», X удалить (подтверждение — оверлей), A войти (`navigateWithCurtain`). **Переход из меню — та же фраза:** колонка меню ОТСТУПАЕТ (опасити +
  сдвиг влево, бренд остаётся), сцена РАСКРЫВАЕТСЯ из прямоугольника нажатого пункта (UNFOLD) и карточки ПРОЯВЛЯЮТСЯ волной (язык ревила карты кампании); B — та же фраза назад, курсор — на тот же
  пункт (сейчас `closeOverlay` `ConsoleMainMenu.vue:1236–1240`). Ничего не меняется одним кадром.
- **Б. Создатель — брифинг миссии.** Голова — кикер «СОЗДАНИЕ ПАРТИИ» / заголовок колоды / личность справа; вкладки колод — тот же сегмент, что у лобби. Колода «Экипаж» — КАРТОЧКИ МЕСТ в ряд (куб
  цвета, имя голосом героя, роль «Игрок / MarsBot», «Создатель», строка проблемы амбером, «Добавить участника» — пунктирная карточка), 2–5 мест заполняют ширину проёма; «Правила» — ряды полной
  высоты в два столбца с описанием ≥ пола; «Дополнения» — сетка плиток (эмблема дополнения 3.5rem = 140 px + имя + описание + «вкл.»); «Карта» — карточки-доски размера миссии (≈ 650 px, миниатюра
  `variant="card"`, акцент карты), лента центрируется как сейчас; брифинг справа — ДОСЬЕ миссии (TV: 22–24rem, миниатюра 10rem, каждая строка ≥ пола, блоки «Экипаж / Карта / Дополнения / Правила /
  Проблемы» — грамматика досье «Информации»); плитки режима — с ИЛЛЮСТРАЦИЕЙ (случайная миниатюра доски для «Отдельной партии», маршрут из четырёх узлов для «Кампании») и размером TV; редактор
  участника / выбор типа / подтверждение запуска — оверлейное шасси, калиброванное под TV (34–40rem, поля ≥ пола, цветовые свотчи ≥ `--con-hit-min`); подтверждение запуска — плита «MISSION CONTROL»
  с карточкой-доской, чипами экипажа, эмблемами дополнений и дышащим CTA; клавиатура — строка подсказок на пол. **Deck 1280×800: каждая колода по-прежнему помещается без скролла** — база не растёт,
  растёт профиль TV (`html.con-profile-tv`) и медиа ≥ 1900.
- **В. Пол.** Блок § 23 `console_tv.less` — семейство `.cm-*` целиком (каждая подпись ≥ `--con-t-floor`, вторичные — `--con-t-secondary`, заголовки — лестница TV); гард — e2e-обход предигровых экранов в
  профиле TV с пробником «ниже пола = 0» (образец — `consoleTvTypeFloor`-пробник в `console-generation-scene.spec.ts` / `console-info-dossier.spec.ts`).

## Обязательное чтение до кода
`docs/claude/my-games-lobby.md`, `docs/CAMPAIGN_MODE_ARCHITECTURE.md:296–382, 814–860`, `docs/claude/console/{scene-transition,system-surface,vueuse-foundation,tv-reading-typography,hud-frame}.md`,
`docs/CONSOLE_MODE_CONCEPT.md` (предигровые абзацы), `docs/CONSOLE_SURFACE_MOTION.md`; `src/client/components/console/menu/{ConsoleMainMenu,ConsoleCampaignsList,ConsoleCreateGame,ConsoleCrewDeck,
ConsoleRulesDeck,ConsoleExpansionsDeck,ConsoleMapDeck,ConsoleLaunchPanel,ConsoleLaunchConfirm,ConsoleParticipantEditor,ConsoleTypePicker,ConsoleVirtualKeyboard,ConsoleMenuZoomHost}.vue`,
`console/campaign/{ConsoleCampaignMap,CampaignMissionCard}.vue`, `components/premiumCard/PremiumMapFingerprint.vue` + `boardMiniatureArt.ts`, `src/client/console/menu/{consoleCreateModel,consoleMenuPad,
consoleMenuZoomBridge}.ts`, `console/campaign/{campaignListModel,campaignsState,campaignMapModel}.ts`, `components/mainMenu/{lobbyState,lobbyChannel,lobbyAge,lastGameState}.ts`,
`createGameMeta.ts:26–80` (`PREMIUM_EXPANSIONS` — только подпись и иконка; `PREMIUM_MAPS` — акцент), `submitCreateGame.ts`, `console/sceneTransition*.ts`; стили `console_menu.less` ЦЕЛИКОМ (2287 строк),
`console_campaign.less:10–120, 765–800`, `console_tv.less:40–60, 2006–2016`; спеки `tests/client/console/menu/consoleCreateModel.spec.ts` (29), `tests/client/components/mainMenu/{lobbyState,lobbyAge,
lobbyLan}.spec.ts`, `tests/campaign/campaignListModel.spec.ts`, `tests/models/joinableGames.spec.ts`; e2e `console-campaigns-list` (хуки `.cm-camp`, `.cm-game--cursor`, `.cm-gametab--on`,
`.cm-overlay--nested`, `.cm-overlay__card` `:241`, `.cm-item__badge`), `console-campaign`, `console-profiles` (`.cm-overlay__title`, `.cm-vk__key--done`), `console-options-settings:42` (`.cm-item`),
`console-scene-transition` (`.cm-menu`), `console-colony-vesta:375–382` / `console-colony-pluto-redux` (`.cm-game__exp img`), `tv-profile-screens`, `start-scene-profiles`, харнесс `consoleStart.ts`
(`reloadMenu` `:1049`, `soloGameConfig` `:1518`), `campaignFixtures.ts`. Карта: `turmoilRedux/MinorityRepresentation.ts` (`:1–80` чтение, `:102–110` ходьба, `:119–127` прогноз), `turmoilRedux/
PoliticalScience.ts` (тропа нового вида), `parliament/quests/ChairmanSeat.ts` (`walkAgenda`), `cards/actionPreviews.ts:701–770`, `ICard.ts:131`, `ModelUtils.ts:161–162`, `common/cards/RequirementType.ts`,
`common/cards/CardRequirementDescriptor.ts:29–94`, `requirements/{CardRequirements,InfluenceRequirement,DelegatesOnResolutionsRequirement}.ts`, `Card.ts:529–556`, `tools/cardInfo/buildCardInformation.ts:173,
975`, `models/unplayableReasons.ts:109–160, 255–300`, `milestones/Tactician.ts:15–20`, `awards/Forecaster.ts:11`, `player/Tags.ts:99–130`; клиент `premiumCard/premiumCardViewModel.ts:264–305`,
`handCards/unplayableReasonFormat.ts:145–180`, `console/parliament/{agendaWalk,agendaWalkDirector,hostedParliamentStep}.ts`; спеки `tests/cards/turmoilRedux/MinorityRepresentation.spec.ts`,
`tests/cards/requirementProse.spec.ts:112–130`, `tests/parliament/AgendaWalk.spec.ts`; e2e `console-minority-representation.spec.ts:253` + фикстура `generate.ts:1510`; доки
`docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md` (§2 одна ходьба, §4 исход в руке, §5 вид INFLUENCE — тропа), `docs/TURMOIL_REDUX_POLITICAL_SCIENCE.md`; последняя запись журнала (TR70 `:2870` — формат).

## Что это за карта
**Скан:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR68.png`. Правила набора — `…\TM Turmoil Redux\Turmoil Redux Rules.pdf` (текст — `C:/tmp/redux-rules.txt`; wild-метка — `:127–129`,
FAQ `:616–618`). Арт: `C:\Users\zelin\Downloads\Mars Arts\TR68.png` **ЕСТЬ** — импортировать конвейером набора (`assets/card-images/TR68.webp` + `thumb/`, как TR70 в `HEAD~2`; кредит на скане — Igor Suka).
**Зелёная (AUTOMATED), 8 M€, метка «?» (wild), без ПО.**

### Чтение скана
Зелёная рамка; цена **8**; золотая MIN-плашка «5 [карта с плашкой требования]» — требование «разыграно 5 карт с требованиями»; в углу — круглая метка **«?»** (wild-метка набора: «counts as any tag of
your choice when playing cards and actions», никогда для наград — R `:127–129`, `:616–618`). Заголовок «POLITICAL RECOGNITION». Арт — оратор за трибуной. Низ: три квадрата со звездой в ряд
(`b.agendaStep(3)` — `CardRenderer.ts:257`, как у TR04 `agendaStep(2)`); текст: «(Requires that you have played 5 other cards with requirements. Advance your Agenda marker 3 steps. (And collect bonuses
from each step.))». Лор: «Welcome to a hell of your own making!». Фиолетовый ромб — символ модуля, без `compatibility`. Номер TR68.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/PoliticalRecognition.spec.ts`)
1. **«Played 5 other cards with requirements»** — счёт РАЗЫГРАННЫХ карт игрока с непустым `requirements` (`card.requirements.length > 0` — как `Tactician.ts:17`, `Forecaster.ts:11`); «other» — сама
   TR68 исключена по имени (до розыгрыша её на столе нет, после — счёт в «Информации» честен); прелюдии и корпорации требований не имеют — счёт их не видит. **События** — считаются (решение 5а:
   карта говорит «played», не «in play» — чтение награды Forecaster; веха Tactician исключает события, потому что говорит «in play»). Ровно 5 — выполнено.
2. **Новый вид требования** — `RequirementType.CARDS_WITH_REQUIREMENTS = 'Cards with requirements'` (после `GENERATION`), дескриптор `cardsWithRequirements?: number` (после `generation` `:69`),
   `CardRequirements.compileOne` (`:123–130`) → `CardsWithRequirementsRequirement extends InequalityRequirement` (`getScore` — правило 1, co-located хелпер), `Card.populateCount` (`:529–556`), строка
   правил `buildCardInformation.requirementBlock` (`:173`) «Requires that you have played N cards with requirements.», причина `type: 'count'` `'Requires ${0} cards with requirements played'` (+ «сейчас
   M» — `unplayableReasons.ts:255–300`) + `FULLY_RESTATED_REQUIREMENTS` (`:118–130`), клиент `REQUIREMENT_RENDER` (`premiumCardViewModel.ts:264–305` — бейдж решения 6) + `COUNT_MESSAGE_LABELS`
   (`unplayableReasonFormat.ts:145` → «Карты с требованиями»), прозаический гард `requirementProse.spec.ts:112–130` (`EN_SUBJECT` → `/cards? with requirements/i`). Чип руки «[глиф] 4/5» и строка
   «Требования» в «Информации» — даром от класса.
3. **Ходьба на 3 шага** — ОДНА функция `ChairmanSeat.walkAgenda(player, parliament, 3, {reason: 'card', card: this.name})` СИНХРОННО в `bespokePlay` (`MinorityRepresentation.ts:102–110` слово в слово,
   `STEPS = 3`); бонус каждого шага на его посадке, в порядке шагов (влияние — с позиции; РТ — до следующего шага; КАРТА — шаг карты посреди ходьбы, TR37); маркер вне трека СЕЛ первым шагом (0 → 1, 2, 3).
4. **Конец трека режет честно:** с 10 — 2 шага, с 11 — 1, с 12 — 0 (одна запись «already at the end»); прогноз называет срез ДО нажатия (`walked < printed`); карта играется в любом случае
   (цена уплачена, карта на столе). С 12 розыгрыш БЕЗ эффекта — признак бесполезности превью (`actionFutility` / `preview.futile` класса «действия без эффекта») с причиной «маркер в конце трека».
5. **Прогноз** — `agendaWalkForecast` + `cardPlayPreview` (`:119–127`): чип трека «1 → 4», чип за каждый бонус, SHOW-шаг `agendaWalk`; модель руки `ModelUtils.ts:161–162` — даром.
6. **Wild-метка** — `tags: [Tag.WILD]` (решение 4а): движок уже считает её любой меткой при розыгрыше карт и действиях и НЕ считает для наград (`Tags.ts:99–130` — режимы `default` / `award`);
   лицо печатает `assets/tags/wild.png`; спек: с TR68 на столе требование «2 метки науки» выполняется при одной науке; награда «больше всего меток X» её не видит.
7. **Сама TR68 — карта с требованием:** после розыгрыша считается для Tactician / Forecaster / чужих TR68 (одна копия в колоде — только для чужих счётчиков).
8. **MarsBot** карту не играет; save / load — ничего нового (ходьба мгновенна); превью чисты (гард).
9. **Журнал** — строки ходьбы (`agenda-advanced` с `reason: 'card'`) — как у TR04; новой строки нет.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8)
1. **Имя RU** — «Политическое признание» (коллизий нет: `grep` по `src/locales/ru/*.json` пуст). Альтернатива «Политическое признание» ↔ «Признание в политике» — нет: первое читается с карты.
2. **Лор** — EN слово в слово (ключ `TR68`); RU: «Добро пожаловать в ад, который вы сами себе устроили!».
3. **Арт** — файл есть: импорт (Igor Suka); первая строка отчёта — «арт импортирован».
4. **Метка «?»** — (а, рекомендовано) `Tag.WILD` — словарь самого набора (эффект Учёных даёт «extra wild tag»; `Tags.ts` уже различает розыгрыш и награды); (б) без меток (круг «?» — декоративный). Первая
   wild-метка на ПРОЕКТНОЙ карте скоупа: проверить гарды метки (`premiumTagHolder`, счётчик меток руки, фильтры «метки одного вида» TR-класса `TAGS_OF_ONE_TYPE` — wild там НЕ максимум).
5. **События в счёте** — (а, рекомендовано) считаются (Forecaster: «played»); (б) исключены (Tactician: «in play»).
6. **Глиф требования** — (а, рекомендовано) НОВЫЙ глиф лица «карта с требованием» (мини-карта с золотой MIN-плашкой — один SVG в `premiumCardIcons`, как плашка партии TR13), переиспользуемый чипом руки,
   причиной и «Информацией»; (б) `corpCard.png` / число без иконки (`plain: true`, как `GENERATION`) — беднее скана.

**ИТЕРАЦИЯ «ВИТРИНА» (решения 7–12):**
7. **Шасси лобби** — (а, рекомендовано) ЭКРАН на грамматике карты кампании: голова + сетка карточек партий в проёме + планка; `.cm-overlay` остаётся подтверждениям; (б) диалог остаётся, растёт
   только кегль и плита (`--wide` → 60rem) — запасной вариант, если (а) не укладывается в итерацию: тогда карточки внутри плиты.
8. **Переход меню → лобби** — (а, рекомендовано) колонка отступает + UNFOLD из прямоугольника пункта + волна карточек; B — та же фраза назад; (б) кроссфейд экранов.
9. **Колоды создателя на 4K** — (а, рекомендовано) карточки мест / плитки дополнений / карты-доски ≈ 650 px / досье-брифинг; (б) те же ряды, только кегль и высота ряда.
10. **Плитки режима** — (а, рекомендовано) с иллюстрацией (миниатюра / маршрут) и размером TV; (б) только кегль.
11. **Фон 4K** — (а) владелец даёт 4K-ассет `premium-main-menu-bg` (или 2× версию) — исполнитель кладёт `@media (min-width: 2560px)` / `image-set`; (б) оставить (мягкость показать кропом в батче).
12. **Карточка партии — содержимое** — (а, рекомендовано) миниатюра + имя + состояние + поколение + экипаж + дополнения + возраст (всё, что строка несёт сегодня, + миниатюра); (б) без миниатюры у
    обычной партии (только у кампании, как сейчас).

## 0. Рабочее дерево
1. `git log --oneline -1` → `d193b4c24f` на выдаче (исполнитель TR70 `terraforming-mars-38` ещё коммитит сцену — к моменту выдачи HEAD уйдёт вперёд). **Сначала** `ListAgents` + процессы playwright
   (память `pasted-prompt-author-may-still-run`); `SendMessage` каждому живому соседу о порядке: твои файлы — `console_menu.less`, `console_campaign.less` (`.cm-mode`), `console_tv.less` **§ 23**
   (дописывать ПОСЛЕ коммита соседа, никогда его ханки), `components/console/menu/**`, `components/console/campaign/CampaignMissionCard.vue` (только если выносится общий чассис), `console/menu/**`,
   `console/campaign/campaignListModel.ts`, `components/mainMenu/lobbyState.ts` (только новые поля модели карточки), `App.vue` (только если нужен общий хост — лучше без), карта — `turmoilRedux/
   PoliticalRecognition.ts`, тропа требования; общие — `console-ui.md`, `client-ui.md`, `ru/console.json` / `ru/ui.json`, `consoleStart.ts`, `fixtures/generate.ts` — свои строки добавлять ПОСЛЕ их
   коммитов. Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`,
   `git add -A`. Не пушить. ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки клиента — неиспользуемый импорт / `el.remove()` на Node роняет `npm run build:client` всем сессиям.
2. Снапшот e2e — свой: `npm run e2e:snapshot tr68` + `TM_E2E_ROOT=.e2e-tr68`; ⚠ перед снапшотом — `npm run build:server` и убедиться, что сосед не собирает `build/` (память
   `e2e-snapshot-mid-compress-empty-css`); кадры «до» — клиент HEAD в своём снапшоте (`ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`, `screenshots/tr68/pw.config.ts`). ⚠ Скриншот 4K
   ≈ 1 с — хронометраж перехода только пробником (сэмплер DOM 100 мс). Снапшот подготовки `.e2e-tr68prep` удалён.
3. **Стенд** — `screenshots/tr68/walk.stand.spec.ts` (вне git) переиспользовать: починить ввод имени (`.cm-vk__key--done`), добавить подтверждение запуска, колоды правил / дополнений / карты, выбор
   режима, пустые состояния и LAN-состояние (хост «не отвечает» — `lobbyLan.spec` знает, как его сыграть), профили `fhd` (`consoleProfile=auto`, 1920×1080) и **Deck 1280×800** (`handheld`) — три профиля
   на каждом кадре.
4. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки: `political-recognition` (`parliamentFixture`, образец `generate.ts:1510`: TR68 в руке, на столе 5 карт с требованиями (одна — событие),
   `agenda: [1, …]`, M€ ≥ 8), `political-recognition-short` (4 карты — чип «4/5», причина), `political-recognition-end` (`agenda: [11, …]` — срез до 1 шага; и 12 — бесполезно). Для лобби фикстура не
   нужна: стенд создаёт партии API (имя сеянной личности — `seedIdentity`, `joinableGames` сверяет по имени) и кампанию `createCampaign`.
5. **Пробник предигрового** — один `evaluate` на экран: бокс сцены / доля проёма, число подписей ниже пола (`fontSize × currentCSSZoom`, SVG исключён), обрезанные имена (`scrollWidth > clientWidth` у
   `.cm-game__name`-наследников), число карточек в кадре; сэмплер перехода — opacity / transform колонки меню и сцены, мутации по задачам (ни одной покраски одним кадром).

## 1. Сервер — карта (≈ 10 %)
1. `src/server/cards/turmoilRedux/PoliticalRecognition.ts` — `Card` (AUTOMATED), заголовок = чтение скана + правила 1–9; `STEPS = 3`, `REQUIRED_CARDS = 5`; `tags: [Tag.WILD]`; `cost: 8`;
   `requirements: [{cardsWithRequirements: 5}]`; `bespokePlay` + `agendaWalkForecast` + `cardPlayPreview` — TR04 (`:102–127`); `renderData` — `b.agendaStep(3)` + `description` слово в слово. `CardName.ts`
   (`POLITICAL_RECOGNITION = 'Political Recognition'` после `BACKROOM_DEAL` `:1139`), `TurmoilReduxCardManifest.ts` (после `:323`), `npm run make:cards`, `turmoil_redux_cards.json` (имя + описание RU по
   форме TR04 `:21`: «Требуется, чтобы вы разыграли 5 других карт с требованиями. Продвиньте маркер Карьеры на 3 шага (и получите бонусы каждого шага).»), `card_info.json` RU, `lore_texts.json` ×2, арт.
2. **Вид `CARDS_WITH_REQUIREMENTS`** — 8 точек правила 2 (тропа `e68e8db190`, образец §5 `TURMOIL_REDUX_MINORITY_REPRESENTATION.md:242–250`); хелпер счёта — в файле требования, НЕ менять семантику
   `Tactician` / `Forecaster`.
3. Бесполезность с конца трека (правило 4) — проверить, что класс «действия без эффекта» видит `walked === 0` у розыгрыша; если нет — co-located признак.

## 2. Клиент — карта (≈ 5 %)
- Чип руки / строка композера / «Информация › Требования» / причина «сейчас 4 из 5» — от тропы (правило 2) + глиф (решение 6); ходьба — хостимый исход руки (`agendaWalk.ts`, `agendaWalkDirector.ts`,
  `hostedParliamentStep.ts`) — нового кода не ждать; 3 шага с шагом КАРТЫ посреди (TR37) — проверить e2e; wild-метка на лице и в счётчике меток руки.

## 3. Клиент — ГЛАВНОЕ: «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА» (≈ 85 %)
### 3.А «ЛОББИ — ЭКРАН, НЕ ДИАЛОГ» (решения 7, 8, 12)
- Общий предигровой чассис экрана (кикер · заголовок · статус / сегмент вкладок · сцена · планка) — вынести из `.cmap__head` в один блок (`.cm-screen` или `.cmap`-семейство — одно имя, одна грамматика
  головы, `system-surface.md` §5), на нём — «Мои партии» (`ConsoleMainMenu.vue:45–231` → свой компонент `ConsoleGamesList.vue`, модель та же `lobbyState`) и «Мои кампании» (`ConsoleCampaignsList.vue`).
- Карточка партии — `GameCard.vue` (или `CampaignMissionCard`-семейство): миниатюра `PremiumMapFingerprint variant="card"` (поле партии — `summary.board` / `currentBoard`), имя, чип состояния,
  поколение, экипаж, дополнения, возраст, «Новая», LAN-хост; кампания — + рельс прогресса; сетка `ConsoleScrollArea` + `ensureVisible`; состояния лобби — на сцене (`my-games-lobby.md` §5).
- Переход: колонка `.cm-menu__items` отступает (opacity + translateX, `.con-motion-layer`), сцена раскрывается из `getBoundingClientRect` пункта (UNFOLD — `scene-transition.md` § SEAMLESSNESS /
  `CONSOLE_SURFACE_MOTION.md`), карточки — волна (`--cmap-reveal-delay`); B — обратно, курсор на тот же пункт; `motionMs()` / `MOTION_EASE`, reduced motion — снапы.
- Подтверждения (удалить / выйти / Steam) и редактор — остаются на `.cm-overlay`, калиброванном под TV (В).

### 3.Б «СОЗДАТЕЛЬ — БРИФИНГ МИССИИ» (решения 9, 10)
- Голова создателя — тот же чассис; `ConsoleCrewDeck` → карточки мест; `ConsoleRulesDeck` → ряды полной высоты (два столбца на TV); `ConsoleExpansionsDeck` → плитки с эмблемой 3.5rem;
  `ConsoleMapDeck` → карты-доски размера миссии (`.cm-map` 11rem → TV 16rem, миниатюра `card`); `ConsoleLaunchPanel` → досье (TV 22–24rem, строки ≥ пола, миниатюра 10rem); `.cm-mode__tile` — иллюстрация +
  TV-размер; `ConsoleParticipantEditor` / `ConsoleTypePicker` / `ConsoleLaunchConfirm` / `ConsoleVirtualKeyboard` — оверлеи на полу TV, `ConsoleLaunchConfirm` — плита «MISSION CONTROL» с картой-доской.
- Deck 1280×800 — база не растёт (контракт `console_menu.less:964–975`): всё новое — в `html.con-profile-tv` и `@media (min-width: 1900px)`; FHD — между.

### 3.В «ПОЛ TV ДЛЯ `.cm-*`» 
- § 23 `console_tv.less` — семейство целиком (лобби, карточки, вкладки, поля, брифинг, подтверждение, карты, режим, клавиатура, тип, профили / друзья / откат — только пол); гард — e2e-обход (§5.4 F).

## 4. Лицо, локаль, лор, арт
`renderData` по чтению скана; `description` слово в слово; RU-кураторство (форма TR04); строки витрины — существующие ключи лобби / создателя переиспользовать (`My games`, `Your turn`, `Name not set`,
`Launch briefing`, `Mission control`, …); новые — английские (grep ДО по всем `src/locales/<lang>/*.json`), RU чужих не переписывать; лор / арт — решения 2–3.

## 5. Тесты
1. `tests/cards/turmoilRedux/PoliticalRecognition.spec.ts` — правила 1–9 (счёт с событием и без; «other» — сама исключена; 4 → не играется с причиной «сейчас 4 из 5»; 5 → играется; ходьба 3 шага с
   бонусами по порядку, шаг карты посреди; 0 → сел первым шагом; 10 / 11 / 12 — срез и бесполезность; прогноз чист; wild-метка — требование науки и награда; save / load).
2. Гарды зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `effectExtraction`, `premiumCardViewModel`, `premiumCardIcons`, `effectForecastCoverage`, `countedPlayForecast`,
   `actionFutility`, `requirementProse` (новый субъект), `readingParamsGuard`, `glyphLiteralGuard`, `e2eLiveness`, `TurmoilReduxCardManifest`; близнецы вида в `unplayableReasons*.spec`,
   `unplayableReasonFormat.spec` (`COUNT_MESSAGE_LABELS`), `premiumCardViewModel.spec` (`REQUIREMENT_RENDER`), `buildCardInformation`-гард (строка правил).
3. Клиент (витрина): `consoleCreateModel.spec` (29) и `campaignListModel.spec` / `lobbyState.spec` — семантика не меняется (модель карточки — чистая функция от `JoinableGameRow` → спек); спек
   переходa меню → лобби (фазы, холд, reduced motion, курсор возвращается).
4. e2e `tests/e2e/console-political-recognition.spec.ts` (fhd + tv4k): плита руки с чипом «4/5» → причина; «5» → розыгрыш → ходьба 3 шага в руке, бонус на посадке, шаг карты посреди → поле; срез с 11
   назван ДО нажатия; wild-метка на лице.
   e2e `tests/e2e/console-pregame-showcase.spec.ts` (fhd + tv4k + deck): **A** «Мои партии» с двумя партиями — экран без `.cm-overlay`, карточки с миниатюрой, ниже пола = 0, доля проёма ≥ 55 %, A входит
   (занавес), L3 / RT / X с подтверждением; **B** четыре состояния + LAN-хост «не отвечает» — на сцене, тем же голосом; **C** «Мои кампании» — имя целиком (`scrollWidth === clientWidth`), рельс прогресса,
   A → карта кампании; **D** переход меню → лобби → назад: сэмплер (колонка отступила, сцена раскрылась из прямоугольника пункта, карточки волной, мутации по задачам), курсор на том же пункте; **E** создатель:
   колоды заполняют проём (сцена ≥ 55 % высоты на 4K), карточки мест, карты-доски ≥ 600 px, брифинг ≥ пола, плитки режима с иллюстрацией; **F** оверлеи (редактор / тип / подтверждение запуска /
   клавиатура) ≥ пола и ≥ `--con-hit-min`; **G** **Deck 1280×800** — каждая колода и лобби без скролла (`consoleOverflowGuard` молчит); **H** reduced motion.
5. Перевести в том же диффе: `console-campaigns-list` (все `.cm-*`-хуки), `console-profiles`, `console-options-settings:42`, `console-scene-transition`, `console-colony-vesta:375–382`,
   `console-colony-pluto-redux`, `tv-profile-screens`, харнесс `consoleStart.reloadMenu` (`.cm-menu, .cmap`) — `npm run e2e:affected` + `e2eLiveness`.
6. `npm run build:test`, `npm run lint`; юниты — на тихой машине, последовательно.

## 6. Визуальная приёмка = РАСКАДРОВКА (чеклист §7; **4K первым**, GPU; FHD и Deck — обязательны: три профиля на каждом кадре)
Кадры «до / после» в `screenshots/tr68/{tv4k,fhd,deck}/`: (а) «Мои партии» с двумя партиями / пусто / LAN-хост; (б) «Мои кампании» с одной; (в) раскадровка меню → лобби → назад (≥ 8 кадров +
сэмплер); (г) создатель: экипаж / правила / дополнения / карта / режим; (д) редактор / тип / клавиатура / подтверждение запуска; (е) карта TR68 — плита руки «4/5», композер, ходьба. Таблица «доля проёма ·
ниже пола · обрезанные имена» ДО / ПОСЛЕ по экранам — в реестр. Каждый кадр — своим глазом с дивана: «я вижу СВОИ партии как партии, а не как строки списка?»; три макета карточки партии и
головы лобби (CSS поверх живого экрана через `addStyleTag`) — в батч владельцу ПЕРВЫМ (§8.5).

## 7. ПОЛИРОВКА ПО ПУТИ
1. **PL-597 / PL-643** — закрыть числами; новые находки обхода (клавиатура, подтверждение, LAN-состояния, Deck) — строками раздела.
2. **Бэклог** `weak-visuals-backlog`: № 17 / 22 / 24 → `DONE (TR68, PL-…)`; что осталось (фон 4K, профили / друзья / откат — только пол) — пунктами.
3. **Доки:** `CAMPAIGN_MODE_ARCHITECTURE.md:298–310` — устаревшие строки (`MenuItemId` `:419`, `items` `:676`, `CREATE_DECKS` `:76`, `deckNavStep` `:130`; `boardFingerprints.ts` удалён →
   `PremiumMapFingerprint` + `boardMiniatureArt.ts`); `DESKTOP_DEPRECATION_AUDIT.md:148–149` — `joinGamesState` не существует; `my-games-lobby.md` §5 — новая поверхность.
4. **Фон 4K** — кроп кадра в батч (решение 11).

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — кадры «до» своим стендом в трёх профилях (+ подтверждение запуска, колоды, пустые / LAN-состояния) + пробник.
2. Порядок: карта + спек + вид требования + глиф → клиент карты + e2e карты → макеты карточки / головы лобби (3 варианта на живом экране) → А чассис + карточки + состояния + переход → Б колоды
   создателя + оверлеи → В пол + гард → перевод e2e-хуков → раскадровки «до / после» в трёх профилях → реестр / доки. Каждый шаг — коммит по ханкам.
3. **Реестр:** footer на выдаче «Следующий свободный номер **PL-661**», последний раздел **BE** (TR70; сосед 38 ещё дописывает в BE — footer сдвигается); TR68 берёт раздел **BF** — букву и номера
   объявлять В МОМЕНТ записи по текущему footer.
4. Документы: `docs/TURMOIL_REDUX_POLITICAL_RECOGNITION.md` (карта + § «ВИД `CARDS_WITH_REQUIREMENTS`» + § «ВИТРИНА» — концепция, чассис, карточка, переход, числа до / после, три профиля, что не
   ломать, кадры) + новый `docs/claude/console/pregame-showcase.md` (контракт предигрового экрана: грамматика головы, карточка партии, четыре состояния, переход, семейство пола, Deck-контракт, гарды) +
   правки §7.3 + закон в `.claude/rules/console-ui.md` («THE PREGAME IS A SHOWCASE — a product list («Мои партии», «Мои кампании», the creator's decks) is a SCREEN on the campaign map's grammar (head ·
   stage · bar), never a confirm dialog; a game is shown as a CARD with its board miniature; every pregame text obeys the TV floor; the Deck 1280×800 fit is the base contract, the TV profile is where the
   screen grows») + строка в чеклист §4 (вид «разыгранные карты с требованиями» — 8 точек, счёт как у Forecaster) + запись в журнале.
5. Отчёт владельцу: первой строкой — арт; затем раскадровка 4K «до / после» лобби и создателя, таблица «доля проёма · ниже пола» по экранам в трёх профилях, решения 1–12 с тем, что сделано по умолчанию,
   ОДИН батч `AskUserQuestion` (решения 4, 5, 7 (с макетами), 9, 11 — рекомендация первой; 1–3, 6, 8, 10, 12 — в отчёте по умолчанию), гэпы честно.
6. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Оставлять список партий на `.cm-overlay`-шасси подтверждения (решение 7а); резать имя партии / кампании, пока в карточке есть место; терять хоть одно из четырёх состояний лобби или трёх состояний
  LAN-хоста; переписывать `lobbyState` / `joinableGames` / LAN-плоскость (членство — по имени личности, как есть); добавлять `keydown`-слушатель или новую физическую привязку (только `useConsoleInput` /
  `consoleMenuPad`); `overflow-y: auto` руками (только `ConsoleScrollArea`); ломать fit Deck 1280×800 (база не растёт — растёт профиль TV); `v-if`-подмену экранов (переход — фраза: отступ → UNFOLD →
  волна); менять что-либо одним кадром; `transition: all`, анимацию width / height / top / left; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); текст ниже пола TV; состояние только цветом.
- Второй экземпляр карты кампании / карточки миссии (один компонент-семейство); растровые миниатюры досок (SVG `PremiumMapFingerprint`); новый фон поверх `premium-main-menu-bg` без решения 11.
- Переносить счёт «карт с требованиями» в `Tactician` / `Forecaster` (их семантика — их); добавлять вид требования мимо 8 точек; `defer` в ходьбе (синхронно — ответ несёт запись); считать wild-метку
  для наград; писать «Повестка» (глоссарий — «Карьера», гард `BANNED`).
- Трогать разбор хода бота (реворк — вне полировок); файлы соседей и их незакоммиченные правки; переписывать RU чужих ключей; ломать селекторы e2e без перевода в том же диффе; полный regen фикстур;
  `git stash`; bare `git push`.
