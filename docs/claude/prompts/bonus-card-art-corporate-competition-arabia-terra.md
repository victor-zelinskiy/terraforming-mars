# Арт бонус-карты MarsBot · BF4 «Corporate Competition (Arabia Terra)» — промт для генератора

Составлен 2026-11-05 вместе с четвёртой фанатской картой паттерна (`docs/claude/marsbot-fan-map-checklist.md`,
`docs/AUTOMA_DATA_AUDIT.md` §21.6). Как и у BF1–BF3: лицо карты в UI текстовое (`BonusCardFace.vue` иллюстрации не
несёт) — промт на будущее, UI не меняется (решение владельца). Стиль печатных B-карт — RB-A p.2: тёмная титульная
плашка, фотореалистичная иллюстрация в верхней половине, текст ниже; без игровых значков.

Тема карты: корпорации соревнуются за награды Arabia Terra — древнего нагорья у края северной низменности, карты
БУХТ (берег, который может стать и морем, и сушей): Cosmic Settler, Botanist, Promoter, Zoologist, A. Manufacturer.

## Промт (один блок, скопировать целиком)

```
You are illustrating the MarsBot bonus card "Corporate Competition" for the fan map Arabia Terra of the board game Terraforming Mars (a solo-opponent expansion: MarsBot, an automated rival corporation). Generate ONE finished illustration right away, without asking questions.

WHAT THE CARD IS. MarsBot, the automated rival, pushes the race for a funded AWARD it is closest to winning — on this map the awards honour the settlers of worlds beyond Mars, the growers of plants, the promoters of great events, the keepers of animals and the builders of working machinery. The picture is the RACE: two rival corporations claiming the same young shoreline.

THE PLACE. Arabia Terra — the old cratered upland where the Martian highlands step down to the northern lowland, now the coast of a rising sea: a ragged shoreline of flooded craters and shallow coves, dark wet sand between pale salt flats, low terraces of ancient layered rock behind, a pale butterscotch sky with thin high cloud. The water is new and still: grey-blue, opaque, with ice along the edges.

THE PICTURE. One cove seen from its landward side, and a rival on each headland. On the left a life-sciences corporation's shore station: a row of low greenhouses stepping down to the water, pens with hardy animals under a transparent shelter, algae ponds in the shallows, technicians carrying sample crates. On the right an engineering corporation's yard: a dry dock with a half-built orbital freight module on a cradle, cranes, a tall launch gantry further back, stacked machinery and a control cabin. Down on the wet sand between them, a survey party from each side walks the tide line with marker poles, deciding where the sea will stop — the standoff. Everything in use: boot prints and tyre ruts, hoses, crates, frost in the shadows, salt crust on the hulls.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a documentary photograph or a sober engineering visualisation of a real frontier work site, NOT cinematic concept art; a standard lens 35–50 mm from standing eye height, slightly off-axis so the shoreline runs diagonally and both headlands are read at one glance; light only from a low sun and the sites' own floodlights and greenhouse glow, long shadows; a restrained palette of rust and pale salt, the grey-blue of cold water, the dull greens of the first life, the white and safety-orange of the hardware; no teal-and-orange grade, no cyan sci-fi tint, no god-rays, no lens flares, no bloom; modest human scale — a job site, never a palace; slight grain, no gloss, no AI sheen.

NEVER: game icons, tokens, cubes, cards or UI; a card frame or border; readable text, numbers or logos (a banner may carry an abstract mark); hovering vehicles or sleek white sci-fi architecture; a tropical or Earth-like beach, palm trees, surf, blue sky (the sea here is cold, shallow and new); heroic posing or glamour portraits; Earth or the Moon in the sky; a symmetrical vanishing-point avenue; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** две площадки читаются как СОПЕРНИКИ с одного взгляда; бухта — молодое холодное море, не
  земной пляж; жизнь скудная и только начинающаяся; никакого текста, значков и рамки; нет «AI-открытки» — иначе
  перегенерить.
- **Перегенерация в том же чате:** «Another one: same cove and the two headlands — a different moment and vantage,
  nothing from the previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\BF4_corporate_competition_arabia_terra.png`.
  Внедрение — когда семья B-карт получит слот иллюстрации в `BonusCardFace.vue`; до того файл лежит рядом с промтом.
