# Console Native UI — TV 4K: аудит-2 и программа реворка (2026-07-19)

> Статус: В РЕАЛИЗАЦИИ (итерация 2). Итерация 1 (2026-07-17/18) НЕ ПРИНЯТА пользователем:
> хорошо выглядят только стартовый выбор, старт партии, драфт, fullscreen-карта и fullscreen-правила.
> Эталонная конфигурация: `[console-display] profile=tv scale=2 viewport=3840×2160 physical=3840×2160 dpr=1`
> (LG OLED42C34LA, геймпад, 1.5–2 м). Console Native — основной продукт; desktop заморожен.
> Визуальные доказательства: 9 скриншотов 2026-07-19 (`C:\Users\zelin\sm_mars_sreenshots\20260719*.jpg`).

---

## 0. Почему итерация 1 провалилась (честный диагноз)

Итерация 1 подняла ~40 отдельных font-size в `console_tv.less` и починила командный бар/слои,
но НЕ тронула то, из чего реально состоят проблемные экраны: **переиспользованный desktop-контент,
авторизованный в px**, и **двухканальную модель масштабирования** (rem-канал × zoom-канал),
которая на TV даёт то двойной, то нулевой рост. Поэтому «поднятые» экраны всё равно читаются
как уменьшенный desktop: оболочка выросла, содержимое — нет.

## 1. Пять системных корней (аудит-2, с доказательствами)

| # | Корень | Доказательство | Что порождает |
| --- | --- | --- | --- |
| R1 | **px-контент внутри rem-оболочек.** Консоль реиспользует desktop-компоненты, чьи стили в px и не видят ни rem-базу 40px, ни `--con-ui-scale`. | Журнал: `journal.less` — время **10px** (:560,:647), тело группы **13.5px** (:658), child-строки **12px** (:727), импакт-чипы **12px**/иконка **15px** (:896-901), чипы карт **12px** (:1022), divider **11px** (:971). Бот-ревью: `bot_review.less` — весь `.mbr` на `--mbr-fz` (console `large` = **15px**, :175), панель `min(1500px,96vw)` (:130). Чип эффектов: `ActionEffectChip.vue` — **13px**/иконка **22px** + px gap/padding (:100-207). `BenefitGlyph` иконка **32px** (`colonies_overlay.less:1845`), `HydroReward` **26/22px** (`hydronetwork.less:504-570`) | Журнал/бот-ревью/чипы результатов физически нечитаемы с дивана; «оболочка большая, контент мелкий» |
| R2 | **Двухканальный масштаб: rem×2 И zoom×2 компаунднутся, либо zoom без ×scale не растёт вовсе.** | Колонии: `.con-coltile__cell-value { zoom: calc(1.22*var(--con-ui-scale)) }` (console.less:7404) содержит rem-цифру `__cell-num` TV 1.1rem → **44px × 2.44 zoom ≈ 107px**, а px-глиф 32px → 78px; production-глиф ещё и `scale(0.6)` (:7326). Гидросеть: `zoom: 1.15` (`__def-reward` :1794) и `zoom: 1.1` (`__bonus` :1835) — «голые», на TV НЕ растут | «Огромные цифры / мелкие иконки» (колонии), микро-чипы бонусов (гидросеть) |
| R3 | **Целые поверхности без TV-блока.** | `console_tv.less`: НЕТ блоков для `.con-bot-review`/`.mbr` (ноль правил), `.con-prodloss` (только focus-ring), `.con-macere`, `.con-marsbot*`, `.con-alert`, `.con-colonies` (корень секции), `.con-home__title/__ma*/__foot`, `.con-award*` (кроме legend-floor), фильтров `.con-cardactions__filters`, `.con-banner` (только позиция) | Правая панель = base-размеры ×scale (тонкие полосы 0.25rem, шрифты .675-.825rem); бот-ревью полностью desktop |
| R4 | **Хрупкий командный слой confirm-поверхностей.** Один shared-слот `consolePanelUi` (один owner на все панели). | `consolePanelUi.ts:20-42`; `ConsoleActionComposer` публикует Confirm/Cancel через `setPanelCommands('actionComposer')` (:579-585), а fallback ветки shell — ЧУЖИЕ верды `Perform/Inspect/Close` (`ConsoleShell.vue:2636-2643`); `ConsoleCardActions` при открытом композере держит слот пустым/несвежим (:428-430, :531-538). `ConsolePlayCardConfirm` использует ВЫДЕЛЕННЫЙ store `consolePlayCardUi` и не страдает (:758-778) | Пустой/чужой командный бар под подтверждением действия (скриншот 20260719180516) |
| R5 | **Confirm действия — информационно слабый.** | `ConsoleActionComposer.vue`: no-decisions ветка = kicker + имя + два микро-чипа (hero chips .9rem/1.3rem, console.less:12569) в панели `min(44rem,92vw)`; нет карты-источника, нет CTA-строки (в отличие от `ConsolePlayCardConfirm` :238-247) | Игрок не видит, ЧТО он подтверждает: ни карты, ни внятного preview |

Дополнительные факты: токены `--con-t-*` определены ТОЛЬКО на `html.con-profile-tv`
(`console_tv.less:62-73`) — в базе их нет, использовать в base-правилах нельзя без fallback;
общего примитива «ресурс-чип (иконка+число)» в консоли нет — каждая поверхность повторяет
`resource_icon`-бокс вручную (25 компонентов, ~7 разных размеров).

## 2. Карта скриншот → корень

| Скриншот | Симптом | Корни |
| --- | --- | --- |
| 180318 журнал | время 10px≈20px физ., тело 13.5px, чипы 12px — нечитаемо | R1 |
| 180456 действия карт | графика действия и чипы «списано/получите» микроскопические на пустом экране | R1 (ActionEffectChip px) + недостаточные zoom-факторы |
| 180516 подтверждение | микро-модалка, пустой командный бар, нет preview | R4 + R5 + R1 |
| 180310 гидросеть | микро-чипы требований/бонусов, пустая середина | R2 (голые zoom) + R3 |
| 180252 std projects | мелкие иконки, слабая плотность | R3 (частичный TV-блок) |
| 180238 правая панель | тонкие полосы, мелкие значения | R3 |
| 180245 колонии | цифры ~107px рядом с иконками 78/47px, флоты 1.1rem | R2 |
| (без скриншота) бот-ревью | полностью desktop | R1 + R3 |

## 3. Системные решения (примитивы, а не точечные правки)

### S1. Токены в базу + чип-токены
`console.less` (scope `html.console-native`) получает ОПРЕДЕЛЕНИЯ `--con-t-*`, `--con-hit-min`
с базовыми (не-TV) значениями; `console_tv.less` продолжает их переопределять. Новые токены:
`--con-chip-fs` / `--con-chip-icon` / `--con-chip-pad` (чипы эффектов), `--con-res-icon`
(стандартный бокс ресурс-иконки в контенте). Не-TV профили визуально не меняются (значения = текущим).

### S2. Единый масштаб чипов эффектов (`ActionEffectChip`) в консоли
Один блок в `console.less`: для перечисленных console-корней (`.con-composer`, `.con-cardactions`,
`.con-task`, `.con-govsupport`, `.con-trade`, `.con-hydro` и др. — по grep импортов)
`.action-effect-chip` переезжает на rem-метрики от чип-токенов (font/icon/gap/padding/note).
TV переопределяет только токены. Запрещено давать чипу rem-размеры внутри контейнера с
`zoom: calc(...*var(--con-ui-scale))` (двойной масштаб — R2).

### S3. Дисциплина zoom
Правило: **контейнер с px-контентом масштабируется `zoom: calc(X * var(--con-ui-scale,1))`;
rem-текст внутри такого контейнера ЗАПРЕЩЁН** (внутри — только px, `keep-px`). Свип
существующих нарушений: hydro `__def-reward`/`__bonus` (голые zoom), coltile `__cell-num`
(rem внутри zoom), `.mbr` (px без zoom).

### S4. Выделенный командный канал композеров
`ConsoleActionComposer` переезжает с shared `consolePanelUi` на выделенный store (зеркало
`consolePlayCardUi`); ветка `commands()` для открытого композера даёт честный fallback
`[A Подтвердить, B Отмена]`, `commandContext` = «Подтверждение»/«Настройка действия».
Бар под confirm НИКОГДА не пуст.

### S5. Бот-ревью: единый канал масштаба
`.con-bot-review__scroll { zoom: var(--con-ui-scale,1) }` + панель в rem
(`min(78rem, 96vw)`); весь `.mbr` остаётся px (один канал — честный ×2). Плюс TV-блок
для заголовка/бара. Это НЕ «desktop fallback» — контент бот-ревью уже console-shared,
он просто не масштабировался.

## 4. Per-screen план (проблема → причина → подход → файлы → критерий)

### 4.1 Подтверждение действия карты (P0, full rework)
- Проблема: микро-модалка, пустой бар, нет контекста (скриншот 180516).
- Причина: R4 + R5.
- Подход: композер-confirm становится TV decision frame: карта-источник (`ConsoleCardFaceLite`)
  слева, крупный hero «БУДЕТ СПИСАНО → ВЫ ПОЛУЧИТЕ» (чипы S2), явная CTA-строка с Ⓐ
  (паттерн `ConsolePlayCardConfirm`), выделенный командный канал (S4).
- Файлы: `ConsoleActionComposer.vue`, `ConsoleShell.vue` (ветка commands/commandContext),
  новый store в `consolePanelUi.ts` или отдельный модуль, `console.less` §composer, `console_tv.less` §19.
- Критерий: с 2 м видно карту, цену, результат; бар всегда показывает Подтвердить/Отмена.

### 4.2 Экран «Действия карт» (P0, layout+scale)
- Причина: R1 (чипы), малые zoom-факторы графики, фильтры без TV-блока.
- Подход: графика мастера `calc(1.15→1.5×scale)`, деталь `calc(1.25→1.8×scale)`; чипы → S2;
  фильтры/verdict/usage → TV-токены; пустота мастера — тайлы крупнее, hit-min строки.
- Файлы: `console.less` §12241-12513, `console_tv.less` §19.
- Критерий: иконки действия ≥ ~64px физ.; чипы результата ≥ 21px текст.

### 4.3 Журнал (P0, row redesign)
- Причина: R1 — весь фид px.
- Подход: console-scoped рестайл фида ВНУТРИ `.con-journal` (console.less + TV-блок):
  время → .8/.9rem с контрастом, тело группы → 1.0/1.15rem, child-строки → .95/1.05rem,
  импакт-чипы → 1rem текст/1.4rem иконка, чипы карт/игроков → 1rem, divider поколения → .9rem,
  replay-кнопка ≥ floor; интервалы строк ↑; спайн-акцент толще. Desktop-журнал не трогаем
  (правила только под `.con-journal`).
- Файлы: `console.less` §5460-5850, `console_tv.less` §15.
- Критерий: время и все чипы читаемы с 2 м; ноль текста < 16 логич. px.

### 4.4 Гидросеть (P1, scale+composition)
- Причина: R2 (голые zoom), R3 (полу-покрытие).
- Подход: `__def-reward`/`__bonus` → `calc(...*scale)`; `__stage-tag` 2.3→3rem TV; req-строки
  и бонус-строки → hit-min, шрифты ≥ secondary; history/req-have/req-energy TV-бампы;
  средняя пустота — крупная сетка требований + рост бонус-строк.
- Файлы: `console.less` §1346-2035, `console_tv.less` §13.
- Критерий: все чипы этапа/требований ≥ 21px текст, иконки ≥ 44px физ.

### 4.5 Стандартные проекты (P1, scale)
- Подход: расширить TV-блок §11b: иконка 2.6→3.2rem, стоимость `resource_icon` 1.3→1.7rem,
  кнопка A .8→1rem + hit-min, desc → body, строки выше.
- Файлы: `console_tv.less` §11b (+ мелочи в базе).
- Критерий: сравнение проектов читается с дивана без вглядывания.

### 4.6 Правая панель board home (P1, content-only; footprint НЕ меняется)
- Причина: R3 — `.con-home__ma*`, `.con-award*`, `__title`, `__foot` без TV-блока.
- Подход: TV-блок: заголовки → .95rem, ma-строки → .95rem/выше, прогресс-бар 2.6×.25 →
  3.6×.45rem, ma-progress → 1.05rem, award-grid cols 2.4/5 → 3/6rem, флаг/корона/куб ≥ 1rem,
  `__state`/`__foot` ≥ caption. Ширина панели (26%/27rem) не растёт, борд не уменьшается.
- Файлы: `console_tv.less` §4.
- Критерий: прогресс вех и статусы наград читаются с 2 м; панель не расширилась.

### 4.7 Колонии (P1, scale normalization)
- Причина: R2 (rem-в-zoom), флоты/трек мелкие.
- Подход: `__cell-num` → px внутри zoom (один канал), production-глиф scale 0.6→0.8,
  tile-глиф → px; трек-ячейки .45→.6rem TV, `__track-pos` ≥ floor; флоты: berth 1.5→2rem,
  корабль 1.1→1.5rem, on-tile dock 1.05→1.4rem TV; `__cell-offset` ≥ floor.
- Файлы: `console.less` §7157-7461+6971-7147, `console_tv.less` §14.
- Критерий: цифра и иконка в ячейке ТОРГОВАТЬ/БОНУС сопоставимого веса (≤1.5× разницы);
  флоты видны с дивана.
- Примечание: `.con-coltile__cell-num` в px — это `keep-px` по правилу S3.

### 4.8 Осмотр хода MarsBot (P0, TV-нативизация масштаба)
- Причина: R1+R3 — ноль TV-правил, панель 1500px на 3840px экране.
- Подход: S5 (zoom-канал для `.mbr`), панель `min(78rem,96vw)`, заголовок/бар — токены;
  `--mbr-fz` console-large остаётся px (один канал).
- Файлы: `bot_review.less` (только `.con-bot-review*`-часть), `console_tv.less` (новый §26).
- Критерий: тело ревью ≈ 30px физ., панель ≥ 80% ширины, шаги/чипы читаемы с 2 м.

### 4.9 Production loss / прочие TASK-поверхности без TV-блока (P2)
- `.con-prodloss` TV-типографика; `.con-alert`; `.con-macere` — токен-свип.
- Критерий: floor соблюдён.

## 5. Что НЕ трогаем (осознанно)
- Endgame / FinalScoringReveal / Rematch / composite `and` / Turmoil-Underworld fallback —
  отдельная будущая программа (desktop-fallback, как и раньше).
- Игровая доска и её масштаб; левый ресурс-рельс (уже TV-покрыт); статус-стрип (покрыт);
  fullscreen-карта/правила, старт, драфт, reveal (приняты).
- Серверные контракты, turnIntents/taskResponses, режиссёры полётов, gamepadPollModel.

## 6. Порядок реализации
1. S1+S2+S3 (примитивы/токены/чипы/zoom-свип) — фундамент.
2. 4.1 confirm + S4 (командный канал) → 4.2 действия карт.
3. 4.3 журнал → 4.8 бот-ревью.
4. 4.4 гидросеть → 4.5 std projects → 4.6 правая панель → 4.7 колонии.
5. 4.9 хвост + верификация.

## 7. Верификация
- `npm run make:css` + `vue-tsc --noEmit` + ESLint по изменённым файлам.
- Гарды: `consoleTvTypeFloor.spec.ts` (floor), существующие console-спеки.
- Скриншот-матрица `tests/e2e/tv-profile-screens.spec.ts` (tv-4k 3840×2160 + deck-handheld +
  standard-1080 регресс).
- Ручная приёмка на LG C3 — обязательный финальный пункт (вне этой сессии).
- Критерии готовности: ни одного видимого текста < 16 логич. px на переработанных экранах;
  иконки ресурсов в контенте ≥ ~44px физ.; командный бар никогда не пуст под confirm;
  одинаковые сущности (ресурс-чип, дельта) имеют сопоставимый размер на всех экранах.

---

# СТАТУС РЕАЛИЗАЦИИ (итерация 2) — обновляется по ходу

## Выполнено (2026-07-19)

**S1+S2 — чип-система:** токены `--con-chip-fs/icon/pad/note` определены в базе
(`console.less`, `html.console-native`), TV-значения (1.05rem/1.6rem) в `console_tv.less`,
handheld-компакт (.75/1.1) в handheld-блоке. ОДНО правило масштабирует `ActionEffectChip`
во всех console-корнях (`.con-task-host/.con-composer/.con-cardactions/.con-reveal/
.con-govsupport/.con-trade/.con-prodloss`); пер-поверхностные рестейтменты чипов удалены
(cardactions formula/detail, composer hero/branch/opt, playcard pay-row) — иерархические
акценты выражены через `calc()` от токенов.

**S3 — zoom-дисциплина:** hydro `__def-reward`/`__bonus` (оба файла) и hydroconfirm
`__rawchips` переведены на `calc(X * var(--con-ui-scale,1))`; rem-текст внутри zoom-контейнеров
переведён в px + keep-px (`__stop-or`, `__bonus-tick`/`__tick`, coltile `__cell-num`/`__cell-offset`).

**S4 + 4.1 — confirm действия (FULL REWORK):**
- Найден и устранён корень «пропавшей панели действий»: `footerUnderScene` ронял ВЕСЬ футер
  (z 11390) под почти-непрозрачный TV-бекдроп каждой центральной сцены. Теперь футер падает
  только под bottom-anchored поверхности (played table / draft pick / bot review / stranded);
  центральные decision-поверхности держат бар НАВЕРХУ и паркуют hand dock
  (`dockParkedUnderScene`, v-show). Старый полный предикат сохранён как `sceneOverHand`
  для verdict-бара руки.
- `ConsoleActionComposer` переехал с shared `consolePanelUi` на выделенный store
  `consoleActionComposerUi.ts` (зеркало `consolePlayCardUi`); ветка `commands()` в shell
  читает его с честным фолбэком [A Подтвердить · B Отмена]; `commandContext` = «Confirmation».
- Композер получил карту-источник (`ConsoleCardFaceLite`, колонка `__actmain/__actcard`,
  скрыта на handheld) и явную фокусируемую CTA-строку с Ⓐ (`__cta`, паттерн play-confirm;
  фокус-индекс расширен на CTA). Панель `--act` 56rem/94vw (TV 70rem).
- `.con-composer`/`.con-cardactions` получили нижний clearance под бар.

**4.2 — Действия карт:** TV-блок расширен с 6 до ~40 правил: графика действия
`calc(1.5×scale)` (мастер) / `calc(1.9×scale)` (деталь), фильтры/чипы/verdict/usage/статы/
empty-state на токенах, тайлы hit-min.

**4.3 — Журнал:** px-внутренности фида (время 10px, тело 13.5px, child 12px, импакт-чипы
12/15px, чипы карт, divider, replay) переавторизованы в rem внутри `.con-journal`
(база ≈ прежний вид) + TV-ретюн §15 (время floor с контрастом, тело 1.05rem, чипы secondary,
иконки 1.3rem, ритм строк); заголовочные контролы журнала подняты с .55-.625rem до floor+.

**4.4 — Гидросеть:** TV-блок дополнен (~30 правил): stage-tag 3rem, req-строки hit-min +
secondary, треки/история/маршрут/дельты (delta-img 1.7rem, beforeafter 1.2rem), hydroconfirm
полностью покрыт.

**4.5 — Std projects:** иконка 3rem/плита 4.2rem, cost/gain 1.5rem+coin 1.7rem, desc → body,
кнопка Ⓐ secondary, context-line/wallet-preview покрыты.

**4.6 — Правая панель (footprint не менялся):** TV-блок для `.con-home__title/__ma*/__state/
__foot` (0.9-1rem), прогресс-бар 3.2×0.35rem, `.con-award*` grid 2.8/5.6rem + флаг/корона/куб
≥0.85rem — плотные паддинги сохранены (modular-MA списки не переполняются).

**4.7 — Колонии:** устранён двойной масштаб цифр (`__cell-num` 20px keep-px внутри zoom;
TV-override 1.1rem удалён), production-глиф в build-слотах scale 1.05 на TV, трек 0.6rem +
позиции floor, флоты: berth 1.9rem/корабль 1.45rem (fleetbar), док на тайле 1.45rem,
inspect fleet-line 1.9rem, trade payrow-icon 1.6rem.

**4.8 — Бот-ревью:** новый TV-блок §19b — панель `min(78rem,96vw)` (было 1500px ≈ 39% 4K),
`__scroll { zoom: var(--con-ui-scale) }` (px-тело `.mbr` масштабируется одним каналом ×2),
заголовок на токенах, edge-notice масштабирован; бот-карта `.con-notif` — summary/чипы/мета
подняты (§16).

**Верификация:** `make:css` ✓, `vue-tsc --noEmit` ✓ (0 ошибок), ESLint по изменённым файлам ✓,
floor-guard `consoleTvTypeFloor.spec.ts` ✓, console-спеки ✓ (см. итоговый отчёт сессии).

## Не выполнено / следующие волны
- `.con-info__effects` (Info Mode) — px-эффекты в rem-гриде, требует раздельного канала (§S3);
  `.con-task__source-label` bare zoom 1.1 (некритично).
- `.con-macere`/`.con-marsbot*`/`.con-alert`/`.con-prodloss` — токен-свип (P2, 4.9).
- Ручная приёмка на LG C3 — обязательна (§7).
- Endgame/FSR/Rematch/composite `and` — отдельная программа (без изменений).
