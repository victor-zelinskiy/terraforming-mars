# Промт исполнителю · T09 PR Office («Пресс-служба») — третья классическая карта Turmoil под Redux, «на месте» (§3.1): зелёная (автоматическая), 7, метка Земли, 0 ПО; «Союз правит ИЛИ 2 ваших делегата на их резолюции»; «+1 РТ; +1 M€ за каждую вашу метку Земли, включая эту» — декларативная (`tr: 1` + `stock {megacredits: {tag: EARTH}}`) · ГЛАВНОЕ — ВТОРАЯ ИТЕРАЦИЯ ПОЛИРОВКИ ПОЛЁТОВ (≈ 75 %) «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ»: Электрокатапульта — workspace всё ещё закрывается раньше, карта исчезает, цена с левой панели летит «в никуда»; T06 закрыл класс «конец = объект», но НЕ закрыл класс «кто решает, когда складываться» и класс «посев отказал — цена всё равно должна быть честной»

> **Статус: ВЫДАН 2026-10-22.** HEAD `6c396268a3` (T04 + T06 + BX + фазы 0–2 ускорения e2e; сосед `e2e-speed` ещё правит
> `tests/e2e/consoleTest.ts`, `scripts/e2e-codemod-key-helper.mjs` и несколько спеков — их незакоммиченные ханки НЕ трогать).
> НЕЗАКОММИЧЕННЫЙ лор владельца `T09` в `assets/text/lore_texts.json` (вместе с правкой точки у `T06` — закоммитить ПЕРВЫМ ханком;
> гард лора требует точку в конце — добавить её к T09, текст владельца иначе дословно). Арт — `C:\Users\zelin\Downloads\Mars Arts\T09.png`
> (1536×1024). Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T09 - PR Office.png`.
> **e2e — ТОЛЬКО на Steam Machine** (`npm run e2e:remote -- t09 <spec…>`; память `e2e-only-on-steam-machine`; exit 2/3/4 → СПРОСИТЬ владельца).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (шесть шагов; имена списка — `src/common/cards/turmoilReduxAdaptation.ts`),
`docs/claude/turmoil-redux-card-checklist.md` (§2 арт / лор / RU / `card_info`; §3 гарды; **§7** — ссылаться, не повторять),
**`docs/claude/console/resource-transfer.md` ЦЕЛИКОМ** (контракт T06: §1 конец = объект, §2 «поверхность складывается только после того, как
её жетоны УШЛИ — говорят жетоны», §4 сторож, §5 деграды, §6 гарды), `docs/claude/console/workspace-band.md` § ACTION COMMIT,
`.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE (… AND LIVE) `:117–134` и `:224` (PL-099 — «цена с рельса — отлёт», PL-220),
`.claude/rules/animations.md:39–45`, CLAUDE.md «Physical causality» и «Every card action has ONE universal ACTION COMMIT» («a PRICE paid off
the rail leaves FIRST … INTO the printed cost icon, the row ticking on the departure, the result born only after»). **e2e-харнес (новое с
2026-10-21):** `docs/claude/e2e-remote.md` (§2 Usage — снапшот → `e2e:remote`, два слота, `--exclusive` для тайминга, результаты и
`screenshots/**` возвращаются на ноут; §5 гочи), `docs/claude/e2e-speed-iteration.md` (классы спеков: FUNCTIONAL = `?fastboot` + адаптивное
нажатие + motion ×0,5; TIMING = всё настоящее, `--exclusive --workers=1` — список `tests/e2e/timingSpecs.ts`; ⚠ `--workers=4` на коробке —
за коленом; ⚠ физический контроллер на коробке глушится харнесом), память `e2e-speed-iteration`, `e2e-gamepad-reaches-headless-browser`.
Память по теме: `resource-flight-live-ends-direction` (решения владельца 6 = M1, 7 = «ожидает» везде — приняты), `turmoil-redux-classic-cards`
(гочи T06: ожидание, открывающее полёт, — на окраске, не на часах GSAP; красные ноутбука ≠ вердикт), `polish-remediation-iteration-1`,
`final-approach-retarget`, `board-scene-gate-and-flight-demotion`, `marsbot-turn-pacing-server-authoritative`, `polish-priority-tv4k-no-deck-only`,
`batch-decisions`, `concurrent-session-edits-same-files`, `e2e-spec-rot-contract`, `shell-template-escapes`. Журнал —
`docs/claude/turmoil-redux-cards-progress.md` (запись T06 `:5565` — формат), реестр — `docs/claude/gameplay-polish-ledger.md` (на выдаче
следующий свободный **PL-851**, последний раздел **BX** → эта задача берёт **BY**; сверить footer на своём HEAD).

**Образцы — по частям:** **T04** (`turmoil/DiasporaMovement.ts` + спек — декларативная карта с требованием партии на Redux-столе, фикстуры
`parliamentFixture`); **PL-001 для розыгрышей** — `console-play-tr-reward.spec.ts` (РТ розыгрыша рождается на печатной иконке РТ
приземлившейся карты, рейтинг тикает на касании — класс T09 уже доказан, нового спека карте не нужно); рельсовая половина коммита —
`consoleActionCommitRail.ts` (шапка `:1–60` ARM → SEED → FLY → FOLD → ANSWER; `seedActionCommitRail :165–205`; `flyActionCommitRail :307–460`),
план — `consoleActionCommit.ts` (`commitRailPlan :763–836`, `spendLinkSpecs :624`), композер — `ConsoleActionComposer.vue:5537–5590`
(`commitWaveSpecs` — волна БЕЗ цепочки рельса), шелл — `ConsoleShell.vue:12990–13135` (`claimedInFrame`, `finishDismiss`, четыре ветви фолда),
проверка посева — `railReward.ts:231–271` (`verifyRailReward`: строка за строкой, `b − a !== expected` → отказ), движок — `consoleResourceTransfer.ts:716–740`
(`onLeft` = отлёт КАЖДОГО жетона), e2e-свидетель — `console-rail-landing.spec.ts` (TIMING-класс; Электрокатапульта `:325`, фикстура
`rail-reward-action` `generate.ts:505–520` — СОЛО без бота, быстрый сервер), `transferWitness.ts`, сторож `transferEndsGuard` (`consoleTest.ts:368`).

---

## Диагноз (подтверждён файл:строка на `6c396268a3`; перепроверить на своём HEAD)

### Карта
1. **Декларативна и бесплатна.** `turmoil/PROffice.ts`: `tr: 1`, `stock.megacredits {tag: EARTH}` (свои метки, «включая эту» — апстрим-спек
   ждёт 3 с двумя картами Земли на столе), `requirements: {party: UNITY}` — фасад (T04). `cardNumber: 'T09'` верен. РТ розыгрыша идёт
   воронкой `increaseTerraformRating` → RX42 вето / RX35 перенаправление — свипы (`UnmiVetoSweep`, `DivertedResearchSweep`) примут карту сами,
   когда строка уйдёт; показ «РТ под вето» на плите руки / композере — общий (B1 RX42). Работа: RU требования в голос набора
   (`turmoil_cards.json:30` — «Союз в правящий партии» → «Требует, чтобы «Союз» правил или у вас было 2 делегата на их резолюции. Получите
   1 РТ. Получите 1 M€ за каждую вашу метку Земли, включая эту.»; голос — `turmoil_redux_cards.json:61–64`), лор RU («Обмен услугами с
   Комитетом по терраформированию — и торговля его новостями.»), арт, `card_info` RU, строка долой (`turmoilReduxAdaptation.ts:45`), пин
   «as of the last adaptation» (3 из 22), спеки класса «что раздаёт стол» (`PoliticalThinkTank.spec`). **Своего e2e карта не получает**
   (чеклист §5: класс розыгрыша с РТ доказан) — но её розыгрыш входит в стенд полётов сценой (з): это бесплатный свидетель рельсовой половины
   РОЗЫГРЫША под теми же условиями.

### Полёты — что T06 закрыл и что нет
2. **Закрыто (BW):** конец полёта — объект с перемером (PL-830/833), волна композера складывает поверхность по `onLeft` (PL-831), сцена
   «Разыграно» ждёт `onAbsorbed` (PL-829), приёмка чипа, «ожидает», сторож. **Не покрыто стендом T06:** сцена C2 (действие синей карты с
   задержкой ответа) «не проведена ни до, ни после — пробел» (реестр BW, таблица стенда); подтверждение — `console-rail-landing` на быстром
   локальном сервере, СОЛО без бота, без WebSocket-опережения. Владелец играет иначе: Steam Machine / Electron, LAN, WS включён, **соло против
   MarsBot** — и видит: workspace складывается раньше, карта исчезает, цена с левой панели летит в никуда.
3. **Гипотезы с доказательством (стенд §0.3 обязан подтвердить или опровергнуть КАЖДУЮ числом):**
   - **H1 · Посев ОТКАЗЫВАЕТ при любом постороннем изменении строки.** `verifyRailReward` (`railReward.ts:248–262`): `b − a !== expected`
     по строке → `cause: []` → `seedRailReward` false → `seedActionCommitRail :178–182` — «половина не началась», `ended++`;
     `flyActionCommitRail :310` → `holdsSurface: false`; шелл `:13097` → ветвь «волна одна» (`commitWaveSpecs` — для Электрокатапульты
     пуста: результат в цепочке рельса) → `fold()` СРАЗУ. Посторонние изменения строки в ОДНОМ ответе в игре владельца — норма: ход MarsBot
     (атака на растения — та самая строка цены), доход поколения (M€ строка результата), эффект закона / карты в том же ответе. Цена при
     отказе НЕ летит вообще (тикает счётчиком) — «ресурс летит» тогда = дельта-чип панели «−1» на фоне сложившегося workspace, либо H2.
   - **H2 · `onLeft` считает ОТЛЁТ жетона-цены с рельса.** `consoleResourceTransfer.ts:730` — «EVERY token's departure (its pop …) — the run's
     `onLeft` (the surface may fold)». Для жетона `loss` отлёт = поп с чернил рельса; его АДРЕСАТ — печатная иконка цены на карте в композере.
     Любой хост, складывающийся по `onLeft` (волна шелла `:13102`, ответ стола), складывается ПОД летящей к нему ценой. Рельсовая половина
     ждёт касания явно (`:412–416`, `:428–433`), но закон T06 §2 написан для источников; для адресата на поверхности симметричный закон
     (`onAbsorbed`) есть только у сцены «Разыграно».
   - **H3 · Путь `claimedInFrame` не ждёт `foldable`.** `ConsoleShell.vue:13039–13043`: `void flyActionCommitRail(…)` → половина летит,
     `releaseActionCommit()` + `reconcileWorkspaceOutcome()` складывает workspace тиком позже, если ничего не встроено. Для простого действия
     `claimedInFrame` должен быть false — проверить утечку `workspaceOutcomeState.sourceCard` (сброс `consoleWorkspaceOutcome.ts:709`) после
     действия с добором / вскрытием в той же сессии: заявка от ПРЕДЫДУЩЕГО действия делает следующее «встроенным» и складывает его под ценой.
   - **H4 · Сеть «не полетела» 3 с.** `OWED_FLY_MS = 3000` (`:128, :200`): посеяно в apply-блоке, `finishDismiss` отложен `actionCommitHolding()`
     (минимальный такт коммита) — на 4K TV / Electron / `?motion` > 1 такт может превысить сеть → `endHalf('not flown')` → `phase ≠ 'seeded'`
     → `holdsSurface: false` → фолд сразу, цена не летит.
   - **H5 · WS-опережение и повторный apply.** Первый вид после нажатия может прийти по WS ДО ответа POST (`gameTransport.ts:1003/1291` —
     `seedRewardHolds` перед `applyPlayerView` в обоих путях); второй вид (ответ POST или ход бота) применяется в полёте — строки панели
     меняются под жетонами, `commitFoldOwed` защищает от второго фолда, но посев «только первого вида» (`plan === seededPlan`) сравнивает
     ПРОМЕЖУТОЧНЫЙ вид с полным обещанием. Проверить порядок событий трассой.
4. **Нет трассы посева.** Трасса переноса (`resourceTransferDiagnostics().trail`) не содержит вердикта `verifyRailReward` — почему половина
   не полетела, в игре не узнать. `actionCommitRailState.lastEnd` / `ended` / `fallback` есть, но не в трассе и не в сторожe.
5. **Сторож не ловит «карта исчезла под ценой».** `[transfer] end not painted` срабатывает на рождении / касании над ПУСТЫМ; адресат, ушедший
   в полёте, уходит в `destination-gone` — честный деград, но для игрока это и есть «летит в никуда». Класс нужен сторожу: «адресат на
   СКЛАДЫВАЮЩЕЙСЯ поверхности» = нарушение закона фолда, не деград.

## Правила карты (спек пинит каждое)
1. Зелёная, 7, Земля; на Redux-столе требование — две дороги (`satisfiesPartyRequirement`), причина руки со standing.
2. +1 РТ (воронка; под вето RX42 — отказ с именем на плите руки, в композере и на карточке; под RX35 — замена единицы) и +1 M€ за каждую
   свою метку Земли, включая эту (чужие — нет; MarsBot — позиция трека не считается: только `player.tags`).
3. Прогноз композера — чип РТ + «+N M€ · N меток Земли, включая эту» (`countedPlayForecast`); ответ стола на РТ (Зелёные у власти — M€) —
   общий; порядок записей журнала — РТ, затем M€ (`stock.add`).
4. Классический стол — апстрим байт-в-байт; раздача под Redux = {T04, T06, T09}; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.4; решения T04 1–6 и T06 6–7 не переспрашивать)
1. **RU** — имя оставить («Пресс-служба»); требование и эффект — в голос набора; лор RU — как в диагнозе 1.
2. **Закон фолда — симметричный и ОДИН** (H2): (а, рекомендовано) поверхность складывается, когда она НЕ ИСТОЧНИК и НЕ АДРЕСАТ ни одного
   жетона в воздухе — движок переноса сам знает оба конца каждого жетона как ОБЪЕКТЫ (T06): `ResourceTransferRun.onSurfaceClear(surfaceEl)`
   / `surfaceClear(run, el): Promise<void>` — резолвится, когда каждый жетон, чей `from` ∈ el, улетел (`onLeft`) И каждый жетон, чей `to` ∈ el,
   поглощён (`onAbsorbed`); все хосты (волна шелла `:13102`, рельсовая половина — вместо ручных `await … + beat` в `:412–433`, ответ стола
   `:333`, сцена «Разыграно») складываются ТОЛЬКО по нему; (б) оставить `onLeft` и добавить `onAbsorbed` вручную на путь цены — латает одну
   ветку, не класс.
3. **Посев — против СОБЫТИЙ ответа, не против диффа видов** (H1): (а, рекомендовано) обещание рельсовой половины сверяется с записями события
   самого действия (`resource-changed` под `effect-triggered` / записью действия карты в `events` ответа — тем же потоком, что читают
   нотификации и журнал; `journal-gain-via-stock-add`): «строка X изменилась на N ПО ЭТОЙ причине» — ход бота, доход поколения, закон в том
   же ответе больше не ломают посев; дифф видов — только запасной путь, и расхождение пишется в трассу (`rail:seed {verdict}`); (б) допуск
   «не меньше обещанного» по диффу — дешевле, но врёт при встречных изменениях (бот снял 2 растения, цена 1 → дифф −3).
4. **Отказ посева — честная цена** (H1, если (3) не покрывает случай): половина, которой отказали, НЕ складывает поверхность под ничем:
   цена с рельса либо летит по подтверждённой событиями части, либо не летит — но фолд тогда ЖДЁТ дельта-чип панели (−1 на чернилах)
   как минимальный такт, никогда «сразу».
5. **Путь `claimedInFrame`** (H3): рельсовая половина там тоже ждётся (`foldable` → `reconcileWorkspaceOutcome` после неё); утечка заявки
   между действиями — гард (`workspaceOutcomeState.sourceCard === ''` после каждой конклюзии; `console-leak-detector` класс).
6. **Сеть «не полетела»** (H4): `OWED_FLY_MS` не таймер на часах GSAP, а ожидание `finishDismiss` с потолком регистра холдов (одна система
   движения — инвариант 6); либо сеть масштабируется `motionMs` + минимальный такт коммита.
7. **Сторож класса «адресат на складывающейся поверхности»** (диагноз 5): в движке — `[transfer] surface folded under its token — <spec>
   to <end> (<surface>)` при `destination-gone`, чей `to.el` был внутри `.con-ws` / `.con-recv`, ушедшего из DOM в полёте; красный в e2e
   через тот же `transferEndsGuard`. (а, рекомендовано) да.
8. **Трасса посева в проде** (диагноз 4): `rail:seed {key, verdict, mismatches, owed}` и `rail:end {why}` в `resourceTransferDiagnostics`;
   dev-оверлей / `?trail=1` показывает последние 40 — чтобы следующий отчёт владельца шёл с трассой, а не с описанием.
9. **Условия стенда = условия владельца:** соло против MarsBot, WS включён, TV-раскладка (сториборд — настоящие 3840×2160, `--exclusive`),
   задержка ответа; «быстрый сервер, соло без бота» — не доказательство.
10. **Объём** — карта ≈ 20 %, полёты ≈ 80 %; не трогать: сцены колоний / Парламента по месту (только через движок и закон), разбор хода бота.

## 0. Рабочее дерево
1. `git log --oneline -1` → `6c396268a3` на выдаче. **Сначала** `ListAgents` + процессы (сосед e2e-speed держит незакоммиченные правки
   `tests/e2e/consoleTest.ts`, `scripts/e2e-codemod-key-helper.mjs`, `console-placement-*.spec.ts`, `console-play-draw-embed`, `console-start-summary`,
   `start-scene-profiles` — их ханки НЕ трогать; `consoleTest.ts` править ТОЛЬКО после его коммита, объявив ему). `SendMessage` живым соседям:
   твои файлы — `turmoil/PROffice.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `resourceTransfer/{consoleResourceTransfer,
   resourceTransferModel,railReward}.ts`, `consoleActionCommit{,Rail,Motion}.ts`, `ConsoleShell.vue` (только блок `:12990–13135` и
   `runCommitRewardWave`), `played/consolePlayedHero.ts` (только фолд по `surfaceClear`), `transport/gameTransport.ts` (только посев),
   `ru/{turmoil_cards,card_info,lore_texts}.json`, доки. Коммиты — ПО ХАНКАМ (временный индекс) или явными путями; после коммита — `git reset
   -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e и стенд — только Steam Machine.** Снапшот `npm run e2e:snapshot t09` (+ `npm run build` до него) → `npm run e2e:remote -- t09
   tests/e2e/<spec> [--exclusive --workers=1]`. Кадры «до» — клиент HEAD в своём снапшоте `.e2e-t09-before` (`ab-baseline-head-client-in-snapshot`),
   прогон тем же стендом с `TM_E2E_SHOTS_TAG=before`. Exit 2/3/4 — СТОП и `AskUserQuestion`; `TM_E2E_BESIDE_GAME` / `TM_E2E_LAPTOP_OVERRIDE`
   агент не ставит. Тайминги и сториборды — `--exclusive --workers=1`; функциональные — по умолчанию (×0,5, `?fastboot`).
3. **Стенд = будущий спек** (ноут Playwright не запускает — стенд живёт в `tests/e2e/`, синхронизируется сам, кадры возвращаются в
   `screenshots/t09/`): `tests/e2e/console-action-price-fold.spec.ts` (TIMING-класс — в `timingSpecs.ts` с причиной; свидетель
   `armTransferWitness` + сэмплер DOM 100 мс по `setInterval` + трасса `resourceTransferDiagnostics()` + `actionCommitRailState` + момент
   ухода `.con-cardactions` из DOM / ниже .5 opacity). МАТРИЦА (каждая клетка — таблица «посев: вердикт · жетон цены: родился / адресат при
   касании / что под точкой · фолд: мс относительно касания · сторож»): (а) Электрокатапульта, растение, СОЛО против MarsBot (фикстура с ходом
   бота в том же ответе — образец `console-bot-attack` / `testAutomaGame` в `generate.ts:283`), WS включён; (б) то же с `?realtime=0`;
   (в) ответ задержан 1,5 с (`page.route` на `/api/player/input`); (г) последнее действие поколения (доход в том же ответе);
   (д) B в «Выполнение»; (е) второе действие сразу после фолда первого (Space Mirrors — 7 M€ с рельса); (ж) Caretaker (тепло) — цена-последнее-звено;
   (з) розыгрыш T09 из руки (РТ + M€ — рельсовая половина розыгрыша) при (в). Профили: TV-раскладка (сториборд (а) и (в) — 3840×2160) + fhd.
4. Фикстуры — свои JSON, имена в `FixtureName` ДО сборки: `price-fold-bot` (соло против MarsBot, Электрокатапульта + Space Mirrors + Caretaker
   на столе, растения ≥ 2, M€ ≥ 20, тепло ≥ 8, колода действий бота — атака на растения первой), `price-fold-last-action`, `pr-office`
   (Redux 2 места, Союз правит — `seatEnacted(quietResolutionOf(UNITY))`, T09 в руке, 2 карты Земли на столе, M€ ≥ 7), `pr-office-locked`.

## 1. Сервер — карта (≈ 10 %)
`PROffice.ts` — без правок правил; RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T09.png" T09` → `make:cards`), `card_info` (0/0/0),
строка долой + пин. Спек `tests/cards/turmoil/PROffice.spec.ts`: классический блок остаётся; Redux-блок — правила 1–4 (две дороги, +1 РТ,
счёт меток «включая эту» с двумя картами Земли = 3, чужие метки не считаются, под вето RX42 — РТ отказан с именем, прогноз чист, save / load).

## 2. Клиент — карта (≈ 10 %)
Лицо / «Информация» / плита руки / композер / РТ розыгрыша — даром; расхождение = класс. Сцена (з) стенда — свидетель.

## 3. Клиент — ГЛАВНОЕ: «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ» (≈ 80 %)
### 3.А Диагноз числом (первым делом)
Стенд §0.3 на базовой сборке (`before`) по всей матрице; таблица гипотез H1–H5 → «подтверждена / не воспроизвелась» с трассой. Если ни одна
не воспроизвелась — расширять матрицу (Electron-профиль `conUiScale`, `?motion=1.5`, второй клиент в фоне), не закрывать «не воспроизводится».
### 3.Б Закон фолда (решение 2)
`consoleResourceTransfer.ts`: у каждого полёта — `from.el` / `to.el` (объекты T06); `surfaceClear(run, el)` — обе половины; `onLeft` остаётся для
обратной совместимости, но ни один хост больше не складывает по нему. Хосты: `ConsoleShell.finishDismiss` — `Promise.all([rail.foldable,
surfaceClear(wave, composerEl)])`; `flyActionCommitRail` — `foldable` = `surfaceClear` всех звеньев (ручные `delayedCall(QUICK_ABSORB / BEAT)` уходят —
такт поглощения уже внутри `onAbsorbed`); ответ стола — то же; `consolePlayedHero` — `stageAbsorbs` → `surfaceClear`. Спек `tests/console/
transferSurfaceClear.spec.ts` (jsdom): цена на поверхность-адресат держит её до поглощения; выигрыш с поверхности — до отлёта; оба — до обоих;
деград — резолв сразу; ни один хост не читает `onLeft` (grep-гард).
### 3.В Посев и отказ (решения 3, 4, 6)
`railReward.verifyRailReward` → `verifyRailRewardByEvents(reward, response.events, fallbackViews)`; трасса `rail:seed`; отказ → цена честная
(решение 4) и фолд ждёт хотя бы дельта-чип; `OWED_FLY_MS` → ожидание без часов GSAP. Спеки: `railRewardVerify.spec` (ход бота в том же ответе
— посев проходит; доход поколения — проходит; настоящая недоплата — отказ с именем), `actionCommitRail.spec` § отказ не складывает под ценой.
### 3.Г Путь `claimedInFrame` (решение 5) + сторож (решение 7) + трасса (решение 8)
### 3.Д Регрессия
Набор на Steam Machine: `console-rail-landing` (`--exclusive`), `console-aerial-mappers`, `console-supercomputer`, `console-play-tr-reward`,
`console-classic-gmo-contract`, `console-rival-payout-intake`, `console-parliament-sitting-reward` (PL-843 — старый красный, не твой),
`console-colony-reward-rail`, `console-resource-distribute`, `console-action-resource-pick`, `console-bot-attack`, `console-venusian-census`
+ новый `console-action-price-fold` — все по 2 повтора; красный читать ПОСЛЕ аннотации `build` и нагрузки (память `e2e-speed-iteration`).

## 4. Лицо, локаль, лор, арт
Арт T09; лор EN (ключ владельца + точка) + RU; RU карты — диагноз 1; новых UI-ключей не ждать (трасса — без локали); `grep` ключа по всем
`src/locales/*/*.json` ДО добавления; RU чужих не переписывать.

## 5. Тесты
1. Спек карты (§1); гарды после удаления строки: `cardPlayPreviewCoverage`, `countedPlayForecast`, `cardInformation`, `requirementProse`,
   `premiumCardViewModel`, `cardLore` (T09), `UnmiVetoSweep` / `DivertedResearchSweep` (новый субъект — зелёные без правок), `crossPlayerCoverageGuard`,
   `TurmoilCardsUnderRedux` (пин T04 + T06 + T09), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`, `e2eLiveness`, `lessDeadSelectorGuard`.
2. Юниты §3.Б–3.Г; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине, последовательно.
3. e2e — §0.3 стенд-спек (матрица, TIMING-класс) + регрессия §3.Д; `npm run e2e:affected` + перевод задетых селекторов в том же диффе.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, настоящие 3840×2160 только для сторибордов, `--exclusive`)
`screenshots/t09/{tv,fhd}/`: (а) сториборд Электрокатапульты против бота ДО / ПОСЛЕ ≥ 8 кадров: нажатие → «−1» с чернил растений → поглощение
в печатную иконку цены (карта СТОИТ) → «+7» из иконки результата → касание M€ → фолд; (б) то же с задержкой 1,5 с; (в) розыгрыш T09 — РТ с
печатной иконки, M€ волной; (г) таблица матрицы. Каждый кадр — своим глазом с дивана: «карта стоит, пока в неё летит цена?»

## 7. Полировка по пути
1. Реестр: раздел **BY** «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ» — H1–H5 строками (подтверждено / нет), классы причин («фолд по отлёту,
   а не по освобождению поверхности», «посев по диффу видов», «путь заявки без ожидания», «сеть на часах анимации», «нет трассы посева»),
   находки регрессии; первый номер — по footer (на выдаче PL-851).
2. Доки: `resource-transfer.md` §2 переписать («поверхность складывается, когда она не источник и не адресат — `surfaceClear`»), §3a «посев по
   событиям», §4 сторож класса «под поверхностью», §5 деграды, §6 гарды; закон в `console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE — «**…AND
   A SURFACE NEVER FOLDS UNDER ITS OWN TOKEN**: a surface folds when it is neither the SOURCE nor the DESTINATION of a token in the air —
   told by the tokens (`surfaceClear`), never by a clock, never by a departure alone; the rail half is verified against the response's own
   EVENTS, so a bot's move or the generation's income in the same response never refuses it»; `workspace-band.md` § ACTION COMMIT;
   `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T09 «СДАНА» (3 из 22); запись в журнале (задача · сделано · H1–H5 с числами · решения · гочи).

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — стенд §0.3 на базе (`before`) по всей матрице на Steam Machine; таблица гипотез — в отчёт ДО кода.
2. Порядок: лор-ханк → карта + спек + строка долой → стенд `before` → 3.Б закон фолда + юниты → 3.В посев + юниты → 3.Г → стенд `after` →
   регрессия 3.Д → сториборды → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем таблица гипотез H1–H5 ДО / ПОСЛЕ по матрице, сториборды (а)–(в), итог регрессии (сколько красных, чьи),
   решения 1–10 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (решения 3 (а/б с числами), 4, 6 — рекомендация первой; остальное —
   в отчёте), гэпы честно (клетки матрицы, которые не удалось воспроизвести, — поимённо).
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Складывать поверхность по `onLeft`, по таймеру, по «одному попу», по такту GSAP — только `surfaceClear`; латать одну ветвь (Электрокатапульту)
  вместо класса; оставлять `verifyRailReward` единственным судьёй при встречных изменениях ответа; таймер `setTimeout` / `delayedCall` как
  сеть холда (регистр холдов — инвариант 6).
- Запускать Playwright на ноуте (ни одного спека, ни стенда); ставить `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; читать красные без
  аннотации `build` и нагрузки; `--workers=4`.
- Менять правила карты; добавлять ей e2e «просто ещё одной карте»; переписывать RU чужих ключей; трогать незакоммиченные ханки соседа
  e2e-speed; разбор хода бота; `git stash`; bare `git push`.
