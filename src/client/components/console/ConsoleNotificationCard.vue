<template>
  <article class="con-notif"
           :class="[
             'notification-card--variant-' + notification.variant,
             'con-notif--' + notification.kind,
             {'con-notif--prestige': prestige, 'con-notif--holding': notification.holdsFlow === true},
           ]"
           role="status"
           :aria-label="$t(notification.typeLabelKey)">
    <span class="con-notif__rail" :class="railColorClass" aria-hidden="true"></span>

    <header class="con-notif__head">
      <span class="con-notif__glyph" aria-hidden="true">{{ glyph }}</span>
      <span class="con-notif__type" v-i18n>{{ notification.typeLabelKey }}</span>
      <span v-if="notification.actor !== undefined" class="con-notif__actor">
        <span class="con-notif__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
        <span>{{ actorName }}</span>
      </span>
    </header>

    <div class="con-notif__body">
      <div v-if="metaLine !== undefined" class="con-notif__meta">{{ metaLine }}</div>

      <!-- HOSTILE loss the viewer suffered — the essentials render DIRECTLY
           (no expand step on a console toast): cause, the −X → +X flow,
           stock-vs-production, before → after. -->
      <template v-if="negative !== undefined">
        <div class="con-notif__cause">
          <span class="con-notif__dim" v-i18n>Caused by</span>
          <span v-if="negative.attacker !== undefined" class="con-notif__actor">
            <span class="con-notif__dot" :class="'player_bg_color_' + negative.attacker" aria-hidden="true"></span>
            <span>{{ attackerName }}</span>
          </span>
          <b v-if="negative.sourceCard !== undefined" class="con-notif__card">{{ $t(negative.sourceCard) }}</b>
        </div>
        <div class="con-notif__flow">
          <span class="con-notif__side">
            <span class="con-notif__who" v-i18n>You</span>
            <span v-for="(chip, i) in negative.loss" :key="'l' + i"
                  class="con-notif__chip con-notif__chip--neg"
                  :class="{'con-notif__chip--prod': chip.production === true}">
              <span class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
              <span>{{ chip.text }}</span>
            </span>
          </span>
          <template v-if="negative.transfer && negative.gain !== undefined">
            <span class="con-notif__arrow" aria-hidden="true">→</span>
            <span class="con-notif__side">
              <span class="con-notif__who">{{ attackerName }}</span>
              <span v-for="(chip, i) in negative.gain" :key="'g' + i"
                    class="con-notif__chip con-notif__chip--pos"
                    :class="{'con-notif__chip--prod': chip.production === true}">
                <span class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
                <span>{{ chip.text }}</span>
              </span>
            </span>
          </template>
        </div>
        <div class="con-notif__scope">
          <span class="con-notif__dim" v-i18n>{{ scopeLabel }}</span>
          <span v-if="beforeAfter !== undefined" class="con-notif__ba">{{ beforeAfter }}</span>
        </div>
      </template>

      <!-- Public card REVEAL / SHOW — the card names live in the journal as
           chips, so the console toast carries the summary + the ONE
           pad-operable path there ([View] Журнал). -->
      <template v-else-if="notification.reveal !== undefined">
        <div class="con-notif__line">
          <span class="con-notif__dim" v-i18n>{{ revealVerb }}</span>
          <b v-if="notification.reveal.cards.length === 1" class="con-notif__card">{{ $t(notification.reveal.cards[0]) }}</b>
          <span v-else class="con-notif__strong">{{ notification.reveal.cards.length }}&nbsp;<span v-i18n>cards</span></span>
          <span v-if="notification.reveal.origin === 'deck'" class="con-notif__result" v-i18n>{{ revealResultLabel }}</span>
        </div>
        <div class="con-notif__hint" aria-hidden="true">
          <GamepadGlyph control="view" /><span v-i18n>Log</span>
        </div>
      </template>

      <!-- Passive effect fired — the source card by NAME (details live in
           the ЭФФЕКТЫ overlay / journal; a console toast hosts no popover). -->
      <template v-else-if="notification.variant === 'passive-effect' && notification.effectCard !== undefined">
        <div class="con-notif__line">
          <b class="con-notif__card">{{ $t(notification.effectCard) }}</b>
        </div>
      </template>

      <!-- Coalesced burst. -->
      <template v-else-if="notification.groupCount !== undefined">
        <div class="con-notif__line">
          <span class="con-notif__strong"><span v-i18n>Events</span>: {{ notification.groupCount }}</span>
        </div>
      </template>

      <!-- Journal-derived headline (play / milestone / award / …) — the
           SAME token renderer as the journal (info parity); restyled to the
           console type scale and rendered INERT (a toast is information,
           never a click target). -->
      <span v-else-if="notification.header !== undefined" class="con-notif__line con-notif__tokens">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>

      <!-- Pass / generation highlight body. -->
      <span v-else-if="notification.bodyKey !== undefined" class="con-notif__line" v-i18n>{{ notification.bodyKey }}</span>
    </div>

    <!-- Net impact pills (hidden for hostile cards — the flow shows them). -->
    <div v-if="notification.pills.length > 0 && negative === undefined" class="con-notif__pills">
      <span v-for="(chip, i) in notification.pills"
            :key="i"
            class="con-notif__chip"
            :class="chipClass(chip)">
        <span class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
        <span>{{ chip.text }}</span>
      </span>
    </div>

    <!-- Lifetime shrink → auto-dismiss (the console toast has no close
         button — it is a transient, self-clearing information surface). -->
    <span v-if="showProgress"
          class="con-notif__progress"
          :style="{animationDuration: notification.ttl + 'ms'}"
          @animationend="$emit('dismiss', notification.id)"></span>
  </article>
</template>

<script lang="ts">
/**
 * CONSOLE transient notification card (P16) — the console-native
 * PRESENTATION of the same NotificationModel the desktop card renders.
 * One brain (NotificationLayer / notificationState / notificationModel,
 * TTLs, suppression, diffing) — two shells, mirroring ConsoleShell vs
 * PlayerHome. Deliberate differences from the desktop card:
 *  - NON-INTERACTIVE (pointer-events none): no ✕ / expand / CTA buttons a
 *    pad can't reach and a couch player can't hover — the journal (View)
 *    is the detail surface; reveal toasts advertise exactly that.
 *  - The HOSTILE essentials (attacker, source card, −X → +X flow,
 *    stock/production, before → after) render DIRECTLY — no expand step.
 *  - The variant ACCENT is inherited from the standalone
 *    `.notification-card--variant-*` rules (one accent vocabulary for
 *    both shells — they can never diverge); all CHROME is `con-notif`.
 */
import {defineComponent, PropType} from 'vue';
import {Log} from '@/common/logs/Log';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {LiveNotification, NotificationVariant, NegativeMeta} from '@/client/components/notifications/notificationTypes';

// Mirrors the desktop card: icon-key → PublicPlayerModel field (the victim's
// before → after readout for a single-resource loss).
const STOCK_FIELD: Readonly<Record<string, string>> = {
  megacredits: 'megacredits', steel: 'steel', titanium: 'titanium', plants: 'plants', energy: 'energy', heat: 'heat',
};
const PROD_FIELD: Readonly<Record<string, string>> = {
  megacredits: 'megacreditProduction', steel: 'steelProduction', titanium: 'titaniumProduction',
  plants: 'plantProduction', energy: 'energyProduction', heat: 'heatProduction',
};
// "What an opponent did" variants tint the rail in the actor colour;
// prestige / system variants keep the variant accent (same rule as desktop).
const ACTOR_RAIL_VARIANTS: ReadonlySet<NotificationVariant> = new Set<NotificationVariant>([
  'play-card', 'blue-action', 'standard-project', 'colony', 'hydronetwork', 'passive-effect', 'event', 'bot-turn',
]);

export default defineComponent({
  name: 'ConsoleNotificationCard',
  components: {JournalTokenRenderer, GamepadGlyph},
  props: {
    notification: {type: Object as PropType<LiveNotification>, required: true},
    players: {type: Array as () => ReadonlyArray<PublicPlayerModel>, required: true},
    viewerColor: {type: String as () => Color, default: undefined},
  },
  emits: ['dismiss'],
  computed: {
    negative(): NegativeMeta | undefined {
      return this.notification.negative;
    },
    prestige(): boolean {
      return this.notification.variant === 'milestone' || this.notification.variant === 'award';
    },
    actorName(): string {
      const a = this.notification.actor;
      if (a === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === a)?.name ?? a;
    },
    attackerName(): string {
      const a = this.notification.negative?.attacker;
      if (a === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === a)?.name ?? a;
    },
    scopeLabel(): string {
      return this.notification.negative?.scope === 'production' ? 'from production' : 'from stock';
    },
    revealVerb(): string {
      return this.notification.reveal?.origin === 'hand' ? 'showed from hand' : 'revealed from deck';
    },
    revealResultLabel(): string {
      switch (this.notification.reveal?.result) {
      case 'discarded': return 'discarded';
      case 'kept': return 'kept';
      case 'shown': return 'shown';
      default: return 'revealed';
      }
    },
    beforeAfter(): string | undefined {
      const neg = this.notification.negative;
      if (neg === undefined || neg.loss.length !== 1 || this.viewerColor === undefined) {
        return undefined;
      }
      const chip = neg.loss[0];
      const field = (neg.scope === 'production' ? PROD_FIELD : STOCK_FIELD)[chip.icon];
      if (field === undefined) {
        return undefined;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor) as unknown as Record<string, number> | undefined;
      const after = viewer?.[field];
      if (typeof after !== 'number') {
        return undefined;
      }
      const lossAbs = Math.abs(Number(chip.text.replace('−', '-')));
      if (Number.isNaN(lossAbs)) {
        return undefined;
      }
      return `${after + lossAbs} → ${after}`;
    },
    railColorClass(): string {
      const a = this.notification.actor;
      if (a !== undefined && ACTOR_RAIL_VARIANTS.has(this.notification.variant)) {
        return 'player_bg_color_' + a;
      }
      return '';
    },
    headerEntries(): ReadonlyArray<string | LogMessageData> {
      const h = this.notification.header;
      if (h === undefined) {
        return [];
      }
      return Log.parse({message: this.$t(h.message), data: h.data});
    },
    glyph(): string {
      switch (this.notification.variant) {
      case 'milestone': return '🏆';
      case 'award': return '🏅';
      case 'warning': return '⚠';
      case 'bot-turn': return '⌬';
      case 'generation': return '◆';
      case 'pass': return '⏻';
      case 'standard-project': return '⬡';
      case 'colony': return '◉';
      case 'hydronetwork': return '≈';
      case 'planetary-event': return '◬';
      case 'blue-action': return '⟳';
      case 'passive-effect': return '✦';
      case 'destroy': return '✖';
      case 'steal': return '⇢';
      case 'production-reduction': return '▼';
      case 'production-transfer': return '⇄';
      case 'vp-loss': return '★';
      case 'threat': return '⚠';
      case 'reveal-deck': return '◇';
      case 'reveal-hand': return '⊙';
      case 'play-card':
      case 'event':
      default: return '◈';
      }
    },
    metaLine(): string | undefined {
      if (this.notification.kind === 'important' && this.notification.typeLabelKey === 'New generation') {
        return `${this.$t('Generation')} ${this.notification.generation}`;
      }
      return undefined;
    },
    showProgress(): boolean {
      return !this.notification.persistent && this.notification.ttl > 0;
    },
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      return {
        'con-notif__chip--prod': chip.production === true,
        'con-notif__chip--saved': chip.saved === true,
        'con-notif__chip--neg': chip.production !== true && chip.saved !== true && chip.text.startsWith('−'),
        'con-notif__chip--pos': chip.production !== true && chip.saved !== true && chip.text.startsWith('+'),
      };
    },
  },
});
</script>
