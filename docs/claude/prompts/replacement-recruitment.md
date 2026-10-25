# Промт исполнителю · Recruitment:redux («Вербовка») — шестая карта-замена набора Redux (**TR74** по реестру): событие, 2, без меток; **«обменяйте одного НЕЙТРАЛЬНОГО делегата на резолюции на одного своего из резерва»** — без оговорки NON-LEADER, только резолюции (не области народной поддержки) · ВСЯ ИНФРАСТРУКТУРА — ЗАДЕЛ TR72 (`docs/TURMOIL_REDUX_BANNED_DELEGATE.md` §6; `TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 п.7): тот же выбор ФИГУРЫ (`RemoveDelegate` + `SelectPartyDelegate` + маркер `delegatePrompt` + режим Парламента `delegate` + полёт `delegateRemovalScene`) с `source: 'exchange'` — цели только нейтральные на резолюциях, после ухода нейтрального — ВТОРОЙ полёт: свой делегат из резерва на освобождённое место (обратный полёт TR03) — «ни второго режима, ни второго ввода» · ⚠ ПАРАЛЛЕЛЬНАЯ РАБОТА: Political Alliance (TR73) делается другим агентом ОДНОВРЕМЕННО — §0 делит файлы

> **Статус: ВЫДАН 2026-10-25.** HEAD `44a18e0ef6`. **СОСЕД `terraforming-mars-15` (busy) делает TR73 Political Alliance** — в дереве его незакоммиченное:
> `CardName.ts`, `turmoilReduxAdaptation.ts`, `turmoilReduxReplacements.ts`, `TurmoilReduxCardManifest.ts`, `UnplayableReason.ts`, `unplayableReasons.ts`,
> `Parliament.ts`, `PoliticalOps.ts`, `buildCardInformation.ts`, `requirementProse.spec.ts`, `unplayableReasons.spec.ts`, `package*.json`, новые
> `PoliticalAllianceRedux.ts`, `X09.webp`. **ЭТИ ФАЙЛЫ — ЕГО, пока он не закоммитит** (§0 — порядок без столкновений). `ListAgents` + `SendMessage` ему ПЕРВЫМ
> ДЕЛОМ (кто какие файлы держит, когда он коммитит регистрацию). **Лор** — `assets/text/lore_texts.json:588` ключ `T11` («Join us, and your voice will be heard» —
> БЕЗ точки на конце: проверить `git log -1 -- assets/text/lore_texts.json` / `git diff` — закоммичена ли; гард лора может требовать точку — поставить (цитата
> владельца не меняется)); RU в `src/locales/ru/lore_texts.json` НЕТ → «Присоединяйтесь — и ваш голос будет услышан.» **Арт** — `C:\Users\zelin\Downloads\Mars
> Arts\T11.png` → импортировать как **T11** (`node scripts/import-card-art.mjs "<путь>/T11.png" T11` → `make:cards`); замена берёт арт/лор через `reimplements:
> CardName.RECRUITMENT`. Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Replacement - Recruitment.png` («TR00» — заглушка;
> `replacementCardNumber(RECRUITMENT)` = **TR74**). Реестр: footer — прочитать; **без своего раздела**; дефекты общего слоя — строками в раздел текущего footer.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- recruit …`; сцена двух полётов — TIMING: `--exclusive --workers=1`; бокс делить с соседом — окно согласовать).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 (`:170–200`; **`:203–207` п.7 «Задел для Recruitment (TR74), найденный на TR72»**; `:229` строка),
**`docs/TURMOIL_REDUX_BANNED_DELEGATE.md`** (§2 сервер — `RemoveDelegate` (`targetsOf`, `project` на `withoutDelegate`, `offer`, `prompt`, `previewSelectParty`,
`execute`, `remove`, `writeRecord`), **§3 клиент — режим `delegate`** («ИЗГНАНИЕ»: дверь `mode:'delegate'`, мост `delegatePick`, кольцо `delegatePickModel`, фигура
«уходит» формой, панель `ConsoleParliamentDelegateMode.vue`, лента `BandDelegate`, полоса), §4 полёт после одного A, **§6 задел для Recruitment**), шаблоны замен
`7d284dc2df` (TR71), **`7e38fd1c2a` (TR72 — 39 файлов: `SelectPartyDelegate.ts`, `RemoveDelegate.ts`, маркер, события `delegate-removed`, запись `ParliamentRemovalRecord`,
`crossPlayerDeliveryAudit` семья)**, `ea39e1e81d` (TR75), чеклист `turmoil-redux-card-checklist.md` (§0, §4, **§5 — своя механика (второй полёт, фильтр,
`exchange`) → один e2e**), `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (TR03 — грант: куб из РЕЗЕРВА на резолюцию даром, лобби не тратится; полёт с резерва на
ленту — `flyDelegate`), память `parliament-delegate-figure` («взял → понёс → поставил»), `visual-restraint-no-glow`, `composer-preselect-direction`
(единственная цель — посеяна и помечена), `concurrent-session-edits-same-files` / `git-commit-explicit-paths-shared-index` / `split-commits-by-hunk-temp-index`
(⚠ параллельная работа), инварианты 1–4, 8, 9, 13, 15.

**Образцы — по частям:** **классика** — `turmoil/Recruitment.ts` (`EVENT`, 2, `cardNumber 'T11'`, `b.minus().delegates(1, {all}).asterix().nbsp.plus().delegates(1)`;
`bespokeCanPlay` — резерв + нейтральный не-лидер в партии; `bespokePlay` → `SendDelegateToArea {replace: 'NEUTRAL'}` — классический движок, в Redux не
переносится); **реестр** — `common/cards/turmoilReduxReplacements.ts:65–67` («still cost 2, event; «exchange one NEUTRAL delegate on a resolution with one of your
own from the reserve» — no NON-LEADER clause, resolutions only (never a Popular Support area)»); **шаг TR72** — `parliament/RemoveDelegate.ts:1–60` (заголовок:
«the shared step any card that takes ONE cube off the table inherits (TR74 Recruitment's «a neutral delegate on a resolution» is the same pick with a narrower
set)»), `:66–69` (конструктор, `cause`), `:79` (`targetsOf` — все фигуры: по резолюциям по владельцам, затем области), `:104–120` (`project` на
`parliament.withoutDelegate(party, place, owner)` — прогноз: «3 → 2», лидер, победитель, потерянный эффект), `:151` (`offer`), `:161–162` (`prompt` →
`SelectPartyDelegate(REMOVE_DELEGATE_TITLE, 'Remove delegate', {source: 'remove', targets})`), `:173` (`previewSelectParty`), **`:184–258` (`execute` — бот: первая фигура;
`remove` — `removePopularSupport` / `removeVote(slot, delegate)`, лог, `events.recordDelegateRemoved`, `writeRecord` — запись презентации с `seq`)**;
`inputs/SelectPartyDelegate.ts` (`DelegateTarget = DelegateAddress & {party}`; ответ `{type:'party', partyName, delegate: {place, owner}}`; кандидаты —
`meta.targets`), `common/models/PlayerInputModel.ts:560–580` (**`DelegatePromptMeta {source: 'remove', targets}`** → расширить `'remove' | 'exchange'`;
`DelegateTargetProjection`), `Parliament.ts:975–990` (`placeVote(player, slot, 'reserve')` — из резерва, `seq` новый; бросает при пустом резерве), `:1012`
(`removeVote(slot, owner)` — ПОСЛЕДНИЙ куб владельца), `:503` (`withoutDelegate`), `parliament/PlaceDelegatesOnResolution.ts:34–36, :61, :85, :123–130` (грант:
из резерва даром; «paid and placed nothing» невозможно; резерв перечитывается перед посадкой); **клиент TR72** — `console/parliament/delegatePickModel.ts`
(кольцо по фигурам — ЧИСТОЕ; фильтр целей = строки `meta.targets`), `delegateRemoval.ts` + `delegateRemovalScene.ts` («взял → понёс → поставил» с ленты в резерв /
запас; счёт места тикает на отрыве, адресата — на касании; промах — признан), `delegateFlightPose.ts`, `parliament/ConsoleParliamentDelegateMode.vue` (панель:
фигура владельца, «С резолюции «R»», «→ В общий запас», факты, квитанция, CTA), `consoleParliamentFlow.ts:180, :432–465, :531–584` (`ParliamentStage 'delegate'`,
`delegateStage/Cursor/Committed/Live/Beat/Snapshot/Meta`), `consoleTaskRouter.ts` (`DELEGATE_STEP_STAGES` — слово стадии по `source`), `consolePlayCardComposer.ts`
(`playDoorOf` → `{kind:'parliament', mode:'delegate'}`), e2e `console-banned-delegate.spec.ts:1–30` (сцены а–ж), фикстура `banned-delegate`
(`generate.ts` — грепнуть `parliamentFixture('banned-delegate'`), юниты `tests/parliament/RemoveDelegate.spec.ts:74–200` (операции · фигуры и прогноз · промпт ·
превью = исполнение); **TR03 обратный полёт** — `console-political-donation` (куб из стопки резерва на ленту резолюции); **RU** — `turmoil_cards.json:35»
«Вербовка» (fallback по срезанному имени); **гарды** — `TurmoilReduxCardManifest.spec` (TR74 = своя строка), `TurmoilCardsUnderRedux.spec` (`replaced`; после
Recruitment и TR73 соседа в списке останется только VoNC), `premiumScope`, `devGuaranteedCards`, `cardInformation`, `cardLore` (T11 через `reimplements`),
`CardMetadata`, `crossPlayerCoverageGuard` («none»: нейтральный куб — ничей; свой — свой), `parliamentGlossary.spec` (слово стадии), `glowRestraintGuard`
(Парламент = 0), `i18n.spec`, `deckComposition.spec`.

---

## Диагноз (подтверждён файл:строка на `44a18e0ef6`; перепроверить на своём HEAD)
1. **Механика = TR72 с фильтром и вторым ходом.** Выбор фигуры, прогноз, маркер, режим Парламента, полёт — всё сдано TR72 и спроектировано как ОБЩЕЕ
   («наследует TR74»). Recruitment: (а) цели — ТОЛЬКО нейтральные кубы на резолюциях области голосования (`targetsOf` с фильтром `owner === 'neutral' && place ===
   'resolution'`; области поддержки — нет, своих/чужих — нет); (б) доступность — ≥1 такая цель ∧ резерв ≥ 1 (иначе карта не играется: именованные причины
   «нет нейтрального делегата на резолюциях» / «нет делегата в резерве» — ключ TR03 `POLITICAL_DONATION_NO_DELEGATE_REASON` переиспользовать; порядок —
   решение 2); (в) исполнение — ОДНА операция «обмен»: `removeVote(slot, 'NEUTRAL')` (нейтральный → общий запас) + `placeVote(player, slot, 'reserve')` (свой из
   резерва, новый `seq` — он ПОСЛЕДНИЙ на резолюции: лидерство по ничьей — честно по правилам, пин) — внутри одного события; прогноз —
   `withoutDelegate` + «с моим кубом» (проекция ПОСЛЕ обоих ходов: голоса те же, нейтральных −1, моих +1, лидер/победитель/эффект партии «2 делегата» —
   ДОСТИГАЕТСЯ? (если моих стало 2 → `announceAccessChanges` расскажет «gains … 2 delegates»); (г) запись презентации — ДВА движения: уход нейтрального
   (`ParliamentRemovalRecord`) + приход своего (TR03-класс запись гранта / своё поле `exchange`); клиент играет их ПОДРЯД: фигура нейтрального уходит в запас,
   затем своя фигура со стопки резерва садится на ТО ЖЕ место (след нейтрального — след своего: «вербовка» буквально).
2. **Маркер.** `DelegatePromptMeta.source: 'remove' | 'exchange'`; `DELEGATE_STEP_STAGES['exchange']` — слово стадии («ВЕРБОВКА» — по имени карты, по глоссарию «по
   тому, что делает выбор»); CTA «Выбрать делегата» (то же), полоса живая — «Завербовать делегата»; панель — «Нейтральный делегат с резолюции «R» → в общий
   запас · Ваш делегат из резерва → на «R»» + факты (голоса/лидер/победитель/эффект); лента — кикер «ВЕРБОВКА».
3. **Превью = исполнение** — `previewSelectParty()` с фильтром; `previewSkip` (нет целей / нет резерва) → карта недоступна (событие за 2 без эффекта — футильно);
   staged-дверь розыгрыша (`playDoorOf` → `mode:'delegate'`) — из коробки.
4. **Остальное — шаблон замены:** `CardName.RECRUITMENT_REDUX = 'Recruitment:redux'`, класс (`reimplements: RECRUITMENT`, TR74, `bespokePlay` → `RemoveDelegate`
   с `{source:'exchange'}` — или подкласс/опция шага, одно решение), манифест + `cardsToRemove`, строка долой, реестр AUTHORED, пин `replaced`, RU описания
   (новый ключ — текст скана; «NEUTRAL» капсом — как на скане? голос набора — обычный регистр с выделением смыслом: «Обменяйте одного нейтрального делегата
   на резолюции на одного своего из резерва.»), `card_info`, лор T11 (+ точка, RU), арт T11.
5. **MarsBot.** Кубы бота — не нейтральные: не цели; бот карту не играет; нейтральные на резолюции могут быть от бота? (нейтральные — общий запас,
   `addNeutralVote`) — цель как любой нейтральный.

## Правила карты (спек `tests/cards/turmoilRedux/RecruitmentRedux.spec.ts` пинит каждое — структура TR72)
1. Печатная: событие, 2, без меток, без ПО, `TR74`, `reimplements: RECRUITMENT`, имя `'Recruitment:redux'`; лицо — «− [тёмная фигура]* + [белая фигура]» (печатные
   силуэты: нейтральный / свой — `delegates`/`neutral-delegate` значки набора TR03); арт/лор — T11.
2. Играется ⇔ (есть нейтральный куб хотя бы на одной резолюции области голосования) ∧ (резерв ≥ 1); иначе — именованная причина (порядок: решение 2);
   принятая резолюция, лобби, кресло, области поддержки — не цели; чужие/свои кубы — не цели; лидерство нейтрального не мешает (нет NON-LEADER).
3. Исполнение: нейтральный уходит в общий запас (+1), свой из резерва (−1) встаёт на ту же резолюцию последним (`seq`); голоса резолюции не меняются
   числом; лидер/победитель/эффект партии — живьём (мой второй куб → эффект партии «2 делегата» — анонс); журнал «${0} обменял нейтрального делегата на
   ${1} на своего» + событие (жертвы нет); `onDelegatesDiscarded` — не зовётся; куб «ушёл» между превью и ответом → именованный пропуск (как TR72).
4. Превью = исполнение; staged-дверь; save / load — записи презентации с `seq`; классический стол — классика байт-в-байт.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **Номер TR74** — по реестру (сосед сдаёт TR73 параллельно — порядок сдачи ≠ порядок номеров, норма).
2. **Порядок причин** — «нет нейтрального делегата на резолюциях» → «нет делегата в резерве» (сначала то, что на столе; резерв — своё); ключи: новый для
   первого, TR03 для второго.
3. **Слово стадии** — «ВЕРБОВКА» (крошка `… › ВЕРБОВКА`, кикер ленты); (б) «ОБМЕН».
4. **Полёт** — (а, рекомендовано) ДВА хода одной фразой: нейтральная фигура «взял → понёс → поставил» с ленты в общий запас (счёт запаса тикает на касании),
   СРАЗУ за ней своя фигура со стопки резерва (`[data-parl-seat-reserve]`) на освободившийся след той же ленты (резерв тикает на отрыве); между ними —
   без паузы, одна фраза ≈ 1,2 с; место не пустует «моргая» — след остаётся пунктирным до посадки своей; (б) одновременный «перекрёстный» полёт — нет
   (две фигуры в воздухе читаются шумом).
5. **Панель** — (а, рекомендовано) две строки «уходит / приходит» + факты «мои на «R»: 1 → 2 · эффект партии X: получите» (из серверного прогноза после ОБОИХ
   ходов); (б) только «уходит» + факты.
6. **e2e** — `tests/e2e/console-recruitment.spec.ts` (своя механика — обязателен; tv4k + fhd; TIMING): (а) композер — дверь «Выбрать делегата», ряд «Делегат —
   выбор в Парламенте», дверь шлёт НИЧЕГО; (б) один поток: крошка `КАРТЫ В РУКЕ › ВЕРБОВКА › ВЕРБОВКА`? — ⚠ имя карты и стадия совпадают: стадия — по глоссарию
   «по тому, что делает выбор» — проверить, как TR72 решил совпадение «Изгнание делегата › ИЗГНАНИЕ» (допустимо; иначе — решение 3б); (в) курсор ходит ТОЛЬКО по
   нейтральным фигурам резолюций (свои/чужие/области — не остановки; единственная цель — посеяна и помечена), плашки/резолюции не двигаются; панель — две
   строки + факты; B — назад; (г) A — один POST, хвост адресован `{party, delegate: {resolution, neutral}, stagedFor}`; (д) полёт: нейтральная фигура с ленты в
   запас (запас тикает на касании) → своя со стопки резерва на тот же след (резерв тикает на отрыве, лента — на касании); (е) сервер: нейтральных −1, моих +1 на
   той резолюции, резерв −1, запас +1; лидер — по правилам; (ж) конец на поле; (з) `-locked`: нет нейтральных на резолюциях → чип руки с причиной; резерв 0 →
   вторая причина; (и) reduced motion. Фикстуры: `recruitment` (`parliamentFixture`: три резолюции, нейтральные кубы на двух (одна — только нейтральные,
   другая — нейтральный + мой: мой второй куб даст эффект партии), резерв ≥ 1, карта в руке), `recruitment-locked` (два варианта).
7. **Объём** — сервер (опция шага `exchange`, фильтр, прогноз после двух ходов, запись) ≈ 35 %, карта + лицо + RU ≈ 15 %, клиент (слово стадии, панель, второй полёт)
   ≈ 35 %, стенд/доки ≈ 15 %; без полировки.

## 0. Рабочее дерево — ⚠ ПАРАЛЛЕЛЬНО С TR73 (сосед `terraforming-mars-15`)
1. `git log --oneline -1` → `44a18e0ef6` на выдаче. **ПЕРВЫМ ДЕЛОМ** `ListAgents` + `SendMessage` соседу-15: «делаю TR74 Recruitment; мои файлы — <список ниже>; ОБЩИЕ
   регистрационные файлы (`CardName.ts`, `turmoilReduxAdaptation.ts`, `turmoilReduxReplacements.ts`, `TurmoilReduxCardManifest.ts`, `TurmoilCardsUnderRedux.spec.ts`,
   `cardLore.spec.ts`, `devGuaranteedCards.spec.ts`, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`, журнал, чеклист) правлю ПОСЛЕ твоего коммита регистрации — сообщи хэш».
   **Твои файлы (никто другой их не держит):** `turmoilRedux/RecruitmentRedux.ts` + спек, `parliament/RemoveDelegate.ts` (опция `exchange` — TR72 сдан, файл свободен),
   `inputs/SelectPartyDelegate.ts`, `common/models/PlayerInputModel.ts` (маркер — ⚠ проверить, что сосед его не держит: в его диффе нет), `common/events/
   GameEvent.ts` / `EventImpact.ts` (если новое событие — ⚠ сосед не держит), клиент режима `delegate` (`delegatePickModel.ts`, `delegateRemoval.ts`,
   `delegateRemovalScene.ts`, `ConsoleParliamentDelegateMode.vue`, `consoleParliamentFlow.ts`, `consoleTaskRouter.ts` — слово стадии), `parliament/*.less` (если нужно),
   `ru/{lore_texts,turmoil_redux_cards,card_info,parliament,console}.json` (⚠ локали — общие файлы: править ТОЛЬКО своими ключами, коммитить явными путями
   ханком — сосед тоже добавляет ключи; дубль ключа роняет `make:json` — грепнуть ДО), e2e + фикстура, `assets/card-images/T11.webp`, новый док.
   **НЕ ТРОГАТЬ до его коммита:** всё из его диффа (список в статусе) + `Parliament.ts` / `PoliticalOps.ts` / `unplayableReasons.ts` (Recruitment им не нужен:
   операции `removeVote` / `placeVote` есть; причина карты — в самой карте / шаге, не в общем `unplayableReasons`).
2. Коммиты — ТОЛЬКО явными путями (`git commit -- <paths>`), никогда `git add -A`, никогда `git stash`; `package*.json` — не твои (сосед держит `MM`): после
   коммита `git reset -q -- package.json package-lock.json` НЕ делать, если сосед их стейджил — просто не включать в свои коммиты. Порядок: (1) лор T11 (своя
   строка, если не закоммичена) → (2) свои новые файлы + шаг + маркер + клиент + спеки (всё, что компилируется без регистрации карты — класс карты
   коммитится, но в манифест пока не входит) → (3) ждать коммит соседа (`git log`, `SendMessage`) → (4) регистрация: `CardName`, манифест, реестр, строка долой, пины,
   доки — одним коммитом по ханкам → (5) e2e. Не пушить.
3. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot recruit` → `npm run e2e:remote -- recruit <spec> --exclusive --workers=1`; бокс — делить с
   соседом (`SendMessage` перед прогоном); exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер (≈ 35 % + 15 %)
`RemoveDelegate` — опция `{source: 'exchange'}`: фильтр целей, прогноз после двух ходов (`withoutDelegate` → `+ placeVote` на копии — или новый `withExchange`),
промпт с `source:'exchange'` (`EXCHANGE_DELEGATE_TITLE`, «Recruit delegate»), исполнение (две операции в одном событии; лог; `recordDelegateRemoved` + запись
прихода — своё событие `delegate-exchanged` или пара записей; `writeRecord` ×2 с `seq`), `previewSkip` с двумя причинами. Карта `RecruitmentRedux.ts` (заголовок
SCAN READING / RULE READINGS; `bespokeCanPlay` по `previewSkip`; `bespokePlay` → `defer(new RemoveDelegate(player, cause, {source:'exchange'}))`; `cardPlayPreview`
с дверью `delegateGrantStep`-класса для `delegate` — как у TR72); спек карты (правила 1–4) + `RemoveDelegate.spec` § exchange (фильтр, резерв, две операции,
`seq`, прогноз, пропуск «ушёл»).

## 2. Клиент (≈ 35 %)
`DELEGATE_STEP_STAGES.exchange`; кольцо — строки `meta.targets` (фильтр серверный — клиент ничего не отбирает); панель — две строки + факты (решение 5); лента
— кикер; полоса — глагол; полёт — `delegateRemovalScene` + второй ход (своя фигура со стопки резерва на след — обратный полёт TR03, тот же примитив
`flyDelegate`), под одним холдом; «Единственная цель» — посев (CC). Спеки: `delegatePickModel.spec` § exchange, `delegateRemoval.spec` (два хода), `parliamentBand.spec`
(кикер), `parliamentGlossary.spec` (слово), `consoleTaskRouter.spec` (стадия).

## 3. Стенд и регрессия (≈ 15 %)
Стенд решения 6; регрессия: `console-banned-delegate` (режим не сломан), `console-political-donation` (обратный полёт), `console-parliament-stability`,
`console-parliament-vote-*`, `console-septem-tribus`, `tv-profile-screens`; `npm run e2e:affected`; хуки — тем же диффом.

## 4. Визуальная приёмка (**TV первым**; fhd)
`screenshots/recruit/`: лицо (арт T11, две фигуры); композер с дверью; режим: курсор на нейтральной фигуре, панель «уходит / приходит»; полёт: нейтральная в
запас → своя на тот же след; Парламент после. С дивана: «я вижу, кого вербую и что получу — и фигура сменилась на месте, а не телепортировалась?»

## 5. Доки и реестр
1. Реестра своего нет; строки — в раздел текущего footer.
2. Доки (после коммита соседа — те же файлы): `TURMOIL_REDUX_BANNED_DELEGATE.md` §6 → «СДЕЛАНО: TR74 — `source:'exchange'`, второй полёт» (+ §2/§3 строки),
   `TURMOIL_REDUX_CLASSIC_CARDS.md` §4.1 — Recruitment «СДАНА» (замены 6 из 7 вместе с TR73 соседа — согласовать нумерацию «N из 7» в одном коммите, не двух),
   `parliament-glossary.md` — стадия «ВЕРБОВКА»; чеклист §4 — строка «обмен делегата»; запись в журнале.

## 6. Режим работы
1. `SendMessage` соседу → лор/арт → шаг (сервер + спеки) → карта (без регистрации) → клиент → ЖДАТЬ коммит соседа → регистрация + доки → стенд →
   регрессия → раскадровки. Коммит по ханкам, явными путями.
2. Отчёт: первой строкой — лицо с артом; затем кадры режима и полёта, гарды, решения 1–7 с тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (4 с кадрами,
   3, 5 — рекомендация первой), гэпы честно; строка «как разошлись с TR73» (какие файлы ждал, хэш).
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Второй режим / второй ввод (только `exchange` на TR72); цели вне нейтральных на резолюциях; классический `SendDelegateToArea`; свой куб с лобби (только резерв);
  платить за куб (грант даром); телепорт фигуры (два полёта); ореол (инвариант 15); auto-select; `title`; литерал кнопки; текст ниже пола TV.
- Файлы соседа-15 до его коммита (список в статусе + `Parliament.ts` / `PoliticalOps.ts` / `unplayableReasons.ts`); `package*.json`; `git add -A`; `git stash`; bare
  `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
