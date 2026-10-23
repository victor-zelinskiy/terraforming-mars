# Промт исполнителю · Utopia Invest (R33, корпорация Turmoil) — ТРЕТЬЯ корпорация «на месте» (§3.1; после неё в hold-back остаётся только Pristar): Здание; 40 M€; «+1 пр. стали и +1 пр. титана»; ДЕЙСТВИЕ «понизьте любое производство на 1 шаг — получите 4 ресурса этого вида» — ПОЛНАЯ премиум-адаптация, с упором на АКТИВАЦИЮ (владелец: «максимально подключить под все премиум-механики и активация»): единственное в репозитории декларативное `or`-действие «производство −1 → запас +4» в ШЕСТИ вариантах — плитки-исходы с `current → resulting` по обеим осям, именованная недоступность каждого варианта, пол M€ −5, pre-select единственного варианта, ONE universal ACTION COMMIT с ЦЕНОЙ-ПРОИЗВОДСТВОМ (бейдж рельса) и результатом, рождённым из печатного «4 ?» в тоне ВЫБРАННОГО ресурса; без полировки (как TerraLabs)

> **Статус: СДАНО 2026-10-23** (c9: карта `b51616c520`, активация — коммит следом; решения 1–7 по умолчанию, 4а / 5а; 3 — владелец выбрал (б), безымянная причина;
> стенд `console-utopia-invest` 6 / 6 на Steam Machine; реестр PL-976…979 в разделе CI). **Выдан 2026-10-23.** HEAD `569e7ba305` (R14 TerraLabs — сдана: цена 1 M€ запинена во всех потоках, коллизия C38; R38 Lakefront — карта сдана;
> её финал CI — В РАБОТЕ у соседа: в дереве его незакоммиченные `ConsoleEndgameWorkspace.vue`, `ceremonyFx.ts`, `consoleEndgame{Director,Script,State}.ts`,
> `console_endgame.less`, `consoleEndgameCeremony.spec.ts`, `playwright.config.ts` — НЕ ТРОГАТЬ; `ListAgents` + `SendMessage` до первого коммита; `docs/
> TURMOIL_REDUX_CLASSIC_CARDS.md` ещё «11 из 22» — правка соседа). Реестр: footer «PL-965», раздела CI нет. **Эта задача — БЕЗ раздела реестра**; дефекты
> общего слоя — строками в раздел текущего footer в момент записи. **Лор и арт ЕСТЬ**: `assets/text/lore_texts.json:485` ключ `R33` (EN) — проверить RU в
> `src/locales/ru/lore_texts.json` (ключ = EN-текст лора; если RU нет — добавить: «Utopia — один из крупнейших венчурных капиталистов Марса: скупает
> компании, чтобы разобрать их на ресурсы или распродать по частям. Основатель Эдвард Льюис любит быструю прибыль, марсианский гольф и скачки при низкой
> гравитации.»); арт `assets/card-images/R33.webp` — импорт не нужен. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\corporations\Turmoil - Utopia Invest.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- utopia …`; exit 2/3/4 → спросить; стенд активации — TIMING-класс из-за такта коммита:
> `--exclusive --workers=1`, окно согласовать с соседом CI).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:147` п. 5 — бот не трогается; `:149` п. 6 — двойник прогноза нужен ЖИВОМУ хуку, у Utopia его нет;
`:214` строка «ждёт»), `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), **промты и коммиты Lakefront (`c159574f3d`) и TerraLabs (`569e7ba305`)**
— шаблон: `infoText` + RU `card_info` + строка в `turmoil_corporations.json` каждой локали + спек в правилах + `AutomaCorporations.spec` коллизия + пин + комментарий
бот-e2e. **Контракты активации:** CLAUDE.md § «Every card action has ONE universal ACTION COMMIT» (press → fix → impulse → handoff; **PL-099 / PL-104 — цена с
рельса уходит ПЕРВОЙ, вбок, в печатную иконку цены; результат рождается после**), `docs/claude/console/workspace-band.md` § ACTION COMMIT,
`docs/claude/console/variant-choice.md` (§1 «плитка отвечает на ОДИН вопрос», §2 «группа — ряд», §3 измерено на `variant-tiles`, **§6 «ЧЕТВЁРТАЯ раскладка
— ПАЛИТРА» (TR54)**, §7 «адреса»), `composer-preselect.md` (T14 CC: единственный включённый вариант посеян и помечен; курсор → CTA; прибытие на коммит),
`futile-actions.md`, `unavailability-reasons.md`, `docs/CONSOLE_BLUE_ACTION_PARITY.md`, память `variant-choice-outcome-tiles`, `composer-preselect-direction`,
`resource-flight-live-ends-direction` (оба конца живые; «ожидает»), `action-precollect-contract`, `status-line-no-face-restatement`, `ru-card-names-already-exist`
(имя латиницей: `zz_corporation_names.json:189`), `marsbot-corporations-framework` (C39 — свой объект, коллизия по `original`), инварианты 2, 3 (композер:
pre-select виден), 4, 6, 8, 9. Журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **карта** — `turmoil/UtopiaInvest.ts` (`ActiveCorporationCard`; `behavior.production {steel: 1, titanium: 1}`; `action.or.behaviors` × 6:
`{production: {X: −1}, stock: {X: 4}}`; лицо — `megacredits(40) + production(steel, titanium)`, `corpBox('action')`: `production(wild(1)) → wild(4, {digit})`),
`cardNumber: 'R33'`; **превью `or`** — `models/actionPreview.ts:166–176` (`subAvailability` — ветка исполнима ⇔ ноль причин), `:215–260`
(`deriveOrBranches` — ОДНА деривация для действия и розыгрыша; индекс рантайма — среди ИСПОЛНИМЫХ веток; `autoSelect`), `:276–278`; причины —
`models/actionUnavailableReasons.ts:94–95` (`production.canAdjust` → «Cannot reduce production» — без имени ресурса; у плитки имя есть, у ЧИПА РУКИ целого
действия причина нужна только когда ВСЕ шесть мертвы — невозможно: пол M€ −5 `player/Production.ts:12`); **плитки-исходы** — `console/variantChoiceModel.ts`,
`consoleActionComposer.ts:129–131`, `:256–259` («варианты отличаются только тем, что ДАЮТ: общая цена печатается раз»), e2e `console-variant-tiles.spec.ts:1–30`
(фикстура `variant-tiles` `generate.ts:~960–972`: Atmo Collectors — три плитки в ряд, интерьерный OR), `console-variant-settle.spec.ts` (T14 CC: посадка курсора,
прибытие на коммит); **ACTION COMMIT** — `console/consoleActionCommit.ts` (состояние + план), `consoleActionCommitMotion.ts:1–40` (фраза: PRESS → FIX → IMPULSE по
печатной графике ВЫБРАННОГО варианта → RESULT HANDOFF; якоря из реального лица `data-graphic-node`), **`:99–101`** («wild» — печатный «?» лица), **`:270–330`**
(`wildChosen`, `bareWildIcons` — «?» ВНЕ рамки производства: ресурс, которого строка не печатает, ВЫБРАННЫЙ из «?», РОЖДАЕТСЯ на нём; «?-production» внутри
`.pcard-prod` — своя иконка), `consoleActionCommitRail.ts` (рельс: цена/результат), `resourceTransfer/railReward.ts` (волна наград в рельс, тик на касании),
`consoleCommitGate.ts` / `commitArrival.ts` (CC); **корпорации-образцы с действием** — `corporation/EcoLine.ts:24` (`infoText` `action-short`),
`UnitedNationsMarsInitiative.ts:27`; **бот-двойник** — `common/automa/MarsBotCorpData.ts:1084–1090` (C39 `original: CardName.UTOPIA_INVEST`; «две половины» —
B32 Investors по чётности поколения — СВОЯ механика, ни строки), e2e `console-bot-corp-two-halves.spec.ts` (`:14` «Turmoil is off in this config…» —
УСТАРЕВАЕТ, как у C35 / C38: поправить словами); **гарды** — `tests/automa/AutomaCorporations.spec.ts:109–135` (коллизии C35 / C38 — ШАБЛОН для C39),
`tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts` (`adaptedCorporations = [LAKEFRONT, TERRALABS]` → + UTOPIA), `tests/cards/turmoil/UtopiaInvest.spec.ts`
(один `it('Should play')`), `tests/models/{actionPreview,actionPreviewCoverage,actionBranchAvailability,actionBranchPrinted,actionReasonCoverage,
actionPreviewReasonCoverage,actionFutility,actionPromptCoverage,potentialActions}.spec.ts` (гарды действий — после удаления строки карта попадает в их
перечисление), `cardInformation`, `cardLore` (R33), `premiumScope`, `CardMetadata`, `armedPlayEffectCoverage`, `holderActionGood`, `PremiumCard` /
`premiumCardViewModel` (лицо корпорации; `WILD → res/wild.png` `premiumCardIcons.ts:291`), `crossPlayerCoverageGuard` («none»); **спек-шаблон** —
`tests/cards/turmoil/TerralabsResearch.spec.ts:65–210` (структура «rule N — …»).

---

## Диагноз (подтверждён файл:строка на `569e7ba305`; перепроверить на своём HEAD)
1. **Карта декларативна и ЕДИНСТВЕННА в своём роде.** `grep -rln "production: {[a-z]*: -1}, stock" src/server/cards` → только Utopia Invest: шесть
   `or`-веток «производство −1 → запас +4». Превью строится `deriveOrBranches` (одна ветка на вид ресурса; индекс — среди исполнимых), доступность
   ветки — `subAvailability` (`production.canAdjust`: сталь/титан/растения/энергия/тепло ≥ 1, M€ ≥ −4), Executor исполняет выбранную ветку через рекордер
   (`production.add(−1)` + `stock.add(+4)` — журнал и события ✓). Значит, композер получит ШЕСТЬ плиток-исходов из коробки — и это первый случай ШЕСТИ в
   одной группе (измерено три — `variant-choice.md` §3; на 4K шесть в ряд ≈ 2 × ширина измеренной группы — вероятно, ПАЛИТРА §6, TR54).
2. **Цена этого действия — ПРОИЗВОДСТВО, не запас.** Общая цена вариантов печатается раз над плитками (`consoleActionComposer:256–259`) — но здесь цена у
   каждого варианта СВОЯ (пр. X −1), так что плитка печатает ОБЕ оси: «пр. X: N → N−1 · X: S → S+4». ACTION COMMIT: PL-104 знает цену-ЗАПАС с цифр строки рельса;
   цена-ПРОИЗВОДСТВО — это бейдж «+N» той же строки (`.con-res__prod`, якорь `consoleResourceTransfer.ts:1595`): проверить `consoleActionCommitRail.ts` — есть ли
   ветка «жетон с бейджа производства в печатный «?-production»» (TR37 «Серийный выпуск» / RX38 класса?). Если нет — ДЕФЕКТ общего слоя этой задачи:
   цена производства уходит ПЕРВОЙ (жетон «−1» с бейджа вбок в печатную рамку производства «?», бейдж тикает на отлёте), ПОТОМ результат.
3. **Результат из «?» в тоне выбранного.** `bareWildIcons` / `wildChosen` (`:276–330`) уже умеют: ресурс, которого строка не печатает, выбранный из «?»,
   рождается на печатном «4 ?» вне рамки производства — волна +4 в строку рельса ВЫБРАННОГО ресурса, тик на касании. Пинить стендом (четыре жетона? или один
   с «+4» — как у награды волны: по `railReward` правилу количества тел — не плодить).
4. **Pre-select и курсор (CC).** В начале партии с Utopia: пр. стали 1, титана 1, M€ 0 (−1 допустим), остальные 0 → ТРИ включённых варианта (посева нет);
   на столе с одним включённым (напр. всё по 0, кроме M€) — единственный вариант ПОСЕЯН и помечен «ЕДИНСТВЕННЫЙ ВАРИАНТ», курсор на CTA с прибытием;
   мёртвые плитки ПОКАЗАНЫ выключенными с причиной «производство X = 0 — понижать нечего» / «производство M€ на минимуме (−5)» — сейчас причина одна и
   безымянная («Cannot reduce production») — для плитки достаточно (имя на плитке), для хинта — назвать ресурс и текущее значение (решение 3).
5. **Остальное по шаблону:** `infoText` (`action-short`); RU (имя латиницей; `turmoil_corporations.json:13–14` «Вы начинаете с 40M€. Увеличьте на 1 своё
   производство стали и титана» / «Уменьшите любое своё производтство…» — опечатка и не голос набора); лор RU — проверить/добавить; лицо: тема корпорации,
   ряд «40 M€ · [пр. сталь][пр. титан]», коробка действия «[?]-производство → 4 [?]» (`wild.png`); стартовая сцена — 40 M€, в сводке — производство +1/+1
   (если сводка печатает производства стартовых корпораций — прецедент: проверить; иначе не добавлять); «Разыграно» — герой корпорации с чипом действия
   «Активирована» после хода; «Действия карт» — строка действия с шестью вариантами; журнал — две строки рекордера; коллизия C39; пин; комментарий бот-e2e.
6. **Что НЕ делать:** переписывать ветки в bespoke; `autoSelect`; скрывать мёртвые варианты; второй расчёт доступности на клиенте; трогать C39 / «две половины»;
   полировка (владелец не просил).

## Правила корпорации (спек пинит каждое — по шаблону TerraLabs `:65–210`)
1. Печатная: 40 M€, метка Здание, розыгрыш → пр. стали +1, титана +1, без первого действия, `R33`; Redux-стол раздаёт; лицо — ряд и коробка действия.
2. Действие: шесть веток; ветка X исполнима ⇔ `production.canAdjust({X: −1})` (M€ до −5 включительно); исполнение → пр. X −1 и +4 X в запас (события
   рекордера с источником-картой; журнал — две строки); раз в поколение (`actionsThisGeneration`); превью — шесть веток с `effects` (production current →
   resulting, stock current → resulting), индексы рантайма среди исполнимых, мёртвые — `index −1` + причина; все шесть мертвы — невозможно (M€ −5 → M€
   ветка мертва, остальные по нулям → ПЯТЬ мертвы, M€ мертва — ВОЗМОЖНО: пр. M€ −5 и всё по нулям → действие недоступно, чип руки — одна причина; пинить).
3. Модель: действие в списке «potentialActions» владельца; `actionPreview` коробки; `cardInformation` — строка действия.
4. Бот-коллизия C39; save / load — ничего нового; `crossPlayerCoverageGuard` — «none».

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения T04…T07 / Lakefront / TerraLabs не переспрашивать)
1. **RU** — имя латиницей; описание — «Вы начинаете с 40 M€. Увеличьте производство стали и титана на 1 шаг каждое.»; действие — «Действие: понизьте любое
   производство на 1 шаг и получите 4 ресурса этого вида.»; лор RU — проверить, при отсутствии — из статуса.
2. **Инфо-модель** — ОДИН `action-short`: «Lower any production 1 step: gain 4 of that resource» (+ RU в `card_info`).
3. **Причина мёртвой плитки** — (а, рекомендовано) именованная в общем слое: «Cannot reduce ${0} production: it is ${1}» (ресурс + текущее; для M€ — «at the
   minimum (−5)») — для ЛЮБОГО `production: −N` в `actionUnavailableReasons:94` (покрывает и другие карты); классический текст остаётся где фасада
   нет; (б) оставить безымянную (плитка и так называет ресурс).
4. **Раскладка шести плиток** (диагноз 1) — (а, рекомендовано) ПАЛИТРА (§6 TR54): шесть плат-ресурсов в два ряда по три на 4K / fhd (Deck — по решению
   §6), каждая печатает ОБЕ оси «пр. N → N−1» и «S → S+4» в тоне ресурса, мёртвые — приглушены по материалу + причина; грамматика ◄► / ▲▼ по §2; (б) ряд
   шести — если пробник фита (§3 — группа не переполняет колонку, коммит под ней) проходит на всех профилях.
5. **ЦЕНА-ПРОИЗВОДСТВО на коммите** (диагноз 2) — (а, рекомендовано) PL-104 для бейджа: жетон «−1» с бейджа производства строки X уходит ВБОК в печатную рамку
   производства «?» (якорь `.pcard-prod` с `wild`), бейдж тикает на отлёте, ЗАТЕМ импульс доходит до «4 ?» и волна +4 рождается там в ТОНЕ X и садится на
   цифры строки X (тик на касании); (б) бейдж тикает без жетона, волна как есть.
6. **Стенд** — `tests/e2e/console-utopia-invest.spec.ts` (TIMING, tv4k + fhd): (а) «Действия карт» → Utopia: шесть плиток, три включённых (фикстура старта),
   три мёртвых с причиной; плитка печатает обе оси с серверными числами; ◄►/▲▼ по грамматике; (б) `utopia-invest-sole`: один включённый вариант — ПОСЕЯН,
   помечен, курсор на CTA с прибытием, A в окне прибытия поглощён; (в) A → ACTION COMMIT: press/fix, импульс по ВЫБРАННОЙ ветке, жетон «−1» с бейджа →
   рамка «?» (бейдж тикает на отлёте, не раньше), волна +4 из «4 ?» в строку X (строка тикает на касании), workspace складывается только по `surfaceClear`;
   сервер: пр. X −1, X +4, действие использовано; (г) второе нажатие в том же поколении — «Активирована» (выключено, причина); (д) `utopia-invest-dead`: пр. M€
   −5, всё по нулям → действие недоступно, чип руки с одной причиной; (е) «Информация › корпорация» — строка действия; (ж) бот — не C39; (з) стартовая
   сцена — 40 M€ (и производства, если сводка их печатает); (и) reduced motion — те же числа без полёта. Фикстуры — `generate.ts` по образцу `variant-tiles`:
   `utopia-invest` (Redux + Turmoil, Utopia на столе, фаза действий, пр. сталь 1 / титан 1 / M€ 0 / остальные 0), `utopia-invest-sole`, `utopia-invest-dead`.
7. **Объём** — всё карта + активация (≈ 100 %); найденные дефекты общего слоя (цена-производство на коммите, безымянная причина, фит шести плиток) —
   чинить с тестом, строками в реестр текущего footer.

## 0. Рабочее дерево
1. `git log --oneline -1` → `569e7ba305` на выдаче. `ListAgents` + `SendMessage` соседу CI: твои файлы — `turmoil/UtopiaInvest.ts` + спек, `common/cards/
   turmoilReduxAdaptation.ts`, `models/actionUnavailableReasons.ts` (3а), `tests/automa/AutomaCorporations.spec.ts`, `TurmoilCardsUnderRedux.spec.ts`,
   `console-bot-corp-two-halves.spec.ts` (комментарий), `locales/*/turmoil_corporations.json`, `ru/{card_info,lore_texts}.json`, (4/5) `variantChoiceModel.ts` /
   `ConsoleActionComposer.vue` / `consoleActionCommit*.ts` / `console.less` § композер, e2e + фикстуры, доки. Коммиты — ПО ХАНКАМ / явными путями (`git commit --
   <paths>`); после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot utopia` → `npm run e2e:remote -- utopia <spec> --exclusive --workers=1`; кадры «до» —
   клиент HEAD; exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — карта (≈ 35 %)
`UtopiaInvest.ts`: `infoText`; правил не менять. Строка долой + пин; RU; локали (шаблон); лор RU; коллизия C39; комментарий бот-e2e; (3а) причина с именем —
общий слой + `actionUnavailableReasons.spec`. Спек: классический `it` + «на Turmoil Redux table» — правила 1–4 (каждая ветка: доступность на границе — сталь 1 →
да, 0 → нет; M€ −4 → да, −5 → нет; исполнение каждой; превью: шесть веток, индексы, причины; «все мертвы» — действие недоступно; «Активирована»; модель).

## 2. Клиент — АКТИВАЦИЯ (≈ 45 %)
Ожидается: композер и коммит работают из коробки — ДОКАЗАТЬ стендом; что не работает — дефект общего слоя: (4) фит шести плиток (палитра / ряд — пробник
§3 на трёх профилях), (5) цена-производство на коммите (`consoleActionCommitRail` — ветка бейджа, якорь `__prod`, печатная рамка «?-production»),
(3) хинт причины. Спеки: `variantChoiceModel.spec` (шесть плиток, обе оси, мёртвые), `consoleActionCommit.spec` (план с ценой-производством: порядок
«цена → результат», wild → тон выбранного), `actionCommitRailRule.spec`.

## 3. Стенд и регрессия (≈ 20 %)
Стенд решения 6; регрессия: `console-variant-tiles`, `console-variant-settle`, `console-composer-preselect`, `console-action-price-fold`, `console-rail-landing`,
`console-flight-paint`, `console-bot-corp-two-halves`, `tv-profile-screens` — по 2 повтора (TIMING — эксклюзив); хуки, задетые палитрой, — тем же диффом (инвариант 14).

## 4. Лицо, локаль, лор, арт
Лор EN есть, RU — проверить/добавить; арт R33 есть (`make:cards` → `cardInfoAudit`); RU — решение 1; новые EN-ключи (инфо-модель; причина 3а) — `grep` ДО
добавления; RU чужих ключей не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: все `tests/models/action*.spec.ts` (перечисление действий в скоупе — карта попадает в каждый: читать красные как
   worklist), `cardInformation`, `cardLore` (R33), `premiumScope`, `CardMetadata`, `armedPlayEffectCoverage`, `holderActionGood`, `crossPlayerCoverageGuard` («none»),
   `PremiumCard` / `premiumCardViewModel`, `TurmoilCardsUnderRedux` (пин), `AutomaCorporations` (C39), `e2eLiveness`, `glyphLiteralGuard`, `consoleTvTypeFloor`,
   `cursorGrammarGuard`, `flightLayerZOrder`, `transferSurfaceClear`.
2. `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §3; `npm run e2e:affected`.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd; Deck — композер без скролла)
`screenshots/utopia/{tv,fhd,deck}/`: (а) лицо корпорации с артом (старт, «Разыграно», «Информация»); (б) композер — шесть плиток (три включённых / три
мёртвых с причинами), посев единственного; (в) коммит: press → импульс → жетон «−1» с бейджа в рамку «?» → волна +4 из «4 ?» в строку → тик → фолд;
(г) «Активирована»; (д) недоступное действие с причиной. С дивана: «я понял, что отдаю и что получаю, ДО нажатия — и увидел, как это произошло?»

## 7. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer (после CI соседа); бэклог — без изменений.
2. Доки: `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — Utopia Invest «СДАНА» (после строк соседа; остаётся Pristar); `docs/claude/console/variant-choice.md` —
   § «шесть вариантов (Utopia Invest): раскладка, обе оси на плитке»; `workspace-band.md` § ACTION COMMIT — абзац «цена-производство: бейдж → рамка «?», затем
   результат из «4 ?» в тоне выбранного» (если 5а); `unavailability-reasons.md` — именованная причина производства (если 3а); запись в журнале.

## 8. Режим работы
1. Читать до кода; `SendMessage` соседу; карта → спек → пин/коллизия → кадры композера «до» на трёх профилях (фит шести) → (4/5/3) общий слой с тестами →
   стенд → регрессия → раскадровки → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо корпорации с артом; затем кадры композера (шесть плиток, посев) и коммита, результат регрессии, решения 1–7 с тем, что
   сделано по умолчанию, ОДИН `AskUserQuestion` (4 с кадрами, 5, 3 — рекомендация первой), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Bespoke вместо декларативных веток; `autoSelect`; скрывать мёртвые варианты; второй расчёт доступности / чисел на клиенте (только превью сервера);
  менять порядок «цена → результат»; результат не из печатного «4 ?»; трогать C39 / `MarsBotCorpData` / «две половины»; строку статуса, повторяющую лицо;
  `title`; литерал кнопки; текст ниже пола TV; полировка (владелец).
- Файлы соседа CI (финал); лор-строки чужих карт; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
