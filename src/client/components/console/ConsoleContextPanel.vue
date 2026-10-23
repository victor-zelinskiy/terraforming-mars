<template>
  <aside class="con-inspector con-context con-info__scroll"
         ref="root"
         :class="{'con-inspector--more': moreBelow, 'con-inspector--scrolled': scrolledDown}"
         :aria-label="$t('Cell details')"
         @scroll.passive="measureScroll">
    <!-- ── TASK MODE: active placement — the tactical dossier ─────────
         Reading order is the architecture: WHAT lands (identity) → the
         focused CELL's state → the cell's own toll → the immediate result →
         standing progress → endgame → field rules. The panel carries NO
         command rows and no controller prompts — every verb lives in the ONE
         bottom command bar (P21; the old in-panel «A Разместить здесь» CTA
         and the L3 hint duplicated it and are gone). -->
    <template v-if="mode === 'placement'">
      <header class="con-context__id">
        <!-- The kicker names the TASK, and the host supplies it — a cell pick
             is not always a tile pick (a claim / a camp move puts a MARKER
             down). Kept small: it is context, the OBJECT below is the voice. -->
        <div class="con-context__eyebrow">
          <div class="con-context__task-kicker">{{ $t(placementKickerKey) }}</div>
          <!-- P20: the inspect-all toggle announces itself as a distinct mode. -->
          <div v-if="inspectAll" class="con-context__mode-chip">{{ $t('Inspecting all cells') }}</div>
          <!-- THE FINALE's STAGE (PL-304): where the context stands — the pick, a landing, another seat's
               answer. A pill, not a title: the kicker and the object stay the panel's voice. -->
          <div v-else-if="finale !== undefined" class="con-context__finale-stage"
               :class="'con-context__finale-stage--' + finale.stage" :data-finale-stage="finale.stage">
            <span class="con-context__finale-stage-dot" aria-hidden="true"></span>{{ $t(finaleStageKey) }}
          </div>
        </div>
        <!-- THE PLAY PLATE (T15 · CD): a STAGED pick carries its card onto the board — ONE row at the chip's height: the
             art, the name, the price the one POST charges. ABOVE the identity, never in its place (the title is the
             TILE); no controller prompt (the verbs are the bar's); gone with the commit. -->
        <div v-if="stagedPlate !== undefined" class="con-context__staged" data-staged-plate :data-staged-flow="stagedPlate.flow">
          <span class="con-context__staged-art" :style="stagedArtStyle" aria-hidden="true"></span>
          <span class="con-context__staged-name" data-staged-card>{{ $t(stagedPlate.card) }}</span>
          <span v-if="stagedPlate.price !== undefined" class="con-context__staged-price" data-staged-price>
            <span class="con-context__f-ico" :class="stagedPriceIconClass" aria-hidden="true"></span>
            <b>{{ stagedPlate.price.amount }}</b>
          </span>
        </div>
        <!-- WHAT LANDS — the real tile art + its name, never the server's
             whole sentence (placementDossier owns the naming law). -->
        <div class="con-context__head">
          <span v-if="swatchClass !== undefined" class="con-context__tile" aria-hidden="true">
            <span class="con-context__tile-art" :class="swatchClass"></span>
          </span>
          <h2 class="con-context__title"
              :class="identity.tier === 'base' ? undefined : 'con-context__title--' + identity.tier">{{ identity.title }}</h2>
        </div>
        <div v-if="identity.special" class="con-context__qualifier">{{ $t('Special tile') }}</div>
        <!-- The exchange behind a conversion placement — `8 🌱 → 1 [tile]` —
             structural (convert plants), never parsed from the title. -->
        <div v-if="conversion !== undefined" class="con-context__formula">
          <span class="con-context__f-num">{{ conversion.amount }}</span>
          <span class="con-context__f-ico" :class="conversionIconClass" aria-hidden="true"></span>
          <span class="con-context__f-arrow" aria-hidden="true">→</span>
          <span class="con-context__f-num con-context__f-num--res">1</span>
          <span v-if="swatchClass !== undefined" class="con-context__f-tile" aria-hidden="true">
            <span class="con-context__tile-art" :class="swatchClass"></span>
          </span>
          <!-- What one final greenery is WORTH under the table's rules (classic VP / Redux TR) — the formula's tail. -->
          <span v-if="finale !== undefined" class="con-context__f-yield" data-finale-yield>{{ $t(finale.yieldKey) }}</span>
        </div>
        <!-- The demoted server sentence — only when it adds a real constraint. -->
        <div v-else-if="identity.actionLine !== ''" class="con-context__action-line">{{ identity.actionLine }}</div>
        <!-- THE PLAN LINE — the SAME action's later placements («Затем ещё
             одно размещение: Океан», the two-ocean cards). CONSTANT for the
             whole prompt (it reads the prompt, never the focused cell), so it
             renders once and never moves while the player points — and the
             player picks the FIRST cell with the second already in mind. -->
        <div v-if="followUpLine !== ''" class="con-context__next">
          <span class="con-context__next-mark" aria-hidden="true">▸▸</span>{{ followUpLine }}
        </div>
        <!-- WHO asked — one quiet line of metadata (`.con-src` chip). The
             inspect verb lives in the command bar (L3), not here. -->
        <console-source-dock v-if="sourceView !== undefined && stagedPlate === undefined" :view="sourceView" chip ref="sourceChip" />
      </header>

      <!-- ── THE FINALE's own block (the final greenery is played ON THE BOARD — PL-295). Constant for the whole pick:
           it reads the STOCK, never the focused cell, so it never moves while the player points. The plant stock
           as OBJECTS — one greenery hex per tile it still pays for (the board's own art), the rest as a hex
           filled have / need — and what finishing now leaves unused. No controller prompt here: the finish is
           the bar's RT hold. -->
      <section v-if="finale !== undefined" class="con-context__finale" :class="'con-context__finale--' + finale.stage"
               data-finale-bank :data-finale-stage="finale.stage">
        <!-- THE STAGE LINE — only when the board is NOT the thing to read: another seat's answer is awaited (who),
             or a greenery is landing and the next pick follows by itself. In the pick stage the cell row below
             says everything, so this line does not exist. -->
        <div v-if="finale.stage === 'wait'" class="con-context__finale-wait" data-finale-wait>
          <!-- ONE dot: the awaited seat's own colour, pulsing; the bare cyan pulse only until the poll names a seat. -->
          <span v-if="finale.waitingOn !== undefined" class="con-context__finale-pulse con-context__finale-pulse--seat"
                :class="'player_bg_color_' + finale.waitingOn.color" aria-hidden="true"></span>
          <span v-else class="con-context__finale-pulse" aria-hidden="true"></span>
          <span class="con-context__finale-wait-text">{{ finaleWaitText }}</span>
        </div>
        <div v-else-if="finale.stage === 'landing'" class="con-context__finale-wait con-context__finale-wait--landing" data-finale-landing>
          <span class="con-context__finale-pulse" aria-hidden="true"></span>
          <span class="con-context__finale-wait-text">{{ $t(LANDING_LINE) }}</span>
        </div>
        <div class="con-context__finale-head">
          <span class="con-context__finale-label">{{ $t(FINALE_BANK_LABEL) }}</span>
          <span class="con-context__finale-stock">
            <span class="con-context__f-ico" :class="plantIconClass" aria-hidden="true"></span>
            <b :key="finale.plants" class="con-context__finale-stock-num">{{ finale.plants }}</b>
          </span>
        </div>
        <!-- THE BANK — drawn to the COUNT (PL-305): the hexes take their size from how many there are and wrap into
             rows; an absurd stock is cut and the cut is stated. -->
        <TransitionGroup tag="div" name="con-finale-hex" class="con-context__finale-bank"
                         :class="'con-context__finale-bank--' + finale.bank.tier" :data-finale-tier="finale.bank.tier">
          <!-- A whole hex is keyed by its place, the rest by its kind: a landing removes the LAST whole hex (it
               leaves with a short settle) and re-fills the rest in place — never a row that re-mounts. -->
          <span v-for="(slot, i) in finale.bank.slots" :key="slot.kind === 'full' ? 'full' + i : 'part'"
                class="con-context__finale-hex" :class="'con-context__finale-hex--' + slot.kind"
                :data-finale-hex="slot.kind" aria-hidden="true">
            <span v-if="slot.kind === 'full'" class="con-context__tile-art" :class="finaleTileClass"></span>
            <template v-else>
              <span class="con-context__finale-fill" :style="{'--fill': String(slot.have / slot.need)}"></span>
              <span class="con-context__finale-part">{{ slot.have }}/{{ slot.need }}</span>
            </template>
          </span>
          <span v-if="finale.bank.overflow > 0" key="more" class="con-context__finale-more">+{{ finale.bank.overflow }}</span>
        </TransitionGroup>
        <div class="con-context__finale-line">
          <span :key="finaleEnoughText" class="con-context__finale-enough">{{ finaleEnoughText }}</span>
          <span v-if="finale.freeCells !== undefined" :key="'c' + finale.freeCells" class="con-context__finale-cells" data-finale-cells>{{ finaleCellsText }}</span>
          <span v-if="finale.bank.burns > 0" :key="finaleBurnText" class="con-context__finale-burn">{{ finaleBurnText }}</span>
        </div>
        <!-- THE FINALE ORDER — every seat's place in the phase (the server's `finalGreenery.done` + the asked seat's
             own kind): the player sees they are the one placing, who is done, who still waits — the «очередь
             игроков» of the owner's concept. -->
        <div class="con-context__finale-queue" data-finale-queue>
          <span class="con-context__finale-label">{{ $t(QUEUE_LABEL) }}</span>
          <ul class="con-context__finale-seats">
            <li v-for="seat in finale.queue" :key="seat.color"
                class="con-context__finale-seat" :class="{['con-context__finale-seat--' + seat.state]: true, 'con-context__finale-seat--you': seat.viewer}"
                :data-finale-seat="seat.state">
              <span class="con-context__finale-seat-dot" :class="'player_bg_color_' + seat.color" aria-hidden="true"></span>
              <span class="con-context__finale-seat-name">{{ seat.name }}<i v-if="seat.viewer"> · {{ $t(SEAT_YOU) }}</i></span>
              <span class="con-context__finale-seat-state">{{ $t(seatStateKey(seat.state)) }}</span>
            </li>
          </ul>
        </div>
      </section>

      <!-- ── THE FOCUSED CELL: one fixed line; the refusal expands below
           without a jump (grid-rows well), so legal ↔ illegal never shifts
           the identity above it. The LOCKED phase re-registers the same bar
           (amber, «выбрано») — a paint-only change, zero geometry.
           Inside the finale session only while the PICK is out (PL-304): a landing or another seat's answer has
           no focused cell to read, and the stage line above says so instead. -->
      <template v-if="finale === undefined || finale.stage === 'pick'">
      <div class="con-context__cell">
        <div class="con-context__cellbar"
             :class="cellbarClass">
          <span class="con-context__cell-mark" aria-hidden="true">{{ selectedLegal ? (cellLocked ? '◈' : '◆') : '✕' }}</span>
          <span class="con-context__cell-name">{{ cellHeader !== '' ? cellHeader : $t('Board cell') }}</span>
          <!-- «Без штрафа» is ONE quiet word on the cell line, not a section:
               a whole «ЭФФЕКТ КЛЕТКИ» block whose entire content was the
               absence of an effect spent a head + a row on a non-event. -->
          <span v-if="cellLocked" class="con-context__cell-tail con-context__cell-tail--locked">· {{ $t(flowPhase === 'committing' ? 'Placing' : 'Cell selected') }}</span>
          <span v-else-if="noToll" class="con-context__cell-tail">· {{ $t('No extra cost') }}</span>
        </div>
        <div class="con-context__reason-well"
             :class="{'con-context__reason-well--open': !selectedLegal}"
             aria-live="polite">
          <div class="con-context__reason">{{ illegalReason !== '' ? illegalReason : $t('Cannot place here') }}</div>
        </div>
      </div>

      <!-- ── THE CELL'S FACE (TR67): the square under the reticle at scene scale and its six neighbours, lit by the SAME
           relation tones the board draws from this preview. Constant geometry — a step swaps its data, nothing moves. -->
      <console-cell-portrait v-if="portrait !== undefined && !portraitYield" :portrait="portrait" :ring="ring" :marks="marks"
                             :aresTiles="aresTiles" class="con-context__portrait con-context__portrait--compact" />

      <!-- ── THE DOSSIER BODY — the same server facts, grouped by intent and
           COMPACTED into rows (placementDossier).
           ⚠️ NO transition group, and no height/enter/leave animation of any
           kind: this is a HUD of the cell the player is pointing at, and the
           player is pointing with the d-pad. A section that grows, collapses
           or slides on every cursor step turns the panel into the moving
           object on screen — the board stops being where the eye is. Only
           VALUES update (each is keyed on its own rendered text, so the ones
           that did not change do not even re-mount). -->
      <div class="con-context__body">
        <!-- Sections follow each other in ONE natural flow with a shared
             rhythm — a section exists only when it has rows, and the read
             order is the decision order (toll → result → the tile's standing
             mechanic → progress → endgame). Still NO animation of any kind
             on a cell change: content reflows instantly; only values flick. -->
        <!-- THE CELL'S OWN FORECAST rides the endgame head («сколько ПО стоит ЭТА клетка» — the sum of its rows, shown
             only past one scoring row). The markup is the ONE sections renderer the inspection shares (TR67). -->
        <console-dossier-sections :sections="sections" :viewerColor="viewerColor" :players="players" />
        <!-- «Ничего сверх размещения» — names WHAT lands (tile vs marker). -->
        <div v-if="emptyKey !== undefined" class="con-context__none">{{ $t(emptyKey) }}</div>
        <!-- An illegal cell has no preview — the hover facts still explain
             what stands on it (hazard identity, cleanup reward, …). They get
             a head of their own: without one they read as consequences of a
             placement that cannot happen. -->
        <section v-if="fallbackRows.length > 0" class="con-context__sec con-context__sec--cellinfo">
          <h3 class="con-context__sec-head"><span>{{ $t('Board cell') }}</span></h3>
          <console-placement-fact-row v-for="row in fallbackRows" :key="row.key" :row="row" />
        </section>
      </div>
      </template>
    </template>

    <!-- ── TRACK MODE (R3) — THE SAME CHASSIS (TR67): the head names the SCALE, the STEP has a portrait (the scale's own
         glyph, where the parameter stands now, what the step gives — large), «КОГДА» is a section of rows (the rule and
         who already took it), the scale's own description stands at the foot. The rows are the same pre-translated
         ones the band's hover shows (`scaleTooltipState` — one source). -->
    <template v-else-if="mode === 'track'">
      <header class="con-context__id">
        <div class="con-context__eyebrow">
          <div class="con-context__task-kicker con-context__task-kicker--track" :style="trackAccentStyle">{{ $t('Track bonus') }}</div>
        </div>
        <div v-if="trackScale !== null" class="con-context__head">
          <h2 class="con-context__title" data-track-title>{{ $t(trackScale.titleKey) }}</h2>
        </div>
      </header>
      <template v-if="trackInfo !== null">
        <div class="con-context__step" :style="trackAccentStyle" data-track-step>
          <span v-if="trackGlyphClass !== ''" class="con-context__step-glyph" :class="trackGlyphClass" aria-hidden="true"></span>
          <div v-if="trackScale !== null" class="con-context__step-now">
            <span class="con-context__step-cap">{{ $t('Now') }}</span>
            <b class="con-context__step-val" :key="trackScale.valueText">{{ trackScale.valueText }}</b>
          </div>
          <div class="con-context__step-gives">
            <span class="con-context__step-cap">{{ trackInfo.kicker }}</span>
            <b v-for="(row, i) in trackGives" :key="i" class="con-context__step-reward" data-track-reward>{{ row.text }}</b>
          </div>
        </div>
        <div class="con-context__body">
          <section class="con-context__sec con-context__sec--tile" data-dossier-section="track-when">
            <h3 class="con-context__sec-head"><span>{{ $t('When') }}</span></h3>
            <div class="con-dossier-row con-dossier-row--info">
              <div class="con-dossier-row__main">
                <div class="con-dossier-row__title">{{ $t('Scale bonuses are granted when the parameter passes this step') }}</div>
              </div>
            </div>
            <div v-for="(row, i) in trackClaims" :key="'c' + i" class="con-dossier-row con-dossier-row--warning" data-track-claim>
              <div class="con-dossier-row__main">
                <div class="con-dossier-row__title">
                  <span v-if="row.dot !== undefined" class="con-context__grp-dot" :style="{background: row.dot}" aria-hidden="true"></span>
                  {{ row.text }}
                </div>
              </div>
            </div>
          </section>
        </div>
      </template>
      <div v-else class="con-inspector__loading">{{ $t('Loading') }}…</div>
      <div v-if="trackScale !== null" class="con-context__foot">
        <div class="con-context__lore con-context__lore--scale" :style="trackAccentStyle">
          <div class="con-context__lore-title">{{ $t(trackScale.nounKey) }}</div>
          <div class="con-context__lore-text">{{ $t(trackScale.descriptionKey) }}</div>
        </div>
      </div>
    </template>

    <!-- ── CELL MODE: inspection — a selected cell, no task ─────────── -->
    <!-- ── CELL MODE (L3 inspection) — THE SAME DOSSIER (TR67 «КЛЕТКА — ОДНО ДОСЬЕ»): the placement's chassis, its
         type system and its rows; the head is the OBJECT the cell holds, its owner and the card that put it there; the
         portrait is the cell's face with its six neighbours (the board lights the same ones); the sections are the
         hover's facts by intent; the field's rules and the cell's lore stand at the foot. The kicker speaks the
         scanner's amber (the board's `con-cell-sel`), never the placement's cyan. -->
    <template v-else-if="mode === 'cell'">
      <header class="con-context__id con-context__id--cell">
        <div class="con-context__eyebrow">
          <div class="con-context__task-kicker con-context__task-kicker--scan">{{ $t('Board inspection') }}</div>
        </div>
        <div class="con-context__head con-context__head--cell">
          <h2 class="con-context__title" data-cell-title
              :class="cellId.tier === 'base' ? undefined : 'con-context__title--' + cellId.tier">{{ cellId.title }}</h2>
        </div>
        <div v-if="cellId.special" class="con-context__qualifier">{{ $t('Special tile') }}</div>
        <div v-if="cellId.line !== ''" class="con-context__action-line">{{ cellId.line }}</div>
        <!-- WHOSE and FROM WHAT — the owner's cube + name, the card that put the tile here (X opens its face). -->
        <div v-if="ownerName !== '' || placedBy !== undefined" class="con-context__who">
          <span v-if="ownerName !== ''" class="con-context__owner" data-cell-owner>
            <span class="con-context__owner-cube" :class="'player_bg_color_' + ownerColor" aria-hidden="true"></span>
            <span>{{ ownerName }}</span>
          </span>
          <span v-if="placedBy !== undefined" class="con-src con-src--chip con-context__placed" data-cell-source :data-cell-source-card="placedBy">
            <span class="con-src__plate">
              <span class="con-src__plate-mark" aria-hidden="true">◈</span>
              <span class="con-src__plate-kind">{{ $t('Placed by') }}</span>
              <span class="con-src__plate-sep" aria-hidden="true">·</span>
              <span class="con-src__plate-name">{{ $t(placedBy) }}</span>
            </span>
          </span>
        </div>
      </header>
      <template v-if="info !== undefined">
        <console-cell-portrait v-if="portrait !== undefined" :portrait="portrait" :ring="ring" :marks="marks"
                               :ownVp="ownVp" :aresTiles="aresTiles" class="con-context__portrait"
                               :class="{'con-context__portrait--compact': portraitTight}" />
        <div class="con-context__body">
          <console-dossier-sections :sections="cellBodySections" :viewerColor="viewerColor" :players="players" />
        </div>
      </template>
      <div v-else-if="loading" class="con-inspector__loading">{{ $t('Loading') }}…</div>
      <!-- THE FOOT — what is true of the SQUARE whatever stands on it: the field's rules, the curated lore. -->
      <div v-if="cellFootSections.length > 0 || lore !== undefined" class="con-context__foot">
        <console-dossier-sections :sections="cellFootSections" :viewerColor="viewerColor" :players="players" />
        <!-- P27b: the curated special-cell LORE (Ganymede, volcanoes…) — inspection is its home (placement stays lean). -->
        <div v-if="lore !== undefined" class="con-context__lore">
          <div v-if="loreTitle !== ''" class="con-context__lore-title">{{ $t(lore.title) }}</div>
          <div class="con-context__lore-text">{{ $t(lore.description) }}</div>
        </div>
      </div>
    </template>

    <!-- (The former IDLE mode is gone: the strategic Milestones/Awards
         summary is the dedicated right STRATEGY RAIL now — this panel is a
         TASK/INSPECTION dossier only, overlaid while one is active.) -->

    <!-- The panel scrolls with the right stick, but a couch player cannot see a
         3 px scrollbar from three metres — so the OVERFLOW announces itself: a
         fade at each cut edge (on the panel, see console.less) plus this one
         line NAMING the control. Last in the flow + sticky, so it rides the
         bottom edge, and it disappears the moment nothing is left to read. -->
    <div v-if="moreBelow" class="con-inspector__more" aria-hidden="true">
      <GamepadGlyph control="stickR" /><span>{{ $t('Scroll') }}</span>
    </div>
  </aside>
</template>

<script lang="ts">
/**
 * The right CONTEXT dossier (feedback iteration 2; P27 rework; P30: the
 * strategic idle summary moved OUT into the dedicated STRATEGY RAIL, and
 * this panel became a task-time OVERLAY — the board never reflows for it).
 * Three modes:
 *  - placement: the TACTICAL PLACEMENT DOSSIER — identity (what lands) +
 *    cell state + the server preview regrouped by intent (placementDossier);
 *  - track (P27): a focused global-parameter TRACK bonus — the SAME
 *    already-translated rows the premium ScaleTooltip shows;
 *  - cell: inspection identity (header/name/owner) + facts from the
 *    shared BoardInformation pipeline.
 * Deliberately NOT a duplicate of the bottom command bar: the panel renders
 * ZERO controller prompts — A/L3/R3/B live in the bar and only there.
 * Pure presentation: every value is a prop computed in ConsoleShell from
 * the same sources the desktop buttons use.
 */
import {defineComponent, PropType} from 'vue';
import ConsoleCellPortrait from '@/client/components/console/ConsoleCellPortrait.vue';
import ConsoleDossierSections from '@/client/components/console/ConsoleDossierSections.vue';
import ConsolePlacementFactRow from '@/client/components/console/ConsolePlacementFactRow.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardCellInfo, BoardFact, BoardPlacementPreview, CellPortrait} from '@/common/boards/BoardInformationFacts';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {PromptSourceView} from '@/client/console/promptSource';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {
  DossierRow,
  DossierSection,
  PlacementConversion,
  PlacementIdentity,
  PlacementShape,
  buildDossierRows,
  dossierEmptyKey,
  dossierSections,
  DossierChosenTarget,
  placementFollowUpLine,
  placementIdentity,
  StagedPlayPlate,
} from '@/client/console/placementDossier';
import {cardArtUrl, cardArtUrlAtTier} from '@/client/cards/cardArt';
import {
  BANK_BURNS, BANK_CELLS, BANK_ENOUGH, BANK_LABEL as FINALE_BANK_LABEL, FinalePanelModel, FinaleSeatState, LANDING_LINE,
  QUEUE_LABEL, SEAT_DONE, SEAT_PLACING, SEAT_WAITING, SEAT_YOU, STAGE_LANDING, STAGE_PICK, STAGE_WAIT, WAITING_ON,
} from '@/client/console/finalGreenery/finalGreeneryModel';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {ScaleTooltipRow} from '@/client/components/board/scaleTooltipState';
import {CellIdentity, CellMark, CellRingSlot, cellDossierSections, cellIdentity, cellMarks, cellOwnVp, cellRing} from '@/client/console/cellDossier';
import {previewFacts} from '@/client/console/placementRelations';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

export default defineComponent({
  name: 'ConsoleContextPanel',
  components: {ConsoleCellPortrait, ConsoleDossierSections, ConsolePlacementFactRow, GamepadGlyph},
  data() {
    return {
      /** Content continues below the fold — drives the fade + the stick hint. */
      moreBelow: false,
      /** Something is already scrolled past — drives the TOP fade. */
      scrolledDown: false,
      /**
       * TR67: the placement's portrait YIELDS to the decision text — a placement dossier that scrolls is a defect (the
       * dossier law), so the first cell of a prompt whose dossier would overflow with the portrait drops it for the rest
       * of THAT prompt (a one-time change, never a portrait flickering cell to cell). Reset by the next prompt.
       */
      portraitYield: false,
      /**
       * …and in the INSPECTION it steps down to the compact size instead (the portrait IS the inspection's head): the
       * first cell whose dossier would overflow (a long lore at 4K) settles the size for the rest of the inspection.
       */
      portraitTight: false,
      resizeObserver: undefined as ResizeObserver | undefined,
      FINALE_BANK_LABEL,
      LANDING_LINE,
      QUEUE_LABEL,
      SEAT_YOU,
    };
  },
  watch: {
    /** P21: a new inspected cell resets the panel scroll — the placement
     *  STATUS is always the first thing visible. */
    cellHeader() {
      this.resetScroll();
    },
    selectedLegal() {
      this.resetScroll();
    },
    /** New facts arrive asynchronously (the preview is fetched per cell), so
     *  the overflow state has to be re-measured when they land. */
    preview() {
      this.$nextTick(() => this.measureScroll());
    },
    /** A new prompt (or another mode) earns the portrait back. */
    placementPromptKey() {
      this.portraitYield = false;
      this.portraitTight = false;
      this.$nextTick(() => this.measureScroll());
    },
  },
  mounted() {
    this.measureScroll();
    const root = this.$refs.root as HTMLElement | undefined;
    if (root !== undefined && typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measureScroll());
      this.resizeObserver.observe(root);
    }
  },
  beforeUnmount() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  },
  props: {
    mode: {type: String as PropType<'placement' | 'cell' | 'track'>, required: true},
    info: {type: Object as PropType<BoardCellInfo | undefined>, default: undefined},
    /** placement mode: the focused LEGAL cell's placement consequences. */
    preview: {type: Object as PropType<BoardPlacementPreview | undefined>, default: undefined},
    loading: {type: Boolean, default: false},
    viewerColor: {type: String as PropType<Color>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    // placement mode
    /** i18n KEY for the kicker — from `consoleTaskSummary.placementKicker`,
     *  never composed here (that module is the ONE source of prompt copy). */
    placementKickerKey: {type: String, default: 'Tile placement'},
    placementTitle: {type: String, default: ''},
    /** What lands (tileType / kind / effect / source) — the identity's input. */
    placementShape: {type: Object as PropType<PlacementShape | undefined>, default: undefined},
    /** The structurally-known exchange (convert plants) — the formula line. */
    conversion: {type: Object as PropType<PlacementConversion | undefined>, default: undefined},
    /** Ares tile-art variants are active (tileCssClassOf needs the flag). */
    aresTiles: {type: Boolean, default: false},
    selectedLegal: {type: Boolean, default: false},
    illegalReason: {type: String, default: ''},
    /** The two-phase placement flow's phase — the cell bar's locked accent
     *  (paint-only; the bar renders no controller prompt, per contract). */
    flowPhase: {type: String as PropType<'navigate' | 'locked' | 'committing'>, default: 'navigate'},
    /** P20: the R3 inspect-all toggle is on (labels + the mode chip). */
    inspectAll: {type: Boolean, default: false},
    /** WHO asked for this placement — normalized by the shared model. */
    sourceView: {type: Object as PropType<PromptSourceView | undefined>, default: undefined},
    /** THE PLAY PLATE of a staged pick (T15 · CD) — undefined for every other placement and past the commit. */
    stagedPlate: {type: Object as PropType<StagedPlayPlate | undefined>, default: undefined},
    /** The card a reward the cell decides lands on, as the staged play chose it (Arboretum) — its live count. */
    chosenTarget: {type: Object as PropType<DossierChosenTarget | undefined>, default: undefined},
    // track mode (P27)
    trackInfo: {type: Object as PropType<ScaleTooltipContent | null>, default: null},
    /** P27c: the owning scale's overview (name / current value / description). */
    trackScale: {type: Object as PropType<{titleKey: string, nounKey: string, valueText: string, descriptionKey: string} | null>, default: null},
    // cell mode (P27b): curated special-cell lore
    lore: {type: Object as PropType<{title: string, description: string} | undefined>, default: undefined},
    /** The FINALE's block (the session's whole life, PL-304) — the stock, the yield, the order, the stage. */
    finale: {type: Object as PropType<FinalePanelModel | undefined>, default: undefined},
  },
  computed: {
    /** The staged card's art as the plate's thumbnail (the thumb tier — a 4.6rem swatch). */
    stagedArtStyle(): Record<string, string> {
      const url = this.stagedPlate === undefined ? undefined : cardArtUrl(this.stagedPlate.card);
      return url === undefined ? {} : {backgroundImage: `url(${cardArtUrlAtTier(url, 'thumb')})`};
    },
    /** The price's resource glyph (M€ for a play). */
    stagedPriceIconClass(): string {
      return this.stagedPlate?.price === undefined ? '' : iconClassFor(this.stagedPlate.price.icon);
    },
    /** The plant glyph of the finale's stock line. */
    plantIconClass(): string {
      return iconClassFor('plants');
    },
    /** A whole greenery of the bank wears the board's own greenery art — the same sprite the cell will draw. */
    finaleTileClass(): string {
      const suffix = tileCssClassOf(TileType.GREENERY, this.aresTiles);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    finaleEnoughText(): string {
      return this.finale === undefined ? '' : translateTextWithParams(BANK_ENOUGH, [String(this.finale.bank.affordable)]);
    },
    finaleBurnText(): string {
      return this.finale === undefined ? '' : translateTextWithParams(BANK_BURNS, [String(this.finale.bank.burns)]);
    },
    finaleCellsText(): string {
      return this.finale?.freeCells === undefined ? '' : translateTextWithParams(BANK_CELLS, [String(this.finale.freeCells)]);
    },
    /** The stage pill's word. */
    finaleStageKey(): string {
      switch (this.finale?.stage) {
      case 'wait': return STAGE_WAIT;
      case 'landing': return STAGE_LANDING;
      default: return STAGE_PICK;
      }
    },
    /** «Ждём ответа: <seat>» — the seat the table waits on; the bare word when the poll has not named one yet. */
    finaleWaitText(): string {
      const who = this.finale?.waitingOn;
      return who === undefined ? translateText(STAGE_WAIT) : translateTextWithParams(WAITING_ON, [who.name]);
    },
    /** The source CARD, when there is one — what L3 opens fullscreen. */
    sourceCard(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    /** The cell is LOCKED (or its commit is on the wire) — amber register. */
    cellLocked(): boolean {
      return this.selectedLegal && this.flowPhase !== 'navigate';
    },
    cellbarClass(): string {
      if (!this.selectedLegal) {
        return 'con-context__cellbar--no';
      }
      return this.cellLocked ? 'con-context__cellbar--locked' : 'con-context__cellbar--ok';
    },
    /** WHAT LANDS — the pure identity (title / swatch / demoted sentence). */
    identity(): PlacementIdentity {
      return placementIdentity({
        translatedTitle: this.placementTitle,
        tileType: this.placementShape?.tileType,
        placementType: this.placementShape?.placementType,
        placementEffect: this.placementShape?.placementEffect,
        sourceCard: this.placementShape?.sourceCard,
        hasConversion: this.conversion !== undefined,
        translate: (key, params) =>
          (params !== undefined ? translateTextWithParams(key, [...params]) : translateText(key)),
      });
    },
    /** The PLAN line — the same action's later placements ('' → none). */
    followUpLine(): string {
      return placementFollowUpLine(this.placementShape?.followUpPlacements, (key, params) =>
        (params !== undefined ? translateTextWithParams(key, [...params]) : translateText(key)));
    },
    /** The real board tile art class for the identity / formula swatch. */
    swatchClass(): string | undefined {
      const tt = this.identity.tileType;
      if (tt === undefined) {
        return undefined;
      }
      const suffix = tileCssClassOf(tt, this.aresTiles);
      return suffix === '' ? undefined : 'board-space-tile--' + suffix;
    },
    conversionIconClass(): string {
      return this.conversion !== undefined ? iconClassFor(this.conversion.icon) : '';
    },
    /** The dossier body — the preview's facts regrouped by intent. */
    sections(): ReadonlyArray<DossierSection> {
      return this.preview !== undefined ? dossierSections(this.preview, this.viewerColor, this.chosenTarget) : [];
    },
    /**
     * This cell demands nothing extra — said as one quiet word on the cell
     * line. Only for a LEGAL cell with a live preview: an illegal cell's line
     * already carries the refusal, and no preview means no claim.
     */
    noToll(): boolean {
      return this.selectedLegal && this.preview !== undefined &&
        !this.sections.some((s) => s.key === 'effect');
    },
    emptyKey(): string | undefined {
      return this.preview !== undefined ? dossierEmptyKey(this.preview) : undefined;
    },
    /** An illegal cell has no preview — the hover facts still explain it. */
    fallbackRows(): ReadonlyArray<DossierRow> {
      if (this.mode !== 'placement' || this.preview !== undefined) {
        return [];
      }
      return buildDossierRows(this.info?.facts ?? []);
    },
    cellHeader(): string {
      return textOf(this.info?.status.header);
    },
    /** The placement PROMPT's identity for the portrait's yield (the mode, the tile, the kind, the source, the title). */
    placementPromptKey(): string {
      const shape = this.placementShape;
      return `${this.mode}|${shape?.tileType ?? ''}|${shape?.placementType ?? ''}|${shape?.placementEffect ?? ''}|${shape?.sourceCard ?? ''}|${this.placementTitle}`;
    },
    tileLabel(): string {
      return textOf(this.info?.status.tileLabel);
    },
    // ── TR67 · THE STEP PORTRAIT (R3) ──────────────────────────────────
    /** The scale's own accent — the step plate and the kicker wear it. */
    trackAccentStyle(): Record<string, string> {
      const accent = this.trackInfo?.accent;
      return accent === undefined ? {} : {'--track-accent': ARC_SCALE_THEMES[accent].vars['--arc-accent'] ?? ''};
    },
    trackGlyphClass(): string {
      const accent = this.trackInfo?.accent;
      return accent === undefined ? '' : ARC_SCALE_THEMES[accent].glyphClass;
    },
    /** What the step GIVES (the band's reward / value / description rows). */
    trackGives(): ReadonlyArray<ScaleTooltipRow> {
      return (this.trackInfo?.rows ?? []).filter((r) => r.tone !== 'claim' && r.tone !== 'note');
    },
    /** Who already took it (a player's dot, the world government). */
    trackClaims(): ReadonlyArray<ScaleTooltipRow> {
      return (this.trackInfo?.rows ?? []).filter((r) => r.tone === 'claim' || r.tone === 'note');
    },
    // ── TR67 · THE CELL DOSSIER ─────────────────────────────────────────
    /** The cell's OBJECT — the inspection's title (the tile, a special tile by name, a square by its kind). */
    cellId(): CellIdentity {
      if (this.info === undefined) {
        return {title: translateText('Board cell'), tier: 'base', special: false, line: ''};
      }
      return cellIdentity(this.info, (key, params) =>
        (params !== undefined ? translateTextWithParams(key, [...params]) : translateText(key)), translateMessage);
    },
    /** The server's portrait of the focused cell — the SAME payload in every mode (the hover info of that cell). */
    portrait(): CellPortrait | undefined {
      return this.info?.portrait;
    },
    /** The facts that light the ring: a placement's preview (what THIS placement touches), else the hover's own. */
    ringFacts(): ReadonlyArray<BoardFact> {
      if (this.mode === 'placement') {
        return this.preview !== undefined ? previewFacts(this.preview) : [];
      }
      return this.info?.facts ?? [];
    },
    ring(): Array<CellRingSlot> {
      return cellRing(this.portrait, this.ringFacts, this.viewerColor);
    },
    marks(): Array<CellMark> {
      return this.info !== undefined ? cellMarks(this.info) : [];
    },
    /** The tile's OWN points at the end (the inspection only — a placement's VP lives in its endgame block). */
    ownVp(): number | undefined {
      return this.info !== undefined ? cellOwnVp(this.info) : undefined;
    },
    /** The CARD that put the tile here — the source chip; X opens its face. */
    placedBy(): CardName | undefined {
      return this.portrait?.sourceCard;
    },
    cellSections(): Array<DossierSection> {
      return this.info !== undefined ? cellDossierSections(this.info, this.viewerColor, {lore: this.lore !== undefined}) : [];
    },
    cellBodySections(): Array<DossierSection> {
      return this.cellSections.filter((s) => s.key !== 'rules');
    },
    cellFootSections(): Array<DossierSection> {
      return this.cellSections.filter((s) => s.key === 'rules');
    },
    ownerColor(): Color | undefined {
      return this.info?.status.ownerColor;
    },
    ownerName(): string {
      const color = this.ownerColor;
      if (color === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : '';
    },
    /** P27b: hide the lore title when the cell header already names it. */
    loreTitle(): string {
      const t = this.lore?.title ?? '';
      if (t === '') {
        return '';
      }
      const translated = translateText(t);
      return translated === this.cellHeader || translated === this.tileLabel ? '' : t;
    },
  },
  methods: {
    /** A seat's word in the finale order. */
    seatStateKey(state: FinaleSeatState): string {
      return state === 'done' ? SEAT_DONE : state === 'placing' ? SEAT_PLACING : SEAT_WAITING;
    },
    /**
     * Recompute the two overflow affordances. Kept cheap (three reads, no
     * layout write) and driven by the passive scroll event, a ResizeObserver and
     * the preview watcher — the three moments the answer can change.
     */
    measureScroll(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined || root === null) {
        return;
      }
      const remaining = root.scrollHeight - root.clientHeight - root.scrollTop;
      if (remaining > 2 && this.mode === 'placement' && this.portrait !== undefined && !this.portraitYield) {
        // The decision text outranks the cell's face: yield, then measure again (TR67).
        this.portraitYield = true;
        this.$nextTick(() => this.measureScroll());
        return;
      }
      if (remaining > 2 && this.mode === 'cell' && this.portrait !== undefined && !this.portraitTight) {
        this.portraitTight = true;
        this.$nextTick(() => this.measureScroll());
        return;
      }
      this.moreBelow = remaining > 2;
      this.scrolledDown = root.scrollTop > 2;
    },
    resetScroll(): void {
      (this.$refs.root as HTMLElement | undefined)?.scrollTo?.({top: 0});
      this.$nextTick(() => this.measureScroll());
    },
  },
});
</script>
