<template>
<div class="payments_cont">
  <div v-if="showtitle === true">{{ $t(playerinput.title) }}</div>
  <!--
    `hideCards` lets a premium host (the card-play preview modal) render the
    source card itself elsewhere and reuse ONLY this widget's payment rules +
    PaymentFormV2 (the single constrained card is already auto-selected via the
    `cardName` default). The legacy radio flow leaves it false and shows the list.
  -->
  <template v-if="hideCards !== true">
    <label v-for="availableCard in cards" class="payments_cards" :key="availableCard.name">
      <input v-if="!availableCard.isDisabled" class="hidden" type="radio" v-model="cardName" :value="availableCard.name" />
      <Card class="cardbox" :card="availableCard" />
    </label>
  </template>
  <template v-if="hideWarnings !== true">
    <template v-if="card !== undefined && card.additionalProjectCosts">
      <div v-if="card.additionalProjectCosts.aeronGenomicsResources" class="card-warning"
        v-i18n="[$t(card.name), card.additionalProjectCosts.aeronGenomicsResources, 'animals', $t(CardName.AERON_GENOMICS)]"
      >
        Playing ${0} consumes ${1} ${2} from ${3}
      </div>
      <div v-if="card.additionalProjectCosts.thinkTankResources" class="card-warning"
        v-i18n="[$t(card.name), card.additionalProjectCosts.thinkTankResources, 'data', $t(CardName.THINK_TANK)]">
        Playing ${0} consumes ${1} ${2} from ${3}
      </div>
      <div v-if="card.additionalProjectCosts.redsCost" class="card-warning" v-i18n="[$t(card.name), card.additionalProjectCosts.redsCost, $t('Reds')]">
        Playing ${0} will cost ${1} M€ more because ${2} are in power
      </div>
    </template>
    <warnings-component v-if="card !== undefined" :warnings="card.warnings"></warnings-component>
  </template>

  <PaymentFormV2
    v-if="showPaymentSection"
    ref="paymentForm"
    :key="cardName"
    :cost="cost"
    :order="order"
    :ledger="ledger"
    :showsave="showsave"
    :buttonLabel="playerinput.buttonLabel"
    @change="onPaymentChange"
    @save="doSave" />
</div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {SpendableResource} from '@/common/inputs/Spendable';
import Card from '@/client/components/card/CardFace.vue';
import {getCardOrThrow} from '@/client/cards/ClientCardManifest';
import {CardModel} from '@/common/models/CardModel';
import {CardOrderStorage} from '@/client/utils/CardOrderStorage';
import {PaymentWidgetMixin} from '@/client/mixins/PaymentWidgetMixin';
import {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Tag} from '@/common/cards/Tag';
import {Units} from '@/common/Units';
import {CardName} from '@/common/cards/CardName';
import {SelectProjectCardToPlayResponse} from '@/common/inputs/InputResponse';
import WarningsComponent from '@/client/components/WarningsComponent.vue';
import PaymentFormV2 from '@/client/components/payment/PaymentFormV2.vue';
import {Ledger} from '@/client/components/PaymentLedger';

export default defineComponent({
  name: 'SelectProjectCardToPlay',
  mixins: [PaymentWidgetMixin],
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectProjectCardToPlayModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectProjectCardToPlayResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
    },
    showtitle: {
      type: Boolean,
    },
    // Premium host (card-play preview modal) only: hide the card radio list so
    // the host renders the source card itself + owns the submit (via `saveData`),
    // and re-emit payment validity through `@change` so the host can gate its CTA.
    hideCards: {
      type: Boolean,
      default: false,
    },
    // Premium host only: suppress the legacy red `.card-warning` notices (maxtemp,
    // Reds tax, Think Tank / Aeron Genomics). The host renders them premium via
    // `PremiumCardWarnings` instead, so the modal never shows raw legacy text.
    hideWarnings: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['change'],
  computed: {
    order(): ReadonlyArray<SpendableResource> {
      return ([
        'steel',
        'titanium',
        'heat',
        'plants',
        'microbes',
        'floaters',
        'lunaArchivesScience',
        'seeds',
        'graphene',
        'kuiperAsteroids',
        'auroraiData',
        'spireScience',
        'megacredits',
      ] as const).filter(this.canUse);
    },
    ledger(): Ledger {
      return this.buildLedger(this.order, this.reserveUnits);
    },
    CardName(): typeof CardName {
      return CardName;
    },
    showPaymentSection(): boolean {
      return this.card !== undefined && this.card.isDisabled !== true;
    },
  },
  watch: {
    // Vue runs watchers before re-rendering the component that owns them, so
    // available units are updated before PaymentForm remounts via :key and reads them.
    cardName(newVal: string | undefined) {
      if (newVal === undefined) {
        return;
      }
      // TODO(kberg): this stuff is set in data(). Perhaps share the code?
      this.card = this.getCard();
      this.cost = this.card.calculatedCost ?? 0;
      this.tags = this.getCardTags();
      this.reserveUnits = this.card.reserveUnits ?? Units.EMPTY;
      this.updateAvailableUnits();
    },
  },
  data() {
    let card: CardModel | undefined;
    let cards: ReadonlyArray<CardModel> = [];
    if ((this.playerinput?.cards?.length ?? 0) > 0) {
      cards = CardOrderStorage.getOrdered(
        CardOrderStorage.getCardOrder(this.playerView.id),
        this.playerinput.cards,
      );
      card = cards[0];
    }
    return {
      cardName: card?.name,
      card: card,
      reserveUnits: card?.reserveUnits ?? Units.EMPTY,
      cards: cards,
      cost: card?.calculatedCost ?? 0,
      tags: card !== undefined ? getCardOrThrow(card.name).tags : [],
      available: Units.of({}),
    };
  },
  components: {
    Card,
    PaymentFormV2,
    WarningsComponent,
  },
  created() {
    if (this.cards.length === 0) {
      return;
    }
    this.updateAvailableUnits();
  },
  methods: {
    getCard() {
      const card = this.cards.find((c) => c.name === this.cardName);
      if (card === undefined) {
        throw new Error(`card not found ${this.cardName}`);
      }
      return card;
    },
    getCardTags() {
      // By the time getCardTags is called, this.cardName is defined. This is an
      // unnecessary guard.
      if (this.cardName === undefined) {
        return [];
      }
      return getCardOrThrow(this.cardName).tags;
    },
    updateAvailableUnits() {
      const thisPlayer = this.playerView.thisPlayer;
      this.available.steel = Math.max(thisPlayer.steel - this.reserveUnits.steel, 0);
      this.available.titanium = Math.max(thisPlayer.titanium - this.reserveUnits.titanium, 0);
      this.available.heat = Math.max(this.availableHeat() - this.reserveUnits.heat, 0);
      this.available.plants = Math.max(thisPlayer.plants - this.reserveUnits.plants, 0);
    },
    canUseTitaniumRegularly(): boolean {
      return this.tags.includes(Tag.SPACE) ||
          this.playerView.thisPlayer.lastCardPlayed === CardName.LAST_RESORT_INGENUITY;
    },
    canUse(unit: SpendableResource): boolean {
      if (this.card === undefined) {
        return false;
      }
      const canPayWith = this.card.standardProjectCanPayWith;
      if (canPayWith !== undefined) {
        // Standard project: use explicit payment rules from the server
        switch (unit) {
        case 'megacredits':
          return true;
        // auroraiData and spireScience are always accepted by standard projects
        // (see StandardProjectCard.canPlayOptions.)
        case 'auroraiData':
        case 'spireScience':
          return true;
        case 'heat':
          return this.playerinput.paymentOptions.heat === true;
        case 'steel':
          return canPayWith.steel === true;
        case 'titanium':
          return canPayWith.titanium === true ||
              this.playerinput.paymentOptions.lunaTradeFederationTitanium === true;
        case 'seeds':
          return canPayWith.seeds === true;
        case 'kuiperAsteroids':
          return canPayWith.kuiperAsteroids === true;
        case 'plants':
        case 'microbes':
        case 'floaters':
        case 'lunaArchivesScience':
        case 'graphene':
          return false;
        default: throw new Error('Unknown unit ' + unit);
        }
      } else {
        // Regular project card: tag-based payment rules
        switch (unit) {
        case 'megacredits':
          return true;
        case 'heat':
          return this.playerinput.paymentOptions.heat === true;
        case 'steel':
          return this.tags.includes(Tag.BUILDING) ||
          this.playerView.thisPlayer.lastCardPlayed === CardName.LAST_RESORT_INGENUITY;
        case 'titanium':
          return this.canUseTitaniumRegularly() ||
          this.playerinput.paymentOptions.lunaTradeFederationTitanium === true;
        case 'plants':
          return this.tags.includes(Tag.BUILDING) && this.playerinput.paymentOptions.plants === true;
        case 'microbes':
          return this.tags.includes(Tag.PLANT);
        case 'floaters':
          return this.tags.includes(Tag.VENUS);
        case 'lunaArchivesScience':
          return this.tags.includes(Tag.MOON);
        case 'seeds':
          return this.tags.includes(Tag.PLANT);
        case 'graphene':
          return this.tags.includes(Tag.SPACE) ||
            this.tags.includes(Tag.CITY);
        case 'kuiperAsteroids':
        case 'auroraiData':
        case 'spireScience':
          return false;
        default:
          throw new Error('Unknown unit ' + unit);
        }
      }
    },
    /** @override */
    getTitaniumResourceRate(): number {
      const titaniumValue = this.playerView.thisPlayer.titaniumValue;
      if (this.canUseTitaniumRegularly() || this.card?.standardProjectCanPayWith?.titanium === true) {
        return titaniumValue;
      }
      return titaniumValue - 1;
    },
    // PaymentFormV2 emits its dialed payment on every change. Mirror it onto our
    // local `payment` AND re-emit whether that payment COVERS the cost up to a
    // premium host (the card-play preview modal) so it can enable/disable its
    // single confirm CTA without owning the payment rules. Validity is computed
    // from OUR reactive `cost`/`order`/`ledger` (defensively, with `?? 0`) rather
    // than the child's `canSave()` — the child ref is in flux while a card switch
    // remounts PaymentFormV2 (`:key="cardName"`), and reading it there threw.
    // The legacy radio flow ignores `@change`.
    onPaymentChange(p: typeof this.payment): void {
      this.payment = p;
      this.$emit('change', this.paymentCoversCost(p));
    },
    paymentCoversCost(p: typeof this.payment): boolean {
      if (this.cost === 0) {
        return true;
      }
      let total = 0;
      for (const unit of this.order) {
        const amount = p[unit] ?? 0;
        const entry = this.ledger[unit];
        if (entry === undefined) {
          continue;
        }
        if (amount > entry.available) {
          return false;
        }
        total += amount * entry.rate;
      }
      return total >= this.cost;
    },
    saveData() {
      if (this.card === undefined) {
        return;
      }
      const paymentForm = this.$refs.paymentForm as {handleSave: () => void} | undefined;
      if (paymentForm !== undefined) {
        paymentForm.handleSave();
      } else {
        this.doSave();
      }
    },
    doSave() {
      if (this.card === undefined) {
        return;
      }
      this.onsave({type: 'projectCard', card: this.card.name, payment: this.payment});
    },
  },
});
</script>
