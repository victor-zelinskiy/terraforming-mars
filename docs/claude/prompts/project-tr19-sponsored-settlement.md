# Промт исполнителю · TR19 Sponsored Settlement («Спонсируемое поселение») — восемнадцатая карта проектов Turmoil Redux

Выдан 2026-10-02. Инфраструктура набора стоит (TR01–TR09, TR11–TR13, TR15–TR18, TR66 сданы) — **ничего из неё не
повторять.** Процедура — `docs/claude/turmoil-redux-card-checklist.md`, журнал — `docs/claude/turmoil-redux-cards-progress.md`,
правила карт — `.claude/rules/game-logic.md`.

**Новых механик нет. Карта — младшая сестра TR16 «Административный район»:** то же правило «город на незарезервированной
клетке, игнорируя прочие ограничения размещения», только без условия «рядом с вашим городом». Правило уже написано ОДНОЙ
функцией на класс — `src/server/boards/ignoreRestrictionsCity.ts` (`cityIgnoringRestrictions(player, {}, canAffordOptions)`
+ `cityIgnoringRestrictionsReasoner`), её шапка прямо называет TR19 вторым потребителем. Плюс производство M€ +2
(декларативно), 1 ПО, требование «Марс вперёд» (подача — класс TR15). Клиентского кода — ноль, e2e — не писать.

| Что проверить | Где образец |
| --- | --- |
| **Вызов общего правила без соседства**: подсвечена ВСЯ свободная суша, включая клетки рядом с любыми городами; океанские, Ноктис, лагерь кочевников, чужой Land Claim, занятые — нет, каждая с общей причиной | TR16 `AdministrationDistrict.ts` (заголовок промпта, `bespokePlay`, `cardPlayPreview`, `unplayableReason`) |
| **Карта с `behavior` (производство) + bespoke-город** — порядок «производство, затем клетка» и превью, где staged-клетка — дверь, а чип производства — результат | `base/UrbanizedArea.ts` (`behavior.production` + `bespokePlay` + `placementPreview(..., {staged})`) |
| **Взаимодействие с TR16**: эта карта — карта Строительства с ПО 1, и при TR16 в табло её розыгрыш берёт карту | близнец прогноза TR16 — композер обязан показать «+1 карта · Административный район» |

### Правила чтения (каждое — закрепить спеком)
1. **Требование** «Requires Mars First to be ruling or that you have 2 delegates there» = `requirements: {party:
   PartyName.MARS}`.
2. **Производство M€ +2** — `behavior: {production: {megacredits: 2}}`.
3. **Город** — на любой клетке общего правила без соседства: запрет «не рядом с другим городом» снят, всё остальное
   (суша, без тайла, не зарезервирована, стоимость клетки по карману) — как у обычного размещения. Всё, что даёт размещение
   города, — даётся (бонус клетки, океаны, триггеры городов у всех, TR15 «город на Марсе»).
4. **Нет ни одной законной клетки** (практически невозможно, но правило общее) → карта неиграбельна с причиной — формой
   TR16 (`unplayableReason`); если TR16 уже дал общий помощник причины — взять его.
5. **ПО 1** — `victoryPoints: 1`. Метки — **Город, Строительство** (`[Tag.CITY, Tag.BUILDING]`, порядок скана).
6. MarsBot карту не играет.

### Решения владельца (подтвердить в отчёте, не блокер)
1. RU-имя **«Спонсируемое поселение»**.

---

## 0. Рабочее дерево
`git status` на момент выдачи: в индексе `package.json` / `package-lock.json` (хук версии после коммита TR18) — **не
включать в свои коммиты**; после своего коммита — `git reset -q HEAD -- package.json package-lock.json`. В общих файлах
(`CardName.ts`, манифест, словари, `lore_texts.json`, журнал) — только своя строка; `git add` по своим путям; код выхода
гейтов читать ЯВНО (`; echo exit=$?`). Новая карта сдвигает сид-сдачу Redux-столов — упавшую чужую фикстуру чинить классом
(закреплять карту по имени). Память `concurrent-session-edits-same-files`, `git-temp-index-path-trap`.

## 1. Карта — по скану

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Projects\Card_-_TR19.png` (лист `…\Printables\19-27.png`).
**Арт `C:\Users\zelin\Downloads\Mars Arts\TR19.png` на момент выдачи ОТСУТСТВУЕТ** — запросить у владельца; остальное не
ждёт (`node scripts/import-card-art.mjs "C:/Users/zelin/Downloads/Mars Arts/TR19.png" TR19` → `npm run make:cards`).

- **Sponsored Settlement** · `cardNumber: 'TR19'` · стоимость **16** · тип **AUTOMATED** (зелёная) · метки **Город,
  Строительство**.
- **Требование** — эмблема «Марс вперёд» в оранжевой плашке. **ПО 1** (бейдж на фоне Марса).
- **Графика**: `[производство: 2 M€]` · `[тайл города]*`.
- **Текст:** *(Requires Mars First to be ruling or that you have 2 delegates there. Increase your M€ production 2 steps.
  Place a city tile ON A NON-RESERVED SPACE, IGNORING OTHER PLACEMENT RESTRICTIONS.)*
- **Фиолетовый шестиугольник внизу слева** — значок Turmoil: `compatibility` НЕ объявляется.
- **Лор** EN: *«Eventually some of those people that bought land on Mars will see dividends.»* →
  `assets/text/lore_texts.json` ключ `"TR19"`; RU: **«Когда-нибудь кто-то из тех, кто купил землю на Марсе, всё-таки увидит
  дивиденды.»**

## 2. Блок A · сервер — `src/server/cards/turmoilRedux/SponsoredSettlement.ts`
`Card` + `IProjectCard`, `CardType.AUTOMATED`, `tags: [Tag.CITY, Tag.BUILDING]`, `cost: 16`, `requirements: {party:
PartyName.MARS}`, `victoryPoints: 1`, `behavior: {production: {megacredits: 2}}`, `cardNumber: 'TR19'`.
- Набор клеток и причина — `cityIgnoringRestrictions(player, {}, canAffordOptions)` / `cityIgnoringRestrictionsReasoner(player,
  {})`; ни строчки своей логики клеток в файле карты.
- `bespokeCanPlay` / `unplayableReason` — форма TR16 (правило 4).
- `bespokePlay`: `defer(new PlaceCityTile(player, {title: SPONSORED_SETTLEMENT_TITLE, spaces, sourceCard: this.name,
  customReasoner}))`. Заголовок называет снятое правило, как у TR16 («Select a non-reserved space · other placement
  restrictions do not apply» — сверить с формулировкой TR16 и говорить тем же голосом, без «рядом с вашим городом»).
- `cardPlayPreview(player)`: `actionPreviews.placementPreview(this, player, {tile: TileType.CITY, constraint: 'on a non-reserved
  space, ignoring other placement restrictions', staged: {spaces: (o) => cityIgnoringRestrictions(player, {}, o), placementType:
  'city', reasoner}})` — дверь «Разыграть на поле» появляется сама; чип производства M€ — из `behavior`.
- `renderData`: `b.production((pb) => pb.megacredits(2)).nbsp.city().asterix()`; `description` — текст скана.
- `CardName.SPONSORED_SETTLEMENT = 'Sponsored Settlement'`; строка манифеста без `compatibility`. Шапка файла — чтение скана,
  правила 1–6, ссылка на TR16 и общий модуль.
- Если в `ignoreRestrictionsCity.ts` что-то нужно поменять для ветки без соседства — ТОЛЬКО там и со спеком; TR16 обязан
  остаться зелёным без правки ожиданий.

## 3. Блок B · клиент
Кода не ожидается. Проверить ГЛАЗАМИ: лицо (две метки, плашка «Марс вперёд», ряд «[прод. 2 M€] [город]*», бейдж ПО 1);
композер — чип «производство M€ +2», дверь «Разыграть на поле», строка `constraint`; поле при выборе клетки — подсвечена вся
свободная суша (в т. ч. клетки рядом с чужими городами), недоступные — с общими причинами, досье клетки называет снятое
правило; при TR16 в табло — строка прогноза «+1 карта · Административный район» в композере. Найденный дефект общего слоя —
чинить классом, назвать в отчёте.

## 4. Блок C · локаль
Перед КАЖДЫМ ключом `grep -rn '"<ключ>"' src/locales/*/*.json`. Ожидается ~4 новых: `"Sponsored Settlement": "Спонсируемое
поселение"` (**имя — решение владельца**); описание → «Требует, чтобы «Марс вперёд» правила или у вас было 2 делегата на её
резолюции. Увеличьте производство M€ на 2. Разместите тайл города НА НЕЗАРЕЗЕРВИРОВАННОЙ КЛЕТКЕ, ИГНОРИРУЯ ПРОЧИЕ ОГРАНИЧЕНИЯ
РАЗМЕЩЕНИЯ.» (голос — описание TR16); заголовок промпта клетки и `constraint` (переиспользовать ключи TR16, если они уже
называют правило без соседства); лор RU — §1.

## 5. Тесты
**`tests/cards/turmoilRedux/SponsoredSettlement.spec.ts`** (структура — `AdministrationDistrict.spec.ts`): метаданные
(AUTOMATED, 16, `[CITY, BUILDING]`, `{party: MARS}`, ПО 1, TR19); требование (подача — TR15); производство M€ +2; клетки:
рядом с чужим городом — да, рядом со своим — да, вдали от городов — да; океанская / Ноктис / занятая / чужой Land Claim —
нет; размещение даёт бонус клетки и запускает городские триггеры; `bespokePlay` и превью — один набор (паритет); при TR16 в
табло розыгрыш даёт +1 карту, прогноз == исполнение; save / load не нужен (ресурсов нет).
**`ignoreRestrictionsCity` спек** — ветка без соседства (если TR16 её не покрыл).
**Гарды чеклиста §3** — ворклист пуст; особо `cardPlayPreviewCoverage`, `consolePlayPreviewCoverage`, `cardReasonConsistency`;
`make:cards` 0 / 0 / 0.
**e2e — НЕ писать, фикстуру не добавлять** (путь staged-клетки и общего правила доказан TR16 и соседями).

## 6. Визуальная приёмка (один профиль; свой сервер, «Тестовый режим» — `docs/DEV_GUARANTEED_CARDS.md`)
1. Витрина: лицо TR19 рядом с TR16.
2. Композер с дверью и чипом производства; с TR16 в табло — строка прогноза «+1 карта».
3. Поле при выборе клетки: подсветка (включая клетку вплотную к чужому городу), досье клетки.

## 7. Режим работы
Экономный, **1–2 коммита**, зелёные по юнитам: (1) карта + спек + локаль + лор (+ арт, если есть); (2) журнал набора. Перед
коммитом: `npm run lint`, `npm run build:test`, `npm run make:cards`, `npm run make:json`; перед визуальной проверкой
`npm run make:css` + `npm run build:server`. **Не пушить.** Документ карты не заводить. Гочи: `python3` — заглушка Store;
юниты последовательно; `eqeqeq` без исключения для null.

В отчёте: что напечатали гарды до / после; три проверки из таблицы; кадры §6; новые ключи i18n; **явно — всё, что не
получилось сделать по этому промту, и почему.**

## 8. Нельзя
Своя логика клеток в файле карты или вторая копия правила. Снимать с клетки что-то кроме запрета соседства городов. Правка
ожиданий спеков TR16. Бесподобная причина вместо общей. Новый e2e, фикстура, документ карты. `compatibility: 'turmoil'`.
Включать `package.json` / `package-lock.json` из чужого коммита. Пуш и красные коммиты.
