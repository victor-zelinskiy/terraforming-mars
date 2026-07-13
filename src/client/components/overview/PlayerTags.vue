<template>
    <div class="player-tags">
        <div v-if="section === 'main' || section === 'both'" class="player-tags-main">
            <PrivateScoreMask v-if="privateMaskVp" compact />
            <tag-count v-else tag="vp" :count="hideVpCount ? '?' : player.victoryPointsBreakdown.total" :size="'big'" :type="'main'" :scopeKey="player.color" :epoch="epoch" />
            <div v-if="isEscapeVelocityOn" :class="tooltipCss" :data-tooltip="$t('Escape Velocity penalty')">
              <tag-count tag="escape" :count="escapeVelocityPenalty" :size="'big'" :type="'main'" :showWhenZero="true"/>
            </div>
            <tag-count tag="tr" :count="effectivePlayer.terraformRating" :size="'big'" :type="'main'" :scopeKey="player.color" :epoch="epoch"/>
            <tag-count v-if="player.handicap !== undefined" :tag="'handicap'" :count="player.handicap" :size="'big'" :type="'main'" :showWhenZero="true"/>
            <div class="tag-and-discount">
              <PlayerTagDiscount v-if="all.discount" :amount="all.discount" :color="player.color"  :data-test="'discount-all'"/>
              <tag-count tag="cards" :count="cardsInHandCount" :size="'big'" :type="'main'" :scopeKey="player.color" :epoch="epoch"/>
            </div>
        </div>
        <div v-if="section !== 'main'" class="player-tags-secondary">
          <div class="tag-count-container" v-for="tagDetail of tags" :key="tagDetail.name">
            <template v-if="tagDetail.name === SpecialTags.UNDERGROUND_TOKEN_COUNT">
              <div class="tag-and-discount">
              <tag-count :tag="tagDetail.name" :undergroundToken="player.underworldData.activeBonus" :count="tagDetail.count" :size="'big'" :type="'secondary'" :scopeKey="player.color" :epoch="epoch"/>
              </div>
            </template>
            <div v-else-if="tagDetail.name === 'separator'" class="tag-separator"></div>
            <template v-else-if="tagDetail.name === 'all'"></template>
            <div v-else class="tag-and-discount">
              <PlayerTagDiscount v-if="tagDetail.discount > 0" :color="player.color" :amount="tagDetail.discount" :data-test="'discount-' + tagDetail.name"/>
              <PointsPerTag :points="tagDetail"/>
              <tag-count :tag="tagDetail.name" :count="tagDetail.count" :size="'big'" :type="'secondary'" :scopeKey="player.color" :epoch="epoch"/>
            </div>
          </div>
        </div>
    </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import TagCount from '@/client/components/TagCount.vue';
import PrivateScoreMask from '@/client/components/overview/PrivateScoreMask.vue';
import {shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';
import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {GameModel} from '@/common/models/GameModel';
import {Tag} from '@/common/cards/Tag';
import {SpecialTags} from '@/client/cards/SpecialTags';
import PlayerTagDiscount from '@/client/components/overview/PlayerTagDiscount.vue';
import PointsPerTag from '@/client/components/overview/PointsPerTag.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {vueRoot} from '@/client/components/vueRoot';
import {CardName} from '@/common/cards/CardName';
import {startSetupOverrideFor} from '@/client/components/startGameFlow/startSetupRevealState';

type InterfaceTagsType = Tag | SpecialTags | 'separator' | 'all';
type TagDetail = {
  name: InterfaceTagsType;
  discount: number;
  points: number;
  halfPoints: number;
  count: number;
  asterisk: boolean;
};

const ORDER: Array<InterfaceTagsType> = [
  Tag.BUILDING,
  Tag.SPACE,
  Tag.SCIENCE,
  Tag.POWER,
  Tag.EARTH,
  Tag.JOVIAN,
  Tag.VENUS,
  Tag.PLANT,
  Tag.MICROBE,
  Tag.ANIMAL,
  Tag.CITY,
  Tag.MOON,
  Tag.MARS,
  Tag.CRIME,
  'separator',
  Tag.EVENT,
  SpecialTags.NONE,
  Tag.WILD,
  SpecialTags.INFLUENCE,
  SpecialTags.CITY_COUNT,
  SpecialTags.COLONY_COUNT,
  SpecialTags.UNDERGROUND_TOKEN_COUNT,
  SpecialTags.CORRUPTION,
  SpecialTags.NEGATIVE_VP,
];

const isInGame = (tag: InterfaceTagsType, game: GameModel): boolean => {
  const gameOptions = game.gameOptions;
  if (game.turmoil === undefined && tag === SpecialTags.INFLUENCE) {
    return false;
  }
  switch (tag) {
  case SpecialTags.COLONY_COUNT:
    return gameOptions.expansions.colonies !== false;
  case SpecialTags.INFLUENCE:
    return game.turmoil !== undefined;
  case SpecialTags.UNDERGROUND_TOKEN_COUNT:
  case SpecialTags.CORRUPTION:
  case SpecialTags.NEGATIVE_VP:
    return gameOptions.expansions.underworld !== false;
  case Tag.VENUS:
  case Tag.MOON:
  case Tag.MARS:
  case Tag.CRIME:
    return game.tags.includes(tag);
  }
  return true;
};

const getTagCount = (tagName: InterfaceTagsType, player: PublicPlayerModel): number => {
  switch (tagName) {
  case SpecialTags.COLONY_COUNT:
    return player.coloniesCount || 0;
  case SpecialTags.INFLUENCE:
    return player.influence || 0;
  case SpecialTags.CITY_COUNT:
    return player.citiesCount || 0;
  case SpecialTags.NONE:
    return player.noTagsCount || 0;
  case SpecialTags.UNDERGROUND_TOKEN_COUNT:
    return player.underworldData.tokens.length;
  case SpecialTags.CORRUPTION:
    return player.underworldData.corruption;
  case SpecialTags.NEGATIVE_VP:
    return player.victoryPointsBreakdown.negativeVP;
  case 'separator':
  case 'all':
    return -1;
  default:
    // `?? 0` covers the setup-reveal baseline, whose staged tags map is empty
    // (a fresh player's real model always carries a full tag count).
    return player.tags[tagName] ?? 0;
  }
};

export default defineComponent({
  name: 'PlayerTags',
  props: {
    playerView: {
      type: Object as () => ViewModel,
      required: true,
    },
    player: {
      type: Object as () => PublicPlayerModel,
      required: true,
    },
    hideZeroTags: {
      type: Boolean,
    },
    isTopBar: {
      type: Boolean,
      default: false,
    },
    conciseTagsViewDefaultValue: {
      type: Boolean,
      required: false,
      default: true,
    },
    // Which slice of the tags block to render:
    //   main       — VP/TR/cards header row.
    //   secondary  — everything below (card tags + separator + extras). Used by
    //                the spectator's PlayerInfo for backwards compatibility.
    //   cardTags   — only the regular card tags (Building/Space/...). Used by
    //                LeftPlayerPanel to put card tags into one sci-fi block.
    //   extras     — only the "non-card-tag" counters (Event/None/Wild/City
    //                Count/Colony Count/...) — the original separator becomes
    //                a real sub-block in LeftPlayerPanel.
    //   both       — main + secondary (the legacy behaviour).
    section: {
      type: String as () => 'main' | 'secondary' | 'both' | 'cardTags' | 'extras',
      default: 'both',
    },
  },
  components: {
    'tag-count': TagCount,
    PrivateScoreMask,
    PlayerTagDiscount,
    PointsPerTag,
  },
  computed: {
    /**
     * During the start-of-game setup reveal the tags + TR stage with the corp
     * bonus (empty tags at baseline → the corporation's tags appear when it's
     * applied), so the tag cluster reveals in step with the resources. Only the
     * numeric / tag fields are overridden (spread over `player`).
     */
    effectivePlayer(): PublicPlayerModel {
      const override = startSetupOverrideFor(this.player.color);
      // The override's `tags` is a partial map (baseline = empty); getTagCount
      // falls back to 0 for a missing tag, so the cast is safe.
      return override !== undefined ? {...this.player, ...override} as PublicPlayerModel : this.player;
    },
    /*
     * `tagDetails` rebuilds whenever `player` or `playerView` changes — moved
     * out of `data()` so that swapping the displayed player in LeftPlayerPanel
     * actually rerenders the tag list. (data() only runs once when the
     * component is constructed.)
     */
    tagDetails(): {all: TagDetail; tagsInOrder: Array<TagDetail>} {
      type TagDetails = Record<InterfaceTagsType | 'all', TagDetail>;

      const interim = ORDER.map((key) => [
        key,
        {name: key, discount: 0, points: 0, count: getTagCount(key, this.effectivePlayer), halfPoints: 0, asterisk: false},
      ]);
      const details: TagDetails = Object.fromEntries(interim);

      details['all'] = {
        name: 'all',
        discount: this.player?.cardDiscount ?? 0,
        points: 0,
        count: 0,
        halfPoints: 0,
        asterisk: false,
      };

      for (const card of this.player.tableau) {
        for (const discount of card.discount ?? []) {
          const tag = discount.tag ?? 'all';
          details[tag].discount += discount.amount;
        }

        // See https://github.com/terraforming-mars/terraforming-mars/issues/5236
        if (card.name === CardName.CULTIVATION_OF_VENUS || card.name === CardName.VENERA_BASE) {
          details[Tag.VENUS].halfPoints++;
        } else {
          const vps = getCard(card.name)?.victoryPoints;
          if (vps !== undefined && typeof(vps) !== 'number' && vps !== 'special') {
            const asterisk = vps.nextToThis !== undefined;
            if (vps.tag !== undefined) {
              if (!asterisk) {
                details[vps.tag].points += ((vps.each ?? 1) / (vps.per ?? 1));
              } else {
                details[vps.tag].asterisk = true;
              }
            }
            if (vps.cities !== undefined) {
              if (!asterisk) {
                details['city-count'].points += ((vps.each ?? 1) / (vps.per ?? 1));
              } else {
                details['city-count'].asterisk = true;
              }
            }
          }
        }
      }

      if (this.playerView.game.turmoil?.ruling === PartyName.UNITY &&
        this.playerView.game.turmoil.politicalAgendas?.unity.policyId === 'up04') {
        details[Tag.SPACE].discount += 2;
      }

      const tagsInOrder: Array<TagDetail> = [];
      for (const tag of ORDER) {
        tagsInOrder.push(details[tag]);
      }

      return {all: details['all'], tagsInOrder};
    },
    all(): TagDetail {
      return this.tagDetails.all;
    },
    tagsInOrder(): Array<TagDetail> {
      return this.tagDetails.tagsInOrder;
    },
    isThisPlayer(): boolean {
      return this.player.color === this.playerView.thisPlayer?.color;
    },
    cardsInHandCount(): number {
      return this.player.cardsInHandNbr ?? 0;
    },
    hideVpCount(): boolean {
      return !this.playerView.game.gameOptions.showOtherPlayersVP && !this.isThisPlayer;
    },
    // Local "private score": mask the viewer's OWN VP count on this passive tag row.
    privateMaskVp(): boolean {
      return shouldMaskOwnPassiveVp(this.isThisPlayer);
    },
    isEscapeVelocityOn(): boolean {
      return this.playerView.game.gameOptions.escapeVelocity !== undefined;
    },
    escapeVelocityPenalty(): number {
      return this.player.victoryPointsBreakdown.escapeVelocity;
    },
    tooltipCss(): string {
      return 'tooltip tooltip-' + (this.isTopBar ? 'bottom' : 'top');
    },
    tags(): Array<TagDetail> {
      // In tests this one call to vueRoot uses `?.` because for some reason it this doesn't pass tests.
      const concise = vueRoot(this).componentsVisibility?.['tags_concise'] ?? this.conciseTagsViewDefaultValue;
      const filtered = this.tagsInOrder.filter((entry) => {
        if (!isInGame(entry.name, this.playerView.game)) {
          return false;
        }

        if (entry.count === 0 && entry.discount === 0) {
          if (this.hideZeroTags || concise) {
            return false;
          }
        }
        return true;
      });

      // For the split-section views the canonical 'separator' entry is the
      // divider in ORDER; cut at it.
      if (this.section === 'cardTags') {
        const idx = filtered.findIndex((e) => e.name === 'separator');
        return idx >= 0 ? filtered.slice(0, idx) : filtered;
      }
      if (this.section === 'extras') {
        const idx = filtered.findIndex((e) => e.name === 'separator');
        return idx >= 0 ? filtered.slice(idx + 1) : [];
      }
      return filtered;
    },
    SpecialTags() {
      return SpecialTags;
    },
    /*
     * Forwarded to every TagCount as the change-feedback epoch so a
     * new game session re-baselines without stale deltas. `runId` is
     * stable for the lifetime of a game and changes when a new game
     * is loaded into the same App instance.
     */
    epoch(): string {
      return this.playerView.runId ?? '';
    },
  },
});

</script>
