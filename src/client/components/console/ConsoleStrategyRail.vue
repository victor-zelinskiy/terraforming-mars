<template>
  <aside class="con-strat" :aria-label="$t('Milestones') + ' · ' + $t('Awards')">
    <!-- THE DISPLAY CASE + THE SPINE — the rail's own finished body. The
         chassis still runs full-bleed to the physical edge (the hull member),
         but the VISIBLE composition ends inside the viewport: one glass
         display plane (the case) mounted onto a metallic support (the spine)
         that stands just off the screen edge. The right border, both
         terminators and the case shadow are all inside the frame — the glass
         no longer reads as cropped by the viewport. -->
    <i class="con-strat__case" aria-hidden="true"></i>
    <i class="con-strat__spine" aria-hidden="true"></i>

    <!-- ADAPTIVE POSES: the medal scale follows the item count. The dense
         step starts at SIX items (not seven) — the enlarged base medal is
         sized so the standard five fill the zone's height; a sixth would
         overflow it on the TV profile. -->
    <section v-for="z in zoneViews" :key="z.kind"
             class="con-strat__zone"
             :class="['con-strat__zone--' + z.kind, {
               'con-strat__zone--done': z.composed,
               'con-strat__zone--dense': z.zone.items.length > 5 && !z.composed,
               'con-strat__zone--ultra': z.zone.items.length > 9 && !z.composed,
             }]">
      <!-- The zone head IS the workspace door: the LB/RB cap the shell already
           answers to, made clickable for the mouse. The glyph must survive
           every state (open / completed) — it is the door, not a status.
           ONE compact line: glyph · title · the 3-slot diamond tray (the SAME
           grammar as the workspace header's tally — filled with each taker's
           colour). The PRICE stays deliberately absent: it belongs to the
           workspace where the decision is made.
           ARMED (awards): funding is offered RIGHT NOW — the accent lives at
           the ACTION level (a gold keyline under the door + the next free
           slot's gold rim), never as a per-row glow: with money and a slot,
           nearly every unsponsored award is fundable, and a column of glowing
           rows says nothing. Milestones keep their per-row emerald language
           (the server offers only the ones actually met). -->
      <button type="button" class="con-strat__head"
              :class="{'con-strat__head--armed': z.armed}"
              :aria-label="$t(z.title)"
              @click="$emit('open', z.kind)">
        <span class="con-strat__key" aria-hidden="true"><GamepadGlyph :control="z.glyph" /></span>
        <span class="con-strat__title">{{ $t(z.title) }}</span>
        <span class="con-strat__slots" aria-hidden="true">
          <i v-for="(c, i) in z.zone.slots" :key="i"
             class="con-strat__pip"
             :class="pipClass(z, c, i)"></i>
        </span>
      </button>

      <!-- The medal stack. Keys are the item NAMES: a poll that changes
           nothing moves nothing; the 3/3 recomposition is a keyed leave
           (collapse) + FLIP move of the survivors inside a fixed zone box —
           the rail's outer geometry never jumps. -->
      <TransitionGroup tag="div" class="con-strat__list"
                       :name="motion ? 'con-strat-row' : ''"
                       :css="motion"
                       @before-leave="pinLeaving">
        <div v-for="row in z.rows" :key="row.name"
             class="con-strat__item"
             :class="rowClasses(z, row)"
             :data-ma-hud="z.kind + ':' + row.name"
             :aria-label="rowHint(z, row)"
             role="button" tabindex="-1"
             @click="$emit('open', z.kind)">
          <!-- The medallion: a physical exhibit on its own display puck.
               Layers, bottom-up: state bloom (light) → pedestal (the puck,
               whose box-shadow rim is the requirement-met cue) → owner/
               sponsor enamel accent → the art, oversized past the puck —
               the emblem is the hero and may softly overlap the shelf line
               — → the milestone ACTIVATION optics (bottom-crystal spark,
               contour sweep, the gold-white rim — «can act NOW» light,
               never mixed with the green «requirement met» or a player
               colour) → the sponsor cube (awards only: the value zone
               belongs to the LEADERS, so the funder pins to the emblem's
               ribbon corner — a milestone's owner never doubles here, the
               seal and the tray already say it) → the seal's light kiss. -->
          <span class="con-strat__medal">
            <i class="con-strat__bloom" aria-hidden="true"></i>
            <i class="con-strat__pedestal" aria-hidden="true"></i>
            <i v-if="row.showTaken" class="con-strat__plate"
               :class="'player_bg_color_' + row.takenColor" aria-hidden="true"></i>
            <i class="con-strat__art" :style="artStyle(row.name)" aria-hidden="true"></i>
            <template v-if="z.kind === 'milestones'">
              <i class="con-strat__sweep" aria-hidden="true"></i>
              <i class="con-strat__actring" aria-hidden="true"></i>
              <i class="con-strat__spark" aria-hidden="true"></i>
            </template>
            <!-- The PROVENANCE SOCKET — one language for both zones: a
                 player cube physically mounted at the emblem's ribbon
                 corner says who FIXED this object. Awards wear it always
                 once funded (the sponsor); a milestone wears it only in
                 the COMPACT pose (the collapsed form of the full owner
                 seal — the cube keeps the colour, the tiny engraved check
                 keeps the «done», the gold socket keeps the fixation). -->
            <i v-if="(z.kind === 'awards' && row.showTaken) || (z.kind === 'milestones' && row.showTaken && z.composed)"
               class="con-strat__gem"
               :class="['player_bg_color_' + row.takenColor, {
                 'con-strat__gem--me': row.takenColor === viewerColor,
                 'con-strat__gem--own': z.kind === 'milestones',
               }]"
               aria-hidden="true">
              <svg v-if="z.kind === 'milestones'" class="con-strat__gem-check" viewBox="0 0 12 10">
                <path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" />
              </svg>
            </i>
            <i class="con-strat__kiss" aria-hidden="true"></i>
          </span>

          <!-- MILESTONES, open: my own count toward the threshold — the
               CURRENT value is the line's voice, the requirement recedes.
               The ✓ is a drawn SVG stroke (the activation draws it live);
               the FOOT line is a fixed-height box that swaps its content:
               the hairline meter while the row is not actionable, the
               «ДОСТУПНО» word while the claim is genuinely offered — the
               swap never moves the numbers (no layout shift on a turn
               change). -->
          <span v-if="z.kind === 'milestones' && row.my !== undefined" class="con-strat__cell">
            <span class="con-strat__val">
              <i v-if="row.ready" class="con-strat__readymark" aria-hidden="true">
                <svg viewBox="0 0 12 10"><path d="M1.6 5.4 L4.6 8.3 L10.4 1.7" /></svg>
              </i>
              <template v-if="!row.my.conditional">
                <b class="con-strat__num" :class="numClasses(z, row, 'my')">{{ row.my.score }}</b>
                <i v-if="row.my.threshold !== undefined" class="con-strat__req">/{{ row.my.threshold }}</i>
              </template>
              <b v-else-if="!row.ready" class="con-strat__num con-strat__num--zero">—</b>
            </span>
            <span class="con-strat__cellfoot">
              <span v-if="row.availableNow" class="con-strat__avail">{{ $t('Available now') }}</span>
              <i v-else-if="!row.my.conditional && row.my.threshold !== undefined" class="con-strat__meter" aria-hidden="true">
                <i class="con-strat__meter-fill" :style="meterStyle(row)"></i>
              </i>
            </span>
          </span>

          <!-- MILESTONES, taken: the OWNER SEAL — one calm horizontal line
               «cube · ВЗЯТО · ✓»: the CUBE answers who (the only owner
               marker on the row — the emblem stays clean), the neutral tick
               answers done, the thin gold hairline fixes it. Deliberately
               QUIETER than a live claimable row: a settled trophy, never
               the section's loudest button. During the seal beat it shares
               the grid cell with the fading held numbers. -->
          <span v-if="z.kind === 'milestones' && row.showTaken && !z.composed"
                class="con-strat__ownseal"
                :class="{'con-strat__ownseal--mine': row.takenColor === viewerColor}">
            <i class="con-strat__ownseal-cube"
               :class="'player_bg_color_' + row.takenColor" aria-hidden="true"></i>
            <span class="con-strat__ownseal-word">{{ $t('Taken') }}</span>
            <i class="con-strat__ownseal-tick" aria-hidden="true">✓</i>
          </span>

          <!-- AWARDS: the RANKING CASSETTE — one compact physical display
               module of TWO FIXED LEVELS (leader above, second below), never
               two floating rows. Two structural axes hold whatever the race
               does: the PLAYER ZONE (`__pz`, fixed width, cubes centred —
               row 1 and row 2 cubes share one horizontal centre) and the
               SCORE ZONE (fixed width, right-aligned tabular values share
               one right edge). The CROWN is a CAP on the leader's cube —
               an absolute overlay above the cluster, out of the flow: it
               can never push the cube or the number. A tie shares one
               crown over the whole cluster; an empty race is one calm
               centred «—» in the same-size cassette; a lone leader keeps
               the standard top level with the bottom level calmly empty. -->
          <span v-if="z.kind === 'awards'" class="con-strat__race-wrap">
            <span class="con-strat__cassette">
              <TransitionGroup tag="span" class="con-strat__race"
                               :name="motion ? 'con-strat-race' : ''"
                               :css="motion"
                               @before-leave="pinLeaving">
                <span v-for="u in row.units" :key="u.key" class="con-strat__unit">
                  <span class="con-strat__unitbody"
                        :class="['con-strat__unitbody--' + u.rank, {'con-strat__unitbody--lead': u.lead}]">
                    <span class="con-strat__pz">
                      <!-- The cluster: EVERY tied player, full cubes, zero
                           overlap (a tie steps the cube size down instead —
                           equals stay equals, nobody hides behind anybody,
                           never a «+N»). The crown and the gold ARCH anchor
                           to the CLUSTER's own box, so a shared crown sits
                           over the whole group's centre, and the arch
                           follows the group's width. -->
                      <span class="con-strat__chips" :class="'con-strat__chips--n' + Math.min(u.cubes.length, 5)">
                        <i v-if="u.lead && u.cubes.length > 1" class="con-strat__arch" aria-hidden="true"></i>
                        <transition name="con-strat-crowncap" :css="motion">
                          <i v-if="u.lead" class="con-strat__crown" aria-hidden="true">
                            <svg viewBox="0 0 18 15">
                              <path d="M2.4 12.2 L3 5.6 L6.5 8.1 L9 1 L11.5 8.1 L15 5.6 L15.6 12.2 Z" />
                              <path class="con-strat__crown-base" d="M2.9 13 H15.1 A0.62 0.62 0 0 1 15.1 14.24 H2.9 A0.62 0.62 0 0 1 2.9 13 Z" />
                              <path class="con-strat__crown-light" d="M9 3.5 L10.2 7.6 L9 8.8 L7.8 7.6 Z" />
                            </svg>
                          </i>
                        </transition>
                        <i v-for="c in u.cubes" :key="c" class="con-strat__cube"
                           :class="['player_bg_color_' + c, {'con-strat__cube--me': c === viewerColor}]"></i>
                      </span>
                    </span>
                    <b class="con-strat__num" :class="numClasses(z, row, u.key)">{{ u.score }}</b>
                  </span>
                </span>
              </TransitionGroup>
              <span v-if="row.units.length === 0" class="con-strat__none" aria-hidden="true">—</span>
            </span>
          </span>
        </div>
      </TransitionGroup>
    </section>
  </aside>
</template>

<script lang="ts">
/**
 * THE RIGHT STRATEGY RAIL — the console home's Milestones / Awards premium HUD.
 *
 * A compact, icon-first PROJECTION of the same authoritative state every MA
 * surface reads (buildMaHudZone — pure, unit-tested). It answers one glance:
 * which slots are open, who sealed what (colour, never names), what I can
 * claim RIGHT NOW, who leads each award race and by how much. Everything
 * richer — conditions, rival progress, funding — lives in the workspaces the
 * LB/RB caps (and any click here) open.
 *
 * GEOMETRY: the rail is the LEFT resource rail's twin in FOOTPRINT — same
 * width token (`--con-rail-w`), same hull chassis — but not in interior: the
 * left rail is an instrument bank of plated rows; this one is a TROPHY
 * GALLERY — one glass display case on a metallic spine, open shelf rows,
 * oversized medallions on display pucks. Equal weight, different composition.
 * Each zone owns a FIXED half of the case (flex: 1 1 0): the 3/3
 * recomposition redistributes INSIDE that box (keyed leave + FLIP move + the
 * trophy pose), so the rail's outer geometry can never jump.
 *
 * MOTION: seed-then-diff (the maCeremonyState idiom) — the first observation
 * per epoch seeds silently, so mount / reload / reconnect never replay a
 * ceremony. A claim/fund observed live queues a SEAL and plays it only when
 * the rail is actually watchable (`covered` false — the shell's boardHomeIdle
 * gate): the workspace ceremony ends, the workspace folds, the player lands
 * on the board, and the rail seals the medal in front of them — one story.
 * A stale seal (TTL) applies silently: an old ceremony must never replay
 * minutes later. Leadership changes FLIP the two units of a row's duel and
 * tick the numbers — only on a REAL diff, never on a poll re-render.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {Color} from '@/common/Color';
import {MaHudItem, MaHudZone} from '@/client/console/consoleMaHudModel';
import {maArtFitStyle, maDisplayName} from '@/client/components/ma/maArt';
import {consoleReducedMotionActive, consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {translateText} from '@/client/directives/i18n';

/** A queued seal older than this applies silently (mirrors the ceremony TTL). */
const SEAL_TTL_MS = 45_000;
/** One seal beat (matches the CSS `strat-seal-*` keyframes). */
const SEAL_MS = 950;
/** The stagger between two seals landing in the same response. */
const SEAL_STAGGER_MS = 340;
/** The read beat between the LAST seal and the 3/3 recomposition. */
const READ_BEAT_MS = 1050;
/** The value roll's lifetime (matches `strat-roll-up/-down`). */
const TICK_MS = 260;
/** The crown hand-over accent's lifetime (the FLIP + notch impulse). */
const CROWN_MOVE_MS = 650;
/** The milestone ACTIVATION ceremony's lifetime (matches `strat-activate-*`). */
const ACTIVATE_MS = 1100;
/** The short ready-pulse for a RE-gained offer (matches `strat-repulse`). */
const REPULSE_MS = 540;
/** An activation queued under cover older than this applies silently — a
 *  stale «it lit up» must never replay minutes later. */
const ACTIVATION_TTL_MS = 20_000;

type ZoneKind = 'milestones' | 'awards';

/** How a podium unit is ranked: gold 1st, silver REAL 2nd, or a plain
 *  chaser (a group the scoring rules would not pay — see `secondRanked`). */
type RaceRank = 'i' | 'ii' | 'chase';

type RaceUnit = {
  /** The GROUP's identity (colours) — a leader⇄chaser swap keeps both keys,
   *  so the TransitionGroup animates an exchange, not a replace. */
  key: string,
  lead: boolean,
  rank: RaceRank,
  /** EVERY tied player — full cubes, zero overlap, never a «+N» (a tie
   *  steps the cube size down via the cluster-count class instead). */
  cubes: ReadonlyArray<Color>,
  score: number,
};

type RowView = {
  name: string,
  showTaken: boolean,
  takenColor: Color | undefined,
  sealing: boolean,
  my?: MaHudItem['my'],
  availableNow: boolean,
  ready: boolean,
  units: ReadonlyArray<RaceUnit>,
};

type ZoneView = {
  kind: ZoneKind,
  glyph: 'bumperL' | 'bumperR',
  title: string,
  zone: MaHudZone,
  composed: boolean,
  /** The zone's ACTION is offered right now (awards: the door-level accent). */
  armed: boolean,
  /** The tray slot the next seal would fill (−1 = none / not actionable). */
  nextFreeIdx: number,
  rows: ReadonlyArray<RowView>,
};

type PendingSeal = {key: string, kind: ZoneKind, name: string, at: number};

function itemKey(kind: ZoneKind, name: string): string {
  return `${kind === 'milestones' ? 'm' : 'a'}:${name}`;
}

function groupKey(colors: ReadonlyArray<Color>): string {
  return colors.join('.');
}

export default defineComponent({
  name: 'ConsoleStrategyRail',
  components: {GamepadGlyph},
  props: {
    milestones: {type: Object as PropType<MaHudZone>, required: true},
    awards: {type: Object as PropType<MaHudZone>, required: true},
    viewerColor: {type: String as PropType<Color>, required: true},
    /** The game epoch (runId) — a new game reseeds silently. */
    epoch: {type: String, default: ''},
    /**
     * The rail is not watchable right now (a workspace / cinematic / overlay
     * stands over it, or the player left the board home). Seals queue and play
     * on the uncover — the ceremony's continuation, never its rival.
     */
    covered: {type: Boolean, default: false},
  },
  emits: ['open'],
  data() {
    return {
      /** key → taken colour ('' = open) — the seed-then-diff ledger. */
      seen: {} as Record<string, string>,
      seeded: false,
      pending: [] as Array<PendingSeal>,
      sealingKeys: [] as Array<string>,
      /** The pre-claim snapshot a pending/sealing row renders from. */
      heldByKey: {} as Record<string, MaHudItem>,
      /** The 3/3 pose is APPLIED (rows filtered to the taken three). */
      composed: {milestones: false, awards: false} as Record<ZoneKind, boolean>,
      /** Number-roll accents (value keys + a #up/#down direction), short-lived. */
      tickKeys: [] as Array<string>,
      /** Rows whose CROWN is being handed over (a live leader change). */
      crownMoveKeys: [] as Array<string>,
      /** Rows playing the FULL activation ceremony (first live «now»). */
      activatingKeys: [] as Array<string>,
      /** Rows playing the short ready-pulse (a RE-gained offer). */
      repulseKeys: [] as Array<string>,
      /** Activations observed while covered — played on the uncover (TTL). */
      pendingActivations: [] as Array<{key: string, at: number, first: boolean}>,
      /** Live timers — cleared on unmount (no orphan state flips). */
      timers: [] as Array<ReturnType<typeof setTimeout>>,
      flushing: false,
    };
  },
  computed: {
    motion(): boolean {
      return !consoleReducedMotionActive();
    },
    zoneViews(): Array<ZoneView> {
      return [
        this.buildZoneView('milestones', 'bumperL', 'Milestones', this.milestones),
        this.buildZoneView('awards', 'bumperR', 'Awards', this.awards),
      ];
    },
  },
  watch: {
    milestones: {
      handler(zone: MaHudZone) {
        this.observeZone('milestones', zone);
      },
    },
    awards: {
      handler(zone: MaHudZone) {
        this.observeZone('awards', zone);
      },
    },
    covered(now: boolean) {
      if (!now) {
        this.flushSeals();
        this.flushActivations();
      }
    },
    epoch() {
      this.reseed();
    },
  },
  created() {
    // Seed BEFORE the first render: a mount over an already-completed zone
    // must paint the 3/3 pose on its first frame (reconnect / reload never
    // replays a ceremony, not even for one frame).
    this.reseed();
  },
  mounted() {
    // Live diagnostics (the shell's __conColonyDiag idiom): a probe reads
    // the motion machines' ACTUAL state instead of guessing from paint.
    // Read-only snapshot; no gameplay surface.
    (window as unknown as Record<string, unknown>).__stratDiag = () => ({
      covered: this.covered,
      motion: this.motion,
      activating: [...this.activatingKeys],
      repulse: [...this.repulseKeys],
      pendingActivations: this.pendingActivations.map((p) => p.key),
      pendingSeals: this.pending.map((p) => p.key),
      sealing: [...this.sealingKeys],
      nowPrev: [...this.ledgers().nowPrev.entries()],
      everNow: [...this.ledgers().everNow],
    });
  },
  beforeUnmount() {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers = [];
  },
  methods: {
    artStyle(name: string): Record<string, string> {
      // Optical-fit: equal VISUAL mass across assets (measured alpha bboxes),
      // not equal CSS boxes — see maArtFitStyle.
      return maArtFitStyle(name);
    },
    /** The milestone meter's fill — the same score/threshold fact the numbers
     *  print, drawn as a hairline (never a full progress bar). */
    meterStyle(row: RowView): Record<string, string> {
      const score = row.my?.score ?? 0;
      const threshold = row.my?.threshold ?? 0;
      const pct = threshold > 0 ? Math.min(100, Math.round((score / threshold) * 100)) : 0;
      return {width: `${pct}%`};
    },
    /** The slot tray's per-pip presentation: taken = the owner's enamel;
     *  open = a metal contour; the NEXT open slot takes a gold rim while the
     *  zone's action is genuinely offered (the door-level availability cue). */
    pipClass(z: ZoneView, c: Color | undefined, i: number): Array<string | Record<string, boolean>> {
      if (c !== undefined) {
        return ['con-strat__pip--set', 'player_bg_color_' + c];
      }
      return ['con-strat__pip--empty', {'con-strat__pip--next': i === z.nextFreeIdx}];
    },
    /** The row's accessible one-liner: name + the one relevant number.
     *  (Deliberately NOT a hover tooltip: the rail clips its list against
     *  extreme-mod overflow, and a clipped bubble is worse than none — the
     *  workspace, one press away, is the detail surface.) */
    rowHint(z: ZoneView, row: RowView): string {
      const name = translateText(maDisplayName(row.name));
      if (row.showTaken) {
        return `${name} — ${translateText(z.kind === 'milestones' ? 'Claimed' : 'Funded')}`;
      }
      if (z.kind === 'milestones' && row.my !== undefined && !row.my.conditional && row.my.threshold !== undefined) {
        return `${name} — ${row.my.score}/${row.my.threshold}`;
      }
      const lead = row.units.find((u) => u.lead);
      if (lead !== undefined) {
        return `${name} — ${translateText('Leader')}: ${lead.score}`;
      }
      return name;
    },
    rowClasses(z: ZoneView, row: RowView): Record<string, boolean> {
      const key = itemKey(z.kind, row.name);
      return {
        'con-strat__item--taken': row.showTaken && !row.sealing,
        'con-strat__item--sealing': row.sealing,
        // ready/now are the MILESTONE row states (the server offers only the
        // ones actually met). Award availability is door-level (`--armed`) —
        // a whole column of pulsing fundable rows carries no information.
        'con-strat__item--now': !row.showTaken && row.availableNow,
        'con-strat__item--ready': !row.showTaken && row.ready && !row.availableNow,
        // The one-shot activation optics (the ceremony / the ready-pulse).
        'con-strat__item--activating': this.activatingKeys.includes(key),
        'con-strat__item--repulse': this.repulseKeys.includes(key),
        // The crown hand-over accent (a live leader change on this award).
        'con-strat__item--crownmove': this.crownMoveKeys.includes(key),
        'con-strat__item--quiet': z.kind === 'awards' && !row.showTaken,
        'con-strat__item--mine': row.showTaken && row.takenColor === this.viewerColor,
      };
    },
    numClasses(z: ZoneView, row: RowView, slot: string): Record<string, boolean> {
      const vkey = `${itemKey(z.kind, row.name)}|${slot}`;
      return {
        'con-strat__num--tick-up': this.tickKeys.includes(`${vkey}#up`),
        'con-strat__num--tick-down': this.tickKeys.includes(`${vkey}#down`),
        'con-strat__num--ready': z.kind === 'milestones' && row.ready,
        // An untouched milestone count recedes (a column of zeros is noise).
        'con-strat__num--zero': z.kind === 'milestones' && !row.ready &&
          row.my !== undefined && !row.my.conditional && row.my.score === 0,
      };
    },
    buildZoneView(kind: ZoneKind, glyph: 'bumperL' | 'bumperR', title: string, zone: MaHudZone): ZoneView {
      const composed = this.composed[kind];
      const rows: Array<RowView> = [];
      for (const it of zone.items) {
        const key = itemKey(kind, it.name);
        const pendingHere = this.pending.some((p) => p.key === key);
        const sealing = this.sealingKeys.includes(key);
        // A pending seal renders the PRE-claim state (the held snapshot): the
        // final pose must never appear before its own ceremony beat. While the
        // seal PLAYS, the medal takes the owner enamel (animated in by the
        // `--sealing` keyframes) but the value cell still renders the held
        // numbers — their fade-out IS part of the beat.
        const src = (pendingHere || sealing) ? (this.heldByKey[key] ?? it) : it;
        const taken = it.taken !== undefined && !pendingHere;
        if (composed && it.taken === undefined) {
          continue; // the completed pose keeps only the sealed three
        }
        rows.push({
          name: it.name,
          showTaken: taken,
          takenColor: it.taken?.color,
          sealing,
          my: taken && !sealing ? undefined : src.my,
          availableNow: kind === 'milestones' && !taken && src.availableNow,
          ready: kind === 'milestones' && !taken && src.my?.ready === true,
          units: kind === 'awards' ? this.raceUnits(src) : [],
        });
      }
      return {
        kind, glyph, title, zone, composed, rows,
        armed: kind === 'awards' && !composed && zone.actionable > 0,
        // The gold «this is where the next seal lands» pip — only while the
        // action is genuinely offered (money, slot and turn all say yes).
        nextFreeIdx: zone.actionable > 0 ? zone.slots.findIndex((c) => c === undefined) : -1,
      };
    },
    raceUnits(it: MaHudItem): Array<RaceUnit> {
      const units: Array<RaceUnit> = [];
      const push = (group: {colors: ReadonlyArray<Color>, score: number} | undefined, rank: RaceRank) => {
        if (group === undefined) {
          return;
        }
        units.push({
          key: groupKey(group.colors),
          lead: rank === 'i',
          rank,
          cubes: group.colors,
          score: group.score,
        });
      };
      push(it.leader, 'i');
      push(it.second, it.secondRanked === true ? 'ii' : 'chase');
      return units;
    },
    // ── seed-then-diff ─────────────────────────────────────────────────────
    reseed(): void {
      for (const t of this.timers) {
        clearTimeout(t);
      }
      this.timers = [];
      this.seen = {};
      this.pending = [];
      this.sealingKeys = [];
      this.heldByKey = {};
      this.tickKeys = [];
      this.activatingKeys = [];
      this.repulseKeys = [];
      this.pendingActivations = [];
      this.crownMoveKeys = [];
      this.flushing = false;
      const {values, prevOpen, nowPrev, everNow, leadPrev} = this.ledgers();
      values.clear();
      prevOpen.clear();
      nowPrev.clear();
      everNow.clear();
      leadPrev.clear();
      this.seedZone('milestones', this.milestones);
      this.seedZone('awards', this.awards);
      this.composed = {milestones: this.milestones.completed, awards: this.awards.completed};
      this.seeded = true;
    },
    seedZone(kind: ZoneKind, zone: MaHudZone): void {
      const {nowPrev, everNow} = this.ledgers();
      for (const it of zone.items) {
        const key = itemKey(kind, it.name);
        this.seen[key] = it.taken?.color ?? '';
        this.rememberValues(kind, it);
        // The activation ledger seeds SILENTLY: an already-offered claim on
        // mount / reload / reconnect renders straight in its final ready
        // state — the ceremony belongs to the LIVE moment only.
        if (kind === 'milestones') {
          const now = it.taken === undefined && it.availableNow;
          nowPrev.set(key, now);
          if (now) {
            everNow.add(key);
          }
        }
        // The crown ledger seeds silently too — a hand-over accent belongs
        // to a LIVE leader change, never to a mount.
        if (kind === 'awards') {
          this.ledgers().leadPrev.set(key, it.leader !== undefined ? groupKey(it.leader.colors) : '');
        }
      }
    },
    /** The per-value ledger behind the tick accents, the last OPEN face per
     *  item (what a seal renders from), and the ACTIVATION memory (the last
     *  observed «offered now» + «has it ever lit up this epoch») — all
     *  non-reactive on purpose (a Map in data() would deep-proxy every
     *  write), initialized lazily. */
    ledgers(): {values: Map<string, number>, prevOpen: Map<string, MaHudItem>, nowPrev: Map<string, boolean>, everNow: Set<string>, leadPrev: Map<string, string>} {
      const self = this as unknown as {
        _stratValues?: Map<string, number>,
        _stratPrevOpen?: Map<string, MaHudItem>,
        _stratNowPrev?: Map<string, boolean>,
        _stratEverNow?: Set<string>,
        _stratLeadPrev?: Map<string, string>,
      };
      if (self._stratValues === undefined) {
        self._stratValues = new Map();
      }
      if (self._stratPrevOpen === undefined) {
        self._stratPrevOpen = new Map();
      }
      if (self._stratNowPrev === undefined) {
        self._stratNowPrev = new Map();
      }
      if (self._stratEverNow === undefined) {
        self._stratEverNow = new Set();
      }
      if (self._stratLeadPrev === undefined) {
        self._stratLeadPrev = new Map();
      }
      return {values: self._stratValues, prevOpen: self._stratPrevOpen, nowPrev: self._stratNowPrev, everNow: self._stratEverNow, leadPrev: self._stratLeadPrev};
    },
    rememberValues(kind: ZoneKind, it: MaHudItem): void {
      const {values, prevOpen} = this.ledgers();
      const key = itemKey(kind, it.name);
      if (it.my !== undefined) {
        values.set(`${key}|my`, it.my.score);
      }
      if (it.leader !== undefined) {
        values.set(`${key}|${groupKey(it.leader.colors)}`, it.leader.score);
      }
      if (it.second !== undefined) {
        values.set(`${key}|${groupKey(it.second.colors)}`, it.second.score);
      }
      if (it.taken === undefined) {
        prevOpen.set(key, it);
      }
    },
    observeZone(kind: ZoneKind, zone: MaHudZone): void {
      if (!this.seeded) {
        return;
      }
      const now = Date.now();
      for (const it of zone.items) {
        const key = itemKey(kind, it.name);
        const cur = it.taken?.color ?? '';
        const prev = this.seen[key];
        if (prev === undefined) {
          // A new item appeared mid-game (mod edge) — account silently.
          this.seen[key] = cur;
          this.rememberValues(kind, it);
          continue;
        }
        if (prev === '' && cur !== '') {
          // CLAIMED / FUNDED — queue the seal; hold the pre-claim face.
          this.seen[key] = cur;
          // The claim consumes any live/queued activation optics for the row.
          this.activatingKeys = this.activatingKeys.filter((k) => k !== key);
          this.repulseKeys = this.repulseKeys.filter((k) => k !== key);
          this.pendingActivations = this.pendingActivations.filter((p) => p.key !== key);
          this.ledgers().nowPrev.set(key, false);
          if (this.motion) {
            this.heldByKey[key] = this.lastOpenSnapshot(kind, it);
            this.pending.push({key, kind, name: it.name, at: now});
          } else {
            this.scheduleCompose(kind);
          }
        } else if (prev !== '' && cur === '') {
          // UNDO — roll the ledger back silently; the pose follows the truth.
          this.seen[key] = '';
          this.pending = this.pending.filter((p) => p.key !== key);
          this.sealingKeys = this.sealingKeys.filter((k) => k !== key);
          delete this.heldByKey[key];
          this.composed[kind] = zone.completed;
        } else if (cur === '') {
          this.tickChangedValues(kind, it);
          if (kind === 'milestones') {
            this.observeAvailability(key, it.availableNow);
          }
        }
        if (kind === 'awards') {
          this.observeLeadShift(key, it);
        }
        this.rememberValues(kind, it);
      }
      if (!this.covered) {
        this.flushSeals();
      }
      // No live seal will fire (reduced motion / TTL paths handled above) —
      // keep the composed pose honest for a zone that completed while away.
      if (zone.completed && !this.composed[kind] &&
          !this.pending.some((p) => p.kind === kind) &&
          !this.sealingKeys.some((k) => k.startsWith(kind === 'milestones' ? 'm:' : 'a:'))) {
        if (this.covered || !this.motion) {
          this.composed[kind] = true;
        }
      }
    },
    /** The pre-claim face: the LAST OPEN view of this item (its numbers
     *  intact) — never the final pose; the seal is what introduces that. */
    lastOpenSnapshot(kind: ZoneKind, it: MaHudItem): MaHudItem {
      const held = this.ledgers().prevOpen.get(itemKey(kind, it.name));
      return held !== undefined ?
        {...held, availableNow: false} :
        {...it, taken: undefined, availableNow: false};
    },
    // ── the ACTIVATION machine (milestones: «became claimable NOW») ───────
    /**
     * The rising edge of the SERVER's own offer (the claim option's presence
     * in the waitingFor tree — the same authority every claim surface obeys;
     * never a client-side `score >= threshold` approximation). The FULL
     * ceremony plays once per row per epoch, on a LIVE watched transition;
     * a RE-gained offer (the blocker cleared again — a new turn) gets the
     * short ready-pulse; a flip under cover queues for the uncover (TTL —
     * a stale «it lit up» never replays late); reduced motion applies the
     * final state instantly (the rim/word/contrast carry it).
     */
    observeAvailability(key: string, availableNow: boolean): void {
      const {nowPrev, everNow} = this.ledgers();
      const prev = nowPrev.get(key) ?? false;
      nowPrev.set(key, availableNow);
      if (prev || !availableNow) {
        return;
      }
      const first = !everNow.has(key);
      everNow.add(key);
      if (!this.motion) {
        return;
      }
      if (this.covered) {
        this.pendingActivations.push({key, at: Date.now(), first});
        return;
      }
      this.playActivation(key, first);
    },
    playActivation(key: string, first: boolean): void {
      if (first) {
        this.activatingKeys = [...this.activatingKeys, key];
        this.later(() => {
          this.activatingKeys = this.activatingKeys.filter((k) => k !== key);
        }, consoleMotionMs(ACTIVATE_MS));
      } else {
        this.repulseKeys = [...this.repulseKeys, key];
        this.later(() => {
          this.repulseKeys = this.repulseKeys.filter((k) => k !== key);
        }, consoleMotionMs(REPULSE_MS));
      }
    },
    flushActivations(): void {
      const due = this.pendingActivations;
      if (due.length === 0) {
        return;
      }
      this.pendingActivations = [];
      const now = Date.now();
      for (const p of due) {
        // Silently apply when stale OR when the offer has meanwhile gone.
        if (now - p.at > ACTIVATION_TTL_MS || this.ledgers().nowPrev.get(p.key) !== true) {
          continue;
        }
        this.playActivation(p.key, p.first);
      }
    },
    /** A LIVE leader change hands the crown over: the FLIP already moves
     *  the cubes along the cassette's axes — this adds the short gold-notch
     *  confirmation impulse on the receiving level (never on mount/reseed,
     *  never when the leading group is unchanged, never while covered). */
    observeLeadShift(key: string, it: MaHudItem): void {
      const {leadPrev} = this.ledgers();
      const cur = it.leader !== undefined ? groupKey(it.leader.colors) : '';
      const prev = leadPrev.get(key);
      leadPrev.set(key, cur);
      if (prev === undefined || prev === cur || !this.motion || this.covered) {
        return;
      }
      // A hand-over needs a live crown on BOTH sides (empty → ranked is the
      // rail's own ignition, not a transfer).
      if (prev === '' || cur === '' || this.crownMoveKeys.includes(key)) {
        return;
      }
      this.crownMoveKeys = [...this.crownMoveKeys, key];
      this.later(() => {
        this.crownMoveKeys = this.crownMoveKeys.filter((k) => k !== key);
      }, consoleMotionMs(CROWN_MOVE_MS));
    },
    tickChangedValues(kind: ZoneKind, it: MaHudItem): void {
      if (this.covered || !this.motion) {
        return;
      }
      const ledger = this.ledgers().values;
      const key = itemKey(kind, it.name);
      const candidates: Array<[string, number | undefined]> = [];
      if (it.my !== undefined) {
        candidates.push([`${key}|my`, it.my.score]);
      }
      if (it.leader !== undefined) {
        candidates.push([`${key}|${groupKey(it.leader.colors)}`, it.leader.score]);
      }
      if (it.second !== undefined) {
        candidates.push([`${key}|${groupKey(it.second.colors)}`, it.second.score]);
      }
      for (const [vkey, value] of candidates) {
        const prev = ledger.get(vkey);
        if (prev !== undefined && value !== undefined && prev !== value &&
            !this.tickKeys.some((k) => k.startsWith(`${vkey}#`))) {
          // The roll carries the change's DIRECTION (digits rise on a gain).
          const entry = `${vkey}#${value > prev ? 'up' : 'down'}`;
          this.tickKeys.push(entry);
          this.later(() => {
            this.tickKeys = this.tickKeys.filter((k) => k !== entry);
          }, consoleMotionMs(TICK_MS));
        }
      }
    },
    // ── the seal pipeline ──────────────────────────────────────────────────
    flushSeals(): void {
      if (this.flushing || this.pending.length === 0) {
        return;
      }
      const now = Date.now();
      // Stale seals (the player was away past the TTL) apply silently.
      const stale = this.pending.filter((p) => now - p.at > SEAL_TTL_MS);
      if (stale.length > 0) {
        this.pending = this.pending.filter((p) => now - p.at <= SEAL_TTL_MS);
        for (const p of stale) {
          delete this.heldByKey[p.key];
          this.scheduleCompose(p.kind);
        }
      }
      if (this.pending.length === 0 || this.covered) {
        return;
      }
      if (!this.motion) {
        for (const p of this.pending) {
          delete this.heldByKey[p.key];
          this.scheduleCompose(p.kind);
        }
        this.pending = [];
        return;
      }
      this.flushing = true;
      const queue = [...this.pending];
      const kinds = new Set<ZoneKind>();
      let delay = consoleMotionMs(140);
      for (const p of queue) {
        kinds.add(p.kind);
        this.later(() => {
          this.pending = this.pending.filter((q) => q.key !== p.key);
          // An UNDO raced this beat (the slot re-opened while the seal was
          // queued): nothing to stamp — the truth is already rendered.
          if (this.seen[p.key] === '' || this.seen[p.key] === undefined) {
            return;
          }
          this.sealingKeys = [...this.sealingKeys, p.key];
        }, delay);
        this.later(() => {
          this.sealingKeys = this.sealingKeys.filter((k) => k !== p.key);
          delete this.heldByKey[p.key];
        }, delay + consoleMotionMs(SEAL_MS));
        delay += consoleMotionMs(SEAL_STAGGER_MS);
      }
      const settle = delay - consoleMotionMs(SEAL_STAGGER_MS) + consoleMotionMs(SEAL_MS);
      this.later(() => {
        this.flushing = false;
        for (const kind of kinds) {
          this.scheduleCompose(kind, consoleMotionMs(READ_BEAT_MS));
        }
        // Seals queued while this run was in flight play on the next uncover
        // check (covered may have flipped meanwhile).
        if (!this.covered) {
          this.flushSeals();
        }
      }, settle);
    },
    /** Apply the 3/3 pose (after the read beat, or instantly when silent). */
    scheduleCompose(kind: ZoneKind, afterMs = 0): void {
      const zone = kind === 'milestones' ? this.milestones : this.awards;
      if (!zone.completed || this.composed[kind]) {
        return;
      }
      if (afterMs <= 0 || !this.motion) {
        this.composed[kind] = true;
        return;
      }
      this.later(() => {
        const z = kind === 'milestones' ? this.milestones : this.awards;
        if (z.completed) {
          this.composed[kind] = true;
        }
      }, afterMs);
    },
    later(fn: () => void, ms: number): void {
      const t = setTimeout(() => {
        this.timers = this.timers.filter((x) => x !== t);
        fn();
      }, ms);
      this.timers.push(t);
    },
    /** FLIP hygiene: a leaving row goes `position: absolute` — pin it to the
     *  spot it occupied, or it snaps to the list origin before fading. */
    pinLeaving(el: Element): void {
      const e = el as HTMLElement;
      e.style.top = `${e.offsetTop}px`;
      e.style.left = `${e.offsetLeft}px`;
      e.style.width = `${e.offsetWidth}px`;
    },
  },
});
</script>
