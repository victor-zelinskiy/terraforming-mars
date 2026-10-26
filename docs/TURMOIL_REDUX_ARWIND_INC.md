# TR78 Arwind Inc. — шаг Карьеры спрашивает, куда лечь истребителю

Первая из восьми НОВЫХ корпораций набора Turmoil Redux (не замена). Скан — `…/TM Turmoil Redux/Corporations/Corporation -
Arwind Inc.png`, арт `assets/card-images/TR78.webp`, лор TR78 (EN `assets/text/lore_texts.json`, RU `src/locales/ru/lore_texts.json`).
Промт — `docs/claude/prompts/redux-corp-arwind-inc.md`. Карта — `src/server/cards/turmoilRedux/ArwindInc.ts`.

**Печатное:** 38 M€ + 1 производство титана, метка Космос, держатель истребителей, без ПО, без первого действия.
**Действие:** положите 1 истребитель на любую карту (декларация `addResourcesToAnyCard` — как у Celestic).
**Эффект 1:** каждый раз, когда ваш маркер Карьеры продвигается на 1 шаг, положите 1 истребитель на любую карту.
**Эффект 2:** при розыгрыше карты с меткой Космоса истребители с ЭТОЙ карты можно тратить как 4 M€ каждый.

## 1. Номер — реестр новых корпораций

`src/common/cards/turmoilReduxCorporations.ts` — восемь строк в порядке папки сканов (Arwind Inc. TR78, Ferrus Academy TR79,
Hartlan Heating TR80, Lotus Innovations TR81, Proteus TR82, The Deimos Group TR83, Titan Holdings TR84, Veynon Dynamics TR85);
строка с `authored` — зарегистрированная карта. Гард `TurmoilReduxCardManifest.spec`: номер > 77 — строка этого реестра,
корпорация, без `reimplements`; `within(1, 85)`. Замены (TR71…TR77) — свой реестр `turmoilReduxReplacements.ts`.

## 2. Хук шага Карьеры — ОДНА дверь на четыре причины

`ICard.onAgendaStep(player, step: AgendaStepContext)` зовётся ВНУТРИ единственной ходьбы `ChairmanSeat.walkAgenda` — для
каждого взятого шага, сразу ПОСЛЕ его бонуса (`payStep`), для каждой карты стола ходящего (корпорация включена), под
`events.withEffect(player, card, 'agenda-step')`; MarsBot не спрашивается. Причины приходят даром: ходьба карты (TR04,
TR12, TR37, TR42, TR73, TR76 — синхронно в `bespokePlay`), задание председателя (`applyQuest` / `seatPrompt.finish`),
шаг победителя заседания (`ParliamentPhase.stepAgenda`), шаг закона (`payAgendaGrant`, RX39). `of` — шагов, которые
ходьба ВОЗЬМЁТ (конец трека учтён); шаг, отрезанный концом трека, хук не зовёт; шаг с ветированным РТ (RX42) — зовёт.

## 3. Вопрос, маркер, запись для перезагрузки

`parliament/AgendaStepReactions.ts`:
- `reactionStep(...)` — ОДИН билдер вопроса: общий `AddResourcesToCard` с `autoSelect: false` (корпорация сама — кандидат,
  её всё равно СПРАШИВАЮТ), `cause` — корпорация, маркер `agendaStepPrompt` (source · reason · step · index/of · card /
  resolution; сериализуется в `SelectCard.toModel` — переживает вложенность).
- `askResourceOnAgendaStep(...)` — живой хук: для причины `card` — просто `defer` (класс движка: один запрос);
  для `phase` / `quest` / `resolution` — запись `pendingActions {kind: 'card-reaction', …}` + `defer`; ответ снимает
  запись; `rebuildAgendaReactions` (из `ParliamentHandler.rebuildPendingPrompts`) переспрашивает после перезагрузки.
- Заседание ждёт вопроса честно: `drive()` дренирует очередь после шага `agenda` — истребитель ложится ДО поддержки и
  принятия (печатный порядок; RX40 считает «карты с ресурсами»). Модель публикует `phase.pending` с ключом
  `AGENDA_REACTION_PENDING_KEY` и типом ввода; раннее закрытие во время паузы не предлагается (поддержка впереди у всех).

## 4. Pre-select при розыгрыше

Пара хуков прогноза `onAgendaStep ↔ agendaStepForecast` (`FORECAST_HOOK_PAIRS`, гард `effectForecastCoverage`) и шаг 0 в
`effectForecast.cardPlayedFacts`: собственная ходьба разыгрываемой карты (`agendaWalkForecast` — её единственное
чтение) отвечается столом по шагам — `asks`-факт на шаг с ТЕМ ЖЕ промптом (`reactionStep`, `cardBeingPlayed`),
адрес `{role: 'card', source: {kind: 'corporation', card: ARWIND}}`. Композер розыгрыша показывает их строками
«вопросов стола» (`data-reaction-card`); единственный держатель посеян (T14); батч кладёт ответы на свои промпты по
порядку (`deferredInputBatch` — адрес решает).

## 5. Платёжная единица `arwindFighters`

Четвёртая карточная единица по таблице касаний EVA §3 (`docs/TURMOIL_REDUX_EVA_MECHS.md` §9): `Spendable` +
`CARD_FOR_SPENDABLE_RESOURCE`, `Payment` (`ARWIND_FIGHTER_VALUE = 4`, плоско), `Player.paymentOptionsForCard`
(ПЕЧАТНАЯ метка Космоса), `pay()` — списание С ЭТОЙ карты, оба промпт-модели, `SelectPaymentDeferred` (false),
`paymentModelUtils`, `paymentPlan` (дорожка «Истребители», спрайт `fighter`), `railValueModel` (`space` —
«4 M€ · Космос»), десктоп-остатки. **Защищённая** (решение 7): в скоупе есть второй потребитель — TR29 Spaceship
Recycling тратит «1 истребитель с ЛЮБОЙ своей карты», поэтому стартовая смесь оплаты её не сеет (`PROTECTED_UNITS`
рядом с `floodgateSteel`); игрок поднимает дорожку сам.

## 6. Три хоста одного вопроса (консоль)

`src/client/console/parliament/agendaReaction.ts` — чистая половина: хост по маркеру (`card` → рука, иначе Парламент),
слово стадии по прочтению выбора (`resourceGainPrompt.cardResource` → «Fighter» → «ИСТРЕБИТЕЛЬ»), пауза заседания.
- **Закон (`resolution`)** — ОДНО чтение `promptSource.sittingAskResolution` (вопрос закона ИЛИ ответ стола на шаг,
  который закон прошёл): ворота подъёма, зона награды, мандатный бит, слово стадии — как у любого вопроса закона.
- **Задание председателя (`quest`)** — `chairmanQuestDirector.afterAgenda`: после бонуса шага поток ДЕРЖИТСЯ
  (`awaitingReaction`, бит `reaction`), хвост крошки «ИСТРЕБИТЕЛЬ», секция разворачивает зону
  `[data-embed-slot="parliament-reaction"]` над столом грамматикой смены тела (`playBodyUnfold`) и публикует
  `consoleParliamentUi.reactionZone`; шелл (`parliamentQuestReactionTask`) держит хост, пока зоны нет, и телепортирует
  его в неё; ответ (падение маркера) → `noteChairmanQuestReactionAnswered` → поток кончается как всегда (A).
- **Заседание (`phase`)** — сервер стоит на `support` с ключом паузы. Прогулка: ВЕРДИКТ → страница ПРИНЯТИЯ играет
  ПОВЕСТКУ и ОСТАНАВЛИВАЕТСЯ (`ctx.careerPaused` → `onCareerTold`); поле страницы ПРИНЯТИЯ открывается для спрошенного
  места (`sittingFieldOf(..., career)`, панель награды несёт зону, герой пуст — принятия ещё не было); остальные места
  читают в полосе «кто · выбор карты». Ответ проводит цепочку: посев «возобновления» (`detectSittingTransition.careerResume`
  → `seedEnactmentHolds(…, 'resume')` — всё, кроме хода маркера), прогулка возвращается на ТУ ЖЕ страницу ПРИНЯТИЯ
  (`careerResumeOwed`) и играет ПОДДЕРЖКУ и ПРИНЯТИЕ без повтора ПОВЕСТКИ (`ctx.agendaTold`), дальше — как всегда.
- **Рука (`card`)** — штатно вопрос пред-собран композером; живой (без ответа в батче) обслуживается как любой живой
  выбор в рабочем пространстве руки.

## 7. Что наследует следующая корпорация-реактор

Хук `onAgendaStep` + `askResourceOnAgendaStep` (вопрос «ресурс на любую карту») + двойник `agendaStepForecast` — и все
три хоста приходят даром (маркер решает хост, слово стадии — из ресурса). Вопрос другой формы — новая ветка в
`AgendaStepReactions` с той же записью для перезагрузки, никогда не вторая функция ходьбы.

## 8. Спеки

`tests/parliament/AgendaStepHook.spec.ts`, `tests/cards/turmoilRedux/ArwindInc.spec.ts`, `tests/console/agendaReaction.spec.ts`,
`tests/client/console/parliamentSittingSeed.spec.ts` (пауза и возобновление), e2e `tests/e2e/console-arwind-inc.spec.ts`
(фикстуры `arwind-walker` · `arwind-chairman-quest` · `arwind-sitting-win` · `arwind-pay-space`).
