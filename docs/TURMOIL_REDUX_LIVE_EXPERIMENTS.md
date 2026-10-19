# RX36 · Live Experiments («Живые эксперименты», Учёные) — ДЕЙСТВИЕ, РЕЗУЛЬТАТ КОТОРОГО — РОЗЫГРЫШ КАРТЫ

Печатное: «When enacted: Gain data resources equal to your Influence. **Action: Pay 6 M€ to play a card ignoring all
global parameter requirements.**» Задание председателя — «Play 2 cards with a requirement» (`{kind:
'cardsWithRequirement'}, count 2` — ДЕСЯТЫЙ вид цели; значок сноски «жёлтая табличка MIN ×2» — `Q-4` закрыт этой
картой). Промт владельца: `docs/claude/prompts/resolution-rx36-live-experiments.md`. Сдана 2026-10-20.

Чем карта нова: RX28 сделал действие, которое СТОИТ денег; RX26 — действие, которое ПОВТОРЯЕТ чужое. Это первое
действие, чей РЕЗУЛЬТАТ — целый розыгрыш карты из руки: своя цена карты поверх 6 M€, свои метки, эффекты, реакции стола
— всё как у любого розыгрыша, но глобальные требования сняты. Две вещи, без которых карта соврала бы: (1) снятие
требования — это класс TR49 «эффект на один розыгрыш», а не вторая дорога мимо него; (2) «какую карту и как» консоль
уже умеет спрашивать ОДНОЙ поверхностью (альбом руки + композер розыгрыша) — закон не строит вторую.

---

## 1. Главный принцип: ОДИН слот снятия, ОДНА функция снятия, ОДНА поверхность выбора

| Вопрос | Ответ | Где |
| --- | --- | --- |
| «Глобальные требования сняты для этого розыгрыша?» | `IPlayer.globalRequirementWaiver()` — ОДНА функция класса TR49: сперва ПРОБА (`temporaryGlobalRequirementWaiver`), затем СЛОТ ЗАКОНА (`armedLawWaiver`), затем стол | `src/server/Player.ts` |
| «Закон взведён?» | `IPlayer.armedLawWaiver: ResolutionId \| undefined` — СЕРИАЛИЗОВАН (`SerializedPlayer.armedLawWaiver`) | `IPlayer.ts`, `SerializedPlayer.ts` |
| «Когда тратится?» | `playCardImpl` — рядом с `lastCardPlayed`: следующая сыгранная карта ЛЮБОЙ дорогой; `pass()` — сгорает | `Player.ts` |
| «Что сыграет закон, если нажать?» | `liveExperimentsCandidates(player)` под ПРОБОЙ (`withLiveExperimentsProbe`: закон взведён на время вопроса, счёт 6 M€ удержан как РЕЗЕРВ — прецедент Merchant, `PlayabilityOptions.reserve`) | `LiveExperiments.ts` |
| «Какую карту и как?» | обещанный пик (`ResolutionAction.playModel` → `ResolutionActionModel.play`) → мост `consolePlayPick` → альбом руки + композер розыгрыша | `src/client/console/consolePlayPick.ts` |

### 1.1 Слот закона рядом с `lastCardPlayed` (решение Р3)

Снятие — ВЗВЕДЁННЫЙ ЭФФЕКТ ЗАКОНА, не память цепочки. Порядок: счёт оплачен → `armLiveExperimentsWaiver` пишет
`armedLawWaiver` и строку журнала «… paid 6 M€ to [закон]: the next card played ignores its global requirements» →
`PlayProjectCard` спрашивает карту (маркер `resolutionActionPrompt` стадии `play`, сериализован на
`SelectCardToPlay.toModel`). Следствия:

- **Перезагрузка между счётом и выбором ничего не теряет**: 6 M€ уплачены = снятие должно, слот стоит, следующий
  обычный розыгрыш его потратит.
- **Пустой выбор** (руку успели разыграть) — названная строка «… has no card to play with [закон] — the paid waiver
  stays armed for the next card»; слот остаётся до паса.
- **Рядом со взведённым TR49 / Special Design** стоят оба, один розыгрыш тратит оба (`armedPlayEffectsOf` публикует
  слот закона ПОСЛЕ эффектов карт — `{source: {resolution}, sourceType: 'resolution', effect: {kind:
  'requirementWaiver'}, expires: 'next-play'}`).
- **Снимается только `GlobalParameterRequirement`** (температура, кислород, океаны, Венера; MIN и MAX) — правило 3
  класса: требование ВЫПОЛНЕНО, а не растянуто; Think Tank / Aeron на нём ничего не тратят. Метка, производство, РТ,
  города / колонии / ресурсы, ПАРТИЯ и председатель не снимаются никогда (спек: `MartianMediaCenter` — партия).

### 1.2 Проба: от карты к закону

`temporaryGlobalRequirementWaiver` расширен с `CardName` до `GlobalWaiverProbe = CardName | {resolution}` —
единственная проба, которой спрашивает весь класс («сыграло бы, будь снятие взведено»). Её читают: гейт `canAct`,
вердикт бесполезности, обещанный пик и превью розыгрыша кандидата (`card-play-preview?law=<id>` —
`ParliamentHandler.resolutionPlayProbe` отдаёт пробу только для принятого закона, доступного этому месту).

### 1.3 Доступность и бесполезность (Р4)

`canAct`: цена (`actionBillPrice` — 6 при любом влиянии, честно как объявление) → «Need 6 M€ for this action, you can
pay N» → кандидаты под пробой с резервом → «No card in hand this would let you play». Использование и место вне
парламента — семейные. **Бесполезность** (`ResolutionAction.futility` → `ResolutionActionModel.futile`): каждая карта,
которую закон пропустил бы, играется и без него — действие «без эффекта», ИНФОРМАЦИЯ, никогда не блок
(`docs/claude/console/futile-actions.md`).

### 1.4 Задание и Q5

- Карта, сыгранная ЧЕРЕЗ закон, идёт под источником резолюции → `QuestTracker.eligible` отсекает её от любого
  задания, своего включительно (решение Q5): «2 карты с требованием» закрывают обычные розыгрыши.
- Десятый вид `cardsWithRequirement` (решение Р2): карта проекта, печатающая ХОТЯ БЫ ОДНО требование любого рода.
  Репорт — ОДИН (`QuestEvent.cardsPlayed.requirements` из `onCardPlayed`, у бота — `BotQuestEvents`), второй точки
  нет. Сноска — голая табличка требования (`REQUIREMENT_PLATE` / `requirementPlate()`, рисунок партийной таблички с
  меткой MIN). Бот: `botQuestPath.cardsWithRequirement = 'adapter'`.

## 2. Класс TR49 научился закону (сколько читателей)

Источник снятия бывает `CardName | {resolution}`. Научены ВСЕ читатели класса:

| # | Читатель | Что умеет теперь |
| --- | --- | --- |
| 1 | `recordRequirementEasing` (сервер) | строка журнала «… ignored the global requirements of … thanks to [закон]», `requirement-eased` с резолюцией-источником |
| 2 | `requirementEasingOf` / `waiverIsOneShot` | источник-резолюция — одноразовый |
| 3 | `armedPlayEffectsOf` (сервер) | слот закона в публичной модели |
| 4 | `armedPlayForecast` (сервер) | имя источника `armedSourceNamed` |
| 5 | `ArmedPlayEffectModel` (common) | `source: CardName \| ArmedLawSource`, `armedSourceKey` (`law:<id>`), `armedSourceCard` |
| 6 | `armedEffects.ts` (клиент) | `ArmedEffectView.law` / `sourceKey` / `sourceName` |
| 7 | `requirementEasingText.ts` | `lawName(id)`, `easingSourceName` / `armedSourceName` для резолюции |
| 8 | `composerRequirementRow.ts` | заметка о трате — ключ источника строкой |
| 9 | `effectForecastModel.ts` | модификатор «Сработает» с источником-законом |
| 10 | `premiumModifierSources` + `PremiumModifierMarks` | символ `law` — эмблема партии в рамке печати (SYMBOL_ORDER: law 4, once 5) |
| 11 | `ConsoleArmedEffectsStrip` / `Section` | полоса «ВЗВЕДЕНО» и раздел эффектов — арт и лицо закона |
| 12 | `armedEffectFlight.ts` | полёт по `sourceKey` |
| 13 | нотификации (`notificationModel` / `ConsoleNotificationCard`) | строка соперника «… благодаря [закон]» |

## 3. Консоль — форма Р5: слот «КАРТА» в стадии закона

```
ДЕЙСТВИЯ КАРТ › ЖИВЫЕ ЭКСПЕРИМЕНТЫ › НАСТРОЙКА                (кадр 02: цена + пустой слот, CTA не взведён)
  A на слоте → ДЕЙСТВИЯ КАРТ › ЖИВЫЕ ЭКСПЕРИМЕНТЫ › КАРТА     (кадр 03: альбом руки — обещание закона)
  A на карте → … › ТРАВА · РОЗЫГРЫШ                           (кадр 04: композер, требование «снято»)
  A «Разыграть» → назад в стадию закона                       (кадр 05: слот с картой, «✓ благодаря закону», ИТОГО)
  A «Подтвердить» → ОДИН батч → посадка карты на стол         (кадр 06)
```

- **Слот** — грамматика слота повтора (RX26): пустой приглашает (гнездо держит высоту — слот не прыгает), заполненный
  — лицо карты, цена-чип, «✓ благодаря закону» (только когда снятие РЕШАЮЩЕЕ — `decisive`), строка ИТОГО «6 M€ за
  закон + 11 M€ за карту = 17 M€». Выбор ≠ коммит: заполненный слот только взводит CTA.
- **Мост `consolePlayPick`** (`enterConsolePlayPick` / `resolveConsolePlayPick` / `cancelConsolePlayPick`): шелл
  открывает руку ВНУТРИ «Действий карт» (`openHandWithReveal({overlay: false})`, стадия руки — «КАРТА»), подменяет
  карты руки ОБЕЩАННЫМИ моделями закона (`handEntriesAll`; доступность — только `playable`), `playAction` отдаёт
  `{path: [], input: pick.input}`, а `onPlayCardConfirmNative` перехватывается в `resolveConsolePlayPick` — композер
  розыгрыша тот же, второго нет. Превью кандидата — `&law=` (ключ кэша префетча включает закон). M€ на руке для
  композера — за вычетом резерва счёта (`activePlayPickReserve`).
- **B** — один уровень: из композера в альбом, из альбома (метка «Назад») — отмена пика, стадия закона как была.
- **Батч** (`ConsolePartyActionComposer.playBatch`): `[ответ меню (опция закона), карта АДРЕСОВАННАЯ закону
  ({type: 'projectCard', card, payment, for: {source: {kind: 'resolution', resolution}, role: 'projectCard'}}),
  ...ответы самой карты]` — собран тем же `buildPlayCardBatch`, что и розыгрыш из руки.
- **Посадка** — классическая сцена розыгрыша (`armPlayedHero(card, isEvent, {sourceSelector: '[data-pact-play-face]',
  host: 'overlay', rewards, reactions, rail, spends, price, …})`) с лица в слоте.
- **Запасная дорога**: счёт, который спрашивает свою оплату (Helion — тепло, Luna — титан: `play.billAsks`), ничего не
  обещает для предсбора → без слота, дорога подтверждения; живой `projectCard` закона стадии `play` приходит после
  оплаты и открывает альбом обычным живым пиком (не вложенным — слабое место §6).

## 4. Решения Р1–Р5 (владелец, AskUserQuestion — все рекомендованные)

| № | Решение |
| --- | --- |
| Р1 | Имя RU — «Живые эксперименты» |
| Р2 | Задание считает ЛЮБОЕ печатное требование (не только глобальное) |
| Р3 | Снятие — взведённый эффект закона (сериализованный слот), не память цепочки |
| Р4 | Бесполезное действие доступно, но помечено «без эффекта» |
| Р5 | Слот «КАРТА» в стадии закона (альбом + композер на уровень глубже, ИТОГО, один коммит) |

## 5. Проверка

- `tests/parliament/LiveExperiments.spec.ts` (30): принятие = data RX35; цена-объявление; гейт (деньги / кандидаты /
  резерв после счёта); бесполезность; плати-потом-играй (учёт на оплате счёта, не на меню); слот — сериализация,
  трата любым розыгрышем, сгорание на пасе, сосуществование с TR49; партия и метки не снимаются; Q5; задание
  `cardsWithRequirement` (свой розыгрыш не считается, обычные — да); бот; обещанный пик; превью `law=`.
- Контракт `ResolutionContract.spec` 6/6, сьют парламента, клиентские спеки класса (`armedEffects.spec` § закон).
- `tests/client/components/console/ConsolePartyActionComposerPlay.spec.ts` (7): слот, дверь моста, заполненный слот
  и ИТОГО, «выбор ≠ коммит», отмена, форма батча, запасная дорога.
- e2e `console-parliament-live.spec.ts` (standard-1080 + tv4k, раскадровка `TM_E2E_STORYBOARD=1`): плитка закона →
  пустой слот → альбом над обещанием → композер «снято» → слот с ИТОГО → один коммит (сервер: 20 → 3 M€, «Трава» на
  столе, использование потрачено) → плитка «Активирована» (RT). Фикстура `parliament-live-enacted` (стол −30 °C,
  «Трава» / «Адаптированный лишайник» / «Марсианский медиацентр» в руке, `pendingInitialActions = []`).

## 6. Слабые места (честно)

1. 6 M€ закона и цена карты уходят ОДНИМ чипом «−17» на стадии посадки — 6 не летят в лицо закона первыми.
2. Посадка `host: 'overlay'` закрывает workspace на нажатии; посадка внутри «Действий карт» (как у RX26) — не сделана.
3. Запасная дорога (Helion / Luna) открывает альбом живым пиком поверх доски, не вложенным в стадию закона.
4. Стадия закона на 4K оставляет пустоту над композицией (центрирование по вертикали — да, масштаб сцены — нет).
