<template>
  <section class="con-hydro con-ws"
           :class="{
             'con-hydro--handed-over': sceneHandedOver,
             'con-hydro--cere': ceremonyDim,
             'con-hydro--hosted': crumbHost !== undefined,
           }"
           ref="rootEl"
           role="region"
           :aria-label="$t('Mars Hydronetwork')"
           :data-flow="flowKind">
    <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «ГИДРОСЕТЬ
         МАРСА» + the live chips as the aux browse layer; a configuring or
         committed flow grows the crumb tail «› <этап> › <шаг>». The old
         two-line lore paragraph is gone: a standing game workspace explains
         itself through its stages, not a header essay. -->
    <!-- …AND WHEN THIS SCREEN IS A STEP OF ANOTHER, THE HOST'S OWN HEADER
         STAYS ON SCREEN AND THIS ONE GOES GHOST (`visibility: hidden`): the
         line the player is reading is then the SAME DOM node before and after
         the walk, so its root and its subject cannot blink or shift — only the
         tail advances, which is the whole contract. The node stays in layout
         so nothing below it moves; the host publishes the tail through the
         stack (`setWorkspaceFrameStage`).
         THE CRUMB IS THE STACK'S, NOT THE SCREEN'S. A step standing INSIDE
         another workspace (a card's advance — «ДЕЙСТВИЯ КАРТ › ШТОРМОВОЙ
         БАРЬЕР › ПРОДВИЖЕНИЕ») keeps reading from where the player started,
         identity symbol included: the workspace name and the carried card
         never restart, only the tail advances. A hydro frame that IS the root
         reads exactly as before. -->
    <ConsoleWsHead class="con-hydro__head"
                   :class="{'con-hydro__head--ghost': crumbHost !== undefined && !hostHeadHidden}"
                   :root="crumbRoot"
                   :emblem="crumbEmblem.emblem"
                   :wheelAnchor="crumbEmblem.wheelAnchor"
                   :subject="headSubject"
                   :stage="crumbStagePublished"
                   :committed="crumbCommitted">
      <!-- THE POSITION — one quiet readout, never a pill (premium iteration, EF): the status the old second pill
           repeated is the act column's own verdict (`data-hydro-status`), stated once where the decision is. -->
      <span class="con-hydro__headpos" :data-hydro-position="model.currentPosition">
        <span class="con-hydro__headpos-cap">{{ $t('Track position') }}</span>
        <b>{{ model.currentPosition }}</b><span class="con-hydro__headpos-of">/ 11</span>
      </span>
    </ConsoleWsHead>

    <!-- ── PROGRESS RAIL: all 12 stops, the selected one magnified. THE track
         is the workspace's permanent protagonist — every scene below keeps it
         standing. (Unchanged navigation: ←/→ stages, RT farthest.) ───────── -->
    <div class="con-hydro__rail" role="list" ref="railEl">
      <template v-for="stop in stops" :key="stop.position">
        <span v-if="stop.position > 0" class="con-hydro__link" :class="'con-hydro__link--' + stop.linkKind" aria-hidden="true"></span>
        <div class="con-hydro__stop"
             role="listitem"
             :data-hydro-stop="stop.position"
             :class="[
               'con-hydro__stop--' + stop.vm.state,
               stop.grade !== undefined ? 'con-hydro__stop--grade-' + stop.grade : '',
               {
                 'con-hydro__stop--focused': stop.vm.isSelected,
                 'con-hydro__stop--vp': stop.vm.stage.vp !== undefined,
                 'con-hydro__stop--dimmed': rewardOffer !== undefined ?
                   !rewardClaimableSet.has(stop.position) :
                   espionageOffer !== undefined ?
                     !espionageLitCells.has(stop.position) :
                     (blockadeOffer !== undefined || blockadeExecution !== undefined) ?
                       !blockadeLitCells.has(stop.position) :
                       (!globallyActable && stop.vm.state !== 'current' && stop.vm.state !== 'completed'),
                 'con-hydro__stop--route-paid': stop.vm.routeRewarded,
                 'con-hydro__stop--route-excl': stop.vm.routeExcluded,
                 'con-hydro__stop--esp-fwd': (espionageOffer !== undefined && espOwner !== undefined && espOwner.legal && stop.position === espOwner.toPosition) ||
                   (rewardAdvanceFrom !== undefined && rewardClaimableSet.has(stop.position)),
                 'con-hydro__stop--esp-back': espionageOffer !== undefined && espionageFocusRow !== undefined && espionageFocusRow.target.legal && stop.position === espionageFocusRow.target.toPosition,
               },
             ]"
             @click="onStopClick(stop.position)">
          <!-- THE BLOCKADE GATE (Modular Floodgates) — a standing steel
               module on the cell's ENTRY EDGE: it interrupts the path INTO
               this cell, in front of the blocked player's marker, carrying
               that player's colour band (never colour alone — the lock glyph
               names the meaning). Absolutely positioned: presence never
               re-flows the cell. `active` is the calm ambient state read off
               the live player models; `ghost` follows the pick's cursor. -->
          <transition-group name="con-hydro-gatein">
            <span v-for="(gate, gi) in blockadeGatesAt(stop.position)" :key="'gate-' + gate.target"
                  class="con-hydro__gate"
                  :class="['con-hydro__gate--' + gate.state]"
                  :style="gi > 0 ? {marginLeft: (gi * 0.85) + 'rem'} : undefined"
                  :data-hydro-gate="gate.state === 'active' ? gate.target : undefined"
                  aria-hidden="true">
              <i class="con-hydro__gate-bar"></i>
              <i class="con-hydro__gate-band" :class="'player_bg_color_' + gate.target"></i>
            </span>
          </transition-group>
          <div class="con-hydro__stop-req">
            <span v-if="stop.vm.stage.tag !== undefined" class="con-hydro__stop-tag resource-tag" :class="'tag-' + stop.vm.stage.tag" aria-hidden="true"></span>
            <span v-else-if="stop.vm.stage.vp !== undefined" class="con-hydro__stop-vp">{{ stop.vm.stage.vp }}<small>{{ $t('VP') }}</small></span>
            <span v-else class="con-hydro__stop-flag">{{ $t('Track start') }}</span>
            <span class="con-hydro__stop-num">{{ stop.position }}</span>
            <!-- The stage's own GRADE is the cell's MATERIAL (`--grade-*`: a dashed red kant for out of reach /
                 occupied, a dotted amber one for «needs energy»), never a glyph painted on it. A cell carries what it
                 IS plus the player markers below; what HAPPENED here is READING, and reading lives in the stage panel
                 the cursor is already pointing at (the ✓/⇢/↷ badges of 2026-08-31 and the ✕/⛔/⚡ grade glyphs are
                 the same mistake at two sizes). -->
          </div>
          <!-- The magnified stop's own content CROSSFADES with the cell's
               growth (a bare v-if pop is the one thing this rail may never
               do): it enters a beat AFTER the box has mostly opened, at its
               FINAL width (no text re-wrap mid-growth), and the leaving
               content detaches from the flow so the shrinking cell never
               re-flows it — it simply lets go where it stood. -->
          <transition name="con-hydro-stopin">
            <div v-if="stop.vm.isSelected" class="con-hydro__stop-open">
              <div class="con-hydro__stop-name">{{ $t(stop.vm.stage.nameKey) }}</div>
              <div class="con-hydro__stop-reward">
                <template v-if="stop.vm.stage.rewardOptions.length > 1">
                  <HydroReward :chips="stop.vm.stage.rewardOptions[0]" :compact="true" />
                  <span class="con-hydro__stop-or">{{ $t('or') }}</span>
                  <HydroReward :chips="stop.vm.stage.rewardOptions[1]" :compact="true" />
                </template>
                <HydroReward v-else-if="stop.vm.stage.rewardOptions.length === 1" :chips="stop.vm.stage.rewardOptions[0]" :compact="true" />
                <span v-else-if="stop.vm.stage.vp === undefined" class="con-hydro__stop-noreward" aria-hidden="true">—</span>
              </div>
            </div>
          </transition>
          <!-- The marker row is the STABLE landing anchor of the advance
               micro-interaction (`data-hydro-marker`, a fixed min-size even
               when empty): the gliding proxy locks in EXACTLY here, then the
               real marker materializes in the same rect. -->
          <div class="con-hydro__stop-markers" :data-hydro-marker="stop.position">
            <span v-for="m in stop.vm.markers" :key="m.color"
                  v-show="!(markerGliding && m.color === hydroMarkerState.color && stop.position === markerFrom)"
                  class="con-hydro__stop-marker"
                  :class="[
                    'player_bg_color_' + m.color,
                    {
                      'con-hydro__stop-marker--viewer': m.isViewer,
                      'con-hydro__stop-marker--settle': m.color === hydroMarkerState.color && stop.position === markerSettled,
                    },
                  ]"
                  aria-hidden="true"></span>
            <!-- ESPIONAGE GHOSTS — the projection made physical: a translucent
                 destination token + its direction arrow, visually distinct
                 from a real marker by construction (dashed ring, no fill
                 weight, an arrow naming the direction — never colour alone).
                 The owner's forward ghost is constant; the backward ghost
                 follows the FOCUSED candidate and moves with the cursor. -->
            <template v-if="espionageOffer !== undefined || rewardAdvanceFrom !== undefined">
              <span v-for="g in espionageGhostsAt(stop.position)" :key="'ghost' + g.color"
                    class="con-hydro__stop-marker con-hydro__stop-ghost"
                    :class="['player_bg_color_' + g.color, 'con-hydro__stop-ghost--' + g.dir]"
                    aria-hidden="true"><i class="con-hydro__stop-ghost-arrow">{{ g.dir === 'back' ? '‹' : '›' }}</i></span>
            </template>
          </div>
        </div>
      </template>
      <!-- THE MOVEMENT LINK — a quiet dashed arc from the marker's REAL cell
           to its ghost destination, so a projection reads as «who moves
           where» at a glance (the ghost alone made the player reconstruct
           the direction from two tokens). One per projected move: the
           owner's forward arc (mint), the focused candidate's backward arc
           (amber). Measured off the real marker rows; static once drawn —
           only a one-shot fade-in, nothing loops. -->
      <svg v-if="ghostLinkPaths.length > 0" class="con-hydro__ghostlinks" aria-hidden="true">
        <g v-for="p in ghostLinkPaths" :key="p.key"
           class="con-hydro__ghostlink" :class="'con-hydro__ghostlink--' + p.dir">
          <path class="con-hydro__ghostlink-path" :d="p.d" />
          <polygon class="con-hydro__ghostlink-tip" :points="p.tip" />
        </g>
      </svg>
    </div>

    <!-- ── THE SCENE — the transformable lower zone. ONE STANDING FRAME whose
         top edge is welded under the track (the connector stem always lands
         on it), holding three zones that never trade places:
           ctx (identity: the stage, or the granting card) · flow (the stage
           content — the ONLY part that transitions) · act (the decision).
         Substates advance the FLOW in place via the workspace-descend phrase;
         the frame, the context column and the action column stand — which is
         the whole layout contract this rework bought: no substate may move
         the surface's own coordinates. ───────────────────────────────────── -->
    <div class="con-hydro__scene" ref="sceneEl">
      <div class="con-hydro__panel" :class="{'con-hydro__panel--immersive': immersive, 'con-hydro__panel--fxopen': fxOpen}" data-forecast-host>
        <!-- ── THE «ЭФФЕКТЫ» LAYER (R3) — a LEVEL of this workspace (iteration 6 of «СРАБАТЫВАНИЕ КАРТЫ», the owner,
             2026-10-27 — the stdp's own grammar, PL-066): the plan's three columns PARK under it (opacity — never a
             v-if), the explorer unfolds out of the plan body's «⚡ сработает» door with the FOCUSED destination's
             answer (the ruling Greens' M€ production for a heat production step), B / R3 fold it back with the
             cursor where it stood; the crumb gains «ЭФФЕКТЫ». The section routes the pad to it. ── -->
        <ConsoleForecastLayer ref="forecastLayer"
                              host="hydro"
                              :forecast="focusedForecast"
                              :cards="playerView.thisPlayer?.tableau ?? []"
                              :color="playerView.thisPlayer?.color ?? ''"
                              :players="playerView.players"
                              :statsByColor="forecastStatsByColor" />
        <!-- ═══ CTX — the persistent identity column. ONE DOM node across
             every substate: the stage variant (glyph · name · position ·
             state · route) for the player's own flow, the SOURCE variant
             (the granting card · route) for a card's move. Past the commit
             it reads the FROZEN record — the live model has moved on and
             would describe the next advance. It never re-enters with a
             layer: stage changes retune it in place. ═══ -->
        <div class="con-hydro__ctx" ref="ctxEl">
          <div v-if="ctxView.kind === 'source'"
               class="con-hydro__bonus-source"
               :class="{'con-hydro__bonus-source--focused': sceneFocus === 'bonus-source'}"
               :data-zoom-slot="ctxView.source"
               role="button" @click="inspectBonusSource">
            <ConsoleSourceDock v-if="ctxSourceView !== undefined"
                               :view="ctxSourceView" :compact="true"
                               :motionAnchor="'card:' + ctxView.source" />
          </div>
          <div v-else class="con-hydro__ident">
            <span v-if="ctxView.tag !== undefined" class="con-hydro__stage-tag resource-tag" :class="'tag-' + ctxView.tag" aria-hidden="true"></span>
            <span v-else-if="ctxView.vp !== undefined" class="con-hydro__stage-vp">{{ ctxView.vp }} {{ $t('VP') }}</span>
            <span v-else class="con-hydro__stage-flag">{{ $t('Track start') }}</span>
            <div class="con-hydro__stage-titles">
              <div class="con-hydro__stage-name">{{ $t(ctxView.nameKey ?? '') }}</div>
              <div class="con-hydro__stage-pos">{{ ctxView.posText }}</div>
            </div>
          </div>
          <!-- The state chip rides a RESERVED slot: a badge that comes and
               goes may never re-seat the route line beneath it. -->
          <div class="con-hydro__ctx-badge">
            <span v-if="ctxView.badge !== undefined" class="con-hydro__stage-badge" :class="'con-hydro__stage-badge--' + ctxView.badge.kind">
              <span class="con-hydro__chip-dot" aria-hidden="true"></span>
              <span>{{ ctxView.badge.text }}</span>
            </span>
          </div>
          <!-- The ROUTE — one grammar, one home, every substate: from → to,
               the price chip (or the FREE badge — «−0 ⚡» is a price on the
               one move whose whole point is that it has none). -->
          <span v-if="ctxView.route !== undefined" class="con-hydro__route">
            <span>{{ ctxView.route.from }}</span>
            <span aria-hidden="true">→</span>
            <b>{{ ctxView.route.to }}</b>
            <span v-if="ctxView.route.free" class="con-hydro__route-cost con-hydro__route-cost--free">{{ $t('Free') }}</span>
            <span v-else-if="ctxView.route.priced !== false" class="con-hydro__route-cost">
              <template v-if="ctxView.route.energy > 0">−{{ ctxView.route.energy }}<i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></template>
              <template v-if="ctxView.route.steel > 0">−{{ ctxView.route.steel }}<i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i></template>
            </span>
          </span>
          <!-- ── THE FOCUSED STAGE'S ROSTER — «кто здесь и что здесь было».
               The track itself carries only the player MARKERS (one per
               player, in the one place that player stands); everything a cell
               could say ABOUT a player is reading, and it belongs here, beside
               the stage's own name, on the cell the cursor is pointing at.
               Each row is one player: their colour, their name, what happened
               to them here — and, for a reward actually taken, WHICH one.

               Not in the SOURCE composition (`ctxView.kind === 'source'`):
               there the column is the card that caused what is on stage, and a
               track roster under it answers a question nobody asked. -->
          <div v-if="ctxView.kind !== 'source' && focusRoster.length > 0" class="con-hydro__roster">
            <span class="con-hydro__roster-cap">{{ $t('On this stage') }}</span>
            <div v-for="r in focusRoster" :key="r.color" class="con-hydro__roster-row"
                 :class="{'con-hydro__roster-row--viewer': r.isViewer}">
              <span class="con-hydro__roster-dot" :class="'player_bg_color_' + r.color" aria-hidden="true"></span>
              <span class="con-hydro__roster-name">{{ r.name }}</span>
              <span class="con-hydro__roster-state" :class="'con-hydro__roster-state--' + r.status">
                {{ $t(rosterStatusKey(r)) }}
              </span>
              <HydroReward v-if="rosterReward(r) !== undefined" :chips="rosterReward(r) ?? []" :compact="true" />
            </div>
          </div>
        </div>

        <!-- ═══ FLOW — the one transitioning zone. ═══ -->
        <div class="con-hydro__flow">
          <transition :css="false"
                      @enter="sceneEnter" @leave="sceneLeave"
                      @enter-cancelled="sceneCancelled" @leave-cancelled="sceneCancelled">
        <!-- ═══ PREVIEW — the plan/details reading. ═══ -->
        <div v-if="sceneKey === 'preview'" key="preview" class="con-hydro__layer con-hydro__layer--preview">
            <!-- ONE body element: stepping between stops RETUNES it (a soft
                 GSAP dip-and-rise) instead of hard-swapping rows — the frame
                 never moves, rows reserve their lines, and the content
                 breathes through the change. -->
            <div class="con-hydro__panelbody" ref="panelBody">
            <template v-if="model.mode === 'plan'">
              <!-- Requirements row: the PATH TAGS, and nothing else. Owning
                   the resources that PAY for the move is not a tag
                   requirement — affordability lives in the payment panel,
                   whose verdict is the one place that says «не хватает». -->
              <div class="con-hydro__reqline" data-unfold-item>
                <span class="con-hydro__section-label">{{ $t('Requirements') }}</span>
                <span v-for="(t, i) in requiredTags" :key="i"
                      class="con-hydro__req-tag"
                      :class="'con-hydro__req-tag--' + tagStatus(t)">
                  <span class="resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
                </span>
              </div>
              <!-- Route notes: the skipped-reward POLICY + the 2VP leap — one
                   quiet line each. The policy is a COUNT, never the raw list
                   of stage names (the route stops are lit mint on the rail
                   right above — the names are one focus step away, and a
                   two-line roster drowned the decision it annotated). The
                   STRIP is always in layout (a reserved line, the settings
                   idiom) — appearing text may never re-flow the rows below. -->
              <div class="con-hydro__routenotes" data-unfold-item>
                <span v-if="model.skippedStages.length > 0" class="con-hydro__routenote" data-routenote="skip">
                  {{ skippedSummary }}
                </span>
                <!-- The MODIFIER's promise, named with its card: every crossed
                     stage pays. The 2 VP crossing is the one exclusion, stated
                     beside it — an omission may never be silent. -->
                <span v-if="traversalActive" class="con-hydro__routenote con-hydro__routenote--paid" data-routenote="paid">
                  {{ traversalNoteText }}
                </span>
                <span v-if="traversalActive && model.traversalExcludedVp" class="con-hydro__routenote" data-routenote="excluded">
                  {{ $t('The crossed 2 VP stage grants no reward — it is claimed only by stopping there.') }}
                </span>
                <span v-if="jumpedOverVp2" class="con-hydro__routenote" data-routenote="leap">
                  {{ $t('The occupied 2 VP position is leapt over to reach the 5 VP slot.') }}
                </span>
              </div>

              <!-- Outcome row — the ONE shared block (see ConsoleHydroGains):
                   honest deltas, the alternatives while the choice is open.
                   («Нечего выбирать» is stated ONCE, by the pick row below —
                   the stage's own home for that question.) -->
              <ConsoleHydroGains :view="rewardView"
                                 :options="model.targetNeedsChoice && rewardChoice === undefined ? selectedStage.rewardOptions : undefined"
                                 :extras="movementBonuses"
                                 data-unfold-item />
              <!-- WHAT THE TABLE ANSWERS to this move (iteration 6) — the composers' «⚡ сработает» group and the
                   DOOR of the R3 «Эффекты» layer. A choice stage reads the CHOSEN option's answer here (the option
                   tiles print their own); a RESERVED line, so an answer appearing never re-flows the rows below. -->
              <div class="con-hydro__fxline" data-unfold-item data-hydro-fxline>
                <ConsoleForecastDoor :reaction="focusedReaction" :canOpen="forecastCanOpen" :pulse="forecastPulse" @open="openForecastLayer()" />
              </div>

              <!-- ═══ THE PRICE LINE — Configure states WHAT the advance
                   costs and WHICH sources may pay it; the full composition
                   editor is its own SUBSTEP (`flow.step === 'payment'`),
                   entered from the confirm only while the server model
                   admits more than one mix. One reserved line, never a
                   panel competing with the plan's own reading. ═══ -->
              <div v-if="model.selectedSpend > 0" class="con-hydro__payline" data-unfold-item>
                <span class="con-hydro__section-label">{{ $t('Payment') }}</span>
                <span class="con-hydro__payline-price">
                  <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
                  <template v-if="mixRowVisible">
                    <span class="con-hydro__payline-slash" aria-hidden="true">/</span>
                    <i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i>
                  </template>
                  <b>{{ model.selectedSpend }}</b>
                </span>
                <span v-if="mixRowVisible" class="con-hydro__payline-family">{{ $t('Energy and/or steel') }}</span>
                <!-- The CURRENT draft, compact: «⚡2 + 🔩1». For a single valid
                     allocation this IS the whole statement (nothing to dial);
                     while several exist the next step is named honestly. -->
                <span class="con-hydro__payline-mix">
                  <template v-if="!mixRowVisible">
                    <span class="con-hydro__payline-part">−{{ model.selectedSpend }}<i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></span>
                    <span class="con-hydro__payline-left">{{ model.availableEnergy }} → {{ model.availableEnergy - model.selectedSpend }}</span>
                  </template>
                  <template v-else>
                    <span v-if="!mixAdjustable" class="con-hydro__payline-will">{{ $t('Will pay') }}:</span>
                    <span class="con-hydro__payline-part"><b>{{ model.selectedSpend - mixSteel - model.floodgateSteelForSpend }}</b><i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></span>
                    <span aria-hidden="true">+</span>
                    <span class="con-hydro__payline-part"><b>{{ mixSteel + model.floodgateSteelForSpend }}</b><i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i></span>
                  </template>
                </span>
                <span v-if="mixRowVisible" class="con-hydro__payline-src">{{ $t(mixSourceCard ?? '') }}</span>
                <span v-if="mixAdjustable" class="con-hydro__payline-next">{{ $t('Next: payment composition') }}</span>
                <!-- The plan's PROTECTED resource, named where the price is
                     read: the auto-composition kept this energy for the
                     pre-selected action, so the movement may not take it. -->
                <span v-if="reservedNoteText !== ''" class="con-hydro__payline-reserved">
                  {{ reservedNoteText }}
                </span>
              </div>

              <!-- (The stage's PRE-SELECT lives in the DECISION RAIL — the
                   action column on the right, directly above the final CTA.
                   The centre explains the step; it holds nothing that looks
                   like a focusable action, and the chosen target is never
                   duplicated here.) -->

            </template>

            <!-- Details mode: the viewer's own relation to this stage. -->
            <template v-else>
              <div class="con-hydro__detailline" data-unfold-item>
                <span class="con-hydro__detail-status">{{ detailsStatusText }}</span>
                <span v-if="startSelected" class="con-hydro__routenote">{{ $t('The starting point of the Hydronetwork track.') }}</span>
                <span class="con-hydro__routenote">{{ $t('Select a stage ahead to plan the advance') }}</span>
              </div>
            </template>
            </div>
        </div>

        <!-- ═══ REWARD CHOICE (pos 1/2) — the movement plan's DECISIONS,
             rendered through the shared strip. Today the plan is always ONE
             decision (this stage's binary reward) and the strip IS the
             familiar physical D-pad row; a future move that grants several
             stage rewards grows the LIST, never this layer. The step is the
             whole decision: pick → the CTA in the action column arms →
             confirm; leaving asks again next time (the choice is scoped to
             the step, never a standing pre-select). ═══ -->
        <div v-else-if="sceneKey === 'choice'" key="choice" class="con-hydro__layer con-hydro__layer--choice">
          <ConsoleHydroPlanSteps :steps="planDecisions"
                                 :focus="choiceFocus"
                                 :stage="choiceStage"
                                 @pick="pickChoice" />
          <!-- THE CHOSEN OPTION'S ANSWER and the R3 «Эффекты» door at the step's CONFIRM stage (iteration 6): the step
               commits from HERE (A on an option arms the commit right under it — the plan body is never returned to),
               so the door stands where the decision stands. A traversal's choice RETURNS to the rail (no door here). -->
          <div v-if="choiceStage === 'confirm' && choicePosition === undefined" class="con-hydro__fxline con-hydro__fxline--choice" data-unfold-item data-hydro-fxline>
            <ConsoleForecastDoor :reaction="focusedReaction" :canOpen="forecastCanOpen" :pulse="forecastPulse" @open="openForecastLayer()" />
          </div>
        </div>

        <!-- ═══ TARGET PICK (pos 9) — the SHARED played-card target selector,
             embedded under the standing track. ═══ -->
        <div v-else-if="sceneKey === 'target'" key="target" class="con-hydro__layer con-hydro__layer--target" ref="targetZone">
          <ConsolePlayedTargetStep v-if="targetStepModel !== undefined && targetFocus !== undefined"
                                   ref="targetStep"
                                   :model="targetStepModel"
                                   :layout="targetLayout"
                                   :focus="targetFocus"
                                   :bandHeight="targetBandH"
                                   :lockedCard="targetLockedCard" />
        </div>

        <!-- ═══ PAYMENT — the Delta Works COMPOSITION substep. The context
             column IS the pinned summary now (the same stage identity and
             route the plan showed — nothing re-states itself); the premium
             payment selector takes the flow zone; the final act stands in
             the action column. Exists ONLY while the server model admits at
             least two valid mixes; B walks back to the plan with every
             selection and the draft intact. ═══ -->
        <div v-else-if="sceneKey === 'payment'" key="payment" class="con-hydro__layer con-hydro__layer--payment">
          <!-- The decision already made upstream stays VISIBLE: the chosen
               stage reward (when this stage asked for one) — the walk into
               the composition may not orphan the choice it pays for. -->
          <div v-if="paymentChosenReward !== undefined" class="con-hydro__paychoice" data-unfold-item>
            <span class="con-hydro__section-label">{{ $t('Reward') }}</span>
            <HydroReward :chips="paymentChosenReward" :compact="true" />
            <span class="con-hydro__bonus-tick" aria-hidden="true"></span>
          </div>
          <!-- THE COMPOSITION — the shared premium payment panel over the
               ONE canonical draft, with the room it deserves. -->
          <div class="con-hydro__paypanel" data-unfold-item>
            <ConsolePaymentPanel :view="mixPaymentView"
                                 :mode="mixTwoLanes ? 'expanded' : 'compact'"
                                 :focus-unit="mixActiveLane"
                                 hint-mode="none"
                                 title-key="Payment mix"
                                 :source-card="mixSourceCard"
                                 :flash-nonce="mixFlashNonce" />
          </div>
          <!-- The plan's PROTECTED resource rides into the composition: the
               dial's bounds already exclude it (the clamp IS the auto-
               preserve), and this names WHY the range refuses to go further —
               the pre-selected action holds that energy. -->
          <div v-if="reservedNoteText !== ''" class="con-hydro__payline-reserved" data-unfold-item>
            {{ reservedNoteText }}
          </div>
        </div>

        <!-- ═══ BONUS — a card is OFFERING a move the player did not ask for.
             The SOURCE and the ROUTE live in the context column (the same
             slots every substate uses — a card's move is the same move); the
             flow zone states WHAT IT DOES and the landed stage's pre-select;
             the answers stand in the action column. It never titles itself —
             the stage name goes UP to the crumb (`bonusStageKey` → the
             frame), the way every embedded step in this console does. ═══ -->
        <div v-else-if="sceneKey === 'bonus'" key="bonus" class="con-hydro__layer con-hydro__layer--bonus">
              <!-- WHAT IT DOES — one calm sentence and the honest facts, one
                   column the eye reads top-to-bottom without travelling. -->
              <div class="con-hydro__bonus-body" data-unfold-item>
                <p class="con-hydro__bonus-text">{{ bonusBodyText }}</p>

                <!-- WHAT IT PAYS — the ONE outcome block the plan panel uses,
                     verbatim: same component, same typography, same icons,
                     same «сейчас → станет», same «или». An UNRESOLVED stage
                     choice shows the ALTERNATIVES (never a concrete delta for
                     a decision the player has not made), and the primary CTA
                     beside it says «Выберите награду». -->
                <ConsoleHydroGains v-if="bonusGainPresent"
                                   :view="bonusRewardView"
                                   :options="bonusNeedsReward && rewardChoice === undefined ? bonusRewardOptions : undefined"
                                   :extras="movementBonuses"
                                   :compact="true"
                                   data-unfold-item />
                <!-- WHAT IT COSTS — the plan panel's own payment line (the
                     same classes, the same price chip, the same before →
                     after), never a source-only «будет потрачено» dialect. -->
                <div v-if="bonusCostLine !== undefined" class="con-hydro__payline" data-unfold-item>
                  <span class="con-hydro__section-label">{{ $t('Payment') }}</span>
                  <span class="con-hydro__payline-price">
                    <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
                    <b>{{ -bonusCostLine.delta }}</b>
                  </span>
                  <span class="con-hydro__payline-mix">
                    <span class="con-hydro__payline-part">−{{ -bonusCostLine.delta }}<i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></span>
                    <span class="con-hydro__payline-left">{{ bonusCostLine.before }} → {{ bonusCostLine.after }}</span>
                  </span>
                </div>

                <!-- (The landed stage's PRE-SELECT lives in the DECISION RAIL
                     — the action column, above the answer plates. Same rail,
                     same cards, same focus contract as the player's own
                     advance: the parity law.) -->

              </div>
        </div>

        <!-- ═══ REWARD-ONLY PICK (Dutch Mountains) — the track as a pure
             SELECTION surface: the focused stage's honest «Вы получите»
             through the one shared gains block, the eligibility verdict in
             plain words, and NOTHING of the movement grammar (no route, no
             price, no destination) — the position will not change and the
             scene may not suggest otherwise. ═══ -->
        <div v-else-if="sceneKey === 'reward-pick'" key="reward-pick" class="con-hydro__layer con-hydro__layer--rewardpick">
          <div class="con-hydro__panelbody">
            <div class="con-hydro__detailline" data-unfold-item>
              <!-- Two honest readings, ONE surface: the claim-in-place family
                   (Dutch Mountains — the position will not change) and the
                   ADVANCE-LANDING family (Corporate Espionage — the reward is
                   the destination's, granted after the marker arrives). -->
              <span class="con-hydro__detail-status">{{ $t(rewardAdvanceFrom !== undefined ?
                'Choose the reward of the stage you are advancing to' :
                'Choose the reward of your current stage or one you have passed. Your Hydronetwork position will not change.') }}</span>
            </div>
            <div v-if="rewardAdvanceFrom !== undefined" class="con-hydro__espowner" data-unfold-item>
              <span class="con-hydro__espowner-cap">{{ $t('Your own advance') }}</span>
              <span class="con-hydro__route">
                <span>{{ rewardAdvanceFrom }}</span>
                <span aria-hidden="true">→</span>
                <b>{{ rewardOffer?.claimable[0] }}</b>
              </span>
            </div>
            <ConsoleHydroGains v-if="rewardFocusClaimable"
                               :view="rewardFocusView"
                               :options="rewardFocusAsk?.kind === 'choice' && !rewardFocusAsk.answered ? selectedStage.rewardOptions : undefined"
                               data-unfold-item />
            <div v-else class="con-hydro__routenotes" data-unfold-item>
              <span class="con-hydro__routenote">{{ $t(rewardFocusBlockKey) }}</span>
            </div>
          </div>
        </div>

        <!-- ═══ ESPIONAGE TARGET PICK (Corporate Espionage) — a projection +
             selection surface. The track above carries the proof (real
             markers + the two ghost destinations); this zone carries the
             OWNER's own advance (constant) and the candidate rows (premium
             single-choice tiles — name, marker, `from → to`, the SERVER's
             own resulting reward, protected/blocked reason). Focus retunes
             the ghosts; A on a legal row RETURNS the pick to the composer;
             nothing here moves a marker or grants a thing. ═══ -->
        <div v-else-if="sceneKey === 'espionage-pick'" key="espionage-pick" class="con-hydro__layer con-hydro__layer--esppick">
          <div class="con-hydro__panelbody">
            <div class="con-hydro__detailline" data-unfold-item>
              <span class="con-hydro__detail-status">{{ $t(espionageHasLegal ? 'Choose a player to push back on the Hydronetwork' : 'No player can be pushed back — the attack will be skipped') }}</span>
            </div>
            <!-- The owner's own MANDATORY advance — always visible, never a
                 competing focus target: the projection's other half. -->
            <div v-if="espOwner !== undefined" class="con-hydro__espowner" data-unfold-item>
              <span class="con-hydro__espowner-cap">{{ $t('Your own advance') }}</span>
              <span class="con-hydro__route">
                <span>{{ espOwner.fromPosition }}</span>
                <span aria-hidden="true">→</span>
                <b>{{ espOwner.toPosition }}</b>
              </span>
              <span v-if="espOwner.waivedTag !== undefined" class="con-hydro__espwaiver">
                <span>{{ $t('Ignored tag') }}</span>
                <span class="con-hydro__stop-tag resource-tag" :class="'tag-' + espOwner.waivedTag" aria-hidden="true"></span>
              </span>
              <span class="con-hydro__esprow-reward">
                <span v-if="espOwnerView.chipOptions.length > 0" class="con-hydro__esp-chips">
                  <template v-for="(opt, oi) in espOwnerView.chipOptions" :key="oi">
                    <span v-if="oi > 0" class="con-hydro__stop-or">{{ $t('or') }}</span>
                    <HydroReward :chips="opt" :compact="true" />
                  </template>
                </span>
                <span v-else-if="espOwnerView.vpAmount !== undefined" class="con-hydro__stage-vp">{{ espOwnerView.vpAmount }} {{ $t('VP') }}</span>
              </span>
            </div>
            <!-- The candidates — a console-native single-choice list. -->
            <div class="con-hydro__esprows" data-unfold-item role="listbox">
              <div v-for="(row, i) in espionageRows" :key="row.target.color"
                   class="con-hydro__esprow"
                   role="option"
                   :aria-selected="espionageSelectedColor === row.target.color"
                   :class="{
                     'con-hydro__esprow--focused': i === espionageFocusIdx,
                     'con-hydro__esprow--selected': espionageSelectedColor === row.target.color,
                     'con-hydro__esprow--blocked': !row.target.legal,
                   }"
                   @click="onEspionageRowClick(i)">
                <!-- The single-choice state — a RESERVED column, never over text. -->
                <span class="con-hydro__esprow-state" aria-hidden="true">
                  <i v-if="espionageSelectedColor === row.target.color" class="con-hydro__esprow-check"></i>
                </span>
                <span class="con-hydro__roster-dot" :class="'player_bg_color_' + row.target.color" aria-hidden="true"></span>
                <span class="con-hydro__esprow-name">{{ row.name }}</span>
                <span v-if="row.target.legal" class="con-hydro__route con-hydro__route--back">
                  <span>{{ row.target.fromPosition }}</span>
                  <span aria-hidden="true">→</span>
                  <b>{{ row.target.toPosition }}</b>
                </span>
                <span v-else class="con-hydro__esprow-block">{{ $t(row.blockKey) }}</span>
                <span v-if="row.target.legal" class="con-hydro__esprow-reward">
                  <template v-if="row.view.skippedKey !== undefined">
                    <span class="con-hydro__esprow-skip">{{ $t(row.view.skippedKey) }}</span>
                  </template>
                  <span v-else-if="row.view.chipOptions.length > 0" class="con-hydro__esp-chips">
                    <template v-for="(opt, oi) in row.view.chipOptions" :key="oi">
                      <span v-if="oi > 0" class="con-hydro__stop-or">{{ $t('or') }}</span>
                      <HydroReward :chips="opt" :compact="true" />
                    </template>
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ BLOCKADE TARGET PICK (Modular Floodgates) — a projection +
             selection surface. The track above carries the proof (real
             markers + the focused candidate's GHOST GATE on the cell in
             front of their marker); this zone carries the candidate rows
             (premium single-choice tiles — name, marker, current position,
             the outcome «advancement will be blocked», protected/blocked
             reason) and the deployment's own terms (1 steel off the card,
             until the next generation). Focus retunes the ghost; A on a
             legal row RETURNS the pick to the composer; nothing here spends
             a steel or writes a status. ═══ -->
        <div v-else-if="sceneKey === 'blockade-pick'" key="blockade-pick" class="con-hydro__layer con-hydro__layer--blockpick">
          <div class="con-hydro__panelbody">
            <div class="con-hydro__detailline" data-unfold-item>
              <span class="con-hydro__detail-status">{{ $t('Choose a player to block on the Hydronetwork') }}</span>
            </div>
            <!-- The deployment's constant terms — the cost off the CARD and
                 the duration, stated once, never per row. -->
            <div class="con-hydro__espowner" data-unfold-item>
              <span class="con-hydro__espowner-cap">{{ $t('Blockade') }}</span>
              <span class="con-hydro__route">
                <span>−1</span>
                <i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i>
                <span class="con-hydro__espwaiver">{{ $t(blockadeSourceName) }}</span>
              </span>
              <span class="con-hydro__esprow-skip">{{ $t('Until the start of the next generation') }}</span>
            </div>
            <!-- The candidates — a console-native single-choice list. -->
            <div class="con-hydro__esprows" data-unfold-item role="listbox">
              <div v-for="(row, i) in blockadeRows" :key="row.target.color"
                   class="con-hydro__esprow"
                   role="option"
                   :aria-selected="blockadeSelectedColor === row.target.color"
                   :class="{
                     'con-hydro__esprow--focused': i === blockadeFocusIdx,
                     'con-hydro__esprow--selected': blockadeSelectedColor === row.target.color,
                     'con-hydro__esprow--blocked': !row.target.legal,
                   }"
                   @click="onBlockadeRowClick(i)">
                <span class="con-hydro__esprow-state" aria-hidden="true">
                  <i v-if="blockadeSelectedColor === row.target.color" class="con-hydro__esprow-check"></i>
                </span>
                <span class="con-hydro__roster-dot" :class="'player_bg_color_' + row.target.color" aria-hidden="true"></span>
                <span class="con-hydro__esprow-name">{{ row.name }}</span>
                <span class="con-hydro__route">
                  <span>{{ $t('Standing here') }}</span>
                  <b>{{ row.target.position }}</b>
                </span>
                <span v-if="!row.target.legal" class="con-hydro__esprow-block">{{ $t(row.blockKey) }}</span>
                <span v-else class="con-hydro__esprow-reward">
                  <!-- The honest-value WARNING: their once-per-generation
                       standard advance is already spent, so the blockade's
                       most visible denial is already denied — the player
                       weighs the module knowingly (card moves and the bot's
                       Increase stay closed either way). -->
                  <span v-if="row.target.standardMoveSpent === true" class="con-hydro__esprow-spent">{{ $t('Has already used their standard advance this generation') }}</span>
                  <span class="con-hydro__esprow-skip con-hydro__esprow-skip--blocked">{{ $t('Advancement will be blocked') }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- ═══ BLOCKADE EXECUTION (Modular Floodgates, committed) — the
             track is the protagonist and the fresh gate its one event: it
             ASSEMBLES in front of the target's marker (the gate element's
             own entry transition — driven by the applied response, so a
             reload mounts it standing and replays nothing) and the scene
             settles into the ambient state the rest of the generation
             keeps. This zone is the compact RECEIPT: target · effect ·
             duration · the spent module. ═══ -->
        <div v-else-if="sceneKey === 'blockade-exec'" key="blockade-exec" class="con-hydro__layer con-hydro__layer--blockexec">
          <div class="con-hydro__panelbody">
            <div class="con-hydro__commitline" data-unfold-item>
              <b class="con-hydro__commit-stage">{{ $t('Blockade deployed') }}</b>
            </div>
            <div class="con-hydro__espline con-hydro__espline--result" data-unfold-item>
              <span class="con-hydro__roster-dot" :class="'player_bg_color_' + blockadeExecution!.target" aria-hidden="true"></span>
              <span class="con-hydro__espline-name">{{ blockadeExecTargetName }}</span>
              <span class="con-hydro__esprow-skip con-hydro__esprow-skip--blocked">{{ $t('Advancement blocked until the next generation') }}</span>
              <span class="con-hydro__route">
                <span>−1</span>
                <i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i>
                <span class="con-hydro__espwaiver">{{ $t(blockadeExecution!.source) }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- ═══ COMMIT — the marker is travelling / the landed stage pays.
             The route and the price live in the context column (frozen off
             the record); this zone narrates the BEAT and hosts the landed
             stage's own scene. ═══ -->
        <div v-else-if="sceneKey === 'commit'" key="commit" class="con-hydro__layer con-hydro__layer--commit">
          <!-- The spinner exists ONLY while the GAME is working (marker /
               payout in flight). While a follow-up waits on the PLAYER it
               would read as loading over a screen that is waiting for them —
               an ambiguous system symbol, deliberately absent. -->
          <div class="con-hydro__commitline" data-unfold-item>
            <b class="con-hydro__commit-stage">{{ $t(commitStageText) }}</b>
            <span class="con-hydro__commit-caption">{{ $t(commitCaption) }}<i v-if="!followUpLive && !espWaitingTarget" class="con-hydro__commit-spin" aria-hidden="true"></i></span>
          </div>

          <!-- THE ESPIONAGE PREFIX (Corporate Espionage) — the attack half's
               COMPACT COMMIT: who fell back, their exact transition, and what
               THEY receive (or the named void). Never their full ceremony —
               and never hidden either: «both players receive the bonus» must
               read on the actor's own screen. While the target's landing owes
               THEIR decision the line carries the calm waiting state. -->
          <div v-if="espCommit !== undefined" class="con-hydro__espline" data-unfold-item>
            <template v-if="espCommit.target !== undefined">
              <span class="con-hydro__roster-dot" :class="'player_bg_color_' + espCommit.target.color" aria-hidden="true"></span>
              <span class="con-hydro__espline-name">{{ espCommitTargetName }}</span>
              <span class="con-hydro__route con-hydro__route--back">
                <span>{{ espCommit.target.from }}</span>
                <span aria-hidden="true">→</span>
                <b>{{ espCommit.target.to }}</b>
              </span>
              <span v-if="espCommitTargetView.skippedKey !== undefined" class="con-hydro__esprow-skip">{{ $t(espCommitTargetView.skippedKey) }}</span>
              <template v-else-if="espCommitTargetView.chipOptions.length > 0">
                <span class="con-hydro__espline-gets">{{ $t('receives') }}</span>
                <span class="con-hydro__esp-chips">
                  <template v-for="(opt, oi) in espCommitTargetView.chipOptions" :key="oi">
                    <span v-if="oi > 0" class="con-hydro__stop-or">{{ $t('or') }}</span>
                    <HydroReward :chips="opt" :compact="true" />
                  </template>
                </span>
              </template>
              <span v-if="espWaitingTarget" class="con-hydro__espline-wait">
                {{ espWaitingCaption }}<i class="con-hydro__commit-spin" aria-hidden="true"></i>
              </span>
            </template>
            <span v-else class="con-hydro__esprow-skip">{{ $t('No player can be pushed back — the attack will be skipped') }}</span>
          </div>

          <!-- THE TRAVERSAL STRIP — the committed plan's stages in path order,
               following the sequence's own cursor: done ✓, the CURRENT cell
               lit, the excluded 2 VP crossed out, the rest pending. The strip
               is the header's honest position while the marker walks. -->
          <div v-if="commitRec.traversal !== undefined" class="con-hydro__travline" data-unfold-item>
            <span v-for="seg in commitRec.traversal" :key="seg.position"
                  class="con-hydro__travchip"
                  :class="{
                    'con-hydro__travchip--done': travSegState(seg) === 'done',
                    'con-hydro__travchip--current': travSegState(seg) === 'current',
                    'con-hydro__travchip--excl': seg.kind === 'excluded',
                  }">
              <b>{{ seg.position }}</b>
              <span class="con-hydro__travchip-name">{{ $t(seg.stageNameKey) }}</span>
              <span v-if="seg.kind === 'excluded'" class="con-hydro__travchip-mark con-hydro__travchip-mark--excluded" aria-hidden="true"></span>
              <span v-else-if="travSegState(seg) === 'done'" class="con-hydro__travchip-mark con-hydro__travchip-mark--done" aria-hidden="true"></span>
            </span>
          </div>

          <!-- pos 9: the chosen host card, physically ON STAGE — the animals
               land on its own counter capsule; frozen before-count ticks per
               touchdown. The card LIVES the whole payout by contract: mounted
               at the marker's arrival, standing through every chip's impact,
               and the traversal sequence AWAITS its leave (the presence
               report below) before the cursor may move on — a chip can never
               fly at a slot that has already unmounted. -->
          <transition name="con-hydro-landexit" @after-leave="onLandCardLeft">
            <div v-if="presentedTargetCard !== undefined" class="con-hydro__cardland" data-unfold-item
                 :data-land-position="presentedLandPosition">
              <div class="con-hydro__landcell"
                   :class="{'con-hydro__landcell--landed': presentedLanded > 0}"
                   :data-played-key="presentedTargetCard">
                <ConsoleCardFaceLite :name="presentedTargetCard" :card="presentedModel" />
                <span v-if="presentedLanded > 0" :key="'flash' + presentedLanded"
                      class="con-hydro__landflash" aria-hidden="true"></span>
              </div>
              <div class="con-hydro__landmeta">
                <i class="card-resource card-resource-animal" aria-hidden="true"></i>
                <em>{{ presentedBefore }} → {{ presentedBefore + 2 }}</em>
              </div>
            </div>
          </transition>

          <!-- pos 10/11: the finish CEREMONY — the value rises out of the
               landed stop into this seat; the shared burst fires here. The
               seat EXISTS only from the marker's physical arrival at the
               terminal stop (`cereVisible`) — a terminal scene standing in
               the DOM from the commit frame was the rules cursor painting
               the finale while the presentation was still mid-track. Its
               entry is CSS (`con-hydro-cere-in`, `backwards`), so the first
               painted frame is already the entrance — never a v-if pop. -->
          <div v-if="cereVisible" class="con-hydro__cere">
            <div class="con-hydro__cere-seat" ref="cereSeat">
              <div class="con-hydro__cere-value" ref="cereValue">
                {{ commitRec.vp }} <small>{{ $t('VP') }}</small>
              </div>
            </div>
            <div class="con-hydro__cere-line" data-hydro-cere-line>{{ $t(commitRec.stageNameKey) }}</div>
            <div class="con-hydro__cere-cap" data-hydro-cere-line>{{ $t('VP at game end') }}</div>
          </div>

          <!-- The EMBED ZONE — the landed stage's own follow-up (the deck
               pick of pos 5, a repeated action's draw) teleports IN here and
               gets the whole remaining room. Rendered from the submit frame:
               the target must exist before the teleport looks for it.

               It also STANDS THE SOURCE, exactly as the start workspace's zone
               does: a step's source card is a static child of the zone, and the
               teleported surface is appended beside it. -->
          <div v-embed-zone class="con-hydro__embed" data-embed-slot="hydro">
            <!-- ── THE SOURCE SEAT — «почему эти карты у меня?» ───────────
                 A stage whose reward REPEATS a card action stands that card
                 beside the action's own prompt for the prompt's whole life, so
                 the causality is on screen and not in the player's memory:
                 «эти карты я получаю потому, что на этапе 7 повторяю Центр ИИ».

                 It exists exactly while the traversal is parked ON that stage
                 (`hydroActiveStepSourceCard`), so it materialises with the step
                 — never before the marker gets there — and leaves with it.

                 ABSOLUTE, so it costs the prompt no width: it is CONTEXT, and
                 context must not shrink the thing it is context for. The card
                 row reserves it by MEASUREMENT on both sides (the shared
                 `[data-embed-source-slot]` contract the deck pick and the
                 drawn reveal both honour), so the two can never overlap — in
                 any phase, at any focus scale.

                 It takes no focus and is in no selection: the ONE inspect verb
                 is `L3 Источник` in the command bar, and it lifts THIS card out
                 of THIS rect (`workspaceSourceZoomOrigin` resolves the slot and
                 the zoom machinery holds it empty for the flight — never a
                 second copy beside the original). -->
            <div v-if="embedSourceCard !== undefined" class="con-hydro__embedsource"
                 :data-zoom-slot="embedSourceCard"
                 role="button" @click="inspectStepSource">
              <!-- The EXISTING key (invariant 9: the English text IS the key —
                   never coin a second one for a sentence that already has a
                   translation). «ПОВТОР ДЕЙСТВИЯ» reads exactly right in caps. -->
              <span class="con-hydro__embedsource-cap">{{ $t('Repeat action') }}</span>
              <div class="con-hydro__embedsource-card" data-embed-source-slot>
                <ConsoleCardFaceLite :name="embedSourceCard" :card="embedSourceModel" />
              </div>
              <span v-if="embedSourceBranch !== undefined" class="con-hydro__embedsource-branch">
                {{ embedSourceBranch }}
              </span>
            </div>
          </div>
        </div>

        <!-- ═══ RESULT — the read-hold payoff. The route and the actual price
             stand frozen in the context column; this zone states what the
             move DELIVERED: the landed stage, the honest deltas, the resolved
             choices and every named omission. ═══ -->
        <div v-else key="result" class="con-hydro__layer con-hydro__layer--result">
          <div class="con-hydro__result" data-unfold-item>
            <div class="con-hydro__result-head">
              <span class="con-hydro__bonus-tick" aria-hidden="true"></span>
              <b>{{ $t('Reinforcement complete') }}</b>
              <span class="con-hydro__result-stage">{{ $t(commitRec.stageNameKey) }}</span>
            </div>
            <!-- THE ESPIONAGE SUMMARY's attack half — the committed outcome,
                 restating exactly what the setup promised: who fell back,
                 their transition, their reward (or the named void / skip). -->
            <div v-if="espCommit !== undefined" class="con-hydro__espline con-hydro__espline--result">
              <template v-if="espCommit.target !== undefined">
                <span class="con-hydro__roster-dot" :class="'player_bg_color_' + espCommit.target.color" aria-hidden="true"></span>
                <span class="con-hydro__espline-name">{{ espCommitTargetName }}</span>
                <span class="con-hydro__route con-hydro__route--back">
                  <span>{{ espCommit.target.from }}</span>
                  <span aria-hidden="true">→</span>
                  <b>{{ espCommit.target.to }}</b>
                </span>
                <span v-if="espCommitTargetView.skippedKey !== undefined" class="con-hydro__esprow-skip">{{ $t(espCommitTargetView.skippedKey) }}</span>
                <template v-else-if="espCommitTargetView.chipOptions.length > 0">
                  <span class="con-hydro__espline-gets">{{ $t('received') }}</span>
                  <span class="con-hydro__esp-chips">
                    <template v-for="(opt, oi) in espCommitTargetView.chipOptions" :key="oi">
                      <span v-if="oi > 0" class="con-hydro__stop-or">{{ $t('or') }}</span>
                      <HydroReward :chips="opt" :compact="true" />
                    </template>
                  </span>
                </template>
              </template>
              <span v-else class="con-hydro__esprow-skip">{{ $t('The attack was skipped — no legal target') }}</span>
              <span v-if="espCommit.waivedTag !== undefined" class="con-hydro__espwaiver">
                <span>{{ $t('Ignored tag') }}</span>
                <span class="con-hydro__stop-tag resource-tag" :class="'tag-' + espCommit.waivedTag" aria-hidden="true"></span>
              </span>
            </div>
            <!-- A TRAVERSAL's result reads PER STAGE, in path order: each stop's
                 own deltas under its name, the excluded 2 VP named, a declined
                 pick named (no silent loss — the console-wide rule). -->
            <div v-if="commitRec.traversal !== undefined" class="con-hydro__result-stages">
              <div v-for="seg in commitRec.traversal" :key="seg.position" class="con-hydro__result-stagerow"
                   :class="{'con-hydro__result-stagerow--excl': seg.kind === 'excluded'}">
                <span class="con-hydro__result-stagename"><b>{{ seg.position }}</b> {{ $t(seg.stageNameKey) }}</span>
                <span v-if="seg.kind === 'excluded'" class="con-hydro__result-note">
                  {{ $t('Excluded — claimed only by stopping there') }}
                </span>
                <template v-else>
                  <span v-for="(l, i) in seg.rewardLines" :key="i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
                    <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
                      <span class="con-hydro__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
                    </span>
                    <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
                    <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
                  </span>
                  <span v-if="seg.kind === 'deck-draw'" class="con-hydro__result-note">{{ $t('Cards drawn and chosen') }}</span>
                  <span v-else-if="seg.kind === 'repeat' && seg.selectedCard !== undefined" class="con-hydro__result-note">{{ repeatNote(seg.selectedCard) }}</span>
                  <span v-else-if="seg.kind === 'card-resource' && seg.selectedCard !== undefined" class="con-hydro__result-note">{{ resourcesOntoNote(seg.selectedCard) }}</span>
                  <span v-else-if="seg.waived === true" class="con-hydro__result-note">{{ $t(seg.position === 7 ? 'Action copy declined' : 'Animal placement declined') }}</span>
                </template>
              </div>
              <span v-if="commitRec.vp !== undefined" class="con-hydro__vpline">
                <span class="con-hydro__stage-vp">{{ commitRec.vp }} {{ $t('VP') }}</span>
                <span>{{ $t('VP at game end') }}</span>
              </span>
            </div>
            <div v-else class="con-hydro__result-rows">
              <span v-for="(l, i) in commitRec.rewardLines" :key="i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
                <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
                  <span class="con-hydro__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
                </span>
                <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
                <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
              </span>
              <span v-if="commitRec.vp !== undefined" class="con-hydro__vpline">
                <span class="con-hydro__stage-vp">{{ commitRec.vp }} {{ $t('VP') }}</span>
                <span>{{ $t('VP at game end') }}</span>
              </span>
              <span v-if="commitRec.kind === 'repeat' && commitRec.selectedCard !== undefined" class="con-hydro__result-note">
                {{ repeatNote(commitRec.selectedCard) }}
              </span>
              <span v-else-if="commitRec.kind === 'card-resource' && commitRec.selectedCard !== undefined" class="con-hydro__result-note">
                {{ resourcesOntoNote(commitRec.selectedCard) }}
              </span>
              <!-- The FORFEIT, named — a consciously declined target reward may
                   never end as a silent nothing (cross-cutting «no silent
                   loss»): the result states which effect was declined. -->
              <span v-else-if="commitRec.waivedTarget === true" class="con-hydro__result-note">
                {{ $t(waivedNoteKey) }}
              </span>
            </div>
            <!-- «ДОПОЛНИТЕЛЬНО», frozen — the SAME rows the plan panel
                 promised before the confirm, in the same language, now stating
                 what arrived. The source card is named here too: the heat that
                 just flew into the rail came from the MOVEMENT, not from the
                 landed stage, and the result may not leave that unsaid. -->
            <div v-if="(commitRec.movementBonuses ?? []).length > 0" class="con-hydro__gains-extra">
              <span class="con-hydro__section-label con-hydro__section-label--extra">{{ $t('Additionally') }}</span>
              <span v-for="(b, i) in commitRec.movementBonuses" :key="i" class="con-hydro__extra">
                <b class="con-hydro__extra-src">{{ $t(b.card) }}</b>
                <span class="con-hydro__delta">
                  <span class="con-hydro__delta-ico">
                    <span class="con-hydro__delta-img" :class="extraIconClass(b)" aria-hidden="true"></span>
                  </span>
                  <span class="con-hydro__beforeafter"><b>{{ b.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ b.after }}</b></span>
                  <span class="con-hydro__plus">+{{ b.amount }}</span>
                </span>
              </span>
            </div>
            <!-- The standing track rule, restated where it applied: stages
                 passed over paid nothing — the count, never a roster. -->
            <div v-if="(commitRec.skippedCount ?? 0) > 0" class="con-hydro__result-skip">
              {{ resultSkippedText }}
            </div>
          </div>
        </div>
          </transition>
        </div>

        <!-- ═══ ACT — the persistent action column: the decision's own verbs,
             in ONE physical home whatever the substate. The COLUMN never
             unmounts (a column that came and went re-measured the flow zone
             under a leaving layer — the mid-transition reflow this shell
             exists to ban); its content crossfades. A substate with no
             standing verb (the commit beat, the target grid — their verbs
             live on the ONE bottom bar) keeps the column as composed air. ═══ -->
        <div class="con-hydro__act" :data-hydro-status="statusKind">
          <transition name="con-hydro-act">
            <!-- PREVIEW / plan: the omission warning (reserved line) + the
                 primary, or the disabled verdict with its honest reasons. -->
            <div v-if="actKey === 'plan'" key="plan" class="con-hydro__ctazone">
              <!-- THE DECISION RAIL — every interactive pre-select of this
                   step, top to bottom in game resolution order, directly
                   above the final CTA. The screen's vertical order IS the
                   ↑/↓ focus order; the stack pins to the top of the column
                   and the CTA keeps its bottom berth whatever appears,
                   resolves or fizzles above it. -->
              <ConsoleHydroDecisionRail :decisions="railDecisions"
                                        :focusNode="sceneFocus"
                                        :repeatNode="repeatNode"
                                        :animalCurrent="selectedAnimalCurrent"
                                        @open="focusAndOpenRail" />
              <p class="con-hydro__pickwarn" :class="{'con-hydro__pickwarn--on': pickWarned && planPickMissing}" role="status">
                <span v-if="pickWarned && planPickMissing">
                  {{ $t(pickWarningKey) }}
                </span>
              </p>
              <button v-if="primaryVerb !== 'blocked'" type="button"
                      class="con-hydro__cta"
                      :class="{
                        'con-hydro__cta--configure': primaryVerb !== 'reinforce',
                        'con-hydro__cta--pending': planPickMissing,
                        'con-hydro__cta--focused': sceneFocus === 'cta',
                      }"
                      @click="onPrimary">
                <!-- The badge's berth is permanent; its VISIBILITY follows the
                     cursor (one lit «A» on screen — the pick row owns it while
                     the pre-select is owed). Mounted conditionally it resized
                     the plate on every focus move. -->
                <span class="con-glyphslot" :class="{'con-glyphslot--ghost': !ctaFocused}" aria-hidden="true">
                  <GamepadGlyph control="confirm" />
                </span>
                <span>{{ $t(primaryLabel) }}</span>
              </button>
              <!-- The refused act and its WHY are one verdict block — the
                   plate and the reasons share a chassis, so the screen states
                   «недоступно, потому что…» once, not two competing panels. -->
              <div v-else class="con-hydro__verdict">
                <div class="con-hydro__cta con-hydro__cta--disabled" aria-disabled="true">
                  <span class="con-glyphslot" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
                  <span>{{ $t('Reinforce the hydronetwork') }}</span>
                </div>
                <div class="con-hydro__reasons">
                  <div v-if="requirementsUnmet" class="con-hydro__reason">
                    <span>{{ $t('Stage requirements are not met') }}</span>
                  </div>
                  <!-- The tone is the reason's OWN semantics: a turn gate is
                       amber «не сейчас», a track rule is the red ✕. -->
                  <div v-for="(r, i) in ctaReasons" :key="i" class="con-hydro__reason"
                       :class="{
                         'con-hydro__reason--todo': !r.blocking,
                         'con-hydro__reason--notnow': r.blocking && reasonTone(r) === 'warning',
                       }">
                    <span>{{ reasonText(r) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- DETAILS / a bar-driven substate: nothing to press — the
                 column stands, quietly. -->
            <div v-else-if="actKey === 'details' || actKey === 'quiet'" :key="actKey" class="con-hydro__ctazone"></div>

            <!-- REWARD CHOICE: the step's own commit — always in layout, live
                 once an option is actually held. An OPTIONAL source move keeps
                 its refusal reachable here too (the rules still allow it until
                 the commit), as the same calm secondary it is on the offer. -->
            <div v-else-if="actKey === 'choice'" key="choice" class="con-hydro__ctazone">
              <button type="button"
                      class="con-hydro__cta"
                      :class="{
                        'con-hydro__cta--disabled': rewardChoice === undefined,
                        'con-hydro__cta--armed': choiceStage === 'confirm' && !choiceSkipFocus,
                      }"
                      :aria-disabled="rewardChoice === undefined ? 'true' : undefined"
                      @click="confirmChoiceStep">
                <span class="con-glyphslot" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
                <span>{{ $t(choiceCommitLabel) }}</span>
              </button>
              <button v-if="advanceOffer !== undefined && bonusSkipOffered"
                      type="button"
                      class="con-hydro__bonus-action con-hydro__bonus-action--decline"
                      :class="{'con-hydro__bonus-action--focused': choiceSkipFocus}"
                      :disabled="bonusSubmitting"
                      @click="answerBonus(false)">
                <span class="con-glyphslot con-hydro__bonus-action-a"
                      :class="{'con-glyphslot--ghost': !choiceSkipFocus}" aria-hidden="true">
                  <GamepadGlyph control="confirm" />
                </span>
                <span class="con-hydro__bonus-action-title">{{ $t(bonusCopy.skipKey) }}</span>
              </button>
            </div>

            <!-- PAYMENT: the FINAL act — the same server-authoritative
                 reinforce the single-allocation path fires from Configure. -->
            <div v-else-if="actKey === 'payment'" key="payment" class="con-hydro__ctazone">
              <button type="button" class="con-hydro__cta" @click="onPaymentConfirm">
                <span class="con-glyphslot" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
                <span>{{ $t('Reinforce the hydronetwork') }}</span>
              </button>
            </div>

            <!-- REWARD-ONLY PICK: the ask's status (a reserved line — the act
                 column may not re-seat the CTA when it appears) + the ONE
                 confirm that RETURNS the draft to the asking composer. It
                 never says «Укрепить» — nothing moves. -->
            <div v-else-if="actKey === 'reward-pick'" key="reward-pick" class="con-hydro__ctazone">
              <p class="con-hydro__pickwarn" :class="{'con-hydro__pickwarn--on': rewardAskLabel !== ''}" role="status">
                <span v-if="rewardAskLabel !== ''">
                  <span v-if="rewardFocusAsk?.answered === true" class="con-hydro__bonus-tick" aria-hidden="true"></span>
                  <span v-else class="con-hydro__pickwarn-mark con-hydro__pickwarn-mark--ask" aria-hidden="true"></span>
                  {{ $t(rewardAskLabel) }}
                </span>
              </p>
              <button type="button"
                      class="con-hydro__cta"
                      :class="{
                        'con-hydro__cta--disabled': !rewardPickReady,
                        'con-hydro__cta--focused': sceneFocus === 'cta',
                      }"
                      :aria-disabled="!rewardPickReady ? 'true' : undefined"
                      @click="onRewardPickPrimary">
                <span class="con-glyphslot" :class="{'con-glyphslot--ghost': sceneFocus !== 'cta'}" aria-hidden="true">
                  <GamepadGlyph control="confirm" />
                </span>
                <span>{{ $t('Select the stage reward') }}</span>
              </button>
            </div>

            <!-- BONUS: the SAME primary the player's own advance wears, named
                 by the NEXT REQUIRED INTERACTION («Выберите награду» over an
                 unresolved stage choice, «Укрепить гидросеть» when ready) —
                 the source explains WHY the move exists, it never renames the
                 decision. The optional refusal stays a calm SECONDARY beneath
                 it (a decision, never dimmed; only where the server framed
                 one — a card ENTRY's way out is B). While the answer is in
                 flight both are inert — by state, not by a guard. -->
            <div v-else-if="actKey === 'bonus'" key="bonus" class="con-hydro__ctazone">
              <!-- THE SAME DECISION RAIL as the plan scene — one component,
                   one focus contract, whatever door opened the move. -->
              <ConsoleHydroDecisionRail :decisions="railDecisions"
                                        :focusNode="sceneFocus"
                                        :repeatNode="repeatNode"
                                        :animalCurrent="selectedAnimalCurrent"
                                        @open="focusAndOpenRail" />
              <p class="con-hydro__pickwarn" :class="{'con-hydro__pickwarn--on': pickWarned && bonusPickMissing}" role="status">
                <span v-if="pickWarned && bonusPickMissing">
                  {{ $t(pickWarningKey) }}
                </span>
              </p>
              <button type="button"
                      class="con-hydro__cta"
                      :class="{
                        'con-hydro__cta--configure': bonusPrimary.verb !== 'reinforce',
                        'con-hydro__cta--pending': bonusPrimary.pending,
                        'con-hydro__cta--focused': sceneFocus === 'bonus-confirm',
                      }"
                      :disabled="bonusSubmitting"
                      @click="answerBonus(true)">
                <span class="con-glyphslot"
                      :class="{'con-glyphslot--ghost': sceneFocus !== 'bonus-confirm'}" aria-hidden="true">
                  <GamepadGlyph control="confirm" />
                </span>
                <span>{{ $t(bonusPrimary.label) }}</span>
              </button>
              <button v-if="bonusSkipOffered"
                      type="button"
                      class="con-hydro__bonus-action con-hydro__bonus-action--decline"
                      :class="{'con-hydro__bonus-action--focused': sceneFocus === 'bonus-skip'}"
                      :disabled="bonusSubmitting"
                      @click="answerBonus(false)">
                <span class="con-glyphslot con-hydro__bonus-action-a"
                      :class="{'con-glyphslot--ghost': sceneFocus !== 'bonus-skip'}" aria-hidden="true">
                  <GamepadGlyph control="confirm" />
                </span>
                <span class="con-hydro__bonus-action-title">{{ $t(bonusCopy.skipKey) }}</span>
              </button>
            </div>

            <!-- RESULT: the one continue — the same plate, the same home. -->
            <div v-else key="result" class="con-hydro__ctazone">
              <button type="button" class="con-hydro__cta" @click="$emit('result-done')">
                <span class="con-glyphslot" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
                <span>{{ $t('Continue') }}</span>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup vapor lang="ts">
/*
 * A NESTED FULL SCREEN GETS THE SCENE (`frameSteps: 'scene'`): while a
 *       workspace stands inside this one — the colonies a repeated «Летающая
 *       платформа» opens — the track stops being DRAWN and the guest owns the
 *       band. The frame stays in the stack, so the guest's header still says
 *       whose flow this is.
 *
 *       ⚠️ A CLASS, NOT `v-show`, and the difference is the whole bug it cost:
 *       `display: none` takes this surface OUT OF LAYOUT, and a workspace screen
 *       in `.con-main` is a FLEX CHILD — so on the way back it re-entered the row
 *       beside the guest's still-running leave and was squeezed into half a band,
 *       cropped, with no re-fit coming. `visibility` keeps the box: the geometry
 *       never changes, there is nothing to re-solve, and the marker layer stays
 *       measurable for the walk that is merely parked. (The guest is a FIXED band
 *       while it owns the scene — `.con-colonies--scene` — so it never competes
 *       for this room either. Both halves are needed: either alone still lets one
 *       surface steal the other's width.)
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * CONSOLE HYDRONETWORK WORKSPACE — the console-NATIVE «Гидросеть Марса» as a
 * full North-Star workspace (the rework of the old section + confirm modal).
 *
 * ONE FLOW: preview → pre-select (reward choice / target pick / the stage-7
 * repeat bridge) → summary → A «Укрепить гидросеть» → marker glide →
 * resolution ON the landed stage (reward wave / embedded deck pick / repeated
 * action / VP ceremony) → result → close. The commit modal is GONE; every
 * stage is a layer of the scene under the permanently standing track.
 *
 * Shared brain untouched: hydroNetworkState (plan), buildHydroModel (pure),
 * buildRewardView (deltas), hydroPlanReasons (specific reasons) — payloads and
 * legality stay byte-identical with the frozen desktop overlay.
 *
 * The flow's phase machine lives in consoleHydroFlow (module state — survives
 * a park); this component renders it and routes input.
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {gsap} from 'gsap';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleSourceDock from '@/client/components/console/ConsoleSourceDock.vue';
import ConsoleHydroDecisionRail from '@/client/components/console/hydroFlow/ConsoleHydroDecisionRail.vue';
import {HYDRO_PICK_COPY, HYDRO_RAIL_CTA, HydroPickKind, HydroRailDecision, buildHydroDecisions, buildTraversalDecisions, initialRailFocus, nextRailFocus, planConflictReasonKey, claimConflictReasonKey, railFocusNodes, railIdOf, railNodeOf, railStep} from '@/client/console/hydroFlow/hydroDecisionRail';
import ConsoleHydroPlanSteps from '@/client/components/console/hydroFlow/ConsoleHydroPlanSteps.vue';
import ConsoleHydroGains from '@/client/components/console/hydroFlow/ConsoleHydroGains.vue';
import {HydroPlanDecision} from '@/client/console/hydroFlow/hydroPlanSteps';
import {deckPickState} from '@/client/console/deckPick/consoleDeckPick';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {buildEnergyMixView, clampEnergyMixSteel, PaymentView} from '@/client/console/paymentPlan';
import {choiceSourceView} from '@/client/console/promptSource';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {actionPreviewMap, previewBranchByIndex} from '@/client/console/actionPreviewStore';
import {claimRepeatInfeasible, claimTollOf} from '@/client/console/hydroFlow/hydroResourcePlan';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DeltaTrackDestination, DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {EffectForecast} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import ConsoleForecastDoor from '@/client/components/console/ConsoleForecastDoor.vue';
import ConsoleForecastLayer from '@/client/components/console/ConsoleForecastLayer.vue';
import {forecastLayerAvailable, reactionChipsOf, VariantReaction} from '@/client/console/effectForecastModel';
import {closeEffectForecastLayer, effectForecastOpen, forecastExplorerUi, forecastStageText} from '@/client/console/consoleEffectForecast';
import {foldForecastHost, forecastHostIntent, forecastOwnerColors as forecastOwnerColorsOf, forecastStatsByColor as forecastStatsByColorOf, openForecastHost, pulseForecastDoor} from '@/client/console/consoleForecastHost';
import {$t, translateCardName, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {buildHydroModel, HydroModel, HydroStageHistoryEntry, HydroStageVM, HydroTraversalStagePlan} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HYDRO_STAGES, HydroStage, HydroRewardChip, hydroStageNeedsChoice} from '@/client/components/hydronetwork/hydroStages';
import {buildRewardView, buildTraversalRewardViews, HydroDeltaLine, HydroPlayerSnapshot, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {destinationAt, gradeDestination, HydroReason, hydroPlanReasons, hydroPrimaryBlocker, hydroReasonBlocker, hydroRuleBlocked, HydroStopGrade, HydroTurnState, hydroTurnStateOf} from '@/client/components/hydronetwork/hydroReasons';
import {AvailabilityBlocker} from '@/common/availability/AvailabilityBlocker';
import {ACTION_MENU_TITLES} from '@/common/inputs/actionMenuTitles';
import {Message} from '@/common/logs/Message';
import {fetchHydroPreview, hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {hydroMarkerState, resetHydroMarker} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroRewardTransfers} from '@/client/console/hydroMarker/hydroRewardTransfers';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {HydroCommitRecord, HydroTraversalSegmentRecord, closeHydroStep, hydroDraftFresh, hydroFlowIsOwnedByCurrentFrame, hydroFlowSetAside, hydroFlowState, hydroWorkspacePhase, hydroWorkspaceRestorePlan, markHydroCeremonyPlayed, noteHydroDraftTouched, openHydroStep, registerHydroCeremonyStarter, resetHydroFlow, resolutionKindFor, setHydroCeremonyActive} from '@/client/console/hydroFlow/consoleHydroFlow';
import {hydroActiveStepSourceCard, hydroParkedForeignStop, hydroTraversalPending, noteHydroLandPresence} from '@/client/console/hydroMarker/consoleHydroMarker';
import {buildHydroTargetModel, hydroPresentedTargetModel} from '@/client/console/hydroFlow/hydroTargetStep';
import {HydroCeremonyHandle, armHydroSceneOrigin, hydroSceneCancelledHook, hydroSceneEnterHook, hydroSceneLeaveHook, playHydroBridgeReturn, runHydroCeremony} from '@/client/console/hydroFlow/consoleHydroFlowMotion';
import {PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir, findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt, reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia, stepPlayedTargetOwner} from '@/client/console/played/consolePlayedTargetModel';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {backLabelForVerb, backVerbWithOwedPrompt, WorkspaceBackVerb} from '@/client/console/consoleWorkspaceFlow';
import {getCard} from '@/client/cards/ClientCardManifest';
import {reasonParams} from '@/client/cards/tagLabel';
import {DeltaOfferOrigin, HYDRO_PRIMARY_KEY, HydroNextInteraction, hydroAdvanceCopy, hydroNextInteraction, hydroZoneState} from '@/client/console/hydroFlow/hydroBonusOffer';
import type {DeltaRewardDraft, DeltaRewardPickRequest} from '@/client/console/hydroFlow/deltaRewardEntry';
import type {DeltaEspionagePickRequest} from '@/client/console/hydroFlow/deltaEspionageEntry';
import type {DeltaBlockadePickRequest} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import type {DeltaEspionageTargetProjection} from '@/common/models/DeltaEspionageModel';
import type {DeltaBlockadeTargetProjection} from '@/common/models/DeltaBlockadeModel';
import {espionageOutcomeView, EspionageOutcomeView} from '@/client/console/hydroFlow/espionageOutcomeView';
import type {DeltaAdvanceOffer, DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {cardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {WorkspaceFrameKind, setWorkspaceFrameSlot, setWorkspaceFrameSourceCard, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameEmblem, workspaceFrameHost, workspaceFrameRoot, workspaceHostYieldsScene, workspaceStackCrumb} from '@/client/console/consoleWorkspaceStack';
import {retractWorkspaceOutcomeSlot, setWorkspaceOutcomeSlot, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {captureSurfaceDeparture, holdCarriedAnchors} from '@/client/console/surfaceMotion/surfaceMotionState';
import {useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';
import {vEmbedZone} from '@/client/directives/vDirectives';

/** Reason kinds the «Требования» row already shows as red marks — the CTA
 *  zone folds them into one pointer line instead of duplicating. */
const REQUIREMENT_REASON_KINDS: ReadonlySet<string> = new Set(['missing-tag', 'energy-deficit', 'no-energy']);
/** The hydro workspace's own embed zone (the ONE slot both the outcome claim
 *  and a hosted frame teleport into). */
const HYDRO_EMBED_SLOT = '[data-embed-slot="hydro"]';
/** The prompt title as plain text (i18n rewrites a Message's `.message` in
 *  place, but never the action-menu OrOptions title — see turnState). */
function titleText(t: string | Message | undefined): string {
  if (t === undefined) {
    return '';
  }
  return typeof t === 'string' ? t : t.message;
}
type RailStop = {
  position: number;
  vm: HydroStageVM;
  grade: HydroStopGrade | undefined;
  linkKind: 'done' | 'route' | 'dim';
};
type GroupNode = ActionGroup['nodes'][number];
type SceneKey = 'preview' | 'choice' | 'target' | 'payment' | 'bonus' | 'reward-pick' | 'espionage-pick' | 'blockade-pick' | 'blockade-exec' | 'commit' | 'result';
/** One espionage candidate row — the projection's entry joined with the
 *  player's display identity and the shared outcome reading. */
type EspionageRow = {
  target: DeltaEspionageTargetProjection;
  name: string;
  isBot: boolean;
  view: EspionageOutcomeView;
  /** Why the row cannot be confirmed (an i18n key) — blocked rows only. */
  blockKey: string;
};
/** One BLOCKADE candidate row (Modular Floodgates, DP11) — the projection's
 *  entry joined with the player's display identity. No outcome view: a
 *  blockade grants nothing — the row's reading is the standing ban itself. */
type BlockadeRow = {
  target: DeltaBlockadeTargetProjection;
  name: string;
  isBot: boolean;
  /** Why the row cannot be confirmed (an i18n key) — blocked rows only. */
  blockKey: string;
};
/** One BLOCKADE GATE one rail cell shows — the persistent standing state
 *  (`active`) and the pick's cursor-following preview (`ghost`). */
type BlockadeGate = {
  /** The BLOCKED player (the gate carries their colour accent). */
  target: Color;
  state: 'active' | 'ghost';
};
/** The scene cursor's stops. Rail decisions are DATA-driven nodes
 *  (`rail:<id>` — see `hydroDecisionRail.ts`); the rest are the scenes' own
 *  fixed stops. The spatial ↑/↓ order and this graph are the same fact. */
type HydroSceneFocus = 'track' | 'cta' | 'bonus-source' | 'bonus-confirm' | 'bonus-skip' | `rail:${string}`;
/**
 * THE CONTEXT COLUMN'S VIEW — one derivation for every substate, so the
 * identity anchor can never change scale or meaning between two frames of the
 * same flow. Past the commit it is FROZEN off the record; under a live offer
 * it is the granting card; otherwise it is the live selected stage.
 */
type HydroCtxView = {
  kind: 'stage' | 'source';
  /** The granting card (the `source` variant). */
  source?: CardName;
  /** The stage glyph (the `stage` variant): tag, VP or the start flag. */
  tag?: Tag;
  vp?: number;
  nameKey?: string;
  posText?: string;
  /** The state chip — rendered into a RESERVED slot. */
  badge?: {kind: string; text: string};
  /** The route + price — ONE grammar, every substate that has a move. */
  /** `priced: false` — the price is read ONCE, on the sheet's «ЦЕНА» line (FI · EG-1); the route names the move only. */
  route?: {from: number; to: number; energy: number; steel: number; free: boolean; priced?: boolean};
};

defineOptions({name: 'ConsoleHydroSection'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  actionAvailable: {type: Boolean, default: false},
  /** Preview refetch scope — generation + gameAge + undoCount. */
  cacheKey: {type: String, default: ''},
  /** A follow-up decision of the committed advance is standing (the shell's
   *  live fact — turns the resolving beat into the collapsible phase). */
  followUpLive: {type: Boolean, default: false},
  /** An embedded DRAWN-CARDS batch owns the hydro stage (a repeated
   *  action's own draw presenting in this workspace's zone) — the shell's
   *  fact; joins the deck pick under the immersive pose. */
  revealEmbedded: {type: Boolean, default: false},
  /**
   * A CARD-GRANTED BONUS MOVE the player has not answered yet — the server's
   * own `deltaBonusPrompt`, already ADMITTED by the shell (the door waits out
   * the placement's whole arrival chain, drawn cards included). The section
   * renders the verdict and never re-decides any part of it.
   */
  bonusOffer: {type: Object as PropType<DeltaBonusPromptMeta>, default: undefined},
  /**
   * THE SERVER IS WAITING ON THIS WORKSPACE — the RAW `deltaBonusPrompt` is
   * standing, admitted or not.
   *
   * Structural, and deliberately NOT `bonusOffer !== undefined`: the offer
   * prop is the ADMITTED one (the door holds it back while the placement's
   * own drawn cards are still being taken), and during that window the prompt
   * is very much owed even though there is nothing to paint yet. Two
   * consumers that must agree: B's verb (never close out of an owed prompt)
   * and the turn state (never «завершите текущее действие» about the very
   * decision this screen exists to take).
   */
  ownsPrompt: {type: Boolean, default: false},
  /**
   * A move on this track the player CHOSE inside a card's own action (Storm
   * Surge Barrier's advance mode) — the SERVER's description of it, carried
   * from the card's action preview.
   *
   * The other provenance of the very same offer. Nothing is on the wire yet:
   * the whole step is a pre-commit draft, so this workspace presents it with
   * every mechanism it already owns (destination, requirements, reward,
   * pre-select) and the ONE confirm at the end sends the card's whole batch.
   */
  cardOffer: {type: Object as PropType<DeltaAdvanceOffer>, default: undefined},
  /**
   * A REWARD-ONLY STAGE PICK (Dutch Mountains): the workspace is a pure
   * SELECTION surface — the player studies the track, picks ONE claimable
   * (reached, non-Jovian, non-VP) stage and its nested pre-selects, and the
   * resolve RETURNS to the asking composer. No movement is presented, no
   * route, no price, nothing submits from here: the marker shows the real
   * position throughout, and the final commit is the composer's own batch.
   * `claimable` is the SERVER's list (the input model's) — never re-derived.
   */
  rewardOffer: {type: Object as PropType<DeltaRewardPickRequest>, default: undefined},
  /**
   * THE ESPIONAGE TARGET PICK (Corporate Espionage): the workspace is a
   * projection + selection surface — every candidate with the SERVER's own
   * `from → to` and resulting reward, the owner's own advance beside them,
   * ghost markers on the track for both. The resolve RETURNS the chosen
   * target to the asking play composer; nothing moves, nothing submits.
   * The projection is the server's ({@link DeltaEspionagePickRequest}).
   */
  espionageOffer: {type: Object as PropType<DeltaEspionagePickRequest>, default: undefined},
  blockadeOffer: {type: Object as PropType<DeltaBlockadePickRequest>, default: undefined},
  /** The committed DEPLOY's execution view: the fresh gate assembles on the
   *  track (its entry transition — the element enters with the applied
   *  response) and the scene settles into the ambient standing state. */
  blockadeExecution: {type: Object as PropType<{target: Color, source: CardName}>, default: undefined},
  /**
   * The HOST frame's own header is OFF SCREEN (the hand section yields its
   * flex row while a hydro frame stands over it — the espionage flows), so
   * the ghost contract inverts: THIS head draws the stack's crumb itself.
   * Same text either way — `headSubject`/`crumbRoot` already read the
   * STACK — only which DOM node paints it changes.
   */
  hostHeadHidden: {type: Boolean, default: false},
});
const emit = defineEmits(['close', 'confirm', 'pick', 'notice', 'collapse', 'result-done', 'bonus-answer', 'card-advance', 'inspect-source', 'reward-picked', 'espionage-picked', 'blockade-picked']);

const {reduced: reducedMotion} = useConsoleReducedMotion();
// The section's own scope (`flowScope` — `flow` is the hydro flow's state here): its timers end with it.
const flowScope = useFlowScope('hydro-section');
const forecastLayer = useTemplateRef<ExposedOf<typeof ConsoleForecastLayer>>('forecastLayer');
const railEl = useTemplateRef<HTMLElement>('railEl');
const panelBody = useTemplateRef<HTMLElement>('panelBody');
const ctxEl = useTemplateRef<HTMLElement>('ctxEl');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const targetZone = useTemplateRef<HTMLElement>('targetZone');
const targetStep = useTemplateRef<{cells?: () => ReadonlyArray<PlayedTargetCell>} & {ensureFocusVisible?: () => void}>('targetStep');
const cereSeat = useTemplateRef<HTMLElement>('cereSeat');
const sceneEl = useTemplateRef<HTMLElement>('sceneEl');
const cereValue = useTemplateRef<HTMLElement>('cereValue');
const forecastPulse = ref(false);
let pulseCall: {kill: () => void} | undefined;
const flow = hydroFlowState;
const landings = cardResourceLandings;
/** The MOVEMENT LINK paths (measured off the real marker rows) — see
 *  the rail's SVG overlay. Rebuilt on spec/layout changes; px values
 *  live in the rail's own coordinate space, so they scale with it. */
const ghostLinkPaths = ref<Array<{key: string, d: string, tip: string, dir: 'fwd' | 'back'}>>([]);
/** The settle re-measure timer (the focused cell's growth re-lays the
 *  rail out over the stopin transition) — its cancel (a timer of `flowScope`). */
let ghostLinkTimer: (() => void) | undefined;
let ghostLinkRo: ResizeObserver | undefined;
/**
 * The player's Delta Works mix PREFERENCE — the steel share they dialed
 * (bumpers). The EFFECTIVE steel is this clamped to the live
 * [minSteelForSpend, maxSteelForSpend] range (see `mixSteel`), so a
 * destination/cost change re-clamps without spending anything silently,
 * and 0 keeps the energy-first default (steel covers only the deficit).
 */
const steelPreference = ref(0);
/**
 * The player's Modular Floodgates share — a PROTECTED pool, so it starts
 * at 0 and moves only on the player's own press (the model clamps it).
 */
const floodgatePreference = ref(0);
/** The lane the payment substep's bumpers dial when two lanes stand
 *  (↑/↓ switch it): stock steel or the Floodgates' steel. */
const mixLane = ref('steel' as 'steel' | 'floodgateSteel');
/** Re-keys the payment panel's one-shot pulse on each dial press. */
const mixFlashNonce = ref(0);
/** Where the cursor stood when the payment substep opened — B restores
 *  it, so the walk back lands where the walk in left. */
const paymentReturnFocus = ref('track' as HydroSceneFocus);
/** Scene focus. The DECISION RAIL's nodes are data-driven
 *  (`rail:<decision id>`); `track`/`cta` are the plan scene's own stops,
 *  `bonus-*` the offer scene's. One spatial order, one graph. */
const sceneFocus = ref('track' as HydroSceneFocus);
/**
 * A CONFIRM WAS ATTEMPTED WITH THE LANDED STAGE'S PICK STILL MISSING.
 *
 * The first press is a HEADS-UP that names the stake; the second press is
 * taken at face value. WHAT THE STAKE IS depends on the door. On the two
 * WAIVABLE roads (the player's own advance, a card's entry) the batch
 * carries the decision itself (`waiveTarget` → the server defers no
 * follow-up ask), so the second press FORFEITS the reward: «если не
 * выбрал — значит не надо», and the flow ends where the player left it
 * instead of raising a question they have already declined. The DOB
 * prompt door answers with a bare `OrOptions` index and cannot carry a
 * waive, so there the second press still postpones the pick into the
 * embedded follow-up — and its own warning says exactly that.
 */
const pickWarned = ref(false);
/** The bonus answer is in flight — both CTAs are inert until the server replies. */
const bonusSubmitting = ref(false);
/** The reward picker's focused option (pos 1/2). */
const choiceFocus = ref(0);
/** The TRAVERSAL stage the reward-choice step is editing (a rail
 *  decision opened it scoped to its own stop) — undefined for the
 *  single-landing step, whose stage is the plan target. */
const choicePosition = ref<number | undefined>(undefined);
/** Where the cursor stands INSIDE the reward step: on the options, or
 *  on the commit that follows them (the step confirms itself). */
const choiceStage = ref('options' as 'options' | 'confirm');
/** The cursor stands on the OPTIONAL REFUSAL beneath the step's commit
 *  (a server-framed offer only) — one more ↓ past the confirm. */
const choiceSkipFocus = ref(false);
/** The player has moved the cursor BY HAND inside the current decision
 *  revision — that revision never re-seats them again (state-driven
 *  focus, not a watcher that keeps calling `.focus()`). */
const focusMoved = ref(false);
/** The next `pickDecisionKey` change is the player's OWN track walk —
 *  armed inside `selectPosition` (past its no-op guard, so a clamped
 *  walk can never leave it latched), consumed by the watcher's flush,
 *  so an external revision can never ride it. */
const selfKeyChange = ref(false);
/** The deck-pick flow's state (module reactive), under the name this script reads it by. */
const flowDeck = deckPickState;
/** The target step's cursor (pos 9). */
const targetFocus = ref<PlayedTargetFocus | undefined>(undefined);
const targetZoneW = ref(0);
const targetZoneH = ref(0);
/**
 * THE CURSOR'S INITIAL SEAT IS OWED, not decided at setup.
 *
 * «Does this stage owe a pick?» is answered by the track PREVIEW, and the
 * preview is fetched in `onMounted` — so at setup the answer is always
 * «no» and the cursor parked on a confirm that cannot fire, beside a
 * pre-select row nobody was pointed at. The seat is therefore CLAIMED
 * here and applied by the first frame that can actually answer.
 */
const seatOwed = ref(false);
/** One-shot: the ceremony has been started for this commit. */
const cereStarted = ref(false);
let cereHandle: HydroCeremonyHandle | undefined;
/** The cell whose presented card's PRESENCE this instance reported —
 *  the leave handshake (`onLandCardLeft`) releases exactly it. */
const landReportedPosition = ref(-1);
/** The blockade selector's CURSOR — an index into `blockadeRows`
 *  (the same focus/selection split the espionage pick keeps). */
const blockadeFocusIdx = ref(0);
/** The espionage selector's CURSOR — an index into `espionageRows`
 *  (blocked rows are focusable so their reason stays readable). Focus
 *  alone changes the track's ghost projection and nothing else. */
const espionageFocusIdx = ref(0);

const markerGliding = computed((): boolean => {
  return hydroMarkerState.active;
});
const markerFrom = computed((): number => {
  return hydroMarkerState.fromPosition;
});
const markerSettled = computed((): number => {
  return hydroMarkerState.settledPosition;
});
const viewerColor = computed((): Color => {
  return props.playerView.thisPlayer.color;
});
const preview = computed((): DeltaTrackPreviewModel | undefined => {
  return hydroNetworkState.previewColor === viewerColor.value ? hydroNetworkState.preview : undefined;
});
const rewardChoice = computed((): number | undefined => {
  return hydroNetworkState.rewardChoice;
});
const model = computed((): HydroModel => {
  const players = props.playerView.players.map((p) => ({
    color: p.color,
    name: p.name,
    position: p.deltaProject?.position ?? 0,
    isViewer: p.color === viewerColor.value,
    isMarsBot: p.isMarsBot === true,
    stops: p.deltaProject?.stops ?? [],
  }));
  const p = props.playerView.thisPlayer;
  return buildHydroModel({
    preview: preview.value,
    players,
    viewerColor: viewerColor.value,
    selectedPosition: hydroNetworkState.selectedPosition,
    rewardChoice: hydroNetworkState.rewardChoice,
    selectedCard: hydroNetworkState.selectedCard,
    planChoices: hydroNetworkState.planChoices,
    planPicks: hydroNetworkState.planPicks,
    // While a committed traversal is being PRESENTED, the marker (and the
    // header's position chip) follow the sequence's own cursor — never
    // the server position, which already holds the destination.
    visualViewerPosition: traversalVisualPosition.value,
    // The ordered resource plan's starting snapshot + stage 6's gain.
    stock: {
      megacredits: p.megacredits, steel: p.steel, titanium: p.titanium,
      plants: p.plants, energy: p.energy, heat: p.heat,
    },
    plantTags: p.tags[Tag.PLANT] ?? 0,
    actionAvailable: props.actionAvailable,
    // The reward pick must be able to FOCUS every claimable cell — the
    // espionage owner's destination stands past the energy-priced spend.
    focusReach: props.rewardOffer !== undefined ?
      Math.max(0, Math.max(...props.rewardOffer.claimable) - (p.deltaProject?.position ?? 0)) : undefined,
    // A card's own move pays ITS price (0 free / 1 waiver), never the
    // per-step one — the repeat plan threads what the move really takes.
    movePrice: (props.bonusOffer ?? props.cardOffer)?.energyCost,
    floodgateSteel: floodgatePreference.value,
  });
});
/** The traversal presentation's marker cursor (−1 = no plan running).
 *  Read off the marker's reactive module state, so the computed tracks it. */
const traversalVisualPosition = computed((): number => {
  return hydroMarkerState.planCursor >= 0 ? hydroMarkerState.visualPosition : -1;
});
const snapshot = computed((): HydroPlayerSnapshot => {
  const p = props.playerView.thisPlayer;
  return {
    steel: p.steel, plants: p.plants, titanium: p.titanium, energy: p.energy, heat: p.heat, megacredits: p.megacredits,
    prod: {
      megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
      plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
    },
    plantTags: p.tags[Tag.PLANT] ?? 0,
    jovianTags: p.tags[Tag.JOVIAN] ?? 0,
  };
});
/** Candidate cards for the pos 7/9 pick (name + live animal count). */
const eligibleCards = computed((): ReadonlyArray<{name: CardName; current?: number}> => {
  const names = model.value.eligibleCardNames;
  if (names.length === 0) {
    return [];
  }
  const byName = new Map(props.playerView.thisPlayer.tableau.map((c) => [c.name, c]));
  const animalMode = model.value.needsCardSelect === 'animal-target';
  return names.map((n) => animalMode ? {name: n, current: byName.get(n)?.resources ?? 0} : {name: n});
});
// ── the MULTI-REWARD TRAVERSAL (Delta Surge) ──────────────────────────
/** The move pays several stages — the rail/preview/submit all branch on
 *  this one model fact (never on the card's name). */
const traversalActive = computed((): boolean => {
  return model.value.traversalActive;
});
/** The traversal's ANIMAL stage draft (pos 9 crossed or landed). */
const traversalAnimalStage = computed((): HydroTraversalStagePlan | undefined => {
  return model.value.traversalStages.find((s) => s.ask === 'animal-target');
});
/** The traversal's REPEAT stage draft (pos 7 crossed or landed). */
const traversalRepeatStage = computed((): HydroTraversalStagePlan | undefined => {
  return model.value.traversalStages.find((s) => s.ask === 'reuse-action');
});
/** Per-stage «сейчас → станет» views with the snapshot THREADED through
 *  the stages in path order — stage 6's plants read the stage-1 gain. */
const traversalViews = computed((): ReturnType<typeof buildTraversalRewardViews> => {
  const animal = traversalAnimalStage.value;
  return buildTraversalRewardViews({
    steps: model.value.traversalStages.map((s) => ({
      position: s.position,
      choice: s.choice,
      animalCurrent: s.position === animal?.position && s.pick !== undefined ?
        animalCurrentOf(s.pick) : undefined,
      animalCardName: s.position === animal?.position ? s.pick : undefined,
    })),
    snapshot: snapshot.value,
  });
});
const selectedAnimalCurrent = computed((): number | undefined => {
  if (traversalActive.value) {
    const pick = traversalAnimalStage.value?.pick;
    return pick !== undefined ? animalCurrentOf(pick) : undefined;
  }
  if (model.value.needsCardSelect !== 'animal-target' || model.value.selectedCard === undefined) {
    return undefined;
  }
  return eligibleCards.value.find((c) => c.name === model.value.selectedCard)?.current;
});
/**
 * ── THE ACTIVE STEP'S SOURCE CARD ─────────────────────────────────────
 *
 * The card whose action the stage the marker is STANDING ON repeats — the
 * seat beside the copied action's own prompt. Identity comes from the
 * traversal plan (a `CardName` the player themselves pre-selected), never
 * from the prompt's text and never from «the last card we saw».
 *
 * Its whole lifetime is the step's: it appears when the marker settles on
 * that cell (`parkedAt`) and leaves when the stop resolves — so it can
 * neither precede the stage that owns it nor outlive it.
 */
const embedSourceCard = computed((): CardName | undefined => {
  return flow.commit === undefined ? undefined : hydroActiveStepSourceCard();
});
/** The live model for the seat's face (cost chip / stored resources — the
 *  «the two copies are identical» contract for the L3 lift). */
const embedSourceModel = computed((): CardModel | undefined => {
  const name = embedSourceCard.value;
  return name === undefined ? undefined :
    props.playerView.thisPlayer.tableau?.find((c) => c.name === name);
});
/**
 * WHICH BRANCH is being repeated, when the card offers more than one — the
 * seat must not imply «the action» for a card whose action is a choice.
 * Named in the SAME language the composer uses (the branch's own label),
 * never a second vocabulary; absent for a single-branch action, where the
 * card face already says everything.
 */
const embedSourceBranch = computed((): string | undefined => {
  const name = embedSourceCard.value;
  const repeat = consoleHydroUi.repeatResult;
  if (name === undefined || repeat === undefined || repeat.chosenCard !== name) {
    return undefined;
  }
  const preview = actionPreviewMap().get(name);
  if ((preview?.branches.length ?? 0) < 2) {
    return undefined;
  }
  // By `index`, never a subscript: `branchIndex` is the server's runtime
  // OR-index, and an unavailable earlier branch shifts it off the array
  // position (same defect family as the claim sites).
  const title = previewBranchByIndex(preview, repeat.composed.branchIndex)?.title;
  if (title === undefined) {
    return undefined;
  }
  return typeof title === 'string' ? translateText(title) : translateMessage(title);
});
/** The COMPOSED stage-7 repeat pick, honoured only while its chosen card
 *  still matches the plan's card (single landing OR the traversal draft). */
const chosenRepeat = computed((): ConsoleRepeatPickResult | undefined => {
  const r = consoleHydroUi.repeatResult;
  if (r === undefined) {
    return undefined;
  }
  const plannedCard = traversalActive.value ? traversalRepeatStage.value?.pick : model.value.selectedCard;
  return r.chosenCard === plannedCard ? r : undefined;
});
const repeatNode = computed((): GroupNode | undefined => {
  const r = chosenRepeat.value;
  if (r === undefined) {
    return undefined;
  }
  const group = playerActionGroups([{name: r.chosenCard} as CardModel])[0];
  const node = group?.nodes[r.nodeIndex] ?? group?.nodes[0];
  return node !== undefined ? stripNodeOr(node) : undefined;
});
/**
 * THE MOVEMENT'S PASSIVE HALF — «ДОПОЛНИТЕЛЬНО», server-authored.
 *
 * A card of the player's own may pay them for MOVING (Social Heating's
 * heat). The amount, the before → after and the source card are all the
 * SERVER's (`DeltaProjectExpansion.projectedMovementBonuses`, asked with
 * the very hooks the commit pays out) — this only chooses WHICH move is
 * being read:
 *  - an OFFER on the table (a card's bonus move, DP03/DP04) describes that
 *    move, whatever the plan stepper happens to sit on;
 *  - otherwise the selected destination of the plan, and only in `plan`
 *    mode — browsing a passed stage plans no movement and promises none.
 * A reward-only claim (Dutch Mountains) has no destination at all, so it
 * lands here as an empty list by construction rather than by a special
 * case: nothing moves, nothing is owed.
 */
const movementBonuses = computed((): ReadonlyArray<DeltaMovementBonusProjection> => {
  const offer = advanceOffer.value;
  if (offer !== undefined) {
    return offer.movementBonuses ?? [];
  }
  if (model.value.mode !== 'plan') {
    return [];
  }
  return model.value.destination?.movementBonuses ?? [];
});
/** The crumb's tail as PUBLISHED: «ЭФФЕКТЫ» rides it while the R3 layer is open (the stdp's own grammar). */
const crumbStagePublished = computed((): string => {
  return forecastStageText('hydro', crumbStage.value) ?? crumbStage.value;
});
/** The FOCUSED destination's server model (the planned stop, or a card entry's target). */
const focusedDestination = computed((): DeltaTrackDestination | undefined => {
  const pos = advanceOffer.value?.toPosition ?? model.value.selectedPosition;
  return preview.value?.destinations.find((d) => d.position === pos);
});
/**
 * WHAT THE TABLE ANSWERS to the focused move (iteration 6 — the server's `DeltaTrackDestination.forecast`): a
 * choice stage's is its CHOSEN option's (`forecastOptions`); before the choice the option tiles carry their own.
 */
const focusedForecast = computed((): EffectForecast | undefined => {
  const dest = focusedDestination.value;
  if (dest === undefined) {
    return undefined;
  }
  if (dest.forecastOptions !== undefined) {
    return rewardChoice.value === undefined ? undefined : dest.forecastOptions[rewardChoice.value] ?? undefined;
  }
  return dest.forecast;
});
const focusedReaction = computed((): VariantReaction => {
  return reactionChipsOf(focusedForecast.value?.facts ?? []);
});
const forecastAvailable = computed((): boolean => {
  return forecastLayerAvailable(focusedForecast.value);
});
/**
 * The layer opens where the DECISION stands and nothing is committed: the plan's browse level, or the reward
 * choice at its CONFIRM stage (the chosen option's answer — the step commits from there); never under a target
 * pick, a payment, a traversal's choice (it returns to the rail) or a commit.
 */
const forecastCanOpen = computed((): boolean => {
  if (!forecastAvailable.value || flow.commit !== undefined) {
    return false;
  }
  if (sceneKey.value === 'preview') {
    return model.value.mode === 'plan';
  }
  return sceneKey.value === 'choice' && choicePosition.value === undefined && choiceStage.value === 'confirm' && rewardChoice.value !== undefined;
});
const fxOpen = computed((): boolean => {
  return effectForecastOpen('hydro');
});
const forecastOwnerColors = computed((): ReadonlyArray<string> => {
  return forecastOwnerColorsOf(focusedForecast.value, props.playerView.players);
});
const forecastStatsByColor = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  return forecastStatsByColorOf(forecastOwnerColors.value);
});
const rewardView = computed((): HydroRewardView => {
  // A traversal's «Вы получите» is the COMBINED, snapshot-threaded view
  // of every paying stage — cumulative «сейчас → станет», in path order.
  if (traversalActive.value) {
    return traversalViews.value.combined;
  }
  return buildRewardView({
    stage: model.value.targetStage,
    snapshot: snapshot.value,
    rewardChoice: rewardChoice.value,
    animalTargetCurrent: selectedAnimalCurrent.value,
    animalTargetCardName: model.value.selectedCard,
  });
});
const reasons = computed((): ReadonlyArray<HydroReason> => {
  const base = hydroPlanReasons({
    model: model.value,
    preview: preview.value,
    actionAvailable: props.actionAvailable,
    turnState: turnState.value,
    rewardChoice: rewardChoice.value,
    occupantName: occupantName.value,
    blockadeByName: blockadeByName.value,
  });
  // A TRAVERSAL's asks live on the RAIL (one decision per stop, drafted
  // per position) — the single-flow to-do gates read the wrong drafts and
  // would double-report a question the rail already answers.
  const out = traversalActive.value && advanceOffer.value === undefined ?
    base.filter((r) => r.kind !== 'choose-bonus' && r.kind !== 'choose-card') :
    [...base];
  // The ORDERED PLAN's payment conflict blocks the commit BY NAME — the
  // verdict block and the CTA say the same thing the conflicted rail
  // card does, and the seat matrix routes the cursor to that card.
  if (advanceOffer.value === undefined && model.value.planConflict !== undefined) {
    out.push({
      kind: 'unavailable',
      textKey: 'The payment mix conflicts with the selected action',
      blocking: true,
    });
  }
  // A move nothing the player may dial can pay (the server counts a pool
  // the composition cannot reach — Modular Floodgates' steel held back
  // for its own repeat): refused HERE, by name, never at the commit.
  if (advanceOffer.value === undefined && model.value.mode === 'plan' && !mixCovered.value && !floodgateLaneLive.value) {
    out.push({
      kind: 'unavailable',
      textKey: 'Not enough energy and steel',
      blocking: true,
    });
  }
  return out;
});
const turnState = computed((): HydroTurnState => {
  const wf = props.playerView.waitingFor;
  return hydroTurnStateOf({
    waiting: wf !== undefined,
    actionMenu: wf?.type === 'or' && ACTION_MENU_TITLES.has(titleText(wf.title)),
    // The prompt on the wire is THIS screen's own — the player is standing
    // where it sent them, not busy somewhere else.
    ownsPrompt: props.ownsPrompt,
  });
});
/**
 * The WINNING blocker of the selected plan — a real Delta-track rule
 * outranks the turn gate, so «Сейчас не ваш ход» can never mask «не хватает
 * энергии». `undefined` = nothing blocks the advance.
 */
const planBlocker = computed((): AvailabilityBlocker | undefined => {
  return hydroPrimaryBlocker(reasons.value);
});
const requirementsUnmet = computed((): boolean => {
  return reasons.value.some((r) => REQUIREMENT_REASON_KINDS.has(r.kind));
});
const ctaReasons = computed((): ReadonlyArray<HydroReason> => {
  // The choose-* to-dos are the CTA itself now (its label IS the next
  // step), so listing them again under it would be a duplicate.
  return reasons.value.filter((r) =>
    !REQUIREMENT_REASON_KINDS.has(r.kind) && r.kind !== 'choose-bonus' && r.kind !== 'choose-card');
});
const occupantName = computed((): string | undefined => {
  const pos = model.value.selectedPosition;
  const occupant = props.playerView.players.find((p) =>
    p.color !== viewerColor.value && (p.deltaProject?.position ?? 0) === pos);
  return occupant !== undefined ? participantDisplayName(occupant) : undefined;
});
const globallyActable = computed((): boolean => {
  return props.actionAvailable && !model.value.usedThisGeneration && preview.value !== undefined;
});
const statusKind = computed((): 'ready' | 'used' | 'waiting' | 'end' | 'busy' | 'offer' | 'blocked' => {
  // A prompt this workspace OWNS outranks every other status: the chip
  // must describe the screen the player is looking at, and «уже
  // использовано в этом поколении» over a live bonus offer is the whole
  // header contradicting the whole scene. (The bonus move is precisely
  // the one that does NOT spend the generation.)
  if (advanceOffer.value !== undefined || turnState.value === 'own-prompt') {
    return 'offer';
  }
  if (model.value.usedThisGeneration) {
    return 'used';
  }
  if (model.value.atEndOfTrack) {
    return 'end';
  }
  if (props.actionAvailable) {
    return 'ready';
  }
  switch (turnState.value) {
  case 'not-your-turn': return 'waiting';
  case 'busy': return 'busy';
  default: return 'blocked';
  }
});
const statusLabel = computed((): string => {
  switch (statusKind.value) {
  case 'used': return 'Already used this generation';
  case 'end': return 'End of the track reached';
  case 'waiting': return 'Not your turn';
  // ⚠️ NEVER reachable from a prompt this screen serves — that was the
  // false «Сначала завершите текущее действие» printed over the very
  // decision it was telling the player to go and finish.
  case 'busy': return 'Finish your current action first';
  case 'offer': return offerOrigin.value === 'card-entry' ? 'Extra advance offered' : 'Bonus step offered';
  case 'blocked': return 'Unavailable right now';
  default: return 'Reinforcement available';
  }
});
const stops = computed((): ReadonlyArray<RailStop> => {
  return model.value.stages.map((vm): RailStop => {
    const d = destinationAt(preview.value, vm.position);
    const grade = d !== undefined ? gradeDestination(d) : undefined;
    const linkKind: RailStop['linkKind'] =
      vm.position <= model.value.currentPosition ? 'done' :
        (vm.state === 'route' || vm.state === 'target') ? 'route' : 'dim';
    // The grade is read only AHEAD of the marker (a cell behind it is history, not a destination).
    return {position: vm.position, vm, grade: vm.position > model.value.currentPosition ? grade : undefined, linkKind};
  });
});
const selectedStage = computed((): HydroStage => {
  return model.value.stages[model.value.selectedPosition].stage;
});
const stageOfText = computed((): string => {
  return translateTextWithParams('Stage ${0} of ${1}', [String(model.value.selectedPosition), '11']);
});
/**
 * ── THE STOP IS PARKED AND ITS DECISION IS NOWHERE ON THIS SCREEN ──────
 *
 * `executing` exists for the window between OUR submit and the server's
 * answer: input is absorbed so a double submit cannot exist. A traversal
 * PARKED at a stop with a prompt standing and nothing of it rendered is the
 * opposite state — the server has answered, it asked a QUESTION, and the
 * question is somewhere else (set aside, or owed by a chain this instance
 * is not part of). Presented as «Выполняется» that screen is sealed: no
 * content, no verb, and B dead by phase — with no way out but a reload.
 *
 * It should be unreachable (a wheel open of a parked kind now routes
 * through the park's own door instead of standing a contentless twin), and
 * this is the net under it: the badge NAMES the wait and B becomes a real
 * «свернуть», which is the door back to the board — where the restore card
 * leads to the decision itself.
 */
const stalledAtStop = computed((): boolean => {
  return hydroMarkerState.parkedAt >= 0 &&
    !props.followUpLive &&
    props.playerView.waitingFor !== undefined;
});
/**
 * ── IS THE FLOW THIS SCREEN IS HOLDING ITS OWN? ────────────────────────
 *
 * The mount-time restore plan answers «what can this frame rebuild», and it
 * is the right question — but only at a mount. THIS INSTANCE IS NEVER
 * REMOUNTED across the round trip the player reported («свернуть» the step,
 * then ask the wheel for the track again): the section is hidden and shown,
 * not destroyed, so the decision was never re-asked and a stale commit
 * stayed on screen as a SEALED workspace — no body, «Ⓐ Выполняется» as its
 * only verb, B dead by phase, out only by reloading.
 *
 * Asked continuously here, and STRUCTURALLY: whose frame made this record
 * (`hydroFlowIsOwnedByCurrentFrame`). Deliberately not «is anything of it
 * alive» — liveness has timing windows (the beat between the commit press
 * and the marker arming is legitimately empty), and a predicate that resets
 * a flow in one of those would break the very commit it is guarding.
 * Ownership has no window: a lateral re-entry makes a NEW frame, everything
 * the flow itself does keeps the old one.
 */
const flowPresentable = computed((): boolean => {
  return flow.commit === undefined || hydroFlowIsOwnedByCurrentFrame();
});
const stageBadge = computed((): {kind: string; text: string} => {
  if (stalledAtStop.value) {
    return {kind: 'todo', text: $t('Awaiting decision')};
  }
  if (model.value.mode === 'plan') {
    const blocking = reasons.value.some((r) => r.blocking);
    if (model.value.canConfirm) {
      return {kind: 'ready', text: $t('Available now')};
    }
    // A traversal's unmade MANDATORY choices are a to-do, not a verdict —
    // they live on the rail (the single-flow to-dos are filtered there).
    const traversalChoicesOpen = traversalActive.value &&
      railDecisions.value.some((d) => d.kind === 'reward-choice' && d.state === 'open');
    if (!blocking && (reasons.value.length > 0 || traversalChoicesOpen)) {
      return {kind: 'todo', text: $t('Selection is required')};
    }
    // ONLY the turn stands in the way → the stage is legal and merely out
    // of reach this moment. «Сейчас недоступно» in red would be a verdict
    // on a stage whose every requirement is met (the ✓ ticks are right
    // above it) — the calm «НЕ СЕЙЧАС» is the honest state.
    if (planBlocker.value?.tone === 'warning') {
      return {kind: 'notnow', text: $t('Not now')};
    }
    return {kind: 'blocked', text: $t('Unavailable right now')};
  }
  const pos = model.value.selectedPosition;
  if (pos === model.value.currentPosition) {
    return {kind: 'current', text: $t('Current position')};
  }
  const vmStop = model.value.stages[pos];
  if (vmStop.rewardedByViewer) {
    return {kind: 'built', text: $t('Took the reward')};
  }
  // A CROSSING THAT PAID is not a miss — and this line is where the lie was
  // loudest: the stage panel said «Прошёл мимо — без награды» about a reward
  // the player had just been given.
  if (vmStop.crossedByViewer) {
    return {kind: 'built', text: $t('Reward granted in passing')};
  }
  if (vmStop.skippedByViewer) {
    return {kind: 'passed', text: $t('Passed through — no reward')};
  }
  return {kind: 'passed', text: $t('Track start')};
});
const requiredTags = computed((): ReadonlyArray<Tag> => {
  return (model.value.destination?.requiredTags ?? []) as ReadonlyArray<Tag>;
});
const jumpedOverVp2 = computed((): boolean => {
  return model.value.destination?.jumpedOverVp2 === true;
});
const startSelected = computed((): boolean => {
  return model.value.mode === 'details' && model.value.selectedPosition === 0;
});
const detailsStatusText = computed((): string => {
  switch (model.value.viewerStatusAtDetails) {
  case 'current': return $t('Here now');
  case 'rewarded': return $t('Took the reward');
  case 'crossed': return $t('Reward granted in passing');
  case 'passed': return $t(startSelected.value ? 'Advanced through' : 'Passed through — no reward');
  default: return $t('Not reached yet');
  }
});
// ── the FLOW ────────────────────────────────────────────────────────────
const commitRec = computed((): HydroCommitRecord => {
  // Only read by the commit/result layers, which render iff it stands.
  return flow.commit as HydroCommitRecord;
});
const sceneKey = computed((): SceneKey => {
  // The WORKING ZONE's states are mutually exclusive by construction, and
  // their precedence is the pure module's contract — what is already
  // RUNNING outranks what is merely offered, so a second ocean's offer can
  // never paint over the move in flight.
  const c = flow.commit;
  const zone = hydroZoneState({
    offerLive: advanceOffer.value !== undefined,
    committing: c !== undefined && c.phase !== 'result',
    resolving: c?.phase === 'result',
  });
  if (zone === 'resolving') {
    return 'result';
  }
  if (zone === 'committing') {
    // …unless there is nothing of it to show — then this screen has no
    // flow, and it says so by being its ordinary self (`flowPresentable`).
    // Every action stays refused by `actionBlockedReason`'s one honest
    // reason, and B closes normally, which is the whole point.
    if (flowPresentable.value) {
      return 'commit';
    }
  }
  // The reward step is HOW the offer is answered, not a competing state:
  // it is opened by the offer's own confirm and submits the whole move as
  // one batch. So it outranks the offer while it stands.
  if (flow.step === 'reward') {
    return 'choice';
  }
  if (flow.step === 'target') {
    return 'target';
  }
  // The COMPOSITION step — the plan's confirm routed here because the
  // server model admits more than one energy/steel mix. Same substep
  // family as the pre-selects: state-driven, B walks back to the plan.
  if (flow.step === 'payment') {
    return 'payment';
  }
  // THE TARGET PICKS OUTRANK THE REWARD PICK — the NESTED instrument wins.
  // With same-kind nesting a blockade/espionage pick can stand INSIDE a
  // reward pick's own flow (DM's stage-7 reuse composing Modular
  // Floodgates), and both bridges are then active at once: this ONE
  // component presents the DEEPEST role, and structurally the target
  // picks are always the deeper ones (a reward pick is opened from card
  // composers, never from inside a target pick). When only one bridge
  // stands — the historical mutually-exclusive case — the order changes
  // nothing.
  if (props.espionageOffer !== undefined) {
    return 'espionage-pick';
  }
  // The BLOCKADE TARGET PICK (Modular Floodgates): the same contract.
  if (props.blockadeOffer !== undefined) {
    return 'blockade-pick';
  }
  // The REWARD-ONLY PICK (Dutch Mountains): a pure selection surface — it
  // outranks the browse layer for as long as the bridge stands, and its
  // nested steps (the scoped reward choice / the target grid / the repeat
  // browser) already took precedence above.
  if (props.rewardOffer !== undefined) {
    return 'reward-pick';
  }
  // The committed DEPLOY's execution view — the track is the protagonist,
  // the fresh gate its one event.
  if (props.blockadeExecution !== undefined) {
    return 'blockade-exec';
  }
  if (zone === 'bonus-offer') {
    return 'bonus';
  }
  return 'preview';
});
/** Which action-column body stands — the crossfade key. `quiet` is a
 *  substate whose verbs live on the ONE bottom bar (the commit beat, the
 *  target grid): the column stands as composed air, never unmounts. */
const actKey = computed((): string => {
  switch (sceneKey.value) {
  case 'preview': return model.value.mode === 'plan' ? 'plan' : 'details';
  // A traversal decision's choice step SELECTS AND RETURNS (the rail owns
  // the commit) — the column stands as composed air, like the target step.
  case 'choice': return choicePosition.value !== undefined ? 'quiet' : 'choice';
  case 'payment': return 'payment';
  case 'bonus': return 'bonus';
  case 'reward-pick': return 'reward-pick';
  // The espionage/blockade picks confirm on the ROW (A on a candidate
  // returns to the composer), so their action column stands as composed air.
  case 'espionage-pick':
  case 'blockade-pick':
  case 'blockade-exec':
  case 'commit':
  case 'target': return 'quiet';
  default: return 'result';
  }
});
// ── the REWARD-ONLY PICK (Dutch Mountains) ────────────────────────────
/** The server's claimable set — the ONE eligibility source of this mode. */
const rewardClaimableSet = computed((): Set<number> => {
  return new Set(props.rewardOffer?.claimable ?? []);
});
/** The focused stage is claimable (the CTA / A-press gate). */
const rewardFocusClaimable = computed((): boolean => {
  return rewardClaimableSet.value.has(model.value.selectedPosition);
});
/** WHAT the focused stage asks before it can be claimed, and whether the
 *  ask is answered — the per-position drafts are the traversal's own. */
const rewardFocusAsk = computed((): {kind: 'choice' | 'target' | 'repeat', answered: boolean} | undefined => {
  const pos = model.value.selectedPosition;
  const stage = HYDRO_STAGES[pos];
  if (stage === undefined || !rewardFocusClaimable.value) {
    return undefined;
  }
  if (hydroStageNeedsChoice(stage)) {
    return {kind: 'choice', answered: hydroNetworkState.planChoices[pos] !== undefined};
  }
  if (stage.followUp === 'reuse-action') {
    // No candidate at all → the reward fizzles server-side; nothing to ask.
    if ((preview.value?.reuseActionCards ?? []).length === 0) {
      return undefined;
    }
    return {kind: 'repeat', answered: hydroNetworkState.selectedCard !== undefined};
  }
  if (stage.followUp === 'add-animals') {
    if ((preview.value?.animalTargetCards ?? []).length === 0) {
      return undefined;
    }
    return {kind: 'target', answered: hydroNetworkState.planPicks[pos] !== undefined};
  }
  return undefined;
});
/** The pick is complete: a claimable stage with its ask (if any) answered. */
const rewardPickReady = computed((): boolean => {
  return rewardFocusClaimable.value && (rewardFocusAsk.value?.answered !== false);
});
/** The focused stage's honest «Вы получите» — the ONE stage-addressed view
 *  every landing uses (no movement, no route, no destination model). */
const rewardFocusView = computed((): HydroRewardView => {
  const pos = model.value.selectedPosition;
  return buildRewardView({
    stage: HYDRO_STAGES[pos],
    snapshot: snapshot.value,
    rewardChoice: hydroNetworkState.planChoices[pos],
    animalTargetCurrent: hydroNetworkState.planPicks[pos] !== undefined ?
      animalCurrentOf(hydroNetworkState.planPicks[pos] as CardName) : undefined,
    animalTargetCardName: hydroNetworkState.planPicks[pos],
  });
});
/** Why the focused stage cannot be claimed — semantic, off the track
 *  configuration, never a number literal or a localized name. */
/** The pick is an ADVANCE-LANDING one (Corporate Espionage's own step) —
 *  the destination cell is the single subject; every other stage reads
 *  the one honest reason below instead of the claim-family verdicts. */
const rewardAdvanceFrom = computed((): number | undefined => {
  return props.rewardOffer?.advanceFrom;
});
/**
 * The projected MOVES the rail links with a quiet arc — «кто куда идёт»
 * readable at a glance, not reconstructed from two tokens: the espionage
 * pick's owner (fwd, constant) + focused candidate (back, follows the
 * cursor), and the advance-landing reward pick's own move. Empty on every
 * other scene — nothing ambient, nothing during a real glide.
 */
const ghostLinks = computed((): Array<{key: string, from: number, to: number, dir: 'fwd' | 'back'}> => {
  const out: Array<{key: string, from: number, to: number, dir: 'fwd' | 'back'}> = [];
  const esp = props.espionageOffer;
  if (esp !== undefined) {
    const owner = esp.projection.owner;
    if (owner.legal && owner.toPosition !== owner.fromPosition) {
      out.push({key: 'own', from: owner.fromPosition, to: owner.toPosition, dir: 'fwd'});
    }
    const row = espionageFocusRow.value;
    const rowTo = row?.target.toPosition;
    if (row !== undefined && row.target.legal && rowTo !== undefined && rowTo !== row.target.fromPosition) {
      out.push({key: 'tgt-' + row.target.color, from: row.target.fromPosition, to: rowTo, dir: 'back'});
    }
    return out;
  }
  const from = rewardAdvanceFrom.value;
  const to = props.rewardOffer?.claimable[0];
  if (from !== undefined && to !== undefined && to !== from) {
    out.push({key: 'own', from, to, dir: 'fwd'});
  }
  return out;
});
/** The re-measure trigger: the links AND the rail's own layout inputs. */
const ghostLinkSpec = computed((): string => {
  return JSON.stringify([ghostLinks.value, model.value.selectedPosition, model.value.focusPosition]);
});
const rewardFocusBlockKey = computed((): string => {
  const pos = model.value.selectedPosition;
  if (rewardFocusClaimable.value) {
    return '';
  }
  if (rewardAdvanceFrom.value !== undefined) {
    return 'Only the destination stage reward can be chosen here';
  }
  const stage = HYDRO_STAGES[pos];
  if (stage === undefined || pos === 0) {
    return 'The start cell has no stage reward';
  }
  if (pos > model.value.currentPosition) {
    return 'The stage has not been reached yet';
  }
  if (stage.vp !== undefined) {
    return 'The VP steps cannot be claimed by this action';
  }
  if (stage.tag === Tag.JOVIAN) {
    return 'The Jovian step cannot be claimed by this action';
  }
  return 'The stage reward is not claimable';
});
/** The reward-pick mode's own ask row copy (the act column's status). */
const rewardAskLabel = computed((): string => {
  const ask = rewardFocusAsk.value;
  if (ask === undefined) {
    return '';
  }
  switch (ask.kind) {
  case 'choice': return ask.answered ? 'Reward option selected' : 'Choose the stage reward';
  case 'repeat': return ask.answered ? 'Action selected' : 'Choose an action to repeat';
  default: return ask.answered ? 'Target card selected' : 'Choose a card to receive the animals';
  }
});
// ── the ESPIONAGE TARGET PICK (Corporate Espionage, DP10) ─────────────
/** Every opponent as a row — legal and blocked alike (a protected player
 *  is SHOWN with the reason, never hidden), in the projection's seating
 *  order. Identity comes from the live player list (the one display-name
 *  resolver — the bot reads «Бот» through it like everywhere else). */
const espionageRows = computed((): ReadonlyArray<EspionageRow> => {
  const offer = props.espionageOffer;
  if (offer === undefined) {
    return [];
  }
  const players = new Map(props.playerView.players.map((p) => [p.color, p]));
  return offer.projection.targets.map((target) => {
    const p = players.get(target.color);
    return {
      target,
      name: p !== undefined ? participantDisplayName(p) : String(target.color),
      isBot: p?.isMarsBot === true,
      view: espionageOutcomeView(target.reward, target.rewardSkipped),
      blockKey: target.blocked === 'vp-protected' ?
        'Protected: already at a VP level' :
        target.blocked === 'track-start' ? 'Cannot be pushed below the track start' : '',
    };
  });
});
const espionageFocusRow = computed((): EspionageRow | undefined => {
  return espionageRows.value[espionageFocusIdx.value];
});
/** The SAVED target (the composer's capture) — the ✓ state, distinct from
 *  the cursor. Focus alone never changes it. */
const espionageSelectedColor = computed((): Color | undefined => {
  return props.espionageOffer?.prior;
});
const espOwner = computed((): DeltaEspionagePickRequest['projection']['owner'] | undefined => {
  return props.espionageOffer?.projection.owner;
});
const espOwnerView = computed((): EspionageOutcomeView => {
  return espionageOutcomeView(espOwner.value?.reward);
});
const espionageHasLegal = computed((): boolean => {
  return props.espionageOffer?.projection.hasLegalTarget === true;
});
// ── the BLOCKADE TARGET PICK (Modular Floodgates, DP11) ───────────────
/** Every opponent as a row — legal and blocked alike (a protected player
 *  is SHOWN with the reason, never hidden), in the projection's seating
 *  order; identity through the one display-name resolver (the bot reads
 *  «Бот» like everywhere else). */
const blockadeRows = computed((): ReadonlyArray<BlockadeRow> => {
  const offer = props.blockadeOffer;
  if (offer === undefined) {
    return [];
  }
  const players = new Map(props.playerView.players.map((p) => [p.color, p]));
  return offer.projection.targets.map((target) => {
    const p = players.get(target.color);
    return {
      target,
      name: p !== undefined ? participantDisplayName(p) : String(target.color),
      isBot: p?.isMarsBot === true,
      blockKey: target.blocked === 'vp-protected' ?
        'Protected: the next cell is a VP step' :
        target.blocked === 'track-end' ?
          'At the end of the track — nothing to block' :
          target.blocked === 'already-blocked' ? 'Already blocked this generation' : '',
    };
  });
});
const blockadeFocusRow = computed((): BlockadeRow | undefined => {
  return blockadeRows.value[blockadeFocusIdx.value];
});
/** The execution receipt's target name — the one display-name resolver. */
const blockadeExecTargetName = computed((): string => {
  const target = props.blockadeExecution?.target;
  if (target === undefined) {
    return '';
  }
  const p = props.playerView.players.find((x) => x.color === target);
  return p !== undefined ? participantDisplayName(p) : String(target);
});
/** The deployer of the VIEWER's own standing blockade (the plan reason's
 *  `${0}` slot) — resolved through the one display-name resolver. */
const blockadeByName = computed((): string | undefined => {
  const by = preview.value?.blockade?.by;
  if (by === undefined) {
    return undefined;
  }
  const p = props.playerView.players.find((x) => x.color === by);
  return p !== undefined ? participantDisplayName(p) : String(by);
});
/** The SAVED target (the composer's capture) — the ✓ state, distinct from
 *  the cursor. Focus alone never changes it. */
const blockadeSelectedColor = computed((): Color | undefined => {
  return props.blockadeOffer?.prior;
});
/** The source card's display name for the terms line. */
const blockadeSourceName = computed((): string => {
  return props.blockadeOffer?.source ?? '';
});
/** The track cells the blockade projection involves (the mode's focused
 *  dimming): every candidate's own cell, plus the focused candidate's
 *  GATE cell — the two cells the decision is actually about. */
const blockadeLitCells = computed((): Set<number> => {
  const out = new Set<number>();
  // The execution receipt spotlights ONE relation: the blocked marker's
  // cell and the gate cell in front of it.
  const exec = props.blockadeExecution;
  if (exec !== undefined) {
    const p = props.playerView.players.find((x) => x.color === exec.target);
    const pos = p?.deltaProject?.position ?? 0;
    out.add(pos);
    out.add(pos + 1);
    return out;
  }
  for (const row of blockadeRows.value) {
    out.add(row.target.position);
  }
  const focus = blockadeFocusRow.value;
  if (focus !== undefined && focus.target.legal && focus.target.blockadePosition !== undefined) {
    out.add(focus.target.blockadePosition);
  }
  return out;
});
/**
 * THE STANDING BLOCKADES on the table — read off the LIVE player models
 * (`deltaProject.blockade` reaches every viewer), active this generation
 * only: the persistent gate follows the blocked PLAYER's current cell
 * (`position + 1`), so a legal backward move re-seats it with the marker.
 */
const activeBlockadeGates = computed((): ReadonlyArray<{target: Color, position: number}> => {
  const generation = props.playerView.game.generation;
  const out: Array<{target: Color, position: number}> = [];
  for (const p of props.playerView.players) {
    const blockade = p.deltaProject?.blockade;
    if (blockade === undefined || blockade.generation !== generation) {
      continue;
    }
    out.push({target: p.color, position: (p.deltaProject?.position ?? 0) + 1});
  }
  return out;
});
/** The track cells the espionage projection involves (for the mode's
 *  focused dimming): the owner's from/to and the focused candidate's
 *  from/to. Everything else recedes so the two moves read at a glance. */
const espionageLitCells = computed((): Set<number> => {
  const out = new Set<number>();
  const owner = espOwner.value;
  if (owner !== undefined) {
    out.add(owner.fromPosition);
    if (owner.legal) {
      out.add(owner.toPosition);
    }
  }
  const row = espionageFocusRow.value;
  if (row !== undefined) {
    out.add(row.target.fromPosition);
    if (row.target.legal && row.target.toPosition !== undefined) {
      out.add(row.target.toPosition);
    }
  }
  return out;
});
/** The COMMITTED espionage record (the execution/result scenes' source). */
const espCommit = computed((): HydroCommitRecord['espionage'] => {
  return flow.commit?.espionage;
});
const espCommitTargetName = computed((): string => {
  const t = espCommit.value?.target;
  if (t === undefined) {
    return '';
  }
  const p = props.playerView.players.find((pl) => pl.color === t.color);
  return p !== undefined ? participantDisplayName(p) : String(t.color);
});
const espCommitTargetView = computed((): EspionageOutcomeView => {
  const t = espCommit.value?.target;
  return espionageOutcomeView(t?.reward, t?.rewardSkipped);
});
/** The flow is parked on the TARGET's own interactive landing — the calm
 *  waiting state (never a spinner pretending the game is computing). */
const espWaitingTarget = computed((): boolean => {
  void hydroMarkerState.planPaused;
  void hydroMarkerState.parkedAt;
  return espCommit.value?.target?.interactive === true && hydroParkedForeignStop();
});
const espWaitingCaption = computed((): string => {
  return translateTextWithParams('Waiting for ${0} to decide', [espCommitTargetName.value]);
});
/**
 * THE PRESENTATION CURSOR'S STAGE of a committed move — the ONE post-commit
 * stage derivation every identity surface reads (the ctx column, the crumb
 * subject, the commit head). While a traversal plan is still being
 * PRESENTED it is the sequence's own current cell; a finished plan — and
 * the historical single landing, whose presentation is trivially its
 * destination — reads the frozen record. The rules cursor (the server
 * position) already holds the destination the moment the response applies;
 * painting it early is the finale before the movement.
 */
const presentedCommitStage = computed((): {position: number, nameKey: string} | undefined => {
  const c = flow.commit;
  if (c === undefined) {
    return undefined;
  }
  if (c.traversal !== undefined && hydroMarkerState.planCursor >= 0) {
    const seg = traversalCurrentSegment.value;
    if (seg !== undefined) {
      return {position: seg.position, nameKey: seg.stageNameKey};
    }
  }
  return {position: c.toPosition, nameKey: c.stageNameKey};
});
/** The context column — see {@link HydroCtxView}. */
/** The whole scene belongs to a workspace standing inside this one. */
const sceneHandedOver = computed((): boolean => {
  return workspaceHostYieldsScene('hydro');
});
/**
 * THE FOCUSED STAGE'S ROSTER, straight from the model — everyone with
 * something to say about the cell the cursor is on, viewer first. The
 * MarsBot rides it like any other player: it is another marker on the same
 * track, and a track that says nothing about where it has been reads as a
 * dot that teleports.
 */
const focusRoster = computed((): ReadonlyArray<HydroStageHistoryEntry> => {
  return model.value.focusRoster;
});
const ctxView = computed((): HydroCtxView => {
  const c = flow.commit;
  if (c !== undefined) {
    const badge = c.phase === 'result' ?
      {kind: 'built', text: $t('Completed')} :
      {kind: 'notnow', text: $t('Executing')};
    const route = {
      from: c.fromPosition, to: c.toPosition,
      energy: c.spend - c.spendSteel, steel: c.spendSteel, free: c.spend === 0,
    };
    if (c.sourceCard !== undefined) {
      return {kind: 'source', source: c.sourceCard, badge, route};
    }
    // The identity FOLLOWS THE PRESENTATION CURSOR: naming the terminal
    // stage (its 5 ПО glyph, «Этап 11 из 11») while the marker is still
    // walking the middle of the track is the rules cursor leaking into
    // the presentation. The ROUTE stays the whole move — the commitment
    // is honest; only the CURRENT stage is the cursor's.
    const at = presentedCommitStage.value ?? {position: c.toPosition, nameKey: c.stageNameKey};
    const stage = HYDRO_STAGES[at.position];
    return {
      kind: 'stage', tag: stage?.tag, vp: stage?.vp,
      nameKey: at.nameKey,
      posText: translateTextWithParams('Stage ${0} of ${1}', [String(at.position), '11']),
      badge, route,
    };
  }
  const offer = advanceOffer.value;
  if (offer !== undefined) {
    return {
      kind: 'source', source: offer.source,
      route: {
        from: offer.fromPosition, to: offer.toPosition,
        energy: offer.energyCost, steel: 0, free: offer.energyCost === 0,
      },
    };
  }
  // The REWARD-ONLY PICK: the source card is the identity, and there is
  // deliberately NO route — this mode presents no movement, no price, no
  // destination. The badge names the mode.
  if (props.rewardOffer !== undefined) {
    return {
      kind: 'source', source: props.rewardOffer.source,
      badge: {kind: 'offer', text: $t('Reward selection')},
    };
  }
  // The ESPIONAGE PICK: the played card is the identity; the OWNER's own
  // mandatory advance is the one route this mode carries (free — the
  // card's printed cost is the price, already paid in the composer). The
  // focused candidate's transition lives on their row, never here.
  if (props.espionageOffer !== undefined) {
    const owner = props.espionageOffer.projection.owner;
    return {
      kind: 'source', source: props.espionageOffer.source,
      badge: {kind: 'offer', text: $t('Target selection')},
      route: owner.legal ?
        {from: owner.fromPosition, to: owner.toPosition, energy: 0, steel: 0, free: true} :
        undefined,
    };
  }
  // The BLOCKADE PICK: the acting card is the identity, and — like the
  // reward pick — deliberately NO route: this mode presents no movement.
  if (props.blockadeOffer !== undefined) {
    return {
      kind: 'source', source: props.blockadeOffer.source,
      badge: {kind: 'offer', text: $t('Target selection')},
    };
  }
  // The DEPLOY's execution receipt: the acting card, committed.
  if (props.blockadeExecution !== undefined) {
    return {
      kind: 'source', source: props.blockadeExecution.source,
      badge: {kind: 'built', text: $t('Completed')},
    };
  }
  const s = selectedStage.value;
  return {
    kind: 'stage', tag: s.tag, vp: s.vp, nameKey: s.nameKey,
    posText: stageOfText.value,
    // THE STATUS SPEAKS ONCE (FI · EG-1): in the plan the act column's verdict (`data-hydro-status`) says
    // «available / not now / unavailable» — a pill above the route said it a second time. A browsed stage the
    // player is NOT planning keeps its history badge («Took the reward», «Passed through»): no verdict says it.
    badge: model.value.mode === 'plan' ? undefined : stageBadge.value,
    route: model.value.mode === 'plan' ? {
      from: model.value.currentPosition, to: model.value.selectedPosition,
      energy: model.value.selectedSpend, steel: 0, free: false, priced: false,
    } : undefined,
  };
});
/** The ctx source card in the console's ONE source-view shape. */
const ctxSourceView = computed((): ReturnType<typeof choiceSourceView> => {
  const card = ctxView.value.source;
  return card === undefined ? undefined : choiceSourceView({kind: 'card', card});
});
/** The movement plan's DECISIONS — today always length 1 (this stage's
 *  binary reward); the strip renders whatever the list holds. */
const planDecisions = computed((): ReadonlyArray<HydroPlanDecision> => {
  const stage = choiceStageModel.value;
  if (stage === undefined) {
    return [];
  }
  // A traversal decision's step edits ITS OWN stop; the drafted answer
  // lives per position and returns to the rail on the pick.
  if (choicePosition.value !== undefined) {
    return [{
      id: 'reward:' + choicePosition.value,
      stagePosition: choicePosition.value,
      stageNameKey: stage.nameKey,
      options: choiceOptions.value,
      chosen: hydroNetworkState.planChoices[choicePosition.value],
    }];
  }
  const pos = advanceOffer.value?.toPosition ?? model.value.selectedPosition;
  return [{
    id: 'reward:' + pos,
    stagePosition: pos,
    stageNameKey: stage.nameKey,
    options: choiceOptions.value,
    chosen: rewardChoice.value,
  }];
});
/** The chosen stage reward, kept visible through the payment substep —
 *  the walk into the composition may not orphan the choice it pays for. */
const paymentChosenReward = computed((): HydroStage['rewardOptions'][number] | undefined => {
  if (!model.value.targetNeedsChoice || rewardChoice.value === undefined) {
    return undefined;
  }
  return selectedStage.value.rewardOptions[rewardChoice.value];
});
/** The skipped-reward POLICY, compact: a count, never the raw roster. */
const skippedSummary = computed((): string => {
  return translateTextWithParams('Intermediate rewards are skipped · ${0}',
    [String(model.value.skippedStages.length)]);
});
const resultSkippedText = computed((): string => {
  return translateTextWithParams('Intermediate rewards are skipped · ${0}',
    [String(commitRec.value.skippedCount ?? 0)]);
});
/**
 * THE MOVE A CARD IS PUTTING ON THIS TRACK, whichever door it came through.
 *
 * Everything the zone PRESENTS — the source card, the route, the price, the
 * landing stage's reward and its pre-select — is read from here and from
 * nothing else, so a card-granted offer and a card-chosen move are one
 * scene rather than two similar ones. Only the ANSWER differs, and that is
 * what `offerOrigin` below is for.
 *
 * A standing server prompt WINS: it is a demand, and a draft can wait.
 */
const advanceOffer = computed((): DeltaAdvanceOffer | undefined => {
  return props.bonusOffer ?? props.cardOffer;
});
/** How the player got here — the ONE axis the scene branches on. */
const offerOrigin = computed((): DeltaOfferOrigin | undefined => {
  if (props.bonusOffer !== undefined) {
    return 'prompt';
  }
  return props.cardOffer !== undefined ? 'card-entry' : undefined;
});
/** Is there a refusal to offer at all? Only a standing prompt has one. */
const bonusSkipOffered = computed((): boolean => {
  return offerOrigin.value === 'prompt';
});
/** The offer's copy — i18n KEYS from the pure module, never coined here. */
const bonusCopy = computed((): ReturnType<typeof hydroAdvanceCopy> => {
  return hydroAdvanceCopy(advanceOffer.value ?? {
    source: CardName.DELTA_PROJECT, steps: 1, fromPosition: 0, toPosition: 1,
    energyCost: 0, waivesTag: false,
  }, offerOrigin.value ?? 'prompt');
});
/** The body sentence with the source card's TRANSLATED name folded in. */
const bonusBodyText = computed((): string => {
  return translateTextWithParams(bonusCopy.value.bodyKey,
    bonusCopy.value.bodyParams.map((n) => translateCardName(n as CardName)));
});
/** The stage name the zone hands UP to the crumb (it never draws one). */
const bonusStageKey = computed((): string => {
  return advanceOffer.value === undefined ? '' : bonusCopy.value.stageKey;
});
/** The offer's IDENTITY — a new offer is a new decision. */
const bonusIdentity = computed((): string => {
  const o = advanceOffer.value;
  return o === undefined ? '' : [offerOrigin.value, o.source, o.fromPosition, o.toPosition, o.energyCost].join('|');
});
/** The landing stage itself — the ONE object the facts are read from. */
const bonusStage = computed((): HydroStage | undefined => {
  return advanceOffer.value === undefined ? undefined : HYDRO_STAGES[advanceOffer.value.toPosition];
});
/**
 * THE PRICE as a «сейчас → станет» line, not a bare chip. The server's own
 * `energyCost` (0 for a plain bonus step, 1 for the tag waiver) against the
 * viewer's live stock — the same shape `buildRewardView` produces, so it
 * renders through the very same row.
 */
const bonusCostLine = computed((): HydroDeltaLine | undefined => {
  const cost = advanceOffer.value?.energyCost ?? 0;
  if (cost <= 0) {
    return undefined;
  }
  const have = snapshot.value.energy;
  return {resource: Resource.ENERGY, labelKey: 'Energy', before: have, after: have - cost, delta: -cost};
});
/** The landing stage's reward ALTERNATIVES (two ⇒ the pick is a step). */
const bonusRewardOptions = computed((): HydroStage['rewardOptions'] => {
  return bonusNeedsReward.value ? (bonusStage.value?.rewardOptions ?? []) : [];
});
/** Has the landing stage anything to state as a gain? */
const bonusGainPresent = computed((): boolean => {
  if (bonusNeedsReward.value) {
    return true; // the two alternatives are the statement
  }
  if (movementBonuses.value.length > 0) {
    return true; // the move itself pays, even where the landing does not
  }
  const v = bonusRewardView.value;
  return v.lines.length > 0 || v.rawChips.length > 0 || v.vp !== undefined;
});
/** The optional refusal is reachable INSIDE the reward step too — the
 *  rules still allow declining until the commit (a server-framed offer
 *  only; a card entry's way out is B). */
const choiceSkipOffered = computed((): boolean => {
  return advanceOffer.value !== undefined && bonusSkipOffered.value;
});
/** Does the offer's LANDING stage ask which reward to take (pos 1/2)? */
const bonusNeedsReward = computed((): boolean => {
  const offer = advanceOffer.value;
  if (offer === undefined) {
    return false;
  }
  const stage = HYDRO_STAGES[offer.toPosition];
  return stage !== undefined && hydroStageNeedsChoice(stage);
});
/**
 * THE OFFER'S LANDING STAGE ASKS FOR A CARD — pos 7 (which blue action to
 * repeat) or pos 9 (which card receives the animals).
 *
 * Read off the SAME model the plan panel reads, which is honest because an
 * offer SEATS the plan on its own destination the moment it goes live (see
 * the `bonusIdentity` watcher). That seating is the whole trick: every
 * pre-select mechanism this workspace already owns — the repeat browser
 * bridge, the embedded target step, the summary chip, the eligibility list
 * — then describes the landing stage with no second implementation.
 */
const bonusNeedsCard = computed((): boolean => {
  return advanceOffer.value !== undefined && model.value.mustSelectCard;
});
/** …and it has not been made yet. */
const bonusPickMissing = computed((): boolean => {
  return bonusNeedsCard.value && model.value.selectedCard === undefined;
});
/**
 * THE PICK ROW'S IDENTITY — which question the landed stage asks, or
 * undefined when it asks none. ONE derivation for both scenes.
 */
const pickKind = computed((): HydroPickKind | undefined => {
  const k = model.value.needsCardSelect;
  return k === 'reuse-action' || k === 'animal-target' ? k : undefined;
});
/** The stage asks, but the SERVER offered no candidate — the reward simply
 *  fizzles. Nothing is owed, so nothing may warn about it. */
const pickFizzled = computed((): boolean => {
  return pickKind.value !== undefined && !model.value.mustSelectCard;
});
/** WHAT IS MISSING, named — AND what the second press will do with it.
 *  Never a bare «нельзя», and never an instruction the player cannot follow
 *  (a fizzled stage has nothing to choose). The two doors that CAN carry a
 *  waive promise a forfeit; the prompt door, which cannot, promises the
 *  postponed question it will actually raise. */
const pickWarningKey = computed((): string => {
  // The traversal names the FIRST unresolved pick (the seat contract
  // already points the cursor at it) — the waive door's phrasing.
  if (traversalActive.value && advanceOffer.value === undefined) {
    const open = railDecisions.value.find((d) => d.state === 'open' && d.optional);
    return open !== undefined ? HYDRO_PICK_COPY[open.kind].warnWaive : '';
  }
  if (pickKind.value === undefined) {
    return '';
  }
  const copy = HYDRO_PICK_COPY[pickKind.value];
  return offerOrigin.value === 'prompt' ? copy.warn : copy.warnWaive;
});
/** The forfeit, named on the RESULT stage — a declined reward may never
 *  read as a silent nothing (the console-wide «no silent loss»). Keyed on
 *  the COMMIT's own landing, never on the live model, which has moved on. */
const waivedNoteKey = computed((): string => {
  const c = flow.commit;
  if (c === undefined) {
    return '';
  }
  return c.toPosition === 7 ? 'Action copy declined' : 'Animal placement declined';
});
/**
 * WHAT A DOES, FOLLOWING THE CURSOR. The bar is the only place a verb
 * lives, so it has to name the act the cursor is actually on — it read
 * «Продвинуться» while the player stood on the pre-select row, which
 * is the bar describing a different button.
 */
/**
 * THE PRIMARY of a source move — named by the NEXT REQUIRED INTERACTION,
 * one vocabulary with the player's own advance (the parity law: the
 * source explains the move, it never renames the decision). `pending`
 * mirrors the plan CTA's rule: legal but not the act in front while the
 * landed stage's pick is owed.
 */
const bonusPrimary = computed((): {verb: HydroNextInteraction, label: string, pending: boolean} => {
  const verb = hydroNextInteraction({
    needsChoice: bonusNeedsReward.value,
    choiceMade: rewardChoice.value !== undefined,
  });
  return {verb, label: HYDRO_PRIMARY_KEY[verb], pending: verb === 'reinforce' && bonusPickMissing.value};
});
/**
 * THE CARD SCENE OWNS THE FRAME. While the landed stage's embedded deck
 * pick is live inside this workspace, the cards are the undisputed primary
 * content: the identity/action columns and the commit line dissolve, the
 * embed zone takes the whole surface, and everything returns when the
 * selection is over. Keyed on the deck-pick flow's own phase — never on a
 * mount or a visibility flag.
 */
const immersive = computed((): boolean => {
  // …and an embedded DRAWN-CARDS reveal (a repeated action's own draw)
  // takes the frame the same way: the batch is the primary content while
  // it presents, the track and columns dissolve and return at the take.
  if (props.revealEmbedded && flow.commit !== undefined) {
    return true;
  }
  // …AND A STAGE THAT REPEATS A CARD ACTION OWNS THE SCENE FROM ITS
  // ARRIVAL, not from the moment its cards happen to mount. The source card
  // materialises first (the calm beat that answers «почему это
  // происходит?» before anything is asked), and it lives in the embed
  // zone — which only has room once the columns have yielded. One pose for
  // the whole step: the seat never re-seats when the prompt arrives.
  if (embedSourceCard.value !== undefined) {
    return true;
  }
  return flowDeck.phase !== 'idle' &&
    flow.commit !== undefined &&
    workspaceOutcomeState.host === 'hydro';
});
/** A workspace-outcome claim names THIS host — the reactive mirror the
 *  mid-scene republish watcher fires on (see the embed-zone watcher). */
const outcomeClaimedByHydro = computed((): boolean => {
  return workspaceOutcomeState.host === 'hydro';
});
const bonusConfirmLabel = computed((): string => {
  if (railIdOf(sceneFocus.value) !== undefined) {
    return pickVerbKey.value;
  }
  if (sceneFocus.value === 'bonus-source') {
    return 'Inspect';
  }
  return sceneFocus.value === 'bonus-skip' ? bonusCopy.value.skipKey : bonusPrimary.value.label;
});
/** The verb the ONE command bar shows while the cursor is on the row. */
const pickVerbKey = computed((): string => {
  if (pickKind.value === undefined) {
    return '';
  }
  const copy = HYDRO_PICK_COPY[pickKind.value];
  return model.value.selectedCard === undefined ? copy.choose : copy.change;
});
/**
 * IS THE PRE-SELECT EVEN ON OFFER on the plan layer?
 *
 * Only for a stage the player can actually REACH. A real rule in the way —
 * a missing path tag, an occupied VP slot, no energy, the generation
 * already spent — means the advance cannot be made at all, and inviting
 * the player to configure which action it would repeat is an offer to
 * decide something that will never happen. (A TURN gate is deliberately
 * not one of those: planning off-turn is supported everywhere here.)
 *
 * The SAME condition the CTA uses, so the row and the button can never
 * disagree about whether the move is on the table.
 */
const planPickOffered = computed((): boolean => {
  return advanceOffer.value === undefined && model.value.mode === 'plan' &&
    pickKind.value !== undefined && !hydroRuleBlocked(reasons.value);
});
/** The PLAYER'S OWN advance is missing the landed stage's pick. Same
 *  omission, same warning — asked of the plan layer rather than the offer. */
const planPickMissing = computed((): boolean => {
  // A traversal warns about EVERY open optional pick at once — the second
  // press waives them all by name (the per-position `waivedSteps`).
  if (traversalActive.value && advanceOffer.value === undefined) {
    return !hydroRuleBlocked(reasons.value) &&
      railDecisions.value.some((d) => d.state === 'open' && d.optional);
  }
  return planPickOffered.value && model.value.mustSelectCard && model.value.selectedCard === undefined;
});
/** The traversal's conscious declines at THIS confirm: every target stage
 *  with candidates and no pick (the warned second press forfeits them). */
const traversalWaivedSteps = computed((): Array<number> => {
  if (!traversalActive.value) {
    return [];
  }
  return model.value.traversalStages
    .filter((s) => (s.ask === 'reuse-action' || s.ask === 'animal-target') &&
      s.mustSelect && s.pick === undefined)
    .map((s) => s.position);
});
/**
 * THIS COMMIT FORFEITS THE TARGET REWARD.
 *
 * Candidates exist (`mustSelectCard`) and none was chosen, so a confirm
 * standing past the warning IS the decision: the batch carries it
 * (`waiveTarget` → `{deltaProject, waiveReward}`), the server defers no
 * SelectCard, and nothing rises after the move the player already
 * confirmed. Read off the MODEL, so both waivable doors — the plan CTA and
 * a card's entry — answer it identically; the prompt door never asks it
 * (its answer is an option index, which cannot carry the field).
 */
const waiveTargetNow = computed((): boolean => {
  return model.value.mustSelectCard && model.value.selectedCard === undefined;
});
/** Is the offer answerable right now (not already submitted)? */
const bonusAnswerable = computed((): boolean => {
  return advanceOffer.value !== undefined && !bonusSubmitting.value;
});
/**
 * THE LANDING STAGE'S REWARD, in the SAME view the standard advance builds
 * its own from — so the commit record, the reward wave and the result stage
 * of a bonus move are assembled by one function, not by a second, similar
 * one. (That was the whole defect: the bonus path had no reward view, so it
 * had no transfers, so nothing flew and the workspace had nothing to wait
 * for and closed on the spot.)
 */
const bonusRewardView = computed((): HydroRewardView => {
  return buildRewardView({
    stage: advanceOffer.value === undefined ? undefined : HYDRO_STAGES[advanceOffer.value.toPosition],
    snapshot: snapshot.value,
    rewardChoice: rewardChoice.value,
    // …including the pos-9 target, so the facts row states the animals'
    // own «сейчас → станет» the moment the card is picked — identical to
    // what the plan panel shows for the player's own advance.
    animalTargetCurrent: selectedAnimalCurrent.value,
    animalTargetCardName: model.value.selectedCard,
  });
});
/**
 * WHAT B DOES HERE — the shared policy, never a per-scene branch.
 *
 * The phase says how far the flow has gone; `ownsPrompt` says whether the
 * server is still waiting on this screen. Only their combination is honest:
 * on the BROWSE layer B closes the workspace normally, but under an owed
 * prompt the same layer has a live decision in it, so B collapses instead —
 * the board is inspectable, the prompt stays unanswered, and the board-home
 * mandatory card is the way back.
 *
 * B IS NEVER AN ANSWER. «Пропустить» is an option the player focuses and
 * confirms with A, like every other refusal in this console.
 */
const backVerb = computed((): WorkspaceBackVerb => {
  // A parked stop whose decision is not on this screen is NOT a beat in
  // flight — see `stalledAtStop`. «Свернуть» is the honest verb: the flow
  // is set aside, and the board-home restore card is the way to the
  // decision itself.
  if (stalledAtStop.value) {
    return 'collapse';
  }
  return backVerbWithOwedPrompt(hydroWorkspacePhase(props.followUpLive), props.ownsPrompt);
});
const backLabel = computed((): string | undefined => {
  // A card ENTRY is one logical level inside «ДЕЙСТВИЯ КАРТ», and B walks
  // back onto the variant the player chose — never «закрыть», which would
  // describe leaving a workspace they did not open.
  if (offerOrigin.value === 'card-entry' && backVerb.value === 'close') {
    return 'Back to the action';
  }
  return backLabelForVerb(backVerb.value);
});
const flowKind = computed((): string => {
  return hydroWorkspacePhase(props.followUpLive);
});
const ceremonyDim = computed((): boolean => {
  return flow.ceremonyActive;
});
/**
 * The configured pre-select stands and can be revisited.
 *
 * The reward CHOICE is deliberately absent: it is not a pre-select at
 * all any more but the first half of its own step (pick → confirm, both
 * inside), so there is never a configured reward sitting out here — the
 * exact state that used to survive a trip to the board and could then
 * only be changed by finding this chip.
 */
/**
 * THE PICK ROW STANDS FOR THE WHOLE STAGE, not only for a made choice.
 *
 * It used to appear only ONCE something had been chosen, so the one thing
 * the player had to do was the one thing the panel did not show — the CTA
 * quietly relabelled itself and that was the entire affordance. The row is
 * now the question's home from the first frame, in both scenes.
 */
/**
 * THE DECISION RAIL — every interactive pre-select of the current step,
 * as ONE ordered array of descriptors (the pure model in
 * `hydroDecisionRail.ts`). Both scenes feed the same builder: the offer
 * scene when a card's move is on the table, the plan scene otherwise. A
 * future multi-reward movement grows THIS array — never a new layout.
 */
const railDecisions = computed((): Array<HydroRailDecision> => {
  // A MULTI-REWARD move grows the ARRAY — one decision per interactive
  // ask of the plan, in path order (the layout's whole promise). The
  // plan's payment conflict rides in as the decision's own register.
  const conflict = model.value.planConflict;
  if (traversalActive.value && advanceOffer.value === undefined &&
      !hydroRuleBlocked(reasons.value)) {
    return buildTraversalDecisions(model.value.traversalStages,
      conflict !== undefined ? {position: conflict.position, resource: conflict.resource} : undefined);
  }
  const offer = advanceOffer.value !== undefined;
  return buildHydroDecisions({
    offered: offer ?
      (pickKind.value !== undefined && (bonusNeedsCard.value || pickFizzled.value)) :
      planPickOffered.value,
    kind: pickKind.value,
    mustSelectCard: model.value.mustSelectCard,
    chosen: model.value.selectedCard,
    // The prompt door postpones instead of waiving — its decision is not
    // optional in the rail sense (the server will re-ask).
    optional: offerOrigin.value !== 'prompt',
    conflict: !offer && conflict !== undefined ? {resource: conflict.resource} : undefined,
  });
});
/** The rail decision the cursor stands on (undefined off the rail). */
const railFocusedDecision = computed((): HydroRailDecision | undefined => {
  const id = railIdOf(sceneFocus.value);
  return id === undefined ? undefined : railDecisions.value.find((d) => d.id === id);
});
/** Does the rail hold any FOCUSABLE decision (the ↑/↓ hint's gate)? */
const railHasDecisions = computed((): boolean => {
  return railDecisions.value.some((d) => d.state !== 'unavailable');
});
/** What A means on the preview layer (the CTA and the bar agree). */
const primaryVerb = computed((): 'reinforce' | 'choose-reward' | 'blocked' => {
  const m = model.value;
  if (m.mode !== 'plan') {
    return 'blocked';
  }
  // A TRAVERSAL's choices live on the RAIL (per stop, visible, «Сменить»)
  // — the CTA routes to the first unresolved one, same vocabulary.
  if (traversalActive.value && advanceOffer.value === undefined) {
    if (reasons.value.some((r) => r.blocking)) {
      return 'blocked';
    }
    const openChoice = railDecisions.value.find((d) => d.kind === 'reward-choice' && d.state === 'open');
    if (openChoice !== undefined) {
      return 'choose-reward';
    }
    return m.canConfirm ? 'reinforce' : 'blocked';
  }
  // A choice stage ALWAYS routes into its step — the commit lives there
  // (never «reinforce» out here off a reward the player configured in a
  // previous visit and cannot see).
  if (m.targetNeedsChoice && reasons.value.every((r) => !r.blocking)) {
    return 'choose-reward';
  }
  // ⚠️ The pos 7/9 PICK is NOT a CTA state. The row above owns that
  // question (and the cursor starts on it); relabelling the commit button
  // «Выбрать действие» made it a SECOND picker opener — and, with the
  // pick also gating the commit, left no way to advance at all.
  return m.canConfirm ? 'reinforce' : 'blocked';
});
const primaryLabel = computed((): string => {
  if (primaryVerb.value === 'choose-reward') {
    return 'Choose a reward';
  }
  // With several valid mixes the plan's confirm is a GATEWAY, not the
  // final commit — the label must not promise a reinforce it will not
  // perform. The final verb lives on the payment substep.
  return mixAdjustable.value ? 'Continue to payment' : 'Reinforce the hydronetwork';
});
/** The reward step's commit verb: a GATEWAY while several mixes exist on
 *  the player's own advance (a card-granted move pays its energy toll and
 *  never mixes, so its verb stays final). */
const choiceCommitLabel = computed((): string => {
  return advanceOffer.value === undefined && mixAdjustable.value ?
    'Continue to payment' : 'Reinforce the hydronetwork';
});
/** Is the COMMIT what A would press right now? On the plan layer the cursor
 *  stands either on a rail decision or on everything else (track/cta), and
 *  only the focused affordance may wear the cap (the quick wheel's rule). */
const ctaFocused = computed((): boolean => {
  return railIdOf(sceneFocus.value) === undefined;
});
const commitCaption = computed((): string => {
  const c = flow.commit;
  if (c === undefined) {
    return '';
  }
  // A traversal narrates its CURRENT cell: the stop's own resolution
  // while parked there, the movement while the marker walks.
  if (c.traversal !== undefined && hydroMarkerState.planCursor >= 0) {
    const seg = traversalCurrentSegment.value;
    if (hydroMarkerState.planPaused && seg !== undefined) {
      switch (seg.kind) {
      case 'deck-draw': return 'The stage deals its cards';
      case 'repeat': return 'The chosen action executes';
      default: return 'The stage reward is resolving';
      }
    }
    return 'The marker is advancing along the track';
  }
  if (c.phase === 'moving') {
    return 'The marker is advancing along the track';
  }
  switch (c.kind) {
  case 'deck-draw': return 'The stage deals its cards';
  case 'repeat': return 'The chosen action executes';
  case 'ceremony': return 'The finish stage is reached';
  default: return 'The stage reward is resolving';
  }
});
/** The commit head follows the SEQUENCE's cursor on a traversal — the
 *  header may never sit on the destination while the marker walks.
 *  (The ONE post-commit stage derivation — `presentedCommitStage`.) */
const commitStageText = computed((): string => {
  const c = flow.commit;
  if (c === undefined) {
    return '';
  }
  return presentedCommitStage.value?.nameKey ?? c.stageNameKey;
});
/**
 * THE TERMINAL CEREMONY SEAT EXISTS ONLY FROM THE MARKER'S ARRIVAL at the
 * finish stop — never as the commit layer's standing furniture. Before the
 * physical settle the terminal reward has no presence in the scene at all
 * (no early hero to hide with opacity tricks); from the settle it stands
 * through the ceremony until the result layer replaces the commit layer.
 * `cereStarted` latches on the exact settle edge, so the 800 ms settle
 * pulse clearing cannot blink the seat away mid-ceremony.
 */
const cereVisible = computed((): boolean => {
  const c = flow.commit;
  if (c === undefined || c.kind !== 'ceremony' || c.phase === 'result') {
    return false;
  }
  return cereStarted.value || flow.ceremonyActive || markerSettled.value === c.toPosition;
});
/** The committed traversal segment the sequence is AT (the paused stop, or
 *  the leg in flight). Undefined once the plan finishes. */
const traversalCurrentSegment = computed((): HydroTraversalSegmentRecord | undefined => {
  const c = flow.commit;
  if (c?.traversal === undefined) {
    return undefined;
  }
  const cursor = hydroMarkerState.planCursor;
  if (cursor < 0) {
    return undefined;
  }
  // The PAUSED sequence stands on the leg it just finished (cursor is the
  // NEXT leg to run) — the stop's own cell is cursor − 1.
  const at = hydroMarkerState.planPaused ? cursor - 1 : cursor;
  return c.traversal[Math.max(0, Math.min(at, c.traversal.length - 1))];
});
/** The modifier's preview note, its card name folded in. */
const traversalNoteText = computed((): string => {
  const card = model.value.traversalModifierCard;
  return translateTextWithParams('${0}: each crossed stage grants its reward',
    [card !== undefined ? translateCardName(card) : '']);
});
/** The frame hosting this one, or undefined when the track IS the root. */
const crumbHost = computed((): WorkspaceFrameKind | undefined => {
  return workspaceFrameHost('hydro');
});
const crumbRoot = computed((): string => {
  return crumbHost.value === undefined ? 'Mars Hydronetwork' : workspaceFrameRoot(crumbHost.value);
});
const crumbEmblem = computed((): {emblem?: string, wheelAnchor?: string} => {
  return workspaceFrameEmblem(crumbHost.value ?? 'hydro');
});
/**
 * THE SUBJECT THE HEADER DRAWS — the DEEPEST carried object of the whole
 * stack, which for a hosted step is the host's (the card the player is
 * acting with). Published separately from {@link crumbSubject}, which is
 * what this FRAME contributes to that same stack: a hosted step
 * contributes nothing, so the card never restarts.
 */
const headSubject = computed((): string => {
  return crumbHost.value === undefined ?
    crumbSubject.value :
    (workspaceStackCrumb()?.subject?.text ?? '');
});
const crumbSubject = computed((): string => {
  // HOSTED: the SUBJECT belongs to the host (the card the player is
  // acting with) and must never restart. What this screen would have
  // called a subject is a STAGE of that card's flow, and `crumbStage`
  // already says it.
  if (crumbHost.value !== undefined) {
    return '';
  }
  const c = flow.commit;
  if (c !== undefined) {
    // The subject follows the PRESENTATION CURSOR — a traversal's header
    // may never sit on the destination while the marker walks.
    return presentedCommitStage.value?.nameKey ?? c.stageNameKey;
  }
  if (flow.step !== undefined || flow.repeatBridge) {
    return model.value.targetStage?.nameKey ?? '';
  }
  return '';
});
const crumbStage = computed((): string => {
  // The offer NEVER titles itself inside the frame — the crumb's tail is
  // where it names itself, so the workspace name and the source stay put
  // and only the stage segment advances.
  if (sceneKey.value === 'bonus') {
    return bonusStageKey.value;
  }
  // The reward-only pick's own tail; its nested steps advance it further.
  if (props.rewardOffer !== undefined && flow.commit === undefined) {
    switch (flow.step) {
    case 'reward': return 'Reward choice';
    case 'target': return 'Target card';
    default: return flow.repeatBridge ? 'Repeat action' : 'Reward selection';
    }
  }
  // The espionage/blockade picks' own tail — the same one-word grammar.
  if ((props.espionageOffer !== undefined || props.blockadeOffer !== undefined) && flow.commit === undefined) {
    return 'Target selection';
  }
  // The deploy's execution receipt.
  if (props.blockadeExecution !== undefined && flow.commit === undefined) {
    return 'Deployment';
  }
  const c = flow.commit;
  if (c !== undefined) {
    if (c.phase === 'result') {
      return 'Result';
    }
    if (c.phase === 'moving') {
      return 'Movement';
    }
    // A TRAVERSAL'S TAIL FOLLOWS THE SEQUENCE'S OWN CURSOR — «ФИНАЛЬНАЯ
    // НАГРАДА» may only ever name the terminal cell the marker has
    // actually reached, never the destination of a walk still in its
    // middle (the phase leaves `moving` on the first pause, so the
    // destination noun below would otherwise take the tail right there).
    if (c.traversal !== undefined && hydroMarkerState.planCursor >= 0) {
      if (!hydroMarkerState.planPaused) {
        return 'Movement';
      }
      if (workspaceOutcomeState.host === 'hydro' && workspaceOutcomeState.phaseKey !== '') {
        return workspaceOutcomeState.phaseKey;
      }
      switch (traversalCurrentSegment.value?.kind) {
      case 'repeat': return 'Repeat action';
      case 'ceremony': return 'Final reward';
      default: return 'Reward';
      }
    }
    // The embedded surface hands its stage name UP — read it back for the
    // crumb tail; fall back to the resolution's own noun.
    if (workspaceOutcomeState.host === 'hydro' && workspaceOutcomeState.phaseKey !== '') {
      return workspaceOutcomeState.phaseKey;
    }
    switch (c.kind) {
    case 'ceremony': return 'Final reward';
    case 'repeat': return 'Repeat action';
    default: return 'Reward';
    }
  }
  switch (flow.step) {
  case 'reward': return 'Reward choice';
  case 'target': return 'Target card';
  // The composition substep names itself in the crumb tail exactly as its
  // sibling steps do — «ГИДРОСЕТЬ МАРСА › <этап> › ОПЛАТА». A step whose
  // tail stayed empty read as the header losing the walk.
  case 'payment': return 'Payment';
  default: return flow.repeatBridge ? 'Repeat action' : '';
  }
});
const crumbCommitted = computed((): boolean => {
  return flow.commit !== undefined;
});
// ── the reward CHOICE layer (pos 1/2) ──────────────────────────────────
/** Each option carries its OWN honest delta (`line`) — the one object the
 *  card renders. `chips` stays as the fallback for a reward with no
 *  concrete reading. */
/** The stage the reward step is about: a traversal decision's OWN stop
 *  when one opened it, the OFFER's landing stage while one is live, else
 *  the player's own planned target. */
const choiceStageModel = computed((): HydroStage | undefined => {
  if (choicePosition.value !== undefined) {
    return HYDRO_STAGES[choicePosition.value];
  }
  const offer = advanceOffer.value;
  return offer !== undefined ? HYDRO_STAGES[offer.toPosition] : model.value.targetStage;
});
const choiceOptions = computed((): ReadonlyArray<{
  chips: HydroStage['rewardOptions'][number],
  line: HydroDeltaLine | undefined,
  reaction: VariantReaction,
}> => {
  const stage = choiceStageModel.value;
  if (stage === undefined) {
    return [];
  }
  // A traversal stage's options read the snapshot THREADED up to its own
  // stop — the honest base after every earlier crossed gain.
  const snapshotNow = choicePosition.value !== undefined ?
    (traversalViews.value.startSnapshots[choicePosition.value] ?? snapshot.value) :
    snapshot.value;
  // THE OPTION'S OWN ANSWER (iteration 6): the server's per-option forecast of the stage this choice belongs to.
  const pos = choicePosition.value ?? advanceOffer.value?.toPosition ?? model.value.selectedPosition;
  const dest = preview.value?.destinations.find((d) => d.position === pos);
  return stage.rewardOptions.map((chips, i) => ({
    chips,
    line: buildRewardView({stage, snapshot: snapshotNow, rewardChoice: i}).lines[0],
    reaction: reactionChipsOf(dest?.forecastOptions?.[i]?.facts ?? []),
  }));
});
// ── the TARGET step (pos 9) ────────────────────────────────────────────
/** The animal-target eligibility, whichever shape asks it: the traversal's
 *  own stage-9 entry, the reward-only pick's server list, or the single
 *  landing's destination-derived list. */
const animalTargetEligible = computed((): ReadonlyArray<CardName> => {
  // The reward-only pick asks the SERVER's own candidate list — the track
  // preview carries it independently of any movement destination.
  if (props.rewardOffer !== undefined) {
    return rewardFocusAsk.value?.kind === 'target' ? (preview.value?.animalTargetCards ?? []) : [];
  }
  if (traversalActive.value && advanceOffer.value === undefined) {
    const s = traversalAnimalStage.value;
    return s !== undefined && s.mustSelect ? (preview.value?.animalTargetCards ?? []) : [];
  }
  return model.value.needsCardSelect === 'animal-target' ? model.value.eligibleCardNames : [];
});
const targetStepModel = computed((): PlayedTargetModel | undefined => {
  if (animalTargetEligible.value.length === 0) {
    return undefined;
  }
  return buildHydroTargetModel({
    eligible: animalTargetEligible.value,
    tableau: props.playerView.thisPlayer.tableau,
    players: props.playerView.players.map((p) => ({name: p.name, color: p.color, tableau: p.tableau})),
    viewerColor: viewerColor.value,
    ask: translateText('Choose a card to receive the animals'),
    typeOf: (name) => getCard(name)?.type,
  });
});
const targetLayout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: targetStepModel.value?.owners ?? [],
    availW: targetZoneW.value > 0 ? targetZoneW.value : 900,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
const targetBandH = computed((): number => {
  return Math.max(0, targetZoneH.value);
});
const targetLockedCard = computed((): string => {
  if (props.rewardOffer !== undefined) {
    return hydroNetworkState.planPicks[model.value.selectedPosition] ?? '';
  }
  if (traversalActive.value && advanceOffer.value === undefined) {
    return traversalAnimalStage.value?.pick ?? '';
  }
  return model.value.selectedCard ?? '';
});
// ── the COMMIT scene (pos 9 presented target) ──────────────────────────
const presentedTargetCard = computed((): CardName | undefined => {
  const c = flow.commit;
  if (c === undefined || c.phase === 'result') {
    return undefined;
  }
  // A traversal presents the target card WHILE ITS OWN CELL resolves —
  // the animals land on a face standing on stage, exactly as a landing.
  // FROM THE ARRIVAL, never during the glide TOWARDS the cell: the
  // cursor names the leg from the charge frame, and mounting the card
  // then had it standing over a marker still three cells away. The
  // marker's own settled cell (`visualPosition`) is the arrival fact.
  if (c.traversal !== undefined) {
    const seg = traversalCurrentSegment.value;
    if (seg?.kind !== 'card-resource') {
      return undefined;
    }
    return hydroMarkerState.visualPosition === seg.position ? seg.selectedCard : undefined;
  }
  if (c.kind !== 'card-resource') {
    return undefined;
  }
  // The single landing's same rule: the card appears when the marker has
  // ARRIVED (the moving phase ends at the lock), not with the commit.
  return c.phase === 'moving' ? undefined : c.selectedCard;
});
const presentedLanded = computed((): number => {
  const card = presentedTargetCard.value;
  return card !== undefined ? (landings.by[card] ?? 0) : 0;
});
/** The presented face's frozen pre-commit count, whichever shape froze it. */
const presentedBefore = computed((): number => {
  const c = flow.commit;
  if (c?.traversal !== undefined) {
    return traversalCurrentSegment.value?.targetBefore ?? 0;
  }
  return c?.targetBefore ?? 0;
});
const presentedModel = computed((): CardModel => {
  const c = flow.commit;
  const card = presentedTargetCard.value as CardName;
  const live = props.playerView.thisPlayer.tableau.find((t) => t.name === card);
  const before = c?.traversal !== undefined ?
    (traversalCurrentSegment.value?.targetBefore ?? 0) : (c?.targetBefore ?? 0);
  return hydroPresentedTargetModel(card, before, live, presentedLanded.value);
});
/** The presented card's own CELL — the identity the presence report and
 *  the leave handshake are keyed on (stable through the whole payout). */
const presentedLandPosition = computed((): number => {
  const c = flow.commit;
  if (c?.traversal !== undefined) {
    return traversalCurrentSegment.value?.position ?? -1;
  }
  return c?.toPosition ?? -1;
});
/** The command contract of the current step — published to the shell. */
// ── Delta Works payment mix (steel 1:1 for energy) ────────────────────
/** The substitution is live (the card in the tableau, steel on hand). */
const mixRowVisible = computed((): boolean => {
  return model.value.mode === 'plan' && model.value.selectedSpend > 0 &&
    (model.value.availableSteelSubstitute > 0 || floodgateLaneLive.value);
});
/** Modular Floodgates steel can pay part of THIS move (the standard
 *  advance, Delta Works live, steel on the card). */
const floodgateLaneLive = computed((): boolean => {
  return model.value.maxFloodgateForSpend > 0;
});
/** Both the stock steel and the Floodgates' steel are dialable — ↑/↓
 *  then choose the lane the bumpers move. */
const mixTwoLanes = computed((): boolean => {
  return floodgateLaneLive.value && model.value.maxSteelForSpend > model.value.minSteelForSpend;
});
/** The lane the bumpers move NOW (the only live one when one stands). */
const mixActiveLane = computed((): 'steel' | 'floodgateSteel' => {
  if (!floodgateLaneLive.value) {
    return 'steel';
  }
  return mixTwoLanes.value ? mixLane.value : 'floodgateSteel';
});
/** More than one valid mix — the bumpers become a dial; else a summary.
 *  A live Floodgates lane always is: the protected pool is the player's
 *  explicit choice, so the composition step must exist to make it. */
const mixAdjustable = computed((): boolean => {
  return mixRowVisible.value &&
    (model.value.maxSteelForSpend > model.value.minSteelForSpend || floodgateLaneLive.value);
});
/** The draft PAYS the move — energy + stock steel + the Floodgates' share
 *  cover the price. A move the ordinary pools cannot pay stays short until
 *  the player raises the protected lane: never auto-taken, never submitted
 *  short (the server would refuse it). */
const mixCovered = computed((): boolean => {
  const m = model.value;
  if (m.mode !== 'plan' || advanceOffer.value !== undefined) {
    return true;
  }
  return m.selectedSpend - m.floodgateSteelForSpend - mixSteel.value <= m.availableEnergy;
});
/** The EFFECTIVE steel share — THE canonical draft value. The preference
 *  is clamped by the ONE shared rule (never a private copy of the bounds
 *  arithmetic); the panel, the command bar, the commit record and the
 *  submit payload all read THIS number. */
const mixSteel = computed((): number => {
  if (!mixRowVisible.value) {
    return 0;
  }
  return clampEnergyMixSteel(steelPreference.value,
    {minSteel: model.value.minSteelForSpend, maxSteel: model.value.maxSteelForSpend});
});
/** The whole payment as the SHARED PaymentView — the same rows / captions /
 *  verdict grammar the card-play selector renders, over the same draft. */
const mixPaymentView = computed((): PaymentView => {
  return buildEnergyMixView({
    cost: model.value.selectedSpend,
    energyAvailable: model.value.availableEnergy,
    steelAvailable: model.value.availableSteelSubstitute,
    minSteel: model.value.minSteelForSpend,
    maxSteel: model.value.maxSteelForSpend,
    steelUsed: mixSteel.value,
    ...(floodgateLaneLive.value ? {floodgate: {
      available: model.value.availableFloodgateSteel,
      used: model.value.floodgateSteelForSpend,
      max: model.value.maxFloodgateForSpend,
    }} : {}),
  });
});
/** The substitution's source card (English name IS the i18n key) — the
 *  panel's secondary badge, present only while the mix is live. */
const mixSourceCard = computed((): string | undefined => {
  return mixRowVisible.value ? model.value.steelSubstituteCard : undefined;
});
/** «Зарезервировано: N ⚡ — <карта>» — the plan's protected energy, named
 *  beside the price it is protected FROM. Empty when nothing is held. */
const reservedNoteText = computed((): string => {
  const m = model.value;
  if (m.reservedEnergyForAction <= 0 || m.planCommitment === undefined) {
    return '';
  }
  return translateTextWithParams('Reserved: ${0} energy — ${1}',
    [String(m.reservedEnergyForAction), translateCardName(m.planCommitment.card)]);
});
/** The plan's declaration for the COMMIT wire: the pre-selected repeated
 *  action (single landing or the traversal's stage) + the choice answers
 *  whose gains fund it — the server re-validates the ordered projection
 *  against these BEFORE any mutation. */
const plannedActionsForCommit = computed((): Array<{position: number, card: CardName}> => {
  const c = model.value.planCommitment;
  return c !== undefined ? [{position: c.position, card: c.card}] : [];
});
const plannedChoicesForCommit = computed((): Array<{position: number, choice: number}> => {
  if (!traversalActive.value) {
    return [];
  }
  return model.value.traversalStages
    .filter((s) => s.ask === 'choice' && s.choice !== undefined)
    .map((s) => ({position: s.position, choice: s.choice as number}));
});
const footCommands = computed((): ReadonlyArray<ConsoleCommand> => {
  // THE R3 «ЭФФЕКТЫ» LAYER owns the bar while it is open — the explorer's own contract, verbatim (PL-394).
  if (fxOpen.value) {
    return [...(forecastExplorerUi('hydro').barCommands ?? [])];
  }
  const c = flow.commit;
  if (c !== undefined) {
    if (c.phase === 'result') {
      return [{control: 'confirm', label: 'Continue'}];
    }
    if (props.followUpLive) {
      // The embedded follow-up surface publishes its own contract; the
      // shell's ladder routes there — this slot stays honest and empty
      // except the collapse verb.
      return [{control: 'back', label: 'Minimize'}];
    }
    return [{control: 'confirm', label: 'Executing', enabled: false}];
  }
  if (flow.step === 'reward') {
    // A traversal decision's step SELECTS AND RETURNS — the rail owns the
    // final commit, so the bar carries only the selector's verbs.
    if (choicePosition.value !== undefined) {
      return [
        {control: 'dpadH', label: 'Reward options', priority: 2},
        {control: 'confirm', label: 'Select'},
        {control: 'back', label: 'Back'},
      ];
    }
    // The step confirms ITSELF: A on an option arms the commit right
    // under it, A again reinforces. ↑ (or ←/→) goes back to the options
    // — a change of mind never leaves the step either. The bar follows
    // the cursor onto the optional refusal, exactly as the offer's does.
    if (choiceStage.value === 'confirm') {
      return [
        {control: 'dpadU', control2: 'dpadD', label: 'Change selection', priority: 2},
        {control: 'confirm', label: choiceSkipFocus.value ? bonusCopy.value.skipKey : choiceCommitLabel.value},
        // R3 only when the table answers the chosen option (iteration 6 — the composers' order).
        ...(forecastCanOpen.value ? [{control: 'stickR', label: 'Effects'} as ConsoleCommand] : []),
        {control: 'back', label: 'Cancel'},
      ];
    }
    return [
      {control: 'dpadH', label: 'Reward options', priority: 2},
      {control: 'confirm', label: 'Select'},
      {control: 'back', label: 'Cancel'},
    ];
  }
  // PAYMENT — the composition substep's own contract: the dial, the
  // final reinforce, and B back to the plan. Nothing else.
  if (flow.step === 'payment') {
    return [
      ...(mixTwoLanes.value ? [{control: 'dpad' as const, label: 'Payment source', priority: 2}] : []),
      {control: 'bumperL', control2: 'bumperR', label: 'Payment mix', priority: 2},
      {control: 'confirm', label: 'Reinforce the hydronetwork', enabled: mixCovered.value},
      {control: 'back', label: 'Back'},
    ];
  }
  // REWARD-ONLY PICK: the track walk, ONE confirm whose label follows the
  // owed ask, the source inspect and the way back — never a movement verb.
  if (sceneKey.value === 'reward-pick') {
    const ask = rewardFocusAsk.value;
    return [
      {control: 'dpadH', label: 'Stages', priority: 2},
      {
        control: 'confirm',
        label: ask !== undefined && !ask.answered ? rewardAskLabel.value : 'Select the stage reward',
        enabled: rewardFocusClaimable.value,
      },
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Back to the action'},
    ];
  }
  // ESPIONAGE TARGET PICK: the candidate walk, ONE confirm whose state
  // follows the focused row's legality, the source inspect, the way back.
  if (sceneKey.value === 'espionage-pick') {
    return [
      {control: 'dpadU', control2: 'dpadD', label: 'Candidates', priority: 2},
      {control: 'confirm', label: 'Select the target', enabled: espionageFocusRow.value?.target.legal === true},
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Back to the play'},
    ];
  }
  // BLOCKADE TARGET PICK: the same four verbs, the ACTION's way back.
  if (sceneKey.value === 'blockade-pick') {
    return [
      {control: 'dpadU', control2: 'dpadD', label: 'Candidates', priority: 2},
      {control: 'confirm', label: 'Select the target', enabled: blockadeFocusRow.value?.target.legal === true},
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Back to the action'},
    ];
  }
  // BLOCKADE EXECUTION: one verb — the receipt is read and the flow leaves.
  if (sceneKey.value === 'blockade-exec') {
    return [
      {control: 'confirm', label: 'Done'},
      {control: 'secondary', label: 'Inspect'},
    ];
  }
  if (sceneKey.value === 'bonus') {
    // THE THREE VERBS OF A DECISION SURFACE, and nothing else:
    //   A — confirm what the cursor is on (its label FOLLOWS the cursor);
    //   X — inspect the source card;
    //   B — СВЕРНУТЬ: go and read the board, the question stays open.
    //
    // B is deliberately NOT «Пропустить». Showing the refusal on the one
    // button that means «step out» everywhere else in this console is how a
    // player looking for the board silently declined a card's effect — and
    // an effect declined that way cannot be got back. The skip lives where
    // every other refusal does: as an option, taken with A.
    //
    // While the answer is in flight the verbs are DISABLED rather than
    // removed: a bar that empties mid-press reads as the surface having
    // gone away. Collapse survives it — parking a submitted answer is
    // harmless and the flow comes back to its own result.
    return [
      {control: 'dpad', label: 'Choose', priority: 2},
      {control: 'confirm', label: bonusConfirmLabel.value, enabled: bonusAnswerable.value},
      {control: 'secondary', label: 'Inspect', enabled: bonusAnswerable.value},
      {control: 'back', label: backLabel.value ?? 'Minimize'},
    ];
  }
  if (flow.step === 'target') {
    const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Navigate', priority: 2}];
    if (targetLayout.value.mode === 'tabs' && (targetStepModel.value?.owners.length ?? 0) > 1) {
      cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Owner'});
    }
    cmds.push(
      {control: 'confirm', label: 'Select'},
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Cancel'},
    );
    return cmds;
  }
  const cmds: Array<ConsoleCommand> = [{control: 'dpadH', label: 'Stages', priority: 2}];
  if (railHasDecisions.value) {
    cmds.push({control: 'dpadU', control2: 'dpadD', label: 'Selection', priority: 3});
  }
  cmds.push({control: 'triggerR', label: 'Farthest stage'});
  // R3 only when the table's answer has something behind it (iteration 6 — the composers' and the stages' order).
  if (forecastCanOpen.value) {
    cmds.push({control: 'stickR', label: 'Effects'});
  }
  // (No LB/RB mix hint on Configure — the dial belongs to the payment
  // substep; the CTA's own «Продолжить к оплате» names the way there.)
  if (model.value.mode === 'details') {
    cmds.push({control: 'confirm', label: 'Back to plan'});
  } else if (railFocusedDecision.value !== undefined) {
    // The decision's own verb — «Выбрать» while the question stands,
    // «Сменить» once it is answered. A generic «Изменить выбор» over an
    // unanswered row promises there is a selection to change.
    cmds.push({control: 'confirm', label: pickVerbKey.value, enabled: railFocusedDecision.value.state !== 'unavailable'});
  } else {
    cmds.push({control: 'confirm', label: primaryLabel.value, enabled: primaryVerb.value !== 'blocked'});
  }
  // «К полю» closes; under an OWED prompt the same press collapses instead
  // (the browse layer is standing over a live decision — see `backVerb`).
  cmds.push({control: 'back',
    label: backVerb.value === 'collapse' ? 'Minimize' :
      offerOrigin.value === 'card-entry' ? 'Back to the action' : 'To the board'});
  return cmds;
});
/**
 * The pre-select decision's IDENTITY: which door, which stage, which pick
 * kind, and whether it is currently ANSWERABLE. One derivation for every
 * pre-select family this track has (repeat action, animal target, and any
 * future stage decision of the same shape) — never a stage/card literal.
 */
const pickDecisionKey = computed((): string => {
  return [
    offerOrigin.value ?? 'plan',
    advanceOffer.value?.toPosition ?? model.value.selectedPosition,
    pickKind.value ?? '-',
    model.value.mustSelectCard ? 'open' : 'closed',
  ].join('|');
});
/** The draft's world-version fingerprint (for RESUME ≠ FRESH decisions). */
const draftFingerprint = computed((): string => {
  return [
    hydroNetworkState.selectedPosition,
    hydroNetworkState.rewardChoice,
    hydroNetworkState.selectedCard,
    JSON.stringify(hydroNetworkState.planChoices),
    JSON.stringify(hydroNetworkState.planPicks),
    consoleHydroUi.repeatResult?.chosenCard,
  ].join('|');
});
/** The repeat bridge's resolve, mirrored for the traversal draft (the
 *  bridge writes the shared single-landing fields; a traversal keys its
 *  stage-7 draft per position). */
const repeatResultMirror = computed((): ConsoleRepeatPickResult | undefined => {
  return consoleHydroUi.repeatResult;
});

/** The result's notes speak WORDS (EG-5 · FI): a repeat and a card-resource target name the card with their verb. */
function repeatNote(card: CardName): string {
  return translateTextWithParams('Action repeated: ${0}', [translateCardName(card)]);
}
function resourcesOntoNote(card: CardName): string {
  return translateTextWithParams('Resources onto: ${0}', [translateCardName(card)]);
}
/** R3 / a click on the «⚡ сработает» door — the WORKSPACE DESCEND into the layer (PL-066). */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  pulseCall = pulseForecastDoor((on) => {
    forecastPulse.value = on;
  }, pulseCall);
  openForecastHost('hydro', rootEl.value ?? undefined, forecastOwnerColors.value, props.playerView);
}
/** Input while the layer is open: B folds one level, R3 closes the whole layer, the rest is the explorer's. */
function forecastIntent(intent: GamepadIntent): void {
  forecastHostIntent('hydro', intent, forecastLayer.value ?? undefined);
}
function fetchPreview(): void {
  fetchHydroPreview(props.playerView.id, viewerColor.value, props.cacheKey + ':' + viewerColor.value);
}
/** Rebuild the movement-link arcs on the NEXT laid-out frame, then once
 *  more after the stopin transition settles (the focused cell grows and
 *  re-flows the rail — a single early measure draws the arc to a cell
 *  that is still moving). Bounded: one timer, no loop. */
function scheduleGhostLinkMeasure(): void {
  if (ghostLinkTimer !== undefined) {
    ghostLinkTimer();
    ghostLinkTimer = undefined;
  }
  if (ghostLinks.value.length === 0) {
    ghostLinkPaths.value = [];
    return;
  }
  nextTick(() => {
    measureGhostLinks();
    ghostLinkTimer = flowScope.after(motionMs(420), 'the movement links\' re-measure after the stop settles', () => {
      ghostLinkTimer = undefined;
      measureGhostLinks();
    });
  });
}
/** MEASURED off the real marker rows (`[data-hydro-marker]`), in the
 *  rail's own px space — the arc goes exactly from the cell the marker
 *  stands in to the cell its ghost projects into, trimmed at both ends
 *  so the tokens themselves stay unobscured. */
function measureGhostLinks(): void {
  const rail = railEl.value ?? undefined;
  if (rail === undefined || ghostLinks.value.length === 0) {
    ghostLinkPaths.value = [];
    return;
  }
  const railRect = rail.getBoundingClientRect();
  if (railRect.width === 0) {
    return; // hidden/unmeasured — keep whatever stands, the observer re-asks
  }
  const k = conUiScale();
  const paths: Array<{key: string, d: string, tip: string, dir: 'fwd' | 'back'}> = [];
  for (const link of ghostLinks.value) {
    const fromEl = rail.querySelector(`[data-hydro-marker="${link.from}"]`);
    const toEl = rail.querySelector(`[data-hydro-marker="${link.to}"]`);
    if (fromEl === null || toEl === null) {
      continue;
    }
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const x1 = a.left + a.width / 2 - railRect.left;
    const y1 = a.top + a.height / 2 - railRect.top;
    const x2 = b.left + b.width / 2 - railRect.left;
    const y2 = b.top + b.height / 2 - railRect.top;
    if (Math.abs(x2 - x1) < 4) {
      continue;
    }
    // A quiet arc lifted above the marker rows; both ends trimmed (de
    // Casteljau sub-curve) so neither the real marker nor the ghost is
    // painted over, and the head lands just short of the destination.
    const lift = Math.min(36 * k, Math.max(14 * k, Math.abs(x2 - x1) * 0.13));
    const cx = (x1 + x2) / 2;
    const cy = Math.min(y1, y2) - lift;
    const q = (t: number): [number, number] => [
      (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2,
      (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2,
    ];
    const t0 = 0.08;
    const t1 = 0.9;
    const [sx, sy] = q(t0);
    const [ex, ey] = q(t1);
    // The sub-curve's control point (the segment's own de Casteljau frame).
    const scx = (1 - t0) * ((1 - t1) * x1 + t1 * cx) + t0 * ((1 - t1) * cx + t1 * x2);
    const scy = (1 - t0) * ((1 - t1) * y1 + t1 * cy) + t0 * ((1 - t1) * cy + t1 * y2);
    const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${scx.toFixed(1)} ${scy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    const ang = Math.atan2(ey - scy, ex - scx);
    const len = 7.5 * k;
    const wid = 4.2 * k;
    const bx = ex - Math.cos(ang) * len;
    const by = ey - Math.sin(ang) * len;
    const nx = -Math.sin(ang) * wid;
    const ny = Math.cos(ang) * wid;
    const tip = `${ex.toFixed(1)},${ey.toFixed(1)} ${(bx + nx).toFixed(1)},${(by + ny).toFixed(1)} ${(bx - nx).toFixed(1)},${(by - ny).toFixed(1)}`;
    paths.push({key: link.key, d, tip, dir: link.dir});
  }
  ghostLinkPaths.value = paths;
}
/** The pos-9 card's leave transition ENDED — release the sequence that
 *  awaits it (the cursor may move on; the next leg may start). */
function onLandCardLeft(): void {
  if (landReportedPosition.value >= 0) {
    noteHydroLandPresence(landReportedPosition.value, false);
    landReportedPosition.value = -1;
  }
}
/**
 * SEAT THE PLAN ON THE OFFER'S DESTINATION.
 *
 * Everything this workspace already knows how to pre-select — the reward
 * step, the repeat browser bridge, the embedded target step, the
 * eligibility list, the summary chip — is derived from `selectedPosition`.
 * Seating it here makes ALL of them describe the LANDING stage, with no
 * second implementation and no per-case wiring: that is what lets a
 * card-granted move reuse the ordinary advance's pre-select verbatim
 * instead of letting the pick arrive after the commit as a standalone
 * legacy card browser.
 *
 * ⚠️ ASKED ON BOTH EDGES. The offer watcher runs at SETUP, and `onMounted`
 * legitimately calls `resetHydroPlan()` for a fresh open — which lands
 * AFTER it and wiped the seat, so the landing stage was never the thing
 * being configured. A mount is not a change; it has to ask for itself.
 */
/**
 * PLACE THE OWED SEAT, once something can answer «is a pick required here?».
 *
 * A ONE-SHOT: consumed by the first frame with a live preview, so a seat
 * decided here can never later fight the player's own cursor (or the
 * hand-off a made pick performs). Without it the seat was decided at SETUP,
 * where the preview does not exist yet and the answer is always «no».
 */
function applyOwedSeat(): void {
  if (!seatOwed.value || preview.value === undefined) {
    return;
  }
  seatOwed.value = false;
  // THE MATRIX, computed from decision STATE alone: the first open
  // decision in game order, else the final CTA. A resolved pick never
  // retakes the automatic seat; an unavailable slot never counts.
  seatRailFocus(initialRailFocus(railDecisions.value));
}
/** Seat a rail node, mapping the CTA stop onto the scene's own confirm
 *  (the offer's answer plate, or the plan's commit). ONE mapper, so no
 *  caller re-guesses which button is «the CTA» in which scene. */
function seatRailFocus(node: string): void {
  if (node !== HYDRO_RAIL_CTA) {
    sceneFocus.value = node as HydroSceneFocus;
    return;
  }
  sceneFocus.value = advanceOffer.value !== undefined ? 'bonus-confirm' : 'cta';
}
/**
 * RE-SEAT ON A NEW DECISION REVISION (`pickDecisionKey` changed). Runs the
 * ordinary owed-seat machinery — same priority, same one-shot — but only
 * while the browse stage is what the player is looking at, and never over
 * a cursor they have already moved by hand inside this revision.
 */
function seatOnOwedPick(): void {
  // Only the two BROWSE-shaped scenes hold a seatable pre-select; a step
  // (choice/target/payment) and the commit own their own cursor.
  if ((sceneKey.value !== 'preview' && sceneKey.value !== 'bonus') || focusMoved.value) {
    return;
  }
  seatOwed.value = true;
  applyOwedSeat();
}
function seatPlanOnOffer(): boolean {
  const offer = advanceOffer.value;
  if (offer === undefined) {
    return false;
  }
  hydroNetworkState.selectedPosition = offer.toPosition;
  return true;
}
function syncFrameCrumb(): void {
  setWorkspaceFrameSubject('hydro', crumbSubject.value);
  setWorkspaceFrameStage('hydro', crumbStage.value);
  // …AND THE CARD THIS STEP IS BEING DONE FOR. The crumb subject here is the
  // STAGE NAME, so anything hosted inside this workspace — a repeated
  // trade's colony pick, any future nested step — would otherwise have no
  // way to name its cause, and the shared `L3 Источник` would point at a
  // string that is not a card. The active repeat step already knows.
  setWorkspaceFrameSourceCard('hydro', embedSourceCard.value ?? '');
}
function publishEmbedZone(): void {
  setWorkspaceFrameSlot('hydro', HYDRO_EMBED_SLOT);
  if (workspaceOutcomeState.host === 'hydro') {
    setWorkspaceOutcomeSlot(HYDRO_EMBED_SLOT);
  }
}
function retractEmbedZone(): void {
  setWorkspaceFrameSlot('hydro', '');
  // Only OUR zone (ledger HC) — never a slot another host published meanwhile.
  retractWorkspaceOutcomeSlot(HYDRO_EMBED_SLOT);
}
function reasonText(r: HydroReason): string {
  // …through the SHARED rule (`reasonParams`) — one sentence, one name for
  // the missing tag, on every surface that states a refusal.
  const params = reasonParams(r.params, r.tag as Tag | undefined);
  return params.length > 0 ?
    translateTextWithParams(r.textKey, params) :
    translateText(r.textKey);
}
/** The reason's visual register — data, never a per-row colour choice. */
function reasonTone(r: HydroReason): 'warning' | 'danger' {
  return hydroReasonBlocker(r).tone;
}
function tagStatus(tag: Tag): 'have' | 'wild' | 'missing' {
  const dest = model.value.destination;
  if (dest === undefined) {
    return 'have';
  }
  if ((dest.missingTags as ReadonlyArray<Tag>).includes(tag)) {
    return 'missing';
  }
  if ((dest.wildCoveredTags as ReadonlyArray<Tag>).includes(tag)) {
    return 'wild';
  }
  return 'have';
}
function deltaIconClass(l: HydroDeltaLine): string {
  if (l.special === 'jovian-tag') {
    return 'resource-tag tag-jovian';
  }
  if (l.special === 'animals') {
    return 'card-resource card-resource-animal';
  }
  return l.resource !== undefined ? iconClassFor(l.resource) : '';
}
/** A passive movement bonus's icon — always a standard resource pool. */
function extraIconClass(b: DeltaMovementBonusProjection): string {
  return iconClassFor(b.resource);
}
/** A committed traversal segment's presentation state — the strip's chips
 *  follow the sequence's own cursor (done / current / pending). */
function travSegState(seg: HydroTraversalSegmentRecord): 'done' | 'current' | 'pending' {
  const c = flow.commit;
  if (c?.traversal === undefined) {
    return 'pending';
  }
  const idx = c.traversal.findIndex((s) => s.position === seg.position);
  const cursor = hydroMarkerState.planCursor;
  if (cursor < 0) {
    // The plan finished (or never ran — a reload): everything reads done.
    return 'done';
  }
  const at = hydroMarkerState.planPaused ? cursor - 1 : cursor;
  if (idx < at) {
    return 'done';
  }
  return idx === at ? 'current' : 'pending';
}
/** The panel-body RETUNE — the content breathes through a stop change
 *  while the frame stands still. The persistent context column rides the
 *  SAME tween (its identity changed with the stop), so the two zones read
 *  as one instrument re-tuning, never two blinks. GSAP owns the overlap
 *  semantics: a rapid re-step overwrites the running dip from its CURRENT
 *  pose. */
function retunePanel(): void {
  if (reducedMotion.value === true) {
    return;
  }
  const targets = [panelBody.value, ctxEl.value]
    .filter((el): el is HTMLElement => el !== undefined && el !== null) as Array<HTMLElement>;
  if (targets.length === 0) {
    return;
  }
  gsap.fromTo(targets,
    {opacity: 0.45, y: 5 * conUiScale()},
    {
      opacity: 1, y: 0,
      duration: motionMs(230) / 1000,
      ease: 'power2.out',
      overwrite: 'auto',
      onComplete: () => gsap.set(targets, {clearProps: 'opacity,transform'}),
    });
}
// ── the SCENE transition hooks (the workspace-descend phrase) ──────────
function sceneEnter(el: Element, done: () => void): void {
  hydroSceneEnterHook(el, done);
}
function sceneLeave(el: Element, done: () => void): void {
  hydroSceneLeaveHook(el, done);
}
function sceneCancelled(el: Element): void {
  hydroSceneCancelledHook(el);
}
// ── PREVIEW: track navigation + the smart primary ──────────────────────
function onStopClick(position: number): void {
  if (flow.commit !== undefined) {
    return;
  }
  closeHydroStep();
  // A pointer walk is the player's own move too — same contract as the
  // d-pad: their revision, their cursor.
  focusMoved.value = true;
  selectPosition(position);
}
/** One bumper press = one unit of the price moved between energy and
 *  Delta Works steel. The dial lives ONLY on the payment substep — on
 *  Configure the selector is not active and a hidden LB/RB would be a
 *  control the screen never advertised. Past the commit boundary the
 *  draft is frozen — the guard also kills a held repeat. */
function adjustMix(delta: number): void {
  if (flow.step !== 'payment' || !mixAdjustable.value || flow.commit !== undefined) {
    return;
  }
  if (mixActiveLane.value === 'floodgateSteel') {
    const now = model.value.floodgateSteelForSpend;
    const want = Math.max(0, Math.min(now + delta, model.value.maxFloodgateForSpend));
    if (want === now) {
      return;
    }
    floodgatePreference.value = want;
    mixFlashNonce.value += 1;
    return;
  }
  const next = clampEnergyMixSteel(mixSteel.value + delta,
    {minSteel: model.value.minSteelForSpend, maxSteel: model.value.maxSteelForSpend});
  if (next === mixSteel.value) {
    return;
  }
  steelPreference.value = next;
  // Re-keys the one-shot pulse on the steel row — the same acknowledgement
  // every other payment surface plays on a dial press.
  mixFlashNonce.value += 1;
}
/**
 * CONFIGURE → PAYMENT: the plan is complete (the same gate the direct
 * reinforce passes) and the server model admits at least two mixes — the
 * working area hands over to the composition step. Nothing is submitted,
 * nothing is spent; the focus seat is remembered for the walk back.
 */
function openPaymentStep(): void {
  paymentReturnFocus.value = railIdOf(sceneFocus.value) !== undefined ? sceneFocus.value : 'track';
  // The composition UNFOLDS from the gateway press (the same descend
  // phrase every other step enters with — a bare fade read as a swap).
  armSceneFromCta();
  openHydroStep('payment');
}
/** PAYMENT → CONFIGURE: B — draft, destination and pre-selects intact.
 *  The remembered rail seat is honoured only while that node is still in
 *  the focus graph (the decision may have gone unavailable meanwhile). */
function closePaymentStep(): void {
  closeHydroStep();
  const back = paymentReturnFocus.value;
  sceneFocus.value = railIdOf(back) !== undefined &&
    railFocusNodes(railDecisions.value).includes(back) ? back : 'track';
}
/** The FINAL act of the payment substep — the same server-authoritative
 *  reinforce the single-allocation path fires from Configure. */
function onPaymentConfirm(): void {
  if (!mixCovered.value) {
    emit('notice', translateText('Not enough energy and steel: add steel from Modular Floodgates'));
    return;
  }
  armSceneFromCta();
  emitConfirm();
}
function selectPosition(position: number): void {
  const last = model.value.stages.length - 1;
  const next = Math.min(last, Math.max(0, position));
  if (next === model.value.selectedPosition) {
    return;
  }
  // The player's own walk flips `pickDecisionKey` too — armed HERE, past
  // the no-op guard (armed at a call site, a clamped/no-op walk would
  // leave the latch set and swallow the NEXT real external revision).
  selfKeyChange.value = true;
  hydroNetworkState.selectedPosition = next;
  // The REWARD-ONLY PICK walks FOCUS between stages, never destinations:
  // the per-position drafts are position-scoped by construction, so a
  // walk keeps them (stepping back onto a configured stage restores its
  // answers) — only an incompatible shared repeat is filtered at resolve.
  if (props.rewardOffer !== undefined) {
    sceneFocus.value = 'track';
    return;
  }
  // NO SILENT DEFAULTS: a choice stage starts unconfigured — the player
  // sees both options and picks one deliberately, inside its own step.
  hydroNetworkState.rewardChoice = undefined;
  choiceStage.value = 'options';
  hydroNetworkState.selectedCard = undefined;
  // A different destination is a DIFFERENT move: the traversal drafts
  // describe stops that may no longer be crossed.
  hydroNetworkState.planChoices = {};
  hydroNetworkState.planPicks = {};
  consoleHydroUi.repeatResult = undefined;
  // THE CURSOR LANDS ON THE QUESTION. A stage that owes a target pick
  // (pos 7/9 with live candidates) seats it on the rail's first open
  // decision, so the default A OPENS THE PICKER: advancing without a
  // target then takes a deliberate walk plus the warned second press, and
  // can never be a stray A on a stage the player has only just stepped
  // onto. A TRAVERSAL owes its crossed CHOICES the same way — first open
  // decision, else the track. Stepping on with ←/→ re-takes the track
  // first (see `handleIntent`), so the walk itself is untouched — only
  // where the cursor RESTS changes.
  const railSeat = initialRailFocus(railDecisions.value);
  const railOwes = planPickMissing.value ||
    (traversalActive.value && advanceOffer.value === undefined && railSeat !== HYDRO_RAIL_CTA);
  sceneFocus.value = railOwes ? railSeat as HydroSceneFocus : 'track';
}
/** A — the smart primary: open the pending pre-select, else commit. */
function onPrimary(): void {
  if (model.value.mode !== 'plan') {
    selectPosition(model.value.currentPosition + Math.max(1, model.value.defaultSpend));
    return;
  }
  const blocking = reasons.value.filter((r) => r.blocking);
  if (blocking.length > 0) {
    emit('notice', reasonText(blocking[0]));
    return;
  }
  switch (primaryVerb.value) {
  case 'choose-reward':
    // A traversal routes to the FIRST unresolved choice decision — the
    // same seat the rail's own contract recommends.
    if (traversalActive.value && advanceOffer.value === undefined) {
      const open = railDecisions.value.find((d) => d.kind === 'reward-choice' && d.state === 'open');
      if (open !== undefined) {
        focusMoved.value = true;
        seatRailFocus(railNodeOf(open));
        openChoiceStep(open.stagePosition);
      }
      return;
    }
    openChoiceStep();
    return;
  case 'reinforce':
    // THE SAME GATE THE OFFER USES: the landed stage's pick is still
    // unchosen, so the FIRST press names that and the SECOND advances
    // anyway. A HEADS-UP, never a lock — advancing without stopping to
    // configure the reward is a legal move (see `hydroNetworkModel`).
    if (planPickMissing.value && !pickWarned.value) {
      pickWarned.value = true;
      return;
    }
    // CONFIGURE → PAYMENT, only while the server model admits at least
    // two valid mixes (`minSteelForSpend < maxSteelForSpend`). A single
    // valid allocation goes straight to Resolve — no extra step.
    if (mixAdjustable.value) {
      openPaymentStep();
      return;
    }
    emitConfirm();
    return;
  default:
    return;
  }
}
/**
 * A on a rail decision (or a click on its card) — open its OWN existing
 * selector: choose while it is open, change once it is resolved. ONE door
 * for both scenes; each routes into the machinery it already had (the
 * repeat browser bridge / the embedded target step) — nothing here is a
 * second implementation.
 */
function openRailDecision(): void {
  // A TRAVERSAL routes by the FOCUSED decision's own kind — several
  // decisions of one move each open their own existing selector.
  if (traversalActive.value && advanceOffer.value === undefined) {
    const d = railFocusedDecision.value;
    if (d === undefined || d.state === 'unavailable') {
      return;
    }
    if (d.kind === 'reward-choice') {
      openChoiceStep(d.stagePosition);
      return;
    }
    armSceneFromSummary();
    if (d.kind === 'reuse-action') {
      publishRepeatDisabled();
      emit('pick');
      return;
    }
    openTargetStep();
    return;
  }
  if (advanceOffer.value !== undefined) {
    openBonusPick();
    return;
  }
  onChangeSelection();
}
/** A CLICK on a decision card = point + press: seat the cursor on that
 *  node, then open its selector — the same two facts the pad expresses
 *  as ↑/↓ + A. Unavailable slots take no press (out of the graph). */
function focusAndOpenRail(d: HydroRailDecision): void {
  if (d.state === 'unavailable') {
    return;
  }
  focusMoved.value = true;
  seatRailFocus(railNodeOf(d));
  openRailDecision();
}
/** The plan scene's door (see `openRailDecision`). */
function onChangeSelection(): void {
  const m = model.value;
  if (m.mode !== 'plan') {
    return;
  }
  armSceneFromSummary();
  if (m.needsCardSelect === 'reuse-action') {
    publishRepeatDisabled();
    emit('pick');
    return;
  }
  if (m.needsCardSelect === 'animal-target') {
    openTargetStep();
  }
}
function armSceneFromSummary(): void {
  const root = rootEl.value ?? undefined;
  armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__summary--focused') ??
    root?.querySelector<HTMLElement>('.con-hydro__pickrow') ??
    root?.querySelector<HTMLElement>('.con-hydro__ctazone'));
}
function armSceneFromCta(): void {
  const root = rootEl.value ?? undefined;
  armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__ctazone') ??
    root?.querySelector<HTMLElement>('.con-hydro__panel'));
}
/**
 * X — inspect the granting card. Pre-commit the source IS the current
 * object, so this is X and there is no L3; the destination highlight on the
 * track above is untouched by the viewer opening over it.
 *
 * PHYSICAL origin, the shared `ConsoleEffectDecision` idiom: the fullscreen
 * card LIFTS OUT OF the dock's own rect and, on close, flies back into it —
 * and the zoom machinery holds that slot empty for the whole flight
 * (`con-zoom-hold`), so there is never a frame with two copies of one card
 * on screen. Without an origin the viewer used its «textual» rise-from-
 * depth entrance: a second, identical card materialising out of nowhere
 * while the first one sat in the source zone.
 */
/**
 * L3 ON THE ACTIVE STEP'S SOURCE — the same shared choreography as every
 * other `L3 Источник` in the console: the fullscreen card LIFTS OUT of the
 * seat's own rect and flies back into it on close, with the slot held empty
 * for the flight (never two copies of one card on screen), and the child
 * prompt underneath is not unmounted — selection, cost and focus survive
 * because nothing about it changed.
 *
 * Deliberately the SAME viewer, not a new fullscreen kind: the console has
 * one inspect grammar and the source is not a special case of it.
 */
/**
 * WHAT HAPPENED TO THIS PLAYER HERE, in their own terms.
 *
 * The MarsBot never takes a Delta reward (the reference card's rule), so a
 * crossing of its is «Пройден», never a human's «Прошёл мимо» — the second
 * would read as a miss the bot could have avoided.
 */
function rosterStatusKey(r: HydroStageHistoryEntry): string {
  if (r.status === 'current') {
    return 'Standing here';
  }
  if (r.status === 'rewarded') {
    return 'Took the reward';
  }
  if (r.status === 'crossed') {
    return 'Reward granted in passing';
  }
  return r.isMarsBot ? 'Advanced through' : 'Passed through — no reward';
}
/**
 * WHICH reward this player actually got here — the stage's own chips, and
 * for a two-option stage the option they CHOSE (`DeltaStop.choice`). A
 * crossing pays too, so it names its reward the same way. Undefined when
 * nothing was granted: «прошёл мимо» has no reward to name, and a stage
 * with no reward at all (the VP steps) has none to show.
 */
function rosterReward(r: HydroStageHistoryEntry): ReadonlyArray<HydroRewardChip> | undefined {
  if (r.status !== 'rewarded' && r.status !== 'crossed' && r.status !== 'current') {
    return undefined;
  }
  const options = HYDRO_STAGES[model.value.selectedPosition]?.rewardOptions ?? [];
  if (options.length === 0) {
    return undefined;
  }
  return options[options.length > 1 ? (r.choice ?? 0) : 0];
}
function inspectStepSource(): void {
  const name = embedSourceCard.value;
  if (name === undefined) {
    return;
  }
  openConsoleCardZoom([embedSourceModel.value ?? {name} as CardModel], 0, undefined, undefined, {
    statusLabel: 'Source',
    origin: slotZoomOrigin(
      () => rootEl.value ?? undefined,
      () => embedSourceCard.value ?? ''),
  });
}
function inspectBonusSource(): void {
  // The source of the STANDING surface: the advance offer's card, else the
  // pick bridge's (the reward pick and the espionage pick both dock their
  // source card in the ctx column — X must lift exactly that one; the old
  // offer-only read left X dead on both pick scenes).
  const source = advanceOffer.value?.source ?? props.rewardOffer?.source ??
    props.espionageOffer?.source ?? props.blockadeOffer?.source ?? props.blockadeExecution?.source;
  if (source === undefined) {
    return;
  }
  openConsoleCardZoom([{name: source} as CardModel], 0, undefined, undefined, {
    statusLabel: 'Source',
    // The SHARED slot origin — the same one the hand, the reveal and the
    // action browser pass. It resolves the WRAPPER, which is what lets the
    // zoom machinery empty the whole slot (`:has(.con-zoom-hold)`) rather
    // than only zeroing the face and leaving its focus ring behind.
    origin: slotZoomOrigin(
      () => rootEl.value ?? undefined,
      () => source),
  });
}
/**
 * THE CURSOR WALKS THE LAYOUT IT SEES. The two answers are a horizontal
 * pair under the statement, with the source card in the column beside
 * them, so ←/→ step between the answers and reach the source, and ↑/↓ keep
 * working for a player whose thumb is already on that axis. An EDGE HOLDS
 * — never a wrap: a decision's cursor that loops turns «Пропустить» into
 * whatever is one press past «Продвинуться».
 */
function navBonus(dir: 'up' | 'down' | 'left' | 'right'): void {
  // A deliberate move: this decision revision may not re-seat the cursor.
  focusMoved.value = true;
  // The zone's focusables, top-to-bottom, exactly as they are laid out:
  // the source card, then the DECISION RAIL's own order (its CTA stop is
  // this scene's confirm plate). An edge HOLDS — never a wrap: a
  // decision's cursor that loops turns «Пропустить» into whatever is one
  // press past «Продвинуться».
  const column: Array<typeof sceneFocus.value> = [];
  if (ctxSourceView.value !== undefined) {
    column.push('bonus-source');
  }
  for (const node of railFocusNodes(railDecisions.value)) {
    column.push(node === HYDRO_RAIL_CTA ? 'bonus-confirm' : node as HydroSceneFocus);
  }
  // A card ENTRY has no refusal, so «one press past the confirm» must be
  // the confirm itself — a ring that can land on an unrendered button is a
  // dead cursor stop, which is the same defect as a wrapping one.
  const skip = bonusSkipOffered.value;
  const at = Math.max(0, column.indexOf(sceneFocus.value === 'bonus-skip' ? 'bonus-confirm' : sceneFocus.value));
  switch (dir) {
  case 'left':
    // The two ANSWERS sit side by side; everything above them is a column.
    sceneFocus.value = sceneFocus.value === 'bonus-skip' ? 'bonus-confirm' : column[Math.max(0, at - 1)];
    return;
  case 'right':
    sceneFocus.value = skip && sceneFocus.value === 'bonus-confirm' ? 'bonus-skip' :
      sceneFocus.value === 'bonus-skip' ? 'bonus-skip' : column[Math.min(column.length - 1, at + 1)];
    return;
  case 'up':
    sceneFocus.value = sceneFocus.value === 'bonus-skip' ? 'bonus-confirm' : column[Math.max(0, at - 1)];
    return;
  case 'down':
    sceneFocus.value = skip && sceneFocus.value === 'bonus-confirm' ? 'bonus-skip' :
      sceneFocus.value === 'bonus-skip' ? 'bonus-skip' : column[Math.min(column.length - 1, at + 1)];
    return;
  }
}
/**
 * ANSWER the offer. The index comes from the SERVER's marker — never from
 * the option order this component happens to see — and the in-flight latch
 * makes a second press impossible by state rather than by a guard.
 */
/**
 * OPEN THE LANDED STAGE'S PRE-SELECT — the very same step the player's own
 * advance opens for the same stage. `emit('pick')` is the shell's repeat
 * browser bridge; `openTargetStep` is the embedded target step. Neither is
 * re-implemented here, and neither knows it was reached from an offer.
 */
function openBonusPick(): void {
  if (!bonusNeedsCard.value) {
    return;
  }
  pickWarned.value = false;
  if (model.value.needsCardSelect === 'reuse-action') {
    publishRepeatDisabled();
    emit('pick');
    return;
  }
  openTargetStep();
}
function answerBonus(take: boolean): void {
  const offer = advanceOffer.value;
  if (offer === undefined || bonusSubmitting.value) {
    return;
  }
  // A card ENTRY has no refusal — B is its way out — so a `false` here can
  // only be a stray press on a button that is not rendered.
  if (!take && !bonusSkipOffered.value) {
    return;
  }
  // THE PICK IS STILL UNCHOSEN — say so ONCE, then take the second press
  // at face value. ⚠️ The cursor STAYS on the confirm: moving it to the
  // row made the second press open the picker instead, so the player
  // could never advance at all. A warning is a heads-up, not a lock.
  if (take && bonusPickMissing.value && !pickWarned.value) {
    pickWarned.value = true;
    return;
  }
  if (take && bonusNeedsReward.value) {
    // The landing stage asks WHICH reward. That question belongs to this
    // workspace's own reward step — never to a second modal on top of it —
    // and both halves then submit as ONE batch, exactly like the standard
    // advance does. Seat the plan on the destination so the step describes
    // the stage the move actually lands on.
    hydroNetworkState.selectedPosition = offer.toPosition;
    openChoiceStep();
    return;
  }
  if (offerOrigin.value === 'card-entry') {
    submitCardAdvance(undefined);
    return;
  }
  const meta = props.bonusOffer as DeltaBonusPromptMeta;
  submitBonus(take, take ? meta.advanceIndex : meta.skipIndex, undefined);
}
/**
 * THE ONE SUBMIT of a bonus answer (with the pre-collected reward, when the
 * landing stage had one). A second press cannot exist past this.
 *
 * TAKING carries the SAME payload the player's own «Укрепить гидросеть»
 * emits — route, spend, the reward transfers, the frozen result lines, the
 * landed stage's name. That is not duplication for its own sake: it is what
 * lets the shell open ONE presentation for both, so a bonus move glides,
 * pays out and holds its result exactly like a paid one. The only field
 * that differs is the price.
 *
 * SKIPPING carries nothing: there is no move to present.
 */
function submitBonus(take: boolean, index: number, rewardChoice: number | undefined): void {
  const offer = props.bonusOffer;
  if (offer === undefined || bonusSubmitting.value) {
    return;
  }
  bonusSubmitting.value = true;
  armSceneFromCta();
  if (!take) {
    emit('bonus-answer', {take: false, index, rewardChoice: undefined});
    return;
  }
  const view = bonusRewardView.value;
  // The landed stage's own answers ride the SAME batch the standard
  // advance sends (`hydroAdvanceTail`) — pre-collected here, never asked
  // again after the commit.
  const repeat = model.value.needsCardSelect === 'reuse-action' ? chosenRepeat.value : undefined;
  emit('bonus-answer', {
    take: true,
    index,
    rewardChoice,
    selectedCard: model.value.mustSelectCard ? model.value.selectedCard : undefined,
    repeat,
    fromPosition: offer.fromPosition,
    toPosition: offer.toPosition,
    // The server's own verdict on the price (0 for a plain bonus step, 1
    // for the tag waiver) — never the standard action's per-step cost.
    spend: offer.energyCost,
    rewards: hydroRewardTransfers(view),
    resultLines: view.lines,
    vp: view.vp,
    // The move's PASSIVE half, frozen with the rest of the result: the
    // rows the plan promised are the rows the result states, and their
    // wave rides the marker's own arrival.
    movementBonuses: movementBonuses.value,
    stageNameKey: HYDRO_STAGES[offer.toPosition]?.nameKey ?? '',
    // The GRANTING CARD — the context column keeps showing it through the
    // commit and the result, so the origin never blinks away mid-flow.
    sourceCard: offer.source,
    // The pos-9 presented target freezes its pre-commit count here, exactly
    // as `emitConfirm` does for the player's own advance.
    targetBefore: selectedAnimalCurrent.value,
  });
}
/**
 * THE ONE SUBMIT OF A CARD-ENTRY MOVE — the same payload `submitBonus`
 * sends, minus the option index there is none of.
 *
 * Everything past this point is IDENTICAL to a bonus move and to the
 * player's own advance: the marker glides, the landed stage pays out
 * through the reward wave, the counters tick on touchdown and the result
 * stage holds. The only thing this method owns is the moment: BEFORE it,
 * nothing has been spent, the card is not used and B is a clean way back;
 * after it, the shell assembles the card's whole batch and the server
 * commits card-used + energy + movement in one response.
 */
function submitCardAdvance(rewardChoice: number | undefined): void {
  const offer = props.cardOffer;
  if (offer === undefined || bonusSubmitting.value || flow.commit !== undefined) {
    return;
  }
  // ⚠️ A STALE OFFER MAY NOT MOVE THE MARKER. The offer is the SERVER's
  // verdict, taken when the door opened; the track model is LIVE. Once the
  // marker has moved under it, every term of the offer — the route, the
  // landing stage, its reward — describes a move that no longer exists,
  // while the server resolves the real one from its own state: exactly the
  // reported «анимация 5→6 поверх настоящего хода 7→8, и награда не та».
  // The CAUSE is fixed upstream (the preview cache now keys on the track
  // position, so the door never opens on a spent offer); this is the net
  // that keeps a future race HONEST instead of animated. Asked BEFORE the
  // in-flight latch, so both CTAs stay live and B still walks back to the
  // card — whose preview is refreshed by then.
  if (offer.fromPosition !== model.value.currentPosition) {
    emit('notice', translateText('The track position has changed — reopen the action'));
    return;
  }
  bonusSubmitting.value = true;
  armSceneFromCta();
  const view = bonusRewardView.value;
  const repeat = model.value.needsCardSelect === 'reuse-action' ? chosenRepeat.value : undefined;
  emit('card-advance', {
    rewardChoice,
    selectedCard: model.value.mustSelectCard ? model.value.selectedCard : undefined,
    // Same contract as the player's own advance: the warned confirm with
    // no pick FORFEITS the reward rather than postponing it.
    waiveTarget: waiveTargetNow.value ? true : undefined,
    repeat,
    steps: offer.steps,
    fromPosition: offer.fromPosition,
    toPosition: offer.toPosition,
    // The SERVER's own verdict on the price — never the standard action's
    // per-step cost, which this move does not pay.
    spend: offer.energyCost,
    rewards: hydroRewardTransfers(view),
    resultLines: view.lines,
    vp: view.vp,
    // The move's PASSIVE half, frozen with the rest of the result: the
    // rows the plan promised are the rows the result states, and their
    // wave rides the marker's own arrival.
    movementBonuses: movementBonuses.value,
    stageNameKey: HYDRO_STAGES[offer.toPosition]?.nameKey ?? '',
    sourceCard: offer.source,
    targetBefore: selectedAnimalCurrent.value,
  });
}
function emitConfirm(): void {
  if (!model.value.canConfirm || !mixCovered.value || flow.commit !== undefined) {
    return;
  }
  armSceneFromCta();
  // A MULTI-REWARD TRAVERSAL commits its whole ordered plan: per-stage
  // answers for the batch, per-stage segments for the presentation, the
  // combined threaded lines for the result — one build, one truth.
  if (traversalActive.value) {
    const t = buildTraversalCommit();
    emit('confirm', {
      spend: model.value.selectedSpend,
      steelSpend: mixSteel.value > 0 ? mixSteel.value : undefined,
      cardSteelSpend: model.value.floodgateSteelForSpend > 0 ? model.value.floodgateSteelForSpend : undefined,
      rewardChoice: undefined,
      selectedCard: undefined,
      waiveTarget: undefined,
      repeat: undefined,
      traversalAnswers: t.answers,
      waivedSteps: t.waived.length > 0 ? t.waived : undefined,
      plannedActions: plannedActionsForCommit.value.length > 0 ? plannedActionsForCommit.value : undefined,
      plannedChoices: plannedChoicesForCommit.value.length > 0 ? plannedChoicesForCommit.value : undefined,
      traversal: t.segments,
      modifierCard: model.value.traversalModifierCard,
      fromPosition: model.value.currentPosition,
      toPosition: model.value.selectedPosition,
      // The legs carry their own waves — the single-stop field stays empty.
      rewards: [],
      resultLines: t.lines,
      vp: t.vp,
      movementBonuses: movementBonuses.value,
      stageNameKey: model.value.targetStage?.nameKey ?? '',
      kind: t.destinationKind,
      skippedCount: 0,
      targetBefore: selectedAnimalCurrent.value,
    });
    return;
  }
  const repeat = model.value.needsCardSelect === 'reuse-action' ? chosenRepeat.value : undefined;
  emit('confirm', {
    spend: model.value.selectedSpend,
    // The chosen Delta Works mix — the ONE linked steel value (energy is
    // the remainder). Omitted at 0 so the batch stays byte-identical.
    steelSpend: mixSteel.value > 0 ? mixSteel.value : undefined,
    // The Floodgates' share — the player's own dial, never auto-mixed.
    cardSteelSpend: model.value.floodgateSteelForSpend > 0 ? model.value.floodgateSteelForSpend : undefined,
    rewardChoice: model.value.targetNeedsChoice ? hydroNetworkState.rewardChoice : undefined,
    selectedCard: model.value.mustSelectCard ? model.value.selectedCard : undefined,
    // The warned confirm with no pick is a CONSCIOUS decline — the server
    // defers no follow-up ask for it (see `waiveTargetNow`).
    waiveTarget: waiveTargetNow.value ? true : undefined,
    repeat,
    // The declared plan — the server's atomic pre-commit gate re-walks
    // the ordered projection against it (nothing spent on refusal).
    plannedActions: plannedActionsForCommit.value.length > 0 ? plannedActionsForCommit.value : undefined,
    fromPosition: model.value.currentPosition,
    toPosition: model.value.selectedPosition,
    rewards: hydroRewardTransfers(rewardView.value),
    // The result stage's frozen truth (the live model moves on with the
    // commit and would describe the NEXT advance).
    resultLines: rewardView.value.lines,
    vp: rewardView.value.vp,
    movementBonuses: movementBonuses.value,
    stageNameKey: model.value.targetStage?.nameKey ?? '',
    kind: resolutionKindFor(model.value.selectedPosition, {
      composedRepeat: repeat !== undefined,
      selectedCard: model.value.mustSelectCard ? model.value.selectedCard : undefined,
    }),
    // The standing track rule, counted at the decision: the result stage
    // names how many intermediate rewards this jump passed over.
    skippedCount: model.value.skippedStages.length,
    targetBefore: selectedAnimalCurrent.value,
  });
}
/**
 * THE TRAVERSAL COMMIT BUILD — the plan's per-stage truth, assembled once
 * at the confirm: the batch answers (path order — the server's own defer
 * order), the conscious declines, the presentation segments (every
 * crossed cell, the excluded 2 VP included) and the frozen result lines.
 */
function buildTraversalCommit(): {
  answers: Array<{position: number, rewardChoice?: number, selectedCard?: CardName, repeat?: ConsoleRepeatPickResult}>,
  waived: Array<number>,
  segments: Array<HydroTraversalSegmentRecord>,
  lines: ReadonlyArray<HydroDeltaLine>,
  vp: number | undefined,
  destinationKind: ReturnType<typeof resolutionKindFor>,
  } {
  const views = traversalViews.value;
  const waived = traversalWaivedSteps.value;
  const repeat = chosenRepeat.value;
  const answers: Array<{position: number, rewardChoice?: number, selectedCard?: CardName, repeat?: ConsoleRepeatPickResult}> = [];
  const segments: Array<HydroTraversalSegmentRecord> = [];
  let destinationKind: ReturnType<typeof resolutionKindFor> = 'plain';
  for (const step of model.value.traversal ?? []) {
    const stage = HYDRO_STAGES[step.position];
    if (!step.rewarded) {
      segments.push({
        position: step.position,
        kind: 'excluded',
        stageNameKey: stage?.nameKey ?? '',
        transfers: [],
        rewardLines: [],
      });
      continue;
    }
    const plan = model.value.traversalStages.find((s) => s.position === step.position);
    const view = views.perStage[step.position];
    const transfers = view !== undefined ? hydroRewardTransfers(view) : [];
    const isDest = step.position === model.value.selectedPosition;
    let kind: HydroTraversalSegmentRecord['kind'] = 'plain';
    if (plan?.ask === 'draw') {
      kind = 'deck-draw';
    } else if (plan?.ask === 'reuse-action' && plan.pick !== undefined) {
      kind = 'repeat';
      answers.push({position: step.position, selectedCard: plan.pick,
        repeat: repeat?.chosenCard === plan.pick ? repeat : undefined});
    } else if (plan?.ask === 'animal-target' && plan.pick !== undefined) {
      kind = 'card-resource';
      answers.push({position: step.position, selectedCard: plan.pick});
    } else if (plan?.ask === 'choice' && plan.choice !== undefined) {
      answers.push({position: step.position, rewardChoice: plan.choice});
    } else if (stage?.vp !== undefined) {
      kind = 'ceremony';
    }
    segments.push({
      position: step.position,
      kind,
      stageNameKey: stage?.nameKey ?? '',
      transfers,
      rewardLines: view?.lines ?? [],
      rewardChoice: plan?.ask === 'choice' ? plan.choice : undefined,
      selectedCard: plan?.pick,
      composedRepeat: plan?.ask === 'reuse-action' && repeat !== undefined && repeat.chosenCard === plan.pick,
      waived: waived.includes(step.position) ? true : undefined,
      targetBefore: plan?.ask === 'animal-target' && plan.pick !== undefined ?
        animalCurrentOf(plan.pick) : undefined,
    });
    if (isDest) {
      destinationKind = resolutionKindFor(step.position, {
        composedRepeat: plan?.ask === 'reuse-action' && repeat !== undefined,
        selectedCard: plan?.pick,
      });
    }
  }
  return {answers, waived, segments, lines: views.combined.lines, vp: views.combined.vp, destinationKind};
}
// ── the REWARD CHOICE step (pos 1/2) — pick AND confirm, in place ─────
/** A TRAVERSAL decision opens the step scoped to its own stop (`position`)
 *  — the pick then RETURNS to the rail (which owns the commit). The
 *  single-landing step keeps its historical self-confirming shape. */
function openChoiceStep(position?: number): void {
  if (flow.step === 'reward') {
    return;
  }
  choicePosition.value = position;
  if (choiceStageModel.value === undefined) {
    choicePosition.value = undefined;
    return;
  }
  armSceneFromCta();
  if (position !== undefined) {
    // The step re-asks, but the STANDING draft is the rail's own card —
    // visible, revisitable, version-guarded (hydroDraftFresh).
    choiceFocus.value = hydroNetworkState.planChoices[position] ?? 0;
    choiceStage.value = 'options';
    choiceSkipFocus.value = false;
    openHydroStep('reward');
    return;
  }
  // The choice is SCOPED TO THE STEP: entering always asks again, so a
  // reward can never be silently carried in from an earlier visit (and
  // «no auto-select» holds by construction — nothing is chosen yet).
  hydroNetworkState.rewardChoice = undefined;
  choiceFocus.value = 0;
  choiceStage.value = 'options';
  choiceSkipFocus.value = false;
  openHydroStep('reward');
}
/** A on an option — hold it and arm the commit right underneath. A
 *  traversal decision instead WRITES ITS DRAFT and returns to the rail
 *  (the answer moves the cursor on — `nextRailFocus`). */
function pickChoice(index: number): void {
  if (choicePosition.value !== undefined) {
    const position = choicePosition.value;
    hydroNetworkState.planChoices = {...hydroNetworkState.planChoices, [position]: index};
    choicePosition.value = undefined;
    closeHydroStep();
    const answered = railDecisions.value.find((d) => d.kind === 'reward-choice' && d.stagePosition === position);
    seatRailFocus(answered !== undefined ?
      nextRailFocus(railDecisions.value, answered.id) : initialRailFocus(railDecisions.value));
    return;
  }
  hydroNetworkState.rewardChoice = index;
  choiceFocus.value = index;
  choiceStage.value = 'confirm';
  choiceSkipFocus.value = false;
}
/** A on the step's own CTA — the advance commits from HERE. */
function confirmChoiceStep(): void {
  if (rewardChoice.value === undefined) {
    return;
  }
  // Answering a CARD'S move: the step is that move's second half, so it
  // commits THAT — never the player's own planned advance. Both
  // provenances land here; only the submit differs.
  if (advanceOffer.value !== undefined) {
    // The reward view must be read BEFORE the step closes — `sceneKey`
    // swaps on the same tick and the offer's landing stage is what the
    // transfers are measured from.
    const choice = rewardChoice.value;
    if (offerOrigin.value === 'card-entry') {
      submitCardAdvance(choice);
    } else {
      submitBonus(true, (props.bonusOffer as DeltaBonusPromptMeta).advanceIndex, choice);
    }
    closeHydroStep();
    return;
  }
  const blocking = reasons.value.filter((r) => r.blocking);
  if (blocking.length > 0) {
    emit('notice', reasonText(blocking[0]));
    return;
  }
  // CONFIGURE → PAYMENT, the same gateway the plan's own confirm takes:
  // the chosen reward is captured (it survives in hydroNetworkState), and
  // the composition step is the LAST stop before Resolve.
  if (mixAdjustable.value) {
    openPaymentStep();
    return;
  }
  emitConfirm();
}
/** B — leave the step with NOTHING configured behind it. (Under an offer
 *  that lands the player back on the offer itself, undecided. A traversal
 *  decision keeps its STANDING draft — B is «не менять», not «сбросить».) */
function closeChoiceStep(): void {
  if (choicePosition.value !== undefined) {
    const position = choicePosition.value;
    choicePosition.value = undefined;
    closeHydroStep();
    const own = railDecisions.value.find((d) => d.kind === 'reward-choice' && d.stagePosition === position);
    seatRailFocus(own !== undefined ? railNodeOf(own) : initialRailFocus(railDecisions.value));
    return;
  }
  hydroNetworkState.rewardChoice = undefined;
  choiceStage.value = 'options';
  choiceSkipFocus.value = false;
  closeHydroStep();
  sceneFocus.value = 'track';
}
// ── the TARGET step (pos 9) ────────────────────────────────────────────
function openTargetStep(): void {
  const owners = targetStepModel.value?.owners ?? [];
  if (owners.length === 0) {
    return;
  }
  if (railIdOf(sceneFocus.value) === undefined) {
    armSceneFromCta();
  }
  targetFocus.value = findPlayedTargetFocus(targetLockedCard.value, owners) ??
    reseatPlayedTargetFocus(undefined, owners);
  if (targetFocus.value === undefined) {
    return;
  }
  openHydroStep('target');
  void nextTick(() => seatTargetStep());
}
function seatTargetStep(): void {
  measureTargetZone();
  const owners = targetStepModel.value?.owners ?? [];
  if (targetFocus.value === undefined && owners.length > 0) {
    targetFocus.value = reseatPlayedTargetFocus(undefined, owners);
  }
}
function measureTargetZone(): void {
  const zone = targetZone.value ?? undefined;
  if (zone === undefined || zone === null) {
    return;
  }
  const cs = getComputedStyle(zone);
  targetZoneW.value = Math.max(0, zone.clientWidth -
    (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
  targetZoneH.value = Math.max(0, zone.clientHeight -
    (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
}
function targetNav(dir: 'up' | 'down' | 'left' | 'right'): void {
  const owners = targetStepModel.value?.owners ?? [];
  const focus = targetFocus.value;
  if (focus === undefined || owners.length === 0) {
    return;
  }
  const step = targetStep.value ?? undefined;
  const cells = step?.cells?.() ?? [];
  const next = cells.length > 0 ?
    stepPlayedTargetFocusVia(step, focus, dir as PlayedTargetNavDir, cells) :
    stepPlayedTargetFocus(focus, dir as PlayedTargetNavDir, owners, targetLayout.value);
  if (next === undefined) {
    return; // an edge HOLDS — never a wrap, never a silent owner change
  }
  targetFocus.value = next;
  targetStep.value?.ensureFocusVisible?.();
}
function cycleTargetOwner(delta: number): void {
  const owners = targetStepModel.value?.owners ?? [];
  const focus = targetFocus.value;
  // A PAGED band: LB/RB turn its page where they walk nothing else.
  const turned = turnPlayedTargetPageVia(targetStep.value, focus, delta);
  if (turned !== undefined) {
    targetFocus.value = turned;
    targetStep.value?.ensureFocusVisible?.();
    return;
  }
  if (focus === undefined || targetLayout.value.mode !== 'tabs' || owners.length < 2) {
    return;
  }
  const ownerId = stepPlayedTargetOwner(focus.ownerId, delta, owners);
  if (ownerId !== focus.ownerId) {
    targetFocus.value = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focus;
  }
}
function targetConfirm(): void {
  const owners = targetStepModel.value?.owners ?? [];
  const candidate = playedTargetAt(targetFocus.value, owners);
  if (candidate === undefined) {
    return;
  }
  // The reward-only pick writes the FOCUSED stage's per-position draft
  // (the traversal's own dictionary) and returns to the pick's CTA.
  if (props.rewardOffer !== undefined) {
    hydroNetworkState.planPicks = {
      ...hydroNetworkState.planPicks,
      [model.value.selectedPosition]: candidate.cardName as CardName,
    };
    closeHydroStep();
    sceneFocus.value = 'cta';
    return;
  }
  // A traversal writes ITS stage's draft and hands the cursor on; the
  // single landing keeps the shared-field write (whose own watcher does
  // the same hand-off).
  if (traversalActive.value && advanceOffer.value === undefined) {
    const stage = traversalAnimalStage.value;
    if (stage !== undefined) {
      applyTraversalPick(stage.position, candidate.cardName as CardName);
    }
    closeHydroStep();
    return;
  }
  hydroNetworkState.selectedCard = candidate.cardName;
  closeHydroStep();
  sceneFocus.value = 'track';
}
/** The plan's greyed browser rows, refreshed at every pick emit: the
 *  candidates NO payment composition of this move can feed, each with
 *  the honest pre-translated reason (one wording — the rail's own). */
function publishRepeatDisabled(): void {
  consoleHydroUi.repeatDisabled = model.value.reuseInfeasibleCards.map((c) => ({
    name: c.name,
    reason: translateText(planConflictReasonKey(c.resource)),
  }));
}
/** The CLAIM's greyed browser rows (Dutch Mountains → stage 7): the
 *  claim's own price leaves first, so a repeat it starves is greyed with
 *  the reason — never a pick the commit then silently drops. Published
 *  on every open, so a previous plan's rows can never leak in. */
function publishClaimRepeatDisabled(): void {
  const offer = props.rewardOffer;
  const previewNow = preview.value;
  const p = props.playerView.thisPlayer;
  consoleHydroUi.repeatDisabled = offer === undefined || previewNow === undefined ? [] :
    claimRepeatInfeasible({
      start: {megacredits: p.megacredits, steel: p.steel, titanium: p.titanium, plants: p.plants, energy: p.energy, heat: p.heat},
      toll: claimTollOf(actionPreviewMap().get(offer.source)),
      position: model.value.selectedPosition,
      candidates: previewNow.reuseActionCards,
      costs: previewNow.reuseActionCosts,
      frontiers: previewNow.reuseActionFrontiers,
    }).map((c) => ({name: c.name, reason: translateText(claimConflictReasonKey(c.resource))}));
}
/** ONE write path for a traversal pick (the target step and the repeat
 *  bridge both land here): the per-position draft + the rail hand-off. */
function applyTraversalPick(position: number, card: CardName): void {
  hydroNetworkState.planPicks = {...hydroNetworkState.planPicks, [position]: card};
  const answered = railDecisions.value.find((d) => d.stagePosition === position && d.kind !== 'reward-choice');
  if (answered !== undefined && railIdOf(sceneFocus.value) !== undefined) {
    seatRailFocus(nextRailFocus(railDecisions.value, answered.id));
  }
}
/** The live animal count of a tableau card (the honest «сейчас → станет»). */
function animalCurrentOf(card: CardName): number {
  return props.playerView.thisPlayer.tableau.find((c) => c.name === card)?.resources ?? 0;
}
function targetInspect(): void {
  const owners = targetStepModel.value?.owners ?? [];
  const candidate = playedTargetAt(targetFocus.value, owners);
  if (candidate === undefined) {
    return;
  }
  // THE ONE DOOR — with the TARGET DOSSIER.
  if (targetStepModel.value !== undefined) {
    openPlayedTargetZoom({model: targetStepModel.value, cardName: candidate.cardName, getRoot: () => rootEl.value ?? undefined});
  }
}
// ── the REWARD-ONLY PICK (Dutch Mountains) ────────────────────────────
/**
 * A on the pick's surface: an unanswered ASK opens its own existing
 * selector (the scoped reward-choice step / the embedded target grid /
 * the repeat browser bridge — nothing here is a second implementation);
 * a complete pick RESOLVES the bridge and returns to the composer.
 */
function onRewardPickPrimary(): void {
  const ask = rewardFocusAsk.value;
  if (!rewardFocusClaimable.value) {
    emit('notice', translateText(rewardFocusBlockKey.value));
    return;
  }
  if (ask !== undefined && !ask.answered) {
    openRewardAsk(ask.kind);
    return;
  }
  resolveRewardPick();
}
/** Route ONE ask into the machinery the workspace already owns. */
function openRewardAsk(kind: 'choice' | 'target' | 'repeat'): void {
  switch (kind) {
  case 'choice':
    openChoiceStep(model.value.selectedPosition);
    return;
  case 'target':
    openTargetStep();
    return;
  default:
    // The stage-7 repeat browser — the shell's bridge writes
    // `hydroNetworkState.selectedCard` + `consoleHydroUi.repeatResult`.
    publishClaimRepeatDisabled();
    emit('pick');
    return;
  }
}
/** The draft, assembled from the per-position machinery and RETURNED —
 *  nothing submits, nothing is spent, the marker never moved. */
function resolveRewardPick(): void {
  if (!rewardPickReady.value) {
    return;
  }
  const pos = model.value.selectedPosition;
  const repeat = consoleHydroUi.repeatResult;
  const repeatCard = rewardFocusAsk.value?.kind === 'repeat' ? hydroNetworkState.selectedCard : undefined;
  const draft: DeltaRewardDraft = {
    position: pos,
    rewardChoice: hydroNetworkState.planChoices[pos],
    selectedCard: rewardFocusAsk.value?.kind === 'target' ? hydroNetworkState.planPicks[pos] : repeatCard,
    repeat: repeatCard !== undefined && repeat?.chosenCard === repeatCard ? repeat : undefined,
  };
  emit('reward-picked', draft);
}
/** Seat the pick on ITS OWN stage: the remembered draft's stage on a
 *  re-open, else the FARTHEST claimable one (the current stage when it is
 *  claimable; the nearest earlier claimable when the marker stands on an
 *  excluded cell). Prior nested answers re-seed the per-position drafts. */
function seatRewardPick(): void {
  const offer = props.rewardOffer;
  if (offer === undefined) {
    return;
  }
  const prior = offer.prior;
  const claimable = offer.claimable;
  const seat = prior !== undefined && claimable.includes(prior.position) ?
    prior.position :
    (claimable.length > 0 ? claimable[claimable.length - 1] : model.value.currentPosition);
  hydroNetworkState.selectedPosition = seat;
  if (prior !== undefined && claimable.includes(prior.position)) {
    if (prior.rewardChoice !== undefined) {
      hydroNetworkState.planChoices = {...hydroNetworkState.planChoices, [prior.position]: prior.rewardChoice};
    }
    if (prior.selectedCard !== undefined) {
      const stage = HYDRO_STAGES[prior.position];
      if (stage?.followUp === 'add-animals') {
        hydroNetworkState.planPicks = {...hydroNetworkState.planPicks, [prior.position]: prior.selectedCard};
      } else {
        hydroNetworkState.selectedCard = prior.selectedCard;
        // A re-open keeps the WHOLE standing repeat composition, not just
        // the card — else resolving without recomposing degrades the
        // draft to the bare answer and the nested inputs are lost.
        if (prior.repeat !== undefined && prior.repeat.chosenCard === prior.selectedCard) {
          consoleHydroUi.repeatResult = prior.repeat;
        }
      }
    }
  }
  sceneFocus.value = 'track';
}
// ── the ESPIONAGE TARGET PICK (Corporate Espionage) ────────────────────
/** The ghost tokens ONE cell shows: the owner's forward destination
 *  (constant) and the FOCUSED candidate's backward destination (follows
 *  the cursor). Direction is named by the arrow, never colour alone. */
function espionageGhostsAt(position: number): Array<{color: Color, dir: 'fwd' | 'back'}> {
  const offer = props.espionageOffer;
  if (offer === undefined) {
    // The ADVANCE-LANDING reward pick keeps the same projection language:
    // the viewer's forward ghost stands on the destination cell, so the
    // move the reward belongs to stays physical through this stage too.
    if (rewardAdvanceFrom.value !== undefined && viewerColor.value !== undefined &&
        rewardClaimableSet.value.has(position)) {
      return [{color: viewerColor.value, dir: 'fwd'}];
    }
    return [];
  }
  const out: Array<{color: Color, dir: 'fwd' | 'back'}> = [];
  const owner = offer.projection.owner;
  if (owner.legal && owner.toPosition === position) {
    out.push({color: owner.color, dir: 'fwd'});
  }
  const row = espionageFocusRow.value;
  if (row !== undefined && row.target.legal && row.target.toPosition === position) {
    out.push({color: row.target.color, dir: 'back'});
  }
  return out;
}
/** A mouse press on a row: focus it; a second press confirms (the same
 *  two-beat contract the d-pad walk + A gives). */
function onEspionageRowClick(index: number): void {
  if (espionageFocusIdx.value !== index) {
    espionageFocusIdx.value = index;
    return;
  }
  confirmEspionageRow(index);
}
/** A on a candidate: a LEGAL row returns the pick to the composer; a
 *  blocked row refuses OUT LOUD with its own reason. */
function confirmEspionageRow(index: number): void {
  const row = espionageRows.value[index];
  if (row === undefined) {
    return;
  }
  if (!row.target.legal) {
    emit('notice', $t(row.blockKey !== '' ? row.blockKey : 'That player cannot be pushed back'));
    return;
  }
  emit('espionage-picked', {target: row.target.color});
}
// ── the BLOCKADE TARGET PICK (Modular Floodgates) ─────────────────────
/** The gates ONE rail cell shows: every ACTIVE blockade whose blocked
 *  player currently stands one cell before it, plus the pick's GHOST on
 *  the focused candidate's gate cell. A ghost never doubles an active
 *  gate (the projection already refuses an already-blocked target). */
function blockadeGatesAt(position: number): Array<BlockadeGate> {
  const out: Array<BlockadeGate> = [];
  for (const gate of activeBlockadeGates.value) {
    if (gate.position === position) {
      out.push({target: gate.target, state: 'active'});
    }
  }
  const row = blockadeFocusRow.value;
  if (props.blockadeOffer !== undefined && row !== undefined &&
      row.target.legal && row.target.blockadePosition === position) {
    out.push({target: row.target.color, state: 'ghost'});
  }
  return out;
}
/** A mouse press on a row: focus it; a second press confirms (the same
 *  two-beat contract the d-pad walk + A gives). */
function onBlockadeRowClick(index: number): void {
  if (blockadeFocusIdx.value !== index) {
    blockadeFocusIdx.value = index;
    return;
  }
  confirmBlockadeRow(index);
}
/** A on a candidate: a LEGAL row returns the pick to the composer; a
 *  blocked row refuses OUT LOUD with its own reason. */
function confirmBlockadeRow(index: number): void {
  const row = blockadeRows.value[index];
  if (row === undefined) {
    return;
  }
  if (!row.target.legal) {
    emit('notice', $t(row.blockKey !== '' ? row.blockKey : 'That player cannot be blocked'));
    return;
  }
  emit('blockade-picked', {target: row.target.color});
}
/** Seat the cursor: the SAVED target on a re-open, else the first LEGAL
 *  candidate (the mandatory pick is the first thing the cursor offers). */
function seatBlockadePick(): void {
  const offer = props.blockadeOffer;
  if (offer === undefined) {
    return;
  }
  const rows = blockadeRows.value;
  const priorIdx = offer.prior !== undefined ?
    rows.findIndex((r) => r.target.color === offer.prior) : -1;
  const firstLegal = rows.findIndex((r) => r.target.legal);
  blockadeFocusIdx.value = priorIdx >= 0 ? priorIdx : Math.max(0, firstLegal);
  sceneFocus.value = 'track';
}
/** Seat the cursor: the SAVED target on a re-open, else the first LEGAL
 *  candidate (the mandatory pick is the first thing the cursor offers). */
function seatEspionagePick(): void {
  const offer = props.espionageOffer;
  if (offer === undefined) {
    return;
  }
  const rows = espionageRows.value;
  const priorIdx = offer.prior !== undefined ?
    rows.findIndex((r) => r.target.color === offer.prior) : -1;
  const firstLegal = rows.findIndex((r) => r.target.legal);
  espionageFocusIdx.value = priorIdx >= 0 ? priorIdx : Math.max(0, firstLegal);
  sceneFocus.value = 'track';
}
// ── the CEREMONY (pos 10/11) ───────────────────────────────────────────
/**
 * The culmination starts ONLY on the marker's physical arrival at the
 * terminal stop, and its completion NEVER ends the flow: it releases the
 * `ceremonyOwed` busy term (`markHydroCeremonyPlayed`), the resolution's
 * ordinary falling edge advances to the RESULT stage, and the summary —
 * the mandatory terminal stage of every movement — shows the awarded VP
 * with the rest of the move's ledger. A ceremony that cannot come (the
 * glide degraded — no genuine settle will ever fire) is honestly SKIPPED
 * through the same completion signal: the recovery-net semantics, with
 * the summary still owed and still shown.
 */
function maybeStartCeremony(settledPos: number): void {
  const c = flow.commit;
  if (c === undefined || c.kind !== 'ceremony' || c.phase !== 'resolving' || cereStarted.value) {
    return;
  }
  // A culmination may not start on a hidden stage: a parked flow keeps
  // OWING it (`ceremonyOwed` holds the close gate through the park), and
  // the restore replays this ask through the flow's own witness. Started
  // anyway it would measure `display: none` rects and play the finale
  // invisibly — consumed, never seen.
  if (hydroFlowSetAside()) {
    return;
  }
  if (settledPos !== c.toPosition) {
    // The walk is still going — its own edges (settle / cursor / phase)
    // re-ask when it ends.
    if (markerGliding.value || hydroTraversalPending()) {
      return;
    }
    // THE DURABLE ARRIVAL FACT. `markerSettled` is an 800 ms one-shot
    // (the settle GLOW's clock), so a slow frame — a GC pause, a heavy
    // notification flush — let the phase edge arrive with it already
    // reset, and the finale was silently SKIPPED by the recovery below.
    // The marker renders ON the finish stop from the server's own
    // position the moment the glide yields, so «the token physically
    // stands there» is answerable durably: play the culmination.
    if ((props.playerView.thisPlayer.deltaProject?.position ?? -1) !== c.toPosition) {
      // THE RECOVERY NET: the marker is idle, no plan stands, and the
      // server never confirmed the destination — the glide degraded
      // (expired arm / aborted plan) and no arrival will ever come. The
      // culmination is skipped honestly; the summary still follows.
      markHydroCeremonyPlayed();
      return;
    }
  }
  cereStarted.value = true;
  void nextTick(() => {
    const root = rootEl.value ?? undefined;
    const seat = cereSeat.value ?? undefined;
    const sceneElNow = sceneEl.value ?? undefined;
    if (root === undefined || seat === undefined || seat === null || sceneElNow === undefined) {
      // No stage to play on (mid-teardown) — complete without pretending.
      markHydroCeremonyPlayed();
      return;
    }
    setHydroCeremonyActive(true);
    cereHandle = runHydroCeremony({
      sceneEl: sceneElNow,
      stopEl: root.querySelector<HTMLElement>(`[data-hydro-stop="${c.toPosition}"]`) ?? undefined,
      seatEl: seat,
      valueEl: cereValue.value ?? undefined,
      dressEls: Array.from(root.querySelectorAll<HTMLElement>('[data-hydro-cere-line]')),
      reduced: reducedMotion.value === true,
      onCulmination: () => {
        // A ONE-SHOT (FI · EG-5): the peak's keyframe marks the culmination and ends on its own; the class is
        // taken off once the ceremony settles, so no lit state stands after it.
        seat.classList.add('con-hydro__cere-seat--peak');
      },
      onDone: () => {
        seat.classList.remove('con-hydro__cere-seat--peak');
        cereHandle = undefined;
        setHydroCeremonyActive(false);
        markHydroCeremonyPlayed();
      },
    });
  });
}
// ── input ──────────────────────────────────────────────────────────────
function handleIntent(intent: GamepadIntent): void {
  // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 on the plan's browse opens it (iteration 6 — resolved
  // BEFORE the flow's own grammar, the composers' and the stages' order).
  if (effectForecastOpen('hydro')) {
    forecastIntent(intent);
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR' && forecastCanOpen.value) {
    openForecastLayer();
    return;
  }
  const c = flow.commit;
  if (c !== undefined) {
    if (c.phase === 'result') {
      const a = consoleActionOf(intent);
      if (a === 'primary' || a === 'back') {
        emit('result-done');
      }
      return;
    }
    // A transient beat / a standing follow-up: B may only collapse; the
    // embedded surface's own input is routed by the shell before us.
    if (consoleActionOf(intent) === 'back' && props.followUpLive) {
      emit('collapse');
    }
    return;
  }
  if (flow.step === 'reward') {
    // A TRAVERSAL decision's step is a SELECTOR: ←/→ between the options,
    // A picks and RETURNS to the rail (which owns the commit), B returns
    // with the standing draft untouched. No confirm stage of its own.
    if (choicePosition.value !== undefined) {
      if (intent.kind === 'nav') {
        const n = choiceOptions.value.length;
        if ((intent.dir === 'left' || intent.dir === 'right') && n > 0) {
          choiceFocus.value = (choiceFocus.value + (intent.dir === 'right' ? 1 : n - 1)) % n;
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        pickChoice(choiceFocus.value);
        return;
      case 'back':
        closeChoiceStep();
        return;
      default:
        return;
      }
    }
    if (intent.kind === 'nav') {
      const n = choiceOptions.value.length;
      if ((intent.dir === 'left' || intent.dir === 'right') && n > 0) {
        // Sideways always means «the options» — from the armed CTA it
        // steps back up into them AND moves, one gesture.
        choiceStage.value = 'options';
        choiceSkipFocus.value = false;
        choiceFocus.value = (choiceFocus.value + (intent.dir === 'right' ? 1 : n - 1)) % n;
      } else if (intent.dir === 'down') {
        // ↓ walks the act column: options → the armed commit → the
        // optional refusal beneath it (a server-framed offer only).
        if (choiceStage.value === 'confirm' && choiceSkipOffered.value) {
          choiceSkipFocus.value = true;
        } else if (rewardChoice.value !== undefined) {
          choiceStage.value = 'confirm';
        }
      } else if (intent.dir === 'up') {
        if (choiceSkipFocus.value) {
          choiceSkipFocus.value = false;
        } else {
          choiceStage.value = 'options';
        }
      }
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      if (choiceSkipFocus.value) {
        answerBonus(false);
      } else if (choiceStage.value === 'confirm') {
        confirmChoiceStep();
      } else {
        pickChoice(choiceFocus.value);
      }
      return;
    case 'back':
      closeChoiceStep();
      return;
    default:
      return;
    }
  }
  if (flow.step === 'target') {
    if (intent.kind === 'nav') {
      targetNav(intent.dir);
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      targetConfirm();
      return;
    case 'inspect':
      targetInspect();
      return;
    case 'prevSection':
      cycleTargetOwner(-1);
      return;
    case 'nextSection':
      cycleTargetOwner(1);
      return;
    case 'back':
      closeHydroStep();
      return;
    default:
      return;
    }
  }
  // PAYMENT — the composition substep: the bumpers dial the ONE draft,
  // A is the final reinforce, B walks back to the plan with everything
  // (destination, pre-selects, the dialed draft) intact.
  if (flow.step === 'payment') {
    if (intent.kind === 'nav') {
      if ((intent.dir === 'up' || intent.dir === 'down') && mixTwoLanes.value) {
        mixLane.value = intent.dir === 'up' ? 'steel' : 'floodgateSteel';
      }
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'prevSection':
      adjustMix(-1);
      return;
    case 'nextSection':
      adjustMix(1);
      return;
    case 'primary':
      onPaymentConfirm();
      return;
    case 'back':
      closePaymentStep();
      return;
    default:
      return;
    }
  }
  // REWARD-ONLY PICK — the track is the selection surface: ←/→ walks the
  // stages, ↑/↓ walks track ↔ CTA, A opens the focused stage's ask (or
  // resolves a complete pick), B returns to the composer unchanged.
  if (sceneKey.value === 'reward-pick') {
    if (intent.kind === 'nav') {
      if (intent.dir === 'left' || intent.dir === 'right') {
        sceneFocus.value = 'track';
        selectPosition(model.value.selectedPosition + (intent.dir === 'right' ? 1 : -1));
      } else if (intent.dir === 'down') {
        sceneFocus.value = 'cta';
      } else if (intent.dir === 'up') {
        sceneFocus.value = 'track';
      }
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      onRewardPickPrimary();
      return;
    case 'inspect':
      inspectBonusSource();
      return;
    case 'back':
      emit('close');
      return;
    default:
      return;
    }
  }
  // ESPIONAGE TARGET PICK — ↑/↓ walks the candidate rows (blocked rows
  // stay focusable so their reason reads), the focus retunes the track's
  // ghost projection, A on a LEGAL row confirms the target and RETURNS to
  // the composer, a blocked row refuses out loud, B returns unchanged,
  // X inspects the source card over the standing scene.
  if (sceneKey.value === 'espionage-pick') {
    if (intent.kind === 'nav') {
      const n = espionageRows.value.length;
      if (n === 0) {
        return;
      }
      if (intent.dir === 'down') {
        espionageFocusIdx.value = Math.min(n - 1, espionageFocusIdx.value + 1);
      } else if (intent.dir === 'up') {
        espionageFocusIdx.value = Math.max(0, espionageFocusIdx.value - 1);
      }
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      confirmEspionageRow(espionageFocusIdx.value);
      return;
    case 'inspect':
      inspectBonusSource();
      return;
    case 'back':
      emit('close');
      return;
    default:
      return;
    }
  }
  // BLOCKADE TARGET PICK — the same contract as the espionage pick:
  // ↑/↓ walks the candidates (blocked rows stay focusable so their
  // reason reads), focus retunes the GHOST GATE on the track, A on a
  // LEGAL row confirms and RETURNS to the composer, B returns unchanged,
  // X inspects the source card over the standing scene.
  if (sceneKey.value === 'blockade-pick') {
    if (intent.kind === 'nav') {
      const n = blockadeRows.value.length;
      if (n === 0) {
        return;
      }
      if (intent.dir === 'down') {
        blockadeFocusIdx.value = Math.min(n - 1, blockadeFocusIdx.value + 1);
      } else if (intent.dir === 'up') {
        blockadeFocusIdx.value = Math.max(0, blockadeFocusIdx.value - 1);
      }
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      confirmBlockadeRow(blockadeFocusIdx.value);
      return;
    case 'inspect':
      inspectBonusSource();
      return;
    case 'back':
      emit('close');
      return;
    default:
      return;
    }
  }
  // BLOCKADE EXECUTION — one verb (the receipt is read), X inspects the
  // source card, A and B both leave: past the commit boundary there is
  // nothing to unwind.
  if (sceneKey.value === 'blockade-exec') {
    if (intent.kind === 'nav') {
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
    case 'back':
      emit('close');
      return;
    case 'inspect':
      inspectBonusSource();
      return;
    default:
      return;
    }
  }
  // BONUS — a decision, not a browse layer: the d-pad moves between the
  // two answers and nothing else, so the track never scrolls under a
  // question the player is being asked.
  if (sceneKey.value === 'bonus') {
    if (intent.kind === 'nav') {
      navBonus(intent.dir);
      return;
    }
    switch (consoleActionOf(intent)) {
    case 'primary':
      if (sceneFocus.value === 'bonus-source') {
        inspectBonusSource();
      } else if (railIdOf(sceneFocus.value) !== undefined) {
        openRailDecision();
      } else {
        answerBonus(sceneFocus.value !== 'bonus-skip');
      }
      return;
    case 'inspect':
      inspectBonusSource();
      return;
    case 'back':
      // СВЕРНУТЬ — never «Пропустить». The offer stays on the wire,
      // unanswered; the workspace parks at full depth and the board-home
      // mandatory card brings the player back to this very prompt.
      emitBack();
      return;
    default:
      return;
    }
  }
  // PREVIEW.
  if (intent.kind === 'nav') {
    // A deliberate move: this decision revision may not re-seat the cursor.
    focusMoved.value = true;
    if (intent.dir === 'left' || intent.dir === 'right') {
      sceneFocus.value = 'track';
      selectPosition(model.value.selectedPosition + (intent.dir === 'right' ? 1 : -1));
    } else if (intent.dir === 'down') {
      // ↓ walks the SPATIAL column: track → the rail's decisions, top to
      // bottom, → the final CTA. The bottom edge HOLDS (no wrap — the
      // scene-wide convention).
      const to = railStep(railDecisions.value, sceneFocus.value, 1);
      if (to !== 'out-bottom' && to !== 'out-top') {
        seatRailFocus(to);
      }
    } else if (intent.dir === 'up') {
      if (sceneFocus.value === 'track') {
        return;
      }
      const to = railStep(railDecisions.value, sceneFocus.value, -1);
      if (to === 'out-top') {
        sceneFocus.value = 'track';
      } else if (to !== 'out-bottom') {
        seatRailFocus(to);
      }
    }
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'nextTab': { // RT — jump to the FURTHEST legal+affordable stage.
    const max = preview.value?.maxLegalSteps ?? 0;
    if (max > 0) {
      sceneFocus.value = 'track';
      focusMoved.value = true;
      selectPosition(model.value.currentPosition + max);
    }
    return;
  }
  // (No LB/RB here: the composition dial belongs to the PAYMENT substep
  // alone — a hidden control on Configure is the forbidden shape.)
  case 'primary':
    if (railIdOf(sceneFocus.value) !== undefined) {
      openRailDecision();
    } else {
      onPrimary();
    }
    return;
  case 'back':
    emitBack();
    return;
  default:
    return;
  }
}
/** B on a layer whose verb is close-or-collapse. ONE door, so the button
 *  can never do one thing and the bar say another. */
function emitBack(): void {
  // THE WALK BACK CARRIES THE CARD, exactly as the walk in did. This screen
  // is a STEP of the workspace that opened it (a card's «Открыть
  // Гидросеть»), and B is that step ending — so the source card returns to
  // the hero slot it came out of instead of dissolving here while a second
  // copy fades in over there.
  //
  // CAPTURED BEFORE THE STACK MOVES, and synchronously: the frame pops in
  // this very call, and everything measured here stops being true with it.
  // The host consumes it (`carryAnchorsHome`) — it never re-enters, so
  // there is no transition hook to measure from.
  if (backVerb.value !== 'collapse' && crumbHost.value !== undefined) {
    captureSurfaceDeparture('section', rootEl.value);
  }
  emit(backVerb.value === 'collapse' ? 'collapse' : 'close');
}

watch(() => props.cacheKey, (): void => {
  fetchPreview();
});
watch(() => viewerColor.value, (): void => {
  fetchPreview();
});
/** The MOVEMENT LINK follows its spec AND the rail's layout: a focus walk
 *  re-sizes the cells (the selected one magnifies), so the arc re-measures
 *  on both — plus one settle pass after the stopin transition. */
watch(() => ghostLinkSpec.value, (): void => {
  scheduleGhostLinkMeasure();
});
/**
 * A NEW offer seats the cursor on its CONFIRM and clears the in-flight
 * latch. Keyed on the offer's identity, so a second ocean's offer arriving
 * after the first is answered starts clean — and the latch can never
 * survive into a state where both CTAs would stay dead.
 */
watch(() => bonusIdentity.value, (now: string): void => {
  bonusSubmitting.value = false;
  pickWarned.value = false;
  if (now !== '' && seatPlanOnOffer()) {
    // THE CURSOR STARTS ON THE QUESTION — but only the PREVIEW knows
    // whether there is one, so claim the seat and let the first frame
    // that can answer place it (`applyOwedSeat`).
    sceneFocus.value = 'bonus-confirm';
    seatOwed.value = true;
    applyOwedSeat();
  } else if (sceneFocus.value.startsWith('bonus-')) {
    sceneFocus.value = 'track';
  }
}, {immediate: true});
/**
 * THE SERVER REFUSED — the move did not happen (`rollbackHydroCommit`), so
 * the answer's in-flight latch must die with it or BOTH answers stay inert
 * and the zone becomes a dead end. The falling edge of the commit record is
 * the ONE honest signal: a rejected batch and a network failure unwind
 * through the same battery.
 */
watch(() => hydroFlowState.commit, (now: unknown, prev: unknown): void => {
  if (now === undefined && prev !== undefined && advanceOffer.value !== undefined) {
    bonusSubmitting.value = false;
  }
  // The ceremony one-shot belongs to ONE commit — a rollback (server
  // refusal) or a finished flow must re-arm it for the next resolution;
  // a stale latch would silently skip the next terminal culmination.
  if (now === undefined && prev !== undefined) {
    // …and a finished (or refused) move never leaves it raised for the next.
    floodgatePreference.value = 0;
    mixLane.value = 'steel';
    cereStarted.value = false;
  }
});
/** The preview landed (or the stage changed under it) — the owed seat can
 *  finally be placed. */
watch(() => pickKind.value, (): void => {
  applyOwedSeat();
});
watch(() => model.value.mustSelectCard, (): void => {
  applyOwedSeat();
});
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>): void => {
  consoleHydroUi.commands = [...cmds];
}, {immediate: true});
/** A NEW espionage pick (or a re-open) seats the cursor on the saved
 *  target / first legal candidate — data only, DOM-free, so the immediate
 *  setup call is safe. */
watch(() => props.espionageOffer, (now: DeltaEspionagePickRequest | undefined): void => {
  if (now !== undefined) {
    seatEspionagePick();
  }
}, {immediate: true});
/** A NEW blockade pick (or a re-open) seats the cursor the same way. */
watch(() => props.blockadeOffer, (now: DeltaBlockadePickRequest | undefined): void => {
  if (now !== undefined) {
    seatBlockadePick();
  }
}, {immediate: true});
watch(() => draftFingerprint.value, (): void => {
  if (flow.commit === undefined) {
    noteHydroDraftTouched(props.cacheKey);
  }
});
// The crumb mirrors onto the FRAME (the collapsed chip and every other
// stack reader see the same tail the header draws).
watch(() => crumbSubject.value, (subject: string): void => {
  setWorkspaceFrameSubject('hydro', subject);
}, {immediate: true});
// …AND THE CARD THE STEP IS BEING DONE FOR, on its own edge. It rode the
// crumb watchers, and the crumb does not move when a repeat step opens — so
// a colony step hosted here came up with no `L3 Источник` at all, which is
// exactly the verb this publication exists to feed.
watch(() => embedSourceCard.value, (): void => {
  syncFrameCrumb();
}, {immediate: true});
watch(() => crumbStagePublished.value, (stage: string): void => {
  setWorkspaceFrameStage('hydro', stage);
}, {immediate: true});
/** The layer lives ONLY on the plan's browse level — a step, a choice, a payment, a commit fold it instantly. */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  if (!can) {
    foldForecastHost('hydro');
  }
});
// THE EMBED ZONE — published while the commit scene stands. `flush:
// 'post'`: the zone must exist before the teleport looks for it.
watch(() => sceneKey.value, (key: SceneKey, prev: SceneKey | undefined): void => {
  if (key === 'commit') {
    publishEmbedZone();
  } else if (prev === 'commit') {
    retractEmbedZone();
  }
  if (key !== 'preview') {
    sceneFocus.value = 'track';
  }
}, {flush: 'post'});
// …AND RE-PUBLISHED FOR A CLAIM RAISED MID-SCENE. `publishEmbedZone` only
// hands the outcome state its slot when the claim is already standing, so
// a claim raised while `sceneKey` is ALREADY 'commit' (a release between
// two batches of one traversal, a restore) found `embedSlot` empty and
// its batch held forever — the sceneKey watcher cannot fire true→true.
// The claim's own rising edge is the missing signal.
watch(() => outcomeClaimedByHydro.value, (now: boolean): void => {
  if (now && sceneKey.value === 'commit') {
    publishEmbedZone();
  }
}, {flush: 'post'});
// The ceremony fires once the marker has LOCKED on the finish stop —
// never concurrently with the glide.
watch(() => markerSettled.value, (pos: number): void => {
  maybeStartCeremony(pos);
});
// THE PRESENCE REPORT of the pos-9 presented card (the marker sequence
// awaits its full EXIT before the cursor moves on). The rising edge is
// the mount; the falling edge is deliberately NOT reported here — the
// card's leave transition ends it (`onLandCardLeft`), because «no longer
// rendered» and «finished leaving» are different frames and the chips'
// slot must survive to the second one.
watch(() => presentedTargetCard.value, (card: CardName | undefined): void => {
  if (card !== undefined && presentedLandPosition.value >= 0) {
    landReportedPosition.value = presentedLandPosition.value;
    noteHydroLandPresence(presentedLandPosition.value, true);
  }
}, {immediate: true});
watch(() => hydroFlowState.commit?.phase, (): void => {
  maybeStartCeremony(markerSettled.value);
});
// …and a traversal plan ENDING (finished or aborted) re-asks the same
// question: a plan that died without a settle on the terminal stop is the
// degraded-glide case — the recovery branch completes the owed ceremony
// honestly, so the flow can never hang on a culmination that cannot come.
watch(() => hydroMarkerState.planCursor, (cursor: number): void => {
  if (cursor < 0) {
    maybeStartCeremony(markerSettled.value);
  }
});
// THE NESTED FULL-SCENE STEP (position 7's repeat browser) takes the
// whole band; this workspace is hidden for its length and comes back when
// the step's FRAME pops.
//
// ⚠️ NOTHING POSES THIS SURFACE ANY MORE. The step used to be handed the
// screen by a release tween (the track's own layers down to 12 %) that a
// return tween had to undo — and a return that did not land left the
// workspace ON SCREEN AND DEAD: a readable crumb over a ghost body with no
// way forward. The step is a stack FRAME now, so the swap is PRESENCE, not
// a pose. This heal stays as the one-line insurance that an episode left
// over from an older build (or a killed tween) cannot survive the return.
watch(() => hydroFlowState.repeatBridge, (on: boolean): void => {
  if (!on) {
    void nextTick(() => {
      const root = rootEl.value ?? undefined;
      // ⚠️ THE ROOT IS POSED TOO, and by somebody else. This section
      // publishes no `[data-motion-panel]`, so the surface-motion director
      // falls back to posing the ROOT ITSELF (`panelsOf` → `[el]`) — and its
      // `v-show` flip fires a real enter/leave pair. Whenever that pair is
      // not perfectly reversible (a suppression flag read on the wrong
      // side of a flush, an instant re-show that heals nothing) the leave's
      // opacity stays on the root and the workspace comes back ON SCREEN
      // AND DEAD — the reported «после возврата интерфейс залипает», with
      // a readable crumb over a ghost body.
      //
      // So the return CLEARS the inline pose unconditionally, on the root
      // as well as on the layers. A surface arriving back from a bridge
      // owns no leftover inline style by definition: healing what nobody
      // posed costs one `gsap.set`, and NOT healing it costs the screen.
      if (root !== undefined && root !== null) {
        gsap.set(root, {clearProps: 'transform,opacity,visibility'});
      }
      playHydroBridgeReturn(root, reducedMotion.value === true);
    });
  }
});
// Stepping between stops RETUNES the standing panel body (a soft
// dip-and-rise under the change) instead of hard-swapping its rows —
// `overwrite: 'auto'` makes a held d-pad read as one continuous shimmer,
// never a pile of restarts.
/**
 * A FLOW WITH NOTHING LEFT TO SHOW IS OVER. The scene already fell back to
 * the browse layer (`flowPresentable`); dropping the record makes that the
 * TRUTH rather than a rendering exception — the CTA, the back verb and the
 * phase all follow from it, and the next advance starts clean.
 */
watch(() => flowPresentable.value, (can: boolean): void => {
  if (!can && flow.commit !== undefined) {
    resetHydroFlow();
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
  }
}, {immediate: true});
watch(() => model.value.selectedPosition, (next: number, prev: number | undefined): void => {
  // The cursor moved to another stop: its answer is another forecast — the R3 layer folds, the next R3 opens that one.
  foldForecastHost('hydro');
  // A PROTECTED pool is dialed for ONE move: another destination starts
  // it at 0 again, so a share raised for one price never rides another.
  if (next !== prev) {
    floodgatePreference.value = 0;
    mixLane.value = 'steel';
  }
  if (prev !== undefined && next !== prev && sceneKey.value === 'preview') {
    retunePanel();
  }
});
/** The stage-7 repeat bridge resolved while a TRAVERSAL plan stands: the
 *  chosen card lands in the per-position draft (one write path — the same
 *  `applyTraversalPick` the target step uses, cursor hand-off included). */
watch(() => repeatResultMirror.value, (result: ConsoleRepeatPickResult | undefined): void => {
  if (result === undefined || !traversalActive.value || advanceOffer.value !== undefined) {
    return;
  }
  const stage = traversalRepeatStage.value;
  if (stage !== undefined && stage.pick !== result.chosenCard) {
    applyTraversalPick(stage.position, result.chosenCard);
  }
});
// A stale pre-selected card silently left the model (the preview moved) —
// tell the player instead of letting the CTA flip wordlessly.
watch(() => model.value.selectedCard, (card: CardName | undefined, prev: CardName | undefined): void => {
  // The warning describes a STATE, never a press, so it dies with the
  // state it named — a pick made (or dropped) re-arms the gate honestly.
  pickWarned.value = false;
  // A TRAVERSAL's picks ride the per-position drafts and hand the cursor
  // on in their own write path (`applyTraversalPick`) — the shared field
  // is only the repeat bridge's mirror there.
  if (traversalActive.value && advanceOffer.value === undefined) {
    return;
  }
  // AN ANSWER MOVES THE CURSOR ON: the resolved decision shows its
  // summary and the seat goes to the NEXT open decision in game order —
  // or to the final CTA when nothing is left open. Only when the cursor
  // was ON the rail (the return from the child selector); a player
  // standing elsewhere is never yanked. The press that confirmed the
  // child selector cannot land on the new seat: button intents exist
  // only on the press EDGE (pad edge-detect, `keyboardConsoleIntent`
  // drops key repeat), so the CTA takes a fresh, deliberate A.
  if (card !== undefined && prev === undefined) {
    const answered = railDecisions.value.find((d) => d.chosen === card) ?? railDecisions.value[0];
    if (answered !== undefined && railIdOf(sceneFocus.value) !== undefined) {
      seatRailFocus(nextRailFocus(railDecisions.value, answered.id));
    }
  }
  if (card === undefined && prev !== undefined &&
      hydroNetworkState.selectedCard === prev && flow.commit === undefined) {
    emit('notice', translateText('The selected card is no longer available'));
    hydroNetworkState.selectedCard = undefined;
    consoleHydroUi.repeatResult = undefined;
  }
});
/**
 * THE DECISION'S OWN IDENTITY — the focus seat is re-decided when THIS
 * changes, and only then. The key carries the door, the stage and the
 * pick's AVAILABILITY: `unavailable → available` (the player used a blue
 * action elsewhere and came back) is a NEW revision of the decision, so a
 * stale remembered cursor on the commit may not outrank the newly
 * answerable pre-select. A plain re-render of the same revision changes
 * nothing. The one change that must NOT re-seat is the revision the player
 * created themselves — walking the track flips position/pickKind too, and
 * stealing the cursor off the track mid-walk is the defect this model
 * exists to remove (`selfKeyChange`, armed inside `selectPosition` in the
 * same synchronous block as the position write, consumed by this flush).
 */
watch(() => pickDecisionKey.value, (now: string, prev: string | undefined): void => {
  if (now === prev) {
    return;
  }
  if (selfKeyChange.value) {
    selfKeyChange.value = false;
    return;
  }
  focusMoved.value = false;
  seatOnOwedPick();
});

onMounted((): void => {
  // A CARRIED OBJECT MAY NOT PAINT BEFORE ITS TRAVEL STARTS. When this screen
  // is the next stage of a flow the player began elsewhere, the source card
  // is FLIPping in from that flow's hero slot — and this component paints
  // before the enter hook can pose it. Held here, released by the FLIP (or by
  // its own bounded safety).
  holdCarriedAnchors(rootEl.value ?? undefined);
  // RESUME ≠ FRESH-OPEN: decide ONCE, host-scoped, what this mount can
  // honestly rebuild (the actionWorkspaceRestorePlan idiom).
  const owned = hydroFlowIsOwnedByCurrentFrame();
  const plan = hydroWorkspaceRestorePlan({
    commit: flow.commit,
    claimHost: workspaceOutcomeState.host,
    followUpInteractive: props.followUpLive,
    ownedByThisFrame: owned,
    espionageExecution: flow.commit?.espionage !== undefined,
  });
  if (plan === 'fold') {
    resetHydroFlow();
    resetHydroPlan();
    consoleHydroUi.repeatResult = undefined;
    // …AND AN **ORPHANED** RECORD TAKES ITS PRESENTATION WITH IT. The
    // traversal sequence is module state too: left parked at a stop nobody is
    // going to resume, its marker keeps the cursor of a walk this screen will
    // never show, so the track would read a position the server no longer has.
    //
    // ⚠️ ONLY for the orphan. The ORDINARY fold («the resolution finished
    // while parked») is a mount that arrived a beat early — its sequence is
    // still going to resume and play the stop's own result, and killing the
    // marker there turned the board-placement return into a flow that ended
    // silently on the track's planning layer.
    if (!owned) {
      resetHydroMarker();
    }
  } else if (plan === 'none') {
    closeHydroStep();
    // THE REWARD CHOICE IS STEP-SCOPED, so a mount with no live step has
    // nothing to carry: without this it survived a trip to the board and
    // the CTA then committed a reward the player could no longer see.
    hydroNetworkState.rewardChoice = undefined;
    choiceStage.value = 'options';
    if (!hydroDraftFresh(props.cacheKey)) {
      resetHydroPlan();
      consoleHydroUi.repeatResult = undefined;
    }
  }
  // A host must republish its zones from `onMounted` — a change-watcher
  // cannot fire true→true across a park.
  if (sceneKey.value === 'commit') {
    publishEmbedZone();
  }
  // THE MOUNT EDGE of the seating — after the restore plan, whose fresh-open
  // branch resets the very field the offer needs seated.
  seatPlanOnOffer();
  seatRewardPick();
  // The movement-link arcs: measured on mount (the pick scenes mount with
  // their offer already standing — a change watcher has no edge to fire on)
  // and re-measured whenever the rail's own box moves.
  const rail = railEl.value ?? undefined;
  if (rail !== undefined && typeof ResizeObserver !== 'undefined') {
    ghostLinkRo = new ResizeObserver(() => scheduleGhostLinkMeasure());
    ghostLinkRo.observe(rail);
  }
  scheduleGhostLinkMeasure();
  seatEspionagePick();
  if (flow.step === 'target') {
    void nextTick(() => seatTargetStep());
  }
  // …and the plan layer seats its cursor the same way: the pick is the act,
  // so the cursor starts on it rather than on a CTA that cannot fire. Claimed,
  // not decided — `fetchPreview()` below is what makes the question answerable.
  seatOwed.value = true;
  applyOwedSeat();
  syncFrameCrumb();
  fetchPreview();
  // THE MOUNT EDGE + THE WITNESS'S DOOR of the terminal culmination. All
  // three of its watchers are change-edges, and a section that (re)mounts
  // into a resolving ceremony commit (a restore across a lateral move, a
  // reload straight into the commit) has none of them left to fire — the
  // owed finale then wedged the close gate for good. The registered
  // starter is also how the flow's truth witness replays the ask after a
  // park or a missed edge: one door, the same guards, so a heal can never
  // invent a second start path.
  registerHydroCeremonyStarter(() => maybeStartCeremony(markerSettled.value));
  maybeStartCeremony(markerSettled.value);
});
onBeforeUnmount((): void => {
  // The R3 «Эффекты» layer and the door's flare die with the section (the stdp host's own order).
  closeEffectForecastLayer('hydro');
  pulseCall?.kill();
  pulseCall = undefined;
  registerHydroCeremonyStarter(undefined);
  cereHandle?.kill();
  cereHandle = undefined;
  setHydroCeremonyActive(false);
  retractEmbedZone();
  consoleHydroUi.commands = [];
  setWorkspaceFrameSubject('hydro', '');
  setWorkspaceFrameStage('hydro', '');
  ghostLinkRo?.disconnect();
  ghostLinkRo = undefined;
  // (The settle re-measure timer is `flowScope`'s — taken back with it.)
  // A leave that will never play (the whole section is going) must still
  // end the presence — a sequence awaiting the card's exit would hang.
  if (landReportedPosition.value >= 0) {
    noteHydroLandPresence(landReportedPosition.value, false);
    landReportedPosition.value = -1;
  }
});
// `handleIntent` is the surface's whole contract with its parent: the shell's pad router reaches the section by NAME
// (`shell.surfaces.at('hydroSection')` → `handedTo(…)` → `surface.handleIntent(intent)` — console/shell/
// padRouterController.ts). `statusLabel` is read by no parent and by nothing on screen — only by the unit specs
// (`consoleHydroBonusZone.spec`, `consoleHydroCardEntry.spec`, through `wrapper.vm`); it stands here so that the
// reading they pin stays a READ member of the script.
defineExpose({handleIntent, statusLabel});
</script>
