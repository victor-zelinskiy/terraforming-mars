# Промт исполнителю · P68 Ceres Tech Market («Тех маркет на Церере» → см. решение 1) — ТРЕТЬЯ карта Prelude 2 и ПЕРВАЯ С ДЕЙСТВИЕМ в серии, «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 1 + 3 — декларативный розыгрыш + BESPOKE-ДЕЙСТВИЕ): синяя (активная), 12 M€, метки Наука + Космос, 1 ПО; розыгрыш — «Получите 2 M€ за каждую вашу колонию» (`stock.megacredits: {colonies, each: 2}` — счётный, ОДИН термин, класс PL-196); действие — «Сбросьте любое число карт из руки и получите 2 M€ за каждую» (bespoke `action()` → `SelectCard` с маркером `cardDiscard(…, {exchange: discardForMegacredits(2)})` — семейство сброса форка УЖЕ на карте) · РАБОТА КАРТЫ (≈ 40 %): ко-локированные `actionPreview` (шаг-сброс из руки по форме Strategic Shift: ОДИН билдер маркера для живого промпта и превью) и `actionUnavailableReason` («Нет карт на руке»), `stock.add` вместо прямой мутации `player.megaCredits +=` (мимо рекордера событий — журнал, уведомления и волна рельса слепы), `min` живого промпта и маркера — ОДНО число, `description` вместо прозы `plainText`, `infoText` для счётного розыгрыша, лор, арт, RU, строка долой, спек · ГЛАВНОЕ (≈ 60 %) — ПРОХОД НА БОКСЕ ОБОИХ ПУТЕЙ (розыгрыш со счётным чипом «2 · [колония] → +4» и оплатой титаном; действие через «ДЕЙСТВИЯ КАРТ»: альбом руки в скине сброса с бегущей суммой «−N → +2N», ОДИН POST, кинематика ухода карт в лоток, ВЫПЛАТА ВОЛНОЙ — по жетону за карту, рождённому на печатном «2x [M€]» значке карты, ряд тикает на посадке) и КЛАСС «ВЫПЛАТА СБРОСА — ОДНА ВОЛНА ДЛЯ ЛЮБОГО ИСТОЧНИКА» (сегодня она сеется только для действия ПАРТИИ — `seedPoliticalDiscardExchange`; продажа патентов и действие карты — свои пути или ничего)

> **Статус: ВЫДАН 2026-10-30.** HEAD `d1a9b5efb7` (P85 Summit Logistics СДАНА 2026-10-29 — `20f1eebb81` карта · `7bd205909e` стенд · `98f517b6d5` доки;
> ворклист **2 / 54**; журнал серии `docs/claude/prelude2-cards-progress.md` — твоя запись третья; промты-образцы серии —
> `prelude2-p76-ishtar-expedition.md` (форма §0–§9, чек-лист A–M) и `prelude2-p85-summit-logistics.md` (решения владельца батчем, класс в общем слое →
> раздел реестра); здесь — только то, чем P68 ОТЛИЧАЕТСЯ).
> Сосед держит незакоммиченные `package.json` / `package-lock.json` — НЕ коммитить и не чинить; хук версии бампает `package.json` сам.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P68.png` (ожидается 1536×1024; иному размеру скрипт ОТКАЗЫВАЕТ — `--force` не ставить, спросить).
> Скан — `C:\Users\zelin\Downloads\Ceres Tech Market.png` (НЕ в папке `TerraformingMars-CardDatabase` — лежит в `Downloads` корнем).
> Лор — СО СКАНА, дословно: «Ceres is the commercial hub of the asteroid belt, where you find independent buyers from the outer solar system»
> (без точки на печати — добавить; гард лора).
> Реестр: последний раздел **CR** (P85), последний номер **PL-1123** → эта задача берёт **CS**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p68` → `npm run e2e:remote -- p68 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`).
> **Коммит — сам по окончании, явными путями; сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§3.1 п. 1, **п. 3 — ДЕЙСТВИЕ: `actionPreview` + `actionUnavailableReason`**, п. 7; §4; §5),
`docs/claude/prelude2-cards-progress.md` (записи P76 / P85 — «Найдено» и «Что даром»: НЕ переоткрывать: награда СОБЫТИЯ рождается на рубашке — P68 не событие;
складская награда розыгрыша рождается из центра карты, а у ACTION COMMIT действий — из значков: «расхождение двух дверей одного закона» — ЭТО и есть
дверь твоего действия), `docs/claude/expansion-adaptation-checklist.md` (таблица: строки «Action-confirm modal preview», «NO AUTO-SELECT», «Actions
overlay — why can't I activate», «Actions overlay graphics» (`ACTION_OVERRIDES` — графика `-X [карта] → 2x [M€]` с ТЕКСТОВЫМИ узлами: проверить
`?actionsPlayground` «Flagged»), «Fullscreen rule text», «Localization»), `docs/claude/turmoil-redux-card-checklist.md` §0, §3, §4 («что карта получает
бесплатно / что требует хука»), §7; промты-образцы **`project-tr65-strategic-shift.md`** (сброс из руки за M€ — ближайший родственник: ОДИН билдер
маркера, адресованный ответ `{role: 'discard'}`, «число — игрока, не стола»: список без счётного чипа, бегущая сумма в альбоме, отказ при нуле — у
РОЗЫГРЫША; у ДЕЙСТВИЯ — иначе, решение 3), **`resolution-rx24-open-ip-trade.md`** (ДЕЙСТВИЕ со сбросом за M€ за карту — тот же обмен, другой хост:
«один фреймворк» CL — действие партии/закона рисуется каркасом «Действий карт»), `docs/claude/console/standard-projects-workspace.md` § PATENT SALE («+1 M€ /
карта»: правило в ряду, честные `current → resulting` ВНУТРИ шага руки, выплата — `consolePatentSale.ts`).
**Контракты цепочки** — как у P76/P85 (CLAUDE.md § A WORKSPACE IS ONE FLOW; § ACTION COMMIT — «**награда материализуется ИЗ значков карты в рельс,
счётчики тикают на посадке**»; § Embedded step surfaces COMPOSE — «Карты в руке» как шаг действия; инварианты 2 · 3 · 4 · 6 · 9 · 14 · 15 · 16);
`.claude/rules/console-ui.md` § EMBEDDED STEP SURFACES, § AN OPTIONAL CHOICE DECLINES WITH A BUTTON, § A COMPOSER PRE-SELECT; `.claude/rules/game-logic.md`
(co-location; «A direct field mutation bypasses the event recorder: go through `stock.add`» — CLAUDE.md § Logging); `docs/CONSOLE_BLUE_ACTION_PARITY.md`;
`docs/claude/console/workspace-band.md` § ACTION COMMIT; `docs/claude/console/card-intake-one-batch.md` (не касается — добора нет). Память:
`console-card-discard-unified` (ОДИН путь сброса: маркер → альбом в скине СБРОС → сцена «карта уходит из руки в лоток»; ⚠ маркер сериализуется в
`SelectCard.toModel`, гочи фаз/гейтов), `futile-actions-iteration` (действие без эффекта — доказанная бесполезность; сброс 0 карт — решение 3),
`decline-inside-pick-plan`, `hand-pick-always-album`, `console-action-focus-flow`, `action-precollect-contract` (превью = обещание о форме живых промптов;
батч шлёт адресованные ответы), `journal-gain-via-stock-add`, `upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`,
`commit-at-end-of-work`, `push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `shell-template-escapes`, `perl-splice-utf8-double-encoding`.

**Образцы — по частям:** семейство сброса — `inputs/discardPrompt.ts` (`cardDiscard(card, {min, max}, {exchange})`, `discardForMegacredits(amount, perCard = true)`,
`cardSource`); живой промпт карты — `prelude2/CeresTechMarket.ts:50–63` (`SelectCard(…, {max, played: false})` — **`min` НЕ передан → `SelectCard.ts:68`
`config?.min ?? 1` → живой `min` = 1, а маркер говорит `min: 0`** — два числа одного вопроса); превью шага-сброса — `turmoilRedux/StrategicShift.ts:135–140`
(`discardOptions()` — ОДИН источник + обмен для живого промпта и маркера превью) и `:175–200` (`selectCardStep(…, {min, max, showSelectAll, disabled: [{card:
this, reason}], multiSelect: {countLabel, revealGain: {resource: MEGACREDITS, amount}}, for: {role: 'discard', source}, discard: {min, max, ...}})`),
`SKIPPED_LABEL.discardCards` `actionPreviews.ts:913`, `selectCardStep` сигнатура `:1107–1145`, `singleBranch(card, player, steps, effects, {unavailableReason})`
`:1363–1380` (заблокированная ветка ВСЕГДА называет блокер — падает на `actionUnavailableReason`); причины — `cards/actionReasons.ts:76` `ruleReason(msg)`
(ключ «No cards in hand» уже есть — `ru/ui.json:112` «Нет карт на руке»; Open IP Trade — `OPEN_IP_TRADE_NO_CARDS_REASON` «No cards in hand to discard» —
взять ОДИН из двух, не третий); выплата действия закона — `parliament/resolutions/scientists/OpenIpTrade.ts:96–113` (`tradePatents`: `discardCardFromHand(card,
{log: true})` по карте, M€ через склад, одна типизированная строка лога); композер — `ConsoleActionComposer.vue:5640–5670` (`enterConsoleHandPick` с
`gainPerCard` из `model.discardPrompt.exchange` (perCard) → бегущая сумма альбома; `discard: model.discardPrompt` — скин; `source: handPickSource()` — кикер
«Action setup»), `:3772–3779` (`handPickSource`), `:3785–3800` (`flyDiscardExchange` — летит ТОЛЬКО ключ `discard-exchange:<sourceKey>`); бит выплаты —
`console/parliament/discardExchangeBeat.ts` (`seedPoliticalDiscardExchange :53–76` — **гейт `prompt.partyActionPrompt?.stage === 'discard'`: действие КАРТЫ не
сеется**; `discardExchangeSpecs :32` — по жетону на платящую МЕТКУ (`perTag`), `perCard` не читает), посев в транспорте — `console/transport/gameTransport.ts:678–680`
(рядом — `seedPatentSaleRewardHold` и `seedActionCommitRail :691` — «held only when the two views keep the promise the press armed»: обещание ПУСТОЕ — сумма
зависит от выбора); ожидание выплаты шелла — `ConsoleShell.vue:8498` (`railRewardPending(discardExchangeRailKey(draft.cardName))`); сцена сброса —
`console/cardDiscard/*` (`discardIntent.ts`, `ConsoleCardDiscardLayer.vue`; e2e `console-card-discard.spec.ts:354–380` — вложенный сброс, сброс с добором,
пакет из нескольких карт); стенды-родственники — `console-strategic-shift.spec.ts:88` («альбом кандидатов, обе выплаты, отказ при нуле; ОДИН POST»),
`console-political-think-tank.spec.ts` (действие синей карты с bespoke `canAct` + причиной), `console-payment-panel.spec.ts`; счётный чип одного термина —
`console/countedPlay.ts` (PL-196: «[колония] 2 → +4»; `each` опущен из базы — заголовок чипа уже умножен), P85 `CountedWhy.terms`; генератор текста —
`buildCardInformation.ts:525–536` (`stock.megacredits is countable` → `complex` → ждать `needsCuration` → `infoText`, как T09/P85; блок ДЕЙСТВИЯ — из
ко-локированного описания `b.action('…')` даром); лицо — `mechanicsModel.ts:500–510, 642` (`plainText` — проза, на лице ОТБРАСЫВАЕТСЯ); фикстуры —
`generate.ts` (рецепты `ishtar-expedition` / `summit-logistics` — Prelude 2 через `options`; колония места — `luna.colonies.push(p1.id)` `:3951`, трек —
`track(ColonyName…)` `:3961`); дев-путь — `docs/DEV_GUARANTEED_CARDS.md`.

---

## Диагноз (подтверждён файл:строка на `d1a9b5efb7`; перепроверить на своём HEAD)

### Карта
1. **Правила верны, код — наполовину форковский.** `CeresTechMarket.ts`: `ACTIVE`, 12, `[SCIENCE, SPACE]`, `victoryPoints: 1`, `behavior.stock.megacredits:
   {colonies: {colonies: {}}, each: 2}`, `canAct = cardsInHand.length > 0`, `action()` → `SelectCard('Discard cards for 2 M€ each', 'Discard', hand, {max,
   played: false}).markDiscardPrompt(cardDiscard(this, {min: 0, max}, {exchange: discardForMegacredits(2)})).andThen(…)`. Маркер семейства сброса УЖЕ стоит
   (2026-07-28, поимённо) — альбом в скине СБРОС и сцена ухода карт — даром. **Нет:** `actionPreview` (гард превью действий — ручной аудит `?actionsPlayground`, но
   без хука композер «Действий карт» открывает bespoke-действие как `dynamic` без шага: проверить, что именно он показывает СЕЙЧАС — первым делом, на боксе или
   в юните `actionPreview`), `actionUnavailableReason` (`actionReasonCoverage` упадёт: `canAct` не `return true`), **`player.megaCredits += megacredits`
   (`:59`) — ПРЯМАЯ МУТАЦИЯ** мимо `stock.add`: нет события `resource-changed` под записью действия → журнал без токена «+N M€», уведомление соперникам слепо,
   волна рельса (`verifyRailReward` / посев против событий) не видит выплаты; `game.log` типизирован верно (`.player().number().number()`), `discardCardFromHand(card)`
   без `{log: true}` — сброшенные карты (публичный сброс) не названы.
2. **Два `min`.** Живой `SelectCard` без `min` → 1 (`SelectCard.ts:68`); маркер — `min: 0`. Альбом читает `model.min ?? 1` (композер `:5656`) и скин — из
   маркера. Апстримный спек «action allows discarding 0 cards» зовёт `cb([])` напрямую (мимо `process`) — остаётся зелёным при любом `min`. → решение 3.
3. **Чтение скана (§0):** «12» — цена; плашки требования НЕТ; кружки — Наука (атом) + Космос (звезда) — метки; действие — `-X [карта] → 2x [M€]` в рамке
   действия с подписью; ниже `2 [M€] / [колония]` с подписью «(Gain 2 M€ per colony you own.)» — розыгрыш; «P68»; ПО «1» в круге (планета — фон бейджа, не
   метка); слева внизу — значки Prelude 2 («<») и Колоний (▲ — `compatibility: 'colonies'` ✓, уже в манифесте `:63`); лор — курсив.
4. **Проза → описание.** `description` НЕТ; розыгрыш описан `plainText('(Gain 2 M€ per colony you own.)')` — на лице отбрасывается, в инфо-панель попадает
   только через `infoText`. RU-ключ «Gain 2 M€ per colony you own.» уже есть (`ru/prelude2_cards.json:13` — с двойным пробелом «Получите  2 M€»). Ключ заголовка
   живого промпта «Discard cards for 2 M€ each» RU НЕ имеет (grep по `ru/*.json` — только строка лога `log_messages.json:229`).
5. **Выплата сброса действия КАРТЫ — не волна.** `seedPoliticalDiscardExchange` сеет выплату только под `partyActionPrompt` (действие партии / закона,
   `perTag`); `seedActionCommitRail` держит только обещанное прессом — а превью этого действия сумму обещать не может (она — выбор игрока). Продажа патентов
   идёт своим `consolePatentSale.ts`. Итог для P68 (ожидание, проверить на боксе первым делом): после ОДНОГО POST карты уходят сценой сброса, а «+2N M€» либо
   просто тикает в ряду без причины, либо ловится общей волной из центра карты — не «из печатного «2x [M€]» значка, по жетону за карту». Это третья дверь
   одного закона (партия · патенты · карта) — класс, раздел CS → решение 4.
6. **Что даром:** розыгрыш — счётный чип одного термина «[колония] 2 → +4» (PL-196; `each` в заголовке), «ПОЧЕМУ»/«ДЛЯ ВАС», плита руки «+4», ноль колоний —
   честный ноль (`zeroLabel`), без Colonies карта не раздаётся (`compatibility`); оплата титаном (Космос); бейдж 1 ПО; «Сработает» на метку Науки (Olympus
   Conference, Mars University, Venusian Animals — CN); «ДЕЙСТВИЯ КАРТ» — композер, хост альбома руки как шага, бегущая сумма `gainPerCard` (perCard — `:5647`),
   адресованный ответ батча, сцена ухода карт в лоток (`cardDiscardTransaction`), плашка «Активирована», `actionFutility` не нужен (с картами в руке действие
   всегда полезно; без карт — `canAct` false с причиной). Хуков-реакторов нет → двойников нет; целей нет → NO-AUTO-SELECT «не касается».
7. **Локаль.** RU-имя «Тех маркет на Церере» — калька; RU действия «…за каждую из этих сброшенных кард» — опечатка и не голос набора. Лора `P68` и арта нет.

## Правила карты (спек пинит каждое; апстримный блок — байт в байт)
1. Синяя, 12, Наука + Космос, 1 ПО, без требования; номер P68; `compatibility: 'colonies'`; оплата — M€ + титан (Космос), сталь не предлагается.
2. Розыгрыш → M€ = 2 × свои колонии (чужие — нет; 0 → 0 и честный ноль); превью — чип с ОДНИМ термином «Your colonies: N», `countedPlayEffects` та же сумма;
   `make:cards` — блок розыгрыша из `infoText`, блок действия — из описания действия; запись журнала розыгрыша — токен M€ через `stock.add`.
3. Действие: доступно, когда в руке ≥ 1 карта; иначе — отключено с причиной «Нет карт на руке» (`actionUnavailableReason`; `singleBranch` несёт её в ветку);
   живой промпт — `SelectCard` над ВСЕЙ рукой, `min` = `max`-ограничение по решению 3, маркер `discardPrompt {min, max, source: card, exchange: {megacredits, 2,
   perCard}}` сериализован в модели (верхний уровень — `toModel`); ответ: каждая карта — `discardCardFromHand(card, {log: true})` (в сброс по имени, порядок
   выбора), M€ = 2 × N через **`stock.add(Resource.MEGACREDITS, 2N, {log: false, from: {card: this}})`** + существующая типизированная строка лога; действие
   отмечено использованным в поколении; превью (`actionPreview`) — ОДИН шаг `selectCardStep` над рукой (`multiSelect.revealGain = {megacredits, 2}`, `for:
   {role: 'discard', source}`, `discard` — маркер из ТОГО ЖЕ билдера, что живой промпт), `effects` пусты (сумма — игрока, не стола); превью read-only.
4. Событие `resource-changed` выплаты стоит ПОД записью действия карты (источник — карта): уведомление соперникам «сбросил N карт · +2N M€», журнал — запись
   действия с токеном и названными картами.
5. Раздача с Colonies + Prelude 2 — есть; без Colonies — нет; MarsBot-стол — ничего; save / reload посреди действия (альбом открыт) — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; ОДИН батч `AskUserQuestion` — решения 1, 3, 4, рекомендация первой)
1. **RU-имя** — (а, рекомендовано) «Технорынок Цереры»; (б) «Тех маркет на Церере» оставить. RU действия: «Действие: сбросьте любое число карт из руки и получите
   2 M€ за каждую сброшенную карту.»; RU розыгрыша: «Получите 2 M€ за каждую вашу колонию.» (один пробел); заголовок живого промпта «Discard cards for 2 M€ each»
   → RU «Сбросьте карты — по 2 M€ за каждую» (`play_prompts.json`; grep ДО добавления). Лор RU — «Церера — торговый узел пояса астероидов, где находят
   независимых покупателей из внешней Солнечной системы.»
2. **Проза → `description`** — `metadata.description: 'Gain 2 M€ per colony you own.'` (существующий ключ), ряд `plainText` долой; `infoText` розыгрыша тем же
   текстом (KEY-rule word-diff); блок действия — даром. Не батч — по умолчанию (прецедент P85 решение 2).
3. **`min` действия** — (а, рекомендовано) **`min: 1`** и в живом `SelectCard` (явно), и в маркере, и в превью: действие, которое сбрасывает ноль карт, — ход в
   никуда (политика «действий без эффекта», владелец 2026-10-15), и его не предлагать; «не хочу» = B из композера — действие НЕ потрачено; апстримный `it` с
   `cb([])` остаётся зелёным байт в байт; (б) `min: 0` всюду + отказ RT в альбоме (как у РОЗЫГРЫША Strategic Shift) — но тогда отказ ТРАТИТ действие (сервер
   выполняет `cb([])`), чего у розыгрыша нет — не класс.
4. **ВЫПЛАТА СБРОСА — ОДНА ВОЛНА ДЛЯ ЛЮБОГО ИСТОЧНИКА** (диагноз 5, раздел **CS**) — (а, рекомендовано) `discardExchangeBeat` обобщить на ИСТОЧНИК-КАРТУ: посев
   читает `discardPrompt.exchange` живого промпта ЛЮБОГО источника (партия — `perTag`: жетон на платящую метку, как сейчас; карта — `perCard`: жетон НА КАРТУ,
   `amount` каждый) и сверяет с видами (`verifyRailReward` — разница M€ = курс × ушедшие карты, иначе ничего не держит и называет себя); ключ —
   `discard-exchange:<card>`; жетоны рождаются на печатном «2x [M€]» значке карты в hero-слоте (`data-graphic-node` — не координаты), ряд M€ тикает на
   каждой посадке; порядок — СНАЧАЛА карты уходят из руки в лоток (сцена сброса), ПОТОМ выплата (причина раньше следствия); `flyDiscardExchange` композера и
   ожидание шелла (`:8498`) — уже по ключу карты; продажу патентов НЕ трогать (свой контракт, решение владельца отдельно — записать как кандидата CS);
   (б) оставить как есть (ряд тикает без причины).
5. **Свой e2e-стенд — ДА** (первое ДЕЙСТВИЕ серии; классы «альбом руки как шаг действия со скином сброса и бегущей суммой», «сцена сброса из батча действия
   карты», «выплата волной из значка» — без свидетеля для карты): `tests/e2e/console-ceres-tech-market.spec.ts`, ОДНА фикстура `ceres-tech-market` (Colonies +
   Prelude 2; p1 — 2 колонии, P68 в руке + 3 другие карты, титан 2, M€ 20; на столе Olympus Conference с 0 ресурсов — реакция на Науку без вопроса): (1) розыгрыш
   (чип «[колония] 2 → +4», титан в оплате, ОДИН POST, реакция OC, карта в таблице с бейджем ПО); (2) тем же ходом — «ДЕЙСТВИЯ КАРТ» › P68 › альбом в скине СБРОС
   («−2 → +4»), две карты, A → ОДИН POST → сцена ухода (пакет из двух в лоток) → волна «+4» из значка «2x» → ряд тикает → флоу уходит, плитка «Активирована»;
   (3) отключённое действие с причиной — серверный спек (+ строка `?actionsPlayground`), пустая рука в стенде не нужна.
6. **Журнал серии** — запись P68; `PRELUDE2_ADAPTATION.md` — «3 / 54», строка; §3.1 п. 3 — одно предложение, если проход уточнил маршрут карты с действием
   («bespoke-действие со сбросом: `discardOptions()` один на живой промпт и превью; выплата — волной семейства сброса»).
7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `d1a9b5efb7`. **Сначала** `ListAgents` + процессы; `SendMessage` живым соседям: твои файлы — `prelude2/CeresTechMarket.ts`,
   `tests/cards/prelude2/CeresTechMarket.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка долой), лор, арт, `ru/{prelude2_cards,card_info,
   play_prompts,lore_texts}.json`, `src/genfiles/*`, фикстура + стенд, доки; **по решению 4** — `console/parliament/discardExchangeBeat.ts` (→ переименовать в
   `console/discardExchangeBeat.ts`, если он перестаёт быть «parliament»), `console/transport/gameTransport.ts` (одна строка посева), `ConsoleActionComposer.vue`
   (`flyDiscardExchange` — якорь значка карты), `ConsoleShell.vue` (ожидание), спеки — объявить соседям ДО правки (транспорт — общий файл). Коммиты явными
   путями; лор — своя строка; после коммита — пуш.
2. e2e — только бокс; фикстура: `FIXTURES=ceres-tech-market npm run e2e:fixtures` (имя в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 30 %)
- `CeresTechMarket.ts` (решения 2–3 + правило 3): `description`; `infoText` [{text: 'Gain 2 M€ per colony you own.', tokens: ['megacredits']}] (если генератор
  сам НЕ засеял — ждать `needsCuration`); `private discardOptions()` — ОДИН источник + обмен (`cardSource(this)`, `discardForMegacredits(2)`) для живого
  `SelectCard` (`{min: 1, max, played: false}` + `markDiscardPrompt(cardDiscard(this, {min: 1, max}, {exchange}))`) и превью; `action().andThen` →
  `discardCardFromHand(card, {log: true})` × N, `stock.add(MEGACREDITS, 2N, {log: false, from: {card: this}})`, существующая строка лога; `actionUnavailableReason()`
  → `ruleReason('No cards in hand')`; `actionPreview(player)` → `singleBranch(this, player, [selectCardStep(player, 'Discard cards for 2 M€ each', 'Discard',
  hand, {min: 1, max: hand.length, showSelectAll: true, multiSelect: {countLabel: 'Cards to discard', revealGain: {resource: MEGACREDITS, amount: 2}}, for:
  {role: 'discard', source}, discard: {min: 1, max: hand.length, ...discardOptions()}})], [])` — `effects` пусты; при пустой руке `singleBranch` сам несёт причину.
  Комментарий апстрима «Pretty much a duplicate of SellPatents…» — оставить (чужой текст в диффе синка).
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P68.png" P68` → `make:cards`); RU (решение 1); `card_info` RU; строка
  `CERES_TECH_MARKET` долой; `make:cards` 0 / 0 / 0, `make:json`.
- **Спек** `CeresTechMarket.spec.ts`: апстримный блок — байт в байт; `describe('premium')` — правила 1–5 по одному `it`: причина без карт (`actionUnavailableReason`
  + `singleBranch(...).branches[0].unavailableReason`), превью — один шаг над рукой с маркером (`discard.exchange`, `min/max`), `revealGain`, адрес `for`,
  `effects` пусты, read-only; живой промпт — `min` 1, `max` = рука, маркер в `toModel()` (сериализованная модель, не инстанс — гоча памяти); ответ на 2 карты —
  сброс по имени, +4 через склад (событие `resource-changed` под записью действия карты — `game.events`/рекордер: проверить наличие и источник), строка лога;
  ответ на 0 карт через `process` — отказ (`min`); розыгрыш — 2 колонии → +4, чужие колонии — нет, 0 → 0 и честный ноль, чип одного термина, `countedPlayEffects`;
  `cardsInHand` после сброса; MarsBot-стол; раздача; save / reload.

## 2. Клиент — карта (≈ 5 %)
Даром: композер действия + альбом-шаг со скином сброса и бегущей суммой, сцена сброса, счётный чип розыгрыша, оплата титаном, бейдж ПО, «Сработает» Науки.
Расхождение = класс → §3 / §7. Решение 4 — класс в общем слое (§3.Б).

## 3. ГЛАВНОЕ — ПРОХОД ОБОИХ ПУТЕЙ ГЛАЗАМИ И СТЕНД (≈ 60 %)
Форма — чек-лист P76 A–M; здесь — чем P68 отличается:
- **A/B/C. Розыгрыш.** Плита: цена 12, Наука + Космос, 1 ПО, плита руки «+4»; X — «ДЛЯ ВАС»: «[колония] 2 → +4»; композер: чип «+4 M€» с «ПОЧЕМУ 2 · [колония]»,
  оплата титаном (RT), «Сработает» — Olympus Conference (+1 наука на OC — CN: реакция, жетон на строке эффекта OC); CTA «Разыграть · …»; ОДИН POST; награда
  розыгрыша — из центра карты (P76 «Найдено 2» — класс, не переоткрывать; ЗАПИСАТЬ, если с решением 4 появился путь «из значка» и для розыгрыша — не делать
  без владельца); карта в таблицу (синяя, ПО 1 в счёте).
- **D. Действие — вход.** «ДЕЙСТВИЯ КАРТ» › плитка P68 (доступна; при пустой руке — отключена с причиной «Нет карт на руке»: серверный спек + `?actionsPlayground`);
  композер: ряд-шаг «Карты для сброса» открыт, курсор на нём (вопрос обязателен — коммит держится, T14-закон), B — назад без траты действия.
- **E. Альбом как шаг.** A на ряду → «Карты в руке» ВНУТРИ workspace (крошка: `ДЕЙСТВИЯ КАРТ › ТЕХНОРЫНОК ЦЕРЕРЫ › <стадия>` — корень и имя те же vnodes, стадия
  одно слово; альбом НЕ титулует себя — кикер `Action setup` + источник), скин СБРОС (амбер), шапка «⌫ … · −N → +2N» бегущей суммой с курса сервера
  (`gainPerCard` из маркера — не клиентская арифметика), RT/«все», A — отметка, B — назад с сохранённым выбором; min 1 — с нулём CTA держится с причиной.
- **F. Коммит.** A «Выполнить» → ОДИН POST (`[action, {discard: [...]}]` адресованный); карты физически УХОДЯТ из руки (сцена сброса: fixating → flipping →
  gathering → carrying → landing в лоток; дока руки минус N), ПОТОМ выплата (решение 4): N жетонов «2» рождаются на печатном «2x [M€]» значке карты в hero-слоте,
  летят в ряд M€, ряд тикает на каждой посадке (+2, +2); верхняя полоса — правда сразу (инвариант 16); плитка действия — «Активирована»; флоу уходит одной точкой.
- **G/H. Журнал / соперник.** Запись ДЕЙСТВИЯ карты: токен «+4 M€», названные сброшенные карты (публичны), счётчик сброса; соперник — «сбросил 2 карты · +4 M€».
- **I. «Сработает» (действие).** Сброс — не розыгрыш: Mars University / Olympus Conference на сброс не отвечают (SS правило 9) — ряд пуст по праву.
- **J. Честные края (сервер).** Пустая рука; 0 карт через `process` — отказ; все карты руки — рука пуста, следующее поколение — причина.
- **K. Save / reload** с открытым альбомом шага (ответ ещё не отправлен) — композер восстанавливается или честно начинает сначала; без второго POST.
- **L/M.** Как у P76 (осмотр X из альбома — поверх, возврат — тот же выбор).

Стенд `console-ceres-tech-market.spec.ts` — решение 5 (1)–(2); пробники: число POST, `data-*` сцены сброса (существующие хуки `console-card-discard`), ряд M€ до/после,
`railRewardPending` ключа карты через существующие диагностики, крошка на каждом сэмпле; хуки — существующие.

### 3.Б Класс «выплата сброса — одна волна для любого источника» (решение 4, раздел CS)
`discardExchangeBeat.ts`: `seedDiscardExchange(before, after)` — источник из промпта (`partyActionPrompt` → партия, `perTag`; `discardPrompt.source.kind === 'card'`
→ карта, `perCard`), `discardExchangeSpecs` принимает `perCard`; ключ по источнику; `verifyRailReward` против видов; транспорт — одна строка; композер —
якорь «2x [M€]» (`data-graphic-node` строки действия); шелл — ожидание по ключу (уже); спеки: `discardExchangeBeat.spec` (perTag как было · perCard по карте ·
расхождение видов → ничего не держит), e2e-хуки, если изменилась разметка, — тем же диффом; продажа патентов — НЕ трогать (кандидат, записать).

## 4. Лицо, локаль, лор, арт
Арт P68; лор EN + RU; RU имя/действие/розыгрыш/заголовок промпта (решение 1; grep ключей по всем локалям ДО добавления); `card_info` RU; «Нет карт на руке» —
существующий ключ; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды после удаления строки: `Prelude2CardsHeldBack`, `premiumScope`, **`actionReasonCoverage`** (хук), `cardPlayPreviewCoverage` (розыгрыш
   декларативный), `cardInformation` (KEY-rule против `description`; порядок), `requirementProse`, `premiumCardViewModel`, `premiumCardIcons`, `cardLore`,
   `crossPlayerCoverageGuard` (выплата действия — кросс-игроковое уведомление!), `skippedEffectRecord` (не касается — записать), `actionExtraction` (графика
   `-X … 2x` — «Flagged»?), `tests/inputs/discardPrompt.spec.ts` (маркер в `toModel`), `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`,
   `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`.
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия класса — `console-card-discard` (все три), `console-strategic-shift`, `console-political-think-tank`,
   `console-action-focus`, `console-composer-preselect`, стенд действия закона Open IP Trade / партийного сброса Красных (найти по `grep -l discardExchange
   tests/e2e`) — выплата партии НЕ изменилась; `console-payment-panel`; `console-summit-logistics`, `console-ishtar-expedition`.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/p68/{tv4k,fhd}/`: (а) плита руки «+4», композер розыгрыша с «ПОЧЕМУ»; (б) «ДЕЙСТВИЯ КАРТ»: плитка, композер с рядом-шагом; (в) альбом в скине СБРОС,
бегущая сумма «−2 → +4», та же крошка; (г) коммит: карты уходят пакетом в лоток; (д) два жетона «2» из значка «2x [M€]» → ряд M€ тикает; (е) доска после ухода,
плитка «Активирована», журнал; (ж) осмотр X из альбома. Своим глазом: «я вижу, ЧТО ушло, КУДА, и ОТКУДА пришли деньги — и что это ОДНА сцена, не три?»

## 7. Полировка по пути
1. Реестр **CS** «P68 · ВЫПЛАТА СБРОСА — ОДНА ВОЛНА ДЛЯ ЛЮБОГО ИСТОЧНИКА» — решение 4 строками «что было / что стало / где» + всё, что проход показал не по
   классу (кандидат: продажа патентов — тот же закон); номера — по footer. Без гэпов — только журнал.
2. Доки: журнал серии (запись P68); `PRELUDE2_ADAPTATION.md` (3 / 54; строка; §3.1 п. 3 — при необходимости); контракт выплаты сброса — дописать в
   `docs/claude/console/workspace-band.md` § ACTION COMMIT (или в документ, где живёт бит партийного сброса — найти по `discardExchangeBeat`) раздел
   «источник-карта»; память `prelude2-adaptation.md` (3 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — что композер показывает для действия БЕЗ хука и как приходит выплата (бокс или юнит) — зафиксировать «до». Порядок: карта
   (хуки, склад, `min`, описание) + спек + строка долой → лор / арт / RU → `make:cards` → фикстура + стенд → проход A–M на боксе → решение 4 (класс + юниты +
   регрессия партийной выплаты) → раскадровка «после» → CS → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после» выплаты; таблица A–M с кадрами; POST на розыгрыш и на действие; гарды и `make:cards`;
   регрессия на боксе (аннотация `build`); решения 1–7 (что сделано по умолчанию); ОДИН батч `AskUserQuestion` по решениям 1, 3, 4; гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Второй билдер маркера (живой промпт и превью — ОДИН `discardOptions()`); клиентскую арифметику суммы (курс — с сервера); прямую мутацию `megaCredits`;
  детектить сброс по заголовку/кнопке; авто-применение; прятать отключённое действие; тратить действие отказом при нуле; второй путь выплаты рядом с волной
  (панель результата, тик без причины) — если принято 4(а); трогать продажу патентов и выплату ПАРТИИ (только обобщить, регрессия зелёная); `title`; литерал
  кнопки; ореол; таймер вместо холда.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер;
  переоткрывать находки P76/P85.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить `package.json` / `package-lock.json` соседа; пересборку во время прогона e2e на боксе.
