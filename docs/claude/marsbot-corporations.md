# MarsBot corporations — the production framework (RB-B «Adding Corporations»)

**Status: production (2026-08-19).** Реализованные корпорации: **C01 Credicor · C02 Ecoline (+B23 Rapid Sprouting) · C03 Helion (track cubes) · C45 Spire**. Официальные данные и трактовки: `docs/AUTOMA_DATA_AUDIT.md` §10 (RB-B транскрибирован полностью). Дизайн-референс upstream-типов: `docs/AUTOMA_CORP_FRAMEWORK_REFERENCE.md` (историческая записка — реализация НЕ по его фасаду).

## Модель

Корпорация бота — **отдельная игровая сущность**, никогда не human-карта с изменёнными числами. Оригинальная human-корпорация даёт ровно четыре официальные связи: имя/логотип, арт, лор, ключ коллизии при выборе (`original: CardName`). Ни одно human-правило (стартовые M€, first action, human-теги, скидки) через эту ссылку не протекает.

| Слой | Файл | Что |
| --- | --- | --- |
| id | `src/common/automa/AutomaTypes.ts` | `MarsBotCorpId` ('C01'…, официальные номера карт, конвенция BonusCardId), `MARS_BOT_CORP_IDS`, `AutomaOptions.corporation?` (dev/test-override — близнец `customBonusCards`) |
| данные | `src/common/automa/MarsBotCorpData.ts` | `MarsBotCorpInfo` (original, startingTags, draftPriority, resource 'plant'\|'science', corpBonusCards, **trackCubes** + `cubeLegend`, печатные секции-боксы), `buildMarsBotCorpView`, `MarsBotCorpModel` (+`cubes`), `MarsBotCorpStats` |
| поведение | `src/server/automa/corps/MarsBot<Name>.ts` | co-located: setup / beforeActionPhase / onProjectCardResolving / resolveBonusCard (своих B-карт) |
| диспетчер | `src/server/automa/corps/AutomaCorporations.ts` | REGISTRY, eligibility (чистый `isMarsBotCorporationEligible`), выбор, гейт BAP, драфт pick/discard, диспатчи |
| драфт | `src/server/automa/corps/MarsBotDraftResolver.ts` | pick по приоритету + пост-драфт protect/discard (RB-B p.2; порт upstream-логики) |
| state | `AutomaState.corporation / corpResources / corpStats / corpBapGeneration / corpCubesTriggered` | сериализуется опционально; старые сейвы = corpless навсегда (§legacy ниже) |

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


## Кубы на треках (RB-B «Special Cubes on the MarsBot Player Mat»)

Primitive, введённый вместе с **C03 Helion** (первая корпорация с кубами):

- **Данные**: `MarsBotCorpInfo.trackCubes` — `{tag, position, cubeType}`. Трек назван ТЕГОМ (печатные карты говорят «the building track», «the Earth track»), сервер резолвит его через `board.getTrackIndexForTag` — куб переносим на любой планшет, где такой трек есть, и молча отпадает там, где его нет.
- **Состояние**: `AutomaState.corpCubesTriggered` (ключи `trackIndex:position`, сериализуются). Куб срабатывает РОВНО ОДИН раз за партию; регресс трека НЕ перевзводит сработавший куб (дословное правило RB-B).
- **Диспатч**: `AutomaCorporations.onTrackAdvanced(game, trackIndex, position, printedAction)` вызывается из `AutomaResolver.advanceTrack` после шага и ДО печатного действия; помечает куб сработавшим ДО эффекта (эффект может каскадом вернуться на тот же трек) и возвращает `true`, если корпорация ЗАМЕСТИЛА печатное действие. Хук корпорации: `MarsBotCorp.onTrackCubeTrigger(...) → 'replaces-action' | void`.
- **Порядок RB-B**: эффект куба — ДО и В ДОПОЛНЕНИЕ к печатной иконке, если карта явно не сказала «вместо». Helion: белый куб = `'replaces-action'` (все шесть стоят на печатной temperature — закреплено тестом), чёрный = +1 температура плюс печатная иконка.
- **Модель + UI**: `MarsBotCorpModel.cubes` (`{trackIndex, position, cubeType, spent}`) → `MarsBotTracks` рисует куб в углу клетки (белый — светлое тело/тёмный обод, чёрный — тёмное тело/холодный обод, spent — гравированный контур) плюс **легенду** из `cubeLegend` (печатный смысл каждого цвета) и `data-hint` на клетке. Кубы — открытая информация: их видно и в console-детали «Планшет бота», и в desktop-оверлее.

## FAQ Ecoline (RB-B)

Растение НА карте корпорации — отдельная цель атак растений: `AutomaTargeting.corpPlantPool/removeCorpPlants` (excess is LOST, никогда не из M€-supply; вор получает ровно снятое). Опции в `RemoveAnyPlants` + `StealResources` (любой человек в мультиплеере); generic-прокси не тронут.

## FAQ: human-корпорации, реагирующие на бота (RB-B)

`AutomaHumanTagReactions.ts` — санкционированный **allowlist** (прецедент AutomaBans): ровно {Saturn Systems, Pharmacy Union, Splice}, как перечисляет RB-B. Диспатч из трёх точек резолва карты бота (`onBotCardResolved` — собственные `onCardPlayedByAnyPlayer` карт, атрибуция `withEffect` как у человеческого пути; возврат промпта для бота = громкий throw), из стартовых меток (`onBotNonCardTag` → `onNonCardTagAddedByAnyPlayer`, microbe → дальше) и из «microbe advancement» без карты (`onBotMicrobeAdvancement` → co-located `ICard.onMarsBotMicrobeAdvancement`; Venus-клетка 9 помечена `TrackDefinition.microbeTagCells`). Splice для бота берёт детерминированную M€-половину (микроб физически некуда класть). Исключение tracker-advance у Saturn — структурное: каскады через эти точки не проходят. Расширение санкции = новая строка в `SANCTIONED_REACTORS` + co-located хук в файле карты.

## UI — лицо = ОБЫЧНЫЙ премиальный `.pcard`

Карта бот-корпорации рендерится **один-в-один шаблоном премиальных корпораций** (владельческое требование 2026-08-19):

- **`MarsBotCorpFace.vue`** — тонкий хост: `buildMarsBotCorpPremiumVm(id, resources)` (`marsBotCorpPremiumVm.ts`, pure) строит настоящий `PremiumCardVM` и рендерит через ГЛОБАЛЬНЫЙ `premium-card-face` (`vmOverride` — единственный санкционированный вход для не-манифестных лиц; статический импорт PremiumCard.vue замыкает type-cycle через CardZoomModal→CardZoomCard и обрушивает vue-tsc в `{}`).
- **Механика под артом** = символьные боты-боксы, авторятся тем же `CardRenderer`-DSL (Credicor `[20MC]*: [4MC]`; Spire `◯◯*: [science]` + `10[science] → [city][TR]`; Ecoline `[plate B23] → [cards]`). `EMPTY_TAG` добавлен в `premiumCardIcons.mechItemIcon` (`assets/tags/empty.png`).
- **Медальон дополнения = 'automa'** (pseudo-module в `PremiumCardVM.expansion`; `expansionIconUrl('automa')` → `assets/expansion_icons/expansion_icon_automa.svg` — стилизованная «A» с антенной, mint, отлична от Ares).
- **Ресурс на карте** = штатная капсула `.pcard__res` (тот же сокет, что у карт игрока); Ecoline хранит РАСТЕНИЯ (не card-resource) → `resource.iconUrl`-override на стандартную иконку растений.
- **Полный текст правил** = правая «§ ПРАВИЛА» панель зума: `marsBotCorpRules.marsBotCorpAnnotations(id)` → `ConsoleCardRulesPanel :annotationsOverride` (те же группы/кикеры/tier'ы; kinds: draftPriority→action-gold, effect→blue, BAP→mint). Лор — оригинала (`loreCardName`).
- **«РАЗЫГРАНО» бота**: corporation-слот в `ConsolePlayedOverlay` (focus-ключ `botcorp`, физический lift через `data-zoom-slot`); хосты только МАСШТАБИРУЮТ фиксированный 320×460 бокс через `zoom` (console px-content правило).
- Дашборд бота (`ConsoleMarsBotSections`), identity во всех endgame/participant-местах (`marsBotCorpDisplayName`), Turn Review corporation-цепочки. Guard: `tests/e2e/console-bot-corporation.spec.ts` (1080p) + `MarsBotCorpFace.spec.ts` (.pcard-структура, automa-медальон, no-human-leak).

## Статистика

`AutomaState.corpStats` (сериализуется, публична в `MarsBotModel.corporation.stats`): draft-семейство (`draftPriorityPicks/draftPickTiesBroken/draftProtectionSaves/draftNoDiscardRounds/fiveCardDecks`) + пер-корп (`credicorTriggers/credicorMc`; `sproutingsPlayed/plantsAdded/plantsSpent/greeneries/oxygenSteps/plantsLostToOpponents`; `scienceAdded/scienceSpent/citiesPlaced/trGained/multiTagCards`). Endgame-инсайты читают эти structured-факты (плюс corporationFacts из событий) — не display-текст.

## Тесты

`tests/automa/AutomaCorporations.spec.ts` (framework/selection/collision/serialization), `MarsBotCredicor.spec.ts`, `MarsBotEcoline.spec.ts` (B23 lifecycle + FAQ), `MarsBotHelion.spec.ts` (кубы: сетап/замещение/spent-once/Failed/сериализация), `MarsBotSpire.spec.ts`, `tests/common/automa/MarsBotCorpData.spec.ts` (данные + no-human-leak), клиентские `MarsBotCorpFace.spec.ts`, `MarsBotTracksCubes.spec.ts` / review-спеки; e2e `console-bot-corporation.spec.ts` + `console-bot-corp-cubes.spec.ts`. В automa-тестах хелпер форсит **C01 Credicor по умолчанию** (самая инертная корпорация) — corp-тесты передают свою или `'random'`.
