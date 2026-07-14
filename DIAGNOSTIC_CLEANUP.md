# DIAGNOSTIC_CLEANUP.md — временные диагностические костыли (снять в финале)

Во время расследования перформанса Electron на Windows (jank анимаций → диагноз
layer-explosion + DirectComposition → фикс Skia Graphite) были добавлены ВРЕМЕННЫЕ
диагностические механизмы. Ниже — полный список для удаления после того, как перф-работа
(включая loading screen + shader warm-up) будет завершена и подтверждена.

**НЕ удалять (это постоянные фиксы, не костыли):**
- `electron/perf.ts` — Skia Graphite по умолчанию на Windows (`SkiaGraphite,SkiaGraphitePrecompilation`) — ЭТО ФИКС.
- `electron/perf.ts` env-ручки `TM_ELECTRON_FEATURES` / `TM_ELECTRON_GPU` / `TM_ELECTRON_ANGLE` / `TM_ELECTRON_GL` — полезны для отката/других машин, можно оставить (тихие, off-by-default).
- `electron/perf.ts` `logGpuStatus()` — тихая одна строка в main stdout, полезна, можно оставить.
- Loading screen + shader warm-up (когда сделаем) — ЭТО ФИЧА.

**УДАЛИТЬ (диагностические костыли):**

### `electron/main.ts` — СНЯТО 2026-07-14 ✓ (компилится чисто, `signalGpuReadyWhenLive` + `logGpuStatus` сохранены)
- ~~`installDiagnostics(win)`~~ — удалена функция + вызов (хоткеи F1–F12 + `did-finish-load` GPU-репорт).
- ~~`printGpuDiag(win)`~~ — удалена (renderer-console дамп `[TM-DIAG]`).
- ~~`child-process-gone` логгер~~ — удалён из `whenReady`.
- ~~`TM_ELECTRON_GPUINFO` хук~~ — удалён (`loadURL` теперь безусловно `initialUrl()`).
- ~~`PERFTEST` const + argv + окно 1280×800~~ — удалены; окно вернулось к `1440×900`, `fullscreen: FULLSCREEN`, `leave-full-screen` guard = `if (FULLSCREEN)`.
- ~~argv relaunch-мостики наверху модуля~~ — удалены; остался только `applyPerformanceSwitches(app)`. Env `TM_ELECTRON_*` ручки в `perf.ts` сохранены (юзер их просил).

### `electron/perf.ts` — РЕШЕНИЕ: ОСТАВЛЯЕМ как ручки (юзер явно просил переключатели)
- `TM_ELECTRON_NO_PERF` / `TM_ELECTRON_GPU` / `TM_ELECTRON_ANGLE` / `TM_ELECTRON_GL` / `TM_ELECTRON_FEATURES` — тихие, off-by-default, полезны для отката/других машин. Покрыты `tests/electron/perf.spec.ts` (оставляем).

**ОСТАЁТСЯ как фичи (не костыли):**
- warm-up top-layer `<dialog>` в AppBootLoader (`boot-loader__warm-dialog`) — прогрев Graphite-пайплайна top-layer при загрузочном экране, часть warm-up фичи.
- `inert` prop на `Card.vue`/`CardFace.vue`/`PremiumCard.vue` — стал общим API карты (используется в `CardZoomCard`, `ConsoleCardFaceLite`, AppBootLoader), не dead-код.

### Zoom first-open диагностика — СНЯТА 2026-07-14 (фикс подтверждён на целевой машине)
Вся `[TM-DIAG zoom]`-диагностика (zlog/zdump в `consoleZoomMotion.ts`, warn'ы в
`ConsoleShell.vue`/`CardZoomModal.vue`, probe-ручка `tm_zoom_vanilla`) удалена. Остались
ПОСТОЯННЫЕ фиксовые части: прокси-полёт открытия (`runZoomOpen`/`playZoomOpenFlight` +
`measureLanding()` + token-fence), bounded-retry `tryOpen` и `showRetries`-guard.
Сам фикс описан в ZOOM_BUG_HANDOFF.md.

### `tests/electron/perf.spec.ts` — ОСТАЁТСЯ
Ручки сохранены → тесты остаются как есть.

### `package.json` — САМОСИНК 2026-07-14 ✓
- `version` теперь синкается сам: `scripts/sync-version.mjs` (`npm run version:sync`) якорит его на самый свежий `v1.1.N` git-тег. Вшит в `build:desktop` → любая локальная desktop/pack-сборка выравнивает версию автоматически. Идемпотентен, no-op вне git / без тега.
- Релизная версия всё равно authoritative из CI (`.github/workflows/release.yml` → `1.1.${github.run_number}` через `npm version --no-git-tag-version`) — закоммиченное значение косметическое, самосинк лишь убирает дрейф.
- Текущее значение: `1.1.256` (= последний релиз). Диагностический `1.0.8` убран.

### Диагностические хоткеи (справка, что делают — все под снос)
F2 graphite+precompile · F3 graphite off · F4 graphite on · F5 fill-rate (маленькое окно 1:1) ·
F6 default relaunch · F7 iGPU · F8 vanilla (no-perf) · F9 back to game · F10 chrome://gpu ·
F12 DevTools.

---
Связано: `PERFORMANCE_AUDIT.md` (Iteration 3), memory `electron-performance-initiative`.
