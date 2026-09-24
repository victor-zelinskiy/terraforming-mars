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
         resource, a take of drawn cards, a discard from hand. The readings of the reward itself are NOT
         here: the payout's formula, the ruling party's answer, a skip with its reason and the honest wait
         all live in the READING BAND above the zone, which never moves and is never taken by anything.
         What stands here is the work: the carrier card as the visible source, and the zone the enacted
         resolution's own ask is teleported into.
         …AND THE COLONY LEDGER (Colonial Affairs): a resolution that pays the seat's colony bonuses reads
         its ledger IN THE ZONE for the whole reward page — its rows are the wave's sources (a chip leaves
         the printed bonus of the tile that pays it), so the body stands BEFORE the wave. The zone is a
         LAYER STACK: the ledger and the hosted step's slot share one rect; the ledger yields (folds down)
         while a step stands and comes back when it has left — never a `v-if` cut. ── -->
    <section class="con-sit__panel con-sit__panel--reward" :class="{'con-sit__panel--on': stage === 'reward'}" data-sit-panel="reward">
      <div class="con-sit__reward" :class="{'con-sit__reward--field': field}">
        <div class="con-sit__hero" :class="{'con-sit__hero--field': field}">
          <!-- The carried enacted card lands here (one DOM instance, teleported by the government) while the step holds the field. -->
          <div class="con-sit__card" data-parl-sit-hero></div>
        </div>
        <div class="con-sit__zone" :class="{'con-sit__zone--on': field, 'con-sit__zone--ledger': ledger !== undefined}" :data-sit-zone-step="stepOpen ? '' : undefined">
          <div class="con-sit__embed" :class="{'con-sit__embed--on': stepOpen}" data-embed-slot="parliament-stage"></div>
          <transition :css="false" @enter="onLedgerEnter" @leave="onLedgerLeave" @enter-cancelled="onLedgerCancelled" @leave-cancelled="onLedgerCancelled">
            <div v-if="ledger !== undefined" v-show="!stepOpen" class="con-sit__ledgerpane" data-sit-ledger>
              <ConsoleColonyLedger :reading="ledger" size="hero" :activeColony="activeColony" :landedColonies="landedColonies" />
            </div>
          </transition>
        </div>
      </div>
    </section>

    <!-- ── ПАНЕЛЬ ИТОГОВ (v5 §4) — the sitting's last reading, and the one surface that does NOT fold
         back: the sitting ends after it. TWO sections and nothing beside them, because the panel shows
         only what is nowhere else on the screen — the generation's number is in the band above it, the
         voting area is the voting area, and the enacted card, the party that rules by it and the new
         chairman quest all stand in the GOVERNMENT's zone, richer there than any line here could be.
         ① ВЫПЛАТЫ (a row per seat — a player saw its OWN chips fly and has never been shown anybody
         else's) · ② СТОЛ (what changed and is already out of sight). ── -->
    <section class="con-sit__panel con-sit__panel--results" :class="{'con-sit__panel--on': stage === 'results'}" data-sit-panel="results">
      <div v-if="results !== undefined" class="con-sit__results" :class="{'con-sit__results--hidden': resultsHidden}" data-sit-results :data-sit-results-hidden="resultsHidden ? '' : undefined">
        <!-- ① ВЫПЛАТЫ — the panel's main content. A skip names itself with its reason, as on the reward beat. -->
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
                    :class="{'con-sit__part--skipped': part.skipped !== undefined, 'con-sit__part--colony': part.colony !== undefined}" :data-sit-part="part.kind"
                    :data-sit-part-colony="part.colony">
                <!-- A COLONY-PAID part (Colonial Affairs) leads with its TILE — the panel groups a seat's parts by it,
                     one planet + name per tile, the parts of that tile following (the ledger's own order). -->
                <span v-if="part.colony !== undefined && colonyLeads(row.parts, part)" class="con-sit__part-colony" data-sit-part-tile>
                  <span class="con-sit__part-planet" :class="planetClass(part.colony)" aria-hidden="true"></span>
                  <b class="con-sit__part-colony-name">{{ $t(part.colony) }}</b>
                </span>
                <template v-if="part.skipped !== undefined">
                  <!-- A LEVEL part at its target (Joint Research) is the rule working, not a skip: the calm
                       phrase the band printed, then the server's reason. -->
                  <span v-if="part.none !== undefined" class="con-parl__chip-dim" data-sit-part-none>{{ $t(part.none) }}</span>
                  <span v-else class="con-parl__chip-dim">{{ $t('Skipped') }} · {{ $t(part.skipped.title) }}</span>
                  <span class="con-sit__part-reason">{{ $t(part.skipped.reason) }}</span>
                </template>
                <template v-else>
                  <img v-if="part.party !== undefined" class="con-sit__emblem" :src="emblemUrl(part.party)" alt="" />
                  <i v-if="part.tile !== undefined" class="con-sit__door-tile" :class="'con-sit__door-tile--' + part.tile" aria-hidden="true"></i>
                  <!-- A HUD-side colony bonus reads by its printed description, signed where it prints an amount (a loss is negative). -->
                  <template v-else-if="part.kind === 'colonyBonus'">
                    <b v-if="part.unit !== ''">{{ signedAmount(part.amount) }}</b>
                    <i v-if="part.unit !== ''" class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
                    <span class="con-sit__part-reason" data-sit-part-description>{{ $t(part.description ?? '') }}</span>
                  </template>
                  <!-- A card thrown away (Pluto's second half): the discard mark, the card. -->
                  <template v-else-if="part.kind === 'discard'">
                    <span class="con-sit__part-discard" aria-hidden="true">⌫</span>
                    <b>{{ part.amount }}</b>
                    <i class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
                  </template>
                  <template v-else>
                    <!-- Signed: a LEVY is a negative supply part («−10»), read with its sign, never as a skip;
                         a short seat's take carries the shortfall's reason beside it. -->
                    <b :class="{'con-sit__part-loss': (part.amount ?? 0) < 0}" :data-sit-part-amount="part.amount">{{ signedAmount(part.amount) }}</b>
                    <!-- A unit of SEVERAL kinds («data or microbe») draws as ONE unit joined by «or»; every other part its one icon. -->
                    <ConsoleYieldUnit v-if="part.units !== undefined" :classes="partUnitClasses(part)" extra="con-sit__part-unit" />
                    <i v-else class="con-sit__part-unit" :class="partUnitClass(part)" aria-hidden="true"></i>
                    <span v-if="part.note !== undefined" class="con-sit__part-reason" data-sit-part-note>{{ $t(part.note) }}</span>
                    <!-- A payout SPREAD over several cards names each recipient with its share — the list is the
                         record's own (`cards`), never a recount; one recipient prints the sum alone. Where the kinds
                         differ per card, each share wears its card's own icon. -->
                    <span v-if="part.cards !== undefined" class="con-sit__part-cards" data-sit-part-cards>
                      <span v-for="entry in part.cards" :key="entry.card" class="con-sit__part-card" :data-sit-part-card="entry.card" :data-sit-part-card-resource="entry.resource">{{ $t(entry.card) }} +{{ entry.amount }}<i v-if="part.units !== undefined && entry.resource !== undefined" class="con-sit__part-unit con-sit__part-unit--card" :class="cardResourceClass(entry.resource)" aria-hidden="true"></i></span>
                    </span>
                  </template>
                </template>
              </span>
              <!-- THE NET of a budget's supply parts («= −3 M€»): the day's balance the chips could not state. -->
              <span v-if="row.net !== undefined" class="con-sit__net" :class="{'con-sit__net--minus': row.net.amount < 0}" data-sit-net :data-sit-net-amount="row.net.amount">
                <span class="con-sit__net-eq" aria-hidden="true">=</span>
                <b>{{ signedAmount(row.net.amount) }}</b>
                <i class="con-sit__part-unit" :class="netUnitClass(row.net.unit)" aria-hidden="true"></i>
              </span>
            </span>
          </div>
        </div>

        <!-- ПЛАНЕТА — what the enactment did to the WORLD (Gas Export): one line, and only what is not
             visible anywhere else. The scales themselves have already moved on the board (the sitting
             stepped aside and came back for exactly that), so the line does not celebrate them: it states
             the step and the fact nobody was credited for it. A move that could not happen carries its
             own reason — the panel's law, and no silent loss. -->
        <div v-if="results.planet !== undefined" class="con-sit__row con-sit__planet" data-sit-section="planet" data-sit-row="results-planet">
          <span class="con-parl__chip-dim">{{ $t('The planet') }}</span>
          <span class="con-sit__chips">
            <span v-for="move in results.planet" :key="move.id" class="con-sit__chip con-sit__world"
                  :class="{'con-sit__world--down': move.steps < 0, 'con-sit__world--blocked': move.skipped !== undefined}"
                  data-sit-planet :data-sit-planet-param="move.parameter" :data-sit-planet-steps="move.steps">
              <i class="con-sit__world-icon" :class="worldUnitClass(move.parameter)" aria-hidden="true"></i>
              <span v-if="move.skipped !== undefined" class="con-parl__chip-dim">{{ $t(move.skipped) }}</span>
              <template v-else>
                <b>{{ move.before }}{{ worldSuffix(move.parameter) }}</b>
                <span class="con-parl__chip-dim">→</span>
                <b>{{ move.after }}{{ worldSuffix(move.parameter) }}</b>
              </template>
            </span>
            <span v-if="planetUnrewarded" class="con-parl__chip-dim" data-sit-planet-notr>{{ $t('nobody gets the TR') }}</span>
          </span>
        </div>

        <!-- ② СТОЛ — the new resolutions with their parties, the support STOCK after the deal, the lobby. -->
        <div class="con-sit__table" data-sit-section="table">
          <span class="con-parl__chip-dim con-sit__section-kicker">{{ $t('The table') }}</span>
          <div class="con-sit__row" data-sit-row="results-fresh">
            <span class="con-parl__chip-dim">{{ $t('New resolutions') }}</span>
            <span v-if="results.table.fresh.length === 0" class="con-sit__chips"><b>—</b></span>
            <span v-else class="con-sit__chips">
              <span v-for="fresh in results.table.fresh" :key="fresh.instance" class="con-sit__chip" data-sit-fresh>
                <img class="con-sit__emblem" :src="emblemUrl(fresh.party)" alt="" /><b>{{ $t(resolutionTitle(fresh.resolution)) }}</b>
              </span>
            </span>
          </div>
          <!-- НАРОДНАЯ ПОДДЕРЖКА — the STOCK after the deal, in the plaques' OWN vocabulary: filled and
               empty places out of three, so a zero reads as three empty sockets and the ceiling shows
               itself. A bare number could not say whether it was an increment or a stock, nor of what.
               This sitting's arrivals keep the brighter socket — one row answers «how much now» and
               «what changed» at once. The ruling party is absent by construction (its stock is always
               zero) and is read in the government's zone. -->
          <div class="con-sit__row" data-sit-row="results-support">
            <span class="con-parl__chip-dim">{{ $t('Popular support') }}</span>
            <span class="con-sit__chips">
              <span v-for="entry in results.table.support" :key="entry.party" class="con-sit__chip con-sit__support"
                    data-sit-support :data-sit-support-party="entry.party"
                    :data-sit-support-total="entry.total" :data-sit-support-fresh="entry.fresh">
                <img class="con-sit__emblem" :src="emblemUrl(entry.party)" alt="" />
                <span class="con-sit__support-places" aria-hidden="true">
                  <span v-for="n in supportPlaces" :key="n" class="con-sit__support-place"
                        :class="{
                          'con-sit__support-place--on': n <= entry.total,
                          'con-sit__support-place--fresh': n <= entry.total && n > entry.total - entry.fresh,
                        }"
                        :data-support-place="n">
                    <PlayerCube v-if="n <= entry.total" color="neutral" steel :size="cubePx(9)" :glow="false" />
                  </span>
                </span>
              </span>
            </span>
          </div>
          <!-- БЕЗ СВОБОДНОГО ДЕЛЕГАТА — the EXCEPTION, and the one lobby fact that is nowhere else. The
               delegates ledger at the top of the screen already shows, seat by seat, the lobby socket and
               the reserve stack with its count and name — so «who got one back» was a restatement of it
               (and a poorer one: `lobbyRefilled` records whose lobby was EMPTY and got filled, never who
               HAS a delegate). What the ledger never says out loud is the consequence: an empty socket
               over an empty reserve means this seat cannot vote at all next generation. Almost never
               true, so almost never on screen — and when it is, it is stated, never left silent. -->
          <div v-if="results.table.noDelegate.length > 0" class="con-sit__row con-sit__row--warn" data-sit-row="results-nodelegate">
            <span class="con-parl__chip-dim">{{ $t('Without a free delegate') }}</span>
            <span class="con-sit__chips">
              <span v-for="color in results.table.noDelegate" :key="color" class="con-sit__chip" data-sit-nodelegate :data-sit-nodelegate-seat="color">
                <PlayerCube :color="color" :size="cubePx(11)" :glow="false" /><b class="con-sit__seat-name">{{ nameOfColor(color) }}</b>
              </span>
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel, ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';
import {PARLIAMENT_MAX_POPULAR_SUPPORT, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import {conLogicalPx} from '@/client/console/consoleLayoutProfile';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentPlayerName, ParliamentViewVm, resolutionTitleOf} from '@/client/console/parliament/consoleParliamentModel';
import {quietRewardPoseOf, SittingPosition, SittingStage} from '@/client/console/parliament/consoleSittingFlow';
import ConsoleColonyLedger from '@/client/components/console/parliament/ConsoleColonyLedger.vue';
import {ColonyLedgerReading} from '@/client/console/parliament/colonyLedgerModel';
import {parliamentRewardState, rewardLanded} from '@/client/console/parliament/parliamentRewardBeat';
import {sittingMotion} from '@/client/console/parliament/sittingDirector';
import {playBodyFold, playZoneLayerEnter} from '@/client/console/parliament/parliamentStageMotion';
import {ResultsPayoutPart, ResultsReading, resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';
import {worldParameterUnit} from '@/client/console/parliament/worldMoveModel';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export default defineComponent({
  name: 'ConsoleParliamentSitting',
  components: {PlayerCube, ConsoleColonyLedger, ConsoleYieldUnit},
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
    /** The step holds the FIELD (a hosted step stands in its zone, or the colony ledger reads there). */
    field: {type: Boolean, default: false},
    /** A hosted step may teleport INTO the zone right now (`consoleSittingFlow.sittingFieldOf`): the ledger layer yields to it. */
    stepOpen: {type: Boolean, default: false},
    /** THE COLONY LEDGER the enacted resolution pays (Colonial Affairs) — undefined for every other resolution. */
    ledger: {type: Object as PropType<ColonyLedgerReading | undefined>, default: undefined},
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
    /** Any of the planet's moves was made with nobody credited — the line says so ONCE, not per move. */
    planetUnrewarded(): boolean {
      return (this.results?.planet ?? []).some((move) => move.unrewarded && move.skipped === undefined && move.steps !== 0);
    },
    resolution(): IClientResolution | undefined {
      const id = this.shownSummary?.enacted.resolution;
      return id === undefined ? undefined : getResolution(id);
    },
    shownSummary(): ParliamentPhaseSummaryModel | undefined {
      return this.mode === 'review' ? this.summary : this.model?.phase?.summary ?? this.summary;
    },
    /**
     * ПАНЕЛЬ ИТОГОВ — the pure reading (`parliamentResultsModel.ts`): a payout row per seat, and the
     * table. The SEAT ORDER is the parliament model's own — the same one the seats zone in the head line
     * already shows, so the panel has one visible ordering key and no other. The SUPPORT is the LIVE
     * stock (`view.parties`), read after the deal — never the summary's own total, which the deal has
     * since turned into votes on the fresh cards.
     */
    results(): ResultsReading | undefined {
      const summary = this.shownSummary;
      if (summary === undefined) {
        return undefined;
      }
      const quiet = quietRewardPoseOf(this.resolution);
      return resultsReadingOf(
        summary,
        // The LIVE participating seats, after the lobby step: the payout order AND what each of them will
        // have to vote with when the next generation opens.
        (this.model?.players ?? []).filter((p) => p.participates)
          .map((p) => ({player: p.color, lobby: p.lobby, reserve: p.reserve})),
        this.view.parties.map((party) => ({party: party.party, support: party.support})),
        quiet === undefined ? {} : {quiet: {kicker: quiet.kicker, kind: quiet.kind}},
      );
    },
    /** The places one party's support row reserves — the plaques' own count, so the two read as one vocabulary. */
    supportPlaces(): number {
      return PARLIAMENT_MAX_POPULAR_SUPPORT;
    },
    /** THE ROW NOW PAYING — the director marks the tile whose chips are in the air (one row, never a blink). */
    activeColony(): string | undefined {
      return sittingMotion.colonyRow === '' ? undefined : sittingMotion.colonyRow;
    },
    /**
     * THE TILES WHOSE PAYOUT HAS LANDED — a row reads «получено» on its chips' TOUCHDOWN, never on the
     * record's arrival (the counter and the row turn together). A record without a rail wave (a card
     * resource laid out in the hosted step, a Pluto pair) counts as landed once it is recorded.
     */
    landedColonies(): ReadonlySet<string> {
      void parliamentRewardState.landed.length;
      void parliamentRewardState.owed.length;
      void parliamentRewardState.flying.length;
      const out = new Set<string>();
      for (const outcome of this.model?.phase?.outcomes ?? []) {
        if (outcome.player === this.viewerColor && outcome.colony !== undefined && outcome.kind !== 'reaction' && rewardLanded(outcome)) {
          out.add(outcome.colony);
        }
      }
      return out;
    },
  },
  methods: {
    cubePx(logical: number): number {
      return conLogicalPx(logical);
    },
    /** The ledger layer comes back under a step that has left — the drawer phrase, on the zone's own layer. */
    onLedgerEnter(el: Element, done: () => void): void {
      playZoneLayerEnter(el as HTMLElement, done);
    },
    /** …and yields to a step that is opening: pushed shut downward while the step's surface paints beside it. */
    onLedgerLeave(el: Element, done: () => void): void {
      playBodyFold(el as HTMLElement, undefined, done);
    },
    onLedgerCancelled(el: Element): void {
      (el as HTMLElement).style.opacity = '';
      (el as HTMLElement).style.transform = '';
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
    /** The first part of its tile among a seat's parts — the one that carries the tile's name (the panel groups by tile). */
    colonyLeads(parts: ReadonlyArray<ResultsPayoutPart>, part: ResultsPayoutPart): boolean {
      const index = parts.indexOf(part);
      return index <= 0 || parts[index - 1].colony !== part.colony;
    },
    /** The parameter's own icon — the game's vocabulary, the same sprite the status strip prints. */
    worldUnitClass(parameter: ParameterMoveId): string {
      switch (parameter) {
      case 'oxygen': return 'wgt-icon wgt-icon--oxygen';
      case 'oceans': return 'wgt-icon wgt-icon--ocean';
      case 'venus': return 'wgt-icon wgt-icon--venus';
      case 'temperature': return 'wgt-icon wgt-icon--temperature';
      }
    },
    worldSuffix(parameter: ParameterMoveId): string {
      return worldParameterUnit(parameter);
    },
    planetClass(colony: string): string {
      return colony.replace(' ', '-') + '-background';
    },
    signedAmount(amount: number | undefined): string {
      const n = amount ?? 0;
      return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
    },
    /** The net's unit — a standard resource's stock sprite (a budget nets M€). */
    netUnitClass(unit: string): string {
      return iconClassFor(unit);
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
    /** The icons of a part of SEVERAL kinds — one per kind, in the declared order. */
    partUnitClasses(part: ResultsPayoutPart): Array<string> {
      return (part.units ?? []).map((unit) => iconClassFor(cardResourceKey(unit)));
    },
    /** One recipient's own kind (a card-resource share). */
    cardResourceClass(resource: string): string {
      return iconClassFor(cardResourceKey(resource));
    },
  },
});
</script>
