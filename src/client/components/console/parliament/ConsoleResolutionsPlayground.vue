<template>
  <!--
    REDUX RESOLUTIONS — the playground stand («Полигон» → «Витрина резолюций
    Redux»). One instrument for THIS resolution and every one after it: the
    catalog as it ships (the client manifest — nothing hand-drawn here), the
    face at the three sizes the game uses and in the REAL fullscreen viewer,
    the influence-scaled payout under a chosen CONTEXT for a chosen TEST
    PLAYER, every seat's own payout side by side, and the SHARED recipient
    picker with a resolution source. Every number on this screen comes from
    the same model the game uses (`influenceYieldModel` → the common
    `scaledAmount`); every face is the same `PremiumCard`.

    SCENARIOS make a reading reproducible: each one sets the whole instrument
    (who looks, both seats' Agenda positions and card bonuses, the winner, the
    context, «no eligible card») — influence 0 / 1 / several, the winner's
    Agenda step counted before the enactment, influence beyond the track, a
    forfeited payout, a recorded payout, a spectator. The pad then moves any
    one parameter from there, and the chip says the scenario was modified.

    A resolution whose effect COUNTS the tableau (Architecture Award: «+1 M€
    production per Building card with a non-negative VP icon + influence, max
    5») gets its own scenario family: each seat holds a synthetic tableau of
    REAL card definitions, counted by the SHARED predicate the server uses
    (every card shows its verdict — counted, or why not), and the family walks
    zero / influence only / cards only / below, at and over the cap / seats
    with different results / the winner's Agenda step / the recorded result /
    the chairman quest at 0, 1 and 2 of 2.

    Test data only: a synthetic parliament model for two seats, synthetic
    candidate cards for the picker. Nothing here touches a game.

    Pad: ◀ ▶ the catalog cursor · X the fullscreen viewer · RT the next
    scenario · View the test player · A influence +1 (wraps) · Y the context ·
    L3 the winner · LT the picker's cursor · LB/RB the stand's sections ·
    B back. Keyboard through the same semantic map.
  -->
  <div class="con-rxpg" :class="{'con-rxpg--embedded': embedded}" data-resolutions-playground>
    <header class="con-rxpg__head">
      <div class="con-rxpg__hints">
        <span class="con-rxpg__hint"><GamepadGlyph control="dpad" />{{ $t('Resolution') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="triggerR" />{{ $t('Scenario') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="view" />{{ $t('Test player') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="confirm" />{{ $t('Influence') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="inspect" />{{ $t('Context') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="stickL" />{{ $t('Winner of the vote') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="triggerL" />{{ $t('Recipient picker') }}</span>
      </div>
    </header>

    <!-- ── 1. THE CATALOG — every resolution the client manifest carries. ── -->
    <section class="con-rxpg__section">
      <h2>{{ $t('Real resolutions') }} · {{ real.length }} <span class="con-rxpg__dim">/ {{ $t('Dummies and dev examples') }} · {{ others.length }}</span></h2>
      <div class="con-rxpg__catalog" data-rxpg-catalog>
        <div v-for="(entry, i) in catalog" :key="entry.id"
             class="con-rxpg__slot"
             :class="{'con-rxpg__slot--cursor': i === cursor, 'con-rxpg__slot--dummy': entry.code === undefined}"
             :data-rxpg-id="entry.id"
             :data-rxpg-code="entry.code ?? ''"
             @click="cursor = i">
          <div class="con-rxpg__slot-face" :data-zoom-slot="'resolution:' + entry.id">
            <PremiumCard :name="cardNameOf(entry)" :vmOverride="vmOf(entry)" inert lightweight />
          </div>
          <span class="con-rxpg__slot-name">{{ $t(entry.text.name) }}</span>
          <span class="con-rxpg__slot-meta">
            <b class="con-rxpg__code">{{ entry.code ?? '—' }}</b>
            <img class="con-rxpg__emblem" :src="emblemUrl(entry.party)" alt="" />
            <span>{{ $t(entry.party) }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ── 2. THE FACE at the three sizes the game paints it. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined">
      <h2>{{ $t('Card sizes') }} · {{ $t(selected.text.name) }} <b class="con-rxpg__code">{{ selected.code ?? '—' }}</b></h2>
      <div class="con-rxpg__sizes">
        <div class="con-rxpg__size" v-for="s in SIZES" :key="s.key" :data-rxpg-size="s.key">
          <div class="con-rxpg__size-face" :style="{zoom: s.zoom}">
            <PremiumCard :name="cardNameOf(selected)" :vmOverride="selectedVm" inert :lightweight="s.zoom < 0.7" :tier="s.zoom < 0.7 ? 'thumb' : 'full'" />
          </div>
          <span class="con-rxpg__label">{{ $t(s.label) }} · ×{{ s.zoom }}</span>
        </div>
        <!-- The inspector's columns beside the large face: the party (left),
             the resolution's own rules (right) — the same panels the
             fullscreen viewer mounts (X opens the real one), fed the same
             annotations. -->
        <div class="con-rxpg__inspect" data-rxpg-inspect>
          <ConsoleResolutionAside class="con-rxpg__aside" :party="selected.party" :parliament="undefined" :viewer="undefined" :contextKey="undefined" />
          <ConsoleCardRulesPanel class="con-rxpg__rules" embedded keepOrder :annotationsOverride="annotations" :nonce="0" />
        </div>
      </div>
    </section>

    <!-- ── 3. SCENARIO × CONTEXT × PLAYER — the influence-scaled payout. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined">
      <h2>{{ $t(family === 'counted' ? 'Result by cards and influence' : 'Influence-scaled payout') }}</h2>
      <div class="con-rxpg__scenarios" data-rxpg-scenarios>
        <span v-for="(entry, n) in scenarioList" :key="entry.s.key"
              class="con-rxpg__scenario"
              :class="{'con-rxpg__scenario--active': entry.i === scenario}"
              :data-rxpg-scenario="entry.s.key"
              @click="applyScenario(entry.i)">
          <b class="con-rxpg__scenario-n">{{ n + 1 }}</b>
          <span>{{ $t(entry.s.label) }}</span>
          <i v-if="entry.i === scenario && modified" class="con-rxpg__scenario-mod" data-rxpg-modified>{{ $t('modified') }}</i>
        </span>
      </div>
      <div class="con-rxpg__controls" data-rxpg-controls>
        <span class="con-rxpg__control"><span class="con-rxpg__ckey">{{ $t('Context') }}</span><b data-rxpg-context>{{ $t(contextLabel) }}</b></span>
        <span class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Test player') }}</span>
          <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="14" :glow="false" />
          <b :data-rxpg-player="viewerColor ?? 'spectator'">{{ $t(viewerLabel) }}</b>
        </span>
        <span v-if="viewerSeatIndex !== undefined" class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Influence') }}</span>
          <i class="con-parl__inf-icon" aria-hidden="true"></i>
          <b data-rxpg-influence>{{ viewerInfluence }}</b>
          <span class="con-rxpg__agenda" :class="{'con-rxpg__agenda--advanced': agendaAdvanced}" data-rxpg-agenda>{{ agendaLine }}</span>
        </span>
        <span class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Winner of the vote') }}</span>
          <PlayerCube v-if="winnerColor !== undefined" :color="winnerColor" :size="14" :glow="false" />
          <b :data-rxpg-winner="winnerColor ?? 'neutral'">{{ winnerLabel }}</b>
        </span>
        <span v-if="pickerEffect !== undefined" class="con-rxpg__control"><span class="con-rxpg__ckey">{{ $t('No eligible card') }}</span><b data-rxpg-norecipient>{{ noRecipient ? '✓' : '—' }}</b></span>
      </div>
      <div class="con-rxpg__yieldrow">
        <div class="con-rxpg__yieldcard">
          <PremiumCard :name="cardNameOf(selected)" :vmOverride="selectedVm" inert />
        </div>
        <div class="con-rxpg__yieldcol">
          <ConsoleInfluenceYield v-if="yields.length > 0" :yields="yields" size="hero" :note="yieldNote" :kicker="contextLabel" data-rxpg-yield />
          <p v-else class="con-rxpg__none" data-rxpg-yield-none>{{ $t('Not scaled by influence') }}</p>
          <ConsoleResolutionStatus v-if="status !== undefined" class="con-rxpg__status" :status="status" :viewerColor="viewerColor" />
          <!-- EVERY SEAT by its OWN influence — the rule «each player gets
               their own number», read through the same model per seat; the
               winner's Agenda step and the winner-only part are marked where
               the context has reached them. -->
          <div v-if="seatRows.length > 0" class="con-rxpg__seats" data-rxpg-seats>
            <span class="con-rxpg__ckey">{{ $t('For every player') }}</span>
            <div v-for="row in seatRows" :key="row.color"
                 class="con-rxpg__seat"
                 :class="{'con-rxpg__seat--viewer': row.viewer}"
                 :data-rxpg-seat="row.color">
              <PlayerCube :color="row.color" :size="12" :glow="false" />
              <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
              <i v-if="row.winner" class="con-rxpg__seat-star" aria-hidden="true"></i>
              <ConsoleInfluenceYield :yields="row.yields" :formula="false" size="compact" />
              <span v-if="row.advance !== undefined" class="con-rxpg__seat-tag con-rxpg__seat-tag--agenda" data-rxpg-seat-advance>{{ row.advance }}</span>
              <span v-if="row.winnerPart && selected.text.winner !== undefined" class="con-rxpg__seat-tag con-rxpg__seat-tag--winner" data-rxpg-seat-winner-part>{{ $t(selected.text.winner) }}</span>
            </div>
          </div>
          <!-- THE CHAIRMAN QUEST as the government block reads it: the printed
               graphic, the race per seat, the completion and the seat. -->
          <div v-if="questView !== undefined" class="con-rxpg__quest con-parl__quest" :class="{'con-parl__quest--done': questView.completedBy !== undefined}" data-rxpg-quest>
            <div class="con-parl__quest-head">
              <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
              <span v-if="questView.completedBy !== undefined" class="con-parl__quest-state" data-rxpg-quest-done>✓ {{ $t('Completed') }}</span>
            </div>
            <div class="con-parl__quest-cond">
              <PremiumMechanicsPanel v-if="!questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
              <span class="con-parl__quest-text">{{ $t(selected.text.quest) }}</span>
            </div>
            <div v-if="questView.completedBy === undefined" class="con-parl__quest-progress" data-rxpg-quest-progress>
              <span v-for="row in questView.rows" :key="row.color" class="con-parl__quest-row" :class="{'con-parl__quest-row--me': row.color === viewerColor}" :data-rxpg-quest-row="row.color">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <b class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ selected.quest.count }}</span>
              </span>
            </div>
            <div v-else class="con-parl__quest-foot">
              <span class="con-parl__quest-reward">
                <span class="con-parl__quest-reward-kicker">{{ $t('Won by') }}</span>
                <PlayerCube :color="questView.completedBy ?? 'neutral'" :size="12" :glow="false" />
                <b>{{ $t(questView.completedLabel) }}</b>
              </span>
              <span class="con-parl__chair">
                <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
                <b>{{ $t(questView.completedLabel) }}</b>
              </span>
            </div>
          </div>
          <!-- THE COUNTED TERM (a resolution that counts the tableau): every
               seat's synthetic tableau of REAL card definitions, each card with
               the SHARED predicate's verdict — the number above is these ticks. -->
          <div v-if="countEffect !== undefined" class="con-rxpg__tableaus" data-rxpg-tableaus>
            <span class="con-rxpg__ckey">{{ $t('Cards in play') }}</span>
            <div v-for="row in tableauRows" :key="row.color"
                 class="con-rxpg__tableau"
                 :class="{'con-rxpg__tableau--viewer': row.viewer}"
                 :data-rxpg-tableau="row.color">
              <span class="con-rxpg__tableau-who">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
                <PremiumVpCardGlyph class="con-rxpg__tableau-glyph" :tag="countGlyphTag" />
                <b data-rxpg-count>{{ row.count }}</b>
              </span>
              <div class="con-rxpg__tableau-cards">
                <div v-for="card in row.cards" :key="card.name"
                     class="con-rxpg__tcard"
                     :class="{'con-rxpg__tcard--counted': card.counts}"
                     :data-rxpg-card="card.name"
                     :data-rxpg-counts="card.counts ? 'true' : 'false'">
                  <div class="con-rxpg__tcard-face"><PremiumCard :name="card.name" inert lightweight /></div>
                  <span class="con-rxpg__tcard-verdict">{{ card.counts ? '✓ ' + $t('Counted') : '✕ ' + $t(card.reason) }}</span>
                </div>
                <span v-if="row.cards.length === 0" class="con-rxpg__dim">{{ $t('No cards in play') }}</span>
              </div>
            </div>
          </div>
          <div class="con-rxpg__texts">
            <p v-if="selected.text.effect !== undefined"><span class="con-rxpg__ckey">{{ $t('When enacted') }}</span> {{ $t(selected.text.effect) }}</p>
            <p v-if="selected.text.winner !== undefined" :class="{'con-rxpg__texts--winner': viewerIsWinner}"><span class="con-rxpg__ckey">{{ $t('For the winner of the vote') }}</span> {{ $t(selected.text.winner) }}</p>
            <p><span class="con-rxpg__ckey">{{ $t('Chairman quest') }}</span> {{ $t(selected.text.quest) }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 4. THE SHARED RECIPIENT PICKER with a resolution source. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined && pickerEffect !== undefined">
      <h2>{{ $t('Recipient picker') }}</h2>
      <div class="con-rxpg__picker" data-rxpg-picker>
        <ConsoleSourceDock :view="sourceView" compact>
          <template #under>
            <ConsoleInfluenceYield v-if="pickerYield !== undefined" :yields="[pickerYield]" size="compact" />
          </template>
        </ConsoleSourceDock>
        <div class="con-rxpg__picker-body">
          <p v-if="pickerSkip !== undefined" class="con-rxpg__skip" data-rxpg-skip>✕ {{ $t(pickerSkip) }}</p>
          <ConsolePlayedTargetStep v-else-if="targetModel !== undefined"
                                   :model="targetModel"
                                   :layout="targetLayout"
                                   :focus="targetFocus"
                                   :selection="{mode: 'single'}"
                                   :bandHeight="pickerBandHeight"
                                   :lockedCard="lockedCard" />
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PartyName} from '@/common/turmoil/PartyName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {fixedYield, InfluenceScaledEffect, InfluenceYield, referenceYield, scaledAmount, uncappedAmount} from '@/common/parliament/influenceScaling';
import {cardCountVerdict, CardCountContext, countCardsToward, ResolutionCountModel} from '@/common/parliament/resolutionCounts';
import {Tag} from '@/common/cards/Tag';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import PremiumVpCardGlyph from '@/client/components/premiumCard/PremiumVpCardGlyph.vue';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {AGENDA_TRACK, influenceAtAgenda, ReduxParty, resolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {getCard} from '@/client/cards/ClientCardManifest';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsoleResolutionStatus from '@/client/components/console/parliament/ConsoleResolutionStatus.vue';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleSourceDock from '@/client/components/console/ConsoleSourceDock.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {resolutionStatusOf, ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {
  enactedYieldsOf, noRecipientForecastKey, noRecipientReasonKey, resolvingYieldOf, voteYieldsOf, yieldCountPresentation,
} from '@/client/console/parliament/influenceYieldModel';
import {choiceSourceView, PromptSourceView} from '@/client/console/promptSource';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {stepIndex} from '@/client/console/consoleRouter';

/** The contexts a surface computes a yield for, in the order Y cycles them. */
type PgContext = 'reference' | 'proposal' | 'resolving' | 'applied';
const CONTEXTS: ReadonlyArray<PgContext> = ['reference', 'proposal', 'resolving', 'applied'];
const CONTEXT_LABEL: Readonly<Record<PgContext, string>> = {
  reference: 'Reference', proposal: 'Proposal', resolving: 'Enactment', applied: 'Applied',
};

/** The two test seats; a third viewer index is the spectator (no seat at all). */
type SeatIndex = 0 | 1;
const SEATS: ReadonlyArray<SeatIndex> = [0, 1];
const TEST_PLAYERS: Readonly<Record<SeatIndex, {color: Color, label: string}>> = {
  0: {color: 'blue' as Color, label: 'Test player A'},
  1: {color: 'red' as Color, label: 'Test player B'},
};
type ViewerIndex = SeatIndex | 2;
const SPECTATOR: ViewerIndex = 2;

/**
 * A seat's standing BEFORE the political phase: its Agenda position, the
 * influence it holds beyond the track, and — for a resolution that counts the
 * tableau — its cards in play (REAL card names) and its production before.
 */
type PgSeat = {agenda: number, bonus: number, cards?: ReadonlyArray<CardName>, production?: number};
type PgWinner = SeatIndex | 'neutral';
/** Which family of scenarios a resolution reads: influence alone, or a counted term + influence. */
type PgFamily = 'influence' | 'counted';

/** A reproducible reading: the whole instrument at once. */
type PgScenario = {
  key: string,
  label: string,
  family: PgFamily,
  viewer: ViewerIndex,
  seats: readonly [PgSeat, PgSeat],
  winner: PgWinner,
  context: PgContext,
  noRecipient: boolean,
  /** The chairman quest's race: each seat's progress and who completed it. */
  quest?: {progress: readonly [number, number], completedBy?: SeatIndex},
};

/*
 * THE COUNTED FAMILY's tableaus — real cards of the base game and Corporate
 * Era, chosen for what the shared predicate must tell apart: a positive fixed
 * icon, a variable icon scoring 0 now, a building card WITHOUT an icon, a
 * negative icon, and an icon without a building tag.
 */
const LAKE = CardName.ARTIFICIAL_LAKE; // building, +1 VP
const CRATER = CardName.DOMED_CRATER; // city + building, +1 VP
const ELEVATOR = CardName.SPACE_ELEVATOR; // space + building, +2 VP
const PHYSICS = CardName.PHYSICS_COMPLEX; // science + building, 2 VP per science resource (0 now)
const CAPITAL = CardName.CAPITAL; // city + building, 1 VP per adjacent ocean
const MINE = CardName.MINE; // building, no VP icon
const COMBUSTORS = CardName.BIOMASS_COMBUSTORS; // power + building, −1 VP
const STRONGHOLD = CardName.CORPORATE_STRONGHOLD; // city + building, −2 VP
const TUNDRA = CardName.TUNDRA_FARMING; // plant, +2 VP — no building tag

const SCENARIOS: ReadonlyArray<PgScenario> = [
  // Step 0 of the Agenda: influence 0 — the step asks nothing and names the skip.
  {key: 'influence-0', family: 'influence', label: 'Influence 0 — nothing is paid', viewer: 0, seats: [{agenda: 0, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'influence-1', family: 'influence', label: 'Influence 1', viewer: 0, seats: [{agenda: 1, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'influence-3', family: 'influence', label: 'Influence 3 — several animals', viewer: 0, seats: [{agenda: 5, bonus: 0}, {agenda: 1, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect.
  {key: 'winner-agenda', family: 'influence', label: 'The winner advances on the Agenda first', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false},
  {key: 'beyond-track', family: 'influence', label: 'Influence beyond the track', viewer: 0, seats: [{agenda: 4, bonus: 1}, {agenda: 3, bonus: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'no-recipient', family: 'influence', label: 'No eligible card', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: true},
  {key: 'applied', family: 'influence', label: 'Recorded payout', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 0, bonus: 0}], winner: 0, context: 'applied', noRecipient: false},
  {key: 'spectator', family: 'influence', label: 'Spectator — the formula alone', viewer: SPECTATOR, seats: [{agenda: 5, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false},
  // ── THE COUNTED FAMILY (min(cap, B + I)) ──
  {key: 'counted-zero', family: 'counted', label: 'No qualifying cards and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [MINE, COMBUSTORS, TUNDRA], production: 2}, {agenda: 3, bonus: 0, cards: [LAKE], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'counted-influence-only', family: 'counted', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [MINE, STRONGHOLD], production: 3}, {agenda: 1, bonus: 0, cards: [CRATER], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-cards-only', family: 'counted', label: 'Cards alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [LAKE, PHYSICS, MINE], production: 1}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-below-cap', family: 'counted', label: 'Below the maximum', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, COMBUSTORS], production: 4}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-exact-cap', family: 'counted', label: 'Exactly +5', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, ELEVATOR, TUNDRA], production: 6}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-over-cap', family: 'counted', label: 'Over the maximum', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cards: [LAKE, CRATER, ELEVATOR, PHYSICS, STRONGHOLD], production: 10}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-seats', family: 'counted', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, cards: [LAKE, MINE], production: 3}, {agenda: 8, bonus: 0, cards: [CRATER, ELEVATOR, CAPITAL, COMBUSTORS], production: -2}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 2 + 2 → 4 becomes 2 + 3 → 5.
  {key: 'counted-winner-agenda', family: 'counted', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, cards: [LAKE, PHYSICS], production: 5}, {agenda: 3, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'counted-applied', family: 'counted', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, MINE], production: 8}, {agenda: 0, bonus: 0, cards: [STRONGHOLD], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'counted-quest-0', family: 'counted', label: 'Chairman quest 0/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'counted-quest-1', family: 'counted', label: 'Chairman quest 1/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0]}},
  {key: 'counted-quest-done', family: 'counted', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1], completedBy: 0}},
];
/** Each family's opening scenario. */
const DEFAULT_SCENARIO_OF: Readonly<Record<PgFamily, number>> = {
  influence: SCENARIOS.findIndex((s) => s.key === 'influence-3'),
  counted: SCENARIOS.findIndex((s) => s.key === 'counted-below-cap'),
};
const DEFAULT_SCENARIO = DEFAULT_SCENARIO_OF.influence;

/** The smallest Agenda position that reads as each influence level (the track's own steps). */
const AGENDA_FOR_INFLUENCE: ReadonlyArray<number> = [0, 1, 3, 5, 8, 12];
const MAX_INFLUENCE = 5;

/** The picker's synthetic candidates: real cards that hold animals, with a stored count each. */
const DEMO_HOLDERS: ReadonlyArray<{name: CardName, resources: number, per: number}> = [
  {name: CardName.FISH, resources: 2, per: 1},
  {name: CardName.PETS, resources: 1, per: 2},
  {name: CardName.BIRDS, resources: 0, per: 1},
  {name: CardName.ECOLOGICAL_ZONE, resources: 3, per: 2},
];

const SIZES = [
  {key: 'overview', label: 'Overview size', zoom: 0.55},
  {key: 'vote', label: 'Voting size', zoom: 0.8},
  {key: 'fullscreen', label: 'Fullscreen size', zoom: 1.1},
] as const;

/** One seat's payout at the enactment: what it is owed, at which influence (and count), and why it does not land (if it does not). */
type SeatPayout = {amount: number, influence: number, skipped?: string, count?: ResolutionCountModel, uncapped?: number};

/** One card of a seat's synthetic tableau, with the shared predicate's verdict. */
type TableauCardRow = {name: CardName, counts: boolean, reason: string};
type TableauRow = {color: Color, label: string, viewer: boolean, count: number, cards: ReadonlyArray<TableauCardRow>};

type SeatRow = {
  color: Color,
  label: string,
  viewer: boolean,
  winner: boolean,
  yields: ReadonlyArray<InfluenceYield>,
  advance: string | undefined,
  /** The context has reached the winner-only part of the enactment, and this seat is the winner. */
  winnerPart: boolean,
};

function scenarioState(index: number) {
  const s = SCENARIOS[index];
  return {
    scenario: index,
    modified: false,
    viewer: s.viewer,
    seats: s.seats.map((seat): PgSeat => ({...seat, cards: seat.cards === undefined ? undefined : [...seat.cards]})),
    winner: s.winner,
    context: s.context,
    noRecipient: s.noRecipient,
  };
}

export default defineComponent({
  name: 'ConsoleResolutionsPlayground',
  components: {
    PremiumCard, GamepadGlyph, PlayerCube, ConsoleInfluenceYield, ConsoleResolutionStatus, ConsoleResolutionAside, ConsoleCardRulesPanel,
    ConsoleSourceDock, ConsolePlayedTargetStep, PremiumMechanicsPanel, PremiumVpCardGlyph,
  },
  props: {
    /** Inside the playground stand (the stand owns the chrome and the scroll). */
    embedded: {type: Boolean, default: false},
  },
  data() {
    return {
      SIZES,
      SCENARIOS,
      cursor: 0,
      ...scenarioState(DEFAULT_SCENARIO),
      pickerIndex: 0,
      lockedCard: '',
    };
  },
  computed: {
    all(): ReadonlyArray<IClientResolution> {
      return allResolutions();
    },
    real(): ReadonlyArray<IClientResolution> {
      return this.all.filter((r) => r.code !== undefined);
    },
    others(): ReadonlyArray<IClientResolution> {
      return this.all.filter((r) => r.code === undefined);
    },
    /** The real ones first (by code), then the dummies and the dev examples. */
    catalog(): ReadonlyArray<IClientResolution> {
      return [...[...this.real].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')), ...this.others];
    },
    selected(): IClientResolution | undefined {
      return this.catalog[this.cursor];
    },
    selectedVm(): PremiumCardVM | undefined {
      return this.selected === undefined ? undefined : resolutionPremiumVm(this.selected);
    },
    annotations(): ReadonlyArray<CardAnnotation> {
      return this.selected === undefined ? [] : resolutionAnnotations(this.selected.id, this.yields);
    },
    /** The scenario family the selected resolution reads (a counted term → the counted family). */
    family(): PgFamily {
      return this.countEffect !== undefined ? 'counted' : 'influence';
    },
    /** The ACTIVE family's scenarios, with their global index. */
    scenarioList(): Array<{s: PgScenario, i: number}> {
      return SCENARIOS.map((s, i) => ({s, i})).filter((entry) => entry.s.family === this.family);
    },
    /** The first scaled part that COUNTS the tableau — what the tableau rows explain. */
    countEffect(): InfluenceScaledEffect | undefined {
      return this.selected?.scaled?.find((e) => e.count !== undefined);
    },
    countGlyphTag(): Tag | undefined {
      const count = this.countEffect?.count;
      return count === undefined ? undefined : yieldCountPresentation(count.id).glyph.tag;
    },
    /** Every seat's tableau with each card's verdict (the SHARED predicate over the client card manifest). */
    tableauRows(): Array<TableauRow> {
      const effect = this.countEffect;
      if (effect?.count === undefined) {
        return [];
      }
      const id = effect.count.id;
      return SEATS.map((i) => {
        const names = this.seats[i].cards ?? [];
        const ctx = this.countContextOf(names);
        const cards: Array<TableauCardRow> = names.map((name) => {
          const card = getCard(name);
          if (card === undefined) {
            return {name, counts: false, reason: 'Unknown card'};
          }
          const verdict = cardCountVerdict(id, card, ctx);
          return verdict.counts ? {name, counts: true, reason: ''} : {name, counts: false, reason: verdict.reason};
        });
        return {
          color: TEST_PLAYERS[i].color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          count: cards.filter((c) => c.counts).length,
          cards,
        };
      });
    },
    questMechanics(): MechanicsVM {
      return buildMechanics(this.selected?.questRenderData);
    },
    /** The chairman quest's race as the scenario sets it (the counted family). */
    questView(): {rows: Array<{color: Color, value: number}>, completedBy: Color | undefined, completedLabel: string} | undefined {
      const quest = SCENARIOS[this.scenario]?.quest;
      if (quest === undefined || this.selected === undefined || this.family !== SCENARIOS[this.scenario]?.family) {
        return undefined;
      }
      const completed = quest.completedBy;
      return {
        rows: SEATS.map((i) => ({color: TEST_PLAYERS[i].color, value: quest.progress[i]})),
        completedBy: completed === undefined ? undefined : TEST_PLAYERS[completed].color,
        completedLabel: completed === undefined ? '' : TEST_PLAYERS[completed].label,
      };
    },
    contextLabel(): string {
      return CONTEXT_LABEL[this.context];
    },
    /** The first influence-scaled part paid onto a card — what the picker demonstrates. */
    pickerEffect(): InfluenceScaledEffect | undefined {
      return this.selected?.scaled?.find((e) => e.unit.kind === 'cardResource');
    },
    // ── who looks, who won ─────────────────────────────────────────────
    viewerSeatIndex(): SeatIndex | undefined {
      return this.viewer === SPECTATOR ? undefined : this.viewer as SeatIndex;
    },
    viewerColor(): Color | undefined {
      const i = this.viewerSeatIndex;
      return i === undefined ? undefined : TEST_PLAYERS[i].color;
    },
    viewerLabel(): string {
      const i = this.viewerSeatIndex;
      return i === undefined ? 'Spectator' : TEST_PLAYERS[i].label;
    },
    winnerColor(): Color | undefined {
      return this.winner === 'neutral' ? undefined : TEST_PLAYERS[this.winner].color;
    },
    winnerLabel(): string {
      return translateText(this.winner === 'neutral' ? 'Neutral' : TEST_PLAYERS[this.winner].label);
    },
    viewerIsWinner(): boolean {
      return this.viewerSeatIndex !== undefined && this.winner === this.viewerSeatIndex;
    },
    /** The context has reached the winner's Agenda step (the phase's step 1 precedes the effect). */
    pastWinnerStep(): boolean {
      return this.context === 'resolving' || this.context === 'applied';
    },
    viewerInfluence(): number {
      const i = this.viewerSeatIndex;
      return i === undefined ? 0 : this.influenceAt(i);
    },
    agendaAdvanced(): boolean {
      const i = this.viewerSeatIndex;
      return i !== undefined && this.advancedAt(i);
    },
    /** «Повестка 4» / «Повестка 4 → 5» (+ «+1 вне трека»). */
    agendaLine(): string {
      const i = this.viewerSeatIndex;
      if (i === undefined) {
        return '';
      }
      const seat = this.seats[i];
      const agenda = this.advancedAt(i) ?
        translateTextWithParams('Agenda ${0} → ${1}', [String(seat.agenda), String(this.agendaAt(i))]) :
        translateTextWithParams('Agenda ${0}', [String(seat.agenda)]);
      return seat.bonus > 0 ? agenda + ' · ' + translateTextWithParams('+${0} beyond the track', [String(seat.bonus)]) : agenda;
    },
    // ── the synthetic table ────────────────────────────────────────────
    /**
     * The parliament a real surface would receive for this context: the
     * resolution up for the vote (proposal), being enacted (the phase at its
     * effects step, the viewer asked), or enacted with the server-shaped
     * outcome record the applied readings draw from.
     */
    model(): ParliamentModel | undefined {
      const r = this.selected;
      if (r === undefined || this.context === 'reference') {
        return undefined;
      }
      const instance = resolutionInstanceId(r.id, 0);
      const base: ParliamentModel = {
        slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players: SEATS.map((i) => this.seatModel(i)),
        deckSize: 9, discardSize: 0, neutralSupply: 14, botMode: 'none',
      };
      const owner: Color | 'neutral' = this.winnerColor ?? 'neutral';
      if (this.context === 'proposal') {
        const viewer = this.viewerColor;
        return {
          ...base,
          slots: [{
            instance, resolution: r.id, party: r.party, votes: [{owner, seq: 1}, {owner, seq: 2}], totalVotes: 2,
            isWinning: true, tiePriority: 1, viewerVotes: viewer !== undefined && viewer === owner ? 2 : 0, leader: owner,
          }],
        };
      }
      const enacted = {instance, resolution: r.id, party: r.party};
      const scenarioQuest = SCENARIOS[this.scenario]?.family === this.family ? SCENARIOS[this.scenario]?.quest : undefined;
      if (scenarioQuest !== undefined) {
        const progress: Record<string, number> = {};
        SEATS.forEach((i) => {
          progress[TEST_PLAYERS[i].color] = scenarioQuest.progress[i];
        });
        const done = scenarioQuest.completedBy;
        base.quest = {definition: r.quest, source: r.id, generation: 4, progress, completedBy: done === undefined ? undefined : TEST_PLAYERS[done].color};
        if (done !== undefined) {
          base.chairman = TEST_PLAYERS[done].color;
        }
      }
      if (this.context === 'resolving') {
        const asked = this.viewerColor;
        return {
          ...base, rulingParty: r.party, enacted,
          phase: {
            generation: 3, final: false, step: 'effects', winner: {instance, player: owner},
            pending: asked === undefined ? undefined : {player: asked, key: this.pickerEffect?.id ?? 'effect', input: 'card'},
            outcomes: [],
          },
        };
      }
      const winnerSeat = this.winner === 'neutral' ? undefined : this.winner;
      return {
        ...base, rulingParty: r.party, enacted,
        lastPhase: {
          generation: 3, final: false,
          winner: {instance, resolution: r.id, party: r.party, votes: 2, player: owner},
          agenda: winnerSeat === undefined ? undefined : {player: TEST_PLAYERS[winnerSeat].color, from: this.seats[winnerSeat].agenda, to: this.agendaAt(winnerSeat)},
          outcomes: this.appliedOutcomes, support: [], enacted, refreshed: [], lobbyRefilled: [],
        },
      };
    },
    /** The record the server would keep for this enactment's scaled part — every seat's payout, or its named skip. */
    appliedOutcomes(): Array<ParliamentEnactOutcomeModel> {
      const r = this.selected;
      const out: Array<ParliamentEnactOutcomeModel> = [];
      if (r === undefined) {
        return out;
      }
      for (const effect of r.scaled ?? []) {
        if (effect.unit.kind === 'production') {
          // THE PRODUCTION RECORD the server keeps: the amount, every input
          // (B, the counted cards, I, the sum before the cap) and before → after.
          const resource = effect.unit.resource;
          for (const i of SEATS) {
            const payout = this.payoutAt(effect, i);
            if (payout === undefined) {
              continue;
            }
            const before = this.seats[i].production ?? 0;
            const common = {
              player: TEST_PLAYERS[i].color, step: effect.id, effect: effect.id, production: resource, amount: payout.amount, influence: payout.influence,
              count: payout.count?.count, counted: payout.count?.cards, uncapped: payout.uncapped,
            };
            out.push(payout.skipped === undefined ?
              {...common, kind: 'production', before, after: before + payout.amount} :
              {...common, kind: 'skipped', reason: payout.skipped});
          }
          continue;
        }
        if (effect.unit.kind !== 'cardResource') {
          continue;
        }
        for (const i of SEATS) {
          const payout = this.payoutAt(effect, i);
          if (payout === undefined) {
            continue;
          }
          const common = {player: TEST_PLAYERS[i].color, step: effect.id, effect: effect.id, resource: effect.unit.resource, amount: payout.amount, influence: payout.influence};
          out.push(payout.skipped === undefined ?
            {...common, kind: 'cardResource', card: i === 0 ? CardName.FISH : CardName.BIRDS} :
            {...common, kind: 'skipped', reason: payout.skipped});
        }
      }
      return out;
    },
    /** The viewer's readings for the chosen context — the ONE model the game reads. */
    yields(): ReadonlyArray<InfluenceYield> {
      const r = this.selected;
      if (r === undefined || (r.scaled ?? []).length === 0) {
        return [];
      }
      switch (this.context) {
      case 'reference': return (r.scaled ?? []).map(referenceYield);
      case 'proposal': return voteYieldsOf(r, this.model, this.viewerColor);
      case 'resolving': return (r.scaled ?? []).map((e) => this.resolvingReading(e, this.viewerSeatIndex));
      case 'applied': return enactedYieldsOf(r, this.model, this.viewerColor);
      }
    },
    /** The forecast's honest note (the vote surface's) — a live or recorded reading names its own skip. */
    yieldNote(): string | undefined {
      const effect = this.pickerEffect;
      return effect !== undefined && effect.unit.kind === 'cardResource' && this.noRecipient && this.context === 'proposal' && this.viewerSeatIndex !== undefined ?
        noRecipientForecastKey(effect.unit.resource) : undefined;
    },
    status(): ResolutionStatusVm | undefined {
      return this.selected === undefined ? undefined : resolutionStatusOf(this.selected.id, this.model, this.viewerColor);
    },
    seatRows(): Array<SeatRow> {
      const r = this.selected;
      if (r === undefined || (r.scaled ?? []).length === 0 || this.context === 'reference') {
        return [];
      }
      return SEATS.map((i) => {
        const color = TEST_PLAYERS[i].color;
        let yields: ReadonlyArray<InfluenceYield>;
        switch (this.context) {
        case 'proposal': yields = voteYieldsOf(r, this.model, color); break;
        case 'resolving': yields = (r.scaled ?? []).map((e) => this.resolvingReading(e, i)); break;
        default: yields = enactedYieldsOf(r, this.model, color);
        }
        return {
          color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          winner: this.winner === i,
          yields,
          advance: this.advancedAt(i) ? translateTextWithParams('Agenda ${0} → ${1}', [String(this.seats[i].agenda), String(this.agendaAt(i))]) : undefined,
          winnerPart: r.hasWinnerEffect && this.winner === i && this.pastWinnerStep,
        };
      });
    },
    // ── the picker ─────────────────────────────────────────────────────
    /** The viewer's payout at the enactment (the winner's step counted), or undefined for a spectator. */
    pickerPayout(): SeatPayout | undefined {
      const effect = this.pickerEffect;
      const i = this.viewerSeatIndex;
      return effect === undefined || i === undefined ? undefined : this.payoutAt(effect, i);
    },
    pickerYieldAmount(): number {
      return this.pickerPayout?.amount ?? 0;
    },
    /** Why the picker would never be asked (an English key) — the same reasons the enactment records. */
    pickerSkip(): string | undefined {
      if (this.viewerSeatIndex === undefined) {
        return 'A spectator receives nothing';
      }
      return this.pickerPayout?.skipped;
    },
    pickerYield(): InfluenceYield | undefined {
      const effect = this.pickerEffect;
      return effect === undefined ? undefined : this.resolvingReading(effect, this.viewerSeatIndex);
    },
    sourceView(): PromptSourceView {
      return choiceSourceView({kind: 'resolution', resolution: this.selected?.id}) ?? {kindKey: 'Resolution', inspectable: false};
    },
    resourceIcon(): string {
      const effect = this.pickerEffect;
      return effect !== undefined && effect.unit.kind === 'cardResource' ? String(effect.unit.resource).toLowerCase().replace(/\s+/g, '-') : 'animal';
    },
    /** The SelectCard the server would send: candidates with live counts, the amount, the per-card VP reading. */
    selectModel(): SelectCardModel {
      const amount = this.pickerYieldAmount;
      const cards = DEMO_HOLDERS.map((h) => ({name: h.name, resources: h.resources} as CardModel));
      const vpBox: Partial<Record<CardName, {from: number, to: number}>> = {};
      for (const h of DEMO_HOLDERS) {
        vpBox[h.name] = {from: Math.floor(h.resources / h.per), to: Math.floor((h.resources + amount) / h.per)};
      }
      // The server's own ask for an animal payout (AquiferContest's title), numbered by the payout.
      const effect = this.pickerEffect;
      const title: Message | string = effect?.unit.kind === 'cardResource' && effect.unit.resource === CardResource.ANIMAL ?
        {message: 'Add ${0} animal(s) to one of your cards', data: [{type: LogMessageDataType.RAW_STRING, value: String(amount)}]} :
        translateText('Add resource to this card');
      return {
        type: 'card', title, buttonLabel: 'Add', cards, max: 1, min: 1,
        showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
        resourceGainPrompt: {amount, cardResource: this.resourceIcon, vpBox},
        choiceContext: {source: {kind: 'resolution', resolution: this.selected?.id}, mode: 'reward'},
      } as SelectCardModel;
    },
    targetModel(): PlayedTargetModel | undefined {
      const color = this.viewerColor;
      if (this.pickerEffect === undefined || color === undefined) {
        return undefined;
      }
      const input = this.selectModel;
      const amount = input.resourceGainPrompt?.amount;
      return buildPlayedTargetModel({
        candidates: input.cards,
        players: [{name: translateText(this.viewerLabel), color, tableau: input.cards}],
        viewerColor: color,
        ask: typeof input.title === 'string' ? translateText(input.title) : translateMessage(input.title),
        direction: 'add',
        typeOf: (name) => getCard(name)?.type,
        preview: (name) => playedTargetPreviewFor(undefined, input, name),
        resourceContext: (_name, model) => playedTargetResourceFor(amount, input.resourceGainPrompt?.cardResource, model),
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetModel?.owners ?? [],
        availW: 960 * conUiScale(),
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    targetFocus(): PlayedTargetFocus {
      return {ownerId: this.viewerColor ?? '', index: this.pickerIndex};
    },
    pickerBandHeight(): number {
      return Math.round(420 * conUiScale());
    },
  },
  watch: {
    /** Paging to a resolution of the OTHER family opens that family's own opening scenario. */
    family(next: PgFamily): void {
      if (SCENARIOS[this.scenario]?.family !== next) {
        this.applyScenario(DEFAULT_SCENARIO_OF[next]);
      }
    },
  },
  methods: {
    vmOf(entry: IClientResolution): PremiumCardVM {
      return resolutionPremiumVm(entry);
    },
    /** The face's key — a resolution id never collides with a CardName (the premium face's own convention). */
    cardNameOf(entry: IClientResolution): CardName {
      return entry.id as CardName;
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    // ── the seats ──────────────────────────────────────────────────────
    /** Did this seat's marker take the winner's step in this context? */
    advancedAt(i: SeatIndex): boolean {
      return this.winner === i && this.pastWinnerStep && this.seats[i].agenda < AGENDA_TRACK.length;
    },
    agendaAt(i: SeatIndex): number {
      const agenda = this.seats[i].agenda;
      return this.advancedAt(i) ? Math.min(AGENDA_TRACK.length, agenda + 1) : agenda;
    },
    /** The seat's influence as the context reads it (the track position + what it holds beyond the track). */
    influenceAt(i: SeatIndex): number {
      return influenceAtAgenda(this.agendaAt(i)) + this.seats[i].bonus;
    },
    seatModel(i: SeatIndex): ParliamentPlayerModel {
      const model: ParliamentPlayerModel = {
        color: TEST_PLAYERS[i].color, participates: true, lobby: true, reserve: 5, onResolutions: this.winner === i ? 2 : 0, chairman: false,
        agenda: this.agendaAt(i), influence: this.influenceAt(i), access: [], partyActionUses: {}, resolutionActionUses: 0,
      };
      // The seat's COUNTS, the way the server model carries them — through the shared predicate.
      const count = this.countAt(i);
      if (count !== undefined) {
        model.counts = [count];
      }
      return model;
    },
    /** The owner's side of the tag-activity rule for a synthetic tableau (Odyssey keeps events face up). */
    countContextOf(names: ReadonlyArray<CardName>): CardCountContext {
      return {eventTagsInPlay: names.includes(CardName.ODYSSEY)};
    },
    /** Seat `i`'s count for the selected resolution's counted term (undefined when nothing is counted). */
    countAt(i: SeatIndex): ResolutionCountModel | undefined {
      const effect = this.countEffect;
      if (effect?.count === undefined) {
        return undefined;
      }
      const names = this.seats[i].cards ?? [];
      const cards = names.map((name) => getCard(name)).filter((card): card is NonNullable<typeof card> => card !== undefined);
      return countCardsToward(effect.count.id, cards, this.countContextOf(names));
    },
    /**
     * What `effect` pays seat `i` AT THE ENACTMENT — the winner's Agenda step
     * already taken (whatever the context shows) — through the ONE formula,
     * with the enactment's own skip reasons: nothing owed, or no card of the
     * test player's that can hold the resource.
     */
    payoutAt(effect: InfluenceScaledEffect, i: SeatIndex): SeatPayout | undefined {
      if (effect.recipient === 'winner' && this.winner !== i) {
        return undefined;
      }
      const seat = this.seats[i];
      const agenda = this.winner === i ? Math.min(AGENDA_TRACK.length, seat.agenda + 1) : seat.agenda;
      const influence = influenceAtAgenda(agenda) + seat.bonus;
      if (effect.count !== undefined) {
        // A COUNTED term: the seat's own count through the shared predicate, then the ONE formula.
        const count = this.countAt(i);
        const counted = count?.count ?? 0;
        const amount = scaledAmount(effect, influence, counted);
        const uncapped = uncappedAmount(effect, influence, counted);
        return amount <= 0 ?
          {amount: 0, influence, count, uncapped, skipped: 'No qualifying cards and no influence'} :
          {amount, influence, count, uncapped};
      }
      const amount = scaledAmount(effect, influence);
      if (amount <= 0) {
        return {amount: 0, influence, skipped: 'No influence'};
      }
      if (effect.unit.kind === 'cardResource' && this.noRecipient && this.viewerSeatIndex === i) {
        return {amount, influence, skipped: noRecipientReasonKey(effect.unit.resource)};
      }
      return {amount, influence};
    },
    /** A live payout's reading for seat `i` (the server's amount, its skip named), the formula without a seat. */
    resolvingReading(effect: InfluenceScaledEffect, i: SeatIndex | undefined): InfluenceYield {
      const payout = i === undefined ? undefined : this.payoutAt(effect, i);
      if (i === undefined || payout === undefined) {
        return referenceYield(effect);
      }
      const reading = payout.count !== undefined ?
        fixedYield(effect, 'resolving', payout.amount, payout.influence, {count: payout.count.count, counted: payout.count.cards, uncapped: payout.uncapped}) :
        resolvingYieldOf(effect, payout.amount, this.model, TEST_PLAYERS[i].color);
      return payout.skipped === undefined ? reading : {...reading, skipped: payout.skipped};
    },
    // ── the pad ────────────────────────────────────────────────────────
    applyScenario(index: number): void {
      Object.assign(this, scenarioState(index));
      this.pickerIndex = 0;
      this.lockedCard = '';
    },
    /** A: the test player's influence +1 (wraps), set by the Agenda position that reads as it. */
    bumpInfluence(): void {
      const i = this.viewerSeatIndex;
      if (i === undefined) {
        return;
      }
      const seat = this.seats[i];
      const next = (influenceAtAgenda(seat.agenda) + seat.bonus + 1) % (MAX_INFLUENCE + 1);
      // Only the influence moves: the seat keeps its tableau and its production.
      this.seats = this.seats.map((s, k) => k === i ? {...s, agenda: AGENDA_FOR_INFLUENCE[next], bonus: 0} : s);
      this.modified = true;
    },
    /** X: the REAL fullscreen viewer over the catalog, reading this stand's table and test player. */
    openFullscreen(): void {
      if (this.catalog.length === 0) {
        return;
      }
      openConsoleCardZoom(this.catalog.map((r) => resolutionZoomEntry(r.id)), this.cursor, undefined, undefined, {
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement | undefined,
          (index) => 'resolution:' + (this.catalog[index]?.id ?? ''),
          (index) => {
            this.cursor = index;
          }),
        parliament: {model: () => this.model, viewer: () => this.viewerColor},
      });
    },
    /** The stand forwards every intent here first; `false` hands it back (scroll, sections, B). */
    handleIntent(intent: GamepadIntent): boolean {
      if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
        this.cursor = stepIndex(this.cursor, intent.dir === 'right' ? 1 : -1, this.catalog.length);
        this.pickerIndex = 0;
        this.lockedCard = '';
        return true;
      }
      if (intent.kind !== 'press') {
        return false;
      }
      if (intent.button === 'stickL') {
        this.winner = this.winner === 'neutral' ? 0 : this.winner === 0 ? 1 : 'neutral';
        this.modified = true;
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'inspect':
        this.openFullscreen();
        return true;
      case 'nextTab': {
        const list = this.scenarioList;
        const at = list.findIndex((entry) => entry.i === this.scenario);
        this.applyScenario(list[(at + 1) % list.length].i);
        return true;
      }
      case 'reset':
        this.viewer = ((this.viewer + 1) % 3) as ViewerIndex;
        this.pickerIndex = 0;
        this.lockedCard = '';
        this.modified = true;
        return true;
      case 'primary':
        this.bumpInfluence();
        return true;
      case 'fullscreen':
        this.context = CONTEXTS[(CONTEXTS.indexOf(this.context) + 1) % CONTEXTS.length];
        return true;
      case 'prevTab': {
        const count = this.targetModel?.owners[0]?.candidates.length ?? 0;
        if (count > 0) {
          this.pickerIndex = (this.pickerIndex + 1) % count;
          this.lockedCard = this.targetModel?.owners[0]?.candidates[this.pickerIndex]?.cardName ?? '';
        }
        return true;
      }
      default:
        return false;
      }
    },
  },
});
</script>
