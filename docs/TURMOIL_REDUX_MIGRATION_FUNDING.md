# RX21 · Migration Funding (Марс вперёд) — счёт по полю как ВЕЛИЧИНА: два счёта над одной плиткой, объявление несёт меру

**Статус: СДАНА 2026-09-25.** Близнец Colonization Funding (RX08) над другой половиной доски: «при принятии
каждый игрок получает 2 M€ за каждый свой город на Марсе + влияние (каждый город в стопке считается
отдельно)». Задание председателя — 2 города на Марсе. Промт: `docs/claude/prompts/resolution-rx21-migration-funding.md`.
Файл карты: `src/server/parliament/resolutions/marsFirst/MigrationFunding.ts`.

Механизм — член семейства «счётчик + влияние»: выплата в ЗАПАС M€ штатной волной (путь RX13), счётный член по
ПОЛЮ (путь RX08). Ново ровно одно, и это то самое место, где карта ПРОТИВОПОЛОЖНА RX20 Skyscrapers: счёт по полю
здесь — **ВЕЛИЧИНА** (сумма ярусов стопок), тогда как счёт RX20 над теми же клетками — **НАЗНАЧЕНИЯ** (клетка
один раз, куда бы ни лёг ярус). Без стопок оба счёта равны на любой доске и расходятся ровно на стопку —
молчаливая ошибка, которую было бы не отличить от правильной работы до первой партии с надстроенным городом.

| | Colonization Funding (RX08) | Skyscrapers (RX20) | **Migration Funding (RX21)** |
| --- | --- | --- | --- |
| Клетки | города вне Марса (`COLONY`) | свои города на Марсе | свои города на Марсе |
| Вопрос | сколько космических городов | КУДА можно положить ярус | СКОЛЬКО у меня городов |
| Мера (`measure`) | `cells` — клетка раз | `cells` — клетка раз | **`tiers` — стопка суммируется** |
| Id счёта | `spaceCities` | `marsCities` | **`marsCityTiers`** |
| Число даёт | `getCitiesOffMars().length` | `getAvailableSpacesForCityTier().length` | **`MarsBoard.countCities(player, 'onmars')`** |
| Объяснение | список клеток | список клеток | **список клеток + столбец высот** |
| Единица | производство M€, max 6 | тайл | **запас M€, без потолка** |

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id | `RDX_MARSFIRST_MIGRATION_FUNDING` |
| Каталожный код | **`RX21`** |
| Партия | **Mars First / Марс вперёд** — четвёртая карта партии (Architecture Award, Development Craze, Skyscrapers) |
| Совместимость | нет: базовая карта |
| RU-название | «Финансирование миграции» |
| Арт | `assets/card-images/RX21.webp` (+ thumb; 1536×1024) — `node scripts/import-card-art.mjs "<Mars Arts/Migration Funding_art.png>" RX21` → `npm run make:cards` |
| Задание председателя | 2 тайла города на Марсе (`{goal: {kind: 'tile', tile: 'city'}, count: 2}` — то же задание, что у RX20; ключ текста общий) |
| Лицо | `2 [M€] / [город] + [влияние]` — город БЕЗ искры-сноски (искра — знак космического города RX08); строки потолка нет |

## 2. Правило и трактовки

Печатный текст: *Each player gains 2 M€ per city they own on Mars + Influence. (Each city in a stack counts
separately.)*

**Формула:** `2 × (C + I)` для **каждого** участника (голосовал или нет; нейтральная победа ничего не отменяет).
Потолка нет — `cap` не объявляется. Влияние платит само по себе: ноль городов и влияние 3 — это +6. Части
победителя, мирового шага и пассива нет.

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Что такое C | города игрока на Марсе, **каждый ярус стопки отдельно** — число даёт движок: `MarsBoard.countCities(player, 'onmars')` (та же функция, что у Mayor, Metropolist, `Counter`), клетки — `getCitiesOnMars(player)`, высота — `Board.tiersOf` | спек «counts the player's cities on Mars…», «a stack of 2 among three cities makes 4» |
| Космический город | вне Марса — не считается | спек «a space city is off Mars…» |
| Чужой город | чужой | тот же спек |
| Капитолий | городской тайл — считается | тот же спек |
| **`marsCities` (RX20)** | те же клетки, каждая ОДИН раз: 3 при 4 у этой карты; списки клеток совпадают, у назначений нет столбца высот | спек «THE DIVERGENCE» |
| Паритет стенда | `countSpacesToward('marsCityTiers', own)` = число, клетки И высоты движка по корпусу досок | спек «PARITY» |
| Нулевой результат | названный пропуск «Нет городов на Марсе и нет влияния» (`amount 0`, `countedSpaces []`, `countedTiers []`) — свой, не «нет влияния» | спек «a total of ZERO is named…» |
| Выплата | запас M€ через `stock.add` (события, реакции партий, рекордер); производство не трогается | спек «pays EVERY participant…» |
| Заморозка | запись несёт `count`, `counted: []`, **`countedSpaces` + `countedTiers`** (выровнены), `before`/`after`; поздний ярус, город, влияние и смена правительства ничего не пересчитывают; reload не платит дважды, стопка и высоты переживают сохранение | § «once per enactment» |
| Задание | двигают только города, размещённые собственным действием после принятия; стоящие — не ретроактивно | § «the chairman quest» |
| MarsBot | политика `none`: не считается, не получает; его стопка никому не засчитывается | спек «MarsBot (mode none)…» |

## 3. Общий слой — что выросло

### Мера board-счёта (`resolutionCounts.ts`)
- `ResolutionCountKind` для `board` — `{kind: 'board', tiles: BoardCountedTile, measure: BoardCountMeasure}`;
  `BoardCountMeasure = 'cells' | 'tiers'`. `spaceCities` и `marsCities` объявляют `cells`, `marsCityTiers` — `tiers`.
  Из объявления ВИДНО, суммирует ли счёт ярусы; по написанию id этого не угадать, и это намеренно.
- `ResolutionCountModel.tiers?: ReadonlyArray<number>` — столбец, выровненный со `spaces` (двойник `units` у карт):
  что дала каждая клетка. Клетка в списке ОДИН раз. Есть только у меры `tiers`.
- `CountedSpaceFacts = StackedCell & {id, spaceType}` — синтетическая клетка стенда и серверный `Space` делят поле
  `stackHeight`. `spaceCountVerdict` для обеих мер одинаков (вердикт — про клетку; вес — про меру);
  `countSpacesToward` для `tiers` суммирует через общую арифметику и кладёт `tiers`.

### Арифметика стопки — ОДНА (`common/boards/cityStack.ts`)
`tiersOf` / `cityTiersOf` / `countCityTiers` над минимальной формой клетки `{tile?, stackHeight?}` переехали в
`common`; серверный `boards/cityStack.ts` — типизированная дверь к ним над `Space` (все прежние импорты —
`Board`, `MarsBoard`, `Counter`, `Election` — работают без изменений). Ею считают и величина движка, и стенд.

### Сервер (`ResolutionCounts.ts`)
`boardCountSpaces(player, tiles, measure)`: для `marsCity` мера `cells` — список кандидатов яруса
(`getAvailableSpacesForCityTier`), мера `tiers` — список клеток движка (`getCitiesOnMars`). `boardCountQuantity` —
`countCities(player, 'onmars' | 'offmars')`. Для меры `tiers` число — величина, клетки — список, высоты — `Board.tiersOf`
по клетке; для `cells` — длина списка, как раньше.

### Модель / сохранение / чтение
`SerializedEnactOutcome.countedTiers`, `ParliamentEnactOutcomeModel.countedTiers`, `InfluenceYield.countedTiers`,
`YieldCount.tiers`, `fixedYield(..., {countedTiers})` — все необязательные, старые записи читаются как есть.

### Клиент
- **`influenceYieldModel.ts`** — запись `marsCityTiers` (глиф `{kind:'tile', tile:'marsCity'}`, плюрал «${0} city(-ies) on
  Mars» — ключ RX20, правило «Each city of yours on Mars counts: a stack of two counts twice…», пропуск «No cities on Mars
  and no influence»); `voteYieldsOf` / `enactedYieldsOf` прокидывают `tiers` / `countedTiers`; **`countedCellEntries`** (имя из
  слоя информации о доске + высота) и **`countedCellLabel`** («Ноктис ×2» — тот же «×n», что у карт и колоний, и счётчик
  самой доски).
- **`parliamentAnnotations.ts`** — «Для вас» у board-счёта: все клетки именованы → список с весом («Ноктис ×2 · Фарсида
  Толус»); есть безымянные → число и то, что делает его больше клеток: «4 города на Марсе · 3 клетки · стопка из 2»
  (ключи `${0} cell(s)`, `a stack of ${0}`); без стопки — число одно (как у RX08); ноль — «ни один тайл».
- **`premiumCardIcons.ts` / `PremiumCountGlyph.vue`** — `countedTileSpark(tile)`: искра только у `spaceCity`; глиф города
  на Марсе — голый, как печатает лицо (глиф `marsCities` RX20 потерял лишнюю искру тем же ходом).
- **Формула блока** при равных ставках — «2 [M€] / [город] + [влияние]» (ветка RX08 для `per ≠ perInfluence` не задействована).

### «Полигон»
Сценарий семейства `counted-board` объявляет **`counts`** (id счёта) и показывается только закону с этим счётом —
клетки RX08 с производством не про RX21 и наоборот. Синтетическая клетка знает `stackHeight` (`MARS_STACK_NOCTIS` —
стопка из 2 на Ноктисе, клетка с именем), ряд рисует «×N» на тайле (`.con-rxpg__cell-stack`), число ряда —
`countSpacesToward`. Сценарии RX21: 0 городов и 0 влияния · только влияние · три города без стопки · стопка из 2
(4 из 3 клеток, влияние 3 → 14) · космический город рядом не считается · у каждого своё · записанный результат ·
зритель · задание 1/2 · живой `parliament-migration-vote`. Заголовок результата — «Результат по городам на Марсе и
влиянию» (по мере, не по семейству).

## 4. Жизненный цикл

Шаг `megacredits` **мутирует**: `resolutionCount(player, 'marsCityTiers')` → `scaledAmount` →
`player.stock.add(M€, amount, {log: false, from: {resolution}})`; одна строка журнала несёт весь расчёт
(«${4} городов на Марсе × 2 + влияние ${5} × 2 (${6} → ${7})»). Ключ идемпотентности драйвера
`effect:<gen>:<instance>:<player>:megacredits`.

## 5. Проверки

- **Сервер:** `tests/parliament/MigrationFunding.spec.ts` (18) — каталог/код/одна карта/без потолка, формула, общность
  механизма и РАЗЛИЧИЕ меры, лицо без искры + задание, счёт по движку (три города, стопка = 4, ярус через
  `addCityTier` = 5, космический/чужой/озеленение/Капитолий), **THE DIVERGENCE** (3 против 4 на одном столе, те же
  клетки, у назначений нет высот; без стопки равны), **PARITY** по корпусу (клетки, число, высоты), принятие всем в
  запас (события `resource-changed`, нет `production-changed`), названный ноль, нейтральная победа, журнал + рекордер,
  заморозка (ярус/город/влияние/правительство), reload (стопка и высоты переживают), задание, MarsBot, модель с
  клетками и высотами. `tests/common/parliament/resolutionCounts.spec.ts` (+1): мера, вердикты, `countSpacesToward` с
  `tiers`, назначения без высот, `spaceCities` игнорирует высоту. Гард контракта проходит RX21 сам; RX08 / RX20 /
  стопки (`CityStack.spec`) — зелёные.
- **Клиент (mochapack):** `influenceYieldModel.spec.ts` (+4: декларация RX21, чтение «4 + 3 → 14» с клетками и высотами,
  запись, `countedCellEntries` / `countedCellLabel`), `parliamentAnnotations.spec.ts` (+1: именованная стопка «×2»,
  безымянные «4 … · 3 клетки · стопка из 2», две стопки, без стопки — число, запись, ноль), `PremiumCountGlyph.spec.ts`
  (+1: глиф города на Марсе без искры), `SkyscrapersReadings` и `voteInfoBudget` — регрессия.
- **e2e (ОДИН, один профиль):** `tests/e2e/console-parliament-migration.spec.ts` — стол (три клетки, стопка на доске,
  `citiesCount 4`), лицо (арт RX21, эмблема, город без искры, без «макс.», задание), панель голосования
  (`estimate · count 4 · influence 3 · amount 14`, без потолка и надбавки, голый глиф тайла, единица — запас),
  fullscreen (то же число, правило стопки, «4 города на Марсе · 3 клетки · стопка из 2»), оба паса по API → анонс →
  вердикт → A → второе место по API → волна: чип «14» рождён в графике карты (ВИДИМОЙ), сел в ячейку M€ рельсы
  (ВИДИМОЙ), пролёт, тик счётчика в кадре посадки, дельта-чип, +14 целиком; запись
  `{stock, 14, count 4, influence 3, countedSpaces ×3, countedTiers 1·1·2}`; стадия ИТОГИ. Фикстура
  `parliament-migration-vote`. Кадры: `screenshots/parliament-migration/standard-1080/`.

Прогоны — `docs/claude/parliament-sitting-progress.md` § RX21.

## 6. Что следующему board-счёту

Слово `BoardCountedTile` говорит, КАКИЕ клетки; `measure` — СКОЛЬКО весит каждая. Новый счёт объявляет оба; если
он суммирует стопки — число берёт у `countCities` (или у другой величины движка), а не у `.length`, и кладёт
`tiers`. Второй id над той же плиткой — не дубликат, а другой вопрос; спек обязан включать сценарий со стопкой,
иначе расхождение не проявится ни в одном тесте.
