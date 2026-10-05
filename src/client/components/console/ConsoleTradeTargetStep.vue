<template>
  <!--
    THE TRADE'S TARGET STEP — «куда положить награду» as a DEEPER LEVEL of the
    trade's own stage. ONE host for every stage a trade composes on: the colony
    focus stage (a reward / bonus that lands on a card — Titan's floaters) and
    the fleet-dock stage (a dock whose reward lands on a card — TR27 Aurora
    Station). It owns the step's room, the cursor over the SHARED played-card
    selector (`ConsolePlayedTargetStep` — the very surface the blue-action and
    play composers descend into) and the step's own grammar; the stage owns
    WHEN it stands (`sub === 'targets'`) and what the answer means (a capture).

    The root keeps the colony stage's class on purpose: its box, its light pool
    and its pose are one design in both stages (a stage positions the room).
    No ask line of its own: the selector's contract header states the server's
    ask and the target scope.
  -->
  <section class="con-colfocus__targetstage" ref="zone">
    <ConsolePlayedTargetStep v-if="focus !== undefined"
                             ref="targetStep"
                             :model="model"
                             :layout="layout"
                             :focus="focus"
                             :bandHeight="bandH"
                             :lockedCard="lockedCard" />
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  planPlayedTargetLayout, playedTargetAt, playedTargetSourceCardName,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {openTradeTargetFocus} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {playColonyTargetStepEnter, playColonyTargetStepLeave} from '@/client/console/consoleColonyFocusMotion';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';

export default defineComponent({
  name: 'ConsoleTradeTargetStep',
  components: {ConsolePlayedTargetStep},
  props: {
    /** The selector's model of THIS step (`colonyTradeTargetStep.buildColonyTradeTargetModel`). */
    model: {type: Object as PropType<PlayedTargetModel>, required: true},
    /** The card already chosen for this step ('' = none) — the cursor lands on it and the selector marks it. */
    lockedCard: {type: String, default: ''},
  },
  emits: ['pick'],
  data() {
    return {
      /** Seeded from the ONE opening answer (`openTradeTargetFocus`) — the stage opens the step only when it exists. */
      focus: openTradeTargetFocus(this.model, this.lockedCard) as PlayedTargetFocus | undefined,
      zoneW: 0,
      zoneH: 0,
    };
  },
  computed: {
    layout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.model.owners,
        availW: this.zoneW > 0 ? this.zoneW : 900,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The step's vertical budget — the zone IS the room (its own contract header and rail are part of the step). */
    bandH(): number {
      return Math.max(0, this.zoneH);
    },
  },
  methods: {
    /**
     * THE STEP TAKES THE ROOM IT IS GIVEN — measured once it stands. CONTENT
     * box, not client box: a budget fed the zone's own padding solves cards for
     * room that does not exist — a hairline scroll rail and a cropped bottom row
     * at 4K.
     */
    measureZone(): void {
      const zone = this.$refs.zone as HTMLElement | undefined;
      if (zone === undefined || zone === null) {
        return;
      }
      const cs = getComputedStyle(zone);
      this.zoneW = Math.max(0, zone.clientWidth -
        (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      this.zoneH = Math.max(0, zone.clientHeight -
        (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    },
    /** B — the step lets go in its own phrase, then the stage drops it (`done`). */
    close(done: () => void): void {
      const zone = this.$refs.zone as HTMLElement | undefined;
      if (zone !== undefined && zone !== null) {
        playColonyTargetStepLeave(zone, done);
      } else {
        done();
      }
    },
    nav(dir: NavDirection): void {
      const owners = this.model.owners;
      const focus = this.focus;
      if (focus === undefined || owners.length === 0) {
        return;
      }
      const map: Record<string, PlayedTargetNavDir | undefined> =
        {left: 'left', right: 'right', up: 'up', down: 'down'};
      const d = map[dir as string];
      if (d === undefined) {
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(focus, d, cells) :
        stepPlayedTargetFocus(focus, d, owners, this.layout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent owner change
      }
      this.focus = next;
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** LB/RB — the owner axis, tabbed mode only (the shared grammar; a trade's targets are normally the viewer's own single group). */
    cycleOwner(delta: number): void {
      const owners = this.model.owners;
      const focus = this.focus;
      if (focus === undefined || this.layout.mode !== 'tabs' || owners.length < 2) {
        return;
      }
      const ownerId = stepPlayedTargetOwner(focus.ownerId, delta, owners);
      if (ownerId !== focus.ownerId) {
        this.focus = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focus;
      }
    },
    /**
     * A — the focused candidate is THE answer. The stage turns it into its
     * capture (the same `{type:'card', cards:[name]}` the batch always sent):
     * the selector is presentation, never a second source of truth.
     */
    confirm(): void {
      const candidate = playedTargetAt(this.focus, this.model.owners);
      if (candidate !== undefined) {
        this.$emit('pick', candidate.cardName as CardName);
      }
    },
    /** X — the focused candidate fullscreen, lifting from its own slot (the console-wide «X inspects the current object»). */
    inspect(): void {
      const owners = this.model.owners;
      const candidate = playedTargetAt(this.focus, owners);
      if (candidate === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === candidate.cardName));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        origin: playedTargetZoomOrigin(
          () => this.$refs.zone as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          playedTargetSourceCardName(owners)),
      });
    },
  },
  mounted() {
    this.measureZone();
    const zone = this.$refs.zone as HTMLElement | undefined;
    if (zone !== undefined && zone !== null) {
      playColonyTargetStepEnter(zone);
    }
  },
});
</script>
