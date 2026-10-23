# Промт исполнителю · T10 Public Celebrations («Народное празднование») — восьмая классическая карта Turmoil под Redux, «на месте» (§3.1): событие, 8, без меток, 2 ПО; «требует, чтобы вы были председателем» — ТРЕБОВАНИЕ ПРЕДСЕДАТЕЛЬСТВА обязано иметь ПОНЯТНУЮ ГРАФИКУ (владелец): один знак председательства — КРЕСЛО (`PremiumChairGlyph`, знак Парламента и глоссария) — на лице в плите MIN, на плите руки, в «Информации», в зонах Парламента; сегодня у требования чужой знак (`chairman.png` — безликий бюст апстрима) и у председательства ДВА знака · ГЛАВНОЕ — ПОЛИРОВКА ВИЗУАЛА (≈ 75 %) «ДРАФТ И ПОКУПКА ИССЛЕДОВАНИЯ — ВИТРИНА ПАКЕТА НА 4K»: самый частый экран между поколениями (каждое поколение, с драфтом и без) на 4K — карты в верхней половине, нижние ≈ 40 % пусты, полка «ОТОБРАННЫЕ» — четыре голых прямоугольника, ожидание — пустое поле с галочкой, подпись карты — одна строка внизу; нужен премиум-проём, как у «Разыграно» (TR65) и подиума (TR69)

> **Статус: ВЫДАН 2026-10-23.** HEAD `1e644681ef` (T15 + CD сданы; T14 + CC сданы — 7/22). Сосед держит незакоммиченный
> `.github/workflows/playwright-e2e.yml` — не трогать. Лор владельца `T10` («Inviting everyone to celebrate human progress.») лежит НЕЗАКОММИЧЕННЫМ в
> `assets/text/lore_texts.json` — коммитить ПЕРВЫМ ханком (своя строка + запятая строки выше). Арт — `C:\Users\zelin\Downloads\Mars Arts\T10.png`.
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T10 - Public Celebrations.png`.
> Реестр: последний раздел **CD**, следующий свободный **PL-917** → эта задача берёт **CE**; номера — по footer в момент записи.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t10 …`; exit 2/3/4 → спросить). Сосед-27 занимает бокс эксклюзивно до ≈ 13:45 23-го —
> `SendMessage` ему перед первым прогоном (он встроит окно).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1, `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T09/T14/T15 (образец §-блоков
карты). **Контракты карты:** `docs/claude/parliament-glossary.md` §4 (`:58–68` — роль «председатель», «кресло председателя», **«Задание председателя НА ЛИЦЕ
резолюции — знак кресла + графика условия, сноска без слов (`PremiumChairGlyph`; тот же знак стоит рядом со словами в кикере)»** — глоссарий уже назначил
кресло ЕДИНСТВЕННЫМ знаком), инвариант 13 (один глоссарий Парламента; гард `parliamentGlossary.spec`), `.claude/rules/premium-card.md` (плита требований),
`docs/claude/console/unavailability-reasons.md` (§ The ONE presentation model `:34`; § A requirement is printed ONCE `:206`), память `requirement-rendering-standard`,
`reuse-existing-icons-check-scan` (⚠ не рисовать второй знак — кресло уже есть), `ru-card-names-already-exist`. **Контракты полировки:** память
`console-draft-workspace` (архитектура: phase-корень `draft`, `.con-draftws`, зоны-СЛОИ `v-show` pick/wait/buy/pay/inspect/done, полка «ОТОБРАНО» =
второй клиент tray-мозга, покупка = та же экономика; гочи 1–6), `console-draft-tray-research-rise` (hero-полёт пика в лоток, RESEARCH RISE),
`console-card-deal-cinematic`, `tr65-played-table` («Разыграно» — экран workspace в проёме: одна страница стопок, зоны фокуса — образец витрины),
`tr69-finale-podium` (планировщик от ИЗМЕРЕННОГО бокса, геометрия — не от счёта), `tr68-pregame-showcase` (пол TV, пробник «ниже пола / доля проёма /
обрезки», ряды по содержимому, не `1fr` в незаданной высоте), `polish-priority-tv4k-no-deck-only` (**пустое место на 4K = дефект**),
`polish-area-premium-visual-first`, `console-reading-typography` / `length-tier-ladder-calibration`, `console-hud-frame-rails`, `batch-decisions`,
`concurrent-session-edits-same-files`, `e2e-only-on-steam-machine`, `e2e-speed-iteration`, `e2e-spec-rot-contract`, `shell-template-escapes`;
`docs/CONSOLE_FOUNDATION.md` **§10c** (`:393` — DRAFT TRAY + RESEARCH RISE), `docs/claude/console/hud-frame.md`, `docs/claude/console/tv-display-profile.md`,
CLAUDE.md «Project goals» 1–4 и законы workspace (крошка непрерывна; стадия — одна фраза; `v-if`-подмена = моргание). Журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **TR12 Party Sanctions** (`turmoilRedux/PartySanctions.ts:31–75` — `requirements: {chairman: true}`, первая карта набора с
именованной причиной председательства; спек + e2e `console-party-sanctions`) — та же плита требований, тот же путь причины; плита требований —
`premiumCard/PremiumRequirementsBar.vue:9–20` (бинарное требование — только иконка в сокете, `iconUrl` фоном) и `premiumCardViewModel.ts:284`
(`[RequirementType.CHAIRMAN]: {iconUrl: misc/chairman.png, binary: true}`); **кресло** — `premiumCard/PremiumChairGlyph.vue` (инлайн-SVG `PATH`, `fill:
currentColor`; пользователи — `PremiumResolutionFace`, `parliament/ConsoleParliamentEngine.vue:36`, `ConsoleParliamentQuestDossier`); **бюст** —
`handCards/unplayableReasonFormat.ts:69` (`CHAIRMAN_EMBLEM`), `ConsoleHandSection.vue:309` (чип руки с эмблемой), `ConsoleInfoParliament.vue:84`,
`info/ConsoleDossierParliament.vue:22` («The chairman wears the chair» — а печатает `chairman.png`), `premiumCardIcons.ts:333` (`CardRenderItemType.CHAIRMAN` —
DSL `b.chairman()`); причина — `models/unplayableReasons.ts:358–379` (`chairmanRequirementReason`: «Requires you to be the chairman» + `chairmanNow` —
«chairman now: ${0}» / «the chair is vacant»; RU `parliament.json:1235`); **драфт** — `components/console/draft/ConsoleDraftWorkspace.vue` (91 КБ; зоны
`__stage` / `__cards` / `__row` / `__shelf*` / `__pass*` / `__await-node` / `__finstrip` / `__fin-*` / `__doneplate` / `__statusbar`), мозг `console/draft/
consoleDraftFlow.ts` (стадии pick / wait / buy из структуры `playerView`; журней «01 ВЫБОР 1..N → 02 ПОКУПКА → ✓ ГОТОВО»), `console/draft/consoleDraftUi.ts`,
стили `console.less:3350–3630` (`.con-draftws`), TV `console_tv.less:648–660`, лоток `cardDeal/consoleDraftTray.ts`; e2e `console-draft-workspace.spec.ts`
(`:7–25` — что пинится; `:242` полный флоу; `:702` Helion-оплата), `draft-finale-probe` (TIMING), `console-research-startups` (покупка без драфта — тот же
`.con-draftws`), `console-parliament-research` (PL-768). Кадры «сегодня» (4K, 2026-10-22): `screenshots/draft-workspace/{01-first-packet,02-waiting,04-inspect,06-purchase}.png`.

---

## Диагноз (подтверждён файл:строка и кадрами на `1e644681ef`; перепроверить на своём HEAD)

### Карта — у требования чужой знак
1. **Декларативна; требование — существующий вид.** `turmoil/PublicCelebrations.ts`: `requirements: {chairman: true}`, `victoryPoints: 2`, событие без меток,
   `cardNumber: 'T10'` верен. Требование уже на фасаде (`ChairmanRequirement.satisfies` → `politics.chairman()`), причина руки ИМЕНОВАНА (TR12: «Требуется быть
   председателем · сейчас председатель: X / кресло свободно»). Работа карты: RU описания (`turmoil_cards.json:33` — «Требование: ваш делегат - председатель» →
   «Требует, чтобы вы были председателем.»), лор RU («Приглашаем всех отпраздновать прогресс человечества.»), арт, `card_info`, строка долой
   (`turmoilReduxAdaptation.ts:44`), пин «as of the last adaptation» (8 из 22), спеки класса «что раздаёт стол». ПО 2 — ячейка счёта; событие — стопка.
2. **Два знака одного понятия.** Глоссарий (§4) назначил ОДИН знак председательства — КРЕСЛО (`PremiumChairGlyph`): лица резолюций, блок задания
   правительства, кикер досье задания. А требование карты печатает `chairman.png` — безликий бюст апстрима — в плите MIN (`premiumCardViewModel.ts:284`),
   тот же бюст на чипе руки (`unplayableReasonFormat.ts:69`), в «Информации › Парламент» (`ConsoleInfoParliament.vue:84`) и в досье Парламента
   (`ConsoleDossierParliament.vue:22`, чей комментарий сам говорит «wears the chair»). На скане в плите MIN — силуэт председателя; в консоли
   председатель УЖЕ нарисован креслом — значит, требование «вы председатель» читается креслом в золотой плите MIN (как партия — эмблемой, TR15+).
   Нарушение инварианта 13 (один глоссарий) по картинке, не по слову.
3. **Знак — один источник.** Кресло живёт инлайн-путём в компоненте (`currentColor`); плита требований рисует иконку `background-image` по `iconUrl`;
   нужен файл `assets/misc/chair.svg` с ТЕМ ЖЕ путём (гард паритета пути) — или компонентный слот в сокете плиты для бинарных требований с глифом-компонентом
   (чище: один источник без файла-двойника). Решение 2.

### Драфт и покупка исследования — пустой 4K
4. **Карты — в верхней половине, низ пуст.** Кадр `01-first-packet` (3840×2160): четыре карты ≈ 650 × 900 px стоят в верхних 55 % проёма (≈ 3400 × 1750);
   ниже — полка «ОТОБРАННЫЕ 0/4» из четырёх пустых прямоугольников ≈ 70 × 90 px и пустая полоса, в самом низу — подпись «СОЗДАНИЕ ВЕЗДЕХОДА» одной
   строкой. Доля чернил проёма ≈ 45 %; у «Разыграно» (TR65) и подиума (TR69) — ≥ 85 % по полу.
5. **Ожидание — пустое поле.** Кадр `02-waiting`: галочка Ø 40 px, две строки текста и три точки по центру пустого проёма; полка внизу с одной
   миниатюрой 70 px; статус «ЖДЁМ ОСТАЛЬНЫХ ИГРОКОВ». Самая длинная по времени стадия драфта (ждём соседей) — самая пустая.
6. **Осмотр отобранных** (`04-inspect`): одна карта по центру над пустой полкой; крошка «ДРАФТ › ОТОБРАННЫЕ › ОСМОТР» — хорошо, но стадия не показывает
   ряд отобранных рядом с осматриваемой (пришёл за сравнением — видишь одну).
7. **Покупка** (`06-purchase`): финансовая строка справа вверху («ПОКУПКА −0 · 0×3 · У ВАС 520 · ПОСЛЕ ПОКУПКИ 520») — мелкий тир на 4K; выбранная карта
   — только рамка; сумма/остаток не растут объектом; «ПРОПУСТИТЬ» (RT) без счёта «купить 0» в баре. Низ по-прежнему пуст.
8. **Карта под курсором не читается.** Подпись имени внизу — единственное чтение: ни цены с «после покупки», ни меток, ни вердикта требования
   («сейчас нельзя: Красные не правят»), ни «почему стоит взять» (теги под достижения) — у руки и «Разыграно» такое чтение есть (`consoleHandFilter`,
   досье TR60). Для драфта сервер шлёт `showUnplayableReasons` у пика (память: клиент фильтрует по `type`).
9. **Что стоит и переиспользуется:** phase-корень с зонами-слоями, hero-полёт пика в лоток, RESEARCH RISE, журней-рельс, премиум-лицо, пол TV § 23,
   `ConsoleScrollArea`, пробник витрины TR68, планировщик по измеренному боксу (TR69), пример стопок TR65.

## Правила карты (спек пинит каждое)
1. Событие, 8, без меток, 2 ПО; требование — председательство (Redux: `parliament.chairman === player`; классика — `turmoil.chairman`); причина руки
   именованная с «сейчас председатель: X» / «кресло свободно» (TR12-класс).
2. Розыгрыш → ничего, кроме ПО 2 и стопки событий; под RX42 — ПО не РТ, вето не касается; классический стол — апстрим байт-в-байт; раздача под Redux =
   ранее адаптированные + T10; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.4; решения T04 1–6 не переспрашивать)
1. **RU** — имя оставить («Народное празднование»); описание — «Требует, чтобы вы были председателем.»; лор RU — как в диагнозе 1.
2. **Знак требования = КРЕСЛО** (диагноз 2–3) — (а, рекомендовано) кресло в золотой плите MIN на лице (сокет бинарного требования; размер/краска — как
   у эмблемы партии TR15+), на чипе руки (`CHAIRMAN_EMBLEM` → кресло), в «Информация › Требования», и ТО ЖЕ кресло в зонах Парламента, где стоит бюст
   (`ConsoleInfoParliament`, `ConsoleDossierParliament`) — ОДИН знак везде; `chairman.png` остаётся только у DSL `b.chairman()` лиц апстрима вне скоупа
   (или уходит и оттуда — решение владельца); источник знака — один: `PremiumChairGlyph.PATH` + `assets/misc/chair.svg`, гард паритета; (б) только лицо
   и чип руки — Парламент оставить с бюстом — нет (два знака).
3. **Хинт плиты MIN** — `data-hint` «Требует председательства» (глоссарий: «председательство»), на чипе руки — «[кресло] · сейчас: X» / «[кресло] · кресло
   свободно» (существующие ключи).
4. **Драфт — ВИТРИНА ПАКЕТА** (диагноз 4) — (а, рекомендовано) пакет занимает проём по планировщику от ИЗМЕРЕННОГО бокса (TR69-класс): карты —
   до высоты проёма минус полка и чтение (на 4K ≈ 1000–1100 px), ряд по центру, курсор — живой объект; ПОЛКА «ОТОБРАННЫЕ» — ряд настоящих миниатюр
   (`ConsoleCardFaceLite`, ≈ 220 px на 4K) с номерами мест и подсветкой того, что прилетело последним; пустые места — слот с контуром и номером
   «2 · 3 · 4», не голый прямоугольник; (б) только увеличить карты — полка как есть.
5. **Чтение карты под курсором** (диагноз 8) — (а, рекомендовано) ЧТЕНИЕ-СТРОКА под пакетом (вместо подписи одной строкой): имя · цена → «после покупки N»
   (на стадии покупки) · метки · вердикт требования от сервера (`showUnplayableReasons` → `cardAvailability` — тот же язык, что у руки: «сейчас нельзя:
   …», «пока не выполнено», «уже не выполнить») · ПО; одна строка на TV ≥ пола, иерархия типографикой; (б) только имя + цена.
6. **Ожидание — не пусто** (диагноз 5) — (а, рекомендовано) стадия ожидания показывает ПОЛКУ крупно (что уже отобрано — лицами, крупнее, чем в пике) и
   ПЕРЕДАЧУ как объект: кому ушёл остаток / от кого придёт следующий — чипы мест с цветом и направлением (существующие `__pass*`), тихий индикатор
   «следующий пакет» на той же оси; (б) как сейчас + крупная полка.
7. **Осмотр отобранных** (диагноз 6) — осматриваемая карта как hero + ряд остальных отобранных рядом (та же грамматика, что «Разыграно» категория);
   L3/X — как есть.
8. **Покупка** (диагноз 7) — (а, рекомендовано) финансовая строка → ПЛИТА КОШЕЛЬКА под пакетом в чтении-строке: «ПОКУПКА N × 3 = −M · У ВАС A → B» с
   `ConsoleFlipValue` на изменениях; выбранная карта — печать «✓ КУПЛЕНО» на лице (как `pickband` руки), цена под лицом гаснет/зажигается; «RT
   Пропустить» → «RT Купить 0» когда ничего не выбрано (честный глагол), «A Выбрать / снять»; (б) только тир шрифта строки.
9. **Один кадр — один проём для обоих путей:** драфт (`draftVariant`) и покупка без драфта (`research-startups` — тот же `.con-draftws`) получают одно
   и то же; стадия `done` («ГОТОВО», купленные летят в док) — не трогать по существу (RESEARCH RISE), только пол и размеры.
10. **Объём** — карта + знак ≈ 25 %, драфт ≈ 75 %; Deck 1280×800 — база не растёт (растёт профиль TV / ≥ 1900); стартовый initialDraft (ConsoleTaskHost +
    лоток) — вне скоупа.

## 0. Рабочее дерево
1. `git log --oneline -1` → `1e644681ef` на выдаче. **Сначала** `ListAgents` + процессы; `SendMessage` соседу-27 (бокс) и живым соседям: твои файлы —
   `turmoil/PublicCelebrations.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `premiumCard/{premiumCardViewModel,premiumCardIcons}.ts`,
   `premiumCard/PremiumRequirementsBar.vue`, `premiumCard/PremiumChairGlyph.vue`, `assets/misc/chair.svg`, `handCards/unplayableReasonFormat.ts`,
   `ConsoleInfoParliament.vue`, `info/ConsoleDossierParliament.vue`, `components/console/draft/ConsoleDraftWorkspace.vue`, `console/draft/*`,
   `console.less` § `.con-draftws`, `console_tv.less` § драфт, `ru/{turmoil_cards,card_info,ui,console}.json`, e2e драфта, доки. Коммиты — ПО ХАНКАМ или
   явными путями; `lore_texts.json` — своя строка; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t10` → `npm run e2e:remote -- t10 <spec> [--exclusive --workers=1]`;
   кадры «до» — клиент HEAD в `.e2e-t10-before` (`TM_E2E_SHOTS_TAG=before`); exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд = спек** `tests/e2e/console-draft-showcase.spec.ts` (FUNCTIONAL; пробник витрины TR68: доля проёма · ниже пола · обрезки · ступени шрифта;
   `armFocusWitness` на пакете): профили TV (`consoleProfile=tv`, 3840×2160) + fhd + Deck 1280×800 (фит без скролла — база): (а) первый пакет 4 карты;
   (б) ожидание после пика (второй клиент по API); (в) осмотр отобранных (LT); (г) покупка: 0 выбрано → RT «Купить 0», 2 выбрано → плита кошелька,
   печать «✓ КУПЛЕНО», один POST; (д) покупка без драфта (фикстура `research-startups`); (е) Helion-оплата (стадия `pay` на полу TV); (ж) Deck — все стадии
   без скролла; (з) reduced motion.
4. Фикстуры: `public-celebrations` (Redux 2 места, p1 — председатель через `parliamentArrange` / образец спека TR12, T10 в руке, M€ ≥ 8),
   `public-celebrations-locked` (кресло у p2 → «сейчас председатель: player2»; и вариант «кресло свободно»); драфт — существующие `two-player-pre-endgame`-
   класс / `console-draft-workspace`-фикстуры.

## 1. Сервер — карта (≈ 10 %)
`PublicCelebrations.ts` — без правок правил; RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T10.png" T10` → `make:cards`), `card_info`, строка долой
+ пин. Спек: классический блок остаётся; Redux-блок — правила 1–2 (председатель → можно; кресло у соперника → причина «сейчас председатель: X»; кресло свободно
→ «кресло свободно»; розыгрыш → ПО 2, стопка; save / load).

## 2. Клиент — ЗНАК КРЕСЛА (≈ 15 %)
`chair.svg` из `PremiumChairGlyph.PATH` (гард `chairGlyphParity.spec` — путь файла = PATH компонента); `premiumCardViewModel.ts:284` → `misc/chair.svg`;
`unplayableReasonFormat.ts:69` → кресло; `ConsoleInfoParliament`, `ConsoleDossierParliament` → `<PremiumChairGlyph>`; `premiumCardIcons.ts:333` — по решению
2; хинты (решение 3). Спеки: `premiumCardViewModel.spec` § CHAIRMAN (сокет = кресло, бинарный), `unplayableReasonFormat.spec` § эмблема председательства,
`console-info-parliament.spec` / `infoDossierModel.spec` (кресло в зоне), `parliamentGlossary.spec` (слова), `premiumCardIcons.spec`; e2e `console-party-sanctions`
— хуки знака переводятся ТЕМ ЖЕ диффом (инвариант 14).

## 3. Клиент — ГЛАВНОЕ: «ВИТРИНА ПАКЕТА» (≈ 75 %)
### 3.А Кадры «до» и макеты (первым делом)
Стенд §0.3 на базе (`before`), TV первым: таблица «стадия · доля проёма · ниже пола · размер карты · размер миниатюры полки». Макеты (CSS поверх живой
сцены на Steam Machine): M1 — пакет во весь проём + полка миниатюр + чтение-строка; M2 — пакет + полка крупно справа (колонка); M3 — как M1, но полка над
пакетом (лента отбора) → батч владельцу (решения 4–8) ДО реализации.
### 3.Б Планировщик и полка (решения 4, 6, 7)
`console/draft/draftShowcaseLayout.ts` (чистый: `planDraftStage(box, cards, shelf, rem)` → размер карты, зазор, высота полки, ряд чтения; ResizeObserver
бокса — TR69-класс; Deck — база); `ConsoleDraftWorkspace.vue` — полка из `ConsoleCardFaceLite` с номерами, подсветка последнего прилёта (hero-полёт в лоток —
тот же `registerTraySlotResolver`: целью становится миниатюра, не пустой слот); стадия wait — полка крупно + передача объектом; inspect — hero + ряд.
Спеки `draftShowcaseLayout.spec` (профили × 1–4 карт × 0–4 на полке: карты ≥ 45 % высоты проёма на TV, полка ≥ 180 px на 4K, ничего за проёмом; Deck —
без скролла), `ConsoleDraftWorkspace.spec` (полка лицами; слот с номером).
### 3.В Чтение-строка и кошелёк (решения 5, 8)
`console/draft/draftReadingModel.ts` (чистый: карта → имя · цена · «после покупки» · метки · вердикт `cardAvailability` · ПО; покупка → `N × 3 = −M · A → B`);
`ConsoleFlipValue` на кошельке; печать «✓ КУПЛЕНО» на лице; глаголы бара из `consoleDraftUi` (`Buy 0` при нуле — новый EN-ключ «Buy ${0}»); спек
`draftReadingModel.spec` (вердикт — тот же язык, что рука; «после покупки» только на стадии buy; 0 выбрано → «Купить 0»).
### 3.Г Пол TV + профиль
`console_tv.less` § `.con-draftws` — весь набор новых элементов ≥ `--con-t-floor`; `@media (min-width: 1900px)` — рост размеров; Deck — не растёт.
### 3.Д e2e и регрессия
Новый спек §0.3; `console-draft-workspace` (полный флоу; хуки полки / подписи переводятся тем же диффом), `draft-finale-probe` (TIMING, `--exclusive`),
`console-research-startups`, `console-parliament-research`, `console-party-sanctions`, `tv-profile-screens` — по 2 повтора на Steam Machine; красный читать
после аннотации `build` и нагрузки.

## 4. Лицо, локаль, лор, арт
Арт T10; лор EN (ключ владельца) + RU; RU карты — диагноз 1; новые EN-ключи: «Requires the chairmanship» (хинт → «Требует председательства»), «Buy ${0}»
(«Купить ${0}»), «After the purchase» («После покупки»), «Bought» («Куплено» — печать); `grep` ключа по всем `src/locales/*/*.json` ДО добавления; RU чужих не
переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardInformation`, `requirementProse` (CHAIRMAN — «chairman»), `premiumCardViewModel` (+ § сокет-кресло), `premiumCardIcons`,
   `cardLore` (T10), `cardVictoryPointsAtPlay`, `crossPlayerCoverageGuard`, `TurmoilCardsUnderRedux` (пин 8), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`,
   `parliamentGlossary.spec`, `e2eLiveness`, `lessDeadSelectorGuard`, `glyphLiteralGuard`, `consoleTvTypeFloor`, `cursorGrammarGuard` (рэтчет).
2. Юниты §2, §3.Б–3.В; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине, последовательно.
3. e2e §3.Д; `npm run e2e:affected` + перевод задетых хуков тем же диффом.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd и Deck обязательны — три профиля на каждом кадре)
`screenshots/t10/{tv,fhd,deck}/`: (а) первый пакет ДО / ПОСЛЕ; (б) пик → полёт в полку лиц; (в) ожидание; (г) осмотр отобранных; (д) покупка 0 / 2 выбрано;
(е) покупка без драфта; (ж) лицо T10 с креслом в плите MIN + плита руки «сейчас председатель: X» + «Информация › Парламент» с креслом. Таблица «доля
проёма · ниже пола · обрезки» ДО / ПОСЛЕ по стадиям — в реестр. Каждый кадр — своим глазом с дивана: «это витрина пакета или форма со списком?»

## 7. Полировка по пути
1. Реестр: раздел **CE** «ДРАФТ И ПОКУПКА ИССЛЕДОВАНИЯ — ВИТРИНА ПАКЕТА НА 4K · ОДИН ЗНАК ПРЕДСЕДАТЕЛЬСТВА» — диагноз 2–8 строками (классы: «два знака
   одного понятия», «пустой 4K», «полка — пустые прямоугольники», «чтение одной строкой», «финансы мелким тиром»); номера — по footer.
2. Бэклог `weak-visuals-backlog` — новый пункт «драфт / покупка» → DONE с номерами.
3. Доки: `docs/CONSOLE_FOUNDATION.md` §10c — дополнение «витрина»; новый контракт `docs/claude/console/draft-showcase.md` (планировщик, полка лиц, чтение-строка,
   кошелёк, стадии, пол, гарды); `parliament-glossary.md` §4 — строка «Требование председательства на лице карты — знак КРЕСЛА в плите MIN; тот же знак — чип
   руки, Информация, зоны Парламента; бюст апстрима не используется»; закон в `.claude/rules/premium-card.md` («a binary requirement prints the ONE mark the
   console already uses for the concept — a party's emblem, the CHAIR for the chairmanship — never a second drawing»); `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`
   §4.2 — T10 «СДАНА» (8 из 22); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — стенд «до» в трёх профилях + макеты M1–M3 → батч владельцу; карта + знак — параллельно.
2. Порядок: карта + спек + строка долой → знак кресла везде + гарды → стенд `before` + макеты → (после батча) 3.Б планировщик + полка → 3.В чтение +
   кошелёк → 3.Г пол → e2e + перевод хуков → раскадровки `after` → регрессия → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву (CE) и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем кадры знака кресла на четырёх поверхностях, таблица витрины ДО / ПОСЛЕ по стадиям и профилям, макеты, результат
   регрессии, решения 1–10 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (4 с макетами, 6, 8 — рекомендация первой; 2 (судьба
   `chairman.png` у апстрим-лиц) — тоже в батч; остальное в отчёте), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Второй знак председательства (новая иконка, оверлей, «похожая» картинка); бюст и кресло рядом на одной поверхности; слово «кресло» как награда /
  «Повестка» (глоссарий, гард `BANNED`).
- `v-if`-подмена стадий драфта (зоны — слои); `1fr`-ряды в незаданной высоте; растить базу Deck; `overflow-y: auto` руками (только `ConsoleScrollArea`);
  второй источник экономики покупки (только `thisPlayer.cardCost` / ответ сервера); менять tray-мозг / RESEARCH RISE по существу; `title`-атрибут;
  литерал кнопки; текст ниже пола TV; состояние только цветом.
- Трогать стартовый initialDraft, разбор хода бота, правила карты; e2e карте (ТОЛЬКО знак в существующем `console-party-sanctions`); RU чужих ключей;
  файл соседа; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
