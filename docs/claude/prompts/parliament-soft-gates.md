# Промт исполнителю · Парламент Turmoil Redux — «МЯГКИЕ ВОРОТА»: закрытие заседания становится ПРОМПТОМ МЕСТА, а не БАРЬЕРОМ ФАЗЫ — сервер ведёт учёт, кто ещё не закрыл заседание N (персистентная запись `sittingAcks`, переживает конец фазы и перезагрузку), и НЕ ПУСКАЕТ такое место в поколение N+1 (его пик драфта / покупка исследования / WGT выдаются только после его подтверждения), но никого другого за него не держит; ждут все только там, где зависят друг от друга: вопросы принятого закона внутри фазы (гранты тайлов по кругу, океан Water Export, сброс) и барьеры драфта / исследования; ОДНО подтверждение «Закрыть заседание» вместо двух гейтов; никакой памяти браузера; клиент играет одну прогулку ВЕРДИКТ → … → ИТОГИ из записей под холдами и держит счётчик поколения до подтверждения

> **Статус: С0+С1 СДАНЫ 2026-10-24** (`0ecd319c04` — сервер + клиент, `231521ea8a` — доводки: вердикт отпускает прогулку, фишка «ЗАСЕДАНИЕ»,
> пас в e2e — пасом игрока; не запушено). С2 (миграция 46 парламентских e2e) — в работе; С3 — контракт `docs/claude/console/parliament-soft-gates.md`,
> ledger раздел CK (PL-992…1000). Р1–Р9 — по умолчанию, ждут подтверждения владельца.
>
> **Выдан 2026-10-24.** Анализ на HEAD `8512b6f9fc` (версия 1.2.1869); на выдаче `git log -1` — перепроверить якоря. Рядом работают другие
> сессии: перед стартом `git status` + `ListAgents`. Выдан параллельно промт `parliament-one-framework.md` (эффекты/действия партий на каркасе
> «Действий карт» — другой исполнитель, другие файлы: `ConsoleCardActions`, `ConsoleEffectsExplorer`, `ConsolePartyActionComposer`, `parties/PartyEffects.ts`);
> ОБЩИЕ файлы с ним — `ConsoleShell.vue`, `consoleTaskRouter.ts`, `ConsoleParliamentSection.vue`: только свои строки, перечитывать перед коммитом
> (`concurrent-session-edits-same-files`). **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- softgates <spec…>`; exit 2/3/4 → СТОП и
> `AskUserQuestion`). Работа вертикальными срезами на `main`, каждый коммит зелёный. **Не пушить.**

---

## Суть (решение владельца, 2026-10-24)

Заседание сегодня строго синхронно: каждый ждёт, пока КАЖДЫЙ нажмёт «Продолжить» (гейт 1, вердикт) и «Закрыть заседание» (гейт 2). Владелец:
«игроки просто смотрят смену резолюций и что ОНИ получили, и забирают награду — какая разница, забрали другие свои награды или нет, если игрок всё
равно берёт свой первый набор драфта, выбирает карту и ждёт следующий набор? Не хочу ловить рассинхроны, но и не хочу, чтобы игроки ждали других,
когда от них не зависят. Ждать надо только на редких резолюциях с круговым размещением — и решать, ПРОПУСКАТЬ ли игрока в следующее поколение,
должен СЕРВЕР, а не кеш на клиенте».

Три подтверждённых решения: (1) **одно подтверждение** «Закрыть заседание» вместо двух гейтов; (2) **WGT** (терраформирование Мирового правительства
при солнечной фазе) первого игрока встаёт ЗА его подтверждением — остальные ждут его одного (кейс редкий, с ботом не используется);
(3) **при перезагрузке подтверждения переиздаются ПЕРВЫМИ**, до восстановления драфта / исследования.

**Закон итерации — барьер переезжает с ФАЗЫ на МЕСТО, правила внутри фазы не трогаются.** Повестка по-прежнему строго раньше поддержки, принятия и
наград — одной цепочкой `drive()`; вопросы закона по-прежнему последовательны по местам и держат фазу; что меняется — МОМЕНТ, когда игроку
показывают и когда его пускают дальше. Это пересмотр решения Q2 от 2026-09-18 (`docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` § 16: «двое ворот,
переключатель `soft` не делается») — тогдашний аргумент «порядок опыта = порядок игры» теперь обеспечивают ЗАПИСИ + ХОЛДЫ для каждого игрока отдельно,
а не общий барьер. Отклонённые там A1 («серверная отметка „видел“ без промпта») и A5 («сцена как flow-holding уведомление») остаются отклонёнными:
подтверждение — ПРОМПТ, его отсутствие — серверный факт, reload его переиздаёт, второе устройство видит ту же игру (закон `parliamentNoLocalStorage`).

## Образцы — по частям (читать ДО кода)

`CLAUDE.md` (инварианты 1, 2, 6, 10, 14; COMMIT BOUNDARY; «ОДИН ПРЕСС, НЕСКОЛЬКО ЭФФЕКТОВ — поверхности идут ПО ОЧЕРЕДИ») ·
`docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` § 3.1–3.6 (как устроено ожидание, что видят разные игроки, альтернативы), § 13.3 (гарды поимённо), § 15–16 ·
`docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` § Э1 (ворота, ключи, протокол в журнале), § Э3 (маршрутизация flow «ЗАСЕДАНИЕ»), § Э4 (директор) ·
`docs/TURMOIL_REDUX_PARLIAMENT_SITTING_V2.md` § Б1–Б3 (гейт 1 до изменений; «один проход, удержания из диффа»; награда без wall-clock) ·
`docs/claude/console/parliament-sitting.md` § 1–2, § 5–7 · `docs/claude/parliament-glossary.md` § 6 («ВАША НАГРАДА», «ПОЛУЧЕНО»; запреты) ·
`docs/claude/console/workspace-band.md` § EMBEDDED OUTCOMES / WORKSPACE DESCEND · память `presentation-reconciliation-design`, `animation-hold-registry`.
Код: `src/server/parliament/ParliamentPhase.ts` (шапка `:1-47`, `drive` `:236-302`, гейты `:494-547`, `stepEffects` `:551-659`, ask `:780-807`, `finish` `:1149-1161`,
`gateKey`/`parliamentGatePending`/`isGatePrompt` `:1178-1210`) · `SerializedParliament.ts` (`SerializedPhaseProgress`, `SerializedPhaseSummary`, хвост `:536-548`) ·
`src/server/Game.ts` (`postProductionPhase` `:1158-1216`, `continueAfterParliamentPhase` `:1239-1254`, `startGeneration` `:1328-1375`, `gotoResearchPhase` `:1093-1118`,
`gotoDraftPhase` `:1120-1129`, `worldGovernmentTerraforming` `:1506-1512`, `playerIsFinishedWithResearchPhase` `:1544-1550`, `deserialize` `:3240-3300`) ·
`src/server/Draft.ts` (`startDraft` `:66-99`, `restoreDraft` `:104-125`, `askPlayerToDraft` + `markDraftPrompt` `:140-214`, `onCardDrafted` `:217-240`) ·
`src/server/Player.ts` (`setWaitingFor` `:3337-3360`, `runResearchPhase` `:1271-1322`, `process` `:3274`) · `src/server/models/ServerModel.ts:590-600` ·
`src/server/parliament/ParliamentModel.ts:164-206` · `src/common/models/PlayerInputModel.ts:632-645` (`ParliamentPhasePromptMeta`) ·
`src/common/models/ParliamentModel.ts:542-617, 724-741` · клиент: `consoleSittingFlow.ts` (`sittingPagesOf` `:218-235`, `sittingPositionOf` `:252-300`,
`sittingPrimaryKey` `:443-457`, `parliamentSittingFlowBeat`/`parliamentSittingLive` `:466-480`), `parliamentSittingSeed.ts` (`:54-75`, `:191-229`),
`sittingBeats.ts:73-151`, `sittingDirector.ts` (шапка, `:38-58`), `parliamentRewardBeat.ts:15-38, 466-492`, `ConsoleParliamentSection.vue` (`runWalk` `:2408-2537`,
`planOpening` `:2273-2307`, `mayLeave` `:2387-2398`, отправка гейтов `:1819-1829`), `ConsoleParliamentBand.vue:185-188`, `parliamentBand.ts:648-650, 757-764, 872-874`,
`consoleMandatoryGate.ts:320-337`, `consoleTaskSummary.ts:575-585`, `consoleTaskRouter.ts:656-660`, `ConsoleShell.vue` (`:4805-4817`, `:5210-5222`, `:5721-5735`,
`:11775-11786`, `:16341-16346`, `:19958-19973`, `:20227-20235`), `consoleDraftFlow.ts:90-125, 184-189`, `generationScene.ts:70-80, 94-141`, `ConsoleStatusStrip.vue`
(счётчик поколения).

## Диагноз (подтверждён файл:строка на `8512b6f9fc`)

- **Гейты — барьеры подачи.** `stepGate` (`ParliamentPhase.ts:504-529`) выдаёт каждому человеку `SelectOption('Continue').markParliamentPhase({stage, generation, final, seq})`
  и возвращает `'waiting'`, пока `parliamentGatePending` не пуст; `onGateAnswered` (`:531-537`) двигает фазу ПОСЛЕДНИМ ответом. После последнего ответа на
  гейт 1 `drive()` (`:236-302`) проходит `agenda → support → enact → effects → refresh → lobby` одной цепочкой; всё выплачено и записано в `p.summary`
  (`SerializedPhaseSummary`: `winner` со слотом, `agenda {from,to}`, `support`, `outcomes` по местам, `returned`, `renewal` — журнал обновления, `rulingAnswers`, `seq`).
  Сервер никогда не ждёт, чтобы игрок ПОСМОТРЕЛ — только чтобы НАЖАЛ.
- **Клиент между гейтами уже играет кино по записям.** `sittingBeats(summary)` — чистая функция сводки (`sittingBeats.ts:104-151`); холды сеются из ДИФФА двух
  видов в том же синхронном блоке, что применение вида (`parliamentSittingSeed.ts:191-229`, вызовы `gameTransport.ts:672-677`, `App.vue:804-807`); награда —
  «DETECT … SEED … OWE … FLY» (`parliamentRewardBeat.ts:15-38`), Карьера — «из записей фазы, никогда из `lastAdvance`» (`careerGrantBeat.ts:12-40`), обновление —
  `summary.renewal` (`sittingDirector.ts:38-50`). Ждёт только страница ВЕРДИКТА: до гейта 1 записей после вердикта ещё нет, и стол читается ЖИВЫМ.
- **Фаза держит всех дважды за поколение.** Цена, записанная в § 3.6 плана («+2 ожидания „всех“»), риск § 15 («самый медленный игрок держит всех дважды»).
  Ожидание рисуется чипами `{kind: 'awaiting'}` (`parliamentBand.ts:648-650`, `:872-874`) и строкой «Ожидание» + кубы (`ConsoleParliamentBand.vue:185-188`,
  `data-sit-awaiting`); `rewardStep = 'gate'` без глагола A (`consoleSittingFlow.ts:265-300`, `:443-457`).
- **Что реально синхронно и должно остаться:** вопросы закона — `stepEffects` ходит по местам последовательно (`:551-659`), `runSeatStep` ставит `cursor.pending`
  и возвращает `'waiting'` (`:796-807`); барьеры следующего поколения — `needsToDraft` (`Draft.ts:217-224`) и `researchedPlayers` (`Game.ts:1544-1550`); WGT —
  `first.setWaitingFor(input, () => gotoEndGeneration())` (`Game.ts:1506-1512`) ДО `startGeneration`.
- **Один слот промпта на игрока.** `setWaitingFor` при стоящем промпте ПЕРЕЗАПИСЫВАЕТ с `console.warn` (бросает только под `THROW_STATE_ERRORS`, `Player.ts:3337-3345`);
  `Draft.askPlayerToDraft` (`:197`) и `ChooseCards.execute()` в `runResearchPhase` (`:1289`, «TODO(kberg): the server isn't ideal when it comes to handling multiple
  players at once») ставят промпт напрямую. В `runResearchPhase` РАЗДАЧА (`newStandardDraft(game).draw(this)`, `:1273`) и ВОПРОС слиты.
- **Запись о «не закрыл» не переживает фазу.** `finish()` (`:1149-1161`) копирует сводку в `lastPhase`/`phaseHistory` и обнуляет `parliament.phase`; `deserialize`
  (`Game.ts:3262`) возобновляет фазу только при `game.phase === PARLIAMENT && parliament.phase !== undefined`, иначе сразу `restoreDraft` / `gotoResearchPhase`.
  После `done` некому переиздать промпт закрытия — потому и нужна отдельная запись.
- **Клиент якорит заседание на ФАЗЕ.** `parliamentSittingFlowBeat` требует `game.phase === PARLIAMENT` + `parliament.phase` (`consoleSittingFlow.ts:466-475`);
  фрейм падает с фазой (`ConsoleShell.vue:11775-11786` → `closeWorkspaceRoot('parliament')` + `closeConsoleLayers()`); `mandatoryFlowBeats` кладёт драфт ПЕРЕД
  заседанием (`:5721-5735`), а `betweenGenResearchLive` истинна при `DRAFTING` или `RESEARCH && needsToResearch` (`consoleDraftFlow.ts:115-125`) — без нового
  порядка драфт всплывёт поверх незакрытого заседания. `generationScene`: «no flip — a Redux sitting stands between» (`:75`).
- **Бот и соло.** Бот не участник подтверждений (аспект `prompts`, `participants(game, 'prompts')`); планировщик бота стоит, пока у кого-то есть `waitingFor`
  (`BotTurnScheduler.ts:309`) — касается только фазы действий. В соло барьер и так из одного человека: итерация экономит ему ОДНО нажатие.

## Целевой контракт (ТЗ; каждый пункт с гардом)

### К1. Фаза без гейтов
`winner → agenda → support → enact → effects → refresh → lobby → done`; финальная — `… → effects → done`. Шаги `assembly`/`adjourn` из `drive()` удалены; значения
остаются в `ParliamentPhaseStep` ТОЛЬКО для старых сейвов: сейв на `assembly` продолжает в `agenda`, на `adjourn` — в `done`, легаси-гейт никому не переиздаётся
(ключи идемпотентны — ничего не платится дважды; спек «старый сейв» обязателен). `parliamentGatePending`, `parliamentGateAwaiting`, `isGatePrompt`, `gateKey`,
`ParliamentPhaseStage`, `phase.awaiting` — удалить вместе с потребителями (`ServerModel.ts:594-598`, `ParliamentModel.ts:173-174`, маркер).

### К2. Запись `sittingAcks` — серверная правда о «кто ещё не закрыл заседание N»
`SerializedParliament.sittingAcks?: {generation, seq, final, correlationId?, pending: Array<PlayerId>, owedWorldStep?: boolean}` (ключ по id места — `Cloner.replacePlayerIds`
переносит, как `appliedBySeat`). Пишется в `finish()` ДО обнуления `phase`: `pending` = `participants(game, 'prompts')` (люди; бот — никогда). Снимается с места его
ответом; запись удаляется, когда `pending` пуст. Модель: `ParliamentModel.sitting?: {generation, seq, final, pending: Color[]}` — читается клиентом для
страницы ИТОГОВ («ещё в заседании: …» — только как справка, НЕ ожидание) и e2e-пробниками.

### К3. ОДНО подтверждение — промпт места
После `finish()` каждому месту из `pending` без стоящего промпта: `SelectOption(message('The Mars Parliament of generation ${0} adjourns'), 'Close the sitting')`
с маркером `parliamentPhasePrompt: {stage: 'close', generation, final, seq}` (имя поля сохраняется — маршрутизация `consoleTaskRouter.ts:656-660` и плита
`consoleTaskSummary.ts:575-585` живут; `ParliamentPhaseStage` схлопывается в `'close'`; `awaiting` из меты удалён). Ответ: `pending −= seat`, `save`, строка
журнала «${0} закрыл(а) заседание» ПОД корнем заседания (`rejoinAction(correlationId)` — корень в `lastPhase.correlationId`), затем **допуск** (К4). Доблер /
устаревший ответ — отказ как сегодня (`promptId`). Место, у которого в момент `finish()` стоит чужой промпт (хвост отложенной очереди) — спрашивается, когда
слот освободится (тот же приём, что у `stepGate` сегодня: «never written over»; реализовать через `admit`-проверку в `clearWaitingFor`/колбэке — без таймеров).

### К4. Допуск в поколение — сервер решает, КОГДА место получит первый промпт N+1
Игра идёт вперёд НЕ ДОЖИДАЯСЬ подтверждений: `continueAfterParliamentPhase` → (SOLAR → WGT) → `startGeneration` → драфт / исследование для всех. Но ТРИ издателя промптов
обязаны спросить `ParliamentHandler.holdsSittingAck(player)` и, если место ещё не закрыло заседание, НЕ ставить промпт, а оставить работу до его подтверждения:
1. **Драфт** (`Draft.startDraft` раунд 1 и каждый следующий, `onCardDrafted` re-pick): раздача (`draftHand`, `needsToDraft = true`) — всем сразу, порядок RNG не
   меняется; `askPlayerToDraft` для держателя подтверждения — отложен; `restoreDraft` — то же правило. Барьер раунда (`needsToDraft`) ждёт его естественно.
   Optional re-pick держателю не выдаётся вовсе (его очередь — после допуска).
2. **Исследование без драфта** — `runResearchPhase` РАЗДЕЛИТЬ на `drawResearch()` (карты в `draftedCards`, вызывается в `gotoResearchPhase` всем) и `askResearch()`
   (ChooseCards / Underworld-вариант, вызывается допуском); `researchedPlayers` ждёт держателя естественно; `deserialize` при `RESEARCH` раздаёт только тем, у кого
   `draftedCards` пуст, и спрашивает только допущенных (сегодня `gotoResearchPhase` делает всё разом — переписать на идемпотентные половины).
3. **WGT** (`worldGovernmentTerraforming`): если `first` держит подтверждение — `sittingAcks.owedWorldStep = true`, промпт WGT ставится его допуском, `gotoEndGeneration`
   — по ответу на WGT; остальные места в это время БЕЗ промпта (стандартная поза «не ваш ход»). Решение владельца: ожидание по зависимости, допустимо.
Допуск = колбэк подтверждения: `admit(seat)`: `owedWorldStep && seat === first` → WGT; иначе `game.phase === DRAFTING && seat.needsToDraft` → `askPlayerToDraft`;
`game.phase === RESEARCH && !researched` → `askResearch`; `INTERGENERATION`/иное — ничего (промпт придёт от самого стартующего издателя, который снова спросит
`holdsSittingAck`). Ничего из этого не персистится отдельно: всё выводится из `sittingAcks` + состояния драфта / исследования — потому и переживает reload.

### К5. Перезагрузка: подтверждения ПЕРВЫМИ
`Game.deserialize`: (а) `parliament.phase !== undefined` → `resumePhase` как сегодня; (б) иначе `ParliamentHandler.reissueSittingAcks(game)` — каждому месту из
`pending` без стоящего промпта переиздать подтверждение; (в) и только потом `restoreDraft` / исследование / WGT-восстановление, которые пропускают держателей
(К4). Загрузчик e2e-фикстур (`e2eFixturesLoad`) и `Cloner` — тем же путём. Гард: спек «reload при одном закрывшем и одном нет: закрывший получает пик, второй —
подтверждение, ни один промпт не перезаписан».

### К6. Перезапись промпта — ошибка, не предупреждение
В тестах `setWaitingFor` поверх стоящего промпта БРОСАЕТ (включить `THROW_STATE_ERRORS` в `tests/testing/setup.ts` или сделать бросок безусловным для
`NODE_ENV=test`); в проде — `console.warn` + метрика. Это ловушка всей итерации: любой забытый издатель (поздний `defer`, Underworld-свап, prelude/CEO-драфты
второго поколения — их нет, но проверить) проявится падением спека, а не молчаливым рассинхроном.

### К7. Клиент — одна прогулка из записей, якорь — подтверждение
- `parliamentSittingFlowBeat`: живо, если (а) `game.phase === PARLIAMENT && parliament.phase` (вопросы закона и живая прогулка, как сегодня) ИЛИ (б) у места стоит
  маркер `parliamentPhasePrompt{stage:'close', seq}` и `lastPhase.seq === seq`. Ключ `parliament:gen<N>` тот же на обе половины; якорь фрейма — `{type: 'sitting', seq}`;
  фрейм падает, когда не держит ни (а), ни (б) (`ConsoleShell.vue:11775-11786`). Порядок `mandatoryFlowBeats`: ЗАСЕДАНИЕ ПЕРЕД драфтом (`:5721-5735`); `draftFrameLive`
  / `betweenGenResearchLive` — ложны, пока место держит подтверждение (`consoleDraftFlow.ts:115-125` читает маркер, не фазу).
- Страницы: `['verdict', 'enact', 'reward', 'renewal', 'results']` (финал — без `renewal`) из `lastPhase` (или `phase.summary`, пока фаза жива); `sittingPagesOf` больше не
  ветвится по шагу, кроме живого ожидания чужого вопроса (`waitingFor` — остаётся). ВЕРДИКТ — страница директора с полным чтением (3 с стадии, § 2.3 плана),
  НЕ стоп (решение Р1); единственный СТОП — ИТОГИ: A = «Закрыть заседание» (ответ на промпт). A во время бета = «дожать» (как сегодня). B до ИТОГОВ — парковка
  (карточка возврата на board home), на ИТОГАХ — `none`.
- Холды — на ВСЮ прогулку из ОДНОГО ответа: `parliamentSittingSeed` сеет при появлении `lastPhase.seq`, которого ещё не играли (а не на переходе «барьер → цепочка»):
  рельс (выплаты и реакции партий), маркер Повестки, медальоны правительства (`shownStates` v8 П4), слоты стола (сброс/раздача), кубы лобби, **счётчик поколения**
  (`ConsoleStatusStrip`) и `thisPlayer.needsToResearch`-зависимые поверхности. Потолок безопасности холда — как у награды (35 с), снятие — касанием/концом стадии,
  никогда `setTimeout` как такт (`parliamentNoTimers`).
- Reload посреди прогулки — конечные позы (`planOpening`), страница ИТОГОВ, A закрывает; ничего не переигрывается (`seq` + `playedStages` сессии — как сегодня).
- «Ожидание: X» в заседании — удалить (чипы `awaiting`, `data-sit-awaiting`, `rewardStep 'gate'`); остаётся только живое «X выбирает / ставит тайл» внутри фазы.
  Страница ИТОГОВ может нести тихую справку «в заседании: X, Y» из `ParliamentModel.sitting.pending` — без глагола, без мигания (решение Р2).
- Смена поколения: `generationScene` — флип счётчика играет при ОТВЕТЕ на подтверждение (`flipTo` = новое поколение, под холдом до этого момента), затем анонс
  драфта / исследования своим порядком (или WGT — его обычная поверхность). Для места, которое закрыло заседание, экран — драфт/исследование; для первого
  игрока с солнечной фазой — сперва WGT.
- Другие места слоу-игрока не ждут нигде, кроме списка ожидания драфта / исследования (существующая поверхность).

### К8. Финальное поколение
После последнего заседания — финальные озеленения (`gotoFinalGreeneryPlacement` спрашивает игроков по очереди). Чтобы не плодить четвёртого издателя с допуском,
финальное подтверждение остаётся БАРЬЕРОМ (одно, после `effects`): `finish(final)` выдаёт подтверждения всем и ждёт всех, затем `continueAfterParliamentPhase(true)`.
Цель итерации — межпоколенческое ожидание; финал один раз за партию (решение Р3).

### К9. Что не меняется
Правила и порядок шагов внутри фазы; `Phase.PARLIAMENT` на время вопросов закона (РТ под парламентом, не под SOLAR — `IGame.ts:85`); `pendingActions`; бот
(`NoBotPolitics`, аспект `prompts`); журнальная группа `political-phase` (ответ подтверждения — под корнем); `phaseHistory`; `productionIncome` (списывается первым
`process` места — теперь это подтверждение или пик); таймер игрока (подтверждение — не `optional`, часы идут, как у гейтов сегодня).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте ОДНИМ `AskUserQuestion`)
| № | Вопрос | По умолчанию | Альтернатива |
| --- | --- | --- | --- |
| Р1 | Страница ВЕРДИКТА | страница директора: полное чтение и дальше сама; один стоп — ИТОГИ | мягкий стоп (A продолжает без запроса к серверу) |
| Р2 | Справка «ещё в заседании: …» на ИТОГАХ | тихая строка из `sitting.pending`, без глагола | не показывать |
| Р3 | Финальное заседание | подтверждение — барьер (одно), дальше финальные озеленения как сегодня | тоже мягкое + допуск озеленений |
| Р4 | Маркер | имя `parliamentPhasePrompt` сохраняется, `stage: 'close'`, `awaiting` удалён | новый маркер `sittingClosePrompt` |
| Р5 | Старый сейв на легаси-гейте | фаза едет дальше, легаси-гейт не переиздаётся | переиздать один раз |
| Р6 | WGT | за подтверждением первого игрока; остальные — стандартная поза «не ваш ход» (ПОДТВЕРЖДЕНО владельцем) | — |
| Р7 | Флип счётчика поколения | при ответе на подтверждение | при входе на ИТОГИ |
| Р8 | Строка журнала о закрытии | «${0} закрыл(а) заседание» под корнем заседания | без строки |
| Р9 | Re-pick драфта держателю | не выдаётся до допуска | выдаётся (optional), пик — после |

## 0. Рабочее дерево
1. `git log --oneline -1` → `8512b6f9fc` в анализе. `ListAgents` + `SendMessage` соседям: твои файлы — `src/server/parliament/{ParliamentPhase,ParliamentHandler,Parliament,ParliamentModel,SerializedParliament}.ts`,
   `src/server/{Game,Player,Draft}.ts` (названные методы), `src/server/models/ServerModel.ts` (блок маркера), `src/common/models/{PlayerInputModel,ParliamentModel}.ts`,
   `src/common/parliament/ParliamentTypes.ts` (`ParliamentPhaseStep/Stage`), клиент `src/client/console/parliament/{consoleSittingFlow,parliamentSittingSeed,sittingBeats,
   sittingDirector,parliamentBand,parliamentRewardBeat}.ts`, `src/client/components/console/parliament/{ConsoleParliamentSitting,ConsoleParliamentBand}.vue`,
   `ConsoleParliamentSection.vue` (прогулка, отправка), `consoleDraftFlow.ts`, `generationScene.ts`, `ConsoleShell.vue` (только beats/frame/watcher-строки),
   `consoleTaskSummary.ts`/`consoleMandatoryGate.ts`/`consoleTaskRouter.ts` (строки маркера), `ru/parliament.json` (свои ключи), тесты, доки.
   Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>`); после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine**: `npm run build` → `npm run e2e:snapshot softgates` → `npm run e2e:remote -- softgates <spec…>`; кадры «до» — клиент HEAD в снапшоте
   `.e2e-softgates-before` (`ab-baseline-head-client-in-snapshot`). Exit 2/3/4 — СТОП и `AskUserQuestion`; `TM_E2E_BESIDE_GAME` / `TM_E2E_LAPTOP_OVERRIDE` не ставить.
   Два места: `bootFixtureSeats`; второе место отвечает через `sendPlayerInput` (`parliamentDrive.ts:26-60` — переписать `answerGateAs/answerGateOnScreen/closeSitting`
   на одно подтверждение).

## Порядок срезов (каждый — зелёный коммит)
- **С0 Сервер — запись и допуск** (К1–К6, К8; ≈ 40 %): `sittingAcks`, выдача подтверждения в `finish()`, `holdsSittingAck`, три издателя с допуском (драфт · исследование
  раздельно · WGT), `deserialize` с переизданием первыми, легаси-шаги, бросок на перезапись в тестах. Спеки: `ParliamentPhase.spec` § «the sitting's gates» (`:680-936`)
  переписать на новую семантику (двое/трое мест, reload в каждом состоянии, клон, финал, соло, старый сейв на `assembly`/`adjourn`, WGT за подтверждением, Underworld-свап),
  `Draft.spec`/`Game.spec` (раздача всем, вопрос только допущенным, re-pick), `ParliamentModel.spec` (`sitting`), `consoleParliament` фикстурный загрузчик.
- **С1 Клиент — якорь и одна прогулка** (К7; ≈ 35 %): beat на маркере, порядок beats, драфт не всплывает, страницы, ВЕРДИКТ как страница директора, ИТОГИ — стоп,
  холды с `lastPhase.seq` на всю прогулку (+ счётчик поколения), флип при подтверждении, удаление «Ожидание», справка на ИТОГАХ. Спеки: `consoleSittingFlow.spec`
  (переписать кейсы `:58-336`), `sittingBeats.spec`, `parliamentSittingSeed.spec`, `generationScene.spec:70-71` (флип при подтверждении), `consoleMandatoryGate.spec`,
  `consoleDraftFlow`-спеки, `parliamentNoTimers`/`parliamentNoLocalStorage` (без изменений — зелёные).
- **С2 e2e и фикстуры** (≈ 15 %): `generate.ts` `ParliamentStop 'vote' | 'effects' | 'close' | 'done'` (`:1019-1041`, `answerStandingGates` → `closeSittingsAs`), `parliamentDrive.ts`
  (`turnTo` без `data-sit-awaiting`), `console-parliament-gates.spec` → «подтверждение двигает ТОЛЬКО место: после `done` поколение уже N+1, первый закрывший получает
  пик, второй — нет, пока не закроет; дубль отказан», `console-parliament-sitting*.spec` (`-sitting:291-306` «results wait for the other seat» → «results do NOT wait;
  the other seat is in the draft»), `-sitting-v2-remote` (второе место закрывает ПОСЛЕ — первое уже в драфте), `-renewal`, `-leave`, `-stability`, `-results-honesty`,
  `-skyscrapers:333-335` (поколение 2 наступает ДО второго закрытия), `-marsfirst-budget`, `-reds-budget`, перечисленные в § 7 отчёта спеки с одним гейтом (`-ban … -water`,
  `console-eden-alliance`, `-political-science`, `-promethean-alliance`, `-resolution-face`, `-tharsis-alliance`) — у них исчезает нажатие «Продолжить»: одно «Закрыть
  заседание» на ИТОГАХ; `e2eLiveness` зелёный. Новые: `console-parliament-softgates.spec` (П1–П6 ниже, 1080 + tv4k) и серверный `console-parliament-softgates-api.spec`.
- **С3 Доки + реестр + журнал** (≈ 10 %).

## 9. Пробники (каждый утверждает факт сервера И видимость на экране)
- **П1 Допуск по месту (API, два места)**: после `done` `game.generation === N+1`, `parliament.sitting.pending = [A, B]`; A закрывает → `waitingFor(A)` = пик драфта /
  покупка, `pending = [B]`; B без промпта N+1; B закрывает → его пик; раунд драфта ждёт обоих как обычно. Ни одной строки «Overwriting waitingFor» в логе (в тестах — бросок).
- **П2 Reload**: сейв с `pending = [B]` и уже раздавшимся драфтом → после загрузки у B стоит ПОДТВЕРЖДЕНИЕ (переиздано первым), у A — пик; B закрывает → пик; поколение
  играется до конца. То же для исследования без драфта и для WGT (`owedWorldStep`).
- **П3 Зависимость держит всех**: грант тайла месту B (Skyscrapers / Бюджет «Марс вперёд») → подтверждений нет, драфта нет, A видит «ждём B: тайл»; B ставит → `done` →
  подтверждения → драфт. Water Export (вопрос `worldStepHandle`) — то же.
- **П4 WGT**: солнечная фаза, `first` держит подтверждение → у остальных нет промптов, поколение не стартовало; `first` закрывает → WGT; отвечает → `startGeneration` → драфт всем.
- **П5 Одна прогулка под холдами (экран, tv4k + 1080)**: место, которое ничего не спрашивали, получает ОДИН ответ с вердиктом и всем остальным: на странице ВЕРДИКТА стол,
  маркер Повестки, медальоны, рельс и **счётчик поколения** стоят как ДО (разница с кадром «до» = 0 px / 0 единиц), каждая стадия приходит своим бетом; на ИТОГАХ A
  «Закрыть заседание» → флип счётчика → анонс драфта. Ни одного кадра драфта/исследования поверх открытого заседания.
- **П6 Без ожидания**: после закрытия у первого места на экране драфт (его первый пакет), у второго — заседание на любой странице; в заседании нет `data-sit-awaiting`
  и слова «Ожидание»; B до ИТОГОВ паркует, карточка возврата стоит; на ИТОГАХ B = none.
- **П7 Финал**: последнее заседание — подтверждение-барьер, затем финальные озеленения (существующие спеки финала зелёные).
- **П8 Журнал/уведомления**: группа заседания цела, строка закрытия под корнем, уведомления не дублируются (`notificationDeliveryLedger`).
- **П9 Гарды**: `parliamentNoTimers`, `parliamentNoLocalStorage`, `parliamentGlossary`, бюджет обзора, `console-parliament-stability`/`-chassis-parity`, `e2eLiveness` — зелёные.

## 10. Визуальная приёмка = РАСКАДРОВКА (`screenshots/softgates/`; **TV первым**; fhd)
Два места на `parliament-skyscrapers-enact`-подобной фикстуре с вопросом и на `parliament-climate-enact` без вопроса: (1) место A: ВЕРДИКТ → ПРИНЯТИЕ → НАГРАДА → ОБНОВЛЕНИЕ →
ИТОГИ (кадр ИТОГОВ со справкой «в заседании: B») → «Закрыть заседание» → флип → анонс драфта → первый пакет; (2) место B в это же время: заседание стоит, ничего
не всплыло; закрывает → драфт; (3) WGT-вариант: A = first, после закрытия — WGT; (4) кадры «до» рядом. С дивана: «я досмотрел своё заседание и сразу пошёл в драфт —
а когда там появился второй, я и не заметил?»

## 11. Доки и реестр
1. Реестр `docs/claude/gameplay-polish-ledger.md`: новый раздел (буква/номера — по текущему footer в момент записи; на выдаче последний — CI, PL-984) —
   «МЯГКИЕ ВОРОТА: ЗАКРЫТИЕ ЗАСЕДАНИЯ — ПРОМПТ МЕСТА, ДОПУСК В ПОКОЛЕНИЕ РЕШАЕТ СЕРВЕР».
2. `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` § 3.2–3.6 и § 16 Q2 — пометка «ПЕРЕСМОТРЕНО 2026-10-24: мягкие ворота, см. …» со ссылкой на новую
   `docs/claude/console/parliament-soft-gates.md` (контракт К1–К9 как сдан, таблица «что видят разные игроки» заново, карта издателей промптов с допуском, гочи);
   `docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` § Э1/Э3 и `_SITTING_V2.md` § Б1 — пометки; `docs/claude/console/parliament-sitting.md` § 1–2, § 5 — обновить;
   `docs/claude/parliament-glossary.md` — «Закрыть заседание» единственный глагол закрытия, «Продолжить» у заседания больше нет; `.claude/rules/server.md` — ОДНА
   строка-закон: «издатель промпта нового поколения спрашивает `holdsSittingAck` — ни один промпт не пишется поверх стоящего».
3. Журнал `docs/claude/parliament-sitting-progress.md` — раздел «Мягкие ворота (2026-10-24 →)», срез за срезом; память агента — заметка о сдаче.

## 12. Режим работы
1. Читать до кода; `SendMessage` соседям; С0 (серверные спеки зелёные, П1–П4 на API) → С1 (П5–П6 кадрами) → С2 → С3. Коммит по ханкам, каждый зелёный по юнитам,
   линту, `build:test`; e2e — на Steam Machine, своим снапшотом; тайминги — `--exclusive --workers=1`.
2. Отчёт: первой строкой — кадры «A в драфте | B ещё в заседании» (tv4k); затем таблица «кто чего ждёт» до/после, результат П1–П9, решения Р1–Р9 с тем, что сделано
   по умолчанию, ОДИН `AskUserQuestion` (Р1, Р3, Р7 — рекомендация первой), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 13. Нельзя
- Память браузера о «видел» (`localStorage`/`sessionStorage`/модульный флаг как источник правды) — только серверная запись и промпт; клиентская сцена без промпта;
  второй барьер «на всякий случай»; перезапись стоящего промпта; таймеры как такты; детекция по заголовку (маркер, инвариант 1); менять порядок шагов внутри
  фазы; трогать вопросы закона (они и есть законное ожидание); спрашивать бота; скрывать ожидание зависимости — оно называет себя («ждём B: тайл»); новая проза
  на обзоре Парламента; удалять e2e-проверку вместо перенацеливания; мёртвый хук в отрицательной проверке.
- Файлы соседа (`parliament-one-framework`: композер/эксплорер/`PartyEffects.ts`) и чужие строки в общих файлах; RU чужих ключей; `git stash`; bare `git push`;
  Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`; красные коммиты.
