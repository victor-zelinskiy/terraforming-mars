<template>
  <div class="con-mandatory"
       :class="{'con-mandatory--sitting': invitation !== undefined}"
       role="status"
       :aria-label="kicker + ': ' + ask"
       data-test="con-mandatory-announce">
    <span class="con-mandatory__pulse" aria-hidden="true"></span>
    <!-- A decision with a CHARACTER (a reward, a loss) is announced with the prompt-modal family's emblem and tag —
         the same silhouette and words the modal will open with, so an attack on the player never reads as one more
         neutral «Открыть». A free choice keeps the plate's ⚑. -->
    <ConsolePromptEmblem v-if="tone !== 'neutral'" class="con-mandatory__emblem" :class="'con-mandatory__emblem--' + tone" :tone="tone" />
    <span v-else class="con-mandatory__glyph" aria-hidden="true">⚑</span>
    <div class="con-mandatory__body">
      <div class="con-mandatory__kicker">
        <span>{{ kicker }}</span>
        <span v-if="toneTagKey !== undefined" class="con-mandatory__tone" :class="'con-mandatory__tone--' + tone" data-prompt-tag>
          {{ tone === 'gain' ? '▲' : '▼' }} {{ $t(toneTagKey) }}
        </span>
      </div>
      <div class="con-mandatory__ask">{{ ask }}</div>
      <div v-if="invitation !== undefined"
           class="con-mandatory__facts"
           data-sitting-invitation
           :data-invitation-forecast="invitation.forecast ? 'true' : 'false'">
        <span class="con-mandatory__fact con-mandatory__fact--resolution"
              data-invitation-fact="resolution"
              :data-resolution="invitation.resolution"
              :data-source-resolution="sourceIsTheFact ? sourceResolution : undefined">
          <span class="con-mandatory__fact-kicker">{{ $t(invitation.resolutionKey) }}</span>
          <img class="con-mandatory__fact-emblem" :src="invitationEmblem" alt="" />
          <span class="con-mandatory__fact-name">{{ invitationResolutionName }}</span>
        </span>
        <span v-if="invitation.winner !== undefined"
              class="con-mandatory__fact con-mandatory__fact--winner"
              data-invitation-fact="winner"
              :data-winner="invitation.winner">
          <span class="con-mandatory__fact-kicker">{{ $t(invitation.forecast ? 'Leader' : 'Winner of the vote') }}</span>
          <PlayerDelegate v-if="invitation.winner !== 'neutral'" class="con-mandatory__fact-seat" :color="invitation.winner" :size="seatFigurePx" :glow="false" />
          <PlayerDelegate v-else class="con-mandatory__fact-seat" color="neutral" steel :size="seatFigurePx" :glow="false" />
          <span class="con-mandatory__fact-name">{{ invitationWinnerName }}</span>
          <span v-if="invitation.tieKey !== undefined" class="con-mandatory__fact-tie">{{ $t(invitation.tieKey) }}</span>
        </span>
      </div>
      <div v-if="resolutionSource !== undefined && !sourceIsTheFact"
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

<script setup lang="ts">
/*
 * MANDATORY PROMPT CARD — the ONE calm "you have a pending decision" surface
 * the console shows INSTEAD of popping the mandatory surface open. It serves
 * BOTH states of the decision (unified — no legacy amber chip): a fresh,
 * not-yet-opened decision (CTA «Открыть») and one the player opened then
 * deferred (CTA «Вернуться к решению»). It names the decision (kind + concrete
 * ask + who asks) and advertises the ONE affordance on A (free on the board
 * home). Inert like the other banner-band surfaces (the pad drives it; a couch
 * player can't hover/click) — the shell handles A in handleIntent. Driven by
 * the mandatory-announcement gate (consoleMandatoryGate.ts).
 *
 * WHO ASKS has two shapes: a card (its localized name) and — Turmoil Redux —
 * an ENACTED RESOLUTION (its party's emblem, the kind «Резолюция», its
 * localized name, and its printed code when card numbers are shown).
 *
 * THE SITTING'S INVITATION (P51 · FG, the owner 2026-11-03) carries TWO FACTS
 * under its ask «Заседание»: the resolution being enacted and the winner of
 * the vote (`sittingInvitation.ts` — the server's records, the glossary's
 * words), each in its own box, cut by an ellipsis there and nowhere else.
 * The plate holds no standing light: its attention is the material and the
 * word (invariant 15 — the mark is a kant, never a pulse or a halo).
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {getResolution, resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {cardNumberDisplayState} from '@/client/components/premiumCard/cardNumberDisplay';
import {$t, translateText} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import ConsolePromptEmblem from '@/client/components/console/foundation/ConsolePromptEmblem.vue';
import {PromptTone, promptToneTagKey} from '@/client/console/promptTone';
import {SittingInvitationFacts} from '@/client/console/parliament/sittingInvitation';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';

defineOptions({name: 'ConsoleMandatoryAnnounce'});
const props = defineProps({
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
  /** The announced decision's CHARACTER (`promptTone.ts`) — gain / loss / neutral. */
  tone: {type: String as PropType<PromptTone>, default: 'neutral'},
  /** The sitting's invitation: the resolution being enacted and the winner of the vote (absent on every other plate). */
  invitation: {type: Object as PropType<SittingInvitationFacts | undefined>, default: undefined},
  /** The winner's display name, resolved by the shell (the bot's seat by its localized name). */
  invitationWinnerName: {type: String as PropType<string | undefined>, default: undefined},
});

/** The winner's figure at the profile's scale (the band's own sizing — a fixed px read as a speck on 4K). */
const seatFigurePx = computed((): number => {
  return delegateFigurePx(16);
});
/** The asking law IS the resolution the facts already name — said once (the plate never repeats itself). */
const sourceIsTheFact = computed((): boolean => {
  return props.invitation !== undefined && props.invitation.resolution === props.sourceResolution;
});
const invitationEmblem = computed((): string | undefined => {
  return props.invitation === undefined ? undefined : partyEmblemUrl(props.invitation.party);
});
const invitationResolutionName = computed((): string => {
  return props.invitation === undefined ? '' : translateText(resolutionName(props.invitation.resolution));
});
const toneTagKey = computed((): string | undefined => {
  return promptToneTagKey(props.tone);
});
const resolutionSource = computed((): {id: string, name: string, emblem: string | undefined, code: string | undefined} | undefined => {
  const id = props.sourceResolution;
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
});
</script>
