# Промт исполнителю · TR66 Automated Convoys («Беспилотные конвои») — третья карта проектов Turmoil Redux

Выдан 2026-09-29. Инфраструктура набора стоит (TR09, TR08 сданы; `turmoilRedux` в скоупе всех гардов) —
**ничего из неё не повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md` (все пункты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила — `.claude/rules/game-logic.md`, торговля —
`docs/COLONY_TRADE_FLOW.md` § THE SECOND DOOR и `.claude/rules/console-ui.md` § «A TRADE HAS TWO DOORS AND ONE BODY».

**Суть карты — ОДНО действие с ДВУМЯ вариантами, и второй вариант — это ВХОД В ТОРГОВЛЮ, а не своя торговля.**
Два готовых образца, каждый закрывает половину:
- **Titan Floating Launch-Pad** (`src/server/cards/colonies/TitanFloatingLaunchPad.ts` + класс‑трейдер
  `TradeWithTitanFloatingLaunchPad`, спек `tests/cards/colonies/TitanFloatingLaunchPad.spec.ts`,
  `tests/cards/colonies/colonyTraderReasons.spec.ts`) — «потрать ресурс с карты → торгуй бесплатно»: трейдер
  `IColonyTrader`, регистрируемый в `Colonies.tradeHandlers()` (`src/server/player/Colonies.ts:140–153`),
  ветка превью с `actionPreviews.colonyTradeStep(this)`, `ColoniesHandler.tradeColonyPick(..., 'trade')`.
- **Modular Floodgates** (`src/server/cards/delta/ModularFloodgates.ts`) — два варианта в `orBranches`, один
  блокер на ветку, коллапс в единственную живую опцию, порядок веток = порядок `action()` = порядок печатных рядов.

Новых механик НЕТ: мех уже ресурс (TR09), дверь торговли с карты уже доказана (e2e
`console-card-trade-entry` / `console-card-trade-resume`), двухвариантное действие — DP11. Клиентского кода —
ноль (консоль находит путь оплаты по `optionMetadata.card`, а не по имени карты).

---

## 0. Рабочее дерево
Перед стартом `git status`: чужие незакоммиченные файлы не трогать и не включать в свои коммиты (`git add` по
своим путям). Общие файлы — `TurmoilReduxCardManifest.ts`, `CardName.ts`, `Colonies.ts` (одна строка регистрации
трейдера), `src/locales/**`, `lore_texts.json`, журнал — только своя строка.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR66.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR66.png` (1536×1024) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR66.png" TR66` → `npm run make:cards`.

- **Automated Convoys** · `cardNumber: 'TR66'` · стоимость **9** · тип **ACTIVE** · метка **Космос** (кружок в
  углу) · **требования нет** (плашка у цены пуста) · символ ▲ внизу слева = нужны Колонии → в манифесте
  `{Factory: AutomatedConvoys, compatibility: 'colonies'}` (прецедент Delta Works; Redux и так тянет колонии,
  но печатный символ объявляется честно).
- **Действие:** *Pay 2 energy to add 2 mech resources to this card, OR spend 1 mech from here to trade for free.*
  `resourceType: CardResource.MECH`. **Лор** EN: на скане опечатка «someting» — в файл писать
  `"TR66": "Amazon was onto something."` (Amazon — бренд, латиницей и в RU).

### Правила чтения (каждое — закрепить спеком)
1. **Вариант A** — 2 энергии → 2 меха НА ЭТУ карту. Энергия списывается через `player.stock.deduct(Resource.ENERGY,
   2, {log: true, from: {card: this.name}})` (идиома DP08 Dutch Mountains — рекордер видит), мехи —
   `player.addResourceTo(this, {qty: 2, log: true})`. Никаких прямых мутаций полей.
2. **Вариант B** — 1 мех С ЭТОЙ карты → бесплатная торговля. «Бесплатная» = плата 0, но **флот тратится**
   (`Colony.trade` → `usedTradeFleets++`), торговля идёт через ОДНУ дверь `Colony.trade(player)` (квест
   председателя «торгуй N раз», журнал, события — как у любой торговли). Мех снимается
   `player.removeResourceFrom(this, 1, {log: false})` — **не `resourceCount--`** (у TFLP это дыра рекордера, не копировать).
3. Вариант B доступен ⇔ на карте ≥ 1 мех И `player.colonies.tradeBlockedReason() === undefined` — ОДИН блокер
   в этом порядке (сначала мех — единственное условие самой карты, потом эмбарго / флот / колония из движка).
   Трейдер дополнительно гасится, если действие карты уже использовано в этом поколении
   (`actionsThisGeneration`), с готовым ключом «This card's action was already used this generation».
4. `canAct` = `energy ≥ 2 || (мех ≥ 1 && canTrade())` — ровно «хотя бы одна ветка доступна» (гард
   `actionBranchAvailability`). Обе мертвы → `actionUnavailableReason` называет ОДИН блокер: нет мехов и мало
   энергии → `notEnoughEnergy()`; мех есть, но торговля закрыта и энергии мало → причина торговли
   (`ruleReason(tradeBlockedReason)`) — у игрока есть средство, ему важно, что именно закрыло путь.
5. Один живой вариант → `action()` возвращает его напрямую (`options[0].cb(undefined)` / коллапс как в DP11 и
   TFLP), оба → `OrOptions` с `.markChoiceContext(effectChoice(this))`.
6. **Мехи на этой карте — НЕ деньги.** Платёжная единица `mechs` читает только EVA Mechs
   (`CARD_FOR_SPENDABLE_RESOURCE.mechs`); `player.getSpendable('mechs')` при 3 мехах здесь и 0 на EVA = 0.
   Следствие для решения TR09 (§4 `docs/TURMOIL_REDUX_EVA_MECHS.md`): TR66 тратит СВОИ мехи, пул оплаты не
   получает второго применения → жадный сев мехов EVA остаётся. Дописать в §4 одну фразу: триггер пересмотра —
   карта, тратящая мехи С EVA Mechs / с любой карты, а не свои.
7. Порядок веток везде один: **A (энергия → мехи), затем B (мех → торговля)** — в `actionPreview`, в `action()`
   и в печатных рядах (консоль сопоставляет ветки рядам по заголовку ↔ описанию, `assignBranchNodes`).

## 2. Блок A · сервер

- Класс `AutomatedConvoys extends Card implements IProjectCard` (бесподобный: `or` есть в Behavior, а «торговля»
  — нет), `tags: [Tag.SPACE]`, `cost: 9`, `resourceType: MECH`, без `behavior`/`action` в конструкторе.
- **Рендер — два ОПИСАННЫХ ряда** (контракт TFLP/DP11: без описания ряд склеивается с соседом и один капшен
  говорит за оба варианта):
  ```ts
  b.action('Pay 2 energy to add 2 mech resources to this card.', (eb) => {
    eb.energy(2).startAction.resource(CardResource.MECH, {amount: 2});
  }).br;
  b.or().br;
  b.action('Spend 1 mech from here to trade for free.', (eb) => {
    eb.resource(CardResource.MECH).startAction.trade();
  });
  ```
  Оба описания ≤ 52 символов → `action-short` не нужны; если аудит скажет иначе — по одному на ряд с `tokens`.
- **`actionPreview`** — `actionPreviews.orBranches(this, [A, B])`: A `available: energy ≥ 2`, effects = cost‑чип
  энергии (существующий билдер стоимости из `actionPreviews`, как у DP08) + `cardGain(this, 2)`, причина
  `notEnoughEnergy()`; B `available` по правилу 3, effects `[cardCost(this, 1)]`,
  `steps: [colonyTradeStep(this)]`, причина `ruleReason(мех === 0 ? 'No mechs on this card' : tradeBlocked)`.
- **`action()`** — по TFLP 105–142: опция B деферит `ColoniesHandler.tradeColonyPick(player, 'Select colony tile
  to trade with for free', 'trade')` (ключи и метка `'trade'` существующие — консольная оркестровка торговли
  ключуется на этой метке), в `.andThen` открывает scope `events.beginAction(player, {kind: 'colony', name},
  {category: 'colony'})` … `finally endScope()` и зовёт `trader.trade(colony)`; опция A — правило 1.
- **`TradeWithAutomatedConvoys implements IColonyTrader`** (экспорт из файла карты, как у TFLP):
  `canUse` = мех ≥ 1 && действие не использовано; `optionText` = `'Pay 1 mech (use ${0} action)'` с именем карты;
  **`optionMetadata` = `{kind: 'resourceRemoval', icon: 'mech', amount: 1, card: CardName.AUTOMATED_CONVOYS,
  resource: {current, resulting}}`** — `card` и есть структурная идентичность пути, по которой консоль
  запирает оплату во «второй двери» (`lockedTradePaymentIndex`); `disabledReason` = `undefined` (карты нет) →
  `'No mechs on this card'` → «already used»; `trade(colony)` = правило 2 + `actionsThisGeneration.add` +
  лог `'${0} spent 1 mech to trade with ${1}'` + `colony.trade(this.player)`.
- **Регистрация:** `src/server/player/Colonies.ts` `tradeHandlers()` — строка после `TradeWithTitanFloatingLaunchPad`
  (импорт рядом со строкой 10). Без неё торговля из меню колоний не предложит путь, а «вторая дверь» не найдёт,
  что запирать.
- `CardName.AUTOMATED_CONVOYS = 'Automated Convoys'` (секция `// Turmoil Redux`), манифест с `compatibility`.
- Хуки: `canAct`, `actionUnavailableReason`, `actionPreview` — в файле карты; forecast‑близнеца нет (триггеров нет).

## 3. Блок B · клиент — НИЧЕГО не писать, всё проверить
- Композер «ДЕЙСТВИЯ КАРТ › БЕСПИЛОТНЫЕ КОНВОИ › НАСТРОЙКА»: две плитки вариантов; A — чипы «энергия 2 → 0»,
  «мехи 0 → 2 на этой карте», коммит категории `resources`, полёт двух мехов в капсулу карты (`ICON_NEEDLES['mech']`
  уже есть); B — CTA «Выбрать колонию» (`colonyTrade` — дверь runtime‑навигации, ничего не шлётся серверу),
  workspace колоний встаёт ШАГОМ внутри рамки карты, в фокус‑стейдже путь оплаты заперт на строке
  «Беспилотные конвои · [мех] 1 → 0», подтверждение → торговля с обычной кинематикой (маркер трека, чипы дохода),
  возврат через `colonyTradeEntryLocked`. Свернуть/вернуться (B) — как у TFLP (`console-card-trade-resume`).
- Меню «Колонии → торговля» (первая дверь): строка «Заплатить 1 мех (действие Беспилотные конвои)» с иконкой меха;
  при 0 мехах — строка ВЫКЛЮЧЕНА с причиной, не спрятана; после использования — «уже использовано».
- Спутник ДОП. РЕСУРСЫ: группа мехов = EVA + конвои (одна группа по типу), монета «5» только по запасу EVA, aria
  «Spendable from this stock: X of Y» (прецедент Stormcraft) — проверить с 2 мехами на EVA и 3 здесь.
- Список «Активированы» после каждого варианта; «Flagged» диагностики действий пусты.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие и переиспользуемые: `'trade'`,
`'Select colony tile to trade with for free'`, «This card's action was already used this generation», «Not
enough resources on this card», причины `tradeBlockedReason`. Новые (ожидается ~8):
- `turmoil_redux_cards.json`: `"Automated Convoys": "Беспилотные конвои"` (**имя — решение владельца**);
  `"Action: Pay 2 energy to add 2 mech resources to this card.": "Действие: заплатите 2 энергии, чтобы положить
  2 меха на эту карту."`; `"Action: Spend 1 mech from here to trade for free.": "Действие: потратьте 1 мех с
  этой карты, чтобы бесплатно поторговать."` (голос — строка TFLP в `colonies_cards.json`).
- `play_prompts.json`: заголовки опций `SelectOption` — `"Pay 2 energy to add 2 mechs to this card"` /
  `"Spend 1 mech from this card to trade for free"` (образец «Remove 1 floater on this card to trade for free» →
  «Сбросьте 1 аэростат с этой карты, чтобы бесплатно поторговать»); `"No mechs on this card": "На этой карте
  нет мехов"`; текст трейдера `"Pay 1 mech (use ${0} action)"` — рядом с тем файлом, где живёт
  «Pay 1 floater (use ${0} action)» (грепнуть).
- `log_messages.json`: `"${0} spent 1 mech to trade with ${1}": "${0} потратил 1 мех и поторговал с колонией на ${1}"`.
- `lore_texts.json` RU: `"Amazon was onto something.": "Amazon был на верном пути."` (сверить голос с соседями).
- `card_info.json` — только то, что напечатает аудит.

## 5. Тесты
**`tests/cards/turmoilRedux/AutomatedConvoys.spec.ts`** (структура — TFLP‑спек + `colonyTraderReasons` +
DP11 «варианты»): метаданные (Космос, 9, MECH, TR66, без требования); **A**: 1 энергия → ветка недоступна с
`notEnoughEnergy`, 2 энергии → энергия 0, мехи +2, событие `cardResources` записано, промпта не осталось;
**B**: 0 мехов → причина «No mechs on this card»; мех есть, флот занят → «No trade fleet available»; эмбарго →
своя причина; колоний нет → «No colony available…»; всё открыто → `action()` = `OrOptions` с двумя опциями и
`choiceContext`, опция B оставляет `SelectColony` (ключевое требование гарда `actionPromptCoverage`:
`colonyTrade` ↔ живой `SelectColony`), ответ → мех −1, `usedTradeFleets` +1, `actionsThisGeneration` содержит
карту, колония поторгована (доход получен), лог‑строка; **коллапс**: только A доступна → `action()` кладёт
мехи без промпта; только B → сразу `SelectColony`; `canAct` ⇔ хоть одна ветка (проверить все 4 комбинации);
`actionUnavailableReason` по правилу 4; **первая дверь**: в меню «Trade with a colony tile» путь трейдера
предложен с `optionMetadata` (deep‑equal), при 0 мехах выключен с причиной, после использования — «already used»;
**превью**: `orBranches`, порядок A/B, шаг B `deep.eq({kind: 'colonyTrade', card})`; **деньги**:
`getSpendable('mechs')` игнорирует мехи конвоев (3 здесь + 0 на EVA → 0; + EVA 2 → 2); save/load `resourceCount`.
**`railValueModel.spec.ts`**: строка «EVA 2 + конвои 3 → бейдж `spendableAmount` 2, итог группы 5».
**Гарды чеклиста § 3** — ворклист TR66 пуст (особо: `actionBranchAvailability`, `actionPromptCoverage`,
`actionPreviewReasonCoverage`, `cardReasonConsistency`, `actionCaption` — два ряда с описаниями); `make:cards` 0/0/0.
**e2e — не писать** (политика § 5: дверь торговли с карты доказана `console-card-trade-entry/-resume`, вариант
энергия→ресурс — `console-eva-mechs`). Вместо этого прогнать существующие `console-card-trade-entry.spec.ts` и
`console-card-trade-resume.spec.ts` один раз — они не должны покраснеть от появления второго трейдера.

## 6. Визуальная приёмка (один профиль, ТРИ кадра)
1. `?premiumCardsPlayground` — лицо: два ряда действия через «ИЛИ», Космос в углу, без чипа требования.
2. Композер с двумя плитками; коммит A — полёт двух мехов в капсулу «2».
3. Вторая дверь: фокус‑стейдж колонии с запертым путём «[мех] 1 → 0» и итог торговли (сервер: мех 1, флот
   использован, доход зачислен).
Карту гарантировать в руку через «Тестовый режим», стол с колониями и энергией (Thorgate / энергопроизводство).

## 7. Режим работы
Экономный, **2 коммита**: (1) карта + трейдер + регистрация + спеки + локаль + арт + лор; (2) журнал + фраза в
§4 документа мехов. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`,
`npm run make:css` перед визуальной проверкой. **Не пушить.** Документ карты не заводить (контракт — TFLP).
В журнал: что нового (первое двухвариантное действие набора; первый расходник меха; второй держатель мехов),
решение по севу мехов EVA, гэпы. Гочи: `python3` — заглушка Store; `cross-env` нет; юниты последовательно;
`eqeqeq` без исключения для null; новая карта меняет сид‑сдачи Redux‑столов — если поехал чужой спек, сначала
проверить, что он зелёный без карты в манифесте, и записать.

В отчёте: подтверждение нулевого клиентского диффа; строка регистрации трейдера; список причин по веткам;
три кадра; новые ключи i18n; результат прогона двух e2e второй двери.

## 8. Нельзя
Своя торговля внутри `action()` вместо трейдера (`colony.trade` напрямую, `resourceCount--`, второй код
списания). `usesTradeFleet: false`. Ветки в порядке, отличном от печатных рядов. Причина «нет мехов или флота»
одной строкой. Прятать выключенный путь оплаты. Делать мехи конвоев платёжной единицей. Трогать `initialCounts` /
`GENERIC_PAYMENT_ORDER`. Новый e2e. Документ карты. Пуш и красные коммиты.
