# Turmoil Redux · TR15 Martian Census («Марсианская перепись»)

Тринадцатая карта проектов набора (2026-10-02). Три вещи впервые: **требование ПАРТИИ** в Redux (`{party: MARS}` —
причина называет партию и обе дороги), **действие синей карты, которое ставит делегата** (ресурс карты — цена гранта),
и **STAGED ACTION VOTE** — четвёртая дверь голосования: та же staged-дверь резолюции, что у розыгрыша TR03, но открытая
из «Действий карт». Действие общее с TR24 «Венерианская перепись» (`censusAction.ts`, TR24 здесь НЕ реализован).

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

## 4. Общее действие переписи (A3) — `censusAction.ts`

```ts
export const CENSUS_DATA_COST = 3;
export function censusGrant(player: IPlayer, card: ICard): PlaceDelegatesOnResolution;          // {kind:'card'}, price {card, count: 3}
export function censusVoteReason(player: IPlayer, card: ICard): UnplayableReason | undefined;   // правило 6
export function censusAction(player: IPlayer, card: ICard): PlayerInput | undefined;            // A всегда, B при чистой причине
export function censusActionPreview(player: IPlayer, card: ICard): ActionPreview;               // две ветки, B с delegateGrantStep
```

Файл карты называет только своё (триггер, требование, метки) и зовёт эти функции с собой — TR24 повторит тот же вызов.
**`PlaceDelegatesOnResolution` получил опцию `price?: {card, count}`**: `offer()` отказывает, если цены нет; в ответе —
перечитать резерв → проверить цену → `payPrice()` (снятие с журналом) → `placeVote`; ветка бота платит так же. В файле
карты нет ни `SelectParty`, ни `placeVote`.

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
COMMIT своей карты (`playCommitBeat(branch)` — вынесен из `submit`, один код на обе кнопки) и держит data на капсуле
(`stagedVoteDataHeld`) до отрыва куба от резерва (`stagedVoteCubeGone` = `landed` ∧ `sourceLeavingCount === 0`).
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
