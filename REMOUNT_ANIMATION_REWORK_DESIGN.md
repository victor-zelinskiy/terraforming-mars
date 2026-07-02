# Дизайн: реворк модели обновления UI + единая premium-анимационная система

> Ответ на `REMOUNT_ANIMATION_REWORK_BRIEF.md`. Статус: **РЕАЛИЗОВАНО (фазы 1–3 + чистка/доки), см. §9.**
> Исследованная цепочка: `App.vue → WaitingFor.vue → realtime/* → PlayerHome.vue → Board/* →
> AnimatedMetricValue/changeFeedbackManager` + все 5 точек `playerkey++` + ~46 модульных синглтонов.
>
> **Отличия реализации от первоначального дизайна (два осознанных решения):**
> 1. Фаза «identity-preserving патч» реализована как **structural sharing** (грaфт неизменённых
>    под-деревьев ПРЕДЫДУЩЕГО снимка в НОВЫЙ объект — `viewSnapshotShare.ts`), а не как мутирующий
>    in-place merge. Причина: при merge identity корня не меняется и **все identity-watchers на
>    `playerView` молча умирают** (аудит нашёл их в App / NotificationLayer / TurnHandoffLayer /
>    StartGameFlowOverlay), плюс merge требует delete-обработки транзиентных полей и REPLACE-списка
>    волатильных под-деревьев. Sharing даёт ту же выгоду (неизменённые ветки сохраняют ссылки →
>    дети пропускают re-render), но корень всегда новый → все watchers живы, ни одной мутации,
>    а худший класс ошибки — «поделились меньше, чем могли» (лишний re-render), никогда не
>    неверные данные (результат контент-идентичен снимку по построению).
> 2. Консолидация 4 холдов (`holdingFor*`) в единый transitionGate-реестр **отложена осознанно**:
>    механика координации уже существует и обкатана (holds сериализуют «большие моменты», composed
>    max-duration), а рефакторинг самого деликатного sequencing-кода ради косметики — риск без
>    пользовательской ценности. Вместо этого их ДЛИТЕЛЬНОСТИ централизованы через motionMs()
>    (пресеты масштабируют всю хореографию согласованно).
> 3. Baseline-модули анимаций (`accentBaseline`, `tileBaseline`+resume, cubeDrop-baseline) НЕ
>    удалены: при выключенном remount они и так не участвуют (анимации идут через watch-переходы),
>    но остаются НЕСУЩИМИ для аварийного флага `tm_remount=1` (под ним дерево вновь ремаунтится на
>    каждый ответ, и mount-diff — единственный сигнал). Удалять их = ломать откат.

---

## 1. Диагноз: зачем сегодня существует remount

`<player-home :key="playerkey">` пересоздаётся на (почти) каждый ответ сервера. Бамп происходит в
**пяти** местах: `App.update()` (poll-путь), `WaitingFor.updatePlayerView()` (свой POST),
`DraftFlowOverlay.applyPlayerViewUpdate()`, `InitialDraftFlowOverlay`, `StartGameFlowOverlay`.
Все пять уже содержат **обходной путь без remount** (`shouldPreserveCardPickModal` /
`preserveOpenOverlay` / draft-preserve): в этих случаях `root.playerView = model` заменяется
**реактивно, без бампа ключа** — и всё работает. Это ключевой факт: **но-ремаунт-путь уже
существует и обкатан в бою** — каждое обновление при открытом оверлее (журнал, рука, сыграно,
эффекты…) уже идёт через него.

Remount сегодня выполняет три функции:

| # | Функция | Чем заменяется |
|---|---|---|
| R1 | «Форс ре-рендера» (историческое, эпоха до полной реактивности) | Vue 3 реактивность: замена/патч `playerView` обновляет всё сама — доказано preserve-путём |
| R2 | **Неявный сброс транзиентного UI** на свой сабмит («сабмит из оверлея закрывает оверлей», `PlayerHome.data()` к дефолтам) | **Явный reset-сигнал** (см. §3.2) с теми же гвардами в тех же местах |
| R3 | Пере-выполнение `mounted()`-логики (baseline-диффы анимаций, title/favicon, re-arm оверлеев) | Честные `watch(old→new)` + baseline-костыли становятся мёртвым кодом |

Цена: полный unmount/mount ~тысяч компонентов (61 BoardSpace×PlayerCube, все панели, каждый
`AnimatedMetricValue` заново гоняет `mounted()`-round-trip — A3 из `PERFORMANCE_AUDIT.md`),
и ~46 модульных синглтонов, существующих только чтобы это пережить.

---

## 2. Цель A — варианты архитектуры обновления и выбор

### V1. Реактивная замена снимка целиком, без `:key` (wholesale swap)
Сделать существующий preserve-путь универсальным: `root.playerView = model` всегда, `:key` убрать.
Компоненты живут всю партию; обновление = ре-рендер по реактивным зависимостям (НЕ remount).

- **Плюсы:** путь уже обкатан (все обновления при открытых оверлеях); минимальный новый код;
  все гварды сохраняют смысл дословно; тривиальный откат.
- **Минусы:** identity всех под-объектов меняется на каждом апдейте → все computeds на
  `playerView` пересчитываются, дети ре-рендерятся (vnode-дифф). Это на порядок дешевле
  remount, но не «точечно».

### V2. Identity-preserving патч (структурный merge в реактивный граф)
`applyViewSnapshot(current, incoming)`: пройти новый снимок против текущего, мутировать только
изменившиеся листья, сохранять ссылки на неизменённые под-объекты. Массивы — keyed-merge по
стабильным ключам (клетки `id`, игроки `color`, карты `name`), волатильные под-деревья
(`waitingFor`, `cardDrawReveals`, `lastReveal`, `energyHeatConversion`) — replace целиком.

- **Плюсы:** «Vue обновляет точечно»: неизменённая клетка сохраняет ссылку → props BoardSpace
  shallow-равны → Vue пропускает ре-рендер ребёнка. Value-watchers (`space.tileType`,
  `game.temperature`) срабатывают только на реальные изменения — идеальная почва для анимаций.
- **Минусы/риски:** identity-based watchers перестают срабатывать (App `watch: playerView`,
  NotificationLayer) — нужен аудит и перевод на value-based/явные вызовы; удаление отсутствующих
  optional-полей; дифф-детекторы (`detectEnergyConversion` и т.п.) обязаны бежать ДО мержа.

### V3. Нормализованный стор (Pinia-подобный) — **отклонён**
Большой рерайт всех потребителей, высокий риск, а выгоду (точечность) даёт и V2 без смены
парадигмы «снимок — единица правды». Не оправдан для server-authoritative снапшот-модели.

### V4. `shallowRef` + ручные события инвалидации — **отклонён**
Ломает текущую (работающую) реактивность, много ручного кода, легко получить «застрявшие» куски.

### Выбор: **V1 → V2, фазами, каждая с килл-свитчем**
Фаза 1 (V1) — архитектурный переключатель: remount уходит, поведение сохранено; риск минимален,
т.к. путь уже в бою. Фаза 3 (V2) — «умная точечность» поверх, отдельно измеряемая и отключаемая.
Так самая рискованная часть (сброс поведения R2/R3) валидируется до тонкой оптимизации.

### Ключевой приём Фазы 1: `:key="playerkey"` → `:reset-epoch="playerkey"`
**Ни один из 5 бамп-сайтов не трогаем.** `playerkey` переосмысляется из «ключа пересоздания» в
«эпоху сброса транзиентного UI»: PlayerHome получает prop `resetEpoch` и по watcher выполняет
явный `resetTransientUi()` (закрыть `activeOverlay`, сбросить pending-модалки/пикеры — те же
дефолты, что были в `data()`). Семантика гвардов (`preserveCardPickModal`, `preserveOpenOverlay`,
draft-preserve) сохраняется дословно: где раньше «пропускали remount» — теперь «пропускают сброс».
**Откат = вернуть `:key` (одна строка, флаг `tm_remount=1`).**

Известные зависимости от remount и их судьба (Фаза 1):

| Зависимость | Решение |
|---|---|
| `Card.vue` резолвит `cardInstance` один раз в `data()` (staleness-ловушка §3.5 брифа) | `cardInstance` → `computed` (`getCardOrThrow` = Map-lookup, дёшево). Закрывает ВЕСЬ класс переиспользуемых `<Card>` без `:key` |
| `WaitingFor.mounted()`: document.title, favicon, title-spinner-интервал | → `watch(waitingfor, {immediate})` |
| «Сабмит закрывает оверлей», сброс `PlayerHome.data()` | `resetTransientUi()` по `resetEpoch`-watcher (см. выше) |
| `AnimatedMetricValue` / `AnimatedScaleMarker` mounted-диффы | Работают как есть (у обоих уже есть watch-путь); упрощение — Фаза 2 |
| tile-анимации оппонента (poll-путь: arm + remount-mount-observe) | Эквивалентно через watch: arm + реактивный своп → `space.tileType`-watcher срабатывает |
| `PlayerHome.mounted()` re-arm оверлеев, cancel-stale-picks | Остаются (выполняются один раз, вреда нет) |
| `screen='empty'→'player-home'` танец в 4 местах | Мёртвый код (Vue батчит) — удалить |
| `syncBoardInfo` на каждый remount | Проверить/добавить value-based watcher |

### Что даёт `(gameAge, undoCount)`-версионирование (инвариант §3.2)
Не трогаем: WS-wake → `waitForUpdate(true)` → `/api/waitingfor` → guarded `updatePlayer()` —
вся цепочка без изменений. Меняется только последний сантиметр: «применить снимок» больше не
означает «пересоздать мир».

---

## 3. Цель B — единая анимационная система

### 3.1 Слой токенов: `src/client/components/motion/motionTokens.ts` (чистый, тестируемый)
- **Токены длительностей** (консолидация текущих магических чисел: chip 1300–2240, placement 720,
  hold 330, marker ≤1280, conversion 1200–2200, hazard 940…) + **именованные easing-кривые** в духе
  Ark Nova BGA (короткие ease-out, лёгкий scale/glow, без хлопков).
- **Пресеты скорости** (запрошено заказчиком): `calm | standard | swift` (множитель ×1.3 / ×1 / ×0.65)
  + `prefers-reduced-motion` как перекрывающий режим (существующее поведение унифицируется через
  один модуль). Новая настройка `animation_speed` в `PreferencesManager`.
- **`motionMs(base)`** — единственная точка масштабирования JS-таймингов (холды, chip-lifetime,
  glide-длительности, дедлайны гейтов).
- **CSS-мост:** `--motion-scale` на `documentElement`; флагманские LESS-анимации (delta-чипы,
  placement, scale-marker, conversion) переводятся на `calc(Xms * var(--motion-scale, 1))`.
  Остальные one-off CSS-длительности мигрируют оппортунистически (документируется).
- **FPS-предел** для JS/rAF-управляемых анимаций (`aresMarkerGlide`, count-up'ы): `frameGate(fps)`
  хелпер + настройка (`auto | 60 | 30`). Честная оговорка: CSS/WAAPI-анимации композиторные,
  FPS-пресет управляет только rAF-тиками.

### 3.2 Координация: один реестр «удержаний» вместо 4 булевых флагов
Сегодня `holdingForMarker/-TilePlacement/-Conversion/-HazardCleanup` — 4 параллельных флага +
гейты в `App.update`. Формализуем в `transitionGate.ts`: `beginHold(kind): release`,
`anyHoldActive()`, композиция `max(duration)`, safety-timeout. WaitingFor/App читают ОДИН
источник; новые «большие моменты» подключаются без нового флага. (Поведение 1:1, чистая
консолидация.)

### 3.3 `AnimatedMetricValue` — честные old→new переходы
- `mounted()` = **тихий baseline** (report + recordScopeObservation, без чипа);
  **чип рождается только из watch-перехода** (`reconcile()` — уже существует и race-proof).
- Различение причины изменения (инвариант §3.4 брифа) сохраняется механизмом scope/baseline
  `changeFeedbackManager` (менеджер ОСТАЁТСЯ — scope-семантика по определению кросс-компонентная:
  seat-switch, merge-окно, `setBaseline`-посев конверсии).
- Тайминги — из motion-токенов; `appear`-хак в комментариях перестаёт быть нужным (mount больше
  не «каждый апдейт»).

### 3.4 Демонтаж анимационных remount-костылей (следствие Цели A)
- `AnimatedScaleMarker.accentBaseline` (модульный Map) → удалить; компонент живёт всю партию,
  watch(old→new) достаточен.
- `tilePlacementAnimation`: `tileBaseline`-Map и resume-логика (`activePlacements` c
  negative-delay) существовали только для mid-animation remount → удалить; **`armed`-гейт
  остаётся** (по-прежнему отличает реальное размещение от гидратации F5).
- `cubeDropState` — аналогичная ревизия (baseline по цвету → watch).
- `energyConversionTransition` / `hazardCleanupTransition` — остаются модульными (App-level
  оверлеи + гейты фаз), переходят на motion-токены.

---

## 4. Судьба ~46 синглтонов

| Категория | Решение | Обоснование |
|---|---|---|
| **Анимационные baseline-костыли** (accentBaseline, tileBaseline+resume, cubeDrop-baseline) | **Удалить** (Фаза 2) | Существовали только ради remount; мёртвый код после Фазы 1 |
| **Анимационные координаторы** (changeFeedbackManager, energyConversion/hazardCleanup, aresMarkerGlide, hazardIntensify, liveCardResources) | **Оставить модульными** | Кросс-компонентная семантика (гейты фаз, scope-память, глобальный lookup) — не про remount |
| **Per-game UI-состояние** (journalState, notificationState, hand*/played*/actions*/effects*-стейты, startGameFlow, rematch, draftWait, …) | **НЕ переносить** в компоненты | (а) многие обслуживают App-level оверлеи (это про архитектуру размещения, не про remount); (б) перенос = churn + риск без выгоды; (в) reload-граница игры сбрасывает их одинаково в обоих вариантах. Комментарии «survives playerkey remount» актуализируются |
| **Кросс-игровые** (identity, privateScore, createGame, joinGames, desktopUpdate, realtime) | Без изменений | Вне зоны реворка |

Границу игры не трогаем (инвариант §3.6): вход/выход = полная перезагрузка страницы,
`resetGameSessionState()` НЕ вводим.

---

## 5. План обратимых фаз

| Фаза | Содержание | Проверка | Откат |
|---|---|---|---|
| **1. No-remount** | Убрать `:key` у player-home/spectator-home → `resetEpoch`-prop + `resetTransientUi()`; `Card.vue` cardInstance→computed; WaitingFor mounted→watch (title/favicon/spinner); удалить screen-«танец»; счётчики mount в perfMarks | build:server, build:client, make:css, test:client + новые спеки (см. §6); ручной чек-лист | Флаг `tm_remount=1` / `?remount=1` возвращает `:key` |
| **2. Motion-система + анимации** | motionTokens + пресеты + `--motion-scale` + FPS-gate + настройки; transitionGate-консолидация; AnimatedMetricValue тихий-mount; демонтаж accentBaseline/tileBaseline-resume; cubeDrop ревизия | test:client, чистые тесты токенов под server-runner; ручной прогон анимаций §4 брифа | Фаза независима; пресет `standard` = сегодняшние тайминги |
| **3. Identity-preserving патч** | `applyViewSnapshot()` (keyed-merge, replace-список волатильных под-деревьев, дифф-детекторы до мержа); аудит identity-watchers (App playerView-watch → явные вызовы в commit; NotificationLayer → gameAge-watch) | Юнит-тесты мержа (identity-сохранение, удаление optional, keyed-массивы); замер re-render-счётчиков | Флаг `tm_patch=0` → wholesale swap Фазы 1 |
| **4. Чистка + доказательства** | Актуализация комментариев/CLAUDE.md; замеры before/after (perfMarks: long-tasks, mount-counts на апдейт); финальные тесты; GUI-чек-лист пользователю | Всё §5 брифа | — |

Каждая фаза собирается/тестируется самостоятельно; порядок 1→2→3 сознательный: поведенческие
изменения валидируются до оптимизации точечности.

---

## 6. Тесты (новые)

- `tests/client/components/AppNoRemount.spec.ts` — обновление НЕ пересоздаёт player-home
  (identity инстанса), `resetEpoch` сбрасывает транзиентный UI ровно там, где раньше был remount,
  и НЕ сбрасывает на preserve-путях; открытый оверлей переживает апдейт.
- `tests/client/components/feedback/animatedMetricValue.spec.ts` — chip на watch-переход;
  подавление на seat-switch; тишина на первичный mount.
- `tests/client/components/viewSnapshotMerge.spec.ts` (Фаза 3) — identity-сохранение
  неизменённых веток, keyed-merge, удаление optional-полей, replace waitingFor.
- Чистые модули (motionTokens, transitionGate, merge) — дополнительно под server-runner.

## 7. Замеры (обязательство брифа §3.12)

`perfMarks` + новые счётчики: `playerHome:mount`, `metricValue:mount` (на апдейт), long-task
observer. Ожидание: mount-count на апдейт с ~N-сотен → 0 (Фаза 1), re-render-счётчик доски на
несвязанный апдейт → ~0 (Фаза 3). Протокол `?perf=1` before/after включается в итоговый отчёт;
GUI-запись за пользователем (headless-среда).

## 8. Риск-реестр

1. **Пропущенный неявный сброс** (что-то ещё чистилось remount'ом) — покрытие: reset-epoch
   воспроизводит семантику 1:1 по местам бампа; чек-лист §4 брифа; флаг отката.
2. **Stale-capture** (компонент запомнил кусок старого снимка в data) — preserve-путь уже
   работает годами без таких багов; Card.vue (главный известный) чинится структурно.
3. **Merge-franken-state** (Фаза 3) — снят выбором structural sharing (контент-идентичность
   по построению, ни одной мутации); килл-свитч `tm_patch=0` остаётся.
4. **Двойные анимации на превью+коммит** — value-based watch не срабатывает на равные значения;
   существующие механизмы (armed-гейт, dedup-ключи) сохраняются.

## 9. Статус реализации (итог)

| Фаза | Статус | Ключевые артефакты |
|---|---|---|
| 1. No-remount | ✅ | `App.vue` (`playerHomeKey`='stable', `:reset-epoch`), `PlayerHome.resetTransientUi()`/`epochResetTargetOverlay()`, `WaitingFor.syncTurnPresentation()` (watch вместо mounted), `Card.vue` `cardInstance`→computed, board-info кэш-инвалидация по gameAge/undoCount, флаг `legacyRemount.ts` (`?remount=1`/`tm_remount=1`) |
| 2. Motion-система | ✅ | `motion/motionTokens.ts` (пресеты `calm/standard/swift` ×1.3/1/0.65, `motionMs`, `MOTION_EASE`, FPS-cap `auto/60/30` + `createFrameGate`, CSS-мост `--motion-scale` в `main.ts`); проведены: chip-lifetimes + merge-window, WGT-hold, tile placement (hold+duration→inline `--placement-duration`), energy conversion, hazard cleanup, scale-marker glide+settle, ares glide (+frame gate); LESS-мост: `resource_change_feedback` / `scale_marker` / `energy_conversion` на `calc(...*var(--motion-scale,1))`; `AnimatedMetricValue`: mount = тихий baseline, чипы ТОЛЬКО из watch (legacy-гейт для `tm_remount`). Конфиг: `?motion=calm|standard|swift` / `tm_motion_speed`, `?motionFps=30|60|auto` / `tm_motion_fps`. Premium-UI переключатель пресета — follow-up (premium-настроек-поверхности пока нет) |
| 3. Structural sharing | ✅ | `utils/viewSnapshotShare.ts` (`shareViewSnapshot`/`nextViewSnapshot`, флаг `?patch=0`/`tm_patch=0`); подключено во все 5 точек коммита (App.update player+spectator, WaitingFor.updatePlayerView, DraftFlow/InitialDraft/StartGameFlow) |
| 4. Тесты/замеры/доки | ✅ | Спеки: `AppNoRemount` (5), `viewSnapshotShare` (9), `feedback/animatedMetricValue` (4), `motion/motionTokens` (9) — все зелёные; список падений client-suite байт-в-байт равен базлайну (suite исторически красный в headless-среде: 204 pre-existing). perf-счётчики: `playerHome:mount`, `playerHome:resetTransientUi`, `metricValue:mount` (+существующий `playerView:commit`). CLAUDE.md обновлён |

**Лестница откатов (клиентская, мгновенная):** `?patch=0` → только structural sharing off
(wholesale swap Фазы 1) · `?remount=1` → полный legacy-remount (Фаза 1 off; sharing и «тихий
mount» AnimatedMetricValue автоматически отключаются, mount-diff поведение восстановлено).
Пресеты скорости: `standard` = байт-идентичные сегодняшним тайминги.
