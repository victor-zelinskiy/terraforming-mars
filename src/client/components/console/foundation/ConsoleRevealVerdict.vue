<template>
  <div class="con-verdict" :class="reading.met ? 'con-verdict--met' : 'con-verdict--miss'"
       :data-reveal-destination="reading.fate.destination">
    <div class="con-verdict__head">
      <span class="con-verdict__badge" aria-hidden="true">{{ reading.met ? '✓' : '✕' }}</span>
      <span class="con-verdict__title">{{ $t(reading.met ? 'Condition met' : 'Condition not met') }}</span>
    </div>
    <!-- WHAT THE ACTION WAS LOOKING FOR, and what the card had. The ✓/✕ alone
         states the outcome without ever stating the RULE — «Условие не
         выполнено» is true of a card the player has never seen the check for.
         The glyph is the one the card face prints (a tag, or the any-party
         requirement plate); a party requirement NAMES the party it found. -->
    <div v-if="reading.check !== undefined" class="con-verdict__row" data-verdict-row="check">
      <span class="con-verdict__label">{{ $t('Checked') }}</span>
      <span class="con-verdict__value">
        <PremiumPartyRequirementGlyph v-if="reading.check.glyph.kind === 'party-requirement'" class="con-verdict__plate" />
        <i v-else-if="reading.check.glyph.kind === 'tag'" class="con-verdict__tagicon"
           :style="{backgroundImage: 'url(' + reading.check.glyph.url + ')'}"></i>
        <span>{{ $t(reading.check.label) }}</span>
        <span class="con-verdict__found" :class="'con-verdict__found--' + reading.check.found.tone">
          {{ $t(reading.check.found.key) }}
        </span>
      </span>
    </div>
    <!-- The REWARD — gained on a match (the kept card first, then the printed
         reward), explicitly NOT received on a miss. A missing row would read as
         «nothing was at stake», which is the one thing the player most wants to
         know here (invariant: no silent loss). The STOCK chip carries
         `data-reveal-reward-stock`: it is where the «OK» flight is born. -->
    <div class="con-verdict__row" data-verdict-row="reward">
      <span class="con-verdict__label">{{ $t('Reward') }}</span>
      <span class="con-verdict__value">
        <template v-if="reading.reward.length > 0">
          <span v-for="(chip, k) in reading.reward" :key="k" class="con-verdict__chip"
                :data-reveal-reward-stock="isStock(chip) ? chip.icon : undefined">
            <ActionEffectChip :effect="chip" />
          </span>
        </template>
        <span v-else class="con-verdict__none">{{ $t('Not received') }}</span>
      </span>
    </div>
    <div v-if="reading.vpGain > 0" class="con-verdict__row" data-verdict-row="vp">
      <span class="con-verdict__label">{{ $t('Victory points') }}</span>
      <span class="con-verdict__value"><span class="con-verdict__vp">+{{ reading.vpGain }} {{ $t('VP') }}</span></span>
    </div>
    <!-- WHERE THE CARD WENT — on both outcomes (the panel keeps one geometry):
         the hand (a kept reveal) or the discard pile. «OK» then makes this row
         physical: the card leaves its slot for exactly this place. The card is
         the one standing in the slot beside this panel, so the row names the
         PLACE only (its name rides the aria-label) — a name cut by an ellipsis
         would be the one word on the panel the player cannot read. -->
    <div class="con-verdict__row" data-verdict-row="fate">
      <span class="con-verdict__label">{{ $t('Card') }}</span>
      <span class="con-verdict__value con-verdict__fate"
            :class="'con-verdict__fate--' + reading.fate.destination"
            :aria-label="$t(reading.fate.card) + ' → ' + $t(reading.fate.key)">
        <span class="con-verdict__fate-arrow" aria-hidden="true">→</span>
        <span class="con-verdict__fate-place">{{ $t(reading.fate.key) }}</span>
      </span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {RevealVerdictReading, revealRewardStock, revealVerdictReading} from '@/client/console/revealReading';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DECK-CHECK VERDICT PANEL — one component, every place a reveal result is
 * read (Search For Life / Asteroid Deflection System / Political Think Tank).
 *
 * WHY A COMPONENT. The verdict had TWO renderings that told the player
 * different amounts about the same event: the embedded workspace stage
 * («Действия карт › <карта> › РЕЗУЛЬТАТ ВСКРЫТИЯ») showed a single pill — a
 * ✓/✕ and four words — while the legacy standalone modal showed the full
 * breakdown: what was checked, whether it was found, what the reward was (or
 * that it was NOT received) and the VP delta. The embedded flow is the product;
 * it cannot be the poorer of the two, and a shared class would still leave two
 * markup trees to drift apart (every past divergence in this family was a
 * markup divergence, not a style one — see ConsoleWsStageHead).
 *
 * So the panel exists ONCE and both hosts mount it: the composer's reveal stage
 * and the reveal overlay (the play's repeat, the Hydronetwork copy, the
 * standalone band). The host owns the surrounding geometry (a reserved-width
 * slot beside the revealed card); this owns the content and the hierarchy —
 * and what it says is decided by the PURE reading (`revealVerdictReading`,
 * spec'd), never here: this file only draws it.
 *
 * NAMES ITSELF NOTHING. There is no kicker and no heading of its own: inside a
 * workspace the stage is named by the breadcrumb, which is what keeps an
 * embedded surface from reading as a modal that arrived.
 */
export default defineComponent({
  name: 'ConsoleRevealVerdict',
  components: {ActionEffectChip, PremiumPartyRequirementGlyph},
  props: {
    reveal: {type: Object as PropType<RevealResultModel>, required: true},
  },
  computed: {
    reading(): RevealVerdictReading {
      return revealVerdictReading(this.reveal);
    },
    /** The stock reward this verdict pays into the rail (the «OK» flight's chip), if any. */
    stockIcon(): string | undefined {
      return revealRewardStock(this.reveal)?.resource;
    },
  },
  methods: {
    isStock(chip: ActionEffect): boolean {
      return this.stockIcon !== undefined && chip.icon === this.stockIcon && chip.note === undefined;
    },
  },
});
</script>
