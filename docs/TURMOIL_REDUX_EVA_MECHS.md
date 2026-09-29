# TR09 · EVA Mechs («Мехи ВКД») — первая карта проектов Turmoil Redux: ресурс `Mech` и единица `mechs`

**Статус: СДАНА 2026-09-29.** Первая из 70 карт проектов набора (TR01–TR70). Механически — близнец
«Аэростатов» (Dirigibles) на одну метку правее: действие за 1 энергию кладёт МЕХ на эту карту, эффект
разрешает платить мехами с этой карты за карту с меткой Космоса по 5 M€ за штуку. Вес карты не в
правиле, а в двух сквозных контрактах, которые она заложила и которые наследует любая следующая
карта набора: **новый ресурс карт `CardResource.MECH`** и **новая платёжная единица `mechs`**.

Печатный текст: «Требуется 1 метка Науки. Действие: заплатите 1 энергию, чтобы добавить 1 мех на эту
карту. Эффект: разыгрывая карту с меткой Космоса, вы можете платить мехами с этой карты по 5 M€ за
каждый.» Стоимость 6, метки Наука + Космос, ACTIVE.

Промт: `docs/claude/prompts/project-tr09-eva-mechs.md`. Файл карты:
`src/server/cards/turmoilRedux/EvaMechs.ts`. Чеклист следующих карт:
`docs/claude/turmoil-redux-card-checklist.md`. Журнал набора: `docs/claude/turmoil-redux-cards-progress.md`.

---

## 1. Правила чтения (каждое закреплено спеком `tests/cards/turmoilRedux/EvaMechs.spec.ts`)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Мехи платят ТОЛЬКО за розыгрыш карты с меткой Космоса — не за стандартный проект, не по отложенному счёту (`SelectPaymentDeferred` → `mechs: false`), не через Last Resort Ingenuity (её текст называет сталь и титан) | `Player.paymentOptionsForCard` → `mechs: card.tags.includes(Tag.SPACE)`; зеркало на клиенте `paymentPlan.projectCardPaymentOptions` |
| 2 | Ценность ПЛОСКАЯ 5 M€: модификаторы титана (Phobolog) и закон Metal Research (RX19) её не трогают | `DEFAULT_PAYMENT_VALUES.mechs = MECHS_VALUE`; `Player.payingAmount` не переопределяет; `rateFor` падает в дефолт |
| 3 | Переплата — семантика апстрима (`payingAmount >= cost`, сдачи нет): 2 меха за карту в 6 M€ легальны, оба уходят | `checkPaymentAndPlayCard` без правок; консоль честно пишет «Переплата +4» |
| 4 | `Mech` — полноценный ресурс карт: любая карта может хранить/добавлять мехи; деньгами являются только мехи НА EVA Mechs | `CARD_FOR_SPENDABLE_RESOURCE.mechs = CardName.EVA_MECHS`; `getSpendable('mechs')` читает только эту карту |
| 5 | Мех НЕ «считается на планшете»: никаких unit-стоимостей, наград, атак; атаки на ресурсы карт — общий `RemoveResourcesFromCard` | ничего не расширено (в отличие от `floodgateSteel`) |
| 6 | Причина недоступности действия — авто из `spend.energy` («Not enough energy»); бесподобных `canAct`/`canPlay` нет | `ActionCard` + `actionUnavailableReasons` |

Эффект — **платёжная единица, а не триггер**: у карты нет `onCardPlayed` и нет forecast-близнеца. Слой
объяснимости (блок эффектов, оверлей «Spent as payment», журнал) питается от записи
`cardResourcesSpentAsPayment`, которую пишет `Player.pay()`.

## 2. Контракт ресурса `Mech` (что наследует следующая карта с мехами)

Литерал `CardResource.MECH = 'Mech'` — **несущий**: из него выводятся спрайт `assets/resources/mech.png`
(512², альфа), графический id `res-mech` и CSS-класс `.card-resource-mech`. Точки, которые пришлось
тронуть один раз (следующей карте с мехами — ничего):

| Слой | Точка |
| --- | --- |
| enum | `src/common/CardResource.ts` — секция `// Turmoil Redux` |
| премиум-лицо | резолвит `assets/resources/<name>.png` по имени — без правок |
| легаси-классы | `src/styles/cards_v2.less` `@card_resource_types` (+ `mech`) — ГЛОБАЛЬНЫЙ `.card-resource-mech` для журнала, спутника ДОП. РЕСУРСЫ, option-иконок, `ConsoleYieldUnit`; `src/styles/resources.less` `@resource_types` (+ `mech`) — семейство `resource_icon--mech` |
| клиентские таблицы | `cardResources.ts` (`card-resource-mech`), `CardListModel.ts` (фильтр), `ConsoleExtrasExplorer.vue` (множественное `'Mech' → 'Mechs'`) |
| коммит действия | `consoleActionCommitMotion.ts` `ICON_NEEDLES['mech']` — без него импульс не находит иконку результата и тихо деградирует до плиты |
| локаль | `console.json` `"Mech": "Мех"` (блок имён ресурсов карт), `ui.json` `"Mechs": "Мехи"` (блок множественных) |

Общие пути НЕ трогались: `Card.ts`, `Executor.ts`, `AddResourcesToCard*`, `LogHelper`,
`RemoveResourcesFromCard` — всё generic. `addResourcesToAnyCard: {type: CardResource.MECH}`,
`getResourceCards(CardResource.MECH)`, `player.addResourceTo(card, …)` работают для любого держателя.

## 3. Контракт единицы `mechs` (тропа `floodgateSteel`, без её лишнего)

Компилятор заставляет (`satisfies Record<…>` / mapped types):

| Файл | Что |
| --- | --- |
| `src/common/inputs/Spendable.ts` | `SPENDABLE_CARD_RESOURCES` + `'mechs'`; `CARD_FOR_SPENDABLE_RESOURCE.mechs = CardName.EVA_MECHS` |
| `src/common/inputs/Payment.ts` | `DEFAULT_PAYMENT_VALUES.mechs = MECHS_VALUE` (`constants.ts`, 5); `Payment.EMPTY`; `Payment.of` |
| `src/server/Player.ts` | `paymentOptionsForCard.mechs`; `maxSpendable.mechs`; `payingAmount.usable.mechs`; **`pay()` → `removeResourcesOnCard(CardName.EVA_MECHS, payment.mechs, DEFAULT_PAYMENT_VALUES.mechs)`** — эта строка и есть трекинг (`removeResourceFrom` + `recordResourceAsPayment`) |

Молчащие без компилятора (пропустишь — сломается тихо):

| Файл | Что |
| --- | --- |
| `src/common/models/PlayerInputModel.ts` | `mechs: number` в `SelectProjectCardToPlayModel` и `SelectPaymentModel` |
| `src/server/inputs/SelectCardToPlay.ts`, `SelectPayment.ts` | `toModel` → `mechs: player.getSpendable('mechs')` |
| `src/server/deferredActions/SelectPaymentDeferred.ts` | `buildSelectPayment` → `mechs: false` (сознательно) |
| `src/server/models/effectForecast.ts` | `paymentValuesOf` итерирует `SPENDABLE_CARD_RESOURCES` — группа «Скидки и оплата» подхватила сама (`value: 5`, `count`) |
| `src/client/components/payment/paymentModelUtils.ts` | `GENERIC_PAYMENT_ORDER`: `'graphene', 'mechs', 'floodgateSteel'` (та остаётся последней); `buildStandardProjectPaymentModel.mechs` |
| `src/client/console/paymentPlan.ts` | `projectCardPaymentOptions.mechs = tags.includes(Tag.SPACE)`; `PAY_UNIT_LABELS.mechs = 'Mechs'` (дорожка называет РЕСУРС; имя карты носит только `floodgateSteel`); **`PAY_UNIT_ICONS.mechs = 'mech'`** (иначе `.card-resource-mechs` — пустой квадрат) |
| `src/client/console/railValueModel.ts` | `CONTEXT_FOR_CARD_UNIT.mechs = 'space'` → бейдж «5 M€ · Космос» по словарю титана |
| десктоп-остатки (компилируются) | `PaymentRowV2.vue` `ICON_CLASS.mechs`, `PaymentFormV2.vue` `DEFAULT_DESCRIPTIONS.mechs`, `PaymentWidgetMixin.ts` `getAvailableUnits.mechs` |
| тесты | `ConsolePartyActionComposerBill.spec.ts` (`mechs: 0` в рукописной модели); e2e — `{...NO_PAYMENT}` выведен из `SPENDABLE_RESOURCES`, литералов нет |

**Что НЕ тронуто (лишнее на тропе `floodgateSteel`):** `behavior/steelSpendSource.ts`, `Executor.ts`
(spend-гейты), `awards/Industrialist.ts`, `actionUnavailableReasons.ts` (ветка стали),
`checkPaymentAndPlayCard` («последний ресурс» — у меха нет потребителя-предпосылки),
`buildStandardProjectPaymentOptions` / `STANDARD_PROJECT_PAYMENT_ORDER` (закрытый список стандартных
проектов — лишняя дорожка кончается «Did not spend enough»), карты автомы, `help_iconography.json`.

## 4. Решение по авто-распределению: мех — ОБЫЧНЫЙ жадный альтернативный источник

`initialCounts` **не расширен**. Защита `floodgateSteel` (никогда не сеется) существует потому, что
та сталь — ещё и блокада: у неё есть второе применение, и тратить её по умолчанию — тихая потеря. У
меха второго применения нет: 1 энергия → 5 M€ — ровно то, ради чего его копили, и по критерию
самого кода (`PaymentDefaults.ts` § greedy: жадность для ресурса, который больше ничего не покупает)
он сеется как аэростаты и графен.

Следствие рейта 5 — самый грубый шаг в игре: `laneCap = ceil(cost/5)`, вердикт «Переплата +N» звучит
чаще, чем у любой дорожки, и это честно; игрок понижает через LT «Настроить оплату» (или инлайн-пилюли,
когда мех — единственная альтернатива). Закреплено `paymentPlan.spec` § mechs: cost 6 / 2 меха / 20 M€ →
1 мех + 1 M€ (точно); cost 6 / 2 меха / 0 M€ → 2 меха, переплата +4, cap 2.

**Если следующая карта TR введёт ТРАТУ мехов на эффект** (мех как расходник действия), критерий
меняется — мех получит второе применение, и его надо будет защищать от сева по образцу `floodgateSteel`
(`initialCounts` — исключить из порядка, `GENERIC_PAYMENT_ORDER` — сдвинуть в хвост). Это единственное
место, где решение придётся пересмотреть.

## 5. Консоль — что проверено глазами и e2e (`tests/e2e/console-eva-mechs.spec.ts`, фикстура `eva-mechs`)

- **Лицо** (`?premiumCardsPlayground`): арт TR09, чип требования «1 метка Науки», ряд действия
  (энергия → мех), ряд эффекта (метка Космоса : мех = 5), капсула счётчика.
- **Коммит действия** («ДЕЙСТВИЯ КАРТ» → EVA Mechs → A): композер показывает «−1 энергия» / «+1 мех на
  этой карте»; полёт меха с узла `res-mech` графики действия в капсулу `.pcard__res` самой карты, счётчик
  тикает на посадке; сервер согласен.
- **Панель оплаты** карты Космоса: дорожка «Мехи» по 5 с иконкой меха, авто-распределение закрыло
  недостачу, после подтверждения мехов на карте меньше ровно на потраченное, M€ сходятся, в ленте строка
  оплаты. С титаном на планшете дорожек ≥ 2 → LT-редактор вместо инлайн-пилюль — норма.
- **Спутник ДОП. РЕСУРСЫ**: бейдж «5» с контекстом «Космос», только пока EVA Mechs в tableau.
- Вкладки «Flagged» в `?effectsPlayground` / `?actionsPlayground` — TR09 там нет.
