# Иконка ресурса карт · Leverage («рычаг», Titan Holdings TR84) — промт для генератора OpenAI

Составлен 2026-10-27. Печатный жетон ресурса (`…\TM Turmoil Redux\Assets\Leverage.png`, 246²) — плоская
золотисто-жёлтая плитка с градиентной рамкой и тёмным силуэтом рукопожатия; у верхней (правой) руки — светлый контур,
отделяющий её от нижней. Его нужно перевести в премиум-семью спрайтов ресурсов `assets/resources/*.png` (512², RGBA,
прозрачный фон вне рамки): эталоны `camp.png` (оранжевое поле, тёмный тиснёный глиф, тёмная техно-рамка с тонкой
тёплой внутренней кромкой) и `graphene.png` (то же устройство в чёрно-серебряной гамме); соседи той же семьи — `mech.png`,
`data.png`.

Решения адаптации:
- **Устройство семьи:** квадратная плита с фасками и вырезами на углах, тёмный оружейный металл рамки с врезными
  планками по центру сторон, тонкая тёплая внутренняя кромка, матовое поле с фактурой, глиф — рельеф из одного
  материала с фаской, читается силуэтом на 28 px.
- **Не спутать с соседями:** `megacredit.png` — полированное ЗОЛОТО (и рамка золотая) → у рычага поле МАТОВОЕ
  шафраново-жёлтое, рамка тёмная, никакого блеска металла на поле; `camp.png` и `data.png` — ОРАНЖЕВЫЕ → поле заметно
  желтее (шафран/янтарь, как печать), не оранжевое.
- **Глиф:** рукопожатие печати, тёмный (почти чёрный тёплый графит / тёмная бронза), как тент у `camp.png`; разделение
  рук — тонкой приподнятой светлой фаской вдоль верхней руки (наследник светлого контура печати), не цветом.
- **Сдержанность (инвариант 15):** кромка не светится — у `camp.png` есть лёгкий ореол, здесь его не повторять.

Приложить к запуску: печать `…\TM Turmoil Redux\Assets\Leverage.png` (силуэт — с неё) и `assets\resources\camp.png`
(+ `graphene.png`, если генератор берёт третий референс) — рамка и материал с них.

## Промт (один блок, скопировать целиком)

```
You are making ONE game resource icon for a premium digital edition of the board game Terraforming Mars. Attached: (1) the printed token "Leverage" from the physical game — a flat yellow tile with a dark handshake silhouette; copy the HANDSHAKE SHAPE from it; (2) and (3) two finished icons from our premium icon family ("camp" — orange, "graphene" — black and silver); copy the FRAME, the MATERIALS and the RENDERING from them. Generate the finished icon right away, without asking questions.

WHAT IT IS. "Leverage" is a card resource of a real-estate and lobbying corporation: political leverage, favours owed, deals that can be cashed in for votes. The icon is a handshake — a deal made.

THE TILE. A square tile seen straight on, exactly like the reference icons: a heavy frame of dark, slightly worn gunmetal with chamfered, notched corners and short inset metal bars at the middle of each side, fine machined bevels, small scuffs on the edges; just inside the frame, a thin warm amber inset line running all the way round (a crisp painted edge, not glowing). The field inside the frame is a MATTE saffron-yellow — warm, golden yellow like the printed token, slightly deeper toward the edges and a touch lighter in the centre, with a fine subtle surface texture like painted metal or fine-grain leather; clearly YELLOW, not orange, and NOT polished or shiny gold.

THE GLYPH — centred, large, filling about 65% of the field width. The handshake from the printed token, faithfully: two hands clasped in a horizontal handshake seen from the side; one hand enters from the lower left with a cuffed wrist, its four fingers wrapping over the other hand as rounded stripes along the bottom; the other hand enters from the upper right, its wrist and thumb forming the sloped upper edge of the shape. Rendered as a single solid relief in very dark warm graphite / dark bronze — like the dark tent in the "camp" reference: flat faces, a narrow bevelled edge catching a little light, a soft contact shadow on the field. The two hands are told apart only by a thin raised lighter bevel running along the outline of the upper-right hand (the descendant of the light outline on the printed token) — no second colour. The silhouette must read instantly as a handshake even at 28 pixels: bold simple masses, no tiny finger details, no fingernails, no skin tones, no shirt cuffs patterns.

STYLE. Match the reference icons exactly: the same frame construction and proportions, the same front-on orthographic view, the same crisp game-UI rendering with realistic materials, soft even studio light from the upper left, no perspective. Restrained: no glow, no neon, no light rays, no lens flare, no sparkle, no bloom around the frame or the glyph. No text, no numbers, no letters, no extra symbols, no background scene.

OUTPUT: one square image, 1024×1024, the tile filling the canvas edge to edge, TRANSPARENT background outside the frame's outline (PNG with alpha), no drop shadow outside the tile.
```

## Служебное

- **Проверить глазами (и на 28–32 px):** силуэт рукопожатия читается сразу; поле жёлтое матовое — не путается с золотым
  `megacredit.png` и не оранжевое, как `camp.png` / `data.png`; рамка той же конструкции, что у эталонов (фаски, вырезы,
  планки по центрам сторон); кромка без свечения; фон вне рамки прозрачный (если генератор отдал белый/шахматку —
  перегенерить с «transparent background» или вырезать по контуру рамки); нет надписей и кожи — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same tile, frame and handshake shape — bolder glyph, calmer edge.»
- **Выход:** PNG 1024×1024 → `C:\Users\zelin\Downloads\Mars Arts\leverage.png` → уменьшить до 512×512 (RGBA, как у
  соседей) → `assets/resources/leverage.png`. Это спрайт НОВОГО ресурса карт — подключение по чеклисту
  `docs/claude/turmoil-redux-card-checklist.md` (новый ресурс: `CardResource` + спрайт + `@card_resource_types`
  (cards_v2.less) + `@resource_types` (resources.less) + `cardResources.ts` + `CardListModel.ts` + множественное в
  `ConsoleExtrasExplorer.vue` + `"Leverage"`/`"Leverages"` в `console.json`/`ui.json`) — делается вместе с картой TR84.
