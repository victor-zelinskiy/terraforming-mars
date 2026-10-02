# Промт исполнителю · TR17 Construction Mechs («Строительные мехи») — четырнадцатая карта проектов Turmoil Redux

Выдан 2026-10-02. Инфраструктура набора стоит (TR01–TR09, TR11, TR13, TR66 сданы; TR15 в работе) — **ничего из неё не
повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`,
правила карт — `.claude/rules/game-logic.md`. **Обязательное чтение до кода:** `docs/TURMOIL_REDUX_EVA_MECHS.md` целиком —
особенно §3 (все точки платёжной единицы, громкие и МОЛЧАЩИЕ) и §4 (решение по авто-распределению); документ TR15
`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` § требование партии (когда сосед его закоммитит).

**Карта — близнец TR09 «Мехи ВКД» с другими метками оплаты:** действие то же (1 энергия → мех на эту карту), а мехами
отсюда платят за карты с меткой **Строительства или Города** (у TR09 — Космоса). Плюс требование партии «Марс вперёд»
— второй потребитель класса, который строит TR15. Сервер мал; главное — **вторая платёжная единица одного ресурса**:
сегодня единица `mechs` жёстко привязана к ОДНОЙ карте.

| Впервые | Что это | Где сейчас |
| --- | --- | --- |
| **Два платёжных пула одного ресурса** | единица `mechs` = мехи НА EVA Mechs и только на ней (`CARD_FOR_SPENDABLE_RESOURCE.mechs = CardName.EVA_MECHS`, `src/common/inputs/Spendable.ts:70`; `Player.pay()` снимает с EVA: `Player.ts:1257`); каждая единица — ровно одна карта, это контракт `satisfies Record<SpendableCardResource, CardName>` | прецедент «по единице на карту»: девять карт-единиц, у каждой свой ключ |
| **Мехи платят за метку Города** | ни одна единица сегодня не смотрит на `Tag.CITY` отдельно; ближайшая — `graphene` (Carbon Nanosystems: «city or space», `railValueModel.ts:120`) | `Player.paymentOptionsForCard` (`:1153–1157`) |
| **Две дорожки мехов на одной карте** | карта с метками Космоса И Строительства (или Города) откроет обе единицы; подпись дорожки сегодня — имя РЕСУРСА («Мехи», `paymentPlan.ts:378`) — две одинаковые подписи | `floodgateSteel` — единственная дорожка, которая называет КАРТУ (`paymentPlan.ts:374`) |

### Решение по архитектуре (рекомендация, подтвердить в отчёте)
**Новая единица `constructionMechs`**, не обобщение `mechs`. Каждый пул — своя единица со своей картой: `pay()` всегда
знает, с какой карты снять, гард `satisfies Record<…>` заставит пройти все громкие точки, а §3 документа TR09 — готовый
ворклист молчащих. Обобщение `mechs` до «мехи на любой карте с эффектом оплаты» ломает однозначность `pay()` (с какой
карты снимать при двух источниках, какой счётчик писать в «потрачено как оплата») и все потребители, которые читают
`CARD_FOR_SPENDABLE_RESOURCE` как функцию. Если исполнитель найдёт, что общий ключ дешевле и чище, — описать в отчёте до
кода и не реализовывать без ответа владельца.

### Решения владельца (подтвердить в отчёте, не блокер)
1. RU-имя **«Строительные мехи»**.
2. **Подпись дорожки называет карту, когда мехов-дорожек две**: «Мехи · Мехи ВКД» / «Мехи · Строительные мехи»; одна
   дорожка — по-прежнему «Мехи». (Вариант — всегда с именем карты; решает владелец по кадру.)

---

## 0. Рабочее дерево
`git status` на момент выдачи: НЕЗАКОММИЧЕНА работа TR15 (2/4 — подача требования партии): `PremiumRequirementsBar.vue`,
`partyEmblems.ts`, `premiumCardViewModel.ts`, `unplayableReasonFormat.ts`, `cardAvailability.ts`,
`ConsoleCardAvailabilityPanel.vue`, `ConsoleHandSection.vue`, `parliament.json`, `console.less`, `premium_card.less`,
фикстуры `political-think-tank*.json`. **Это ровно та подача требования партии, которую карта получит даром** — блок
требования не писать своего; сервер карты, единицу оплаты и спеки можно делать сразу, визуальную приёмку лица и руки —
после коммита TR15. В общих файлах (`Spendable.ts`, `Payment.ts`, `Player.ts`, `paymentPlan.ts`, `railValueModel.ts`,
`PlayerInputModel.ts`, `CardName.ts`, манифест, словари) — только свои строки; `git add` по своим путям; код выхода гейтов
читать ЯВНО (`; echo exit=$?`). Память `concurrent-session-edits-same-files`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR17.png` (и лист `…\Printables\10-18.png`).
**Арт `C:\Users\zelin\Downloads\Mars Arts\TR17.png` на момент выдачи ОТСУТСТВУЕТ** — запросить у владельца; остальное не
ждёт (`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR17.png" TR17` → `npm run make:cards`).

- **Construction Mechs** · `cardNumber: 'TR17'` · стоимость **7** · тип **ACTIVE** (синяя) · метка **Строительство**
  (коричневый круг в правом верхнем углу).
- **Требование** — эмблема «Марс вперёд» в оранжевой плашке → `requirements: {party: PartyName.MARS}`. **ПО нет.**
- **Действие:** `[энергия] → [мех]` — *(Action: Pay 1 energy to add a mech resource to this card.)* — ключ текста TR09.
- **Эффект:** `[метка Строительства], [метка Города] : [мех] = [5 M€]` — *(Effect: When playing a Building or City tag,
  mechs here may be used as payment, and are worth 5 M€ each.)*
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется.
- **Лор** EN: *«In the rear with the gear.»* → `assets/text/lore_texts.json` ключ `"TR17"`; RU: **«Отсиживается в тылу, при
  технике.»** (армейское «in the rear with the gear» — про того, кто воюет железом издалека).

### Правила чтения (каждое — закрепить спеком; зеркало таблицы §1 документа TR09)
1. Мехи этой карты платят ТОЛЬКО за розыгрыш карты, у которой есть метка Строительства ИЛИ метка Города — не за
   стандартный проект (в т. ч. «Город»: у проекта нет метки), не по отложенному счёту (`SelectPaymentDeferred` →
   `false`), не через Last Resort Ingenuity (её текст называет сталь и титан).
2. Ценность ПЛОСКАЯ 5 M€ — модификаторы стали (Advanced Alloys и пр.) и закон Metal Research её не трогают.
3. Переплата — семантика апстрима: сдачи нет.
4. Деньгами являются ТОЛЬКО мехи на этой карте. Мехи EVA — своя единица (только Космос); мехи «Мех-спорта» (TR11) — не
   деньги вовсе. Карта с меткой Космоса и Строительства открывает ОБЕ единицы, каждая снимается со своей карты.
5. Мех — полноценный ресурс карт: Веста и «мех на любую карту» могут положить мехи сюда, и они станут деньгами для
   Строительства / Города.
6. Действие: 0 энергии → авто-причина «Not enough energy»; бесподобного `canAct` нет.
7. Требование партии — через DSL (`{party}`), проверяется при розыгрыше; сервер готов, подача — класс TR15.
8. Сталь и мехи на одной карте Строительства — две независимые дорожки; ни одна не съедает другую.

## 2. Блок A · сервер и общий слой

### A1 · Единица `constructionMechs` — по ворклисту §3 документа TR09
Громкие (компилятор заставит): `SPENDABLE_CARD_RESOURCES` + `'constructionMechs'`, `CARD_FOR_SPENDABLE_RESOURCE.constructionMechs
= CardName.CONSTRUCTION_MECHS`; `DEFAULT_PAYMENT_VALUES.constructionMechs = MECHS_VALUE` (одна константа на два пула),
`Payment.EMPTY`, `Payment.of`; `Player.paymentOptionsForCard.constructionMechs = card.tags.includes(Tag.BUILDING) ||
card.tags.includes(Tag.CITY)`; `maxSpendable`; `payingAmount.usable`; **`pay()` → `removeResourcesOnCard(CardName.CONSTRUCTION_MECHS,
payment.constructionMechs, DEFAULT_PAYMENT_VALUES.constructionMechs)`**.
Молчащие (пройти ВСЕ по таблице TR09, каждую — строкой в отчёте): `PlayerInputModel.ts` ×2, `SelectCardToPlay.toModel`,
`SelectPayment.toModel`, `SelectPaymentDeferred` (`false`), `effectForecast.paymentValuesOf` (итерирует сам — проверить),
`paymentModelUtils.ts` `GENERIC_PAYMENT_ORDER` (рядом с `'mechs'`; `floodgateSteel` остаётся последней) и
`buildStandardProjectPaymentModel`, `paymentPlan.ts` `projectCardPaymentOptions` + `PAY_UNIT_LABELS` (решение №2) +
**`PAY_UNIT_ICONS.constructionMechs = 'mech'`** (иначе пустой квадрат), `railValueModel.ts` `CONTEXT_FOR_CARD_UNIT` —
**новый контекст `'building-or-city'`** («5 M€ · Строительство или Город»; словарь контекстов — найти, где он говорит
словами, и добавить ключ), десктоп-остатки (`PaymentRowV2`, `PaymentFormV2`, `PaymentWidgetMixin`), рукописная модель в
`ConsolePartyActionComposerBill.spec.ts`.
**Сеть от тихой поломки**: юнит-гард «каждая `SpendableCardResource` имеет иконку, подпись и контекст» — если такого
гарда нет, завести (таблица из `SPENDABLE_CARD_RESOURCES`, падает с именем единицы). Третья карта-пул мехов (если будет)
тогда не пропустит ни одной точки.
**Авто-распределение** — §4 TR09 без изменений: мех — обычный жадный источник (второго применения у мехов этой карты нет;
TR66 тратит мехи со СВОЕЙ карты). Порядок с жадной сталью на карте Строительства закрепить спеком `paymentPlan`
(что сеется первым — сталь или мехи — записать как решение, не случайность).

### A2 · Карта — `src/server/cards/turmoilRedux/ConstructionMechs.ts`
```ts
export class ConstructionMechs extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.CONSTRUCTION_MECHS, type: CardType.ACTIVE,
      tags: [Tag.BUILDING], cost: 7,
      resourceType: CardResource.MECH,
      requirements: {party: PartyName.MARS},
      action: {spend: {energy: 1}, addResources: 1},
      metadata: {
        cardNumber: 'TR17',
        infoText: [{kind: 'effect-short', text: 'Building or City tag: mechs here pay 5 M€ each'}],
        renderData: CardRenderer.builder((b) => {
          b.action('Pay 1 energy to add a mech resource to this card.', (eb) => {
            eb.energy(1).startAction.resource(CardResource.MECH);
          }).br;
          // `.equals().megacredits(5)` is LOAD-BEARING (effectExtraction: valueAsPayment) — see EvaMechs.ts.
          b.effect('When playing a Building or City tag, mechs here may be used as payment, and are worth 5 M€ each.', (eb) => {
            eb.tag(Tag.BUILDING).slash().tag(Tag.CITY).startEffect.resource(CardResource.MECH).equals().megacredits(5);
          });
        }),
      },
    });
  }
}
```
Разделитель меток на скане — запятая: если в DSL есть узел запятой — он, иначе `slash()`; показать на кадре. Классификатор
`effectExtraction` обязан прочитать ряд как «оплата» с ДВУМЯ метками (TR09 — с одной): проверить, при надобности расширить
классом. `CardName.CONSTRUCTION_MECHS = 'Construction Mechs'` в секции `// Turmoil Redux`; строка манифеста без
`compatibility`. Шапка файла — чтение скана, правила 1–8, ссылка на TR09. Хуков нет: превью, причины, прогноз — авто.

## 3. Блок B · клиент
Кода сверх A1 не ожидается. Проверить ГЛАЗАМИ: лицо (действие, эффект с двумя метками, плашка «Марс вперёд» — после TR15);
коммит действия (импульс до иконки меха — `ICON_NEEDLES['mech']` уже есть, полёт в капсулу); панель оплаты карты
Строительства (дорожки «Сталь» и «Мехи», авто-распределение, «Переплата +N» честно); карта Космоса+Строительства при
обеих картах-пулах (две дорожки с разными подписями, каждая списывает со своей карты); рельс ДОП. РЕСУРСЫ — бейдж
«5 · Строительство или Город» только пока карта в табло; мехи TR11 бейджа не получают. Найденный дефект общего слоя —
чинить классом, назвать в отчёте.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Ожидается ~5 новых: `"Construction Mechs": "Строительные
мехи"` (**имя — решение владельца**); эффект `Effect: When playing a Building or City tag, mechs here may be used as payment,
and are worth 5 M€ each.` → «Разыгрывая карту с меткой Строительства или Города, вы можете платить мехами с этой карты по
5 M€ за каждый.» (голос — строка TR09); `effect-short` (бюджет 52 по RU — РУКАМИ); подпись контекста рельса; подписи дорожек
решения №2; лор RU — §1. Текст действия — ключ TR09, второй не заводить.

## 5. Тесты
**`tests/cards/turmoilRedux/ConstructionMechs.spec.ts`** (структура — `EvaMechs.spec.ts`): метаданные (ACTIVE, 7,
`[BUILDING]`, MECH, `{party: MARS}`, TR17); требование: неиграбельна без правящей «Марс вперёд» и двух делегатов, играбельна
с любым из двух; действие (энергия 0 / 1); оплата: карта Строительства и карта Города — мехи доступны; карта Космоса — нет;
стандартный проект «Город» и отложенный счёт — нет; ценность 5 при Advanced Alloys и Metal Research; переплата; `pay()`
снимает с ЭТОЙ карты и пишет «потрачено как оплата» с её именем; **обе карты-пула в табло** + карта с метками Космоса и
Строительства — две единицы, каждая снимает со своей карты, сумма сходится; мехи TR11 не деньги; Веста кладёт мехи сюда —
они становятся доступны к оплате; save / load.
**Общий слой**: `paymentPlan.spec` § constructionMechs (сталь + мехи на карте Строительства, порядок сева; две дорожки
мехов, подписи), гард «у каждой единицы есть иконка / подпись / контекст», `railValueModel` (контекст), `Payment` / `Spendable`
паритет-спеки, если есть.
**Гарды чеклиста §3** — ворклист TR17 пуст; особо `effectExtraction`, `effectSummaryCoverage`, `effectFamilyCoverage`,
`cardReasonConsistency`, `actionReasonCoverage`; `make:cards` 0 / 0 / 0.
**e2e — НЕ писать** (путь единицы оплаты мехами доказан `console-eva-mechs.spec.ts`; новая единица проходит тот же путь).
Если при визуальной приёмке две дорожки мехов на одной карте ведут себя иначе, чем в юнитах, — доказать e2e на копии
фикстуры `eva-mechs` и назвать в отчёте.
Новая карта меняет сид-сдачи Redux-столов: поехавший чужой спек сперва проверить без карты в манифесте и чинить классом.

## 6. Визуальная приёмка (fhd; свой сервер, «Тестовый режим» — `docs/DEV_GUARANTEED_CARDS.md`)
1. Витрина: лицо — 7, метка Строительства, плашка «Марс вперёд», ряд действия, ряд эффекта «[стр.], [город] : [мех] = 5»;
   рядом TR09 и TR11 — три лица одного семейства.
2. Композер действия и кадр после коммита — капсула «1».
3. Панель оплаты карты Строительства со сталью и мехами; карта Города без стали (мехи — единственная альтернатива →
   инлайн-пилюли).
4. Табло с TR09 и TR17 + карта Космоса и Строительства: две дорожки мехов, разные подписи; после оплаты — счётчики обеих
   карт уменьшились на своё.
5. Рельс ДОП. РЕСУРСЫ: два бейджа мехов («Космос» и «Строительство или Город»).

## 7. Режим работы
**2–3 коммита**, каждый зелёный по юнитам: (1) единица `constructionMechs` + гард полноты единиц + спеки общего слоя;
(2) карта + спек + локаль + лор (+ арт, если есть); (3) журнал и документ. Перед каждым: `npm run lint`, `npm run build:test`,
`npm run make:cards`, `npm run make:json`; перед визуальной проверкой `npm run make:css` + `npm run build:server`. **Не пушить.**
**Документ карты не заводить** — дописать в `docs/TURMOIL_REDUX_EVA_MECHS.md` раздел «Второй пул: Construction Mechs»
(почему отдельная единица, подписи двух дорожек, гард полноты); чеклист набора §4 — строка «карта-пул ресурса для оплаты →
новая единица по §3 TR09 + гард полноты»; журнал набора. Гочи: `python3` — заглушка Store; юниты последовательно; `eqeqeq`
без исключения для null.

В отчёте: таблица точек единицы (громкие / молчащие — каждая отмечена); порядок сева стали и мехов; кадры §6; что напечатали
гарды; новые ключи i18n; **явно — всё, что не получилось сделать по этому промту, и почему.**

## 8. Нельзя
Обобщать `mechs` до нескольких карт без ответа владельца. Снимать мехи не с той карты. Мехи этой карты за метку Космоса,
стандартный проект или отложенный счёт. Мехи TR11 как деньги. Модификаторы стали на ценность меха. Две одинаковые подписи
дорожек на одной панели. Свой блок требования партии (это TR15). Бесподобный `canAct` / `play`. Второй ключ для текста
действия TR09. Новый e2e без найденного расхождения. `compatibility: 'turmoil'`. Трогать незакоммиченные файлы TR15,
`shardPlan.json`. Пуш и красные коммиты.
