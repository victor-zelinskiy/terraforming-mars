<template>
  <!-- THE DELEGATES ZONE — the ONE ledger of every player's places: the
       lobby's single socket (the free delegate waits there, or it is
       spent) and the reserve as a stack with its count; the NEUTRAL supply
       beside them (no lobby of its own); the deck last. It lives in the
       head's TRAILING region, whose left edge is the crumb's RESERVED
       width — so the groups stand at the same screen coordinates in the
       overview and in the vote mode, left-aligned, and never re-centre
       when a count or a word changes. Every delegate's flight leaves from
       these very places in both modes. -->
  <div class="con-parl__seats" data-parl-seats data-parl-zone>
    <div v-for="seat in seats" :key="seat.color" class="con-parl__seat"
         :class="{'con-parl__seat--me': seat.color === viewerColor}"
         :data-parl-seat="seat.color">
      <span class="con-parl__seat-ident">
        <!-- WHOSE row: the player's DOT, never a figure — every figure on this ledger is a PHYSICAL delegate (the
             lobby's, the reserve's), so the player counts what is left at a glance (the owner, 2026-10-24). -->
        <span class="con-parl__seat-dot" :class="'player_bg_color_' + seat.color" aria-hidden="true"></span>
        <span class="con-parl__seat-name">{{ seat.name }}</span>
      </span>
      <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'lobby', 'con-parl__seat-place--carrying': carryingFrom(seat.color) === 'lobby'}" data-parl-seat-place="lobby" :data-parl-carrying="carryingFrom(seat.color) === 'lobby' ? '' : undefined" :aria-label="$t('Lobby')">
        <span class="con-parl__seat-obj">
          <span class="con-parl__socket con-parl__socket--seat" :class="{'con-parl__socket--empty': !seat.lobby}" :data-parl-seat-lobby="seat.color">
            <PlayerDelegate v-if="seat.lobby" :color="seat.color" :glow="false" />
          </span>
        </span>
      </span>
      <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'reserve', 'con-parl__seat-place--incoming': seat.incoming > 0, 'con-parl__seat-place--carrying': carryingFrom(seat.color) === 'reserve'}" data-parl-seat-place="reserve" :data-parl-carrying="carryingFrom(seat.color) === 'reserve' ? '' : undefined" :aria-label="$t('Reserve')">
        <!-- A delegate is on its way HOME (the sitting's enactment beat): the
             reserve's key says so with a quiet arrow — a mark that lives on
             the key's own line (absolute, opacity only: nothing shifts). -->
        <!-- The «→ reserve» mark exists ONLY while a cube is on its way back (absolute, zero layout — a
             standing invisible glyph read as cut text to the fit probes). -->
        <span v-if="seat.incoming > 0" class="con-parl__seat-incoming con-parl__seat-incoming--on" :data-parl-seat-incoming="seat.incoming" aria-hidden="true">←</span>
        <span class="con-parl__seat-obj">
          <!-- THE LANDING FRAME: a returning delegate's touchdown re-keys the stack, whose one-shot ring plays
               on mount and ends on its own animationend — the reserve place answers the arrival where the eye
               is (never a timer, never a caption: the row already names the seat). -->
          <span :key="'st' + seat.color + landFlashOf(seat.color)" class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': seat.reserveCubes === 0, 'con-parl__stack--landed': landFlashOf(seat.color) > 0}" :data-parl-seat-reserve="seat.color" :data-count="seat.reserveCubes" :data-parl-seat-landed="landFlashOf(seat.color) > 0 ? landFlashOf(seat.color) : undefined">
            <span v-for="n in Math.min(seat.reserveCubes, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
              <PlayerDelegate :color="seat.color" :glow="false" />
            </span>
          </span>
          <b :key="'sr' + seat.reserve" class="con-parl__seat-count con-parl__tick">×{{ seat.reserve }}</b>
        </span>
      </span>
    </div>
    <div class="con-parl__seat con-parl__seat--neutral" data-parl-neutral-pool>
      <span class="con-parl__seat-ident">
        <span class="con-parl__seat-dot con-parl__seat-dot--steel" aria-hidden="true"></span>
        <span class="con-parl__seat-name">{{ $t('Neutral') }}</span>
      </span>
      <!-- A SOURCE, marked like the viewer's own place, while the vote mode's door also pays the selected
           card's party out of this supply (`neutralSource`) — the second source of the press, named before it. -->
      <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': neutralSource, 'con-parl__seat-place--carrying': carryingFrom('neutral') === 'pool'}" data-parl-seat-place="neutral" :data-parl-neutral-source="neutralSource ? '' : undefined" :data-parl-carrying="carryingFrom('neutral') === 'pool' ? '' : undefined" :aria-label="$t('Reserve')">
        <span class="con-parl__seat-obj">
          <span class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': neutralSupplyShown === 0}" data-parl-neutral-cube :data-count="neutralSupplyShown">
            <span v-for="n in Math.min(neutralSupplyShown, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
              <PlayerDelegate color="neutral" steel :glow="false" />
            </span>
          </span>
          <b :key="'n' + neutralSupplyShown" class="con-parl__seat-count con-parl__tick">×{{ neutralSupplyShown }}</b>
        </span>
      </span>
    </div>
    <!-- THE TWO PILES — PHYSICAL piles at the zone's end: the DECK (the top back —
         the bill seen from behind — slim edges of the cards beneath, tiered by
         the count; a ghost when empty) and the DISCARD beside it (the same pile,
         face-down, dimmer). The renewal deals the fresh resolutions FROM the
         deck's top card, puts every leaving card ONTO the discard, and turns
         the discard over INTO the deck when the deck is empty — so both piles
         and both counts keep their pre-response reading and move card by
         card as each of those lands (`parliamentHolds.pile`). -->
    <!-- The piles' captions are ONE WORD each (PL-148): everything on this line is resolutions, and «КОЛОДА РЕЗОЛЮЦИЙ ·
         СБРОС РЕЗОЛЮЦИЙ» was the 280 px (4K) that kept a two-seat table from standing beside the widest crumb
         («ПРЕДСЕДАТЕЛЬСТВО › КАРЬЕРА») — the zone folded under it and the tiers below lost a line. -->
    <div class="con-parl__seat con-parl__seat--deck" data-parl-deck>
      <span class="con-parl__seat-place" :aria-label="$t('Deck')">
        <span class="con-parl__seat-obj">
          <span class="con-parl__deck" :class="{'con-parl__deck--empty': deckShown === 0}" :data-count="deckShown" data-parl-deck-pile aria-hidden="true">
            <span v-if="deckLayers >= 2" class="con-parl__deck-layer con-parl__deck-layer--2"></span>
            <span v-if="deckLayers >= 1" class="con-parl__deck-layer con-parl__deck-layer--1"></span>
            <span class="con-parl__deck-top" data-parl-deck-top></span>
          </span>
          <b :key="'d' + deckShown" class="con-parl__seat-count con-parl__tick">×{{ deckShown }}</b>
        </span>
      </span>
      <span class="con-parl__seat-place con-parl__seat-place--discard" data-parl-discard :aria-label="$t('Discard pile')">
        <span class="con-parl__seat-obj">
          <span class="con-parl__deck con-parl__deck--discard" :class="{'con-parl__deck--empty': discardShown === 0}" :data-count="discardShown" data-parl-discard-pile aria-hidden="true">
            <span v-if="discardLayers >= 2" class="con-parl__deck-layer con-parl__deck-layer--2"></span>
            <span v-if="discardLayers >= 1" class="con-parl__deck-layer con-parl__deck-layer--1"></span>
            <span class="con-parl__deck-top" data-parl-discard-top></span>
          </span>
          <b :key="'x' + discardShown" class="con-parl__seat-count con-parl__tick">×{{ discardShown }}</b>
        </span>
      </span>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {supportDiscardPoolHeld} from '@/client/console/parliament/supportDiscard';
import {delegateExchangeReserveStanding, delegateRemovalPoolHeld, delegateRemovalReserveHeld} from '@/client/console/parliament/delegateRemoval';
import {rallyPoolHeld} from '@/client/console/parliament/neutralRally';
import {rivalPoolHeld} from '@/client/console/parliament/parliamentRivalVotes';
import {rivalVotes} from '@/client/console/parliament/parliamentRivalVotes';
import {ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {BenchSource, seatSourceOf} from '@/client/console/parliament/parliamentVoteView';

/** A pile's edges beneath its top back: none for one card, one for a few, two for a stack. */
function pileLayers(n: number): number {
  return n <= 1 ? 0 : (n <= 3 ? 1 : 2);
}

/** A player's group on the delegates zone: the lobby socket, the reserve's cubes (shown) and its count (said). */
type SeatRow = {color: Color, name: string, lobby: boolean, reserve: number, reserveCubes: number, chairman: boolean, /** Delegates on their way back to this reserve (the enactment's return flights still in the air). */ incoming: number};

/**
 * The delegates zone of the Parliament's head line — every seat's places as
 * SHOWN: the live model, minus what the results scene still holds on the
 * table (a delegate that has not flown home yet), plus what the vote mode
 * keeps painting until its cube has visibly left.
 */
export default defineComponent({
  name: 'ConsoleParliamentSeats',
  components: {PlayerDelegate},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    benchSource: {type: String as PropType<BenchSource>, required: true},
    benchWarn: {type: Boolean, default: false},
    /** The common supply is a SOURCE of the press being decided (a door that pays the selected party's Popular Support). */
    neutralSource: {type: Boolean, default: false},
  },
  data() {
    return {
      /** Per seat: how many returning delegates have LANDED on its reserve this mount (each landing re-keys the stack for its ring). */
      landFlash: {} as Record<string, number>,
    };
  },
  computed: {
    /** The price tokens that have landed on the viewer's reserve stack (PL-100) — each is a touchdown the stack answers. */
    reserveAnswers(): number {
      return parliamentFlow.reserveAnswers;
    },
    /** THE SEATS — every participating player's places, with the results scene's display holds applied. */
    seats(): Array<SeatRow> {
      const me = this.viewerColor;
      const holds = parliamentHolds;
      return this.view.players.filter((p) => p.participates).map((p) => {
        const pendingLobby = holds.lobby.has(p.color);
        // Delegates on their way home: off the enacted card (the enactment's returns) and off a loser (the renewal's).
        const pendingReturns = (holds.returns.get(p.color) ?? 0) + (holds.renewalReturns.get(p.color) ?? 0);
        // …and a figure a card took off the table (TR72) that is still in the air home: the reserve counts it on its touchdown.
        // An exchange's own figure (TR74) stands in the reserve until it is taken off the stack.
        const base = Math.max(0, p.reserve - pendingReturns - delegateRemovalReserveHeld(p.color) + delegateExchangeReserveStanding(p.color) + (pendingLobby ? 1 : 0));
        // The viewer's places keep PAINTING the delegate that is leaving until
        // its proxy stands over it (`sourceHold`), and keep SAYING its count
        // until it has visibly left (`sourceLeaving`) — by the NUMBER still to
        // leave (a grant sends up to two, one flight after another).
        const mine = p.color === me;
        // ANOTHER SEAT'S cube on its way to a card (`parliamentRivalVotes`): its place keeps painting it until the
        // proxy stands over it — the same law as the viewer's own source, for a rival's lobby socket and reserve stack.
        const rival = rivalVotes.sources.get(p.color);
        return {
          color: p.color, name: p.name,
          lobby: (p.lobby && !pendingLobby) || (mine && parliamentFlow.sourceHold === 'lobby') || (rival?.lobby ?? 0) > 0,
          reserve: base + (mine && parliamentFlow.sourceLeaving === 'reserve' ? Math.max(1, parliamentFlow.sourceLeavingCount) : 0) + (rival?.reserve ?? 0),
          reserveCubes: base + (mine && parliamentFlow.sourceHold === 'reserve' ? Math.max(1, parliamentFlow.sourceHoldCount) : 0) + (rival?.reserve ?? 0),
          chairman: p.chairman,
          incoming: pendingReturns + delegateRemovalReserveHeld(p.color),
        };
      });
    },
    neutralSupplyShown(): number {
      // …PLUS the cubes a grant's support has not LIFTED yet (`supportHeld`): the answer already took them
      // out of the supply, the bench keeps painting and counting each until its proxy stands over it.
      // …and MINUS the cubes a support-area pick (TR12) sent back that have not LANDED here yet: the answer already
      // put them in the supply, the pool counts each on its touchdown.
      // …PLUS the cubes a card's RALLY (TR31) took that have not LIFTED yet: the answer already moved them, the
      // bench keeps painting and counting each until its proxy stands over it.
      // …PLUS the cubes the sitting's support step took that have not lifted yet (`supportPool` — the soft gates: the
      // verdict stands over a supply the pass has already spent).
      return Math.max(0, this.view.neutralSupply - (parliamentHolds.returns.get('neutral') ?? 0) - (parliamentHolds.renewalReturns.get('neutral') ?? 0) -
        supportDiscardPoolHeld() - delegateRemovalPoolHeld()) + parliamentFlow.supportHeld + rallyPoolHeld() + rivalPoolHeld() + parliamentHolds.supportPool;
    },
    /** The deck as SHOWN — the renewal's tact moves the piles card by card as each landing happens; the live count otherwise. */
    deckShown(): number {
      return parliamentHolds.pile?.deck ?? this.view.deckSize;
    },
    /** The discard as SHOWN — the same hold. */
    discardShown(): number {
      return parliamentHolds.pile?.discard ?? this.view.discardSize;
    },
    /** The pile's edges beneath the top back: none for one card, one for a few, two for a stack. */
    deckLayers(): number {
      return pileLayers(this.deckShown);
    },
    discardLayers(): number {
      return pileLayers(this.discardShown);
    },
  },
  watch: {
    /** A PRICE TOKEN LANDED on the viewer's reserve stack (PL-100 — the resource that buys the delegate): the stack answers with its landed flash, the cube lifts next. */
    reserveAnswers(now: number, was: number): void {
      const me = this.viewerColor;
      if (now > was && me !== undefined) {
        this.landFlash[me] = (this.landFlash[me] ?? 0) + 1;
      }
    },
    /**
     * A RETURNING DELEGATE LANDED: the shown reserve grows by one while the
     * sitting stands (the display hold lets go touchdown by touchdown) —
     * that frame is the ring's cue. The vote mode's own cube leaving never
     * counts (the sitting is the only stage the reserve grows in).
     */
    seats(now: Array<SeatRow>, was: Array<SeatRow>): void {
      // The sitting and «ПРЕДСЕДАТЕЛЬСТВО» are the two stages a reserve GROWS in
      // (a vote's own cube leaving never counts).
      if (parliamentFlow.stage !== 'sitting' && parliamentFlow.stage !== 'quest') {
        return;
      }
      for (const seat of now) {
        const before = was.find((s) => s.color === seat.color);
        if (before !== undefined && seat.reserveCubes > before.reserveCubes) {
          this.landFlash[seat.color] = (this.landFlash[seat.color] ?? 0) + 1;
        }
      }
    },
  },
  methods: {
    landFlashOf(color: Color): number {
      return this.landFlash[color] ?? 0;
    },
    /** WHICH of the viewer's places the next delegate leaves — marked on the zone while the mode stands, never on another player's group. */
    /**
     * WHO CARRIES the delegate in the air right now — another seat's (or a rival card's neutral) figure leaving THIS
     * place: the place lights for the length of the carry, so the eye reads WHO moves it by the place it left, never by
     * its colour alone (a rival's vote, a rival's rally out of the common supply).
     */
    carryingFrom(color: Color | 'neutral'): 'lobby' | 'reserve' | 'pool' | undefined {
      const flying = rivalVotes.flying;
      if (flying === undefined || flying.kind !== 'vote' || flying.owner !== color) {
        return undefined;
      }
      return flying.source;
    },
    seatSourceOf(seat: SeatRow): 'lobby' | 'reserve' | undefined {
      return seatSourceOf(seat.color, this.viewerColor, this.benchSource, this.benchWarn);
    },
  },
});
</script>
