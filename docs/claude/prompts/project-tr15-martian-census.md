# Промт исполнителю · TR15 Martian Census («Марсианская перепись») — тринадцатая карта проектов Turmoil Redux

Выдан 2026-10-02. Инфраструктура набора стоит (TR01–TR09, TR11, TR13, TR66 сданы) — **ничего из неё не повторять.**
Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`, правила
карт — `.claude/rules/game-logic.md`, парламент — `.claude/rules/console-ui.md` § THE PARLIAMENT SITTING (закон 22) и
`docs/claude/parliament-glossary.md` (§9 — третья дверь голосования). **Обязательное чтение до кода:**
`docs/TURMOIL_REDUX_POLITICAL_DONATION.md` целиком (общий шаг делегата, STAGED VOTE, адресованный `party`-хвост, три
исхода), `docs/TILE_PLAY_STAGED_COMMIT.md` §9-ter (staged-ДЕЙСТВИЯ синих карт) и §9-quinquies, `docs/CONSOLE_BLUE_ACTION_PARITY.md`
(эталон flow «Действия карт»), память `turmoil-redux-political-donation`, `tr07-colony-sponsors`, `panel-reward-hold-is-shared`.

**У карты три «впервые», и главное из них — класс:** это ПЕРВАЯ карта набора с ТРЕБОВАНИЕМ ПАРТИИ. За ней идут TR14–TR27
и дальше с той же плашкой; всё, что эта карта сделает для требования (лицо, причина, счётчик), наследуют они все.

| Впервые | Что это | Ближайший образец (уже в коде) |
| --- | --- | --- |
| **Требование партии в Redux-наборе** | сервер готов: `requirements: {party}` → `Parliament.satisfiesPartyRequirement` (`Parliament.ts:461–463`: партия ПРАВИТ ∨ у игрока 2 делегата на её резолюции; доступ «выдан картой» НЕ считается). Подача — нет: лицо рисует ТЕКСТ имени партии без эмблемы (`PremiumRequirementsBar.vue:105–106`, `REQUIREMENT_RENDER[PARTY]` без `iconUrl`), причина недоступности — безликая `'Requires a specific political situation'` (`unplayableReasons.ts:287–289`) | эмблемы партий Redux `assets/parties/redux/*.png`; причина с «сейчас» — `DELEGATES_ON_RESOLUTIONS` (TR02); канон слов доступа — глоссарий §5 («Доступен · партия правит» / «…два ваших делегата на её резолюции») |
| **Действие синей карты СТАВИТ ДЕЛЕГАТА** — STAGED VOTE из «Действий карт» | staged-голосование есть только у РОЗЫГРЫША из руки (TR03: `target {kind: 'resolution'}`, `flow: 'play'`, `ConsoleShell.vue:15418–15433`); staged-ДЕЙСТВИЯ есть только с клеткой (`flow: 'action'`, `:19380`). Комбинации «действие + резолюция» нет | общий шаг `PlaceDelegatesOnResolution` + `previewSelectParty()` + `actionPreviews.delegateGrantStep`; адресованный хвост `{type: 'party', partyName, stagedFor}` — на сервере уже общий (адрес = `choiceContext.source.card` гранта) |
| **Триггер «ЛЮБОЙ игрок кладёт город НА МАРСЕ»** | существующие городские триггеры считают ЛЮБОЙ город, включая внемарсовые (Pets, Rover Construction, Immigrant City: `Board.isCitySpace(space)`) | `onTilePlaced` + близнец `tilePlacedForecast` (`base/Pets.ts:58–75`); приоритет чужого хода `Priority.OPPONENT_TRIGGER` |

Двухвариантное действие («ИЛИ») — не впервые: образец TR66 Automated Convoys (`AutomatedConvoys.ts:114–134`,
`actionPreviews.orBranches`, порядок веток = порядок опций `action()`).

**Сестра:** TR24 Venusian Census — то же действие дословно («+1 data ИЛИ 3 data → делегат на резолюцию»), требование
Союза, триггер от шага Венеры. Ветки действия пишутся так, чтобы TR24 взял их без копирования.

### Правила чтения (каждое — закрепить спеком)
1. **Требование** «Requires Mars First to be ruling or that you have 2 delegates there» = `requirements: {party:
   PartyName.MARS}` — проверяется при РОЗЫГРЫШЕ; потом партия может смениться, эффект и действие работают всегда.
   Свод, с. 13: «Party requirements on project cards require the listed party to be Ruling, or that the player have 2
   delegates on its resolution in the Voting Area»; FAQ с. 19: доступ к эффекту партии от Septem Tribus / Council Seat
   требованием НЕ считается.
2. **Эффект**: «Whenever ANY player places a city on Mars» — любой игрок, включая владельца и MarsBot; только город НА
   МАРСЕ (маленький оранжевый гекс у значка города на скане = «на Марсе», память `parliament-quest-icon-language`):
   Ганимед, Фобос и прочие внемарсовые клетки НЕ считаются; Столица считается (это город); город, положенный ПОВЕРХ
   своего города резолюцией Skyscrapers, считается (FAQ с. 19: «You are placing a tile»). +1 data на ЭТУ карту за каждый
   такой тайл. Триггер срабатывает и на город, положенный самой картой в момент розыгрыша? — карта городов не кладёт; не
   моделировать.
3. **Действие, ветка A**: +1 data на эту карту. Доступна всегда.
4. **Действие, ветка B**: потратить 3 data С ЭТОЙ карты → 1 делегат на резолюцию ОБЛАСТИ ГОЛОСОВАНИЯ. Делегат — по закону
   гранта: из РЕЗЕРВА, бесплатно, куб лобби не тратится (общий шаг `PlaceDelegatesOnResolution(player, 1, {kind: 'card',
   card})`, без `support`). Ветка недоступна — по ОДНОЙ причине в порядке: меньше 3 data («На карте N из 3») → нет
   резолюций на голосовании → нет делегата в резерве (ключи TR03: `'No resolution is up for a vote'`, `'No delegate in
   your reserve'`). Недоступная ветка ПОКАЗАНА отключённой с причиной, не скрыта.
5. Делегат карты — обычный делегат (счёт голосов, доступ к эффекту партии с двух, задание председателя вида «делегаты»,
   требование TR02, требование партии любой карты). Порядок: data списаны и делегат поставлен ОДНИМ действием — «заплатил
   и не поставил» невозможно.
6. Действие — раз в поколение (обычное действие синей карты): ИЛИ ветка A, ИЛИ ветка B.
7. Data на карте — обычный ресурс карт: «data на ЛЮБУЮ карту» (TR01, Плутон) могут класть сюда; атаки на ресурсы — общим путём.
8. MarsBot карту не играет; его города триггер считает (правило 2).

### Решения владельца (подтвердить в отчёте, не блокер)
1. **Ветка B — STAGED VOTE из «Действий карт»**: выбор ветки ничего не отправляет → Парламент раскрывается ВНУТРИ workspace
   «Действия карт» в режиме голосования → A «Подтвердить» = единственный POST → data уходят с карты, куб садится. B в
   режиме — назад в композер. Основание: «no hidden target» и решения по TR03 / TR07 (pre-select до отправки).
2. RU-имя **«Марсианская перепись»** (сестра TR24 — «Венерианская перепись»).
3. **Требование партии на лице — эмблема партии** в плашке требования, как на скане (а не текст), для ВСЕХ карт с `{party}`.

---

## 0. Рабочее дерево
`git status` на момент выдачи ЧИСТ (последние коммиты — TR13 1–3/3). Перед стартом перечитать: соседние сессии работают в
том же клоне. В общих файлах (`CardName.ts`, манифест, словари, `lore_texts.json`, `ConsoleShell.vue`, `ConsoleCardActions.vue`,
`ConsoleActionComposer.vue`, `stagedPlay.ts`, `unplayableReasons.ts`, журнал) — только своя строка/ветка; `git add` по
своим путям, перед коммитом `git status` глазами; свои новые файлы коммитить сразу; `genfiles/**` руками не править; e2e —
из СВОЕГО снапшота (`npm run e2e:snapshot tr15` + `TM_E2E_ROOT=.e2e-tr15`, 4K — `--workers=1`). Память
`concurrent-session-edits-same-files`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR15.png`; сестра — лист `…\Printables\19-27.png` (TR24).
**Арт: `C:\Users\zelin\Downloads\Mars Arts\TR15.png` на момент выдачи ОТСУТСТВУЕТ** — запросить у владельца; остальное не
ждёт (`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR15.png" TR15` → `npm run make:cards`).

- **Martian Census** · `cardNumber: 'TR15'` · стоимость **6** · тип **ACTIVE** (синяя) · метка **Марс**.
- **Требование** — в оранжевой плашке у цены эмблема партии «Марс вперёд» → `requirements: {party: PartyName.MARS}`.
- **ПО нет.** Ресурс карты — `CardResource.DATA`.
- **Графика** (один ряд, разделён чертой): слева эффект `[город на Марсе, красная рамка «любой игрок»] : [data]`;
  справа действие в две строки: `→ [data]  OR` / `3 [data] → [делегат]`.
- **Текст:** *(Effect: Whenever ANY player places a city on Mars, add a data resource to this card. Action: Add 1 data
  resource here, OR spend 3 data from here to add a delegate to a resolution.)* / *(Requires Mars First to be ruling or
  that you have 2 delegates there.)*
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется.
- **Лор** EN: *«Mars will be a whole new era of people coping with the fact their ancestors are immigrants.»* →
  `assets/text/lore_texts.json` ключ `"TR15"` (после `"TR13"`); RU: **«Марс станет целой эпохой людей, которым придётся
  смириться с тем, что их предки — иммигранты.»**

## 2. Блок A · сервер

### A1 · Причина требования партии — названная, с «сейчас» (класс)
`unplayableReasons.ts:287–289`: `RequirementType.PARTY` выходит из общей ветки. Новая причина несёт ПАРТИЮ и оба пути:
`{type: 'party', message: 'Requires ${0} to be ruling or 2 of your delegates on its resolution', party, current, required:
2}` — `current` = делегаты игрока на резолюции этой партии в области голосования (0, если её карты там нет); отдельный
признак «резолюции партии нет на голосовании» (тогда второй путь сейчас закрыт — сказать это, а не «0/2»). Числа — из
фасада `game.politics` (метод рядом с `satisfiesPartyRequirement`; `Parliament.access()` `:433–455` уже считает оба
слагаемых — отдать их, не пересчитывать). Классический Turmoil (вне Redux) оставить на прежней строке. `CHAIRMAN` не
трогать. `FULLY_RESTATED_REQUIREMENTS` — добавить PARTY только если строка `requirementBlock` говорит то же (иначе правило
покажется дважды или наполовину); гарды `requirementProse`, `cardReasonConsistency` — ворклист.

### A2 · Триггер — город на Марсе, любой игрок
`onTilePlaced(cardOwner, activePlayer, space)`: `Board.isCitySpace(space)` ∧ клетка НА МАРСЕ (`space.spaceType !==
SpaceType.COLONY` — сверить с тем, как это решают задания парламента: событие тайла несёт `board: BoardType`, Луна
отбрасывается по доске) → `cardOwner.game.defer(new AddResourcesToCard(cardOwner, CardResource.DATA, {filter: (c) => c.name
=== this.name}), cardOwner.id !== activePlayer.id ? Priority.OPPONENT_TRIGGER : undefined)` — форма Pets. Близнец
`tilePlacedForecast` тем же предикатом (`tile.countsAsCity` + «на Марсе»: если `EffectForecastTile` не несёт признака —
добавить поле, не угадывать), `forecast.deferred(... [actionPreviews.cardGain(this, tile.count)] ...)`. Гарды
`effectForecastCoverage` / `effectForecastParity`. Ряд эффекта — `b.effect` со `startEffect`:
`eb.city({size: Size.SMALL, all}).asterix().startEffect.resource(CardResource.DATA)` (значок «на Марсе» — если в DSL есть
модификатор, использовать его вместо звёздочки; показать на кадре).

### A3 · Действие — две ветки, bespoke
`action(player)`: опции в порядке скана — A `'Add 1 data resource to this card'`, B `'Spend 3 data from here to add a
delegate to a resolution'`; одна живая → `cb` напрямую (образец TR66 `:140–175`; свёртку понимает `reconcileBatchResponse`).
Ветка B: `player.removeResourceFrom(this, 3)` и `player.game.defer(new PlaceDelegatesOnResolution(player, 1, {kind: 'card',
card: this.name}))` в ОДНОМ шаге; если `execute()` шага способен «не поставить» (мир сдвинулся) — data не списываются:
порядок «проверка → списание → постановка» внутри одного обработчика, спек на пропуск. Своего `SelectParty` / `placeVote` в
файле карты нет.
`actionUnavailableReason` / причины веток — правило 4 (co-located; гард `actionReasonCoverage`, `actionBranchAvailability`).
`canAct` — истинно всегда (ветка A).
`actionPreview(player)`: `actionPreviews.orBranches(this, [A: {effects: [cardGain(this, 1)]}, B: {effects: [cardCost(this,
3), delegateFromReserve(player, 1)], steps: [delegateGrantStep(this, grant)], unavailableReason?}])` — та же функция
`grant(player)`, что ставит действие (образец `PoliticalDonation.ts`). Ветки вынести в общий помощник
(`src/server/cards/turmoilRedux/censusAction.ts`) — TR24 возьмёт его.

### A4 · Карта — `src/server/cards/turmoilRedux/MartianCensus.ts`
`Card` + `IActionCard`, `CardType.ACTIVE`, `tags: [Tag.MARS]`, `cost: 6`, `resourceType: CardResource.DATA`, `requirements:
{party: PartyName.MARS}`, `cardNumber: 'TR15'`. `renderData` — по скану: `b.effect(…)` · вертикальная черта (если узла нет —
`br`, показать на кадре) · `b.action('Add 1 data resource here.', (eb) => eb.empty().startAction.resource(DATA)).or().br;
b.action('Spend 3 data from here to add a delegate to a resolution.', (eb) => eb.resource(DATA, 3).startAction.delegates(1))`
(ловушка `or-edges`: соединитель «ИЛИ» обязан видеть обе стороны; `actionRowsOf` режет по боксу `→`). `infoText`:
`effect-short` «Any city placed on Mars: add a data here» + то, что потребует аудит (бюджет 52 по RU мерить РУКАМИ).
`CardName.MARTIAN_CENSUS = 'Martian Census'` после `POLITICAL_THINK_TANK`; манифест без `compatibility`. Шапка файла — чтение
скана, правила 1–8, сестра TR24.

### A5 · Следствие для TR13
Карта с требованием партии в Redux-наборе появилась: `partyRequirementCardsInGame` на Redux-столе = 1 (спек TR13 «0 на
чистом столе» — поправить ожидание классом: «число карт набора с `{party}`»). Фикстуру `political-think-tank`
(`generate.ts:1170–1183`) перевести с синтетической Wildlife Dome на Martian Census, комментарий SYNTHETIC убрать.

## 3. Блок B · клиент

### B1 · Требование партии на лице и в руке (класс)
- `REQUIREMENT_RENDER[RequirementType.PARTY]` получает эмблему: для партий Redux — `assets/parties/redux/<party>.png`
  (функция `partyEmblemUrl`, если уже есть у плашек Парламента — та же, не вторая таблица); чип — эмблема без числа
  (binary), как на скане. Текстовый лейбл остаётся только для партии без эмблемы.
- Хинт чипа (`.premium-tooltip()` на не-disabled обёртке) и строка правил — словами глоссария: «Требует: «Марс вперёд»
  правит или 2 ваших делегата на её резолюции».
- Рука / композер, карта неиграбельна: «✕ Нельзя разыграть · «Марс вперёд» не правит · ваших делегатов на её резолюции:
  1 из 2» (или «её резолюции нет на голосовании») — из причины A1, `unplayableReasonFormat` получает ветку `party` с
  параметрами; компактный счётчик руки «[эмблема] 1/2». Никакого расчёта на клиенте.
- Витрина: кадр TR15 рядом с картой без требования и с TR02 (делегаты) — три плашки одного семейства.

### B2 · Композер действия — две ветки
«ДЕЙСТВИЯ КАРТ › МАРСИАНСКАЯ ПЕРЕПИСЬ › НАСТРОЙКА»: ветка A — чип «data N → N+1»; ветка B — чипы «data N → N−3», «делегат:
резерв R → R−1», строка шага «Резолюция — выбор в Парламенте» (ключ TR03), CTA ветки B — навигационный глагол «Выбрать
резолюцию» (ключ TR03; `playCommitVerb`-аналог для действия — одна классификация двери, не вторая). Недоступная ветка —
отключена с причиной (правило 4). Плитка в сетке действий — оба бокса `→` (`actionRowsOf`), фит `useActionCanvasFit`.

### B3 · STAGED ACTION VOTE — пересечение двух готовых осей
`StagedPlayArm {flow: 'action', target: {kind: 'resolution', vote}}` — обе оси есть, нужна их встреча:
- вход: подтверждение ветки B в композере действия ничего не отправляет (`buildActionBatch` — головa батча припаркована в
  arm, `actionRestore` — как у staged-клетки действия, `ConsoleShell.vue:19380`), в зону workspace «Действия карт»
  толкается кадр `{kind: 'parliament', stage: DELEGATE_GRANT_STEP_STAGE, phase: 'configure', serves: [], anchor: {type:
  'always'}, nest: workspaceFrameKnown('parliament'), sourceCard}` — общим `enterStagedHostedStep` (обобщён в TR07; если
  он знает только хост-руку — обобщить по хосту, не копировать). RELEASE композера → UNFOLD Парламента из его rect → REVEAL;
  `v-if`-смена = блик = дефект. Крошка: `ДЕЙСТВИЯ КАРТ › МАРСИАНСКАЯ ПЕРЕПИСЬ › ГОЛОСОВАНИЕ`, эмблема workspace и имя карты
  не двигаются.
- режим голосования — тот же мост (`parliamentPromptBridge(wf, staged)`), та же панель; отличия от двери TR03 только в
  словах: A **«Подтвердить»** (глагол коммита действия; не «Разыграть карту»), источник «из резерва · по карте» +
  запертая квитанция **«Карта · 3 data»** (вместо цены в M€ — `receipt` обобщается до чипа стоимости), B «Назад» в композер
  (выбор ветки и фокус целы), L3 «Источник». Блока «Народная поддержка» нет (у шага нет `support`).
- коммит: `submitBatch([...arm.batch, {type: 'party', partyName, stagedFor: arm.cardName}])` — через общий
  `commitStagedTail`; универсальный ACTION COMMIT карты (`consoleActionCommit*`) играет на A: импульс по ряду B → значок
  делегата; data на капсуле карты тикают N → N−3 на отрыве куба.
- посадка: куб из стопки резерва на ленту резолюции — существующий полёт; счёт, лидер, «принимается» тикают на касании.
- три исхода (LANDED / RE-ASKED / PARKED) — как у TR03; после посадки flow «Действия карт» ЗАВЕРШАЕТСЯ через охраняемую
  концовку (завершённое действие уходит, а не возвращается в сетку), шаг и хост уходят одной поверхностью.
- Парламент ⊃ «Действия карт» ⊃ Парламент (действие открыто из Парламента): `nest` — прецедент двери Союза; проверить руками.

### B4 · Живая дверь (fallback)
Вне staged-границы (RE-ASKED, reload, повтор действия мостом `consoleRepeatPick`, хост — не «Действия карт»): обычный
submit ветки B → живой грант с `choiceContext.source.card` → существующий хостинг `workspaceHostForStep()`
(`ConsoleShell.vue:17242–17275`), B «Свернуть», A «Отправить делегата». Одна панель на обе двери.

### B5 · Триггер на экране
+1 data за чужой / свой город — обычный путь эффектов карт: чип летит на капсулу карты, запись в журнале с источником-картой,
прогноз в превью размещения города (близнец A2). Проверить глазами три случая: свой город; город соперника (нотификация
владельцу карты); внемарсовый город (ничего не происходит и ничего не обещано в прогнозе).

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие (не дублировать): «Choose the resolution»,
«Resolution — chosen in the Parliament», «from the reserve · by the card», «No resolution is up for a vote», «No delegate in
your reserve», имена партий `party name: …`, «Voting», «Confirm». Новые (ожидается ~10): `"Martian Census": "Марсианская
перепись"` (**имя — решение владельца**); `Effect: Whenever ANY player places a city on Mars, …` → «каждый раз, когда ЛЮБОЙ
игрок размещает город на Марсе, добавьте 1 data на эту карту»; `Action: Add 1 data resource here.`; `Action: Spend 3 data
from here to add a delegate to a resolution.` → «потратьте 3 data с этой карты, чтобы добавить делегата на резолюцию»;
`effect-short`; причина требования партии (A1) + её хвосты («не правит», «её резолюции нет на голосовании», «ваших
делегатов на её резолюции: ${0} из 2») — в `parliament.json`, сверить с глоссарием §5 и добавить канон в
`parliamentGlossary.spec`; причина ветки «${0} of 3 data on this card»; квитанция `'Card · ${0} data'`; лор RU — §1.
Слово «data» в RU — как у TR02 / TR05 (сверить со словарём, не вводить второй вариант).

## 5. Тесты
**`tests/cards/turmoilRedux/MartianCensus.spec.ts`** (`testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true})`,
тихие резолюции через `seatResolution` / `quietResolutionOf`): метаданные; требование — неиграбельна с названной причиной и
`current` 0 / 1; играбельна при правящей «Марс вперёд» и при 2 делегатах на её резолюции; доступ, выданный картой, не
засчитывается; триггер: свой город на Марсе +1, город соперника +1 (`OPPONENT_TRIGGER`), Ганимед / Фобос — 0, Столица +1,
город поверх своего (Skyscrapers) +1, озеленение / океан — 0; прогноз == исполнение (паритет); действие A: +1; действие B:
при 2 data — недоступна с причиной «2 из 3», при пустой области / пустом резерве — свои причины по порядку; при 3 data —
промпт-грант с `choiceContext.source.card`, ответ → data −3, +1 голос из резерва, лобби цело; одна живая ветка → без
OrOptions; превью: две ветки в порядке опций, `delegateGrantStep` у B, `previewSelectParty()` == живой промпт; раз в
поколение; save / load `resourceCount`.
**`tests/models/…`**: причина PARTY (правит / 0 / 1 / нет резолюции / классический Turmoil — прежняя строка).
**`tests/inputs/deferredInputBatch.spec.ts`** — строка: голова батча = ДЕЙСТВИЕ карты, хвост `party` с `stagedFor` садится;
`chairman-seat` перед грантом хвост не съедает (уже покрыто для play — добавить для action-головы).
**TR13**: `PoliticalThinkTank.spec` (число карт в партии), фикстура без синтетики, e2e TR13 зелёный.
**Гарды чеклиста §3** — ворклист TR15 пуст; особо `actionBranchAvailability`, `actionPreviewCoverage`, `actionPromptCoverage`,
`actionReasonCoverage`, `effectForecastCoverage`, `effectForecastParity`, `cardReasonConsistency`, `requirementProse`,
`promptMarkerGuard`, `crossPlayerCoverageGuard`, `effectExtraction`, `actionExtraction`; `make:cards` 0 / 0 / 0.
**Клиентские юниты**: `premiumCardViewModel` (PARTY с эмблемой), `unplayableReasonFormat` (ветка party), `stagedPlay`
(action × resolution), `parliamentCommands` (staged-действие: «Подтвердить» / «Назад» / L3), `voteInfoModel` (квитанция в
data), обобщённый вход / уход хостимого шага (рука TR03 и TR07 не изменились), `parliamentGlossary`.
**e2e — ОДИН спек** `tests/e2e/console-martian-census.spec.ts`, фикстура `martian-census` (`parliamentFixture`, `stopAt:
'vote'`, имя в `FixtureName`): синий — карта в ТАБЛО с 3 data, действие не использовано, резерв ≥ 1, куб в лобби; три
резолюции посажены как у `political-donation`. Пробник — `MutationObserver` + `setInterval`; утверждать ПОРЯДОК:
1. «Действия карт» → карта → композер: две ветки; выбор B → CTA «Выбрать резолюцию»; A → ни одного POST, `gameAge` тот же;
2. крошка на КАЖДОМ сэмпле держит корень и имя карты; хвосты только вперёд НАСТРОЙКА → ГОЛОСОВАНИЕ; `.con-parl` внутри
   `.con-cardactions` (телепорт), второго `.con-ws` нет;
3. режим: квитанция «Карта · 3 data», источник «из резерва · по карте»; B → композер с веткой B в фокусе; снова вход;
4. A → РОВНО ОДИН POST `input-batch`, хвост несёт `stagedFor: 'Martian Census'`;
5. куб: из стопки резерва на ленту; капсула карты 3 → 0; сокет лобби занят до и после;
6. сервер по API: data на карте 0, голос зрителя на слоте, действие использовано;
7. конец на поле: нет `.con-ws`, нет stranded, 0 `[console-overflow]`, 0 ошибок страницы, `data-*-degraded` не появлялся.
Профили fhd + tv4k (`--workers=1`), `--repeat-each=4`, `waitForTimeout` = 0, `shardPlan.json` не править. Регрессия соседей:
`console-political-donation`, `console-colony-sponsors`, `console-staged-play`, `console-political-think-tank`,
`console-colony-venus-redux`, `console-parliament-vote-fit|-geometry|-leave`, `console-action-focus`. `npm run e2e:affected`
перед коммитом.

## 6. Визуальная приёмка (fhd + кадр 4K; свой сервер, `.e2e-tr15/`)
1. Витрина: лицо — 6, Марс, плашка с эмблемой «Марс вперёд», ряд «эффект | действие A ИЛИ действие B»; рядом TR02.
2. Рука: карта неиграбельна — три кадра причин (не правит + 0/2 · 1/2 · резолюции партии нет на голосовании); играбельна.
3. Сетка «Действий карт»: плитка с двумя боксами; композер — ветка A, ветка B доступна, ветка B отключена с причиной.
4. Раскадровка перехода (CDP-скринкаст): композер отпускает на месте, Парламент поднимается из той же зоны; блик = дефект.
5. Режим: квитанция в data, прогноз; посадка куба, капсула 3 → 0; уход на поле.
6. Триггер: чужой город на Марсе → чип data на капсулу, нотификация; прогноз в превью размещения города.

## 7. Режим работы
**4 коммита**, каждый зелёный по юнитам: (1) сервер — причина PARTY, триггер + прогноз, действие + превью, карта + локаль +
лор + спеки (+ арт, если есть), правка TR13; (2) клиент класса — эмблема требования, формат причины, счётчик руки + юниты;
(3) клиент — композер двух веток, staged action vote, посадка, концовка, живая дверь + юниты; (4) e2e + фикстура + документы.
Перед каждым: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; код выхода каждого гейта
читать ЯВНО (`; echo exit=$?`); перед визуальной проверкой `npm run make:css` + `npm run build:server`. **Не пушить.**
**Документ карты ЗАВОДИТЬ** — `docs/TURMOIL_REDUX_MARTIAN_CENSUS.md`: контракт требования партии в наборе (причина, лицо,
счётчик — наследуют TR14–TR27+), STAGED ACTION VOTE (чем отличается от двери розыгрыша TR03), общий помощник действий
«переписей» (TR24), триггер «город на Марсе». Дополнить: `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` §8 (граница «только
розыгрыш» снята), `docs/TILE_PLAY_STAGED_COMMIT.md` (таблица целей × потоков), `.claude/rules/console-ui.md` (абзац к закону
22: четвёртая дверь — действие карты), глоссарий §5 / §9, чеклист набора §4 (строки «требование партии» и «действие ставит
делегата»), журнал набора. Гочи: `python3` — заглушка Store; юниты последовательно; `eqeqeq` без исключения для null; новая
карта меняет сид-сдачи Redux-столов — поехавший чужой спек сперва проверить без карты в манифесте и чинить классом.

В отчёте: форма причины PARTY; сигнатуры помощника действий; что обобщено для staged-действия и чем доказано, что TR03 /
TR07 не изменились; кадры §6 + раскадровка; e2e на двух профилях и регрессия соседей до / после; что напечатали гарды;
новые ключи i18n; **явно — всё, что не получилось сделать по этому промту, и почему.**

## 8. Нельзя
Считать внемарсовые города. Считать доступ, выданный картой, выполнением требования. Тратить куб лобби. Списать data без
постановки делегата. Скрыть недоступную ветку. Авто-выбор резолюции (даже единственной). Отправлять что-либо до A в режиме
голосования. Свой `SelectParty` / `placeVote` в файле карты. Позиционный `party`-хвост у staged-двери. Второе
staged-хранилище, вторая копия Парламента, вторая панель голосования; копия входа / коммита вместо обобщения. Считать
выполнение требования или делегатов на клиенте. Безликая причина «особая политическая ситуация» в Redux. Вторая таблица
эмблем партий. Титул у встроенного Парламента. `v-if`-смена сцен, прокси без измеренного адресата, холд на `setTimeout`,
`clearPanelRewardHold()`. Литерал кнопки; `title`; `filter` как носитель состояния. Детект по тексту заголовка.
`compatibility: 'turmoil'`. Реализовывать TR24. Трогать чужие незакоммиченные файлы, `shardPlan.json`. Пуш и красные коммиты.
