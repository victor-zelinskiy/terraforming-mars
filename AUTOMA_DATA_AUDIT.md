# AUTOMA_DATA_AUDIT — источники данных MarsBot и статусы верификации

Обновлено: 2026-07-07. Официальные источники: **RB-A** = TM-Automa rulebook A (08-15-2023, база, 12 стр.),
**RB-C** = TM-Automa rulebook C (11-14-2023, Adding Expansions, 16 стр.), **SG** = Setup Guide v1.3 (10-10-2024).
Извлечение текста: `pdftotext` (Git mingw64). Извлечение изображений компонентов: `pypdfium2` рендер
RB-A p.2 (страница компонентов) в масштабе 22–30, покомпонентные кропы.

## 1. Нумерация бонус-карт — КОНФЛИКТ ИСТОЧНИКОВ (решено: canonical identity = имя карты)

RB-C (11-2023) и SG v1.3 (10-2024) расходятся в B-номерах Colonies/Turmoil-карт, причём RB-C
противоречит сам себе (Government Intervention = B16 в Venus-секции И Colonies Expedited
Construction = B16 в Colonies-секции):

| Карта | RB-C | SG v1.3 | RB-A (компоненты) | **Canonical (наш enum)** |
|---|---|---|---|---|
| Lobbyists (Venus) | B15 | B15 | — | `B15_LOBBYISTS_VENUS` |
| Government Intervention | B16 | B16 | **B16** (p.6, анатомия карты) | `B16_GOVERNMENT_INTERVENTION` |
| Expedited Construction (Colonies) | ~~B16~~ | B17 | — | `B17_EXPEDITED_CONSTRUCTION_COLONIES` |
| Outer System Foothold | ~~B17~~ | B18 | — | `B18_OUTER_SYSTEM_FOOTHOLD` |
| Shipping Lines | ~~B18~~ | B19 | — | `B19_SHIPPING_LINES` |
| Extended Shipping Lines | ~~B19~~ | B20 | — | `B20_EXTENDED_SHIPPING_LINES` |
| Party Politics | ~~B20~~ | B21 | — | `B21_PARTY_POLITICS` |

RB-A p.6 печатает Government Intervention с номером **B16** → нумерация SG v1.3 согласована с
физическими компонентами; RB-C содержит опечатку сдвига. **Поведение карт привязано к имени
(enum-член), номер — только отображение.** `BonusCardId` в `src/common/automa/AutomaTypes.ts`
следует SG v1.3.

## 2. Tharsis MarsBot board (`src/server/automa/boards/TharsisMarsBot.ts`)

Статус: **принят как верный baseline** (решение владельца проекта, 2026-07-07). Повторная
физическая сверка НЕ блокирует POC. Функциональное поведение покрывается тестами против RB-A.

## 3. Venus Next MarsBot board (`src/server/automa/boards/VenusMarsBot.ts`)

Статус: **транскрибирован** с RB-A p.2 (кроп «1 Venus Next MarsBot board», масштаб 26–30).
Один трек VENUS, позиции 0–12 (`maxPosition: 12`):

| Поз. | Иконка на компоненте | Действие |
|---|---|---|
| 0 | — (старт, клетка с маркером V) | — |
| 1 | одиночное жёлтое облако | Gain 1 floater |
| 2 | сдвоенное жёлтое облако | Gain 2 floaters |
| 3 | дуга Venus-шкалы | Raise Venus 1 step |
| 4 | сдвоенное облако | Gain 2 floaters |
| 5 | дуга Venus | Raise Venus 1 |
| 6 | — | — |
| 7 | сдвоенное облако | Gain 2 floaters |
| 8 | дуга Venus | Raise Venus 1 |
| 9 | **круглая тег-иконка: бактерия (microbe)** | Advance another track → Bio (верифицировано) |
| 10 | дуга Venus | Raise Venus 1 |
| 11 | сдвоенное облако | Gain 2 floaters |
| 12 | красный квадрат «5» (иконка Gain TR из легенды RB-A p.8) | Gain 5 TR |

Проверка согласованности: суммарные флоатеры за полный трек = 1+2+2+2+2 = 9 ≥ 7 (Hoverlord). ✓

- **ВЕРИФИЦИРОВАНО (2026-07-07, владелец, физический компонент):** поз. 9 — метка
  **бактерии (Microbe)** → Bio-трек; альтернативное прочтение Jovian → Energy исключено.
  Кодировка `VENUS_CELL9_TARGET_TRACK = 6` (Bio) в `VenusMarsBot.ts` подтверждена, TODO снят.
- **Note:** иконка floater-storage зоны справа от трека на компонент-миниатюре читается как
  «5 [зелёный квадрат с лапой] → +[карта]» — похоже на арт ранней ревизии (animal-тег вместо
  floater-иконки). Поведение реализуется ПО ТЕКСТУ RB-C p.2 (однозначен): 5 floaters →
  дополнительная карта action deck в Research Phase. На геймплей иконка не влияет.

## 4. Colonies Shipping Board (`src/common/automa/ShippingBoardData.ts`)

Статус: **транскрибирован полностью** (RB-A p.2, кропы построчно, масштаб 22; текстовые правила
RB-C pp.4–5 совпадают с печатной сводкой на самом планшете — жёлтая сноска «COLONY INTERACTION
EFFECTS» прочитана и совпадает дословно).

| Область | Хранимый ресурс | «5 → тег» (обмен → трек) |
|---|---|---|
| Ceres | сталь | Building |
| Luna | M€ | Event |
| Io | тепло | Earth |
| Enceladus | микробы | Microbe (Bio) |
| Ganymede | растения | Plant (Bio) |
| Callisto | энергия | Power (Energy) |
| Miranda | животные | Animal (Bio) |
| Triton | титан | Space |
| Pluto | «карты»-суррогат | Science |
| Titan | флоатеры | — (обмена нет; floaters по Venus-правилам) |
| Europa | — (не хранит) | — (build→океан+TR / trade→+1 TR / colony bonus→+1 M€) |

Нотация подтверждена: круглая тег-иконка = «advance track, соответствующий тегу» (та же
нотация, что у Advance Another Track). Второй trade fleet: SG «space 9 of the power track» —
для Tharsis это Energy track, клетка 9 (RB-C p.6: «in addition to resolving the space's
effect» — эффект клетки 9 Energy-трека Tharsis (`temperature`) резолвится, флот разблокируется,
Extended Shipping Lines подмешивается со следующего поколения).

## 5. Полные тексты бонус-карт

| Карта | Полный текст | Источник |
|---|---|---|
| B01–B08 (base) | ✓ | RB-A pp.6–7 |
| B15 Lobbyists (Venus) | ✓ (4 ветки: temp / oxygen / **venus 2 steps без destroy** / furthest-Martian; ocean-ветки base-версии НЕТ) | RB-C p.3 |
| B16 Government Intervention | ✓ (чёт/Venus-complete → furthest MARTIAN param [tie: O₂→ocean→temp]; иначе Venus+1; без TR/MC вкл. каскадные бонус-подъёмы) | RB-C p.3 + RB-A p.6 |
| B17 Expedited Construction (Colonies) | ✓ (city≥2 greenery/ocean → destroy; иначе если колоний ≤1 → построить колонию flip-методом + 2 ресурса, БЕЗ destroy; иначе ничего) | RB-C p.4 |
| B18 Outer System Foothold | ✓ (колония flip-методом + 2 ресурса; затем draw из BONUS deck и discard без резолва — reshuffle без самого OSF) | RB-C p.5 |
| B19/B20 Shipping / Extended Shipping Lines | ✓ (тайл с самым продвинутым треком → tie: где колония бота → tie: flip-метод; −1 MC и trade) | RB-C p.5 |
| B21 Party Politics | ✓, но Turmoil вне POC | RB-C p.6 |
| B09–B14, B22–B32 | вне POC (карты/Awards&Milestones/корпорации) | — |

## 6. Venus-правила, закрытые RB-C (бывшие блокеры B1/B4)

- Setup: Venus board + clear cube на 0; B06→B15; B16 set aside; **B16 подмешивается в action deck
  каждое поколение, ВКЛЮЧАЯ ПЕРВОЕ** (RB-C p.2 «including on the first round» — уточнение к SG).
- **Floater-spend в конце Research Phase** (если Hoverlord недоступен И ≥5 флоатеров): драфт —
  оставить 4-ю карту вместо дискарда; не-драфт — получить 4-ю карту из project deck; Brutal — 5-ю.
- Venus tag → Venus track; трек ведёт себя идентично прочим (включая Failed при maxed).
- **Solar Phase Step 2 (WGT) НЕ выполняется** — его роль играет B16; MarsBot+Venus без B16 нельзя.
- Planner (Tharsis): все треки ≥4 **кроме Venus** (подтверждено RB-C p.2).
- Hoverlord: 7 флоатеров; в leftmost-тайбрейке считается ПОСЛЕДНИМ. Venuphile: позиция Venus-трека;
  в leftmost-тайбрейке ПОСЛЕДНЯЯ.
- Corporate Competition получает helper «Venuphile: advance Venus track» во всех версиях.
- **Открытый вопрос OQ-7:** бонус-шаги шкалы Венеры 8% (card draw) для бота RB-C не оговаривает.
  16% (+1 TR) покрыт «TR per the normal rules». Принято: 8%-бонус к боту не применяется (у бота
  нет руки; явной замены не прописано) — пересмотреть при появлении официального разъяснения.

## 7. Colonies-правила, закрытые RB-C (бывший блокер B2)

- Setup: 2p-раскладка, но ВСЕ тайлы (вкл. Titan/Enceladus/Miranda) стартуют трекером на
  выделенной 2-й клетке; B05→B17; B18 в bonus deck; Shipping Board; 2 trade fleet бота
  (второй на Energy-track-9); B19/B20 set aside.
- Research: со 2-го поколения в action deck подмешивается B19 (+B20 после разблокировки флота).
- Storage-переполнение: в ЛЮБОЙ момент хода бота ≥5 ресурсов в области (кроме Titan) → −5,
  advance трека по тегу области.
- Трейды/колонии/Europa/Pluto/Titan — см. §4 и RB-C p.5 дословно.
- Floater-spend действует и без Venus («assuming Hoverlord is no longer available»).
- Human steal/remove МОЖЕТ таргетить storage-ресурсы бота как ресурсы соответствующего типа.

## 8. Печатный порядок тегов (решение)

Canonical = порядок массива `tags[]` карты — ровно то, что продукт рендерит игроку
(`CardTags.vue`, слева-направо). MarsBot резолвит теги в отображаемом порядке. Полный аудит всех
карт НЕ блокирует POC; очевидные расхождения in-scope мульти-теговых карт правятся точечно.
Event-карты: `Tag.EVENT` не хранится в `tags[]` (тип карты) — резолвер добавляет event-тег
согласно печатной позиции (последним). Покрыть тестом.
