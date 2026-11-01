# Промт исполнителю · P87 Venus Allies («Венерианские союзники») — ДВАДЦАТЬ ПЕРВАЯ карта Prelude 2, не политическая, Venus + Colonies (`docs/PRELUDE2_ADAPTATION.md` §3.1, форма 1 — ДЕКЛАРАТИВНАЯ): зелёная (AUTOMATED), 30 M€, метки Венера + Космос, 2 ПО; «Повысьте шкалу Венеры на 2 шага. Получите 4 M€ за каждую свою колонию» — `behavior: {global: {venus: 2}, stock: {megacredits: {colonies: {colonies: {}}, each: 4}}}`. Карта ≈ 10 % — всё ДАРОМ: счётный термин колоний уже проведён P68 (`stock` по колониям) и P79 (базис «Ваши колонии: N», честный ноль), два шага Венеры — история шкалы с рейтингом за шаг и бонусом 16 % (PL-330), оплата титаном за Космос, ПО-жетон с печатного «2». **ПОЛИРОВКА ≈ 90 % — ЗАДАНА ВЛАДЕЛЬЦЕМ: РЕВОРК ПОВЕРХНОСТИ ПЕРЕНОСА КАРТ В СЛЕДУЮЩУЮ МИССИЮ КАМПАНИИ («НАСЛЕДИЕ ПРОЕКТОВ», `ConsoleCarryoverPicker.vue`).** Слова владельца (2026-11-01): «сейчас он сделан как будто на отдельном движке и имеет слабую подачу, выглядит плохо на большом количестве карт, и карты ставить назад неудобно (надо нажимать на пустую ячейку — это неинтуитивно). Его визуал сильно отличается от «карт в руке», хотя задачу решает ту же — надо перевести на понятный для пользователя премиум-язык; я понимаю, что это сложно, т. к. он встроен в поверхность конца игры, где другой UI, — но надо вложиться сильно и добиться хорошего результата. Также количество карт проектов, которые игрок может забрать с собой, должно быть ПЕРЕМЕННОЙ НА УРОВНЕ ИГРОКА (по умолчанию не больше 2, но в будущем будут модификаторы)».

> **Статус: ВЫДАН 2026-11-01.** HEAD `7264e31a8b` (ДИРЕКТОР ЭКРАНА шаг 2 — раздел **DO**, последний номер **PL-1351**; P86 сдана `24f49360ee` + `f854a878b1`, раздел DN; ворклист **20 / 54**; журнал серии
> `docs/claude/prelude2-cards-progress.md` — твоя запись ДВАДЦАТЬ ПЕРВАЯ). **Вопросов владельцу эта задача НЕ задаёт**: решения ниже приняты по его словам; `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> ⚠ **СОСЕДИ** (`ListAgents`: `terraforming-mars-9f` — занят, директор экрана). Грязны в момент выдачи: `screenDirector.ts`, `screenDirector.spec.ts`, `screenDirectorEvidence.json`, `console-screen-shadow-rows.spec.ts`,
> `scripts/screen-shadow-report.mjs`, `screen-director.md`, **`tests/e2e/consoleStart.ts`**, **`tests/e2e/fixtures/generate.ts`**, `console-ui.md`, `README.md`, реестр (`MM`), `package*.json` (не твои). **Твоя область — ЧИСТА**:
> `campaign/*` (клиент: `ConsoleCarryoverPicker.vue`, `ConsoleCampaignMap.vue`, `campaignMapModel.ts`, `campaignMapUi.ts`, `campaignState.ts`; сервер: `CampaignManager.ts`, `Campaign.ts`, `ApiCampaignCarryover.ts`, `ApiCampaignDev.ts`;
> common: `CampaignTypes.ts`, `CampaignModel.ts`), `console_campaign.less`, `console.less` (блок руки — чист сейчас), `ConsoleHandSection.vue`, `ConsoleHandDock.vue`, `consoleHandAlbum.ts`, `foundation/*`, `prelude2/VenusAllies.ts`,
> `tests/campaign/*`, `tests/e2e/console-campaign*.spec.ts`, `campaignFixtures.ts`. В ГРЯЗНЫХ файлах (`generate.ts` — фикстура P87, `consoleStart.ts` — если понадобится драйвер, доки) — ТОЛЬКО объявленным ханком через temp-index
> (`split-commits-by-hunk-temp-index`: НИКОГДА `git apply --unidiff-zero`; проверка — eslint/parse STAGED-блоба + diff blob↔worktree = только чужие ханки). ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`; `SendMessage` занятому со списком §0.
> Промты-образцы: `prelude2-p79-microgravity-nutrition.md` (счётное производство по колониям — базис «Ваши колонии: N», честный ноль — ТОТ ЖЕ термин у P87 в `stock`), `prelude2-p68-ceres-tech-market.md` (`stock.megacredits {colonies, each}` —
> первый такой термин в серии; фикстура 2p Colonies с двумя своими колониями — ОБРАЗЕЦ раскладки для стенда карты), `prelude2-p84-stratospheric-expedition.md` (закон бюджета владельца — ни одной новой мс; события/награды с печатных значков),
> `prelude2-p81-soil-studies.md` (лист — сцена, «число громче кикера», один стиль шапки). Поверхность: **`docs/claude/console/hand-album.md`** (ВЕСЬ — закон альбома: строгие страницы, размер от КОРОБКИ, корешок в доке, курсор, страница
> производна от фокуса, `planHandAlbum` / `planAlbumPage` / `pageRowsFor` / `stepHandAlbum`), `docs/claude/console/cursor.md` (TR58 — ОДНА грамматика курсора `.con-cursor()`), `docs/claude/console/hand-dock-presence.md`,
> `docs/CAMPAIGN_MODE_ARCHITECTURE.md` §2.12 (`:738–800` — домен переноса: интерлюдия, `finalHands` приватны, маршрут `POST /api/campaign/carryover`, гейт запуска, потребление при `launchMission`, потеря при апдейте билда),
> шапка этого документа (`:9–190` — история пикера: 2026-09-04 «WORKSPACE-STEP сцена», 2026-09-05 «X = осмотр через `consoleCardZoom`, RT = подтверждение, armed zero-carry»), `.claude/rules/console-ui.md` § The HAND is an ALBUM,
> § A CARD FROM THE HAND IS CHOSEN IN THE HAND (④ фраза, не склейка), § A STATUS LINE NEVER REPEATS THE FACE, § VISUAL RESTRAINT (кант, не свет), § AN OPTIONAL CHOICE DECLINES WITH A BUTTON (RT — подтверждение/отказ внутри поверхности),
> § STATE DELIVERY (инвариант 16), § «…and the PLAY composer is the same SHEET» (ОДНА шапка `ConsoleWsHead`), `.claude/rules/animations.md`, `.claude/rules/client-ui.md` (эпоха сброса, никакого remount), CLAUDE.md § Physical causality,
> § Project goals 1–4, инварианты 3, 5, 6, 9, 12, 14, 15, 16. Память: `campaign-mode-v1` (контракты, которые нельзя ломать: seat index — идентичность; перенесённые карты — ТОЛЬКО через приватный `Player.campaignCarriedCards`; carryover
> = состояние интерлюдии; interlude ONE-FLOW; пикер — один хост (карта кампании: отдельный экран + встроенная сцена эндгейма); `submitCarryover` принимает повторы до `consumed`; Y «Изменить наследие»), `campaign-overview-iteration`,
> `campaign-champion-ceremony`, `visual-restraint-no-glow`, `hand-pick-always-album`, `rules-first`, `e2e-only-on-steam-machine`, `ab-baseline-head-client-in-snapshot`, `commit-at-end-of-work`, `push-right-after-commit`,
> `git-commit-explicit-paths-shared-index`, `split-commits-by-hunk-temp-index`, `trivial-card-prompts-no-owner-questions`, `prelude2-adaptation`.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P87.png` (**проверено: 1536×1024** — скрипт примет без `--force`). Скан — `C:\Users\zelin\Downloads\Venus Allies.png` (в `Downloads` корнем).
> Лор — СО СКАНА, дословно: «Independent colonies chipping in to terraform» (без точки — добавить; гард лора; формат — `assets/text/lore_texts.json` `"P87": …` + RU в `ru/lore_texts.json`); «STRONGHOLD GAMES» на арте — издатель, не лицо.
> Реестр: последний раздел **DO**, последний номер **PL-1351** → эта задача берёт **DP**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p87` → `npm run e2e:remote -- p87 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL; стенд наследия — FUNCTIONAL + раскадровка TIMING
> (`--exclusive --workers=1`, `TM_E2E_STORYBOARD=1`, tv4k) на ОБОИХ хостах; приёмка визуала — КАДРЫ 4K, не пробник.
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§1; **§3.1 п. 1**; §2.5; §4; §5), `docs/claude/prelude2-cards-progress.md` (P68, P79 — термин колоний; P84 — бюджет; не переоткрывать), `docs/claude/turmoil-redux-card-checklist.md` §0, §3, §7,
`docs/claude/ru-translation-standard.md` (RU карты уже по планке: «Повысьте шкалу Венеры на 2 шага. Получите 4 M€ за каждую свою колонию.» — `ru/cards.json:715`; имя «Венерианские союзники» `:714`), CLAUDE.md § A WORKSPACE IS ONE FLOW.

**Образцы — по частям.** Карта: `prelude2/VenusAllies.ts` (AUTOMATED, 30, `[VENUS, SPACE]`, `victoryPoints: 2`, `global: {venus: 2}`, `stock.megacredits: {colonies: {colonies: {}}, each: 4}`, рендер `venus(2).megacredits(4).slash().colonies()`),
манифест `Prelude2CardManifest.ts:80` (`compatibility: ['venus', 'colonies']` — как `SOIL_STUDIES :77`), апстримный спек `tests/cards/prelude2/VenusAllies.spec.ts` (один `it`: Luna + Pluto → Венера 4, 8 M€); термин
`{colonies: {colonies: {}}}` — `Counter`/`countedBasis.ts` (P79: базис «Ваши колонии: N», `0 → 0 · колоний нет`), `EcologyResearch.ts:25`, `CeresTechMarket.ts:67`; история шкалы — `scaleStepReward/scaleStepRatingBeat.ts` (PL-330: рейтинг
за КАЖДЫЙ шаг от маркера после ПРИБЫТИЯ + бонус 16 % чипом `v-tr-16`), `boardBeatPark.ts` (парк под накрытой доской), `console-ui.md` § A BOARD BEAT WAITS FOR A BOARD THE PLAYER CAN SEE. **ПИКЕР ПЕРЕНОСА (как есть):**
`campaign/ConsoleCarryoverPicker.vue` (520 строк — СВОЙ движок: `wsStageLayout` вместо страниц альбома (`:261–291 fitRow`), два «keep-слота» `v-for="slotIndex in [0, 1]"` (`:46–60`, рамки 10×14.2 rem + `zoom 0.6` — пара, которую «менять
парой»), счётчик «N/2» (`:63`), сетка руки без страниц (`:70–88` — «visually plohо на большом количестве карт»: при 15+ картах `wsStageLayout` сжимает все в одну рамку), ВЫБОР = карта УЛЕТАЕТ в слот, в руке остаётся ПУСТОЙ СОКЕТ
(`rowAway` `:214`, `--away` в LESS `:629–642`), ВОЗВРАТ = A на пустом сокете (`toggleAt` `:224–241` → `flyReturn`) — то, что владелец назвал неинтуитивным; 2-D курсор по solved-per-row (`moveCursor` `:470+`), X — общий `consoleCardZoom`
(`openZoom :400–430` — ОСТАВИТЬ), RT = подтверждение с armed zero-carry (`handleIntent :330–380` — ОСТАВИТЬ семантику), `confirmLabel :300–311`, копия «Keep up to two project cards…» (лимит в ТЕКСТЕ)), `ConsoleCampaignMap.vue`
(`:184–202` хостинг `<Transition name="cm-carry"><ConsoleCarryoverPicker class="cmap__carry-overlay" …>`; `toggleCarry :982–989` — `< 2` ЗАХАРДКОЖЕНО; `confirmCarry :990+` → `submitCampaignCarryover`; `openCarryover :976`;
команды бара `:439–452` («Choose · Take / return · Inspect · RT confirm · Close»); маршрут интентов `:777–780`; `carryStepDue :556` — шаг открывается САМ; `canReviseCarry :506` — Y), `campaignMapModel.ts:94–97, :149–235`
(`carryoverOpen / carryoverConfirmed / yourCarryCards / yourEligibleCards`; CTA `chooseCarryover`), `campaignMapUi.ts` (зеркало команд для встроенного бара эндгейма), `campaignState.ts:237–266` (`submitCampaignCarryover`),
`ConsoleEndgameWorkspace.vue:341–346` (`.con-eg-campaign-scene` → `<ConsoleCampaignMap embedded>`), `:925–931` (бар эндгейма зеркалит `campaignMapUi.commands`), `console_campaign.less:480–780` (весь `.con-carry` — свой шейд
«FULL PAGE», свои анимации входа `con-carry-in` каскадом, своя рамка курсора `box-shadow 0 0 0 2px` — НЕ `.con-cursor()`, свои dashed-рамки слотов, `.cmap__carry-overlay {position: fixed; inset: 0; z-index: 120}`), `:1030–1050`
(`.con-eg-campaign-scene`, `.cmap--embedded`). СЕРВЕР: `CampaignTypes.ts:17–18` (`CARRYOVER_MAX_CARDS = 2` — КОНСТАНТА), `:44` (`MissionModifier = {id: string}` — «typed extension point only»), `Campaign.ts:54–60`
(`CarryoverSeatState {status, cards, consumed}` — ЛИМИТА НЕТ), `CampaignManager.ts:630–647` (`commitMissionResult`: `finalHands` + `bySeat[seat] = {status: 'pending', cards: [], consumed: false}`), `:667–712` (`submitCarryover`:
`cards.length > CARRYOVER_MAX_CARDS` — константа), `:461–470` (`launchMission` → `player.campaignCarriedCards`), `:1308–1323` (`getModel`: `bySeat {seat, status, count}`, `yourCards`, `yourEligible`), `CampaignModel.ts:54–66`,
`ApiCampaignCarryover.ts`, `ApiCampaignDev.ts:35–46` (dev-фикстура `carryover` / `carryoverPending`), `tests/campaign/CampaignManager.spec.ts:235–290` («carryover: validation, confirmation, launch gate and atomic consumption»).
**ЯЗЫК, НА КОТОРЫЙ ПЕРЕВОДИМ — «КАРТЫ В РУКЕ»:** `ConsoleHandSection.vue:219–300` (`.con-hand__stagewrap` → `.con-hand__pagestrip` (`--live`, `--turning`) → `.con-hand__page` × страницы → `.con-hand__row` → `.con-hand__slot[data-zoom-slot]`
с состояниями `--selected` (курсор), `--sale-picked` / `--select-picked` (выбор — кант), `--select-disabled`, полоса выбора `.con-cards__pickband` («✓ Card selected»), `con-deal-hold`), `:60–140` (шапка: вопрос `.con-hand__question`
(`-ask / -src / -plates / -decline / -defer`), ПОЛОСА ПРОДАЖИ `.con-hand__salebar` (`-item / -num / -label / -total`: «Выбрано: N · +N M€ · 500 → 500») — ОБРАЗЕЦ бегущей сводки, блок сброса `.con-hand__discard`),
`consoleHandAlbum.ts` (`albumSpecFor(profile)`, `planHandAlbum` (размер от КОРОБКИ + сетка профиля — никогда от числа карт), `planAlbumPage` / `pageRowsFor` (витринная композиция 10→5+5 … 1–5 → один ряд), `pageOfIndex` / `pageSlotOfIndex`,
`stepHandAlbum` (d-pad через край = перелистывание), константы `ALBUM_*`), `ConsoleHandDock.vue:82–146` (КОРЕШОК альбома `.con-handdock__pager`: «LB 1–10 из 15 · 1/2 RB» — ОДНО место позиции страницы), LESS руки в `console.less`
(`.con-hand__slot--selected { .con-cursor-on() }` `:10421` — ОДНА грамматика курсора; `--select-picked` кант mint; найти блок `.con-hand` целиком — `grep -n "^\.con-hand\b\|^\.con-hand {" console.less`), `foundation/ConsoleWsHead.vue`
(`root · context · subject · stage · committed` — ОДНА шапка workspace), шельф драфта как образец «посадочные места» `ConsoleDraftWorkspace.vue:238–290` (`.con-draftws__shelf` — `shelf-slot[data-tray-slot]`, `shelf-seat` с номером,
`shelf-count N / total`), `cardFlight/cloneFlights.ts` (`flyCardClones` — полёт клона слот→цель; уже используется пикером), `patentSale/patentSaleDirector.ts` (`playSaleGather` — сбор пакета, образец «карты уходят на подтверждении»),
`consoleCardZoom.ts` (`openConsoleCardZoom(list, i, {isSelected, toggle}, …, {contextLabel, origin: {kind: 'physical', resolve}})` — осмотр с мостом выбора), `cardDeal/*` (`ConsoleCardDealLayer` — раздача пакетом, образец входа),
i18n: `ru/campaign.json:64–97` (ключи пикера; «Keep up to two…» — число в тексте), множественное число в параметрах — `ru/console.json:423` («${0} {карта|карты|карт} на выбор»). Стенды: `tests/e2e/console-campaign.spec.ts:112–200`
(interlude ONE FLOW — драйвит `.con-carry`, `.con-carry__card`, `.con-carry__status-warn`, `.con-zoom-hold`, `Period` = RT, `KeyY` = ревизия; ЕДИНСТВЕННЫЙ спек с `con-carry` — перенацелить в том же диффе, контракт 14),
`campaignFixtures.ts` (`createCampaign`, `launchMission`, `devCommit(request, id, placements, {carryover, carryoverPending})`, `openMapAs`, `campaignModelAs`), `console-campaign-endgame.spec.ts` (вход в эндгейм миссии — путь ко ВТОРОМУ хосту).
Кадров текущего пикера в `screenshots/` НЕТ — снять «ДО» первым делом (§0).

---

## Диагноз (подтверждён файл:строка на `7264e31a8b`; перепроверить на своём HEAD)

**V1 · Карта — даром.** Декларация без hook'ов; термин `{colonies: {colonies: {}}}` в `stock` проведён P68 (M€ за колонию) и в `production` P79 (базис «Ваши колонии: N», ноль — «0 → 0 · колоний нет», а не молчание); два шага Венеры —
`global.venus: 2` (история шкалы: маркер глайдом на 2 шага, жетон рейтинга ЗА КАЖДЫЙ шаг после прибытия, бонус 16 % — чип `v-tr-16`, парк под накрытым полем — всё готово); Космос → титан в оплате; ПО «2» с печатного бейджа (TR55).
Осталось: лор + арт + RU-проверка + строка hold-back + спек + стенд. Гарды (`cardPlayPreviewCoverage`, `cardInformation`, `effectSummary`, `premiumCardViewModel`, `cardPlayReplayCoverage` — шагов нет) должны пройти без правок карты;
если какой-то назовёт P87 — это находка, чинить ОБЩИМ местом, не хуком.

**K1 · Пикер — ОТДЕЛЬНЫЙ ДВИЖОК.** Своя сетка (`wsStageLayout` — движок СЦЕНЫ ВЫБОРА ЦЕЛИ, рассчитанный на 2–8 карт: при терминальной руке 12–20 карт он ужимает все в одну рамку — «плохо на большом количестве»), свои
слоты/сокеты, своя рамка курсора (`box-shadow 0 0 0 2px cyan` — не `.con-cursor()`; плюс `0 0 1.3rem` ОРЕОЛ на `--filled` — VISUAL RESTRAINT), свой шейд «FULL PAGE», свои анимации, свой счётчик «N/2» крупной цифрой без
контекста, свои dashed-рамки, своя копия («Keep up to two…»). Рука рядом — строгие страницы 5×2 от коробки, корешок «1–10 из 15 · 1/2» в доке, `.con-cursor()`, кант выбора mint + полоса «✓», сводка продажи «Выбрано N · +N M€ ·
до → после». Та же задача (выбрать N карт из руки) — два языка.

**K2 · Возврат — неинтуитивен по построению.** Модель «карта УЛЕТЕЛА в слот, в руке остался пустой сокет, A на сокете возвращает» (`rowAway`, `--away::after` dashed, `flyReturn`): игрок ищет карту ТАМ, где она сейчас (в слоте), а
слоты — не фокусируемы (курсор ходит только по ряду руки; `moveCursor` знает только `eligible`). Единственный путь назад — догадаться, что пустая ячейка кликабельна. В руке та же задача решена ПЕРЕКЛЮЧЕНИЕМ НА МЕСТЕ: карта
продажи стоит в своём слоте с кантом и полосой «✓ Выбрана», A снимает выбор, ничего не улетает до подтверждения, сводка считает.

**K3 · Лимит «2» — константа в ЧЕТЫРЁХ местах.** `CARRYOVER_MAX_CARDS` (`CampaignTypes.ts:18`) читают сервер (`submitCarryover :689`) и… клиент НЕ читает — он хардкодит: `ConsoleCampaignMap.toggleCarry :986` (`< 2`), пикер
`v-for="slotIndex in [0, 1]"` (`:48`), `selected.length >= 2` (`:236, :457`), `{{ selected.length }}/2` (`:63`), текст «Keep up to two…» (`:40`). Состояние места (`CarryoverSeatState`) лимита не несёт, модель (`CarryoverSeatPublic`) — тоже;
`MissionModifier` — пустая точка расширения. Владелец: лимит — переменная ИГРОКА (места), по умолчанию 2, модификаторы — потом.

**K4 · Шапка и хост.** Пикер титулует себя сам (`.con-carry__kicker` «Project legacy» + лид) — вне ОДНОЙ шапки workspace (`ConsoleWsHead`); в эндгейме он стоит поверх сцены эндгейма как `position: fixed; inset: 0; z-index: 120` с
собственным непрозрачным шейдом — не стадия хоста, а окно поверх; на отдельном экране карты — то же окно поверх карты. Команды бара — свои («Take / return» — глагол под модель сокетов). Вход — каскад `con-carry-in` по `--i`
(десяток независимых проявлений), карты «появляются», а не ПРИХОДЯТ откуда-то; выход — fade 170 мс; подтверждение — мгновенное закрытие: карты, которые «переходят в следующую миссию», никуда не переходят на глазах.

---

## Решения (приняты по словам владельца; вопросов нет)

1. **Карта — без правок кода карты.** Лор EN/RU («Независимые колонии вкладываются в терраформирование» — сверить с планкой), арт P87 + миниатюра, строка hold-back долой (и только она), `make:cards` 0 / 0 / 0. Спек: апстримный `it`
   байт в байт + премиальные (0 / 1 / 2 / 3 колонии → 0 / 4 / 8 / 12 M€ и базис превью «Ваши колонии: N», при 0 — честный ноль (класс P79); чипы превью: Венера +2 с подразумеваемым РТ +2 (`withImpliedRatings`) — и +1 при пересечении
   16 %, M€ +4×N, ПО 2; титан платит, сталь — нет; Венера у потолка 28 → один шаг / ноль шагов — ИМЕНОВАННЫЙ лимит, РТ только за сделанные; раздача (Venus + Colonies оба нужны — `compatibility`); save / reload; MarsBot).

2. **«НАСЛЕДИЕ ПРОЕКТОВ» = АЛЬБОМ РУКИ — ОДИН ХАССИ, ОДИН ПЛАНИРОВЩИК, ОДИН КУРСОР (K1).** Вынести из руки ХОСТ-АГНОСТИЧНЫЙ альбом карт: `foundation/ConsoleCardAlbum.vue` (пропсы: `entries` (имя + модель + состояния `picked /
   disabled / reason`), `index` (фокус — страница ПРОИЗВОДНА от него), `pickedOrdinal(name)`, `spec` (`albumSpecFor(profile)`), `band` (полоса выбора: текст/класс); события: `nav`, `page`; метод `transitionTargets()` /
   `slotEl(name)` для полётов и зума) поверх ТОГО ЖЕ планировщика `consoleHandAlbum.ts` (`planHandAlbum` от измеренной коробки + сетки профиля — никогда от числа карт; `planAlbumPage` витрина 1–5 одним рядом; `stepHandAlbum`:
   d-pad через край = перелистывание; LB/RB — страница) с ТОЙ ЖЕ разметкой страниц (`pagestrip --live/--turning` → `page` → `row` → `slot[data-zoom-slot]`) и ТЕМ ЖЕ LESS: блок руки `.con-hand__pagestrip / __page / __row / __slot
   (+ --selected .con-cursor-on(), --select-picked, --select-disabled)` и `.con-cards__pickband` переводятся в ОБЩИЕ миксины `console_card_album.less` (`.con-album-strip()`, `.con-album-slot()`, `.con-album-pickband()`), которые
   `.con-hand` и `.con-album` применяют ОБА — паритет по построению; разметка самой `ConsoleHandSection` в этой задаче НЕ переплетается на новый компонент (её тела/эпизоды/мосты — своя физика; миграция руки на `ConsoleCardAlbum`
   — отдельная задача, записать как хвост), но её LESS — через миксины. КОРЕШОК: вынести из дока `foundation/ConsoleAlbumSpine.vue` (разметка `.con-handdock__pager` → `.con-album-spine` миксин; док использует его же) — пикер
   ставит корешок в СВОЙ подвал (`--con-ws-foot-h`). Гард: `tests/client/components/console/consoleCardAlbum.spec.ts` — при одной коробке и профиле альбом пикера и `planHandAlbum` руки дают ОДИН план (размер слота, зазоры,
   страницы, композиция витрины для 1…15 карт); `tests/console/albumChassisParity.spec.ts` — ни один `.con-album__*`/`.con-hand__*` селектор страницы/слота не объявляет геометрию мимо миксина (источник-гард, как
   `glowRestraintGuard`). Осмотр X — прежний общий `consoleCardZoom` (физический источник = слот альбома).

3. **ВЫБОР — ПЕРЕКЛЮЧЕНИЕ НА МЕСТЕ, как продажа патентов; НИЧЕГО НЕ УЛЕТАЕТ ДО ПОДТВЕРЖДЕНИЯ (K2).** A на карте = «оставить» — карта СТОИТ в своём слоте с кантом выбора (`--select-picked`, mint inset hairline — кант, не свет) и
   полосой `.con-cards__pickband` «✓ В миссию 3 · 1» (ПОРЯДКОВЫЙ номер места — `selected` идёт в порядке выбора, номер = место); A на оставленной карте = вернуть (снять кант) — ТА ЖЕ клавиша на ТОМ ЖЕ объекте, пустых сокетов нет,
   «нажать на пустую ячейку» больше нет как понятия; при лимите — остальные карты не дим (дим говорит «карта плохая»), а полоса вопроса говорит «места заняты: верните карту, чтобы взять другую» и A на невыбранной — честный отказ
   нотисом (не молчание); X — осмотр, A в осмотре — тот же тоггл (мост выбора — есть). RT — подтверждение (семантика ARMED zero-carry СОХРАНЯЕТСЯ: 0 карт при непустой руке → первое RT — предупреждение в строке статуса и глагол
   «Да — продолжить без карт», второе — подтверждение; B снимает взвод; пустая рука — «Подтвердить готовность» одним RT). R3 — ничего (лимит — не «все»). ШАПКА — не своя: `ConsoleWsHead` (встроенный хост — корень эндгейма
   («ИТОГИ МИССИИ» / как зовёт себя `ConsoleEndgameWorkspace`), отдельный экран — имя кампании; `subject` — «МИССИЯ K» (куда переходят), `stage` — «НАСЛЕДИЕ ПРОЕКТОВ», cyan → amber после подтверждения (`committed`)); строка
   ВОПРОСА (хасси `.con-hand__question`): «Оставьте до N карт проектов — они бесплатно перейдут в миссию K» (N — `yourLimit`, RU-плюрал `{карты|карт|карт}`; K — следующий слот) + бегущая СВОДКА хасси `.con-hand__salebar`:
   «ОСТАВЛЯЮ 1 / 2 · бесплатно» (без «→ в руке 0», без цены — status line не повторяет лицо; при 0 — «Ничего не выбрано» тихо); подтверждённое и неизменённое — «Выбор подтверждён — можно изменить до запуска миссии» в строке
   статуса (как сейчас). МАНИФЕСТ МЕСТ (чтобы с многостраничной рукой видеть, что оставлено, не листая): под шапкой в полосе сводки — N посадочных мест-плашек в стиле шельфа драфта (`shelf-seat` с номером): пустое место —
   номер; занятое — НОМЕР + ИМЯ карты (текстовая плашка, НЕ лицо: лицо — одно, в слоте альбома; плашка — ярлык, а не копия), появляется/уходит короткой фразой (180 мс) по тогглу. Кадр до сдачи: при 14 картах (две страницы)
   выбранные на 2-й странице читаются с 1-й по манифесту.

4. **ВХОД И ВЫХОД — ФРАЗЫ С ФИЗИЧЕСКОЙ ПРИЧИНОЙ, В БЮДЖЕТЕ (K4; закон P84 — ни одной новой паузы).** ВХОД: стадия открывается ФРАЗОЙ хоста (встроенный — сцена эндгейма «паркует» подиум и открывает стадию из места CTA
   «Следующая миссия» (RELEASE → UNFOLD → REVEAL, `consoleActionOutcomeMotion`-грамматика, не десять независимых `con-carry-in`); отдельная карта — из карточки текущей миссии), карты терминальной руки ПРИХОДЯТ РАЗДАЧЕЙ в слоты
   страницы (`ConsoleCardDealLayer` / грамматика открытия руки: подъём → пил → полёт → поворот лицом; источник — строка ВАШЕГО места на рельсе карты (`.cmap__seat` «вы») — «карты вашей руки из законченной миссии»; длительность
   ≤ открытия руки той же величины; reduced motion — мгновенно). ВЫХОД НА ПОДТВЕРЖДЕНИИ: POST → ответ сервера (arm → detect: летит только подтверждённое) → ОСТАВЛЕННЫЕ карты поднимаются из слотов и летят (`flyCardClones`)
   в карточку СЛЕДУЮЩЕЙ миссии на карте (`.cmap__card--current`), которая ОТВЕЧАЕТ касанию (кант-импульс one-shot, счётчик места «переносит: N» тикает на касании), остальная рука ГАСНЕТ на месте (она не переходит), стадия
   складывается в точку CTA; весь уход ≤ 600 мс и ПЕРЕКРЫВАЕТ возврат карты (игрок ничего не ждёт сверх сегодняшнего закрытия + round-trip). Y «Изменить наследие» открывает ту же стадию с оставленными картами УЖЕ В КАНТЕ
   (состояние с сервера; раздача не повторяется — карты уже «здесь»: вход фразой без раздачи, стадия раскрывается с картами на местах). Ошибка сервера — строка статуса, ничего не летит, стадия стоит. Шейд: ОПАК по PL-137
   (стадия — полный экран хоста между его барами: бар команд хоста и шапка остаются, как у любого workspace; на отдельном экране — тот же хасси). Свет: ноль стоячих ореолов (`glowRestraintGuard` — `console_campaign.less`
   на храповике: число ДОЛЖНО УПАСТЬ, зафиксировать `GLOW_RESTRAINT_BASELINE=write` в том же диффе).

5. **ЛИМИТ — ПЕРЕМЕННАЯ МЕСТА, ОДНА ФУНКЦИЯ, ОДИН ЧИТАТЕЛЬ (K3; владелец).** Сервер: `CarryoverSeatState.limit: number` пишется в `commitMissionResult` ОДНОЙ функцией `carryoverLimitFor(campaign, seat): number` (`server/campaign/
   carryoverLimit.ts` — сегодня возвращает `CARRYOVER_MAX_CARDS`; сюда войдут модификаторы: сигнатура принимает `campaign` + `seat` + будущий `MissionModifier[]`, комментарий называет точку); `submitCarryover` валидирует против
   `state.limit` (константу больше не читает; сообщение называет лимит МЕСТА); старый сейв без `limit` читается как константа (деградация на чтении, не миграция); `CarryoverSeatPublic.limit` (публично — лимит не секрет),
   `CampaignCarryoverModel.yourLimit`; `launchMission` без изменений (берёт `cards`). Dev-фикстура (`ApiCampaignDev` / `devCommit`): `carryoverLimits?: Record<seat, n>` — чтобы стенд видел лимит 1 / 3 / 5 живьём. Клиент: ОДИН
   читатель `vm.yourLimit` (`campaignMapModel`) — `toggleCarry`, манифест мест, полоса вопроса, сводка; константа `CARRYOVER_MAX_CARDS` в `src/client/**` — ЗАПРЕЩЕНА (источник-гард в `campaignMapModel.spec` или
   `tests/console/*Guard`). Спеки: `CampaignManager.spec` § limit per seat (2 по умолчанию; фикстура 3 → три карты проходят, четвёртая — отказ с «3»; 1 → вторая отказ; 0 → только пустой выбор = готовность; сейв без `limit` → 2),
   `campaignMapModel.spec` § yourLimit в CTA/копии.

---

## 0. Разведка (≤ 1 ч) — `ListAgents` + `git status`; `SendMessage` занятому соседу: «беру `campaign/**` (клиент/сервер/common), `console_campaign.less`, блок руки в `console.less` (миксины — геометрия не меняется),
`ConsoleHandSection.vue` (только LESS/миксины + вынос корешка), `ConsoleHandDock.vue`, `foundation/ConsoleCardAlbum.vue` + `ConsoleAlbumSpine.vue` (новые), `prelude2/VenusAllies.ts`, `tests/campaign/*`, `console-campaign*.spec`;
в `generate.ts` — одна фикстура объявленным ханком». Снять «ДО» на боксе (tv4k, `TM_E2E_STORYBOARD=1`): пикер на ОТДЕЛЬНОЙ карте (`console-campaign.spec` interlude ONE FLOW — рука Bruno из 2 карт; добавить временно dev-фикстуру с
рукой 14 карт, чтобы увидеть «плохо на большом количестве») и во ВСТРОЕННОМ эндгейме (путь `console-campaign-endgame` → «Следующая миссия»): покадрово вход, тоггл (улёт в слот + сокет), возврат через сокет, подтверждение
(мгновенное закрытие). Эти кадры — первый блок отчёта.

## 1. Карта (решение 1) — лор, арт, hold-back, спек, гарды, `make:cards`; фикстура `venus-allies` (образец — `ceresTechMarketFixture`: 2p Colonies + Venus + Prelude 2, две СВОИ колонии, Венера 12 % (→ 16 % пересекает бонус:
РТ +2 за шаги +1 бонус), P87 в руке, 30 M€ + 2 титана; сухой прогон: Венера 16, M€ +8 (минус оплата), РТ +3, ПО 2) — объявленным ханком в `generate.ts`; стенд `console-venus-allies.spec.ts` (FUNCTIONAL, tv4k): рука → P87 → лист
розыгрыша (чипы: Венера +2 · РТ +3 · M€ +8 с базисом «Ваши колонии: 2» · ПО 2; оплата титаном одной строкой) → A → ОДИН POST → герой садится на стол, M€ +8 рождаются на печатном M€-значке (грамматика P84), ПО с бейджа; затем
история доски: маркер Венеры глайдом на 2 шага, жетоны РТ с маркера ×2 + чип 16 % ×1, HUD читает правду сразу (инвариант 16), `preselectGuard` / `livenessGuard` молчат; сервер: Венера 16, РТ +3, M€ как положено. Коммит + пуш.

## 2. Сервер лимита (решение 5) — `carryoverLimit.ts`, `Campaign.ts`, `CampaignManager.ts` (commit / submit / getModel), `CampaignModel.ts`, `CampaignTypes.ts` (константа остаётся как ДЕФОЛТ функции), `ApiCampaignDev.ts`,
`campaignFixtures.ts` (`devCommit` принимает `carryoverLimits`), спеки. Коммит + пуш.

## 3. Хасси альбома (решение 2) — `console_card_album.less` (миксины из блока руки), `foundation/ConsoleCardAlbum.vue`, `foundation/ConsoleAlbumSpine.vue` (док переведён на него — ПАРИТЕТ пикселей: `console-hand-album-probe` /
`hand-album-probe` и `console-hand-open-parity` зелёные без правок), гарды паритета. Коммит + пуш (рука не должна измениться ни на пиксель — снять «до/после» кадр руки на tv4k и сравнить коробки слотов `getBoundingClientRect`
в спеке паритета).

## 4. Пикер (решения 3–4) — `ConsoleCarryoverPicker.vue` переписывается НА хасси (альбом + `ConsoleWsHead` + полоса вопроса/сводки + манифест мест + корешок в подвале; `handleIntent` сохраняет контракт хоста: nav / primary /
inspect / triggerR / back, плюс LB/RB — страница); `ConsoleCampaignMap.vue` (`toggleCarry` по `yourLimit`; команды бара: «d-pad Выбрать · A Оставить / Вернуть (по фокусу) · X Осмотреть · LB/RB Страница (только при > 1) ·
RT <глагол> · B Закрыть»; вход/выход фразами; полёт в карточку миссии на подтверждении; источник раздачи — строка места); `campaignMapUi` — зеркало без изменений формы; `ConsoleEndgameWorkspace.vue` — только если нужна
точка CTA для фразы (`armOutcomeOriginFrom`); LESS `.con-carry` — переписать на хасси (удалить свой курсор, свои рамки, свой каскад, ореолы). i18n: новые EN-ключи с параметрами («Keep up to ${0} project cards — they travel
into mission ${1}, free of charge», «Keeping ${0} / ${1}», «Seats are full — return a card to keep another», «Seat ${0}», «Into mission ${0} · ${1}» для полосы), RU по планке с плюралом; старые ключи («Keep up to two…») — удалить
вместе с переводами (гард дубликатов). Коммит + пуш.

## 5. Стенды (e2e, бокс)
   (а) `console-campaign.spec.ts` interlude ONE FLOW — перенацелить (`.con-carry__card` → `.con-carry .con-album__slot`; тоггл = кант + полоса с номером, НИКАКОГО `--away`/сокета; RT-armed как было; Y → стадия с кантами).
   (б) **`console-carryover-album.spec.ts`** (tv4k): A — ОТДЕЛЬНАЯ карта, рука 14 карт (dev-фикстура `carryover: {1: [14 имён]}` + `carryoverPending`), лимит 2: вход — раздача из строки места (свидетель: тела в полёте, слоты
   под `holdSlots` до касания, страница 1 из 2 в корешке подвала, размер слота = план руки при той же коробке), d-pad через край → страница 2 (одна transform-фраза, `--turning`), A на карте → кант + «✓ В миссию 2 · 1», манифест
   «1 · <имя>» на полосе, LB → страница 1 — манифест по-прежнему называет карту со 2-й; A на второй → «· 2», A на третьей → нотис «места заняты», A на первой → возврат (кант снят, манифест «1 · —», вторая становится «1»), X —
   осмотр из слота (`.con-zoom-hold` 1), A в осмотре — тоггл; RT → ОДИН POST `cards: [...]` в порядке мест → ответ → полёт двух клонов из слотов в `.cmap__card--current` (свидетель касания: импульс карточки, «переносит: 2» на
   строке места тикает на касании), стадия сложилась в CTA, `cmap__wait-strip--ready`; Y → стадия с двумя кантами без раздачи. B — лимит 3 (dev `carryoverLimits: {1: 3}`): три места в манифесте, три канта, четвёртый — отказ;
   лимит 1 — одно место. C — ВСТРОЕННЫЙ эндгейм (рецепт `console-campaign-endgame`): «Следующая миссия» → стадия открывается фразой из CTA (нет `v-if`-блинка: opacity подиума/стадии по кадрам), та же разметка (`.con-carry
   .con-album`), та же шапка `ConsoleWsHead` с корнем эндгейма, бар эндгейма зеркалит команды, RT → полёт в карточку миссии ВСТРОЕННОЙ карты. D — пустая рука: без раздачи, строка «карт не осталось», RT одним нажатием —
   готовность. Раскадровка TIMING обоих хостов — `screenshots/carryover-album/<host>/`.
   (в) Регрессия на боксе: `console-campaign`, `console-campaign-endgame`, `console-campaign-overview`, `console-campaign-legacy-overview`, `console-campaigns-list`, `console-gamepad-reload-carryover`, `hand-album-probe`,
   `console-hand-open-parity`, `hand-reveal-probe`, `console-hand-pick-preselect`, `console-card-discard`, канарейка, `npm run e2e:affected`. Любой красный — аннотация `build` ПЕРЕД вердиктом.

## 6. Документы: `docs/CAMPAIGN_MODE_ARCHITECTURE.md` §2.12 (лимит места; пикер = альбом; вход/выход фразами) + шапка (addendum 2026-11-01), новый `docs/claude/console/card-album.md` (хасси: планировщик, миксины, корешок,
кто потребитель — рука через миксины, наследие через компонент; хвост — миграция руки на компонент), `hand-album.md` (ссылка на хасси), `console-ui.md` § The HAND is an ALBUM (+ «…и каждый выбор N карт из руки стоит на том же
хасси — `ConsoleCardAlbum`; наследие кампании первым»), `docs/PRELUDE2_ADAPTATION.md` §4 (P87 сдана, 21/54), журнал серии (запись ДВАДЦАТЬ ПЕРВАЯ), реестр **DP**, память `campaign-mode-v1` (одной строкой: пикер на хасси
альбома, лимит места).

## 7. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «ДО / ПОСЛЕ» кадрами (2 карты · 14 карт · возврат · подтверждение; оба хоста); паритет альбома (таблица коробок слотов рука ↔ наследие при 4K: ширина/высота/зазор
— равны); A/B длительности «RT → карта кампании в покое» против HEAD (≤ HEAD + round-trip сервера); гарды; регрессия на боксе (аннотация `build`); решения 1–5 по пунктам; хвосты честно (миграция руки на компонент; модификаторы
лимита — точка названа, не реализована); что ушло в пуш.

## 8. Нельзя
- Второй планировщик страниц / второй курсор / вторая рамка выбора (всё — миксины и `consoleHandAlbum.ts`); пустые сокеты и «возврат через ячейку»; лицо карты дважды на экране (манифест — ярлык, не лицо); лимит числом в
  клиенте или в тексте; дим всей руки при заполненных местах; ореолы и свечение на кантах/слотах/местах (`glowRestraintGuard` — число падает, не растёт); своя шапка вместо `ConsoleWsHead`; `v-if`-блинк на входе/выходе;
  удлинять подтверждение сверх round-trip + ≤ 600 мс полёта; ломать контракты `campaign-mode-v1` (seat index, приватность `finalHands`/`yourCards`, `submitCarryover` до `consumed`, ONE-FLOW интерлюдии, Y-ревизия); менять
  `ConsoleHandSection` сверх LESS-миксинов и выноса корешка; чужие ханки; `git apply --unidiff-zero`; `--no-verify`; локальный Playwright.
