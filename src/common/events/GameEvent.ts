import {Color} from '../Color';
import {Phase} from '../Phase';
import {CardName} from '../cards/CardName';
import {SpaceId} from '../Types';
import {TileType} from '../TileType';
import {EventSource} from './EventSource';
import {EventImpact} from './EventImpact';

/**
 * The structured analytics stream that lives ALONGSIDE the text `LogMessage`
 * journal. `LogMessage` stays the display layer (untouched); `GameEvent` is the
 * machine-readable record of what actually happened, for the insightEngine,
 * the effect-statistics overlay and future post-game analytics.
 *
 * See docs/LOGGING_EVENT_MODEL_PROPOSAL.md for the full design.
 */

export type GameEventType =
  // Roots of a correlation chain (a player action / a copied action):
  | 'action'
  | 'copied-action'
  // The marker that a passive effect fired (parent of its impact events):
  | 'effect-triggered'
  // Payments / discounts:
  | 'payment'
  | 'discount-applied'
  // Granular factual deltas:
  | 'resource-changed'
  | 'production-changed'
  | 'card-resource-changed'
  | 'tr-changed'
  | 'global-parameter-changed'
  | 'cards-drawn'
  | 'card-revealed' // a PUBLIC reveal / show / search (counts only, never names)
  /**
   * A CONDITIONAL DRAW SEARCH ran («reveal cards from the deck until you find
   * N with tag X; discard the rest» — `DrawCards` over
   * `Deck.drawByConditionOrThrow`, PL-033): `impact.deckSearch` names the
   * rule, how many cards were turned over, kept and thrown away, the
   * thrown-away cards BY NAME (public by the rules — the log names them too)
   * and whether the deck ran out. Written ONLY for a search (a filter or an
   * `include` predicate — the same verdict that makes the log print the drawn
   * cards publicly): a plain private draw never becomes this event. The kept
   * cards ride the ordinary `cards-drawn` beside it. Journal-visible, never a
   * delta.
   */
  | 'deck-searched'
  | 'tile-placed'
  /**
   * A TILE MOVED from one cell to another (Turmoil Redux TR14 Re-settlement):
   * recorded IN PLACE OF `tile-placed` by the one mover (`Game.moveCityTile`),
   * under the card's own scope. `space` / `tile` are the DESTINATION and what
   * landed there (so everything that reads «a tile came to rest here» reads
   * it), `impact.tileMove` names both cells (`TileMoveFact`). No `tilesPlaced`:
   * the tile is not a new one.
   */
  | 'tile-moved'
  /**
   * A TILE REMOVED from the board (an ocean — the Reds' party action, RX33,
   * Kaguya Tech): `space` is the cell it left, `tile` what stood there.
   * Recorded by the one remover (`Game.removeTile` with its actor) so the
   * Capitals' recount (`impact.adjacencyVp`, PL-141) has an event to ride.
   */
  | 'tile-removed'
  | 'delta-position-changed' // ONE committed Hydronetwork move (signed steps; both directions)
  | 'delta-blockade-changed' // a Modular Floodgates blockade placed against / expired for a player
  | 'vp-granted'
  /**
   * THE CHAIRMAN'S SEAT CHANGED HANDS (Turmoil Redux): `player` is the new
   * chairman, `target.player` the previous one when the office was held (absent
   * when it was empty, or when the sitting chairman completed the quest again).
   * The ONE structural signal the notification's two texts are told apart by —
   * an office is not a resource, so no `impact` delta names it.
   */
  | 'chairman-seated'
  /**
   * THE AGENDA MARKER WALKED (Turmoil Redux): `impact.agenda` carries the
   * walk — from, to, EVERY step with the bonus it paid, and the engine (the
   * sitting's winner step, the chairman quest, a card — TR04 Minority
   * Representation, the card riding the event's `source`). Until TR04 an
   * advance had no event of its own: only log text, and a rival learned of it
   * from the TR delta alone. The steps' TR / card ride their own chokepoint
   * events beside this one; this is the POSITION fact the journal's row and
   * the notification's line read — never a delta.
   */
  | 'agenda-advanced'
  /**
   * INFLUENCE BEYOND THE CAREER (Turmoil Redux, T05 Event Analysts): a card gave the seat «+N influence» — not a step
   * of the track, a bonus on top of it (`Parliament.influenceSourcesOf`). `impact.influence` carries the seat's whole
   * influence before → after; the journal reads it as its own row under the card, a rival's notification as the
   * Parliament's outcome. Recorded by the Redux facade (`ReduxPoliticalOps.addInfluenceBonus`) only.
   */
  | 'influence-changed'
  /**
   * DELEGATES PLACED ON A RESOLUTION BY AN EFFECT (Turmoil Redux): a colony's
   * grant, a card's play (TR03 Political Donation) — `impact.delegates` names
   * how many and onto which resolution. The vote ACTION needs none: its chain
   * has no other row, so its journal line is read. An effect's delegate lands
   * inside a chain that HAS rows (the payment, a trade's income), where a
   * text-only line is hidden — hence the typed fact.
   */
  | 'delegates-placed'
  /**
   * NEUTRAL DELEGATES PLACED ON A RESOLUTION BY A CARD (Turmoil Redux TR31
   * Nationalist Movement — «add 1 neutral delegate to each Reds and Mars
   * First resolution up for voting»): the same `impact.delegates` shape with
   * `neutral: true`. Until TR31 a neutral vote was only ever the sitting's
   * own (a party's support becoming votes at the refresh — told by the
   * phase's summary); a CARD placing one mid-generation is a typed fact of
   * the play's chain, so the journal row and the rival's notification read
   * the dark figure on the resolution it joined. The card rides the event's
   * `source`.
   */
  | 'neutral-delegates-placed'
  /**
   * NEUTRAL DELEGATES ADDED TO A PARTY'S POPULAR SUPPORT BY AN EFFECT
   * (Turmoil Redux, TR03): `impact.popularSupport` names the party, how many
   * landed and what the area holds now. The sitting's own support step is not
   * this event — it is told by the phase's summary.
   */
  | 'popular-support-gained'
  /**
   * …AND ITS PAIR: NEUTRAL DELEGATES DISCARDED FROM A PARTY'S POPULAR SUPPORT
   * BY AN EFFECT (Turmoil Redux TR12 Party Sanctions — «discard all neutral
   * delegates from ONE Popular Support Area»). The same `impact.popularSupport`
   * shape with a NEGATIVE `gained` (how many returned to the common supply) and
   * the area's `total` after it (0), so the journal row and the rival's chip
   * read it exactly like a gain. The card rides the event's `source`.
   */
  | 'popular-support-discarded'
  /**
   * ONE DELEGATE REMOVED FROM THE TABLE BY A CARD (Turmoil Redux TR72 Banned Delegate:redux — «remove any delegate
   * from a resolution or Popular Support area»). `player` is whose effect it was; `target.player` the seat whose cube
   * left (absent for a neutral cube, and for the actor's own — nobody else lost anything); `impact.delegateRemoved`
   * names the place, the owner, where the cube went and what the place holds now. A seat's cube returns to its
   * reserve, a neutral one to the common supply. The card rides the event's `source`. Journal-visible, never a delta.
   */
  | 'delegate-removed'
  /**
   * THE SEAT'S CUBE ON A PARTY'S BANNER (Turmoil Redux Septem Tribus:redux — the first action, or a resolution won):
   * a GRANT of that party's effect (`Parliament.grantPartyEffect`, the card as the source) — never its requirement.
   * `impact.bannerCube` names the party. The card rides the event's `source`. Journal-visible, never a delta; the
   * access it opens (when the party does not rule) is its own `party-effect-gained` beside it.
   */
  | 'banner-cube-placed'
  /**
   * A SEAT GAINED / LOST A PARTY'S EFFECT (Turmoil Redux — PL-112). The law of
   * access (`Parliament.access`) is read live, so until this event nothing
   * told the player that their second cube on a resolution opened the party's
   * effect, or that the refresh took it away. Written by ONE diff
   * (`Parliament.announceAccessChanges`) against the snapshot the Parliament
   * keeps and serializes, after every input a player answered and after every
   * step of a sitting. `impact.partyEffect` names the party and the ROAD —
   * `delegates` (with how many opened it: the printed two, or one under TR36),
   * `card` (a grant, the card riding `source`). A change the RULING PARTY
   * made (the enactment) is NOT this event: it is everyone's, told once by the
   * sitting's own line and its results panel. MarsBot holds no effect and gets
   * none. Journal-visible, never a delta.
   */
  | 'party-effect-gained'
  | 'party-effect-lost'
  /**
   * A TRADE FLEET WAS SENT TO A CARD (Turmoil Redux — a fleet dock: TR06 Water
   * Hauling and its sisters TR26 / TR27). `player` is the trader (always the
   * card's owner — FAQ p.19), `target.card` and the event's `source` name the
   * card. The trade has no colony in it, so nothing else in the chain says
   * WHERE the fleet went: the fee is a payment row and the reward (an ocean, a
   * TR step) is its own chokepoint event. Journal-visible, never a delta.
   */
  | 'fleet-docked'
  /**
   * A CARD EFFECT MOVED A COLONY TILE'S TRACK (Turmoil Redux TR07 Colony
   * Sponsors — «move its marker to the highest position»; written only by
   * `deferredActions/MaximizeColonyTrack`). `impact.colonyTrackMove` names the
   * tile and the marker's position before and after; `player` is the one whose
   * effect it was, the card rides the event's `source`. The track is nobody's
   * stock, so no delta names it, and the log line sits inside a chain that has
   * rows of its own (the play's payment) where a text-only line is hidden —
   * hence the typed fact: the journal's row and a rival's notification read
   * «Трек колонии · Луна 3 → 7». The trade's own pre-trade advance is NOT this
   * event (its income says it).
   */
  | 'colony-track-moved'
  /**
   * THE COLONY ROSTER CHANGED — a colony TILE entered the game, left it, or
   * was replaced in its slot (Aridor's first action, MarsBot's C30 setup, the
   * solo setup trim, Turmoil Redux TR10 Fringe Colony). Written only by the
   * roster's three writers (`ColoniesHandler.seatColonyTile` /
   * `retireColonyTile` / `replaceColonyTile`). `impact.colonyRoster` names the
   * change (`ColonyRosterChange`); `player` is the one whose effect it was
   * (absent for a setup rule), the giver rides the event's `source`. The table
   * is nobody's stock, so no delta names it — hence the typed fact the journal
   * row, a rival's notification and the console's roster ceremony all read.
   */
  | 'colony-roster-changed'
  /**
   * NO SILENT LOSS, the live half: an effect the engine could NOT apply — no
   * card can hold the resource, no opponent can be hit. `impact.skipped` names
   * WHICH effect, WHY, and the magnitude lost, in the SAME words the play
   * preview's warning used before the commit; `player` is the one whose effect
   * it was. Journal-visible, never a delta.
   */
  | 'effect-skipped'
  /**
   * THE SET OF SEATS UNDER A RATING VETO MOVED (Turmoil Redux RX42 UNMI Veto): a rating rose or fell and the seats
   * first by terraform rating are not the seats they were — `impact.ratingVeto` names who ENTERED the veto, who LEFT
   * it, and every seat first by rating now with its rating; `player` is the seat whose rating moved, the standing law
   * rides the event's `source`. Written only while a vetoing law stands, by the rating funnel's own watch
   * (`parliament/ratingVetoGate.withRatingVetoWatch`). Journal-visible, never a delta: the notification tells a seat
   * «the veto now binds you» / «no longer binds you».
   */
  | 'rating-veto-changed'
  /**
   * A CARD WAS PLAYED THANKS TO A REQUIREMENT MODIFIER (TR49 class): at least
   * one printed GLOBAL requirement was met ONLY because of a named modifier —
   * an armed Special Design (±2), Cutting-Edge Design / Ecology Experts (the
   * requirement ignored), Inventrix / Adaptation Technology (±2 for good).
   * `source` is the modifier (one event per source), `target.card` the card
   * played, `impact.requirementEased` the requirements it let through
   * (printed → effective | waived) and whether the play spent it (`oneShot`).
   * Written ONCE, by the play (`Player.playCard`), never by a preview — the
   * journal's row under the play, the rival's notification line and the
   * modifier's trigger count in «ЭФФЕКТЫ» read it. Journal-visible, never a delta.
   */
  | 'requirement-eased'
  // High-level game milestones:
  | 'milestone-claimed'
  | 'award-funded'
  /**
   * THE ROOT OF A SEAT'S PRODUCTION PHASE (TR61 — «ДОХОД — СОБЫТИЕ»): one per
   * player per generation, written by `EventRecorder.beginProductionPhase`
   * under the `production` category. Everything the phase pays is its chain —
   * the production values landing in the stock (`resource-changed` under
   * `{kind: 'production'}`), the terraform rating's M€ (`part: 'rating'`), the
   * energy turned into heat (`part: 'conversion'`) and whatever a card's
   * `onProductionPhase` adds under its own source. The journal groups the
   * phase as one entry, the aggregates read the income per generation, the
   * console's generation scene plays the seat's own record — nothing on the
   * client counts income by itself.
   */
  | 'production-phase-income';

/**
 * Why a passive effect fired (the kind of game event that triggered it).
 * Distinct from {@link GameEventType} — this is the CAUSE, that is the record.
 */
export type EventTrigger =
  | 'card-played'
  | 'card-played-by-any'
  | 'tile-placed'
  /**
   * A tile was placed NEXT TO the recipient's own tile (Ares: the owner of an
   * adjacency-bonus tile earns M€ whoever builds beside it). The source is the
   * RECIPIENT's tile — the card that put it there, or the tile itself — never
   * the placer's card: that is the trigger, and the actor of the chain.
   */
  | 'tile-adjacency'
  | 'production-gain'
  | 'tr-increase'
  | 'colony-added'
  | 'global-parameter'
  | 'standard-project'
  | 'resource-added'
  | 'tag-added'
  | 'cards-not-bought'
  | 'insurance-claim'
  | 'delta-advance' // one committed advance on the Delta Project («Гидросеть») track
  | 'delegates-discarded' // Turmoil Redux: the sitting's refresh sent the player's delegates home off an UNENACTED resolution
  | 'ruling-party-changed' // Turmoil Redux: the sitting's enactment put a NEW party in power (TR62 Tharsis Alliance draws a card)
  | 'resolution-won' // Turmoil Redux: the player won on the enacted resolution (Septem Tribus:redux puts a cube on its party's banner)
  | 'agenda-step' // Turmoil Redux: ONE step of the player's Agenda walk was taken (TR78 Arwind Inc. asks where its fighter goes)
  | 'own-marker-built' // a tile landed on a cell the placer's OWN cube reserved (TR79 Ferrus Academy: 3 data or a card)
  /**
   * Turmoil Redux: the enacted law REPLACED a terraforming unit the seat was about to gain — a scale step or a
   * greenery / ocean tile — with something else BEFORE the engine performed it (RX35 Diverted Research: 1 data
   * apiece). The marker's children are the replacement's own records (the data landing on the chosen card, or the
   * named loss); no `global-parameter-changed` / `tile-placed` stands beside them — nothing of the planet moved.
   */
  | 'terraforming-diverted'
  /**
   * Turmoil Redux: the enacted law VETOED a rating the seat was about to gain (RX42 UNMI Veto: «the player(s) with
   * the highest terraform rating ignore any rating they would gain») — ONE event of the rating funnel, refused whole
   * BEFORE the mutation. The marker's child is the named loss (`effect-skipped` with the rating's magnitude); the
   * scale step / tile / bonus that carried the rating happened as printed, so their own events stand beside it.
   */
  | 'rating-vetoed'
  | 'automa-corporation'; // a MarsBot corporation's printed effect fired (Rule Book B)

/**
 * The narrative role a {@link LogMessage} plays inside its correlation group —
 * lets the journal build a grouped "action → effect → result" view by GROUPING
 * on a structured field, never by parsing the message text.
 */
export type JournalEntryRole =
  | 'root-action' // the player's top-level action — the header of a group
  | 'effect-result' // a passive effect's result line
  | 'detail'; // a child detail (resource / placement / payment) of the action

/**
 * The kind of top-level action heading a journal group — drives the premium
 * category icon / badge. Stamped on the `root-action` log by the recorder.
 */
export type JournalActionCategory =
  | 'card-play'
  | 'card-action'
  | 'corporation-action'
  | 'ceo-action'
  | 'standard-project'
  | 'colony'
  | 'copied-action'
  | 'milestone'
  | 'award'
  | 'delta-project' // an advance on the Delta Project ("Гидросеть") track
  | 'vp-pressure' // a VP-pressure effect activated (Vermin reached 10 animals)
  | 'planetary-event' // an Ares planetary event (hazards appear / intensify / recede)
  | 'solar-phase' // a World Government Terraforming action (the solar phase)
  | 'automa-turn' // one whole MarsBot (Automa) turn — groups the bot's turn in the journal
  | 'parliament' // an in-turn political action (Turmoil Redux): a vote, a party action
  | 'political-phase' // the Mars Parliament's end-of-generation resolution (Turmoil Redux)
  | 'production'; // a seat's production-phase income — one group per player per generation (TR61)

/**
 * `journal` — meaningful to the player / the game's story (may later be shown
 * in the journal as a collapsed detail). `analytics` — only for aggregation
 * (the granular deltas, discounts, effect triggers). There is intentionally NO
 * separate debug layer: if it has no player/analytics meaning, it is not
 * recorded at all.
 */
export type EventVisibility = 'journal' | 'analytics';

export type EventTag =
  | 'discount'
  | 'passive-effect'
  | 'resource-payment'
  | 'payment-bonus' // steel/titanium worth more than base (Advanced Alloys, …)
  | 'colony-track' // a trade-offset effect advanced a colony track (Trading Colony)
  | 'trade-discount' // a trade-discount effect saved trade resources (Cryo-Sleep, …)
  | 'greenery-discount' // a greenery-discount effect saved plants on conversion (EcoLine)
  | 'global-parameter' // a global parameter was raised (oxygen/temp/oceans/venus)
  | 'reveal' // a public card reveal / show / search (analytics-only; counts not names)
  | 'card-impact'
  | 'corporation'
  | 'copy'
  | 'attack'
  | 'engine'
  | 'production'
  | 'terraforming'
  /** A draw delivered through the mandatory EXTERNAL-DRAW intake: the
   *  recipient's presentation is the prompt + its workspace, so the band
   *  builder must not ALSO show the «+N cards» gain (the journal keeps the
   *  event as usual). */
  | 'external-intake';

export type GameEvent = {
  /** Monotonic sequence within a game — the canonical ORDERING key (not the timestamp). */
  id: number;
  generation: number;
  phase: Phase;
  /** The acting / benefiting player. */
  player?: Color;
  type: GameEventType;
  /** What caused this (the serializable `From`). */
  source?: EventSource;
  /** For cross-player effects (attacks/steals) or copy targets. */
  target?: {player?: Color; card?: CardName};
  /** For `tile-placed` / `tile-moved`: the board space (for "show on map") + the tile type. */
  space?: SpaceId;
  tile?: TileType;
  /** For `effect-triggered`: the kind of event that fired the effect. */
  trigger?: EventTrigger;
  /** Factual deltas. */
  impact: EventImpact;
  /** Root action id — ties a whole chain (play card → effect → discount → …) together. */
  correlationId: number;
  /** Immediate cause event id (chain nesting). */
  parentId?: number;
  /**
   * For a ROOT action event (`action` / `copied-action`): which kind of action it
   * heads (card-play vs a blue-card / corp / CEO action vs a standard project / …).
   * Lets aggregation tell a card's ACTION usage apart from its on-PLAY gains (both
   * are `beginAction` roots with the same card source). Stamped by `beginAction` /
   * `beginCopiedAction`; absent on non-root events and on older saves.
   */
  category?: JournalActionCategory;
  visibility: EventVisibility;
  tags?: ReadonlyArray<EventTag>;
};
