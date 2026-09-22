# Turmoil Redux — Colonization Funding (RX08): счётный член по ПОЛЮ

Дата: 2026-09-23. Продолжение `TURMOIL_REDUX_ARCHITECTURE_AWARD.md` (шаблон «+N за X + влияние, макс. M»),
`TURMOIL_REDUX_CENTRAL_POWER_GRID.md` (счёт по меткам) и `TURMOIL_REDUX_CLOUD_DEVELOPMENT.md` (счёт по двум меткам).
Промт: `docs/claude/prompts/resolution-rx08-colonization-funding.md`.

Colonization Funding — восьмая настоящая резолюция и **третья карта семейства «счётчик + влияние → ограничение →
производство»**. У неё нет выбора игрока, нет встроенного шага, нет стадии и нет части победителя: выплата идёт штатной
волной производства M€, как у RX02 и RX04. Новое ровно одно, зато принципиальное: **счётный член считает ПОЛЕ, а не
табло** — городские тайлы игрока вне Марса. Механизм сделан членом семейства: следующий board-счёт (Migration Funding —
«2 M€ за город на Марсе») добавляется одним словом и одной веткой.

| | Architecture Award (RX02) | Central Power Grid (RX04) | Colonization Funding (RX08) |
| --- | --- | --- | --- |
| Счётчик | **КАРТЫ** табло | **МЕТКИ** табло | **ТАЙЛЫ** доски (клетки `COLONY` Марса) |
| Число даёт | общий предикат по картам | канонический `Tags.count` | канонический `MarsBoard.getCitiesOffMars` |
| Объяснение числа | список карт | карты с вкладом | **список КЛЕТОК** |
| Ставка | 1 за карту + 1 за влияние | 1 за метку + 1 за влияние | **2 за город** + 1 за влияние |
| Потолок | 5 | 5 | **6** |

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id (ключ сохранения) | `RDX_UNITY_COLONIZATION_FUNDING` |
| Каталожный код | **`RX08`** (8-я в алфавитном списке 48 официальных резолюций — спец. §4) |
| Партия | **Unity / Союз** — третья карта партии (после Cloud Development и Colonial Affairs) |
| Совместимость | нет: базовая карта (зарезервированные области вне Марса есть в базовой игре) |
| RU-название | «Финансирование колонизации» |
| Арт | `assets/card-images/RX08.webp` (+ thumb; 1536×1024, 3:2) — `node scripts/import-card-art.mjs "<Mars Arts/Colonization Funding_art.png>" RX08` → `npm run make:cards`. **Суффикс `_art` в имени файла** — у RX07 его не было |
| Файл | `src/server/parliament/resolutions/unity/ColonizationFunding.ts` (регистрация в `ResolutionCatalog.ts`) |
| Задание председателя | разместить 1 космический город (`{goal: {kind: 'tile', tile: 'spaceCity'}, count: 1}` — `QuestTracker.tileMatches` уже умел, `questRender` рисует город со звёздочкой) |

**Колода.** Пул без Venus — 7 карт четырёх партий (Greens 3, Mars 1, Industrialists 1, Unity 2), с Venus — 8.
Посевная раздача первого поколения сдвинулась: в слот 1 теперь ложится Aquifer Contest, и два спека `ParliamentPhase`,
пинавшие «тихого» победителя-игрока к слоту 1 / 0, встали на океане победителя — хелпер спеков получил `quietWinnerIndex`
(слот не Зелёных), Союз в `quietResolutionOf` → RX08 (производство, тихо для любого места и для победителя).

## 2. Правило и трактовки

Печатный текст: *When enacted: Increase your M€ production 2 steps for every space city you have + 1 more step per point of
Influence. (Max. 6)*. Задание: разместить 1 космический город.

**Формула:** `прирост = min(6, 2 × S + I)` для **каждого** участника (голосовал или нет; нейтральная победа ничего не
отменяет). Потолок режет **сумму**, не слагаемое и не итоговое производство (8 → 14 законно). Влияние платит само по себе:
ноль городов и влияние 3 — это +3. Части победителя нет.

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Что такое космический город | городской тайл игрока на клетке `SpaceType.COLONY` доски Марса — Колония на Ганимеде, Космопорт на Фобосе, Стэнфордский тор, области Венеры и Pathfinders; **число и клетки даёт движок** (`getCitiesOffMars`) | `ResolutionCounts.ts` (`boardCountSpaces`), спек «counts the player's city tiles on the reserved areas off Mars» |
| Город на Марсе | не считается | спек «a city ON Mars is not a space city…» |
| Чужой космический город | чужой | тот же спек |
| Пустая зарезервированная область | ничего | тот же спек |
| Область Венеры | считается как базовые (Dawn City) | спек «a Venus reserved area counts…» |
| Луна | другая доска — ни шахта, ни купол, ни дорога не космический город | спек «the Moon is another board…» |
| Общий предикат клетки (стенд) | `spaceCountVerdict` над `CountedSpaceFacts` — переизложение правила движка для синтетической клетки; **паритет с движком по корпусу досок закреплён спеком** | спек «PARITY: the shared cell predicate…» |
| Влияние | канонический `parliament.influence(player)` после шага победителя по Повестке | спек «raises EVERY participant's…», «a neutral winner…» |
| Нулевой результат | названный пропуск «Нет космических городов и нет влияния», `amount 0`, `countedSpaces []` | спек «the cap bounds the INCREASE…» |
| Заморозка | запись несёт `count`, `counted: []`, **`countedSpaces`**, `uncapped`, `before`/`after`; поздний город и влияние ничего не пересчитывают; reload не платит дважды | § «once per enactment» |
| Задание | двигает только СВОЙ космический город, размещённый собственным действием (Ganymede Colony через розыгрыш); город на Марсе — нет; принятие — нет; стоящий тайл — не ретроактивно | § «the chairman quest» |
| MarsBot | политика `none`: не считается, не получает; его космический город никому не засчитывается | спек «MarsBot (mode none)…» |

## 3. Общие расширения (что переиспользовано и что выросло)

### Общий слой
- **`resolutionCounts.ts`** — третий вид счёта: `ResolutionCountKind = {kind:'cards'} | {kind:'tags', tags} |
  {kind:'board', tiles: BoardCountedTile}`; `BoardCountedTile = 'spaceCity'` (следующее слово — `'marsCity'`).
  Модель счёта получила `spaces?: ReadonlyArray<SpaceId>` (у board-счёта `cards` пуст) — ОДНА модель на все три вида.
  `CountedSpaceFacts` (id · spaceType · tile) — то, что делят серверный `Space` и синтетическая клетка стенда;
  `spaceCountVerdict` (причины: «On Mars — not a space city», «No city tile here», «Counted among cards, not on the board»),
  `countSpacesToward`. Карта к board-счёту: `cardCountVerdict` → «Counted on the board, not among cards», `cardCountUnits` 0.
- **`ResolutionCounts.ts` (сервер)** — `resolutionCount` ветвится по виду: `board` → `boardCountSpaces(player, tiles)` →
  `player.game.board.getCitiesOffMars(player)`; число = длина списка, клетки = их id. Табло не читается вовсе.
- **`influenceScaling.ts`** — `InfluenceYield.countedSpaces`, `YieldCount.spaces`, `fixedYield(..., {countedSpaces})`.
  Арифметика (`scaledAmount` / `uncappedAmount`) не изменилась ни на строку: `per: 2` уже был параметром члена.
- **Модель / сохранение** — `SerializedEnactOutcome.countedSpaces`, `ParliamentEnactOutcomeModel.countedSpaces`
  (необязательные: старые сохранения читаются как есть).

### Клиент
- **`premiumCardIcons.ts` / `PremiumCountGlyph.vue`** — `CountedObjectGlyph += {kind:'tile', tile}`: город тем же
  ассетом, что печатает лицо для `b.city()` (`countedTileIconUrl`), плюс искра лица `.pcard-sym--asterix`
  (`.pcglyph--tile`, `premium_card.less`). Глиф чтения и графика карты не могут разойтись.
- **`influenceYieldModel.ts`** — запись `spaceCities` (глиф плитки, `'${0} space city(-ies)'`, правило, причина пропуска);
  `voteYieldsOf` / `enactedYieldsOf` прокидывают `spaces` / `countedSpaces`; **`countedCellNames`** — имена клеток из
  слоя информации о доске (`getSpecialCellInfo(id).title`), безымянная клетка — `undefined`, а не выдуманное имя.
- **`ConsoleInfluenceYield.vue`** — формула с ДВУМЯ ставками, когда `count.per ≠ perInfluence`:
  «2 [пр. M€] / [город*] + 1 [пр. M€] / [влияние] · макс. 6» (`data-yield-count-rate`); при равных ставках — прежняя
  «1 [ед.] / [объект] + [влияние]». Чтение — «[город*] 2 + [влияние] 3 → +6 МАКС.», `uncapped 7` в данных.
- **`parliamentAnnotations.ts`** — «Для вас» у board-счёта: «Учтены сейчас: Колония на Ганимеде · Космопорт на Фобосе»;
  среди клеток есть безымянная — «Учтены сейчас: 2 космических города» (число + правило выше); ноль — «Сейчас не
  учитывается ни один тайл» / «При принятии не учтено ни одного тайла».
- **Голосование, заседание, итоги, журнал, полёт производственного чипа** — без изменений: всё это читало
  декларацию и запись, не имя карты.

### «Полигон» («Витрина резолюций Redux»)
Семейство `counted-board` (`resolutionFamily.ts`: `kind === 'board'`), сценарии на НАСТОЯЩИХ клетках доски
(`PgSeat.cells: CountedSpaceFacts[]` — `01`, `02`, `69`, `71`, пустая `02`, город на Марсе `35`), счёт — общим
`countSpacesToward`, вердикт каждой клетки — `spaceCountVerdict`, имя — из `getSpecialCellInfo`: 0 городов и 0 влияния ·
только влияние · только города · ниже максимума · ровно +6 · сверх максимума · город на Марсе не считается · пустая
область · область Венеры · у каждого своё · победитель шагает по Повестке · отрицательное производство · записанный
результат · зритель · задание 0/1 и выполнено · живой сценарий `parliament-colonization-vote`.

## 4. Жизненный цикл и однократность

- Шаг `production` **мутирует** (ничего не спрашивает): `resolutionCount(player, 'spaceCities')` → `scaledAmount` →
  `player.production.add(M€, amount, {log: false, from: {resolution}})` — штатное изменение с событиями рекордера; одна
  строка журнала несёт весь расчёт («${4} космических города × 2 + влияние ${5} = ${6}, ограничено максимумом ${1}»).
- Ключ идемпотентности драйвера `effect:<gen>:<instance>:<player>:production`: reload / повторный вход не платят дважды;
  прерывание между игроками платит второму один раз; повторное принятие в новом поколении — новое начисление по доске
  того момента.

## 5. Проверки

- **Сервер:** `tests/parliament/ColonizationFunding.spec.ts` (21) — каталог/код/одна карта, все примеры формулы,
  общность механизма с RX04, счёт по движку (Марс / чужой / пустая область / Венера / Луна), паритет общего предиката,
  начисление всем, потолок суммы 8 → 14, влияние само по себе, нейтральная победа, журнал + рекордер, заморозка, reload,
  прерывание между игроками, задание, MarsBot, модель с клетками. `tests/common/parliament/resolutionCounts.spec.ts` —
  вид `board`, вердикты клеток, модель с клетками, карта к board-счёту. Гард контракта `ResolutionContract.spec.ts`
  проходит RX08 сам. Юниты RX02 / RX04 / RX06 / RX07 — зелёные (защита общей модели вместо прогонов e2e).
- **Клиент (mochapack):** `influenceYieldModel.spec.ts` (декларация RX08, чтение «2 + 3 → +6» с потолком и без надбавки,
  вход только по влиянию, записанные клетки, `countedCellNames`), `parliamentAnnotations.spec.ts` («Для вас» клетками /
  числом / «ни один тайл»), `PremiumCountGlyph.spec.ts` (глиф плитки = ассет города + искра лица; остальные виды прежние).
- **e2e (ОДИН, один профиль):** `tests/e2e/console-parliament-colonization.spec.ts` — лицо (арт RX08, эмблема Союза, город
  с искрой, «макс. 6», задание), панель голосования (`estimate · count 2 · influence 3 · amount 6 · uncapped 7 · max`,
  без надбавки за победу, глиф плитки, единица — производство), fullscreen (то же число, клетки по именам, правило),
  затем оба паса по API → анонс → вердикт → A → второе место по API → волна: чип рождён в графике карты (ВИДИМОЙ),
  сел в ячейку производства M€ (ВИДИМОЙ), пролёт, тик счётчика в кадре посадки, дельта-чип, запись сервера
  `{amount 6, count 2, influence 3, uncapped 7, countedSpaces ['01','02']}`, стадия ИТОГИ. Фикстура
  `parliament-colonization-vote`. Кадры: `screenshots/parliament-colonization/standard-1080/`.

Прогоны — `docs/claude/parliament-sitting-progress.md` § Colonization Funding.

## 6. Рецепт: следующий board-счёт (Migration Funding — «город на Марсе»)

1. `BoardCountedTile += 'marsCity'`; ветка в `spaceCountVerdict` (`spaceType !== COLONY` и тайл города; причина —
   «Off Mars — not a city on Mars»); строка в `boardCountSpaces` сервера → `getCitiesOnMars(player)`.
2. Id счёта в `RESOLUTION_COUNT_IDS` + `resolutionCountKind` → `{kind: 'board', tiles: 'marsCity'}`;
   `cardCountVerdict` → «Counted on the board, not among cards».
3. Презентация в `yieldCountPresentation` (глиф `{kind:'tile', tile:'marsCity'}` — если лицо печатает город БЕЗ
   искры, глифу нужен вид без искры: `PremiumCountGlyph` рисует то, что печатает лицо), плюрал, правило, причина пропуска.
4. Имена клеток на Марсе слой информации о доске не даёт (кроме именованных гор) — «Для вас» напечатает число;
   стенд — семейство `counted-board` с клетками Марса.
5. Дальше ничего: декларация `scaled`, шаг через `resolutionCount` + `scaledAmount`, `ctx.report` — голосование,
   fullscreen, итоги с полётом и «Полигон» подхватывают карту сами.

> Стек-города Migration Funding («стек считается отдельно») — вопрос движка (клетка хранит один тайл), не счётного члена.
