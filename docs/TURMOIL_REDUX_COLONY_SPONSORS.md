# TR07 · Colony Sponsors («Спонсоры колоний») — четвёртая цель staged-розыгрыша: колония

**Статус: СДАНА 2026-10-01.** Десятая карта проектов набора Turmoil Redux. Печатный текст: «Requires that you have a
colony in play. Choose 1 colony track. Move its marker to the highest (right-most) position.» Стоимость 5, метка Юпитер,
AUTOMATED, требование «колония в игре» (`{colonies: 1}`), без ПО, ▲ Колонии (`compatibility: 'colonies'`). Лор: «Next thing
you know the colonists will be wearing jerseys with logos on them.» → «Глядишь, скоро колонисты будут ходить в майках с
логотипами.»

Серверное правило мало (одна позиция трека). Вес карты — в ПОДАЧЕ и в пяти контрактах, которые наследует любая следующая
карта «сдвиньте трек выбранной колонии»:

1. **общий шаг** `MaximizeColonyTrack` + read-only близнец `previewSelectColony` и одна функция максимума `trackTop`, §2;
2. **маркер промпта** `SelectColonyModel.trackMoves` — проекция «куда встанет маркер» на КАЖДОМ кандидате, §3;
3. **STAGED COLONY** — четвёртая цель ОДНОГО staged-хранилища и адресованный `colony`-хвост, §4;
4. **проекция тайла** и **стейдж-интент `track`**, §5;
5. **холд из диффа** и **ОДИН глайд** с выбором якорей (`stage` | `tile`) и ритмов (`rail` | `wave`), §6.

Промт: `docs/claude/prompts/project-tr07-colony-sponsors.md`. Файл карты: `src/server/cards/turmoilRedux/ColonySponsors.ts`.
Спеки: `tests/cards/turmoilRedux/ColonySponsors.spec.ts`, `tests/deferredActions/MaximizeColonyTrack.spec.ts`,
`tests/inputs/deferredInputBatch.spec.ts` § addressed staged colony, `tests/routes/PlayerInputBatch.spec.ts` § addressed
colony tail, `tests/console/colonyTrackMoveModel.spec.ts`, `tests/client/console/stagedColony.spec.ts`,
`tests/client/components/console/ConsoleColonyTileProjection.spec.ts`, e2e `tests/e2e/console-colony-sponsors.spec.ts`
(фикстура `colony-sponsors`).

---

## 0. Решения владельца (2026-10-01)

| Вопрос | Решение |
| --- | --- |
| Хореография | **ритуал, как у TR03**: «Выбрать колонию» ничего не отправляет → карта ложится в «Разыграно» → из той же зоны раскрывается сетка колоний → выбор → стейдж → A = единственный POST → маркер идёт → чтение → уход одной поверхностью на поле |
| Тайл на максимуме / неактивный | отключены с причиной («Маркер уже на максимуме» / «Эта колония ещё не активна»); ноль кандидатов — названный пропуск, карта играбельна |
| Имя RU | «Спонсоры колоний» |
| Значок `COLONY_TILE` | ассет владельца (`assets/misc/colony-tile.png`) для ВСЕХ его пользователей: Aridor, Early Colonization, Maria, We Grow As One, Prospecting; `COLONIES` (куб) не тронут |

## 1. Правила чтения (каждое закреплено спеком)

| # | Правило | Где живёт |
| --- | --- | --- |
| 1 | Требование — ≥ 1 СВОЯ колония (`ColoniesRequirement`); колония соперника не засчитывается, причина «сейчас 0» | `requirements: {colonies: 1}` |
| 2 | «Choose 1 colony track» — любой тайл в игре, чей угодно, с пришвартованным флотом тоже | `MaximizeColonyTrack.offer` |
| 3 | Только АКТИВНЫЙ тайл (выведено: все пути движка так читают) — неактивный ОТКЛЮЧЁН с причиной | там же |
| 4 | УСТАНОВКА, не «+N»: позиция = `trackTop(тайл)`, шагов = top − текущая; вниз никогда | `andThen` шага |
| 5 | Тайл на максимуме ОТКЛЮЧЁН с причиной; ноль кандидатов — `recordSkippedEffect` («Трек колонии» · «Все треки колоний на максимуме»), промпта нет, карта сыграна | `skippedColonyTrack` |
| 6 | Не торговля: флот, доход, задание «торгуйте N раз», Venus Trade Hub не затронуты; следующая торговля читает доход на максимуме (Redux-Плутон платит карты без держателя data) | спек § rule 6 |
| 7 | Журнал: строка движка `increased ${1} colony track ${2} step(s)` + типизированное событие `colony-track-moved` (источник — карта) | `EventRecorder.recordColonyTrackMoved` |
| 8 | MarsBot карту не играет | — |

## 2. Общий шаг `MaximizeColonyTrack` и `trackTop`

```ts
// src/common/colonies/ColonyMetadata.ts
trackTop(metadata): number                      // = trade.quantity.length − 1 — ОДНА функция максимума
// src/server/deferredActions/MaximizeColonyTrack.ts
new MaximizeColonyTrack(player, cause: ChoiceContextSource)   // Priority.DEFAULT
step.previewSelectColony(): SelectColonyModel | undefined      // тот же промпт, без исполнения
skippedColonyTrack(reason?): {reason, skipped}                 // одно описание пропуска для превью и записи
```
- Кандидаты — активные тайлы с `trackPosition < trackTop`; отключённые — каждый с ОДНОЙ причиной.
- Ответ перечитывает позицию: шагов 0 (мир сдвинулся между вопросом и ответом) → названный пропуск, не падение.
- Клэмп движка (`Colony.increaseTrack`, `tradeTrackPlan`) читает тот же `trackTop` — «на максимум» и клэмп не разойдутся.
- **В файле карты нет своего `SelectColony` и нет записи `trackPosition`** (путь Наоми не копируется).
- Шаг превью `actionPreviews.colonyPickStep(card, step)` → `{kind: 'colonyPick', staged: StagedColonyModel}`; без
  кандидатов — `warningNote` с той же меткой и причиной, двери нет.

**Следующая карта «сдвиньте трек выбранной колонии» = этот шаг (или его брат с другой арифметикой `after`) +
`colonyPickStep`** — клиент читает `trackMoves`, ему переводить ничего не нужно.

## 3. Маркер `trackMoves`

`SelectColonyModel.trackMoves?: ReadonlyArray<{colony, before, after}>` — по записи на КАЖДОГО кандидата, 0-индексные
клетки, сериализуется собственным `toModel` ввода (вложение-безопасно). Клиент не считает «максимум − текущая» и не
решает, кто кандидат (инвариант 2). Его присутствие делает акт пика `track` (`colonyPickIntent`).

## 4. STAGED COLONY — четвёртая цель одного staged-хранилища

| | клетка | резолюция (TR03) | колония (TR07) |
| --- | --- | --- | --- |
| Цель хранилища | `{kind: 'cell', placement}` | `{kind: 'resolution', vote}` | `{kind: 'colony', pick: StagedColonyModel}` |
| Шаг превью | `boardPlacement.staged` | `delegateGrant` | `colonyPick` |
| Дверь композера / глагол | `board` · «Разыграть на поле» | `parliament` · «Выбрать резолюцию» | `colonies` · «Выбрать колонию» |
| Куда уходит экран | на поле (`yieldStackForStagedPlay`) | шаг Парламента в зоне руки | шаг колоний в зоне руки |
| Вход | `enterStagedPlacement` | `enterStagedVote` → **`enterStagedHostedStep`** | `enterStagedColony` → **`enterStagedHostedStep`** |
| Хвост батча | `{space, spaceId, stagedFor}` | `{party, partyName, stagedFor}` | `{colony, colonyName, stagedFor}` |
| Адрес (`stagedMismatch`) | промпт размещения карты | грант `SelectParty` карты | `SelectColony` с `choiceContext.source.card === stagedFor` |
| Коммит | `onStagedPlaySpacePicked` | `commitStagedVote` → **`commitStagedTail`** | `commitStagedColony` → **`commitStagedTail`** |
| Три исхода | `reconcileStagedPlayWorldMove` + пин | `settleStagedVote` | `settleStagedColony` |
| Уход | на поле | **`endHandWithHostedStep`** | **`endHandWithHostedStep`** (колонии едут в растворении руки) |

Что обобщено из TR03 (одна функция, не копия): `enterStagedHostedStep(arm, frame)` (RELEASE композера и прокси на месте
→ push кадра → размонтирование композера → `finishStagedPlayedLanding`), `commitStagedTail(response)`,
`cancelStagedPlay` (ветка «хостимый шаг» по виду цели), `endHandWithHostedStep` (по виду верхнего кадра). Что TR03 не
изменился — e2e `console-political-donation` зелёный без правок спека.

**Адрес хвоста.** `SelectColonyResponse` получил третью форму `{colonyName, stagedFor}`; `fleetDock` + `stagedFor` — не
ответ. Постройка, торговля, пик Aridor перед вопросом карты ПАРКУЮТ хвост без попытки; тайл, ушедший из кандидатов за
парковку, — честная устарелость (хвост сброшен, вопрос стоит живым); ручной ответ на свой вопрос экспайрит парковку.
Baseline-карта не нужна: кандидаты фиксированы промптом, сдвиг позиции — правило шага (0 шагов → пропуск).

**Три исхода коммита** (`settleStagedColony`): LANDED — в apply-блоке посеян холд и ход (§6), стейдж играет ход, затем
шаг и розыгрыш уходят вместе; RE-ASKED — стоящая сетка/стейдж становятся ЖИВОЙ дверью на месте (кадр получает
`serves: ['colony']` и якорь-промпт, презентация стейджа отпускается); PARKED (или потерянный ответ) — шаг уходит без хода.

**B — ровно один уровень**: стейдж → сетка (стейдж сам); сетка → композер (`handleSectionBack` → `cancelStagedPlay`,
оплата и фокус целы). Ввод на стейдже после A поглощён (`heldView`), отказ сервера отпускает его
(`stagedColonyCommitting` ↓ → `releaseFocusStage`).

**Колонии в зоне руки.** Рука публикует причал флотов в своей шапке (`data-colony-fleet-berth`, `berthOffered`), пока
хостит колонии, — встроенная секция не рисует строку-тулбар, которая крала бы высоту у сетки. Хвост крошки складывает
колонию в стадию: «КАРТЫ В РУКЕ › СПОНСОРЫ КОЛОНИЙ › ЛУНА · ТРЕК» (`colonyStepCrumbParts` — та же грамматика, что у
«Действий карт»); до спуска — «… › ВЫБОР КОЛОНИИ».

## 5. Проекция тайла и стейдж `track`

- **Тайл** (`ConsoleColonyTile`): проп `projectedPosition` (−1 = нет) — ячейка, которую тайл ЧИТАЕТ; есть → призрак
  маркера на ней, «+N», доход на ней; нет → торговля читает свой `tradeOffset` побайтно как прежде. Проекция стоит
  всегда, пока дверь открыта.
- **Рейл** сетки (`railMode 'track'`): «3/7 → 7/7 · Торговля здесь [сейчас] → [после]» — либо ОДНА причина.
- **Стейдж** (`ColonyFocusIntent 'track'`): инструмент — герой (маркер на текущей, `effective` на максимуме, шапка зоны
  «Маркер встанет на максимум +N» — `offsetCaption` по режиму, не по тексту); рейл — табло «3/7 → 7/7 +4» (одно число,
  которое перелистывается на посадке) и «ТОРГОВЛЯ ЗДЕСЬ» (доход в двух концах; фиксированная часть Redux-Венеры в обоих;
  бонус владельцев не печатается). Модель чтения — `colonyTrackMoveModel.colonyTrackMoveReading` (чистая, спек под
  серверным раннером). Команды: A «Разыграть карту» (staged) / глагол сервера (живая дверь) · X «Осмотреть» (досье) ·
  L3 «Источник» · B «Назад». Короткая панель (`--colfocus-h` как у pick/build).

## 6. Ход маркера — холд из диффа, ОДИН глайд

`src/client/console/colonyTrade/colonyTrackMove.ts`:
- **Обещание** на A (`promiseColonyTrackMove`) — staged-коммит и живая дверь.
- **Посев** в apply-блоке транспорта (`seedColonyTrackMoveHolds(before, after)` в `seedRewardHolds`): обещанный тайл
  сдвинулся вперёд между видами → `holdColonyTracks({[colony]: before})` + `owed`. ТОЛЬКО пока стоит стейдж
  (`registerColonyTrackMoveHost` — проба шелла); холд, который некому отпустить, не сеется.
- **Ход** (`playOwedColonyTrackMove`) = `requestColonyTrackWave([move], {anchors: 'stage', rhythm: 'rail'})` — тот же
  механизм, что волна RX29: `anchors: 'stage'` меряет `.con-colfocus [data-colony-track-cell]` (тайл — запасной),
  `rhythm: 'rail'` = короткий вдох (`TRACK_RAIL_BREATH_MS` 320 мс — маркер стоит на месте), ровный торговый
  `perCellMs` без пауз, чтение `TRACK_RAIL_READ_MS` 680 мс (класс `CARDLAND_READ_MS` стейджа). Касание клетки — реактивное `colonyTrackWaveState.touched` (клетка `--passed` на касании, её доход
  отвечает один раз — `--answer`); посадка отпускает холд (`settled` — lock-пульс), табло перелистывается.
  RX29 (`anchors: 'tile'`, `rhythm: 'wave'`) побайтно прежний.
- Нет измеримого трека → волна кончается `no standing table`, маркер встаёт в конечную позу, стейдж признаётся
  `data-colony-track-degraded` (e2e требует отсутствия). Отказ / B / конец потока → `clearColonyTrackMove` (в т. ч. в
  abort-батарее).
- Секция колоний не сворачивает стейдж своим `completeFlow`, пока дверь staged или ход должен/идёт (иначе снятие
  претензии розыгрыша через тик после ответа отправляло ход на тайл за закрытым стейджем).

**Уход.** `endStagedColony` → `endHandWithHostedStep`: кадр колоний снят, охраняемая концовка руки; рука уходит → её
растворение несёт колонии ВНУТРИ себя: секция остаётся смонтированной в зоне растворяющейся руки (латч зоны и пика,
`coloniesLeaving`), отпускается концом растворения (`handLeaveHook`). ⚠ `<transition>` колоний стоит СНАРУЖИ `<Teleport>`,
а `v-if` — внутри, поэтому собственного leave-хука на снятие кадра у секции нет — без латча она исчезала бы в кадре
до растворения руки. ⚠ Латч должен держать и ЛИЦО секции, не только её монтирование (найдено на приёмке — кадр
раскадровки показал сетку колоний, проступающую под гаснущим стейджем): ① pick латчится ДО `clearStagedPlay()` —
он живёт в staged-хранилище (`endStagedColony` читает его первым и передаёт в `endHandWithHostedStep(pick)`);
② watcher `consoleState.section` сбрасывает фокус колоний, когда их кадра больше нет, — на время поездки сброс
отложен до её конца (`releaseColoniesLeave` делает `resetColonyFocus` + `resetConsoleColoniesUi`). e2e держит
это пробой `leaveMisses` (сетка не распарковывается, стейдж не уходит раньше секции).

**Живая дверь** (вне границы v1, RE-ASKED, reload): тот же экран — A «Выбрать» → `submit(colonyResponse)`, обещание хода,
презентация стейджа удержана; `colonyFollowUpLive` держит кадр, пока ход должен/идёт; затем обычная концовка шага.

## 7. Значок `COLONY_TILE`

`premiumCardIcons.mechItemIcon`: `COLONY_TILE` → `assets/misc/colony-tile.png` (256×154, альфа) с модификатором
`pcard-ic--pill` (ширина = 1.66 × высоты значка — пропорция ассета; квадратный держатель с `contain` печатал пилюлю на
60 %). Журнальный чип `colony-tile` (`iconClassFor` → `resource_icon--colony-tile`, contain). Пять лиц «до / после» —
в приёмке (кадры в отчёте задачи).

## 8. Известные границы (записано, не спрятано)

- **RU-ряд лица** «ВЫСТАВИТЬ [плитка] НА МАКСИМУМ» в одну строку не влезает и переносится на две (кадр приёмки) —
  предложение владельцу: принять перенос, или короче («[плитка] НА МАКС.»).
- **PARKED на клиенте не прогнан руками**: в пуле нет триггера, который вклинил бы чужой `SelectColony`/вопрос перед
  вопросом карты при её розыгрыше (метка Юпитер). Серверная половина закреплена юнитом.
- **Живая дверь** (`start ⊃ hand`, standalone, reload) e2e не гонялась — общий код с staged-дверью + путь живого пика.
- **B из сетки** снимает кадр колоний сразу (секция встроена, собственного ухода нет), композер возвращается своим
  entrance — без растворения сетки.
- **Чип журнала** `colony-tile` в квадратной ячейке чипа — пилюля вписана (`contain`), т. е. мельче остальных значков.
- **Подпись «ТОРГОВАТЬ» на тайле** рядом с «17 [M€] +4» режется многоточием в своей ячейке на fhd у Луны и Ио (на 4K —
  у всех тайлов, и без проекции: дефект профиля TV тайла, отмечен ещё в TR06). Честный срез (многоточие в своём боксе),
  но проекция «+N» на каждом кандидате делает его частым — кандидат на отдельную правку ячейки дохода тайла.
- **Наблюдение вне TR07**: рука, в которой НЕТ ни одной играбельной карты, на своём ходу пишет в вердикте лишнюю
  причину «Сначала завершите текущее действие» (сервер не предлагает «Сыграть карту» → `handTurnWindowClosed`
  читает это как закрытое окно; логика из «UI rework», не TR07). Кадр приёмки «нет своей колонии» её показывает.

## 8a. Приёмка 2026-10-01 — замеры, A/B, кадры

**e2e карты** `console-colony-sponsors.spec.ts` (фикстура `colony-sponsors`): fhd и tv4k зелёные, `--repeat-each=4` —
8/8. Приёмка нашла дефект ухода (сетка проступала под гаснущим стейджем, §6 «Уход») — фикс `bd8bf80c6a`; проба
`leaveMisses` на сборке ДО фикса красная (8 сэмплов «grid un-parked»), на сборке с фиксом — 2/2 зелёные.

**Тайминг** (fhd, проба MutationObserver + 25 мс, отсчёт от нажатия):

| Отрезок | мс |
| --- | --- |
| «Выбрать колонию» → сцена посадки (карта ложится в «Разыграно») | 0 → ~1280 |
| колонии поднимаются в той же зоне, крошка «РАЗЫГРАНО → ВЫБОР КОЛОНИИ» одной ячейкой | ~1280 → ~1540 (композер отпущен на ~1540) |
| A на стейдже → первая пройденная клетка (POST + apply + вдох 320) | ~710 |
| клетки 4 · 5 · 6 · 7 | 711 · 811 · 935 · 1035 (ритм `rail` ≈ 100 мс/клетка) |
| посадка маркера на 7, табло перелистывается в «7/7» | ~1250 |
| чтение → растворение руки (стейдж — единственная уходящая поверхность) | ~1940 → ~2350 |
| поле | ~3220 |

**Регрессия соседей** (12 файлов / 31 тест, `--workers=1`, свои снапшоты): «до» — клиент HEAD~1 (`16eb841cd0`, без
клиента TR07) в `.e2e-tr07base` — **31/31**; «после» на сборке до фикса — **31/31**; «после» на финальной сборке —
**32/33** (31 соседних + TR07 ×2; красный — один, ниже). `e2e:affected` сверх набора (канарейка драйвера, blue-action-receive, card-trade-entry,
colony-reward-rail, colony-vesta, parliament-climate, parliament-colony, play-landing-probe, surface-motion,
colony-inspect-probe + TR07) — **37/37**. `console-staged-play` «play → board → B → composer restored…» —
ДАВНЯЯ ГОНКА staged-клетки, не TR07: A/B на тихой машине ×6 — «после» 2/6, «до» (клиент без TR07) **0/6** зелёных;
утром и в 16:55 оба зелёные. Диагностика падения (эхо ввода + `__conReady` после B): B ПРИНЯТ (`consumed`), холдов нет,
транспорт свободен, но стек workspace уже пуст и «уступлен» (`wsDepth 0`, `wsYielded true`) — кадра руки нет, B
нечего восстанавливать; лишний `evaluate` перед B (сдвиг на миллисекунды) делает тест зелёным — гонка. Кандидат
на разбор владельцем staged play (`docs/TILE_PLAY_STAGED_COMMIT.md`); TR07 спек не трогал.

**Кадры** (`.e2e-tr07/shots/`, не в репозитории): лицо EN/RU и пять лиц `COLONY_TILE` до/после; композер с дверью и
строкой шага; «нет своей колонии» (причина «Требуется колоний: 1 · Сейчас: 0»); «все треки на максимуме» (предупреждение
пропуска, CTA «Разыграть карту»); раскадровка ритуал → сетка (26 кадров CDP); сетка с проекциями и рейлом; стейдж
`track` до коммита; раскадровка хода (маркер на 3 после A · в пути · посадка на 7 · табло 7/7 · растворение); поле;
журнал («Спонсоры колоний → [плитка] +4 Трек колонии · Луна 3 → 7», оплата −5); нотификация соперника («карта
сыграна … [плитка] +4, −5 M€»); 4K и Deck — композер, сетка, стейдж, поле.
