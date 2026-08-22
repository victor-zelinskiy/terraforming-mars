<template>
  <!--
    LITE CARD FACE — the honest lightweight twin of <Card> used by the
    console motion cinematics (deal flyers, exit/transfer proxies).

    "The same card in lite mode → the same card in full mode": it renders
    the REAL face — frame, cost, tags, title, the full render-data content
    (icons, effect rows, description text), requirements plate, VP badge,
    expansion mark — via the same presentational components <Card> uses,
    so the player RECOGNISES the card mid-flight; nothing reads as an
    empty placeholder that "becomes" the real card on landing.

    What makes it LITE is not missing information but missing COST:
     - zero interactivity: no click/hover/zoom handlers, no Teleported
       CardZoomModal, no tooltips, pointer-events: none (the flight layers
       are inert by construction);
     - no action-used cube, no hide/preference logic;
     - one flat manifest lookup instead of Card.vue's preference-aware
       computed web; render-once, never patched mid-flight (GSAP moves the
       composited layer, the DOM inside stays static).

    ⚠️ LITE IS A COST BUDGET, NEVER A DIFFERENT PICTURE. Whatever the host
    hands off TO must be what flies: pass `card` when the host has the live
    model and `lightweight` to match the destination's quality tier. Both were
    once omitted on the hand-open flight, and each omission changed the card's
    APPEARANCE, not its cost — no discount chip, no resource capsule (both
    need the live model), and a `normal`-tier title (engraved gold gradient,
    wide safe-area, one line) landing on a `thumb`-tier one (solid warm ink,
    the discount chip's safe-area, two lines). The whole grid flickered at the
    handoff.

    The `.card-container.filterDiv` + `.card-content-wrapper > .card-title`
    structure lights up the SAME sci-fi chassis frame, type-colour band and
    L-corner ticks (cards_scifi.less keys its `:has(...)` selectors off
    exactly this DOM shape). When card ART lands, `cardArtUrl` stays the
    ONE shared source for proxy and full face alike.
  -->
  <!-- PREMIUM face proxy (project + prelude) — the SAME renderer the landed
       card uses (name-only static mode, inert by construction), so the flying
       proxy and the real card can never disagree. Out-of-scope types keep the
       legacy lite face below. -->
  <!-- `card` is OPTIONAL and, when a host has the live model, it is what makes
       the face's own bottom-left resource capsule state the TRUTH instead of a
       printed 0. Without it every console surface drew a permanent «0» on every
       resource card and the real count had to be told a second time somewhere
       else — two counters on one card, in two different places. -->
  <PremiumCard v-if="premiumFace" :name="name" :card="card" :lightweight="lightweight" :artTier="artTier" :inert="true" aria-hidden="true" />

  <div v-else class="card-container filterDiv con-card-lite" :class="rootClass" :style="artStyle" aria-hidden="true">
    <span class="card-corner card-corner--tl"></span>
    <span class="card-corner card-corner--tr"></span>
    <span class="card-corner card-corner--bl"></span>
    <span class="card-corner card-corner--br"></span>
    <div class="card-content-wrapper" v-i18n>
      <div v-if="isProjectCard" class="card-cost-and-tags">
        <CardCost :amount="cost" />
        <CardTags :tags="tags" />
      </div>
      <CardTitle :title="name" :type="cardType" />
      <CardContent v-if="cardMetadata !== undefined"
                   :metadata="cardMetadata"
                   :isCorporation="isCorporationCard"
                   :bottomPadding="bottomPadding" />
    </div>
    <CardRequirementsComponent v-if="cardRequirements !== undefined && cardRequirements.length > 0" :requirements="cardRequirements" />
    <CardExpansion v-if="cardInstance !== undefined" :expansion="cardInstance.module" :isCorporation="isCorporationCard" :isResourceCard="isResourceCard" :compatibility="cardInstance.compatibility" />
    <CardVictoryPoints v-if="cardMetadata !== undefined && cardMetadata.victoryPoints" :victoryPoints="cardMetadata.victoryPoints" />
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {CardMetadata} from '@/common/cards/CardMetadata';
import {CardRequirementDescriptor} from '@/common/cards/CardRequirementDescriptor';
import {Tag} from '@/common/cards/Tag';
import {ClientCard} from '@/common/cards/ClientCard';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CardArtTier, cardArtUrl} from '@/client/cards/cardArt';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import CardCost from '@/client/components/card/CardCost.vue';
import CardTags from '@/client/components/card/CardTags.vue';
import CardTitle from '@/client/components/card/CardTitle.vue';
import CardContent from '@/client/components/card/CardContent.vue';
import CardRequirementsComponent from '@/client/components/card/CardRequirementsComponent.vue';
import CardExpansion from '@/client/components/card/CardExpansion.vue';
import CardVictoryPoints from '@/client/components/card/CardVictoryPoints.vue';

export default defineComponent({
  name: 'ConsoleCardFaceLite',
  components: {CardCost, CardTags, CardTitle, CardContent, CardRequirementsComponent, CardExpansion, CardVictoryPoints, PremiumCard},
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
    cardType(): CardType {
      return this.cardInstance?.type ?? CardType.AUTOMATED;
    },
    isProjectCard(): boolean {
      const t = this.cardType;
      return t === CardType.AUTOMATED || t === CardType.ACTIVE || t === CardType.EVENT;
    },
    isCorporationCard(): boolean {
      return this.cardType === CardType.CORPORATION;
    },
    isResourceCard(): boolean {
      return this.cardInstance?.resourceType !== undefined;
    },
    cost(): number | undefined {
      return this.isProjectCard ? this.cardInstance?.cost : undefined;
    },
    tags(): Array<Tag> {
      const tags = [...(this.cardInstance?.tags ?? [])];
      if (this.cardType === CardType.EVENT) {
        tags.push(Tag.EVENT);
      }
      return tags;
    },
    cardMetadata(): CardMetadata | undefined {
      return this.cardInstance?.metadata;
    },
    cardRequirements(): ReadonlyArray<CardRequirementDescriptor> | undefined {
      return this.cardInstance?.requirements;
    },
    bottomPadding(): string {
      if (this.cardMetadata?.victoryPoints !== undefined) {
        return 'long';
      }
      return '';
    },
    rootClass(): string {
      // The same per-card class the full card carries (future art hooks
      // key off it).
      return 'card-' + this.name.toLowerCase().replaceAll(' ', '-');
    },
    artStyle(): Record<string, string> {
      const url = cardArtUrl(this.name);
      // Same art, same crop as the full card will use; no art → the real
      // printed face above (never a blur-up placeholder).
      return url !== undefined ? {backgroundImage: `url(${url})`} : {};
    },
  },
});
</script>
