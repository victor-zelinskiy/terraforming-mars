<template>
  <div class="eg-tab eg-players">
    <div class="eg-players__grid">
      <article v-for="p in model.players" :key="p.color" class="eg-pcard"
               :class="{'eg-pcard--winner': p.isWinner, 'eg-pcard--you': isViewer(p.color)}" :style="{'--eg-pc': hex(p.color)}">
        <header class="eg-pcard__head">
          <span class="eg-pcard__place">{{ p.place }}</span>
          <span class="eg-pcard__dot" :class="'player_bg_color_' + p.color"></span>
          <div class="eg-pcard__id">
            <div class="eg-pcard__name">{{ p.name }}<span v-if="isViewer(p.color)" class="eg-pcard__you" v-i18n>You</span></div>
            <div class="eg-pcard__corp" v-if="corp(p) !== ''" v-i18n>{{ corp(p) }}</div>
          </div>
          <div class="eg-pcard__total">{{ p.total }}<span class="eg-pcard__total-unit" v-i18n>VP</span></div>
        </header>

        <!-- category breakdown -->
        <div class="eg-pcard__cats">
          <div v-for="cat in model.categories" :key="cat.key" class="eg-pcard__cat">
            <span class="eg-pcard__cat-dot" :class="'vp-accent--' + cat.accent"></span>
            <span class="eg-pcard__cat-lbl" v-i18n>{{ cat.label }}</span>
            <span class="eg-pcard__cat-val">{{ cat.values[p.color] || 0 }}</span>
          </div>
        </div>

        <!-- resource snapshot -->
        <div v-if="raw(p.color) !== undefined" class="eg-pcard__res">
          <div v-for="r in resources(p.color)" :key="r.key" class="eg-pcard__resitem">
            <span class="resource_icon" :class="'resource_icon--' + r.key" :title="$t(r.label)"></span>
            <span class="eg-pcard__res-amt">{{ r.amount }}</span>
            <span class="eg-pcard__res-prod" :class="{'eg-pcard__res-prod--neg': r.prod < 0}">{{ r.prod >= 0 ? '+' + r.prod : r.prod }}</span>
          </div>
        </div>

        <!-- key stats -->
        <div v-if="raw(p.color) !== undefined" class="eg-pcard__stats">
          <div class="eg-pcard__stat"><span class="eg-pcard__stat-val">{{ raw(p.color)?.terraformRating }}</span><span class="eg-pcard__stat-lbl" v-i18n>TR</span></div>
          <div class="eg-pcard__stat"><span class="eg-pcard__stat-val">{{ raw(p.color)?.citiesCount }}</span><span class="eg-pcard__stat-lbl" v-i18n>Cities</span></div>
          <div v-if="showColonies" class="eg-pcard__stat"><span class="eg-pcard__stat-val">{{ raw(p.color)?.coloniesCount }}</span><span class="eg-pcard__stat-lbl" v-i18n>Colonies</span></div>
          <div class="eg-pcard__stat"><span class="eg-pcard__stat-val">{{ raw(p.color)?.actionsTakenThisGame }}</span><span class="eg-pcard__stat-lbl" v-i18n>Actions</span></div>
          <div class="eg-pcard__stat"><span class="eg-pcard__stat-val">{{ p.parametersTotal }}</span><span class="eg-pcard__stat-lbl" v-i18n>Steps</span></div>
        </div>

        <!-- milestones & awards -->
        <div v-if="p.breakdown.detailsMilestones.length > 0 || p.breakdown.detailsAwards.length > 0" class="eg-pcard__ma">
          <span v-for="d in p.breakdown.detailsMilestones" :key="'m' + d.message" class="vp-source-chip vp-source-chip--milestone">
            <span class="vp-source-chip__dot"></span><span class="vp-source-chip__label">{{ milestoneText(d) }}</span>
          </span>
          <span v-for="d in p.breakdown.detailsAwards" :key="'a' + d.message + (d.messageArgs ? d.messageArgs.join() : '')" class="vp-source-chip vp-source-chip--award">
            <span class="vp-source-chip__dot"></span><span class="vp-source-chip__label">{{ awardText(d) }}</span>
          </span>
        </div>
      </article>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {MADetail} from '@/common/game/VictoryPointsBreakdown';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {AwardName} from '@/common/ma/AwardName';
import {EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';
import {$t, translateTextWithParams, translateMessage} from '@/client/directives/i18n';

type ResRow = {key: string; label: string; amount: number; prod: number};

export default defineComponent({
  name: 'EndgamePlayersTab',
  props: {
    model: {type: Object as () => EndgameModel, required: true},
    view: {type: Object as () => ViewModel, required: true},
    viewerColor: {type: String as () => Color | undefined, required: false, default: undefined},
  },
  computed: {
    showColonies(): boolean {
      return this.view.game.gameOptions.expansions.colonies === true;
    },
  },
  methods: {
    hex(color: Color): string {
      return endgamePlayerHex(color);
    },
    isViewer(color: Color): boolean {
      return this.viewerColor === color;
    },
    corp(p: EndgamePlayerScore): string {
      return p.corporations.join(' / ');
    },
    raw(color: Color): PublicPlayerModel | undefined {
      return this.view.players.find((pl) => pl.color === color);
    },
    resources(color: Color): Array<ResRow> {
      const r = this.raw(color);
      if (r === undefined) {
        return [];
      }
      return [
        {key: 'megacredits', label: 'M€', amount: r.megacredits, prod: r.megacreditProduction},
        {key: 'steel', label: 'Steel', amount: r.steel, prod: r.steelProduction},
        {key: 'titanium', label: 'Titanium', amount: r.titanium, prod: r.titaniumProduction},
        {key: 'plants', label: 'Plants', amount: r.plants, prod: r.plantProduction},
        {key: 'energy', label: 'Energy', amount: r.energy, prod: r.energyProduction},
        {key: 'heat', label: 'Heat', amount: r.heat, prod: r.heatProduction},
      ];
    },
    milestoneText(d: MADetail): string {
      const args = (d.messageArgs || []).map($t);
      return translateTextWithParams(d.message, args);
    },
    awardText(d: MADetail): string {
      if (!d.messageArgs || d.messageArgs.length < 3) {
        return this.milestoneText(d);
      }
      const message: Message = {
        message: d.message,
        data: [
          {type: LogMessageDataType.STRING, value: d.messageArgs[0]},
          {type: LogMessageDataType.AWARD, value: d.messageArgs[1] as AwardName},
          {type: LogMessageDataType.PLAYER, value: d.messageArgs[2] as Color},
        ],
      };
      return translateMessage(message);
    },
  },
});
</script>
