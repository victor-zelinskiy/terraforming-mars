# Промт исполнителю · T12 Red Tourism Wave («Наплыв туристов») — пятая классическая карта Turmoil под Redux, «на месте» (§3.1): событие, 3, метка Земли; «Красные правят ИЛИ 2 ваших делегата на их резолюции»; «+1 M€ за каждую ПУСТУЮ клетку рядом с вашими тайлами» — `bespokePlay` со счётом по ПОЛЮ (первая классическая карта, чей результат — множество клеток: превью обязано показать число И клетки) · ГЛАВНОЕ — ИТЕРАЦИЯ 3 ПОЛЁТОВ (≈ 75 %) «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД ПОВЕРХНОСТЬЮ, НА КОТОРУЮ САДИТСЯ»: ресурс с поля при розыгрыше ПРОЛОГА летит ПОД левую панель (владелец: «как будто проблема с z-index») — это не баг слоя, а решение 2026-09-03 «демоция по ИСТОЧНИКУ», которое противоречит закону «демоция по АДРЕСАТУ»; нужен один закон краски, рантайм-сторож краски и ревизия всех слоёв полётов × всех освещённых адресатов

> **Статус: ВЫДАН 2026-10-22.** HEAD `9a183a9523`. **T08 Parliament Hall ещё В РАБОТЕ у соседа** — его незакоммиченные файлы: вся семья
> финала (`ConsoleEndgameWorkspace.vue`, `endgame/consoleEndgame{Director,Script,State}.ts`, `console_endgame.less`, `consoleEndgameCeremony.spec.ts`),
> `.claude/rules/{console-ui,animations}.md`, `docs/claude/console/endgame-workspace.md`, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`, `ru/console.json` и
> **`assets/text/lore_texts.json` (там же лор T08)** — НЕ трогать; свои правки тех же файлов (строка T12 в §4.2 ворклиста, закон в `console-ui.md`,
> `animations.md`) — ПОСЛЕ его коммита, объявив ему. Лор владельца `T12` («Ahh, red sand, how lovely. Take a pic!») лежит в том же
> незакоммиченном файле — коммитить ТОЛЬКО свою строку (временный индекс + патч по строке, память `split-commits-by-hunk-temp-index`), никогда
> строку T08. Арт — `C:\Users\zelin\Downloads\Mars Arts\T12.png`. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T12 - Red Tourism Wave.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t12 …`; exit 2/3/4 → спросить). Раздел реестра: T08 берёт **BZ** → эта задача берёт **CA**; номера — по footer в момент записи.

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1, `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), `docs/claude/expansion-adaptation-checklist.md`
(таблица подсистем — строки «Play-card modal preview» (бесподобная карта → co-located `cardPlayPreview`: «a FIXED computable result MUST be shown») и
«Fullscreen rule text» (бесподобная → `infoText`)), **`docs/claude/console/resource-transfer.md` ЦЕЛИКОМ** (T06/T09: конец = объект, `surfaceClear`,
сторож, деграды), `docs/claude/console/workspace-band.md` § Фоновые кинематики (`:1578–1600` — ось `fromBoard`, «уточнение оси 2026-09-03»),
`src/styles/console.less` **§ BACKGROUND CINEMATICS RECEDE UNDER THE SHADE `:1981–2040`** (закон демоции: «WHERE DOES THE FLIGHT LAND? … lands on a
surface that STAYS VISIBLE (the rail …) → LEAVE IT UP»; и «ONE refinement … a flight whose SOURCE is the board also demotes, even when it lands on
the always-lit rail … the rail counter still ticks at the touchdown» — это и есть дефект владельца, узаконенный), `.claude/rules/console-ui.md`
§ THE ENDS OF A FLIGHT ARE VISIBLE (… AND LIVE / … NEVER FOLDS UNDER ITS OWN TOKEN), `.claude/rules/animations.md`, CLAUDE.md «Physical causality».
Память: `board-scene-gate-and-flight-demotion` (как ось источника появилась; ворота `waitBoardSceneQuiet`), `fixed-layer-is-a-stacking-context`
(⚠ rect-пробники не читают КРАСКУ; `elementsFromPoint` не видит `pointer-events: none`; рецепт проверки краски прокси), `con-main-stacking-trap`,
`con-root-column-hidden-spacer`, `resource-flight-live-ends-direction` (итерации 1–2), `board-information-layer`, `polish-priority-tv4k-no-deck-only`,
`e2e-only-on-steam-machine`, `e2e-speed-iteration` (TIMING-класс, `TM_E2E_STORYBOARD=1`), `batch-decisions`, `concurrent-session-edits-same-files`,
`split-commits-by-hunk-temp-index`, `e2e-spec-rot-contract`, `shell-template-escapes`. Журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **T09** (`turmoil/PROffice.ts` + спек — декларативная карта на Redux-столе; `infoText` блоком на бонус); бесподобный
розыгрыш с превью ПО ПОЛЮ — `base/LandClaim.ts`, `base/ImmigrantCity.ts`, `base/Flooding.ts`, `base/EcologicalZone.ts` (`cardPlayPreview` + чтение
поля); **счётные доли с клетками** — `common/models/ActionPreviewModel.ts:265–290` («One share of a counted number: what, how many, on which cells (for
the board peek)») + `console/boardPeek.ts` (клетки доли подсвечиваются на поле — язык «КУДА ЛЯЖЕТ» TR56 / ячейки ПО TR55); демоция — `console.less:1981–2062`,
`ConsoleResourceTransferLayer.vue:19–26` (`:class="{'con-flight-to-board': boardSourced}"`), `ConsoleScaleStepRewardLayer.vue:13–17` (статический маркер —
жетоны шага шкалы садятся на РЕЛЬС), `ConsoleCityPayoutLayer.vue:18–26`, `ConsoleTilePlacementLayer.vue`, `ConsoleNomadMoveLayer.vue`; подъём рельса —
`console.less:1950–1966` (`.con-res { z-index: 11520 }` под `.con-root--ws-open`) и церемония старта `:24838–24839` (`body.con-start-ceremony .con-status /
.con-res-host { z-index: 11490 }`); волны с поля на панель — `stagedPlay.ts:372–378` (печать пролога: `fromBoard: true`), `consoleTilePlacement.ts:1482,
1505–1512, 1626–1636, 1740–1748`, `adjacencyPayoutBeat.ts:196–206, 445`, `scaleStepReward/*:401/419`, `vpShareLedger.ts:381–386`, `consoleNomadMove.ts:517–523`;
сторож концов — `consoleResourceTransfer.reportEnds` / `sentinel` (T06), харнес `transferEndsGuard` (`consoleTest.ts`), свидетель `transferWitness.ts`;
e2e старта — `console-start-placement.spec.ts`, `console-staged-play.spec.ts`; гард тишины поля — `rewardPayoutQuiet.spec.ts`.

---

## Диагноз (подтверждён файл:строка на `9a183a9523`; перепроверить на своём HEAD)

### Карта
1. **Бесподобный розыгрыш со счётом по полю.** `turmoil/RedTourismWave.ts`: `bespokePlay` → `getAdjacentEmptySpacesCount(player)` (статика, её читает
   и награда `Tourist` Амазонии — не трогать) → `stock.add(M€, N)`. Требование — фасад (T04). `cardNumber: 'T12'` верен. Работа карты: co-located
   **`cardPlayPreview`** — фиксированный вычислимый результат «+N M€» ОБЯЗАН быть показан (чеклист; гард `cardPlayPreviewCoverage` падает с именем) с
   «почему» в языке СЧЁТНЫХ ДОЛЕЙ С КЛЕТКАМИ (`ActionPreviewModel` «shares … on which cells»): композер читает «+N M€ · N пустых клеток рядом с вашими
   тайлами», а ПОЛЕ за композером помечает ЭТИ клетки (board peek — тот же механизм, что у ячеек ПО TR55 / «КУДА ЛЯЖЕТ» TR56; проверить на своём HEAD,
   что peek принимает доли розыгрыша; если принимает только действия/ПО — расширить классом, не хуком карты); честный ноль — «нет пустых клеток рядом с
   вашими тайлами» с бесполезностью (`actionFutility`-класс розыгрыша: событие с нулём — играть можно, результата нет); `infoText` (бесподобная →
   `needsCuration`): «Requires…» + «Gain 1 M€ for each empty area adjacent to your tiles.»; RU (`turmoil_cards.json:39` — «Красные в правящий партии»,
   «ЖЕТОНАМИ» → «Требует, чтобы «Красные» были у власти или у вас было 2 делегата на их резолюции. Получите 1 M€ за каждую ПУСТУЮ КЛЕТКУ РЯДОМ С
   ВАШИМИ ТАЙЛАМИ.» — голос `turmoil_redux_cards.json:87–91`; «тайл», не «жетон» — глоссарий), лор RU («Ах, красный песок, какая прелесть. Сними на
   память!»), арт, строка долой (`turmoilReduxAdaptation.ts:45`), пин «as of the last adaptation» (5 из 22 — после T08; сверить), спеки класса «что
   раздаёт стол». Событие: лицо → стопка событий лицом вниз после розыгрыша (общий путь). MarsBot — чужие тайлы считаются как любые чужие (не свои).

### Полёты — «летит под панель»
2. **Это не z-баг, а узаконенная демоция по ИСТОЧНИКУ.** `console.less:1994–2008` формулирует закон: демотировать по АДРЕСАТУ — «lands on a surface that
   STAYS VISIBLE (the rail, …) → LEAVE IT UP; getting this wrong breaks the arrival». Но `:2026–2036` добавляет «уточнение 2026-09-03»: волна, чей
   ИСТОЧНИК — поле, демотируется тоже, «даже когда садится на всегда освещённый рельс … the rail counter still ticks at the touchdown» — то есть жетон
   по замыслу уходит ПОД рельс, а счётчик тикает вслепую. `ConsoleResourceTransferLayer.vue:26` вешает `con-flight-to-board` на весь слой `.con-transfer`
   при любой волне `fromBoard`; `.con-root--ws-open .con-flight-to-board { z-index: 11444 }` (`:2037`), при этом `.con-root--ws-open .con-res { z-index: 11520 }`
   (`:1960`) и `body.con-start-ceremony .con-res-host / .con-status { z-index: 11490 }` (`:24838`). **Печать пролога** (`stagedPlay.ts:372` — `fromBoard: true`,
   стартовый workspace стоит = `ws-open` + церемония старта) → жетон рождается на клетке в слое 11444 и садится на панель 11490/11520 — под краской.
   Тот же путь у КАЖДОЙ волны с поля на освещённую поверхность при открытом workspace: печатный бонус клетки / океанская смежность / Ares-выплата /
   награда кочевников / доли ПО с тайла (`vpShareLedger`) → ячейка счёта; **шаг шкалы** (`ConsoleScaleStepRewardLayer` — маркер статический, жетоны
   РТ/M€ садятся на рельс); выплата города чужому месту (`ConsoleCityPayoutLayer` вне промпта) → плашка чипа в статус-строке (11490 под церемонией
   старта; T06 M1 проверялась без открытого workspace).
3. **Исходная тревога 09-03 была про РОЖДЕНИЕ, а решили АДРЕСАТОМ.** «Яркие чипы поверх workspace читаются как «ресурсы материализуются из
   интерфейса»» — про точку рождения под стеклом полосы; лекарство понизило весь полёт, включая посадку на освещённый рельс. Два конца полёта живут в
   РАЗНЫХ слоях краски: рождение — под стеклом полосы (над затенённым полем), посадка — на освещённом хроме. Один z на весь полёт не может быть
   верен для обоих концов.
4. **Нет сторожа КРАСКИ.** `sentinel` T06 проверяет, что КОНЕЦ окрашен («end not painted»), но не что ЖЕТОН окрашен сверху: жетон под рельсом
   проходит все проверки (rect, видимость, трассу). Память `fixed-layer-is-a-stacking-context`: три недели зелёных e2e при невидимых полётах.
   `elementsFromPoint` не видит `pointer-events: none` — рецепт: на миг `pointerEvents = 'auto'` у фишки → `elementsFromPoint(centre)[0]` обязан быть
   самой фишкой (или её слоем).
5. **Нет гарда z-карты.** Ни один спек не держит инвариант «освещённый слой полётов ≥ z каждой освещённой поверхности-адресата во всех состояниях
   (`ws-open` 11520 рельс, церемония старта 11490, Info 11560, статус-строка, спутник `.con-res-aux`, плашка чипа, док руки) и демотированный слой <
   полосы (11480)». `rewardPayoutQuiet.spec` знает только `boardSourcedTransferActive`.

## Правила карты (спек пинит каждое)
1. Событие, 3, Земля; на Redux-столе требование — две дороги, причина руки со standing.
2. +1 M€ за каждую пустую клетку (не колония, не ограниченная, без настоящего тайла) рядом хотя бы с одним ВАШИМ тайлом; клетка считается один раз
   при нескольких ваших тайлах рядом; чужие тайлы не считаются; 0 — честный ноль с причиной.
3. Превью: число + клетки (доли с клетками → peek); после розыгрыша — волна «+N M€» с лица события на рельс (общий путь розыгрыша), событие — в стопку.
4. Классический стол — апстрим байт-в-байт; раздача под Redux = ранее адаптированные + T12; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.4; решения T04 1–6, T06 6–7 не переспрашивать)
1. **RU** — имя оставить («Наплыв туристов»); описание — в голос набора, «тайлы» (не «жетоны»); лор RU — как в диагнозе 1.
2. **Превью карты** — (а, рекомендовано) число + «почему» + КЛЕТКИ на поле (доли с клетками → board peek, пока композер стоит); (б) только число с
   «почему» — беднее сцены Steam.
3. **Закон краски — ОДИН, по АДРЕСАТУ, с ПЕРЕДАЧЕЙ СЛОЯ** (диагноз 2–3): (а, рекомендовано) у системы переноса ДВА фиксированных слоя-близнеца в одной
   системе координат: освещённый `.con-transfer` (базовый z 1162x) и затенённый `.con-transfer--under` (11444, под полосой); жетон, РОЖДЁННЫЙ на поле под
   открытым workspace, начинает в затенённом слое и в кадр, когда его центр покидает накрытую область (прямоугольник `.con-ws`-полосы ∪ затенённый бокс
   стейджа поля, измерен один раз при рождении + радиус фишки гистерезиса), ПЕРЕНОСИТСЯ в освещённый слой (`appendChild` — обе `fixed; inset: 0`,
   transform в viewport-координатах → ни пикселя скачка; GSAP-твин продолжает на том же элементе); жетон, рождённый на освещённой поверхности,
   никогда не опускается; жетон, САДЯЩИЙСЯ на поле (тайл, кочевники, возврат в клетку), остаётся затенённым — это и есть закон «по адресату»
   `console.less:1994–2008`, восстановленный для рождения на поле. Слои с собственной краской (`con-scalepay`, `con-citypay` вне промпта) — та же передача
   (общий помощник `flightLayerHandover(piece, coveredRect)` в движке; статические маркеры `con-flight-to-board` остаются только у слоёв, садящихся НА поле:
   `con-tileplace`, `con-nomadmove`, `con-scaleswing`); (б) поднять демотированный слой над поднятым рельсом (11525) — красит ярко поверх стекла полосы,
   возвращает тревогу 09-03; (в) убрать ось источника целиком — то же, что (б); (г) оставить как есть — нет (решение владельца 2026-10-22).
4. **Рождение под стеклом — тише** (вместе с 3а): пока фишка в затенённом слое, её собственная непрозрачность ≤ тени (`--con-shade-dim`), на передаче —
   плавно к 1 за ≤ 120 мс × motion; никакого «материализуется из интерфейса» (рекомендовано).
5. **Рантайм-сторож КРАСКИ** (диагноз 4): (а, рекомендовано) в `reportEnds`/`sentinel` — при рождении, на финальном подходе (0,8) и на касании фишка обязана
   быть ПЕРВОЙ в `elementsFromPoint(centre)` (на миг `pointer-events: auto`; допустимы её слой и её собственные дети) — иначе `[transfer] token painted
   under <selector> at <birth|approach|touchdown>` с трассой; `transferEndsGuard` красит каждый спек; (б) только трасса.
6. **Гард z-карты** (диагноз 5): `tests/console/flightLayerZOrder.spec.ts` читает `console.less` (+ `console_tv.less`, `console_start*.less`): для каждого
   слоя полётов и каждого состояния — освещённый z ≥ z всех освещённых адресатов, затенённый z < z полосы (11480), статический маркер только у слоёв
   на поле; список слоёв — по маркеру в `.vue` (grep `con-flight-to-board`), не рукописный.
7. **Финал** (`.con-root--endgame .con-flight-to-board`) — полёт последнего озеленения ПОД сценой финала остаётся (сцена full-bleed, панель не видна);
   сторож краски знает это состояние как законное «под сценой» только для `.con-root--endgame`.
8. **Объём** — карта ≈ 25 %, полёты ≈ 75 %; разбор хода бота, сцены колоний / Парламента по месту — не трогать.

## 0. Рабочее дерево
1. `git log --oneline -1` → `9a183a9523` на выдаче. **Сначала** `ListAgents` + процессы; `SendMessage` соседу T08 (его файлы — выше) и живым соседям:
   твои файлы — `turmoil/RedTourismWave.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `resourceTransfer/{consoleResourceTransfer,resourceTransferDirector,
   resourceTransferModel}.ts`, `components/console/resourceTransfer/ConsoleResourceTransferLayer.vue`, `scaleStepReward/ConsoleScaleStepRewardLayer.vue`,
   `tilePlacement/ConsoleCityPayoutLayer.vue`, `console.less` § BACKGROUND CINEMATICS, `console_tv.less` (z панели), `ru/{turmoil_cards,card_info}.json`,
   `tests/console/flightLayerZOrder.spec.ts`, e2e полётов, `docs/claude/console/resource-transfer.md`, `workspace-band.md` § Фоновые кинематики. Коммиты — ПО
   ХАНКАМ или явными путями; `lore_texts.json` — только своя строка; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`,
   `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t12` → `npm run e2e:remote -- t12 <spec> [--exclusive --workers=1]`;
   кадры «до» — клиент HEAD в `.e2e-t12-before` (`TM_E2E_SHOTS_TAG=before`); сториборд — `TM_E2E_STORYBOARD=1`; exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд = спек** `tests/e2e/console-flight-paint.spec.ts` (TIMING-класс с причиной): пробник КРАСКИ по `setInterval` (на каждом сэмпле у каждой фишки
   `.con-transfer__piece` / `.con-scalepay` / `.con-citypay`: на миг `pointerEvents = 'auto'` → `elementsFromPoint(centre)[0]` ∈ {фишка, её слой} → иначе
   «under: <selector>»; профиль TV (`consoleProfile=tv`, 3840×2160, `--exclusive`) и fhd. МАТРИЦА: (а) **печать пролога с тайлом** (`console-start-placement`-
   фикстура: пролог с городом/океаном и бонусами клетки — волна `stagedPlay`) — случай владельца; (б) розыгрыш карты, поднимающей шкалу, из композера
   (жетон шага шкалы → рельс при стоящем композере); (в) размещение с печатными бонусами + Ares-выплата при открытом workspace (хост, стоящий над
   полем во время волны — гидросеть / колония / «Карты в руке» через B-возврат); (г) выплата города чужому месту при открытой руке зрителя (два
   клиента); (д) доли ПО с тайла → ячейка счёта под поднятым рельсом; (е) финал — последнее озеленение ПОД сценой (законно под `.con-root--endgame`,
   иначе красный). Каждая клетка — «рождение · подход · касание: что сверху», плюс факт передачи слоя (`data-transfer-layer="under|lit"` на фишке).
4. Фикстуры — свои JSON (имена в `FixtureName` до сборки): `red-tourism` (Redux 2 места, Красные правят — `seatEnacted(quietResolutionOf(REDS))`, T12 в руке,
   у p1 город + озеленение с ≥ 5 пустыми соседями, у p2 тайл рядом с одной из них — проверка «чужие не считаются», M€ ≥ 3), `red-tourism-zero` (нет своих
   тайлов), `red-tourism-locked`; для полётов — существующие стартовые / Ares / колонийные фикстуры + при нужде `flight-paint-prelude` (сеянная раздача
   с прологом-тайлом).

## 1. Сервер — карта (≈ 15 %)
`RedTourismWave.ts`: `cardPlayPreview` (счётные доли с клетками: `stockGain(M€, N)` + доля «empty area adjacent to your tiles» × клетки; ноль — честно),
`infoText`, RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T12.png" T12` → `make:cards`), `card_info` (0/0/0), строка долой + пин. Спек: классический
блок остаётся; Redux-блок — правила 1–4 (счёт один раз на клетку, колония/ограниченная/занятая не считаются, чужой тайл рядом — не считается, ноль с
причиной, превью = результат, событие в стопку, save / load).

## 2. Клиент — карта (≈ 10 %)
Композер розыгрыша: чип «+N M€» с «почему» и peek клеток на поле (решение 2); плита руки / «Информация» — даром. e2e карте: ТОЛЬКО если peek долей
РОЗЫГРЫША — новая проводка (первая карта-событие с клетками в превью) — тогда один компактный спек (fhd + TV): клетки помечены, число совпадает с
сервером, ноль честный; если путь уже есть — e2e нет (чеклист §5).

## 3. Клиент — ГЛАВНОЕ: «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД СВОИМ АДРЕСАТОМ» (≈ 75 %)
### 3.А Диагноз числом (первым делом)
Стенд §0.3 на базе (`before`) по всей матрице, TV первым: таблица «клетка · рождение/подход/касание · что сверху · слой фишки». Ожидание: (а)–(д) красные
на TV при открытом workspace / церемонии старта, (е) законно под сценой.
### 3.Б Закон краски (решения 3–4)
- `ConsoleResourceTransferLayer.vue`: два слоя (`.con-transfer` lit / `.con-transfer--under`), `boardSourced` больше не демотирует ВЕСЬ слой; `resourceTransferDirector`:
  фишка рождается в слое по `run.fromBoard && coveredAt(birth)` (накрытая область = rect `.con-ws` ∪ затенённый стейдж, измерено при рождении), на
  `onUpdate` — проверка выхода центра из накрытой области (+ гистерезис) → `handover(piece)` в освещённый слой (DOM-перенос, transform неизменен, одна
  запись в трассу `flight:handover {at}`), опасность = ≤ 120 мс × motion к непрозрачности 1; обратно никогда. `con-scalepay` / `con-citypay` — тот же помощник;
  `con-tileplace` / `con-nomadmove` / `con-scaleswing` — как были (садятся на поле).
- `console.less` § BACKGROUND CINEMATICS: «уточнение оси 09-03» переписать: ось — адресат; рождение на поле под стеклом — затенённый слой-близнец до
  передачи; таблица слоёв и состояний; `.con-root--endgame` — без изменений.
- Спеки: `tests/client/console/transferLayerHandover.spec.ts` (jsdom: рождение под полосой → слой under; выход из области → перенос без скачка rect; рождение
  на освещённом → lit с первого кадра; посадка на поле → остаётся under; reduced motion — ничего не летит), `flightLayerZOrder.spec.ts` (решение 6).
### 3.В Сторож краски (решение 5) + регрессия
`sentinel` расширен (рождение / подход / касание — «painted on top»); `transferEndsGuard` ловит `[transfer] token painted under`; прогон набора на Steam
Machine: `console-start-placement`, `console-staged-play`, `console-play-tr-reward`, `console-aerial-mappers`, `console-colony-remote-bonus`, `console-rival-payout-intake`,
`console-venusian-census`, `console-action-price-fold`, `console-classic-gmo-contract`, `console-hazard-placement`, `console-auto-tile-landing`, `console-endgame`
+ новый `console-flight-paint` — по 2 повтора; красный читать после аннотации `build` и нагрузки; каждое новое красное — строка реестра или фикс классом.

## 4. Лицо, локаль, лор, арт
Арт T12; лор EN (ключ владельца) + RU; RU карты — диагноз 1; новых UI-ключей не ждать («почему» — существующая грамматика счётных долей; при нужде
`empty areas adjacent to your tiles` → «пустых клеток рядом с вашими тайлами»); `grep` ключа по всем `src/locales/*/*.json` ДО добавления; RU чужих не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardPlayPreviewCoverage` (бесподобная — хук обязателен), `consolePlayPreviewCoverage`, `cardInformation` (+ `infoText`),
   `requirementProse`, `premiumCardViewModel`, `premiumCardIcons` (глиф «пустая клетка» — существующий `emptyTile`, память `reuse-existing-icons-check-scan`), `cardLore`
   (T12), `actionFutility`-класс розыгрыша (ноль), `crossPlayerCoverageGuard`, `TurmoilCardsUnderRedux` (пин), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`,
   `e2eLiveness`, `lessDeadSelectorGuard`, `glyphLiteralGuard`.
2. Юниты §3.Б–3.В; `rewardPayoutQuiet.spec` (ось `fromBoard` для ворот не меняется); `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой
   машине, последовательно.
3. e2e §3.В; `npm run e2e:affected` + перевод задетых хуков тем же диффом.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/t12/{tv,fhd}/`: (а) печать пролога ДО / ПОСЛЕ ≥ 8 кадров: рождение на клетке под стеклом стартового workspace (приглушённо) → передача на
краю полосы → посадка на чернила панели ПОВЕРХ неё → тик; (б) шаг шкалы из композера → рельс; (в) Ares/бонус клетки при открытом workspace; (г) чужая выплата
на плашку чипа при открытой руке; (д) T12: композер с «+N M€ · N клеток», клетки помечены на поле, розыгрыш → волна на рельс, событие в стопку.
Каждый кадр — своим глазом с дивана: «жетон виден ВЕСЬ путь и садится НА панель, а не под неё?»

## 7. Полировка по пути
1. Реестр: раздел **CA** «ЖЕТОН НИКОГДА НЕ КРАСИТСЯ ПОД СВОИМ АДРЕСАТОМ» — диагноз 2–5 строками (классы: «демоция по источнику вместо адресата», «один z на
   два конца», «нет сторожа краски», «нет гарда z-карты»), находки регрессии; номера — по footer на своём HEAD (T08 займёт свои).
2. Доки: `resource-transfer.md` — новый § «Два слоя краски и передача» (накрытая область, передача, затенённое рождение, какие слои статичны, сторож краски,
   гард z-карты); `workspace-band.md` § Фоновые кинематики — «уточнение оси 09-03» заменить на закон передачи; `console.less` комментарий; закон в
   `console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE — «**…AND PAINTED ON TOP OF WHAT THEY LAND ON**: a token lands over its destination's paint, never under
   it — the demotion axis is the DESTINATION; a token born on the board under a workspace starts in the shaded twin layer and is HANDED OVER to the lit
   layer where it leaves the covered area (the board scene stays background, the arrival stays visible); the paint sentinel asks `elementsFromPoint` at
   the birth, the approach and the touchdown» (после коммита соседа T08); `animations.md` строка; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T12 «СДАНА»
   (после коммита соседа); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — стенд «до» на TV по матрице (доказательство классов 2–5 числом); карта — параллельно.
2. Порядок: карта + спек + строка долой (лор — своя строка) → стенд `before` → 3.Б два слоя + передача + юниты + гард z-карты → 3.В сторож + регрессия →
   стенд `after` + сториборды → реестр / доки (после коммита соседа — его файлы). Коммит по ханкам на каждом шаге.
3. Реестр: букву (CA) и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем таблица матрицы ДО / ПОСЛЕ, сториборды (а)–(д), результат регрессии (красные от сторожа краски — поимённо, что с ними),
   решения 1–8 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (3 (а/б/в) с кадрами, 2, 4 — рекомендация первой; остальное в отчёте), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Чинить «подъёмом z» одного слоя / одной панели; возвращать «счётчик тикает вслепую»; демотировать по источнику; один z на оба конца полёта; скачок rect
  при передаче слоя; красить фишку ярко над стеклом полосы; `setTimeout` как такт; анимировать width / height / top / left; `transition: all`.
- Менять ворота тишины поля (`waitBoardSceneQuiet` / `boardSourcedTransferActive` остаются для гейта), демоцию слоёв, садящихся НА поле, и демоцию под
  финалом; трогать геометрию панели / полосы / статус-строки.
- Менять правила карты / статику `getAdjacentEmptySpacesCount` (её читает награда Tourist); e2e карте без новой проводки; переписывать RU чужих ключей;
  трогать незакоммиченные файлы соседа T08 (включая строку лора T08); разбор хода бота; `git stash`; bare `git push`; Playwright на ноуте;
  `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
