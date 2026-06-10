<template>
  <!--
    Premium CARD-TARGET picker for an action step (e.g. Predators / Ants: remove a
    resource from any card, then add it to this one). Candidates are GROUPED BY
    OWNER so the player can never confuse whose card they're about to touch — the
    viewer's OWN cards sit in a clearly-marked, amber-accented "Вы" group with a
    warning, opponents in their colour. Each tile shows the targeted resource's
    current count on that card. Single-select: picking a card EMITS `change` with
    the response; the confirmation modal owns the single final submit.
  -->
  <div class="action-target-card">
    <span v-if="promptText !== ''" class="action-target-card__prompt" v-i18n>{{ promptText }}</span>

    <div v-for="group in groups"
         :key="group.color"
         class="action-target-card__group"
         :class="{'action-target-card__group--self': group.self}">
      <div class="action-target-card__owner">
        <span class="action-target-card__owner-dot" :class="'player_bg_color_' + group.color" aria-hidden="true"></span>
        <span class="action-target-card__owner-name">{{ group.name }}</span>
        <span v-if="group.self" class="action-target-card__owner-warn">
          <span aria-hidden="true">⚠</span><span v-i18n>your card</span>
        </span>
      </div>

      <div class="action-target-card__tiles">
        <button v-for="c in group.cards"
                :key="c.name"
                type="button"
                class="action-target-card__tile"
                :class="{
                  'action-target-card__tile--selected': selectedName === c.name,
                  'action-target-card__tile--disabled': c.disabled,
                  'action-target-card__tile--self': group.self,
                }"
                :disabled="c.disabled"
                :data-test="'action-target-' + c.name"
                @click="select(c)">
          <span class="action-target-card__thumb"><Card :card="c.model" /></span>
          <span class="action-target-card__meta">
            <span v-if="c.resourceIcon !== ''" class="action-target-card__count">
              <span class="action-target-card__count-icon" :class="c.resourceIcon" aria-hidden="true"></span>
              <span class="action-target-card__count-num">{{ c.count }}</span>
            </span>
            <span v-if="c.disabled && c.reason !== ''" class="action-target-card__reason">{{ c.reason }}</span>
            <span v-else-if="selectedName === c.name" class="action-target-card__tick" aria-hidden="true">✓</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
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

type Tile = {
  name: CardName;
  model: CardModel;
  ownerColor: Color;
  ownerName: string;
  self: boolean;
  resourceIcon: string;
  count: number;
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
  components: {Card},
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
  },
  emits: ['change'],
  computed: {
    promptText(): string {
      const t = this.input.title;
      return typeof t === 'string' ? t : '';
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
      return {
        name: model.name,
        model,
        ownerColor,
        ownerName: owner?.name ?? translateText('Neutral'),
        self,
        resourceIcon,
        count: model.resources ?? 0,
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
      return undefined;
    },
    select(tile: Tile): void {
      if (tile.disabled) {
        return;
      }
      const response: SelectCardResponse = {type: 'card', cards: [tile.name]};
      this.$emit('change', response);
    },
  },
});
</script>

<style scoped lang="less">
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
  border-radius: 10px;
  border: 1px solid rgba(120, 200, 255, 0.16);
  background: rgba(14, 28, 42, 0.4);
  padding: 8px 10px 10px;
  &--self {
    border-color: rgba(255, 196, 120, 0.4);
    background: rgba(40, 30, 14, 0.4);
  }
}
.action-target-card__owner {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
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
  gap: 10px;
}
.action-target-card__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 6px 4px;
  border-radius: 9px;
  border: 1px solid rgba(120, 200, 255, 0.2);
  background: rgba(20, 40, 60, 0.45);
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
  &:hover { border-color: rgba(120, 220, 255, 0.6); transform: translateY(-1px); }
  &--selected {
    border-color: rgba(120, 230, 255, 0.95);
    box-shadow: 0 0 0 1px rgba(120, 230, 255, 0.55), 0 0 16px rgba(80, 200, 255, 0.22);
  }
  &--self {
    border-color: rgba(255, 196, 120, 0.45);
    &.action-target-card__tile--selected {
      box-shadow: 0 0 0 1px rgba(255, 200, 120, 0.7), 0 0 16px rgba(255, 180, 110, 0.25);
    }
  }
  &--disabled {
    cursor: default;
    opacity: 0.42;
    filter: saturate(0.5);
    &:hover { border-color: rgba(120, 200, 255, 0.2); transform: none; }
  }
}
.action-target-card__thumb {
  // Compact the legacy card render to a thumbnail; zero the asymmetric margin
  // (see CLAUDE.md "Centering UI under a Card") so the tile reads centred.
  > :deep(.card-container) {
    margin: 0;
    zoom: 0.5;
  }
}
.action-target-card__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
}
.action-target-card__count {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(20, 54, 44, 0.6);
  border: 1px solid rgba(110, 235, 180, 0.4);
}
.action-target-card__count-icon {
  width: 16px;
  height: 16px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}
.action-target-card__count-num {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #8ff0c4;
}
.action-target-card__reason {
  font-size: 10.5px;
  color: rgba(255, 184, 130, 0.9);
  text-align: center;
}
.action-target-card__tick {
  color: #78e6ff;
  font-weight: 700;
}
</style>
