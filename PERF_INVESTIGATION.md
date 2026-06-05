# Performance Investigation — клиентский рендер (visual layer)

> Статус: **research only, без фиксов.** Все выводы подкреплены анализом кода (file:line).
> Где нужна количественная цифра в ms/FPS — помечено `нужен runtime-профайл` и дан протокол (раздел G).
>
> Методологическая оговорка: интерактивный Performance recording в окружении исследования не запускался (нет живого браузера с DevTools). Доказательства — глубокий разбор исходников + количественные подсчёты эффектов. Уровень уверенности у каждой находки помечен: `confirmed (код)` / `likely` / `needs runtime`.

---

## A. Summary

**Главный вывод: лаги порождает НЕ «слишком красивый визуал» сам по себе, а архитектура обновления состояния + несколько горячих CSS/JS-паттернов. Premium-эффекты вторичны и в большинстве уже сделаны грамотно (transform/opacity-анимации, дисциплинированный `will-change`, `transition: all` отсутствует полностью).**

Три корневые причины, объясняющие почти всё наблюдаемое:

1. **`playerkey`-remount всего поля на каждый ответ сервера** (`App.vue:38` + `playerkey++`). Постановка одного тайла или сдвиг одного маркера = полный teardown/rebuild PlayerHome: `<board>` + ~60 `<board-space>` + 2–3 маркера-шкалы + overview всех игроков + hand-оверлей. Vue-реактивность для точечных обновлений поля фактически не используется — модель «снести и пересобрать». Это объясняет лаги на поле при действиях **и** периодические лаги оверлея «Карты в руке» (он внутри PlayerHome → ремаунтится на каждый polling-ответ оппонента).

2. **Тяжёлый DOM карт без виртуализации + layout-thrashing fit-движков.** Одна карта — это полное DOM/CSS-дерево (~80 узлов, не картинка). 20–30 карт = 1600–2400 узлов рендерятся одновременно. Поверх этого `fit()` в Hand/Played-оверлеях гоняет до 14 (Hand) / 10 (Played) итераций чередующихся `read scrollHeight → write zoom` = серия принудительных синхронных reflow всего грида, усугублённая legacy-`zoom` (форсит relayout поддерева, а не композитинг).

3. **Полноэкранный `backdrop-filter: blur(...)` поверх доски, которая не паузит свои infinite-анимации.** Backdrop модалок (CardZoom `blur(7px)`, colonies `blur(3px)`, mandatory `blur(2px)`) перекрывают весь viewport, а board под ними продолжает крутить бесконечные анимации (вращающийся куб активного игрока `rotation 8s infinite`, pulse-точки, WAAPI scale-маркеры). Каждый кадр анимации под backdrop заставляет браузер заново снять снимок фона и применить gaussian blur на весь экран → постоянный 60fps-repaint при открытой модалке.

Самые проблемные сценарии (по убыванию): **(1)** действия на поле с обновлением состояния; **(2)** Hand-оверлей при 20+ картах (открытие, фильтр/сортировка, ремаунт от polling); **(3)** открытие модалок/оверлеев с blur-backdrop; **(4)** Played-оверлей при 30–50 картах.

Чего бояться **не** нужно (проверено, проблем нет): layout-анимаций на поле нет (маркер и placement-тайл — transform/opacity); `transition: all` = 0; `will-change` дисциплинирован; лицевые стороны карт — DOM/CSS, не тяжёлые PNG.

---

## B. Evidence (по каждому bottleneck)

Сквозная нумерация `B1…B15`, на неё ссылаются разделы C–F.

### B1 — `playerkey`-remount всего PlayerHome на каждый ответ сервера ⬅ корневая
- `src/client/components/App.vue:38` — `<player-home … :key="playerkey">`. Ключ на компоненте → смена = полный unmount+mount поддерева.
- Бампается в двух местах: `App.vue:371` (`playerkey++` на polling-ответ `/api/player`) и `WaitingFor.vue:536-539` (на ответ на собственный input, плюс `screen='empty'→'player-home'` — форсированный double-teardown).
- `App.vue:365` / `WaitingFor.vue:534,537` — `playerView` заменяется **целиком новым объектом**, не патчится → инвалидируются все computed/props ниже.
- Косвенные подтверждения, что авторы знают и обходят точечно: journal/draft/start-flow/draw-reveal смонтированы как **сиблинги** `<player-home>` вне `:key` (`App.vue:51,61,72,104`); module-level baseline-Map'ы существуют **только** чтобы анимации не переигрывались на каждом ремаунте (`tilePlacementAnimation.ts:115`, `AnimatedScaleMarker.vue:115`, `AnimatedMetricValue.vue:165-189`).
- **Что ремаунтится зря:** весь board (~60 board-space + BoardSpaceTile), 2–3 `AnimatedScaleMarker`, overview всех игроков, hand-чипы, **и сам HandCardsOverlay** (живёт внутри PlayerHome — `PlayerHome.vue:314`, в отличие от journal/draft на App-уровне).
- Уверенность: **confirmed (код)**. Severity: **критическая, системная.**

### B2 — Hand-оверлей: 20–30 полных Card-деревьев, нулевая виртуализация
- `HandCardsOverlay.vue:135` — `v-for="entry in sorted"` рендерит весь хвост сразу.
- Одна карта — полный `<Card>` (не упрощённое превью): `Card.vue:1-49` + рекурсивный CardRenderer DSL. Особо дорого: `CardRenderItemComponent.vue:308-310` множит DOM **по количеству ресурса** — карта «gain 5 plants» рисует 5 отдельных `<div>` с `v-html`, не один с цифрой.
- Оценка узлов: простая карта ~35–50, средняя ~70–120, тяжёлая (corp-box) 150–200+. **20 карт ≈ 1600, 30 карт ≈ 2400 DOM-узлов.** Плюс 4 corner-div × (1+псевдо) декоративных узла на рамку × каждую карту.
- Лицевые стороны карт — чистый DOM/CSS, **не PNG** (Agent 5 подтвердил) → давление идёт на repaint от filter/shadow, а не на сеть.
- Уверенность: **confirmed (код)**. Severity: **критическая** (корневая для оверлея).

### B3 — Layout-thrashing в `fit()`-движках (Hand + Played)
- Hand: `HandCardsOverlay.vue:679-688` — до 14 итераций цикла: `read grid.scrollHeight` → `write --hand-card-zoom`. Каждая итерация инвалидирует layout всего грида (через `zoom`, см. B8) и форсирует синхронный пересчёт 20–30 Card-деревьев.
- Played: `PlayedCardsOverlay.vue:285-295` — до 10 итераций `void groups.offsetHeight` (форс reflow) → `groups.scrollHeight` (read).
- Вызывается часто: Hand — `mounted` + ResizeObserver(body) + `deferFit` (380ms) на каждое изменение состава (`:466,648-656`); Played — `mounted` + повтор через 220ms + ResizeObserver + смена игрока + toggle фильтра (`:210,215,233,329,332,337`).
- Уверенность: **confirmed (код)** для паттерна; абсолютные ms — **needs runtime**. Severity: **критическая** (большая рука/коллекция).

### B4 — Полноэкранный `backdrop-filter` поверх не-паузящейся анимирующейся доски ⬅ главная причина «лага открытия модалок»
- Full-viewport blur: `preferences.less:564` (CardZoom `::backdrop` `blur(7px)`, 100vw×100vh), `colonies_overlay.less:40` (`blur(3px)`, `inset:0`), `mandatory_input_modal.less:184` (`blur(2px)`, `inset:0`).
- Board под модалкой НЕ скрывается и НЕ паузится — только `pointer-events:none` (`mandatory_input_modal.less:41-43`). `grep animation-play-state` = **0** совпадений.
- Под backdrop крутятся infinite-анимации ровно в момент хода: `preferences.less:267-268` `.preferences_player_inner.active { animation: rotation 8s infinite }` (куб активного игрока крутится весь ход), `player_home.less:904` blink, `:2940` viewing-dot-pulse, `board.less:1243` tile-highlight, `scale_marker.less:63` WAAPI-маркеры.
- Механизм: каждый изменённый пиксель под backdrop → пере-снимок фона + gaussian blur на весь viewport, **каждый кадр**.
- Подтверждение, что проблему уже ловили: `mandatory_input_modal.less:119-122,155-164` выключают backdrop-filter в `--minimized`/`--picker-mode` (явные «performance fix» комментарии).
- Уверенность: **confirmed (код)** для механизма; стоимость — **needs runtime**. Severity: **критическая.**

### B5 — Per-cell paint-стек на доске (3–4 filter/SVG-слоя × ~60 клеток)
- `board.less:825-832` — `filter: saturate contrast + 3× drop-shadow` на **каждой** placed-tile.
- `board.less:1194-1199` — `filter: 2× drop-shadow + brightness + saturate + drop-shadow` на **каждой** клетке с бонусами.
- `board.less:335-345` — `::before` с inline-SVG (2 polygon + gradient) на **каждой** selectable-клетке.
- `board.less:553-561` — `::after` rim-light (ещё inline-SVG) на **каждой** placed-tile.
- `board.less:634-651` — `::before` радиальный диск на **каждой** bonus-иконке.
- `board.less:924-930` (mixin, применяется `:947,957,1474`) — `saturate + 3× drop-shadow` на каждом кубике/маркере игрока.
- Сам код это признаёт: коммент `board.less:823` — «a handful of GPU passes per tile, at ~60 tiles».
- `:has(.board-space--available)` — 9 вхождений (`board.less:445-490`), всплеск layout/paint при входе в placement-режим.
- Уверенность: **confirmed (код)**. Severity: **высокая** (статический бюджет, оплачивается на каждый board-update/zoom/scroll).

### B6 — CSS containment не используется нигде
- `contain` / `content-visibility` = **0 активных** во всём `src/styles` (единственная ссылка — закомментированный/удалённый `contain: paint` в `game_atmosphere.less:34`).
- Ни клетки, ни карты, ни гриды оверлеев, ни journal-feed не изолированы → repaint одной клетки/карты не ограничен её поддеревом.
- Уверенность: **confirmed (код)**. Severity: **высокая как упущенная возможность** (самый большой выигрыш на единицу усилий).

### B7 — `useBoardAutoScale`: ResizeObserver-feedback + getComputedStyle
- `src/client/utils/useBoardAutoScale.ts:156` — `ResizeObserver` на `document.documentElement`.
- `computeAndApply()` (`:121-138`) — `getComputedStyle(documentElement)` ×2 (`:87,106`, forced style recalc) → `setProperty('--board-scale')` (`:137`) на тот же documentElement.
- Запись `--board-scale` меняет `transform: scale()` на `.board-cont` → может изменить геометрию → ResizeObserver на documentElement может выстрелить снова → `schedule()` → ещё `computeAndApply`. rAF-троттлинг ограничивает 1/кадр, но петля возможна на каждый board-update.
- На границе remount (B1): refCount сглаживает, но `uninstall` удаляет `--board-scale`, `install` сразу зовёт `computeAndApply()` → снос+пересчёт масштаба.
- Уверенность: **confirmed (код)** для read-after-write; частота петли — **needs runtime**. Severity: **средне-высокая** (вероятный источник «дёрганья» при движении маркеров).

### B8 — `zoom:` вместо `transform: scale` для масштабирования карт
- `hand_cards.less:613` `.card-container { zoom: var(--hand-card-zoom) }`, `played_cards.less:581` аналогично, ~45 вхождений `zoom` суммарно (`initial_draft.less` ~28).
- `zoom` форсит **полный relayout поддерева**, не композитинг. Привязан к переменной, которую fit-движок меняет пошагово (B3) → relayout всех карт на каждой итерации.
- Уверенность: **confirmed (код)**. Severity: **высокая** (мультипликатор для B3).

### B9 — Постоянный (не-hover) filter на каждой карте руки
- `hand_cards.less:608` — `.hand-card-item__card { filter: drop-shadow(...) }` на **каждой** карте в покое.
- `hand_cards.less:627` — `filter: grayscale(0.55) brightness(0.62) drop-shadow(...)` на **каждой** недоступной карте в покое (часто половина руки) → десятки постоянных filter-слоёв.
- `hand_cards.less` — 10× `backdrop-filter: blur` (трей-фон + слоты карт `:761,935`): при полной руке 10+ независимых backdrop-blur слоёв.
- Уверенность: **confirmed (код)**. Severity: **высокая.**

### B10 — convert-icon: infinite filter + mix-blend постоянно на экране
- `resources.less:210,241` — `convert-icon-pulse-plants/heat 2.4s infinite` анимируют `filter: drop-shadow()` (постоянный GPU-repaint).
- `resources.less:156` — `convert-icon-shimmer 3s infinite` с `mix-blend-mode: screen` (дорогой composite-pass каждый кадр).
- Это панель слева, ≤2 иконки, гасятся `prefers-reduced-motion` — но работают весь ход пока доступна конвертация. На самом поле infinite shadow/filter/glow **нет**.
- Уверенность: **confirmed (код)**. Severity: **средняя** (постоянная, но ограниченная).

### B11 — Некэшируемые методы/выражения в template (new identity per render)
- `Board.vue:473` `getAllSpacesOnMars()` — метод в `v-for` (`:102`), делает `[...spaces].sort().filter()` — новый массив каждый рендер (НЕ computed).
- `Board.vue:497` `getValuesForParameter()` ×3 в template (`:55,60,65`) — новый массив каждый рендер.
- `PlayerHome.vue:373,376` — inline `sortActiveCards(getCardsByType(...).filter(isActive))` дважды подряд (для `v-for` и для `.length===0`).
- `Board.vue:418` `spaceMap` строится в `data()` и не реактивен к `spaces` — «работает» только из-за remount (латентный баг + индикатор зависимости от B1).
- Уверенность: **confirmed (код)**. Severity: **средняя.**

### B12 — `onLeaveCapture`: forced layout на каждую уходящую карту
- `HandCardsOverlay.vue:596-602` (`@before-leave`, `:133`) — для каждой уходящей карты читает `offsetLeft/offsetTop/offsetWidth/offsetHeight` и тут же пишет inline-стили → forced layout × N при снятии фильтра, затем `deferFit` (ещё 14 итераций B3).
- Уверенность: **confirmed (код)**. Severity: **средняя.**

### B13 — CardZoomModal: preload 3 тяжёлых карт + forced reflow
- `CardZoomModal.vue:144-146` — рендерит `CardZoomCard` для `currentIndex ± 1` → до 3 полных карт одновременно в nav-режиме.
- `fitCardToViewport` (`:476-522`) на `show()` и каждом слайде: `style.zoom='1'` → `void offsetHeight` (форс reflow `:487-489`) → read `offsetWidth/offsetHeight` (`:491-492`) = write→read thrash.
- Уверенность: **confirmed (код)**. Severity: **средняя** (одиночный режим без preload — проблем нет).

### B14 — Намеренные UX-задержки (воспринимаются как лаг, но это не рендер)
- `WaitingFor.vue:481,151` — `WGT_MARKER_HOLD_MS = 1100` мс: после WGT-изменения параметра UI заблокирован 1.1с (`isServerSideRequestInProgress` поднят).
- `WaitingFor.vue:476-481` + `tilePlacementAnimation.ts:53` — `PLACEMENT_HOLD_MS = 330` мс после постановки тайла.
- `applyGlobalParamPreview` (`WaitingFor.vue:396-407`) мутирует `oldGame.temperature` in place → ре-рендер Board без remount → срабатывает B11 (`getAllSpacesOnMars`).
- Уверенность: **confirmed (код)**. Severity: **средняя** (это дизайн-решение, не баг; но субъективно «залипает»).

### B15 — Ассеты: тяжёлые PNG, нет lazy/decode, нет webpack image-pipeline
- `assets/board/mars.png` — **6.71 MB** (2480×2400 RGBA), `mars-without-venus.png` — 6.45 MB. Папка board = 13.7 MB. Рядом лежат облегчённые `assets/board/original/*.png` (~407 KB), но UI грузит тяжёлые.
- `loading="lazy"` / `decoding="async"` = **0** во всём проекте.
- `webpack.config.js:81,85` — `css-loader { url: false }`: webpack не обрабатывает `url()` в CSS вообще (нет asset-модулей, base64-инлайна мелких иконок, content-hash). Нет правила `test: /\.(png|jpg|svg)$/`.
- `resources/card.png` (2.1 MB) переиспользуется как `background` в ~10 зонах; 40 отдельных PNG-иконок ресурсов без спрайта (хотя `board_icons.png` спрайтован правильно).
- Уверенность: **confirmed (код)**. Severity: **средняя** (влияет на первую загрузку/декод, меньше на runtime-лаги действий).

---

## C. Root cause hypothesis (по уровню уверенности)

### Confirmed (доказано кодом)
- **B1** playerkey-remount всего поля — корневая причина лагов на поле и периодических лагов hand-оверлея.
- **B2** тяжёлый DOM карт без виртуализации — корневая для оверлеев.
- **B3** layout-thrashing в fit() — мультиплицирует стоимость B2.
- **B4** full-viewport backdrop-filter поверх не-паузящейся доски — корневая для лага открытия модалок (механизм доказан; величина — needs runtime).
- **B5** per-cell paint-стек, **B8** `zoom`, **B9** per-card filter, **B11** new-identity в template, **B12** onLeaveCapture forced layout — все доказаны кодом.

### Likely (паттерн доказан, частота/величина под вопросом)
- **B7** ResizeObserver-feedback в useBoardAutoScale — read-after-write доказан, реальная частота петли needs runtime.
- **B10** convert-icon filter — постоянная нагрузка доказана, доля в кадровом бюджете needs runtime.
- **B6** отсутствие containment усиливает все per-cell/per-card находки, но величину выигрыша надо мерить.

### Needs more investigation (только runtime даст цифру)
- Реальная доля времени кадра: remount (B1) vs forced-layout (B3/B7) vs blur-repaint (B4). Без Performance recording нельзя сказать, что доминирует на конкретной машине.
- Сколько именно polling-ремаунтов hand-оверлея происходит за матч (зависит от числа игроков/частоты поллинга).
- Влияние `card-hover-tall` (B2-смежное, `Card.vue:184` + `cards_v2.less:1347`) — меняет height на hover (reflow) **только при `experimental_ui=true`**; зависит от пользовательской настройки.

---

## D. Optimization options (quick win / medium / architectural)

> Формат: для каждого — варианты по глубине, визуальный риск, риск реализации. **Не внедрять в этой задаче.**

### B1 — playerkey-remount
- **Architectural (главный рычаг):** дать `<board>` / global-numbers собственный стабильный ключ или вынести board-слой за `:key="playerkey"` (как уже сделано для journal/draft/start-flow), чтобы поле диффилось реактивно вместо teardown. Параллельно — патчить `playerView` инкрементально вместо полной замены объекта, ИЛИ хотя бы разделить board (медленно меняется) и hand/overview.
- **Medium:** вынести HandCardsOverlay на App-уровень (как journal) → перестанет ремаунтиться на polling-ответы оппонентов.
- Визуальный риск: **низкий** (рендер тот же, меняется только жизненный цикл). Риск реализации: **высокий** — это центральная архитектура; `spaceMap`-баг (B11) и baseline-Map'ы анимаций завязаны на remount, их придётся пересмотреть; нужен careful regression-проход по анимациям delta-чипов.

### B2 — тяжёлый DOM карт
- **Quick win:** `content-visibility: auto` + `contain-intrinsic-size` на card-слотах оверлея — браузер пропускает рендер/layout offscreen-карт почти без изменений кода. Визуальный риск низкий, риск реализации низкий (нужно задать intrinsic-size, иначе скачет scrollbar).
- **Medium:** lightweight-режим карты для грида (рендерить полный CardRenderer только на hover/zoom, в гриде — облегчённое превью). Визуальный риск **средний** (надо сохранить читаемость), риск реализации средний.
- **Architectural:** виртуализация (рендерить только видимые карты). Визуальный риск **средний** (premium-layout с auto-fit гридом и transition-group плохо дружит с виртуализацией — анимации входа/выхода усложняются), риск реализации высокий. **Оценить, но скорее последняя мера** — `content-visibility` может закрыть проблему дешевле.

### B3 — fit() layout-thrashing
- **Quick win:** вынести единственный `read scrollHeight` из цикла; считать нужный zoom аналитически (1 read + 1 write) вместо итеративного подбора, ИЛИ батчить чтения через `ResizeObserver`/`requestAnimationFrame` без чередования read/write. Визуальный риск **нулевой** (результат тот же), риск реализации **низкий**. **Один из лучших quick-win по соотношению эффект/риск.**
- В связке с B8 (заменить `zoom` на `transform: scale`) — relayout превращается в композитинг.

### B4 — backdrop-filter blur поверх доски
- **Quick win:** на время открытой модалки паузить infinite-анимации под backdrop (`animation-play-state: paused` на board через класс на `body`, который уже ставится) — blur перестаёт пересчитываться каждый кадр, картинка статична → один blur-проход. Визуальный риск **очень низкий** (под затемнённым blur вращение куба и так не видно), риск реализации **низкий**. **Топ quick-win.**
- **Medium:** заменить full-viewport `backdrop-filter` на дешёвый псевдо-blur (полупрозрачный затемняющий слой + опционально один заранее отрендеренный blurred-снимок), особенно там где фон и так `alpha 0.95` (B9: blur тратится впустую под почти непрозрачным фоном — `played_cards.less:50`, `hand_cards.less:93`). Визуальный риск **низкий** (разница почти незаметна), риск реализации низкий-средний.

### B5 / B6 — per-cell paint + containment
- **Quick win:** `contain: layout paint` (или `strict` с фикс-размерами 46×51) на `.board-space`/`.board-space-tile` — изолирует repaint клетки от соседей. Визуальный риск **низкий** (нужно проверить, что drop-shadow клетки не обрезается границей contain — возможно вынести тень на родителя), риск реализации **низкий-средний**.
- **Medium:** схлопнуть 3× drop-shadow → 1 на tile/bonus (`board.less:825-832,1194-1199`); запечь `saturate/contrast/brightness` прямо в спрайт-иконки. Визуальный риск **низкий** (почти неотличимо), риск реализации низкий.
- **Medium:** объединить tile-`filter` + tile-`::after` rim в один слой; общий SVG-контур (`::before`) вынести в один фоновый слой вместо per-cell. Визуальный риск низкий, риск реализации средний.

### B7 — useBoardAutoScale feedback
- **Medium:** наблюдать ResizeObserver-ом **контейнер board**, а не `documentElement` (куда же и пишется `--board-scale`) → разрыв петли. Читать размеры через `getBoundingClientRect` контейнера, не `getComputedStyle(documentElement)`. Визуальный риск нулевой, риск реализации низкий-средний (надо аккуратно с reserved-расчётами).

### B8 — `zoom` → `transform: scale`
- **Medium:** заменить `zoom: var(...)` на `transform: scale(var(...))` + `transform-origin`. Сложность: `transform` не влияет на layout-поток (нужно компенсировать через wrapper-размер/`scale`-aware контейнер, иначе соседи не подвинутся). Визуальный риск **средний** (возможны subpixel-различия, надо тестировать auto-fit грид), риск реализации **средний**.

### B9 — per-card постоянный filter
- **Quick win:** перенести resting `drop-shadow` с `filter` на `box-shadow` (дешевле в композитинге) либо на wrapper, а не на каждую карту; grayscale недоступных карт оставить, но рассмотреть `contain` чтобы ограничить площадь. Визуальный риск **низкий-средний** (drop-shadow по альфе vs box-shadow по bbox дают чуть разный контур — для прямоугольной карты разница мала), риск реализации низкий.
- Убрать `backdrop-filter` со слотов карт там, где фон непрозрачный (см. B4-medium).

### B10 — convert-icon filter-анимации
- **Quick win:** заменить анимацию `filter: drop-shadow` на анимацию `opacity`/`transform` псевдо-glow-слоя (тот же визуал, компоситится); убрать `mix-blend-mode: screen` из бесконечного shimmer или заменить на opacity-mask. Визуальный риск **низкий-средний** (надо подобрать эквивалент), риск реализации низкий.

### B11 — new-identity в template
- **Quick win:** превратить `getAllSpacesOnMars` / `getValuesForParameter` / inline-`sortActiveCards` в **computed** (кэш по реактивным зависимостям). Визуальный риск **нулевой**, риск реализации **низкий**. Починить `spaceMap`-реактивность заодно (или после B1).

### B12 — onLeaveCapture forced layout
- **Medium:** батчить чтения геометрии уходящих карт в один проход перед записями (read-all-then-write-all), либо использовать FLIP с заранее снятыми позициями. Визуальный риск низкий, риск реализации средний.

### B13 — CardZoomModal preload + reflow
- **Quick win:** preload соседей рендерить с `content-visibility: hidden` / вне потока, либо ленивее (только при первом нажатии стрелки). Убрать write→read в `fitCardToViewport` (считать масштаб без форс-reflow). Визуальный риск нулевой, риск реализации низкий.

### B14 — UX-холды
- **Только продуктовое решение, не перф:** сделать `WGT_MARKER_HOLD_MS`/`PLACEMENT_HOLD_MS` настраиваемыми/короче, либо не блокировать ввод на время чисто визуального hold. Визуальный риск — это и есть визуал (анимация параметра); трогать осторожно.

### B15 — ассеты
- **Quick win:** переключить board-фон на облегчённый `assets/board/original/mars.png` (уже в репо), добавить `decoding="async"`/`loading="lazy"` к `<img>`. Визуальный риск **средний** (надо сверить качество облегчённой версии на крупном масштабе), риск реализации низкий.
- **Medium:** настроить webpack asset-pipeline (asset-модули, content-hash, инлайн мелких иконок), спрайтовать иконки ресурсов как board-иконки. Визуальный риск нулевой, риск реализации средний.

---

## E. Priority plan (рекомендованный порядок)

### Этап 1 — High impact / Low risk (quick wins, делать первыми)
1. **B4 quick-win** — паузить board-анимации под открытой модалкой (`animation-play-state: paused`). Снимает самый заметный класс «лаг открытия модалок» почти без риска.
2. **B3 quick-win** — убрать чередование read/write из `fit()` (Hand + Played), считать zoom аналитически. Прямой удар по лагам оверлеев.
3. **B11** — `getAllSpacesOnMars`/`getValuesForParameter`/`sortActiveCards` → computed. Дёшево, безопасно, снимает часть стоимости каждого board/home-рендера.
4. **B2 quick-win + B5/B6 quick-win** — `content-visibility: auto` на card-слотах оверлеев + `contain: layout paint` на клетках доски. Большой выигрыш на единицу усилий, низкий визуальный риск (проверить обрезку теней).
5. **B15 quick-win** — облегчённый mars.png + `decoding="async"`. Ускоряет первую загрузку/декод.

### Этап 2 — Medium impact / Medium risk
6. **B7** — разорвать ResizeObserver-feedback в useBoardAutoScale (наблюдать контейнер, не documentElement).
7. **B5/B9 medium** — схлопнуть multi-drop-shadow, запечь saturate/brightness в спрайты, перенести resting-shadow на wrapper/box-shadow; убрать backdrop-filter с непрозрачных панелей (B4-medium).
8. **B10** — переписать convert-icon анимации на opacity/transform, убрать mix-blend.
9. **B12 / B13** — батчинг чтений геометрии, ленивее preload в CardZoom.
10. **B8** — `zoom` → `transform: scale` (требует аккуратного теста auto-fit грида).

### Этап 3 — Architectural (только после данных профайлера, наибольший риск)
11. **B1** — изоляция board-слоя от `playerkey`-remount + инкрементальный патч `playerView` (или вынос Hand-оверлея на App-уровень как промежуточный шаг). **Сначала измерить профайлером, какую долю кадрового бюджета реально съедает remount** — это определит, оправдан ли риск.
12. **B2 architectural** — виртуализация/пагинация Hand/Played, **только если `content-visibility` (этап 1) недостаточно**.

---

## F. Do NOT optimize yet (риск выше пользы сейчас)

- **B1 (полная переделка remount-архитектуры) — НЕ начинать без runtime-данных.** Это центральная архитектура; от remount зависят baseline-Map'ы анимаций (delta-чипы, scale-маркеры, tile-placement) и латентно — `spaceMap`. Сначала этапы 1–2 (они могут снять достаточно лагов), потом профайлер покажет, нужна ли переделка. Премату́рно — высокий риск регрессий анимаций.
- **B2 виртуализация Hand/Played — пока НЕ внедрять.** Сначала `content-visibility: auto` (этап 1.4). Виртуализация конфликтует с premium auto-fit гридом + transition-group (анимации входа/выхода, fit-движок) — внедрять только если профайлер докажет, что containment не хватает.
- **B14 (UX-холды) — не «оптимизировать» ради скорости.** 1100мс/330мс — намеренные визуальные паузы (анимация параметра/тайла). Это продуктовый вопрос, не перф-баг; менять только по согласованию.
- **`transition: all`, `will-change`-чистка — НЕ нужны.** Проверено: `transition: all` = 0, `will-change` дисциплинирован. Не тратить время.
- **Layout-анимации на поле — НЕ искать/чинить.** Их нет: маркер и placement-тайл уже на transform/opacity.
- **B8 (`zoom`→`transform`) — не делать рано.** Средний визуальный риск (subpixel/layout-поток); только когда дешёвые fit-фиксы (B3) исчерпаны.

---

## G. Протокол профайлинга (для подтверждения гипотез в DevTools)

Поскольку runtime-замеры в исследовании не делались, вот точный протокол — что записать и что подтвердит/опровергнет каждую находку.

### Инструменты
- **Chrome DevTools → Performance**: запись 3–5 с на сценарий, смотреть Main thread (Scripting/Rendering/Painting), Frames (dropped frames), Long Tasks (>50ms), вкладку Layout/Recalculate Style/Paint/Composite.
- **DevTools → Rendering**: включить *Paint flashing* (зелёные мигания = области repaint — проверит B4/B5/B10), *Layout Shift Regions*, *Frame Rendering Stats* (FPS), *Layer borders*.
- **Vue Devtools → Components/Timeline**: смотреть, какие компоненты mount/unmount (подтвердит B1), частоту обновлений, reactive deps.
- **Performance Monitor** (отдельная вкладка): живой график DOM nodes / Layouts/sec / Style recalcs/sec.

### Воспроизводимые сценарии и что фиксировать
Для каждого: *expected behavior · observed lag · FPS/dropped frames · main-thread hotspot · layout/paint/composite cost · suspected root cause*.

1. **Board: постановка ocean/city/greenery/special tile.** Ждать: в Performance — крупный блок Scripting + «Recalculate Style» + множество mount/unmount в Vue Timeline → **подтверждает B1** (remount). Paint flashing на всей доске, а не только новой клетке → подтверждает B5/B6.
2. **Board: движение маркера глоб. параметра (temperature/oxygen/venus/TR).** Ждать: forced layout в `AnimatedScaleMarker.snapshotAnchors` (стек `offsetTop`), возможный ResizeObserver-каскад от `useBoardAutoScale` → **B7**. Проверить, не блокируется ли UI 1100мс → **B14**.
3. **Board: delta-chip / resource feedback.** Ждать: mount `AnimatedMetricValue` ×N → **B1** (baseline через remount).
4. **Cards overlay: открыть с 20+ картами.** Ждать: длинный Scripting-блок на mount (рендер 1600–2400 узлов) + серия Layout-событий из `fit()` → **B2 + B3**. Performance Monitor: скачок DOM nodes.
5. **Cards overlay: фильтр/сортировка 20+ карт.** Ждать: `deferFit` → 14 Layout подряд (**B3**), forced layout в `onLeaveCapture` (**B12**), пере-рендер chip-computed.
6. **Cards overlay: select/unselect нескольких карт.** Ждать: проверка prop у всех HandCardItem; убедиться, что Card-инстансы НЕ ремаунтятся (стабильный `:key` — должно быть reuse).
7. **Modal: открыть/закрыть card fullscreen.** Ждать: Paint flashing на весь экран при наличии вращающегося куба под backdrop → **B4**; mount 3 CardZoomCard + forced reflow `fitCardToViewport` → **B13**.
8. **Modal: open input modal с backdrop.** Ждать: непрерывный Painting весь срок открытия (blur пересчитывается каждый кадр пока крутится куб) → **B4** (ключевой тест: поставить `animation-play-state: paused` на куб в DevTools и сравнить).
9. **Colonies overlay / trade modal open.** Ждать: blur(3px) full-viewport repaint → **B4**; DOM умеренный (5–7 колоний).
10. **(доп.) Polling-ремаунт hand-оверлея:** открыть Hand-оверлей, дождаться хода оппонента (polling-ответ) → в Vue Timeline увидеть unmount/mount всего PlayerHome+оверлея → **B1**.

### Ключевые проверки-«ответы»
- **Доминирует ли remount (B1)?** Vue Timeline: считать unmount-события PlayerHome на одно действие. Если на каждый board-update — да.
- **Доминирует ли blur (B4)?** Сценарий 8: с paused-кубом Painting должен почти исчезнуть. Если да — B4 подтверждён как главный для модалок.
- **Доминирует ли fit-thrash (B3)?** Сценарий 4/5: блок из 10–14 «Layout» подряд в одном задаче-таске.

---

## H. Как сохранить premium-визуал при оптимизации

Принцип: **менять механизм рендера эффекта, а не сам эффект.** Конкретно:

- **Паузить, а не убирать** анимации под модалкой (B4): пользователь под затемнённым blur всё равно их не видит — визуал не страдает.
- **Запекать статичные filter в спрайты** (B5/B9): `saturate/contrast/brightness` на иконке даёт пиксельно тот же результат, но без runtime-filter-прохода.
- **Один drop-shadow вместо трёх** (B5): три тени с близкими параметрами визуально почти неотличимы от одной хорошо подобранной — A/B сравнить, оставить минимум слоёв при том же ощущении глубины.
- **`box-shadow`/wrapper вместо per-element `filter`** (B9): для прямоугольных карт контур тени почти идентичен, но дешевле.
- **`content-visibility` / `contain`** (B2/B5/B6) — **полностью невидимы для пользователя**, не меняют ни один пиксель видимой области, только изолируют/откладывают рендер невидимого. Самый «бесплатный» с точки зрения визуала рычаг.
- **`opacity`/`transform`-glow вместо анимации `filter`/`mix-blend`** (B10): тот же пульсирующий glow, но компоситится на GPU.
- **Облегчённый mars.png** (B15) — единственное место, где надо сверить качество глазами на максимальном зуме перед заменой; если облегчённая версия теряет детализацию на крупном масштабе — оставить тяжёлую и оптимизировать иначе (например, отдавать разные версии под `--board-scale`).

Красная линия (из ограничений задачи): **не отключать эффекты «чтобы быстрее»** и не делать premature-оптимизацию архитектуры (B1) без данных профайлера. Сначала — невидимые для глаза рычаги (containment, fit-фиксы, пауза под backdrop), измерить, и только потом решать про архитектуру.

---

## Чек-лист Acceptance criteria

| # | Критерий | Статус |
|---|----------|--------|
| 1 | Profiling board actions | Анализ кода ✅, runtime-протокол дан (G); живой replay — за пользователем |
| 2 | Profiling cards overlay 20+ | Анализ кода ✅ (B2/B3), протокол (G.4–6) |
| 3 | Profiling открытие/закрытие модалок | Анализ кода ✅ (B4/B13), протокол (G.7–9) |
| 4 | Remount/rerender гипотезы | ✅ B1/B2/B11 |
| 5 | Layout/repaint/composite гипотезы | ✅ B3/B4/B5/B7/B12 |
| 6 | Тяжёлые CSS-эффекты | ✅ B5/B9/B10 + количественный аудит |
| 7 | Отчёт с evidence | ✅ (этот документ) |
| 8 | confirmed/likely/speculative | ✅ раздел C |
| 9 | Priority plan без внедрения | ✅ раздел E |
| 10 | Low-risk quick wins + architectural | ✅ D/E/F |
| 11 | Сохранение premium-стиля | ✅ раздел H |

> **Не реализовано намеренно (по условию задачи): никаких фиксов.** Только исследование, доказательства и план.
