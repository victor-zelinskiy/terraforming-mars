<template>
  <div class="con-ma" role="dialog" :aria-label="$t(title)">
    <div class="con-ma__backdrop" aria-hidden="true"></div>
    <div class="con-ma__panel">
      <!-- Identity band: category emblem + title; the slot tray + tally +
           (awards) the next funding price live on the right. 3/3 announces
           itself in gold — the tray pips carry WHO took each slot. -->
      <div class="con-ma__head">
        <div class="con-ma__emblem" aria-hidden="true"><BarButtonIcon :name="kind" class="con-ma__emblem-icon" /></div>
        <div class="con-ma__title">{{ $t(title) }}</div>
        <div class="con-ma__tally">
          <div class="con-ma__slots" aria-hidden="true">
            <span v-for="(c, i) in slots" :key="i"
                  class="con-ma__slot"
                  :class="c !== undefined ? 'player_bg_color_' + c : 'con-ma__slot--empty'"></span>
          </div>
          <div v-if="allTaken" class="con-ma__complete">✓ {{ $t(kind === 'awards' ? 'All funded' : 'All claimed') }}</div>
          <div v-else class="con-ma__count">{{ $t(kind === 'awards' ? 'Funded' : 'Claimed') }} <b>{{ takenCount }}/{{ maxSlots }}</b></div>
          <!-- The WALLET: the overlay covers the resource panel, so the
               viewer's M€ live HERE — together with the (category-wide)
               price as a premium before → after preview. -->
          <div class="con-ma__wallet" :class="{'con-ma__wallet--short': !free && walletShort > 0, 'con-ma__wallet--free': free}">
            <span class="con-ma__wallet-label">{{ $t('You have') }}</span>
            <span class="con-ma__wallet-now"><b>{{ myMegacredits }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i></span>
            <span v-if="free" class="con-ma__wallet-free">{{ $t('Free sponsorship') }}</span>
            <template v-else-if="nextCost !== undefined">
              <span class="con-ma__wallet-price">−{{ nextCost }}</span>
              <span v-if="walletShort === 0" class="con-ma__wallet-after">→ <b>{{ walletAfter }}</b></span>
              <span v-else class="con-ma__wallet-shortfall">{{ shortfallText }}</span>
            </template>
          </div>
        </div>
      </div>

      <!-- The dashboard: a 2-column grid whose rows STRETCH to fill the
           panel — the standard 5–6 items always fit with NO scrollbar (an
           odd list's last card spans both columns; overflow scroll is an
           extreme-mod fallback only). Every card is focusable — taken and
           blocked items still explain themselves via the context strip. -->
      <div class="con-ma__grid con-info__scroll" ref="grid">
        <article v-for="(it, i) in items" :key="it.key"
                 class="con-ma__card"
                 :class="{
                   'con-ma__card--focused': i === index,
                   // P29: the strong actionable lift is a MILESTONE semantic
                   // (a hard condition was met). A fundable award is a normal
                   // economy action — the CTA + wallet carry it, the row
                   // stays calm (never reads like a claimable milestone).
                   'con-ma__card--go': it.available && it.kind === 'milestone',
                   'con-ma__card--taken': it.takenBy !== undefined,
                 }"
                 :ref="i === index ? 'focusedCard' : undefined">
          <span v-if="railClass(it) !== ''" class="con-ma__rail" :class="railClass(it)" aria-hidden="true"></span>

          <!-- Art stage: built for the transparent 512×512 icons — a soft
               radial pedestal, contain (NEVER cropped); the legacy 140×83
               assets letterbox gracefully until they are replaced. -->
          <div class="con-ma__stage" aria-hidden="true">
            <div class="con-ma__art" :style="{backgroundImage: `url(assets/ma/${artSlug(it)}.png)`}"></div>
          </div>

          <div class="con-ma__body">
            <div class="con-ma__name" v-i18n>{{ shortName(it.name) }}</div>
            <div class="con-ma__desc" v-i18n>{{ it.description }}</div>
            <div v-if="it.takenBy !== undefined" class="con-ma__owner">
              <span class="con-ma__owner-dot" :class="'player_bg_color_' + it.takenBy.color" aria-hidden="true"></span>
              <span class="con-ma__owner-name">{{ it.takenBy.name }}</span>
              <span class="con-ma__owner-verb">✓ {{ $t(it.kind === 'milestone' ? 'Claimed' : 'Funded') }}</span>
            </div>
          </div>

          <!-- Status column: the dominant YOU metric (score / threshold +
               meter for milestones; leadership for awards), the rivals
               strip (OTHER players only) and the CTA / price zone. -->
          <div class="con-ma__status">
            <div class="con-ma__metric" :class="metricClass(it)">
              <span class="con-ma__metric-label">{{ $t('You') }}</span>
              <span class="con-ma__metric-value">
                <template v-if="it.scores.length === 0">—</template>
                <template v-else><b>{{ it.myScore }}</b><span v-if="it.threshold !== undefined" class="con-ma__metric-req">/{{ it.threshold }}</span></template>
              </span>
              <span v-if="it.kind === 'award' && it.scores.length > 0" class="con-ma__metric-sub" :class="{'con-ma__metric-sub--lead': it.myLead}">
                <template v-if="it.myLead">{{ $t('You lead') }}</template>
                <template v-else>{{ $t('Leader') }}: {{ it.leaderScore }}</template>
              </span>
              <span v-if="it.threshold !== undefined && it.scores.length > 0" class="con-ma__meter" aria-hidden="true"><i :style="{width: meterWidth(it)}"></i></span>
            </div>
            <div v-if="rivals(it).length > 0" class="con-ma__rivals">
              <span class="con-ma__rivals-label">{{ $t('Rivals') }}</span>
              <span v-for="s in rivals(it)" :key="s.color"
                    class="con-ma__rival"
                    :class="rivalClasses(it, s)">{{ s.score }}</span>
            </div>
            <!-- P26b: the price moved to the header wallet (it is category-
                 wide) — the CTA carries the verb only, so an available card
                 reads clean and an idle card carries no cost noise. -->
            <div class="con-ma__cta">
              <span v-if="it.available" class="con-ma__btn" :class="{'con-ma__btn--focus': i === index}">
                <GamepadGlyph control="confirm" />
                <span>{{ $t(it.kind === 'milestone' ? 'Claim' : 'Fund') }}</span>
              </span>
            </div>
          </div>
        </article>
      </div>

      <!-- Footer: the FOCUSED item's context (one fixed line — owner /
           ready / "+N to the threshold" / the concrete blocker) + the
           controller hints; the A hint dims with the real availability. -->
      <div class="con-ma__foot">
        <div class="con-ma__context" :class="contextClass">
          <template v-if="context.tone === 'owner'">
            <span class="con-ma__owner-dot" :class="'player_bg_color_' + context.color" aria-hidden="true"></span>
            <span>{{ $t(context.kind === 'milestone' ? 'claimed by' : 'funded by') }} {{ context.name }}</span>
          </template>
          <template v-else-if="context.tone === 'ready'"><span>{{ $t(context.key) }}</span></template>
          <template v-else-if="context.tone === 'gap'"><span>{{ $t('To the threshold') }}: <b>+{{ context.gap }}</b></span></template>
          <template v-else-if="context.tone === 'blocked'"><span>{{ $t(context.key) }}</span></template>
        </div>
        <div class="con-ma__hints">
          <span class="con-ma__hint"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
          <span class="con-ma__hint" :class="{'con-ma__hint--off': !confirmEnabled}">
            <GamepadGlyph control="confirm" /><span>{{ $t(kind === 'milestones' ? 'Claim' : 'Fund') }}</span>
          </span>
          <span class="con-ma__hint"><GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span></span>
          <span class="con-ma__hint">
            <GamepadGlyph :control="kind === 'milestones' ? 'bumperR' : 'bumperL'" />
            <span>{{ $t(kind === 'milestones' ? 'Awards' : 'Milestones') }}</span>
          </span>
          <span class="con-ma__hint"><GamepadGlyph control="back" /><span>{{ $t(free ? 'Minimize' : 'Close') }}</span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * P26 — the console-native Milestones / Awards PREMIUM screen (a full
 * rewrite of the P22/P23 sheet rows; the audit + concept live in the
 * iteration notes). A strategic dashboard, NOT a bottom sheet: the whole
 * standard set is on screen at once, the art stage is composed for the
 * transparent 512×512 icon format, the viewer's progress is the dominant
 * metric, rivals are colour badges (other players ONLY), availability
 * reads from state — never a repeated "Unavailable right now" line.
 *
 * PURE derivation lives in consoleMaModel.ts (unit-tested); this component
 * only renders items + the focused context. Input handling (grid nav / A /
 * B / LB/RB category switch) stays in ConsoleShell, like every sheet.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {translateTextWithParams} from '@/client/directives/i18n';
import {ConsoleMaItem, ConsoleMaKind, ConsoleMaScore, ConsoleMaFocusContext, consoleMaFocusContext} from '@/client/components/console/consoleMaModel';

export default defineComponent({
  name: 'ConsoleMaScreen',
  components: {GamepadGlyph, BarButtonIcon},
  props: {
    kind: {type: String as PropType<ConsoleMaKind>, required: true},
    items: {type: Array as PropType<ReadonlyArray<ConsoleMaItem>>, required: true},
    index: {type: Number, required: true},
    /** The viewer's M€ — the overlay covers the resource panel. */
    myMegacredits: {type: Number, required: true},
    /** MAX claimable/fundable slots (3). */
    maxSlots: {type: Number, default: 3},
    /** FREE-sponsorship mode (Vitor's start action funds an award for free):
     *  the wallet reads «Бесплатное спонсирование» instead of a −0 price. */
    free: {type: Boolean, default: false},
  },
  computed: {
    title(): string {
      return this.kind === 'milestones' ? 'Milestones' : 'Awards';
    },
    takenCount(): number {
      return this.items.filter((it) => it.takenBy !== undefined).length;
    },
    /** The completed state = the SLOT race is over (3/3), not "every listed". */
    allTaken(): boolean {
      return this.takenCount >= this.maxSlots;
    },
    /** Slot pips: filled with each taker's colour, hollow while open. */
    slots(): Array<string | undefined> {
      const colors: Array<string | undefined> = this.items
        .filter((it) => it.takenBy !== undefined)
        .map((it) => it.takenBy?.color);
      while (colors.length < this.maxSlots) {
        colors.push(undefined);
      }
      return colors.slice(0, this.maxSlots);
    },
    nextCost(): number | undefined {
      return this.items.find((it) => it.cost !== undefined)?.cost;
    },
    /** M€ left after the (category-wide) claim/fund price. */
    walletAfter(): number {
      return this.myMegacredits - (this.nextCost ?? 0);
    },
    walletShort(): number {
      return Math.max(0, -this.walletAfter);
    },
    shortfallText(): string {
      return translateTextWithParams('Need ${0} more M€', [String(this.walletShort)]);
    },
    focused(): ConsoleMaItem | undefined {
      return this.items[this.index];
    },
    confirmEnabled(): boolean {
      return this.focused?.available === true;
    },
    context(): ConsoleMaFocusContext {
      return consoleMaFocusContext(this.focused);
    },
    contextClass(): string {
      switch (this.context.tone) {
      case 'ready': return 'con-ma__context--ready';
      case 'gap': return 'con-ma__context--gap';
      case 'blocked': return 'con-ma__context--blocked';
      default: return '';
      }
    },
  },
  watch: {
    /** Overflow is an extreme-mod fallback — keep the focus visible there. */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        el?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      });
    },
    kind() {
      (this.$refs.grid as HTMLElement | undefined)?.scrollTo?.({top: 0});
    },
  },
  methods: {
    /** Same slug the desktop overlays bind (assets/ma/<slug>.png). */
    artSlug(it: ConsoleMaItem): string {
      return it.name.toLowerCase().replaceAll(' ', '-').replaceAll('.', '');
    },
    /** Strip the numeric variant suffix (Terraformer26 → Terraformer). */
    shortName(name: string): string {
      return name.replace(/[0-9]+$/, '');
    },
    rivals(it: ConsoleMaItem): ReadonlyArray<ConsoleMaScore> {
      return [...it.scores].filter((s) => s.color !== it.myColor).sort((a, b) => b.score - a.score);
    },
    railClass(it: ConsoleMaItem): string {
      if (it.takenBy !== undefined) {
        return 'con-ma__rail--owner player_bg_color_' + it.takenBy.color;
      }
      // P29: the mint "act now" rail is milestone-only (see the card class) —
      // a fundable award keeps a calm row, its CTA carries the availability.
      return it.available && it.kind === 'milestone' ? 'con-ma__rail--go' : '';
    },
    metricClass(it: ConsoleMaItem): string {
      if (it.kind === 'award') {
        return it.myLead ? 'con-ma__metric--lead' : '';
      }
      return it.myReady && it.scores.length > 0 ? 'con-ma__metric--ready' : '';
    },
    meterWidth(it: ConsoleMaItem): string {
      const t = it.threshold ?? 0;
      if (t <= 0) {
        return '0%';
      }
      return `${Math.min(100, Math.round((it.myScore / t) * 100))}%`;
    },
    rivalClasses(it: ConsoleMaItem, s: ConsoleMaScore): Array<string> {
      const classes = ['player_bg_color_' + s.color];
      if (it.kind === 'award' && s.score === it.leaderScore && s.score > 0) {
        classes.push('con-ma__rival--leader');
      }
      if (it.kind === 'milestone' && s.claimable === true) {
        classes.push('con-ma__rival--ready');
      }
      return classes;
    },
  },
});
</script>
