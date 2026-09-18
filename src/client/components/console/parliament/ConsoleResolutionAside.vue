<template>
  <!-- THE PARTY COLUMN of the resolution inspector (Turmoil Redux) — the
       left gutter of the fullscreen viewer, where a project card keeps its
       archive entry. A resolution has no lore; what it has is a PARTY, and
       the party is what the vote is about: one glass column in the rules
       panel's own chrome, with the party's PLAQUE (seal · name · the action's
       badge · one context line · the printed mechanic — the one graphic of
       the scene the resolution card does not print) and, under it, the
       mechanics' SENTENCES through the shared rules panel. The words explain
       the plaque's graphic; the action's state is the plaque's badge; the
       personal access is the footer's — neither is repeated in the text. -->
  <div class="con-zoom-rules-host con-rinspect-aside" :class="{'con-zoom-rules-host--closing': closing}">
    <aside class="con-zoom-rules con-rinspect-aside__box" :aria-label="$t('Party of the resolution')" :data-party="party">
      <div class="con-zoom-rules__head">
        <span class="con-zoom-rules__mark" aria-hidden="true">◈</span>
        <span class="con-zoom-rules__title">{{ $t('Party of the resolution') }}</span>
      </div>
      <ConsolePartyPlaque class="con-rinspect-aside__plaque"
                          data-zoom-flank-content
                          :party="party"
                          size="aside"
                          :actionState="actionState"
                          :note="contextText"
                          :formula="true" />
      <ConsoleCardRulesPanel ref="rules"
                             class="con-rinspect-aside__rules"
                             embedded
                             keepOrder
                             :tier="tier"
                             :annotationsOverride="annotations"
                             :nonce="nonce"
                             :closing="closing" />
    </aside>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {partyActionOf, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import {RulesLengthTier} from '@/client/components/console/consoleCardRules';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import {resolutionPartyAnnotations, RowText} from '@/client/console/parliament/parliamentAnnotations';
import {PartyActionStateVm, partyActionStateOf, ParliamentPartyVm} from '@/client/console/parliament/consoleParliamentModel';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {translateText} from '@/client/directives/i18n';

export default defineComponent({
  name: 'ConsoleResolutionAside',
  components: {ConsoleCardRulesPanel, ConsolePartyPlaque},
  props: {
    party: {type: String as PropType<ReduxParty>, required: true},
    /** The live parliament (undefined outside a game — the plate then states nothing about the table). */
    parliament: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    /** The player the inspector is opened AS (never the player whose turn it is). */
    viewer: {type: String as PropType<Color | undefined>, default: undefined},
    /** The viewer's own action window is open right now (an execution gate, never a reason). */
    canActNow: {type: Boolean, default: false},
    /** The context line's i18n key (from `resolutionPartyContextKey`), undefined without a table. */
    contextKey: {type: String as PropType<string | undefined>, default: undefined},
    /** The viewer's VOTE on the card, in words (`voteFactRowsOf`) — a block under the party's sentences while the card is up for the vote. */
    voteRows: {type: Array as PropType<ReadonlyArray<RowText> | undefined>, default: undefined},
    /** The scene's ONE reading tier (the denser of this column and the rules column). */
    tier: {type: String as PropType<RulesLengthTier | undefined>, default: undefined},
    /** The viewer's settle signal (forwarded to the rules panel's measure). */
    nonce: {type: Number, default: 0},
    /** The close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
  },
  computed: {
    annotations(): ReadonlyArray<CardAnnotation> {
      return resolutionPartyAnnotations(this.party, this.voteRows);
    },
    contextText(): string | undefined {
      return this.contextKey === undefined ? undefined : translateText(this.contextKey);
    },
    /**
     * The action badge beside the name — the SAME object the Parliament's
     * plaques wear (lit / stamped ✓ / outlined), read off the server's own
     * action model for the viewer. No badge without a table or for a party
     * with no action.
     */
    actionState(): PartyActionStateVm | undefined {
      const model = this.parliament;
      const actionId = partyActionOf(this.party);
      if (model === undefined || actionId === undefined || this.viewer === undefined) {
        return undefined;
      }
      const seat = model.players.find((p) => p.color === this.viewer);
      if (seat === undefined || !seat.participates) {
        return undefined;
      }
      const vm: ParliamentPartyVm = {
        party: this.party,
        effect: getPartyEffect(this.party),
        rule: undefined,
        support: model.popularSupport[this.party] ?? 0,
        inArea: model.slots.some((slot) => slot.party === this.party),
        ruling: model.rulingParty === this.party,
        access: seat.access.find((a) => a.party === this.party),
        actionId,
        action: model.viewer?.partyActions.find((a) => a.party === this.party),
      };
      const state = partyActionStateOf(vm, this.canActNow);
      return state.kind === 'none' ? undefined : state;
    },
  },
  methods: {
    /** Right-stick paging of the text block (routed by the shell when the right panel has nothing to scroll). */
    scrollBody(delta: number): boolean {
      const rules = this.$refs.rules as {scrollBody?: (dy: number) => boolean} | undefined;
      return rules?.scrollBody?.(delta) ?? false;
    },
  },
});
</script>
