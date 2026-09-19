# Промт исполнителю · Полный ЗЕЛЁНЫЙ `tests/e2e` — чужие красные (всё, что не Парламент)

Выдан 2026-09-20 после сдачи финального прогона Парламента (`cb9f260936` → уточнение отчёта `64f1eb54c0`).
Парламент закрыт и зелёный; этот промт — про ВСЕ остальные красные сюиты.

---

Ты — исполнитель в приватном форке `terraforming-mars` (vize1215), рабочая копия `C:\Projects\Mods\terraforming-mars`,
Windows, абсолютные пути с буквой диска. Работаешь автономно, без вопросов пользователю; отвечаешь и пишешь доки
по-русски. **Цель: полный `tests/e2e` зелёный на CI** — ни одного красного, ни одного нового пропуска.

Каждый красный — это ЛИБО устаревший тест (продукт сменил контракт, спек остался на старом), ЛИБО настоящий баг
продукта. Твоя работа — доказать, что именно из двух, и починить по существу. «Ослабить порог», «завернуть в skip»,
«удалить assert» — не починка, а потеря гарда (см. § Запрещено).

## 1. Где смотреть отчёт по уже сделанным прогонам

- `C:\Projects\Mods\terraforming-mars\docs\claude\parliament-sitting-progress.md` § «Э9 — финал» → **«Итог прогона»**
  (классы красного, доказательства, что зелёное) и **«Ворота Э9»**.
- `C:\Projects\Mods\terraforming-mars\docs\TURMOIL_REDUX_PARLIAMENT_FINISH.md` § «Прогоны Э9»,
  **«Чужие красные полного прогона (не Парламент — с доказательством)»**, «Честные ограничения Э9».
- `C:\Projects\Mods\terraforming-mars\tmp\e9-full-e2e3.log` — полный лог прогона (678 тестов, `--workers=2`,
  641 / 26 / 11, 3,4 ч). Блоки падений с текстом ошибки, кодом и стеком — строки ~4350–5350.
- `C:\Projects\Mods\terraforming-mars\tmp\e9-rerun-foreign.log` — перегон чужих красных **в изоляции**
  (`--workers=1`): 4 красных / 10 зелёных.
- `C:\Projects\Mods\terraforming-mars\tmp\e9-gate-*.log` — ворота (`build:test`, `lint:client`, `lint:i18n`,
  `make:json`, eslint, `test:server` 12061, `test:client` 5708).
- `C:\Projects\Mods\terraforming-mars\test-results\` — артефакты (`error-context.md`, `trace.zip`, `video.webm`),
  но **только последнего прогона**: сейчас там лежат extras-explorer, hud-frame ×2, start-effect-flow-probe.
  Артефакты семьи MarsBot затёрты — перегони спек, чтобы получить свежие.
- Заметки памяти (`C:\Users\zelin\.claude\projects\C--Projects-Mods-terraforming-mars\memory\`):
  `e2e-stable-failures-2026-09-03.md` (список стабильных падений + **ревизия 2026-09-20**), `e2e-flake-classes.md`,
  `handoff-witness-overlay-window.md`, `e2e-raf-probe-dies-headless.md`, `e2e-forceframe-wakes-raf.md`,
  `never-rebuild-during-e2e-run.md`, `e2e-stale-server-serves-old-chunks.md`, `linux-ci-rounds-glyph-advances.md`,
  `geometry-probe-measure-real-edges.md`, `console-hud-frame-rails.md`, `console-central-opening.md`.

## 2. Что чинить (25 чужих красных + 2 класса нагрузки + один долг)

Точка отсчёта — `65d3e556b4` (коммит перед работой по Парламенту, 2026-09-18). Ни один файл ниже с этой базы
Парламентом не трогался. Подозреваемый диапазон — серия коммитов с ОДИНАКОВЫМ сообщением «UI rework» между
`23f8a50c51` (ревизия e2e 2026-09-03) и базой.

**A · Семья MarsBot-корпораций — 18 тестов.** `console-bot-corp-*` ×17 и `console-bot-corporation`.
Карта корпорации бота не рендерится: `.con-played__botcorp .pcard` (табло бота, 17 спеков) и
`.con-info__block--botcorp .pcard` (Информация, `console-bot-corporation`) — `element(s) not found` за 5 с.
Первый шаг: жив ли класс в `src/` вообще (переименование в «UI rework» = устаревший селектор в спеке), или класс есть,
а поддерево пустое (баг продукта). Если селектор менялся — правь через общий свидетель драйвера, не 18 раз по месту
(закон «WITNESSES LIVE IN THE DRIVER» в `.claude/rules/tests.md`).

**B · HUD-рама — 2 теста.** `console-hud-frame.spec.ts:138` на профилях `fhd-standard` и `tv-4k`:
`main == viewport − 2×(rail+gap) — no hidden spacers`, остаток **14 px** (fhd) и **6 px** (tv-4k) при допуске 2.
Контракт рамы — `.claude/rules/console-ui.md` § THE CENTRAL OPENING и `docs/claude/console/hud-frame.md`.

**C · Стартовый хэндовер.** `start-effect-flow-probe.spec.ts:61` → `no hero handoff overlay was witnessed at the seat`
(`watch.handoffs.length` = 0). Закон свидетеля — заметка `handoff-witness-overlay-window`: честное окно — dissolve
(`0.02 < opacity < 0.97`), а не «последний кадр до удаления». Если продукт сменил фразу хэндовера, свидетель
переписывается на НОВУЮ фразу, а не удаляется.

**D · Спутник доп. ресурсов на Deck.** `console-extras-explorer.spec.ts:140` → `slot top inside the page (Δ=1.3px)`:
получено 176.25 при требовании ≥ 176.5. Субпиксельный дрейф; разберись, откуда 1,3 px, прежде чем трогать порог —
и помни про округление глифов на Linux (`linux-ci-rounds-glyph-advances`): локальный запас на CI уже потрачен.

**E · Дельта.** `console-delta-card-advance.spec.ts:265` → `the walk home must START at the dock's own card`,
Δx **57 px** при допуске 6 (`dock={x:267,y:401,w:179,h:258}`, `first={x:324,y:325,w:333,h:478,op:0}`, n=148 сэмплов).
Либо возврат теперь стартует от другого якоря (контракт сменился — тогда спек целится в новый якорь по закону
«A LANDING IS MEASURED AGAINST THE PLACE»), либо это регрессия un-yield-возврата. В списке 2026-09-03 этого спека
не было — красный впервые.

**F · Класс нагрузки (в изоляции ЗЕЛЁНЫЕ, красные на двух воркерах).** CI ходит `--workers=1`, так что они,
скорее всего, там и так зелёные — но закрыть их надо по СТАВКЕ, а не по одному зелёному прогону:
- `console-draft-workspace.spec.ts:242` — `the pass physically TURNS (a healthy sampler saw no rotateY at all)`:
  rAF голодает под нагрузкой (заметки `e2e-raf-probe-dies-headless`, `e2e-forceframe-wakes-raf`).
- `hand-album-probe.spec.ts:494` (tv4k, «tail 2») — `card width identical across pages`, Δ **25 px**: классика
  «сравнение с неустоявшейся стороной» (обе стороны замера обязаны пройти один и тот же settle-read).

**G · Долг, если хватит сил.** `console-pluto-two-colony-sequence.spec.ts:310` — `test.fixme` («the second cycle
always presents inside the workspace»), заведён «UI rework» `855d43fb59` 2026-09-01 и несёт доказательство своего
дефекта. Это настоящий баг продукта: чинить продукт и снимать fixme, либо в доке доказать замером, почему нельзя.
**НЕ трогай** 10 измерительных пробников под флагами окружения (`LONGGAME_PERF=1`, `RECV_PERF=1`) — они пропущены
намеренно.

Вне скоупа, но знай: в юнитах клиента есть таймерный флейк `tests/client/components/presentation/animationHold.spec.ts`
(«the ceiling runs the OWNER RECOVERY», 2-секундный mocha-таймаут на 45-мс таймере под нагрузкой) — изолированно 17/17.

## 3. Метод: «устаревший тест» или «баг продукта»

1. **Воспроизведи в конфигурации CI**: `--workers=1`, один спек. Если зелено — это класс нагрузки (F), и мерило
   там СТАВКА: `--repeat-each=8 --retries=0` до и после правки, число в отчёт.
2. **Читай артефакт, а не догадку**: `error-context.md`, `npx playwright show-trace test-results\<...>\trace.zip`,
   `video.webm`, скриншот.
3. **Спроси у продукта, что он теперь обещает**: соответствующий раздел `.claude/rules/console-ui.md` и
   `docs/claude/console/*.md`. Assert в спеке кодирует закон; если закон изменился — спек переписывается на новый
   закон с той же строгостью и с комментарием, ПОЧЕМУ он теперь такой. Если закон не менялся — это баг продукта.
4. **Бисекция по «UI rework»**: диапазон `23f8a50c51..65d3e556b4`, сообщения одинаковые, так что различать только
   сборкой. На каждом кандидате — `npm run build` (сервер + клиент + CSS), затем спек. Дорого, поэтому сначала
   grep по селектору/токену: часто переименование видно без бисекции.
5. **Проверяй, что сервер отдаёт ТУ сборку**: первая строка лога сервера `Starting <commit>, built at <date>`
   (заметка `e2e-stale-server-serves-old-chunks`). Две ложные «регрессии» уже стоили сессии.
6. Три подхода без прогресса — пиши гипотезы и замеры в отчёт и бери следующий класс; не молчи.

## 4. Законы репозитория (нарушение = баг, не стиль)

- Прочитай **целиком** `.claude/rules/tests.md` и `.claude/rules/console-ui.md` до первой правки; `CLAUDE.md` —
  инварианты, особенно «никогда не детектить промпт по тексту заголовка».
- Нажатие = act → verify → retry (`pressUntil` / `pressUntilVisible` / `pressUntilGone`); перезагрузка —
  `reloadConsole(page)`, никогда голый `page.reload()`; ожидание — `settle` на границах цепочки,
  `cinematicBeat(page, ms, why)` внутри; фиксированный сон — долг ратчета.
- Размещение тайла — два нажатия (`placeTile` / `walkToSpace` + `commitFocusedSpace`); ход по кольцу —
  `walkFocusUntil`, никогда своя ходилка.
- Платёж в e2e — производный (`{...NO_PAYMENT}`), не литерал. Раздача НЕ воспроизводима по памяти: спек держится
  за любую раздачу, которую конфиг может выдать (сиды дают повтор на одном коммите, не стабильность сценария).
- `npm run build:test` обязателен при любой правке в `tests/` — это ДВЕ ступени tsc (Mocha-дерево и e2e-дерево).
- Гард драйвера `tests/console/e2eDriverGuard.spec.ts` (внутри `test:server`) и ратчет
  `tests/console/e2eRatchetBaseline.json`: рост `waitForTimeout` / `requestAnimationFrame` валит прогон, падение —
  тоже, пока не закреплено `npm run e2e:baseline` в том же диффе.
- Пересобирать `build/` (`make:css`, `build:client`) во время идущего playwright — запрещено: страница без стилей,
  ложный красный (заметка `never-rebuild-during-e2e-run`).
- Общий `main` делит вторая клона, которая активно пушит «UI rework». Перед стартом и перед каждым пушем —
  `git fetch` + ребейз; пуш ТОЛЬКО `npm run push`, никогда голый `git push` (`docs/SHARED_MAIN_WORKFLOW.md`).
- **Парламент трогать нельзя** ради зелени чужого спека. Если общая правка задевает шасси (токены рамы, `.con-main`,
  `consoleWsStageLayout`, `console.less`), перегони `tests/e2e/console-parliament*.spec.ts`,
  `console-external-draw.spec.ts`, `console-parliament-chassis-parity.spec.ts`, галерею — и переприколи
  `tests/e2e/wsStageParity.ts` / `KNOWN_TOP_RESIDUAL` С ОБОСНОВАНИЕМ, если шасси действительно поехало.

## 5. Порядок работы и команды

```bash
npm run build                      # сервер + клиент + CSS. e2e обслуживают СБОРКУ, не исходники
npm run build:test                 # обязательно после правок в tests/

# один спек в конфигурации CI
npx playwright test tests/e2e/console-hud-frame.spec.ts --workers=1 --retries=0 --reporter=list

# ставка флейка (до и после правки)
npx playwright test <spec> --workers=1 --retries=0 --repeat-each=8

# класс целиком
npx playwright test tests/e2e/console-bot-corp-*.spec.ts --workers=1 --reporter=list > tmp/fix-botcorp.log 2>&1

# полный прогон в конфигурации CI (долго; ничего не пересобирать, пока идёт)
npx playwright test tests/e2e --workers=1 --retries=2 --reporter=list > tmp/full-ci-parity.log 2>&1

npx playwright show-trace test-results\<dir>\trace.zip
```

Коммит — на класс (A…G), локально, зелёным; сообщение `e2e green · <класс>: <суть>`. Пуш — `npm run push`
после того, как класс закрыт и ворота зелёные.

## 6. CI

`.github/workflows/playwright-e2e.yml`: запуск **ручной** (`workflow_dispatch`), **4 шарда** на `ubuntu-latest`,
`--workers=1`, `retries: 2`, трасса на первом ретрае, план шардов — `tests/e2e/shardPlan.json` (иначе позиционный
`--shard`), плюс burn-in тронутых за N коммитов спеков с `--repeat-each=3`. `gh` в этой машине НЕ установлен: если
не сможешь запустить workflow сам, попроси пользователя нажать dispatch и дать ссылку на прогон и артефакты.
Linux-специфика, которая ломает локально-зелёные гарды: округление глифовых адвансов вверх (симулируй худший случай,
не закладывай «запас в px»), регистрозависимые импорты (ловит `build:test`).

## 7. Готово, когда

1. `npx playwright test tests/e2e --workers=1` — **ноль красных**, ноль новых skip/fixme (кроме 10 пробников под
   флагами окружения; если снял fixme Плутона — он тоже зелёный).
2. Парламентские сюиты по-прежнему зелёные (`console-parliament*`, `console-external-draw`,
   `console-resolutions-playground`, `--workers=1`).
3. Ворота: `npm run build:test`, `npm run lint:client`, `npm run lint:i18n`, `npx eslint --no-cache <изменённые>`,
   `npm run test:server`, `npm run test:client`.
4. Прогон на CI (4 шарда) зелёный — прочитан по факту, а не предсказан.
5. Отчёт `docs/claude/e2e-foreign-reds-fix.md`: по каждому классу — вердикт (устаревший тест / баг продукта),
   доказательство (бисекция, диффы, замеры, ставка флейка до/после), что сделано, что осталось честным ограничением.
   Обнови ревизию в `memory/e2e-stable-failures-2026-09-03.md`.

## 8. Запрещено

- `test.skip` / `test.fixme` / `.only` как способ позеленеть; удаление или ослабление assert без ЗАМЕРА и причины,
  записанной рядом.
- Подгонка порога под текущее число («было 2 px, стало 14 — поставлю 15»): сперва объясни 14.
- Правка правил игры или продукта ради удобства теста.
- Пересборка во время идущего прогона; голый `git push`; коммит с красными воротами.
- Трогать парламентские спеки/стили, чтобы позеленел чужой класс.
- «Честное ограничение» вместо работы: ограничение допустимо, только если доказано замером, что починить нельзя
  в этой сессии, и названо, кому это принадлежит.
