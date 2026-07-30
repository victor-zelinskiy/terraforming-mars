# The WORKSPACE BAND — единый премиум-формат decision-поверхностей

**Контракт (2026-07-29).** Каждая console-native decision-поверхность стоит
между верхним HUD и нижним command-bar **и справа от всегда видимой рельсы
игрока** — ресурсы/производство/метки остаются экранным контекстом любого
решения (и физической посадочной зоной resource-flight анимаций).

## Механика

**Одна рамка на всех — по факту, не по приближению.** Вертикаль полосы больше
не выводится из токенов-приближений: `useWorkspaceBandGeometry` (composable,
ResizeObserver на `.con-main`) публикует ЖИВОЙ бокс колонки как
`--con-ws-top`/`--con-ws-bottom`, а `.con-ws-band()` читает их с токенами как
pre-mount fallback. Правый край полосы = `--con-pad-x` (инсет шелла), не край
вьюпорта. Экраны-workspace несут `.con-ws-fill()` (ширина 100%, `max-width:
none`) — их рамка начинается на шве рельсы, как у `.con-info`; НИКАКИХ
собственных padding'ов на корне поверхности (у `.con-ma` их было три штуки,
включая профильные — экран стоял на 6–22px иначе всех). Замер (fhd/TV/Deck):
cardactions = ma = stdp = info, пиксель в пиксель.

**Вход без перемещения.** Директор (`surfaceMotionDirector`) для семьи
`con-ws` играет ОДИН materialize: `opacity` + `scale .988` из центра, никаких
x/y. Направленный толчок wheel-handoff'а и «подъём» дефолтного open сажали
рамку на несколько px мимо финальной геометрии и защёлкивали — глаз читает это
как скачок layout'а, а не как движение. Два исключения: `kind === 'phase'`
(FLIP одной поверхности в другую — в нём весь смысл) и колесо `quick` (его
крест собирается из своего хаба, рамка не двигается).

- **`.con-ws-band()`** (console.less, рядом с `.con-modal-band()`): modal-band
  + `left: var(--con-ws-left)`. Токен считается один раз на `.con-root`:
  `--con-ws-left = --con-pad-x + --con-rail-w + --con-main-gap`. Профили
  переопределяют ТОКЕНЫ на `.con-root` (handheld 0.7vw/7.3rem/.4rem, tv
  safe-x/9.8rem), никогда — per-surface константы.
- **Маркер `con-ws`** на корневом элементе поверхности (обязателен вместе с
  миксином): `.con-root:has(.con-ws)` снимает z-ловушку `.con-main`, поднимает
  рельсу (`.con-res-host` → z11520 — выше шейда 11460 и всей band-семьи
  11480–11515, ниже баров 11700+), даёт рельсе cyan-кольцо и прячет
  aux-сателлит ДОП.РЕСУРСЫ (он красился бы под панелями). Держится ровно
  столько, сколько поверхность живёт в DOM — leave-переходы включены,
  никакого JS-флага «closing» не нужно.
- Поверхность ВНУТРИ `.con-main` (Action Workspace, Information Workspace)
  достигает той же геометрии absolute-позиционированием по тем же токенам;
  Information Workspace несёт СВОЮ обработку рельсы (z11561 + акцент
  инспектируемого игрока) — его правила стоят в файле ПОЗЖЕ generic-ws и
  выигрывают при совпадении.
- Ширины панелей внутри band: `min(Xrem, 100%)` — НИКОГДА `Xvw` (vw-кап шире
  суженной полосы на Deck → переполнение вправо).

## Кто в семье (маркер + ws-band)

`.con-cardactions` (Действия карт + repeat), `.con-stdp`, `.con-ma`,
`.con-mainspect`, `.con-maconfirm`, `.con-sheet`, `.con-task-host` (шасси:
`.con-task`/`--wide`, `.con-play`, `.con-trade`, `.con-colinspect`,
`.con-hydroconfirm`, hydro help), `.con-composer` (play / corp-first;
`--stage` живёт внутри cardactions), `.con-govsupport`, `.con-decision`,
`.con-finale`, `.con-prodloss`, `.con-confirm`, `.con-quick` (командные
колёса LT/RT — на них ВЫБИРАЕТСЯ ход, значит ресурсы рядом обязаны гореть;
слот-полёты меряются по живым ректам и следуют за сдвигом), `.con-played`
(свой fixed: left = ws-left, right = pad-x; embedded-вариант маркер НЕ
несёт — он живёт внутри Information Workspace).

## Кто сознательно ВНЕ (полноэкранные)

Reveal-синематик `.con-reveal`, церемонии, `.con-mandatory` (announce-гейт),
fullscreen-осмотр `.con-zoom`, системное меню / `.con-alert`, стартовая сцена
(прегейм — рельса ещё не наполнена), endgame. Секции (`.con-hand`,
`.con-colonies`, `.con-hydro`, board, journal, `.con-info`) — уже
flex/absolute-дети `.con-main`, рельса видна по построению.

## WORKSPACE DESCEND — «вход внутрь» шага той же рамки

Когда игрок с browse-слоя workspace-а «входит» в конкретный объект (действие
карты, ветку, строку), переход играется как **спуск вглубь той же рамки**, а
не как смена экрана: рамка/band/рельса стоят, родительский слой уходит В
точку нажатия, семантические объекты перелетают на новые роли, B играет ту же
фразу назад. Примитивы — `src/client/console/surfaceMotion/workspaceDescend.ts`:

- **Именованные one-shot регистры** (свежесть 1с): `armDescendOrigin(key,
  {x,y})` / `takeDescendOrigin(key)` — точка нажатия; `armDescendRect(key,
  rect)` / `takeDescendRect(key)` — живой rect объекта-носителя. Вооружает
  СИНХРОННО обработчик A (до маунта стадии), забирает enter-hook.
- **`descendRecede(tl, layer, pressPoint, durS, at)`** — родительский слой
  scale .985 + autoAlpha 0 с transform-origin в точке нажатия (origin
  запоминается в WeakMap); **`descendReturn`** ведёт слой обратно из той же
  точки и чистит props. **`descendParkLayer`** — мгновенная парковка для
  cancelled-веток.
- **`descendFlipFrom(el, fromRect)`** — zoom-компенсированный FLIP (effZoom)
  для перелёта объекта на новую роль (миниатюра → hero, графика действия →
  action strip стадии).
- **`guardedDescend(el, totalMs, done, body)`** — эпизод, который никогда не
  роняет `done()` (reduced-motion → мгновенный путь).

Референс-реализация — «Действия карт» (`consoleActionFocusMotion.ts`): пульс
на слоте (`con-cardact-descend`, box-shadow-флара — perf-lite-safe) →
browse-слой уходит в точку нажатия → миниатюра карты FLIP в hero, графика
действия FLIP в `[data-action-strip]` композера; B — обратная фраза, strip
FLIP-ится домой в графику слота. Новый экран со «входом вглубь» переиспользует
эти примитивы со СВОИМИ ключами регистров — не пишет свой RECEDE/FLIP.

## Гочи

- Новая workspace-поверхность = **миксин + маркер, оба**. Маркер без миксина
  поднимет рельсу под full-width панелью; миксин без маркера оставит рельсу
  под шейдом.
- e2e-ассерты центрирования — считать от **центра полосы** (bounding box
  корня поверхности), не от центра вьюпорта (console-effect-decision.spec —
  образец).
- `v-show`-скрытая поверхность продолжает матчить `:has` — это желаемое
  поведение (pick-мосты держат состояние).
- Слот-анатомия списка действий (`--act-head-h`/`--act-canvas-h`/…) — профиль
  меняет ТОКЕНЫ, никогда прямой `padding` на плитке: статический override в
  TV уводил «ИЛИ»-джойнт с центра канваса на 4px.
