# ACTION FOCUS (iteration 6) — one workflow surface, no more confirm modal

**«Действия карт» — ОДНА поверхность с двумя presentation-состояниями**
(`consoleActionFlow.ts`: browse → focus → (pick) → committing), а не список +
отдельная центр-модалка подтверждения:

- **BROWSE** — досье-колонка СЛЕВА (фикс-ширина `flex: 0 0 34%; max-width:
  30rem`), список вариантов СПРАВА (`flex: 1`). Компоновка НАМЕРЕННО зеркалит
  focus-стадию: досье якорится на **МИНИАТЮРЕ карты** высоко в колонке
  (kicker → имя → вариант → КАРТА → вердикт под ней) — миниатюра уже стоит
  там, куда сядет hero-карта фокуса, поэтому FLIP входа = короткое
  «осаживание» (~25–100 логич. px), а правая половина читается как «варианты
  ⇄ решения». `ConsoleCardFaceLite` в `__detail-card` (`data-zoom-slot` —
  physical origin для X-inspect: миниатюра физически раскрывается в
  fullscreen досье и возвращается в слот). Крупный ДУБЛЬ схемы действия из
  панели удалён (схема читается на focused-тайле; полные структурные чипы
  «будет списано / вы получите» остались); text-override действия сохраняют
  свой ЕДИНСТВЕННЫЙ полный текст (`__detail-text`).
- **ACTION FOCUS** — A больше не открывает модалку: тот же фрейм
  РЕКОМПОНУЕТСЯ вокруг выбранного действия (`consoleActionFocusMotion.ts`:
  browse-слой уступает [autoAlpha, DOM жив — фильтры/выбор/скролл переживают
  по построению], миниатюра **FLIP'ует** в hero-карту стадии, колонка решений
  поднимается; B — обратное движение, FLIP назад в миниатюру).
  `ConsoleActionComposer` СТАЛ этой стадией (`--stage`: absolute в
  `__stagewrap`, панель без собственного стекла — хром несёт фрейм) — вся
  логика захватов/оплаты/веток/Viron нетронута. Шапка фрейма в focus =
  breadcrumb «ДЕЙСТВИЯ КАРТ › НАСТРОЙКА ДЕЙСТВИЯ» + имя карты + чип
  «Вариант N/M» (публикуется через `consoleActionComposerUi.mode`).
- **CTA-док**: подтверждение вынесено ИЗ скролла в закреплённый док
  (`__ctadock`) — выход операции всегда на экране; при недоступном CTA
  honest-hint называет ПЕРВОЕ недостающее решение (`firstMissingChoice`).
  Под hero-картой — живой чип ресурса на карте (`__cardmeta`).
- **Грамматика (унифицирована с play-композером): X = ТОЛЬКО «Осмотреть»**
  (source-карта в main, focused-кандидат в card-саблисте) — X-quick-confirm
  УБРАН; подтверждение = ТОЛЬКО A на CTA-ряду; A на amount/spendHeat =
  «Далее» (шаг к CTA). Все command-run'ы строит чистый
  `focusCommandRun`/`browseCommandRun` (consoleActionFlow) — бар не может
  разойтись со стадией; committed hold публикует честное «Выполняется…».
- **Pick-контекст**: hand/tableau pick несут `source: {kicker, card}` —
  рука показывает чип `__pickctx` («НАСТРОЙКА ДЕЙСТВИЯ · <карта>»),
  категорийный вид «Разыграно» — то же в кикере. Композер по-прежнему
  v-show-прячется (захваты переживают roundtrip).
- **Commit**: `data-motion-surface="action-composer"` остался на стадии —
  awaiting-hold и phase-FLIP в task-host (Helion) работают byte-в-byte.
  **DECK-CHECK действия (Search For Life / Asteroid Deflection System) НЕ
  уходят в standalone reveal-оверлей — стадия получает СОБСТВЕННУЮ фазу
  «Действия карт › Результат вскрытия»**: при confirm ветки с `reveal`
  родитель ставит `revealFlow` + `setConsoleActionRevealClaim(card)`
  (consoleActionComposerUi) — шелл при awaiting-resolve НЕ закрывает центр и
  ГЛУШИТ standalone `consoleRevealMode==='result'` ровно для этого reveal.
  Правая колонка уступает reveal-зоне: слот (px-точный rect посадки,
  `--arz = 1.02×ui`) + статус «ВСКРЫВАЕМ КАРТУ»; `consoleActionRevealMotion`
  тянет карту РУБАШКОЙ из HUD-колоды (`.con-deckstack__pile`, дуга через
  разные eases x/y, z 11600 — ПОД HUD, выныривает из-за колоды), flip НА
  МЕСТЕ ждёт `notifyPayload()` (payload = `playerView.lastReveal`, ловится
  родителем по claim); на середине flip — `onFaceShown` → статус
  кроссфейдится в вердикт ✓/✕ (+reward-чип, +ПО) и слот получает
  зелёную/красную рамку; `onSettled` — прокси и реальная карта меняются в
  ОДИН flush. Хиро-карта слева НЕ движется — операция читается одной сценой.
  Команды: pending → «Вскрываем карту…» (disabled), settled → A OK / X
  Осмотреть (осмотр = physical origin из слота `revealed:<name>`). OK →
  `reveal-ack` → шелл ставит dismissedRevealKey + снимает claim → возврат в
  ОБНОВЛЁННЫЙ browse (действие уже «Активирована»). Safety: awaiting-timeout
  и любой unmount снимают claim (`resetConsoleActionComposerUi`); reduced
  motion — без полёта/flip, статус→вердикт коротким фейдом, порядок
  колбэков тот же. Standalone `ConsoleRevealOverlay` 'result' ЖИВ как
  fallback для reveal вне стадии.

Гварды: `consoleActionFlow.spec.ts` (стадии + command-run'ы),
`composerRender.spec.ts` (stage-рендер / CTA-док / hint / X→inspect-source /
A-Далее / cardmeta), `consoleCardActionsFocus.spec.ts` (mount: A→стадия в
фрейме, browse parked + фильтры/фокус переживают, B→восстановление).

---

# Console composers — polish pass (iteration 4): re-select · command bar · bot name · colour dot

Three defects across the PLAY + ACTION composers, all fixed:

1. **Re-select a chosen variant/option (A must never be mistaken for play).**
   The PLAY composer's A was a focus-INDEPENDENT smart primary (plays when
   ready) — so on a resolved pick you couldn't re-open it (A played), and worse,
   the player couldn't tell whether A would change or play. Fix: **A now acts on
   the FOCUSED row**, and there is an explicit, focusable **«Разыграть» CTA row
   drawing the Ⓐ glyph** (strong ready/focused states) — A plays ONLY when the
   cursor is on that CTA. On a card/player/or/tabbed pick A opens/re-opens the
   picker («Выбрать»/«Изменить»); on a variant/amount/heat row A advances toward
   the CTA («Далее»). After a pick, focus auto-lands on the CTA (so a ready card
   shows «Ⓐ Разыграть»), and ↑ back to a pick shows «Ⓐ Изменить» — the bottom bar
   always names the focused row's A verb, so A can never silently play when the
   player meant to change. **Y is NOT used** — it is globally reserved for the
   information panel (a spec guard asserts `playComposerFootHints` never emits a
   `inspect`/Y control). The ACTION composer already had the honest model (A =
   act on focused / open pick, X = Confirm) — unchanged. Unified CONCEPT:
   *committing (play/confirm) is a control DISTINCT from A-on-a-pick, and what A
   does is always exactly what the focused row + the bar say.*

2. **Bottom command bar was wrong (X «Разыграть» + static LB/RB in pure-auto).**
   The shell's `commands()` for `pendingPlayCard` was a HARD-CODED, diverged list
   (`{control:'secondary'→X, label:'Play now'}` — but A plays, X inspects — and a
   fixed LB −1 / RB +1 even with no alt-resource payment). Fix: the composer
   PUBLISHES its live, contextual `playComposerFootHints` to a reactive store
   (`consolePlayCardUi`, mirroring `consoleColoniesUi`); the shell reads them
   verbatim → the bar can't lie. The composer's now-redundant INLINE footer was
   removed (hints live only in the ONE bottom bar — the colonies contract).

3. **Bot name leaked as «MarsBot» + missing target colour dot.** (a) The Automa
   seat rendered its canonical `MarsBot` in every prompt/log/notification: a
   PLAYER data token resolved via the raw name map. Fixed at THE one place a
   PLAYER token becomes text — `translateMessage` (`i18n.ts`) localizes a bot
   colour through the `'MarsBot'` key («Бот»); global, covers both composers +
   journal + notifications. Also the ACTION composer's `playerName` now routes
   through `displayNameForColor` (it read raw `.name`). (b) The colour dot didn't
   show: `.con-composer__opt-dot` set `background: currentColor`, overriding the
   `player_bg_color_*` class → the dot painted the row's text colour (unreadable),
   and some steal previews carried the chip metadata WITHOUT `player.color`.
   Fixed: the dot relies on `player_bg_color_*` (neutral ring + glow), and
   `buildOrItems` derives the target colour from the option TITLE's PLAYER token
   when metadata omits it (robust for every "… from ${player}" option).

4. **No auto-select of a lone target + the impact names WHICH resource.** The
   console composers auto-CAPTURED a single-candidate card target in `seedChoice`
   (marking it resolved) — so the player could press A and play WITHOUT ever
   consciously choosing where the resource goes (violating the fork's
   non-negotiable no-auto-select rule). Removed the lone-candidate card
   auto-capture in BOTH `ConsolePlayCardConfirm` and `ConsoleActionComposer`
   (amount/heat/payment keep their visible, editable defaults). Now a card/
   player/or target starts UNRESOLVED, focus lands on it («ВЫБЕРИТЕ …» + the CTA
   not ready), and A opens the picker — the choice can't be silently skipped.
   Also the PLAY composer's «N → M» impact was icon-less (the action composer
   already showed it): added `impactIcon` to its pick-list items + the resolved
   decision row (`c.cardResource` / `model.icon` / a tabbed target's icon, +
   `icon` on `ConsoleTabbedTarget`), so a floater add reads «[аэростат] 0 → 2».

Tests: `consoleOrChoice.spec.ts` (+2: title-token colour fallback + metadata
precedence; tabbed target `icon`), `consolePlayCardComposer.spec.ts` (+2: A
shows the focused-row verb / never emits a Y control). Gates: vue-tsc + `tsc
--build tests` + eslint + make:css + webpack — all green; `i18n.spec` unaffected.

---

# Console PLAY-card composer — desktop parity (iteration 3)

**Тот же класс проблемы, теперь в РОЗЫГРЫШЕ карт** (скриншот «Наёмные налётчики»:
голое «Эффект карты будет применён после подтверждения» без pre-select). Desktop
уже пре-собирает on-play выборы в `HandCardPaymentContent.vue`; console
(`ConsolePlayCardConfirm.vue` + чистый `consoleOrChoice.ts`) теперь зеркалит это.
Что починено:

1. **`or`-опции с metadata → premium OPTION-КАРТОЧКИ** (не голый title). Каждая
   опция HiredRaiders/Sabotage/AirRaid показывает `OptionMetadata` чипами
   (иконка ресурса + `current→resulting` + цвет-точка игрока + tradeoff) —
   `buildOrItems` синтезирует чип из `effects`/`player`/`global`/`resource`
   (зеркало desktop `ModernOptionPicker`). Скриншотный fallback был follow-state:
   `buildOptions` вернул `undefined` (нет валидных целей) — теперь при наличии
   целей рендерится premium список.
2. **NESTED-input опция (`SelectPlayer` прямо в OrOptions — CometForVenus) →
   sub-pick**, ответ вкладывается: `{type:'or', index, response:<nested player>}`
   (`orItemResponse`). Раньше такая опция была немой строкой.
3. **`tabbedTargets` (Virus «убрать ≤2 животных ИЛИ ≤5 растений») → две вкладки**
   (`buildTabbedTargets`): животные-карты (impact из счётчика карты, вкладка
   amber) + растения-игроки (impact `current→resulting`, вкладка mint), каждая
   цель несёт свой byte-identical top-level `{type:'or', index, response}`.
4. **`disabledOptions` → серые non-selectable строки** с причиной (защищён /
   пусто) — как desktop.
5. **`mergeCardSteps` / `dedupeFromSteps` (AstraMechanica, Cyberia Systems) →
   честный follow-up** (`multiCardBranch` computed): не пре-собираем (desktop тоже
   отправляет их board-pick'ом), но НЕ роняем — идут native follow-up'ом.

Payload-инвариант (byte-parity, `buildPlayCardBatch` ≡ desktop
`submitPlayCardBatch`): `[play, ...preSteps, <branch slot>, ...stepResponses]`, где
step-ответ tabbedTargets/or — top-level `{type:'or', …}`.

Гарантии полноты покрытия:

- **`tests/models/consolePlayPreviewCoverage.spec.ts`** — итерирует КАЖДУЮ in-scope
  карту с хуком `cardPlayPreview`, классифицирует каждый step (`inline` /
  `followup` / `gap`) и ПАДАЕТ на любом `gap` (форма, которую console не может
  пре-собрать). Результат: 0 gaps.
- **`tests/client/components/console/consoleOrChoice.spec.ts`** (5) — чистые
  `buildOrItems` (leaf+metadata / nested / disabled), `orItemResponse` (leaf vs
  nested), `buildTabbedTargets` (animal+plant с byte-identical ответами).
- **`consoleActionComposer.spec.ts`** (+2) — captured `tabbedTargets`-ответ в
  порядке шагов + `tabbedStepsOf`.

Честная граница: board/colony placement on-play (напр. карты с плиткой) —
follow-up на ОБЕИХ платформах (документированное approved-исключение).

---

# Console Blue Card Action Center — desktop parity matrix (iteration 2b)

**Итер.2b фиксы (после провала подачи веток):** (1) ветки многовариантного действия
(Robinson Industries и др.) рендерятся как premium OPTION-КАРТОЧКИ с per-branch
чипами `current→resulting` — точное зеркало desktop-radiogroup, а НЕ голый текст за
«review-рядом» (`.con-composer__branch` инлайн; тест `composerRender.spec.ts`).
(2) premium под-списки card/player/or (иконки ресурсов + impact `N→N+k` + причины).
(3) серверные additive-хуки убрали 2 «bare confirm» dynamic-карты (JovianLanterns,
BioengineeringEnclosure) и невидимый gain (PowerInfrastructure `result`) — улучшает
desktop И console. (4) СТРОГИЙ coverage-страж `actionPreviewCoverage.spec.ts` («no
mute branch»): каждая in-scope action-карта с ресурсами/тегами обязана дать premium
контент (чипы / step / optionInput / reveal / осмысленный title), иначе тест падает
со списком карт. Аудит: все 60+ in-scope action-карт зелёные.

---

# Console Blue Card Action Center — desktop parity matrix (iteration 2)

Контракт: **desktop и console native могут отличаться layout'ом, но не игровым
UX-контрактом.** Если desktop собирает выбор ДО финального submit — console
тоже. Ниже — аудит-матрица по типам action-flow. Desktop-источник истины:
`CardActionConfirmContent.vue` + `PlayerHome.submitCardActionBatch` /
`submitRepeatActionBatch`; console: `ConsoleCardActions.vue` +
`ConsoleActionComposer.vue` + чистые `consoleCardActions.ts` /
`consoleActionComposer.ts` (payload-parity закреплена юнит-тестами
`tests/client/components/console/consoleActionComposer.spec.ts`).

Payload-инвариант (byte-parity, `buildActionBatch` ≡ `submitCardActionBatch`):

```
[wrapped activate pick, ...preStepResponses, <branch slot>, ...stepResponses]
  branch slot: branchIndex >= 0 → {type:'or', index, response: optionResponse ?? {type:'option'}}
               branchIndex < 0 && optionResponse → BARE optionResponse (lone-branch auto-resolve)
```

| # | Flow | Desktop | Console (после итерации 2) | Payload | Preview source | Follow-up после submit |
|---|---|---|---|---|---|---|
| 1 | Simple activate (Каретакер и пр.) | confirm modal, ничего не выбирается | composer без decision-рядов, A = подтвердить | `[activate]` | `/api/action-preview` branch effects | нет |
| 2 | OR branch (Электрокатапульта, Titan Air-scrapping) | ветка выбрана из focused render node (`branchPositionsForNode`), submit `{or, branch.index, {option}}` | тайл-вариант = ветка; composer открывается на ней; branch slot идентичен | `[activate, {or, index, {option}}]` | branches per-node (token-overlap match) | нет |
| 3 | Disabled branch с причиной | ветка показана disabled + reason; недоступный branch не сабмитится | тайл красный + причина на тайле/в инспекторе; A = shake+reason; в composer branch-лист показывает disabled с reason | — | `branch.unavailableReason(+Params)` | — |
| 4 | Amount ДО submit (Hi-Tech Lab / Tycho Magnetics `amountStep`) | ModernAmountSelector в модалке (controlled, capture on mount+change), batch `[activate, {amount}]` | инлайн-степпер в composer (LB/RB/←→ ±1, RT MAX, дефолт min/maxByDefault, capture сразу), live `энергия N→N−k` + `→ карты ×k` | `[activate, {type:'amount', amount}]` (step, позиционный) | `amountStep` с `icon`/`amountResult` | нет (сам SelectAmount больше НЕ приходит follow-up'ом) |
| 5 | Amount как optionInput ветки (Titan Shuttles, Sulphur-Eating Bacteria) | amount NESTED в branch or-wrap | тот же степпер; capture в `capturedOption` | `[activate, {or, index, {amount}}]` | `amountInput` | нет |
| 6 | Payment step (Rotator Impacts «6 M€, titanium может»; Aquifer Pumping; Water Import) | SelectPaymentV2 controlled в модалке, `{payment}` step | payment-lanes substate (чистый `paymentPlan.ts`: лейны/rate/anti-overpay cap/авто-M€/initialCounts), дефолт captured если покрывает | `[activate, <branch slot>, {type:'payment', payment}]` | `paymentStep` (`previewPaymentModel`) | нет |
| 7 | Card/resource-target step (add/remove на карту; `cardResource`+`amount` impact) | ActionTargetCard / hand+board pick-мосты; lone candidate AUTO-selected (но виден) | card-лист substate (кандидаты + disabledCards с reason, X = fullscreen inspect через consoleCardZoom); lone candidate авто-captured и ВИДЕН в ряду; impact `N → N+k` | `{type:'card', cards:[name]}` (step или optionInput) | `selectCardStep` / `cardInput` | нет |
| 8 | Combined-node (1 render node → N веток) | in-modal branch picker (radiogroup, disabled ветки видимы; `selectBranch` сбрасывает captured, НЕ capturedPre) | ряд «Вариант действия» → branch-лист substate; смена ветки пересеивает captures (pre сохраняется) — зеркало | как #2/#5 | `branchPositionsForNode` → все позиции | нет |
| 9 | Self-Replicating Robots | 2 render-ряда ↔ 2 ветки (renderData переработан); optionInput = SelectCard (hosted / hand с ineligible disabled) | 2 тайла с «◈ Выберите карту»; composer: card-лист (disabled с reason, X inspect); lone branch auto-resolve → BARE `{card}` | оба варианта покрыты тестами (`branch pick — nests inside`, `lone-branch — bare`) | `cardInput` в orBranches | нет |
| 10 | Board placement | НЕ pre-collect: honest note, после submit — PlacementBanner | то же: «Далее: размещение на поле» в тайле/инспекторе/composer; board task после submit | placement не в batch | `boardPlacement` step | ДА (легитимный — desktop тоже) |
| 11 | Global parameter capped | chip `current → resulting`, no-effect muted | те же `ActionEffectChip`; в composer предупреждение «Один из бонусов не даст эффекта…» | — | branch effects | — |
| 12 | Activated this generation | статус `activated`, отдельное filter-измерение | фильтр «Активированы» (LT/RT), группа/тайл синие, verdict «Уже активировано в этом поколении» | — | `actionsThisGeneration` | — |
| 13 | Per-variant stats «За партию» | `ActionDetailsPanel.branchScope` → `getActionUsageSummary(stat, {mineTokens, siblingTokens})`; caption «Some stats are tracked at the card level» | `branchScopeForNode` (точное зеркало) + тот же summary + тот же caption-ключ | — | `/api/game/action-stats` + `branchMetricTokens` | — |
| 14 | Spend-heat preStep (Stormcraft-floaters, Caretaker Contract) | SpendHeatContent (controlled): `{and, [{amount: heat},{amount: floaters}]}` ДО ветки | floater-степпер в composer (дефолт fewest-floaters, live heat/floaters split), byte-identical and-response, capture переживает смену ветки | `[activate, {and,…}, <branch>…]` | `preSteps: spendHeatStep` | нет |
| 15 | Repeat action (Viron) | handoff: `repeat-action` → НОВАЯ модалка выбранного действия с `repeatPrefix=[activate(Viron), {card:[X]}]`; `submitRepeatActionBatch` не re-wrap'ит X | тот же handoff: card-лист повторяемых действий → НОВЫЙ composer X с `prefix` (built at pick time — desktop parity), cancel восстанавливает внешний composer (`repeatOuter`) | `[…prefix, …preX, <branchX>, …stepsX]` | step `repeatAction` | как у X |
| 16 | Reveal / deck-check (Search for Life) | reveal slot в модалке; результат ПОСЛЕ submit (RevealResultOverlay) | reward-chip в hero + «Далее: вскрытие карты»; результат после submit — console reveal overlay | `[activate, <branch>]` | `branch.reveal` | ДА (легитимный) |
| 17 | Revalidation | `findPerformActionCard` re-walk при submit (нет → warn, ничего не шлётся); `runId` в batch body | то же re-walk в `onComposerConfirm`; ПЛЮС: refetch preview (fingerprint) сбрасывает captures composer'а — строже desktop | — | — | — |

## Гарантии полноты формулы (renderer)

- Формула тайла = static `ActionEffect`-чипы + **variable-чипы** (диапазон
  `min–max` + иконка) из amount-инпутов. `amountResult`/`conversion` —
  структурные spend→result семантики: парные range-чипы, статический дубль
  (baseline `+1 карта`) ПОДАВЛЯЕТСЯ (`suppress*Icons`). Bare amount → нейтральный
  чип «ваш выбор» (направление не угадывается по тексту — запрещено).
- Non-amount выборы НАЗВАНЫ на тайле («◈ Выберите карту / Оплата / …»), не «X».
- Нет structured-данных вообще → печатная DSL-графика (safe fallback), никогда
  не «красивая но неполная» формула. Guard-тесты: `consoleCardActions.spec.ts`.

## Известные честные границы (обе стороны одинаковы)

- `mergeCardSteps` / `dedupeFromSteps` / `copyProductionBox` / `multiSelect` /
  `tabbedTargets` реализованы ТОЛЬКО в play-модалке (`HandCardPaymentContent`);
  **desktop action-модалка их не потребляет** — консоли нечему быть в парity.
  Если серверный preview однажды начнёт эмитить их для actions — расширять ОБЕ.
- `or`-step с вложенным НЕ-leaf инпутом: не существует в in-scope превью
  (steps-билдеры порождают card/player/amount/or-of-leaf); в console-листе такая
  опция честно disabled. Появится реальный кейс → hosting добавить с тестом.
- EnergyMarket ветка «купить энергию»: 2X M€ оплата идёт follow-up'ом И на
  desktop («rides follow-up routing») — паритет соблюдён.

## Итерация: история за партию → fullscreen inspect (информационная иерархия)

Основной экран «Действия карт» — это surface для РЕШЕНИЯ сейчас, не analytics
dashboard. Накопительный блок «За партию» (активаций / получено / добавлено /
РТ / глоб-параметры / последнее использование) убран из постоянной правой
панели `ConsoleCardActions` (`__detail`) — осталась только решение-релевантная
инфо (вариант N/M, доступность, эффект, «будет списано / вы получите», ресурсы
на карте, причины блокировки) + спокойный хинт `__detail-history-hint`
(«Осмотрите для истории за партию», `margin-top:auto` — без визуальной дыры).

**Данные не потеряны — перенесены в X-inspect как read-only досье с двумя
вкладками** (`ConsoleInspectSide` в `#side`-слоте `CardZoomModal`):
- `ПРАВИЛА` (default — X сохраняет привычную семантику) = `ConsoleCardRulesPanel`
  в новом `embedded`-режиме (свой glass/head уступают tab-боксу).
- `ИСТОРИЯ` = `ConsoleCardHistoryPanel`, два СЕМАНТИЧЕСКИХ блока.
- **LB/RB переключают вкладку** (в inspect-контексте список = одна карта, browse
  свободен — конфликта нет; `handleZoomIntent` роутит `prevSection/nextSection` +
  nav left/right в `setConsoleZoomInspectTab`). Только тело crossfade'ит
  (`con-inspect-swap`, ~130ms, reduced-motion → мгновенно); большая карта /
  backdrop / геометрия бокса стабильны — это swap страницы, не новая модалка. B
  закрывает как раньше, фокус браузера сохраняется.

**Семантика разделения (честная к модели — не выдумывает метрик):**
- `EffectOverlayStat` — CARD-level aggregate; `triggerCount`/`lastTrigger` НЕ
  разбиваются per-branch. → **ИСТОРИЯ КАРТЫ**: текущий ресурс (из tableau),
  всего активаций карты, последнее использование.
- Impact-строки фильтруются per-branch (`branchScopeForNode` +
  `getActionUsageSummary` — ОДИН источник правды, переиспользован). →
  **ВЫБРАННОЕ ДЕЙСТВИЕ · Вариант N/M**: gained/spent/TR/params/draw именно этого
  варианта. Multi-branch → caption «активации на уровне всей карты» (cardScoped).
- Empty states: нет истории → «У карты пока нет истории»; карта хранит ресурс но
  действие не срабатывало → блок карты + «действие ещё не срабатывало»; неприм.
  строки скрыты (никаких `undefined`/лишних нулей).

Разбиение = pure `buildActionInspectHistory` (`actions/actionInspectHistory.ts`,
тестируется под server-runner'ом). Контекст едет через новое поле
`ConsoleZoomExtra.inspect` (snapshot в момент открытия — read-only). Guard-тесты:
`actionInspectHistory.spec.ts` (6), `consoleCardZoom.spec.ts` (inspect + tab +
reset), e2e `console-inspect-history.spec.ts` (fhd end-to-end; 4K — скриншоты).
Scope: только информационная иерархия — flow активации/подтверждения/reveal НЕ
тронут (следующая итерация ACTION FOCUS).
