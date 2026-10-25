# Промт исполнителю · Septem Tribus:redux — КОРПОРАЦИЯ-ЗАМЕНА набора Redux (седьмая и единственная корпорация среди замен; номер — решение 1): 40 M€ (было 36), метка «?» (wild); действие классики УБРАНО; **ПЕРВОЕ ДЕЙСТВИЕ: поставьте 1 свой куб на ЗНАМЯ любой партии**; **ЭФФЕКТ: когда вы ПОБЕЖДАЕТЕ на резолюции, поставьте свой куб на знамя её партии; вы получаете ЭФФЕКТ каждой партии, на знамени которой стоит хотя бы один ваш куб (вдобавок к правящей партии и к «2 делегата на резолюции»)** · **FAQ (владелец, скан правил): куб на знамени даёт ТОЛЬКО ЭФФЕКТ партии, НЕ её «полное благоволение» — требование карт «партия правит или 2 ваших делегата» кубом НЕ выполняется** (то же, что Council Seat) · НОВАЯ МЕХАНИКА с готовым РЕЗЕРВОМ на сервере: `Parliament.grantedEffects` + `grantPartyEffect` / `revokePartyEffect`, дорога доступа `'card'`, `hasEffect` ≠ `satisfiesRequirement` (FAQ p.19 уже запинен в `access()`), анонс «gains the X party effect — granted by Y», RU-ключи «Доступен · выдан источником «X»» — ОДИН куб на знамя (правила не различают 1 и несколько — владелец), все шесть Хартий партий видны всегда → куб рисуется на каждой, ПРЕМИУМ-анимация «куб ложится на знамя» при победе в заседании; текст корпорации — понятный и лаконичный

> **Статус: ВЫДАН 2026-10-25.** HEAD `93cd45fab2` (PARLIAMENT · Хартия партии, сцена доступа, ОДНА РАМА — свежайшая визуальная итерация Парламента: новые
> поверхности строятся НА НЕЙ, не рядом). Дерево чистое; соседей нет (`ListAgents` — перепроверить перед коммитами). **Лор** — EN есть: `assets/text/lore_texts.json:586`
> ключ `R15` («Septem Tribus is a secret society…» — классический номер); **RU в `src/locales/ru/lore_texts.json` НЕТ** → добавить: «Septem Tribus — тайное общество,
> стремящееся управлять развитием Марса. Прикрываясь аналитическими центрами и лобби-группами, они ищут влияния в каждом коридоре власти.» **Арт** —
> `C:\Users\zelin\Downloads\Mars Arts\R15.png` → импортировать как **R15** (классический номер; `node scripts/import-card-art.mjs "<путь>/R15.png" R15` →
> `make:cards`); замена берёт арт и лор через `reimplements: CardName.SEPTUM_TRIBUS` (шаблон TR71/72/75). Скан — `C:\Users\zelin\Downloads\TM Turmoil Redux\
> Corporations\Corporation - Septem Tribus.png`. Реестр: footer «PL-1025», последний раздел CL; **без своего раздела** (полировки нет); дефекты общего слоя —
> строками в раздел текущего footer. **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- septem …`; сцены полёта куба — TIMING: `--exclusive --workers=1`).

Процедура — **`docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2** (`:170–200` — обновлён на TR71/72/75: `:redux`-имя, `cardsToRemove`, строка долой тем же диффом, пин
`replaced`, `reimplements` для арта/лора; **п.6 Septem Tribus — «СНАЧАЛА ИНФРАСТРУКТУРА СКВОЗНЫМ КОНТРАКТОМ, потом карта»**; `:231` строка корпорации),
**чеклист `docs/claude/turmoil-redux-card-checklist.md` §0** («новая механика? — сначала её инфраструктура сквозным контрактом, образец меха `EVA_MECHS.md`
§2–§3»), §1–§3, **§5 политика e2e** (новая механика → один спек), §6; **контракт закона доступа — `docs/TURMOIL_REDUX_COUNCIL_SEAT.md` §2 («ХУК ПОРОГА ДОСТУПА — его
наследует Septem Tribus»; §2.3 «Порог, а не грант (D1)»: грант = состояние «эффект есть независимо от кубов», РЕЗЕРВ под Septem Tribus; плейсхолдер `'Septem
Tribus'` уже стоит в тестах и фикстуре `parliament-dense`)**; коммиты-шаблоны замен `7d284dc2df` (TR71), `7e38fd1c2a` (TR72 — новый режим Парламента: маркер,
шаг, мост, стадия, полёт фигуры), `ea39e1e81d` (TR75). **Контракты консоли:** память **`parliament-visual-iteration-2026-10-25`** (Хартия партии `PremiumPartyFace.vue`
тема `charter` — доска, КРАШЕНЫЙ БАННЕР-вымпел, крест, клаузулы, `__access`; сцена доступа `access` в `consoleParliamentFlow` — `flyAccessSeal` печати партии с
делегата в «ВАШИ ЭФФЕКТЫ»; ОДНА РАМА), `parliament-one-framework-prompt` + `docs/claude/console/parliament-one-framework.md` (К1 источник — ТИП; К2 эффекты
партий — группы эксплорера, мета-строка = чтение доступа по `accessRoadOf`; «ВАШИ ЭФФЕКТЫ» — хост), `parliament-delegate-figure` (фигура / след / «взял →
понёс → поставил» — но КУБ Septem — это КУБ ИГРОКА, не делегат: `PlayerCube`, как на треке Карьеры), `parliament-step-full-stage`, `docs/claude/console/
start-first-action.md` (`:7–40` — первое действие корпорации = финальная УСЛОВНАЯ стадия стартового workspace, `corporationInitialAction`; `:102` барьер
завершения; `:280` «deployment is a sequence»; e2e `console-corp-first-action`, `console-bonus-nested-first-action`), `docs/claude/parliament-glossary.md`
(`:39` эффект партии; **`:146` доступ — «Доступен · партия правит» / «…два ваших делегата…» / «выдан источником «X»»** — `parliament.json:249, :254`), память
`visual-restraint-no-glow` (инвариант 15 — Парламент на нуле ореолов: куб сидит в гнезде материалом, свет только у события-полёта), `composer-preselect-direction`,
`status-line-no-face-restatement`, `resolution-texts-card-dose` (досье — печатный текст в дозировке карт), `ru-card-names-already-exist` (имя — латиницей
`zz_corporation_names.json:153`; `turmoil_corporations.json:20` «"Septem Tribus": ""» — как у других корпораций), инварианты 1–4, 7, 8, 9, 13, 15.

**Образцы — по частям:** **классика** — `turmoil/SeptumTribus.ts` (апстримная опечатка в имени файла/enum `SEPTUM_TRIBUS` — ОСТАВИТЬ; `CorporationCard` +
`IActionCard`, 36 M€, `Tag.WILD`, `cardNumber 'R15'`, действие «2 M€ за партию с ≥1 делегатом» — в замене УБРАНО); **реестр** — `common/cards/turmoilReduxReplacements.ts:77`
(строка корпорации: «36 → 40 M€, Wild tag kept; the M€-per-party action is gone. First action: place 1 player cube on the BANNER of any party. Effect: when you
win on a resolution…»), `:91` (`replacementCardNumber` — «Undefined for the corporation» → решение 1), `turmoilReduxAdaptation.ts:67` (строка SEPTUM_TRIBUS —
последняя в списке замен: после неё список ПУСТ); **резерв гранта** — `parliament/Parliament.ts:90–116` (`PartyAccess`: `granted: ReadonlyArray<string>`,
`hasEffect`, `satisfiesRequirement`), `:159–165` (`grantedEffects: Map<PlayerId, {party, source}[]>`), **`:536–590` (`access()` — закон: `granted` → `hasEffect`;
комментарий «A card-granted effect never satisfies a card REQUIREMENT … (rulebook FAQ p.19 — Septem Tribus and Council Seat «only grant you the effect of the
party. Not its full favor»)»)**, `:690–760` (`announceAccessChanges` после каждого ответа и шага заседания → `announceAccessChange` basis `'card'` — лог «gains
the ${1} party effect — granted by ${2}», `events.recordPartyEffectChanged`), `:770–790` (`hasPartyEffect`, `satisfiesPartyRequirement`, **`grantPartyEffect` —
идемпотентен по (party, source)**, `revokePartyEffect`), `:482` (клон), `SerializedParliament.ts:559–564` (сейв), `Parliament.ts:659–665` (дорога `'card'`),
`common/events/EventImpact.ts:40, :215` (`PartyEffectBasis 'card'`, `partyEffect {source}`), `tests/parliament/PartyEffectAccessAnnounce.spec.ts` (PL-112 — все
дороги), `CouncilSeat.ts:63` («`grantPartyEffect`, the Septem Tribus reserve — lives apart from the cubes»); **модель** — `common/models/ParliamentModel.ts:98–129`
(`PartyAccessModel.granted` — «Card-granted access (a future Septem Tribus) — effect only, never the requirement»), `:238` (`access` — ЧЕЙ: проверить, что
доступ КАЖДОГО места публичен; если только зрителя — кубы на знамёнах нужны отдельным публичным полем), клиент `console/parliament/consoleParliamentModel.ts:406–420`
(`accessRoadOf` → `'card'`); **заседание** — `parliament/ParliamentPhase.ts:296, :351–380` (`stepWinner` — вердикт, `summary.winner {instance, player}`),
`:236–262` (`winnerSteps` — шаги победителя из определения резолюции; ключи идемпотентности `effect:<gen>:<instance>:<player>:<key>`), `ICard.ts:314–324`
(`onDelegatesDiscarded` — хук заседания, образец «вызывается ОДИН раз внутри `events.withEffect(player, card, …)` под ключом шага»), **`:341–350`
(`onRulingPartyChanged` — хук ENACT, тот же образец; первый держатель TR62)**; **клиент заседания** — `console/parliament/sittingDirector.ts:1–60` (биты
ПОДСЧЁТ → ПРИНЯТИЕ (три бита: старый закон уходит, **победитель FLIP-ом в правительство**, делегаты домой, плашка правителя) → НАГРАДА → ОБНОВЛЕНИЕ; холды
`parliament-sitting:<stage>/<beat>`), `sittingBeats.ts:34–40`; **Хартия** — `premiumCard/PremiumPartyFace.vue` (`.pcard-charter__banner` — вымпел; `__crest`, `__access`
`data-charter-access`, `__seat`, `__stamp`, `__crown`), `styles/console_party_face.less:57+` (баннер: «dyed cloth, cut as a pennant, hemmed in gold»),
`parliament/ConsolePartyPlaque.vue:19–23, :89–128` (места делегатов — кубы ЗРИТЕЛЯ; «a PLAYER's colour appears only as a cube»), `ConsoleParliamentParties.vue:237–250`
(сцена доступа), `ConsoleParliamentEffects.vue:126–143` («ВАШИ ЭФФЕКТЫ», `accessWon`), e2e `console-parliament-access-scene.spec.ts:1–20` (① посадка → ② слой
отпускает → ③ ПЕЧАТЬ партии летит с делегата в место → ④ «Эффект партии получен» → ⑤ поток уходит сам; лента молчит — зал сказал), `console-council-seat`,
`console-tharsis-alliance`; **первое действие** — `corporation/CorporationCard.ts` / `ICorporationCard.ts` (`initialAction`), `start-first-action.md`, e2e
`console-corp-first-action.spec.ts`; **промпт выбора партии** — `inputs/SelectParty.ts` (маркеры `votePrompt` / `supportPrompt` / TR72 `delegatePrompt` —
`PlayerInputModel.ts:498–580`), `parliament/DiscardPopularSupport.ts` (TR12: `previewSelectParty`, `SupportPromptMeta.areas` — проекция сервера), клиент
`ConsoleParliamentSupportMode.vue` + `supportPickModel.ts` (кольцо по шести плашкам, плашки не двигаются); **лицо** — `premiumCardIcons.ts` (`voteWinner` /
звезда победителя — грепнуть, как печатают «когда вы побеждаете в голосовании» карты набора: `grep -rn "voteWinner()" src/server/cards/turmoilRedux`), `PlayerCube`;
**гарды** — `TurmoilReduxCardManifest.spec` (номер > 70 = своя строка реестра — корпорация: расширить), `TurmoilCardsUnderRedux.spec` (`replaced` + «список пуст»),
`premiumScope.spec`, `devGuaranteedCards.spec`, `cardInformation`, `cardLore` (`reimplements` → R15), `CardMetadata`, `corpFirstActionPreview.spec`,
`PartyEffectAccessAnnounce.spec`, `parliamentAccessRoadGuard`, `parliamentGlossary.spec`, `glowRestraintGuard` (Парламент = 0), `oneFrameworkGuard.spec`,
`crossPlayerCoverageGuard` («none» — платит только себе; чужие видят куб — это не мутация их состояния), `i18n.spec`, `deckComposition.spec`.

---

## Диагноз (подтверждён файл:строка на `93cd45fab2`; перепроверить на своём HEAD)
1. **Сервер держит резерв, карты ещё нет.** `grantedEffects` + `grantPartyEffect` (идемпотентен по `(party, source)`) + дорога `'card'` в `access()` + FAQ p.19
   (`satisfiesRequirement` без `granted`) + анонс `'card'` + сейв + клон + модель `granted` — всё авторизовано под будущий Septem Tribus (D1 Council Seat). Значит
   **КУБ НА ЗНАМЕНИ = ГРАНТ `{party, source: 'Septem Tribus'}`** — отдельного состояния «кубы» НЕ заводить: «хотя бы один куб» и идемпотентный грант — одно и то же
   (владелец: показывать ОДИН куб — правила не различают 1 и несколько). Никто пока не зовёт `grantPartyEffect` в продакшене (`grep` — только тесты/фикстура).
2. **Нет хука «я победил на резолюции».** `stepWinner` (`ParliamentPhase:351`) кладёт `summary.winner`; шаги победителя — из определения резолюции (`winnerSteps`),
   карт-хуков для ПОБЕДИТЕЛЯ нет. Нужен co-located хук `ICard.onResolutionWon?(player, context {instance, resolution, party})` по образцу `onRulingPartyChanged`:
   заседание зовёт ОДИН раз победителю (не нейтральному, не боту — бот вне аспекта `party-effects`), внутри `events.withEffect(player, card, 'resolution-won')`,
   под ключом идемпотентности шага (перезагрузка посреди заседания не зовёт дважды). Где именно: на шаге ПОБЕДИТЕЛЯ (до Повестки) — куб ложится ДО того, как
   победитель двинется по Карьере, и `announceAccessChanges` после шага расскажет «granted by Septem Tribus» (если партия не стала правящей — тогда анонс
   молчит: правление говорит заседание; куб всё равно лёг — он заговорит, когда партия перестанет править).
3. **Первое действие — выбор партии.** `initialAction` → `SelectParty` с НОВЫМ маркером `bannerPrompt: {source: 'septem-first', parties: [{party, hasCube}]}`
   (структурно, не по тексту) → `grantPartyEffect`. Стартовый workspace серверует `corporationInitialAction` как свою условную стадию; для Septem стадия =
   Парламент (полная сцена) с кольцом по шести Хартиям (кольцо `supportPickModel` TR12 — чистая модель, плашки не двигаются), CTA «Поставить куб», затем полёт куба
   и сцена доступа, возврат в стартовый workspace (READY). Прецедент стадии-экскурсии — первое действие Tharsis Republic (город на поле, барьер завершения
   `start-first-action.md:102`).
4. **Знамя на Хартии.** `PremiumPartyFace` (сдано сегодня) — вымпел `.pcard-charter__banner`: единственное место, где «знамя партии» уже НАРИСОВАНО. Гнездо куба
   — на вымпеле (материал: врезное гнездо-хэйрлайн, пустое — ничего, занятое — `PlayerCube` цвета игрока; несколько игроков — ряд гнёзд по порядку мест).
   Хартии всех шести партий видны (правитель + оппозиция) — куб виден всегда; «Информация › Парламент» и досье партии — та же Хартия. Инвариант 15: ни
   ореола, ни свечения — куб сидит материалом.
5. **Чтение доступа уже знает дорогу `card`.** `accessRoadOf` → `'card'`, RU «Доступен · выдан источником «Septem Tribus»» (`parliament.json:254`), «Эффект ваш ·
   выдан картой» (`:249`). Для Septem точнее: **«Доступен · ваш куб на знамени»** (новый ключ, дорога `card` с `source === 'Septem Tribus'` → своя фраза; Council Seat
   — порог, не грант — не задет). Мета-строка эксплорера, Хартия `__access`, хинт чипа руки у карты с требованием партии («куб на знамени даёт эффект, не
   требование» — FAQ) — ОДИН глоссарный оборот.
6. **Текст корпорации (владелец: понятный, лаконичный, без перегруза).** Скан: три предложения + скобка. RU (решение 2): «Вы начинаете с 40 M€. Первое действие:
   поставьте свой куб на знамя любой партии.» / «Эффект: когда вы побеждаете на резолюции, поставьте свой куб на знамя её партии. Вы получаете эффект каждой
   партии, на знамени которой стоит ваш куб — вдобавок к правящей партии и к партиям, где у вас 2 делегата.» Инфо-модель — две `effect-short`: «Win a resolution:
   your cube on its party's banner» · «A cube on a banner: that party's effect (not the card requirement)». Досье — печатный текст (память `resolution-texts-card-dose`).
7. **Что ещё меняется на шаблоне замены:** `CardName.SEPTEM_TRIBUS_REDUX = 'Septem Tribus:redux'` (имя — ПЕЧАТНОЕ «Septem», enum классики — «SEPTUM» — не чинить
   апстрим), манифест `corporationCards` (сегодня в Redux-манифесте корпораций НЕТ — первая; проверить, что `cardsToRemove` работает для КОРПОРАЦИИ в
   `GameCards`/пикере корпораций — классический Septum не должен появляться в стартовом выборе под Redux), `cardsToRemove` += `SEPTUM_TRIBUS`, строка долой
   (список замен ПУСТ — гард/принтер на пустом списке), реестр AUTHORED, скоуп/пикер, RU (имя латиницей; описания — свои ключи), лор RU, арт R15.
8. **Уход корпорации.** Кубы физичны и никогда не снимаются (на скане снятия нет). Но эффект «вы получаете эффект партий с вашим кубом» — эффект КОРПОРАЦИИ:
   без неё (Merger-замена, `onDiscard`) гранты источника `'Septem Tribus'` — отозвать (`revokePartyEffect`) — решение 4.
9. **MarsBot.** Бот-двойника нет (`MarsBotCorpData` — пусто) — бот не играет; коллизии нет. Бот-победитель заседания — кубов не ставит (не участвует в
   `party-effects`); бот-зритель кубов человека — ничего.

## Правила карты (спек `tests/cards/turmoilRedux/SeptemTribusRedux.spec.ts` пинит каждое — структура TR71/TR72)
1. Печатная: корпорация, 40 M€, метка wild, без действия, ПЕРВОЕ ДЕЙСТВИЕ, эффект; номер — решение 1; `reimplements: SEPTUM_TRIBUS`; имя `'Septem Tribus:redux'`;
   арт/лор — R15.
2. Первое действие: `SelectParty` с `bannerPrompt` по шести партиям (все доступны; с кубом — недоступна «куб уже стоит» — на старте таких нет); ответ →
   `grantPartyEffect(p, party, 'Septem Tribus')` → `access(p, party).granted ∋ 'Septem Tribus'`, `hasEffect` true, `satisfiesRequirement` false (если партия не правит и
   делегатов < 2); журнал «ставит куб на знамя X» + анонс «gains the X party effect — granted by Septem Tribus» (basis `card`, source); обязательное (нельзя
   пропустить), ровно один раз.
3. Победа на резолюции: хук `onResolutionWon` зовётся победителю (игроку, не нейтральному/боту) один раз за заседание под ключом; → грант на партию
   резолюции; повторная победа на той же партии — грант идемпотентен (ОДИН куб); модель показывает куб всем местам; партия стала правящей → эффект и так есть
   (анонс молчит), куб лёг; следующее поколение другая партия правит → эффект остаётся по кубу (анонс «granted by» при переходе дороги? — нет: «дорога
   сменилась под стоящим эффектом — не новость», `announceAccessChanges`:718 — пин).
4. FAQ: карта с требованием «партия X правит / 2 делегата» при одном лишь кубе на X — НЕ играется, причина — именованная (T04-класс) + хинт «куб даёт эффект,
   не требование»; эффект X (пассив — напр. скидка, шаг) — работает (пин на двух реальных партиях набора); доступ по альянсу TR62 через куб — НЕТ (куб — не
   печатная дорога: `allied` считается от `printedStanding`; пин).
5. Уход корпорации (решение 4): гранты источника снимаются, кубы с Хартий исчезают; save / load — `grantedEffects` ✓ (пин round-trip с источником); классический стол
   — классический Septum байт-в-байт, замена не раздаётся; Redux — замена в выборе корпораций, классика — нет.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; батч — §8)
1. **Номер корпорации** — (а, рекомендовано) **TR77** — реестр: `replacementCardNumber` для строки `kind: 'corporation'` → первый номер ПОСЛЕ шести проектных
   (71–76 → 77); гард манифеста: номер > 70 = своя строка реестра (корпорация — через `corporationCards`); (б) отдельная схема (`TRC1`) — ломает «один префикс».
2. **Текст** — RU описания и эффекта — диагноз 6 (одно предложение на действие, одно на эффект, одна скобка); инфо-модель — две `effect-short`.
3. **Один куб на знамя** (владелец) — куб = грант; на Хартии — одно гнездо на игрока (ряд гнёзд по порядку мест, пустые не рисуются); никаких счётчиков «×2».
4. **Уход корпорации** — (а, рекомендовано) `onDiscard` → `revokePartyEffect` всех грантов источника `'Septem Tribus'` (кубы исчезают с Хартий, анонс «the grant is
   gone»); (б) кубы остаются мёртвыми — нет (ложь на столе).
5. **Чтение доступа** — (а, рекомендовано) дорога `card` с источником Septem — фраза «Доступен · ваш куб на знамени» (эксплорер, Хартия, досье); хинт чипа руки
   у карты с требованием партии, когда у игрока есть куб на этой партии и требование не выполнено: «Куб на знамени даёт эффект партии, не её благоволение —
   требование карты: партия правит или 2 ваших делегата» (FAQ, одна фраза); (б) общее «выдан источником «Septem Tribus»».
6. **Первое действие — сцена** — (а, рекомендовано) стадия стартового workspace «СТАРТ ПАРТИИ › SEPTEM TRIBUS › ПЕРВОЕ ДЕЙСТВИЕ» хостит Парламент (полная сцена,
   карта уходит, L3 — источник): кольцо по шести Хартиям, под курсором — Хартия с ПРИЗРАКОМ куба в гнезде (пунктирный контур + бледный куб — грамматика
   «уходящих»/«прибывающих» мест TR12, без свечения), панель чтения: «Знамя: X · Вы получите эффект партии X» + печатный пассив партии (из эксплорера, К2) +
   строка FAQ; A → ОДИН POST; полёт: куб игрока «взял → понёс → поставил» ОТ ЧИПА МЕСТА игрока (его цвет — его место) в гнездо вымпела, гнездо принимает
   материалом (хэйрлайн замыкается), затем существующая сцена доступа ③–④ (печать партии в «ВАШИ ЭФФЕКТЫ», «Эффект партии получен») → возврат в старт (READY);
   (б) модалка выбора партии без Парламента — нет (закон «workspace — один поток»).
7. **Победа в заседании — бит «КУБ НА ЗНАМЯ»** — (а, рекомендовано) в стадии ПРИНЯТИЕ после FLIP-а победителя в правительство и ДО «делегаты домой»: куб
   игрока отделяется от его маркера-победителя на резолюции (или от чипа места, если маркера нет — один закон источника на обе сцены) и ложится в гнездо
   вымпела Хартии правителя (она на сцене — это правительство); один полёт, ≈ 600–800 мс, `power2.out`, без вспышки; если куб уже стоит — бит пропускается
   (ничего не мигает); сцена доступа НЕ играет (партия правит — эффект и так есть; анонса нет); лента заседания — одна строка «куб на знамя X» в протоколе; бит
   под своим холдом `parliament-sitting:enact/banner`; (б) куб появляется без полёта — нет (физическая причинность).
8. **Чужой зритель** — кубы соперников видны на Хартиях всем (публичный факт стола); их доступ по кубу — в досье партии строкой «эффект есть у: X (куб)» —
   только если такая строка уже существует для других дорог (не добавлять новую зону).
9. **e2e** — `tests/e2e/console-septem-tribus.spec.ts` (НОВАЯ механика — обязателен; tv4k + fhd; TIMING-сцены — эксклюзив): (а) старт: пик Septem (лицо с артом R15,
   40 M€, «?»-метка, «Первое действие»), прелюдии → стадия ПЕРВОЕ ДЕЙСТВИЕ = Парламент: кольцо по Хартиям, призрак куба, панель; B — назад к сводке? (первое
   действие обязательно — B только меняет выбор); A — один POST; полёт куба с чипа места в гнездо; сцена доступа; READY; (б) после старта: Хартия X с кубом
   (своя и в «Информации»), «ВАШИ ЭФФЕКТЫ» — X с «Доступен · ваш куб на знамени», чип руки карты с требованием X — недоступна с причиной + хинт FAQ;
   (в) заседание (`septem-win`: p1 Septem, p1 лидирует на резолюции партии Y, Y не правит): пас → заседание: ПОДСЧЁТ → ПРИНЯТИЕ: FLIP победителя → **куб с
   маркера в гнездо вымпела Y** → делегаты домой → НАГРАДА → ОБНОВЛЕНИЕ; протокол — строка; сервер: грант Y; (г) следующее поколение, правит Z: Хартия Y в
   оппозиции с кубом, эффект Y у p1 по кубу («выдан»/«куб на знамени»), требование Y — нет; (д) `septem-bot-win`: бот побеждает — кубов нет; (е) reload — кубы на
   месте; (ж) reduced motion — куб без полёта, те же числа; (з) `glowRestraintGuard` — ноль. Фикстуры: `septem-tribus-start` (старт с Septem среди корпораций на
   выбор; `keepInitialCardSelection`-класс), `septem-tribus` (на столе, куб на X), `septem-win` (`stopAt: 'assembly'`-класс, p1 лидер на Y), `septem-bot-win`.
10. **Объём** — сервер (инфраструктура: хук победителя, маркер, грант как куб) ≈ 35 %, карта + лицо + тексты ≈ 15 %, консоль (гнездо на Хартии, стадия первого
    действия, бит заседания, чтение доступа, хинт FAQ) ≈ 40 %, стенд/доки ≈ 10 %; без полировки; дефекты общего слоя — строками в реестр текущего footer.

## 0. Рабочее дерево
1. `git log --oneline -1` → `93cd45fab2` на выдаче; `ListAgents` перед каждой серией коммитов. Твои файлы — `turmoilRedux/SeptemTribusRedux.ts` + спек, `CardName.ts`,
   манифест (`corporationCards` + `cardsToRemove`), `turmoilReduxReplacements.ts` (номер корпорации + AUTHORED), `turmoilReduxAdaptation.ts` (строка долой), `ICard.ts`
   (хук), `ParliamentPhase.ts` (вызов хука на шаге победителя), `inputs/SelectParty.ts` + `PlayerInputModel.ts` (маркер `bannerPrompt`), новый `parliament/PlaceBannerCube.ts`
   (шаг первого действия + превью), `ParliamentModel.ts` (публичность грантов/кубов), клиент: `PremiumPartyFace.vue` + `console_party_face.less` (гнездо), стадия
   первого действия (`startFirstAction.ts`, `ConsoleStartScene.vue` — хост Парламента), `consoleParliamentFlow.ts` (режим `banner`), `sittingBeats.ts` /
   `sittingDirector.ts` (бит), `consoleParliamentModel.ts` (фраза дороги), `unplayableReasonFormat.ts` (хинт FAQ), `ru/{parliament,turmoil_redux_cards,
   turmoil_corporations,card_info,lore_texts}.json`, e2e + фикстуры, доки, `assets/card-images/R15.webp`. Коммиты — ПО ХАНКАМ / явными путями; после коммита — `git
   reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e — только Steam Machine:** `npm run build` → `npm run e2e:snapshot septem` → `npm run e2e:remote -- septem <spec> --exclusive --workers=1`; кадры «до» — клиент
   HEAD; exit 2/3/4 — СТОП и `AskUserQuestion`.

## 1. Сервер — ИНФРАСТРУКТУРА сквозным контрактом, потом карта (≈ 35 % + 15 %)
1. Хук `onResolutionWon` (ICard, co-located; вызов в `stepWinner` под ключом; `events.withEffect`; не нейтральному / боту) + спек `tests/parliament/ResolutionWonHook.spec.ts`
   (один раз, идемпотентно, перезагрузка, бот, нейтральный).
2. Маркер `bannerPrompt` + шаг `PlaceBannerCube` (`previewSelectParty()` = исполнение; проекция по партиям: `hasCube`, печатный пассив — ссылкой на источник
   К1, `willHaveEffect`), `choiceContext {source: card, mode: 'effect-choice'}`.
3. Модель: кубы/гранты КАЖДОГО места публичны (проверить `:238`; иначе — `banners: ReadonlyArray<{party, color}>` в модели Парламента из `grantedEffects` с
   источником-корпорацией).
4. Карта: `SeptemTribusRedux.ts` (заголовок SCAN READING / RULE READINGS; `initialAction` → шаг; `onResolutionWon` → `grantPartyEffect`; `onDiscard` → revoke;
   `infoText`; лицо: `megacredits(40)`, метка wild, коробка первого действия «[куб][?]*», коробка эффекта «[★] : [куб][?]* · [куб][?] EFFECT» — значки набора:
   звезда победителя (`voteWinner` / как печатают TR-карты «when you win a vote» — грепнуть), куб игрока, wild-партия «?»), спек (правила 1–5), манифест
   `corporationCards` + `cardsToRemove` (+ проверка пикера корпораций под Redux), реестр (номер + AUTHORED), строка долой (список ПУСТ), пины, RU, лор RU, арт R15.

## 2. Консоль (≈ 40 %)
1. **Хартия** — гнёзда на вымпеле (`PremiumPartyFace` + less): по одному на игрока с кубом, `PlayerCube` цвета места; `data-charter-banner-cube="<color>"`; на
   всех поверхностях Хартии (Парламент, Информация, досье, эксплорер-детали); без ореола (гард = 0).
2. **Первое действие** — стадия стартового workspace хостит Парламент в режиме `banner` (кольцо `supportPickModel`-класса по шести Хартиям, призрак куба под
   курсором, панель чтения, CTA «Поставить куб»; полоса «Поставить куб · Осмотреть · Источник»); A → POST → полёт куба с чипа места в гнездо (холд) → сцена
   доступа → возврат; барьер завершения `start-first-action.md:102`; перезагрузка посреди — честно (ledger сервера).
3. **Заседание** — бит `banner` в ПРИНЯТИИ (решение 7): источник — маркер-победитель / чип; цель — гнездо вымпела Хартии правителя; «уже стоит» — пропуск без
   мигания; протокол — строка.
4. **Чтение** — `accessRoadOf` + фраза для источника-корпорации (решение 5); хинт FAQ на чипе руки (`unplayableReasonFormat`); эксплорер «ВАШИ ЭФФЕКТЫ» — мета-строка.
Спеки: `PremiumPartyFace.spec` (гнездо/кубы), `supportPickModel.spec` § banner, `consoleParliamentFlow.spec` § banner, `sittingBeats.spec` (бит и пропуск),
`consoleParliamentModel.spec` (фраза), `unplayableReasonFormat.spec` (хинт), `parliamentGlossary.spec` («знамя», «куб на знамени»), `glowRestraintGuard`,
`oneFrameworkGuard`, `cursorGrammarGuard`, `console-parliament-stability` (кольцо двигает только курсор).

## 3. Тесты и регрессия (≈ 10 %)
Стенд решения 9; гарды §1; регрессия: `console-corp-first-action`, `console-bonus-nested-first-action`, `start-scene-profiles`, `console-parliament-access-scene`,
`console-council-seat`, `console-tharsis-alliance`, `console-party-sanctions`, `console-banned-delegate`, `console-parliament-vote-*`, `tv-profile-screens` — по 1–2
повтора; `npm run e2e:affected`; хуки — тем же диффом (инвариант 14).

## 4. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd)
`screenshots/septem/{tv,fhd}/`: лицо корпорации с артом; стадия первого действия (кольцо, призрак куба, панель); полёт куба в гнездо; Хартия с кубом;
«ВАШИ ЭФФЕКТЫ» с «куб на знамени»; чип руки с FAQ-хинтом; заседание: FLIP → куб на знамя → делегаты домой; оппозиционная Хартия с кубом в следующем
поколении; кубы двух игроков на одной Хартии. С дивана: «я вижу, где мои кубы, что они дают и чего НЕ дают — и момент, когда куб лёг, был красивым и тихим?»

## 5. Доки и реестр
1. Реестра своего нет; дефекты общего слоя — строками в раздел текущего footer.
2. Доки: новый `docs/TURMOIL_REDUX_SEPTEM_TRIBUS.md` (куб = грант; хук победителя; маркер `bannerPrompt`; гнездо Хартии; две сцены; FAQ; что наследует следующая
   карта-грант); `TURMOIL_REDUX_COUNCIL_SEAT.md` §2.3 — «резерв занят: Septem Tribus»; `parliament-glossary.md` — «знамя партии», «куб на знамени» (дорога
   доступа — фраза), стадия «ПЕРВОЕ ДЕЙСТВИЕ» в Парламенте; `parliament-one-framework.md` — мета-строка дороги `card` с источником; `start-first-action.md` —
   «стадия-Парламент»; `TURMOIL_REDUX_CLASSIC_CARDS.md` §4.1 — Septem Tribus «СДАНА» (замены 4 из 7; список `AWAITING` пуст — §2.3 «конец костыля»: что
   можно удалить), §3.2 — номер корпорации; чеклист — абзац «корпорация-замена с первым действием в Парламенте»; запись в журнале.

## 6. Режим работы
1. Читать до кода; §1.1–1.3 инфраструктура (спеки) → §1.4 карта → §2.1 гнездо (макет на живой Хартии 4K: один куб / два игрока / призрак — батч вместе с
   решениями 5–7) → §2.2 стадия → §2.3 бит → §2.4 чтение → стенд → регрессия → раскадровки → доки. Коммит по ханкам на каждом шаге.
2. Отчёт: первой строкой — лицо с артом; затем кадры (стадия, полёт, Хартия с кубом, заседание), результат гардов/регрессии, решения 1–10 с тем, что сделано по
   умолчанию, ОДИН `AskUserQuestion` (6 и 7 с кадрами, 5, 4, 1 — рекомендация первой), гэпы честно.
3. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 7. Нельзя
- Отдельное состояние «кубы» рядом с грантами; счётчик кубов; грант, выполняющий ТРЕБОВАНИЕ (FAQ); куб как дорога альянса TR62; хук победителя мимо
  `events.withEffect` / без ключа идемпотентности; куб боту / нейтральному; модалка выбора партии вне Парламента; второй экземпляр Парламента; auto-select
  партии; ореол/свечение/дыхание на гнезде, кубе или Хартии (инвариант 15); появление куба без полёта; `title`; литерал кнопки; текст ниже пола TV;
  «SEPTUM» в печатном имени замены / чинить апстримный enum классики; свой арт/лор при `reimplements`; описание длиннее скана (владелец: лаконично).
- RU чужих ключей (`parliament.json:249/254` — новая фраза, не правка); `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` /
  `TM_E2E_BESIDE_GAME`; `--workers=4`.
