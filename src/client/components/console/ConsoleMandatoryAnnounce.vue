<template>
  <!--
    MANDATORY PROMPT CARD — the ONE calm "you have a pending decision" surface
    the console shows INSTEAD of popping the mandatory surface open. It serves
    BOTH states of the decision (unified — no legacy amber chip): a fresh,
    not-yet-opened decision (CTA «Открыть») and one the player opened then
    deferred (CTA «Вернуться к решению»). It names the decision (kind + concrete
    ask + who asks) and advertises the ONE affordance on A (free on the board
    home). Inert like the other banner-band surfaces (the pad drives it; a couch
    player can't hover/click) — the shell handles A in handleIntent. Driven by
    the mandatory-announcement gate (consoleMandatoryGate.ts).

    WHO ASKS has two shapes: a card (its localized name) and — Turmoil Redux —
    an ENACTED RESOLUTION (its party's emblem, the kind «Резолюция», its
    localized name, and its printed code when card numbers are shown).
  -->
  <div class="con-mandatory"
       role="status"
       :aria-label="kicker + ': ' + ask"
       data-test="con-mandatory-announce">
    <span class="con-mandatory__pulse" aria-hidden="true"></span>
    <span class="con-mandatory__glyph" aria-hidden="true">⚑</span>
    <div class="con-mandatory__body">
      <div class="con-mandatory__kicker">{{ kicker }}</div>
      <div class="con-mandatory__ask">{{ ask }}</div>
      <div v-if="resolutionSource !== undefined"
           class="con-mandatory__src con-mandatory__src--resolution"
           :data-source-resolution="resolutionSource.id">
        <img v-if="resolutionSource.emblem !== undefined" class="con-mandatory__src-emblem" :src="resolutionSource.emblem" alt="" />
        <span class="con-mandatory__src-kind">{{ $t('Resolution') }}</span>
        <span class="con-mandatory__src-name">{{ resolutionSource.name }}</span>
        <span v-if="resolutionSource.code !== undefined" class="con-mandatory__src-code">{{ resolutionSource.code }}</span>
      </div>
      <div v-else-if="sourceCard !== undefined" class="con-mandatory__src">{{ $t(sourceCard) }}</div>
    </div>
    <span class="con-mandatory__open">
      <GamepadGlyph control="confirm" />
      <span v-i18n>{{ openLabel }}</span>
    </span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {getResolution, resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {cardNumberDisplayState} from '@/client/components/premiumCard/cardNumberDisplay';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleMandatoryAnnounce',
  components: {GamepadGlyph},
  props: {
    /** The decision TYPE, pre-translated by the shell (consoleTaskSummary). */
    kicker: {type: String, required: true},
    /** The concrete ask, pre-translated by the shell. */
    ask: {type: String, required: true},
    /** WHO asks — a source card name (localised here), when the server named one. */
    sourceCard: {type: String as PropType<CardName>, default: undefined},
    /** WHO asks — an enacted RESOLUTION's catalog id (Turmoil Redux); outranks `sourceCard`. */
    sourceResolution: {type: String as PropType<string | undefined>, default: undefined},
    /** The A-verb i18n key — 'Open' (held) or the return key (deferred). */
    openLabel: {type: String, default: 'Open'},
  },
  computed: {
    resolutionSource(): {id: string, name: string, emblem: string | undefined, code: string | undefined} | undefined {
      const id = this.sourceResolution;
      if (id === undefined) {
        return undefined;
      }
      const resolution = getResolution(id);
      return {
        id,
        name: translateText(resolutionName(id)),
        emblem: resolution === undefined ? undefined : partyEmblemUrl(resolution.party),
        // The printed code follows the one «Номера карт» preference.
        code: cardNumberDisplayState.enabled ? resolution?.code : undefined,
      };
    },
  },
});
</script>
