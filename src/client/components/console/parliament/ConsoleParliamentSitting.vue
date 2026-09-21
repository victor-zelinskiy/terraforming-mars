<template>
  <!-- ══ THE SITTING (Turmoil Redux, v2) — «ПАРЛАМЕНТ › ЗАСЕДАНИЕ»: the political
       phase's ONE flow, four STAGES as POSES of this one always-mounted
       surface (verdict · enactment · reward · results). A stage change swaps a
       modifier, never a subtree — the director animates between the poses and
       turns the middle two by itself; here they are static and honest. Every
       object on every panel is the SERVER's own record (the phase summary, the
       recorded outcomes, the awaited seats), never a recomputation.

       HOST-AGNOSTIC (the embed contract): the surface titles NOTHING of its
       own — its stage name goes UP to the host's crumb («ЗАСЕДАНИЕ › ВЕРДИКТ»),
       its verbs live on the ONE command bar (the host publishes them), and its
       reward zone `[data-embed-slot="parliament-stage"]` is where the shell
       teleports the enacted resolution's own asks (the payout pick, the take).
       `mode: 'review'` reads a finished phase's summary the same way (the
       protocol's re-inspection, later); today only `live` is used. ══ -->
  <div class="con-sit"
       :class="{'con-sit--field': field, 'con-sit--embedded': embedded}"
       :data-sit-stage="stage"
       :data-sit-step="position.rewardStep"
       :data-sit-mode="mode"
       data-parl-sitting>

    <!-- ── ВСТРОЕННЫЙ ШАГ (v5): the ONE body state the player WORKS in — a pick of a card for a
         resource, a take of drawn cards. The readings of the reward itself are NOT here: the payout's
         formula, the ruling party's answer, a skip with its reason and the honest wait all live in the
         READING BAND above the zone, which never moves and is never taken by anything. What stands here
         is the work: the carrier card as the visible source, and the zone the enacted resolution's own
         ask is teleported into. ── -->
    <section class="con-sit__panel con-sit__panel--reward" :class="{'con-sit__panel--on': stage === 'reward'}" data-sit-panel="reward">
      <div class="con-sit__reward" :class="{'con-sit__reward--field': field}">
        <div class="con-sit__hero" :class="{'con-sit__hero--field': field}">
          <!-- The carried enacted card lands here (one DOM instance, teleported by the government) while the step holds the field. -->
          <div class="con-sit__card" data-parl-sit-hero></div>
        </div>
        <div class="con-sit__zone" :class="{'con-sit__zone--on': field}">
          <div class="con-sit__embed" data-embed-slot="parliament-stage"></div>
        </div>
      </div>
    </section>

    <!-- ── ПАНЕЛЬ ИТОГОВ (v5 §4) — the sitting's last reading, and the one surface that does NOT fold
         back: the sitting ends after it. THREE sections and nothing beside them, because the panel shows
         only what is nowhere else on the screen — the generation's number is in the band above it, the
         voting area is the voting area, the enacted card prints its own effect in the government.
         ① ЗАКОН · ② ВЫПЛАТЫ (a row per seat — a player saw its OWN chips fly and has never been shown
         anybody else's) · ③ СТОЛ (what changed and is already out of sight). ── -->
    <section class="con-sit__panel con-sit__panel--results" :class="{'con-sit__panel--on': stage === 'results'}" data-sit-panel="results">
      <div v-if="results !== undefined" class="con-sit__results" :class="{'con-sit__results--hidden': resultsHidden}" data-sit-results :data-sit-results-hidden="resultsHidden ? '' : undefined">
        <!-- ① ЗАКОН — one line with icons: what stands, who rules by it, what the chairman is set. -->
        <div class="con-sit__law" data-sit-section="law">
          <span class="con-sit__law-part" data-sit-law="enacted">
            <span class="con-parl__chip-dim">{{ $t('Enacted') }}</span>
            <img class="con-sit__emblem" :src="emblemUrl(results.law.party)" alt="" />
            <b class="con-sit__law-name">{{ $t(resolutionTitle(results.law.resolution)) }}</b>
          </span>
          <span class="con-sit__law-part" data-sit-law="ruling">
            <span class="con-parl__chip-dim">{{ $t('Ruling party') }}</span>
            <b>{{ $t(partyNameKey(results.law.party)) }}</b>
          </span>
          <span v-if="results.law.quest !== undefined" class="con-sit__law-part con-sit__law-part--quest" data-sit-law="quest">
            <span class="con-parl__chip-dim">{{ $t('Chairman quest') }}</span>
            <span class="con-sit__law-quest">{{ $t(results.law.quest.text) }}</span>
            <PlayerCube v-if="results.law.chairman !== undefined" :color="results.law.chairman" :size="cubePx(11)" :glow="false" />
          </span>
        </div>

        <!-- ② ВЫПЛАТЫ — the panel's main content. A skip names itself with its reason, as on the reward beat. -->
        <div class="con-sit__payouts" data-sit-section="payouts">
          <span class="con-parl__chip-dim con-sit__section-kicker">{{ $t('Payouts') }}</span>
          <span v-if="results.quiet !== undefined" class="con-sit__payout-quiet" data-sit-payout-quiet>{{ $t(results.quiet.kicker) }}</span>
          <div v-for="row in results.payouts" v-else :key="row.player" class="con-sit__payout" data-sit-payout :data-sit-payout-seat="row.player">
            <span class="con-sit__payout-who">
              <PlayerCube :color="row.player" :size="cubePx(11)" :glow="false" />
              <b class="con-sit__payout-name">{{ nameOfColor(row.player) }}</b>
            </span>
            <span class="con-sit__payout-parts">
              <span v-if="row.parts.length === 0" class="con-parl__chip-dim" data-sit-payout-none>{{ $t('No reward') }}</span>
              <span v-for="part in row.parts" :key="part.id" class="con-sit__part"
                    :class="{'con-sit__part--skipped': part.skipped !== undefined}" :data-sit-part="part.kind">
                <template v-if="part.skipped !== undefined">
                  <span class="con-parl__chip-dim">{{ $t('Skipped') }} · {{ $t(part.skipped.title) }}</span>
                  <span class="con-sit__part-reason">{{ $t(part.skipped.reason) }}</span>
                </template>
                <template v-else>
                  <img v-if="part.party !== undefined" class="con-sit__emblem" :src="emblemUrl(part.party)" alt="" />
                  <i v-if="part.tile !== undefined" class="con-sit__door-tile" :class="'con-sit__door-tile--' + part.tile" aria-hidden="true"></i>
                  <template v-else>
                    <b>+{{ part.amount }}</b>
                    <i class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
                  </template>
                </template>
              </span>
            </span>
          </div>
        </div>

        <!-- ③ СТОЛ — the new resolutions with their parties, the support after the deal, the lobby. -->
        <div class="con-sit__table" data-sit-section="table">
          <span class="con-parl__chip-dim con-sit__section-kicker">{{ $t('The table') }}</span>
          <div class="con-sit__row" data-sit-row="results-fresh">
            <span class="con-parl__chip-dim">{{ $t('New resolutions') }}</span>
            <span v-if="results.table.fresh.length === 0" class="con-sit__chips"><b>—</b></span>
            <span v-else class="con-sit__chips">
              <span v-for="fresh in results.table.fresh" :key="fresh.instance" class="con-sit__chip" data-sit-fresh>
                <img class="con-sit__emblem" :src="emblemUrl(fresh.party)" alt="" /><b>{{ $t(resolutionTitle(fresh.resolution)) }}</b>
                <span v-if="fresh.stays" class="con-parl__chip-dim" data-sit-stays>{{ $t('stays · reshuffled') }}</span>
              </span>
            </span>
          </div>
          <div class="con-sit__row" data-sit-row="results-support">
            <span class="con-parl__chip-dim">{{ $t('Popular support') }}</span>
            <span class="con-sit__chips">
              <span v-for="entry in results.table.support" :key="entry.party" class="con-sit__chip" data-sit-support :data-sit-support-party="entry.party">
                <img class="con-sit__emblem" :src="emblemUrl(entry.party)" alt="" /><b>{{ entry.total }}</b>
              </span>
            </span>
          </div>
          <div class="con-sit__row" data-sit-row="results-lobby">
            <span class="con-parl__chip-dim">{{ $t('To the lobby') }}</span>
            <span v-if="results.table.lobby.length === 0" class="con-sit__chips"><b>—</b></span>
            <span v-else class="con-sit__chips">
              <span v-for="color in results.table.lobby" :key="color" class="con-sit__chip"><PlayerCube :color="color" :size="cubePx(11)" :glow="false" /></span>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {quietRewardPoseOf, SittingPosition, SittingStage} from '@/client/console/parliament/consoleSittingFlow';
import {ResultsPayoutPart, ResultsReading, resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export default defineComponent({
  name: 'ConsoleParliamentSitting',
  components: {PlayerCube},
  props: {
    /** Where the sitting stands on the server (`consoleSittingFlow.sittingPositionOf`). */
    position: {type: Object as PropType<SittingPosition>, required: true},
    /** The stage on screen — the host's page cursor over the position's pages. */
    stage: {type: String as PropType<SittingStage>, required: true},
    /** The phase's summary — the live sitting's `phase.summary`, a review's finished summary. */
    summary: {type: Object as PropType<ParliamentPhaseSummaryModel | undefined>, default: undefined},
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    /** The step holds the FIELD (a hosted step stands in its zone). */
    field: {type: Boolean, default: false},
    /** The results panel waits for the renewal's beats (the director reveals it). */
    resultsHidden: {type: Boolean, default: false},
    /** Hosted inside another surface's zone (nothing of the chassis to strip — the sitting never titles itself). */
    embedded: {type: Boolean, default: false},
    /** `live` — the phase in progress; `review` — a finished sitting re-read (the protocol, later). */
    mode: {type: String as PropType<'live' | 'review'>, default: 'live'},
  },
  mounted() {
    // THE ZONE IS PUBLISHED BY ITS OWN HOST (v4) — see `consoleParliamentUi.stageZone`. The live surface only:
    // a review / gallery copy owns no teleport target.
    if (this.mode === 'live') {
      consoleParliamentUi.stageZone = true;
    }
  },
  beforeUnmount() {
    if (this.mode === 'live') {
      consoleParliamentUi.stageZone = false;
    }
  },
  computed: {
    resolution(): IClientResolution | undefined {
      const id = this.shownSummary?.enacted.resolution;
      return id === undefined ? undefined : getResolution(id);
    },
    shownSummary(): ParliamentPhaseSummaryModel | undefined {
      return this.mode === 'review' ? this.summary : this.model?.phase?.summary ?? this.summary;
    },
    /**
     * ПАНЕЛЬ ИТОГОВ — the pure reading (`parliamentResultsModel.ts`): the law, a payout row per seat, the
     * table. The SEAT ORDER is the parliament model's own — the same one the seats zone in the head line
     * already shows, so the panel has one visible ordering key and no other.
     */
    results(): ResultsReading | undefined {
      const summary = this.shownSummary;
      if (summary === undefined) {
        return undefined;
      }
      const quiet = quietRewardPoseOf(this.resolution);
      const quest = this.view.quest;
      return resultsReadingOf(
        summary,
        (this.model?.players ?? []).filter((p) => p.participates).map((p) => p.color),
        this.view.parties.map((party) => ({party: party.party, support: party.support})),
        {
          ...(quest === undefined ? {} : {quest: {text: quest.text, generation: quest.generation}}),
          ...(this.view.chairman === undefined ? {} : {chairman: this.view.chairman}),
          ...(quiet === undefined ? {} : {quiet: {kicker: quiet.kicker, kind: quiet.kind}}),
        },
      );
    },
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    resolutionTitle(id: string): string {
      return resolutionTitleOf(this.view, id);
    },
    nameOfColor(color: Color): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    /** The icon family of a payout part — the console's own sprites, the production frame where it is production. */
    partUnitClass(part: ResultsPayoutPart): string {
      if (part.unit === '') {
        return '';
      }
      if (part.kind === 'cardResource') {
        return iconClassFor(cardResourceKey(part.unit));
      }
      return iconClassFor(part.unit) + (part.production ? ' con-iyield__unit--prod' : '');
    },
  },
});
</script>
