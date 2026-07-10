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
- `@vueuse/components` / `@vueuse/integrations` / внешние UI-либы — можно ПРЕДЛОЖИТЬ,
  но только с обоснованием: конкретный use case, альтернативы, стоимость зависимости,
  почему лучше своего решения. НЕ добавлять «потому что можно». Для одного мелкого
  кейса — не брать; для повторяющейся архитектурной проблемы — обсудить.
- Кандидаты «подумать шире» (по ситуации, НЕ сейчас): специализированная overlay-scroll
  либа — если кастомный rail ConsoleScrollArea окажется недостаточным для всех
  сценариев; Floating UI — при сложном popover/tooltip positioning; focus-trap — ТОЛЬКО
  для non-console DOM-fallback модалок (console-навигация НЕ должна снова стать
  DOM-focus based); Motion for Vue / GSAP / Rive — для будущих анимаций, отдельно, НЕ
  смешивая с текущим foundation.
- Своё сильнее generic: `gamepadPollModel`/`gamepadCore` (НЕ `useGamepad`),
  `consoleActionModel` keyboard-map (НЕ `useMagicKeys`) — не заменять.

## §8. Ручной чеклист (прогонять при миграции экранов)

Viewports: Steam Deck 1280×800 (`?consoleProfile=handheld`), 1280×720, desktop
resize вживую. Экраны: главное меню (+Мои игры с длинным списком), создание игры
(все 4 деки + launch-панель + все оверлеи), рука/карты, card fullscreen, «Получены
карты», драфт, колонии, blue-card action center, MarsBot theater, endgame reveal +
итоговый экран. Стресс: RU/EN переключение, длинные имена игроков, длинные названия
карт, 5–6 игроков, все расширения. Критерий: ни одного нативного скроллбара, ни
одного `[console-overflow]` warn в консоли, курсор всегда в видимой зоне списка.

## Статус миграции (живой — обновлять при каждом экране)

**Кросс-срезовое (готово):** raw keydown/gamepad listeners в компонентах — НЕТ
(интенты идут через семантический слот; аудит подтвердил); page-level scrollbar —
заблокирован (`html.console-native` surface-lock: ConsoleShell + оба pre-game экрана);
DOM-focus не primary-навигация (курсоры state-driven); `transition: all` в console —
0 (все 7 → `.con-visual-transition`); raw `resize`-listeners в console-компонентах — 0
(3 fit-движка на `useEventListener`/`useResizeObserver`).

| Экран / компонент | Surface | Scroll | Input | Статус |
| --- | --- | --- | --- | --- |
| ConsoleMainMenu | ✅ | ✅ ScrollArea | ✅ consoleActionOf | migrated |
| ConsoleCreateGame | ✅ | ✅ ScrollArea (деки) | raw* | migrated |
| ConsoleLaunchPanel | (наследует) | ✅ ScrollArea | — | migrated |
| ConsoleShell | ✅ | side-panels ⏭ | raw* | surface done |
| ConsoleActionComposer | (наследует) | ✅ ScrollArea+ensureVisible | raw* (степперы) | scroll migrated |
| ConsolePlayCardConfirm | (наследует) | ✅ ScrollArea+ensureVisible | raw* | scroll migrated |
| ConsoleColonyTradeConfirm | (наследует) | ✅ ScrollArea+ensureVisible | raw* | scroll migrated |
| ConsoleSheet | (наследует) | ✅ ScrollArea (убран thin-bar) | shell-driven | migrated |
| ConsoleMaScreen | (наследует) | ✅ ScrollArea (убран thin-bar) | shell-driven | migrated |
| ConsoleStdProjectsScreen | (наследует) | ✅ ScrollArea | shell-driven | migrated |
| ConsoleHydroConfirm | (наследует) | — | ✅ consoleActionOf | input migrated |
| ConsoleMaConfirm | (наследует) | — | ✅ consoleActionOf | input migrated |
| ConsoleGovernmentSupport | (наследует) | 📄 exception (always-fit 2×2) | raw* | doc exception |
| ConsoleTaskHost | (наследует) | 📄 exception (fit-strip + bounded body) | raw* | doc exception |
| ConsoleRevealOverlay | (наследует) | 📄 exception (fit-strip, inline-center bounded) | raw* | doc exception |
| ConsoleColoniesSection | (наследует) | 📄 exception (flex-центр контракт; resize✅) | raw* | doc exception |
| ConsoleHandSection | (наследует) | 📄 candidate (fit-managed, chrome-less) | raw* | pending |
| ConsoleJournalPanel | (наследует) | ⏭ pending (свой premium thin-bar → rail) | raw* | pending |
| ConsoleColonyInspect / InfoMode / ConsoleContextPanel (`.con-inspector` — видимый thin-bar) | (наследует) | ⏭ pending | — | pending |
| ConsoleStartScene | ✅ (resize✅) | ⏭ pending (`__body` + fit-strip) | raw* | pending |
| ConsoleCardActions / Hydro / MarsBotSections | (наследует) | ⏭ pending | raw* | pending |

`*raw` = `handleIntent` пока матчит `intent.button`; поведение уже КОРРЕКТНО
(A=контекстное действие, state-driven — не DOM-клик), миграция на `consoleActionOf` —
консистентность, не багфикс. Гоча: модалки переиспользуют бамперы/триггеры под
внутренние степперы (amount ±, max) — их семантическая миграция требует продуманного
per-modal override (generic-verbs `prevSection`/`nextTab` не совпадают со степперной
семантикой); делать аккуратно против command bar каждого экрана.

**Оставшийся план (порядок пользователя):** hand/cards → card fullscreen → draft →
received cards → blue action center → colonies → wheels → MarsBot theater →
endgame/victory. Для каждого: применить §7-правила модала/экрана, проверить
build+lint+specs, обновить эту таблицу.

- ⏭ Legacy join/lobby в console-режиме — вне console-native политики до их
  console-native переписывания (window-scroll легитимен, хром скрыт P14).
