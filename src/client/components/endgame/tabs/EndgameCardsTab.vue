<template>
  <div class="eg-tab eg-cards">
    <!-- Top scoring cards across the table — the podium strip -->
    <section v-if="topCards.length > 0" class="eg-cards__top">
      <h2 class="eg-section-title" v-i18n>Top scoring cards</h2>
      <div class="eg-cards__top-list">
        <div v-for="(item, i) in topCards" :key="i" class="eg-topcard"
             :class="{'eg-topcard--podium': i < 3}" :style="{'--eg-pc': hex(item.color)}">
          <span class="eg-topcard__rank">{{ i + 1 }}</span>
          <span class="eg-topcard__owner-dot" :class="'player_bg_color_' + item.color" :data-hint="item.owner"></span>
          <span class="eg-topcard__chip">
            <JournalCardChip v-if="isCard(item.cardName)" :name="asCardName(item.cardName)" />
            <span v-else class="vp-source-chip vp-source-chip--system"><span class="vp-source-chip__dot"></span><span class="vp-source-chip__label" v-i18n>{{ item.cardName }}</span></span>
          </span>
          <span class="eg-topcard__vp">+{{ item.victoryPoint }}</span>
        </div>
      </div>
    </section>

    <!--
      Per-player scoring cards. Each card is one compact PILL — kind dot,
      name, a dotted leader and the VP value all inside the same frame, so a
      value can never be visually attached to the wrong card. Pills flow into
      a responsive multi-column grid that uses the full panel width.
    -->
    <section class="eg-cards__players" :class="{'eg-cards__players--duel': model.mode === 'duel'}">
      <div v-for="p in model.players" :key="p.color" class="eg-cards__col"
           :class="{'eg-cards__col--winner': p.isWinner}" :style="{'--eg-pc': hex(p.color)}">
        <header class="eg-cards__col-head">
          <span class="eg-cards__dot" :class="'player_bg_color_' + p.color"></span>
          <span class="eg-cards__name">{{ p.name }}</span>
          <span class="eg-cards__count" :data-hint="$t('Top scoring cards')"><span aria-hidden="true">▤</span> {{ scoringCount(p) }}</span>
          <span class="eg-cards__sum">{{ p.breakdown.victoryPoints }}<span class="eg-cards__sum-unit" v-i18n>VP</span></span>
        </header>

        <div v-if="p.topCards.length === 0 && p.penaltyCards.length === 0" class="eg-cards__empty" v-i18n>No victory points from cards.</div>

        <div v-else class="eg-cards__rows">
          <div v-for="(c, i) in p.topCards" :key="'t' + i" class="eg-cardrow" :class="{'eg-cardrow--big': c.victoryPoint >= bigThreshold}">
            <span class="eg-cardrow__kind" :class="'vp-accent--' + kindAccent(c.kind)" :data-hint="$t(kindLabel(c.kind))"></span>
            <span class="eg-cardrow__main">
              <JournalCardChip v-if="isCard(c.cardName)" :name="asCardName(c.cardName)" />
              <span v-else class="vp-source-chip vp-source-chip--system"><span class="vp-source-chip__dot"></span><span class="vp-source-chip__label" v-i18n>{{ c.cardName }}</span></span>
            </span>
            <span class="eg-cardrow__leader" aria-hidden="true"></span>
            <span class="eg-cardrow__vp">+{{ c.victoryPoint }}</span>
          </div>
          <div v-for="(c, i) in p.penaltyCards" :key="'p' + i" class="eg-cardrow eg-cardrow--penalty">
            <span class="eg-cardrow__kind vp-accent--penalty"></span>
            <span class="eg-cardrow__main">
              <JournalCardChip v-if="isCard(c.cardName)" :name="asCardName(c.cardName)" />
              <span v-else class="vp-source-chip vp-source-chip--system"><span class="vp-source-chip__dot"></span><span class="vp-source-chip__label" v-i18n>{{ c.cardName }}</span></span>
            </span>
            <span class="eg-cardrow__leader" aria-hidden="true"></span>
            <span class="eg-cardrow__vp eg-cardrow__vp--neg">{{ c.victoryPoint }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardVictoryPointsKind} from '@/common/game/VictoryPointsBreakdown';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {getCard} from '@/client/cards/ClientCardManifest';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';

type TopItem = {color: Color; owner: string; cardName: string; victoryPoint: number};

const KIND_ACCENT: Record<CardVictoryPointsKind, string> = {
  resource: 'cards-resource',
  conditional: 'cards-conditional',
  fixed: 'cards-fixed',
  penalty: 'penalty',
};
const KIND_LABEL: Record<CardVictoryPointsKind, string> = {
  resource: 'Resource cards',
  conditional: 'Conditional cards',
  fixed: 'Fixed VP cards',
  penalty: 'Penalties',
};

// A contribution at/above this stands out visually in the per-player grids.
const BIG_CARD_VP = 5;

export default defineComponent({
  name: 'EndgameCardsTab',
  components: {JournalCardChip},
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    // Declared so the shell's shared props don't fall through (unused here).
    view: {type: Object, required: false, default: undefined},
    viewerColor: {type: String, required: false, default: undefined},
  },
  computed: {
    topCards(): Array<TopItem> {
      const all: Array<TopItem> = [];
      for (const p of this.model.players) {
        for (const c of p.topCards) {
          all.push({color: p.color, owner: p.name, cardName: c.cardName, victoryPoint: c.victoryPoint});
        }
      }
      all.sort((a, b) => b.victoryPoint - a.victoryPoint);
      return all.slice(0, 10);
    },
    bigThreshold(): number {
      return BIG_CARD_VP;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isCard(name: string): boolean {
      return getCard(name as CardName) !== undefined;
    },
    asCardName(name: string): CardName {
      return name as CardName;
    },
    kindAccent(kind: CardVictoryPointsKind): string {
      return KIND_ACCENT[kind];
    },
    kindLabel(kind: CardVictoryPointsKind): string {
      return KIND_LABEL[kind];
    },
    scoringCount(p: EndgamePlayerScore): number {
      return p.topCards.length + p.penaltyCards.length;
    },
  },
});
</script>
