# Промт исполнителю · T14 Supported Research («Поддержка исследований») — шестая классическая карта Turmoil под Redux, «на месте» (§3.1): зелёная (автоматическая), 3, метка Науки; «Учёные правят ИЛИ 2 ваших делегата на их резолюции»; «доберите 2 карты» — декларативная (`drawCard: 2`), работы ≈ 15 % · ГЛАВНОЕ — БОЛЬШАЯ ИТЕРАЦИЯ ПОЛИРОВКИ PRE-SELECT (≈ 85 %) «ОДИН КУРСОР ПОСЛЕ ОТВЕТА · ПРИБЫТИЕ НА КОММИТ · ЕДИНСТВЕННАЯ ЦЕЛЬ — ПРЕДВЫБРАНА, ПОКАЗАНА, ПОМЕЧЕНА»: (1) после любого ответа в композере курсор САМ встаёт на следующий вопрос, а если вопросов нет — на кнопку розыгрыша / активации, и игрок ТОЧНО видит, что следующее нажатие запустит ход; (2) выбор с ОДНИМ кандидатом (цель, карта, игрок) предвыбран заранее — ряд показывает, куда пойдёт ресурс и что изменится, с тихой премиальной пометкой «единственная цель», и A на ряду по-прежнему открывает выбор (игрок может убедиться, что вариант один); всё — одной грамматикой для ТРЁХ композеров (розыгрыш · действие карты · действие партии) со всеми угловыми случаями

> **Статус: ВЫДАН 2026-10-22.** HEAD `2e15e0f06d` (T04/T06/T09/T08/T12 сданы — 5/22; CB «родословная» сдана; реестр: последний раздел **CB**,
> следующий свободный **PL-891** → эта задача берёт **CC**; сверить footer на своём HEAD). НЕЗАКОММИЧЕННЫЙ лор владельца `T14` в
> `assets/text/lore_texts.json` («Getting World Government grants to advance your technologies» — без точки; гард лора требует точку — добавить,
> текст дословно; коммитить ПЕРВЫМ ханком). Сосед держит незакоммиченный `src/client/console/tilePlacement/consoleTilePlacement.ts` — не трогать.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\T14.png`. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T14 - Supported Research.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t14 …`; exit 2/3/4 → спросить).

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1, `docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T09/T12 (образец §-блоков карты).
**Контракты полировки:** `docs/claude/console/cursor.md` ЦЕЛИКОМ (§ The default cursor ARRIVES, § Composers `:116` — «ONE seed: `resetFromPreview`
sets the cursor synchronously (`commitCursorTarget`)», § Guards, § Adding a surface), `.claude/rules/console-ui.md` § THE CURSOR IS ONE LIVING OBJECT
`:473–480` (пять законов; закон 3 — прибытие; закон 4 — шаг = одна фраза), § AN OPTIONAL CHOICE DECLINES WITH A BUTTON `:207–214` (отказ — RT внутри
выбора; «вопрос, чей ОДИН ответ — выбор, ЕСТЬ этот выбор»), `docs/claude/console/workspace-band.md` § ACTION COMMIT и § WORKSPACE STAGE `:1359`,
`docs/CONSOLE_BLUE_ACTION_PARITY.md` § ACTION FOCUS, CLAUDE.md инвариант 3 («No auto-select, no hidden target» — его эта итерация УТОЧНЯЕТ для
композеров, не отменяет) и инварианты 6, 12, 14; `.claude/rules/game-logic.md` § 🚫 NO AUTO-SELECT `:29–33` (серверная половина — остаётся как есть:
`SelectCard`/`SelectPlayer` с одним кандидатом по-прежнему СПРАШИВАЮТ; предвыбор — клиентский, адресованный ответ батча).
Память: `action-precollect-contract` (превью = обещание о форме живых промптов; батч шлёт адресованные ответы), `console-action-focus-flow`
(ACTION FOCUS: X = только Осмотреть; A на amount = «Далее»; CTA в доке `__ctadock` + честный `firstMissingChoice`), `decline-inside-pick-plan`
(RT — отказ; вопрос с одним ответом-выбором открывается сразу), `console-hand-pick-bridge` (пик из руки — альбом; композеры не размонтируются),
`console-repeat-pick-bridge` (повтор — слотом через «Действия карт»), `variant-choice-outcome-tiles` (плитка-исход; PL-338 «выбор варианта без
скачка»), `prompt-modal-family` (гейт инерции `promptSettleAbsorbs` 300/650/1100 — нажатие «по инерции» поглощается), `gamepad-first-press-reload-boundary`,
`polish-direction-smoothness`, `polish-priority-tv4k-no-deck-only`, `storyboard-catches-what-the-probe-passes`, `batch-decisions`,
`concurrent-session-edits-same-files`, `e2e-only-on-steam-machine`, `e2e-speed-iteration` (TIMING-класс для свидетелей движения),
`e2e-spec-rot-contract`, `shell-template-escapes`. Журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** правило посадки курсора — `console/consoleCommitGate.ts:124–180` (`commitAcceptsCursor`, **`commitCursorTarget` :136** —
`incomplete/stale → blocking.index; ready → commitIndex; иначе undefined`, `commitRedirectTarget :176`, A-глагол бара `:148+`), play-композер —
`ConsolePlayCardConfirm.vue` (`seedChoiceDefaults :3204–3230` — сеются ТОЛЬКО amount / spendHeat / payment, комментарий «NEVER auto-selected — not even a
lone candidate» `:3222`; **`firstActionableIndex :3045`** — первый незакрытый → предложенный вопрос стола → CTA; посадки после пиков `:4724/4748`;
`clickVariant :3864` — курсор ОСТАЁТСЯ на плитке; `primaryAction :3762–3790` — A на неготовом CTA ведёт к первому незакрытому и открывает его;
`lateCursor :1018` — прибытие курсора позднего превью), action-композер — `ConsoleActionComposer.vue` (`resetFromPreview :3636–3664` — посадка на
первую доступную ветку → `seedDefaults` → `commitCursorTarget`; `syncCommitFocus :3652`; `seed` `:3728–3742` с тем же комментарием; `onMainPress
:4258–4275` — A на amount = `focusIdx + 1`; явные прыжки на CTA `:4404/4427/4447/4489` (повтор, блокада…); закрытия под-выбора `this.sub = undefined`
`:3997/4631/4796/4825/5134/5198/5240` — после них `scrollFocused`, но НЕ `syncCommitFocus`), общее правило ветки — `consoleActionComposer.ts:104–125`
(`initialVariantSelection` — ветка сеется ТОЛЬКО когда решения нет: одна ветка или правила сузили до одной), партийный композер —
`parliament/ConsolePartyActionComposer.vue` (своя модель `cursorRow` / `cursor[]`, «CHOICE IS A PRESS» `:28`, ряды решений → ряд коммита последним),
общий ряд цели — `played/ConsoleComposerTargetRow.vue` (пропсы `candidates`, `result`, `resultModel`, `tag`, `impacts`, `focused`, `asker`),
детектор повторного вопроса — `console/preselectWitness.ts` (RE-ASKED PRE-SELECT → красный в каждом e2e), штамп адреса — `tests/console/preselectStamp.spec.ts`,
прибытие курсора — `console/cursorArrival.ts` (гейт `data-cursor-pending`; «INPUT IS NEVER DELAYED»), стили CTA — `console.less:34255–34290`
(`.con-composer__cta--ready` мята + `::after` кольцо слоя курсора, PL-510), e2e — `console-variant-settle` (выбор варианта ничего не двигает),
`console-action-focus`, `console-hand-pick-preselect`, `console-self-target`, `console-player-pick`, `console-action-resource-pick`, `console-cursor`
(`focusWitness.ts` — snaps · bornHidden · jumps · handoffDelta), `console-smoothness`; юниты — `composerRender.spec` («the cursor never reaches the
commit row while a requirement is waiting», «an action with NO requirements is ready and focusable at once», «a LONE amount stepper is FOCUS-FREE…»),
`consoleActionComposer.spec` («lone-branch auto-resolve»), `consolePlayCardComposer.spec`, `composerRuntimeNavigation.spec`, `consoleCardActionsFocus.spec`,
`cursorArrival.spec`, `tests/console/cursorGrammarGuard.spec.ts` (РЭТЧЕТ рукописных правил фокуса — новая краска только через `.con-cursor()`).

---

## Диагноз (подтверждён файл:строка на `2e15e0f06d`; перепроверить на своём HEAD)

### Карта
1. **Тривиальна.** `turmoil/SupportedResearch.ts`: `drawCard: 2`, Учёные, `cardNumber: 'T14'` верен. Добор после розыгрыша — встроенная стадия
   «ДОБОР КАРТ» (дверь `followUp`, `FOLLOW_UP_STEP_STAGES`; e2e `console-play-draw-embed` — класс доказан). Работа: RU (`turmoil_cards.json:45` —
   «Учёные в правящий партии» → «Требует, чтобы «Учёные» были у власти или у вас было 2 делегата на их резолюции. Доберите 2 карты.» — голос
   `turmoil_redux_cards.json:143`), лор RU («Гранты Мирового правительства на развитие ваших технологий.»), арт, `card_info` (декларативная — 0/0/0;
   при `needsCuration` — `infoText`), строка долой (`turmoilReduxAdaptation.ts:45`), пин «as of the last adaptation» (6 из 22), спеки класса «что
   раздаёт стол». **Своего e2e карта не получает** (чеклист §5).

### Pre-select — «умный фокус» работает местами
2. **Три композера — три правила посадки.** Play: `firstActionableIndex` (первый незакрытый → предложенный вопрос стола → CTA) — после пика из
   руки / стола курсор встаёт верно (`:4724/4748`), но после ВЫБОРА ВАРИАНТА остаётся на плитке (`clickVariant :3868`; d-pad-выбор — так же), и
   игрок сам идёт вниз к CTA; A на CTA-неготовом ведёт к первому незакрытому (`:3784`) — хорошо. Action: посадка на открытии через
   `commitCursorTarget` (`ready → CTA`), но после закрытия под-выбора (`sub = undefined`, семь мест) вызывается только `scrollFocused` — курсор
   остаётся на отвеченном ряду; CTA достигается явными прыжками лишь в четырёх ветках (повтор `:4404`, блокада `:4447`, …); A на amount — `+1`
   (`:4270`), не «к следующему вопросу». Party: своя модель `cursorRow` / `cursor[]`. Итог — именно «в некоторых случаях работает, в некоторых нет».
3. **CTA не «прибывает».** Когда курсор всё же встаёт на CTA, это тот же `focusIdx = ctaIndex` + мятная плита `--ready` + кольцо слоя
   (`:34275`): ни одной фразы прибытия, ни акцента «следующее нажатие — ход»; бар читает A-глагол из `consoleCommitGate` — верно, но глагол на
   самой кнопке и в баре не сверены (проверить `con-composer__cta-label`). Нет гейта инерции: курсор, оказавшийся на CTA в кадр ответа, принимает
   следующее A сразу — а на пад-переходах известны «нажатия по инерции» (`prompt-modal-family`, `gamepad-first-press-reload-boundary`).
4. **Единственный кандидат никогда не сеется** (`ConsolePlayCardConfirm.vue:3222`, `ConsoleActionComposer.vue:3738` — «not even a lone candidate»):
   ряд открывается пустым, фокус на нём, A → альбом / список с ОДНОЙ карточкой → A → назад. Два нажатия ради нуля решений. Ветки при этом
   сеются (`initialVariantSelection` — «a ceremony with one door»), amount / heat / payment — тоже. Владелец (2026-10-22): инвариант 3 — про
   СЕРВЕРНОЕ «втихую»; в workspace предвыбор ВИДЕН (куда пойдёт ресурс, `current → resulting`), игрок может нажать и увидеть один вариант —
   значит, сеять, с ненавязчивой пометкой.
5. **Что уже на месте и переиспользуется:** общий ряд цели (`ConsoleComposerTargetRow` — `candidates`, `result`, `impacts`), адресованные ответы батча
   + детектор повторного вопроса (`preselectWitness`), гейт коммита (`consoleCommitGate` — `incomplete` / `stale` / `ready`), прибытие курсора
   (`cursorArrival`), «вопрос с одним ответом-выбором ЕСТЬ выбор» (`optionalChoice`), плитка-исход варианта, свидетель фокуса в e2e.

## Правила карты (спек пинит каждое)
1. Зелёная, 3, Наука; на Redux-столе требование — две дороги, причина руки со standing.
2. Розыгрыш → добор 2 карт (стадия «ДОБОР КАРТ» встроена; карты в руку; журнал — запись добора).
3. Классический стол — апстрим байт-в-байт; раздача под Redux = ранее адаптированные + T14; save / load — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте, батч — §8.4; решения T04 1–6 не переспрашивать)
1. **RU** — имя оставить («Поддержка исследований»); описание — в голос набора; лор RU — как в диагнозе 1.
2. **ОДНО правило посадки курсора** (диагноз 2) — (а, рекомендовано) чистая `nextCursorAfterAnswer(rows, gate, offered)` в `consoleCommitGate.ts`:
   (1) ряд, который ДЕРЖИТ коммит (`incomplete` / `stale` → `blocking.index`) → (2) следующий ПРЕДЛОЖЕННЫЙ, но не блокирующий вопрос (вопрос стола,
   который может ждать добора — нюанс play-композера, `tableQuestionRowOffered`) → (3) CTA. Вызывается на открытии (посадка), после КАЖДОГО ответа
   (пик из списка / альбома / стола / игрока, выбор ветки/варианта, «Далее» на диале, «Готово» оплаты, отказ RT, возврат B из под-выбора с ответом),
   после refetch превью той же формы (`samePreviewShape`), при протухании цели. Все три композера; `firstActionableIndex`, четыре ручных прыжка и
   `cursorRow`-арифметика партийного — через неё; (б) оставить три правила и дописать недостающие прыжки — не класс.
3. **После выбора ВАРИАНТА** с нечем больше отвечать — (а, рекомендовано) курсор шагает на CTA одной фразой курсора (закон 4; содержимое не
   двигается — `console-variant-settle` остаётся истинным: двигается кольцо, не плитки); (б) остаётся на плитке (как сейчас) — игрок ищет CTA сам.
4. **ПРИБЫТИЕ НА КОММИТ** (диагноз 3) — (а, рекомендовано) когда курсор встаёт на CTA ПОТОМУ, что отвечен последний вопрос (или всё посеяно
   на открытии): кольцо ПРИБЫВАЕТ фразой курсора (никогда не «появляется»); CTA получает ОДНОРАЗОВЫЙ акцент «взведено» (`--con-cursor-armed`: мятное
   кольцо делает один вдох ≤ 400 мс × motion через `.con-cursor-paint()` — грамматика `.con-cursor()`, рэтчет `cursorGrammarGuard` не растёт);
   подпись кнопки = глагол хода + цена («Разыграть · 3 M€» / «Выполнить» / «Подтвердить») и бар читает ТОТ ЖЕ глагол из ОДНОГО источника
   (`consoleCommitGate` A-verb); **гейт инерции**: нажатие A, пришедшее до того, как поза курсора на CTA ОКРАШЕНА (окно прибытия `cursorArrival` +
   один кадр), поглощается как прибытие и не отправляет ход; на открытии с полностью посеянным составом — дополнительно `promptSettleAbsorbs`-класс
   (то же окно, что у семейства модалок), чтобы A, открывшее композер, не стало A, сыгравшим карту; в reduced motion — только гейт инерции;
   (б) без акцента — только кольцо и бар.
5. **ЕДИНСТВЕННЫЙ КАНДИДАТ ПРЕДВЫБРАН** (диагноз 4) — (а, рекомендовано) в `seedChoiceDefaults` / `seed` / партийном сидировании: шаг-цель
   (`card` / `player` / `playedTarget` / пик из руки / дверь `orNested` с ОДНИМ листом, который сам — пик с одним кандидатом) с РОВНО ОДНИМ
   ВКЛЮЧЁННЫМ кандидатом сеется этим кандидатом с меткой `seeded: 'sole'`; ряд рендерится как ОТВЕЧЕННЫЙ (имя, миниатюра, `impacts` «было → станет»)
   + тихая пометка «ЕДИНСТВЕННАЯ ЦЕЛЬ» (трекинг-капс, приглушённый тон, хвост ряда; хинт `data-hint` «других целей нет»; не конкурирует с кольцом
   курсора); A на ряду — как и прежде открывает выбор (альбом / список с одной карточкой; у стола — `playedTarget` с одной картой), B — назад с
   сохранённым посевом; батч несёт посеянный ответ адресованным, как любой pre-select (`preselectWitness` ловит повторный вопрос); (б) сеять
   только карточные цели, игроков — нет; (в) не сеять — отклонено владельцем.
6. **Угловые случаи предвыбора (все — в спеках):** НЕОБЯЗАТЕЛЬНЫЙ выбор (маркер `skip` — отказ RT = второй настоящий ответ) — НЕ сеется, ряд
   открыт; единственный кандидат ВЫКЛЮЧЕН (с причиной) — не сеется, ряд показывает причину и держит коммит; MULTI-select (диапазон) — не сеется;
   кандидаты изменились (переключение варианта / refetch не той же формы) — пересев; посеянный кандидат исчез — `stale` → курсор на ряд;
   самоцель («ЭТА КАРТА» — hero единственный) — сеется героем, прокси TR self-target; цель-ИГРОК (атака) с одним соперником — сеется, ряд
   показывает, кто и что теряет (`current → resulting`); дверь с ботом (`orNested`: `SelectCard` | строка бота) — сеется только если единственный лист
   сам однозначен; повтор (Viron) с одной повторяемой картой — сеется слотом (A открывает список из одной); колония (`SelectColony` рядом композера)
   с одной колонией — сеется; размещение на поле — НИКОГДА (остаётся follow-up); пик из руки, где единственный кандидат — сама разыгрываемая карта
   (исключена) → 0 кандидатов → follow-up (как сейчас); посев, который сервер переспросил, — красный `RE-ASKED` (существующий детектор).
7. **Пометка** — (а, рекомендовано) слово «ЕДИНСТВЕННАЯ ЦЕЛЬ» / «ЕДИНСТВЕННЫЙ ИГРОК» в хвосте ряда + хинт; (б) только глиф «1» в кружке; (в) без
   пометки — отклонено («нужна пометка, но премиально»). Макеты (три) CSS поверх живого композера — в батч.
8. **Объём** — карта ≈ 15 %, полировка ≈ 85 %; хост задач (живые промпты), колесо, стандартные проекты — не трогать (своя грамматика; курсор там
   уже под законом TR58).

## 0. Рабочее дерево
1. `git log --oneline -1` → `2e15e0f06d` на выдаче. **Сначала** `ListAgents` + процессы; `SendMessage` живым соседям: твои файлы —
   `turmoil/SupportedResearch.ts` + спек, `common/cards/turmoilReduxAdaptation.ts`, `console/consoleCommitGate.ts`, `console/consoleActionComposer.ts`,
   `console/consolePlayCardComposer.ts`, `console/cursorArrival.ts`, `components/console/{ConsoleActionComposer,ConsolePlayCardConfirm}.vue`,
   `components/console/parliament/ConsolePartyActionComposer.vue`, `components/console/played/ConsoleComposerTargetRow.vue`, `console.less` (CTA, ряд цели —
   через `.con-cursor()`), `console_tv.less`, `ru/{turmoil_cards,card_info,console,ui}.json`, e2e композеров, доки. Коммиты — ПО ХАНКАМ или явными путями;
   `lore_texts.json` — своя строка; после коммита — `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / макеты / сториборды — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t14` → `npm run e2e:remote -- t14 <spec>
   [--exclusive --workers=1]`; кадры «до» — клиент HEAD в `.e2e-t14-before` (`TM_E2E_SHOTS_TAG=before`); `TM_E2E_STORYBOARD=1`; exit 2/3/4 — СТОП и `AskUserQuestion`.
3. **Стенд = спек** `tests/e2e/console-composer-preselect.spec.ts` (TIMING-класс с причиной: свидетель фокуса и прибытия): матрица × {TV, fhd}:
   (а) розыгрыш карты с ОДНИМ кандидатом цели (ресурс на любую карту при одном держателе на столе); (б) с ДВУМЯ (не сеется, ряд открыт); (в) с
   необязательным пиком (не сеется, RT на баре); (г) с выключенным единственным (причина, коммит держится); (д) действие синей карты с одной целью
   (`aerial-mappers`-фикстура: аэростат на единственную карту); (е) действие с диалом («Далее» → CTA) и с одной выбираемой веткой; (ж) действие
   партии с одним держателем; (з) вариант розыгрыша без дальнейших вопросов (курсор → CTA); (и) ИНЕРЦИЯ: A в окне прибытия на CTA — ноль POST, второе
   A — один POST; (к) открытие с полностью посеянным составом — курсор на CTA с первого кадра логически, поза прибывает, A в окне открытия поглощён.
   Пробник: `armFocusWitness` (snaps / bornHidden / jumps), сэмплер `setInterval` читает `data-cursor-pending`, `data-eg…`-подобные атрибуты
   композера (`data-composer-cursor="row:<id>|cta"`, `data-composer-armed`, `data-seeded="sole"`), число POST (`page.route`), подпись бара.
4. Фикстуры — свои JSON (имена в `FixtureName` до сборки): `supported-research` (Redux 2 места, Учёные правят — `seatEnacted(quietResolutionOf(SCIENTISTS))`,
   T14 в руке, M€ ≥ 3), `-locked`; `preselect-sole-*` по матрице (одна карта-держатель на столе / две / необязательный пик / выключенный).

## 1. Сервер — карта (≈ 10 %)
`SupportedResearch.ts` — без правок; RU, лор, арт (`node scripts/import-card-art.mjs "<путь>/T14.png" T14` → `make:cards`), `card_info`, строка долой + пин.
Спек: классический блок остаётся; Redux-блок — правила 1–3 (две дороги; добор 2 — рука +2, колода −2; превью «+2 карты» чисто; save / load).

## 2. Клиент — карта (≈ 5 %)
Плита руки / композер / стадия добора — даром; расхождение = класс.

## 3. Клиент — ГЛАВНОЕ: «ОДИН КУРСОР · ПРИБЫТИЕ НА КОММИТ · ЕДИНСТВЕННАЯ ЦЕЛЬ» (≈ 85 %)
### 3.А Кадры «до» и макеты (первым делом)
Стенд §0.3 на базе (`before`): где курсор оказывается после каждого ответа в трёх композерах (таблица), сколько нажатий до хода, видно ли «взведено».
Макеты пометки «единственная цель» (три) и акцента прибытия (два) CSS поверх живого композера → батч владельцу (решения 4, 7) ДО реализации 3.В/3.Г.
### 3.Б Одно правило курсора (решение 2–3)
`consoleCommitGate.nextCursorAfterAnswer` + `commitArrivalKind` ('question' | 'offered' | 'commit'); оба композера вызывают её из ОДНОЙ точки
(`afterAnswer(choiceId)`) — все `sub = undefined`-ветки, пики, варианты, «Далее», оплата, отказ; партийный композер — `cursorRow` из того же правила.
Спек `consoleCommitGate.spec` § nextCursorAfterAnswer (таблица случаев), `composerRender.spec` / `consolePlayCardComposer.spec` / `ConsolePartyActionComposer*.spec`
§ после ответа (каждый вид шага → ожидаемая посадка).
### 3.В Прибытие на коммит (решение 4)
`cursorArrival` — режим `commit` (гейт позы + окно инерции `COMMIT_ARRIVAL_ABSORB_MS` ≤ `CURSOR_MS` + кадр); `data-composer-armed` на CTA на один
вдох; `.con-composer__cta` — `.con-cursor-paint(armed)` (рэтчет не растёт); A-глагол: ОДИН источник для кнопки и бара (`consoleCommitGate` → `commitLabel`),
с ценой там, где она есть (play — цена уже на плите; action — «Выполнить»); спеки `cursorArrival.spec` § commit (поглощение в окне, пропуск после),
`composerRender.spec` § armed once, `cursorGrammarGuard` зелёный.
### 3.Г Единственная цель (решения 5–7)
`seedSoleCandidate(choice, candidates, flags)` — ЧИСТАЯ (в `consoleActionComposer.ts`, общая для трёх), таблица условий из решения 6; `captured[...]` +
`seeded[choiceId] = 'sole'`; `ConsoleComposerTargetRow` — проп `seeded` → пометка + хинт (`.premium-tooltip()`, `data-hint`); ряд остаётся
фокусируемым, A открывает выбор; B из выбора — посев цел; пересев при смене формы; `stale` при исчезновении. Батч: ответ адресован, штамп
(`preselectStamp.spec` § посеянный). Спеки: `consolePlayCardComposer.spec` / `consoleActionComposer.spec` § sole (все случаи решения 6 — по одному `it`),
`composerNestedOrBranch.spec` § дверь с одним листом, `optionalChoice.spec` § никогда не сеется, `preselectStamp.spec`.
### 3.Д e2e и регрессия
Новый спек §0.3; `console-variant-settle` (содержимое не двигается — остаётся), `console-action-focus`, `console-hand-pick-preselect`, `console-self-target`,
`console-player-pick`, `console-action-resource-pick`, `console-cursor`, `console-smoothness`, `console-aerial-mappers`, `console-supercomputer`,
`console-effect-decision` — по 2 повтора на Steam Machine; хуки, которые изменились (ряд открыт → посеян), переводятся ТЕМ ЖЕ диффом (инвариант 14);
красный читать после аннотации `build` и нагрузки.

## 4. Лицо, локаль, лор, арт
Арт T14; лор EN (ключ владельца + точка) + RU; RU карты — диагноз 1; новые EN-ключи UI: `The only target` («Единственная цель»), `The only player`
(«Единственный игрок»), `No other targets` («Других целей нет» — хинт); глаголы CTA — существующие ключи; `grep` ключа по всем `src/locales/*/*.json` ДО
добавления; RU чужих не переписывать.

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardPlayPreviewCoverage`, `cardInformation`, `requirementProse`, `premiumCardViewModel`, `cardLore` (T14),
   `crossPlayerCoverageGuard`, `TurmoilCardsUnderRedux` (пин 6), `PoliticalThinkTank.spec`-класс, `premiumScope.spec`, `e2eLiveness`, `lessDeadSelectorGuard`,
   `glyphLiteralGuard`, `cursorGrammarGuard` (рэтчет).
2. Юниты §3.Б–3.Г; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине, последовательно.
3. e2e §3.Д; `npm run e2e:affected` + перевод задетых хуков тем же диффом.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/t14/{tv,fhd}/`: (а) розыгрыш с одной целью ДО / ПОСЛЕ: открытие → ряд посеян с пометкой и «было → станет» → курсор прибывает на CTA →
вдох «взведено» → бар «A Разыграть» → A → один POST; (б) A на посеянном ряду → альбом с одной карточкой → B → ряд цел; (в) действие с двумя
вопросами: ответ первого → курсор на второй → ответ → курсор на CTA; (г) вариант без вопросов → CTA; (д) инерция: нажатие в окне — ничего не ушло.
Каждый кадр — своим глазом с дивана: «я вижу, куда пойдёт ресурс, и понимаю, что СЛЕДУЮЩЕЕ нажатие — ход?»

## 7. Полировка по пути
1. Реестр: раздел **CC** «ОДИН КУРСОР ПОСЛЕ ОТВЕТА · ПРИБЫТИЕ НА КОММИТ · ЕДИНСТВЕННАЯ ЦЕЛЬ» — диагноз 2–4 строками (классы: «три правила посадки»,
   «CTA не прибывает», «нет гейта инерции», «нулевое решение стоит двух нажатий»), находки стенда; номера — по footer на своём HEAD.
2. Доки: НОВЫЙ контракт `docs/claude/console/composer-preselect.md` (грамматика pre-select трёх композеров: таблица видов шага × сеется / не сеется ×
   почему; правило курсора; прибытие на коммит и гейт инерции; пометка; угловые случаи; гарды); `cursor.md` § Composers переписать (одно правило;
   режим `commit` прибытия); `workspace-band.md` § ACTION COMMIT — ссылка; закон в `console-ui.md` — новый § «**A COMPOSER PRE-SELECT: ONE CURSOR RULE,
   A SOLE TARGET IS SEEDED, SHOWN AND MARKED, THE COMMIT ARRIVES**» (после любого ответа курсор идёт к следующему вопросу, иначе к коммиту — одной
   фразой; коммит прибывает, вдыхает «взведено», бар и кнопка говорят один глагол, нажатие в окне прибытия — прибытие, не ход; выбор с ОДНИМ
   включённым кандидатом посеян и показан с пометкой, A открывает его, необязательный / выключенный / диапазон / поле — никогда); CLAUDE.md
   инвариант 3 — одно предложение-уточнение («…In a COMPOSER a sole enabled candidate is PRE-SELECTED and shown — the target, its `current → resulting`
   and the mark — never applied silently; the server still asks, the batch answers»); `game-logic.md` § NO AUTO-SELECT — строка «the client's composer
   seed is NOT this trap»; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §4.2 — T14 «СДАНА» (6 из 22); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — стенд «до» (таблица посадок в трёх композерах) + макеты → батч; карта — параллельно.
2. Порядок: карта + спек + строка долой → стенд `before` → 3.Б правило курсора + юниты → (после батча) 3.В прибытие + 3.Г посев + юниты → e2e + перевод
   хуков → сториборды `after` → регрессия → реестр / доки. Коммит по ханкам на каждом шаге.
3. Реестр: букву (CC) и номера объявлять В МОМЕНТ записи по текущему footer.
4. Отчёт: первой строкой — арт; затем таблица посадок ДО / ПОСЛЕ по трём композерам, сториборды (а)–(д), число нажатий до хода ДО / ПОСЛЕ по
   матрице, результат регрессии, решения 1–8 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (4 и 7 с макетами, 3, 5 (а/б) —
   рекомендация первой; остальное в отчёте), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Второе правило посадки курсора где бы то ни было; `focusIdx = ctaIndex` руками в ветках; `$nextTick`-пересадка (посадка решается синхронно —
  `cursor.md` § Composers); `scrollIntoView`; рукописные `--focused { box-shadow / transform }` (рэтчет); таймер вместо окна прибытия; отправка хода
  нажатием, пришедшим до окрашенной позы; разные глаголы на кнопке и в баре.
- Сеять необязательный выбор, выключенного кандидата, диапазон, размещение на поле, дверь с несколькими листами; применять посев «втихую» без
  ряда (серверная NO AUTO-SELECT остаётся); прятать посеянный ряд из навигации; убирать A на посеянном ряду; `title`-атрибут; литерал кнопки.
- Трогать хост задач, колесо, стандартные проекты, разбор хода бота; правила карты; e2e карте; RU чужих ключей; незакоммиченный файл соседа;
  `git stash`; bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.
