# Промт исполнителю · TR53 Frontier Labs («Лаборатории фронтира») — синяя, 8, Наука + Здание, плашка Учёных: ДЕЙСТВИЕ «заплатите 5 M€, чтобы добавить ресурс НА КАРТУ, ГДЕ УЖЕ ЕСТЬ РЕСУРС; если это не научный ресурс — ещё и возьмите карту» · ГЛАВНОЕ — БОЛЬШАЯ ИТЕРАЦИЯ ПОЛИРОВКИ «РЕСУРС НА КАРТУ — ОДИН ПРЕМИУМ-СТАНДАРТ»: четыре кейса, по которым ресурс ложится на карту (розыгрыш · активация синего действия · ЖИВОЙ ПРОМТ «на какую карту» · ресурс с поля), приводятся к ОДНОЙ грамматике приёма — карта-получатель ВИДНА, ресурс ФИЗИЧЕСКИ летит из своего источника на её капсулу, счётчик тикает на касании, карта возвращается домой; сегодня в живом промте выбранная карта криво наклоняется и падает вниз, а ресурс не летит вовсе

> **СТАТУС (2026-10-15): СДАНО.** Контракт — `docs/TURMOIL_REDUX_FRONTIER_LABS.md`; журнал — `docs/claude/turmoil-redux-cards-progress.md` § TR53; реестр — раздел **AR** (PL-369, PL-410…430: буквы AO / AP / AQ к моменту записи заняты соседями). Батч владельца НЕ задавался (сессия продолжена после сжатия контекста без вопросов) — приняты рекомендации раздела «Решения владельца», каждая названа в контракте §0. Арт `Mars Arts/TR53.png` нашёлся и импортирован. Открыто: К-R7 (PL-425), К-R8 (PL-426), К-R9 (PL-427), PL-059.

Выдан 2026-10-15. Инфраструктура набора стоит (TR01–TR52, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md` (§0 «Новая механика? — сначала её инфраструктура сквозным контрактом, потом карта»; §4 — строки «ДЕЙСТВИЕ /
розыгрыш «N ресурса на ЛЮБУЮ карту»» (К-T1 — роль кандидата, PL-219 — метка исхода под каждым кандидатом), «N-й ДЕРЖАТЕЛЬ … (TR50)» (добор из действия
без выбора — PL-206 / PL-212); постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Бесшовность — workspace-архитектура»**;
**«Премиум-планка»**; **«Качество полировки»** — сильная рабочая концепция или откат, ОБА КОНЦА КАЖДОГО ПОЛЁТА ВИДИМЫ (закон PL-162), сданное
перепроверяется; **«Правило заимствованной поверхности»**), журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`,
правила — `.claude/rules/{game-logic,server,console-ui,animations,premium-card,tests}.md` (законы: **PHYSICAL CAUSALITY** — «карта всегда уходит из своего
реального источника; результат переживает поверхность; каждый полёт отвечает: откуда, зачем, куда», **THE ENDS OF A FLIGHT ARE VISIBLE** (PL-162 / PL-163 / PL-165
— отделённый полёт `detachCovered`), **ACTION COMMIT** (цена с рельса — отлёт PL-099 / PL-104; результат на карте композера — PL-162 / PL-328
`destinationOf`), **THE PROMPT-MODAL FAMILY** (2026-10-15 — одна плита `.con-prompt`, тон `gain`, глагол «Забрать»), **NO AUTO-SELECT** (инвариант 3),
**A BOARD BEAT WAITS FOR A BOARD THE PLAYER CAN SEE**, **A CARD PLAY'S RESULT BELONGS TO THE WORKSPACE** (EFFECT RESOLUTION — закон 24), **THE COLONY
RESOLUTION** («бонус, за который игрок не торговал, — своя композиция `intent: 'bonus'`»)), контракты — `docs/TURMOIL_REDUX_ARBORETUM.md` §4 (сцена
«ГОРОДА ПЛАТЯТ»: RISE · PAY · READ · RETURN — карта-получатель выходит ИЗ ячейки спутника к полю и возвращается), `docs/TURMOIL_REDUX_RED_MUSEUM.md` §4 («тайл
платит карте», ОДИН писатель `tilePayout.ts`), `docs/claude/console/{play-card-result.md, played-target-self.md, card-bonus-payout-concurrency.md,
ares-adjacency-flights.md, colony-focus-stage.md §6b, colony-resolution.md, prompt-modal-family.md, prompt-admission.md, task-summary-copy-contract.md,
effect-forecast.md, workspace-band.md § ACTION COMMIT}`, `docs/COLONY_TRADE_FLOW.md`, `docs/TURMOIL_REDUX_EVA_MECHS.md` §8 (смыслы держателей). Память:
`polish-remediation-iteration-1` (PL-162 закон видимости концов, PL-163, PL-165 отделённый полёт), `expedition-mechs` (TR50 — добор из действия без выбора,
PL-219 метка под кандидатом, PL-222 передача «щелчком»), `tr49-one-play-class` (гочи A/B и staged), `flip-anchor-is-the-object`, `handoff-waits-on-the-animation-clock`,
`fixed-layer-is-a-stacking-context`, `polish-premium-bar`, `polish-quality-no-regressions`, `storyboard-catches-what-the-probe-passes`,
`perf-measure-on-gpu-not-swiftshader`, `concurrent-session-edits-same-files`, `ab-baseline-head-client-in-snapshot`.

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-15, дословно):** «Как отдельная большая итерация полировок я хочу, чтобы агент взял в работу кейс, когда игроку идёт промт, на
какую карту ложить ресурс (например от бонуса размещения Ares или когда на «Титане» с его колонии поторговали) — тут надо хорошо проработать. В других
местах у нас уже сделано более премиально, например при розыгрыше или когда ресурс кладётся активацией синим действием — карта, куда кладётся ресурс,
«взлетает» из своей мини-зоны «разыграно» и на неё физически летит ресурс — это сделано хорошо (хотя надо перепроверить, что при активации синих действий это
так же хорошо проработано, как и при розыгрыше карт). Но в промтах (от бонуса размещения Ares, когда на «Титане» поторговали — и во всех подобных кейсах) это
совсем не проработано визуально: игрок просто выбирает карту, и она как-то «криво» и непремиально наклоняется набок и просто падает внизу — никаких ресурсов,
что он реально приземляется на карту, не видно, и сама сцена совершенно не проработана. Надо хорошо продумать концепцию и реализовать — это не маленькая
доработка, это должна быть реальная большая итерация про доработку кейсов, когда мы кладём ресурсы, и приведение к единому премиум-стандарту во всех
местах (розыгрыш карт, активация синих действий, выбор через промт, или просто когда ресурс летит с доски). Последний кейс, когда ресурс летит с доски, тоже в
последних полировках был доработан: прямо на доске появляется мини-карта, принимающая ресурс, — это сделано хорошо, но надо ещё доработать, и как будто бы
это сейчас срабатывает не во всех кейсах — тоже проверить и доработать в рамках этой итерации.»
Четыре требования: **(1) ОДНА ГРАММАТИКА ПРИЁМА** — «карта-получатель ПРЕДСТАВЛЕНА (видна и выделена) → ресурс летит ИЗ ИСТОЧНИКА на её капсулу → счётчик
тикает НА КАСАНИИ → чтение → карта ВОЗВРАЩАЕТСЯ домой» в четырёх хостах: стадия «Разыграно» (эталон, есть), композер синего действия (проверить паритет —
миниатюра цели НЕ поднимается, жетон рождается на значке героя, быстрое поглощение, ни чтения, ни возврата), ЖИВОЙ ПРОМТ (сегодня — чужой уход драфта
`runHeroPick`: подъём, поворот −6°, нырок за край; жетона нет; спутник тикает по ответу сервера), ДОСКА (карта-получатель у поля — только для записей
`payTileToCard`: TR21 / TR30 / Pets / TR15, только при СВОЁМ размещении; Ares-соседство, печатные бонусы клеток, Surveys, чужое размещение — мимо);
**(2) ВСЕ ПОДОБНЫЕ КЕЙСЫ В СКОУПЕ** — § «Производители»; **(3) ИСТОЧНИК ЧЕСТЕН** — жетон рождается там, откуда ресурс на самом деле: платящая клетка
(Ares / печатный бонус), планета колонии (Титан), значок результата карты-источника, карта закона; у промта без `cause` (`Game.grantSpaceBonus`) источник
сначала появляется на СЕРВЕРЕ; **(4) ДОСКА — для КАЖДОГО прибытия с поля без выбора**, и у соперника тоже, когда принимает карта ЗРИТЕЛЯ (Pets зрителя при
чужом городе). TR53 ≈ 20 % (действие с ценой и целью «карта, где уже есть ресурс», условный добор по ВИДУ ресурса цели — класс «метка исхода под кандидатом»);
≈ 80 % — итерация. Решения — агент ищет сам; ниже диагноз и рекомендованная архитектура, финал — по кадрам 4K в батче.

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, файл:строка на `19ceac8852` — подтвердить ДО правки):**
1. **Ступень — одна, прочитана честно; её поверхности — четыре, и говорят по-разному.** `deferredActions/AddResourcesToCard.ts` — ОДНА ступень «ресурс на
   карту»: `Options :70–122` (`count`, `restrictedTag`, **`min`** `:74` — «только карты с ≥ min ресурсами», `filter`, `autoSelect :100`, `cause :108`, `from :114`,
   `optional :121`), `getCards :155–193` (держатели ЛЮБОГО из видов — `holdsOneOf :40–45`, WARE = держатель всего; SRR; `min` `:188–191`), `execute :195–227`
   (нет держателя → `recordSkippedEffect`; **ОДИН держатель + `autoSelect !== false` → тихо `:212`**; `optional` → `buildOptionalChoice :240–252`; иначе
   `SelectCard`), `buildSelectCard :271–304` — маркер `markResourceGainPrompt({amount, cardResource | cardResources + cardResourceByCard, vpBox, genericTitle})`
   (`PlayerInputModel.ts:881–924`), `markChoiceContext({source: cause, mode: 'reward'})` ТОЛЬКО при `cause`; `previewSelectCard :312` — близнец для композеров;
   `addResource :323–327` → `Player.addResourceTo :929–963` (журнал, `recordCardResourceDelta :943`, хуки `onResourceAdded :950–963`; событие
   `card-resource-changed` `EventRecorder.ts:709–733` с `impact.cardResources[{target, amount}]`). Распределение — `AddResourcesToCards.ts:128, 174–219`
   (`markCardResourceDistribution`). «Карта сейчас, число потом» — `SelectResourceTarget.ts:42–90` (TR21). Удалённая доставка — `Colony.isDetachedBonusDelivery :544`,
   `BACK_OF_THE_LINE` `:960–972`.
2. **Производители ЖИВОГО промта (скоуп) — и чем их источник назван.** (а) **Ares-соседство** — `ares/AresHandler.ts:93–117` (`autoSelect: false`, `cause =
   namedCardSource(tile.card) | {kind: 'system'}`, `delivery: 'prompt'` ВСЕГДА — даже при одном держателе; животное `:196`, микроб `:216`); запись
   `AresAdjacencyGrantModel` объявляет `delivery: 'card-resource'` (`:23`), а сервер её НЕ ПИШЕТ никогда. (б) **Печатные бонусы клеток** MICROBE / ANIMAL / DATA /
   SCIENCE / ASTEROID (Amazonis Planitia, Arabia Terra; `boards/{AmazonisBoard, ArabiaTerraBoard}.ts`) — `Game.ts:2787–2819` `grantSpaceBonus`: **ни `autoSelect:
   false`, ни `cause`** — один держатель тихо, два → голый промт без источника. (в) **Surveys** (Ecological / Geological Survey, Ares) — `cards/ares/SurveyCard.ts:190–201`
   (`cause` есть, автовыбор по умолчанию). (г) **Бонус колонии кубовладельцу при ЧУЖОЙ торговле** (Титан — аэростат, Энцелад — микроб, Миранда — животное,
   Redux-Веста / Венера) — `colonies/Colony.ts:589–621` (`cause: colonySource(name, via) :513`; `autoSelect: false` ТОЛЬКО когда платит карта `via`) →
   `isDetachedBonusDelivery` → живой промт получателю ВНЕ его хода; свой торг и постройка — пре-сбор на стейдже (`colonyTradePreview.ts:392–461`). (д)
   **Резолюции** — `parliament/resolutions/{greens/AquiferContest.ts:95, GreensBudget.ts:201, scientists/MedicalDatabase.ts:130, unity/CloudDevelopment.ts:140,
   ColonialAffairs.ts:287, 324}` (живые, внутри страницы награды заседания, `cause {kind: 'resolution'}`, `autoSelect: false`). (е) **Hydronetwork** —
   `delta/DeltaProjectExpansion.ts:1491–1510` — пре-сбор в композере гидросети. (ж) **Финальный wild-бонус трека Венеры** — `venusNext/GrantVenusAltTrackBonusDeferred.ts:59`
   → `ConsoleVenusBonus` (свой шаг цели, полёта нет). (з) **Опциональное «можно +1 data» (TR44)** — `mode 'optional-effect'` → вложенный визард хоста.
   Пре-собранные (композеры, старт, стейдж колонии, причалы, гидросеть, леджер карты, действие партии Учёных `PartyEffects.ts:206–235`) — в этой итерации
   только паритет грамматики. Вне скоупа (Pathfinders / Underworld / CEO / Moon / классический Turmoil / глобальные события) — структурно получают класс.
3. **Случай (3) сегодня — чужой уход.** Роутер: `consoleTaskRouter.ts:742–787` — голый `card` → `{kind: 'cardSelect', mode: 'target'}` (распределение `:617`);
   **ни одной поверхности для Ares / Survey / Титана** — всё в `ConsoleTaskHost.vue`: полоса кандидатов `.con-cards__strip > .con-cards__slot[data-zoom-slot]`
   `:286–328`, `focusedTargetImpacts :349–365, 1772` (current → resulting, ПО), док источника `:115`. Коммит `commitSingleCard :3147–3198`: резолюция и только она
   — `payoutPickLandsInPlace` (`consoleResolutionPayout.ts:106`, `source.kind === 'resolution'`) → карта остаётся на месте `:3172`; **всё остальное —
   `applyDiscardExit(rejects)` `:3185` + `runHeroPick({el: slot}, commit)` `:3197`** → `cardExitDirector.ts:252–274`: подъём `y − 22`, `rotation −1.4` →
   полёт в `playerPoint()` (`:140` — `{innerWidth / 2, innerHeight + 80}`: к НИЗУ экрана, как карта В РУКУ) с `rotation −6`, `scale ×0.6`, `autoAlpha 0`; отвергнутые
   — `con-exit-reject` (`console_card_deal.less:853–861`: `translate(2.6rem, 1.5rem) rotate(2.6deg)`). **Именованного холда нет** (только `cardExitBusy`
   `ConsoleShell.vue:5489–5498`), сабмит — на подъёме, **ни одного детектора прибытия** в `gameTransport.ts:741–1200` кроме `detectResolutionPayout :771`;
   спутник «ДОП. РЕСУРСЫ» (`ConsoleResourcePanel.vue:274–330`, `AnimatedMetricValue`) тикает на apply вида БЕЗ холда панели. Тон семейства — `promptTone.ts:131`
   (`resourceGainPrompt` → `gain`): плита, крест, кикер — есть; СЦЕНЫ ответа — нет. Бонус колонии: `colonyResolution.ts:412` `colonyBonusCardPickOf` →
   `ConsoleShell.vue:19514` → `enterColonyBonusStage :13506` (claim `['draw', 'pick']`) телепортирует хост в `ConsoleColonyFocusStage.vue:452`
   `.con-colfocus__outcome` — тот же `runHeroPick`; `presentedTargets :3510` заполняется ТОЛЬКО для своей торговли. Резолюции: `runResolutionPayout`
   (`consoleResolutionPayout.ts:203–231`) — жетон из печатного значка принятой карты (`carrierIconOrigin :53`) на капсулу слота `.con-cards__slot[data-zoom-slot]
   .pcard__res` (`consoleResourceTransfer.ts:997`), гейт `transportHolds.resolutionPayout` — карта НЕ поднимается, не возвращается.
4. **Случай (1) — эталон.** `consolePlayedHero.ts:1223–1388` `endPlayedHero` → EFFECT RESOLUTION `:1297–1321`: на каждую группу `cardTargetGroups`
   (`receivingStageModel.ts:407`) — `hooks.emergeTarget(target)` → `runResourceTransfers({specs, source: heroRewardSourceSelectors})` (`:1314` — рождение на
   севшей карте `.con-recv [data-recv-front] .con-recv__face` `:1610–1630` или на печатном значке при self-gain `heroGainOrigin :1784`) → `hooks.settleTarget`;
   затем рельс, `flyHeroReactions :1710`, РТ последним; холд `'played-hero'` `:544`. Стадия `ConsolePlayedReceivingStage.vue`: `.con-recv__air :41`, полосы
   `[data-recv-strip] :72–86`, минис `:108–126`, `.con-recv__emerge[data-played-key] :145–152`, `emergeTarget :653–695` (раскрытие из полосы, подъём над полкой,
   `EMERGE_MS 260`), `settleTarget :717–750` (нажим 1.03, назад в полосу). Посадка — `consoleResourceTransfer.ts:985–986` `.con-recv [data-played-key] .pcard__res`;
   свидетель `recv:<card>`.
5. **Случай (2) — расхождение с (1).** Шаг цели — общий `ConsolePlayedTargetStep` (`.con-ptsel`, `ConsoleActionComposer.vue:323`); ответ — миниатюра
   `.con-composer__target-thumb[data-composer-card] :507–534`; `consoleActionCommit.ts:741–770` `commitRailPlan` — выигрыш на карте = последнее звено (PL-063 /
   PL-162); `consoleActionCommitRail.ts:183–196` `composerCardPoint` → `[data-composer-card] .pcard__res`, `:308–324` `flyRailRewardLink({destinationOf, absorb:
   'quick'})` → `TRANSFER_QUICK_ABSORB_MS` → фолд; холд `'action-commit-rail'` `:377`; истоки — `resolveGainIconOrigins :5354–5384` (печатный значок ГЕРОЯ).
   **Цель НЕ поднимается, ни чтения, ни возврата, быстрое поглощение** — против RISE · PAY · READ · RETURN эталона (1) и TR21.
6. **Случай (4) — приёмник на поле: половина кейсов.** `tilePlacement/cityDataPayoutBeat.ts:1–32` (контракт), `runCityPayoutBeat :371` (RISE из ячейки спутника
   `auxCellRect :192` → PAY → READ → RETURN; холд `'city-data-payout' :111`), слой `ConsoleCityPayoutLayer.vue:22–59` (`.con-citypay__card[data-played-key]`,
   посадка `consoleResourceTransfer.ts:984`). Срабатывает: СВОЁ размещение (`consoleTilePlacement.ts:705–726` `claimCityPayouts`, `:1444–1480`) и ТОЛЬКО по
   записям `cardAdjacencyPayouts` (ОДИН писатель `cards/tilePayout.ts:52–85` `payTileToCard` ← `adjacentCityPayout.ts:129` TR21, `base/Pets.ts:68`,
   `turmoilRedux/MartianCensus.ts:128`, `RedMuseum.ts:163`). НЕ поднимает карту: чужое / удалённое размещение (`consoleRemotePlacement.ts:467–482, 925–940` →
   `runRemoteCityPayoutBeat`, `cityDataPayoutBeat.ts:565` — жетоны в чип игрока или в спутник ЗРИТЕЛЯ даже за его Pets / Перепись). Никогда: Ares-соседство
   (`aresAdjacencyFlights.ts:37–66` летают `stock` / `card-resource`; `'prompt'` — ничего → случай (3)), печатный бонус клетки (`tilePlacementModel.ts:672–683` —
   только стоковые), Surveys, свои `onTilePlaced`-прибавки (Hospitals / Vermin / Botanical Experience — вне скоупа), колонии. Прецедент «карта ждёт деньги» —
   `rewardPayoutQuiet.ts` (`docs/claude/console/card-bonus-payout-concurrency.md`).
7. **Общий механизм полёта.** `resourceTransfer/consoleResourceTransfer.ts:367–466` (`ResourceTransferRun`: `source`, `origins`, `arrival`, `absorb`, `fromBoard`,
   `inSurface`, `destination`, `destinationOf` PL-328, `detachCovered` PL-165), `runResourceTransfers :517`, лестница адресатов `targetPointFor :947–1009`
   (`.con-sale-hero` → `.con-citypay` → `.con-recv` → `.con-colfocus` → `.con-fleetdock` → `.con-hydro` → `.con-cards__slot[data-zoom-slot]` → `.con-played` →
   спутник `.con-res-aux__cell[data-aux-resource]`; ступени `data-composer-card` НЕТ — её знает рельсовый модуль), холды `'resource-transfer' :496`,
   `'resource-transfer-in-surface' :504`, `beginPanelRewardHold :212`, `noteCardResourceLanding :258`; `transferEndVisible.ts:66, 123`; свидетель
   `tests/e2e/transferWitness.ts:131–143` (`recv` = `.con-recv|.con-sale-hero|.con-citypay|.con-colfocus|.con-fleetdock|.con-hydro [data-played-key]`, `composer-card`,
   `aux`, `cell`, `glass:`). Две волны с целью-картой садятся на СПУТНИК, не на карту: леджер колоний карты (`colonyLedgerWave.ts:106–113`) и действие партии Учёных
   (`ConsolePartyActionComposer.vue:1291–1297`). Соперник: полёта нет — строка журнала с чипом карты (`journalEventChild.ts:666–671`) и нотификация.
8. **Шаг цели — три грамматики одного вопроса.** Композеры — `ConsolePlayedTargetStep` (`.con-ptsel`: группы по владельцу, метка исхода PL-219
   `playedTargetTagOf` `consolePlayedTargetPreview.ts:280–313` от `holderGainOutcome` `holderRoles.ts:280–304`, near-misses TR52, прокси «ЭТА КАРТА», ПО `vpBox`);
   хост — своя полоса `.con-cards__strip` с `focusedTargetImpacts`; Венера — свой `venusWildTargetStep`. Для TR53 нужен исход ПО КАНДИДАТУ, которого роль не знает
   («+1 карта» зависит от ВИДА ресурса кандидата) — у маркера `ResourceGainPromptMeta` такого члена нет.
9. **TR53 — сервер.** DSL `AddResource` (`behavior/Behavior.ts:208–235`): `type?` (undefined = любой вид), `min`, `mustHaveCard`, `tag`, `optional`; декларативное
   действие «5 M€ → ресурс на любую карту» ЕСТЬ (Floating Habs `venusNext/FloatingHabs.ts:20–23`: `spend: {megacredits: 2}` + `addResourcesToAnyCard`) —
   цена из рельса летит в печатный значок цены (PL-099). Условный хвост «если не наука — карта» декларации не выразить: нужна ВЫБРАННАЯ карта (`cb(card)`
   ступени); добор из действия без выбора — класс TR50 B (`drawCard` после цели; PL-206 гнездо «Берём карту из колоды», PL-212 workspace складывается под
   полётом взятой карты, PL-222). Near-miss при `min` (держатель с 0): `getCards` отсекает, `disabledCards` ступень не публикует — для TR52 (взятие) закон
   «показан недоступным с причиной» есть, для добавления с `min` — нет. Образец синей карты с плашкой Учёных и K-T1 — `turmoilRedux/Supercomputer.ts` (шапка,
   правила 1–10). Хук причины — `cards/actionReasons.ts`; превью — `cards/actionPreviews.ts:366` `addToCardStep`, `cardCost`.
10. **Семейство модалок (2026-10-15)** — `docs/claude/console/prompt-modal-family.md`: `ConsoleTaskHost` стоит на плите `.con-prompt` (тон с промта,
    размер `promptSize`), глагол выгоды «Забрать», следующий запрос того же нажатия — «РЕШЕНИЕ N», инерция нажатий гасится (`promptSettleAbsorbs`). Сцена
    ответа в семействе не описана — ответ модалки заканчивается её уходом.
11. **Фикстуры и e2e.** Живой промт «ресурс на карту» НЕ покрыт ни одним e2e (Ares-соседство, Титан / Энцелад при чужой торговле, печатный бонус клетки,
    Surveys); `console-colony-remote-bonus` — Плутон / Миранда (stateful patcher), `console-colony-miranda-bonus`; случай (1) — `console-biological-simulations` (A),
    `console-recv-perf-probe`, `console-self-target`, `console-staged-play`; случай (2) — `console-aerial-mappers`, `console-supercomputer` (C), `console-expedition-mechs`,
    `console-aquatic-research-station`; стейдж / леджер — `console-trade-target-step`, `console-habitat-science`; резолюции — `console-parliament-{aquifer, medical,
    cloud, colonial}`; случай (4) — `console-arboretum`, `console-red-museum`; семейство — `console-prompt-family`. Генератор: `tests/e2e/fixtures/generate.ts`
    (Титан / Миранда / Энцелад импортированы `:127–230`; колонии в фикстуре `:2149`; `waitingFor` сериализуется и переприминается при загрузке — очередь
    отложенных НЕТ, поэтому живой промт в фикстуре = уже стоящий `waitingFor` получателя, а не «ожидающая торговля»).
12. **Слова:** «Frontier Town» → «Пограничный город» (`prelude_cards.json:2`); «Hi-Tech Lab» → «Передовая лаборатория» (`promo.json:143`) — «Передовые лаборатории»
    слишком близко; «Фронтир» в локали не встречается (свободно). Ключи ступени: «Add resource to this card», «Select a card — ${1}: +${0}», «Add resource(s)»
    (`AddResourcesToCard.ts:274–279`); семейство — «Забрать». Лор НАПЕЧАТАН на скане (цитата курсивом) — не придуман; арта **`Mars Arts/TR53.png` НЕТ** (есть TR50–52)
    — попросить первым сообщением. `CardName` — после `CUTTING_EDGE_DESIGN` (`:1123`), перед `EXPEDITION_MECHS` (`:1124`); манифест — между TR49 (`:263`) и TR50 (`:266`).
13. **Реестр:** последний раздел AN (PL-370…385), footer «Следующий свободный номер **PL-369**, затем **PL-386**»; TR53 берёт раздел **AO** — номер и букву
    объявлять В МОМЕНТ записи (сосед активен — §0). Открытые строки на маршруте: PL-059 (карта-получатель стейджа колонии ~165 px в пустой зоне — ждёт владельца),
    PL-082 (зазор плашки «тайл платит» — ждёт владельца), PL-226 (чип добора «+1 взять»), PL-227 (тусклый значок роли «карта» на спутнике).

**Обязательное чтение до кода:** `src/server/deferredActions/{AddResourcesToCard.ts, AddResourcesToCards.ts, SelectResourceTarget.ts, Priority.ts, skippedEffect.ts}`,
`src/server/{Player.ts:925–1010, Game.ts:2760–2830, PlayerInput.ts:330–440}`, `ares/AresHandler.ts:60–230`, `colonies/{Colony.ts:500–625, 940–980,
colonyTradePreview.ts:380–470}`, `cards/{tilePayout.ts, adjacentCityPayout.ts, actionPreviews.ts:340–420, actionReasons.ts, holderActionGood.ts, ares/SurveyCard.ts:180–210,
base/Pets.ts, turmoilRedux/{Supercomputer.ts, ExpeditionMechs.ts, RedMuseum.ts:140–170, MartianCensus.ts:110–140}, venusNext/FloatingHabs.ts}`, `behavior/{Behavior.ts:200–240,
Executor.ts:225–250, 590–640}`, `models/{actionPreview.ts:760–815, ServerModel.ts}`, `inputs/choiceContext.ts`, `common/models/{PlayerInputModel.ts:720–740, 875–930,
970–1005, AresAdjacencyGrantModel.ts, CardAdjacencyPayoutModel.ts}`, `events/EventRecorder.ts:700–740`. Клиент: `console/played/{consolePlayedHero.ts:530–560,
740–760, 1220–1400, 1600–1640, 1700–1800, receivingStageModel.ts:390–470, consolePlayedTargetPreview.ts:230–315, consolePlayedTargetModel.ts}`,
`components/console/played/{ConsolePlayedReceivingStage.vue:30–160, 400–760, ConsolePlayedTargetStep.vue}`, `console/{consoleActionCommit.ts:340–380, 730–780,
consoleActionCommitRail.ts:170–400, holderRoles.ts:260–430}`, `components/console/{ConsoleActionComposer.vue:300–340, 500–540, 5340–5400, ConsoleTaskHost.vue:100–130,
280–370, 740–770, 1760–1790, 2720–2750, 3140–3200, ConsoleColonyFocusStage.vue:440–470, 3490–3530, ConsoleResourcePanel.vue:260–340, ConsoleVenusBonus.vue,
ConsolePartyActionComposer.vue:770–820, 1280–1300}`, `components/console/tilePlacement/ConsoleCityPayoutLayer.vue`, `console/tilePlacement/{cityDataPayoutBeat.ts,
cityDataPayoutModel.ts, consoleTilePlacement.ts:690–740, 1430–1490, consoleRemotePlacement.ts:430–490, 900–950, tilePlacementModel.ts:660–700, aresAdjacencyFlights.ts}`,
`console/resourceTransfer/{consoleResourceTransfer.ts, transferEndVisible.ts, railReward.ts, resourceTransferDirector.ts}`, `console/{cardExitDirector.ts:130–150, 240–280,
490–530, consoleTaskRouter.ts:600–660, 740–790, promptTone.ts, promptSequence.ts, consoleTaskSummary.ts, rewardPayoutQuiet.ts, colonyTrade/{colonyResolution.ts:400–540,
consoleColonyTrade.ts}, parliament/consoleResolutionPayout.ts, transport/gameTransport.ts:740–800 (`seedRewardHolds`, детекторы)}`, `styles/{console_card_deal.less:840–870,
console_prompt.less, console_city_payout*.less}`, `components/console/ConsoleShell.vue:5480–5500, 13500–13520, 16960–17000, 19500–19530, 20140–20170`. Тесты — диагноз 11 +
`tests/deferredActions/{AddResourcesToCard, AddResourcesToCards, SelectResourceTarget}.spec.ts`, `tests/ares/AresAdjacencyGrants.spec.ts`, `tests/client/components/console/
{aresAdjacencyFlights, colonyResolution, consolePlayedHero, ConsolePlayedReceivingStage, cellDecidedReward, rewardPayoutQuiet, consolePlayedTargetPreview}.spec.ts`,
`tests/client/console/consoleResolutionPayout.spec.ts`, `tests/console/{actionCommitRail, actionCommitRailRule, transferFlightClock}.spec.ts`. Память: диагноз 0.

Номера строк сняты с `19ceac8852` — перед правкой перечитать.

**Что это за карта.** Синяя (ACTIVE), **8**, метки **Наука + Здание**, требование **Учёных**, без ПО, без своего ресурса: *«Requires the Scientists to be ruling or that
you have 2 delegates there. Action: Pay 5 M€ to add a resource TO A CARD THAT ALREADY HAS A RESOURCE. If it's not a science resource, also draw a card.»* Цитата:
*«It's often hard to tell if they're doing it purely to impress investors or not?»*

**Оценивается — в этом порядке веса.**
1. **ОДНА ГРАММАТИКА ПРИЁМА В ЧЕТЫРЁХ ХОСТАХ** (≈ 45 %) — ОДИН директор «ПРИЁМ РЕСУРСА КАРТОЙ» (PRESENT · PAY · READ · RETURN) читается стадией «Разыграно»,
   композером действия, живым промтом (плита семейства) и приёмником на поле; жетон рождается в ИСТОЧНИКЕ (клетка / планета / значок карты / карта закона),
   капсула тикает на касании, карта возвращается домой; уход драфта в промте цели УДАЛЁН; спутник держится холдом из apply-блока; на 4K раскадровка каждого
   хоста по планке.
2. **ВСЕ ПРОИЗВОДИТЕЛИ СКОУПА** (≈ 20 %) — Ares-соседство, печатные бонусы клеток, Surveys, бонус колонии при чужой торговле (Титан / Энцелад / Миранда / Веста /
   Венера), Венера-wild, опциональные «можно», резолюции (паритет), чужое размещение с картой ЗРИТЕЛЯ; у каждого — именованный источник на сервере.
3. **КАРТА TR53** (≈ 20 %) — правила 1–13 спеком; цена с рельса; исход под КАЖДЫМ кандидатом («+1 [вид] · +1 карта» / «+1 [наука]» без добора); условный добор —
   дверь TR50 B; чужой держатель с 0 — показан недоступным с причиной.
4. **Остальное** (≈ 15 %) — лицо, лор, локаль, §6.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Ступень** | `AddResourcesToCard` — один держатель + `autoSelect ≠ false` → тихо `:212`; маркер `resourceGainPrompt` (`amount`, виды, `vpBox`), `cause` → `choiceContext`; `min` отсекает без `disabledCards` |
| **Источники живого промта** | Ares `AresHandler.ts:111` (`autoSelect: false`, cause карта / system); клетки `Game.ts:2787–2819` (ни cause, ни autoSelect); Survey `:194`; колония `Colony.ts:601/610` (cause; autoSelect только с `via`); резолюции; Венера-wild |
| **Случай (3) клиент** | `ConsoleTaskHost` полоса + `runHeroPick` (нырок к низу экрана) + `con-exit-reject`; холда нет; жетон не летит; спутник тикает по apply |
| **Случай (1)** | `endPlayedHero` EFFECT RESOLUTION: `emergeTarget` → жетон с севшей карты → капсула → `settleTarget`; холд `played-hero` |
| **Случай (2)** | миниатюра `[data-composer-card]` стоит; жетон с печатного значка ГЕРОЯ; `absorb: 'quick'`; без чтения / возврата |
| **Случай (4)** | `cityDataPayoutBeat` RISE / PAY / READ / RETURN — только записи `payTileToCard`, только своё размещение; Ares / клетка / Survey / чужое — мимо |
| **Полёт** | `consoleResourceTransfer` лестница адресатов без ступени композера; `detachCovered`; `transferEndVisible`; свидетель `recv:` / `composer-card:` / `aux:` |
| **Семейство модалок** | плита `.con-prompt`, тон `gain`, «Забрать», «РЕШЕНИЕ N», инерция; сцены ответа нет |
| **TR53** | DSL: `type` undefined + `min` + `spend` есть (Floating Habs); условный хвост — bespoke; near-miss при `min` не публикуется |
| **Арт / лор / имя** | арта НЕТ; лор напечатан; `CardName` между TR49 и TR50 |
| **Реестр** | footer **PL-369 → PL-386**; раздел **AO** |

### Чтение скана (`…\Projects\Card_-_TR53.png`)
Цена **8**, СИНЯЯ рамка (ACTIVE). Плашка «MIN» у цены — **эмблема Учёных** (колба) = ТРЕБОВАНИЕ `{party: PartyName.SCIENTISTS}`, не метка. Метки справа, по порядку
печати: **Наука** (атом), **Здание** (коричневый диск). Название «FRONTIER LABS». Верхнее поле — ОДИН ряд действия: **[5 M€] → [карта с ресурсами] : + [?] [карта-рубашка]\***
→ `b.action('Pay 5 M€ to add a resource to a card that already has a resource. If it is not a science resource, also draw a card.', (eb) => eb.megacredits(5)
.startAction.<карта-с-ресурсами> ... )` — сверить с DSL: значок «карта с ресурсами» (белая карточка с тремя оранжевыми квадратами) — `CardRenderItemType`
ищем по `cards()` с `secondaryTag`/`wild` ресурсом либо `b.wild(1)` / `resource(CardResource.WARE)`-подобный узел (`DirectedImpactors`, `NobelLabs` `:25–27` —
`eb.empty().startAction.resource(...).slash(...)`); «?» = «ресурс вида этой карты» (белый квадрат с «?»), **карта-рубашка со звёздочкой = «возьмите карту, если
…»** (`cards(1).asterix()`). Ряд длиннее 52 знаков → `action-short` с `tokens` + RU. Нижнее поле — требование словами. ПО нет. Цитата ЕСТЬ (курсив под чертой) →
лор НАПЕЧАТАН, в реестр придуманного не идёт. Внизу слева — фиолетовый ромб Turmoil (модуль, без `compatibility`; ▲ Колоний и значка Венеры НЕТ). Подпись
арта — «Khang Le - Hawken» (подпись арта). Номер «TR53».

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/FrontierLabs.spec.ts`; класс приёма — своими спеками, §1–§2)
1. **Требование** — плашка Учёных: правят или 2 СВОИХ делегата на их резолюции; при розыгрыше; TR36 порог ТРЕБОВАНИЯ не снижает.
2. **Розыгрыш** ничего не даёт сразу (нет `behavior`): метки будят стол — Наука → Olympus Conference / Mars University / Pharmacy Union (вопросы стола пре-шагами,
   закон TR51), Здание → скидка Heat Capture (RX14), Mining Guild и пр. — всё даром.
3. **Действие — раз в поколение** (`ActionCard`), **цена 5 M€ ПЕРВОЙ** (PL-099: жетон цены уходит с рельса боком в печатный значок «5»; только M€ — ни стали, ни титана:
   `SelectPaymentDeferred` платит без вопроса, когда платить можно только M€). Недоступно и НАЗВАНО по порядку (одна причина): нет ни одной своей карты с ≥ 1
   ресурсом («No card of yours holds a resource yet») → меньше 5 M€.
4. **Цель — СВОЯ карта (стол + SRR, никогда соперника) с ≥ 1 ресурсом ЛЮБОГО вида** (животные, микробы, аэростаты, data, наука, истребители, мехи, астероиды,
   WARE…) — ступень `AddResourcesToCard(player, undefined, {min: 1, autoSelect: false, cause: cardSource(this), …})`; добавляется **1 ресурс ВИДА ЭТОЙ карты**
   (`holderResourceOf`); один кандидат — всё равно шаг (инвариант 3); **держатель с 0 — показан НЕДОСТУПНЫМ с причиной «No resource on this card yet»**
   (`disabledCards` ступени при `min` — класс TR52 near-miss для добавления), никогда скрыт; этот же TR53 — не держатель (без `resourceType`), не кандидат.
5. **Условный добор**: если вид ресурса ВЫБРАННОЙ карты ≠ `CardResource.SCIENCE` → `player.drawCard(1)` (свой обычный добор, источник reveal — карта TR53 → дверь
   добора workspace «Действий карт», класс TR50 B: гнездо «Берём карту из колоды» PL-206, передача «щелчком» PL-222); наука (Olympus Conference, …) → без добора;
   WARE — не наука → добор. Пустая колода при не-науке — добор не случается, названо (пропуск по имени), действие не блокируется.
6. **Исход ПОД КАЖДЫМ КАНДИДАТОМ ДО нажатия** (PL-219 / К-T1): «+1 [микроб] · +1 [карта]» / «+1 [наука]» (без добора — и это названо словом в ряду кандидата,
   не молчанием); роль держателя (оплата / делегат / действие / ПО / хранение) — как у TR48 / TR50, РЯДОМ с добором; «ДАЛЕЕ» — для не-науки «добор 1 карты».
7. **Превью = исполнение** (`replayBatch`, ноль переспросов): батч `[action, {card}]` (цель адресована — закон 27); добор — НЕ промт; `postCommitGuard` молчит.
8. **Ответы стола**: +1 ресурс → `onResourceAdded` (Martian Fiber +1 M€ за data и т. п.) — в «Сработает»; на добор никто не отвечает.
9. **Журнал**: «spent 5 M€», «added 1 X to Y», «drew 1 card»; нотификация соперника называет карту-получатель (`onCard`, PL-216) и добор.
10. **ПО**: у карты нет; +1 ресурс может сдвинуть ПО цели — `vpBox` кандидата (есть даром).
11. **MarsBot** карту не играет; его карты — не цели.
12. **Save / load**: обычная карта; `actionsThisGeneration` движка.
13. **Маркер исхода по кандидату — ОБЩИЙ**, не частный: `ResourceGainPromptMeta.extraByCard?: Partial<Record<CardName, ReadonlyArray<ActionEffect>>>` («что ещё даёт
    этот выбор на ЭТОМ кандидате») строится ступенью из co-located функции карты (`Options.extraByCard?(card)`), читается шагом цели (тег), ответом композера
    (чип), живым промтом — одним путём; TR53 — первый клиент (`{direction: 'gain', icon: 'cards', amount: 1}` для не-науки).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **RU-имя «Лаборатории фронтира»** (Grep — свободно; «передний край науки» без столкновения с «Передовой лабораторией»). Альтернативы: «Пограничные
   лаборатории» (в паре с «Пограничный город»), «Передовые лаборатории» (столкновение с Hi-Tech Lab — не рекомендовано). Лор — перевод цитаты: «Часто не
   поймёшь: они это ради дела или чтобы впечатлить инвесторов?»
2. **Случай (3) для прибытия С ПОЛЯ (Ares, печатный бонус, Survey) — концепция по кадрам 4K:**
   - **(а) Рекомендация — «ПЛИТА = ВОПРОС, СЦЕНА = НА ПОЛЕ».** Плита семейства (`.con-prompt`, тон `gain`, размер по числу кандидатов; тело — ОБЩИЙ шаг цели
     `ConsolePlayedTargetStep`, не своя полоса) стоит над полем; платящая клетка подсвечена слоем отношений (тон `gain`) всё время выбора; на «Забрать» плита
     отдаёт экран (парк, не уход) и играет ОДНА сцена приёмника поля (TR21-семейство: выбранная карта ПОДНИМАЕТСЯ из ячейки спутника к полю рядом с клеткой →
     жетон из клетки на капсулу → тик на касании → чтение → RETURN в ячейку спутника) — та же сцена, что и у прибытия БЕЗ выбора. Один класс для «спросили» и
     «не спросили».
   - **(б)** Сцена внутри плиты: карта на месте, жетон из клетки ПОД шейдом в плиту — отвергнуто: источник под дымкой читается слабо (закон видимости концов).
3. **Случай (3) для бонуса КОЛОНИИ при чужой торговле** — «Бонус колонии» на стейдже колонии (`intent: 'bonus'`): выбранная карта = ПРЕДСТАВЛЕННАЯ ЦЕЛЬ
   (`presentedTargets` заполняется и для бонуса, не только для своей торговли; шасси `ConsoleTradeReceivingCards` — и там же решить PL-059: карта-получатель
   крупнее в пустой зоне), жетон с планеты / значка бонуса тайла → капсула → тик → чтение → RETURN в спутник, стейдж уходит одной поверхностью (рекомендация).
4. **Случай (3) для КАРТОЧНОГО источника** (опциональное «можно +1 data» TR44 вне композера, Венера-wild, вне-скоуп карты, резолюции): сцена ВНУТРИ плиты —
   выбранная карта остаётся на месте и ПОДСВЕЧИВАЕТСЯ (печать варианта TR51 — не нырок), отвергнутые ОТСТУПАЮТ (recede: opacity + волос масштаба, без дрейфа и
   поворота), жетон с печатного значка карты-источника в доке плиты → капсула выбранной → тик → чтение → карта уходит в ячейку спутника ОТДЕЛЁННЫМ полётом
   (PL-165), плита растворяется ПОД ним (результат переживает поверхность). Резолюции — та же грамматика в зоне заседания (сегодня — жетон без подъёма и
   возврата): паритет, не новая сцена.
5. **Один держатель у прибытия с поля / колонии:** (а) **рекомендация** — вопрос НЕ задаётся (сегодня так у клеток и колоний; Ares спрашивает всегда), сцена
   приёмника НАЗЫВАЕТ карту (игрок видит, куда легло, — «без скрытой цели» выполнено сценой, выбора нет) — AresHandler переводится на `autoSelect` по умолчанию
   с честной сценой; (б) всегда спрашивать (Ares сегодня) — плита с одним кандидатом как подтверждение. Для КАРТОЧНОГО источника ступень остаётся как есть
   (`autoSelect: false` у «на ЛЮБУЮ карту»).
6. **Паритет синего действия (случай 2)** — (а) рекомендация: миниатюра цели получает ТОТ ЖЕ такт PRESENT · PAY · READ · RETURN в масштабе ряда (подъём на
   волос + кольцо при рождении жетона, тик на касании, короткое чтение, посадка; `absorb: 'quick'` остаётся для цепочек, где цель — не последнее звено);
   (б) оставить как есть. Решить по A/B длительности («Действия карт» не длиннее +0,3 с).
7. **Источник на сервере — ОДНА запись прибытия с поля**: кольцо `cardAdjacencyPayouts` (`tilePayout.ts`) становится записью ЛЮБОГО прибытия ресурса на карту,
   рождённого полем: `kind: 'adjacency' | 'printed' | 'ares' | 'survey' | 'prompt'` + `space` + `cause` + `target` + `amount` (один писатель, `AresAdjacencyGrantModel.delivery
   'card-resource'` наконец пишется); ответ живого промта с поля ТОЖЕ пишет запись (`kind: 'prompt'`) — клиент играет сцену с записи, не с диффа видов (класс PL-133).
   `Game.grantSpaceBonus` получает `cause {kind: 'space', spaceId}` (новый вид `ChoiceContextSource`, если нет) — док плиты называет клетку.
8. **Маркер исхода по кандидату** — `extraByCard` (решение 13 правил; рекомендация) vs слова в ряду («+ карта») — рекомендация: маркер.
9. **e2e: ОДИН новый спек** `tests/e2e/console-frontier-labs.spec.ts` (§4) — его фикстуры несут стенды итерации; соседи — переводом существующих (инвариант 14).
10. **Батч — ПЕРВЫМ после кадров концепций**, одним `AskUserQuestion` (≤ 4 вопроса, рекомендация первым): (1) концепция случая (3) с поля — решение 2 с кадрами
    ДО / ПОСЛЕ (Ares-животное, печатный микроб); (2) один держатель — решение 5; (3) паритет действия — решение 6 с A/B; (4) строки «ждёт владельца» на маршруте
    (PL-059, PL-082 — здесь же решаются кадром; `grep` в момент батча).

---

## 0. Рабочее дерево
HEAD `19ceac8852`. **СОСЕД АКТИВЕН** (сессия TR49-доводка: незакоммичены `PremiumModifierCoins.vue`, `premiumModifierSources.ts`, `ConsoleHandSection.vue`,
`ConsolePlayCardConfirm.vue`, `ConsoleForecastRow.vue`, `premiumCardViewModel.ts`, `composerRequirementRow.ts`, `effectForecastModel.ts`, `handEasingPlate.ts`,
`console_armed_effects.less`, `premium_card.less`, `tests/e2e/{consoleStart.ts, fixtures/generate.ts}`, фикстура `standing-modifiers.json`). TR53 трогает
`generate.ts`, `consoleStart.ts`, `ConsolePlayCardConfirm.vue` (стадия), реестр — ListAgents + SendMessage соседу ДО первой правки общих файлов (память
`concurrent-session-edits-same-files`); его ханки — не в своих коммитах. Коммиты — только через временный индекс (`GIT_INDEX_FILE` абсолютным путём; **read-tree →
commit ОДНОЙ командой** при активном соседе; `git reset -q -- <свои пути>` после; ханки одного файла — НЕ `--unidiff-zero`), `git add` своими путями; после
коммита — `git restore --staged package.json package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr53`, `TM_E2E_ROOT=.e2e-tr53`; 4K — `--workers=1` +
`TM_E2E_GPU=1`; **тайминги — A/B на одном снапшоте, на тихой машине, часами страницы** (память `tr49-one-play-class`: `locator.waitFor` квантует 500 мс).
**Арт: попросить `Mars Arts/TR53.png` у владельца первым сообщением.**

## 1. Сервер
**Коммит 1 — ИСТОЧНИК И ЗАПИСЬ (общий слой), без карты.**
(а) **Каждый производитель скоупа называет источник**: `Game.grantSpaceBonus :2787–2819` — `cause: spaceSource(space)` (новый `ChoiceContextSource {kind: 'space',
spaceId}` в `inputs/choiceContext.ts`, если нет; `genericTitle`), `SurveyCard.maybeRewardCardResource` — `cause` + клетка; `AresHandler` — `fromSpace` платящей
клетки в маркере (`ResourceGainPromptMeta.fromSpace?: SpaceId` — физический источник жетона; `choiceContext.source` остаётся автором); `Colony.giveBonusImpl` —
как есть (`colonySource`), плюс `fromColony` не нужен (источник = имя колонии в `cause`). Решение 5: `autoSelect` у Ares по умолчанию (если принято).
(б) **ОДНА запись прибытия с поля** (решение 7): `cards/tilePayout.ts` → `recordBoardCardPayout(game, {kind, space, cause, player, target, resource, amount})`;
писатели — `payTileToCard` (adjacency), `grantSpaceBonus` card-branch (printed; при `autoSelect` — сразу, при промте — в `andThen` ступени `kind: 'prompt'`),
Ares (`AresHandler` — `delivery: 'card-resource'` при тихом применении / `'prompt'` → запись в `andThen`), Survey; модель `CardAdjacencyPayoutModel` расширяется
`kind` + `space`; `seq` от `gameAge`, кольцо не сериализуется (закон `scaleStepRewards`). Гард: запись совпадает с событием `card-resource-changed` того же ответа.
(в) **Near-miss при `min`**: `AddResourcesToCard.buildSelectCard` публикует `disabledCards` (держатели вида с `< min`) с причиной «No resource on this card yet»
(ключ + RU); `previewSelectCard` — то же (один билдер).
(г) **`extraByCard`** (правило 13): `Options.extraByCard?: (card: ICard) => ReadonlyArray<ActionEffect> | undefined` → маркер `resourceGainPrompt.extraByCard`;
превью `addToCardStep` несёт его в шаг; `cardPlayReplayCoverage` / `actionPreviewCoverage` берут карту сами.
Спеки коммита 1: `tests/deferredActions/AddResourcesToCard.spec` (near-miss, `extraByCard`, источник), `tests/game/BoardCardPayout.spec` (запись по видам, паритет
с событием, промт пишет в `andThen`), `AresAdjacencyGrants.spec` (`card-resource` пишется), регрессия `Pets` / `RedMuseum` / `MartianCensus` / `Arboretum` /
`AquiferContest` / `MedicalDatabase` / `Colony` (detached) / `SurveyCard`.
**Коммит 2 — карта** `src/server/cards/turmoilRedux/FrontierLabs.ts`: `CardName.FRONTIER_LABS = 'Frontier Labs'`; `ActionCard`, ACTIVE, 8, `[Tag.SCIENCE, Tag.BUILDING]`,
`requirements: {party: PartyName.SCIENTISTS}`, без `behavior`; **действие — bespoke** (хвост нужен выбранной карте): `canAct` = есть кандидат (`new
AddResourcesToCard(player, undefined, {min: 1}).getCards().length > 0`) ∧ `canAfford(5)`; `action` → `SelectPaymentDeferred(player, 5, {cause})` `.andThen(() => defer
AddResourcesToCard(player, undefined, {min: 1, autoSelect: false, cause: cardSource(this), extraByCard: (c) => c.resourceType !== SCIENCE ? [drawChip(1)] : undefined})
.andThen((card) => card.resourceType !== CardResource.SCIENCE && player.drawCard(1)))`; co-located `actionPreview` (`actionPreviews.cardCost(5)` + `addToCardStep` с
`extraByCard` + «ДАЛЕЕ: добор 1 карты» условно), `actionUnavailableReason` (порядок правила 3). `renderData` — чтение скана, `action-short` + RU. Шапка — чтение скана
+ правила 1–13 + «лор напечатан». Гарды §3 чеклиста: `actionPreviewCoverage`, `actionReasonCoverage`, `actionPromptCoverage`, `actionBranchAvailability`,
`promptMarkerGuard`, `effectForecastCoverage`, `make:cards` 0 / 0 / 0.

## 2. Клиент — ГЛАВНОЕ
1. **ОДИН директор «ПРИЁМ РЕСУРСА КАРТОЙ»** — `console/cardReceive/cardReceiveDirector.ts` (чистый план + DOM-половина через хуки хоста, как
   `agendaWalkDirector` / `cityDataPayoutBeat`): фазы **PRESENT** (хост показывает получателя: `emergeTarget` стадии «Разыграно» · подъём миниатюры композера ·
   выделение выбранной в плите / на стейдже · RISE из ячейки спутника у поля) → **PAY** (на КАЖДУЮ единицу жетон из `source` (клетка `fromSpace` / планета колонии /
   значок карты-источника / карта закона / севшая карта) на капсулу `[data-played-key] .pcard__res`, `runResourceTransfers`, тик капсулы и спутника на касании —
   холды посеяны в apply-блоке) → **READ** (`RECEIVE_READ_MS`) → **RETURN** (домой: полоса стадии · ряд композера · ячейка спутника `.con-res-aux__cell
   [data-aux-resource]` — отделённым полётом, если поверхность уходит, PL-165). Один холд-имя на хост (`card-receive:<host>`), `expire` + `diagnose`, reduced motion —
   тик на коммите. Существующие хосты (1) и (4) ПЕРЕВОДЯТСЯ на директор без изменения кадров (A/B — те же тайминги; `cityDataPayoutBeat` = его план с
   `present: 'rise'`), (2) — по решению 6, (3) — новое.
2. **Случай (3): ТРИ хоста одной грамматики.** (а) **С поля** (решение 2): `ConsoleTaskHost` при `resourceGainPrompt.fromSpace` / `choiceContext.source.kind ===
   'space'` — плита семейства, тело — `ConsolePlayedTargetStep` (хост-агностичен: группы, теги PL-219, near-miss, `vpBox`, прокси «ЭТА КАРТА»), слой отношений
   поля подсвечивает платящую клетку (`placementRelations` тон `gain`); «Забрать» → плита ПАРКУЕТСЯ (не `runHeroPick`), сабмит, apply-блок читает ЗАПИСЬ
   (коммит 1 (б), `kind: 'prompt'`, `seq`) → сцена приёмника поля (директор, `present: 'rise'` из ячейки спутника к клетке) → плита снимается ПОД сценой. (б)
   **Колония** (решение 3): стейдж `intent: 'bonus'` — `presentedTargets` для бонуса, сцена с планеты, RETURN в спутник, уход одной поверхностью; PL-059 — размер
   карты-получателя по кадру 4K. (в) **Карточный источник** (решение 4): плита; выбранная — печать TR51 (`ConsoleVariantChoice`-грамматика выделения на карте),
   отвергнутые — recede; жетон из дока источника (`.con-task__source` печатный значок — `data-graphic-node`); RETURN отделённым полётом; **`runHeroPick` /
   `con-exit-reject` для `resourceGainPrompt` / `cardResourceDistributionPrompt` ЗАПРЕЩЕНЫ** (остаются для картy В РУКУ — драфт / покупка). Резолюции — директор с
   `present: 'highlight'` в зоне заседания (паритет; `transportHolds.resolutionPayout` остаётся гейтом).
3. **Случай (4) — для КАЖДОГО прибытия с поля** (коммит 1 (б)): `consoleTilePlacement.claimCityPayouts` читает все `kind` записи (adjacency · printed · ares ·
   survey · prompt); **чужое размещение с картой ЗРИТЕЛЯ** (Pets зрителя при чужом городе, Перепись) — `consoleRemotePlacement` играет сцену приёмника у чужого
   тайла для зрителя-владельца карты (`runRemoteCityPayoutBeat` → директор), жетоны чужим — в их чип, как сегодня; `aresAdjacencyFlights` читает `card-resource`
   (`delivery`) и больше не молчит на `prompt`; `card-bonus-payout-concurrency` (карта-бонус + ресурсы) — без изменений, директор — член `rewardPayoutSettling`.
4. **Случай (2)** — решение 6: `consoleActionCommitRail.flyRailRewardLink` для последнего звена на `[data-composer-card]` — через директор (`present: 'lift'`,
   READ короткое, RETURN = посадка миниатюры); A/B.
5. **Спутник держится** — apply-блок (`gameTransport.seedRewardHolds`) сеет `beginPanelRewardHold` на ячейку спутника и капсулу получателя для КАЖДОГО прибытия с
   записью / с ответом живого промта (по `card`-ответу + `amount` маркера); тик — на касании; PL-162: конец видим или честная деградация.
6. **TR53 в композере** — шаг цели с тегами «+1 [вид] · +1 [карта]» / «+1 [наука]» (`playedTargetTagOf` читает `extraByCard`), near-miss «0 — ещё нет ресурса»,
   цена 5 M€ в формуле; «A» → ACTION COMMIT: цена с рельса боком в печатный «5» (PL-099 / PL-104) → импульс → жетон из печатного «?» в миниатюру цели (директор,
   случай 2) → при не-науке — дверь добора (TR50 B: гнездо, «Берём карту из колоды», карта в руку, workspace складывается под полётом PL-212) → одна концовка.
   Соперник: нотификация «+1 [вид] → ‹карта›, +1 карта».
7. **Слова** (Grep перед каждым): «No resource on this card yet», «Pay 5 M€ to add a resource to a card that already has a resource. If it is not a science resource,
   also draw a card.» (ряд), `action-short`, «Add here», «Receives: ${0}», «Also draws a card», «No draw (science)»; RU — «На карте ещё нет ресурса», «Получает: …»,
   «Ещё +1 карта», «Без добора: наука»; док плиты для клетки — «КЛЕТКА · ‹бонус›» / «СОСЕДСТВО · ‹тайл›» (через `consoleTaskSummary`, не литерал).

## 3. Лицо, локаль, лор, арт
`renderData` (чтение скана; ряд > 52 знаков → `action-short` + `tokens`) → витрина EN / RU, миниатюра, плитка «Действий карт», композер. Ключи — Grep по всем
`src/locales/<lang>/*.json` ПЕРЕД каждым (имя, ряд, `card_info` капшены). Лор — `lore_texts.json` «TR53» (EN цитата дословно, с «?») + RU. Арт — `node
scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR53.png" TR53` + `npm run make:cards` (арта пока НЕТ — просить).

## 4. Тесты
Сервер — §1. Клиент: юниты директора (план по хостам, порядок фаз, reduced motion, холды), `consolePlayedTargetPreview` (тег `extraByCard`, near-miss при `min`),
`consoleTaskRouter` (плита с поля / колонии / карты — три маршрута одного `cardSelect: 'target'`, по маркерам, не по заголовку), `cityDataPayoutModel` (все
`kind`), `aresAdjacencyFlights` (`card-resource`), `colonyResolution` (представленная цель бонуса), `consoleResolutionPayout` (паритет). Гарды: `transferFlightClock`,
`actionCommitRail`, `readingParamsGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `e2eLiveness`, `promptMarkerGuard`, `embeddedSurfaceShadeGuard`. **e2e — ОДИН**
`tests/e2e/console-frontier-labs.spec.ts` (fhd + **4K**, `--repeat-each=4`, `TM_E2E_GPU=1`, state-waits, `TM_E2E_STORYBOARD=1`, свидетели `transferWitness` /
`preselectGuard` / `postCommitGuard`; красный — второй клиент) с фикстурами (`parliamentFixture`, Учёные — `seatEnacted(quietResolutionOf(SCIENTISTS))`; второй
клиент — корпорации без первого действия):
1. **`frontier-labs`** — TR53 на столе, 20 M€, держатели: Тардиграды (1 микроб), Olympus Conference (1 наука), Pets (0 животных — near-miss), TR48 (2 data).
   «Действия карт» → TR53 → композер: цена 5, теги «+1 [микроб] · +1 [карта]» / «+1 [наука]» / «+1 [data] · +1 [карта] · оплата…» / Pets «0 — ещё нет ресурса»
   (недоступна) → Тардиграды → «A» → жетон цены с рельса в «5» → жетон из «?» на миниатюру (свидетель `composer-card:`) → дверь добора → карта в руку → flow уходит;
   второй заход: Olympus → без добора, посадка → конец. Сервер: −5 M€, +1 микроб, +1 карта / +1 наука без карты. Красный — нотификация с картой-получателем.
2. **`resource-receive-board`** (стенд итерации, доска Amazonis / Ares): печатный микроб на клетке с ОДНИМ держателем → без вопроса, сцена приёмника (RISE из
   спутника · жетон из КЛЕТКИ · тик на касании · RETURN); клетка с животным и ДВУМЯ держателями → плита семейства (кикер «КЛЕТКА», шаг цели с тегами, клетка
   подсвечена) → «Забрать» → плита паркуется → сцена → плита ушла ПОД сценой; `runHeroPick` НЕ играет (нет `.con-exit-reject`, карта не уходит вниз); Ares-соседство
   с животным (тайл с бонусом соседства рядом) — то же, запись `kind: 'ares'`. Второй клиент: чужой город рядом с Pets ЗРИТЕЛЯ → у зрителя сцена приёмника у чужого
   тайла.
3. **`resource-receive-colony`** — Титан, куб зрителя, у зрателя Dirigibles (2 аэростата); генератор исполняет торговлю ВТОРОГО игрока на Титане, у зрителя стоит
   `waitingFor` живого выбора (`cardPickColony`) — фикстура грузится с ним; клиент: плашка обязательного запроса → A → стейдж «Бонус колонии» с представленной
   целью → «Забрать» → жетон с планеты Титана → капсула → тик → RETURN в спутник → стейдж уходит; `console-colony-remote-bonus` (Плутон) — без изменений.
Регрессия на своём снапшоте, до / после: `console-biological-simulations` (A), `console-recv-perf-probe`, `console-self-target`, `console-staged-play`,
`console-aerial-mappers`, `console-supercomputer` (C), `console-expedition-mechs`, `console-aquatic-research-station`, `console-trade-target-step`,
`console-habitat-science`, `console-parliament-{aquifer, medical, cloud, colonial}`, `console-arboretum`, `console-red-museum`, `console-colony-{remote-bonus,
miranda-bonus, venus-trade}`, `console-prompt-family`, `console-effect-decision*`, `console-board-card-bonus-concurrency`, `console-rail-landing`, `aaa-driver-canary`;
`npm run e2e:affected`. `npm run build:test` обязателен.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Контактный лист: (1) **четыре хоста одной грамматики на одном листе** — стадия «Разыграно» (эталон) · композер действия · плита живого промта (с поля / колония /
карта) · приёмник на поле: PRESENT / PAY / READ / RETURN кадр за кадром; «что здесь слабо?» по каждому; (2) ДО / ПОСЛЕ случая (3): нырок `runHeroPick` против
сцены — на стендах 2 и 3; (3) источники: жетон рождается на клетке / планете / значке — виден ли конец (свидетель `endsOverGlass` пуст); (4) паритет
действия (решение 6) A/B; (5) соперник: сцена у чужого тайла, нотификация; (6) витрина EN / RU, плитка, причины недоступности, near-miss. Пробник долей блоков
(`auditStage`) на плите; `type ladder`; «пауза» измеряется (`longtask`).

## 6. ПОЛИРОВКА ПО ПУТИ (здесь владелец ЗАКАЗАЛ итерацию: бюджет = один стандарт приёма во всех хостах)
Реестр: раздел **AO** «приём ресурса картой · один директор · источник с поля · плита цели семейства». **Открытые на маршруте — сперва воспроизвести:**
PL-059 (карта-получатель стейджа колонии мала — решить кадром здесь), PL-082 (зазор «тайл платит» — здесь же), PL-226, PL-227. **Кандидаты:** К-R1 уход
`runHeroPick` на промте цели (диагноз 3) — класс; К-R2 спутник тикает по apply без холда в случае (3) — холд из apply-блока; К-R3 `Game.grantSpaceBonus` без
`cause` / без `autoSelect: false` (диагноз 2 (б)); К-R4 `AresAdjacencyGrantModel.delivery 'card-resource'` объявлен, не пишется; К-R5 чужое размещение с картой
зрителя — жетон в спутник вместо карты (диагноз 6); К-R6 `presentedTargets` только для своей торговли (бонус колонии без представленной цели); К-R7 хост
рисует СВОЮ полосу кандидатов вместо `ConsolePlayedTargetStep` (три грамматики одного вопроса — диагноз 8); К-R8 резолюции: жетон без подъёма / возврата;
К-R9 леджер колоний карты и действие Учёных садятся на спутник, не на карту (диагноз 7) — класс или строка; К-R10 случай (2): жетон с печатного значка ГЕРОЯ, а не
из «источника» — для действия герой и есть источник (верно), но без READ / RETURN; К-R11 near-miss при `min` (диагноз 9). Только-Deck — не полируем (PL-105).
**Правила** — `console-ui.md` § «ПРИЁМ РЕСУРСА КАРТОЙ» (один директор, четыре хоста, источник честен, спутник — дом, уход драфта запрещён для цели,
запись с поля — факт сервера), `game-logic.md` § «ресурс на карту с поля — одна запись» и строка «действие с ЦЕНОЙ + цель «карта, где уже есть ресурс» +
условный хвост по ВИДУ ресурса цели (`extraByCard`)», `animations.md` (такты приёма, reduced motion, отделённый возврат), чеклист §4 (две строки),
`docs/TURMOIL_REDUX_FRONTIER_LABS.md` — НОВЫЙ документ контракта класса приёма (наследует следующая карта, кладущая ресурс).

## 7. Режим работы
**Коммиты**: (1) сервер общий: источники (`cause` / `fromSpace`), запись прибытия с поля, near-miss при `min`, `extraByCard` (спеки, регрессия); (2) карта + спек +
локаль + лор + арт; (3) директор приёма + перевод хостов (1) и (4) без изменения кадров (A/B) + холды спутника; (4) случай (3): плита с общим шагом цели, три
маршрута (поле / колония / карта), удаление ухода драфта, сцена с поля по записи (кадры ДО / ПОСЛЕ → **батч**); (5) случай (4): все `kind`, чужое размещение с
картой зрителя, Ares `card-resource`; (6) случай (2) паритет (по решению 6) + A/B; (7) e2e TR53 (три фикстуры) + перевод соседей; (8) документы — журнал § TR53
(правила с доказательствами, таблица «даром / руками», четыре раскадровки, A/B), правила, контракт-документ, чеклист §4, реестр AO, промт. **Коммиты полировки**
— `Polish (TR53 · the receiving card): PL-### — …`. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед
визуальной проверкой — `npm run make:css` + `npm run build:server`. **Не пушить.** Батч — после кадров случая (3) (коммит 4), ДО паритета действия.
Гочи: `turmoilReduxExpansion: true` в `testGame`; `actionsThisGeneration` при повторном `action` в юнитах; фикстура с живым промтом = стоящий `waitingFor`
получателя (очередь отложенных не сериализуется — торговлю соперника исполнять в генераторе ДО сохранения); полная перегенерация фикстур перетасует ВСЕ
Redux-фикстуры — добавлять только свои JSON; `FixtureName` — строка ДО сборки (webpack типизирует `screenshots/**`, стенд вне git — `// @ts-nocheck`);
`position: fixed` слой — всегда контекст наложения; `elementsFromPoint` не видит `pointer-events: none` — якорь геометрией; rect-пробник краску не читает;
4K-раскадровка идёт ≈ 0,3× — тайминги по пробнику; e2e-сэмплер — `setInterval`; `eqeqeq` без исключения для null; `rtk grep` с фиксированной строкой / `'`
виснет — Grep-инструмент; RTK-хук съедает `\\` — такие правки Edit-инструментом; ключи с `${0}` — только Edit / Write (скрипт `.mjs` интерполирует);
`npm run build:server`, не голый `tsc`; снапшот только после конца сборки; юниты — на тихой машине; реестр — footer и букву раздела читать в момент записи;
`cinematicBeat(page, ms, why)` вместо `waitForTimeout`; плита семейства — размер по тиру, профили — токены; `title` запрещён.
**В отчёте:** таблица правил 1–13 с доказательствами; «даром / руками»; четыре раскадровки хостов ДО / ПОСЛЕ на 4K; A/B длительности (1), (2), (4); что
выбрал владелец и почему; регрессия (юниты / гарды / lint / e2e по классам); новые ключи; лор.
**Раздел «ПОЛИРОВКА»** — с СОБСТВЕННЫМИ находками. **Явно — всё, что не получилось, и почему.**

## 8. Нельзя
Уход драфта (`runHeroPick` / `con-exit-reject`) на промте цели; жетон из синтетического источника (только клетка / планета / печатный значок / севшая карта
/ карта закона); тик капсулы или спутника РАНЬШЕ касания (холд из apply-блока); сцена с поля из ДИФФА видов (только запись сервера); вторая полоса
кандидатов рядом с `ConsolePlayedTargetStep`; второй директор приёма для одного хоста; `v-if`-моргание плиты под сценой (парк, отделённый полёт);
`filter` для recede (только `opacity` / масштаб); авто-выбор при ≥ 2 кандидатах; скрытый держатель с 0 (показан с причиной); условный добор как промт;
второе вычисление «наука ли» на клиенте (маркер `extraByCard` — от сервера); `title`; литерал имени карты в `src/client/**`; литерал кнопки контроллера;
определение промта по заголовку; `compatibility`; e2e сверх одного спека (соседи — переводом); полировка только-для-Deck; `shardPlan.json`; файлы соседа в
своём коммите; пуш и красные коммиты.
