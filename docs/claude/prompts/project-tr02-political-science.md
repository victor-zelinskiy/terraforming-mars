# Промт исполнителю · TR02 Political Science («Политология») — четвёртая карта проектов Turmoil Redux

Выдан 2026-09-30. Инфраструктура набора стоит (TR09, TR08, TR66 сданы; `turmoilRedux` в скоупе всех гардов) —
**ничего из неё не повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md` (все пункты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила карт — `.claude/rules/game-logic.md`, заседание —
`docs/claude/parliament-glossary.md` (гард `parliamentGlossary.spec.ts`) и память о такте «Обновление»
(`docs/claude/prompts/parliament-renewal-beat.md`, журнал `parliament-sitting-progress.md` § «Обновление»).

**Это первая карта набора, которая ТРЕБУЕТ трёх новых механизмов, и у каждого есть ближайший образец:**

| Впервые | Что это | Ближайший образец |
| --- | --- | --- |
| **Пер-карточный хук, который стреляет ЗАСЕДАНИЕ** — «ваши делегаты сброшены с НЕПРИНЯТОЙ резолюции» | сегодня у `ICard` ровно один парламентский член — `getInfluenceBonus?` (`ICard.ts:221`, читается `Parliament.influence` `Parliament.ts:496–498` циклом по `player.tableau`); хуков `onResolution*` / `onDelegate*` нет нигде | `Parliament.influence` (цикл по табло) + `ParliamentHandler.enactedPassive` (`ParliamentHandler.ts:174–186` — эффект под `events.withEffectSource`) + событие журнала обновления `SerializedRenewalEvent` (`SerializedParliament.ts:314–321`) |
| **Новый ВИД ТРЕБОВАНИЯ** — «≥ 3 ваших делегатов на резолюциях в области голосования» | `RequirementType` знает только `CHAIRMAN` / `PARTY_LEADERS` / `PARTY`; число уже считает `Parliament.votesOf(player)` (`Parliament.ts:286–298`, без `slot` = все три места) и уже показывает инфо-панель («On resolutions» → «На резолюциях», `ConsoleInfoParliament.vue:63`) | `DELTA_POSITION` — тропа из 8 точек (§2 A2), класс `DeltaPositionRequirement.ts` |
| **Первая карта скоупа, КОПЯЩАЯ data** | до неё в Redux-скоупе data только ПЛАТЯТ (действие Учёных `SCIENTISTS_RESOURCE_KINDS`, Medical Database RX18) — держателей не было; именно из-за этого Diverted Research лежит в `Resolutions\skip\` (`TURMOIL_REDUX_SPEC.md:432`) | `CardResource.DATA` — полноценный ресурс (спрайт, классы, RU «Данные» в `ui.json:750`); действие «потрать N ресурсов отсюда → карта» — `spend.resourcesHere` + `drawCard` (`Behavior.ts:27`, авто-причина `'Not enough resources on this card'` `actionUnavailableReasons.ts:109–111`) |

Действие карты — декларативное и даром. Требование и эффект — руки. Клиентского кода — такт обновления
заседания (чип + строка ленты) и две таблицы требования.

---

## 0. Рабочее дерево
Перед стартом `git status`: чужие незакоммиченные файлы не трогать и не включать в свои коммиты (`git add` по
своим путям). Общие файлы (`TurmoilReduxCardManifest.ts`, `CardName.ts`, `ICard.ts`, `RequirementType.ts`,
`PoliticalOps.ts`, `SerializedParliament.ts`, `ParliamentPhase.ts`, `src/locales/**`, `lore_texts.json`, журнал) —
только своя строка/ветка. `genfiles/**` не править руками, пересобирать.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR02.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR02.png` (1536×1024, стандарт) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR02.png" TR02` → `npm run make:cards`.

- **Political Science** · `cardNumber: 'TR02'` · стоимость **8** · тип **ACTIVE** · метки **Наука, Земля**
  (два кружка в правом верхнем углу: атом + Земля — по конвенции чеклиста §0 это МЕТКИ).
- **Требование** — оранжевая плашка «MIN» у цены: **«3 [делегат]»**; текст: *Requires that you have at least 3
  delegates on resolutions in the Voting Area.* → новый дескриптор `requirements: {delegatesOnResolutions: 3}`.
- **Эффект** (ряд 1: перечёркнутый делегат со звёздочкой `:` data): *Whenever your delegates get discarded from
  UNENACTED resolutions, add 1 data resource here per delegate discarded.*
- **Действие** (ряд 2: `3 [data] → [карта]`): *Spend 3 data from here to draw a card.*
- **ПО нет** (бейджа внизу справа нет). `resourceType: CardResource.DATA`.
- **Символ внизу слева — фиолетовый шестиугольник со стрелкой вниз = значок Turmoil** («нужен политический
  движок»). Для карты Redux-манифеста это тавтология: модуль и есть парламент. **НЕ писать
  `compatibility: 'turmoil'`** — в этом форке этот маркер означает «апстрим-карта, адаптированная к движку»
  и требует `politics: 'redux'` (`CardFactorySpec.ts:20–27, 41–47`). Ворота колоды — модуль (`GameCards.ts:75`);
  символ объявить комментарием в манифесте (как ▲ у TR66).
- **Лор** EN: *«The ever-futile pursuit of bringing logic to a space of emotions.»* → `assets/text/lore_texts.json`
  ключ `"TR02"` (перед `"TR08"`, строка ~501). RU — §4.

### Правила чтения (каждое — закрепить спеком)
1. **Триггер — ТОЛЬКО шаг `refresh` заседания** (`ParliamentPhase.stepRefresh`, `ParliamentPhase.ts:881–935`):
   две проигравшие резолюции уходят, их делегаты идут домой (`journal.push({kind: 'leave', …, returned:
   ownersOf(slot.votes)})`). Это и есть «discarded from UNENACTED resolutions». За каждую ушедшую карту — ОДИН
   вызов хука на игрока с `count` = его делегатов на ней (по `returned`). Нейтральные (`'NEUTRAL'`) не считаются.
2. **ПРИНЯТАЯ резолюция НЕ считается.** Её делегаты тоже уходят домой (`stepEnact`, `ParliamentPhase.ts:433–434`,
   `summary.returned`) — но она принята; хук там не зовётся.
3. **Финальное поколение — сбора нет.** `drive()` (`ParliamentPhase.ts:270`) при `p.final` идёт `effects → adjourn`,
   `stepRefresh` не выполняется, делегаты остаются на картах. Принятое чтение: карте нечего дать после
   финала (ПО у неё нет, добор бесполезен) — закрепить спеком «финальное заседание: 0 data, события нет», в
   документе карты объяснить.
4. **Снятие делегата в кресло Председателя — НЕ сброс.** `Parliament.removeLatestVote` (`Parliament.ts:636–643`,
   зовётся из `ChairmanSeat.ts:176/322`) — делегат ПЕРЕМЕЩАЕТСЯ, резолюция ещё на голосовании. Спек: 0 data.
5. **Требование = `Parliament.votesOf(player)`** — делегаты на ТРЁХ местах области голосования; лобби, кресло
   Председателя и запас НЕ считаются (то же число, что «На резолюциях» инфо-панели, `ParliamentModel.ts:225`).
   `max` не нужен. Вне Redux (классика / без движка) → 0, требование невыполнимо, без падения.
6. **Data на этой карте — обычные data.** Действие Учёных («2 data или 2 бактерии на карту, что их принимает»)
   и Medical Database ВИДЯТ эту карту как держателя (`player.getResourceCards(DATA)`) — спек: Учёные кладут сюда.
   Ничто, кроме собственного действия, их не тратит; data — НЕ платёжная единица (`Spendable` не трогать).
7. **Действие — декларативное:** `action: {spend: {resourcesHere: 3}, drawCard: 1}`; при < 3 data авто-причина
   `'Not enough resources on this card'` (тип `count`, `current`). Никакого `canAct`.
8. **Сбор идёт через рекордер:** `player.addResourceTo(this, {qty: count, log: true})` внутри
   `player.game.events.withEffect(player, this, <trigger>, …)` — журнал/нотификации/статистика видят ИСТОЧНИК
   (карту), лог `'${0} added ${1} ${2} to ${3}'` уже переведён. Прямых `resourceCount +=` нет.
9. **Повестка следующего поколения НЕ двигается сбором.** `stepEnact` ставит `setQuestFromEnacted(p.generation + 1)`
   ДО `refresh`, а `addResourceTo` → `ParliamentHandler.onCardResourceAdded` → `QuestTracker.report(cardResource)`
   (`Player.ts:847`, `ParliamentHandler.ts:294–299`). Проверить, к какому поколению трекер отнесёт запись; сбор
   принадлежит ЗАКРЫВАЮЩЕМУСЯ поколению — если трекер зачтёт его в новую Повестку, гейтить (спек с заданием
   «N data/бактерий» по образцу RX18 — обязателен в любом случае, он и докажет чтение).
10. **Reload посреди заседания не удваивает сбор** — `stepRefresh` идемпотентен по ключу `refresh:<gen>`
    (`applied(key)`), хук зовётся внутри. Спек: два `drive()` подряд → data ровно N.

## 2. Блок A · сервер

### A1 · Хук + событие журнала (контракт, который наследуют следующие карты набора)
- **`ICard.onDelegatesDiscarded?(player: IPlayer, count: number, context: {instance: ResolutionInstanceId;
  resolution: ResolutionId}): void`** — рядом с `getInfluenceBonus?` (`ICard.ts:221`), с комментарием «Turmoil
  Redux: заседание, шаг refresh, за каждую НЕПРИНЯТУЮ резолюцию, с которой ушли делегаты игрока».
- **`stepRefresh`**: внутри `parliament.slots.forEach` после `journal.push({kind: 'leave', …})` — для каждой записи
  `returned` с владельцем-игроком (`game.getPlayerById`), для каждой карты `player.tableau` с хуком: вызвать под
  `events.withEffect(player, card, 'delegates-discarded', …)`. Новый литерал в `EventTrigger`
  (`common/events/GameEvent.ts:56–70`); грепнуть исчерпывающие `switch` по триггеру (статистика, нотификации,
  `effectFamily`) — каждый должен знать новое слово, не падать в default молча.
- **Событие журнала обновления** — новый вид **`{kind: 'card-effect'; player: PlayerId; card: CardName;
  resource: CardResource; count: number; instance: ResolutionInstanceId}`** в `SerializedRenewalEvent`
  (`SerializedParliament.ts:314–321`), пушится СРАЗУ ПОСЛЕ своего `leave`. Хук пишет это событие не сам —
  `stepRefresh` замеряет `card.resourceCount` до/после вызова и пишет дельту (хук может быть у любой карты с
  любым ресурсом; дельта 0 — события нет). Цепочка модели: `ParliamentModel.ts:486–505` (`player` → `Color`, как
  у `lobby`), `common/models/ParliamentModel.ts:418–425`, клиент — §3.
- **Реплей** `ParliamentRenewal.spec.ts` («журнал, применённый к столу до заседания, даёт стол после») обязан
  ИГНОРИРОВАТЬ `card-effect` (стол он не меняет) — добавить в реплей и в `parliamentSittingSeed.ts:143` (посев).

### A2 · Требование — тропа `DELTA_POSITION`, восемь точек
1. `RequirementType.DELEGATES_ON_RESOLUTIONS = 'Delegates on resolutions'` (`RequirementType.ts`, секция
   `// Turmoil` → своя подсекция `// Turmoil Redux`).
2. `CardRequirementDescriptor.ts`: поле `delegatesOnResolutions?: number` (комментарий: «на резолюциях в области
   голосования; лобби/кресло/запас не считаются») + ветка в `requirementType()` (`:127`).
3. `CardRequirements.compileOne` (`:117`) → `new DelegatesOnResolutionsRequirement({...descriptor, count:
   descriptor.delegatesOnResolutions})`.
4. Класс `src/server/cards/requirements/DelegatesOnResolutionsRequirement.ts extends InequalityRequirement`,
   `getScore = player.game.politics?.delegatesOnResolutions(player) ?? 0`. **Фасад:** метод
   `delegatesOnResolutions(player): number` в `PoliticalOps` (`PoliticalOps.ts:25–50`): Redux →
   `parliament.votesOf(player)`; Classic → `0` с комментарием «в классике нет области голосования» (карта
   Redux-only, ворота — модуль; фасад честен, а не притворяется партиями).
5. `Card.populateCount` (`Card.ts:515`) → `?? requirement.delegatesOnResolutions`.
6. `buildCardInformation.requirementBlock` (`:253–259`): EN `Requires ${enCount(n, 'delegate', 'delegates')} of
   yours on resolutions in the Voting Area.` (ветка `max` — симметрично, хоть карта её не носит).
7. `unplayableReasons.ts`: `requirementReason` → `{type: 'count', message: 'Requires ${0} delegate(s) on
   resolutions', params, current}`; `FULLY_RESTATED_REQUIREMENTS` (`:115`) — добавить (причина пересказывает
   правило целиком).
8. Клиент: `premiumCardViewModel.ts REQUIREMENT_RENDER` → `{value: (d) => d.delegatesOnResolutions ?? d.count ?? 1,
   iconUrl: 'assets/misc/delegate.png'}` (как напечатано: фигурка делегата + число; `PARTY_LEADERS` носит ту же
   иконку — различие в строке правил и подсказке чипа, не в картинке); `unplayableReasonFormat.ts
   COUNT_MESSAGE_LABELS` → `'Requires ${0} delegate(s) on resolutions': 'On resolutions'` — **ключ существующий**
   («На резолюциях»), компактный счётчик руки «На резолюциях 1/3».
Гарды, которые об этом узнают сами: `requirementProse.spec.ts` (таблица субъектов — добавить тип),
`premiumCardIcons.spec.ts`, `cardInformation.spec.ts` (без заметки «not templated»).

### A3 · Карта
```ts
export class PoliticalScience extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.POLITICAL_SCIENCE, type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.EARTH], cost: 8,
      resourceType: CardResource.DATA,
      requirements: {delegatesOnResolutions: 3},
      action: {spend: {resourcesHere: 3}, drawCard: 1},
      metadata: {
        cardNumber: 'TR02',
        infoText: [{kind: 'effect-short', text: 'Delegates off unenacted resolutions: +1 data each'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever your delegates get discarded from unenacted resolutions, add 1 data resource here per delegate discarded.', (eb) => {
            eb.delegates(1, {cancelled: true}).asterix().startEffect.resource(CardResource.DATA);
          }).br;
          b.action('Spend 3 data from here to draw a card.', (eb) => {
            eb.resource(CardResource.DATA, 3).startAction.cards(1);
          });
        }),
      },
    });
  }

  public onDelegatesDiscarded(player: IPlayer, count: number): void {
    player.addResourceTo(this, {qty: count, log: true});
  }
}
```
- `cancelled: true` — уже в `ItemOptions` (`CardRenderItem.ts:22`), премиум-лицо рисует `pcard-mi--cancelled`
  (`PremiumMechNode.vue:362`); Pristar — прецедент перечёркнутого ресурса в ряду эффекта. Проверить ГЛАЗАМИ,
  что перечёркнутый делегат читается (крест поверх фигурки), иначе — починить класс, не менять DSL.
- `effect-short` обязателен (описание > 52 символов); `action-short` — только если `actionCaption` потребует;
  тогда ключ Red Spot Observatory `{kind: 'action-short', text: 'Draw a card', tokens: ['cards']}` (переведён).
- `CardName.POLITICAL_SCIENCE = 'Political Science'` в секции `// Turmoil Redux` (`CardName.ts:1072`); манифест —
  строка с комментарием про символ Turmoil.
- Хуки превью/причин — авто (`actionPreview` декларативный: cost-чип «3 data на этой карте» + gain «карта»;
  `cardPlayPreview` авто; forecast-близнеца для триггера `effectForecastCoverage` не требует — семейство
  зеркалит `onCardPlayed*`/`onProductionGain`; **но** в блок эффектов (`effectExtraction`) эффект должен попасть
  без «Flagged» — проверить и при нужде закрепить строкой спека, как у TR09).

## 3. Блок B · клиент — такт «Обновление» + две таблицы (§A2 п.8)

**Куда физически летит data.** Табло карт во время заседания не видно; видимая сцена сбора — плашка ЗАПАСА
игрока, куда только что сели его кубы с проигравшей (`launchLeaveReturns`, `sittingDirector.ts:1155–1204`,
цель `[data-parl-seat-reserve="<color>"]`). Закон памяти «анимации нужна видимая сцена»: чип рождается ТАМ.
- `BandRenewalCue.kind` (`parliamentBand.ts:186`) + `cueOf` (`sittingDirector.ts:1123`) + `switch` директора
  (`:1451`) — новое слово `card-effect`.
- **Ход:** после посадки ПОСЛЕДНЕГО куба этого владельца с этой карты (колбэк `landed`, счётчик
  `renewalReturns`) над плашкой запаса рождается жетон `res-data` с числом «+N», короткий подъём и растворение
  (`motionMs`, `MOTION_EASE`, без `setTimeout`); полёт регистрируется в `runState.flights`, как кубы; нет сцены →
  `noteDegraded('card-effect …')` — **никогда молча** (гард e2e `data-renewal-degraded`).
- **Лента** (`renewalLine`, `parliamentBand.ts:462–480`): строка события `card-effect` — чипы `{kind: 'player'}`,
  `{kind: 'count', key: 'Data', amount}` («Данные 2» — ключ существующий), затем имя карты: если в `BandChip` уже
  есть вид для КАРТЫ (проверить строки НАГРАДЫ RX18) — им; иначе `{kind: 'label', key: <CardName>}` (имя карты —
  легитимный i18n-ключ). Никакой прозы; глоссарий — «непринятая», не «проигравшая».
- **Журнал/нотификации:** строка «X added 2 data to Political Science» с источником-картой; после заседания
  нотификация пассива называет карту и величину (`crossPlayerCoverageGuard`, `notification-why-layer`).
- **Рука:** карта с невыполненным требованием — компактный счётчик «На резолюциях 1/3» (не полная строка);
  в осмотре — строка ТРЕБОВАНИЕ и чип «[делегат] ≥ 3» согласны (гард `requirementProse`).
- **Композер действия** «ДЕЙСТВИЯ КАРТ › ПОЛИТОЛОГИЯ › НАСТРОЙКА»: чип «3 → 0 на этой карте», хендоф категории
  `draw` (колода отвечает, карта летит в док). `ICON_NEEDLES` (`consoleActionCommitMotion.ts:67–90`): иконка
  РЕЗУЛЬТАТА — карта, игла `cards` есть; иглу data добавлять только если коммит читает иконку СТОИМОСТИ — и тогда
  **`'data': ['data.']`, не голое `'data'`** (`bg.includes` поймает `url("data:image…")`).

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие и переиспользуемые: «Data»/«Данные»,
«On resolutions»/«На резолюциях», «Not enough resources on this card», лог `${0} added ${1} ${2} to ${3}`,
«Resolution ${0} leaves the voting area». Новые (ожидается ~7):
- `turmoil_redux_cards.json`: `"Political Science": "Политология"` (**имя — решение владельца**; запасной вариант
  «Политические науки»); `"Effect: Whenever your delegates get discarded from unenacted resolutions, add 1 data
  resource here per delegate discarded.": "Эффект: когда ваши делегаты сбрасываются с непринятых резолюций,
  положите на эту карту 1 единицу данных за каждого сброшенного делегата."`; `"Action: Spend 3 data from here to
  draw a card.": "Действие: потратьте 3 единицы данных с этой карты, чтобы взять карту."` (голос — «единицу
  данных» из `colonies.json:150`, «принята/непринята» — глоссарий).
- `card_info.json`: `effect-short` → `"Делегаты с непринятых резолюций: +1 данные за каждого"` (≤ 52 симв.,
  сверить с TR09); прозу требования — что напечатает аудит.
- Причина требования — в файл, где живут соседи (`grep '"Requires ${0} floater(s)"'`): `"Requires ${0} delegate(s)
  on resolutions": "Требуется делегатов на резолюциях: ${0}"` (образец `hydronetwork.json:185`).
- `parliament.json`: метка ленты для `card-effect` (если понадобится своя, кроме имени карты) — одно слово,
  глоссарий.
- `lore_texts.json` RU: `"The ever-futile pursuit of bringing logic to a space of emotions.": "Вечно тщетная
  попытка привнести логику туда, где правят эмоции."` (сверить голос с соседями).

## 5. Тесты
**`tests/cards/turmoilRedux/PoliticalScience.spec.ts`** (структура — `EvaMechs.spec.ts`; стол — `table()` из
`ParliamentRenewal.spec.ts`: `testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true})`, `Phase.ACTION`,
три тихие резолюции через `seatResolution(parliament, i, quietResolutionOf(party))`, голоса `parliament.placeVote`,
заседание `endGenerationThroughParliament(game)`):
- метаданные: имя, ACTIVE, 8, `[SCIENCE, EARTH]`, DATA, `TR02`, без ПО, требование `{delegatesOnResolutions: 3}`;
- **сбор:** 2 делегата p1 на проигравшей A + 1 на проигравшей B + 1 на победившей → **3 data**; в
  `lastPhase.renewal` два события `card-effect` (count 2 и 1) сразу после своих `leave`; лог с картой-источником;
  событие рекордера `cardResources` с источником `card`; нейтральные на проигравшей — 0; делегаты p2 — только p2
  (если у p2 карты нет — 0 и события нет);
- принятая не считается (правило 2); финальное поколение — 0 и событий нет (правило 3); снятие в кресло (правило 4)
  — 0; идемпотентность `drive()` (правило 10); Повестка «N data/бактерий» не двигается сбором (правило 9);
- **требование:** 2 делегата на резолюциях → `canPlay` false, `unplayableReasons` = `{type: 'count', message:
  'Requires ${0} delegate(s) on resolutions', current: 2}`; 3 → true; 2 на резолюциях + 1 в лобби + Председатель
  → false (лобби/кресло не считаются); классический стол (`turmoilExtension`) → 0; `normalizeRequirement` →
  `delegate.png`, value 3, `min`;
- **действие:** 2 data → `canAct` false, причина «Not enough resources on this card» (`current: 2`); 3 → data 0,
  +1 карта в руке, промпта нет; превью `declarative`: cost-чип 3 `note: 'on this card'`, gain «карта»;
- **держатель:** действие Учёных при p1 с этой картой предлагает её и кладёт 2 data; `getSpendable` ни одной единицы
  не знает про эту карту;
- save/load `resourceCount`.
**`tests/parliament/ParliamentRenewal.spec.ts`**: сценарий с картой — журнал несёт `card-effect`, реплей его
пропускает и стол сходится. **`ParliamentModel.spec.ts`**: модель события (`player` → цвет).
**Требование — гарды** `requirementProse` / `premiumCardIcons` / `cardInformation` зелёные с типом в таблицах.
**Клиентские:** `premiumCardViewModel.spec` (кейс нового типа), `unplayableReasonFormat` (компактная метка),
`parliamentBand` (строка `card-effect`), `parliamentSittingSeed` (посев игнорирует). **Гарды чеклиста § 3** —
ворклист TR02 пуст; `make:cards` 0/0/0.
**e2e — ОДИН спек на новую механику** (`tests/e2e/console-political-science.spec.ts`, фикстура
`political-science-assembly` в `generate.ts` через `parliamentFixture` по образцу `parliament-renewal-assembly`
(`generate.ts:960–984`): у синего «Политология» в табло (`p1.playedCards.push`), 2 его делегата на ПРОИГРАВШЕЙ
(лобби + запас), красный выигрывает, `stopAt: 'assembly'`; имя — в `FixtureName`). Один A играет прогулку;
пробник (`MutationObserver` + `setInterval`, не rAF; правила `console-parliament-renewal.spec.ts` «источник виден,
цель видна, движение было»): (1) оба куба синего сели в его запас; (2) ПОСЛЕ последней посадки над плашкой запаса
синего появился жетон data «+2» и растворился; (3) строка ленты содержит «Политология» и «Данные 2»;
(4) `data-renewal-degraded` не появлялся; (5) сервер по API: на карте 2 data, `renewal` несёт `card-effect`
count 2; (6) после заседания — карта в табло с капсулой «2». `--repeat-each=4`, `waitForTimeout` = 0.
Генератор фикстур: каждая таблица сеет свой rng — чужие фикстуры не перегенерировать.

## 6. Визуальная приёмка (один профиль, ЧЕТЫРЕ кадра)
1. `?premiumCardsPlayground` (чип модуля turmoilRedux) — лицо: Наука + Земля в углу, чип требования «[делегат] ≥ 3»,
   ряд эффекта «[делегат перечёркнут]* : [data]», ряд действия «3 [data] → [карта]», без бейджа ПО.
2. Рука на Redux-столе с 1 делегатом на резолюциях: карта недоступна, компактный счётчик «На резолюциях 1/3»;
   тот же стол, 3 делегата — доступна.
3. Такт «Обновление»: кадр с жетоном data «+2» над плашкой запаса синего (после посадки кубов) и лента.
4. Композер «ДЕЙСТВИЯ КАРТ › ПОЛИТОЛОГИЯ › НАСТРОЙКА» с чипом «3 → 0 на этой карте» и кадр хендофа добора.
Карту гарантировать через «Тестовый режим» (`docs/DEV_GUARANTEED_CARDS.md`); заседание — фикстура §5.

## 7. Режим работы
**3 коммита**, каждый зелёный по юнитам: (1) вид требования насквозь (8 точек + фасад + спеки + гарды);
(2) хук + триггер + событие журнала + карта + спеки + локаль + арт + лор; (3) такт обновления (чип + лента +
посев) + e2e + фикстура + документы. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`,
`npm run make:json`, `npm run make:css` перед визуальной проверкой. **Не пушить.**
**Документ карты ЗАВОДИТЬ** — `docs/TURMOIL_REDUX_POLITICAL_SCIENCE.md`: контракт «хук, который стреляет
заседание» (`onDelegatesDiscarded`, событие `card-effect`, где чип рождается) и вид требования — их наследуют
следующие карты набора с делегатами и data. В журнал набора: что нового (три «впервые»), решения (финал без сбора,
кресло не сброс, фасад для классики = 0, имя), гэпы. В `TURMOIL_REDUX_SPEC.md` §4.1 — одна фраза: предпосылка
Diverted Research (держатель data в скоупе) появилась с TR02; **саму резолюцию НЕ делать** — очередь `skip`
разбирает владелец. В чеклист §0 — строка про символ Turmoil внизу слева (= движок, в Redux-манифесте не
объявляется `compatibility`).
Гочи: `python3` — заглушка Store; `cross-env` нет; юниты последовательно; `eqeqeq` без исключения для null; новая
карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в манифесте и записать;
MarsBot × Venus Redux — известное, отложено владельцем, не поднимать.

В отчёте: список точек тропы требования с путями; сигнатура хука и место вызова в `stepRefresh`; форма события
`card-effect`; результат `ParliamentRenewal` реплея; четыре кадра; новые ключи i18n; прогон e2e 5/5; что
напечатали гарды до/после.

## 8. Нельзя
Считать делегатов принятой резолюции, лобби или кресла. Хук в центральной таблице вместо файла карты. Дёргать хук
из `stepEnact` или из `removeLatestVote`. `compatibility: 'turmoil'` / `politics` у карты набора. Детект по
тексту заголовка. `resourceCount +=` мимо `addResourceTo`. Чип сбора по `setTimeout` или «пропустить, если сцены
нет». Второй ключ для «Данные»/«На резолюциях». Делать data платёжной единицей. Реализовывать Diverted Research.
Трогать чужие незакоммиченные файлы, `shardPlan.json`. Пуш и красные коммиты.
