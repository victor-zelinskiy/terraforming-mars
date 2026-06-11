<template>
  <!--
    Premium CARD-TARGET picker for an action / play step (e.g. "add 2 microbes to
    ANOTHER card", or Predators / Ants: remove a resource from any card). Candidates
    are GROUPED BY OWNER so the player can never confuse whose card they're about to
    touch — the viewer's OWN cards sit in a clearly-marked amber "Вы" group with a
    warning, opponents in their colour. Each candidate is an EXPLICIT selectable
    option: the card preview, a prominent `current → resulting` impact line (when the
    step adds/removes a fixed amount), a SELECT affordance, and a strong selected
    state. Fullscreen is a SEPARATE ⤢ control (so a tap selects, never zooms — the
    card's own click-zoom is suppressed). Single-select: picking EMITS `change`; the
    host owns the single final submit.
  -->
  <div class="action-target-card">
    <span v-if="promptText !== ''" class="action-target-card__prompt" v-i18n>{{ promptText }}</span>

    <div v-for="group in groups"
         :key="group.color"
         class="action-target-card__group"
         :class="{'action-target-card__group--self': group.self, 'action-target-card__group--flat': !showOwners}">
      <!-- The owner header (player dot + name + "your card" warning) is ONLY shown
           when the targets actually span DIFFERENT players. When the card can only
           ever target the viewer's OWN cards (a single owner), the per-player
           wrapper is pure noise — drop it (and reclaim the space). -->
      <div v-if="showOwners" class="action-target-card__owner">
        <span class="action-target-card__owner-dot" :class="'player_bg_color_' + group.color" aria-hidden="true"></span>
        <span class="action-target-card__owner-name">{{ group.name }}</span>
        <span v-if="group.self" class="action-target-card__owner-warn">
          <span aria-hidden="true">⚠</span><span v-i18n>your card</span>
        </span>
      </div>

      <div class="action-target-card__tiles">
        <div v-for="c in group.cards"
             :key="c.name"
             class="action-target-card__tile"
             :class="{
               'action-target-card__tile--selected': selectedName === c.name,
               'action-target-card__tile--disabled': c.disabled,
               'action-target-card__tile--self': group.self && showOwners,
             }"
             :data-test="'action-target-' + c.name">
          <!-- Clicking the CARD opens it FULLSCREEN (the fork's universal "click a
               card → fullscreen" convention — no separate ⤢ button). Selecting is a
               DEDICATED button below. `@click.capture.stop` suppresses Card.vue's
               OWN built-in zoom so there's exactly ONE viewer. -->
          <span class="action-target-card__thumb"
                role="button"
                :aria-label="$t('Open fullscreen')"
                tabindex="0"
                @click.capture.stop="openZoom(c)"
                @keydown.enter.prevent="openZoom(c)"
                @keydown.space.prevent="openZoom(c)">
            <Card :card="c.model" />
          </span>

          <!-- Impact line: the per-candidate `current → resulting` the choice
               produces (e.g. microbe 2 → 4). Falls back to the bare current count
               when the step has no fixed per-target delta. -->
          <span class="action-target-card__impact" v-if="c.resourceIcon !== ''">
            <span class="action-target-card__impact-icon" :class="c.resourceIcon" aria-hidden="true"></span>
            <template v-if="c.resulting !== undefined">
              <span class="action-target-card__impact-from">{{ c.count }}</span>
              <span class="action-target-card__impact-arrow" aria-hidden="true">→</span>
              <span class="action-target-card__impact-to">{{ c.resulting }}</span>
            </template>
            <span v-else class="action-target-card__impact-to">{{ c.count }}</span>
          </span>

          <!-- Selecting is the DEDICATED button (the card itself zooms). Disabled
               shows the reason instead. -->
          <span v-if="c.disabled" class="action-target-card__reason">{{ c.reason }}</span>
          <button v-else
                  type="button"
                  class="action-target-card__pick"
                  :class="{'action-target-card__pick--on': selectedName === c.name}"
                  :aria-pressed="selectedName === c.name"
                  @click="select(c)"
                  @keydown.enter.prevent="select(c)"
                  @keydown.space.prevent="select(c)">
            <span v-if="selectedName === c.name" class="action-target-card__pick-tick" aria-hidden="true">✓</span>
            <span v-i18n>{{ selectedName === c.name ? 'Selected' : 'Select' }}</span>
          </button>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoomModal"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {SelectCardResponse} from '@/common/inputs/InputResponse';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateMessage} from '@/client/directives/i18n';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type Tile = {
  name: CardName;
  model: CardModel;
  ownerColor: Color;
  ownerName: string;
  self: boolean;
  resourceIcon: string;
  count: number;
  /** The count AFTER the choice (current + the step's signed amount), or undefined
   *  when there's no fixed per-target delta to preview. */
  resulting: number | undefined;
  disabled: boolean;
  reason: string;
};

type Group = {
  color: Color;
  name: string;
  self: boolean;
  cards: Array<Tile>;
};

export default defineComponent({
  name: 'ActionTargetCard',
  components: {Card, CardZoomModal},
  props: {
    input: {
      type: Object as PropType<SelectCardModel>,
      required: true,
    },
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    // The currently-captured selection (for the highlight), owned by the parent.
    selectedName: {
      type: String as PropType<CardName | undefined>,
      default: undefined,
    },
    // Signed resource delta the choice applies to the chosen card (e.g. +2 for
    // "add 2 microbes"), driving the per-candidate `current → resulting` preview.
    amount: {
      type: Number as PropType<number | undefined>,
      default: undefined,
    },
  },
  emits: ['change'],
  data() {
    return {
      zoomCard: undefined as CardModel | undefined,
    };
  },
  mounted(): void {
    this.$nextTick(() => this.maybeAutoSelectSingle());
  },
  watch: {
    // When the candidate set collapses to a SINGLE selectable card (e.g. Titan
    // Shuttles with only one Jovian card), pre-select it. The no-autoselect
    // principle still SHOWS the target with its current count + impact line — it
    // just doesn't make the player click "ВЫБРАТЬ" when there's no real choice.
    selectableNames(): void {
      this.maybeAutoSelectSingle();
    },
  },
  computed: {
    // A stable signature of the selectable candidate names, so the watcher fires
    // when the candidate SET changes (e.g. the modal swaps to a new step's input)
    // — not on every unrelated re-render.
    selectableNames(): string {
      return this.input.cards.map((c) => c.name).join(',');
    },
    promptText(): string {
      const t = this.input.title;
      return typeof t === 'string' ? t : '';
    },
    // Only show the per-owner grouping when the targets span MORE THAN ONE player.
    // A single-owner pick (self-only — the common "add to your own card" case) is
    // rendered flat, without the redundant player-name wrapper.
    showOwners(): boolean {
      return this.groups.length > 1;
    },
    groups(): ReadonlyArray<Group> {
      const tiles: Array<Tile> = [
        ...this.input.cards.map((c) => this.buildTile(c, false)),
        ...(this.input.disabledCards ?? []).map((c) => this.buildTile(c, true)),
      ];
      const byColor = new Map<Color, Group>();
      for (const tile of tiles) {
        let g = byColor.get(tile.ownerColor);
        if (g === undefined) {
          g = {color: tile.ownerColor, name: tile.ownerName, self: tile.self, cards: []};
          byColor.set(tile.ownerColor, g);
        }
        g.cards.push(tile);
      }
      // Opponents first, the viewer's own cards last (clearly marked) so a
      // self-target is a deliberate, visible choice — never an accidental one.
      return [...byColor.values()].sort((a, b) => Number(a.self) - Number(b.self));
    },
  },
  methods: {
    buildTile(model: CardModel, disabled: boolean): Tile {
      const owner = this.findOwner(model);
      const ownerColor: Color = owner?.color ?? ('neutral' as Color);
      const self = this.playerView.thisPlayer?.color === ownerColor;
      const resourceType = getCard(model.name)?.resourceType;
      const resourceIcon = resourceType !== undefined ?
        iconClassFor(String(resourceType).toLowerCase().replace(/\s+/g, '-')) :
        '';
      const reason = disabled && model.disabledReason !== undefined ?
        (typeof model.disabledReason === 'string' ? translateText(model.disabledReason) : translateMessage(model.disabledReason)) :
        '';
      const count = model.resources ?? 0;
      const resulting = this.amount !== undefined ? Math.max(0, count + this.amount) : undefined;
      return {
        name: model.name,
        model,
        ownerColor,
        ownerName: owner?.name ?? translateText('Neutral'),
        self,
        resourceIcon,
        count,
        resulting,
        disabled,
        reason,
      };
    },
    findOwner(card: CardModel): {name: string, color: Color} | undefined {
      for (const player of this.playerView.players) {
        if (player.tableau.find((c) => c.name === card.name)) {
          return {name: player.name, color: player.color};
        }
      }
      // Not on anyone's tableau → it's the VIEWER's own card not in play yet: a
      // hand card or an SRR-hosted card. Attribute it to the viewer (so it reads
      // "<you>", not a misleading "Neutral" group).
      const me = this.playerView.thisPlayer;
      return me !== undefined ? {name: me.name, color: me.color} : undefined;
    },
    // Pre-select the lone candidate (when there's exactly ONE selectable card and
    // nothing chosen yet) so a single-target pick reads as "already chosen, here's
    // where it goes" rather than forcing a redundant click.
    maybeAutoSelectSingle(): void {
      if (this.selectedName !== undefined) {
        return;
      }
      const cards = this.input.cards;
      if (cards.length === 1) {
        const response: SelectCardResponse = {type: 'card', cards: [cards[0].name]};
        this.$emit('change', response);
      }
    },
    select(tile: Tile): void {
      if (tile.disabled) {
        return;
      }
      const response: SelectCardResponse = {type: 'card', cards: [tile.name]};
      this.$emit('change', response);
    },
    openZoom(tile: Tile): void {
      this.zoomCard = tile.model;
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>

<style scoped lang="less">
@atc-cyan: #6ab0e6;
@atc-mint: #58d6a6;
@atc-amber: #f2c14e;

.action-target-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.action-target-card__prompt {
  font-size: 12px;
  letter-spacing: 0.06em;
  color: rgba(200, 224, 240, 0.85);
}

.action-target-card__group {
  border-radius: 11px;
  border: 1px solid rgba(120, 200, 255, 0.16);
  background: rgba(14, 28, 42, 0.4);
  padding: 9px 11px 11px;
  &--self {
    border-color: rgba(255, 196, 120, 0.34);
    background: rgba(40, 30, 14, 0.32);
  }
  // Self-only / single-owner pick: no per-player wrapper — the tiles sit flat
  // (more room, no redundant owner chrome).
  &--flat {
    border: none;
    background: none;
    padding: 0;
  }
}
.action-target-card__owner {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 9px;
  font-size: 12px;
}
.action-target-card__owner-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}
.action-target-card__owner-name {
  font-weight: 600;
  color: #dcecf7;
  letter-spacing: 0.02em;
}
.action-target-card__owner-warn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #ffce92;
  background: rgba(255, 180, 110, 0.14);
  border: 1px solid rgba(255, 196, 120, 0.4);
}

.action-target-card__tiles {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 11px;
}

// Each candidate reads as a distinct SELECTABLE option card: a framed tile with
// the preview, the impact line, and a SELECT affordance. Calm at rest, a clear
// lift on hover, an unmistakable cyan halo + mint ribbon when chosen.
.action-target-card__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  width: 154px;
  padding: 9px 9px 8px;
  border-radius: 11px;
  border: 1px solid rgba(120, 200, 255, 0.22);
  background: linear-gradient(180deg, rgba(22, 44, 64, 0.5), rgba(16, 32, 48, 0.5));
  cursor: pointer;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.12s ease, background 0.16s ease;

  &:hover {
    border-color: rgba(120, 220, 255, 0.65);
    background: linear-gradient(180deg, rgba(28, 56, 80, 0.62), rgba(20, 40, 60, 0.62));
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
  }
  &:active { transform: translateY(0); }
  &:focus-visible { box-shadow: 0 0 0 2px fade(@atc-cyan, 70%); }

  &--selected {
    border-color: fade(@atc-cyan, 95%);
    background: linear-gradient(180deg, rgba(28, 64, 92, 0.72), rgba(20, 46, 68, 0.72));
    box-shadow: 0 0 0 1px fade(@atc-cyan, 60%), 0 0 20px fade(@atc-cyan, 30%);
  }
  &--self {
    border-color: rgba(255, 196, 120, 0.42);
    &.action-target-card__tile--selected {
      // Selected accent stays CYAN even for a self-target (one selected language);
      // the amber owner group already conveys "your card".
      border-color: fade(@atc-cyan, 95%);
    }
  }
  &--disabled {
    cursor: default;
    opacity: 0.5;
    filter: saturate(0.5);
    &:hover { border-color: rgba(120, 200, 255, 0.22); transform: none; box-shadow: none; background: linear-gradient(180deg, rgba(22, 44, 64, 0.5), rgba(16, 32, 48, 0.5)); }
  }
}

.action-target-card__thumb {
  // The card click opens fullscreen (form convention) — cue it with zoom-in.
  cursor: zoom-in;
  outline: none;
  border-radius: 8px;
  transition: filter 0.15s ease;
  &:hover { filter: brightness(1.06); }
  &:focus-visible { box-shadow: 0 0 0 2px fade(@atc-cyan, 70%); }
  // Compact the legacy card render to a thumbnail; zero the asymmetric margin
  // (see CLAUDE.md "Centering UI under a Card") so the tile reads centred.
  > :deep(.card-container) {
    margin: 0;
    zoom: 0.46;
  }
}

// The headline of each option: the resource impact, big + tabular so the player
// can compare candidates at a glance.
.action-target-card__impact {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(8, 20, 30, 0.6);
  border: 1px solid rgba(120, 200, 255, 0.22);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 13px;
  .action-target-card__tile--selected & {
    border-color: fade(@atc-cyan, 55%);
    background: rgba(18, 46, 66, 0.7);
  }
}
.action-target-card__impact-icon {
  width: 17px;
  height: 17px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.action-target-card__impact-from { color: rgba(206, 228, 244, 0.72); }
.action-target-card__impact-arrow { color: rgba(150, 200, 230, 0.6); font-weight: 400; }
.action-target-card__impact-to { color: @atc-mint; }

// SELECT affordance — calm steel chip at rest, a bright mint "ВЫБРАНО" + tick
// when chosen, so the selected option is unmistakable.
.action-target-card__pick {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 16px;
  border-radius: 999px;
  font-family: Prototype, Ubuntu, sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(190, 216, 236, 0.9);
  border: 1px solid rgba(120, 200, 255, 0.36);
  background: rgba(16, 34, 50, 0.6);
  cursor: pointer;
  outline: none;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.1s ease;
  &:hover {
    color: #eaf6ff;
    border-color: rgba(120, 220, 255, 0.6);
    transform: translateY(-1px);
  }
  &:focus-visible { box-shadow: 0 0 0 2px fade(@atc-cyan, 70%); }
  &--on {
    color: #06241a;
    background: linear-gradient(180deg, @atc-mint, #34b98a);
    border-color: transparent;
    box-shadow: 0 0 12px fade(@atc-mint, 45%);
  }
}
.action-target-card__pick-tick { font-size: 12px; line-height: 1; }

.action-target-card__reason {
  font-size: 10.5px;
  color: rgba(255, 184, 130, 0.9);
  text-align: center;
  line-height: 1.3;
}
</style>
