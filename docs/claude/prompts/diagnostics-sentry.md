# Промт исполнителю · ДИАГНОСТИКА · «ЖУРНАЛ ОШИБОК В ИГРЕ + SENTRY»: игрок никогда не видит браузерную консоль — у него премиальный «Сообщить о проблеме» с кодом отчёта и (по желанию) журнал ошибок с полным текстом; разработчик при включённой настройке видит ошибки и зависания экрана прямо в игре и открывает полный текст удержанием X; всё, что упало у любого игрока или на боксе, приходит в Sentry так, чтобы АГЕНТ одной командой получил отчёт целиком

Выдан 2026-11-13. Это **архитектурная итерация на шесть фаз** (Ф0 — владелец, Ф1–Ф5 — исполнитель, Ф6 — подготовленные швы). Каждая фаза — отдельный коммит (или серия) с зелёными проверками между ними; e2e — только на боксе (`docs/claude/e2e-remote.md`). Правила — `CLAUDE.md` (инварианты 5, 6, 9, 12, 14, 15, 16, 17 и § North star), `.claude/rules/{console-ui,console-flow,client-ui,server,tests,localization}.md`, чек-лист `docs/claude/console/architecture-v2/REVIEW.md` (прочитать ДО кода), `docs/claude/console/system-surface.md` (шасси `.con-sys`, контракт без сдвигов раскладки), `docs/claude/vapor/ROADMAP.md` §2 и §4a (как писать новый компонент сегодня).

---

## СЛОВА ВЛАДЕЛЬЦА (2026-11-12 … 2026-11-13, дословно)

> «…в консольном интерфейсе для траблшутинга (просмотра browser ошибок), копирования стектрейса и экспорта логов используется обычный chrome console, при этом даже без нормального скейлинга в 4k… когда мы просим клиентов сделать экспорт логов, они видят "legacy" консоль браузера — очень непрестижно и некрасиво».

> «Важно, чтобы игрок продолжал чувствовать, что он находится в "премиум-приложении", и не получал ощущения "браузера", и мог сделать экспорт логов нам, но было бы желательно, чтобы игрок при большом желании мог увидеть текст ошибки (это удобно скорее для меня, когда я сам буду играть, чтобы я сразу понимал, что упало)».

> «Давай брать Sentry. Ориентир архитектуры такой, чтобы именно ТЕБЕ и другим агентам было удобно получать логи и отчёты, учитывая, что пока все партии идут на боксе, к которому ты и так имеешь доступ по ssh, но в будущем игроки будут играть по всему миру (и уже, скорее всего, не в локальном режиме, а в режиме реплики — отдельно heroku-сервер и локальная реплика без данных о невскрытых картах; этот режим ещё не реализован)».

> «Важно, чтобы я как дев (при включении той настройки) мог удобно получать как ошибки, так и ворнинги по зависаниям экрана, а при нажатии клавиши (например X, как у нас сделано с событиями) мог посмотреть полный текст (тот же, что пишем в консоль). Нужно грамотно и глубоко спланировать архитектуру и интеграцию в наш консольный vue vapor интерфейс».

Отвергнуто при исследовании (не возвращаться): встраиваемые «консоли в странице» (Eruda, vConsole — проекты заброшены), PageSpy/O-Spy (владельцу не подошёл), готовый виджет обратной связи Sentry (`feedbackIntegration` — веб-форма под мышь, ломает «премиум-приложение»), Spotlight / Vue DevTools / TanStack Devtools (только для разработки). **Видимая часть — наша консольная поверхность; Sentry — транспорт, хранилище и интерфейс для нас.**

---

## ЗАКОНЫ ПРИЁМКИ (по ним принимается работа)

1. **ИГРОКУ — НИКАКОГО БРАУЗЕРА.** Ни один путь игрока не ведёт в Chrome DevTools. Всё, что игрок видит об ошибках, — консольные поверхности на шасси `.con-sys`: геймпад, глифы, TV 4K, сдержанность (инвариант 15). DevTools остаётся инструментом разработчика за отдельной клавишей.
2. **ОДИН КРАН — ОДИН ЖУРНАЛ.** Каждый диагностический сигнал страницы входит через ОДИН кран (`diagnosticsTap`, ставится при загрузке) в ОДИН структурированный журнал; бегущая плашка, поверхность журнала, Sentry, полевой регистратор и отчёт — его ПОТРЕБИТЕЛИ. Второго обёртывателя `console.*` в странице не появляется (полевой регистратор переходит на подписку).
3. **ПОЛНЫЙ ТЕКСТ = ТО, ЧТО В КОНСОЛИ.** Запись журнала хранит дословный текст строки консоли и стек `Error` (сегодня регистратор теряет стек — `fieldRecorder.ts:348`). Экран полного текста показывает ровно это (+ контекст экрана в момент записи).
4. **ОДИН КОД — ОДИН ОТЧЁТ — ОДНА РАСКЛАДКА.** Явный отчёт получает код `TM-XXXXXX`, который игрок видит крупно и может назвать. Одна и та же раскладка файлов отчёта — локально (папка экспорта) и во вложениях Sentry; CLI агента материализует её в `.diagnostics/reports/<код>/` из любого источника.
5. **ПРИВАТНОСТЬ ПО ПОСТРОЕНИЮ.** В автоматических событиях нет id участника и id партии в чистом виде (`/api/game?id=g…` отдаёт id игроков — это тоже ключ, `src/server/routes/ApiGame.ts` → `SimpleGameModel.players[].id`), нет имён, нет IP. Полный пакет (дамп, сохранение, снимок экрана) уходит ТОЛЬКО по явному нажатию.
6. **АГЕНТ — ПЕРВЫЙ ЧИТАТЕЛЬ.** У каждого события фиксированный набор тегов, отвечающий на вопросы агента; одна команда CLI достаёт отчёт или список проблем; есть док, правило и скилл.
7. **ГОТОВО К РЕПЛИКЕ.** Швы `ReportTransport` / серверный фасад / тег `app_mode` заложены сейчас; ни одна часть клиента не предполагает, что сервер локальный.
8. **ИГРОКУ — НИКАКОГО ШУМА.** Уведомления о зависаниях на экране — только за настройкой разработчика (решение владельца 2026-11-07 «NO NOTICE TO THE PLAYER» для арбитра живости в силе — `supervisorController.ts`, `consoleForegroundWatchdog.ts:358`).

---

## РЕШЕНИЯ ПО УМОЛЧАНИЮ (владелец может поменять до старта Ф3/Ф4 — спросить ОДИН раз, когда дойдёте)

| вопрос | по умолчанию | почему |
| --- | --- | --- |
| регион Sentry | **EU** (`de.sentry.io`) | игроки по всему миру, GDPR |
| автоматические отчёты об ошибках | **ВКЛ**, выключаются в настройках | без них «упало у игрока» не узнаем, пока он не написал |
| сохранение партии в явном отчёте | **ДА, только в режиме `host`** | для агента это воспроизведение; в реплике его у клиента нет |
| клавиши | **F12 → журнал ошибок**, **Shift+F12 → DevTools** | игрок, нажавший F12, видит премиум-экран |
| плашка разработчика | **Выкл.** по умолчанию | закон 8 |
| Session Replay / Sentry Logs / tracing | **нет** | объём, приватность, тяжёлый 4K DOM |
| проекты Sentry | **`terraforming-mars`** (Electron: main + renderer + embedded) сейчас; **`tm-server`** (хостинг) в Ф6 | разные правила алертов |

---

## ЧТО УЖЕ ЕСТЬ (диагноз, снятый при подготовке; номера строк — ориентир, сверить)

### Источники сигналов
- **Ошибки страницы.** `app.config.errorHandler` → `[vue-error] <цепочка компонентов> · <фаза>: <Name>: <message>` (`src/client/console/vueErrorReport.ts:52-58`, ставится в `src/client/main.ts:83`). `window` `error`/`unhandledrejection` → `[page-error] uncaught: … @ <2 кадра>` (`src/client/console/fieldRecorder.ts:360-381`). `warnHandler` нет. `AppBootLoader.vue:317-323` глотает ошибки рендера прогрева (`return false`).
- **~190 строк `console.warn/error('[tag] …')` без общего логгера.** Единственная конвенция — префикс `[kebab-tag]` (регулярка `fieldRecorder.ts:139`). Таблица семейств «зависло / истекло / защёлка» — §«Классификация» ниже; полный список с файлами снят при подготовке, перепроверить грепом.
- **Арбитр живости** (`src/client/console/supervisor/supervisorController.ts`): `[liveness] stall (<unserved|presses-no-effect>): Ns without progress, P presses; asked: …; beat: …; stranded: …; last in flight: …; claim: …; holds: … — rung i: …` **повторяется каждые ≥2 с** весь эпизод, затем `the ladder is spent`; закрывает `[liveness] recovered after Ns, R rung(s) run` (:455). `[liveness] still hold — …` (:373). Формат парсит `electron/consoleExport.ts:240-269` (`buildStallDigest`) — **формат строк не менять** (или менять вместе с парсером и его спеком).
- **Полевой регистратор** (`fieldRecorder.ts`): кольцо 120 строк + 45 сердцебиений `FieldHeartbeat` (`prompt`, `accepting`, `inFlight`, `frames`, `section`, `quietS`, `presses`, `block`, `start`, `graph`, `flow`, `at`), `localStorage tm_field_rec:<player>`, `POST /api/field-log` (`ApiFieldLog.ts` → `<db>/field-log/<YYYY-MM-DD>.jsonl`), `window.__conFieldRecorder()`. Ставится ЛЕНИВО из `installConsoleKeyBridge()` (`consoleKeyBridge.ts:151`) — **загрузка и главное меню не записываются**. `meta[name=build]` / `window.__tmBuild`, которые он читает (:289), **никто не ставит**.
- **Electron main.** `installConsoleCapture` (`electron/consoleExport.ts`) — инъекция в страницу (все `console.*`, `fetch`/XHR/WebSocket-ошибки, ресурсы), слив каждые 8 с, переживает перезагрузки, дамп с дайджестами `ERRORS` / `STALLS` / `SCREEN`; экспорт/копирование только кнопками в окне DevTools (`devtoolsPadCursor.ts`). Сторож зависания рендерера (`rendererHangWatch.ts`, проба 5 с, перезапуск после 30 с, строки `[renderer-hang] …`, трасса `renderer-hang-*.trace.json` через `hangTrace.ts`). `child-process-gone` встроенного сервера → `[embedded] process gone …`. **`crashReporter`, `process.on('uncaughtException')` в main нет.**
- **Встроенный сервер** — `utilityProcess` (`electron/embeddedServer.ts:208-219`, вход `src/server/embedded/embeddedServerMain.ts`, бандл `webpack.embedded.config.js`, `devtool: false`, без минификации); лог `<userData>/embedded/embedded-server.log` **обрезается при каждом запуске** (`flags:'w'`, :128-135).

### Консоль: уведомления, X, меню, настройки
- **ЛОВУШКА ИМЕНОВАНИЯ.** Физическая кнопка X = семантика `secondary` (индекс 2), в карте действий → `'inspect'`; физическая Y = `inspect` → `'fullscreen'` (`src/client/gamepad/gamepadPollModel.ts:16-28, 70-81`, `src/client/console/composables/consoleActionModel.ts:57-70`). В разметке X — это `<GamepadGlyph control="secondary"/>`. Клавиатура: `KeyX` → `secondary`.
- **«X, как с событиями»** — это УДЕРЖАНИЕ X 500 мс на карточке уведомления (`src/client/console/consoleNotifHold.ts`, `NOTIF_HOLD_MS`, `beginNotifHold(noteId, onFire)`; тап реплеится как обычный X). Маршрут — `src/client/console/shell/padRouterController.ts` `handleIntent` (~:345): отпускание X → системный алерт → кинематографические гейты (:393-544) → ветка тоста (:557-627). Кольцо удержания и подпись — `ConsoleNotificationCard.vue:230-253, 569-592`.
- **Очередь уведомлений не годится для диагностики**: одна видимая карточка, доставка блокируется любым удержанием анимации / модалкой результата / театром хода / церемонией (`presentationPolicy.ts:131-133`) — ровно когда экран и висит. `pushWarning` (`notificationState.ts:466`) существует, вызовов нет.
- **Системное меню** — оверлей `GamepadLayer.vue` (вне маршрутизатора оболочки, на сыром потоке пада; клавиатура — `consoleSystemMenuBridge.ts`). Пункты `SYSTEM_MENU_ITEMS` (`src/client/components/console/consoleSystemMenuModel.ts:7-28`): `settings`, `controls`, `diagnostics` («Диагностика» — глубокая ссылка в READOUT-категорию настроек), `exit`, `return`. Этап «› ВЫЙТИ» — образец этапа внутри карточки (`ConsoleSystemMenu.vue:13-32`, ввод `GamepadLayer.vue:376-387`). Один хост `.con-sys-host`, члены меняются ВНУТРИ одного затухания (`system-surface.md` §6). Меню — фиксированной формы, без настроек (§7).
- **Системный алерт** (`consoleSystemAlertState.ts`) смонтирован только в `ConsoleShell.vue:967` — вне игрового экрана алерт некому показать.
- **Настройки** — `src/client/console/settings/consoleSettingsModel.ts`: категория имеет ЛИБО `rows`, ЛИБО `readout` (спек); `minor: true` — техническая категория за швом; `toggleRow` / `ringRow`; образец флага разработчика — `src/client/components/notifications/statusEventCounter.ts` (`localStorage` + `reactive`); категория `diagnostics` — readout (сервер, версии, дисплей).
- **Чтение длинного текста** — `foundation/ConsoleScrollArea.vue` (`scrollByPx`, `ensureVisible`, …) + правый стик через `stickScrollTarget.ts`.

### Electron, сборка, релиз
- Окно: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` (`main.ts:499-505`). **Preload компилируется голым `tsc` без бандлера** → не может `require('@sentry/electron/preload')`.
- `desktopBridge` — каналы `desktop:<verb>` (invoke) и `desktop:<kebab-noun>` (push) (`electron/preload.ts:42-117`); тип `DesktopBridge` — `src/client/components/desktop/desktopUpdateState.ts:77-135`; рантайм-конфиг — `window.tmRuntimeConfig` (`runtimeConfig()` в `main.ts:144-156`, «не секреты»).
- `app://bundle` — `protocol.registerSchemesAsPrivileged` в `electron/protocol.ts:142-154`. **Electron разрешает этот вызов ОДИН раз до `ready`** — SDK Sentry в режиме `IPCMode.Protocol` регистрирует свою схему: проверить, как они складываются (см. Ф3).
- F12 перехватывается в `main.ts:541-553` (`before-input-event`) и до страницы не доходит.
- Velopack `run()` обязан быть ПЕРВЫМ (`main.ts:51-56`). Завершение принудительное через 2.5 с (`shutdown.ts:52`) — долгий flush при выходе невозможен.
- `electron-builder.yml` — **явный allowlist**: из `node_modules` попадают только `velopack/**` и `@neon-rs/**` (`:45-63`); main не бандлится → новая рантайм-зависимость main должна попасть в allowlist целиком с замыканием зависимостей. `'!**/*.map'` исключает карты, но **сжатые `*.map.br/.gz` всё равно едут в asar** (CompressionPlugin).
- Клиентский webpack: `devtool: 'source-map'` всегда; `publicPath` `app://bundle/`; чанки `chunks/[name].js` без хеша; webpack закреплён ровно `5.112.2`. Main — `tsc` с `sourceMap: true` в `build/electron`. Сервер — без карт.
- Версия — `package.json` (бамп хуком pre-commit); рендерер читает `src/genfiles/settings.json` `{head, version, builtAt}` (`src/tools/make_static_json.ts:94-135`), main — `app.getVersion()`.
- CI `release.yml`: job `build` (единственное место, где есть карты) → артефакт → `windows`/`linux` упаковка `vpk` → GitHub Releases; секретов, кроме `GITHUB_TOKEN`, нет.

### Бокс (сегодня все партии там)
- Доступ — `ssh steam-machine` (`docs/claude/e2e-remote.md` §3; один круг ~0.5–0.9 с — никаких поштучных запросов).
- Экспорты консоли и трассы — `~/Applications/` (`resolveExportDir`: `TM_LOG_DIR` → `dirname(TM_LOG_FILE)` → `dirname($APPIMAGE)` → `logs`); лог обёртки — `~/Applications/terraforming-mars-steam.log` (дописывается, без ротации); поле — `~/.config/terraforming-mars/embedded/db/field-log/*.jsonl`; сохранения — `…/embedded/db/files/` (+`history/`). Инструменты: `scripts/field-log-report.mjs`, `scripts/field-opening-index.cjs`, `scripts/field-recorder-extract.cjs`. **Пошаговый рецепт «достать диагностику с бокса» сейчас есть только в памяти агента, не в репо** — Ф5 это исправляет.

### Найдено по дороге (чинить в своей фазе)
- регистратор теряет стек `Error` (Ф1); регистратор ставится поздно (Ф1); `__tmBuild` не ставится (Ф1);
- `embedded-server.log` обрезается при запуске — лог упавшей сессии теряется (Ф3: ротация `.1`);
- у упакованной Windows-сборки нет лога main-процесса (Ф3 — по желанию, отметить);
- `src/client/components/BugReportDialog.vue` ведёт на ВЫШЕСТОЯЩИЙ GitHub/Discord — проверить достижимость в консоли по `docs/DESKTOP_DEPRECATION_AUDIT.md`; если недостижим — не трогать (удалит волна десктопа), если достижим — заменить путём в «Сообщить о проблеме».

---

## ЦЕЛЕВАЯ АРХИТЕКТУРА

```
 [vue-error] [page-error] [tag] warn/error           main: [renderer-hang] · crash · [embedded] gone
          │                                                         │
          ▼                                                         │
  diagnosticsTap (страница, ставится в main.ts ДО createApp)        │
          │  verbatim-текст + Error + стек + время                  │
          ▼                                                         │
  DiagnosticsJournal (чистое ядро: классификация · эпизоды ·        │
          │            дедуп · лимиты; реактивный фасад)            │
   ┌──────┼───────────────┬──────────────────┬──────────────┐       │
   ▼      ▼               ▼                  ▼              ▼       │
 field-  плашка        журнал (оверлей    sentryRenderer   IPC desktop:diag-entry
 Recorder разработчика  системного хоста)  (политика)          │
 (подписчик)                                                    ▼   ▼
                                       electron/diagnosticsHub (кольцо в main, переживает перезагрузку;
                                         отдаёт журнал заново после reload; свои записи main)
                                                    │
                    consoleExport (дамп — без изменений) ─┤
                    screenSnapshot (кадр до оверлея) ─────┤
                                                    ▼
                         diagnosticsReport (пакет + код + локальная копия) ──► Sentry.captureFeedback
                         sentryMain (init, scrub, env, офлайн-очередь, минидампы) ◄── @sentry/electron/utility (встроенный сервер)
                                                    │
 агенты ◄── scripts/diagnostics/diag.mjs (REST Sentry + ssh бокс) ──► .diagnostics/{reports,box,issues}/
 будущее: хостинг-сервер ── @sentry/node через тот же фасад (Ф6)
```

### Раскладка модулей (имена — предложение; менять с обоснованием)

| слой | файл | роль |
| --- | --- | --- |
| типы | `src/client/diagnostics/diagnosticsTypes.ts` | `DiagnosticEntry`, `DiagnosticKind` (`error`·`stall`·`integrity`·`perf`·`crash`·`other`), `DiagnosticFamily`, уровень, эпизод |
| классификация | `src/client/diagnostics/diagnosticsClassify.ts` | ОДНА таблица: префикс → семья, вид, уровень, правило эпизода, политика Sentry. Чистая |
| ядро | `src/client/diagnostics/diagnosticsJournal.ts` | кольцо (≈300 записей), эпизоды, дедуп по сигнатуре, счётчики, лимиты; реактивный фасад (`shallowReactive`) + `subscribe` |
| кран | `src/client/diagnostics/diagnosticsTap.ts` | ЕДИНСТВЕННЫЙ обёртыватель `console.warn/error` и `error`/`unhandledrejection` страницы; сохраняет `Error` (для Sentry) и стек (для текста); буфер ранних строк для поздних подписчиков |
| формат | `src/client/diagnostics/richFormat.ts` | те же правила, что `RICH_FORMAT_SOURCE` в `electron/consoleExport.ts` (Error → stack, объект → JSON с защитой от циклов, лимит 20 000) + **спек паритета** против `makeRichFormatter()` |
| приватность | `src/client/diagnostics/diagnosticsScrub.ts` | вычистка id участника/партии из строк и URL (формат — `src/common/Types.ts`: `p…`/`s…`/`g…` + генератор id на сервере; регулярку писать по генератору, спек на настоящих id), `ref8(x)` — короткий хеш для тегов |
| настройки | `src/client/diagnostics/diagnosticsSettings.ts` | `tickerLevel: 'off' \| 'errors' \| 'errors-stalls'`, `autoReport: boolean` (десктоп — хранится в main через мост, чтобы события main его слушались; веб — `localStorage`) |
| Sentry (стр.) | `src/client/diagnostics/sentryRenderer.ts` | init только на десктопе и только если main сказал «включено»; `captureEntry(entry)` по политике; `vueErrorReport.ts` зовёт его (НЕ `@sentry/vue` — его отслеживание компонентов на внутренностях vdom, риск для Vapor) |
| транспорт отчёта | `src/client/diagnostics/reportTransport.ts` | интерфейс `ReportTransport` + `desktop` (мост) + `fake` (юнит/e2e); `serverRelay` — шов Ф6 |
| контроллер | `src/client/diagnostics/diagnosticsOverlayController.ts` | машина состояний оверлея журнала и этапов отчёта (время жизни — СТРАНИЦА: `consoleAppScope()`, `src/client/console/session/consoleSession.ts:57`); компонент = шаблон + проводка |
| UI | `src/client/components/console/diagnostics/ConsoleDiagnosticsTicker.vue`, `ConsoleDiagnosticsJournal.vue`, `ConsoleDiagnosticsEntryRow.vue`, `ConsoleReportStage.vue` | `<script setup lang="ts">`; листья — `<script setup vapor lang="ts">`, если всё, что они используют, — зелёные строки `tests/client/vapor/vaporCapability.spec.ts` |
| стили | `src/styles/console_diagnostics.less` + калибровка TV в `console_tv.less` | только rem, без `filter`/`text-shadow`, без стоячих ореолов |
| main | `electron/diagnosticsHub.ts`, `electron/sentryMain.ts`, `electron/diagnosticsReport.ts`, `electron/screenSnapshot.ts` | кольцо + IPC + повтор после reload; init/scrub/env/политика сигналов main; сборка пакета, код, локальная копия, `captureFeedback`; кадр экрана |
| сервер | `src/server/diagnostics/serverDiagnostics.ts` | фасад `initServerDiagnostics({runtime: 'embedded' \| 'hosted'})` — сейчас `@sentry/electron/utility` во встроенном сервере |
| агенты | `scripts/diagnostics/diag.mjs` (`npm run diag -- …`), `scripts/diagnostics/sentry.config.json` | CLI; org/project/регион (не секреты); `.diagnostics/` в `.gitignore` |
| знание | `docs/claude/diagnostics.md` (+ строка в `docs/claude/README.md`), `.claude/rules/diagnostics.md`, `.claude/skills/triage-report/SKILL.md` | для следующих агентов |

### Классификация (стартовая таблица; полнота — под гардом)

| вид | семьи (префиксы) | эпизод | плашка разработчика |
| --- | --- | --- | --- |
| `error` | `vue-error`, `page-error`, `presentation-ledger … failed`, `animation-hold … threw`, `wait-graph … threw`, `transport` (отказ сервера / 5xx) | нет, дедуп по сигнатуре (семья + нормализованное сообщение + верхний кадр) | «Ошибки» и выше |
| `stall` | `liveness` (stall / still hold / recovered / ladder spent), `workspace-stall`, `workspace-stale`, `workspace-outcome`, `workspace-anchor`, `workspace`, `workspace-conclusion`, `start-stranded`, `start-shadow`, `screen-shadow`, `console-leak-detector`, `console-foreground-watchdog`, `wait-graph` (находки, потолки, лечение), `animation-hold` (снят потолком), `screen-handoff`, `presentation-ledger` (degraded / witness), `notifications` (голод / потолок), `deferred-refresh`, `transport` (нет ответа / gate outlived / abandoned), `flow`, `mandatory-gate`, `teleport`, `scene-transition`, `cursor`, сценовые `… outlived its ceiling`, `renderer-hang` (main) | **`liveness`**: открывается первой `stall`, повторы и ступени ДОПИСЫВАЮТСЯ в тот же эпизод (счётчик секунд живой), `recovered` закрывает «вылечено за N с», `ladder is spent` помечает «не вылечено»; остальные — запись на находку, повторы → счётчик | «Ошибки и зависания» |
| `integrity` | `transfer … told twice`, `reactivity` (защёлка) | раз на метку за страницу | «Ошибки и зависания» |
| `perf` | `long-frame`, `perf`, `bot-turn` | счётчик | никогда (только журнал, фильтр «Прочее») |
| `crash` | рендерер ушёл, встроенный сервер ушёл, минидамп после перезапуска | — | «Ошибки» и выше (показывается ПОСЛЕ перезапуска из кольца main) |
| `other` | любой неизвестный `[tag]` | — | «Ошибки и зависания» |

**Гард (инвариант 11 — «гарды = рабочий список»):** спек статически сканирует `src/client/**` и `electron/**` на `console.(warn|error)(` с префиксом `[tag]` и падает со СПИСКОМ префиксов без строки в таблице. Новый тег без строки — красный. Сверить с маркерами, которые e2e-харнесс считает красными (`tests/e2e/consoleTest.ts:255-311, 455-458`) — по желанию харнесс читает ту же таблицу (одна правда).

### Политика Sentry (вид × окружение)

| вид | событие | отпечаток / уровень | лимит на сессию | вложения |
| --- | --- | --- | --- | --- |
| `error` | `captureException(<настоящий Error>)` (группировка и символизация по картам) | семья + сигнатура / `error` | 3 на сигнатуру | `box`/`development`: дамп консоли (≤1 раз в 10 мин); `production`: нет |
| `stall` | одно событие на ЭПИЗОД — при закрытии (`warning`, тег `cured_after_s`) или при 30 с без лечения (`error`, «uncured stall») | семья + вердикт + тип вопроса | 5 на семью | как выше; контекст `screen` = последние 15 сердцебиений + строки эпизода |
| `integrity` | раз на метку | семья + метка / `warning` | 1 на метку | — |
| `perf` | никогда | — | — | — |
| `crash` | событие main + минидамп SDK | `fatal` | — | последний экран из сторожа |
| явный отчёт | `captureFeedback` из main | — | — | ПОЛНЫЙ ПАКЕТ (ниже) |

`autoReport = false` → уходят только явные отчёты. Глобальные обработчики SDK в рендерере (`globalHandlersIntegration`) **выключить** — ошибки окна уже видит кран (иначе дубли; спек: одно брошенное исключение = одно событие). `dedupeIntegration` оставить. Хлебные крошки — только помеченные строки, без `[perf]`/`[gamepad]`, через `diagnosticsScrub`. Скриншоты SDK (`enableScreenshot`) — **выключить** (свой кадр только в явном отчёте).

### Теги (фиксированный словарь — им отвечают агенту)
`kind`, `family`, `report_code`, `report_category`, `runtime` (`desktop`·`web`), `app_mode` (`host`·`remote`·`replica`), `screen` (секция), `prompt_type`, `game_ref` (ref8 id партии), `seat_ref` (ref8 id участника), `profile` (`tv4k`·`desktop`·`handheld`), `head` (git sha из `settings.json`), `os`, `selftest`. Контексты: `screen` (сердцебиения + дерево потоков, если есть), `display` (`desktop:getDisplayInfo`), `episode` (длительность, ступени, вылечено ли). Окружения: `production` (упакованный релиз CI), `box` (обёртка бокса ставит `TM_SENTRY_ENV=box`), `development` (неупакованный; выключен, пока не `TM_SENTRY=1`). Релиз — `terraforming-mars@<версия package.json>`, ЯВНО в main, тот же при загрузке карт.

### Раскладка отчёта (одна — локально и во вложениях)

```
<TM-XXXXXX>/
  report.json          код, категория, комментарий, версия/head, env, runtime, app_mode, os, display, game_ref, seat_ref, время, id события Sentry
  console_export.txt   дамп consoleExport (дайджесты ERRORS/STALLS/SCREEN + полный лог)      [вычищен]
  journal.json         кольцо журнала с полными текстами                                     [вычищен]
  field_record.json    window.__conFieldRecorder()                                            [вычищен]
  screen.jpg           кадр игры в момент нажатия Menu (ДО оверлея), ширина ≤1920, q≈80
  save.json            только app_mode=host: сохранение живой партии (не вычищается; только явный отчёт)
  hang-*.trace.json    трассы зависаний этой сессии (в пределах бюджета; режутся первыми)
  embedded-server.log  хвост ≤256 KiB (host)
  app.log              хвост лога обёртки ≤256 KiB (если TM_LOG_FILE)
```
Локальная копия — `<папка экспорта>/reports/<код>/` (на боксе `~/Applications/reports/<код>/`). Бюджет пакета — держать заметно ниже лимитов Sentry (40 MB сжатого запроса / 200 MB вложений на событие); при превышении резать трассы, затем хвосты логов, и писать это в `report.json`. **Sentry не вычищает вложения** — вычистка наша, до отправки. Код — `TM-` + 6 символов Crockford base32 (без I/L/O/U), генерируется ЛОКАЛЬНО (известен и без сети), проверка коллизии с локальными отчётами.

---

## ФАЗЫ

### Ф0 — владелец (до Ф3; исполнитель НИЧЕГО не создаёт сам, а когда дойдёт до Ф3 — спрашивает слаги/DSN)
1. Организация Sentry — **регион EU выбирается при создании организации и потом НЕ меняется** (только новой организацией); проект `terraforming-mars` (платформа Electron); DSN — Project Settings › Client Keys (DSN); DSN не секрет (только отправка событий).
2. Organization Settings › Security & Privacy: запрет хранения IP, Data Scrubber вкл. (по умолчанию), «Store Native Crash Reports / Store Minidumps As Attachments» вкл.; Organization Settings › General › «Attachments Access» — участникам.
3. CI: **Organization Token** (Settings › Developer Settings › Organization Tokens; права фиксированные `org:ci` — загрузка карт и релизы; показывается один раз) → секрет GitHub `SENTRY_AUTH_TOKEN`; переменные Actions `SENTRY_ORG`, `SENTRY_PROJECT`, `TM_SENTRY_DSN`.
4. Чтение для агентов: **Personal Token** (Account › Personal Tokens) только со скоупами чтения (`org:read`, `project:read`, `event:read`) — или внутренняя интеграция с теми же правами; хранится ВНЕ репо: `~/.config/tm-diagnostics/sentry-token`.
5. Разрешение поправить обёртку на боксе (`TM_SENTRY_ENV=box`) — правка устройства, только с явного слова владельца.
6. **Тариф:** в таблице цен бесплатного Developer-плана (1 пользователь, 5k ошибок, 1 GB вложений, отзывы — есть) строка «API access» — «No». CLI агента (Ф5) и Sentry MCP стоят на REST API. **Первым делом Ф3 проверить** токеном чтения один запрос (`GET /api/0/organizations/<org>/projects/`): работает — остаёмся на бесплатном; нет — сказать владельцу (Team-план) и до решения строить CLI так, чтобы `box pull` и локальные отчёты работали без API.

### Ф1 — кран, журнал, концентратор в main (без UI, без Sentry)
- `diagnosticsTap` ставится в `src/client/main.ts` ДО `createApp` (загрузка и главное меню теперь пишутся); сохраняет `Error` и стек; ранние строки буферизуются для поздних подписчиков.
- `fieldRecorder.ts` переходит с собственного обёртывателя на подписку крана (поведение и `tests/console/fieldRecorder.spec.ts` — без изменений; стек теперь не теряется); `window.__tmBuild` ставится из `settings.json` при загрузке.
- Ядро журнала: классификация, эпизоды (`liveness` — правила выше), дедуп, лимиты, кольцо; реактивный фасад; время жизни — страница (`consoleAppScope()`), **никаких `setTimeout`/`setInterval`** (`owner.after`/`owner.every`; новый файл начинает с нуля — `.claude/rules/console-flow.md`).
- `electron/diagnosticsHub.ts`: `desktop:diagEntry` (страница → main), кольцо в main (переживает перезагрузку игровой границы и перезапуск сторожем), `desktop:getDiagnostics` (страница поднимает журнал после reload), push `desktop:diag-entry` для записей main (`[renderer-hang]`, уход рендерера, уход встроенного сервера). Строки main по-прежнему идут в `consoleExporter.note()`, stdout и поле — ничего не убирать.
- Тип моста — в `DesktopBridge` (`desktopUpdateState.ts`), члены опциональны и проверяются наличием (как `quitApp`).
- **Спеки:** таблица классификации полна (гард-скан); жизненный цикл эпизода `liveness` (повторы → одна запись, ступени дописываются, `recovered` закрывает с длительностью, `ladder is spent` → «не вылечено»); дедуп/лимиты; паритет `richFormat` с `makeRichFormatter()`; вычистка на настоящих форматах id; кольцо концентратора и повтор после reload (`tests/electron/diagnosticsHub.spec.ts`, по образцу `consoleExport.spec.ts`).

### Ф2 — поверхности разработчика и журнал для всех
**Настройки.** Новая `minor`-категория `reports` («ОТЧЁТЫ», только `rows`): `autoReport` (переключатель «Автоматические отчёты об ошибках») и `diagTicker` (кольцо «Выкл · Ошибки · Ошибки и зависания»); описания — в полосе деталей (контракт без сдвигов: `system-surface.md` §3, e2e `console-options-settings.spec.ts`). Readout `diagnostics` получает группу «Отчёты»: ошибок/зависаний за сессию, статус Sentry (выкл / вкл / в очереди N), код последнего отчёта (только чтение).

**Плашка разработчика** (`ConsoleDiagnosticsTicker`, видна только при `diagTicker ≠ off`):
- одна строка в фиксированном углу, который НИЧЕГО не перекрывает на tv4k и handheld (выбрать и доказать скриншотом с бокса); вид — МАТЕРИАЛОМ: значок + слово + волосяной кант (красный — ошибка, янтарный — зависание), одноразовый вход `@keyframes`, никаких стоячих ореолов (инвариант 15, `glowRestraintGuard`);
- текст: `ОШИБКА · vue-error · <первая строка>` / `ЗАВИСАНИЕ · liveness · 14 с` (секунды живые, пока эпизод открыт) / `×N`; многоточие — в СВОЕЙ коробке;
- **НЕ в очереди уведомлений и НЕ под допуском презентации** — она обязана появиться во время зависания; ввод не берёт ничем, кроме удержания X; не регистрируется как обслуживающая поверхность (проверить, что детектор утечек / директор экрана не ругаются — `.claude/rules/console-ui.md` про `SERVING_SURFACES`/`OWNER_SURFACES`);
- после своей жизни (моушен-токены, `motionMs`) сворачивается в маленький постоянный чип «⚠ N» (непросмотренные), который сбрасывается открытием журнала.

**Удержание X** («как с событиями»): ветка в `padRouterController.handleIntent` СРАЗУ ПОСЛЕ системного алерта и ДО кинематографических гейтов; переиспользует `consoleNotifHold` (id `diag:<entryId>`, тот же `NOTIF_HOLD_MS`, то же кольцо удержания, тот же сброс по уходу с экрана); забирает ТОЛЬКО удержание (тап реплеится обычным X — как сегодня); **уступает** карточке уведомления, у которой есть действие детали (игра первее); работает только при видимой плашке/чипе. Подсказка на плашке — `<GamepadGlyph control="secondary"/>` + кольцо, только пока плашка реально владеет X. Глиф-литералов нет (`glyphLiteralGuard`).

**Оверлей журнала** (`ConsoleDiagnosticsJournal`, член `.con-sys--journal` того же хоста `.con-sys-host` — меняется внутри ОДНОГО затухания, `system-surface.md` §6; доступен ВСЕМ игрокам, плашка — только разработчику):
- голова `⊙ ЖУРНАЛ ОШИБОК`; спуск в запись — хвост крошки `› ОШИБКА` / `› ЗАВИСАНИЕ` (только растёт, кроссфейд в общей ячейке);
- полоса фильтров LB/RB (Все · Ошибки · Зависания · Прочее) — с упором на концах, как категории настроек;
- строки в одну линию: значок вида, семья, заголовок (многоточие), время, `×N`, состояние эпизода («вылечено за 12 с» / «не вылечено»); курсор крестовиной;
- A — полный текст (спуск): моноширинный, с переносами, внутри `ConsoleScrollArea` (правый стик + крестовина), шапка фактов (первый/последний раз, количество, экран в тот момент — вопрос, секция, кадры из сердцебиения); текст = дословно то, что ушло в консоль, со стеком;
- Y — «Копировать текст» (десктоп — буфер через main, веб — `navigator.clipboard`); X — «Отправить отчёт» (этап отчёта с категорией «Ошибка или сбой» и этой записью в фокусе); B — один логический уровень;
- фиксированная высота карточки, без сдвигов раскладки; пустое состояние спокойное («Ошибок нет»).

**Как открыть:** системное меню → новый пункт «Сообщить о проблеме» (Ф4) → X «Журнал ошибок (N)»; удержание X на плашке/чипе; **F12** — `before-input-event` в main шлёт push `desktop:open-diagnostics` → страница открывает оверлей (проверить, на каких экранах живёт хост `GamepadLayer`; где хоста нет — честно не открывать и записать это в док); **Shift+F12** — DevTools (курсор пада и кнопки экспорта/копирования в нём остаются). Новых обработчиков `keydown` в компонентах нет (`.claude/rules/console-ui.md`).

### Ф3 — Sentry
- `@sentry/electron` (8.x): `sentryMain.init` в `electron/main.ts` СРАЗУ после Velopack `run()` и ДО регистрации `app` в `protocol.ts`. **Проверить** совместимость одной регистрации привилегированных схем с режимом `IPCMode.Protocol` SDK; если они не складываются — одна регистрация обеих схем в `protocol.ts` или `IPCMode.Classic` через минимальный канал в нашем preload (`require` SDK в песочном preload невозможен). Выбранный путь записать в док. `sandbox`/`contextIsolation` не трогать.
- Опции main: явный `release`, `environment`, `dataCollection: {userInfo: false}`, `beforeSend` / `beforeBreadcrumb` → `diagnosticsScrub`, офлайн-очередь (`transportOptions`: `flushAtStartup: true`, разумные `maxQueueSize`/`maxAgeDays`) — завершение через 2.5 с не удлинять, очередь уйдёт при следующем запуске; минидампы — штатно SDK.
- DSN: `TM_SENTRY_DSN` при сборке → `src/genfiles/settings.json` (`make_static_json.ts`) → main читает (как `electron/cacheVersion.ts:33`); нет DSN → Sentry выключен полностью (локальные сборки ноутбука ничего не шлют). `TM_SENTRY=0` — выключатель; `TM_SENTRY_ENV` — окружение. **В e2e и юнитах — никогда** (веб-сборка e2e без `desktopBridge` не инициализирует; если какой-то e2e запускает Electron — выключать явно; спек на это). DSN в рендерер НЕ передаётся: `runtimeConfig()` получает `diagnostics: {sentry: boolean, env}`, события рендерера идут через main.
- Рендерер: `sentryRenderer` (вход `@sentry/electron/renderer`), политика из таблицы; `vueErrorReport.ts` → `captureException` с тегом цепочки компонентов; `[page-error]` → из крана.
- Встроенный сервер: фасад `initServerDiagnostics({runtime: 'embedded'})` → `@sentry/electron/utility` в `embeddedServerMain.ts`; `embedded-server.log` — ротация (сохранять `.1`) вместо обрезки.
- Сигналы main: `[renderer-hang]` → запись концентратора + событие по политике (с последним экраном из сторожа); уход рендерера / сервера → `crash`.
- **Упаковка:** `@sentry/electron` + замыкание его продакшен-зависимостей — в allowlist `electron-builder.yml` (или бандл main — выбрать с обоснованием). Если allowlist — скрипт `scripts/diagnostics/sentry-deps.mjs`, который падает при упаковке, если замыкание изменилось, а allowlist отстал. Проверить `pack:dir:linux` + запуск на боксе и `electron:run:packed` на Windows.
- **Карты:** рендерер и встроенный сервер — `@sentry/webpack-plugin` (debug ID вшиваются В СБОРКЕ, до CompressionPlugin — иначе `.br/.gz` разойдутся с файлами; загрузка только при наличии `SENTRY_AUTH_TOKEN` → локально и в PR-CI — no-op; проверить совместимость с закреплённым webpack 5.112.2; для встроенного сервера включить `devtool` под загрузку). Main (`tsc`) — `sentry-cli sourcemaps inject build/electron && sentry-cli sourcemaps upload --release … build/electron` в job `build` `release.yml`. Сопоставление по debug ID → путь `app://bundle/...` не важен. Сжатые карты в asar — пока ОСТАВИТЬ (нужны Ф6), решение записать.
- **Самопроверка:** `TM_DIAG_SELFTEST=1` (и флаг `--tm-diag-selftest` через существующий мост argv → env, `perf.ts:160-190`) при запуске шлёт по одной ошибке из main, рендерера и встроенного сервера с тегом `selftest` — проверка конвейера после каждого изменения.
- **Спеки:** политика с фальшивым клиентом (какие записи → события, отпечатки, уровни, теги, лимиты, `box` прикладывает дамп не чаще раза в 10 мин, `autoReport=false`); вычистка событий/крошек; «одно исключение = одно событие»; «в e2e Sentry не инициализируется».

### Ф4 — «Сообщить о проблеме» для игрока
- Новый пункт системного меню `report` — «Сообщить о проблеме», подпись «Отчёт разработчику · журнал ошибок», глиф из семьи консольных глифов, перед `exit`; подпись статична (меню фиксированной формы, `system-surface.md` §7). Глубокая ссылка «Диагностика» остаётся как есть.
- Этапы ВНУТРИ карточки системного меню (образец «› ВЫЙТИ»; хвост крошки только растёт):
  1. `СИСТЕМА › ОТЧЁТ` — категория плитками: «Игра зависла» · «Ошибка или сбой» · «Карта или правило работает неверно» · «Другое»;
  2. `› ОТПРАВКА` — что будет приложено (список с размерами; сохранение — только host), необязательный комментарий через существующую `ConsoleVirtualKeyboard`, «Журнал ошибок (N)», «Сохранить файл»; A «Отправить» (назначение кнопок — семантика команд, обосновать; глифы через `GamepadGlyph`);
  3. такт «Отправка…» — ограниченное ожидание на ядре потоков (`scope.wait(…, {bound})`, никаких таймеров), B в такте — `none` (двойная отправка невозможна построением);
  4. `› ГОТОВО` — крупный код `TM-XXXXXX`, «Назовите этот код разработчику»; состояния: отправлено / в очереди без сети («уйдёт при подключении») / не удалось → «Сохранить файл» с путём папки. B закрывает.
- **Кадр экрана:** `GamepadLayer` при нажатии Menu (открытие оверлея) просит main `desktop:snapshotScreen` — fire-and-forget, ДО монтирования оверлея, открытие не задерживать; main держит последний кадр ≤2 мин. Доказать на боксе, что в кадре нет оверлея.
- Сборка пакета — в main (`diagnosticsReport.ts`): `consoleExporter` (вынести `gather()` в API экспортёра, дамп без изменений), журнал из концентратора, регистратор, кадр, сохранение (host: путь из корня встроенного сервера + id партии из пробы страницы), трассы сессии, хвосты логов → вычистка текстовых файлов → бюджет → локальная копия → `Sentry.captureFeedback({message, …}, {captureContext: {tags}, attachments})` → `{code, eventId, queued}`.
- Мост: `desktop:sendReport({category, comment, focusEntryId?})`, `desktop:saveReport(...)`, `desktop:copyText(text)`, `desktop:snapshotScreen()`; в вебе — `ReportTransport.fake` (e2e) и шов `serverRelay` (Ф6).
- RU-тексты — в `src/locales/ru/console.json`, ключ = английский текст, грепнуть дубликаты по всем `src/locales/ru/*.json` (`npm run make:json`), канон терминов.

### Ф5 — инструменты агента и знание
- `npm run diag -- <команда>` (`scripts/diagnostics/diag.mjs`; вывод для агента: стабильные заголовки, без цвета вне TTY):
  - `report <TM-код>|latest` — найти отзыв по тегу `report_code` (**проверить** путь поиска по тегу для отзывов через REST; запасной путь — просмотр свежих отзывов и сверка тега), скачать все вложения (`…/events/{event_id}/attachments/{id}/?download=1`, следовать редиректам), сложить в `.diagnostics/reports/<код>/` в ТОЙ ЖЕ раскладке + `summary.md` (код, категория, комментарий, версия/head, env, app_mode, ОС, дисплей, первые строки дайджестов ERRORS/STALLS, список вложений с размерами, ссылки);
  - `issues [--since 24h] [--env box|production] [--kind error|stall] [--family liveness]` — таблица (shortId, число, последний раз, заголовок, релиз);
  - `issue <shortId>` — последнее событие: символизированный стек, теги, `contexts.screen`, хлебные крошки, ссылки;
  - `box pull [--since 6h]` — ОДНИМ ssh-заходом (tar) с бокса: экспорты, трассы, JSONL поля, `reports/*`, хвост лога обёртки, `embedded-server.log` → `.diagnostics/box/<метка>/` + сводка `field-log-report.mjs`; `box find-game <game_ref>` — какое сохранение на боксе соответствует ref8;
  - `selftest` — пришли ли события самопроверки текущего релиза.
  - Токен — `SENTRY_AUTH_TOKEN` или `~/.config/tm-diagnostics/sentry-token`; org/project/хост региона — `scripts/diagnostics/sentry.config.json`.
- Sentry MCP — описать в доке как необязательный инструмент для разовых запросов (подключение по официальному README); детерминированный путь — CLI (скачивание вложений через MCP не подтверждено).
- Скилл `.claude/skills/triage-report/SKILL.md`: код / `latest` / «бокс» → CLI → `summary.md` → дайджесты в порядке ERRORS → STALLS → SCREEN → семья → профильный док (`docs/claude/console/liveness-arbiter.md`, `wait-graph.md`, `start-director.md`, …) → сохранение (`save.json` или `box find-game`) → воспроизведение (серверный пробник / e2e на боксе) → ответ с кодом.
- `docs/claude/diagnostics.md`: конвейер, таблица семей, словарь тегов, окружения, приватность, раскладка отчёта, «как читать отчёт», «как добавить новый `[tag]`» (строка таблицы — иначе гард), самопроверка, раздел «Бокс без отчёта» (перенести в репо рецепт, который сейчас живёт только в памяти агента). Строка в `docs/claude/README.md`. Обновить `docs/claude/console/system-surface.md` (пункт меню, член хоста, категория `reports`), `electron/README.md` (F12 / Shift+F12, Sentry, переменные), `docs/claude/e2e-remote.md` (указатель на `diag box pull`).
- `.claude/rules/diagnostics.md` (по путям `src/client/diagnostics/**`, `electron/{sentryMain,diagnosticsHub,diagnosticsReport,screenSnapshot,consoleExport}.ts`, `src/client/console/fieldRecorder.ts`, `src/server/diagnostics/**`, `scripts/diagnostics/**`): один кран; каждый новый `[tag]` — строка классификации; вычистка до отправки; никаких id в чистом виде; никаких таймеров; плашка — только разработчику; Sentry никогда в e2e/юнитах; формат строк `[liveness]` меняется только вместе с `buildStallDigest`.

### Ф6 — подготовленные швы (не реализовывать без слова владельца; в Ф1–Ф5 только не мешать им)
- **Хостинг-сервер:** `initServerDiagnostics({runtime: 'hosted'})` → `@sentry/node` в `src/server/server.ts`, `SENTRY_DSN` — конфиг Heroku, отдельный проект `tm-server`; `ApiFieldLog` в хостинге пересылает записи в Sentry (файловая система Heroku эфемерна).
- **Реплика:** `app_mode: 'replica'`; вместо `save.json` — публичный снимок реплики (у клиента нет скрытой информации); отчёт по-прежнему из main.
- **Веб-сборка:** `ReportTransport.serverRelay` → `POST /api/diagnostics/report` → сервер прикладывает и пересылает; рендерер — `@sentry/browser` через тот же `sentryRenderer` (чек-лист нового эндпоинта — `.claude/rules/server.md`, включая CORS allowlist).
- **Символизация в игре:** main + `@jridgewell/trace-mapping` по уже отгружаемым `build-desktop/*.map.br` → в полном тексте рядом с минифицированными кадрами `src/client/…:строка` (только для разработчика).

---

## ПРОВЕРКИ И ПРИЁМКА

- **Юнит/интеграция** (по `.claude/rules/tests.md`; часы ядра — `createManualClock`/`setFlowClock`, композиции — в `effectScope().run`): всё перечисленное в фазах + машина состояний оверлея и этапов отчёта (B на каждом уровне, такт без ввода), жизнь плашки и чипа, арбитраж удержания X (тост с деталью побеждает; удержание при стоящем кинематографическом гейте открывает журнал; тап = обычный X; плашка невидима → поведение как сегодня), модель настроек (контракт rows/readout), сборка пакета с подделками (бюджет, порядок обрезки, вычистка).
- **Леджеры и гарды:** `npm run ready:vapor` (новые файлы — с нуля), `kernelCoverage`, `architectureDebt`, `glowRestraintGuard`, `glyphLiteralGuard`, `e2eLiveness`, гард классификации, `npm run lint` (включая `lint:client` — типы шаблонов ловит только он), `npm run build:test`, `npm run make:json`.
- **e2e на боксе** (веб-сборка, профиль tv4k; снапшот → `npm run e2e:remote -- <task> <spec>`), новый `tests/e2e/console-diagnostics.spec.ts`: настройка выкл → плашки нет; вкл → `console.error('[vue-error] …')` даёт плашку ошибки; `console.warn('[liveness] stall (unserved): …')` даёт плашку зависания с живыми секундами, `[liveness] recovered after …` закрывает эпизод; удержание X открывает журнал на этой записи, полный текст совпадает с отправленным; B по уровням; системное меню → «Сообщить о проблеме» → этапы → код (транспорт — подделка `desktopBridge` через `page.addInitScript`); контракт без сдвигов на карточке журнала; `npm run e2e:affected` перед каждым UI-коммитом.
- **Ручная проверка на боксе** (упакованная сборка с DSN, `environment=box`): самопроверка → три события; настоящий отчёт → `npm run diag -- report <код>` воспроизводит пакет целиком; принудительное зависание рендерера (только разработчик) → событие + запись в журнале после перезапуска; скриншоты tv4k плашки, журнала, полного текста, этапов отчёта и кода.
- **Отчёт исполнителя по каждой фазе:** коммиты, что проверено и как, скриншоты с бокса, ссылки на события самопроверки, вывод `diag report`. Что не проверено — назвать.

## НЕ ДЕЛАТЬ
- виджет обратной связи Sentry (`feedbackIntegration`), `@sentry/vue`, Session Replay, Sentry Logs / `consoleLoggingIntegration`, трассировку производительности;
- второй обёртыватель `console.*` в странице; новые обработчики `keydown` в компонентах; `setTimeout`/`setInterval` в клиенте;
- id участника/партии, имена, IP — в автоматических событиях; пакет без явного нажатия;
- DevTools в пути игрока; нативный `title`; стоячие ореолы; литералы кнопок;
- менять формат строк `[liveness]` без `buildStallDigest` и его спека;
- добавлять `vapor` к СУЩЕСТВУЮЩИМ компонентам попутно (это волны V3, отдельными коммитами);
- трогать обёртку на боксе без слова владельца; создавать что-либо в аккаунте Sentry самому.

Коммиты — по явным путям (`git commit -- <paths>`; общее дерево делят несколько сессий), после коммита — пуш (`CLAUDE.md` § Pushing). Если рядом работает агент Vapor — свериться через `ListAgents`, прежде чем трогать общие файлы (`GamepadLayer.vue`, `padRouterController.ts`, `ConsoleSystemMenu.vue`).
