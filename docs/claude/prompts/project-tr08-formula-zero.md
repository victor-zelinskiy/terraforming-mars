# Промт исполнителю · TR08 Formula Zero («Формула-0») — вторая карта проектов Turmoil Redux

Выдан 2026-09-29. Инфраструктура набора уже стоит (TR09, коммиты `b6e7741723` … `4e373602f5`): манифест,
гард `TR##`, RU‑файл, модуль `turmoilRedux` во всех 22 SCOPE‑точках. **Второй раз ничего из этого не
делать.** Процедура — `docs/claude/turmoil-redux-card-checklist.md` (пройти ВСЕ пункты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила карт — `.claude/rules/game-logic.md`.

**Новых механик нет.** Карта — близнец **Security Fleet** (`src/server/cards/base/SecurityFleet.ts`:
действие «потрать → положи истребитель», 1 ПО за истребитель), с ценой действия в M€ вместо титана и
требованием меток. Три вещи для набора всё же «первые», и у каждой есть готовый в‑scope образец:

| Впервые в наборе | Образец, который уже зелёный | Что проверить |
| --- | --- | --- |
| действие за **M€** (`spend: {megacredits: 1}`) | Restricted Area / Space Mirrors (`base`) — `actionPreview.ts` § «A `spend.megacredits` action is only a FLAT cost…» | у Helion / Luna Trade Federation шаг оплаты ПРЕ‑собирается (`paymentStep`), у остальных — плоский cost‑чип; гард `actionPromptCoverage` чек 4 |
| **ПО за ресурс** (`victoryPoints: {resourcesHere: {}}`) | Security Fleet, Birds, Fish | бейдж премиум‑лица «1 / [истребитель]» (`vpRelationOf` → `per`), эндгейм‑разбивка по карте |
| **метка Марса** на карте в премиум‑скоупе (Pathfinders вне скоупа — до сих пор ни одна in‑scope карта её не носила) | `Tag.MARS` есть; иконка `assets/tags/mars.png` резолвится по имени (`tagIconUrl`); столбец в `consoleTagMatrix.ts`, группы руки/tableau знают её | лицо карты, матрица меток, счёт `player.tags.count(Tag.MARS)`; семантики у метки нет — только Habitat Marte (метка Марса как наука) и Mars Direct (скидка), обе вне игры |

---

## 0. Параллельная работа и рабочее дерево

- **В дереве лежат чужие незакоммиченные правки**: `tests/e2e/fixtures/generate.ts` (пиннинг корпораций
  парламентских столов), `tests/e2e/console-effect-forecast.spec.ts` (починка вакуумной проверки M€),
  `tests/e2e/console-parliament-aquifer.spec.ts`. **Не трогать, не откатывать, не включать в свои коммиты** —
  `git add` только по своим путям, перед коммитом `git status` глазами.
- Общие файлы (`TurmoilReduxCardManifest.ts`, `CardName.ts`, `src/locales/**`, `assets/text/lore_texts.json`,
  журнал набора) — только своя строка; `genfiles/**` не править руками, пересобирать.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR08.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR08.png` (1536×1024, стандарт) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR08.png" TR08` → `npm run make:cards`.

- **Formula Zero** · `cardNumber: 'TR08'` · стоимость **5** · тип **ACTIVE** · метки **Наука, Наука, Марс**.
  Конвенция сканов набора: кружки в правом верхнем углу — это МЕТКИ (TR09 — Космос, TR10 — Юпитер + Космос),
  а «Марс» под цифрой ПО внизу справа — фон бейджа ПО, не метка. Здесь в углу — планета Марс → `Tag.MARS`.
- **Требование:** 2 метки Науки — `requirements: {tag: Tag.SCIENCE, count: 2}` (образец `base/AICentral.ts`).
- **Действие:** *Pay 1 M€ to add a fighter resource to this card.* — `action: {spend: {megacredits: 1},
  addResources: 1}` + `resourceType: CardResource.FIGHTER`, класс **`ActionCard`**.
- **ПО:** *1 VP per fighter resource here.* — `victoryPoints: {resourcesHere: {}}` (ровно как Security Fleet).
- **Лор** EN: *«Now this is pod-racing!»* — в `assets/text/lore_texts.json` его ЕЩЁ НЕТ: добавить под ключом
  `"TR08"` (рядом с `"TR09"`). RU — §4.

### Правила чтения (каждое — закрепить спеком)
1. Цена действия — 1 M€ через `spend.megacredits`: у обычного игрока списывается без вопроса (плоский
   cost‑чип в превью), у Helion / Luna Trade Federation движок деферит `SelectPaymentDeferred`, и превью
   действия ОБЯЗАНО нести этот шаг первым в ветке (`actionPreview.ts` делает это само — проверить, не писать).
2. Недоступность действия при 0 M€ — авто‑причина «Not enough M€» (никакого бесподобного `canAct`; иначе
   красный `cardReasonConsistency`).
3. ПО = число истребителей на карте (0 → 0, 3 → 3); считается общим путём `Card.getVictoryPoints`.
4. Требование — только через DSL (`requirements`): дикая метка Учёных / бонус R&D Funding засчитываются сами.
5. Метка Марса — обычная метка: `player.tags.count(Tag.MARS)` даёт 1, к науке НЕ прибавляется без Habitat Marte.
6. Ресурс «истребитель» уже полноценный (`CardResource.FIGHTER`, спрайт, классы, RU) — ничего не заводить.

## 2. Блок A · сервер

```ts
export class FormulaZero extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.FORMULA_ZERO, type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SCIENCE, Tag.MARS], cost: 5,
      resourceType: CardResource.FIGHTER,
      requirements: {tag: Tag.SCIENCE, count: 2},
      victoryPoints: {resourcesHere: {}},
      action: {spend: {megacredits: 1}, addResources: 1},
      metadata: {
        cardNumber: 'TR08',
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 M€ to add a fighter resource to this card.', (eb) => {
            eb.megacredits(1).startAction.resource(CardResource.FIGHTER);
          }).br;
          b.vpText('1 VP for each fighter resource on this card.');
        }),
      },
    });
  }
}
```
- `CardName.FORMULA_ZERO = 'Formula Zero'` в секции `// Turmoil Redux`; строка в манифесте.
- `b.vpText('1 VP for each fighter resource on this card.')` — **тот же ключ, что у Security Fleet**
  (уже переведён в `cards.json`), не перефразировать.
- `infoText`: строка действия генерируется из `behavior`; если аудит покажет капшен > 52 символов —
  `{kind: 'action-short', text: 'Add a fighter to this card', tokens: ['action(res-fighter)']}` — ключ Security
  Fleet, уже переведён в `card_info.json` («Положите сюда жетон истребителя»). Новых ключей информации —
  ноль, если аудит не потребует иного.
- Хуков нет: `cardPlayPreview` / `actionPreview` / `actionUnavailableReason` / forecast — авто; триггеров у
  карты нет → forecast‑близнец не нужен.

## 3. Блок B · клиент (консоль)

- **`src/client/console/consoleActionCommitMotion.ts` `ICON_NEEDLES` → `'fighter': ['fighter']`** — иначе
  импульс коммита не находит иконку результата и тихо деградирует (тот же класс дыры, что закрыли мехом;
  заодно чинит Security Fleet). Драйв‑бай в той же таблице допустим: `'graphene': ['graphene']`
  (Carbon Nanosystems, in‑scope) — одной строкой, если возьмёшься.
- Всё остальное — даром: cost‑чип «−1 M€» + gain‑чип «+1 истребитель на этой карте» → категория `resources`
  → полёт в капсулу `.pcard__res`; у Helion — шаг оплаты в композере (LB/RB/RT в sub); бейдж ПО «1 / [истр.]»
  на лице; эндгейм‑разбивка ПО по карте (`cardScoreContribution` — общий источник `resource`, как у
  Security Fleet); матрица меток показывает столбец Марса.
- Проверить ГЛАЗАМИ (не чинить, если работает): три метки на лице в порядке скана (наука, наука, Марс);
  чип требования «2 [наука]»; крошка «ДЕЙСТВИЯ КАРТ › ФОРМУЛА‑0 › НАСТРОЙКА».

## 4. Блок C · локаль

Перед КАЖДЫМ ключом: `grep -rn '"<ключ>"' src/locales/*/*.json`.
- `src/locales/ru/turmoil_redux_cards.json`: `"Formula Zero": "Формула-0"` (каламбур на «Формулу‑1»; **имя —
  решение владельца**); `"Action: Pay 1 M€ to add a fighter resource to this card.": "Действие: заплатите 1 M€,
  чтобы положить жетон истребителя на эту карту."` (голос — строка Security Fleet в `cards.json`:
  «потратьте 1 титан, чтобы положить жетон истребителя на эту карту»).
- `src/locales/ru/lore_texts.json` (ключ = английский текст): `"Now this is pod-racing!": "Вот это я понимаю —
  гонки на подах!"` — сверить голос с соседями; цитата из «Скрытой угрозы», допустим дубляжный вариант.
- `card_info.json`: только то, что напечатает `missingTranslations.ru` (ожидается 0: ключи ПО и капшена
  уже есть).
- Метка Марса в RU — «Марс» (`help_iconography.json`, ключ в общем словаре); ничего не добавлять.

## 5. Тесты

**Серверный `tests/cards/turmoilRedux/FormulaZero.spec.ts`** (структура — `EvaMechs.spec.ts`):
- метаданные: имя, тип, стоимость 5, метки `[SCIENCE, SCIENCE, MARS]`, `resourceType` FIGHTER, `TR08`,
  `victoryPoints.resourcesHere`;
- требование: 1 метка Науки → `canPlay` false + причина требования; 2 → true;
- действие: 0 M€ → `canAct` false и `actionUnavailableReasons` называет M€; 1 M€ → M€ −1, +1 истребитель,
  `runAllActions` не оставляет промпта; превью `declarative` — cost‑чип M€ 1, gain‑чип истребителя
  `note: 'on this card'`, шагов нет;
- **Helion**: превью несёт `paymentStep` первым шагом ветки и cost‑чип M€ из ветки убран (правило
  `actionPreview.ts`); исполнение действия оставляет `SelectPayment` (`popWaitingFor`), ответ `{heat: 1}`
  кладёт истребитель;
- ПО: 0 / 1 / 3 истребителя → 0 / 1 / 3; `player.tags.count(Tag.MARS)` = 1, `count(Tag.SCIENCE)` = 2
  (без Habitat Marte);
- save/load: `resourceCount` переживает сериализацию.
**Манифест‑гард** зелёный (номер, коллизии, ворота колоды). **Все гарды чеклиста § 3** — ворклист TR08
пуст; `make:cards` — 0 / 0 / 0.
**Клиентские**: ничего нового, кроме строки в спеке `consoleActionCommitMotion` (если у `ICON_NEEDLES` есть
спек — добавить `fighter`; если нет — не заводить).
**e2e — НЕ писать** (политика чеклиста § 5: новой механики нет; путь действия с ресурсом «на эту карту»
доказан `console-eva-mechs.spec.ts`, путь оплаты действия M€ — соседями). Фикстуру не добавлять
(`npm run e2e:fixtures` на HEAD в любом случае падает до парламентской секции — чужая поломка, см. журнал).

## 6. Визуальная приёмка (один профиль, ДВА кадра)
1. `?premiumCardsPlayground` — лицо TR08: арт, три метки (наука, наука, Марс), чип требования «2 наука»,
   ряд действия (1 M€ → истребитель), бейдж ПО «1 / [истребитель]».
2. Композер действия («ДЕЙСТВИЯ КАРТ › ФОРМУЛА‑0 › НАСТРОЙКА») с чипами «1 → 0 M€» / «0 → 1 на этой
   карте» и кадр после коммита — капсула «1». Карту гарантировать в руку через «Тестовый режим»
   (`docs/DEV_GUARANTEED_CARDS.md`).

## 7. Режим работы
Экономный, **1–2 коммита**, зелёные по юнитам: (1) карта + спеки + локаль + арт + лор (+ `ICON_NEEDLES`);
(2) при желании — журнал и правка чеклиста отдельно. Перед коммитом: `npm run lint`, `npm run build:test`,
`npm run make:cards`, `npm run make:json`, `npm run make:css` перед визуальной проверкой. **Не пушить.**
Документ карты **не заводить** (нового контракта нет); запись в журнал набора обязательна (что нового: первая
M€‑цена действия, первое ПО за ресурс, первая метка Марса в скоупе; решения: имя; гэпы). В чеклист § 0
добавить ОДНУ строку про конвенцию сканов (кружки в углу = метки; планета под ПО = фон бейджа).

Гочи: `python3` — заглушка Store, только `python`; `cross-env` в bash нет — `NODE_ENV=… npx mochapack`; юниты
последовательно; `eqeqeq` без исключения для null.

В отчёте: что напечатали гарды до/после; подтверждение, что шаг оплаты у Helion пришёл из `actionPreview.ts`
без правок; два кадра; новые ключи i18n (ожидается ровно три: имя, действие, лор).

## 8. Нельзя
Повторно расширять скоуп или трогать инфраструктуру набора. Бесподобный `canAct`/`play`. Второй ключ для
текста ПО или капшена (у Security Fleet они уже есть). Новый e2e / фикстура. Трогать чужие незакоммиченные
файлы. Центральные таблицы вместо co‑located. Заводить документ карты. Пуш и красные коммиты.
