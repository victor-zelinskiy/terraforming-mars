<template>
  <span class="journal-child-row" :class="'journal-child-row--' + vm.bucket">
    <!-- Tile placement: "Размещение → <tile> · [show on map]". -->
    <template v-if="vm.space !== undefined">
      <span class="journal-child-row__lead">
        <span class="journal-child-row__src" v-i18n>Placement</span>
        <span v-if="vm.player !== undefined"
              class="journal-player journal-child-row__player"
              :class="'player_translucent_bg_color_' + vm.player">
          <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
          <span class="journal-player__name">{{ playerName(vm.player) }}</span>
        </span>
      </span>
      <span class="journal-child-row__arrow" aria-hidden="true">→</span>
      <span class="journal-child-row__impacts">
        <!-- A tile laid ON A COLONY TILE (TR22): the row names the colony tile — the cell is not on the Mars board, so
             there is nothing to show on the map. -->
        <span v-if="vm.colonyTile !== undefined" class="journal-child-row__tile journal-em" data-journal-colony-tile>{{ colonyTileLabel(vm.tileLabel, vm.colonyTile) }}</span>
        <span v-else-if="vm.tileLabel" class="journal-child-row__tile journal-em" v-i18n>{{ vm.tileLabel }}</span>
        <button v-if="vm.colonyTile === undefined"
                type="button"
                class="journal-token journal-token--space"
                :aria-label="$t('Show on map')"
                @click.stop.prevent="showOnMap(vm.space)">
          <svg class="journal-token--space__pin" width="11" height="13" viewBox="0 0 11 13" aria-hidden="true">
            <path d="M5.5 0C2.46 0 0 2.4 0 5.36 0 9.1 5.5 13 5.5 13S11 9.1 11 5.36C11 2.4 8.54 0 5.5 0Zm0 7.3a1.96 1.96 0 1 1 0-3.92 1.96 1.96 0 0 1 0 3.92Z"/>
          </svg>
          <span v-i18n>Show on map</span>
        </button>
      </span>
    </template>

    <!-- An effect that could NOT apply: "<source> [Пропущено] <which> [struck
         magnitude] · <why>". Nothing moved, so the magnitude is drawn struck
         and muted — never a gain chip. -->
    <template v-else-if="vm.skipped !== undefined">
      <span class="journal-child-row__lead">
        <JournalCardChip v-if="vm.source.kind === 'card'" :name="vm.source.card" />
        <span v-else-if="vm.source.kind === 'label'" class="journal-child-row__src" v-i18n>{{ vm.source.label }}</span>
        <span class="journal-child-row__skipped-badge" v-i18n>Skipped</span>
        <span v-if="vm.player !== undefined"
              class="journal-player journal-child-row__player"
              :class="'player_translucent_bg_color_' + vm.player">
          <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
          <span class="journal-player__name">{{ playerName(vm.player) }}</span>
        </span>
      </span>
      <!-- No arrow: nothing flowed from the source — the row states what did NOT. -->
      <span class="journal-child-row__impacts">
        <span class="journal-child-row__skipped-label" v-i18n>{{ vm.skipped.label }}</span>
        <span v-if="vm.skipped.chip !== undefined"
              class="journal-child-row__chip journal-child-row__chip--skipped"
              :class="{'journal-child-row__chip--prod': vm.skipped.chip.production === true}">
          <span class="journal-child-row__chip-icon" :class="iconClass(vm.skipped.chip.icon)" aria-hidden="true"></span>
          <span class="journal-child-row__chip-amt">{{ vm.skipped.chip.text }}</span>
        </span>
        <span class="journal-child-row__skipped-reason" v-i18n>{{ vm.skipped.reason }}</span>
      </span>
    </template>

    <!-- Source → impact. -->
    <template v-else>
      <span class="journal-child-row__lead">
        <JournalCardChip v-if="vm.source.kind === 'card'" :name="vm.source.card" />
        <span v-else-if="vm.source.kind === 'label'" class="journal-child-row__src" v-i18n>{{ vm.source.label }}</span>

        <!-- DISCOUNT badge — a cost reduction reads as a "−N M€" chip, which a
             player could mistake for a charge. The explicit word makes it
             unambiguous that the source SAVED them money, not spent it. -->
        <span v-if="vm.bucket === 'discount'" class="journal-child-row__discount-badge" v-i18n>Discount</span>

        <!-- Recipient — only shown when it differs from the root actor. -->
        <span v-if="vm.player !== undefined"
              class="journal-player journal-child-row__player"
              :class="'player_translucent_bg_color_' + vm.player">
          <span class="journal-player__dot" :class="'player_bg_color_' + vm.player" aria-hidden="true"></span>
          <span class="journal-player__name">{{ playerName(vm.player) }}</span>
        </span>
      </span>

      <span v-if="hasResult" class="journal-child-row__arrow" aria-hidden="true">→</span>
      <span class="journal-child-row__impacts">
        <!-- Copied action: "copied <card>" flows in the result area (NOT the lead)
             so it wraps gracefully instead of squeezing the source column. -->
        <template v-if="vm.copiedCard !== undefined">
          <span class="journal-child-row__copied" v-i18n>copied</span>
          <JournalCardChip :name="vm.copiedCard" />
        </template>
        <span v-for="(chip, i) in vm.chips"
              :key="i"
              class="journal-child-row__chip"
              :class="chipClass(chip)">
          <span class="journal-child-row__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
          <span class="journal-child-row__chip-amt">{{ chip.text }}</span>
          <!-- VP has no sprite anywhere in the game's art (`optionIcons`): the chip speaks its unit instead — the same
               word the notification card speaks for the same chip (PL-041: a Capital's adjacency recount). -->
          <span v-if="chip.icon === 'vp'" class="journal-child-row__chip-unit" v-i18n>VP</span>
        </span>
        <!-- WHERE a political chip landed (Turmoil Redux): the resolution a delegate stands on,
             or the party whose Popular Support took the neutral delegates (with its area's fill). -->
        <!-- A payout a RULE counted (TR21): the card it landed on and its reason — «→ Векторные вычисления · за 3 соседних города». -->
        <template v-if="vm.basis !== undefined">
          <JournalCardChip v-if="vm.basis.onCard !== undefined" :name="vm.basis.onCard" />
          <span class="journal-child-row__tile journal-em" data-journal-basis>{{ basisLabel(vm.basis.count, vm.basis.unitKey) }}</span>
        </template>
        <span v-if="vm.political !== undefined && vm.political.kind === 'resolution'"
              class="journal-token journal-token--resolution" v-i18n>{{ resolutionLabel(vm.political.resolution) }}</span>
        <span v-else-if="vm.political !== undefined && vm.political.kind === 'agenda'"
              class="journal-child-row__tile journal-em">{{ agendaLabel(vm.political.from, vm.political.to, vm.political.level) }}</span>
        <span v-else-if="vm.political !== undefined && vm.political.kind === 'colonyTrack'"
              class="journal-child-row__tile journal-em">{{ colonyTrackLabel(vm.political.colony, vm.political.before, vm.political.after) }}</span>
        <span v-else-if="vm.political !== undefined && vm.political.kind === 'colonyRoster'"
              class="journal-child-row__tile journal-em" data-journal-colony-roster>{{ colonyRosterLabel(vm.political.change) }}</span>
        <span v-else-if="vm.political !== undefined"
              class="journal-child-row__tile journal-em">{{ supportLabel(vm.political.party, vm.political.total) }}</span>
      </span>
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {SpaceId} from '@/common/Types';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {JournalChildVM, JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {highlightBoardSpace} from '@/client/components/journal/boardCellHighlight';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {ColonyRosterChange, colonyRosterChangeText} from '@/common/colonies/ColonyRoster';
import {PARLIAMENT_MAX_POPULAR_SUPPORT} from '@/common/parliament/ParliamentTypes';

/**
 * Renders ONE grouped journal child as `source → impact · impact`: a card chip
 * or a semantic source label (Cell bonus / Trade income / Payment / …), an
 * optional recipient player chip (only when it differs from the root actor), and
 * the merged factual impact as resource/icon chips. A row is laid out as a
 * 3-column grid (lead · arrow · impacts) so the arrow + impact area sit at a
 * stable position down the feed. Tile placements render with a "show on map"
 * button. Chips are toned by kind — gain / loss / production / saved (discount).
 */
export default defineComponent({
  name: 'JournalChildRow',
  components: {JournalCardChip},
  props: {
    vm: {
      type: Object as PropType<JournalChildVM>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
  },
  computed: {
    // Whether the row has a result to point an arrow at (impacts OR a copied card).
    hasResult(): boolean {
      return this.vm.source.kind !== 'none' && (this.vm.chips.length > 0 || this.vm.copiedCard !== undefined);
    },
  },
  methods: {
    playerName(color: Color): string {
      return displayNameForColor(this.players, color);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      return {
        'journal-child-row__chip--prod': chip.production === true,
        'journal-child-row__chip--saved': chip.saved === true,
        'journal-child-row__chip--neg': chip.production !== true && chip.saved !== true && chip.text.startsWith('−'),
        'journal-child-row__chip--pos': chip.production !== true && chip.saved !== true && chip.text.startsWith('+'),
      };
    },
    showOnMap(space: SpaceId): void {
      highlightBoardSpace(space);
    },
    /** A Turmoil Redux resolution's printed name (the catalog's English key) — never a bare id. */
    resolutionLabel(id: string): string {
      return resolutionName(id);
    },
    /** «Карьера 1 → 3 · Влияние 2» — the position fact and the level the walk set (the chip beside it counts the steps). */
    agendaLabel(from: number, to: number, level: number): string {
      return `${translateTextWithParams('Agenda track ${0} → ${1}', [String(from), String(to)])} · ${translateText('Influence')} ${level}`;
    },
    /** «Трек колонии · Луна 3 → 7» — the tile's own 1-based readout (the chip beside it counts the steps). */
    colonyTrackLabel(colony: string, before: number, after: number): string {
      return `${translateText('Colony track')} · ${translateText(colony)} ${before + 1} → ${after + 1}`;
    },
    /** «Плитка колонии · − Церера · + Ио» — the roster's change by the tiles' own names (the leaving one first). */
    /** «город — на плитке колонии «Луна»» — a tile laid on a colony tile (the tile's own word, then where it lies). */
    colonyTileLabel(tile: string | undefined, colony: string): string {
      return translateTextWithParams('${0} — on the ${1} colony tile', [translateText(tile ?? 'city'), translateText(colony)]);
    },
    colonyRosterLabel(change: ColonyRosterChange): string {
      return `${translateText('Colony tile')} · ${colonyRosterChangeText(change, translateText)}`;
    },
    /** «за 3 соседних города» — the count the rule paid by; the unit's plural group agrees with it. */
    basisLabel(count: number, unitKey: string): string {
      return translateTextWithParams('for ${0} ${1}', [String(count), translateText(unitKey)]);
    },
    /** «Народная поддержка · Зелёные · 3/3» — the area named by its party, with what it holds out of its ceiling. */
    supportLabel(party: PartyName, total: number): string {
      return `${translateText('Popular support')} · ${translateText(partyNameKey(party))} · ${total}/${PARLIAMENT_MAX_POPULAR_SUPPORT}`;
    },
  },
});
</script>
