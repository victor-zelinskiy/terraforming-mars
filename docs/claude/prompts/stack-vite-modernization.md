# Промт исполнителю · СТЕК — полный переход на Vite, свежий и чистый стек, Electron 45.3.3 с Node в синхроне, готовность к TypeScript 7.1

Выдан 2026-11-15. Работа автономная, на несколько дней. Владелец после твоего финала гоняет полный e2e на CI — это и
есть вердикт регрессий.

## Миссия

Сборка проекта держится на инструментах, которые либо заброшены, либо мешают ближайшим шагам:

- **`vue-loader` не обновлялся с декабря 2023** (17.4.2) и не знает Vapor. Поддержка Vapor держится на НАШЕМ хуке
  компилятора (`scripts/vapor/sfcTemplateCompiler.cjs`) и пред-лоадере юнит-бандла (`scripts/vapor/unitVaporLoader.cjs`
  + `unitVaporPolicy.cjs`). А с V4 (`createVaporApp(App)`, 455/455 компонентов — Vapor) это фундамент всего клиента.
  Побочный эффект: юнит-тесты компилируют шаблоны не в том режиме, что уходит игроку (отдельный шаблон против инлайна
  в `compileScript`).
- **Транспиляция связана с пакетом `typescript`** (`ts-loader`, `fork-ts-checker-webpack-plugin`). Каждое обновление
  TypeScript — риск для сборки, а переход на TS 7 потребовал бы `ts-loader@10` beta.
- **Официальный путь Vue для Vapor — Vite:** `@vitejs/plugin-vue` 6.0.11 штатно понимает `vapor`, его peer —
  `vue ^3.6.0-rc.15`.

Решение владельца: **полный и полноценный переход на Vite.** Webpack, vue-loader и все наши обходы уходят из
репозитория целиком. Заодно освежить весь стек до современного состояния, вычистить устаревшие зависимости и хвосты
upstream, обновить Electron до 45.3.3 с Node в синхроне и подготовить кодовую базу к TypeScript 7.1. Сам переход на
TS 7.1 — позже, когда будет готова экосистема Vue. Цель: максимально чистый, современный стек с грамотной
инфраструктурой.

Здесь сказано ЧТО должно получиться и где мины. КАК — решаешь ты. Названные инструменты — ориентиры, а не
предписание: нашёл сильнее — используй и запиши почему.

---

## 0. Режим работы

- **Автономно, от исследования до приёмки.** Решения принимаешь сам. Каждое существенное решение — строка журнала
  решений в новом документе стека (например, `docs/claude/stack.md`: что выбрано, варианты, почему). Там же — таблица
  «где мы» как передача дел, если сессия оборвётся.
- **Прогоны — ТОЛЬКО на ноутбуке. Бокс (Steam Machine) в рамках этой задачи не трогать вообще:** ни
  `npm run e2e:remote`, ни ssh, ни снимки для него.
  - Владелец явно разрешает для этой задачи e2e на ноуте: `TM_E2E_LAPTOP_OVERRIDE=1` (`playwright.config.ts` иначе
    бросает), точечно, по выбранным спекам.
  - Полный e2e-прогон делает владелец на CI после твоего финала.
- **Работай прямо в основной папке `C:\Projects\Mods\terraforming-mars` (ветка `main`), свой worktree не нужен.** На
  время перехода владелец не ведёт других работ, а остальные сессии поставлены на паузу (программа FREEZE ZERO — `tm-fz`,
  FLAKE ZERO и др.): `main` в твоём распоряжении, переключение можно провести одной связной серией. Владелец
  «разбудит» сессии, когда переход полностью завершён.
  - **Старт:** на 2026-11-15 основная папка чиста (`git status` пуст). Если появится `MM package.json` /
    `package-lock.json` при пустом `git diff HEAD -- package*.json` — это остаток хука версии в индексе:
    `git reset -q -- package.json package-lock.json`.
  - **Правила `main` в силе:** пуш через `npm run push` / `git push origin main` (без `--no-verify` и `--force`); перед
    коммитом `git diff HEAD -- package*.json` не должен нести лишнего — хук версии стейджит `package.json` целиком.
  - **⚠ `node_modules` основной папки — общий.** Восемь других worktree (`tm-fz`, `tm-wait`, `tm-vapor-d`, `tm-int`,
    `tm-sil`, `tm-timing2`, `tm-ci-head`, `tm-arch-verify`) подключены к нему junction-ом
    (`<worktree>\node_modules → C:\Projects\Mods\terraforming-mars\node_modules`). `npm ci` / `npm install` у тебя меняет
    зависимости и у них — это ожидаемо, они на паузе. Но:
    - никогда не удаляй `node_modules` изнутри чужого worktree — удаление пройдёт по junction в общую папку;
    - не трогай сами worktree (`C:\Projects\Mods\tm-*`), их незакоммиченную работу и их снимки `.e2e-*`;
    - уборка старых worktree — не твоя задача: предложи список владельцу. Удалять worktree с junction-ом — только сняв
      junction (`[System.IO.Directory]::Delete(<path>\node_modules, $false)`) ДО `git worktree remove`, иначе удаление
      уйдёт в общий `node_modules`.
  - **Записка для разбуженных сессий** — обязательная часть финала: `docs/claude/stack-migration-notice.md`. Коротко:
    - что поменялось: сборщик, тест-раннер, команды, раскладка `build/`, Node/Electron;
    - что сделать в своём worktree после ребейза: `fnm install` нужной Node, пересборка, новые команды вместо старых.
      Их `node_modules` — junction на общий и уже обновлён: `npm ci` в своём worktree НЕ запускать, иначе он перезапишет
      общий;
    - какие привычные пути и имена больше не существуют: `webpack.*.config.js`, `test:client:one` (или его замена),
      `chunks/<name>.js`;
    - на что обратить внимание в их незакоммиченной работе: импорты, магические комментарии, `process.env`, конфиги.

    Владелец передаст её каждой сессии.
- **Коммиты вехами.** Каждая веха оставляет `main` собираемым и рабочим. Само переключение (webpack → Vite) — связной
  серией, без промежуточного состояния «две сборки спорят». После переключения — короткая заметка в `CLAUDE.md`
  (раздел команд) и в `docs/claude/`, как теперь собирать, тестировать и запускать.
- **Bash на ноуте:** Node в Bash-инструменте по умолчанию 22 — перед npm-командами ставь PATH на нужную версию fnm
  (сейчас `$APPDATA/fnm/node-versions/v24.20.0/installation`). После установки новой Node — на неё.
- **Спрашивать владельца только** о том, что ломает развёртывание (Docker-образ, Heroku-сервер, базы данных), о
  платном и о том, что видит игрок.

---

## 1. Что есть сейчас (факты, проверены 2026-11-15)

**Прочитай сначала:**
- `CLAUDE.md`, `.claude/rules/client-ui.md`, `.claude/rules/tests.md`, `.claude/rules/diagnostics.md`;
- `docs/claude/vapor/ROADMAP.md` — §3.6: решение «бандлер оставлен открытым — принять на входе в V3»; оно так и не
  принято, теперь принимаешь ты; §3.8 — протокол бампа Vue;
- `docs/claude/diagnostics.md` §6 (релиз, debug ids, карты) и §9.1 (как мерить цену);
- **готовое исследование стека от 2026-10-22**: `docs/research/reports/Аудит современного стека Electron 45.md` и
  `docs/research/research_notes/Аудит современного стека Electron 45/toolchain_modernization.md`. Тогда рекомендовали
  Rspack, Vitest 5, оставить Less, mocha+tsx для сервера, electron-builder + Velopack, Oxlint как опцию. Решение по
  бандлеру с тех пор изменилось (Vapor, TS 7), но факты о связях кода там полезны.

**Контуры сборки (все уходят с webpack):**

| контур | сейчас | куда смотреть |
| --- | --- | --- |
| клиент (браузер и `app://`) | `webpack.config.js`: entry `main` + `sw` (service worker), `vue-loader` + наш компилятор, `ts-loader` (transpileOnly), `less-loader`/`css-loader`/`style-loader`, splitChunks (`vendors` фиксированным именем, `chartjs` отдельно), `chunkFilename: chunks/[name].js`, `publicPath` `/` или `app://bundle/`, `DESKTOP_BUILD` → `build-desktop/`, CompressionPlugin (`.gz`/`.br` только для веб), source maps; `DefinePlugin` `__VUE_OPTIONS_API__: true` (хотя Options API в клиенте — 0) | `assets/index.html` (статический, `<script src="vendors.js">` + `main.js`), `src/client/main.ts`, `src/client/sw.ts` |
| юнит-бандл клиента | `webpack.test.config.js` → `scripts/client-tests.mjs` (webpack → один файл → mocha в jsdom 30), политика Vapor/vdom (`TM_UNIT_VAPOR`), `tests/client/testing/` (свой слой монтирования Vapor), бутылочные тесты (`test:bottle`, `__webpack_require__` в `tests/client/bottle/consoleBottle.ts`) | пол счёта тестов: `scripts/run-tests.mjs --min 8000` |
| встроенный сервер (utilityProcess) | `webpack.embedded.config.js` (target node, externals) + `scripts/check-embedded-bundle.mjs` | `src/server/embedded/` |
| хаб диагностики | `webpack.diagnostics.config.js` → `build/electron/diagnostics-hub.js` | `src/server/diagnostics/hub/` |
| main-процесс Electron | `tsc -p electron/tsconfig.json` (commonjs) | `electron/` |
| сервер (веб / Docker / Heroku) | `tsc --build src/tsconfig.json` + `tsc-alias` | `Dockerfile`, CI `build-docker` |
| стили | `lessc src/styles/common.less build/styles.css` + `gzip.js` (~112 тыс. строк Less; 12 SFC с `<style>`) | `make:css` |
| символы кадров диагностики | `scripts/make-frame-symbols.mjs` из карт `main.js` / `vendors.js` | `docs/claude/diagnostics.md` D24 |

**Где код завязан на webpack и раскладку `build/` (каждое место — мина при переезде):**
- **отдача файлов:** `src/server/routes/ServeAsset.ts` и `src/server/server/requestProcessor.ts` — белый список
  `main.js`, `vendors.js`, `sw.js`, `*.symbols.json`;
- **Electron:** `electron/protocol.ts` — `app://`, `build-desktop`, `main.js`/`vendors.js`/`sw.js`;
  `electron-builder.yml`;
- **диагностика:** `src/common/diagnostics/stackFrames.ts` (разбор кадров `main.js`, `chunks/vendors.js`), `debugIds.ts`,
  `src/client/diagnostics/frameSymbols.ts`; релиз штампует debug ids `sentry-cli sourcemaps inject build-desktop
  build/electron` (через `npx --yes @sentry/cli@3.8.2`, вне `package.json`);
- **имена ленивых чанков:** 22 магических комментария `webpackChunkName` в `src/client/components/appAsync.ts` и
  `asyncComponents.ts`. На имена чанков ссылаются тесты: `tests/console/longFrameWatch.spec.ts` — `chunks/console-shell.js`;
- **e2e-харнесс:** `tests/e2e/hungPageWatch.ts`, `consoleTest.ts`, `console-diagnostics.spec.ts`,
  `hung-page-control.spec.ts`;
- **юнит-гарды:** `tests/console/frameSymbols.spec.ts`, `tests/client/diagnostics/diagnosticsClient.spec.ts`,
  `tests/console/vaporBuild.spec.ts`, `diagnosticsClassification.spec` (`build-desktop`);
- **33 чтения `process.env.NODE_ENV` в `src/client`**;
- **алиас `vue$` → `vue/dist/vue.esm-bundler.js`** (сборка с компилятором шаблонов в рантайме — строковых `template:`
  в клиенте не найдено; проверь, нужен ли он вообще).

**Версии на сегодня:**
- **Vite / Vue:** `vite` 8.3.8 (Rolldown), `@vitejs/plugin-vue` 6.0.11, `vitest` 5.1.0, `electron-vite` 6.0.0,
  `rolldown` 1.3.2. `vue` — `3.6.0-rc.15` (новее RC нет; точный пин + `overrides` остаются).
- **Тесты и линт:** `jsdom` 31.0.1 (мы на 30 — см. ниже), `happy-dom` 21; `oxlint` 1.93; `eslint-plugin-vue` 10.12.1;
  `typescript-eslint` 8.72.2; `vue-tsc` 3.3.14; `@playwright/test` 1.65.1.
- **Упаковка:** `electron-builder` 26.18.x; `@sentry/cli` 3.8.2.
- **TypeScript:** `latest` 7.0.2, `beta` 7.1.0-beta (RC ещё нет); мы на `^6.0.3`. `@vue/content-mapper`
  4.0.0-alpha.3 / `@vue/language-core` 4.0.0-alpha.3.
- **Electron:** `45.3.3` вышел 2026-11-14 с **Node 24.22.3** / Chromium 156.0.8078.100 (releases.electronjs.org), но
  **в npm на 2026-11-15 его нет** — `latest` = 45.3.2 (Node 24.22.2). Мы на 45.3.1 (Node 24.22.2).
- **Node:** 24.22.3 вышла 2026-11-10 (LTS Krypton).

**Node сейчас рассинхронизирован:**
- `engines` — `>=24.20.0 <25`;
- `.nvmrc` — `v24`;
- CI — `node-version: 24` (плавающая), причём `actions/setup-node` в трёх workflow трёх версий (v4 / v5 / v6);
- `Dockerfile` — `24-alpine3.21`;
- ноут — 24.20.0;
- `@types/node` — `^24.19.2`.

**Развёртывание живое:** CI собирает Docker-образ (`main.yml`, `build-docker`), релиз ссылается на Heroku-сервер,
который собирается из того же `package.json` (`release.yml`, комментарий около строки 28). Опциональные зависимости
`better-sqlite3` / `pg` — бэкенды БД (`src/server/database/`).

**Подготовка к TS 7 (проба 2026-10-28 на копии кода; в репозитории не сделано):**
- `moduleResolution: "node"` — жёсткая ошибка в TS 7: в `tsconfig.json` и `electron/tsconfig.json`; плюс
  `ignoreDeprecations: "6.0"`;
- 2× `assert {type: 'json'}` → `with` (`src/client/cards/ClientCardManifest.ts:6`, `src/client/cards/cardArt.ts:28`) — синтаксическая ошибка в TS 7, из-за
  которой `tsc` молча пропускает всю семантическую проверку;
- лишний параметр `T` в перегрузке `cast` (`src/common/utils/utils.ts:247`);
- `.d.ts` с `GlobalDirectives` / `GlobalComponents` под строгость `@vue/content-mapper`;
- настоящий баг `<a calassc>` в `src/client/components/admin/GameOverview.vue:19` (жив на 2026-11-15), который нашёл маппер.

Тогда маппер дал на наших 449 `.vue` 51 ошибку после настройки и был НЕ быстрее vue-tsc (alpha.0, воркеры по
умолчанию). Блокеры TS 7.1: typescript-eslint (peer TypeScript), Vue Language Tools v4 — alpha, сам 7.1 — beta.

**Кандидаты на чистку** (грубый счёт файлов-потребителей — твоя отправная точка, не вердикт):
- webpack-контур целиком: `webpack` и `webpack-cli` стоят в **runtime-`dependencies`**; `vue-loader`, `ts-loader`,
  `fork-ts-checker-webpack-plugin`, `tsconfig-paths-webpack-plugin`, `css-loader`, `style-loader`, `less-loader`,
  `compression-webpack-plugin`;
- `spectre.css` (CSS-фреймворк upstream, 1 файл), `dialog-polyfill` (4 файла — в нашем Chromium `<dialog>`
  нативный), `uuid` (1 — есть `crypto.randomUUID`), `html-escaper` (1), `ansi-escape-sequences` (1), `console-stamp`
  (1), `prom-client` (6 — метрики upstream), `simple-keyboard` (1), `chart.js` (1), `dotenv` (2), `chai-as-promised`
  (4), `rimraf`, `cross-env` (только npm-скрипты);
- живые и нужные, скорее всего: `mnemonist` (21), `sharp` (22, ассет-скрипты), `bonjour-service` (LAN), `velopack`
  (обновления), `xstate`, `gsap`, `@sentry/core`, `ws`, `@vueuse/core`;
- корневые файлы upstream: `AGENTS.md`, `GEMINI.md`, `vscode.sample/`, `.env.sample`, `docker-compose.yml`, `README.md`
  (чей он?), `src/tools/*` — проверь каждый;
- клиентский код, который держится только мёртвым desktop-UI (`docs/DESKTOP_DEPRECATION_AUDIT.md`), — его зависимости
  могут уйти вместе с ним; сам desktop-UI вне этой задачи.

**Гигиена ноутбука:** корень репозитория засыпан игнорируемыми артефактами — ~250 папок `.e2e-*` (снимки для бокса),
`pw-*.log`, `tmp*`, `*.err.log`. Они вне git, но захламляют рабочую копию. Чужие снимки не удаляй вслепую: другие
сессии на них опираются.

---

## 2. Требования

### A. Vite — единственный сборщик
1. **Webpack, vue-loader и наши обходы удалены целиком:** все четыре `webpack.*.config.js`,
   `scripts/vapor/sfcTemplateCompiler.cjs`, `unitVaporLoader.cjs`, `unitVaporPolicy.cjs` и всё, что существовало только
   ради них. `npm ls webpack vue-loader ts-loader` пуст.
2. **Клиент собирается Vite 8 с `@vitejs/plugin-vue`, Vapor — штатно.** Юнит-тесты и продукт компилируют шаблоны
   одинаково — пробел «тесты в одном режиме, продукт в другом» закрыт. Проверь это гардом, а не словами (наследник
   `vaporBuild.spec`).
3. **Все Node-контуры** (встроенный сервер, хаб диагностики, при желании main-процесс Electron) — на Vite / Rolldown
   или ином современном пути, без webpack. Как именно (SSR/library-сборки Vite, Rolldown напрямую, electron-vite) —
   решаешь ты.
4. **Нагрузка, которую несла раскладка `build/`, сохранена или осознанно перестроена.** Имена файлов, ленивые чанки
   (сейчас `webpackChunkName`), service worker, `app://` и `publicPath`, белый список сервера, символы кадров, debug ids
   и карты, CompressionPlugin для веба. Каждое место из списка § 1 правится в том же диффе, с его спекой. Решишь
   перейти на хэшированные имена с манифестом — сервер, `app://`, диагностика и e2e-харнесс читают манифест, а не
   угадывают имена.
5. **ES-модули в Electron.** Vite выдаёт `<script type="module">` и динамические `import()` — схема `app://` должна их
   обслуживать: привилегии схемы, MIME, CORS, загрузка воркера. Проверено запуском собранного приложения на ноуте, а не
   чтением кода.
6. **Dev-режим:** `dev:client` на Vite dev server с HMR, в том числе для Vapor-компонентов. Electron в dev умеет
   грузиться с dev-сервера. Если origin меняется — CORS-список сервера и `runtimeConfig` в порядке.
7. **Стили:** решение по Less в сборке — твоё. Исследование советует оставить Less: 112 тыс. строк, ~9,4 тыс. суффиксных
   селекторов. Если глобальный `common.less` остаётся отдельным `lessc`-шагом — обоснуй. 12 SFC со `<style>` должны
   собираться Vite.
8. **Определения окружения:** `process.env.NODE_ENV` (33 чтения) и флаги Vue (`__VUE_OPTIONS_API__` — теперь можно
   `false`, если правда) — под Vite, без сюрпризов в бандле.
9. **Цена:** размеры `main` / вендоров / ленивых чанков, время холодной загрузки и сборки — до и после, на одном
   ноутбуке, по методу `docs/claude/diagnostics.md` § 9.1 (база — тот же коммит, собранный старым путём). Регресс без
   причины не принимается. Исследование предупреждало, что продовое разбиение Rolldown/Vite может быть хуже webpack, —
   измерь и настрой.

### B. Тесты
1. **Клиентские юнит-тесты — на Vite-конвейере.** Vitest 5 (общий трансформ с продуктом) или mocha поверх
   Vite-сборки — решаешь ты, с обоснованием.
   - Пол счёта (`scripts/run-tests.mjs`, ≥ 8000) и порядок-независимость (`bundleSetup` — авто-размонтирование)
     сохраняются.
   - Слой монтирования Vapor (`tests/client/testing/`) и бутылочные тесты (`test:bottle`) работают.
   - Если клапан `TM_UNIT_VAPOR` (vdom-режим для отдельных компонентов) после V4 больше не нужен — убери вместе с
     политикой; если нужен — объясни.
2. **Среда:** jsdom 30 оставлен сознательно (jsdom 31 меняет `getComputedStyle` → 3 красных спеки и неизвестно сколько
   тихих уходов на другой путь кода — см. память стека). Переход на 31 или happy-dom — отдельное решение, с доказательством.
3. **Серверные тесты** (mocha + tsx, ~22 тыс., пол ≥ 8500): исследование советует оставить. Меняй, только если это
   сильнее и измеримо.
4. **`npm run build:test`** (типизация дерева тестов) и **`npm run lint:client`** (vue-tsc — единственная проверка типов
   шаблонов) работают. Сборка Vite типы НЕ проверяет: убедись, что CI и pre-push по-прежнему ловят ошибки типов.

### C. Electron 45.3.3 и Node в синхроне — навсегда
1. **Electron → 45.3.3.** Если в npm его ещё нет — возьми последний доступный 45.x и вернись к 45.3.3, когда он
   появится; запиши это в журнал.
2. **Правило: Node проекта = Node, который несёт установленный Electron** (для 45.3.3 — 24.22.3). Синхронны:
   `engines`, `.nvmrc` (точная версия), CI (`node-version-file`, одна версия `actions/setup-node` во всех workflow),
   `Dockerfile` (`NODE_VERSION`), `@types/node` (24.x), документация, ноут (`fnm install`).
3. **Синхрон проверяется гардом.** Спека или скрипт падает, если любой из пинов разошёлся с Node установленного Electron.
   Бамп Electron без бампа Node не проходит.
4. **Бокс не трогать.** Но перечисли в отчёте, что боксу понадобится при следующем e2e-прогоне (версия Node, `npm ci`,
   Playwright) — владелец сделает это сам.

### D. Готовность к TypeScript 7.1 (переход позже — сейчас всё, что можно сделать на TS 6)
1. Шаги подготовки из § 1 — сделаны: `moduleResolution`, `ignoreDeprecations`, `with`, `cast`, глобальные директивы и
   компоненты, баги, найденные маппером.
2. **Сборка не зависит от пакета `typescript`** (Vite транспилирует сам). Переход на TS 7 меняет только проверку типов и
   линт.
3. **Неблокирующая сверка с TS 7.1**: скрипт или отдельная задача CI прогоняет `tsc` 7.1 по серверу и тестам и
   `@vue/content-mapper` по клиенту и показывает разницу. Кодовая база остаётся чистой для TS 7, а момент перехода —
   бампом версии. Перемерь скорость маппера на alpha.3 с настройкой воркеров.
4. Задокументируй оставшиеся блокеры (typescript-eslint, Vue Language Tools v4, редактор) и чек-лист самого перехода.

### E. Чистка: стек без мусора
1. **Инвентарь всех зависимостей с вердиктом:** нужна / заменена / удалена — и почему. Удалить всё доказуемо
   неиспользуемое, хвосты upstream и то, что держится только мёртвым кодом. `dependencies` — только то, что нужно в
   рантайме: сборщику там не место.
2. **Встроенные возможности вместо пакетов,** где это честная замена: `crypto.randomUUID`, нативный `<dialog>`,
   `fs.rm`, `node --env-file` и т. п.
3. **Корневые файлы upstream:** каждому — вердикт. То, что касается развёртывания (Docker, Heroku, бэкенды БД), не
   удалять без слова владельца — дай список с рекомендацией.
4. **Обновить всё остальное до актуального:** ESLint и плагины, Playwright, electron-builder, `@sentry/cli` (в
   `devDependencies` с пином, а не `npx --yes`), mocha, tsx и т. д. Сознательно не обновлённое — в журнал с причиной
   (как jsdom 31).
5. **Oxlint перед ESLint** — по желанию, если ускоряет и не дублирует. Решение в журнал.
6. **Гигиена артефактов на ноуте** (§ 1, «Гигиена ноутбука»): локальные артефакты инструментов собираются в одну
   игнорируемую папку, а не в корень. Только если протокол бокс-инструментов (`e2e:snapshot` → `e2e:remote`) остаётся
   совместимым; бокс трогать нельзя, поэтому, если доказать совместимость без него нельзя, — оставь как есть и запиши
   на потом.

### F. Инфраструктура
1. **Конфиги — на TypeScript,** один общий источник путей и алиасов (`@/`) для Vite, Vitest, tsc и ESLint, без
   дублирования.
2. **CI:** одна версия каждого action во всех workflow, Node из `.nvmrc`, кэш npm, Playwright той же версии, что в
   `package.json`.
   - **Релиз** (`release.yml`): сборка на Vite, debug ids и загрузка карт для всех контуров. Решение D5 (`sentry-cli
     inject` после сборки против `@sentry/vite-plugin`) пересмотри и запиши. Приложение по-прежнему не везёт карт.
   - **Docker-образ** собирается.
3. **npm-скрипты:** понятные, без мёртвых. Сценарии `build`, `build:desktop`, `dev:*`, `test:*`, `lint*`, `electron:*`,
   `pack:*`, `make:*` работают; устаревшие (`test:client:vapor*` и т. п.) удалены.
4. **Хуки git** (`.githooks/pre-push` → `scripts/pushLint.mjs`) работают на новом стеке.

### G. Документы
- `CLAUDE.md` — раздел команд и упоминания webpack / mochapack. Он должен остаться маленьким: подробности — в
  `docs/claude/stack.md`.
- `.claude/rules/*`, где упомянуты webpack, vue-loader, `test:client:one`, `chunks/…`.
- ROADMAP §3.6 — решение по бандлеру закрыто.
- `docs/claude/diagnostics.md` §6 / D5 / D24 — новая раскладка, карты, символы.
- Гайд «как собрать и запустить» для разработчика.

---

## 3. Ограничения (непреложно)

- **Продукт для игрока не меняется:** UX-контракты `CLAUDE.md`, инварианты 1–17, Vapor north star
  (`vaporReadiness.spec`, `createVaporApp(App)`), законы диагностики, ядро флоу (`kernelCoverage`, `architectureDebt`).
- **Vue — `3.6.0-rc.15`, точный пин + `overrides`.** Не бампать в этой задаче. Если инструмент требует иного — сначала
  ROADMAP §3.8.
- **e2e-хуки — контракт** (инвариант 14): тронул хук или имя файла, которое читает спек, — правь спек в том же диффе.
  Веди список спеков, чьи хуки, тайминги или раскладку сборки ты затронул, — владелец начнёт с них на CI.
- **Бокс не трогать.** e2e — только на ноуте, точечно, `TM_E2E_LAPTOP_OVERRIDE=1` (разрешение владельца для этой
  задачи).
- **Развёртывание** (Docker, Heroku, БД) не ломать; удалять — только со словом владельца.
- **Ключ Sentry** — ни в одном файле (`.claude/rules/diagnostics.md` § 13).

---

## 4. Приёмка (на ноутбуке)

1. `npm ci` на чистой копии; `npm ls` без ошибок и без webpack, vue-loader, ts-loader, fork-ts-checker; инвентарь
   зависимостей с вердиктами — в `docs/claude/stack.md`.
2. Зелёные:
   - `npm run lint` (eslint + i18n + vue-tsc), `npm run build:test`;
   - `npm run test:server` и клиентские тесты на новом конвейере — с полами счёта;
   - `test:bottle`;
   - гарды: `vaporReadiness`, `kernelCoverage`, `architectureDebt`, `diagnosticsClassification`, `frameSymbols`,
     `diagnosticsClient`, `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`, гард синхрона Node ↔ Electron и
     наследник `vaporBuild`.
3. `npm run build` и `npm run build:desktop` проходят. `npm start` поднимает веб-сервер, главное меню открывается, партия
   создаётся и играется в браузере.
4. **Упакованное приложение на ноуте** (`pack:dir:win` → запуск) грузится по `app://`:
   - модули, ленивые чанки и service worker работают;
   - встроенный сервер поднимается, партия играется;
   - «Проверка связи» диагностики проходит (`scripts/diag-probe.mjs` / `TM_DIAG_PROBE` в окружении development) с
     кадрами, разрешёнными до исходников.
5. **Точечный e2e на ноуте** (`TM_E2E_LAPTOP_OVERRIDE=1`) по спекам, которые ты затронул, плюс опорный набор:
   - `aaa-driver-canary`, `smoke`;
   - `console-diagnostics`, `hung-page-control`;
   - старт партии, рука, «Действия карт», Парламент, колонии, финал;
   - главное меню и создание партии.
6. Electron 45.3.3 (или последний 45.x с записью), Node во всех пинах = Node Electron; гард синхрона красный при
   расхождении (докажи).
7. Подготовка к TS 7 сделана; неблокирующая сверка с TS 7.1 печатает разницу; чек-лист перехода записан.
8. Цена до/после (размеры бандлов, холодная загрузка, время сборки и юнит-прогона) — в журнале, без необъяснённого
   регресса.
9. Документы обновлены (§ 2 G); записка для разбуженных сессий (`docs/claude/stack-migration-notice.md`) готова — по ней
   сессия на старом worktree доходит до зелёной сборки и тестов без вопросов.

**Отчёт владельцу (по-русски, коротко):**
- что заменено и на что;
- что удалено, с вердиктами;
- цифры до/после;
- что боксу понадобится перед следующим прогоном (Node, `npm ci`, Playwright);
- список спеков, с которых начать разбор CI;
- оставшиеся блокеры TS 7.1;
- что сознательно не обновлено и почему.
