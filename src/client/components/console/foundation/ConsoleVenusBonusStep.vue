<template>
  <!-- THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM), standing on the SHARED wild-resource choice since P43
       (ledger EO — `ConsoleWildChoiceStep`, one composition for every «a standard resource OR a resource on a card»).
       This wrapper only states the bonus: its head («Бонус Венеры · Шкала Венеры a → b %»), the 30 % finish's title, the
       specification (`venusWildSpec` — the base always laid out, the OR only where it is really taken, the grid a dial)
       and the candidates' live models. Every host (the play sheet, the blue action's setup, the colony trade's stage)
       mounts THIS, so the three can never draw the bonus differently.

       «НА КАРТУ» IS A LEVEL OF ITS OWN (the owner, 2026-11-03 — thirteen holders squeezed into one strip of stamps:
       «класть на карту делать ЕЩЁ ОДНИМ вложенным шагом, иначе мы не можем отдать достаточно свободного места»). In
       the step it is ONE door row; past the door (`focus.zone === 'pick'`) the step steps aside and the console's
       target selector takes the WHOLE column — pages, the outcome tags, X with the target dossier. The two levels are
       one layer stack (never a blink): the step releases in place, the pick unfolds from under it; B the same way back.
       The selector's cursor and boxes are this component's — a host forwards the d-pad (`pickNav`), the page turn
       (`pickTurn`), X (`pickInspect`) and reads A's answer off `pickFocused`. -->
  <div class="con-venusstep" :data-venus-level="picking ? 'pick' : 'step'">
    <Transition name="con-venusstep-level">
      <ConsoleWildChoiceStep v-show="!picking" class="con-venusstep__level"
                             :spec="spec" :parts="parts" :focus="focus" :stock="stock" venus
                             :head="{title: 'Venus bonus', reading: stepReading}" or-title="Final step · 30 %"
                             :candidates="candidates" :vp-box="vpBox" />
    </Transition>
    <Transition name="con-venusstep-level">
      <div v-if="picking && pickModel !== undefined" class="con-venusstep__level con-venusstep__pick" ref="pickZone"
           data-venus-pick :data-venus-pick-focused="pickFocusedName ?? ''">
        <!-- THE STEP'S OWN HEAD STAYS — «Бонус Венеры · Шкала Венеры a → b %» on both levels, so only the body changes
             one level deeper; the stage itself is the crumb's («… › БОНУС ВЕНЕРЫ · КАРТА»), the question the head's
             quiet tail. The selector therefore states no ask and no owner bar of its own (`hostStatesAsk`). -->
        <div class="con-wildstep__head con-venusstep__pick-head">
          <span class="con-wildstep__title">{{ $t('Venus bonus') }}</span>
          <span v-if="stepReading !== ''" class="con-wildstep__reading">{{ stepReading }}</span>
          <span class="con-venusstep__pick-ask">{{ $t('Choose a card for the wild resource') }}</span>
        </div>
        <ConsolePlayedTargetStep v-if="pickH > 0"
                                 ref="pickStep"
                                 :model="pickModel"
                                 :layout="pickLayout"
                                 :focus="pickFocusShown"
                                 :selection="{mode: 'single'}"
                                 :bandHeight="pickH"
                                 :lockedCard="parts.wild?.card ?? ''"
                                 hostStatesAsk />
      </div>
    </Transition>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import ConsoleWildChoiceStep from '@/client/components/console/foundation/ConsoleWildChoiceStep.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import {VenusBonusParts, venusBonusMetaOf, venusStepReading, venusWildCandidates} from '@/client/console/venusBonus/venusBonusPreselect';
import {VenusInnerFocus, venusWildSpec} from '@/client/console/venusBonus/venusBonusInner';
import {buildVenusWildTargetModel} from '@/client/console/venusBonus/venusWildTargetStep';
import {WildChoiceSpec} from '@/client/console/wildChoice/wildChoiceInner';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir, findPlayedTargetFocus, planPlayedTargetLayout,
  playedTargetAt, reseatPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia,
} from '@/client/console/played/consolePlayedTargetModel';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {getCard} from '@/client/cards/ClientCardManifest';
import {translateText} from '@/client/directives/i18n';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {layoutTopWithin} from '@/client/console/layoutTop';

/** What a host may ask of the nested pick (the step's ref). */
export type VenusBonusStepApi = {
  pickNav(dir: PlayedTargetNavDir): void,
  pickTurn(delta: number): void,
  pickFocused(): CardName | undefined,
  pickInspect(): void,
};

export default defineComponent({
  name: 'ConsoleVenusBonusStep',
  components: {ConsoleWildChoiceStep, ConsolePlayedTargetStep},
  props: {
    /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
    input: {type: Object as PropType<PlayerInputModel>, required: true},
    parts: {type: Object as PropType<VenusBonusParts>, required: true},
    focus: {type: Object as PropType<VenusInnerFocus>, required: true},
    /** The player's stock per standard resource — «current → resulting». */
    stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
    /** The viewer (the holders are theirs) — the dossier's «whose». */
    viewer: {type: Object as PropType<{name: string, color: string}>, default: () => ({name: '', color: 'viewer'})},
  },
  data() {
    return {
      pickFocusRaw: undefined as PlayedTargetFocus | undefined,
      /** The pick's measured box — the column from its top to the band's foot (transform-free, `layoutTopWithin`). */
      pickW: 0,
      pickH: 0,
      stopObs: undefined as (() => void) | undefined,
    };
  },
  computed: {
    meta(): VenusBonusPromptMeta | undefined {
      return venusBonusMetaOf(this.input);
    },
    stepReading(): string {
      return venusStepReading(this.meta);
    },
    spec(): WildChoiceSpec {
      return this.meta === undefined ?
        {holders: [], amount: () => 0, exclusive: false, lanes: 'dial'} :
        venusWildSpec(this.meta);
    },
    candidates(): ReadonlyArray<CardModel> {
      return venusWildCandidates(this.input) ?? [];
    },
    /** The server's per-candidate ПО move — the door and the selector read the same box. */
    vpBox(): Partial<Record<string, {from: number, to: number}>> {
      return this.meta?.wildCardVp ?? {};
    },
    picking(): boolean {
      return this.focus.zone === 'pick';
    },
    /** The 30 % finish's holders as the console's ONE target selector (the live bonus's own builder). */
    pickModel(): PlayedTargetModel | undefined {
      const holders = this.spec.holders;
      const candidates = this.candidates.filter((c) => holders.includes(c.name));
      if (candidates.length === 0) {
        return undefined;
      }
      return buildVenusWildTargetModel({
        candidates,
        players: [{name: this.viewer.name, color: this.viewer.color, tableau: candidates.map((c) => ({name: c.name}))}],
        viewerColor: this.viewer.color,
        ask: translateText('Choose a card for the wild resource'),
        typeOf: (name) => getCard(name)?.type,
        resourceOf: (name) => getCard(name)?.resourceType,
        vpBox: this.meta?.wildCardVp,
      });
    },
    pickLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.pickModel?.owners ?? [],
        availW: this.pickW,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    pickFocusShown(): PlayedTargetFocus {
      return reseatPlayedTargetFocus(this.pickFocusRaw, this.pickModel?.owners ?? []) ?? {ownerId: '', index: -1};
    },
    pickFocusedName(): CardName | undefined {
      return playedTargetAt(this.pickFocusShown, this.pickModel?.owners ?? [])?.cardName;
    },
  },
  watch: {
    /** Entering the pick seats its cursor (on the chosen card, else the first choosable one) and measures its box. */
    picking: {
      immediate: true,
      handler(on: boolean) {
        if (!on) {
          this.stopObs?.();
          this.stopObs = undefined;
          return;
        }
        this.seatPick();
        void this.$nextTick(() => this.armPickMeasure());
      },
    },
  },
  beforeUnmount() {
    this.stopObs?.();
  },
  methods: {
    seatPick(): void {
      const owners = this.pickModel?.owners ?? [];
      const chosen = this.parts.wild?.card;
      const first = owners.flatMap((o) => o.candidates.map((c, index) => ({o, c, index}))).find((x) => x.c.blocked === undefined);
      this.pickFocusRaw = (chosen !== undefined ? findPlayedTargetFocus(chosen, owners) : undefined) ??
        (first !== undefined ? {ownerId: first.o.id, index: first.index} : undefined);
    },
    /** The pick's room: from its own top to the band's foot, minus every bottom padding between (the P43 slot's rule). */
    measurePick(): void {
      const zone = this.$refs.pickZone as HTMLElement | undefined;
      const band = zone?.closest<HTMLElement>('[data-ws-band]') ?? null;
      if (zone === undefined || zone === null) {
        return;
      }
      this.pickW = Math.max(0, Math.floor(zone.clientWidth));
      if (band === null) {
        return;
      }
      let inset = 0;
      for (let el = zone.parentElement; el !== null && el !== band; el = el.parentElement) {
        const cs = getComputedStyle(el);
        inset += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const room = Math.floor(band.offsetHeight - layoutTopWithin(zone, band) - inset - 0.4 * rem);
      if (Math.abs(room - this.pickH) > 1) {
        this.pickH = Math.max(9 * rem, room);
      }
    },
    armPickMeasure(): void {
      this.measurePick();
      const zone = this.$refs.pickZone as HTMLElement | undefined;
      const band = zone?.closest<HTMLElement>('[data-ws-band]') ?? undefined;
      if (zone === undefined || typeof ResizeObserver === 'undefined') {
        return;
      }
      this.stopObs?.();
      const obs = new ResizeObserver(() => this.measurePick());
      [zone, band].filter((el): el is HTMLElement => el !== undefined && el !== null).forEach((el) => obs.observe(el));
      this.stopObs = () => obs.disconnect();
    },
    // ── THE HOST'S DOOR INTO THE PICK (`VenusBonusStepApi`) ─────────────────
    /** The d-pad: the selector's own boxes (a page's edge turns it). */
    pickNav(dir: PlayedTargetNavDir): void {
      const focus = reseatPlayedTargetFocus(this.pickFocusRaw, this.pickModel?.owners ?? []);
      if (focus === undefined) {
        return;
      }
      const step = this.$refs.pickStep as {cells?: () => ReadonlyArray<PlayedTargetCell>, ensureFocusVisible?: () => void} | undefined;
      const next = stepPlayedTargetFocusVia(step, focus, dir, step?.cells?.() ?? []);
      if (next !== undefined) {
        this.pickFocusRaw = next;
        step?.ensureFocusVisible?.();
      }
    },
    /** LB / RB — the band's page. */
    pickTurn(delta: number): void {
      const turned = turnPlayedTargetPageVia(this.$refs.pickStep, this.pickFocusShown, delta);
      if (turned !== undefined) {
        this.pickFocusRaw = turned;
        (this.$refs.pickStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
      }
    },
    /** A's answer — the focused candidate when it may be chosen (never a near miss). */
    pickFocused(): CardName | undefined {
      const candidate = playedTargetAt(this.pickFocusShown, this.pickModel?.owners ?? []);
      return candidate === undefined || candidate.blocked !== undefined || candidate.stand !== undefined ? undefined : candidate.cardName;
    },
    /** X — the focused card fullscreen, its TARGET DOSSIER beside it. */
    pickInspect(): void {
      const model = this.pickModel;
      const name = this.pickFocusedName;
      if (model !== undefined && name !== undefined) {
        openPlayedTargetZoom({model, cardName: name, getRoot: () => this.$el as HTMLElement | undefined});
      }
    },
  },
});
</script>
