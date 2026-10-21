# Промт исполнителю · T04 Diaspora Movement («Космическая диаспора») — ПЕРВАЯ классическая карта Turmoil под Redux (путь «на месте», §3.1): зелёная (автоматическая), 7, метка Юпитера, 1 ПО; «Красные правят ИЛИ 2 ваших делегата на их резолюции»; «получите 1 M€ за каждую метку Юпитера в игре, включая эту» — декларативная · ГЛАВНОЕ В КАРТЕ — ДВА ОБЩИХ РЕШЕНИЯ, которые наследуют остальные 21: (1) премиум-скоуп модуля `turmoil` = «модуль МИНУС hold-back-список» (карта входит в каждый гард в момент, когда её строка покидает список) и (2) Executor `behavior.turmoil.*` → фасад `game.politics` · ПОЛИРОВКА (≈ 55 %) — ИТЕРАЦИЯ «КОЛОДА ВИДНА ДО СТАРТА»: создатель партии / кампании показывает СОСТАВ КОЛОД по выбранным дополнениям (сколько и каких карт), описания «Кризис: Возвращение» и «Гидросети» — одна фраза в голосе соседей, колода «Дополнения» и брифинг — премиум-впечатление первого экрана на 4K

> **Статус: ВЫДАН 2026-10-21.** HEAD `9b5fd2dee9` (включение классических карт; не запушено) + НЕЗАКОММИЧЕННЫЙ лор владельца
> в `assets/text/lore_texts.json` (ключ `T04` — ЭТОТ файл трогает только эта задача: закоммитить лор первым ханком).
> Арт — `C:\Users\zelin\Downloads\Mars Arts\T04.png` (1536×1024, стандартный кадр — импорт без `--force`).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` ЦЕЛИКОМ (§3.1 — шесть шагов карты «на месте»; §4.2 — строка Diaspora Movement; §5 — что
открыто: Executor), `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §2 арт / лор / RU / `card_info`; §3 гарды-ворклист;
**§7** — «Профили» (TV 4K сперва), «Премиум-планка», «Качество полировки» — ссылаться, не повторять), `docs/claude/expansion-adaptation-checklist.md`
(Step 1 — список SCOPE-точек; таблица подсистем; «The expansion-specific gotchas» § Turmoil), `docs/claude/console/pregame-showcase.md` (§6 создатель
— брифинг миссии; §9 как расширять), память `tr68-pregame-showcase` (гочи витрины: `SKIP_TS_CHECK`, `make:json` после локалей, сэмплер
только по `setInterval`, `minmax(…,1fr)` в незаданной высоте, CRLF в `console_*.less`), `turmoil-redux-classic-cards`, `reuse-existing-icons-check-scan`,
`polish-priority-tv4k-no-deck-only`, `polish-direction-smoothness`, `batch-decisions`, `concurrent-session-edits-same-files`, `e2e-spec-rot-contract`,
`shell-template-escapes`. Правила — `.claude/rules/{game-logic,server,console-ui,client-ui,animations,tests,localization}.md`
(`console-ui.md:612–618` — закон «THE PREGAME IS A SHOWCASE»). Журнал — `docs/claude/turmoil-redux-cards-progress.md` (запись
«Классические карты Turmoil под Redux — включение + hold-back-список — 2026-10-21» `:5470` — формат и место следующей записи), реестр —
`docs/claude/gameplay-polish-ledger.md` (на выдаче следующий свободный **PL-817**, последний раздел **BU** → эта задача берёт **BV**; сверить
footer на своём HEAD в момент записи).

**Образцы — по частям, не целиком:** карта с требованием партии и декларативным телом на Redux-столе — **TR33 Reds News Outlet**
(`turmoilRedux/RedsNewsOutlet.ts`; спек `tests/cards/turmoilRedux/RedsNewsOutlet.spec.ts:103–131` — ОБЕ дороги требования:
«1 of 2», два делегата, `seatEnacted(quietResolutionOf(R))` → `rulingParty() === R`; RU-голос требования `turmoil_redux_cards.json:87–91`), причина руки «партия не правит · делегатов
N из 2» — `models/unplayableReasons.ts:332–352` (`partyRequirementStanding`); счёт метки ВСЕХ игроков — **Galilean Waystation**
(`colonies/GalileanWaystation.ts:19`, `production {tag: JOVIAN, all: true}` — тот же `Counter.ts:199–217`, в скоупе, превью / «почему»
уже ходят); виджет-счётчик с калиброванным тактом — `ConsoleFlipValue.vue` (HUD: «старое складывается, новое разворачивается»); широкий
создатель TR68 — `ConsoleExpansionsDeck.vue`, `console_menu.less:1719–1790` (база) и `:2345–2368` (wide), `ConsoleLaunchPanel.vue:36–43`
(блок «Дополнения» — только эмблемы), `ConsoleLaunchConfirm.vue` (плита «Центр управления»); read-only API-маршрут —
`routes/ApiGameBoardCellPreview.ts` (+ `server/requestProcessor.ts:113` таблица путей, `responses.ts:48` список превью-маршрутов).

---

## Диагноз (подтверждён файл:строка на `9b5fd2dee9`; перепроверить на своём HEAD)

1. **Карта уже почти «бесплатна».** `turmoil/DiasporaMovement.ts` — `Card`, `requirements: {party: REDS}`, `behavior.stock.megacredits
   {tag: JOVIAN, all: true}`, `victoryPoints: 1`. `PartyRequirement.satisfies` (`:31`) читает `game.politics?.satisfiesPartyRequirement`
   → на Redux-столе требование УЖЕ значит «Красные правят ИЛИ ≥ 2 своих делегатов на их резолюции» (`Parliament.ts:736`), причина руки
   уже именована (`unplayableReasons.ts:340`). `Counter.ts:199–217` при `all: true` считает сырые метки всех игроков; «включая эту» —
   апстрим-спек ждёт 3 M€ (своя CTC + чужая MFT + сама карта). **Серверной работы по правилам — ноль.** Работа — скоуп, спек Redux-стола, лицо,
   лор, арт, RU, строка долой из списка.
2. **`cardNumber: 'TO4'` — опечатка апстрима (буква O).** Соседи — `T01…T16` (`turmoil/*.ts`). Арт и лор ключуются
   `metadata.cardNumber` (`cardArt.ts:78`, `cardLore.spec.ts:78`): с `'TO4'` лор владельца `T04` и арт `T04.webp` НИКОГДА не найдутся.
   `grep -rn "TO4" src tests` — только эта строка. → решение 2.
3. **RU.** Имя УЖЕ есть — «Космическая диаспора» (`src/locales/ru/turmoil_cards.json:11`); RU описания (`:12`) с опечатками
   («правящий партии», «вклюячая») и в голосе классики; голос набора для того же требования — «Требует, чтобы «Красные» были у власти или у
   вас было 2 делегата на их резолюции.» (`turmoil_redux_cards.json:87–91`). → решение 3.
4. **SCOPE-точки — по МОДУЛЮ, и это ловушка.** `grep -rn "new Set<GameModule>" tests src` — ≈ 40 гардов (`tests/models/*Coverage*`,
   `cards/{cardInformation,requirementProse}`, `client/.../{cardLore,premiumCardViewModel}`, `notifications/crossPlayerCoverageGuard`,
   `parliament/{DivertedResearchSweep,UnmiVetoSweep}`, …) + 2 точки в исходниках (`tools/cardInfo/buildCardInformation.ts` `SCOPE_MODULES`,
   `premiumCard/PremiumCardsPlayground.vue:148`). Добавить `'turmoil'` как есть = все 22 карты (включая 4 корпорации и 4 бесподобных) входят
   в КАЖДЫЙ гард разом: лор EN + RU на 22 карты (лор кладёт владелец, положен — один), `card_info` RU на 22, кураторство бесподобных —
   это «адаптировать всё сразу», против решения владельца «по одной». → решение 4: **скоуп = премиум-модули ∪ (`turmoil` − hold-back-список)**.
   Карта входит во все гарды В МОМЕНТ, когда её строка покидает `TURMOIL_CARDS_TO_ADAPT_IN_PLACE` — ворклист и скоуп становятся одним объектом.
5. **Executor читает классику.** `behavior/Executor.ts:274` (`canExecute`: `Turmoil.getTurmoil(game).getAvailableDelegateCount`) и `:743–760`
   (`execute`: `turmoil.addInfluenceBonus(player)`; `SendDelegateToArea` — `manyParties` × `count`). Фасад (`politics/PoliticalOps.ts:57–100`)
   УЖЕ умеет `addInfluenceBonus(player, bonus, source)` и `delegatesInReserve(player)`; **глагола «поставить N делегатов» у фасада нет** —
   Redux-шаг `parliament/PlaceDelegatesOnResolution.ts:93` (TR03), классика — `deferredActions/SendDelegateToArea.ts:18`. Владелец велел
   решить это НА ЭТОЙ карте (→ решение 5), хотя сама T04 этого не читает: правка — инфраструктура под Event Analysts / Martian Media Center /
   Cultural Metropolis, их строки ОСТАЮТСЯ в списке (им ещё нужны лицо, спек, превью).
6. **Создатель ничего не говорит о колодах.** `createGameMeta.ts:26–38`: описание «Кризис: Возвращение» (`:38`) — три предложения, включая
   правило озеленения за 2 РТ (свод правил, не описание); «Гидросети» (`:34`) — одно предложение на 150 знаков; соседи — 55–75 знаков, одно
   «Добавляет …». Плитка (`ConsoleExpansionsDeck.vue`) — эмблема · имя · описание (wide) · ON/OFF; брифинг (`ConsoleLaunchPanel.vue:36–43`) —
   эмблемы; плита запуска — эмблемы. Ни одна поверхность не отвечает «что будет в колодах». Зависимость «Redux требует Колоний» живёт
   только в списке блокеров (`consoleCreateModel.ts:535–556`), не на плитке.
7. **Единственный точный источник состава — сервер.** `GameCards` (`:96–135`): banned / replaced (`cardsToRemove`) / **held-back**
   (`:172`) / `compatibility` / `instantiate: false` / Beginner Corporation / Merger при `twoCorpsVariant` / прелюдии Valley Trust без модуля.
   Клиентский манифест (`ClientCard.ts:17, 31`) знает только `module` и `compatibility` — клиентский счёт соврёт на каждом из этих правил
   и на каждой следующей классической карте. → решение 6: read-only маршрут поверх `GameCards`.
8. **Контракты e2e / спеков, которые заденет полировка.** `tests/e2e/console-pregame-showcase.spec.ts:267–316` (E — колода «Дополнения»:
   `.cm-exp__desc` видим на wide; пол TV; `consoleOverflowGuard`), `tests/client/console/menu/consoleCreateModel.spec.ts` (37; `:66` — ходьба
   по 2-колоночной сетке дополнений, `:77` — wide), `tests/console/e2eLiveness.spec.ts`. Новая мебель колоды (счётчик, чипы) — НЕ цель
   курсора: ходьба `deckNavStep` не меняется.

## Правила карты (чтение скана + код — спек пинит каждое)

1. Зелёная, 7 M€, метка Юпитера, 1 ПО (`victoryPoints: 1` — гард `cardVictoryPointsAtPlay`).
2. Требование на Redux-столе — две дороги: Красные правят ИЛИ ≥ 2 своих делегатов на резолюции Красных (`satisfiesPartyRequirement`); эффект
   партии, выданный картой, требование НЕ выполняет (FAQ p.19 — `hasPartyEffect` ≠ `satisfiesPartyRequirement`).
3. Причина руки — именованная, с дорогами: «Красные не правят · ваших делегатов на их резолюции: 1 из 2» (`partyOffVote`, если резолюции
   Красных нет на голосовании — дорога закрыта, «0 из 2» не печатать — `unplayableReasons.ts:336`).
4. Эффект — 1 M€ за КАЖДУЮ метку Юпитера в игре у ВСЕХ игроков, включая саму карту (сырой счёт — wild-метки чужих не считаются,
   `Counter.ts:206`). MarsBot за столом — игрок без разыгранных карт: 0 меток, счётчик не падает (проверить спеком).
5. Прогноз розыгрыша — чип «+N M€» с «почему» («N меток Юпитера, включая эту») — путь Galilean Waystation (`countedPlayForecast`,
   `variableAmountPreviewGuard`): нового кода не ждать, гарды подтверждают.
6. Классический стол (`turmoilExtension`) — поведение апстрима байт-в-байт (его спек остаётся).
7. Раздача: под Redux карта РАЗДАЁТСЯ (гард «deals exactly the classic cards no longer held back» — список минус одна строка), под классикой —
   как раньше, без движка — нет (`isCompatibleWith`: модуль Turmoil включён только при `turmoilExtension || turmoilReduxExpansion`).
8. Save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.5)
1. **Имя RU** — «Космическая диаспора» (уже в `turmoil_cards.json:11`) — оставить.
2. **`cardNumber`** — (а, рекомендовано) исправить `'TO4'` → `'T04'` (печатный номер карты; соседи `T01…T16`; ключ лора владельца и
   арта — `T04`); одна буква расхождения с апстримом — записать в журнал § гочи и в `docs/claude/upstream-sync-smart-adaptation`-заметку
   (память — отметит автор промта); (б) оставить `'TO4'` и переименовать ключ лора / арта в `TO4` — печатает опечатку в двух новых местах.
3. **RU описания классической карты** (`turmoil_cards.json:12`) — (а, рекомендовано) исправить опечатки и привести к голосу набора:
   «Требует, чтобы «Красные» были у власти или у вас было 2 делегата на их резолюции. Получите 1 M€ за каждую метку Юпитера в игре,
   включая эту.» — ключ апстрима, RU — собственный файл форка, лицо печатает его; (б) не трогать (инвариант 9 буквально) — тогда опечатка
   на премиум-лице.
4. **Правило скоупа** — (а, рекомендовано) «премиум-модули ∪ (`turmoil` − hold-back)»: ОДИН общий хелпер (`tests/testing/premiumScope.ts`:
   `PREMIUM_SCOPE_MODULES`, `inPremiumScope(card)`; для клиентских спеков / `PremiumCardsPlayground.vue` / `buildCardInformation.ts` —
   та же функция из `src/common/`), hold-back-СПИСОК ИМЁН переезжает в `src/common/cards/turmoilReduxAdaptation.ts` (чистые `CardName`),
   серверный файл оставляет предикат с `GameOptions` и ре-экспорт — ни один клиентский модуль не импортирует `src/server`; все ≈ 40
   гардов переводятся на хелпер ОДНИМ проходом (`grep "new Set<GameModule>"` — ноль литералов после); (б) `'turmoil'` в каждый литерал +
   фильтр по списку в каждом гарде — те же 40 правок, без общего места; (в) адаптировать все 22 сразу — нет.
5. **Executor → фасад** — (а, рекомендовано) сейчас: `canExecute` → `politics.delegatesInReserve(player) < count`; `execute` →
   `politics.addInfluenceBonus(player, 1, card.name)` и НОВЫЙ глагол фасада `placeDelegates(player, count, {oneParty: boolean, source})`
   — Redux: `PlaceDelegatesOnResolution` (TR03; `oneParty` = две фишки на ОДНУ резолюцию — Cultural Metropolis), классика: `SendDelegateToArea`
   (`count` / `manyParties` — байт-в-байт); спек `tests/behavior/ExecutorPolitics.spec.ts` через `fakeCard` на ОБОИХ столах (`fakeCard`
   не нужен в манифесте — hold-back не мешает); `Turmoil.getTurmoil` в `Executor.ts` — ноль вхождений после; (б) отложить до Event Analysts
   — владелец просил сейчас.
6. **Источник состава колод** — (а, рекомендовано) read-only маршрут `PUT /api/deck-composition` с ТЕМ ЖЕ телом, что `ApiCreateGame`
   (клиент уже собирает его — `buildCreateGamePayload.ts`; парсер опций — переиспользовать, не копировать), ответ — `DeckCompositionModel`
   (`src/common/models/`): `projects {total, byType: {automated, active, event}, byModule}`, `corporations {total, byModule}`,
   `preludes {total, byModule}`, `extras {colonies?, resolutions?}`, и **`contributions: Record<Expansion, …>`** — что КАЖДОЕ дополнение
   даёт при текущем остальном наборе (сервер считает «с ним − без него» — `GameCards` на тех же опциях ± один флаг; мемо по каноническому ключу
   опций, LRU ≈ 64; маршрут не касается `GameLoader` / БД — гард); (б) клиентский счёт по `cards.json` — врёт на banned / replaced /
   held-back / Merger / Beginner — нет.
7. **Где живёт показ** — (а, рекомендовано) ОДИН компонент-счётчик `ConsoleDeckMeter.vue` над ОДНОЙ моделью в трёх местах: голова колоды
   «Дополнения» (постоянно, обновляется на каждом переключении), блок «Колоды» брифинга (`ConsoleLaunchPanel`, вместо голых эмблем — эмблемы
   остаются рядом), строка плиты запуска (`ConsoleLaunchConfirm`); (б) только брифинг — игрок не видит ответа в момент переключения.
8. **Что считать** — (а, рекомендовано) проекты по ТИПУ (зелёные / синие / события — цвета премиум-лица), корпорации, прелюдии; строка «ещё в
   партии»: колонии (N по числу игроков — `ColonyDealer`), резолюции (Redux — каталог без retired / dev / test id, `ResolutionCatalog.ts:85…`);
   (б) только итоги трёх колод.
9. **Описания** — (а, рекомендовано) новые EN-ключи (старые — долой из `createGameMeta.ts` и `ru/create_game.json` в том же диффе):
   Гидросети — `Adds a shared progress track: spend energy to advance, claim its bonuses and race for VP.` → «Добавляет общий трек
   прогресса: тратьте энергию, чтобы продвигаться, забирать бонусы и бороться за ПО.»; Кризис: Возвращение — `Adds the Mars Parliament:
   delegates vote on resolutions, parties grant effects, the Agenda track rewards your career.` → «Добавляет Марсианский парламент:
   делегаты голосуют за резолюции, партии дают эффекты, трек Карьеры приносит награды.» (глоссарий: «Карьера», никогда «Повестка» — гард
   `BANNED`); зависимость «требует Колоний» — ЧИП на плитке по `EXPANSION_REQUIRES`, не в прозе; (б) владелец даёт свои формулировки.
10. **Правило озеленения за 2 РТ** — уходит из создателя (он не свод правил). Проверить, что в партии оно сказано (помощь Парламента /
    «Эффекты» / глоссарий `turmoil-redux-greenery-revision`); если нигде — строка реестра «ждёт владельца», не эта задача.
11. **Чипы вклада на плитке** — (а, рекомендовано) каждая плитка печатает, что ОНА добавляет: «+86 [проект] · +12 [корп.] · +35 [прелюдия]»,
    у Redux — «+70 проектов · +42 резолюции · +1 классическая карта»; числа из `contributions`, иконки — существующие (тип карты — глифы
    премиум-лица, резолюция — печать Парламента; память `reuse-existing-icons-check-scan`); выключенная плитка печатает вклад приглушённо
    («даст +…»); (б) только итог в счётчике.
12. **Объём «освежить»** — (а, рекомендовано) центр итерации — колода «Дополнения» (плитки + счётчик) и брифинг; остальные колоды
    (режим / экипаж / правила / карта / плита запуска) — 4K-обход пробником TR68 (доля проёма · ниже пола · обрезки · ступени шрифта) с
    фиксом ДЕШЁВЫХ классовых дефектов (иерархия типографики, размер эмблем, плотность) и строкой реестра на остальное; никакой
    перестройки лобби / экипажа (TR68 сделал); (б) полный проход по всем колодам — отдельная итерация.

## 0. Рабочее дерево
1. `git log --oneline -1` → `9b5fd2dee9` на выдаче. **Сначала** `ListAgents` + процессы playwright (память `pasted-prompt-author-may-still-run`);
   `SendMessage` каждому живому соседу о порядке: твои файлы — `turmoil/DiasporaMovement.ts` и его спек, `turmoil/turmoilReduxAdaptation.ts`
   (+ переезд списка в `src/common`), `behavior/Executor.ts`, `politics/PoliticalOps.ts`, ВСЕ гарды со `SCOPE` (один проход — объявить
   соседям ДО него: это ≈ 40 файлов тестов), `routes/ApiDeckComposition.ts`, `server/requestProcessor.ts`, `common/models/DeckCompositionModel.ts`,
   `console/menu/{consoleCreateModel,deckCompositionState,deckCompositionModel}.ts`, `components/console/menu/{ConsoleExpansionsDeck,
   ConsoleDeckMeter,ConsoleLaunchPanel,ConsoleLaunchConfirm}.vue`, `create/premium/createGameMeta.ts`, `console_menu.less`, `console_tv.less`
   **§ 23** (дописывать ПОСЛЕ коммита соседа, никогда его ханки), `ru/{create_game,turmoil_cards,card_info,lore_texts}.json`, доки.
   Коммиты — ПО ХАНКАМ (временный индекс, read-tree → commit ОДНОЙ командой) или явными путями; после коммита — `git reset -q --
   package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить. ⚠ Стенды в `screenshots/**` проверяются `tsc` сборки
   клиента (PL-810: `screenshots/` и `tmp/` уже в `exclude` чекера — убедиться на своём HEAD).
2. Снапшот e2e — свой: `npm run e2e:snapshot t04` + `TM_E2E_ROOT=.e2e-t04`; ⚠ перед снапшотом — `npm run build:server`, и чтобы сосед не
   собирал `build/` (память `e2e-snapshot-mid-compress-empty-css`); кадры «до» — клиент HEAD в своём снапшоте (`ab-baseline-head-client-in-snapshot`);
   4K — на GPU (`PERF_GPU=1`). ⚠ После новых локалей — `npm run make:json`, иначе лицо печатает английское имя, а e2e зелёный.
3. **Стенд** — `screenshots/t04/create.stand.spec.ts` (вне git; образец — стенд TR68 `screenshots/tr68/walk.stand.spec.ts`, если жив):
   меню → создатель → колода «Дополнения» (все четыре профиля переключений: база · +Прелюдия · +Колонии+Redux · всё), брифинг, плита
   запуска — профили `tv4k` (GPU), `fhd`, **Deck 1280×800** (`handheld`); пробник TR68 (доля проёма, подписи ниже пола, обрезки,
   `consoleOverflowGuard`) + сэмплер переключения (DOM 100 мс по `setInterval`: цифры счётчика и сегменты — мутации по задачам, ни одного
   скачка одним кадром).
4. Фикстуры — ТОЛЬКО свои JSON; имя в `FixtureName` ДО сборки (`parliamentFixture`, `generate.ts:1000–1026` — `arrange` кладёт карту в руку
   напрямую, hold-back на фикстуру не влияет): `diaspora-movement` — Redux-стол 2 места, Красные ПРАВЯТ (`seatEnacted` закона Красных),
   T04 в руке p1, у p1 на столе Colonizer Training Camp, у p2 — Methane from Titan (= +3), M€ ≥ 7; `diaspora-movement-locked` — Красные НЕ
   правят, резолюция Красных на голосовании с ОДНИМ делегатом p1 (причина «1 из 2»), M€ ≥ 7.
5. **Dev-путь до удаления строки** — `docs/DEV_GUARANTEED_CARDS.md` (гарантированная карта проходит ПОСЛЕ `filterHeldBackUnderRedux`):
   проверить карту на живом Redux-столе до того, как строка уйдёт; в сдаче строка УХОДИТ (правило 7, гард).

## 1. Сервер (≈ 25 %)
1. **Карта.** `cardNumber: 'T04'` (решение 2); остальное — как есть (декларация верна). Строка `CardName.DIASPORA_MOVEMENT` — долой из
   `TURMOIL_CARDS_TO_ADAPT_IN_PLACE` (ТОТ ЖЕ дифф, что лицо / лор / RU — гард `TurmoilCardsUnderRedux.spec` «deals exactly…» подтверждает
   раздачу: манифест − список = {Diaspora Movement}).
2. **Скоуп (решение 4).** `src/common/cards/turmoilReduxAdaptation.ts` — два массива имён + `TURMOIL_CARDS_HELD_BACK_UNDER_REDUX`; серверный
   файл — предикат + ре-экспорт (импорты гарда `TurmoilCardsUnderRedux.spec`, `TurmoilReduxCardManifest.spec`, `GameCards` — не ломать).
   `src/common/cards/premiumScope.ts`: `PREMIUM_SCOPE_MODULES` (сегодняшние 9 + `'turmoil'`), `inPremiumScope({module, name})` =
   модуль в скоупе ∧ ¬(модуль `turmoil` ∧ имя в hold-back). Один проход по гардам (`grep -rn "new Set<GameModule>" tests src`) — каждый
   читает хелпер; `buildCardInformation.ts` `SCOPE_MODULES` и `PremiumCardsPlayground.vue:148, 180` — тот же хелпер (плейграунд ПЕЧАТАЕТ
   карты по `inPremiumScope`, каталог модулей — `PREMIUM_SCOPE_MODULES`). Гард правила: `tests/cards/premiumScope.spec.ts` — классическая
   карта в списке → вне скоупа; вне списка → в скоупе; у `turmoilRedux` список не читается; ноль литералов `new Set<GameModule>([` в
   `tests/` (grep-гард, как `lessDeadSelectorGuard`).
3. **Executor (решение 5).** `PoliticalOps.placeDelegates(player, count, opts)` — Redux / классика; `Executor.ts:274, :743–760` — только фасад;
   `ClassicPoliticalOps` без `Turmoil` снаружи. Спек `tests/behavior/ExecutorPolitics.spec.ts` (рядом с `tests/behavior/Executor.spec.ts`): `fakeCard({behavior: {turmoil:
   {influenceBonus: 1}}})` — классика: `turmoil.getInfluence` +1; Redux: `parliament` влияние +1 с источником = имя карты;
   `sendDelegates {count: 2}` — классика: `SendDelegateToArea {count: 2}` (байт-в-байт с прежним — `EventAnalysts.spec`, `MartianMediaCenter.spec`,
   `CulturalMetropolis.spec` зелёные без правок); Redux: один `PlaceDelegatesOnResolution` на одну резолюцию с 2 фишками; `manyParties` —
   два шага; `canExecute` — `delegatesInReserve` < count → false на обоих столах. Строки Event Analysts / Martian Media Center / Cultural
   Metropolis в списке ОСТАЮТСЯ (журнал — почему).
4. **Маршрут состава (решение 6).** `routes/ApiDeckComposition.ts` (`Handler`, `PUT`, тело = `ApiCreateGame`-payload; валидацию опций
   переиспользовать из `ApiCreateGame` — вынести общую функцию, не копировать), путь в `common/app/paths.ts` + таблица `requestProcessor.ts:113`
   + список в `responses.ts:48`; `server/deckComposition.ts` — чистая функция `deckCompositionOf(options: GameOptions): DeckCompositionModel`
   (`GameCards` × тип; `contributions` — ± каждый флаг `PREMIUM_EXPANSIONS`; колонии — `ColonyDealer` по числу игроков; резолюции — каталог
   Redux минус retired / dev / test). Спек `tests/routes/ApiDeckComposition.spec.ts` (образец — `tests/routes/ApiGameBoardCellPreview.spec.ts`) + `tests/server/deckComposition.spec.ts`: база = N;
   +Prelude → `preludes.total` > 0; +Redux (с Колониями) → `projects.byModule.turmoilRedux` = 70, `turmoil` = 1 (Diaspora), `resolutions` = 42,
   `contributions.turmoilRedux.projects` = 71; `twoCorpsVariant` → без Merger; с ботом — то же, что без (колоды не зависят); мемо: второй вызов
   не строит `GameCards` (счётчик вызовов); маршрут не трогает `GameLoader` / БД (стаб падает при вызове).

## 2. Клиент — карта (≈ 5 %)
- Лицо `.pcard` — по типу, даром (`isPremiumFaceType`); требование партии — плашка партии (TR15+), «Информация › Требования» — две дороги;
  чип руки / композер / причина — от `partyRequirementStanding`; прогноз «+N M€ · N меток Юпитера, включая эту» — путь Galilean Waystation.
  Нового кода не ждать — e2e и гарды подтверждают; расхождение = баг общего пути (чинить классом, не хуком карты).

## 3. Клиент — ГЛАВНОЕ: «КОЛОДА ВИДНА ДО СТАРТА» (≈ 55 %)
### 3.А Модель (решения 6–8)
- `console/menu/deckCompositionState.ts` (модульный reactive по образцу `journalState`): `composition`, `status`, `seq`; `watch` над
  `createGameState.config` (дополнения · число мест · `twoCorpsVariant` · бот) → дебаунс 1 такт → PUT; ответ старее `seq` — выбросить;
  пока ждём — ПРЕЖНИЕ числа стоят приглушённо (никогда пустота / «…» на месте цифры / моргание); ошибка сети — прежние числа + тихий
  статус (не блокер запуска). `console/menu/deckCompositionModel.ts` — ЧИСТАЯ: ответ → ряды счётчика (три колоды, сегменты по типу, итог),
  ряд «ещё в партии», `contributionOf(expansion)` → чипы плитки; спек на модели (`tests/client/console/menu/deckCompositionModel.spec.ts`).
- Ни одного числа, посчитанного в шаблоне; все три поверхности читают одну модель (решение 7).
### 3.Б Поверхности (решения 7, 11, 12)
- **`ConsoleDeckMeter.vue`** — перед кодом загрузить скилл `dataviz` (форма «stat tile / meter»; палитра — НЕ его плейсхолдер, а токены
  консоли: цвета типов карт премиум-лица, `@con-*`): три полосы (проекты · корпорации · прелюдии) с сегментами по типу, итог цифрами —
  `ConsoleFlipValue` (такт HUD), сегменты — `transform: scaleX` на слое (`.con-motion-layer`), `motionMs()` / `MOTION_EASE`, reduced motion —
  снап; состояние «ждём» — opacity-слой, не скелетон. Deck 1280×800 — одна строка цифр без полос (база не растёт — растёт профиль TV).
- **Плитка дополнения** (`ConsoleExpansionsDeck.vue`): эмблема · имя · ОДНА фраза · чипы вклада (`contributions`) · чип зависимости
  («нужны Колонии» — `EXPANSION_REQUIRES`, красный только при нарушении) · переключатель; выключенная — эмблема приглушена (как сейчас), чипы
  «даст +…»; включение — эмблема насыщается + чипы переходят в полный тон + счётчик тикает — ОДНА фраза, по задачам. Хук e2e `.cm-exp__desc`
  — перевести на новое имя В ТОМ ЖЕ диффе (инвариант 14). Ходьба `deckNavStep` не меняется (счётчик — не цель курсора).
- **Брифинг** (`ConsoleLaunchPanel.vue:36–43`): блок «Дополнения» → эмблемы + `ConsoleDeckMeter` компактный; **плита запуска**
  (`ConsoleLaunchConfirm.vue`): строка «Колоды: 208 проектов · 12 корпораций · 35 прелюдий» из той же модели.
- **Описания** (решение 9): `createGameMeta.ts:34, :38` — новые ключи; `ru/create_game.json` — RU, старые пары долой; `grep` ключа по всем
  `src/locales/*/*.json` ДО добавления.
- **4K-обход** остальных колод (решение 12): пробник → таблица «до / после» (доля проёма · ниже пола · обрезки · шаг типографики) → дешёвые
  классовые фиксы отдельными коммитами, остальное — строки раздела BV.
### 3.В Пол TV
- § 23 `console_tv.less` — счётчик, чипы, новые подписи плитки ≥ `--con-t-floor`; `--con-hit-min` у плиток; e2e-пробник пола (showcase E).

## 4. Лицо, локаль, лор, арт
- Арт: `node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/T04.png" T04` → `npm run make:cards` (манифест + thumb);
  первая строка отчёта — «арт импортирован».
- Лор: EN — ключ `T04` владельца (`assets/text/lore_texts.json`, уже лежит — коммит первым ханком); RU — `src/locales/ru/lore_texts.json`
  под ключом = английский текст: «Всё больше людей чувствуют себя чужими в том, во что превращаются Марс и Земля. Поможем им найти новый
  дом!» (курировать; печатная цитата — не придуманная, реестр `turmoil-redux-invented-lore` не трогать).
- RU: имя есть; описание — решение 3; `card_info.json` — все `missingTranslations` аудита `cardInfoAudit.json` по Diaspora
  (`make:cards` после входа в скоуп: 0 `needsCuration` / 0 `seededRunOn` / 0 `missingTranslations` — карта декларативна, кураторства нет).
- Создатель: новые EN-ключи описаний и подписей счётчика («Decks», «projects», «corporations», «preludes», «Also in the party»,
  «resolutions», «colonies», «+${0} projects» — через `translateTextWithParams`, множественное число — `{проект|проекта|проектов}`-форма
  локали); RU чужих ключей не переписывать.

## 5. Тесты
1. `tests/cards/turmoil/DiasporaMovement.spec.ts` — классический блок апстрима ОСТАЁТСЯ; новый `describe('on a Turmoil Redux table')`:
   `testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true})`, сетап только `parliamentArrange` (`seatResolution` / `seatEnacted` —
   никогда голой записью в слот): правила 1–8 (не правят + 0 делегатов → нельзя, причина со standing `{current: 0, required: 2}` и
   `partyOffVote`, если резолюции нет; 2 делегата на резолюции Красных → можно; правят → можно; розыгрыш → +3 с тремя метками у двух игроков;
   с MarsBot за столом → счёт не падает; `cardPlayPreview` чист и печатает «+3»; save / load).
2. Гарды зелёные после прохода скоупа: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `cardInformation`, `requirementProse` (новый
   субъект — партия названа), `premiumCardViewModel`, `premiumCardIcons`, `cardLore` (T04 EN + RU), `effectForecastCoverage` /
   `effectForecastParity` (хуков нет), `countedPlayForecast`, `variableAmountPreviewGuard`, `cardVictoryPointsAtPlay`, `crossPlayerCoverageGuard`,
   `DivertedResearchSweep` / `UnmiVetoSweep`, `promptMarkerGuard`, `TurmoilCardsUnderRedux` (12 → пин «ровно Diaspora»), `TurmoilReduxCardManifest`,
   новый `premiumScope.spec` + grep-гард литералов, `ExecutorPolitics.spec`, `ApiDeckComposition.spec`, `deckComposition.spec`,
   `deckCompositionModel.spec`, `consoleCreateModel.spec` (37 — ходьба не изменилась), `glyphLiteralGuard`, `e2eLiveness`, `lessDeadSelectorGuard`.
3. e2e — **ОДИН спек карты**, оправдан как ПЕРВЫЙ проход классической карты по каналу Redux (hold-back → раздача → рука → требование партии →
   розыгрыш; следующие классические карты без новой механики спека НЕ получают — чеклист §5): `tests/e2e/console-classic-diaspora.spec.ts`
   (standard-1080 + tv4k на GPU): `-locked` — плита руки с причиной «Красные не правят · 1 из 2», X → «Информация › Требования» две дороги;
   `diaspora-movement` — плита доступна, композер «+3 M€ · 3 метки Юпитера, включая эту», A → сервер +3, карточка журнала, лицо с артом T04.
4. e2e витрины: `console-pregame-showcase.spec.ts` E — расширить (хук описания переведён; счётчик с числами > 0 на входе; переключение
   «Прелюдия» → `preludes` 0 → N по задачам (сэмплер); Redux без Колоний → чип зависимости красный, блокер в брифинге; все чипы вклада
   = числам `contributions` (сверка с PUT тем же телом через `request`); пол 4K = 0 ниже; Deck — одна строка, `consoleOverflowGuard` молчит);
   `npm run e2e:affected` + перевод всех задетых селекторов в том же диффе.
5. `npm run build:test`, `npm run lint`, `npm run make:cards`, `npm run make:json`; юниты — на тихой машине, последовательно.

## 6. Визуальная приёмка = РАСКАДРОВКА (чеклист §7; **4K первым**, GPU; fhd и Deck обязательны)
Кадры «до / после» в `screenshots/t04/{tv4k,fhd,deck}/`: (а) колода «Дополнения» — база / +Прелюдия / +Колонии+Redux / всё (на каждом —
счётчик и чипы); (б) раскадровка ОДНОГО переключения ≥ 6 кадров + сэмплер (цифры, сегменты, эмблема — по задачам); (в) брифинг и плита
запуска с «Колодами»; (г) карта T04 — плита руки (обе фикстуры), композер, лицо, X-информация; (д) остальные колоды — таблица пробника
«до / после». Каждый кадр — своим глазом с дивана: «я понимаю, ЧТО окажется в колоде, не нажимая ничего?» Три макета счётчика (полосы ·
плитки-итоги · одна строка с сегментами) CSS поверх живого экрана (`addStyleTag`) — в батч владельцу ПЕРВЫМ.

## 7. Полировка по пути
1. Реестр: раздел **BV** «КОЛОДА ВИДНА ДО СТАРТА» — находки обхода (описания-своды, мебель без ответа, зависимость только в блокерах — как
   закрытые; остальное — открытые / «ждёт владельца»); первый номер — по footer на своём HEAD (на выдаче PL-817).
2. Бэклог `weak-visuals-backlog` № 17 / 22 — строка «создатель: колоды видны (T04, PL-…)».
3. Доки: `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` — §3.1 п. 2 переписать (правило скоупа, хелпер, переезд списка в `common`), §2.2 путь файла,
   §4.2 строка Diaspora → «СДАНА», §5 Executor → сделано (с оговоркой, какие строки остались и почему); `docs/claude/expansion-adaptation-checklist.md`
   — «Current scope» + Step 1 (хелпер вместо литералов; `turmoil` — через список); `docs/claude/turmoil-redux-card-checklist.md` §0 — строка
   «классическая карта входит в скоуп, покидая список»; `docs/claude/console/pregame-showcase.md` §6 (плитка дополнения) + новый §6a «The deck
   is visible before launch» (маршрут, модель, счётчик, чипы, зависимость, гарды, Deck-контракт); закон в `.claude/rules/console-ui.md`
   рядом с «THE PREGAME IS A SHOWCASE» («what a toggle adds is PRINTED beside it, from the server's own deck — never a client count»);
   запись в журнале `turmoil-redux-cards-progress.md` (формат записи `:5470`: задача · сделано · решения · гочи, включая расхождение `T04`
   с апстримом).

## 8. Режим работы
1. Читать до кода; диагноз подтвердить файл:строка на своём HEAD; ПЕРВЫМ ДЕЛОМ — кадры «до» своим стендом (три профиля) + пробник.
2. Порядок: лор-ханк → карта (`T04`, RU, арт) + спек Redux → список в `common` + хелпер скоупа + проход гардов (один коммит) → `make:cards`
  / RU `card_info` → Executor + спек → строка долой из списка + гард → e2e карты → маршрут состава + спеки → модель + счётчик + плитки +
  брифинг + плита → описания → пол TV → 4K-обход → перевод e2e-хуков → раскадровки → реестр / доки. Каждый шаг — коммит по ханкам.
3. Реестр: букву и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт владельцу: первой строкой — арт; затем раскадровка 4K «до / после» колоды «Дополнения» и брифинга, таблица пробника по колодам в трёх
   профилях, сверка «чипы = PUT» числами, решения 1–12 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (решения 4 (с числом
   затронутых гардов), 7 (с макетами), 8, 9 (тексты), 12 — рекомендация первой; 1–3, 5, 6, 10, 11 — в отчёте по умолчанию), гэпы честно.
5. Не пушить. Перед коммитом UI — `npm run e2e:affected`.

## 9. Нельзя
- Добавлять `'turmoil'` в SCOPE-литералы без правила «минус список» (21 карта без лора / RU уронит гарды — или, хуже, их начнут «закрывать»
  исключениями); оставлять литералы `new Set<GameModule>([` после прохода; импортировать `src/server` из клиентского кода / спека; удалять из
  списка строки, кроме `DIASPORA_MOVEMENT`; трогать `isCompatibleWith` / маркер `politics`.
- Считать состав колод на клиенте; второй источник правды для чисел плитки; число в шаблоне; `v-if`-подмена цифр / сегментов; моргание
  «…» на месте числа; блокировать запуск ожиданием маршрута.
- Переписывать голос требования в `PartyRequirement` / `unplayableReasons` (общий путь — чинить классом, если расходится); хук превью на
  декларативной карте; `Turmoil.getTurmoil` в Executor после правки; `defer` в `placeDelegates` классики иначе, чем было (байт-в-байт).
- Менять ходьбу `deckNavStep`; делать счётчик целью курсора; `overflow-y: auto` руками (только `ConsoleScrollArea`); ломать fit Deck 1280×800;
  `transition: all`, анимацию width / height; `title`-атрибут; литерал кнопки (глифы — `GamepadGlyph`); текст ниже пола TV; состояние только
  цветом; «Повестка» (глоссарий — «Карьера»); свод правил в описании дополнения.
- Трогать разбор хода бота; файлы соседей и их незакоммиченные правки; переписывать RU чужих ключей (кроме решения 3); ломать селекторы e2e
  без перевода в том же диффе; полный regen фикстур; `git stash`; bare `git push`.
