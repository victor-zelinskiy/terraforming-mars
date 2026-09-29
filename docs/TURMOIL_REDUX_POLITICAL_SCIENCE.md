# TR02 · Political Science («Политология») — хук, который стреляет ЗАСЕДАНИЕ, и требование «делегаты на резолюциях»

**Статус: СДАНА 2026-09-30.** Четвёртая карта проектов набора Turmoil Redux (после TR09, TR08, TR66). Печатный
текст: «Требуется не менее 3 ваших делегатов на резолюциях в области голосования. Эффект: когда ваши делегаты
сбрасываются с непринятых резолюций, положите на эту карту 1 единицу данных за каждого сброшенного делегата.
Действие: потратьте 3 единицы данных с этой карты, чтобы взять карту.» Стоимость 8, метки Наука + Земля, ACTIVE,
ресурс карты — data, ПО нет.

Вес карты не в правиле, а в трёх контрактах, которые она заложила первой и которые наследует любая следующая
карта набора с делегатами или data:

1. **пер-карточный хук, который зовёт ЗАСЕДАНИЕ** — `ICard.onDelegatesDiscarded` + триггер `'delegates-discarded'`
   + событие журнала обновления `card-effect` (§2);
2. **новый вид требования** `RequirementType.DELEGATES_ON_RESOLUTIONS` — дескриптор `{delegatesOnResolutions: N}`,
   тропа `DELTA_POSITION` точка в точку (§3);
3. **первый ДЕРЖАТЕЛЬ data в Redux-скоупе** — до неё data только платили (действие Учёных, Medical Database);
   именно эта предпосылка держала Diverted Research в очереди `skip\` (§4).

Промт: `docs/claude/prompts/project-tr02-political-science.md`. Файл карты:
`src/server/cards/turmoilRedux/PoliticalScience.ts`. Спек: `tests/cards/turmoilRedux/PoliticalScience.spec.ts`
(31 проверка). Чеклист набора: `docs/claude/turmoil-redux-card-checklist.md`; журнал:
`docs/claude/turmoil-redux-cards-progress.md`.

---

## 1. Правила чтения (каждое закреплено спеком)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Триггер — ТОЛЬКО шаг `refresh` заседания: две непринятые резолюции уходят из области, их делегаты идут домой. Один вызов хука на игрока на каждую ушедшую карту, `count` = его делегатов на ней; нейтральные не считаются | `ParliamentPhase.stepRefresh` → `fireDelegatesDiscarded` |
| 2 | ПРИНЯТАЯ резолюция не считается: её делегаты тоже идут домой (`stepEnact`, `summary.returned`), но она принята — хук не зовётся | спек «rule 2»: 2 делегата на победившей → 0 data |
| 3 | ФИНАЛЬНОЕ поколение — сбора нет: `drive()` при `final` идёт `effects → adjourn`, `stepRefresh` не выполняется, делегаты остаются на картах. Карте нечего дать после финала (ПО нет, добор бесполезен) | спек «rule 3»: `votesOf(p1) === 2`, 0 data, событий нет |
| 4 | Снятие делегата в кресло Председателя (`Parliament.removeLatestVote` из `ChairmanSeat`) — ПЕРЕМЕЩЕНИЕ, не сброс: резолюция ещё на голосовании | спек «rule 4»: 0 data |
| 5 | Требование = `Parliament.votesOf(player)` — делегаты на ТРЁХ местах области голосования; лобби, кресло и запас не считаются (то же число, что «На резолюциях» инфо-панели) | `PoliticalOps.delegatesOnResolutions` → `DelegatesOnResolutionsRequirement` |
| 6 | Data на карте — обычные data: действие Учёных и Medical Database видят карту как держателя (`getResourceCards(DATA)`); тратит их только собственное действие; data — НЕ платёжная единица | спек «a HOLDER of data» |
| 7 | Действие декларативное: `{spend: {resourcesHere: 3}, drawCard: 1}`; при < 3 data авто-причина «Not enough resources on this card» (`type: 'count'`, `current`) | `ActionCard` + `actionUnavailableReasons` |
| 8 | Сбор идёт через `player.addResourceTo(this, {qty, log: true})` внутри `events.withEffect(player, card, 'delegates-discarded')` — журнал, нотификации и статистика видят ИСТОЧНИК-карту; лог `${0} added ${1} ${2} to ${3}` | спек «the collection is LOGGED…» |
| 9 | Повестка СЛЕДУЮЩЕГО поколения сбором не двигается: `stepEnact` ставит `setQuestFromEnacted(gen + 1)` ДО refresh, но `QuestTracker.eligible` отказывает любой мутации, чей корень — политическая фаза (`FOREIGN_ROOT_CATEGORIES`) | спек «rule 9»: квест «2 data» у принятой → прогресс 0 после 3 собранных |
| 10 | Reload посреди заседания не удваивает сбор: `stepRefresh` идемпотентен по ключу `refresh:<gen>`, хук зовётся внутри | спек «rule 10»: сейв с курсором, откаченным на `refresh`, → data 3, журнал тот же |

**Чтение скана.** Фигурка делегата в оранжевой плашке «MIN» у цены — ТРЕБОВАНИЕ; в углу две метки (атом + Земля).
Фиолетовый шестиугольник со стрелкой внизу слева — значок Turmoil («нужен политический движок»): для карты
Redux-манифеста это сам модуль (ворота колоды — `GameCards`), **`compatibility: 'turmoil'` не объявляется** (в этом
форке маркер означает «апстрим-карта, адаптированная к движку» и требует `politics: 'redux'`).

## 2. Контракт «хук, который стреляет заседание» (наследуют следующие карты набора)

### 2.1 Хук
```ts
// ICard.ts — рядом с getInfluenceBonus?
onDelegatesDiscarded?(player: IPlayer, count: number, context: {instance: ResolutionInstanceId, resolution: ResolutionId}): void;
```
Зовётся ТОЛЬКО из `ParliamentPhase.fireDelegatesDiscarded` (внутри `stepRefresh`, после `journal.push({kind: 'leave'})`
и лога «Resolution … leaves the voting area»): для каждой записи `returned` с владельцем-ИГРОКОМ (`'NEUTRAL'`
пропускается), для каждой карты `player.tableau` с хуком — один вызов под
`game.events.withEffect(player, card, 'delegates-discarded', …)`. Хук ТОЛЬКО собирает; он не пишет журнал и не
знает о заседании ничего, кроме контекста.

Запрещено: звать хук из `stepEnact` (принятая карта), из `removeLatestVote` (кресло), в финальном поколении
(refresh не выполняется), из карты напрямую.

### 2.2 Триггер `'delegates-discarded'` (`EventTrigger`)
Новое слово в `common/events/GameEvent.ts`. Единственный исчерпывающий потребитель — `TRIGGER_LABEL` в
`notificationCauseView.ts` («for delegates discarded off an unenacted resolution» → «за делегатов, сброшенных с
непринятой резолюции»); статистика (`EffectStatChannel = EventTrigger`) и `effectFamily` его не перечисляют.

### 2.3 Событие журнала обновления `card-effect`
```ts
{kind: 'card-effect'; player: PlayerId; card: CardName; resource: CardResource; count: number; instance: ResolutionInstanceId}
```
`stepRefresh` замеряет `card.resourceCount` ДО и ПОСЛЕ вызова и пишет ДЕЛЬТУ — хук может быть у любой карты с любым
ресурсом; дельта 0 — события нет. Событие стоит СРАЗУ ПОСЛЕ своего `leave`. Цепочка модели: `ParliamentModel.ts`
(`player` → `Color`), `common/models/ParliamentModel.ts`. Реплей `ParliamentRenewal.spec.ts` игнорирует его (стол
не меняется), но требует, чтобы оно следовало за `leave` той самой карты; посев `parliamentSittingSeed.ts` для него
холда не заводит.

### 2.4 Такт «Обновление» на клиенте (где рождается чип)
Табло карт во время заседания не видно; видимая сцена сбора — плашка ЗАПАСА владельца, куда только что сели его кубы.
- `BandRenewalCue.kind` + `cueOf` + `renewalLine`: строка ленты `[игрок] · Данные N · Политология` (чипы
  `player` / `count{key: <CardResource>}` / `label{key: <CardName>}` — имя карты легитимный i18n-ключ; прозы нет).
- `sittingDirector.beatRenewal`: ответы на `leave` = идущие сразу за ним `card-effect` (`answersOfLeave`). Кубы летят
  как раньше; на посадке ПОСЛЕДНЕГО куба владельца с этой карты (`launchLeaveReturns` → `landed`) рождается жетон
  (`launchCardEffectToken` → `parliamentFlights.riseToken`): иконка ресурса (`iconClassFor(cardResourceIconKey(res))`)
  + «+N» на стеклянной плашке над `[data-parl-seat-reserve="<color>"]`, подъём на ширину ладони, чтение, растворение
  (`TOKEN_RISE_MS` = 960 базовых мс, easing GSAP, никаких таймеров). Полёт регистрируется в `runState.flights`
  (`data-parl-flight-body="token"`, `data-parl-token-amount`), «дожать» доводит его до конца; нет измеримой плашки →
  `noteDegraded('card-effect of …')` (`data-renewal-degraded`), никогда молча.
- Порядок ленты строго журнальный: `leave → card-effect → leave → …`. Кий `card-effect` ставится на момент посадки;
  карта уходит по своему обычному расписанию (её лента-снимок иначе показала бы севшие кубы дважды), а СЛЕДУЮЩИЙ ход
  такта ждёт прочтения ответа (`CARD_EFFECT_READ_MS` = 520).
- Слой: `ConsoleParliamentFlightLayer.vue` (`tokenFlights`), стиль `.con-parl__flight--token` в
  `console_parliament.less`.

## 3. Требование «делегаты на резолюциях» — тропа из восьми точек

| # | Точка | Что |
| --- | --- | --- |
| 1 | `common/cards/RequirementType.ts` | `DELEGATES_ON_RESOLUTIONS = 'Delegates on resolutions'` (подсекция `// Turmoil Redux`) |
| 2 | `common/cards/CardRequirementDescriptor.ts` | поле `delegatesOnResolutions?: number` + ветка `requirementType()` |
| 3 | `server/cards/requirements/CardRequirements.ts` | `compileOne` → `new DelegatesOnResolutionsRequirement({...d, count: d.delegatesOnResolutions})` |
| 4 | `server/cards/requirements/DelegatesOnResolutionsRequirement.ts` | `InequalityRequirement`, `getScore = game.politics?.delegatesOnResolutions(player) ?? 0`; фасад `PoliticalOps.delegatesOnResolutions`: Redux → `parliament.votesOf(player)`, Classic → 0 (области голосования нет; честно, а не «партии вместо неё») |
| 5 | `server/cards/Card.ts` | `populateCount` → `?? requirement.delegatesOnResolutions` |
| 6 | `server/tools/cardInfo/buildCardInformation.ts` | `Requires ${enCount(n, 'delegate', 'delegates')} of yours on resolutions in the Voting Area.` (ветка `max` симметрична) |
| 7 | `server/models/unplayableReasons.ts` | `{type: 'count', message: 'Requires ${0} delegate(s) on resolutions', params, current}` + `FULLY_RESTATED_REQUIREMENTS` |
| 8 | клиент | `premiumCardViewModel.REQUIREMENT_RENDER` → `assets/misc/delegate.png` + число (как напечатано; `PARTY_LEADERS` носит ту же иконку — различие в строке правил); `unplayableReasonFormat.COUNT_MESSAGE_LABELS` → `'On resolutions'` (существующий ключ «На резолюциях») — компактный счётчик руки «На резолюциях 1/3» |

Гарды, которые узнали сами: `requirementProse.spec.ts` (субъект `/delegates? of yours on resolutions/i`),
`cardInformation.spec.ts`, `premiumCardViewModel.spec.ts`, `unplayableReasonFormat.spec.ts` (новый), спек тропы
`tests/cards/requirements/DelegatesOnResolutionsRequirement.spec.ts` (дескриптор → класс → фасад → строка → причина;
лобби / кресло / запас не считаются; классика 0; стол без движка 0 без падения).

## 4. Решения

- **Финал без сбора** (правило 3) — принято чтение «карте нечего дать после финала»; спек закрепляет 0 data и
  отсутствие событий.
- **Кресло — не сброс** (правило 4).
- **Фасад для классики = 0** — карта Redux-only, ворота — модуль; фасад не притворяется партиями.
- **Имя «Политология»** (запасной вариант «Политические науки» не понадобился).
- **Порядок такта:** кий и жетон — на посадке; карта уходит по старому расписанию; следующий ход ждёт чтения.
  Вариант «карта ждёт жетона» пробовался и показал севшие кубы на снимке ленты карты второй раз — отвергнут.
- **Diverted Research НЕ реализована**: её предпосылка («держатель data в скоупе») с TR02 выполнена, очередь `skip\`
  разбирает владелец (`TURMOIL_REDUX_SPEC.md` §4.1).
- **`effect-short`** «Delegates off unenacted resolutions: +1 data each» → RU «Делегат сброшен с непринятой резолюции:
  +1 данные» (бюджет 52 символа измеряется по RU; первая формулировка была 53).

## 5. Консоль — что проверено глазами и e2e

`tests/e2e/console-political-science.spec.ts` (фикстура `political-science-assembly`: у синего карта в табло, 2 его
делегата на проигравшей Зелёных, красный выигрывает Архитектурную премию тремя; `stopAt: 'assembly'`, один A играет
прогулку) — **5/5 зелёных** (1 + `--repeat-each=4`, ~27 с прогон), пробник `MutationObserver` + `setInterval`,
`waitForTimeout` = 0: (1) оба куба синего сели в его запас (видимый); (2) ПОСЛЕ последней посадки над плашкой запаса
родился жетон «+2», поднялся монотонно и растворился; (3) строка ленты содержала «Политология» и «Данные 2»;
(4) `data-renewal-degraded` не появлялся; (5) сервер: на карте 2 data, `renewal` несёт `card-effect` count 2 сразу
после `leave` Зелёных; (6) карта табло на проводе `resources: 2` — то самое число, что рисует капсула премиум-лица.

Кадры (временный пробник, fhd; `screenshots/political-science/`, не в git): лицо на витрине (Наука + Земля, чип
«[делегат] ≥ 3», ряд «3 data → карта», ряд «[делегат перечёркнут]* : data», без бейджа ПО); рука с 1 делегатом на
резолюциях — «Политология ✕ Нельзя разыграть · На резолюциях 1/3»; жетон «+2» над плашкой запаса и лента
«ОБНОВЛЕНИЕ · player1 · ДАННЫЕ 2 · Политология»; композер «ДЕЙСТВИЯ КАРТ › ПОЛИТОЛОГИЯ › НАСТРОЙКА» с чипами
«3 → 0 на этой карте» / «+1 взять» и хендоф «› ДОБОР КАРТ» с капсулой источника «0».

## 6. Гэпы

- `ParliamentPhase.spec «with MarsBot (politics)»` покраснел от сдвига сидированной сдачи (TR02 в колоде): проверка
  «делегаты бота дома» стояла ПОСЛЕ цикла, где бот уже мог проголосовать первым ходом 6-го поколения. Перенесена
  внутрь цикла (после каждого заседания) — класс, не экземпляр.
- Значок «+2» рождается над плашкой запаса в шапке и поднимается в зону строки состояния — читается, но тесен;
  если следующая карта с data сделает такие сборы частыми, стоит рассмотреть посадку жетона в ряд ленты.
