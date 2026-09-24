# Turmoil Redux — Generous Funding (RX13): счётный член по ПОКАЗАТЕЛЮ игрока

Дата: 2026-09-24. Продолжение `TURMOIL_REDUX_ARCHITECTURE_AWARD.md` (счёт по картам),
`TURMOIL_REDUX_CENTRAL_POWER_GRID.md` (по меткам) и `TURMOIL_REDUX_COLONIZATION_FUNDING.md` (по полю).
Промт: `docs/claude/prompts/resolution-rx13-generous-funding.md`.

Generous Funding — тринадцатая настоящая резолюция и **четвёртая карта семейства «счётчик + влияние»**. У неё нет
выбора игрока, нет встроенного шага, нет стадии, нет части победителя и **нет потолка**: выплата идёт штатной волной
M€ в рельсу, как у RX03/RX12. Новое ровно одно: **счётный член считает не ШТУКИ, а полные шаги одного показателя
игрока над порогом** — рейтинг терраформирования пятёрками сверх 15. Механизм сделан членом семейства: следующий
счёт по показателю (Бюджеты — «шаги производства») добавляется одним словом `ResolutionCountMetric` и одной строкой в
серверном чтении.

| | Architecture Award (RX02) | Central Power Grid (RX04) | Colonization Funding (RX08) | Generous Funding (RX13) |
| --- | --- | --- | --- | --- |
| Счётчик | КАРТЫ табло | МЕТКИ табло | ТАЙЛЫ доски | **ПОКАЗАТЕЛЬ игрока** (РТ) |
| Число даёт | общий предикат по картам | канонический `Tags.count` | канонический `getCitiesOffMars` | `player.terraformRating` ÷ **общая `thresholdSets`** |
| Объяснение числа | список карт | карты с вкладом | список клеток | **разбор величины** (значение · порог · шаг · наборы · до следующего) |
| Ставка | 1 за карту + 1 за влияние | 1 за метку + 1 за влияние | 2 за город + 1 за влияние | **2 за набор + 2 за влияние** |
| Потолок | 5 | 5 | 6 | **нет** |
| Единица | пр. M€ | пр. M€ | пр. M€ | **M€ в запас** |

---

## 1. Идентичность

| Что | Значение |
| --- | --- |
| Внутренний id | `RDX_GREENS_GENEROUS_FUNDING` |
| Каталожный код | **`RX13`** |
| Партия | **Greens / Зелёные** — пятая карта партии (Aquifer, Biodome, Climate Research, Forestry Support, Generous Funding) |
| Совместимость | нет: базовая карта (рейтинг терраформирования есть всегда) |
| RU-название | «Щедрое вложение» — **ключ «Generous Funding» уже существовал** в `ru/turmoil_events.json` (одноимённое глобальное событие Turmoil); сборка бросает на дубликате, поэтому лицо резолюции читает существующий перевод, свой ключ не заводился |
| Арт | `assets/card-images/RX13.webp` (+ thumb; 1536×1024) — `node scripts/import-card-art.mjs "<Mars Arts/Generous Funding_art.png>" RX13` → `npm run make:cards` (суффикс `_art` в имени) |
| Файл | `src/server/parliament/resolutions/greens/GenerousFunding.ts` (регистрация в `ResolutionCatalog.ts`) |
| Задание председателя | +3 РТ (`{goal: {kind: 'tr'}, count: 3}` — `QuestTracker` уже считал шаги РТ собственных действий, `questRender` рисует `tr(3)`) |

## 2. Правило и трактовки

Печатный текст: *When enacted: Gain 2 M€ for each point of Influence and each complete set of 5 TR over 15.*

**Формула:** `M€ = 2 × (S + I)` для **каждого** участника (голосовал или нет; нейтральная победа ничего не отменяет);
`S = ⌊max(0, РТ − 15) / 5⌋`.

| РТ | 14 | 15 | 19 | 20 | 24 | 25 | 30 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Наборов | 0 | 0 | 0 | 1 | 1 | 2 | 3 |
| до следующего | 6 | 5 | 1 | 5 | 1 | 5 | 5 |

| Вопрос | Трактовка | Где закреплено |
| --- | --- | --- |
| Что считается | ПОЛНЫЕ пятёрки сверх 15; остаток не платит | `thresholdSets` (`common/parliament/resolutionCounts.ts`), спек «the table TR → sets» |
| Откуда величина | `player.terraformRating` — число движка, не сумма слагаемых | `ResolutionCounts.metricValue`, спек «reads THE ENGINE's rating» |
| Порог 15 | константа карты, не стартовый РТ варианта: РТ 14 — ноль наборов, «до первого 6» | спек «the threshold is the CARD's 15» |
| Влияние | само по себе: РТ 15 и влияние 3 → +6 | спек «TR 15 and influence 3 is +6» |
| Момент чтения | при выплате, ПОСЛЕ шага Повестки победителя; **шаг РТ Повестки поднимает рейтинг до чтения** (Agenda 1 → 2 с РТ 24 платит за 25) | спек «a TR step of the Agenda taken in the phase raises the rating BEFORE» |
| Нулевой результат | названный пропуск «Нет наборов РТ и нет влияния» с разбором в записи | спек «a total of zero is NAMED» |
| Заморозка | запись хранит `count` и `countedMetric` (значение, порог, шаг, наборы, до следующего); поздний РТ/влияние/смена правительства не пересчитывают | спек «a later rating… never recompute», reload-спеки |
| Бот | не участвует, не считается, не получает | спек «MarsBot (mode none)…» |

## 3. Форма вида счёта

```ts
// common/parliament/resolutionCounts.ts
type ResolutionCountKind = … | {kind: 'threshold', metric: ResolutionCountMetric, over: number, step: number};
type ResolutionCountMetric = 'terraformRating';                 // следующее слово — Бюджетам
resolutionCountKind('terraformRatingSets') === {kind: 'threshold', metric: 'terraformRating', over: 15, step: 5};
thresholdSets(value, over, step) === ⌊max(0, value − over) / step⌋;  // ОДНА функция: сервер, чтение, стенд
countMetricToward(id, value): ResolutionCountModel              // {count, cards: [], metric: {value, over, step, sets, toNext}}
```

- **Одна модель на все виды.** `ResolutionCountModel.metric` лежит рядом с `cards` / `spaces`; у `threshold` списки пусты,
  у остальных видов `metric` отсутствует. В записи (`SerializedEnactOutcome`) и модели (`ParliamentEnactOutcomeModel`) —
  `countedMetric`; в чтении — `InfluenceYield.countedMetric` (`YieldCount.metric`, `fixedYield(..., {countedMetric})`).
- **Сервер** (`ResolutionCounts.resolutionCount`): ветка `threshold` первой — `countMetricToward(id, metricValue(player, metric))`.
- **Карта** объявляет `scaled: [{id: 'megacredits', unit: {kind: 'stock', resource: MEGACREDITS}, perInfluence: 2,
  count: {id: 'terraformRatingSets', per: 2}, recipient: 'each'}]` — потолка нет, `cap` не объявлен, `uncapped` в
  записи отсутствует.

## 4. Чтения

- **Глиф счётного объекта** — `CountedObjectGlyph {kind: 'metric', metric}` → `PremiumCountGlyph` рисует значок РТ
  (`assets/resources/tr.png`, тот же, что печатает лицо для `b.tr()`), без искры и без числа внутри: число стоит рядом.
- **Формула блока** — ветка «одна ставка» (`per === perInfluence`): «2 [M€] / [РТ] + [влияние]».
- **Чтение** (`ConsoleInfluenceYield`): «[РТ] 24 → 1 набор + [влияние] 3 → +8 [M€]» — `data-yield-in="metric"` (значение),
  `data-yield-in="count"` (наборы), слово «набор» из `${0} set(s)` (плюрал резолвится по числу слева, число снимается).
- **Осмотр, «Для вас»** (`parliamentAnnotations`): «Учтены сейчас / при принятии: РТ 24 · порог 15 · 1 полный набор ·
  до следующего 1» (`countedMetricParts`); ноль наборов — тоже разбор, никогда «ни одной карты».
- **Честный прогноз** (`winnerForecastCount`): если шаг Повестки, который возьмёт победитель, — шаг РТ, прогноз
  «если победите» считает наборы от `РТ + 1` той же функцией (Agenda 5 с РТ 24: +8 → +10, суффикс «+2 · шаг 6»).
  Прочие счёты едут без изменений — фаза не двигает ни табло, ни тайлы.

## 5. Стенд «Полигон»

Семейство `counted-metric` (`familyOf`: вид счёта `threshold`). Место держит синтетический РТ (`PgSeat.tr`), число
считает `countMetricToward` — не вписанное. Секция «Рейтинг терраформирования»: значение со значком, **лестница**
границ наборов (15 · 20 · 25 · …, достигнутые подсвечены), разбор словами. Сценарии: ноль · только влияние · только
наборы · один набор (РТ 24, победа = +1 влияния) · ниже порога (РТ 14) · ровно два (РТ 25) · шаг РТ Повестки первым ·
у каждого своё · запись · зритель · задание 0/3 и выполнено · живой (`parliament-generous-vote`).

## 6. Проверка

- Серверные юниты `tests/parliament/GenerousFunding.spec.ts` (20) + гард контракта; регрессия общей модели —
  RX02 / RX04 / RX06 / RX08 юнитами (`tests/parliament/**` зелёные).
- Клиентские юниты: `influenceYieldModel.spec` (декларация, чтение с разбором, влияние само по себе, прогноз на шаге
  РТ / влияния / конце трека, запись, слова), `PremiumCountGlyph.spec` (глиф `metric`), `parliamentAnnotations.spec`.
- **Один e2e** `tests/e2e/console-parliament-generous.spec.ts` на фикстуре `parliament-generous-vote` (см. § 7).

## 7. Фикстура и e2e

`parliament-generous-vote`: синий — РТ 24, Повестка 4 (влияние 2; победа → шаг 5 = влияние 3, рейтинг стоит),
делегат на карте; красный — РТ 20, Повестка 1. Панель голосования читает «[РТ] 24 → 1 + [влияние] 2 → +6» с суффиксом
«+2 если победите · шаг 5»; осмотр — разбор; стадия НАГРАДА — чип «+8 M€» из графики резолюции в ячейку M€ рельсы,
счётчик тикает на посадке; запись `{amount 8, count 1, influence 3, countedMetric: {value 24, over 15, step 5, sets 1,
toNext 1}}`.
