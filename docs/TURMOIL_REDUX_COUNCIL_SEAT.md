# TR36 · Council Seat («Место в совете») — ЗАКОН ДОСТУПА, который понижает карта

**Статус: СДАНА 2026-10-09.** Тридцать седьмая карта проектов набора Turmoil Redux (седьмая плашка Красных после
TR30–TR35). Печатный текст: «Требует, чтобы «Красные» были у власти или у вас было 2 делегата на их резолюции.
Эффект: вам достаточно 1 делегата на резолюции, чтобы получить эффект её партии.» Стоимость 6, метка Марс, ACTIVE,
без действия, без ресурса, без ПО. Лор со скана: «Chair man of the bored.» → «Председатель совета скучающих.»

Первая карта набора, которая меняет не СТОЛ, а ПРАВИЛО, по которому стол читается: порог «≥ 2 своих делегата на
резолюции партии → её эффект» (свод стр. 7) для владельца становится «≥ 1», для КАЖДОЙ партии области голосования
разом, вживую. Требование карт («Requires the Reds to be ruling or that you have 2 delegates there») не меняется
никогда — FAQ стр. 19: «Septem Tribus and Council Seat only grant you the effect of the party. Not its full favor».

Промт: `docs/claude/prompts/project-tr36-council-seat.md`. Файл карты: `src/server/cards/turmoilRedux/CouncilSeat.ts`.
Спек: `tests/cards/turmoilRedux/CouncilSeat.spec.ts` (22). Клиент: `tests/client/components/console/partyEffectThreshold.spec.ts`
(12). Гард класса: `tests/console/parliamentThresholdGuard.spec.ts`. e2e: `tests/e2e/console-council-seat.spec.ts`
(фикстура `council-seat`, fhd + 4K). Журнал набора: `docs/claude/turmoil-redux-cards-progress.md` § TR36.

---

## 1. Правила чтения (каждое закреплено спеком)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Требование — плашка Красных: правят или 2 СВОИХ делегата на их резолюции, ТОЛЬКО при розыгрыше (класс TR15). Собственный эффект карты требованию не помогает: с одним кубом у Красных карта Красных в руке — «1 из 2», неиграбельна, хотя эффект Красных у владельца есть | `Parliament.access().satisfiesRequirement` читает `PARTY_EFFECT_DELEGATES`; спек «FAQ p.19» |
| 2 | Розыгрыш ничего не кладёт на стол: ни ресурса, ни делегата, ни денег; `behavior` нет | спек «rule 2» |
| 3 | Порог эффекта владельца = 1 для КАЖДОЙ партии области голосования одновременно; три резолюции с одним кубом — три эффекта; складывается с правящей; у остальных — 2 | `Parliament.effectDelegatesOf`; модель `effectDelegates` / `effectDelegatesBy` на проводе |
| 4 | Требование не трогается: `satisfiesPartyRequirement` при 1 — false; `partyRequirementStanding.required` = 2; `unlocksRequirement` проекции — при 2; `unlocksEffect` владельца — при 1 | `PoliticalOps`, `ParliamentModel.projectVote` |
| 5 | Живьём, в обе стороны: карта сыграна при стоящем кубе → эффект сразу (действие партии в меню тем же ходом, wild-метка Учёных в следующем счёте); куб ушёл / резолюция ушла → эффекта нет; карта ушла из табло → порог 2 | спек «rule 5» (три случая), Unity-торговля бесплатна с одним кубом |
| 6 | Не грант: `access().granted` пуст, `grantedEffects` не пишется, сериализации нового нет — порог заново читается из табло после загрузки | спек «rule 6» |
| 7 | Считаются только СВОИ кубы НА РЕЗОЛЮЦИИ: кресло председателя, нейтральные, Народная поддержка — нет; принятая карта — её партия правит (другая дорога) | спек «rule 7» |
| 8 | Нижняя граница и сложение: два хука порога → всё равно 1, никогда 0; объявленные 5 → 2 (карта не может ПОДНЯТЬ планку); грант ∨ порог | `effectDelegatesOf` клампит `[1, PARTY_EFFECT_DELEGATES]` |
| 9 | Действие партии — одно использование за поколение, какой бы дорогой ни пришёл доступ | существующее правило; спек Unity |
| 10 | MarsBot не разыгрывает карту; место бота (`participates('party-effects')` false) при любом пороге — без эффекта | спек «rule 10» |
| 11 | Журнал розыгрыша — по строке на партию, чей эффект открылся ЭТИМ розыгрышем («${0} holds the ${1} party effect: 1 delegate on ${2} (${3})»), под областью эффекта карты; ни одной — ни строки | `councilSeatOpenings` + `events.withEffect(player, card, 'card-played')` |
| 12 | Проекции голоса владельца: слот с 0 кубов — «откроет эффект (1 делегат)» без чипа требования; слот 1 → 2 — требование без эффекта | спек «rule 12» |

**Чтение скана.** Делегат-силуэт, двоеточие, фиолетовый «?» со звёздочкой — ряд эффекта `eb.delegates(1).startEffect.wild(1).asterix()`;
эмблема Красных в плашке MIN — требование `{party: REDS}`, не метка; внизу только значок модуля — `compatibility` не объявляется.

## 2. Контракт «ХУК ПОРОГА ДОСТУПА» (его наследует Septem Tribus / любая следующая карта, меняющая закон доступа)

### 2.1 Хук — в файле карты (инвариант 8)
```ts
// ICard.ts
/** Own delegates on ONE resolution that give this card's OWNER the party's effect; the tableau's minimum wins,
 *  never below 1 and never above PARTY_EFFECT_DELEGATES; the card REQUIREMENT never reads it (FAQ p.19). */
readonly partyEffectDelegates?: number;
// CouncilSeat.ts
public readonly partyEffectDelegates = COUNCIL_SEAT_EFFECT_DELEGATES; // 1
```
Парламент читает хук по образцу `influence` (`getInfluenceBonus`): обход `player.tableau`, минимум по объявленным,
кламп `[1, PARTY_EFFECT_DELEGATES]`, источник — первая карта, достигшая минимума. Парламент НЕ знает имени карты
(`cardIsInEffect(CardName.COUNCIL_SEAT)` в `Parliament.ts` запрещено).

### 2.2 Одна функция закона — `Parliament.access()`
```ts
const effect = this.effectDelegatesOf(player);           // {count, source?}
const byDelegates = delegates >= effect.count;           // ЭФФЕКТ — по порогу владельца
satisfiesRequirement: ruling || delegates >= PARTY_EFFECT_DELEGATES; // ТРЕБОВАНИЕ — всегда печатные два
```
`PartyAccess` / `PartyAccessModel` несут `effectDelegates` и `effectDelegatesBy?: CardName`. Проекция голоса:
`unlocksEffect` — по `before.effectDelegates`, `unlocksRequirement` — по константе. Константа `PARTY_EFFECT_DELEGATES`
отныне документирована как ДВА совпадающих числа: порог требования (всегда) и порог эффекта ПО УМОЛЧАНИЮ.

### 2.3 Порог, а не грант (D1)
Грант (`grantPartyEffect` / `revokePartyEffect`, `grantedEffects` в сейве) — состояние «эффект есть независимо от кубов»,
резерв под Septem Tribus. «Достаточно одного» — ЧИСЛО: грантами его пришлось бы переписывать на каждое размещение,
снятие и уход резолюции. Порог читается из табло в той же функции, где считают `byDelegates`, состояния не добавляет,
save/load не трогает; плейсхолдер `'Council Seat'` у грантов в тестах и фикстуре `parliament-dense` переименован в
`'Septem Tribus'`.

### 2.4 Клиент — ОДИН читатель (гард `parliamentThresholdGuard.spec.ts`)
`consoleParliamentModel.ts` экспортирует `PARTY_EFFECT_PLACES` (печатные ДВА места — рисуются всегда, в потоке),
`effectDelegatesOf(access)` (= `access.effectDelegates ?? PARTY_EFFECT_DELEGATES` — старые фикстуры читают печатный
закон), `effectDelegatesLowered(access)`, `effectDelegatesSourceOf(access)` (переведённое имя карты — через
`translateCardName`, литерала имени в `src/client/**` нет). Константа `PARTY_EFFECT_DELEGATES` в `src/client/**`
встречается ТОЛЬКО в этом файле; в `.vue` — никогда.

Поверхности по порогу зрителя:
- **места ▢▢** (плитка партии `ConsolePartyPlaque`, ряд «ВАШИ» в `ConsoleParliamentVotingArea`): две коробки в потоке,
  место с `n > effectDelegates` — **VOID** (`visibility: hidden`, геометрия ряда не меняется — идиома `voidEmpty`
  сокетов поддержки); счётчик — «0/1» / «1/1»; `--on` / «эффект ваш» — по порогу; `data-pseal-places`, `data-pseal-place-void`,
  `data-parl-mine-threshold`, `data-parl-place-void`, `data-parl-held` — хуки e2e;
- **фразы** (`partyStateOf` → «Your effect · 1 delegate» при одном кубе; `accessReasonRows` → holds / lacks с именем
  карты, нота требования «один делегат открывает эффект, требованию по-прежнему нужны два»; `voteAccessOf` → порог
  зрителя; `voteForecastRows(…, access)` → чип «(1 delegate — ${0})»; `resolutionStatusOf` → `threshold` подвала);
- **стрип эффектов** (`ConsolePartyEffectsStrip`): подзаголовок называет закон места — «с одним делегатом этого игрока
  («Место в совете»)»;
- **композер розыгрыша**: ноты `cardPlayPreview` — по партии, что откроется СЕЙЧАС («Откроет эффект партии «Учёные»
  сейчас: ваш делегат на «…»»), либо «Сейчас ни одной партии: эффект начнётся с первого вашего делегата на резолюции».
  Токен PARTY в тексте сообщения говорит словарём Парламента (`translateMessage` → `partyNameKey`, PL-109).

### 2.5 Запрещено
Грант вместо порога в файле карты; порог в требовании; чтение табло по имени карты в Парламенте; константа в `.vue`
или вторая константа на клиенте; `v-if`-исчезновение места ▢; литерал имени карты в `src/client/**`; новое
сериализуемое поле.

## 3. Что встало само
Плитки действий партий (`ParliamentHandler.partyActionOptions` по `hasPartyEffect`), wild-метка Учёных (`Tags.count`
→ `wildTags`), Unity-торговля (`TradeWithUnity.hasAccess`), прогноз эффектов (`effectForecast`), досье клетки
(`BoardInformationEngine`), модель действий партий, чтение сидящего (`seatParliamentReading.access.held`) — все через
`hasPartyEffect` / `access().hasEffect`, без строки кода.

## 4. Подача (4K первым)
Композер: одна строка «Далее» с партией и резолюцией. Розыгрыш — обычная посадка карты в табло (стол не трогается,
Парламент не поднимается). Парламент после: ряд «ВАШИ ▣▢ 1 ЭФФЕКТ ВАШ» (второе место VOID, ряд не сдвинулся),
плитка «1/1 ЭФФЕКТ ВАШ» с мятным кольцом, бейдж действия горит, «Марс вперёд» — «0/1»; слово «ЭФФЕКТ ВАШ» входит
фразой (колодец 0fr → 1fr в ряду, одношаговая анимация на плитке — только при смене на стоящей плитке, не при
монтировании); инспектор Учёных цитирует карту; режим голоса на пустом слоте — «ЭФФЕКТ ПАРТИИ 0 из 1 → эффект ваш».
Кадры — `screenshots/council-seat/tv4k/` (не в git).

## 5. Гэпы и решения владельца
- Анонса «эффект партии получен / потерян» нет ни у одной дороги (К-5, PL-112) — владелец 2026-10-09: событие
  `party-effect-gained` / `-lost` + строка журнала + нотификация с CTA «Открыть Парламент» — СЛЕДУЮЩЕЙ КАРТОЙ; эта карта даёт
  только свою строку журнала (правило 11).
- Плитка партии при двух кубах и пороге 1 читает «1/1» (места — инструмент ПОРОГА, число кубов — в ряду «ВАШИ 2») — владелец
  2026-10-09: так и оставить (PL-111).
- Инспектор партии: справка «ДОСТУП» стоит только у читателя без «ДЛЯ ВАС» (PL-042, решение владельца 2026-10-09) — строки состояния
  уже называют закон зрителя («ваш делегат … («Место в совете»: достаточно одного)»), а печатное «два ваших делегата» рядом с ними лгало
  владельцу карты (PL-113) и выталкивало панель за сгиб на 4K.
- `voteForecastRows` (чип «Unlocks the party effect …») — у продукта нет потребителя (ряд фактов режима голоса говорит
  это строкой «ЭФФЕКТ ПАРТИИ 0 из 1 → эффект ваш»); функция сделана честной на случай возврата.
