<template>
  <!-- THE COLONY WORKSPACE. `con-ws` = the workspace-family marker (rail
       lifted + ringed while this section lives); the `__frame` plate is the
       SAME chrome as `.con-hand__frame` / `.con-cardactions__frame` — one
       system, read from the plane before a word. When EMBEDDED (a step of
       another workspace) the shell comes off (rule 1) and the host's frame
       is the room. -->
  <div class="con-colonies"
       :class="[
         'con-colonies--' + layout,
         {
           'con-ws': !embedded,
           'con-colonies--embedded': embedded,
           'con-colonies--focus': focusState.open,
           // OWNING THE SCENE of a host that handed it over: a FIXED band, so
           // this screen never shares the flex row with the workspace it is
           // standing inside. Two `flex: 1` siblings in `.con-main` split it —
           // which is how the Hydronetwork came back cropped into half a band
           // while this surface was still playing its leave.
           'con-colonies--scene': sceneOverlay,
           // THE RECEIPT of a finished roster change: the stage folded home and the grid states the result —
           // no cursor, no verbs (the flow is past its commit; it leaves by itself).
           'con-colonies--receipt': receiptOn,
         },
       ]"
       :data-colony-city-degraded="cityState.degraded !== '' ? cityState.degraded : undefined"
       :data-colony-city-beat="cityState.live ? cityState.beat : undefined"
       :data-colony-roster-degraded="rosterState.degraded !== '' ? rosterState.degraded : undefined"
       :data-colony-roster-beat="rosterState.live ? rosterState.beat : undefined"
       :data-colony-mode="pick !== undefined ? 'pick' : 'browse'"
       :style="{'--coltile-scale': String(tileScale), '--con-colonies-seat': seatReservePx + 'px'}">
    <div class="con-colonies__frame">
      <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «КОЛОНИИ»
           + the fleet dock as the aux browse layer; descending into a colony
           grows the crumb tail «› <колония> › ТОРГОВЛЯ». When embedded, the
           host draws the crumb (rule 5) and only the fleet TOOLBAR remains. -->
      <!-- ── THE HEADER. The FLEET DOCK is ONE component in ONE place — the
           right edge — in EVERY mode (standalone / embedded / focus): spatial
           memory, no conflict with the crumb, and the launching ship's pad
           stays live through the focus descent (the trade resolves INSIDE the
           Focus Stage now). ── -->
      <!-- ⚠️ THE ROOT IS THE FLOW THE PLAYER ENTERED, not this screen's name.
           A colonies frame at depth 0 IS «КОЛОНИИ»; one standing INSIDE another
           workspace — a repeated «Летающая платформа» opening the colonies from
           the Hydronetwork's stage 7 — is a STEP of that flow, and it takes the
           whole scene (`frameSteps: 'scene'`), so the HEADER is the only place
           left that can say so. Derived from the STACK, never from a list of
           possible hosts. -->
      <ConsoleWsHead v-if="!embedded"
                     class="con-colonies__head"
                     :root="headRoot"
                     :emblem="headEmblem"
                     :wheelAnchor="headWheelAnchor"
                     :subject="headSubject"
                     :stage="headStage"
                     :committed="crumbCommitted">
        <!-- The aux browse layer: the pick-mode chip only (crossfades away
             past the descent — the crumb tail then names the mode). -->
        <span v-if="pick !== undefined" class="con-colonies__mode-chip">{{ $t(pick.labelKey) }}</span>
        <template #trailing>
          <ConsoleColonyFleetBar :chips="fleetChips" :launchingColor="launchingFleetColor" />
        </template>
      </ConsoleWsHead>
      <!-- EMBEDDED: the host draws the crumb (rule 5), and the FLEET DOCK goes
           WHERE IT ALWAYS IS — the header's right edge. When the host offers a
           berth there the dock TELEPORTS into it (one instance, one owner of
           the data); otherwise this toolbar keeps it, exactly as before.
           A dock floating in the content area was the loudest tell that the
           player had arrived somewhere ELSE: same screen, ships in a different
           place, and a row of vertical space stolen from the grid — which is
           what shrank the tiles, because the fit is height-bound. -->
      <Teleport v-if="embedded && fleetBerth !== ''" :to="fleetBerth">
        <ConsoleColonyFleetBar :chips="fleetChips" :launchingColor="launchingFleetColor" />
      </Teleport>
      <div v-else-if="embedded && (pick !== undefined || fleetBerth === '')" class="con-colonies__toolbar">
        <span v-if="pick !== undefined" class="con-colonies__mode-chip"
              :class="{'con-colonies__mode-chip--held': focusState.open}">{{ $t(pick.labelKey) }}</span>
        <ConsoleColonyFleetBar class="con-colonies__toolbar-fleets" :chips="fleetChips" :launchingColor="launchingFleetColor" />
      </div>

      <!-- ── The stage wrap: the BROWSE layer (the colony surface — islands
           over open space) and the COLONY FOCUS stage occupy the same region.
           Descending recomposes the frame in place: the browse DOM is only
           parked (selection / scroll / fit survive by construction). ── -->
      <div class="con-colonies__stagewrap">
        <div class="con-colonies__browse"
             :class="{
               'con-colonies__browse--parked': focusState.open,
               'con-colonies__browse--yield': revealEmbedPresenting || handStepHosted || parliamentStepHosted || (resolutionUi.discardStage && !resolutionParked),
             }">
          <!-- The premium tile grid. The scroller + `margin: auto` wrapper is
               the anti-clip contract: content centres when it fits and scrolls
               FROM THE TOP when it doesn't. -->
          <div class="con-colonies__body">
          <div class="con-colonies__scroll" ref="scroll">
            <div class="con-colonies__grid" ref="grid" :style="gridStyle">
              <div v-for="(colony, i) in colonies"
                   :key="colony.name"
                   class="con-colonies__slot"
                   :class="{'con-colonies__slot--focused': i === index && !dockCursorOn}"
                   :ref="i === index && !dockCursorOn ? 'selectedSlot' : undefined">
                <ConsoleColonyTile :colony="colony"
                                   :tradeOffset="tradeOffset"
                                   :projectedPosition="tileProjection(colony)"
                                   :focused="i === index && !dockCursorOn"
                                   :justDocked="colony.name === dockedColony"
                                   :orbit="rosterState.orbit === colony.name"
                                   :projectedCube="tileProjectedCube(colony)"
                                   :projectedCubeSlot="tileProjectedCubeSlot(colony)"
                                   :cityProjection="tileCityProjection(colony)"
                                   :status="tileStatus(colony)" />
              </div>
            </div>
          </div>
          <!-- «ПРИЧАЛЫ» — the viewer's FLEET DOCKS (Turmoil Redux TR06 Water
               Hauling and its sisters: a card that is a destination of the trade
               action). NOT a slot of the planet grid — the grid's layouts are
               designed per tile count — but a narrow column of its own at the
               right edge, under the fleet dock in the header: «your ships, and
               where else they go». Stands only while the viewer owns a dock; a
               rival's dock never stands here (only its owner may trade with it).
               The tile IS the card (the premium face, the fleet on its ▲). -->
          <aside v-if="docks.length > 0" class="con-colonies__docks" ref="docksCol" data-colonies-docks
                 :style="{'--con-dock-zoom': String(dockZoom)}">
            <div class="con-colonies__docks-title">{{ $t('Docks') }}</div>
            <div v-for="(dock, i) in docks"
                 :key="dock.card"
                 class="con-colonies__dockslot"
                 :class="{'con-colonies__dockslot--focused': dockCursorOn && i === dockCursor.index}"
                 :ref="dockCursorOn && i === dockCursor.index ? 'selectedDock' : undefined">
              <ConsoleFleetDockTile :dock="dock"
                                    :status="dockTileStatus(dock)"
                                    :focused="dockCursorOn && i === dockCursor.index" />
            </div>
          </aside>
          </div>

          <!-- COMPACT STATUS RAIL — ONE line, fixed height: the quick summary
               of the FOCUSED colony and the CONSEQUENCE of the primary action.
               Information architecture (iteration 2): name + track position
               lead (the anchor), then «→ what you get», then «· the owners'
               bonus», then the ONE critical warning. What the tile itself
               already states perfectly (its availability dot, its reward
               cells) is NOT repeated — a BLOCKED colony swaps the consequence
               for the ONE honest reason instead of adding a second badge. -->
          <!-- The FOCUSED DOCK's rail: the card's name · what the trade brings
               (the server's chips) · or the ONE reason it is not a destination. -->
          <footer v-if="focusedDock !== undefined" class="con-colonies__rail" data-colonies-dock-rail>
            <span class="con-colonies__rail-name">{{ $t(focusedDock.card) }}</span>
            <template v-if="focusedDockReason !== ''">
              <span class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + (dockTileStatus(focusedDock).kind === 'docked' ? 'inactive' : 'blocked')">
                <span aria-hidden="true">{{ dockTileStatus(focusedDock).kind === 'docked' ? '○' : '✕' }}</span>
                <span>{{ focusedDockReason }}</span>
              </span>
            </template>
            <template v-else-if="focusedDockChips.length > 0">
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <ActionEffectChip v-for="(chip, ci) in focusedDockChips" :key="'dc' + ci" class="con-colonies__rail-chip" :effect="chip" />
            </template>
          </footer>
          <!-- THE RECEIPT's rail (a finished roster change): ONE line — what left, what came, whether the colony
               stands. A result, never an offer: it carries no verb. -->
          <footer v-else-if="receiptOn" class="con-colonies__rail"
                  :data-colony-roster-receipt="rosterReceiptOn ? '' : undefined"
                  :data-colony-city-receipt="cityReceiptOn ? '' : undefined"
                  :data-colony-build-receipt="buildReceiptOn ? '' : undefined">
            <span class="con-colonies__rail-receipt">
              <span class="con-colonies__rail-receipt-mark" aria-hidden="true">✓</span>
              <span>{{ receiptText }}</span>
            </span>
          </footer>
          <footer v-else-if="focusedMeta !== undefined" class="con-colonies__rail">
            <span class="con-colonies__rail-name">{{ $t(colonies[index] !== undefined ? colonies[index].name : '') }}</span>
            <span v-if="railMode === 'trade'" class="con-colonies__rail-track">{{ focusedTrackDisplay }}</span>

            <!-- ── A CHOSEN TRACK's pick (TR07): «3/7 → 7/7» · «торговля здесь: [now] → [after]», or the ONE
                 reason (at the top / not active). The rail says only what the tile cannot: the tile shows the
                 ghost and «+N», the rail the trade this move buys. ── -->
            <!-- ── A ROSTER pick: the level's own sentence. «Who leaves»: what choosing this tile does, or the ONE
                 reason it cannot leave. «Who enters»: the tile that leaves LEADS (stable context), then how this
                 one would enter and whether the colony stands — the server's projection, read off the marker. ── -->
            <template v-if="railMode === 'roster'">
              <template v-if="pick !== undefined && pick.roster !== undefined && pick.roster.level === 'outgoing'">
                <span v-if="railBlocked" class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + focusedStatus.kind" data-colonies-rail-roster="refused">
                  <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
                </span>
                <template v-else>
                  <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
                  <span class="con-colonies__rail-note" data-colonies-rail-roster="leaves">{{ rosterLeaveNote }}</span>
                </template>
              </template>
              <template v-else>
                <span v-if="pick !== undefined && pick.roster !== undefined && pick.roster.outgoing !== undefined" class="con-colonies__rail-muted" data-colonies-rail-roster="leaving">
                  {{ $t('Leaves') }} ● {{ $t(pick.roster.outgoing) }}
                </span>
                <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
                <span class="con-colonies__rail-note" data-colonies-rail-roster="enters">{{ focusedStatus.text }}</span>
              </template>
            </template>
            <!-- ── A CITY ON THE CHOSEN TILE (TR22): «[город] встанет на плитку · Космические города 1 → 2 · ПО +4» —
                 the server's projection off the `tileSite` marker (one marker for every candidate). ── -->
            <template v-else-if="railMode === 'city'">
              <template v-if="focusedCityReading !== undefined">
                <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
                <span class="con-colonies__rail-cell" data-colonies-rail-city>
                  <PremiumCountGlyph class="con-colonies__rail-cityglyph" :glyph="spaceCityGlyph" />
                  <span class="con-colonies__rail-label">{{ $t('lands on this tile') }}</span>
                </span>
                <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
                <span class="con-colonies__rail-cell con-colonies__rail-cell--get" data-colonies-rail-city-count>
                  <span class="con-colonies__rail-label">{{ $t('Space cities') }}</span>
                  <b>{{ focusedCityReading.cities.before }}</b>
                  <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
                  <b>{{ focusedCityReading.cities.after }}</b>
                </span>
                <template v-if="focusedCityReading.victoryPoints !== undefined">
                  <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
                  <span class="con-colonies__rail-cell con-colonies__rail-cell--get" data-colonies-rail-city-vp>
                    <span class="con-colonies__rail-label">{{ $t('VP') }}</span>
                    <b>+{{ focusedCityReading.victoryPoints }}</b>
                  </span>
                </template>
              </template>
              <span v-else-if="railBlocked" class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + focusedStatus.kind">
                <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
              </span>
            </template>
            <template v-else-if="railMode === 'track'">
              <template v-if="focusedTrackReading !== undefined">
                <span class="con-colonies__rail-track" data-colonies-rail-track>{{ focusedTrackReading.before.display }} → {{ focusedTrackReading.after.display }}</span>
                <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
                <span class="con-colonies__rail-cell con-colonies__rail-cell--get">
                  <span class="con-colonies__rail-label">{{ $t('Trade here') }}</span>
                  <b v-if="focusedTrackReading.before.quantity > 1">{{ focusedTrackReading.before.quantity }}</b>
                  <BenefitGlyph :benefit="focusedTrackReading.before.benefit" :idx="focusedTrackReading.before.position" :cardResources="cardResourceKinds" />
                  <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
                  <b v-if="focusedTrackReading.after.quantity > 1">{{ focusedTrackReading.after.quantity }}</b>
                  <BenefitGlyph :benefit="focusedTrackReading.after.benefit" :idx="focusedTrackReading.after.position" :cardResources="cardResourceKinds" />
                </span>
              </template>
              <span v-else-if="railBlocked" class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + focusedStatus.kind">
                <span aria-hidden="true">{{ focusedStatus.kind === 'inactive' ? '○' : '✕' }}</span>
                <span>{{ focusedStatus.text }}</span>
              </span>
            </template>

            <!-- ── BLOCKED (trade window): the one reason, nothing else.
                 The guard states the POSITIVE fact. It used to read
                 `kind !== 'ok'`, and `'ok'` is only ever produced while a
                 trade TRANSACTION is narrating its beats — so during ordinary
                 browsing every focused colony fell into this arm, including
                 the ones the server is offering, and printed a hardcoded
                 «Торговля недоступна» over a colony the player was in the act
                 of choosing. `'none'` means «nothing to report», not «blocked
                 with no reason given». (Cross-cutting: never derive where the
                 player is by negating a rendering condition.) ── -->
            <template v-else-if="railMode === 'trade' && railBlocked">
              <span class="con-colonies__rail-reason" :class="'con-colonies__rail-reason--' + focusedStatus.kind">
                <span aria-hidden="true">{{ focusedStatus.kind === 'inactive' ? '○' : '✕' }}</span>
                <span>{{ focusedStatus.text }}</span>
              </span>
            </template>

            <!-- ── TRADE: the rail says ONLY what the tile cannot. The reward
                 and the owner bonus are printed on the tile in the very same
                 glyphs — restating them here made the rail an encyclopaedia
                 line that every colony repeated. What IS rail-only: a
                 standing offset (the tile shows the level, not why it moved)
                 and the one honest warning. ── -->
            <template v-else-if="railMode === 'trade'">
              <span v-if="focusedOffset > 0" class="con-colonies__rail-cell con-colonies__rail-cell--get">
                <span class="con-colonies__rail-label">{{ $t('Your trade advances the track first') }}</span>
                <b>+{{ focusedOffset }}</b>
              </span>
              <span v-if="focusedTradeLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
            </template>

            <!-- ── BUILD pick: → build a colony · the placement grant. ── -->
            <template v-else-if="railMode === 'build'">
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-cell">
                <PlayerCube v-if="viewerColor !== undefined" class="con-colonies__rail-cube" :color="viewerColor" :size="16" />
                <span class="con-colonies__rail-label">{{ $t('You build') }}</span>
              </span>
              <template v-if="focusedBuildQty > 0">
                <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
                <span class="con-colonies__rail-cell con-colonies__rail-cell--get">
                  <b v-if="focusedBuildQty > 1">{{ focusedBuildQty }}</b>
                  <BenefitGlyph :benefit="focusedBuildBenefit" :idx="0" :cardResources="cardResourceKinds" />
                </span>
              </template>
              <span class="con-colonies__rail-sep" aria-hidden="true">·</span>
              <!-- A build BEYOND the limit names its berth («Место 4 · сверх лимита») — «Свободно мест: 0» beside
                   «Вы строите» would contradict the door that offers the tile. -->
              <span v-if="focusedOverLimitText !== ''" class="con-colonies__rail-muted" data-colonies-rail-overlimit>{{ focusedOverLimitText }}</span>
              <span v-else class="con-colonies__rail-muted">{{ $t('Free slots') }}: {{ focusedFreeBerths }}</span>
              <span v-if="focusedBuildLost" class="con-colonies__rail-warn">⚠ {{ $t('Resource will be lost — no card') }}</span>
              <span v-if="pick !== undefined && focusedStatus.kind === 'blocked'" class="con-colonies__rail-reason con-colonies__rail-reason--blocked">
                <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
              </span>
            </template>

            <!-- ── SELECT pick (setup remove / add-tile): verb + verdict. ── -->
            <template v-else>
              <span class="con-colonies__rail-arrow" aria-hidden="true">→</span>
              <span class="con-colonies__rail-note">{{ $t(pick ? pick.labelKey : '') }}</span>
              <span v-if="focusedStatus.kind === 'blocked'" class="con-colonies__rail-reason con-colonies__rail-reason--blocked">
                <span aria-hidden="true">✕</span><span>{{ focusedStatus.text }}</span>
              </span>
            </template>
          </footer>
        </div>

        <!-- ── EMBEDDED OUTCOME zone — the trade's drawn payout (Pluto)
             presents INSIDE the workspace: the shell's ONE reveal overlay is
             teleported here (claim: consoleWorkspaceOutcome, host 'colonies').
             Rendered from the CLAIM (submit time) so the target exists before
             the teleport resolves; empty and inert until the reveal mounts —
             the fleet flight and the reward chip waves play over the live
             grid beneath. The covers then fly from the traded tile into the
             reveal's own slots (the deck-draw targeting is document-wide), so
             «взлёт карт с колонии» IS the opening of this deeper scene. -->
        <div v-if="revealEmbedActive && !focusState.open" class="con-colonies__embed" data-embed-slot="colonies-reveal"></div>

        <!-- ── THE FULL-STAGE DISCARD (the resolution's mandatory pick). The
             whole central area belongs to the REAL hand — comparing every
             card is the phase's one job. The colony context lives INSIDE the
             hand's own ask plate (the planet mini leads «Сбросьте 1 карту ·
             Колония») — a separate green chip row above it said the same
             thing twice and cost the card grid a whole line (iteration 4). -->
        <div v-if="handStepHosted" class="con-colonies__embed con-colonies__embed--hand">
          <div class="con-colonies__handhost" data-embed-slot="colonies-hand"></div>
        </div>

        <!-- ── THE PARLIAMENT'S VOTE STEP (Turmoil Redux — the Venus tile pays
             DELEGATES: two per settlement, one or two at the top of its
             track). The whole central area belongs to the REAL Parliament in
             its vote mode — the three resolutions, the forecast, the bench the
             cubes fly off — teleported here as a hosted frame, one instance.
             The crumb reads «КОЛОНИИ › ВЕНЕРА › ГОЛОСОВАНИЕ»: the step hands
             its stage UP, the colony stays the subject. The zone LEAVES with a
             short dissolve (the step's own leave plays inside it). -->
        <transition name="con-colonies-parlstep">
          <div v-if="parliamentStepHosted" class="con-colonies__embed con-colonies__embed--parliament" data-colonies-parliament-step>
            <div class="con-colonies__parlhost" data-embed-slot="colonies-parliament"></div>
          </div>
        </transition>

        <!-- ── «СБРОШЕННЫЕ» — the resolution's discard seat, at SECTION level
             so it holds ONE spot through the focus ⇄ discard recompositions.
             The shared discard cinematic's tray teleports into the anchor;
             between cycles the receipt (count) stays. -->
        <div v-if="discardSeatLive"
             class="con-colonies__discardseat"
             :class="{'con-colonies__discardseat--live': trayStanding}"
             data-colony-discard-seat>
          <span class="con-colonies__discardseat-anchor" data-colony-discard-tray></span>
          <span v-if="!trayStanding" class="con-colonies__discardseat-done">
            <span class="con-colonies__discardseat-label">{{ $t('DISCARDED') }}</span>
            <b v-if="resolutionUi.discarded > 0" class="con-colonies__discardseat-count">{{ resolutionUi.discarded }}</b>
          </span>
        </div>

        <!-- ── THE COLONY FOCUS STAGE — the same frame, one level deeper.
             The descend hooks unfold it from the pressed tile's rect; the
             planet medallion is the carried subject. -->
        <!-- ── THE COLONY DOSSIER (X = «Осмотреть») — the read of ONE colony, in
             the same region, opened with the same descend phrase (the same
             hooks: it publishes the marks they read). A on it ENTERS the act:
             the stage below takes its place with the planet / track / berths
             carried over (`enterFocusFromInspect` — a hand-off, not a
             fold-and-reopen). Its own transition wrapper, so the two surfaces
             may overlap for exactly that beat. ── -->
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleColonyInspect v-if="focusState.open && focusState.intent === 'inspect' && focusColonyModel !== undefined"
                                ref="inspectStage"
                                :embedded="true"
                                :colony="focusColonyModel"
                                :players="players"
                                :viewerColor="viewerColor"
                                :playerId="catalog ? '' : playerId"
                                :tradeOffset="tradeOffset"
                                :cityProjection="tileCityProjection(focusColonyModel)"
                                :actIntent="inspectActIntent"
                                :actionAvailable="inspectActionAvailable"
                                :blockReason="inspectBlockReason"
                                :blockTone="inspectBlockTone"
                                :pickLabel="pick !== undefined ? pick.labelKey : ''"
                                @enter="$emit('inspect-enter')"
                                @cancel="closeFocus()" />
        </transition>
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleColonyFocusStage v-if="focusState.open && focusState.intent !== 'inspect' && focusColonyModel !== undefined"
                                   ref="focusStage"
                                   :colony="focusColonyModel"
                                   :intent="stageIntent"
                                   :roster="stageRoster"
                                   :city="stageCity"
                                   :actionAvailable="focusActionAvailable"
                                   :blockReason="focusBlockReason"
                                   :blockTone="focusBlockTone"
                                   :pickLabel="pick !== undefined ? pick.labelKey : ''"
                                   :options="tradePaymentOptions"
                                   :disabledOptions="tradeDisabledPayments"
                                   :players="players"
                                   :preview="focusPreview"
                                   :pathOffset="focusPathOffset"
                                   @path-offset="onFocusPathOffset"
                                   :thisPlayer="thisPlayer"
                                   :viewerColor="viewerColor"
                                   :tradeOffset="tradeOffset"
                                   :outcomeZone="focusOutcomeZone"
                                   :trackMove="focusTrackMove"
                                   :buildSite="focusBuildSite"
                                   :buildProjected="buildDoorStands"
                                   @inspect="onStageInspect"
                                   @confirm="onFocusConfirm"
                                   @build-confirm="$emit('build-confirm', $event)"
                                   @pick-confirm="$emit('pick-confirm')"
                                   @cancel="closeFocus()" />
        </transition>
        <!-- ── THE FLEET-DOCK STAGE — a trade whose fleet goes to a CARD. The
             same region, the same descend phrase (the same hooks), the card
             the carried object. ── -->
        <transition :css="false"
                    @enter="onFocusEnter" @leave="onFocusLeave"
                    @enter-cancelled="onFocusEnterCancelled" @leave-cancelled="onFocusLeaveCancelled">
          <ConsoleFleetDockStage v-if="focusState.open && focusState.dock !== '' && focusDockView !== undefined"
                                 ref="dockStage"
                                 :card="focusDockView.card"
                                 :model="focusDockView.model"
                                 :available="focusDockAvailable"
                                 :blockReason="focusDockBlockReason"
                                 :blockTone="focusDockBlockTone"
                                 :options="tradePaymentOptions"
                                 :disabledOptions="tradeDisabledPayments"
                                 :preview="dockPreview"
                                 :offerEffects="focusDockView.offer?.effects ?? []"
                                 :thisPlayer="thisPlayer"
                                 :freeFleets="viewerFreeFleets"
                                 :pickMode="pick !== undefined"
                                 :players="players"
                                 :viewerColor="viewerColor"
                                 :outcomeZone="focusOutcomeZone"
                                 :statsView="statsView"
                                 @confirm="$emit('dock-confirm', $event)"
                                 @inspect="$emit('dock-inspect', focusDockView.card)"
                                 @flow-complete="$emit('dock-flow-complete', $event)"
                                 @cancel="closeFocus()" />
        </transition>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Console-native COLONY WORKSPACE (iteration 3 — the workspace-family
 * rework). The colony surface keeps its strongest ideas VERBATIM — separate
 * readable colony islands over open space, count-aware layouts
 * (consoleColoniesModel), the continuous fit-to-fill engine, 2D d-pad
 * stepping, server-authoritative availability — and gains the family shell:
 * the `__frame` plate, the shared `ConsoleWsHead` crumb
 * («КОЛОНИИ › <колония> › ТОРГОВЛЯ»), a COMPACT one-line status rail, and the
 * COLONY FOCUS STAGE (the trade/inspect modals merged into one embedded
 * descend — see ConsoleColonyFocusStage).
 *
 * Count-aware layouts: 1–3 = one centred row, 4 = 2×2, 5 = 3+2, 6 = 3×2,
 * >6 add-a-tile catalog = compact wrap. Tradeability is SERVER truth (the
 * trade AndOptions' SelectColony set); PICK MODE (a server SelectColony)
 * reuses the same grid with per-colony server reasons. Button hints live
 * ONLY in the shell's bottom command bar.
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {
  colonyGridLayout, colonyGridCols, ColonyGridLayout, ColonyFocusIntent,
  colonyFleetBerth, colonyFocusState, openColonyFocus, closeColonyFocus, switchColonyFocusIntent,
  colonyDockCursor, openFleetDockFocus, resetColonyDockCursor, colonyPickIntent, consoleColoniesUi,
} from '@/client/console/consoleColoniesModel';
import {ColonyTrackMove} from '@/common/parliament/colonyTrackAdvance';
import {ColonyTrackMoveReading, colonyTrackMoveReading, trackMoveOf} from '@/client/console/colonyTrade/colonyTrackMoveModel';
import {colonyTrackMoveFlow} from '@/client/console/colonyTrade/colonyTrackMove';
import {ColonyTileSite} from '@/common/colonies/ColonyTileSite';
import {ColonyCityReceipt, colonyCityOwnSceneLive, colonyCityState, endWatchedColonyCity} from '@/client/console/colonyCity/consoleColonyCity';
import {COLONY_CITY_STAGE, ColonyCityReading, ColonyCityStageView, colonyCityReading} from '@/client/console/colonyCity/colonyCityModel';
import {CountedObjectGlyph} from '@/client/components/premiumCard/premiumCardIcons';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {workspaceOutcomeState, setWorkspaceOutcomeSlot, workspaceOutcomeClaimed} from '@/client/console/consoleWorkspaceOutcome';
import {
  setWorkspaceFrameSlot, setWorkspaceFrameStage, setWorkspaceFrameSubject,
  workspaceFrameEmblem, workspaceFrameHost, workspaceFrameIndex, workspaceFrameIsOverlay,
  workspaceFrameParked, workspaceFrameStage, workspaceStackCrumb, workspaceStackRootKind,
} from '@/client/console/consoleWorkspaceStack';
import {colonyResolutionUi, revealIsOwnerBonus} from '@/client/console/colonyTrade/colonyResolution';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {cardDiscardState} from '@/client/console/cardDiscard/cardDiscardState';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {motionMs} from '@/client/components/motion/motionTokens';
import {freeTradeFleets, effectiveTradePosition, rewardAtPosition, TradeRewardAt, TradeStep} from '@/client/components/colonies/colonyTradePlan';
import {fetchColonyTradePreview, fetchFleetDockPreview} from '@/client/components/colonies/colonyTradePreviewFetch';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {FleetDockPreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {
  FleetDockReasonInput, FleetDockTileStatus, FleetDockView, fleetDockReason, fleetDockTileStatus,
} from '@/client/console/colonyTrade/fleetDockModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {buildBenefitAt, ColonyMetadata, colonyCardResources} from '@/common/colonies/ColonyMetadata';
import {CardResource} from '@/common/CardResource';
import {holdsAnyOf} from '@/client/console/parliament/influenceYieldModel';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleColonyFleetBar, {ColonyFleetChip} from '@/client/components/console/ConsoleColonyFleetBar.vue';
import ConsoleColonyTile, {ConsoleColonyTileStatus} from '@/client/components/console/ConsoleColonyTile.vue';
import ConsoleColonyFocusStage from '@/client/components/console/ConsoleColonyFocusStage.vue';
import ConsoleColonyInspect from '@/client/components/console/ConsoleColonyInspect.vue';
import ConsoleFleetDockTile from '@/client/components/console/ConsoleFleetDockTile.vue';
import ConsoleFleetDockStage from '@/client/components/console/ConsoleFleetDockStage.vue';
import {forecastStageText} from '@/client/console/consoleEffectForecast';
import {VersionedView} from '@/client/console/gameStateVersion';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyTradeState, colonyTradeTileStatusText, presentedColonyModel} from '@/client/console/colonyTrade/consoleColonyTrade';
import {colonyBuildAnswered, ColonyBuildReceipt, colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {berthBuildBenefit, BerthBenefit, buildSiteOf, freeBerths, nextBuildSlot} from '@/client/console/colonyBuild/colonyBerths';
import {ColonyBuildSite} from '@/common/colonies/ColonyBuildSite';
import {berthIsOverLimit} from '@/common/colonies/colonyBerths';
import {colonyTradeReason, ColonyTradeReason} from '@/client/console/colonyTradeReason';
import {AvailabilityBlocker} from '@/common/availability/AvailabilityBlocker';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {cssLengthPx} from '@/client/console/cssUnits';
// The ONE source-seat reserve — the same arithmetic the drawn reveal and the
// deck pick honour, so a host's seat can never overlap whichever guest it
// happens to be standing beside.
import {sourceSeatReservePx} from '@/client/console/consoleWsStageLayout';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {colonyRosterState, setColonyRosterLanding} from '@/client/console/colonyRoster/consoleColonyRoster';
import {playReseatIn, playReseatOut} from '@/client/console/colonyRoster/colonyRosterDirector';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {colonyRosterChangeText, rosterBuildLands} from '@/common/colonies/ColonyRoster';
import {
  ColonyRosterPickView, ColonyRosterStageView, ROSTER_KIND_COPY, rosterIncomingOf, rosterStageReading,
} from '@/client/console/colonyRoster/colonyRosterModel';
import {restingRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import {
  armColonyFocusOrigin,
  armColonyFocusHandoff,
  playColonyStepEntry,
  colonyFocusEnterHook,
  colonyFocusLeaveHook,
  colonyFocusEnterCancelledHook,
  colonyFocusLeaveCancelledHook,
  resetColonyFocusMotion,
  retargetColonyFocusHome,
  armColonyFocusQuickExit,
} from '@/client/console/consoleColonyFocusMotion';

/** PICK MODE (T4 — a server SelectColony drives the grid): the shell owns it. */
export type ConsoleColonyPick = {
  /** Names the server accepts (its `coloniesModel`). */
  selectable: ReadonlyArray<string>,
  /** Per-colony SERVER reason for the unpickable ones (translated). */
  reasons: Readonly<Record<string, string>>,
  /**
   * The server verb — a MACHINE DISCRIMINATOR the trade orchestration keys on
   * (the lowercase `'trade'` sentinel routes the premium launch). NEVER
   * rendered: a sentinel is not copy, and `$t('trade')` leaked raw onto the
   * CTA chip and the command bar («A TRADE»).
   */
  buttonLabel: string,
  /** The DISPLAY i18n key for the A chip / command bar («Trade» / «Build» / «Select»). */
  labelKey: string,
  /**
   * THE PICK MOVES THE CHOSEN TILE'S TRACK (TR07 — the server's
   * `SelectColonyModel.trackMoves`): where each CANDIDATE's marker lands.
   * Its presence makes the act `track` (`colonyPickIntent`).
   */
  trackMoves?: ReadonlyArray<ColonyTrackMove>,
  /**
   * THE PICK PLACES A TILE ON THE CHOSEN COLONY TILE (TR22 Nova City — the server's `SelectColonyModel.tileSite`):
   * the tile, its hosted cell and the projection of the count and the card's VP — ONE marker for every candidate.
   * Its presence makes the act `city` (`colonyPickIntent`).
   */
  tileSite?: ColonyTileSite,
  /**
   * THE PICK BUILDS A COLONY (the server's `SelectColonyModel.buildSites` — published on EVERY build prompt): the
   * berth the cube takes on each CANDIDATE, whether it lies beyond the printed limit, the player's own cubes
   * there. Its presence makes the act `build` (`colonyPickIntent`) — never the button's label.
   */
  buildSites?: ReadonlyArray<ColonyBuildSite>,
  /**
   * The build is A CARD's own door (staged, or its live re-ask — the prompt names a card as its giver): the grid
   * PROJECTS the cube on every candidate and says, calmly, what the card lifts there. Every other build (the
   * standard project, a follow-up, a resolution's colony) keeps the grid it always had.
   */
  buildProjected?: boolean,
  /**
   * The pick is a STAGED door (TR07's staged colony): nothing is on the wire
   * yet — the stage's A is the PLAY's one submit and B walks one level back.
   * Absent on a live server prompt.
   */
  staged?: boolean,
  /**
   * THE PICK CHANGES THE ROSTER (the server's `SelectColonyModel.rosterChange` — a tile enters, leaves, or is
   * replaced in its slot): the marker, the LEVEL standing («who leaves» on the table / «who enters» on the
   * reserve) and a replacement's chosen leaving tile. Its presence makes the act `roster` (`colonyPickIntent`).
   */
  roster?: ColonyRosterPickView,
};

/** The focus stage's confirm payload (forwarded verbatim to the shell). */
export type ColonyTradeConfirmPayload = {
  paymentIndex: number,
  steps: ReadonlyArray<TradeStep>,
  captures: Readonly<Record<number, unknown>>,
};


/** The tile-fit bounds: how far the base tile may shrink / grow to fill space.
 *  The grow cap is deliberately generous — on the 4K tv profile the grid's
 *  fit engine may raise tiles further into the freed stage (plan §3.5). */
const MIN_TILE_SCALE = 0.72;
const MAX_TILE_SCALE = 2.0;
// Grid gaps + padding — MUST match `.con-colonies__grid` in console.less.
const COL_GAP = 18;
const ROW_GAP = 16;
const GRID_PAD_X = 36; // 18 each side
const GRID_PAD_Y = 26; // 10 top + 16 bottom
/** Rounding room (logical px): CSS `zoom` quantizes every tile to whole
 *  device pixels, so a planned N-across row can render 2–3px wider than
 *  `N × baseW × scale` — without slack the LAST tile flex-wraps to an
 *  unplanned extra row that overflows the section (the 5-colony 2+2+1
 *  regression on 4K). Taken off the width fit AND added to the grid cap,
 *  same defense as cardSelectionFit.FIT_ROW_SLACK / handGrid.ROW_SLACK. */
const FIT_SLACK = 12;

/**
 * THE COMPLETION SETTLE. After the last physical change (the cube seated, the
 * guard latched, the marker landed) the scene holds for one short beat before
 * the screen moves on — long enough to read «yes, THAT is what changed»,
 * short enough that it never feels like waiting. A dwell, not a gate: nothing
 * is being waited FOR, so there is no completion signal to ride.
 */
const COMPLETION_SETTLE_MS = 300;

export default defineComponent({
  name: 'ConsoleColoniesSection',
  components: {ConsoleWsHead, ConsoleColonyFleetBar, ConsoleColonyTile, ConsoleColonyFocusStage, ConsoleColonyInspect, ConsoleFleetDockTile, ConsoleFleetDockStage, ActionEffectChip, ColonyFleetIcon, BenefitGlyph, PlayerCube, PremiumCountGlyph},
  props: {
    colonies: {type: Array as PropType<ReadonlyArray<ColonyModel>>, required: true},
    index: {type: Number, required: true},
    /** Server-tradeable colony names (empty when it's not the trade window). */
    tradeable: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** Honest reason when trade is impossible right now ('' when tradeable). */
    tradeBlockReason: {type: String, default: ''},
    /**
     * The REAL turn signals feeding `colonyTradeReason`'s last two rungs. They
     * are props, not constants: pinning them `true` (as this component once did)
     * makes rung 3 always fire, so an off-turn player with a free fleet and an
     * empty active colony was told «не хватает ресурсов на оплату» — a blocker
     * that wasn't there. Rung 4 (the turn) was unreachable.
     */
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
    /** Set = SelectColony pick mode (shell submits; this only renders states). */
    pick: {type: Object as PropType<ConsoleColonyPick | undefined>, default: undefined},
    /**
     * THE RAIL IS THE ADD-A-TILE CATALOG (Aridor's first action, Maria): the
     * tiles on it are the game's UNUSED colonies, offered so one may be put
     * into play. They are not in the game — no track, no cubes, no trade — so
     * nothing server-scoped exists for them and none may be asked for.
     * Everything else (including the Build-Colony pick) rails IN-GAME colonies.
     */
    catalog: {type: Boolean, default: false},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
    /** The colony whose fleet JUST docked (a one-shot settle glow; '' = none). */
    dockedColony: {type: String, default: ''},
    /** The trade window's payment paths (the AndOptions' inner OrOptions). */
    tradePaymentOptions: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    tradeDisabledPayments: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    /** The viewer (stocks / production / id for the focus stage's outcome). */
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    /** The viewer's player id — the focus stage's server preview fetch. */
    playerId: {type: String, default: ''},
    /** The viewer's versioned view — the dock stage's R3 «Эффекты» layer asks the reacting seats' effect stats with it. */
    statsView: {type: Object as PropType<VersionedView | undefined>, default: undefined},
    /** The game-state version (`gameAge|undoCount`) — a moved state re-pulls
     *  the focused colony's trade preview, so the stage's candidate sets and
     *  captures are re-judged against CURRENT truth (never a stale pick). */
    viewVersion: {type: String, default: ''},
    /** The colony whose DELEGATE GRANT is standing (the Redux Venus) — the crumb's subject while the Parliament's vote is hosted here. */
    grantColony: {type: String, default: ''},
    /**
     * A STEP of another workspace (rule 1 — host-agnostic): the shell chrome
     * (frame plate, ConsoleWsHead, `con-ws` marker) comes off; grid, fit,
     * d-pad, focus stage and every capture are untouched.
     */
    embedded: {type: Boolean, default: false},
    /**
     * The viewer's FLEET DOCKS (`fleetDockModel.fleetDockViews` — Turmoil Redux
     * TR06 Water Hauling and its sisters): the «ПРИЧАЛЫ» column. Empty = no
     * column at all. The live verdict rides each view's `offer` (the pick's
     * marker); the column never derives availability itself.
     */
    docks: {type: Array as PropType<ReadonlyArray<FleetDockView>>, default: () => []},
  },
  emits: ['trade-confirm', 'build-confirm', 'pick-confirm', 'flow-complete', 'inspect-enter', 'dock-confirm', 'dock-inspect', 'dock-flow-complete'],
  data() {
    return {
      /** The grant's colony, LATCHED for the hosted vote's whole life: the prompt moves on at the submit while the cubes still fly. */
      grantSubject: '',
      /** The trade-launch controller — drives the launching-ship hide. */
      tradeFleetState,
      /** The reward transaction + build hero — the auto-fold watchers'
       *  mirrors (module reactives must sit in data for path watchers). */
      tradeState: colonyTradeState,
      buildState: colonyBuildState,
      /** The workspace flow state (module-level — the shell reads it too). */
      focusState: colonyFocusState,
      /** The embedded-outcome claim (the Pluto reveal re-homes into us). */
      outcomeState: workspaceOutcomeState,
      /** The resolution's presentation state (discard stage flag + receipt). */
      resolutionUi: colonyResolutionUi,
      /** A chosen track's move (TR07), mirrored: the stage it was confirmed on plays it, so nothing folds it before. */
      trackMoveFlow: colonyTrackMoveFlow,
      /** THE ROSTER CEREMONY's state (a tile replaced / added / removed): the free orbit, the receipt, the confession. */
      rosterState: colonyRosterState,
      /** The stage's colony model as last seen on the rail — kept for a tile the answer removed (see `focusColonyModel`). */
      focusModelLatch: undefined as ColonyModel | undefined,
      /** …and the roster act's reading as last derived from the prompt (the answer takes the prompt away). */
      rosterStageLatch: undefined as ColonyRosterStageView | undefined,
      /** A CITY's landing on a colony tile (TR22): the scene's state — the receipt, the confession. */
      cityState: colonyCityState,
      /** …and the city act's reading as last derived from the prompt (the answer takes the prompt away mid-scene). */
      cityStageLatch: undefined as ColonyCityStageView | undefined,
      /** …and the name the «city» DOOR's grid wore before the descent — B from the stage walks the tail back to it. */
      cityDoorStage: '',
      /**
       * A LANDED city's receipt, kept for as long as the door's pick stands on THIS surface. The shell clears the
       * scene's state when the read ends, while the section still rides its host's dissolve with the staged pick
       * latched — without this the ghosts and the pick's rail came back for the last frames of the leave.
       */
      cityReceiptLatch: undefined as ColonyCityReceipt | undefined,
      /** The same latch for a STAGED BUILD's receipt (TR25): the transaction's own is cleared when the read ends. */
      buildReceiptLatch: undefined as ColonyBuildReceipt | undefined,
      /** The focus stage's server preview (fetched per focused colony). */
      focusPreview: undefined as ColonyTradePreviewModel | undefined,
      /** The CHOSEN payment path's own track advance (the Unity action's 1) — the offset the preview was asked with. */
      focusPathOffset: 0,
      /** The newest preview request wins: an older answer (a different colony or offset) is dropped. */
      focusPreviewSeq: 0,
      /** The fit-set zoom on every tile (grows them to fill the space). */
      tileScale: 1,
      /** The fit-set grid max-width so the layout's column count holds. */
      gridMaxW: 0,
      fitRaf: undefined as number | undefined,
      /** THE HOST'S SOURCE SEAT, reserved once for this whole surface — see
       *  `fit()`. Written by the fit (the one thing that runs on mount, on
       *  resize and on every zone change) and read straight into the root's
       *  padding. */
      seatReservePx: 0,
      /** VueUse stop-handles (auto-managed listeners; no raw addEventListener). */
      stopResize: undefined as (() => void) | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
      /** The completion dwell (a breathing beat, never a gate). */
      completeTimer: undefined as number | undefined,
      /** The overview cursor's docks zone (module state — the shell steps it). */
      dockCursor: colonyDockCursor,
      /** The dock stage's server preview (`?dock=`), re-asked on every state move. */
      dockPreview: undefined as FleetDockPreviewModel | undefined,
      dockPreviewSeq: 0,
      /** The docks column's card zoom (solved by `fit` from the column's own room). */
      dockZoom: 0.5,
    };
  },
  computed: {
    /** The grid stands as the RECEIPT of a finished roster change (the stage has folded home). */
    rosterReceiptOn(): boolean {
      return this.rosterState.receipt !== undefined && !this.rosterState.live && !this.focusState.open;
    },
    /** The grid stands as the RECEIPT of a city just laid on a colony tile (TR22 — the stage has folded home). */
    cityReceiptOn(): boolean {
      return this.cityReceipt !== undefined && !this.cityState.live && !this.focusState.open;
    },
    /** The receipt of a landed city: the scene's own while it stands, then this surface's copy (see `cityReceiptLatch`). */
    cityReceipt(): ColonyCityReceipt | undefined {
      return this.cityState.receipt ?? this.cityReceiptLatch;
    },
    /** A «city» door's pick stands on this surface (live, staged, or latched through the host's dissolve). */
    cityDoorStands(): boolean {
      return this.pick?.tileSite !== undefined;
    },
    /** A card's own BUILD door stands on this surface (live, staged, or latched through the host's dissolve). */
    buildDoorStands(): boolean {
      return this.pick?.buildProjected === true;
    },
    /**
     * The receipt of a staged build: the transaction's own while it stands, then this surface's copy. It belongs to
     * the HOSTED instance the build was made in (a staged door's grid is always a step of its host): a FRESH
     * «Колонии» the player opens beside a parked flow (the delegates' step set aside) is an ordinary grid.
     */
    buildReceipt(): ColonyBuildReceipt | undefined {
      return this.embedded ? this.buildState.receipt ?? this.buildReceiptLatch : undefined;
    },
    buildReceiptOn(): boolean {
      return this.buildReceipt !== undefined && !this.buildState.active && !this.focusState.open;
    },
    /**
     * A staged build of the player's own is ANSWERED (on the wire, playing, homing or standing as its receipt):
     * the door's prompt has outlived its answer — no tile is offered, refused or projected any more.
     */
    buildAnswered(): boolean {
      // …on the HOSTED instance the build was made in — a fresh «Колонии» beside a parked flow answers its own presses.
      return this.embedded && (colonyBuildAnswered() || this.buildReceipt !== undefined);
    },
    /** The server's projection of a build on the FOCUSED tile (its berth, beyond the limit or not) — `undefined` off a build door. */
    focusBuildSite(): ColonyBuildSite | undefined {
      const model = this.focusColonyModel;
      return model === undefined ? undefined : buildSiteOf(this.pick?.buildSites, model.name);
    },
    /**
     * THE GRID IS A RECEIPT — one reading for every flow that folds its stage home and lets the grid state the
     * result (a roster change, a city laid on a tile, a colony a card built): no cursor, no verbs, the landed
     * tile in the calm amber.
     */
    receiptOn(): boolean {
      return this.rosterReceiptOn || this.cityReceiptOn || this.buildReceiptOn;
    },
    receiptText(): string {
      if (this.rosterReceiptOn) {
        return this.rosterReceiptText;
      }
      if (this.buildReceiptOn && this.buildReceipt !== undefined) {
        const built = this.buildReceipt;
        return translateTextWithParams(
          berthIsOverLimit(built.slot) ? 'Colony built on ${0} — berth ${1}, over the limit' : 'Colony built on ${0} — berth ${1}',
          [translateText(built.colony), String(built.slot + 1)]);
      }
      const receipt = this.cityReceipt;
      if (receipt === undefined) {
        return '';
      }
      const city = receipt.card !== undefined ? translateText(receipt.card) : translateText('City');
      return translateTextWithParams('${0} — on the ${1} colony tile', [city, translateText(receipt.colony)]);
    },
    /**
     * A city act of the player's own is ANSWERED (on the wire, playing, homing or standing as its receipt): the
     * door's prompt has outlived its answer — no tile is offered, refused or projected any more.
     */
    cityAnswered(): boolean {
      // (A WATCHER's landing is not an answer of this player's: it takes no status line and no rail away.)
      return this.cityState.armed !== undefined || colonyCityOwnSceneLive() || this.cityState.homing || this.cityReceipt !== undefined;
    },
    /** The counted object of the «city» rail — the space city RX08's readings draw. */
    spaceCityGlyph(): CountedObjectGlyph {
      return {kind: 'tile', tile: 'spaceCity'};
    },
    /** The focused tile's reading of a «city» pick (a candidate's only) — the server's marker, phrased. */
    focusedCityReading(): ColonyCityReading | undefined {
      const colony = this.colonies[this.index];
      const site = this.pick?.tileSite;
      if (colony === undefined || site === undefined || !this.isPickable(colony.name)) {
        return undefined;
      }
      return colonyCityReading(site, colony.name as ColonyName);
    },
    /** The city act as the stage reads it — pinned at the press (the answer takes the prompt away mid-scene). */
    stageCity(): ColonyCityStageView | undefined {
      if (this.focusState.intent !== 'city') {
        return undefined;
      }
      const site = this.pick?.tileSite;
      const model = this.focusColonyModel;
      if (site === undefined || model === undefined) {
        return this.cityStageLatch;
      }
      return {
        reading: colonyCityReading(site, model.name as ColonyName),
        // A STAGED door's A is the PLAY's one submit — it speaks the play's verb; a live door the server's own.
        verbKey: this.pick?.staged === true ? 'Play card' : (this.pick?.labelKey ?? 'Select'),
        stageKey: COLONY_CITY_STAGE,
      };
    },
    /** «− Церера · + Ио · колония построена» — the change in the roster's own words, then the colony. */
    rosterReceiptText(): string {
      const receipt = this.rosterState.receipt;
      if (receipt === undefined) {
        return '';
      }
      const kind = receipt.removed !== undefined && receipt.added !== undefined ? 'replace' : (receipt.added !== undefined ? 'add' : 'remove');
      const text = colonyRosterChangeText({kind, removed: receipt.removed, added: receipt.added, slot: 0}, (name) => translateText(name));
      return receipt.built ? `${text} · ${translateText('Colony built')}` : text;
    },
    /** The focused tile's card resource(s) — the ONE list the rail's glyph and the «lost» reading take (several for the Redux Vesta). */
    cardResourceKinds(): ReadonlyArray<CardResource> {
      return this.focusedMeta === undefined ? [] : colonyCardResources(this.focusedMeta);
    },
    layout(): ColonyGridLayout {
      return colonyGridLayout(this.colonies.length, this.pick !== undefined);
    },
    gridStyle(): Record<string, string> {
      // Catalog (>6) wraps freely; every other layout caps the width so the
      // intended column count holds around the fitted tiles.
      return this.gridMaxW > 0 && this.layout !== 'catalog' ? {maxWidth: this.gridMaxW + 'px'} : {};
    },
    /** Every player's fleet situation, the viewer first. */
    fleetChips(): Array<ColonyFleetChip> {
      const chips: Array<ColonyFleetChip> = this.players.map((player) => ({
        color: player.color,
        name: participantDisplayName(player),
        free: this.freeFleetsFor(player),
        total: player.fleetSize,
        me: player.color === this.viewerColor,
      }));
      return chips.sort((a, b) => Number(b.me) - Number(a.me));
    },
    /** The colour whose fleet is lifting off right now (the viewer's own —
     *  only the console shell arms flights for this client). */
    launchingFleetColor(): Color | '' {
      return this.tradeFleetState.active && this.viewerColor !== undefined ? this.viewerColor : '';
    },
    // ── The workspace crumb (ConsoleWsHead) ────────────────────────────────
    // Two depths share the one line: the FOCUS STAGE (pre-commit — cyan) and
    // the EMBEDDED PAYOUT (post-commit — amber): «КОЛОНИИ › ПЛУТОН › ДОБОР
    // КАРТ». Stable context before the mutable stage; only the tail moves.
    crumbSubject(): string {
      // THE HOSTED VOTE (a colony's delegate grant) is the build's / the trade's
      // continuation: the carried object survives into the step — «КОЛОНИИ ›
      // ВЕНЕРА › ГОЛОСОВАНИЕ» — by the giver the SERVER names on the grant
      // marker, latched past the submit (the prompt is gone while the cubes
      // land), never by a memory of the last focus (folded a beat earlier).
      if (this.parliamentStepHosted && (this.grantColony !== '' || this.grantSubject !== '')) {
        return this.grantColony !== '' ? this.grantColony : this.grantSubject;
      }
      // A REPLACEMENT names BOTH tiles from the moment the leaving one is chosen: «ЭНЦЕЛАД» on the catalog,
      // «ЭНЦЕЛАД → ТИТАН» on the stage — the tail only ever gains (translated here: the pair is not one key).
      const leaving = this.pick?.roster?.outgoing ?? (this.rosterStageLatch?.kind === 'replace' ? this.rosterStageLatch.leaves : undefined);
      if (leaving !== undefined && (this.pick?.roster !== undefined || this.rosterBusy)) {
        return this.focusState.open && this.focusState.colonyName !== '' ?
          `${translateText(leaving)} → ${translateText(this.focusState.colonyName)}` : leaving;
      }
      if (this.focusState.open && this.focusState.colonyName !== '') {
        return this.focusState.colonyName;
      }
      // A CITY's receipt (TR22): the stage has folded home and the result still belongs to its tile — the tail
      // keeps «ЛУНА · ГОРОД» while the grid is read (it only ever moves forward past the commit).
      const cityTile = this.cityReceipt?.colony ?? this.cityState.armed?.colony;
      if (this.cityAnswered && cityTile !== undefined) {
        return cityTile;
      }
      // A FLEET DOCK's stage: the card is the carried object — «КОЛОНИИ ›
      // ПЕРЕВОЗКА ВОДЫ › ТОРГОВЛЯ».
      if (this.focusState.open && this.focusState.dock !== '') {
        return this.focusState.dock;
      }
      if (this.revealEmbedActive && this.outcomeState.sourceCard !== '') {
        return this.outcomeState.sourceCard;
      }
      return '';
    },
    crumbStage(): string {
      // THE NESTED HAND STEP is the deepest frame — its stage IS the crumb's
      // tail: «КОЛОНИИ › ПЛУТОН › СБРОС КАРТЫ». Stable context before the
      // mutable stage; only this tail advances through the resolution.
      if (this.handStepHosted) {
        const stage = workspaceFrameStage('hand');
        return stage !== '' ? stage : 'Discarding a card';
      }
      // …and THE NESTED PARLIAMENT STEP the same way: «КОЛОНИИ › ВЕНЕРА ›
      // ГОЛОСОВАНИЕ» — the Parliament hands its stage up, the tail only moves forward.
      if (this.parliamentStepHosted) {
        const stage = workspaceFrameStage('parliament');
        return stage !== '' ? stage : 'Voting';
      }
      // The PAYOUT REVEAL is the deeper step — while it presents (over the
      // focus stage or over the grid alike) the tail names IT: «… › ПЛУТОН ›
      // ДОБОР КАРТ» for the trade income, «… › БОНУС ВЛАДЕЛЬЦА» for a colony
      // bonus wave (the batch's own role tag decides — never a title).
      if (this.revealEmbedPresenting) {
        if (this.outcomeState.phaseKey !== '') {
          return this.outcomeState.phaseKey;
        }
        return revealIsOwnerBonus(currentRevealEvent()?.source) ? 'Owner bonus' : 'Card draw';
      }
      if (this.focusState.open) {
        // A CHOSEN TRACK's stage names itself from the descent on (the stage publishes «Трек» a flush later — the
        // tail must not animate through «ЛУНА · ВЫБОР КОЛОНИИ» on the way).
        // (A «city» stage — TR22 — the same way: never through «ЛУНА · ВЫБОР КОЛОНИИ».)
        if (this.focusState.stage === '' && this.focusState.intent === 'city') {
          return COLONY_CITY_STAGE;
        }
        const stage = this.focusState.stage !== '' ? this.focusState.stage : (this.focusState.intent === 'track' ? 'Track' : '');
        // THE DOCK STAGE's R3 «Эффекты» layer is a level INSIDE the stage: the tail gains «· ЭФФЕКТЫ» (+ the source
        // card at its detail) and gives it back on B / R3 — the composers' own rule (PL-060), a composed,
        // pre-translated string.
        return this.focusState.dock !== '' ? (forecastStageText('dock', stage) ?? stage) : stage;
      }
      // A «CITY» act with its stage closed: ANSWERED — the grid is the receipt of «… · ГОРОД»; still a QUESTION (B
      // from the stage) — the grid is the door again and the tail walks BACK to the name the door wore.
      if (this.cityAnswered) {
        return COLONY_CITY_STAGE;
      }
      if (this.pick?.tileSite !== undefined && this.cityDoorStage !== '') {
        return this.cityDoorStage;
      }
      if (this.revealEmbedActive) {
        return this.outcomeState.phaseKey !== '' ? this.outcomeState.phaseKey : 'Card draw';
      }
      // A ROSTER pick's grid names its level: «СНЯТИЕ» while the leaving tile is chosen, then the act's own stage
      // («ЗАМЕНА» / «ДОБАВЛЕНИЕ») on the reserve — the same word the stage keeps.
      const roster = this.pick?.roster;
      if (roster !== undefined) {
        return roster.level === 'outgoing' ? ROSTER_KIND_COPY.remove.stage : ROSTER_KIND_COPY[roster.prompt.kind].stage;
      }
      return '';
    },
    /** The berth the HOST offers for our fleet dock ('' = keep it locally). */
    fleetBerth(): string {
      return colonyFleetBerth.selector;
    },
    /** The pair handed up to a HOSTING workspace's breadcrumb (see the watcher). */
    /**
     * ── THE HEADER STATES THE FLOW, WHEREVER THIS SCREEN IS STANDING ──────
     *
     * Nested (depth > 0) but NOT teleported into a host's zone — the
     * scene-handover shape — the crumb is the STACK's: root = the workspace the
     * player entered, subject = the deepest carried object, emblem = the
     * PARENT's identity symbol (it belongs to the parent anchor and must be the
     * same box before and after the step opened). At depth 0 this screen is its
     * own root and everything falls back to «КОЛОНИИ».
     */
    /** This screen is standing OVER a workspace that handed it the scene. */
    sceneOverlay(): boolean {
      return !this.embedded && workspaceFrameIsOverlay('colonies');
    },
    stackCrumb(): {root: string, subject?: {text: string}, stage?: string} | undefined {
      return workspaceFrameIndex('colonies') > 0 ? workspaceStackCrumb() : undefined;
    },
    headRoot(): string {
      return this.stackCrumb?.root ?? 'Colonies';
    },
    headEmblem(): string {
      const rootKind = this.stackCrumb !== undefined ? workspaceStackRootKind() : undefined;
      return (rootKind !== undefined ? workspaceFrameEmblem(rootKind).emblem : undefined) ?? 'colonies';
    },
    headWheelAnchor(): string {
      const rootKind = this.stackCrumb !== undefined ? workspaceStackRootKind() : undefined;
      return (rootKind !== undefined ? workspaceFrameEmblem(rootKind).wheelAnchor : undefined) ?? 'trading';
    },
    headStage(): string {
      // Nested: the tail is the STACK's — which is this screen's own stage,
      // published up by the watcher, and never regressing to '' (the flow's
      // step has a name even when the browse layer does not).
      return this.stackCrumb?.stage ?? this.crumbStage;
    },
    headSubject(): string {
      // The host's own subject leads while this screen carries nothing yet
      // («ГИДРОСЕТЬ МАРСА › МИКРОБНАЯ ФИКСАЦИЯ › ВЫБОР КОЛОНИИ»); once a colony
      // is picked up, IT is the deepest carried object and the stack says so.
      return this.stackCrumb?.subject?.text ?? this.crumbSubject;
    },
    embeddedCrumb(): {embedded: boolean, subject: string, stage: string} {
      return {embedded: this.embedded, subject: this.crumbSubject, stage: this.crumbStage};
    },
    crumbCommitted(): boolean {
      return this.focusState.committing || this.tradeFleetState.active ||
        (this.tradeState.active && !this.resolutionParked) ||
        this.revealEmbedActive || this.handStepHosted || this.parliamentStepHosted;
    },
    // ── The nested HAND STEP (the resolution's mandatory discard) ──────────
    /** The hand workspace is standing INSIDE us as a step of the resolution. */
    handStepHosted(): boolean {
      return workspaceFrameHost('hand') === 'colonies';
    },
    /**
     * The PARLIAMENT is standing INSIDE us as a step (Turmoil Redux — the Venus
     * tile's delegates: the vote mode, hosted, in the same full-stage zone the
     * hand's discard takes).
     */
    parliamentStepHosted(): boolean {
      return workspaceFrameHost('parliament') === 'colonies';
    },
    /**
     * THE FRAME SLOT — the teleport target we publish for the hand step
     * (`workspaceFrameTarget('hand')` reads it). ONE zone, always the
     * SECTION-level full-stage host: the discard's whole job is comparing
     * every card, so the hand owns the central area outright — a hand
     * squeezed beside the hero planet was the reported broken intermediate
     * state, and that zone no longer exists.
     */
    handSlotSelector(): string {
      return this.handStepHosted ? '[data-embed-slot="colonies-hand"]' : '';
    },
    /**
     * THE ONE SLOT this frame publishes for whatever frame stands on it — the
     * hand's discard or the Parliament's vote step, each its own full-stage
     * zone (a frame hosts one step at a time; the stack says which).
     */
    frameSlotSelector(): string {
      if (this.parliamentStepHosted) {
        return '[data-embed-slot="colonies-parliament"]';
      }
      return this.handSlotSelector;
    },
    /** The discard cinematic's tray is standing in our seat right now. */
    trayStanding(): boolean {
      return cardDiscardState.trayVisible && cardDiscardColonyBonus() !== undefined;
    },
    /** The seat stands through the pick, the flight and as the receipt. */
    discardSeatLive(): boolean {
      return this.handStepHosted || cardDiscardColonyBonus() !== undefined ||
        (this.revealEmbedActive && this.resolutionUi.discarded > 0);
    },
    /**
     * THE RESOLUTION IS SET ASIDE — its whole chain (colonies ⊃ hand) lives in
     * the PARK, and THIS mount is a lateral browse visit the player made from
     * the wheel. The visit must not adopt the parked flow's presentation: the
     * claim, the discard-stage yield and the resolution crumb all belong to
     * the parked chain (its way back is the board-home restore card). Without
     * this gate the visit rendered the parked claim's crumb «ПЛУТОН › ДОБОР
     * КАРТ» over a yielded (empty) browse — the reported blank screen.
     */
    resolutionParked(): boolean {
      return workspaceFrameParked('colonies');
    },
    // ── The embedded-outcome zone (the Pluto payout reveal) ────────────────
    /** The claim is ours — the zone must stand (rendered from SUBMIT time).
     *  OURS means the LIVE chain's: a parked resolution keeps its claim, and
     *  a browse visit beside it must not stand the zone up (see above). */
    revealEmbedActive(): boolean {
      return this.outcomeState.host === 'colonies' && !this.resolutionParked;
    },
    /** The reveal is genuinely ON SCREEN inside the zone — the grid yields. */
    revealEmbedPresenting(): boolean {
      return this.revealEmbedActive && this.outcomeState.stage === 'presenting';
    },
    /**
     * The FOCUS STAGE hosts the follow-up while it stands — this is the
     * TELEPORT TARGET's existence, and nothing else. It must be true from
     * SUBMIT time (a teleport whose target does not exist yet drops its
     * content), which is precisely why it may not also mean «the follow-up is
     * on screen»: an owned-but-empty zone that paints itself is the empty
     * dimmed box a colony with no payout used to stand.
     */
    focusOutcomeZone(): boolean {
      return this.revealEmbedActive && this.focusState.open;
    },
    /**
     * THE ONE SLOT SELECTOR. Two elements can host the follow-up — the focus
     * stage's own zone (while the player is inside a colony) and the
     * section's zone (after the stage folded, e.g. a payout that returns from
     * a hand discard). Exactly ONE writer decides which, so the two can never
     * both claim the teleport and drop its content.
     *
     * DURING THE FULL-STAGE DISCARD the selector is EMPTY on purpose: the
     * next cycle's batch can ride the very response that answered the
     * discard, and presenting it while the hand still owns the room would
     * stack two scenes. An empty slot HOLDS the claimed reveal (render
     * nowhere — embed rule 4's provably-transient gap); the focus restore
     * republishes and the batch opens on the big stage.
     */
    outcomeSlotSelector(): string {
      if (!this.revealEmbedActive || this.resolutionUi.discardStage) {
        return '';
      }
      // THE DOSSIER PUBLISHES NO ZONE. Named here while the inspect
      // composition stood, the focus-reveal selector pointed at a node that
      // did not exist, and the teleport degraded to a bare child of the root
      // — the card-target picker floated over the planet with a raw title
      // (2026-09-28). The dossier folds on the claim's rising edge (below),
      // and until it has, the slot stays EMPTY (render nowhere for the gap).
      if (this.focusState.open && this.focusState.intent === 'inspect') {
        return '';
      }
      return this.focusState.open ?
        '[data-embed-slot="colonies-focus-reveal"]' :
        '[data-embed-slot="colonies-reveal"]';
    },
    // ── The FLEET DOCKS (the «ПРИЧАЛЫ» column — fleetDockModel) ────────────
    /** The cursor stands on a dock (the column exists and the zone is active). */
    dockCursorOn(): boolean {
      return this.dockCursor.active && this.docks.length > 0;
    },
    viewerPlayer(): PublicPlayerModel | undefined {
      return this.players.find((p) => p.color === this.viewerColor);
    },
    /** The viewer's free fleets — the same arithmetic as the fleet dock's chips. */
    viewerFreeFleets(): number {
      return this.viewerPlayer === undefined ? 0 : this.freeFleetsFor(this.viewerPlayer);
    },
    /** Every destination the OPEN window offers: the colonies and the available docks. */
    tradeWindowDestinations(): ReadonlyArray<string> {
      const docks = this.docks.filter((d) => d.offer?.available === true).map((d) => d.card as string);
      return [...this.tradeable, ...docks];
    },
    focusedDock(): FleetDockView | undefined {
      return this.dockCursorOn ? this.docks[Math.min(this.dockCursor.index, this.docks.length - 1)] : undefined;
    },
    /** The focused dock's ONE reason (its tile's refusal), translated; '' when it is a destination. */
    focusedDockReason(): string {
      const dock = this.focusedDock;
      if (dock === undefined) {
        return '';
      }
      const status = this.dockTileStatus(dock);
      return status.kind === 'free' ? '' : translateText(status.text);
    },
    /** What the trade brings — the marker's chips (the server's `current → resulting`). */
    focusedDockChips(): ReadonlyArray<ActionEffect> {
      return this.focusedDock?.offer?.effects ?? [];
    },
    focusDockView(): FleetDockView | undefined {
      const card = this.focusState.dock;
      return card === '' ? undefined : this.docks.find((d) => d.card === card);
    },
    /** The server offers this dock right now (the pick's marker — never derived here). */
    focusDockAvailable(): boolean {
      return this.focusDockView?.offer?.available === true;
    },
    focusDockReason(): ColonyTradeReason | undefined {
      const dock = this.focusDockView;
      return dock === undefined || this.focusDockAvailable ? undefined : fleetDockReason(dock, this.dockReasonInput(this.myTurn, this.awaitingInput));
    },
    /** The stage's ONE reason (an English key — the colony ladder's, the turn included). */
    focusDockBlockReason(): string {
      if (this.focusDockAvailable || this.focusDockView === undefined) {
        return '';
      }
      return this.focusDockReason?.key ?? 'Trade unavailable';
    },
    focusDockBlockTone(): 'warning' | 'danger' {
      return this.focusDockReason?.blocker.tone === 'warning' ? 'warning' : 'danger';
    },
    // ── The focus stage's inputs ───────────────────────────────────────────
    focusColonyModel(): ColonyModel | undefined {
      if (this.focusState.colonyName === '') {
        return undefined;
      }
      const found = this.focusModelOnRail;
      // A REMOVAL of one's own (the solo trim): the answer takes the stage's tile OFF the table while the stage is
      // still saying goodbye to it — the model it stood on is kept until the roster flow ends.
      return found ?? (this.rosterBusy ? this.focusModelLatch : undefined);
    },
    /** The stage's colony as it stands on the rail right now (undefined once the table lost it). */
    focusModelOnRail(): ColonyModel | undefined {
      return this.focusState.colonyName === '' ? undefined : this.colonies.find((c) => c.name === this.focusState.colonyName);
    },
    /** A roster change of the player's own is on the wire, playing, or being read as a receipt. */
    rosterBusy(): boolean {
      return this.rosterState.armed !== undefined || this.rosterState.live || this.rosterState.receipt !== undefined;
    },
    focusTradeable(): boolean {
      const model = this.focusColonyModel;
      return this.pick === undefined && model !== undefined && this.tradeable.includes(model.name);
    },
    /** The focused intent's action is genuinely offerable (server truth):
     *  trade → the trade window names this colony; build/pick → the server's
     *  SelectColony accepts it. Inspect never acts. */
    focusActionAvailable(): boolean {
      const model = this.focusColonyModel;
      if (model === undefined) {
        return false;
      }
      if (this.focusState.intent === 'trade') {
        return this.focusTradeable;
      }
      if (this.focusState.intent === 'build' || this.focusState.intent === 'pick' || this.focusState.intent === 'track' || this.focusState.intent === 'roster' || this.focusState.intent === 'city') {
        return this.pick !== undefined && this.pick.selectable.includes(model.name);
      }
      return false;
    },
    /**
     * THE STAGE'S COMPOSITION for the act. A ROSTER act wears the build's (the berths first, the destination
     * pulsing — a colony lands by the same answer) or the plain pick's, and carries its own reading beside it.
     */
    stageIntent(): ColonyFocusIntent {
      // A CITY act wears the plain pick's composition (a short panel, no configuration; the working half stands as
      // it is — the city touches none of it) and carries its own reading beside it (`stageCity`).
      if (this.focusState.intent === 'city') {
        return 'pick';
      }
      if (this.focusState.intent !== 'roster') {
        return this.focusState.intent;
      }
      return this.stageRoster?.reading.build?.lands === true ? 'build' : 'pick';
    },
    /** The roster act as the stage reads it — pinned at the press (the answer takes the prompt away mid-ceremony). */
    stageRoster(): ColonyRosterStageView | undefined {
      if (this.focusState.intent !== 'roster') {
        return undefined;
      }
      const roster = this.pick?.roster;
      const model = this.focusColonyModel;
      if (roster === undefined || model === undefined) {
        return this.rosterStageLatch;
      }
      const name = model.name as ColonyName;
      const kind = roster.prompt.kind;
      const leaves = kind === 'remove' ? name : roster.outgoing;
      const copy = ROSTER_KIND_COPY[kind];
      return {
        kind,
        leaves,
        reading: rosterStageReading(roster.prompt, leaves, kind === 'remove' ? undefined : name, (colony) => colonyCardResources(getColony(colony))),
        // A STAGED door's A is the PLAY's one submit — it speaks the play's verb; a live door the roster's own.
        verbKey: this.pick?.staged === true ? 'Play card' : copy.verb,
        stageKey: copy.stage,
      };
    },
    /** The server's projected move of the focused colony (a `track` pick only — TR07). */
    focusTrackMove(): ColonyTrackMove | undefined {
      const model = this.focusColonyModel;
      return model === undefined ? undefined : trackMoveOf(this.pick?.trackMoves, model.name);
    },
    /**
     * THE ACT BEHIND THE DOSSIER'S A — the same derivation the grid's A makes
     * (`confirmColonySelection`): a server SelectColony pick outranks the
     * trade; without a pick the act is the trade.
     */
    inspectActIntent(): ColonyFocusIntent {
      if (this.pick !== undefined) {
        return colonyPickIntent(this.pick);
      }
      return 'trade';
    },
    /** …and whether it is genuinely offerable for the inspected colony (the
     *  stage's own `focusActionAvailable`, asked about the dossier's act). */
    inspectActionAvailable(): boolean {
      const model = this.focusColonyModel;
      if (model === undefined) {
        return false;
      }
      if (this.inspectActIntent === 'trade') {
        return this.pick === undefined && this.tradeable.includes(model.name);
      }
      return this.pick !== undefined && this.pick.selectable.includes(model.name);
    },
    inspectBlockReason(): string {
      const model = this.focusColonyModel;
      if (this.inspectActionAvailable || model === undefined) {
        return '';
      }
      if (this.pick !== undefined) {
        return this.inspectActIntent === 'trade' ? 'Trade unavailable' : this.pickReasonFor(model.name);
      }
      return this.reasonFor(model);
    },
    inspectBlockTone(): 'warning' | 'danger' {
      if (this.inspectActionAvailable || this.pick !== undefined || this.focusColonyModel === undefined) {
        return 'danger';
      }
      return this.blockerFor(this.focusColonyModel)?.tone ?? 'danger';
    },
    focusBlockReason(): string {
      if (this.focusActionAvailable) {
        return '';
      }
      const model = this.focusColonyModel;
      if (model === undefined) {
        return '';
      }
      if (this.pick !== undefined) {
        // A pick refused THIS colony: the server's own reason.
        if (this.focusState.intent === 'build' || this.focusState.intent === 'pick' || this.focusState.intent === 'track' || this.focusState.intent === 'roster' || this.focusState.intent === 'city') {
          return this.pickReasonFor(model.name);
        }
        // Mid-pick the trade window simply is not open — the stage's verdict
        // states that plainly rather than inventing a colony-intrinsic fault.
        return 'Trade unavailable';
      }
      return this.reasonFor(model);
    },
    /**
     * The stage verdict's REGISTER. A trade blocked only by the turn is legal in
     * every rule sense — it wears «НЕ СЕЙЧАС», not the red ✕ that says the
     * colony refused the player. Read from the shared blocker model, never from
     * the reason's text.
     */
    focusBlockTone(): 'warning' | 'danger' {
      if (this.focusActionAvailable || this.pick !== undefined || this.focusColonyModel === undefined) {
        return 'danger';
      }
      return this.blockerFor(this.focusColonyModel)?.tone ?? 'danger';
    },
    // ── Focused-colony compact rail (mirrors ConsoleColonyTile's reward/bonus
    //    logic so the readout can never disagree with the tile). ──
    focusedMeta(): ColonyMetadata | undefined {
      const colony = this.colonies[this.index];
      return colony === undefined ? undefined : getColony(colony.name);
    },
    focusedPosition(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusedMeta === undefined) {
        return 0;
      }
      const offset = colony.isActive ? this.tradeOffset : 0;
      // The PRESENTED colony — mid-trade the committed track reset stays
      // frozen behind the transaction (same helper the tile reads), so the
      // rail readout can never leak the new position early.
      return effectiveTradePosition(presentedColonyModel(colony), this.focusedMeta, offset);
    },
    focusedTrackMax(): number {
      return this.focusedMeta === undefined ? 0 : this.focusedMeta.trade.quantity.length - 1;
    },
    focusedOffset(): number {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return 0;
      }
      return Math.max(0, this.focusedPosition - Math.min(presentedColonyModel(colony).trackPosition, this.focusedTrackMax));
    },
    focusedReward(): TradeRewardAt {
      return rewardAtPosition(this.focusedMeta as ColonyMetadata, this.focusedPosition);
    },
    focusedTradeBenefit(): {type: ColonyMetadata['trade']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = (this.focusedMeta as ColonyMetadata).trade;
      const resource = Array.isArray(t.resource) ? t.resource[this.focusedPosition] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    focusedColonyBenefit(): {type: ColonyMetadata['colony']['type'], quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = (this.focusedMeta as ColonyMetadata).colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    focusedBonusQty(): number {
      return this.focusedMeta === undefined ? 1 : (this.focusedMeta.colony.quantity ?? 1);
    },
    focusedTrackDisplay(): string {
      const colony = this.colonies[this.index];
      if (colony === undefined) {
        return '';
      }
      return `${Math.min(presentedColonyModel(colony).trackPosition, this.focusedTrackMax) + 1}/${this.focusedTrackMax + 1}`;
    },
    focusedStatus(): ConsoleColonyTileStatus {
      const colony = this.colonies[this.index];
      return colony === undefined ? {kind: 'none', text: ''} : this.tileStatus(colony);
    },
    /**
     * THE ONE POSITIVE FACT the rail's blocked arm stands on: this colony has
     * a real, named blocker. `tileStatus` produces exactly two such kinds
     * (`blocked` / `inactive`) and both carry their text by construction —
     * `none` ("nothing to report") and `ok` (a live transaction beat) are not
     * blockers and must never route here. Reading it as `kind !== 'ok'`
     * silently made every ordinary browse frame "blocked", which is how a
     * colony the server was actively offering announced «Торговля
     * недоступна» while the player was choosing it.
     */
    railBlocked(): boolean {
      return this.focusedStatus.kind === 'blocked' || this.focusedStatus.kind === 'inactive';
    },
    /** Settlement OWNERS on the focused colony — the recipients of the colony
     *  bonus when anyone trades here (empty ⇒ the bonus goes to no one). */
    focusedOwners(): ReadonlyArray<Color> {
      return this.colonies[this.index]?.colonies ?? [];
    },
    /** Which rail the compact readout shows: a SelectColony pick titled
     *  'Build' grants a settlement + placement bonus (NOT trade); other picks
     *  are identity-only; no pick ⇒ the trade rail. */
    railMode(): 'trade' | 'build' | 'select' | 'track' | 'roster' | 'city' {
      if (this.pick === undefined) {
        return 'trade';
      }
      const intent = colonyPickIntent(this.pick);
      if (intent === 'build' || intent === 'track' || intent === 'roster' || intent === 'city') {
        return intent;
      }
      return 'select';
    },
    /** «будет снята · на её место — плитка из резерва (N)» — what choosing the focused tile to leave does. */
    rosterLeaveNote(): string {
      const roster = this.pick?.roster;
      if (roster === undefined) {
        return '';
      }
      const reserve = roster.prompt.incoming?.length ?? 0;
      return roster.prompt.kind === 'remove' ? translateText('leaves the game') :
        translateTextWithParams('leaves the game · a reserve tile takes its place (${0})', [String(reserve)]);
    },
    /** The focused tile's projected move, read for the rail (a `track` pick's candidate only). */
    focusedTrackReading(): ColonyTrackMoveReading | undefined {
      const colony = this.colonies[this.index];
      const move = colony === undefined ? undefined : trackMoveOf(this.pick?.trackMoves, colony.name);
      return move === undefined || this.focusedMeta === undefined ? undefined : colonyTrackMoveReading(this.focusedMeta, move);
    },
    /** The berth a new settlement lands in — the ONE reading (`colonyBerths.nextBuildSlot`), never a clamp. */
    focusedBuildSlot(): number {
      const colony = this.colonies[this.index];
      return colony === undefined ? 0 : nextBuildSlot(colony, buildSiteOf(this.pick?.buildSites, colony.name));
    },
    /** «Место 4 · сверх лимита» — the focused candidate's berth lies beyond the printed limit (the server's `buildSites`); '' otherwise. */
    focusedOverLimitText(): string {
      const colony = this.colonies[this.index];
      const site = colony === undefined ? undefined : buildSiteOf(this.pick?.buildSites, colony.name);
      return site !== undefined && site.overLimit && this.isPickable(site.colony) ?
        translateTextWithParams('Berth ${0} · over the limit', [String(site.slot + 1)]) : '';
    },
    /** The bonus that berth pays, resolved for a glyph (a list of one — read with `idx: 0`). */
    focusedBuildBenefit(): BerthBenefit {
      return berthBuildBenefit(this.focusedMeta as ColonyMetadata, this.focusedBuildSlot);
    },
    /** How many PRINTED berths are still free on the focused tile (never negative). */
    focusedFreeBerths(): number {
      const colony = this.colonies[this.index];
      return colony === undefined ? 0 : freeBerths(colony);
    },
    focusedBuildQty(): number {
      return this.focusedMeta === undefined ? 0 : buildBenefitAt(this.focusedMeta, this.focusedBuildSlot).quantity;
    },
    /** A card-resource TRADE reward with no card to hold it ⇒ it is lost —
     *  read at the position the trade would pay (the Redux Pluto: data low,
     *  cards high — only the data positions can be lost). */
    focusedTradeLost(): boolean {
      return this.focusedMeta !== undefined &&
        this.benefitResourceLost(rewardAtPosition(this.focusedMeta, this.focusedPosition).type);
    },
    /** A card-resource BUILD (placement) bonus with no card to hold it ⇒ lost
     *  (the placement bonus is a card resource — e.g. Miranda's animals). */
    focusedBuildLost(): boolean {
      return this.focusedMeta !== undefined && this.benefitResourceLost(this.focusedMeta.build.type);
    },
  },
  watch: {
    /** The bar reads the ONE receipt reading (it states the result while the grid takes no verb). */
    receiptOn: {
      immediate: true,
      handler(on: boolean): void {
        consoleColoniesUi.receipt = on;
      },
    },
    /**
     * A CLAIMED ARTIFACT ARRIVES WHILE THE DOSSIER STANDS (a late card-target
     * pick, a reveal): the dossier is a READING and hosts nothing, so it folds
     * to the grid and the section's own zone takes the artifact — never a
     * picker teleported at a zone the dossier does not have.
     */
    revealEmbedActive(on: boolean): void {
      if (on && this.focusState.open && this.focusState.intent === 'inspect') {
        closeColonyFocus();
      }
    },
    grantColony: {
      immediate: true,
      handler(name: string): void {
        if (name !== '') {
          this.grantSubject = name;
        }
      },
    },
    parliamentStepHosted(hosted: boolean): void {
      if (!hosted) {
        this.grantSubject = '';
      }
    },
    index() {
      void this.$nextTick(() => this.scrollSelectedIntoView());
    },
    // THE ROSTER FLOW'S LATCHES: what the stage stood on, kept past the answer that takes it away (the prompt,
    // and — for a removal — the tile itself). Dropped when the flow is over and the stage is closed.
    focusModelOnRail: {
      immediate: true,
      handler(model: ColonyModel | undefined): void {
        if (model !== undefined) {
          this.focusModelLatch = model;
        }
      },
    },
    stageRoster: {
      immediate: true,
      handler(view: ColonyRosterStageView | undefined): void {
        if (view !== undefined && this.pick?.roster !== undefined) {
          this.rosterStageLatch = view;
        }
      },
    },
    rosterBusy(busy: boolean): void {
      if (!busy && !this.focusState.open) {
        this.focusModelLatch = undefined;
        this.rosterStageLatch = undefined;
      }
    },
    stageCity: {
      immediate: true,
      handler(view: ColonyCityStageView | undefined): void {
        if (view !== undefined && this.pick?.tileSite !== undefined) {
          this.cityStageLatch = view;
        }
      },
    },
    'cityState.receipt'(receipt: ColonyCityReceipt | undefined): void {
      if (receipt !== undefined && this.cityDoorStands) {
        this.cityReceiptLatch = {...receipt};
      }
    },
    'buildState.receipt'(receipt: ColonyBuildReceipt | undefined): void {
      if (receipt !== undefined && this.buildDoorStands) {
        this.buildReceiptLatch = {...receipt};
      }
    },
    buildDoorStands(stands: boolean): void {
      if (!stands) {
        this.buildReceiptLatch = undefined;
      }
    },
    cityDoorStands(stands: boolean): void {
      if (!stands) {
        this.cityReceiptLatch = undefined;
      }
    },
    cityAnswered(answered: boolean): void {
      if (!answered && !this.focusState.open) {
        this.cityStageLatch = undefined;
      }
    },
    'focusState.open'(open: boolean): void {
      // A watcher's landing was measured on the surface that has just changed — it ends in its final poses.
      endWatchedColonyCity();
      if (!open && !this.rosterBusy) {
        this.focusModelLatch = undefined;
        this.rosterStageLatch = undefined;
      }
      if (!open && !this.cityAnswered) {
        this.cityStageLatch = undefined;
      }
    },
    /**
     * HAND THE CRUMB UP. Embedded, this section draws no header of its own —
     * the host does, and the host's subject slot is already spent on the card
     * that opened us. So the colony and its stage travel up as the FRAME's own
     * subject + stage and the host folds them into one tail («ГАНИМЕД ·
     * ТОРГОВЛЯ»). Publishing the pair rather than a finished phrase keeps the
     * grammar in the header, where it belongs, and keeps both parts i18n keys.
     */
    embeddedCrumb: {
      immediate: true,
      handler(crumb: {embedded: boolean, subject: string, stage: string}) {
        // A NESTED FRAME HANDS ITS STAGE UP whether it is teleported into the
        // host's zone or standing on the whole scene: both are steps of the
        // flow below, and the crumb is derived from the STACK either way. Keyed
        // on «am I nested», not on «am I embedded» — the second is a rendering
        // detail and it silently stopped the tail from advancing the moment a
        // host chose to hand the scene over instead of lending a zone.
        if (!crumb.embedded && workspaceFrameIndex('colonies') <= 0) {
          return;
        }
        setWorkspaceFrameSubject('colonies', crumb.subject);
        // A screen with no stage of its own yet (the plain pick, before a colony is picked up) KEEPS the name
        // the door pushed for it — «КОЛОНИИ» for the sitting's own step, «ВЫБОР КОЛОНИИ» everywhere else (the
        // stage the prompt's source decides, `followUpStepStage`); overwriting it made the tail say two things.
        setWorkspaceFrameStage('colonies', crumb.stage !== '' ? crumb.stage : (workspaceFrameStage('colonies') || 'Colony selection'));
      },
    },
    layout() {
      this.scheduleFit();
    },
    colonies() {
      this.scheduleFit();
    },
    // The focus stage's server preview follows the descended-into colony.
    'focusState.colonyName'(name: ColonyName | '') {
      this.focusPreview = undefined;
      this.focusPathOffset = 0;
      if (name !== '') {
        void this.loadFocusPreview(name);
      }
    },
    // The DOCK stage's preview follows the descended-into card — and the state.
    'focusState.dock'(card: string) {
      this.dockPreview = undefined;
      if (card !== '') {
        void this.loadDockPreview(card);
      }
    },
    // …and follows the GAME STATE: a response that moved the world (an undo,
    // a mid-turn effect) re-pulls the preview for the SAME colony, so the
    // stage's candidate lists — and through them every captured pick — are
    // re-validated against current truth instead of a snapshot. Quiet while
    // the trade is resolving: the commit-boundary freeze owns that window,
    // and the transaction's own conclusion folds the stage anyway.
    viewVersion() {
      const name = this.focusState.colonyName;
      if (name !== '' && !colonyTradeState.active) {
        void this.loadFocusPreview(name);
      }
      // The dock's preview is a verdict about the whole state: re-asked on every
      // move (the stage pins its receipt at the commit, so the answer's re-pricing
      // never reaches a trade already on the wire).
      if (this.focusState.dock !== '') {
        void this.loadDockPreview(this.focusState.dock);
      }
    },
    docks() {
      this.scheduleFit();
    },
    // OWNERSHIP ≠ READINESS (embed rule 4): publish the zone's selector only
    // once the element genuinely stands (`flush: 'post'`), retract before it
    // unmounts. The teleport's target must exist before Vue resolves it.
    outcomeSlotSelector: {
      flush: 'post',
      handler(selector: string): void {
        setWorkspaceOutcomeSlot(selector);
      },
    },
    // The HOSTED STEP's teleport target (the hand's discard, the Parliament's
    // vote) — same law, the STACK channel: the frame below publishes the zone
    // the frame above teleports into.
    frameSlotSelector: {
      flush: 'post',
      handler(selector: string): void {
        setWorkspaceFrameSlot('colonies', selector);
      },
    },
    // THE RESOLUTION'S FALLING EDGE auto-folds the focus stage back to the
    // overview: the trade (fleet → waves → payout → glide → settle) or the
    // build (cube seated, grant delivered) completed ON the stage — the fold
    // is the completion's own signal, never a timer. The updated overview
    // (new track position, the seated cube, the docked fleet) is what the
    // fold reveals. Embedded flows fold through their own latch finalize.
    'tradeState.active'(active: boolean, was: boolean): void {
      if (!active && was && this.focusState.open && !this.tradeFleetState.active) {
        this.completeFlow();
      }
    },
    'buildState.active'(active: boolean, was: boolean): void {
      if (!active && was && this.focusState.open) {
        this.completeFlow();
      }
    },
    /** A claimed FOLLOW-UP owned the screen; it has now released. THAT is the
     *  moment the whole action is over, so the completion runs here instead
     *  of at the transaction's edge (which fired while the payout was still
     *  standing). */
    'outcomeState.sourceCard'(now: string, was: string): void {
      if (now === '' && was !== '' && this.focusState.open &&
          !this.tradeState.active && !this.buildState.active) {
        this.completeFlow();
      }
    },
    /** …and the same for the PRESENTED CARD scene: its release is the last
     *  physical beat of a card-resource payout, so the completion belongs to
     *  its falling edge exactly as it belongs to the claim's. */
    'resolutionUi.cardSceneLive'(now: boolean, was: boolean): void {
      if (!now && was && this.focusState.open &&
          !this.tradeState.active && !this.buildState.active) {
        this.completeFlow();
      }
    },
  },
  methods: {
    /**
     * The SERVER's refusal of `colony` for the viewer — the colony's own rule
     * about the player (`PublicPlayerModel.colonyTradeBlocks`), the one rung
     * of the ladder the client could never derive honestly.
     */
    serverColonyBlock(colony: ColonyModel): string | undefined {
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      return viewer?.colonyTradeBlocks?.find((b) => b.colony === colony.name)?.reason;
    },
    /** A card-resource benefit (`ADD_RESOURCES_TO_CARD` / `…_VENUS_CARD`) is
     *  LOST when the viewer owns no card able to hold that resource — shared
     *  by the trade + build rails (and mirrored at the focus stage). */
    benefitResourceLost(type: ColonyBenefit): boolean {
      // The holders of ANY of the tile's kinds (the WARE wildcard included).
      const kinds = this.cardResourceKinds;
      if (kinds.length === 0) {
        return false;
      }
      if (type !== ColonyBenefit.ADD_RESOURCES_TO_CARD && type !== ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
        return false;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      return !holdsAnyOf(viewer?.tableau ?? [], kinds);
    },
    /**
     * Size the tiles to FILL the free area for the count layout: the largest
     * uniform scale at which `cols × rows` base-size tiles (+ gaps + padding)
     * fit the scroll box, clamped to sane bounds. Applied as a `zoom` on every
     * tile (so the planet / docked fleet / fonts all grow together) plus a grid
     * max-width so the intended columns hold. Pure measure → no-op under JSDOM
     * (rects are 0), so the CSS base size is the graceful fallback.
     */
    /**
     * THE HOST'S SOURCE SEAT, RESERVED ONCE FOR THIS WHOLE SURFACE.
     *
     * A step hosted inside a workspace can stand BESIDE the card that caused it
     * («ПОВТОР ДЕЙСТВИЯ · Летающая платформа» on the Hydronetwork's stage 7).
     * The seat is `position: absolute` on purpose — context must not shrink the
     * thing it is context for — which means a guest laid out against the raw
     * zone simply renders UNDER it: the repeated trade drew its colony grid,
     * and then its focus stage's whole left column, beneath the card that was
     * explaining why it was being asked at all.
     *
     * Reserved as a PADDING on this surface's root, not inside one of its
     * layouts: the colonies have two (the grid and the focus stage) and both
     * were wrong. One reserve at the root is a property of the SURFACE, so a
     * third layout inherits it, and the grid fit needs no arithmetic — it reads
     * `clientWidth`, which the padding has already narrowed.
     *
     * BOTH sides, because what it contains is centred: that is what makes the
     * overlap inexpressible rather than merely unlikely, at any focus scale.
     * The measurement is the shared one (`sourceSeatReservePx`, off the seat's
     * real box) — never a second copy of the seat's own CSS width.
     */
    fit(): void {
      this.fitDocks();
      const scroll = this.$refs.scroll as HTMLElement | null | undefined;
      const root = this.$el as HTMLElement | null | undefined;
      const count = this.colonies.length;
      if (scroll === undefined || scroll === null || root === undefined || root === null || count === 0) {
        return;
      }
      // ── THE HOST'S SOURCE SEAT IS NOT FREE WIDTH ────────────────────────
      // A step hosted inside a workspace can stand BESIDE the card that caused
      // it («ПОВТОР ДЕЙСТВИЯ · Летающая платформа» on the Hydronetwork's stage
      // 7). The seat is `position: absolute` on purpose — context must not
      // shrink the thing it is context for — so a guest laid out against the
      // raw zone renders UNDER it: the repeated trade drew its colony grid, and
      // then its focus stage's whole left column, beneath the very card that
      // was explaining why it was being asked.
      //
      // Reserved as a PADDING on this surface's ROOT, not inside one of its
      // layouts: the colonies have two (the grid and the focus stage) and both
      // were wrong. At the root it is a property of the SURFACE, so a third
      // layout inherits it and the arithmetic below needs no term — the
      // `clientWidth` it reads has already been narrowed. BOTH sides, because
      // what it holds is centred: that is what makes the overlap inexpressible
      // rather than merely unlikely, at any focus scale. The measurement is the
      // SHARED one (off the seat's real box), never a copy of its CSS width.
      // ⚠️ ONLY WHEN TELEPORTED INTO A HOST'S ZONE. `sourceSeatReservePx` asks
      // the DOCUMENT for a seat, so a surface that is NOT inside one would
      // reserve room for somebody else's furniture — and since a host that
      // hands the whole scene over keeps its box (`visibility`, not `display`),
      // its seat still measures. Scoped to `embedded`, the question is only
      // ever asked where the answer is about this surface's own room.
      //
      // …and the re-solve is gated on a WHOLE pixel of change: this branch
      // returns without fitting, so a sub-pixel jitter would re-schedule
      // forever and the fit would never land.
      const seat = this.embedded ? Math.round(sourceSeatReservePx(conUiScale())) : 0;
      if (Math.abs(seat - this.seatReservePx) >= 1) {
        this.seatReservePx = seat;
        // The padding it just published is what the room below is measured
        // against — solve on the next frame, against the narrowed box.
        this.scheduleFit();
        return;
      }
      const availW = scroll.clientWidth;
      const availH = scroll.clientHeight;
      if (availW <= 0 || availH <= 0) {
        return; // not laid out yet / JSDOM / parked behind the focus stage
      }
      const cs = getComputedStyle(root);
      // The base-size vars are rem-authored (TV logical space) — resolve
      // them properly; a bare parseFloat would read "18.3rem" as 18.3px
      // and collapse the whole grid fit.
      const baseW = cssLengthPx(cs.getPropertyValue('--coltile-base-w'), 366);
      const baseH = cssLengthPx(cs.getPropertyValue('--coltile-base-h'), 220);
      const cols = Math.min(Math.max(1, colonyGridCols(this.layout, count)), count);
      const rows = Math.max(1, Math.ceil(count / cols));
      // The CSS grid gaps/padding are rem-authored (they scale with the TV
      // profile); these constants mirror them, so they must scale too. The
      // tile scale itself stays relative — baseW/baseH come from the CSS
      // vars via getComputedStyle, already in scaled px.
      const s = conUiScale();
      const slack = FIT_SLACK * s;
      // (The host's SOURCE SEAT is already out of `availW`: it is reserved as
      //  a padding on this surface's own root — see `seatReserveStyle` — so
      //  `scroll.clientWidth` is the room that is really free. One reserve,
      //  read by the grid and by the focus stage alike.)
      const scaleW = (availW - GRID_PAD_X * s - (cols - 1) * COL_GAP * s - slack) / (cols * baseW);
      const scaleH = (availH - GRID_PAD_Y * s - (rows - 1) * ROW_GAP * s) / (rows * baseH);
      const scale = Math.max(MIN_TILE_SCALE, Math.min(MAX_TILE_SCALE, Math.min(scaleW, scaleH)));
      this.tileScale = Math.round(scale * 1000) / 1000;
      // The cap gets the SAME slack on top — zoom-rounded tiles need the
      // room, and a whole extra column would need ~baseW, so the planned
      // column count still holds.
      this.gridMaxW = Math.ceil(cols * baseW * this.tileScale + (cols - 1) * COL_GAP * s + GRID_PAD_X * s + slack);
    },
    scheduleFit(): void {
      if (this.fitRaf !== undefined || typeof window === 'undefined') {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = undefined;
        this.fit();
      });
    },
    /**
     * How many of a player's fleets are truly FREE (in their supply, not
     * deployed). A fleet PHYSICALLY parked on a colony (its `visitor`) is OUT —
     * even when `usedTradeFleets` doesn't reflect it: the Automa sets colony
     * visitors DIRECTLY (AutomaColonies) without touching usedTradeFleets, so
     * `freeTradeFleets` alone showed a deployed bot fleet as a free ship (the
     * board's fleet-on-colony AND a home platform — the double-count bug). Take
     * the MORE restrictive of "used-trade-fleets" and "physically-deployed".
     */
    freeFleetsFor(player: PublicPlayerModel): number {
      const deployed = this.colonies.filter((c) => c.visitor === player.color).length;
      return Math.min(freeTradeFleets(player), Math.max(0, player.fleetSize - deployed));
    },
    isPickable(name: string): boolean {
      return this.pick !== undefined && this.pick.selectable.includes(name);
    },
    pickReasonFor(name: string): string {
      const reason = this.pick?.reasons[name];
      return reason !== undefined && reason !== '' ? reason : translateText('Unavailable right now');
    },
    /** The shared smart ladder's verdict for `colony` (undefined = tradeable). */
    tradeReasonFor(colony: ColonyModel): ColonyTradeReason | undefined {
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      return colonyTradeReason({
        colony,
        tradeable: this.tradeable,
        colonyBlock: this.serverColonyBlock(colony),
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: viewer !== undefined ? this.freeFleetsFor(viewer) : 0,
        myTurn: this.myTurn,
        awaitingInput: this.awaitingInput,
        resolveName: (color) => {
          const p = this.players.find((x) => x.color === color);
          return p !== undefined ? participantDisplayName(p) : '';
        },
      });
    },
    /** Its structured semantics (undefined = nothing blocks the trade). */
    blockerFor(colony: ColonyModel): AvailabilityBlocker | undefined {
      return this.tradeReasonFor(colony)?.blocker;
    },
    /** The full «why can't I trade here» reason for `colony` (translated). */
    reasonFor(colony: ColonyModel): string {
      const reason = this.tradeReasonFor(colony);
      if (reason === undefined) {
        return this.tradeBlockReason;
      }
      return reason.params !== undefined ?
        translateTextWithParams(reason.key, reason.params.map(String)) :
        translateText(reason.key);
    },
    tileStatus(colony: ColonyModel): ConsoleColonyTileStatus {
      // A ROSTER change is answered and playing / standing as its receipt: the grid is a RESULT — no tile is being
      // offered or refused any more (a staged door's prompt outlives the answer, and its «not pickable» is stale).
      if (this.rosterState.receipt !== undefined || this.cityAnswered || this.buildAnswered) {
        return {kind: 'none', text: ''};
      }
      // The trade transaction narrates its own beats on the traded tile —
      // a short unobtrusive caption in the EXISTING status line (never a
      // toast): reward → bonus → the colony update.
      const beat = colonyTradeTileStatusText(colony.name);
      if (beat !== undefined) {
        return {kind: 'ok', text: beat};
      }
      if (this.pick !== undefined) {
        // A RESERVE tile of a roster pick states HOW IT WOULD ENTER — the server's projection, never the bare
        // tile's own flag (a catalog model is serialized inactive whatever it is): active or not, and whether the
        // colony the effect builds would stand. The candidate stays selectable either way.
        const entry = this.pick.roster?.level === 'incoming' ? rosterIncomingOf(this.pick.roster.prompt, colony.name) : undefined;
        if (entry !== undefined) {
          const noColony = entry.build !== undefined && !rosterBuildLands(entry.build);
          const text = translateText(entry.entersActive ? 'Enters active' : 'Enters inactive') +
            (noColony ? ` · ${translateText('no colony')}` : '');
          return {kind: entry.entersActive ? 'ok' : 'inactive', text};
        }
        // A pickable colony is the NORMAL case in a pick — the focus ring and
        // the command bar already say so. Only a refusal earns a line.
        if (this.isPickable(colony.name)) {
          // …and what a CARD's build LIFTS on this candidate — calm, never a refusal: the berth beyond the
          // printed limit, or a second colony of one's own. The server's projection (`buildSites`), read as is.
          const site = this.buildDoorStands ? buildSiteOf(this.pick.buildSites, colony.name) : undefined;
          if (site !== undefined && site.overLimit) {
            return {kind: 'ok', text: translateText('Over the limit — by the card')};
          }
          if (site !== undefined && site.own > 0) {
            return {kind: 'ok', text: translateText('Second colony — by the card')};
          }
          return {kind: 'none', text: ''};
        }
        return {kind: 'blocked', text: this.pickReasonFor(colony.name)};
      }
      // ONE smart source of truth for «why can't I trade here» — shared with the
      // shell's trade-attempt notice (colonyTradeReason) so a tile and the notice
      // over it can never disagree. On the TILE only COLONY-INTRINSIC blockers
      // (not built / a fleet already docked) get a hard ✕; a turn/fleet/afford
      // block stays CALM (its reason surfaces on the A-press notice) — except a
      // window open for OTHER colonies, which keeps the explicit «Trade unavailable».
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const reason = colonyTradeReason({
        colony,
        tradeable: this.tradeable,
        colonyBlock: this.serverColonyBlock(colony),
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: viewer !== undefined ? this.freeFleetsFor(viewer) : 0,
        // Non-intrinsic reasons are DISCARDED on the tile (mapped by tradeable
        // length below), so the turn scalars don't affect the tile's output.
        myTurn: false,
        awaitingInput: false,
        resolveName: (color) => {
          const p = this.players.find((x) => x.color === color);
          return p !== undefined ? participantDisplayName(p) : '';
        },
      });
      if (reason === undefined) {
        // NORMAL. Five tiles each announcing «Доступна торговля» is five times
        // the same non-information; the exception is what the eye needs.
        return {kind: 'none', text: ''};
      }
      if (reason.intrinsic) {
        // The tile keeps the COMPACT «Not active yet»; the fuller reason.key
        // ('This colony is not active yet') is for the notice/inspect.
        if (!colony.isActive) {
          return {kind: 'inactive', text: translateText('Not active yet')};
        }
        const text = reason.params !== undefined ?
          translateTextWithParams(reason.key, reason.params.map(String)) :
          translateText(reason.key);
        return {kind: 'blocked', text};
      }
      // A window open for other colonies → name it; otherwise stay calm.
      if (this.tradeable.length > 0) {
        return {kind: 'blocked', text: translateText('Trade unavailable')};
      }
      return {kind: 'none', text: ''};
    },
    /** The ladder's input for a dock — the window's destinations, the viewer's free fleets, the turn. */
    dockReasonInput(myTurn: boolean, awaitingInput: boolean): FleetDockReasonInput {
      return {
        tradeable: this.tradeWindowDestinations,
        viewerColor: this.viewerColor ?? ('' as Color),
        availableFleets: this.viewerFreeFleets,
        myTurn,
        awaitingInput,
      };
    },
    /** A dock tile's status — the SAME ladder as a colony tile (the turn never reads on a tile). */
    dockTileStatus(dock: FleetDockView): FleetDockTileStatus {
      return fleetDockTileStatus(dock, this.dockReasonInput(false, false));
    },
    async loadDockPreview(card: string): Promise<void> {
      if (this.playerId === '') {
        return;
      }
      const seq = ++this.dockPreviewSeq;
      const preview = await fetchFleetDockPreview(this.playerId, card as FleetDockView['card']);
      if (seq === this.dockPreviewSeq && preview !== undefined && preview.card === this.focusState.dock) {
        this.dockPreview = preview;
      }
    },
    /**
     * Descend into the FOCUSED DOCK (A on its tile): the same phrase as a
     * colony — the tile's rect is the unfold's origin, and the CARD is the
     * carried object (its face FLIPs into the stage's hero, the descend
     * hooks reading it as the stage's carried identity).
     */
    enterDockFocus(): void {
      const dock = this.focusedDock;
      if (dock === undefined || this.focusState.open) {
        return;
      }
      const slot = this.$refs.selectedDock as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      const tile = el?.querySelector<HTMLElement>('.con-fleetdock-tile');
      const face = tile?.querySelector<HTMLElement>('[data-fleet-dock-face]');
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armColonyFocusOrigin(rectOf(tile), rectOf(face));
      openFleetDockFocus(dock.card);
    },
    /** The shell ACCEPTED the dock's confirm — the stage becomes its own receipt. */
    holdDockStage(): void {
      (this.$refs.dockStage as InstanceType<typeof ConsoleFleetDockStage> | undefined)?.holdPresentation();
    },
    /** A refused submit gives the dock's stage back as it was. */
    releaseDockStage(): void {
      (this.$refs.dockStage as InstanceType<typeof ConsoleFleetDockStage> | undefined)?.releasePresentation();
    },
    /**
     * THE DOCKS COLUMN'S FIT — the cards take the column's WIDTH and share its
     * HEIGHT (one face per dock, a status line under each); the column's width
     * is a token, so the planet grid's own fit measures what is left.
     */
    fitDocks(): void {
      const col = this.$refs.docksCol as HTMLElement | undefined;
      const n = this.docks.length;
      if (col === undefined || col === null || n === 0) {
        return;
      }
      const w = col.clientWidth;
      const h = col.clientHeight;
      if (w <= 0 || h <= 0) {
        return;
      }
      // EVERY term of the column is measured: its own padding (`clientHeight` includes it), the title, and per dock
      // the status line AND the tile's gap between face and status; the face's NATURAL box is its rendered box over
      // the zoom it was rendered at. Two of those were missing and the third was a literal (460 — the face is ≈467):
      // with three docks at 4K the last status line hung 22 px out of the column and was cut by its clip.
      const colStyle = getComputedStyle(col);
      const padY = (parseFloat(colStyle.paddingTop) || 0) + (parseFloat(colStyle.paddingBottom) || 0);
      const title = col.querySelector<HTMLElement>('.con-colonies__docks-title')?.offsetHeight ?? 0;
      const status = col.querySelector<HTMLElement>('.con-fleetdock-tile__status')?.offsetHeight ?? 0;
      const tile = col.querySelector<HTMLElement>('.con-fleetdock-tile');
      const tileGap = tile === null ? 0 : parseFloat(getComputedStyle(tile).rowGap) || 0;
      const gap = parseFloat(colStyle.rowGap) || 0;
      // (The zoom it was rendered at is read off the face itself, never `dockZoom`: a fit re-run before the patch
      // would divide the old box by the new zoom.)
      const faceEl = col.querySelector<HTMLElement>('.con-fleetdock-tile__face');
      const face = faceEl?.getBoundingClientRect();
      const rendered = faceEl === null ? NaN : parseFloat(getComputedStyle(faceEl).zoom);
      const measured = face !== undefined && face.width > 0 && face.height > 0 && rendered > 0;
      const naturalW = face !== undefined && measured ? face.width / rendered : 320;
      const naturalH = face !== undefined && measured ? face.height / rendered : 460;
      const perH = (h - padY - title - n * (status + tileGap + gap)) / n;
      const zoom = Math.min(w / naturalW, perH / naturalH);
      this.dockZoom = Math.max(0.2, Math.floor(zoom * 1000) / 1000);
    },
    scrollSelectedIntoView(): void {
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      el?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'});
    },
    // ── The COLONY FOCUS descend (browse → focus and back) ─────────────────
    /**
     * Descend into the FOCUSED colony (A = the act intent — trade / build /
     * pick, X = inspect — ONE stage either way; nothing irreversible happens
     * on the overview any more). Arms the descend origins SYNCHRONOUSLY at
     * the press: the tile's rect (the unfold source) plus the THREE carried
     * identities' rects — the planet medallion, the compact track strip and
     * the build-slot row — so each physically continues into its expanded
     * counterpart (never a new unrelated detail page).
     */
    /**
     * The colour of the city a «city» pick would lay on this tile ('' = no such door, or not a candidate) — the
     * server's `tileSite` marker. The seat itself stops reading it once the door is answered (`colonyCityAnswered`).
     */
    tileCityProjection(colony: ColonyModel): Color | '' {
      const site = this.pick?.tileSite;
      if (site === undefined || this.cityAnswered || !this.isPickable(colony.name)) {
        return '';
      }
      return site.color;
    },
    /**
     * The berth the projected cube would take — the server's (`buildSites` for a card's build door; a roster
     * build lands in the entering tile's own next berth).
     */
    tileProjectedCubeSlot(colony: ColonyModel): number {
      const site = this.buildDoorStands ? buildSiteOf(this.pick?.buildSites, colony.name) : undefined;
      if (site !== undefined) {
        return site.slot;
      }
      const build = this.pick?.roster?.level === 'incoming' ? rosterIncomingOf(this.pick.roster.prompt, colony.name)?.build : undefined;
      return rosterBuildLands(build) ? build.slot : 0;
    },
    /**
     * The colour of the colony a pick would BUILD on this tile ('' = none) — the server's projection: a roster
     * pick's reserve tile, or a candidate of a CARD's own build door (TR25 — its `buildSites`; the ghost stands in
     * the berth the marker names, the fourth on a tile at its limit). Never once the door is answered.
     */
    tileProjectedCube(colony: ColonyModel): string {
      if (this.buildDoorStands) {
        return !this.buildAnswered && this.isPickable(colony.name) && buildSiteOf(this.pick?.buildSites, colony.name) !== undefined ?
          (this.viewerColor ?? '') : '';
      }
      const roster = this.pick?.roster;
      if (roster === undefined || roster.level !== 'incoming') {
        return '';
      }
      return rosterBuildLands(rosterIncomingOf(roster.prompt, colony.name)?.build) ? (this.viewerColor ?? '') : '';
    },
    /**
     * THE LANDING's destination (the roster's own flow): the stage folds HOME into the slot `name` now holds on
     * the table — re-measured here, AFTER the grid's fit, at REST (the parked layer's recede transform is taken
     * off for the read and put back in the same task: nothing paints in between). `false` when the tile cannot
     * be measured — the fold then lets go where it stands.
     */
    retargetFocusHome(name: string): boolean {
      const grid = this.$refs.grid as HTMLElement | null | undefined;
      const tile = grid?.querySelector<HTMLElement>(`[data-test="con-colony-${name.replace(/["\\]/g, '\\$&')}"]`);
      const browse = (this.$el as HTMLElement | null)?.querySelector<HTMLElement>('.con-colonies__browse');
      if (tile === null || tile === undefined) {
        armColonyFocusQuickExit();
        return false;
      }
      const held = browse?.style.transform ?? '';
      if (browse !== null && browse !== undefined) {
        browse.style.transform = 'none';
      }
      const rect = restingRectOf(tile);
      if (browse !== null && browse !== undefined) {
        browse.style.transform = held;
      }
      if (rect.width < 10 || rect.height < 10) {
        armColonyFocusQuickExit();
        return false;
      }
      retargetColonyFocusHome(rect);
      return true;
    },
    /**
     * A ROSTER PICK CHANGES ITS LEVEL (the table ⇄ the reserve) — the rail's population changes, and that is
     * a RESEAT, never a swap: the tiles' content lets go, `apply` changes the level (the rail re-renders dark),
     * and the new tiles surface. Opacity only — text under a `zoom` never travels and never scales. The pad is
     * the beat's (`landing`); reduced motion and an unmeasurable grid apply at once.
     */
    async reseatRosterLevel(apply: () => void): Promise<void> {
      const grid = this.$refs.grid as HTMLElement | null | undefined;
      if (grid === undefined || grid === null || consoleReducedMotionActive() || this.rosterState.landing) {
        apply();
        return;
      }
      setColonyRosterLanding(true);
      try {
        await new Promise<void>((resolve) => {
          playReseatOut(grid, resolve);
        });
        apply();
        await this.$nextTick();
        const next = this.$refs.grid as HTMLElement | null | undefined;
        if (next !== undefined && next !== null) {
          await new Promise<void>((resolve) => {
            playReseatIn(next, null, resolve);
          });
        }
      } finally {
        setColonyRosterLanding(false);
      }
    },
    /** A removal's stage has nothing to fold into — it lets go where it stands. */
    releaseFocusInPlace(): void {
      armColonyFocusQuickExit();
    },
    enterFocus(intent: ColonyFocusIntent): void {
      const colony = this.colonies[this.index];
      if (colony === undefined || this.focusState.open) {
        return;
      }
      const slot = this.$refs.selectedSlot as HTMLElement | Array<HTMLElement> | undefined;
      const el = Array.isArray(slot) ? slot[0] : slot;
      const tile = el?.querySelector<HTMLElement>('.con-coltile');
      const planet = tile?.querySelector<HTMLElement>('.con-coltile__planet-berth');
      const track = tile?.querySelector<HTMLElement>('.con-coltile__track');
      const slots = tile?.querySelector<HTMLElement>('.con-coltile__build');
      // The CITY'S SEAT — the fifth carried object (its box is always laid out, an empty seat included).
      const seat = tile?.querySelector<HTMLElement>('.con-coltile__head [data-colony-city-seat]');
      if (intent === 'city' && workspaceFrameStage('colonies') !== COLONY_CITY_STAGE) {
        // The door's own name, kept for the way back (the stage is about to hand «ГОРОД» up over it).
        this.cityDoorStage = workspaceFrameStage('colonies');
      }
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armColonyFocusOrigin(rectOf(tile), rectOf(planet), rectOf(track), rectOf(slots), rectOf(seat));
      openColonyFocus(colony.name as ColonyName, intent);
    },
    /** Fold back to the browse surface (B / cancel) — PRE-commit only. */
    closeFocus(): void {
      closeColonyFocus();
    },
    /**
     * THE ACTION IS OVER. Give the scene a short breathing beat — the token
     * has just docked, the guard has just latched, the marker has just landed,
     * and folding on the same frame means the player never sees what changed —
     * then hand the screen FORWARD. Never back through the configuration
     * surface: a committed action does not travel backwards (the shell picks
     * the destination — the next unresolved effect, or the field).
     *
     * A live outcome CLAIM means a follow-up owns the screen; the completion
     * then belongs to the claim's own falling edge, not to this one.
     */
    completeFlow(): void {
      // A REWARD STILL ARRIVING ON A CARD IS THE ACT STILL HAPPENING. The
      // build's own transaction ends when the cube seats — its floaters are
      // still in the air — so routing home here tore the receiving card off
      // the screen mid-flight. The scene publishes its presence
      // (`cardSceneLive`, released by its own landing + read beat, with its
      // own bounded net), and the completion re-runs on that falling edge.
      if (this.completeTimer !== undefined || workspaceOutcomeClaimed() || this.resolutionUi.cardSceneLive) {
        return;
      }
      // A FLEET DOCK's trade owns its own ending: the dock's scene answers, reads and concludes the workspace
      // through the shell's ONE guarded conclusion (`onFleetDockFlowComplete`). A dock whose reward lands on a card
      // claims its `pick` (TR27), and that claim's release a tick after the answer used to fold the stage HERE —
      // mid-impulse, before a single token had left the card.
      if (this.focusState.dock !== '') {
        return;
      }
      // A CHOSEN TRACK's move (TR07) owns its own ending: the STAGED door ends with the play (the shell's
      // `endStagedColony`), and the move — owed or in flight — plays on THIS stage first. Folding here (the play's
      // own claim releasing a tick after the answer) sent the marker to the tile behind a closed stage.
      if (this.pick?.staged === true || this.trackMoveFlow.owed !== undefined || this.trackMoveFlow.live) {
        return;
      }
      // A ROSTER change owns its own ending too: the ceremony, then the LANDING into the slot, then the receipt's
      // read — the shell's `landColonyRoster` folds this stage home; nothing may fold it earlier.
      if (this.rosterBusy) {
        return;
      }
      // A CITY's landing (TR22) owns its own ending as well: the scene, then the stage folding HOME, then the
      // receipt's read — the shell's `landColonyCity`; nothing may fold the stage under the piece.
      if (this.cityAnswered) {
        return;
      }
      // …and a STAGED BUILD's (TR25): the cube, what its bonus still owes inside the stage, HOME, the receipt —
      // the shell's `landColonyBuild`.
      if (this.buildAnswered) {
        return;
      }
      this.completeTimer = window.setTimeout(() => {
        this.completeTimer = undefined;
        if (workspaceOutcomeClaimed() || !this.focusState.open || this.resolutionUi.cardSceneLive) {
          return;
        }
        closeColonyFocus();
        this.$emit('flow-complete');
      }, motionMs(COMPLETION_SETTLE_MS));
    },
    /** The stage confirmed the trade — hand the payload UP. The stage STAYS:
     *  the fleet, the reward waves, the Pluto reveal and the track glide all
     *  resolve on the stage's own live anchors (iteration 2), and the
     *  transaction's falling edge auto-folds back to the overview. */
    onFocusConfirm(payload: ColonyTradeConfirmPayload): void {
      this.$emit('trade-confirm', payload);
    },
    /** The shell routes the pad here while the focus stage — the action
     *  stage OR the dossier — is open. */
    handleFocusIntent(intent: GamepadIntent): void {
      if (this.focusState.dock !== '') {
        (this.$refs.dockStage as InstanceType<typeof ConsoleFleetDockStage> | undefined)?.handleIntent(intent);
        return;
      }
      if (this.focusState.intent === 'inspect') {
        const dossier = this.$refs.inspectStage as InstanceType<typeof ConsoleColonyInspect> | undefined;
        dossier?.handleIntent(intent);
        return;
      }
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.handleIntent(intent);
    },
    /**
     * A ON THE DOSSIER — ENTER THE ACT. The same colony, the act intent; the
     * stage takes the dossier's place as a HAND-OFF: the descend registers are
     * armed from the DOSSIER's live rects (its surface, its planet, its track,
     * its berths), so the stage's own enter hook FLIPs the three identities
     * out of the dossier instead of out of the (parked) tile, while the
     * dossier steps back underneath. The fold home stays the tile's rect —
     * B from the stage still folds into the tile the flow opened from.
     */
    enterFocusFromInspect(intent: ColonyFocusIntent): void {
      if (!this.focusState.open || this.focusState.intent !== 'inspect' || intent === 'inspect') {
        return;
      }
      const root = this.$el as HTMLElement | null | undefined;
      const dossier = root?.querySelector<HTMLElement>('.con-colinspect');
      const surface = dossier?.querySelector<HTMLElement>('.con-colinspect__surface');
      const planet = dossier?.querySelector<HTMLElement>('[data-colony-focus-planet]');
      const track = dossier?.querySelector<HTMLElement>('[data-colony-focus-track]');
      const slots = dossier?.querySelector<HTMLElement>('[data-colony-focus-slots]');
      const seat = dossier?.querySelector<HTMLElement>('[data-colony-city-seat]');
      const rectOf = (node: HTMLElement | null | undefined) => {
        const r = node?.getBoundingClientRect();
        return r === undefined || r.width < 10 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      armColonyFocusOrigin(rectOf(surface), rectOf(planet), rectOf(track), rectOf(slots), rectOf(seat));
      armColonyFocusHandoff();
      switchColonyFocusIntent(intent);
    },
    /**
     * THE TILE'S PROJECTED CELL — a `track` pick's candidate reads the
     * server's projection (the ghost at the top, «+N»); every other tile (and
     * every trade) passes −1 and keeps the trade's own projection.
     */
    tileProjection(colony: ColonyModel): number {
      return trackMoveOf(this.pick?.trackMoves, colony.name)?.after ?? -1;
    },
    /** X on a `track` / `city` stage — the colony's dossier, the act kept (A on the dossier leads back to it). */
    onStageInspect(): void {
      // (…and a CARD's own build door — TR25: its stage offers X as the other staged acts do.)
      if (this.focusState.open && (this.focusState.intent === 'track' || this.focusState.intent === 'city' ||
          (this.focusState.intent === 'build' && this.buildDoorStands))) {
        switchColonyFocusIntent('inspect');
      }
    },
    /** The commit did not hold (a refusal, a live re-ask): the stage is a door again (see the stage's `releasePresentation`). */
    releaseFocusStage(): void {
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.releasePresentation();
    },
    /** The shell ACCEPTED a stage confirm — pin the stage's presentation
     *  across the commit boundary (see the stage's `holdPresentation`). */
    holdFocusStage(): void {
      const stage = this.$refs.focusStage as InstanceType<typeof ConsoleColonyFocusStage> | undefined;
      stage?.holdPresentation();
    },
    async loadFocusPreview(name: ColonyName): Promise<void> {
      // A CATALOG TILE IS NOT IN THE GAME, so there is no trade to price: the
      // stage reads it from the manifest exactly as it does while a preview is
      // still on the wire. Asking anyway is a request the server can only
      // decline — see the `catalog` prop.
      if (this.playerId === '' || this.catalog) {
        return;
      }
      const seq = ++this.focusPreviewSeq;
      const preview = await fetchColonyTradePreview(this.playerId, name, this.focusPathOffset);
      if (seq === this.focusPreviewSeq && preview !== undefined && preview.colonyName === this.focusState.colonyName) {
        this.focusPreview = preview;
      }
    },
    /**
     * THE CHOSEN PATH MOVES THE TRACK (the Unity action's «advance 1 step
     * first»): the stage names the path's own offset the moment the cursor
     * picks it, and the preview is re-asked with it — so the marker's move,
     * the reward read there and the track-choice step the batch pre-collects
     * all describe the trade THIS path will make. Quiet while a trade resolves.
     */
    onFocusPathOffset(offset: number): void {
      if (offset === this.focusPathOffset) {
        return;
      }
      this.focusPathOffset = offset;
      const name = this.focusState.colonyName;
      if (name !== '' && !colonyTradeState.active) {
        void this.loadFocusPreview(name);
      }
    },
    // ── The descend transition hooks (consoleColonyFocusMotion) ────────────
    onFocusEnter(el: Element, done: () => void): void {
      colonyFocusEnterHook(el, done);
    },
    onFocusLeave(el: Element, done: () => void): void {
      colonyFocusLeaveHook(el, done);
    },
    onFocusEnterCancelled(el: Element): void {
      colonyFocusEnterCancelledHook(el);
    },
    onFocusLeaveCancelled(el: Element): void {
      colonyFocusLeaveCancelledHook(el);
    },
  },
  mounted() {
    this.scrollSelectedIntoView();
    this.fit();
    // AN EMBEDDED STEP OWNS ITS OWN ARRIVAL. Standalone, the band-surface
    // director plays the workspace switch; as a STEP that director passes
    // through by contract (no `data-motion-surface`), so this speaks the
    // workspace-descend phrase one level in instead — and it runs AFTER `fit`,
    // so the grid is already solved and no tile can resize under the opening.
    if (this.embedded) {
      playColonyStepEntry(this.$el as HTMLElement);
    }
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    const scroll = this.$refs.scroll as HTMLElement | undefined;
    if (scroll !== undefined) {
      this.stopResizeObs = useResizeObserver(scroll, () => this.scheduleFit()).stop;
    }
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
    // Embed rule 4, second half: a REMOUNT under a live claim (the Pluto
    // sequence returning home from the hand discard) re-creates the zone
    // while the claim value never changes — the watcher has nothing to fire
    // on, so the slot is published from here too.
    if (this.revealEmbedActive) {
      void this.$nextTick(() => {
        if (this.revealEmbedActive) {
          setWorkspaceOutcomeSlot(this.outcomeSlotSelector);
        }
      });
    }
    // Same for a hosted step's frame slot (a restore mid-discard, a restore mid-vote).
    if (this.frameSlotSelector !== '') {
      void this.$nextTick(() => {
        if (this.frameSlotSelector !== '') {
          setWorkspaceFrameSlot('colonies', this.frameSlotSelector);
        }
      });
    }
  },
  beforeUnmount() {
    // A watcher's landing has no seat left to land on.
    endWatchedColonyCity();
    consoleColoniesUi.receipt = false;
    this.stopResizeObs?.();
    this.stopResize?.();
    if (this.completeTimer !== undefined) {
      window.clearTimeout(this.completeTimer);
      this.completeTimer = undefined;
    }
    if (this.fitRaf !== undefined && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.fitRaf);
    }
    // Retract OUR zone before it unmounts (a stale selector teleports the
    // next batch into a detached node — embed rule 4). Checked on the RAW
    // claim, not `revealEmbedActive`: a COLLAPSE parks the frames BEFORE this
    // unmount runs, so the parked-gated computed is already false here — and
    // the slot this very mount published would survive as a selector into a
    // detached node.
    if (this.outcomeState.host === 'colonies') {
      setWorkspaceOutcomeSlot('');
    }
    // …and the hand step's frame slot, for the same reason.
    setWorkspaceFrameSlot('colonies', '');
    // Leaving the section closes the flow: reopening always lands on browse
    // (and on the grid — the docks column's cursor is part of the visit).
    closeColonyFocus();
    resetColonyDockCursor();
    resetColonyFocusMotion();
  },
});
</script>
