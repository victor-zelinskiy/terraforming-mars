<template>
  <!--
    LITE CARD FACE — the honest lightweight twin of <Card> used by the
    console motion cinematics (deal flyers, exit/transfer proxies).

    "The same card in lite mode → the same card in full mode": it renders
    the REAL premium face — frame, cost, tags, title, mechanics, VP badge,
    expansion mark — via the SAME renderer the landed card uses, so the
    player RECOGNISES the card mid-flight; nothing reads as an empty
    placeholder that "becomes" the real card on landing.

    What makes it LITE is not missing information but missing COST:
     - zero interactivity: no click/hover/zoom handlers, no Teleported
       CardZoomModal, no tooltips (the flight layers are inert by
       construction — `inert` on the premium face);
     - no action-used cube, no hide/preference logic;
     - render-once, never patched mid-flight (GSAP moves the composited
       layer, the DOM inside stays static).

    ⚠️ LITE IS A COST BUDGET, NEVER A DIFFERENT PICTURE. Whatever the host
    hands off TO must be what flies: pass `card` when the host has the live
    model and `lightweight` to match the destination's quality tier. Both were
    once omitted on the hand-open flight, and each omission changed the card's
    APPEARANCE, not its cost — no discount chip, no resource capsule (both
    need the live model), and a `normal`-tier title (engraved gold gradient,
    wide safe-area, one line) landing on a `thumb`-tier one (solid warm ink,
    the discount chip's safe-area, two lines). The whole grid flickered at the
    handoff.

    EVERY card type is a premium-face type since desktop-removal wave 4
    (project / prelude / corporation / standard project+action / CEO) — the
    legacy lite branch and its sub-component family are deleted. An unknown
    name renders nothing, same as CardFace.
  -->
  <!-- `card` is OPTIONAL and, when a host has the live model, it is what makes
       the face's own bottom-left resource capsule state the TRUTH instead of a
       printed 0. Without it every console surface drew a permanent «0» on every
       resource card and the real count had to be told a second time somewhere
       else — two counters on one card, in two different places. -->
  <PremiumCard v-if="premiumFace" :name="name" :card="card" :lightweight="lightweight" :artTier="artTier" :inert="true" aria-hidden="true" />
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardArtTier} from '@/client/cards/cardArt';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';

export default defineComponent({
  name: 'ConsoleCardFaceLite',
  components: {PremiumCard},
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
    /**
     * The LIVE card state, when the host has it.
     *
     * Omitted, the face is the pristine printed one — which is what the flight
     * proxies want. Supplied, the premium renderer fills its own service
     * anchors (today: the stored-resource capsule beside the expansion stamp)
     * from real data. It is deliberately not required: «lite» has always meant
     * «no interactivity, no cost», never «no truth».
     */
    card: {
      type: Object as () => CardModel | undefined,
      required: false,
      default: undefined,
    },
    /**
     * THE DESTINATION'S QUALITY TIER — set it whenever this face flies to (or
     * from) a surface that renders `<Card … lightweight>`, which is every
     * console GRID: the hand shelf, the draft, the deck pick, the start scene,
     * the reveal strip.
     *
     * `PremiumCard` maps it to `pcard--tier-thumb`, and that tier is NOT a
     * quieter version of the same picture — the title's engraved gold gradient
     * becomes solid warm ink and the plate drops its textures. Flying the
     * richer `normal` tier onto a `thumb` grid therefore swaps the card's
     * typography and colour at the handoff, which is the one thing a physical
     * transition may never do. A stationary hero (the composer's source card,
     * the action rail) legitimately stays `normal` — it hands off to nothing.
     */
    lightweight: {
      type: Boolean,
      required: false,
      default: false,
    },
    /**
     * THE DESTINATION'S ART TIER — same «copies are identical» contract as
     * `lightweight`, for the picture's SOURCE FILE. A proxy flying onto a
     * thumb-tier grid (the hand album) passes 'thumb' so the flight decodes
     * the same 512-px build the destination paints — flying 'full' there
     * spends the very decode the tier exists to avoid. Purely a source swap
     * (cardArt.ts): layout, fades and the failure chain are identical.
     */
    artTier: {
      type: String as () => CardArtTier,
      required: false,
      default: 'full',
    },
  },
  computed: {
    cardInstance(): ClientCard | undefined {
      return getCard(this.name);
    },
    premiumFace(): boolean {
      const instance = this.cardInstance;
      return instance !== undefined && isPremiumFaceType(instance.type);
    },
  },
});
</script>
