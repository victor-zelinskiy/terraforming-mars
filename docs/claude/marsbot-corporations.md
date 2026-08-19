# MarsBot corporations — the production framework (RB-B «Adding Corporations»)

**Status: production (2026-08-19).** Первые три корпорации: **C01 Credicor · C02 Ecoline (+B23 Rapid Sprouting) · C45 Spire**. Официальные данные и трактовки: `docs/AUTOMA_DATA_AUDIT.md` §10 (RB-B транскрибирован полностью). Дизайн-референс upstream-типов: `docs/AUTOMA_CORP_FRAMEWORK_REFERENCE.md` (историческая записка — реализация НЕ по его фасаду).

## Модель

Корпорация бота — **отдельная игровая сущность**, никогда не human-карта с изменёнными числами. Оригинальная human-корпорация даёт ровно четыре официальные связи: имя/логотип, арт, лор, ключ коллизии при выборе (`original: CardName`). Ни одно human-правило (стартовые M€, first action, human-теги, скидки) через эту ссылку не протекает.

| Слой | Файл | Что |
| --- | --- | --- |
| id | `src/common/automa/AutomaTypes.ts` | `MarsBotCorpId` ('C01'…, официальные номера карт, конвенция BonusCardId), `MARS_BOT_CORP_IDS`, `AutomaOptions.corporation?` (dev/test-override — близнец `customBonusCards`) |
| данные | `src/common/automa/MarsBotCorpData.ts` | `MarsBotCorpInfo` (original, startingTags, draftPriority, resource 'plant'\|'science', corpBonusCards, печатные секции-боксы), `buildMarsBotCorpView`, `MarsBotCorpModel` (публичная модель), `MarsBotCorpStats` (словарь счётчиков) |
| поведение | `src/server/automa/corps/MarsBot<Name>.ts` | co-located: setup / beforeActionPhase / onProjectCardResolving / resolveBonusCard (своих B-карт) |
| диспетчер | `src/server/automa/corps/AutomaCorporations.ts` | REGISTRY, eligibility (чистый `isMarsBotCorporationEligible`), выбор, гейт BAP, драфт pick/discard, диспатчи |
| драфт | `src/server/automa/corps/MarsBotDraftResolver.ts` | pick по приоритету + пост-драфт protect/discard (RB-B p.2; порт upstream-логики) |
| state | `AutomaState.corporation / corpResources / corpStats / corpBapGeneration` | сериализуется опционально; старые сейвы = corpless навсегда (§legacy ниже) |

**Добавление корпорации N+1**: строка в enum → запись данных в `MarsBotCorpData` → файл поведения → строка в `REGISTRY` → RU-ключи → спек. Ни один switch за пределами registry не растёт; UI/сериализация/статистика подхватывают автоматически.

## Тайминг (ONE gate)

`Game.playerIsFinishedWithResearchPhase` — единственный research→action переход (все поколения). Там `AutomaCorporations.onActionPhaseStart`:
- **gen 1**: выбор корпорации (случайный seeded из eligible; dev-override если eligible) — строго ПОСЛЕ розыгрыша корпораций всех людей (RB-B Setup 1) и ДО прелюдий (фаза PRELUDES вложена в первый ход) → Setup box → starting tags «как у вскрытой карты» (`AutomaResolver.resolveTag`; трек двигается, действия клеток срабатывают — Earth[1]='city' у Spire реально ставит город; позиция трека = перманентный «tag count» бота);
- **каждое поколение** (включая 1-е): Before-Action-Phase box, гард `corpBapGeneration`.

Пустой eligible-пул — invariant error (Spire всегда eligible: её human-двойник требует Prelude 2, конфликтующий с ботом). Легаси-сейв без корпорации, ушедший дальше 1-го поколения, живёт corpless (гард `generation === 1`); все его пути (random-драфт, discard shuffle-first) байт-идентичны прежним.

## Драфт (RB-B)

Pick: приоритет корпорации; равные → случайно (seeded), нет совпадений → случайно. Дискард: shuffle → первый НЕзащищённый уходит; защищено всё → сброса нет → **колода действий из 5 карт** (никаких `length === 4` assumptions). «Most tags» = печатный ряд `AutomaResolver.printedTags` (event-метка и wild считаются; исключение wild в RB-B скоуплено на tag-chain приоритеты). Corpless / без приоритета: официальный random + discard-first (rng-идентично старому коду).

## События / подача

- Эффект корпорации в ходе: `events.beginEffect(bot, {kind:'corporation', card: original, owner}, 'automa-corporation')` → journal + `corporationFacts` (passive-метрики) бесплатно; турн-скрипт получает cause `{kind:'corporation'}` → «Разбор хода» строит цепочку «Эффект корпорации» (`botTurnReviewModel`, id из архива).
- Вне хода (выбор, Spire-город): `beginAction(..., {category:'corporation-action'})` → нотификация «Corporation action» + журнальная группа.
- B23 — recurring-механизм B16-семейства (`recurringBonusCards`); gen-1 вставка seeded-random позицией в готовую колоду (идемпотентно, ровно одна копия навсегда).

## FAQ Ecoline (RB-B)

Растение НА карте корпорации — отдельная цель атак растений: `AutomaTargeting.corpPlantPool/removeCorpPlants` (excess is LOST, никогда не из M€-supply; вор получает ровно снятое). Опции в `RemoveAnyPlants` + `StealResources` (любой человек в мультиплеере); generic-прокси не тронут.

## UI

- **Лицо**: `MarsBotCorpFace.vue` — семейство `mb-face` (`--corp`, `--large`); identity = `PremiumCorpIdentity` (wordmark оригинала), арт = `premiumCardArt(original)`, боксы карты с кикерами, стартовые метки только если напечатаны, счётчик ресурса.
- **Fullscreen**: union-вход `marsBotCorpZoomEntry` (`cardZoomTypes.ts`) → `CardZoomCard`; лор — оригинала (`CardZoomModal.loreCardName`).
- **«РАЗЫГРАНО» бота**: corporation-слот в `ConsolePlayedOverlay` (focus-ключ `botcorp`, физический lift через `data-zoom-slot`).
- Дашборд бота (`ConsoleMarsBotSections`), identity во всех endgame/participant-местах (bot corporation name через `marsBotCorpDisplayName`), Turn Review corporation-цепочки.

## Статистика

`AutomaState.corpStats` (сериализуется, публична в `MarsBotModel.corporation.stats`): draft-семейство (`draftPriorityPicks/draftPickTiesBroken/draftProtectionSaves/draftNoDiscardRounds/fiveCardDecks`) + пер-корп (`credicorTriggers/credicorMc`; `sproutingsPlayed/plantsAdded/plantsSpent/greeneries/oxygenSteps/plantsLostToOpponents`; `scienceAdded/scienceSpent/citiesPlaced/trGained/multiTagCards`). Endgame-инсайты читают эти structured-факты (плюс corporationFacts из событий) — не display-текст.

## Тесты

`tests/automa/AutomaCorporations.spec.ts` (framework/selection/collision/serialization), `MarsBotCredicor.spec.ts`, `MarsBotEcoline.spec.ts` (B23 lifecycle + FAQ), `MarsBotSpire.spec.ts`, `tests/common/automa/MarsBotCorpData.spec.ts` (данные + no-human-leak), клиентские `MarsBotCorpFace.spec.ts` / review-спеки. В automa-тестах хелпер форсит **C01 Credicor по умолчанию** (самая инертная корпорация) — corp-тесты передают свою или `'random'`.
