<template>
  <aside class="con-start__played con-splayed"
         :class="{'con-splayed--receiving': receivingKey !== undefined}"
         aria-hidden="true">
    <!--
      THE COMPACT PLAYED DESTINATION of the Game Start Workspace deployment —
      «РАЗЫГРАНО · <owner>» as a HORIZONTAL tabletop shelf along the bottom
      of the workspace, never the full tableau overview. Each start family is
      ONE physical stack standing on the shelf floor (bottom-aligned): capped
      peek strips + THE TOP SLOT.

      THE TOP SLOT (`__top`) is ONE PERSISTENT element per family and it IS
      the landing place:
       - idle with cards      → the top card lying OPEN;
       - idle empty           → a PREPARED CARD PLACE (card-shaped, quiet
                                inner ring) — the destination visibly exists
                                before anything flies;
       - receiving, pre-dock  → the same prepared place, marked
                                `[data-start-front]` (the hero measures it);
       - revealed             → the landed card occupies it AND STAYS: the
                                face node is keyed by the card name, so the
                                receiving → idle transition reuses the very
                                same node — the art can never blink through
                                the handoff.
      While receiving, the PREVIOUS top holds its open face on its future
      strip (overflowing downward) until the arriving card covers it back to
      a strip — the geometric Top Card Handoff of the receiving stage.

      The root keeps the legacy `.con-start__played` class ON PURPOSE: the
      resource-transfer framework and the played-hero reward sources resolve
      `.con-start__played [data-played-key]` — the dock is the same physical
      address the flights already know.

      NB the comment lives INSIDE the root: a top-level template comment makes
      the dev build a fragment and $el a comment node.
    -->
    <div class="con-splayed__head">
      <span class="con-splayed__title">{{ $t('Played') }}</span>
      <span class="con-splayed__owner">
        <span class="con-splayed__dot" :class="'player_bg_color_' + viewer.color" aria-hidden="true"></span>
        <span class="con-splayed__owner-name">{{ ownerName }}</span>
      </span>
    </div>
    <div class="con-splayed__families">
      <section v-for="fam in families" :key="fam.key"
               class="con-splayed__fam"
               :class="{
                 'con-splayed__fam--receiving': fam.receiving,
                 'con-splayed__fam--aside': receivingKey !== undefined && !fam.receiving,
               }"
               :data-splayed-fam="fam.key">
        <div class="con-splayed__cap">
          <span class="con-splayed__cap-label">{{ $t(fam.label) }}</span>
          <b v-if="fam.count > 0" class="con-splayed__cap-count" :key="'c' + fam.count">{{ fam.count }}</b>
        </div>
        <div class="con-splayed__stack" :style="{width: plan.slotW + 'px'}">
          <!-- Depth strips: everything under the top, oldest → newest — ONE
               list, keyed by card, the same list before and after a landing.
               While RECEIVING its last entry is the previous top waiting on
               its FUTURE strip, open face overflowing downward (the geometric
               handoff) until the arriving card is revealed, when it crops back
               to a strip; the transaction's end then changes nothing but that
               flag — the node persists (no remount, no art blink) and the stack
               keeps its height (the strip count is solved for the landed state
               from the first frame, so the finish never shrinks it by a strip
               under a card that has just come to rest). -->
          <div v-for="s in fam.strips" :key="s.name"
               class="con-splayed__strip"
               :class="{'con-splayed__strip--prev': s.prev, 'con-splayed__strip--spacer': s.spacer === true}"
               :data-played-key="s.spacer === true ? undefined : s.name" :data-zoom-slot="s.spacer === true ? undefined : s.name"
               :style="{height: plan.stripH + 'px'}">
            <!-- A SPACER paints nothing: the promoted card stands in the top slot, its strip keeps its room. -->
            <div v-if="s.spacer !== true" class="con-splayed__face" :class="{'con-deal-hold': awayCard === s.name}" :style="{zoom: String(plan.zoom)}">
              <!-- keep-art: the start shelf holds a HANDFUL of cards, so the
                   tableau's peek crop buys nothing here and costs the card's
                   own picture (see ConsolePlayedCardLite.keepArt). -->
              <ConsolePlayedCardLite :name="s.name" :peek="s.prev ? revealed : true" keep-art />
            </div>
          </div>
          <!-- THE TOP SLOT — one persistent element: the open top card, or
               the prepared card place a landing is measured against. -->
          <div class="con-splayed__top"
               :class="{'con-splayed__top--empty': fam.topFace === undefined, 'con-splayed__top--armed': fam.receiving && !revealed}"
               :data-start-front="fam.receiving && !revealed ? '' : undefined"
               :data-played-key="fam.topKey"
               :data-zoom-slot="fam.topKey"
               :style="{height: plan.cardH + 'px'}">
            <div v-if="fam.topFace !== undefined" class="con-splayed__face"
                 :class="{'con-deal-hold': awayCard === fam.topFace}"
                 data-splayed-topface
                 :key="fam.topFace" :style="{zoom: String(plan.zoom)}">
              <!-- The LIVE capsule (TR82): a HOLDER lying on top of its family — a corporation answering a Prelude's
                   tag (Proteus) — rises out of this slot and lays its tokens HERE, the count ticking on each touchdown. -->
              <ConsolePlayedCardLite :name="fam.topFace" keep-art :card="capsuleModelOf(fam.topFace)" />
            </div>
            <div v-else class="con-splayed__place" aria-hidden="true">
              <span class="con-splayed__place-ring"></span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </aside>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {restingRectOf} from '@/client/console/cardFlight/landingRect';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildPlayedZones, PlayedZones, PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL} from '@/client/components/console/consolePlayedModel';
import {PlayedCategoryKey, PLAYED_CATEGORY_LABEL} from '@/client/components/console/consolePlayedCategoryModel';
import {familyForCardType, zoneCards} from '@/client/console/played/receivingStageModel';
import {playedHeroState, providePlayedHeroTarget} from '@/client/console/played/consolePlayedHero';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';
import {CardModel} from '@/common/models/CardModel';
import {heldCardCapsule} from '@/client/console/resourceTransfer/consoleResourceTransfer';

/** Visible depth strips under the top card (history, never a column). */
const STRIP_CAP = 2;
/** The dock's one face zoom (× conUiScale) — strips and open cards share it,
 *  so a mode flip never resizes a single painted pixel. */
const DOCK_ZOOM = 0.42;

type StartPlayedFamily = {
  key: PlayedCategoryKey,
  label: string,
  /** Honest caption count (ticks to N+1 exactly at the dock). */
  count: number,
  /** Peek strips under the top (oldest → newest, capped) — `prev` marks the previous top waiting on its future strip,
   *  `spacer` the promoted card's own strip kept EMPTY while it stands in the top slot (the away-card loan). */
  strips: ReadonlyArray<{name: CardName, prev: boolean, spacer?: boolean}>,
  /** The previous top (only meaningful while receiving — it waits on its
   *  future strip while the top slot stands as the front anchor). */
  prevTop: CardName | undefined,
  /** The face lying OPEN in the top slot (undefined = the prepared place). */
  topFace: CardName | undefined,
  /**
   * The slot's IDENTITY, which is not always the face it is showing: while the
   * top card is out on loan to an embedded step's source seat, the card
   * UNDERNEATH is promoted into the slot and the away card keeps the key — so
   * the flight bringing it home still has a destination, and the promoted face
   * gives way to it on touchdown.
   */
  topKey: CardName | undefined,
  receiving: boolean,
};

/** The start families, in tableau order. Corporation and preludes ALWAYS
 *  stand (a destination exists before anything flies); the rest join only
 *  once they hold cards (a CEO start, a future variant). */
const CORE_FAMILIES: ReadonlyArray<PlayedCategoryKey> = ['corporation', 'prelude'];
const EXTRA_FAMILIES: ReadonlyArray<PlayedCategoryKey> = ['ceo', 'active', 'automated', 'events'];

export default defineComponent({
  name: 'ConsoleStartPlayedDock',
  components: {ConsolePlayedCardLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** A card whose face is AWAY from the shelf (it physically emerged into
     *  the embed step's source column) — its slot keeps geometry, the face
     *  hides REACTIVELY (an imperative class would be wiped by any patch). */
    awayCard: {type: String as PropType<CardName | undefined>, default: undefined},
  },
  data() {
    return {
      heroState: playedHeroState,
      unregisterTarget: undefined as (() => void) | undefined,
    };
  },
  computed: {
    viewer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    ownerName(): string {
      const me = this.playerView.players.find((p) => p.color === this.playerView.thisPlayer.color);
      return participantDisplayName({
        name: me?.name ?? this.viewer.name ?? '',
        isMarsBot: me?.isMarsBot === true,
      });
    },
    zones(): PlayedZones {
      return buildPlayedZones(this.viewer.tableau);
    },
    /** The card physically travelling to this dock right now (armed → closing:
     *  the destination prepares AT THE PRESS, so the flight always measures a
     *  standing front anchor). */
    incomingName(): CardName | undefined {
      const hero = this.heroState;
      if (!hero.active || hero.card === undefined || hero.phase === 'idle' || hero.phase === 'failed') {
        return undefined;
      }
      return hero.card;
    },
    revealed(): boolean {
      return this.incomingName !== undefined && this.heroState.revealed;
    },
    /** The RECEIVING family — from the card's manifest TYPE (the card is not
     *  in the tableau yet at arm; same resolution as the receiving stage). */
    receivingKey(): PlayedCategoryKey | undefined {
      const name = this.incomingName;
      if (name === undefined) {
        return undefined;
      }
      return familyForCardType(getCard(name)?.type);
    },
    plan(): {zoom: number, slotW: number, cardH: number, stripH: number} {
      const zoom = DOCK_ZOOM * conUiScale();
      return {
        zoom,
        slotW: Math.round(PLAYED_CARD_NATURAL_W * zoom),
        cardH: Math.round(PLAYED_CARD_NATURAL_H * zoom),
        stripH: Math.round(PLAYED_PEEK_NATURAL * zoom),
      };
    },
    families(): ReadonlyArray<StartPlayedFamily> {
      const incoming = this.incomingName;
      const receivingKey = this.receivingKey;
      const build = (key: PlayedCategoryKey): StartPlayedFamily => {
        // The incoming card is EXCLUDED from the lying set until its reveal —
        // the strips and the top never change identity mid-flight, and the
        // caption count ticks exactly at the dock (one visual owner).
        const lying = zoneCards(this.zones, key)
          .map((c) => c.name as CardName)
          .filter((n) => n !== incoming);
        const receiving = receivingKey === key;
        const top = lying.length > 0 ? lying[lying.length - 1] : undefined;
        let rest = lying.slice(0, Math.max(0, lying.length - 1));
        /*
         * THE TOP IS OUT ON LOAN. While an embedded step runs, the card that
         * opened it physically leaves this shelf for the step's source seat —
         * and if it happened to be the top of its family, the top slot was
         * rendered with `con-deal-hold` (opacity 0) and the family showed
         * nothing but the 31 px depth strip beneath it. That reads, correctly,
         * as a clipped card: the only thing painted WAS a crop.
         *
         * The pile shows what is actually on top of it — the card underneath,
         * at full size, promoted out of the strips. The away card keeps the
         * slot's IDENTITY (`topKey`) so its return flight still lands exactly
         * where it left, and the promoted face gives way to it on touchdown:
         * the same prev-top handoff the receiving state already performs.
         */
        const topAway = top !== undefined && top === this.awayCard && !receiving;
        const promoted = topAway ?
          (rest.length > 0 ? rest[rest.length - 1] : undefined) :
          undefined;
        if (topAway) {
          rest = rest.slice(0, Math.max(0, rest.length - 1));
        }
        // While receiving, the lying top moves onto its FUTURE strip and the
        // top slot becomes the front anchor (empty until the reveal fills it).
        const topFace = receiving ? (this.revealed ? incoming : undefined) :
          (topAway ? promoted : top);
        // THE STRIPS ARE SOLVED FOR THE LANDED STATE. While receiving, the previous top is the LAST strip (its future
        // place) and the older strips fill the cap under it — exactly the set the family shows once the landed card
        // is its top, so the finish changes a flag, never the stack's height (a third strip used to stand under the
        // arriving card and vanish in the patch after the proxy was gone — a one-frame jump at the very landing).
        // …and so are they while THE TOP IS OUT ON LOAN: the promoted card leaves its strip as a SPACER (its own
        // key, no face) — the stack keeps its height while the card is away and when it comes back (the return
        // flight lands on a slot that has not moved; the spacer then simply paints the promoted card's crop again).
        const strips = receiving && top !== undefined ?
          [...rest.slice(Math.max(0, rest.length - (STRIP_CAP - 1))).map((name) => ({name, prev: false})), {name: top, prev: true}] :
          topAway && promoted !== undefined ?
            [...rest.slice(Math.max(0, rest.length - (STRIP_CAP - 1))).map((name) => ({name, prev: false})), {name: promoted, prev: false, spacer: true}] :
            rest.slice(Math.max(0, rest.length - STRIP_CAP)).map((name) => ({name, prev: false}));
        return {
          key,
          label: PLAYED_CATEGORY_LABEL[key],
          count: lying.length + (receiving && this.revealed ? 1 : 0),
          strips,
          prevTop: top,
          topFace,
          // The slot's ANCHOR — the away card, so the flight that brings it
          // home has a destination even while another face occupies the slot.
          topKey: receiving ? topFace : (topAway ? top : topFace),
          receiving,
        };
      };
      const out = CORE_FAMILIES.map(build);
      for (const key of EXTRA_FAMILIES) {
        const fam = build(key);
        if (fam.count > 0 || fam.receiving) {
          out.push(fam);
        }
      }
      return out;
    },
  },
  mounted() {
    // The hero's landing target IS this dock's prepared top slot — the looped
    // aim before the flight, plus the synchronous rest read the flight's final
    // approach and the pre-reveal control measure take.
    this.unregisterTarget = providePlayedHeroTarget(() => this.measureFrontAnchor(), () => this.peekFrontAnchor());
  },
  beforeUnmount() {
    this.unregisterTarget?.();
  },
  methods: {
    /**
     * THE TOP FACE'S LIVE MODEL — only a HOLDER wears it (the seat's `seatCapsuleModel` phrase, TR81): its capsule is
     * the counter a card reaction's tokens land in (TR82 Proteus answering the second Prelude), the committed count
     * minus what is still in the air. Every other face keeps the name-only face its flights paint.
     */
    capsuleModelOf(name: CardName | undefined): CardModel | undefined {
      if (name === undefined || getCard(name)?.resourceType === undefined) {
        return undefined;
      }
      const model = this.viewer.tableau.find((c) => c.name === name);
      if (model === undefined) {
        return undefined;
      }
      const held = heldCardCapsule(name);
      return held === 0 ? model : {...model, resources: Math.max(0, (model.resources ?? 0) - held)};
    },
    /** The ARMED top slot's REST rect, synchronously; `undefined` when there is
     *  no armed slot or the shelf is parked (receded — see the loop below). */
    peekFrontAnchor(): HeroRect | undefined {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      const el = root.querySelector<HTMLElement>('[data-start-front]');
      if (el === null) {
        return undefined;
      }
      const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : undefined;
      if (cs !== undefined && (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05)) {
        return undefined;
      }
      const r = restingRectOf(el);
      return r.width > 4 && r.height > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
    },
    /** The front anchor's settled rect — stability-looped so the arc lands on
     *  final geometry only (the expansion has finished shaping the shelf). */
    async measureFrontAnchor(): Promise<HeroRect | undefined> {
      await this.$nextTick();
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      const el = root.querySelector<HTMLElement>('[data-start-front]');
      if (el === null) {
        return undefined;
      }
      let last: HeroRect | undefined = undefined;
      // ⚠️ NEVER SETTLE ON A RECEDED SHELF. While a step stands inside the
      // workspace this dock is parked (`descendRecede` — `scale(.985)` +
      // `autoAlpha: 0`), and a hidden element is still LAID OUT: the rect is
      // real, it is perfectly stable, and it is 1.5 % too small and offset by
      // the recede's own origin. The stability loop was written to wait out an
      // EXPANSION; on its own it cannot tell «settled» from «settled in the
      // parked pose», so it would hand the hero a landing that is not where
      // the card comes to rest.
      const parked = (): boolean => {
        const cs = typeof getComputedStyle === 'function' ? getComputedStyle(el) : undefined;
        // Deliberately the RECEDE's own end state (`autoAlpha: 0`), not a
        // generous threshold: the shelf has legitimate dim poses, and refusing
        // to measure in one of those would leave the hero with no target at
        // all — a worse failure than a slightly-off one.
        return cs !== undefined && (cs.visibility === 'hidden' || Number(cs.opacity) < 0.05);
      };
      for (let i = 0; i < 30; i++) {
        await new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
        const r = el.getBoundingClientRect();
        if (parked()) {
          last = undefined; // wait for the un-recede; never latch a parked box
          continue;
        }
        if (r.width > 4 && last !== undefined &&
            Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5 &&
            Math.abs(r.width - last.w) < 0.5 && Math.abs(r.height - last.h) < 0.5) {
          return last;
        }
        last = r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
      }
      return last;
    },
  },
});
</script>
