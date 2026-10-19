# Арт резолюций · универсальный промт для генератора OpenAI (карточка + эмблема)

Составлен 2026-10-19 для карт из `C:\Users\zelin\Downloads\TM Turmoil Redux\Resolutions\skip`. В отличие от
промтов RX## (сцена писалась под каждую карту), этот блок ОДИН на все карты: генератор сам читает скан и
придумывает сцену. Внутри — стилевой блок, эмблемы форка и лор партий (законы `art-prompt-style-block`,
`party-emblems-redux`, «лор партии в каждом арт-промте»).

## Промт для генератора (один блок, скопировать целиком)

```
You are illustrating a resolution card for "Turmoil Redux", a fan expansion of the board game Terraforming Mars. Attached: (1) a scan of the card — its title, its rule icons and the rule text in parentheses; (2) the emblem of the political party that proposes it. Generate ONE finished illustration for this card right away, without asking questions.

WHAT A RESOLUTION IS. Six parties sit in the Martian parliament and propose laws — resolutions. An enacted resolution changes the economy or the rules for every corporation on Mars. The art is a documentary photograph of that law being carried out, or of the world it creates: Mars in the 2400s, being terraformed by giant corporations under the eye of UNMI, the Earth committee that rates the terraforming effort.

HOW TO READ THE CARD. The TITLE is the main source of the idea. The RULE (icons + the text in parentheses) is a secondary hint: take ONE concrete detail from it, never the whole formula. Icon glossary: yellow rounded octagon with a number = M€, money; black spiky badge with a bust = Influence, a party's weight in parliament; orange square with a laurel globe = Terraform Rating, UNMI's score; orange square with 0100/1001 = data; red square with a smoking man in a suit = corruption; brown square with "?" = underground resource token (excavation beneath the surface); round tags — Mars, Earth, black with a yellow star = space, science, building; green hex = greenery, blue hex = ocean, grey hex = city; mechs, floaters, fighters = resources stored on cards; a red arrow = pay to get; a red strike-through = ignore. IGNORE on the scan: the symbol in the top-left corner (an old tabletop icon — the party is the attached emblem, never draw that symbol), the purple frame and the empty purple grid, the small box in the bottom-right corner (a side goal, not part of the law). If the scan's corner symbol and the attached emblem disagree, the attached emblem wins.

HOW TO FIND THE IDEA. Read the title as a headline in a Martian newspaper and ask which photograph ran under it. The title decides WHAT is happening. The party's lore decides WHO is in the frame, WHERE it happens and in what spirit (proud, defiant, bureaucratic, profit-hungry, earnest). The rule adds one concrete physical detail: what is being carried, counted, sealed, built, seized or shut down. Prefer one specific working moment in progress — people at work, mid-action, absorbed in the task, not posing, faces not to camera — over a vista or a symbol. Never depict the mechanic literally: no coins, icons, tokens, counters, cards, arrows or numbers. Translate it into real objects: money → contracts, payroll terminals, invoices, sealed cash cases; influence → delegates, petitions, a hearing, a rally, a lobby corridor; data → drives, server racks, sample archives; terraform rating and global parameters → the real hardware of terraforming: heaters, ice haulers, vents, young forests, open water; city / greenery / ocean → real districts, forests, lakes; corruption → bribes, envelopes, off-the-books cargo, shell offices, inspectors; underground tokens → excavation tunnels, drill cores, caverns, deep mines.

THE SIX PARTIES — identify the attached emblem here; the lore sets the spirit of the frame.
- MARS FIRST — emblem: an orange planet Mars with a thin flagpole and an orange flag on top. Mars' populist centrist party: the terraforming is for the Martians first, everyone else second. It invests heavily in the colonists' living standards — housing, clinics, schools, local jobs — at the expense of other parties' projects. Frame: Martian-born colonists, their settlements and neighbourhood infrastructure, local pride; practical and grassroots. Accent: rust orange.
- SCIENTISTS — emblem: a silver-white atom, three elliptical orbits around a glowing nucleus (NOT a flask). A loose collective of rich entrepreneurs who see Mars as the chance to push science to never-before-seen heights and want to be its vanguard, willing to move heaven and earth for it. Frame: privately funded labs, test rigs, observatories, sample vaults, field teams with expensive gear; ambition with money behind it. Accent: silver-white.
- UNITY — emblem: three interlocked bright-blue rings. Sees Mars as one piece of humanity's settlement of the whole solar system; favoured by factions outside Mars, disliked by the Martians themselves, especially by Mars First. Frame: spaceports, orbital docks, interplanetary freight, delegations from Earth, Venus and the Jovian moons, treaty bureaucracy. Accent: blue.
- GREENS — emblem: a lush tree with a rounded crown, bright green to emerald. Haughty environmentalists: the terraforming is humankind's atonement for ruining Earth, so every available resource must go into it; close ties with UNMI. Frame: greenhouses, nurseries, young forests, algae ponds, animals, ecologists; earnest, a little self-righteous. Accent: green.
- REDS — emblem: a red banner with a black clenched fist in its centre. Mars' nationalist conservatives who want the planet to stay as it was; they pursue the outlandish goal of halting the terraforming by enticing companies to do literally anything else; mortal enemies of the Greens. Frame: untouched red desert, preservation, mining and industry instead of terraforming, idle or dismantled terraforming equipment, stubborn crews. Accent: red and black.
- INDUSTRIALISTS — emblem: a golden gear enclosing a factory silhouette with a saw-tooth roof (NOT a globe). The terraforming will go smoother if corporations may profit as much as they want at the start and grow stronger; critics call it profiteering, but Mars is run by corporations, so the party stays popular. Frame: factories, foundries, assembly lines, freight yards, contracts and quotas, corporate efficiency. Accent: gold.

THE EMBLEM IN THE PICTURE. Show the attached emblem exactly once, copied faithfully in shape and colour (a round very dark navy medallion with a thin gold rim and the party's symbol in the centre), as a natural part of the scene and IN THE DEPTH of the frame: a worn painted stencil on the side of equipment or a vehicle in the midground, a plate or relief on a facade, a banner or pennant seen in perspective. Modest size — about one twentieth to one tenth of the image width. Never a medal or badge in the foreground, never floating, never in the lower-left quarter of the image. The party's accent colour may echo in a few small places (work clothes, hazard paint, a pennant), never as a colour grade over the whole image.

STYLE — the original Terraforming Mars cards are photographs of real places; match them: photograph or sober engineering visualisation of a real facility, NOT cinematic concept art; standard lens 35–50 mm; asymmetric framing, never a symmetrical vanishing-point corridor; light only from plausible sources; NO volumetric god-rays / glowing haze / lens flares / mirror-polished floors / bloom; muted naturalistic colour, no teal-and-orange grade; hardware utilitarian and USED (cable runs, brackets, scuffs, dust, hazard striping, fasteners); modest human scale — a working facility, not a cathedral; slight grain, no gloss, no AI sheen. Mars is physically plausible: rust-coloured dust on everything, a pale butterscotch sky, a small sun; outdoors people wear pressure suits and helmets, inside domes and pressurised halls ordinary work clothes.

NEVER: text, letters, numbers, readable signage or any logo other than the party emblem; game icons, tokens, cards, dice or UI; a card frame or border; the purple of the card frame; the tabletop symbol from the card's corner; collage, split screen or inset; heroic posing, glamour portraits, epic vistas; anything large or badge-like in the lower-left corner.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное (коротко)

- **Приложить к каждому запуску:** скан карты из `skip` + эмблему партии `assets/parties/redux/<партия>.png`.
  На сканах в левом верхнем углу — СТАРЫЕ настольные значки (у Police Funding там круг со стрелками, а партия —
  Марс вперёд), поэтому эмблему брать по таблице ниже, а не по углу скана.
- **Новый чат на каждую карту** — иначе генератор тянет сцену предыдущей.
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\<Имя карты>_art.png` → импорт при внедрении
  карты: `node scripts/import-card-art.mjs "<png>" RX##` → `npm run make:cards`.
- **Проверить глазами:** эмблема — именно форка (атом, не колба; шестерня с заводом, не глобус), одна, в глубине,
  не в нижнем левом углу; нет текста и игровых иконок; кадр не «AI-открытка» (зеркальный пол, лучи в дымке,
  осевая симметрия) — тогда перегенерить.

| Карта (`skip`) | Партия | Эмблема | UW |
| --- | --- | --- | --- |
| Diverted Research | Красные | `reds.png` | |
| Geodesic Contest | Зелёные | `greens.png` | ✓ |
| Legal Monopolies | Индустриалисты | `industrialists.png` | ✓ |
| Live Experiments | Учёные | `scientists.png` | |
| Manufacturing Run | Индустриалисты | `industrialists.png` | |
| Mars First Budget | Марс вперёд | `mars-first.png` | |
| Migration Underground | Красные | `reds.png` | ✓ |
| Peer Review | Учёные | `scientists.png` | ✓ |
| Police Funding | Марс вперёд | `mars-first.png` | ✓ |
| Reds Budget | Красные | `reds.png` | |
| Sponsored Projects | Учёные | `scientists.png` | |
| Tax Breaks | Индустриалисты | `industrialists.png` | |
| UNMI Inspection | Союз | `unity.png` | ✓ |
| UNMI Veto | Красные | `reds.png` | |

Партии — по `docs/TURMOIL_REDUX_SPEC.md` §4.1. UW = карта Underworld (коррупция, подземные токены): глоссарий
иконок в промте это покрывает.
