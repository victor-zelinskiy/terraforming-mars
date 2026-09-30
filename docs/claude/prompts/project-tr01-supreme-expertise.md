# Промт исполнителю · TR01 Supreme Expertise («Высшая экспертиза») — пятая карта проектов Turmoil Redux

Выдан 2026-09-30. Инфраструктура набора стоит (TR09, TR08, TR66, TR02 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (все пункты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила карт — `.claude/rules/game-logic.md`.

**Одна новая механика — ВИД ТРЕБОВАНИЯ «N меток одного вида».** Тропа уже пройдена один раз: коммит TR02
`e68e8db190` («delegates on resolutions», 8 точек) — повторить её точка в точку. Всё остальное даром:

| Впервые в наборе | Образец, который уже зелёный | Что проверить |
| --- | --- | --- |
| вид требования `TAGS_OF_ONE_TYPE` | тропа `DELEGATES_ON_RESOLUTIONS` (`e68e8db190`); чтение «любого одного вида» — награда **Curator** (`src/server/awards/amazonisPlanitia/Curator.ts`: максимум по видам, без EVENT/WILD/CLONE, EVENT только под Odyssey) | счёт = максимум ПЕЧАТНОГО тег-требования по видам, не сумма |
| **зелёная** карта (AUTOMATED) | Imported Nitrogen (`base/ImportedNitrogen.ts`: `Card` + `IProjectCard`, `behavior.addResourcesToAnyCard`, `description`) | превью розыгрыша, причины, прогноз — авто |
| «добавьте data на ЛЮБУЮ карту» в скоупе | `addResourcesToAnyCard` декларативный: пик ВСЕГДА показан, даже с одним кандидатом (`autoSelect: false`, `AddResourcesToCard.ts:192–199`, превью `actionPreview.ts:583–600`); без держателя — предупреждение с названным эффектом (`actionPreview.ts:225–235`) | держатель data в скоупе ровно один — TR02 «Политология»; пара TR01 → TR02 замыкает петлю «data → добор» |
| плоские ПО | `victoryPoints: 4` | бейдж ПО на лице, эндгейм-разбивка |

---

## 0. Рабочее дерево
Перед стартом `git status`. Соседняя сессия коммитит в тот же `main` и СВИПАЕТ untracked — свои новые файлы
коммитить сразу, `git add` только по своим путям. Общие файлы (`TurmoilReduxCardManifest.ts`, `CardName.ts`,
`RequirementType.ts`, `CardRequirementDescriptor.ts`, `unplayableReasons.ts`, `src/locales/**`,
`lore_texts.json`, журнал) — только своя строка/ветка. `genfiles/**` не править руками.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR01.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR01.png` (1536×1024, стандарт) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR01.png" TR01` → `npm run make:cards`.

- **Supreme Expertise** · `cardNumber: 'TR01'` · стоимость **12** · тип **AUTOMATED** (зелёная рамка) · метка
  **Наука** (один кружок в углу).
- **Требование** — оранжевая плашка «MIN» у цены: **«10 [?]»**; текст: *Requires that you have at least 10 OF ANY ONE
  TYPE OF TAG.* → `requirements: {tagsOfOneType: 10}`.
- **Эффект розыгрыша:** 4 × [data] + `*` — *Add 4 data to ANY card.*
- **ПО 4** (планета Марс под цифрой — фон бейджа). Ресурса на карте нет.
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: по чеклисту §0 `compatibility` НЕ объявляется,
  символ — комментарием в манифесте (как у TR02).
- **Лор** EN: *«300 IQ»* → `assets/text/lore_texts.json` ключ `"TR01"` (первой строкой TR-блока, перед `"TR02"`).

### Правила чтения (каждое — закрепить спеком)
1. **Счёт = максимум по видам меток**, каждый вид считается РОВНО как печатное требование «N меток вида X»
   (`TagCardRequirement.getScore`, режим `'default'`). Отсюда даром и честно: дикая метка добавляется к каждому
   виду (и не суммируется через виды — берётся максимум); дикая метка Учёных (`ParliamentHandler.wildTags`) и
   надбавка R&D Funding к науке (`ParliamentHandler.tagBonus`, только `'default'`) считаются — розыгрыш карты
   есть действие; Habitat Marte / Earth Embassy — как у печатного требования.
2. **Виды = словарь Curator:** все `ALL_TAGS` без `WILD`, `CLONE` и `EVENT`; `EVENT` входит только при
   `player.tags.eventTagsInPlay()` (Odyssey) — сыгранные события лежат рубашкой вверх. Метки разных видов НЕ
   складываются: 5 строительных + 5 научных = 5.
3. Своя метка Науки карты не считается (требование проверяется до розыгрыша) — стандарт, спек на 9 науки.
4. **«ANY card» = ваша карта, принимающая data** (апстрим-чтение «ANY» для добавления: ресурсы кладут только
   на свои карты; `AddResourcesToCard` по своему табло). Сама карта ресурса не держит.
5. **Один держатель → пик всё равно показан** (подтверждение «Add resources to this card»), два → выбор.
   **Держателя нет → карта разыгрывается** (`mustHaveCard` нет), превью несёт предупреждение с названным
   эффектом «4 [data]»; никакого «+4» чипа. Проверить, что и после розыгрыша потеря названа (журнал /
   нотификация); если молчит ВЕСЬ класс (Imported Nitrogen без бактерий тоже) — записать гэп класса в журнал
   набора, не чинить поштучно.
6. **ПО плоские 4** — `victoryPoints: 4`, общий путь `Card.getVictoryPoints`.

## 2. Блок A · сервер

### A1 · Вид требования — тропа `e68e8db190`, восемь точек + одна общая функция
0. **Одно чтение тег-требования.** Вынести тело `TagCardRequirement.getScore` в экспортируемую функцию того же
   файла `tagRequirementScore(player, tag, {max, all})` (режим `'default'` / `'raw-pf'`, `all`, классический
   `hasTurmoilScienceTagBonus`) — `getScore` зовёт её. Словарь видов — метод **`Tags.tagTypesInPlay():
   ReadonlyArray<Tag>`** рядом с `eventTagsInPlay()` (правило 2). Curator (апстрим-файл) НЕ трогать — вместо
   этого спек паритета словаря (см. §5).
1. `RequirementType.TAGS_OF_ONE_TYPE = 'Tags of one type'` — рядом с `DELEGATES_ON_RESOLUTIONS`.
2. `CardRequirementDescriptor.ts`: `tagsOfOneType?: number` (комментарий: правила 1–2 одной фразой) + ветка
   в `requirementType()`.
3. `CardRequirements.compileOne` → `new TagsOfOneTypeRequirement({...descriptor, count: descriptor.tagsOfOneType})`.
4. `src/server/cards/requirements/TagsOfOneTypeRequirement.ts extends InequalityRequirement`, `getScore` =
   `Math.max(0, ...player.tags.tagTypesInPlay().map((tag) => tagRequirementScore(player, tag, {})))`.
   Ветку «множественные метки» в `CardRequirements.satisfies` (`:36–48`) не трогать — она только для `TAG`.
5. `Card.populateCount` → `?? requirement.tagsOfOneType`.
6. `buildCardInformation.requirementBlock` (рядом с TR02-веткой `:260`): EN
   `Requires ${enCount(n, 'tag', 'tags')} of any one type.` / ветка `max` — `Requires at most … of any one type.`
7. `unplayableReasons.ts`: **`{type: 'count', message: 'Requires ${0} tags of one type', params, current}`** +
   `FULLY_RESTATED_REQUIREMENTS`. **НЕ `type: 'tag'` с полем `tag`** (ведущий вид): `reasonParams`
   (`src/client/cards/tagLabel.ts:34`) при заданном `tag` ПОДМЕНЯЕТ параметры именем метки — вышло бы
   «Требуется меток одного вида: Наука». `current` — честный максимум («Сейчас: 7»).
8. Клиент: `premiumCardViewModel.ts REQUIREMENT_RENDER` → `{value: (d) => d.tagsOfOneType ?? d.count ?? 1,
   iconUrl: 'assets/tags/diverse.png'}` — **это ровно напечатанный «?»-диск** (тот же ассет рисует `DIVERSE_TAG`:
   Aridor, Interplanetary Trade — «разные метки»; смысл различает строка правил, картинка та же, что на скане);
   `unplayableReasonFormat.ts COUNT_MESSAGE_LABELS` → `'Requires ${0} tags of one type': 'Tags'` — **ключ
   существующий** («Метки», `ui.json:510`), рельс руки «Метки 7/10».
Гарды узнают сами: `requirementProse.spec.ts` (таблица субъектов `:125–126` → `/tags? of any one type/i`),
`premiumCardIcons.spec.ts`, `cardInformation.spec.ts` (без заметки «not templated»).

### A2 · Карта
```ts
export class SupremeExpertise extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SUPREME_EXPERTISE, type: CardType.AUTOMATED,
      tags: [Tag.SCIENCE], cost: 12,
      requirements: {tagsOfOneType: 10},
      victoryPoints: 4,
      behavior: {addResourcesToAnyCard: {type: CardResource.DATA, count: 4}},
      metadata: {
        cardNumber: 'TR01',
        renderData: CardRenderer.builder((b) => {
          b.resource(CardResource.DATA, 4).asterix();
        }),
        description: 'Requires that you have at least 10 of any one type of tag. Add 4 data to ANY card.',
      },
    });
  }
}
```
- Шапка файла — как у TR02: чтение скана и правила 1–6 (закреплены спеком).
- Скан печатает ЧЕТЫРЕ иконки data, не «4 [data]» — без `{digit}`; если премиум-лицо сворачивает повтор в цифру,
  это его стандарт, не править.
- `CardName.SUPREME_EXPERTISE = 'Supreme Expertise'` в секции `// Turmoil Redux`; манифест — строка с
  комментарием про символ Turmoil.
- Хуков нет: `cardPlayPreview`, причины, прогноз, пик и предупреждение о потере — декларативные.

## 3. Блок B · клиент — только две таблицы (§A1 п.8), всё остальное ПРОВЕРИТЬ
- Лицо: наука в углу, чип требования «[?] ≥ 10» в круглом гнезде как у меток, ряд «4 [data] *», бейдж ПО «4».
- Рука на столе с 7 метками одного вида: карта недоступна, рельс «Метки 7/10»; при 10 — доступна.
- Розыгрыш с TR02 в табло: композер «КАРТЫ В РУКЕ › ВЫСШАЯ ЭКСПЕРТИЗА › …» показывает шаг-подтверждение на
  «Политологии», полёт 4 data в её капсулу. Без держателя — предупреждение с названным «4 [data]», без чипа
  прироста.
- `ICON_NEEDLES` не трогать: импульс коммита — для действий; у карты действия нет.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: «Tags»/«Метки», «Data»/«Данные»,
«Add resources to this card», ключи предупреждения о потере. Новые (ожидается 5):
- `turmoil_redux_cards.json`: `"Supreme Expertise": "Высшая экспертиза"` (**имя — решение владельца**; запасной
  вариант «Высшая квалификация»); `"Requires that you have at least 10 of any one type of tag. Add 4 data to ANY
  card.": "Требуется не менее 10 меток одного вида. Добавьте 4 единицы данных на ЛЮБУЮ карту."` (голос —
  «единицу данных» из `colonies.json:150`).
- Причина — в `ui.json` рядом с TR02-ключом (`:145`): `"Requires ${0} tags of one type": "Требуется меток одного
  вида: ${0}"`.
- `card_info.json`: прозу требования `Requires 10 tags of any one type.` — что напечатает аудит
  (`missingTranslations`).
- `lore_texts.json` RU: `"300 IQ": "300 IQ"` — мем, латиницей, как Amazon у TR66 (**решение владельца**;
  вариант «Айкью — 300»).

## 5. Тесты
**`tests/cards/turmoilRedux/SupremeExpertise.spec.ts`** (структура — `EvaMechs.spec.ts`; Redux-стол
`testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true})`, метки через `fakeCard({tags})` в
`playedCards`):
- метаданные: имя, AUTOMATED, 12, `[SCIENCE]`, `TR01`, ПО 4, `requirements: {tagsOfOneType: 10}`;
- **требование:** 9 строительных → `canPlay` false, причина `{type: 'count', message: 'Requires ${0} tags of one
  type', current: 9}`; 10 строительных → true; 5 строительных + 5 научных → false, `current` 5; 9 науки + дикая
  метка → true; 10 событий (сыгранных) → false (EVENT вне словаря без Odyssey); 9 науки + дикая метка Учёных
  (правящие Учёные / 2 делегата — `seatEnacted` / `placeVote`) → true; 9 науки + принятая R&D Funding с
  влиянием ≥ 1 → true; `normalizeRequirement` → `diverse.png`, value 10, `min`;
- **розыгрыш:** TR02 в табло → `SelectCard` с одним кандидатом (не авто) → 4 data на «Политологии»; затем
  действие TR02 доступно и берёт карту (петля); два держателя (TR02 + `fakeCard({resourceType: DATA})`) →
  выбор из двух; держателя нет → розыгрыш без промпта, превью: предупреждение с `skipped` data 4, чипа
  прироста нет;
- ПО: 4 в `getVictoryPoints`.
**`tests/cards/requirements/`** (или рядом с `TagCardRequirement`-спеком): `tagRequirementScore` ≡ прежний
`getScore` на наборе столов (рефактор без изменения поведения); **паритет словаря**: на столе с Odyssey и без
него `Curator.getScore(player)` = максимум `count(tag, 'award')` по `tagTypesInPlay()` — словарь один.
**Гарды чеклиста § 3** — ворклист TR01 пуст; `make:cards` 0/0/0. **Клиентские:** кейс нового типа в
`premiumCardViewModel.spec`, компактная метка в спеке `unplayableReasonFormat`.
**e2e — НЕ писать** (политика § 5: вид требования — сервер + две таблицы, как у TR02 без e2e; пик «на любую
карту» доказан соседями). Фикстуры не добавлять.

## 6. Визуальная приёмка (один профиль, ТРИ кадра)
1. `?premiumCardsPlayground` (чип модуля turmoilRedux) — лицо: арт, наука в углу, чип «[?] ≥ 10», ряд
   «4 [data] *», бейдж ПО «4».
2. Рука: карта недоступна с рельсом «Метки N/10», тот же стол при 10 — доступна.
3. Розыгрыш с «Политологией» в табло: шаг-подтверждение на ней и итог — капсула «4».
Стол для 2–3 собрать временной расстановкой (блок в генераторе фикстур или дев-путь) — **не коммитить**.

## 7. Режим работы
**2 коммита**, зелёные по юнитам: (1) вид требования насквозь (общая функция + словарь + 8 точек + спеки
паритета); (2) карта + спеки + локаль + арт + лор + журнал. Перед каждым: `npm run lint`, `npm run build:test`,
`npm run make:cards`, `npm run make:json`; `npm run make:css` и `npm run build:server` (не голый `tsc`) перед
визуальной проверкой. **Не пушить.** Документ карты **не заводить** (контракт вида требования — тропа TR02).
В журнал набора: строка таблицы + раздел (что нового, решения: словарь Curator, режим печатного требования,
«ANY» = свои, имя/лор; гэпы). В чеклист § 4 — строка «НОВЫЙ вид требования → тропа `e68e8db190`, 8 точек; причина
— `type: 'count'`, не `'tag'` (`reasonParams`)».
Гочи: `python3` — заглушка Store; `cross-env` нет; юниты последовательно; `eqeqeq` без исключения для null;
новая карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в манифесте и
чинить классом (прецедент TR02 — MarsBot-спек `ParliamentPhase`).

В отчёте: точки тропы с путями; сигнатура `tagRequirementScore` и `tagTypesInPlay`; результат спека паритета с
Curator; три кадра; новые ключи i18n; что напечатали гарды до/после.

## 8. Нельзя
Сумма меток разных видов. Свой подсчёт меток мимо `tagRequirementScore` / свой словарь видов мимо
`tagTypesInPlay`. Правка `Curator.ts`. `type: 'tag'` в причине. Новый ассет «?» (есть `diverse.png`).
Авто-добавление data без показа цели. `mustHaveCard` (карта играется и без держателя). `compatibility:
'turmoil'`. Новый e2e / фикстура / документ карты. Трогать чужие незакоммиченные файлы. Пуш и красные коммиты.
