# MarsBot home rules — where the fork departs from the Automa rulebook

The rulebook (Rule Book C, `docs/AUTOMA_DATA_AUDIT.md`) is the source of truth for MarsBot. This file lists the
places the fork rules something the rulebook does not cover, each with the owner's word, the data it stands on and
its guard. A new home rule is a section here.

## 1. A tag with no track resolves as a random ordinary tag (the owner, 2026-10-31)

**Rule.** When the bot resolves a project card, each printed tag resolves on its own, left to right, as before. A
tag the bot's board has NO track for — Mars (Turmoil Redux, Pathfinders), Moon (The Moon), Crime (Underworld),
Clone (Pathfinders) — flips the top card of the project deck and advances the track of **one random** tag of it that
has a track (the game's seeded RNG); the flipped card is discarded. A flipped card with no such tag is discarded and
the next one flipped (at most 10). So a card [Mars, Building] gives two steps, like any two-tag card.

**Stays as in the rulebook.** Wild advances the least advanced track. Venus without Venus Next is an unused
expansion's icon and is ignored. The Redux chairman quest and the corporation's «when MarsBot resolves a <tag>»
clause still see the PRINTED tag — the flip only chooses the track.

**Hidden.** Told ONLY in the bot-turn review («Разбор хода»): the tag step carries `flip: {card, tag}` and the review
adds one quiet note «у метки нет трека — вскрыта карта «…»» under the tag, the track's advance line after it. No
journal line, no notification (the owner: «инфа видна только в обзоре хода бота»).

**Why.** Before the rule such a tag was ignored, and a card whose EVERY tag was one (10 Mars-only cards in a Redux
deck: Political Donation, Political Think Tank, Council Seat, Red Tech Convention, Reds News Outlet, Nationalist
Movement, Martian Census, Red Lawyers, Formula Zero, Mech Sports) was a turn with no step and not even a Failed
Action's 5 M€. The pool today (project cards, preludes and CEOs excluded):

| Module | Cards | Tags with no track | Share of the module's tags | Cards with ONLY such tags |
| --- | --- | --- | --- | --- |
| Turmoil Redux | 76 | 17 (Mars) | 14 % | 10 |
| Pathfinders | 73 | 36 (Mars 34, Clone 2) | 23 % | 3 |
| Underworld | 102 | 37 (Crime 35, Mars 2) | 22 % | 9 |
| The Moon | 88 | 55 (Moon 54, Mars 1) | 39 % | 19 |

**Why random, not Wild, not a fixed track, not the flipped card's first tag.** With several of these modules in, 10–15 %
of the bot's tags would be untracked. As Wild they would all lift the least advanced track (the early cheap icons —
the power track's «+3 TR» on its 3rd cell); mapped to building they would push the already most common tag (16.5 %)
toward 29 %. The flipped card's FIRST tag skews too (a Redux deck: power 14.2 % of flips against 10.7 % of the deck's
tags, event 6.8 % against 11.4 % — an event tag is printed last). A random tag of the flipped card stays within 2
points of the deck's own mix on every track — a tag with no track is worth what an ordinary tag of the same deck is
worth, whatever modules are in. Cost: the project deck thins by about one card per such tag.

**Code.** `common/automa/AutomaFlipTags.ts` (`AUTOMA_FLIP_TAGS`, `AUTOMA_FLIP_MAX_CARDS`) ·
`AutomaResolver.resolveTag` / `flipForTrack` · the step `MarsBotTagFlip` (`common/automa/MarsBotTurn.ts`) ·
the review's `TAG_FLIP_NOTE_KEY` (`client/components/marsbot/botTurnReviewModel.ts`).
**Guards.** `tests/automa/AutomaFlipTags.spec.ts` — the flip, the skip, a mixed card, the random pick across seeds,
Venus untouched, a real turn (the step carries the flip, nothing reaches the journal) and the GUARD: every `Tag`
value is a track on the board, Wild, or in `AUTOMA_FLIP_TAGS` — a NEW tag fails until it is decided.
`botTurnReviewModel.spec` § 7b.

## 2. The M€ → VP ladder follows the table size (the owner, 2026-10-31)

+2 generations per human beyond the first — see `marsbot-second-shift.md` § A separate fork rule.
