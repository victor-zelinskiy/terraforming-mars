# Промт исполнителю · Vote of No Confidence:redux («Вотум недоверия») — ПОСЛЕДНЯЯ карта-замена (TR76) и ПОСЛЕДНЯЯ карта классического Turmoil под Redux (22 из 22): событие, 5, без меток; **требование — «не менее 1 влияния»** (вид `INFLUENCE` — тропа TR04 готова); **«снимите ТЕКУЩЕГО председателя (кто бы ни сидел — делегат игрока тоже) и посадите в кресло своего делегата ИЗ РЕЗЕРВА; продвиньте маркер Карьеры на 1 шаг»** — ОБЕ механики уже в движке как ОДНА фраза: `ChairmanSeat.seat()` (старый председатель → в свой резерв, новый — из резерва, событие `chairman-seated {previous}`) + `walkAgenda(1)` (TR04) — «ПРЕДСЕДАТЕЛЬСТВО: сначала КРЕСЛО, потом КАРЬЕРА» (закон «причина раньше следствия») · ПОСЛЕ КАРТЫ — **ЗАКРЕПЛЕНИЕ**: hold-back-список пуст → §2.3 «Конец костыля» (владелец: «закрепить, что Turmoil полностью встроен в Redux и стал его частью») — удалить временную машинерию, записать скоуп в CLAUDE.md и доках; без полировки

> **Статус: ВЫДАН 2026-10-25.** HEAD `9a256f8a54` (TR74 сдана — замены 6 из 7; «на месте» 15/15). В дереве чужое незакоммиченное (`consoleLeakDetector.ts` +
> спек, e2e `console-cursor` / `console-parliament-water` / `console-water-hauling` / `hand-album-probe`) — соседи `terraforming-mars-35` (busy) / `-7d` (idle):
> `ListAgents` + `SendMessage` до первого коммита; их файлы не трогать. **Лор владельца** — строка `"T16": "The Chairman continues to disappoint - we need
> new leadership to face the current crisis."` НЕЗАКОММИЧЕНА последней в `assets/text/lore_texts.json` (вместе с запятой после `T11`): коммитить ПЕРВЫМ ханком,
> только её, + RU в `src/locales/ru/lore_texts.json» («Председатель продолжает разочаровывать — в нынешний кризис нам нужно новое руководство.»); дефис в EN
> оставить как у владельца. **Арт** — `C:\Users\zelin\Downloads\Mars Arts\T16.png` → импортировать как **T16** (`node scripts/import-card-art.mjs "<путь>/T16.png"
> T16` → `make:cards`); замена берёт арт/лор через `reimplements: CardName.VOTE_OF_NO_CONFIDENCE`. Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\
> Replacement - Vote of No Confidence.png` («TR00» — заглушка; `replacementCardNumber(VOTE_OF_NO_CONFIDENCE)` = **TR76**). ⚠ Имя: enum классики —
> `'Vote Of No Confidence'` (заглавная «Of», апстрим; RU `turmoil_cards.json:50` «Вотум недоверия» под ЭТИМ ключом) → имя замены `'Vote Of No Confidence:redux'`
> (срез суффикса даёт существующий RU; печатное «of» со скана — только в описании/лицах, не в ключе). Реестр: footer — прочитать; **без своего раздела**;
> дефекты общего слоя — строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- vonc …`; сцена двух тактов — TIMING:
> `--exclusive --workers=1`).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 (`:170–200`; `:229–231` строки), **§2.3 «Конец костыля» (`:87–91`)**, §2.4 (постоянная часть — реестр замен
и `cardsToRemove` ОСТАЮТСЯ), §2.5 гарды; шаблоны замен `7d284dc2df` (TR71), `9a8db2e3f1` (TR77 — первое действие + грант), `bc01947d53`/`d3ce9f3c08` (TR74 — два хода
одной фразой); **тропа ВЛИЯНИЯ — `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md` §5** (`RequirementType.INFLUENCE`, дескриптор `influence`, `InfluenceRequirement`
через фасад, причина `'Requires ${0} influence'` с «сейчас», бейдж `influence.svg`, `COUNT_MESSAGE_LABELS` «Влияние» — ВСЁ ЕСТЬ: TR04 носит `{influence: …}`;
пинить, не строить); **КРЕСЛО + КАРЬЕРА — `src/server/parliament/quests/ChairmanSeat.ts`** (заголовок `:1–40`: «ORDER after the answer is SEAT, then AGENDA —
причина раньше следствия»; `seat()` `:350–386`: сидящий сам → «remains the chairman» (запись без `previous`); иначе старый → `chairman = undefined` + лог «The
delegate of X leaves the chairman seat» (резерв X — производная: +1), новый — ИЗ РЕЗЕРВА (`reserve > 0` → `chairman = player.id`, лог «becomes the chairman (delegate
from the reserve)», `recordChairmanSeated(player, previous)`), иначе лобби, иначе — выбор резолюции (`seatPrompt`, маркер `votePrompt 'chairman-seat'`);
`walkAgenda(player, parliament, 1, cause)` `:100`; `applyQuest` `:330–348` — ОДИН журнальный корень `events.beginAction(player, {kind:'parliament'})`: заголовок
«takes the chairmanship» → seat → walk), `docs/claude/prompts/parliament-chairman-quest.md` **§3 «короткий flow «Председательство»»** (`:86–126`: такты
«Председательство: куб едет в кресло из своего настоящего источника; если кресло было занято — чужой куб СНИМАЕТСЯ в свой резерв» → «КАРЬЕРА: маркер едет,
шаг отвечает один раз, бонус по адресу»; законы: ни один такт не начинается, пока сцена не видна; подпись не опережает объект), клиент
`console/parliament/consoleChairmanQuest.ts` (стадии `task | agenda`, биты `task | seat | agenda | done`, субъект «ПРЕДСЕДАТЕЛЬСТВО»),
`chairmanQuestDirector.ts` (`:50` «новый делегат покидает место только когда уходящий уже в пути — кресло освобождается ПЕРВЫМ»; `:60` `playAgendaWalk`
через секцию; `:65` угловой случай выбора резолюции), e2e `console-parliament-chairman-quest.spec.ts` («сцена видна» — пробник 5), `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md`
§4 «Розыгрыш как ИСХОД, хостимый рукой» (`agendaWalk.ts` — Парламент втолкнут в зону руки; `AGENDA_WALK_STEP_STAGE` «КАРЬЕРА»); память
`parliament-delegate-figure` (фигура · след · «взял → понёс → поставил»; кресло-медальон), `visual-restraint-no-glow`, `composer-preselect-direction`,
`parliament-glossary.md` **§4 (`:69–80`: «председатель», «кресло председателя» («Кресло свободно»), «председательство + 1 шаг Карьеры», крошка
`ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО › ЗАДАНИЕ | КАРЬЕРА | КРЕСЛО`)**, `:60–67` (знак кресла T10), инварианты 1–4, 8, 9, 13, 15. Журнал — `docs/claude/
turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **классика** — `turmoil/VoteOfNoConfidence.ts` (`EVENT`, 5, `tr: {tr: 1}`, `requirements: {partyLeader: 1}`, `cardNumber 'T16'`,
`b.minus().chairman({all}).asterix(); b.plus().partyLeaders(); b.tr(1)`; `bespokeCanPlay` — резерв + НЕЙТРАЛЬНЫЙ председатель; `bespokePlay` — классический движок,
не переносится); **реестр** — `common/cards/turmoilReduxReplacements.ts:77–79` («still cost 5, event; requirement «a party leader + a NEUTRAL chairman» → «at least 1
influence»; removes the CURRENT chairman whoever holds the seat (a player's delegate too) and seats your own from the reserve; reward +1 TR → advance the Agenda
marker 1 step»); `turmoilReduxAdaptation.ts:66` (ПОСЛЕДНЯЯ строка списка); **председатель** — `Parliament.ts:155` (`chairman: PlayerId | undefined` — кресло либо
чьё-то, либо СВОБОДНО; нейтрального председателя в Redux НЕТ), `:387` (резерв = 7 − голоса − кресло − лобби — производная: снятие = возврат), `:820`
(`isChairman`), `ParliamentModel.ts:143` (`model.chairman` — цвет), `SerializedParliament.ts:511` (`pendingActions 'chairman-seat' {previous}`), `EventRecorder.ts:400–410`
(`recordChairmanSeated(player, previous?)` → `GameEvent 'chairman-seated'` `:69` — «кто новый, чей ушёл»), `ChairmanSeat.ts:207–270` (бот: `seatBot` — бот МОЖЕТ сидеть в
кресле: `parliament.chairman = bot.id`), фикстуры с председателем — `generate.ts:4115` (`parliament.chairman = p1.id`), `:4163` (`chair: 'p1' | 'p2'` — `banned-delegate-locked`);
**клиент кресла** — `parliament/ConsoleParliamentSeats.vue` (`data-parl-seat`, `con-parl__socket--seat` — место кресла в зоне делегатов), `ConsoleParliamentGovernment.vue`,
`ConsoleParliamentSeatPick.vue` (стадия `seat` — выбор резолюции; VoNC её НЕ использует: куб только из резерва), `ConsoleParliamentEngine.vue:36` (знак кресла),
`chairmanQuestDirector.ts` (бит `seat`: фигура уходящего — в его резерв, своя — из резерва в кресло; «кресло освобождается первым»); **RU** —
`parliament.json:78–81` («Задание председателя», «Кресло председателя», …), `:42` («Требование «Председатель»…»), логи `takes the chairmanship` / `becomes the chairman
(delegate from the reserve)` / `The delegate of ${0} leaves the chairman seat` — переводы существуют (грепнуть); **закрепление** — `src/server/GameCards.ts:30, :59–65,
:165–175` (`filterHeldBackUnderRedux` — «TEMPORARY — goes with the hold-back list»), `src/server/cards/turmoil/turmoilReduxAdaptation.ts` (серверный предикат),
`src/common/cards/turmoilReduxAdaptation.ts` (оба списка пусты → файл), `src/common/cards/premiumScope.ts:20–50` (`'turmoil'` «Card by card — `inPremiumScope` drops
the cards still held back» → модуль ЦЕЛИКОМ минус заменённая классика (реестр)), `client/components/create/premium/devGuaranteedCards.ts:27, :117–130`,
`src/server/deckComposition.ts:36`, тесты `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts` (`:71–96` — остаётся ТОЛЬКО раздел «the replacements»),
`premiumScope.spec.ts`, `LakefrontResorts.spec` / `Pristar.spec` / `TerralabsResearch.spec` (импортируют список — зачем: проверить, снять), `PoliticalThinkTank.spec`,
`deckComposition.spec`, `devGuaranteedCards.spec`; **CLAUDE.md `:161`** («Premium-subsystem scope today: … `turmoilRedux`. Everything else is the frontier»),
`docs/claude/expansion-adaptation-checklist.md:10` («Current scope»), `:48` («Turmoil: send-delegate has no dedicated action button yet» — устаревшая строка
классики), `docs/claude/README.md:49–50` (индекс), `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` `:3` статус, §2, §4.

---

## Диагноз (подтверждён файл:строка на `9a256f8a54`; перепроверить на своём HEAD)
1. **Требование — готово.** `{influence: 1}` — вид `INFLUENCE` (TR04): `InfluenceRequirement` через фасад (`Parliament.influence` = трек + бонусы + карты, T05),
   причина «Requires 1 influence» с «сейчас», бейдж влияния на плите MIN (скан: «1 [значок влияния]»), счётчик руки «Влияние 0/1». Пинить спеком; бонус T05
   (Event Analysts +1) ОТКРЫВАЕТ карту с нулевой Карьерой — пин.
2. **Эффект — ровно «ПРЕДСЕДАТЕЛЬСТВО» без задания.** `ChairmanSeat.seat()` делает всё печатное: старый председатель (чей угодно — игрока, бота) снимается (его куб
   → его резерв как производная), новый куб — ИЗ РЕЗЕРВА (`reserve > 0`); затем `walkAgenda(1)`. Для карты НУЖНЫ: (а) печатное «из резерва» — ТОЛЬКО резерв (не
   лобби, не выбор резолюции): резерв пуст → карта не играется (причина TR03 `No delegate in your reserve`); (б) публичная статическая функция (например
   `ChairmanSeat.unseatAndSeat(player, parliament, cause)` — та же `seat()` с запретом ветвей лобби/резолюции и причиной `{reason: 'card', card}`) + `walkAgenda(1,
   {reason:'card', card})` в ОДНОМ журнальном корне (образец `applyQuest`: заголовок группы первым); (в) событие `chairman-seated {previous}` — уже есть, нотификация
   старому председателю — проверить семью (`notificationSemantics`), `crossPlayerCoverageGuard` — классифицировать «chairman unseated»; (г) `onDelegatesDiscarded`
   — не зовётся; задание председателя (`quest`) — НЕ переходит и не сбрасывается: задание — поколения, а не лица (`addQuestProgress` считает всем; `completedBy`
   — кто закрыл); пин: смена кресла картой не трогает `quest`.
3. **Угловые случаи (решения 1–3).** Кресло СВОБОДНО (поколение 1 до первого заседания / после `seatBot` `chairman = undefined`): «снять текущего председателя»
   некого — карта не играется (причина «Кресло свободно» — ключ T10 `the chair is vacant`) — рекомендовано; Я — председатель: «снять себя и посадить себя» — ничего
   не меняет, кроме шага Карьеры за 5 M€ — карта НЕ играется (причина «вы уже председатель» — T10 `chairman now: ${0}` с собой? — своя короткая причина)
   — рекомендовано (история карты — смещение); председатель — БОТ: снимается как любой (куб → резерв бота), пин.
4. **Превью = исполнение.** `cardPlayPreview`: чип «кресло: X → вы» (кто теряет), чип резерва «3 → 2», плита Карьеры «N → N+1» + бонус шага + влияние
   (`agendaWalkForecast` — TR04 образец), предупреждения — нет (все условия — доступность). Без двери: ничего не выбирается.
5. **Консоль — хостимый исход с ДВУМЯ тактами подряд.** TR04 (§4 MINORITY) хостит ходьбу Карьеры в зоне руки; квест-флоу (`chairmanQuestDirector`) играет
   «кресло → Карьера» в Парламенте. VoNC = «кресло → Карьера» как ИСХОД РОЗЫГРЫША: Парламент втолкнут в зону руки (как TR04), бит `seat` из
   `chairmanQuestDirector` (фигура уходящего председателя — из кресла в ЕГО резерв (чип его места), затем своя фигура — со стопки резерва в кресло; «кресло
   освобождается первым»), затем бит ходьбы (`playAgendaWalk`), затем рука и Парламент уходят одной поверхностью. Крошка: `КАРТЫ В РУКЕ › ВОТУМ НЕДОВЕРИЯ ›
   КРЕСЛО` → `… › КАРЬЕРА` (стадии из глоссария §4 — слова квест-флоу, субъект — карта, не «ПРЕДСЕДАТЕЛЬСТВО»: владелец карты — субъект крошки). Лента Парламента
   — «[фигура X] покидает кресло · [ваша фигура] в кресле» + шаг. Сервер отдаёт ОДНУ запись-группу (события `chairman-seated` + `lastAdvance`) — клиент
   играет по записи (`seq`), повтор по перезагрузке — нет.
6. **Инвариант 15 / физика.** Ни одного ореола; кресло-медальон принимает фигуру материалом; две фигуры летят ПОСЛЕДОВАТЕЛЬНО (уходящая — первой), «подпись
   «председатель» пишется под креслом, когда куб уже сел».
7. **ЗАКРЕПЛЕНИЕ (после карты, отдельными коммитами).** Список `TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` пустеет → §2.3: удалить `common/cards/turmoilReduxAdaptation.ts`
   (оба списка пусты), серверный предикат `cards/turmoil/turmoilReduxAdaptation.ts`, `GameCards.filterHeldBackUnderRedux` + импорт; `premiumScope.ts` — `'turmoil'` в
   `PREMIUM_SCOPE_MODULES` без оговорки «card by card», исключение ТОЛЬКО заменённой классики по реестру (`TURMOIL_REDUX_REPLACED_CLASSIC_NAMES`) — одно
   правило, один комментарий; `devGuaranteedCards.ts` — то же; `deckComposition.ts` — комментарий/подпись состава («Классический Turmoil: 15 карт + 6 замен TR71–TR76 +
   TR77»); `TurmoilCardsUnderRedux.spec` → остаётся раздел «the replacements» (переименовать по смыслу: `TurmoilReplacementsUnderRedux.spec`?) + НОВЫЙ пин «под Redux
   раздаются ВСЕ классические карты Turmoil, кроме 7 заменённых; под классикой — все 22; ни одна замена — под классикой»; спеки корпораций, импортирующие список
   — снять импорт; CLAUDE.md `:161` — «…`turmoilRedux`, `turmoil` (classic Turmoil is PART of Redux: every card adapted or replaced — `turmoilReduxReplacements.ts`)»;
   `expansion-adaptation-checklist.md:10, :48`; `TURMOIL_REDUX_CLASSIC_CARDS.md` — статус «22/22 · ВСТРОЕН · костыль удалён (дата, коммит)», §2.2/§2.3 — «выполнено»,
   §4 — все строки «СДАНА»; `README.md` индекс — строка дока «история включения, реестр замен — постоянная часть»; чеклист §0 — абзац про hold-back → «истории нет,
   реестр замен — единственный список»; журнал — итоговая запись «классический Turmoil под Redux — закрыт». Гарды после удаления: `premiumScope.spec`,
   `deckComposition.spec`, `PoliticalThinkTank.spec` (пул карт с требованием партии — классика целиком), `e2eLiveness`, `i18n.spec`; e2e `console-draft-*` /
   `start-scene-profiles` — раздача не поменялась по факту (все карты уже раздавались) → регрессия 1 повтор.

## Правила карты (спек `tests/cards/turmoilRedux/VoteOfNoConfidenceRedux.spec.ts` пинит каждое — структура TR72/TR74)
1. Печатная: событие, 5, без меток, без ПО, `TR76`, `reimplements: VOTE_OF_NO_CONFIDENCE`, имя `'Vote Of No Confidence:redux'`; лицо — MIN «1 [влияние]»; поле — «− [фигура
   в кресле]* + [своя фигура] · [нашивка]» (значки набора: кресло T10 `chair.svg` как рамка снимаемой фигуры / печатные силуэты; шаг — `agendaStep(1)`); арт/лор — T16.
2. Играется ⇔ влияние ≥ 1 (любая дорога: трек / бонус карты T05 / …) ∧ кресло ЗАНЯТО не мной ∧ резерв ≥ 1; причины — в порядке: влияние («Requires 1 influence · сейчас
   0») → «кресло свободно» → «вы уже председатель» → «нет делегата в резерве»; бот в кресле — цель.
3. Исполнение (один журнальный корень, заголовок «${0} takes the chairmanship» первым): старый председатель → его резерв (+1; лог «The delegate of X leaves the chairman
   seat»; событие `chairman-seated {previous: X}`; нотификация X), мой куб из резерва → кресло (резерв −1; лобби не тронуто), затем `walkAgenda(1, {reason:'card'})`
   (бонус шага по правилам трека; конец трека — именованный обрез); `quest` не трогается; `onDelegatesDiscarded` не зовётся; требование «Председатель» других карт
   (T10, TR72) — у меня выполнено сразу; `isChairman(X)` false.
4. Превью = исполнение (чипы кресла/резерва/Карьеры); раздача под обоими столами; save / load — `pendingActions` не создаётся (из резерва всегда), `chairman` ✓.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **Кресло свободно** — (а, рекомендовано) НЕ играется, причина «Кресло свободно» (T10-ключ); (б) играется — просто сесть (нечего снимать: текст «remove the
   current Chairman» не выполнен).
2. **Я — председатель** — (а, рекомендовано) НЕ играется («вы уже председатель»); (б) играется ради шага Карьеры.
3. **Бот в кресле** — снимается как любой (куб → резерв бота; D12/D14: бот — обычное место Парламента).
4. **Стадии крошки** — `КРЕСЛО` → `КАРЬЕРА` (слова квест-флоу из глоссария §4; субъект — карта); (б) одно слово «СМЕЩЕНИЕ».
5. **Две фигуры** — последовательно: уходящая (из кресла в чип/резерв её владельца) ПЕРВОЙ, своя (со стопки резерва в кресло) — когда уходящая уже в пути
   (`chairmanQuestDirector:50`); подпись «председатель» под креслом — после посадки; без ореола.
6. **Закрепление — в ЭТОЙ задаче** (владелец: «после его адаптации можно закрепить»), ОТДЕЛЬНЫМИ коммитами после зелёной карты: (а, рекомендовано) полный §2.3 +
   `premiumScope` «модуль целиком минус реестр замен» + CLAUDE.md + доки; (б) только CLAUDE.md/доки, код костыля оставить — нет (владелец: «стал его частью»).
7. **e2e** — `tests/e2e/console-vote-of-no-confidence.spec.ts` (две механики в одном исходе — свой спек; tv4k + fhd; TIMING): (а) композер: плита MIN «1 влияние»
   выполнена, чипы «кресло: red → вы», «резерв 3 → 2», Карьера «N → N+1»; A — ОДИН POST (двери нет); (б) исход в руке: Парламент втолкнут в зону руки; крошка
   `КАРТЫ В РУКЕ › ВОТУМ НЕДОВЕРИЯ › КРЕСЛО`: фигура red покидает кресло (его резерв тикает на касании), моя — со стопки резерва в кресло (резерв тикает на
   отрыве, подпись «председатель» после посадки); `… › КАРЬЕРА`: маркер шагает, бонус шага по адресу; рука и Парламент уходят одной поверхностью; (в) сервер
   согласен (кресло моё, резервы, шаг, журнал одной группой); нотификация red; (г) `-locked`: влияние 0 → чип «Влияние 0/1»; кресло свободно → причина; я
   председатель → причина; резерв 0 → причина; (д) бот в кресле → снимается; (е) reload посреди — честно (без `pendingActions`); (ж) reduced motion — те же числа.
   Фикстуры — `parliamentFixture` (`chair: 'p2' | 'none' | 'p1' | 'bot'`-класс как `banned-delegate-locked`; p1 с влиянием ≥ 1 (Карьера ≥ 1 или T05 на столе), резерв).
8. **Объём** — сервер (функция смещения + причины + превью) ≈ 25 %, карта/лицо/RU ≈ 10 %, консоль (исход «кресло → Карьера» в руке) ≈ 35 %, стенд ≈ 10 %,
   ЗАКРЕПЛЕНИЕ ≈ 20 %; без полировки.

## 0. Рабочее дерево
1. `git log --oneline -1` → `9a256f8a54` на выдаче; `ListAgents` + `SendMessage` соседям (их файлы — `consoleLeakDetector`, e2e курсора/воды/альбома). Твои файлы —
   `turmoilRedux/VoteOfNoConfidenceRedux.ts` + спек, `CardName.ts`, манифест (+ `cardsToRemove`), `turmoilReduxReplacements.ts` (AUTHORED), `turmoilReduxAdaptation.ts`
   (строка долой → затем файл долой), `parliament/quests/ChairmanSeat.ts` (публичная функция смещения), `models/unplayableReasons.ts`? (нет — причины в карте/шаге),
   `cards/actionPreviews.ts` (чипы кресла/резерва, если нет), клиент: `console/parliament/agendaWalk.ts` + `chairmanQuestDirector.ts` (бит seat как исход розыгрыша),
   `consoleTaskRouter.ts` (стадии), `ConsoleParliamentSeats.vue` (если нужен якорь), `ru/{lore_texts,turmoil_redux_cards,card_info,parliament}.json`, e2e +
   фикстуры, `assets/card-images/T16.webp`, `lore_texts.json` (T16 — первым ханком); ЗАКРЕПЛЕНИЕ — файлы диагноза 7. Коммиты — ПО ХАНКАМ / явными путями;
   после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot vonc` → `npm run e2e:remote -- vonc <spec> --exclusive --workers=1`; exit 2/3/4 — СТОП и
   `AskUserQuestion`.

## 1. Сервер — карта (≈ 35 %)
`ChairmanSeat.unseatAndSeatFromReserve(player, parliament, cause)` (публичная; только резерв; `previous`; событие; журнал в корне вызывающего) — спек
`tests/parliament/ChairmanSeat.spec` § card (старый → резерв, новый из резерва, бот, свободное кресло / сам — отказ, `quest` не тронут); карта `VoteOfNoConfidenceRedux.ts`
(заголовок SCAN READING / RULE READINGS; `requirements: {influence: 1}`; `bespokeCanPlay` — три условия; `bespokePlay` — ОДИН корень: заголовок → смещение →
`walkAgenda(1, {reason:'card', card})`; `agendaWalkForecast`; `cardPlayPreview` с чипами кресла/резерва/Карьеры); манифест + `cardsToRemove`; реестр AUTHORED; строка
долой; пин `replaced` (все 7); RU; лор RU; арт T16; `card_info`; `crossPlayerCoverageGuard` — семья «chairman unseated» (сценарий доставки: red получает нотификацию
«ваш делегат покинул кресло — Вотум недоверия»).

## 2. Консоль — исход «КРЕСЛО → КАРЬЕРА» в руке (≈ 35 %)
`agendaWalk.ts`-класс исхода получает ПРЕДШЕСТВУЮЩИЙ бит `seat` (из `chairmanQuestDirector` — переиспользовать бит, не копировать: фигура уходящего из кресла в
его чип/резерв, своя со стопки резерва в кресло, подпись после посадки), стадии крошки `КРЕСЛО` → `КАРЬЕРА` (`FOLLOW_UP`/`AGENDA_WALK_STEP_STAGE`-класс), холды
именованные, A «дожать», reduced motion; лента Парламента — строка смещения; `glowRestraintGuard` = 0. Спеки: `agendaWalk.spec` § seat-beat, `chairmanQuestDirector.spec`
(бит как исход карты), `consoleTaskRouter.spec` (стадии), `parliamentGlossary.spec`.

## 3. Стенд, регрессия, ЗАКРЕПЛЕНИЕ (≈ 30 %)
1. Стенд решения 7; регрессия: `console-parliament-chairman-quest`, `console-minority-representation`, `console-banned-delegate`, `console-council-seat`,
   `console-party-sanctions` (требование «Председатель» после смещения), `console-political-alliance`, `tv-profile-screens`; `npm run e2e:affected`.
2. ЗАКРЕПЛЕНИЕ (диагноз 7) — отдельные коммиты: (а) код костыля долой + `premiumScope` одно правило + спеки; (б) CLAUDE.md `:161` + `expansion-adaptation-checklist.md`;
   (в) `TURMOIL_REDUX_CLASSIC_CARDS.md` финальный статус + README + чеклист + журнал. После (а) — `npm run test:server`, `test:client`, `build:test`, `lint`,
   `make:cards`, `make:json`; e2e — `console-draft-showcase` / `start-scene-profiles` / `console-research-startups` (состав колоды) по 1 повтору.

## 4. Визуальная приёмка (**TV первым**; fhd)
`screenshots/vonc/`: лицо (арт T16, «1 влияние», кресло/фигуры/нашивка); композер с чипами; исход: фигура red покидает кресло → моя садится → подпись → маркер
шагает; чипы руки с четырьмя причинами. С дивана: «я вижу, кого сместил, откуда пришёл мой делегат и за что шаг — и это одна фраза, а не две сцены?»

## 5. Доки и реестр
1. Реестра своего нет; строки — в раздел текущего footer.
2. Доки: новый `docs/TURMOIL_REDUX_VOTE_OF_NO_CONFIDENCE.md` (смещение как публичная функция кресла; исход «кресло → Карьера» в руке; причины; FAQ-угловые
   случаи); `parliament-chairman-quest.md` §3 — «бит `seat` переиспользован картой»; `parliament-glossary.md` — стадии карты; **финал истории:**
   `TURMOIL_REDUX_CLASSIC_CARDS.md` («22/22 · классический Turmoil — ЧАСТЬ Redux», §2.3 выполнено, §4 все «СДАНА»), CLAUDE.md `:161`, `expansion-adaptation-checklist.md`,
   README, чеклист §0, журнал (итог: что было сделано за 22 карты одной таблицей — номер, дата, механика/полировка).

## 6. Режим работы
1. `SendMessage` соседям; лор/арт → сервер (функция + карта + спеки) → консоль (исход) → стенд → регрессия → ЗАКРЕПЛЕНИЕ (а) → (б) → (в) → раскадровки.
   Коммит по ханкам.
2. Отчёт: первой строкой — лицо с артом; затем кадры исхода, гарды, решения 1–8 с тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (1, 2, 4, 6 —
   рекомендация первой), гэпы честно; последним абзацем — «что удалено костылём и что стало правилом скоупа» (одна таблица).
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Классический движок (`Turmoil`, `setNewChairman`, NEUTRAL-председатель); куб из лобби или с резолюции (только резерв — печатно); трогать `quest`;
  `pendingActions 'chairman-seat'` от этой карты; вторая реализация смещения мимо `ChairmanSeat`; два журнальных корня; две одновременные фигуры в воздухе;
  ореол на кресле/фигуре (инвариант 15); «+1 РТ» (классика) вместо шага; auto-select; `title`; литерал кнопки; текст ниже пола TV; свой арт/лор при `reimplements`;
  удалять реестр замен / `cardsToRemove` (постоянная часть — §2.4); оставлять костыль «на всякий случай» (решение 6а).
- Файлы соседей до их коммита; классическую `VoteOfNoConfidence.ts`; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
