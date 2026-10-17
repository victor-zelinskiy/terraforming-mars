# Промт исполнителю · TR70 Backroom Deal («Закулисная сделка») — красная (событие), 2, без меток, без требования: «следующая карта в этом поколении — без ТРЕБОВАНИЙ ПАРТИИ и на 10 M€ дешевле; −1 РТ» — класс «эффект на один розыгрыш» (TR49) + скидка «на следующую карту» (Indentured Workers) + цена в РТ · ГЛАВНОЕ — РЕВОРК ЦЕРЕМОНИИ «МАРС ТЕРРАФОРМИРОВАН»: «ПЛАНЕТА ПОКАЗЫВАЕТ» — где бы игрок ни был, его переносит к НАСТОЯЩЕЙ планете: лишний интерфейс отступает, планета входит в фокус камерой размещения, три шкалы сами доигрывают завершение, титул читается с дивана, сцена коротка, и игрок возвращается РОВНО туда, где был

Выдан 2026-10-17. Инфраструктура набора стоит (TR01–TR61, TR65–TR67, TR69 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строка «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ» (`:129` — новый вид требует: `ArmedPlayEffectKind`, оба читателя, формула и бейдж
`requirementEasingText`, `armedEffectFlight.armGlyphOf`); постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Премиум-планка»**; **«Качество полировки»**), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,console-ui,board,animations,tests,localization}.md`.
**Главные контракты итерации:** `docs/claude/console/planet-focus.md` ЦЕЛИКОМ (§ The four load-bearing decisions `:37` — «the hold must never cover the live placement», «the scales move ONLY after the
interface has returned», «the focus fit is DETERMINISTIC and frames the ALPHA-MEASURED disc», «THE MODE NEVER CHANGES LAYOUT» — бокс сцены одинаков в фокусе, на возврате и в покое; § The motion and the four
traps `:99`; § THREE poses of the dock `:225`; § The recede is opacity-only `:252`; § Sequencing `:262`; § Traps `:283`), `src/client/console/boardBeatPark.ts` (шапка — «a board beat WAITS for a board the
player can see»; держит значения шкал и HUD, парк пакета), `docs/claude/terraforming-progress-hud.md` (одна математика, один триггер, флип — первый такт сцены поколения), `docs/claude/console/hud-frame.md`
§ THE CENTRAL OPENING (`:307–436` — кинематика full-bleed `:331–336`, кто что тратит `:420–428`), `information-workspace.md` § The overlay contract (`:10–27` — снимок и восстановление контекста),
`presentation-flow.md`, `final-greenery.md:37–102` (анонс финала через гейт — PL-290), `docs/claude/console/scene-transition.md`, `docs/CONSOLE_SURFACE_MOTION.md`; законы CLAUDE.md «Physical causality»
(результат переживает поверхность; карта всегда уходит из реального источника — ЗДЕСЬ: церемония играет на РЕАЛЬНОЙ планете, не на суррогате), «A WORKSPACE IS ONE FLOW» (п. 3 — `v-if`-подмена = моргание),
инварианты 1 (никогда по тексту — триггер структурный), 6 (одна система движения; критическая анимация — animation hold, release = собственный сигнал завершения, НИКОГДА `setTimeout`), 10 (транспорт
ничего не рисует), 12 (глифы). Память: `polish-direction-smoothness` («ничего не меняется одним кадром»), `animation-hold-registry`, `presentation-flow-orchestrator`, `board-beat-park`, `final-greenery-session`,
`stall-iteration-2026-10-14` (PL-290 — церемония задерживала анонс финала на 2,5 с), `tr61-generation-scene` (сцена с записи сервера, такты в порядке сервера, холд), `tr58-cursor-living-object`,
`console-tv-profile`, `console-reading-typography`, `turmoil-redux-cutting-edge-design` (TR49 — класс), `bot-turn-review-out-of-polish-scope`, `concurrent-session-edits-same-files`,
`e2e-fixture-generator-gotchas`, `shell-template-escapes`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-17), по смыслу дословно:** «реворк анимации церемонии „Марс терраформирован“ — сейчас она выглядит непремиально и нечитабельно, сам вид плохо гармонирует с интерфейсом. Нужна
другая концепция: вне зависимости от того, где игрок находится, его перекидывает на интерфейс самой планеты, планета идёт в фокус, лишние элементы интерфейса скрываются, и сама планета „показывает
церемонию“; текст максимально читабелен; анимация не затянута; в конце игрока возвращает туда, где он был — что-то вроде мини-заставки, но именно с показом ТЕКУЩЕГО состояния планеты. Очень хорошо
продуманная и очень сильно поставленная сцена. Карта проста — на эту полировку все силы: концепция должна очень хорошо лечь на интерфейс игры, текущая церемония слишком чужеродная.»
Итерация (≈ 85 %): **А. «К ПЛАНЕТЕ И ОБРАТНО»** — оболочка сцены: снимок контекста, уход поверхностей, камера, возврат (≈ 35 %); **Б. «ПЛАНЕТА ПОКАЗЫВАЕТ»** — сама постановка: шкалы доигрывают завершение,
планета дышит, титул (≈ 35 %); **В. «ПОРЯДОК И ВРЕМЯ»** — триггер с сервера, место в очереди тактов, длительность, пропуск, все зрители (≈ 15 %). Карта (≈ 15 %) — новый вид эффекта «один розыгрыш» для
ПАРТИЙНОГО требования + скидка + цена в РТ.

## ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (HEAD `9c78dbefc6`; рядом — сессии `terraforming-mars-6e` (хвосты стола: `played/**`, `console_played.less`, `played-table.md`, раздел BC) и `terraforming-mars-d1` (приёмка
TR69: `ConsoleEndgameWorkspace.vue`, `console-finale-podium.spec.ts`, `fixtures/generate.ts` + `finale-rich-bot.json`, `consoleStart.ts`) — церемонии не касаются; кадры 4K GPU — `screenshots/tr70/tv4k/*.png`, листы
`screenshots/tr70/sheet-w{1,2,3}-*.jpg`; замеры — `screenshots/tr70/tv4k/ceremony-samples.jsonl` (сэмплер DOM 100 мс); стенд подготовки — `screenshots/tr70/walk.stand.spec.ts` (вне git: стол 2 игроков
доводится API до «две шкалы на максимуме, третья на шаг короче», страница зрителя открыта, последний шаг — по API; три варианта: с поля, поверх «Информации», поверх альбома руки); файл:строка подтвердить на
своём HEAD)

**Замеры (4K, три варианта — одинаковы):** церемония стоит **6,7 с** (таймер `CEREMONY_LIFETIME_MS` 6200 + уход 600); сцена `.con-terracere__stage` **600 × 600 px по центру экрана** (`@ 1620, 621`),
поверх ВСЕГО (z 11722 — выше полос workspace 11480–11515, «Информации» 11560, тел руки 11645, слоёв полёта 11620–11670, дока 11703); **вуаль прозрачная** (`rgba(0,0,0,0)` в точке сэмпла — радиальный
градиент 0,64 → 0,22 → 0 к 80 %: бары не затемнены); **HUD виден всё время** (`visibility/opacity` = `visible/1`); тексты 38 / 96 / 42 px — читаемы, но стоят ПОД шаром поверх чужой поверхности.
Кадры: `w1-board-02…06` — шар поверх сцены «Получена карта» (бонусная карта клетки от последнего океана — её сцена стояла, когда сработала церемония); `w2-info-02…06` — шар поверх досье «Информации»;
`w3-hand-*` — поверх альбома руки. Ни в одном кадре — реальной планеты.

1. **Суррогат вместо планеты.** `ConsoleTerraformingCeremony.vue:1–21` — `__veil` + `__scene` › `__stage` (`__atmo` / `__planet` / `__ring` — CSS-градиенты, «procedural terraformed Mars — no asset»,
   `console.less:3983–4003`) + три строки; шапка `:23–52` сама называет это «центральной кинематикой уровня церемонии вех». Настоящая планета — `mars.webp` в `.con-board__stage` (`ConsoleBoardSection.vue:5–7`),
   альфа-диск 449 × 449 (`PFOCUS_FRAME` `:236`), три шкалы вокруг (`ArcScale.vue` / `OceanArcScale.vue` в `.global-numbers`) — в церемонии не участвуют. На кадре `w1-board-02` реальный Марс стоит ЗА
   сценой «Получена карта», затемнённый.
2. **Поверх чего угодно, ничего не прячет.** Монтирование безусловное `ConsoleShell.vue:68–72` (не кадр стека, не в `sealLiveGameSurfaces`), `position: fixed; inset: 0; pointer-events: none`
   (`console.less:3940–3949` — «the game stays fully playable underneath»): HUD, рельсы, бар, workspace — всё остаётся; контекста игрока сцена не знает и не восстанавливает — ей нечего восстанавливать, она
   ничего не убирала.
3. **Триггер — клиентский дифф сырой модели.** `terraformingCelebration.ts:95–109` (`observeTerraformingProgress` — `complete` по трём параметрам, nonce на живом false → true), вызывается из
   `NotificationLayer.vue:306, 333–346` (`update()` по `playerView`); транспорт о церемонии не знает (`gameTransport.ts` — ни детекта, ни холда в `transportHolds` `:272–295`). Сервер УЖЕ объявляет
   структурно — `Game.maybeLogMarsIsTerraformed` `Game.ts:821–826` (`'Mars is terraformed!'` как `announcement`, с учётом вариантов конца игры, «even mid-action»), журнал — `journal-entry--announcement`
   (`JournalEntry.vue:13`). Клиент читает СЫРУЮ модель, а полоса состояния и шкалы — ДЕРЖИМЫЕ значения парка (`ConsoleStatusStrip.vue:324–338`, `boardBeatPark`): церемония может сработать, пока HUD и
   шкалы ещё показывают прежние числа (`w1-board-01` — «8/9 96 %» при уже стоящей церемонии на следующем кадре).
4. **Время — таймер, не сигнал.** `CEREMONY_LIFETIME_MS = 6200`, `REDUCED = 2200`, `BURST_DELAY = 420` (`:55–58`); холд `beginAnimationHold('terraforming-ceremony')` (`:88–102`) снимается по `setTimeout`
   (нарушение инварианта 6); пропуска нет; анонс финала ждёт за холдом (PL-290: 2,5 с из 4,3 с). Движение: вход 240 мс, уход 600 мс (`console.less:4048–4051`), текст — CSS-анимации `con-terracere-line`;
   залп `playCeremonyBurst` accent `terra` (`ceremonyFx.ts:73`).
5. **Хорошее, НЕ ломать / переиспользовать:** (а) **камера «Планета в фокус»** — `planetFocus.ts` (фазы `idle → entering → active → exit-prep → exiting` `:68`; вход 680 / выход 760 мс `:56–57`; возврат дуг
   260 `:66`; `enterPlanetFocus` `:169`, `snapPlanetFocusSettled` `:191`, `beginPlanetFocusExit` `:209–238`; холд `planet-focus` только на выходе `:99–102`), её детерминированный фит в альфа-диск
   (`ConsoleBoardSection.vue:1001–1017`, `restoreNormalFraming` `:1035`, `PFOCUS_MAX_SCALE` `:246`), классы `con-board--pfocus*` (`:465–492`), отступ дуг и внешних клеток по ОПАСИТИ, затем `display: none`
   только в `settled` (`console.less:5796–5831`), баннер гаснет через `.con-root--pfocus` (`:5698–5707`), сцена «протекает» вниз `clip-path` + `--pfocus-bleed` (`:5709–5720, 5563`), док — компактная поза
   (`ConsoleShell.vue:3274`); **бокс сцены НЕ меняется** (решение 5 дока: 39 px прыжок одним кадром — история); (б) **парк тактов поля** — `boardBeatPark.ts`: держит значения шкал и HUD, пока поле накрыто
   (`boardBeatDisplayParams`), и ОСВОБОЖДАЕТ их «тактом шкал» (`playPlanetFocusScaleBeat` — маркеры скользят, заливки растут, HUD флипает, чипы дельт, акценты `con-scale-focus-<param>`; блокирующий холд;
   `planetFocusBeatAllowed` — «мир тих»: нет ревила, карт в полёте, сцены обложки, сброса); (в) HUD — золотой рельс 100 % + «ФИНАЛЬНОЕ ПКЛ.» + пульс 3400 мс по тому же nonce (`ConsoleStatusStrip.vue:53–59,
   105–117, 521–531`) — ПЕРСИСТЕНТНОЕ состояние остаётся в HUD; (г) снимок и восстановление контекста — `infoModeState.ts` (`:84–94` capture, `:103–111` restore, `openInfoMode` `:113–127`), стек workspace —
   `yieldStackToBoard` `:1555`, `resumeStackFromBoard` `:1607` (та же глубина), `collapseWorkspaceStack` `:1628` / `restoreWorkspaceStack` `:1645`; (д) гейт обязательных — `consoleMandatoryGate.ts:5–80`
   (анонс не встаёт при активном animation hold `:74–75`), политика — `'animation'` глушит нотификации; детектор утечек — `consoleLeakDetector.ts:116–121` (церемония зарегистрирована); (е) сцена поколения
   TR61 — образец сцены с записи сервера: `generationScene.ts` (фазы `:67`, поставщик холда с `diagnose` / `expire` `:101–104`, `detectGenerationScene` `:122` из `gameTransport.ts:959`, флип — сигнал
   `flip-end`, `concludeGenerationScene` `:292–313`); (ж) `presentationPolicy` — вид аренды `'ceremony'` «short celebratory beats» (`:45`) — церемония его не использует.
6. **Вне объёма:** разбор хода бота (реворк — владелец); финал-подиум (TR69, сосед d1); стол (сосед 6e).

## КОНЦЕПЦИЯ «ПЛАНЕТА ПОКАЗЫВАЕТ» (обязательная рамка; детали постановки — исполнителю, спорное — решениями владельца)
**Один объект — настоящий Марс в центральном проёме; одна фраза — «интерфейс отступил → планета в фокусе → шкалы доиграли завершение → титул → интерфейс вернулся».** Ничего нового не рисуется поверх игры:
планета, три шкалы, HUD, титульная плита — всё существующие объекты консоли, в их собственном языке.
- **Такт 0 — тишина мира.** Сцена — ТАКТ ПОЛЯ (закон парка): она не стартует, пока идёт история поля (посадка тайла, награды, ревил, карты в полёте) — ждёт `planetFocusBeatAllowed`; её запись приходит с
  сервера (объявление `Mars is terraformed!` / `game.isTerraformed` в применении ответа — как `detectGenerationScene`), пока значения шкал ДЕРЖАТСЯ парком.
- **Такт 1 — уход (≈ 0,5 с).** Снимок контекста (как `openInfoMode`); всё, что стоит над полем, ОТСТУПАЕТ опасити (workspace-полоса, «Информация», альбом руки, сцена ревила, док — компактная поза, рельсы и
  бар — опасити, полоса состояния остаётся, но её чипы параметров ещё держат прежние числа); поле оказывается единственной сценой. Никакого `display: none` на поле; поверхности паркуются как `.con-eg` в
  обзоре финала (opacity + visibility, никогда `display`).
- **Такт 2 — камера (680 мс, как у размещения).** `enterPlanetFocus` в ВАРИАНТЕ «церемония»: тот же детерминированный фит в альфа-диск и `--pfocus-bleed`, но дуги НЕ гаснут — они и есть история
  (в размещении они уходят, потому что мешают выбору клетки; здесь мешать нечему).
- **Такт 3 — планета показывает (≈ 1,5–2 с).** Такт шкал парка на фокусном кадре: три маркера скользят к максимуму (тот, что сделал последний шаг, — последним, с акцентом `con-scale-focus-<param>`),
  заливки замыкаются, HUD-чипы флипают в «100 %» и золото (существующий пульс по nonce), по лимбу планеты проходит дыхание атмосферы (свет лимба + мятный ободок — язык `__atmo` / `__ring`, перенесённый на
  реальный диск), в финале — залп `ceremonyFx` accent `terra` над НАСТОЯЩЕЙ планетой.
- **Такт 4 — титул (поверх такта 3, с 0,4 с).** Плита на консольном стекле в зоне протекания (под диском, не поверх него): кикер «ТЕРРАФОРМИРОВАНИЕ ЗАВЕРШЕНО», заголовок «Марс терраформирован» в
  лестнице TV (герой 2,2rem = 88 px на 4K), строка-утверждение (честная: «Текущее поколение станет последним» / три параметра), всё ≥ пола; грамматика — голова сцены ревила `revealStageHead` / семейство
  плит запросов, не свой стиль.
- **Такт 5 — возврат (760 мс).** `beginPlanetFocusExit` → дуги на месте, поверхности возвращаются из парка опасити в ТУ ЖЕ позу (стек — та же глубина, «Информация» — тот же снимок, альбом — та же
  страница и фокус, сцена ревила — продолжает с того места); HUD уже в золоте. Полная длительность ≤ ~4,5 с (решение 7); пропуск — любая кнопка после первого такта планеты (решение 8); reduced motion —
  снапы без камеры: плита + мгновенные шкалы, ≤ 1,5 с.
- **Все зрители.** У каждого места — своя сцена по своей записи; у актора — после его собственной истории поля; у зрителя чужого хода — как такт чужого хода (после нотификации? — решение 9).

## Обязательное чтение до кода
`docs/claude/console/planet-focus.md`, `terraforming-progress-hud.md`, `hud-frame.md:300–436`, `information-workspace.md:10–27`, `final-greenery.md:37–102`, `presentation-flow.md`, `scene-transition.md`,
`docs/CONSOLE_SURFACE_MOTION.md`, `tv-reading-typography.md`; `src/client/components/console/{ConsoleTerraformingCeremony,ConsoleBoardSection,ConsoleStatusStrip,ConsoleShell}.vue` (`Shell:68–72, 3274,
6500–6516, 8443, 12237–12241`), `src/client/console/{planetFocus,boardBeatPark,consoleMandatoryGate,consoleLeakDetector,consoleWorkspaceStack,infoModeState}.ts`, `console/generationScene/generationScene.ts`,
`console/transport/gameTransport.ts:600–1000` (применение ответа, `transportHolds`), `src/client/components/gameProgress/terraformingCelebration.ts`, `components/notifications/NotificationLayer.vue:300–350`,
`components/presentation/{animationHold,presentationFlow,presentationPolicy}.ts`, `console/ceremony/ceremonyFx.ts`, `console/revealStageHead.ts`, `components/motion/motionTokens.ts`,
`console/useConsoleReducedMotion.ts`; стили `console.less:3932–4097` (церемония), `:5563, 5674, 5698–5720, 5796–5848` (фокус), `console_tv.less:91–107, 190–195`; спеки `tests/client/components/console/
consoleTerraformingCeremony.spec.ts`, `tests/client/components/gameProgress/terraformingCelebration.spec.ts`, `planetFocus.spec.ts`, e2e `console-planet-focus`, `console-board-framing`, `console-final-greenery*`,
`console-endgame` (`:108` — путь через церемонию), харнесс `consoleEndgameHarness.ts` (`drive` `:220`, `terraformed` `:299`, `journeyToEndgame` `:581`); сервер `Game.ts:815–830` (`maybeLogMarsIsTerraformed`),
`:1849, 1967, 2062` (вызовы). Карта: `turmoilRedux/CuttingEdgeDesign.ts` (TR49 — `:89` декларация), `common/cards/Types.ts:15–39`, `ICard.ts:234, 267–277`, `Card.ts:136–139, 451–500`,
`Player.ts:299, 616–636, 822–885, 1253–1299, 1541–1574, 2191, 3374–3410`, `requirements/{PartyRequirement,GlobalParameterRequirement,CardRequirements}.ts`, `parliament/Parliament.ts:486–547`,
`PoliticalOps.ts:128–140`, `models/{armedPlayEffects,requirementEasing,armedPlayForecast,unplayableReasons}.ts`, `common/models/ArmedPlayEffectModel.ts:21–24, 88`, `ServerModel.ts:76`, `ModelUtils.ts:183`,
`behavior/Executor.ts:565–573`, `base/IndenturedWorkers.ts`, `turmoilRedux/PartySanctions.ts:72–78`; клиент `console/{cardAvailability,armedEffects,requirementEasingText,armedEffectFlight}.ts`,
`unplayableReasonFormat.ts:47–91, 192–193`, `ConsoleArmedEffectsSection.vue:9–31`, `ConsolePaymentPanel.vue:28–39`, `effectForecastModel.ts:398–409`, `consoleActionCommit.ts:629–630, 980–991`,
`resourceTransferModel.ts:165`; спек `tests/cards/turmoilRedux/CuttingEdgeDesign.spec.ts` (правила `:125–321`), док `docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md` (§2.1 `:72–87` — печать = символ вида);
последняя запись журнала (TR69 — формат).

## Что это за карта
**Скан:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR70.png`. Правила набора — `…\TM Turmoil Redux\Turmoil Redux Rules.pdf` (текст — `C:/tmp/redux-rules.txt`).
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR70.png` **ЕСТЬ** — импортировать конвейером набора (кредит на скане — skynesher).
**Красная (EVENT), 2 M€, без меток, без требования, без ПО.**

### Чтение скана
Красная рамка; цена **2**; MIN-плашка пуста — требования нет. Значок события в углу; меток нет. Заголовок «BACKROOM DEAL». Низ: «NEXT CARD : [плашка требования партии (фиолетовый «P»-жетон на жёлтой плашке
MIN), ПЕРЕЧЁРКНУТАЯ красным] [−10 на золотом жетоне M€]» и справа крупный диск Марса с «−1» (потеря 1 РТ); текст: «(Ignore any party requirements on the next card you play this generation. It will also cost
you 10 less M€.)». Лор: «"Collusion"? That's crass. We prefer to call it "Bipartisanship".». Фиолетовый ромб — символ модуля, без `compatibility`. Номер TR70. Печать — по образцу TR49 (`CuttingEdgeDesign.spec:94`
— глиф требования + звёздочка; здесь — перечёркнутая плашка партии; проверить, есть ли в рендере «плашка требования партии» как элемент — если нет, ближайший честный (`b.text('next card', Size.SMALL, true).colon()`
+ эмблема партии-«любая» с крестом + `.megacredits(-10)`) и строка в чеклист §4) + `b.tr(-1)` крупно справа (как у Pristar / TerralabsResearch).

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/BackroomDeal.spec.ts`)
1. **Требования нет**; событие — в стопку событий лицом вниз.
2. **Розыгрыш — три эффекта одной картой:** (а) −1 РТ сразу; (б) ВЗВЕДЁННЫЙ эффект «следующая карта в этом поколении игнорирует требования ПАРТИИ»; (в) взведённая скидка «следующая карта на 10 M€ дешевле».
3. **−1 РТ** — `behavior: {tr: -1}` → `Executor.ts:565–573` → `decreaseTerraformRating` (`Player.ts:630–636`); налог Красных — только на ПОДЪЁМ (`:616–627`) — потери не касается; пола 0 и `canPlay`-проверки
   нет (прецеденты — только корпорации: `TerralabsResearch.ts:16`, `Pristar.ts:20`, `Midas.ts:14`); ⚠ плоский `tr: -1` НЕ пишет строки журнала (Executor логирует только объектную форму `:567`) — строка
   «${0} lost ${1} TR» (RU `log_messages.json:281`) обязана быть: объектная форма или co-located лог; событие `tr-changed` с минусом (`EventRecorder.ts:756–765`) — для нотификации зрителя «−1 РТ».
4. **Взведение — класс TR49:** оба эффекта живут как `Player.lastCardPlayed` (`Player.ts:299`; `Card.activeRequirementBonus` `Card.ts:488–500`); потребляются СЛЕДУЮЩЕЙ сыгранной картой (`:1565–1566` — даже
   если ей не нужны; стандартный проект не тратит), гаснут на пасе (`:2191`) и у Eccentric Sponsor; сериализация `:3374–3375, 3410`; один взведённый источник за раз (правило 5 TR49 — новый розыгрыш TR70
   поверх TR49 ЗАМЕНЯЕТ, не складывает); журнал — `recordRequirementEasing` (`:841–885`, событие `requirement-eased`) + `recordDiscount` (`:1541`, «saved N M€ playing with X»).
5. **Скидка** — свойство карты `cardDiscount: {amount: 10, nextCardOnly: true}` (`ICard.ts:234`, `Types.ts:15–20`; прецедент `IndenturedWorkers.ts:16`), сумма в `getCardCostBreakdown` (`:1256–1299`, пол 0 `:1299`);
   карта дешевле 10 — тратит всю скидку (прогноз помечает `used` только при `lowered && cost > 0` — `armedPlayForecast.ts:26`).
6. **Партийное требование — НОВЫЙ вид эффекта (главная серверная работа карты):** класс TR49 НЕ generic — `requirementEasingOf` выходит на не-глобальном требовании (`requirementEasing.ts:36`),
   `RequirementEasingModel.parameter: GlobalParameter` (`ArmedPlayEffectModel.ts:88`), `Player.globalRequirementWaiver(parameter)` (`:822–834`), `PartyRequirement.satisfies` (`:25–27` →
   `Parliament.access` `:486–517`, `satisfiesRequirement = ruling || delegates ≥ 2` `:515`) без крюка. Нужно: декларация карты `partyRequirementWaiver: {nextCardOnly: true}` (co-located, как
   `globalParameterRequirementBonus` `:89`), `Player.partyRequirementWaiver()` по `lastCardPlayed`, крюк в `PartyRequirement.satisfies` (ПЕРЕД `access` — как `GlobalParameterRequirement.ts:62`), вид
   `'partyWaiver'` в `ArmedPlayEffectKind` (`:21–24`) + оба читателя `armedPlayEffects.ts:21, 48` + `requirementEasingOf` (ветка партии) + модель `RequirementEasingModel` (партия вместо параметра) +
   прогноз `armedPlayForecast`; TR36 Council Seat (порог ЭФФЕКТА, не требования) — не путать: TR70 снимает ТРЕБОВАНИЕ, эффект партии при этом не даётся «бесплатно» (`hasEffect` `:496–497` — по делегатам).
7. **Два эффекта от одной карты** — читатель умеет массив (`oneShotEffectsOf` `:48`), но ни одна карта набора так не делает: спек + гард «взведённые эффекты одного источника показаны оба» (Информация ›
   Эффекты, альбом).
8. **Клиент:** альбом руки — карты с партийным требованием становятся «доступны» с причиной-послаблением (`cardAvailability.ts:315–334` — `decisive` easing), чип PL-479 «[эмблема] 0/2» → состояние «снято»
   (`unplayableReasonFormat.ts:87–91, 192–193`), цена «ЦЕНА 23 → 13 · ⚡ 1× Закулисная сделка» (`ConsolePaymentPanel.vue:28–39`, `discountTail` `effectForecastModel.ts:398–409`); «Информация › Эффекты» —
   взведённые: перечёркнутое «Требование партии» + «−10 M€» (`ConsoleArmedEffectsSection.vue:9–31`, `armedEffects.ts:32–47`); формула и бейдж — `requirementEasingText.ts:131–156` (исчерпывающие свитчи —
   новый вид обязан попасть в оба); печать символа вида (PL-398, `TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md:72–87`) — `once` (золотая молния); полёт взведения `armedEffectFlight.ts:166–179`.
9. **Цена в РТ на консоли** — закон PL-104 «цена уходит первой»: жетон РТ с ячейки РТ (как доход РТ → M€ в сцене поколения TR61 летит ИЗ ячейки РТ), ячейка тикает на уходе; сегодня `spendLinkSpecs` пропускает
   `icon === 'tr'` (`consoleActionCommit.ts:629–630`) → ничего не летит — закрыть; превью — чип цены с иконкой `tr` (`actionPreview.ts:649`).
10. **Бесполезность** — нет (скидка всегда пригодится следующей карте); при 0 РТ — играема (пола нет — спек фиксирует поведение движка).
11. **MarsBot** карту не играет (бот не имеет партийных требований как таковых — его карты не из руки); save / load — `lastCardPlayed` переживает; превью чисты.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **Имя RU** — «Закулисная сделка» (коллизий нет; «Сговор» занят стандартным проектом Underworld `ui.json:1190`; «Сделка по терраформированию» — прелюдия). Альтернатива «Кулуарная сделка».
2. **Лор** — EN слово в слово (ключ `TR70`); RU: «„Сговор“? Как грубо. Мы предпочитаем называть это „межпартийным сотрудничеством“.»
3. **Арт** — файл есть: импорт (skynesher); первая строка отчёта — «арт импортирован».
4. **Печать перечёркнутой плашки партии** — (а, рекомендовано) один элемент рендера «требование партии, снято» (эмблема «любая партия» в MIN-плашке + красный крест — как на скане), переиспользуемый
   следующими картами; (б) текст «NEXT CARD: party requirement ×».

**РЕВОРК ЦЕРЕМОНИИ (решения 5–11):**
5. **Шасси сцены** — (а, рекомендовано) сцена — ВАРИАНТ «Планеты в фокус» (`planetFocus.ts` получает `mode: 'placement' | 'ceremony'`: тот же фит, тот же бокс, дуги остаются) + парк тактов (значения шкал
   держатся до такта 3) + снимок / восстановление контекста по образцу «Информации» и стека; (б) отдельный полноэкранный слой с копией планеты — запрещено концепцией (суррогат).
6. **Что показывает планета** — (а, рекомендовано) такт шкал парка на фокусном кадре (маркеры к максимуму, последний — с акцентом, HUD-флип, золото) + дыхание атмосферы на реальном диске + залп `terra`;
   (б) только дыхание и титул, шкалы — как сейчас (мгновенно).
7. **Длительность** — (а, рекомендовано) ≤ 4,5 с: уход 0,5 → камера 0,68 → планета 1,6 → титул перекрывает → возврат 0,76; reduced motion ≤ 1,5 с без камеры; (б) ≤ 6 с (как сейчас).
8. **Пропуск** — (а, рекомендовано) любая кнопка после первого такта планеты сворачивает сцену в конечное состояние одним фразой (как X у финала: атомарный settle, HUD в золоте, возврат); (б) без пропуска.
9. **Чужой ход** — (а, рекомендовано) та же сцена у каждого зрителя, в своём порядке тактов (после нотификации чужого хода / истории поля); (б) у зрителя — только HUD-пульс и тост.
10. **Титул** — (а, рекомендовано) плита в зоне протекания ПОД диском, лестница TV (герой 88 px, строки ≥ пола), честная строка (финальное поколение / три параметра); (б) титул поверх диска.
11. **Триггер** — (а, рекомендовано) с сервера: объявление `Mars is terraformed!` / `game.isTerraformed` в применении ответа (`detect…` как у сцены поколения), общий nonce `terraformingCelebration`
    остаётся для HUD; вариантные концы игры (Венера / Луна) — по серверу, не по трём параметрам; (б) клиентский дифф как сейчас.

## 0. Рабочее дерево
1. `git log --oneline -1` → `9c78dbefc6` на выдаче. **Рядом живы ДВЕ сессии:** `terraforming-mars-6e` (хвосты стола — `played/**`, `consolePlayedCategoryModel.ts`, `consolePlayedModel.ts`, `console_played.less`,
   `played-table.md`, `TURMOIL_REDUX_STRATEGIC_SHIFT.md`, раздел реестра BC, `.claude/rules/console-ui.md` (раздел стола), `ru/console.json`) и `terraforming-mars-d1` (приёмка TR69 — `ConsoleEndgameWorkspace.vue`,
   `console-finale-podium.spec.ts`, `fixtures/generate.ts` + `finale-rich-bot.json`, `consoleStart.ts`). **Сначала** `ListAgents` + процессы playwright (память `pasted-prompt-author-may-still-run`);
   `SendMessage` обеим о порядке: твои файлы — церемония, `planetFocus.ts`, `boardBeatPark.ts`, `ConsoleBoardSection.vue`, `ConsoleStatusStrip.vue`, `gameTransport.ts`, `terraformingCelebration.ts`,
   `NotificationLayer.vue`, блоки `console.less:3932–4097, 5563–5848`, `ConsoleShell.vue` (только монтирование / проводка сцены); общие — `console-ui.md`, `ru/console.json`, `consoleStart.ts`,
   `fixtures/generate.ts` — свои строки добавлять ПОСЛЕ их коммитов. Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q --
   package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить. ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки клиента — неиспользуемый импорт / `el.remove()` на Node роняет
   `npm run build:client` всем сессиям (сосед d1 подтвердил на своём опыте).
2. Снапшот e2e — свой: `npm run e2e:snapshot tr70` + `TM_E2E_ROOT=.e2e-tr70`; ⚠ перед снапшотом — `npm run build:server` (на подготовке серверные исходники были новее `build/`) и убедиться, что сосед не
   собирает `build/` в этот момент (память `e2e-snapshot-mid-compress-empty-css`); кадры «до» — клиент HEAD в своём снапшоте (память `ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`, ANGLE
   d3d11 — `screenshots/tr70/pw.config.ts`). ⚠ Скриншот 4K ≈ 1 с — хронометраж только пробником (сэмплер DOM 100 мс — образец `armSampler` в стенде подготовки). Снапшот подготовки `.e2e-tr70prep` удалён.
3. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки. Для церемонии стенд подготовки обходится без фикстуры: `createTable` + `drive(request, ids, almost)` («две шкалы на максимуме, третья на шаг
   короче») + открыть страницу + `drive(…, terraformed)` по API — повторить для вариантов: с поля; поверх «Информации»; поверх альбома руки; во время своего размещения (последний океан — с поля через UI:
   `console-final-greenery*` / `placeFinaleGreenery` харнесса — ревил бонусной карты стоит, когда срабатывает церемония — кадр `w1-board-02`); зритель чужого хода; вариант конца игры (Венера — `requiresVenusTrackCompletion`);
   соло (`lastSoloGeneration`); reduced motion. Для карты: TR70 в руке + карта с партийным требованием (TR15-класс) при партии НЕ у власти и 0 делегатах + карта с глобальным требованием (не должна
   сняться) + дорогая карта (скидка 10) + дешёвая (< 10) + TR49 на столе (замена взведения).
4. **Пробник сцены:** сэмплер 100 мс — `.con-terracere` (или новый корень) up / HUD opacity / чипы параметров HUD / `con-board--pfocus*` классы / бокс `.con-board__stage` (должен быть ОДИНАКОВ в фокусе,
   на возврате и в покое — закон дока) / кегли титула; хронометраж — по сэмплеру, не по кадрам.

## 1. Сервер — карта (≈ 12 %)
1. `src/server/cards/turmoilRedux/BackroomDeal.ts` — `Card` (EVENT), заголовок = чтение скана + правила 1–11; константы `TR_LOST = 1`, `DISCOUNT = 10`; `tags: []`; `behavior: {tr: -1}` (с логом —
   правило 3); `cardDiscount: {amount: DISCOUNT, nextCardOnly: true}`; `partyRequirementWaiver: {nextCardOnly: true}` (новая co-located декларация — правило 6); `renderData` по скану; `description` слово в
   слово. `CardName.ts` (`BACKROOM_DEAL = 'Backroom Deal'` после `FLOATING_BIODOMES`, `:1138`), `TurmoilReduxCardManifest.ts` (после `:318`), `npm run make:cards`, `card_info.json` RU, `turmoil_redux_cards.json`,
   `lore_texts.json` ×2, арт.
2. **Вид `partyWaiver`** — `ICard.ts` (декларация рядом с `:267–277`), `Card.ts` (одна из `waive`-форм, `:136–139`), `Player.partyRequirementWaiver()` (по `lastCardPlayed` + `removedFromPlayCards`, как
   `:822–834`), крюк `PartyRequirement.satisfies`, журнал `recordRequirementEasing` (партия вместо параметра — расширить запись), `ArmedPlayEffectKind` + модели + читатели + прогноз (правило 6), `ServerModel`
   / `ModelUtils` — `requirementEasing` на картах руки с партийным требованием; спеки класса (TR49 `:125–321` — близнецы для партии).
3. Лог потери РТ (правило 3) — проверить объектную форму `tr` в Behavior; если формы нет — co-located лог.

## 2. Клиент — карта (≈ 3 %)
- Альбом / доступность / чип партии «снято» / цена с хвостом скидки / «Эффекты» взведённые (два от одного источника) / символ вида `once` / полёт взведения — правило 8; цена в РТ летит из ячейки РТ
  (правило 9 — `spendLinkSpecs` + `playSpendReward` учат `icon: 'tr'`; язык — сцена поколения TR61).

## 3. Клиент — ГЛАВНОЕ: «ПЛАНЕТА ПОКАЗЫВАЕТ» (≈ 85 %)
### 3.А «К ПЛАНЕТЕ И ОБРАТНО» (решения 5, 7, 8)
- Новый модуль сцены `console/terraformedScene/terraformedScene.ts` (по образцу `generationScene.ts`): фазы `idle → recede → focus → show → title → return`, поставщик холда `terraformed-scene` с `diagnose` /
  `expire`, детект в применении ответа (`gameTransport` — решение 11; транспорт ничего не рисует), ожидание `planetFocusBeatAllowed` (мир тих, история поля закончена), снимок контекста
  (что стояло над полем: кадр стека / «Информация» / альбом / сцена ревила / док) → парк опасити → `enterPlanetFocus({mode: 'ceremony'})` → такты → `beginPlanetFocusExit` → восстановление из снимка в ТУ ЖЕ
  позу → release холда = собственный сигнал завершения (конец возврата камеры), никогда таймер; пропуск — `finalize` одним кадром в конечное состояние (решение 8); reduced motion — без камеры.
- `ConsoleTerraformingCeremony.vue` — удалить (суррогат); его холд, регистрацию в детекторе утечек (`consoleLeakDetector.ts:116–121`), подавление тоста (`NotificationLayer.vue:338–345`), спек — перевести на
  сцену; HUD-пульс по nonce (`ConsoleStatusStrip.vue:521–531`) — остаётся, но синхронен такту 3.
- Бокс `.con-board__stage` одинаков в фокусе / на возврате / в покое (гард из `planet-focus.md` п. 5); ничего не меняется одним кадром (`polish-direction-smoothness`).

### 3.Б «ПЛАНЕТА ПОКАЗЫВАЕТ» (решения 6, 10)
- Режим камеры `ceremony` в `planetFocus.ts` / `ConsoleBoardSection.vue` (дуги остаются, фит тот же); такт шкал парка на фокусном кадре (`playPlanetFocusScaleBeat` — порядок: последний шаг — последним, с
  акцентом); дыхание атмосферы на реальном диске (новый слой над `.con-board__stage` в геометрии альфа-диска — не трогать `mars.webp`); залп `ceremonyFx` accent `terra` над диском; титульная плита в зоне
  протекания (`revealStageHead`-грамматика), лестница TV, строки ≥ пола, честная строка-утверждение (`celebrationFinal`).

### 3.В «ПОРЯДОК И ВРЕМЯ» (решения 9, 11)
- Очередь: история поля актора → сцена → анонс финала (PL-290 — сцена короче прежней церемонии; анонс не ждёт дольше, чем нужно) → остальное; у зрителя чужого хода — после такта чужого хода; соло и
  MarsBot — так же; вариант конца игры — по серверу; reload не переигрывает (nonce сеется тихо — как сейчас).

## 4. Лицо, локаль, лор, арт
`renderData` по чтению скана; `description` слово в слово; RU-кураторство `card_info.json` («Следующая карта, которую вы разыгрываете в этом поколении, игнорирует требования партии и стоит на 10 M€ меньше.
Потеряйте 1 РТ.» — формы `card_info.json:548` (TR49), `cards.json:627` (Indentured Workers)); строки «Требование партии» (перечёркнутое), титул сцены — существующие ключи «Terraforming complete» / «Mars is
terraformed» / «The current generation will be the last» переиспользовать; новые — английские (grep ДО), RU чужих не переписывать; лор / арт — решения 2–3.

## 5. Тесты
1. `tests/cards/turmoilRedux/BackroomDeal.spec.ts` — правила 1–11 (−1 РТ с логом, без налога Красных; взведение двух эффектов; следующая карта с партийным требованием играется при партии не у власти и 0
   делегатах; глобальное требование НЕ снимается; скидка 10 / пол 0 / тратится дешёвой картой; стандартный проект не тратит; пас гасит; TR70 поверх TR49 — замена; журнал оба события; модель —
   `armedPlayEffects` оба + `requirementEasing` на карте партии; save / load; чистота превью).
2. Гарды зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `effectExtraction`, `premiumCardViewModel`, `premiumCardIcons`, `effectForecastCoverage`, `countedPlayForecast`,
   `actionFutility`, `requirementProse` (TR70 без требования — проверить, что гард не просит строки), `readingParamsGuard`, `glyphLiteralGuard`, `e2eLiveness`, `consoleTvTypeFloor`; спеки класса TR49 — близнецы
   `partyWaiver` в `requirementEasing*.spec`, `armedPlayEffects*.spec`, `requirementEasingText.spec` (исчерпывающие свитчи), `cardAvailability.spec`, `unplayableReasonFormat.spec`.
3. Клиент (сцена): `terraformedScene.spec` (фазы; холд — `diagnose` / `expire`; детект с записи сервера; ожидание тишины мира; пропуск — конечное состояние; reduced motion; снимок / восстановление для
   каждого вида контекста — стек / «Информация» / альбом / ревил), `planetFocus.spec` (режим `ceremony` — дуги остаются, фит тот же, бокс сцены константен), `boardBeatPark` (такт шкал по запросу сцены),
   `terraformingCelebration.spec` (nonce — для HUD; вариантный конец — по серверу), `consoleMandatoryGate` (анонс финала после сцены).
4. e2e `tests/e2e/console-terraformed-scene.spec.ts` (fhd + tv4k): **A** с поля — сэмплер: HUD / рельсы / бар отступили (opacity), `con-board--pfocus*` вошёл, дуги видны, маркеры скользят к максимуму (последний —
   с акцентом), титул ≥ пола и ПОД диском, залп, возврат, бокс сцены одинаков в трёх состояниях, длительность ≤ 4,5 с по сэмплеру, ни одной покраски одним кадром (мутации по задачам); **B** поверх
   «Информации» — после сцены «Информация» стоит в том же снимке (зона, фокус, игрок); **C** поверх альбома руки — та же страница и карта в фокусе; **D** своё размещение — ревил бонусной карты стоял →
   сцена ждёт его, потом возвращает; **E** зритель чужого хода; **F** пропуск любой кнопкой — конечное состояние, HUD в золоте, контекст восстановлен; **G** анонс финала после сцены — не дольше прежнего
   (PL-290); **H** reduced motion; **I** reload после — сцена не переигрывается; **J** старый корень `.con-terracere` не монтируется ни кадром.
   e2e `tests/e2e/console-backroom-deal.spec.ts` (fhd + tv4k): розыгрыш (−1 РТ летит из ячейки РТ, журнал), альбом после — карта партии «доступна» с чипом «снято», цена «23 → 13 · 1×», «Информация › Эффекты»
   — два взведённых, розыгрыш следующей карты — оба потрачены, журнал.
5. Перевести в том же диффе: `console-endgame` (`:108` — путь через церемонию), `console-final-greenery*`, `console-planet-focus`, `console-board-framing`, `console-parliament-*` с терраформированием (grep
   `con-terracere`, «Марс терраформирован»), харнесс `consoleEndgameHarness` (`journeyToEndgame` — ждёт сцену / пропускает) — `npm run e2e:affected`.
6. `npm run build:test`, `npm run lint`; юниты — на тихой машине, последовательно.

## 6. Визуальная приёмка = РАСКАДРОВКА (чеклист §7; **4K первым**, GPU)
Кадры «до / после» в `screenshots/tr70/{fhd,tv4k,deck}/`: (а) раскадровка сцены с поля (≥ 16 кадров + сэмплер: уход → камера → маркеры → титул → залп → возврат); (б) поверх «Информации» и альбома —
до / во время / после (контекст тот же); (в) своё размещение с ревилом; (г) зритель чужого хода; (д) пропуск; (е) reduced motion; (ж) карта TR70 — композер с ценой РТ, альбом с «снято», цена с хвостом,
«Эффекты». Таблица хронометража (сэмплер) ДО / ПОСЛЕ — в реестре. Каждый кадр — своим глазом: «это та самая планета, на которой я играл, и я понимаю, что произошло, за один взгляд?»; три лучших макета
постановки (CSS поверх живого фокуса через `addStyleTag` + GIF из кадров) — в батч владельцу ПЕРВЫМ (§7.5).

## 7. ПОЛИРОВКА ПО ПУТИ
1. **PL-290** — анонс финала после сцены: замерить задержку ДО / ПОСЛЕ, записать.
2. **Цена в РТ летит** (правило 9) — класс для всех карт с `tr: -N` (корпорации Pristar / Terralabs / Midas — проверить кадром).
3. **Бэклог** `weak-visuals-backlog`: пункт «церемония „Марс терраформирован“» `DONE (TR70, PL-…)`; лобби / создатель — остаются; новые находки — пунктами.
4. **Доки** — `terraforming-progress-hud.md` (§ completion event → сцена), `planet-focus.md` (режим `ceremony`), `presentation-flow.md` (пример холда), новый `docs/claude/console/terraformed-scene.md`
   (контракт: такты, холд, снимок / восстановление, очередь, пропуск, гарды).

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — кадры 4K «до» своим стендом (три варианта + своё размещение) + сэмплер.
2. Порядок: карта + спек + вид `partyWaiver` → клиент карты → макеты постановки (3 варианта на живом фокусе) → А оболочка сцены (снимок / парк / камера / возврат / холд / пропуск) → Б постановка (такт
   шкал, дыхание, титул, залп) → В порядок и триггер с сервера → удаление суррогата → e2e → раскадровки «до / после» → реестр / доки. Каждый шаг — коммит по ханкам.
3. **Реестр:** footer на выдаче «Следующий свободный номер **PL-650**», последний раздел **BD** (TR69; сосед d1 ещё дописывает в BD — footer сдвигается); TR70 берёт раздел **BE** — букву и номера объявлять
   В МОМЕНТ записи по текущему footer.
4. Документы: `docs/TURMOIL_REDUX_BACKROOM_DEAL.md` (карта + § «ВИД `partyWaiver`» + § «ПЛАНЕТА ПОКАЗЫВАЕТ» — концепция, такты, хронометраж до / после, что не ломать, кадры) + `docs/claude/console/
   terraformed-scene.md` + правки доков §7.4 + закон в `.claude/rules/console-ui.md` («A CEREMONY PLAYS ON THE REAL OBJECT — «Mars is terraformed» takes the player TO THE PLANET: the surfaces recede, the
   planet-focus camera frames the real disc, the scales finish their own story, the title is a plate under the planet, and the player returns to the exact context; a cinematic never paints a stand-in over the
   game») + строка в чеклист §4 («эффект на один розыгрыш — ПАРТИЙНОЕ требование: вид `partyWaiver` …») + запись в журнале.
5. Отчёт владельцу: первой строкой — арт; затем раскадровка 4K «до / после» сцены с поля и поверх «Информации», таблица хронометража, решения 1–11 с тем, что сделано по умолчанию, ОДИН батч
   `AskUserQuestion` (решения 5, 6 (с макетами), 7, 8 — рекомендация первой; 1–4, 9–11 — в отчёте по умолчанию), гэпы честно.
6. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Рисовать планету-суррогат или любой новый полноэкранный слой поверх игры; показывать сцену, не убрав поверхности над полем; `display: none` на поле или на паркуемых поверхностях (только opacity /
  visibility — закон обзора финала и фокуса); менять бокс `.con-board__stage`; стартовать сцену, пока идёт история поля или летят карты; возвращать игрока не туда, где он был.
- `setTimeout` вместо холда с собственным сигналом; снимать холд раньше конца возврата; держать анонс финала дольше сцены; менять что-либо одним кадром вне пропуска; длительность > 4,5 с (решение 7);
  титул поверх диска; текст ниже пола TV; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); состояние только цветом.
- Определять триггер по тексту объявления (структурный маркер: `game.isTerraformed` / тип события `announcement` с идентификатором, не строка); оставлять старый корень `.con-terracere` смонтированным;
  снимать глобальные требования видом `partyWaiver` или наоборот; складывать два взведённых источника; писать потерю РТ без строки журнала.
- Трогать разбор хода бота (реворк — вне полировок); файлы соседей (стол, финал-подиум) и их незакоммиченные правки; переписывать RU чужих ключей; ломать селекторы стендов без перевода в том же диффе;
  полный regen фикстур; `git stash`; bare `git push`.
