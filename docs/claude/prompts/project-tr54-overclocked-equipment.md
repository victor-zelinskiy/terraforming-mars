# Промт исполнителю · TR54 Overclocked Equipment («Разогнанное оборудование») — зелёная, 9, метка Энергии, плашка ИНДУСТРИАЛОВ: «Также заплатите 3 энергии. Выберите вид стандартного ресурса. Получите его столько, сколько у вас производства этого ресурса» · ГЛАВНОЕ — БОЛЬШАЯ ВИЗУАЛЬНАЯ ИТЕРАЦИЯ «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»: вопрос «КАКОЙ ресурс» во всех хостах консоли — ОДИН объект, ряд из шести плиток с иконкой-героем и своим числом, а не шесть предложений / шесть голых иконок / шесть фишек-чипов; печатный «?» карты остаётся премиум-спрайтом `wild.png` (решение 4), и жетон выбранного ресурса рождается ИМЕННО на нём

Выдан 2026-10-15. Инфраструктура набора стоит (TR01–TR53, TR55 (у соседа — см. §0), TR66 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md` (§1 пять точек касания; §4 — строки «требование ПАРТИИ» (TR15), «ВЫБОР ВАРИАНТА на розыгрыше» (TR43/TR50/TR51),
«карта СЧИТАЕТ свой розыгрыш» (TR45), «PRE-SELECT»; постоянный **§7**: агент САМ ищет места доработки; **«Профили»** — TV 4K сперва; **«Бесшовность — workspace-архитектура»**;
**«Премиум-планка»** (карта-декларация → бюджет полировки = всё сверх карты); **«Качество полировки»** — сильная рабочая концепция или откат, ОБА КОНЦА КАЖДОГО ПОЛЁТА ВИДИМЫ,
сданное перепроверяется), журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`, правила —
`.claude/rules/{game-logic,server,console-ui,animations,premium-card,tests,localization}.md` (законы: **THE VARIANT CHOICE IS ONE GRAMMAR** (TR51 + плитки-исходы 2026-10-14 —
`docs/claude/console/variant-choice.md`), **A CHOICE IS A PRESS**, **A DECISION COLUMN SETTLES** (`settledColumn.ts`), **AN ACTION THAT CHANGES NOTHING IS STILL AN ACTION** (класс
«без эффекта» — тихо, никогда не скрыто, никогда не янтарно), **PHYSICAL CAUSALITY** и **THE ENDS OF A FLIGHT ARE VISIBLE** (PL-162/165 — «жетон из ничего» запрещён), **ТАКТ ПОСТАВКИ**
PL-107 (цена розыгрыша с рельса уходит ДО взлёта — `consolePlayedHero.ts:278`), **PL-099/PL-104** (цена уходит ВБОК, в печатную иконку цены), **«жетон садится на чернила»** (PL-094),
**EVERY CHOICE IS MADE BEFORE THE COMMIT** + закон 27 (адресованный ответ), **A COUNTED PLAY SAYS HOW MANY AND WHY** (TR45), **THE PROMPT-MODAL FAMILY** (AN/AP — для живого промта),
**«МОГ БЫ» ≠ «МОГУ»**), контракты — `docs/claude/console/{variant-choice.md, play-card-result.md, workspace-band.md § РОЗЫГРЫШ КАРТЫ / § ACTION COMMIT, futile-actions.md,
prompt-modal-family.md, effect-forecast.md}`, `docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` (хост «Действия карт» с шагом внутри), `docs/TURMOIL_REDUX_COMPOSTING_INITIATIVE.md` (счётный розыгрыш,
плашка руки, «ПОЧЕМУ»). Память: `outcome-tiles` (реворк вариантного выбора по фото 4K — плитка-исход, печать голая, один ряд), `futile-actions-iteration` (тихая опция = opacity на детях,
белый счётчик), `polish-remediation-iteration-1` (закон видимости концов, свидетель `transferWitness`), `tr49-one-play-class` (A/B часами страницы — `waitFor` квантует 500 мс),
`x87-shipment-to-earth` (такт поставки PL-107 — образец цены розыгрыша с рельса), `polish-premium-bar`, `polish-quality-no-regressions`, `storyboard-catches-what-the-probe-passes`,
`perf-measure-on-gpu-not-swiftshader`, `concurrent-session-edits-same-files`, `ab-baseline-head-client-in-snapshot`, `e2e-fixture-generator-gotchas` (только свой JSON — полный regen
перемешивает все Redux-фикстуры).

**АКЦЕНТ ВЛАДЕЛЬЦА (2026-10-15): «область для полировок выбери сам; приоритет — там, где уместны визуальные доработки; главный приоритет — хороший визуал, то есть там, где визуал
хромает».** Карта сама — почти декларация (плашка Индустриалов, `spend: {energy: 3}`, метка Энергии) плюс ОДИН bespoke-вопрос «какой из шести стандартных ресурсов», и ровно этот вопрос —
место, где визуал консоли хромает сегодня (диагноз ниже, кадры есть): в «Действиях карт» (Astrodrill) он — СПИСОК ИЗ ШЕСТИ ПРЕДЛОЖЕНИЙ во всю ширину колонки, где иконка живёт в чипе у
правого края, а ~70 % каждой строки — пустое стекло; в живом промте (`SelectResource` — `ConsoleTaskHost`) — ШЕСТЬ ГОЛЫХ ИКОНОК без числа, без `current → resulting`, без источника
(шасси старше семейства модалок и грамматики вариантов); в действии Индустриалов — 6 + 2 плитки из ОДНОГО ЧИПА каждая, без героя; в композере розыгрыша шестиветочного «ИЛИ» ещё не было
(TR43/TR50/TR51 — 2–3 ветки), и по нынешним правилам шесть плиток-исходов на fhd лягут СТОЛБОМ (`console_variant_choice.less:351–353` — контейнер ≤ 40rem складывает `compare` в колонку),
а на 4K — рваной сеткой 4 + 2 (`flex-basis: 12rem; max-width: 28rem`). Печатный «?» на лице — `assets/resources/wild.png` (премиум-плита 512² той же семьи, что `steel.png` / `titanium.png` /
`heat.png` — ОСТАЁТСЯ: решение владельца 2026-10-15; выданный с картой `…\TM Turmoil Redux\Assets\Standard Resource.png` — плоская иконка ПЕЧАТИ, только ключ чтения скана: шесть цветов
= шесть стандартных ресурсов), и жетон выбранного ресурса на этом «?» не рождается (ни одной иглы `wild` в `ICON_NEEDLES`). Итерация — **«ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»**: ОДНА раскладка `palette` грамматики вариантов (`ConsoleVariantChoice`) во всех
четырёх хостах + тот же премиум-«?» (`wild.png`) как эмблема группы + честное рождение жетона на печатном «?». Кандидаты второго ряда (плашка руки «до +N», «ПОЧЕМУ» на плитке) — в §6.

**ДИАГНОЗ, СНЯТЫЙ ПРИ ПОДГОТОВКЕ (чтением, файл:строка на `3035d58c4c` — подтвердить ДО правки):**
1. **Кадр 4K хоста «Действия карт».** `screenshots/console-action-resource-pick/tv4k-1-resource-step.png` (стенд `tests/e2e/console-action-resource-pick.spec.ts`, Astrodrill, ветка
   «Получите стандартный ресурс»): под кикером «ВЫБЕРИТЕ РЕСУРС» шесть строк `list`-раскладки `ConsoleVariantChoice` — «Получите 1 титан … [Ti] 500 → 501», каждая во всю колонку
   решения (≈ 2000 px на 4K), иконка ≈ 40 px внутри чипа у правого края, слово — слева, между ними — стекло. Шесть предложений для вопроса «какая иконка». Печатный «?» карты
   (`wild.png`) с иконками строк не рифмуется.
2. **Шаг Astrodrill на сервере** — `promo/Astrodrill.ts:98–135`: ветка «Gain a standard resource» несёт `steps: [actionPreviews.orOptionsStep(player, this.standardResourceOptions(player))]`;
   `standardResourceOptions` — побочно-свободный строитель шести `SelectOption` с `.withMetadata(gainStock(player, res, 1))` (`inputs/optionMetadata.ts:74–97` — `kind: 'resourceGain'`,
   `icon`, `amount`, `effects: [{gain, current, resulting}]`) — ОБРАЗЕЦ для TR54 (та же форма, другие числа). Композер «Действий карт» ведёт вложенный `or` через `orOptionDoor` →
   список (`list`); для TR54 (розыгрыш) шесть вариантов — СОБСТВЕННОЕ «ИЛИ» карты (`orBranches`, TR43/TR51-класс), а не вложенный шаг.
3. **Живой промт `resource`** — `ConsoleTaskHost.vue:277–287`: `con-task__tiles` → `<i class="resource_icon resource_icon--<unit>">` + глиф A на фокусе. Ни числа, ни
   `current → resulting`, ни карты-источника; `SelectResourceModel` (`inputs/SelectResource.ts:19–26`) несёт `title · buttonLabel · include` — КОЛИЧЕСТВО живёт только в заголовке
   («Gain ${0} units of a standard resource», `Executor.ts:500`), а заголовок парсить запрещено. Производители: `Executor.ts:483–506` (`behavior.standardResource`, `same: true`),
   `deferredActions/GainAnyResourceButScienceDeferred.ts:46`, `pathfinders/PathfindersExpansion.ts`, prelude2 (`AppliedScience`, `FocusedOrganization`, `FloatingTradeHub`), underworld
   (`Monopoly`, `GreyMarketExploitation`, `UndergroundSmugglingRing`), starwars (`CloneTroopers`) — почти всё фронтир; в премиум-скоупе семейство достигается через Astrodrill
   (вложенный шаг пре-коллектится композером, живой промт — дорога ДЕГРАДАЦИИ: перезагрузка посреди промта, вопрос на чужом ходу). Хост — четвёртый по приоритету (§2.4).
4. **Действие Индустриалов** — `parliament/ConsolePartyActionComposer.vue:196–226` и `:1163–1171`: два ряда («−1 производство» из шести, «+1 производство» из двух) —
   `ConsoleVariantChoice :exclusive="false"`, тело плитки — `ActionEffectChip` производства, `title` только когда чипов нет; `compare`-раскладка без героя. Кадра 4K НЕТ
   (`screenshots/parliament-actions/tv-4k` — Индустриалов не снимали; `console-parliament-actions.spec.ts:269–302` снимает `02-industrialists-stage` на 1080) — снять ПЕРВЫМ делом и
   приложить в отчёт как «до».
5. **Шестиветочное «ИЛИ» розыгрыша.** `ConsolePlayCardConfirm.vue:164–192` (блок вариантов: `sharedVariantEffects` печатает общие чипы ОДИН раз над рядом — сюда ляжет цена «−3 [энергия]»;
   `variantsEl` измеряет ось; `printedVariantRows` режет печатный ряд по OR — у TR54 печатный ряд ОДИН («−3 ⚡ ? / ?-произв.»), резать нечего → плитки говорят словами и чипами);
   `console_variant_choice.less:76–78` (`flex: 1 1 11rem; max-width: 26rem`), `:351–353` (`@container (max-width: 40rem)` → `flex-basis: 100%` — столб), `:441–444` (TV:
   `flex-basis: 12rem; max-width: 28rem`). Ширину колонки решения композера розыгрыша на fhd/4K ИЗМЕРИТЬ (стенд `variant-tiles`/`variant-settle`), не угадывать.
6. **Откуда родится жетон.** `consoleActionCommitMotion.ts:92–112` (`ICON_NEEDLES` — иглы по ресурсу; строки `wild` НЕТ), `:218–262` (`resolveGainIconOrigins` → `resolveIconPoints`:
   k-й жетон ресурса — на k-й иконке, печатающей ЕГО; нет совпадения → `undefined` → источник уровня карты, «из плиты»); `resolveResultIcon(... 'resources', firstResource)` `:181–215` —
   та же игла; `consolePlayedHero.ts:1859–1881` (`heroGainOrigin` — только `card-resource`); лестницу источника СТОКОВЫХ наград сцены приземления (`playRailReward` / такт награды) —
   найти и прочитать ДО правки. Для TR54 выбранный ресурс на ряду не напечатан — напечатано «?»: нужна ступень «ресурс, не напечатанный на ряду, рождается на печатном WILD».
7. **Цена розыгрыша.** `Behavior.ts:51` `spend?: Partial<OneOfType<Spend>>` (`Spend = Units & …`, `:25–39`), `Executor.ts:121–135` (`canExecute`: `player.energy ≥ 3`), `:382–400`
   (`execute`: не-M€ единицы списываются до остатка поведения). ПОДТВЕРДИТЬ: (а) `models/unplayableReasons.ts` называет «нужно 3 энергии» для `spend` (grep «spend» там пуст — возможно,
   нужен `unplayableReason?()` в карте или общая ступень для `spend`); (б) декларативное превью печатает чип цены для `spend` (grep «spend» по `models/cardPlayPreview.ts` пуст — X87 делает
   цену bespoke `actionPreviews.stockCost`, `promo/ShipmentToEarth.ts:94`); (в) `consoleActionCommit.playSpendReward` берёт `cost`-чип стандартного ресурса → `shipStockSpends`
   (`consolePlayedHero.ts:1152`) → жетон «−3» с ряда энергии вбок в печатную «−3 ⚡» ДО взлёта (PL-107).
8. **Лицо.** `premiumCardIcons.ts:261` `[CardRenderItemType.WILD]: wild.png`; `CardRenderer.ts:342` `wild(amount, options)` — в базовом строителе (производственная рамка
   `production((pb) => pb.wild(1))` — проверить, что `pb` его принимает и `premiumCardViewModel`/`effectExtraction` не падают). Потребители WILD на лице: `promo/Astrodrill`,
   `ceos/{Caesar,HAL9000,Jansson,Ryu,Will}`, `pathfinders/{Crashlanding,GeologicalExpedition,PrivateSecurity}`, `delta/DevelopmentManager`, `base/CEOsFavoriteProject` — спрайт НЕ меняется
   (решение 4); список — регрессия только там, где ступень WILD / палитра коснётся их композеров (Astrodrill — H2). `wild-std.png` — только `pathfinders.less:161` (мёртвый десктоп) — не трогать.
9. **Класс «без эффекта» на ветке/опции** — `ActionPreviewModel.ts:390` `futile?: ActionFutilityVerdict` (ветка превью), `PlayerInputModel.ts:851` (опция живого промта),
   `variantChoiceModel.ts:46` `quiet` (плитка тихая, «○ …», никогда не скрыта); проверить, что КОМПОЗЕР РОЗЫГРЫША (не только действий) читает `branch.futile → quiet`.
10. **Дерево/соседи.** HEAD `3035d58c4c`; в дереве 46 незакоммиченных файлов соседа TR55 (итерация «ячейка ПО»): `CardName.ts`, `TurmoilReduxCardManifest.ts`, `turmoil_redux_cards.json`,
    `card_info.json`, `lore_texts.json` (оба), `generate.ts`, `consoleStart.ts`, `consolePlayedHero.ts`, `consoleResourceTransfer.ts`, `railReward.ts`, `resourceTransferModel.ts`,
    `gameTransport.ts`, `stagedPlay.ts`, `ConsoleResourcePanel.vue`, `ConsoleShell.vue`, `App.vue`, `premium_card.less`, `console.less`, `console_resource_transfer.less` — ВСЕ пересекаются
    с TR54. §0 обязателен.

## Обязательное чтение до кода
`docs/claude/console/variant-choice.md` (целиком — контракт плитки-исхода и § 2 «группа — ряд»), `docs/claude/console/play-card-result.md`, `docs/claude/console/futile-actions.md`,
`docs/claude/console/prompt-modal-family.md` (чеклист нового промта — для H4), `docs/claude/console/workspace-band.md` § РОЗЫГРЫШ КАРТЫ / § ACTION COMMIT / § РТ РОЗЫГРЫША,
`docs/TURMOIL_REDUX_MARTIAN_CENSUS.md` §§ хост/шаг, `docs/TURMOIL_REDUX_COMPOSTING_INITIATIVE.md` (плашка руки, «ПОЧЕМУ»), `docs/TURMOIL_REDUX_FRONTIER_LABS.md` §1 (маркеры вместо
заголовков), `docs/claude/turmoil-redux-card-checklist.md` §§0–7, последняя запись `docs/claude/turmoil-redux-cards-progress.md` (TR53/TR55 — формат), `tests/e2e/console-action-resource-pick.spec.ts`
(что именно он утверждает о шести строках — переводить, не ломать: контракт живости e2e), `tests/e2e/console-variant-tiles.spec.ts` + `console-variant-settle.spec.ts` (пробники
геометрии вариантов — образец), `tests/e2e/console-nuclear-warhead-utilization.spec.ts` (голова — профили, модель сервера, свидетель), `tests/cards/turmoilRedux/NuclearWarheadUtilization.spec.ts`
(стол с плашкой Индустриалов — `table()`), `src/server/cards/promo/Astrodrill.ts` (строитель шести опций), `src/client/console/consoleActionCommitMotion.ts` §§ иглы/источники,
`src/client/components/console/foundation/ConsoleVariantChoice.vue` + `src/client/console/variantChoiceModel.ts` (куда встаёт раскладка).

## Что это за карта
**Сканы:** `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR54.png`; иконка — `C:\Users\zelin\Downloads\TM Turmoil Redux\Assets\Standard Resource.png` (выдана владельцем
вместе с картой — КЛЮЧ ЧТЕНИЯ скана, не ассет: решение 4). Правила набора — `C:\Users\zelin\Downloads\TM Turmoil Redux\Turmoil Redux Rules.pdf` (FAQ с. 18–19: требование партии = «правит» ИЛИ 2 своих делегата на её резолюции;
TR36 Council Seat / Septem Tribus требований НЕ удовлетворяют). Арт: в `C:\Users\zelin\Downloads\Mars Arts\` файла `TR54.png` **НЕТ** — спросить владельца (решение 3), лицо до ответа
без арта (как TR55).
**Зелёная (AUTOMATED), 9 M€, метка Энергии, плашка MIN = эмблема Индустриалов.** Эффект: `spend: {energy: 3}` + bespoke-вопрос «какой стандартный ресурс» → `stock.add(res, max(0, production[res]))`.

## Оценивается
1. **Карта** (≈ 20 %): сервер (декларация + один побочно-свободный строитель шести опций, общий с превью), превью = исполнение (6 веток, адресованный `or`, тихие нули),
   лицо по скану, локаль, лор, спек ≈ 12 правил, гарды зелёные.
2. **Итерация «ПАЛИТРА»** (≈ 80 %): ОДНА раскладка `palette` в `ConsoleVariantChoice` + 4 хоста (§2.1–2.4), премиум-«?» `wild.png` как эмблема группы (§3), честное рождение
   жетона на печатном «?» (§2.5), цена «−3 энергии» по PL-107 (§2.6), e2e-свидетели fhd + tv4k, перевод затронутых стендов, раздел реестра, документ контракта (§6/§7).
3. **Нуль регрессий**: `console-variant-tiles`, `console-variant-settle`, `console-influential-discovery`, `console-parliament-actions`, `console-action-resource-pick` (переведён),
   `console-composting-initiative`, `console-frontier-labs`, `console-nuclear-warhead-utilization` (сосед) — зелёные на СВОЁМ снапшоте.

### Что зашито сегодня (прочитать, не переписывать)
| Что | Где | Статус для TR54 |
| --- | --- | --- |
| Требование ПАРТИИ `{party}` — причина, эмблема, счётчик руки, прозa требования | TR15 класс; `NuclearWarheadUtilization.ts:70`, `unplayableReasons.ts:376` `PARTY_REQUIREMENT_REASON`, `requiredPartyOf` | бесплатно |
| Декларативная цена `spend` | `Behavior.ts:51`, `Executor.ts:121–135/382–400` | есть; ПОДТВЕРДИТЬ причину руки и чип цены (диагноз 7) |
| Опция «получите N <ресурс>» с `current → resulting` | `optionMetadata.gainStock` `:74–97` | есть; TR54 передаёт СВОЙ `amount` и базу ПОСЛЕ цены для энергии |
| Побочно-свободный строитель шести опций, общий с превью | `Astrodrill.standardResourceOptions` `:126–135` | образец (копировать форму в файл карты, не вызывать чужое) |
| Многоветочное bespoke-превью | `actionPreviews.orBranches` `:1531–1568` (`BranchSpec`: `available · title · effects · unavailableReason · optionInput · steps · futile?`) | есть; 6 веток, `autoResolveSingle: false` не нужен (все 6 доступны всегда) |
| Общие чипы над рядом «ИЛИ» | `ConsolePlayCardConfirm.vue:179–181` `sharedVariantEffects` | есть — цена ляжет туда |
| Грамматика вариантов | `ConsoleVariantChoice.vue` (`layout: compare|column|list`, `exclusive`), `variantChoiceModel.ts` (`VariantChoiceOption {key,state,title,reason,quiet,printed,door,color,attrs}`), `console_variant_choice.less` | ДОБАВИТЬ `palette` + поле героя |
| Класс «без эффекта» | `actionFutility.ts`, `ActionPreviewBranch.futile`, `OptionMetadata.futile`, `variantQuiet` | есть; вердикт на ветках с нулевым производством — СЕРВЕРНЫЙ |
| Такт поставки (цена розыгрыша с рельса ДО взлёта) | `consolePlayedHero.ts:278–300, 1152` (`shipStockSpends`), `consoleActionCommit.playSpendReward` | есть; проверить вход для `spend` |
| Иглы иконок и источники жетонов | `consoleActionCommitMotion.ts:92–262` | ДОБАВИТЬ ступень WILD |
| Счётный розыгрыш (плашка руки, «ПОЧЕМУ») | TR45: `countedPlayEffects`, `ICard.countedPlayForecast`, `handForecastPlate`, `ConsoleCountedWhy`; гард `countedPlayForecast.spec` по ПОВЕДЕНИЮ | решить форму плашки (решение 7) — гард потребует |
| Стенд выбора ресурса | `tests/e2e/console-action-resource-pick.spec.ts` + `screenshots/console-action-resource-pick/` | ПЕРЕВЕСТИ на палитру (контракт живости e2e) |
| Фикстуры парламента | `tests/e2e/fixtures/generate.ts:5827–5862` (`parliamentFixture`, `seatEnacted(parliament, quietResolutionOf(PartyName.INDUSTRIALISTS))`, `moveToDeckTop`), `consoleStart.ts:2338` (`FixtureName`) | образец |

### Чтение скана (`…\Projects\Card_-_TR54.png`)
Зелёная рамка; цена **9**; слева от цены оранжевая MIN-плашка с эмблемой Индустриалов (шестерня вокруг глобуса) — ТРЕБОВАНИЕ, не метка. Одна метка в углу — Энергия (фиолетовый диск
с молнией). Заголовок «OVERCLOCKED EQUIPMENT». Поле: ОДИН ряд: «**−3** [энергия]» затем «[?]\*» (шестицветный квадрат с белым «?» — Standard Resource) затем «**/**» затем
«[?]\*» внутри КОРИЧНЕВОЙ ПРОИЗВОДСТВЕННОЙ РАМКИ; обе звёздочки — «см. текст». Текст: «(Requires the Industrialists to be ruling or that you have 2 delegates there. Also pay 3 energy.
Pick a basic resource type. Gain an amount of that resource equal to your production of it.)». Лор под правилом: «It even comes with RGB lighting!». Кредит арта: UBTech. Внизу —
только символ модуля (фиолетовый ромб со стрелкой): без `compatibility`. ПО нет. Номер TR54. Рендер: `b.minus().energy(3, {digit}).wild(1).asterix().slash().production((pb) =>
pb.wild(1)).asterix()` — сверить с лицом глазами (thumb / normal / zoom; «/» между «?» и рамкой читается «столько ?, сколько ?-производства»).
**Иконка `Standard Resource.png`:** 331×331, шесть цветных клиньев (жёлтый · коричневый · чёрный · зелёный · красный · фиолетовый — цвета шести стандартных ресурсов) вокруг
белого «?» с чёрной обводкой — это и есть печатный «?» набора; на лице его играет премиум-спрайт `wild.png` (решение 4).

### Правила чтения (каждое — закрепить спеком `tests/cards/turmoilRedux/OverclockedEquipment.spec.ts`)
1. **Требование** — плашка Индустриалов (TR15 класс): правят, или 2 СВОИХ делегата на их резолюции; TR36 порог ЭФФЕКТА снижает, требование — нет. Без обеих дорог рука называет
   партию и обе дороги (`partyRequirementStanding`).
2. **Цена** — 9 M€ по обычной оплате + **3 энергии** при розыгрыше (`spend`): с 2 энергии карта `✕ Нельзя разыграть`, причина называет ОДИН блокер — энергию (порядок ступеней
   лестницы `unplayableReasons` — спеком: партия без энергии, энергия без партии, обе).
3. **Вопрос задаётся ВСЕГДА** — шесть опций (M€ · сталь · титан · растения · энергия · тепло — порядок рельса сверху вниз), даже если пять из них — нули; никакого
   авто-выбора единственного ненулевого (закон «NO AUTO-SELECT»). `OrOptions.markChoiceContext(cardEffect(this, undefined, 'reward'))`; каждая опция — `gainStock(player, res,
   amount)` с `current → resulting`.
4. **Сколько** — `max(0, player.production.get(res))` в момент выбора; ОТРИЦАТЕЛЬНОЕ производство M€ → 0 (нельзя получить отрицательное), опция остаётся и названа
   («производство −1 → получите 0» — тихая строка опции, никогда не скрыто, никогда не янтарно).
5. **Энергия** — цена уже уплачена: выбор энергии даёт `production.energy`, нетто `production − 3`; чип опции читает базу ПОСЛЕ цены («⚡ 2 → 3» при 5 энергии и производстве 1).
6. **Превью = исполнение** — `orBranches` в ТОМ ЖЕ порядке, что живые `SelectOption`; общий чип цены `stockCost(ENERGY, 3)` в каждой ветке первым (композер поднимает его над рядом —
   `sharedVariantEffects`); ветка с нулём несёт `futile` (серверный вердикт, причина «производство 0»); ответ `or` адресован `{role: 'or', source: карта}` (закон 27) и реплеится батчем
   `[play, or]` — `cardPlayReplayCoverage` берёт карту сам.
7. **Счётный розыгрыш** — `countedPlayForecast` (TR45): числа веток — те же чипы, базис — «= производство [иконка] N»; плашка руки — решение 7.
8. **Метка Энергии** — Thorgate −3 M€, требования по Энергии других карт, RX04 Central Power Grid (счёт `'raw'`, квест председателя «2 метки Энергии» — `QuestTracker {kind: 'tag'}`,
   ворота квеста на `BACK_OF_THE_LINE`).
9. **Журнал** — «paid 3 energy» (цена) → «gained N <res>» (выбор); нулевой выбор — «gained 0 <res>» честно, без `effect-skipped` (это выбор игрока, не пропуск эффекта).
10. **Соперник** видит розыгрыш и выбор; MarsBot карту не играет; save/load — обычная карта, стоящий `or` переживает перезагрузку (живой `waitingFor`).
11. **Прогноз стола** — что отвечает метке Энергии (`effectForecastCoverage`), без РТ — никакая партия не отвечает.
12. **Чистота** — `cardPlayPreview` / `countedPlayForecast` ничего не мутируют (снимок состояния до/после).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §7)
1. **Имя RU** — «Разогнанное оборудование» (коллизий в `cards.json` / `turmoil_redux_cards.json` нет: «Overclocked», «Разогнан», «оборудован» — пусто). Альтернатива «Разгон оборудования».
2. **Лор** — EN слово в слово «It even comes with RGB lighting!» (ключ `TR54` в `assets/text/lore_texts.json`, RU в `src/locales/ru/lore_texts.json`: «Даже с RGB-подсветкой!»).
3. **Арт** — нет файла; лицо без арта до выдачи владельцем (сообщить в отчёте первой строкой).
4. **Спрайт «?» лица — ОСТАВИТЬ `assets/resources/wild.png`** (РЕШЕНО владельцем 2026-10-15: премиум-семья иконок лица важнее верности печати — плоский
   `Standard Resource.png` на премиум-лице читается дёшево; файл — ТОЛЬКО ключ чтения скана, в `assets/` не кладётся). Тот же `wild.png` — эмблема палитры (§2.0) и глиф плашки
   руки (решение 7). Единственный честный довод «за» печать — шесть цветов говорят «любой из шести», серая плита — только «?»; если когда-нибудь захочется — это ОТДЕЛЬНАЯ арт-задача
   (премиум-перерисовка `wild.png` с лёгкими шестицветными вставками в той же плите), не этот промт.
5. **Палитра — без медальонов «ИЛИ»** (а, рекомендовано): шесть плиток одного вида — один объект; «ИЛИ» ×5 — шум; взаимоисключение несёт кикер группы над рядом («ВЫБЕРИТЕ ОДИН»
   / «ОДИН ИЗ ШЕСТИ») и печать «?» в его начале. Альтернатива (б): тонкие швы с малым «или» только на fhd.
6. **Нули** — плитка стоит, тихая (`quiet`: иконка на шаг назад, «0» приглушён, строка «○ производство 0»), никогда не скрыта (класс «без эффекта»); отрицательное M€ —
   та же тихая строка «производство −1 → 0».
7. **Плашка руки** — «[?] до +N» (потолок среди шести, глиф `wild.png`) — честно и без совета; альтернатива — без плашки (тогда гард `countedPlayForecast.spec` — обоснованное
   исключение «ВЫБОР счётных исходов»). Совет «какой лучше» (иконка лучшего) — ОТКЛОНИТЬ: консоль не советует.
8. **Чип энергии** — две записи: общий чип цены над рядом «−3 ⚡ 5 → 2» и плитка энергии «+1 · 2 → 3» (база после цены). Альтернатива — один чип «5 → 2 → 3» — ОТКЛОНИТЬ (две причины —
   два чипа, PL-104/PL-107 ведут их порознь).
9. **Живой промт `resource` (H4)** — в итерации, ПОСЛЕДНИМ (фронтир-производители); `SelectResourceModel.amount` — новый маркер на `toModel` (nesting-safe); при нехватке бюджета —
   строка реестра «ждёт», не полумера.

## 0. Рабочее дерево
1. `git log --oneline -1` → `3035d58c4c`; `git status --short` — 46 файлов соседа TR55 (диагноз 10). **ДО первого касания:** `ListAgents` → `SendMessage` соседу: какие файлы берёшь
   (минимум `CardName.ts`, манифест, три json локали, `lore_texts.json` ×2, `generate.ts`, `consoleStart.ts`, `consolePlayedHero.ts`, `consoleActionCommitMotion.ts`, `premium_card.less`,
   `console_variant_choice.less`), и договорись о порядке коммитов. Коммиты — ПО ХАНКАМ через временный индекс (`split-commits-by-hunk-temp-index`, `git-temp-index-race`,
   `git-commit-editmsg-shared`: `COMMIT_EDITMSG` общий — read-tree → commit ОДНОЙ командой, коммит анонсировать соседу). Никогда `git stash` (`never-git-stash-with-mixed-changes`),
   никогда `git add -A`. Не пушить.
2. Снапшот e2e — свой: `npm run e2e:snapshot tr54` + `TM_E2E_ROOT=.e2e-tr54`; A/B на одном снапшоте (`ab-baseline-head-client-in-snapshot`); красный с аннотацией `build` STALE — не твой.
3. Фикстуры: ТОЛЬКО свои JSON (`e2e-fixture-generator-gotchas` — полный regen перемешивает все Redux-фикстуры; имя в `FixtureName` ДО сборки).

## 1. Сервер
1. `src/server/cards/turmoilRedux/OverclockedEquipment.ts` — класс `Card`, заголовок файла = чтение скана + правила 1–12 (как `NuclearWarheadUtilization.ts:15–62`); `requirements:
   {party: PartyName.INDUSTRIALISTS}`; `behavior: {spend: {energy: 3}}`; экспорт `OVERCLOCKED_ENERGY_PRICE = 3`; `bespokePlay` → `this.resourceChoice(player)` (побочно-свободный
   строитель ШЕСТИ `SelectOption`, форма `Astrodrill.standardResourceOptions`; `amount = Math.max(0, player.production.get(res))`; `gainStock(player, res, amount)` с базой ПОСЛЕ цены для
   энергии — в `bespokePlay` цена уже списана, в превью — вычесть явно; `.markChoiceContext(cardEffect(this, undefined, 'reward'))`; опция с нулём — `withMetadata({...gainStock, futile})`
   через серверный вердикт); `cardPlayPreview` → `actionPreviews.orBranches(this, шесть BranchSpec: effects [stockCost(ENERGY, 3), чип получения], futile на нулях)`;
   `countedPlayForecast` (TR45 — те же чипы + базис производства); `unplayableReason?()` ТОЛЬКО если лестница `spend` не называет энергию сама (диагноз 7а). Проверить порядок:
   цена `spend` исполняется ДО `bespokePlay` (`Executor.ts:382` — остаток поведения после списания) — спеком.
2. `CardName.ts` (`OVERCLOCKED_EQUIPMENT = 'Overclocked Equipment'`, рядом с `:1128`), `TurmoilReduxCardManifest.ts` (рядом с `:279`), `npm run make:cards` (аудит в нулях),
   `card_info.json` RU-кураторство, `turmoil_redux_cards.json` имя, `lore_texts.json` ×2.
3. Класс «без эффекта» для ОПЦИИ/ВЕТКИ розыгрыша: если `actionFutility.ts` знает только действия/стандартные проекты — добавить ОДИН вердикт для опции стокового получения с `amount
   0` (причина — ключ «No production of ${0}» / «производство 0»), читаемый и веткой превью (`futile`), и опцией живого промта (`OptionMetadata.futile`); клиент НЕ выводит.
4. `SelectResourceModel.amount` (H4): сериализовать на `SelectResource.toModel` — nesting-safe; `Executor.ts:500` передаёт `count`; `GainAnyResourceButScienceDeferred` — 1.
   (Клиент считает `current → resulting` зрителя САМ из своей модели — это не «метаданные, которые клиент уже выводит», это правило `server.md` наоборот: число — сервера, база — своя.)

## 2. Клиент — ГЛАВНОЕ
### 2.0 Раскладка `palette` — ОДИН компонент, четыре хоста
- `variantChoiceModel.ts`: `VariantChoiceOption.hero?: {kind: 'resource' | 'production', icon: string}` (иконка-герой плитки — когда у исхода НЕТ печатного узла своего, а есть вид
  ресурса); чистый предикат `paletteOf(options)` — каждая опция несёт `hero`, N ≥ 3, все одной `kind`; спек. `layout: 'palette'` в пропсах `ConsoleVariantChoice`.
- Анатомия плитки палитры (одна на всех профилях, rem): **ГЕРОЙ** — спрайт ресурса консоли (тот же, что в чипах — `iconClassFor(icon)` / `resource_icon--x`; для `production` — в
  производственной рамке того же вида, что `.pcard-prod` на лице) в масштабе СЦЕНЫ (×1.4 на 1080, ×1.7 на TV — как печать плитки-исхода, `--vchoice-print-zoom`), голый на стекле плитки;
  под ним **ЧИСЛО** «+N» — самый громкий текст плитки (`--con-t-body`/TV `--con-t-title`); под ним **ЧТЕНИЕ** `current → resulting` (`ActionEffectChip` через `body`-слот) на шаг
  тише. Квадратная плитка: `flex: 1 1 0; max-width: 7.5rem (TV 8.5rem); min-width: 4.6rem; aspect-ratio ≈ 1 / 1.25` — шесть РАВНЫХ плиток делят ряд и ужимаются до минимума; ниже
  минимума — `@container` группы складывает 3 + 3 (handheld). Ряд центрирован, зазор .5rem. Ширину колонки каждого хоста ИЗМЕРИТЬ (fhd / 4K / Deck) и зафиксировать в документе.
- Три факта, три краски — без изменений: курсор = холодный подъём + циановое кольцо; ответ = печать в углу + мятный кант, остальные ОТСТУПАЮТ (opacity + волос масштаба); тихая (нуль) —
  герой на шаг назад, число приглушено, строка «○ …» на своей плите внутри; `off` — печать блёклая, причина внутри. Никакого `filter`.
- «ИЛИ» — решение 5: медальонов нет (`exclusive` остаётся для `compare`); кикер группы «ВЫБЕРИТЕ ОДИН» + глиф «?» (`wild.png` — тот же спрайт, что на лице) в его начале (одна печать, ноль layout при выборе).
- Навигация: в ряду ←→ (как `compare` — ось измеряется с `offsetTop`, `data-variant-axis`), ↑↓ покидают группу; при 3 + 3 — ↑↓ между рядами; бар «◄► Ресурс». A = печать, коммит —
  вторая осознанная кнопка (A CHOICE IS A PRESS). Колонка решения СЕЛИТСЯ (`settledColumn`) — выбор ничего не двигает.
- Входит в `tests/console/variantChoiceModel.spec.ts` (палитра / не палитра, тихие, герои) и `tests/client/components/console/ConsoleVariantChoice.spec.ts` (рендер палитры).

### 2.1 H1 — композер розыгрыша (TR54, первый хост)
`ConsolePlayCardConfirm.vue`: когда все ветки «ИЛИ» — стоковые получения разных ресурсов (чип получения — первый не-общий чип ветки, `icon` ∈ шести стандартных) → `variantOptions`
несут `hero`, `layout="palette"`; общий чип цены — над рядом (`sharedVariantEffects`, уже есть); `branch.futile → quiet` (проверить, что композер розыгрыша читает `futile` ветки —
диагноз 9); заголовок результата «ВЫБЕРИТЕ РЕСУРС». «ПОЧЕМУ» (`ConsoleCountedWhy`) — ОДНА строка над рядом «= ваше производство каждого вида» (не шесть повторов; PL-196 —
одночленный счёт = глиф и число); при фокусе плитки — число «+N» уже есть на ней.
### 2.2 H2 — композер действий (Astrodrill — вложенный `or` стоковых получений)
Вложенный шаг через `orOptionDoor` → список композера: когда опции шага — стоковые получения (`OptionMetadata.resourceGain` с `effects` одного вида) → `layout="palette"` (герой из
`metadata.icon`); кикер шага — заголовок OrOptions («Выберите ресурс»); перевести `console-action-resource-pick.spec.ts` (его утверждения «шесть строк через `ActionEffectChip`» →
«шесть плиток палитры в ОДИН ряд, иконка-герой ≥ чипа на ступень, выбор печатью, коммит одним POST, ряд рельса тикает на касании»); пересъёмка стенда fhd + tv4k.
### 2.3 H3 — композер действия Индустриалов
`ConsolePartyActionComposer.vue:196–226`: оба ряда — `layout="palette"` с `hero: {kind: 'production', icon}`; «−1» — шесть плиток (у кого производство на минимуме — `off` с причиной
сервера, как сейчас), «+1» — две; чип производства остаётся чтением под героем; `con-pact__total` — без изменений; хуки `data-pact-opt` сохранить (контракт живости e2e
`console-parliament-actions`). Снять 4K «до» и «после» (кадра «до» нет — диагноз 4).
### 2.4 H4 — живой промт `resource` (последним, решение 9)
`ConsoleTaskHost.vue:277–287`: `con-task__tiles` → `ConsoleVariantChoice layout="palette"` над `include` промта; герой — ресурс, число — `SelectResourceModel.amount`, чтение —
`current → resulting` из модели зрителя; плита — семейство модалок (`.con-prompt--gain`, `ConsolePromptHead` с источником из `choiceContext`); регистрация в `consoleLeakDetector`
не меняется (хост тот же); спек хоста с моделью (`tests/client/components/console/ConsoleTaskHost*.spec.ts` — образец соседних шагов). Если бюджет кончился — строка реестра
«ждёт» с кадром «до», не полумера.
### 2.5 Жетон рождается на печатном «?»
`consoleActionCommitMotion.ts`: игла `'wild': ['wild']` в `ICON_NEEDLES`; в `resolveIconPoints` — ступень: ресурс спека не напечатан на ряду (`matching.length === 0`) → k-я печатная
WILD-иконка области (`iconMatches(el, 'wild')`), и только потом `undefined`; то же в `resolveResultIcon('resources')`. Сцена приземления (`consolePlayedHero.ts`): лестница источника
стоковых наград розыгрыша — та же ступень (найти функцию — диагноз 6). Для TR54: цена «−3» с ряда энергии ВБОК → в печатную «−3 ⚡» ДО взлёта (PL-107, `shipStockSpends`); карта
взлетает и садится; награда «+N» рождается на печатном «?» лица (первом, голом — не в рамке производства) → садится на чернила ряда выбранного ресурса (PL-094), ряд тикает на касании;
выбрана энергия — на одном ряду два жетона в порядке причин: сначала «−3» (до взлёта), потом «+N» (после посадки). Проверка обещания против двух видов — `verifyRailReward` (ряд,
двинувшийся иначе, не летит и называет себя). Спеки: `tests/client/console/*commitMotion*` (иглы/ступень WILD — чистые функции), `playedHeroRail.spec` § TR54.
### 2.6 Цена «−3 энергии»
Подтвердить диагноз 7 (а–в) и закрыть дыры: чип цены в превью (декларативная часть ИЛИ bespoke `stockCost` в каждой ветке — но ОДИН путь, не два), причина руки «нужно 3 энергии»
(ключ существующий — grep «energy» по `unplayableReasons.ts`/локали ДО нового), такт поставки — e2e-свидетель (§4).

## 3. Лицо, локаль, лор, арт
1. `renderData` по чтению скана; `description` — текст карты слово в слово; `make:cards` → `card_info.json` RU: «Требуется, чтобы Индустриалы правили или 2 ваших делегата на их
   резолюции. Также заплатите 3 энергии. Выберите вид стандартного ресурса. Получите столько этого ресурса, сколько у вас его производства.» (канон: РТ / ПО / метка; «стандартный
   ресурс» — как в `Gain ${0} units of a standard resource`).
2. Спрайт «?» — НЕ трогать (решение 4): `assets/resources/wild.png` как есть; он же — глиф «?» кикера палитры (§2.0) и плашки руки (решение 7): ОДИН файл, ОДИН смысл.
   Проверить лишь, что на 4K печать ×1.7 и глиф кикера читаются чётко (512² хватает).
3. Производственная рамка с «?» — проверить на лице (thumb / normal / zoom) и в плитке-исходе (если когда-нибудь режется) — рамка та же, что у любого производства.
4. Лор — решение 2; арт — решение 3 (первая строка отчёта).

## 4. Тесты
1. `tests/cards/turmoilRedux/OverclockedEquipment.spec.ts` — правила 1–12 (стол `table()` по образцу TR55 — `turmoilReduxExpansion: true`, `seatEnacted(parliament,
   quietResolutionOf(INDUSTRIALISTS))`; производства разные: M€ −1 (нуль названный), сталь 2, титан 0, растения 3, энергия 1, тепло 4; энергия 5 → после цены 2 → выбор энергии даёт 3;
   `runAllActions`; чистота превью; порядок веток = порядок опций; адрес `or`; `futile` на титане и M€).
2. Гарды-ворклисты зелёные: `cardPlayPreviewCoverage`, `cardPlayReplayCoverage`, `countedPlayForecast`, `choiceContext`, `promptMarkerGuard`, `cardInformation`, `requirementProse`,
   `effectExtraction`, `premiumCardViewModel`, `premiumCardIcons`, `effectForecastCoverage`, `actionFutility` (новый вердикт опции), `readingParamsGuard`, `glyphLiteralGuard`,
   `e2eLiveness` (переведённые стенды), `universalSiblingSelectorGuard`, `consoleTvTypeFloor`.
3. Клиент: `variantChoiceModel.spec` (палитра), `ConsoleVariantChoice.spec` (рендер `palette`: герой, число, тихая, печать), спек ступени WILD (чистые функции `consoleActionCommitMotion`),
   `playedHeroRail.spec` § два жетона на одном ряду в порядке причин, `consolePlayCardComposer.spec` § палитра из шести веток + `futile → quiet`, спек хоста H4.
4. e2e `tests/e2e/console-overclocked-equipment.spec.ts` (fhd + tv4k, `--workers=1`, `TM_E2E_GPU=1` для таймингов): **A** `overclocked-equipment` (Индустриалы правят, TR54 в руке,
   20 M€, энергия 5, производства как в п. 1) — палитра: шесть плиток в ОДИН ряд (равные `offsetTop`, ничего не обрезано, группа внутри колонки — `expectFits`), герой ≥ чипа на
   ступень (измерить box), титан и M€ тихие (`data-vchoice-quiet`, не `off`, не скрыты — шесть `role=radio`), ←→ ходит по ряду (`data-variant-axis="row"`), A = печать (не курсор),
   колонка не прыгает (`settledColumn` — top до/после ±2 px); коммит: свидетель `armTransferWitness` — «−3 ⚡» родился на `rail:energy`, ушёл вбок (y в пределах ряда), поглощён на печатной
   «−3 ⚡» лица ДО взлёта (образец `console-aerial-mappers` B / X87), ряд тикнул на отлёте; после посадки «+3 [растения]» родился на печатном «?» (`source: wild`), сел на `rail:plants`,
   ряд тикнул на касании, `endsOverGlass` пуст; сервер: энергия 5 → 2, растения +3. Второй прогон A′ — выбор энергии: на ряду два жетона, «−3» раньше «+1», итог 2 → 3.
   **B** `overclocked-equipment-locked` (Красные правят, резолюция Индустриалов на столе без делегата синего) — «✕», партия и обе дороги; **B′** та же рука с 2 энергии — «✕ нужно 3
   энергии» (один блокер). **C** — Astrodrill через существующий стенд, переведённый (§2.2). **D** — `console-parliament-actions` переведён (палитры Индустриалов, 4K кадр).
   Раскадровка 4K GPU (`TM_E2E_STORYBOARD=1`) — приёмка полёта (память `storyboard-catches-what-the-probe-passes`).
5. `npm run build:test`, `npm run lint`, `npm run e2e:affected` + перечисленные; юниты — на тихой машине, последовательно.

## 5. Визуальная приёмка = ОСМОТР (чеклист §7; **4K первым**; Deck — регрессия)
Кадры «до/после» в `screenshots/tr54/{fhd,tv4k}/`: (а) палитра композера розыгрыша — ряд, герой, тихие нули, печать, курсор; (б) раскадровка коммита: «−3» вбок в печатную цену →
взлёт → посадка → «+N» с печатного «?» → чернила ряда; (в) Astrodrill — шаг палитрой (сравнить с `tv4k-1-resource-step.png` — ДО); (г) Индустриалы — два ряда палитрой (ДО снять
самому); (д) H4 — живой промт на семейной плите; (е) лицо с «?» ×2 (голый + в производственной рамке) thumb / normal / zoom; (ж) Deck 1280×800 — 3 + 3,
ничего не обрезано. Каждый кадр — своим глазом (`review-own-artifacts-dont-dismiss-anomalies`): «странный 2», обрезанная печать, герой меньше чипа, медальон-призрак — дефект, не шум.

## 6. ПОЛИРОВКА ПО ПУТИ (здесь бюджет итерации = палитра во всех хостах; остальное — по пути, с кадром)
1. **Плашка руки «[?] до +N»** (решение 7) — `handForecastPlate` читает `countedPlay` с потолком; глиф «?» — тот же файл.
2. **«ПОЧЕМУ» палитры** — одна строка над рядом; при фокусе плитки — без второго «почему» (число уже на плитке).
3. **Кикер группы с «?»** — зеро-layout; на `compare`/`list`/`column` не появляется.
4. **Реестр**: открытые визуальные строки, которых коснётся палитра, — проверить и закрыть/перевести: PL-171 (одна потеря — один голос), PL-196 (одночленный счёт), PL-237/PL-274…279
   (плитка-исход), PL-338/339 (колонка не скачет); новые — в свой раздел.
5. Если по пути всплывает «жетон из плиты» у ДРУГОЙ карты с печатным «?» (Astrodrill — награда «любой ресурс» после выбора) — та же ступень WILD закрывает её; кадр — в отчёт.

## 7. Режим работы
1. Читать до кода (список выше); диагноз подтвердить файл:строка на своём HEAD; снять кадры «до» (4K Индустриалов — обязательно).
2. Порядок: сервер карты + спек → лицо/локаль/лор → палитра (`palette` в компоненте/модели + H1) → ступень WILD + цена PL-107 → H2 (перевод стенда) → H3 → H4 → e2e → реестр/доки.
   Каждый шаг — коммит по ханкам, анонс соседу.
3. **Реестр:** последний раздел **AR** (PL-369, PL-410…430), footer «Следующий свободный номер **PL-431**»; промт TR55 зарезервировал раздел **AS** — TR54 берёт **следующую
   свободную букву в момент записи** (AS, если сосед ещё не записал; иначе AT) и номера с текущего footer по `grep` — объявлять В МОМЕНТ записи (сосед правит реестр прямо сейчас).
4. Документ контракта: `docs/TURMOIL_REDUX_OVERCLOCKED_EQUIPMENT.md` (карта + §«ПАЛИТРА» — анатомия, хосты, измеренные ширины, таблица «до/после» как в `variant-choice.md` §3) +
   абзац в `docs/claude/console/variant-choice.md` (четвёртая раскладка) + строка в `.claude/rules/console-ui.md` § THE VARIANT CHOICE («`palette` — N исходов одного вида, герой —
   иконка ресурса, без медальонов») + строка в чеклист §4 («ВЫБОР СТАНДАРТНОГО РЕСУРСА — палитра») + запись в `turmoil-redux-cards-progress.md`.
5. Отчёт владельцу: первой строкой — арт; затем кадры 4K «до/после» по хостам, измерения (ширины, box героя vs чипа, тайминги A/B PL-107), список решений 1–9 с тем, что сделано
   по умолчанию, ОДИН батч вопросов `AskUserQuestion` в конце (решения 5, 7, 9 — с рекомендацией первой; 4 решено), гэпы честно.
6. Не пушить. Коммиты — временный индекс по ханкам; `COMMIT_EDITMSG` общий. Перед коммитом UI — `npm run e2e:affected`.

## 8. Нельзя
- Детектировать промт/шаг по заголовку (палитра читается по `OptionMetadata.resourceGain` / `hero`, живой промт — по `type: 'resource'` + `amount`-маркеру).
- Авто-выбор единственного ненулевого ресурса; скрывать нулевые плитки; красить нуль янтарным; `filter` на любом состоянии.
- Считать `amount` на клиенте (число — сервера; клиент выводит лишь `current → resulting` зрителя там, где сервер его не шлёт — H4).
- Вторая грамматика «выбери ресурс» рядом с `ConsoleVariantChoice` (ни своя сетка в хосте, ни `con-task__tiles` рядом с палитрой).
- Медальоны «ИЛИ» ×5 в палитре (решение 5); ширины в `vw`/px без `conUiScale`; `title`-атрибут; литерал кнопки (глиф — `GamepadGlyph`).
- Жетон из ничего: нет видимого печатного «?» → честная деградация (тик + чип), названная в трейле; `setTimeout` вместо холда.
- Ломать селекторы стендов без перевода в том же диффе (`e2eLiveness`); полный regen фикстур; `git stash`; bare `git push`; переписывать RU чужих ключей.
- Трогать `wild.png` / `wild-std.png` / десктоп; класть `Standard Resource.png` в `assets/` или добавлять иконку «?» вторым файлом.
