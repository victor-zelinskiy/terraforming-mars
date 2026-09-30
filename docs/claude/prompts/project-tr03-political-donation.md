# Промт исполнителю · TR03 Political Donation («Политическое пожертвование») — седьмая карта проектов Turmoil Redux

Выдан 2026-09-30. Инфраструктура набора стоит (TR09, TR08, TR66, TR02, TR01, TR05 сданы) — **ничего из неё не
повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила карт — `.claude/rules/game-logic.md`, парламент —
`.claude/rules/console-ui.md` § THE PARLIAMENT SITTING (законы 8, 11–14, 21) и `docs/claude/parliament-glossary.md`.
**Обязательное чтение до кода:** `docs/TILE_PLAY_STAGED_COMMIT.md` целиком (STAGED PLAY — эта карта его третий
потребитель) и `docs/claude/turmoil-redux-colonies.md` § 5 (встроенное голосование Redux-Венеры).

**Серверная часть карты мала. Главное в задаче — ПОДАЧА: бесшовный путь «рука → розыгрыш → Парламент → посадка» одним
flow и экран, на котором игрок ДО подтверждения видит всё, что изменится.** Оценивается именно это.

| Впервые | Что это | Ближайший образец (уже в коде) |
| --- | --- | --- |
| **Карта, которая СТАВИТ ДЕЛЕГАТА розыгрышем** — третья дверь голосования | сегодня делегат попадает на резолюцию двумя дверями: действие «Голос» (`ParliamentHandler.voteOption`, лобби / резерв за 5 M€) и ГРАНТ эффекта (Redux-Венера) | `src/server/parliament/PlaceDelegatesOnResolution.ts` — «the VOTE's ledger mutation without the vote's economy»: из РЕЗЕРВА, бесплатно, `SelectParty` с `votePrompt {source: 'grant'}` + `choiceContext`; консоль хостит режим голосования ВНУТРИ flow-источника (`ConsoleShell.vue:17052–17077`) |
| **STAGED VOTE — резолюция = адресованный хвост батча** (pre-select в чужом workspace) | «Выбрать резолюцию» НЕ шлёт ничего; резолюция выбирается в Парламенте, встроенном в руку; подтверждение там = единственный POST | **STAGED PLAY** тайлов: `src/client/console/stagedPlay.ts`, `ConsoleShell.onPlayCardConfirmNative` (ветка staged `:15003–15029`), `beginStagedPlayLanding` (`:18299`), `cancelStagedPlay` (`:18385`), адресованный хвост `SelectSpaceResponse.stagedFor` + `deferredInputBatch.stagedMismatch` |
| **Эффект карты на НАРОДНУЮ ПОДДЕРЖКУ** | до сих пор область партии пополняет только заседание (шаг `support`) | `Parliament.addPopularSupport(party, n)` (`Parliament.ts:652–662` — «up to n, cap 3, supply permitting», возвращает, сколько село); сокеты плашки `ConsolePartyPlaque.vue:126–128` (`data-parl-support`), пул нейтральных на скамье `ConsoleParliamentSeats.vue:47–60` (`data-parl-neutral-pool` / `-cube`) |

## РЕШЕНИЯ ВЛАДЕЛЬЦА (приняты 2026-09-30 — не пересматривать)
1. **«Add up to 3 neutral delegates» = СКОЛЬКО ВЛЕЗЕТ.** Карта кладёт `min(3, свободные места области, запас нейтральных)`
   — ровно арифметика `addPopularSupport`. Игрок количество НЕ выбирает: дайла нет, `SelectAmount` нет. Экран заранее
   показывает честное число («0 → 3»; «2 → 3 · +1 из 3 · предел области»; «+0» — названный пропуск).
2. **Хореография = РИТУАЛ КАК У ТАЙЛОВ** (`TILE_PLAY_STAGED_COMMIT.md` §8-bis п.1): «Выбрать резолюцию» → карта
   ложится в «Разыграно» (до сервера) → из этой же зоны разворачивается Парламент → A = POST → куб и нейтральные садятся →
   flow уходит на поле. Посадки карты ПОСЛЕ выплаты нет, возврата в композер после коммита нет.

Принято по умолчанию (подтвердить у владельца в отчёте, не блокер): RU-имя **«Политическое пожертвование»**; делегат
карты — **только из РЕЗЕРВА** (закон гранта: куб лобби — бесплатный голос поколения, эффект его не тратит); без делегата
в резерве карта **неиграбельна** (прецедент апстрима — карты Turmoil, требующие `getAvailableDelegateCount`).

---

## 0. Рабочее дерево
`git status` на момент выдачи: соседняя сессия держит незакоммиченную работу над e2e-инфраструктурой —
`package.json` (M), `scripts/e2e-snapshot.mjs` (A), `tests/e2e/consoleTest.ts` (M), `tests/console/e2eContract.ts`,
`tests/console/e2eLiveness.spec.ts` (untracked). **Не трогать, не включать в свои коммиты.** `consoleTest.ts` — база
каждого e2e-спека: свой e2e писать и гонять после того, как сосед закоммитит (или согласовать), иначе зелёное/красное
будет про чужую правку. Свои новые файлы коммитить сразу (сосед свипает untracked), `git add` только по своим путям,
в общих файлах (`TurmoilReduxCardManifest.ts`, `CardName.ts`, словари, `lore_texts.json`, `ConsoleShell.vue`,
`stagedPlay.ts`, `deferredInputBatch.ts`, журнал) — только своя строка/ветка. `genfiles/**` не править руками.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR03.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR03.png` (лежит; 1536×1024) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR03.png" TR03` → `npm run make:cards`.

- **Political Donation** · `cardNumber: 'TR03'` · стоимость **4** · тип **AUTOMATED** (зелёная) · метка **Марс**
  (один кружок в правом верхнем углу — красная планета).
- **Требования нет** — плашка «MIN» у цены пуста (как у TR66 / TR05). **ПО нет.**
- **Графика** (один ряд): `[делегат игрока — белый]` · пауза · `[нейтральный][нейтральный][нейтральный]` с фиолетовой
  пилюлей **«?»** и звёздочкой. Пилюля = «партия ЭТОЙ резолюции» (не выбор партии).
- **Текст:** *(Add a delegate to a resolution. Then add up to 3 neutral delegates to the Popular Support Area of that
  resolution's party.)*
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется, комментарий в манифесте.
- **Лор** EN: *«Pray that it does not show up on social media.»* → `assets/text/lore_texts.json` ключ `"TR03"` (между
  `"TR02"` и `"TR05"`).

### Правила чтения (каждое — закрепить спеком)
1. **Делегат — из РЕЗЕРВА, бесплатно, на резолюцию ОБЛАСТИ ГОЛОСОВАНИЯ** (не на принятую) — ровно
   `PlaceDelegatesOnResolution`: `parliament.placeVote(player, slot, 'reserve')`. Куб лобби остаётся в лобби (спек).
2. **Карта неиграбельна** без делегата в резерве или без резолюций на голосовании — ОДНА причина на блокер, в порядке
   проверки: `'No resolution is up for a vote'` (ключ есть, `parliament.json:73`) → новая `'No delegate in your reserve'`
   («В резерве нет делегатов»). Не `'All your delegates are in play'` — при кубе в лобби это ложь. Вне Redux (нет
   `game.parliament`) карта в колоду не попадает (ворота — модуль); `canPlay` там — false без падения.
3. **«Then» = после посадки делегата, в ту же партию**: партия берётся из ВЫБРАННОЙ резолюции, второго вопроса нет.
4. **Поддержка = `addPopularSupport(party, 3)`**: предел области 3 (`PARLIAMENT_MAX_POPULAR_SUPPORT`), запас нейтральных
   (`neutralSupply()` = 14 − нейтральные голоса − вся поддержка). Село меньше 3 — не ошибка; село 0 — **названный
   пропуск** (§2 A2), карта всё равно играется (делегат — её первый эффект).
5. **Нейтральные НЕ встают на текущую резолюцию.** Они лежат в области партии и уйдут голосами на СЛЕДУЮЩУЮ карту этой
   партии (шаг `refresh` заседания, `moveSupportToSlot`). Спек: после розыгрыша `neutralVotes(slot)` не изменился.
6. **Делегат карты — обычный делегат**: считается в `votesOf` (требование TR02 «На резолюциях»), даёт доступ к эффекту
   партии с двух (`PARTY_EFFECT_DELEGATES`), двигает задание председателя вида `delegates`
   (`QuestTracker.report({kind: 'delegates', amount: 1})` — уже внутри общего шага), `totalDelegatesPlaced++`.
7. **Порядок правил не трогать**: общий шаг стоит на `Priority.GAIN_RESOURCE_OR_PRODUCTION`; гейт задания председателя —
   `BACK_OF_THE_LINE` (`ChairmanSeat.ts:111`), т.е. встаёт ПОСЛЕ вопроса карты.
8. **MarsBot карту не играет** (колода бота — метки); ветка `player.isMarsBot` общего шага остаётся как есть.

## 2. Блок A · сервер

### A1 · Одна арифметика поддержки — «хук, который отвечает, не действует»
Обещание (превью) и выплата обязаны читать ОДНУ функцию. В `Parliament.ts` рядом с `addPopularSupport`:
`popularSupportRoom(party, n): {current, gained, resulting, printed: n, limit?: 'area' | 'supply'}` — чистая;
`addPopularSupport` переписать поверх неё (поведение заседания не меняется — `ParliamentPhase.spec` зелёный без правок).
`limit` называет, ЧТО срезало (`'area'` — предел 3, `'supply'` — кончились нейтральные; предел области проверяется первым).

### A2 · Общий шаг `PlaceDelegatesOnResolution` — три аддитивных расширения (Венера не меняется)
1. **Опция `support?: number`** («затем до N нейтральных в поддержку партии выбранной резолюции»): в `andThen` после
   `placeVote` — `addPopularSupport(party, support)`; лог существующим ключом `'${0} gain ${1} neutral delegate(s) in
   Popular Support (${2}/${3})'` (`parliament.json:95`). Село 0 → `recordSkippedEffect` (`deferredActions/skippedEffect.ts`)
   с ТЕМ ЖЕ описанием, что показало превью (метка «Popular support», величина 3, причина по `limit`: область заполнена /
   нейтральных не осталось) + строка в классовой таблице `tests/models/skippedEffectRecord.spec.ts`.
2. **Маркер несёт проекцию**: `VotePromptMeta.support?: ReadonlyArray<{party: PartyName} & SupportRoom>`
   (`PlayerInputModel.ts:462–477`) — по записи на КАЖДУЮ партию области, из `popularSupportRoom`. Клиент правило не
   выводит (не считает `3 − current` сам).
3. **Read-only близнец `previewSelectParty(): SelectPartyModel | undefined`** (семейство `previewSelect*` — образец
   `AddResourcesToCard.previewSelectCard`): тот же заголовок, `parties`, `votePrompt` (с `count`, `printed`, `support`),
   `choiceContext {source: {kind: 'card', card}, mode: 'reward'}`; `undefined` в тех же ветках, где `execute()` пишет
   «cannot add delegates». Ничего не мутирует, в очередь не ставит.

### A3 · Адресованный хвост для `party` — обобщить существующий закон, не завести второй
`docs/TILE_PLAY_STAGED_COMMIT.md` §9-quater: позиционный хвост различает промпты только по ТИПУ. Для `party` это
достижимо по-настоящему: кресло председателя — тоже `SelectParty` (`votePrompt.source === 'chairman-seat'`,
`ChairmanSeat.ts:343`), и запаркованный ответ «Зелёные» выбрал бы там, С КАКОЙ резолюции СНЯТЬ делегата.
- Wire: `SelectPartyResponse.stagedFor?: CardName` (`InputResponse.ts:122–129`; валидатор принимает обе формы — образец
  `isSelectSpaceResponse`, `:94–97`).
- `deferredInputBatch.ts`: `stagedAddress` (`:244`) читает адрес и у `party`; `stagedMismatch` (`:258`) для него:
  совпадение ⇔ `waitingFor instanceof SelectParty && votePrompt?.source === 'grant' && choiceContext?.source.card ===
  address`. Всё остальное — парковка БЕЗ попытки; совпадение + отказ `process` = честная устарелость → хвост сброшен,
  вопрос встаёт живым. Baseline-карта клеток (`stagedParkBaselines`) для `party` не нужна: состав области внутри действия
  не меняется, членство валидирует `SelectParty.process` (`:47`). `expireSupersededStagedTail` — покрыть и `party`.
- Неадресованные ответы (Венера, голос, кресло) — как были, побайтно.

### A4 · Шаг превью `delegateGrant`
`ActionPreviewStep` (`ActionPreviewModel.ts:271–461`) получает член по образцу `colonyTrade` / `boardPlacement.staged`:
`{kind: 'delegateGrant', staged: StagedVoteModel}`, где `StagedVoteModel = {prompt: SelectPartyModel, sourceCard: CardName}`
— `prompt` есть дословно `previewSelectParty()`. Билдер — в `src/server/cards/actionPreviews.ts` (`delegateGrantStep(…)`),
зовётся из co-located `cardPlayPreview` карты. **Не `note` и не `input`**: консоль читает шаг СТРУКТУРНО, чтобы превратить
коммит композера в навигацию. Эффекты ветки (`effects`): ОДИН чип, не зависящий от цели, — делегат из резерва
(`current → resulting` резерва). Поддержку в `effects` НЕ класть: она зависит от цели (закон стандартных проектов —
«target-dependent results are NOT guessed before a target exists»).

### A5 · Карта — `src/server/cards/turmoilRedux/PoliticalDonation.ts`
`Card`, `CardType.AUTOMATED`, `tags: [Tag.MARS]`, `cost: 4`, `cardNumber: 'TR03'`. `export const
POLITICAL_DONATION_SUPPORT = 3` в файле (спек читает константу). Bespoke:
- `bespokeCanPlay` ⇔ парламент есть ∧ область не пуста ∧ `parliament.reserve(player) >= 1`; co-located
  `unplayableReason` — причины правила 2 (образец формы — любая bespoke-карта скоупа с этим хуком; гард
  `cardReasonConsistency`).
- `bespokePlay`: `player.game.defer(new PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: this.name},
  {support: POLITICAL_DONATION_SUPPORT}))`, возврат `undefined`. Никакого своего `SelectParty`, никакого `placeVote`.
- `cardPlayPreview(player)`: одна ветка, `steps: [delegateGrantStep(...)]`; шапка файла — чтение скана + правила 1–8.
- `renderData` — ряд в ряд по скану: `delegates(1)` · пауза · `neutralDelegate(3)` (`CardRenderer.ts:283`, `:457`) ·
  пилюля «?» · `asterix()`; описание — текст скана. `infoText` — по аудиту: ДВА блока в порядке исполнения, без
  связки «then» (правило `.claude/rules/game-logic.md` § infoText).
- `CardName.POLITICAL_DONATION = 'Political Donation'` в секции `// Turmoil Redux`; строка манифеста с комментарием
  про значок Turmoil.

## 3. Блок B · клиент — ОДИН flow от руки до поля

**Целевой путь игрока (каждая строка — кадр приёмки §6):**
```
КАРТЫ В РУКЕ › ПОЛИТИЧЕСКОЕ ПОЖЕРТВОВАНИЕ › РОЗЫГРЫШ        композер: цена 4, «делегат: резерв 3 → 2»,
        │ A «Выбрать резолюцию»  (НИЧЕГО не отправлено)       строка шага «Резолюция — выбор в Парламенте»
        ▼ ритуал: карта ложится в «Разыграно» (~1.6 с + чтение, счётчики не тикают)
КАРТЫ В РУКЕ › ПОЛИТИЧЕСКОЕ ПОЖЕРТВОВАНИЕ › ГОЛОСОВАНИЕ      Парламент в зоне руки: три резолюции, прогноз,
        │ ◀ ▶ резолюция · LB/RB игроки · X осмотреть · L3 источник · B назад (в композер, всё цело)
        │ A «Разыграть карту»  → ЕДИНСТВЕННЫЙ POST [projectCard + payment, {party, stagedFor}]
        ▼ крошка янтарная, геометрия заморожена
  куб игрока: стопка РЕЗЕРВА на скамье → лента резолюции (счёт тикает на касании)
  нейтральные ×N: ПУЛ на скамье → места поддержки партии, по одному (место отвечает один раз)
        ▼ чтение → поверхность уходит ЦЕЛОЙ → поле
```

### B0 · Что уже есть — переиспользовать, не переписывать
- Парламент **host-agnostic и телепортируем**: `ConsoleParliamentSection` с `embedded` (`:49–70` — без шапки, остаётся
  скамья делегатов — физический источник кубов), один экземпляр (`ConsoleShell.vue:330–352`), цель —
  `workspaceFrameTarget('parliament')` (`:4266`). Рука хостит шаги (`WORKSPACE_KINDS.hand.hosts: 'inFlow'`,
  `consoleWorkspaceStack.ts:281–284`), её зона — `[data-embed-slot="hand-play"]` (`ConsoleHandSection.vue:369–372`,
  слой-стек `.con-hand__stage`).
- Режим голосования под ГРАНТ: `parliamentPromptBridge` → `bridge.grant` (`consoleParliamentModel.ts:717–738`),
  `armGrantVoteFlow` (`consoleParliamentFlow.ts:233`), `voteTile` / `benchSource` / `canVoteNow` под грант
  (`ConsoleParliamentSection.vue:531–567`), полёт куба `runDelegateCubeFlight`, снимок `voteSnapshot`, посадочный такт
  `VOTE_LANDING_MS`, крошка-хвост `DELEGATE_GRANT_STEP_STAGE = 'Voting'` (`consoleTaskRouter.ts:345`).
- Прогноз одного делегата по каждому слоту уже на модели: `ParliamentModel.viewer.vote.projections`
  (`server/parliament/ParliamentModel.ts:313–349`: `votesAfter`, `leaderAfter`, `becomesWinning`, `unlocksEffect`, …) —
  он читается ЖИВЫМ и при staged-шаге (у карты `count = 1`, совпадает).
- STAGED PLAY: `StagedPlayArm`, `PlayComposerDraft`, abort-батарея транспорта, `reconcileStagedPlayWorldMove`.

### B1 · Композер розыгрыша
Шаг `delegateGrant` = **дверь**, а не строка выбора: композер ничего не пре-собирает сам. CTA — навигационный глагол
**«Выбрать резолюцию»** (ключ `'Choose the resolution'`; образцы — «Разыграть на поле» `ui.json:538`, «Выбрать колонию»),
нижний бар говорит то же (один глагол — одно место, `playComposerFootHints`). В «РЕЗУЛЬТАТЕ»: чип делегата
«резерв N → N−1» + строка следующего шага «Резолюция — выбор в Парламенте» (имя шага, не догадка о результате).
Оплата — как у любой карты (`ConsolePaymentPanel`). Классификация шага — в ОДНОЙ функции (`playChoiceMode`,
`consolePlayCardComposer.ts:146`) и в страже `tests/models/consolePlayPreviewCoverage.spec.ts` (новый вид = не «gap»).
Payload подтверждения несёт `stagedVote` + `composerDraft` — по образцу `staged`.

### B2 · STAGED VOTE — третья ЦЕЛЬ одного staged-хранилища
- `StagedPlayArm` получает цель-резолюцию рядом с `placement` (ровно одна из двух; как оформить — `target`-union или
  второе поле — на усмотрение, но **хранилище одно**, `stagedPlayActive()` один, abort-батарея одна).
- Вход (ветка рядом с `:15003`): граница v1 та же — корень стека `hand` и спуск жив (`workspaceFrameDescended('hand')`).
  Иначе (старт ⊃ рука, standalone-полоса) — обычный submit, вопрос придёт живым грантом (B7).
- **Ритуал**: `beginStagedPlayLanding` как есть (фаза `executing` поглощает ввод; срыв = 'failed' → композер цел).
  Дальше вместо `yieldStackForStagedPlay()` — `pushWorkspaceFrame({kind: 'parliament', stage: DELEGATE_GRANT_STEP_STAGE,
  phase: 'configure', serves: [], anchor: {type: 'always'}, nest: workspaceFrameKnown('parliament')})`; кадр руки — фаза
  `configure` (обратимо). Прокси лежащей карты растворяется ВМЕСТЕ с приёмной сценой, пока из её rect раскрывается
  Парламент (RELEASE → UNFOLD → REVEAL; `v-if`-смена = блик = дефект). **Имя карты в крошке не пропадает ни на кадр**
  (субъект кадра руки держится от `arm.cardName`, а не от `pendingPlayCard`, который staged-вход обнуляет).
- **B в режиме** = один уровень: кадр Парламента снят, композер возвращён штатным entrance из `arm.draft`
  (`setPlayComposerStagedDraft`), оплата / фокус целы, фаза `configure`. Запросов не было — отменять нечего.
- **A в режиме** = коммит: `markStagedPlayCommitting()`, фазы `executing` (рука) и `committed` (кадр Парламента),
  `submitBatch([...arm.batch, {type: 'party', partyName, stagedFor: arm.cardName}])`. Двойное A поглощено фазой.
  `claimPlayOutcome` — взять (цепочка карты может добрать карту триггером); played-hero НЕ армить (ритуал уже сыгран).
- Отказ сервера / потерянный ответ — существующая батарея: назад в режим, выбор цел, B жив; `STALE_PROMPT` →
  форс-обновление. Мир сдвинулся под неотправленным staged — `reconcileStagedPlayWorldMove` без изменений правила.
- `actionBlockedReason` называет staged-голосование так же, как staged-размещение (одна причина, пока решение открыто).

### B3 · Режим голосования: синтетический промпт в ОДНОМ резолвере
Как `stagedPlayPrompt` подаёт синтетический `SelectSpace` в `placementSpaceModel`: staged-модель входит в
`parliamentPromptBridge` вторым источником и даёт тот же `bridge.grant` (`{model: staged.prompt, count, printed}` +
признак `staged` + `support`). Режим не знает двух кодовых путей — различия только четыре:
| | живой грант (Венера, B7) | staged-дверь карты |
| --- | --- | --- |
| A | «Отправить делегата» → `submitInput(grantResponse)` | **«Разыграть карту»** → `submitBatch` (B2) |
| B | «Свернуть» (обязателен, за коммитом) | **«Назад»** (обратим) |
| крошка-хвост | янтарный | **циан** до A, янтарный после |
| источник | «×N из резерва · бесплатно» | **«из резерва · по карте»** + запертая строка-квитанция «Карта · 4 M€» (итог оплаты композера; меняется только через B) |
Отправка — через ОДНУ воронку (`@send` → шелл): ветка staged рядом с `submitParliament` (`:13932`), не в компоненте.
**L3 «Источник»** публикуется в баре (X занят резолюцией — прецедент staged-досье тайлов); открывает карту поверх
режима, не размонтируя его. Команды — `parliamentCommandsOf` (`parliamentCommands.ts:113–124`): вход `grant` получает
`staged`. Никаких литералов кнопок (гард `glyphLiteralGuard`).

### B4 · «ЧТО ИЗМЕНИТСЯ» — панель режима (ради этого экрана задача и ставится)
Игрок, стоя курсором на резолюции, читает БЕЗ нажатий, в фиксированной геометрии (◀ ▶ = кроссфейд тел на месте):
1. **Слева — чтение резолюции** «ДЛЯ ВАС ПРИ ПРИНЯТИИ» + строка исходов по местам — как сейчас, не трогать.
2. **«ВАШ ГОЛОС»** — источник (таблица B3) и существующие факты `current → projected`: лидер, «принимается», эффект
   партии на ребре (`voteFactsOf`). Если этот делегат — второй на резолюции, факт доступа обязан гореть
   (`unlocksEffect`): это главный скрытый выигрыш карты.
3. **НОВОЕ — «НАРОДНАЯ ПОДДЕРЖКА» в блоке ПАРТИИ** (`con-parl__info-party`, `ConsoleParliamentVoteMode.vue:148–151`):
   три МЕСТА в словаре плашки (та же разметка сокетов, что `ConsolePartyPlaque` — общий под-компонент, не копия CSS):
   занятые · входящие (призрак-контур) · пустые, рядом `current → resulting` и хвост:
   `+3` (мятный) · `+1 из 3 · предел области` · `+2 из 3 · нейтральных в запасе: 2` (янтарный) · `+0 · область заполнена`
   (названный пропуск, спокойный регистр). Числа — только из `votePrompt.support` выбранной партии. Кикер — существующий
   ключ «Popular support». Блок — место ПОСАДКИ нейтральных кубов (B5), поэтому стоит всегда, пока дверь — с `support`.
4. **Скамья**: у резерва игрока пометка источника (как у гранта); **пул нейтральных тоже помечен источником**, когда
   `gained > 0` — два источника, два адресата, читается до нажатия.
5. **Осмотр (X)**: в группе «Ваш голос» инспектора (`resolutionPartyAnnotations(party, vote)`) — строка поддержки с тем
   же `current → resulting` и ПРАВИЛОМ словами (существующий ключ «Popular support becomes votes» `parliament.json:584`:
   нейтральные уйдут голосами на следующую резолюцию партии; на эту — нет). Проза живёт только здесь.
6. Всё — в чистой модели: `voteInfoModel.ts` получает `support?: SupportReadingVm` (+ строку в `voteInfoBudget` и лимит
   в `VOTE_INFO_LIMITS`), SFC только рисует. Гард `tests/client/components/console/voteInfoBudget.spec.ts` расширить
   осью «дверь с поддержкой»: слова и строки в бюджете на всём каталоге. Глоссарий — `parliamentGlossary.spec.ts`
   (третье лицо при субъекте-сопернике: поддержка партии — не «ваша», она ничья).
7. **Фит**: блок партии не растит панель (закон 8 — геометрия неизменна от A до ухода; закон «обзор стоит на месте»).
   Проверить `expectParliamentFits` + `console-parliament-vote-fit` на fhd / tv4k / Deck, включая стол на шесть мест.

### B5 · Посадка — два источника, два адресата, по очереди
После принятого ответа (снимок `voteSnapshot` держит до-голосовое состояние, пока куб в воздухе):
1. **Куб игрока**: стопка резерва (`[data-parl-seat-reserve]`) → лента резолюции — существующий полёт; счёт, лидер,
   бейдж «принимается» тикают на касании.
2. **Нейтральные ×`gained`**: `[data-parl-neutral-cube]` → места блока поддержки, **после** посадки куба игрока, по одному,
   ≥ 90 мс между кубами (ритм закона 12); счётчик пула «×N» убывает на ОТРЫВЕ, место заполняется на КАСАНИИ и отвечает
   один раз (`--landed`, one-shot до `animationend`); `gained === 0` — полётов нет, хвост «+0» остаётся.
3. Чтение (`VOTE_LANDING_MS`) → уход поверхности ЦЕЛИКОМ (законы 8 и 13: заморожена и цела, один motion директора) →
   staged завершён (`clearStagedPlay`), стек снят, поле. Настоящие сокеты плашки в обзоре потом просто стоят
   заполненными — второй анимации нет.
Каждый полёт — с ИЗМЕРЕННЫМ источником и адресатом, прокси в shell-слое `ConsoleParliamentFlightLayer` (рождается
невидимым, закон 14); нет rect → признаться (свидетель по образцу `noteDegraded` в `sittingDirector.ts:320` — атрибут
на корне, который e2e требует ОТСУТСТВУЮЩИМ), не «просто появиться». Длительности —
`motionMs()` / `MOTION_EASE`; именованные холды, освобождаемые касанием, не `setTimeout`. Reduced motion: конечные позы
сразу. Rail: `M€ −4` тикает на ответе (чип дельты по закону якоря) — отдельного полёта оплаты нет.

### B6 · Три честных исхода коммита (зеркало §9-quater)
| Ответ сервера | Признак | Поведение |
| --- | --- | --- |
| **LANDED** | у зрителя новый голос на выбранном слоте | B5 |
| **RE-ASKED** (хвост сброшен как устаревший) | `waitingFor` — грант с `choiceContext.source.card === arm.cardName` | тот же стоящий режим становится ЖИВОЙ дверью на месте (выбор цел, B = «Свернуть», крошка янтарная) — без закрытия / открытия |
| **PARKED** (вклинился чужой промпт) | карта в табло, нового голоса нет, `waitingFor` не наш | коммит реален: шаг уходит БЕЗ посадки (ничего не село — ничего не летит), чужой вопрос обслуживается своей поверхностью; после дренажа делегат и поддержка приходят обычным обновлением + журнал / нотификация |
Задание председателя, закрытое этим делегатом или самой картой, встаёт ПОСЛЕ посадки (гейт `BACK_OF_THE_LINE`):
проверить руками, что плашка «ПРЕДСЕДАТЕЛЬСТВО» не открывается поверх летящих кубов (admission `followUp`).

### B7 · Живая дверь (fallback) — довести до паритета с Венерой
Грант с `source.kind === 'card'` вне staged-пути (старт ⊃ рука, standalone, RE-ASKED, reload): общий код уже толкает кадр
Парламента в ближайший живой хост (`workspaceHostForStep()`, `:17060–17075`). Проверить и дошить для хоста-руки то, что у
колоний сделано через `colonyGrantStepLive` (`:7140`): рука не сворачивает спуск и не завершает flow, пока стоит или
ОЖИДАЕТСЯ этот шаг (`followUpStepOwed` `:7034`, `owed-step`); субъект крошки — карта; панель B4 читает ту же
`votePrompt.support` (одна форма на обе двери). Обобщать по `source.kind`, не копировать вычисление под второе имя.

### B8 · Лицо карты
`CardRenderItemType.NEUTRAL_DELEGATE` на премиум-лице не знает никто (`premiumCardIcons.ts:248` — только `DELEGATES`):
добавить строку + РЕАЛЬНЫЙ ассет тёмной фигурки (`assets/misc/`; `filter` в консоли вырезан paint-baseline'ом — CSS-затемнение
не нарисуется). Пилюля «?» — существующим узлом DSL, если он есть; новый тип рендера ради одной карты не заводить без
нужды — решение показать на кадре витрины. Гарды `premiumCardIcons.spec`, `premiumCardViewModel.spec` — ворклист.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: «Popular support», «Popular support
becomes votes», «Reserve», «Voting», «from the reserve», «No resolution is up for a vote», лог делегата
`'${0} added ${1} delegate(s) from the reserve to ${2}'`, лог поддержки (`:95`), «Send the delegate». Новые (ожидается ~10):
- `turmoil_redux_cards.json`: `"Political Donation": "Политическое пожертвование"` (**имя — решение владельца**);
  описание графики: «Добавьте делегата на резолюцию. Затем добавьте до 3 нейтральных делегатов в Народную поддержку
  партии этой резолюции.»
- `card_info.json`: что напечатает аудит (два блока) + короткий капшен, если гард потребует (бюджет 52 мерить по RU
  РУКАМИ — чеклист §2).
- причина: `"No delegate in your reserve": "В резерве нет делегатов"`.
- `console.json` / `parliament.json` (глоссарий!): `"Choose the resolution"` («Выбрать резолюцию»); глагол коммита —
  СУЩЕСТВУЮЩИЙ `"Play card"` («Разыграть карту», `ui.json:537`), второго ключа не заводить;
  `"from the reserve · by the card"` («из резерва · по карте»),
  `"Card"`-квитанция, хвосты поддержки (`"+${0} of ${1} · area limit"`, `"+${0} of ${1} · neutral supply: ${2}"`,
  `"area is full"`, `"no neutral delegates left"`), метка пропуска для `recordSkippedEffect`.
- `lore_texts.json` RU: `"Pray that it does not show up on social media.": "Молитесь, чтобы это не всплыло в соцсетях."`

## 5. Тесты
**`tests/cards/turmoilRedux/PoliticalDonation.spec.ts`** (стол — `testGame(2, {turmoilReduxExpansion: true,
coloniesExtension: true})`, три тихие резолюции через `seatResolution` / `quietResolutionOf`, как в спеке TR02):
метаданные; неиграбельность ×2 с точными причинами (куб в лобби + пустой резерв → причина про РЕЗЕРВ); розыгрыш →
промпт-грант с `choiceContext.source.card`, ответ → +1 голос из резерва, лобби цело, поддержка 0 → 3, запас −3, логи;
срез областью (поддержка 2 → 3, `limit: 'area'`), срез запасом, ноль → событие `effect-skipped` и карта сыграна;
нейтральные НЕ на текущей резолюции; второй делегат → доступ к эффекту партии; требование TR02 видит делегата; задание
`delegates` двигается; `previewSelectParty()` == живой промпт (паритет — заголовок, parties, маркер, контекст);
превью чисто (снимок состояния до / после).
**`tests/parliament/…`**: `popularSupportRoom` = `addPopularSupport` на сетке (область × запас × n); заседание не
изменилось. **`tests/inputs/deferredInputBatch.spec.ts` § addressed party**: прямая посадка; вклинившийся `or` →
парковка → авто-посадка дренажом; **`chairman-seat` перед своим промптом НЕ съедает хвост**; партия ушла из области →
сброс + живой вопрос; supersede; неадресованный `party` — как раньше. `tests/routes/PlayerInputBatch.spec.ts` — валидатор.
**Гарды чеклиста §3** — ворклист TR03 пуст, особо `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`,
`cardReasonConsistency`, `promptMarkerGuard`, `crossPlayerCoverageGuard` (соперник видит «сыграл карту · делегат на «…» ·
+N поддержки» с источником-картой), `skippedEffectRecord`; `make:cards` 0 / 0 / 0.
**Клиентские юниты**: `voteInfoModel` (поддержка: четыре хвоста, субъект-соперник), `voteInfoBudget`,
`consoleParliamentModel` (мост из staged-модели == мост из живого промпта), `parliamentCommands` (staged: «Разыграть
карту» / «Назад» / L3), `stagedPlay` (третья цель), `consolePlayCardComposer` (дверь, глагол CTA), `parliamentGlossary`.
**e2e — ОДИН спек на новую механику** `tests/e2e/console-political-donation.spec.ts`, фикстура `political-donation`
(`parliamentFixture` / `reduxTable`, имя в `FixtureName`): синий — карта в руке, ≥ 4 M€, резерв ≥ 2, куб в лобби; у
партии слота 0 поддержка 0, у партии слота 1 — 2 (синтетика ради кадра «предел области», пометить в комментарии).
Пробник — `MutationObserver` + `setInterval`, не rAF, с полом `samples`; правило трёх утверждений (источник виден,
адресат виден, движение было):
1. после «Выбрать резолюцию»: `gameAge` не сдвинулся, карта в руке на сервере, ни одного POST `/player/input*`;
2. крошка на КАЖДОМ сэмпле содержит корень и имя карты; хвосты только РОЗЫГРЫШ → ГОЛОСОВАНИЕ; `.con-parl` внутри
   `.con-hand` (телепорт), второго `.con-ws` нет;
3. панель: слот 0 — «0 → 3», слот 1 — «2 → 3» с хвостом предела; после ◀ ▶ бокс панели не изменился (rect);
4. B → композер с той же оплатой; снова вход; A → РОВНО ОДИН POST `input-batch`, хвост несёт `stagedFor`;
5. куб: из стопки резерва на ленту; сокет лобби занят до и после; затем N нейтральных из пула в места блока, по одному;
6. сервер по API: карта в табло, M€ −4, голос зрителя на выбранном слоте, `popularSupport`, `neutralSupply`;
7. конец на поле: нет `.con-ws`, нет stranded, 0 `[console-overflow]`, 0 ошибок страницы, `data-*-degraded` не появлялся.
Профили: fhd + tv4k (`test.use({viewport})`) — геометрия на одном разрешении = утверждение про одно разрешение.
`--repeat-each=4`, `waitForTimeout` = 0, `shardPlan.json` не править. Регрессия соседей: `console-staged-play`,
`console-colony-venus-redux`, `console-parliament-vote-fit|-geometry|-rivals|-leave`, `console-hand-workspace`.

## 6. Визуальная приёмка (fhd + один кадр 4K; свой сервер, своя папка `.e2e-tr03/`)
1. `?premiumCardsPlayground` (чип turmoilRedux) — лицо: 4, Марс, ряд «[делегат] · [нейтр.]×3 (?)*», без требования и ПО.
2. Композер: CTA «Выбрать резолюцию», чип резерва, строка шага; та же рука с пустым резервом — причина «В резерве нет
   делегатов».
3. Середина ритуала (карта на стопке «Разыграно») и кадр перехода: Парламент раскрывается из той же зоны, крошка с
   именем карты.
4. Режим на резолюции с «0 → 3» и на резолюции с «2 → 3 · предел области»; источники на скамье помечены.
5. Посадка: куб на ленте, нейтральные в воздухе / в местах, крошка янтарная.
6. Осмотр (X) со строкой правила поддержки; L3 — карта поверх режима.
Приложить покадровую раскладку перехода 3 (скринкаст CDP, см. память о кинематографических кадрах) — блик между
приёмной сценой и Парламентом считается дефектом.

## 7. Режим работы
**4 коммита**, каждый зелёный по юнитам: (1) сервер-контракт — `popularSupportRoom`, расширения общего шага,
адресованный `party`-хвост + спеки; (2) карта + шаг превью + спеки + локаль + арт + лор + значок нейтрального;
(3) клиент — staged vote, мост, панель «что изменится», посадка, живая дверь + юниты; (4) e2e + фикстура + документы.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной
проверкой `npm run make:css` + `npm run build:server` (не голый `tsc`). **Не пушить.**
**Документ карты ЗАВОДИТЬ** — `docs/TURMOIL_REDUX_POLITICAL_DONATION.md`: контракт «у голосования три двери и одно
тело», STAGED VOTE (адрес хвоста, три исхода), `votePrompt.support` и блок поддержки — их наследуют следующие карты
набора с делегатами. Известная граница — записать: серверные проекции считаны для ОДНОГО делегата
(`pendingDelegateGrantCount` читает живой промпт) — карта с «×2» обязана сперва провести `count` в staged-проекцию.
Дополнить: `docs/TILE_PLAY_STAGED_COMMIT.md` (§ третья цель), `.claude/rules/console-ui.md` (закон 22 парламента — одним
абзацем), чеклист набора §4 (строка «карта ставит делегата → общий шаг + `delegateGrantStep`»), журнал набора (что
нового, решения владельца, гэпы). Гочи: `python3` — заглушка Store; юниты последовательно; `eqeqeq` без исключения для
null; новая карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в манифесте и чинить
классом; MarsBot × Venus Redux — известное, отложено, не поднимать; чужой `webpack --watch` переписывает `build/`.

В отчёте: сигнатуры `popularSupportRoom` и расширенного шага; форма `StagedVoteModel` и адресного правила; как устроена
третья цель staged-хранилища; шесть кадров + раскадровка перехода; результат e2e 5/5 на двух профилях; что напечатали
гарды до / после; новые ключи i18n; **явно — всё, что не получилось сделать по этому промту, и почему** (не «гэп на
потом» молча).

## 8. Нельзя
Отправлять что-либо до A в режиме голосования. Авто-выбор резолюции (даже единственной). Дайл количества поддержки.
Тратить куб лобби. Ставить нейтральных на текущую резолюцию. Второй `SelectParty` / свой `placeVote` в файле карты.
Считать поддержку на клиенте. Позиционный (неадресованный) `party`-хвост у staged-двери. Второе staged-хранилище,
вторая копия Парламента, второй режим голосования, копия разметки сокетов. Детект по тексту заголовка. Шапка /
кикер у встроенного Парламента (этап отдаётся ВВЕРХ). `v-if`-смена сцен, пустой кадр, прокси без измеренного адресата,
холд на `setTimeout`. Возврат в композер после коммита, played-hero после выплаты. Литерал кнопки. `filter` /
`text-shadow` как носитель состояния. `compatibility: 'turmoil'`. Трогать незакоммиченные файлы соседа, `shardPlan.json`.
Пуш и красные коммиты.
