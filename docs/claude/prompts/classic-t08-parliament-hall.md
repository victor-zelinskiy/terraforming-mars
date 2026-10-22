# Промт исполнителю · T08 Parliament Hall («Зал парламента») — четвёртая классическая карта Turmoil под Redux, «на месте» (§3.1): зелёная (автоматическая), 8, метка Здания, 1 ПО; «Марс вперёд правит ИЛИ 2 ваших делегата на их резолюции»; «+1 производство M€ за каждые 3 ваши метки Зданий, включая эту» — декларативная (`production {megacredits: {tag: BUILDING, per: 3}}`) · ГЛАВНОЕ — РЕВОРК ВИЗУАЛА ФИНАЛЬНОГО ПОДСЧЁТА (≈ 80 %) «СЧЁТ ПРИХОДИТ СВЕТОМ, А НЕ ПРЕДМЕТАМИ»: подиум остаётся (концепция TR69 верна), но полёт жетонов сверху — аркадное мельтешение, не премиум; нужна новая сцена прихода счёта И новая семантика X: не «пропустить всё», а УСКОРИТЬ подсчёт в разы (почти мгновенно) — ранжирование и КОРОНАЦИЯ играют всегда, в полном темпе

> **Статус: ВЫДАН 2026-10-22.** HEAD `d9163632f5` (T09 сдана: `b8e0e69762` карта, BY полёты; e2e-харнес — источники per task, Node 24 на
> Steam Machine, Playwright 1.64.1). НЕЗАКОММИЧЕННЫЙ лор владельца `T08` в `assets/text/lore_texts.json` (с точкой — гард доволен;
> закоммитить ПЕРВЫМ ханком вместе с правкой запятой у `T09`). Арт — `C:\Users\zelin\Downloads\Mars Arts\T08.png`. Скан —
> `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T08 - Parliament Hall.png`. **Сосед держит незакоммиченные
> правки** (`ConsoleStartScene.vue`, `startBonusGain.ts` + спек, `consoleStart.ts`, пять `console-*.spec.ts`, `zz-diag-bonus-handoff.spec.ts`) —
> их ханки НЕ трогать; `consoleStart.ts` — только после его коммита. **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t08 …`; exit 2/3/4 → спросить).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (шесть шагов; имена списка — `src/common/cards/turmoilReduxAdaptation.ts`),
`docs/claude/turmoil-redux-card-checklist.md` (§2, §3; **§7** — ссылаться, не повторять), **`docs/claude/console/endgame-workspace.md`**
(§ THE PODIUM `:97` — планировщик, места, горизонт; § Ceremony machine `:133` — фазы, такты, «THE COUNT FLOWS», `finalizeCeremony` —
ОДНО каноническое терминальное состояние; § Input & the bottom bar `:369` — `B Свернуть · X Пропустить подсчёт`; § E2E harness law `:406`),
`.claude/rules/console-ui.md` **§ THE FINALE IS A CEREMONY `:579–586`** (пять законов; закон 4 «the count ARRIVES as tokens … the skip is the
one atomic settle» — именно его эта итерация ПЕРЕПИСЫВАЕТ), `.claude/rules/animations.md`, CLAUDE.md «Project goals» 3 (**Ark Nova: короткие
изинги, тихо по умолчанию, никакого эффектного движения ради движения**) и 4, инвариант 6 (одна система движения; `consoleMotionMs`;
reduced motion; холд — не таймер). Память: `tr69-finale-podium` (гочи: кривая горизонта только после ранжирования; `.con-eg__rows` —
`flex: 1 1 0` + ResizeObserver; коронация — свой FLIP, измеренный ДО `winnerShown`; `test.use({reducedMotion})` не доходит — `emulateMedia`;
общий `test-results` вешает прогон), `campaign-champion-ceremony` (бит чемпиона ОБЯЗАТЕЛЕН — замок пада, его никто не ускоряет),
`console-endgame-boundary-seal`, `ceremony-on-the-real-object`, `polish-direction-smoothness`, `polish-priority-tv4k-no-deck-only`,
`e2e-only-on-steam-machine`, `e2e-speed-iteration` (FUNCTIONAL ×0,5 по умолчанию; TIMING — `timingSpecs.ts`, `--exclusive --workers=1`;
`TM_E2E_STORYBOARD=1` — CDP-скринкаст каждого кадра композитора, T09), `batch-decisions`, `concurrent-session-edits-same-files`,
`e2e-spec-rot-contract`, `shell-template-escapes`. Журнал — `docs/claude/turmoil-redux-cards-progress.md` (запись T09 — формат),
реестр — `docs/claude/gameplay-polish-ledger.md` (на выдаче следующий свободный **PL-861**, последний раздел **BY** → эта задача берёт **BZ**;
сверить footer на своём HEAD).

**Образцы — по частям:** **T09** (`turmoil/PROffice.ts` + спек — декларативная карта на Redux-столе; гоча: декларативный счётный бонус →
`needsCuration` → co-located `infoText` блоком на бонус); сценарий — `endgame/consoleEndgameScript.ts` (`CEREMONY_MS :30–83` — такты; `ceremonyBeats
:99` — enter → [subIntro → sub… → subMerge | category(focus/fly/grow/settle/pause)] → preRank → ranking → [tiebreak] → winnerHold → winner →
[champion] → actions); директор — `endgame/consoleEndgameDirector.ts` (ОДИН пауженный GSAP-таймлайн `tl :101`, count-up — твины на нём `:124–143`
(`onCount` — прямой `textContent`), `attach` — полёты под часами директора, `skip :392` = teardown + `finalizeCeremony`, сеть `:355` (скрытая вкладка
→ финализация), pause / resume); состояние — `endgame/consoleEndgameState.ts` (`finalizeCeremony :160–200`, `skipSeq`); компонент —
`ConsoleEndgameWorkspace.vue` (`flyTokens :1332–1368` — жетон рождён на медальоне рельса `[data-eg-rail]`, дуга в щит места `.con-eg__shield`;
`makeToken :1371`; `clearTokens`; бар `:797–802` «Skip scoring»; `skipCeremony :1193`; замок чемпиона `:1510`; `data-eg-beat` / `data-eg-cat :39`
— то, что читают пробники); стили — `console_endgame.less` (`.con-eg__rail :208`, медальоны `:770–816`, `.con-eg__tokens` / `.con-eg-token
:853–895`); вспышка победителя — `console/ceremony/ceremonyFx.ts`; e2e — `console-finale-podium.spec.ts` (**C `:232–297` — пин «tokens were seen in
the air» и «X lands atomically — no token left»** → переписать в том же диффе), `console-endgame.spec.ts` (пробник стабильности ПО МЕСТАМ, B паркует),
харнес `consoleEndgameHarness.ts` (`fixtureTable`, `journeyToEndgame`, `storyboard`, `shoot`), фикстуры `finale-rich-5p` / `-2p` / `-bot`; юниты
`tests/client/components/console/consoleEndgameCeremony.spec.ts` (такт `fly`), `tests/client/console/consoleEndgamePodium.spec.ts`; макеты TR69 —
`screenshots/tr69/tv4k/mockups/m1-podium.png`, кадры `screenshots/tr69/tv4k/after7/{2p,5p}-count-*.jpg` (сегодняшняя сцена).

---

## Диагноз (подтверждён файл:строка на `d9163632f5`; перепроверить на своём HEAD)

### Карта
1. **Декларативна и почти бесплатна.** `turmoil/ParliamentHall.ts`: `production.megacredits {tag: BUILDING, per: 3}` (свои метки, «включая эту» —
   апстрим-спек ждёт +1 при двух Зданиях на столе), `victoryPoints: 1`, `requirements: {party: MARS}` — фасад (T04). `cardNumber: 'T08'` верен.
   Работа: RU требования в голос набора (`turmoil_cards.json:27` — «Марс вперед в правящий партии» → «Требует, чтобы «Марс вперёд» правила или у
   вас было 2 делегата на их резолюции. Увеличьте производство M€ на 1 за каждые 3 ваши метки Зданий, включая эту.»; имя партии — как в
   `turmoil_redux_cards.json:43/49`), лор RU («Знаковое здание Парламента Тарсиса.»), арт, `card_info` (⚠ гоча T09: счётный декларативный бонус
   метится partial → `needsCuration` — co-located `infoText` блоком на бонус), строка долой (`turmoilReduxAdaptation.ts:45`), пин «as of the last
   adaptation» (4 из 22), спеки класса «что раздаёт стол». Прогноз композера «+N пр. M€ · N меток Зданий ÷ 3, включая эту» — `countedPlayForecast`
   (`per: 3` — гард `variableAmountPreviewGuard` скажет, если путь `per` не покрыт — тогда класс, не хук карты); волна розыгрыша кладёт чип
   производства на плиту производства (PL-094), ПО — в ячейку счёта (`cardVictoryPointsAtPlay`). **Своего e2e карта не получает** (чеклист §5).

### Финал — что есть (кадры `after7/*-count-*.jpg`, код)
2. **Сцена.** Голова «ФИНАЛЬНЫЙ ПОДСЧЁТ · ПОКОЛЕНИЕ N»; под ней РЕЛЬС категорий — семь пилюль «медальон + имя» (`.con-eg__rail`, тип
   `--eg-rail-fs`); подпись активной категории; ниже — места подиума (TR69: лицо корпорации, имя, щит ПО + итог, полоса-инструмент, медальоны
   категорий); горизонт. Между рельсом и местами на 4K — пустая полоса ≈ ⅓ высоты проёма (кадр `2p-count-03-fly-2`).
3. **Приход счёта = ПРЕДМЕТЫ.** На такте `fly` для КАЖДОГО места рождается жетон (диск 2,6rem + пилюля «+N», `makeToken`) на медальоне рельса и
   ПАДАЕТ дугой в щит места (`y` с `power2.in` — «бросок»), 300 мс (подшаг — 200 мс), поп → полёт → поглощение; подшаги РТ (≈ 6) и Карт (3) летят
   каждый своим жетоном. Пять мест × ≈ 16 тактов = до ≈ 80 мелких объектов, пересекающих сцену сверху вниз за ≈ 12–15 с — с дивана это
   «мельтешение»: много мелких тел, короткие траектории, мелкий тип на пилюле, источник (пилюля рельса) далеко и мал. То, что ОТВЕЧАЕТ касанию,
   — хорошо и остаётся: медальон места загорается со значением, сегмент полосы растёт, итог тикает (`segOn` / `landed`, `onCount`).
4. **X = полный пропуск.** `handle.skip()` → `teardown()` + `finalizeCeremony(vm)` — атомарный прыжок в терминальное состояние: ни FLIP
   ранжирования, ни коронации (`onCrown` — FLIP подиума), ни вспышки (`onWinnerFx`), ни места «1/2/3» по очереди. Владелец: X должен УСКОРЯТЬ
   подсчёт в разы (почти мгновенно), а финальную коронацию не пропускать. Рычаг есть по построению: ОДИН GSAP-таймлайн (`tl.timeScale`) +
   `attached` твины; count-up — твины на том же `tl` (`:124`), так что масштаб времени охватывает и числа. Бит чемпиона кампании и так
   обязателен и замкнут (`:1510`, `campaign-champion-ceremony`) — его не ускорять. Сеть скрытой вкладки (`:355`), перезагрузка в END и
   естественный конец по-прежнему сходятся в `finalizeCeremony` — это не меняется.
5. **Контракты, пинящие старое.** `console-ui.md:584` (закон 4 — «tokens», «the skip is the one atomic settle»), `endgame-workspace.md` § Ceremony
   machine («THE COUNT FLOWS … TOKENS»), § Input (`X Пропустить подсчёт`), e2e `console-finale-podium` C («tokens were seen in the air»; «X lands
   atomically — no token left»), юнит `consoleEndgameCeremony.spec` (такт `fly`), ключ i18n «Skip scoring» — всё меняется ТЕМ ЖЕ диффом
   (инвариант 14). `console-finale-podium` и `console-endgame` НЕ в `timingSpecs.ts` (там только `draft-finale-probe`) — бегут в FUNCTIONAL-конфигурации
   (motion ×0,5); утверждения о темпе коронации после X и о доле ускорения — тайминговые → в TIMING-класс с причиной.
6. **Reduced motion** сегодня: жетоны не летят, медальон и счёт отвечают в момент касания; X — атомарно. Сохраняется (решение 5).

## Правила карты (спек пинит каждое)
1. Зелёная, 8, Здание, 1 ПО; на Redux-столе требование — две дороги, причина руки со standing.
2. +1 производство M€ за каждые 3 свои метки Зданий, включая эту (2 на столе + эта = 3 → +1; 5 + эта = 6 → +2; 1 + эта → 0 — честный ноль
   с причиной в прогнозе: «2 из 3 меток»); чужие метки не считаются; MarsBot — не считается.
3. Прогноз композера — чип производства с «почему» (счёт ÷ 3) и чип ПО; журнал — `production.add` под розыгрышем.
4. Классический стол — апстрим байт-в-байт; раздача под Redux = {T04, T06, T09, T08}; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.4; решения T04 1–6 не переспрашивать)
1. **RU** — имя оставить («Зал парламента»); требование и эффект — в голос набора; лор RU — как в диагнозе 1.
2. **Концепция прихода счёта — ПО МАКЕТАМ, батч ПЕРВЫМ** (CSS поверх живой сцены + кадры сториборда на Steam Machine, профиль TV 4K):
   - **M1 «ЛУЧ КАТЕГОРИИ» (рекомендовано):** активная пилюля рельса раскрывается в ПЛИТУ категории в зоне подписи (глиф · имя · тон — одна
     плита, рельс остаётся контекстом); из плиты ОДИН раз опускается мягкий вертикальный ЛУЧ в тоне категории (≈ 420 мс, один объект, без
     частиц), и по мере прохода (слева направо, стаггер 50–70 мс) у каждого места ЗАГОРАЕТСЯ его собственный медальон (масштаб 0,9 → 1 +
     свечение, значение проявляется на нём), сегмент полосы растёт ИЗ-ПОД медальона, итог тикает; подшаги РТ / Карт — зажигание
     суб-медальонов в каденции ПОД ОДНИМ удерживаемым лучом (ни одного полёта на подшаг); штраф — красный «шрам»-проход, сегмент отступает
     (грамматика `reclaim` остаётся). Ни один объект не пересекает сцену.
   - **M2 «МЕДАЛЬОН ПЕРЕВОРАЧИВАЕТСЯ»:** луча нет — медальон категории на каждом месте переворачивается (scaleX 1 → 0 → 1, значение на
     «обороте») в стаггере, сегмент растёт из него; пилюля рельса только подсвечивается. Самый тихий вариант.
   - **M3 «ОДНА ПЛИТА-ЛЕНТА»:** один объект на категорию — лента опускается с рельса и растворяется в медальонах мест (в 5× меньше тел, язык
     ближе к нынешнему).
   Выбор — владельца по макетам; реализуется ОДНА концепция.
3. **X = УСКОРИТЬ** (`handle.hurry()`): (а, рекомендовано) `HURRY_SCALE` ≈ 6 на `tl` + `attached` — подсчёт (enter … последний subMerge) почти
   мгновенен, но каждая категория остаётся ВСПЫШКОЙ (зажигание медальонов читается каскадом, не «всё разом»); `preRank` — один короткий такт;
   **ранжирование (FLIP), места, `winnerHold`, `winner` (коронация-FLIP + вспышка) — в полном темпе ×1**; второй X — no-op; во время
   ранжирования / коронации глагола X в баре нет; (б) ×8 и FLIP ранжирования ×2, только `winner` ×1 — быстрее, но порядок мест проскакивает.
4. **Подпись глагола** — «Ускорить подсчёт» (новый EN-ключ `Hurry the count`; старый «Skip scoring» — долой, если нигде больше не нужен);
   никогда не оставлять «Пропустить» с новым смыслом.
5. **Reduced motion + X** — атомарный `finalizeCeremony`, как сегодня (движение и так схлопнуто); перезагрузка / сеть — без изменений.
6. **Подшаги под одним лучом** (M1) / одним переворотом ряда (M2) — без отдельных тел на подшаг (рекомендовано).
7. **Пустая полоса между рельсом и местами** — плита категории (решение 2) её занимает; НОВОГО хрома не добавлять; при M2 — плита тоже
   (подпись категории становится плитой), иначе полоса остаётся пустой.
8. **Объём** — карта ≈ 20 %, финал ≈ 80 %; обзор «Счёт» / «Игроки», бит чемпиона, свёртка (B) и свободный осмотр — не трогать.

## 0. Рабочее дерево
1. `git log --oneline -1` → `d9163632f5` на выдаче. **Сначала** `ListAgents` + процессы; `SendMessage` живым соседям: твои файлы —
   `turmoil/ParliamentHall.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `endgame/{consoleEndgameScript,consoleEndgameDirector,
   consoleEndgameState}.ts`, `ConsoleEndgameWorkspace.vue` (такты, рельс/плита, медальоны, бар), `console_endgame.less`, `console_tv.less`
   § THE FINALE…, `ru/{turmoil_cards,card_info,lore_texts,endgame,ui}.json`, e2e финала, доки. Коммиты — ПО ХАНКАМ или явными путями; после
   коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / макеты / сториборды — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t08` → `npm run e2e:remote -- t08 <spec>
   [--exclusive --workers=1]`; кадры «до» — клиент HEAD в своём снапшоте `.e2e-t08-before` (`TM_E2E_SHOTS_TAG=before`); сториборд — `TM_E2E_STORYBOARD=1`
   (каждый кадр композитора); `TM_E2E_BESIDE_GAME` / `TM_E2E_LAPTOP_OVERRIDE` агент не ставит; exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд = e2e** (`tests/e2e/console-finale-podium.spec.ts`, TIMING-класс с причиной; новые тесты C′/H/I ниже): профили TV 4K (`--exclusive`) и
   fhd; фикстуры `finale-rich-5p` / `-2p` / `-bot`; пробник `setInterval` (не rAF) читает `data-eg-beat` / `data-eg-cat`, число движущихся
   тел (`.con-eg-token` сегодня / новый селектор луча), `.con-eg__medal--on`, итоги, момент `con-eg__row--hero` и длительность FLIP коронации.
   Макеты M1–M3 — `addStyleTag` поверх живой сцены на такте категории (кадры в `screenshots/t08/mockups/tv4k/`).
4. Фикстуры карты — свои JSON: `parliament-hall` (Redux 2 места, «Марс вперёд» правит — `seatEnacted(quietResolutionOf(MARS))`, T08 в руке,
   2 карты Зданий на столе, M€ ≥ 8) — только для спека сервера/клиента, e2e карте не нужен.

## 1. Сервер — карта (≈ 10 %)
`ParliamentHall.ts` — правила без правок; `infoText` при `needsCuration`; RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T08.png" T08`
→ `make:cards`), `card_info` (0/0/0), строка долой + пин. Спек `tests/cards/turmoil/ParliamentHall.spec.ts`: классический блок остаётся;
Redux-блок — правила 1–4 (две дороги; 2 + эта → +1; 5 + эта → +2; 1 + эта → 0 с причиной; чужие не считаются; прогноз чист; ПО 1; save / load).

## 2. Клиент — карта (≈ 10 %)
Лицо / плита руки / композер (чип производства ÷ 3 + ПО) / волна розыгрыша на плиту производства — даром; расхождение = класс.

## 3. Клиент — ГЛАВНОЕ: «СЧЁТ ПРИХОДИТ СВЕТОМ» + «X УСКОРЯЕТ, КОРОНАЦИЯ ВСЕГДА» (≈ 80 %)
### 3.А Макеты и кадры «до» (первым делом)
Сториборд «до» на 4K (`finale-rich-5p`, `-2p`): полный подсчёт + X на второй категории; таблица: число движущихся тел на такт, длительность
подсчёта, что происходит после X (сегодня — прыжок). Макеты M1–M3 на живой сцене → батч владельцу (решение 2) ДО реализации 3.Б.
### 3.Б Сцена (по выбранной концепции)
- Сценарий: такт `fly` → `light` (`CeremonyTokenBeat` → `CeremonyLightBeat {catIdx, subIdx, values, passMs}`); `CEREMONY_MS.categoryFly` →
  `categoryPass` (≈ 420), подшаги — без собственного прохода (`subFly` → 0, зажигание в каденции `sub`); спек сценария пинит порядок и отсутствие тел.
- Директор: `hooks.onTokens` → `hooks.onLight(beat, attach)`; count-up стартует на зажигании ПЕРВОГО места (не на касании последнего) или
  по месту — решить по макету (каскад слева направо: каждое место тикает на своём зажигании — рекомендовано; один `onCount` на место).
- Компонент: плита категории (`.con-eg__plate` в зоне подписи — трансформация активной пилюли, FLIP между пилюлей и плитой, transform/opacity),
  луч (`.con-eg__beam` — один элемент в `.con-eg__tokens`-слое, `transform: translateY / scaleY`, тон `--eg-c`), зажигание медальона
  (`.con-eg__medal--ignite`: scale + glow через CSS-переход, значение `opacity`), сегмент — как сегодня (`segOn` на зажигании). `makeToken` /
  `flyTokens` / `.con-eg-token` — удалить (мёртвые селекторы — гард `lessDeadSelectorGuard`, e2e-хуки — перевод в том же диффе).
- Пол TV: плита и значения ≥ `--con-t-floor`; 5 мест на 4K — каскад читается (стаггер не меньше 50 мс × motion).
### 3.В Ускорение (решения 3–5)
- `CeremonyHandle.hurry()`: `tl.timeScale(HURRY_SCALE)` + каждому `attached`; сценарий помечает такт возврата темпа (`paceReturnsAt: 'preRank'`),
  директор на нём ставит `timeScale(1)` (а `preRank` укорачивает до одного такта); `skip()` остаётся ТОЛЬКО для reduced motion / сети / kill;
  `consoleEndgameUi.hurried` — для бара (глагол исчезает), для пробников (`data-eg-hurried`); B во время ускорения — pause/resume как сегодня.
- Бар: `X Ускорить подсчёт` только пока `phase ∈ {entering, scoring, settling}`; ранжирование / коронация — без X; champion — замок как есть.
- Спеки: `consoleEndgameDirector.spec` (hurry масштабирует подсчёт, возвращает ×1 на `preRank`, второй hurry — no-op, champion не затронут,
  reduced motion → атомарно, сеть финализирует), `consoleEndgameCeremony.spec` (такт `light`, подшаги без тел), `consoleEndgameState.spec`
  (`hurried` сбрасывается `finalizeCeremony` / `resetCeremonyProgress`).
### 3.Г e2e (тем же диффом — инвариант 14)
- `console-finale-podium` **C′** «the count arrives as light»: ни одного `.con-eg-token` за весь подсчёт; на такте категории — ровно ОДИН движущийся
  объект (луч) или ноль (M2); медальоны мест зажигаются в порядке x (стаггер ≥ 50 мс × motion); итог места не меняется до его зажигания;
  **H** «X hurries, never skips»: X на второй категории → оставшийся подсчёт ≤ ¼ базовой длины; затем `data-eg-beat` проходит `ranking` → `winner`;
  FLIP коронации длится ≥ 400 мс × motion (сэмплер видит промежуточные transform у `con-eg__row--hero`); итоги = серверные; после X в баре
  нет X; **I** reduced motion + X — атомарно (G остаётся); **E** (бот) и **A/B/D** — без изменений по смыслу (селекторы жетонов — долой);
  `console-endgame` — пробник стабильности по местам учитывает зажигание (масштаб медальона — не «дрожь полосы»).
- `timingSpecs.ts`: `console-finale-podium` (+ причина: доля ускорения, темп коронации, стаггер зажигания).
- `npm run e2e:affected` + `e2eLiveness`; `console-campaign-endgame` (чемпион) — регрессия.

## 4. Лицо, локаль, лор, арт
Арт T08; лор EN (ключ владельца) + RU; RU карты — диагноз 1; UI: `Hurry the count` (RU «Ускорить подсчёт»), подпись плиты категории — существующие
ключи категорий; `grep` ключа по всем `src/locales/*/*.json` ДО добавления; RU чужих не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardPlayPreviewCoverage`, `countedPlayForecast` / `variableAmountPreviewGuard` (`per: 3`),
   `cardInformation` (+ `infoText`), `requirementProse`, `premiumCardViewModel`, `cardLore` (T08), `cardVictoryPointsAtPlay`, `crossPlayerCoverageGuard`,
   `TurmoilCardsUnderRedux` (пин 4), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`, `e2eLiveness`, `lessDeadSelectorGuard`, `glyphLiteralGuard`.
2. Юниты §3.Б–3.В; `consoleEndgamePodium.spec` (без изменений); `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой
   машине, последовательно.
3. e2e §3.Г на Steam Machine: `console-finale-podium` (`--exclusive --workers=1`), `console-endgame`, `console-campaign-endgame`, `console-endgame-overview`,
   `console-endgame-boundary` — по 2 повтора; красный читать после аннотации `build` и нагрузки.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV 4K первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/t08/{tv4k,fhd}/`: (а) одна категория ДО / ПОСЛЕ ≥ 10 кадров (пилюля → плита → луч → зажигание слева направо → тик → settle);
(б) подшаги РТ под одним лучом; (в) штраф (шрам); (г) X на второй категории: ускоренный остаток → FLIP ранжирования → места → коронация в
полном темпе → вспышка; (д) дуэль и бот; (е) таблица «тел в движении на такт · длительность подсчёта · длительность коронации после X».
Каждый кадр — своим глазом с дивана: «я вижу, ОТКУДА пришли очки, без мельтешения, и коронация — событие, а не остаток?»

## 7. Полировка по пути
1. Реестр: раздел **BZ** «СЧЁТ ПРИХОДИТ СВЕТОМ · X УСКОРЯЕТ, КОРОНАЦИЯ ВСЕГДА» — диагноз 3–5 строками, классы причин («тела вместо света»,
   «пропуск вместо ускорения», «контракт пинит старый язык»), находки раскадровки; первый номер — по footer (на выдаче PL-861).
2. Доки: `endgame-workspace.md` § Ceremony machine (THE COUNT ARRIVES AS LIGHT: плита, луч/переворот, зажигание, каденция подшагов; hurry и точка
   возврата темпа; что остаётся атомарным), § Input (`X Ускорить подсчёт`, когда глагол есть); `console-ui.md` § THE FINALE IS A CEREMONY — закон 4
   переписать: «**The count ARRIVES AS LIGHT, never as objects crossing the stage**: the category's plate opens on the rail, ONE pass of its light
   crosses the podium and each seat's OWN medallion ignites in turn — the segment grows out of it, the total ticks on the ignition; the sub-steps
   ignite under the one held light; **X HURRIES the count and never skips the crowning** — the ranking FLIP, the places and the crown play at the
   full pace after it; the one atomic settle remains for reduced motion, the safety net and a reload»; `animations.md` строка; бэклог
   `weak-visuals-backlog` № 23 — дописка; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T08 «СДАНА» (4 из 22); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — сториборд «до» и макеты M1–M3 на Steam Machine → батч владельцу; карта — параллельно (не зависит).
2. Порядок: лор-ханк → карта + спек + строка долой → макеты + «до» → (после батча) 3.Б сцена + юниты → 3.В ускорение + юниты → 3.Г e2e + TIMING →
   сториборды «после» → регрессия → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем макеты M1–M3 (кадры 4K) и сториборды ДО / ПОСЛЕ, таблица (е), результат регрессии, решения 1–8 с тем, что
   сделано по умолчанию, ОДИН батч `AskUserQuestion` (2 с макетами — ПЕРВЫМ, до реализации; 3 (а/б); остальное — в отчёте), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Оставлять тела, пересекающие сцену (жетоны, частицы, конфетти), под любым названием; `power2.in`-«броски»; анимацию width / height / top / left;
  `transition: all`; `setTimeout` как такт (только `tl` / `consoleMotionMs` / холды); масштабировать бит чемпиона; делать X полным пропуском;
  оставлять глагол «Пропустить» с новым смыслом; второй источник правды для итогов (только `vm.rows[].finalTotal` / серверный breakdown).
- Менять геометрию подиума (планировщик, места, горизонт) и обзор; трогать свёртку (B), free roam, границу END (`consoleEndgameSeal`).
- Запускать Playwright на ноуте; ставить `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; читать красные без аннотации `build` и нагрузки;
  `--workers=4`.
- Менять правила карты; добавлять ей e2e; переписывать RU чужих ключей; трогать незакоммиченные ханки соседа; разбор хода бота; `git stash`;
  bare `git push`.
