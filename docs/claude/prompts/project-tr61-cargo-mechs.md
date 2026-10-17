# Промт исполнителю · TR61 Cargo Mechs («Грузовые мехи») — синяя, 7, метка Строительства, плашка ИНДУСТРИАЛИСТОВ, держатель МЕХОВ: «1 энергия → мех на ЛЮБУЮ карту ИЛИ 1 мех отсюда → ПОВТОРИТЬ действие своей карты в этом поколении» — повтор ТОЛЬКО через общий механизм Viron (сервер `repeatableActionCards` + консольный мост `consoleRepeatPick`), пятый потребитель, не пятый интерфейс · ГЛАВНОЕ — ИТЕРАЦИЯ «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»: доход фазы производства становится СОБЫТИЕМ (журнал · статистика · финал), смена поколения на консоли — ОДНА сцена (флип счётчика → доход стекает по рельсу → энергия в тепло → покупка карт поднимается из той же сцены), покупка карт между поколениями — ОДНА поверхность (соло без драфта сегодня идёт на отдельную плиту, а не в workspace драфта) в масштабе 4K

Выдан 2026-10-17. Инфраструктура набора стоит (TR01–TR60, TR66, TR67 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строки «ДЕРЖАТЕЛЬ с `or`-ДЕЙСТВИЕМ „купи ресурс ИЛИ потрать его на товар“» (TR40), «N ресурса на ЛЮБУЮ карту» (TR56 / TR43),
«требование ПАРТИИ» (TR15); постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Премиум-планка»**; **«Качество полировки»**), журнал — `docs/claude/turmoil-redux-cards-progress.md`,
реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,console-ui,animations,tests,localization}.md`. **Главные контракты итерации:** CLAUDE.md «A WORKSPACE IS ONE FLOW»
(п. 3 — переход = та же фраза на уровень глубже; `v-if`-подмена = моргание) и «Logging» («a direct field mutation bypasses the event recorder: go through `stock.add` / `production.add` / the recorder helpers»),
инварианты 1 (никогда по тексту), 4 (никакой немой потери), 6 (одна система движения; критическая анимация регистрирует animation hold, release — собственный сигнал завершения, никогда `setTimeout`), 7 (только
чтение), 9 (английский текст = ключ i18n), 10 (транспорт ничего не рисует); `docs/claude/notifications.md` (CONSUMER UPDATE BOUNDARIES; строки 159–160 и 549 — «production phase records no events … pre-existing
frontier» — ЭТА итерация закрывает фронтир), `docs/claude/terraforming-progress-hud.md:6` («the HUD tick IS the announcement» — остаётся первым тактом сцены, тост НЕ возвращать), `docs/claude/energy-heat-conversion.md`,
`docs/CONSOLE_MODE_CONCEPT.md:1061–1067` (конверсия энергии — ШЛЮЗ перед исследованием), `docs/claude/journal.md`, `docs/EVENT_STAT_FOUNDATION.md`, `docs/ENDGAME_STORYTELLING.md`; для повтора —
`.claude/rules/console-ui.md:278` (⚠ `v-show` FIRES the enter/leave pair — мост выбора; `pickBridgeActive` → `setPickSuppressed`), `docs/claude/console/workspace-band.md:213–226, 860, 1323` (клейм исхода
Viron-повтора из превью ВЫБРАННОЙ карты; вложенный композер только каптит; в общий слот пишет только владелец), `docs/claude/console/unavailability-reasons.md:305–340` (repeat-mode twin),
`docs/claude/prompts/resolution-rx26-repeat-pick-fix.md` (образец «четвёртый потребитель, не четвёртый интерфейс»). Память: `console-repeat-pick-bridge` (⚠ «называя „сделай как Viron“, называть И серверный
механизм, И поверхность»), `polish-area-premium-visual-first`, `weak-visuals-backlog`, `polish-premium-bar`, `polish-priority-tv4k-no-deck-only`, `polish-direction-smoothness`, `storyboard-catches-what-the-probe-passes`,
`bot-turn-review-out-of-polish-scope` (разбор хода бота — ВНЕ полировок, владелец 2026-10-17), `animation-hold-registry`, `presentation-flow-orchestrator`, `event-stat-economic-foundation`, `journal-gain-via-stock-add`,
`tr58-cursor-living-object`, `console-hand-album` (масштаб карты альбома — эталон), `concurrent-session-edits-same-files`, `e2e-fixture-generator-gotchas`, `shell-template-escapes`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-17), по смыслу дословно:** «суть — повтор синего действия; надо сделать так же бесшовно, как уже сделано для корпорации Viron (переиспользовать общий механизм). И отдельно выбрать
новую область для глубокой итерации полировок — интересна область, где реально нужны визуальные улучшения; изучи вопрос и подготовь качественный промт». Отдельно: «разбор хода бота — там нужен реворк, пока не
включаем его в скоуп полировок».

**ОБЛАСТЬ ПОЛИРОВКИ ВЫБРАНА ПРИ ПОДГОТОВКЕ.** Метод — память `polish-area-premium-visual-first`: свежий обход 4K (GPU) экранов, которых прошлые обходы (TR60, TR67) не касались: маршрут повтора Viron (W1),
конец поколения в соло — пас → производство → покупка (W2), заявка достижения и спонсорство награды (W3). Маршрут Viron — на планке (крошка непрерывна, слот повтора, список в режиме «ПОВТОР ДЕЙСТВИЯ», A =
«Выбрать»); церемонии вехи / награды — на планке (герой скользит из своего гнезда в центр — один физический объект; быстрые кадры стенда — артефакт съёмки, не дефект). **Хуже всего — СМЕНА ПОКОЛЕНИЯ:** момент,
который наступает КАЖДОЕ поколение у КАЖДОГО игрока и который у премиальной игры — такт (доход!), на консоли сегодня — ничто: цифры рельса меняются чипами `+N`, через секунду стоит плита покупки; доход не
записан ни журналом, ни статистикой; а покупка в соло без драфта и покупка в партии с драфтом — ДВЕ РАЗНЫЕ поверхности.
Итерация (≈ 85 %): **А. «ДОХОД — СОБЫТИЕ»** — фаза производства через рекордер; журнал · статистика · финал (≈ 25 %); **Б. «ОДНА СЦЕНА»** — смена поколения на консоли: флип счётчика → доход стекает по
рельсу → энергия в тепло → покупка поднимается из сцены (≈ 35 %); **В. «ОДНА ПОКУПКА»** — соло / без драфта идёт в стадию покупки workspace драфта (≈ 15 %); **Г. «ПОКУПКА В МАСШТАБЕ 4K»** — композиция
стадии покупки (≈ 10 %). Карта (≈ 15 %) — бесподобная `canAct` / `action()` из ДВУХ известных механизмов + гард от зацикливания.

## ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (кадры и код — на `b69f649d91`; к моменту выдачи HEAD = `3750e54bdc` — TR67 сдана и закоммичена (сервер `a2ca83ee09`, клиент + e2e `948acc1174`, доки `3750e54bdc`),
дерево чистое; TR67 изменила правую колонку поля (`cellDossier.ts`, `console_cell_dossier.less`) — маршрут TR61 её не касается; кадры 4K GPU — `screenshots/tr61/tv4k/*.png`, листы `screenshots/tr61/sheet-w{1,2,3}-*.jpg`; стенд подготовки — `screenshots/tr61/walk.stand.spec.ts` (вне git); файл:строка подтвердить на своём HEAD)

**Смена поколения в соло (W2, листы `sheet-w2-00…08.jpg`):** пас → «Пас до следующего поколения» (плита подтверждения, `ConsoleActionConfirm.vue:108–111`, список «Ещё доступно в этом поколении» `:67–73`) →
A → кадр +0,5 с: рельс уже с новыми числами и чипами `+500` (энергия 500 → 0, тепло 500 → 1000 — конверсия), «ПКЛ. 1» → «2» флипом → кадр +1,5 с: уже стоит «ПОКУПКА · Выберите карты для покупки». Между ними —
НИЧЕГО: ни такта «поколение N», ни строки дохода, ни полёта от производства к запасу. Покупка: плита `xl` (`ConsoleTaskHost.vue:1023–1026`; `--con-prompt-w-xl` 78rem / **92rem на TV** — `console_prompt.less:62, 88`),
четыре карты ≈ 330 × 470 px в полосе 3358 px (ряд ≈ 40 % ширины, ≈ 25 % высоты), под рядом — строка «Вереск · A Выбрать · X Осмотреть · RT Пропустить», ниже — пусто; «Выбрано 0/4 · Покупка −0 · У вас 515»
чипами; в альбоме руки (TR58) карта ≈ 520 px — покупка мельче альбома на том же экране.

1. **Доход фазы производства не существует для шареда.** `Player.finishProductionPhase` (`Player.ts:1055–1073`) пишет поля напрямую (`this.megaCredits += production + terraformRating; this.steel += …`) — мимо
   рекордера (закон CLAUDE.md «Logging»); тип события `'production-phase-income'` ОБЪЯВЛЕН (`GameEvent.ts:198`), но нигде не эмитится; `EventSource {kind: 'production'}` есть (`EventSource.ts:87`); рекордер не знает
   ни фазы, ни поколения; `JournalActionCategory` (`GameEvent.ts:242–258`) без категории производства. Следствия: в журнале поколение — только разделитель «Generation N» (`Game.ts:1348` `forNewGeneration`;
   `JournalEntry.vue:37, 65`; в консоли нефокусируемый — `ConsoleJournalPanel.vue:328–331`), в статистике дохода по поколениям нет, финал не может рассказать «экономику партии». Док признаёт фронтир:
   `notifications.md:159–160` («production phase records no events … pre-existing frontier»), `:549`.
2. **Смена поколения на консоли — не сцена.** Тост «Поколение N» подавлен сознательно (`NotificationLayer.vue:384–389`, `terraforming-progress-hud.md:6` — «the HUD tick IS the announcement»; счётчик
   `ConsoleStatusStrip.vue:136–147` — флип без чипа); `presentationFlow.ts` / `presentationPolicy.ts` — ни сцены поколения, ни дохода; чипы `+N` рельса — обычные дельты `AnimatedMetricValue.vue:58–69` (запас 2240 мс,
   производство 1890); конверсия энергии в тепло — отдельный шлюз перед исследованием (`gameTransport.ts:1089, 1161–1176`, `transportHolds.conversion`; `energyConversionModel.ts:51–65` 1200–2200 мс; только при
   энергии > 0). Итог: единственный «доход» игры показан тем же языком, что любая мелкая дельта, а три такта конца поколения (флип · доход · конверсия) не связаны в одну фразу.
3. **Две покупки.** В партии с драфтом покупка — стадия `--buy` workspace драфта (`ConsoleDraftWorkspace.vue:149`; финансовая полоса `:51–72`; шельф «ОТОБРАНО» `:277–316`; «ГОТОВО» `armDoneBeat` `:1543–1564`;
   сцена подъёма `ConsoleTaskHost.vue:2690–2720` + `cardDeal/consoleDraftTray.ts`; 5 карт в ряд `:451`; фит `wsStageLayout` `:1790–1824`). В соло / без драфта она туда НЕ попадает: гейт `betweenGenDraftLive`
   требует `draftVariant === true` (`console/draft/consoleDraftFlow.ts:110–120`), маршрут `buyMode` → `{cardSelect, mode: 'buy'}` (`consoleTaskRouter.ts:782–786`) обслуживает отдельный `ConsoleTaskHost`
   (кикер «Purchase» `consoleTaskSummary.ts:380–381`), без обязательной плиты (`consoleMandatoryGate.ts:224–230`), сдача карт через `motionMs(260)` (`ConsoleTaskHost.vue:2640–2662`), ряд — `fitRowZoom`
   (`:3146–3151`, `cardStripFit.ts:39–43`, зажим 0,5…1,6·ui), > 6 карт — сетка (`:1886`); TV-правок у `.con-draftws` нет (`console_tv.less:648` — только комментарий; стили `console.less:3252–3356`).
   Один и тот же вопрос игрока — две разные поверхности, два разных масштаба, две разные крошки.
4. **Хорошее, НЕ ломать:** workspace драфта (сцена подъёма, шельф, финансовая полоса, «ГОТОВО», полёт купленных в док — e2e `console-draft-workspace` на 4K `:240`); шлюз конверсии энергии (его порядок и
   холд); флип счётчика поколения (он — ПЕРВЫЙ такт сцены, не замена ей); плита паса (`ConsoleActionConfirm`, список «ещё доступно» — PL-400); закон «тост поколения не возвращается».
5. **Маршрут Viron (W1, `sheet-w1-00…03.jpg`) — образец для TR61:** «ДЕЙСТВИЯ КАРТ › VIRON › НАСТРОЙКА» со слотом «ДЕЙСТВИЕ ДЛЯ ПОВТОРА · Выберите действие для повтора…» → `enterConsoleRepeatPick` → тот же
   `ConsoleCardActions` в режиме repeat («› ПОВТОР ДЕЙСТВИЯ», A = «Выбрать») → композер кандидата «Выбрать это действие» → слот заполнен графикой действия + именем → «Подтвердить выполнение» → коммит. Крошка
   непрерывна, исходный композер возвращается окрашенным. TR61 обязан пройти ЭТУ дорогу как ветка B своего композера.
6. **Вне полировок (владелец):** разбор хода бота (W4 — снят, не разбирался). Мелочь в бэклог: во время церемонии вехи рельс сцены читает ЖИВОЙ item и показывает «Получено игроком player1» под героем, пока
   сцена говорит «ДОСТИЖЕНИЕ ПОЛУЧЕНО» (`ConsoleMaFocusStage.vue:309–319`, `consoleMaRail.ts:89–96`) — два голоса об одном.

## Обязательное чтение до кода
`src/server/Player.ts:1023–1073` (`runProductionPhase` / `finishProductionPhase`), `Game.ts:1140–1221, 1326–1365` (`gotoProductionPhase` → `postProductionPhase` → `startGeneration`), `src/server/events/EventRecorder.ts`
(`withEffectSource`, `recordResourceDelta`, скоупы), `src/common/events/{GameEvent,EventSource,aggregate}.ts`, `src/common/events/endgameFacts.ts`, `src/client/console/{presentationFlow,presentationPolicy}.ts`,
`console/transport/gameTransport.ts:1080–1270` (шлюз конверсии — образец шлюза сцены), `src/client/console/energyConversionModel.ts`, `components/console/{ConsoleStatusStrip,ConsoleResourcePanel,ConsoleTaskHost}.vue`,
`console/draft/consoleDraftFlow.ts`, `components/console/draft/ConsoleDraftWorkspace.vue`, `cardDeal/consoleDraftTray.ts`, `consoleTaskRouter.ts:760–800`, `consoleMandatoryGate.ts:200–240`, `journalView.ts`,
`notificationModel.ts:940–970`; спеки `tests/e2e/console-draft-workspace.spec.ts`, `draft-finale-probe.spec.ts`, `tests/events/*`, `tests/client/components/console/{presentationFlow,energyConversion}*.spec.ts`.
Повтор: `src/server/cards/repeatableActions.ts` (четыре условия), `venusNext/Viron.ts`, `promo/ProjectInspection.ts`, `parliament/resolutions/scientists/RdFunding.ts:95–135`, `EventRecorder.ts:560–589`
(`withCopiedAction` / `withCopiedActionFrom`), `community/Playwrights.ts:47, 104–134` (`getCheckLoops` — гард зацикливания), `turmoilRedux/censusAction.ts:186–251` (бесподобный `OrOptions` + `orBranches`),
`turmoilRedux/SpaceshipRecycling.ts:140–228` (ветка «мех на ЛЮБУЮ карту» бесподобно — `AddResourcesToCard` + `addToCardStep`), `actionPreviews.ts:376, 1055–1130, 1554–1583` (`addToCardStep`, `selectCardStep
{repeatAction}`, `orBranches`), `src/client/console/consoleRepeatPick.ts` (шапка, `:37–59, 96–129, 156–172`), `components/console/ConsoleActionComposer.vue:452–470` (слот), `:1762` (`repeatChoice` — ищется в
выбранной ветке → слот внутри ветки B работает), `:4372–4391` (потребитель Viron), `ConsoleCardActions.vue:330–341, 963–968` (режим repeat), `consoleActionComposer.ts:504–539` (`repeatActionResponses` —
батч `[activate, (or-pick), …steps, {card:[chosen]}, …composed]`); спеки `tests/cards/venusNext/Viron.spec.ts`, `tests/client/components/console/{consoleRepeatPick,consoleRepeatPickFrame}.spec.ts`, e2e
`console-repeat-pick`, `console-viron-repeat-draw`, `console-repeat-reveal-embed`. Карта: `turmoilRedux/ForestryMechs.ts` (TR40 — A того же вида), `MarsArmyMechs.ts` (TR34 — A/B бесподобно через модуль),
последняя запись журнала (TR67 — формат).

## Что это за карта
**Скан:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR61.png`. Правила набора — `…\TM Turmoil Redux\Turmoil Redux Rules.pdf` (текст — `C:/tmp/redux-rules.txt`).
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR61.png` **ЕСТЬ** — импортировать конвейером набора (кредит на скане — Ken Le Bras).
**Синяя (ACTIVE), 7 M€, метка Строительства, плашка MIN = эмблема Индустриалистов, ресурс — МЕХ, без ПО, без блока розыгрыша.**

### Чтение скана
Синяя рамка; цена **7**; оранжевая MIN-плашка с эмблемой Индустриалистов — ТРЕБОВАНИЕ, не метка. Одна метка — Строительство (коричневый диск с домом). Заголовок «CARGO MECHS». ДВА ряда действия: «[энергия] →
[мех]* OR» (звёздочка — на ЛЮБУЮ карту) / «[мех] → [плашка ACTION] →» (печатный «повтор действия» — `b.replayAction()`, `CardRenderItemType.ACTION_REPLAY`, спрайт `action-replay.svg`; так печатает Project
Inspection); текст: «(Action: Pay 1 energy to add a mech resource to ANY card, OR spend 1 mech from here to use an action on one of your cards a second time this generation.)». Низ: «(Requires the Industrialists to be
ruling or that you have 2 delegates there.)» — розыгрыш ничего не даёт. Значка ПО нет. Фиолетовый ромб — символ модуля, без `compatibility`. Лор: «"Too late! I'm forklift-certified!"». Номер TR61.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/CargoMechs.spec.ts`)
1. **Требование** — плашка Индустриалистов (класс TR15): правят, или 2 СВОИХ делегата на их резолюции; при РОЗЫГРЫШЕ; действие — при любой правящей партии; TR36 порог требования не снижает.
2. **Розыгрыш** — ничего (`behavior` нет); карта — пустой держатель мехов.
3. **A — «1 энергия → мех на ЛЮБУЮ карту»**: цена `spend.energy: 1`; цель — любой СВОЙ держатель мехов, ЭТА КАРТА ВКЛЮЧИТЕЛЬНО (`AddResourcesToCard.holders` её не исключает — так наполняется топливо B);
   цель предвыбрана в композере (шаг «КУДА», TR56) и никогда не выбрана за игрока (один держатель — всё равно вопрос, инвариант 3); без энергии — причина `notEnoughEnergy()` классом.
4. **B — «1 мех отсюда → повторить действие своей карты»** — МЕХАНИЗМ VIRON СЛОВО В СЛОВО: кандидаты — `repeatableActionCards(player, this)` (четыре условия модуля: не сама карта, есть действие, не ловушка
   петли, использована в этом поколении И может действовать сейчас); `SelectCard('Perform again an action from a played card', 'Take action', cards).markRepeatActionPrompt()` (маркер — структурное опознание, как у
   RX26); `andThen` — лог `'${0} used ${1} action with ${2}'` (ключ Viron) + `card.action(player)` ВНУТРИ `events.withCopiedAction(player, this, card, run)`; мех списывается как ЦЕНА ветки до повтора
   (`removeResourceFrom`, с логом и `from: {card}`); оба мертвы — причины в объявленном порядке (A первым: энергия); B без мехов — класс PL-197 «0 из 1 меха на этой карте» (`RESOURCES_HERE_SHORT[MECH]`);
   B без кандидата — `ruleReason('No other action card to copy')` (ключ Viron).
5. **Карта не повторяет САМУ СЕБЯ** (как Viron, условие 1 модуля) — иначе петля «мех → повтор A → мех…»; повтор — раз за поколение (действие синей карты).
6. **⚠ ГАРД ЗАЦИКЛИВАНИЯ:** `Viron.canAct` → `repeatableActionCards(player, Viron)` → `TR61.canAct` → `repeatableActionCards(player, TR61)` → `Viron.canAct` → … — бесконечно, когда обе использованы в одном
   поколении (`Viron.ts:38` считает список ДО своей проверки использования). TR61 реализует `IHasCheckLoops` (`getCheckLoops`, счётчик `++` / `--` в `try/finally` вокруг списка — `Playwrights.ts:47, 104–134`);
   спек: стол Viron + TR61, обе использованы — `canAct` обеих завершается, кандидаты честны. Ту же защиту — проверить у Viron (он копирует TR61) — если нужна, добавить СИММЕТРИЧНО и закрепить спеком
   `Viron.spec.ts`; Project Inspection (событие) и RX26 (закон) списку не мешают.
7. **Атрибуция повтора:** скоуп `copied-action` — всё, что произвёл повтор, приписано TR61 → копируемой карте (цепочка в журнале «выполнил действие ‹карта› с помощью Грузовых мехов»); нотификации — «Скопированное
   действие» (`notificationModel.ts:60, 109`); статистика — как у Viron.
8. **Превью = исполнение**: `actionPreview` — `orBranches(this, [A, B])`: A — `stockCost(energy 1)` + `cardResourceGain(MECH, 1)` + `steps: [addToCardStep(player, MECH, {count: 1, cause: cardSource(this)})]`;
   B — `cardCost(this, 1)` + `steps: [selectCardStep(player, 'Perform again an action from a played card', 'Take action', cards, {repeatAction: true})]` (как у Viron, `Viron.ts:48–54`), `unavailableReason` по правилу 4;
   `autoResolveSingle` по умолчанию; гард `actionBranchPrinted` режет два печатных ряда на две ветки; `cardPlayPreviewCoverage` / `actionFutility` зелёные (повтор и мех — не бесполезны).
9. **Роль держателя** — решение 5: B платит не «простой товар», а ПОВТОР; `holderActionGood.ts` не выведет роли (бесподобное действие без `holderActionGood`) → спутник ДОП. РЕСУРСЫ сказал бы «хранилище».
10. **Мехи с других карт:** TR56 Robotics Factory кладёт 3 меха СЮДА (адрес), TR29 / Vesta — как у всех держателей; EVA / Construction Mechs не платят этими мехами; Mech Sports их не считает. Метка Строительства —
    Construction Mechs оплачивает розыгрыш мехами (единица `constructionMechs`).
11. **MarsBot** карту не играет; save / load — обычная карта (мехи, флаг действия, `checkLoops` НЕ сериализуется — транзиентный); превью чисты.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **Имя RU** — «Грузовые мехи» (коллизий нет — grep `Грузов` по `src/locales/ru`). Альтернатива «Мехи-погрузчики».
2. **Лор** — EN слово в слово (ключ `TR61`); RU: «Поздно! У меня есть права на погрузчик!»
3. **Арт** — файл есть: импорт (Ken Le Bras); первая строка отчёта — «арт импортирован».
4. **Самоповтор** — (а, рекомендовано) запрещён (условие 1 модуля, как у Viron; петля невозможна по построению); (б) разрешить — только если владелец трактует «one of your cards» буквально (тогда гард петли
   обязателен вдвойне).
5. **Роль держателя** — (а, рекомендовано) новый вид товара `{kind: 'repeat'}` в `ActionGood` («мех → повтор действия»: спутник ДОП. РЕСУРСЫ и шаг цели TR56 говорят, на что идут мехи), объявлен картой через
   `ICard.holderActionGood = {spend: 1, good: {kind: 'repeat'}}` (дверь К-R1, TR46), чтение в одном помощнике рядом с `actionGoodsOf`, строка в чеклист §4; (б) хранилище — честный гэп в доке карты.
6. **Сцена поколения (часть Б)** — (а, рекомендовано) ОДНА сцена: флип «ПКЛ.» (существующий — первый такт) → ДОХОД стекает по рельсу (из бейджа производства в число запаса, строка за строкой; РТ → M€ из ячейки
   РТ; счётчики тикают на касании — язык PL-099) → конверсия энергии в тепло (существующий шлюз — ВНУТРИ сцены, тем же холдом) → покупка поднимается из сцены (сцена подъёма workspace драфта); у соперников и
   бота — та же сцена своей дельтой (их доход — их рельс при LB/RB? нет: только СВОЙ рельс; чужой доход — журнал); (б) только доход как событие + короткий такт «ПОКОЛЕНИЕ N» без полёта.
7. **Одна покупка (часть В)** — (а, рекомендовано) покупка ВСЕГДА — стадия `--buy` workspace драфта (гейт по фазе `RESEARCH` + `needsToResearch` + `generation ≥ 2`, с драфтом и без); отдельная плита `cardSelect
   buy` остаётся только для покупок ВНУТРИ действий (Business Network и т. п. — PL-294); (б) оставить две поверхности, отдельную плиту переверстать под 4K.
8. **Доход в шареде (часть А)** — (а, рекомендовано) полная: событие `production-phase-income` под скоупом фазы с `EventSource {kind: 'production'}` через `stock.add` (строка на ресурс + РТ → M€ как отдельная
   причина + конверсия как её собственное событие), категория журнала «Производство» (группа «Поколение N»), агрегаты «доход за поколение» (`aggregate.ts`), факт финала «экономика: доход по поколениям»
   (`endgameFacts.ts`), нотификации — НЕТ (сцена — объявление; политика `notificationContentPolicy` — явное исключение с причиной); (б) только журнал.
9. **Масштаб покупки на 4K (часть Г)** — (а, рекомендовано) карта — масштаб альбома руки (TR58 — эталон 4K), ряд ≥ трети высоты полосы, финансовая полоса ≥ пола TV, пустота стадии ≤ трети; (б) только
   токены TV без перекомпоновки.

## 0. Рабочее дерево
1. `git log --oneline -1` → `3750e54bdc` на выдаче (TR67 закоммичена, дерево чистое, соседних незакоммиченных правок нет). **Сначала** `ListAgents` + процессы playwright (память
   `pasted-prompt-author-may-still-run`) — если рядом жива сессия, `SendMessage` о порядке по `console-ui.md`, чеклисту §4, `console.less` / `console_tv.less`, `ConsoleShell.vue`; её файлы не трогать до её
   коммита. Коммиты —
   ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
   ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки клиента — неиспользуемый импорт роняет `npm run build:client` всем сессиям.
2. Снапшот e2e — свой: `npm run e2e:snapshot tr61` + `TM_E2E_ROOT=.e2e-tr61`; кадры «до» — клиент HEAD в своём снапшоте (память `ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`, ANGLE d3d11 —
   `screenshots/tr61/pw.config.ts`). ⚠ Скриншот 4K длится до ~1 с — «кадры через 400 мс» стенда реально реже; хронометраж сцены — только пробником (`performance.now()` в странице), не по номерам кадров.
   Снапшот подготовки `.e2e-tr61prep` удалён.
3. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки. Нужны: (а) TR61 с мехом и использованным действием другой карты (кандидат есть) + Viron на столе (гард петли); (б) TR61 без мехов (B мёртв, A жив);
   (в) конец поколения — соло без драфта с производством всех видов (M€ · сталь · титан · растения · энергия > 0 · тепло) + РТ; (г) партия с драфтом (паритет покупки); (д) соло с 0 энергии (конверсии нет — сцена
   без такта). Пас по UI: колесо LT (Comma), слот «вниз», подтверждение A (`consoleQuickModel.ts:256`; образец — стенд подготовки `passOnUi`).

## 1. Сервер
### 1.А Карта (≈ 10 %)
1. `src/server/cards/turmoilRedux/CargoMechs.ts` — `Card` + `IActionCard` + `IHasCheckLoops` (ACTIVE), заголовок = чтение скана + правила 1–11; константы `ENERGY_PER_MECH = 1`, `MECHS_PER_REPEAT = 1`; титулы
   ветвей — экспорт (A — ключ `play_prompts.json`; B — ключ Viron «Perform again an action from a played card»); `requirements: {party: PartyName.INDUSTRIALISTS}`; `tags: [Tag.BUILDING]`; `resourceType:
   CardResource.MECH`; `canAct` / `actionUnavailableReason` / `action()` (`OrOptions(...).markChoiceContext(effectChoice(this))`, одна живая ветка — она и есть действие, образец `censusAction.ts:192–219`) /
   `actionPreview` (правило 8); `getCheckLoops` (правило 6); `renderData` по скану (`eb.energy(1).startAction.resource(MECH).asterix()`, `b.or()`, `eb.resource(MECH).startAction.replayAction()` — проверить печать
   против скана); `description` слово в слово. `CardName.ts` (`CARGO_MECHS = 'Cargo Mechs'` после `ENCELADEAN_INCUBATOR`, `:1135`), `TurmoilReduxCardManifest.ts` (после `:305`), `npm run make:cards`, `card_info.json`
   RU, `turmoil_redux_cards.json`, `lore_texts.json` ×2, арт.
2. Роль держателя (решение 5а): `holderRole.ts` — вид `repeat`; `holderActionGood.ts:34–43` — бесподобная карта объявляет сама; читатели — через помощник; спек `tests/cards/holderActionGood.spec.ts`.
3. Гидросеть держит СВОЮ копию списка (`DeltaProjectExpansion.getUsedActionCards` `:1515–1529`) — в §6 (полировка по пути), не в объёме карты.

### 1.Б «ДОХОД — СОБЫТИЕ» (часть А, решение 8)
- `finishProductionPhase` (`Player.ts:1055–1073`) — через рекордер: скоуп фазы (`beginAction`-семейство или новый `withProductionPhase(player, fn)`), каждая прибавка — `stock.add(..., {from: {kind: 'production'}})`
  (строка журнала на ресурс), РТ → M€ — отдельной причиной (`EventSource` «terraform rating» или поле события), `energyHeatConversion` — своё событие в том же скоупе (сегодня — только снапшот `:1041–1048`);
  `onProductionPhase` карт (Mons Insurance и пр.) — внутри скоупа, своими источниками. Эмитить `'production-phase-income'` (`GameEvent.ts:198`) как корневое событие группы «Поколение N · Производство» —
  с `correlationId`, как вехи / награды (`notifications.md:549` — прецедент «journal ROOT events»).
- `JournalActionCategory` — категория производства; `journalView.ts` — группа поколения (разделитель «Generation N» становится ГОЛОВОЙ группы, а не линией); `aggregate.ts` — доход за поколение по видам
  (чистая функция, тест); `endgameFacts.ts` — факт «экономика партии» (доход по поколениям — для `ENDGAME_STORYTELLING`); нотификации — НЕТ по политике (явное исключение с причиной в
  `notificationContentPolicy.ts`, не фильтр по тексту); десктоп — без изменений (тост «Поколение N» — как был).
- Инвариант 7: читатели не считают доход сами — только событие. Старые сейвы: группа отсутствует — честно (без синтеза).

## 2. Клиент — ГЛАВНОЕ: «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»
### 2.А «ОДНА СЦЕНА» (часть Б, решение 6)
- **Сцена поколения** — новая сцена `presentationFlow` с собственным holdом (`animation-hold-registry`), триггер — событие `production-phase-income` зрителя (не смена `generation` в модели — инвариант 1 / «cached by
  the server's own version»); порядок тактов: (1) флип «ПКЛ.» (существующий; сцена ЖДЁТ его, не дублирует), (2) доход — из бейджа производства КАЖДОЙ строки рельса ток/жетон в число запаса, строка за строкой
  сверху вниз, счётчик тикает на касании (PL-099; «цена уходит сперва» здесь не нужна — только приход), РТ → M€ — из ячейки РТ в строку M€ (одна фраза с остальными), (3) конверсия энергии в тепло — существующий
  шлюз (`transportHolds.conversion`) как ТРЕТИЙ такт той же сцены (один hold, один порядок, одна полоса ожидания), (4) покупка поднимается ИЗ сцены (подъём workspace драфта — `riseExtras`), крошка «ПОКУПКА» /
  «ДРАФТ» — своя; дельта-чипы `+N` рельса на время сцены НЕ рисуются (сцена и есть дельта; после сцены — базлайн переустановлен, как у конверсии `gameTransport.ts:1163–1166`).
- **Законы:** ничего не меняется одним кадром; длительность ограничена (бюджет ≤ ~2,5 с на 6 строк + конверсия; быстрый сервер не режет минимальный такт — dismiss ждёт settle); `prefers-reduced-motion` —
  снапы с теми же числами; WS/poll — промпт исследования ждёт сцену так же, как ждёт конверсию (транспорт ничего не рисует — инвариант 10; шлюз — hold); чужой ход / бот — сцена у ЗРИТЕЛЯ только о его рельсе;
  старые сейвы без события — сцены нет, покупка открывается как сегодня.
- **Пас** — плита подтверждения остаётся; после A — ожидание других игроков («ожидание» — существующая стадия `--wait` драфта / статус-полоса), сцена — когда сервер сменил поколение.

### 2.Б «ОДНА ПОКУПКА» (часть В, решение 7)
- `betweenGenDraftLive` → `betweenGenResearchLive`: `phase === RESEARCH && needsToResearch && generation ≥ 2` без `draftVariant`; `DRAFTING` — как сегодня; маршрут `buyMode` в `consoleTaskRouter.ts:782–786` —
  в workspace драфта, если живёт стадия между поколениями, иначе (покупка ВНУТРИ действия — Business Network, PL-294) — прежняя плита; обязательная плита — по закону PL-290 (первое предъявление — сразу).
- Стадия покупки без драфта: шельфа «ОТОБРАНО» нет (нечего отбирать) — стадия открывается сразу на покупке; финансовая полоса, RT «Купить», «ГОТОВО», полёт купленных в док, «Пропустить» — как в драфте.
- Паритет: e2e на одной партии с драфтом и без — одна разметка стадии покупки, одна крошка, один бар.

### 2.В «ПОКУПКА В МАСШТАБЕ 4K» (часть Г, решение 9)
- Карта — масштаб альбома руки (`console-hand-album`, TR58); ряд ≥ трети высоты полосы; 4 карты — не «пятая часть ширины»; финансовая полоса ≥ пола TV (`--con-t-floor`); TV-блок для `.con-draftws`
  (`console_tv.less:648` — сейчас пусто); пробник долей ДО / ПОСЛЕ (низ содержимого, чернила, доля героя) — таблица в реестре.

### 2.Г Карта TR61 на консоли (≈ 5 %)
- Композер действия TR61 — ДВЕ плитки-исхода (A «1 [энергия] → [мех]* на карту ‹КУДА›», B «1 [мех] → ПОВТОР»), в ветке B — слот «ДЕЙСТВИЕ ДЛЯ ПОВТОРА» (тот же `item.choice.repeatAction` — `ConsoleActionComposer.vue:452–470`,
  `repeatChoice` ищется в выбранной ветке `:1762`); выбор слота → `enterConsoleRepeatPick` (потребитель — как Viron `:4372–4391`); батч — `repeatActionResponses` с префиксом ветки
  (`[activate TR61, {or index B}, {card:[chosen]}, …composed]` — `consoleActionComposer.ts:504–539`); клейм исхода — из превью ВЫБРАННОЙ карты (`workspace-band.md:213–226`); коммит — универсальный ACTION COMMIT
  (мех уходит с карты в печатную плашку ACTION — PL-104 «вбок», результат — после). Ни одной новой поверхности; крошка `ДЕЙСТВИЯ КАРТ › ГРУЗОВЫЕ МЕХИ › ПОВТОР ДЕЙСТВИЯ`.

## 3. Лицо, локаль, лор, арт
`renderData` по чтению скана; `description` слово в слово; RU-кураторство `card_info.json` в форме TR54–TR60 («Требует, чтобы «Индустриалисты» были у власти или у вас было 2 делегата на их резолюции.»;
`infoText` `action-short` для B — «Spend 1 mech to repeat a used action», `tokens: ['action-replay']` — образец Project Inspection); лор / арт — решения 2–3; новые ключи журнала / категории / факта финала /
сцены — английские, grep ДО; RU чужих ключей не переписывать.

## 4. Тесты
1. `tests/cards/turmoilRedux/CargoMechs.spec.ts` — правила 1–11 (A на любую карту включая себя; B — Viron-кандидаты, маркер, скоуп `copied-action`, мех как цена; обе мертвы — порядок причин; гард петли с Viron
   в обе стороны; превью — две ветки с шагами; роль держателя; save / load; чистота превью).
2. Гарды зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `requirementProse`, `effectExtraction`, `premiumCardViewModel`, `premiumCardIcons`, `effectForecastCoverage`,
   `countedPlayForecast`, `actionFutility`, `actionBranchPrinted`, `actionBranchAvailability`, `resourcesHereReason`, `holderActionGood`, `readingParamsGuard`, `glyphLiteralGuard`, `e2eLiveness`,
   `consoleTvTypeFloor`, `crossPlayerCoverageGuard` / `consumerDeliverySequences` (новое событие — в корпус).
3. Шаред: спек рекордера (фаза производства — события по ресурсу, РТ → M€, конверсия, `onProductionPhase` карт в скоупе; старый сейв — без группы), `aggregate` (доход за поколение), `endgameFacts` (факт
   экономики), `journalView` (группа поколения), `notificationContentPolicy` (дохода — нет, с причиной); `Viron.spec` — гард петли.
4. Клиент: `presentationFlow` / сцена поколения (порядок тактов, hold, reduced motion, 0 энергии — без третьего такта, отсутствие события — без сцены), `consoleDraftFlow` (`betweenGenResearchLive`),
   `consoleTaskRouter` (покупка между поколениями → workspace; покупка внутри действия → плита), `consoleRepeatPick*` (пятый потребитель — слот в ветке B, батч с префиксом ветки).
5. e2e `tests/e2e/console-generation-scene.spec.ts` (fhd + tv4k): **A** соло без драфта — пас → сцена: флип, доход строка за строкой (пробник `performance.now()`: ни одного изменения числа без своего такта,
   чипов `+N` нет), конверсия третьим тактом, покупка поднимается из сцены в workspace драфта (`.con-draftws__stage--buy`), отдельная плита НЕ монтируется ни кадром (проба, как в `console-viron-repeat-draw`);
   **B** партия с драфтом — тот же workspace, паритет разметки; **C** 0 энергии — два такта; **D** reduced motion — снапы; **E** журнал — группа «Поколение N · Производство» с головой-событием.
   `tests/e2e/console-cargo-mechs.spec.ts` (fhd + tv4k): A с «КУДА» (включая себя), B через мост (крошка непрерывна, A = «Выбрать», исходный композер возвращается окрашенным — образец `console-repeat-pick`),
   коммит, журнал «с помощью Грузовых мехов», Viron + TR61 на одном столе — список честен.
6. Перевести в том же диффе: `console-draft-workspace`, `draft-finale-probe`, `console-repeat-pick`, `console-viron-repeat-draw`, `console-repeat-reveal-embed`, `console-hydro-repeat-*`, спеки, читающие
   `cardSelect buy` плиту между поколениями (grep `con-task--wide`, «Выберите карты для покупки», `buyMode`), журнал (`console-journal*`), финал (`console-endgame*` — новый факт) — `npm run e2e:affected`.
7. `npm run build:test`, `npm run lint`; юниты — на тихой машине, последовательно.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**, GPU)
Кадры «до / после» в `screenshots/tr61/{fhd,tv4k}/`: (а) раскадровка смены поколения в соло (≥ 10 кадров: плита паса → флип → доход построчно → конверсия → подъём покупки); (б) то же в партии с драфтом;
(в) 0 энергии; (г) стадия покупки — 4 карты на 4K (доли ДО / ПОСЛЕ); (д) журнал — группа поколения; (е) финал — факт экономики; (ж) TR61 — композер с двумя плитками, слот повтора пустой / заполненный, список
в режиме повтора, коммит; (з) Viron + TR61 на одном столе — список кандидатов. Каждый кадр — своим глазом: «понял ли игрок за один взгляд, что поколение сменилось и что он заработал?»; три лучших
предложения по сцене — РАСКАДРОВКОЙ (макет CSS поверх живой сцены через `addStyleTag` или GIF из кадров) в батч владельцу ПЕРВЫМ (§7.5).

## 6. ПОЛИРОВКА ПО ПУТИ
1. **Гидросеть — своя копия списка повторяемых** (`DeltaProjectExpansion.getUsedActionCards` `:1515–1529`) — перевести на `repeatableActionCards(player)` (без копира), если условия совпадают байт-в-байт; спеки
   гидро зелёные; иначе — в контракт как границу с причиной.
2. **Церемония вехи / награды — два голоса** (диагноз 6): рельс сцены читает живой item (`ConsoleMaFocusStage.vue:309–319`) — за коммитом рельс гасится или пинится к `heldView`; кадр до / после; маленький класс.
3. **Бэклог** `weak-visuals-backlog`: пункт «смена поколения» `DONE (TR61, PL-…)`, находки обхода — пунктами; «разбор хода бота» — пометка «реворк — вне полировок».
4. **Доки** — `notifications.md:159–160, 549` (фронтир закрыт — правило дохода), `terraforming-progress-hud.md:6` (флип — первый такт сцены), `energy-heat-conversion.md` / `CONSOLE_MODE_CONCEPT.md:1061–1067`
   (конверсия — такт сцены поколения), `docs/claude/journal.md` (группа поколения), `EVENT_STAT_FOUNDATION.md` (доход), `ENDGAME_STORYTELLING.md` (факт экономики).

## 7. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — кадры 4K «до» смены поколения (соло и драфт) своим стендом + хронометраж пробником.
2. Порядок: карта + спек + гард петли → роль держателя → А рекордер + журнал + агрегаты + финал → Б сцена (hold, такты, шлюз) → В одна покупка → Г масштаб 4K → клиент карты (слот в ветке B) → e2e → обход
   «до / после» → реестр / доки. Каждый шаг — коммит по ханкам.
3. **Реестр:** footer на выдаче «Следующий свободный номер **PL-599**», последний раздел **BA** (TR67, PL-582…598); TR61 берёт раздел **BB** — букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Документы: `docs/TURMOIL_REDUX_CARGO_MECHS.md` (карта + § «ПОВТОР — ПЯТЫЙ ПОТРЕБИТЕЛЬ» (сервер + мост, гард петли) + § «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА» (событие дохода, такты, шлюз, одна покупка, доли
   до / после, что не ломать, кадры)) + правки доков §6.4 + закон в `.claude/rules/console-ui.md` («THE GENERATION CHANGE IS ONE SCENE — the counter flips, the income flows from production to stock row by row,
   energy turns to heat, the research buy rises from the same scene; the income is an EVENT of the shared layer; the research buy between generations has ONE surface») + строка в `.claude/rules/server.md` (фаза
   производства — через рекордер) + строки в чеклист §4 («ДЕЙСТВИЕ-ПОВТОР — пятый потребитель `repeatableActionCards` + `consoleRepeatPick`, гард `IHasCheckLoops`»; «товар держателя `repeat`») + запись в журнале.
5. Отчёт владельцу: первой строкой — арт; затем раскадровка 4K «до / после» смены поколения (соло) и кадр покупки до / после, таблица долей, решения 1–9 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion`
   (решения 6 (с раскадровкой), 7, 8, 9 — рекомендация первой; 4, 5 — в отчёте по умолчанию), гэпы честно.
6. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 8. Нельзя
- Строить СВОЙ интерфейс повтора (строку, список, модалку) — только `enterConsoleRepeatPick`; определять повтор по тексту (только `repeatActionPrompt` / `repeatAction`); выполнять действие на вложенной
  поверхности (A там — «Выбрать»); вызывать `card.action` вне скоупа `withCopiedAction`; оставить `canAct` без гарда петли.
- Возвращать тост «Поколение N» в консоль; считать доход на клиенте (только событие с сервера); рисовать сцену из смены `generation` в модели; `setTimeout` вместо hold; менять число одним кадром; держать
  промпт исследования дольше сцены или открывать покупку ПОД сценой; ломать шлюз конверсии.
- Две поверхности покупки между поколениями; прокрутку в стадии покупки; шрифт ниже пола TV; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); состояние только цветом.
- Трогать разбор хода бота (реворк — вне полировок); трогать незакоммиченные файлы сессии TR67; переписывать RU чужих ключей; ломать селекторы стендов без перевода в том же диффе; полный regen фикстур;
  `git stash`; bare `git push`.
