# TR79 Ferrus Academy — кампус: удвоенный бонус клетки, кольцо кубов, «3 данных или карта»

Вторая из восьми НОВЫХ корпораций набора Turmoil Redux (не замена). Скан — `…/TM Turmoil Redux/Corporations/Corporation -
Ferrus Academy.png`, арт `assets/card-images/TR79.webp`, лор TR79 (EN `assets/text/lore_texts.json`, RU `src/locales/ru/lore_texts.json`).
Промт — `docs/claude/prompts/redux-corp-ferrus-academy.md`. Карта — `src/server/cards/turmoilRedux/FerrusAcademy.ts`.

**Печатное:** 40 M€ + 1 производство растений, метки Наука + Город, без ПО. ⚠ **Опечатка скана:** на плашке 40, в тексте правил 45 —
верно 40 (владелец 2026-10-26); 45 нигде не встречается (спек проверяет описание).
**Первое действие:** город по обычным правилам городов; ПЕЧАТНЫЙ бонус его клетки удвоен; затем куб игрока на каждую соседнюю
незарезервированную клетку — строить там может только он.
**Эффект:** тайл на клетку со своим кубом → 3 данных на ЛЮБУЮ карту ИЛИ карта.

## 1. Множитель печатного бонуса — ОДНА нить

`AddTileOptions.printedBonusMultiplier` (`IGame.ts`) → `Game.addTile` → `grantPlacementBonuses(…, multiplier)` → `grantSpaceBonuses(player,
space, multiplier)` — ЕДИНСТВЕННОЕ место умножения: счётный бонус выдаётся одним вызовом с `printed × N` (удвоенная «карта» = ОДИН
добор из 2 — закон «одно действие — один забор»), бонус-ПРЕДЛОЖЕНИЕ (океан / температура / колония / делегат — `OFFERED_ONCE_SPACE_BONUSES`)
предлагается N раз, а не схлопывается в счёт. `CellBonusPaid` несёт честные суммы → `publishTilePlacement` → запись языка тайлов.
Океанская прибавка, Ares-соседи, партии, бонус за снятие опасности — НЕ в `grantSpaceBonuses`, поэтому ×1 по построению.

Превью: `SelectSpace.printedBonusMultiplier` (сериализуется в своём `toModel` — nesting-safe) → клиент шлёт `bonus=N`
(`boardInfoState.buildBoardCellUrl`, 9-й аргумент `fetchBoardCellPreview`; в ключе кэша) → маршрут → `PlacementPreviewContext.printedBonusMultiplier`
→ `printedBonusFacts` печатает `× N` С ПРИЧИНОЙ («The printed bonus counts ×${0}»), а `placementPreview` карты-источника добавляет
факт-источник `ferrus-printed-bonus`. Спек: `tests/boards/PrintedBonusMultiplier.spec.ts`.

## 2. «Построено на своём кубе» — одно чтение, один хук, два получателя

Куб — `space.player` без провенанса: Land Claim, Arcadian Communities и Ferrus кладут ОДНО состояние поля. `Game.addTile` читает
`builtOnOwnMarker = !stacking && space.player === player && !Board.hasRealTile(space)` ДО посадки (после `simpleAddTile` поле
уже не отличает куб от тайла). Получатели:
- движок: `arcadianCommunityBonus = builtOnOwnMarker && (Arcadian || бот C18)` — +3 M€ как раньше (бот C18 делит выплату);
- стол: `ICard.onOwnMarkerBuilt(player, space)` — fan-out по `player.tableau` после бонусов, под `events.withEffect(…, 'own-marker-built')`
  (новый `EventTrigger`; подпись причины «за тайл на вашем участке»; канал эффекта Ferrus в `effectChannels.ts`).
Превью: семья `markedAreaFacts` (`marked-area-arcadian` — «Your marked area») + `tilePlacedPreview` Ferrus (`marked-area-ferrus`, `tableAnswer`
— «Сработает»). При Arcadian + Ferrus у одного игрока стоят ОБЕ строки. Спек: `tests/boards/OwnMarkerBuilt.spec.ts`.

**Предикат маркера — один на троих:** `MarsBoard.isNonReservedLand(space)` (суша / бухта / зона отражения, не Ноктис, без тайла — опасность
не считается, без чужого куба); `getNonReservedLandSpaces` фильтрует им, reasoner Arcadian читает его же, кольцо Ferrus — его же.

## 3. Нейтральное имя маркера

Общие поверхности больше не говорят «община»: `'already-marked'` → «This area already holds your marker» / «Здесь уже стоит ваш куб»;
факт клетки → «Your marked area» / «Ваш участок». Печатные тексты Arcadian / Land Claim не тронуты. Статы `arcadian*` в `insightEngine`
— это статы БОТА C18 (`MarsBotArcadianCommunities`), не общая поверхность маркера: не переименованы.

## 4. Карта

`initialAction` — bespoke: `createMarsSelectSpace(… placementType 'city', tileType CITY, sourceCard, printedBonusMultiplier: 2)` → в том же
`andThen`: `addTile(…, {printedBonusMultiplier: 2})` + кубы на `reservableRing` (соседи по часовой из `getAdjacentSpaces`, отфильтрованные
предикатом) + одна строка журнала. Reload между городом и кубами невозможен. `firstActionPreview` — шаг поля + две заметки
(«печатный бонус удвоен», «куб на каждую соседнюю … до 6»).

Вопрос — ОДИН билдер `question(player)`: `OrOptions` [«Add 3 data to ANY card» → `AddResourcesToCard(DATA, 3, autoSelect: false, cause:
corporation)` · «Draw a card»], `markChoiceContext(cardEffect(…, 'effect-choice'))`. Без держателя данных вариант ВИДЕН отключённым
(`setDisabledOptions` с причиной «No card can hold data»), «карта» — единственная живая ветка (всё равно спрашивается).

## 5. Консоль

- **Силуэты.** Факт `marked-area-reserve` несёт `spaces` кольца и структурный флаг `BoardFact.reservesSpaces`; клиент читает его
  через `placementRelations.reservedSpacesOf` (из релейшн-слоя такой факт исключён — один голос) и `ConsoleBoardSection` рисует на каждой
  клетке `PlayerCube` игрока внутри посадочного места клетки (`.con-reserve-ghost`, opacity .5 — материал, без ореола), пока стоит ретикл
  (фаза lock включительно); уходит вместе с ретиклом под hero-сцену.
- **Кубы по одному.** Свой город: hero-сцена сажает город и его куб, затем `gameTransport` (ветка `ownerCubeRing` — свежие кубы ответа при
  собственном hero) `landOwnerCubesInTurn`: каждый куб держится скрытым в синхронном блоке покраски, затем `dropHeldCubesInTurn` — по часовой
  от верха города (`clockwiseFromTop` по измеренным центрам), шаг `OWNER_CUBE_RING_STEP_MS` через `motionMs`, держатель реестра
  `owner-cube-ring` отпускается касанием ПОСЛЕДНЕГО куба; коммит ждёт его (барьер старта держится `tilePlacementState.active`).
  Чужой Ferrus: `stageRemotePlacements` прикрепляет кубы цвета посаженного тайла к его событию (`ring`), держит их и после куба
  города роняет тем же `dropHeldCubesInTurn`. Reduced motion — все кубы в покое сразу.
- **Выплата ×2** (решение §8 п.1 (а) по умолчанию): hero-сцена читает ЗАПИСЬ сервера этой посадки (`game.tilePlacements` →
  `tilePlacementModel.printedBonusRepeats` — каждая печатная иконка оплачена ровно N раз) и играет печатный бит N раз: каждая
  иконка шлёт по жетону за проход, счётчик тикает на каждом касании; холд панели держит всю сумму (`repeatedSpecs`). Без записи /
  с неровной суммой — 1: множитель никогда не угадывается.
- **Вопрос эффекта** — общий путь `choice/contextual` → `ConsoleEffectDecision`: отключённый вариант стоит в «Недоступные цели» с причиной.

## 6. Гэпы (честно)

- Pre-select вопроса в staged-розыгрыше (диагноз 7 промта) НЕ сделан: вопрос задаётся живым промптом после посадки (fallback промта).
- e2e сценариев «держатель данных» (б), «Arcadian + Ferrus» (г) и reload (д) — только unit-спеки (фикстур нет).
