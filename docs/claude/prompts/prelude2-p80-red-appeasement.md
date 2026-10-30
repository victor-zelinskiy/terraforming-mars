# Промт исполнителю · P80 Red Appeasement («Красное миротворчество» → см. решение 1) — ЧЕТВЁРТАЯ карта Prelude 2, вторая ПОЛИТИЧЕСКАЯ (Красные) и ПЕРВАЯ, ЧЕЙ РОЗЫГРЫШ — ПАС, «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 2 + 5 — bespoke + ПОЛИТИЧЕСКАЯ): событие (красная), 0 M€, без меток; «Требует, чтобы Красные были у власти или у вас было 2 делегата там, И ЧТОБЫ НИКТО ДРУГОЙ ЕЩЁ НЕ СПАСОВАЛ. Увеличьте производство M€ на 2. ЭТО СЧИТАЕТСЯ ПАСОМ: ходов в этом поколении у вас больше нет» — `requirements: {party: REDS}` (фасад — даром) + `bespokeCanPlay` (никто не спасовал — ГЕНЕРИК ПРИЧИН НЕ ВИДИТ) + `behavior.production.megacredits: 2` + `bespokePlay → player.pass()` (ФИКСИРОВАННЫЙ результат ВНЕ `behavior` — гард превью требует хук) · РАБОТА КАРТЫ (≈ 35 %): маркер `politics: 'redux'`, ко-локированные `unplayableReason` (НАЗЫВАЕТ, кто спасовал) и `cardPlayPreview` (производство + СТРУКТУРНЫЙ признак «этот розыгрыш — пас»), `description` вместо прозы, `infoText`, лор, арт, RU, строка долой, спек с Redux-таблицей · ГЛАВНОЕ (≈ 65 %) — КЛАСС «РОЗЫГРЫШ-ПАС НЕСЁТ ЧТЕНИЕ ПАСА»: композер говорит, что следующее нажатие ОТДАЁТ ХОД, и перечисляет, что игрок оставляет (та же чистая выжимка, что у подтверждения паса — `passWarnings.ts`), глагол кнопки и бара — «Разыграть и спасовать», после ОДНОГО POST правда сразу (полоса игроков помечает ПАС, off-turn-лента говорит «вы спасовали», не «не ваш ход»), чип производства садится ДО того, как сцена поколения заберёт экран (`screenHandoff`), и ни одного молчаливого «куда делся мой ход»

> **Статус: ВЫДАН 2026-10-30.** HEAD `2ac96c684c` (P68 Ceres Tech Market СДАНА 2026-10-30 — `ab1ca6b43c` карта · `b8a0264ee8` класс CS + стенд · `3d9c06404e`
> доки; ворклист **3 / 54**; журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись четвёртая; промты-образцы серии — `prelude2-p76-…` (форма
> §0–§9, чек-лист A–M), `prelude2-p85-summit-logistics.md` (ПОЛИТИЧЕСКАЯ: маркер + фасад + Redux-таблица спека, решения батчем), `prelude2-p68-ceres-tech-market.md`
> (класс в общем слое → раздел реестра); здесь — только то, чем P80 ОТЛИЧАЕТСЯ).
> **Сосед держит незакоммиченные `ConsoleShell.vue`, `ConsoleParliamentSection.vue`, `parliament/consoleParliamentFlow.ts`, `consoleSittingFlow.ts`,
> `ru/parliament.json`, `tests/console/consoleSittingFlow.spec.ts`, `tests/e2e/console-parliament-softgates.spec.ts`** — `ListAgents` + `SendMessage` ДО
> любой правки `ConsoleShell.vue` (тебе он может понадобиться для чтения паса — решение 3): договориться о ханках, не коммитить чужое.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P80.png` (ожидается 1536×1024; иному размеру скрипт ОТКАЗЫВАЕТ — `--force` не ставить, спросить).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P80 - Red Appeasement.png`.
> Лор — СО СКАНА, дословно: «Pledging to halt your terraforming efforts - for now» (без точки на печати — добавить; дефис-тире печати — как на скане, гард лора
> требует только знак в конце).
> Реестр: последний раздел **CS** (P68), последний номер **PL-1130** → эта задача берёт **CT**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p80` → `npm run e2e:remote -- p80 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`).
> **Коммит — сам по окончании, явными путями; сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§3.1 п. 1, **п. 2 — bespokePlay: `cardPlayPreview`, результат показан даже без выбора**, **п. 5 — ПОЛИТИЧЕСКАЯ**, п. 7; §4; §5),
`docs/claude/prelude2-cards-progress.md` (P76/P85/P68 — «Найдено» и «Что даром»: НЕ переоткрывать; P76 «Найдено 1»: награда СОБЫТИЯ рождается на рубашке —
P80 событие, чип производства выйдет из стопки; P85: политическая карта = маркер + фасад + Redux-таблица; «Учёные дают +1 любую метку» — для Красных
проверить, что их правящий ЭФФЕКТ ничего не прибавляет этой карте), `docs/claude/expansion-adaptation-checklist.md` (строки «Play-card modal preview» —
«a FIXED computable result MUST be shown even with no choice»; «Hand overlay — why can't I play» — `unplayableReason`; «Fullscreen rule text»; «Localization»),
`docs/claude/turmoil-redux-card-checklist.md` §0, §3, §4, §7; промты-образцы `classic-t09-pr-office.md` (две дороги, standing), `prelude2-p85-…` (Redux-таблица).
**Контракты цепочки** — как у P76/P85 (CLAUDE.md § A WORKSPACE IS ONE FLOW — «A FINISHED flow does not fold back — it LEAVES»; § ACTION COMMIT; инвариант **16 —
ЭКРАН ПЕРЕДАЁТСЯ**: «every AUTOMATIC screen-taking transition — the finale, the generation scene's rise … asks ONE director what the player is still owed»;
инварианты 2 · 4 · 6 · 9 · 12 · 13 · 14 · 15), `.claude/rules/console-ui.md` § STATE DELIVERY, § A COMPOSER PRE-SELECT (курсор прибывает на CTA, нажатие в окне
поглощено — здесь ОСОБЕННО: случайное A отдаёт ход), `docs/claude/console/state-delivery-and-handoff.md`, `docs/claude/parliament-glossary.md` («у власти»,
«на их резолюции»), память `futile-actions-iteration` (решение владельца 2026-10-15 о подтверждении паса: тихая строка «Остались только действия без эффекта: N»,
бейдж, «пас» не красный — ЭТО чтение и переиспользуется), `state-delivery-truth-first`, `marsbot-turn-pacing-server-authoritative` (бот пасует ТОЛЬКО при пустой
колоде действий — рулбук p.5; между ходами он `waiting`/`passed`/`ready`), `e2e-out-of-band-change-needs-second-player` (изменение извне — второй игрок по API),
`upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `concurrent-session-edits-same-files`, `shell-template-escapes`, `perl-splice-utf8-double-encoding`.

**Образцы — по частям:** пас — `Player.ts:2459–2466` (`pass()`: `game.playerHasPassed`, **`lastCardPlayed = undefined`**, `armedLawWaiver = undefined` (RX36), лог
«${0} passed» — RU есть), `:2468–2475` (`passOption` — `warnings = ['pass']`), `:3050–3056` (цикл после розыгрыша: `hasPassedThisActionPhase` → `playerIsFinishedTakingActions`
— ход уходит сам), `:1741` (`lastCardPlayed = selectedCard.name` — ДО или ПОСЛЕ `play()`? проверить: `pass()` внутри розыгрыша его стирает), `Game.ts:1601`
(`playerHasPassed`), `:2241–2247` (`getPassedPlayers` — ЦВЕТА всех спасовавших, БОТ включительно), `:1197/1615` (сброс множества по фазам), сериализация
`passedPlayers :712/3337`; бот — `automa/AutomaController.ts:107–114` («If MarsBot has no cards in its action deck, it passes for the round» — p.5; `playerHasPassed(bot)`
`:55`) — на столе с ботом «другой игрок спасовал» = у бота кончилась колода; порядок розыгрыша — `cards/Card.ts:306–314` (`bespokePlayBefore` → `behavior` →
`bespokePlay`: производство РАНЬШЕ паса); причина руки — `models/unplayableReasons.ts:44–62` (`card.unplayableReason` ВСЕГДА учитывается, не только как фолбэк;
без него — «Card is unavailable due to unmet conditions»), образец хука с требованием + bespoke-условием — `venusNext/StratosphericBirds.ts:25–60, 76–90`
(`description: {text, align}`, `infoText` для bespoke-части, `unplayableReason` с именованной причиной, `reason.*` билдеры `cards/actionReasons.ts:22–78` —
`ruleReason(msg)`; причина с параметром — форма `{type, message: '…${0}…', params: [...]}` как у T09 `PARTY_REQUIREMENT_REASON`); превью — `cards/actionPreviews.ts`
(`playPreview(card, player, extraEffects, steps) :1414`, `productionChange :129`, `noteStep('generic', text) :578`, `warningNote :862`), модель — `common/models/ActionPreviewModel.ts`
(`ActionPreview` / `ActionEffect :180` — ключа для «пас» НЕТ: решение 3); гард — `tests/models/cardPlayPreviewCoverage.spec.ts:55/112/180–200` (`customizesPlay` →
хук ИЛИ `ACCEPTED_DYNAMIC`; `behavior + bespokePlay` → хук ИЛИ `BEHAVIOR_BESPOKE_NO_HIDDEN_RESULT` — у P80 результат СКРЫТ (пас), значит ХУК); чтение паса —
`console/passWarnings.ts` (`PassFacts` — факты сервера: `cardActions`, `futileCardActions`, `trade`, `plants`, `heat`, `hydro`, свободный делегат…; `passWarnings(facts)`
— чистая выжимка; `tests/console/passWarnings.spec.ts`), шелл — `ConsoleShell.vue:7965–7999` (`confirm === 'pass'` → `passWarnings({...})` из видов — ОДИН источник
фактов, взять его же для композера), `:10079`, `:16069–16074`, `:17727`; off-turn — `console/offTurnReason.ts` (`waitingFor` undefined → «Not your turn» — для
СПАСОВАВШЕГО это полуправда: решение 4); передача экрана — `console/screenHandoff.ts` (термины `board-story` · `reveal` · `card-arrival` · `transfer` · `animation`;
сцена поколения — `registerGenerationSceneHandoff`), стенд — `tests/e2e/console-generation-scene.spec.ts:179–329` (A — соло: flip → конверсия → доход чипами →
покупка); лицо — `premiumCard/mechanicsModel.ts:500–510, 642` (`plainText` — проза, отброшена; `text('PASS')` — `isBold: true` (`CardRenderer.ts:675–683`) — ОСТАЁТСЯ
на лице как текстовый узел: RU «ПАС» `ru/prelude2_cards.json:74`), `PremiumMechNode.vue:440/455` (`ASTERIX` → `.pcard-sym--asterix`), `premiumCardViewModel.ts:304/344`
(плашка партии); фикстуры — `generate.ts` (`parliamentFixture :1414`, `seatEnacted(parliament, quietResolutionOf(PartyName.REDS))` — у Красных тихая резолюция
`HEAT_CAPTURE_ID` (`parliamentArrange.ts:160`), `passTheViewer :1252` / `passAllButViewer :1217` — `clearWaitingFor` + `playerHasPassed` + `playerIsFinishedTakingActions`);
второй игрок по API — `tests/e2e/parliamentDrive.ts:214` (`passAs(request, seat)` — пас через меню действий); оплата нуля — композер (цена 0: проверить глагол CTA).

---

## Диагноз (подтверждён файл:строка на `2ac96c684c`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, форк-слой пуст.** `prelude2/RedAppeasement.ts`: `EVENT`, `cost: 0`, без меток, `requirements: {party: REDS}`, `behavior.production.megacredits: 2`,
   `bespokeCanPlay = game.getPassedPlayers().length === 0`, `bespokePlay → player.pass()`. Рендер — ДВА `plainText` (требование с «AND THAT NO OTHER PLAYER HAS PASSED»
   и правило) + `production(+2 M€)` + `text('PASS')` + `asterix()`; `description` НЕТ. Манифест `:64` — `compatibility: 'turmoil'` БЕЗ `politics`. **Нет:** `unplayableReason`
   (генерик не видит «кто-то спасовал» → плита руки скажет «Card is unavailable due to unmet conditions» — ложь по форме), `cardPlayPreview` (гард
   `cardPlayPreviewCoverage` ПАДАЕТ: `behavior + bespokePlay`, результат «ты спасовал» СКРЫТ — не «no hidden result»; `ACCEPTED_DYNAMIC` — не вариант).
2. **Чтение скана (§0):** «0» — цена; плашка — флаг Красных + «*» (ТРЕБОВАНИЕ с ФУТНОТОМ: звёздочка отсылает к «AND THAT NO OTHER PLAYER HAS PASSED»); справа —
   только значок события; `[+2 M€ произв.] PASS*`; «P80»; слева внизу — Prelude 2 («<») и Turmoil-шестиугольник (= `politics: 'redux'` в форке); лор — курсив.
3. **Пас внутри розыгрыша — ход уходит сам.** `Card.play`: производство, затем `pass()` → `playerHasPassed` + лог «${0} passed» (внутри скоупа действия карты —
   журнал/уведомление получают «спасовал» как часть розыгрыша) → цикл `takeAction` видит `hasPassedThisActionPhase` → `playerIsFinishedTakingActions` → следующий
   игрок / (соло с ботом) ход бота / конец фазы — ВСЁ В ТОМ ЖЕ ОТВЕТЕ на POST. Консоль получает: workspace руки должен УЙТИ (завершённый флоу), а экран — перейти
   к off-turn (2+ игроков) или к ходу бота / сцене поколения (соло) — через `screenHandoff`, дождавшись чипа производства (+2) на рельсе. Ни один стенд
   сегодня не свидетельствует «розыгрыш карты = пас». `pass()` стирает `lastCardPlayed` ПОСРЕДИ розыгрыша — проверить, кто читает его после `play()`
   (`armedPlayEffects.ts:25`, `Card.ts:476/509` — «next card only» скидки/вейверы): взведённое на ЭТУ карту должно быть потрачено, не потеряно и не утечь.
4. **Условие «никто другой не спасовал» — ЧУЖОЙ факт, меняющийся без тебя.** Пока композер открыт, другой игрок может спасовать → сервер откажет сабмиту →
   ACTION COMMIT обязан откатиться чисто, рука — перечитать плиту с ПРИЧИНОЙ (state delivery). С ботом: бот «пасует» при пустой колоде действий (p.5) —
   честно по печати; причина должна назвать БОТА по имени, как любого игрока.
5. **Подтверждение паса у кнопки «Пас» — есть (`passWarnings`), у розыгрыша-паса — нет.** Владелец 2026-10-15: пас предупреждает, что игрок оставляет
   (действия карт, торговля, растения, тепло, гидросеть, свободный делегат), бесполезные — тихой строкой. Карта, чей розыгрыш — пас, сегодня покажет чип «+2 произв.»
   и кнопку «Разыграть» — и ход уйдёт молча. → решение 3 (класс, CT).
6. **Что даром:** требование Красных (фасад, две дороги, standing, `partyOffVote`, вейвер TR70), плашка партии, чип производства в превью (`behavior`), журнал
   производства (`production.add` — рекордер), стопка событий, оплата нуля, MarsBot-стол, save / reload (`passedPlayers` сериализован). Хуков-реакторов нет; целей нет.
7. **Локаль.** RU-имя «Красное миротворчество» — калька (appeasement = умиротворение; «Red» — партия Красных). RU прозы (`:72–73`) — опечатки («долхно», «партией
   партией»), не голос набора. Лора `P80` и арта нет.

## Правила карты (спек пинит каждое; апстримный блок (классика, 3 игрока) — байт в байт)
1. Событие, 0, без меток, без ПО, плашка Красных с футнотом; P80; `compatibility: 'turmoil'` + `politics: 'redux'`.
2. Требование — две дороги Красных (`satisfiesPartyRequirement`) И никто другой не спасовал: ни одной дороги → «0 из 2»; p2 спасовал (Красные у власти) → нельзя,
   причина НАЗЫВАЕТ p2; бот с пустой колодой (спасовал) → причина называет бота; все условия → можно; вейвер TR70 снимает ТОЛЬКО партийную часть — «спасовал» стоит.
3. Розыгрыш: производство M€ +2 (`production.add`, журнал), затем пас (`passedPlayers` содержит игрока; лог «passed» в скоупе розыгрыша); цикл действий отдаёт ход
   (активный — следующий игрок; на столе из двух, где p2 ещё не пасовал, — p2); взведённый вейвер закона стёрт (RX36); «next card only»-эффект, взведённый на эту
   карту, потрачен ею (не потерян, не утёк в следующее поколение).
4. Превью (`cardPlayPreview`): чип «производство M€ 2 → 4» (`productionChange`) + СТРУКТУРНЫЙ признак паса (решение 3), read-only; `countedPlayEffects` — не касается.
5. Раздача под Redux только с маркером; классика — апстрим; save / reload после розыгрыша — игрок спасовавший.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; ОДИН батч `AskUserQuestion` — решения 1, 3, 4, 5, рекомендация первой)
1. **RU-имя** — (а, рекомендовано) «Умиротворение Красных»; (б) оставить. RU описания в голос набора: «Требует, чтобы «Красные» были у власти или у вас было 2
   делегата на их резолюции, и чтобы никто другой ещё не спасовал. Увеличьте производство M€ на 2. Это считается пасом: ходов в этом поколении у вас больше
   нет.» Лор RU — «Обещание приостановить ваше терраформирование — пока что.»
2. **Проза → `description`** (прецедент P85): `metadata.description` — весь текст одной строкой (новый EN-ключ + RU; старые ключи прозы — как у P85: оставить, если
   i18n-аудит не помечает); `infoText`: блок паса {text: 'This counts as passing: you get no more turns this generation.', tokens: [токен текстового узла «PASS» —
   проверить словарь `CardInfoText.tokens`; если текстовый узел не адресуем — блок без токена, по правилам гарда]}; блок производства — из `behavior` даром; блок
   требования — даром (партия) + bespoke-часть «…and that no other player has passed» — в `infoText` требования, если генератор её не выводит. Не батч.
3. **РОЗЫГРЫШ-ПАС НЕСЁТ ЧТЕНИЕ ПАСА** (диагноз 5, раздел **CT**) — (а, рекомендовано) СТРУКТУРНО: `ActionPreview.passes?: true` (сервер; `playPreview(this, player,
   [], [], {passes: true})` или эквивалент билдера — ОДИН признак, не текст), композер розыгрыша читает его и (1) рисует ряд «ЭТО ПАС» с выжимкой `passWarnings(facts)`
   — ТЕ ЖЕ факты, что подтверждение паса шелла (`:7994` — вынести чтение фактов из вида в чистую функцию/модуль и дать обоим), тихая строка про бесполезные — та же;
   (2) глагол кнопки и бара — «Разыграть и спасовать» (ключ новый, grep ДО; оба — из одного источника `consoleCommitGate`); (3) прибытие курсора на CTA и окно
   поглощения — как у T14, но БЕЗ исключений: A, пришедшее до окраски, никогда не отдаёт ход; (4) плита руки — маркер «пас» на плите (кант/слово по инварианту 15,
   не ореол); (5) после ответа — полоса игроков помечает виновника ПАС сразу (правда), чип «+2 произв.» садится в ряд, workspace ЛЕВИТ; (б) только `noteStep('generic',
   …)` текстом — без выжимки и глагола (владелец 2026-10-15 просил ровно эту выжимку у паса).
4. **Off-turn после розыгрыша-паса** (диагноз 3) — (а, рекомендовано) `offTurnReason` различает «вы спасовали в этом поколении» (`view.thisPlayer`/`game.passedPlayers`
   содержит зрителя) от «не ваш ход»: ОДИН новый ключ «You have passed this generation» на всех поверхностях, что читают `offTurnReason` (меню хода, колесо LT,
   стандартные проекты, вехи/награды, торговля, рука); (б) оставить «Не ваш ход».
5. **Футнот требования на лице** (диагноз 2) — (а, рекомендовано) лицо печатает «*» у плашки партии, когда карта объявляет bespoke-условие: ко-локированный флаг
   `metadata.requirementFootnote: true` (читает `premiumCardViewModel` → `PremiumRequirementsBar`, спарк `.pcard-sym--asterix` — существующий знак), текст условия —
   в `unplayableReason` и инфо-панели; (б) без спарка — только причина и панель.
6. **Свой e2e-стенд — ДА**: `tests/e2e/console-red-appeasement.spec.ts`, фикстуры `red-appeasement` (2p Redux + Prelude 2; Красные у власти — `seatEnacted(quietResolutionOf
   (REDS))`; P80 в руке; p2 НЕ пасовал; у p1 оставлены 1–2 полезных действия — синяя карта с действием и растения ≥ 8 — чтобы выжимка паса была непустой) и
   `red-appeasement-locked` (то же, p2 спасовал — `passTheViewer`-форма для p2: `clearWaitingFor` + `playerHasPassed` + `playerIsFinishedTakingActions`, p1 — активный).
   Клетки: (1) `-locked` — плита заперта, причина называет p2 (имя), 0 POST; (2) основная — рука (плита с маркером «пас»), композер (чип производства, ряд «ЭТО ПАС»
   с выжимкой, глагол «Разыграть и спасовать», курсор прибыл, A в окне поглощён) → A → ОДИН POST → чип «+2 произв.» садится → workspace ушёл → полоса: p1 ПАС,
   off-turn-лента «вы спасовали» → `passAs(request, p2)` → сцена поколения поднимается ПОСЛЕ посадки чипа (handoff) → доход p1 на 2 больше; (3) ИЗВНЕ (если дёшево,
   иначе серверный спек + запись): композер открыт → `passAs(p2)` → A → сервер отказал → откат коммита, плита перечитана запертой с причиной (p2).
7. **Журнал серии** — запись P80; `PRELUDE2_ADAPTATION.md` — «4 / 54», строка; §3.1 — одно предложение про «розыгрыш, который заканчивает ход» (единственная такая
   карта модуля — но закон общий: любое действие, после которого сервер отдаёт ход, идёт через `screenHandoff`).
8. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `2ac96c684c`. **Сначала** `ListAgents` + процессы; `SendMessage` соседу Парламента (он держит `ConsoleShell.vue` и файлы заседания): твои
   файлы — `prelude2/RedAppeasement.ts`, `Prelude2CardManifest.ts` (маркер), `tests/cards/prelude2/RedAppeasement.spec.ts`, `common/cards/prelude2Adaptation.ts`
   (строка), лор, арт, `ru/{prelude2_cards,card_info,ui,lore_texts}.json`, `src/genfiles/*`, фикстуры + стенд, доки; **по решениям 3–5** — `common/models/ActionPreviewModel.ts`,
   `cards/actionPreviews.ts`, `console/passWarnings.ts` (+ новый чистый модуль фактов паса из видов, если его нет), `ConsolePlayCardConfirm.vue`, `consoleCommitGate.ts`
   (глагол), `console/offTurnReason.ts`, `premiumCardViewModel.ts` / `PremiumRequirementsBar.vue`, `ConsoleShell.vue` — ТОЛЬКО по договорённости с соседом и
   минимальным ханком (чтение фактов паса — вынести ИЗ шелла в модуль, чтобы шелл менялся одной строкой). Коммиты явными путями; лор — своя строка; пуш после каждого.
2. e2e — только бокс; `FIXTURES=red-appeasement,red-appeasement-locked npm run e2e:fixtures`; `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 25 %)
- `RedAppeasement.ts`: `description` + `infoText` (решение 2); маркер `politics: 'redux'`; `unplayableReason(player)`: спасовавшие ≠ я → причина С ИМЕНЕМ («${0} has already
  passed» / несколько — первый по порядку поколения + «и ещё N», или перечисление — выбрать одну форму и закрепить спеком; бот — по его имени); `cardPlayPreview(player)`
  → `playPreview(this, player, [], [], {passes: true})` (решение 3; чип производства приходит из `behavior` сам); `metadata.requirementFootnote: true` (решение 5).
  `bespokeCanPlay` / `bespokePlay` — без правок (ход уходит циклом сервера). Проверить `lastCardPlayed` (диагноз 3) — если `pass()` стирает его ДО чтения
  взведённых эффектов, зафиксировать порядок спеком и, при реальной утечке, чинить в `Player.playCard` (одна строка — порядок), не в карте.
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P80.png" P80` → `make:cards`); RU (решение 1); `card_info` RU; строка
  `RED_APPEASEMENT` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт; `describe('on a Turmoil Redux table')` по форме T09/P85: правила 1–5 по одному `it` (столы через `parliamentArrange`;
  p2 спасовал — `game.playerHasPassed(p2)`; бот — стол с MarsBot и пустой колодой действий → `getPassedPlayers` содержит бота → причина с его именем; порядок журнала:
  производство, затем «passed» в ОДНОЙ записи розыгрыша; активный игрок после розыгрыша — p2; `armedLawWaiver` стёрт; `lastCardPlayed`; превью `passes: true` +
  чип производства, read-only, `game.serialize()` не изменился; `-locked` → `unplayableReasons` содержит именованную причину и НЕ содержит генерик «unmet conditions»;
  save / reload — `passedPlayers` содержит игрока).

## 2. Клиент — карта (≈ 5 %)
Даром: плита с причиной партии, композер с чипом производства, стопка событий, оплата нуля, полоса игроков. Класс — §3.Б.

## 3. ГЛАВНОЕ — ПРОХОД ГЛАЗАМИ И СТЕНД (≈ 65 %)
Форма — чек-лист P76 A–M; здесь — чем P80 отличается:
- **A. Рука.** Плита: цена 0, событие, плашка Красных со спарком «*» (решение 5), маркер «пас» (решение 3.4); заперта: «[эмблема Красных] 0/2» / «<имя> уже спасовал»
  — по дороге; открыта — играбельна; доступность — сервер.
- **B. Осмотр.** Лор, блоки: требование (с bespoke-частью) · производство · пас; лицо — `[+2 M€ произв.] ПАС*`; прозы нет.
- **C. Композер.** Чип «производство M€ N → N+2»; ряд «ЭТО ПАС» с выжимкой того, что остаётся (та же, что у кнопки «Пас»: действия карт N, растения, тепло…; тихая
  строка бесполезных); CTA и бар — «Разыграть и спасовать»; цена 0 — глагол без «· 0 M€» (проверить существующее правило нуля); курсор прибыл, A в окне — поглощено.
- **D. Коммит.** ОДИН POST; жетона цены НЕТ (0); событие ложится рубашкой на стопку; чип «+2 произв.» выходит из стопки (P76-класс) и садится в ряд производства
  M€ с тиком; полоса игроков: p1 → ПАС сразу (правда раньше истории); workspace ЛЕВИТ (завершённый флоу), ни одного держателя.
- **E/F. Передача хода.** off-turn-лента: «вы спасовали в этом поколении» (решение 4), не «не ваш ход»; колесо LT / рука / стандартные проекты — та же причина;
  активный — p2 (его имя в HUD хода).
- **G/H. Журнал / соперник.** ОДНА запись розыгрыша: карта, «+2 произв. M€», «спасовал»; соперник: «X разыграл …: +2 к производству M€ и спасовал».
- **I. «Сработает».** Меток нет — ряд пуст по праву; Красные у власти — их правящий ЭФФЕКТ (Redux) ничего не прибавляет карте (проверить; P85-класс).
- **J. Края (сервер).** Бот спасовал; вейвер; «next card only»; все остальные спасовали — карта не играется (тогда и генерация бы кончилась — не достижимо, записать).
- **K. Конец поколения.** `passAs(p2)` → сцена поколения поднимается ПОСЛЕ посадки чипа производства (`screenHandoff` — термин `transfer`/`animation`); доход p1 — на 2
  больше (производство уже +2); журнал фазы — одна группа.
- **L. Извне.** Композер открыт → p2 пасует по API → A → отказ → откат чисто, плита перечитана с причиной (имя p2) — клетка (3) решения 6.
- **M.** Осмотр X из композера — как у P76.

Стенд `console-red-appeasement.spec.ts` — клетки (1)–(3); пробники: POST, `data-*` полосы игроков (ПАС), текст off-turn-ленты (ключ, не регексп по RU), ряд
производства до/после, порядок «чип сел → сцена поднялась» (сэмплер времени, как у `console-generation-scene`), хуки — существующие; новый — в `e2eLiveness`.

### 3.Б Класс «розыгрыш-пас несёт чтение паса» (решения 3–4, раздел CT)
Сервер: `ActionPreview.passes` (модель + билдер + гард «passes только у карты, чей bespokePlay пасует» — спек превью). Клиент: модуль фактов паса из видов (один для шелла
и композера; `passWarnings` — чистая выжимка как была), ряд «ЭТО ПАС» в `ConsolePlayCardConfirm.vue`, глагол из `consoleCommitGate`, маркер плиты, `offTurnReason` —
«вы спасовали»; спеки: `passWarnings.spec` (не меняется), `consolePlayCardComposer.spec` § passes, `consoleCommitGate.spec` § глагол, `offTurnReason.spec`
(спасовавший ≠ не-ваш-ход); e2e-хуки — тем же диффом; `glowRestraintGuard` — рэтчет не растёт (маркер — кант/слово).

## 4. Лицо, локаль, лор, арт
Арт P80; лор EN + RU; RU имя/описание (решение 1); новые ключи: «Play and pass» (глагол), «You have passed this generation» (off-turn), «This is a pass» (ряд), «${0} has
already passed» (причина) — grep по всем локалям ДО добавления; «ПАС» — существующий; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack` (политическая → маркер), `premiumScope`, **`cardPlayPreviewCoverage`** (хук), `cardInformation` (KEY-rule против
   `description`; порядок блоков = порядок лица; никаких «then» — «This counts as passing» без союзов последовательности), `requirementProse`, `premiumCardViewModel`,
   `premiumCardIcons`, `cardLore`, `crossPlayerCoverageGuard` (уведомление «спасовал» соперникам), `parliamentGlossary`, `e2eLiveness`, `glowRestraintGuard`,
   `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`, `unavailabilityReason`-семейство (именованная причина сериализуется).
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия — `console-generation-scene` (A–E), `console-composer-preselect`, `console-hand-pick-preselect`, стенд
   подтверждения паса (`grep -l passWarnings tests/e2e`), `console-summit-logistics` (политическая), `console-bonus-action-handoff`; off-turn-поверхности — стенды,
   что читают `NOT_YOUR_TURN` (`grep -l "Not your turn" tests/e2e`) — хуки переводятся тем же диффом, если ключ сменился для спасовавшего.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/p80/{tv4k,fhd}/`: (а) плита заперта «<имя> уже спасовал» / открыта с маркером «пас» и спарком «*»; (б) композер: чип производства, ряд «ЭТО ПАС» с
выжимкой, CTA «Разыграть и спасовать», курсор прибыл; (в) коммит: событие на стопку, чип «+2 произв.» в ряд; (г) полоса игроков ПАС, off-turn «вы спасовали»;
(д) сцена поколения после посадки чипа, доход +2; (е) извне: отказ и перечитанная плита. Своим глазом: «я понимаю, что СЛЕДУЮЩЕЕ нажатие отдаёт ход, ЧТО я оставляю,
и куда ушёл мой ход после?»

## 7. Полировка по пути
1. Реестр **CT** «P80 · РОЗЫГРЫШ-ПАС НЕСЁТ ЧТЕНИЕ ПАСА · СПАСОВАВШИЙ — НЕ «НЕ ВАШ ХОД»» — решения 3–5 строками «что было / что стало / где» + находки прохода; номера —
   по footer. Без гэпов — только журнал.
2. Доки: журнал серии (P80); `PRELUDE2_ADAPTATION.md` (4 / 54; строка; §3.1); контракт — `docs/claude/console/composer-preselect.md` или `play-card-result.md`
   (найти, где живёт композер розыгрыша) — раздел «розыгрыш-пас»; `state-delivery-and-handoff.md` — одна строка «ход, отданный розыгрышем»; память
   `prelude2-adaptation.md` (4 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — «до» на боксе: что сегодня происходит после розыгрыша карты-паса без хука (композер, уход хода, лента) — кадры. Порядок: карта
   (маркер, хуки, описание) + спек + строка долой → лор / арт / RU → `make:cards` → фикстуры + стенд (клетки 1–2) → решения 3–5 (класс + юниты) → проход A–M + «после»
   → клетка 3 → CT → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш; `ConsoleShell.vue` — по договорённости с соседом.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после»; таблица A–M с кадрами; POST; гарды и `make:cards`; регрессия на боксе (аннотация `build`);
   решения 1–8 (что сделано по умолчанию); ОДИН батч `AskUserQuestion` по решениям 1, 3, 4, 5; гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Читать политику мимо фасада; голую запись в слот Парламента; детектить пас по тексту («passed» в логе) — только `passedPlayers`/вид; выводить «никто не спасовал»
  на клиенте; генерик-причину «unmet conditions» у этой карты; отдавать ход нажатием, пришедшим до окраски позы; второе чтение фактов паса (шелл и композер —
  ОДИН модуль); поднимать сцену поколения по сырому ребру (только `screenHandoff`); ореол за «пас»; `title`; литерал кнопки; таймер вместо холда.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; менять, КОГДА
  пасует бот (p.5 — рулбук); переоткрывать находки P76/P85/P68; править чужие файлы заседания соседа.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить чужие файлы; пересборку во время прогона e2e на боксе.
