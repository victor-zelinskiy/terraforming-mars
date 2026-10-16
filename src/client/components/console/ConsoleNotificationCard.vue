<template>
  <!-- TR59 «ОДИН ВЗГЛЯД»: a toast lives a few seconds and answers THREE questions at a glance — what changed for
       YOU (the hero band, the card's largest numbers), WHY (one cause line: your tile / card / colony, or the
       attacker's card · the trigger · the actor's move), WHOSE turn (the head's actor chip, the ONE place the
       actor is named). Everything else is quiet (one line of what the actor got) or the journal's (hold X). -->
  <article class="con-notif"
           :class="[
             'notification-card--variant-' + notification.variant,
             'con-notif--' + notification.kind,
             'con-notif--sign-' + notification.sign,
             'con-notif--imp-' + notification.importance,
             {'con-notif--prestige': prestige, 'con-notif--holding': notification.holdsFlow === true, 'con-notif--hold-active': holdActive, 'con-notif--banded': impactBand !== undefined},
           ]"
           :data-notif-id="notification.id"
           role="status"
           :aria-label="$t(notification.typeLabelKey)">
    <span class="con-notif__rail" :class="railColorClass" aria-hidden="true"></span>

    <header class="con-notif__head">
      <span class="con-notif__glyph" aria-hidden="true">{{ glyph }}</span>
      <!-- THE KICKER — the type label, and for a card action whose headline the band displaced, the CARD (PL-150).
           With the headline on screen the card is named THERE — once (TR59). -->
      <span class="con-notif__kicker" :class="{'con-notif__kicker--card': kickerCard !== undefined}">
        <span class="con-notif__type" v-i18n>{{ notification.typeLabelKey }}</span>
        <span v-if="kickerCard !== undefined" class="con-notif__type-card" data-notif-type-card>{{ $t(kickerCard) }}</span>
      </span>
      <!-- WHOSE TURN — the actor, named here and nowhere else on the card. -->
      <span v-if="notification.actor !== undefined" class="con-notif__actor" data-notif-actor>
        <span class="con-notif__dot" :class="'player_bg_color_' + notification.actor" aria-hidden="true"></span>
        <span class="con-notif__actor-name">{{ actorName }}</span>
      </span>
    </header>

    <div class="con-notif__body">
      <div v-if="metaLine !== undefined" class="con-notif__meta">{{ metaLine }}</div>

      <!-- ── THE HERO BAND — what changed FOR YOU: the card's largest numbers, the sign stated three ways (label +
           glyph + tone), losses first, the transfer arrow to whoever took it, gains after. One delta shares the
           label's line; several wrap under it. -->
      <div v-if="impactBand !== undefined"
           class="con-notif__you"
           :class="['con-notif__you--' + notification.sign, {'con-notif__you--dense': bandDense}]">
        <span class="con-notif__you-sign">
          <span class="con-notif__you-glyph" aria-hidden="true">{{ signGlyph }}</span>
          <span v-i18n>{{ signLabel }}</span>
        </span>
        <span class="con-notif__you-chips">
          <span v-for="(chip, i) in impactBand.losses" :key="'l' + i"
                class="con-notif__chip con-notif__chip--neg con-notif__chip--big"
                :class="{'con-notif__chip--prod': chip.production === true}">
            <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
            <span v-if="bandUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ bandUnit(chip) }}</span>
            <span class="con-notif__chip-value">{{ chip.text }}</span>
          </span>
          <!-- The transfer: the arrow and WHO took it — the dot alone when that is the actor (the head named them). -->
          <template v-if="impactBand.transfer === true && impactBand.attacker !== undefined">
            <span class="con-notif__arrow" aria-hidden="true">→</span>
            <span class="con-notif__side">
              <span class="con-notif__dot" :class="'player_bg_color_' + impactBand.attacker" aria-hidden="true"></span>
              <span v-if="impactBand.attacker !== notification.actor" class="con-notif__who">{{ attackerName }}</span>
            </span>
          </template>
          <span v-for="(chip, i) in impactBand.gains" :key="'g' + i"
                class="con-notif__chip con-notif__chip--pos con-notif__chip--big"
                :class="{'con-notif__chip--prod': chip.production === true}">
            <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
            <span v-if="bandUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ bandUnit(chip) }}</span>
            <span class="con-notif__chip-value">{{ chip.text }}</span>
          </span>
        </span>
      </div>

      <!-- ── WHY — one line per cause, hanging off the band: the anchor naming WHAT OF YOURS paid («ВАШ ТАЙЛ» /
           «ВАША КАРТА» / «ВАША КОРПОРАЦИЯ» / «ВАША КОЛОНИЯ») or «ИСТОЧНИК» for what is not yours (an attack, a law),
           the name as the accent, the trigger, then the actor's MOVE as a quiet tail («ход: Купольный кратер» —
           the trigger, never the source). Several causes each carry their own chips. -->
      <div v-if="impactBand !== undefined && causeLines.length > 0"
           class="con-notif__why"
           :class="'con-notif__why--' + notification.sign">
        <div v-for="(line, i) in causeLines" :key="i" class="con-notif__cause" :data-cause-label="line.labelKey">
          <span v-if="line.chips !== undefined && line.chips.length > 0" class="con-notif__cause-chips">
            <span v-for="(chip, j) in line.chips" :key="j"
                  class="con-notif__chip con-notif__chip--mini" :class="chipClass(chip)">
              <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
              <span>{{ chip.text }}</span>
            </span>
          </span>
          <span class="con-notif__cause-label" v-i18n>{{ line.labelKey }}</span>
          <b class="con-notif__card">{{ $t(line.nameKey) }}</b>
          <!-- The quiet tails on a line of their own — the detail, the trigger, the actor's move — separated BETWEEN
               each other, never a separator stranded at a wrapped line's start. -->
          <span v-if="line.detailKey !== undefined || line.triggerKey !== undefined || line.viaKey !== undefined" class="con-notif__cause-tails">
            <span v-if="line.detailKey !== undefined" class="con-notif__cause-tail con-notif__cause-detail">{{ $t(line.detailKey) }}</span>
            <span v-if="line.triggerKey !== undefined" class="con-notif__cause-tail con-notif__cause-trigger">{{ triggerText(line) }}</span>
            <span v-if="line.viaKey !== undefined" class="con-notif__cause-tail con-notif__cause-via" data-notif-via>{{ viaText(line) }}</span>
          </span>
        </div>
      </div>

      <!-- Passive effect fired — the SOURCE by name: a tableau card, or the ENACTED RESOLUTION (Turmoil Redux — the
           law that fired; hold X opens its own inspector). -->
      <template v-if="impactBand === undefined && notification.variant === 'passive-effect' && notification.effectSource !== undefined">
        <div class="con-notif__line con-notif__source" :data-effect-source="notification.effectSource.kind">
          <span v-if="notification.effectSource.kind === 'resolution'" class="con-notif__dim" v-i18n>Enacted resolution</span>
          <!-- The name is said ONCE: when the law's own line follows, its resolution chip names the card. -->
          <b v-if="lawLineEntries.length === 0" class="con-notif__card">{{ $t(effectSourceName) }}</b>
        </div>
        <!-- WHAT the law did, in the effect's own words (its journal line, the leading actor dropped). -->
        <span v-if="notification.effectSource.kind === 'resolution' && lawLineEntries.length > 0"
              class="con-notif__line con-notif__tokens con-notif__headline con-notif__lawline">
          <JournalTokenRenderer
            v-for="(tok, i) in lawLineEntries"
            :key="i"
            :token="tok"
            :players="players" />
        </span>
      </template>

      <!-- Coalesced burst. -->
      <template v-else-if="notification.groupCount !== undefined">
        <div class="con-notif__line">
          <span class="con-notif__strong"><span v-i18n>Events</span>: {{ notification.groupCount }}</span>
        </div>
      </template>

      <!-- The EVENT'S OWN VOICE when nothing of the viewer's moved: the journal's tokens, inert. The actor is the
           head's chip (never re-opened here); a play / an action / a standard project shows its CARD alone — the
           type label already says what happened (TR59: the verb and the type said one thing twice). -->
      <span v-else-if="headlineVisible"
            class="con-notif__line con-notif__tokens con-notif__headline"
            :class="{'con-notif__headline--cause': headlineAsCause}">
        <JournalTokenRenderer
          v-for="(tok, i) in headerEntries"
          :key="i"
          :token="tok"
          :players="players" />
      </span>

      <!-- Generation highlight body. -->
      <span v-else-if="notification.bodyKey !== undefined" class="con-notif__line" v-i18n>{{ notification.bodyKey }}</span>

      <!-- Plain PROMPT text (`pushWarning` and every other model whose whole content is the prompt). -->
      <span v-else-if="promptText !== ''" class="con-notif__line">{{ promptText }}</span>

      <!-- Public card REVEAL / SHOW — the consequence line. -->
      <div v-if="notification.reveal !== undefined" class="con-notif__line con-notif__revealline">
        <span class="con-notif__dim" v-i18n>{{ revealVerb }}</span>
        <b v-if="notification.reveal.cards.length === 1" class="con-notif__card">{{ $t(notification.reveal.cards[0]) }}</b>
        <span v-else class="con-notif__strong">{{ notification.reveal.cards.length }}&nbsp;<span v-i18n>cards</span></span>
        <span v-if="notification.reveal.origin === 'deck'" class="con-notif__result" v-i18n>{{ revealResultLabel }}</span>
      </div>

      <!-- The bot turn's OUTCOME lines (typed by their producer; the content policy decides how many). -->
      <ul v-if="notification.summaryLines !== undefined" class="con-notif__summary">
        <li v-for="(line, i) in notification.summaryLines" :key="i" class="con-notif__summary-line">
          <span class="con-notif__summary-tick" aria-hidden="true"></span>
          <span class="con-notif__tokens">
            <JournalTokenRenderer
              v-for="(tok, j) in lineEntries(line.message)"
              :key="j"
              :token="tok"
              :players="players" />
          </span>
        </li>
        <li v-if="notification.summaryOverflow !== undefined" class="con-notif__summary-line con-notif__summary-line--more">
          <span class="con-notif__summary-tick" aria-hidden="true"></span>
          <span>{{ overflowLabel }}</span>
        </li>
      </ul>
    </div>

    <!-- WHAT THE OTHERS GOT — one quiet line each (the content policy keeps ≤ 2 chips): the actor's line wears only
         their dot (the head named them), a third player's names them. Never the viewer's — that is the band; never
         under a loss — the band and its cause carry that story. -->
    <div v-if="showContext && pillClusters.length > 0" class="con-notif__clusters">
      <span v-for="(cluster, ci) in pillClusters" :key="ci" class="con-notif__cluster" :data-notif-cluster="cluster.scope">
        <span class="con-notif__cluster-tag" :class="'con-notif__cluster-tag--' + cluster.scope">
          <span v-if="clusterOwner(cluster) !== undefined"
                class="con-notif__dot" :class="'player_bg_color_' + clusterOwner(cluster)" aria-hidden="true"></span>
          <span v-if="clusterLabel(cluster) !== ''" v-i18n>{{ clusterLabel(cluster) }}</span>
        </span>
        <span v-for="(chip, i) in cluster.chips"
              :key="i"
              class="con-notif__chip"
              :class="chipClass(chip)">
          <span v-if="iconClass(chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(chip.icon)" aria-hidden="true"></span>
          <span v-if="chipUnit(chip) !== undefined" class="con-notif__chip-unit" v-i18n>{{ chipUnit(chip) }}</span>
          <span>{{ chip.text }}</span>
          <!-- PL-195: a COUNTED gain names what it was counted by, on its own pill. -->
          <span v-if="chip.basis !== undefined" class="con-notif__chip-basis" data-notif-basis>{{ basisLabel(chip.basis) }}</span>
        </span>
      </span>
    </div>

    <!-- NO SILENT LOSS, after the fact: an effect of this action that could NOT apply names itself — «пропущено ·
         <что> [величина, зачёркнута] · <почему>», with the owner's cube when it was not the actor's. -->
    <ul v-if="skippedLines.length > 0" class="con-notif__skips">
      <li v-for="(line, i) in skippedLines" :key="i" class="con-notif__skip">
        <span class="con-notif__skip-tag" v-i18n>Skipped</span>
        <span v-if="line.owner !== undefined" class="con-notif__side">
          <span class="con-notif__dot" :class="'player_bg_color_' + line.owner" aria-hidden="true"></span>
          <span class="con-notif__who">{{ ownerName(line.owner) }}</span>
        </span>
        <span class="con-notif__skip-label" v-i18n>{{ line.label }}</span>
        <span v-if="line.chip !== undefined" class="con-notif__chip con-notif__chip--skipped">
          <span v-if="iconClass(line.chip.icon) !== ''" class="con-notif__chip-icon" :class="iconClass(line.chip.icon)" aria-hidden="true"></span>
          <span class="con-notif__chip-amt">{{ line.chip.text }}</span>
        </span>
        <span class="con-notif__skip-reason" v-i18n>{{ line.reason }}</span>
      </li>
    </ul>
    <!-- THE PLAY WENT THROUGH THANKS TO A MODIFIER (TR49 class) — rides only a model the content policy kept it on. -->
    <ul v-if="easedLines.length > 0" class="con-notif__skips con-notif__eased" data-notif-eased>
      <li v-for="(line, i) in easedLines" :key="i" class="con-notif__skip">
        <span class="con-notif__skip-tag con-notif__eased-tag" v-i18n>Requirement</span>
        <span class="con-notif__skip-label">{{ easedLineText(line) }}</span>
      </li>
    </ul>

    <!-- THE PAD CONTRACT, in GLYPHS, on ONE row with the lifetime (TR59 decision 8): the detail first when the card
         has one — hold X, the ring around the glyph filling on the input's own clock (NOTIF_HOLD_MS), «→ where it
         leads»; then the close glyph. A visible toast overrides B wherever it shows (the shell consumes the press). -->
    <footer class="con-notif__actions" aria-hidden="true">
      <span v-if="hasDetailAction"
            class="con-notif__action con-notif__action--detail"
            :class="{'con-notif__action--filling': holdActive}">
        <span class="con-notif__hold">
          <GamepadGlyph control="secondary" />
          <svg v-if="holdActive" class="con-notif__hold-ring" viewBox="0 0 36 36" :style="{animationDuration: holdMs + 'ms'}">
            <circle cx="18" cy="18" r="16" pathLength="100" />
          </svg>
        </span>
        <span class="con-notif__action-arrow">→</span>
        <span v-i18n>{{ detailLabel }}</span>
      </span>
      <!-- The lifetime, as the row's own track: it shrinks → auto-dismiss; it pauses while an X-hold fills. -->
      <span class="con-notif__ttl">
        <span v-if="showProgress"
              class="con-notif__progress"
              :style="{animationDuration: notification.ttl + 'ms'}"
              @animationend="$emit('dismiss', notification.id)"></span>
      </span>
      <span class="con-notif__action con-notif__action--close">
        <GamepadGlyph control="back" />
      </span>
    </footer>
  </article>
</template>

<script lang="ts">
/**
 * CONSOLE transient notification card — the console-native presentation of
 * the shared NotificationModel (one brain: NotificationLayer /
 * notificationState / notificationModel; TTLs, suppression, diffing).
 *
 * ONE GLANCE (TR59 — the owner's accent of 2026-10-16: «игрок буквально одним
 * взглядом получает ответы на все свои вопросы»). The card answers three
 * questions, in this order and weight:
 *  1. WHAT CHANGED FOR YOU — the hero band: the viewer's own typed deltas,
 *     the card's largest numbers, the sign stated by label + glyph + tone
 *     (never colour alone); one delta is a single confident statement;
 *  2. WHY — the «почему» line under it: WHAT OF YOURS paid (your tile / card /
 *     corporation / colony) or the attacker's card, the trigger, and the
 *     actor's move as a quiet tail («ход: …»);
 *  3. WHOSE TURN — the head's actor chip, the ONE place the actor is named.
 * A card that touched nothing of the viewer's leads with the event's own voice
 * (the card the actor played, the type label saying what happened). What the
 * actor got is ONE quiet line (≤ 2 chips — the content policy decides, see
 * `notificationContentPolicy.ts`); the rest is the journal (press-and-HOLD X).
 *
 * The two semantic AXES render as independent channels: `sign` drives the
 * band's identity, `importance` drives the card's chrome grade
 * (`.con-notif--imp-*`: ambient / notable / critical / attention).
 *
 * Deliberate console properties: NON-INTERACTIVE (pointer-events none) — the
 * pad contract lives ON the card as glyphs on one row with the lifetime
 * (`.con-notif__actions`): press-and-HOLD X = the detail action (the bot-turn
 * review, the enacted resolution's inspector, the Parliament, or the journal
 * AT this event), B = close. The variant ACCENT is inherited from the
 * standalone `.notification-card--variant-*` rules.
 */
import {defineComponent, PropType} from 'vue';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {parseLocalizedLog} from '@/client/components/journal/logLocalization';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {resolutionName} from '@/client/parliament/ClientParliamentManifest';
import {NOTIF_HOLD_MS, notifHoldState} from '@/client/console/consoleNotifHold';
import {ViewerImpactMeta} from '@/client/components/notifications/notificationSemantics';
import {causeLinesOf, NotificationCauseLine} from '@/client/components/notifications/notificationCauseView';
import {LiveNotification, NotificationEasedLine, NotificationPillGroup, NotificationSkippedLine, NotificationVariant} from '@/client/components/notifications/notificationTypes';
import {EASING_KEYS} from '@/client/console/requirementEasingText';

// The spoken UNIT of a band chip — the resource's NAME beside its icon, so the
// hero statement reads «ТЕПЛО +1», not a lone glyph in a large frame. Standard
// resources + the sprite-less pseudo-icons; card resources keep icon-only (the
// sprite is unambiguous and their names decline).
const UNIT_LABEL: Readonly<Record<string, string>> = {
  'megacredits': 'M€', 'steel': 'Steel', 'titanium': 'Titanium', 'plants': 'plants',
  'energy': 'Energy', 'heat': 'Heat', 'cards': 'cards', 'tr': 'TR', 'vp': 'VP',
  // The Modular Floodgates blockade band: no number moved — the loss IS the
  // standing ban, so the unit speaks the whole phrase (duration included).
  'hydro-blockade': 'Advancement blocked until the next generation',
};
// …and a PRODUCTION delta says so in its own unit (TR59): with the «from production» line gone (one number, one
// statement), the unit is where «stock or income?» is answered — «ПР. ЭНЕРГИИ −1», never a bare «ЭНЕРГИЯ −1».
const PRODUCTION_UNIT_LABEL: Readonly<Record<string, string>> = {
  'megacredits': 'M€ prod.', 'steel': 'Steel prod.', 'titanium': 'Titanium prod.', 'plants': 'Plant prod.',
  'energy': 'Energy prod.', 'heat': 'Heat prod.',
};
// "What an opponent did" variants tint the rail in the actor colour;
// prestige / system variants keep the variant accent (same rule as desktop).
const ACTOR_RAIL_VARIANTS: ReadonlySet<NotificationVariant> = new Set<NotificationVariant>([
  'play-card', 'blue-action', 'standard-project', 'colony', 'hydronetwork', 'passive-effect', 'event', 'bot-turn',
]);
// The variants whose TYPE LABEL already says what happened («Карта сыграна», «Действие карты», «Стандартный
// проект»): their headline is the CARD alone — the log's verb said the type a second time (TR59).
const CARD_HEADLINE_VARIANTS: ReadonlySet<NotificationVariant> = new Set<NotificationVariant>([
  'play-card', 'blue-action', 'standard-project',
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
    /** ONE delta → the label and the statement share a line (no empty frame). */
    bandDense(): boolean {
      const band = this.impactBand;
      if (band === undefined) {
        return false;
      }
      return band.losses.length + band.gains.length === 1 && band.transfer !== true;
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
    /** The kicker's card (PL-150) — only when the headline that would name it is NOT on screen (TR59: once). */
    kickerCard(): CardName | undefined {
      return this.headlineVisible ? undefined : this.notification.typeLabelCard;
    },
    /** The requirement-eased lines (TR49 class) — two at most, like the skips. */
    easedLines(): ReadonlyArray<NotificationEasedLine> {
      return (this.notification.eased ?? []).slice(0, 2);
    },
    /** The skipped-effect lines — two at most: the card is a toast, the journal holds the rest. */
    skippedLines(): ReadonlyArray<NotificationSkippedLine> {
      return (this.notification.skipped ?? []).slice(0, 2);
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
      // A standing ban (the Modular Floodgates blockade) is not a spent
      // amount — «You lost: advancement blocked» misreads, so the band leads
      // with the hostile register instead.
      if (this.impactBand?.losses.some((c) => c.icon === 'hydro-blockade') === true) {
        return 'Against you';
      }
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
    /**
     * The «почему»-zone lines — the typed causes of the band, mapped by the
     * pure `causeLinesOf`. Always present when the band is (guarded by the
     * corpus spec); an empty result under a live band is a producer defect —
     * surfaced as a dev diagnostic in `mounted()`, never masked by a
     * placeholder.
     */
    causeLines(): ReadonlyArray<NotificationCauseLine> {
      const band = this.impactBand;
      return band === undefined ? [] : causeLinesOf(band);
    },
    /**
     * The headline renders event-first (no band). Under a live band the
     * «почему»-zone is the cause voice for EVERY family — the bot-turn card
     * included. The headline returns only if the zone could not be built (an
     * old save's script with no attribution and no reveal step).
     */
    headlineVisible(): boolean {
      if (this.notification.header === undefined) {
        return false;
      }
      if (this.impactBand === undefined) {
        return true;
      }
      return this.notification.variant === 'bot-turn' && this.causeLines.length === 0;
    },
    /** Bot-turn headline under a live band = the secondary cause voice. */
    headlineAsCause(): boolean {
      return this.impactBand !== undefined && this.notification.variant === 'bot-turn';
    },
    /** What the others got stays for neutral events and under a positive band; a loss / mixed card drops it (the
     *  band + its cause carry that story; the journal has the ledger). */
    showContext(): boolean {
      return this.notification.sign === 'neutral' || this.notification.sign === 'positive';
    },
    /** The ownership clusters — structured when the producer split them, else
     *  the flat pills degrade to ONE actor-scoped cluster (burst summaries). */
    pillClusters(): ReadonlyArray<NotificationPillGroup> {
      const groups = this.notification.pillGroups;
      if (groups !== undefined && groups.length > 0) {
        return groups;
      }
      if (this.notification.pills.length === 0) {
        return [];
      }
      return [{scope: 'actor', chips: this.notification.pills}];
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
    /** The honest «and N more» tail of a capped outcome list, plural-correct. */
    overflowLabel(): string {
      const n = this.notification.summaryOverflow ?? 0;
      return translateTextWithParams('+${0} more {event|events}', [String(n)]);
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
      // A play / an action / a standard project: the CARD alone — the type label says what happened (TR59).
      if (CARD_HEADLINE_VARIANTS.has(this.notification.variant)) {
        const cards = h.data.filter((tok) => tok.type === LogMessageDataType.CARD || tok.type === LogMessageDataType.CARDS);
        if (cards.length > 0) {
          return cards.flatMap((tok, i) => (i === 0 ? [tok] : [' ', tok]));
        }
      }
      return this.withoutLeadingActor(parseLocalizedLog(h));
    },
    /** The LAW's own line (a resolution-sourced passive card): the header when it is the effect's own journal
     *  line — never the generic «Effect triggered» fallback, which the type label and the source already say. */
    lawLineEntries(): ReadonlyArray<string | LogMessageData> {
      const h = this.notification.header;
      if (h === undefined || h.message === 'Effect triggered: ${0}') {
        return [];
      }
      return this.withoutLeadingActor(parseLocalizedLog(h));
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
      case 'chairman': return '⚖';
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
    /** The fired passive's source, by name (a card name key, or the resolution's printed name key). */
    effectSourceName(): string {
      const source = this.notification.effectSource;
      if (source === undefined) {
        return '';
      }
      return source.kind === 'card' ? source.card : resolutionName(source.resolution);
    },
    /** A fired passive of the ENACTED RESOLUTION: the detail is its inspector. */
    inspectsResolution(): boolean {
      return this.notification.variant === 'passive-effect' && this.notification.effectSource?.kind === 'resolution';
    },
    /** The toast's DETAIL action: the AI-turn review, the enacted resolution's
     *  inspector, or the journal AT this event (any card carrying a
     *  correlationId — the full causal chain). */
    hasDetailAction(): boolean {
      if (this.notification.holdsFlow === true && this.notification.botTurnKey !== undefined) {
        return true;
      }
      return this.inspectsResolution || this.notification.reveal !== undefined || this.notification.correlationId !== undefined;
    },
    detailLabel(): string {
      if (this.notification.holdsFlow === true && this.notification.botTurnKey !== undefined) {
        return 'Watch turn';
      }
      if (this.inspectsResolution) {
        return 'Inspect';
      }
      // A card about revealed / shown cards opens THEM — the reveal viewer (PL-557), never the journal.
      if (this.notification.reveal !== undefined) {
        return 'View';
      }
      // THE OBJECT THE CARD IS ABOUT (PL-025): a chairmanship card and a card whose chain carries a Parliament
      // outcome (a delegate placed, a rally, a party's support, a walk) open the Parliament — the model's own CTA.
      if (this.notification.cta?.action === 'open-parliament') {
        return 'Open the Parliament';
      }
      return 'Log';
    },
    /** The X-hold on THIS card is filling (shell-tracked, module-reactive). */
    holdActive(): boolean {
      return notifHoldState.noteId === this.notification.id;
    },
    holdMs(): number {
      return NOTIF_HOLD_MS;
    },
  },
  mounted() {
    // A live band with NO nameable cause is a producer defect (an event that
    // recorded with no source anywhere in its chain). Never masked by a
    // placeholder — say it where a developer looks.
    if (this.impactBand !== undefined && this.causeLines.length === 0) {
      console.warn(`[notifications] band with no nameable cause: ${this.notification.id}`,
        JSON.stringify(this.impactBand.causes));
    }
  },
  methods: {
    /** «Требования игнорируются · Новаторская разработка» / «±2 · Особая разработка» (+ «один розыгрыш»). */
    easedLineText(line: NotificationEasedLine): string {
      const what = line.kind === 'waive' ? translateText(EASING_KEYS.requirementIgnored) : `±${line.steps ?? 0}`;
      const parts = [what, translateText(line.source)];
      if (line.oneShot) {
        parts.push(translateText(EASING_KEYS.oneShot));
      }
      return parts.join(' · ');
    },
    /** «за 14 тайлов на Марсе» — the journal's own reading of a counted gain's basis (JournalChildRow.basisLabel). */
    basisLabel(basis: {count: number, unitKey: string}): string {
      return translateTextWithParams('for ${0} ${1}', [String(basis.count), translateText(basis.unitKey)]);
    },
    ownerName(color: Color): string {
      return displayNameForColor(this.players, color);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    /** The trigger tail, translated (`${0}` carries a localized name). */
    triggerText(line: NotificationCauseLine): string {
      if (line.triggerKey === undefined) {
        return '';
      }
      if (line.triggerParamKey !== undefined) {
        return translateTextWithParams(line.triggerKey, [this.$t(line.triggerParamKey)]);
      }
      return this.$t(line.triggerKey);
    },
    /** The actor's move tail — «ход: Купольный кратер» (`${0}` carries a localized name). */
    viaText(line: NotificationCauseLine): string {
      if (line.viaKey === undefined) {
        return '';
      }
      return translateTextWithParams(line.viaKey, [this.$t(line.viaParamKey ?? '')]);
    },
    /** The chip's spoken unit — the resource name beside its icon (band chips
     *  always; context chips only where the icon alone is mute — vp). */
    chipUnit(chip: JournalImpactChip): string | undefined {
      if (chip.icon === 'vp') {
        return 'VP';
      }
      return undefined;
    },
    /** The BAND chip's unit — spoken for every standard resource; a production delta names its production. */
    bandUnit(chip: JournalImpactChip): string | undefined {
      if (chip.production === true) {
        return PRODUCTION_UNIT_LABEL[chip.icon] ?? UNIT_LABEL[chip.icon];
      }
      return UNIT_LABEL[chip.icon];
    },
    /** Whose dot a cluster wears: the actor's (named in the head), a third player's, none for the planet. */
    clusterOwner(cluster: NotificationPillGroup): Color | undefined {
      switch (cluster.scope) {
      case 'planet': return undefined;
      case 'others': return cluster.owner;
      default: return this.notification.actor;
      }
    },
    /** A cluster's words: the planet's, a third player's name — and NOTHING for the actor (the head named them —
     *  ONE ACTOR STATEMENT; their dot ties the line to the chip). */
    clusterLabel(cluster: NotificationPillGroup): string {
      switch (cluster.scope) {
      case 'planet': return 'Mars';
      case 'others': return cluster.owner !== undefined ? displayNameForColor(this.players, cluster.owner) : 'Others';
      default: return this.notification.actor === undefined ? 'Player' : '';
      }
    },
    /**
     * Drop the line's LEADING actor token when it repeats the head's actor
     * chip (the same compaction the journal's grouped rows use) — the card
     * states the initiator ONCE; every line after that reads as what happened.
     */
    withoutLeadingActor(tokens: ReadonlyArray<string | LogMessageData>): ReadonlyArray<string | LogMessageData> {
      const actor = this.notification.actor;
      const first = tokens[0];
      if (actor === undefined || first === undefined || typeof first === 'string' ||
        first.type !== LogMessageDataType.PLAYER || first.value !== actor) {
        return tokens;
      }
      const rest = [...tokens.slice(1)];
      if (typeof rest[0] === 'string') {
        rest[0] = (rest[0] as string).replace(/^\s+/, '');
      }
      return rest;
    },
    // One compact outcome line (summaryLines) → localized journal tokens,
    // minus the redundant leading actor.
    lineEntries(line: LogMessage): ReadonlyArray<string | LogMessageData> {
      return this.withoutLeadingActor(parseLocalizedLog(line));
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
