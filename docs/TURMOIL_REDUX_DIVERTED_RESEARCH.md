# RX35 · Diverted Research («Перенаправленные исследования», Красные) — ПЕРВЫЙ ЗАМЕНЯЮЩИЙ ПАССИВ

Печатное: «Add 1 data resource per point of your influence to one of your cards. **Each step of oxygen or temperature you
would raise and each greenery or ocean tile you would place becomes 1 data resource on one of your cards instead — even
when the parameter is at its maximum.**» Задание председателя — «Add 4 data resources to your cards» (`{kind:
'cardResource', resource: DATA}, count 4` — первый живой потребитель этого вида цели). Промт владельца:
`docs/claude/prompts/resolution-rx35-diverted-research.md`. Сдана 2026-10-19.

Чем карта нова: до неё у `ResolutionPassive` было два рода хука — РЕАКТИВНЫЙ (RX10 / RX30 — доплата ПОСЛЕ события) и
ЗАПРОС (RX14 / RX19 / RX26 — чистое чтение). Третий род — **ЗАМЕНА ДО МУТАЦИИ**: закон перехватывает единицу
терраформирования, которую игрок *получил бы*, и вместо неё кладёт 1 data на одну из его карт. Шкала не двигается,
РТ не растёт, бонус порога не выдаётся, тайл не ложится, клетка не спрашивается — а данные приходят даже на максимуме
параметра. Это первый закон, который меняет РЕЗУЛЬТАТ чужих карт, а не доплачивает к нему; без одной точки решения и
одного прохода превью каждая из ~30 точек терраформирования соврала бы по-своему.

---

## 1. Главный принцип: ОДИН диспетчер, ОДИН проход превью

| Вопрос | Ответ | Где |
| --- | --- | --- |
| «Закон стоит и этот игрок под ним?» | `divertsTerraforming(player)` — принятый хук `divertTerraforming` есть, фаза не SOLAR, `participates(player, 'restriction')` (бот под `'politics'` — ПОД законом, D13: его единица = 1 M€; под `'none'` отсечён) | `src/server/parliament/divertedTerraformingGate.ts` |
| «Заменить эту единицу?» | `divertTerraforming(player, unit, origin?) → boolean` — открывает `withEffectSource(player, {kind: 'resolution', id, owner}, 'terraforming-diverted', …)` и зовёт хук карты; `true` = единица ПЕРЕХВАЧЕНА, вызывающий НЕ мутирует | тот же модуль; фасады `ParliamentHandler.divertsTerraforming / divertTerraforming` |
| «Что покажет композер?» | `withDivertedTerraforming(player, preview, card?)` — ОДИН выходной проход семейства превью, ПЕРЕД `withImpliedRatings` и `withPreselectAddresses` | `src/server/models/divertedTerraforming.ts` |

Гейт вынесен в ЛЁГКИЙ модуль (не в `ParliamentHandler`): низкоуровневые двери (`Executor`, `PlaceGreeneryTile`,
`PlaceOceanTile`, стандартные действия) импортируют `* as divertedGate`, иначе цикл через `Card.ts` падал
`ReferenceError: Cannot access 'Card' before initialization`. `ParliamentHandler` только делегирует.

Единица — `TerraformingUnit = {kind: 'parameter', parameter: OXYGEN | TEMPERATURE, steps} | {kind: 'tile', tile:
'greenery' | 'ocean', count}`; происхождение — `ChoiceContextSource` текущего источника событий
(`events.currentSource()`), поэтому хук знает, карта ли это, стандартный проект, конвертация или финал.

### 1.1 Восемь входов движка (и ни одной ветки «по вызывающему»)

| № | Вход | Где стоит перехват |
| --- | --- | --- |
| 1 | `Game.increaseOxygenLevel` / `increaseTemperature` | ПЕРВОЙ строкой, ДО проверки потолка (`increments > 0 && !unrewarded && divertTerraforming(...)` → return) — поэтому «даже на максимуме» выполняется буквально |
| 2 | `Executor.execute` — `behavior.ocean` (с `count`) / `behavior.greenery` | до `defer` — в превью и в исполнении одна и та же единица |
| 3 | `PlaceGreeneryTile.execute` / `PlaceOceanTile.execute` | первой строкой (океан — за `creditedPlayer`, до ветки Whales) — все бесподобные `game.defer(new PlaceOceanTile…)` покрыты разом |
| 4 | `ConvertPlants.action` | под законом — `SelectOption` с метаданными (`plantConversionMetadata`): −8 растений, `recordGreeneryDiscount`, перехват тайла; `canAct` не требует клетки |
| 5 | Стандартные проекты Greenery / Aquifer | `divertedTerraformingUnit()` (`IStandardProjectCard`) — проект САМ объявляет свою единицу; без клетки/океана `canAct` даёт true, `standardProjectTarget` → `undefined`, `payAndExecute` → `super` |
| 6 | Бонусы клеток Hellas OCEAN / Vastitas TEMPERATURE_4MC | гейт `|| divertsTerraforming(player)` — бонус проходит в `increaseTemperature` / `addOcean`, где его ловит вход 1 / страховка |
| 7 | Финальное озеленение (`Player.ts`) | под законом ветка = `SelectOption` (растения −8 → перехват → `resolveFinalGreeneryDeferredActions`), маркер `finalGreeneryPrompt.diverted` |
| 8 | Бесподобные вызывающие (`PolderTechDutch` — озеленение после океана, `Arboretum` — без своей цели) | co-located правки В ФАЙЛЕ карты (инвариант 8) |

**СТРАХОВКА** — `Game.addGreenery` / `addOcean`: `caughtAtNet(...)` + перехват, ничего не сажается; под
`THROW_STATE_ERRORS` — `logIllegalState` и throw. Правило исполняется всегда; в тестах пропущенный вход — ПАДЕНИЕ, не
тихая посадка. Свип-гард `tests/parliament/DivertedResearchSweep.spec.ts` проходит КАЖДУЮ карту скоупа с единицами и
требует: параметр стоит, тайла нет, data = печатные единицы (у карт-строителей колоний и карт с собственной data —
контракт без счёта). Что свип не может пройти, он печатает `INFO`-списком — это ворклист.

### 1.2 Накопитель: ОДНА операция — ОДИН вопрос (Р4)

`DivertedTerraforming.ts`: `WeakMap` по корню событий; первая единица операции откладывает
`SimpleDeferredAction(landDivertedData, BACK_OF_THE_LINE)` ИЗНУТРИ области закона; посадка строит один
`AddResourcesToCard(DATA, {count: N, autoSelect: false, title, cause, from, diverted: {resolution}})` — форма RX18/RX01,
`spread` не объявлен, карта одна. Посадка идёт ВНУТРИ области закона → дитя маркера `effect-triggered` → карточка
уведомления «Сработал эффект» с чипом «+N [data]», статистика считает раз.

**Без держателя — названная потеря, никогда не ворота**: строка журнала «${0} has no card that can hold data — ${1}
data from ${2} are lost» + `recordSkippedEffect` (инвариант 4). Три разных нуля принятия: влияние 0 · нет держателя ·
обе части (`DATA_STEP`, причины `'No influence'` / `'No card can hold data'`).

### 1.3 Доступность и бесполезность (Р5)

Под законом гейты «потолок» и «нет клетки» СНЯТЫ: `Executor.canExecute` не даёт `maxtemp` / `maxoxygen` / `maxoceans`
и не требует клетки для озеленения; `ConvertHeat.canAct` без `maxtemp`. Бесполезность
(`actionFutility.ts`): `parameter-maxed` НЕ выдаётся под законом (данные всё равно придут), а `no-target` без
держателя — да, с причиной `DIVERTED_NO_HOLDER_REASON`; стандартные проекты через `trSourceNamesDivertedUnit`.

---

## 2. Честность превью — что видит игрок ДО нажатия

`divertEffects(player, effects, steps, {cardBeingPlayed})` — одна функция для всех семейств превью (розыгрыш, действие,
стандартный проект, конвертации, торговля колонией, финал):

1. чипы шкалы / океана / озеленения помечаются `diverted: {resolution, data, lost?}` с ПЕЧАТНЫМИ единицами (Р3: 13 % +
   «+2» → 2 data, не 1);
2. шаги `boardPlacement` озеленения/океана СНИМАЮТСЯ, остаток отражается синтетическим перечёркнутым чипом;
3. подразумеваемый РТ после перечёркнутого чипа СНИМАЕТСЯ (`impliedRatingOf` → нет; «+1 O₂ +1 РТ» не выживает);
4. добавляется шаг «куда» — `{kind: 'input', input: picker.previewSelectCard(), amount, cardResource: 'data', vpBox,
   for: {role: 'card', source: divertedSource(law.id)}}`. ⚠ Роль `'card'`, не `'diverted-data'`: адрес pre-select
   обязан совпасть с `promptAddressOf(live).role` живого промпта, иначе ответ паркуется навсегда (закон 27).

Прогноз: `grantOfEffect` пропускает перечёркнутые чипы (Зелёные не получают 2 M€ за шаг, которого нет);
`resolutionFacts` строит `ctx.diverted = {data, holder}` и даёт факт канала `'terraforming-diverted'` («точный» с
держателем, `skipped` без — причина «Diverted Research replaces the terraforming with data on one of your cards»).
Досье клетки: `placementFacts` для бонусов Hellas / Vastitas читают «1 data», не «океан / +2°».

Порядок выходных проходов: `withDivertedTerraforming` → `withImpliedRatings` → `withPreselectAddresses` (сначала
снять единицы, потом вывести РТ, потом адресовать).

---

## 3. Консоль

### 3.1 Чтение чипа — «перехвачено», никогда «нет эффекта»
`ActionEffectChip` в состоянии `--diverted`: печатная иконка перечёркнута красным Красных, хвост `[data-chip-diverted]`
«→ +N [data]», подсказка называет закон («Заменено законом «…»: N данных на одну из ваших карт»);
`--diverted-lost` — потеря без держателя. `gainHasNoEffect` / `gainAtParameterLimit` для перечёркнутого чипа —
ложь даже на потолке (unit-гард).

### 3.2 Pre-select «куда» по семействам (Р7)

| Семейство | Дверь | Как собирается |
| --- | --- | --- |
| розыгрыш карты / действие карты | композеры | шаг «куда» = обычный `input`-шаг превью — целевой ряд «КУДА: [печать]» (TR56), ответ в ОДНОМ POST с адресом |
| конвертация тепла (колесо) | `ConsoleActionConfirm` `convertHeat` | `acceptConfirm` находит `metadata.steps` → `pendingClientPick {host: 'confirm'}` — общий пикер встаёт В ПЛИТЕ (`[data-embed-slot="confirm-step"]`, формула остаётся над ним), ответ + опция = `submitBatch` |
| конвертация растений (колесо) | `ConsoleActionConfirm` `convertPlants` (новый вид) | опция ищется СТРУКТУРНО — `OptionMetadata.card === CONVERT_PLANTS` (`findConvertPlantsOption` → `{option}`), не по титулу; без закона — прежний `SelectSpace` |
| стандартный проект | `ConsoleStdProjectsScreen` | строка читает «→ 1 [data]» и «Далее: выберите карту для данных.» (никогда «место на поле»); A → пикер в зоне шага (`stdp-step`, «› ВЫБОР»), ответ = хвост батча проекта (`stdProjectPickResponse`) |
| финальное озеленение | `finalGreeneryModel` | `diverted` в модели, ветка = первый ЛИСТ, доходность `YIELD_DATA` («+1 data per greenery») |
| всё остальное (колония Европы, бесподобные) | живой промпт | общий пикер TR53 — `promptReceiveFamily` → `'plate'` по маркеру `resourceGainPrompt.diverted` (не ворота заседания: `isResolutionAsk` исключает, `followUpStepStage` не называет стадию) |

### 3.3 Сцена — где родился жетон

- **Композер (ACTION COMMIT):** импульс → ПЕЧАТЬ Красных на перечёркнутой иконке (`con-commit-seal` + штрих,
  `divertedSeal`) → жетон data рождается на этой иконке (`ResourceTransferSpec.bornOn`) → летит в капсулу выбранной карты
  (ряд композера, TR53-директор) → счётчик тикает на посадке. Маркер шкалы и планета не двигаются (`commitKindForBranch`
  перечёркнутого чипа никогда не `'global'`).
- **Хост-плита (конфирм тепла, стандартный проект):** клиентский пик — `armPromptReceive(wf, card, {client: true})`;
  `detectPromptReceive` принимает «стоит дверь» вместо «стоит пик»; **пик СТОИТ запечатанным, пока сцена играет** —
  `pendingClientPick.answered` + вотчер `clientPickSceneLive` закрывают дверь только когда сцена отпустила (конец после
  коммита или disarm); B поглощён. Жетон рождается на ВИДИМОЙ перечёркнутой иконке (формула конфирма), а где строка
  запаркована под шагом (стандартный проект — `--parked` = opacity 0) — на **ПЕЧАТИ ЗАКОНА** в плите
  (`[data-task-law-seal]`: эмблема партии на её акценте + имя резолюции; встроенная плита иначе без дока). Печать
  пульсирует (`pulseDivertedSeal`), жетон садится на капсулу кандидата (`slot:<card>` у свидетеля), карта уходит домой.

### 3.4 Уведомление и журнал
Карточка закона `…:law` «Сработал эффект» — источник «Принятая резолюция», строка закона «… заменяет N шаг(ов)
температуры … N данными», чип «+N [data]»; hold X → инспектор резолюции (`con-zoom--parliament`). Триггер
`'terraforming-diverted'` назван в `notificationCauseView` («за заменённое терраформирование»).

---

## 4. Задание (Р6)
`QuestTracker.eligible`: корень под источником резолюции не считается — КРОМЕ стека с триггером
`'terraforming-diverted'` (`EventRecorder.hasEffectTriggerOnStack`): data, перехваченная в СВОЁМ действии, идёт в
«4 data»; data принятия (корень `political-phase`) — нет.

---

## 5. Что НЕ заменяется
Венера; голый РТ (`behavior.tr`, Повестка); понижения; WGT / `unrewarded`; бот под `'none'` (под `'politics'` — заменяется на M€, D13); город /
особый тайл; часть победителя СЛЕДУЮЩЕГО закона (слот меняется до шагов).

---

## 6. Решения Р1–Р7 (приняты по умолчанию — автономный прогон)
Р1 «Перенаправленные исследования» · Р2 финал перехватывается (по букве) · Р3 ПЕЧАТНЫЕ шаги · Р4 один вопрос на операцию,
одна карта · Р5 гейты сняты · Р6 своя data в задание, data принятия — нет · Р7 pre-select в розыгрыше, действиях,
стандартных проектах, конвертациях, постройке колонии; живой промпт — остальное.

---

## 7. Проверка
Сервер: `tests/parliament/DivertedResearch.spec.ts` (40) · `DivertedResearchSweep.spec.ts` (свип скоупа) ·
`ResolutionContract` (RX35 6/6 + новая проверка `checkReplacingPass` — у заменяющего хука есть выходной проход превью) ·
профиль `'diverting law'` в `actionPromptCoverage` (`only: actionTerraforms`) и `cardPlayReplayCoverage`. Клиент:
`tests/client/components/console/divertedTerraforming.spec.ts` (7). e2e — ровно один:
`tests/e2e/console-parliament-diverted.spec.ts` (standard-1080 + tv4k, фикстура `parliament-diverted-enacted`:
красный 30 M€ · 8 тепла · Supercomputer · 13 % · −20 °C): ① список эффектов — закон первой; ② конфирм тепла → «куда» в
плите → температура не сдвинулась (сервер + readout), data +1, свидетель полёта (рождение `struck:`, посадка
`slot:Supercomputer`, ничего над стеклом); ③ карточка закона + hold X; ④ «Астероид» → «карту для данных», пикер в зоне
шага с печатью закона, −14 M€, data +1, рождение `lawseal`.

## 8. Слабые места (честно)
| Что | Почему терпимо | Чем закрыть |
| --- | --- | --- |
| Стандартный проект с АЛЬТЕРНАТИВНОЙ оплатой под законом (сталь/титан-проекты не терраформируют; тепло-оплата Астероида у Stormcraft-подобных) — шаг оплаты ВЫТЕСНИТ пик в том же хосте, сцена деградирует до тика | в скоупе нет корпорации, платящей теплом за стандартный проект, кроме Helion — у неё оплата теплом внутри M€-панели | очередь шагов хоста (пик → оплата) |
| Конфирм тепла после коммита один тик читает LIVE-опцию (её уже нет) до закрытия двери | `transportHolds.promptReceive` держит apply на всю сцену; тик невидим | заморозить формулу на нажатии |
| Карта-резолюция НЕ ИМЕЕТ поля лора в коде — выдуманная запись живёт только в реестре `turmoil-redux-invented-lore.md` | у всех резолюций так | поле `lore` у `ResolutionDefinition` |
| Свип считает data только у карт с ИЗВЕСТНЫМ печатным числом единиц; карты-строители колоний (Ice Moon Colony) и карты с собственной data (TR47) — контракт без счёта | печатные числа у них зависят от стола | счёт по `rallyPlan`-подобному плану |
