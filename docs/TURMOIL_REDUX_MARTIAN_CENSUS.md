# Turmoil Redux · TR15 Martian Census («Марсианская перепись»)

Тринадцатая карта проектов набора (2026-10-02). Три вещи впервые: **требование ПАРТИИ** в Redux (`{party: MARS}` —
причина называет партию и обе дороги), **действие синей карты, которое ставит делегата** (ресурс карты — цена гранта),
и **STAGED ACTION VOTE** — четвёртая дверь голосования: та же staged-дверь резолюции, что у розыгрыша TR03, но открытая
из «Действий карт». Действие общее с TR24 «Венерианская перепись» (`censusAction.ts`; сестра сдана 2026-10-04 —
`docs/TURMOIL_REDUX_VENUSIAN_CENSUS.md`: её эффект отвечает на шаг шкалы, действие — ни строки нового).

Промпт: `docs/claude/prompts/project-tr15-martian-census.md`. Соседи: `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (TR03 —
шаг `PlaceDelegatesOnResolution`, staged-дверь резолюции, закон 22), `docs/TILE_PLAY_STAGED_COMMIT.md` §9-septies
(таблица целей × потоков), `docs/CONSOLE_BLUE_ACTION_PARITY.md` ит. 27 (TR13 — первый потребитель класса требований
партии).

## 0. Решения владельца (не пересматривать)

1. Ветка B — **STAGED VOTE из «Действий карт»**: выбор ветки ничего не отправляет → Парламент встаёт ВНУТРИ workspace →
   A «Подтвердить» = ОДИН POST → data уходят с карты, куб садится; B в режиме возвращает в композер (ветка и фокус целы).
2. RU-имя «Марсианская перепись».
3. Эмблема партии в плашке требования — для ВСЕХ карт с `{party}` (одна таблица эмблем, `partyEmblems.ts`).

## 1. Карта и правила

TR15, 6 M€, ACTIVE, метка Марса, `requirements: {party: PartyName.MARS}`, ресурс `DATA`, ПО нет, `compatibility` нет.
Лор «Mars will be a whole new era of people coping with the fact their ancestors are immigrants.» → «Марс станет целой
эпохой людей, которым придётся смириться с тем, что их предки — иммигранты.» Арт `assets/card-images/TR15.webp`.

| # | Правило | Где закреплено |
| --- | --- | --- |
| 1 | Требование = «Марс вперёд» правит ∨ 2 СВОИХ делегата на её резолюции; доступ, выданный картой, не считается; проверка только при розыгрыше | `MartianCensus.spec` § requirement, `unplayableReasons.spec` § PARTY |
| 2 | Город ЛЮБОГО игрока НА МАРСЕ (+ Капитолий, ярус Небоскрёбов) → +1 data сюда; Ганимед / Фобос / вне Марса / Луна / озеленение / океан — нет | `MartianCensus.spec` § trigger (`countsCity`) |
| 3 | Чужой город — `OPPONENT_TRIGGER`, свой — обычный приоритет | там же |
| 4 | A: +1 data (всегда) | § action A |
| 5 | B: 3 data → 1 делегат из РЕЗЕРВА на резолюцию области голосования, бесплатно, куб лобби не трогается, без поддержки | § action B, `deferredInputBatch.spec` |
| 6 | B отказана ОДНОЙ причиной по порядку: «N из 3 data» → нет резолюции → нет делегата в резерве; показана отключённой | § reasons |
| 7 | data списываются и делегат ставится в ОДНОМ шаге (цена шага, `price`) — «заплатил и не поставил» невыразимо | § price |
| 8 | Раз за поколение; обычный держатель data; города MarsBot считаются | § once / bot |

## 2. Требование ПАРТИИ (A1)

**Фасад, не второй подсчёт.** `game.politics.partyRequirementStanding(player, party)` → `PartyRequirementStanding
{party, ruling, delegates, required, onVote}` — Redux-реализация читает `Parliament.access()` (оно уже считает обе
дороги; `PartyAccess.onVote` — новое поле: у партии есть слот на голосовании), классика отвечает `undefined`.

**Причина** (`unplayableReasons.ts`, тип `PARTY`):

```ts
{type: 'party', message: PARTY_REQUIREMENT_REASON /* 'Requires ${0} to be ruling or ${1} of your delegates on its resolution' */,
 params: [party, '2'], party, current: delegates, partyOffVote?: true}
```

`PARTY` вошёл в `FULLY_RESTATED_REQUIREMENTS`; в КЛАССИКЕ фасад молчит → остаётся старая строка «особая политическая
ситуация» и подавление `requirementKey` (классика не тронута). Клиент (`unplayableReasonFormat.ts`): имя партии через
`partyNameKey`; хвост `partyReasonLine` — «${0} не правит · ваших делегатов на её резолюции: N из 2» или «её резолюции
нет на голосовании»; компакт в руке — **«[эмблема] 1/2»** / «Не на голосовании» (`unplayableReasonEmblem` →
`.con-reason-emblem`). Строка правил лица: «Требуется: «Марс вперёд» правит или 2 ваших делегата на её резолюции.»

**Эмблема в плашке MIN** — `requirementPartyEmblem(party)` (шесть партий Redux, ОДНА таблица в `partyEmblems.ts`;
классические партии — без эмблемы, старая иконка). `PremiumRequirementsBar` рисует её `--emblem`-сокетом 27 px.

## 3. Триггер города (A2) и его близнецы

`countsCity(space, boardType) = boardType === MARS && Board.isCitySpace(space) && space.spaceType !== COLONY`
(прецедент Tharsis Republic). Живой хук `onTilePlaced` → `AddResourcesToCard(owner, DATA, {filter: эта карта})`.
Близнец прогноза `tilePlacedForecast` (тем же предикатом: `countsAsCity && !offMars`) и досье клетки
`tilePlacedPreview` → `placementPreviews.cardResourceGain` — в панели размещения строка «Город размещён на Марсе ·
Марсианская перепись +1» (проверено глазами на своём городе; после постановки чип «+1» на спутнике ДОП. РЕСУРСЫ,
сервер 3 → 4).

## 4. Общее действие переписи (A3) — `censusAction.ts` · МОДУЛЬ СО СПЕКОЙ (с TR34, 2026-10-09)

Одна реализация на ЧЕТЫРЕ карты набора, параметризованная спекой — файл карты называет только своё (ресурс, цена A,
цена B, четыре печатные строки) и зовёт функции с собой и спекой. Ничего в модуле не называет карту.

```ts
export type CensusStockPrice = {resource: Resource.ENERGY | Resource.TITANIUM, amount: number};
export type CensusSpec = {
  resource: CardResource;                                  // что копит карта — и чем платит за делегата
  add: {amount: number, price?: CensusStockPrice};         // A: +amount сюда за цену со стока (TR34 / TR35) или бесплатно (TR15 / TR24)
  votePrice: number;                                       // B: сколько ресурса уходит с карты за ОДНОГО делегата
  addTitle: string; voteTitle: string;                     // титулы вариантов (ключи i18n — ПО РЕСУРСУ, не шаблон: «N of 3 data» и «N of 1 mech» — разные фразы в RU)
  shortReason: string;                                     // причина B «${0} of N <ресурс> on this card»
  rows: {add: string, vote: string};                       // тексты двух печатных рядов (каждый ряд описывает себя)
};
export const DATA_CENSUS: CensusSpec;                                      // {DATA · A бесплатно · 3} — TR15 / TR24 (константы CENSUS_* остались)
export function censusActionRows(b, spec): void;                           // «[цена|∅] → [ресурс] / OR / N [ресурс] → [делегат]» (1 → одна иконка, как у TR66; 3 → цифра)
export function censusGrant(player, card, spec): PlaceDelegatesOnResolution; // {kind:'card'}, price {card, count: spec.votePrice}
export function censusAddReason(player, spec): UnplayableReason | undefined;  // цена A: notEnoughEnergy / notEnoughTitanium; без цены — всегда undefined
export function censusVoteReason(player, card, spec): UnplayableReason | undefined; // правило 6: «N of M» → область голосования → резерв
export function censusCanAct(player, card, spec): boolean;                 // ⇔ хоть один вариант жив (`canAct` карт — отсюда, не `true`)
export function censusUnavailableReason(player, card, spec): UnplayableReason | undefined; // оба мертвы — правило TR66: нет ресурса → цена A; есть — что закрыло голосование
export function censusAction(player, card, spec): PlayerInput | undefined; // A: цена `stock.deduct` → `addResourceTo`; B: грант; один живой — всё действие; два — OrOptions + effectChoice
export function censusActionPreview(player, card, spec): ActionPreview;    // две ветки: A со `stockCost` при цене + `cardGain`; B `cardCost` + `delegateFromReserve` + `delegateGrantStep`
```

| Карта | Спека | A | B | Ключи |
| --- | --- | --- | --- | --- |
| TR15 Martian Census · TR24 Venusian Census | `DATA_CENSUS` (в модуле) | +1 data, бесплатно | 3 data → делегат | «Add 1 data resource to this card» · «${0} of 3 data on this card» |
| TR34 Mars Army Mechs | `MARS_ARMY_MECHS_CENSUS` (в файле карты) | 1 энергия → +1 мех | 1 мех → делегат | ряд A — ключ TR09 дословно; «${0} of 1 mech on this card» |
| TR35 Mars Army Ships (сдана 2026-10-09) | `MARS_ARMY_SHIPS_CENSUS` (в файле карты) — `{FIGHTER, {titanium: 1}, 1}`, константы спека TR34 перенесены дословно | 1 титан → +1 истребитель | 1 истребитель → делегат | свой ряд A («Pay 1 titanium to add a fighter resource to this card.» — не ключ Охранного флота); «${0} of 1 fighter on this card»; ДВА курируемых капшена (A 54 знака — над бюджетом) |

**TR15 / TR24 не изменились**: `VenusianCensus.spec` пересобирает билдер TR15 до выноса и сравнивает `renderData` побайтно
(лицо TR15 то же); их спеки прошли без правок ожиданий (только сигнатуры: `canAct(player)`, `censusGrant(…, DATA_CENSUS)`);
`canAct` обеих — `censusCanAct` (всегда true при бесплатном A), `actionUnavailableReason` — `censusUnavailableReason`
(всегда undefined там же; гард `actionReasonCoverage` требует хук у `canAct(player)`). Модульность TR35 закреплена спеком
без карты: `MarsArmyMechs.spec` § «censusAction — ONE module» строит спеку истребителей на `fakeCard` и проверяет ряды
(титан → истребитель), причины (титан / «0 of 1 fighter»), A и B; с TR35 эта спека — декларация настоящей карты, и
`MarsArmyShips.spec` сверяет её с константами побайтно (случай на `fakeCard` остался — модульность модуля отдельно от карты).
**`PlaceDelegatesOnResolution` получил опцию `price?: {card, count}`**: `offer()` отказывает, если цены нет; в ответе —
перечитать резерв → проверить цену → `payPrice()` → `placeVote`; ветка бота платит так же. В файле карты нет ни
`SelectParty`, ни `placeVote`. **Строка журнала цены — своя** (TR34 A3): «${0} spent ${1} ${2} from ${3} for a delegate»
с ресурсом-токеном (иконка — одна фраза для data / мехов / истребителей), не общая «removed N resource(s) from X's Y»
атаки; карта без `resourceType` падает в общую.

## 5. STAGED ACTION VOTE — четвёртая дверь голосования (B2 · B3)

У голосования было три двери (свой голос · живой грант · staged-дверь розыгрыша TR03). Четвёртая — **staged-дверь
ДЕЙСТВИЯ**: пересечение двух готовых осей одного staged-хранилища (`flow: 'action'` × `target: {kind: 'resolution'}`).
Ничего не скопировано — обобщено:

| Что | Было (TR03 / TR07) | Стало |
| --- | --- | --- |
| Где стоит шаг | всегда зона руки | `stagedStepHost(arm)`: `play` → `'hand'`, `action` → `'card-actions'` (клетка — не хост) |
| Вход | `enterStagedHostedStep` — ритуал руки + RELEASE сцены посадки | та же функция; ветка `action` только кладёт плечо и толкает кадр — RELEASE делает сам композер |
| Коммит | `commitStagedTail`: претензия исхода + `hand → executing` + `submitBatch` | ветка `action`: `card-actions → executing` + `submitBatch([...arm.batch, хвост])` (исход не претендуется — действие ничего не добирает) |
| Свидетель «наш коммит прошёл» | карта в таблице | `actionsThisGeneration` (карта действия в таблице всё время) |
| RE-ASKED | хост `hand` | хост из `stagedStepHost` |
| Конец | `endHandWithHostedStep` | `endStagedVote` маршрутизирует по потоку → `endCardActionsWithHostedStep` (одна охраняемая концовка; шаг и workspace уходят ОДНОЙ поверхностью — `cardActionsLeaveHook`) |
| Отмена | `cancelStagedPlay` | + ветка `action × resolution`: снять кадр Парламента, если он верхний у «Действий карт» |
| Квитанция | `Карта · N M€` (строка) | `StagedReceipt {amount, icon}` — чип стоимости: розыгрыш `{cost, 'megacredits'}` (`playReceiptOf`), действие — первая цена ветки, кроме куба (`stagedVoteReceiptOf` → `{3, 'data'}`) |
| Глагол A | «Разыграть карту» | `stagedDoorVerb(flow)`: `action` → «Подтвердить» (глагол коммита действия), `play` → «Разыграть карту»; читают бар и режим |
| Свидетель PARKED в режиме | карта в таблице | по потоку (`actionsThisGeneration` для действия) |

**Композер действия — хост шага.** Зона `[data-embed-slot="action-parliament"]` — ПОСТОЯННЫЙ слой правой колонки
композера (`.con-composer__parlzone`, `position: absolute; inset: 0`, ввод только `--on`). Композер остаётся
смонтированным под шагом: B возвращает ту же ветку со всеми захватами; на A в режиме он играет универсальный ACTION
COMMIT своей карты (`playCommitBeat(branch)` — вынесен из `submit`, один код на обе кнопки) и держит СЧЁТЧИК карты на
капсуле (`stagedVoteCapsuleHeld` — переименован из `stagedVoteDataHeld` при TR34: читает `storedResource.count`, каким бы
ресурс ни был — data, мех, истребитель) до отрыва куба от резерва (`stagedVoteCubeGone` = `landed` ∧
`sourceLeavingCount === 0`). Наблюдатель коммита ключуется ВИДОМ шага (цель плеча — резолюция, `stagedVoteOf`), не
значком цены; признак `spendDepartsElsewhere` идёт с ним (юнит `stagedActionVote.spec` § TR34).
Подтверждение ветки B внутри «Действий карт» эмитит `staged-vote` (батч, staged-модель, квитанция) и НИЧЕГО не
отправляет; вне staged-границы (повтор, хост — не «Действия карт») ветка коммитится обычно и грант приходит живым (B4).
`RUNTIME_NAVIGATION_STEP_KINDS` получил `delegateGrant` (строка «ДАЛЕЕ: Резолюция — выбор в Парламенте», CTA «Выбрать
резолюцию» — ключи TR03).

**Крошка** — `ДЕЙСТВИЯ КАРТ › МАРСИАНСКАЯ ПЕРЕПИСЬ › ГОЛОСОВАНИЕ`: хвост из кадра Парламента
(`workspaceFrameStage('parliament')` в `focusKickerKey`), циан до A, янтарь после (`parliamentStepCommitted` в
`:committed` шапки). Чип варианта «2/2» прячется, пока стоит шаг. Эмблема workspace и имя карты не двигаются.

**Доказательство, что TR03 / TR07 не изменились.** Юниты `stagedVote.spec` / `stagedColony.spec` /
`voteSupportReading.spec` прошли с одной правкой ожидания (квитанция теперь чип с иконкой `megacredits`, число то же),
e2e `console-political-donation` · `console-colony-sponsors` · `console-staged-play` · `console-colony-venus-redux` —
зелёные на снапшоте с изменениями (журнал прогона — §8).

## 6. Движение

- **Вход — RELEASE и подъём — ОДНА смена стиля.** Секция монтируется на push, но её CSS-вход (`con-parl-step-in`,
  240 мс, `backwards`) стоит на opacity 0, пока тяжёлый монтаж не отдаст первый кадр (замер: 200+ мс). Любой
  скриптовый фейд настройки за ним отставал: отпущенный на push — пустая колонка; по опросу `probeTick` или из
  `animationstart` корня — ещё кадр-два главного потока на коммит WAAPI, и под нагрузкой Парламент 50–250 мс стоял
  целиком над светящейся настройкой. Поэтому отпускание тоже CSS: класс `con-composer--parlrise` на том же
  `parliamentStepOn`, что публикует зону, анимация `con-composer-setup-release` 200 мс (`forwards`). Обе анимации
  коммитятся в одном кадре, ждут вместе и стартуют вместе; скрипт только паркует настройку на её `animationend`. Арт резолюций греется, пока дверь открыта (`voteEntryDoor` →
  `preloadResolutionArt`) — у действия нет ритуала посадки, который грел бы его.
- **Коммит** — A в режиме: импульс по ряду B на лице к значку делегата; капсула data стоит на 3 до отрыва куба, затем
  3 → 0; куб из стопки резерва на ленту; «Делегат поставлен».
- **МОМЕНТ ЦЕНЫ — ЦЕНА УХОДИТ ПЕРВОЙ (PL-100, решение владельца 2026-10-09; класс TR15 / TR24 / TR34 / TR35).** Было: капсула
  падала 3 → 0 (TR34: 1 → 0) в кадр отрыва куба, без жетона, а импульс ряда B и полёт куба шли на двух независимых часах
  (порядок менялся с латентностью сервера). Стало — одна цепочка на часах мотора: импульс ряда B → **жетон цены** («−3
  [data]» / «−1 [мех]», семейство токенов Парламента `.con-parl__flight--token` со знаком) рождается своим размером над
  капсулой героя (`.con-cardactions .con-composer__actcardwrap .pcard__res`), капсула тикает в кадр его ВИДИМОГО отрыва
  (`parliamentFlow.priceStage = 'departed'` — композер читает `stagedVotePriceGone`), жетон садится на стопку резерва
  зрителя (`[data-parl-seat-reserve]`), стопка отвечает своей вспышкой (`parliamentFlow.reserveAnswers` → `landFlash` в
  `ConsoleParliamentSeats`), и только потом куб отрывается от этой же стопки на ленту (`flyPriceThenDelegates` в
  `ConsoleParliamentVoteMode`, `flyPriceToken` в `parliamentFlights.ts`, `PRICE_FLIGHT_MS` 460). Закон куба цел — он
  всегда из резерва. Жетон летит ТОЛЬКО у двери с ценой-ресурсом карты (квитанция не M€ и дверь `card`); дверь розыгрыша
  (M€ — дело оплаты), живая дверь (уже оплачено), reduced motion и неизмеримые места — куб сразу, капсула на его отрыве, как
  прежде (`priceStage: 'none'`). Холд посадки получает +900 мс бюджета при цене. Гарды: юнит `stagedActionVote.spec`
  § PL-100 (холд отпускается на `departed`, не на отрыве куба; без жетона — на отрыве куба), e2e
  `console-martian-census.spec.ts` § 5 (жетон `price…` рождён на капсуле и впитан стопкой, куб стартует после его посадки,
  капсула 3 → 0 между рождением жетона и стартом куба).
- **ИМПУЛЬС → ЦЕНА — ТОЖЕ ЧАСЫ МОТОРА (PL-103, решение владельца 2026-10-09).** До TR35 жетон цены стартовал от ОТВЕТА сервера
  (`landVote` → `flyPriceThenDelegates`), импульс ряда B — от нажатия: на быстром сервере жетон отрывался на ≈ 0.26 с, а кольцо
  импульса садилось на значок делегата на ≈ 0.45–0.57 с, когда жетон был уже у резерва. Теперь жетон рождается после ПОСАДКИ
  импульса: защёлка `armCommitImpulse` / `landCommitImpulse` / `afterCommitImpulse` (`consoleActionCommit.ts`), мотор
  (`runActionCommitMotion`) взводит её в начале эпизода и опускает на handoff или на любом другом конце эпизода, сеть 1.4 с;
  без импульса в полёте (дверь розыгрыша, живая дверь) — сразу, как прежде. Гарды: `tests/console/commitImpulseLatch.spec.ts`,
  `console-martian-census` § 5 (жетон не раньше кольца `.con-commit-ring`).
- **…И СЛОЙ ПОЛЁТОВ НЕСЁТ СВОЙ УРОВЕНЬ САМ (PL-101).** `.con-parl-flightlayer` — `position: fixed`, а fixed открывает контекст
  наложения и без z-index: с 2026-09-20 слой сидел на уровне 0 `.con-root`, и каждый куб и жетон (этот в том числе) рисовался ПОД
  `.con-main` и под лентой «Действий карт» при зелёных rect-пробниках. Слой держит `z-index: 11499` сам (над лентами, под барами);
  свидетель краски — PNG в момент полёта (стенд `tr34-b-token-flight.png`) или `elementsFromPoint` с временно включённым
  `pointer-events` на прокси.
- **Уход** — `endCardActionsWithHostedStep`: снять кадр шага, одна охраняемая концовка, `cardActionsLeaveHook` —
  workspace растворяется С Парламентом внутри.
- **Узкий хост.** Рядом с колонкой героя Парламент уже (fhd 1113 px против ≈ 1650): чтение «+1 ЕСЛИ ПОБЕДИТЕ · ШАГ ①»
  резалось посередине слова. Сделка Deck («график формулы уступает место числам») теперь спрошена у СОБСТВЕННОЙ ширины
  блока: `@container con-parl-reading (max-width: 24rem)` прячет график (fhd 347 px = 17.35rem, 4K 16.75rem, Deck
  14.55rem — против 45 / 36.85 / 26.2rem в полном Парламенте); на ТВ ещё и коробка партии отдаёт 17.5 → 13rem в узкой
  строке (`@container con-parl-reading-row (max-width: 45rem)` — суффикс один занимал 648 px из 614).

## 7. Ловушки (оплачены один раз)

1. **Реактивный массив — PROXY.** `this.parliamentSetupFades !== fades` истинно всегда (data возвращает Proxy), поэтому
   отпущенная настройка никогда не парковалась: висела на `fill: forwards`, а первая отмена анимации (уход) вернула её
   ПОД Парламент на кадр. Владение — токеном (`parliamentReleaseToken`), анимации — `markRaw`. Та же ловушка, что
   «плечо — прокси» у TR03, в другом месте.
2. **Клип-зонд `console-parliament-vote-fit` пропускает всё внутри `[data-embed-slot]`** — для встроенного Парламента
   это ВЕСЬ Парламент. Узкий хост проверяется собственным зондом (e2e TR15 § fit: пропускаются только слоты ВНУТРИ
   слоя голосования).
3. **Сетка действий на Deck вертикальная** — драйвер ходит `walkFocusUntil`, не «ArrowRight N раз».
4. **Вариант плитки** читается «ВАРИАНТ 2» — признак по концу строки, не `/2/` (совпадает с «1/2» в счётчике шапки).
5. **Скрипт не догонит компоновщик.** Подъём шага — CSS-анимация; фейд, запущенный из JS (по опросу, из
   `animationstart`, из `MutationObserver` зоны), всегда отстаёт на коммит главного потока. Две связанные анимации —
   это одна смена класса, а не погоня (§6). Поймал e2e TR15 § «настройка не видна под стоящим Парламентом».

## 8. Тесты

- Сервер: `tests/cards/turmoilRedux/MartianCensus.spec.ts` (32), `tests/models/unplayableReasons.spec.ts` § PARTY,
  `tests/inputs/deferredInputBatch.spec.ts` (голова действия садится; кресло председателя паркует),
  `PoliticalThinkTank.spec` (класс требований партии), `RevealActions.spec`, `requirementProse.spec`.
- Клиент: `unplayableReasonFormat` / `cardAvailability` / `premiumCardViewModel` (эмблема, хвосты, компакт),
  `tests/client/console/stagedActionVote.spec.ts` (хост по потоку, бар «Подтвердить · Источник · Назад», дверь
  композера, квитанция `{3, data}`, живой коммит вне границы, повтор без двери), `stagedVote` / `stagedColony` /
  `voteSupportReading` / `composerRuntimeNavigation`.
- e2e: `tests/e2e/console-martian-census.spec.ts` (fixture `martian-census`): порядок пунктов 1–7 зондом
  `MutationObserver` + `setInterval`, fhd + tv4k, `--repeat-each=4`.

## 9. Известные границы (записано, не спрятано)

- **Чужой город и внемарсовый город** проверены серверными спеками (триггер, `OPPONENT_TRIGGER`, `offMars` в прогнозе);
  глазами — только свой город (досье + чип).
- **PARKED у двери действия** недостижим сегодняшним пулом (как у TR03): серверная половина — юнитом, клиентская ветка
  руками не прогонялась. **RE-ASKED** прогнан (хвост снят перехватом POST): стоящий режим стал живой дверью на месте —
  A «Отправить делегата», B «Свернуть», крошка янтарная, data 3 до куба, после A — меню действий.
- **Парламент ⊃ «Действия карт» ⊃ Парламент** — кадр шага несёт `nest: workspaceFrameKnown('parliament')` (прецедент
  двери Союза); руками не проверялся — нужен стол, где дверь партии открывает «Действия карт» и игрок доходит до
  переписи.
- **Квитанция — чип с иконкой**, не строка `'Card · ${0} data'` из промпта: обобщение до чипа стоимости покрывает обе
  двери одним видом.
- **Герой остаётся рядом с Парламентом** (в отличие от второй двери торговли, где колонка героя уходит): на нём играет
  ACTION COMMIT и тикает капсула — оба пункта промпта.
