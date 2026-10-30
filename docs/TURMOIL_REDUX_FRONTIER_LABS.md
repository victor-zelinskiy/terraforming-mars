# Turmoil Redux · TR53 Frontier Labs («Лаборатории фронтира») · ПРИЁМ РЕСУРСА КАРТОЙ — один стандарт

Карта проектов набора (2026-10-15) и — главное — **итерация полировки «РЕСУРС НА КАРТУ — ОДИН ПРЕМИУМ-СТАНДАРТ»**: все
дороги, по которым ресурс ложится на карту (розыгрыш · активация синего действия · ЖИВОЙ промт «на какую карту» · ресурс с
поля), говорят ОДНОЙ грамматикой приёма. Этот документ — контракт класса: его наследует следующая карта, кладущая ресурс.

Акцент владельца (дословно в промте): в промтах «на какую карту положить ресурс» (бонус размещения Ares, чужая торговля на
«Титане» …) выбранная карта «криво наклоняется набок и падает вниз», ресурса не видно; в розыгрыше и синем действии — сделано
хорошо; приёмник на поле — хорошо, но срабатывает не во всех кейсах.

Промт: `docs/claude/prompts/project-tr53-frontier-labs.md`. Журнал: `docs/claude/turmoil-redux-cards-progress.md` § TR53.
Реестр: `docs/claude/gameplay-polish-ledger.md` § AR.

## 0. Решения владельца

Батч `AskUserQuestion` **не задавался**: сессия продолжена после сжатия контекста с указанием не задавать вопросов —
приняты рекомендации промта (раздел «Решения владельца»), каждая названа здесь и в отчёте, каждую можно откатить одной правкой:
1. **RU-имя «Лаборатории фронтира»**; лор — перевод напечатанной цитаты.
2. **Случай (3) с поля — (а) «плита = вопрос, сцена = на поле»**: плита семейства спрашивает; на «Забрать» выбранная карта
   ВЫХОДИТ ИЗ ПЛИТЫ к полю (не нырок), жетон рождается на платящей клетке, капсула тикает на касании, карта уходит в свою
   ячейку спутника; плита растворяется ПОД сценой (не `v-if`).
3. **Бонус колонии при чужой торговле** — грамматика приёма В ПЛИТЕ (жетон из дока источника «КОЛОНИЯ · Титан»), а не
   представленная цель стейджа: стейдж колонии получает живой пик только дверью анонса вне своего хода, и там стоит та же
   плита (телепорт). PL-059 (карта-получатель стейджа мала) — открыта (§5).
4. **Карточный источник** — сцена ВНУТРИ плиты: выбранная остаётся на месте (печать «✓ ВЫБРАНА»), остальные отступают
   (opacity + волос масштаба), жетон из печатного значка карты-источника в доке, тик, карта домой отделённым полётом.
5. **Один держатель у прибытия с поля — вопрос НЕ задаётся** (Ares переведён на автовыбор): сцена приёмника на поле
   называет карту — «без скрытой цели» выполнено сценой. Карточный источник (`autoSelect: false`) — как был.
6. **Паритет синего действия — (а)**: миниатюра цели получает PRESENT · PAY · READ · RETURN в масштабе ряда (подъём ×1.14
   вокруг капсулы + мятное кольцо, тик на касании, чтение 240 мс, посадка — CSS-переход вместе с уходом workspace).
7. **Одна запись прибытия с поля** — кольцо `cardAdjacencyPayouts` (`cause` расширен), ответ живого промта с поля пишет
   запись с `asked: true`; клиент играет сцену с ЗАПИСИ, не с диффа видов.
8. **Маркер исхода по кандидату** — `ResourceGainPromptMeta.extraByCard` (сервер), не слова клиента.

## 1. Сервер — источник назван, запись одна, «ещё что даёт» — маркер

- **Источник каждого производителя** (`ChoiceContextSource`): `Game.grantSpaceBonus(player, bonus, count, {spaceId,
  placedSpaceId})` — для MICROBE / ANIMAL / DATA / SCIENCE / ASTEROID строит `AddResourcesToCard` с `cause: spaceSource(space)`
  (новый вид `kind: 'space'`, ключ «Placement bonus» / «Бонус размещения»), `fromSpace` (клетка, откуда летит жетон) и
  `boardPayout`; `AresHandler` — `fromSpace` = платящий тайл, `cause` = карта тайла / system; `SurveyCard` — клетка, чей бонус
  копируется; колония — `colonySource` (было).
- **ОДНА запись прибытия с поля** — `cards/tilePayout.ts` `payTileToCard(owner, source, space, target, resource, amount,
  {cause, neighbours?, basis?, asked?}, addition)`; `CardAdjacencyPayoutModel.cause`: `'adjacent-cities' | 'tile-placed' |
  'space-bonus' | 'ares-adjacency' | 'survey'`, `card?` (источник), `asked?` (ответ живого пика). `AddResourcesToCard.Options.
  boardPayout {space, cause, sender?, source?}` — добавление ступени идёт через `payTileToCard` (соседи — только когда
  отправитель ≠ размещённая клетка). Один держатель (тихо) и ответ промта пишут одинаково; `seq` кольца — как у TR21.
- **Ares, решение 5**: `AresHandler.addResourceToCard` — `step.getCards().length === 1` → ступень без вопроса, запись
  гранта `{delivery: 'card-resource', targetCard, boardScene: true}` (`AresAdjacencyGrantEntry.boardScene` — «рассказывает
  сцена поля», волна соседства НЕ летит второй жетон в спутник); ≥ 2 — промт как был.
- **Near-miss при `min`** — `AddResourcesToCard.nearMisses()` (держатели ниже `min`) публикуются `disabledCards` с причиной
  `NO_RESOURCE_YET_REASON` («No resource on this card yet» / «На карте ещё нет ресурса»), маркер несёт пол
  `resourceGainPrompt.holdsAtLeast`; превью-близнец — тот же билдер.
- **`extraByCard`** — `Options.extraByCard?(card)` → маркер `resourceGainPrompt.extraByCard: Partial<Record<CardName,
  ReadonlyArray<ActionEffect>>>` («что ещё даёт выбор ЭТОГО кандидата»); `actionPreviews.addToCardStep` несёт его в шаг.
- Спеки: `tests/game/BoardCardPayout.spec.ts` (по видам: печатный бонус — один держатель / два / без клетки; Ares; Survey),
  `tests/deferredActions/AddResourcesToCard.spec.ts` (near-miss, `holdsAtLeast`, `extraByCard`, `fromSpace`),
  `tests/ares/AresAdjacencyGrants.spec.ts` (один держатель — `card-resource` + `boardScene` + запись без `asked`).

## 2. Клиент — ОДИН директор, четыре хоста

**`console/cardReceive/cardReceiveDirector.ts`** — `runCardReceive({host, card, present, pay, ret, readMs?, release?,
alive?})`: фазы **PRESENT → PAY → READ → RETURN**, вердикт `done | degraded | aborted | reduced`, холд `card-receive`
(NOTIFICATION-ONLY: сцена часто играет ВНУТРИ стоящей поверхности; хост, чья сцена владеет полем, держит свой блокирующий
холд), `cardReceiveState` (host · phase · walked · runs — свидетель пробника). `RECEIVE_READ_MS`: played 0 (её «нажим» и есть
чтение) · composer 240 · prompt / colony 520 · board 680 · resolution 260. Reduced motion — ни один хук не играет, холды
отпускаются.

| Хост | PRESENT | PAY (источник → цель) | RETURN |
| --- | --- | --- | --- |
| **«Разыграно»** (эталон) — `consolePlayedHero.receiveOnStage` | `emergeTarget` из полосы | севшая карта / печатный значок → `.con-recv [data-played-key]` | `settleTarget` в полосу |
| **Композер действия** — `consoleActionCommitRail` (последнее звено на `[data-composer-card]`) | `presentComposerCard`: АТРИБУТ `data-receiving` (подъём ×1.14 вокруг капсулы + кольцо; класс стёр бы реактивный `:class`) | печатный значок героя → капсула миниатюры (свидетель `composer-card:`) | атрибут снят, CSS-переход 160 мс вместе с уходом |
| **Живой промт** — `cardReceive/promptReceive.ts` | печать выбранной в плите, остальные отступают (`--receiving` / `--receded`) | **поле**: сцена поля по ЗАПИСИ `asked`; **колония**: док источника `.con-src`; **карта**: печатный значок источника в доке | `runCardHome` — отделённый полёт в свою ячейку спутника (`auxCellRect(resource, card)` — ячейка, ЧЬЯ карта: `data-aux-cards`), плита растворяется под ним |
| **Поле** — `cityDataPayoutBeat.runCityPayoutBeat` | подъём из ячейки спутника — или ИЗ ПЛИТЫ (`riseFrom`, `inPrompt`) | платящая клетка → `.con-citypay__card` (свидетель `recv:`) | в ячейку спутника |

**ВОЛНА — несколько получателей одного розыгрыша** (PL-1146, P78 «по ресурсу на 3 разные карты», 2026-10-30). Розыгрыш
может кормить НЕСКОЛЬКО карт стола; раньше экстрактор отдавал сцене только ПЕРВУЮ карту ответа (`pickedCardOf` →
`cards[0]`), а будь их все — сцена сыграла бы N фраз подряд (вынос · полёт · чтение · возврат ×N). Закон: ответ шага с
несколькими картами — спецификация на КАЖДУЮ, своим видом ресурса (`pickedCardsOf` в `extractPlayRewards`); последовательность
приёма — `receivingStageModel.receiveSteps`: сыгранная карта — свой шаг (она и есть фронт), ВСЕ ОСТАЛЬНЫЕ одной волны — ОДИН
шаг: `emergeTargets(cards)` поднимает их вместе (со сдвигом 50 мс, по порядку их мест — пути не пересекаются) и ставит РЯДОМ
над полкой (ряд по центру над их домами, в пределах стадии; уже стадии — общий масштаб, не ниже ×0.6), жетоны — одна волна
(каждый на капсулу своей карты), одно чтение, `settleTargets(cards)` — возврат вместе. Цена — одна фраза плюс сдвиг, не N
фраз (P78: ~2,8 с до жетона ПО против ~2,4 с у одной карты). Хост без хуков волны — прежние шаги по одной. Тот же закон для
ответа стола (`flyHeroReactions`). **Карта не уходит домой из-под своего жетона**: возврат (и одиночный, и волны) ждёт
`surfaceClear` на вынесенном лице — оплата резолвится на касаниях, и возврат с касания оставлял последний жетон впитываться
в воздухе. Свидетели: юниты `receivingStageModel.spec` § receiving SEQUENCE, `resourceTransferModel.spec` § MULTI pick; e2e
`console-l1-trade-terminal` (1) — `recv:Ants` · `recv:Birds` · `recv:Dirigibles` и проба «три вынесены одновременно»;
свидетель переноса знает вынесенную карту как якорь раньше фронта стопки (`.con-recv__emerge[data-played-key]`).

**Живой промт** (`promptReceive.ts`): семья — маркеры сервера, не заголовок (`fromSpace` → `field`; `choiceContext.source.kind
=== 'colony'` → `colony`; иначе `plate`; резолюция — свой гейт `resolutionPayout`). ARM на нажатии (`ConsoleTaskHost.
commitSingleCard` — для `resourceGainPrompt` **`runHeroPick` / `con-exit-reject` не играют никогда**; арт карты прогревается
там же), DETECT в транспорте (карта взяла ровно `amount`; поле — ещё и свежая запись `asked`, `claimCityPayout`, иначе честный
откат в `plate`), гейт `transportHolds.promptReceive` держит коммит, пока сцена играет; бар — статус «Выполняется…»; отказ
сервера — батарея снимает печать. Поле играется с `inPrompt` — слой поля НЕ понижается под ws (`con-flight-to-board` снят),
его жетоны держат ЛЕНТУ (`inSurface`) — блокирующий холд снимал хост посреди сцены; общий шейд гаснет (`con-shade--clear`).

**Поле для каждого прибытия** — свои размещения играют все `cause` записи; **чужое размещение, платящее карте ЗРИТЕЛЯ**
(Pets зрителя на чужой город) — `consoleRemotePlacement`: `viewerCards` (таблица зрителя) → своя сцена поля у чужого тайла
(`runOwnPayoutOnRemoteStage` — холды, посеянные при стейджинге, отпускает сцена), карты других мест — жетоны в их чипы.

**TR53 в композере** — шаг цели (`ConsolePlayedTargetStep`): метка исхода под КАЖДЫМ кандидатом с хвостом
`extraByCard` («· [карта] +1» / зачёркнутая карта у науки — `con-ptsel__tag-extra`), near-miss «✕ 0 / 1» (`playedTargetShortfalls(…,
holdsAtLeast)`), строка рельса «Добор карты +1» / «Без добора: наука». Условный добор — claim workspace по ОТВЕТУ:
`branchOutcomeClaimPlan(preview, branch, answered)` читает `extraByCard` выбранной карты → `draw` / `pick` и размер прибытия;
без этого добор вылетал до цены и открывался полноэкранным просмотрщиком над полем (кадры after3). Единица «+1 на карту» (вид — карты-цели, чип `resources`) летит на миниатюру выбранной карты: вид — из маркера `cardResourceByCard` (`resourceTransferModel.stepCardResource`; `CardModel` не несёт `resourceType` — до PL-429 коммит нёс одну цену). И стадия добора НЕ подменяет колонку решения до посадки: последнее звено на карте строки (`armedRailLandsOnRow`) откладывает «готовящуюся» зону до конца половины рельса (`actionCommitRailState.ended`, PL-430) — цена → +1 на миниатюру → чтение → «› ДОБОР КАРТ».

## 3. Карта

`src/server/cards/turmoilRedux/FrontierLabs.ts` — `ActionCard`, ACTIVE, 8, Наука + Здание, требование Учёных, без
`behavior`. Действие bespoke: `SelectPaymentDeferred(5)` → `target(player)` (ОДНА конструкция: `AddResourcesToCard(…, {count: 1,
min: 1, autoSelect: false, cause: cardSource(this), extraByCard})`) → добор, если вид ресурса выбранной ≠ SCIENCE
(`drawsFor`), пустая колода — пропуск по имени. Причина недоступности по порядку: нет держателя → не хватает M€. Превью —
одна ветка: цена, «+1 на карту», шаг цели с хвостами. Лицо: `megacredits(5).startAction.resourceCard().colon().plus().
resource(RESOURCE_CUBE, {questionMark}).nbsp.cards(1).asterix()` (новый узел `RESOURCE_CARD` — `PremiumResourceCardGlyph`).
Правила 1–13 — шапка карты и `tests/cards/turmoilRedux/FrontierLabs.spec.ts`.

## 4. Тесты

Юниты: `cardReceiveDirector.spec`, `promptReceive.spec`, `consolePlayedTargetModel.spec` (пол `holdsAtLeast`),
`consolePlayedTargetPreview.spec` (хвост `extraByCard`), `holderRoles.spec` (ПО, которые не двигаются, — не ответ),
`aresAdjacencyFlights.spec` (`boardScene` не летит). e2e — ОДИН `tests/e2e/console-frontier-labs.spec.ts` (fhd + tv4k):
A — действие (хвосты, near-miss, жетон на миниатюру, добор в workspace, сервер); A′ — наука без добора; B — поле (один
держатель без вопроса, два — плита → сцена на поле, без ухода драфта); C — чужая торговля на Титане (жетон из `source` на
`slot:<карта>`). Свидетель `transferWitness` знает якоря плиты (`slot:` / `source`).

## 5. Известные границы (открыто)

- **К-R7** — плита живого промта рисует СВОЮ полосу кандидатов, не общий `ConsolePlayedTargetStep` (метки исхода под каждым
  кандидатом там нет, только строка фокуса). Перенос — переделка `ConsoleTaskHost` (зум-слоты, вердикт, печать) — отдельная
  итерация.
- **PL-059** — представленная цель стейджа колонии мала (стейдж бонуса через анонс — та же плита, телепорт).
- **К-R8 / К-R9** — резолюции (жетон без подъёма / возврата) и леджер колоний карты / действие Учёных (садятся на спутник)
  — на директор не переведены.
- Второй клиент (Pets зрителя на чужой город) — покрыт кодом и юнитами пути, не e2e (фикстура не умеет чужой город).
