# Промт исполнителю · TR18 Martian Fiber («Марсианское оптоволокно») — семнадцатая карта проектов Turmoil Redux

Выдан 2026-10-02. Инфраструктура набора стоит (TR01–TR09, TR11–TR13, TR15–TR17, TR66 сданы) — **ничего из неё не
повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`,
правила карт — `.claude/rules/game-logic.md`.

**Новых механик нет. Карта — близнец Meat Industry** (`src/server/cards/promo/MeatIndustry.ts`: «каждый раз, когда вы
добавляете животное на ЛЮБУЮ карту, +2 M€» — хук `onResourceAdded` + близнец прогноза `grantForecast`), только ресурс —
data и +1 M€. Плюс действие «+1 data сюда» (форма TR08 / TR11 без цены), ПО «1 за 2 data» (форма Ants / Herbivores) и
требование «Марс вперёд» (подача — класс TR15). Клиентского кода — ноль, e2e — не писать.

Что проверить, а не написать:

| Впервые в наборе | Что проверить | Где образец |
| --- | --- | --- |
| **Реакция на ДОБАВЛЕНИЕ ресурса** у карты TR | хук зовёт ОДИН цикл `Player.addResourceTo` (`Player.ts:849–863`, обёртка `events.withEffect(…, 'resource-added')`) — оверлей эффектов называет карту; прогноз — `grantForecast` (обязателен: таблица хук ↔ близнец `effectForecast.ts:837–838`, гарды `effectForecastCoverage` / `effectForecastParity`) | Meat Industry, Topsoil Contract |
| **Бесплатное действие + реакция на него же**: «+1 data сюда» сразу платит +1 M€ эффектом | композер действия показывает ДВА результата: «data N → N+1 на этой карте» и прогноз «+1 M€ · Марсианское оптоволокно»; после коммита — капсула карты +1 и чип M€ на рельс | прогноз Meat Industry в превью действий с животными |
| **Четвёртый держатель data в скоупе** (TR02, TR05, TR15, теперь TR18) | выборы «data на ЛЮБУЮ карту» (TR01 Supreme Expertise, доход Плутона) видят карту кандидатом; каждый такой выбор теперь несёт и +M€ этой карты в прогнозе | спеки TR01 / Плутона |

### Правила чтения (каждое — закрепить спеком)
1. **Требование** «Requires Mars First to be ruling or that you have 2 delegates there» = `requirements: {party:
   PartyName.MARS}`.
2. **Эффект — за КАЖДЫЙ data**: +1 M€ на единицу (4 data от TR01 → +4 M€) — как Meat Industry платит за каждое животное.
   Только добавление (`count > 0`); трата / снятие data — ничего.
3. **«ANY card» = любая карта ИГРОКА** с ресурсом data: своя (в т. ч. эта — её же действие платит), TR02, TR05, TR15,
   корпорация с data. Data, положенные на твою карту эффектом, сработавшим в чужой ход (TR15 — город соперника на Марсе),
   — тоже «добавлены тобой»: хук срабатывает у владельца карты-получателя, как у Meat Industry с Pets.
4. **Действие** — бесплатное, раз в поколение: +1 data на эту карту (`action: {addResources: 1}`), и тут же +1 M€ эффектом.
   Недоступным действие не бывает (кроме «уже использовано»).
5. **ПО** — 1 за каждые 2 data на ЭТОЙ карте (`victoryPoints: {resourcesHere: {}, per: 2}`).
6. M€ с эффекта — источник эта карта (журнал, оверлей эффектов, прогноз).
7. MarsBot карту не играет.

### Решения владельца (подтвердить в отчёте, не блокер)
1. RU-имя **«Марсианское оптоволокно»** (fiber = оптоволокно; «Марсианское волокно» звучит как ткань).
2. Чтение правила 2 «за каждый data» (по образцу Meat Industry). Альтернатива «+1 M€ за каждое добавление, сколько бы data
   ни пришло» — сказать, если владелец читает так.

---

## 0. Рабочее дерево
`git status` на момент выдачи: НЕЗАКОММИЧЕНЫ правки соседа (сервер и спеки TR12-хвоста: `UnplayableReason.ts`,
`PlayerInput.ts`, `SelectParty.ts`, `deferredInputBatch.ts`, `unplayableReasons.ts`, `DiscardPopularSupport.ts` и три спека)
— **не трогать, не включать в свои коммиты.** С этой картой они не пересекаются. В общих файлах (`CardName.ts`, манифест,
словари, `lore_texts.json`, журнал) — только своя строка; `git add` по своим путям; код выхода гейтов читать ЯВНО
(`; echo exit=$?`). Новая карта сдвигает сид-сдачу Redux-столов — чужая фикстура может упасть в `e2e:fixtures`: чинить
классом (закреплять карту по имени). Память `concurrent-session-edits-same-files`, `turmoil-redux-party-sanctions`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR18.png` (лист `…\Printables\10-18.png`).
**Арт `C:\Users\zelin\Downloads\Mars Arts\TR18.png` на момент выдачи ОТСУТСТВУЕТ** — запросить у владельца; остальное не
ждёт (`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR18.png" TR18` → `npm run make:cards`).

- **Martian Fiber** · `cardNumber: 'TR18'` · стоимость **12** · тип **ACTIVE** (синяя) · метки **Марс, Строительство**
  (`[Tag.MARS, Tag.BUILDING]`, порядок скана).
- **Требование** — эмблема «Марс вперёд» в оранжевой плашке.
- **Эффект** `[data]* : [1 M€]` | **действие** `→ [data]` — *(Effect: Whenever you add a data resource to ANY card, also gain
  1 M€. Action: Add 1 data resource to this card.)*
- **ПО**: бейдж «1/2 [data]» — *(1 VP per 2 data resources here.)* Планета под цифрой — фон бейджа, не метка.
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется.
- **Лор** EN: *«Memes. The DNA of the soul.»* → `assets/text/lore_texts.json` ключ `"TR18"`; RU: **«Мемы. ДНК души.»**

## 2. Блок A · сервер — `src/server/cards/turmoilRedux/MartianFiber.ts`

```ts
export class MartianFiber extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.MARTIAN_FIBER, type: CardType.ACTIVE,
      tags: [Tag.MARS, Tag.BUILDING], cost: 12,
      resourceType: CardResource.DATA,
      requirements: {party: PartyName.MARS},
      victoryPoints: {resourcesHere: {}, per: 2},
      action: {addResources: 1},
      metadata: {
        cardNumber: 'TR18',
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever you add a data resource to ANY card, also gain 1 M€.', (eb) => {
            eb.resource(CardResource.DATA).asterix().startEffect.megacredits(1);
          }); // разделитель «|» между эффектом и действием — как у TR02 / TR15 (см. ниже)
          b.action('Add 1 data resource to this card.', (eb) => {
            eb.empty().startAction.resource(CardResource.DATA);
          }).br;
          b.vpText('1 VP for every 2 data resources here.');
        }),
      },
    });
  }

  public onResourceAdded(player: IPlayer, card: ICard, count: number) {
    if (card.resourceType === CardResource.DATA) {
      player.stock.add(Resource.MEGACREDITS, count, {log: true, from: {card: this}});
    }
  }

  /** Mirrors `onResourceAdded`: 1 M€ per data added to any of the owner's cards. */
  public grantForecast(cardOwner, _active, grant) { /* форма MeatIndustry.ts, resource DATA, amount × 1 */ }
}
```
- Эффект и действие на скане — в ОДНОЙ строке через вертикальную черту (как у TR02 / TR15): сверить, как это решено там, и
  сделать так же (ловушки `actionRowsOf` — плитка «Действий карт» рисует только бокс `→`; `or-edges` не применимо).
- Ресурс со своей вариацией — `Aurorai`/иные карты, где data хранится не через `resourceType`? В скоупе таких нет; если
  гард найдёт — назвать.
- `CardName.MARTIAN_FIBER = 'Martian Fiber'`; строка манифеста без `compatibility`. Шапка файла — чтение скана, правила 1–7,
  ссылка на Meat Industry.
- `infoText`: `effect-short` «Data added to any card: +1 M€» и `action-short`, если аудит потребует (бюджет 52 по RU —
  РУКАМИ, модульный словарь гарды не видят). Текст ПО — сверить, есть ли уже ключ «1 VP for every 2 data resources here.»
  (grep; у Pathfinders data-карт может быть) — переиспользовать, не заводить второй.

## 3. Блок B · клиент
Кода не ожидается. Проверить ГЛАЗАМИ: лицо (две метки, плашка «Марс вперёд», эффект | действие, бейдж «1/2 [data]»);
композер действия («ДЕЙСТВИЯ КАРТ › МАРСИАНСКОЕ ОПТОВОЛОКНО › НАСТРОЙКА») — чип data на этой карте и строка прогноза
«+1 M€ · Марсианское оптоволокно»; после коммита — полёт data в капсулу (`ICON_NEEDLES['data']` — проверить, что есть; нет —
добавить строку) и M€ на рельсе; розыгрыш TR01 с выбором этой карты — прогноз «+4 M€»; оверлей эффектов называет карту
после срабатывания. Найденный дефект общего слоя — чинить классом, назвать в отчёте.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Ожидается ~5 новых: `"Martian Fiber": "Марсианское
оптоволокно"` (**имя — решение владельца**); `Effect: Whenever you add a data resource to ANY card, also gain 1 M€.` →
«Каждый раз, когда вы добавляете data на ЛЮБУЮ карту, также получайте 1 M€.»; `Action: Add 1 data resource to this card.`
→ «Действие: добавьте 1 data на эту карту.» (голос — строки TR02 / TR15; слово «data» — как в словаре набора); текст ПО (если
нет); `effect-short`; лор RU — §1.

## 5. Тесты
**`tests/cards/turmoilRedux/MartianFiber.spec.ts`** (структура — `MeatIndustry.spec.ts` + `FormulaZero.spec.ts`):
метаданные (ACTIVE, 12, `[MARS, BUILDING]`, DATA, `{party: MARS}`, `per: 2`, TR18); требование (подача — TR15); действие →
+1 data сюда и +1 M€, `runAllActions` без промпта; data на другую свою карту (TR02 / TR05) → +1 M€ за каждый; TR01 «4 data на
любую карту» → +4 M€; data на карту, положенные в чужой ход (TR15 — город соперника на Марсе) → +1 M€ владельцу; добавление
животного / микроба → ничего; трата data (TR02 / TR05 / TR15 действие) → ничего; карта соперника с data — его добавление
моему игроку ничего не платит; ПО 0 / 1 / 2 / 3 / 4 data → 0 / 0 / 1 / 1 / 2; прогноз == исполнение (действие и TR01);
источник M€ — карта; save / load.
**Гарды чеклиста §3** — ворклист пуст; особо `effectForecastCoverage`, `effectForecastParity`, `effectExtraction`,
`actionExtraction`, `effectSummaryCoverage`, `trackerCoverageGuard`, `cardReasonConsistency`; `make:cards` 0 / 0 / 0.
**e2e — НЕ писать, фикстуру не добавлять** (политика чеклиста §5: путь реакции на ресурс и действия с ресурсом на карту
доказан соседями).

## 6. Визуальная приёмка (один профиль; свой сервер, «Тестовый режим» — `docs/DEV_GUARANTEED_CARDS.md`)
1. Витрина: лицо TR18 рядом с TR02 и TR15 — три держателя data одного семейства.
2. Композер действия с двумя результатами и кадр после коммита (капсула «1», M€ на рельсе).
3. Композер розыгрыша TR01 с выбором этой карты — прогноз «+4 M€».
4. Оверлей эффектов после срабатывания.

## 7. Режим работы
Экономный, **1–2 коммита**, зелёные по юнитам: (1) карта + спек + локаль + лор (+ арт, если есть); (2) журнал набора. Перед
коммитом: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой
`npm run make:css`. **Не пушить.** Документ карты не заводить. Гочи: `python3` — заглушка Store; юниты последовательно;
`eqeqeq` без исключения для null.

В отчёте: что напечатали гарды до / после; три проверки «впервые»; кадры §6; новые ключи i18n; **явно — всё, что не
получилось сделать по этому промту, и почему.**

## 8. Нельзя
Платить за трату data или за ресурсы других видов. Платить за добавление на карту соперника. Бесподобный `canAct`.
Пропустить близнец прогноза. Второй ключ для существующего текста ПО. Новый e2e, фикстура, документ карты.
`compatibility: 'turmoil'`. Трогать незакоммиченные файлы соседа, `shardPlan.json`. Пуш и красные коммиты.
