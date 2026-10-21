# RX42 · UNMI Veto («Вето UNMI», Красные) — ВТОРОЙ ЗАМЕНЯЮЩИЙ ПАССИВ, НА РЕЙТИНГ

Печатное: «Draw 1 card per point of your influence. **The player(s) with the highest terraform rating ignore any rating they
would gain.**» Задание председателя — «Play 2 Mars tags» (`{kind: 'tag', tag: Tag.MARS}, count 2` — ключ RX38). Промт
владельца: `docs/claude/prompts/resolution-rx42-unmi-veto.md`. Сдана 2026-10-21. **Это 42-я и последняя карта набора
владельца**; шесть карт Underworld в `skip\` — вне скоупа (статус C).

Чем карта нова относительно RX35 (`docs/TURMOIL_REDUX_DIVERTED_RESEARCH.md`): перехватывается ТОЛЬКО рейтинг, и ничего не
ставится взамен — шкала двигается, тайл ложится, бонус порога и бонус клетки приходят, вопроса «куда» нет. Поэтому у закона
нет ни накопителя, ни восьми входов: все 36 + 22 вызова рейтинга в движке (шаги шкал, `behavior.tr`, бесподобные подъёмы,
колонии, Ares, трек Карьеры, Redux-озеленение, собственные примитивы бота) идут через ОДНУ воронку
`Player.increaseTerraformRating`, и гейт стоит её ПЕРВОЙ строкой. Главное требование владельца — **предупреждение «РТ не
получите» на КАЖДОЙ поверхности ДО нажатия** — оказалось главной частью карты (§3).

---

## 1. Сервер: одна строка в одной воронке, живой статус

| Вопрос | Ответ | Где |
| --- | --- | --- |
| «Кто первый по РТ?» | `ratingLeaders(game)` — ВСЕ игроки партии, бот включительно (Р3); ничья наверху — каждый из равных. Читается ЖИВО при каждом событии и при каждой сборке модели, никогда не хранится и не сериализуется | `src/server/parliament/ratingVetoGate.ts` |
| «Этот игрок под вето?» | `ratingVetoed(player)` — закон с хуком `vetoRating` принят ∧ `participates(player, 'restriction')` ∧ первый по РТ сейчас. Чистый запрос — его спрашивают проход превью, читатель бесполезности, модель, чтения | тот же модуль; фасады `ParliamentHandler.ratingVetoed / vetoRating` |
| «Перехватить это событие?» | `vetoRating(player, gain: RatingGain)` — открывает `withEffectSource(player, {kind: 'resolution', id, owner}, 'rating-vetoed', …)` и зовёт хук карты; `true` = воронка НЕ ПОДНИМАЕТ. Хук сам пишет строку журнала с величиной и `recordSkippedEffect(player, UNMI_VETO_REASON, {label: 'Terraform rating', effect: {direction: 'gain', icon: 'tr', amount}})` | `UnmiVeto.ts` → `passive.vetoRating` |
| Где стоит гейт | `Player.increaseTerraformRating`: `if (steps > 0 && ParliamentHandler.vetoRating(this, {steps, global})) return;` — ПЕРВОЙ строкой, до `trThisGeneration`, до `hasIncreasedTerraformRatingThisGeneration`, до `raiseRating`. Ни одно вызывающее место не менялось — гард-регексп свипа (`terraformRating +=` вне воронки = падение) | `Player.ts` |
| Единица решения (Р2) | ОДНО событие воронки целиком: место на 1 ниже с «+3» получает все три и с этого момента первое; озеленение — два события (кислород, тайл Redux), Giant Ice Asteroid — три, в порядке движка | `UnmiVeto.spec` § одно событие целиком |
| Что НЕ трогается | понижения (`decreaseTerraformRating`); WGT / `unrewarded`; часть победителя СЛЕДУЮЩЕГО закона (слот сменился); `hasIncreased…` / `trThisGeneration` на перехваченном событии — корпорация UNMI остаётся закрытой, Pristar платит как «не поднимал» | спек |

**Статус движется, и движение названо.** `raiseRating` и `decreaseTerraformRating` мутируют внутри
`withRatingVetoWatch(player, mutate)`: множество первых по РТ (фильтр `restriction`) читается ДО и ПОСЛЕ, симметричная
разность журналируется по местам («${0} now has the highest terraform rating — ${1} refuses their rating» / «…no longer…»)
и записывается событием `rating-veto-changed` (`impact.ratingVeto {entered, left, leaders}`) под источником закона. Клиент
читает его как карточку закона «теперь действует на вас» / «больше не действует на вас» (`ratingVetoNotification`).

**Бот — аспект `restriction` (Р3).** Новый элемент `PARLIAMENT_ASPECTS`; под `'politics'` бот участвует (как человек), под
`'none'` — нет. Бот входит и в СРАВНЕНИЕ (`ratingLeaders` над `game.players`), и под вето (его примитивы рейтинга идут через ту
же воронку). Гард: `BotParliamentPolicy.spec` (таблица аспектов), `UnmiVeto.spec` § бот — три случая.

**Шаг Карьеры под вето.** `ChairmanSeat.payStep` возвращает `boolean`, запись шага несёт `vetoed: true`
(`AgendaAdvanceStep.vetoed`): маркер шагает, бонус шага НЕ приходит, клиентская ходьба не рождает жетон РТ и не делит ответ
стола (`agendaWalk.ts`, `careerGrantBeat.ts`). Финальное озеленение — маркер `finalGreeneryPrompt.ratingVetoed`.

**Немедленная часть** — общий шаг `influenceDrawStep(id, effect)` (`ResolutionInfluenceDraw.ts`): RX24 Open IP Trade и RX40
Sponsored Projects переведены на него байт в байт (тот же `INTAKE_KEY = 'drawIntake'`), RX42 — третий пользователь.

---

## 2. Честность превью — ОДИН выходной проход, в ТЕХ ЖЕ дверях, что RX35

`vetoEffects(player, effects, steps)` / `withVetoedRating(player, preview)` (`src/server/models/vetoedRating.ts`) — ПОСЛЕДНИЙ
проход семейства, сразу ПОСЛЕ `withImpliedRatings` (к этому моменту РТ шага шкалы уже чип) и ПЕРЕД `withPreselectAddresses`.
Порядок: `withDivertedTerraforming` → `withImpliedRatings` → **`withVetoedRating`** → `withPreselectAddresses`. Двери — те же
шесть, что у RX35: розыгрыш (`cardPlayPreview`), действие (`actionPreview`), стандартный проект (`standardProjectPreview`),
конвертация тепла (`ConvertHeat`), конвертация растений (`ConvertPlants`), постройка колонии (`colonyTradePreview`). Гард
дверей — `UnmiVetoSweep.spec` § EVERY DOOR (файл с одним проходом и без другого — падение) и `ResolutionContract.checkVetoingPass`
(хук `vetoRating` без выходного прохода — падение).

Что делает проход, ветка за веткой, в ПОРЯДКЕ ВОРОНКИ:
1. рейтинги ШАГОВ РАЗМЕЩЕНИЯ, которых чипы не печатали, заявляются подразумеваемыми чипами — по одному на событие (океан — 1;
   озеленение — кислорода, если есть место, + тайла Redux); тайл, напечатанный чипом (`oceans` / `greenery`), не дублируется
   (его подразумеваемый РТ уже заявил проход РТ);
2. рейтинг места ПРОЕЦИРУЕТСЯ чип за чипом против наибольшего РТ ОСТАЛЬНЫХ (`highestOtherRating`): чип РТ (явный или
   `implied`), встреченный при проекции ≥ чужого максимума, ПЕРЕЧЁРКИВАЕТСЯ (`ActionEffect.vetoed: {resolution, steps}`);
   ниже — получается, проекция растёт. «+3 · +1» у места на 1 ниже → «+3» получено, «+1» перечёркнуто — ровно то, что
   сделает воронка;
3. явный чип РТ после перечёркнутого читает пул без шагов, которых не было; замыкающая NET-строка TR47 читает остаток или
   уходит;
4. остальное не трогается: чип шкалы, чип тайла, шаг размещения — планета двигается, клетка спрашивается.

Прогноз: `grantOfEffect` не выдаёт грант рейтинга за перечёркнутый чип (Зелёным нечего платить, реактор «любого игрока» не
срабатывает); факт Зелёных вычитает перечёркнутое (`tr − vetoed`, под `ratingVetoed` → ∞); бонус Венеры 16 % — пропуск;
собственный факт закона — НАЗВАННЫЙ пропуск на канале `'rating-vetoed'` (`ctx.vetoed`, `UNMI_VETO_FORECAST_TITLE`).
Бесполезность (Р5): действие, ВЕСЬ результат которого — рейтинг (корпорация UNMI «3 M€ → +1 РТ», карта с голым `tr`) —
вердикт `'rating-vetoed'` с причиной `UNMI_VETO_REASON` (хук `actionFutility` корпорации UNMI — co-located; шаг шкалы
никогда не бесполезен: шкала двигается).

**Свип (`tests/parliament/UnmiVetoSweep.spec.ts`) — ворклист паритета «обещано ↔ исполнено».** Под принятым законом при
действующем месте первом по РТ (60 против 20) каждая карта скоупа, чей розыгрыш или действие поднимает рейтинг (объявлено
`behavior` / `actionBehavior` или бесподобно — источник тянется к воронке или к двери шкалы/тайла), проходится вживую,
промпты отвечаются дешевейшим валидным способом, и на каждой: рейтинг не ВЫРОС (понижение разрешено), каждый отказ НАЗВАН с
величиной (`effect-skipped` под маркером закона), сумма перечёркнутых шагов превью ветки == сумме, которую воронка отказала
вживую — число в число, а где карта печатает шаг шкалы или тайл — МИР СДВИНУЛСЯ. Первый прогон дал 32 утечки — все одного
рода (рейтинги шагов размещения не были заявлены чипами; NET-строка TR47 считалась дважды) — проход доработан, утечек 0,
`LEFTOVER_VETO_WORKLIST` пуст и падает в обе стороны. `INFO`-список (не падение): превью с несколькими ветками, где ветку
прогона нельзя назвать (бесподобные «динамические» превью, `or` из нескольких); Desperate Measures; Giant Ice Asteroid — его
ВТОРОЙ `SelectSpace` харнесс перезаписывает (прогон не доходит до конца, посажено 1 из 2 — помечено «unwalkable»).
Точные числа печатаются только на красном прогоне (ворклист = сообщение об ошибке).

---

## 3. Предупреждение ДО нажатия — таблица B1 (Р4, P0 владельца)

Критерий приёмки: ни одной поверхности с «+N РТ» без печати. Одна семья зачёркивания — класс `--diverted` (RX35) +
`--vetoed` на чипе, печать Красных на иконке РТ ячейки, перечёркнутый элемент плиты руки. Кадры —
`screenshots/parliament-unmi-veto/<profile>/`.

| Поверхность | Что видит игрок под вето | Откуда число | Хук e2e | Кадр |
| --- | --- | --- | --- | --- |
| Ячейка РТ панели ресурсов | печать Красных поверх иконки РТ (`con-score__veto` — красное кольцо + штрих, абсолютно внутри `__iconwrap`, ячейка и соседи не двигаются), хинт «Вето UNMI: у вас наибольший РТ (30) — рост РТ не засчитывается» | `enacted.trVeto.leaders` (сервер) | `[data-tr-vetoed="30"]` | `01-rail-stamp` |
| «Эффекты» (Information → эксплорер → полоса Парламента) | строка закона первой + ряд «Под вето сейчас: вы (30)» — имена и рейтинги каждого связанного места | `trVeto.leaders` | `.con-pfx__reason--holds` | `02-effects-strip` |
| Альбом руки | плита карты с «+N РТ» несёт перечёркнутый элемент «[РТ] +2» (`HandPlateItem.struck`) | `CardModel.ratingVetoed.steps` (сервер — проход превью по карте своей руки) | `[data-hand-veto="2"]` | `03-hand-plate` |
| Колесо базовых действий | у слота конвертации тепла заметка «РТ под вето» (`QuickEntry.note`) | `OptionMetadata.effects` с `vetoed` | `[data-slot-veto]` | `04-wheel-note` |
| Конфирм колеса / формула композера | чип РТ перечёркнут (`.action-effect-chip--vetoed`, хинт «Вето UNMI»: … 1 РТ не засчитывается), чип температуры цел, хвоста «→» нет | тот же проход | `[data-confirm-formula] .action-effect-chip--vetoed` | `05-heat-confirm` |
| Плитки «Действий карт» | мета плитки `⊘ РТ под вето` (`SlotMeta 'veto'`, `TILE_VETO_NOTE`) | `vetoedRatingOf(branch)` | `[data-tile-veto]` | юнит `UnmiVetoReadings` |
| Стандартные проекты | строка помечена, фут «⊘ РТ под вето», чип РТ в рельсе перечёркнут | `standardProjectPreview` | `[data-stdp-veto]`, `[data-stdp-context-veto]` | `07-asteroid-row` |
| Панель голосования | «Сейчас наибольший РТ — player2 (30): этот рост РТ не будет засчитываться. Вы — 20» (виды: `you` / `tie` / `others` / `solo`, `ratingVetoReadingOf`) | `slot.trVetoIfEnacted` | `[data-parl-vote-veto-kind]` | `08-vote-panel` |
| Заседание — итоги, лента, досье Карьеры | строка «Под вето» по местам в итогах (`data-sit-veto`), чип шага Карьеры перечёркнут в ленте (`con-band__bonus--vetoed`) и в досье (`data-parl-cd-vetoed`) | записи фазы (`agenda.steps[].vetoed`), `trVeto` | юниты | — |
| Досье игрока (Information) | факт «под вето «Вето UNMI»» в запечатанных фактах | `trVeto` | `[data-dossier-veto]` | юнит |
| Финальное озеленение | доходность `YIELD_TR_VETOED` («РТ за озеленение не будет: у вас наибольший РТ») | `finalGreeneryPrompt.ratingVetoed` | — | юнит |
| Уведомления | карточка закона при перехвате: строка «Пропущено · Рейтинг терраформирования · причина», без «+0»; смена статуса — «теперь действует на вас» / «больше не действует» | `effect-skipped`, `rating-veto-changed` | `.con-notif[data-notif-id$=":law"] .con-notif__skip` | `06-law-toast` |
| «Полигон» | три сценария семейства `influence` с `vetoes: true` (вы первый · первый другой · ничья), чтение панели | манифест `IClientResolution.vetoesRating` | `[data-rxpg-veto-kind]` | `09…11-stand-*` |

Сцена коммита действия карты: `consoleActionCommitMotion` ставит ПЕЧАТЬ на печатной иконке РТ (`vetoSeal` →
`[data-commit-seal="tr"]`) в такте импульса; жетона РТ в рельсе не рождается (`consoleActionCommit` не даёт spec на
перечёркнутый чип). Шкала и бонусы играют как обычно.

---

## 4. Решения Р1–Р5 (приняты по умолчанию — автономный прогон; владелец не менял)
Р1 «Вето UNMI» (UNMI не переводится) · Р2 единица = одно событие воронки целиком, живо, ничья включена, внутри действия — в
порядке движка · Р3 бот ПОД вето и В сравнении (аспект `restriction`) · Р4 предупреждение везде, включая альбом · Р5 чистый
РТ (корпорация UNMI) — «без эффекта» с причиной `rating-vetoed`.

---

## 5. Ключи i18n (новые; RU в `parliament.json`, `console.json`, `ui.json`)
Карта: «UNMI Veto», пассив «The player(s) with the highest terraform rating ignore any rating they would gain.»; строка
перехвата «${0} does not gain ${1} ${2}: ${3} — the highest rating»; причина «Your terraform rating is the highest — the enacted
resolution ignores the gain»; прогноз «UNMI Veto: your terraform rating is the highest — the rating is not gained»; канал «for a
vetoed terraform rating»; смена статуса (2 строки журнала + 2 заголовка карточки); чтения панели (`VETO_READING_YOU / TIE /
OTHERS / OTHERS_YOURS / SOLO`); «Under the veto now: ${0}», «Under the veto», «TR under the veto», «you (${0})», «under the veto
of ${0}», хинт ячейки «${0}: your terraform rating is the highest (${1}) — rating gains are not counted», хинт чипа «Vetoed by
${0}: your terraform rating is the highest — ${1} TR not gained», финал «No TR per greenery — your terraform rating is the
highest», три подписи сценариев стенда. Ключи RX24 (добор) и RX38 (задание) переиспользованы, не дублированы.

---

## 6. Проверка
Сервер: `tests/parliament/UnmiVeto.spec.ts` (34) · `UnmiVetoSweep.spec.ts` (3 — свип, одна воронка, двери) ·
`ResolutionContract` (RX42 + `checkVetoingPass`) · `BotParliamentPolicy` (аспект) · соседи RX35 / RX40 / RX24 / RX38 / RX39,
`cardPlayPreviewCoverage`, `skippedEffectRecord`, `actionFutility`, `effectForecastCoverage`, `cardPlayReplayCoverage`,
маршруты — 793 passing одним прогоном. Клиент: `tests/client/components/console/UnmiVetoReadings.spec.ts` (чип, плита руки,
плитка, колесо, ячейка РТ, строка пассива, чтения панели ×4, итоги, досье) + `PremiumMechNodeRatingInside.spec.ts` («>» внутри
иконки РТ лица) — 29 + 35 с соседями; гарды `parliamentGlossary` (канон «первый по РТ», никогда «лидер»), `glyphLiteralGuard`,
`readingParamsGuard`, `e2eLiveness`, `e2eFixturesLoad` — зелёные. `npm run lint:client` (vue-tsc), `build:server`, `build:test`
— зелёные.

e2e — ровно один: `tests/e2e/console-parliament-unmi-veto.spec.ts` (standard-1080 + tv4k на GPU; фикстуры
`parliament-unmi-veto-enacted` — красный первый по РТ 30 против 27, 8 тепла, 30 M€, −10 °C, «Bribed Committee» в руке;
`parliament-unmi-veto-vote` — синий 20 против 30): ① печать ячейки + хинт; ② полоса эффектов «вы (30)»; ③ плита альбома;
④ колесо → заметка слота → конфирм с перечёркнутым РТ → A → сервер: тепло 0, −10 → −8, РТ 30; карточка закона с пропуском;
печать стоит; ⑤ строка «Астероид»; ⑥ панель голосования «others»; стенд — три чтения. Итоги прогонов — журнал
`docs/claude/parliament-sitting-progress.md` § RX42.

---

## 7. Слабые места (честно)
| Что | Почему терпимо | Чем закрыть |
| --- | --- | --- |
| Проекция превью сравнивает с наибольшим РТ ОСТАЛЬНЫХ на момент превью; чужой рост между превью и нажатием меняет вердикт | превью перечитывается на каждом `gameStateVersion`; воронка всегда права | — (по конструкции) |
| «Полигон» и панель голосования печатают имена мест по цвету-модели; при ничьей из трёх+ — одной строкой через запятую | три места под вето — редкость | перенос по местам |
| Печать коммита (`vetoSeal`) играется только в композере действий карты и на фикстуре e2e не засвидетельствована (в ней нет действия карты с РТ) | конфирм колеса печати не играет — там чип уже перечёркнут и жетон не рождается | фикстура с Ironworks / UNMI-корпорацией |
| Карта-резолюция НЕ ИМЕЕТ поля лора в коде — выдуманная запись живёт в реестре `turmoil-redux-invented-lore.md` | у всех резолюций так | поле `lore` у `ResolutionDefinition` |
| Свип считает паритет только у превью с одной веткой; многоветочные — по контракту без счёта (INFO) | ветку прогона нельзя назвать без адресного пика | прогон по каждой ветке |
