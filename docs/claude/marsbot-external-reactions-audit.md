# Аудит внешних реакций: действия MarsBot → эффекты карт/корпораций людей (2026-09-06)

Контекст: правило форка от 2026-09-06 (владелец) — **разрешённая ботом карта проекта
считается «any player plays a card» для каждого человеческого
`onCardPlayedByAnyPlayer`-реактора** (обобщение официального прецедента Saturn Systems,
RB-B «Adding Corporations» FAQ p.4: «triggered when you or MarsBot play a card…; an
advance tracker effect does not trigger it»). Non-card события (стартовые метки,
microbe advancement клетки 9 Венеры) остаются FAQ-перечислением
{Saturn Systems, Pharmacy Union, Splice}. Канон реализации:
`src/server/automa/AutomaHumanTagReactions.ts`; статусная таблица — `docs/AUTOMA_DATA_AUDIT.md` §10.

## Свойства диспатча (проверены тестами `tests/automa/AutomaHumanTagReactions.spec.ts`)

- **Единица срабатывания — КАРТА, раз на каждое разрешение.** `onBotCardResolved`
  вызывается вне пер-тегового цикла (`AutomaController.ts` — флип хода;
  `AutomaCardDraw.resolveProjectCardForBot` — все «дополнительные проекты»). Карта с
  двумя космическими метками = одно срабатывание Solar Logistics; два подходящих
  проекта в одной цепочке = два.
- **Failed Action не гасит срабатывание**: диспатч стоит ДО резолвера, поэтому карта,
  чьё движение по заполненному треку заменилось Failed Action, всё равно «разыграна».
- **Продвижение трека — НЕ розыгрыш карты** (структурно: каскады
  `AutomaResolver.performTrackAction` не проходят через точки диспатча).
- **Вскрытие ≠ разрешение**: cost-tiebreak размещения (`AutomaTilePlacer.breakTie`),
  cost-flip колоний (`AutomaColonies.flipToPick`), драфт (`AutomaDraft`), seed
  бонус-колоды (`MarsBotBonusDeckOps`) карт не «играют» — негативные тесты.
- **Возвращённый реактором PlayerInput при бот-флипе = громкая ошибка** (throw):
  промпт, чья отвечающая сторона — бот, обязан иметь co-located детерминированную
  ветку (прецедент Splice).

## Таблица аудита (поддерживаемая матрица: base, corpEra, promo, venus, colonies, prelude, ares, delta)

| Эффект (хук) | Условие по правилам | Путь в коде | Статус ДО | Исправление | Проверка |
|---|---|---|---|---|---|
| **Solar Logistics** (`onCardPlayedByAnyPlayer`) | любой игрок играет космическое СОБЫТИЕ → добор 1 | `AutomaHumanTagReactions.onBotCardResolved` → co-located хук → `ExternalDrawIntake.grant` | **ПРОПУЩЕН** (allowlist: «молчит по правилу») | allowlist снят; внешний добор через mandatory intake | automa-спек: позитив/негативы всей таблицы задачи |
| **Saturn Systems** (`onCardPlayedByAnyPlayer` + non-card-tag) | джовианская карта любого игрока; стартовая метка бота; НЕ track-advance | тот же диспатч + `onBotNonCardTag` | работал (FAQ) | — (сохранён) | прежние + прежний спек |
| **Pharmacy Union** (`onCardPlayedByAnyPlayer` + `onMarsBotMicrobeAdvancement`) | карта с микробом (покарточно); microbe advancement (клетка 9 Венеры / стартовая метка) | тот же диспатч + `onBotMicrobeAdvancement` | работал (FAQ) | — | прежние |
| **Splice** (то же) | микроб-метка (потегово); microbe advancement | то же; бот-половина детерминирована | работал (FAQ) | — | прежние |
| **Sponsored Academies** — оппоненты добирают | «All opponents draw 1 card» (бот — 1 M€ по FAQ) | `bespokePlay` → `ExternalDrawIntake.grant` (deferred, прежняя позиция очереди) | добор шёл МОЛЧА прямо в руку (внезапный fullscreen) | внешний intake | `SponsoredAcademies.spec`, `crossPlayerDeliveryAudit` S17 |
| Тайл-реакции людей (Tharsis Republic, Arctic Algae, Philares, Rover Construction, Herbivores, Ecological Zone, ares-соседства, Land Claim, …) | размещение тайла КЕМ УГОДНО | бот строит через общий `Game.addTile` → общий fan-out `onTilePlaced` | работал (engine-shared) | — | S18 (Tharsis+Rover на городе бота), новый тест Arctic Algae на океане бота |
| «Метка города у проекта бота» ≠ город | Tharsis Republic реагирует на ТАЙЛ, не на метку | резолвер двигает только треки; тайл — отдельный путь | корректно | — | структурно (резолвер) + S18 |
| **Poseidon (человеческий)** (`onColonyAddedByAnyPlayer`) | любой игрок основывает колонию | `AutomaColonies.botBuildColony` — свой fan-out (зеркало `Colony.addColony`) | работал | — | новый тест (бот строит → +1 производство человека) |
| Колониальные бонусы владельцев при торговле бота (Миранда collect, Плутон draw+discard) | чужая торговля платит владельцу | `botTrade` → общий `GiveColonyBonus` (detached delivery) | работал (существующий managed-флоу) | — (сохранён как есть) | новый тест: бот торгует на Миранде → `colonyBonusPrompt` c trader=бот |
| Реакции на глобальные параметры / TR (в скоупе реализаторов нет: Greta/Aurorai/UNMO/TerraformingDeal/Anubis — вне матрицы) | — | бот идёт через общие `increaseTemperature/addOcean/increaseVenusScaleLevel` → общий TR fan-out | n/a (реакторов нет) | — | код-путь общий; при появлении реактора сработает сам |
| Атаки бота на ресурсы/производство, страховки, защиты | RB-A/RB-C generic + Mons Q10 | `Player.attack`/`Production.add` адаптеры | работал | — | прежние спеки |
| Бот НЕ исполняет человеческие эффекты разрешаемых карт | резолв по печатным меткам, никогда `card.play()` | `AutomaResolver.resolveProjectCard` | корректно | — | структурно + прежние спеки |

Вне поддерживаемой матрицы (turmoil, moon, pathfinders, underworld, community, prelude2,
ceos, starwars) реакторы не аудировались: их модули блокируются на создании automa-партии.

## Внешний ДОБОР — общий механизм (`ExternalDrawIntake`)

Полный контракт — шапка `src/server/deferredActions/ExternalDrawIntake.ts` и
`src/common/models/ExternalDrawPromptModel.ts`. Кратко: добор в момент срабатывания
(порядок колоды не зависит от скорости ответа) → сериализуемый `pendingCardIntakes`
(карты ВНЕ `cardsInHand` до принятия — ни одна проекция руки их не видит) → mandatory
`SelectCard` с маркером `externalDrawPrompt` (принятие по одной или все разом;
переизданный промпт того же intake; ре-деривация после reload —
`ExternalDrawIntake.rebuildPrompts` из `Game.deserialize`). Консоль: беат
`externalDraw` (ALWAYS_INTERRUPTIVE) → плашка → A → workspace `external-draw`
(«ДОБОР КАРТЫ», locked: B = «Забрать все», никогда «назад»). Нотификация о том же
доборе подавлена структурно: событие `cards-drawn` несёт тег `external-intake`, и
`viewerImpactOfChain` пропускает его для получателя (журнал не тронут, остальные
эффекты того же действия видимы).

Текущие площадки intake: Solar Logistics (чужой триггер — человек или бот),
Sponsored Academies (оппоненты). Managed-флоу (Миранда/Плутон/draw-then-discard,
собственные розыгрыши, бонусы колоний) сознательно НЕ переведены — они уже
управляемые шаги своих workspace-флоу.
