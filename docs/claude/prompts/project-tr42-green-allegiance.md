# Промт исполнителю · TR42 Green Allegiance («Верность Зелёным») — ходьба Карьеры на ВЫЧИСЛЯЕМОЕ число шагов: «1 шаг за каждый полный набор из 5 РТ сверх 20» · карта = ходьба TR04 / TR37 + счётный член класса RX13 («полные наборы по 5 РТ сверх порога» — та же функция, тот же разбор) ≈ 15 % · ГЛАВНОЕ — ПРОГНОЗ: игрок ДО нажатия видит, на сколько шагов продвинется, и ПОЧЕМУ ровно на столько (РТ · порог · наборы · до следующего), включая честный ноль

Выдан 2026-10-10. Инфраструктура набора стоит (TR01–TR41, TR66 сданы) — **ничего из неё не повторять.** Процедура —
`docs/claude/turmoil-redux-card-checklist.md` (включая постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва;
**«Бесшовность — workspace-архитектура»**; **«Премиум-планка»** — при карте-декларации полировка = всё сверх карты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила — `.claude/rules/{game-logic,server,
console-ui,animations,premium-card,tests}.md` (**закон 23 `console-ui.md` — ходьба трека: три двигателя, одна фраза**).

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-10):** «главное, чтобы игрок заранее понимал, насколько именно он продвинется, и чётко понимал, почему именно на столько —
механика непростая». Это карта про ПРОГНОЗ. Число шагов не напечатано на карте — оно вычисляется из РТ игрока, и игрок обязан видеть вычисление
ДО того, как заплатит 2 M€: «РТ 33 · порог 20 · 2 полных набора по 5 · до следующего не хватает 2 → маркер пройдёт 2 шага: ② РТ, ③ влияние 2».
И — честный ноль: «РТ 23 · порог 20 · ни одного полного набора · до первого не хватает 2 → маркер не двинется». Ничего из этого клиент не
вычисляет сам (инвариант 7): разбор приходит с сервера в модели ходьбы, и это тот же разбор, которым Парламент объясняет «Щедрое вложение».

**Обязательное чтение до кода:** `src/server/cards/turmoilRedux/RedLawyers.ts` (ОБРАЗЕЦ ходьбы: `bespokePlay` = `ChairmanSeat.walkAgenda(player,
parliament, N, {reason: 'card', card})` синхронно; `cardPlayPreview` = `agendaWalkModel / agendaWalkEffects / agendaWalkStep`), `src/server/cards/
actionPreviews.ts:462–520` (`agendaWalkModel(player, printed)` — `from / to / printed / walked / steps / influence`; `agendaWalkEffects` — чип трека с
`note: 'end of the track'`, чипы РТ / карт / влияния; `agendaWalkStep`), `src/common/models/ActionPreviewModel.ts:700–716` (`AgendaWalkModel`),
`src/client/console/consolePlayCardComposer.ts:311–322` (**`agendaWalkNextRows` — строки «ДАЛЕЕ»: стадия, срез; при `walked 0` — только срез (PL-118)**),
`ConsolePlayCardConfirm.vue:1740–1750`, `tests/client/console/agendaWalk.spec.ts:515–535` (спек строк «ДАЛЕЕ»), **`src/common/parliament/
resolutionCounts.ts:280–282, :318–340, :347–355`** (`TERRAFORM_RATING_SETS_OVER / STEP` = 15 / 5; **`thresholdSets(value, over, step)` =
`⌊max(0, value − over) / step⌋` — ОДНА функция семьи; `ResolutionCountMetricModel {metric, value, over, step, sets, toNext}`;
`countMetricToward`** — разбор, которым Парламент объясняет число), `src/server/parliament/resolutions/ResolutionCounts.ts:113–118`
(`resolutionCount` → `countMetricToward(id, metricValue(player, 'terraformRating'))`), `src/server/parliament/resolutions/greens/GenerousFunding.ts:64–94`
(RX13 — **строка журнала при нуле**: «${0} has no complete set of 5 TR over 15 (TR ${1}) …»), `src/client/console/parliament/influenceYieldModel.ts:
386–400` (**`countedMetricParts(metric)` — чтение «РТ 24 · порог 15 · 1 полный набор · до следующего 1»**, `metricLabelKeyOf`), `docs/TURMOIL_REDUX_
GENEROUS_FUNDING.md` §3–§4 (форма счётного члена, глиф РТ `PremiumCountGlyph`, чтение `ConsoleInfluenceYield` «[РТ] 24 → 1 набор + …», «Для вас»),
`tests/parliament/GenerousFunding.spec.ts:147–190` (таблица РТ → наборы — форма пина), `src/locales/ru/parliament.json:746–765` (словарь наборов:
«${0} {полный набор|полных набора|полных наборов} по 5 РТ сверх 15», «до следующего ${0}», «Каждые полные 5 РТ сверх 15 — один набор…»),
`src/client/components/actions/ActionEffectChip.vue:54–60` (`note` чипа), `docs/TURMOIL_REDUX_MINORITY_REPRESENTATION.md` §3 / §4 / §7 (контракт ходьбы,
TR37 закрыл шаг карты посреди), `tests/e2e/console-red-lawyers.spec.ts:1–45` (контракт e2e ходьбы; фикстуры `red-lawyers*` — `agenda: [from, 3]`,
Зелёные правят, 2 куба на Красных), `tests/e2e/fixtures/generate.ts:2698–2720` (фикстура RX13: **`p1.terraformRating = 24`** — как ставить РТ),
`src/client/components/console/ConsoleHandSection.vue:233, :1248` (плашка-блокер плитки руки — только для неиграбельной), `src/server/cards/corporation/
Teractor.ts:14` (скидка Земли −3 → цена 0), реестр **PL-147** (композер не называет implied-награды — класс полноты прогноза), **PL-052**, **PL-118**,
**PL-145…PL-150 / PL-067** (батч TR41 — ответа нет: переспросить), журнал § TR37 / § TR41. Память: `tr04-walk-hosted-parliament`,
`turmoil-redux-red-lawyers`, `turmoil-redux-plasma-fans`, `polish-premium-bar`, `polish-seamless-workspace-architecture`,
`tr-prompts-carry-polish-budget`, `storyboard-catches-what-the-probe-passes`, `owner-batches-pending-polish-decisions`, `redux-rules-outrank-owner-description`.

Номера строк сняты с `1e49359514` (дерево чистое на момент выдачи) — перед правкой перечитать.

**Что это за карта.** Зелёная (AUTOMATED), **2**, метка **Земля**, требование **Зелёных** (пятая плашка), без ПО: *«Advance your Agenda marker 1 step for
every set of 5 TR that you have over 20. (And collect bonuses from each step.)»* Ходьба — TR04 / TR37 (одна функция, одна фраза, исход в руке); число
шагов — **счётный член класса RX13**: `thresholdSets(РТ, 20, 5)` — та же функция, что считает «полные наборы по 5 РТ сверх 15» для «Щедрого вложения»,
с тем же РАЗБОРОМ (`value · over · step · sets · toNext`) и тем же словарём («полный набор», «до следующего»). Карта ≈ 15 %. Задача — про ПРОГНОЗ:
разбор едет в модели ходьбы на клиент и печатается в композере (чип трека, строка «ДАЛЕЕ», инспектор), ноль — названным, и про самую длинную
ходьбу набора (РТ 45 с позиции 0 — пять шагов подряд).

**Оценивается — в этом порядке веса.**
1. **ОДНА ФУНКЦИЯ ДЕЛЕНИЯ** — число шагов считает `thresholdSets` (общая с RX13), разбор строит общий помощник семьи; в файле карты — только константы
   `over 20 / step 5` и вызовы. Ни «⌊(tr − 20) / 5⌋» руками, ни на сервере, ни на клиенте.
2. **ПРОГНОЗ ПОЛНЫЙ И ЧЕСТНЫЙ** (кадры 4K — приёмка): композер ДО нажатия: чип трека «★ 1 → 3» с нотой «2 набора по 5 РТ сверх 20», строка «ДАЛЕЕ»
   с разбором `countedMetricParts` (РТ · порог · наборы · до следующего) и перечнем шагов с бонусами (② РТ, ③ влияние 2 — чипы `agendaWalkEffects`),
   ответ Зелёных на каждый РТ-шаг (прогноз `greens-tr`); **ноль** — своя строка «Маркер не двинется: …» и ни одного обещания стадии (PL-118); срез
   конца трека — «N из M · конец трека». Инспектор (X) карты — тот же разбор.
3. **Ходьба — класс без изменений**: TR04 / TR37 e2e 8 / 8, тайминги не тронуты; пять шагов подряд — раскадровка 4K целиком (К-W1 — темп).
4. **Полировка** (≈ 85 % задачи): полнота прогноза ходьбы (PL-147-класс), плашка-прогноз на плитке руки (К-H1), темп длинной ходьбы (К-W1), цена 0
   (К-P1), батч TR41 без ответа, собственные находки.

| Что зашито сегодня | Факт (файл:строка) |
| --- | --- |
| **Ходьба** | `walkAgenda(player, parliament, N, cause)` (`ChairmanSeat.ts:91–150`): N шагов по одному, бонус каждого ДО следующего, срез конца трека с ОДНОЙ строкой, одна запись + одно событие; **N = 0 → ничего не записано, строки нет** (`taken.length === 0` → `undefined`); клиент — `agendaWalkDirector` (лид 150 → лег → посадка → награда → gap 250), холд `5000 + 3000·(N−1)`; `promiseAgendaWalk` только при `walked > 0` (`ConsoleShell.vue:16248`) |
| **Превью ходьбы** | `agendaWalkModel(player, printed)` (`actionPreviews.ts:474–488`) — `printed` = число шагов карты, `walked` = срез по треку, `steps[]` с видом и уровнем; `agendaWalkEffects` (`:497–516`) — чип трека `{icon: 'agenda', current: from, resulting: to, note?: 'end of the track'}` + чипы РТ (его читает прогноз Зелёных) / карт / влияния; `AgendaWalkModel` (`ActionPreviewModel.ts:700–716`) — **разбора «почему N» в модели нет** |
| **Строки «ДАЛЕЕ»** | `agendaWalkNextRows(walk)` (`consolePlayCardComposer.ts:311–322`): «Карьера — маркер пройдёт N шага», срез; при `walked 0` — ТОЛЬКО срез (PL-118, TR37) — для TR42 ноль не срез, а ОТСУТСТВИЕ наборов: своя строка |
| **Счётный член семьи** | `thresholdSets(value, over, step)` (`resolutionCounts.ts:318–321`); `ResolutionCountMetricModel {metric: 'terraformRating', value, over, step, sets, toNext}` (`:330–338`); `countMetricToward(id, value)` (`:347–355`) — разбор по `id` (RX13 = `over 15`); сервер `metricValue(player, 'terraformRating')` (`ResolutionCounts.ts:117`); клиентское чтение `countedMetricParts` (`influenceYieldModel.ts:390–396`: «РТ ${0}» · «threshold ${0}» · «${0} complete set(s)» · «${0} to the next set»), глиф РТ `PremiumCountGlyph`; RU — `parliament.json:751–757`; таблица-пин RX13: 14 → 0, 15 → 0, 19 → 0, 20 → 1, 24 → 1, 25 → 2, 30 → 3 (`GenerousFunding.spec.ts:148`) |
| **Ноль — названный** | RX13 журнал: «${0} has no complete set of 5 TR over 15 (TR ${1}) and no influence — no M€ from ${2}» (`GenerousFunding.ts:93`, RU `:747`) — класс строки для нуля TR42 |
| **Чип и нота** | `ActionEffectChip.vue:59` — `note` чипа печатается рядом с числом (у ходьбы — «конец трека» `parliament.json:205`) |
| **Плитка руки** | `ConsoleHandSection.vue:233` — `.con-hand__chip` только для `!playable` (`chipLabel` `:1248`): у играбельной карты никакой подсказки до композера |
| **Метка Земли** | скидки Teractor (`cardDiscount {EARTH, 3}` `Teractor.ts:14`), Earth Office, Earth Catapult → цена **0**; Point Luna — +1 карта (`onCardPlayed` Земля); панель оплаты печатает скидку («2 → 0 · −3»); жетон цены с рельса при 0 — `consoleActionCommit.ts:622` (`amount <= 0` → линка нет) для действий; для РОЗЫГРЫША — такт поставки PL-107 (`shipment`) — проверить, что при цене 0 ничего не летит |
| **Зелёные** | РТ-шаг ходьбы → +2 M€ (`onIncreaseTerraformRatingByAnyPlayer`); прогноз — `partyFacts` по чипу РТ ходьбы (TR04); сумма РТ ПОСЛЕ ходьбы на N не влияет (решение 4) |
| **Фикстуры** | `parliamentFixture({agenda: [from, …], arrange: ({p1}) => {p1.terraformRating = N}})` (`generate.ts:2698–2707`); образец ходьбы — `red-lawyers*` (`:1911+`), Зелёные правят по стартовому правилу / `seatEnacted` |
| **Арт** | `Downloads\Mars Arts\TR42.png` — **НЕТ** (есть TR30–TR41). Первым делом попросить у владельца; при сдаче без арта — назвать |

### Чтение скана (`…\Projects\Card_-_TR42.png`)
- **Green Allegiance** · `TR42` · цена **2** · **зелёная (AUTOMATED)** · метка **Земля** (голубая планета) · в оранжевой плашке MIN у цены — эмблема
  **Зелёных** (`{party: PartyName.GREENS}`), не метка.
- Графика, один ряд: **`[★ шаг Карьеры] / [РТ 5]`** и подпись **«OVER 20»** под значком РТ — `b.agendaStep(1).slash().tr(5)` + `.br.text('OVER 20', …)`
  (атомы `CardRenderer.ts:195 tr`, `:580 slash`, `:615 text`; шаг — `agendaStep` TR04).
- Текст: *(Requires the Greens to be ruling or that you have 2 delegates there. Advance your Agenda marker 1 step for every set of 5 TR that you have
  over 20. (And collect bonuses from each step.))*. ПО нет. Внизу слева — только значок модуля → `compatibility` не объявляется.
- Лор напечатан: **«It ain't easy being green.»** (Кермит). Художник — Unknown (так на скане).

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/GreenAllegiance.spec.ts`)
1. **Требование** `{party: GREENS}` — при розыгрыше (власть по стартовому правилу / 2 куба / TR36 не помогает).
2. **Число шагов N = `thresholdSets(РТ, 20, 5)`** — полные наборы по 5 РТ СВЕРХ 20: РТ 14 (соло-старт) → 0, 20 → 0, 24 → 0, **25 → 1**, 29 → 1, 30 → 2,
   35 → 3, 45 → 5, 60 → 8. РТ — полный рейтинг движка (`player.terraformRating`), включая бонусы шкал и карт. Разбор — `{value, over: 20, step: 5,
   sets, toNext}` той же формы, что у RX13 (`toNext` — сколько РТ до следующего набора, всегда ≥ 1).
3. **N считается ОДИН раз, до ходьбы.** РТ-шаги самой ходьбы (② ④ ⑥ ⑨ ⑪) не добавляют наборов: РТ 29 → 1 шаг; если это шаг РТ и рейтинг стал 30 —
   второго шага нет.
4. **Ходьба** — `walkAgenda(player, parliament, N, {reason: 'card', card})` синхронно; бонус каждого шага до следующего; конец трека режет честно
   (строка один раз; превью «N из M · конец трека»).
5. **Ноль — розыгрыш законен** (решение 3): цена уплачена, карта в табло, метка Земли считается; записи и события ходьбы нет; **строка журнала с
   разбором** (класс RX13): «${0} has no complete set of 5 TR over 20 (TR ${1}) — the marker stays»; при N > 0 — строка «${0} has ${1} complete set(s) of 5 TR
   over 20 (TR ${2}) — ${3} step(s)» перед строками шагов. Никакого `recordSkippedEffect` (это не потеря — это вычисленный ноль, названный ДО нажатия).
6. **РТ шага ходьбы — обычный РТ** (Зелёные +2 M€ за каждый, задание «N РТ» засчитывает); задание, закрытое им, встаёт ПОСЛЕ ходьбы (TR04 rule 7);
   влияние перечитывается по шагам.
7. **Метка Земли**: скидки Земли применяются (Teractor → цена 0 — играбельна, платёж 0); Point Luna тянет карту; ответ стола на розыгрыш летит (PL-124).
8. **Превью** (`cardPlayPreview`): модель ходьбы с РАЗБОРОМ (`basis`), `printed = N`, `walked` — по треку; чипы по шагам; при N = 0 — чипов ходьбы
   нет, разбор есть; при срезе — оба (разбор + «N из M · конец трека»).
9. Раз в игру (событие? нет — AUTOMATED, одноразовый розыгрыш); 10. save / load — ничего нового; 11. MarsBot не играет; 12. соперник видит ходьбу
   (watcher яруса) и нотификацию с CTA «Открыть Парламент» (класс TR31 / TR37).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, не блокер)
1. RU-имя **«Верность Зелёным»** (альтернатива «Зелёная верность»).
2. Лор RU: **«Нелегко быть зелёным.»** (канон песни Кермита).
3. **Ноль играбелен и назван** (правило 5; TR37 decision 5 — прецедент «конец трека»; свод: карта играется, даже если эффект пуст). Альтернатива —
   `bespokeCanPlay` false с причиной «РТ 23 — ни одного полного набора по 5 сверх 20» (класс TR14 «no city can move»). Рекомендация — играбелен: карта за
   2 M€ с меткой Земли имеет смысл и без шагов, а ложь была бы только в молчании — его нет.
4. **Разбор едет в модели ходьбы** — `AgendaWalkModel.basis?: ResolutionCountMetricModel` (тот же тип, что у Парламента); общий помощник семьи
   `thresholdBreakdown(value, over, step)` выделяется из `countMetricToward` (RX13 переходит на него — один писатель разбора); карта хранит константы
   `GREEN_ALLEGIANCE_OVER = 20`, `GREEN_ALLEGIANCE_STEP = 5` и экспортирует `greenAllegianceSteps(player)` (разбор) — одно чтение для `bespokePlay` и
   `cardPlayPreview`.
5. **Где печатается «почему»** — три места, один словарь: (а) чип трека — `note` «${0} set(s) of 5 TR over 20» (плюрал семьи); (б) строка «ДАЛЕЕ» —
   «Карьера — ${0} шага: РТ ${1} · порог 20 · ${2} полных набора · до следующего ${3}» (части — `countedMetricParts`, слово «порог» — ключ семьи
   `threshold ${0}`), при нуле — «Маркер Карьеры не двинется: РТ ${0} · порог 20 · ни одного полного набора · до первого ${1}»; (в) инспектор карты
   (X «Осмотреть») — та же строка под правилом как «ДЛЯ ВАС» (класс `parliamentAnnotations` «Учтены сейчас»); композер остаётся местом решения, инспектор —
   местом чтения. **Чип трека при нуле** — «★ 1 → 1» не печатать (PL-118: нечего обещать), разбор говорит за него.
6. **e2e: ОДИН новый спек** `tests/e2e/console-green-allegiance.spec.ts` с тремя фикстурами (§4) — новое здесь: вычисляемое N с разбором в композере,
   честный ноль, самая длинная ходьба набора.
7. **Батч владельцу** — ПЕРВЫМ, одним `AskUserQuestion`: К-H1 (плашка-прогноз на плитке руки), К-W1 (темп пяти шагов — «дожать» A для хостимой ходьбы,
   класс `scheduleHurriedParliamentBeat` заседания), решение 3, неотвеченные PL-145…PL-150 / PL-067 / PL-052 (батч TR41) — с теми же рекомендациями.

---

## 0. Рабочее дерево
HEAD `1e49359514`; **через минуты после выдачи сосед начал незакоммиченную работу над прогнозом (похоже, PL-147 / PL-052 из батча TR41):**
`src/client/components/actions/ActionEffectChip.vue`, `src/server/cards/actionPreviews.ts`, `src/server/models/{actionPreview,cardPlayPreview,
effectForecast,standardProjectPreview}.ts`, `src/locales/ru/effect_forecast.json`, `WaterHauling.ts` + спеки TR06 / TR41 — **ровно те файлы, где живут
`agendaWalkEffects` и нота чипа**. ListAgents / SendMessage ДО старта: дождаться коммита соседа, перечитать `actionPreviews.ts:462–520` и
`ActionEffectChip.vue` заново (номера строк промта могут уехать), свою правку класть ПОВЕРХ его коммита. Общие файлы (`resolutionCounts.ts`, `actionPreviews.ts`,
`ActionPreviewModel.ts`, `consolePlayCardComposer.ts`, `ConsolePlayCardConfirm.vue`, локали, документы, реестр — нумерацию делим с соседями: объявить
номер ДО записи; следующий **PL-151**, раздел **U**) — только через временный индекс (`GIT_INDEX_FILE` абсолютным путём; **read-tree → commit ОДНОЙ
командой** при активном соседе — память `git-temp-index-race`; `git reset -q` после), `git add` своими путями; после коммита — `git restore --staged
package.json package-lock.json`. Свой снапшот: `npm run e2e:snapshot tr42`, `TM_E2E_ROOT=.e2e-tr42`; 4K — `--workers=1`. Арт — спросить сразу.

## 1. Сервер
**Семья счёта** (`src/common/parliament/resolutionCounts.ts`): выделить `thresholdBreakdown(metric, value, over, step): ResolutionCountMetricModel` из
`countMetricToward` (RX13 зовёт его; `GenerousFunding.spec` без правок, `thresholdSets` не трогать).
**Карта** `src/server/cards/turmoilRedux/GreenAllegiance.ts`: `CardName.GREEN_ALLEGIANCE = 'Green Allegiance'`, манифест без `compatibility`; AUTOMATED, 2,
`[Tag.EARTH]`, `requirements: {party: PartyName.GREENS}`, без ПО; константы `GREEN_ALLEGIANCE_OVER = 20`, `GREEN_ALLEGIANCE_STEP = 5`;
`greenAllegianceSteps(player)` → `thresholdBreakdown('terraformRating', player.terraformRating, OVER, STEP)`; `bespokePlay`: разбор → строка журнала (правило 5)
→ при `sets > 0` `walkAgenda(player, parliament, sets, {reason: 'card', card})`; `cardPlayPreview`: `agendaWalkModel(player, sets, basis)` →
`agendaWalkEffects` (чип трека с нотой — при `sets > 0`) → `agendaWalkStep`; `metadata`: `cardNumber: 'TR42'`, `infoText` (решение 8 ниже), `renderData` по
скану, `description`. Шапка — чтение скана, правила 1–12, «счётный член семьи RX13 на треке Карьеры».
**Модель**: `AgendaWalkModel.basis?: ResolutionCountMetricModel` (`ActionPreviewModel.ts:700–716`); `agendaWalkModel(player, printed, basis?)`;
`agendaWalkEffects` — нота чипа трека из `basis` («${0} set(s) of 5 TR over ${1}» — плюрал), срез — как был («end of the track» побеждает? — нет: ДВЕ ноты не
бывает — при срезе нота среза, разбор остаётся в строке «ДАЛЕЕ»); `agendaWalkStep` — без изменений.
**Спек** `GreenAllegiance.spec.ts` (форма TR37 + таблица): требование; таблица РТ → шагов (14 · 20 · 24 · 25 · 29 · 30 · 35 · 45 · 60); разбор (`value / over /
step / sets / toNext`, `toNext` при 24 = 1, при 25 = 5); N один раз (29 с позиции 1 → ② РТ → 30, второго шага нет); срез (позиция 10, РТ 35 → 2 шага + строка);
ноль (РТ 23: играбельна, 2 M€, табло, строка нуля, ни записи, ни события); Зелёные +2 M€ на РТ-шаг; Teractor → цена 0, играбельна; Point Luna; MarsBot;
save / load; превью — `basis` и чипы по шагам, при нуле чипов ходьбы нет. `tests/parliament/AgendaWalk.spec.ts` — N = 5 с позиции 0 (новый случай: пять
записей, пять бонусов, одно событие). Гарды §3 — ворклист пуст; `make:cards` 0 / 0 / 0.
8. **Ключи** (Grep-инструментом перед КАЖДЫМ): описание — скан дословно → RU «Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на их
   резолюции. Продвиньте маркер Карьеры на 1 шаг за каждый полный набор из 5 РТ сверх 20 (и получите бонус каждого шага).»; `infoText` **«Agenda: 1 step
   per full 5 TR over 20»** → «Карьера: шаг за каждые полные 5 РТ сверх 20» (правило 70 > 52); нота чипа **«${0} set(s) of 5 TR over ${1}»** → «${0}
   {набор|набора|наборов} по 5 РТ сверх ${1}» (образец `parliament.json:751`); строка «ДАЛЕЕ» **«Agenda — ${0} step(s): TR ${1} · threshold ${2} · ${3} complete
   set(s) · ${4} to the next»** и ноль **«The Agenda marker stays: TR ${0} · threshold ${1} · no complete set · ${2} to the first»**; журнал — два ключа правила 5.
   Существующие ключи семьи («threshold ${0}», «${0} complete set(s)», «${0} to the next set») — переиспользовать через `countedMetricParts`, где форма
   позволяет; RU-плюралы — по образцу `:751–757`.

## 2. Клиент
1. **Строки «ДАЛЕЕ»** — `agendaWalkNextRows(walk)`: при `walk.basis` — строка разбора ПЕРЕД строкой стадии (порядок: почему → сколько → срез); при
   `sets === 0` — только строка нуля (стадии нет — PL-118); спек `agendaWalk.spec.ts` § «next rows» — таблица: 2 шага, 1 шаг, ноль, срез + разбор.
2. **Чип трека** — нота из `basis` через `ActionEffectChip` (ничего нового в компоненте); при нуле чипа нет.
3. **Инспектор карты** (X) — строка «ДЛЯ ВАС» под правилом: тот же `countedMetricParts` (класс `parliamentAnnotations:329`); гард словаря Парламента ходит
   только по его деревьям (PL-109) — новую строку вне Парламента проверить руками / кадром.
4. **Плитка руки** (К-H1, батч): тихая плашка-прогноз «★ 2» / «★ 0» на играбельной карте ходьбы (класс `.con-hand__chip`, но не блокер) — владелец просил
   «заранее»: до композера. Кадры ДО / ПОСЛЕ на 4K.
5. **Темп длинной ходьбы** (К-W1, батч): пять шагов ≈ 5 × (150 + ≈ 1070 + награда + 250) ≈ 8–10 с при поглощённом вводе (`executing`); предложение —
   «дожать» на A для хостимой ходьбы по классу заседания (`AgendaWalkHooks.beat` уже принимает планировщик — `scheduleHurriedParliamentBeat`); кадры и
   замер. Тайминги фразы не трогать (`sitting-v4` окно 700–1450 — A/B).
6. **Цена 0** (К-P1): розыгрыш с Teractor — такт поставки PL-107 при цене 0: ни жетона «−0», ни паузы; проверить раскадровкой; при дефекте — класс.
7. **Гарды**: `agendaWalk.spec` (строки), юнит ноты чипа, `GenerousFunding.spec` без правок (общий помощник), `parliamentGlossary` зелёный.

## 3. Лицо, локаль, лор
Арт (когда владелец положит): `node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR42.png" TR42` → `npm run make:cards` (0 / 0 / 0).
Лор — `assets/text/lore_texts.json` ключ `"TR42"`, RU — `src/locales/ru/lore_texts.json` (решение 2). Локаль — решение 8; `card_info.json` — `infoText`.

## 4. Тесты
Сервер — §1. Клиент — §2.7. **e2e — ОДИН новый** (решение 6) `tests/e2e/console-green-allegiance.spec.ts` (fhd + **4K**, `--repeat-each=4`, `{...NO_PAYMENT}`,
state-waits, пробник класса `__tr04`, `TM_E2E_STORYBOARD=1`) с ТРЕМЯ фикстурами в `generate.ts` (`parliamentFixture`, образец `red-lawyers`: Зелёные правят по
стартовому правилу, карта в руке, M€ ≥ 2; красный — второй клиент, `customCorporationsList: [TERACTOR, THORGATE]` — ⚠ Teractor у красного; у синего —
без скидки Земли, чтобы цена была 2):
1. **`green-allegiance`** — `p1.terraformRating = 33`, `agenda: [1, 3]`: композер — «★ 1 → 3 · 2 набора по 5 РТ сверх 20», «ДАЛЕЕ: Карьера — 2 шага: РТ 33 ·
   порог 20 · 2 полных набора · до следующего 2», чипы «+1 РТ», «влияние 1 → 2», «Сработает: +2 M€ Зелёные»; A → один POST; вход (PL-084 / PL-120 (а)),
   ходьба ② РТ (чип на рельс, Зелёные ПОСЛЕ) → ③ влияние; уход; сервер — маркер на 3, РТ 34, журнал: строка разбора + два шага + событие.
2. **`green-allegiance-zero`** — `p1.terraformRating = 23`: композер — БЕЗ чипа трека, строка «Маркер Карьеры не двинется: РТ 23 · порог 20 · ни одного
   полного набора · до первого 2», «Разыграть карту» живо; A → один POST; обычная посадка; Парламент не поднимается (`wsMax ≤ 1`); 2 M€ уплачено;
   журнал — строка нуля; записи ходьбы нет; второй клиент — нотификация розыгрыша без ходьбы.
3. **`green-allegiance-long`** — `p1.terraformRating = 45`, `agenda: [0, 3]`: композер «★ 0 → 5 · 5 наборов», «ДАЛЕЕ: … 5 полных наборов · до следующего 5»;
   ходьба ①②③④⑤ (влияние 1 · РТ · влияние 2 · РТ · влияние 3), два РТ-чипа и два ответа Зелёных, каждый лид ждёт посадки награды; длительность от A до
   поля — в трассу (К-W1); ни одного сэмпла с двумя кубами или без; соперник видит пять легов.
Регрессия на своём снапшоте, до / после: `console-red-lawyers`, `console-minority-representation`, `console-party-sanctions`, `console-parliament-generous`
(общий помощник разбора), `console-parliament-chairman-quest`, `console-parliament-sitting-v4` (окно), `console-biological-simulations`,
`aaa-driver-canary`; `npm run e2e:affected`; гарды `e2eLiveness` + `e2eDriverGuard`.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Витрина EN / RU (ряд «★ / РТ 5 · OVER 20»), рука (плитка: без прогноза — К-H1 кадр ДО), композер на трёх РТ (33 / 23 / 45) — **читается ли «почему» с
дивана**: строка разбора против чипов РЕЗУЛЬТАТА по весу (в кадре TR37 `screenshots/red-lawyers/tv4k/01-composer-6.png` строка «ДАЛЕЕ» заметно тише
чипов — для TR42 «почему» обязано быть не тише «сколько»), инспектор карты, раскадровка входа и ходьбы (2 шага и 5 шагов), ноль (посадка без Парламента),
соперник, журнал. По КАЖДОМУ моменту — вердикт «что здесь слабо?» с кадром.

## 6. ПОЛИРОВКА ПО ПУТИ — всё сверх карты (премиум-планка)
Реестр: раздел **U** — маршрут «вычисляемая ходьба: разбор в композере · честный ноль · длинная ходьба · плитка руки».
**1. Минимум сверх P0 назван заранее:** **PL-147-класс** (полнота прогноза ходьбы: каждый шаг с бонусом, ответ Зелёных на каждый РТ-шаг, задание, если
закрывается — все названы ДО нажатия; проверить `agendaWalkEffects` + `partyFacts` на 5 шагах: два РТ → «+4 M€» одним чипом или двумя?), **К-H1**, **К-W1**,
**К-P1**, батч TR41 (PL-145…PL-150, PL-067, PL-052) — переспросить.
**2. Открытые строки на маршруте — сперва воспроизвести:** PL-052 · PL-149 (пауза коммита 4K) · PL-128 (проход бесшовности: розыгрыш с хостимым шагом).
**3. Кандидаты, найденные при подготовке** (глазами НЕ подтверждено):
- **К-F1 · Вес строки «ДАЛЕЕ» на 4K** — в кадре TR37 строка разбора тише чипов РЕЗУЛЬТАТА; для карты, чей смысл — вычисление, «почему» и «сколько» —
  один вес; кандидат: разбор как ЧТЕНИЕ семьи (`ConsoleInfluenceYield`-грамматика «[РТ] 33 → 2 набора → [★] 2», `data-yield-in`) в кластере РЕЗУЛЬТАТ,
  строка «ДАЛЕЕ» — только стадия. Батч кадрами.
- **К-F2 · Разбор в инспекторе карты** — есть ли у инспектора карты место «ДЛЯ ВАС» (как у резолюции)? Если нет — класс для всех карт со счётным
  условием (TR33 матрица МЕТКИ — прецедент).
- **К-H1 · Плитка руки без прогноза** — играбельная карта с нулём шагов выглядит как любая другая.
- **К-W1 · Пять шагов без «дожать»** — ввод поглощён на ≈ 10 с.
- **К-P1 · Цена 0** — такт поставки / панель оплаты при скидке до нуля.
- **К-R1 · Нотификация соперника** — «[★] +5 · [РТ] +2» порядок чипов (PL-076 — ждёт владельца).
**4. Чеклист §4** — строка ходьбы дополняется: «число шагов ВЫЧИСЛЯЕМОЕ → `basis` в `agendaWalkModel`, общий помощник разбора, строка нуля».

## 7. Режим работы
**Коммиты карты**: (1) семья — `thresholdBreakdown` + `basis` модели + нота чипа + строки «ДАЛЕЕ» (общий слой, RX13 / TR04 / TR37 без изменения
поведения); (2) карта + спек + локаль + лор + арт; (3) e2e — три фикстуры + спек; (4) документы — журнал § TR42, `docs/TURMOIL_REDUX_MINORITY_
REPRESENTATION.md` §2.6 / §3 (контракт ходьбы: «вычисляемое N — разбор в модели»), `docs/TURMOIL_REDUX_GENEROUS_FUNDING.md` §3 (помощник семьи — второй
потребитель), чеклист §4, реестр раздел U, промт. **Коммиты полировки** — отдельно (`Polish (TR42 walk): PL-### — …`), с «до / после» и гардом.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой — `npm run make:css` +
`npm run build:server`. **Не пушить.** Батч владельцу — после P0 и осмотра, ДО остальной полировки (решение 7).
Гочи: `coloniesExtension: true` в `testGame`; старый бандл новую карту не рисует — стенд на своей сборке; на 4K ждать `.con-hand:not(.con-hand--transit)`
до `focusCard`; имена кадров скринкаста = время получения; N = 1 ходьбы мерить только A/B; `python3` — заглушка Store; `eqeqeq` без исключения для null;
bash heredoc с длинным RU — Write; `node -e` с бэктиками — Edit; `rtk grep` с фиксированной строкой виснет — Grep-инструмент; `/* */` внутри JSDoc закрывает
комментарий; `npm run build:server`, не голый `tsc`; `build:client` может молча «compiled with 1 error» — проверять `main.js` mtime; при активном соседе
временный индекс — одной командой.
**В отчёте:** что встало само (ходьба, счётный член), вердикты по моментам (§5) с кадрами 4K — отдельно «читается ли почему», батч владельцу и ответы,
регрессия, гарды, новые ключи, подтверждение решений 1–8, арт. **Раздел «ПОЛИРОВКА»** — с перечнем СОБСТВЕННЫХ находок. **Явно — всё, что не
получилось сделать, и почему.**

## 8. Нельзя
Деление «руками» (`Math.floor((tr − 20) / 5)`) где бы то ни было — только `thresholdSets` / помощник семьи; разбор, вычисленный клиентом; вторая функция
ходьбы / второй директор; обещание стадии при нуле (PL-118); `recordSkippedEffect` для вычисленного нуля; молчание о нуле (строка журнала обязательна);
правка таймингов фразы ходьбы без A/B; литерал имени карты в `src/client/**`; литерал кнопки контроллера; `title`; определение промпта по заголовку;
`compatibility`; e2e «на ещё одну карту» сверх одного спека; полировка только-для-Deck (PL-105); `shardPlan.json`; незакоммиченные файлы соседа; пуш и
красные коммиты.
