<template>
  <div v-if="bonusEntry !== undefined" class="card-zoom-card card-zoom-card--bonus">
    <BonusCardFace :id="bonusEntry.bonus" :ctx="bonusEntry.ctx" large />
  </div>

  <div v-else-if="corpEntry !== undefined" class="card-zoom-card card-zoom-card--premium">
    <!-- MarsBot CORPORATION entry — the ordinary premium corporation face
         (bot rules in the mechanics zone, the 'automa' medallion); identity,
         art and lore ride the original. Same stage wrapper as any .pcard. -->
    <MarsBotCorpFace :id="corpEntry.marsBotCorp" :resources="corpEntry.resources"
                     :resource="corpEntry.resource" large />
  </div>

  <div v-else-if="partyVm !== undefined" class="card-zoom-card card-zoom-card--premium card-zoom-card--party">
    <!-- A Turmoil Redux PARTY — its own subject in the viewer: the party's
         CHARTER (`PremiumPartyFace` — the faction card: banner · crest · name ·
         clauses · the law of access), the SAME face the action composer's hero
         wears, zoomed by the viewer exactly like a card face. The rules panel
         beside it is the shared one. -->
    <premium-card-face :vmOverride="partyVm" tier="full" :inert="true" />
  </div>

  <div v-else-if="parliamentVm !== undefined" class="card-zoom-card card-zoom-card--premium">
    <!-- A Turmoil Redux RESOLUTION — the parliament family's premium face,
         built from the parliament catalog (never a manifest card) and handed
         over as an externally-built view-model. -->
    <premium-card-face :vmOverride="parliamentVm" tier="full" :inert="true" />
  </div>

  <div v-else-if="tenderEntry !== undefined" class="card-zoom-card card-zoom-card--tender">
    <!-- A campaign TENDER — the Committee's certificate at its reader size (the full rule and the lore printed on the
         document itself, so the viewer lends it no archive gutter); its stamps as the opener saw them. -->
    <ConsoleTenderCard :id="tenderEntry.tender" size="reader" :state="tenderEntry.state" :owner="tenderEntry.owner" />
  </div>

  <div v-else-if="premiumFace"
       class="card-zoom-card card-zoom-card--premium"
       :class="{ 'card-zoom-card--selected': selected }">
    <!-- PREMIUM face — every real card type (tier `full`, inert: the modal
         owns interaction). `premium-card-face` is the LAZY binding of
         `asyncComponents` — a static import of the `.vue` here would close the PremiumCard ->
         CardZoomModal -> CardZoomCard type cycle and collapse vue-tsc
         inference to `{}`. -->
    <premium-card-face :card="premiumModel" tier="full" :inert="true" :selected="selected" />
  </div>
</template>

<script setup vapor lang="ts">
/*
 * The fullscreen card silhouette, extracted from CardZoomModal so it can be
 * reused for BOTH the visible (navigable) card AND the off-screen preload
 * neighbours without duplicating the markup or the per-card computeds.
 *
 * Renders nothing for an unknown card name (custom / unregistered cards).
 * Since desktop-removal wave 4 EVERY real card type renders the premium
 * face — the legacy silhouette branch is gone with legacy Card.vue.
 *
 * Automa BONUS card entry — the same stage, rendered as its own card face.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {ZoomCard, BonusZoomEntry, MarsBotCorpZoomEntry, PartyEffectZoomEntry, TenderZoomEntry, isBonusZoom, isMarsBotCorpZoom, isPartyEffectZoom, isResolutionZoom, isTenderZoom} from './cardZoomTypes';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {PremiumCardFace} from '@/client/components/asyncComponents';
import BonusCardFace from '@/client/components/marsbot/BonusCardFace.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import {isPremiumFaceType} from '@/client/components/premiumCard/premiumCardTheme';
import {getCard} from '@/client/cards/ClientCardManifest';
import {liveCardResources} from '@/client/components/card/liveCardResources';

defineOptions({name: 'CardZoomCard'});
const props = defineProps({
  card: {
    type: Object as () => ZoomCard,
    required: true,
  },
  /*
   * When true, the card gets the strong "selected" presentation — multi-ring
   * cyan halo on the frame, slow pulsing aura, and a "ВЫБРАНО" / "SELECTED"
   * ribbon above the card. Used by BUY-mode card selection.
   */
  selected: {
    type: Boolean,
    default: false,
  },
});

/** An Automa bonus entry, or undefined for a normal project card. */
const bonusEntry = computed((): BonusZoomEntry | undefined => {
  return isBonusZoom(props.card) ? props.card : undefined;
});
/** A MarsBot corporation entry, or undefined otherwise. */
const corpEntry = computed((): MarsBotCorpZoomEntry | undefined => {
  return isMarsBotCorpZoom(props.card) ? props.card : undefined;
});
/** A Turmoil Redux PARTY entry, or undefined otherwise. */
const partyEntry = computed((): PartyEffectZoomEntry | undefined => {
  return isPartyEffectZoom(props.card) ? props.card : undefined;
});
/** A campaign TENDER entry, or undefined otherwise. */
const tenderEntry = computed((): TenderZoomEntry | undefined => {
  return isTenderZoom(props.card) ? props.card : undefined;
});
/** A party entry as its CHARTER's view-model (the composer hero's own face), or undefined otherwise. */
const partyVm = computed((): PremiumCardVM | undefined => {
  const entry = partyEntry.value;
  return entry === undefined ? undefined : partyPremiumVm(entry.partyEffect);
});
/** A resolution entry as a premium view-model, or undefined otherwise. */
const parliamentVm = computed((): PremiumCardVM | undefined => {
  if (isResolutionZoom(props.card)) {
    return resolutionPremiumVmById(props.card.resolution);
  }
  return undefined;
});
/** The project card (only the premium branch of the template reads this). */
const cardModel = computed((): CardModel => {
  return props.card as CardModel;
});
// `cardInstance` returns undefined for unknown card names (e.g. custom cards
// not registered in the manifest) AND for a bonus entry (its `name` is a
// BonusCardId, absent from the project manifest) — so the premium branch
// never renders for a bonus or an unknown name.
const cardInstance = computed((): ClientCard | undefined => {
  return getCard(cardModel.value.name);
});
/** True when this card renders via the premium face (scope gate:
 *  isPremiumFaceType — every real card type since wave 4). */
const premiumFace = computed((): boolean => {
  const instance = cardInstance.value;
  return instance !== undefined && isPremiumFaceType(instance.type);
});
/** The model handed to the premium face, with the live-resource fallback baked in. */
const premiumModel = computed((): CardModel => {
  return {...cardModel.value, resources: resourceAmount.value};
});
const resourceAmount = computed((): number => {
  // For a played card shown by name only (e.g. journal fullscreen), fall
  // back to the global live count so the counter isn't a stale 0. A card
  // that carries its own value (incl. a real 0) keeps it.
  return cardModel.value.resources ?? liveCardResources(cardModel.value.name) ?? 0;
});
</script>
