<template>
  <article class="con-notif"
           :class="[
             'notification-card--variant-' + notification.variant,
             'con-notif--' + notification.kind,
             'con-notif--sign-' + notification.sign,
             'con-notif--imp-' + notification.importance,
             {'con-notif--prestige': prestige, 'con-notif--holding': notification.holdsFlow === true, 'con-notif--hold-active': holdActive},
           ]"
           :data-notif-id="notification.id"
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

      <!-- ── THE VIEWER BAND — what changed FOR YOU, first and loudest. ──
           The sign is stated three ways at once (label + glyph + tone), so
           positive / negative / mixed never rely on colour alone. Losses
           lead (a loss must not be missed), the transfer arrow names who
           took it, gains follow. -->
      <div v-if="impactBand !== undefined" class="con-notif__you" :class="'con-notif__you--' + notification.sign">
        <span class="con-notif__you-sign">
          <span class="con-notif__you-glyph" aria-hidden="true">{{ signGlyph }}</span>
          <span v-i18n>{{ signLabel }}</span>
        </span>
        <span class="con-notif__you-chips">
          <span v-for="(chip, i) in impactBand.losses" :key="'l' + i"
                class="con-notif__chip con-notif__chip--neg con-notif__chip--big"
                :class="{'con-notif__chip--prod': chip.production === true}">
            <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
            <span>{{ chip.text }}</span>
            <span v-if="chipUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ chipUnit(chip) }}</span>
          </span>
          <template v-if="impactBand.transfer === true && impactBand.attacker !== undefined">
            <span class="con-notif__arrow" aria-hidden="true">→</span>
            <span class="con-notif__side">
              <span class="con-notif__dot" :class="'player_bg_color_' + impactBand.attacker" aria-hidden="true"></span>
              <span class="con-notif__who">{{ attackerName }}</span>
            </span>
          </template>
          <span v-for="(chip, i) in impactBand.gains" :key="'g' + i"
                class="con-notif__chip con-notif__chip--pos con-notif__chip--big"
                :class="{'con-notif__chip--prod': chip.production === true}">
            <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
            <span>{{ chip.text }}</span>
            <span v-if="chipUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ chipUnit(chip) }}</span>
          </span>
        </span>
        <!-- The honest readout of a single-resource loss: scope + before → after. -->
        <div v-if="impactBand.losses.length > 0" class="con-notif__scope">
          <span class="con-notif__dim" v-i18n>{{ scopeLabel }}</span>
          <span v-if="beforeAfter !== undefined" class="con-notif__ba">{{ beforeAfter }}</span>
        </div>
      </div>

      <!-- ── THE CAUSE LINE — who did it, with what (secondary voice). ──
           Only when the viewer band leads: the initiator is the reason, not
           the story. The bot card keeps its own headline instead. -->
      <div v-if="impactBand !== undefined && showCause" class="con-notif__cause">
        <span class="con-notif__dim" v-i18n>Caused by</span>
        <span v-if="notification.actor !== undefined" class="con-notif__actor">
          <span class="con-notif__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
          <span>{{ actorName }}</span>
        </span>
        <!-- WHOSE card it is decides how the line reads. An attack names the
             ATTACKER's card right after them; a passive payout names one of the
             VIEWER's own, and without the «Источник» qualifier the same
             position would claim the opponent holds it. -->
        <span v-if="impactBand.ownSource === true" class="con-notif__dim" v-i18n>Source</span>
        <b v-if="impactBand.sourceCard !== undefined" class="con-notif__card">{{ $t(impactBand.sourceCard) }}</b>
      </div>

      <!-- Passive effect fired — the source card by NAME (details live in
           the ЭФФЕКТЫ overlay / journal; a console toast hosts no popover). -->
      <template v-if="impactBand === undefined && notification.variant === 'passive-effect' && notification.effectCard !== undefined">
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
           never a click target). When the viewer band leads, the headline is
           replaced by the compact cause line above (the initiator is the
           reason, not the story). -->
      <span v-else-if="notification.header !== undefined && impactBand === undefined"
            class="con-notif__line con-notif__tokens">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>

      <!-- Pass / generation highlight body. -->
      <span v-else-if="notification.bodyKey !== undefined" class="con-notif__line" v-i18n>{{ notification.bodyKey }}</span>

      <!-- Plain PROMPT text (`pushWarning` and every other model whose whole
           content is the prompt). -->
      <span v-else-if="promptText !== ''" class="con-notif__line">{{ promptText }}</span>

      <!-- Public card REVEAL / SHOW — the consequence line (folded into the
           action's own card when the reveal rode a root chain; the whole
           story for a standalone reveal card). -->
      <div v-if="notification.reveal !== undefined" class="con-notif__line con-notif__revealline">
        <span class="con-notif__dim" v-i18n>{{ revealVerb }}</span>
        <b v-if="notification.reveal.cards.length === 1" class="con-notif__card">{{ $t(notification.reveal.cards[0]) }}</b>
        <span v-else class="con-notif__strong">{{ notification.reveal.cards.length }}&nbsp;<span v-i18n>cards</span></span>
        <span v-if="notification.reveal.origin === 'deck'" class="con-notif__result" v-i18n>{{ revealResultLabel }}</span>
      </div>

      <!-- Compact OUTCOME lines (the AI-turn card): the turn's own key log
           lines — placements / parameter raises / losses / failed-action
           money. Rendered INERT; the full script is the X-hold review. -->
      <ul v-if="notification.summaryLines !== undefined" class="con-notif__summary">
        <li v-for="(line, i) in notification.summaryLines" :key="i" class="con-notif__summary-line">
          <span class="con-notif__summary-tick" aria-hidden="true"></span>
          <span class="con-notif__tokens">
            <JournalTokenRenderer
              v-for="(tok, j) in lineEntries(line)"
              :key="j"
              :token="tok"
              :players="players" />
          </span>
        </li>
        <li v-if="notification.summaryOverflow !== undefined" class="con-notif__summary-line con-notif__summary-line--more">
          <span class="con-notif__summary-tick" aria-hidden="true"></span>
          <span>+{{ notification.summaryOverflow }}&nbsp;<span v-i18n>events</span></span>
        </li>
      </ul>
    </div>

    <!-- CONTEXT pills — the action's own outcome. Suppressed for a loss /
         mixed card (the band + cause carry the story; the journal has the
         ledger), kept for neutral events and under a positive band. -->
    <div v-if="showContextPills" class="con-notif__pills">
      <span v-for="(chip, i) in notification.pills"
            :key="i"
            class="con-notif__chip"
            :class="chipClass(chip)">
        <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
        <span>{{ chip.text }}</span>
        <span v-if="chipUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ chipUnit(chip) }}</span>
      </span>
    </div>

    <!-- Pad contract ON the card (its own hints — the command bar keeps the
         CURRENT screen's contract, a toast never re-labels it): the DETAIL
         action first, when the card has one (press-and-HOLD X — a single tap
         keeps its normal screen meaning; the fill plate mirrors the input
         timer 1:1), then the global «B Закрыть». -->
    <footer class="con-notif__actions" aria-hidden="true">
      <span v-if="hasDetailAction"
            class="con-notif__action con-notif__action--detail"
            :class="{'con-notif__action--filling': holdActive}">
        <!-- Hold progress: duration = NOTIF_HOLD_MS (the INPUT threshold), so
             the visual fill and the hold timer cannot drift. Deliberately not
             motion-scaled — input ergonomics, not choreography. -->
        <span v-if="holdActive" class="con-notif__action-fill" :style="{animationDuration: holdMs + 'ms'}"></span>
        <span class="con-notif__action-hold" v-i18n>Hold</span>
        <GamepadGlyph control="secondary" />
        <span v-i18n>{{ detailLabel }}</span>
      </span>
      <!-- «B Закрыть» — a visible toast OVERRIDES B wherever it shows (the
           shell consumes the press and closes the card; the screen's own
           back/minimize is the NEXT B). One contract, one hint, everywhere. -->
      <span class="con-notif__action con-notif__action--close">
        <GamepadGlyph control="back" />
        <span v-i18n>Close</span>
      </span>
    </footer>

    <!-- Lifetime shrink → auto-dismiss. The toast self-clears when it runs
         out; the player can close it early with B («B Закрыть» above). The
         shrink PAUSES while an X-hold fills (.con-notif--hold-active). -->
    <span v-if="showProgress"
          class="con-notif__progress"
          :style="{animationDuration: notification.ttl + 'ms'}"
          @animationend="$emit('dismiss', notification.id)"></span>
  </article>
</template>

<script lang="ts">
/**
 * CONSOLE transient notification card — the console-native presentation of
 * the shared NotificationModel (one brain: NotificationLayer /
 * notificationState / notificationModel; TTLs, suppression, diffing).
 *
 * INFORMATION HIERARCHY (the viewer-first contract):
 *  1. the VIEWER BAND — «Вы получили / Вы потеряли …», the viewer's own typed
 *     deltas, sign stated by label + glyph + tone (never colour alone);
 *  2. the CAUSE line — who did it, with what card (secondary voice);
 *  3. the event's own story (headline tokens / reveal line / outcome lines) —
 *     the primary voice ONLY when nothing personal happened;
 *  4. context pills + the journal (X-hold) for the full causal chain.
 *
 * The two semantic AXES render as independent channels: `sign` drives the
 * band's identity, `importance` drives the card's chrome grade
 * (`.con-notif--imp-*`: ambient / notable / critical / attention).
 *
 * Deliberate console properties (unchanged): NON-INTERACTIVE
 * (pointer-events none) — the pad contract lives ON the card
 * (`.con-notif__actions`): press-and-HOLD X = the detail action (bot-turn
 * review, or the journal AT this event), B = close. The variant ACCENT is
 * inherited from the standalone `.notification-card--variant-*` rules (one
 * accent vocabulary for both shells).
 */
import {defineComponent, PropType} from 'vue';
import {Log} from '@/common/logs/Log';
import {translateMessage} from '@/client/directives/i18n';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Color} from '@/common/Color';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {NOTIF_HOLD_MS, notifHoldState} from '@/client/console/consoleNotifHold';
import {ViewerImpactMeta} from '@/client/components/notifications/notificationSemantics';
import {LiveNotification, NotificationVariant} from '@/client/components/notifications/notificationTypes';

// icon-key → PublicPlayerModel field (the viewer's before → after readout
// for a single-resource loss).
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
    /** The viewer band — present exactly when something personal happened. */
    impactBand(): ViewerImpactMeta | undefined {
      const impact = this.notification.viewerImpact;
      if (impact === undefined || impact.sign === 'neutral') {
        return undefined;
      }
      return impact;
    },
    prestige(): boolean {
      return this.notification.variant === 'milestone' || this.notification.variant === 'award';
    },
    actorName(): string {
      const a = this.notification.actor;
      if (a === undefined) {
        return '';
      }
      return displayNameForColor(this.players, a);
    },
    attackerName(): string {
      const a = this.impactBand?.attacker;
      if (a === undefined) {
        return '';
      }
      return displayNameForColor(this.players, a);
    },
    /** The sign, spoken (i18n keys — a channel colour can never carry alone). */
    signLabel(): string {
      switch (this.notification.sign) {
      case 'positive': return 'You gained';
      case 'negative': return 'You lost';
      default: return 'For you';
      }
    },
    signGlyph(): string {
      switch (this.notification.sign) {
      case 'positive': return '▲';
      case 'negative': return '▼';
      default: return '⇄';
      }
    },
    /** The cause line — for journal-rooted cards; the bot card has its own headline. */
    showCause(): boolean {
      return this.notification.variant !== 'bot-turn' &&
        (this.notification.actor !== undefined || this.impactBand?.sourceCard !== undefined);
    },
    /** Context pills stay for neutral events and under a positive band; a loss /
     *  mixed card drops them (the band + cause carry the story). */
    showContextPills(): boolean {
      if (this.notification.pills.length === 0) {
        return false;
      }
      return this.notification.sign === 'neutral' || this.notification.sign === 'positive';
    },
    scopeLabel(): string {
      return this.impactBand?.scope === 'production' ? 'from production' : 'from stock';
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
      const band = this.impactBand;
      if (band === undefined || band.losses.length !== 1 || this.viewerColor === undefined) {
        return undefined;
      }
      const chip = band.losses[0];
      const field = (band.scope === 'production' ? PROD_FIELD : STOCK_FIELD)[chip.icon];
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
    /** The prompt as text — a plain string or a tokenised `Message`. */
    promptText(): string {
      const p = this.notification.prompt;
      if (p === undefined) {
        return '';
      }
      return typeof p === 'string' ? this.$t(p) : translateMessage(p);
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
    /** The toast's DETAIL action: the AI-turn review, or the journal AT this
     *  event (any card carrying a correlationId — the full causal chain). */
    hasDetailAction(): boolean {
      if (this.notification.holdsFlow === true && this.notification.botTurnKey !== undefined) {
        return true;
      }
      return this.notification.correlationId !== undefined;
    },
    detailLabel(): string {
      return this.notification.holdsFlow === true && this.notification.botTurnKey !== undefined ?
        'Watch turn' : 'Log';
    },
    /** The X-hold on THIS card is filling (shell-tracked, module-reactive). */
    holdActive(): boolean {
      return notifHoldState.noteId === this.notification.id;
    },
    holdMs(): number {
      return NOTIF_HOLD_MS;
    },
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    /** Sprite-less chips speak their unit as text (VP has no inline icon). */
    chipUnit(chip: JournalImpactChip): string | undefined {
      return chip.icon === 'vp' ? 'VP' : undefined;
    },
    // One compact outcome line (summaryLines) → journal tokens.
    lineEntries(line: LogMessage): ReadonlyArray<string | LogMessageData> {
      return Log.parse({message: this.$t(line.message), data: line.data});
    },
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      const plain = chip.production !== true && chip.saved !== true && chip.neutral !== true;
      return {
        'con-notif__chip--prod': chip.production === true,
        'con-notif__chip--saved': chip.saved === true,
        'con-notif__chip--neutral': chip.neutral === true,
        'con-notif__chip--neg': plain && chip.text.startsWith('−'),
        'con-notif__chip--pos': plain && chip.text.startsWith('+'),
      };
    },
  },
});
</script>
