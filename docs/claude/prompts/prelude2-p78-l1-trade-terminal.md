# Промт исполнителю · P78 L1 Trade Terminal («Торговый терминал L1») — ПЯТАЯ карта Prelude 2, первая с ПАССИВНЫМ ЭФФЕКТОМ ТОРГОВЛИ и первая с МУЛЬТИВЫБОРОМ РАЗЫГРАННЫХ карт, «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 1 + 2 — декларативный эффект + bespoke-розыгрыш): синяя (активная), 25 M€, метка Космос, 2 ПО, Колонии; «Эффект: когда вы торгуете, можете сначала продвинуть трек этой колонии на 2 шага» — `behavior.colonies.tradeOffset: 2` (ОДИН план торговли сервера уже читает его: Executor → `player.colonies.tradeOffset`, `Colony.tradeTrackPlan`, атрибуция шагов карте — `recordTradeTrackBonus`; консоль показывает стоячий «+N» и глайд маркера — TR85 Veynon «даром»); «Добавьте по ресурсу на 3 РАЗНЫЕ карты, на которых уже есть ресурсы» — `bespokePlay` с ЛОВУШКОЙ: при ≤ 3 кандидатах (без держателей с отрицательным ПО) ресурсы кладутся МОЛЧА (`cards.length <= 3 → addResources`), иначе `SelectCard` «up to 3» — ровно класс «скрытая цель», который форк запрещает (`docs/DELAYED_TARGET_AUDIT.md` § prelude2 frontier — «the fix is the always-shown SelectCard + pre-collect») · РАБОТА КАРТЫ (≈ 45 %): всегда-показанный `SelectCard` + ко-локированный `cardPlayPreview` с МУЛЬТИШАГОМ по разыгранным картам (каждая цель — `N → N+1` своего ресурса и честное ПО, включая ОТРИЦАТЕЛЬНОЕ у Vermin / Ancient Shipyards), именованный пропуск при пустом столе (`warningNote` + `recordSkippedEffect`), строка в списке носителей сдвига (или вывод из манифеста — решение 4), `description` вместо прозы, честная иконка «?» (ресурс-джокер, не `diverseTag`), лор, арт, RU, строка долой, спек (апстримный `it` «automatically adds … 3 or fewer» — НАМЕРЕННО переписать: форк не применяет молча) · ГЛАВНОЕ (≈ 55 %) — ПРОХОД ОБОИХ ПУТЕЙ НА БОКСЕ (розыгрыш: мультивыбор целей на столе с посевом ВСЕХ, когда кандидатов не больше мест и все — выигрыш; торговля: стоячий «+2» в «Колониях» до нажатия, глайд на два шага до дохода, чек атрибутирует карту) и КЛАСС «КАНДИДАТОВ НЕ БОЛЬШЕ МЕСТ — ПОСЕЯНЫ ВСЕ, ПОКАЗАНЫ, ПОМЕЧЕНЫ» (расширение T14 «единственная цель» на N ≤ max; держатель с отрицательным ПО посев снимает)

> **Статус: ВЫДАН 2026-10-30.** HEAD `06e2fde0ae`. **P80 Red Appeasement ЕЩЁ В РАБОТЕ у соседа** — его незакоммиченные файлы в дереве: `CLAUDE.md`,
> `.claude/rules/{animations,console-ui}.md`, `docs/PRELUDE2_ADAPTATION.md`, `docs/claude/prelude2-cards-progress.md`, `docs/claude/gameplay-polish-ledger.md`,
> `docs/claude/console/state-delivery-and-handoff.md`, `assets/text/lore_texts.json`, `assets/card-images/P80.webp` (+thumb). **Эти файлы НЕ трогать, пока его коммит
> не ушёл** (`ListAgents` + `SendMessage`; доки/журнал/реестр/лор P78 — ПОСЛЕ, своими ханками; раздел реестра **CT** и PL-1131…1137 — его). Ворклист — 4 / 54 по его
> коммиту; твоя запись в журнале — пятая. Промты-образцы серии: `prelude2-p76-…` (форма §0–§9, чек-лист A–M), `prelude2-p85-…` (решения батчем),
> `prelude2-p68-…` / `prelude2-p80-…` (класс в общем слое → раздел реестра); здесь — только то, чем P78 ОТЛИЧАЕТСЯ.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P78.png` (ожидается 1536×1024; иному размеру скрипт ОТКАЗЫВАЕТ — `--force` не ставить, спросить).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Venus Next & Prelude 2 - P78 - L1 Trade Terminal.png`.
> Лор — СО СКАНА, дословно: «Lagrange points are suitable take-off locations to different worlds» (без точки на печати — добавить; гард лора).
> Реестр: после CT (P80) эта задача берёт **CU**, номера — по footer В МОМЕНТ записи на своём HEAD (после коммита соседа).
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p78` → `npm run e2e:remote -- p78 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`).
> **Коммит — сам по окончании, явными путями; сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` (§3.1 п. 1, **п. 2 — bespokePlay: каждая цель ПОКАЗАНА**, п. 7; §4; §5), `docs/claude/prelude2-cards-progress.md`
(P76/P85/P68/P80 «Найдено» и «Что даром» — не переоткрывать), `docs/claude/expansion-adaptation-checklist.md` (**строка «🚫 NO AUTO-SELECT» целиком** — «The trap
is BESPOKE … `if (candidates.length === 1) { apply directly }`» — у P78 порог 3; «Play-card modal preview»; «Effects overlay» — `effect()` узел авто; «Fullscreen rule
text»; gotcha «NO-AUTO-SELECT — there is NO auto-guard … record in `docs/DELAYED_TARGET_AUDIT.md`»), **`docs/DELAYED_TARGET_AUDIT.md:60–80`** (решение форка 2026-07-13 и
2026-08-12: апстримные «skip single-card target» НЕ взяты; «when `prelude2` enters the premium scope, the grep audit will flag … the fix is the always-shown `SelectCard`
+ pre-collect»), `docs/claude/turmoil-redux-card-checklist.md` §0, §3, §4, §7; `docs/TURMOIL_REDUX_VEYNON_DYNAMICS.md` (§ `tradeOffset`: «Консоль ничего не строила:
сцена колонии читает `thisPlayer.colonyTradeOffset`… `[data-colony-track-offset]` ДО нажатия; ADVANCE-глайд маркера до дохода — общий модуль торговли.
Единственная правка класса: `effectSummary.ts` `COLONY_TRADE_OFFSET_CARDS` — жёсткий список носителей»), `docs/claude/console/composer-preselect.md` (T14: ОДНО правило
посадки курсора; единственный кандидат посеян, помечен; угловые случаи — «MULTI-select (диапазон) — не сеется» — ЭТО правило P78 УТОЧНЯЕТ, решение 3),
`docs/claude/console/played-table.md` (стол — это стол; зона цели на столе — P85 PL-1119 `tableTargetZone`), `docs/claude/console/resource-transfer.md` (прилёт
ресурсов на карты стола). **Контракты** — CLAUDE.md § A WORKSPACE IS ONE FLOW, § ACTION COMMIT («награда материализуется ИЗ значков карты» — здесь три жетона
ресурсов летят на ТРИ карты стола), инварианты **3** (no auto-select — «In a COMPOSER a sole enabled candidate is PRE-SELECTED and shown … never applied silently»),
**4** (no silent loss — пропуск при пустом столе ИМЕНОВАН до и после), 2 · 6 · 9 · 14 · 15 · 16; `.claude/rules/game-logic.md` § NO AUTO-SELECT и § No silent loss
(«…and AFTER the commit too — `recordSkippedEffect`»). Память: `table-target-zone` (цель на столе = одна зона, бот рядом), `composer-preselect`, `card-reaction`
(ресурс на карту стола — рождение жетона на карте-получателе), `upstream-spec-encodes-upstream-rules` (⚠ здесь апстримный `it` кодирует ПРАВИЛО, которое форк
отвергает сознательно — переписать с комментарием-ссылкой на аудит, не «байт в байт»), `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`,
`commit-at-end-of-work`, `push-right-after-commit`, `git-commit-explicit-paths-shared-index`, `concurrent-session-edits-same-files`, `shell-template-escapes`.

**Образцы — по частям:** сдвиг торговли — `behavior/Executor.ts:707–708/895–896` (прибавить при розыгрыше, снять при уходе), `colonies/Colony.ts:261–270`
(`tradeTrackPlan`: `max = min(current + offset, top)` — «may» печати = сдвиг всегда в плюс, применяется сам; верх трека срезает честно), `:300–335`
(`recordTradeTrackBonus` — атрибуция шагов и ДОБАВОЧНЫХ единиц дохода КАЖДОЙ карте-носителю, «any future card is covered automatically»), `models/ServerModel.ts:756`
(`colonyTradeOffset` в модели игрока), клиент — `colonies/colonyTradePlan.ts:317–323` (`effectiveTradePosition`), `ConsoleColoniesSection.vue:104/380/412/701`
(`tradeOffset` проп), **`components/effects/effectSummary.ts:280–284, 338`** (`COLONY_TRADE_OFFSET_CARDS` = {Trading Colony, Trade Envoys, Veynon} → `'colonyTrade'`
— ЖЁСТКИЙ СПИСОК: решение 4), стенд — `tests/e2e/console-veynon-dynamics.spec.ts:119` («B — «Колонии»: the colony's stage names the standing «+1» before any press» —
`offsetCaption`, 0 POST; `:150` — дверь карты, ONE POST), `console-colony-trade-receipt.spec.ts` (чек торговли), `console-colony-trade-probe.spec.ts`; носители в
скоупе — `colonies/TradeEnvoys.ts`, `colonies/TradingColony.ts`, `turmoilRedux/VeynonDynamics.ts` (+ спеки `tests/cards/colonies/TradingColony.spec.ts`,
`tests/cards/turmoilRedux/VeynonDynamics.spec.ts` — форма проверки сдвига); мультивыбор РАЗЫГРАННЫХ — `promo/AstraMechanica.ts:100–130` (`cardPlayPreview`: слоты
`selectCardStep` с `dedupeFromSteps` + `mergeCardSteps: {min: 0, title, emptyWarning}` — ОДИН «up to N» вопрос, тот же заголовок, что у живого `SelectCard`),
`common/models/ActionPreviewModel.ts:477` (`mergeCardSteps`), `console/played/consolePlayedTargetModel.ts:457–520` (`{mode: 'multi', min, max, picked}`, `toggle…`
с капом, «may a multi selection be submitted»), `components/console/played/ConsolePlayedTargetStep.vue:58/608–616` (`pickedLine` «N из max», `atCap`),
`ConsolePlayCardConfirm.vue:1835–1848, 2152–2159, 4262–4268, 4534` (ветка с `mergeCardSteps` — один вопрос; `emptyWarning`); мультивыбор РУКИ — `promo/PublicPlans.ts:68–75`
(не твой хост — цели на СТОЛЕ); шаг «ресурс на карту» — `cards/actionPreviews.ts:385–420` (`addToCardStep`: «ALWAYS shows the picker — EVEN for a single candidate»,
`amount` → «N → N+count», **`vpBox: targetVictoryPoints(player, cards, count)`** — честное ПО каждой цели, в т.ч. отрицательное), `deferredActions/AddResourcesToCard.ts:224–240`
(`holders()` — держатели + карты под Self-Replicating Robots + `cardBeingPlayed`); пропуск — `actionPreviews.ts:908/927–945/969–972` (`SKIPPED_LABEL.addToCard`,
`SKIP_REASON.noHolder`, `skippedAddToCard`, `warningNote(…, {skipped})`), `deferredActions/skippedEffect.ts` (`recordSkippedEffect`); предупреждение руки —
`components/card/cardWarnings.ts:40/61` (`noMatchingCards` → «No cards gain the reward of this action.», уровень `noEffect` — текст про ДЕЙСТВИЕ, у P78 это розыгрыш:
решение 5), `common/cards/Warning.ts:20`; иконка — `render/CardRenderer.ts:375` (`wild(amount)` — печатный «?», `premiumCardIcons.ts:252–256/293` `wild.png`), `:383`
(`diverseTag` — ТЕГ-джокер, на скане его нет); посев T14 — `console/consoleActionComposer.ts` (`soleCandidateOf`, `seeded[id] = 'sole'`), `tests/console/preselectStamp.spec.ts`;
фикстуры — `generate.ts` (`parliamentFixture` даёт Colonies; держатели — `cardsFromJSON` + `resourceCount`; колония игрока — `luna.colonies.push(p1.id)` `:3951`; флот /
оплата торговли — рецепты `veynon` `:3390+`); e2e-хелперы торговли — `tests/e2e/cardTradeDoor.ts`.

---

## Диагноз (подтверждён файл:строка на `06e2fde0ae`; перепроверить на своём HEAD)

### Карта
1. **Эффект — даром, розыгрыш — ловушка.** `prelude2/L1TradeTerminal.ts`: `ACTIVE`, 25, `[SPACE]`, `victoryPoints: 2`, `behavior.colonies.tradeOffset: 2`; рендер —
   `effect('When you trade, you may first increase that colony tile track 2 steps.', trade → '+2')` (ко-локированное описание эффекта — инфо-блок даром, эксплорер
   «ЭФФЕКТЫ» — авто) + `text('3').diverseTag().asterix()` + `plainText('(Add a resource to 3 different cards that already have resources.)')`; `description` НЕТ.
   `getEligibleCards` = держатели ресурсов ∪ карты под Self-Replicating Robots с ресурсами (сама карта исключена). `bespokeCanPlay` всегда `true`, при пустом списке —
   `addWarning('noMatchingCards')`. **`bespokePlay`: при `cards.length <= 3` и без Vermin / Ancient Shipyards — `addResources` МОЛЧА** (скрытая цель ×3), иначе
   `SelectCard('Select up to 3 cards to gain 1 resource each', 'Add Resources', cards, {min: 0, max: 3})`. Манифест `:65` — `compatibility: 'colonies'` ✓, политики нет.
2. **Чтение скана (§0):** «25» — цена; плашки требования нет; метка — Космос (звезда); эффект — `[колония] : +2` с подписью; ниже — `3 [жёлтый «?»] *` — ТРИ
   РЕСУРСА-ДЖОКЕРА (печатный «any resource» — `CardRenderItemType.WILD`), звёздочка — к подписи «(Add a resource to 3 different cards that already have resources.)»;
   «P78»; ПО «2»; слева внизу — Prelude 2 («<») и Колонии (▲). Апстримный `diverseTag()` рисует ТЕГ-джокер — не то, что напечатано (решение 2).
3. **Торговля — что уже есть:** сервер прибавляет сдвиг к `player.colonies.tradeOffset`, план торговли (`tradeTrackPlan`) идёт на `min(current + 2, top)` — «may»
   печати не требует вопроса (сдвиг всегда выгоден; верх трека срезает честно); `recordTradeTrackBonus` атрибутирует шаги и добавочный доход КАЖДОЙ карте-носителю
   (несколько носителей — последовательно); консоль: «Колонии» показывает стоячий «+N» до нажатия, ADVANCE-глайд маркера до дохода, чек торговли. **Но** пред-торговая
   заметка эффекта (`effectSummary` → `'colonyTrade'`) читает ЖЁСТКИЙ список `COLONY_TRADE_OFFSET_CARDS` (три карты; TR85 добавил себя строкой) — без строки P78
   заметка о карте молчит. Это fork-only центральная таблица (против инварианта 8) — решение 4.
4. **Мультивыбор разыгранных карт — есть, посев — нет.** Модель цели на столе знает режим `multi` (Astra Mechanica: `mergeCardSteps`, «up to 2», `emptyWarning`),
   зона цели на столе — одна (P85 PL-1119). T14 сеет только ЕДИНСТВЕННОГО кандидата; «MULTI-select (диапазон) — не сеется» — правило contract'а. Для P78 типичный
   случай — 1–3 держателя: по T14 ряд открыт, игрок жмёт A → зона → отмечает все → B → CTA: нажатия ради нуля решений (ровно то, что апстрим «чинил» молчаливым
   применением). Честный ответ форка — посеять ВСЕ, когда кандидатов ≤ мест и каждая цель — выигрыш; держатель с ОТРИЦАТЕЛЬНЫМ ПО (Vermin, Ancient Shipyards —
   `targetVictoryPoints` покажет «−») снимает посев (решение, не нулевое). → решение 3 (класс, CU).
5. **Пустой стол** (нет держателей): апстрим — предупреждение `noMatchingCards` на карте («No cards gain the reward of this action.» — текст про ДЕЙСТВИЕ) и
   молчаливый `return undefined`. Форк: превью — `warningNote(…, {skipped: {label: SKIPPED_LABEL.addToCard, effect: 3 × [?]}})`, живой розыгрыш — `recordSkippedEffect(player,
   SKIP_REASON.noHolder, тот же skipped)` (одна запись «Пропущено» в журнале, уведомление соперникам). Апстримный `addWarning` оставить (плита руки), текст — решение 5.
6. **Что даром:** 2 ПО на лице; чип эффекта на лице и в «ЭФФЕКТАХ»; торговля (п. 3); оплата титаном (Космос); «Сработает» (Космос — реакторы на метку; Olympus Conference
   нет — не Наука); стол с ботом — цели только свои (на карты бота ресурсы не кладут — `getCardsWithResources` игрока); журнал `addResourceTo(…, {log: true})` × 3;
   уход карты со стола (`onDiscard`?) — Executor снимает сдвиг (`:895`). Хуков-реакторов нет → двойника нет.
7. **Spec апстрима:** `it('automatically adds resources if there are 3 or fewer candidates')` и `it('does not automatically add resources for vermin')` кодируют
   апстримное молчаливое применение — форк его ОТВЕРГАЕТ (аудит). Эти два `it` переписать под «всегда спрашивает» с комментарием-ссылкой на `DELAYED_TARGET_AUDIT`;
   остальной апстримный блок — байт в байт.
8. **Локаль.** RU-имя «Торговый терминал L1» — оставить; RU эффекта (`ru/prelude2_cards.json:29`) — «вы можете увеличьте трек» (ошибка), переозвучить; RU розыгрыша
   (`:30`) — годится. Лора `P78` и арта нет.

## Правила карты (спек пинит каждое)
1. Синяя, 25, Космос, 2 ПО, без требования; P78; `compatibility: 'colonies'`. Оплата — M€ + титан.
2. Эффект: после розыгрыша `player.colonies.tradeOffset` +2; торговля с колонией на позиции p идёт с `min(p + 2, top)` (p = 4 → 6; p = 5 → 6 — срез честный);
   доход — за позицию после сдвига; `recordTradeTrackBonus` атрибутирует 2 шага и добавочные единицы P78 (с Trade Envoys на столе — по очереди, у каждой свои);
   сброс карты (если возможен) снимает сдвиг.
3. Розыгрыш: кандидаты = свои держатели ресурсов ∪ карты под SRR с ресурсами, сама карта — нет; ВСЕГДА `SelectCard` (`min: 0`, `max: min(3, N)`), в т.ч. при 1–3
   кандидатах; ответ → +1 ресурс каждой выбранной (`addResourceTo`, лог по карте); 0 выбранных — допустимо (печать «3 разные» — но игрок волен не класть на Vermin;
   `emptyWarning` в превью); нет кандидатов → промпт не строится, `recordSkippedEffect(noHolder, 3 × [?])`, карта разыграна.
4. Превью (`cardPlayPreview`): ОДИН «up to 3» вопрос по форме Astra (`mergeCardSteps` ИЛИ один `selectCardStep` с `max` — выбрать ту форму, что модель `multi` зоны
   стола принимает; заголовок = заголовку живого `SelectCard`), каждая цель — `N → N+1` СВОЕГО ресурса и ПО-бокс (`targetVictoryPoints`, отрицательное — честно);
   при 0 кандидатов — `warningNote` с `skipped`; read-only.
5. Раздача с Colonies + Prelude 2; без Colonies — нет; MarsBot-стол — цели только игрока; save / reload — сдвиг сериализован (`colonyTradeOffset`).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; ОДИН батч `AskUserQuestion` — решения 3, 4, 5, рекомендация первой)
1. **RU** — имя оставить; эффект: «Эффект: когда вы торгуете, можете сначала продвинуть трек этой колонии на 2 шага.»; розыгрыш — существующий RU (`:30`); лор RU —
   «Точки Лагранжа — удобные стартовые площадки для полётов к разным мирам.» Не батч.
2. **Лицо и текст** — `metadata.description: 'Add a resource to 3 different cards that already have resources.'` (существующий ключ), ряд `plainText` долой; рендер
   `b.text('3').wild(1).asterix()` (печатный «?» — ресурс-джокер; `diverseTag` — нет); `infoText` розыгрыша тем же текстом (KEY-rule), блок эффекта — даром. Не батч.
3. **ПОСЕВ ВСЕХ, КОГДА КАНДИДАТОВ НЕ БОЛЬШЕ МЕСТ** (диагноз 4, раздел **CU**) — (а, рекомендовано) расширить T14 в `consoleActionComposer.ts` (общая для композеров):
   мультишаг с `N ≤ max` кандидатов и КАЖДЫЙ — выигрыш (ПО-бокс цели не отрицателен; у шага без ПО-бокса — всегда выигрыш) сеется ВСЕМИ (`seeded[id] = 'all'`),
   ряд отвечен («N целей», имена/миниатюры, каждая `N → N+1`), пометка «ВСЕ ЦЕЛИ» в хвосте ряда (как «ЕДИНСТВЕННАЯ ЦЕЛЬ» — тот же стиль, свой ключ), A на ряду
   открывает зону стола с отмеченными, B — посев цел; хотя бы один кандидат с отрицательным ПО, `N > max`, необязательный выбор с `skip`-маркером, выключенный кандидат
   — НЕ сеется (ряд открыт); `preselectWitness` — RE-ASKED красный как прежде; `composer-preselect.md` — угловой случай «MULTI» уточняется: «диапазон не сеется, если
   есть решение»; (б) оставить T14 как есть (1–3 держателя — два лишних нажатия на самом частом розыгрыше).
4. **Носитель сдвига — без жёсткого списка** (диагноз 3) — (а, рекомендовано) `effectSummary` читает `behavior.colonies.tradeOffset` карты из клиентского манифеста
   (`getCard(name)?.behavior?.colonies?.tradeOffset` — проверить, что `ClientCard` несёт `behavior`; если нет — вывести флаг в `ClientCard` при `make:cards`),
   `COLONY_TRADE_OFFSET_CARDS` удалить, `TRADE_DISCOUNT_CARDS` — не трогать (другой ключ); гард: спек, что каждая карта скоупа с `tradeOffset` даёт `'colonyTrade'`
   (Trading Colony, Trade Envoys, Veynon, P78) без строки; (б) добавить P78 в список (как TR85) — класс остаётся.
5. **Текст предупреждения руки** (диагноз 5) — (а, рекомендовано) `noMatchingCards` для карты-РОЗЫГРЫША читается как «No card on your table can take the resource» —
   `cardWarnings.ts` различает тип карты/контекст (один ключ на розыгрыш, прежний — на действие); (б) оставить «…of this action».
6. **Свой e2e-стенд — ДА**: `tests/e2e/console-l1-trade-terminal.spec.ts`, фикстуры `l1-trade-terminal` (Colonies + Prelude 2; у p1 ТРИ держателя с ресурсом —
   например Ants 1 (бактерия), Birds 1 (животное), Dirigibles 1 (аэростат) — все выигрыш; флот свободен, оплата торговли есть (9 M€ / 3 титана), колония на треке
   ~3; P78 в руке, 25+ M€ с титаном) и `l1-trade-terminal-vermin` (четыре держателя, среди них Vermin 1 → ряд открыт, Vermin показывает «ПО 0 → −1»-чтение честно).
   Клетки: (1) основная — композер: ряд целей ПОСЕЯН тремя, «ВСЕ ЦЕЛИ», каждая `1 → 2`; A на ряду — зона стола с тремя отмеченными, B; CTA; A → ОДИН POST →
   три жетона на три карты стола (рождение/посадка — по контракту переноса), счётчики карт тикают; карта в таблицу с 2 ПО; (2) торговля тем же ходом: «Колонии»
   — стоячий «+2» на треке до нажатия (`offsetCaption`), выбор колонии → ОДИН POST → глайд маркера на два шага → доход за новую позицию → чек называет «+2 ·
   Торговый терминал L1»; (3) `-vermin` — ряд открыт, посева нет, зона: Vermin с отрицательным ПО-чтением, выбор трёх других → +3.
7. **Журнал серии / доки** — запись P78; `PRELUDE2_ADAPTATION.md` — «5 / 54», строка; §3.1 п. 2 — одно предложение («bespoke с порогом авто-применения — всегда
   промпт + посев всех в композере»); `docs/DELAYED_TARGET_AUDIT.md` — строка триажа P78 (ловушка `<= 3` убита; SRR-кандидаты показаны) — ПОСЛЕ коммита соседа.
8. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `06e2fde0ae`. **Сначала** `ListAgents` + процессы; `SendMessage` соседу P80 (список его файлов — в шапке): твои файлы —
   `prelude2/L1TradeTerminal.ts`, `tests/cards/prelude2/L1TradeTerminal.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка), арт P78, `ru/{prelude2_cards,
   card_info,lore_texts,ui}.json`, `src/genfiles/*`, фикстуры + стенд; **по решениям 3–5** — `console/consoleActionComposer.ts`, `ConsolePlayCardConfirm.vue`,
   `ConsoleActionComposer.vue` (если посев общий), `played/ConsolePlayedTargetStep.vue` / `consolePlayedTargetModel.ts` (только если нужно для посева), `effects/effectSummary.ts`,
   `card/cardWarnings.ts`, спеки; `assets/text/lore_texts.json`, доки, журнал, реестр, аудит — ПОСЛЕ коммита соседа (своя строка/ханк). Коммиты явными путями; пуш после каждого.
2. e2e — только бокс; `FIXTURES=l1-trade-terminal,l1-trade-terminal-vermin npm run e2e:fixtures`; `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 30 %)
- `L1TradeTerminal.ts`: `description` + рендер `wild` (решение 2); `infoText` розыгрыша; `private eligible(player)` — ОДИН источник кандидатов для живого промпта и
  превью (уже `getEligibleCards`); **`bespokePlay`: убрать ветку `cards.length <= 3` — ВСЕГДА `SelectCard` (`min: 0`, `max: Math.min(3, cards.length)`)**; при 0
  кандидатов — `recordSkippedEffect(player, SKIP_REASON.noHolder, skippedAddToCard(undefined, 3))` (или свой `skippedX()` метод, общий с превью) и `return undefined`;
  `cardPlayPreview(player)` — форма Astra (`mergeCardSteps {min: 0, title: <тот же заголовок>, emptyWarning}` со слотами `selectCardStep` × min(3, N) с
  `dedupeFromSteps`) ИЛИ один `selectCardStep` с `max` — что принимает режим `multi` зоны стола; каждой цели — `amount: 1` своего ресурса (`cardResource` по
  `card.resourceType`) и `vpBox` (`targetVictoryPoints`); при пустом столе — `playPreview(this, player, [], [warningNote(…, {skipped})])`; `bespokeCanPlay` — как есть.
- Решение 4 — клиент (`effectSummary`), но гард — серверный спек по скоупу.
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P78.png" P78` → `make:cards`); RU эффекта (решение 1); `card_info` RU; строка
  `L1_TRADE_TERMINAL` долой; `make:cards` 0 / 0 / 0; `make:json`.
- **Спек**: апстримный блок — байт в байт, КРОМЕ двух `it` диагноза 7 (переписать: «1–3 candidates: STILL asks — the composer pre-selects (DELAYED_TARGET_AUDIT)»,
  «vermin among 3: asks, nothing pre-applied»); `describe('premium')`: правила 1–5 по одному `it` — сдвиг +2 после розыгрыша и −2 после ухода; план торговли p=4 → 6,
  p=5 → 6 (срез), доход за новую позицию, атрибуция P78 (событие `recordTradeTrackBonus`) и совместно с Trade Envoys; промью: один вопрос `max = min(3, N)`, заголовок =
  живому, у каждой цели `N → N+1` и ПО-бокс (Vermin — отрицательный), 0 кандидатов → `warningNote` с `skipped` и живой `effect-skipped` с ТЕМ ЖЕ описанием
  (`skippedEffectRecord`-класс), SRR-карты — в кандидатах обоих; ответ на 3 → +1 каждой, журнал — три строки одной записи; ответ на 0 — ничего, без записи пропуска;
  MarsBot-стол; save / reload.

## 2. Клиент — карта (≈ 5 %)
Даром: лицо (2 ПО, эффект), «ЭФФЕКТЫ», «Колонии» со стоячим «+2», глайд, чек, зона цели на столе в режиме `multi`, прилёт ресурсов на карты. Класс — §3.Б.

## 3. ГЛАВНОЕ — ПРОХОД ОБОИХ ПУТЕЙ И СТЕНД (≈ 55 %)
Форма — чек-лист P76 A–M; здесь — чем P78 отличается:
- **A/B.** Плита: 25, Космос, 2 ПО; при пустом столе — предупреждение «ресурсы некуда» (решение 5) — карта ИГРАБЕЛЬНА (не заперта); X — лицо `[колония]: +2` /
  `3 [?] *`, блоки: эффект · розыгрыш; лор.
- **C. Композер (розыгрыш).** Ряд целей: при ≤ 3 выигрышных — ПОСЕЯН всеми, «ВСЕ ЦЕЛИ», каждая `N → N+1` своим значком ресурса, ПО-бокс; A на ряду → зона стола
  (одна зона, P85) с отмеченными, `pickedLine` «3 из 3», B — цел; при Vermin — ряд открыт, Vermin с «−»-чтением; `emptyWarning` при 0 выбранных; оплата титаном;
  курсор прибыл; CTA.
- **D. Коммит.** ОДИН POST (ответ адресован одному `SelectCard`, `cards: [...]`); цена с рельса; три жетона ресурса рождаются и САДЯТСЯ НА ТРИ КАРТЫ СТОЛА
  (контракт `resource-transfer.md`: получатель — карта на столе, счётчик карты тикает на посадке); карта — в таблицу с бейджем 2 ПО; флоу ЛЕВИТ.
- **E. Торговля (тот же ход).** «Колонии»: стоячий «+2» на КАЖДОМ активном треке до нажатия (`[data-colony-track-offset]`, 0 POST); выбор колонии + оплата → ОДИН
  POST → ADVANCE-глайд маркера на два шага (срез у верха — на сколько есть) → доход за новую позицию → чек торговли называет сдвиг и карту; с Trade Envoys вместе — «+3».
- **F/G/H.** Журнал розыгрыша — три строки ресурсов (по карте) в одной записи; журнал торговли — атрибуция P78 (`recordTradeTrackBonus`); соперник — «+1 ресурс на
  Ants, Birds, Dirigibles». Пустой стол — запись «Пропущено: ресурс на карту ×3» и уведомление.
- **I. «Сработает».** Метка Космос — реакторы в скоупе (grep `onCardPlayed` ∧ `Tag.SPACE`); ряд честен.
- **J. Края (сервер).** SRR-карты как цели (кандидаты и зона стола — показаны; e2e не нужен); 0 кандидатов; верх трека; уход карты снимает сдвиг.
- **K/L/M.** Как у P76 (save/reload с открытым композером; осмотр X из зоны стола).

### 3.Б Класс «кандидатов не больше мест — посеяны все» (решение 3, раздел CU)
`consoleActionComposer.ts`: `allCandidatesSeed(step, candidates, max, flags)` рядом с `soleCandidateOf` — ЧИСТАЯ (таблица условий решения 3); `seeded[id] = 'all'`;
ряд цели — пометка «ВСЕ ЦЕЛИ» (ключ новый; стиль как «ЕДИНСТВЕННАЯ ЦЕЛЬ»); зона стола открывается с отмеченными; батч — адресованный ответ со всеми; спеки:
`consolePlayCardComposer.spec` § all (сеется / не сеется — по строке таблицы), `preselectStamp.spec` § посеянный мульти, `composerRender.spec`; `composer-preselect.md`
— раздел «MULTI: диапазон сеется всеми, когда решения нет»; CLAUDE.md инвариант 3 — не трогать (формулировка покрывает: «PRE-SELECTED and shown … never applied silently»).

## 4. Лицо, локаль, лор, арт
Арт P78; лор EN + RU; RU эффекта; новые ключи: «All targets» («ВСЕ ЦЕЛИ»), текст предупреждения руки (решение 5), `emptyWarning` розыгрыша («No cards are selected.
The card will be played, but no resources will be added.» — grep: у Astra свой), заголовок живого промпта «Select up to 3 cards to gain 1 resource each» — RU
проверить/добавить в `play_prompts.json`; grep ДО добавления; чужой RU не переписывать; `title` запрещён; глифы — `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды: `Prelude2CardsHeldBack`, `premiumScope`, **`cardPlayPreviewCoverage`** (хук; «behavior+bespoke hidden result» — хук есть), `cardInformation`
   (KEY-rule против `description`), `requirementProse`, `premiumCardViewModel`, `premiumCardIcons` (`wild`), `cardLore`, `crossPlayerCoverageGuard`, **`skippedEffectRecord`**
   (превью = живая запись слово в слово — добавить P78 в его таблицу классов), `effectExtraction` (эффект торговли — «Flagged»?), `effectForecastCoverage` (без хуков —
   ничего), `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`, спек `effectSummary` (решение 4), спек
   `cardWarnings` (решение 5).
2. `build:server`, `build:test`, `lint`, `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия — `console-veynon-dynamics` (A–D — список носителей/вывод из манифеста не сломал «+1»), `console-colony-trade-receipt`,
   `console-colony-trade-probe`, `console-trade-target-step`, `console-card-trade-entry`, `console-composer-preselect` (посев T14 не изменился для одиночки),
   `console-hand-pick-preselect`, `console-table-target-zone`, стенд Astra Mechanica / Public Plans (`grep -l "Astra\|Public Plans" tests/e2e`), `console-futile-actions`
   (предупреждение `noEffect` действий — решение 5 не сломало).

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/p78/{tv4k,fhd}/`: (а) композер с посеянным рядом «ВСЕ ЦЕЛИ» и тремя `1 → 2`; (б) зона стола с тремя отмеченными; (в) `-vermin`: ряд открыт, Vermin с «−»;
(г) коммит: три жетона на три карты, счётчики; (д) «Колонии» со стоячим «+2» до нажатия; (е) глайд на два шага и доход; (ж) чек торговли с атрибуцией. Своим глазом:
«я вижу, КУДА лягут три ресурса, ЧТО это даст по очкам, и почему маркер колонии прыгнул на два ДО дохода?»

## 7. Полировка по пути
1. Реестр **CU** «P78 · КАНДИДАТОВ НЕ БОЛЬШЕ МЕСТ — ПОСЕЯНЫ ВСЕ · НОСИТЕЛЬ СДВИГА — ИЗ МАНИФЕСТА, НЕ ИЗ СПИСКА» — решения 3–5 строками + находки прохода; номера — по
   footer ПОСЛЕ коммита соседа. Без гэпов — только журнал.
2. Доки: журнал серии (P78); `PRELUDE2_ADAPTATION.md` (5 / 54; строка; §3.1 п. 2); `DELAYED_TARGET_AUDIT.md` (строка P78); `composer-preselect.md` (MULTI); память
   `prelude2-adaptation.md` (5 / 54).

## 8. Режим работы
1. Читать до кода. ПЕРВЫМ ДЕЛОМ — «до» (юнит или бокс): что композер показывает для P78 без хука и как сегодня проходит розыгрыш с 3 держателями (молча?). Порядок:
   карта (ловушка, хук, описание, рендер) + спек + строка долой → лор / арт / RU → `make:cards` → фикстуры + стенд (клетки 1–3) → решения 3–5 (класс + юниты) → проход
   A–M + «после» → CU → доки / журнал / аудит / память (после коммита соседа). Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; «до/после»; таблица A–M с кадрами; POST на розыгрыш и на торговлю; гарды и `make:cards`; регрессия на боксе
   (аннотация `build`); решения 1–8 (что сделано по умолчанию); ОДИН батч `AskUserQuestion` по решениям 3, 4, 5; гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Молчаливое применение при любом числе кандидатов (ни на сервере, ни «посевом без ряда»); сеять, когда есть решение (отрицательное ПО, `N > max`, выключенный, `skip`);
  второй источник кандидатов (живой промпт и превью — один `getEligibleCards`); второе чтение сдвига (план торговли — один, `tradeTrackPlan`); спрашивать «применить ли
  сдвиг?» (печатное «may» — всегда в плюс); `diverseTag` вместо печатного «?»; молчать при пустом столе; `title`; литерал кнопки; ореол; таймер вместо холда.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; править файлы
  соседа P80 до его коммита; переоткрывать находки P76/P85/P68/P80; брать апстримный «skip single-card target» (аудит).
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить чужие файлы; пересборку во время прогона e2e на боксе.
