# Console Native UI — Premium 4K TV Iteration (программа большой итерации)

> Статус: В РЕАЛИЗАЦИИ (2026-07-17, утверждено пользователем). Выполненное — см. «СТАТУС РЕАЛИЗАЦИИ» в конце файла.
> Эталонная конфигурация приёмки: `[console-display] profile=tv scale=2 viewport=3840×2160 physical=3840×2160 dpr=1`
> (LG OLED42C34LA, геймпад, дистанция 1.5–2 м, Electron fullscreen).
> Console Native — основной интерфейс продукта; desktop заморожен. Этот документ — мастер-план
> доведения всего console-native слоя до уровня premium console 4K TV gaming.
> Визуальные доказательства: 8 скриншотов от 2026-07-17 (`C:\Users\zelin\sm_mars_sreenshots\20260717*.jpg`).

---

## 0. Краткий честный диагноз

Console Native UI **функционально зрелый** (~77 компонентов + ~76 модулей, ~50 тыс. строк, полная
маршрутизация промптов, 8 анимационных режиссёров, чистая rem-дисциплина, работающий leak-detector),
но **как TV-продукт это пока «1080p-логическая композиция, честно умноженная на 2»**, а не интерфейс,
спроектированный под 4K TV. Три системных долга + один класс дефектов:

1. **Дизайн-система объявлена, но не применяется.** Токены `--con-t-*` живут ТОЛЬКО в
   `console_tv.less`; в `console.less` — 935 рукописных `font-size`, 0 использований токенов.
   7 разных «языков фокуса», ~35 вариантов glow, 3 зелёных и 3 золотых акцента, мёртвый токен
   `--con-cta-h`, конкурирующий legacy-профиль `con-profile-large`.
2. **Пространственная модель «только сжимать».** Все fit-движки написаны из handheld-мира:
   гарантируют «влезет», но никогда «заполнит». Рука капится `baseZoom 0.72 / MAX_ZOOM 0.78`;
   fullscreen-карта — `MAX_ZOOM 2.8` в `CardZoomModal`, вообще слепом к `conUiScale()`;
   стандартные проекты — `min(53rem, 90vw)` и ноль TV-рекомпозиции; гидросеть — top-packed
   колонки с пустой нижней третью.
3. **Командный слой без модели.** `ConsoleShell.commands()` — 500-строчная if-лестница без
   приоритетов и коллапса; бухта hand dock съедает 16rem строки; единственная стратегия
   переполнения — ellipsis; ~16 поверхностей рисуют СОБСТВЕННЫЕ футеры-хинты, дублирующие бар
   «по дизайну». Отсюда «ДАЛЬНИЙ ДОСТУПН…», «ПОКО…», «ФИЛЬ…», «ЗАКР…» и двойная иерархия подсказок.
4. **Слоение без режиссуры фона.** Оверлеи не декларируют, что под ними гаснет/прячется.
   Полупрозрачная zoom-вуаль (z 11890) + top-layer `<dialog>` + оставшиеся смонтированными
   панели (played z 11500, dock z 11705, правая панель) = «протечки слоёв» со скриншотов.

Это не «сломанный UI» — это UI, который остановился на шаге «масштабировать», не дойдя до шага
«перекомпоновать». Показательно: собственный концепт (`CONSOLE_MODE_CONCEPT.md` §12) требовал
body ≥ 24 px @1080p, spotlight-выделение, «тултипов не существует», «максимум две панели контента»,
5 % safe area — реализация отстала от собственного концепта. План ниже — это возврат к концепту
плюс завершение начатых систем, а не новая философия.

---

## 1. Архитектурные причины (корни, не симптомы)

| # | Корень | Доказательство (file:line) | Что порождает |
| --- | --- | --- | --- |
| A | **Токены без принуждения.** Тип-шкала — TV-оверрайд поверх хардкодов, а не база. | `console_tv.less:59-72` (определения); grep `--con-t-*` в `console.less` = 0; 935 `font-size` в `console.less`, 94 в `console_menu.less`; floor 0.8rem нарушается в самом tv-файле (`.con-handdock__status-label .62rem` :163, `.con-award__legend-span .65rem` :143) | Мелкий текст на TV; каждая правка типографики = ручной свип; «единой системы не видно» |
| B | **Fit-движки «только сжимать», не «заполнять».** | `consoleHandGrid.ts:95` («only ever shrinks… never grows»), `:40 MAX_ZOOM 0.78`, `:96-110 baseZoom`; `CardZoomModal.vue:877-885` (chrome-константы в сырых px + `MAX_ZOOM 2.8`, нет `conUiScale`); `console.less:4796` (`.con-stdp__panel min(53rem,90vw)`); `.con-hydro__panel` top-packed (`console.less:1521-1539`) | Карты ~13 % ширины на пустом экране руки; fullscreen-карта ~23 % ширины; std-projects — «desktop-диалог»; пустая нижняя треть гидросети |
| C | **Командный слой рукописный, без приоритетов.** | `ConsoleShell.vue:2138-2618` (`commands()`), до 9 хинтов (журнал :2342-2382); бухта: `console.less:6017` (grid `50%−16rem/2`), `consoleHandDock.ts:150-153,183-204`; ellipsis только в bay: `console.less:6034-6041`; classic-бар просто клипает (:5926-5937) | Обрезания лейблов; «Базовые» вместо «Базовые действия» уже руками (:2609-2613); нет сворачивания вторичных команд |
| D | **~16 локальных футеров-хинтов дублируют бар «по дизайну».** | `ConsoleStdProjectsScreen.vue:63-69`, `ConsoleQuickSelector.vue:29-31`, `ConsoleJournalPanel.vue:16-45`, `ConsoleTaskHost.vue:320-325`, `ConsoleGovernmentSupport.vue:66-73`, `ConsoleMaScreen.vue:113-135`, `ConsoleInfoMode.vue:218-234`, `ConsoleSheet.vue:31-35` (расходится с баром!), confirm-ы, композеры | Двойная/противоречивая иерархия подсказок; лишний вертикальный расход; расхождения (Sheet показывает не то, что бар) |
| E | **Монолит ConsoleShell (5 631 строка)** владеет state-machine + всеми gating-computed + commands() + submit-хендлерами. | `ConsoleShell.vue` весь; секции/оверлеи/зум/полёты/wf-host в одном файле | Высокая цена любой правки поверхности → точечные заплатки вместо системных решений; дрейф (см. H) |
| F | **Слоение без режиссуры фона.** Нет понятия backdrop-tier / suspend-списка. | Вуаль полупрозрачна: `console_card_deal.less:227-251`; played (11500) и dock (11705) остаются под top-layer dialog; std-projects/центр-модалки не гасят правую панель (нет opaque-ступени) | «Протечки слоёв» (скриншоты 1, 5, 6): рука/HUD/оверлеи просвечивают под fullscreen и модалками |
| G | **Дублирование вместо шаренных примитивов.** | 6+ confirm-поверхностей (`.con-confirm`, PlayCard, Trade, Ma, Hydro, CorpFirst + native dialog); 9+ карточных раскладок; 8 flight-триплетов «по конвенции»; 2 focus-frame (один мёртвый: `useConsoleFocusFrame.ts:12-15`); 7 языков фокуса; глиф-система одна, но лейблы хинтов рукописные | Разные визуальные языки одного смысла; каждая новая поверхность = новая копия |
| H | **Нет guard-а «новый con-класс обязан иметь TV-решение».** | §11 `console_tv.less:269-275` стилизует legacy `.con-sheet`, а актуальный `.con-stdp` (P27-реворк) БЕЗ TV-блока; ~55 из 83 `zoom:`-сайтов не умножены на `--con-ui-scale` | Дрейф после реворков; экраны «выпадают» из TV-пасса молча |
| I | **Десктопные вкрапления через `zoom:`** тянут px-геометрию, Orbitron, hover-affordances. | 48 ссылок на `.pcard/.card-container/.benefit-glyph/.tag-count` в `console.less`; интеграционный список `scripts/console-tv-zoom-scale.mjs:21-51` (30 сайтов покрыто) | Неоднородная резкость/масштаб ассетов; «старые жетоны рядом с новым вектором» |
| J | **Fallback-хвост не нативен.** | `consoleLeakDetector.ts:109-118` + `console_tv.less:530-542`: mandatory-input-modal (composite `and`, Turmoil/Underworld/aresGlobal), `.eg-results`, `.fsr`, `.rematch-modal`, desktop-update — все на `zoom: var(--con-ui-scale)` | Целые состояния игры выглядят «другим продуктом» на TV |

---

## 2. Карта проблем: скриншот → корень → система

| Скриншот | Симптом (видимый) | Корень (file:line) | Класс |
| --- | --- | --- | --- |
| S1 fullscreen-карта | Карта ~23 % ширины; вокруг пусто; аннотация-каллаут «При розыгрыше…» микротекстом (выглядит как debug); под модалкой просвечивает «РАЗЫГРА…» и hand dock; правая панель яркая | `CardZoomModal.vue:877-885` (TV-слепой fit, cap 2.8); каллауты `CardAnnotationsLayer` (desktop-инструмент) вместо TV-инфопанели; вуаль `console_card_deal.less:227-251` + played/dock смонтированы | P0 слои + P1 пространство |
| S2 board home | 7 хинтов в баре; правая панель плотная, тонкие прогресс-линии; мелкие подписи дуг | `commands()` :2604-2617; `.con-inspector`/дашборд базовые размеры + `.con-award__legend-span .475rem→.65rem` (`console.less:5231`, `console_tv.less:143`) — ниже floor | P1 читаемость |
| S3 колонии | Масштаб тайлов приемлем, но низ пустой; статусы мелкие; растровые жетоны разной выделки | cap `MAX_TILE_SCALE 1.8` (`ConsoleColoniesSection.vue:116`) + typography-only TV §14; ассеты | P1/P2 |
| S4 гидросеть | Обрезан командный бар («ДАЛЬНИЙ ДОСТУПН…», «УКРЕПИ…», «ПОДРОБНОС…», «НА ПО…»); реквизиты — микро-чипы с ✗; нижняя половина панели пустая; fine-print гидросети .625–.675rem доезжает до TV | bay-ellipsis `console.less:6034-6041` + 6 хинтов :2557-2580; `.con-hydro__panel` top-packed :1521-1539; `req-tag 1.35rem` :1672; базовые мелкие шрифты :1690-2185; TV §13 — typography-only | P0 обрезания + P1 композиция |
| S5 action wheel | Все слоты продублированы в баре + «Закрыть» ×3 (слот-фут + бар + подпись); тайлы невзрачные; фон (правая панель) читаем | `ConsoleQuickSelector.vue:17,29-31` + `commands()` :2427-2437; нет opaque-ступени фона | P0 дубли + P1 подача |
| S6 std projects | Модалка ~55 % ширины, desktop-диалоговая плотность; свои хинты в футере + те же в баре; фон просвечивает | `.con-stdp__panel min(53rem,90vw)` (`console.less:4796`); нет `.con-stdp` в `console_tv.less` (дрейф §11 → `.con-sheet`); `ConsoleStdProjectsScreen.vue:63-69` дублирует бар | P0 дубли + P1 workspace |
| S7 журнал | 9 хинтов → «РЕ…/ПОКО…/ФИЛЬ…/ЗАКР…»; названия карт в фиде обрезаны («Офис на Зе…», «Горнопром…»); чипы 18 px; локальные контролы дублируют бар | `commands()` :2342-2382 + bay-ellipsis; `.con-journal width min(37rem,34vw)` + chips 0.9rem (`console_tv.less:340-350`); `ConsoleJournalPanel.vue:16-45` | P0 обрезания |
| S8 рука | 4 карты ~13 % ширины по центру пустого поля; выбранность невыразительна; причина недоступности обрезана прямо на карте («Нужна м…»); фильтры-чипы мелкие | `consoleHandGrid.ts:40,95-110` (never-grow, cap 0.78×s); причина-пилюля без переноса; верхние чипы базовых размеров | P0 обрезание + P1 галерея |

Дополнительно подтверждено кодом (не видно на скриншотах): расхождение хинтов `ConsoleSheet` с баром;
клавиатурный режим показывает Xbox-глифы (`glyphSets.ts:55-58` — один сет); `useConsoleFocusFrame`
мёртв; профиль `large` конфликтует с `tv` (`consoleLayoutProfile.ts:50,137`).

---

## 3. Целевая модель Console Native UI

### 3.1 Пять классов поверхностей (и их контракт с фоном)

Каждая поверхность регистрируется в новом реестре **`consoleSurfaceModel.ts`** и декларирует:
`kind`, `backdrop: 'none' | 'dim' | 'opaque'`, `suspends: [...]` (какие персистентные элементы
скрыть: hand dock, played, journal, правая панель), `commands: CommandSet` (см. 3.2).

1. **BOARD (дом).** Единственная персистентная сцена: статус-полоса, левый рельс, борд, правая
   контекст-панель, dock+бар. Ничего поверх, кроме TRANSIENT.
2. **WORKSPACE (секции-мастерские).** Рука, Колонии, Гидросеть, Std Projects, MA-дашборд,
   Action Center, Info Mode, Журнал (правая колонна). Полноэкранные РАБОЧИЕ режимы, а не модалки:
   свой заголовок-строка, контент ЗАПОЛНЯЕТ отведённое пространство (fill-движки), `backdrop:
   'opaque'` по отношению к борду (борд не просвечивает и не отвлекает). Std Projects переезжает
   из класса «модалка» в этот класс.
3. **TASK / COMPOSER (решение).** Mandatory-промпты (TaskHost, GovSupport, ProductionLoss),
   композеры (PlayCard, Action, Trade, CorpFirst, MaConfirm, HydroConfirm). Центрированная сцена
   на едином каркасе **`ConsoleDecisionFrame`** (источник → шаги/выбор → итог → CTA),
   `backdrop: 'dim-strong'` (фон нечитаем — только силуэты), `suspends: [dock?, played, journal]`.
4. **STAGE / THEATER (театр).** Fullscreen-карта, Reveal, церемонии, Bot review, deal/rise-сцены.
   Герой ≥ доминирует; `backdrop: 'dim-strong'` + suspends ВСЁ несущественное (dock, played,
   правая панель). Fullscreen-карта получает TV-fit + правую **панель правил** из
   `metadata.information` (фундамент уже собран — это и есть его «right-hand info panel»).
5. **TRANSIENT.** Тосты/баннеры/дельта-чипы; никогда не перекрывают героя; serial-очередь
   (presentation flow уже есть).

Zoom-протечка закрывается контрактом: STAGE-поверхность при открытии переводит suspends-цели в
`visibility: hidden`/парковку (не unmount — состояние живёт), а вуаль получает `opaque`-ступень.

### 3.2 Единая контроллерная модель хинтов (`consoleCommandModel.ts`)

- Поверхность публикует **`CommandSet`**: `primary: Command[]` (макс. 4: A/B/X/Y-класс),
  `secondary: Command[]` (триггеры/стики/бамперы), `nav: NavHint` (одна навигационная подсказка).
  Бар рендерит по бюджету ширины (bay-aware: модель ЗНАЕТ про бухту dock и меряет реальные
  ширины лейблов), лишние `secondary` СВОРАЧИВАЮТСЯ в слот «≡ Ещё» (страница команд по Menu),
  **ellipsis для хинтов запрещается** (CSS-правило удаляется; переполнение = дроп по приоритету).
- **Правило одного места:** подсказка живёт ЛИБО на объекте (глиф на блоке — паттерн
  `ConsoleContextPanel` LB/RB), ЛИБО в баре. Локальные футеры (`__foot`/`__hints`) удаляются во
  всех ~16 местах; исключения — только полноэкранные STAGE, целиком закрывающие бар (Info Mode,
  Bot review, fullscreen-карта), и они переходят на ТОТ ЖЕ `ConsoleCommandBar` (single renderer),
  а не на самодельную разметку. Dev-guard: grep-тест на `__foot-item`/локальные `gp-glyph`-ряды
  вне разрешённого списка.
- `commands()` из ConsoleShell распиливается: каждая поверхность отдаёт свой `CommandSet` из
  своего модуля (готовые `*Ui.ts`-зеркала уже есть — это их расширение), Shell только собирает.
- Журнал (worst case, 9 хинтов) пересобирается по модели: primary = A Подробнее/Свернуть,
  X Осмотреть, B Закрыть; всё остальное (режим, поколение, фильтр, показать-на-карте) — в
  «≡ Ещё» либо на объекте (chip «ПОКАЗАТЬ» уже на строке — правильный паттерн, оставить).

### 3.3 Единые состояния (семантические токены + один миксин)

`console.less` получает семантический слой:

```less
@sem-focus:      @con-cyan;   // фокус (единственный цвет фокуса)
@sem-go:         @con-mint;   // выбран/доступно/подтверждение
@sem-warn:       @con-amber;  // soft-блок, режим продажи, «не сейчас»
@sem-danger:     @con-red;    // rules-блок, ошибки, атаки
@sem-prestige:   @con-ma-gold;// достижения/награды/финал
@sem-idle:       steel;       // выключено/фон
```

и **один миксин `.con-focus(@state)`** (ring `var(--con-ring-w)` + glow `var(--con-glow)`,
цвет по состоянию). Миграция ~40 `--focused`-состояний и ~35 glow-вариантов на миксин.
`@con-hydro-mint/@con-hydro-gold/@con-plants`-дубликаты становятся алиасами семантики.
Правила состояний (везде одинаково): focus = cyan ring+glow; selected = mint ring + чек;
available idle = mint hairline/точка; rules-block = red rim + причина СТРОКОЙ (не только цвет);
soft-block = amber; activated = синий; disabled = steel + причина. Spotlight (scale 1.03–1.05 +
пригашение соседей) — стандарт для карточных поверхностей (уже есть в руке/браузере — закрепить
как правило).

### 3.4 Типографика 10-foot (floor как закон)

- Токены `--con-t-*` переезжают в БАЗУ (`console.less`, `:root`-scope console-native) со значениями
  = текущим базовым (не-TV профили байт-идентичны), TV переопределяет только значения токенов.
  ~150 per-selector рестейтментов из `console_tv.less` постепенно удаляются.
- **Floor = 0.8rem (16 логич. px) для ЛЮБОГО текста, 1rem+ для интерактивного** — enforcement
  двойной: (а) грep-guard по `console*.less` на `font-size < 0.8rem` вне handheld-блоков/keep-px;
  (б) e2e-скан computed styles на скриншот-матрице (порог 16×scale физ. px). Известные нарушители
  чинятся: гидросеть fine-print (:1690-2185), award-legend (:5231/tv:143), notif type (:2407),
  MA racer-crown, dock-подписи (tv:163-165).
- Letter-spacing/uppercase «гравировка» сохраняется как язык, но запрещается ниже `--con-t-caption`.

### 3.5 Пространственные бюджеты TV (per-screen targets)

| Экран | Сейчас | Цель (TV) | Механика |
| --- | --- | --- | --- |
| Fullscreen-карта | высота ~60 % (cap 2.8), ширина 23 % | высота **86–88 vh**; справа панель правил (`metadata.information`), слева — источник/статус | `fitCardToViewport` становится TV-aware (chrome×`conUiScale`, cap → ~4.2 или формульный), правая панель забирает пустующую ширину |
| Рука | карта ≤ 33 % высоты, never-grow | при ≤ 8 картах карта ~**52–56 % высоты**; spotlight на фокусе; причины НЕ на карте, а в нижней статус-строке с переносом | fill-pass в `consoleHandGrid`: `zoom = min(fitW, fitH, comfortCap(count))`, TV-потолки отдельными константами ×s |
| Std Projects | модалка 53rem (~55 % ширины) | WORKSPACE: ≥ 85 % рабочей ширины, крупные строки-тайлы (высота ≥ `--con-hit-min`), 2×4 | новый `.con-stdp` TV-блок + перевод в workspace-класс |
| Гидросеть | пустая нижняя треть, микро-чипы | вертикальное распределение: трек / деталь / CTA-зона; требования — крупная сетка иконка+число+статус; «пропущенные награды» — свёрнутый блок | рекомпозиция `.con-hydro__panel` (grid-rows, контент растёт), req-tag ≥ 2rem |
| Журнал | 37rem, чипы 18 px, обрезания имён | ~44rem, body ≥ `--con-t-secondary`, имена карт с переносом (никогда ellipsis у токенов) | `.con-journal` TV-блок + фикс чип-стилей |
| Колонии | ок по масштабу, пустой низ, мелкие статусы | статус-строка ≥ caption; либо cap 1.8 → 2.0, либо нижняя инфо-полоса (сводка флотов/торгов) | малые правки + композиционное заполнение |
| Board home | правая панель плотная | дашборд: прогресс-полосы толще, legend ≥ floor, hero-значения `--con-t-section` | правки `.con-home/.con-award/.con-inspector` |
| Action wheel | дубли, плоские тайлы | фон `dim-strong`; тайлы крупнее с иконой+стоимостью; хинты ТОЛЬКО на слотах (направление) + B в баре — без третьего «Закрыть» | рестайл `.con-quick` + командная модель |

### 3.6 Ассеты

Единый уровень выделки: (а) инвентаризация растровых жетонов, попадающих в console (мегакредит,
животные, планеты, ресурсы) → замена на @2x/векторные версии или перегенерация в едином стиле;
(б) арт карт: fullscreen-пустота процедурного fallback получает выразительную тематическую
подложку (не пустой «TM»-медальон на полэкрана); (в) правило: новый ассет в console — минимум
2× плотность под scale 2.

---

## 4. Полная карта экранов (класс → статус → работа)

WORK-коды: **T** = типографика/токены, **C** = композиция/пространство, **H** = хинты (снять дубли,
командная модель), **B** = backdrop/suspends, **S** = состояния (фокус-миксин), **N** = нативизация.

| Экран / состояние | Компонент | Новый класс | Работа |
| --- | --- | --- | --- |
| Board home | `ConsoleBoardSection` + `ConsoleContextPanel` + `ConsoleStatusStrip` + `ConsoleResourcePanel` | BOARD | T, S, H (бюджет 7 хинтов) |
| Осмотр клетки / шкал | `ConsoleContextPanel` (режимы) | BOARD | T |
| Размещение тайла | headless select-space + панель | BOARD | T (готово в остальном) |
| Рука / select / sale / play-from-hand | `ConsoleHandSection` + `consoleHandGrid` | WORKSPACE | **C (fill-pass)**, T, S, H |
| Fullscreen-карта | `CardZoomModal` (`.con-zoom`) + `consoleCardZoom/consoleZoomMotion` | STAGE | **C (TV-fit + панель правил)**, B (suspends), H (бар вместо своей плашки) |
| «Разыграно» + события | `ConsolePlayedOverlay` (+piles) | WORKSPACE (bottom) | B (парковка под zoom), T |
| Std Projects (+продажа патентов) | `ConsoleStdProjectsScreen` | WORKSPACE (был модалкой) | **C**, H (снять футер), B |
| MA-дашборд / confirm / inspect | `ConsoleMaScreen` / `ConsoleMaConfirm` / `ConsoleMaInspect` | WORKSPACE / TASK | H, T, S |
| Колонии: грид / инспект / трейд | `ConsoleColoniesSection` / `ConsoleColonyInspect` / `ConsoleColonyTradeConfirm` | WORKSPACE / TASK | T, C (низ), S (трейд-фокус amber → системный) |
| Гидросеть + confirm | `ConsoleHydroSection` / `ConsoleHydroConfirm` | WORKSPACE / TASK | **C**, T (fine-print), палитра → семантика |
| Журнал | `ConsoleJournalPanel` | WORKSPACE (side) | **H (9→4+Ещё)**, T, обрезания токенов |
| Info Mode (Y) | `ConsoleInfoMode` | WORKSPACE | H (бар вместо футера), T |
| Action Center + композер | `ConsoleCardActions` / `ConsoleActionComposer` | WORKSPACE / TASK | H, DecisionFrame |
| Play-card композер | `ConsolePlayCardConfirm` | TASK | DecisionFrame, H |
| Corp first action | `ConsoleCorpFirstActionConfirm` | TASK | DecisionFrame |
| TaskHost (choice/player/amount/resource/payment/distribute/cardSelect) | `ConsoleTaskHost` | TASK | DecisionFrame-каркас, T, B |
| Government Support (WGT) | `ConsoleGovernmentSupport` | TASK | H (футер), T |
| Production Loss | `ConsoleProductionLoss` | TASK | H, T |
| Pass/convert confirm | inline `.con-confirm` | TASK | DecisionFrame-lite |
| Quick wheel RT/LT | `ConsoleQuickSelector` | оверлей BOARD | H (дубли), B (dim-strong), рестайл |
| Reveal (drawn/deck-check/чужие) | `ConsoleRevealOverlay` | STAGE | эталон уже; выровнять по токенам |
| Start scene / initial draft | `ConsoleStartScene` | STAGE | T, S |
| Draft tray / rise | `ConsoleDraftTray` + режиссёры | TRANSIENT/STAGE | T |
| Церемонии (терраформинг/MA) | `ConsoleTerraformingCeremony` / `ConsoleMaCeremony` | STAGE | ок; токены |
| Bot-турн: тост + review | `ConsoleNotificationCard` / `ConsoleBotTurnReview` | TRANSIENT / STAGE | H (второй бар → общий), T |
| Тосты/баннеры/deferred-чип | `.con-banner*`, `ConsoleNotificationCard` | TRANSIENT | T |
| Stranded guard | `ConsoleStrandedPrompt` | TASK | T |
| System menu / quit | `ConsoleSystemMenu` / `ConsoleConfirmDialog` | TASK | T, S |
| Pre-game: меню/создание/опции/профиль/клавиатура | `menu/*` (`.cm-*`) | отдельная семья | T, S (после in-game) |
| Endgame / FSR / Rematch | desktop `.eg-results/.fsr/.rematch-modal` (zoom) | fallback | этап 5: TV-пасс поверх zoom; полная нативизация — отдельная программа |
| Composite `and` / Turmoil / Underworld / aresGlobal | desktop MandatoryInputModal / stranded | fallback | этап 5: `composite` → нативный DecisionFrame; остальное — по мере экспансий |

---

## 5. Roadmap (этапы, порядок, критерии этапа)

### Этап 0 — Фундамент дизайн-системы (без визуальных изменений вне TV)
1. **F1 Токены в базу**: `--con-t-*`, `--con-ring-w`, `--con-glow`, `--con-hit-min`, `--con-cta-h`
   (оживить или удалить) переезжают в `console.less`; TV переопределяет только значения.
   Инструмент: скрипт-миграция + денормализованный CSS-дифф (byte-identical для
   handheld/standard) — та же методика, что при rem-конверсии.
2. **F2 `.con-focus()` миксин + семантические алиасы цветов**; миграция фокус-состояний свипом.
3. **F3 `consoleCommandModel.ts`**: CommandSet, бюджет ширины (bay-aware, измерение лейблов),
   приоритетный дроп + слот «≡ Ещё», запрет ellipsis; `commands()` распилен на поверхности
   (расширение существующих `*Ui.ts`). Dev-guard на локальные футеры.
4. **F4 `consoleSurfaceModel.ts`**: backdrop-tiers (`dim`/`dim-strong`/`opaque`) + suspends;
   фикс zoom-протечки (парковка played/dock под STAGE); opaque-ступень вуали.
5. **F5 Профили**: `con-profile-large` → алиас/ретайр; аудит остальных ~55 `zoom:`-сайтов
   на `--con-ui-scale`; `.con-stdp`-класс включается в tv-покрытие; guard «новый `.con-*`
   корень без TV-блока = предупреждение» (скрипт-линт по `console.less` diff).

### Этап 1 — Референсные экраны (обкатка всей системы на трёх поверхностях)
1. **R1 Рука** — fill-движок, spotlight, причины с переносом, фильтры-чипы TV-размера.
2. **R2 Fullscreen-карта** — TV-fit, панель правил из `metadata.information`, suspends фона,
   бар-хинты вместо собственной плашки.
3. **R3 Командный бар на новой модели** в худших состояниях (board home / журнал / гидросеть) —
   ноль обрезаний, «Ещё»-слот работает.
   Эти три — эталоны приёмки; скриншот-матрица расширяется, ручная проверка на LG C3.

### Этап 2 — Workspace-экраны
Std Projects (модалка → workspace), Гидросеть (рекомпозиция панели + палитра), MA-дашборд,
Action Center, Журнал (хинты + типографика + обрезания), Колонии (низ/статусы), Info Mode,
board-home правая панель.

### Этап 3 — Task/Composer унификация
`ConsoleDecisionFrame` (каркас: источник → контент → итог → CTA + единый футер-слот бара);
миграция 6 confirm-ов и TaskHost; contextual-подача (kicker из `consoleTaskSummary` уже есть).

### Этап 4 — Сцены и полиш
Quick wheel рестайл + фон; Bot review на общий бар; церемонии/deal/reveal — токен-свип;
motion-полиш (OLED-restraint: glow только на фокусе — уже правило в tv §21, распространить).

### Этап 5 — Fallback-хвост
`composite (and)` → нативный DecisionFrame-композит; endgame/FSR/rematch — TV-рекомпозиция
поверх zoom-интеграции (полная нативизация endgame — отдельная следующая программа);
клавиатурные глифы (сет для keyboard в `glyphSets` — низкий приоритет).

### Этап 6 — Ассеты
Жетоны/иконки @2x-унификация; fullscreen-fallback-арт; правило плотности для новых ассетов.

Порядок жёсткий: **0 → 1 → 2/3 (параллельно можно) → 4 → 5 → 6**. Ничего из этапов 2+ не
начинается до принятия референсов этапа 1 — иначе повторится «точечный тюнинг».

---

## 6. Затрагиваемые системы и файлы (сводно)

**Новые модули:** `src/client/console/consoleCommandModel.ts`, `src/client/console/consoleSurfaceModel.ts`,
`src/client/components/console/foundation/ConsoleDecisionFrame.vue`, скрипт-guard TV-покрытия.

**Ядро правок:**
- Стили: `console.less` (токены-в-базу, миксин, семантика, per-screen), `console_tv.less`
  (сжатие в «engine + бюджеты»), `console_menu.less`, 10 экранных `console_*.less`.
- Shell: `ConsoleShell.vue` (распил commands()/gating — поэтапно, НЕ big-bang), `ConsoleCommandBar.vue`,
  `ConsoleHandDock.vue`/`consoleHandDock.ts` (бюджет бухты).
- Fit-движки: `consoleHandGrid.ts`, `ConsoleColoniesSection.vue`, `ConsoleTaskHost.vue`,
  `CardZoomModal.vue` (TV-ветка fit; общий с desktop — менять флагом/props, desktop не трогать),
  `consoleZoomMotion.ts`.
- Экраны: `ConsoleStdProjectsScreen.vue`, `ConsoleHydroSection.vue`, `ConsoleJournalPanel.vue`,
  `ConsoleMaScreen.vue`, `ConsoleCardActions.vue`, `ConsoleInfoMode.vue`, `ConsoleQuickSelector.vue`,
  композеры/confirm-ы (6), `ConsolePlayedOverlay.vue` (парковка), `ConsoleGovernmentSupport.vue`,
  `ConsoleProductionLoss.vue`, `ConsoleSheet.vue` (ретайр в пользу stdp-класса или выравнивание).
- Инфраструктура: `consoleLayoutProfile.ts` (large→tv), `consoleLeakDetector.ts` (suspends-осведомлённость),
  `glyphSets.ts` (этап 5), `scripts/console-tv-zoom-scale.mjs` (расширение списка), e2e
  `tests/e2e/tv-profile-screens.spec.ts` (+новые сцены, +скан шрифтов/обрезаний).
- Правила карт для fullscreen-панели: потребление `metadata.information` (уже сгенерировано).

**Не трогаем:** серверные контракты, `turnIntents/taskResponses` (byte-parity), режиссёры полётов
(кроме токенов), десктопный слой (заморожен), `gamepadPollModel/gamepadCore`.

---

## 7. Риски и способы их снять

1. **Регресс handheld/standard/large.** Все правки этапа 0 — value-neutral: денормализованный
   CSS-дифф обязан быть пустым для не-TV профилей; e2e-матрица уже содержит deck-handheld и
   standard-1080 пресеты — прогонять на каждом этапе.
2. **ConsoleShell-распил.** Не big-bang: сначала выносится ТОЛЬКО `commands()` (чистая функция),
   state-machine остаётся; gating-computed мигрируют по одному экрану. Каждый шаг — build +
   существующие console-спеки зелёные.
3. **`CardZoomModal` общий с desktop.** TV-fit — консольная ветка (props/флаг от `.con-zoom`),
   desktop-путь байт-неизменен; guard — существующие client-спеки зума.
4. **Снятие локальных футеров меняет вид многих экранов разом.** Делать по-экранно со
   скриншот-сверкой; «Ещё»-слот обязателен ДО удаления, иначе потеря discoverability.
5. **Бюджет хинтов может обеднить управление.** Критерий: каждое действие остаётся достижимо
   (напрямую или через «Ещё»), проверка чеклистом по каждому состоянию из карты C-агента.
6. **Длинные русские лейблы.** Модель меряет реальные ширины (canvas measure/таблица) — не
   допущения; тест на самых длинных ключах.
7. **4K-арт.** Поднятие fullscreen-зума до ~4.2 обнажит мыльность части арта (130 реальных артов,
   ~512px?) — смотреть на реальной панели; при необходимости — cap по резкости для растровых
   артов + upscale-пайплайн (этап 6).
8. **OLED/перф.** Больше крупных вуалей/глоу: только transform/opacity, glow только на фокусе,
   без `backdrop-filter` (уже конвенция); rAF-каденс через существующий frame gate; longtask-бюджет
   в e2e-прогоне.
9. **Дрейф после итерации.** Guard «нового con-класса без TV-блока» + floor-грep + футер-грep
   делают регресс структурно видимым, а не вопросом внимательности.

---

## 8. Критерии готовности (приёмка, измеримо)

1. **Типографика:** на эталонной конфигурации ни один видимый текст < 16 логич. px
   (e2e-скан computed font-size по всем экранам матрицы); интерактивные лейблы ≥ 20 логич. px.
2. **Обрезания:** ноль ellipsis/клипа в командном баре во ВСЕХ состояниях матрицы (проверка
   scrollWidth ≤ clientWidth + запрет text-overflow в баре); ноль обрезанных названий карт в
   журнале; причины недоступности в руке всегда полнотекстовые.
3. **Один источник хинтов:** grep-guard на локальные футеры зелёный; на каждом экране матрицы
   одно и то же действие не подсказывается дважды.
4. **Состояния:** focus/selected/available/disabled/warning/error визуально идентичны по языку на
   ≥ 12 поверхностях (скриншот-матрица состояний); фокус различим с 2 м на реальной панели.
5. **Пространство:** рука ≤ 8 карт — карта ≥ 50 % высоты вьюпорта; fullscreen-карта ≥ 82 % высоты
   + панель правил; std projects ≥ 85 % рабочей ширины; пустая зона деталь-панели гидросети ≤ 15 %.
6. **Слои:** под TASK/STAGE фоновые панели не читаемы (dim-strong), played/dock скрыты под
   fullscreen (e2e-assert видимости); ни одного «просвечивающего» элемента на матрице.
7. **Регресс:** handheld/standard байт-идентичны по CSS на этапах 0–1; все существующие console-guards
   зелёные; `npm run build` / `lint:client` зелёные.
8. **Матрица:** `tv-profile-screens.spec.ts` покрывает все 8 сценариев исходных скриншотов + новые
   состояния (журнал открыт, wheel, композеры, task, reveal); скриншоты пересняты и приняты.
9. **Ручная приёмка на LG C3 (обязательна):** чеклист «с дивана» — каждый экран: читаемость,
   фокус, отсутствие наложений, отклик; длинные ru-строки; 30-минутная полная партия с ботом
   без единого взгляда «в упор».
10. **Перф:** прогон матрицы без новых long tasks; анимации transform/opacity-only (guard).

---

## Приложение: сводка аудиторских фактов (для навигации при реализации)

- Хинты: `ConsoleShell.commands()` :2138-2618; bay-механика `console.less:6015-6043`,
  `consoleHandDock.ts:150-204`; полный список локальных футеров — см. §1.D.
- Масштаб: `consoleHandGrid.ts` (28-40, 95-110, 125-152); `CardZoomModal.vue:833-886`;
  `.con-stdp` `console.less:4796-4940`; `.con-hydro` :1266-2200; колонии
  `ConsoleColoniesSection.vue:115-128,219-236`; борд `ConsoleBoardSection.vue:67-115` (ок).
- Токены/фокус/палитры: `console_tv.less:59-72,480-491`; `console.less:18-31` (+2220 ma-gold,
  1266-1268 hydro); 935 font-size; 563 box-shadow; 16 keep-px.
- Слои: z-карта — 11480 task-слот / 11500 sheets+played / 11520 reveal / 11560 info / 11700 бар /
  11890 вуаль / 11900 flight+stranded / 12000 desktop-fallback / top-layer dialogs.
- Fallback: `consoleLeakDetector.ts:109-118`; `console_tv.less §24`.
- Роутинг: `consoleTaskRouter.ts` TaskKind-таблица; NATIVE/SHELL/SCENE-сеты :79-108.

---

# СТАТУС РЕАЛИЗАЦИИ (обновляется по ходу итерации)

## Выполнено (итерация 1, 2026-07-17)

**Этап 0 — фундамент:**
- Токены `--con-t-*`/`--con-hit-min`/`--con-cta-h`/`--con-focus-ring`/`--con-glow-r` определены в БАЗЕ
  (`console.less`, scope `html.console-native`; TV переопределяет только значения). Семантические
  алиасы `@sem-focus/go/warn/danger/prestige/idle` + миксины `.con-focus()`/`.con-focus-outer()`
  + `.con-backdrop-dim-strong()`.
- `.con-backdrop-dim()` переведён на CSS-переменные (`--con-dim-a/b`) → TV усиливает ВСЕ
  бэкдропы до dim-strong одной строкой (не-TV профили рендерятся байт-идентично).
- **`consoleCommandModel.ts`** — приоритетный ДРОП целых команд вместо ellipsis
  (`planCommandRun`; A/B никогда не дропаются); интегрирован в `ConsoleCommandBar` (bay-режим);
  `ConsoleCommand.priority`. Юнит-спек `consoleCommandModel.spec.ts`.
- **`commands()` в ConsoleShell переписан на минимальные наборы** (правило «подсказка на объекте
  ИЛИ в баре»): quick wheel → только `B Закрыть`; std projects → только `B` (Ⓐ на строках);
  журнал 9 → 3-4 (LB/RB/LT/RT/R3 живут на контролах панели); dpad-«Навигация» снята со
  списочных поверхностей; `Farthest available` → короткий ключ `Farthest stage` («К дальнему»);
  hydro Bonus — условный; Y-Information оставлен только на board home / draft / inspect-режимах.
- **~13 локальных футеров-хинтов удалены** (StdProjects, Quick foot, MaScreen, MaInspect,
  MaConfirm, HydroConfirm, Sheet, Journal close-чипы + filter-popover, NotificationCard B-часть,
  CardActions, ActionComposer, Hydro help); **контекстные панели публикуют живой контракт через
  новый `consolePanelUi.ts`** (TaskHost / GovSupport / ProductionLoss / InfoMode / CardActions /
  ActionComposer) — бар остаётся единственным рендером. У InfoMode появилась своя ветка в
  commandContext/commands (раньше под ним показывались хинты нижележащего состояния — баг).
- **Режиссура фона:** `body.con-zoom-open` паркует (`visibility`) played/dock/draft-tray/journal
  под fullscreen-картой; zoom-вуаль поднята до dim-strong на всех профилях (класс «протечек» закрыт).

**Этап 1 — референсные экраны:**
- **Рука:** fill-pass в `consoleHandGrid.planHandGrid` (TV: не-скроллящая рука РАСТЁТ в
  освобождённую сцену; `TV_FILL_MAX_ZOOM=3.2`, соло-карта ≤72 % высоты; s=1 байт-идентично);
  blocker-чип на карте — перенос вместо ellipsis + адаптивный counter-zoom
  (`0.99/var(--con-hand-zoom)`, TV 1.2).
- **Fullscreen-карта:** `fitCardToViewport` стал TV-aware (chrome×`conUiScale`, cap
  `2.8×uiScale` → карта ~85 % высоты; гейт `consoleMotion` — desktop байт-иденичен);
  **правая панель правил** `ConsoleCardRulesPanel.vue` (проекция `metadata.information` через
  `annotationModel`; слот `#side` в CardZoomModal + резерв ширины в fit; плавающие каллауты
  подавляются `annotationsSuppressed` — «одно место для деталей»).

**Этап 2 (первая волна):**
- `.con-stdp` получил TV-workspace блок (панель `min(84rem, 94vw)`, hit-min строки, couch-типографика)
  — закрыт дрейф «§11 стилизует legacy .con-sheet».
- Гидросеть: floor-фиксы fine-print (.6–.675rem → 0.8rem), req-чипы 2.1rem, CTA-зона прижата к
  низу колонки (`margin-top: auto`), hit-min CTA.
- Журнал: 37→44rem, типографика поднята, **имена карт в фиде переносятся, не обрезаются**;
  notification-layer clearance обновлён.
- Колонии: `MAX_TILE_SCALE` 1.8→2.0; статусы floor.
- Quick wheel: крупные плиты/иконки/лейблы, disabled-reason ≥ floor; dim-strong фон (через vars).
- §21 фокус-свип расширен с 7 до ~25 поверхностей (единое TV-кольцо `--con-focus-ring` +
  `--con-glow-r`; компаунд-состояния сохраняют семантические цвета).
- Floor-фиксы: award-legend, dock-подписи, MA racer-crown/statuschip/vpchip, hydro fine-print —
  всё ≥ `--con-t-floor`; **guard-спек `consoleTvTypeFloor.spec.ts`** (в console_tv.less запрещён
  font-size < 0.8rem).

## Зафиксированные БУДУЩИЕ задачи (не блокируют итерацию; по указанию пользователя desktop-fallback не переделываем сейчас)
1. **Endgame / FinalScoringReveal / Rematch** — TV-рекомпозиция поверх zoom-интеграции, затем полная нативизация (отдельная программа).
2. **Composite `and`-промпты + aresGlobal/Turmoil/Underworld** — нативный DecisionFrame-композит (сейчас desktop MandatoryInputModal / stranded guard).
3. **ConsoleDecisionFrame** — компонентная консолидация 6 confirm-ов (визуальный язык уже сближен; структурное объединение — этап 3).
4. **Полный фокус-свип базовых профилей** на `.con-focus()` (сейчас унифицирован TV-слой; base оставлен байт-идентичным намеренно).
5. **`con-profile-large`** — ретайр/алиас к tv (решение отложено: не целевая платформа).
6. **Ассеты @2x** (жетоны/иконки/арт) + выразительный fullscreen-fallback-арт.
7. **Клавиатурный глиф-сет** (сейчас Xbox-глифы и в keyboard-режиме).
8. **ConsoleSystemMenu / pre-game `cm-*` хинты** — вне shell-бара (монтируются GamepadLayer'ом); привести к единому рендеру позже.
9. **InfoMode detail-back чип** — on-object дубль `B To overview` (флаг из свипа футеров; решить при DecisionFrame-пассе).

## Верификация итерации 1 (2026-07-17, вечер)

- `make:css` ✓ · `make:json` ✓ (без дублей ключей) · финальный `vue-tsc --noEmit` ✓ (0 ошибок) ·
  ESLint по изменённым файлам ✓ · продакшн `build:client` ✓.
- Юнит/компонентные спеки: **675 passing** полного console-свипа (mochapack), включая новые
  `consoleCommandModel.spec.ts` и fill-pass в `consoleHandGrid`; guard `tests/styles/consoleTvTypeFloor.spec.ts`
  зелёный (и уже поймал 2 реальных суб-floor размера в bay-баре — подняты).
- Скриншот-матрица `tv-profile-screens`: **5/5 пресетов зелёные** (tv-4k / tv-os200 / tv-1080 /
  deck-handheld / standard-1080); добавлен кадр `09-card-zoom`.
- Визуальная сверка с 8 исходными проблемами: колесо — бар только «B Закрыть», дубли сняты;
  журнал — 3 хинта вместо 9, ноль обрезаний, имена карт переносятся; fullscreen-карта — ~85 %
  высоты + панель «§ ПРАВИЛА КАРТЫ» + полностью погашенный фон (протечки закрыты).
- Известные ограничения проверки: e2e-прогулка стартового мастера на 4K недетерминирована
  (анимационные холды глотают синтетические нажатия — тест смоук-зелёный, но кадры 03-08 могут
  снимать старт-флоу; НЕ продуктовый баг). Кадр руки с fill-pass на живом 4K не снят —
  математика покрыта юнитами, визуальная точка — ручная приёмка на LG C3 (обязательный пункт §8.9).

### Дополнительно зафиксированные будущие задачи (по следам верификации)
10. **Гонка stranded-guard поверх corp-first-action follow-up** при медленном рендере (скретч-кадр
    показал «Этот запрос пока недоступен…» поверх живой модалки первого действия Inventrix на
    короткое окно) — проверить `taskServedByHost`/leak-detector на этом переходе.
11. **Детерминизация e2e-прогулки стартового мастера** (state-aware драйвер по DOM-маркерам шагов
    вместо чередования нажатий; ожидание `.con-deal-layer` недостаточно).

## Волна 2 — fullscreen-карта до идеала (2026-07-17, поздний вечер)

Реализовано по замечаниям пользователя:
1. **Порядок блоков правил = порядок чтения карты.** Якорные блоки сортируются по Y связанной
   графической строки на СЕВШЕЙ карте (measure по settleNonce, резолв анкеров зеркалит
   `CardAnnotationsLayer.rowEl`); карты без якорей (корпорации) — физический порядок
   requirement → immediate → effect → action → vp → note. Polyphemos/Cheung-Shing-класс
   инверсии закрыт (визуально подтверждено кадрами 09).
2. **Схематичные лидер-связи блок ↔ строка** (выбранный вариант B): SVG-оверлей в зазоре
   карта↔панель — узел-точка на правом крае карты на высоте строки + hairline к kind-чипу
   блока; канал чист (консоль скрывает стрелки навигации); gap<24px → связи не рисуются
   (stacked-лейауты). Работает только для карт с graphicId (проекты/прологи) — у корпораций
   связей нет by design (их строки не несут якорей). ⚠️ Визуальное подтверждение линий —
   на живой сессии (e2e-кадр всегда ловит корпорацию первой).
3. **Закрытие без отставания:** `closing` прокинут scoped-slot'ом из CardZoomModal —
   панель+линии гаснут за 60-90ms В МОМЕНТ старта полёта закрытия, никогда не висят за картой.
4. **Console-native нижний бар:** десктопная скруглённая панель заменена трапециевидной
   командной плитой (язык hand-dock bay); verbs — плоские глиф+КАПС команды (мята=primary,
   циан=select), без веб-пилюль; нативная focus-обводка диалога погашена.
5. **Каунтер** — полноценная HUD-плита (rem, текущий индекс доминирует; TV 1.7rem), угловой
   стиль вместо пилюли.
6. ru-фиксы: «не 3 MС» → «5 M€ вместо 3» (Polyphemos), «Недостаточно МС» → «M€» (ui.json).

Отклонённые варианты связи (документировано для истории решения): нумерованные маркеры
поверх лица карты (жертвуют чистотой premium-арта), Y-докинг блоков (ломает компактный
список, коллизии), фокус-подсветка с пада (нагружает и без того насыщенный zoom-контракт;
возможный будущий слой ПОВЕРХ линий).

## Волна 3 (2026-07-17, вечер) — фидбек-пасс: связь правил цветом, глифы, старт-сцена, рука, фокус, boot
- **Цветовое кодирование правил ↔ карта** (утверждено пользователем): чип блока несёт цвет своего
  элемента — ТРЕБОВАНИЕ=медь (@con-req-copper), ДЕЙСТВИЕ=золото (@con-action-gold), ЭФФЕКТ=синий
  (@con-effect-blue), ПРИ РОЗЫГРЫШЕ=мятный + play-rail карты перекрашен в мяту В fullscreen
  (`.con-zoom .pcard-play-rail { hue-rotate }` — shared-лицо вне вьюера не тронуто); лидер-линии
  наследуют цвет своего блока.
- **Глифы контроллера — системный TV-floor** (§0b console_tv.less): базовый .gp-glyph px-авторский
  (20px) → на всех console-поверхностях мин. 1.55rem/floor; точечные бампы com-home hint/badge и
  journal controls (их компакт-версии специфичнее глобального правила).
- **Старт-сцена**: рама получила реальную высоту (84vh на TV) — fit-движок полосы карт больше не
  голодает (4 пролога теперь крупные; 10 прологов = большой 2×5 грид). Подтверждено кадром.
- **Рука**: edge-inset грида масштабируется профилем (20→×uiScale) — верхний ряд больше не
  режет кост-бейджи выросших карт.
- **ЕДИНЫЙ язык фокуса**: ConsoleCardFocusFrame (L-тики) снят со всех 6 поверхностей (hand, reveal,
  start, task-host, played, played-events) — фокус = обводка слота (ring), тики конфликтовали с
  ней (кадр «Огромный астероид»). Компонент остаётся в репо (cardDeal-директория) как ретир.
- **Boot-loader (прогрев шейдеров)**: источник «просвечивающих карт» = top-layer warm-<dialog>
  (opacity .02 ПОВЕРХ панели; 2% белой корпорации читаются на OLED) → filter:brightness(0)
  (пиксели рисуются — пайплайны компилируются, экран чист) + чёрный backdrop; панель лоадера
  на TV масштабируется (`zoom: var(--con-ui-scale)`).
- ru-фиксы: «МС»→«M€» (ui.json), Polyphemos-строка переписана.
- Верификация: vue-tsc 0 ошибок; floor-guard/`make:json` зелёные; tv-4k прогон зелёный; кадры
  подтверждают чипы-цвета, крупные глифы, старт-грид, единый фокус. Живой проверки ждут:
  лидер-линии на якорной (проектной) карте и мятный play-rail (у корпораций нет rail by design).

### Волна 3 доп.: мятный play-rail — ГЛОБАЛЬНО (единый премиум-язык)
По решению пользователя «при розыгрыше» = мятный ВЕЗДЕ, не только в консольном вьюере. Play-rail
(линии + ромб-эмблема, разделитель on-play зоны) перекрашен в источнике — shared `.pcard`
(`premium_card.less`): новые токены `--pcard-onplay/-hi/-deep` (#58d6a6), линии/тики/эмблема на них.
Консольный `.con-zoom .pcard-play-rail` hue-rotate хак УДАЛЁН (rail теперь мятный сам по себе —
хак дал бы двойной поворот). Затрагивает и desktop-рендер карты (frozen, но это осознанное
глобальное дизайн-решение единого языка). Золото сохраняется у OR-разделителя, mech-плиты, рамки —
мятный строго у on-play rail.
