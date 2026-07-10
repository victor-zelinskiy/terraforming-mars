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
  `createGlobalState`.
- **Только через adapter (не звать напрямую из компонентов):**
  - `useScrollLock` → `consoleNativeSurface.ts` (page-lock — единая политика, не
    per-component);
  - `usePreferredReducedMotion` → `useConsoleReducedMotion.ts`;
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
  под будущую движущуюся premium-рамку выделения (Motion for Vue задача): `frameStyle`
  (transform/size — GPU-path) для fixed-слоя. Пока никем не потребляется — задел.

## §7. Как добавлять новое (правила)

- **Новый hotkey** → запись в `CONSOLE_KEY_BUTTON`/`CONSOLE_KEY_NAV`
  (consoleActionModel) — НИКОГДА локальный `window.addEventListener('keydown')` в
  компоненте. Новый семантический глагол → член `ConsoleAction` + запись в базовую
  карту или override экрана.
- **Новый console-native экран** → `useConsoleNativeSurface()` в setup +
  `useConsoleInput({...})` (или `installMenuPad` до игры) + скролл только через
  `ConsoleScrollArea` + регистрация в leak-detector (SERVING_SURFACES/KIND_SURFACES —
  прежнее правило).
- **Новая анимация** → clip-wrapper паттерн; длительности через
  `consoleMotionMs`/`motionMs`/`--motion-scale`; проверка `reduced`.
- **Пилот-примеры**: ConsoleMainMenu (surface + семантический `consoleActionOf` +
  ScrollArea списка игр + `keepGamesCursorVisible`), ConsoleCreateGame (surface +
  ScrollArea deck-зоны + `keepDeckCursorVisible`), ConsoleLaunchPanel
  (`contentClass`+`fill` миграция `.cm-launch__scroll`), ConsoleShell (surface).

## §8. Ручной чеклист (прогонять при миграции экранов)

Viewports: Steam Deck 1280×800 (`?consoleProfile=handheld`), 1280×720, desktop
resize вживую. Экраны: главное меню (+Мои игры с длинным списком), создание игры
(все 4 деки + launch-панель + все оверлеи), рука/карты, card fullscreen, «Получены
карты», драфт, колонии, blue-card action center, MarsBot theater, endgame reveal +
итоговый экран. Стресс: RU/EN переключение, длинные имена игроков, длинные названия
карт, 5–6 игроков, все расширения. Критерий: ни одного нативного скроллбара, ни
одного `[console-overflow]` warn в консоли, курсор всегда в видимой зоне списка.

## Статус миграции

- ✅ Пилот: главное меню, создание игры, ConsoleShell (surface-lock), launch-панель.
- ⏭ Остальной flow (рука/карты, wheels, колонии, драфт, модалки, theater, MarsBot,
  endgame): экраны УЖЕ под page-lock'ом ConsoleShell; осталось перевести их внутренние
  `overflow-y:auto` (`.con-scrollbars()`-места) на ConsoleScrollArea + семантические
  actions — постепенно, экран за экраном.
- ⏭ Legacy join/lobby в console-режиме — вне console-native политики до их
  console-native переписывания.
