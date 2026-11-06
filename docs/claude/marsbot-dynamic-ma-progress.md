# MarsBot × случайный набор — ЖУРНАЛ ХОДА (исполнитель)

Промт: `docs/claude/prompts/marsbot-dynamic-ma-framework.md` (главнее при расхождении); проект:
`docs/claude/marsbot-dynamic-ma-framework.md`; данные: `docs/AUTOMA_DATA_AUDIT.md` §22. Журнал — для меня после
компакции и для ревьюера: что сдано, коммиты, числа, отступления от промта с причиной.

## Статус этапов

| № | Этап | Статус | Коммит |
|---|---|---|---|
| 0 | Разведка, RB-C стр. 13–16 со значками, таблица всех имён, полоса | СДАН 2026-11-06 | `c3b90ef720` |
| 1 | Реестр + интерпретатор, перенос 66 + 44 без смены поведения | СДАН 2026-11-06 | `f08f67de63` |
| 2 | Заполнение реестра | СДАН 2026-11-06 | (этот коммит) |
| 3 | Генератор, сериализация, динамическая карта | — | — |
| 4 | Выравнивание давления, слой карты, стенд на масштабе | — | — |
| 5 | Ares — расчистка | — | — |
| 6 | Клиент, создатель, e2e | — | — |
| 7 | Документы, передача на ревью | — | — |

## Этап 0 — разведка и полоса (2026-11-06)

- Якоря промта перепроверены на HEAD `ea935c438b` — совпадают (`AutomaMAEvaluation.ts:194/401/438/475/512/538`,
  `AutomaBonusCards.ts:552/571/595/680/702`, `AutomaState.ts:241`, `MarsBotMapProfile.ts:159`,
  `MilestoneAwardSelector.ts:63/87/180/244`, `automaCompatibility.ts:95/188`).
- RB-C стр. 13–16: текст + значки прочитаны с рендера (§22.1 аудита). Значки — треки планшета THARSIS.
- Таблица всех 124 имён (+ устаревшие на досках) — §22.2 аудита. Новое против промта: **двойники Builder7 /
  Spacefarer4 / Terran5 / Tactician4 сегодня читают ветку игрока и навсегда 0** — в набор они попадают при
  `randomMA ∈ {LIMITED, UNLIMITED}` с модульным пулом, поэтому этап 2 закрывает их правилом модуля (Tactician4 — по
  закону Forecaster, 28 M€).
- Стенд: библиотека `tests/automa/marsBotBench.ts` (`benchConfig` с хуком `prepare` — им этап 4 посадит
  сгенерированный планшет), dev-спек переписан на неё. Полоса и окно трековых критериев — §22.4 аудита.
  **Окно официальных досок: 4.3 … 13.3 поколения** (3 карты = поколение).
- Топология пар десяти планшетов (для генератора): Jovian ∈ {power, science, earth}, City ∈ {earth, science,
  power}, Microbe ∈ {bio, science}; встречаются 4 топологии (T1 Tharsis/Utopia/Amazonis/TC-fan · T2 Hellas/Elysium/
  VB-fan/Arabia · T3 TC Nova · T4 VB Nova). Ключи строк (роль + набор меток), реально существующие в библиотеке, дают
  ещё две законные комбинации: T5 (Jovian→earth, City→power, Microbe→bio) и T6 (Jovian→power, City→earth,
  Microbe→science). Трек earth без вторичной метки не встречается ни разу — такая комбинация запрещена.

## Этап 1 — реестр и интерпретатор (2026-11-06)

- Модуль `src/server/automa/ma/`: `BotMARule.ts` (типы: `TrackRef` = роль | метка | значок производства;
  критерии `track` / `tracks` (sum · max · min+drop · countAtLeast) / `megacredits` / `pile` (count · sum · minOf) /
  `player` / `rating` / `counter` / `zero`; помощники `advance` (ref | least/most из набора) / `advanceExtreme` /
  `greenery` / `city` (+ регион) / `reveal` / `raiseRating` / `cubeAttack` / `delegate` / `none`) · `botMARules.ts`
  (РЕЕСТР — строка на имя, происхождение у каждой) · `botMAInterpreter.ts` (ОДИН интерпретатор: значение, target,
  помощник) · `botMADescribe.ts` (текст для игрока — `Message` с переводимыми подписями; RU — `ru/marsbot_ma.json`) ·
  `pilePredicates.ts` (предикат = статик класса награды, где он есть) · `placementRegions.ts` (регион = предикат
  `Board`) · `calibration.ts` (законы калибровки как данные).
- `AutomaMAEvaluation` — тонкий читатель (нормализация, сложность, корпорация, `humanAwardScore`); `tryAwardHelper`
  — интерпретатор дескриптора помощника (примитивы остались рядом с картой). Оба `switch` удалены,
  `MarsBotMADescriptions.ts` (мёртвая таблица) удалён.
- **Ворота — дифференциал** `tests/automa/ma/botMARegistryDifferential.spec.ts`: замороженная копия старых
  `switch` (`legacyBotMAOracle.ts`, `legacyBotMAHelperOracle.ts`) против реестра на ВСЕХ десяти планшетах × {база,
  Венера+Колонии} × 40 посеянных состояний бота — оценка всех 131 имён манифестов (>50 000 сравнений); помощники —
  ответ и итоговое состояние партии на двух клонах. Полный прогон (`TM_BOT_MA_FULL_DIFF=1`, 4 состояния × 20
  конфигураций × 58 наград) — ЗЕЛЁНЫЙ на миграции (78 с); в CI — облегчённый (база, 2 состояния, ~8 с).
  Оракул остаётся в тестах навсегда: правило, которое этап 2 намеренно перенаправит, сужается в спеке до родных
  досок (`REPOINTED`), а не правится в оракуле.
- Гард-ворклист `tests/automa/ma/botMARegistry.spec.ts`: покрытие имён (список `PENDING` этапа 2 — может только
  сокращаться), помощник у каждой награды, `zero` ⊆ {Entrepreneur}, аналог у каждого домашнего правила, каждая строка
  рендерится по-русски без сырого `${n}`.
- Нормализационный спек: `BOT_METRIC` / `PLAYER_METRIC` выводятся из реестра; `SHARED_NAMES` /
  `noNameServesTwoBoards` удалены (имя = один объект = одно правило по построению).
- Внутренние функции `AutomaBonusCards` (`revealUntilAndResolve`, `selectHighestScoringCubeAttack`,
  `resolveCubeRemoval`, `mapCorporateCompetition`, `tryAwardHelper`) экспортированы — их читает оракул помощников.

## Этап 2 — заполнение реестра (2026-11-06)

- `PENDING` пуст: у каждого имени манифестов (кроме Moon / Underworld) — строка реестра; `zero` — ровно Entrepreneur.
  Список новых правил с источниками — `docs/AUTOMA_DATA_AUDIT.md` §22.2 «ЭТАП 2 СДАН»; законы — §22.3.
- Словарь расширен: `tracks.sumTop` (Producer), `allOf` (Landshaper), счётчики `cities` / `greeneries` /
  `tokens:data` / `tokens:fighter`, `claimCost` (Briber — платится внутри скоупа взятия в
  `AutomaMilestonesAwards.claim`), `display: 'flag'` (Merchant), предикаты `philanthropic` / `noTags` /
  `partyRequirement`, регион `suburbianEdge`. Предикаты — статики классов: `Philantropist.counts`,
  `Administrator.untagged` (его же читает `Tags.numberOfCardsWithNoTags`), `Suburbian.onEdge`.
- `AutomaState.tokens` (жетоны по видам, сериализуются, старый сейв → `{}`); клетки `token_*` — этап 3.
- **R10 применено:** все трековые критерии ссылаются на метку / значок. Перенаправлены (на родной карте ≡ старому):
  Rim Settler, Architect, Farmer, Traveller (`REPOINTED` в дифференциале). Новые правила — `NEW_IN_STAGE_2`
  (сравнивать не с чем).
- Спек `tests/automa/ma/botMAStage2Rules.spec.ts` — по правилу на имя: значение, target, показ на шкале игрока,
  помощник, «невозможно»; Briber −12 M€ при взятии; Hydrologist / Thawer — по счётчику `globalParameterSteps`, B16
  под SOLAR не считается; жетоны — round-trip и старый сейв.

## Отступления от промта

- **Hydrologist / Thawer — класс «игрок», а не отдельный счётчик бота.** Промт: «счёт океанов бота отдельно». Движок
  уже ведёт его: `Player.globalParameterSteps` пишется для бота при КАЖДОМ его подъёме, а B16 (под SOLAR) не пишется —
  это и есть «track MarsBot's … separately»; второй счётчик был бы вторым экземпляром правила.
- **Помощник Rugged — `none`.** Промт допускает озеленение у опасной зоны, «только если оно не нарушает правило
  избегания»; рядом с опасной зоной — это ровно то, чего правило избегания и избегает, так что разрешённого случая нет.
- **Помощник Influencer — `none`** (промт: «если двери нет»): Повестка бота двигается только победой на заседании;
  отдельной двери нет, новую механику не изобретаю.
- **Administrator: +5 M€ сверх обычной оплаты карты** («gains (an additional) 5 MC», RB-C p.16) — не бесплатный, как
  Forecaster (у того в тексте прямо «does not cost MarsBot 5 MC»).
