# Console Native Foundation — input / viewport / motion / overflow

Foundation-слой Console Native UI поверх **@vueuse/core@14.3.0**. Цель: компоненты
console-flow не знают про raw `KeyboardEvent` / `GamepadEvent` / `window.resize` /
`matchMedia` / body scroll lock — они работают через семантический слой; browser-native
scrollbars в console-native режиме структурно невозможны, а их источники ловятся
dev-диагностикой.

Код: `src/client/console/composables/` + `src/client/components/console/foundation/` +
`src/styles/console_foundation.less`. Тесты: `tests/client/components/console/
consoleActionModel.spec.ts` / `consoleOverflowGuard.spec.ts` / `consoleNativeSurface.spec.ts`.

---

## §1. Зависимость и правила использования VueUse

- `@vueuse/core` — **точно 14.3.0** (`--save-exact`; peer `vue ^3.5.0` — range в
  package.json поднят с `^3.4.0`, установленный 3.5.28 не менялся).
- `@vueuse/components` / `@vueuse/integrations` / прочие пакеты семейства НЕ добавлять
  без отдельного решения.
- **Разрешено напрямую в любом коде:** `useEventListener`, `useResizeObserver`,
  `useDebounceFn`, `useThrottleFn`, `useElementBounding`, `tryOnScopeDispose`,
  `createGlobalState`, `onClickOutside`, `useClipboard`, `useScroll`,
  `useIntervalFn` / `useTimeoutFn`, `refAutoReset`, `watchDebounced` /
  `watchThrottled`. Приняты после аудита фактических hand-rolled паттернов
  (2026-07-10) — см. «Принятые в форк» ниже.
- **Только через adapter (не звать напрямую из компонентов):**
  - `useScrollLock` → `consoleNativeSurface.ts` (page-lock — единая политика, не
    per-component);
  - `usePreferredReducedMotion` → `src/client/utils/reducedMotion.ts` (ОДИН
    реактивный источник fork-wide; `changeFeedbackManager.prefersReducedMotion` и
    console `useConsoleReducedMotion` теперь ДЕЛЕГИРУЮТ туда — не свой matchMedia);
  - `useEventBus` → `src/client/components/notifications/notificationBus.ts`
    (типизированная замена `tm-notification-*` window-CustomEvents; ключи в одном
    модуле, `.on()` авто-cleanup);
  - `useMediaQuery` / `useWindowSize` → `useConsoleViewport.ts`;
  - `useMagicKeys` / `onKeyStroke` — **не используем вовсе**: консоли нужен
    `e.code`-маппинг с управляемым `preventDefault`/`stopImmediatePropagation` и единой
    таблицей (`consoleActionModel.ts`); `useEventListener` покрывает это лучше.
  - `useGamepad` — **не используем**: собственный слой (`gamepadPollModel` +
    `gamepadCore`) сильнее — pure-модель с юнит-тестами, hold-repeat, гистерезис
    аналоговых триггеров, deadzone, election активного пада, idle early-out.
    `useGamepad` — тонкая reactive-обёртка без этих свойств. Не заменять.
  - `useRafFn` — не нужен: rAF-циклы уже дисциплинированы (`gamepadCore`,
    `createFrameGate`); новые самодельные loops не заводить.
  - `useDocumentVisibility` — не нужен: `gamepadCore` сам слушает
    `visibilitychange`, overflow-guard читает `document.visibilityState` в tick.

## §2. Семантический input-слой

Строгая иерархия:

```
физический ввод (клавиатура / Gamepad API)
  → GamepadIntent / SemanticButton   (gamepadPollModel — семантика УСТРОЙСТВА)
    → ConsoleAction                  (consoleActionModel — семантика ЭКРАНА)
```

- **`consoleActionModel.ts`** (pure) — словарь `ConsoleAction`
  (`primary/back/inspect/fullscreen/prevSection/nextSection/prevTab/nextTab/reset/system`
  + контекстные `confirm/cancel/launch/openActionsWheel/openStandardProjectsWheel`),
  дефолтная карта `BASE_ACTION_OF_BUTTON`, резолвер `consoleActionOf(intent, overrides?)`
  и **единственная карта клавиатуры** (`CONSOLE_KEY_NAV`/`CONSOLE_KEY_BUTTON` +
  `keyboardConsoleIntent`). Стики намеренно без дефолтного action (экранная специфика).
  Контекстное значение кнопки — это `overrides` экрана (`{secondary: 'launch'}`),
  никогда не новая физическая привязка на месте.
- **`consoleKeyBridge.ts`** — ЕДИНСТВЕННЫЙ keyboard→intent мост. Ставится
  GamepadLayer'ом на watch `consoleModeState.enabled` (immediate) → клавиатурный
  fallback работает на ВСЁМ console-flow, включая in-game (раньше — только pre-game).
  Диспатчит в тот же слот `dispatchConsoleIntent`; `preventDefault` +
  `stopImmediatePropagation` ТОЛЬКО при consumed (не-съеденная клавиша ведёт себя как
  раньше — fallback-surfaces с DOM-фокусом не страдают). Молчит при
  `menuPadState.textEntry` / editable target. `consoleMenuPad` больше НЕ держит свой
  keydown-listener (маппинг переехал в модель, слушатель — в мост).
- **`useConsoleInput.ts`** — API для НОВЫХ экранов: клеймит слот интентов на время
  жизни компонента, отдаёт `onAction(action)` / `onNav(dir, repeat)` / `onIntent`
  (raw escape hatch), `exclusive` (default true — экран глотает всё),
  `menuSurface: true` для pre-game экранов (скрывает generic hint bar). Существующие
  экраны мигрируют постепенно: минимальный шаг — заменить паттерн-матчинг
  `intent.kind==='press' && intent.button==='confirm'` на `consoleActionOf(intent)`
  (см. пилот в ConsoleMainMenu).
- **Repeat** живёт в pure poll-модели пада (NAV_REPEAT_*) и в `e.repeat` клавиатуры —
  отдельный `useConsoleNavigationRepeat` не нужен, флаг `repeat` едет в nav-интенте.
- Арбитраж НЕ менялся: один top-level владелец слота (ConsoleShell в игре, menu-экран
  через `installMenuPad` до игры), делегирование детям через ref `handleIntent`.

Клавиатурная карта: стрелки=nav, Enter=A, Esc=B, X/Y=X/Y, Q/E и [ / ]=LB/RB,
`,`/`.`=LT/RT (новое), R=View.

## §3. Console Overflow & Scroll System

**Инвариант: в console-native режиме browser-native scrollbar (страничный ИЛИ
компонентный, вертикальный ИЛИ горизонтальный) — это баг.**

1. **`consoleNativeSurface.ts`** — refcount-класс `html.console-native` + VueUse
   `useScrollLock(body)` + сброс scroll-позиции. Каждый console-native ЭКРАН
   (владелец viewport) зовёт `useConsoleNativeSurface()` в `setup()` (подключены:
   ConsoleShell, ConsoleMainMenu, ConsoleCreateGame). Внутренние панели НЕ зовут —
   политика наследуется от экрана. Класс **уже, чем `console-mode`**: ещё не
   мигрированные desktop-страницы (join / lobby), которым нужен window scroll,
   surface не берут (их скроллбар-хром прячет прежний P14-блок).
2. **CSS-политика** (`console_foundation.less`): `html.console-native`, `body`,
   `#app`, `.main-container` → `width/height:100%; overflow:hidden !important;
   overscroll-behavior:none; min-width:0`.
3. **`ConsoleScrollArea.vue`** (`components/console/foundation/`) — ЕДИНСТВЕННОЕ
   место внутреннего скролла. Внешний бокс клипает, внутренний viewport скроллит без
   нативного хрома, при overflow появляется тонкий cyan progress-rail (3px, только
   пока реально overflowing; `prefers-reduced-motion` учтён). Props: `axis`
   (`y`/`x`), `indicator`, `contentClass` (класс layout'а на content-обёртке — миграция
   легаси `overflow-y:auto` контейнера становится markup-only), `fill` (content
   растягивается на высоту viewport — сохраняет `margin-top:auto` прижатые блоки).
   Expose: `ensureVisible(el, margin?)` (курсор-в-зоне-видимости; ручная математика
   ТОЛЬКО по своему viewport — не `scrollIntoView`, который может скроллить внешние
   контейнеры), `scrollByPx(delta)` (правый стик), `scrollToStart()`, `measure()`.
   Новый скроллящийся список = обёртка в ConsoleScrollArea, НЕ `overflow-y:auto`.
4. **Overflow-safe анимации** — паттерн `.con-motion-clip` (обёртка клипает) +
   `.con-motion-layer` (внутренний слой двигается transform/opacity). Запрещено в
   console-native коде: `transition: all`; анимация width/height/top/left/margin/
   padding; transform-overshoot без clip-обёртки; `100vw + padding` (любая ширина,
   способная превысить viewport). Для flex/grid детей — `min-width:0`/`min-height:0`.
5. **`consoleOverflowGuard.ts`** — dev-диагностика (в prod инертна, форс —
   `?conOverflow=1`). Ставится в GamepadLayer.mounted, самогейтится на
   `consoleNativeActive()`. Меряет `documentElement.scroll*` vs `client*` (допуск
   1px) после resize / transitionend / animationend (+тик 2s), при overflow ищет
   top-5 offenders (rect за пределами viewport; вертикальный overshoot считается
   только при вертикальном overflow корня — fixed-бэкдроп выше viewport нормален) и
   логирует ОДИН warn на сигнатуру. Pure-математика (`classifyRootOverflow`,
   `rankOverflowOffenders`) — юнит-тестирована.

## §4–§6. Viewport / reduced-motion / focus frame

- **`useConsoleViewport.ts`** — единый reactive viewport: `width/height`
  (`useWindowSize`), `profile/isHandheld/isLarge` (источник —
  `consoleLayoutProfile`, включая `?consoleProfile=` override), `isPortrait`
  (`useMediaQuery`), `isDeckHeight` (≤800px). Синглтон через `createGlobalState`.
  Руками `matchMedia`/`innerWidth` в console-коде не читать.
- **`useConsoleReducedMotion.ts`** — единый JS-источник reduced-motion:
  реактивный `reduced` (`usePreferredReducedMotion` — живёт при смене OS-настройки),
  снапшот `consoleReducedMotionActive()` для plain-модулей, `consoleMotionMs(base)`
  (= `motionMs(base)` нормально / cap 160ms при reduced). CSS-медиа-квери остаются
  как есть; ~5 legacy ручных `matchMedia`-хелперов мигрируют оппортунистически.
  Правило прежнее: reduced — ОТДЕЛЬНАЯ перекрывающая ось, не «быстрее», а
  «короткий/статичный вариант».
- **`useConsoleFocusFrame.ts`** — measured-rect провайдер (`useElementBounding`)
  под статичные measured-рамки. Живая скользящая рамка выделения РЕАЛИЗОВАНА как
  `ConsoleCardFocusFrame.vue` (см. §Card-deal ниже) и осознанно НЕ на этом провайдере:
  `useElementBounding` не реагирует на transform-анимации цели (focus lift/scale),
  поэтому рамка ведёт собственный FPS-gated rAF-measure loop (один
  getBoundingClientRect за кадр). Провайдер остаётся для рамок вокруг статичных целей.

## §7. Как добавлять новое (правила)

- **Новый hotkey** → запись в `CONSOLE_KEY_BUTTON`/`CONSOLE_KEY_NAV`
  (consoleActionModel) — НИКОГДА локальный `window.addEventListener('keydown')` в
  компоненте. Новый семантический глагол → член `ConsoleAction` + запись в базовую
  карту или override экрана.
- **Новый console-native ЭКРАН** (владелец viewport) → `useConsoleNativeSurface()` в
  setup + `useConsoleInput({...})` (или `installMenuPad` до игры) + скролл только через
  `ConsoleScrollArea` + регистрация в leak-detector (SERVING_SURFACES/KIND_SURFACES —
  прежнее правило).
- **Новый console-native МОДАЛ / overlay** (внутри уже-залоченного экрана — НЕ
  зовёт `useConsoleNativeSurface`, наследует политику):
  1. scroll-зона → `<ConsoleScrollArea class="X__scroll" content-class="X__scroll-body" ref="scroll">`;
     курсор держать в зоне видимости через `ensureVisible(el)` (никогда
     `scrollIntoView`); CSS split — host `{flex:1; min-height:0}`, layout на
     content-class; `overflow-y:auto` + `.con-scrollbars()` УБРАТЬ.
  2. input через `handleIntent(intent)` (шелл/секция делегирует) — переключаться на
     `consoleActionOf(intent, OVERRIDES)`, НЕ на сырые имена кнопок. Confirm-модал →
     `{confirm:'confirm', back:'cancel'}` (пример: ConsoleHydroConfirm/ConsoleMaConfirm).
  3. НЕ добавлять `keydown`/gamepad listener — интенты уже приходят через слот.
- **Новая анимация** → `.con-motion-clip` + `.con-motion-layer`; `transition: all`
  запрещён — вместо него миксин `.con-visual-transition(<dur>)` (анимирует только
  transform/opacity/цвет/тень, НЕ layout); длительности через
  `consoleMotionMs`/`motionMs`/`--motion-scale`; проверка `reduced`.
- **Документируемое исключение** для scroll-зоны допустимо, если зона: (а) по дизайну
  ВСЕГДА влезает (safety-valve), и (б) chrome-less (`.con-scrollbars()`), и (в) без
  cursor-driven scroll (нет `scrollIntoView`) ИЛИ имеет тонко-настроенный flex-контракт,
  который block-viewport ConsoleScrollArea сломает. Пометить комментарием в CSS
  (пример: `.con-govsupport__panel`, `.con-colonies__scroll`).
- **Пилот-примеры**: ConsoleMainMenu / ConsoleCreateGame / ConsoleLaunchPanel /
  ConsoleShell (surface + ScrollArea + семантический input); модалки ActionComposer /
  PlayCardConfirm / ColonyTradeConfirm (ScrollArea+ensureVisible); list-экраны
  Sheet / MaScreen / StdProjects (ScrollArea, убран видимый thin-scrollbar).

## §9. Dependency policy

- `@vueuse/core@14.3.0` — DEFAULT для новых кросс-срезовых нужд (listeners, resize,
  media, scroll-lock, reduced-motion). Точная версия (`--save-exact`).
- **`gsap` + `motion-v` ПОДКЛЮЧЕНЫ** (задача card-deal cinematic, см. §Card-deal):
  РАЗДЕЛЕНИЕ РОЛЕЙ СТРОГОЕ — `gsap` = ПОСТАНОВОЧНЫЕ одноразовые timeline-сцены
  (раздача/reveal/handoff: staged полёты, stagger, per-card handoff-колбеки,
  skip/kill lifecycle); `motion-v` = ПОСТОЯННЫЕ интерактивные состояния
  (скользящая focus-рамка: прерываемые springs с сохранением velocity при
  быстрых d-pad-чейнах). НЕ размазывать `gsap.to()` по компонентам — только
  через director-модули (`cardDealDirector.ts` — образец); НЕ использовать
  motion-v для одноразовых сцен (там нужен timeline-контроль). Обе длительности
  идут через `motionMs()`/`consoleMotionMs` — пресеты скорости масштабируют всё.
- `@vueuse/components` / `@vueuse/integrations` / внешние UI-либы — можно ПРЕДЛОЖИТЬ,
  но только с обоснованием: конкретный use case, альтернативы, стоимость зависимости,
  почему лучше своего решения. НЕ добавлять «потому что можно». Для одного мелкого
  кейса — не брать; для повторяющейся архитектурной проблемы — обсудить.
- Кандидаты «подумать шире» (по ситуации, НЕ сейчас): специализированная overlay-scroll
  либа — если кастомный rail ConsoleScrollArea окажется недостаточным для всех
  сценариев; Floating UI — при сложном popover/tooltip positioning; focus-trap — ТОЛЬКО
  для non-console DOM-fallback модалок (console-навигация НЕ должна снова стать
  DOM-focus based); Rive — НЕ добавлен (для текущих задач не нужен).
- Своё сильнее generic: `gamepadPollModel`/`gamepadCore` (НЕ `useGamepad`),
  `consoleActionModel` keyboard-map (НЕ `useMagicKeys`) — не заменять.

### Принятые в форк (аудит 2026-07-10 — реестр сайтов)

Забраны после аудита РЕАЛЬНЫХ hand-rolled паттернов (не по каталогу фич). Всё из
`@vueuse/core` (установлен), tree-shakeable — новых пакетов ноль.
- **`useClipboard`** — GameHome (убран ручной `execCommand('copy')`-танец +
  leaking `setInterval` через `refAutoReset`), EndgameResultsOverlay (убран
  `setTimeout` + navigator.clipboard-ветвление), BugReportDialog (+legacy-fallback).
- **`onClickOutside`** — 4 dropdown/popover: JournalFilterSelector,
  JournalGenerationSelector, HandCardsFilters (`.hand-sort`), InitialDraftFinalConfirm
  (`editWrapper`). Паттерн: перенести `open` в setup-ref + `onClickOutside(root, …)`,
  убрать ручной `document mousedown`-capture. **SlotColorPicker — ОСТАВЛЕН manual**
  (телепорт-popover со связанным attach/detach mousedown+scroll+resize по open/close —
  onClickOutside фрагментирует чистый lifecycle).
- **`useEventBus`** → `notificationBus.ts` — 3 события (`goToAction`/`cancel`/
  `focusActions`) вместо `tm-notification-*` window-CustomEvents; dispatch в
  NotificationLayer, listeners в PlayerHome/ConsoleShell/MandatoryInputModal/
  InitialDraftFlowOverlay (`.on()` → off-handle в beforeUnmount).
- **`usePreferredReducedMotion`** → `utils/reducedMotion.ts` (ОДИН источник):
  `changeFeedbackManager.prefersReducedMotion` делегирует (был cache-forever
  snapshot — теперь LIVE), 5 hand-rolled matchMedia убраны (AnimatedScaleMarker,
  aresMarkerGlide, hazardIntensifyState, ConsoleReveal/StartScene через
  `consoleReducedMotionActive`); `useConsoleReducedMotion` делегирует (один MQL-listener).
- **`useIntervalFn`** — GamepadLayer focus-tick (pausable; start/stopTick = resume/pause,
  авто-pause на unmount). Approved для новых component-scoped таймеров.
- **`refAutoReset`** — GameHome «какой id скопирован» (авто-сброс 3с).

### Approved-for-new (без форсированной миграции существующего)
- **`useElementBounding`** — уже в `useConsoleFocusFrame`; существующие reposition-
  popover (SpecialCellInfoOverlay/FinalScoringReveal/scaleTooltipState) — perf-tuned
  rAF, мигрировать по мере касания.
- **`useScroll`** — для нового scroll-position. **JournalFeed — DEFER**: `atBottom`
  и derived, и ИМПЕРАТИВНО ставится после программного smooth-scroll (мост через
  in-flight анимацию); read-only `arrivedState` вернёт race при append во время скролла.
- **`useIntervalFn`/`useTimeoutFn`** — component-scoped таймеры (module-level поллы —
  `joinGamesState`/`realtimeService` — меньше выигрыша, нет scope).

### Rejected (наше умнее / не фитит — та же дисциплина, что useGamepad)
- **`useIdle`** — NotificationCard AFK имеет pointer-travel threshold (игнорит 1px-
  дрожь) + inputModeState гистерезис; наивный event-reset регрессирует.
- **`useFullscreen`** — `consoleModeState` держит gesture-retry (геймпад-ввод не даёт
  trusted-activation в Chromium → arm one-shot на след. trusted-жест); useFullscreen молча провалится.
- **`useTitle`** — `documentTitle.ts` тривиален; `WaitingFor` title мигает через interval.
- **`useDraggable`** — наш `draggable.ts` = click-vs-drag threshold + suppress-click +
  viewport-clamp; useDraggable не покрывает.

## §10. Card deal cinematic + selection motion (карточные экраны)

Premium-подача раздачи/выбора карт (стартовые корпорации/прелюдии/проекты, ceremony-
кандидаты, драфт/покупка в TaskHost). Файлы: `src/client/console/cardDeal/`
(`cardDealModel.ts` — PURE тайминги/план, unit-tested; `cardDealMemory.ts` — «уже
раздавали» module-set; `cardDealSequence.ts` — reactive-клей per-host;
`cardDealDirector.ts` — GSAP timeline) + `src/client/components/console/cardDeal/`
(`ConsoleCardFaceLite.vue` — честная lite-карта; `ConsoleCardDealLayer.vue` — fixed
слой полёта; `ConsoleCardFocusFrame.vue` — motion-v рамка) +
`src/styles/console_card_deal.less` + арт-хук `src/client/cards/cardArt.ts`.

Контракты:
- **Карты раздаются В ТЕ ЖЕ слоты**: real `<Card>` пре-монтируются в финальном
  layout и держатся классом `.con-deal-hold` (`opacity:0 !important` — important
  бьёт CSS-анимации по каскаду; снятие класса едет на СОБСТВЕННОМ 160ms opacity-
  transition слота = это и есть handoff fade-in). Ноль layout shift.
- **Lite-proxy = та же карта в lite-режиме — ПОЛНОЕ печатное лицо, лёгкая только
  по СТОИМОСТИ**: реиспользует РЕАЛЬНЫЕ классы фрейма (`.card-container.filterDiv`
  + `.card-content-wrapper > .card-title`-структура → scifi-chassis/`:has()`-
  селекторы подхватывают тот же тип-фрейм и corner ticks) и РЕАЛЬНЫЕ
  презентационные компоненты: CardCost/CardTags/CardTitle (per-corp логотип) +
  **CardContent (весь render-DSL: иконки, эффекты, текст) + CardRequirements +
  CardVictoryPoints + CardExpansion** — карта УЗНАВАЕМА в полёте, никакой пустой
  заглушки. Lite = ноль интерактива (нет click/hover/zoom/Teleport/tooltips,
  pointer-events: none), ноль живого состояния (нет resource counter/action-cube/
  preference-логики), один плоский манифест-lookup, render-once (в полёте DOM
  статичен — GSAP двигает композитный слой). Арт: ОДИН источник `cardArtUrl()`
  для proxy И full; никаких blur-up.
- **Хост-паттерн** (ConsoleStartScene / ConsoleTaskHost — образцы): `deal:
  createCardDealSequence()` в data; PRE-FLUSH watcher на deal-identity
  (`dealSignature` / `resetKey`) зовёт `prepareDeal()` — hold ставится ДО первого
  пейнта нового набора; запуск через `setTimeout(motionMs(260))` (пережидает
  `con-task-swap` 160ms) + double-probe стабилизацию rect в `sequence.launch`;
  `handleIntent` первой строкой — `if (deal.state.active) {deal.skip(); return;}`
  (любая кнопка = skip, ввод проглатывается); `footHints` при deal — ТОЛЬКО
  `[A Пропустить]` (бар не обещает недоступный выбор); verdictbar скрыт при deal;
  `beforeUnmount` — `deal.dispose()`. Память раздач — `shouldRunDealOnce(key)`:
  повторный показ того же набора (defer/restore, шаг назад) МГНОВЕННЫЙ.
- **Перф**: transform/opacity only (высота proxy СТАВИТСЯ один раз до полёта, не
  анимируется); полёт на fixed-слое `overflow: clip` (+ `contain`) — оверфлоу-гард
  чист; никаких animated blur/filter; `will-change` живёт только пока жив v-if-слой;
  reduced-motion → БЕЗ полёта/прокси: короткий stagger-reveal ≤160ms, ввод не
  блокируется; safety-timeout жёстко завершает раздачу при замёрзшем rAF.
- **Focus-рамка = ОСНОВНОЙ индикатор навигации по картам ВЕЗДЕ в console-native.**
  `ConsoleCardFocusFrame` (4 L-corner тика, transform-only springs stiffness 420 /
  damping 34; glow слота остаётся — «рамка = прицел, glow = свет»; reduced →
  duration 0). Подключение = ОДНА строка прямым ребёнком корня поверхности:
  `<ConsoleCardFocusFrame selector=".<slot>--focused > .card-container" />` —
  рамка сама резолвит селектор ВНУТРИ родителя каждый measure-тик (scoped: две
  наложенные карточные поверхности — reveal над task host — не крадут цель друг
  у друга), хосту не нужен sync-код. Prop `active=false` гасит рамку (deal
  cinematic). Покрытие: ConsoleStartScene (wizard + ceremony corp/prelude/
  candidates), ConsoleTaskHost (draft/buy/select), ConsoleHandSection
  (`.con-hand__slot--selected`), ConsoleRevealOverlay (drawn/viewer). НЕ карты
  (MA-постеры, std-projects панели, action-тайлы, gov-support брифинг) держат
  свой фокус-стиль — рамка семантически означает именно КАРТУ. Новая карточная
  поверхность ОБЯЗАНА монтировать рамку с своим селектором.
- **Расширение** (received cards / draft rewards / MarsBot reveal): переиспользовать
  sequence+director как есть — хосту нужны только hold-класс на слотах, layer в
  template и 4 строки хост-паттерна выше. Новую хореографию строить В director-
  модуле, не в компоненте.

**§10b. Card EXIT / TRANSFER (обратная сторона цикла — карты уходят со стола).**
Файлы: `cardExitState.ts` (реестр полётов) + `ConsoleCardExitLayer.vue` (ОДИН
app-уровневый стейдж в ConsoleShell, z 11640 — полёт переживает закрытие своего
хоста: взятие последней revealed-карты закрывает оверлей ПОД летящей картой) +
`cardExitDirector.ts` (GSAP-словарь) + `.con-exit-*` стили в console_card_deal.less.

Словарь жестов:
- `runCardTake(source, onLift)` — взять ОДНУ (Reveal A): lift/tilt-бит → уверенный
  нырок в зону игрока (низ-центр — та же география стола, что deck дилера).
- `runCardCollect(sources, onLift)` — «взять все» / покупка research: веер
  СХЛОПЫВАЕТСЯ в аккуратную стопку в точке сбора (повороты сходятся, микро-офсеты
  держат стопку физичной), ОДИН confirmation-pulse, стопка уходит к игроку как
  единый объект. Один timeline на N лёгких твинов; 1 карта деградирует в take.
- `runHeroPick(source, onLift)` — драфт: выбранная = HERO (lift + статичный cyan
  rim на прокси + читаемый бит → уход с достоинством); отвергнутые = ДЕШЁВЫЙ CSS
  `applyDiscardExit` на реальных слотах (дрейф к стороне сброса + fade, стаггер
  инлайн-delay, `forwards` держит до frame-swap) — вторичные по дизайну.
- `runCardTransfer({from, resolveTo, holdFrom, holdTarget, onLift})` — слот→слот
  (рука→композер розыгрыша и ОБРАТНО на cancel): язык zoom-handoff'а — цель
  PRE-hold'ится В ТОМ ЖЕ flush (до её первого пейнта), поллинг стабильного rect,
  прибытие проявляет карту ПОД прокси + crossfade; `holdFrom` опустошает исходный
  слот на время полёта (нет двоения; рука честно восстанавливается — розыгрыш не
  подтверждён).
- `runCardDepart(source)` — SUCCESS-финал композера: карта взлетает ВВЕРХ «на
  стол» (никакого фальшивого возврата в руку, которую она покинула).

**Lifecycle-контракты:** `onLift` — хост коммитит game/UI state ВНУТРИ него
(директор вызывает в кадре, когда прокси уже стоит поверх реальной карты:
same-frame swap, ни мигания, ни задержки сабмита за анимацией); `onTouchdown`
(transfer) — гарантированно один раз на ЛЮБОМ пути (посадка/dive/safety) — хосты
с VUE-managed hold'ами (patch-proof, в отличие от classList) проявляют цель
именно тут. Reduced motion: прокси не спаунятся, onLift+onTouchdown сразу.
Подключено: RevealOverlay (takeFocused/takeAll), TaskHost (commitSingleCard hero
/ confirmCardSetWithExit purchase, 0 picks → только спокойный discard;
`applyDiscardExit({delayMs})` секвенирует: hero-бит ЧИТАЕТСЯ первым, реджекты
сыплются под ним), **StartScene** (commitSinglePickByName hero корп/CEO;
continueWithExit — group-hero collect прелюдий/покупок + discard, 0 → calm;
actByName candidate-hero для drew-1-of-N/DoubleDown/Merger — прелюдии из rail
НАМЕРЕННО без exit'а: карта остаётся на столе «разыгранной»), Shell
(openPlayCardFromHand / onPlayCardCancel / success-depart). Zoom-пути (взять из
fullscreen) сохраняют свой consume-своп.

**Hand↔композер: ОДНА физическая карта (Vue-managed стейджинг).** Слот руки
держится пустым через РЕАКТИВНЫЙ hold (`ConsoleHandSection :stagedCard` →
`con-deal-hold` в :class — patch-proof; runtime-classList Vue сотрёт при патче):
shell `stagedHandCard = pendingPlayCard ?? returningPlayCard ?? departingPlayCard`.
Открытие композера ⇒ hold в том же flush; CANCEL ⇒ `returningPlayCard` держит
слот через закрытие модалки до `onTouchdown` обратного transfer'а (карта
материализуется ровно под прокси); SUCCESS ⇒ `departingPlayCard` держит слот до
РЕАЛЬНОГО ухода карты из руки (watcher handEntriesAll; safety-таймер 6s на
отклонённый розыгрыш) — никакого фальшивого возврата. Фокус-хром руки гаснет под
композером: `body.con-play-modal-open` (те же правила, что `con-zoom-open`) +
FocusFrame читает класс в measure-тике.

## §11. Fullscreen card inspector (открытие/листание/закрытие карт)

Premium-хореография консольного fullscreen-осмотра. Файлы: `consoleCardZoom.ts`
(`ZoomOrigin` + `slotZoomOrigin`), `consoleZoomMotion.ts` (GSAP director:
`playZoomOpen`/`playZoomClose`/`retargetZoomHold`/`releaseZoomMotion`),
`CardZoomModal.vue` (opt-in `consoleMotion` prop), стили в
`console_card_deal.less` (`.con-zoom-hold`, `--flight`, `--closing`, backdrop).

**ГЛОБАЛЬНОЕ ПРАВИЛО «одна физическая карта»:** ВЕЗДЕ, где console-native
показывает мини-карту и её можно открыть на fullscreen, вызов
`openConsoleCardZoom` ОБЯЗАН передавать `origin`: `physical` если на экране есть
видимый card-тайл, из которого «поднимается» карта (её слот держится пустым
`con-zoom-hold` пока карта в fullscreen — не может быть в двух местах),
`textual` если открыто из текст-чипа/имени/графики без card-тайла (честный
inspector-вход, без фальшивого лифта). НИКОГДА не оставлять дефолтный `none`
там, где на экране есть мини-карта. Текущее покрытие:
- **physical**: рука (ConsoleShell hand), StartScene (wizard/summary/ceremony —
  `data-zoom-slot`), TaskHost (draft/buy strip), RevealOverlay (drawn/viewer/
  result/source), **ConsolePlayCardConfirm мини-карта** (`.con-composer__playcard`
  — resolve прямой, одна карта; лифт из композера + возврат в него на close).
- **textual**: журнал, обзор хода бота (ConsoleBotTurnReview + shell MarsBot
  turn), drafted-viewers (shell + TaskHost — открыто из count-чипа), blue-action
  композеры (ConsoleActionComposer/ConsoleCardActions — из графики действия),
  PlayCardConfirm под-выбор целей (текст-строки опций).

**Три source-режима** (`ZoomOrigin.kind`):
- `physical` — открыто из видимого card tile. FLIP-лифт: РЕАЛЬНЫЙ стейдж
  (`.card-zoom-stage`) стартует transform'ом из rect слота и раскрывается в
  identity — та же карта, тот же контент, никакой подмены. Слот карты «в
  руках» держится пустым (`.con-zoom-hold`, ретаргет на каждый browse).
  Закрытие — обратный полёт в слот ТЕКУЩЕЙ карты (`resolve(index)` —
  живой re-query). Невидимый/несуществующий слот → graceful dive-fallback.
- `textual` — открыто из чипа/ссылки/имени (журнал, обзор хода бота):
  честный «инспекторный» вход — подъём из глубины (scale+fade), закрытие —
  погружение. НИКОГДА не фальшивый коллапс в несуществующий слот.
- `none` — дефолт без семантики источника (визуально = textual). Явная
  маркировка `textual` опциональна (сегодня поведение идентично) — маркер
  на будущее + документация намерения в коде.

**Контракты:**
- Подключение physical-хоста: слоты получают `:data-zoom-slot="<key>"`
  (обычно имя карты; `name#i` при возможных дубликатах), вызов
  `openConsoleCardZoom(..., {origin: slotZoomOrigin(getRoot, keyOf, onBrowse)})`.
  `onBrowse(i)` двигает НИЖЕЛЕЖАЩИЙ фокус хоста синхронно с LB/RB — после
  закрытия курсор стоит на последней просмотренной карте, а close-полёту
  есть куда приземляться (виртуализированная рука доскролливает через свой
  index-watcher). Резолв scoped к root хоста — наложенные поверхности не
  крадут слоты друг друга.
- Хром модалки (счётчик/панель действий) скрыт классом `--flight` и
  проявляется ТОЛЬКО после приземления карты; бекдроп фейдится на открытии
  и гаснет ПОД close-полётом (стол уже виден при посадке).
- LB/RB листание (`consoleMotion` в CardZoomModal): ПРЕРЫВАЕМОЕ (rapid
  press = cancel+restart, никакого залипания на длительности анимации) +
  физический page-turn (сдвиг + дуга rotZ вокруг нижнего пивота
  `transform-origin: 50% 120%` + settle-ease). Desktop без пропа —
  байт-в-байт прежний.
- Полёт едет на stage-РОДИТЕЛЕ (GSAP), слайд — на card-РЕБЁНКЕ (WAAPI) —
  вложенные трансформы, конфликтов нет даже одновременно.
- **HANDOFF-закрытие («Разыграть» из fullscreen)**: когда A-действие зума
  ОТКРЫВАЕТ поверхность с этой же картой (play-confirm композер), карта НЕ
  возвращается на стол — `ConsoleZoomAction.handoffTarget(name)` возвращает
  селектор карточного слота новой поверхности, и последовательность такая:
  `execute()` СРАЗУ (композер монтируется ПОД top-layer диалогом) → rAF-поллинг
  ждёт маунт слота + стабильный rect (2 кадра, бюджет 45) → hold переезжает на
  слот композера (стол честно восстанавливается за двумя бекдропами — розыгрыш
  ещё не подтверждён) → полёт fullscreen→слот (`power3.inOut` 340ms) → на
  касании hold снимается (карта композера проявляется ПОД стейджем) → crossfade
  стейджа 130ms → dialog.close(). Слот помечается `data-zoom-handoff="…"`
  (`.con-composer__playcard`). Недождавшийся/нестабильный слот → dive-fallback.
  Ввод проглатывается весь полёт (`zoomClosing`-гейт в handleZoomIntent — ни
  листания улетающей карты, ни двойного execute).
- **Фокус под открытым зумом ГАСНЕТ (идеологический фокус — на fullscreen):**
  shell держит `body.con-zoom-open` (add на open-вотчере, remove в `@close` +
  beforeUnmount), CSS гасит слот-ring'и/glow (`--focused`/`--selected`) и
  «A …»-чипы; transform-lift слота НАМЕРЕННО остаётся (полёты меряют rect —
  сброс scale сдвинул бы точку посадки). Скользящая focus-рамка гасит себя
  сама (ConsoleCardFocusFrame читает `consoleCardZoom.card` в measure-тике).
- Zombie-safe: один module-ctx, kill на каждом open/close, `releaseZoomMotion`
  в `@close` (любой путь закрытия, вкл. нативный Esc), safety-таймеры на
  open-settle и close-resolve. Reduced-motion → короткие fades ≤160ms.
- Покрытие physical: ConsoleStartScene (wizard/summary/ceremony),
  ConsoleTaskHost (draft/buy), рука (shell `zoomHandCard` + `.con-hand`),
  ConsoleRevealOverlay (drawn/viewer/result/source). Textual/none: журнал
  (маркирован), обзор бота, композеры, action-центр — rise-вход
  автоматически. Известная деградация: закрытие МЫШЬЮ по бекдропу /
  нативный Esc на десктоп-пути минует хореографию (мгновенный close) —
  консольные B/X идут через `closeZoomViewer` с полётом.

## §8. Ручной чеклист (прогонять при миграции экранов)

Viewports: Steam Deck 1280×800 (`?consoleProfile=handheld`), 1280×720, desktop
resize вживую. Экраны: главное меню (+Мои игры с длинным списком), создание игры
(все 4 деки + launch-панель + все оверлеи), рука/карты, card fullscreen, «Получены
карты», драфт, колонии, blue-card action center, MarsBot theater, endgame reveal +
итоговый экран. Стресс: RU/EN переключение, длинные имена игроков, длинные названия
карт, 5–6 игроков, все расширения. Критерий: ни одного нативного скроллбара, ни
одного `[console-overflow]` warn в консоли, курсор всегда в видимой зоне списка.

## Статус миграции (живой — обновлять при каждом экране)

**Весь Console Native scope ПОКРЫТ** (каждый компонент = migrated ИЛИ documented
exception с причиной). Кросс-срезовое: raw keydown/gamepad listeners в компонентах — 0;
page-level scrollbar — заблокирован (`html.console-native` surface-lock: ConsoleShell +
оба pre-game экрана); DOM-focus не primary-навигация (курсоры state-driven);
`transition: all` в console — 0 (все 7 → `.con-visual-transition`); raw `resize` — 0
(fit-движки на VueUse); **raw `intent.button` matching — 0 (кроме STICK-кликов, которые
модель намеренно оставляет screen-specific raw)**.

| Экран / компонент | Surface | Scroll | Input | Статус |
| --- | --- | --- | --- | --- |
| ConsoleMainMenu | ✅ | ✅ ScrollArea | ✅ | migrated |
| ConsoleCreateGame | ✅ | ✅ ScrollArea (деки) | ✅ `{secondary:'launch'}` | migrated |
| ConsoleLaunchPanel | (наследует) | ✅ ScrollArea | — | migrated |
| ConsoleShell | ✅ | side-panels 📄 | ✅ (5 switch + все guard-блоки; sticks raw) | migrated |
| ConsoleActionComposer | (наследует) | ✅ ScrollArea+ensureVisible | ✅ (main/sub steppers) | migrated |
| ConsolePlayCardConfirm | (наследует) | ✅ ScrollArea+ensureVisible | ✅ (LT=lanes) | migrated |
| ConsoleColonyTradeConfirm | (наследует) | ✅ ScrollArea+ensureVisible | ✅ | migrated |
| ConsoleCardActions | (наследует) | ✅ ScrollArea (`__list`; `__detail` 📄) | ✅ `{stickR:'reset'}` | migrated |
| ConsoleJournalPanel | (наследует) | ✅ ScrollArea (+`scrollToEnd`; styled bar→rail) | ✅ (sticks raw) | migrated |
| ConsoleSheet / ConsoleMaScreen / ConsoleStdProjectsScreen | (наследует) | ✅ ScrollArea (убран thin-bar) | shell-driven | migrated |
| ConsoleHydroConfirm / ConsoleMaConfirm | (наследует) | — | ✅ `{confirm,back→cancel}` | migrated |
| ConsoleHydroSection | (наследует) | 📄 (rare chrome-less fallback) | ✅ | migrated |
| ConsoleGovernmentSupport | (наследует) | 📄 (always-fit 2×2) | ✅ | migrated |
| ConsoleTaskHost | (наследует) | 📄 (fit-strip + bounded body) | ✅ | migrated · deal ✅ (§10) |
| ConsoleRevealOverlay | (наследует) | 📄 (fit-strip, inline-center bounded) | ✅ (L3 source raw) | migrated |
| ConsoleStartScene | ✅ | 📄 (fit-strip + 3 body-варианта) | ✅ | migrated · deal ✅ (§10) |
| ConsoleColoniesSection | (наследует) | 📄 (flex-центр контракт; resize✅) | shell-driven | migrated |
| ConsoleParticipantEditor / ConsoleProfileEditor | (наследует) | — | ✅ (text-entry + A/B) | migrated |
| ConsoleHandSection | (наследует) | 📄 (свой fit+scroll engine, chrome-less) | shell-driven | doc exception |
| ConsoleColonyInspect / InfoMode / ConsoleContextPanel / ConsoleResourcePanel | (наследует) | 📄 (chrome-less display `.con-info__scroll`) | shell-driven | doc exception |

**Documented scroll-exceptions (все с CSS-комментарием + причиной):** always-fit
(GovSupport 2×2), bespoke-scroll-engine (Hand — `scrollTop`/`scrollHeight` math), flex-
центрирующий контракт (Colonies), fit-strip bounded (TaskHost/Reveal/StartScene), chrome-
less display-панели (Info/ColonyInspect/ContextPanel/Res, CardActions `__detail`).
Общий признак: chrome-less (нативный бар не виден) + либо always-fits, либо cursor-scroll
ограничен in-shell зоной (страница залочена, нет промежуточного scroll-предка).

**STICK-клики (L3/R3) — санкционированный raw:** `consoleActionModel` намеренно НЕ даёт
им base-action (screen-specific: board-inspect / scale-inspect / map-peek / filter-reset /
source-zoom). Экраны читают `intent.button === 'stickL'/'stickR'` напрямую — это НЕ
«локальное понимание advertised-verb», а расширяемая точка (добавить stick-verb → override
`{stickL:'reset'}` как в CardActions, если появится semantic-смысл).

- ⏭ Legacy join/lobby в console-режиме — вне console-native политики до их
  console-native переписывания (window-scroll легитимен, хром скрыт P14). Это
  ЕДИНСТВЕННОЕ, что осталось за рамками (не console-native).
