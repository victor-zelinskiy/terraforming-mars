# Промт исполнителю · Sponsored Mohole:redux («Грант на скважину») — ТРЕТЬЯ карта-замена набора Redux (**TR75** — номер по реестру, не по очереди сдачи; шаблон — TR71 `7d284dc2df`, самая простая из семи): зелёная, 5, Здание; требует **«Зелёных»** у власти или 2 ваших делегата на их резолюции (напечатано — то же, что даёт общее правило Кельвинисты → Зелёные); «+2 пр. тепла»; **+1 ПО** (у классики не было) — НИ ОДНОЙ новой механики: требование партии (TR15-класс), производство (Executor), ПО (`victoryPoints: 1`); вся работа — механизм замены по шаблону + арт/лор через `reimplements`; своего e2e НЕТ (§5 чеклиста); без полировки

> **Статус: ВЫДАН 2026-10-24.** HEAD `06336566bc` (TR72 Banned Delegate сдана кодом `7e38fd1c2a`; её ДОКИ ещё не закоммичены — в дереве чужие
> `docs/TURMOIL_REDUX_BANNED_DELEGATE.md`, `TURMOIL_REDUX_CLASSIC_CARDS.md`, `TURMOIL_REDUX_PARTY_SANCTIONS.md`, `parliament-glossary.md`, чеклист, журнал,
> `App.vue` — сосед `terraforming-mars-df` (idle): `ListAgents` + `SendMessage` до первого коммита; классический док и журнал правишь ПОСЛЕ его коммита).
> **Лор владельца** — строка `"T13": "Getting the World Government as a partner."` НЕЗАКОММИЧЕНА последней в `assets/text/lore_texts.json`: коммитить ПЕРВЫМ
> ханком, только её (+ RU «Мировое правительство в партнёрах.» в `src/locales/ru/lore_texts.json` тем же ханком). **Арт** — `C:\Users\zelin\Downloads\Mars Arts\T13.png`
> → импортировать как **T13** (`node scripts/import-card-art.mjs "<путь>/T13.png" T13` → `make:cards`). Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\
> Replacement - Sponsored Mohole.png` («TR00» — заглушка; `replacementCardNumber(SPONSORED_MOHOLE)` = **TR75**). Реестр: footer «PL-1020», последний раздел CL;
> **без своего раздела**; дефекты общего слоя — строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine** (только `npm run e2e:affected`, если назовёт).

Процедура — **`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2 (`:170–200`, ОБНОВЛЁН на TR71/TR72)**: п.1 имя `CardName.SPONSORED_MOHOLE_REDUX = 'Sponsored Mohole:redux'`
(`translateText` / `translateCardName` сами откатывают `Name:variant` — ключ-дубль НЕ заводить, пин `i18n.spec`; журнал / счёт / поповер режут `split(':')[0]`);
п.2 манифест + `cardsToRemove`; п.3 тем же диффом — строка долой из `TURMOIL_CARDS_AWAITING_REDUX_REPLACEMENT` + пин `replaced` в `TurmoilCardsUnderRedux.spec`
(счётные пины читают `cardsToRemove`: `PoliticalThinkTank.spec`, `deckComposition.spec`); **п.4 номер = `replacementCardNumber` = TR75**, арт/лор — классической
карты через `metadata.reimplements: CardName.SPONSORED_MOHOLE` (арт под T13, лор ключ T13; своих `TR75.webp` / ключа `TR75` НЕ заводить); п.5 reserved-гард; п.5а
скоуп и пикер (заменённая классика — вне, замена — в). **TR71 как шаблон** (`turmoilRedux/AerialLensesRedux.ts` — заголовок SCAN READING / RULE READINGS;
`tests/cards/turmoilRedux/AerialLensesRedux.spec.ts:71–260` — структура «rule N»: печатная карта → дороги требования (в т.ч. «чужая партия — не дорога», FAQ p.19,
TR70-вейвер) → эффекты → раздача под обоими столами → скоуп → save/load; коммит `7d284dc2df` — 25 файлов). **Чеклист** `docs/claude/turmoil-redux-card-checklist.md`
(§2 арт/лор/RU/`card_info`, §3 гарды-ворклист, **§5 — «ни одного e2e на «просто ещё одну карту»»**, абзац «карта-замена»). **Контракты:** промт T04 (требование
партии под Redux — дороги), `cardVictoryPointsAtPlay` / `victoryPointsModel` (ПО карты — финал, досье, «Информация»), `ru-card-names-already-exist`,
`card-lore-archive-entry`, инварианты 8, 9, 11.

**Образцы — по частям:** **классика** — `turmoil/SponsoredMohole.ts` (`AUTOMATED`, 5, `Tag.BUILDING`, `production {heat: 2}`, `requirements: {party: KELVINISTS}`,
`cardNumber 'T13'`, `b.production((pb) => pb.heat(2))`, без ПО), спек `tests/cards/turmoil/SponsoredMohole.spec.ts` (один `it`); **реестр** —
`common/cards/turmoilReduxReplacements.ts:67` (строка «party Kelvinists → GREENS (printed, what the general rule gives anyway); still cost 5, Building tag, +2 heat
production; gains 1 VP»; `:49`, `:54` — отметки «AUTHORED» TR71/TR72 — поставить ТАКУЮ ЖЕ), `replacementCardNumber`; `common/parliament/ParliamentTypes.ts:34`
(`normalizeReduxParty`: KELVINISTS → GREENS — здесь совпадает с печатью: писать `PartyName.GREENS` ПРЯМО, спек пинит «Зелёные правят → можно»); **RU** —
`turmoil_cards.json:41` «Грант на скважину» (fallback по срезанному имени ✓), `turmoil_redux_cards.json:118` — ключ-сосед «…Greens… Increase your heat production
**3** steps.» (ДРУГАЯ карта; у замены «2 steps» — свой новый ключ, перевод — тем же голосом: «Требует, чтобы «Зелёные» были у власти или у вас было 2 делегата на
их резолюции. Увеличьте производство тепла на 2 шага.»); **арт/лор** — `client/cards/cardArt.ts:72–92` (`artKey` → `reimplements`), `cardLore.ts:100–112`,
`cardLore.spec.ts § reimplements` (+ строка TR75, как TR71/TR72); **гарды** — `TurmoilReduxCardManifest.spec` (номер > 70 = ровно своя строка реестра, `reimplements`
её классики, имя `<X>:redux`, `cardsToRemove`), `TurmoilCardsUnderRedux.spec` (`replaced`), `premiumScope.spec`, `devGuaranteedCards.spec`, `cardInformation`,
`CardMetadata`, `requirementProse`, `premiumCardViewModel` (плита партии Зелёных + ПО-щит), `cardVictoryPointsAtPlay`, `armedPlayEffectCoverage`, `effectForecastCoverage`,
`crossPlayerCoverageGuard` («none»), `i18n.spec`, `deckComposition.spec`.

---

## Диагноз (подтверждён файл:строка на `06336566bc`; перепроверить на своём HEAD)
1. **Карта — чистая декларация, ни одного хука.** Замена = классический `behavior.production {heat: 2}` + `requirements: {party: GREENS}` (печатно) + `cost: 5` +
   `tags: [BUILDING]` + **`victoryPoints: 1`** (новое) + `cardNumber: 'TR75'` + `reimplements: SPONSORED_MOHOLE`. Требование — `PartyRequirement` через фасад (T04-класс:
   именованная причина «0 из 2», `partyOffVote`, FAQ p.19, TR70-вейвер, эмблема Зелёных в плите MIN), производство — Executor, ПО — `victoryPoints` (ПО-щит на лице,
   `cardVictoryPointsAtPlay`, финальный счёт по карте). Превью розыгрыша — из коробки. Новых поверхностей — ноль.
2. **Механизм замены — по шаблону, уже дважды пройденному** (TR71 — 25 файлов, TR72 — + механика). Для TR75 ожидаемый дифф: `CardName`, класс, манифест
   (`projectCards` + `cardsToRemove` + классика), реестр (отметка AUTHORED), `turmoilReduxAdaptation.ts` (строка долой), пин `replaced`, спек карты, `cardLore.spec`
   (+ TR75), `devGuaranteedCards.spec` (если пин перечисляет), RU (`turmoil_redux_cards.json` — описание; `card_info.json` — из `cardInfoAudit`), лор EN/RU, арт T13,
   журнал, классический док §4.1 (3 из 7; порядок сдачи ≠ порядок номеров — отметить).
3. **Единственная тонкость — номер.** Реестр нумерует по ПОРЯДКУ СТРОК: Political Alliance (TR73) и Recruitment (TR74) ещё не сданы, а Sponsored Mohole — TR75.
   Гард манифеста это допускает (номер > 70 = своя строка); сдача «не по порядку» — норма (п.4 §3.2), но в журнале и §4.1 написать явно, чтобы следующий
   исполнитель не «исправил» TR75 → TR73.
4. **ПО на лице и в счёте.** Классика без ПО → у замены `victoryPoints: 1`: ПО-щит `1` (generic `PremiumVpCardGlyph`), финальный счёт категории «карты» +1,
   `victoryPointsModel` / досье / «Информация» — всё generic; пин спеком и гардом `cardVictoryPointsAtPlay` (ПО карты — при подсчёте, не при розыгрыше).
5. **RU.** Имя — существующее «Грант на скважину» (fallback); описание — НОВЫЙ EN-ключ (текст скана: «Requires the Greens to be ruling or that you have 2 delegates
   there. Increase your heat production 2 steps.» — сосед `:118` с «3 steps» — ДРУГАЯ карта, не трогать); лор RU — из статуса; `card_info` — по аудиту.

## Правила карты (спек `tests/cards/turmoilRedux/SponsoredMoholeRedux.spec.ts` пинит каждое — структура TR71 `:71–260`)
1. Печатная: зелёная, 5, Здание, **1 ПО**, плита Зелёных, `TR75`, `reimplements: SPONSORED_MOHOLE`, имя `'Sponsored Mohole:redux'`; лицо — плита производства с
   ДВУМЯ значками тепла (как классика), ПО-щит; арт/лор — T13.
2. Требование — Зелёные: у власти / 2 ваших делегата на их резолюции / резолюции нет на голосовании → дорога закрыта / эффект от карты — не дорога /
   TR70-вейвер; Учёные (или любая другая) у власти — НЕ дорога; причина руки именованная.
3. Розыгрыш → +2 пр. тепла (производство, не запас), ПО 1 — в счёте карт при финале; метка Здание — считается всем, что отвечает на Здание.
4. Раздача: Redux — замена в колоде, классика T13 — нет (`cardsToRemove`); классический стол — классика, замена — нет; скоуп — замена в, классика вне; save /
   load — ничего нового; MarsBot не играет.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте — батч НЕ нужен, если нет расхождений)
1. **Номер TR75** — по реестру, не по очереди (диагноз 3); отметка в журнале и §4.1.
2. **RU описания** — диагноз 5; лор RU — «Мировое правительство в партнёрах.» (или точнее по вкусу — одна фраза).
3. **e2e** — своего нет (§5); `npm run e2e:affected` — прогнать названное на Steam Machine (1 повтор), скорее всего — ничего.
4. **Объём** — ≈ 100 % механизм по шаблону; найденные расхождения шаблона (гард, пин, аудит) — чинить с тестом, строками в реестр текущего footer, и
   записать в §3.2 дока как уточнение.

## 0. Рабочее дерево
1. `git log --oneline -1` → `06336566bc` на выдаче. `ListAgents` + `SendMessage` соседу-df (доки TR72): твои файлы — `turmoilRedux/SponsoredMoholeRedux.ts` + спек,
   `CardName.ts`, манифест, `turmoilReduxAdaptation.ts`, `turmoilReduxReplacements.ts`, `TurmoilCardsUnderRedux.spec.ts`, `cardLore.spec.ts`, `devGuaranteedCards.spec.ts`,
   `ru/{lore_texts,turmoil_redux_cards,card_info}.json`, `assets/card-images/T13.webp` (+thumb, манифест арта), `lore_texts.json` (T13 — первым ханком);
   `TURMOIL_REDUX_CLASSIC_CARDS.md` и журнал — ПОСЛЕ коммита соседа. Коммиты — ПО ХАНКАМ / явными путями (`git commit -- <paths>`); после коммита — `git reset -q
   -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. e2e — только если `e2e:affected` назовёт: `npm run e2e:snapshot mohole` → `npm run e2e:remote -- mohole <spec>`; exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — карта + механизм (≈ 80 %)
Лор T13 (EN + RU) → арт T13 → `SponsoredMoholeRedux.ts` (заголовок в стиле TR71: SCAN READING — цена 5, метка Здание (коричневая крыша), MIN-плита с эмблемой
Зелёных (хвоя), плита производства с двумя значками тепла, ПО-щит «1», «TR00» на скане = TR75, модульный символ без ▲; лор — цитата скана, ключ T13 через
`reimplements`; RULE READINGS 1–4) → `CardName` → манифест + `cardsToRemove` → реестр AUTHORED → строка долой + пин `replaced` → спек → RU → `card_info` →
гарды §3 чеклиста (ворклист — читать красные).

## 2. Клиент (≈ 5 %)
Ожидается ноль правок: проверить лицо (арт T13, Зелёные в MIN, два значка тепла, ПО «1»), чип руки с причиной, «Информация»/лор, журнал (имя без суффикса).

## 3. Тесты (≈ 15 %)
1. Спек карты; `TurmoilReduxCardManifest.spec`, `TurmoilCardsUnderRedux.spec`, `premiumScope.spec`, `devGuaranteedCards.spec`, `cardInformation`, `cardLore`, `CardMetadata`,
   `requirementProse` (GREENS), `premiumCardViewModel`, `cardVictoryPointsAtPlay`, `armedPlayEffectCoverage`, `effectForecastCoverage`, `crossPlayerCoverageGuard`,
   `i18n.spec`, `deckComposition.spec` (70 + 3 замены), `PoliticalThinkTank.spec` (пул карт с требованием партии +1), `e2eLiveness`.
2. `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине; `npm run e2e:affected`.

## 4. Визуальная приёмка
`screenshots/mohole/`: лицо замены (арт T13, Зелёные, ПО 1) рядом с классикой — юнит-рендер лица или кадр из существующего стенда с гарантированной картой
(`GUARANTEED_MODULES`). С дивана: «та же скважина, но Зелёные и очко».

## 5. Доки и реестр
1. Реестра своего нет; расхождения шаблона — строками в раздел текущего footer.
2. Доки (после соседа): `TURMOIL_REDUX_CLASSIC_CARDS.md` §4.1 — Sponsored Mohole «СДАНА» (замены 3 из 7: TR71, TR72, **TR75**; TR73/TR74/TR76 ждут), §3.2 — строка
   «порядок сдачи ≠ порядок номеров — номер всегда `replacementCardNumber`»; реестр — комментарий AUTHORED; запись в журнале (кратко — карта без новой механики).

## 6. Режим работы
1. `SendMessage` соседу; лор → арт → карта → манифест/реестр/строка долой → спек → гарды → клиентская проверка → доки. Коммит по ханкам.
2. Отчёт: первой строкой — лицо с артом; затем результат гардов, решения 1–4 с тем, что сделано по умолчанию, гэпы честно; если шаблон TR71 сработал без
   расхождений — сказать это одной строкой (это и есть результат).
3. Не пушить.

## 7. Нельзя
- Номер TR73 «потому что третья по счёту»; `normalizeReduxParty` вместо печатных Зелёных; свой арт/лор при работающем `reimplements`; ключ-дубль RU-имени;
  свой e2e; полировка; трогать классическую `SponsoredMohole.ts`; менять ключ-сосед `:118`.
- Файлы соседа-df (доки TR72, `App.vue`) до его коммита; RU чужих ключей; `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
