<template>
  <div class="cm-deckbody cm-expdeck">
    <!-- WHAT THE DECKS WILL HOLD (T04) — the server's count for these settings, live on every toggle. Not a cursor target. -->
    <ConsoleDeckMeter variant="deck" class="cm-expdeck__meter" />
    <div class="cm-expansions">
      <button
        v-for="(row, i) in rows"
        :key="row.meta.id"
        type="button"
        class="cm-exp"
        :class="{
          'cm-exp--cursor': i === cursor,
          'cm-row--shake': i === shakeRow,
          'cm-exp--on': row.value,
          'cm-exp--conflict': row.conflictKey !== undefined,
        }"
        :data-exp="row.meta.id"
        @click="$emit('activate', i)"
        @mousemove="$emit('hover', i)"
      >
        <span class="cm-exp__icon" aria-hidden="true">
          <img :src="icon(row.meta.id)" alt="" draggable="false" />
        </span>
        <span class="cm-exp__main">
          <!-- The name and the switch on ONE line: the description and the deck chips get the plate's whole width. -->
          <span class="cm-exp__title">
            <span class="cm-exp__name">{{ $t(row.meta.labelKey) }}</span>
            <span class="cm-exp__state" :class="{'cm-exp__state--on': row.value}">
              {{ $t(row.value ? 'On' : 'Off') }}
            </span>
          </span>
          <span v-if="row.conflictKey !== undefined" class="cm-exp__issue">{{ $t(blockerText(row.conflictKey)) }}</span>
          <!-- What it adds — read on the wide creator (TR68), out of the Deck's one-line tile. -->
          <span v-else class="cm-exp__desc">{{ $t(row.meta.descKey) }}</span>
          <!-- …and what it adds to the DECKS, in numbers — the server's «with it − without it»; an OFF tile «would add». -->
          <!-- What it NEEDS closes the row — a quiet statement, red (with «!») only while the plate is on without it. -->
          <span v-if="chipsOf(row).length > 0 || row.requires.length > 0" class="cm-exp__chips" :data-exp-chips="row.meta.id">
            <span v-if="!row.value && chipsOf(row).length > 0" class="cm-exp__would">{{ $t('Would add:') }}</span>
            <span
              v-for="chip in chipsOf(row)"
              :key="chip.id"
              class="cm-exp__chip"
              :class="`cm-exp__chip--${chip.id}`"
              :data-exp-chip="chip.id"
              :data-exp-chip-amount="chip.amount"
            >{{ readChip(chip) }}</span>
            <span
              v-for="need in row.requires"
              :key="'needs-' + need.id"
              class="cm-exp__needs"
              :class="{'cm-exp__needs--unmet': row.value && !need.met}"
              :data-exp-needs="need.id"
              :data-exp-needs-met="need.met ? 'yes' : 'no'"
            ><span class="cm-exp__needs-mark" aria-hidden="true">{{ row.value && !need.met ? '!' : '•' }}</span>{{ readNeed(need) }}</span>
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * EXPANSIONS deck renderer (console create) — the in-scope modules as a 2-column grid of
 * big toggle plates (icon / name / ON-OFF state chip), under the DECK METER (T04): the
 * server's count of what the party's decks will hold. On the wide creator each plate also
 * says what it adds in one sentence and IN NUMBERS (the server's per-expansion
 * contribution; an OFF plate «would add»), and names an expansion it depends on — red only
 * while it is on without it. A MarsBot conflict shows the blocker reason inline. Pure
 * presentation; the 2D cursor math lives in the model (`deckNavStep` — the meter is not a
 * cursor target).
 */
import {defineComponent, PropType} from 'vue';
import {ExpansionRequirement, ExpansionRow} from '@/client/console/menu/consoleCreateModel';
import {automaBlockerText} from '@/client/components/create/premium/createGameState';
import {expansionIcon} from '@/client/components/create/premium/createGameMeta';
import {Expansion} from '@/common/cards/GameModule';
import ConsoleDeckMeter from '@/client/components/console/menu/ConsoleDeckMeter.vue';
import {deckCompositionState} from '@/client/console/menu/deckCompositionState';
import {ContributionChip, contributionChips} from '@/client/console/menu/deckCompositionModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleExpansionsDeck',
  components: {ConsoleDeckMeter},
  props: {
    rows: {type: Array as PropType<ReadonlyArray<ExpansionRow>>, required: true},
    cursor: {type: Number, required: true},
    shakeRow: {type: Number, default: -1},
  },
  emits: ['activate', 'hover'],
  methods: {
    icon(id: Expansion): string {
      return expansionIcon(id);
    },
    blockerText(key: string): string {
      return automaBlockerText(key);
    },
    chipsOf(row: ExpansionRow): ReadonlyArray<ContributionChip> {
      return contributionChips(deckCompositionState.composition, row.meta.id);
    },
    readChip(chip: ContributionChip): string {
      return translateTextWithParams(chip.key, [String(chip.amount)]);
    },
    readNeed(need: ExpansionRequirement): string {
      return translateTextWithParams('Requires ${0}', [translateText(need.labelKey)]);
    },
  },
});
</script>
