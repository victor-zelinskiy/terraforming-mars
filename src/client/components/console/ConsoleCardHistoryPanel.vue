<template>
  <div class="con-cardhist">
    <ConsoleScrollArea class="con-cardhist__scroll" axis="y">
      <div class="con-cardhist__body">
        <!-- No history at all — a calm, complete message (never dead zeros). -->
        <div v-if="!history.card.hasAny && history.action.empty" class="con-cardhist__empty">
          <span class="con-cardhist__empty-mark" aria-hidden="true">◇</span>
          <span>{{ $t('This card has no history in the current game yet.') }}</span>
        </div>

        <template v-else>
          <!-- ── A. CARD HISTORY (facts about the card as an object) ────── -->
          <section class="con-cardhist__group con-cardhist__group--card">
            <span class="con-cardhist__kind">{{ $t('Card history') }}</span>
            <div v-if="history.card.stored !== undefined" class="con-cardhist__row">
              <span class="con-cardhist__row-label">
                <i class="con-cardhist__icon" :class="resIconClass(history.card.stored.icon)" aria-hidden="true"></i>
                <span>{{ $t('Resources on this card') }}</span>
              </span>
              <b class="con-cardhist__row-value">{{ history.card.stored.count }}</b>
            </div>
            <div v-if="history.card.activations > 0" class="con-cardhist__row">
              <span class="con-cardhist__row-label">{{ $t('Activations') }}</span>
              <b class="con-cardhist__row-value">{{ history.card.activations }}</b>
            </div>
            <div v-if="history.card.lastGeneration !== undefined" class="con-cardhist__row">
              <span class="con-cardhist__row-label">{{ $t('Last used') }}</span>
              <b class="con-cardhist__row-value">{{ $t('GEN.') }} {{ history.card.lastGeneration }}</b>
            </div>
            <div v-if="cardOnlyStored" class="con-cardhist__note">
              {{ $t('This card\'s action has not fired this game.') }}
            </div>
          </section>

          <!-- ── B. SELECTED-ACTION HISTORY (the focused option's footprint) ─ -->
          <section class="con-cardhist__group con-cardhist__group--action">
            <span class="con-cardhist__kind">
              {{ $t('Selected action') }}
              <span v-if="history.option !== undefined" class="con-cardhist__variant">
                {{ $t('Option') }} {{ history.option.index + 1 }} / {{ history.option.total }}
              </span>
            </span>

            <template v-if="!history.action.empty">
              <div v-for="(line, i) in history.action.lines" :key="i" class="con-cardhist__row">
                <span class="con-cardhist__row-label">
                  <i v-if="line.icon" class="con-cardhist__icon" :class="resIconClass(line.icon)" aria-hidden="true"></i>
                  <span>{{ $t(line.label) }}</span>
                </span>
                <b class="con-cardhist__row-value">{{ line.value }}</b>
              </div>
              <!-- A multi-branch action can't split activations per branch —
                   the count is card-level (honest, never faked). -->
              <div v-if="history.action.cardScoped === true" class="con-cardhist__note">
                {{ $t('Activations are counted for the whole card.') }}
              </div>
            </template>
            <div v-else class="con-cardhist__note con-cardhist__note--empty">
              {{ $t('This action has not fired this game.') }}
            </div>
          </section>
        </template>
      </div>
    </ConsoleScrollArea>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE fullscreen-card HISTORY PANEL — the ИСТОРИЯ tab of the inspect
 * dossier (the console Action Browser's X-inspect). Read-only presentation of
 * the pre-built {@link ActionInspectHistory} snapshot, split into the two
 * semantic blocks the brief asks for:
 *
 *   A. CARD HISTORY — facts about the card as an OBJECT (its stored resource,
 *      how many times its action fired this game — a CARD total, the
 *      generation it last fired). The aggregate can attribute these honestly
 *      at the card level, never at one branch.
 *
 *   B. SELECTED-ACTION HISTORY — the focused option's own result footprint
 *      (per-branch-filtered impact lines). For a multi-branch card the
 *      activation count stays in block A (card-level) with a caption here.
 *
 * The numbers come straight from the snapshot (built by
 * `buildActionInspectHistory`, the ONE source of truth) — this component only
 * lays them out in the premium console language, hides inapplicable lines, and
 * shows a calm empty state instead of dead zeros. Icons resolve through the
 * same `iconClassFor` the rest of the console uses.
 */
import {defineComponent, PropType} from 'vue';
import {ActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

export default defineComponent({
  name: 'ConsoleCardHistoryPanel',
  components: {ConsoleScrollArea},
  props: {
    history: {type: Object as PropType<ActionInspectHistory>, required: true},
  },
  computed: {
    /** The card holds a resource / metadata but its action never fired — the
     *  card block shows a note instead of a bare "0 activations". */
    cardOnlyStored(): boolean {
      return this.history.card.stored !== undefined && this.history.card.activations === 0;
    },
  },
  methods: {
    /** Normalize a raw icon key (Resource / CardResource / 'tr' / 'cards' /
     *  global parameter) to its sprite class — mirrors the Action Browser. */
    resIconClass(icon: string): string {
      return iconClassFor(icon.toLowerCase().replace(/\s+/g, '-'));
    },
  },
});
</script>
