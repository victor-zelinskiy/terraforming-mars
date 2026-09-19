<template>
  <!-- RESULTS — the previous generation's political phase, one beat per
       line; each line lights the object it changed and MOVES the
       delegates it moved. -->
  <div class="con-parl__stage-head con-parl__stage-head--recap">
    <div>
      <b class="con-parl__stage-title">{{ recapKicker }}</b>
      <span class="con-parl__stage-sub">{{ $t('What the Parliament decided at the end of the generation') }}</span>
    </div>
    <div class="con-parl__cta con-parl__cta--ready con-parl__cta--inline" data-parl-cta @click="finish()">
      <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
      <span class="con-parl__cta-label">{{ $t('Continue') }}</span>
    </div>
  </div>
  <ol class="con-parl__recap-list" data-parl-recap-list>
    <li v-for="(item, i) in recapItems" :key="item.key"
        class="con-parl__recap-item"
        :class="{'con-parl__recap-item--shown': i <= recapBeat, 'con-parl__recap-item--now': i === recapBeat}"
        :data-focus="item.focus">{{ item.text }}</li>
  </ol>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {Resource} from '@/common/Resource';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {parliamentFlow, parliamentRootEl, STAGE_UNFOLD_MS} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {
  DEAL_FLIGHT_MS, DEAL_STAGGER_MS, dropFlight, ENACT_MOVE_MS, flightEl, flyCard, flyCube, killParliamentFlights, nextFlightId,
  placeCubeRect, pushCardFlight, rectOf, registerFlightHandle,
} from '@/client/console/parliament/parliamentFlights';
import {Rect, runCardDealFlight} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {AgendaMove, parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {cardResourcePluralKey, productionResourceLabelKey, scaledEffectOf, yieldCountPresentation} from '@/client/console/parliament/influenceYieldModel';

/** One results beat: the next line lights and the object it names flashes / moves. */
const RECAP_BEAT_MS = 1000;

/** A results beat: what the sentence says, and which object on the board it points at. */
export type RecapItem = {
  key: string;
  text: string;
  focus: 'winner' | 'enacted' | 'agenda' | 'support' | 'refresh' | 'lobby';
  step?: number;
  parties?: ReadonlyArray<ReduxParty>;
  /** The Agenda beat PLAYS the winner's marker along the track. */
  move?: AgendaMove;
  /** An effect beat: the server's record it reads (a production / stock gain of the viewer flies). */
  outcome?: ParliamentEnactOutcomeModel;
};

/**
 * THE RESULTS SCENE (temporary — the sitting flow replaces it): the previous
 * political phase retold beat by beat inside the middle tier's stage zone.
 * The section decides WHEN it opens (once per generation) and seeds the
 * display holds before the stage unfolds; this component runs the beats —
 * each one lights its object, flies the cubes and cards its sentence names,
 * and hands its focus up (`beat`) so the tiers can light theirs.
 */
export default defineComponent({
  name: 'ConsoleParliamentRecap',
  components: {GamepadGlyph},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
  },
  emits: ['beat', 'close'],
  data() {
    return {
      /** The results scene's current beat (−1 = not playing). */
      recapBeat: -1,
      recapTimers: [] as Array<number>,
    };
  },
  computed: {
    recapKicker(): string {
      const last = this.model?.lastPhase;
      return last === undefined ? '' : translateTextWithParams('Results of generation ${0}', [String(last.generation)]);
    },
    recapItems(): Array<RecapItem> {
      const last = this.model?.lastPhase;
      if (last === undefined || last.generation !== this.playerView.game.generation - 1) {
        return [];
      }
      const resolutionName = (id: string): string => translateText(this.resolutionTitle(id));
      const items: Array<RecapItem> = [];
      items.push({key: 'winner', focus: 'winner', text: translateTextWithParams('${0} (${1}) won the vote — delegates: ${2}, winning player: ${3}', [
        resolutionName(last.winner.resolution), translateText(last.winner.party), String(last.winner.votes), this.nameOf(last.winner.player)])});
      if (last.agenda !== undefined) {
        const bonus = last.agenda.bonus === 'tr' ? translateText('+1 TR') : last.agenda.bonus === 'card' ? translateText('+1 card') : '';
        items.push({key: 'agenda', focus: 'agenda', step: last.agenda.to,
          move: {player: last.agenda.player, from: last.agenda.from, to: last.agenda.to},
          text: translateTextWithParams('${0} advanced on the Agenda track to step ${1} ${2}', [this.nameOf(last.agenda.player), String(last.agenda.to), bonus]).trim()});
      }
      items.push({key: 'enacted', focus: 'enacted', text: translateTextWithParams('${0} is enacted — ${1} now rule; its delegates return to their reserves', [resolutionName(last.enacted.resolution), translateText(last.enacted.party)])});
      // THE EFFECT AS IT WAS APPLIED — the server's own record per player and
      // step (amounts as paid, skips with their reason): one beat per outcome,
      // the viewer's own first. The SAME skip for several seats (the same part,
      // the same reason — a table with nothing to count) is ONE beat that names
      // every one of them: nothing goes silent, and a crowded table's results
      // still fit on one screen.
      const outcomes = [...(last.outcomes ?? [])].sort((a, b) => Number(b.player === this.viewerColor) - Number(a.player === this.viewerColor));
      const skips = new Map<string, {item: RecapItem, players: Array<ParliamentEnactOutcomeModel['player']>}>();
      for (const outcome of outcomes) {
        const item: RecapItem = {key: `outcome:${outcome.player}:${outcome.step}`, focus: 'enacted', text: this.outcomeText(outcome), outcome};
        if (outcome.kind === 'skipped') {
          const signature = `${this.skippedPartOf(outcome)}|${outcome.reason ?? ''}`;
          const group = skips.get(signature);
          if (group !== undefined) {
            if (!group.players.includes(outcome.player)) {
              group.players.push(outcome.player);
              group.item.text = this.outcomeText(outcome, group.players.map((player) => this.nameOf(player)).join(', '));
            }
            continue;
          }
          skips.set(signature, {item, players: [outcome.player]});
        }
        items.push(item);
      }
      const gained = last.support.filter((s) => s.gained > 0);
      if (gained.length > 0) {
        items.push({key: 'support', focus: 'support', parties: gained.map((s) => s.party),
          text: translateTextWithParams('Popular support: ${0}', [gained.map((s) => `${translateText(s.party)} +${s.gained}`).join(' · ')])});
      }
      if (last.refreshed.length > 0) {
        items.push({key: 'refresh', focus: 'refresh', text: translateTextWithParams('${0} new resolutions entered the voting area; popular support votes for them', [String(last.refreshed.length)])});
      }
      if (last.lobbyRefilled.length > 0) {
        items.push({key: 'lobby', focus: 'lobby', text: translateText('Every player\'s free delegate returns to the lobby')});
      }
      return items;
    },
  },
  watch: {
    /** The results scene's beats MOVE the objects their sentences name (the section lights the tiers and glides the Agenda marker). */
    recapBeat(beat: number): void {
      const item = parliamentFlow.stage === 'recap' ? this.recapItems[beat] : undefined;
      this.$emit('beat', item);
      if (item === undefined) {
        return;
      }
      void this.$nextTick(() => this.playRecapFlights(item));
    },
  },
  mounted() {
    // The stage has unfolded around the seeded holds: the first beat lights a
    // tick later, the enacted card parks over its former slot once the stage
    // stands, and every later beat follows on the scene's own clock.
    void this.$nextTick(() => {
      this.recapBeat = 0;
    });
    if (parliamentHolds.govAwaits !== undefined) {
      this.recapTimers.push(window.setTimeout(() => this.parkEnactedCard(), consoleMotionMs(STAGE_UNFOLD_MS)));
    }
    const items = this.recapItems;
    for (let i = 1; i < items.length; i++) {
      this.recapTimers.push(window.setTimeout(() => {
        this.recapBeat = i;
      }, consoleMotionMs(RECAP_BEAT_MS) * i));
    }
  },
  beforeUnmount() {
    this.clearRecapTimers();
  },
  methods: {
    nameOf(color: Color | 'neutral' | undefined): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    resolutionTitle(id: string): string {
      return resolutionTitleOf(this.view, id);
    },
    /** A / B / the plate's own button: the scene is over — every hold settles, the stage folds. */
    finish(): void {
      this.clearRecapTimers();
      killParliamentFlights();
      resetParliamentHolds();
      this.recapBeat = -1;
      this.$emit('close');
    },
    clearRecapTimers(): void {
      for (const timer of this.recapTimers) {
        window.clearTimeout(timer);
      }
      this.recapTimers = [];
    },
    /** A results beat MOVES the delegates its sentence names, from where they were to where they went. */
    playRecapFlights(item: RecapItem): void {
      const root = parliamentRootEl();
      if (root === undefined || parliamentFlow.stage !== 'recap') {
        return;
      }
      const last = this.model?.lastPhase;
      if (last === undefined) {
        return;
      }
      const holds = parliamentHolds;
      if (item.outcome !== undefined) {
        this.playOutcomeFlight(item.outcome);
        return;
      }
      if (item.focus === 'enacted' && holds.govAwaits !== undefined) {
        // THE CARD MOVES FIRST: from the voting slot it won in to the
        // government; its delegates leave it once it has landed there.
        this.moveEnactedCard(root, () => this.playRecapFlights(item));
        return;
      }
      switch (item.focus) {
      case 'enacted': {
        // The enacted card's delegates go home: players' to their reserves, neutral to the supply.
        // Each leaves the card as the CUBE it is — born over the card's centre at the size of the
        // cube it lands as. The flight scales by the ratio of its two rects, so the card's own rect
        // as the source drew a card-sized block shrinking all the way home.
        const card = rectOf(root.querySelector('.con-parl__gov-card .pcard') ?? root.querySelector('.con-parl__gov-card'));
        let i = 0;
        for (const [owner, count] of Array.from(holds.returns.entries())) {
          const to = placeCubeRect(root, owner === 'neutral' ? '[data-parl-neutral-cube]' : `[data-parl-seat-reserve="${owner}"]`);
          const from = card === undefined || to === undefined ? undefined :
            {left: card.left + card.width / 2 - to.width / 2, top: card.top + card.height / 2 - to.height / 2, width: to.width, height: to.height};
          for (let n = 0; n < count; n++) {
            const delay = i * 70;
            i++;
            flyCube(owner, from, to, delay, () => {
              const left = (holds.returns.get(owner) ?? 0) - 1;
              if (left <= 0) {
                holds.returns.delete(owner);
              } else {
                holds.returns.set(owner, left);
              }
            });
          }
        }
        if (i === 0) {
          holds.returns.clear();
        }
        return;
      }
      case 'refresh': {
        // THE DEAL first: each fresh resolution leaves the deck's TOP card
        // (the head line's pile), grows into its slot and shows its face on
        // the touchdown; the pile's count ticks per card. Then popular
        // support becomes votes: each party's steel cubes leave their places
        // for the fresh card.
        const deckTop = rectOf(root.querySelector('[data-parl-deck-top]'));
        let dealt = 0;
        for (const fresh of last.refreshed) {
          if (!holds.freshFaces.has(fresh.instance)) {
            continue;
          }
          const face = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card .pcard`) ??
            root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card`);
          // The pile is one card thinner the moment the card SEPARATES from
          // it (the count ticks at the launch — the project deck's language);
          // the face beneath the proxy shows on the touchdown.
          const launched = () => {
            holds.deckPending = Math.max(0, holds.deckPending - 1);
          };
          const landed = () => {
            holds.freshFaces.delete(fresh.instance);
          };
          if (!flyCard(deckTop, rectOf(face), dealt * DEAL_STAGGER_MS, landed, launched)) {
            launched();
            landed();
          } else {
            dealt++;
          }
        }
        const cubesAt = dealt > 0 ? DEAL_FLIGHT_MS + (dealt - 1) * DEAL_STAGGER_MS - 120 : 0;
        let i = 0;
        for (const fresh of last.refreshed) {
          const slot = this.view.slots.find((s) => s.instance === fresh.instance);
          if (slot === undefined) {
            continue;
          }
          const places = Array.from(root.querySelectorAll<HTMLElement>(`.con-parl__party[data-party="${fresh.party}"] .con-pseal__support-place`));
          const hidden = Array.from(holds.hiddenCubes).filter((key) => key.startsWith(`${slot.instance}#`));
          hidden.forEach((key, n) => {
            // The key is `<instance>#<seq>` and an instance id itself carries a '#' (`RDX_…#0`) — split on the LAST one.
            const seq = key.substring(key.lastIndexOf('#') + 1);
            // The plaque's own place when it is on screen; the results scene
            // stands where the parties tier does, so there the cubes leave
            // the neutral supply's stack in the head line — a real, measured place.
            const from = rectOf(places[Math.min(n, places.length - 1)]) ?? placeCubeRect(root, '[data-parl-neutral-cube]');
            const to = rectOf(root.querySelector(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`));
            const delay = cubesAt + i * 80;
            i++;
            flyCube('neutral', from, to, delay, () => {
              holds.hiddenCubes.delete(key);
              const left = (holds.support.get(fresh.party) ?? 0) - 1;
              if (left <= 0) {
                holds.support.delete(fresh.party);
              } else {
                holds.support.set(fresh.party, left);
              }
            });
          });
        }
        if (i === 0) {
          holds.hiddenCubes.clear();
          holds.support.clear();
        }
        return;
      }
      case 'lobby': {
        // Every free delegate returns from the reserve to the lobby's socket.
        let i = 0;
        for (const color of Array.from(holds.lobby)) {
          const from = placeCubeRect(root, `[data-parl-seat-reserve="${color}"]`);
          const to = placeCubeRect(root, `[data-parl-seat-lobby="${color}"]`);
          const delay = i * 90;
          i++;
          flyCube(color, from, to, delay, () => {
            holds.lobby.delete(color);
          });
        }
        if (i === 0) {
          holds.lobby.clear();
        }
        return;
      }
      default:
        return;
      }
    },
    /** Where the enacted card physically stood: its former voting slot's face — or that slot's EMPTY outline when the refresh dealt nothing there (the voting area when the slot is gone). */
    formerSlotRect(root: HTMLElement): Rect | undefined {
      const last = this.model?.lastPhase;
      const index = last?.winner.slot;
      const homes = root.querySelectorAll<HTMLElement>('.con-parl__slots .con-parl__slot-home');
      const home = index === undefined ? undefined : homes[index];
      return rectOf(home?.querySelector('.con-parl__card .pcard') ?? home?.querySelector('.con-parl__card') ?? home?.querySelector('[data-parl-slot-empty-card]')) ??
        rectOf(root.querySelector('[data-parl-voting] .con-parl__slots'));
    },
    /**
     * The results scene opens with the ENACTED card still where it won: a
     * face-up proxy parked over its former voting slot (the government's face
     * waits hidden), so the enactment beat can MOVE it — one visible card,
     * never a copy in the government and another in the vote.
     */
    parkEnactedCard(): void {
      const root = parliamentRootEl();
      const last = this.model?.lastPhase;
      const holds = parliamentHolds;
      if (root === undefined || last === undefined || parliamentFlow.stage !== 'recap' || holds.govAwaits === undefined || holds.parked !== undefined) {
        return;
      }
      const from = this.formerSlotRect(root);
      const face = resolutionPremiumVmById(last.enacted.resolution);
      if (from === undefined || face === undefined || consoleReducedMotionActive()) {
        holds.govAwaits = undefined;
        return;
      }
      const id = nextFlightId('enact');
      pushCardFlight({id, width: Math.round(from.width), height: Math.round(from.height), face});
      holds.parked = id;
      void this.$nextTick(() => {
        const proxy = flightEl(id);
        if (proxy === null || proxy === undefined || holds.parked !== id) {
          dropFlight(id);
          holds.parked = undefined;
          holds.govAwaits = undefined;
          return;
        }
        gsap.set(proxy, {x: from.left, y: from.top, scale: 1, transformOrigin: '50% 50%', autoAlpha: 0});
        gsap.to(proxy, {autoAlpha: 1, duration: motionMs(180) / 1000, ease: 'power1.out'});
      });
    },
    /** The enactment beat: the parked card flies into the government; the face shows on the touchdown, then `then` runs. */
    moveEnactedCard(root: HTMLElement, then: () => void): void {
      const holds = parliamentHolds;
      const id = holds.parked;
      const settle = () => {
        if (id !== undefined) {
          dropFlight(id);
        }
        holds.parked = undefined;
        holds.govAwaits = undefined;
      };
      const proxy = id === undefined ? undefined : flightEl(id);
      const to = rectOf(root.querySelector('[data-parl-gov] .con-parl__gov-card .pcard') ?? root.querySelector('[data-parl-gov] .con-parl__gov-card'));
      const from = this.formerSlotRect(root);
      if (id === undefined || proxy === null || proxy === undefined || to === undefined || from === undefined || consoleReducedMotionActive()) {
        settle();
        then();
        return;
      }
      gsap.killTweensOf(proxy);
      const handle = runCardDealFlight({
        proxy,
        from,
        to,
        durationMs: ENACT_MOVE_MS,
        onLanded: () => {
          // The face shows under the proxy on the touchdown; the proxy leaves the next frame.
          holds.govAwaits = undefined;
          probeTick(() => {
            settle();
            then();
          });
        },
      });
      registerFlightHandle(id, handle);
    },
    /**
     * An effect beat's GAIN for the viewer, in the shared transfer language: a
     * production (or stock) chip leaves the enacted card's own effect block
     * and lands on the viewer's resource rail — one chip carrying the whole
     * amount, the production sprite in its production plate. A skip, a zero,
     * another seat's gain and a card resource (paid live in its own picker)
     * fly nothing.
     */
    playOutcomeFlight(outcome: ParliamentEnactOutcomeModel): void {
      const amount = outcome.amount ?? 0;
      if (outcome.player !== this.viewerColor || amount <= 0) {
        return;
      }
      const spec = outcome.kind === 'production' && outcome.production !== undefined ?
        {channel: 'production' as const, resource: outcome.production, amount} :
        outcome.kind === 'stock' && outcome.stock !== undefined ?
          {channel: 'stock' as const, resource: outcome.stock, amount} :
          undefined;
      if (spec === undefined) {
        return;
      }
      void runResourceTransfers({
        specs: [spec],
        source: {selectors: ['[data-parl-gov] .con-parl__gov-card .pcard__mech', '[data-parl-gov] .con-parl__gov-card']},
        arrival: 'auto',
      });
    },
    /**
     * ONE results line for a recorded outcome: a payout names the amount, the
     * resource and the card it landed on; a skip names its reason; an ocean
     * names the winner. Sentences from i18n keys, the card by its own name.
     * `names` overrides its seat (a shared skip names several).
     */
    outcomeText(outcome: ParliamentEnactOutcomeModel, names?: string): string {
      const who = names ?? this.nameOf(outcome.player);
      switch (outcome.kind) {
      case 'cardResource':
        return translateTextWithParams('${0} received ${1} ${2} on ${3}', [
          who, String(outcome.amount ?? 0), translateText(cardResourcePluralKey(outcome.resource)), outcome.card === undefined ? '' : translateText(outcome.card),
        ]).trim();
      case 'production': {
        // «player1: M€ production +4 (10 → 14) — 2 building cards with a VP
        // icon + influence 2»: the result first, then what it was computed
        // from — the recorded inputs, never today's tableau.
        const amount = String(outcome.amount ?? 0);
        const before = String(outcome.before ?? '');
        const after = String(outcome.after ?? '');
        const unit = translateText(productionResourceLabelKey(outcome.production));
        const capped = outcome.uncapped !== undefined && outcome.amount !== undefined && outcome.uncapped > outcome.amount;
        const main = capped ?
          translateTextWithParams('${0}: ${1} production +${2}, the maximum (${3} → ${4})', [who, unit, amount, before, after]) :
          translateTextWithParams('${0}: ${1} production +${2} (${3} → ${4})', [who, unit, amount, before, after]);
        const inputs: Array<string> = [];
        const last = this.model?.lastPhase;
        const effect = last === undefined || outcome.effect === undefined ? undefined : scaledEffectOf(getResolution(last.enacted.resolution), outcome.effect);
        if (effect?.count !== undefined && outcome.count !== undefined) {
          inputs.push(translateTextWithParams(yieldCountPresentation(effect.count.id).pluralKey, [String(outcome.count)]));
        }
        if (outcome.influence !== undefined) {
          inputs.push(translateTextWithParams('influence ${0}', [String(outcome.influence)]));
        }
        return inputs.length === 0 ? main : `${main} — ${inputs.join(' + ')}`;
      }
      case 'stock': {
        // «player1: +6 plants (2 → 8) — influence 3»: the result, the supply
        // before and after, then what it was computed from (as recorded).
        const unit = translateText(productionResourceLabelKey(outcome.stock));
        const main = translateTextWithParams('${0}: ${1} +${2} (${3} → ${4})', [
          who, unit, String(outcome.amount ?? 0), String(outcome.before ?? ''), String(outcome.after ?? ''),
        ]);
        return outcome.influence === undefined ? main : `${main} — ${translateTextWithParams('influence ${0}', [String(outcome.influence)])}`;
      }
      case 'cards': {
        // «player1: 2 карты (производство тепла 4 → 6)» — the result, then the
        // total it was divided from, as the SERVER read it. A deck that could
        // not supply the whole draw names both numbers; nothing is silent.
        const amount = outcome.amount ?? 0;
        const drawn = outcome.drawn ?? amount;
        const total = outcome.total;
        const unit = translateText(productionResourceLabelKey(Resource.HEAT));
        const main = drawn < amount ?
          translateTextWithParams('${0}: ${1} of ${2} card(s) — the deck ran out', [who, String(drawn), String(amount)]) :
          translateTextWithParams('${0}: ${1} card(s)', [who, String(amount)]);
        return total === undefined ? main :
          `${main} — ${translateTextWithParams('${0} production ${1} → ${2}', [unit, String(total.before), String(total.after)])}`;
      }
      case 'reaction': {
        // «player1: the Greens answered — M€ production +2 (1 → 3)»: the ruling
        // party's own rule, paid inside this step and recorded by the driver.
        const unit = translateText(productionResourceLabelKey(outcome.production ?? outcome.stock));
        const party = outcome.party === undefined ? '' : translateText(outcome.party);
        const args = [who, party, unit, String(outcome.amount ?? 0), String(outcome.before ?? ''), String(outcome.after ?? '')];
        return outcome.production !== undefined ?
          translateTextWithParams('${0}: ${1} answered — ${2} production +${3} (${4} → ${5})', args) :
          translateTextWithParams('${0}: ${1} answered — ${2} +${3} (${4} → ${5})', args);
      }
      case 'ocean':
        return translateTextWithParams('${0} placed an ocean as the winner of the vote', [who]);
      case 'greenery': {
        // The tile's own oxygen step as the server read it: a step, or «at the maximum» (the tile still landed).
        const parameter = outcome.parameter;
        if (parameter === undefined) {
          return translateTextWithParams('${0} placed a greenery as the winner of the vote', [who]);
        }
        return parameter.after > parameter.before ?
          translateTextWithParams('${0} placed a greenery as the winner of the vote — oxygen ${1} → ${2} %', [who, String(parameter.before), String(parameter.after)]) :
          translateTextWithParams('${0} placed a greenery as the winner of the vote — oxygen was already at its maximum', [who]);
      }
      case 'skipped':
      default:
        return translateTextWithParams('${0}: ${1} — skipped: ${2}', [
          who, translateText(this.skippedPartOf(outcome) === 'winner' ? 'Winner of the vote' : 'Resolution effect'), translateText(outcome.reason ?? '')]);
      }
    },
    /** WHICH part a skip belongs to — the driver's own stamp (older records: the ocean step's key). */
    skippedPartOf(outcome: ParliamentEnactOutcomeModel): 'winner' | 'effect' {
      return outcome.part === 'winner' || (outcome.part === undefined && outcome.step === 'ocean') ? 'winner' : 'effect';
    },
  },
});
</script>
