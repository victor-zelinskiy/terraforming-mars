# TR03 · Political Donation («Политическое пожертвование») — у голосования три двери и одно тело

**Статус: СДАНА 2026-09-30.** Седьмая карта проектов набора Turmoil Redux. Печатный текст: «Добавьте делегата на
резолюцию. Затем добавьте до 3 нейтральных делегатов в Народную поддержку партии этой резолюции.» Стоимость 4, метка
Марс, AUTOMATED, без требования и ПО. Лор: «Pray that it does not show up on social media.» → «Молитесь, чтобы это не
всплыло в соцсетях.»

Вес карты — не в правиле, а в ПОДАЧЕ и в четырёх контрактах, которые она заложила первой и которые наследует любая
следующая карта набора, ставящая делегата:

1. **одна арифметика Народной поддержки** — `Parliament.popularSupportRoom` («хук, который отвечает, не действует»), §2;
2. **общий шаг** `PlaceDelegatesOnResolution` с опцией `support` и проекцией `votePrompt.support`, §3;
3. **STAGED VOTE** — третья цель ОДНОГО staged-хранилища и адресованный `party`-хвост батча, §4–§5;
4. **блок «НАРОДНАЯ ПОДДЕРЖКА»** в панели режима голосования и посадка «два источника — два адресата», §6–§7.

Промт: `docs/claude/prompts/project-tr03-political-donation.md`. Файл карты:
`src/server/cards/turmoilRedux/PoliticalDonation.ts`. Спеки: `tests/cards/turmoilRedux/PoliticalDonation.spec.ts`,
`tests/parliament/PlaceDelegatesOnResolution.spec.ts`, `tests/inputs/deferredInputBatch.spec.ts` § addressed party,
`tests/client/console/stagedVote.spec.ts`, `tests/client/components/console/voteSupportReading.spec.ts`,
e2e `tests/e2e/console-political-donation.spec.ts` (фикстура `political-donation`).

---

## 0. Решения владельца (2026-09-30 — не пересматривать)

| Вопрос | Решение |
| --- | --- |
| «до 3» | **сколько влезет**: `min(3, место в области, запас нейтральных)`. Игрок числа НЕ выбирает — ни дайла, ни `SelectAmount` |
| Хореография | **ритуал, как у тайлов**: «Выбрать резолюцию» → карта ложится в «Разыграно» (до сервера) → Парламент раскрывается из той же зоны → A = единственный POST → куб и нейтральные садятся → flow уходит на поле |
| Имя RU | «Политическое пожертвование» |
| Откуда делегат | только из РЕЗЕРВА (куб лобби не тратится) |
| Пустой резерв | карта неиграбельна, причина «В резерве нет делегатов» |

## 1. Правила чтения (каждое закреплено спеком)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Делегат — из резерва; куб лобби остаётся в лобби | `PlaceDelegatesOnResolution.execute` (`placeVote(..., 'reserve')`) |
| 2 | Неиграбельна без резолюции в области (`No resolution is up for a vote`) и без делегата в резерве (`No delegate in your reserve`, `current: 0`) — причина про РЕЗЕРВ, даже если куб стоит в лобби | `PoliticalDonation.unplayableReason` |
| 3 | Нейтральные идут в НАРОДНУЮ ПОДДЕРЖКУ ПАРТИИ выбранной резолюции — не на саму резолюцию; на этой резолюции они не голосуют | `paySupport` → `addPopularSupport` |
| 4 | Поддержка считается ПОСЛЕ посадки делегата, заново (`popularSupportRoom` перечитывается в `paySupport`) | шаг |
| 5 | Срез областью (`limit: 'area'`) и срез запасом (`limit: 'supply'`) — оба названы; при равенстве — `'area'` | `popularSupportRoom` |
| 6 | Ноль — НЕ тихая потеря: `recordSkippedEffect` (строка журнала, нотификация) и карта всё равно сыграна | `skippedPopularSupport(room)` |
| 7 | Второй делегат зрителя на резолюции открывает доступ к эффекту партии (`unlocksEffect`) — главный скрытый выигрыш карты | существующие проекции `viewer.vote.projections` |
| 8 | Задание председателя (`delegates`) двигается; гейт задания встаёт ПОСЛЕ посадки (`BACK_OF_THE_LINE`) | `QuestTracker` |
| 9 | MarsBot: дверь `previewSelectParty()` → `undefined` (боту превью не нужно), шаг исполняется своим путём | шаг |
| 10 | Резолюция, за которую отдан голос, ПОБЕДИЛА: её партия приходит к власти С ЗАПАСОМ — его не забирает ничто, кроме сдачи следующей карты партии, а карту правителя не сдают. Пока партия правит, её никто не пополняет (заседание пропускает правителя; на шаге поддержки того заседания, где она уходит, она ещё в ENACTED — «+1 отсутствующей» не получает). На обновлении области после её ухода, если сдана её карта, запас становится голосами на ней; если нет — ждёт дальше | `PoliticalDonation.spec.ts` § rule 5 across the sittings |

**Правило 10 на экране (правка 2026-09-30).** До неё плашка правителя прятала гнёзда поддержки ЦЕЛИКОМ — по
инварианту «у правителя по карте поддержка всегда ноль», который эта карта сломала: три нейтральных пропадали из
запаса, не будучи видны нигде, и «появлялись из ниоткуда», когда партия уходила из правительства. Теперь стоящий куб
рисуется всегда, скрыты только ПУСТЫЕ места правителя (их заполнить нечем) — `ConsoleSupportPlaces.voidEmpty`, закон 18
в `.claude/rules/console-ui.md`. Строка поддержки в итогах по-прежнему без правителя: его запас читается на его же
плашке в зоне правительства, рядом с панелью (закон панели — не повторять другую зону).

## 2. `popularSupportRoom` — одна арифметика поддержки

```ts
// src/common/parliament/ParliamentTypes.ts
export type SupportRoom = {current: number, gained: number, resulting: number, printed: number, limit?: 'area' | 'supply'};
// src/server/parliament/Parliament.ts
popularSupportRoom(party: ReduxParty, n: number): SupportRoom   // чистая: ничего не мутирует
addPopularSupport(party, n)                                     // = применить popularSupportRoom(...).gained
```
`gained = min(n, 3 − current, neutralSupply())`. `limit` стоит только когда напечатанное число срезано. Любой, кто хочет
ПОКАЗАТЬ, сколько сядет (превью, панель, досье), зовёт её — второго подсчёта нет ни на сервере, ни на клиенте
(запрет §8 промта «считать поддержку на клиенте»).

## 3. Общий шаг `PlaceDelegatesOnResolution`

```ts
new PlaceDelegatesOnResolution(player, quantity, cause, options?: {support?: number})
step.previewSelectParty(): SelectPartyModel | undefined   // тот же промпт, без исполнения (undefined — отказ / MarsBot)
```
- Промпт один для живого вопроса и для превью: `SelectParty` с `votePrompt {source: 'grant', cost: 0, count, printed,
  support?: VoteSupportProjection[]}` и `choiceContext {source: cause, mode: 'reward'}`. `support` — строка `SupportRoom`
  НА КАЖДУЮ партию-кандидата (`{party} & SupportRoom`), посчитанная `popularSupportRoom`.
- Колония Венеры (`support` не передан) не меняется: проекции нет, блока в панели нет.
- События: `delegates-placed` (`impact.delegates {count, resolution}`) и `popular-support-gained`
  (`impact.popularSupport {party, gained, total}`) — журнал рисует их чипами; соперник видит «сыграл карту · делегат на
  «…» · +N поддержки» с источником-картой.
- **В файле карты нет ни второго `SelectParty`, ни своего `placeVote`**: `bespokePlay` = `game.defer(new
  PlaceDelegatesOnResolution(player, 1, {kind: 'card', card: this.name}, {support: 3}))`.

**Следующая карта набора «поставьте делегата…» = этот шаг + `actionPreviews.delegateGrantStep(card, grant)` в
`cardPlayPreview`** (строка в чеклисте набора §4).

## 4. STAGED VOTE — третья цель одного staged-хранилища

Шаг превью `{kind: 'delegateGrant', staged: StagedVoteModel}`, где

```ts
// src/common/models/ActionPreviewModel.ts
export type StagedVoteModel = {prompt: SelectPartyModel, sourceCard: CardName};
```
— дверь, а не строка выбора: композер ничего не пре-собирает, CTA — «Выбрать резолюцию».

```ts
// src/client/console/stagedPlay.ts — ХРАНИЛИЩЕ ОДНО
export type StagedPlayTarget = {kind: 'cell', placement: StagedPlacementModel} | {kind: 'resolution', vote: StagedVoteModel};
StagedPlayArm.target        // ровно одна цель; .receipt — цена карты, как её собрал композер
stagedPlacementOf(arm?) / stagedVoteOf(arm?)
```
`stagedPlayActive()`, `markStagedPlayCommitting` / `abortStagedPlayCommit` (abort-батарея транспорта) — общие.

**Путь** (`ConsoleShell.vue`):
1. `onPlayCardConfirmNative` — ветка `payload.stagedVote` (граница v1 та же, что у клетки: корень стека `hand`, спуск
   жив). Греется арт резолюций (`preloadResolutionArt`), играется ритуал `beginStagedPlayLanding`.
2. `enterStagedVote(arm)`: `armStagedPlay`, кадр руки → `configure`, `pushWorkspaceFrame({kind: 'parliament', stage:
   'Voting', phase: 'configure', serves: [], anchor: {type: 'always'}, sourceCard})`. **RELEASE**: композер (на нём к
   этому моменту только сцена «Разыграно») и прокси лежащей карты гаснут НА МЕСТЕ, пока Парламент поднимается из той же
   зоны собственным CSS-входом (`.con-parl--embedded`, `con-parl-step-in`, только `opacity`). Композер размонтируется ДО
   `finishStagedPlayedLanding()` — иначе конец сцены без исхода читается им как отказ сервера и его настройка
   материализуется на кадр под режимом.
3. Режим голосования читает staged-модель через ОДИН мост: `parliamentPromptBridge(wf, staged)` даёт тот же
   `bridge.grant`, что живой промпт, плюс `staged: true`. Живой промпт всегда сильнее (seat / grant).
4. **B** = `cancelStagedPlay`: кадр Парламента снят, композер возвращён из `arm.draft`, фаза `configure`. Запросов не было.
5. **A** = `commitStagedVote(response)`: `submitBatch([...arm.batch, {type: 'party', partyName, stagedFor: card}])` —
   единственный POST всего розыгрыша. `claimPlayOutcome` берётся (цепочка карты может добрать карту триггером),
   played-hero НЕ армится (ритуал уже сыгран).
6. Конец — `endStagedVote` → `endHandWithHostedStep`: шаг и розыгрыш заканчиваются вместе; если рука уходит, она
   растворяется над полем ОДНОЙ поверхностью (`handLeaveHook`, Парламент едет внутри неё).

Различий staged-двери и живой ровно четыре (`parliamentCommands.ts`, `voteInfoModel.ts`):

| | живой грант (Венера, re-ask, reload) | staged-дверь карты |
| --- | --- | --- |
| A | «Отправить делегата» → `submitInput` | **«Разыграть карту»** → `submitBatch` |
| B | «Свернуть» | **«Назад»** |
| крошка-хвост | янтарный | **циан** до A, янтарный после |
| источник | «×N из резерва · бесплатно» | **«из резерва · по карте»** + квитанция «Карта · 4 M€» |

Осмотр (X) несёт тот же глагол: `VoteVerbVm.door` (`'card'` → «Разыграть карту · из резерва · по карте»).
L3 «Источник» — карта поверх режима, режим не размонтируется.

## 5. Адресованный `party`-хвост и три исхода коммита

`SelectPartyResponse.stagedFor?: CardName` — АДРЕС хвоста (зеркало `stagedFor` клетки,
`docs/TILE_PLAY_STAGED_COMMIT.md` §9-quater). Правило `deferredInputBatch.stagedMismatch` для `party`: хвост садится
ТОЛЬКО на промпт, у которого `waitingFor instanceof SelectParty && votePrompt.source === 'grant' &&
choiceContext.source.card === stagedFor`. Позиционного (неадресованного) `party`-хвоста у staged-двери нет. Перед
`chairman-seat` (тоже `SelectParty`) хвост НЕ съедается — паркуется.

| Ответ сервера | Признак | Поведение клиента |
| --- | --- | --- |
| **LANDED** | у зрителя новый голос на выбранном слоте | посадка §7, затем уход на поле |
| **RE-ASKED** | `waitingFor` — грант этой карты | стоящий режим становится ЖИВОЙ дверью на месте: выбор цел, A «Отправить делегата», B «Свернуть», крошка янтарная; кадр получает `serves: ['party']` и якорь-промпт (`settleStagedVote`) |
| **PARKED** | карта в табло, нового голоса нет, промпт чужой | шаг уходит БЕЗ посадки; делегат и поддержка приходят обычным обновлением после дренажа (журнал + нотификация) |

## 6. Панель «ЧТО ИЗМЕНИТСЯ» — блок «НАРОДНАЯ ПОДДЕРЖКА»

- Чистая модель: `voteInfoModel.supportReadingOf(row, landed)` → `SupportReadingVm` (места `filled / incoming / total`,
  `amount`, `tail`, `tone`). Числа — только из `votePrompt.support` выбранной партии (`grantSupportOf`).
- Блок стоит в боксе ПАРТИИ вместо его строки момента (геометрия бокса неизменна от карты к карте и от A до ухода),
  места — общий под-компонент `ConsoleSupportPlaces.vue` (он же в `ConsolePartyPlaque` — не копия разметки).
- Четыре хвоста: `+3` (мятный) · `+1 из 3 · предел области` · `+2 из 3 · нейтральных в запасе: 2` (янтарный) ·
  `+0 · область заполнена` / `+0 · нейтральных не осталось` (спокойный регистр). Число слева — область КАК ОНА СТОИТ
  (тикает на касании каждого куба); неизменный факт — одно значение.
- Скамья: резерв игрока и ПУЛ нейтральных помечены источниками (`neutralSource`, когда `gained > 0`).
- Осмотр (X): группа «Народная поддержка» — `current → resulting из 3`, хвост и правило словами
  («Нейтральные делегаты в Народной поддержке партии становятся голосами на её следующей резолюции. На этой резолюции
  они не голосуют.»). Бюджет панели — `VOTE_INFO_LIMITS.supportWords`; третье лицо — гард глоссария (§9 глоссария).

## 7. Посадка — два источника, два адресата, по очереди

`ConsoleParliamentVoteMode`: `landVote` → `flyDelegates` (куб игрока: стопка резерва → лента резолюции) → `flySupport`
(нейтральные: `[data-parl-neutral-cube]` → `[data-parl-vote-support] [data-support-place="N"]`, по одному, шаг
`SUPPORT_CUBE_STAGGER_MS = 110`) → `beginLanding`. Счётчик пула убывает на ОТРЫВЕ (`supportHeld--`), место заполняется на
КАСАНИИ (`supportLanded++`) и отвечает один раз (`--landed`). Нет измеримого источника / адресата → признание на корне
секции (`data-parl-grant-degraded`), e2e требует его отсутствия. Память посадки (дверь, квитанция, строка поддержки) —
в `VoteSnapshot`: живая модель к этому моменту уже ушла вперёд.

## 8. Известные границы (записано, не спрятано)

- **Проекции голосования посчитаны для ОДНОГО делегата.** `viewer.vote.projections` / `pendingDelegateGrantCount` читают
  ЖИВОЙ промпт; у staged-двери живого гранта нет, а у карты `count = 1` — совпадает. Карта с «×2 делегата» обязана
  сперва провести `count` в staged-проекцию (серверный прогноз по счёту), иначе панель покажет прогноз одного куба.
- **Граница v1 staged-входа** — корень стека `hand` и живой спуск. Розыгрыш из `start ⊃ hand` («Эпатажный спонсор») и из
  standalone-полосы отправляется обычным submit, вопрос приходит ЖИВЫМ грантом в ближайший живой хост
  (`workspaceHostForStep`) — общий код, без ритуала «до сервера».
- **PARKED на практике недостижим сегодняшним пулом** (у карты метка Марс; в скоупе нет триггера, который вклинил бы
  чужой промпт перед её грантом): серверная половина закреплена юнитом, клиентская ветка руками не прогонялась.
- **Курсор после «Свернуть» → возврат** встаёт на первую резолюцию (секция монтируется заново, как у гранта Венеры) —
  это курсор, не выбор: A всё равно обязателен.
- **Хвост крошки на ритуале — «РАЗЫГРАНО» янтарным** (существующая сцена посадки, общая с тайлами), затем «ГОЛОСОВАНИЕ»
  цианом. Промт требовал «циан до A» для режима — так и есть; слово ритуала осталось общим со staged-клеткой.
- **Четвёртая дверь — ДЕЙСТВИЕ карты (TR15 «Марсианская перепись», 2026-10-02).** Та же staged-дверь резолюции открыта
  из «Действий карт»: «Выбрать резолюцию» в композере действия ничего не шлёт, Парламент встаёт в зоне композера
  `action-parliament` (рядом с героем — на нём играет ACTION COMMIT и тикает капсула), A **«Подтвердить»** (глагол
  коммита действия — `stagedDoorVerb`), квитанция — чип `{3, data}` (`StagedReceipt`, у этой двери — `{cost, M€}`),
  конец — `endCardActionsWithHostedStep`. Границы этого документа для неё те же: `count = 1` (у переписи — один куб),
  PARKED руками не прогонялся; RE-ASKED прогнан. Обобщение и доказательство неизменности TR03 —
  `docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` §5, таблица целей × потоков — `docs/TILE_PLAY_STAGED_COMMIT.md` §9-septies.
