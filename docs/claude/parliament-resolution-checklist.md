# Добавление резолюции Turmoil Redux — чеклист автора

Пошаговая процедура и КОНТРАКТ (план `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md` §4–§5, реализация —
`docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md` Э2). Образцы: **RX01 Aquifer Contest** (шаблон семейства: выплата
на карту через общий пикер + океан победителя), **RX02 Architecture Award** (счётный член по картам +
влияние, cap), **RX03 Biodome Contest** (ресурс в склад по влиянию + озеленение победителя), **RX04 Central
Power Grid** (счётный член по МЕТКАМ), **RX05 Climate Research** (последовательная часть: вторая половина
читает итог первой; добор через общий интейк).

Короткая форма лежит в `.claude/rules/game-logic.md` и загружается сама, когда трогаешь
`src/server/parliament/resolutions/**`. Гард контракта — `tests/parliament/ResolutionContract.spec.ts`:
он перечисляет `REDUX_RESOLUTION_CATALOG` сам и падает с именем карты, шага и условия. **Гард — это
worklist:** сначала пиши карту, потом читай, что он назвал.

---

## 0. До кода

- [ ] Правило карты в `docs/TURMOIL_REDUX_SPEC.md` §4.1 (каталог 48 резолюций, механизм/статус) и печатный
  код `RX##` (уникален, по руке).
- [ ] Каждая ВЫПЛАТА карты — один из видов таблицы адресов `src/common/parliament/rewardAddress.ts`
  (`production` · `stock` · `cardResource` · `cards` · `ocean` · `greenery` · `skipped`; `reaction` пишет
  движок). **Нет вида — сначала строка в таблице** (см. §4 ниже), потом карта. «TODO: добавить kind
  позже» не бывает: `REWARD_ADDRESS` — `Record` по всему union, без строки не соберётся.
- [ ] Если механизм новый (потеря ресурсов, шаг Повестки каждому, треки колоний, TR, доступ к партии):
  это новый `kind` + адрес + чип/единица + причина пропуска + спек адреса — ДО первой такой карты.

## 1. Файл карты (`src/server/parliament/resolutions/<party>/<Name>.ts`) — что ОБЯЗАН объявить

1. `id` (`RDX_<PARTY>_<NAME>`, постоянный навсегда), `code` (`RX##`), `module: 'turmoilRedux'`, `party`,
   `copies` (физических копий в колоде), `compatibility?`, `renderData` (DSL `CardRenderer.builder`),
   `text` (`name`, `effect?`, `winner?`, `passive?`, `action?`, `quest`) — английские ключи локали, `quest`.
2. `scaled: InfluenceScaledEffect[]` — КАЖДАЯ часть, чья величина зависит от влияния / счёта / итога
   (`unit ∈ {production, stock, cardResource, cards}`; `count` — по образцу RX02/RX04, `sequel` — по RX05,
   `cap` — «max N»; **`cardResource` с `spread: true`** — РАСПРЕДЕЛЕНИЕ по образцу RX06: игрок сам раскладывает
   N единиц по своим держателям). Из этой декларации клиент строит лицо, прогноз голосования, чтение стадии
   НАГРАДА, плиту пропуска и семейство сценариев «Полигона» (`familyOf(definition)`) — автору рисовать нечего.
3. `winnerReward?` — часть победителя как ДАННЫЕ (`winnerReward.ts`: какой тайл, какой параметр двигает).
4. `immediateSteps` / `winnerSteps` — шаги. КАЖДЫЙ шаг **либо мутирует, либо спрашивает** (`EnactStep`:
   вернул `undefined` — всё сделал; вернул промпт — ничего не менял, изменит ответ). В ЛЮБОЙ ветке — включая
   «ничего не сделал» — шаг вызывает `ctx.report(outcome)` **ровно один раз** с `kind` из таблицы адресов;
   у пропуска — `reason` (английский ключ, переведённый в `ru/parliament.json`) и, если честно известна,
   величина, которая была бы выплачена (`amount`). Один шаг = одна запись: две выплаты — два шага.
5. Каждый промпт шага несёт СТРУКТУРНЫЙ маркер источника: `markChoiceContext({source: {kind: 'resolution',
   resolution: ID}})` для выбора, `placementContext` через `committedPlacement(…, SOURCE)` для тайла,
   `ExternalDrawIntake.open / takePromptFor` с `cause.kind === 'resolution'` для добора. Заголовок промпта —
   только текст для журнала; детекция где угодно — только по маркеру.
6. Резюмируемость: то, что шаг решил ДО вопроса (сколько должен, id интейка), хранится в `ctx.state` — повторный
   `run()` после reload не считает заново и не тянет заново (образцы `ANIMALS_OWED_KEY`, `INTAKE_KEY`).
7. `passive?` — с обязательным `forecast` (закон честности прогноза); `action?` — с `preview`.
8. Ни слова о партиях: реакция правящей партии (Зелёные и т.д.) — данные `PartyEffectDefinition.reactions`,
   запись `kind:'reaction'` делает драйвер фазы из событий рекордера (Э1). Карта платит через `stock.add` /
   `production.add` с `from: {resolution: ID}` — этого достаточно.

## 2. Регистрация

- [ ] Строка в `REDUX_RESOLUTION_CATALOG` (`ResolutionCatalog.ts`). Больше ни один switch не трогается.
- [ ] `npm run make:cards` — манифест клиента (`genfiles/parliament.json`: `scaled`, `winnerReward`, тексты).
- [ ] Локаль: все `text.*`, все `reason` пропусков, все заголовки промптов — ключи в `src/locales/ru/parliament.json`
  (`npm run make:json` бросит на дубликате). Канон: TR → РТ, VP → ПО, tag → метка.

## 3. Что резолюция получает БЕСПЛАТНО (и потому не должна делать сама)

Премиальное лицо · чтение в режиме голосования («одна цифра» + «+N при победе») · fullscreen-осмотр · беты
заседания (вердикт / принятие / обновление не зависят от карты) · **адрес и моушен награды по `kind`** · плиту
пропуска с причиной · строку ожидания для других мест · запись протокола в журнале (одна группа на заседание)
· стенд «Полигон» (семейство сценариев по декларации) · гард-тесты · фикстуры e2e через
`parliamentFixture({resolution, stopAt: 'vote' | 'assembly' | 'effects' | 'adjourn' | 'done', options?})`
· **раскладку ресурса по картам** (RX06): шаг `AddResourcesToCards` сам решает форму вопроса — выбор одной карты
(`N = 1` или держатель один; `autoSelect: false` — показывается всегда) или РАСПРЕДЕЛЕНИЕ (структурный маркер
`cardResourceDistributionPrompt`, сумма ровно N, `InputError` на любую другую, применение после проверки), а
консоль показывает его тем же выбором карт в режиме раскладки (счётчики, остаток, LB/RB/RT, ноль на старте,
неполная отправка невозможна на четырёх уровнях), летит по одному чипу на карту и пишет список в итоги.

### Распределение по картам — строка семейства (RX06, 2026-09-22)

```ts
scaled: [{id: 'floaters', unit: {kind: 'cardResource', resource: CardResource.FLOATER, spread: true},
  perInfluence: 1, count: {id: 'venusJovianTags', per: 1}, recipient: 'each'}],
// шаг:
return new AddResourcesToCards(player, CardResource.FLOATER, owed, {autoSelect: false, cause: SOURCE, from: {resolution: ID},
  pickTitle: message('Add ${0} floater(s) to one of your cards', …), distributeTitle: message('Place ${0} floater(s) on your cards', …)})
  .andThen((placed) => { ctx.report({kind: 'cardResource', resource, amount: owed, cards: placed.map(…), ...(placed.length === 1 ? {card} : {})}); return undefined; })
  .execute();
```

- Запись — ВСЁ ТОТ ЖЕ `kind: 'cardResource'`, расширенный `cards: [{card, amount}]` (список из одной несёт и
  `card`); нового вида исхода нет. Счёт над несколькими метками — `resolutionCountKind = {kind: 'tags', tags: [...]}`
  с разбивкой `byTag` → `countedByTag` в записи (чтение печатает вход по каждой метке).
- «Полигон» открывает семейство `distributed` по `spread: true` (`spreadEffectOf`); сценарии — держатели,
  считающиеся-не-держащие, обе метки на одной карте, нет держателя (названо с величиной). Живой сценарий
  открывает настоящую раскладку — на стенде второй реализации нет.
- Две единицы разом (Greens Budget: животные и микробы) — два шага с двумя единицами, а не новая модель.
- Зависимость от дополнения — `compatibility: ['venus']`, больше ничего: колода, пул в спеках
  (`compatibleWith(game.gameOptions.expansions)`) и лицо (медальон рядом со штампом модуля) читают декларацию.

### Бонусы колоний — план шагов на игрока, реестр, шаг СБРОС (RX07, 2026-09-23)

```ts
scaled: [{id: 'colonyBonuses', unit: {kind: 'colonyBonuses'}, base: 2, perInfluence: 1, influenceStep: 2, recipient: 'each'}],
immediateStepsFor: colonyBonusSteps,   // (player, parliament, game) → шаги по СТОЛУ колоний; ключи `colony:<tile>[:<n>:draw|discard|reveal]`
// каждая запись шага: {..., effect, influence, multiplier: k, colony}
```

- **План шагов на игрока** — `IResolution.immediateStepsFor?(player, parliament, game)` рядом со статическим
  `immediateSteps`; `immediateStepsOf` — один читатель обоих (драйвер, гард, экспорт). Ключи стабильны через reload.
- **Шаг влияния** — `InfluenceScaledEffect.influenceStep` (`perInfluence × ⌊I / step⌋`); множительная единица
  `{kind: 'colonyBonuses'}` — гард формулы сверяет `multiplier` записи.
- **Закон объединения** — запас/производство ×k = одна запись; ресурс на карту = ОДНА раскладка k
  (`AddResourcesToCards`, `autoSelect: false`); добор = ОДИН приём k; Плутон = k ПАР «взять → сбросить», никогда не
  объединять (следующая карта не видна до сброса). Бонус колонии = ТРЕТЬЯ строка тайла (`metadata.colony`), не доход
  торговли: у Миранды это «взять 1 карту».
- **Виды** `discard` (адрес `hand-dock` / `hand` / `discard` / `colony-ledger`) и `colonyBonus` (`hud`, описание
  тайла; потеря — отрицательная сумма, пропуск только при 0). Источник полёта **`colony-row`**
  (`rewardFlightSourceOf`): запись с `colony` рождается на строке реестра, адрес не меняется.
- **Маркер сброса** — `discardPrompt {source: resolution, colonyRepeat: {colonyName, index, total}}`; **никогда
  `colonyBonus`** (он маршрутизирует шаг рабочего пространства КОЛОНИЙ).
- **Реестр** — сервер шлёт `ParliamentPlayerModel.colonyBonuses: [{colony, grant, description}]`; клиент читает
  `colonyLedgerOf` (чистый `common/parliament/colonyLedger.ts` + `colonyLedgerModel.ts`), рисует
  `ConsoleColonyLedger` на панели голосования, в осмотре, в стадии (герой-размер) и на стенде; итоги группируют по
  тайлу. Семейство стенда `colony-bonuses` (`colonyBonusesEffectOf`).
- **Стадия** — реестр = тело страницы НАГРАДА (`sittingFieldOf`: поза до волны, дверь шага после), волны по строкам
  (`beatReward` → `ledgerRowGroups`), сброс = встроенный шаг `'discard'` (`sittingAskOf` по маркеру,
  `sittingStageKey → 'Discarding'` «СБРОС», `RESOLUTION_STEP_STAGES.handSelect`; секция публикует слот фрейма
  парламента вместе с дверью). Док: `docs/TURMOIL_REDUX_COLONIAL_AFFAIRS.md` §3–5.

### Счётный член по ПОЛЮ — когда счёт считает не табло, а доску (RX08, 2026-09-23)

```ts
scaled: [{id: 'production', unit: {kind: 'production', resource: MEGACREDITS}, perInfluence: 1,
  count: {id: 'spaceCities', per: 2}, cap: 6, recipient: 'each'}],
// resolutionCountKind('spaceCities') === {kind: 'board', tiles: 'spaceCity'}
```

- **Вид `board`** в `resolutionCountKind` — третий рядом с `cards` и `tags`; что считается — слово из `BoardCountedTile`
  (`'spaceCity'`; следующее — `'marsCity'` для Migration Funding: одно слово, одна ветка в `spaceCountVerdict`, одна
  строка в `boardCountSpaces` сервера). Никакой особой ветки «для этой карты».
- **Число даёт ДВИЖОК**: `ResolutionCounts.resolutionCount` для `board` не ходит по табло — берёт клетки у
  канонического хелпера (`MarsBoard.getCitiesOffMars(player)` — им же живут награда Cosmic Settler и `behavior/Counter`).
  Предикат космического города в модуле резолюций не переписывается.
- **Объяснение числа — КЛЕТКИ в той же модели**: `ResolutionCountModel.spaces` (`cards` пуст), в записи и модели —
  `countedSpaces` (`SerializedEnactOutcome` / `ParliamentEnactOutcomeModel`), в чтении — `InfluenceYield.countedSpaces`
  (`YieldCount.spaces`, `fixedYield(..., {countedSpaces})`). Второго типа модели счёта нет.
- **Имя клетки — только из существующего слоя информации о доске** (`getSpecialCellInfo(id).title`: «Колония на
  Ганимеде», «Космопорт на Фобосе», «Стэнфордский тор», области Венеры). Клетку без имени никто не крестит:
  «Для вас» печатает ЧИСЛО (`${0} space city(-ies)`) и оставляет правило говорить (`countedCellNames` →
  `parliamentAnnotations`).
- **Глиф счётного объекта** — `CountedObjectGlyph {kind: 'tile', tile}`: `PremiumCountGlyph` рисует его ТЕМ ЖЕ ассетом,
  что печатает лицо для `b.city()`, и той же искрой `.pcard-sym--asterix` (`countedTileIconUrl`). Формула блока чтения
  печатает ДВЕ ставки, когда `count.per ≠ perInfluence` («2 [ед.] / [город*] + 1 [ед.] / [влияние]»).
- **Стенд**: общий предикат клетки `spaceCountVerdict` / `countSpacesToward` (`CountedSpaceFacts` — то, что делят
  серверный `Space` и синтетическая клетка) считает синтетические КЛЕТКИ семейства `counted-board`; паритет с движком
  закреплён спеком по корпусу досок (`ColonizationFunding.spec.ts` § PARITY), а не подразумевается.

### Бюджет проверки на карту (решение владельца 2026-09-23)

Состав проверки определяется ОДНИМ вопросом: **что в карте ново?**

- Нет новой механики (только новая формула из существующих членов) → нового e2e НЕТ вовсе: юниты карты + гард
  контракта; общие модели защищены юнитами уже выданных карт (RX02 / RX04 / RX06 / RX07), они дешевле и ловят ту же
  поломку.
- Есть ровно одна новая механика → РОВНО ОДИН новый e2e на карту, покрывающий именно её, на одном профиле
  (три профиля и Deck — только если у карты своя геометрия; у выплаты штатной волной её нет).
- Старые сюиты e2e, галерею и стенд не гонять «для спокойствия». Фикстуры править точечно
  (`FIXTURES=… npm run e2e:fixtures`), тяжёлую новую не городить.
- Визуальная приёмка — несколько кадров НОВОГО на одном профиле в отчёт.

## 4. Таблица адресов (`src/common/parliament/rewardAddress.ts`) — правило добавления вида

Строка есть у КАЖДОГО значения union `kind`; клиентский директор знает адреса, не резолюции. Новый механизм
входит в таблицу ДО первой резолюции, которая его платит:

1. `ParliamentEnactOutcomeModel.kind` (+ `SerializedEnactOutcome.kind`) += `'<kind>'` и поля записи.
2. `REWARD_ADDRESS['<kind>']` — `surface` (где видит) · `source` (откуда летит) · `unit` · `stage` · `reading` ·
   `skipTitle` (ключ, переведён).
3. `tests/parliament/rewardAddress.spec.ts` — ожидания по новой строке; потребители union (`outcomeText`,
   подачи) — исчерпывающие `switch`, компилятор сам покажет места.
4. Ожидаемые будущие виды — **эскизы адресов** лежат в самом `rewardAddress.ts` («FUTURE KINDS — how to add one»,
   финальная полировка D.3): `stockLoss` (волна ОБРАТНО в источник, минус в чтении, счётчик рельсы тикает вниз),
   `globalParameter` (стадия `board`, строка параметра + история шкалы), `agendaStepAll` (все маркеры Повестки
   разом), `colonyTrack` (чип колонии + шаг, экран колоний не открывается), `colonyToWinner` (стадия `choice`,
   общий пикер колонии в зоне стадии), `cityEveryone` (стадия `board` по креслам ПО ОЧЕРЕДИ — маршрут тайла
   победителя, обобщённый на всех), `drawUpTo` (стадия `take`, число из ЗАПИСИ, полная рука — плита пропуска).
   Строки не добавлены нарочно: адрес без плательщика — обещание, которое никто не держит; первая карта вида
   добавляет строку вместе с плательщиком по эскизу, не проектируя подачу с нуля.
5. Резолюция БЕЗ немедленных шагов (пассив, действие) не оставляет стадию НАГРАДА пустой: стадия читает
   `text.passive` («Эффект, пока принята») или `text.action` + адрес «Доступно в «Действиях карт»»
   (`quietRewardPoseOf` в `quietRewardPose.ts`; `ConsoleParliamentSitting` — стадия и закрытие; `voteReadingOf` —
   тот же кикер над графикой в панели голосования вместо «При принятии»); контракт § 9 · THE SEAM требует у пассива `forecast`, у
   действия `preview` и текст декларации у обоих, а у резолюции без немедленных шагов — пассив или действие;
   партии без карт сажают dev-заместителей (`quietResolutionOf`: Красные → `RDX_DEV_COMPOUND`, Учёные →
   `RDX_DEV_SCIENCE`; Союз — пока без заместителя, честная ошибка).

## 5. Что резолюции ЗАПРЕЩЕНО

- Свой экран, компонент, CSS-класс, стадия. Любой `if (resolution === 'RDX_…')` в клиенте — дефект (гард п. 6
  ищет id каталога и импорты из `server/parliament/resolutions` по `src/client/**` вне манифеста и стенда).
- Своя хореография (таймлайн, задержка, `setTimeout`) — директор один.
- Лог-строка вместо `report()`; `report()` с `kind`, которого нет в таблице; два `report()` в одном шаге.
- Шаг, который мутирует И спрашивает (ломает resume). Исключение — интейк (`ExternalDrawIntake`), безопасный
  по построению; новое исключение = новый безопасный интейк в общем слое.
- Промпт без структурного маркера; детект по заголовку.
- Пересчёт выплаты на клиенте (клиент читает `outcome`, никогда «влияние × коэффициент» после факта).
- Реакция партии, записанная внутри резолюции.

## 6. Гард `tests/parliament/ResolutionContract.spec.ts` — что он проверяет (и как читать провал)

Для каждой записи `REDUX_RESOLUTION_CATALOG` с `copies > 0` (dev-примеры — отдельным `describe` без п. 3):

1. **Отчётность** — стол из 3 мест, влияние {0, 1, 3, 5} × таблица {пустая, одна подходящая, насыщенная},
   нейтральный победитель: каждый `immediateStep` даёт ровно одну запись на (место, шаг); игрок-победитель при
   влиянии {1, 3, 5}: `winnerSteps` — ровно одна запись у победителя и ноль у остальных. Провал:
   `«RX05: шаг 'draw' не отчитался при влиянии 0 / таблице 'empty'»`.
2. **Виды** — каждый `kind` ∈ `REWARD_ADDRESS`; каждая причина пропуска переведена.
3. **Маркеры** — каждый промпт шага несёт `choiceContext.source` | `placementContext.source` |
   `externalDrawPrompt.cause`.
4. **Resume** — reload внутри КАЖДОГО вопроса восстанавливает промпт с тем же маркером; ничего не платится дважды.
5. **Декларация ↔ выплата** — `amount` = `scaledAmount(effect, влияние, счёт)` (или `sequelAmount(effect,
   total.after)`); у пропуска — 0 или та же величина; записанное влияние = влияние стола.
6. **Клиент не знает имён** — `src/client/**` без id каталога и без импортов из `resolutions/`.
7. **Лицо и локаль** — `renderData` непуст, все `text.*` переведены, код уникален.
8. **Стенд** — `familyOf(definition)` ∈ `RESOLUTION_FAMILIES`.

Образец сломанной карты (шаг без `report`) и фраза, которую печатает гард, — в `describe.skip` внизу спека.

## 7. Спек карты и фикстуры

- [ ] `tests/parliament/<Name>.spec.ts` по шаблону Aquifer: каталог/код, формула, выплата каждому по СВОЕМУ
  влиянию, победитель ПОСЛЕ шага Повестки, пропуск с именем, reload внутри вопроса, нейтральный победитель,
  MarsBot никогда не спрашивается, модель с цветами. Заседание проходится хелперами
  `tests/parliament/parliamentArrange.ts` (`endGenerationThroughParliament`, `settleParliamentGates`, `answerGate`).
- [ ] Фикстуры: `parliamentFixture('parliament-<name>-<stop>', {resolution: ID, votes, agenda, arrange, stopAt,
  expect})` в `tests/e2e/fixtures/generate.ts`; `FIXTURES=parliament-<name>-vote,… npm run e2e:fixtures`;
  `tests/console/e2eFixturesLoad.spec.ts` проверит загрузку и ворота.
- [ ] Сценарии «Полигона» выводятся из семейства (`familyOf`); ручной сценарий — только для правила-исключения.

## 8. Рецепт одной строкой

Файл карты (§1) → строка в каталоге → `npm run make:cards` → локаль → `npm run test:server` (гард назовёт
пропуски) → спек карты → `FIXTURES=… npm run e2e:fixtures` → e2e заседания параметризован по каталогу. UI-файлов
рецепт не касается; если коснулся — это дефект контракта, и его чинят в общем слое.

## 9. После кода — глоссарий, галерея, пробники (ПОЛИРОВКА 2026-09-19)

1. **Слова** — каждая строка новой резолюции (чтения, заметки, плита пропуска, журнал) по
   `docs/claude/parliament-glossary.md`: резолюция «принимается / принята», игрок «победитель голосования»,
   условие «если победите», «эффект ваш», «председательство». Гард `tests/console/parliamentGlossary.spec.ts`
   красный на запрещённой форме — сначала убедись, что он КРАСНЫЙ на твоей заведомо неверной строке (JS `\b` не
   видит кириллицу).
2. **Кадр** — резолюция должна пройти галерею `tests/e2e/console-parliament-gallery.spec.ts` на своей фикстуре
   (`parliament-<name>-assembly` через `parliamentFixture({stopAt: 'assembly'})`): три профиля × три режима, на
   каждой позе FITS · paint baseline · fx-lite · reduced. Новый вид награды = новая поза в путешествии «REWARD
   variants» + строка в `rewardAddress.ts`.
3. **Рейка** — если стадия резолюции ведёт добор, строка статуса добора обязана пройти `expectRailHonest` и
   `expectDrawRailHierarchy` (честное многоточие, строгий порядок уступки).
4. **Покой** — обзор с твоей резолюцией на столе не двигается под d-pad (`console-parliament-stability.spec.ts`).

## 10. «Заседание v2» (2026-09-21) — для автора резолюции ничего не изменилось

Порядок ворот на сервере (`assembly` теперь ДО `agenda → support → enact`), проход директора на клиенте, дверь
«К полю» и одна стадия ИТОГИ живут в фазе и в консоли, не в карте. Резолюция по-прежнему объявляет только то, что
требует §1: её награда летит из её же напечатанной графики, её тайл ждёт нажатия игрока, её запись попадает в
карточку итогов из `summary` / `outcomes`. Единственное, что стоит знать: **вердикт видит стол «как проголосовали»**
— если резолюция читает что-то в момент ворот сборки (`parliamentPhasePrompt.stage === 'assembly'`), изменения ещё не
применены. Гарды прежние (`ResolutionContract.spec`, галерея, пробники); новые пробники v2 резолюций не касаются.
