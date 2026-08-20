# MarsBot corporations — the production framework (RB-B «Adding Corporations»)

**Status: production (2026-08-19; C04–C11 добавлены 2026-08-20).** Реализованные корпорации: **C01 Credicor · C02 Ecoline (+B23 Rapid Sprouting) · C03 Helion (track cubes) · C04 Interplanetary Cinematics (per-advance эффект + белые маркеры) · C05 Inventrix (+B25 Do It Right, destroy-at-setup) · C06 Mining Guild (банк M€ на карте) · C07 PhoboLog (смешанная бонус-колода) · C08 Saturn Systems (триггер по обеим сторонам стола) · C09 Teractor (выплата за трек Земли) · C10 Tharsis Republic (триггер на размещение города с обеих сторон) · C11 ThorGate (карта по первой метке) · C45 Spire**. Официальные данные и трактовки: `docs/AUTOMA_DATA_AUDIT.md` §10 (RB-B транскрибирован полностью). Дизайн-референс upstream-типов: `docs/AUTOMA_CORP_FRAMEWORK_REFERENCE.md` (историческая записка — реализация НЕ по его фасаду).

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

## Эффект НА КАЖДОЕ продвижение трека + белые маркеры-напоминания

Primitive, введённый вместе с **C04 Interplanetary Cinematics**:

- **Физика выплаты — ОБЩАЯ**: `MarsBotTrackPayout.payForTrackAdvance` (вынесена при добавлении C09 Teractor). Карта объявляет `TrackPayout` — какие треки платят (ТЕГАМИ), сколько, как это называется в журнале и какие счётчики бампает; хук остаётся однострочным. Вопрос «мой ли это трек» — у корпорации, ответ (scope, M€, журнал, счётчики) — у общего модуля, поэтому одинаковое печатное предложение C04 и C09 не может разойтись.
- **Хук**: `MarsBotCorp.onTrackAdvance(game, trackIndex, position)` — вызывается из того же места, что и кубы (`AutomaCorporations.onTrackAdvanced`, из `AutomaResolver.advanceTrack`) после КАЖДОГО успешного шага и ДО печатной иконки. Соседство с кубами не случайно: оба говорят «бот только что встал на клетку», и оба обязаны отработать до того, как клетка сделает своё.
- **Что считается продвижением**: ровно один шаг. Каскад `advance` платит за каждый свой шаг; трек в максимуме (официальный Failed Action) не платит вовсе — диспатч туда не доходит; регресс ничего не «тратит» (это не куб). Всё закреплено тестами.
- **«Including the starting tags»** не требует спец-кода: `selectCorporation` сажает корпорацию (`automa.corporation = id`) ДО резолва Setup-бокса и стартовых меток, поэтому печатные метки идут через тот же хук.
- **Белые маркеры**: `MarsBotCorpInfo.whiteMarkerTracks` (список ТЕГОВ) + `markerLegend`. Это ЧИСТОЕ напоминание (карта так и говорит: «as a reminder»), у него нет игрового эффекта — но игрок, который смотрит планшет бота, должен видеть то же, что видит игрок за столом: `MarsBotCorpModel.whiteMarkerTracks` (индексы) → `MarsBotTracks` красит маркер текущей позиции этих треков белым кубом и добавляет строку легенды. Пара `whiteMarkerTracks`/`markerLegend` обязательна целиком — маркер без объяснения был бы украшением (гард в `MarsBotCorpData.spec.ts`).

## Уничтожение карты бонусной колоды на сетапе + общая «лестница ближайшего бонуса»

Primitive, введённый вместе с **C05 Inventrix**:

- **Destroy-at-setup**: `setup` находит нужную бонусную карту и убирает её ИЗ ИГРЫ (`destroyedBonusCards`), вычищая из `bonusDeck` и `bonusDiscard`. Гоча порядка: наш движок строит колоду действий 1-го поколения ПРИ СОЗДАНИИ игры, до появления корпорации, поэтому уничтожаемая карта может уже занимать единственный бонусный слот этой колоды — тогда слот отдаётся следующей карте бонусной колоды (за столом сетап-бокс отработал бы раньше и слот достался бы именно ей), и размер колоды не меняется. Печать выбирается по составу игры: «Лоббисты» это B06 без Венеры и B15 с ней.
- **Общая лестница** `AutomaNearBonusPush.pushNearestBonus(game, 'ocean' | 'venus')` — печатные варианты a/b/c карт **B06/B15 Lobbyists** и **B25 Do It Right** совпадают дословно, поэтому физика (и ключ ветки для обзора хода) живёт в ОДНОМ модуле; каждая карта владеет только своей судьбой и своим (d). Одна реализация = один ответ на правило «1–2 шага до бонуса» для обеих карт.
- **«No effect» — печатный исход, а не Failed Action.** Компенсацию 5 M€ бот получает, когда попытался и не смог; карта, которая печатает «d. No effect», просто ничего не делает (закреплено тестом).

## Банк M€ на карте корпорации (перехват дохода бота)

Primitive, введённый вместе с **C06 Mining Guild**:

- **Данные**: `MarsBotCorpInfo.mcBank = {size, trackTag}` — сколько кладётся на карту и какой трек двигается при опустошении (трек назван ТЕГОМ, как и кубы).
- **Точка перехвата ОДНА**: `Stock.add` (`delta > 0 && resource === MEGACREDITS && player.isMarsBot`) → `AutomaCorporations.onBotGainedMegacredits` → хук корпорации `onMegacreditsGained`. Доходы бота приходят отовсюду (клетки треков, покрытые иконки, компенсация Failed Action, эффекты других корпораций) — перехватывать их по местам было бы решетом. Прецедент слоя: `Production.add` уже держит automa-ветку.
- **Семантика «take it from this card instead»**: карта — РЕЗЕРВУАР, а не пошлина. Бот получает M€ как обычно (его баланс растёт), просто кубики берутся с карты; то, что карта реально конвертирует — доход в ТЕМП: каждые полные `size` M€ = одно бесплатное продвижение трека.
- **Слив — цикл, а не вычитание**: доход больше остатка опустошает карту, перезаправляет её, двигает трек и продолжает брать из свежей стопки (25 M€ при полной карте = 2 продвижения и 5 M€ на карте).
- **«#18» = КОНЕЦ трека** (`track.maxPosition`), а не литерал: продвижение никогда не становится Failed Action, а на конце эффект честно выключается — остаток дохода идёт из общего запаса.
- **Реентерабельность**: продвижение само может заплатить боту (покрытые иконки океана, компенсация Failed Action) и снова войти в слив. Перезаправка выполняется ДО продвижения, поэтому вложенный доход уже видит полную карту; есть счётчик глубины (`MAX_DRAIN_DEPTH`) как runaway-гард. Инвариант, закреплённый тестом: `banked === refills * size + (size − остаток)`.
- **Подача**: `resource: 'megacredits'` → штатная капсула `.pcard__res` с `iconUrl`-override на стандартную иконку M€ (M€ не `CardResource`, как и растения Ecoline).

## Смешанная бонус-колода (проектные карты внутри)

Primitive, введённый вместе с **C07 PhoboLog**:

- **Тип колоды**: `AutomaState.bonusDeck` стал `Array<AutomaActionCard>` — тем же союзом, что и колода действий (`{kind:'bonus', id}` | `{kind:'project', name}`). Старые сейвы хранили голые `BonusCardId`, десериализатор поднимает их до `{kind:'bonus'}` (закреплено тестом).
- **Посев**: данные `MarsBotCorpInfo.bonusDeckSeed = {tag, count}` — «вскрывать карты проектов, пока `count` из них не окажутся с меткой `tag`». **«Shuffle these cards» трактуется как ВСЕ вскрытые карты**: карта не называет иного места для остальных, а физическое вскрытие обязано куда-то их деть. Вскрытые карты названы в журнале — они ушли из колоды проектов, и человек имеет право знать какие.
- **Каждая точка розыгрыша решает по виду записи**: бонусный слот колоды действий поколения (`finishActionDeck`), прореживание B18 (проектная карта уходит в сброс ПРОЕКТОВ, не в бонусный), fallback B08 и белый куб C07 — все через `drawAndResolveBonusDeckCard` / собственную ветку. Проектная карта из бонусной колоды играется штатным путём (`resolveProjectCardForBot`) и попадает в played pile, а значит из бонусной ротации выходит навсегда.
- **Где живёт розыгрыш**: `AutomaCardDraw.ts` — тот самый модуль, что уже разрывает цикл для `drawAndResolveProjectCard`. Экспорты-функции TS присваивает в `exports` ДО своих `require`, поэтому взаимный импорт с `AutomaBonusCards` безопасен (использование только в вызовах).

## Триггер по ОБЕИМ сторонам стола (метка у человека и у бота)

**Третья точка — размещение тайла** (`MarsBotCorp.onTilePlaced`, диспатч из `Game.addTile` после фан-аута карточных `onTilePlaced`): через неё проходит ЛЮБОЕ размещение на Марсе, чьё бы оно ни было, поэтому C10 читает обе стороны одним хуком, а сторона игрока решает, какая половина эффекта срабатывает. «Город» — движковый предикат `Board.isCitySpace` (столица считается), никогда не рукописный список типов. «These effects also apply to setup» бесплатно: корпорация сажается до своего setup-бокса.

Primitive, введённый вместе с **C08 Saturn Systems**:

- **Две точки, потому что стороны разные**: `MarsBotCorp.onTagResolved` диспатчится из `AutomaResolver.resolveTag` (единственное место, где бот резолвит печатную метку — метки карт И стартовые метки корпорации), `MarsBotCorp.onHumanCardPlayed` — из `Player.onCardPlayed` (флипы бота туда не попадают by construction; в диспетчере всё равно стоит `isMarsBot`-гард).
- **Гранулярность у сторон РАЗНАЯ и ровно печатная**: «you play a CARD containing a Jovian tag» → одно срабатывание на карту (сколько бы меток на ней ни было), «MarsBot resolves a Jovian TAG» → на каждую метку (бот и обрабатывает карту по меткам, слева направо). Обе половины закреплены тестами, включая карту с двумя юпитерианскими метками.
- **Порядок**: хук бота вызывается ПОСЛЕ того, как метка отработала (её трек продвинулся, иконка клетки сработала) — триггер реагирует на завершившееся событие. Метка без трека на этом планшете (например венерианская без Venus Next) всё равно СЧИТАЕТСЯ разыгранной.
- **Рекурсии нет** по конструкции: награда ПРОДВИГАЕТ трек, а продвижение трека метку не резолвит (клетка `tag_N` двигает другой трек напрямую).
- Побочный эффект по правилам: трек бота может продвинуться посреди ХОДА ЧЕЛОВЕКА (и поставить тайл, взять РТ, объявить достижение). Это ровно то, что печатает карта; атрибуция идёт обычным corporation-scope.

## Ограниченный резолв карты (только первая метка)

Primitive, введённый вместе с **C11 ThorGate**: `AutomaResolver.resolveProjectCard(game, card, {tagLimit})` (прокинут через `drawAndResolveProjectCard` / `resolveProjectCardForBot`). Карта разыгрывается ПОЛНОСТЬЮ как событие — журнал «Бот сыграл …», played pile, корп-диспатч `onProjectCardResolving`, RB-B human-реакторы видят ВСЮ карту; ограничивается только то, СКОЛЬКО печатных меток двигают треки. Так читается «ignoring all except its first tag»: это про треки бота, а не про то, какая карта вошла в игру. Карта вообще без меток — по-прежнему Failed Action.

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

`tests/automa/AutomaCorporations.spec.ts` (framework/selection/collision/serialization), `MarsBotCredicor.spec.ts`, `MarsBotEcoline.spec.ts` (B23 lifecycle + FAQ), `MarsBotHelion.spec.ts` (кубы: сетап/замещение/spent-once/Failed/сериализация), `MarsBotInterplanetaryCinematics.spec.ts` (per-advance: стартовые метки/каскад/чужой трек/maxed/регресс/белые маркеры), `MarsBotInventrix.spec.ts` (destroy Lobbyists во всех трёх позициях + Венера, эффект требования, lifecycle B25, все четыре ветки лестницы), `MarsBotMiningGuild.spec.ts` (частичный слив/перезаправка/перенос/несколько кругов, off-switch на конце трека, реентерабельность, чужой игрок и чужой ресурс), `MarsBotPhobolog.spec.ts` (посев ровно до двух космических, кубы, розыгрыш проектной И бонусной записи, печатная иконка В ДОПОЛНЕНИЕ, пустая колода, миграция старого сейва), `MarsBotSaturnSystems.spec.ts` (стартовая метка, обе стороны стола, карта с двумя метками = одно срабатывание, чужая метка/чужая корпорация, maxed-трек), `MarsBotTeractor.spec.ts` (подарок 25 M€ + маркер, метка Земли И метка города, каскад, чужой трек, maxed, сериализация), `MarsBotTharsisRepublic.spec.ts` (сетап-город двигает трек, город человека платит и НЕ двигает, город бота двигает и НЕ платит, озеленение не считается, чужая корпорация, maxed-трек), `MarsBotThorgate.spec.ts` (кубы, только первая метка при двух печатных, spent-once, завершённая температура → Failed Action, сериализация), `MarsBotSpire.spec.ts`, `tests/common/automa/MarsBotCorpData.spec.ts` (данные + no-human-leak), клиентские `MarsBotCorpFace.spec.ts`, `MarsBotTracksCubes.spec.ts` / review-спеки; e2e `console-bot-corporation.spec.ts` + `console-bot-corp-cubes.spec.ts`. В automa-тестах хелпер форсит **C01 Credicor по умолчанию** (самая инертная корпорация) — corp-тесты передают свою или `'random'`.
