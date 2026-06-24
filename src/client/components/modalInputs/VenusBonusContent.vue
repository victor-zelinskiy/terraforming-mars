<template>
  <!--
    Premium VENUS ALT-TRACK BONUS modal. Replaces the legacy numeric-distribution
    (GainResources → 6 SelectAmount steppers) and the legacy wild OrOptions with a
    single cohesive premium surface:

      - kind 'standard' (a regular scale bonus): pick `baseCount` standard resources
        as selectable tiles (no numeric inputs).
      - kind 'final' (the 30% milestone): Section A "Бонус Венеры" (pick the base
        standard resource[s]) + Section B "Дополнительный бонус 30%" with two tabs —
        "Обычный ресурс" (pick another standard) and "Ресурс на карту" (pick a card
        via ActionTargetCard, reusing the shared current→resulting + VP-delta
        preview the play/action modals use).

    Hosted inside MandatoryInputModal via ModalInputHost (routed by the
    `venusBonusPrompt` marker). Submits ONE InputResponse via `onsave`:
      - standard: {type:'and', responses:[6 amounts]}
      - final / wild→standard: {type:'or', index:1, response:{and 6 amounts (base+1)}}
      - final / wild→card: {type:'or', index:0, response:{and [{card}, {and base}]}}
  -->
  <div class="modal-input venus-bonus" :class="{'venus-bonus--final': isFinal}">
    <header class="modal-input__header">
      <div class="modal-input__header-tab"></div>
      <h3 class="modal-input__title">{{ titleText }}</h3>
      <p v-if="!isFinal" class="venus-bonus__subtitle">{{ baseHintText }}</p>
    </header>

    <!-- Section A — the base standard resource(s). Always shown for a regular
         bonus; for the final bonus only when it grants base resources. -->
    <section v-if="showBaseSection" class="venus-bonus__section">
      <h4 v-if="isFinal" class="venus-bonus__section-title" v-i18n>Venus bonus</h4>
      <p v-if="isFinal" class="venus-bonus__section-hint">{{ baseHintText }}</p>
      <div class="venus-bonus__tiles">
        <button v-for="r in resources"
                :key="r.key"
                type="button"
                class="venus-bonus__tile"
                :class="{'venus-bonus__tile--selected': base[r.key] > 0}"
                :data-test="'venus-base-' + r.key"
                @click="addBase(r.key)">
          <span class="venus-bonus__tile-icon resource_icon" :class="'resource_icon--' + r.key" aria-hidden="true"></span>
          <span class="venus-bonus__tile-label">{{ r.label }}</span>
          <span v-if="base[r.key] > 0" class="venus-bonus__tile-count">{{ base[r.key] }}</span>
          <span v-if="base[r.key] > 0 && !singlePick"
                class="venus-bonus__tile-dec"
                role="button"
                :aria-label="$t('Remove')"
                @click.stop="removeBase(r.key)">−</span>
        </button>
      </div>
      <div v-if="baseCount > 1"
           class="venus-bonus__counter"
           :class="{'venus-bonus__counter--complete': baseComplete}">
        {{ counterText }}
      </div>
    </section>

    <!-- Section B — the final-step wild bonus (another standard resource OR a
         resource on a card). -->
    <section v-if="isFinal" class="venus-bonus__section venus-bonus__section--wild">
      <h4 class="venus-bonus__section-title" v-i18n>Extra 30% bonus</h4>
      <div class="venus-bonus__tabs" role="tablist">
        <button type="button"
                class="venus-bonus__tab"
                :class="{'venus-bonus__tab--active': wildTab === 'standard'}"
                :aria-selected="wildTab === 'standard'"
                role="tab"
                data-test="venus-tab-standard"
                @click="wildTab = 'standard'">
          <span v-i18n>Standard resource</span>
        </button>
        <button type="button"
                class="venus-bonus__tab"
                :class="{'venus-bonus__tab--active': wildTab === 'card', 'venus-bonus__tab--disabled': !hasCardBranch}"
                :aria-selected="wildTab === 'card'"
                :aria-disabled="!hasCardBranch"
                :data-hint="hasCardBranch ? '' : cardTabDisabledHint"
                role="tab"
                data-test="venus-tab-card"
                @click="selectCardTab()">
          <span v-i18n>Resource on a card</span>
        </button>
      </div>

      <div v-if="wildTab === 'standard'" class="venus-bonus__wild-standard">
        <p class="venus-bonus__section-hint" v-i18n>Pick another standard resource</p>
        <div class="venus-bonus__tiles">
          <button v-for="r in resources"
                  :key="r.key"
                  type="button"
                  class="venus-bonus__tile venus-bonus__tile--sm"
                  :class="{'venus-bonus__tile--selected': wildStandard === r.key}"
                  :data-test="'venus-wild-' + r.key"
                  @click="wildStandard = r.key">
            <span class="venus-bonus__tile-icon resource_icon" :class="'resource_icon--' + r.key" aria-hidden="true"></span>
            <span class="venus-bonus__tile-label">{{ r.label }}</span>
          </button>
        </div>
      </div>

      <div v-else class="venus-bonus__wild-card">
        <p class="venus-bonus__section-hint" v-i18n>Pick a card to receive a resource</p>
        <!-- Few candidates → an inline target picker. Many (> threshold) → a
             "pick the card on your board" hand-off to the РАЗЫГРАНО overlay (a
             cramped in-modal grid of 10+ cards is replaced by the board), mirroring
             the play / action-confirm modals' >3-candidate routing. -->
        <ActionTargetCard v-if="!useBoardPick"
                          :input="wildCardInput"
                          :playerView="playerView"
                          :selectedName="wildCard"
                          :amount="1"
                          @change="onWildCardChange" />
        <div v-else class="venus-bonus__board-pick">
          <div v-if="wildCard !== undefined" class="venus-bonus__board-chosen">
            <ActionTargetCard :input="chosenCardInput"
                              :playerView="playerView"
                              :selectedName="wildCard"
                              :amount="1"
                              :autoSelect="false" />
          </div>
          <button type="button"
                  class="venus-bonus__board-pick-btn"
                  data-test="venus-board-pick"
                  @click="startBoardPick">
            {{ boardPickButtonLabel }}
          </button>
          <p v-if="wildCard === undefined" class="venus-bonus__board-pick-hint">{{ boardPickCountHint }}</p>
        </div>
      </div>
    </section>

    <!-- Live summary of the bonus the player is about to take. -->
    <div class="venus-bonus__summary">
      <span class="venus-bonus__summary-label" v-i18n>You will receive</span>
      <div class="venus-bonus__summary-chips">
        <span v-for="chip in summaryChips" :key="chip.id" class="venus-bonus__chip">
          <span class="venus-bonus__chip-icon" :class="chip.iconClass" aria-hidden="true"></span>
          <span class="venus-bonus__chip-amount">+{{ chip.amount }}</span>
          <span v-if="chip.label !== ''" class="venus-bonus__chip-label">{{ chip.label }}</span>
        </span>
        <span v-if="summaryChips.length === 0" class="venus-bonus__summary-empty">—</span>
      </div>
    </div>

    <div class="modal-input__actions">
      <button class="modal-input__primary-btn"
              :disabled="!canConfirm"
              data-test="venus-bonus-confirm"
              @click="confirm">
        <span v-i18n>Take bonus</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import {InputResponse, SelectCardResponse} from '@/common/inputs/InputResponse';
import {Units} from '@/common/Units';
import {sum} from '@/common/utils/utils';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {buildVenusBonusResponse, VenusWildChoice} from '@/client/components/modalInputs/venusBonusResponses';
import {
  enterPlayedCardsPick,
  cancelPlayedCardsPick,
  playedCardsPickState,
  PLAYED_PICK_OVERLAY_THRESHOLD,
} from '@/client/components/playedCards/playedCardsPickState';
import {translateText} from '@/client/directives/i18n';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';

type ResourceDescriptor = {key: keyof Units, label: string};
type SummaryChip = {id: string, iconClass: string, amount: number, label: string};

export default defineComponent({
  name: 'VenusBonusContent',
  components: {ActionTargetCard},
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
    playerinput: {
      type: Object as PropType<PlayerInputModel>,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: InputResponse) => void,
      required: true,
    },
  },
  data() {
    return {
      base: Units.of({}) as Units,
      wildTab: 'standard' as 'standard' | 'card',
      wildStandard: undefined as keyof Units | undefined,
      wildCard: undefined as CardName | undefined,
    };
  },
  beforeUnmount() {
    // If the modal is torn down while a board pick is still open (e.g. the server
    // moved on), cancel it so the player isn't left in a stale board pick mode.
    if (playedCardsPickState.active) {
      cancelPlayedCardsPick();
    }
  },
  computed: {
    meta(): VenusBonusPromptMeta {
      // Routing guarantees the marker is present; fall back defensively.
      return this.playerinput.venusBonusPrompt ?? {kind: 'standard', baseCount: 1};
    },
    isFinal(): boolean {
      return this.meta.kind === 'final';
    },
    baseCount(): number {
      return this.meta.baseCount;
    },
    // A single-resource base pick is a single-select (clicking another tile
    // moves the choice); a multi-resource base increments (with a − control).
    singlePick(): boolean {
      return this.baseCount === 1;
    },
    showBaseSection(): boolean {
      return this.baseCount > 0;
    },
    // Whether the server built an on-card branch (the player owns a card that can
    // host the wild). When false the "resource on a card" tab is disabled (the
    // wild is taken as a standard resource) — but it is NEVER lost.
    hasCardBranch(): boolean {
      return (this.meta.wildCardTargets ?? []).length > 0;
    },
    cardTabDisabledHint(): string {
      return translateText('No card can hold this resource');
    },
    resources(): ReadonlyArray<ResourceDescriptor> {
      return Units.keys.map((key) => ({key, label: translateText(key)}));
    },
    baseTotal(): number {
      return sum(Units.values(this.base));
    },
    baseComplete(): boolean {
      return this.baseTotal === this.baseCount;
    },
    wildComplete(): boolean {
      if (!this.isFinal) {
        return true;
      }
      return this.wildTab === 'standard' ?
        this.wildStandard !== undefined :
        this.wildCard !== undefined;
    },
    canConfirm(): boolean {
      return this.baseComplete && this.wildComplete;
    },
    titleText(): string {
      return translateText(this.isFinal ? 'Final Venus bonus' : 'Venus scale bonus');
    },
    baseHintText(): string {
      return this.baseCount === 1 ?
        translateText('Choose a standard resource') :
        translateText('Choose ${0} standard resources').replace('${0}', String(this.baseCount));
    },
    counterText(): string {
      return translateText('Selected ${0} of ${1}')
        .replace('${0}', String(this.baseTotal))
        .replace('${1}', String(this.baseCount));
    },
    wildCardCandidates(): ReadonlyArray<CardModel> {
      const targets = new Set(this.meta.wildCardTargets ?? []);
      const tableau = this.playerView.thisPlayer?.tableau ?? [];
      return tableau.filter((c) => targets.has(c.name));
    },
    // Synthetic SelectCardModel so the shared ActionTargetCard renders the
    // candidate cards with the current→resulting + VP-delta preview.
    wildCardInput(): SelectCardModel {
      return {
        type: 'card',
        title: '',
        buttonLabel: 'Add resource',
        cards: this.wildCardCandidates,
        max: 1,
        min: 1,
        showOnlyInLearnerMode: false,
        selectBlueCardAction: false,
        showOwner: false,
        showSelectAll: false,
      };
    },
    // Too many candidates for a comfortable in-modal grid → route the pick to the
    // РАЗЫГРАНО board (same > threshold rule the play / action modals use).
    useBoardPick(): boolean {
      return this.wildCardCandidates.length > PLAYED_PICK_OVERLAY_THRESHOLD;
    },
    chosenCardModel(): CardModel | undefined {
      return this.wildCardCandidates.find((c) => c.name === this.wildCard);
    },
    // A single-card SelectCardModel so the chosen board-pick card shows the same
    // ActionTargetCard preview (count → resulting + VP delta) as the inline picker.
    chosenCardInput(): SelectCardModel {
      const model = this.chosenCardModel;
      return {...this.wildCardInput, cards: model !== undefined ? [model] : []};
    },
    boardPickButtonLabel(): string {
      return translateText(this.wildCard === undefined ? 'Choose a card on your board' : 'Choose a different card');
    },
    boardPickCountHint(): string {
      return translateText('Eligible cards: ${0}').replace('${0}', String(this.wildCardCandidates.length));
    },
    summaryChips(): ReadonlyArray<SummaryChip> {
      const byKey = new Map<keyof Units, number>();
      for (const key of Units.keys) {
        if (this.base[key] > 0) {
          byKey.set(key, (byKey.get(key) ?? 0) + this.base[key]);
        }
      }
      if (this.isFinal && this.wildTab === 'standard' && this.wildStandard !== undefined) {
        byKey.set(this.wildStandard, (byKey.get(this.wildStandard) ?? 0) + 1);
      }
      const chips: Array<SummaryChip> = [];
      for (const [key, amount] of byKey) {
        chips.push({id: 'std-' + key, iconClass: iconClassFor(key), amount, label: ''});
      }
      if (this.isFinal && this.wildTab === 'card' && this.wildCard !== undefined) {
        const rk = this.cardResourceKey(this.wildCard);
        chips.push({
          id: 'card',
          iconClass: rk === '' ? '' : iconClassFor(rk),
          amount: 1,
          label: translateText(this.wildCard),
        });
      }
      return chips;
    },
  },
  methods: {
    cardResourceKey(name: CardName): string {
      const rt = getCard(name)?.resourceType;
      return rt !== undefined ? String(rt).toLowerCase().replace(/\s+/g, '-') : '';
    },
    addBase(key: keyof Units): void {
      if (this.singlePick) {
        const next = Units.of({});
        next[key] = 1;
        this.base = next;
        return;
      }
      if (this.baseTotal >= this.baseCount) {
        return;
      }
      this.base[key] += 1;
    },
    removeBase(key: keyof Units): void {
      if (this.base[key] > 0) {
        this.base[key] -= 1;
      }
    },
    onWildCardChange(response: SelectCardResponse): void {
      this.wildCard = response.cards[0];
    },
    selectCardTab(): void {
      // The on-card tab is disabled when no card can host the wild; the player
      // keeps the wild as a standard resource on the other tab.
      if (this.hasCardBranch) {
        this.wildTab = 'card';
      }
    },
    // Hand off to the РАЗЫГРАНО board: enter pick mode (PlayerHome opens the
    // overlay + suppresses this modal in response to the shared pick state), and
    // capture the chosen card on resolve. The modal re-appears (un-suppressed)
    // with the card set, or unchanged if the player abandons the pick.
    startBoardPick(): void {
      enterPlayedCardsPick({
        title: translateText('Pick a card to receive a resource'),
        selectable: this.wildCardCandidates.map((c) => c.name),
        reasonMode: 'resource',
        onResolve: (card) => {
          this.wildCard = card;
        },
      });
    },
    confirm(): void {
      if (!this.canConfirm) {
        return;
      }
      let wild: VenusWildChoice | undefined;
      if (this.isFinal) {
        wild = this.wildTab === 'standard' ?
          (this.wildStandard !== undefined ? {kind: 'standard', resource: this.wildStandard} : undefined) :
          (this.wildCard !== undefined ? {kind: 'card', card: this.wildCard} : undefined);
      }
      this.onsave(buildVenusBonusResponse(this.isFinal, this.base, wild, this.hasCardBranch));
    },
  },
});
</script>
