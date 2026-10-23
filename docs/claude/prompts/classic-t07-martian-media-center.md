# Промт исполнителю · T07 Martian Media Center («Медиа-центр на Марсе») — одиннадцатая классическая карта Turmoil под Redux, «на месте» (§3.1): синяя, 7, Здание; требует «Марс прежде всего» у власти или 2 ваших делегата на его резолюции; +2 пр. M€; ДЕЙСТВИЕ «заплатите 3 M€ → добавьте делегата» — под Redux это ГОЛОС ИЗ РЕЗЕРВА ЗА 3 M€ ВМЕСТО 5 (`PARLIAMENT_VOTE_COST`), ДЕЙСТВИЕМ синей карты (владелец): нужен БЕСШОВНЫЙ EMBEDDED-ВХОД в режим голосования из «Действий карт» с ВОЗВРАТОМ НАЗАД до финального подтверждения — ЧЕТВЁРТАЯ ДВЕРЬ голосования уже проложена TR15 Martian Census (staged action vote: `flow: 'action'` × `target: resolution`, хост `card-actions`, B возвращает ту же ветку, A в режиме — один POST); сегодня декларативное `action.turmoil.sendDelegates` получает от сервера не ДВЕРЬ, а ЖИВОЙ follow-up (`delegateGrantFollowUp`, `actionPreview.ts:1035–1048`) — для действия это и есть разрыв · ПОЛИРОВКА (≈ 55 %) «ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ»: боковая панель журнала на 4K (`08-journal.png`) — стена цветных чипов со стрелками, миниатюры арта ≈ 70 px, таймстемпы «15:24» у каждой строки, добор карт — простыня имён; последний визуальный проход — 2026-08-06, e2e у журнала НЕТ

> **Статус: ВЫДАН 2026-10-23.** HEAD `1c260ed8bc`. **T05 Event Analysts — В РАБОТЕ у соседа terraforming-mars-82 (busy)**: карта сдана кодом (`49db3b4d37`,
> 10 из 22), «итог влияния везде» + полоса (раздел **CG**) — незакоммичены (`influenceReading.ts`, `ConsoleInfluenceMod.vue`, `consoleParliamentModel.ts`,
> `seatParliamentReading.ts`, `ConsoleParliamentAgenda.vue` — ЕГО файлы, не трогать). Реестр: footer «PL-939» (CF записан), раздела CG ещё нет —
> **эта задача берёт CH**; номера — по footer В МОМЕНТ записи. **Лор:** строка `T07` («Control the media and you will control public opinion.») лежит
> НЕЗАКОММИЧЕННОЙ последней в `assets/text/lore_texts.json` (сосед откатил её из своего коммита — `1c260ed8bc`): коммитить ПЕРВЫМ ханком, только её.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\T07.png`. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T07 - Martian Media Center.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t07 …`; exit 2/3/4 → спросить); `SendMessage` соседу-82 до первого прогона и до первого коммита.

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:112`, `:121` — «`delegateReserveReason` — общий слой для игры и действия, покрывает и Martian Media
Center; превью — фишка резерва», `:202`, `:213`), `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T03 / T05 / T15 (образец §-блоков).
**Контракты карты:** **`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` §5 «STAGED ACTION VOTE — четвёртая дверь»** (`:114–154` — таблица «что обобщено»: `stagedStepHost`,
`commitStagedTail` ветка `action`, `endStagedVote → endCardActionsWithHostedStep`, отмена, квитанция `StagedReceipt {amount, icon}`, глагол A «Подтвердить»,
крошка `ДЕЙСТВИЯ КАРТ › <карта> › ГОЛОСОВАНИЕ`, циан → янтарь), §6 «Движение» (PL-100 / PL-103: цена уходит ПЕРВОЙ, куб — после; жетон рождается после
импульса ACTION COMMIT), §7 «Ловушки», `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (закон гранта: из РЕЗЕРВА, лобби не тратится), `docs/CONSOLE_BLUE_ACTION_PARITY.md`,
`docs/claude/console/unavailability-reasons.md`, память `futile-actions-iteration` (действие без результата — ВЫКЛЮЧЕНО с причиной, не «сработало впустую»),
`alternate-play-route-keeps-reversible-doors`, `composer-preselect-direction`, CLAUDE.md § «Every card action has ONE universal ACTION COMMIT» (PL-099 / PL-104
— цена с рельса уходит ПЕРВОЙ, вбок, в печатную иконку цены), законы workspace 1–4, инварианты 1–4, 9. **Контракты полировки:** `docs/claude/journal.md`
(фреймворк компонентов журнала; «премиум-боковая панель» образца 2026-08), память `journal-resource-icon-tokens` (чипы ресурсов — ОБЩИЕ токены журнала и
уведомлений: грамматика чипа меняется в одном месте или не меняется), `journal-gain-via-stock-add`, `notification-source-and-glance-rule` (источник = то, что видно
с дивана), `info-polish-restrained` («сдержанно и дорого»), `console-reading-typography` / `length-tier-ladder-calibration`, `polish-priority-tv4k-no-deck-only`,
`polish-area-premium-visual-first`, `rail-material-glass-plate` (CF — материал планшета: одна стеклянная плита; журнал — та же грамматика стекла, не третья),
`fixed-layer-is-a-stacking-context`, `batch-decisions`, `concurrent-session-edits-same-files`, `e2e-only-on-steam-machine`, `e2e-spec-rot-contract`,
`shell-template-escapes`; CLAUDE.md «Project goals» 1 (без скролла там, где можно — журнал СКРОЛЛИТСЯ по праву: это лента), 3, 4. Журнал — `docs/claude/
turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **TR15 Martian Census** (`turmoilRedux/censusAction.ts:1–60` — грамматика действия с голосом; `:228–258` `censusActionPreview` — ветка B:
`cardCost` + `delegateFromReserve(1)` + **`actionPreviews.delegateGrantStep(card, grant)`** — ДВЕРЬ; e2e `console-martian-census.spec.ts:1–45` — семь сцен
staged action vote, фикстура `martian-census` `generate.ts:3552–3570`) — ТОТ ЖЕ вход, та же крошка, тот же один POST, только цена — M€ с рельса, не данные
с карты; `cards/actionPreviews.ts:598–616` (`delegateGrantStep`); `models/actionPreview.ts:309–310` (`declaredActionSteps` → общий `stepsForBehavior`),
`:824` (`stepsForBehavior` — общий для игры и действия), `:1032–1048` (`sendDelegates` → **`delegateGrantFollowUp`** — живой шаг после коммита; верно для
РОЗЫГРЫША T03, неверно для ДЕЙСТВИЯ), `:107–125` (`spend.megacredits` — плоская цена), `:676–686` (`delegateFromReserve` — фишка «резерв N → N−1»);
`models/actionUnavailableReasons.ts:170–195` (`delegateReserveReason`, общий слой T03); `politics/PoliticalOps.ts:114–122`, `:206–215` (`placeDelegates` → Redux
`PlaceDelegatesOnResolution(1, {kind:'card'})`), `parliament/PlaceDelegatesOnResolution.ts` (`previewSkip` — «нет резолюции на голосовании» / «нет делегата в
резерве» — именованные); **клиент двери** — `console/consolePlayCardComposer.ts:286–301` (`playDoorOf` — один читатель дверей, и для действий),
`ConsoleActionComposer.vue:2626–2632` (`voteEntryDoor`), `:2728–2760` (`parliamentStepOn` — зона `[data-embed-slot="action-parliament"]`; `stagedVoteCommitMine`;
`stagedVoteCubeGone`; `stagedVotePriceGone` — «a play's M€ door … the cube's lift-off»: для M€-цены действия отрыв цены с РЕЛЬСА пока не описан),
`console/stagedPlay.ts:216` (`stagedStepHost`), `console/consoleActionComposer.ts:440–451` (`RUNTIME_NAVIGATION_STEP_KINDS` ∋ `delegateGrant` — строка «ДАЛЕЕ:
Резолюция — выбор в Парламенте», CTA «Выбрать резолюцию»), `parliament/ConsoleParliamentVoteMode.vue:242–290` (источник «из резерва · по карте», КВИТАНЦИЯ
`Карта · N [иконка]` — заперта, B возвращает в композер), `:386–387`, `:425–433` (`stagedFlow: 'action'` — A «Подтвердить»), `:505–508`; `common/parliament/
ParliamentTypes.ts:47` (`PARLIAMENT_VOTE_COST = 5` — обычная цена голоса из резерва; `Parliament.ts:873–878`); **журнал** — `components/console/ConsoleJournalPanel.vue`
(794 строки: `__title / __filter / __controls / __mode (ПОДРОБНО · СВОДКА) / __gen / __live-slot / __scroll / __list / __node / __inspect*`), `components/console/
consoleJournalModel.ts`, общая семья `components/journal/` (`JournalGroup.vue:10–16` — арт события `journal-group__art` = `cardArtUrlAtTier(url, 'thumb')`,
`JournalChildRow.vue` — `__lead / __src / __arrow / __impacts / __chip / __tile / __skipped-badge / __discount-badge`, `JournalEntry.vue`, чипы / попаверы),
стили `console.less:16252–16700` (`.con-journal` — ширина `min(28rem + pad, 48%)`, типографика `.65–.75rem` базы), TV `console_tv.less:429`, `:1088–1110`
(«JOURNAL (line length capped — never full-4K rows)»: `width: min(44rem, 40vw)`, body 1.05rem); юниты `tests/client/components/journal/*`; e2e — НЕТ;
кадр «сегодня» 4K — `screenshots/tv-profile/tv-4k/08-journal.png`.

---

## Диагноз (подтверждён файл:строка и кадром на `1c260ed8bc`; перепроверить на своём HEAD)

### Карта — дверь есть, сервер в неё не ведёт
1. **Декларативна, движок готов.** `MartianMediaCenter.ts`: `ActionCard`, `behavior.production.megacredits: 2`, `action: {spend: {megacredits: 3}, turmoil:
   {sendDelegates: {count: 1}}}`, требование `party: MARS`, `cardNumber: 'T07'`. Executor идёт через фасад (T04); доступность — 3 M€ (`spend`) + резерв ≥ 1
   (`delegateReserveReason`, T03); под Redux действие деферит `PlaceDelegatesOnResolution(1, {kind:'card', card})` — куб из РЕЗЕРВА на резолюцию области голосования,
   лобби не тратится, 3 M€ — цена действия (обычный голос из резерва стоит 5: `PARLIAMENT_VOTE_COST`). Классика — `SendDelegateToArea` байт-в-байт.
2. **Сервер отдаёт follow-up, а не дверь.** `stepsForBehavior` (`actionPreview.ts:1032–1048`) для ЛЮБОГО `sendDelegates` кладёт `delegateGrantFollowUp` — живой
   шаг после коммита (решение T03 2а — верно для розыгрыша: клетка города — единственная обратимая дверь). Для ДЕЙСТВИЯ это разрыв: композер отправит
   действие, 3 M€ уйдут, и только потом Парламент спросит резолюцию — отказаться уже нельзя. TR15 строит свою дверь bespoke (`censusActionPreview:247`); для
   декларативного действия дверь надо выдать в `declaredActionSteps` (`:309`), а не в общем `stepsForBehavior`: ДЕЙСТВИЕ с `sendDelegates` (count 1, не
   `manyParties`) → `delegateGrantStep(card, grant)`; `previewSkip` → именованное предупреждение И недоступность (диагноз 3).
3. **Действие впустую не выключено.** `Executor.canExecute` для `sendDelegates` проверяет только резерв; область голосования пуста → действие «доступно», 3 M€
   списаны, шаг именованно пропущен — ПЛАТНОЕ ДЕЙСТВИЕ БЕЗ РЕЗУЛЬТАТА (`futile-actions-iteration`: выключено с причиной). TR15 судит в порядке «цена → нет
   резолюции → нет делегата» (`censusVoteReason`). Для декларативного действия — тот же порядок в общем слое (`actionUnavailableReasons` + `canExecute` через
   `previewSkip` шага), причины — ключи TR03 (`POLITICAL_DONATION_NO_RESOLUTION_REASON`, `…NO_DELEGATE_REASON`) или `delegateReserveReason`.
4. **Цена с рельса на staged-двери.** `stagedVotePriceGone` (`ConsoleActionComposer.vue:2750–2758`) знает цену-ресурс карты (TR15: жетон данных с капсулы героя
   в стопку резерва, PL-100) и отрыв куба; цена в M€ ДЕЙСТВИЯ — это ACTION COMMIT с рельса (PL-104: жетон с цифр строки M€ ВБОК в печатную иконку цены, строка
   тикает на отлёте, результат рождается после) — играется композером под шагом (`playCommitBeat(branch)`), и только ЗАТЕМ куб покидает резерв на ленту
   резолюции. Режим голосования печатает источник «из резерва · по карте» и квитанцию «Карта · 3 M€» (`voteInfo.vote.receipt {3, 'megacredits'}`) —
   НИГДЕ не «5 M€»; строка CTA с ценой резерва (`ctaCost`) при `door === 'card'` молчит.
5. **Остальное стандартно:** требование партии — T04 (дороги, `partyOffVote`, FAQ p.19, TR70); RU (`turmoil_cards.json:22–24` — «Требование: Марс вперед в
   правящий партии…», действие «в любую партию» — не голос набора), лор RU, арт, `card_info` (Redux-чтение: «добавьте делегата на резолюцию из резерва за 3 M€»),
   строка долой (`turmoilReduxAdaptation.ts:44` — ПОСЛЕДНЯЯ карта с политическим эффектом в списке «на месте»; остаются только корпорации), пин (11 из 22),
   лицо: действие `3 M€ → [делегат]` существующими значками, +2 пр. M€.

### Журнал — лог, а не хроника
6. **Стена чипов.** `08-journal.png` (4K): каждая запись — миниатюра арта ≈ 70 px · «15:24» · чип игрока · «сыграл» · чип карты; под ней строка-ребёнок
   «чип карты → [иконка] +N» и ещё, и ещё; добор «Космическое агентство» — восемь чипов имён в три строки. Все чипы одного веса и цвета-по-типу, стрелки
   `→` между ними; иерархии «событие › его последствия» нет; времени — у КАЖДОЙ строки; арт слишком мал, чтобы узнать карту; панель — плоское стекло без
   материала CF. С дивана это читается как консольный лог.
7. **Типографика базы — .65–.75rem, на TV — 1.05rem тела** (`console_tv.less:1093+`): пол TV выдержан, но ВСЁ одного размера — заголовок записи, последствия,
   время. Ширина панели `min(44rem, 40vw)` → ≈ 1500 px на 4K: длинные ряды чипов.
8. **Что НЕЛЬЗЯ трогать:** модель данных (`journalView`, `journalEventChild`, `logResourceToken` — чистые, общие с уведомлениями и фактами финала), токены
   чипов (`journal-resource-icon-tokens` — одна грамматика чипа на журнал И уведомления: менять краску чипа — ТОЛЬКО в общем месте и с проверкой уведомлений),
   попаверы карт / колоний / наград, подсветка клетки (`boardCellHighlight`), режимы ПОДРОБНО / СВОДКА и пейджер поколений, live-лента, скролл по праву.

## Правила карты (спек пинит каждое)
1. Синяя, 7, Здание; требование «Марс прежде всего» — дороги T04; розыгрыш → +2 пр. M€ (и только); MarsBot не играет.
2. Действие: доступно ⇔ ≥ 3 M€ ∧ резерв ≥ 1 ∧ резолюция на голосовании; причины в порядке «не хватает M€ → нет резолюции → нет делегата в резерве», ОДНА
   за раз, действие ПОКАЗАНО выключенным; выполнение: −3 M€, один `SelectParty` с `votePrompt {source:'grant', count: 1}` и `choiceContext.source` = карта →
   куб из РЕЗЕРВА на выбранную резолюцию, лобби не тронуто, действие использовано в поколении; обычная цена голоса (5) не участвует.
3. Превью действия: `megacredits −3` + `delegateFromReserve(1)` + ДВЕРЬ `delegateGrant` (staged); при пустой области — предупреждение И недоступность
   (правило 2), двери нет. Превью розыгрыша (T03-класс) не меняется.
4. Классический стол — апстрим байт-в-байт; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения T04 / T14 / T15 / T03 / T05 не переспрашивать)
1. **RU** — имя оставить («Медиа-центр на Марсе»); описание — «Требует, чтобы «Марс прежде всего» был у власти или у вас было 2 делегата на его резолюции.
   Увеличьте производство M€ на 2 шага.»; действие — голос набора (прецедент T04 / T03): «Действие: заплатите 3 M€, чтобы добавить делегата на резолюцию.»;
   лор RU — «Управляй медиа — и будешь управлять общественным мнением.»
2. **Дверь действия** (диагноз 2) — (а, рекомендовано) STAGED: композер «Действий карт» → CTA «Выбрать резолюцию» → режим голосования Парламента ВНУТРИ
   workspace (ОДИН экземпляр, зона `action-parliament`), крошка `ДЕЙСТВИЯ КАРТ › МЕДИА-ЦЕНТР НА МАРСЕ › ГОЛОСОВАНИЕ`, B — назад в композер с той же веткой
   (ничего не отправлено, M€ на месте), A — «Подтвердить» = ОДИН POST с адресованным хвостом; (б) живой follow-up после списания — нет (владелец: «с
   возможностью вернуться назад до финального подтверждения»).
3. **Цена на рельсе** (диагноз 4) — (а, рекомендовано) A в режиме → ACTION COMMIT карты (источник фиксируется, импульс в печатную `3 M€`), жетон «−3» с
   цифр строки M€ ВБОК в печатную иконку цены (PL-104), строка тикает 493 → 490 на отлёте, ЗАТЕМ куб из резерва на ленту резолюции (TR15 §6, порядок
   «цена → куб»); квитанция режима «Карта · 3 M€», источник «из резерва · по карте»; (б) только куб, цена тикает без жетона.
4. **Футильность** (диагноз 3) — общий слой: ДЕЙСТВИЕ, чей единственный эффект — грант без адресата, недоступно с причиной (`canExecute` через `previewSkip`);
   розыгрыш с другими эффектами (T03: город + производство) по-прежнему играется с именованным пропуском.
5. **Журнал — «ХРОНИКА»** (диагноз 6–7) — (а, рекомендовано) ЗАПИСЬ = карточка события: арт КРУПНЕЕ (tier выше `thumb`; на 4K ≥ 160 px, обрезка кадром в
   стекле CF), ЗАГОЛОВОК одной строкой «[место] сыграл «Карту»» в дисплейном шрифте, ПОСЛЕДСТВИЯ — вторым уровнем, компактными чипами с единым ритмом, без
   стрелок `→` (стрелка — только там, где есть направление: «у кого → кому»); ВРЕМЯ — один раз на группу/ход (гаттер), не у каждой строки; добор карт —
   веер миниатюр лиц (ряд `ConsoleCardFaceLite`) вместо простыни имён; разделитель поколения — плита «ПОКОЛЕНИЕ N»; панель — стекло CF с фаской к проёму;
   (б) только материал панели + крупный арт + время раз на группу — чипы как есть.
6. **Иерархия типографики** — три яруса (заголовок › последствия › служебное) из существующей лестницы `console-reading-typography`; пол TV; Deck — база не растёт.
7. **Что остаётся прежним** — диагноз 8 целиком; уведомления и факты финала визуально НЕ меняются (гард: снимки уведомлений до/после — одинаковы).
8. **Объём** — карта ≈ 45 %, журнал ≈ 55 %.

## 0. Рабочее дерево
1. `git log --oneline -1` → `1c260ed8bc` на выдаче. **Сначала** `ListAgents` + `SendMessage` соседу-82 (T05): твои файлы — `turmoil/MartianMediaCenter.ts` + спек,
   `common/cards/turmoilReduxAdaptation.ts` (строка 44 — его T05-строка уже снята), `models/actionPreview.ts` (`declaredActionSteps`), `models/actionUnavailableReasons.ts`,
   `behavior/Executor.ts` (`canExecute` sendDelegates), `ConsoleActionComposer.vue` (цена с рельса на staged-двери), `parliament/ConsoleParliamentVoteMode.vue` (только
   если квитанция M€ не печатается), `components/console/ConsoleJournalPanel.vue`, `consoleJournalModel.ts`, `components/journal/*` (краска, не модель),
   `console.less` § `.con-journal` + общий блок чипов (осторожно — уведомления), `console_tv.less` § 15, `ru/{turmoil_cards,card_info,ui,console}.json`, e2e карты /
   журнала, доки. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>` — сосед держит стейдж); лор — только `T07`; после коммита —
   `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t07` → `npm run e2e:remote -- t07 <spec> [--exclusive --workers=1]`; кадры
   «до» — клиент HEAD (`TM_E2E_SHOTS_TAG=before`); exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд карты = спек** `tests/e2e/console-martian-media-center.spec.ts` (TIMING-класс из-за PL-104 — `--exclusive --workers=1`; tv4k + fhd; СЦЕНЫ TR15 1–7 с
   M€-ценой): (1) «Действия карт» → карта → композер: плита «−3 M€ · резерв 3 → 2», ряд «ДАЛЕЕ: Резолюция — выбор в Парламенте», CTA «Выбрать резолюцию»; A —
   НИЧЕГО не отправлено (счётчик сервера стоит, M€ на месте); (2) ОДИН поток: крошка держит корень и имя карты, хвост НАСТРОЙКА → ГОЛОСОВАНИЕ, Парламент —
   один экземпляр внутри «Действий карт», колонка не пустеет при передаче; (3) режим: квитанция «Карта · 3 M€», источник «из резерва · по карте», нигде
   нет «5»; B → композер с той же веткой; снова A; (4) A в режиме — РОВНО ОДИН POST (`input-batch`), хвост адресован карте; (5) PL-104: жетон «−3» уходит с
   цифр строки M€ вбок в печатную иконку цены (строка 20 → 17 на отлёте, не раньше), ЗАТЕМ куб покидает стопку резерва на ленту резолюции; лобби полно до и
   после; жетон рождается после импульса коммита (PL-103); (6) сервер: 17 M€, голос на слоте, действие использовано, резерв −1, лобби цело; (7) конец на поле:
   нет workspace, ничего не брошено, нет переполнения, ни один полёт не признался в отсутствии rect; (8) `-locked`: 2 M€ → «не хватает M€»; пустая область →
   «нет резолюции на голосовании» (действие ПОКАЗАНО, выключено); резерв 0 → «делегатов в резерве: 0 из 1»; (9) розыгрыш: «Марс прежде всего» не у власти,
   1 делегат → чип руки «1 из 2».
4. **Стенд полировки = спек** `tests/e2e/console-journal-chronicle.spec.ts` (FUNCTIONAL; tv4k + fhd + Deck; первый e2e журнала): (а) панель открыта на
   фикстуре с богатым поколением (розыгрыш с последствиями, действие, добор 2 из 11, пропуск «ПРОПУЩЕНО», доход поколения TR61, чужой ход) — пробник: доля
   чернил, тексты ниже пола TV = 0, обрезки = 0, арт ≥ 160 px на 4K, время — раз на группу; (б) режимы ПОДРОБНО / СВОДКА и пейджер поколений живы (хуки
   существующих контролов); (в) попавер карты и подсветка клетки работают; (г) live-лента: новая запись появляется без скачка скролла; (д) уведомления —
   снимок до/после побайтно одинаков (гард токенов чипов); (е) reduced motion.
5. Фикстуры: `martian-media-center` (`parliamentFixture`: `stopAt: 'vote'`, три резолюции как в `martian-census`, карта на столе через `moveToDeckTop` +
   `playedCards.push`, 20 M€, резерв полон), `martian-media-center-locked` (варианты правила 2), `martian-media-center-hand` (карта в руке, требование);
   журнал — существующая богатая фикстура (та, что у `console-info-*` / `tv-profile-screens` с историей) или новая `journal-chronicle`.

## 1. Сервер — карта + общий слой (≈ 15 %)
`MartianMediaCenter.ts` — без правок правил; RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T07.png" T07` → `make:cards`), `card_info`, строка долой + пин
(11 из 22). Общий слой: `declaredActionSteps` — дверь для действия (диагноз 2; `stepsForBehavior` для розыгрыша — без изменений, T03-спек зелёный); футильность
(решение 4) в `canExecute` + `actionUnavailableReasons` (порядок причин правила 2). Спеки: карты (классика + Redux правила 1–4 + превью), `actionPreview.spec`
(действие → `delegateGrant`, розыгрыш → `delegateGrantFollowUp`), `actionUnavailableReasons.spec` (три причины, порядок), `ExecutorPolitics.spec` (действие без
резолюции — `canExecute` false на Redux, true на классике).

## 2. Клиент — ДВЕРЬ ДЕЙСТВИЯ С ЦЕНОЙ В M€ (≈ 30 %)
По решениям 2а / 3а: `stagedVotePriceGone` — ветка «цена с рельса» (признак `spendDepartsElsewhere`-класса: цена действия — M€ `spend`, жетон PL-104 из
`railReward` / action-commit), порядок «цена → куб» (§6 TR15), квитанция `{3, 'megacredits'}` в режиме (должна печататься из коробки — проверить
`voteInfoModel` для `stagedFlow: 'action'` + M€), `ctaCost` молчит при `door === 'card'`; `RUNTIME_NAVIGATION_STEP_KINDS` — без изменений. Спеки: `stagedActionVote.spec`
(§ M€-цена: порядок, признак), `voteInfoModel.spec` (квитанция M€ действия), `consoleActionComposer.spec` (дверь из декларативного превью).

## 3. Клиент — ПОЛИРОВКА: «ЖУРНАЛ — ХРОНИКА» (≈ 55 %)
### 3.А Кадры «до» и макеты
Стенд §0.4 на базе (три профиля) + пробник; макеты (CSS поверх живой панели на Steam Machine, 4K): M1 — решение 5а целиком; M2 — 5б; M3 — M1 с записями
как «страницами хроники» (арт на всю ширину карточки, заголовок поверх арта, последствия под) → батч владельцу (решения 5, 6) ДО реализации.
### 3.Б Краска и иерархия
`ConsoleJournalPanel.vue` / `JournalGroup.vue` / `JournalChildRow.vue` — только классы/структура обёрток (модель и токены — диагноз 8); арт tier (`cardArtUrlAtTier`
— ярус выше, lazy); время раз на группу (`JournalGroup` уже группирует — печатать в гаттере группы); веер миниатюр для добора (существующий
`ConsoleCardFaceLite`, ряд ≤ 6, «+N»); `console.less` § `.con-journal` — материал CF (общий миксин), три яруса типографики, чипы — ТОЛЬКО через общий блок
(и проверка уведомлений); `console_tv.less` § 15 — ярусы на TV; Deck — база. Dead-selector guard чистый; `transform` только на том, что уже анимируется.
### 3.В Гарды и регрессия
`tests/client/components/journal/*` зелёные; новый `journalChipTokensParity.spec` (чип журнала и чип уведомления — один класс/токен); `lessDeadSelectorGuard`,
`consoleTvTypeFloor`, `flightLayerZOrder`; e2e: стенд §0.4, `tv-profile-screens` (08-journal), `console-info-*` (журнал встроен?), уведомления (`console-notification-*`),
`console-martian-census`, `console-political-donation`, `console-cultural-metropolis` (T03 — дверь розыгрыша не изменилась) — по 2 повтора; хуки — тем же диффом.

## 4. Лицо, локаль, лор, арт
Арт T07; лор EN (ключ владельца) + RU; RU карты — решение 1; новые EN-ключи — только если причин TR03 / `delegateReserveReason` не хватает (`grep` по всем
`src/locales/*/*.json` ДО добавления); RU чужих ключей не переписывать (ключи карты — свои).

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardInformation`, `requirementProse`, `premiumCardViewModel`, `cardLore` (T07), `crossPlayerCoverageGuard`,
   `TurmoilCardsUnderRedux` (пин 11), `premiumScope.spec`, `parliamentGlossary.spec`, `e2eLiveness`, `lessDeadSelectorGuard`, `glyphLiteralGuard`, `consoleTvTypeFloor`,
   `cursorGrammarGuard`, `flightLayerZOrder`, `transferSurfaceClear`, `actionCommitRailRule`, `playRailRule`.
2. Юниты §1–§3; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §0.3, §0.4, §3.В; `npm run e2e:affected` + перевод задетых хуков.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd и Deck обязательны)
`screenshots/t07/{tv,fhd,deck}/`: (а) карта: композер (плата цены + ряд «ДАЛЕЕ») → режим голосования внутри «Действий карт» (квитанция 3 M€, крошка) → B
назад → A → жетон «−3» с рельса → куб из резерва → поле; выключенные состояния с причинами; чип руки «1 из 2»; (б) журнал ДО / ПОСЛЕ на богатом
поколении; запись розыгрыша, действия, добора (веер), пропуска, дохода; разделитель поколения; СВОДКА; (в) уведомление до/после — идентично. Таблица
пробника журнала (чернила · ниже пола · обрезки · арт px · время/группа) — в реестр. С дивана: «это хроника партии или консольный лог?»

## 7. Полировка по пути
1. Реестр: раздел **CH** «ГОЛОС ЗА 3 M€ ДЕЙСТВИЕМ — ЧЕТВЁРТАЯ ДВЕРЬ ДЛЯ ДЕКЛАРАТИВНОГО ДЕЙСТВИЯ · ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ» — диагноз 2–7 строками
   (классы: «сервер ведёт мимо готовой двери», «платное действие впустую», «цена с рельса на staged-двери», «стена чипов», «время у каждой строки»); номера —
   по footer.
2. Бэклог `weak-visuals-backlog` — «журнал» → DONE; замеченное по пути — ДОБАВИТЬ, не делать.
3. Доки: `docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` §5 — абзац «декларативное действие (T07): дверь из `declaredActionSteps`, цена с рельса»; `docs/claude/journal.md`
   — § «ХРОНИКА (2026-10)»: карточка события, три яруса, время на группу, веер добора, общие токены чипов; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T07
   «СДАНА» (11 из 22; список «на месте» — только корпорации); `unavailability-reasons.md` — футильное действие с грантом; закон в `.claude/rules/console-ui.md`
   («an ACTION whose delegate is its result opens the vote as a STAGED door — never a live grant after the price is paid»); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — `SendMessage` соседу-82, кадры журнала «до» + пробник + макеты M1–M3 → батч; карта — параллельно (сервер → дверь → стенд).
2. Порядок: лор `T07` → карта + спек + общий слой (дверь, футильность) + строка долой → цена с рельса на двери + стенд карты → макеты журнала → (после
   батча) 3.Б → 3.В → регрессия → раскадровки → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву (CH) и номера объявлять В МОМЕНТ записи по текущему footer; CG — соседа, не занимать.
4. Отчёт: первой строкой — арт; затем кадры двери (композер → режим → B → A → жетон → куб), кадры журнала ДО / ПОСЛЕ по профилям, таблица пробника,
   макеты, регрессия, решения 1–8 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (5 с макетами, 3, 6 — рекомендация первой), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Живой грант после списания 3 M€ (дверь — до отправки); второй экземпляр Парламента / своя `SelectParty`; auto-select резолюции; «5 M€» где-либо в
  потоке карты; списание до A в режиме; жетон цены по часам сервера (только после импульса коммита); менять дверь РОЗЫГРЫША (T03).
- Менять модель журнала (`journalView` / `journalEventChild` / токены), попаверы, подсветку клетки, режимы; красить чип журнала отдельно от чипа
  уведомления; `title`; литерал кнопки; текст ниже пола TV; состояние только цветом; скрытый скролл в панели (скролл журнала — явный, с хвостом ленты).
- Трогать файлы соседа-82 (T05: `influenceReading.ts`, `ConsoleInfluenceMod.vue`, `consoleParliamentModel.ts`, `seatParliamentReading.ts`,
  `ConsoleParliamentAgenda.vue`, `ConsoleStatusStrip.vue`, полоса), лор-строки чужих карт, разбор хода бота, правила карты; RU чужих ключей; `git stash`;
  bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
