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
        <PlayerCube :color="seat.color" :size="cubePx(11)" :glow="false" />
        <span class="con-parl__seat-name">{{ seat.name }}</span>
      </span>
      <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'lobby'}" data-parl-seat-place="lobby">
        <span class="con-parl__seat-key">{{ $t('Lobby') }}</span>
        <span class="con-parl__seat-obj">
          <span class="con-parl__socket con-parl__socket--seat" :class="{'con-parl__socket--empty': !seat.lobby}" :data-parl-seat-lobby="seat.color">
            <PlayerCube v-if="seat.lobby" :color="seat.color" :size="cubePx(RIBBON_CUBE)" :glow="false" />
          </span>
        </span>
      </span>
      <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'reserve', 'con-parl__seat-place--incoming': seat.incoming > 0}" data-parl-seat-place="reserve">
        <!-- A delegate is on its way HOME (the sitting's enactment beat): the
             reserve's key says so with a quiet arrow — a mark that lives on
             the key's own line (absolute, opacity only: nothing shifts). -->
        <!-- The «→ reserve» mark exists ONLY while a cube is on its way back (absolute, zero layout — a
             standing invisible glyph read as cut text to the fit probes). -->
        <span class="con-parl__seat-key">{{ $t('Reserve') }}<span v-if="seat.incoming > 0" class="con-parl__seat-incoming con-parl__seat-incoming--on" :data-parl-seat-incoming="seat.incoming" aria-hidden="true">←</span></span>
        <span class="con-parl__seat-obj">
          <!-- THE LANDING FRAME: a returning delegate's touchdown re-keys the stack, whose one-shot ring plays
               on mount and ends on its own animationend — the reserve place answers the arrival where the eye
               is (never a timer, never a caption: the row already names the seat). -->
          <span :key="'st' + seat.color + landFlashOf(seat.color)" class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': seat.reserveCubes === 0, 'con-parl__stack--landed': landFlashOf(seat.color) > 0}" :data-parl-seat-reserve="seat.color" :data-count="seat.reserveCubes" :data-parl-seat-landed="landFlashOf(seat.color) > 0 ? landFlashOf(seat.color) : undefined">
            <span v-for="n in Math.min(seat.reserveCubes, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
              <PlayerCube :color="seat.color" :size="cubePx(RIBBON_CUBE)" :glow="false" />
            </span>
          </span>
          <b :key="'sr' + seat.reserve" class="con-parl__seat-count con-parl__tick">×{{ seat.reserve }}</b>
        </span>
      </span>
    </div>
    <div class="con-parl__seat con-parl__seat--neutral" data-parl-neutral-pool>
      <span class="con-parl__seat-ident">
        <PlayerCube color="neutral" steel :size="cubePx(11)" :glow="false" />
        <span class="con-parl__seat-name">{{ $t('Neutral') }}</span>
      </span>
      <span class="con-parl__seat-place" data-parl-seat-place="neutral">
        <span class="con-parl__seat-key">{{ $t('Reserve') }}</span>
        <span class="con-parl__seat-obj">
          <span class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': neutralSupplyShown === 0}" data-parl-neutral-cube :data-count="neutralSupplyShown">
            <span v-for="n in Math.min(neutralSupplyShown, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
              <PlayerCube color="neutral" steel :size="cubePx(RIBBON_CUBE)" :glow="false" />
            </span>
          </span>
          <b :key="'n' + neutralSupplyShown" class="con-parl__seat-count con-parl__tick">×{{ neutralSupplyShown }}</b>
        </span>
      </span>
    </div>
    <!-- THE DECK — a PHYSICAL pile at the zone's end: the top back (the
         card.webp every console back wears), slim edges of the cards
         beneath (tiered by the count — one card shows no edge, an empty
         deck a ghost) and the count beside it. The results scene deals
         the fresh resolutions FROM this top card, so the pile and its
         count keep the pre-deal reading until each card has left. -->
    <div class="con-parl__seat con-parl__seat--deck" data-parl-deck>
      <span class="con-parl__seat-place">
        <span class="con-parl__seat-key">{{ $t('Resolution deck') }}</span>
        <span class="con-parl__seat-obj">
          <span class="con-parl__deck" :class="{'con-parl__deck--empty': deckShown === 0}" :data-count="deckShown" data-parl-deck-pile aria-hidden="true">
            <span v-if="deckLayers >= 2" class="con-parl__deck-layer con-parl__deck-layer--2"></span>
            <span v-if="deckLayers >= 1" class="con-parl__deck-layer con-parl__deck-layer--1"></span>
            <span class="con-parl__deck-top" data-parl-deck-top></span>
          </span>
          <b :key="'d' + deckShown" class="con-parl__seat-count con-parl__tick">×{{ deckShown }}</b>
        </span>
      </span>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {BenchSource, RIBBON_CUBE, seatSourceOf} from '@/client/console/parliament/parliamentVoteView';

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
  components: {PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    benchSource: {type: String as PropType<BenchSource>, required: true},
    benchWarn: {type: Boolean, default: false},
  },
  data() {
    return {
      RIBBON_CUBE,
      /** Per seat: how many returning delegates have LANDED on its reserve this mount (each landing re-keys the stack for its ring). */
      landFlash: {} as Record<string, number>,
    };
  },
  computed: {
    /** THE SEATS — every participating player's places, with the results scene's display holds applied. */
    seats(): Array<SeatRow> {
      const me = this.viewerColor;
      const holds = parliamentHolds;
      return this.view.players.filter((p) => p.participates).map((p) => {
        const pendingLobby = holds.lobby.has(p.color);
        const pendingReturns = holds.returns.get(p.color) ?? 0;
        const base = Math.max(0, p.reserve - pendingReturns + (pendingLobby ? 1 : 0));
        // The viewer's places keep PAINTING the delegate that is leaving until
        // its proxy stands over it (`sourceHold`), and keep SAYING its count
        // until it has visibly left (`sourceLeaving`).
        const mine = p.color === me;
        return {
          color: p.color, name: p.name,
          lobby: (p.lobby && !pendingLobby) || (mine && parliamentFlow.sourceHold === 'lobby'),
          reserve: base + (mine && parliamentFlow.sourceLeaving === 'reserve' ? 1 : 0),
          reserveCubes: base + (mine && parliamentFlow.sourceHold === 'reserve' ? 1 : 0),
          chairman: p.chairman,
          incoming: pendingReturns,
        };
      });
    },
    neutralSupplyShown(): number {
      return Math.max(0, this.view.neutralSupply - (parliamentHolds.returns.get('neutral') ?? 0));
    },
    /** The deck as SHOWN — the results scene keeps the dealt cards on the pile until each has visibly left it. */
    deckShown(): number {
      return this.view.deckSize + parliamentHolds.deckPending;
    },
    /** The pile's edges beneath the top back: none for one card, one for a few, two for a stack. */
    deckLayers(): number {
      const n = this.deckShown;
      return n <= 1 ? 0 : (n <= 3 ? 1 : 2);
    },
  },
  watch: {
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
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    landFlashOf(color: Color): number {
      return this.landFlash[color] ?? 0;
    },
    /** WHICH of the viewer's places the next delegate leaves — marked on the zone while the mode stands, never on another player's group. */
    seatSourceOf(seat: SeatRow): 'lobby' | 'reserve' | undefined {
      return seatSourceOf(seat.color, this.viewerColor, this.benchSource, this.benchWarn);
    },
  },
});
</script>
