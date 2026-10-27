# TRP8 · Aerospace Company («Аэрокосмическая компания») — прелюдия с действием

Вторая прелюдия Turmoil Redux (2026-10-27). Скан `Prelude_-_TRP8.png`: магентовая плашка PRELUDE, метки КОСМОС + ЗДАНИЕ, без цены,
требования и ПО; один кадр действия «→ [мех]* OR [истребитель]*» — «(Action: Add 1 mech or fighter resource to ANY card.)». Лор:
«Rest assured that all lethal military androids have been taught to read…» (кредит «Daniel Jakobi» на кромке арта — художник).

Файлы: `src/server/cards/turmoilRedux/AerospaceCompany.ts` · спек `tests/cards/turmoilRedux/AerospaceCompany.spec.ts` · манифест
`preludeCards` (`compatibility: 'prelude'`) · фикстуры `aerospace` / `aerospace-none` / `aerospace-family` · e2e
`tests/e2e/console-aerospace-company.spec.ts` (TIMING).

## 1. Прелюдия с действием = `ActivePreludeCard` даром

Апстримная база `prelude2/ActivePreludeCard.ts` — «прелюдия + `action`-behavior»: `canAct` / `action` через Executor, превью
`declarative` выводится из `card.actionBehavior` (база не важна), причина недоступности — общая (`actionUnavailableReasons`,
«No card to add the resource to»). Розыгрыш — ПУСТОЙ `behavior`: карта ложится с двумя метками, прелюдия всегда разыгрываема (нет
гейта — нет «СГОРИТ»). Плитка в «Действиях карт» приходит сама: группы строятся из render-данных стола (`playerActionGroups`), тип
карты не фильтруется; `getPlayableActionCards` обходит `tableau`, где лежат прелюдии.

Метки: первая прелюдия набора с метками — Proteus (TR82) читает их у ПРОЧИХ прелюдий как обычно (спек: Mining Operations → Здание,
Orbital Construction Yard → Космос).

## 2. Список видов в DSL — что наследует следующая «A или B на любую карту»

`AddResource.type` (`behavior/Behavior.ts`) — теперь `CardResource | ReadonlyArray<CardResource>`. Ниже DSL список уже был везде
(Medical Database RX18): `AddResourcesToCard` объединяет держателей (`holders()`, порядок стола, каждый один раз), модель пика несёт
`cardResources` + `cardResourceByCard`. Читатели `type`, получившие список осознанно:

| Читатель | Что делает со списком |
| --- | --- |
| `Executor.canExecute` / `execute`, `actionUnavailableReasons`, `unplayableReasons`, `actionFutility`, `addAnyCardCandidates` | прокидывают в `AddResourcesToCard` как есть |
| `actionPreview.effectsForBehavior` (чип «+N … на карту») | ОДИН чип: `icon: 'resources'` + `icons: [mech, fighter]` (`ActionEffect.icons`) — одна единица, два чипа лгали бы о сумме |
| `actionPreview.stepsForBehavior` (шаг цели / предупреждение) | `cardResource` только для одного вида (`soleCardResource`); виды несёт маркер самого пика |
| `actionPreviews.addToCardStep` | сигнатура принимает список |
| `actionPreviews.skippedOrBranch` | `resource` — только одиночный вид |
| `buildCardInformation` | «Add 1 mech or fighter to any card.» — виды через «or», токен на каждый |

Хелперы: `actionPreviews.cardResourceIcons(type)` (иконки всех видов) и `soleCardResource(type)` (единственный вид или undefined) —
одна нормализация через `cardResourceKinds`. Форма `or` двух веток «сначала вид, потом держатель» НЕ пишется: карта несёт одно
правило хранения, вид следует из неё.

## 3. Гоча ① — заголовок пика

`AddResourcesToCard.pickTitle`: для пика над ДВУМЯ видами — новый ключ «Select a card — ${1} or ${2}: +${0}» (RU «Выберите карту —
${1} или ${2}: +${0}», существительные после тире — закон TR48). Раньше список печатал сырое «resources» (непереведённое, без видов).
Одиночный пик — прежний ключ побайтно (спек «a one-kind pick keeps its title»); «любой ресурс» и списки длиннее двух — прежнее слово.

## 4. Консоль — проверено, не строилось

- **Чип** — `ActionEffectChip.vue` рисует `effect.icons` одной капсулой «[мех] / [истребитель]» (`data-chip-kinds`) перед суммой.
- **«КУДА»** — общий шаг цели (`ConsolePlayedTargetStep`): каждый кандидат — со своей меткой роли по своему виду
  (`holderGainOutcome`), вид единицы — `cardResourceByCard` сервера. **Одна правка общего слоя** (найдена стендом B): груз пика
  (`playedTargetPayloadOf`) для нескольких видов без печати был `undefined` — строка композера падала на сырой заголовок пика
  вместо «КУДА: …». Теперь груз несёт `icons` из маркера сервера (`cardResources`), строка композера и контракт шага рисуют
  «КУДА: 1 [мех] / [истребитель]» (тот же «/», что метка выбора). Читает и Medical Database (RX18) — там вид «данные / бактерии».
- **Кадры 4K** (`screenshots/aerospace/tv4k-*`): «КУДА» над четырьмя и над ВОСЕМЬЮ держит строку целиком (решение 3 — (а), перефит
  не нужен); полёт: рождение на лице TRP8 (`hero`) → посадка на миниатюру выбранной карты (`composer-card:Mars Army Ships`).
- **Старт** — без «СГОРИТ» (у прелюдии нет гейта), без вопросов; карта на полке «РАЗЫГРАНО».
- **Без держателя** — плитка стоит с вердиктом «недоступно» и причиной сервера (стенд `aerospace-none`).

## 5. Стенды

`console-aerospace-company` (tv4k, TIMING): A — реальный старт через UI; B — `aerospace` (EVA 2 · Mars Army Ships 1 · Forestry 1 ·
Security Fleet 0): «КУДА» над четырьмя, истребитель на Mars Army Ships одним POST, свидетель полёта; C — `aerospace-none`; D —
`aerospace-family` (4 меха + 4 истребителя): кадр 4K «КУДА» целиком.
