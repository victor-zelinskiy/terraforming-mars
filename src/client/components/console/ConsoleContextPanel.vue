<template>
  <aside class="con-inspector con-context" :aria-label="$t('Cell details')">
    <!-- ── TASK MODE: active placement ─────────────────────────────── -->
    <template v-if="mode === 'placement'">
      <div class="con-context__task-kicker">{{ $t('Tile placement') }}</div>
      <div class="con-context__task-title">{{ placementTitle }}</div>

      <div v-if="selectedLegal" class="con-inspector__placement con-inspector__placement--legal">
        <GamepadGlyph control="confirm" />
        <span>{{ $t('Place here') }}</span>
      </div>
      <template v-else>
        <div class="con-inspector__placement con-inspector__placement--illegal">
          <span class="con-inspector__illegal-mark" aria-hidden="true">✕</span>
          <span>{{ $t('Cannot place here') }}</span>
        </div>
        <div v-if="illegalReason !== ''" class="con-context__reason">{{ illegalReason }}</div>
      </template>

      <div class="con-context__cell-brief" v-if="cellHeader !== ''">
        <span class="con-context__cell-brief-label">{{ $t('Board cell') }}:</span> {{ cellHeader }}
      </div>
      <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>

      <div class="con-context__commands">
        <div class="con-context__cmd" :class="{'con-context__cmd--off': !selectedLegal}">
          <GamepadGlyph control="confirm" /><span>{{ $t('Place here') }}</span>
        </div>
        <div class="con-context__cmd"><GamepadGlyph control="triggerR" /><span>{{ $t('Next available') }}</span></div>
        <div class="con-context__cmd"><GamepadGlyph control="triggerL" /><span>{{ $t('Inspect all cells') }}</span></div>
        <div class="con-context__cmd">
          <GamepadGlyph control="back" />
          <span>{{ cancellable ? $t('Cancel placement') : $t('Selection is required') }}</span>
        </div>
      </div>
    </template>

    <!-- ── CELL MODE: a selected cell, no task ─────────────────────── -->
    <template v-else-if="mode === 'cell'">
      <div class="con-inspector__kicker">{{ cellHeader !== '' ? cellHeader : $t('Board cell') }}</div>
      <div v-if="tileLabel !== ''" class="con-inspector__name">{{ tileLabel }}</div>
      <div v-if="ownerName !== ''" class="con-context__owner">
        <span :class="'con-status__dot player_bg_color_' + ownerColor"></span>
        <span>{{ ownerName }}</span>
      </div>
      <div v-if="cellDescription !== ''" class="con-inspector__desc">{{ cellDescription }}</div>
      <div v-if="info !== undefined && info.facts.length > 0" class="con-inspector__facts">
        <BoardFactGroups :facts="info.facts" :viewerColor="viewerColor" :players="players" />
      </div>
      <div v-else-if="loading" class="con-inspector__loading">{{ $t('Loading') }}…</div>
    </template>

    <!-- ── IDLE MODE: the console home summary ─────────────────────── -->
    <template v-else>
      <div class="con-inspector__kicker">{{ myTurn ? $t('Your turn') : $t('Waiting for other players') }}</div>
      <div class="con-context__summary">
        <div class="con-context__stat">
          <BarButtonIcon name="cards" />
          <span class="con-context__stat-label">{{ $t('Cards') }}</span>
          <span class="con-context__stat-value"><b>{{ cardsPlayable }}</b> / {{ cardsTotal }}</span>
        </div>
        <div class="con-context__stat">
          <BarButtonIcon name="actions" />
          <span class="con-context__stat-label">{{ $t('Actions') }}</span>
          <span class="con-context__stat-value"><b>{{ actionsAvailable }}</b> / {{ actionsTotal }}</span>
        </div>
        <div class="con-context__stat" :class="{'con-context__stat--hot': milestonesClaimable > 0}">
          <BarButtonIcon name="milestones" />
          <span class="con-context__stat-label">{{ $t('Milestones') }}</span>
          <span class="con-context__stat-value"><b>{{ milestonesClaimable }}</b></span>
        </div>
        <div class="con-context__stat" :class="{'con-context__stat--hot': awardsFundable > 0}">
          <BarButtonIcon name="awards" />
          <span class="con-context__stat-label">{{ $t('Awards') }}</span>
          <span class="con-context__stat-value"><b>{{ awardsFundable }}</b></span>
        </div>
      </div>

      <div class="con-context__commands">
        <div class="con-context__cmd" :class="{'con-context__cmd--off': !myTurn}">
          <GamepadGlyph control="inspect" /><span>{{ $t('Basic actions') }}</span>
        </div>
        <div class="con-context__cmd"><GamepadGlyph control="triggerL" /><span>{{ $t('Categories') }}</span></div>
        <div class="con-context__cmd" :class="{'con-context__cmd--hot': milestonesClaimable > 0}">
          <GamepadGlyph control="bumperL" /><span>{{ $t('Milestones') }}</span>
          <span v-if="milestonesClaimable > 0" class="con-context__cmd-badge">{{ milestonesClaimable }}</span>
        </div>
        <div class="con-context__cmd" :class="{'con-context__cmd--hot': awardsFundable > 0}">
          <GamepadGlyph control="bumperR" /><span>{{ $t('Awards') }}</span>
          <span v-if="awardsFundable > 0" class="con-context__cmd-badge">{{ awardsFundable }}</span>
        </div>
        <div class="con-context__cmd"><GamepadGlyph control="view" /><span>{{ $t('Log') }}</span></div>
      </div>
    </template>
  </aside>
</template>

<script lang="ts">
/**
 * The right CONTEXT + COMMAND panel (feedback iteration 2) — the console
 * mode's explaining-and-commanding surface, replacing the passive cell
 * tooltip. Three modes, all answering "what is selected / what can I do /
 * what happens on A / why not":
 *  - placement: the TASK state (legal/illegal + the SERVER's illegal
 *    reason + cell facts + the full command set incl. honest B);
 *  - cell: identity (header/name/owner) + facts from the shared
 *    BoardInformation pipeline;
 *  - idle: the turn summary — action-intelligence counters + the LB/RB/Y/LT
 *    command map with availability badges (the console home screen read).
 * Pure presentation: every value is a prop computed in ConsoleShell from
 * the same sources the desktop buttons use.
 */
import {defineComponent, PropType} from 'vue';
import BoardFactGroups from '@/client/components/board/BoardFactGroups.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo} from '@/common/boards/BoardInformationFacts';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText} from '@/client/directives/i18n';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleContextPanel',
  components: {BoardFactGroups, BarButtonIcon, GamepadGlyph},
  props: {
    mode: {type: String as PropType<'placement' | 'cell' | 'idle'>, required: true},
    info: {type: Object as PropType<BoardCellInfo | undefined>, default: undefined},
    loading: {type: Boolean, default: false},
    viewerColor: {type: String as PropType<Color>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    // placement mode
    placementTitle: {type: String, default: ''},
    selectedLegal: {type: Boolean, default: false},
    illegalReason: {type: String, default: ''},
    cancellable: {type: Boolean, default: false},
    // idle mode
    myTurn: {type: Boolean, default: false},
    cardsPlayable: {type: Number, default: 0},
    cardsTotal: {type: Number, default: 0},
    actionsAvailable: {type: Number, default: 0},
    actionsTotal: {type: Number, default: 0},
    milestonesClaimable: {type: Number, default: 0},
    awardsFundable: {type: Number, default: 0},
  },
  computed: {
    cellHeader(): string {
      return textOf(this.info?.status.header);
    },
    tileLabel(): string {
      return textOf(this.info?.status.tileLabel);
    },
    cellDescription(): string {
      return textOf(this.info?.description);
    },
    ownerColor(): Color | undefined {
      return this.info?.status.ownerColor;
    },
    ownerName(): string {
      const color = this.ownerColor;
      if (color === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === color)?.name ?? '';
    },
  },
});
</script>
