# Иконка ресурса карт · Director («директор», Board of Directors P45) — промт для генератора OpenAI

Составлен 2026-11-02. Текущий спрайт `assets/resources/director.png` (331², плоский, из апстрима) — квадратная плитка
с глянцевой серой рамкой, полем с «горизонтом» (верх светлее, низ темнее, как фон портрета) и светло-серым силуэтом
головы с плечами в профиль вправо. Его нужно перевести в премиум-семью спрайтов ресурсов `assets/resources/*.png`
(512², RGBA, прозрачный фон вне рамки) по образцу `resource-icon-leverage.md`: эталоны `leverage.png` и `camp.png`.

Решения адаптации:
- **Устройство семьи:** квадратная плита с фасками и вырезами на углах, тёмный оружейный металл рамки с врезными
  планками по центру сторон, тонкая внутренняя кромка, матовое поле с фактурой, глиф — рельеф из одного материала
  с фаской, читается силуэтом на 28 px.
- **Не спутать с соседями:** `graphene.png` — почти ЧЁРНОЕ поле + белый глиф; `wild.png` — СВЕТЛО-серое поле +
  тёмный глиф; `mech.png` — тёмно-СИНЕЕ поле + светлый глиф. Поэтому у директора поле СРЕДНЕ-серое графитовое,
  слегка тёплое (не чёрное, не светлое, не синее), и сохраняет «горизонт» печати — верх на тон светлее низа. Это
  его опознавательный знак рядом с графеном.
- **Глиф:** бюст печати — голова с плечами в профиль вправо, светлый (слоновая кость / матовое серебро), как у
  `graphene`/`mech` светлые глифы. Силуэт печати угловатый — оставить его чёткие плоские массы, без лица, черт,
  волос, галстука.
- **Сдержанность (инвариант 15):** кромка не светится (у `camp.png` лёгкий ореол — не повторять); внутренняя
  кромка — холодная серебристо-серая тонкая линия, не оранжевая.

Приложить к запуску: `assets\resources\director.png` (силуэт — с него), `assets\resources\leverage.png` и
`assets\resources\camp.png` (рамка и материал).

## Промт (один блок, скопировать целиком)

```
You are making ONE game resource icon for a premium digital edition of the board game Terraforming Mars. Attached: (1) the current flat "Director" token — a grey tile with a pale head-and-shoulders silhouette in profile; copy the BUST SHAPE and the two-tone "horizon" background from it; (2) and (3) two finished icons from our premium icon family ("leverage" — yellow, "camp" — orange); copy the FRAME, the MATERIALS and the RENDERING from them. Generate the finished icon right away, without asking questions.

WHAT IT IS. "Director" is a card resource of the prelude "Board of Directors": seats on a corporate board, each one a director who can sign off a new venture. The icon is a director's portrait bust.

THE TILE. A square tile seen straight on, exactly like the reference icons: a heavy frame of dark, slightly worn gunmetal with chamfered, notched corners and short inset metal bars at the middle of each side, fine machined bevels, small scuffs on the edges; just inside the frame, a thin cool silver-grey inset line running all the way round (a crisp painted edge, not glowing). The field inside the frame is a MATTE medium graphite grey with a faint warm undertone and a fine subtle surface texture like painted metal or fine-grain leather — clearly MID-grey: not near-black, not light grey, not blue. Keep the printed token's "horizon": the upper part of the field one step lighter, the lower part one step darker, divided by a soft, gently curved line at about the height of the bust's chin, like a studio portrait backdrop.

THE GLYPH — centred, large, filling about 65% of the field height. The bust from the printed token, faithfully: a head and shoulders seen in strict side profile facing RIGHT, the back of the head on the left, the neck dropping into a broad angled shoulder line that runs off toward the bottom left. Rendered as a single solid relief in pale ivory / matte silver — like the light glyphs in our "graphene" and "mech" icons: flat faces, a narrow bevelled edge catching a little light, a soft contact shadow on the field. Bold simple masses with crisp, slightly faceted edges like the printed silhouette. The silhouette must read instantly as a person's bust even at 28 pixels: no face details, no eye, no ear, no hair strands, no tie, no suit pattern, no skin tones.

STYLE. Match the reference icons exactly: the same frame construction and proportions, the same front-on orthographic view, the same crisp game-UI rendering with realistic materials, soft even studio light from the upper left, no perspective. Restrained: no glow, no neon, no light rays, no lens flare, no sparkle, no bloom around the frame or the glyph. No text, no numbers, no letters, no extra symbols, no background scene.

OUTPUT: one square image, 1024×1024, the tile filling the canvas edge to edge, TRANSPARENT background outside the frame's outline (PNG with alpha), no drop shadow outside the tile.
```

## Служебное

- **Проверить глазами (и на 28–32 px):** силуэт бюста читается сразу; поле средне-серое матовое с «горизонтом» — не
  путается с чёрным `graphene.png`, светлым `wild.png` и синим `mech.png`; рамка той же конструкции, что у эталонов
  (фаски, вырезы, планки по центрам сторон); кромка без свечения; фон вне рамки прозрачный; нет надписей и черт
  лица — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same tile, frame and bust shape — bolder glyph, calmer edge.»
- **Выход:** PNG 1024×1024 → `C:\Users\zelin\Downloads\Mars Arts\director.png` → уменьшить до 512×512 (RGBA, как у
  соседей) → `assets/resources/director.png`. Ресурс уже подключён (`CardResource.DIRECTOR`, `cards_v2.less`) —
  заменяется только спрайт по тому же пути.
