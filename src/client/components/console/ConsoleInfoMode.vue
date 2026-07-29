<template>
  <!-- THE INFORMATION WORKSPACE (Y) — no longer a centered modal: the root is
       an ABSOLUTE child of `.con-main` filling everything RIGHT of the left
       resource rail, between the top HUD and the bottom command bar. The rail
       stays visible as the mode's SUMMARY panel (ConsoleShell overrides its
       player context to the inspected player) — the two surfaces are ONE
       synchronized read of one player.
       data-motion-*: the surface-motion director materializes the frame from
       the rail seam (open) and returns it there (dismiss); the OWN full dim
       STAYS — the workspace opens OVER arbitrary band surfaces (z 11560,
       above the shade; the rail rides at 11561, crisp above the dim). -->
  <div class="con-info" role="dialog" :aria-label="$t('Information')" data-motion-surface="info-mode">
    <div class="con-info__backdrop" aria-hidden="true"></div>
    <div class="con-info__frame" data-motion-panel>

      <!-- ── Header: whose dossier + switching hints. The identity zone is
           the workspace half of the rail↔panel seam — it carries the name /
           corp the narrow rail cannot, and recomposes directionally on LB/RB
           (data-insp-slide, inspectSwitchMotion). TR / VP totals live on the
           RAIL's score cap now — never repeated here. -->
      <header class="con-info__head">
        <div class="con-info__who">
          <GamepadGlyph control="bumperL" class="con-info__bumper" />
          <span class="con-info__ident" data-insp-slide>
            <span :class="'con-status__dot player_bg_color_' + viewed.color"></span>
            <span class="con-info__name">{{ viewedDisplayName }}</span>
            <span v-if="isSelf" class="con-info__chip con-info__chip--you">{{ $t('You') }}</span>
            <span v-if="isSelf && myTurn" class="con-info__chip con-info__chip--turn">{{ $t('Your turn') }}</span>
            <span v-if="isPassed" class="con-info__chip con-info__chip--passed">{{ $t('passed') }}</span>
          </span>
          <GamepadGlyph control="bumperR" class="con-info__bumper" />
        </div>
        <div class="con-info__head-meta" data-insp-slide>
          <span v-if="corpName !== ''" class="con-info__corp">{{ $t(corpName) }}</span>
          <span v-else-if="viewedIsBot" class="con-info__corp con-info__corp--bot">{{ $t('Automa opponent') }} · {{ $t(botDifficultyLabel) }}</span>
        </div>
      </header>

      <!-- ── CONTENT ZONES — one keyed swap: the dashboard ⇄ a detail swap
           runs a short out-in beat (detailZone hooks) instead of a bare
           v-if pop. An LB/RB SEAT switch keeps the key ('dash' is shared by
           the human and bot dashboards) so it patches INSTANTLY — its beat
           is the inspectSwitchMotion slide, and rapid presses must never
           queue zone transitions. -->
      <transition :css="false" mode="out-in"
                  @enter="detailZoneEnter" @leave="detailZoneLeave"
                  @enter-cancelled="detailZoneCancelled" @leave-cancelled="detailZoneCancelled">

      <!-- ── DASHBOARD — one persistent zone ('dash'): the human/bot
           variants swap INSIDE it, so an LB/RB seat switch patches
           instantly (its beat is the inspectSwitchMotion slide) and can
           never queue zone transitions. -->
      <div v-if="infoModeState.detail === undefined" key="dash" class="con-info__scroll" :class="dashboardIsBot ? 'con-info__grid' : 'con-info__cols'" data-insp-slide>
      <!-- ── the MarsBot participant ─────────────────────────────────── -->
      <template v-if="viewedIsBot && botAutoma !== undefined">
        <!-- Played cards — the SAME unified summary block as a human seat
             (X opens the same premium table; the note names the provenance). -->
        <section class="con-info__block con-info__block--played">
          <h3 class="con-info__block-title">{{ $t('Played cards') }}
            <span class="con-info__hotkey"><GamepadGlyph control="secondary" /></span>
          </h3>
          <template v-if="playedSummary.total > 0">
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line con-info__stat-line--total"><span>{{ $t('Total') }}</span><b class="con-info__mint">{{ playedSummary.total }}</b></div>
              <div v-for="r in playedSummary.rows" :key="r.key" class="con-info__stat-line">
                <span class="con-info__pcat"><i class="con-info__pcat-dot" :class="'con-info__pcat-dot--' + r.key" aria-hidden="true"></i>{{ $t(r.label) }}</span>
                <b>{{ r.count }}</b>
              </div>
            </div>
          </template>
          <div v-else class="con-info__empty">{{ $t('No cards played yet') }}</div>
          <div class="con-info__note">{{ $t('Everything MarsBot flipped from its action deck this game') }}</div>
        </section>
        <ConsoleMarsBotSections mode="dashboard" :bot="viewed" :automa="botAutoma" :ctx="botCardContext" />
        <!-- VP — the SAME block as a human participant (shared model + rule).
             The M€→VP conversion note lives here (its economy home moved to
             the rail, which carries numbers, not prose). -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Victory Points') }}
            <span v-if="vpVisible" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
          </h3>
          <template v-if="vpVisible">
            <div class="con-info__stat-lines">
              <div v-if="vpTotalRowVisible" class="con-info__stat-line con-info__stat-line--total"><span>{{ $t('Total') }}</span><b>{{ vpTotal }}</b></div>
              <div v-for="s in vpScales" :key="s.key" class="con-info__stat-line">
                <span>{{ $t(s.label) }}</span><b>{{ s.total }}</b>
              </div>
            </div>
          </template>
          <div v-else class="con-info__hidden">{{ $t('Score is hidden until the end of the game') }}</div>
          <div class="con-info__note">{{ $t('Leftover M€ converts to VP at game end') }}</div>
        </section>
      </template>

      <!-- ── the human participant — the DETAIL the rail cannot carry, in
           three calm columns. The rail already shows this player's TR / VP
           total / resources / production / the full tag matrix — repeating
           any of those here is banned (the two surfaces are one instrument). -->
      <template v-else>
        <!-- Col 1 — the score STORY (adjacent to the rail's score cap):
             where the VP total comes from. The big total itself lives on
             the rail; the one exception is the own seat under the
             «Приватный счёт» pref (the rail masks — the row is the only
             honest place left). -->
        <div class="con-info__col">
          <section class="con-info__block con-info__block--vp">
            <h3 class="con-info__block-title">{{ $t('Victory Points') }}
              <span v-if="vpVisible" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
            </h3>
            <template v-if="vpVisible">
              <div class="con-info__stat-lines">
                <div v-if="vpTotalRowVisible" class="con-info__stat-line con-info__stat-line--total"><span>{{ $t('Total') }}</span><b>{{ vpTotal }}</b></div>
                <div v-for="s in vpScales" :key="s.key" class="con-info__stat-line">
                  <span>{{ $t(s.label) }}</span><b>{{ s.total }}</b>
                </div>
              </div>
            </template>
            <div v-else class="con-info__hidden">{{ $t('Score is hidden until the end of the game') }}</div>
          </section>
        </div>

        <!-- Col 2 — availability: cards / actions / effects counters. -->
        <div class="con-info__col">
          <section class="con-info__block">
            <h3 class="con-info__block-title">{{ $t('Cards') }}</h3>
            <div class="con-info__stat-lines">
              <div v-if="isSelf" class="con-info__stat-line"><span>{{ $t('Playable now') }}</span><b class="con-info__mint">{{ cardsPlayable }}</b></div>
              <div class="con-info__stat-line"><span>{{ $t('In hand') }}</span><b>{{ cardsTotal }}</b></div>
            </div>
            <div v-if="!isSelf" class="con-info__note">{{ $t('Hand contents are hidden') }}</div>
          </section>

          <section class="con-info__block">
            <h3 class="con-info__block-title">{{ $t('Actions') }}
              <span class="con-info__hotkey"><GamepadGlyph control="triggerL" /></span>
            </h3>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Available now') }}</span><b class="con-info__mint">{{ actionsAvailable }}</b></div>
              <div class="con-info__stat-line"><span>{{ $t('Total') }}</span><b>{{ actionsTotal }}</b></div>
            </div>
          </section>

          <section class="con-info__block">
            <h3 class="con-info__block-title">{{ $t('Effects') }}
              <span class="con-info__hotkey"><GamepadGlyph control="triggerR" /></span>
            </h3>
            <div class="con-info__stat-lines">
              <div class="con-info__stat-line"><span>{{ $t('Active') }}</span><b class="con-info__mint">{{ effectsCount }}</b></div>
              <div v-if="discountCount > 0" class="con-info__stat-line"><span>{{ $t('Discounts') }}</span><b>{{ discountCount }}</b></div>
            </div>
          </section>
        </div>

        <!-- Col 3 — the played TABLE summary (X opens the premium table) and
             resources ON CARDS (the rail's satellite is parked while the
             workspace is open; the L3 detail shows the hosting cards). -->
        <div class="con-info__col">
          <section class="con-info__block con-info__block--played">
            <h3 class="con-info__block-title">{{ $t('Played cards') }}
              <span class="con-info__hotkey"><GamepadGlyph control="secondary" /></span>
            </h3>
            <template v-if="playedSummary.total > 0">
              <div class="con-info__stat-lines">
                <div class="con-info__stat-line con-info__stat-line--total"><span>{{ $t('Total') }}</span><b class="con-info__mint">{{ playedSummary.total }}</b></div>
                <div v-for="r in playedSummary.rows" :key="r.key" class="con-info__stat-line">
                  <span class="con-info__pcat"><i class="con-info__pcat-dot" :class="'con-info__pcat-dot--' + r.key" aria-hidden="true"></i>{{ $t(r.label) }}</span>
                  <b>{{ r.count }}</b>
                </div>
              </div>
            </template>
            <div v-else class="con-info__empty">{{ $t('No cards played yet') }}</div>
          </section>
          <section class="con-info__block">
            <h3 class="con-info__block-title">{{ $t('Extra resources') }}
              <span class="con-info__hotkey"><GamepadGlyph control="stickL" /></span>
            </h3>
            <div v-if="extraSummary.length > 0" class="con-info__extras">
              <span v-for="e in extraSummary" :key="e.key" class="con-info__extra">
                <i :class="e.iconClass" aria-hidden="true"></i>
                <span class="con-info__extra-count">{{ e.total }}</span>
              </span>
            </div>
            <div v-else class="con-info__empty">{{ $t('No resources on cards') }}</div>
          </section>
        </div>
      </template>
      </div>

      <!-- ── «РАЗЫГРАНО» — the embedded premium table (X): the SAME
           component as the board-home overlay, re-seated to fill the
           workspace. The seat is the workspace's inspected player (LB/RB
           switch it globally — rail, header and table move as one);
           B folds an open category first, then returns to the dashboard. -->
      <div v-else-if="infoModeState.detail === 'played'" key="played" class="con-info__playedhost" data-insp-slide>
        <ConsolePlayedOverlay ref="playedView"
                              embedded
                              :players="playerView.players"
                              :thisPlayerColor="playerView.thisPlayer.color"
                              :forcedColor="viewed.color"
                              :automa="botAutoma"
                              @close="infoModeState.detail = undefined" />
      </div>

      <!-- ── DETAILS ─────────────────────────────────────────────────── -->
      <div v-else :key="'detail-' + (infoModeState.detail ?? '')" class="con-info__detail" data-insp-slide>
        <div class="con-info__detail-head">
          <span class="con-info__detail-title">{{ $t(detailTitle) }}</span>
          <span class="con-info__detail-back"><GamepadGlyph control="back" /><span>{{ $t('To overview') }}</span></span>
        </div>

        <!-- MarsBot details: printed board / played pile / bonus piles -->
        <ConsoleMarsBotSections
          v-if="isBotDetail && botAutoma !== undefined"
          :mode="botDetailMode"
          :bot="viewed"
          :automa="botAutoma"
          :ctx="botCardContext" />

        <!-- Extra resources detail -->
        <div v-if="infoModeState.detail === 'extras'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="extraGroups.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No resources on cards') }}</div>
          <section v-for="g in extraGroups" :key="g.key" class="con-info__exgroup">
            <h4 class="con-info__exgroup-title">
              <i :class="g.iconClass" aria-hidden="true"></i>
              <span>{{ $t(g.label) }}</span>
              <b class="con-info__mint">{{ g.total }}</b>
            </h4>
            <!-- INFO PARITY (CTS-3.8): the holders are REAL premium card
                 renders (the live model already draws the resource cubes);
                 the count chip doubles the read at TV distance. -->
            <div class="con-info__excards">
              <div v-for="c in g.cards" :key="c.card.name" class="con-info__excard">
                <Card :card="c.card" :key="c.card.name" lightweight />
                <span class="con-info__excard-count">
                  <i :class="g.iconClass" aria-hidden="true"></i> ×{{ c.amount }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- Actions detail -->
        <div v-else-if="infoModeState.detail === 'actions'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="actionRows.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No action cards') }}</div>
          <div v-for="row in actionRows" :key="row.name" class="con-info__acrow" :class="{'con-info__acrow--ok': row.available}">
            <span class="con-info__acrow-state" aria-hidden="true">{{ row.available ? '✓' : '·' }}</span>
            <span class="con-info__acrow-name">{{ $t(row.name) }}</span>
            <span v-if="row.available" class="con-info__acrow-badge">{{ $t('Available now') }}</span>
            <span v-else-if="row.reason !== ''" class="con-info__acrow-reason">{{ row.reason }}</span>
          </div>
          <div v-if="!isSelf" class="con-info__note">{{ $t('Opponent state is read-only') }}</div>
        </div>

        <!-- Effects detail (reuses the desktop effect blocks — real graphics) -->
        <div v-else-if="infoModeState.detail === 'effects'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="effectGroups.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No passive effects') }}</div>
          <div class="con-info__effects">
            <EffectBlock v-for="g in effectGroups" :key="g.key" :group="g" :card="tableauCard(g.cardName)" />
          </div>
        </div>

        <!-- VP detail — pure breakdown: the TOTAL lives on the rail's score
             cap (repeated only while the rail masks the own score). -->
        <div v-else-if="infoModeState.detail === 'vp'" class="con-info__scroll con-info__detail-scroll">
          <template v-if="vpVisible">
            <div v-if="vpTotalRowVisible" class="con-info__vp-totalrow">{{ $t('Total') }} <b>{{ vpTotal }}</b></div>
            <section v-for="s in vpModel.scales" :key="s.key" class="con-info__vpscale">
              <h4 class="con-info__vpscale-title"><span>{{ $t(s.label) }}</span><b>{{ s.total }}</b></h4>
              <div class="con-info__vpsegs">
                <span v-for="seg in s.segments" :key="seg.key" class="con-info__vpseg" :class="'con-info__vpseg--' + seg.key">
                  {{ $t(seg.label) }}: <b>{{ seg.value }}</b>
                </span>
              </div>
            </section>
            <section v-for="g in vpModel.cardGroups" :key="g.kind" class="con-info__vpcards">
              <h4 class="con-info__vpscale-title"><span>{{ $t(g.label) }}</span><b>{{ g.total }}</b></h4>
              <div v-for="row in g.rows" :key="row.cardName" class="con-info__exrow">
                <span class="con-info__exrow-name">{{ $t(row.cardName) }}</span>
                <span class="con-info__exrow-count">{{ row.victoryPoint }}</span>
              </div>
            </section>
          </template>
          <div v-else class="con-info__hidden con-info__empty--big">{{ $t('Score is hidden until the end of the game') }}</div>
        </div>
      </div>

      </transition>

      <!-- The command contract publishes to the shell's ONE bottom command
           bar via consolePanelUi (CONSOLE_TV_PREMIUM_PLAN §3.2) — the
           footCommands watch below; no panel-local hint row. -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * THE INFORMATION WORKSPACE (Y) — the console-native read-only player
 * dashboard: "информация не скрыта — Y, посмотрел, вернулся ровно туда же".
 *
 * Since the workspace iteration the LEFT RESOURCE RAIL is this mode's
 * summary half: ConsoleShell overrides the rail's player context to the
 * INSPECTED player (infoModeState.playerColor) while the mode is open, so
 * TR / VP total / resources / production / tags read THERE and are never
 * repeated in this panel. This component renders only the DETAIL the rail
 * cannot carry: identity (name/corp), VP breakdown, cards/actions/effects
 * availability, resources on cards, and the hotkey detail screens.
 *
 * All data comes from PUBLIC models (PublicPlayerModel + the client card
 * manifest) — the same sources the desktop chips/overlays read:
 *  - extra card resources: tableau CardModel.resources + manifest
 *    resourceType (tableaus are public; opponent HANDS are never touched —
 *    only cardsInHandNbr, which the desktop shows too);
 *  - actions: availableBlueCardActionCount / playerActionSourceCount;
 *  - effects: the effects-overlay extraction (manifest-driven);
 *  - VP: victoryPointsBreakdown through the SAME pure model as the desktop
 *    VP overlay, gated by the SAME visibility rule (self OR
 *    gameOptions.showOtherPlayersVP) — hidden mode shows the safe panel.
 * Input (hotkeys, player switching, scrolling) is routed by ConsoleShell;
 * this component is pure presentation over infoModeState.
 */
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {botTableauCards} from '@/client/components/marsbot/marsBotView';
import {consolePlayedUi} from '@/client/console/consolePlayedUi';
import ConsolePlayedOverlay from '@/client/components/console/played/ConsolePlayedOverlay.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerActionSourceCount, cardHasAction} from '@/client/components/actions/actionExtraction';
import {playerEffects, playerEffectGroups, EffectGroup} from '@/client/components/effects/effectExtraction';
import {buildVictoryPointsModel, VictoryPointsModel} from '@/client/components/overview/victoryPointsModel';
import {shouldMaskOwnPassiveVp} from '@/client/components/overview/privateScoreState';
import {findPerformActionCard, findPlayProjectCardAction} from '@/client/console/turnIntents';
import {infoModeState} from '@/client/console/infoModeState';
import {translateTextWithParams} from '@/client/directives/i18n';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import {MarsBotGuideContext} from '@/client/components/marsbot/marsBotGuide';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleMarsBotSections from '@/client/components/console/ConsoleMarsBotSections.vue';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import Card from '@/client/components/card/CardFace.vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';

const DETAIL_TITLES: Record<string, string> = {
  extras: 'Extra resources',
  actions: 'Actions',
  effects: 'Effects',
  vp: 'Victory Points',
  played: 'Played',
  botBoard: 'MarsBot board',
  botBonus: 'Bonus cards',
};

/** The played-summary rows follow the table's zone order + caption keys. */
const PLAYED_SUMMARY_LABEL: ReadonlyArray<{key: string, label: string}> = [
  {key: 'corporation', label: 'Corporation'},
  {key: 'prelude', label: 'Preludes'},
  {key: 'ceo', label: 'CEO'},
  {key: 'active', label: 'Active'},
  {key: 'automated', label: 'Automated'},
  {key: 'events', label: 'Events'},
];

export default defineComponent({
  name: 'ConsoleInfoMode',
  components: {ConsoleMarsBotSections, ConsolePlayedOverlay, EffectBlock, GamepadGlyph, Card},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
  },
  data() {
    return {infoModeState};
  },
  computed: {
    viewed(): PublicPlayerModel {
      const color = this.infoModeState.playerColor;
      return this.playerView.players.find((p) => p.color === color) ?? this.playerView.thisPlayer;
    },
    isSelf(): boolean {
      return this.viewed.color === this.playerView.thisPlayer.color;
    },
    /** The viewed participant is the MarsBot seat → bot-specific sections. */
    viewedIsBot(): boolean {
      return this.viewed.isMarsBot === true;
    },
    /** The dashboard renders the BOT variant (drives the wrapper's layout
     *  class — the zone element itself persists across seat switches). */
    dashboardIsBot(): boolean {
      return this.viewedIsBot && this.botAutoma !== undefined;
    },
    viewedDisplayName(): string {
      return participantDisplayName(this.viewed);
    },
    botAutoma(): MarsBotModel | undefined {
      return this.playerView.game.automa;
    },
    botDifficultyLabel(): string {
      const automa = this.botAutoma;
      return automa !== undefined ? DIFFICULTY_LABEL[automa.difficulty] : '';
    },
    /** The expansion context — resolves bonus-card faces + guide sections for THIS game. */
    botCardContext(): MarsBotGuideContext {
      const expansions = this.playerView.game.gameOptions.expansions;
      return {venus: expansions.venus === true, colonies: expansions.colonies === true, deltaProject: expansions.deltaProject === true};
    },
    isBotDetail(): boolean {
      const d = this.infoModeState.detail;
      return d === 'botBoard' || d === 'botBonus';
    },
    botDetailMode(): 'botBoard' | 'botBonus' {
      return this.infoModeState.detail === 'botBonus' ? 'botBonus' : 'botBoard';
    },
    isPassed(): boolean {
      return this.playerView.game.passedPlayers.includes(this.viewed.color);
    },
    corpName(): string {
      for (const c of this.viewed.tableau) {
        try {
          if (getCard(c.name)?.type === CardType.CORPORATION) {
            return c.name;
          }
        } catch (err) {
          // manifest gap — skip
        }
      }
      return '';
    },
    /** Extra card resources aggregated by type (public — tableaus only). */
    extraGroups(): Array<{key: string, label: string, iconClass: string, total: number, cards: Array<{card: CardModel, amount: number}>}> {
      const byType = new Map<string, {label: string, total: number, cards: Array<{card: CardModel, amount: number}>}>();
      for (const card of this.viewed.tableau) {
        const amount = card.resources ?? 0;
        if (amount <= 0) {
          continue;
        }
        let type: string | undefined;
        try {
          type = getCard(card.name)?.resourceType;
        } catch (err) {
          type = undefined;
        }
        if (type === undefined) {
          continue;
        }
        const entry = byType.get(type) ?? {label: type, total: 0, cards: []};
        entry.total += amount;
        // The LIVE CardModel (info parity, CTS-3.8): the real premium card
        // render carries the resource cubes itself — never a name-only row.
        entry.cards.push({card, amount});
        byType.set(type, entry);
      }
      return Array.from(byType.entries()).map(([key, e]) => ({
        key,
        label: e.label,
        iconClass: `con-info__exicon ${iconClassFor(key.toLowerCase().replace(/ /g, '-'))}`,
        total: e.total,
        cards: e.cards.sort((a, b) => b.amount - a.amount),
      })).sort((a, b) => b.total - a.total);
    },
    extraSummary(): Array<{key: string, iconClass: string, total: number}> {
      return this.extraGroups.map((g) => ({key: g.key, iconClass: g.iconClass, total: g.total}));
    },
    /**
     * The played-table SUMMARY (the dashboard block): counts per printed
     * zone through the SAME grouping the «Разыграно» table uses — the block
     * and the X detail can never disagree. The bot seat reads its public
     * played pile (botTableauCards).
     */
    playedSummary(): {total: number, rows: Array<{key: string, label: string, count: number}>} {
      const tableau = this.viewedIsBot && this.botAutoma !== undefined ?
        botTableauCards(this.botAutoma) : this.viewed.tableau;
      const zones = buildPlayedZones(tableau);
      const counts: Record<string, number> = {
        corporation: zones.corporations.length,
        prelude: zones.preludes.length,
        ceo: zones.ceos.length,
        active: zones.active.length,
        automated: zones.automated.length,
        events: zones.events.length,
      };
      const rows = PLAYED_SUMMARY_LABEL
        .map(({key, label}) => ({key, label, count: counts[key] ?? 0}))
        .filter((r) => r.count > 0);
      return {total: rows.reduce((n, r) => n + r.count, 0), rows};
    },
    cardsPlayable(): number {
      if (!this.isSelf) {
        return 0;
      }
      const play = findPlayProjectCardAction(this.playerView.waitingFor);
      return (play?.input.cards ?? []).filter((c) => c.isDisabled !== true).length;
    },
    cardsTotal(): number {
      if (this.isSelf) {
        return this.playerView.cardsInHand.length + (this.playerView.thisPlayer.selfReplicatingRobotsCards ?? []).length;
      }
      // Opponent: the PUBLIC hand count only — contents stay hidden.
      return this.viewed.cardsInHandNbr;
    },
    actionsAvailable(): number {
      return this.viewed.availableBlueCardActionCount;
    },
    actionsTotal(): number {
      return playerActionSourceCount(this.viewed.tableau);
    },
    effectsCount(): number {
      return playerEffects(this.viewed.tableau).length;
    },
    discountCount(): number {
      return playerEffects(this.viewed.tableau).filter((e) => e.signature?.discount !== undefined).length;
    },
    effectGroups(): Array<EffectGroup> {
      return playerEffectGroups(this.viewed.tableau);
    },
    /** VP visibility: self always; opponents only when the game options allow. */
    vpVisible(): boolean {
      return this.isSelf || this.playerView.game.gameOptions.showOtherPlayersVP === true;
    },
    vpTotal(): number {
      return this.viewed.victoryPointsBreakdown.total;
    },
    /**
     * The VP TOTAL's home is the rail's score cap — repeating it here is
     * banned. The ONE exception: the own seat under the «Приватный счёт»
     * display pref masks the rail cell, so this deliberately-opened mode
     * is the only honest place left for the number.
     */
    vpTotalRowVisible(): boolean {
      return this.isSelf && shouldMaskOwnPassiveVp(true);
    },
    vpModel(): VictoryPointsModel {
      const game = this.playerView.game;
      return buildVictoryPointsModel(this.viewed.victoryPointsBreakdown, {
        hasMoon: game.moon !== undefined,
        hasPathfinders: game.pathfinders !== undefined,
        hasEscapeVelocity: game.gameOptions.escapeVelocity !== undefined,
      });
    },
    vpScales(): Array<{key: string, label: string, total: number}> {
      return this.vpModel.scales.map((s) => ({key: s.key, label: s.label, total: s.total}));
    },
    /** Actions detail rows — availability is server truth for SELF only. */
    actionRows(): Array<{name: CardName, available: boolean, reason: string}> {
      const availableNames = this.isSelf ?
        new Set((findPerformActionCard(this.playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)) :
        new Set<CardName>();
      return this.viewed.tableau
        .filter((c) => {
          try {
            return cardHasAction(c.name);
          } catch (err) {
            return false;
          }
        })
        .map((c) => {
          const reason = this.isSelf ? c.actionReasons?.[0] : undefined;
          return {
            name: c.name,
            available: availableNames.has(c.name),
            reason: reason !== undefined ?
              translateTextWithParams(reason.message, (reason.params ?? []).map(String)) : '',
          };
        });
    },
    detailTitle(): string {
      return DETAIL_TITLES[this.infoModeState.detail ?? ''] ?? '';
    },
    /** The live command contract — published to the shell's ONE bottom
     *  command bar through consolePanelUi (the footCommands watch below). */
    footCommands(): Array<ConsoleCommand> {
      // Drop priorities for the narrow (Deck) bar: the mode's CORE verbs —
      // Y close (the always-visible exit contract) and LB/RB players (THE
      // workspace interaction) — outlive the detail hotkey hints, which are
      // also discoverable on the blocks themselves. X is the ONE default
      // details verb (the played table, human and bot alike); the seat's
      // extra readers live on the sticks (L3 extras / R3 bot board).
      const detail = this.infoModeState.detail;
      // The embedded «Разыграно» grammar — honest to the table's live
      // mirrors (consolePlayedUi), same verbs as the board-home overlay.
      if (detail === 'played') {
        if (consolePlayedUi.categoryBusy) {
          return [{control: 'back', label: 'Back'}];
        }
        if (consolePlayedUi.categoryOpen) {
          return [
            {control: 'secondary', label: 'Inspect'},
            {control: 'back', label: 'Back'},
            {control: 'inspect', label: 'Close', priority: 0},
          ];
        }
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
          {control: 'confirm', label: 'Open', enabled: consolePlayedUi.focusCategory !== ''},
          {control: 'back', label: 'To overview'},
          {control: 'inspect', label: 'Close', priority: 0},
        ];
      }
      const cmds: Array<ConsoleCommand> = [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
      ];
      if (detail === undefined && this.viewedIsBot) {
        cmds.push(
          {control: 'secondary', label: 'Played cards', priority: 2},
          {control: 'stickR', label: 'MarsBot board', priority: 3},
          {control: 'triggerR', label: 'Bonus cards', priority: 3},
          {control: 'confirm', label: 'VP overview', enabled: this.vpVisible},
        );
      } else if (detail === undefined) {
        cmds.push(
          {control: 'secondary', label: 'Played cards', priority: 2},
          {control: 'stickL', label: 'Extra resources', priority: 3},
          {control: 'triggerL', label: 'Actions', priority: 3},
          {control: 'triggerR', label: 'Effects', priority: 3},
          {control: 'confirm', label: 'VP overview', enabled: this.vpVisible},
        );
      } else {
        cmds.push({control: 'back', label: 'To overview'});
      }
      cmds.push({control: 'inspect', label: 'Close', priority: 0});
      return cmds;
    },
  },
  watch: {
    /** Publish the CONTEXTUAL command contract to the shell's ONE bottom
     *  command bar (consolePanelUi) — hints live only there, never in a
     *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('infoMode', cmds);
      },
    },
  },
  beforeUnmount() {
    clearPanelCommands('infoMode');
  },
  methods: {
    tableauCard(name: CardName): CardModel | undefined {
      return this.viewed.tableau.find((c) => c.name === name);
    },
    /** The shell forwards the pad to the embedded «Разыграно» table while
     *  the played detail is up (LB/RB and Y are handled globally first). */
    handlePlayedIntent(intent: GamepadIntent): void {
      (this.$refs.playedView as {handleIntent?: (i: GamepadIntent) => void} | undefined)?.handleIntent?.(intent);
    },
    // ── the content-zone swap beat (dashboard ⇄ details) ────────────────
    detailZoneEnter(el: Element, done: () => void): void {
      if (consoleReducedMotionActive()) {
        gsap.set(el, {clearProps: 'transform,opacity'});
        done();
        return;
      }
      gsap.fromTo(el,
        {opacity: 0, y: 8 * conUiScale()},
        {opacity: 1, y: 0, duration: motionMs(170) / 1000, ease: 'power2.out', clearProps: 'transform,opacity', onComplete: done});
    },
    detailZoneLeave(el: Element, done: () => void): void {
      if (consoleReducedMotionActive()) {
        done();
        return;
      }
      gsap.to(el, {opacity: 0, y: 4 * conUiScale(), duration: motionMs(90) / 1000, ease: 'power1.in', onComplete: done});
    },
    detailZoneCancelled(el: Element): void {
      gsap.killTweensOf(el);
      gsap.set(el, {clearProps: 'transform,opacity'});
    },
  },
});
</script>
