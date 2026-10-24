# Промт исполнителю · Banned Delegate:redux («Изгнание делегата») — ВТОРАЯ карта-замена набора Redux (TR72; шаблон — TR71 `7d284dc2df`): событие, 0 M€; требует ПРЕДСЕДАТЕЛЬСТВА (знак кресла T10); «уберите ЛЮБОГО делегата с резолюции или из области народной поддержки» — ПЕРВАЯ карта, снимающая ОДНОГО ЧУЖОГО делегата со стола Парламента: сегодня у Парламента есть только `removeLatestVote` для своего кресла и сброс ВСЕЙ области TR12; классический `SelectDelegate` консолью не обслуживается (`consoleTaskRouter.ts:822` — «unknown») → нужен НОВЫЙ режим Парламента «выбор делегата» (фигура на следе — по глоссарию §3-bis) со staged-дверью розыгрыша (TR03/TR12-класс) и возвратом фигуры «взял → понёс → поставил» в резерв хозяина / общий запас; без полировки

> **Статус: ВЫДАН 2026-10-24.** HEAD `7a75d3f64f` (VISUAL RESTRAINT pass 2 — инвариант 15: состояние = кромка/заливка/вес, НИКОГДА ореол; гард
> `glowRestraintGuard` — Парламент на НУЛЕ ореолов: новый режим не может добавить ни одного). В дереве чужое незакоммиченное: `ConsoleActionComposer.vue`,
> `actionDescription.ts`, доки ONE FRAMEWORK / soft gates, `package*.json` — сосед `terraforming-mars-b9` (busy): `ListAgents` + `SendMessage` до первого коммита,
> его файлы не трогать. **Лор владельца** — строка `"T02": "You are not welcome in our chambers."` НЕЗАКОММИЧЕНА последней в `assets/text/lore_texts.json`:
> коммитить ПЕРВЫМ ханком, только её. **Арт** — `C:\Users\zelin\Downloads\Mars Arts\T02.png` → импортировать как **T02** (`node scripts/import-card-art.mjs
> "<путь>/T02.png" T02` → `make:cards`); замена берёт арт и лор через `reimplements` (TR71-шаблон). Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\
> Replacement - Banned Delegate.png` («TR00» — заглушка; номер — `replacementCardNumber(BANNED_DELEGATE)` = **TR72**). Реестр: footer «PL-1020», последний
> раздел CL; **без своего раздела** (полировки нет); дефекты общего слоя — строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine**
> (`npm run e2e:remote -- banned …`; exit 2/3/4 → спросить; стенд — FUNCTIONAL + один полёт фигуры (TIMING-сцена — `--exclusive --workers=1`)).

Процедура — **TR71 как шаблон** (`docs/claude/prompts/replacement-aerial-lenses.md` + коммит `7d284dc2df`: 25 файлов — `CardName.X_REDUX`, класс
`turmoilRedux/<Name>Redux.ts` с заголовком SCAN READING / RULE READINGS, `reimplements`, манифест + `cardsToRemove`, строка долой из
`TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` тем же диффом, `common/cards/turmoilReduxReplacements.ts` — отметка «AUTHORED» в строке реестра, `premiumScope`
(заменённая классика — вне скоупа и пикера `devGuaranteedCards`), спек в правилах, `TurmoilReduxCardManifest.spec` (TR72 = строка реестра), `cardLore.spec`
(через `reimplements`), `i18n.spec` / `deckComposition.spec`, журнал `turmoil-redux-cards-progress.md:6096`, док `TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 (`:162–183`,
обновлён по факту TR71 — «где имя — ключ: проверено на TR71» `:174–178`), чеклист `turmoil-redux-card-checklist.md` (+ абзац «карта-замена»; **§5 политика e2e:
НОВАЯ механика → один спек**). **Контракты механики:** `docs/TURMOIL_REDUX_PARTY_SANCTIONS.md` **§3 «режим выбора области — наследует любая будущая карта»**
(`:71–96`: `PlayDoor {kind:'parliament', mode}`, мост `parliamentPromptBridge`, `ParliamentStage`, кольцо курсора — чистая модель, плашки не двигаются, панель
чтения в ячейке области голосования, лента, полоса), §4 «два такта после одного A», `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (staged-дверь розыгрыша, один
POST с адресованным хвостом), `docs/claude/parliament-glossary.md` **§3-bis «Фишка делегата — ОДНА фигура»** (`:47–57`: фигура / след / печатный силуэт /
«взял → понёс → поставил»), `:60–67` (председательство, знак кресла — T10), `:144` («Уходит со стола · делегаты возвращаются» — язык обновления), `:264`
(стадия режима = по тому, что делает выбор); память `parliament-delegate-figure` (СДАНО 2026-10-24: `delegate.svg` / `PlayerDelegate` в цвете куба, место = след,
полёт фигуры), `parliament-step-full-stage` (Парламент из действия/закона берёт ВСЮ сцену, карта уходит — L3/B), `parliament-one-framework-prompt`,
`visual-restraint-no-glow`, `composer-preselect-direction` (единственная цель — посеяна, помечена), `cross-player-coverage-guard` (чужой делегат снят = чужое
изменение → нотификация жертве, семейство механизма), `notification-source-and-glance-rule`, `marsbot-turmoil-redux-design` (D12: голос бота = голос человека —
кубы бота на резолюциях — такие же цели), инварианты 1–4, 8, 9, 13, 15. Журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/
gameplay-polish-ledger.md`.

**Образцы — по частям:** **классика** — `turmoil/BannedDelegate.ts` (`EVENT`, 0, `requirements: {chairman: true}`, `cardNumber 'T02'`, `b.minus().delegates(1, {all})`;
`bespokePlay`: по партиям `SelectDelegate(players)` → `OrOptions`, лидера нельзя, лог «${0} removed ${1}'s delegate from ${2}» / «…neutral delegate…»); **реестр**
— `common/cards/turmoilReduxReplacements.ts` (строка BANNED_DELEGATE: «still cost 0, event, requires you to be Chairman; the target is any delegate from a resolution
or Popular Support area — no NON-LEADER clause»; `replacementCardNumber`); **Парламент** — `parliament/Parliament.ts:40–41` (`Vote {owner: Delegate, seq}`, `Slot
{instance, votes[]}`), `:345` `votesOf`, `:359` `neutralVotes`, `:369` `reserve`, `:407` `leaderOf`, `:473` `winnerAmong`, `:598` `effectDelegatesOf`, `:761` `isChairman`,
**`:925–933` `removeLatestVote(player, slot)`** — ЕДИНСТВЕННОЕ снятие куба с резолюции (своё кресло; «keeps their earliest — the tie-breaker»), `:936–979`
(`popularSupportOf` / `addPopularSupport` / `discardPopularSupport(party)` — ВСЯ область, TR12 / `moveSupportToSlot`), `ICard.ts:314–324` (`onDelegatesDiscarded` —
хук ЗАСЕДАНИЯ на обновлении, «never called for … `removeLatestVote` — a move, not a discard»), `ParliamentPhase.ts:982–1009`; **TR12 — ближайший прецедент** —
`parliament/DiscardPopularSupport.ts:54–120` (`previewSelectParty()`, `supportPrompt`, `markChoiceContext {mode:'effect-choice'}`), `inputs/SelectParty.ts:9–42`
(маркеры `votePrompt` / `supportPrompt` → `SelectPartyModel`, `PlayerInputModel.ts:732–735`, `:1430`), `turmoilRedux/PartySanctions.ts`, клиент
`parliament/ConsoleParliamentSupportMode.vue` (панель режима), `ConsoleSupportPlaces.vue` (места с «уходящими» кубами — пунктир + бледный куб), `ConsoleVoteLedger.vue`
(лента голосов резолюции — фигуры по владельцам), `console/parliament/supportPickModel.ts` (кольцо), `consoleParliamentFlow.ts` (`armSupportPickFlow`, стадии),
`consolePlayCardComposer.ts:286–301` (`playDoorOf` — `supportDiscard` → `{kind:'parliament', mode:'support'}`), `common/models/ActionPreviewModel.ts` (`StagedSupportModel`),
e2e `console-party-sanctions.spec.ts:1–40`, фикстура `party-sanctions` `generate.ts:4026–4040`; **TR03** — `parliament/PlaceDelegatesOnResolution.ts` (грант —
обратная операция: куб из резерва на резолюцию; полёт из стопки резерва на ленту), e2e `console-political-donation`; **T10** — знак кресла (`PremiumChairGlyph`,
плита MIN, чип руки «сейчас председатель: X / кресло свободно», `chairmanRequirementReason` `unplayableReasons.ts:364–372`), e2e `console-party-sanctions`
(хуки знака); **модель** — `common/models/ParliamentModel.ts:24–40` (`ParliamentVoteModel {owner: Color|'neutral', seq}`, `ParliamentSlotModel.votes`), `:584–594`
(события обновления: `leave … returned: [{owner, count}]`, `support`, `lobby`); **бот** — `automa/AutomaLobbying.ts:11, :80` (`castBotVote` — кубы бота на
резолюциях как у человека); **гарды** — `tests/notifications/crossPlayerCoverageGuard.spec.ts` (три ноги; новая СЕМЬЯ механизма → сценарий доставки в
`crossPlayerDeliveryAudit.spec.ts`), `parliamentGlossary.spec`, `glowRestraintGuard` (Парламент = 0), `console-parliament-stability.spec` (d-pad двигает только курсор),
`oneFrameworkGuard.spec`.

---

## Диагноз (подтверждён файл:строка на `7a75d3f64f`; перепроверить на своём HEAD)
1. **Правила замены просты, механика — новая.** Классический `bespokePlay` — классический движок (`Turmoil`, `SelectDelegate`, партии, лидер) — под Redux
   не переносится ни строкой: в Redux делегаты стоят на РЕЗОЛЮЦИЯХ области голосования (`Slot.votes[]` — владелец + `seq`, включая `'NEUTRAL'` и бота) и в ОБЛАСТЯХ
   НАРОДНОЙ ПОДДЕРЖКИ партий (счётчик нейтральных); «лидер» снимаем (нет NON-LEADER); «любой» = чужой, свой, бота, нейтральный. Требование — `{chairman: true}`
   (T10 — фасад, именованная причина, знак кресла).
2. **Сервер: нет операции «снять ОДНОГО делегата» для чужого.** `removeLatestVote(player, slot)` — только свой, в кресло («move, not a discard»);
   `discardPopularSupport(party)` — вся область. Нужны ДВЕ операции Парламента с одной грамматикой: `removeVote(slot, owner: Delegate)` (куб владельца → его
   резерв; нейтральный → общий запас; какой из кубов владельца — решение 2) и `removePopularSupport(party, 1)` (один нейтральный → запас); обе — через
   рекордер событий (журнал, нотификация жертве, модель обновления `leave`-класса: «делегат возвращается»); производные (лидер, `isWinning`, эффект партии «2
   делегата», `effectDelegatesOf`) — пересчитываются живьём (пин); `onDelegatesDiscarded` НЕ зовётся (хук заседания — пин).
3. **Промпт: новый СТРУКТУРНЫЙ маркер.** Классический `SelectDelegate` консоль не обслуживает (`consoleTaskRouter.ts:822`). По образцу TR12: `SelectParty`-подобный
   ввод с маркером `delegatePrompt` (кандидаты: для каждой резолюции — владельцы с числом кубов `{slot, owner, count}`; для каждой партии — нейтральные в
   области `{party, count}`), `choiceContext {source: card, mode: 'attack'}` (чужой куб — атака: нотификация жертве как у `removeAnyPlants`), `preview…()`
   = исполнение (читается дважды), `previewSkip` → именованная недоступность при пустом столе (событие за 0 без эффекта — футильно: карта НЕ играется,
   причина «на столе нет делегатов»). Ответ — адрес цели (`{slot, owner}` | `{party}`), `stagedFor` для staged-двери.
4. **Консоль: режим Парламента «выбор делегата».** По §3 TR12 («наследует любая будущая карта»): `PlayDoor {kind:'parliament', mode:'delegate'}`, CTA «Выбрать
   делегата», ряд «ДАЛЕЕ: Делегат — выбор в Парламенте», крошка `… › ИЗГНАНИЕ` (стадия — по тому, что делает выбор; слово из глоссария — согласовать),
   `ParliamentStage 'delegate'`; КУРСОР ходит по ФИГУРАМ (лента голосов каждой резолюции — по владельцам; места народной поддержки партий), плашки и
   резолюции не двигаются (`console-parliament-stability`); под курсором — фигура «уходящая» (пунктирный след + бледная фигура, грамматика TR12
   `ConsoleSupportPlaces.outgoing`), панель чтения в ячейке области голосования: кто уходит («делегат игрока X с резолюции R» / «нейтральный из области P»),
   последствия `current → resulting` (голоса R: 3 → 2, лидер меняется?, победитель заседания меняется?, эффект партии у X теряется?) — ВСЁ из серверной
   проекции (маркер несёт прогноз, как `votePrompt.support` / `supportPrompt`), никакой арифметики на клиенте; единственная цель — посеяна и помечена
   (CC); A — один POST (staged: хвост `stagedFor`; живой — ответ). Такт после A: фигура «взял → понёс → поставил» с ленты/места в стопку резерва хозяина
   (чужого — на его место/чип) или в общий запас (обратный полёт TR03); лента/область тикают на отрыве; поток завершается на поле (одно охраняемое
   заключение). Полоса: staged — «Разыграть карту · Осмотреть · Источник · Назад»; живая — «Выбрать · … · Свернуть». Инвариант 15: ни одного ореола —
   состояние фигуры «уходит» — формой (пунктир, бледность), курсор — единственный свет.
5. **Полная сцена.** По `parliament-step-full-stage` (2026-10-24): Парламент из розыгрыша/действия берёт ВСЮ сцену, карта уходит (L3 — источник, B — назад
   в композер). Режим делегата — та же поза, что `support`.
6. **Остальное по шаблону TR71:** `AERIAL`-коммит как чеклист (имя `'Banned Delegate:redux'`, `reimplements: BANNED_DELEGATE`, TR72, манифест + `cardsToRemove`, строка
   долой, реестр «AUTHORED», `premiumScope`, `devGuaranteedCards`, RU описание — новый EN-ключ «Requires you to be Chairman. Remove any delegate from a
   resolution or Popular Support area.» → RU в `turmoil_redux_cards.json`; имя — существующее «Изгнание делегата» через fallback; `card_info`; лор T02 + RU
   («Вам не рады в наших палатах.»); арт T02).

## Правила карты (спек `tests/cards/turmoilRedux/BannedDelegateRedux.spec.ts` пинит каждое)
1. Печатная: событие, 0, без меток, `TR72`, `reimplements: BANNED_DELEGATE`, имя `'Banned Delegate:redux'`; лицо — «− [делегат]» (`delegates(1, {all})`), плита MIN —
   КРЕСЛО (T10); арт / лор — T02 через `reimplements`.
2. Требование — председательство (`isChairman`); не председатель → причина «требует председательства · сейчас председатель: X / кресло свободно» (T10-класс).
3. Цели — КАЖДЫЙ куб на столе: на резолюциях области голосования — свои, чужие, бота, нейтральные (по владельцам: цель = «один делегат владельца X на
   резолюции R»); в областях поддержки — один нейтральный на партию с ненулевой областью. Принятая (enacted) резолюция — НЕ область голосования (не цель);
   кресло председателя — не цель; лобби — не цель. Нет ни одной цели → карта НЕ играется, причина именованная (футильность события за 0).
4. Исполнение: куб владельца X → резерв X (`reserve(X)` +1; `votesOf(X, slot)` −1 — какой куб: решение 2); нейтральный с резолюции → общий запас (`neutralSupply`
   +1); нейтральный из области → запас +1, область −1; производные (лидер, `isWinning`, победитель, эффект партии «2 делегата» у X, доступ по альянсу TR62,
   `effectDelegatesOf`) — живьём; `onDelegatesDiscarded` — НЕ зовётся; событие с источником-картой и ЖЕРТВОЙ (чужой куб) — журнал «${0} изгнал делегата ${1} с
   резолюции ${2}» / «…нейтрального делегата с ${2}» / «…из области поддержки ${2}»; нотификация жертве; свой куб — без жертвы.
5. Превью = исполнение (кандидаты + прогноз на каждого: голоса / лидер / победитель / эффект партии / альянс), `previewSkip` при пустом столе; staged-дверь
   розыгрыша; save / load — ничего нового; MarsBot: его кубы — цели (D12), сам не играет; классический стол — классика байт-в-байт (`cardsToRemove` только под Redux).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **Стадия и слово** — крошка `… › ИЗГНАНИЕ` (по имени карты «Изгнание делегата» и глоссарию «по тому, что делает выбор»); кикер ленты «ИЗГНАНИЕ»;
   добавить в глоссарий; (б) «ДЕЛЕГАТ».
2. **Какой куб владельца снимается** — (а, рекомендовано) ПОСЛЕДНИЙ поставленный (`seq` max — симметрично `removeLatestVote`: ранний куб-тайбрейкер остаётся,
   игрок выбирает ТОЛЬКО владельца и резолюцию — одна фигура под курсором = «один делегат X»); (б) игрок выбирает конкретную фигуру (`seq`) — лишняя
   гранулярность без правила на скане.
3. **Прогноз в панели** — (а, рекомендовано) четыре строки, каждая только при изменении: «голоса R: 3 → 2», «лидер: X → Y / без лидера», «победитель
   заседания: R → R′», «эффект партии у X: теряется» (+ «доступ по альянсу» если TR62 на столе); из маркера (сервер); (б) только голоса.
4. **Полёт** — (а, рекомендовано) фигура «взял → понёс → поставил» (память `parliament-delegate-figure`) с ленты/места на стопку резерва хозяина (чужого —
   на его чип места — приёмка T06 M1 с «ожидает») или в общий запас; (б) растворение на месте — нет (физическая причинность).
5. **e2e** — `tests/e2e/console-banned-delegate.spec.ts` (НОВАЯ механика — по §5 обязателен; tv4k + fhd): (а) композер карты из руки: «Выбрать делегата» шлёт
   НИЧЕГО; (б) один поток: крошка `КАРТЫ В РУКЕ › ИЗГНАНИЕ ДЕЛЕГАТА › ИЗГНАНИЕ`, Парламент — один экземпляр на всей сцене, карта ушла (L3 — источник);
   (в) курсор ходит по фигурам (резолюции по владельцам + области), плашки/резолюции не двигаются (rect всех), фигура под курсором «уходит» формой,
   панель печатает прогноз сервера; B — назад в композер; (г) A — ровно ОДИН POST с адресованным хвостом; (д) полёт: фигура с ленты в резерв жертвы
   (чужой чип) / в запас; счётчики тикают на отрыве; (е) сервер согласен: голоса, резерв жертвы +1, лидер, карта в стопке событий; (ж) поток кончается на
   поле; (з) `-locked`: не председатель → чип руки с причиной и креслом; стол без делегатов → причина «нет делегатов»; (и) reduced motion. Фикстуры:
   `banned-delegate` (`parliamentFixture`: Redux + Colonies; p1 — ПРЕДСЕДАТЕЛЬ (как в T10-фикстуре — найти её имя в `generate.ts`), три резолюции с кубами
   p1 / p2 / нейтральными, одна область с поддержкой, карта в руке), `banned-delegate-locked` (кресло у p2), `banned-delegate-empty`.
6. **Объём** — всё карта + режим (≈ 100 %); без полировки; дефекты общего слоя — строками в реестр текущего footer; найденное общее для Recruitment (TR74:
   «нейтральный на резолюции ↔ свой из резерва» — ТОТ ЖЕ выбор фигуры) — записать как задел в §3.2 дока.

## 0. Рабочее дерево
1. `git log --oneline -1` → `7a75d3f64f` на выдаче. `ListAgents` + `SendMessage` соседу-b9: твои файлы — `turmoilRedux/BannedDelegateRedux.ts` + спек, `CardName.ts`,
   манифест, `turmoilReduxAdaptation.ts`, `turmoilReduxReplacements.ts`, `parliament/Parliament.ts` (две операции), новый `parliament/RemoveDelegate.ts` (шаг +
   превью), `inputs/SelectParty.ts` / `PlayerInputModel.ts` (маркер), `ActionPreviewModel.ts` (`StagedDelegateModel`), `consolePlayCardComposer.ts` (дверь),
   `parliament/*` клиент (режим), `console_parliament*.less`, `ru/*.json`, e2e + фикстуры, доки, `assets/card-images/T02.webp`, `lore_texts.json` (строка T02 —
   первым ханком). `ConsoleActionComposer.vue` — ПОСЛЕ коммита соседа. Коммиты — ПО ХАНКАМ / явными путями; после коммита — `git reset -q -- package.json
   package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot banned` → `npm run e2e:remote -- banned <spec> [--exclusive --workers=1]`; exit 2/3/4 —
   СТОП и `AskUserQuestion`.

## 1. Сервер (≈ 40 %)
Карта (TR71-шаблон); `Parliament.removeVote(slot, owner)` + `removePopularSupport(party, n)` (рекордер, модель обновления, пины производных); шаг
`RemoveDelegate` (кандидаты, прогноз на кандидата, `previewSelect…()`, `previewSkip`, `choiceContext mode:'attack'`, журнал с жертвой); маркер `delegatePrompt` на
`SelectParty`-классе (или свой ввод — одно решение, задокументировать); спек карты (правила 1–5) + `Parliament.spec` (операции) + `RemoveDelegate.spec` (превью =
исполнение); `crossPlayerCoverageGuard` — новая семья «delegate-removed» + сценарий доставки; `TurmoilReduxCardManifest.spec` (TR72); `TurmoilCardsUnderRedux.spec`.

## 2. Клиент (≈ 45 %)
Дверь `mode:'delegate'`; `ParliamentStage 'delegate'` + мост `delegatePick`; кольцо курсора по фигурам (чистая модель `delegatePickModel.ts` — порядок: резолюции
слева направо, внутри — владельцы по ленте, затем области; ◀▶ с упором, ▲▼ между рядами); фигура «уходит» формой; панель чтения (решение 3); лента/полоса;
полёт (решение 4) под именованным холдом; завершение потока — одно заключение; полная сцена (`parliament-step-full-stage`). Спеки: `delegatePickModel.spec`,
`consoleParliamentFlow.spec` § delegate, `parliamentBand.spec` (кикер), `parliamentGlossary.spec` (слово), `glowRestraintGuard` (0), `console-parliament-stability`
(фигуры под курсором не двигают плашки), `cursorGrammarGuard`.

## 3. Тесты и регрессия (≈ 15 %)
Стенд решения 5; регрессия: `console-party-sanctions`, `console-political-donation`, `console-parliament-vote-*`, `console-parliament-stability`,
`console-parliament-chassis-parity`, `console-bot-attack` (жертва-бот), `console-notification-bonus-attack` (нотификация жертве), `tv-profile-screens` — по
1–2 повтора; `npm run e2e:affected`; хуки — тем же диффом (инвариант 14).

## 4. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd)
`screenshots/banned/{tv,fhd}/`: лицо с артом T02 и креслом в MIN; композер с дверью; Парламент в режиме: курсор на фигуре чужого на резолюции (панель с
прогнозом), на нейтральном в области; B назад; A → полёт фигуры в чужой чип / запас; конец на поле; чип руки «требует председательства». С дивана: «я вижу,
чей делегат уходит и что это меняет — до нажатия?»

## 5. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer.
2. Доки: новый `docs/TURMOIL_REDUX_BANNED_DELEGATE.md` (режим выбора делегата — наследует TR74 Recruitment; операции Парламента; маркер; прогноз; полёт);
   `TURMOIL_REDUX_PARTY_SANCTIONS.md` §3 — ссылка «третий режим — delegate»; `parliament-glossary.md` — стадия «ИЗГНАНИЕ», «изгнать делегата»; `TURMOIL_REDUX_CLASSIC_CARDS.md`
   §4.1 — Banned Delegate «СДАНА» (замены 2 из 7), §3.2 — задел для Recruitment; чеклист — строка про режим делегата; запись в журнале.

## 6. Режим работы
1. Читать до кода; `SendMessage` соседу; сервер (операции → шаг → маркер → карта → спеки) → дверь + режим (макет курсора на живой сцене 4K: фигура под
   курсором «уходит» + панель — батч) → полёт → стенд → регрессия → раскадровки → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо с артом; затем кадры режима (курсор на фигуре, панель, полёт), результат гардов/регрессии, решения 1–6 с тем, что сделано по
   умолчанию, ОДИН `AskUserQuestion` (1, 2, 3, 4 — рекомендация первой), гэпы честно; абзац «что наследует Recruitment».
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Переносить классический движок (`Turmoil`, `SelectDelegate`, `partyLeader`) в Redux-карту; второй экземпляр Парламента; auto-select цели; арифметика прогноза
  на клиенте; `onDelegatesDiscarded` от этой карты; снимать из кресла / лобби / с принятой резолюции; ореол/свечение на фигуре или плашке (инвариант 15);
  растворение вместо полёта; `title`; литерал кнопки; текст ниже пола TV; регистрация под классическим именем; свой арт/лор при работающем `reimplements`.
- Файлы соседа-b9 (`ConsoleActionComposer.vue`, `actionDescription.ts`, доки ONE FRAMEWORK) до его коммита; классическую `BannedDelegate.ts`; RU чужих
  ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
