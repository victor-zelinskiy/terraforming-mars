<template>
  <!--
    Premium replacement for the legacy SelectPlayer radio list, hosted inside
    MandatoryInputModal via ModalInputHost. This is a TARGET PICKER, not a name
    list: each candidate is a rich glass card showing who they are (colour +
    name + corporation) and — when the server supplies icon/amount/scope — the
    exact per-target impact of the effect ("Production: 2 → 1") plus a self
    warning when the target is the acting player. Pick a card → it selects →
    a premium CTA commits (select → confirm, like ModernOptionPicker), so a
    destructive choice is never a single mis-click.

    Per-target current/resulting values are computed CLIENT-SIDE from the public
    player models (every player's stock + production is public info), so the
    server only needs the {icon, amount, scope} hint.

    Submission is byte-identical to SelectPlayer.vue: {type: 'player', player}.
  -->
  <div class="modal-input modal-input--players">
    <header class="modal-input__header modal-input__header--rich">
      <div class="modal-input__header-tab"></div>
      <div class="modal-input__header-text">
        <h3 class="modal-input__title">{{ headingText }}</h3>
        <p v-if="subtitleText !== ''" class="modal-input__subtitle">{{ subtitleText }}</p>
      </div>
      <!-- HUD summary of the effect ("−1 ⚡prod"). Secondary to the per-card
           previews, which carry the target-specific result. -->
      <div v-if="actionIconClass !== ''"
           class="modal-input__impact-chip"
           :class="{'modal-input__impact-chip--prod': isProduction}"
           aria-hidden="true">
        <span class="modal-input__impact-amount">−{{ actionAmount }}</span>
        <span class="modal-input__impact-icon-wrap" :class="{'modal-input__prod-frame': isProduction}">
          <span class="modal-input__option-icon" :class="actionIconClass"></span>
        </span>
      </div>
    </header>

    <div v-if="warningText !== ''" class="modal-input__warning">{{ warningText }}</div>

    <div class="modal-input__targets">
      <button v-for="t in targets"
              :key="t.color"
              type="button"
              class="modal-input__target-card"
              :class="{
                'modal-input__target-card--selected': selectedColor === t.color,
                'modal-input__target-card--self': t.self,
                'modal-input__target-card--disabled': t.disabled,
                'modal-input__target-card--muted': t.muted && !t.disabled,
              }"
              :disabled="t.disabled"
              @click="pick(t)"
              :data-test="'modern-player-' + t.color">
        <span class="modal-input__target-accent" :class="'player_bg_color_' + t.color" aria-hidden="true"></span>

        <span class="modal-input__target-dot" :class="'player_bg_color_' + t.color" aria-hidden="true"></span>

        <span class="modal-input__target-id">
          <span class="modal-input__target-name">{{ t.name }}</span>
          <span v-if="t.corporation !== ''" class="modal-input__target-corp">{{ t.corporation }}</span>
          <span v-if="t.self" class="modal-input__target-self-chip">
            <span class="modal-input__target-self-icon" aria-hidden="true">⚠</span>
            <span>{{ selfWarningText }}</span>
          </span>
        </span>

        <!-- Target-specific impact mini-HUD — the SAME premium layout for a
             human resource/production row and a MarsBot TRACK row (server truth,
             the client only renders). One row per server-computed change. -->
        <span v-if="t.changes.length > 0"
              class="modal-input__target-impact"
              :class="{'modal-input__target-impact--prod': t.changes.some((c) => c.scope !== 'stock')}"
              aria-hidden="true">
          <span v-for="(row, ri) in t.changes" :key="ri" class="modal-input__target-impact-line">
            <span v-if="rowLabel(row) !== ''" class="modal-input__target-impact-label">{{ rowLabel(row) }}</span>
            <span class="modal-input__target-impact-row">
              <span class="modal-input__target-impact-icon-wrap" :class="{'modal-input__prod-frame': row.scope === 'production'}">
                <Tag v-if="rowIsTrack(row)" :tag="rowTag(row)" size="small" type="secondary" />
                <span v-else class="modal-input__option-icon" :class="rowIconClass(row)"></span>
              </span>
              <span class="modal-input__target-impact-from">{{ row.from }}</span>
              <span class="modal-input__target-impact-arrow">→</span>
              <span class="modal-input__target-impact-to">{{ row.to }}</span>
              <span v-if="rowStepsText(row) !== ''" class="modal-input__target-impact-steps">{{ rowStepsText(row) }}</span>
            </span>
          </span>
        </span>
        <span v-else-if="t.disabled" class="modal-input__target-disabled-reason">{{ t.disabledReason }}</span>
        <span v-else-if="selectedColor === t.color" class="modal-input__target-check" aria-hidden="true">✓</span>
      </button>
    </div>

    <div v-if="selectedColor !== undefined && !controlled" class="modal-input__actions">
      <button type="button" class="modal-input__primary-btn" @click="confirm" data-test="modern-player-confirm">
        {{ confirmLabel }}
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectPlayerModel} from '@/common/models/PlayerInputModel';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';
import {SelectPlayerResponse} from '@/common/inputs/InputResponse';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardType} from '@/common/cards/CardType';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getCard} from '@/client/cards/ClientCardManifest';
import TagComponent from '@/client/components/Tag.vue';
// Shared icon-key → player-model field maps — the CLIENT-side fallback for a
// prompt WITHOUT server-computed impacts. Attack prompts now carry
// `targetImpacts` (server truth, correct for a MarsBot too) and use that.
import {STOCK_FIELD, PRODUCTION_FIELD, MC_PRODUCTION_FLOOR} from '@/client/components/modalInputs/playerResourceFields';

type TargetCard = {
  color: Color;
  name: string;
  corporation: string;
  self: boolean;
  // The SERVER-computed before→after rows (correct for humans AND the MarsBot).
  // 0 rows = no preview.
  changes: ReadonlyArray<TargetImpactChange>;
  muted: boolean;     // the effect produces no change (e.g. 0 → 0)
  disabled: boolean;  // the effect cannot apply at all (production at floor)
  disabledReason: string;
};

type DataModel = {
  selectedColor: Color | undefined;
};

export default defineComponent({
  name: 'ModernPlayerPicker',
  components: {Tag: TagComponent},
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectPlayerModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectPlayerResponse) => void,
      required: true,
    },
    // CONTROLLED (embedded) mode: when hosted inside the action confirmation
    // modal, the pick is collected by the parent (which owns the single final
    // submit), not committed here. In this mode picking a target EMITS `select`
    // with the response and the inline confirm CTA is hidden. Default false keeps
    // the standalone behaviour (own CTA → onsave) for the legacy follow-up flow.
    controlled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['select'],
  data(): DataModel {
    return {selectedColor: undefined};
  },
  computed: {
    icon(): string {
      return this.playerinput.icon ?? '';
    },
    actionIconClass(): string {
      return iconClassFor(this.playerinput.icon);
    },
    actionAmount(): number | undefined {
      return this.playerinput.amount;
    },
    isProduction(): boolean {
      return this.playerinput.scope === 'production';
    },
    titleAsText(): string {
      const t = this.playerinput.title;
      return typeof t === 'string' ? translateText(t) : translateMessage(t);
    },
    buttonAsText(): string {
      const b = this.playerinput.buttonLabel;
      return b !== undefined && b !== '' ? translateText(b) : '';
    },
    // Rich mode (icon supplied): short heading + the full instruction as a
    // lighter subtitle. Plain mode: keep the instruction as the heading.
    headingText(): string {
      if (this.icon === '') {
        return this.titleAsText;
      }
      if (this.isProduction) {
        return translateText('Reduce production');
      }
      return this.buttonAsText !== '' ? this.buttonAsText : this.titleAsText;
    },
    subtitleText(): string {
      return this.icon === '' ? '' : this.titleAsText;
    },
    warningText(): string {
      const w = this.playerinput.warning;
      if (w === undefined) {
        return '';
      }
      return typeof w === 'string' ? translateText(w) : translateMessage(w);
    },
    selfWarningText(): string {
      return translateText('This is you');
    },
    confirmLabel(): string {
      if (this.isProduction) {
        return translateText('Reduce production');
      }
      return this.buttonAsText !== '' ? this.buttonAsText : translateText('Confirm');
    },
    // The "ПРОИЗВОДСТВО" label shown above the from→to in production previews
    // (the resource itself is carried by the framed icon, so no declension).
    productionWord(): string {
      return translateText('Production rate');
    },
    targets(): ReadonlyArray<TargetCard> {
      const selectable = this.playerinput.players.map((color) => this.buildTarget(color));
      const disabled = (this.playerinput.disabledPlayers ?? []).map((d) => this.buildDisabledTarget(d.color, d.reason));
      return [...selectable, ...disabled];
    },
  },
  methods: {
    publicPlayer(color: Color): PublicPlayerModel | undefined {
      return this.playerView.players.find((p) => p.color === color);
    },
    playerName(color: Color): string {
      const player = this.publicPlayer(color);
      // 'neutral' (solo opponent) isn't in the players list — label it plainly.
      return player !== undefined ? player.name : translateText('Neutral');
    },
    corporationName(color: Color): string {
      const player = this.publicPlayer(color);
      const corp = (player?.tableau ?? []).find((card) => getCard(card.name)?.type === CardType.CORPORATION);
      return corp !== undefined ? translateText(corp.name) : '';
    },
    buildTarget(color: Color): TargetCard {
      const self = this.playerView.thisPlayer?.color === color;
      const base: TargetCard = {
        color,
        name: this.playerName(color),
        corporation: this.corporationName(color),
        self,
        changes: [],
        muted: false,
        disabled: false,
        disabledReason: '',
      };
      // SERVER truth first — the picker renders the exact rows the server
      // computed (a MarsBot production hit is a TRACK regression, its stock loss
      // is M€), never a client-derived number. No isMarsBot branch here.
      const serverImpact = (this.playerinput.targetImpacts ?? []).find((ti) => ti.color === color);
      if (serverImpact !== undefined) {
        const changes = serverImpact.changes;
        return {...base, changes, muted: changes.length === 0 || changes.every((c) => c.from === c.to)};
      }
      // Fallback (a prompt without server impacts): derive from the public model.
      const player = this.publicPlayer(color);
      const field = (this.isProduction ? PRODUCTION_FIELD : STOCK_FIELD)[this.icon];
      if (this.icon === '' || this.actionAmount === undefined || player === undefined || field === undefined) {
        return base;
      }
      const current = player[field] as number;
      const floor = (this.isProduction && this.icon === 'megacredits') ? MC_PRODUCTION_FLOOR : 0;
      const resulting = Math.max(floor, current - this.actionAmount);
      if (this.isProduction && current <= floor) {
        return {...base, disabled: true, disabledReason: translateText('Production already at minimum')};
      }
      const change: TargetImpactChange = {
        icon: this.icon,
        from: current,
        to: resulting,
        scope: this.isProduction ? 'production' : 'stock',
        ...(this.isProduction ? {steps: this.actionAmount} : {}),
      };
      return {...base, changes: [change], muted: resulting === current};
    },
    // A relevant-but-unavailable target the server flagged: rendered greyed,
    // non-selectable, with the server's reason. No impact preview.
    buildDisabledTarget(color: Color, reason: string | import('@/common/logs/Message').Message | undefined): TargetCard {
      const reasonText = reason === undefined ? '' : (typeof reason === 'string' ? translateText(reason) : translateMessage(reason));
      return {
        color,
        name: this.playerName(color),
        corporation: this.corporationName(color),
        self: this.playerView.thisPlayer?.color === color,
        changes: [],
        muted: false,
        disabled: true,
        disabledReason: reasonText,
      };
    },
    // ── per-row rendering (scope-aware) — the SAME premium layout for a human
    // resource/production row and a MarsBot track row ──
    rowIsTrack(row: TargetImpactChange): boolean {
      return row.scope === 'track';
    },
    // A track row's icon key IS a Tag value (server-set) — the Tag component
    // needs the typed value.
    rowTag(row: TargetImpactChange): Tag {
      return row.icon as Tag;
    },
    rowIconClass(row: TargetImpactChange): string {
      return iconClassFor(row.icon);
    },
    rowLabel(row: TargetImpactChange): string {
      if (row.scope === 'production') {
        return translateText('Production rate');
      }
      if (row.scope === 'track') {
        return translateText('Track');
      }
      return '';
    },
    rowStepsText(row: TargetImpactChange): string {
      // A track regression names the divisions moved («−2 деления»); a plain
      // production row already reads its own from→to, so no step suffix.
      if (row.scope === 'track' && row.steps !== undefined && row.steps > 0) {
        return `−${row.steps}`;
      }
      return '';
    },
    pick(target: TargetCard): void {
      if (target.disabled) {
        return;
      }
      this.selectedColor = target.color;
      if (this.controlled) {
        this.$emit('select', {type: 'player', player: target.color});
      }
    },
    confirm(): void {
      if (this.selectedColor === undefined) {
        return;
      }
      this.onsave({type: 'player', player: this.selectedColor});
    },
  },
});
</script>
