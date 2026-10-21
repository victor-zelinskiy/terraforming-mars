# Промт исполнителю · T06 GMO Contract («Контракты на ГМО») — вторая классическая карта Turmoil под Redux, «на месте» (§3.1): синяя (ACTIVE), 3, метки Микроб + Наука; «Зелёные правят ИЛИ 2 ваших делегата на их резолюции»; ЭФФЕКТ: «каждый раз, когда вы разыгрываете метку растения / животного / микроба (включая эту) — +2 M€» (за КАЖДУЮ метку; близнец — Decomposers) · первая классическая карта С ЭФФЕКТОМ: двойник прогноза `cardPlayedForecast` + ответ стола, который ЛЕТИТ · ГЛАВНОЕ — БОЛЬШАЯ ИТЕРАЦИЯ ПОЛИРОВКИ ПОЛЁТОВ (≈ 75 %) «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ»: (1) жетон НИКОГДА не летит в координату, где объекта уже нет — конец полёта = объект, перемеренный в тот кадр, когда он важен (рождение / финальный подлёт), не точка, кэшированная при нажатии; (2) чужая награда с поля садится НА ЯВНУЮ ПРИЁМКУ чипа места, которая загорается ДО прилёта и тикает на касании — либо не летит вовсе (решение владельца по макетам)

> **Статус: ВЫДАН 2026-10-21.** HEAD `2551111a7b` (T04 сдана целиком: c9f7f7fd39…2551111a7b, не запушено) + НЕЗАКОММИЧЕННЫЙ лор владельца
> `T06` в `assets/text/lore_texts.json` (печатная цитата карты — закоммитить ПЕРВЫМ ханком). Арт — `C:\Users\zelin\Downloads\Mars Arts\T06.png`
> (1536×1024, стандартный кадр). Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T06 - GMO Contract.png`.

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (шесть шагов; после T04 — §2.2 имена списка в `src/common/cards/turmoilReduxAdaptation.ts`,
правило скоупа `src/common/cards/premiumScope.ts`), `docs/claude/turmoil-redux-card-checklist.md` (§2 арт / лор / RU / `card_info`; §3 гарды-ворклист;
**§7** «Профили» · «Премиум-планка» · «Качество полировки» — ссылаться, не повторять), `docs/claude/expansion-adaptation-checklist.md` (таблица
подсистем — строка **Effect FORECAST**: твин у каждого живого хука, `FORECAST_HOOK_PAIRS` — закон), `docs/claude/console/effect-forecast.md`
(двойник, «Сработает», R3-слой; `:535` — ОТКУДА летит ответ: `.pcard-tag[data-tag=<tag>]` приземлившейся карты), `docs/claude/console/played-table.md`
(сцена «Разыграно», два хоста), `docs/claude/console/workspace-band.md` § ACTION COMMIT и § РОЗЫГРЫШ КАРТЫ (`:1578–1600` — «ресурсы материализуются
из интерфейса», ось `fromBoard`), `.claude/rules/console-ui.md` **§ THE ENDS OF A FLIGHT ARE VISIBLE `:117–134`** (закон владельца: оба конца
ОКРАШЕНЫ в тот момент, когда конец важен; «измерим ≠ видим»; отделённый полёт PL-165) и `:224` («…AND A GAIN IS A REWARD», закон якоря дельта-чипа,
PL-220 ответ летит с чипа «Сработает»), `.claude/rules/animations.md:39–45`, CLAUDE.md «Physical causality» («a result OUTLIVES the surface that
produced it: it detaches into an app-level layer, the workspace collapses, and only then does it fly to the MEASURED destination») и инвариант 6.
Память: `polish-remediation-iteration-1` (закон видимости концов; гочи свидетеля: `elementsFromPoint` не видит `pointer-events: none`; ожидание
адреса за уходящей полосой — СТРОГОЕ, точка должна устояться два опроса — «иначе жетон летит в старую позу»), `final-approach-retarget`
(**ретаргет финального подлёта** по живому ректу, `RETARGET_AT ≈ 0.8` — робастнее un-map), `flight-aims-at-resting-rect` (`restingRectOf` — рект
покоя, минус собственный перенос), `board-scene-gate-and-flight-demotion` (`fromBoard`, z-демоция, `waitBoardSceneQuiet`), `console-chip-conveyor`
(лента чипов мест в топ-баре — один драйвер; FLIP вокруг патча Vue — чип места ДВИЖЕТСЯ на смене поколения), `notification-source-and-glance-rule`,
`tr56-where-it-lands`, `polish-priority-tv4k-no-deck-only`, `polish-direction-smoothness`, `storyboard-catches-what-the-probe-passes`,
`batch-decisions`, `turmoil-redux-classic-cards` (решения T04 1–6 — приняты, не переспрашивать), `concurrent-session-edits-same-files`,
`e2e-spec-rot-contract`, `shell-template-escapes`, `perf-on-gpu`. Журнал — `docs/claude/turmoil-redux-cards-progress.md` (запись T04 — формат и
место следующей), реестр — `docs/claude/gameplay-polish-ledger.md` (на выдаче следующий свободный **PL-829**, последний раздел **BV** → эта
задача берёт **BW**; сверить footer на своём HEAD в момент записи).

**Образцы — по частям, не целиком:** **Decomposers** (`base/Decomposers.ts:44–62`) — ТОТ ЖЕ счёт `tags.cardTagCount(card, [ANIMAL, PLANT, MICROBE])`,
тот же `onNonCardTagAdded(PLANT)`, двойник `cardPlayedForecast` с `forecast.exact` + «включая эту» (самосрабатывание при розыгрыше самой карты —
её спек и путь движка `Player.ts:1706 → onCardPlayed(selectedCard)` → `:1726–1745` обходит `tableau` УЖЕ с новой картой); **Media Group**
(`base/MediaGroup.ts`) — M€ на розыгрыш через отложенное → `forecast.AFTER_CARD_GAIN`; **T04** (`turmoil/DiasporaMovement.ts` + спек + промт
`docs/claude/prompts/classic-t04-diaspora-movement.md` — §-блоки карты, фикстуры `parliamentFixture`, e2e канала); закон видимости —
`resourceTransfer/transferEndVisible.ts`, лестницы `consoleResourceTransfer.ts:883–1052` (`measureRect` / `measureRestingRect` / `targetPointFor`),
отделённый полёт `:593, :748–790` (`detachable`, `awaitVisibleDestination`); ответ стола на розыгрыш — `played/consolePlayedHero.ts:1888–1965`
(`flyHeroReactions`, `receiveOnStage`, `heroTagOrigin :1971`), источник сцены `standingSourceEl :1353`; волна ACTION COMMIT —
`ConsoleShell.vue:20749–20790` (`runCommitRewardWave`: «origins cached at submit — the flight never depends on the workspace outliving the
answer»); чип места — `tilePlacement/cityDataPayoutBeat.ts:181–199` (`seatChipPoint`: точка на 16·ui px НИЖЕ цветной точки чипа; фолбэк — центр
верха экрана), `consoleRemotePlacement.ts:1247–1262` («another seat's card is not on this screen: its units fly to that seat's chip»),
`ConsoleStatusStrip.vue:18–45` (чип: `.con-status__player[data-color]` · `.con-status__dot` · имя · статус — ПРИЁМКИ НЕТ: ни тика, ни счётчика,
ни свечения); свидетель — `tests/e2e/transferWitness.ts` (`armTransferWitness` / `transferWitness` / `endsOverGlass` / `effectiveVisibility`).

---

## Диагноз (подтверждён файл:строка на `2551111a7b`; перепроверить на своём HEAD)

### Карта
1. **Правила.** `turmoil/GMOContract.ts`: ACTIVE, 3, `[MICROBE, SCIENCE]`, `requirements: {party: GREENS}`, `onCardPlayed` → `cardTagCount × 2` M€
   через `player.defer(() => stock.add(…, {log: true}))`, `onNonCardTagAdded(PLANT)` → +2. Требование — уже на фасаде (T04). Самосрабатывание
   «включая эту»: движок зовёт `onCardPlayed` по всему `tableau` ПОСЛЕ добавления карты (`Player.ts:1706, :1726`) — апстрим-спек зовёт хук руками,
   но в партии +2 за свой микроб приходит сам (спек T06 пинит ОБА: движком и руками не дважды). Не-карточную метку растения даёт только Underworld
   (`UnderworldExpansion.ts:424`; `Colony.ts:178` / Delta — наука / Юпитер) — вне скоупа, форкаст-пары на `onNonCardTagAdded` нет
   (`effectForecast.ts:1352–1365`), гард не требует; MarsBot-реакции (`AutomaHumanTagReactions.ts:92` `SANCTIONED_NON_CARD_REACTORS`) — GMO
   отвечает только СВОИМ меткам, в список не входит.
2. **Что требует работы.** (а) `cardPlayedForecast` — обязателен (`effectForecastCoverage` падает с именем); amount = `cardTagCount × 2`,
   `AFTER_CARD_GAIN` (отложенное), «включая эту» — как у Decomposers; `effectForecastParity` — триггер «своя карта с меткой растения / животного /
   микроба» (несколько меток → ×2 каждая; чужой розыгрыш — ничего; `TRIGGERS` / `VARIANTS` при нужде). (б) `effect-short`: правило длиннее 52 —
   `infoText` `effect-short` (EN «Plant, animal or microbe tag played: +2 M€ each» + RU) — бюджет мерить и по RU `turmoil_cards.json` РУКАМИ
   (чеклист §2). (в) RU (`turmoil_cards.json:18–20`): имя есть («Контракты на ГМО»); требование — опечатка и голос классики («Зелёные в правящий
   партии…») → голос набора «Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на их резолюции.» (`turmoil_redux_cards.json:110`);
   эффект — «Эффект: за каждую разыгранную вами метку растений, животных или микробов, включая эту, получайте 2 M€.» (сейчас «разыгрывая метки…
   получайте 2 M€» — теряет «за каждую»). (г) `card_info.json` RU из аудита; `cardNumber: 'T06'` — верен; лор EN `T06` (печатный) — RU:
   «Особое разрешение на неограниченное использование генетически модифицированных организмов.»; арт — импорт. (д) Строка `GMO_CONTRACT` долой из
   `src/common/cards/turmoilReduxAdaptation.ts:45` + пин «as of the last adaptation» в `TurmoilCardsUnderRedux.spec` (2 из 22) + спеки, считающие
   пул Redux-стола (`PoliticalThinkTank.spec` — класс, T04).
3. **Ответ стола на розыгрыш — ЭТО полёт.** С GMO на столе розыгрыш Lichen показывает в композере «Сработает: +2 M€ · Контракты на ГМО»
   (двойник), а после A ответ ЛЕТИТ: `flyHeroReactions` — чип рождён на ПЕЧАТНОЙ МЕТКЕ растения приземлившейся карты (`heroTagOrigin`), садится на
   чернила строки M€. Карта — естественный свидетель проблемы 1.

### Полёты — проблема 1 («летят в координату, где карты уже нет»)
4. **Кэшированные ТОЧКИ вместо объектов.** `ConsoleShell.runCommitRewardWave` (`:20766`): `origins: plan.origins`, `source: {point: plan.sourcePoint}`
   — точки, замеренные ПРИ НАЖАТИИ («the flight never depends on the workspace outliving the answer»). Если к моменту ответа сервера композер
   сложился (отмена, вытеснение другим шагом, сцена, медленный ответ) или раскладка сдвинулась (`con-root--ws-open` снят — поле и рельс едут), жетон
   рождается ТАМ, ГДЕ КАРТА БЫЛА. Точка — не объект: у неё нет вердикта видимости (`transferEndVisible` применяется к СЕЛЕКТОРАМ, `source.point`
   проходит мимо — `resolveSourceRect :924`). Та же форма у `destination: {x, y}` (`consolePlayedHero.ts:1144, :1198` — loss-цепочки, точка
   строки оплаты) и у `seatChipPoint`.
5. **Первый ИЗМЕРИМЫЙ, не ВИДИМЫЙ.** `consolePlayedHero.standingSourceEl` (`:1353–1364`) и `heroTagOrigin` (`:1971–1983`) берут первый элемент с
   `getBoundingClientRect` ≥ 10 px — мимо закона (`firstVisibleEnd`): складывающаяся сцена «Разыграно» (opacity 0.3, уходит), слот в доке под
   стеклом — «место» для них. Это ровно класс PL-137 / PL-162, не доведённый до этих двух функций.
6. **Посадка планируется ОДИН раз.** `runTransferFlight` строит дугу от `to`, замеренного на запуске (`transferArcPlan`); перемера на финальном
   подлёте нет (`final-approach-retarget` сделан для карт в док, не для жетонов). Адресат, уехавший за ~600 мс полёта (сложившийся композер —
   капсула героя; рельс, сдвинутый снятием `--ws-open`; чип места, уехавший лентой на смене поколения), получает жетон в СТАРУЮ позу. Отделённый
   полёт (PL-165) закрывает только «адрес накрыт на старте» (`detachable` — только `covered`), не «адрес уехал / исчез в полёте».
7. **Синтетические точки.** `seatChipPoint` без чипа → `{innerWidth/2, 72·ui}`; `sourceSpawnPoint` от рект-точки `w: 0, h: 0` (`:925`) — жетон «из
   точки»; это и есть «летит в никуда» второго рода. Закон: нет конца — нет полёта (честный деград с тиком), никогда синтетика.
8. **Нет сторожа в рантайме.** Свидетель живёт только в e2e (`transferWitness`); продакшен не знает, что родил жетон над пустотой. Деград называется
   в трассе (`trail`), но «конец был окрашен в кадр рождения / касания» никто не утверждает.

### Полёты — проблема 2 («чужая награда с поля — в никуда»)
9. **Адресат чужой выплаты — точка ПОД чипом.** `seatChipPoint`: центр цветной точки чипа места + 16·ui px вниз — жетон садится в воздух под чипом;
   у чипа места НЕТ приёмки (`ConsoleStatusStrip.vue:22–41`: точка, имя, статус, бикон — ни счётчика ресурсов, ни тика, ни бита контакта). Игрок
   видит жетон, летящий вверх-влево от клетки, и не знает, куда: «в мою левую панель и промахнулся» / «в никуда». Собственная выплата зрителя садится
   на чернила рельса и тикает — у неё есть ПРИЁМ; у чужой — нет. Та же точка — источник ЧУЖОГО тайла (`tileDivePlan`, PL-769): чип места уже «тело»
   соперника на экране, но безмолвное.
10. **Адресат не объявлен ДО прилёта.** Ни один адресат (рельс, спутник, чип места) не подсвечивается при РОЖДЕНИИ жетона — бит контакта играет
    только на касании (`TransferStagePiece.beat`). На 4K за 600 мс глаз не успевает найти, куда смотреть; «куда летит» читается только по факту.
11. **Шум.** Город на трёх бонусных клетках соперника = несколько жетонов разных ресурсов к одному чипу; `mergeTransferSpecs` есть, но сцена чужой
    выплаты (`runRemoteCityPayoutBeat`, `payTokens`) шлёт по жетону на единицу (`tokenGeometry`) — на 4K это рой.

## Правила карты (спек пинит каждое)
1. ACTIVE, 3 M€, Микроб + Наука, 0 ПО; на Redux-столе требование — две дороги (`satisfiesPartyRequirement`), причина руки со standing (T04).
2. Эффект за КАЖДУЮ подходящую метку разыгранной карты (две метки — +4), только свои розыгрыши; событие с меткой животного — тоже (это розыгрыш).
3. «Включая эту» — +2 при розыгрыше самой GMO (микроб) движком; хук вызывается один раз; форкаст композера GMO показывает «+2 M€ · эта карта».
4. Не-карточная метка растения — +2 (`onNonCardTagAdded`; спек через `triggerOnNonCardTagAdded(PLANT)`, без Underworld).
5. Двойник = живой хук: число, порядок (`AFTER_CARD_GAIN`), «чужой розыгрыш — ничего» (парити-гард).
6. Классический стол — байт-в-байт апстрим (его спек остаётся); раздача под Redux — «манифест − список» = {T04, T06}.
7. Журнал / карточка: «+2 M€ · Контракты на ГМО · сработало на розыгрыш «Лишайник»» — через `effect-triggered` (`events.withEffect 'card-played'`);
   source = GMO (правило источника TR59).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.5; решения T04 1–6 не переспрашивать)
1. **RU** — имя оставить; требование и эффект — в голос набора (диагноз 2в); `effect-short` курируется.
2. **Двойник** — Decomposers-форма, `AFTER_CARD_GAIN`; самосрабатывание в композере GMO показано («эта карта»).
3. **Живой конец (проблема 1, класс А)** — (а, рекомендовано) `TransferEnd` = ОБЪЕКТ: `{el?: Element, selectors?: string[], point?: TransferPoint,
   measure(): TransferPoint | undefined}`; `ResourceTransferRun.source` / `destination` / `destinationOf` / `origins` принимают конец-объект;
   голая точка остаётся ТОЛЬКО как «рождение на источнике, который уходит сейчас» — и тогда рождение обязано случиться ДО `markFoldable`
   (существующий закон поп → фолд) и проверяется вердиктом в кадр рождения (`elementsFromPoint` под точкой = источник / его `.con-ws`);
   кэшированные `plan.origins` / `plan.sourcePoint` ACTION COMMIT заменяются на ссылки на печатные узлы (`data-graphic-node` — якоря и так резолвятся
   из реальной графики) с перемером при POP; (б) оставить точки, добавить только вердикт под точкой при рождении (деград вместо полёта из пустоты) —
   минимум, если (а) не укладывается.
4. **Ретаргет финального подлёта (проблема 1, класс Б)** — (а, рекомендовано) директор перемеряет `to.measure()` на `RETARGET_AT ≈ 0.8` прогресса
   (один раз, провизорная дуга → поправка последних 20 % — память `final-approach-retarget`) и ещё раз в кадр касания; адресат, который ИСЧЕЗ
   (unmounted / hidden / covered / off-screen) — жетон переадресуется к ДУБЛЁРУ ТОГО ЖЕ ОБЪЕКТА по лестнице (`targetPointFor` — чернила строки
   рельса всегда на экране; ячейка спутника; чип места), а если и его нет — поглощается НА МЕСТЕ с тиком и записью `retarget:lost` в трассу;
   (б) только перемер на касании без поправки дуги — хуже: рывок последнего кадра.
5. **Первый видимый** — `standingSourceEl` / `heroTagOrigin` → `firstVisibleEnd` (закон); синтетические фолбэки (`seatChipPoint` центр верха;
   точка-источник `w: 0`) удаляются: нет конца → нет полёта, деград называется.
6. **Чужая награда с поля (проблема 2)** — (а, рекомендовано) **ПРИЁМКА ЧИПА МЕСТА**: чип соперника — единственное тело соперника на экране — получает
   ПРИЁМНЫЙ КАРМАН: при РОЖДЕНИИ жетона у хвоста чипа раскрывается плашка-приёмник «[иконка] +N» в тоне чипа (пустая, «ожидает» — тонкое кольцо
   приёма; та же грамматика, что контакт-бит, только ДО), жетон садится НА ЧЕРНИЛА этой плашки (закон якоря дельта-чипа), число тикает на касании,
   плашка стоит ≈ 1,2 с и складывается; несколько единиц одного ресурса — ОДИН жетон с числом (merge), разные ресурсы — одна плашка с несколькими
   иконками; ширина ленты чипов не прыгает (плашка — абсолют над лентой или в зарезервированной полосе хвоста; FLIP ленты не ломать). Макеты M1
   (плашка-хвост), M2 (кольцо приёма + число внутри чипа), M3 (квитанция у клетки без полёта — альтернатива (в)) CSS поверх живого экрана — в батч
   ПЕРВЫМ с кадрами 4K; (б) ОТКАЗ от полёта чужой выплаты: тайл садится, у клетки — короткая квитанция «player2 +2 [сталь]» (плашка клетки, PL-769-
   семейство), карточка нотификации остаётся; (в) гибрид: квитанция у клетки + плашка у чипа без жетона между ними.
7. **Адресат объявляет себя при старте (все полёты)** — (а, рекомендовано) ОДИН закон для всех адресатов: в кадр рождения жетона адресат входит в
   состояние «ожидает» (строка рельса — тонкое кольцо приёма у чернил, `con-res__row--expecting`; капсула карты; ячейка спутника; плашка чипа места),
   снимается касанием (контакт-бит) или деградом — тихо, без свечения на весь ряд («без перегруза»: одна тонкая линия в тоне ресурса, прозрачность
   ≤ .5); (б) только у чипа места.
8. **Шум чужой выплаты** — (а) один жетон на ресурс на размещение (сумма числом), волна ≤ 3 жетонов, задержка волны как у рельса; (б) как есть.
9. **Рантайм-сторож** — (а, рекомендовано) в dev-сборке каждый жетон при рождении и при касании утверждает «конец окрашен» (вердикт под точкой);
   нарушение — `console.warn('[transfer] end not painted …')` с трассой; e2e-харнесс `consoleTest.ts` (авто-фикстура после КАЖДОГО теста, как скан
   `${`) читает его как КРАСНЫЙ → каждый существующий полётный спек становится свидетелем; (б) только трасса.
10. **Объём** — карта ≈ 25 %, полёты ≈ 75 %; не трогать: разбор хода бота, сцены колоний / Парламента по существу (они клиенты рамки — чинятся
    классом в рамке, не по месту), десктоп.

## 0. Рабочее дерево
1. `git log --oneline -1` → `2551111a7b` на выдаче. **Сначала** `ListAgents` + процессы playwright; `SendMessage` живым соседям о порядке: твои
   файлы — `turmoil/GMOContract.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `resourceTransfer/{consoleResourceTransfer,
   resourceTransferModel,resourceTransferDirector,transferEndVisible,railReward}.ts`, `played/consolePlayedHero.ts` (источники и ответ стола),
   `ConsoleShell.vue` (только `runCommitRewardWave` / план коммита — `consoleActionCommit*.ts`), `tilePlacement/{cityDataPayoutBeat,
   consoleRemotePlacement,consoleTilePlacement}.ts` (адресат чужой выплаты), `ConsoleStatusStrip.vue` + `statusChipConveyor.ts` (приёмка чипа —
   НЕ ломать один драйвер ленты), `console.less` (§ статус-строка, § `.con-transfer`), `console_tv.less`, `ru/{turmoil_cards,card_info,
   lore_texts,console}.json`, доки. Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита —
   `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. Снапшот e2e — свой: `npm run e2e:snapshot t06` + `TM_E2E_ROOT=.e2e-t06`; `npm run build:server` до снапшота; кадры «до» — клиент HEAD в своём
   снапшоте (`ab-baseline-head-client-in-snapshot`); 4K — на GPU (`PERF_GPU=1`); после локалей — `npm run make:json`.
3. **Стенд** — `screenshots/t06/flights.stand.spec.ts` (вне git) — ЧЕТЫРЕ сцены × {tv4k GPU, fhd}, каждая со свидетелем (`armTransferWitness`)
   + сэмплер DOM 100 мс (`setInterval`, не rAF) + трасса `resourceTransferState`: (а) розыгрыш Lichen при GMO на столе — ответ стола с метки на рельс;
   (б) розыгрыш карты с выигрышем «на эту карту» + сток (сцена «Разыграно» хост `workspace`) — и тот же розыгрыш, когда сцена ВЫТЕСНЕНА (шаг /
   отмена / `B` во время `executing`, искусственная задержка ответа `page.route` на `/api/player/input` 1,5 с — воспроизвести «композер сложился
   до волны»); (в) ACTION COMMIT синей карты со стоком и «на эту карту» (`aerial-mappers` фикстура / `console-aerial-mappers`) с той же задержкой
   ответа; (г) ЧУЖОЕ размещение города на бонусных клетках (второй клиент, как в `console-play-tr-reward` / `console-colony-remote-bonus`) —
   выплата к чипу места; и смена поколения во время полёта (лента чипов едет). По каждому рождению / касанию — «что окрашено под точкой» (таблица).
   Это ДИАГНОЗ: классы 4–7 подтвердить числами ДО кода; то, что не воспроизвелось, — честно в отчёт.
4. Фикстуры — ТОЛЬКО свои JSON; имена в `FixtureName` ДО сборки (`parliamentFixture`, образец T04): `gmo-contract` — Redux-стол 2 места, Зелёные
   ПРАВЯТ (`seatEnacted(quietResolutionOf(GREENS))` — тихая только под нейтральным победителем, `quietWinnerIndex`), GMO УЖЕ на столе p1, в руке
   Lichen (растение, +2) и Ecology Research (колонии: растение + микроб + животное, без требований → +6 — проверить по каталогу на своём HEAD),
   M€ ≥ 30;
   `gmo-contract-hand` — GMO в руке (самосрабатывание +2), Зелёные правят; `gmo-contract-locked` — не правят, 1 делегат p1 на их резолюции;
   `rival-city-payout` — p2 перед размещением города у клеток со сталью / растениями, зритель p1 (чужая выплата к чипу p2).

## 1. Сервер — карта (≈ 15 %)
1. `GMOContract.ts`: `cardPlayedForecast` (Decomposers-форма × 2 M€, `stockGain`, `AFTER_CARD_GAIN`), `infoText` `effect-short`; хуки не менять;
   `description` — как есть. RU — диагноз 2в; лор RU; арт `node scripts/import-card-art.mjs "<путь>/T06.png" T06` → `npm run make:cards`;
   `card_info.json` RU по аудиту (0 / 0 / 0). Строка долой из списка + пин (диагноз 2д).
2. Спек `tests/cards/turmoil/GMOContract.spec.ts`: классический блок остаётся; `describe('on a Turmoil Redux table')` — правила 1–7 (две дороги с
   причиной; +2 за микроб самой GMO движком — один раз; +2 / +4 по меткам; событие; чужой розыгрыш — 0; `triggerOnNonCardTagAdded(PLANT)` → +2;
   двойник = хук; save / load).

## 2. Клиент — карта (≈ 10 %)
- Лицо (effect-ряд печатается DSL), «Эффекты» (авто-экстракция `effect()`), «Сработает» (двойник), карточка нотификации (источник GMO) — даром;
  расхождение = класс. e2e карты — §5.3 (она же свидетель сцены (а)).

## 3. Клиент — ГЛАВНОЕ: «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ» (≈ 75 %)
### 3.А Конец = объект (решения 3–5)
- `resourceTransferModel.ts`: `TransferEnd` + `endOf(el | selectors | point)`, `measure()` через `firstVisibleEnd` + `restingRectOf`; `TransferPoint`
  остаётся математикой дуги. `consoleResourceTransfer.ts`: `resolveSourceRect` / `targetPointFor` / `destinationOf` → концы; голая точка —
  только с вердиктом под ней в кадр рождения (`run.source.point` → `paintedAt(point)`: `elementsFromPoint` ∈ источник / его `.con-ws` / слой
  полётов / `pointer-events: none`-сцена — иначе деград `no-source:unpainted`). `ConsoleShell.runCommitRewardWave` / `consoleActionCommit*`: план
  несёт УЗЛЫ (`data-graphic-node`, `.pcard__cost-badge`, строки рельса), не точки; рождение перемеряет; если узел ушёл (композер сложен раньше
  волны) — деград с именем, НИКОГДА полёт из старой позы. `consolePlayedHero.ts`: `standingSourceEl` / `heroTagOrigin` → `firstVisibleEnd`;
  loss-цепочки — концы. `seatChipPoint` → `seatChipEnd(color)` (объект чипа; фолбэка нет).
- `resourceTransferDirector.ts`: `runTransferFlight(opts)` принимает `to: TransferEnd`; на `RETARGET_AT` — `to.measure()`; смещение > 2 px →
  поправка хвоста дуги (линейная интерполяция остатка — без рывка, тот же `onUpdate`); конец исчез → `retarget: 'lost'` → лестница дублёров
  (`targetPointFor` по спеку без `targetCard` → строка рельса / спутник / чип) → иначе поглощение на месте + тик (`onArrive`) + трасса. Reduced
  motion — как раньше (ничего не летит).
- Спеки (jsdom): `consoleResourceTransfer.spec` § живые концы (точка над пустотой → деград; узел ушёл до рождения → деград; адресат уехал на 0.8 →
  посадка на новый рект; адресат размонтирован → дублёр / на месте), `resourceTransferDirector.spec` § ретаргет без рывка (последние кадры
  монотонны), `consolePlayedHero.spec` § первый видимый.
### 3.Б Приёмка чипа места + «адресат объявляет себя» (решения 6–8)
- `ConsoleStatusStrip.vue`: плашка-приёмник `.con-status__intake` у чипа (`data-intake-seat`, иконки `iconClassFor`, число — тот же `AnimatedMetricValue`
  / `ConsoleFlipValue`, что у рельса; состояния `expecting` → `received` → fold; абсолют над лентой или полоса хвоста — ширина чипа и лента не
  прыгают: гард геометрии ленты `statusChipConveyor.spec` зелёный); модель `console/statusIntake.ts` (чистая: открыть / принять / сложить, merge по
  ресурсу, таймеры через `motionMs`). `cityDataPayoutBeat.runRemoteCityPayoutBeat` / `consoleRemotePlacement` / `consoleTilePlacement:1561`:
  адресат = `seatChipEnd` → чернила числа плашки; `onArrive` → тик плашки; один жетон на ресурс (решение 8). Смена поколения: лента едет — конец
  перемеряется (3.А) — жетон догоняет чип.
- Состояние «ожидает» у всех адресатов (решение 7): `con-res__row--expecting` (рельс), капсула, спутник, плашка чипа — ставится в кадр рождения
  (`onBorn` рана), снимается на касании / деграде; одна тонкая линия в тоне ресурса, никакого свечения ряда; e2e-пробник: в кадре рождения адресат
  уже в `expecting`.
- Собственная выплата зрителя с поля — без изменений по существу (рельс), только «ожидает» и живой конец.
### 3.В Рантайм-сторож (решение 9)
- `consoleResourceTransfer.ts`: dev-вердикт при рождении и при касании (`paintedAt`) → `console.warn('[transfer] end not painted', {run, spec,
  end, under})`; `tests/e2e/consoleTest.ts` — авто-фикстура: любой `[transfer]`-warn за тест = красный (как скан `${`); прогнать репрезентативный
  набор полётных e2e (`console-aerial-mappers`, `console-play-tr-reward`, `console-colony-reward-rail`, `console-colony-build-flight`,
  `console-parliament-sitting-reward`, `console-resource-distribute`, `console-action-resource-pick`, `console-auto-tile-landing`,
  `console-colony-remote-bonus`) `--workers=1` — всё, что покраснело, — находка класса, чинится ИЛИ строка реестра с именем спека.
### 3.Г Пол TV
- § 23 / статус-строка `console_tv.less`: плашка-приёмник ≥ пола; размер жетона по `conUiScale` — как есть.

## 4. Лицо, локаль, лор, арт
Арт T06; лор EN (ключ владельца) + RU; RU карты — диагноз 2в; новые EN-ключи UI: подписи плашки приёмника («+${0}» — существующий формат дельта-чипа
переиспользовать), трасса — без локали; `grep` ключа по всем `src/locales/*/*.json` ДО добавления; RU чужих не переписывать (кроме строк T06 —
решение T04 3).

## 5. Тесты
1. Спек карты (§1.2); гарды после удаления строки: `effectForecastCoverage` / `effectForecastParity` (новый субъект), `cardInformation`,
   `effectCaption` (`effect-short`), `requirementProse`, `premiumCardViewModel`, `premiumCardIcons`, `cardLore` (T06), `effectExtraction` /
   `effectSummaryCoverage` / `effectFamilyCoverage` (новая синяя карта — семья «за метку»), `crossPlayerCoverageGuard`, `TurmoilCardsUnderRedux`
   (пин: T04 + T06), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`, `glyphLiteralGuard`, `e2eLiveness`, `lessDeadSelectorGuard`.
2. Юниты полётов — §3.А; `statusIntake.spec`; `statusChipConveyor.spec` (лента не прыгает с плашкой); `rewardPayoutQuiet.spec` (ожидание тишины
   поля учитывает плашку — не блокирует).
3. e2e карты `tests/e2e/console-classic-gmo-contract.spec.ts` (standard-1080 + tv4k GPU): `-locked` — причина «1 из 2» + две дороги в X; `-hand` —
   композер GMO: «Сработает +2 M€ · эта карта» → A → +2 после посадки; `gmo-contract` — Lichen: строка «Сработает +2 M€ · Контракты на ГМО» → A →
   свидетель: жетон РОЖДЁН на окрашенной метке растения приземлившейся карты (под точкой — `.pcard-tag[data-tag=plant]` / сцена), СЕЛ на
   окрашенные чернила M€ (`.con-res__row--megacredits .con-res__digits`), тик на касании; карта с двумя метками — «+4»; журнал / карточка с
   источником GMO. **Оправдание спека:** первая классическая карта с живым эффектом и летящим ответом стола (чеклист §5).
4. e2e полётов: `console-flight-live-ends.spec.ts` (fhd + tv4k) — сцены (б) и (в) стенда с задержкой ответа 1,5 с и вытеснением композера: ни одного
   `[transfer]`-warn, каждое рождение / касание — на окрашенном конце (`endsOverGlass` пуст), ретаргет при сдвиге рельса (снятие `--ws-open` во
   время полёта) — посадка на ЖИВЫЕ чернила (рект на касании = рект цели в этот кадр ± 2 px); `console-rival-payout-intake.spec.ts` (два клиента,
   fhd + tv4k) — чужой город на бонусных клетках: в кадр рождения плашка чипа p2 в `expecting`, жетон садится на её число, тик, плашка
   складывается ≈ 1,2 с, один жетон на ресурс, лента чипов неподвижна; смена поколения во время полёта — жетон догоняет чип.
5. `npm run e2e:affected` + перевод задетых селекторов в том же диффе; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на
   тихой машине, последовательно; репрезентативный набор полётных e2e `--workers=1` (3.В).

## 6. Визуальная приёмка = РАСКАДРОВКА (чеклист §7; **4K первым**, GPU; fhd обязателен)
`screenshots/t06/{tv4k,fhd}/`: (а) четыре сцены стенда ДО / ПОСЛЕ — таблица «рождение · касание · что окрашено под точкой · расстояние до
живого ректа цели (px)»; (б) раскадровка ЧУЖОЙ выплаты ≥ 8 кадров: клетка → жетон → плашка «ожидает» → касание → тик → складывание; (в) три макета
M1–M3 плашки чипа (CSS поверх живого экрана) — в батч ПЕРВЫМ; (г) GMO: плита руки (locked), композер с «Сработает», посадка с ответом, лицо с
артом. Каждый кадр — своим глазом с дивана: «я ВИЖУ, откуда и куда летит, и вижу, что ДОЛЕТЕЛО?»

## 7. Полировка по пути
1. Реестр: раздел **BW** «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ»: диагноз 4–11 — строками (класс причины: «точка вместо объекта», «первый измеримый», «план без
   ретаргета», «синтетический конец», «адресат без приёмки», «адресат не объявлен», «рой»); находки прогона 3.В — по спеку; первый номер — по
   footer на своём HEAD (на выдаче PL-829).
2. Доки: НОВЫЙ контракт `docs/claude/console/resource-transfer.md` (сегодня рамка описана только шапками модулей + кусками `workspace-band.md`):
   один язык «источник → жетон → приёмка → дельта», конец = объект, лестницы, видимость, отделённый полёт, ретаргет, приёмка чипа места, «ожидает»,
   деграды и их имена, рантайм-сторож, гарды; закон в `.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE — «**…AND LIVE**: an end is an
   OBJECT re-measured at the frame it matters (the birth, the final approach, the touchdown) — a point cached at the press is never a landing; an end
   that is gone re-homes to a stand-in of the SAME object or absorbs in place with the tick; **a rival's gain lands on the seat chip's INTAKE**, which
   announces itself at the birth and ticks on the touchdown» + строка в `animations.md:39`; `workspace-band.md` § ACTION COMMIT (origins — узлы);
   `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T06 «СДАНА» (2 из 22), §3.1 — пункт «карта с эффектом: двойник обязателен»; чеклист §4 — строка
   «классическая карта с живым хуком → `cardPlayedForecast`»; запись в журнале (задача · сделано · решения · гочи).
3. Бэклог `weak-visuals-backlog` — строка о полётах, если есть открытая.

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка; ПЕРВЫМ ДЕЛОМ — стенд §0.3 на 4K GPU: четыре сцены ДО с таблицей (это и есть доказательство
   классов 4–7 и 9–11); макеты M1–M3 — батч владельцу ДО реализации 3.Б (3.А можно вести параллельно — она не зависит от решения 6).
2. Порядок: лор-ханк → карта (двойник, RU, арт, `card_info`, строка долой) + спек → e2e карты → 3.А конец-объект + ретаргет + первый видимый + юниты
   → 3.В сторож + прогон набора → (после батча) 3.Б приёмка + «ожидает» + e2e → пол TV → раскадровки → реестр / доки. Каждый шаг — коммит по ханкам.
3. Реестр: букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем таблица стенда ДО / ПОСЛЕ по четырём сценам, раскадровка чужой выплаты, результат прогона 3.В (сколько спеков
   покраснело от сторожа и что с ними), решения 1–10 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (6 с макетами, 7, 3 (а/б) — если
   (а) не уложилась; 1, 2, 4, 5, 8, 9, 10 — в отчёте по умолчанию), гэпы честно.
5. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Оставлять голую точку источником / адресатом без вердикта под ней; синтетический конец (центр экрана, `w: 0`); «первый измеримый» в любой
  лестнице; полёт в старую позу (ретаргет обязателен); `setTimeout` вместо холда; рывок последнего кадра.
- Второй язык приёма (своя анимация у чипа места мимо `runResourceTransfers`); свечение всего ряда / чипа; ломать один драйвер ленты чипов
  (`statusChipConveyor`) и FLIP вокруг патча; менять ширину чипа плашкой; `title`-атрибут; литерал кнопки; текст ниже пола TV; состояние только цветом.
- Менять хуки карты (`onCardPlayed` / `onNonCardTagAdded`) — только двойник; считать чужие розыгрыши; второй вызов хука «включая эту».
- Трогать разбор хода бота; сцены колоний / Парламента по месту (только через рамку); десктоп; файлы соседей; RU чужих ключей; селекторы e2e без
  перевода в том же диффе; полный regen фикстур; `git stash`; bare `git push`.
