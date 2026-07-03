<template>
  <div class="con-task-host con-trade" role="dialog" :aria-label="$t('Trade')">
    <div class="con-task-host__backdrop" aria-hidden="true"></div>
    <div class="con-task con-trade__frame">
      <!-- ── Header ────────────────────────────────────────────────── -->
      <header class="con-task__head">
        <div class="con-task__kicker">
          <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Trade') }}</span>
        </div>
        <div class="con-task__title">{{ $t(colonyName) }}</div>
      </header>

      <div class="con-task__main">
        <!-- INFO PARITY: the REAL colony tile (track position + reward). -->
        <div v-if="colony !== undefined" class="con-trade__tile">
          <ColonyTile :colony="colony" mode="view" :selectable="false" />
          <div v-if="beneficiaries.length > 0" class="con-trade__bonus">
            <span class="con-trade__bonus-label">{{ $t('Trade bonus to colonies here') }}:</span>
            <span v-for="(b, i) in beneficiaries" :key="i" class="con-task__opt-player">
              <span :class="'con-status__dot player_bg_color_' + b.color"></span>
              <span>{{ b.name }}</span><span v-if="b.count > 1"> ×{{ b.count }}</span>
            </span>
          </div>
        </div>

        <!-- ── The payment paths (the inner "Pay trade fee" OrOptions). ── -->
        <div class="con-task__body con-trade__body">
          <div class="con-start__section-title">{{ $t('Pay trade fee') }}</div>
          <div v-for="(entry, i) in payEntries" :key="'p' + i"
               class="con-task__option"
               :class="{
                 'con-task__option--focused': focusIdx === i,
                 'con-task__option--armed': focusIdx === i && armed,
               }">
            <div class="con-task__option-main">
              <i v-if="entry.iconClass !== ''" class="con-task__opt-icon" :class="entry.iconClass" aria-hidden="true"></i>
              <span class="con-task__opt-title">{{ entry.title }}</span>
              <span v-if="entry.preview !== ''" class="con-task__opt-preview">{{ entry.preview }}</span>
              <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
            </div>
          </div>
          <div v-if="disabledOptions.length > 0" class="con-task__disabled">
            <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
            <div v-for="(d, i) in disabledEntries" :key="'d' + i" class="con-task__option con-task__option--disabled">
              <div class="con-task__option-main">
                <i v-if="d.iconClass !== ''" class="con-task__opt-icon" :class="d.iconClass" aria-hidden="true"></i>
                <span class="con-task__opt-title">{{ d.title }}</span>
                <span class="con-task__opt-reason">{{ d.reason }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Footer: the command contract ──────────────────────────── -->
      <footer class="con-task__foot" aria-hidden="true">
        <span class="con-task__foot-item"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
        <span class="con-task__foot-item"><GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span></span>
        <span class="con-task__foot-item"><GamepadGlyph control="secondary" /><span>{{ $t('Trade') }}</span></span>
        <span class="con-task__foot-item"><GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span></span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE COLONY-TRADE CONFIRM — CTS T8 (fallback retirement). The
 * console-native replacement for the re-hosted desktop
 * ColonyTradePaymentModal: the REAL ColonyTile render (track position +
 * reward — the tile IS the source of truth), the fixed trade-bonus
 * beneficiaries line, and the payment paths as T1-style option rows —
 * each with its resource icon + the `current → resulting` stock preview
 * from the SAME server `OptionMetadata`; unaffordable paths stay VISIBLE
 * with their reason. A = select/arm (A again = confirm), X = confirm the
 * focused path in one press, B = cancel (client-side, nothing committed).
 * The submit (the and-response wrapping) stays in the shell — byte-parity
 * with the desktop path.
 */
import {defineComponent, PropType} from 'vue';
import ColonyTile from '@/client/components/colonies/ColonyTile.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import {Color} from '@/common/Color';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection, SemanticButton} from '@/client/gamepad/gamepadPollModel';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type PayEntry = {title: string, iconClass: string, preview: string};

export default defineComponent({
  name: 'ConsoleColonyTradeConfirm',
  components: {ColonyTile, GamepadGlyph},
  props: {
    colony: {type: Object as PropType<ColonyModel | undefined>, default: undefined},
    colonyName: {type: String as PropType<ColonyName>, required: true},
    /** The inner "Pay trade fee" OrOptions options (server-affordable). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, required: true},
    /** Unaffordable paths — shown disabled with the server reason. */
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      focusIdx: 0,
      armed: false,
    };
  },
  computed: {
    payEntries(): Array<PayEntry> {
      return this.options.map((o) => {
        const meta = o.metadata;
        const res = meta?.resource;
        return {
          title: textOf(o.title),
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          preview: res !== undefined ? `${res.current} → ${res.resulting}` : '',
        };
      });
    },
    disabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return this.disabledOptions.map((d) => {
        const rec = d as {label?: string | Message, reason?: string | Message, metadata?: {icon?: string}};
        return {
          title: textOf(rec.label),
          iconClass: rec.metadata?.icon !== undefined ? iconClassFor(rec.metadata.icon) + ' con-task__opt-res' : '',
          reason: textOf(rec.reason),
        };
      });
    },
    /** Colony owners receiving the FIXED tile bonus on this trade (×N for
     *  multiple colonies) — the desktop modal's transparency block. */
    beneficiaries(): Array<{color: Color, name: string, count: number}> {
      const counts = new Map<Color, number>();
      for (const c of this.colony?.colonies ?? []) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return [...counts.entries()].map(([color, count]) => ({
        color,
        name: this.players.find((p) => p.color === color)?.name ?? color,
        count,
      }));
    },
  },
  methods: {
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
      if (dir !== 'up' && dir !== 'down') {
        return;
      }
      const n = this.options.length;
      if (n === 0) {
        return;
      }
      const next = Math.min(n - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        this.armed = false;
      }
    },
    onPress(button: SemanticButton): void {
      switch (button) {
      case 'confirm':
        if (this.armed) {
          this.$emit('confirm', this.focusIdx);
        } else {
          this.armed = true;
        }
        return;
      case 'secondary':
        this.$emit('confirm', this.focusIdx);
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
  },
});
</script>
