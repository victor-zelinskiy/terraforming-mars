<template>
  <aside class="con-strat" :aria-label="$t('Milestones') + ' · ' + $t('Awards')">
    <section v-for="z in zoneViews" :key="z.kind"
             class="con-strat__zone"
             :class="['con-strat__zone--' + z.kind, {
               'con-strat__zone--done': z.composed,
               'con-strat__zone--dense': z.zone.items.length > 6 && !z.composed,
               'con-strat__zone--ultra': z.zone.items.length > 9 && !z.composed,
             }]">
      <!-- The zone head IS the workspace door: the LB/RB cap the shell already
           answers to, made clickable for the mouse. The glyph must survive
           every state (open / completed) — it is the door, not a status. -->
      <button type="button" class="con-strat__head"
              :aria-label="$t(z.title)"
              @click="$emit('open', z.kind)">
        <span class="con-strat__key" aria-hidden="true"><GamepadGlyph :control="z.glyph" /></span>
        <span class="con-strat__title">{{ $t(z.title) }}</span>
      </button>
      <!-- The system line: the 3-slot diamond tray (the SAME grammar as the
           workspace header's tally — filled with each taker's colour) and the
           live price of the next claim/fund. The completed pose trades the
           price for the sealed gold mark: nothing here is buyable any more. -->
      <div class="con-strat__meta">
        <span class="con-strat__slots" aria-hidden="true">
          <i v-for="(c, i) in z.zone.slots" :key="i"
             class="con-strat__pip"
             :class="c !== undefined ? 'player_bg_color_' + c : 'con-strat__pip--empty'"></i>
        </span>
        <transition :name="motion ? 'con-strat-meta' : ''" mode="out-in">
          <span v-if="z.composed" key="done" class="con-strat__done" aria-hidden="true">✓</span>
          <span v-else key="price" class="con-strat__price" :class="{'con-strat__price--free': z.zone.cost === 0}">
            <b>{{ z.zone.cost }}</b>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </span>
        </transition>
      </div>

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
          <span class="con-strat__medal">
            <!-- Owner enamel: an under-plate washed in the owner's colour +
                 the corner gem (the tray's diamond, full strength). Present
                 only once taken — the seal animation brings both in. -->
            <i v-if="row.showTaken" class="con-strat__plate"
               :class="'player_bg_color_' + row.takenColor" aria-hidden="true"></i>
            <i class="con-strat__halo" aria-hidden="true"></i>
            <i class="con-strat__art" :style="artStyle(row.name)" aria-hidden="true"></i>
            <i v-if="row.showTaken" class="con-strat__gem"
               :class="['player_bg_color_' + row.takenColor, {'con-strat__gem--me': row.takenColor === viewerColor}]"
               aria-hidden="true"></i>
            <i class="con-strat__kiss" aria-hidden="true"></i>
          </span>

          <!-- MILESTONES: my own count toward the threshold — the one number
               that matters here; everything richer lives in the workspace. -->
          <span v-if="z.kind === 'milestones' && row.my !== undefined" class="con-strat__cell">
            <template v-if="row.my.conditional">
              <b class="con-strat__num" :class="numClasses(z, row, 'my')">{{ row.my.ready ? '✓' : '—' }}</b>
            </template>
            <template v-else>
              <b class="con-strat__num" :class="numClasses(z, row, 'my')">{{ row.my.score }}</b>
              <i v-if="row.my.threshold !== undefined" class="con-strat__req">/{{ row.my.threshold }}</i>
            </template>
          </span>

          <!-- AWARDS: the live duel — leader above, chaser below. Hierarchy is
               position + size + weight, never a per-row crown. A tie shows up
               to two cubes, then «+N»; the viewer's cube is rimmed white. -->
          <span v-else-if="z.kind === 'awards'" class="con-strat__race-wrap">
            <TransitionGroup tag="span" class="con-strat__race"
                             :name="motion ? 'con-strat-race' : ''"
                             :css="motion"
                             @before-leave="pinLeaving">
              <span v-for="u in row.units" :key="u.key" class="con-strat__unit">
                <span class="con-strat__unitbody" :class="{'con-strat__unitbody--lead': u.lead}">
                  <i v-for="c in u.cubes" :key="c" class="con-strat__cube"
                     :class="['player_bg_color_' + c, {'con-strat__cube--me': c === viewerColor}]"></i>
                  <span v-if="u.more > 0" class="con-strat__morecnt">+{{ u.more }}</span>
                  <b class="con-strat__num" :class="numClasses(z, row, u.key)">{{ u.score }}</b>
                </span>
              </span>
              <span v-if="row.units.length === 0" key="none" class="con-strat__none" aria-hidden="true">—</span>
            </TransitionGroup>
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
 * GEOMETRY: the rail is the LEFT resource rail's twin — same width token
 * (`--con-rail-w`), same glass, so the board reads as centred between two
 * equal instruments. Each zone owns a FIXED half of the rail (flex: 1 1 0):
 * the 3/3 recomposition redistributes INSIDE that box (keyed leave + FLIP
 * move + the trophy pose), so the rail's outer geometry can never jump.
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
import {maArtUrl, maDisplayName} from '@/client/components/ma/maArt';
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
/** The value tick's lifetime (matches `strat-tick`). */
const TICK_MS = 460;

type ZoneKind = 'milestones' | 'awards';

type RaceUnit = {
  /** The GROUP's identity (colours) — a leader⇄chaser swap keeps both keys,
   *  so the TransitionGroup animates an exchange, not a replace. */
  key: string,
  lead: boolean,
  cubes: ReadonlyArray<Color>,
  more: number,
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
  rows: ReadonlyArray<RowView>,
};

type PendingSeal = {key: string, kind: ZoneKind, name: string, at: number};

function itemKey(kind: ZoneKind, name: string): string {
  return `${kind === 'milestones' ? 'm' : 'a'}:${name}`;
}

function groupKey(colors: ReadonlyArray<Color>): string {
  return colors.join('.');
}

/** Cubes shown per race unit before the rest collapse to «+N». */
const MAX_UNIT_CUBES = 2;

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
      /** Number-tick accents (value keys), short-lived. */
      tickKeys: [] as Array<string>,
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
  beforeUnmount() {
    for (const t of this.timers) {
      clearTimeout(t);
    }
    this.timers = [];
  },
  methods: {
    artStyle(name: string): Record<string, string> {
      return {backgroundImage: `url(${maArtUrl(name)})`};
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
      return {
        'con-strat__item--taken': row.showTaken && !row.sealing,
        'con-strat__item--sealing': row.sealing,
        'con-strat__item--now': !row.showTaken && row.availableNow,
        'con-strat__item--ready': !row.showTaken && row.ready && !row.availableNow,
        'con-strat__item--quiet': z.kind === 'awards' && !row.showTaken,
        'con-strat__item--mine': row.showTaken && row.takenColor === this.viewerColor,
      };
    },
    numClasses(z: ZoneView, row: RowView, slot: string): Record<string, boolean> {
      return {
        'con-strat__num--tick': this.tickKeys.includes(`${itemKey(z.kind, row.name)}|${slot}`),
        'con-strat__num--ready': z.kind === 'milestones' && row.ready,
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
          availableNow: !taken && src.availableNow,
          ready: !taken && src.my?.ready === true,
          units: kind === 'awards' ? this.raceUnits(src) : [],
        });
      }
      return {kind, glyph, title, zone, composed, rows};
    },
    raceUnits(it: MaHudItem): Array<RaceUnit> {
      const units: Array<RaceUnit> = [];
      const push = (group: {colors: ReadonlyArray<Color>, score: number} | undefined, lead: boolean) => {
        if (group === undefined) {
          return;
        }
        const capped = group.colors.length > MAX_UNIT_CUBES ? group.colors.slice(0, 1) : group.colors;
        units.push({
          key: groupKey(group.colors),
          lead,
          cubes: capped,
          more: group.colors.length > MAX_UNIT_CUBES ? group.colors.length - 1 : 0,
          score: group.score,
        });
      };
      push(it.leader, true);
      push(it.second, false);
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
      this.flushing = false;
      const {values, prevOpen} = this.ledgers();
      values.clear();
      prevOpen.clear();
      this.seedZone('milestones', this.milestones);
      this.seedZone('awards', this.awards);
      this.composed = {milestones: this.milestones.completed, awards: this.awards.completed};
      this.seeded = true;
    },
    seedZone(kind: ZoneKind, zone: MaHudZone): void {
      for (const it of zone.items) {
        this.seen[itemKey(kind, it.name)] = it.taken?.color ?? '';
        this.rememberValues(kind, it);
      }
    },
    /** The per-value ledger behind the tick accents + the last OPEN face per
     *  item (what a seal renders from) — non-reactive on purpose (a Map in
     *  data() would deep-proxy every write), initialized lazily. */
    ledgers(): {values: Map<string, number>, prevOpen: Map<string, MaHudItem>} {
      const self = this as unknown as {_stratValues?: Map<string, number>, _stratPrevOpen?: Map<string, MaHudItem>};
      if (self._stratValues === undefined) {
        self._stratValues = new Map();
      }
      if (self._stratPrevOpen === undefined) {
        self._stratPrevOpen = new Map();
      }
      return {values: self._stratValues, prevOpen: self._stratPrevOpen};
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
        if (prev !== undefined && value !== undefined && prev !== value && !this.tickKeys.includes(vkey)) {
          this.tickKeys.push(vkey);
          this.later(() => {
            this.tickKeys = this.tickKeys.filter((k) => k !== vkey);
          }, TICK_MS);
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
