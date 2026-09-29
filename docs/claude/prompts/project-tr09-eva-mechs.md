# Промт исполнителю · TR09 EVA Mechs («Мехи ВКД») — ПЕРВАЯ карта проектов Turmoil Redux

Выдан 2026-09-29. Turmoil Redux получает **70 карт проектов (TR01–TR70)** и 6 карт‑замен; они будут
внедряться по одной, как резолюции. **TR09 — первая**, и поэтому у неё две работы сразу:

1. **Заложить инфраструктуру набора** (модуль‑манифест, гард пространства `TR##`, файл RU‑имён,
   вход модуля `turmoilRedux` в премиум‑скоуп со всеми гардами, чеклист автора для следующих 69 карт).
2. **Ввести новый ресурс карт `Mech` и новую платёжную единицу `mechs`** — сквозной контракт от
   `Spendable.ts` до консольной панели оплаты, статистики и журнала — и на нём сыграть саму карту.

Карта обязана быть «сделана» во ВСЕХ премиум‑механиках форка: превью действия (pre‑select), причины
недоступности, блок эффектов и трекинг статистики («использовано как оплата»), панель оплаты консоли,
лицо карты, структурный текст (`metadata.information`), лор, e2e. Ничего из этого не «потом».

**Образцы (читать до кода):**
- **`src/server/cards/venusNext/Dirigibles.ts`** — механический близнец (аэростаты платят за метку
  Венеры по 3 M€). Рендер‑DSL действия/эффекта брать один в один, меняя ресурс/метку/число.
- **`src/server/cards/delta/ModularFloodgates.ts` + `tests/cards/delta/ModularFloodgates.spec.ts`
  §«the payment source — floodgateSteel»** — последняя добавленная в форке платёжная единица; `grep -rn
  floodgateSteel src tests` — это и есть ТРОПА всех точек касания (но у неё есть лишнее, см. §3.4).
- **`src/server/cards/delta/DeltaProjectCardManifest.ts` +
  `tests/cards/delta/DeltaProjectCardManifest.spec.ts`** — шаблон манифеста модуля и его гарда.
- `docs/claude/expansion-adaptation-checklist.md` — процедура входа модуля в скоуп (шаг 1 = расширить
  ВСЕ SCOPE‑константы, затем гарды печатают ворклист). Правила карт — `.claude/rules/game-logic.md`.

---

## 0. Режим и горячие файлы

Рядом могут работать другие агенты (резолюции, колонии). Общие файлы — `src/locales/**`,
`src/common/inputs/*.ts`, `src/server/Player.ts`, `genfiles/**` — только свои строки, генерируемое руками
не править, перед коммитом перечитать файл. `genfiles` пересобирать (`make:cards`, `make:json`), не редактировать.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR09.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR09.png` (1536×1024 — стандартный кадр, `--force` не нужен) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR09.png" TR09` → `npm run make:cards`.

- **EVA Mechs** · `cardNumber: 'TR09'` · стоимость **6** · метки **Наука + Космос** · тип **ACTIVE**.
- **Требование:** 1 метка Науки — `requirements: {tag: Tag.SCIENCE}` (образец `ares/BioengineeringEnclosure.ts`).
  Только через DSL требований: дикая метка Учёных и бонус R&D Funding (RX26) тогда считаются сами.
- **Действие:** *Pay 1 energy to add a mech resource to this card.* —
  `action: {spend: {energy: 1}, addResources: 1}` + `resourceType: CardResource.MECH`, класс **`ActionCard`**.
- **Эффект:** *When playing a Space tag, mechs here may be used as payment, and are worth 5 M€ each.*
  Это НЕ триггер, а **платёжная единица** (как аэростаты Dirigibles): хука `onCardPlayed` и
  forecast‑близнеца у карты нет и быть не должно.
- **Лор** EN уже лежит: `assets/text/lore_texts.json` → `"TR09"`. RU написать (§5).

### Правила чтения (каждое — закрепить спеком)
1. Мехи платят **только за карту с меткой Космоса** (`card.tags.includes(Tag.SPACE)`), ровно как титан
   по печатному правилу. НЕ за стандартные проекты, НЕ по отложенному счёту (`SelectPaymentDeferred`),
   НЕ через Last Resort Ingenuity (её текст называет сталь и титан — мехов там нет).
2. Ценность **плоская 5 M€**: модификаторы титана (Phobolog и т.п.) и закон Metal Research (RX19) её не
   меняют. `rateFor` в клиенте — без ветки, падает в `DEFAULT_PAYMENT_VALUES`.
3. Переплата — семантика апстрима (`payingAmount >= cost`, сдачи нет): 2 меха за карту в 6 M€ легальны,
   оба уходят. Закрепить, не «чинить».
4. **`Mech` — полноценный ресурс карт**: любая будущая карта TR может хранить/добавлять мехи
   (`addResourcesToAnyCard` с `type: MECH`, `getResourceCards(MECH)` — всё generic). Деньгами являются
   только мехи **на EVA Mechs** (`CARD_FOR_SPENDABLE_RESOURCE.mechs`), как аэростаты только на Dirigibles.
5. Мех **не «считается на планшете»** (в отличие от стали DP11): никаких расширений unit‑стоимостей,
   наград и атак. Атаки на ресурсы карт — общий путь `RemoveResourcesFromCard`, без исключений.
6. Причина недоступности действия — авто из `spend.energy` («Not enough energy»); бесподобного
   `canAct`/`canPlay` у карты НЕТ (иначе красный `cardReasonConsistency`).

## 2. Блок 0 · инфраструктура набора (делается ОДИН раз, здесь)

- **Каталог** `src/server/cards/turmoilRedux/` + `TurmoilReduxCardManifest.ts` (`module: 'turmoilRedux'`).
  Шапка — по образцу Delta: пространство `TR##` = TR01…TR70 (двузначное, ноль впереди); шесть карт‑замен
  (Aerial Lenses, Banned Delegate, Political Alliance, Recruitment, Sponsored Mohole, Vote of No
  Confidence) — ЗАРЕЗЕРВИРОВАНЫ, в этой задаче не трогать; `cardNumber` = ключ арта и лора.
- Регистрация: `src/server/cards/AllManifests.ts` (массив) **и** `src/server/GameCards.ts`
  (`[gameOptions.turmoilReduxExpansion, TURMOIL_REDUX_CARD_MANIFEST]` — без этой строки карта не попадёт в
  колоду). `CardFactorySpec.isCompatibleWith` уже знает `'turmoilRedux'`.
- `src/common/cards/CardName.ts`: секция `// Turmoil Redux` после Delta → `EVA_MECHS = 'EVA Mechs'`.
- **Гард** `tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts` — зеркало Delta‑спека: `^TR\d{2}$`,
  ни одного номера дважды, ни одной коллизии с другими модулями, «расширение вкл → добавлены ровно карты
  модуля», «выкл → ничего», прелюд‑фолбэк Valley Trust цел, `compatibility: 'turmoilRedux'` резолвится.
- **RU‑имена:** новый `src/locales/ru/turmoil_redux_cards.json` (конвенция `<module>_cards.json`, образец
  `delta_cards.json`: имя + ключи с префиксами `Action: …` / `Effect: …`).
- **Вход в премиум‑скоуп — обязательно, сейчас.** Резолюции в `cards.json` не лежат (они идут через
  `ParliamentCatalog`), поэтому расширение втянет только карты проектов, т.е. ровно TR09. Добавить
  `'turmoilRedux'` во ВСЕ 22 точки: `grep -rln "new Set<GameModule>" src tests` — 17 спеков
  (`cardInformation`, `requirementProse`, `cardLore`, `premiumCardViewModel` ×4 сета, `actionBranchAvailability`,
  `actionPreviewCoverage`, `actionPreviewReasonCoverage`, `actionPromptCoverage`, `actionReasonCoverage`,
  `cardPlayPreviewCoverage`, `cardReasonConsistency`, `consolePlayPreviewCoverage`, `corpFirstActionPreview`,
  `effectForecastCoverage`, `effectForecastParity`, `variableAmountPreviewGuard`, `crossPlayerCoverageGuard`)
  + 5 в `src` (`effectExtraction.ts`, `actionExtraction.ts`, `PremiumCardsPlayground.vue`,
  `buildCardInformation.ts`, `audit_card_art.ts`) + `devGuaranteedCards.ts` (чтобы TR09 можно было
  гарантировать в первой руке через «Тестовый режим» — `docs/DEV_GUARANTEED_CARDS.md`). Затем прогнать
  гарды: их красный список = твой ворклист по TR09, и он должен опустеть.
- Документы скоупа: строка «Current scope» в `docs/claude/expansion-adaptation-checklist.md` и строка
  «Premium-subsystem scope today» в `CLAUDE.md` — добавить `turmoilRedux` (одно слово, файл не растить).
- **Чеклист автора для следующих 69 карт** — `docs/claude/turmoil-redux-card-checklist.md` (короткий, по
  образцу «short form» из `parliament-resolution-checklist.md`): пять точек касания + специфика модуля
  (номер, импорт арта, лор EN+RU и паритет `cardLore.spec`, RU‑имя, `card_info.json`, какие гарды
  печатают ворклист, что карта получает бесплатно, что требует хука, политика e2e — один спек на карту с
  новой механикой, ни одного на «просто ещё одну карту»). Зарегистрировать в `docs/claude/README.md`.
- **Журнал набора** `docs/claude/turmoil-redux-cards-progress.md` — запись TR09 (что нового, решения,
  оставшиеся гэпы). **Документ карты** `docs/TURMOIL_REDUX_EVA_MECHS.md` — контракт ресурса `Mech` и
  единицы `mechs`: что наследует следующая карта с мехами.

## 3. Блок A · сервер

### 3.1 Ресурс
- `src/common/CardResource.ts`: секция `// Turmoil Redux` → **`MECH = 'Mech'`**. Литерал несущий: иконка,
  графический id и CSS‑класс выводятся из имени (`'Mech'` → `assets/resources/mech.png` (уже в дереве,
  512², альфа) · `res-mech` · `.card-resource-mech`). Не `'Mech unit'`, не `'MECH'`.
- `src/common/constants.ts`: `MECHS_VALUE = 5` рядом с `FLOATERS_VALUE`.
- Ничего в `Card.ts`/`Executor.ts`/`AddResourcesToCard*`/`LogHelper` не менять — всё generic.

### 3.2 Платёжная единица `mechs` — точки касания (тропа `floodgateSteel`)
Компилятор заставит (`satisfies Record<…>`/mapped types):
- `src/common/inputs/Spendable.ts`: `SPENDABLE_CARD_RESOURCES` + `'mechs'` (с комментарием как у соседей);
  `CARD_FOR_SPENDABLE_RESOURCE.mechs = CardName.EVA_MECHS`.
- `src/common/inputs/Payment.ts`: `DEFAULT_PAYMENT_VALUES.mechs = MECHS_VALUE`; `Payment.EMPTY`; `Payment.of`.
- `src/server/Player.ts`: `paymentOptionsForCard` → **`mechs: card.tags.includes(Tag.SPACE)`** (только это
  условие — см. правило 1); `maxSpendable` → `getSpendable('mechs')`; `payingAmount.usable`;
  **`pay()` → `removeResourcesOnCard(CardName.EVA_MECHS, payment.mechs, DEFAULT_PAYMENT_VALUES.mechs)`** —
  эта строка и есть трекинг: `removeResourceFrom` + `recordResourceAsPayment` → событие с
  `cardResourcesSpentAsPayment` → агрегат `paymentResources` → блок эффектов «Spent as payment» и журнал.
  Без неё карта молча «съедает» мехи.
Молчащие без компилятора (пропустишь — сломается тихо):
- `src/common/models/PlayerInputModel.ts`: `mechs: number` в `SelectProjectCardToPlayModel` и `SelectPaymentModel`.
- `src/server/inputs/SelectCardToPlay.ts` и `SelectPayment.ts` → `toModel`: `mechs: player.getSpendable('mechs')`.
- `src/server/deferredActions/SelectPaymentDeferred.ts` → `buildSelectPayment`: **`mechs: false`**
  (сознательно: отложенный счёт — не розыгрыш карты с меткой Космоса). `Options` и
  `mustPayWithMegacredits` не расширять.
- `src/server/models/effectForecast.ts` `paymentValuesOf` — группа «Скидки и оплата» подхватит `mechs` сама
  (итерирует `SPENDABLE_CARD_RESOURCES`); проверить глазами в композере розыгрыша.

### 3.3 Карта
```ts
export class EvaMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.EVA_MECHS, type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SPACE], cost: 6,
      resourceType: CardResource.MECH,
      requirements: {tag: Tag.SCIENCE},
      action: {spend: {energy: 1}, addResources: 1},
      metadata: {
        cardNumber: 'TR09',
        infoText: [{kind: 'effect-short', text: 'Space tag: mechs here pay 5 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(1).startAction.resource(CardResource.MECH);
          }).br;
          b.effect('When playing a Space tag, mechs here may be used as payment, and are worth 5 M€ each.', (eb) => {
            eb.tag(Tag.SPACE).startEffect.resource(CardResource.MECH).equals().megacredits(5);
          });
        }),
      },
    });
  }
}
```
- **`.equals()` несущий**: `effectExtraction.ts` читает `valueAsPayment = equals ∧ cardResource ∧ megacredits`
  — без него эффект классифицируется как «ИЛИ получите M€» и блок эффектов врёт.
- `resourceType` обязателен — иначе в превью действия исчезнет gain‑чип «+1 мех на этой карте».
- Строка действия в `metadata.information` генерируется из `behavior`; если её длина > 52 символов —
  добавить `{kind: 'action-short', text: '…', tokens: ['action(res-mech)']}` (правило синих карт; аудит
  `cardInfoAudit.json` покажет). Строка эффекта — `effect-short` выше (образец Dirigibles).
- Хуков не нужно: `cardPlayPreview`/`actionPreview`/`actionUnavailableReason`/forecast — авто. Никаких
  центральных таблиц (`EFFECT_OVERRIDES`, `CARD_HEADLINE`, каналов) — у Dirigibles их нет, у нас тоже.

### 3.4 Что НЕ трогать (лишнее на тропе `floodgateSteel`)
`behavior/steelSpendSource.ts`, `Executor.ts` (spend‑гейты), `awards/Industrialist.ts`,
`actionUnavailableReasons.ts` (ветка стали), `checkPaymentAndPlayCard` («последний ресурс» — у мехов
нет потребителя‑предпосылки), `paymentModelUtils.buildStandardProjectPaymentOptions` (закрытый список),
все карты автомы (`AutomaTargeting` и т.п. — partial‑записи, мех туда не входит), `help_iconography.json`
(сирота), билдер `b.mech()` не заводить — конвенция `b.resource(CardResource.X)`.

## 4. Блок B · клиент (только консоль; десктоп удаляется, но типы его файлов ещё компилируются)

- `src/client/components/common/cardResources.ts` → `[CardResource.MECH]: 'card-resource-mech'` (exhaustive).
- `src/client/components/cardlist/CardListModel.ts` → фильтр `[CardResource.MECH]: true` (exhaustive).
- `src/styles/cards_v2.less` `@card_resource_types` → `…, steel, mech;` — генерирует ГЛОБАЛЬНЫЙ
  `.card-resource-mech` (журнал, спутник ДОП. РЕСУРСЫ, option‑иконки, `ConsoleYieldUnit`). Без него —
  пустой квадрат везде вне лица карты (комментарий у `STEEL` там же описывает ровно этот баг).
  `src/styles/resources.less` `@resource_types` → `+ mech` (семейство `resource_icon--mech`).
- `src/client/components/payment/paymentModelUtils.ts`: **`GENERIC_PAYMENT_ORDER` + `'mechs'`** после
  `'graphene'` и ДО `'floodgateSteel'` (та остаётся последней по своему комментарию); гард
  `paymentPlan.spec.ts` «lane order covers EVERY spendable» иначе красный. `buildStandardProjectPaymentModel`
  → `mechs: available.mechs`.
- **`src/client/console/paymentPlan.ts`:** `projectCardPaymentOptions` → `mechs: tags.includes(Tag.SPACE)`
  (ТОЧНОЕ зеркало сервера, без lastResort); `PAY_UNIT_LABELS.mechs = 'Mechs'` (дорожка называет РЕСУРС,
  как `floaters: 'Floaters'` — имя карты носит только `floodgateSteel`, где сталь на карте иначе
  неотличима от стали планшета; RU «Мехи» — тот же ключ, что и множественное в `ui.json`, один раз);
  **`PAY_UNIT_ICONS.mechs = 'mech'` обязательно** (иначе `iconClassFor('mechs')` → несуществующий
  `.card-resource-mechs` — пустой квадрат, тот самый класс бага из комментария рядом).
- `STANDARD_PROJECT_PAYMENT_ORDER` и `buildStandardProjectPaymentOptions` — **не расширять** (закрытый
  список, зеркало серверной ветки стандартных проектов; лишняя дорожка кончается «Did not spend enough»).
- **Решение по авто‑распределению: мех — ОБЫЧНЫЙ жадный альтернативный источник**, как аэростаты и
  графен, по критерию самого кода (`PaymentDefaults.ts` § greedy: жадность — для ресурса, который больше
  ничего не покупает). `initialCounts` не расширять: защита `floodgateSteel` существует потому, что та
  сталь ещё и блокада; у меха второго применения нет, а 1 энергия → 5 M€ — ровно то, ради чего его копили.
  Следствие рейта 5 — самый грубый шаг в игре: `laneCap = ceil(cost/5)`, вердикт «Переплата +N» будет
  звучать чаще, чем у любой дорожки, и это честно; игрок понижает через LT «Настроить оплату». Если
  следующая карта TR введёт ТРАТУ мехов на эффект — критерий поменяется; записать это в документ карты.
  Зафиксировать в спеке `paymentPlan.spec` (блок по образцу floodgateSteel, без половины «never seeded»,
  плюс cap и overpay при cost 6 / 2 мехах; + строка в «card-bound alternates reach the panel»:
  `holder(CardName.EVA_MECHS, n)` + промпт с `[Tag.SPACE]` → `{rate: 5, available: n}`).
- Ожидаемое поведение композера: карта Космоса уже принимает титан (и графен), поэтому с мехами в игре
  дорожек ≥ 2 → `editorEligible` → появляется LT‑редактор вместо inline‑пилюль; крошка при открытом
  редакторе читает «… › ОПЛАТА». Это норма, не регрессия.
- **`src/client/console/consoleActionCommitMotion.ts` `ICON_NEEDLES` → `'mech': ['mech']`** — иначе
  импульс коммита действия не находит иконку результата на графике и тихо деградирует (так сейчас
  сломан графен — не повторять).
- `src/client/console/railValueModel.ts` → `CONTEXT_FOR_CARD_UNIT.mechs = 'space'` (exhaustive; значение
  уже в union). Бейдж в спутнике ДОП. РЕСУРСЫ должен читать «5 M€ · Космос» по тому же словарю, что титан.
- Компилируемые десктоп‑остатки: `PaymentRowV2.vue` `ICON_CLASS.mechs = 'resource_icon--mech'`,
  `PaymentFormV2.vue` `DEFAULT_DESCRIPTIONS.mechs`, `PaymentWidgetMixin.ts` `getAvailableUnits` — по строке.
- **Коммит действия** («ДЕЙСТВИЯ КАРТ» → A): gain‑чип с `note: 'on this card'` → категория `resources` →
  `extractPlayRewards` → полёт меха с узла `res-mech` графики действия в капсулу `.pcard__res` самой карты,
  счётчик тикает на посадке. Per‑card кода нет; проверить ГЛАЗАМИ, что хост кормит лицо живой
  `CardModel` (иначе капсула вечно «0» — `docs/claude/console/played-target-self.md` § 5).
- **Композер розыгрыша** карты с меткой Космоса: строка‑инфо оплаты (`paymentChips`) показывает дорожку
  меха «−N · было → стало» с иконкой; LT‑sub даёт дорожку с рейтом 5; при AUTO без не‑M€ дорожек —
  никаких мёртвых кнопок (память `console-play-card-preselect`).
- Блок эффектов / оверлей: авто (`valueAsPayment` → семья `payValue`); после реальной оплаты мехами
  оверлей эффекта показывает «Spent as payment» с суммой — проверить.

## 5. Блок C · локаль и тексты

Перед КАЖДЫМ ключом: `grep -rn '"<ключ>"' src/locales/*/*.json` (дубль = падение `make:json`).
- `src/locales/ru/turmoil_redux_cards.json`:
  `"EVA Mechs": "Мехи ВКД"` (ВКД — внекорабельная деятельность; **имя — решение владельца**, если он
  предложит другое, взять его);
  `"Action: Pay 1 energy to add a mech resource to this card.": "Действие: заплатите 1 энергию, чтобы добавить 1 мех на эту карту."`;
  `"Effect: When playing a Space tag, mechs here may be used as payment, and are worth 5 M€ each.": "Эффект: разыгрывая карту с меткой Космоса, вы можете платить мехами с этой карты по 5 M€ за каждый."`
  Голос сверить с соседними ключами `cards.json` («потратьте 1 энергию, чтобы…»).
- `src/locales/ru/console.json` (блок имён ресурсов карт): `"Mech": "Мех"`. `ui.json` (блок множественных):
  `"Mechs": "Мехи"` + карта множественного в `ConsoleExtrasExplorer.vue` (`'Mech': 'Mechs'`).
- `src/locales/ru/card_info.json`: `"Space tag: mechs here pay 5 M€ each": "Метка Космоса: мехи как 5 M€"`
  (по строке Dirigibles «Метка Венеры: аэростаты как 3 M€») + все `missingTranslations.ru` из аудита.
- `src/locales/ru/lore_texts.json` (ключ = английский текст):
  `"In space, no one can hear you scream. That's why space builders develop a sailor mouth.":
  "В космосе никто не услышит твоего крика. Вот почему космические строители ругаются как сапожники."`
  Прочитать 2–3 соседних записи и держать их голос.
- Термины — только канон локали: «энергия», «метка Космоса», «M€» как у соседей; РТ/ПО не путать.

## 6. Тесты

**Серверные (`tests/cards/turmoilRedux/EvaMechs.spec.ts`)** — по структуре DP11‑спека:
- метаданные (имя, тип, стоимость, метки, `resourceType`, `TR09`); требование: 0 меток Науки → `canPlay`
  false и причина требования, 1 метка → true; дикая метка Учёных/бонус RX26 засчитываются (если дёшево);
- действие: без энергии `canAct` false и `actionUnavailableReasons` называет энергию; с 1 энергией —
  энергия −1, на карте +1 мех, `player.energy`/планшет иначе не тронуты; событие `cardResources` записано;
  превью действия `declarative` с cost‑чипом энергии и gain‑чипом меха `note: 'on this card'`;
- платёжный источник: `canAfford({cost, mechs: true})` считает мехи только с опцией; `payingAmount` 5/шт
  при `mechs: true`, 0 без; `paymentOptionsForCard`: Космос → true, Здание/без метки → false, стандартный
  проект → нет, Last Resort Ingenuity НЕ включает; `canSpend` ограничен числом на карте; `pay()` списывает
  С КАРТЫ и пишет `cardResourcesSpentAsPayment`; реальный `checkPaymentAndPlayCard` смесью M€+титан+мехи;
  переплата 2 мехами за 6 M€ легальна; Metal Research не меняет 5; `unplayableReasons` карты с Космосом
  при 0 M€ и 2 мехах — играбельна, без Космоса — «не хватает M€»;
- сериализация: `resourceCount` переживает save/load.
**Манифест:** `TurmoilReduxCardManifest.spec.ts` (§2). **Гарды после расширения скоупа:** все 17 + `cardInformation`
(16 тестов), `requirementProse` EN+RU, `cardLore` (нужен RU‑лор), `premiumCardViewModel` coverage,
`effectSummaryCoverage`/`trackerCoverageGuard`/`effectFamilyCoverage` — зелёные с TR09 внутри.
**Клиентские:** блок `mechs` в `paymentPlan.spec.ts` (§4); строка в `optionIcons.spec.ts`
(`card-resource card-resource-mech`); случай меха в `railValueModel.spec.ts` рядом с графеном (монета «5»,
контекст `space`, только пока EVA Mechs в tableau, `spendableAmount` = счётчик карты); фикстура
`ConsolePartyActionComposerBill.spec.ts` → `mechs: 0` (и любая другая рукописная `SelectPaymentModel` /
`SelectProjectCardToPlayModel` в `tests/` — грепнуть); `e2eFixturesLoad.spec.ts` для новой фикстуры.
**Капшены:** `tests/cards/effectCaption.spec.ts` и `actionCaption.spec.ts` — каждый печатный ряд имеет
описание, кураторский капшен = предложение (не обрезок), переведён в RU; `src/server/tools/check_locales.ts`.
**РОВНО ОДИН новый e2e** `tests/e2e/console-eva-mechs.spec.ts` + фикстура `eva-mechs` в
`tests/e2e/fixtures/generate.ts` (2 игрока; у P1 в tableau EVA Mechs с 2 мехами, `energy: 1`, в руке
карта с меткой Космоса, M€ меньше её цены без мехов; образец аранжировки — `olympus.resourceCount = 1`
там же). Путь: (1) ДЕЙСТВИЯ КАРТ → EVA Mechs → композер показывает −1 энергия / +1 мех на этой карте →
A → полёт на карту, капсула «3», сервер согласен; (2) рука → сыграть карту Космоса → панель оплаты
показывает дорожку «Мехи ВКД» по 5, авто‑распределение закрыло недостачу → подтвердить → сервер: карта
сыграна, мехов на карте меньше ровно на потраченное, M€ сходятся, в ленте строка оплаты. Образцы:
часть (1) — `console-modular-floodgates.spec.ts` (путь действия), часть (2) — `console-payment-panel.spec.ts`
(путь оплаты; там же приём гарантии карты через `customProjectCards`), монета «5» на спутнике —
случай графена в `console-rail-value-badges.spec.ts`. Правила драйвера — `.claude/rules/tests.md`:
`{...NO_PAYMENT}`, только state‑waits (`settle`/`pressUntil*`; ни одного `waitForTimeout` — у нового файла
рэтчет 0), реальные примитивы (`openCardActions`, `playCardFromHand`), `reloadConsole`, `test`/`expect`
из `./consoleTest`, скриншоты в `screenshots/eva-mechs/`. `shardPlan.json` не править (новый файл
раскидывается по хэшу). Доказать стабильность: `--repeat-each=4`.

## 7. Визуальная приёмка (один профиль, ТРИ кадра)
1. `?premiumCardsPlayground` — лицо TR09: арт, чип требования, ряд действия (энергия → мех), ряд
   эффекта (метка Космоса : мех = 5), капсула счётчика.
2. Коммит действия — кадр полёта меха на карту и капсула после посадки.
3. Панель оплаты карты Космоса с дорожкой мехов (рейт 5, авто) + спутник ДОП. РЕСУРСЫ с бейджем.
Плюс проверить вкладки «Flagged» в `?effectsPlayground` / `?actionsPlayground` — TR09 там быть не должно.

## 8. Режим работы
Экономный, 3 коммита, каждый зелёный по юнитам: (1) инфраструктура + скоуп + ресурс + единица;
(2) карта + спеки + локаль + арт/лор; (3) консольная проверка + e2e + документы. Перед каждым:
`npm run lint`, `npm run build:test` (обе ступени), `npm run make:cards` (аудит: 0 `needsCuration` /
0 `seededRunOn` / 0 `missingTranslations`), `npm run make:json`, `npm run make:css` перед визуальной
проверкой. **Не пушить.**

Гочи: `python3` здесь — заглушка Store, только `python`; `cross-env` в bash нет — `NODE_ENV=… npx mochapack`;
юниты гонять последовательно; e2e — против свежесобранного сервера (первая строка лога сервера = твой коммит);
`eqeqeq` без исключения для null.

В отчёте: список из 22 точек скоупа с подтверждением; что напечатали гарды до и после; полный список
файлов единицы `mechs` (компилятор + «молчащие»); подтверждение, что `initialCounts` не трогали и почему;
три кадра; новые ключи i18n; итог e2e по частоте.

## 9. Нельзя
Класть TR09 в чужой модуль или оставлять `turmoilRedux` вне скоупа «до следующей карты». Заводить
центральную таблицу вместо co‑located метаданных. Защищать мехи от авто‑распределения по аналогии с
DP11. Расширять `spend.*`‑гейты, награды или атаки под «мех как титан». Включать мехи через Last Resort
Ingenuity, для стандартных проектов (`STANDARD_PROJECT_PAYMENT_ORDER` закрыт) или отложенных счетов.
Оставлять эффект без печатного ряда `.equals().megacredits(5)` (дыра Modular Floodgates: слой
объяснимости молчит). Писать платёжный объект в e2e литералом.
Детектить промпт по заголовку. Переписывать чужие переводы. Второй ключ для «EVA Mechs». Пуш и красные
коммиты.
