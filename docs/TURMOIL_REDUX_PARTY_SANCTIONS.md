# Turmoil Redux · TR12 Party Sanctions («Партийные санкции»)

Пятнадцатая карта проектов набора (2026-10-02). Три вещи впервые: **Парламент выбирает ПАРТИЮ-ОБЛАСТЬ, а не
резолюцию** (режим `support` — признак двери Парламента, не второй вид двери), **сброс Народной поддержки** (пара
события `popular-support-gained`) и **два такта после одного A на одной позе** (кубы уходят из области → шаг Карьеры
TR04). Плюс требование «быть председателем» названо (класс).

Промт: `docs/claude/prompts/project-tr12-party-sanctions.md`. Соседи: `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (TR03 —
staged-дверь резолюции, адресованный `party`-хвост, места поддержки), `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md`
(TR04 — одна ходьба, исход в руке), `docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` (TR15 — четвёртая дверь, обобщённый вход),
`docs/TILE_PLAY_STAGED_COMMIT.md` §9-octies (таблица целей).

## 0. Решения владельца (не пересматривать)

1. Хореография = ритуал как у TR03: выбор ДО отправки, Парламент в зоне руки, A там = единственный POST, исход играет
   там же, геометрия заморожена от A до ухода.
2. Пустые области отключены с причиной «Область пуста»; ноль кандидатов — названный пропуск сброса, шаг Карьеры остаётся,
   двери нет.
3. RU-имя «Партийные санкции».

## 1. Карта и правила

TR12, 2 M€, EVENT, меток нет, ПО нет, `requirements: {chairman: true}`, `compatibility` нет. Графика `−ВСЕ
[нейтральный делегат]* · [★]` (узлы `NEUTRAL_DELEGATE` TR03, `AGENDA_STEP` TR04). Лор «I AM the Senate!» → «Сенат — это
я!» (блок рисует свои кавычки — обёрточных нет, как у соседей). Арт `assets/card-images/TR12.webp`.

| # | Правило | Где закреплено |
| --- | --- | --- |
| 1 | Требование — делегат игрока в кресле сейчас (фасад `politics.isChairman`), проверка при розыгрыше | `PartySanctions.spec` § rule 1, `unplayableReasons.spec` § CHAIRMAN |
| 2 | ОДНА партия из шести; ВСЕ нейтральные её области → общий запас; голоса на резолюциях и делегаты игроков не тронуты | `PartySanctions.spec` § rules 2–3, `DiscardPopularSupport.spec` |
| 3 | Кандидаты — области с ≥ 1; пустая — отключена с причиной; область правителя — обычный кандидат при запасе | там же |
| 4 | Ноль кандидатов: карта играбельна, сброс — `effect-skipped`, шаг Карьеры выполняется; композер говорит это до розыгрыша | § rule 4 |
| 5 | Шаг Карьеры — `ChairmanSeat.walkAgenda(…, 1, {reason: 'card'})` с наградой шага; конец трека — срез ходьбы | § rules 5–6 |
| 6 | Порядок печатный: сброс, затем шаг — оба в ответе на ОДИН POST (шаг — продолжение шага сброса) | § rules 5–6 (журнал, события) |
| 7 | Председательство сохраняется | § rules 2–3 |
| 8 | MarsBot карту не играет (ветка бота в шаге — полнейшая область, без промпта) | шаг |

## 2. Сервер

```ts
// Parliament — рядом с addPopularSupport
discardPopularSupport(party: ReduxParty): number          // обнуляет область; запас выводной → возврат автоматический
// EventRecorder — пара popular-support-gained
recordPopularSupportDiscarded(player, party, count, total) // 'popular-support-discarded', impact.popularSupport {party, gained: −count, total}
// parliament/DiscardPopularSupport.ts — общий шаг
new DiscardPopularSupport(player, cause: ChoiceContextSource, then?: () => void)
step.previewSelectParty(): SelectPartyModel | undefined   // read-only близнец; undefined — нет кандидатов / MarsBot
skippedSupportDiscard(reason?) → {reason, skipped: {label: 'Popular support'}}
```

- Промпт: `SelectParty(DISCARD_POPULAR_SUPPORT_TITLE, 'Select', кандидаты)` + `choiceContext {source: cause, mode:
  'effect-choice'}` + маркер **`supportPrompt: {source: 'discard', areas}`** — по строке на ВСЕ шесть партий `{party,
  current, resulting: 0, available, reason?}` (`PlayerInputModel.SupportPromptMeta`). Клиент рисует «N → 0» и причины,
  ничего не считая; `parties` промпта = доступные строки.
- Событие-пара использует ТУ ЖЕ форму `impact.popularSupport` со знаковым `gained` — строка журнала («Народная
  поддержка · Марс вперёд · 0/3», чип «[нейтр.] −3») и пилюля соперника приходят даром.
- Приоритет `GAIN_RESOURCE_OR_PRODUCTION` (слот шага делегата): гейт задания председателя (`BACK_OF_THE_LINE`) — после.
- **Адресованный `party`-хвост обобщён, не продублирован** (`deferredInputBatch.stagedMismatch`): совпадение ⇔
  `SelectParty` ∧ (`votePrompt.source === 'grant'` ∨ `supportPrompt !== undefined`) ∧ `choiceContext.source.card ===
  stagedFor`. Кресло председателя и чужие дающие — по-прежнему парковка (`deferredInputBatch.spec` § a POPULAR SUPPORT
  AREA; прежние разделы гранта TR03 / TR15 не тронуты и зелёные).
- **Причина CHAIRMAN названа** (`unplayableReasons.chairmanRequirementReason`, только Redux): `{type: 'party', message:
  'Requires you to be the chairman', chairmanNow: {name, color} | 'vacant'}` — строка «Требуется быть председателем ·
  председатель сейчас: X / кресло свободно», компакт руки «[значок председателя] X / Кресло свободно»;
  `FULLY_RESTATED_REQUIREMENTS` += CHAIRMAN; безликая строка классики ключа не получает (общее правило «faceless →
  без ключа»). Строка правил лица — `Requires you to be Chairman.` (первый CHAIRMAN-шаблон генератора).
- Карта: `bespokePlay` = `defer(new DiscardPopularSupport(player, {kind: 'card', card}, () => walkAgenda(…, 1)))`.
  Превью: чипы ходьбы TR04 + шаги `[supportDiscardStep, agendaWalkStep]` в печатном порядке; без кандидатов
  `supportDiscardStep` отдаёт предупреждение пропуска тем же ярлыком и причиной, что запишет живой шаг.

## 3. Клиент — режим выбора области (наследует любая будущая карта «выберите партию»)

**Одна дверь Парламента, режим — признак.** `PlayDoor {kind: 'parliament', staged, mode: 'vote' | 'support'}`;
`playCommitVerb` → «Выбрать партию», `playDoorNextStepKey` → «Область поддержки — выбор в Парламенте». Staged-хранилище
держит ту же цель `resolution` (партийный пик) — РЕЖИМ определяется маркером промпта. Мост
`parliamentPromptBridge` получил `supportPick: {model, meta, card?, staged?}` (живой сильнее staged; staged ==
живой, кроме `staged`) и `supportPickResponse` (staged → `{party, stagedFor}`, живой → `{party}`).

**`ParliamentStage 'support'`** (`consoleParliamentFlow`: `armSupportPickFlow`, `parliamentSupportUp`, поля
`supportStage` / `supportCommitted` / `supportLive` / `supportBeat` / `supportSnapshot` / `supportMeta`). Наблюдатель
`bridge.supportPick` (immediate, до `frameCrumb`) армирует позу до первого рендера.
- **Кольцо** (`supportPickModel.ts`, чистая): ряд оппозиции слева направо, правитель последним; ◀ ▶ с упором, ▲ — к
  правителю, ▼ — обратно в ряд; курсор стартует на первой доступной области — курсор, не выбор. Курсор — запись обзора
  (`zone` + `partyIndex`), поэтому фокус плашек читает её же; плашки не двигаются (e2e сверяет rect всех шести).
- **Плашки** (`ConsolePartyPlaque.pick`, зарезервированный ряд состояния): кандидат «3 → 0», отказ «Область пуста»
  (спокойный регистр); у кандидата под курсором места уходящих кубов — пунктирный контур + бледный куб
  (`ConsoleSupportPlaces.outgoing`, не цветом одним).
- **Поза** `.con-parl--support`: область голосования уходит под панель (её ячейка сетки), карта правительства и задание
  приглушены вокруг плитки правителя, ряд оппозиции и трек Карьеры — в полную силу (второй такт играет на них).
- **Панель чтения** `ConsoleParliamentSupportMode.vue` — в ячейке области голосования: эмблема и имя партии, места + «3 →
  0», правило одной строкой («Нейтральные делегаты уходят в общий запас. Голоса на резолюциях не меняются.»), квитанция
  «Карта · 2 [M€]», CTA. Строки про следующее заседание нет (сервер её не отдаёт).
- **Лента**: кикер «САНКЦИИ» + `supportDelta` «[эмблема] [куб] −3» / отказ; ходьба, идущая следом, её перекрывает.
- **Полоса**: staged — «Разыграть карту · Осмотреть · Источник · Назад»; живая — «Выбрать · … · Свернуть»; после A —
  статус «Выполняется…» (пустой список падал в «На поле» — глагол, который поглощённый такт не исполняет).

## 4. Два такта после одного A

1. **Обещание** на A (`promiseSupportDiscard`: staged — в `commitStagedVote` оболочки, живая — в режиме).
2. **Посев в apply-блоке** (`seedSupportDiscardHolds` — из `gameTransport.seedRewardHolds` и `App.update`, рядом с
   `seedAgendaWalkHolds`): обещанная область уменьшилась → `standing` (плашка рисует кубы) и `toPool` (пул не считает
   их) = N — только пока режим стоит (`registerSupportDiscardHost`); reduced motion — ничего. Ходьба TR04 сеется тем же
   блоком (хост `hand` — спуск руки стоит).
3. **Такт сброса** (`supportDiscardScene.flySupportDiscard`): кубы с мест плашки СПРАВА НАЛЕВО (`supportDiscardOrder`),
   шаг `SUPPORT_CUBE_STAGGER_MS`, прокси рождается невидимым (`flyCube`); место гаснет на ОТРЫВЕ (`--left`, one-shot),
   пул растёт на КАСАНИИ (`[data-parl-neutral-cube]` — тик по ключу). Промах — `data-parl-support-degraded`.
4. Пауза `AGENDA_BEAT_GAP_MS`, затем **ходьба** — тот же `playOwedWalk` секции, что у позы `walk` TR04 (вынесен, не
   скопирован; `openWalkFlow` = открыть позу + `playOwedWalk`). Наблюдатель `lastAdvanceSeq` яруса в режиме `support`
   стоит в стороне — иначе ходьба хоста `parliament` (живая дверь) обогнала бы сброс.
5. Чтение → `flow-complete('support')` → `endStagedVote` → `endHandWithHostedStep`: рука и Парламент уходят одной
   поверхностью.

Три исхода: LANDED (область уменьшилась / долг посеян) → такты; RE-ASKED (живой `supportPrompt` этой карты) → режим
становится живой дверью на месте; PARKED (карта в таблице, область не тронута) → уходит целым.

## 5. Доказательство, что TR03 / TR04 / TR15 не изменились

- Юниты: `stagedVote` / `stagedActionVote` / `stagedColony` / `agendaWalk` зелёные; `voteSupportReading.spec` — одна
  правка ожидания (дверь гранта теперь несёт `mode: 'vote'`, глагол и строка те же); `deferredInputBatch.spec` прежние
  разделы party без изменений.
- e2e на своём снапшоте: `console-political-donation`, `console-minority-representation`, `console-martian-census`,
  `console-parliament-sitting-v4`, `-sitting-motion`, `-stability`, `-vote-fit` и весь список `e2e:affected` — журнал в
  `docs/claude/turmoil-redux-cards-progress.md` § TR12.

## 6. Известные границы (записано, не спрятано)

- **PARKED** недостижим сегодняшним пулом (событие без меток; триггера, вклинивающего промпт перед сбросом, в скоупе
  нет): серверная половина — юнитом (кресло председателя перед областью), клиентская ветка руками не прогонялась.
- **Живая дверь** (RE-ASKED / reload / розыгрыш вне руки-корня) собрана теми же путями, что живой грант; руками не
  прогонялась (нет естественного триггера), закреплена юнитами моста и полосы.
- **Синтетика фикстуры**: поддержка «Марс вперёд» 3 / «Наука» 1 в первом поколении — ни один путь движка её туда не
  кладёт до заседания (прецедент фикстуры TR03).
- Ячейка ПО рельса тикает с ответом (не держится холдом РТ) — наблюдение TR04, не регрессия.
