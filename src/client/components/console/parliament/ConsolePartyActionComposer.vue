<template>
  <!--
    THE PARTY ACTION COMPOSER (Turmoil Redux) — the ONE configuration surface
    of a party's action, hosted as a STAGE of whichever workspace the player
    took the action from: «ДЕЙСТВИЯ КАРТ › ИНДУСТРИАЛИСТЫ › НАСТРОЙКА» (the
    action menu, the canonical door) or «ПАРЛАМЕНТ › ИНДУСТРИАЛИСТЫ ›
    ДЕЙСТВИЕ» (the contextual launch from the party's detail). Same component,
    same server prompt, same byte-identical response — so the two doors can
    never disagree about limits, availability or what the commit does.

    It never titles itself: the host's breadcrumb already names the party and
    the stage. What it draws is the SOURCE (the party's printed formula, where
    a card action shows its hero card) and the DECISION column — the rows the
    server's own nested prompt asks (a production to decrease and one to
    increase; a resource and a target card), each option with its
    `current → resulting` reading, and the confirm row. A CHOICE IS A PRESS:
    the cursor selects nothing, A on an option picks it, the commit is a
    second deliberate press on the confirm row (the play composer's grammar).

    Nothing changes until the commit; the commit is the server's own answer
    to the nested prompt (`consoleParliamentModel` builds it).
  -->
  <div class="con-pact" :class="['con-pact--' + kind, {'con-pact--submitting': submitting, 'con-pact--colonies': kind === 'unity'}]"
       :data-party="party" :data-pact="kind" role="region" :aria-label="$t('Party action')">
    <!-- The UNITY door: nothing to compose — the colony workspace stands here
         as a step of the host (`card-actions ⊃ colonies`), the trade's own
         confirm is the single commit. The zone is the whole room. -->
    <div v-if="kind === 'unity'" class="con-pact__colonyzone" data-outcome-zone data-embed-slot="action-colonies"></div>

    <template v-else>
      <!-- ── THE SOURCE column — the party's emblem and its printed action,
           the hero a card action would show as its card. -->
      <aside class="con-pact__source" :style="{'--parl-accent': accent}">
        <img class="con-pact__emblem" :src="emblemUrl" alt="" :data-zoom-slot="'PARTY_' + party" />
        <ConsolePartyFormula class="con-pact__formula" :party="party" :renderRoot="actionRoot" size="wide" />
        <span class="con-pact__uses">{{ usesText }}</span>
      </aside>

      <!-- ── THE DECISION column ── -->
      <div class="con-pact__main" data-unfold-surface>
        <p class="con-pact__rule">{{ ruleText }}</p>

        <!-- INDUSTRIALISTS — two picks, each option a production reading. -->
        <template v-if="kind === 'industrialists'">
          <div v-for="(row, ri) in industrialistsRows" :key="ri" class="con-pact__row" data-unfold-item
               :class="{'con-pact__row--focus': cursorRow === ri, 'con-pact__row--answered': picks[ri] !== undefined}"
               :data-pact-row="ri">
            <span class="con-pact__row-kicker">{{ $t(row.label) }}</span>
            <div class="con-pact__opts">
              <button v-for="(item, i) in row.items" :key="item.key" type="button" class="con-pact__opt"
                      :class="{
                        'con-pact__opt--cursor': cursorRow === ri && cursor[ri] === i,
                        'con-pact__opt--picked': picks[ri] === i,
                        'con-pact__opt--off': item.disabled,
                      }"
                      :data-pact-opt="i"
                      @click="pickAt(ri, i)">
                <ActionEffectChip v-for="(chip, k) in item.chips" :key="k" :effect="chip" />
                <span v-if="item.chips.length === 0" class="con-pact__opt-label">{{ textOf(item.label) }}</span>
                <span v-if="picks[ri] === i" class="con-pact__opt-mark" aria-hidden="true">✓</span>
              </button>
              <span v-if="row.items.length === 0" class="con-pact__none">{{ $t(row.emptyKey) }}</span>
            </div>
          </div>
        </template>

        <!-- SCIENTISTS — the resource, then the card it lands on. -->
        <template v-else-if="kind === 'scientists'">
          <div class="con-pact__row" :class="{'con-pact__row--focus': cursorRow === 0, 'con-pact__row--answered': picks[0] !== undefined}" data-pact-row="0" data-unfold-item>
            <span class="con-pact__row-kicker">{{ $t('Resource') }}</span>
            <div class="con-pact__opts">
              <button v-for="(branch, i) in scientistsBranches" :key="i" type="button" class="con-pact__opt con-pact__opt--res"
                      :class="{'con-pact__opt--cursor': cursorRow === 0 && cursor[0] === i, 'con-pact__opt--picked': picks[0] === i}"
                      :data-pact-opt="i"
                      @click="pickAt(0, i)">
                <i class="con-pact__res-icon" :class="iconClass(branch.icon)" aria-hidden="true"></i>
                <b class="con-pact__opt-amount">×{{ branch.amount }}</b>
                <span class="con-pact__opt-label">{{ $t(branch.label) }}</span>
                <span v-if="picks[0] === i" class="con-pact__opt-mark" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>
          <div class="con-pact__row" :class="{'con-pact__row--focus': cursorRow === 1, 'con-pact__row--answered': picks[1] !== undefined}" data-pact-row="1" data-unfold-item>
            <span class="con-pact__row-kicker">{{ $t('Target card') }}</span>
            <div class="con-pact__cards">
              <button v-for="(target, i) in scientistsTargets" :key="target.card.name" type="button" class="con-pact__card"
                      :class="{'con-pact__card--cursor': cursorRow === 1 && cursor[1] === i, 'con-pact__card--picked': picks[1] === i}"
                      :data-pact-card="target.card.name"
                      :data-zoom-slot="target.card.name"
                      @click="pickAt(1, i)">
                <ConsoleCardFaceLite class="con-pact__card-face" :name="target.card.name" :card="target.card" :lightweight="true" />
                <span class="con-pact__card-delta">
                  <i class="con-pact__res-icon con-pact__res-icon--sm" :class="iconClass(target.icon)" aria-hidden="true"></i>
                  <b>{{ target.from }} → {{ target.to }}</b>
                  <em v-if="target.vp !== undefined">{{ $t('VP') }} {{ target.vp.from }} → {{ target.vp.to }}</em>
                </span>
                <span v-if="picks[1] === i" class="con-pact__opt-mark con-pact__opt-mark--card" aria-hidden="true">✓</span>
              </button>
              <span v-if="scientistsTargets.length === 0" class="con-pact__none">{{ $t('Choose the resource first') }}</span>
            </div>
          </div>
        </template>

        <!-- REDS — a confirm: the draw is the commit, the discard follows. -->
        <template v-else-if="kind === 'reds'">
          <div class="con-pact__chips">
            <ActionEffectChip v-for="(effect, i) in redsPreview" :key="i" :effect="effect" />
          </div>
          <div class="con-pact__sequence">
            <span class="con-pact__seq-step"><b>1</b>{{ $t('Draw 2 cards at once') }}</span>
            <span class="con-pact__seq-arrow" aria-hidden="true">→</span>
            <span class="con-pact__seq-step"><b>2</b>{{ $t('Discard 2 cards from your hand — mandatory') }}</span>
            <span class="con-pact__seq-arrow" aria-hidden="true">→</span>
            <span class="con-pact__seq-step"><b>3</b>{{ $t('2 M€ per plant, microbe or animal tag discarded') }}</span>
          </div>
          <p class="con-pact__warn">⚠ {{ $t('Confirming draws the cards at once. The discard that follows cannot be cancelled.') }}</p>
        </template>

        <!-- THE COMMIT ROW — reached by the d-pad, never by picking an option. -->
        <div class="con-pact__cta"
             :class="{
               'con-pact__cta--focus': cursorRow === ctaRow,
               'con-pact__cta--ready': complete && !submitting,
               'con-pact__cta--danger': kind === 'reds',
               'con-pact__cta--busy': submitting,
             }"
             data-pact-cta
             data-unfold-item
             @click="commit()">
          <GamepadGlyph control="confirm" class="con-pact__cta-glyph" />
          <span class="con-pact__cta-label">{{ $t(submitting ? 'Performing…' : ctaLabel) }}</span>
          <span v-if="!complete && !submitting" class="con-pact__cta-hint">{{ $t(incompleteHint) }}</span>
        </div>
        <p class="con-pact__hint">{{ $t('Nothing changes until you confirm. Once per generation.') }}</p>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect, VictoryPointsDelta} from '@/common/models/ActionPreviewModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {buildOrItems, ConsoleOrItem} from '@/client/console/consoleOrChoice';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {
  industrialistsResponse, parliamentPromptBridge, ParliamentPromptBridge, redsResponse, scientistsResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';

export type PartyComposerKind = 'industrialists' | 'scientists' | 'reds' | 'unity';

export function partyComposerKind(party: ReduxParty): PartyComposerKind {
  switch (party) {
  case PartyName.INDUSTRIALISTS: return 'industrialists';
  case PartyName.SCIENTISTS: return 'scientists';
  case PartyName.REDS: return 'reds';
  case PartyName.UNITY: return 'unity';
  default: return 'reds';
  }
}

type IndustrialistsRow = {label: string, emptyKey: string, items: ReadonlyArray<ConsoleOrItem>};
type ScientistsBranch = {icon: string, label: string, amount: number, model: SelectCardModel};
type ScientistsTarget = {card: CardModel, icon: string, from: number, to: number, vp: VictoryPointsDelta | undefined};

const ACTION_ID_OF: Partial<Record<ReduxParty, PartyActionId>> = {
  [PartyName.INDUSTRIALISTS]: 'industrialists-shift',
  [PartyName.SCIENTISTS]: 'scientists-lab',
  [PartyName.REDS]: 'reds-recycle',
  [PartyName.UNITY]: 'unity-trade',
};

export default defineComponent({
  name: 'ConsolePartyActionComposer',
  components: {ActionEffectChip, GamepadGlyph, ConsoleCardFaceLite, ConsolePartyFormula},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    party: {type: String as PropType<ReduxParty>, required: true},
    /** The host has SUBMITTED — the stage is the executing beat, input is absorbed. */
    submitting: {type: Boolean, default: false},
  },
  emits: ['confirm', 'cancel', 'inspect', 'commands'],
  data() {
    return {
      /** The cursor's row (decision rows first, the commit row last). */
      cursorRow: 0,
      /** Per-row cursor position. */
      cursor: [0, 0] as Array<number>,
      /** Per-row PICK (undefined = unanswered). */
      picks: [undefined, undefined] as Array<number | undefined>,
    };
  },
  computed: {
    kind(): PartyComposerKind {
      return partyComposerKind(this.party);
    },
    bridge(): ParliamentPromptBridge {
      return parliamentPromptBridge(this.playerView.waitingFor);
    },
    actionId(): PartyActionId | undefined {
      return ACTION_ID_OF[this.party];
    },
    /** The server's own nested prompt for this action (undefined = no longer offered). */
    entry() {
      const id = this.actionId;
      return id === undefined ? undefined : this.bridge.actions[id];
    },
    accent(): string {
      return partyAccent(this.party);
    },
    emblemUrl(): string {
      return partyEmblemUrl(this.party);
    },
    actionRoot(): ICardRenderRoot | undefined {
      return getPartyEffect(this.party)?.actionRenderData;
    },
    ruleText(): string {
      const effect = getPartyEffect(this.party);
      return translateText(effect?.text.action ?? effect?.text.rule ?? '');
    },
    usesText(): string {
      const marker = this.entry?.model.partyActionPrompt;
      if (marker === undefined) {
        return '';
      }
      return translateTextWithParams('${0} of ${1} this generation', [String(marker.usesLeft), String(marker.usesPerGeneration)]);
    },
    industrialistsRows(): ReadonlyArray<IndustrialistsRow> {
      const entry = this.entry;
      if (this.kind !== 'industrialists' || entry === undefined || entry.model.type !== 'and') {
        return [];
      }
      const decrease = entry.model.options[0];
      const increase = entry.model.options[1];
      return [
        {label: 'Decrease', emptyKey: 'No production of yours can be decreased', items: decrease?.type === 'or' ? buildOrItems(decrease).filter((i) => !i.disabled) : []},
        {label: 'Increase', emptyKey: 'Nothing to increase', items: increase?.type === 'or' ? buildOrItems(increase).filter((i) => !i.disabled) : []},
      ];
    },
    scientistsBranches(): ReadonlyArray<ScientistsBranch> {
      const entry = this.entry;
      if (this.kind !== 'scientists' || entry === undefined || entry.model.type !== 'or') {
        return [];
      }
      return entry.model.options
        .filter((o): o is SelectCardModel => o.type === 'card')
        .map((model) => {
          const icon = model.resourceGainPrompt?.cardResource ?? 'resources';
          return {icon, label: icon === 'data' ? 'Data' : icon === 'microbe' ? 'Microbes' : icon, amount: model.resourceGainPrompt?.amount ?? 2, model};
        });
    },
    scientistsTargets(): ReadonlyArray<ScientistsTarget> {
      const pick = this.picks[0] ?? this.cursor[0];
      const branch = this.scientistsBranches[pick];
      if (branch === undefined) {
        return [];
      }
      const amount = branch.model.resourceGainPrompt?.amount ?? 2;
      return branch.model.cards.map((card) => ({
        card,
        icon: branch.icon,
        from: card.resources ?? 0,
        to: (card.resources ?? 0) + amount,
        vp: branch.model.resourceGainPrompt?.vpBox?.[card.name],
      }));
    },
    redsPreview(): ReadonlyArray<ActionEffect> {
      const entry = this.entry;
      const meta = entry !== undefined && entry.model.type === 'option' ? (entry.model as {metadata?: {effects?: ReadonlyArray<ActionEffect>}}).metadata : undefined;
      return meta?.effects ?? [];
    },
    /** The rows before the commit row. */
    decisionRows(): number {
      switch (this.kind) {
      case 'industrialists': return 2;
      case 'scientists': return 2;
      default: return 0;
      }
    },
    ctaRow(): number {
      return this.decisionRows;
    },
    rowLength(): (row: number) => number {
      return (row: number): number => {
        switch (this.kind) {
        case 'industrialists': return this.industrialistsRows[row]?.items.length ?? 0;
        case 'scientists': return row === 0 ? this.scientistsBranches.length : this.scientistsTargets.length;
        default: return 0;
        }
      };
    },
    complete(): boolean {
      if (this.entry === undefined) {
        return false;
      }
      switch (this.kind) {
      case 'industrialists': return this.picks[0] !== undefined && this.picks[1] !== undefined;
      case 'scientists': return this.picks[0] !== undefined && this.picks[1] !== undefined;
      case 'reds': return true;
      default: return false;
      }
    },
    ctaLabel(): string {
      switch (this.kind) {
      case 'industrialists': return 'Shift';
      case 'scientists': return 'Add';
      case 'reds': return 'Draw 2 cards';
      default: return 'Confirm';
      }
    },
    incompleteHint(): string {
      if (this.picks[0] === undefined) {
        return this.kind === 'scientists' ? 'Choose the resource first' : 'Choose what to decrease first';
      }
      return this.kind === 'scientists' ? 'Choose the target card' : 'Choose what to increase';
    },
    /** THE ONE COMMAND CONTRACT — handed UP to the host's bar. */
    commands(): Array<ConsoleCommand> {
      if (this.kind === 'unity') {
        return [];
      }
      if (this.submitting) {
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      }
      const confirm: ConsoleCommand = {control: 'confirm', label: this.ctaLabel, enabled: this.complete, highlight: this.complete && this.kind !== 'reds'};
      if (this.kind === 'reds') {
        confirm.tone = 'danger';
      }
      const run: Array<ConsoleCommand> = [confirm, {control: 'secondary', label: 'Inspect'}];
      if (this.cursorRow < this.ctaRow && this.rowLength(this.cursorRow) > 0) {
        run.unshift({control: 'confirm', label: 'Select'});
        run.splice(1, 1);
      }
      run.push({control: 'back', label: 'Back'});
      return run;
    },
  },
  watch: {
    commands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        this.$emit('commands', cmds);
      },
    },
    /** The prompt moved on (the action was spent elsewhere / the turn ended): the stage folds. */
    entry(entry: unknown): void {
      if (entry === undefined && !this.submitting) {
        this.$emit('cancel');
      }
    },
  },
  mounted() {
    // A one-row action (the Reds' confirm) opens ON its commit row; a
    // configurable one opens on its first decision.
    this.cursorRow = this.decisionRows === 0 ? this.ctaRow : 0;
  },
  methods: {
    textOf(value: string | Message): string {
      return typeof value === 'string' ? translateText(value) : translateMessage(value);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    /** The host routes every intent here while the stage stands. */
    handleIntent(intent: GamepadIntent): void {
      if (this.submitting || this.kind === 'unity') {
        return;
      }
      if (intent.kind === 'nav') {
        this.navigate(intent.dir);
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        if (this.cursorRow >= this.ctaRow) {
          this.commit();
        } else {
          this.pickAt(this.cursorRow, this.cursor[this.cursorRow]);
        }
        return;
      case 'inspect':
        this.$emit('inspect', this.party);
        return;
      case 'back':
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    navigate(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (dir === 'up') {
        this.cursorRow = Math.max(0, this.cursorRow - 1);
        return;
      }
      if (dir === 'down') {
        this.cursorRow = Math.min(this.ctaRow, this.cursorRow + 1);
        return;
      }
      if (this.cursorRow >= this.ctaRow) {
        return;
      }
      const length = this.rowLength(this.cursorRow);
      if (length <= 0) {
        return;
      }
      const next = this.cursor[this.cursorRow] + (dir === 'right' ? 1 : -1);
      this.cursor[this.cursorRow] = Math.min(length - 1, Math.max(0, next));
      // The Scientists' target list follows the resource under the cursor —
      // a pick made against another resource is stale by construction.
      if (this.kind === 'scientists' && this.cursorRow === 0 && this.picks[0] !== undefined && this.picks[0] !== this.cursor[0]) {
        this.picks[1] = undefined;
        this.cursor[1] = 0;
      }
    },
    /** A on an option: PICK it (idempotent) and step to the next unanswered row. */
    pickAt(row: number, index: number): void {
      if (this.submitting || row >= this.ctaRow || index < 0 || index >= this.rowLength(row)) {
        return;
      }
      this.cursor[row] = index;
      if (this.kind === 'scientists' && row === 0 && this.picks[0] !== index) {
        this.picks[1] = undefined;
        this.cursor[1] = 0;
      }
      this.picks[row] = index;
      // Advance to the next unanswered row — the commit row when every
      // decision is made. Never a commit: that is the player's own press.
      for (let next = row + 1; next < this.ctaRow; next++) {
        if (this.picks[next] === undefined) {
          this.cursorRow = next;
          return;
        }
      }
      this.cursorRow = this.ctaRow;
    },
    /** The commit: the server's own nested response, handed UP to the host (which submits). */
    commit(): void {
      if (this.submitting || !this.complete) {
        return;
      }
      const response = this.response();
      if (response === undefined) {
        this.$emit('cancel');
        return;
      }
      this.$emit('confirm', response);
    },
    response(): InputResponse | undefined {
      switch (this.kind) {
      case 'industrialists': {
        const rows = this.industrialistsRows;
        const dec = rows[0]?.items[this.picks[0] ?? -1];
        const inc = rows[1]?.items[this.picks[1] ?? -1];
        if (dec === undefined || inc === undefined) {
          return undefined;
        }
        return industrialistsResponse(this.bridge, dec.optionIndex, inc.optionIndex);
      }
      case 'scientists': {
        const branch = this.picks[0];
        const target = this.scientistsTargets[this.picks[1] ?? -1];
        if (branch === undefined || target === undefined) {
          return undefined;
        }
        return scientistsResponse(this.bridge, branch, target.card.name);
      }
      case 'reds':
        return redsResponse(this.bridge);
      default:
        return undefined;
      }
    },
  },
});
</script>
