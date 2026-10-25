# Turmoil Redux · TR72 Banned Delegate:redux («Изгнание делегата»)

Вторая карта-замена набора (2026-10-24; шаблон — TR71 `7d284dc2df`). Впервые: **карта снимает ОДНОГО ЧУЖОГО делегата
со стола Парламента** — с резолюции области голосования или из области Народной поддержки. Новая механика целиком:
операции Парламента «снять одного», общий шаг `RemoveDelegate` с серверным прогнозом на каждую фигуру, ввод
`SelectPartyDelegate` (маркер `delegatePrompt`) и третий режим Парламента — **`delegate`** («ИЗГНАНИЕ»): курсор ходит
по ФИГУРАМ. Режим наследует TR74 Recruitment (§6).

Промт: `docs/claude/prompts/replacement-banned-delegate.md`. Соседи: `docs/TURMOIL_REDUX_PARTY_SANCTIONS.md` (TR12 —
режим области, грамматика «уходящих» кубов, staged-дверь), `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` (TR03 — одна
дверь голосования, адресованный хвост), `docs/claude/parliament-glossary.md` §3-bis (фигура) и §9-quater (этот режим).

## 0. Решения (по умолчанию промта — подтвердить у владельца)

1. Стадия и слово — **«ИЗГНАНИЕ»** (`Banishment`): крошка `КАРТЫ В РУКЕ › ИЗГНАНИЕ ДЕЛЕГАТА › ИЗГНАНИЕ`, кикер ленты.
2. Какой куб владельца уходит — **ПОСЛЕДНИЙ** (`seq` max — симметрично `removeLatestVote`): ранний — тайбрейкер
   владельца — остаётся; игрок выбирает владельца и место, одна фигура под курсором = «один делегат X здесь».
3. Прогноз в панели — **четыре строки, каждая только при изменении**: «ДЕЛЕГАТЫ 3 → 2» (или «НАРОДНАЯ ПОДДЕРЖКА 2 → 1»),
   «ЛИДЕР [фигура] → [фигура]», «ПОБЕЖДАЕТ «R» → «R′»», «ЭФФЕКТ ПАРТИИ «X» → Потеряно» (владельца фигуры, все дороги —
   и альянс TR62); всё — серверная проекция.
4. Полёт — фигура **«взял → понёс → поставил»** с ленты / места плашки на стопку резерва хозяина или в общий запас.
5. e2e — `console-banned-delegate.spec.ts` (tv4k; fhd — только раскадровка).
6. **Панель чтения стоит над рядом КАРЬЕРЫ**, не над областью голосования (отклонение от буквы промта, см. §3): в этом
   режиме цели — фигуры на ЛЕНТАХ резолюций и в местах ПЛАШЕК; панель над голосованием закрыла бы половину целей.

## 1. Карта и правила

TR72, 0 M€, EVENT, меток нет, ПО нет, `requirements: {chairman: true}` (знак кресла T10), `reimplements: BANNED_DELEGATE`
(арт `T02.webp` — картинка владельца, лор `T02` «You are not welcome in our chambers.» → «Вам не рады в наших палатах.»),
лицо `b.minus().delegates(1, {all})`. Описание — новый EN-ключ «Requires you to be Chairman. Remove any delegate from a
resolution or Popular Support area.»; имя — классическое «Изгнание делегата» через `:variant`-fallback.

| # | Правило | Где закреплено |
| --- | --- | --- |
| 1 | Требование — председательство сейчас; иначе причина «требует председательства · председатель сейчас: X / кресло свободно» | `BannedDelegateRedux.spec` § rule 1 |
| 2 | ЛЮБОЙ делегат: чужой, свой, MarsBot'а (D12), нейтральный; лидера тоже (оговорки «не-лидер» нет) | § rules 2–4, `RemoveDelegate.spec` |
| 3 | Места — резолюция ОБЛАСТИ голосования или область поддержки; не принятая резолюция, не кресло, не лобби | `RemoveDelegate.spec` § figures |
| 4 | Уходит последний куб владельца; игрок → резерв, нейтральный → общий запас; лидер / победитель / доступ пересчитываются живьём; `onDelegatesDiscarded` не зовётся | `RemoveDelegate.spec` § answer |
| 5 | Стол без фигур → карта НЕ играется, причина «На резолюциях и в областях народной поддержки нет делегатов» | § rule 5 |
| 6 | Превью = исполнение: staged-дверь несёт тот же промпт с прогнозом | § rule 6 |
| 7 | MarsBot карту не играет (ветка бота в шаге — первая фигура по порядку стола); save/load — обычная карта, `lastRemoval` не сериализуется | § save, `RemoveDelegate.spec` § MarsBot |

## 2. Сервер

```ts
// Parliament
removeVote(slot, owner: Delegate): Vote | undefined   // ПОСЛЕДНИЙ куб владельца; removeLatestVote = removeVote(slot, player.id)
removePopularSupport(party, n): number                // один нейтральный из области → запас
withoutDelegate(party, place, owner): Parliament       // одноразовый стол для прогноза (projection + гранты + поддержка)
lastRemoval: ParliamentRemovalRecord | undefined       // запись для клиента (НЕ сериализуется; seq от gameAge)
// parliament/RemoveDelegate.ts — общий шаг
RemoveDelegate.targetsOf(game, parliament): DelegateTargetProjection[]   // чистое; порядок стола
new RemoveDelegate(player, cause).previewSelectParty() / execute()
// inputs/SelectPartyDelegate.ts — type 'party', marker delegatePrompt
answer: {type: 'party', partyName, delegate: {place: 'resolution'|'support', owner: Color|'neutral'}, stagedFor?}
```

- **Строки-цели** (`DelegatePromptMeta.targets`): по резолюции — по строке на владельца (`count` — его кубы),
  по партии — строка для непустой области. `returnsTo`, `total {current, resulting}`, и только при изменении —
  `leader`, `winner {party, owner}`, `effectsLost` (через `accessBasis` до/после на `withoutDelegate`).
- **Событие** `delegate-removed` (`impact.delegateRemoved`, жертва — `target.player`, нет для нейтрального и своего);
  журнал рисует строку ЖЕРТВЫ («[делегат] −1» · резолюция / область); полоса жертвы — враждебная («−1 [делегат]»,
  атакующий — игравший); семья гарда кросс-доставки **`delegate-attack`** (токен `RemoveDelegate`, сценарий S22).
- Адрес pre-select: `delegatePrompt` — «свой» вопрос карты (`promptAddressOf`), хвост ложится только на него.
- Потеря эффекта партии объявляется общим диффом доступа (`announceAccessChanges`).

## 3. Клиент — режим `delegate` («ИЗГНАНИЕ»)

**Одна дверь Парламента, третий режим.** `PlayDoor {kind: 'parliament', staged, mode: 'delegate'}`; CTA «Выбрать
делегата», строка «Делегат — выбор в Парламенте». Staged-хранилище — та же цель `resolution`; мост
`parliamentPromptBridge` получил `delegatePick: {model, meta, card?, staged?}` и `delegatePickResponse(bridge, target)`.

- **`ParliamentStage 'delegate'`** (`armDelegatePickFlow`, `parliamentDelegateUp`; поля `delegateStage / Cursor /
  Committed / Live / Beat / Snapshot / Meta`). Наблюдатель `bridge.delegatePick` (immediate) армирует позу до рендера.
- **Кольцо** (`delegatePickModel.ts`, чистое): фигуры лент слева направо (внутри резолюции — по фигуре, которая уйдёт),
  затем области в порядке плашек. **Пространственная навигация**: ◀ ▶ по фигурам стола (упор справа), ◀ с первой —
  в колонку областей; ▲ ▼ по колонке (упоры), ▶ — обратно на первую фигуру стола. Ничто не двигается (e2e сверяет
  rect всех резолюций и плашек).
- **Фигура под курсором «уходит» ФОРМОЙ**: бледная, след пунктирный янтарный; кольцо — курсор (`.con-cursor-ring`,
  единственный свет — инвариант 15). На ленте — `con-parl__vote-cube--outgoing` (`data-delegate-outgoing`), на плашке —
  `ConsoleSupportPlaces.outgoing = 1` и фокус плашки.
- **Панель** `ConsoleParliamentDelegateMode.vue` — над рядом Карьеры (`.con-parl--delegate .con-parl__agenda` уходит
  в прозрачность, бокс не меняется): фигура владельца (пунктир), имя, «С резолюции «R»» / «Из народной поддержки
  «X»», «→ В резерв игрока X / В общий запас», «Единственная цель» при одной фигуре, факты строками голосования
  (`ConsoleVoteFactRow`, `delegateFactsOf`), квитанция карты, CTA.
- **Лента**: кикер «ИЗГНАНИЕ» + «[фигура] владелец · [резолюция]» / «· [партия] · Народная поддержка» (`BandDelegate`).
- **Полоса**: staged — «Разыграть карту · Осмотреть · Источник · Назад»; живая — «Изгнать делегата · … · Свернуть»;
  после A — статус «Выполняется…» → «Делегат изгнан». X — резолюция / плашка под фигурой; L3 — карта.

## 4. Полёт после одного A

1. Ответ несёт **запись** `ParliamentModel.lastRemoval` (место, владелец, `vote` — `seq` самой фигуры, `returnsTo`).
   Обещания на A нет: клиент читает запись, не дифф.
2. **Сев в apply-блоке** (`seedDelegateRemovalHolds` — `gameTransport.seedRewardHolds` и `App.update`): свежий `seq` при
   стоящем режиме → `standing` (лента возвращает фигуру `delegateRemovalGhostVote`, плашка — `+1` место) и `toDest`
   (резерв `delegateRemovalReserveHeld` / запас `delegateRemovalPoolHeld` не считают её). Первый кадр (reload) только
   узнаёт `seq`; reduced motion / нет режима — ничего не держит.
3. **Такт** (`delegateRemovalScene.flyRemovedDelegate`): фигура с ленты (`[data-instance] .con-parl__ribbon [data-seq]`)
   или с последнего места плашки — в `[data-parl-seat-reserve="<color>"]` / `[data-parl-neutral-cube]`; место гаснет
   на ОТРЫВЕ, счёт назначения тикает на КАСАНИИ. Промах — `data-parl-delegate-degraded`.
4. Чтение 520 мс → `flow-complete('delegate')` → `endStagedVote` → рука и Парламент уходят одной поверхностью.

Три исхода: LANDED (запись пришла) → полёт; RE-ASKED (живой `delegatePrompt` карты) → режим становится живой дверью
на месте; PARKED → уходит целым.

## 5. Доказательства

- Сервер: `RemoveDelegate.spec` (20), `BannedDelegateRedux.spec` (16), S22 кросс-доставки, `test:server` 18116 зелёный.
- Клиент: `tests/client/console/stagedDelegate.spec.ts` (кольцо, чтение, мост, полоса, лента, дверь, удержания).
- e2e: `console-banned-delegate.spec.ts` — поток (ничего до A, одна крошка, один экземпляр, курсор не двигает столы,
  панель печатает прогноз сервера, B → композер, ОДИН POST с адресованным хвостом, лента теряет фигуру ДО того как
  резерв её считает, полёт виден, сервер согласен, конец на поле) + `-locked` (чип руки называет председателя) и
  `-empty` (названная причина).

## 6. TR74 Recruitment — ОБМЕН (СДЕЛАНО 2026-10-25)

«Нейтральный делегат на резолюции ↔ свой из резерва» — тот же выбор фигуры, ни второго режима, ни второго ввода.

- **Сервер.** `new RemoveDelegate(player, cause, {source: 'exchange'})`: цели — `RemoveDelegate.exchangeTargetsOf(player,
  parliament)` (по строке на резолюцию с нейтральным кубом; ни областей, ни кубов мест; оговорки «не-лидер» нет); прогноз
  строки — после ОБОИХ ходов (`withoutDelegate` + свой куб ПОСЛЕДНИМ на копии): `total` стоит, `arrives {owner, count}`
  («мои на R n → n+1»), `leader` / `winner` при изменении, `effectsGained` (второй делегат открывает эффект партии).
  Две причины по порядку — стол («No neutral delegate stands on a resolution»), резерв (ключ TR03 «No delegate in your
  reserve»); `previewSkip()` — одна функция для причины руки, предупреждения превью и записи пропуска (`DELEGATE_EXCHANGE_LABEL`).
  Ответ — ОДНА операция, перечитанная на ответе: пустой резерв / ушедший куб = именованный пропуск и НИЧЕГО не двигается;
  `removeVote(slot, NEUTRAL)` → общий запас, `placeVote(player, slot, 'reserve')` (даром, не лобби) — новый `seq`, ничья —
  по правилу (ранний первый делегат). Одна строка журнала, два факта (`delegate-removed` без жертвы · `delegates-placed`),
  квест «отправить N делегатов» считает; запись `lastRemoval.exchange = {vote}` — обе фигуры. Промпт —
  «Recruit delegate», `choiceContext.mode: 'reward'`.
- **Клиент.** Стадия `DELEGATE_STEP_STAGES.exchange = 'Exchange'` — **«ОБМЕН»** (не «ВЕРБОВКА»: имя карты и стадия совпали бы —
  «ВЕРБОВКА › ВЕРБОВКА»). Кольцо — строки сервера (клиент ничего не отбирает). Панель: «уходит» (нейтральная фигура, «→ В общий
  запас») + строка «приходит» (своя фигура, «Ваш делегат из резерва → на «R»», `data-parl-delegate-arrives`); факты — «ВАШИ
  ДЕЛЕГАТЫ 1 → 2» вместо «ДЕЛЕГАТЫ 3 → 3», лидер, победитель, «ЭФФЕКТ ПАРТИИ «X» → Получено». Лента — «[нейтральная] · R · на его
  место · [своя]». Полоса — «Завербовать делегата» → «Делегат завербован».
- **Полёт — ДВА хода одной фразой.** Нейтральная фигура «взял → понёс → поставил» с ленты в общий запас (лента тикает на
  отрыве, запас — на касании), СРАЗУ за ней своя — со стопки резерва (`[data-parl-seat-reserve]`, `flyExchangedDelegate`) на
  свой голос той же ленты (резерв тикает на отрыве, лента — на касании; счёт ленты n → n−1 → n). Холды —
  `delegateExchangeArrival` (голос нарисован скрытым — измерим, — лента его не считает, лидер — прежний из прогноза) и
  `delegateExchangeReserveStanding`. Под одним холдом `parliament-delegate-removal`.
- **Доказательства.** `RemoveDelegate.spec` § exchange (13), `RecruitmentRedux.spec` (16), `stagedDelegate.spec` § exchange (7),
  e2e `console-recruitment.spec.ts` 3/3 на Steam Machine (фикстуры `recruitment`, `-locked`, `-no-reserve`; ходы по очереди —
  лента 2→1 · запас +1 · резерв −1 · лента 1→2).
- **Попутно для TR72:** после A чтение — выбранная фигура, не курсор: метка «Единственная цель» больше не выводится из кольца,
  которое уже изменил ответ (`sole: false` у снимка).

## 7. Известные границы

- Чужой экран (жертва с открытым Парламентом) не играет полёт фигуры: запись `lastRemoval` сеется только при стоящем
  режиме делегата у зрителя; у жертвы лента и резерв обновляются с ответом (как прежде для чужих действий без
  отдельной сцены). Нотификация жертве — есть.
- Живая дверь (RE-ASKED / reload) собрана теми же путями, что у TR12; руками не прогонялась (нет естественного триггера).
