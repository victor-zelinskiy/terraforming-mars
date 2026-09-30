# Промт исполнителю · TR05 Vector Computations («Векторные вычисления») — шестая карта проектов Turmoil Redux

Выдан 2026-09-30. Инфраструктура набора стоит (TR09, TR08, TR66, TR02 сданы; TR01 — в работе соседней сессии) —
**ничего из неё не повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md` (все пункты), журнал —
`docs/claude/turmoil-redux-cards-progress.md`, правила карт — `.claude/rules/game-logic.md`.

**Новых механик НЕТ — но карта первая в наборе с ТРИГГЕРОМ на розыгрыш, а у триггера в этом форке есть
обязательный ПРОГНОЗ-БЛИЗНЕЦ.** Каждое «впервые» уже имеет зелёный образец в скоупе:

| Впервые в наборе | Образец | Что проверить |
| --- | --- | --- |
| **`onCardPlayed` «когда вы играете метку Науки (включая эту)»** + близнец `cardPlayedForecast` | **Olympus Conference** (`base/OlympusConference.ts` — счёт `player.tags.cardTagCount(card, Tag.SCIENCE)`, ОДИН вызов на метку; `onNonCardTagAdded` для метки не с карты) и **Mars University** | гард `effectForecastCoverage` (пары `FORECAST_HOOK_PAIRS`, `effectForecast.ts:834`) требует близнеца; `effectForecastParity` — совпадение с живым хуком |
| действие «потрать ресурсы отсюда → **добор с фильтром по метке**» | `drawCard: {count: 1, tag: Tag.SPACE}` — Acquired Space Agency (`prelude`, розыгрыш) + AI Central (`base`, действие без фильтра); движок `DrawCards.keepAll` → `Deck.drawByConditionOrThrow` сбрасывает до совпадения, лог `Discarded ${0} cards ${1}` (переведён), reveal несёт `revealSequence` → консоль показывает лоток сброса сама | капшен: `buildCardInformation` помечает структурный `drawCard` как `complex` (`:505`) — правило действия берётся из ОПИСАНИЯ ряда `b.action(...)` (`frameDescription`), `action-short` только по требованию аудита |
| второй держатель data в скоупе (после TR02) | TR02 «Политология» | действие Учёных и Medical Database видят карту; TR01 «Высшая экспертиза» может класть сюда 4 data |

Клиентского кода — **ноль**. Всё в файле карты: класс, хук, близнец.

---

## 0. Рабочее дерево — ВНИМАНИЕ, TR01 в работе
`git status` на момент выдачи: соседняя сессия держит НЕЗАКОММИЧЕННЫЙ коммит 2/2 TR01 (`SupremeExpertise.ts`,
`TurmoilReduxCardManifest.ts`, `CardName.ts`, `turmoil_redux_cards.json`, `card_info.json`, `lore_texts.json` ×2,
арт TR01). **Не начинать правку общих файлов, пока этот коммит не появится в `git log`** (`Turmoil Redux TR01 (2/2)`),
иначе конфликт в трёх словарях. Дальше — как всегда: свои новые файлы коммитить сразу (сосед свипает untracked),
`git add` только по своим путям, в общих файлах только своя строка, `genfiles/**` не править руками.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR05.png`.
Арт: `C:\Users\zelin\Downloads\Mars Arts\TR05.png` (1536×1024, стандарт) →
`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR05.png" TR05` → `npm run make:cards`.

- **Vector Computations** · `cardNumber: 'TR05'` · стоимость **6** · тип **ACTIVE** · метки **Наука, Космос**
  (два кружка в углу: атом + жёлтая звезда на чёрном = Космос; **не** Энергия).
- **Требования нет** — плашка «MIN» у цены пуста (как у TR66).
- **Эффект** (ряд 1: `[наука] : [data][data]`): *Whenever you play a Science tag (including this), add 2 data
  resources to this card.*
- **Действие** (ряд 2: `4 [data] → [карта с бейджем Космоса]`): *Spend 4 data from here to draw a Space card.
  (Discard cards from the deck until you find it.)*
- **ПО нет.** `resourceType: CardResource.DATA`.
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется, комментарий в
  манифесте (чеклист §0).
- **Лор** EN: *«Houston, we have a problem.»* → `assets/text/lore_texts.json` ключ `"TR05"` (между `"TR02"` и
  `"TR08"`, строки ~502–503).

### Правила чтения (каждое — закрепить спеком)
1. **Триггер — за КАЖДУЮ метку Науки** сыгранной карты: `player.tags.cardTagCount(card, Tag.SCIENCE)` (ровно как
   Olympus Conference `:52`) → `+2 data × count`. Карта с двумя метками Науки даёт 4. Дикая метка (`Tag.WILD`) в
   `cardTagCount` НЕ считается (апстрим-чтение Olympus/Mars University); метка Марса при Habitat Marte — считается
   (внутри `cardTagCount`). Сыгранное СОБЫТИЕ с меткой Науки — считается (розыгрыш есть розыгрыш).
2. **«Включая эту»** — даром: `Player.playCard` кладёт карту в `playedCards` ДО `onCardPlayed` (`Player.ts:1412–1431`),
   fan-out проходит по всему табло. При розыгрыше самой TR05 → 2 data на ней. Прогноз-движок тоже считает
   играемую карту реактором своей игры (`effectForecast.ts:50`) — близнец получит `card === this`.
3. **Метка Науки НЕ с карты** (Leavitt, колонии) — `onNonCardTagAdded(player, tag)` → `+2` при `SCIENCE`
   (зеркало Olympus `:86–90`). Близнец для канала `tag-added` семейством НЕ требуется (`FORECAST_HOOK_PAIRS`).
4. **Сбор идёт через рекордер:** хук зовётся движком под `events.withEffect(this, card, 'card-played', …)`
   (`Player.ts:1463–1465`), внутри — `player.addResourceTo(this, {qty: 2 * count, log: true})`. Никаких `defer`
   (нет вопроса), никаких `resourceCount +=`.
5. **Действие — декларативное:** `action: {spend: {resourcesHere: 4}, drawCard: {count: 1, tag: Tag.SPACE}}`;
   < 4 data → авто-причина `'Not enough resources on this card'` (`count`, `current`). Пустая колода →
   `Executor.canExecute` через `projectDeck.canDraw` (`Executor.ts:71`) — авто.
6. **Добор с фильтром = движок:** несовпавшие карты уходят в сброс (`Deck.ts:164–189`), лог `Discarded N cards …`,
   reveal несёт последовательность → консольный лоток сброса. Карта Космоса = `tags.cardHasTag(card, SPACE)`
   (`DrawCards.ts:93`). Ничего из этого не писать — только закрепить спеком (колода из 3 не-Космос + 1 Космос →
   в руке ровно Космос, 3 в сбросе, лог).
7. **Data здесь — обычные data** (как правило 6 TR02): Учёные / Medical Database / TR01 кладут сюда; тратит только
   собственное действие; не платёжная единица.

## 2. Блок A · сервер — ОДИН файл

```ts
export class VectorComputations extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.VECTOR_COMPUTATIONS, type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.SPACE], cost: 6,
      resourceType: CardResource.DATA,
      action: {spend: {resourcesHere: 4}, drawCard: {count: 1, tag: Tag.SPACE}},
      metadata: {
        cardNumber: 'TR05',
        infoText: [{kind: 'effect-short', text: 'Science tag: +2 data here'}],
        renderData: CardRenderer.builder((b) => {
          b.effect('Whenever you play a Science tag (including this), add 2 data resources to this card.', (eb) => {
            eb.tag(Tag.SCIENCE).startEffect.resource(CardResource.DATA, 2);
          }).br;
          b.action('Spend 4 data from here to draw a Space card.', (eb) => {
            eb.resource(CardResource.DATA, 4).startAction.cards(1, {secondaryTag: Tag.SPACE});
          });
        }),
      },
    });
  }

  public onCardPlayed(player: IPlayer, card: ICard): void {
    this.onScienceTagAdded(player, player.tags.cardTagCount(card, Tag.SCIENCE));
  }
  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.SCIENCE) {
      this.onScienceTagAdded(player, 1);
    }
  }
  private onScienceTagAdded(player: IPlayer, count: number): void {
    if (count > 0) {
      player.addResourceTo(this, {qty: DATA_PER_SCIENCE_TAG * count, log: true});
    }
  }
  /** Mirrors `onCardPlayed`: an EXACT, immediate gain — 2 data per science tag of the played card, «including this». */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (scienceTags === 0) {
      return [];
    }
    const gain = DATA_PER_SCIENCE_TAG * scienceTags;
    return [forecast.exact(
      forecast.sourceOf(this, cardOwner, 'card-played'),
      [{...actionPreviews.cardGain(this, gain), current: this.resourceCount, resulting: this.resourceCount + gain}],
      forecast.tagReason(Tag.SCIENCE),
      {id: 'science', reasonTag: Tag.SCIENCE},
    )];
  }
}
```
- `export const DATA_PER_SCIENCE_TAG = 2` — в файле карты (спек читает константу, не литерал).
- Скан печатает ДВЕ иконки data в ряду эффекта — `resource(DATA, 2)` без `{digit}`; сворачивание в цифру — дело лица.
- **Ряд эффекта — `b.effect(...)` с `startEffect`, НЕ сырые ряды с `.colon()`** как у Olympus: Olympus сидит в
  `EFFECT_OVERRIDES` экстракции (`effectExtraction.ts:89–93`) именно потому, что нарисован сырыми рядами; у TR05
  ряд с описанием — экстракция, блок правил и капшен берут его сами. `effectExtraction.spec` — строка на TR05,
  если «Flagged» не пуст.
- **`action-short`** — только если `actionCaption` потребует (описание ряда 44 символа — ожидается «нет»).
  `effect-short` обязателен (описание > 52); бюджет 52 меряется по RU-переводу.
- `CardName.VECTOR_COMPUTATIONS = 'Vector Computations'` в секции `// Turmoil Redux`; манифест — строка с
  комментарием про символ Turmoil. Шапка файла — как у TR02/TR01: чтение скана + правила 1–7.
- Хуки превью/причин действия — авто; forecast-близнец — в файле (правило 8 CLAUDE.md).

## 3. Блок B · клиент — НИЧЕГО не писать, всё проверить глазами
- Лицо (`?premiumCardsPlayground`, чип turmoilRedux): Наука + Космос в углу, без чипа требования, ряд
  «[наука] : [data][data]», ряд «4 [data] → [карта · Космос]» (бейдж метки на иконке карты), без ПО.
- **Розыгрыш карты с меткой Науки** при TR05 в табло: превью розыгрыша несёт строку прогноза «Векторные
  вычисления: +2 [data] (0 → 2)» с причиной «метка Науки»; после розыгрыша — капсула карты в табло, журнальная
  строка «добавил 2 данных на Векторные вычисления», нотификация пассива называет карту. Розыгрыш самой TR05 —
  та же строка про саму себя («включая эту»).
- **Композер** «ДЕЙСТВИЯ КАРТ › ВЕКТОРНЫЕ ВЫЧИСЛЕНИЯ › НАСТРОЙКА»: cost-чип «4 → 0 на этой карте», gain «+1 карта»;
  коммит категории `draw` (иконка результата — карта, игла `cards` есть; `ICON_NEEDLES` не трогать); reveal с
  лотком сброшенных карт, найденная карта летит в док. При 3 data — действие выключено с причиной.
- Спутник ДОП. РЕСУРСЫ: data TR05 + TR02 в одной группе по типу, без монет (data — не деньги).

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Существующие: «Data»/«Данные», «Not enough
resources on this card», «Discarded ${0} cards ${1}», «${0} added ${1} ${2} to ${3}». Новые (ожидается 4):
- `turmoil_redux_cards.json`: `"Vector Computations": "Векторные вычисления"` (**имя — решение владельца**);
  `"Effect: Whenever you play a Science tag (including this), add 2 data resources to this card.": "Эффект:
  когда вы играете метку науки (включая эту карту), положите на эту карту 2 единицы данных."`; `"Action: Spend 4
  data from here to draw a Space card.": "Действие: потратьте 4 единицы данных с этой карты, чтобы взять карту с
  меткой космоса."` (голос — Acquired Space Agency в `preludes.json:103`: «карты с метками космоса»; «единицу
  данных» — `colonies.json:150`).
- `card_info.json`: `"Science tag: +2 data here": "Метка науки: +2 данных сюда"` + что напечатает аудит.
- `lore_texts.json` RU: `"Houston, we have a problem.": "Хьюстон, у нас проблема."` (каноничный дубляж «Аполлона-13»).

## 5. Тесты
**`tests/cards/turmoilRedux/VectorComputations.spec.ts`** (структура — `EvaMechs.spec.ts`; прогноз —
`effectForecastForPlay(player, card, cardPlayPreview(player, card))` как в `tests/models/effectForecast.spec.ts:67`):
- метаданные: имя, ACTIVE, 6, `[SCIENCE, SPACE]`, DATA, `TR05`, без требования и ПО;
- **триггер:** карта с 1 меткой Науки → +2; с 2 → +4; без Науки → 0; с `WILD` → 0; событие с Наукой → +2;
  розыгрыш самой TR05 через `player.playCard(card)` → 2 на ней («включая эту»); `player.triggerOnNonCardTagAdded
  (Tag.SCIENCE)` → +2, `(Tag.SPACE)` → 0; событие рекордера `cardResources` с источником-картой; лог;
- **близнец:** для карты с 1 / 2 метками — один факт `exact`, чипы `cardGain` с `current/resulting`
  (0→2, 0→4), `reasonTag: SCIENCE`; для карты без Науки — `[]`; для самой TR05 из руки — факт про неё;
- **действие:** 3 data → `canAct` false + причина `count` `current: 3`; 4 data + колода `[не-Космос, не-Космос,
  Космос, …]` → data 0, в руке ровно карта с меткой Космоса, 2 карты в сбросе, лог `Discarded`; колода без карт
  Космоса → `Executor` (доказать, что действие завершается без исключения — `drawByConditionOrThrow` ломается на
  пустой колоде: спек «колода пуста → `canAct` false»); превью `declarative`: cost-чип 4 `note: 'on this card'`,
  gain карта;
- держатель: действие Учёных кладёт сюда 2 data; `getSpendable` не знает data; save/load `resourceCount`.
**Гарды чеклиста § 3** — ворклист TR05 пуст, особо `effectForecastCoverage` / `effectForecastParity` /
`effectCaption` / `actionCaption` / `effectExtraction`; `make:cards` 0/0/0.
**e2e — НЕ писать** (политика § 5: триггер на розыгрыш + добор проверены соседями; фильтрованный reveal —
Acquired Space Agency). Фикстуры не добавлять.

## 6. Визуальная приёмка (один профиль, ТРИ кадра)
1. `?premiumCardsPlayground` — лицо TR05.
2. Превью розыгрыша карты с меткой Науки при TR05 в табло — строка прогноза «+2 [data]»; после — капсула «2».
3. Композер действия с чипом «4 → 0 на этой карте» и reveal с лотком сброшенных карт.
Карту гарантировать через «Тестовый режим» (`docs/DEV_GUARANTEED_CARDS.md`); data докинуть действием Учёных или
TR01, если она уже сдана.

## 7. Режим работы
**1 коммит** (карта + спеки + локаль + арт + лор + журнал), при желании журнал отдельно. Перед коммитом: `npm run
lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; `npm run make:css` + `npm run build:server`
(не голый `tsc`) перед визуальной проверкой. **Не пушить.** Документ карты **не заводить**. В журнал набора:
строка таблицы + раздел (что нового: первый триггер на розыгрыш с близнецом, первый фильтрованный добор действием,
второй держатель data; решения: имя, дикая метка не считается; гэпы). Гочи: `python3` — заглушка Store; `cross-env`
нет; юниты последовательно; `eqeqeq` без исключения для null; новая карта меняет сид-сдачи Redux-столов —
поехавший чужой спек сперва проверить без карты в манифесте и чинить классом.

В отчёте: подтверждение нулевого клиентского диффа; текст факта прогноза; результат `effectForecastParity`; три
кадра; новые ключи i18n; что напечатали гарды до/после.

## 8. Нельзя
Считать дикую метку наукой в триггере. `defer` вокруг безвопросного сбора. `resourceCount +=`. Хук без
близнеца или близнец, врущий про `current/resulting`. Сырые ряды `.colon()` вместо `b.effect`. Свой фильтр/сброс
колоды мимо `drawCard.tag`. `compatibility: 'turmoil'`. Новый e2e / фикстура / документ карты. Трогать
незакоммиченные файлы TR01. Пуш и красные коммиты.
