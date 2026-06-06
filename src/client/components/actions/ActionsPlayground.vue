<template>
  <!--
    Dev-only QA page (?actionsPlayground). Two tabs:
      • ALL ACTIONS — mounts the real ActionsOverlay as if a player had played
        EVERY in-scope action card at once, with a SPREAD of states (available /
        unavailable-with-reason / activated / soft) so the layout, filters,
        reason popovers, confirmation modal and activated states can be eyeballed
        in one shot. A second mock player exercises the read-only opponent view.
      • FLAGGED / NEEDS WORK — the diagnostic list of action cards whose action
        graphic has NO clean render node (auto-detected) + the cards covered by a
        custom override. Click a card to inspect the real card fullscreen.
  -->
  <div class="actions-playground">
    <div class="actions-playground__bar">
      <span class="actions-playground__title">ACTIONS OVERLAY — PLAYGROUND</span>
      <button class="actions-playground__tab"
              :class="{'actions-playground__tab--active': tab === 'all'}"
              @click="tab = 'all'">All actions ({{ allCount }})</button>
      <button class="actions-playground__tab"
              :class="{'actions-playground__tab--active': tab === 'flagged'}"
              @click="tab = 'flagged'">Flagged / needs work ({{ flaggedCount }})</button>
    </div>

    <template v-if="tab === 'all'">
      <div class="actions-playground__bar actions-playground__bar--sub">
        <span class="actions-playground__hint">{{ allCount }} in-scope actions (Base / CorpEra / Promo / Venus / Colonies / Prelude) — mixed states</span>
        <button class="actions-playground__btn" @click="open = !open">{{ open ? 'Close' : 'Open' }} overlay</button>
        <button class="actions-playground__btn" @click="togglePlayer">Switch player ({{ displayedPlayer.name }})</button>
        <button class="actions-playground__btn" @click="awaiting = !awaiting">awaitingInput: {{ awaiting }}</button>
      </div>
      <ActionsOverlay v-if="open"
                      :displayedPlayer="displayedPlayer"
                      :viewerColor="viewerColor"
                      :availableActionNames="displayedPlayer.color === viewerColor ? availableNames : []"
                      :awaitingInput="awaiting"
                      @activate="onActivate"
                      @close="open = false" />
      <MandatoryInputModal v-if="pendingCardName !== undefined"
                           :title="'Activate action'"
                           :minimizable="false">
        <CardActionConfirmContent
          :cardName="pendingCardName"
          @confirm="pendingCardName = undefined; open = true"
          @cancel="pendingCardName = undefined; open = true" />
      </MandatoryInputModal>
    </template>

    <div v-else class="actions-playground__flagged">
      <p class="actions-playground__flag-intro">
        Action cards flagged during analysis: their action has no clean
        <code>action()</code> render node, so the generic scan can't surface its
        graphic (a text fallback from the description is shown instead). Click a
        card to inspect the real card and decide whether it needs an override.
      </p>

      <section v-if="overrideRows.length > 0" class="actions-playground__flag-section">
        <h3 class="actions-playground__flag-head">Covered via custom override ({{ overrideRows.length }})</h3>
        <div v-for="r in overrideRows"
             :key="r.name"
             class="flag-row flag-row--ok"
             @click="openCard(r.name)"
             :data-test="'flag-override-' + r.name">
          <span class="flag-row__name" v-i18n>{{ r.name }}</span>
          <span class="flag-row__meta">{{ r.kind }} · {{ r.module }}</span>
          <span class="flag-row__status flag-row__status--ok">OVERRIDE</span>
        </div>
      </section>

      <section v-if="candidateRows.length > 0" class="actions-playground__flag-section">
        <h3 class="actions-playground__flag-head">No action graphic — review / needs descriptor ({{ candidateRows.length }})</h3>
        <div v-for="r in candidateRows"
             :key="r.name"
             class="flag-row flag-row--todo"
             @click="openCard(r.name)"
             :data-test="'flag-todo-' + r.name">
          <span class="flag-row__name" v-i18n>{{ r.name }}</span>
          <span class="flag-row__meta">{{ r.kind }} · {{ r.module }}</span>
          <span class="flag-row__status flag-row__status--todo">NO ICONS</span>
        </div>
      </section>
      <p v-if="candidateRows.length === 0" class="actions-playground__flag-intro">
        ✓ Every in-scope action card has an extractable action graphic.
      </p>
    </div>

    <Teleport to="body">
      <CardZoomModal v-if="zoomCard !== undefined"
                     ref="zoom"
                     :card="zoomCard"
                     @close="zoomCard = undefined" />
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {MODULE_NAMES} from '@/common/cards/GameModule';
import {Color} from '@/common/Color';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {UnplayableReason} from '@/common/cards/UnplayableReason';
import {Resource} from '@/common/Resource';
import {getCard} from '@/client/cards/ClientCardManifest';
import {
  allScopeActionCardNames,
  overriddenActionCards,
  flaggedActionCandidates,
} from '@/client/components/actions/actionExtraction';
import ActionsOverlay from '@/client/components/actions/ActionsOverlay.vue';
import CardActionConfirmContent from '@/client/components/actions/CardActionConfirmContent.vue';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';

type FlagRow = {name: CardName, kind: string, module: string};

// A varied set of fake "why can't I act" reasons, cycled across the unavailable
// cards so the popover styling (resource / target / count / rule) is exercised.
const FAKE_REASONS: ReadonlyArray<ReadonlyArray<UnplayableReason>> = [
  [{type: 'resource', message: 'Not enough energy', resource: Resource.ENERGY, current: 0}],
  [{type: 'target', message: 'No target to reduce production', resource: Resource.HEAT}],
  [{type: 'count', message: 'Not enough resources on this card', current: 0}],
  [{type: 'megacredits', message: 'Need ${0} more M€', params: ['3']}],
  [{type: 'rule', message: 'Action conditions are not met right now'}],
];

function buildMockTableau(names: ReadonlyArray<CardName>): {
  tableau: ReadonlyArray<CardModel>,
  available: Array<CardName>,
  used: Array<CardName>,
} {
  const tableau: Array<CardModel> = [];
  const available: Array<CardName> = [];
  const used: Array<CardName> = [];
  names.forEach((name, i) => {
    const bucket = i % 4;
    const model: CardModel = {name, resources: 3};
    if (bucket === 0) {
      available.push(name); // activatable now
    } else if (bucket === 1) {
      model.actionReasons = FAKE_REASONS[i % FAKE_REASONS.length]; // unavailable
    } else if (bucket === 2) {
      used.push(name); // activated this generation
    }
    // bucket === 3 → soft ("not your turn")
    tableau.push(model);
  });
  return {tableau, available, used};
}

function mockPlayer(color: Color, name: string, tableau: ReadonlyArray<CardModel>, used: ReadonlyArray<CardName>): PublicPlayerModel {
  return {color, name, tableau, actionsThisGeneration: used} as unknown as PublicPlayerModel;
}

function rowInfo(name: CardName): FlagRow {
  const card = getCard(name);
  return {
    name,
    kind: card?.type === CardType.CORPORATION ? 'Corporation' : 'Card',
    module: card !== undefined ? MODULE_NAMES[card.module] : '',
  };
}

type DataModel = {
  tab: 'all' | 'flagged';
  open: boolean;
  awaiting: boolean;
  selectedColor: Color;
  players: ReadonlyArray<PublicPlayerModel>;
  availableNames: ReadonlyArray<CardName>;
  allCount: number;
  viewerColor: Color;
  zoomCard: CardModel | undefined;
  pendingCardName: CardName | undefined;
};

export default defineComponent({
  name: 'ActionsPlayground',
  components: {ActionsOverlay, CardActionConfirmContent, MandatoryInputModal, CardZoomModal},
  data(): DataModel {
    const names = allScopeActionCardNames();
    const {tableau, available, used} = buildMockTableau(names);
    const players = [
      mockPlayer('red', 'All actions (you)', tableau, used),
      mockPlayer('blue', 'Opponent (read-only)', tableau, used.slice(0, 2)),
    ];
    return {
      tab: 'all',
      open: true,
      awaiting: false,
      selectedColor: 'red',
      players,
      availableNames: available,
      allCount: names.length,
      viewerColor: 'red',
      zoomCard: undefined,
      pendingCardName: undefined,
    };
  },
  computed: {
    displayedPlayer(): PublicPlayerModel {
      return this.players.find((p) => p.color === this.selectedColor) ?? this.players[0];
    },
    overrideRows(): ReadonlyArray<FlagRow> {
      return overriddenActionCards().map(rowInfo);
    },
    candidateRows(): ReadonlyArray<FlagRow> {
      return flaggedActionCandidates().map(rowInfo);
    },
    flaggedCount(): number {
      return this.overrideRows.length + this.candidateRows.length;
    },
  },
  methods: {
    togglePlayer(): void {
      this.selectedColor = this.selectedColor === 'red' ? 'blue' : 'red';
    },
    onActivate(name: CardName): void {
      this.open = false;
      this.pendingCardName = name;
    },
    openCard(name: CardName): void {
      this.zoomCard = {name} as CardModel;
      nextTick(() => {
        (this.$refs.zoom as {show?: () => void} | undefined)?.show?.();
      });
    },
  },
});
</script>
