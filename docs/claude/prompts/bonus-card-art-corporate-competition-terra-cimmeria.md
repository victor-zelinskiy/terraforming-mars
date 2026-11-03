# Арт бонус-карты MarsBot · BF3 «Corporate Competition (Terra Cimmeria)» — промт для генератора

Составлен 2026-11-03 вместе с третьей фанатской картой паттерна (`docs/claude/marsbot-fan-map-checklist.md`,
`docs/AUTOMA_DATA_AUDIT.md` §19.6). Как и у BF1 / BF2: лицо карты в UI текстовое (`BonusCardFace.vue` иллюстрации не
несёт) — промт на будущее, UI не меняется (решение владельца). Стиль печатных B-карт — RB-A p.2: тёмная титульная
плашка, фотореалистичная иллюстрация в верхней половине, текст ниже; без игровых значков.

Тема карты: корпорации соревнуются за награды старой Terra Cimmeria — изрытого кратерами южного нагорья с вулканами
Тиррена и Хадриака, где на клетках печатается энергия: Biologist, Incorporator, T. Politician, Urbanist, Warmonger.

## Промт (один блок, скопировать целиком)

```
You are illustrating the MarsBot bonus card "Corporate Competition" for the old fan map Terra Cimmeria of the board game Terraforming Mars (a solo-opponent expansion: MarsBot, an automated rival corporation). Generate ONE finished illustration right away, without asking questions.

WHAT THE CARD IS. MarsBot, the automated rival, pushes the race for a funded AWARD it is closest to winning — on this map the awards honour the keepers of living things, the founders of cheap small ventures, the politicians who send delegates, the builders of green cities and the corporations that strike at their rivals. The picture is the RACE: two rival corporations building against each other on the same cratered upland.

THE PLACE. Terra Cimmeria — the ancient southern highlands of Mars: a rough upland of overlapping old craters and dark basalt ridges, a broad shield volcano low on the horizon, thin cold air with a pale butterscotch sky. Power is the wealth of this land: a field of solar arrays and a squat geothermal plant venting a thin plume at a crater's rim.

THE PICTURE. Two rival sites on the two rims of one shallow crater. On the left a city corporation's young settlement: a compact cluster of pressurised domes ringed by the first green belts of hardy ground cover, a greenhouse terrace, a small transit pod line. On the right a heavy-industry rival: the geothermal plant, a row of solar arrays, cargo crawlers and a launch gantry, a couple of security rovers parked a little too close to the crater's floor. On the floor between them, a survey team from each side marks out the same patch of ground with coloured stakes while a drone hangs overhead — the standoff. Everything in use: tyre ruts in the regolith, cables, crates, frost in the shadows, dust on the hulls.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a documentary photograph or a sober engineering visualisation of a real frontier work site, NOT cinematic concept art; a standard lens 35–50 mm from standing eye height, slightly off-axis so the crater rim runs diagonally and both sites are read at one glance; light only from a low sun and the sites' own floodlights and greenhouse glow, long shadows; a restrained palette of dark basalt, butterscotch dust, the dull greens of the first life, the white and safety-orange of the hardware; no teal-and-orange grade, no cyan sci-fi tint, no god-rays, no lens flares, no bloom; modest human scale — a job site, never a palace; slight grain, no gloss, no AI sheen.

NEVER: game icons, tokens, cubes, cards or UI; a card frame or border; readable text, numbers or logos (a banner may carry an abstract mark); hovering vehicles or sleek white sci-fi architecture; lush Earth-like forests or oceans; weapons fired or explosions (the rivalry is a standoff, not a battle); heroic posing or glamour portraits; Earth or the Moon in the sky; a symmetrical vanishing-point avenue; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** две площадки читаются как СОПЕРНИКИ с одного взгляда; энергия (солнечные поля, геотермальная
  станция) видна как богатство этой земли; жизнь скудная и только начинающаяся; никакого текста, значков и рамки; нет
  «AI-открытки» — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same two sites on the crater rims — a different moment and vantage,
  nothing from the previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\BF3_corporate_competition_terra_cimmeria.png`.
  Внедрение — когда семья B-карт получит слот иллюстрации в `BonusCardFace.vue`; до того файл лежит рядом с промтом.
