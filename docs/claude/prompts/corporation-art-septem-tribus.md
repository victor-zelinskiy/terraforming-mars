# Арт корпорации · Septem Tribus (замена Turmoil Redux) — промт для генератора OpenAI

Составлен 2026-10-25. Семейство КОРПОРАТИВНЫХ артов форка (`assets/card-images/R07.webp` Pristar, `R38` Lakefront,
`R14` TerraLabs, `R33` Utopia, `R10` Point Luna) отличается от артов резолюций: это широкий план РЕЗИДЕНЦИИ
корпорации, её ЛОГОТИП — крупно, по центру кадра, на главной поверхности, вокруг — мир и люди корпорации.
Septem Tribus — тайное общество за фасадом think-tank'ов, поэтому центр кадра — не вывеска на улице, а стена
закрытого зала совета: логотип по центру (как у остальных), но его видят только посвящённые.

Приложить к запуску: скан `…\TM Turmoil Redux\Corporations\Corporation - Septem Tribus.png` (логотип слева
вверху — копировать С НЕГО) и, если генератор принимает второй референс, классический скан
`…\TerraformingMars-CardDatabase\corporations\Turmoil - Septem Tribus.png` (логотип крупнее и чище).

## Промт (один блок, скопировать целиком)

```
You are illustrating the CORPORATION card "Septem Tribus" for a fan expansion of the board game Terraforming Mars. Attached: the card scan — copy the corporate emblem from its top-left corner. Generate ONE finished illustration right away, without asking questions.

WHO THEY ARE. Septem Tribus is a secret society that aims to control the development of Mars. It is fronted by think tanks and lobby groups and seeks influence in every corridor of power. It is not a factory, not a lab, not a builder: its product is influence. Its members are the people who brief ministers, draft the amendments, fund the institutes and sit at the back of every hearing. Nothing about them is loud. Their seat of power is not a tower with a sign on it — it is a private chamber behind a respectable institute, a few hundred metres from the Martian parliament, where seven people meet and the agenda of the planet gets settled before the parliament votes on it.

THE PICTURE. A wide interior view of that council chamber, at the moment the room is filling before a session: a round table with exactly SEVEN high-backed chairs; dossiers, tablets, a decanter, reading glasses left on the leather; six or seven men and women in dark, expensive, understated civilian clothing — a mix of ages and builds, some already seated, two standing in quiet conversation, one still at the door — none of them looking at the camera, nobody posing. Faces candid and specific: concentration, tiredness, a half-smile, the patience of people who are used to waiting. The room is wealthy but restrained: warm sandstone and terracotta-toned stone walls (the colours of the card), dark wood, worn leather, brass fittings, a few old-fashioned printed books, subdued cool task lamps on the table. Along one side, a tall narrow window band looks out at dusk over the government district of a domed Martian capital: the illuminated dome of the Parliament building a few hundred metres away, walkways, the thin butterscotch-to-grey Martian sky beyond the dome. The parliament is visible but kept to the side — the point of the picture is that this room looks down on it.

THE EMBLEM — the centre of the image. On the chamber's end wall, directly behind the head of the table and in the exact centre of the frame, the society's sigil as a large pale-stone relief, about one quarter of the image width, lit from one side by a single wall lamp so it reads by its own shadows. Copy it faithfully from the scan: a tall isosceles triangle (a pyramid) with a single dot at its apex like an eye; above the triangle a semicircular arch carrying SEVEN small discs; inside the triangle an hourglass figure with a dot in its upper half, flanked by small oval marks; at the base of the composition three small triangles, each with a tiny triangle inside; thin white outlines and flat white fills, austere and geometric, with a masonic / alchemical feel — no colour inside the sigil, no glow, no shine. The sigil is the only emblem in the picture; a second, smaller version may be repeated as a discreet seal pressed into the leather of a dossier on the table. No company name on the wall — a secret society does not write its name on walls. (Optional, only if it stays clean: the words "Septem Tribus" engraved very small in blackletter on a brass plate under the relief.)

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a photograph or sober architectural visualisation, NOT cinematic concept art; standard lens 35–50 mm from a standing eye height at the far side of the room, slightly off-axis so the table is asymmetric in the frame while the relief stays centred; light only from plausible sources (the table lamps, the one wall lamp, the dusk from the window); NO volumetric god-rays, glowing haze, lens flares, mirror-polished floors or bloom; muted naturalistic colour led by warm stone, dark wood and the cool grey of the window, no teal-and-orange grade; materials USED and real (worn leather, scuffed brass, dust in the relief's grooves, a cable under the table); modest human scale — a meeting room, not a cathedral; slight grain, no gloss, no AI sheen. Be bold in the idea and sober in the photograph: the drama is in who sits here and what hangs on the wall, never in effects.

NEVER: a sign, billboard or logo on a building exterior; game icons, tokens, cards, cubes, party banners or UI; a card frame or border; any text other than the optional tiny brass plate; hooded robes, candles, skulls, ritual daggers or any occult cliché — these are lobbyists in suits, not a cult; uniforms or matching clothing; a symmetrical vanishing-point corridor; heroic posing or glamour portraits; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** эмблема — ИМЕННО со скана (пирамида с точкой-глазом, дуга из семи дисков, песочные часы внутри,
  три малых треугольника у основания), одна, по центру, крупно; кресел семь; нет названия на фасаде, нет оккультных штампов
  (капюшоны, свечи), нет «AI-открытки» (лучи, зеркальный пол, осевая симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same room and emblem, a different moment and vantage — nothing from the
  previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\Septem Tribus_art.png` → при внедрении карты
  `node scripts/import-card-art.mjs "<png>" <ключ арта новой карты>` → `npm run make:cards` (ключ арта = `metadata.cardNumber`
  Redux-версии; классическая R15 остаётся за старой картой).
