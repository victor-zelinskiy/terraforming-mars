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
   `cap` — «max N»). Из этой декларации клиент строит лицо, прогноз голосования, чтение стадии НАГРАДА,
   плиту пропуска и семейство сценариев «Полигона» (`familyOf(definition)`) — автору рисовать нечего.
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
`parliamentFixture({resolution, stopAt: 'vote' | 'assembly' | 'effects' | 'adjourn' | 'done'})`.

## 4. Таблица адресов (`src/common/parliament/rewardAddress.ts`) — правило добавления вида

Строка есть у КАЖДОГО значения union `kind`; клиентский директор знает адреса, не резолюции. Новый механизм
входит в таблицу ДО первой резолюции, которая его платит:

1. `ParliamentEnactOutcomeModel.kind` (+ `SerializedEnactOutcome.kind`) += `'<kind>'` и поля записи.
2. `REWARD_ADDRESS['<kind>']` — `surface` (где видит) · `source` (откуда летит) · `unit` · `stage` · `reading` ·
   `skipTitle` (ключ, переведён).
3. `tests/parliament/rewardAddress.spec.ts` — ожидания по новой строке; потребители union (`outcomeText`,
   подачи) — исчерпывающие `switch`, компилятор сам покажет места.
4. Ожидаемые будущие виды: `stockLoss` (та же волна ОБРАТНО, в источник), `agenda`, `colonyTrack`, `tr`,
   `partyAccessGrant` — не добавлены нарочно: адрес без плательщика — обещание, которое никто не держит.

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
