# TRP2 · Unity Campaign («Кампания Союза») — первая из шести кампаний Popular Support

Прелюдия Turmoil Redux (2026-10-28). Скан `Prelude_-_TRP2.png`: магентовая плашка PRELUDE, метка ЮПИТЕР, без цены, требования и ПО;
ряд «3 [титан] · [колония] · 3 [нейтральный делегат] + эмблема Союза» — «(Gain 3 titanium. Place a colony. Add 3 neutral delegates to
Unity's Popular Support Area.)». Метки на левой кромке: ▲ Колонии и фиолетовый ромб Turmoil. Лор: «"The real foible is to get two people
to want the same thing at once." — Polish saying» (кредит арта «Shannon Brocas»).

Файлы: `src/server/cards/turmoilRedux/UnityCampaign.ts` (карта) · `PopularSupportCampaign.ts` (класс кампаний) · спек
`tests/cards/turmoilRedux/UnityCampaign.spec.ts` · манифест `preludeCards` (`compatibility: ['prelude', 'colonies']`) · e2e
`tests/e2e/console-unity-campaign.spec.ts` (TIMING).

## 0. Главный вопрос правил — делегаты НЕ идут на резолюцию Союза, даже если она на голосовании

Свод v1.0:
- p.9 «Popular Support»: области «**temporarily house** neutral delegates»; «When **new** resolution cards get added to the Voting area,
  neutral delegates are moved to them as instant votes».
- p.11 шаг 5 «Refresh Voting Area»: «check if the **three newly added cards** belong to parties that have neutral delegates in their
  Popular Support areas. If they do, move all of them to matching cards».
- p.13: «Neutral delegates are added to Popular Support areas … These then get added to **newly drawn** resolutions as instant votes».

Карта говорит «в область Popular Support», не «на резолюцию». Карта, которая уже лежит на голосовании, — не «новая», а единственный
перенос из области — обновление области голосования (в движке: `ParliamentPhase` → `moveSupportToSlot`, других вызовов нет). Сёстры
печатают то же разделение: TR31 называет «каждую резолюцию И каждую область» как два места, TR03 кладёт 3 нейтрала в область той самой
партии, за чью резолюцию только что проголосовали.

Что это значит на столе (поколение 1, старт):
| Резолюция Союза в зоне голосования | Что происходит в конце поколения 1 | Куда уходят 3 нейтрала |
| --- | --- | --- |
| есть и ПРОИГРАЛА | шаг 2: Союзу +1 (или +2, если на карте есть делегат игрока) — область уже 3/3, излишек сброшен; шаг 5: обе проигравшие уходят, сдаются 3 новые | на новую карту Союза, если её сдали; иначе ждут дальше |
| есть и ВЫИГРАЛА | Союз правит; шаг 5 не сдаёт карту правящей партии | ждут, пока Союз не потеряет ENACTED и не придёт его следующая карта |
| нет | шаг 2: Союзу +1 — излишек; шаг 5 может сдать карту Союза | на неё, если сдали |

Закреплено спеком (rule 1, включая прогон реального заседания `endGenerationThroughParliament`).

## 1. Сервер — три существующих движка

- `stock: {titanium: 3}` и `colonies: {buildColony: {}}` — декларации (общий `BuildColony`: пик, бонус, тайлы); без тайла колонии прелюдия
  неразыгрываема (гейт Executor — «сгорает», закон Early Colonization).
- Поддержка — общий шаг митинга TR31 (`RallyNeutralDelegates`) с печатью `{perResolution: 0, perArea: 3, recount: false}`:
  - **`RallyPrint.recount`** (новое поле): платит ли карта пересчёт нейтралов «в игре» (TR31 — да, M€; кампании — нет). Запись
    `lastRally.recount` / план `NeutralRallyModel.recount`; `megacredits = 0` без пересчёта.
  - печать без голосов не судит зону голосования: партия без резолюции не попадает в `missing` (иначе композер печатал бы «резолюции
    на голосовании нет» о голосе, которого карта не печатает).
  - выплата — `payPopularSupport` (общий писатель TR03/TR31): потолок 3 и общий запас; «меньше трёх» — строка журнала «(3/3)»,
    «ноль» — названный пропуск; прогноз называет потолок (`limit`).
- **Печатный порядок**: поддержка отложена на `BACK_OF_THE_LINE` — после колонии и всего, что колония вызвала (бонус Redux-Венеры «2
  делегата на резолюцию» спрашивается раньше). Запись митинга едет в ответе на ПОСЛЕДНИЙ вопрос.
- Класс `PopularSupportCampaign` (база `PreludeCard`): `campaignParty`, `bespokePlay` (отложенный митинг), `cardPlayPreview` (чипы
  поведения + «+3 [нейтрал] · в Народную поддержку», шаги поведения + SHOW-шаг `neutralRally`). TRP3…TRP7 — одна декларация каждая.

## 2. Консоль — третий хост митинга: СТАРТ

До TRP2 митинг игрался только внутри руки (TR31). Теперь `NeutralRallyHost = 'hand' | 'parliament' | 'start'`:
- `neutralRallyHostFor()`: рука со спуском → `hand`; **открытие (`workspaceFrameKnown('start')`) → `start`** — как бы ни стоял Парламент
  над ним (свой шаг сцены или вложенный в шаги розыгрыша, голосование бонуса Redux-Венеры внутри колоний: у «отдельного Парламента»
  нет проигрывателя митинга, он бы только спрятал кубы); иначе отдельный Парламент.
- `startHostedStepToEnter()` → `'walk' | 'rally'`; оболочка — `startHostedStepDue` (ждёт `workspaceHostForStep() === 'start'`, т.е. пока
  кадр колоний уйдёт, **и пока не отыграет СЦЕНА РЕАКЦИИ** — `cardReactionState.phase === 'idle'`) → `enterStartHostedStep(kind)` кладёт
  Парламент сценой старта на стадии записи («ДЕЛЕГАТЫ»). Ожидание реакции найдено стендом: бонус колонии Ио (+1 пр. тепла) будит
  правящих Зелёных (их ответ — M€-производство), и хартия Зелёных поднималась поверх колонки партий ровно в момент полёта первого куба
  (холд реакции notification-only — `admits` его не видит). Порядок сервера — ответ стола раньше митинга, и консоль играет так же.
- Секция Парламента: `playsHostedStepOf(host, stage)` — шаг руки = встроенная секция; шаг старта = кадр, поставленный стартом НА СТАДИИ
  ЭТОЙ ЗАПИСИ (оверлей, никогда не embedded). Так же исправлена латентная дыра TRP1: дорога «без голосования» (`enterStartWalkStep`)
  ставила кадр, но поза ходьбы не открывалась (`walkOwedSeq` требовал `embedded`). Дорогу «голосование → Карьера» стадия кадра
  защищает: там поза открывается рукой оболочки после посадки кубов (`continueStartWalkInPlace`).
- **Фраза без пересчёта** (`neutralRallyDirector`): `recount: false` → ГОЛОСА (нет) → ПОДДЕРЖКА (куб за кубом на плашку Союза) → ЧТЕНИЕ;
  ни ПЕРЕСЧЁТА, ни МОНЕТЫ, чип «в игре» на ленте не рисуется, ряд M€ не держится. Курсор — на зоне голосования, как у TR31: курсор на
  зоне партий раскрывает досье сфокусированной партии поверх колонки — над теми самыми плашками, куда садятся кубы.
- Стенд `console-unity-campaign` (TIMING, tv4k): реальный старт через UI; свидетели из зонда до нажатия — один Парламент, ни одного
  кадра Парламента при стоящем шаге колоний, такты `support → read` без `count/coin`, плашка Союза рисуется 0 → 1 → 2 → 3, плашка СВЕРХУ
  по хит-тесту во время посадок и **ни одного лица реакции на экране** в это время (лицо реакции `pointer-events: none` — хит-тест его
  не видит, поэтому отдельный свидетель). ⚠ Общее зеркало `assets/` бокса между клонами (last-writer-wins): прогон с английским именем
  карты и заглушкой арта — чужие ассеты, не продукт (перепрогнать).
- Композер руки (на случай розыгрыша кампании из руки): строка «В игре N → M» и поглощение M€ SHOW-шагом — только при пересчёте
  (у TRP4 «Gain 18 M€» — свои M€ карты).

## 3. Попутно — метка TRP1

Лист прелюдий (`Printables/Preludes 1.png`) показывает, что кружки в углу — МЕТКИ: у TRP5 растение + микроб, у TRP6 две Науки, у TRP3
Марс + Город + Здание. Значит, красная планета TRP1 — метка МАРСА (сдан 2026-10-27 «без меток» — исправлено: `tags: [Tag.MARS]`).

## 4. Что дальше получают TRP3…TRP7 даром / что потребует руки

| Даром | Требует руки |
| --- | --- |
| класс `PopularSupportCampaign` (`campaignParty` + `behavior`), запись, хост старта, фраза без пересчёта, прогноз | TRP3 «Place a city tile» — шаг размещения на старте перед митингом (проверить уход доски в старт); TRP4 «Draw a card» — добор старта + митинг; TRP5 «Gain 2 TR» — РТ-чипы старта |

## 5. TRP3 · Mars First Campaign («Кампания «Марс вперёд»») — вторая кампания (2026-10-28)

Скан `Prelude_-_TRP3.png`: метки МАРС + ГОРОД + ЗДАНИЕ; ряд «[город] · [пр. стали] · 3 [нейтрал] + эмблема «Марс вперёд»» —
«(Place a city tile. Increase your steel production 1 step. Add 3 neutral delegates to Mars First's Popular Support Area.)». На кромке
только ромб Turmoil (▲ нет) → `compatibility: 'prelude'`. Лор: «In the face of squalor all ideologies are equal.» (кредит арта
«marssociety.org»). Файлы: `turmoilRedux/MarsFirstCampaign.ts` (одна декларация над классом), спек
`tests/cards/turmoilRedux/MarsFirstCampaign.spec.ts`, e2e `tests/e2e/console-mars-first-campaign.spec.ts` (TIMING).

- Сервер — даром: `city: {}` (обычные правила города; нет легальной клетки → прелюдия неразыгрываема) + `production: {steel: 1}` +
  митинг кампании за городом (BACK_OF_THE_LINE — клетка и её бонус раньше кубов).
- Консоль — даром: старт уступает поле размещению города (кадр старта остаётся в стеке, сцена прячется «по краске»), запись митинга
  едет в ответе на клетку с хостом `start`, шаг «ДЕЛЕГАТЫ» встаёт, когда старт снова вершина стека (`workspaceHostForStep`), допуск
  `followUp` открыт и реакция отыграла. Стенд — тот же, что у TRP2, с размещением на поле вместо шага колоний (свидетель «ни одного
  кадра Парламента, пока стоит размещение»).

## 6. TRP4 · Reds Campaign («Кампания «Красных»») — третья кампания, первая без вопроса (2026-10-28)

Скан `Prelude_-_TRP4.png`: метка МАРС; ряд «18 M€ · [карта] · 3 [нейтрал] + эмблема Красных» — «(Gain 18 M€. Draw a card. Add 3 neutral
delegates to the Reds' Popular Support Area.)». На кромке только ромб Turmoil → `compatibility: 'prelude'`. Лор: «The third constant of
humankind: There will always be resistance to change.» (кредит арта «Thibault Girard»). Файлы: `turmoilRedux/RedsCampaign.ts`, спек
`tests/cards/turmoilRedux/RedsCampaign.spec.ts`, e2e `tests/e2e/console-reds-campaign.spec.ts` (TIMING).

- Сервер — даром: `stock: {megacredits: 18}` (заодно стартовая ценность прелюдии) + `drawCard: 1` + митинг за добором. **Ничего не
  спрашивается**: M€, карта и поддержка едут в ОДНОМ ответе на розыгрыш; поддержка последняя (спек сверяет порядок строк журнала).
- Консоль — даром: запись митинга с хостом `start` приходит вместе с добором; шаг «ДЕЛЕГАТЫ» ждёт допуск `followUp` (для добора
  «обработан» = карта взята), так что сначала сцена колоды и карта в руку, потом Парламент. Стенд свидетельствует «ни одного кадра
  Парламента, пока стоит сцена колоды или вскрытие».

## 7. TRP5 · Greens Campaign («Кампания «Зелёных»») — четвёртая кампания, партия ПРАВИТ на старте (2026-10-28)

Скан `Prelude_-_TRP5.png`: метки РАСТЕНИЕ + МИКРОБ; ряд «2 [РТ] · [пр. растений] · 3 [нейтрал] + эмблема Зелёных» — «(Gain 2 TR. Increase
your plant production 1 step. Add 3 neutral delegates to the Greens' Popular Support Area.)». На кромке только ромб Turmoil →
`compatibility: 'prelude'`. Лор: «"That is well said," replied Candide, "but we must cultivate our garden." — Voltaire, Candide.» (точка
в конце — закон гарда лора; кредит арта «Bryan Versteeg»). Файлы: `turmoilRedux/GreensCampaign.ts`, спек
`tests/cards/turmoilRedux/GreensCampaign.spec.ts`, e2e `tests/e2e/console-greens-campaign.spec.ts` (TIMING).

- Сервер — даром: `tr: 2` (одна воронка рейтинга) + `production: {plants: 1}` + митинг. Ничего не спрашивается.
- **ОБЛАСТЬ ПРАВИТЕЛЯ.** В поколении 1 Зелёные правят по умолчанию (ENACTED пуст, с.8). Свод не делает исключения для правящей партии —
  её область заполняется так же; а обновление сдаёт только НЕ правящие партии (с.11, шаг 5), так что тройка ждёт, пока Зелёные не уйдут
  из правительства. В консоли плашка Зелёных стоит в слоте правителя (их плитка телепортирована в правительство; пустые места поддержки
  у стартовых Зелёных сохранены — `rulesByCard` false), и кубы садятся туда (свидетель стенда `plaqueInRulerSlot`).
- **ОТВЕТ СТОЛА.** Правящие Зелёные отвечают на розыгрыш: 2 M€ за шаг РТ (+4 M€) и +1 к производству M€ за производство растений (спек
  закрепляет). Консоль играет это сценой реакции ДО шага «ДЕЛЕГАТЫ» (шаг ждёт `cardReactionState.phase === 'idle'`).

## 8. TRP6 · Scientists Campaign («Кампания «Учёных»») — пятая кампания: добор 3 (2026-10-28)

Скан `Prelude_-_TRP6.png`: метки НАУКА + НАУКА; ряд «три рубашки карт · 3 [нейтрал] + эмблема Учёных» — «(Draw 3 cards. Add 3 neutral
Delegates to the Scientists' Popular Support Area.)». На кромке только ромб Turmoil → `compatibility: 'prelude'`. Лор: «Science isn't
about WHY. It's about WHY NOT.» (кредит арта «Pablo Palomeque»). Файлы: `turmoilRedux/ScientistsCampaign.ts`, спек
`tests/cards/turmoilRedux/ScientistsCampaign.spec.ts`, e2e `tests/e2e/console-scientists-campaign.spec.ts` (TIMING).

- Сервер — даром: `drawCard: 3` (обычный добор, все три остаются — ОДНА партия «одно действие — один забор», спек закрепляет) + митинг.
  Ничего своего не спрашивается. Консоль — как TRP4: «ДОБОР КАРТ» (три карты) → «ДЕЛЕГАТЫ».
- **ДВЕ МЕТКИ НАУКИ — сыгранные метки.** Всё, что отвечает на метку Науки, отвечает на обе: Pharmacy Union с болезнью снимает две (+2 РТ),
  без болезни задаёт свой вопрос ДВАЖДЫ — и поддержка встаёт только после обоих ответов (`BACK_OF_THE_LINE` за `SUPERPOWER`; спек
  закрепляет: пока стоит вопрос, область пуста). Из корпораций в скоупе на метку Науки отвечает только она (Ferrus Academy / Lotus
  Innovations сами несут метку Науки, но на сыгранные метки не отвечают).
