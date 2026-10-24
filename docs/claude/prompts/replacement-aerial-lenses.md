# Промт исполнителю · Aerial Lenses:redux («Воздушные линзы») — ПЕРВАЯ из семи КАРТ-ЗАМЕН набора Redux (§3.2; «на месте» — список ПУСТ после Pristar): зелёная, **3** (было 2), метка **Наука** (была ни одной), **без −1 ПО**; требует **«Учёных»** у власти или 2 ваших делегата на их резолюции (НЕ «Зелёных», которых дало бы общее правило Кельвинисты → Зелёные — так напечатано); «уберите до 2 растений у любого игрока; увеличьте производство тепла на 2 шага» — ПЕРВЫЙ прецедент механизма ЗАМЕНЫ: `:redux`-имя, `cardsToRemove` Redux-манифеста, свой `TR##`-номер за пределами TR01…TR70 (гард расширяется осознанно), арт и лор ЧЕРЕЗ `reimplements` от классической T01 (арт `Mars Arts/T01.png`, лор под ключом `T01` — ровно так подготовил владелец); без полировки

> **Статус: ВЫДАН 2026-10-24.** HEAD `9feba3fdee`. **Pristar (R07) — В РАБОТЕ у соседа `terraforming-mars-ed`** (незакоммичено: `Pristar.ts` + спек,
> `common/cards/turmoilReduxAdaptation.ts` — строка PRISTAR снята, список «на месте» ПУСТ, `PlayerModel.ts`, `ProductionIncomeModel.ts`, `Player.ts`,
> `ServerModel.ts`, `ConsoleResourcePanel.vue`, `ConsoleShell.vue`, `generationScene.ts`, `console.less` § `.con-score`, `console/railMarks.ts`, `ru/{card_info,
> console,turmoil_corporations}.json`, `TurmoilCardsUnderRedux.spec`, `AutomaCorporations.spec`, `testHelpers.ts`) — ЕГО файлы: `turmoilReduxAdaptation.ts` и
> `TurmoilCardsUnderRedux.spec` правишь ПОСЛЕ его коммита (`ListAgents` + `SendMessage`; он коммитит явными путями). ⚠ `TURMOIL_CARDS_TO_ADAPT_IN_PLACE`
> теперь пустой — код, берущий `[0]`, ломается. Чужие незакоммиченные `devGuaranteedCards.ts/.spec` — не трогать. **Лор владельца** — строка
> `"T01": "Burning the ground to release carbon dioxide."` НЕЗАКОММИЧЕНА последней в `assets/text/lore_texts.json` (ключ T01 — классический номер; см.
> решение 2): коммитить ПЕРВЫМ ханком, только её. **Арт** — `C:\Users\zelin\Downloads\Mars Arts\T01.png` (не импортирован: в `assets/card-images` нет `T01`).
> Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Replacement - Aerial Lenses.png` (печатает «TR00» — заглушка). Реестр: footer «PL-980», последний
> раздел CI; **без своего раздела** (полировки нет); дефекты общего слоя — строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine**
> (`npm run e2e:remote -- aerial …`; exit 2/3/4 → спросить).

Процедура — **`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 «Карта-замена» (`:162–183`)**: п.1 класс `src/server/cards/turmoilRedux/AerialLensesRedux.ts`, имя
`CardName.AERIAL_LENSES_REDUX = 'Aerial Lenses:redux'` (прецедент апстрима `DEIMOS_DOWN_PROMO = 'Deimos Down:promo'`, `CAPITAL_ARES`; клиент режет суффикс
`name.split(':')[0]` — `ConsoleJournalPanel.vue:396`, `JournalCardChip.vue:155`, `FinalScoringInspector.vue:100`, `StandardProjectPreviewPopover.vue:88` — ПРОВЕРИТЬ
каждое место, где имя — ключ: RU-имя, лор, арт, `CardRenames`, чипы руки/стола/композера, `cardLore`, фикстуры); п.2 регистрация в `TURMOIL_REDUX_CARD_MANIFEST`
+ `cardsToRemove: [CardName.AERIAL_LENSES]`; п.3 ТЕМ ЖЕ диффом — строка долой из `TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` (гард «crossed → cardsToRemove»);
п.4 номер-ключ: сканы печатают «TR00», `TR01…TR70` заняты — гард `TurmoilReduxCardManifest.spec.ts:56–64` (`/^TR\d{2}$/`, `within(1, 70)`) расширить
осознанно; п.5 reserved-гард (`:97–104` — под классическим именем регистрировать нельзя); `§2.4` (`:88–92` — `classicReplacements.ts`, механизм
`cardsToRemove` апстрима), `§4.1` (`:190–192` — строка Aerial Lenses «→ Учёные, 3, Наука, без −1 ПО»). **Чеклист набора** — `docs/claude/
turmoil-redux-card-checklist.md` (§0 до кода, §1 пять точек, §2 специфика: арт `import-card-art.mjs` → `make:cards`, лор EN/RU и паритет `cardLore.spec`,
RU в `turmoil_redux_cards.json`, `card_info.json` из `cardInfoAudit`, тестовый режим; §3 гарды-ворклист; §4 «бесплатно / хук»; **§5 политика e2e — «один спек
на карту с НОВОЙ механикой, ни одного на «просто ещё одну карту»»**; §6 документы). **Контракты:** промт T04 Diaspora Movement (`docs/claude/prompts/
classic-t04-diaspora-movement.md` — ТО ЖЕ требование партии под Redux: дороги, `partyOffVote`, FAQ p.19, TR70-вейвер; спек `tests/cards/turmoil/
DiasporaMovement.spec.ts:66–160` — шаблон), память `target-impact-server-authoritative`, `composer-preselect-direction` (единственная цель — посеяна и
помечена), `console-bot-attack-modal` (атака на MarsBot: маркер `botAttackPrompt`, превью считает сервер), `decline-inside-pick-plan` («до 2 растений» — отказ
внутри выбора), `card-lore-archive-entry`, `ru-card-names-already-exist`, инварианты 1–4, 8, 9, 11 (гарды — ворклист).

**Образцы — по частям:** **классика** — `turmoil/AerialLenses.ts` (`production {heat: 2}` + `removeAnyPlants: 2`, `requirements: {party: KELVINISTS}`, `cost 2`,
`victoryPoints: −1`, `cardNumber: 'T01'`, `b.minus().plants(−2, {all}).production(heat 2)`), спек `tests/cards/turmoil/AerialLenses.spec.ts:10–45` (без растений →
`undefined`; с растениями → `OrOptions`); **реестр замен** — `turmoilRedux/classicReplacements.ts:1–40` (строка Aerial: «party Kelvinists → SCIENTISTS (not the Greens the
general rule would give); cost 2 → 3; gains a Science tag; the −1 VP is gone»); **манифест** — `TurmoilReduxCardManifest.ts:78–110` (`projectCards: {[CardName.X]:
{Factory}}`, `compatibility`; `cardsToRemove` — сегодня отсутствует: добавить в литерал манифеста, `ModuleManifest.ts:56–76`); `common/parliament/ParliamentTypes.ts:34`
(`normalizeReduxParty`: KELVINISTS → GREENS — ОБЩЕЕ правило, которое эта карта ПЕРЕПЕЧАТЫВАЕТ как «Учёные» — требование писать `PartyName.SCIENTISTS` прямо);
**арт / лор** — `client/cards/cardArt.ts:72–92` (`artKey`: свой `cardNumber`, иначе `metadata.reimplements` — борт у источника), `client/cards/cardLore.ts:17–30, :100–112`
(то же для лора; `cardLore.spec.ts:60–70` § reimplements — «borrows the source card's entry»), прецеденты `promo/DeimosDownPromo.ts:18` (`reimplements:
CardName.DEIMOS_DOWN`), `GreatDamPromo.ts:31`; **атака растениями в консоли** — `deferredActions/RemoveAnyPlants.ts:18, :29–49` (цель-бот: `AutomaTargeting`;
`choiceContext {source, mode: 'attack'}`), `:185–230` (`previewOptions` — превью = исполнение), `models/actionPreview.ts:978–980` (шаг `removeAnyPlants` в превью
розыгрыша), e2e `console-bot-attack.spec.ts`, `console-self-target.spec.ts`, `console-notification-bonus-attack.spec.ts`, `console-play-scale-conclusion.spec.ts:17`
(Mining Expedition — «removeAnyPlants finds no opponent»); **стиль файла карты** — `turmoilRedux/SponsoredPowerPlant.ts:1–40` (заголовок: «SCAN READING» + «RULE
READINGS, pinned by …»); **журнал** — `docs/claude/turmoil-redux-cards-progress.md:2969` (формат записи TR70).

---

## Диагноз (подтверждён файл:строка на `9feba3fdee`; перепроверить на своём HEAD)
1. **Правила замены — декларативны целиком.** Класс = классический `behavior` (`production {heat: 2}` + `removeAnyPlants: 2`) с `cost: 3`, `tags: [SCIENCE]`,
   `requirements: {party: SCIENTISTS}`, БЕЗ `victoryPoints`. Ни строки bespoke: требование — `PartyRequirement` через фасад (T04-класс: дороги, именованная
   причина «0 из 2», `partyOffVote`, FAQ p.19, TR70-вейвер), растения — `RemoveAnyPlants` (цель-композер, бот через `AutomaTargeting`, защищённые растения —
   именованно, «до 2» — отказ внутри выбора), тепло — Executor. Превью розыгрыша: шаг `removeAnyPlants` + производство — из коробки.
2. **Механизм замены — впервые.** `cardsToRemove` в Redux-манифесте ещё не объявлен; `GameCards`-фильтр апстрима (`filterReplacedCards`) ждёт его; гард
   `TurmoilCardsUnderRedux.spec` требует «строка долой + `cardsToRemove`» одним диффом; reserved-гард запрещает классическое имя. Имя `'Aerial Lenses:redux'`
   → каждая поверхность, где имя — ключ, ОБЯЗАНА резать суффикс: RU-имя (`turmoil_cards.json:2` «Воздушные линзы» под ключом `Aerial Lenses` — переводчик
   имени карты должен искать по срезанному имени; проверить `translateText(name)` путь), `CardRenames` (не нужен), чипы, журнал (уже режет), фикстуры, `card_info`.
3. **Номер-ключ.** Манифест: `TR##`, 1…70, гард `:57–64`. Замены — СВОЙ диапазон в порядке реестра: **TR71 Aerial Lenses**, TR72 Banned Delegate, TR73 Political
   Alliance, TR74 Recruitment, TR75 Sponsored Mohole, TR76 Vote of No Confidence (корпорация — своя схема при её задаче); гард → `within(1, 76)` + отдельный `it`:
   «TR71…TR76 — только карты из `TURMOIL_REDUX_CLASSIC_REPLACEMENTS`, в порядке реестра» (чтобы номер не занял обычный проект).
4. **Арт и лор — через `reimplements`.** Владелец положил арт как `T01.png` и лор под `T01` — классический номер. Идиома форка для перепечатки:
   `metadata.reimplements: CardName.AERIAL_LENSES` → `artKey` / `cardLoreSource` берут у источника. Значит: арт импортировать под **T01** (классическая карта
   получает арт и лор бесплатно), лор — ключ `T01` (как есть) + RU; `cardNumber: 'TR71'` — только ID манифеста (без своих арт/лор файлов). Гард паритета лора
   (`cardLore.spec` скоуп turmoilRedux) — убедиться, что он идёт по `reimplements` (`:60–70` — идёт).
5. **Описание и RU.** EN-ключ описания НОВЫЙ («Requires the Scientists to be ruling or that you have 2 delegates there. Remove up to 2 plants from any player.
   Increase your heat production 2 steps.» — текст скана); RU — в `turmoil_redux_cards.json` голосом набора (`:110–115` — «Требует, чтобы «Зелёные» были у власти
   или у вас было 2 делегата на их резолюции. …»); RU-имя — существующее «Воздушные линзы» (через срез суффикса; если переводчик не режет — ключ-дубль
   `"Aerial Lenses:redux"` НЕ заводить, а чинить срез). `card_info` — из `cardInfoAudit`. Лор-цитата на скане ЕСТЬ («Burning the ground to release carbon
   dioxide.») — не придуманный, реестр `invented-lore` не трогать.
6. **Стол.** Под Redux: классическая Aerial Lenses никогда не раздаётся (`cardsToRemove`), замена — да; под классикой: Redux-манифест выключен, классика цела
   (пин обоих). Премиум-скоуп: модуль `turmoilRedux` — в скоупе автоматически: ВСЕ гарды §3 чеклиста печатают ворклист — читать красные как список.
7. **e2e.** По §5 чеклиста — у карты НЕТ новой механики (требование партии — T04, атака растениями — соседи, тепло — Executor) → **своего e2e НЕТ**;
   доказательство — юниты + существующие стенды; единственное новое — МЕХАНИЗМ замены (раздача), он серверный → спек. Если владелец хочет кадры —
   §6 (раскадровка одной сцены по существующей фикстуре с гарантированной картой — `devGuaranteedCards` чужой незакоммиченный файл: НЕ трогать; гарантировать
   через `GUARANTEED_MODULES` как обычно).

## Правила карты (спек `tests/cards/turmoilRedux/AerialLensesRedux.spec.ts` пинит каждое — по шаблону T04 `:66–160`)
1. Печатная: зелёная, 3, Наука, без ПО, `cardNumber 'TR71'`, `reimplements: AERIAL_LENSES`, имя `'Aerial Lenses:redux'`; лицо — «− [растение][растение] / пр. [тепло][тепло]»,
   плита MIN — эмблема Учёных (TR15-класс), арт — T01 (через `reimplements`), лор — T01.
2. Требование — «Учёные» (ПЕЧАТНО, не нормализация): у власти / 2 ваших делегата на их резолюции / резолюции нет на голосовании → дорога закрыта / эффект от
   карты — не дорога / TR70-вейвер; причина руки именованная.
3. Розыгрыш: +2 пр. тепла; `RemoveAnyPlants(2)`: соперник с растениями → `OrOptions` целей (превью = исполнение; защищённые — отказ с причиной; «до 2» —
   меньше при нехватке; отказ возможен); без целей → ничего (именованный пропуск по правилу Mining Expedition); цель-бот — `AutomaTargeting`; соло — без цели.
4. Раздача: Redux-стол — замена в колоде, классика — нет; классический стол — классика в колоде, замена — нет (`compatibility`/манифест); пин `TurmoilCardsUnderRedux`
   (строка ушла + `cardsToRemove`); reserved-гард; save / load — ничего нового; MarsBot не играет.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте)
1. **Номер** — (а, рекомендовано) `TR71` + гард «TR71…TR76 = реестр замен по порядку»; (б) отдельный префикс (`TRR01`) — ломает «один префикс на модуль»
   (манифест `:91–96`) — нет.
2. **Арт/лор** — (а, рекомендовано) `reimplements: AERIAL_LENSES`, арт импортировать как `T01` (`node scripts/import-card-art.mjs "<Mars Arts>/T01.png" T01` →
   `make:cards`), лор — ключ `T01` владельца + RU («Выжигаем почву, чтобы высвободить углекислый газ.»); классика получает их бесплатно; (б) свои `TR71.webp` /
   ключ `TR71` — дубль файла и строки, нет.
3. **RU описания** — «Требует, чтобы «Учёные» были у власти или у вас было 2 делегата на их резолюции. Уберите до 2 растений у любого игрока. Увеличьте
   производство тепла на 2 шага.»; имя — «Воздушные линзы» (существующее, через срез суффикса).
4. **e2e** — (а, рекомендовано) своего спека нет (§5 чеклиста); доказательство — спек + гарды + `npm run e2e:affected`; (б) один FUNCTIONAL-спек «замена
   раздаётся, классика нет, лицо с артом T01, композер атаки с единственной целью» — если владелец хочет кадры.
5. **Объём** — всё карта + механизм замены (≈ 100 %); без полировки; дефекты общего слоя (срез суффикса в переводе имени, гард номера, `cardsToRemove` в
   манифесте) — чинить с тестом, строками в реестр текущего footer; шаблон для пяти следующих замен — записать в §3.2 дока (что оказалось не так, как
   описано).

## 0. Рабочее дерево
1. `git log --oneline -1` → `9feba3fdee` на выдаче. `ListAgents` + `SendMessage` соседу-ed (Pristar): твои файлы — `turmoilRedux/AerialLensesRedux.ts` + спек,
   `common/cards/CardName.ts`, `turmoilRedux/TurmoilReduxCardManifest.ts` (+ `cardsToRemove`), `tests/cards/turmoilRedux/TurmoilReduxCardManifest.spec.ts` (гард),
   `common/cards/turmoilReduxAdaptation.ts` + `TurmoilCardsUnderRedux.spec.ts` (ПОСЛЕ его коммита), `assets/card-images/T01.webp` (+thumb, манифест арта),
   `assets/text/lore_texts.json` (строка T01 — первым ханком), `ru/{lore_texts,turmoil_redux_cards,card_info}.json`, доки. Коммиты — ПО ХАНКАМ / явными путями
   (`git commit -- <paths>`); после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine** (если 4б): `npm run build` → `npm run e2e:snapshot aerial` → `npm run e2e:remote -- aerial <spec>`; exit 2/3/4 — СТОП и
   `AskUserQuestion`.

## 1. Сервер — карта + механизм замены (≈ 70 %)
`AerialLensesRedux.ts` (заголовок в стиле набора: SCAN READING + RULE READINGS; декларативно; `reimplements`), `CardName.AERIAL_LENSES_REDUX`, манифест (+ `cardsToRemove`),
гард номера (решение 1), строка долой + пин (после соседа), арт T01, лор RU, RU карты, `card_info`. Спек — правила 1–4; `TurmoilReduxCardManifest.spec` (TR71 в
реестре замен; reserved; `cardsToRemove` содержит классику); `TurmoilCardsUnderRedux.spec` (раздача под обоими столами); гарды §3 чеклиста — ворклист.

## 2. Клиент (≈ 20 %)
Ожидается НОЛЬ новых компонентов: проверить срез суффикса в переводе имени (все поверхности из §3.2 п.1), лицо (арт T01 через `reimplements`, эмблема Учёных
в MIN, две строки), композер атаки (цели, бот, единственная цель посеяна), информация / лор. Что не так — дефект общего слоя: чинить там, с тестом.

## 3. Тесты и регрессия (≈ 10 %)
1. Спек карты; `TurmoilReduxCardManifest.spec`, `TurmoilCardsUnderRedux.spec`, `premiumScope.spec`, `cardInformation`, `cardLore` (через `reimplements`), `CardMetadata`,
   `requirementProse` (SCIENTISTS), `premiumCardViewModel` (плита партии), `armedPlayEffectCoverage`, `crossPlayerCoverageGuard` (атака растениями — семейство
   уже доказано: классифицировать), `effectForecastCoverage`, `cardArt`/`cardInfoAudit`, `CardRenames.spec` (не нужен — убедиться), `e2eLiveness`.
2. `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. `npm run e2e:affected` (должен назвать стенды атаки/требования партии — прогнать на Steam Machine по 1 повтору).

## 4. Визуальная приёмка (кадры — через юнит-рендер лица или 4б)
`screenshots/aerial/`: лицо замены (арт T01, Учёные в MIN, без ПО) рядом с классикой; чип руки с причиной «0 из 2»; композер атаки с целью. С дивана: «это
та же карта, но по правилам Redux — и я вижу, чем она отличается?»

## 5. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer.
2. Доки: `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` — §3.2 уточнить по факту (номера TR71…TR76, `reimplements` для арта/лора, срез суффикса — список поверхностей),
   §4.1 — Aerial Lenses «СДАНА» (замены: 1 из 7), статус-строка `:3`; `classicReplacements.ts` — комментарий «TR71 — сдана»; `turmoil-redux-card-checklist.md` — §2
   абзац «карта-замена: номер из реестра, арт/лор через `reimplements`»; запись в журнале.

## 6. Режим работы
1. Читать до кода; `SendMessage` соседу; карта + имя + манифест + гард → строка долой (после соседа) → арт/лор → спек + гарды → клиентская проверка →
   доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо с артом; затем список поверхностей, где имя — ключ (проверено / починено), результат гардов, решения 1–5 с тем, что сделано
   по умолчанию, ОДИН `AskUserQuestion` (1, 2, 4 — рекомендация первой), гэпы честно; шаблон для следующих пяти замен — одним абзацем.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Регистрировать под классическим именем; переиспользовать номер TR01…TR70; `normalizeReduxParty` вместо печатных «Учёных»; bespoke там, где всё
  декларативно; дубль RU-имени под `:redux`-ключом; второй файл арта / строка лора при работающем `reimplements`; свой e2e без новой механики (4а);
  полировка; трогать классическую `AerialLenses.ts`.
- Файлы соседа-ed (Pristar) до его коммита; `devGuaranteedCards.ts/.spec`; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте;
  `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
