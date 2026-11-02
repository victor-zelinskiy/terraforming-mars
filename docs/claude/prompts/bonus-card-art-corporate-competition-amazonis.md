# Арт бонус-карты MarsBot · BF2 «Corporate Competition (Amazonis Planitia)» — промт для генератора

Составлен 2026-11-02 вместе со второй фанатской картой паттерна (`docs/claude/marsbot-fan-map-checklist.md`,
`docs/AUTOMA_DATA_AUDIT.md` §18.6). Как и у BF1: лицо карты в UI текстовое (`BonusCardFace.vue` иллюстрации не
несёт) — промт на будущее, UI не меняется (решение владельца 2026-11-02). Стиль печатных B-карт — RB-A p.2:
тёмная титульная плашка, фотореалистичная иллюстрация в верхней половине, текст ниже; без игровых значков.

Тема карты: корпорации соревнуются за награды Amazonis Planitia — западной равнины жизни: 32 иконки растений,
микробы и животные на клетках, колонии (Colonizer), запретный центр, по которому никто не строит; ряд наград —
Curator, A. Engineer, Promoter, Tourist, A. Zoologist.

## Промт (один блок, скопировать целиком)

```
You are illustrating the MarsBot bonus card "Corporate Competition" for the fan map Amazonis Planitia of the board game Terraforming Mars (a solo-opponent expansion: MarsBot, an automated rival corporation). Generate ONE finished illustration right away, without asking questions.

WHAT THE CARD IS. MarsBot, the automated rival, pushes the race for a funded AWARD it is closest to winning — on this map the awards honour the collectors of one kind of expertise, the engineers of production, the promoters of events, the tourists who keep open land around their settlements, and the keepers of living things. The picture is the RACE: two rival corporations opening up the same green frontier.

THE PLACE. Amazonis Planitia — the vast western plain of Mars, already half alive: a low rolling lowland of rust-red soil threaded with the first shallow lakes, patches of hardy ground cover and lichen crusts spreading from greenhouse outfalls, a thin pale-pink haze. On the horizon a line of low volcanic cones; far behind them, immense and faint, the shoulder of Olympus Mons. In the middle of the plain a fenced-off exclusion zone — a vast crater of broken ground with warning masts around it — that nobody is allowed to build on.

THE PICTURE. Two rival outposts facing each other across a shallow lake, each pushing its own kind of life into the plain. On the left a biotech corporation's station: a chain of long greenhouse tunnels glowing faintly green, open-air test plots of ground cover in neat rectangles, bioreactor tanks and a sample lab, technicians in light suits bent over the plots, a small animal enclosure with hardy goats under a transparent dome. On the right a settlement company's camp: a ring of habitat modules with a landing pad, a line of tour rovers with big windows, a lookout tower, surveyors planting claim markers across the open land, cargo pods of colony supplies stacked for the next launch. Between the two, on the lake shore, two small groups in EVA suits meet at a folding table with a map pinned against the wind — the negotiation, or the standoff — while a survey drone hangs above them. Everything in use: tyre tracks in the mud, hoses, crates, frost on the morning pipes, dust on the hulls.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a documentary photograph or a sober engineering visualisation of a real frontier work site, NOT cinematic concept art; a standard lens 35–50 mm from standing eye height, slightly off-axis so the lake shore runs diagonally and both sites are read at one glance; light only from a low sun and the sites' own floodlights and greenhouse glow, long shadows; a restrained palette of rust-red soil, the dull greens of the first life, the white and safety-orange of the hardware, the pale pink sky; no teal-and-orange grade, no cyan sci-fi tint, no god-rays, no lens flares, no bloom; modest human scale — a job site, never a palace; slight grain, no gloss, no AI sheen.

NEVER: game icons, tokens, cubes, cards or UI; a card frame or border; readable text, numbers or logos (a banner may carry an abstract mark); hovering vehicles or sleek white sci-fi architecture; lush Earth-like forests or oceans (the life here is sparse, crusted, just beginning); heroic posing or glamour portraits; Earth or the Moon in the sky; a symmetrical vanishing-point avenue; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** две площадки читаются как СОПЕРНИКИ с одного взгляда; жизнь на равнине скудная и
  только начинающаяся (не земной лес); запретная зона видна как огороженный провал; никакого текста, значков и
  рамки; нет «AI-открытки» — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same two sites and the lake shore — a different moment and
  vantage, nothing from the previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\BF2_corporate_competition_amazonis.png`.
  Внедрение — когда семья B-карт получит слот иллюстрации в `BonusCardFace.vue`; до того файл лежит рядом с
  промтом как заготовка.
