# The Parliament's visual iteration of 2026-10-25 — the charter, the access scene, ONE FRAME

The owner's five points of 2026-10-25 (a multi-day autonomous iteration), each answered as a CLASS, never as a
Parliament-only patch.

## 1. THE CHARTER — the party's own card face (`PremiumPartyFace.vue`, theme `charter`)

The owner: «на действиях мы используем карточки, а на экране парламента плитки — надо всё вывести под формат карточек
на фуллскрин … не повтор проектных карточек, свой неповторимый НАСТОЛЬНЫЙ дизайн, логотипу не должно быть отдано так
много места». A party had four visual families (the plaque `.con-pseal`, the bare formula, the project-anatomy face with
the emblem in the art window, bare emblems). The fullscreen subject and every place a CARD would stand now wear ONE face:

| part | what it is | why |
| --- | --- | --- |
| the board | a stiff tile, all four corners cut (`--charter-outline`) | told from a project card (gold frame) and a bill (folded page) by OUTLINE |
| the banner | the party's dyed cloth, a pennant's chevron, a gold hem | the party reads by its colour as a MASS |
| the crest | the emblem, 76 px of 320 | a seal, never the face's subject (no art window) |
| the clauses | «∞ ЭФФЕКТ» / «⚡ ДЕЙСТВИЕ» rule boxes, the label a legend on the box's edge | a tabletop ability frame |
| the foot | «[crown] / [delegate][delegate]» + the expansion stamp | the printed law of access |

- VM: `partyPremiumVm` → `theme: 'charter'`, `parliament.charter = {effect?, action?}` — each clause its own
  `MechanicsVM` over the SAME render-node references as the whole `mechanics` (the ACTION COMMIT's `data-graphic-node`
  anchors resolve on the charter exactly as on a card; spec `partyPremiumVm.spec` § node references).
- `PremiumCard` mounts it like the bill (`isCharter`), root classes `pcard--charter` + `pcard--party-face` (the old hook
  kept: «a party drawn as a card»).
- Hosts: the composer's hero (`.con-composer__actparty`), the fullscreen inspector (`CardZoomCard` — the plaque `full`
  is retired there), «Действия карт»'s detail column (`__detail-party`), the effects explorer's detail card and hero
  (`con-efx__hero-card--party`). The Parliament's OWN overview keeps its compact medallions (`row` / `ruler`).
- Styles: `console_party_face.less` (px in the 320×460 box; gradients / clip-path / box-shadow only).

## 2. THE ACCESS SCENE — «Эффект партии получен» on the workspace

The owner: «workspace просто закрывается и игрок получает слабую нотификацию … получение эффекта партии должно
обыгрываться на самом workspace … связь визуально с тем делегатом». The vote mode arms `parliamentFlow.accessExpected` at
the submit (the viewer does not hold the party and the press reaches its own threshold); when the landing finishes and
the server confirms the access, `finishLanding` plays the scene instead of leaving:

1. **count** — the viewer's delegates on the bill are touched by the count (the recount's mark, `accessCounted`);
2. **return** — the same leave B plays lets go of the chamber (stage `access`: no browse cursor, every press absorbed,
   the frame's phase `executing`, the crumb's tail «ЭФФЕКТ ПАРТИИ»); «ВАШИ ЭФФЕКТЫ» stands with the new tile's place
   RESERVED (`data-parl-effects-arrival="arriving"` — a dashed kant, nothing inside; the grid never re-flows under it);
3. **flight** — `flyAccessSeal`: the party's seal is born ON the delegate that crossed the threshold and travels into
   that place (both ends painted, `addPause`);
4. **landed** — the tile unfolds (`won`, a one-shot + a mint kant), the zone's head crossfades to «✓ Эффект партии
   получен» (`data-parl-effects-won`), the party's bench answers with its access one-shot (deferred from the view apply,
   which played under the vote layer to nobody); a read of `ACCESS_READ_MS`;
5. the flow leaves as ever (`flow-complete`).

The feed's `party-effect` card for that gain is suppressed (`accessToldOnStage.ts` — armed at the submit, consumed by
the notification builder, disarmed by the flow's reset): the hall told it. e2e: `console-parliament-access-scene`
(fixture `parliament-access-edge`).

## 3. ОДНА РАМА — the Parliament on the workspace's own materials

The owner's 4K frame of «ЗАСЕДАНИЕ › НАГРАДА»: «визуал парламента построен как чужеродный элемент … если сравнить с
workspace «карты в руке», «действия карт», «колонии» — там интерфейс более цельный». The diagnosis was MATERIAL: every
other workspace stands on ONE opaque stage surface and puts its work on ONE quiet plane; the Parliament floated over the
board's starfield and its reward was a violet box in a violet box with the reading centred in a void.

- `.con-parl` (non-embedded) wears `.con-stage-surface()` — the room;
- the FIELD pose of the sitting's stage is the room cleared (the room's own paint, flat: no ring, no radius, no drop);
  the table's plate does not stand behind it; the reading line is the stage's HEAD (no pill; its ink ×1.2 / ×1.45 on
  the TV, the band's box unchanged — the geometry probes pin it);
- the zone is no box; what is READ (the colony ledger) stands on `.con-stage-plate()`; what is PICKED (the take) stands
  on the floor exactly as «Действия карт»'s draw zone;
- the carried card is the composer hero's size (`MAX_ENACT_ZOOM` 1.6);
- no Parliament-only tint: the four violet panel washes (the stage, the vote panel, its bill, the sanctions stage) are
  the workspace's opaque plate; violet stays an accent.

## 4. THE PRODUCTION PLATE — a production reads in the card's print

The owner's Industrialists photo: «производство» ran out of its tile, the generic «слабо выглядит». `ActionEffectChip`
draws a `note: 'production'` chip on the face's riveted bronze plate (`.action-effect-chip__prod`) and drops the word;
«ANY production» (`icon: 'resources'`) is the printed «?» on the same plate. The palette's tiles are tokens at the
scene's scale on the TV and their reading shrinks with the tile. The composer's formula FOLLOWS the answered parts of a
two-part pick (`formulaFollowingParts`): «Будет списано [▣?] −1 → Вы получите [▣M€] +2» becomes the chosen pools'
`current → resulting`.

## 5. A PICK FROM THE HAND OPENS THE HAND — wherever it is asked

The Reds' discard (and TR23 Pluto's ledger discard, the generic mandatory `handSelect` — Colonial Affairs' sitting
discard among them —, the patent sale) opened the album with `openHandWorkspace()`: the album's slots appeared while the
fan stayed docked. All four now open through `openHandWithReveal({keepTask: true})` — the cards lift out of the dock.
And a party's / a law's passive draw answering a press (Mars First's city → card) rides the press's CHAIN claim
(`workspaceClaimsDrawReveal`) instead of rising as a standalone reveal over the workspace.
