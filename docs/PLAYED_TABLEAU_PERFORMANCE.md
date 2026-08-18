# Полное tableau («Разыграно») — performance-итерация

Дата: 2026-08-19. Область: производительность полного tableau игрока (X с
board home и embedded-вход из Информационного workspace — ОДИН компонент
`ConsolePlayedOverlay`), масштабирование до 200+ карт. Визуальная концепция
(категорийная навигация, физические перелёты, peek-стопки) не менялась.

## TL;DR

Профилирование production-сборки нашло два системных дефекта, ни один из
которых не был «слишком много DOM»:

1. **GSAP-репарентинг прокси в `<html>`.** `gsap._getMatrix` считает цель с
   `offsetParent === null && rect.width === 0` «отсоединённой» и ВРЕМЕННО
   переносит её в `<html>` для измерения матрицы. Шасси `.con-deal-proxy` —
   `position: fixed` (offsetParent всегда null) с auto-шириной и
   absolute-контентом (rect 0×0) → каждый прокси категорийного полёта делал
   2 мутации детей корня документа, каждая — style+layout-инвалидация всего
   документа. 49 прокси = 98 корневых мутаций за один спавн.
   **Фикс:** интринсик-размер шасси (`width: 320px; height: 460px` — директор
   всё равно переписывает до reveal). Это чинит ВСЕ карточные кинематики
   консоли (deck deal, hand reveal, discard, hero — общее шасси).

2. **`.con-root:has(...)` — style-recalc всего документа на каждый кадр.**
   Blink переоценивает корневой `:has()` на мутациях поддерева и вешает на
   `.con-root` SUBTREE-инвалидацию (~9400 элементов за проход, десятки раз за
   эпизод). Платила каждая анимация консоли; больше всех — большие поверхности.
   **Фикс:** `conWsPresenceBridge.ts` — один MutationObserver на корне шелла
   поддерживает классы `con-root--ws-open` / `--ws-dockcover` / `--pfocus`
   с точной семантикой `:has` (присутствие в DOM, включая leave-переход).
   Правило: новые корневые presence-флаги — только через мост, `:has()` на
   `.con-root`/`body`/`html` запрещён (см. `.claude/rules/console-ui.md`).

Эффект на категории из ~50 карт (n100-сейв, 1280×800, без троттлинга):
UpdateLayoutTree за эпизод открытия **4 994 ms → 213 ms (−96%)**; полностью
исчезли полнодокументные recalc-проходы.

## Архитектура рендера (bounded, поверх существующей концепции)

- **Стол**: peek-стопки как были (peek-лица без арта/механик — прошлая
  итерация). Новое — **staged mount (hydration)**: слоты-геометрия рендерятся
  все сразу (раскладка, счётчики, скролл и rect'ы точны с первого кадра),
  ЛИЦА приезжают волнами по ~36 на rAF-тик под 180-мс entrance-фейдом.
  Стол ≤60 лиц монтируется синхронно (историческое поведение); hero-сцена —
  всегда синхронно (полёт меряет реальные слоты).
- **Категория**: грид был оконным (renderRows + OVERSCAN 2) — остался; лица
  грида теперь монтируются ОТЛОЖЕННО в frame-beat (220 ms), пока прокси ещё
  стоят сверху, и dissolve гейтится на их фактический paint (nextTick + 2
  кадра) — открытие никогда не платит за два полных набора карт в одном
  flush.
- **Полёты ограничены**: летят карты, приземляющиеся в видимое окно грида
  (+ overscan) + хвост ≤10 для языка «в скролл»; остальные РАСТВОРЯЮТСЯ на
  месте (opacity на `__lift`, класс `--grounded`) и проявляются на месте при
  закрытии. Малые категории (выигрыш <8 прокси) летят целиком — прежняя
  хореография. Чистый планировщик: `plannedFlightIndices`
  (`consolePlayedCategoryModel.ts`), спек-гварды в
  `consolePlayedCategoryModel.spec.ts`.
- **Идентичность**: hold-слоты (visibility) — только летящие; «логически
  отсутствуют» (счётчик событий, full-ghost) — вся категория
  (`categoryOutNames` / `categoryAwayNames` / `categoryGroundedNames`).

## Data layer

- **Кэш VM печатного лица** (`PremiumCard.printedFaceVm`): name-only лицо —
  чистая функция манифеста; VM строится один раз за сессию на имя (раньше —
  на каждый mount каждого из 100+ лиц). Live-model путь не кэшируется.
- **Мемо доп-ресурсов** (`additionalResources.groupsMemo`, WeakMap по
  identity массива tableau): всегда смонтированная панель ресурсов больше не
  делает O(n)-проход по 200 картам на каждый ответ сервера (structural
  sharing гарантирует смену ссылки при изменении).
- Закрытое состояние и так было чистым (v-if, полный teardown директора,
  нет O(n)-подписчиков) — подтверждено аудитом и idle-окнами пробы.

## Изображения

- **Thumb-тир арта**: `assets/card-images/thumb/<key>.webp`, 512×341
  (`scripts/make-card-art-thumbs.mjs`, в цепочке `make:cards`; 480 файлов,
  11.2 MiB против 133 MiB full; ~0.7 MiB декода против ~6 MiB на карту).
  Потребители: стопки стола (всегда), грид категории и прокси при ширине
  карты ≤520 CSS px (`artTierForWidth`), single-стейдж и всё остальное — full.
  Цепочка отказа: thumb → full → `-1.webp` → процедурный фон (стейл-чекаут
  не теряет картинку).
- **Прогрев full-арта фокусной карты** в thumb-гриде (debounce 160 ms) —
  fullscreen-инспектор открывается на уже декодированной картинке.
- **HTTP-кэш**: карт-арт на web-проде теперь `public, max-age=86400` (+ETag)
  вместо `must-revalidate` (Electron и так шлёт `immutable`).

## Замеры

Проба: `tests/e2e/console-played-perf-probe.spec.ts` (гейт `PLAYED_PERF=1`),
сейвы: `scripts/perf/seed-played-tableau.ts` (20/50/100/200 карт, LocalFilesystem).
Профили: deck-handheld 1280×800 + CPU×4 (прокси Steam Deck) и tv-4k 3840×2160.
Атрибуция: `scripts/perf/trace-open.mjs` (+`trace-invalidation.mjs`,
`find-mutator.mjs`, `find-html-appender.mjs`).

<!-- RESULTS_TABLE -->

## Ограничения

- Замеры сделаны на Windows dev-боксе (headless Chromium, BeginFrame-пампинг,
  CPU-троттлинг ×4 как прокси Deck) — реальный Steam Deck не был доступен в
  этой сессии; профиль перфа согласован с прежними наблюдениями (main-thread
  style-recalc bound). Абсолютные числа на Deck будут отличаться, порядок
  выигрыша — нет.
- «Nodes» из CDP в первом базлайне рос от цикла к циклу — артефакт пробы
  (недиспоузнутые ElementHandle пиннили detached-деревья); проба переведена
  на locator-ожидания + GC перед чтением.

## Файлы

Рендер: `ConsolePlayedOverlay.vue`, `ConsolePlayedPile.vue`,
`ConsolePlayedCategoryView.vue`, `consolePlayedCategoryModel.ts`,
`playedCategoryView.ts`. Карта: `PremiumCard.vue`, `PremiumCardArt.vue`,
`ConsolePlayedCardLite.vue`, `cardArt.ts`. Инфраструктура:
`conWsPresenceBridge.ts`, `additionalResources.ts`, `ServeAsset.ts`,
`console.less`, `console_played.less`, `console_card_deal.less`,
`scripts/make-card-art-thumbs.mjs`, `scripts/perf/*`.
