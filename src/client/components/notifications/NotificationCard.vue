<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <article
    class="notification-card"
    :class="[
      'notification-card--' + notification.kind,
      'notification-card--variant-' + notification.variant,
      {
        'notification-card--expanded': notification.expanded,
        'notification-card--persistent': notification.persistent,
        'notification-card--expandable': canExpand,
      },
    ]"
    role="status"
    :aria-label="ariaLabel"
    @click="onCardClick">
    <!-- Corner ticks — the shared sci-fi HUD frame. -->
    <span class="notification-card__tick notification-card__tick--tl" aria-hidden="true"></span>
    <span class="notification-card__tick notification-card__tick--br" aria-hidden="true"></span>

    <!-- Accent rail in the actor's colour (or, with no class, the kind accent). -->
    <span class="notification-card__rail" :class="railColorClass" aria-hidden="true"></span>

    <header class="notification-card__head">
      <span class="notification-card__type">
        <span class="notification-card__glyph" aria-hidden="true">{{ glyph }}</span>
        <span class="notification-card__type-label" v-i18n>{{ notification.typeLabelKey }}</span>
      </span>
      <span class="notification-card__time">{{ timeLabel }}</span>
      <button v-if="!notification.persistent"
              type="button"
              class="notification-card__close"
              :aria-label="$t('Dismiss')"
              @click.stop="$emit('dismiss', notification.id)">✕</button>
    </header>

    <!-- ── Main line ──────────────────────────────────────────────────────── -->
    <div class="notification-card__body">
      <!-- Clear generation line (your turn / new generation) — no cryptic "G25". -->
      <div v-if="metaLine !== undefined" class="notification-card__meta">{{ metaLine }}</div>

      <!-- ── HOSTILE loss the VIEWER suffered (destroy / steal / transfer / reduction). -->
      <template v-if="negative !== undefined">
        <!-- Who caused it. -->
        <div class="notification-card__neg-cause">
          <span class="notification-card__neg-by" v-i18n>Caused by</span>
          <span v-if="negative.attacker !== undefined"
                class="journal-player notification-card__actor"
                :class="'player_translucent_bg_color_' + negative.attacker">
            <span class="journal-player__dot" :class="'player_bg_color_' + negative.attacker" aria-hidden="true"></span>
            <span class="journal-player__name">{{ attackerName }}</span>
          </span>
          <JournalCardChip v-if="negative.sourceCard !== undefined" :name="negative.sourceCard" />
        </div>
        <!-- The loss (and, for steal/transfer, the attacker's gain). -->
        <div class="notification-card__neg-flow" :class="{'notification-card__neg-flow--transfer': negative.transfer}">
          <span class="notification-card__neg-side">
            <span class="notification-card__neg-who" v-i18n>You</span>
            <span v-for="(chip, i) in negative.loss" :key="'l' + i"
                  class="notification-card__chip notification-card__chip--neg"
                  :class="{'notification-card__chip--prod': chip.production === true}">
              <span class="notification-card__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
              <span class="notification-card__chip-amt">{{ chip.text }}</span>
            </span>
          </span>
          <template v-if="negative.transfer && negative.gain !== undefined">
            <span class="notification-card__neg-arrow" aria-hidden="true">→</span>
            <span class="notification-card__neg-side notification-card__neg-side--attacker">
              <span class="notification-card__neg-who">{{ attackerName }}</span>
              <span v-for="(chip, i) in negative.gain" :key="'g' + i"
                    class="notification-card__chip notification-card__chip--pos"
                    :class="{'notification-card__chip--prod': chip.production === true}">
                <span class="notification-card__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
                <span class="notification-card__chip-amt">{{ chip.text }}</span>
              </span>
            </span>
          </template>
        </div>
        <!-- Stock-vs-production marker + before → after. -->
        <div class="notification-card__neg-scope">
          <span class="notification-card__neg-tag" v-i18n>{{ scopeLabel }}</span>
          <span v-if="beforeAfter !== undefined" class="notification-card__neg-ba">{{ beforeAfter }}</span>
        </div>
      </template>

      <!-- Public card REVEAL / SHOW (another player publicly revealed/showed cards). -->
      <template v-else-if="notification.reveal !== undefined">
        <div class="notification-card__reveal-line">
          <span v-if="notification.actor !== undefined"
                class="journal-player notification-card__actor"
                :class="'player_translucent_bg_color_' + notification.actor">
            <span class="journal-player__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
            <span class="journal-player__name">{{ actorName }}</span>
          </span>
          <span class="notification-card__reveal-verb" v-i18n>{{ revealVerb }}</span>
        </div>
        <div class="notification-card__reveal-cards">
          <JournalCardChip v-if="notification.reveal.cards.length === 1" :name="notification.reveal.cards[0]" />
          <span v-else class="notification-card__reveal-count">{{ notification.reveal.cards.length }}&nbsp;<span v-i18n>cards</span></span>
          <span v-if="notification.reveal.origin === 'deck'" class="notification-card__reveal-result" v-i18n>{{ revealResultLabel }}</span>
        </div>
      </template>

      <!-- Passive effect fired — name + hover effect-block popover + click → details. -->
      <template v-else-if="notification.variant === 'passive-effect' && notification.effectCard !== undefined">
        <span v-if="notification.actor !== undefined"
              class="journal-player notification-card__actor"
              :class="'player_translucent_bg_color_' + notification.actor">
          <span class="journal-player__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
          <span class="journal-player__name">{{ actorName }}</span>
        </span>
        <button type="button"
                ref="effectChip"
                class="notification-card__effect-chip"
                @mouseenter="onEffectHover"
                @mouseleave="onEffectLeave"
                @focus="onEffectHover"
                @blur="onEffectLeave"
                @click.stop="onEffectClick">
          <span class="notification-card__effect-name" v-i18n>{{ notification.effectCard }}</span>
          <span class="notification-card__effect-hint" v-i18n>Details</span>
        </button>
      </template>

      <!-- Coalesced burst: "<actor>: N events". -->
      <template v-else-if="notification.groupCount !== undefined">
        <span v-if="notification.actor !== undefined"
              class="journal-player notification-card__actor"
              :class="'player_translucent_bg_color_' + notification.actor">
          <span class="journal-player__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
          <span class="journal-player__name">{{ actorName }}</span>
        </span>
        <span class="notification-card__count-line"><span v-i18n>Events</span>:&nbsp;{{ notification.groupCount }}</span>
      </template>

      <!-- Journal-derived headline (normal / milestone / award). -->
      <span v-else-if="notification.header !== undefined" class="notification-card__headline">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>

      <!-- Your turn. -->
      <span v-else-if="notification.kind === 'your-turn'" class="notification-card__turn-line">
        <span v-if="notification.bodyKey !== undefined" v-i18n>{{ notification.bodyKey }}</span>
      </span>

      <!-- Action required — the prompt (tokens or plain). -->
      <span v-else-if="promptEntries !== undefined" class="notification-card__prompt">
        <JournalTokenRenderer
          v-for="(tok, i) in promptEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>
      <span v-else-if="promptText !== undefined" class="notification-card__prompt" v-i18n>{{ promptText }}</span>

      <!-- Pass / generation highlight body, with actor chip when present. -->
      <span v-else-if="notification.bodyKey !== undefined" class="notification-card__highlight-line">
        <span v-if="notification.actor !== undefined"
              class="journal-player notification-card__actor"
              :class="'player_translucent_bg_color_' + notification.actor">
          <span class="journal-player__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
          <span class="journal-player__name">{{ actorName }}</span>
        </span>
        <span v-i18n>{{ notification.bodyKey }}</span>
      </span>

      <!-- Compact OUTCOME lines (the AI-turn card): the turn's own key log
           lines — placements / parameter raises / losses / failed-action
           money. A SPACE token keeps its «показать» affordance; the full
           script lives in the detailed inspect («Осмотреть»). -->
      <ul v-if="notification.summaryLines !== undefined" class="notification-card__summary">
        <li v-for="(line, i) in notification.summaryLines" :key="i" class="notification-card__summary-line">
          <span class="notification-card__summary-tick" aria-hidden="true"></span>
          <span class="notification-card__summary-body">
            <JournalTokenRenderer
              v-for="(tok, j) in lineEntries(line)"
              :key="j"
              :token="tok"
              :players="players" />
          </span>
        </li>
        <li v-if="notification.summaryOverflow !== undefined" class="notification-card__summary-line notification-card__summary-line--more">
          <span class="notification-card__summary-tick" aria-hidden="true"></span>
          <span class="notification-card__summary-body">+{{ notification.summaryOverflow }}&nbsp;<span v-i18n>events</span></span>
        </li>
      </ul>
    </div>

    <!-- ── Impact pills (hidden for hostile cards — the neg-flow shows them). -->
    <div v-if="notification.pills.length > 0 && negative === undefined" class="notification-card__pills">
      <span v-for="(chip, i) in notification.pills"
            :key="i"
            class="notification-card__chip"
            :class="chipClass(chip)">
        <span class="notification-card__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
        <span class="notification-card__chip-amt">{{ chip.text }}</span>
      </span>
      <button v-if="canExpand && !notification.expanded"
              type="button"
              class="notification-card__more-pill"
              @click.stop="$emit('toggle', notification.id)">
        <span class="notification-card__more-chevron" aria-hidden="true">⌄</span>
        <span v-i18n>More details</span>
        <span class="notification-card__more-count">{{ notification.detailCount }}</span>
      </button>
    </div>

    <!-- ── Expanded breakdown (reuses the journal child rows) ────────────── -->
    <Transition name="notification-detail">
      <div v-if="notification.expanded && canExpand" class="notification-card__detail">
        <ul class="notification-card__rows">
          <li v-for="(vm, i) in notification.childVMs"
              :key="i"
              class="notification-card__row">
            <JournalChildRow :vm="vm" :players="players" />
          </li>
        </ul>
      </div>
    </Transition>

    <!-- ── Footer / CTA ──────────────────────────────────────────────────── -->
    <footer v-if="notification.cta !== undefined || notification.cancelCta !== undefined || (canExpand && notification.expanded)" class="notification-card__foot">
      <button v-if="canExpand && notification.expanded"
              type="button"
              class="notification-card__less"
              @click.stop="$emit('toggle', notification.id)">
        <span class="notification-card__more-chevron notification-card__more-chevron--up" aria-hidden="true">⌄</span>
        <span v-i18n>Collapse</span>
      </button>
      <span class="notification-card__foot-spacer"></span>
      <!-- Calm secondary "Cancel" — a safe path back from a not-yet-committed
           pending placement; deliberately quieter than the primary CTA. -->
      <button v-if="notification.cancelCta !== undefined"
              type="button"
              class="notification-card__cta notification-card__cta--cancel"
              @click.stop="$emit('cancel', notification)">
        <span v-i18n>{{ notification.cancelCta.labelKey }}</span>
      </button>
      <!-- Calm ghost secondary (e.g. «В журнал» on the AI-turn card). -->
      <button v-if="notification.secondaryCta !== undefined"
              type="button"
              class="notification-card__cta notification-card__cta--ghost"
              @click.stop="$emit('cta-secondary', notification)">
        <span v-i18n>{{ notification.secondaryCta.labelKey }}</span>
      </button>
      <button v-if="notification.cta !== undefined"
              type="button"
              class="notification-card__cta"
              :class="{'notification-card__cta--ghost': notification.cta.action === 'open-journal'}"
              @click.stop="$emit('cta', notification)">
        <span v-i18n>{{ notification.cta.labelKey }}</span>
        <span v-if="notification.cta.action !== 'open-journal'" class="notification-card__cta-arrow" aria-hidden="true">→</span>
      </button>
    </footer>

    <!-- Hover popover with the passive-effect block (same style as the Эффекты overlay). -->
    <EffectPreviewPopover
      v-if="notification.variant === 'passive-effect'"
      :name="notification.effectCard"
      :anchor="effectAnchor"
      :visible="effectHover" />

    <!-- Lifetime indicator — a CSS-driven shrink (pauses on hover / expanded via
         CSS); animationend → auto-dismiss. Persistent cards have none — EXCEPT
         the YOUR-TURN card, which arms a countdown once the player is active. -->
    <span v-if="showProgress"
          class="notification-card__progress"
          :style="{animationDuration: effectiveTtl + 'ms'}"
          @animationend="$emit('dismiss', notification.id)"></span>
  </article>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Message} from '@/common/logs/Message';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import EffectPreviewPopover from '@/client/components/notifications/EffectPreviewPopover.vue';
import {openEffectDetail} from '@/client/components/notifications/effectDetailState';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import {LiveNotification, NotificationVariant, NegativeMeta} from '@/client/components/notifications/notificationTypes';

// Icon-key → PublicPlayerModel field (irregular: megacredit/plant production drop
// the plural 's'). Used to show the victim's before → after value.
const STOCK_FIELD: Readonly<Record<string, string>> = {
  megacredits: 'megacredits', steel: 'steel', titanium: 'titanium', plants: 'plants', energy: 'energy', heat: 'heat',
};
const PROD_FIELD: Readonly<Record<string, string>> = {
  megacredits: 'megacreditProduction', steel: 'steelProduction', titanium: 'titaniumProduction',
  plants: 'plantProduction', energy: 'energyProduction', heat: 'heatProduction',
};

/**
 * One premium notification card. Compact by default (type label + headline +
 * impact pills + a CTA); click to EXPAND the breakdown — which reuses the
 * journal's own `JournalChildRow` so the card and the journal never diverge.
 * The lifetime indicator + auto-dismiss are CSS-driven (paused on hover /
 * expand via CSS, so no per-frame JS), persistent for turn cards.
 *
 * Emits: `dismiss(id)`, `toggle(id)`, `cta(notification)`.
 */
// How long the YOUR-TURN card lingers AFTER the player becomes active (moves /
// types / clicks) before it auto-dismisses — once they're clearly playing it
// should get out of the way fast (~40% shorter than the feed cards per user
// feedback).
const YOUR_TURN_ACTIVITY_TTL = 3000;
// Tiny pointer travel is debounced so a stray 1-px jitter doesn't arm the timer.
const ACTIVITY_MOVE_THRESHOLD = 6;
// Variants that read as "what an opponent just did" — their rail is tinted in
// the actor's player colour. Prestige / system variants keep their own accent.
const ACTOR_RAIL_VARIANTS: ReadonlySet<NotificationVariant> = new Set<NotificationVariant>([
  'play-card', 'blue-action', 'standard-project', 'colony', 'hydronetwork', 'passive-effect', 'event', 'bot-turn',
]);

export default defineComponent({
  name: 'NotificationCard',
  components: {JournalTokenRenderer, JournalChildRow, JournalCardChip, EffectPreviewPopover},
  props: {
    notification: {
      type: Object as PropType<LiveNotification>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    viewerColor: {
      type: String as () => Color,
      default: undefined,
    },
  },
  emits: ['dismiss', 'toggle', 'cta', 'cta-secondary', 'cancel'],
  data() {
    return {
      // Set once the player is active (only meaningful for the your-turn card).
      activityArmed: false,
      activityOrigin: undefined as {x: number; y: number} | undefined,
      // Passive-effect hover popover state.
      effectHover: false,
      effectAnchor: undefined as DOMRect | undefined,
    };
  },
  computed: {
    canExpand(): boolean {
      return (this.notification.childVMs?.length ?? 0) > 0;
    },
    negative(): NegativeMeta | undefined {
      return this.notification.negative;
    },
    attackerName(): string {
      const a = this.notification.negative?.attacker;
      if (a === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === a);
      return player !== undefined ? participantDisplayName(player) : a;
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
    // Victim before → after for a SINGLE-resource loss (the common case), read
    // from the viewer's CURRENT (post-attack) value + the loss amount.
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
    actorName(): string {
      const a = this.notification.actor;
      if (a === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === a);
      return player !== undefined ? participantDisplayName(player) : a;
    },
    railColorClass(): string {
      // Ordinary "what an opponent did" events tint the rail in the actor's
      // colour (reusing the global `player_bg_color_*` class). Prestige / system
      // variants (milestone / award / generation / pass / turn / warning) keep
      // their own variant accent from CSS so the type reads at a glance.
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
    promptEntries(): ReadonlyArray<string | LogMessageData> | undefined {
      const p = this.notification.prompt;
      if (p === undefined || typeof p === 'string') {
        return undefined;
      }
      const msg = p as Message;
      return Log.parse({message: this.$t(msg.message), data: msg.data});
    },
    promptText(): string | undefined {
      const p = this.notification.prompt;
      return typeof p === 'string' ? p : undefined;
    },
    glyph(): string {
      switch (this.notification.variant) {
      case 'milestone': return '🏆';
      case 'award': return '🏅';
      case 'terraforming-complete': return '❂';
      case 'action-required': return '!';
      case 'your-turn': return '▸';
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
    // A clear generation line (replaces the cryptic "G25" chip). Shown for the
    // your-turn card and the new-generation highlight.
    metaLine(): string | undefined {
      if (this.notification.kind === 'your-turn' ||
          (this.notification.kind === 'important' && this.notification.typeLabelKey === 'New generation') ||
          this.notification.variant === 'terraforming-complete') {
        return `${this.$t('Generation')} ${this.notification.generation}`;
      }
      return undefined;
    },
    // YOUR TURN is persistent UNTIL the player is active — once they move / type /
    // click, a countdown arms (so the card fades when they start playing, but
    // stays put if they're AFK). Other persistent cards (action-required) never
    // auto-dismiss.
    armsOnActivity(): boolean {
      return this.notification.kind === 'your-turn';
    },
    effectivePersistent(): boolean {
      if (this.armsOnActivity) {
        return !this.activityArmed; // persistent until activity arms the timer
      }
      return this.notification.persistent;
    },
    showProgress(): boolean {
      return !this.effectivePersistent;
    },
    effectiveTtl(): number {
      if (this.armsOnActivity && this.activityArmed) {
        return YOUR_TURN_ACTIVITY_TTL;
      }
      return this.notification.ttl;
    },
    timeLabel(): string {
      const d = new Date(this.notification.createdAt);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
    ariaLabel(): string {
      return this.$t(this.notification.typeLabelKey);
    },
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    // One compact outcome line (summaryLines) → journal tokens.
    lineEntries(line: LogMessage): ReadonlyArray<string | LogMessageData> {
      return Log.parse({message: this.$t(line.message), data: line.data});
    },
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      const plain = chip.production !== true && chip.saved !== true && chip.neutral !== true;
      return {
        'notification-card__chip--prod': chip.production === true,
        'notification-card__chip--saved': chip.saved === true,
        'notification-card__chip--neutral': chip.neutral === true,
        'notification-card__chip--neg': plain && chip.text.startsWith('−'),
        'notification-card__chip--pos': plain && chip.text.startsWith('+'),
      };
    },
    onCardClick(): void {
      if (this.canExpand) {
        this.$emit('toggle', this.notification.id);
      }
    },
    onEffectHover(): void {
      const el = this.$refs.effectChip as HTMLElement | undefined;
      this.effectAnchor = el?.getBoundingClientRect();
      this.effectHover = true;
    },
    onEffectLeave(): void {
      this.effectHover = false;
    },
    onEffectClick(): void {
      if (this.notification.effectCard !== undefined) {
        openEffectDetail(this.notification.effectCard, this.notification.actor);
      }
    },
    // Arm the your-turn countdown on the FIRST meaningful player activity.
    onActivity(e: Event): void {
      if (this.activityArmed) {
        return;
      }
      if (e.type === 'pointermove') {
        const pe = e as PointerEvent;
        if (this.activityOrigin === undefined) {
          this.activityOrigin = {x: pe.clientX, y: pe.clientY};
          return; // first sample — wait for real travel, not a 1-px settle
        }
        const dx = pe.clientX - this.activityOrigin.x;
        const dy = pe.clientY - this.activityOrigin.y;
        if (Math.hypot(dx, dy) < ACTIVITY_MOVE_THRESHOLD) {
          return;
        }
      }
      this.activityArmed = true;
      this.removeActivityListeners();
    },
    addActivityListeners(): void {
      window.addEventListener('pointermove', this.onActivity, {passive: true});
      window.addEventListener('pointerdown', this.onActivity, {passive: true});
      window.addEventListener('keydown', this.onActivity);
      window.addEventListener('wheel', this.onActivity, {passive: true});
    },
    removeActivityListeners(): void {
      window.removeEventListener('pointermove', this.onActivity);
      window.removeEventListener('pointerdown', this.onActivity);
      window.removeEventListener('keydown', this.onActivity);
      window.removeEventListener('wheel', this.onActivity);
    },
  },
  mounted(): void {
    if (this.armsOnActivity) {
      this.addActivityListeners();
    }
  },
  beforeUnmount(): void {
    this.removeActivityListeners();
  },
});
</script>
