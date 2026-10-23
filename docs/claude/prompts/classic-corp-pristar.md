# Промт исполнителю · Pristar (R07, корпорация Turmoil) — ЧЕТВЁРТАЯ и ПОСЛЕДНЯЯ корпорация «на месте» (после неё hold-back-список ПУСТ — классический Turmoil адаптирован целиком, 22 из 22): без меток; 53 M€; «понизьте РТ на 2 шага»; держит ресурс СБЕРЕЖЕНИЕ (1 ПО за каждый); ЭФФЕКТ «в фазе производства, если вы не получали РТ в этом поколении — +1 сбережение сюда и +6 M€» · ГЛАВНОЕ (владелец): **ВИЗУАЛЬНЫЙ ИНДИКАТОР на иконке РТ — менялся ли РТ в этом поколении (сработает эффект или нет), ТОЛЬКО у игрока с этой корпорацией; подача премиальная, понятная и НЕ шумная** — грамматика уже есть: печать вето RX42 на той же иконке (`.con-score__veto`, `data-tr-vetoed`, `premium-tooltip` + `data-hint`); флаг `hasIncreasedTerraformRatingThisGeneration` сегодня живёт ТОЛЬКО на сервере — его надо вынести в модель; без полировки (как у трёх предыдущих корпораций)

> **Статус: ВЫДАН 2026-10-23.** HEAD `e02eef9f34` (R33 Utopia — сдана: палитра шести вариантов, цена-производство с бейджа; CI финал — сдан; R38 / R14 —
> сданы; в дереве незакоммиченные `ConsolePartyPlaque.vue`, `parliamentEffectsModel.ts`, `console_party_plaque.less`, `parliamentEffectsStep.spec.ts`,
> `partyAlliance.spec.ts` — СОСЕДА (`terraforming-mars-7d` busy / `-c9` waiting / `-a1` idle), не трогать; `ListAgents` + `SendMessage` до первого коммита).
> Реестр: footer «PL-980», последний раздел **CI**. **Эта задача — БЕЗ своего раздела** (полировки нет); дефекты общего слоя — строками в раздел текущего
> footer в момент записи. **Лор и арт ЕСТЬ**: `assets/text/lore_texts.json:483` ключ `R07` (EN) + RU `src/locales/ru/lore_texts.json:483`; арт
> `assets/card-images/R07.webp` ЕСТЬ, но в `src/genfiles/cardArtManifest.json` ключа `R07` НЕТ (R14 / R33 / R38 есть) — после `npm run make:cards` проверить,
> что манифест подхватил файл и `cardInfoAudit` не ругается; если манифест не регенерируется из каталога — выяснить, кто его пишет, и добавить ключ тем
> же путём (не руками мимо генератора). Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\corporations\Turmoil - Pristar.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- pristar …`; exit 2/3/4 → спросить; стенд — FUNCTIONAL + одна сцена поколения (TIMING-класс
> `console-generation-scene` — `--exclusive --workers=1`)).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:147` п. 5 — бот не трогается; `:149` п. 6 — двойник прогноза для ЖИВОГО хука: у Pristar хук
`onProductionPhase` — семейство прогнозов ICard его не знает, см. диагноз 4; `:216` строка «ждёт»), `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**),
**промты и коммиты трёх корпораций** (`c159574f3d` Lakefront, `569e7ba305` TerraLabs, `b51616c520` + `0a43ad6f03` Utopia) — шаблон: `infoText` + RU
`card_info` + строка в `turmoil_corporations.json` каждой локали + спек в правилах + `AutomaCorporations.spec` коллизия + пин + комментарий бот-e2e.
**Контракты индикатора:** память **`turmoil-redux-unmi-veto`** (RX42: печать на ячейке РТ — `data-tr-vetoed`, хинт одной фразой, «красный — язык партии,
никогда единственный сигнал»; поверхности B1 с кадрами 4K), `console-score-header` (блок `.con-score` — шапка левой панели; маска «Приватный счёт»),
`rail-material-glass-plate` (CF: материал планшета — печать ложится на стекло, не на плиту), `status-line-no-face-restatement` (владелец 2026-10-23: не
повторять лицо — только дельта/состояние игрока: индикатор = СОСТОЯНИЕ, не пересказ эффекта), `info-polish-restrained` («сдержанно и дорого»),
`notification-source-and-glance-rule`, `polish-priority-tv4k-no-deck-only`, `console-reading-typography`; `.claude/rules/console-ui.md` § THE GENERATION
CHANGE IS ONE SCENE (`:609–616`, TR61 — доход как событие; «хук заплатил что-то ещё» — честный деград PL-607), `.claude/rules/client-ui.md` (`.premium-tooltip()`
+ `data-hint`, инвариант 5), инварианты 1–2 (состояние — серверный маркер, НИКОГДА вывод по журналу на клиенте), 4, 6–9. Журнал — `docs/claude/
turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **карта** — `turmoil/Pristar.ts` (`CorporationCard`; `resourceType: PRESERVATION`; `victoryPoints: {resourcesHere: {}}`; `behavior.tr: −2`;
`onProductionPhase` `:40–45`: `!hasIncreasedTerraformRatingThisGeneration` → `stock.add(M€ 6, {log, from: {card}})` + `addResourceTo(this, 1)`; лицо —
`megacredits(53) − tr(2)`, `corpBox('effect')`: `tr(1, {cancelled}) → resource(PRESERVATION) + megacredits(6)`, `cardNumber: 'R07'`); **флаг** — `Player.ts:225`
(поле), `:586–596` (ставится в `increaseTerraformRating` — ЛЮБОЙ рост: карты, шкалы, Парламент; НЕ ставится понижением), `Game.ts:1363` (сброс на
смене поколения), `:3397/3536` (сериализация), `IPlayer.ts:250`; читатели — `corporation/UnitedNationsMarsInitiative.ts:43–49` («Your terraform rating was not
raised this generation» — причина действия UNMI: ТОТ ЖЕ флаг, противоположный знак), `turmoilRedux/EarthArmyContract.ts:67`; **модель** — `common/models/
PlayerModel.ts:70–96` (`PublicPlayerModel` — флага НЕТ; поля публичные: `cardCost`, `influence`…), `models/ServerModel.ts:~650–665` (сборка); **фаза
производства** — `Player.ts:1108–1225` (`runProductionPhase`: `events.beginProductionPhase` `:1130` → доход → запись `productionIncome` → **хуки `:1215`
ВНУТРИ фазы**), `tests/events/productionIncomeJournal.spec.ts:24, :167` («a card's onProductionPhase (Pristar) pays INSIDE the phase under its own source» —
УЖЕ запинено), `console/generationScene/generationScene.ts:196–230` (`generationIncomeReward` — обещание волны: рейтинг + доход; хуки — `known`/деград
PL-607, `tests/console/generationScene.spec.ts:121`), e2e `console-generation-scene` (A–E); **печать на иконке РТ** — `ConsoleResourcePanel.vue:14–30`
(`.con-score__cell--tr` с `:class {--vetoed, premium-tooltip}`, `data-tr-vetoed`, `data-hint`, `<i class="con-score__veto">` внутри `__iconwrap`), `:553–556`
(проп `trVeto` от шелла — `ConsoleShell.vue:118/2882` читает `parliament.enacted.trVeto`), `:663–668` (`trVetoHint` — одна фраза через `translateTextWithParams`),
`:570` (`own`), стили `console.less:5190–5215` (`&__veto` — кольцо + штрих, `inset: −.1rem`, красный тон; `&__cell--vetoed &__value--tr`),
`ConsoleInfoMode.vue:620–628` (`viewedRatingVeto` — та же печать у ОСМАТРИВАЕМОГО места в «Информации»); e2e `console-score-header.spec.ts`,
`console-parliament-unmi-veto.spec.ts` (B1 — печать с кадрами); **лицо** — `premiumCardIcons.ts:75–80` (`cardResourceIconUrl` — `assets/resources/preservation.png`
ЕСТЬ), `:661–663` (`cancelled` — зачёркнутый значок, бот C36 e2e `console-bot-corp-cancelled.spec.ts` «struck-through icon the human Pristar uses on its own
cancelled TR»), VP-глиф `1/[сбережение]` — `PremiumVpCardGlyph` (generic `resourcesHere`); RU ресурса — `help_iconography.json:12` «Preservation» → «Сбережение»;
**бот-двойник** — `common/automa/MarsBotCorpData.ts:1044–1050` (C36 `original: CardName.PRISTAR`), e2e `console-bot-corp-cancelled.spec.ts:11–12` («Turmoil is
off in this config…» — УСТАРЕВАЕТ, поправить словами); **гарды** — `tests/automa/AutomaCorporations.spec.ts` (коллизии C35/C38/C39 — шаблон для C36),
`TurmoilCardsUnderRedux.spec.ts` (`adaptedCorporations = [LAKEFRONT, TERRALABS, UTOPIA]` → + PRISTAR; после — hold-back пуст: проверить, что гард «list
empty» не ломает worklist-принтер), `tests/cards/turmoil/Pristar.spec.ts` (один `it`), `cardInformation`, `cardLore` (R07), `premiumScope`, `CardMetadata`,
`armedPlayEffectCoverage`, `crossPlayerCoverageGuard` («none» — платит только себе), `effectForecastCoverage` / `effectForecastParity` (хук вне семейства —
убедиться, что гард молчит), `PremiumCard` / `premiumCardViewModel`, `cardVictoryPointsAtPlay`; спек-шаблон — `tests/cards/turmoil/UtopiaInvest.spec.ts` /
`TerralabsResearch.spec.ts:65–210`.

---

## Диагноз (подтверждён файл:строка на `e02eef9f34`; перепроверить на своём HEAD)
1. **Карта декларативна в розыгрыше, хук — в фазе производства.** `tr: −2` и 53 M€ — Executor; `onProductionPhase` платит ВНУТРИ фазы под своим
   источником (`productionIncomeJournal.spec:167` уже пинит) — журнал и события честны; сцена поколения TR61 обещает волну по ЗАПИСИ дохода
   (`generationIncomeReward`: рейтинг + шесть строк), а «+6 M€ от Pristar» — это «хук заплатил что-то ещё» → честный деград PL-607 (счётчик тикает с коммитом,
   сцена идёт). Для Pristar это КАЖДОЕ поколение без РТ: +6 M€ и +1 сбережение придут без волны и без имени. Нужен ОТВЕТ СЦЕНЫ: хук фазы производства —
   ещё один ряд волны «Pristar · +6 M€» после дохода (источник — карта, из записи события `from: {card}`, не вычисление) и «+1 сбережение» на герое
   корпорации (чип ресурса на лице в «Разыграно»/доке — существующий путь `cardGain`); под `known` — только если запись не несёт источника.
2. **Флаг не в модели.** `hasIncreasedTerraformRatingThisGeneration` — только сервер. Индикатор обязан читать СЕРВЕРНЫЙ маркер (инвариант 1–2), не выводить из
   журнала/дельты РТ: нужно публичное поле `PublicPlayerModel` (рост РТ — публичный факт; UNMI читает тот же флаг) — например `ratingRaisedThisGeneration:
   boolean` — + сборка в `ServerModel`, + `tests/models/ServerModel*.spec` / `PlayerModel` гарды.
3. **Печать на иконке РТ уже есть — вторая.** RX42 поставила на `__iconwrap` ячейки РТ ПЕЧАТЬ вето (кольцо + штрих, хинт одной фразой, `data-tr-vetoed`,
   та же печать у осматриваемого места в «Информации»). Индикатор Pristar — ВТОРОЙ вид печати той же ячейки: грамматика общая (слот, хинт, data-атрибут,
   проп от шелла / `viewed`-чтение в Info), краска своя — и правило сосуществования: вето (красный штрих) и сбережение могут стоять ОДНОВРЕМЕННО (игрок с
   Pristar под вето — редко, но закон нужен: две печати — два слота по углам, не наложение).
4. **Семантика двух состояний.** `raised = false` → «эффект СРАБОТАЕТ в фазе производства» (ожидание награды, спокойный свет); `raised = true` → «эффект НЕ
   сработает» (РТ вырос — печать гаснет или переходит в тихое «отменено»). Владелец: «понятно и не шумно» — показывать ТОЛЬКО игроку с Pristar
   (`tableau` содержит `PRISTAR` — проверка по модели `playedCards` осматриваемого места), ни одной анимации на тик (переход состояния — один мягкий
   crossfade ≤ 260 мс через `motionMs`), никакого пульса; ОБА состояния читаемы без цвета (форма: значок сбережения — «ждёт» / тот же значок перечёркнут —
   «в этом поколении уже нет»). Прецедент «cancelled» — зачёркнутый РТ на лице карты (бот C36, лицо Pristar) — ТОТ ЖЕ язык.
5. **Лицо и информация.** `resourceType: PRESERVATION` → держатель ресурса на лице корпорации (капсула счёта — бот C36 e2e пинит, что капсула печатает число из
   живой `CardModel`); VP «1/[сбережение]» — generic; `tr(1, cancelled)` в коробке эффекта — есть; `infoText` — нет (effect-short + VP-строка авто); RU:
   `turmoil_corporations.json:17–18` «Вы начинаете с 53M€. Уменьшите свой РТ на 2…» — не голос набора; имя — латиницей (`zz_corporation_names.json:137`).
6. **Стартовая сцена / первый кадр.** РТ 18 с первого кадра (−2), 53 M€; сводка «ИТОГО» — РТ не печатает (TerraLabs — тот же вопрос: как решено там —
   повторить, не изобретать).
7. **Остальное по шаблону:** коллизия C36; пин корпораций; комментарий бот-e2e; `crossPlayerCoverageGuard` «none»; MarsBot C36 (четыре зачёркнутые шкалы +
   кубик) — ни строки.

## Правила корпорации (спек пинит каждое — по шаблону Utopia / TerraLabs)
1. Печатная: 53 M€, без меток, розыгрыш → РТ −2 (18 в соло/мульти с 20), держатель СБЕРЕЖЕНИЯ, 1 ПО за ресурс, без первого действия, `R07`; Redux-стол раздаёт.
2. Эффект: в фазе производства поколения G — если `hasIncreasedTerraformRatingThisGeneration === false` → +6 M€ (событие с источником-картой, внутри фазы) и
   +1 сбережение; иначе ничего (и никакого «пропуска» в журнале — это не потеря, это условие); флаг ставит ЛЮБОЙ рост РТ (карта, шкала, стандартный проект,
   резолюция Парламента / награда Карьеры Redux; UNMI-вето RX42 — рост ОТКАЗАН → флаг НЕ ставится — пинить!), НЕ ставит понижение; сброс — смена поколения;
   поколение 1 с −2 на старте — эффект срабатывает в первой фазе производства (флаг не тронут понижением).
3. Модель: `PublicPlayerModel.ratingRaisedThisGeneration` для каждого места (публично); сериализация флага ✓ (пин round-trip).
4. ПО: `victoryPoints: resourcesHere` — счёт по ресурсам (финал, досье, «Информация»), `cardVictoryPointsAtPlay` 0; бот-коллизия C36; `crossPlayerCoverageGuard` «none».

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения трёх корпораций не переспрашивать)
1. **RU** — имя латиницей; описание — «Вы начинаете с 53 M€. Понизьте ваш РТ на 2 шага. 1 ПО за каждый ресурс сбережения здесь.»; эффект — «Эффект: в фазе
   производства, если в этом поколении вы не получали РТ, добавьте сюда 1 ресурс сбережения и получите 6 M€.»; ресурс — «сбережение» (глоссарий
   `help_iconography`); лор RU — существующий.
2. **Инфо-модель** — `effect-short`: «No TR gained this generation: +1 preservation here and 6 M€ at production» (+ RU).
3. **ИНДИКАТОР НА ИКОНКЕ РТ** (диагноз 3–4) — (а, рекомендовано) второй вид печати в слоте RX42: маленький значок СБЕРЕЖЕНИЯ (`preservation.png`, ≈ ⅓
   иконки) в нижнем правом углу `__iconwrap` ячейки РТ; состояние «ждёт» (`raised = false`) — значок в золотом тоне с тонким кольцом «ожидает» (та же
   грамматика «ожидает», что у приёмки T06: тонкая линия, прозрачность ≤ .5, без свечения); состояние «не сработает» (`raised = true`) — тот же значок
   ЗАЧЁРКНУТ коротким штрихом и приглушён по материалу (как `cancelled` на лице) — форма несёт состояние, цвет только помогает; смена состояния — один
   crossfade ≤ 260 мс; хинт `data-hint` одной фразой: «Pristar: РТ в этом поколении не рос — в фазе производства +1 сбережение и +6 M€» / «Pristar: РТ в этом
   поколении вырос — эффект не сработает»; `data-tr-pristar="waiting|spent"`; (б) только состояние «ждёт» (значок есть / значка нет) — проще, но «не
   сработает» читается как «ничего» (владелец просил ОБА состояния: «менялся или нет»).
4. **Где показывать** — (а, рекомендовано) на рельсе владельца корпорации (`own`) и в «Информации» у ОСМАТРИВАЕМОГО места с Pristar (как `viewedRatingVeto`),
   и НИГДЕ больше (не на чипах мест в полосе, не на лице карты — лицо уже печатает правило); (б) только свой рельс.
5. **Сосуществование с вето** — две печати по разным углам слота (вето — как есть; сбережение — нижний правый), хинты — две фразы в одном `data-hint`
   через « · »; гард: обе видимы, ни одна не перекрывает цифру.
6. **Сцена поколения** (диагноз 1) — (а, рекомендовано) ряд волны «+6 M€ · Pristar» ПОСЛЕ дохода (из записи события хука с источником-картой — читать
   `from: {card}` в `productionIncome`/событиях, НЕ `known`), чип «+1 сбережение» на герое корпорации в «Разыграно»/доке по существующему пути `cardGain`;
   индикатор переходит в «ждёт» заново со сменой поколения (сброс флага — тот же кадр, что FLIP «ПКЛ.»); (б) как сейчас — честный деград (без волны).
7. **Стенд** — `tests/e2e/console-pristar.spec.ts` (FUNCTIONAL, tv4k + fhd + Deck для печати): (а) старт: пик Pristar (лицо с артом, капсула «0», VP «1/») →
   первый кадр: РТ 18, печать «ждёт» на иконке РТ с хинтом; (б) рост РТ (поднять температуру стандартным проектом / карта с РТ) → печать «не сработает»
   crossfade, хинт сменился, `data-tr-pristar="spent"`; ничего не мигает (пробник: ≤ 1 смена состояния, без анимаций на ячейке кроме crossfade); (в) соперник без
   Pristar — печати нет; «Информация» на месте с Pristar — печать есть, на месте без — нет; (г) под вето RX42 + Pristar (`pristar-veto`) — две печати по углам, цифра
   не перекрыта; (д) сцена поколения без роста РТ (TIMING, через `console-generation-scene`-харнесс): ряд «+6 M€ · Pristar» после дохода, капсула лица 0 → 1,
   индикатор снова «ждёт»; сервер согласен (53 + доход + 6; 1 сбережение); (е) поколение с ростом РТ: ни +6, ни ресурса, индикатор «не сработает» до
   смены поколения; (ж) финал: ПО = число сбережений (подиум). Фикстуры: `pristar` (Redux, Pristar на столе, фаза действий, поколение 1), `pristar-raised`,
   `pristar-veto` (RX42 enacted + Pristar первый по РТ), `pristar-production` (конец поколения — харнесс сцены).
8. **Объём** — всё карта + индикатор (≈ 100 %); без полировки; дефекты общего слоя (деград сцены для хуков, флаг вне модели) — чинить с тестом, строками
   в реестр текущего footer.

## 0. Рабочее дерево
1. `git log --oneline -1` → `e02eef9f34` на выдаче. `ListAgents` + `SendMessage` соседу (Парламент: `ConsolePartyPlaque` / `parliamentEffectsModel` — его
   файлы): твои файлы — `turmoil/Pristar.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `common/models/PlayerModel.ts` + `models/ServerModel.ts` (поле),
   `ConsoleResourcePanel.vue` / `ConsoleShell.vue` (проп) / `ConsoleInfoMode.vue` (viewed) / `console.less` § `.con-score`, `generationScene.ts` (6а),
   `tests/automa/AutomaCorporations.spec.ts`, `TurmoilCardsUnderRedux.spec.ts`, `console-bot-corp-cancelled.spec.ts` (комментарий), `locales/*/turmoil_corporations.json`,
   `ru/card_info.json`, e2e + фикстуры, доки. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>`); после коммита — `git reset -q -- package.json
   package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot pristar` → `npm run e2e:remote -- pristar <spec>` (сцена поколения — `--exclusive
   --workers=1`); exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — карта + модель (≈ 35 %)
`Pristar.ts`: `infoText`; правил не менять (хук — upstream байт-в-байт). Модель: поле `ratingRaisedThisGeneration` (имя — по словарю модели; НЕ переименовывать
серверный флаг) + сборка; строка долой + пин (hold-back пуст — проверить гард/принтер); RU; локали; коллизия C36; комментарий бот-e2e. Спек: классический `it` +
«на Turmoil Redux table» — правила 1–4 (каждый источник роста РТ ставит флаг; вето RX42 — не ставит; понижение — не ставит; поколение 1; модель у всех мест;
сериализация; ПО по ресурсам; коллизия).

## 2. Клиент — ИНДИКАТОР (≈ 45 %)
`ConsoleResourcePanel.vue`: второй проп печати (`trPristar: 'waiting' | 'spent' | undefined`) от шелла (`ratingRaisedThisGeneration` × `playedCards ∋ PRISTAR` —
чистая функция `pristarMarkOf(seat)` в `console/railMarks.ts`, спек), слот в `__iconwrap` (решение 3а), хинт (одна фраза, `translateTextWithParams`), сосуществование
с вето (5); `console.less` § `.con-score` — `&__pristar` (`--waiting` / `--spent`), crossfade через `calc(260ms * var(--motion-scale, 1))`, `prefers-reduced-motion` —
без перехода; `ConsoleInfoMode.vue` — `viewedPristarMark` (как `viewedRatingVeto`); сцена поколения (6а) — `generationIncomeReward`: ряд хука из записи с
источником-картой + спек `generationScene.spec` («хук фазы с источником — ряд, не деград»). Спеки: `railMarks.spec`, `ConsoleResourcePanel.spec` (печать только
при Pristar, оба состояния, хинт, с вето — два слота), `consoleTvTypeFloor`, `lessDeadSelectorGuard`, `cursorGrammarGuard`.

## 3. Стенд и регрессия (≈ 20 %)
Стенд решения 7; регрессия: `console-score-header`, `console-parliament-unmi-veto` (B1 — печать вето не сдвинулась), `console-rail-contract`,
`console-rail-material` (якоря ±1 px — печать не меняет бокс), `console-generation-scene` (A–E), `console-bot-corp-cancelled`, `tv-profile-screens` — по 1–2 повтора;
хуки, задетые слотом, — тем же диффом (инвариант 14).

## 4. Лицо, локаль, лор, арт
Лор EN+RU есть; арт R07 — подтвердить (статус); RU — решение 1; новые EN-ключи: инфо-модель, два хинта («Pristar: no TR gained this generation — +1 preservation
and 6 M€ at production» / «Pristar: TR gained this generation — the effect will not trigger») — `grep` ДО добавления; RU чужих ключей не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки (hold-back ПУСТ): `TurmoilCardsUnderRedux` (пин всех 22; worklist-принтер на пустом списке), `premiumScope`,
   `cardInformation`, `cardLore` (R07), `CardMetadata`, `armedPlayEffectCoverage`, `crossPlayerCoverageGuard`, `effectForecastCoverage` / `Parity`, `PremiumCard` /
   `premiumCardViewModel`, `cardVictoryPointsAtPlay`, `AutomaCorporations` (C36), `ServerModel` / `PlayerModel` гарды поля, `e2eLiveness`, `glyphLiteralGuard`,
   `consoleTvTypeFloor`, `lessDeadSelectorGuard`, `flightLayerZOrder`.
2. `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §3; `npm run e2e:affected`.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd; Deck — печать читаема на 1280×800)
`screenshots/pristar/{tv,fhd,deck}/`: (а) лицо корпорации с артом (старт, «Разыграно», «Информация»); (б) ячейка РТ «ждёт» крупно + хинт; (в) «не сработает»
после роста РТ (кадры до / crossfade / после); (г) с вето — две печати; (д) соперник без Pristar — чистая ячейка; «Информация» у места с Pristar; (е) сцена
поколения — ряд «+6 M€ · Pristar», капсула 0 → 1, индикатор снова «ждёт». С дивана: «я вижу, сработает ли Pristar в этом поколении, не считая в уме —
и это не мигает?»

## 7. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer; бэклог — без изменений.
2. Доки: `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — Pristar «СДАНА» (**22 из 22 — hold-back пуст**; статус-строка `:3` и `:20` — «классический Turmoil
   адаптирован целиком»; списки `:58–60` — «на месте» пуст, «заменяемые» — Septem Tribus + 6 проектов остаются); `turmoilReduxAdaptation.ts` — комментарий
   списка (пустой список с историей); `docs/claude/console/hud-frame.md` — § «Печати на ячейке РТ» (слоты, грамматика, сосуществование, чистая функция);
   `.claude/rules/console-ui.md` — строка «a corporation's STATE on the rail is a mark in the rail's own slot grammar (RX42 veto · Pristar), read off a
   server field, never derived from the log»; `turmoil-redux-unmi-veto` память — ссылка на второй вид печати; запись в журнале.

## 8. Режим работы
1. Читать до кода; `SendMessage` соседу; карта + модель + спек → индикатор (макет на живой сцене 4K: «ждёт» / «не сработает» / с вето — три кадра → батч)
   → сцена поколения (6а) → стенд → регрессия → раскадровки → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо корпорации с артом; затем три кадра печати (ждёт / не сработает / с вето) на 4K, кадры сцены поколения, результат регрессии,
   решения 1–8 с тем, что сделано по умолчанию, ОДИН `AskUserQuestion` (3 с кадрами, 4, 6 — рекомендация первой), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Выводить «рос ли РТ» на клиенте (из журнала, из дельты, из `terraformRatingFromCards`) — только серверное поле; печать у игрока без Pristar; пульс /
  свечение / анимация на тик; состояние только цветом; `title`; литерал кнопки; текст ниже пола TV; сдвигать бокс ячейки РТ (якорь полётов `.con-score__value`);
  перекрывать цифру; менять печать вето; трогать C36 / `MarsBotCorpData` / правила карты / `hasIncreasedTerraformRatingThisGeneration` (имя, семантика).
- Файлы соседа (Парламент); лор-строки чужих карт; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
