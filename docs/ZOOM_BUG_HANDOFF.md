# HANDOFF: Console fullscreen zoom — первое открытие показывает пустоту

> **СТАТУС: ЗАКРЫТ (2026-07-14).** Фикс «диалог открывается по-ванильному, полёт летит
> прокси-слоем» (раздел «ФИКС» внизу) подтверждён на целевой машине; вся временная
> `[TM-DIAG zoom]`-диагностика и probe-ручка `tm_zoom_vanilla` сняты. Файл сохранён как
> запись о классе бага (Graphite/DComp: мёртвая поверхность свежего top-layer при
> рождённом-скрытым transform-анимируемом контенте) и об инвариантах, которые нельзя
> нарушать (см. шапку `consoleZoomMotion.ts`).

## Симптом
В console-режиме (Electron, Windows, `?console=1`) fullscreen-осмотр карты («X Осмотреть»)
открывается НЕВИДИМЫМ: экран остаётся прежним (сцена видна), карта не появляется.
Внизу по центру видна только пустая панель действий зума с глифом (A).

## Точное репро (100%, подтверждено многократно)
1. Запустить packaged Electron exe (Windows 11 24H2, гибрид NVIDIA RTX 4070 + Intel Iris Xe,
   встроенный экран 3200×2000 scale 2, 120 Гц; Skia Graphite включён по умолчанию —
   `electron/perf.ts` → `enable-features=SkiaGraphite,SkiaGraphitePrecompilation`).
2. Создать НОВУЮ партию (играет deal-синематика раздачи карт корпораций).
3. НЕ трогая фокус, нажать X (геймпад) на карте с дефолтным фокусом (экран «Выбрать корпорацию»).
→ Зум невидим.

## Что ТОЧНО влияет на репро (все проверено пользователем)
- Сдвинуть фокус на соседнюю карту → открыть её → РАБОТАЕТ.
- Сдвинуть фокус и ВЕРНУТЬ на первую → открыть → РАБОТАЕТ.
- Открыть ЛКМ МЫШЬЮ (та же карта, то же состояние) → РАБОТАЕТ.
  (Мышь идёт через ВСТРОЕННЫЙ зум Card.vue/PremiumCard.vue — другой CardZoomModal-инстанс,
  без консольной хореографии. X идёт через консольный путь: `openConsoleCardZoom` →
  ConsoleShell watcher → CardZoomModal.show() + `consoleZoomMotion.playZoomOpen` FLIP.)
- Выбрать корпорацию не осматривая, открыть карту ПРОЕКТА на 2-м табе → РАБОТАЕТ.
- ЗАГРУЗИТЬ существующую партию (не создавать) → РАБОТАЕТ.
- Второе открытие (B → X снова) → ВСЕГДА РАБОТАЕТ.
- В момент бага: LB/RB (листание) — соседняя карта ТОЖЕ не видна; вернуться — оригинал не виден.
- В момент бага: Esc → КАРТА ПОЯВЛЯЕТСЯ, зум остаётся открытым (counter 1/2 виден).
- Alt+Tab туда-обратно → НЕ помогает.
- `webContents.invalidate()` (полная перерисовка окна из main) → НЕ помогает.

## Состояние DOM в момент бага (диагностический дамп, снят в live)
- `dialog.open=true`, `dialog.matches(':modal')=true` (честный top-layer), единственный открытый dialog.
- dialog rect=0,0 2560×1440, opacity=1, visible, display=flex, z-index=10000.
- `.card-zoom-stage` rect≈856,88 848×1203, opacity=1, visibility=visible, transform=identity.
- Карта (`.card-container.filterDiv.card-auto-tall`) — тот же rect, 6 детей, стили идеальны.
- ANCESTOR SCAN (card→html): ноль подозреваемых (проверялись opacity/visibility/display/mask/
  transform/backface-visibility/content-visibility/perspective/mix-blend-mode/isolation
  + классы con-deal-hold|con-zoom-hold|veil|--flight|--closing).
- LIVE DEAL ELEMENTS: ноль (раздача полностью завершена, прокси в DOM нет).
- `document.elementFromPoint(центр)` = `.card-zoom-card` (hit-test попадает в карту).
- `requestAnimationFrame` ЖИВ в момент бага (rAF-колбэки исполняются, логи печатаются).
- Live-эксперимент: `stage.style.background='red'` — инлайн в DOM появляется, НА ЭКРАНЕ красного НЕТ.
- `webContents.capturePage()` в момент бага: PNG показывает ТО ЖЕ, что видит пользователь —
  сцену БЕЗ диалога (т.е. диалога нет даже в композите рендерера; при этом хром-панель
  действий зума на экране ВИДНА — диалог пейнтится частично либо панель — отдельный слой).

## Что уже ПРОБОВАЛИ и что НЕ помогло (хронология фиксов-неудач)
1. `inert` на warm-up контейнер + проп inert для warm-up карт (изоляция boot warm-up) — не помогло.
2. Self-healing: safety-restore стадии в `playZoomOpen`, bounded-retry открытие в ConsoleShell
   watcher, guard в `CardZoomModal.show()` — не помогло (эти защиты остались в коде, безвредны).
3. Layer-recreate kick (display:none toggle стадии между 2 rAF) — не помогло (УДАЛЁН).
4. Content re-raster (`zoom`-jiggle карты после FLIP) — не помогло (УДАЛЁН).
5. Прогрев top-layer: невидимый `<dialog showModal>` в boot-loader'е (+ карта в zoom-масштабе 2.5) —
   не помогло (код прогрева остался в AppBootLoader).
6. `webContents.invalidate()` — не помогло.
7. Замена скрытия стадии `gsap.set(stage,{autoAlpha:0})` → `{opacity:0.0001}` (без
   visibility:hidden; все open-твины переведены на opacity) — НЕ ПОМОГЛО (изменение осталось
   в коде — оно нейтрально/чище, но баг не решает).

## Ключевые файлы
- Консольный зум-путь: `src/client/console/consoleCardZoom.ts` (module state),
  `src/client/components/console/ConsoleShell.vue` (~2289 watcher + ~323 хост CardZoomModal
  class="con-zoom" :consoleMotion),
  `src/client/console/consoleZoomMotion.ts` (`playZoomOpen`/`playZoomClose` — GSAP FLIP),
  `src/client/components/card/CardZoomModal.vue` (native dialog + showModal + fitCardToViewport
  с CSS `zoom` на карте).
- Вызов X: `ConsoleStartScene.vue` `zoomFocused()` (~989) → `openConsoleCardZoom` c
  `slotZoomOrigin` (origin.kind='physical' → FLIP из слота + `.con-zoom-hold` на слот).
- Ванильный (рабочий) путь мыши: `Card.vue`/`PremiumCard.vue` onClick → собственный
  `<CardZoomModal v-if="showZoom">` без хореографии.
- CSS: `console_card_deal.less` (~184-223: `.con-zoom-hold {opacity:0!important}`,
  `dialog.con-zoom`, `--flight` прячет ТОЛЬКО topbar/actions, backdrop-анимация),
  `console.less` ~8395 (layout-правила dialog.con-zoom), `preferences.less` ~533 (база диалога).
- Возможно релевантное правило: `mandatory_input_modal.less:81-88` —
  `body:has(dialog.card-zoom-dialog[open]) #player-home {&,*{animation-play-state:paused!important}}`.

## Временная диагностика, ОСТАВЛЕННАЯ в коде (снять после решения; список в DIAGNOSTIC_CLEANUP.md)
- `consoleZoomMotion.ts`: `zlog()` трасса + `zdump()` (полный DOM/стили/диалоги/deal дамп через
  ~1.3с после открытия).
- `ConsoleShell.vue` watcher + `CardZoomModal.vue` show()/fit: `[TM-DIAG zoom]` console.warn'ы.
- `electron/main.ts` `installDiagnostics`: хоткеи F1(invalidate)/F2..F10/F12 + `[TM-DIAG]`
  GPU-отчёт в renderer-консоль + child-process-gone логгер.

## Контекст (недавние изменения, на фоне которых баг замечен)
- Включён Skia Graphite по умолчанию на Windows (`electron/perf.ts`) — дал большой прирост
  плавности; отключение Graphite как фикс НЕ рассматривается.
- Добавлен boot warm-up (AppBootLoader: невидимый рендер карт/board-элементов + top-layer
  dialog за загрузочным экраном при первом запуске сессии).
- НЕ проверялось: воспроизводится ли баг при `TM_ELECTRON_FEATURES=none` (Graphite off, хоткей F3)
  на свежей сессии — этот эксперимент даст связь бага с Graphite.
- НЕ проверялось: воспроизводится ли баг с пропуском warm-up
  (`localStorage.tm_boot_warmup_done='1'` до первой партии).
- НЕ проверялось: воспроизводится ли в браузерной версии (не Electron) console-режима.

## Требование к решению
Нужен корневой фикс (не «пинки»/перерисовки на каждое открытие). Отключение Skia Graphite —
не вариант. Премиум-анимации (FLIP-полёт) должны сохраниться.

---

## ФИКС (2026-07-14): «диалог открывается по-ванильному, полёт летит прокси-слоем»

### Диагноз (модель отказа, объясняющая ВСЕ наблюдения)
Слои, СОЗДАННЫЕ в первые кадры свежей top-layer-поверхности диалога (в «отравленном»
состоянии сцены после deal-синематики), не презентуются; слои, промоутнутые позже, — живые:
- панель действий/counter стартуют в `opacity:0` (`--flight`) и промоутятся transition'ом
  на settle (+380мс, ПОСЛЕ окна) → видны; stage прятался GSAP'ом и transform-анимировался
  С ПЕРВОГО кадра → его слой создан в окне → мёртв; `::backdrop` имел keyframe-анимацию с
  кадра 0 → тоже мёртв (сцена не затемнялась).
- `background:red` (paint-инвалидация) не оживлял, а Esc (→ close-flight: НОВЫЙ GSAP-твин +
  флип `--closing` = перестройка структуры слоёв) оживлял → смерть на уровне
  структуры слоёв/DComp-визуалов, не paint'a.
- capturePage не видел диалог, хотя панель была на экране → контент уходил в отдельные
  DComp-визуалы мимо readback (Graphite + DirectComposition, гибрид NVIDIA→Intel scanout).
- ЛКМ-путь (ванильный showModal: статичный полностью видимый контент, без анимируемого
  backdrop) работал В ТОМ ЖЕ состоянии сцены → безопасная компоновка известна точно.

### Решение
Console-зум переведён на паттерн остальных полётов форка (deal / exit / board-bonus —
ни один не ловил баг): `showModal()` вызывается ТОЛЬКО в момент касания, первый top-layer
кадр = финальный статичный полностью видимый контент; премиум-FLIP летит ПРОКСИ
(`CardZoomCard`) на обычном fixed-слое.
- `CardZoomModal.measureLanding()` — замер посадочной геометрии на ЗАКРЫТОМ диалоге
  (inline `display:flex; visibility:hidden` — layout идентичен открытому, ничего не
  пейнтится; fit-движок прогоняется как обычно, кэш натуральных размеров прогрет).
- `consoleZoomMotion.playZoomOpenFlight()` — прокси-полёт слот→посадка (или rise-from-depth
  для textual/none); `beginZoomOpen`/`cancelZoomOpen` — арминг/отмена; safety-таймер
  гарантирует show даже при заглохшем rAF.
- `ConsoleShell.runZoomOpen()` — оркестрация: замер → вуаль `.con-zoom-veil` (те же пиксели,
  что `::backdrop`) → прокси-FLIP на `.con-zoom-flight-layer` → show на касании → прокси/вуаль
  снимаются, когда top layer уже накрыл их. Все отложенные колбэки за token-fence.
- CSS: keyframe-анимация `con-zoom-backdrop-in` на `::backdrop` УДАЛЕНА (второй ингредиент
  бага); close-фейд оставлен. НЕ переанимировать backdrop на открытии и не возвращать
  скрытие/transform реального stage на первых кадрах диалога.

### Проверка на целевой машине
ПРОЙДЕНА (2026-07-14): штатное репро больше не воспроизводится, фикс утверждён.
`[TM-DIAG zoom]`-диагностика и probe-ручка `tm_zoom_vanilla` сняты (DIAGNOSTIC_CLEANUP.md).
Если класс бага когда-нибудь вернётся в ДРУГОМ месте: изолировать хореографию ванильным
открытием, затем A/B `--disable-direct-composition` / `TM_ELECTRON_GPU=low` (F7) /
Graphite off (F3) — и репорт в Electron/Chromium.
