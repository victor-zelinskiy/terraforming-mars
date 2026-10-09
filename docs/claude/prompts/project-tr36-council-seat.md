# Промт исполнителю · TR36 Council Seat («Место в совете») — ПОРОГ ЭФФЕКТА ПАРТИИ: 1 делегат вместо 2 (только эффект, НЕ требование) · первая карта, меняющая ЗАКОН ДОСТУПА · карта ≈ 50 %, остальное — маршрут «доступ к эффекту партии» на TV 4K

Выдан 2026-10-09. Инфраструктура набора стоит (TR01–TR35, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md` (включая постоянный **§7 «Полировка по пути»**, правило владельца от 2026-10-08 —
агент САМ ищет места доработки, визуальная подача — топ-приоритет, слабость принятой сцены — в батч владельцу с рекомендацией
ПЕРВЫМ, и правило **«Профили» от 2026-10-09 — TV 4K сперва, полировок только-для-Deck не делаем**), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила —
`.claude/rules/{game-logic,server,console-ui,animations,premium-card,tests}.md`, словарь — `docs/claude/parliament-glossary.md`
(инвариант 13: Парламент говорит ОДНИМ словарём, гард `tests/console/parliamentGlossary.spec.ts`).
**Обязательное чтение до кода:** `src/server/parliament/Parliament.ts:80–93` (`PartyAccess`) и `:465–511` (`access()`,
`hasPartyEffect`, `satisfiesPartyRequirement`, резерв `grantPartyEffect` / `revokePartyEffect`), `:528–534` (`influence` — обход
`player.tableau` за `getInfluenceBonus`: ОБРАЗЕЦ хука, читаемого Парламентом вживую), `src/common/parliament/ParliamentTypes.ts:100–101`
(константа `PARTY_EFFECT_DELEGATES = 2` — её комментарий сегодня склеивает ЭФФЕКТ и ТРЕБОВАНИЕ), `src/common/models/ParliamentModel.ts:63–74`
(`PartyAccessModel` — там уже написано «a future Septem Tribus / Council Seat — effect only, never the requirement»),
`src/server/parliament/ParliamentModel.ts:208–219` (сборка модели доступа) и `:322–346` (`projectVote` — `unlocksEffect` /
`unlocksRequirement` считают по константе), `src/server/politics/PoliticalOps.ts:131–138` (`partyRequirementStanding` → `required`
— это «N из 2» в руке), `src/server/models/unplayableReasons.ts:326–339`, `src/client/console/parliament/consoleParliamentModel.ts:325–352`
(`partyStateOf` — «Your effect · 2 delegates»), `:415–453` (`accessReasonRows` — все фразы «два ваших делегата»), `:522–545`
(`voteAccessOf` — `threshold = PARTY_EFFECT_DELEGATES`), `:588–592` (чип «Unlocks the party effect for you (2 delegates)»), `:1021–1022`,
`src/client/console/parliament/resolutionInspectModel.ts:75–134`, `src/client/components/console/parliament/ConsolePartyPlaque.vue:99–115`
и `:221–229` (места ▢▢ и идиома VOID-в-потоке), `ConsoleParliamentVotingArea.vue:124–134` (ряд «ВАШИ ▢▢ N» + «эффект ваш»), `:167`,
`docs/TURMOIL_REDUX_SPEC.md:115` (строка таблицы «Требование партии на карте») и `:283–289` (§3.3 предикаты доступа), свод правил
(`/tmp/redux-rulebook.txt` после `pdftotext -layout "…/Turmoil Redux rulebook v1.0.pdf"`; Read PDF не работает) **стр. 7 «Party
Effects & Card Requirements» и FAQ стр. 19** — цитата ниже; журнал § TR35 / § TR34 (гочи стенда); реестр — **PL-022**, **PL-042**,
**PL-084** (Парламент), **PL-076** (порядок чипов нотификации). Память: `tr-prompts-carry-polish-budget`,
`polish-priority-tv4k-no-deck-only`, `storyboard-catches-what-the-probe-passes`, `owner-batches-pending-polish-decisions`,
`turmoil-redux-project-cards` (гочи TR34/TR35), `coupled-motion-is-one-class-flip`, `fixed-layer-is-a-stacking-context`.

Номера строк сняты с `633f5c5cec` (дерево чистое на момент выдачи) — перед правкой перечитать.

**Что это за карта.** Синяя, 6, метка Марс, плашка Красных (седьмая после TR30–TR35), без ПО, без действия, без `behavior` —
ОДИН пассивный эффект: *«You only need 1 delegate on a resolution to gain its party's effect.»* Это первая карта набора, которая
меняет не стол, а **ЗАКОН ДОСТУПА** — порог «≥ 2 своих делегатов на резолюции партии → её эффект» для владельца карты становится
«≥ 1», для КАЖДОЙ партии области голосования разом, вживую (§3.3 свода: доступ оценивается живьём). **Требование карт не
меняется** (FAQ стр. 19 дословно: *«If I have a cube on a party as Septem Tribus, or "Council Seat" and 1 delegate on a resolution, is
that enough to play cards with that resolution's party as a requirement? No. … Septem Tribus and Council Seat only grant you the
effect of the party. Not its full favor.»*). Сервер — одна точка (`Parliament.access`) и хук в файле карты; клиент — пять мест,
где «2» зашито константой, и все фразы «два ваших делегата»; подача — сцена, которой сегодня нет ни у одной дороги: **момент,
когда эффект партии становится ТВОИМ**. Доля карты ≈ 50 %; остальное — осмотр маршрута «плитки партий · ряд ВАШИ · режим голоса ·
инспектор · стрип эффектов · рука с плашками Красных» на 4K и полировка.

**Оценивается — в этом порядке веса.**
1. **ЗАКОН — ОДНА ФУНКЦИЯ.** Порог эффекта считает только `Parliament` (из хука карты в табло), модель НЕСЁТ его на клиент, и ни одна
   клиентская поверхность не решает за зрителя константой. Гард класса: статический спек «`PARTY_EFFECT_DELEGATES` в `src/client/**`
   читает ОДИН помощник модели» (образец — `tests/console/satelliteStyleGuard.spec.ts`, PL-102). Требование — по-прежнему 2 везде.
2. **ПОДАЧА момента «эффект ваш»** (раскадровки — приёмка, 4K первым): композер до нажатия называет, какие партии откроются
   СЕЙЧАС; розыгрыш → в Парламенте пара мест ▢▢ становится одним местом, стоящий там куб его ЗАЖИГАЕТ, «ЭФФЕКТ ВАШ» приходит
   фразой, плитка действия партии оживает, стрип эффектов пополняется — один такт, одна причина, ничего не моргает.
3. **ЧЕСТНОСТЬ между поверхностями:** рука с TR30–TR35 говорит «1 из 2» (требование), плитка той же партии — «Эффект ваш»
   (эффект), инспектор — мост между ними одной строкой. Три поверхности, два вопроса, ни одной лжи.
4. **Полировка** — PL-022 / PL-042 воспроизвести на 4K, класс «эффект партии получен / потерян» без анонса (К-5), собственные
   находки сверх названного.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Предикат доступа** | `Parliament.access()` (`Parliament.ts:467–490`): `byDelegates = delegates >= PARTY_EFFECT_DELEGATES`; `granted` — список источников-грантов; `hasEffect = ruling ∨ byDelegates ∨ granted`; `satisfiesRequirement = ruling ∨ byDelegates` с комментарием «a card-granted effect never satisfies a card REQUIREMENT (FAQ p.19)». Бот: `participates(…, 'party-effects')` false → доступа нет никакой дорогой |
| **Резерв под грант — НЕ наш механизм** | `grantPartyEffect(player, party, source)` / `revokePartyEffect` (`:500–511`), сериализуется (`SerializedParliament.ts:474 grantedEffects`). Это статический грант «эффект вне зависимости от делегатов» (класс Septem Tribus). «Место в совете» — ПОРОГ, не грант: `granted` у неё остаётся `[]`. Имя `'Council Seat'` сегодня стоит ПЛЕЙСХОЛДЕРОМ источника гранта в тестах и фикстуре: `tests/parliament/Parliament.spec.ts:152–157`, `PartyEffects.spec.ts:122`, `tests/cards/turmoilRedux/MartianCensus.spec.ts:154`, `NationalistMovement.spec.ts:144`, `RedMuseum.spec.ts:168`, клиентские `tests/client/components/console/consoleParliamentModel.spec.ts:87` и `resolutionInspectModel.spec.ts:85`, `tests/e2e/fixtures/generate.ts:3748–3751` (`parliament-dense`: три гранта «Council Seat» + один «Septem Tribus») → `parliament-dense.json:3240–3248`. После настоящей карты это имя у гранта — ложь |
| **Образец хука, читаемого вживую** | `Parliament.influence` обходит `player.tableau` за `card.getInfluenceBonus?.(player)` (`:530–534`); `ParliamentPhase.ts:962–966` — обход табло за `onDelegatesDiscarded`. Хук — В ФАЙЛЕ КАРТЫ (инвариант 8), Парламент его только читает |
| **Модель на проводе** | `PartyAccessModel` (`common/models/ParliamentModel.ts:63–74`): `party · ruling · delegates · byDelegates · granted · hasEffect · satisfiesRequirement` — порога в ней НЕТ; сборка `playerModel` (`server/parliament/ParliamentModel.ts:208–219`). Старые фикстуры без нового поля — читать через помощник (образец `enactment` → `seatEnacts`, `:131–139`) |
| **Проекции голоса** | `projectVote` (`:343–344`): `unlocksEffect: !before.hasEffect && afterVotes >= PARTY_EFFECT_DELEGATES`, `unlocksRequirement: … >= PARTY_EFFECT_DELEGATES` — первая должна читать порог зрителя, вторая остаётся |
| **Требование в руке** | `PoliticalOps.partyRequirementStanding` → `required: PARTY_EFFECT_DELEGATES` (`PoliticalOps.ts:137`) → `partyRequirementReason` (`unplayableReasons.ts:326–339`, `PARTY_REQUIREMENT_REASON` с `${1}` = 2) — ОСТАЁТСЯ 2 (FAQ) |
| **Константа** | `ParliamentTypes.ts:100–101`: «Own delegates … that grant its effect AND satisfy its card requirement» — после карты это ПОРОГ ТРЕБОВАНИЯ и порог эффекта ПО УМОЛЧАНИЮ: комментарий переписать, читателей разделить |
| **Клиент решает константой (пять мест)** | `consoleParliamentModel.ts:532` (`voteAccessOf.threshold`), `:1022` (`PARTY_EFFECT_THRESHOLD`), `resolutionInspectModel.ts:96` (`threshold` подвала инспектора, `:132` `kind: 'progress'`), `ConsolePartyPlaque.vue:227–229` (`placesCount`) + `:99–103` (▢▢ и «N/2»), `ConsoleParliamentVotingArea.vue:125–133` (`--held`, `v-for="n in PARTY_EFFECT_THRESHOLD"`, «effect is yours») + `:167`, `:214` |
| **Фразы с «двумя»** | `partyStateOf` (`:346`) «Your effect · 2 delegates»; `accessReasonRows` (`:432–445`): «two of your delegates are on its resolution», «one more delegate … would grant it», «two of your delegates … would grant it»; `:449–451` «not met — a granted effect does not count»; чип `:589` «Unlocks the party effect for you (2 delegates)». RU — `src/locales/ru/parliament.json:70, 82–83, 202, 208, 211–212, 226, 235, 278, 287, 309`. Подвал инспектора: `basisOf` `'delegates' | 'ruling' | 'granted'` (`resolutionInspectModel.ts:75–85`) |
| **Потребители, что расширятся САМИ** | плитки действий партий (`ParliamentHandler.ts:107` — без эффекта не предлагается; причина в зоне «ДЕЙСТВИЯ» — «Эффект этой партии вам недоступен», словарь стр. 81), `forEachEffect` (`:412–418` — Учёные wild-метка `:381`, Зелёные, Марс Прежде всего), `TradeWithUnity.ts:24`, прогноз (`effectForecast.ts:283–300`), досье клетки (`BoardInformationEngine.ts:654–668`), модель действий партий (`ParliamentModel.ts:418`), чтение сидящего (`seatParliamentReading.ts:200`) |
| **Анонса «эффект получен» НЕТ ни у одной дороги** | свод-спека §6.3 сценарий 4 обещал «Уведомление „Вы получили эффект партии: …“ с причиной»; в `src/server/parliament/**` ни события, ни строки журнала (grep `party effect` — только `participates`). Стрип `ConsolePartyEffectsStrip.vue` (в `ConsoleInfoMode.vue`) меняется молча; «эффект ваш» в ряду ВАШИ (`:133`) — `v-if` по счётчику без такта; `&__place--on` — смена `box-shadow` без перехода (`console_parliament.less:797–806`, `:779`) |
| **Превью розыгрыша без `behavior`** | `cardPlayPreview.ts:143–149`: карта без поведения и без хука → одна ветка «подтвердить» без чипов; хук `ICard.cardPlayPreview?(player)` (`ICard.ts:97–109`) — co-located образцы `AdministrationDistrict.ts`, `PartySanctions.ts`, `NationalistMovement.ts`; шаг `{kind: 'note', noteKind: 'generic', text}` (`ActionPreviewModel.ts:569`) — строка словами в композере |
| **Лицо** | ряд эффекта `b.effect(текст, (eb) => eb.delegates(1).startEffect.wild(1).asterix())` — атомы `CardRenderer.ts:301` (`delegates`), `:329` (`wild` — фиолетовый «?», спрайт `premiumCardIcons.ts:240`), `:568` (`asterix`); образец ряда — `PoliticalScience.ts:76–78`. Правило 68 знаков > бюджета 52 (`effectCaption.spec.ts:26`) → `effect-short` обязателен |
| **Журнал** | `MessageBuilder.ts:115 party(IParty)` / `:125 resolution(ResolutionId)` / карта — токены; строка карты под её областью эффекта (`game.events.withEffect`, образец `ParliamentPhase.ts:966`) |
| **Арт** | `Downloads\Mars Arts\TR36.png` — **ЕСТЬ** |

### Чтение скана (`…\Projects\Card_-_TR36.png`)
- **Council Seat** · `TR36` · цена **6** · **синяя (ACTIVE)** · метка **Марс** (одна, красная планета) · в оранжевой плашке MIN у цены —
  эмблема **Красных** (`{party: PartyName.REDS}`), не метка.
- Ряд эффекта: **`[делегат] : [?]*`** — силуэт делегата, двоеточие, фиолетовый «?» со звёздочкой. Текст: *(Effect: You only need 1
  delegate on a resolution to gain its party's effect.)*
- Нижний блок: *(Requires the Reds to be ruling or that you have 2 delegates there.)* — и ничего больше: розыгрыш ничего не кладёт.
- ПО нет. Внизу слева — только значок модуля → `compatibility` не объявляется.
- Лор напечатан: **«Chair man of the bored.»** (каламбур chairman of the board / bored). Художник — Simon Urban.

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/CouncilSeat.spec.ts`)
1. **Требование** `{party: REDS}` — у власти или 2 своих делегата на их резолюции, ТОЛЬКО при розыгрыше (класс TR15: эмблема в
   плашке, причина «N из 2», счётчик руки). Собственный эффект карты требованию не помогает никогда (FAQ стр. 19) — и своему
   (она уже разыграна), и TR30–TR35 в руке: с одним делегатом у Красных «1 из 2», карта Красных неиграбельна, хотя эффект
   Красных — ваш.
2. **Розыгрыш** — ничего на стол: ни ресурса, ни делегата, ни денег. `behavior` нет; `cardPlayPreview` co-located (правило 11).
3. **Порог эффекта** владельца = **1** для КАЖДОЙ партии области голосования одновременно: три резолюции с одним кубом на каждой — три
   эффекта. Складывается с правящей (эффект правящей — у всех и так). У остальных игроков порог 2 — без изменений.
4. **Требование не трогается**: `satisfiesPartyRequirement` при 1 делегате — false; `partyRequirementStanding.required` = 2;
   `unlocksRequirement` проекции — при 2; `unlocksEffect` владельца — при 1.
5. **Живьём, в обе стороны:** карта разыграна при уже стоящем кубе → эффект СРАЗУ (в тот же ход плитка действия партии в меню,
   wild-метка Учёных считается следующей карте); обновление сняло кубы / резолюция ушла со стола → эффекта нет; нет карты в табло —
   нет порога (карта не покидает табло — но спек на `fakeCard` в обе стороны).
6. **Не грант:** `access.granted` остаётся `[]`; `grantedEffects` не пишется; сериализации НОВОГО нет — порог заново читается из табло
   при загрузке (спек save / load: эффект стоит после `deserialize`).
7. **Считаются только СВОИ делегаты на РЕЗОЛЮЦИИ**: куб в кресле председателя — нет, нейтральные — нет, Народная поддержка — нет,
   резолюция в слоте ENACTED — нет (её партия правит, это другая дорога).
8. **Нижняя граница и сложение:** два хука порога (`fakeCard` × 2) → всё равно 1, никогда 0; грант (`grantPartyEffect`) и порог — ∨.
9. **Действия партий** — одно использование за поколение на партию независимо от дороги (существующее правило): использование
   с одним делегатом — использование.
10. **MarsBot** не разыгрывает карту; место бота (`participates` false) не меняется ни при каком пороге.
11. **Журнал розыгрыша**: по строке на партию, чей эффект открылся ЭТИМ розыгрышем («получает эффект партии X: 1 делегат на Y»),
    под областью эффекта карты; ни одной открытой — ни строки (не «тихо», а нечего сказать: композер это уже сказал словами).
12. **Проекции голоса владельца**: на слот с 0 кубов — «откроет эффект (1 делегат)» без чипа требования; на слот с 1 → 2 — чип
    требования без чипа эффекта (эффект уже ваш).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, не блокер)
1. RU-имя **«Место в совете»** (альтернатива «Кресло в совете»).
2. Лор RU: **«Председатель совета скучающих.»** (каламбур board / bored; альтернатива «Глава правления. Точнее, зевания.»).
3. **Механизм — ПОРОГ, не грант** (D1 ниже): хук в файле карты `partyEffectDelegates = 1`, `Parliament.effectDelegatesOf(player)`
   = min по табло (не ниже 1, не выше `PARTY_EFFECT_DELEGATES`), модель несёт `effectDelegates` + источник. Резерв гранта остаётся
   под Septem Tribus; плейсхолдер `'Council Seat'` у грантов в тестах и фикстуре `parliament-dense` переименовать в `'Septem Tribus'`
   (JSON фикстуры перегенерировать `npm run e2e:fixtures`; спеков, ждущих это имя, нет — проверено grep).
4. **Второе место ▢ НЕ исчезает, а становится VOID в потоке** (идиома плитки `ConsolePartyPlaque.vue:112–114`): геометрия ряда
   ВАШИ и плитки не прыгает, счётчик читает «0/1» / «1/1»; у остальных зрителей — по-прежнему ▢▢.
5. Ключи (все — через Grep-инструмент перед добавлением; `${0}` = имя карты): ряд эффекта — скан дословно; `effect-short`
   **«A party effect from 1 delegate, not 2»** → RU «Эффект партии за 1 делегата, не за 2»; описание — «Requires the Reds to be ruling
   or that you have 2 delegates there.» (если голый ключ уже есть у TR30/TR32/TR33 — переиспользовать, не коинить); строки доступа
   при пороге 1: holds **«You have it: one of your delegates is on its resolution (${0}: one is enough)»** → «Доступен · ваш делегат на её
   резолюции («${0}»: достаточно одного)», lacks **«You do not have it — one of your delegates on its resolution would grant it (${0})»**
   → «Недоступен · один ваш делегат на её резолюции откроет его («${0}»)»; нота требования **«Card requirement of this party: not met —
   one delegate opens the effect, the requirement still asks for two»** → «Требование этой партии на картах: не выполнено — один
   делегат открывает эффект, требованию по-прежнему нужны два»; метка плитки **«Your effect · 1 delegate»** → «Эффект ваш · 1 делегат»;
   чип голоса **«Unlocks the party effect for you (1 delegate — ${0})»** → «Откроет вам эффект партии (1 делегат — «${0}»)»; нота
   композера **«Opens the ${0} party effect now: your delegate stands on ${1}»** → «Откроет эффект партии «${0}» сейчас: ваш делегат на
   «${1}»» и **«No party opens now — the effect starts with your first delegate on a resolution»** → «Сейчас ни одной партии: эффект
   начнётся с первого вашего делегата на резолюции»; журнал **«${0} holds the ${1} party effect: 1 delegate on ${2} (${3})»**. Фразы с
   «двумя» (существующие ключи) не переписывать — они верны при пороге 2.
6. **e2e: ОДИН новый спек** `tests/e2e/console-council-seat.spec.ts` + фикстура `council-seat` (новая механика — закон доступа; §5
   чеклиста), fhd + **4K обязательно**.
7. **Анонс «эффект партии получен / потерян» для ВСЕХ дорог** (второй делегат, смена власти, эта карта) — класс, которого нет
   (К-5): в батч владельцу с рекомендацией, не P0 карты; карта даёт свою строку журнала (правило 11) и живую сцену.
8. Словарь: новая фраза доступа — в `parliament-glossary.md` стр. 81 той же строкой (+ гард); «Место в совете» в инспекторе
   называется ИМЕНЕМ КАРТЫ в кавычках, не «картой».

### D1 — архитектура (почему порог, а не грант)
Правило карты — «достаточно одного», т. е. ЧИСЛО, а не «эффект есть». Грант (`granted`) живёт независимо от кубов и уходит только
по `revoke` — чтобы изобразить им «Место в совете», пришлось бы на каждое размещение / снятие / уход резолюции пересчитывать и
писать гранты (состояние, которое легко разъехаться с табло). Порог читается из табло в ТОЙ ЖЕ функции `access()`, где считают
`byDelegates`, состояния не добавляет, save/load не трогает, а сложение с будущим грантом (Septem Tribus) — обычное «∨». На
клиенте порог — поле модели: места ▢ рисуются по нему, фразы выбираются по нему, проекции сервер считает по нему.

---

## 0. Рабочее дерево
`git status` на момент выдачи: **чисто**, HEAD `633f5c5cec`. ListAgents перед стартом. Общие файлы (локали, `Parliament.ts`,
`ParliamentTypes.ts`, модели, документы, реестр — нумерацию делим с соседями: объявить номер ДО записи) — только через временный
индекс (`GIT_INDEX_FILE` абсолютным путём; после коммита `git reset -q` — основной индекс остаётся на старом HEAD), `git add` своими
путями; после коммита — `git restore --staged package.json package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr36`,
`TM_E2E_ROOT=.e2e-tr36`; 4K — `--workers=1`. Арт есть — импорт первым делом.

## 1. Сервер
**Хук (файл карты, инвариант 8):** `ICard.partyEffectDelegates?: number` — JSDoc: «Own delegates on ONE resolution that give this
card's OWNER the party's effect; the tableau's minimum wins, never below 1 and never above `PARTY_EFFECT_DELEGATES`; the card
REQUIREMENT never reads it (rulebook FAQ p.19)». `CouncilSeat.partyEffectDelegates = 1`.
**Парламент:** `Parliament.effectDelegatesOf(player): {count: number; source?: CardName}` — обход `player.tableau` (образец
`influence`, `:530–534`), `participates(…, 'party-effects')` false → `{count: PARTY_EFFECT_DELEGATES}`; `access()`: `byDelegates =
delegates >= effect.count`; `satisfiesRequirement = ruling || delegates >= PARTY_EFFECT_DELEGATES` (БЕЗ изменений по смыслу —
явной константой); `PartyAccess` + `PartyAccessModel` получают `effectDelegates: number` и `effectDelegatesBy?: CardName`
(`playerModel` — сборка); `projectVote` (`:343`) — `unlocksEffect` по `before.effectDelegates`, `:344` — как было;
`partyRequirementStanding` — как было (2). Комментарий константы (`ParliamentTypes.ts:100`) переписать: порог ТРЕБОВАНИЯ и порог
эффекта по умолчанию. Клиентский помощник `effectDelegatesOf(access)` (один на `consoleParliamentModel.ts`) — `access.effectDelegates
?? PARTY_EFFECT_DELEGATES` для старых фикстур.
**Карта** `src/server/cards/turmoilRedux/CouncilSeat.ts`: `CardName.COUNCIL_SEAT = 'Council Seat'`, манифест без `compatibility`;
ACTIVE, 6, `[Tag.MARS]`, `requirements: {party: PartyName.REDS}`, без `behavior`, без ПО; `metadata`: `cardNumber: 'TR36'`, `infoText`
`effect-short`, `renderData` — ряд эффекта (атомы выше), `description` — нижний блок. `cardPlayPreview(player)` co-located: ветка
`dynamic`-формы с шагами `note` — по партии области голосования, где `delegates ≥ 1 ∧ !hasEffect` («Opens the X party effect now:
your delegate stands on Y»), либо одна нота «No party opens now …»; гарды `cardPlayPreviewCoverage` / `consolePlayPreviewCoverage`
скажут, чего не хватает. `bespokePlay` — только журнал правила 11 (партии, открытые ЭТИМ розыгрышем = `hasEffect` до/после под
областью эффекта карты); состояние не трогать. Шапка — чтение скана, правила 1–12, D1 словами.
**Спек** `tests/cards/turmoilRedux/CouncilSeat.spec.ts` — правила 1–12 + : три партии / три эффекта разом; Красные с 1 кубом —
эффект есть, TR30 в руке «1 of 2» (`unplayableReasons` → `current 1`, `params[1] = '2'`); соперник при тех же кубах — 2; действие
партии в меню (`ParliamentHandler` — опция появляется) в тот же ход; wild-метка Учёных (`Tags.count`) с одним кубом; Unity-торговля
бесплатна с одним кубом; обновление сняло куб → эффекта нет; `access().granted` пуст, `grantedEffects` пуст после розыгрыша;
`projectVote` — правило 12; `partyEffectDelegates` на `fakeCard` × 2 → 1; сериализация. `Parliament.spec.ts` / `PartyEffects.spec.ts`
— новые случаи порога рядом с грантом (и переименование плейсхолдера, решение 3). Гарды §3 — ворклист пуст; `make:cards` 0 / 0 / 0.

## 2. Клиент
1. **Места ▢ по порогу зрителя**: `ConsoleParliamentVotingArea.vue:125–133` и `ConsolePartyPlaque.vue:99–103, :227–229` — `v-for`
   по-прежнему по `PARTY_EFFECT_DELEGATES` (две коробки в потоке), но место с `n > effectDelegates` — **VOID** (решение 4: та же
   идиома, что `voidEmpty` плитки), `--held` / «effect is yours» / «N/M» — по порогу зрителя. Переход 2 → 1 при розыгрыше — одна
   смена класса (память `coupled-motion-is-one-class-flip`), не unmount.
2. **Фразы по порогу:** `partyStateOf` (`:346`), `accessReasonRows` (`:432–451`), `voteAccessOf` (`:532`), чип `:589`,
   `resolutionInspectModel.ts:96, :132`, `PARTY_EFFECT_THRESHOLD` (`:1022` — убрать или сделать помощником). Параметр `${0}` — имя
   карты через существующий путь перевода имён карт (литерал имени в `src/client/**` запрещён).
3. **Стрип эффектов** (`ConsolePartyEffectsStrip.vue`): эффект, полученный по одному кубу, встаёт в стрип тем же путём — проверить,
   что стрип не называет основание словами «2 делегата» нигде (grep по ключам `parliament.json:202, 309`).
4. **Композер розыгрыша** — ноты из `cardPlayPreview` (§1) читаются строкой «Сработает»-класса; по правилу заимствованной
   поверхности (§7 чеклиста) — у ноты есть ли дверь / слой? Если слой R3 «Эффекты» строки не несёт — строка реестра, не молчание.
5. **Гард класса** (вес 1): `tests/console/parliamentThresholdGuard.spec.ts` — `PARTY_EFFECT_DELEGATES` в `src/client/**` импортирует
   только `consoleParliamentModel.ts` (помощник), в `.vue` — ни разу; плюс юниты `consoleParliamentModel.spec.ts` /
   `resolutionInspectModel.spec.ts` (помощники `access()` в четырёх спеках получают поле), `ConsolePartyPlaque` / `VotingArea`
   компонентные: порог 1 → одно живое место, второе VOID, «0/1».

## 3. Лицо, локаль, лор
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR36.png" TR36` → `npm run make:cards` (0 / 0 / 0). Лор —
`assets/text/lore_texts.json` ключ `"TR36"` = «Chair man of the bored.», RU — `src/locales/ru/lore_texts.json` (решение 2). Локаль —
перед КАЖДЫМ ключом Grep-инструментом (не `rtk grep`). RU (`turmoil_redux_cards.json`): имя; ряд «Эффект: вам достаточно 1 делегата
на резолюции, чтобы получить эффект её партии.»; описание — оборот TR35 без второго предложения; `card_info.json` — `effect-short`;
`parliament.json` — ключи решения 5. Бюджет RU-капшена мерить руками (гард модульный словарь не видит).

## 4. Тесты
Сервер — §1. Клиент — §2.5. **e2e — один новый** (решение 6): фикстура `council-seat` в `generate.ts` (`parliamentFixture`, образец
`martian-census` `:1665–1687` + карта в руке как у `re-settlement`): фаза действий синего, Зелёные правят по стартовому правилу
(ENACTED пуст), слоты **[резолюция Красных — ДВА куба синего (требование по делегатам), резолюция Учёных — ОДИН куб синего, третья —
без кубов синего]**, «Место в совете» в руке синего, M€ ≥ 6, у красного — куб на третьей (второй клиент); `expect` — чтение движка по
имени (TR14-стиль). Спек (fhd + 4K, `--repeat-each=4`, `{...NO_PAYMENT}`, state-waits):
(1) Парламент ДО: плитка Учёных «▢▢ 1/2», ряд ВАШИ без «эффект ваш», плитка действия Учёных — с причиной «Эффект этой партии вам
недоступен»; (2) рука → карта → композер: нота «Откроет эффект партии «Учёные» сейчас …» (строка — `toHaveCount(1)` ПРЕЖДЕ проверки
текста, урок TR33); (3) розыгрыш; **раскадровка** (`TM_E2E_STORYBOARD=1`) от A до покоя Парламента; (4) ПОСЛЕ: Учёные — одно живое
место, второе VOID, «1/1», «эффект ваш», плитка «Эффект ваш · 1 делегат», действие Учёных доступно; инспектор (X) Учёных — строка
holds с «Место в совете» и нота требования «не выполнено …»; инспектор Красных — holds с «Место в совете» И «требование: выполнено»
(2 ≥ 2); (5) режим голоса: третий слот — чип «Откроет вам эффект партии (1 делегат — «Место в совете»)» без чипа требования; слот
Учёных — чип требования без чипа эффекта; (6) второй клиент: у красного ▢▢, карта синего в «Разыграно»; (7) `reloadConsole` —
всё стоит. Регрессия соседей на своём снапшоте, до / после: `console-parliament`, `-v2`, `-gallery`, `-stability`,
`-chassis-parity`, `-vote-geometry`, `-vote-rivals`, `-actions` (плитки действий партий), `-reds-plaque`, `-bot`,
`console-info-parliament`, `console-martian-census`, `console-political-donation`, `console-nationalist-movement`,
`console-red-museum`, `console-extras-explorer`, `aaa-driver-canary`; `npm run e2e:affected`; гарды `e2eLiveness` + `e2eDriverGuard`.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**, затем fhd; Deck — только регрессия гардов)
Витрина EN / RU (ряд `[делегат] : [?]*`, плашка Красных, лор), рука: с требованием и без (причина «1 из 2» при одном кубе у Красных
— и ТУТ ЖЕ плитка Красных «Эффект ваш» после розыгрыша: кадр обеих поверхностей рядом), композер с нотами, раскадровка розыгрыша
(§4), обзор Парламента с тремя плитками в трёх состояниях, ряд ВАШИ, инспектор Учёных и Красных, режим голоса на обоих слотах,
стрип эффектов до / после, плитка действия Учёных до / после, второй клиент, журнал. Логи прохода — каждая строка находка.

## 6. ПОЛИРОВКА ПО ПУТИ — чеклист §7 и правило владельца
Реестр продолжает нумерацию (сейчас **PL-107**; соседи пишут параллельно — объявить номер ДО записи; новый раздел **N** —
маршрут «доступ к эффекту партии: порог · места ▢ · ряд ВАШИ · режим голоса · инспектор · стрип эффектов · рука с плашкой»).

**1. Минимум сверх P0 назван заранее:** **К-2** (такт «эффект ваш» — класс всех дорог), **К-5** (батч: анонс получения / потери
эффекта), **PL-022** и **PL-042** — воспроизвести на 4K (владелец: 4K первым).

**2. Открытые строки на маршруте — сперва воспроизвести:** PL-022 (4K: `.con-parl__info-party` сдвигается во время прогулки,
stability мигает 1 из 2) · PL-042 (досье скроллится: плотность описаний эффектов партий — на 4K 51 px без держателя) · PL-084
(бар композера ≈ 0.3 с над `committed` — задевает ли обычный розыгрыш без Парламента: нет, но проверить при розыгрыше этой
карты из руки) · PL-076 (нотификация соперника — только если карта даёт чипы; у неё их нет).

**3. Кандидаты, найденные при подготовке** (чтение кода, глазами НЕ подтверждено):
- **К-1 · Второе место ▢ уходит unmount-ом** — `ConsoleParliamentVotingArea.vue:128` `v-for="n in PARTY_EFFECT_THRESHOLD"`: при
  пороге 1 коробка исчезнет моргнув, ряд сдвинется. Решение 4 — VOID в потоке; это P0 карты, не полировка, но сцена — её.
- **К-2 · Момент «эффект ваш» без такта (класс всех дорог)** — `:133` `v-if` по счётчику, `--held` без перехода, `&__place--on` —
  смена `box-shadow` (`console_parliament.less:797–806`), плитка — слово `Your effect` сменой текста (`ConsolePartyPlaque.vue:253`).
  Второй куб садится (TR15/TR34 e2e), а что эффект СТАЛ ТВОИМ — не показано ничем, кроме появления текста. Премиум-слот: место
  зажигается мятным свечением на посадке куба (одна смена класса, `motionMs`), «ЭФФЕКТ ВАШ» входит фразой; при «Месте в совете»
  — тот же такт от розыгрыша. Чинить классом с A/B `console-martian-census` (куб-на-посадке).
- **К-3 · Чип голоса «(2 delegates)» в КЛЮЧЕ** (`consoleParliamentModel.ts:589`, RU `parliament.json:70`) — у владельца карты
  врёт; при пороге 1 — свой ключ (решение 5).
- **К-4 · Метка плитки «Your effect · 2 delegates»** (`:346`, RU `:202`) — то же.
- **К-5 · Нет анонса «эффект партии получен / потерян» ни у одной дороги** — свод §6.3-4 обещал уведомление с причиной; стрип
  меняется молча; с этой картой получение эффекта вне Парламента (из руки) становится обычным. Рекомендация в батч: событие
  `party-effect-gained` / `-lost` {party, basis: 'delegates' | 'ruling' | 'card', source} из `Parliament` (диф доступа после
  `placeVote`, принятия, обновления и розыгрыша карты с хуком), строка журнала + нотификация владельцу с CTA «Открыть Парламент»
  (класс CTA TR35); порядок чипов — PL-076.
- **К-6 · Нота инспектора «a granted effect does not count»** (`:450`, RU `:212`) — срабатывает по `hasEffect && !satisfiesRequirement`,
  т. е. и для порога; для него формулировка «выданный картой эффект» неточна → ключ решения 5 выбирается по `effectDelegatesBy`.
- **К-7 · Рука и Парламент — два числа одной партии** («1 из 2» и «Эффект ваш»): честно, но без моста читается как противоречие;
  мост — нота инспектора (К-6) и, возможно, одна строка в причине руки («эффект партии у вас есть; требованию нужны два») —
  решить по кадру 4K, предложить владельцу.
- **К-8 · `voteAccessOf.heldByOther`** (`:538–544`) — при пороге 1 и 1 кубе `byDelegates` true → ветка «уже ваш» не берётся,
  порог в `VoteAccessVm` должен быть зрителя — проверить юнитом, что «1 → 2» не рисует второе место.
- **К-9 · Стрип эффектов** — не называет основания; после карты у владельца может стоять 3–4 эффекта разом: влезает ли на fhd
  (4K — точно), не режет ли предок (`scrollWidth` против клипующего бокса, урок TR26).
- **К-10 · «Разыграно» соперника** — у карты без чисел карточка «player1 разыграл «Место в совете»» без чипов: не пустая ли
  (crossPlayerCoverageGuard скажет; кадр второго клиента).

Что из метода §7 не сработало или чего не хватило — поправить в чеклисте и сказать в отчёте.

## 7. Режим работы
**Коммиты карты**: (1) сервер — хук `ICard`, `Parliament.effectDelegatesOf` + `access`, модель, проекции, константа, карта + спек +
переименование плейсхолдера гранта (решение 3); (2) клиент — места / фразы / помощник / гард класса + юниты + локаль + лор + арт;
(3) e2e — фикстура + спек + `parliament-dense.json` перегенерированный; (4) документы — журнал § TR36, **`docs/TURMOIL_REDUX_COUNCIL_SEAT.md`**
(новый контракт «хук порога доступа» — его наследует будущая Septem Tribus / замена; §6 чеклиста), `docs/TURMOIL_REDUX_SPEC.md` строки
`:115` («предикат переписать» → сделано, порог) и §3.3, словарь стр. 81 (+ гард), чеклист §4 (строка «закон доступа — хук в файле карты»)
и §7 уроки, реестр раздел N, промт. **Коммиты полировки** — отдельно (`Polish (TR36 walk): PL-### — …`), каждая с «до / после» и
гардом. Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой —
`npm run make:css` + `npm run build:server`. **Не пушить.** Батч владельцу — одним `AskUserQuestion` после P0 и до остальной
полировки (К-5 и слабости принятых сцен — первыми, с кадрами ДО и предложением ПОСЛЕ).
Гочи: `coloniesExtension: true` в `testGame`; старый бандл новую карту не рисует — стенд на своей сборке; имена кадров скринкаста =
время получения (DOM-пробник 10 мс для порядка); `--grep "tr36 "` ловит describe; `python3` — заглушка Store; `eqeqeq` без исключения
для null; bash heredoc с длинным RU-текстом ломается — Write; `node -e` с бэктиками — Edit; нумерация реестра общая; `rtk grep` с
фиксированной строкой виснет — Grep-инструмент; `position: fixed` — контекст наложения (PL-101).
**В отчёте:** что встало само (действия партий, wild-метка, Unity, прогноз, досье — по `hasPartyEffect`), вердикты по моментам подачи
(§5) с кадрами 4K, батч владельцу и ответы, регрессия, гарды, новые ключи, подтверждение решений 1–8, арт. **Раздел «ПОЛИРОВКА»** —
с перечнем СОБСТВЕННЫХ находок сверх §6. **Явно — всё, что не получилось сделать, и почему.**

## 8. Нельзя
Грант вместо порога (`grantPartyEffect` в файле карты); порог в требовании (`satisfiesRequirement`, `partyRequirementStanding`,
`unlocksRequirement`, причина руки — всё остаётся 2); чтение табло по имени карты внутри Парламента (`cardIsInEffect(CardName.COUNCIL_SEAT)`
— хук в файле карты, Парламент читает хук); константа `PARTY_EFFECT_DELEGATES` в `.vue` или вторая константа на клиенте; `v-if`-исчезновение
места ▢; переписывание существующих ключей с «двумя» (они верны при пороге 2) и апстримного RU; литерал имени карты в `src/client/**`;
литерал кнопки контроллера; `title`; определение промпта по заголовку; `compatibility`; новое сериализованное поле; e2e «на ещё одну
карту» сверх одного спека; полировка только-для-Deck (PL-105); `shardPlan.json`; незакоммиченные файлы соседа; пуш и красные коммиты.
