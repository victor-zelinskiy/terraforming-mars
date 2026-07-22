# Console Surface Motion — единая оркестрация переходов band-поверхностей

Системный слой анимации появления / закрытия / взаимных переходов console-native
модальных поверхностей (task host, композеры, reveal, RT/LT quick wheels, sheets).
Не касается «физических» карточных анимаций (deal / exit / hero / FLIP карт) — те
остаются у своих директоров; этот слой оживляет сам СИСТЕМНЫЙ UI, который раньше
переключался мгновенными `v-if`-swap'ами с независимыми `con-layer` fade'ами.

Приоритет (из брифа): ОТЗЫВЧИВОСТЬ → НЕПРЕРЫВНОСТЬ → ПРЕМИАЛЬНОСТЬ →
ФИЗИЧЕСКАЯ УБЕДИТЕЛЬНОСТЬ → ЭФФЕКТНОСТЬ. Ввод никогда не ждёт анимацию;
анимация сопровождает уже принятое действие.

## Модули

| Файл | Роль |
| --- | --- |
| `src/client/console/surfaceMotion/surfaceMotionModel.ts` | ЧИСТАЯ модель (без Vue/DOM/GSAP): словарь переходов, phase-пары, awaiting-контракт, свежесть захватов. Тестируется под server-runner'ом. |
| `src/client/console/surfaceMotion/surfaceMotionState.ts` | Реактивный стор + DOM-capture мост: shade-владение, захват departure (панель+анкоры), awaiting-lifecycle, wheel-origin. |
| `src/client/console/surfaceMotion/surfaceMotionDirector.ts` | GSAP-runtime: пара Vue `<transition :css="false">` хуков (`surfaceEnterHook`/`surfaceLeaveHook` + cancelled-пара), эпизод-гарды, safety-таймеры, reduced-motion. |
| `tests/client/components/console/surfaceMotionModel.spec.ts` | 23 unit-теста модели + стора. |
| `tests/e2e/console-surface-motion.spec.ts` | Полный драйв цепочки (fhd + tv4k): wheels + композер → reveal, anti-blink пробы shade. |

## Словарь переходов (`classifySurfaceTransition`)

- `open` / `dismiss` — первое появление / окончательное закрытие band-поверхности
  (rise 210ms `expo.out` / drop 140ms `power2.in`, только transform/opacity на
  `[data-motion-panel]`).
- `phase` — СЛЕДУЮЩАЯ СТАДИЯ одной операции (закрытая таблица `PHASE_PAIRS`:
  `action-composer→reveal`, `card-actions→reveal`, `task-host→reveal`,
  `reveal→task-host`, `action-composer→task-host`, `card-actions→task-host`,
  `play-composer→task-host` — follow-up prompt после confirm, кейс Helion:
  оплата действия входит как продолжение той же активации; захват departure
  в awaiting-resolve выполняется БЕЗУСЛОВНО, а `departureUsable` сам
  фильтрует по таблице). Общий shade не мигает; панель входит как продолжение
  (направленный recompose от центра исходной панели, 190ms); каждый
  `data-motion-anchor`, совпавший с захватом, FLIP'ует из старого viewport-rect
  в новый (300ms `power3.inOut`) — карта-источник физически переезжает между
  стадиями, глаз не теряет объект.
- `handoff` — обмен фронтом двух независимых поверхностей (выход 110ms + вход).
- **section-exit freeze (load-bearing):** уходящая WORKSPACE-секция
  (colonies/hydro, `flex:1` в потоке `.con-main`) в leave-хуке СИНХРОННО
  замораживается на живом rect (`position:fixed`, z 5, pointer-inert) и
  растворяется НАД доской (`SECTION_OUT_MS` 170) — иначе она 140мс делит
  ширину с v-show-доской: планета монтируется в пол-экрана (заниженный
  `--board-scale`), после unmount рывком возвращается, а сам экран мелькает
  сжатым справа. С freeze `fitBoard` хранит прежний масштаб и не
  пересчитывается вовсе (регрессионный probe в e2e сэмплирует
  `--board-scale` через весь выход). Отменённый leave снимает freeze
  (`clearProps` в leave-cancelled).
- `wheel-open` / `wheel-dismiss` / `wheel-handoff` — семейство RT/LT колеса:
  механическое, быстрее модалок (120/95ms); при handoff выбранный слот
  вспыхивает импульсом (scale 1.06) и целевая поверхность входит С НАПРАВЛЕНИЯ
  слота (push ≤18px·uiScale).

## Мигрированные поверхности (волны 1–2)

⚠ **`action-composer` = ACTION FOCUS стадия ВНУТРИ фрейма `card-actions`**
(итерация ACTION FOCUS): его browse ⇄ focus вход/выход играет СОБСТВЕННЫЙ
директор `consoleActionFocusMotion.ts` (FLIP миниатюра ↔ hero-карта, уход
browse-слоя — словарь, который generic open/dismiss выразить не может), а
НЕ surfaceEnterHook/surfaceLeaveHook. Контракты surface-motion при этом
остаются на стадии: `data-motion-surface="action-composer"` +
`data-motion-panel` + анкор `card:<name>` — awaiting-hold, безусловный
захват departure и phase-FLIP в reveal / task-host работают как раньше
(родительский leave `card-actions` уносит вложенную панель стадии — child
transition при unmount родителя не срабатывает, это штатно).

Полный дим на shade: `quick`, `card-actions` (+`action-composer` внутри),
`std-projects`, `task-host`, `reveal`, `play-composer`, `corp-first`,
`confirm` (Пас/конвертация — цель wheel-handoff'а), `trade-composer`,
`ma-confirm`, `colony-inspect`, `ma-inspect`, `gov-support`, `production-loss`.
Свой дим + только анимации директора (`NON_SHADE_OWNERS`): `ma-screen` (0.34
«доска читаема»), `sheet` (bottom-sheet, GSAP-вход снизу), `info-mode`
(Y-слой НАД band'ом, z 11560), `section` (colonies/hydro — workspace без
дима; wheel-handoff даёт направленный вход). НЕ мигрированы сознательно:
start-scene, draft-tray, mandatory-announce, played-overlay, stranded/alert
(служебные — fade уместен), журнал (`con-journal`), внутренние слои
гидро-секции (`.con-hydroconfirm`/`.con-hydro__help` — дочерние mount'ы вне
хуков, свои локальные дим+`con-rise`).

## Контракты разметки

- `data-motion-surface="<id>"` на корне мигрированной поверхности — участие в
  системе. Без атрибута хуки — прозрачный no-op (постепенная миграция).
- `data-motion-panel` — анимируемая панель (band-корень остаётся неподвижным,
  fit-инженерия не ломается). При leave анимируются ВСЕ панели под корнем
  (уходящий центр уносит свой открытый композер: дочерний transition при
  unmount родителя не срабатывает).
- `data-motion-anchor="card:<CardName>"` — FLIP-анкор phase-переходов
  (композер `__actcard` ↔ reveal «Источник»). FLIP компенсирует CSS `zoom:`
  предков (`effZoom = rect.width / offsetWidth`) — иначе translate-пиксели
  перемасштабируются зумом и карта недолетает (TV-профиль!).
- `data-motion-variant` (reveal): `headless` — ничего не рендерит (ни shade, ни
  моушена), `drawn` — хореографию ведёт own draw-cinematic (только shade).

## Единый shade (`.con-shade`, z 11460)

ОДИН постоянно смонтированный полноэкранный дим (`.con-backdrop-dim()`,
opacity-transition 170ms on / 210ms+70ms-delay off) под всеми мигрированными
band-поверхностями (11480+). Владение: enter-хук регистрирует, leave-хук
снимает (`shadeOwners` set-семантика) — при same-flush handoff счётчик идёт
1→2→1, дим физически не может мигнуть. `pickSuppressed` (hand/tableau pick
мост v-show-прячет композер) глушит shade на время моста. Awaiting-hold держит
shade даже без DOM-владельца. `--veil` (0.28) — table-beat задрафтованного
трея (тот же флаг `draftTrayState.tableView`, что и у task-host).

`NON_SHADE_OWNERS = {'action-composer', 'ma-screen', 'sheet', 'info-mode',
'section'}` — композер ДОЧЕРНИЙ слой центра (дочерний leave не сработает при
unmount родителя — владение утекло бы навсегда), остальные несут собственный
дим/бездимность по дизайну. Собственные `__backdrop`-div'ы мигрированных
поверхностей удалены ВМЕСТЕ с правилами (`.con-composer__backdrop`,
`.con-task-host__backdrop`, `.con-confirm/-mainspect/-govsupport/-prodloss__backdrop`
— мёртвых правил не осталось; ⚠ при сносе такого правила ВСЕГДА греп по
`.vue` — шасси-классы делятся: host-правило носили trade/maconfirm/colinspect,
composer-правило — play/corpfirst; гидро-слои переехали на собственные
`.con-hydroconfirm__backdrop`/`.con-hydro__help-backdrop`).

**Динамические глушители shade** (симметрия `pickSuppressed`):
`revealVeilSuppressed` — reveal, ВУАЛИРОВАННЫЙ сценой (board-bonus /
deck-draw / colony-trade: фрейм смонтирован для замера, карты ещё летят) —
оверлей репортит `bonusVeiled` watcher'ом → поле не темнеет до передачи
сцены. Плюс двухрежимность: `surfaceShadeVisible |= isTradeFleetActive()`
при `--veil` — полёт торгового флота держит ТОНКУЮ вуаль (сетка колоний
читаема, корабль в фокусе) — замена ретировавшегося `--launching` дима.

## Awaiting handoff (semantic commit)

Confirm экшен-композера БОЛЬШЕ НЕ закрывает его мгновенно:
`ConsoleShell.onCardActionsSubmitBatch` → `beginAwaitingHandoff('action-composer',
{gameAge, undoCount})` + POST. Композер держит сцену (CTA → «Выполняется…»,
спиннер `__cta-wait`), `handleIntent` поглощает ВЕСЬ ввод (после system-alert
ветки — алерт остаётся доступен): B не может «отменить» уже применённое, A не
может задвоить. Разрешение — в pre-flush watcher'е `playerView` через чистый
`resolveAwaiting`:

- reveal у viewer'а появился → `phase`: синхронно замеряется уходящий композер
  (`captureSurfaceDeparture`, DOM ещё старый), `closeConsoleLayers()` — закрытие
  и mount ревила ложатся в ОДИН патч, enter ревила забирает захват и играет
  анкорный FLIP. Пустого кадра нет по построению.
- gameAge/undoCount сдвинулись без ревила → `dismiss` (обычный уход).
- тот же view (поллинг) → `hold`.
- страховки: `AWAITING_SAFETY_MS` (6с) в модели + belt-and-braces таймер в
  shell (сервер умер → dismiss, шелл не виснет).

Уходящая сторона живого анкорного FLIP'а гасит СВОИ анкоры мгновенно
(`isAnchorHandoffLive`) — путешествующая карта существует только на входящей
стороне, без двоения.

## Wheel (RT/LT)

`activateQuickSlot` перед закрытием помечает `markWheelHandoff(slot, el)` —
leave-хук вспыхивает выбранный слот, enter следующей поверхности берёт
`wheelOrigin` (свежесть 700ms) и входит с его направления. Открытие колеса —
120ms материализация + микро-каскад слотов (stagger 11ms); закрытие по B —
95ms collapse (раньше был мгновенный unmount). Вход всегда обрабатывается с
первого кадра — хуки не трогают маршрутизацию `handleIntent`.

## Инварианты / гочи

- Vue `<transition :css="false">` — ЕДИНСТВЕННЫЙ механизм удержания DOM для
  exit: никакого `con-layer` на мигрированных поверхностях (CSS и GSAP не
  конкурируют за opacity/transform). `con-layer` остаётся fallback'ом
  немигрированных.
- Цепочка sheet'ов (`stdp / ma / cardActions / sheet`) обёрнута ОДНИМ
  transition — v-else-if остаётся валидным, swap двух sheet'ов проходит через
  leave+enter пары.
- v-show pick-мост НЕ анимируется: leave при активном мосте ставит
  `data-motion-pick-hidden`, обратный enter распознаёт re-show и мгновенно
  завершается (возврат центра прикрывает смену секции тем же кадром).
- Каждый хук — эпизод-гард (`WeakMap` живых твинов, kill при повторном входе)
  + safety-таймер: `done()` гарантирован, Vue не застревает.
- Reduced motion: короткий функциональный fade (≤120ms), без travel/FLIP;
  порядок стадий, ввод, commit — без изменений.
- Тайминги — `motionMs()` (пресеты calm/standard/swift масштабируют всё);
  сдвиги — `conUiScale()`.
- Leak detector не менялся: переходы < 1 тик, debounce=2 покрывает; во время
  awaiting prompt — action menu (SHELL_NATIVE) → не stranded.

## Как мигрировать следующую поверхность

1. Корню — `data-motion-surface="<новый id>"`, панели — `data-motion-panel`;
   id добавить в `SurfaceMotionId`.
2. Удалить собственный `__backdrop`-div (+CSS, если класс больше никем не
   делится) и панельную CSS-entry-анимацию (`con-rise`).
3. Обернуть в `<transition :css="false" appear @enter=... @leave=...
   @enter-cancelled=... @leave-cancelled=...>` (хуки из директора).
4. Если это стадия существующей операции — добавить пару в `PHASE_PAIRS` и
   `data-motion-anchor` на общие элементы.
5. Если поверхность — дочерний слой другой (unmount вместе с родителем) —
   внести в `NON_SHADE_OWNERS`.
6. Прогнать `surfaceMotionModel.spec` + console-группу mochapack + e2e
   `console-surface-motion.spec.ts` (fhd + tv4k).
