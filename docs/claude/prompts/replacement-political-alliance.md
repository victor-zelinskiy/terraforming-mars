# Промт исполнителю · Political Alliance:redux («Политический союз») — пятая карта-замена набора Redux (**TR73** по реестру): событие, **2** (было 4); **требование — «вы лидируете по числу делегатов на 2 резолюциях одновременно»** (ничья — у кого первый делегат раньше; нейтральные не считаются); награда — **1 шаг Карьеры** (было +1 РТ) · ГЛАВНОЕ (владелец): **НОВЫЙ ВИД ТРЕБОВАНИЯ НА КАРТЕ** — движок его уже СЧИТАЕТ (`requirements: {partyLeader: 2}` → `PartyLeadersRequirement` → фасад `partiesLedBy` → `Parliament.leaderOf`: нейтральные исключены, ничья по `firstSeq` — ровно печатная оговорка), но ПРЕМИУМ-ТРОПА вида (8 точек TR02) не проложена: причина руки — классическое «Requires 2 party leader(s)» без «сейчас» и без имени резолюций, счётчик руки без эмблемы, плита MIN — одна фигура (скан — ДВЕ), строка правил, досье, «Информация», прогноз голосования «возьмёте лидерство» — есть, но не связан с требованием; шаг Карьеры — готовая тропа TR04 (`walkAgenda` + `agendaWalkForecast` + исход «КАРЬЕРА» в руке); без полировки

> **Статус: ВЫДАН 2026-10-25.** HEAD `74d699421a` (TR77 Septem Tribus сдана: куб на знамени = грант, режим `banner`, бит «куб на знамя»; гоча «новый маркер
> `SelectParty` → `taskFor`»). В дереве ЧУЖОЕ незакоммиченное (колонии / причалы: `ConsoleColoniesSection.vue`, `ConsoleColonyFocusStage.vue`, `ConsoleFleetDock*.vue`,
> `ConsoleShell.vue`, `console-ui.md`, `COLONY_TRADE_FLOW.md`, `WATER_HAULING.md` — соседи `terraforming-mars-d7` (busy) / `-d9` (idle)): `ListAgents` + `SendMessage`
> до первого коммита; их файлы не трогать. **Лор владельца** — строка `"X09": "I think we can both benefit from this arrangement."` НЕЗАКОММИЧЕНА последней в
> `assets/text/lore_texts.json` (классический номер карты — `X09`, промо-нумерация апстрима): коммитить ПЕРВЫМ ханком, только её, + RU в `src/locales/ru/
> lore_texts.json` («Думаю, эта договорённость выгодна нам обоим.»). ⚠ Придуманный лор в `docs/claude/turmoil-redux-invented-lore.md:32` («We agree on everything.
> Except who gets the credit.») — НЕ использовать: владелец выбрал цитату `X09`; в реестре придуманного — отметить «заменён цитатой владельца». **Арт** —
> `C:\Users\zelin\Downloads\Mars Arts\X09.png` → импортировать как **X09** (`node scripts/import-card-art.mjs "<путь>/X09.png" X09` → `make:cards`); замена берёт
> арт/лор через `reimplements: CardName.POLITICAL_ALLIANCE`. Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Replacement - Political Alliance.png`
> («TR00» — заглушка; `replacementCardNumber(POLITICAL_ALLIANCE)` = **TR73**). Реестр: footer — прочитать (после CL); **без своего раздела**; дефекты общего слоя —
> строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- alliance …`; сцена ходьбы Карьеры — TIMING: `--exclusive --workers=1`).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 (`:170–200`; `:186` номера; `:193` лор; `:228` строка Political Alliance), шаблоны замен `7d284dc2df` (TR71),
`7e38fd1c2a` (TR72), `ea39e1e81d` (TR75), `9a8db2e3f1` (TR77), **чеклист `docs/claude/turmoil-redux-card-checklist.md`** — §0 («новый вид требования — сначала
инфраструктура сквозным контрактом»), **§4 строки `:118` («требование СУЩЕСТВУЮЩЕГО вида — причина с «сейчас», чип, строка правил, счётчик руки») и `:121–122`
(«вид ЕСТЬ (тропа TR02, 8 точек)»), `:119` («карта ДВИГАЕТ МАРКЕР Карьеры на N шагов — `ChairmanSeat.walkAgenda(player, parliament, N, {reason:'card', card})`
СИНХРОННО в `bespokePlay` + `actionPreviews.agendaWalkModel / agendaWalkEffects / agendaWalkStep`»)**, §5 e2e. **ТРОПА ВИДА ТРЕБОВАНИЯ — `docs/
TURMOIL_REDUX_MINORITY_REPRESENTATION.md` §5 «Вид требования INFLUENCE (тропа TR02, 8 точек)»** (`:242–250`: `RequirementType` · дескриптор · `compileOne` →
класс требования через фасад · `populateCount` · строка правил · причина `type:'count'` с «сейчас» · `FULLY_RESTATED_REQUIREMENTS` · `REQUIREMENT_RENDER`
бейдж · `COUNT_MESSAGE_LABELS`), `docs/TURMOIL_REDUX_POLITICAL_SCIENCE.md` (TR02 — первый счётный вид Redux), **тропа ШАГА КАРЬЕРЫ — `TURMOIL_REDUX_MINORITY_REPRESENTATION.md`
§2 «ОДНА функция ходьбы» `:49`, §3 «ОДИН директор» `:108`, §4 «Розыгрыш как ИСХОД, хостимый рукой» `:179`**; e2e `console-minority-representation.spec.ts:1–30`,
`console-political-science.spec.ts`; память `career-step-insignia` (шаг Карьеры = НАШИВКА везде, вкл. лица; «+1 [нашивка]»), `composer-preselect-direction`,
`status-line-no-face-restatement`, `visual-restraint-no-glow`, `parliament-glossary.md` (`:14` «побеждает» — резолюция, `:22` семейство лидерства `LEADING_KEYS`,
«ИГРОК — победитель голосования»; `:149` ячейка лидера слота), инварианты 1–4, 8, 9, 11, 13, 15.

**Образцы — по частям:** **классика** — `turmoil/PoliticalAlliance.ts` (`EVENT`, 4, `behavior.tr: 1`, `requirements: {partyLeader: 2}`, `cardNumber 'X09'`, `b.tr(1)`);
**требование** — `common/cards/CardRequirementDescriptor.ts:51, :127` (`partyLeader` → `RequirementType.PARTY_LEADERS = 'Party leader'`), `requirements/
PartyLeadersRequirement.ts` (`InequalityRequirement`, `getScore = politics.partiesLedBy`), `politics/PoliticalOps.ts:101, :206–208` (Redux: слоты, где
`leaderOf(slot).owner === player`), **`parliament/Parliament.ts:407–446` (`leaderOf`: нейтральные пропущены при выборе лидера, ничья → `firstSeq` меньше,
`tieBreak: 'earlier-delegate'`; только нейтральные на карте → лидер `'NEUTRAL'`)** — ровно печатная оговорка; `models/unplayableReasons.ts:318–319` (сегодня:
`{type:'party', message:'Requires ${0} party leader(s)', params, current}` — классический текст, без «сейчас»-грамматики счётного вида и без имён резолюций),
`:286–296` (TR02 — `type:'count'` «Requires ${0} delegate(s) on resolutions» с `current`), `:330–360` (TR15 — именованная причина с дорогами; `:362–372` `effectOnlyOf`
— FAQ-хинт Septem), `client/components/premiumCard/premiumCardViewModel.ts:298` (`PARTY_LEADERS` → `delegate.svg`, значение `partyLeader`), `:304–306` (TR02 — «PARTY_LEADERS
wears the same icon; the two differ in the rule line and the chip's hint»), `handCards/unplayableReasonFormat.ts:79–96, :122, :232` (`COUNT_MESSAGE_EMBLEMS` /
`COUNT_MESSAGE_LABELS` — компактный счётчик руки «[эмблема] 1/2» только для `type:'count'` с известным сообщением), `models/requirementProse.ts` (строка правил
— грепнуть `PARTY_LEADERS`); **лидерство на клиенте** — `console/parliament/consoleParliamentModel.ts:210–228` (`ParliamentSlotVm.leader`, `leaderVotes`, `viewerVotes`),
`parliament/ConsoleParliamentVotingArea.vue:46, :115–116` (`--mine`, фигура лидера в ячейке слота), `ConsoleParliamentVoteMode.vue:686, :780, :1200` (прогноз
«возьмёте/сохраните лидерство» — RU `parliament.json:97, :259–260`), `ConsoleParliamentBand.vue:382`; **шаг Карьеры** — `turmoilRedux/MinorityRepresentation.ts:100–132`
(`bespokePlay` → `ChairmanSeat.walkAgenda(player, parliament, N, {reason:'card', card})` синхронно; `agendaWalkForecast` → `actionPreviews.agendaWalkModel`;
`cardPlayPreview` → `agendaWalkEffects` + `agendaWalkStep`), `:1–40` (заголовок — стиль), `common/models/ActionPreviewModel.ts:865–878` (`AgendaWalkModel`:
`steps`, `influence {current, resulting}`), `console/parliament/agendaWalk.ts`, `agendaWalkDirector.ts`, `consoleTaskRouter.ts:368` (`AGENDA_WALK_STEP_STAGE`
«КАРЬЕРА»), лицо — `b.agendaStep(1)` (нашивка; глоссарий «+1 [нашивка]»); **реестр** — `common/cards/turmoilReduxReplacements.ts:60–62` (строка: «cost 4 → 2;
requirement «the highest number of delegates on 2 resolutions at once» (… — `PoliticalOps.partiesLedBy` is this reading); reward +1 TR → advance the Agenda marker
1 step»); **RU** — `turmoil_cards.json:53` «Политический союз» (fallback по срезанному имени); **гарды** — `TurmoilReduxCardManifest.spec` (TR73 = своя строка),
`TurmoilCardsUnderRedux.spec` (`replaced`), `premiumScope`, `devGuaranteedCards`, `cardInformation`, `cardLore` (X09 через `reimplements`), `CardMetadata`,
`requirementProse`, `premiumCardViewModel`, `AgendaStepGlyph.spec` (нашивка на лице — печатает только `agendaStep()`), `PoliticalThinkTank.spec`
(пул карт с требованием партии — Political Alliance НЕ партийное требование: не входит), `i18n.spec`, `deckComposition.spec`, `e2eLiveness`.

---

## Диагноз (подтверждён файл:строка на `74d699421a`; перепроверить на своём HEAD)
1. **Правила — считаются верно, тропа вида не проложена.** `partyLeader: 2` под Redux = «лидер на 2 резолюциях» через `partiesLedBy` → `leaderOf` (нейтральные
   не лидируют среди игроков; ничья — у кого `firstSeq` меньше) — печатная оговорка скана УЖЕ закон движка (пинить, не переписывать). Но вид `PARTY_LEADERS` под
   Redux никто в скоупе ещё не носил (классические Political Alliance / Vote of No Confidence — вне скоупа; замена VoNC уходит на влияние) — это ПЕРВОЕ
   появление: причина `:318` — классический текст «Requires 2 party leader(s)», тип `'party'` (не `'count'` → компактный счётчик руки не печатается, эмблемы
   нет), «сейчас» без имени: игрок не видит, ГДЕ он лидирует и чего не хватает; плита MIN — одна фигура (`:298`), скан — ДВЕ фигуры (= «2 резолюции»); строка
   правил `requirementProse` — грепнуть; досье/«Информация» — строка требования из той же прозы.
2. **Тропа TR02 (8 точек) для `PARTY_LEADERS` под Redux:** (1) вид есть; (2) дескриптор `partyLeader` есть; (3) класс — фасад ✓; (4) `populateCount` ✓;
   (5) строка правил — голос Redux: «Requires that you lead ${0} resolution(s)» (классика — своя: «party leader(s)» остаётся для классического стола —
   `politics.engine`); (6) причина — ИМЕНОВАННАЯ с «сейчас»: `type:'count'`, «Requires leading ${0} resolution(s)», `current` = `partiesLedBy`, + поле `leading:
   [{resolution, party, tieBreak?}]` (какие резолюции ведёт) и `trailing: [{resolution, party, leader, deficit}]` (где не хватает: сколько кубов до лидерства —
   с учётом ничьей по первому кубу — ЧЕСТНО: «ничья не поможет, его первый куб раньше»); (7) `FULLY_RESTATED_REQUIREMENTS`; (8) `REQUIREMENT_RENDER` — бейдж:
   фигура делегата — ДВЕ (как скан) — решение 3; `COUNT_MESSAGE_LABELS` → «Лидерство» (счётчик руки «[две фигуры] 1/2»).
3. **Чтение «где я лидирую» уже есть на столе** (`ParliamentSlotVm.leader`, ячейка слота `--mine`, прогноз голоса «возьмёте / сохраните лидерство»). Хинт чипа
   руки должен ВЕСТИ ГЛАЗ туда: «Лидируете на 1 из 2: «Аквиферный конкурс»; до лидерства на «Архитектурной премии» — 1 делегат». Глоссарий: ИГРОК —
   «победитель голосования», лидерство — семейство `LEADING_KEYS` (`:22`) — слово «лидируете» уже узаконено для прогноза.
4. **Шаг Карьеры — готово (TR04).** `walkAgenda` синхронно в `bespokePlay` (ответ несёт запись), `agendaWalkForecast` + `cardPlayPreview` (трек «N → N+1», бонус
   шага, влияние `current → resulting`), исход «КАРЬЕРА» хостится рукой (`agendaWalk.ts`), директор ходит по шагам; e2e `console-minority-representation` — шаблон
   сцены. Замена: 1 шаг (`POLITICAL_ALLIANCE_STEPS = 1`); конец трека — честный обрез (`walked < printed`) ✓.
5. **Остальное — шаблон замены:** `CardName.POLITICAL_ALLIANCE_REDUX = 'Political Alliance:redux'`, класс, манифест + `cardsToRemove`, строка долой (после — в списке
   Recruitment и VoNC), реестр AUTHORED, пин `replaced`, лор X09 (владельца; придуманный — пометить «не использован»), арт X09, RU описания (новый ключ —
   текст скана), `card_info`.
6. **MarsBot.** Кубы бота на резолюциях — обычные (D12): бот может лидировать и «отбирать» лидерство у игрока — `leaderOf` это знает; бот карту не играет.

## Правила карты (спек `tests/cards/turmoilRedux/PoliticalAllianceRedux.spec.ts` пинит каждое — структура TR71 + TR04)
1. Печатная: событие, 2, без меток, без ПО, `TR73`, `reimplements: POLITICAL_ALLIANCE`, имя `'Political Alliance:redux'`; лицо — плита MIN с ДВУМЯ фигурами
   делегата (решение 3), поле — «[нашивка]» шага Карьеры (`agendaStep(1)`); арт/лор — X09.
2. Требование: играется ⇔ `partiesLedBy(p) ≥ 2` — лидер на двух резолюциях области голосования: (а) 2 куба против 1 — лидер; (б) ничья 1:1 — лидер тот, чей
   первый куб раньше (`seq`); (в) нейтральные кубы не лидируют и не мешают (3 нейтральных + 1 мой → я лидер); (г) только нейтральные — лидера-игрока нет;
   (д) принятая резолюция — не область голосования (не считается); (е) бот — обычный соперник; (ж) 1 из 2 → причина с «сейчас 1», список ведомых и
   недостающих; (з) TR70 — вейвер ПАРТИЙНЫХ требований, этот вид НЕ вейвит (пин: `waivesPartyRequirements` не трогает `PARTY_LEADERS`).
3. Розыгрыш → `walkAgenda(1)` синхронно; запись шага в ответе; бонус клетки трека по правилам трека; конец трека — именованный обрез; влияние по уровню —
   как у TR04; превью = исполнение (`agendaWalkForecast`).
4. Раздача под обоими столами (`cardsToRemove`); скоуп; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **Номер TR73** — по реестру (между сданными TR72 и TR75 — норма).
2. **Причина руки и хинт** (диагноз 2–3) — (а, рекомендовано) `type:'count'` «Requires leading ${0} resolution(s)» (RU «Требуется лидерство на ${0} резолюциях»;
   компактный счётчик «[две фигуры] 1/2», `COUNT_MESSAGE_LABELS` «Лидерство»), хинт — одна фраза из серверной проекции: «Лидируете: «X»; до лидерства на «Y» —
   1 делегат (ничья — ваш первый делегат раньше / позже)»; (б) классический текст + счётчик.
3. **Бейдж плиты MIN** — (а, рекомендовано) ДВЕ фигуры делегата (как скан: «лидер на двух») — `REQUIREMENT_RENDER` для `PARTY_LEADERS` печатает фигуру × значение
   (2) вместо «2 [фигура]»; TR02 «делегаты на резолюциях» остаётся «N [фигура]» — чтобы два вида РАЗЛИЧАЛИСЬ картинкой (комментарий `:304` «differ in the rule
   line and the chip's hint, never in the picture» — ПЕРЕСМОТРЕТЬ: скан различает); (б) одна фигура + «2».
4. **Строка правил** — Redux-голос «Requires that you lead 2 resolutions.» / RU «Требует лидерства на 2 резолюциях.»; классический стол — прежняя строка.
5. **Досье карты / «Информация»** — строка требования + текущее «лидируете на N» из той же проекции (факт игрока — не повтор лица).
6. **e2e** — `tests/e2e/console-political-alliance.spec.ts` (НОВЫЙ ВИД на лице + готовая ходьба; tv4k + fhd; TIMING для ходьбы): (а) `political-alliance-locked`:
   p1 лидер на ОДНОЙ резолюции (вторая — ничья с p2, чей первый куб раньше) → чип руки «[две фигуры] 1/2» + хинт с именами и «ничья — его делегат раньше»;
   p1 ставит куб (голос) на вторую → лидерство → чип исчезает (доступна); (б) `political-alliance`: p1 лидер на двух (одна — с нейтральными кубами против) →
   композер: плита Карьеры «3 → 4», бонус шага, влияние; A — один POST; исход «КАРЬЕРА» в руке — маркер ходит один шаг, награда клетки, поток уходит; сервер
   согласен; (в) Парламент после: ячейки слотов `--mine` там, где лидирую; (г) лицо: две фигуры в MIN, нашивка в поле, арт X09; (д) reduced motion.
   Фикстуры — `parliamentFixture` (`stopAt: 'vote'`, три резолюции; кубы: p1 2 на A, p1 1 + p2 1 на B (p2 раньше), нейтральные на C).
7. **Объём** — тропа вида ≈ 45 %, карта + ходьба ≈ 30 %, стенд/доки ≈ 25 %; без полировки; найденное общее (тропа вида для классических карт под Redux) —
   строками в реестр текущего footer.

## 0. Рабочее дерево
1. `git log --oneline -1` → `74d699421a` на выдаче. `ListAgents` + `SendMessage` соседям (колонии): твои файлы — `turmoilRedux/PoliticalAllianceRedux.ts` + спек,
   `CardName.ts`, манифест, `turmoilReduxAdaptation.ts`, `turmoilReduxReplacements.ts`, `models/unplayableReasons.ts` (причина вида), `models/requirementProse.ts`,
   `politics/PoliticalOps.ts` (+ `leadershipStanding(player)` — проекция: ведомые / недостающие), `premiumCardViewModel.ts` (бейдж), `unplayableReasonFormat.ts`
   (эмблема/метка/хинт), `ru/{lore_texts,turmoil_redux_cards,card_info,ui,console}.json`, `invented-lore.md`, e2e + фикстуры, доки, `assets/card-images/X09.webp`,
   `lore_texts.json` (X09 — первым ханком). Коммиты — ПО ХАНКАМ / явными путями; после коммита — `git reset -q -- package.json package-lock.json`. Никогда
   `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot alliance` → `npm run e2e:remote -- alliance <spec> [--exclusive --workers=1]`; exit 2/3/4 —
   СТОП и `AskUserQuestion`.

## 1. Сервер — тропа вида + карта (≈ 45 % + 15 %)
1. `PoliticalOps.leadershipStanding(player)` (Redux: по слотам — `{instance, resolution, party, leader, mine, tieBreak, deficit}`; классика — `undefined`), причина
   `PARTY_LEADERS` под Redux — `type:'count'`, «Requires leading ${0} resolution(s)», `current`, + `leading`/`trailing`; классика — прежняя строка; строка правил
   по движку; `FULLY_RESTATED_REQUIREMENTS`; спек `unplayableReasons.spec` § leaders (ничья, нейтральные, принятая, бот), `requirementProse.spec`.
2. Карта: `PoliticalAllianceRedux.ts` (заголовок SCAN READING: цена 2, событие (красная), MIN-плита с двумя фигурами, поле — нашивка шага, лор X09; RULE READINGS
   1–4; `bespokePlay` → `walkAgenda(1)`; `agendaWalkForecast`; `cardPlayPreview`), манифест + `cardsToRemove`, реестр AUTHORED, строка долой + пин, RU, лор RU, арт X09,
   `card_info`; спек (правила 1–4).

## 2. Клиент (≈ 15 %)
`REQUIREMENT_RENDER` — две фигуры (решение 3); `COUNT_MESSAGE_EMBLEMS` / `LABELS` для нового сообщения; хинт чипа из `leading`/`trailing` (чистая функция
`leadershipHint(reason)` + спек); досье/«Информация» — строка. Ходьба Карьеры — из коробки (проверить стендом).

## 3. Стенд и регрессия (≈ 25 %)
Стенд решения 6; регрессия: `console-minority-representation`, `console-political-science`, `console-political-think-tank`, `console-parliament-vote-*`,
`console-septem-tribus` (эффект ≠ требование — не задето), `tv-profile-screens`, `npm run e2e:affected`; хуки — тем же диффом.

## 4. Визуальная приёмка (**TV первым**; fhd)
`screenshots/alliance/`: лицо (две фигуры, нашивка, арт X09); чип руки «1/2» + хинт с именами; композер с плитой Карьеры; исход «КАРЬЕРА»; Парламент с `--mine`
на ведомых. С дивана: «я понимаю, где лидирую и где не хватает одного делегата — не считая кубы сам?»

## 5. Доки и реестр
1. Реестра своего нет; строки — в раздел текущего footer.
2. Доки: `TURMOIL_REDUX_CLASSIC_CARDS.md` §4.1 — Political Alliance «СДАНА» (замены 5 из 7; остаются Recruitment TR74, Vote of No Confidence TR76); `MINORITY_REPRESENTATION.md`
   §5 — абзац «вид PARTY_LEADERS под Redux (TR73): проекция лидерства, две фигуры»; `POLITICAL_SCIENCE.md` — ссылка; `parliament-glossary.md` — «лидируете на N
   резолюциях» (семейство `LEADING_KEYS`); `invented-lore.md:32` — «заменён цитатой владельца X09»; чеклист §4 — строка «требование лидерства»; запись в журнале.

## 6. Режим работы
1. `SendMessage` соседям; лор → арт → тропа вида (сервер + спеки) → карта + ходьба → клиент (бейдж, счётчик, хинт — макет чипа на 4K: батч 2/3) → стенд →
   регрессия → раскадровки → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо с артом; затем чип/хинт, композер, исход; гарды; решения 1–7 с тем, что сделано по умолчанию; ОДИН `AskUserQuestion`
   (2, 3 с кадрами — рекомендация первой); гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Второй расчёт лидерства (только `leaderOf` / `partiesLedBy` и серверная проекция); считать нейтральных; вейвить этот вид TR70; «+1 РТ» (классика) вместо
  шага; `defer` ходьбы (синхронно, как TR04); придуманный лор при наличии цитаты владельца; свой арт/лор при `reimplements`; ореол на чипе/плите (инвариант 15);
  `title`; литерал кнопки; текст ниже пола TV.
- Файлы соседей (колонии / причалы / `ConsoleShell.vue` до их коммита); классическую `PoliticalAlliance.ts`; RU чужих ключей (`parliament.json:97/259/260` — не
  править, новые — свои); `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
