# Промт исполнителю · TRP0 Corridors of Power («Коридоры власти») — ЗАМЕНА набора Turmoil Redux для классической P47, ПЯТНАДЦАТАЯ строка ворклиста Prelude 2 и ЕДИНСТВЕННАЯ в нём замена (`docs/PRELUDE2_ADAPTATION.md` §3.2; контракт замен — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 с поправками на прелюдию): ПРЕЛЮДИЯ с ДЕЙСТВИЕМ (апстримный `ActivePreludeCard` — TRP8 Aerospace Company), метка Земли; розыгрыш — «+4 M€»; действие — «добери 1 карту за каждую РЕЗОЛЮЦИЮ, на которой у тебя не меньше 2 делегатов» (скан: «→ [карта] / [делегат][делегат]*», звёздочка — сноска «не меньше 2»). Классическая P47 («+1 РТ, +4 M€; эффект: когда становишься лидером партии — добери карту», хук в классическом `Party.ts`) под Redux НЕ раздаётся НИКОГДА: «адаптация» = авторство замены (`CORRIDORS_OF_POWER_REDUX`), классика — в `cardsToRemove` и вне скоупа навсегда · РАБОТА КАРТЫ (≈ 35 %): класс замены-прелюдии (первый `kind: 'prelude'` реестра, номер TRP0 — напечатан на скане), счётный добор с базисом ПАРЛАМЕНТА (новый термин счёта через фасад `game.politics`, «РАСЧЁТ» называет резолюции), пустой счёт — честное «без эффекта», лор, арт классики через `reimplements`, спек · ПОЛИРОВКА (≈ 65 %) — «РАЗВЁРТЫВАНИЕ ПРОЛОГОВ — ОДНИМ ВЗГЛЯДОМ»: экран «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ», с которого начинается каждая партия и на котором эта прелюдия впервые встречает игрока, — сейчас две маленькие карты в огромной пустоте, чтение «что даст / сгорит ли / что ответит стол» есть только у сфокусированной карты в нижней полосе, на полке — пунктирная коробка-заглушка

> **Статус: ВЫДАН 2026-10-31.** HEAD `5069f0f295` (P74 СДАНА — множитель бонуса одним механизмом + «×N» на клетке, раздел **DD**; P73 СДАНА — раздел **DC**; ворклист **14 / 54**;
> журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись ПЯТНАДЦАТАЯ). **Вопросов владельцу эта задача НЕ задаёт**: все решения ниже приняты (композиция сцены — тоже, §4);
> `AskUserQuestion` — только exit 2/3/4 бокса или ветка позади при пуше.
> **СОСЕДИ**: в момент выдачи рабочее дерево чисто (кроме `package*.json`), но `ListAgents` показывал три сессии — ПЕРВЫМ ДЕЛОМ `ListAgents` + `git status`; `SendMessage` занятым со списком
> твоих файлов (§0) — особенно **`ConsoleStartScene.vue`** (8915 строк — общий хост старта), `start_screen.less`, `consoleStart.ts` / `generate.ts` (свой объявленный ханк), `PoliticalOps.ts`,
> `Counter.ts`, `actionPreview.ts`. `package.json` / `package-lock.json` (`MM`) — не твои.
> Образцы: **`turmoilRedux/AerospaceCompany.ts`** (TRP8 — прелюдия с ДЕЙСТВИЕМ: `ActivePreludeCard`, `compatibility: 'prelude'`, `cardNumber: 'TRP8'`, `infoText action-short`, спек по правилам 1–7,
> стенд `console-aerospace-company.spec.ts` — клетка A «старт: без «СГОРИТ», без вопроса, прелюдия ложится на «РАЗЫГРАНО» неиспользованной», фикстура в `generate.ts`), **`turmoilRedux/AerialLensesRedux.ts`**
> (замена: имя `:redux`, `reimplements`, арт и лор КЛАССИКИ под классическим номером, шапка «SCAN READING»), `turmoilRedux/MedicalInstitute.ts` (TRP9 — прелюдия-реактор; добор одной картой),
> `turmoilRedux/ResearchStartups.ts` (счётный добор действия), промт `prelude2-p85-summit-logistics.md` (базис счёта с РЯДОМ значков — класс CR `tags`), `prelude2-p69-cloud-tourism.md` (базис-набор CV),
> `docs/claude/console/futile-actions.md` (вердикт «без эффекта» — сервера, информация, не блок), `docs/claude/console/card-intake-one-batch.md` (добор N — один забор).
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P47.png` (**проверено: 1536×1024** — скрипт примет без `--force`; импортировать ПОД КЛАССИЧЕСКИМ номером `P47` — §3.2 п. 4).
> Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Preludes\Replacement - Corridors of Power.png`.
> Лор — СО СКАНА, дословно: «Controlling the flow of information and funds.» (точка напечатана); ключ `P47` в `lore_texts.json` (классического лора P47 в файле НЕТ — проверено grep) + RU.
> Реестр: последний раздел **DD** (P74), последний номер **PL-1244** → эта задача берёт **DE**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p47` → `npm run e2e:remote -- p47 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`); стенд карты — FUNCTIONAL; сцена
> прологов — ТРИ профиля (fhd · tv4k · deck); раскадровка — TV (`TM_E2E_STORYBOARD=1`).
> **Коммит — сам по окончании каждого шага, явными путями (`git commit -- <paths>`; новый файл — сначала `git add -- <path>`); сразу после коммита — пуш.**

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§2.4 «конец костыля», **§3.2 п. 1–4**, §2.5, §4, §5), **`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 п. 1–5а** (имя-ключ, регистрация + `cardsToRemove`, ТЕМ ЖЕ диффом
строка долой, номер и арт / лор классики через `reimplements`, reserved-гард, скоуп и пикер), `docs/claude/prelude2-cards-progress.md` (P76…P74 — не переоткрывать), `docs/claude/turmoil-redux-card-checklist.md`
§0, §3, §7, `docs/claude/parliament-glossary.md` («резолюция», «область голосования», «делегат», «РАСЧЁТ» — гард `parliamentGlossary`), `docs/claude/console/start-first-action.md`, **`docs/claude/console/start-flow-motion.md`**
(стадия меняется НЕ на нажатии; полка следует за картами одним тиком; «destinations are measured, never assumed» — §3 prewarm; `Card3DInner`), `docs/claude/console/start-director.md` (фаза 0 «тень» — защёлки не
трогать), `.claude/rules/console-ui.md` § PAD OWNERSHIP FOLLOWS THE SURFACE (`promptOutranksStartScene`), § A STATUS LINE NEVER REPEATS THE FACE, § VISUAL RESTRAINT, § THE HAND is an ALBUM (размер карты
решается из коробки, не из числа карт), § A CARD PLAY'S RESULT BELONGS TO THE WORKSPACE (start ⊃ hand), CLAUDE.md инварианты 2, 4, 9, 11, 14, 15. Память: `rules-first`, `upstream-spec-encodes-upstream-rules`,
`e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `start-polish-reliability-1` (защёлки старта не трогать, пока тень не согласна), `proteus-start-shelf-reactor` (API-сид старта не держит workspace),
`commit-at-end-of-work`, `push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `trivial-card-prompts-no-owner-questions`, `visual-restraint-no-glow`, `prelude2-adaptation`, `turmoil-redux-classic-cards`.

**Образцы — по частям.** Классика: `prelude2/CorridorsOfPower.ts` (`PreludeCard`, `[EARTH]`, `tr: 1`, `stock.megacredits: 4`, рендер «эффект: лидер партии → карта», `cardNumber: 'P47'`, «Behavior in Party.ts» —
классический хук, НЕ переносить), манифест `Prelude2CardManifest.ts:92` (`compatibility: 'turmoil'`), RU-имя «Коридоры власти» (`ru/prelude_cards.json:50` — `translateText` откатывает `Name:redux` на него сам,
ключ-дубль не заводить). Замены: **`common/cards/turmoilReduxReplacements.ts`** (`ClassicReplacement {classic, kind: 'project' | 'corporation', scan, changes}`; `replacementCardNumber` — проекты 71…76, корпорация 77;
`TURMOIL_REDUX_REPLACED_CLASSIC_NAMES`), **`common/cards/prelude2Adaptation.ts:92–99`** (`PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT = [CORRIDORS_OF_POWER]` → входит в `PRELUDE2_CARDS_HELD_BACK`), **`common/cards/premiumScope.ts:52–62`**
(`case 'turmoil'` — замещённая классика вне скоупа по реестру; `case 'prelude2'` — ТОЛЬКО по hold-back-списку → снятая строка вернёт классику P47 В СКОУП — дыра, решение 2), `TurmoilReduxCardManifest.ts:437–480`
(`preludeCards` TRP1…TRP9, `cardsToRemove`), гарды `tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts:61–135` («every prelude carries TRP#», «TR71…TR76 / TR77 / TR78…TR85», «a number past TR70 is a
replacement's», «every authored replacement removes its classic card»), `tests/cards/turmoil/TurmoilReplacementsUnderRedux.spec.ts:105–106` (фильтры по `kind`), `tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts`
(«a replacement that crossed stands in cardsToRemove»), `premiumScope.spec`, `devGuaranteedCards.spec`, `deckComposition.spec` (счёт прелюдий Redux). Действие: `prelude2/ActivePreludeCard.ts` (`canAct` →
`canExecute` + `bespokeCanAct`; `action` → `execute`), `behavior/Behavior.ts:120` (`drawCard?: number | DrawCard` — `count` счётный), **`behavior/Countable.ts`** (`_Countable`: `tag`, `cities`, `oceans`, `tiles`,
`colonies`, `moon`, `underworld` — термина ПАРЛАМЕНТА нет), **`behavior/Counter.ts:247–256`** (`colonies` — «ONE reading … the parliament's counted term share it»), **`politics/PoliticalOps.ts:127–140, :238–262, :346`**
(`partiesLedBy` — Redux: слоты области голосования по `leaderOf`; классика — партии; `leadershipStanding`), `parliament/Parliament.ts:372–384` (`votesOf(player, slot)` — свои кубики слота),
**`models/actionPreview.ts:424–470`** (`countableBasis` — термин на каждый ключ `_Countable`: `tags` рядом значков (CR), `parts` (TR45)), `common/models/ActionPreviewModel.ts:303–362` (`ActionEffectBasis`: `tag` /
`tags` / `wild` / `parts` / `excluded` / `set`), клиент «РАСЧЁТ» — `ConsoleCountedWhy.vue` (найти grep `CountedWhy`), `models/actionFutility.ts` (`declaredFutility`: «a `tr` / `addResources` / `stock` / `production` of
exactly 0» — `drawCard` 0 ПРОВЕРИТЬ, вероятно не судится → `zero-yield` с причиной), `cards/actionFutilities.ts` (`zeroYield`), `card-intake-one-batch` (добор N одним забором — `deckDraw`). Сцена прологов:
**`ConsoleStartScene.vue:445–470`** («THE DEPLOYMENT — one row, three physical places»: `__queuecol` → `__queue` → `transition-group .con-start__queue-row` → `.con-start__qcard` с `order` (корпорация 1 · купленные 2 ·
прологи 5), классы `--focused / --armed / --enabler / --awaiting`), `:478` («THE A PILL IS ALSO THE RISK STAGE'S FACE»), `:569–610` (сцена риска — абсолютно над слэком колонки; «РЕЗУЛЬТАТ» потери эффекта),
`:610` («THE COMPACT PLAYED DESTINATION — «РАЗЫГРАНО · owner»»), `:931–1040` (пинная полоса статуса: доступность сфокусированной карты `:999`, «Сработает» `:967`, быстрая сводка `:1024`), `:1042` (док выбора),
**`src/styles/start_screen.less`** (блоки `__deploy`, `__queuecol`, `__queue`, `__qcard`, `__played`, `__shelf` — найти), `console/startDirector.ts`, `startStageDirector`, `startBoardExcursion.ts`; стенды —
`console-start-motion.spec.ts:159` («a stage never opens before its cards have left, and no summary card teleports»), `start-shelf-art.spec.ts:50` («a card covered on the start shelf still shows its picture»),
`console-start-summary-fit`, `console-start-availability`, `console-prelude-burn-gate`, `console-start-prompt-pad`, `start-scene-profiles`, `console-aerospace-company` (клетка A); **хуки сцены старта
(`con-start__pill` / `con-start__queue*`) читают 16 e2e-спеков** — контракт 14: классы / `data-*` не переименовывать. Кадры «как сейчас»: `screenshots/aerospace/tv4k-a1-queue.png` (две прелюдии в пустоте, пилюля A,
пунктирная коробка «ПРОЛОГИ» на полке, чтение только у сфокусированной внизу), `tv4k-a2-played-shelf.png`.

---

## Диагноз (подтверждён файл:строка на `5069f0f295`; перепроверить на своём HEAD)

### Замена
1. **Класс замены-прелюдии не существует.** Реестр знает `kind: 'project' | 'corporation'`; `replacementCardNumber` считает TR71…77 по видам; гард манифеста «every prelude carries TRP#» и «a number past TR70 is a
   replacement's» — две семьи номеров; `PRELUDE2_ADAPTATION.md` §3.2 п. 2: «номер — решить при авторстве». Скан печатает **TRP0** — в отличие от проектов («TR00» — заглушка) это ЗАНИМАЕМЫЙ номер семьи прелюдий
   (TRP1…TRP9 заняты, TRP0 свободен). → Решение 1.
2. **Снятие строки откроет классику.** `inPremiumScope` `case 'prelude2'` читает ТОЛЬКО `PRELUDE2_CARDS_HELD_BACK`; §3.2 п. 4 обещает чтение реестра «после удаления списка» — но строка уходит СЕЙЧАС, и классическая
   P47 (которую Redux-стол не раздаёт) попадёт в скоуп ≈ 30 гардов как «адаптированная» без адаптации. → Решение 2 (чтение реестра — уже сейчас, обе ветки).
3. **Чтение скана (§0):** малиновая плита PRELUDE; справа вверху — Земля (метка); арт — дворцовый коридор; плашка ACTION: «→ [карта] / [делегат][делегат]*», текст «(Action: Draw 1 card for each RESOLUTION you have
   at least 2 delegates on.)»; «TRP0»; плашка TURMOIL REDUX; внизу «[4 M€] (Gain 4 M€.)»; лор курсивом; слева — ромб модуля. НЕТ: РТ (классический +1 РТ ушёл), эффекта «лидер партии → карта» (стал ДЕЙСТВИЕМ со счётом).
4. **Правила действия (свод Redux / FAQ).** «Резолюция, на которой у тебя ≥ 2 делегатов» = слот ОБЛАСТИ ГОЛОСОВАНИЯ с ≥ 2 СВОИХ кубиков (`votesOf(player, slot)`; нейтральные — нет; лобби / кресло / резерв — нет;
   принятая резолюция — кубики ушли домой на принятии, слот не в `slots`). Счёт 0 → действие ничего не добирает: по закону `futile-actions` оно ДОСТУПНО (бесплатно, может стоять в очереди) и несёт вердикт
   `zero-yield` с причиной «нет резолюции с 2 вашими делегатами» — не скрыто, не заблокировано, RT-значок белеет, когда все действия бесполезны.
5. **Нет термина счёта.** `_Countable` не знает Парламента → `drawCard: {count: …}` невыразим декларативно; bespoke-счёт без `countableBasis` оставит «РАСЧЁТ» пустым (P85 CR: голая пилюля — дефект). Термин через
   ФАСАД `game.politics` (Redux — слоты; классика — партии с ≥ N своих делегатов; без политики — 0), базис называет РЕЗОЛЮЦИИ (эмблема партии + «2 / 3» своих кубиков) — класс (решение 3).
6. **Старт.** Прелюдия с действием на старте — форма TRP8: без ворот розыгрыша не «сгорает»; розыгрыш — +4 M€ (награда прелюдии — жетоны с лица на полке → рельс, как у TRP1 / TRP4); действие доступно с первого
   поколения (область голосования пуста от своих кубиков → «без эффекта» честно, пока не проголосуешь). Proteus читает метку Земли как любую прелюдии. MarsBot прелюдии не получает.

### Сцена «СТАРТ ПАРТИИ › ПРОЛОГИ › РОЗЫГРЫШ» (кадр `aerospace/tv4k-a1-queue.png`)
- **S1. Карты в пустоте.** Две прелюдии ≈ 27 % высоты полосы по центру; колонка очереди занимает всю ширину, но размер карты не решается из коробки (альбом руки решает размер из бокса + сетки — здесь нет); между
  очередью и полкой — пустота в половину экрана. С одной прелюдией (a2) — одинокая карта того же размера.
- **S2. Чтение — только у сфокусированной.** Доступность («Можно разыграть» / «СГОРИТ» / «НЕТ ЦЕЛИ») и «⚡ Сработает: +3 M€» живут в нижней полосе для ОДНОЙ карты; сравнить две прелюдии («какую первой? какая
  сгорит без другой?») можно только переводя фокус. Лицо карты печатает свой эффект — его повторять нельзя (§ STATUS LINE), а вот ВЕРДИКТ и ОТВЕТ СТОЛА лица не печатают — они и есть «что сказать под каждой».
- **S3. Заглушка на полке.** «ПРОЛОГИ» — пунктирная пустая коробка с заголовком без числа («состояние, которому нечего сказать, не рендерит ничего» — но место посадки НУЖНО полётам: полка следует за картами одним
  тиком, назначения измеряются). Коробка с пунктиром читается как «тут должно что-то быть, а нет».
- **S4. Пилюля «A РАЗЫГРАТЬ» под сфокусированной картой** — мелкая (на 4K ≈ 0.6rem), конкурирует с баром, который говорит то же; она же — лицо сцены риска (`:478`) — трогать осторожно (один A на экране).
- **S5. Герой.** Сфокусированная карта отличается от соседки только кантом; «одна героиня на экран — размером и весом» (VISUAL RESTRAINT 4) не выполняется.

## Правила карты (спек пинит каждое)
1. ПРЕЛЮДИЯ (`ActivePreludeCard`), `CardName.CORRIDORS_OF_POWER_REDUX = 'Corridors of Power:redux'`, метка Земли, без цены / ПО; `cardNumber: 'TRP0'`; `metadata.reimplements: CardName.CORRIDORS_OF_POWER`;
   Redux-манифест `preludeCards`, `compatibility: 'prelude'`; `cardsToRemove` += `CORRIDORS_OF_POWER`; классика под Redux не раздаётся (`GameCards.filterReplacedCards`), под классикой цела.
2. Розыгрыш: +4 M€ (`behavior.stock.megacredits: 4`), ничего не спрашивает, не сгорает (нет ворот).
3. Действие: добери N карт, N = число слотов области голосования с ≥ 2 своих делегатов (нейтральные / лобби / кресло / резерв не считаются); N = 0 → доступно, вердикт `zero-yield` с причиной; добор N — ОДИН забор.
4. Превью = исполнение: чип «+N [карта]» с базисом Парламента (резолюции: эмблема партии + свои кубики «2 / 3», счёт N), read-only; «РАСЧЁТ» композера рисует резолюции рядом; при N = 0 — чип «без эффекта» + причина.
5. Классика P47 — вне премиум-скоупа и дев-пикера НАВСЕГДА (реестр); замена — в скоупе `turmoilRedux` и в пикере под ним; `deckComposition` — +1 прелюдия Redux; save / load — обычная карта; MarsBot — никогда.

### Решения — ПРИНЯТЫ (вопросов владельцу НЕ задавать; в отчёте — что сделано по каждому)
1. **Номер и реестр** — `kind: 'prelude'` в `ClassicReplacement`; `replacementCardNumber` для `'prelude'` возвращает `'TRP0'` (напечатан на скане; семья прелюдий, а не TR7x); строка реестра: `classic: CORRIDORS_OF_POWER,
   kind: 'prelude', scan: 'Preludes/Replacement - Corridors of Power.png', changes: 'still a Prelude, Earth tag; +1 TR is gone, 4 M€ stays; the «each time you become party leader, draw 1 card» effect becomes an
   ACTION: draw 1 card per resolution of the voting area holding 2+ of your delegates'`; гарды манифеста — «TRP0 — замена ровно своей строки, `reimplements` классики, имя `:redux`», семья TRP# = TRP0…TRP9,
   `cardsToRemove` = классика всех авторизованных замен (теперь 8); `TurmoilReplacementsUnderRedux.spec` — третий фильтр `kind === 'prelude'`.
2. **Скоуп читает реестр УЖЕ СЕЙЧАС** — `inPremiumScope` `case 'prelude2'`: `!HELD_BACK.has(name) && !TURMOIL_REDUX_REPLACED_CLASSIC_NAMES.has(name)`; `PRELUDE2_CARDS_AWAITING_REDUX_REPLACEMENT` → `[]` (константа
   остаётся до конца костыля, §2.4 — удалить вместе со списком); гард `Prelude2CardsHeldBack` — «замена, пересёкшая список, стоит в `cardsToRemove` И в реестре» — зелёный только всем вместе; `premiumScope.spec` /
   `devGuaranteedCards.spec` — строка P47 (классика вне, `:redux` внутри под `turmoilRedux`).
3. **ТЕРМИН СЧЁТА ПАРЛАМЕНТА** (класс, раздел DE): `_Countable.delegates?: {resolutionsWithAtLeast: number}` → `Counter` читает `game.politics?.resolutionsWithDelegates(player, n) ?? 0` (новый метод фасада:
   Redux — слоты с `votesOf(player, slot) ≥ n`; классика — партии с ≥ n своих делегатов — `Party.delegates`; спек обоих движков); `countableBasis` — термин `{count, label: 'Resolutions with ${0}+ of your
   delegates', resolutions: [{resolution, party, votes}]}` (новое поле `ActionEffectBasis.resolutions`, порядок — области голосования); клиент `ConsoleCountedWhy` рисует ряд: эмблема партии + «2 / 3» (свои / все
   кубики слота), нули — слот с < n своих — в `excluded`-манере (назван, не посчитан), чтобы число сходилось с тем, что игрок видит в Парламенте; RU ключи по глоссарию. Действие карты — ДЕКЛАРАТИВНО:
   `action: {drawCard: {count: {delegates: {resolutionsWithAtLeast: 2}}}}` — превью, вердикт, забор даром.
4. **Пустой счёт — вердикт, не блок**: `declaredFutility` судит `drawCard` со счётным `count` = 0 как `zero-yield` (причина — термин базиса словами: «Нет резолюции с 2 вашими делегатами»); композер — чип «без
   эффекта», RT-значок — по закону; `canAct` — `true` (бесплатное действие прелюдии; `mustHaveCard`-подобных ворот нет).
5. **Арт и лор** — `node scripts/import-card-art.mjs "…\Mars Arts\P47.png" P47` (классический номер; у классики P47 арта не было — теперь есть и у неё, это нормально: замена берёт через `reimplements`); лор ключ `P47`:
   EN со скана, RU — «Контроль над потоками информации и денег.»; своих `TRP0.webp` / ключа `TRP0` НЕ заводить. RU-имя — наследуется («Коридоры власти»). `infoText action-short` — если подпись действия длиннее
   52 симв. (гард `actionCaption`): «Draw 1 card per resolution with 2+ of your delegates».
6. **Свой e2e-стенд — ДА**, `tests/e2e/console-corridors-of-power.spec.ts`, фикстуры: **`corridors-start`** — рецепт стартовой фикстуры TRP8 (`consoleStart.ts` / `generate.ts` `aerospace-company`): очередь из двух
   прелюдий (TRP0 + обычная), корпорация выбрана; **`corridors-action`** — `parliamentFixture(…, {stopAt: 'vote'})`: у p1 2 кубика на X, 2 на Y, 1 на Z (резерв позволяет: 7 − лобби), TRP0 на столе → N = 2;
   **`corridors-futile`** — TRP0 на столе, свои кубики: 1 на X, 0 на остальных → N = 0. Клетки: (1) старт — очередь: под TRP0 — вердикт «Можно разыграть», под соседкой — её вердикт / «Сработает» (§4), A → прелюдия
   ложится на «РАЗЫГРАНО», 4 M€ с лица в ряд M€ (тик на касании), без «СГОРИТ», без вопроса, ОДИН POST; (2) `-action` — «ДЕЙСТВИЯ КАРТ › КОРИДОРЫ ВЛАСТИ › НАСТРОЙКА»: чип «+2 [карта]», РАСЧЁТ — эмблемы X и Y с «2 / N»,
   Z назван как не посчитанный; A → ОДИН POST → ОДИН забор двух карт (стопка → рука, `card-intake-one-batch`); (3) `-futile` — плитка в «ДЕЙСТВИЯ КАРТ» с «БЕЗ ЭФФЕКТА · Нет резолюции с 2 вашими делегатами», в
   композере чип «без эффекта», действие ДОСТУПНО; (4) Информация / осмотр X — лицо TRP0 с артом P47 и лором. Сервер — счётчики, рука, `votesOf`.
7. **РАЗВЁРТЫВАНИЕ ПРОЛОГОВ — ОДНИМ ВЗГЛЯДОМ** (§4 — композиция ПРИНЯТА, исполнять).
8. **Журнал серии / доки / реестр** — §7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` (кроме +1 прелюдии Redux в счётном пине) / Автома — НЕ эта задача.

## 0. Рабочее дерево
1. `git log --oneline -3`; `ListAgents`; `git status`. `SendMessage` занятым: твои файлы — замена (НОВЫЙ `turmoilRedux/CorridorsOfPowerRedux.ts` + спек, `CardName.ts` — одна строка, `TurmoilReduxCardManifest.ts`
   (строка `preludeCards` + `cardsToRemove`), `turmoilReduxReplacements.ts`, `prelude2Adaptation.ts` (строка долой), `premiumScope.ts`, гарды реестра / манифеста / скоупа, `lore_texts.json` + RU, арт P47, `src/genfiles/*`),
   класс (`behavior/Countable.ts`, `Counter.ts`, `politics/PoliticalOps.ts`, `models/actionPreview.ts`, `models/actionFutility.ts`, `common/models/ActionPreviewModel.ts`, `ConsoleCountedWhy.vue` + спек, `ru/console.json`),
   сцена (`ConsoleStartScene.vue` — ТОЛЬКО блок `__deploy` / `__queue` / полка «РАЗЫГРАНО» и пинная полоса, `start_screen.less` — их блоки, `console_tv.less` — их строки), фикстуры (`generate.ts` / `consoleStart.ts` —
   объявленные ханки), стенды, доки, журнал, реестр. **НЕ трогать**: режиссёры старта (`startDirector`, `startStageDirector`, `startBoardExcursion`, teleport сводки, FLIP-переходы стадий), защёлки старта.
2. e2e — только бокс; `FIXTURES=corridors-start,corridors-action,corridors-futile npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — замена и класс (≈ 30 %)
- Реестр / номер / скоуп (решения 1–2); класс `CorridorsOfPowerRedux` по форме TRP8 (шапка «SCAN READING» + RULE READINGS 1–7); термин счёта + базис + вердикт (решения 3–4); арт / лор (решение 5); `make:cards` 0 / 0 / 0;
  `make:json`.
- **Спек карты** (`tests/cards/turmoilRedux/CorridorsOfPowerRedux.spec.ts`, форма TRP8): правила 1–5 по одному `it` — печать и регистрация, классика не раздаётся под Redux (и раздаётся под классикой), розыгрыш +4 M€ без
  ворот, счёт N (0 / 1 / 2; нейтральные не считаются; кубик в лобби не считается; принятая резолюция не считается), один забор N, вердикт при 0 (`actionFutility` → `zero-yield` + причина), превью с базисом (резолюции
  в порядке области, исключённые названы), read-only, Proteus читает метку Земли, save / load, MarsBot — никогда. Спек фасада `PoliticalOps` § resolutionsWithDelegates (оба движка), `Counter.spec` § delegates,
  `actionPreview.spec` § basis resolutions, `actionFutility.spec` § counted draw of 0.

## 2. Клиент — карта (≈ 5 %)
Даром (проверить «до»): плитка действия, забор N, «без эффекта» (после решения 4), лицо с артом / лором классики. «РАСЧЁТ» — решение 3.

## 3. «ДО» — первым делом
Раскадровка «ДО» сцены прологов ×3 профиля: очередь из 1 / 2 прелюдий (+ купленные проекты — стенд `console-start-summary-fit` с покупкой), одна из прелюдий «сгорит» (`console-prelude-burn-gate`), фокус на каждой.
Свидетель (§4.6) «до» — таблица.

## 4. ГЛАВНОЕ — «РАЗВЁРТЫВАНИЕ ПРОЛОГОВ — ОДНИМ ВЗГЛЯДОМ» (решение 7) — композиция
**Цель:** первый экран каждой партии читается одним взглядом — ЧТО лежит в очереди, какую карту можно разыграть, какая сгорит и почему, что ответит стол, куда ляжет; одна героиня по размеру; ничего не прыгает,
пока фокус ходит. Движение стадий (RELEASE → UNFOLD, полёты на полку) — НЕ трогать: только статическая композиция очереди и чтение под картами.
1. **РАЗМЕР КАРТЫ — ИЗ КОРОБКИ (S1).** Размер карты очереди решается из коробки колонки очереди и числа карт (как альбом руки: бокс + ряд, потолок — натуральный кадр × uiScale; 1–4 карты в ряд, 5+ — второй
   ряд или уменьшение по солверу), чистая функция рядом с `consoleHandAlbum` (`startQueueLayout(box, n, profile)` → размер, зазор), спек; очередь центрирована по вертикали колонки; полка «РАЗЫГРАНО» остаётся на
   своей строке (её коробка — цель полётов, измеряется — не меняется). Сцена риска по-прежнему абсолютно над слэком колонки (проверить, что слэк остался; если слэка нет при большой карте — сцена риска встаёт
   над чтением карты §4.2, не двигая её).
2. **ЧТЕНИЕ ПОД КАЖДОЙ КАРТОЙ (S2).** Под каждой картой очереди — ОДНА тихая зарезервированная строка (высота постоянна, пустая — пустая): ВЕРДИКТ словом (`availability` того же блока, что читает пинная полоса для
   сфокусированной: «Можно разыграть» · «Сгорит — нет цели» · «Ждёт: <прелюдия>» для `--enabler`) + «⚡ +3 M€» (ответ стола из превью — только если есть). Никаких фактов лица (эффект, метки, цена). Сфокусированная
   карта сохраняет пинную полосу (там — полная формула и быстрая сводка). Строки не анимируются при ходьбе фокуса (меняется только кант / размер героини); текст — пол ТВ-типографики.
3. **ПОЛКА БЕЗ ЗАГЛУШКИ (S3).** Пустое место прелюдий на полке — тихий СОКЕТ (контур одной линией в тоне полки, без пунктира, без заголовка-счётчика «0»): заголовок «ПРОЛОГИ» появляется с первой картой или стоит без
   числа; коробка сокета — ТА ЖЕ геометрия (цель полёта не меняется: `console-start-motion` зелёный).
4. **ГЕРОИНЯ РАЗМЕРОМ (S5).** Сфокусированная карта — `scale 1.06` (transform; 120 мс `motionMs`), соседки — 1; кант фокуса как есть. Пилюля «A РАЗЫГРАТЬ» (S4) — остаётся одна (лицо сцены риска!), но её кегль и плашка —
   по токенам профиля (на 4K читаема), без изменения её роли и якорей.
5. **МАТЕРИАЛ.** Нейтральное стекло, inset-канты; ноль стоячих ореолов (ратчет `start_screen.less` в `glowRestraintBaseline.json` — НЕ расти, по возможности опустить тем же диффом); никаких петель; reduced motion — позы сразу.
6. **СВИДЕТЕЛЬ СЦЕНЫ** — НОВЫЙ `tests/e2e/console-start-queue-scene.spec.ts` (FUNCTIONAL, ×3 профиля; фикстуры: 1 прелюдия, 2 прелюдии, 2 + купленные проекты, «сгорит»): (а) высота карты очереди ≥ 55 % высоты колонки
   при 1–2 картах (fhd / tv4k; deck — свой порог) и все карты в ряд без скролла; (б) под каждой картой — строка чтения с вердиктом; нигде в строке нет цены / меток / текста эффекта лица; (в) ходьба фокуса ◀▶ меняет
   только `transform` и кант карт — коробки строк и полки не двигаются (±1 px), ни одной транзиции на строках; (г) сфокусированная карта крупнее соседки; (д) на полке нет пунктирной заглушки и «0»; (е) `expectFits`;
   (ж) полёт на полку садится в ту же коробку, что «до» (сравнить `getBoundingClientRect` сокета до / после). ПЕРВЫМ ДЕЛОМ — прогнать «ДО»: (а), (б), (д) ДОЛЖНЫ быть красными (иначе переписать свидетель, не правку).
7. **ЧЕГО НЕ ДЕЛАТЬ.** Не трогать стадии до / после развёртывания (выбор, сводку, первое действие), режиссёры, teleport, FLIP, полёты, защёлки и «тень» директора старта; не переименовывать классы / `data-*`
   (16 спеков); не дублировать факты лица; не менять геометрию полки-цели; не делать второй «A».

## 5. Тесты
1. Спек карты и класса (§1); гарды: `TurmoilReduxCardManifest.spec` (TRP0, замена своей строки, `cardsToRemove` 8), `TurmoilReplacementsUnderRedux`, `Prelude2CardsHeldBack` (список `AWAITING` пуст, замена пересекла),
   `premiumScope.spec`, `devGuaranteedCards.spec`, `deckComposition.spec` (+1 прелюдия), `cardInformation`, `actionCaption`, `cardPlayPreviewCoverage` / покрытие превью действий, `premiumCardViewModel`, `cardLore` (ключ P47),
   `crossPlayerCoverageGuard`, **`parliamentGlossary`**, **`glowRestraintGuard`** (ратчет `start_screen.less`), `consoleTvTypeFloor`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `universalSiblingSelectorGuard`, `readingParamsGuard`
   (параметризованный ключ базиса — через `readingText`), `e2eLiveness`, `tests/client/i18n.spec.ts` (ключ-дубль `:redux` не заводить), `startStageDirector.spec` (не тронут), юнит `startQueueLayout`.
2. `build:server`, `build:test`, `lint` (включая `lint:client`), `make:cards` 0 / 0 / 0, `make:json`; полные `test:server` / `test:client` на тихой машине.
3. e2e: стенд карты ×3; свидетель сцены «до / после»; `npm run e2e:affected`; регрессия — `console-start-motion`, `start-shelf-art`, `console-start-summary-fit`, `console-start-availability`, `console-prelude-burn-gate`,
   `console-start-prompt-pad`, `console-start-sponsor`, `console-start-placement`, `start-scene-profiles`, `console-aerospace-company` (A), `console-medical-institute`, `console-lobbying-campaign`, `console-proteus`,
   `console-research-startups` (счётный добор), канарейка; аннотация `build` у красного.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV**, `--exclusive`, `TM_E2E_STORYBOARD=1`)
`screenshots/p47/tv4k/`: **ДО / ПОСЛЕ** сцены прологов: (а) две прелюдии, фокус на TRP0 — строки чтения, героиня крупнее, сокет полки; (б) одна прелюдия; (в) «сгорит» рядом с включающей; (г) розыгрыш TRP0 — 4 M€ с лица в
рельс, карта на полке; (д) `-action` — композер с РАСЧЁТОМ резолюций, забор двух карт; (е) `-futile` — плитка «БЕЗ ЭФФЕКТА» с причиной; (ж) осмотр X — арт P47 и лор; fhd / deck — (а) кадрами свидетеля. Своим глазом:
«первый экран партии — я сразу вижу, что у меня лежит, что можно и что сгорит, и карты занимают сцену, а не плавают в ней?»

## 7. Полировка по пути / доки
1. Реестр **DE** «TRP0 «КОРИДОРЫ ВЛАСТИ» · ПЕРВАЯ ЗАМЕНА-ПРЕЛЮДИЯ (kind prelude, номер семьи TRP, скоуп читает реестр уже сейчас) · ТЕРМИН СЧЁТА ПАРЛАМЕНТА — РАСЧЁТ НАЗЫВАЕТ РЕЗОЛЮЦИИ · ПУСТОЙ СЧЁТ — ВЕРДИКТ ·
   РАЗВЁРТЫВАНИЕ ПРОЛОГОВ — ОДНИМ ВЗГЛЯДОМ (размер из коробки, чтение под каждой, сокет вместо заглушки, героиня размером)» — диагноз 1–6, S1–S5 и решения 1–7 строками «что было / что стало / где» + находки; номера — по footer.
2. Доки: журнал серии (TRP0 / P47 — пятнадцатая запись); `PRELUDE2_ADAPTATION.md` (15 / 54; строка P47 — «ЗАМЕНА СДАНА (TRP0)»; §3.2 — «сделано», п. 4 — скоуп читает реестр уже сейчас); `TURMOIL_REDUX_CLASSIC_CARDS.md`
   §3.2 / §4.1 — восьмая замена (прелюдия, номер TRP0 — правило «номер — семья своего вида»); `turmoilReduxReplacements.ts` — комментарий строки; `docs/claude/console/start-first-action.md` или `start-scene-summary.md` —
   абзац «развёртывание: размер из коробки, строка чтения под картой, сокет полки»; `.claude/rules/console-ui.md` — одна строка; память `prelude2-adaptation.md` (15 / 54) + `turmoil-redux-classic-cards.md` (8 замен).

## 8. Режим работы
1. Читать до кода. Порядок: реестр / номер / скоуп / гарды (решения 1–2) → термин счёта + базис + вердикт (3–4) + спеки → класс карты + спек → лор / арт → `make:cards` → фикстуры + стенд карты → «ДО» сцены + свидетель
   (красный) → 4.1 → 4.2 → 4.3 → 4.4 → свидетель «ПОСЛЕ» ×3 → регрессия → реестр → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста (замена: реестр, номер, `cardsToRemove`, скоуп, пикер, лор / арт через `reimplements`); «ДО / ПОСЛЕ» сцены (кадры × профили, таблица свидетеля); POST (старт — один,
   действие — один); гарды и `make:cards`; ратчет ореолов (было → стало); регрессия на боксе (аннотация `build`); решения 1–8 (что сделано по каждому); гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Переносить классический хук «лидер партии → карта» (`Party.ts`) в замену; регистрировать замену под классическим именем; заводить ключ-дубль `Corridors of Power:redux` в RU; свой арт / лор под `TRP0` (только `P47`
  через `reimplements`); давать замене номер TR7x / TR8x (семья прелюдий — TRP0 со скана); снимать строку из `AWAITING` без `cardsToRemove` + реестра + скоупа одним диффом.
- Считать нейтральные / лоббийные / резервные кубики; считать на клиенте (число и список — сервера); блокировать бесполезное действие (вердикт — информация); «РАСЧЁТ» голой пилюлей; скрывать исключённые резолюции.
- Трогать режиссёры и защёлки старта, teleport сводки, FLIP стадий, геометрию полки-цели; второй «A»; факты лица в строке чтения; переименовывать классы / `data-*` сцены; ореол / петля / пунктир-заглушка; `title`;
  литерал кнопки; `v-if`-моргание; кегль ниже пола ТВ; `zoom` вместо солвера.
- Трогать файлы соседей (по `git status` / `SendMessage`); удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер (кроме строки скоупа);
  переоткрывать находки P76…P74 и TR71…TR77.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` / `--no-verify`; коммитить чужие файлы
  (`package.json` / `package-lock.json`); пересборку во время прогона e2e на боксе.
