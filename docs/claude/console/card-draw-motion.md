# Card draw motion — the ONE family (deck-draw finale rework, 2026-09-11)

Контракты семейства карточного добора после polish-итерации. Дополняет
`consoleCardArrival.ts` / `consoleBatchArrivalMotion.ts` / `deckDrawDirector.ts`
заголовки — здесь только то, что связывает их между собой.

## Законы семейства (нарушение = баг)

1. **Прибывшая карта не анимируется повторно.** Никаких пост-посадочных волн,
   прыжков, staggered-пульсов по построенному ряду. Старый `runDeckDrawSettle`
   (−6/+6 px, стаггер 50 мс по hold-ряду) УДАЛЁН; регресс-гард — фаза `settle`
   в `tests/e2e/console-deck-draw.spec.ts` (проба `data-dd-phase` на
   `.con-deckdraw`, семплится непрерывно всю сцену).
2. **Plain-добор летит ОДИН раз: колода → слоты reveal.** Standalone plain
   («взял N», ничего не вскрывалось) больше не строит hold-ряд, который тут же
   покидает: `ConsoleDeckDrawLayer.runPlainBatch` монтирует reveal VEILED с
   первого кадра (staged-грамматика бонус-сцен), меряет слоты и ведёт батч
   общим `runBatchArrival` — тем же, что embedded deck-pick / external draw /
   hydro. Единственное исключение — headless single (1 карта без claim):
   у viewer-а нет слота, hold-поза остаётся его физическим origin.
3. **Рамка материализуется ВОКРУГ приземляющегося ряда** (грамматика
   rise-директора): фаза `frame` ставится за ~70 мс до первой посадки
   (`onFrameCue` в `runDeckDrawAssemble`; таймер по `plan.beats[0].landAtMs` в
   plain-пути), а release реальных карт — на посадке, не отдельными фазами
   после. Пустые беаты «frame idle 240 → handoff 170» удалены; search-финал
   идёт `assemble → frame(на подлёте) → handoff(на посадке)`.
4. **Handoff интейка в руку — по контракту клонов**: press/back-лег целится в
   ЖИВУЮ позу (перечитка `poseForCopy` в touchdown — поза дока легитимно
   меняется за 820 мс дуги), реальное тело выходит под прокси, стоящим ровно
   на позе, прокси снимается на СЛЕДУЮЩЕМ кадре (никакого 200 мс фейда со
   смещённым двойником). Гонка с arrival-pop закрыта: `applyDockedPoses` не
   играет pop для карт из `heldSet` — их раскрытие принадлежит интейку.
   Числовой закон: `hand-delivery-probe` § THE HANDOFF LAW, `off ≤ 4px`
   (измерено 1.2 px @1080).
5. **Фокус входит мягко**: `.con-cards__slot` transform/box-shadow —
   240 мс `@con-ease-standard` (opacity остаётся 160 мс — это шов handoff-а);
   reveal-strip лифт 1.06/−0.3rem (был 1.1/−0.4rem). Появление кольца на
   свежеприбывшей карте не читается как рывок.

## Кому что принадлежит

| Событие | Директор |
| --- | --- |
| Любой батч «колода → подготовленные слоты» | `runBatchArrival` (+ `onCardPeeled(i)` для по-карточного тика счётчика колоды) |
| Search-театр (inspect / turn / tray-стрим) | `deckDrawDirector.runDeckDrawBeat` |
| Финал search: hold → слоты | `runDeckDrawAssemble` (каденция стартов 85 мс, `onFrameCue`) |
| Открытие карты | `premiumTurn.addPremiumTurn` — единственный |
| Взятие в руку | `runHandIntake` (cascade/stack; touchdown = press→release-на-позе→next-frame) |

## Замеры (search 2 карты, FHD standard)
- До: ряд собран → волна 470 → перелёт 375 → frame 240 → handoff 170 ≈ **1.5–1.6 с** декоративного хвоста.
- После: ряд собран → assemble сразу, рамка на подлёте, release на посадке ≈ **0.6–0.7 с**. 4K — тот же порядок (трейс-приёмка 2026-09-11).
