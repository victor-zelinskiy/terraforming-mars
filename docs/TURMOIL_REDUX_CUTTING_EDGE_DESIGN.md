# Turmoil Redux · TR49 Cutting-Edge Design («Новаторская разработка»)

Карта проектов набора (2026-10-15). Впервые в наборе — **НОВЫЙ КЛАСС «ЭФФЕКТ НА ОДИН РОЗЫГРЫШ»**: карта, сыгранная
последней, взводит эффект, который тратит СЛЕДУЮЩАЯ карта этого поколения — любой дорогой розыгрыша, нужен он ей или нет;
пас, заканчивающий поколение игрока, его гасит. Сама TR49 — «игнорируйте все требования глобальных параметров при
розыгрыше вашей следующей карты в этом поколении»: новый ВИД модификатора требования — снятие, а не сдвиг.

Акцент владельца (дословно в промте): игрок, выбирающий карту, должен ясно видеть, какие такие эффекты активны; они стоят
в списке эффектов и осматриваются в «Сработает»; требование, подвластное эффекту, говорит об этом ВЕЗДЕ, где напечатано.

Промт: `docs/claude/prompts/project-tr49-cutting-edge-design.md`. Журнал: `docs/claude/turmoil-redux-cards-progress.md` § TR49.

## 0. Решения владельца

Батч `AskUserQuestion` (2026-10-15, после кадров концепций) **остался без ответа** — приняты рекомендации промта, каждая
перечислена здесь и в отчёте:
1. «Игнорировать» — **ВИД**, не число: `GlobalParameterRequirementBonus {waive: true}`; «магическое 50» удалено из карт
   скоупа (Ecology Experts больше не прибавляет 50 шагов — он снимает). Valuable Gases / Rogers / Anubis (вне скоупа) не
   тронуты — класс выдерживает их структурно (декларация шагов остаётся шагами).
2. Модель взведённого эффекта — **публичная** (`PublicPlayerModel.armedPlayEffects`); чтение «требование под эффектом» по
   карте — только своя рука (`CardModel.requirementEasing`, как `unplayableReasons`).
3. Полоса «ВЗВЕДЕНО» — **(а) у руки**: шапка альбома «Карты в руке» + сжатый двойник в доке; зеркало — секция в
   «ЭФФЕКТАХ» Информации.
4. Кассета требований под эффектом — **(а)**: смягчено (печатное значение стоит + эффективное), снято (красная диагональ в
   языке скана, `::after`, не `filter`), выполнено благодаря (✓ в торце).
5. Нота расхода (решение 7) — тон `info`, не блок и не подтверждение.

## 1. Сервер — одна модель, один читатель, одна запись

- **Декларации** (`src/common/cards/Types.ts`): `CardDiscount.nextCardOnly`; `GlobalParameterRequirementBonus {steps? |
  waive?: true, parameter?, nextCardOnly?}`. Карта скоупа — декларация, не код: TR49 `{waive: true, nextCardOnly: true}`,
  Special Design `{steps: 2, nextCardOnly: true}`, Indentured Workers / Conscription / Eccentric Sponsor —
  `cardDiscount {…, nextCardOnly: true}`, Ecology Experts — `{waive: true}` на карту, которую играет сама прелюдия.
- **Один источник «взведено»** — `IPlayer.lastCardPlayed` (одно публичное сериализуемое поле: один взведённый эффект за
  раз, новый розыгрыш ЗАМЕНЯЕТ взведённое); гасится пасом и «пустым» спонсором.
- **Один читатель** — `src/server/cards/armedPlayEffects.ts`: `armedPlayEffectsOf(player)` (что взведено) и
  `oneShotEffectsOf(card, player?)` (что карта взведёт — превью «ВЗВЕДЁТ»).
- **Одно чтение требования** — `IPlayer.requirementBonusBreakdown(parameter)` (сумма = `getGlobalParameterRequirementBonus`)
  + `IPlayer.globalRequirementWaiver(parameter)`; `GlobalParameterRequirement.satisfies` — сначала снятие;
  `effectiveThreshold: number | 'waived'`. Модель для клиента — `models/requirementEasing.ts`
  (`requirementEasingOf(player, card)`: ключ блока правил, печатное, эффективное, текущее, источники с `oneShot`, `met`,
  `decisive`).
- **Прогноз розыгрыша** — `models/armedPlayForecast.ts` (`armedPlayForecastOf(player, card)` → `{consumes: [{armed,
  used}], easings}`) в `EffectForecast.modifiers` (только розыгрыш карты); скидка-однократка помечена
  `EffectForecastDiscountItem.oneShot`; превью взводящей карты несёт `ActionPreview.arms`.
- **Запись** — событие `requirement-eased` (тег пассивного эффекта, видно в журнале), агрегатный канал `'requirement'`,
  счётчик срабатываний в `effectOverlayStats`; строки лога «${0} met the ${1} requirement of ${2} thanks to ${3}: ${4} → ${5}»
  и «${0} ignored the global requirements of ${1} thanks to ${2}».
- **Постоянные модификаторы** (Inventrix, Adaptation Technology, Morning Star) говорят тем же языком (`oneShot: false`).
- **Гард класса** — `tests/cards/armedPlayEffectCoverage.spec.ts`: каждая карта, чей текст говорит «next card» / печатает
  `IGNORE_GLOBAL_REQUIREMENTS`, объявляет класс декларацией (исключения с причиной: `NOT_AN_ARMED_EFFECT`); паритет
  превью ↔ исполнение.

## 2. Клиент — где игрок встречает класс

| Поверхность | Что видно | Где |
| --- | --- | --- |
| Шапка альбома руки | «⚡ ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ · [арт] источник · значок/плашка · формула · до следующего розыгрыша» | `ConsoleArmedEffectsStrip` (`strip`) в `ConsoleHandSection` |
| Док | «⚡ ±2» / «⚡ [струк] ТРЕБ.» / «⚡ −8» на месте подписи «КАРТЫ» («⚡ ТРЕБ. 4/4»: низкая трапеция плиты резала чип сбоку и сверху) | тот же компонент (`chip`) в `ConsoleHandDock` |
| Плитка руки | плашка: значок шкалы (перечёркнутый при снятии) + шаги, ✓ если выполнено благодаря | `handEasingPlate.ts` |
| Кассета лица (рука · герой композера · зум) | смягчено / снято (диагональ) / решающее (✓) | `PremiumRequirementsBar` + `premiumCardViewModel.withEasing` |
| Вердикт доступности и панель зума | «✓ Можно разыграть · благодаря: …»; блокированная — нота модификатора | `cardAvailability.ts` (`eased`) |
| «ДЛЯ ВАС» / панель правил | строка под напечатанным требованием «Под эффектом: … / Снято: …» | `composerRequirementRow.withRequirementEasing` |
| Композер розыгрыша | строка «ТРЕБОВАНИЕ»: печатное · эффективное · сейчас · вердикт · кто; нота расхода впустую; «ВЗВЕДЁТ НА СЛЕДУЮЩУЮ КАРТУ» в результате; голова оплаты называет скидку-однократку («⚡ 1× Законтрактованные рабочие») | `ConsolePlayCardConfirm`, `consolePlayCardResult` (`armed`), `ConsolePaymentPanel` |
| «Сработает» | чип модификатора первым (приглушён и зачёркнут, если расходуется впустую) | `ConsoleForecastRow` (`modifier`) |
| R3 «Эффекты» | группа «Модификаторы розыгрыша», плитка с пятью вопросами | `effectForecastModel.modifierItemsOf`, `ConsoleEffectsExplorer` |
| Информация · «ЭФФЕКТЫ» | строка зоны «Взведено на следующую карту N» + секция над обозревателем (и у соперника — модель публичная) | `ConsoleInfoMode`, `ConsoleArmedEffectsSection` |
| Журнал / нотификация соперника | строка `requirement-eased` с бейджем; строки в карточке нотификации | `journalEventChild`, `notificationModel` |

Все слова — из одного форматтера `console/requirementEasingText.ts`; все числа — сервера.

## 3. Физика — два полёта (`console/armedEffectFlight.ts`, слой `ConsoleArmedFlightLayer`)

Жетон — капсула чипа дока («⚡» + значок / зачёркнутая плашка), не голая плашка (та сливалась с напечатанной плашкой
карты на 4K). Оба играются в такте ОТГРУЗКИ сцены посадки (`consolePlayedHero.shipPrice`), пока карта стоит в композере, жетоном —
собственным значком эффекта, директором `resourceTransferDirector` (рождение на источнике, дуга, касание):
- **РАСХОД** — с чипа дока в кассету требований карты (скидка — в значок цены); чип исчезает на ОТЛЁТЕ.
- **ВЗВОД** — с напечатанной плашки лица карты (снятие — `.pcard-plate--waived`, сдвиг — `.pcard-plate`, скидка —
  `.pcard-mi--mc`) в чип дока, который до касания нарисован невидимым (его бокс — адрес); никогда с тела карты.
Сначала расход, потом взвод. Обычный розыгрыш: такт идёт ДО коммита с уже известным ответом — модуль читает дифф двух видов
сам и представляет на шаг вперёд вида; блок коммита отпускает удержания (`releaseArmedEffectHolds` из
`seedPlayedHeroRewardHold`). **Staged-розыгрыш** (тайл ставится до POST — Lake Marineris): ответа ещё нет — расход летит в
ритуале посадки по ПРОГНОЗУ сервера (`StagedPlayArm.armedSpends` ← `forecast.modifiers.consumes`), чип скрыт до конца
staged-розыгрыша (`clearStagedPlay` — коммит или отмена; отмена возвращает чип — эффект снова взведён). Нет видимого конца —
нет полёта (след `armed-flight-trail` называет причину); reduced motion — без полётов. Бюджет страховки сцены расширен на
две волны.

## 4. Тесты

Сервер: `tests/cards/armedPlayEffects.spec.ts`, `armedPlayEffectCoverage.spec.ts`, `tests/models/requirementEasing.spec.ts`,
`tests/events/requirementEased.spec.ts`, `tests/cards/turmoilRedux/CuttingEdgeDesign.spec.ts`, спеки пяти карт скоупа.
Клиент: `tests/client/console/armedEffects.spec.ts` (полоса, плашка, доступность, кассета), `armedPlayClass.spec.ts`
(прогноз, композер, раздел результата, голова оплаты, удержания полётов). e2e: `tests/e2e/console-cutting-edge-design.spec.ts`
(фикстуры `cutting-edge-design` · `special-design-armed` · `indentured-workers-armed`; A — путь на fhd + tv4k со свидетелем
жетонов и вторым клиентом; B — решающий ±2 и расход впустую; C — скидка в голове оплаты).

## 5. Известные границы

- Playwrights (community, вне скоупа): читатель снятия смотрит и в `removedFromPlayCards` (спек правила 14 — снятие
  читается, когда `lastCardPlayed` называет переигранную копию); выставляет ли сама Playwrights `lastCardPlayed` при
  переигрывании — поведение апстрима, сквозным розыгрышем не проверено (строка реестра AL).
- Хостимый альбом прелюдии (Ecology Experts / Eccentric Sponsor играют «следующую карту» внутри стартового workspace): полоса и
  кассеты — тот же хост-агностичный компонент и та же модель, но кадром не осмотрено (строка реестра AL).
- Карта на столе (стопка «Разыграно», журнал) печатает требование как есть — после розыгрыша оно ничего не решает.
- Чужие карты и журнал не получают `requirementEasing` (self-only).
