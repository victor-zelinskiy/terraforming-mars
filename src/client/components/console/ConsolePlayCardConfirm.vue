<template>
  <div class="con-task-host con-play" role="dialog" :aria-label="titleText">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
    <div class="con-task con-task--wide con-play__frame">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <header class="con-task__head">
        <div class="con-task__kicker">
          <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Play project card') }}</span>
        </div>
        <div class="con-task__title">{{ titleText }}</div>
        <div class="con-task__pickline">
          <span class="con-task__paycost">
            {{ $t('Cost') }}: <b>{{ cost }}</b> <i class="resource_icon resource_icon--megacredits con-task__opt-res" aria-hidden="true"></i>
          </span>
          <span class="con-task__pickcount" :class="{'con-task__pickcount--ready': paymentReady}">
            {{ $t('Total') }}: <b>{{ payTotal }}</b> / {{ cost }}
          </span>
        </div>
      </header>

      <div class="con-task__main">
        <!-- INFO PARITY: the card itself, full premium render. -->
        <div class="con-play__cardside">
          <Card v-if="card !== undefined" :card="card" :key="card.name" />
        </div>

        <div class="con-task__body con-play__body">
          <!-- ── The on-play RESULT (the same /api/card-play-preview
               the desktop modal reads). ─────────────────────────────── -->
          <div v-if="loading" class="con-actconfirm__loading">{{ $t('Loading') }}…</div>
          <template v-else-if="branches.length > 0">
            <div class="con-start__section-title">{{ $t('Result') }}</div>
            <div v-for="(branch, i) in branches" :key="i"
                 class="con-actconfirm__branch"
                 :class="{'con-actconfirm__branch--off': !branch.available}">
              <div v-if="branches.length > 1" class="con-actconfirm__branch-title">{{ branchTitleText(branch) }}</div>
              <div class="con-actconfirm__effects">
                <ActionEffectChip v-for="(eff, k) in branch.effects" :key="k" :effect="eff" />
              </div>
              <div v-if="!branch.available && branch.unavailableReason !== undefined" class="con-actconfirm__reason">
                ✕ {{ branchReasonText(branch) }}
              </div>
            </div>
            <div v-if="branches.length > 1" class="con-actconfirm__note">
              {{ $t('The choice of option follows after confirmation') }}
            </div>
          </template>

          <!-- SILENT-LOSS warnings carry over verbatim (never surprising). -->
          <div v-if="warningSteps.length > 0" class="con-task__warnings">
            <div v-for="(w, i) in warningSteps" :key="'w' + i" class="con-task__warning">
              ⚠ <i v-if="w.icon !== ''" :class="w.icon" class="con-task__opt-icon" aria-hidden="true"></i> {{ w.text }}
            </div>
          </div>

          <!-- The choices the desktop modal pre-collects arrive HERE as
               native follow-up tasks — announced honestly up front. -->
          <div v-if="nextSteps.length > 0" class="con-play__next">
            <div class="con-start__section-title">{{ $t('After confirming') }}</div>
            <div v-for="(s, i) in nextSteps" :key="'n' + i" class="con-play__next-line">→ {{ s }}</div>
          </div>

          <!-- ── Payment (native lanes — the desktop card rules). ───── -->
          <div class="con-start__section-title">{{ $t('Payment') }}</div>
          <div v-for="(lane, i) in payLanes" :key="lane.unit"
               class="con-task__lane"
               :class="{'con-task__lane--focused': focusIdx === i, 'con-task__lane--active': payCount(lane.unit) > 0}">
            <span class="con-task__lane-id">
              <i class="con-task__opt-icon" :class="'resource_icon resource_icon--' + lane.unit" aria-hidden="true"></i>
            </span>
            <span class="con-task__lane-rate" aria-hidden="true">×{{ lane.rate }}</span>
            <span class="con-task__lane-value">{{ payCount(lane.unit) }}</span>
            <span class="con-task__lane-max">/ {{ lane.available }}</span>
            <span v-if="lane.reserved" class="con-task__lane-reserved">{{ $t('reserved') }}</span>
            <span v-if="focusIdx === i" class="con-task__lane-keys" aria-hidden="true">
              <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
            </span>
          </div>
          <div class="con-task__lane con-task__lane--auto" :class="{'con-task__lane--active': payAutoMc > 0}">
            <span class="con-task__lane-id">
              <i class="con-task__opt-icon resource_icon resource_icon--megacredits" aria-hidden="true"></i>
            </span>
            <span class="con-task__lane-value">{{ payAutoMc }}</span>
            <span class="con-task__lane-max">/ {{ megacreditsOnHand }}</span>
            <span class="con-task__lane-auto-tag">{{ $t('auto') }}</span>
          </div>
          <div v-if="!paymentReady" class="con-task__pay-short">
            ⚠ {{ $t('Not enough resources to cover the cost') }}
          </div>
        </div>
      </div>

      <!-- ── Footer: the command contract ──────────────────────────── -->
      <footer class="con-task__foot" aria-hidden="true">
        <span v-for="(hint, i) in footHints" :key="i" class="con-task__foot-item" :class="{'con-task__foot-item--off': hint.enabled === false}">
          <GamepadGlyph :control="hint.control" />
          <span>{{ $t(hint.label) }}</span>
        </span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAY-CARD CONFIRM — CTS T8 (fallback retirement). The
 * console-native replacement for the re-hosted desktop
 * HandCardPaymentContent modal:
 *
 *  - the on-play RESULT comes from the SAME `/api/card-play-preview`
 *    (branch chips / availability reasons / VP / silent-loss warnings);
 *  - the payment lanes reuse `paymentPlan.ts` with the DESKTOP project-
 *    card rules (`projectCardPaymentPrompt`: tag-gated alternates, Last
 *    Resort Ingenuity, LTF titanium −1, reserveUnits SUBTRACTED);
 *  - the choices the desktop modal PRE-COLLECTS (targets / or-branches /
 *    amounts) are announced up front («После подтверждения») and arrive
 *    as NATIVE follow-up tasks — the sequential one-decision-per-screen
 *    flow is the console idiom, and the payload path (bare
 *    `{type:'projectCard', card, payment}` + live follow-up prompts) is
 *    the legacy-supported server contract, byte-identical to the radio UI.
 *
 * Grammar: ↑/↓ lanes · ←/→ & LB/RB ±1 · Y = MAX · A/X = play (gated on
 * coverage) · B = cancel (client-side, nothing committed).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {Tag} from '@/common/cards/Tag';
import {SpendableResource} from '@/common/inputs/Spendable';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {getCard} from '@/client/cards/ClientCardManifest';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import {
  autoMegacredits, initialCounts, laneCap, megacreditsAvailable, paymentCovers,
  paymentFromCounts, PaymentLane, paymentLanes, paymentTotal, projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsolePlayCardConfirm',
  components: {Card, GamepadGlyph, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    cardName: {type: String as PropType<CardName>, required: true},
    input: {type: Object as PropType<SelectProjectCardToPlayModel>, required: true},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      preview: undefined as ActionPreview | undefined,
      loading: true,
      focusIdx: 0,
      payCounts: {} as Partial<Record<SpendableResource, number>>,
    };
  },
  computed: {
    card(): CardModel | undefined {
      return this.input.cards.find((c) => c.name === this.cardName);
    },
    titleText(): string {
      return translateText(this.cardName);
    },
    cost(): number {
      return this.card?.calculatedCost ?? 0;
    },
    paymentPrompt() {
      let tags: ReadonlyArray<Tag> = [];
      try {
        tags = getCard(this.cardName)?.tags ?? [];
      } catch (err) {
        tags = [];
      }
      return projectCardPaymentPrompt(
        this.cost,
        tags,
        this.input.paymentOptions ?? {},
        this.playerView.thisPlayer.lastCardPlayed,
        this.card?.reserveUnits,
      );
    },
    payLanes(): Array<PaymentLane> {
      return paymentLanes(this.paymentPrompt, this.playerView.thisPlayer);
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.playerView.thisPlayer);
    },
    payAutoMc(): number {
      return autoMegacredits(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    payTotal(): number {
      return paymentTotal(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    paymentReady(): boolean {
      return paymentCovers(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    allSteps(): ReadonlyArray<ActionPreviewStep> {
      const out: Array<ActionPreviewStep> = [...(this.preview?.preSteps ?? [])];
      for (const b of this.branches) {
        if (b.available) {
          out.push(...b.steps);
        }
      }
      return out;
    },
    /** Silent-loss warnings — verbatim desktop parity (never surprising). */
    warningSteps(): Array<{text: string, icon: string}> {
      const out: Array<{text: string, icon: string}> = [];
      for (const s of this.allSteps) {
        if (s.kind === 'note' && s.noteKind === 'warning') {
          out.push({
            text: s.text !== undefined ? textOf(s.text) : translateText('No eligible card — this resource is not added.'),
            icon: s.resource !== undefined ? iconClassFor(s.resource) + ' con-task__opt-res' : '',
          });
        }
      }
      return out;
    },
    /** The follow-up decisions (arrive as native tasks after confirm). */
    nextSteps(): Array<string> {
      const out: Array<string> = [];
      for (const s of this.allSteps) {
        switch (s.kind) {
        case 'input':
        case 'spendHeat': {
          const t = textOf(s.input.title);
          if (t !== '') {
            out.push(t);
          }
          break;
        }
        case 'boardPlacement':
          out.push(translateText('Choose a location on the board'));
          break;
        case 'tabbedTargets':
          out.push(translateText('Choose a target'));
          break;
        case 'note':
          if (s.noteKind !== 'warning') {
            out.push(s.text !== undefined ? textOf(s.text) : translateText('Choose a target'));
          }
          break;
        }
      }
      return out;
    },
    footHints(): Array<{control: GlyphControl, label: string, enabled?: boolean}> {
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
        {control: 'inspect', label: 'MAX'},
        {control: 'confirm', label: 'Play now', enabled: this.paymentReady},
        {control: 'secondary', label: 'Card'},
        {control: 'back', label: 'Cancel'},
      ];
    },
  },
  watch: {
    cardName: {
      immediate: true,
      handler() {
        this.preview = undefined;
        this.loading = true;
        this.focusIdx = 0;
        this.payCounts = initialCounts(this.cost, this.payLanes, this.megacreditsOnHand);
        this.fetchPreview();
      },
    },
  },
  methods: {
    fetchPreview(): void {
      const cardName = this.cardName;
      const url = apiUrl(paths.API_CARD_PLAY_PREVIEW) +
        '?id=' + encodeURIComponent(this.playerView.id) +
        '&card=' + encodeURIComponent(cardName);
      fetch(url)
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          if (this.cardName === cardName) {
            this.preview = p as ActionPreview | undefined;
            this.loading = false;
          }
        })
        .catch(() => {
          // Best-effort: the confirm still works (payment + card render).
          if (this.cardName === cardName) {
            this.loading = false;
          }
        });
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    /** The shell routes every intent here while the confirm is open. */
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      this.onPress(intent.button);
    },
    onNav(dir: NavDirection): void {
      if (dir === 'up' || dir === 'down') {
        const n = this.payLanes.length;
        if (n === 0) {
          return;
        }
        this.focusIdx = Math.min(n - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        return;
      }
      this.adjust(dir === 'right' ? 1 : -1);
    },
    adjust(step: number): void {
      const lane = this.payLanes[this.focusIdx];
      if (lane === undefined) {
        return;
      }
      const current = this.payCounts[lane.unit] ?? 0;
      const next = Math.min(laneCap(this.cost, lane), Math.max(0, current + step));
      this.payCounts = {...this.payCounts, [lane.unit]: next};
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'bumperL':
        this.adjust(-1);
        return;
      case 'bumperR':
        this.adjust(1);
        return;
      case 'inspect': {
        const lane = this.payLanes[this.focusIdx];
        if (lane !== undefined) {
          this.payCounts = {...this.payCounts, [lane.unit]: laneCap(this.cost, lane)};
        }
        return;
      }
      case 'confirm':
        if (this.paymentReady) {
          this.$emit('confirm', paymentFromCounts(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand));
        }
        return;
      case 'secondary':
        // P13 global rule: X reads THE card fullscreen.
        if (this.card !== undefined) {
          openConsoleCardZoom([this.card], 0);
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    branchTitleText(branch: ActionPreviewBranch): string {
      return textOf(branch.title);
    },
    branchReasonText(branch: ActionPreviewBranch): string {
      const reason = branch.unavailableReason;
      if (reason === undefined) {
        return '';
      }
      if (typeof reason === 'string') {
        return translateTextWithParams(reason, (branch.unavailableReasonParams ?? []).map(String));
      }
      return translateMessage(reason);
    },
  },
});
</script>
