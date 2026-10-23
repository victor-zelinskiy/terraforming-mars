# Промт исполнителю · TerraLabs Research (R14, корпорация Turmoil) — ВТОРАЯ корпорация «на месте» (§3.1; по шаблону Lakefront `c159574f3d`): Наука + Земля; 14 M€; «понизьте РТ на 1 шаг»; ЭФФЕКТ «покупка карты в руку стоит 1 M€, включая стартовую руку» — ПОЛНАЯ премиум-адаптация без полировки (владелец: «максимально в премиум-скоуп, в этой итерации можно без полировок»): инфо-модель, лицо, спек Redux-стола, ЦЕНА 1 M€ ВО ВСЕХ ПОТОКАХ ПОКУПКИ пинится (стартовая сцена · исследование · драфт · fallback `projectCard` · кампания), РТ 19 на рельсе с первого кадра, бот-двойник C38 не трогается, коллизия выбора пинится

> **Статус: ВЫДАН 2026-10-23.** HEAD `c159574f3d` (R38 Lakefront — КАРТА сдана: двойники, спек 251 строка, коллизия C35, пин «adaptedCorporations =
> [LAKEFRONT]»; её полировка финала (раздел **CI**) — В РАБОТЕ у соседа: `ListAgents` показал `terraforming-mars-85` (busy) и `-93` (waiting) —
> `SendMessage` обоим до первого коммита; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` ещё говорит «11 из 22» и строка Lakefront «ждёт» — ЕГО правка, не
> трогать; footer реестра «PL-965», раздела CI нет). **Эта задача — БЕЗ раздела реестра** (полировки нет); дефекты общего слоя, найденные по пути,
> — строками в раздел ТЕКУЩЕГО footer в момент записи (после CI соседа → **CJ**), иначе — в бэклог. **Лор и арт ЕСТЬ**: `assets/text/lore_texts.json:484`
> ключ `R14` (EN) + `src/locales/ru/lore_texts.json:484` (RU); арт `assets/card-images/R14.webp` (манифест `:394`) — импорт не нужен. Скан —
> `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\corporations\Turmoil - TerraLabs Research.png`. **e2e — ТОЛЬКО Steam Machine**
> (`npm run e2e:remote -- terralabs …`; exit 2/3/4 → спросить; FUNCTIONAL — без эксклюзива, но окно согласовать с соседом CI, у которого TIMING).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:58–60`, `:131`, **`:147` п. 5 — бот не трогается**, `:149` п. 6 — двойник прогноза ОБЯЗАТЕЛЕН только
для ЖИВОГО хука; у TerraLabs живого хука НЕТ, `:213` строка «ждёт»), `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), **промт Lakefront**
(`docs/claude/prompts/classic-corp-lakefront-resorts.md` — §1 корпорации и «решения 1–3» — те же шаги) и его КОММИТ `c159574f3d` (22 файла: `infoText` + RU
`card_info` + строка в `turmoil_corporations.json` КАЖДОЙ локали + спек в 9 правилах + `AutomaCorporations.spec` коллизия + пин + комментарий бот-e2e).
**Контракты:** `.claude/rules/game-logic.md` (co-located, инвариант 8), `docs/claude/console/start-scene-summary.md` / `start-flow-motion.md` /
`start-first-action.md` (стартовая сцена: сводка «ИТОГО», бюджет, первый кадр партии), `docs/CONSOLE_FOUNDATION.md` §10c (драфт / покупка — кошелёк T10
CE: «N × цена», цена — `thisPlayer.cardCost`, НИКОГДА константа), память `status-line-no-face-restatement` (владелец 2026-10-23: строка статуса под картой
НЕ повторяет лицо — только дельта игрока; перед добавлением факта назови зону, где он уже виден), `card-information-model`, `premium-card-renderer`,
`card-lore-archive-entry`, `ru-card-names-already-exist` (имена корпораций — ЛАТИНИЦЕЙ: `zz_corporation_names.json:171` «TerraLabs Research»),
`marsbot-corporations-framework` (C38 — свой объект; коллизия по `original`), `initialCards-phase-is-research`, `create-game-settings-persistence`,
`campaign-multicorp-podium` (кампания: `campaignStartingBudget` складывает `cardCost` корпораций родословной), инварианты 2 (цена — серверная), 7, 9.
Журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **цена покупки** — `Player.ts:355–362` (`baseCardCost` — СЕРИАЛИЗОВАННАЯ половина: 3 или замена корпорации «Polyphemos 5,
Terralabs 1»), `:1302–1322` (`get cardCost` — ОДИН авторитетный ответ всем потокам: база − скидки `getCardPurchaseDiscount` (Quantum Research), пол 0,
ДЕРИВИРУЕТСЯ — перезагрузка не удвоит), `models/ServerModel.ts:659` (`cardCost` в `PublicPlayerModel`), `deferredActions/ChooseCards.ts:64/126`
(исследование / драфт: доступность и списание по `player.cardCost`), `inputs/SelectInitialCards.ts:124–140` (СТАРТ: `corporation.cardCost` — «включая
стартовую руку» — или бюджет кампании), `campaign/CampaignMissionSetup.ts:434–461` (`campaignStartingBudget`: `cardCost += corp.cardCost − 3`), `common/cards/
ClientCard.ts:30` (`cardCost?: number // Corporation` — клиент знает цену ДО розыгрыша корпорации); **клиент** — `initialDraft/initialDraftMoney.ts:25–55`
(`cardCostForCorp` / `startingMegacredits` — из `ClientCard.cardCost`), `console/startStatusPreview.ts:51–60` (`projectsCost = buys × cardCost`, `remaining`),
`ConsoleStartScene.vue:226`, `:992` («Проекты N × цена»), `:3395–3422` (`cardCost` / `budget`), `console/consoleStartState.ts:572–591` (кампания:
`cardCostDelta`), `ConsoleTaskHost.vue:1944–1956` (fallback `projectCard` pick → pay: `thisPlayer.cardCost`), `draft/ConsoleDraftWorkspace.vue:600–602`,
`console/draft/draftReadingModel.ts:16–17, :42` (кошелёк T10 CE — «N × 3 = −M · у вас A → B», цена — сервера); **РТ** — `behavior/Executor.ts:575–577`
(`behavior.tr` — декларативно, лог по объекту), рельс `.con-score` (РТ 20 → 19 при раскрытии корпорации); **бот-двойник** — `automa/corps/MarsBotTerraLabs.ts`
(C38: «−8 РТ за темп; 1 → 2 карты в колоду действий с 9-го поколения» — СВОЯ валюта, ни строки), `common/automa/MarsBotCorpData.ts:1065–1070`
(`original: CardName.TERRALABS_RESEARCH`), e2e `console-bot-corp-tr-price.spec.ts` (`:12–13` — «Turmoil is off in this config, so the collision rule cannot…» —
УСТАРЕВАЕТ, как у Lakefront: поправить словами, не логикой); **гарды** — `tests/automa/AutomaCorporations.spec.ts:109–120` (коллизия C35 — ШАБЛОН для C38),
`tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts:45`, `:105` (`adaptedCorporations = [LAKEFRONT]` → + TERRALABS), `tests/cards/turmoil/TerralabsResearch.spec.ts`
(один `it('Should play')`), `cardInformation.spec`, `cardLore` (R14 ✓), `premiumScope`, `CardMetadata`, `armedPlayEffectCoverage`, `PremiumCard` /
`premiumCardViewModel` (`:473` лицо корпорации), `crossPlayerCoverageGuard` (источник без чужого пути — классифицировать «none»); e2e стартовой сцены —
`start-scene-profiles.spec.ts` (реальная раздача 2 корп / 4 прелюдии / 10 проектов, 4 профиля — `:264` «A = выбрать корпорацию, RT = далее»),
`console-research-startups.spec.ts` (покупка в фазе исследования, `bootFixtureSeats(…, 'research-startups')`), `console-draft-showcase` (кошелёк).

---

## Диагноз (подтверждён файл:строка на `c159574f3d`; перепроверить на своём HEAD)
1. **Карта уже декларативна и уже «понята» экономикой.** `TerralabsResearch.ts`: `cardCost: 1` (поле корпорации → `baseCardCost` игрока), `behavior.tr: -1`,
   `startingMegaCredits: 14`, метки Наука + Земля, `cardNumber: 'R14'`. Цена — серверный `player.cardCost`, и КАЖДЫЙ поток покупки читает его: старт
   (`SelectInitialCards` — «включая стартовую руку»), исследование и драфт (`ChooseCards`), fallback `projectCard` (`ConsoleTaskHost`), кошелёк T10
   (`draftReadingModel`), кампания (`campaignStartingBudget`). Стартовая сцена ДО розыгрыша читает `ClientCard.cardCost` (`cardCostForCorp`) — та же
   цифра. Работа карты — не код экономики, а ДОКАЗАТЕЛЬСТВО: спек в правилах + стенд, что ни один поток не печатает «3».
2. **Нет инфо-модели.** `infoText` отсутствует → «Информация › корпорация», досье, чип — без строки эффекта; у Lakefront добавлены два `effect-short` с
   RU в `card_info.json` — тот же шаг. Ключ `card_info.json:513` «Buying cards to hand costs 1 M€ less» — ЧУЖОЙ (Quantum Research: «дешевле на 1»);
   TerraLabs — «стоит 1 M€» — свой ключ.
3. **РТ −1 на старте.** Декларативный `tr: -1` исполняется при розыгрыше корпорации (стартовая церемония): рельс РТ должен стоять «19» с первого кадра
   партии; сводка «ИТОГО» стартовой сцены показывает M€ после покупок (`remaining = 14 − N × 1`) — показывает ли она РТ 19? (`startStatusPreview.ts` не
   знает РТ — проверить: если сводка печатает «РТ 20» или молчит, а у Vital Air / Pristar-класса есть прецедент строки РТ — выровнять; если прецедента нет —
   НЕ добавлять (память `status-line-no-face-restatement`: лицо уже говорит «−1 РТ»).
4. **Цена ≠ печатной — где это объяснено?** Кошелёк T10 печатает «N × 1 = −N» — честно, но источник (TerraLabs) нигде не назван; у Polyphemos (5) то же.
   Правило владельца: не повторять лицо, факт назвать там, где его ещё нет. Зона, где цена видна: кошелёк (число есть) → хинт `data-hint` на части «× 1»:
   «Цена покупки: 1 M€ · TerraLabs Research» (источник из `tableau` — корпорация с `cardCost`; скидка Quantum Research — тем же хинтом «3 − 1 · Quantum
   Research»). ТОЛЬКО хинт, не строка (решение 3).
5. **Бот-коллизия и пины** — как у Lakefront: человек взял TerraLabs → бот не C38 (`original`); `TurmoilCardsUnderRedux` — пин корпораций `[LAKEFRONT,
   TERRALABS]`; комментарий `console-bot-corp-tr-price.spec.ts:12–13` — обновить словами.
6. **Локали.** `turmoil_corporations.json:7` «"Terralabs Research": ""» — пустое значение ключа, которого на лице НЕТ (лицо берёт `zz_corporation_names`
   «TerraLabs Research», латиница); Lakefront-коммит ДОБАВИЛ строку в `turmoil_corporations.json` каждой локали — повторить ТО ЖЕ (посмотреть диффом, что
   именно: EN-ключ эффекта с переводом; пустую строку имени — оставить как есть, как у Lakefront, не чинить мимоходом). RU описания — голос набора:
   «Вы начинаете с 14 M€. Понизьте ваш РТ на 1 шаг.»; эффект — «Эффект: покупка карты в руку стоит 1 M€, включая стартовую руку.» (ключи — свои).
7. **Что НЕ делать:** второй расчёт цены на клиенте (инвариант 2); `getCardPurchaseDiscount` вместо `cardCost` (поле — печатная ЗАМЕНА базы, хук — скидка;
   upstream-семантика Polyphemos / Terralabs); трогать C38; «первое действие» — его нет; полировка — нет (владелец).

## Правила корпорации (спек пинит каждое — по шаблону `LakefrontResorts.spec.ts:56–270`)
1. Печатная: 14 M€, метки Наука + Земля, `cardCost: 1`, `tr: −1`, без первого действия, `R14`; лицо — тема корпорации, ряд «14 M€ − 1 РТ», коробка
   эффекта «[карта] : 1 M€»; Redux-стол раздаёт её (не в hold-back); розыгрыш → 14 M€ и РТ 19 (журнал — строка РТ).
2. ЦЕНА 1 ВЕЗДЕ: `player.cardCost === 1` после розыгрыша; `ChooseCards` (исследование: 4 карты = −4 M€; драфт — то же); `SelectInitialCards` — стартовая рука
   по 1 (14 − N), ошибка «Too many cards» при N > 14; с Quantum Research в tableau — 0 (пол); сброс корпорации (Merger / замена) — база 3; кампания —
   `campaignStartingBudget` с TerraLabs в родословной: `cardCost` 1 + вклад других корпораций (Polyphemos → 3; пол 0).
3. Модель: `PublicPlayerModel.cardCost === 1` для всех зрителей (соперник видит мою цену — публичный факт); `ClientCard.cardCost === 1` на карте до розыгрыша.
4. Бот-коллизия (диагноз 5); save / load — `baseCardCost` 1 сохраняется, `cardCost` дериватом; MarsBot C38 — ни строки; `crossPlayerCoverageGuard` — «none».

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **RU** — имя латиницей (политика); описание и эффект — диагноз 6; лор RU — существующий, не трогать.
2. **Инфо-модель** — два `effect-short`: «Buying a card to hand costs 1 M€» · «…including the starting hand» — или один с «including your starting hand»
   (рекомендовано: ОДИН — «Buying cards to hand costs 1 M€, including the starting hand»; второй факт «−1 TR at start» — НЕ строка эффекта: это
   однократный розыгрыш, он на лице и в журнале).
3. **Хинт источника цены** (диагноз 4) — (а, рекомендовано) `data-hint` на части «× N» кошелька T10 и на сумме стартовой сводки, когда `cardCost ≠ 3`:
   «Цена покупки N M€ · <корпорация / карта>» — источник из `tableau` (поле `cardCost` корпорации / хук скидки), без строки, без изменения геометрии;
   (б) ничего — число уже честное.
4. **Стенд** — `tests/e2e/console-terralabs-research.spec.ts` (FUNCTIONAL, tv4k + fhd): (а) стартовая сцена (реальная раздача, как `start-scene-profiles`):
   выбрать TerraLabs → проекты: «Проекты N × 1», сводка «ИТОГО 14 − N», хинт (3а); подтвердить → первый кадр партии: рельс РТ **19**, M€ = 14 − N, рука N,
   журнал «розыгрыш корпорации · −1 РТ»; (б) фаза исследования (`research-startups`-класс, TerraLabs вместо корпорации фикстуры): кошелёк «N × 1 = −N · у
   вас A → A−N», выбрать 2, A — сервер списал 2; (в) драфт (`draftVariant`) — тот же кошелёк «× 1»; (г) fallback `projectCard` (`ConsoleTaskHost`) — pay 1;
   (д) бот в партии — НЕ C38; (е) «Информация › корпорация» — строка эффекта; (ж) Deck — старт без скролла (готовый пробник `start-scene-profiles`).
   Фикстуры: `terralabs-research` (старт: `keepInitialCardSelection`-класс с TerraLabs среди двух корпораций на выбор), `terralabs-research-research`
   (фаза исследования, TerraLabs на столе, 20 M€, бот ≠ C38), `terralabs-research-draft`.
5. **Объём** — всё карта (≈ 100 %); полировки нет; найденные дефекты общего слоя (например, литерал «3» где-либо, хинт без источника) — чинить с тестом
   и записывать строками в реестр.

## 0. Рабочее дерево
1. `git log --oneline -1` → `c159574f3d` на выдаче. `ListAgents` + `SendMessage` соседям CI (-85 / -93): твои файлы — `turmoil/TerralabsResearch.ts` + спек,
   `common/cards/turmoilReduxAdaptation.ts` (строка TERRALABS), `tests/automa/AutomaCorporations.spec.ts`, `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts`,
   `tests/e2e/console-bot-corp-tr-price.spec.ts` (комментарий), `locales/*/turmoil_corporations.json`, `ru/card_info.json`, (по 3а) `draftReadingModel.ts` /
   `ConsoleDraftWorkspace.vue` / `startStatusPreview.ts` / `ConsoleStartScene.vue`, e2e корпорации, фикстуры `generate.ts`, доки. `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`
   — ПОСЛЕ коммита соседа. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>`); после коммита — `git reset -q -- package.json package-lock.json`.
   Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot terralabs` → `npm run e2e:remote -- terralabs <spec>`; exit 2/3/4 — СТОП и
   `AskUserQuestion`; стенд — решение 4.

## 1. Сервер — карта (≈ 50 %)
`TerralabsResearch.ts`: `infoText` (решение 2); правил карты не менять. Строка долой + пин (`adaptedCorporations = [LAKEFRONT, TERRALABS]`); RU; локали (диагноз 6);
коллизия C38 в `AutomaCorporations.spec` (шаблон `:109–120`); комментарий бот-e2e. Спек: классический `it` остаётся + «на Turmoil Redux table» — правила 1–4
(каждая цифра — из `player.cardCost` / модели, не из константы; кампания — через `campaignStartingBudget`; Quantum Research — пол 0; Merger — база 3).

## 2. Клиент (≈ 30 %)
Ожидается НОЛЬ новых компонентов. Проверить лицо (арт R14, тема корпорации, «14 − 1 РТ», коробка эффекта), стартовую сцену («N × 1», «ИТОГО»), первый кадр
партии (РТ 19), кошелёк T10, `ConsoleTaskHost` fallback, «Информация › корпорация»; (3а) хинт источника цены — чистая функция `purchasePriceSource(view)` →
`{price, source?}` из `thisPlayer.cardCost` + `tableau` (поле `cardCost` корпорации / карта с хуком скидки по `ClientCard`), спек; `data-hint`, без `title`.
Всё, что печатает «3» вместо `cardCost`, — дефект общего слоя: чинить там, с тестом, строкой в реестр.

## 3. Стенд и регрессия (≈ 20 %)
Стенд решения 4; регрессия: `start-scene-profiles`, `console-research-startups`, `console-draft-showcase`, `console-draft-workspace`, `console-bot-corp-tr-price`,
`console-bot-corp-*` (выборочно 2), `tv-profile-screens` — по 1 повтору (FUNCTIONAL); хуки, задетые хинтом, — тем же диффом (инвариант 14).

## 4. Лицо, локаль, лор, арт
Лор и арт есть (`make:cards` → `cardInfoAudit` без замечаний); RU — решение 1; новые EN-ключи: строка инфо-модели (решение 2), хинт «Card purchase price:
${0} M€ · ${1}» — `grep` по всем `src/locales/*/*.json` ДО добавления; RU чужих ключей (Quantum Research `:513`) не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardInformation`, `cardLore` (R14), `premiumScope`, `CardMetadata`, `armedPlayEffectCoverage`, `crossPlayerCoverageGuard`
   («none»), `effectForecastCoverage` / `effectForecastParity` (без хука — ничего не требуют: убедиться), `PremiumCard` / `premiumCardViewModel`,
   `TurmoilCardsUnderRedux` (пин), `AutomaCorporations` (коллизия), `e2eLiveness`, `glyphLiteralGuard`, `consoleTvTypeFloor`.
2. `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §3; `npm run e2e:affected`.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd; Deck — старт без скролла)
`screenshots/terralabs/{tv,fhd,deck}/`: (а) стартовая сцена — пик TerraLabs (лицо с артом R14) → проекты «N × 1» + хинт → сводка «ИТОГО 14 − N» → первый
кадр партии (РТ 19, M€); (б) исследование — кошелёк «× 1»; (в) драфт — кошелёк; (г) «Информация › корпорация». С дивана: «я понял, что карты для меня по 1 M€
и почему?»

## 7. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer (после CI соседа); бэклог `weak-visuals-backlog` — без изменений.
2. Доки: `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — TerraLabs «СДАНА» (13 из 22 — после строки Lakefront соседа; остаются Pristar, Utopia Invest);
   `docs/claude/console/start-scene-summary.md` — абзац «цена покупки ≠ 3: хинт источника (TerraLabs 1 / Polyphemos 5 / Quantum Research −1)»
   (если 3а); запись в журнале.

## 8. Режим работы
1. Читать до кода; `SendMessage` соседям; карта → спек → пин/коллизия → клиентская проверка (3а) → стенд → регрессия → раскадровки → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо корпорации с артом; затем кадры стартовой сцены / исследования / драфта с ценой 1, результат регрессии, решения 1–5 с
   тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (решение 3 — рекомендация первой; 2), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Второй расчёт цены на клиенте; константа `CARD_COST` в печати; `getCardPurchaseDiscount` вместо `cardCost`; менять правила / C38 / `MarsBotCorpData`;
  строку статуса, повторяющую лицо («−1 РТ», «1 M€ за карту» как ТЕКСТ рядом с числом); `title`; литерал кнопки; текст ниже пола TV; полировка (владелец).
- Файлы соседей CI (`console_endgame.less`, `consoleEndgame*`, `console-finale-*`, классический док до его коммита); лор-строки чужих карт; RU чужих ключей;
  `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
