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

### `electron/main.ts`
- `installDiagnostics(win)` — вся функция (хоткеи F2–F12 через `before-input-event` + `did-finish-load` GPU-репорт). Снять вызов `installDiagnostics(mainWindow)` в `createWindow`.
- `printGpuDiag(win)` — вся функция (renderer-console дамп `[TM-DIAG]`).
- `child-process-gone` логгер в `whenReady` (красный `[TM-DIAG]` при падении GPU-процесса).
- `TM_ELECTRON_GPUINFO` хук (`gpuInfo` const + `loadURL('chrome://gpu')` ветка) в `createWindow`.
- `PERFTEST` const + `--tm-perftest` argv + `force-device-scale-factor` + окно 1280×800 / `fullscreen: FULLSCREEN && !PERFTEST` (вернуть `fullscreen: FULLSCREEN` + width/height 1440/900) + `leave-full-screen` guard вернуть на `if (FULLSCREEN)`.
- argv relaunch-обработчики наверху модуля: `--tm-no-perf`, `--tm-gpu-low`, `--tm-graphite`, `--tm-no-graphite`, `--tm-graphite-precompile`. (Env `TM_ELECTRON_*`, на которые они мапятся, можно оставить как ручки — удалить только argv→env мостики и хоткеи.)

### `electron/perf.ts`
- `TM_ELECTRON_NO_PERF` kill-switch (ранний `return`) — диагностический, снять (или оставить как аварийный, на усмотрение).
- `TM_ELECTRON_GPU=low`/`none` ветка + `TM_ELECTRON_ANGLE`/`TM_ELECTRON_GL` — если решим не оставлять как ручки, снять. (Дефолт `force_high_performance_gpu` вернуть безусловным, если убираем `TM_ELECTRON_GPU`.)

### `tests/electron/perf.spec.ts`
- Тесты, покрывающие удаляемые ручки (`TM_ELECTRON_GPU=low/none`, `TM_ELECTRON_NO_PERF`, `TM_ELECTRON_ANGLE=gl`, `TM_ELECTRON_FEATURES` override/none) — привести в соответствие с тем, что оставим.

### `package.json`
- `version` был поднят `1.0.7 → 1.0.8` для автоапдейта во время теста. У юзера отдельная схема версий (сборки шли как 1.1.x). Проверить/выровнять при финальном релизе.

### Диагностические хоткеи (справка, что делают — все под снос)
F2 graphite+precompile · F3 graphite off · F4 graphite on · F5 fill-rate (маленькое окно 1:1) ·
F6 default relaunch · F7 iGPU · F8 vanilla (no-perf) · F9 back to game · F10 chrome://gpu ·
F12 DevTools.

---
Связано: `PERFORMANCE_AUDIT.md` (Iteration 3), memory `electron-performance-initiative`.
