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

      <!-- Coalesced burst: "<actor>: N events". -->
      <template v-if="notification.groupCount !== undefined">
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
    </div>

    <!-- ── Impact pills ──────────────────────────────────────────────────── -->
    <div v-if="notification.pills.length > 0" class="notification-card__pills">
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
    <footer v-if="notification.cta !== undefined || (canExpand && notification.expanded)" class="notification-card__foot">
      <button v-if="canExpand && notification.expanded"
              type="button"
              class="notification-card__less"
              @click.stop="$emit('toggle', notification.id)">
        <span class="notification-card__more-chevron notification-card__more-chevron--up" aria-hidden="true">⌄</span>
        <span v-i18n>Collapse</span>
      </button>
      <span class="notification-card__foot-spacer"></span>
      <button v-if="notification.cta !== undefined"
              type="button"
              class="notification-card__cta"
              @click.stop="$emit('cta', notification)">
        <span v-i18n>{{ notification.cta.labelKey }}</span>
        <span class="notification-card__cta-arrow" aria-hidden="true">→</span>
      </button>
    </footer>

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
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalChildRow from '@/client/components/journal/JournalChildRow.vue';
import {LiveNotification, NotificationVariant} from '@/client/components/notifications/notificationTypes';

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
  'play-card', 'blue-action', 'standard-project', 'colony', 'passive-effect', 'event',
]);

export default defineComponent({
  name: 'NotificationCard',
  components: {JournalTokenRenderer, JournalChildRow},
  props: {
    notification: {
      type: Object as PropType<LiveNotification>,
      required: true,
    },
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
  },
  emits: ['dismiss', 'toggle', 'cta'],
  data() {
    return {
      // Set once the player is active (only meaningful for the your-turn card).
      activityArmed: false,
      activityOrigin: undefined as {x: number; y: number} | undefined,
    };
  },
  computed: {
    canExpand(): boolean {
      return (this.notification.childVMs?.length ?? 0) > 0;
    },
    actorName(): string {
      const a = this.notification.actor;
      if (a === undefined) {
        return '';
      }
      return this.players.find((p) => p.color === a)?.name ?? a;
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
      case 'action-required': return '!';
      case 'your-turn': return '▸';
      case 'warning': return '⚠';
      case 'generation': return '◆';
      case 'pass': return '⏻';
      case 'standard-project': return '⬡';
      case 'colony': return '◉';
      case 'blue-action': return '⟳';
      case 'passive-effect': return '✦';
      case 'play-card':
      case 'event':
      default: return '◈';
      }
    },
    // A clear generation line (replaces the cryptic "G25" chip). Shown for the
    // your-turn card and the new-generation highlight.
    metaLine(): string | undefined {
      if (this.notification.kind === 'your-turn' ||
          (this.notification.kind === 'important' && this.notification.typeLabelKey === 'New generation')) {
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
    chipClass(chip: JournalImpactChip): Record<string, boolean> {
      return {
        'notification-card__chip--prod': chip.production === true,
        'notification-card__chip--saved': chip.saved === true,
        'notification-card__chip--neg': chip.production !== true && chip.saved !== true && chip.text.startsWith('−'),
        'notification-card__chip--pos': chip.production !== true && chip.saved !== true && chip.text.startsWith('+'),
      };
    },
    onCardClick(): void {
      if (this.canExpand) {
        this.$emit('toggle', this.notification.id);
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
