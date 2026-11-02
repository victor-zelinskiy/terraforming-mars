# Арт бонус-карты MarsBot · BF1 «Corporate Competition (Vastitas Borealis)» — промт для генератора

Составлен 2026-11-02 вместе с первой фанатской картой паттерна (`docs/claude/marsbot-fan-map-checklist.md`,
`docs/AUTOMA_DATA_AUDIT.md` §17.6). Лицо карты в UI сегодня ТЕКСТОВОЕ, как у всех B-карт (`BonusCardFace.vue`
иллюстрации не несёт) — промт готовится на будущее, когда семья B-карт получит арт; UI по этому промту не
меняется (решение владельца 2026-11-02).

Что такое печатная B-карта (RB-A p.2, «32 MarsBot bonus cards»): вертикальная карта с тёмной титульной плашкой
наверху («LOBBYISTS», «CORPORATE COMPETITION»), фотореалистичной иллюстрацией в верхней половине и текстом
правила ниже. Иллюстрация — в стиле оригинальных карт «Покорения Марса»: фотография места или сцены, без
игровых значков. У Corporate Competition тема — корпорации соревнуются за награды: здесь — на северных
низинах Vastitas Borealis (фанатская карта: тёплое древнее морское дно в центре с Северным полюсом, вулканы и
металлы на северо-западе, растения на юге; ряд наград — Forecaster, Edgedancer, Visionary, Naturalist, Voyager).

## Промт (один блок, скопировать целиком)

```
You are illustrating the MarsBot bonus card "Corporate Competition" for the fan map Vastitas Borealis of the board game Terraforming Mars (a solo-opponent expansion: MarsBot, an automated rival corporation). Generate ONE finished illustration right away, without asking questions.

WHAT THE CARD IS. MarsBot, the automated rival, pushes the race for a funded AWARD it is closest to winning — on this map the awards honour the far-sighted, the settlers of the board's edge, the hoarders of ideas, the keepers of plants and heat, and the voyagers to Jupiter. The picture is the RACE: two rival corporations building against each other on the same stretch of the northern plains.

THE PLACE. Vastitas Borealis — the great northern lowlands of Mars, an ancient sea bed: a vast flat plain of frozen ground under a thin pink-grey sky, a low pale sun. In the middle distance a shallow basin where the ice is being melted into the first open water of a northern sea, steam rising off it; to one side a line of low dark volcanic hills, scarred by open-pit mining; at the horizon a sliver of the polar ice cap under a lid of frozen carbon dioxide.

THE PICTURE. Two rival work sites side by side, divided by nothing but a surveyor's line of marker poles. On the left a crisp, well-funded corporate outpost: a row of white pressurised modules with a tall communications mast, a fleet of matching rovers, floodlights on tripods, a smart cargo lander on its pad being unloaded, a corporate banner on the main module. On the right the rival site, leaner and faster: a cluster of mismatched modules, a drilling rig already boring into the basin's edge, a greenhouse dome glowing faintly warm, heat exchangers venting steam into the cold air, tracks everywhere. Between the two, at the marker line, two small groups of people in EVA suits face each other over a folding table with a map pinned down against the wind — the negotiation, or the standoff. Above both sites a single surveying drone. Everything is in use: tyre tracks, dust on the hulls, cables, crates, frost on the pipes.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a documentary photograph or a sober engineering visualisation of a real work site, NOT cinematic concept art; a standard lens 35–50 mm from standing eye height, slightly off-axis so the marker line runs diagonally into the picture and both sites are read at one glance; light only from the low sun and the sites' own floodlights, long cold shadows; a restrained palette of frozen grey-ochre ground, the white and safety-orange of the hardware, the pink-grey sky, one patch of warm light in the greenhouse; no teal-and-orange grade, no cyan sci-fi tint, no god-rays, no lens flares, no bloom; modest human scale — a job site, never a palace; slight grain, no gloss, no AI sheen.

NEVER: game icons, tokens, cubes, cards or UI; a card frame or border; readable text, numbers or logos (a banner may carry an abstract mark); hovering vehicles or sleek white sci-fi architecture; heroic posing or glamour portraits; Earth or the Moon in the sky; a symmetrical vanishing-point avenue; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** две площадки читаются как СОПЕРНИКИ с одного взгляда; северная равнина плоская и
  холодная, вода в котловине парит; никакого текста, значков и рамки; нет «AI-открытки» (лучи, зеркальный лёд,
  осевая симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same two sites and the marker line — a different moment and
  vantage, nothing from the previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\BF1_corporate_competition_vastitas.png`.
  Внедрение — когда семья B-карт получит слот иллюстрации в `BonusCardFace.vue` (сейчас его нет); до того —
  файл лежит рядом с промтом как заготовка.
