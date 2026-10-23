# Промт исполнителю · T05 Event Analysts («Анализ событий») — десятая классическая карта Turmoil под Redux, «на месте» (§3.1): синяя, 5, Наука; требует «Учёных» у власти или 2 ваших делегата на их резолюции; ЭФФЕКТ «у вас +1 влияния» — ПЕРВАЯ карта premium-скоупа, дающая влияние СВЕРХ трека Карьеры (сервер готов: `Parliament.influence = уровень трека + бонусы + карты`, источники хранятся и сериализуются) · ГЛАВНОЕ ПО КАРТЕ (владелец): **игрок ВО ВСЕХ местах — и на шкале Карьеры — видит ИТОГОВОЕ влияние с учётом модификатора**; сегодня шкала, лента и анонсы шага печатают УРОВЕНЬ ТРЕКА, а не итог (`viewerLevel`, `influenceAtAgenda(walk.to)`), композер не показывает «влияние 2 → 3», журнал молчит о бонусе · ПОЛИРОВКА (≈ 55 %) «ВЕРХНЯЯ ПОЛОСА — ПРИБОРНАЯ ДОСКА: МАТЕРИАЛ, НЕ ФОРМА (2)»: продолжение CF на второй всегда-видимой кромке — фишки мест, три глобальных параметра, колода и поколение сегодня — белый текст на тёмной полосе

> **Статус: ВЫДАН 2026-10-23.** HEAD `0a42bf30fb`. **T03 Cultural Metropolis СДАНА кодом** (`35a121703b` … `0a42bf30fb`, раздел **CF**; две двери, планшет M3
> «одна стеклянная плита»), но на этом HEAD ЕЩЁ НЕ ЗАПИСАНЫ её реестр (footer «PL-928», раздела CF нет), журнал и «9 из 22» — сосед **terraforming-mars-14
> (busy)** держит незакоммиченные `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` и `tests/e2e/console-rail-material.spec.ts` — это его файлы, не трогать; `ListAgents` +
> `SendMessage` до первого коммита. **Эта задача берёт раздел CG**; номера — по footer В МОМЕНТ записи. **Лор:** в `assets/text/lore_texts.json` НЕЗАКОММИЧЕНЫ
> ДВЕ строки — `T03` (соседа) и `T05` (владельца, «By some known as the prophets, by others known as the profiteers.»): коммитить ТОЛЬКО свою строку `T05`
> (временный индекс / `git add -p`); строку `T03` оставить соседу (если он закончил без неё — отдельным ханком с его меткой, после `SendMessage`).
> Арт — `C:\Users\zelin\Downloads\Mars Arts\T05.png`. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T05 - Event Analysts.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t05 …`; exit 2/3/4 → спросить); сосед-14 может гонять свои — окно согласовать.

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:117`, `:201`, `:213` — «Executor читает классику — сделано с T04; Event Analysts остаётся до своих
задач: лицо, спек Redux-стола, превью»), `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T04 / T03 / T10 (образец §-блоков).
**Контракты карты:** `docs/claude/parliament-glossary.md` (`:47–50` «Карьера» / «Старт карьеры» / «шаг»; `:85` значок влияния `influence.png`; `:93–94` —
«на треке звёзд нет — клетки показывают НАГРАДУ шага, а уровень влияния — «уровень влияния»»; гард `AgendaStepGlyph.spec`), память `career-step-insignia`
(шаг Карьеры = нашивка; «+1 [нашивка]» ведёт глаз к треку — тот же закон нужен значку влияния), `info-polish-restrained`, инварианты 1–4, 7 (чистые
view-model, никакой переарифметики — сервер уже сложил), 9, 13; `docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md`; CLAUDE.md «Project goals» 4. **Контракты
полировки:** `docs/claude/console/hud-frame.md` (`:198–215` — полосы = две горизонтальные кромки, `--con-hud-h` ОДИН токен высоты: 2.2 / **2.3 TV** / 1.7 rem —
АРХИТЕКТУРНЫЙ инвариант, краска живёт ВНУТРИ), память `console-hud-frame-rails`, `console-chip-conveyor` (лента фишек мест — один transform на всё),
`resource-flight-live-ends-direction` (T06 решение 6 — плашка-приёмка под чипом места `statusIntake`), **стенд CF** `tests/e2e/console-rail-material.spec.ts`
(A/B/C: якоря → JSON, макет через `TM_E2E_RAIL_MOCK`, паритет ±1 px против baseline — ПОВТОРИТЬ ТОТ ЖЕ ПАТТЕРН для полосы; файл соседа — читать, не править),
`polish-priority-tv4k-no-deck-only`, `polish-area-premium-visual-first`, `fixed-layer-is-a-stacking-context`, `perf-measure-on-gpu-not-swiftshader`,
`batch-decisions`, `concurrent-session-edits-same-files`, `e2e-only-on-steam-machine`, `e2e-spec-rot-contract`, `shell-template-escapes`. Журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **T04 Diaspora Movement** (спек `:66–160` — стол Redux, дороги требования) — то же требование партии («Учёные»); **сервер влияния** —
`parliament/Parliament.ts:757–800` (`influence()` = `influenceAtAgenda(agenda) + influenceBonusOf + card.getInfluenceBonus`; `influenceSourcesOf`; `addInfluenceBonus`
с именем дарителя; сериализация `:1039` / `:1114`), `politics/PoliticalOps.ts:78–82` (фасад), `behavior/Executor.ts:748–750` (`influenceBonus === 1 →
politics.addInfluenceBonus(player, 1, card.name)` — журнала НЕТ), `parliament/ParliamentModel.ts:286–302` (`influence` = итог, `influenceSources` — для КАЖДОГО
участвующего места), `tests/behavior/ExecutorPolitics.spec.ts` (оба стола); **клиент влияния** — `console/parliament/consoleParliamentModel.ts:305–307`
(`agendaInfluence`), `:930–970` (`AgendaVm`: `viewerInfluence` = итог сервера, `viewerLevel` = уровень трека — ОБА есть, печатается не тот),
`parliament/ConsoleParliamentAgenda.vue:44–70` (клетки трека, `__step-level`), `:180–200` (`influenceBands` — пояс уровней, кольцо «mine» по `viewerLevel`),
`parliament/ConsoleParliamentBand.vue:252–268` и `:312–340` (анонсы шага: `level: influenceAtAgenda(walk.to)`), `console/parliament/parliamentBand.ts:82–85`,
`:378–390`, `:556–568` (чипы `agenda` с `level`; `count Influence` — итог), `parliament/ConsoleParliamentCareerDossier.vue:8–45` (ряд места — `seat.influence`
итог без пометки; перекладины — уровни), `ConsoleInfoParliament.vue:22–48` (ОБРАЗЕЦ ПРАВИЛЬНОГО ЧТЕНИЯ: «Карьера N + Бонусы M = итог» + источники;
e2e `console-info-parliament.spec.ts:86–91`), `info/ConsoleDossierParliament.vue:18`, `console/parliament/influenceYieldModel.ts:784–790`, `:805–811`, `:836–842`
(прогнозы «если победите» УЖЕ складывают бонус: `influenceAtAgenda(step) + (seat.influence − influenceAtAgenda(seat.agenda))` — образец), `parliament/
ConsolePartyActionComposer.vue:898` (цена со скидкой за влияние — итог), `common/models/ActionPreviewModel.ts:865–878` (`agendaWalk.influence {current,
resulting}` — ОБРАЗЕЦ превью «влияние до → после»); **лицо** — `premiumCardIcons.ts:335` (`INFLUENCE → misc/influence.png`), `mechanicsModel.ts:72`, `:220`
(«★ [влияние] 2+»), RU `turmoil_cards.json:14–15` («Анализ событий»; «Эффект: ваш уровень влияния +1» — против глоссария: карта даёт ВЛИЯНИЕ, не уровень;
`ceo_cards.json:64` — «Эффект: у вас +1 влияния.» — образец); **полоса** — `ConsoleStatusStrip.vue` (670 строк; `__players / __ribbon / __player / __pname /
__pstatus / __beacon / __intake*` слева, `__params / __terra / __terra-rail / __terra-fill / __param / __value / __gen / __evq` справа), стили `console.less:2122`
(корпус), `:2689` (`__terra`), `:2789` (чип / приёмка), TV `console_tv.less:194–200` (`__value 1.4rem`, `__player 1.15rem`), **якоря** — `statusChipConveyor.ts:18–63`
(`__ribbon / __player / __pghost / --conveyor`), `statusIntake.ts:182` (`__intake-num`), `resourceTransfer/consoleResourceTransfer.ts:1083` (`__intake`),
`tilePlacement/cityDataPayoutBeat.ts:193–208` (`__player`), `scaleSwing/scaleSwingDirector.ts:323` (`__param`), хост дельты колоды (`console-rail-contract`
«top rail»); e2e, читающие `con-status` — `grep -rln "con-status" tests/e2e` (≈ 14+: `console-chip-conveyor`, `console-deck-draw`, `console-delta-chip-anchor`,
`console-bot-turn-latency`, `console-endgame-overview`, …) — ЭТО регрессионный набор; кадры «сегодня» — `screenshots/project-deck/top-bar.png`,
`screenshots/tv-profile/tv-4k/04-board.png` (верх).

---

## Диагноз (подтверждён файл:строка и кадрами на `0a42bf30fb`; перепроверить на своём HEAD)

### Карта — сервер сложил, клиент печатает слагаемое
1. **Декларативна, движок готов.** `EventAnalysts.ts`: `behavior.turmoil.influenceBonus: 1`, `requirements: {party: SCIENTISTS}`, `cardNumber: 'T05'`. Executor
   идёт через фасад (комментарий строки hold-back `turmoilReduxAdaptation.ts:44` «Executor reads Turmoil.getTurmoil» УСТАРЕЛ — §3.1 п. 213); `Parliament.influence`
   складывает трек + бонусы + `getInfluenceBonus` карт; модель отдаёт `influence` (итог) и `influenceSources` для каждого места. Работа карты: RU (описание в
   голос T04; эффект — «Эффект: у вас +1 влияния.» по глоссарию), лор RU, арт, `card_info`, строка долой, пин (10 из 22), спек Redux-стола, превью.
2. **Шкала Карьеры печатает уровень трека, не итог.** `ConsoleParliamentAgenda.vue:188–200`: кольцо «mine» ставится по `viewerLevel` (= `influenceAtAgenda(position)`),
   чип пояса печатает `band.level`; при бонусе +1 игрок с уровнем 2 стоит в поясе «2», а его влияние 3. `AgendaVm` УЖЕ несёт `viewerInfluence` (итог сервера) —
   он просто не печатается на треке.
3. **Анонсы и чипы шага — уровень.** `ConsoleParliamentBand.vue:265`, `:318`, `:337` — после шага Карьеры лента говорит «уровень 3» (`influenceAtAgenda(walk.to)`);
   `parliamentBand.ts:556–566` — чип стопа под курсором и чип своей позиции с `level`; итог стоит рядом только как `count Influence` (`:568`) и только в фокусе.
   Досье Карьеры (`CareerDossier.vue:14`) печатает итог места без пометки, откуда он; перекладины — уровни (верно: это награда клетки).
4. **Композер и журнал молчат.** Превью розыгрыша ACTIVE-карты не несёт «влияние 2 → 3» (`ActionPreviewModel` знает `agendaWalk.influence {current, resulting}`,
   но не статический бонус карты); `Executor.ts:749` и `Parliament.addInfluenceBonus` не пишут в журнал — «+1 влияния от «Анализ событий»» нигде не названо
   (инвариант 4 — про потерю, но закон журнала — КАЖДОЕ изменение состояния именовано; уведомление/лента Парламента тоже).
5. **Что уже верно (пинить, не переделывать):** информация › Парламент (`ConsoleInfoParliament.vue:22–48` — «Карьера 2 + Бонусы 1 = 3», источники с
   именем карты), зона досье (`:18`), прогнозы голосования (`influenceYieldModel.ts:787/808/839` — бонус едет сверх трека), цена партийного действия (`:898`),
   сериализация. Это и есть ОДНО ЧТЕНИЕ, которое надо разнести по остальным местам — не второе.

### Верхняя полоса — вторая кромка после планшета
6. **Текст на полосе.** `top-bar.png` / `04-board.png` (верх): слева фишки мест — точка цвета + имя + пилюля статуса («ДЕЙСТВИЕ 1/2» / «ОЖИДАЕТ»); справа три
   глобальных параметра — иконка + белая цифра («−30 °C», «0 %», «0/9»), зелёный «0 %» терраформации, колода «185», «ПКЛ. 1». Всё — типографика на тёмной
   полосе; после CF слева стоит стеклянный планшет с тонами ресурсов, справа — медальоны, а кромка над ними — текст.
7. **Форма — инвариант.** Высота — ОДИН токен `--con-hud-h` (TV 2.3 rem ≈ 100 px на 4K; hud-frame.md:198–215); лента фишек — один transform (`statusChipConveyor`);
   приёмка под чипом (`__intake`, T06 M1) — якорь полётов чужих выплат; `__param` — якорь качания шкалы; `__player` — адресат выплаты города; хост дельты колоды —
   контракт `console-rail-contract`. Полировка = КРАСКА ВНУТРИ полосы на тех же боксах; гард паритета ±1 px по образцу CF.

## Правила карты (спек пинит каждое)
1. Синяя, 5, Наука; требование «Учёные» — дороги T04; эффект: после розыгрыша `parliament.influenceBonusOf(p1) === 1`, `influenceSourcesOf(p1)` =
   `[{amount: 1, source: 'Event Analysts'}]`, `influence(p1)` = уровень трека + 1; модель места: `influence` = итог, `influenceSources` — источник с именем;
   второй экземпляр невозможен (одна карта), но два РАЗНЫХ источника складываются по порядку.
2. Итог ПРИМЕНЯЕТСЯ везде, где сервер читает влияние: выплата резолюции «за каждое влияние» (одна масштабируемая резолюция в спеке), порог «от 2 влияния»,
   скидка платного действия (Trade Industries), уровень Joint Research; место без делегатов — влияние 0 (`participates`), бонус хранится и возвращается.
3. Журнал: одна строка на розыгрыш «${player} получает +1 влияния от ${card}» (токены, не HTML; уведомление по правилу `notification-source-and-glance`).
4. Классический стол — апстрим байт-в-байт (`Turmoil.addInfluenceBonus`); save / load — `influenceBonus` round-trip с источником; MarsBot не играет.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения T04 1–6 / T14 CC / T15 CD / T03 CF не переспрашивать)
1. **RU** — имя оставить («Анализ событий»); описание — «Требует, чтобы «Учёные» были у власти или у вас было 2 делегата на их резолюции.»; эффект —
   «Эффект: у вас +1 влияния.» (RU ключа карты — её собственный, править можно); лор RU — «Одни зовут их пророками, другие — спекулянтами.»
2. **ИТОГ НА ШКАЛЕ КАРЬЕРЫ** (диагноз 2) — (а, рекомендовано) кольцо «mine» остаётся на поясе УРОВНЯ (это клетка трека), а чип этого пояса печатает ИТОГ
   игрока «[влияние] 3» с МОДИФИКАТОРОМ-ярлыком «+1» (тон карты, hint — источники: «Анализ событий +1»); чужие пояса — уровни трека; у головы трека
   («[нашивка] КАРЬЕРА») — читаемый итог «ВАШЕ ВЛИЯНИЕ 3 = 2 + 1» одной строкой на TV ≥ пола; (б) только строка у головы, чип пояса — уровень.
3. **ОДНА ГРАММАТИКА МОДИФИКАТОРА** везде: число в диске влияния = ИТОГ; ярлык «+N» рядом = «сверх трека» (появляется только при N > 0, не раскрашивает
   число); hint/досье — источники по именам; «уровень N» печатается ТОЛЬКО как награда клетки трека (глоссарий `:93–94`). Применить: чип пояса (2), анонсы шага
   (`Band.vue:265/318/337` — «шаг 7 · уровень 3 · влияние 4 +1»), чипы `parliamentBand.ts:556–566`, ряд места в досье Карьеры («4 +1», у всех мест), зона досье
   и информация (уже сумма — добавить ярлык), фокус трека (`count Influence`).
4. **Композер / превью** (диагноз 4) — (а, рекомендовано) превью розыгрыша несёт `influence: {current, resulting}` для карт с `influenceBonus` (как `agendaWalk`),
   композер печатает чип «[влияние] 2 → 3» рядом с эффектом; на лице — существующий `influence.png`, никакого нового значка; (б) только лицо.
5. **Журнал** — строка правила 3 из фасада (`ReduxPoliticalOps.addInfluenceBonus`), классика — без изменений.
6. **Полоса — «МАТЕРИАЛ, НЕ ФОРМА (2)»** (диагноз 6–7) — (а, рекомендовано) та же грамматика, что CF M3: одна стеклянная кромка; ФИШКА МЕСТА — крест:
   цвет места как лит-кромка/фаска, имя — дисплейный шрифт, статус — гравированный ярлык (активный — светится, «ожидает» — приглушён по материалу);
   ГЛОБАЛЬНЫЕ ПАРАМЕТРЫ — три прибора: температура (столбик-термометр с заливкой в тоне тепла), кислород (кольцо-дуга), океаны (9 пипсов `0/9`), терраформация —
   существующий `__terra-rail/__terra-fill` в той же грамматике; КОЛОДА — стопка (есть `.con-deckstack`), ПОКОЛЕНИЕ — счётчик-плата; всё в `--con-hud-h`; (б) только
   фишки мест + материал полосы, приборы — как есть.
7. **Что остаётся прежним** — все состояния (ход/ожидание/бот, лента-конвейер, маяк, приёмка T06 M1 и её «+N», качание шкалы, дельта колоды, зум) на новой
   краске БЕЗ изменения боксов; Deck — база не растёт.
8. **Объём** — карта ≈ 45 % (итог везде — главная работа владельца), полоса ≈ 55 %; правый рельс, бар, тело Парламента — вне скоупа.

## 0. Рабочее дерево
1. `git log --oneline -1` → `0a42bf30fb` на выдаче. **Сначала** `ListAgents` + `SendMessage` соседу-14 (T03): твои файлы — `turmoil/EventAnalysts.ts` + спек,
   `common/cards/turmoilReduxAdaptation.ts` (его строка 44 — после его коммитов), `politics/PoliticalOps.ts` (журнал), `models/cardPlayPreview.ts` / `ActionPreviewModel.ts`
   (превью влияния), `console/parliament/{consoleParliamentModel,parliamentBand}.ts`, `parliament/{ConsoleParliamentAgenda,ConsoleParliamentBand,ConsoleParliamentCareerDossier}.vue`,
   `ConsoleInfoParliament.vue`, `info/ConsoleDossierParliament.vue`, `consolePlayCardComposer.ts` / `ConsoleActionComposer.vue` (чип), `ConsoleStatusStrip.vue`,
   `console.less` §§ `.con-status`, `console_parliament_chamber.less` § `__inf-band`, `console_tv.less` § полоса, `ru/{turmoil_cards,card_info,ui,console,parliament}.json`,
   e2e полосы / карты, доки. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>` — сосед держит стейдж); лор — только строка `T05`; после коммита —
   `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t05` → `npm run e2e:remote -- t05 <spec> [--exclusive --workers=1]`; кадры «до»
   — клиент HEAD (`TM_E2E_SHOTS_TAG=before`); exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд карты = спек** `tests/e2e/console-event-analysts.spec.ts` (FUNCTIONAL, tv4k + fhd): (а) композер — эффект + чип «[влияние] 2 → 3»; A — ОДИН POST;
   (б) журнал — строка «+1 влияния от «Анализ событий»»; (в) Парламент › Карьера: пояс «mine» = уровень 2, чип печатает «3 +1», голова «ВАШЕ ВЛИЯНИЕ 3 = 2 + 1»,
   hint — источник; фокус на своём стопе — чипы «уровень 2 · влияние 3 +1»; (г) досье Карьеры — ряд места «3 +1», соперник без бонуса — без ярлыка; (д) информация
   › Парламент — «2 + 1 = 3 · Анализ событий +1» (существующие хуки `data-parl-info-*`); (е) голосование — прогноз «у вас 3 · если победите 4» на масштабируемой
   резолюции; (ж) шаг Карьеры (вторая фикстура — Reds Budget / победа) — анонс ленты «шаг 3 · уровень 2 · влияние 3 +1», после шага на уровень 3 — «4 +1»;
   (з) `event-analysts-locked` — «Учёные» не у власти, 1 делегат → «1 из 2».
4. **Стенд полировки = спек** `tests/e2e/console-status-material.spec.ts` (FUNCTIONAL; три профиля; ПАТТЕРН CF A/B/C): (A) якоря → `screenshots/t05/status/<tag>/<profile>/anchors.json`
   (`__ribbon`, `__player` × N, `__pname`, `__pstatus`, `__intake`, `__intake-num`, `__param` × 3, `__value` × N, `__terra-rail`, `__gen`, `.con-deckstack__pile`,
   `.con-deckstack__count`, высота `.con-status` = `--con-hud-h`); (B) `TM_E2E_STATUS_MOCK=M1|M2|M3` — макет не двигает бокс (±1 px); (C) baseline
   `tests/e2e/statusAnchorsBaseline.json` (клиент `0a42bf30fb`) — паритет сданной краски; плюс кадры состояний: мой ход / ожидание / бот думает / лента
   крутится / приёмка «+N» / качание шкалы / дельта колоды; reduced motion.
5. Фикстуры: `event-analysts` (`parliamentFixture`: Redux, Colonies; «Учёные» ENACTED (`seatEnacted(quietResolutionOf(SCIENTISTS))`), на голосовании — одна
   резолюция «за каждое влияние»; p1 — маркер Карьеры на уровне 2, карта в руке, 20 M€), `event-analysts-played` (карта на столе → бонус 1; + сценарий шага),
   `event-analysts-locked`.

## 1. Сервер — карта + журнал (≈ 10 %)
`EventAnalysts.ts` — без правок правил (декларативна); RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T05.png" T05` → `make:cards`), `card_info`,
строка долой (после коммитов соседа) + пин (10 из 22); журнал в `ReduxPoliticalOps.addInfluenceBonus` (правило 3; классика — нет); превью `influence
{current, resulting}` для `turmoil.influenceBonus` (`cardPlayPreview` → `ActionPreviewModel`, чистое, по образцу `agendaWalk.influence`). Спек: классический
блок + Redux-блок (правила 1–4) + превью + `ParliamentModel` (итог и источники у каждого места) + `unplayableReasons` (дороги).

## 2. Клиент — ИТОГ ВЕЗДЕ (≈ 35 %)
`console/parliament/influenceReading.ts` (чистый): `influenceReadingOf(seat)` → `{final, level, bonus, sources}` из `influence` / `agenda` / `influenceSources`
модели — ОДНО место; потребители: `AgendaVm` (чип пояса «mine», голова трека), `parliamentBand.ts` (чипы `agenda` + `count` с ярлыком — `bonus` в чипе),
`ConsoleParliamentBand.vue` (анонсы шага: уровень клетки + итог места), `CareerDossier.vue` (ряд места), `ConsoleInfoParliament` / `DossierParliament` (ярлык),
композер (чип «до → после» из превью). Один стиль ярлыка `.con-inf-mod` (TV ≥ пола; hint `data-hint` с источниками; без `title`). Спеки: `influenceReading.spec`
(итог / уровень / бонус / источники; место без делегатов → 0), `consoleParliamentModel.spec` (чип пояса, голова), `parliamentBand.spec` (чипы с ярлыком),
`ConsoleParliamentAgenda.spec` (пояс «mine» по уровню, чип — итог), `consolePlayCardComposer.spec` (чип влияния из превью), `parliamentGlossary.spec`
(«уровень» только у клетки), гарды `agendaCoverSignalGuard`, `influenceYieldSeparatorGuard`.

## 3. Клиент — ПОЛИРОВКА: «ПОЛОСА — МАТЕРИАЛ, НЕ ФОРМА (2)» (≈ 55 %)
### 3.А Эталон, кадры «до», макеты
Стенд §0.4 (A) на базе; макеты `tests/e2e/statusMaterialMocks.ts` (по образцу `railMaterialMocks.ts` соседа — не редактировать его файл, свой модуль): M1 —
решение 6а целиком; M2 — 6б (фишки + материал, приборы текстом); M3 — M1 с единым «кокпитным» стеклом полосы и планшета (один градиент через шов —
проверить, что `.con-res-host::after` и кромка полосы не спорят) → батч владельцу (решения 6, 2) ДО реализации.
### 3.Б Краска
`console.less` § `.con-status`: материал полосы (тот же миксин, что CF — не третий), крест фишки (цвет места — лит-кромка, не заливка), приборы параметров
(тоны из существующих токенов ресурсов/шкал — `scaleSwing` уже знает тон каждой шкалы), стопка колоды, счётчик поколения; `console_tv.less` — размеры НЕ
меняются; состояния решения 7 — пересадка. Dead-selector guard чистый. `transform` / `filter` на полосе — только там, где уже были (лента) — слой полёта.
### 3.В Гарды и регрессия
Стенд §0.4 (B, C); `tests/console/statusGeometryParity.spec.ts` (скомпилированный CSS: `--con-hud-h`, токены полосы, высоты чипа/приборов = эталон);
`flightLayerZOrder.spec`; перф 4K на GPU; e2e-набор `grep -rln "con-status" tests/e2e` + `console-rail-contract` + `tv-profile-screens` + `console-chip-conveyor`
+ `console-delta-chip-anchor` + `console-flight-paint` — по 2 повтора; хуки, задетые краской, — переводить тем же диффом (инвариант 14).

## 4. Лицо, локаль, лор, арт
Арт T05; лор EN (ключ владельца) + RU; RU карты — решение 1; новые EN-ключи: «${0} gains +1 influence from ${1}» (журнал), «Your influence» («Ваше влияние»),
«beyond the Agenda track» (hint ярлыка — «сверх Карьеры»), «Influence ${0} → ${1}» (чип композера) — `grep` ключа по всем `src/locales/*/*.json` ДО добавления;
RU чужих ключей не переписывать (ключ эффекта карты — свой).

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardInformation`, `requirementProse`, `premiumCardViewModel`, `cardLore` (T05), `crossPlayerCoverageGuard`,
   `TurmoilCardsUnderRedux` (пин 10), `premiumScope.spec`, `parliamentGlossary.spec`, `AgendaStepGlyph.spec`, `e2eLiveness`, `lessDeadSelectorGuard`, `glyphLiteralGuard`,
   `consoleTvTypeFloor`, `cursorGrammarGuard`, `flightLayerZOrder`, `ExecutorPolitics.spec`.
2. Юниты §1–§3; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §0.3, §0.4, §3.В; `npm run e2e:affected` + перевод задетых хуков.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd и Deck обязательны)
`screenshots/t05/{tv,fhd,deck}/`: (а) полоса ДО / ПОСЛЕ — покой; (б) состояния полосы; (в) приёмка «+N» и качание шкалы на новом материале; (г) карта:
композер с чипом «2 → 3» → журнал → Карьера с «3 +1» и головой → досье Карьеры → информация → голосование «если победите» → шаг Карьеры с анонсом;
(д) чип руки «1 из 2». Таблица якорей ДО / ПОСЛЕ (max |Δ| px) — в реестр. С дивана: «я вижу, сколько у меня влияния, не складывая в уме?»

## 7. Полировка по пути
1. Реестр: раздел **CG** «ИТОГОВОЕ ВЛИЯНИЕ ВЕЗДЕ · ВЕРХНЯЯ ПОЛОСА — МАТЕРИАЛ, НЕ ФОРМА (2)» — диагноз 2–7 строками (классы: «печатается слагаемое вместо
   суммы», «тихий бонус в журнале», «превью без дельты», «текст на кромке»); номера — по footer.
2. Бэклог `weak-visuals-backlog` — «верхняя полоса» → DONE; замеченное по пути (бар, правый рельс) — ДОБАВИТЬ, не делать.
3. Доки: `parliament-glossary.md` — строка «ВЛИЯНИЕ печатается ИТОГОМ; ярлык «+N» = сверх Карьеры; «уровень N» — только награда клетки трека»; новый контракт
   `docs/claude/console/influence-reading.md` (одно чтение, потребители, грамматика ярлыка, превью, журнал); `hud-frame.md` — § «Материал полосы» (якоря,
   гард паритета, высота-инвариант); `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T05 «СДАНА» (10 из 22; строка hold-back-комментария про Executor — удалить
   как устаревшую), закон в `.claude/rules/console-ui.md` («influence is printed as the seat's FINAL number everywhere; the track's level is a cell's reward»);
   запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — `SendMessage` соседу-14, эталон якорей полосы + кадры «до» + макеты M1–M3 → батч; карта — параллельно.
2. Порядок: лор `T05` → карта + журнал + превью + спек + строка долой (после соседа) → `influenceReading` + потребители + стенд карты → эталон + макеты →
   (после батча) 3.Б краска → 3.В гарды → регрессия → раскадровки → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву (CG) и номера объявлять В МОМЕНТ записи по текущему footer; CF — соседа, не занимать.
4. Отчёт: первой строкой — арт; затем кадры «итог везде» (шкала, лента, досье, информация, композер, журнал), кадры полосы ДО / ПОСЛЕ по профилям, таблица
   якорей, макеты, регрессия, решения 1–8 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (6 с макетами, 2, 4 — рекомендация первой), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Второе сложение влияния на клиенте (только `influence` / `influenceSources` модели и `AGENDA_TRACK` для уровня клетки); слово «уровень» для итога;
  новый значок влияния; раскрашивать число итога ярлыком; `title`; литерал кнопки; текст ниже пола TV; состояние только цветом.
- Сдвигать `--con-hud-h`, бокс чипа / прибора / приёмки, ленту-конвейер (один transform), хост дельты колоды; переименовывать класс полосы; новый stacking
  context над слоем полёта; растить базу Deck; третья грамматика рамок.
- Трогать файлы соседа-14 (`console-rail-material.spec.ts`, `railMaterialMocks.ts`, `TURMOIL_REDUX_CLASSIC_CARDS.md` до его коммита), строку лора `T03`, правый
  рельс, бар, тело Парламента, разбор хода бота, правила карты; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
