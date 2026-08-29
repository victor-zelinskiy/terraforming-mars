<template>
  <section class="con-hydro con-ws"
           ref="rootEl"
           role="region"
           :aria-label="$t('Mars Hydronetwork')"
           :data-flow="flowKind"
           :class="{'con-hydro--cere': ceremonyDim, 'con-hydro--hosted': crumbHost !== undefined}">
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
                   :class="{'con-hydro__head--ghost': crumbHost !== undefined}"
                   :root="crumbRoot"
                   :emblem="crumbEmblem.emblem"
                   :wheelAnchor="crumbEmblem.wheelAnchor"
                   :subject="headSubject"
                   :stage="crumbStage"
                   :committed="crumbCommitted">
      <span class="con-hydro__chip">
        <span class="con-hydro__chip-dim">{{ $t('Track position') }}</span>
        <b>{{ model.currentPosition }} / 11</b>
      </span>
      <span class="con-hydro__chip con-hydro__chip--status" :class="'con-hydro__chip--' + statusKind">
        <span class="con-hydro__chip-dot" aria-hidden="true"></span>
        <span>{{ $t(statusLabel) }}</span>
      </span>
    </ConsoleWsHead>

    <!-- ── PROGRESS RAIL: all 12 stops, the selected one magnified. THE track
         is the workspace's permanent protagonist — every scene below keeps it
         standing. (Unchanged navigation: ←/→ stages, RT farthest.) ───────── -->
    <div class="con-hydro__rail" role="list">
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
                 'con-hydro__stop--dimmed': !globallyActable && stop.vm.state !== 'current' && stop.vm.state !== 'completed',
               },
             ]"
             @click="onStopClick(stop.position)">
          <div class="con-hydro__stop-req">
            <span v-if="stop.vm.stage.tag !== undefined" class="con-hydro__stop-tag resource-tag" :class="'tag-' + stop.vm.stage.tag" aria-hidden="true"></span>
            <span v-else-if="stop.vm.stage.vp !== undefined" class="con-hydro__stop-vp">{{ stop.vm.stage.vp }}<small>{{ $t('VP') }}</small></span>
            <span v-else class="con-hydro__stop-flag" aria-hidden="true">⚑</span>
            <span class="con-hydro__stop-num">{{ stop.position }}</span>
            <span v-if="stop.vm.rewardedByViewer" class="con-hydro__stop-badge con-hydro__stop-badge--done" aria-hidden="true">✓</span>
            <span v-else-if="stop.vm.skippedByViewer" class="con-hydro__stop-badge con-hydro__stop-badge--skip" aria-hidden="true">↷</span>
            <span v-else-if="stop.gradeGlyph !== ''" class="con-hydro__stop-badge con-hydro__stop-badge--grade" aria-hidden="true">{{ stop.gradeGlyph }}</span>
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
                  v-show="!(m.isViewer && markerGliding && stop.position === markerFrom)"
                  class="con-hydro__stop-marker"
                  :class="[
                    'player_bg_color_' + m.color,
                    {
                      'con-hydro__stop-marker--viewer': m.isViewer,
                      'con-hydro__stop-marker--settle': m.isViewer && stop.position === markerSettled,
                    },
                  ]"
                  aria-hidden="true"></span>
          </div>
        </div>
      </template>
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
      <div class="con-hydro__panel" :class="{'con-hydro__panel--immersive': immersive}">
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
            <span v-else class="con-hydro__stage-flag" aria-hidden="true">⚑</span>
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
            <span v-else class="con-hydro__route-cost">
              <template v-if="ctxView.route.energy > 0">−{{ ctxView.route.energy }}<i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></template>
              <template v-if="ctxView.route.steel > 0">−{{ ctxView.route.steel }}<i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i></template>
            </span>
          </span>
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
                  <span class="con-hydro__req-mark" aria-hidden="true">{{ tagStatus(t) === 'missing' ? '✕' : '✓' }}</span>
                  <span v-if="tagStatus(t) === 'wild'" class="con-hydro__req-wild" aria-hidden="true">✱</span>
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
                <span v-if="model.skippedStages.length > 0" class="con-hydro__routenote">
                  ↷ {{ skippedSummary }}
                </span>
                <span v-if="jumpedOverVp2" class="con-hydro__routenote">
                  ⤴ {{ $t('The occupied 2 VP position is leapt over to reach the 5 VP slot.') }}
                </span>
              </div>

              <!-- Outcome row — the ONE shared block (see ConsoleHydroGains):
                   honest deltas, the alternatives while the choice is open.
                   («Нечего выбирать» is stated ONCE, by the pick row below —
                   the stage's own home for that question.) -->
              <ConsoleHydroGains :view="rewardView"
                                 :options="model.targetNeedsChoice && rewardChoice === undefined ? selectedStage.rewardOptions : undefined"
                                 data-unfold-item />

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
                    <span class="con-hydro__payline-part"><b>{{ model.selectedSpend - mixSteel }}</b><i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i></span>
                    <span aria-hidden="true">+</span>
                    <span class="con-hydro__payline-part"><b>{{ mixSteel }}</b><i class="con-hydro__chip-ico resource_icon resource_icon--steel" aria-hidden="true"></i></span>
                  </template>
                </span>
                <span v-if="mixRowVisible" class="con-hydro__payline-src">{{ $t(mixSourceCard ?? '') }}</span>
                <span v-if="mixAdjustable" class="con-hydro__payline-next">{{ $t('Next: payment composition') }}</span>
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
                <span class="con-hydro__routenote">→ {{ $t('Select a stage ahead to plan the advance') }}</span>
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
            <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
          </div>
          <!-- THE COMPOSITION — the shared premium payment panel over the
               ONE canonical draft, with the room it deserves. -->
          <div class="con-hydro__paypanel" data-unfold-item>
            <ConsolePaymentPanel :view="mixPaymentView"
                                 mode="compact"
                                 hint-mode="none"
                                 title-key="Payment mix"
                                 :source-card="mixSourceCard"
                                 :flash-nonce="mixFlashNonce" />
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
            <b class="con-hydro__commit-stage">{{ $t(commitRec.stageNameKey) }}</b>
            <span class="con-hydro__commit-caption">{{ $t(commitCaption) }}<i v-if="!followUpLive" class="con-hydro__commit-spin" aria-hidden="true"></i></span>
          </div>

          <!-- pos 9: the chosen host card, physically ON STAGE — the animals
               land on its own counter capsule; frozen before-count ticks per
               touchdown. -->
          <div v-if="presentedTargetCard !== undefined" class="con-hydro__cardland" data-unfold-item>
            <div class="con-hydro__landcell"
                 :class="{'con-hydro__landcell--landed': presentedLanded > 0}"
                 :data-played-key="presentedTargetCard">
              <ConsoleCardFaceLite :name="presentedTargetCard" :card="presentedModel" />
              <span v-if="presentedLanded > 0" :key="'flash' + presentedLanded"
                    class="con-hydro__landflash" aria-hidden="true"></span>
            </div>
            <div class="con-hydro__landmeta">
              <i class="card-resource card-resource-animal" aria-hidden="true"></i>
              <em>{{ commitRec.targetBefore ?? 0 }} → {{ (commitRec.targetBefore ?? 0) + 2 }}</em>
            </div>
          </div>

          <!-- pos 10/11: the finish CEREMONY — the value rises out of the
               landed stop into this seat; the shared burst fires here. -->
          <div v-if="commitRec.kind === 'ceremony'" class="con-hydro__cere">
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
               the target must exist before the teleport looks for it. -->
          <div class="con-hydro__embed" data-embed-slot="hydro"></div>
        </div>

        <!-- ═══ RESULT — the read-hold payoff. The route and the actual price
             stand frozen in the context column; this zone states what the
             move DELIVERED: the landed stage, the honest deltas, the resolved
             choices and every named omission. ═══ -->
        <div v-else key="result" class="con-hydro__layer con-hydro__layer--result">
          <div class="con-hydro__result" data-unfold-item>
            <div class="con-hydro__result-head">
              <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
              <b>{{ $t('Reinforcement complete') }}</b>
              <span class="con-hydro__result-stage">{{ $t(commitRec.stageNameKey) }}</span>
            </div>
            <div class="con-hydro__result-rows">
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
                ⟳ {{ $t(commitRec.selectedCard) }}
              </span>
              <span v-else-if="commitRec.kind === 'card-resource' && commitRec.selectedCard !== undefined" class="con-hydro__result-note">
                → {{ $t(commitRec.selectedCard) }}
              </span>
              <!-- The FORFEIT, named — a consciously declined target reward may
                   never end as a silent nothing (cross-cutting «no silent
                   loss»): the result states which effect was declined. -->
              <span v-else-if="commitRec.waivedTarget === true" class="con-hydro__result-note">
                ↷ {{ $t(waivedNoteKey) }}
              </span>
            </div>
            <!-- The standing track rule, restated where it applied: stages
                 passed over paid nothing — the count, never a roster. -->
            <div v-if="(commitRec.skippedCount ?? 0) > 0" class="con-hydro__result-skip">
              ↷ {{ resultSkippedText }}
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
        <div class="con-hydro__act">
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
                  <span class="con-hydro__pickwarn-mark" aria-hidden="true">⚠</span>
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
                    <span class="con-hydro__reason-glyph" aria-hidden="true">✕</span>
                    <span>{{ $t('Stage requirements are not met') }}</span>
                  </div>
                  <!-- The tone is the reason's OWN semantics: a turn gate is
                       amber «не сейчас», a track rule is the red ✕. -->
                  <div v-for="(r, i) in ctaReasons" :key="i" class="con-hydro__reason"
                       :class="{
                         'con-hydro__reason--todo': !r.blocking,
                         'con-hydro__reason--notnow': r.blocking && reasonTone(r) === 'warning',
                       }">
                    <span class="con-hydro__reason-glyph" aria-hidden="true">{{ !r.blocking ? '→' : (reasonTone(r) === 'warning' ? '⏳' : '✕') }}</span>
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
                  <span class="con-hydro__pickwarn-mark" aria-hidden="true">⚠</span>
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

<script lang="ts">
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
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleSourceDock from '@/client/components/console/ConsoleSourceDock.vue';
import ConsoleHydroDecisionRail from '@/client/components/console/hydroFlow/ConsoleHydroDecisionRail.vue';
import {
  HYDRO_PICK_COPY,
  HYDRO_RAIL_CTA,
  HydroPickKind,
  HydroRailDecision,
  buildHydroDecisions,
  initialRailFocus,
  nextRailFocus,
  railFocusNodes,
  railIdOf,
  railNodeOf,
  railStep,
} from '@/client/console/hydroFlow/hydroDecisionRail';
import ConsoleHydroPlanSteps from '@/client/components/console/hydroFlow/ConsoleHydroPlanSteps.vue';
import ConsoleHydroGains from '@/client/components/console/hydroFlow/ConsoleHydroGains.vue';
import {HydroPlanDecision} from '@/client/console/hydroFlow/hydroPlanSteps';
import {deckPickState} from '@/client/console/deckPick/consoleDeckPick';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {buildEnergyMixView, clampEnergyMixSteel, PaymentView} from '@/client/console/paymentPlan';
import {choiceSourceView} from '@/client/console/promptSource';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {Resource} from '@/common/Resource';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {$t, translateCardName, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {buildHydroModel, HydroModel, HydroStageVM} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HYDRO_STAGES, HydroStage, hydroStageNeedsChoice} from '@/client/components/hydronetwork/hydroStages';
import {buildRewardView, HydroDeltaLine, HydroPlayerSnapshot, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {destinationAt, gradeDestination, HydroReason, hydroPlanReasons, hydroPrimaryBlocker, hydroReasonBlocker, hydroRuleBlocked, HydroStopGrade, HydroTurnState, hydroTurnStateOf} from '@/client/components/hydronetwork/hydroReasons';
import {AvailabilityBlocker} from '@/common/availability/AvailabilityBlocker';
import {ACTION_MENU_TITLES} from '@/common/inputs/actionMenuTitles';
import {Message} from '@/common/logs/Message';
import {fetchHydroPreview, hydroNetworkState, resetHydroPlan} from '@/client/components/hydronetwork/hydroNetworkState';
import {consoleHydroUi} from '@/client/console/consoleHydroState';
import type {ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {hydroMarkerState} from '@/client/console/hydroMarker/consoleHydroMarker';
import {hydroRewardTransfers} from '@/client/console/hydroMarker/hydroRewardTransfers';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {
  HydroCommitRecord, closeHydroStep, hydroDraftFresh, hydroFlowState, hydroWorkspacePhase,
  hydroWorkspaceRestorePlan, noteHydroDraftTouched, openHydroStep, resetHydroFlow,
  resolutionKindFor, setHydroCeremonyActive,
} from '@/client/console/hydroFlow/consoleHydroFlow';
import {buildHydroTargetModel, hydroPresentedTargetModel} from '@/client/console/hydroFlow/hydroTargetStep';
import {
  HydroCeremonyHandle, armHydroSceneOrigin, hydroSceneCancelledHook, hydroSceneEnterHook,
  hydroSceneLeaveHook, playHydroBridgeReturn, runHydroCeremony,
} from '@/client/console/hydroFlow/consoleHydroFlowMotion';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {backLabelForVerb, backVerbWithOwedPrompt, WorkspaceBackVerb} from '@/client/console/consoleWorkspaceFlow';
import {getCard} from '@/client/cards/ClientCardManifest';
import {reasonParams} from '@/client/cards/tagLabel';
import {DeltaOfferOrigin, HYDRO_PRIMARY_KEY, HydroNextInteraction, hydroAdvanceCopy, hydroNextInteraction, hydroZoneState} from '@/client/console/hydroFlow/hydroBonusOffer';
import type {DeltaAdvanceOffer, DeltaBonusPromptMeta} from '@/common/models/DeltaBonusPromptModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {cardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  WorkspaceFrameKind, setWorkspaceFrameSlot, setWorkspaceFrameStage, setWorkspaceFrameSubject,
  workspaceFrameEmblem, workspaceFrameHost, workspaceFrameRoot, workspaceStackCrumb,
} from '@/client/console/consoleWorkspaceStack';
import {setWorkspaceOutcomeSlot, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {captureSurfaceDeparture, holdCarriedAnchors} from '@/client/console/surfaceMotion/surfaceMotionState';
import {useConsoleReducedMotion} from '@/client/console/composables/useConsoleReducedMotion';

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
  gradeGlyph: string;
  linkKind: 'done' | 'route' | 'dim';
};

type GroupNode = ActionGroup['nodes'][number];

type SceneKey = 'preview' | 'choice' | 'target' | 'payment' | 'bonus' | 'commit' | 'result';

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
  route?: {from: number; to: number; energy: number; steel: number; free: boolean};
};

export default defineComponent({
  name: 'ConsoleHydroSection',
  components: {
    GamepadGlyph, HydroReward, ConsoleWsHead, ConsolePlayedTargetStep, ConsoleCardFaceLite, ConsoleSourceDock,
    ConsoleHydroDecisionRail, ConsoleHydroPlanSteps, ConsoleHydroGains, ConsolePaymentPanel,
    CardRenderEffectBoxComponent, CardRenderData,
  },
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    actionAvailable: {type: Boolean, default: false},
    /** Preview refetch scope — generation + gameAge + undoCount. */
    cacheKey: {type: String, default: ''},
    /** A follow-up decision of the committed advance is standing (the shell's
     *  live fact — turns the resolving beat into the collapsible phase). */
    followUpLive: {type: Boolean, default: false},
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
  },
  emits: ['close', 'confirm', 'pick', 'notice', 'collapse', 'result-done', 'bonus-answer', 'card-advance', 'inspect-source'],
  setup() {
    const {reduced} = useConsoleReducedMotion();
    return {reducedMotion: reduced};
  },
  data() {
    return {
      flow: hydroFlowState,
      hydroMarkerState,
      landings: cardResourceLandings,
      /**
       * The player's Delta Works mix PREFERENCE — the steel share they dialed
       * (bumpers). The EFFECTIVE steel is this clamped to the live
       * [minSteelForSpend, maxSteelForSpend] range (see `mixSteel`), so a
       * destination/cost change re-clamps without spending anything silently,
       * and 0 keeps the energy-first default (steel covers only the deficit).
       */
      steelPreference: 0,
      /** Re-keys the payment panel's one-shot pulse on each dial press. */
      mixFlashNonce: 0,
      /** Where the cursor stood when the payment substep opened — B restores
       *  it, so the walk back lands where the walk in left. */
      paymentReturnFocus: 'track' as HydroSceneFocus,
      /** Scene focus. The DECISION RAIL's nodes are data-driven
       *  (`rail:<decision id>`); `track`/`cta` are the plan scene's own stops,
       *  `bonus-*` the offer scene's. One spatial order, one graph. */
      sceneFocus: 'track' as HydroSceneFocus,
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
      pickWarned: false,
      /** The bonus answer is in flight — both CTAs are inert until the server replies. */
      bonusSubmitting: false,
      /** The reward picker's focused option (pos 1/2). */
      choiceFocus: 0,
      /** Where the cursor stands INSIDE the reward step: on the options, or
       *  on the commit that follows them (the step confirms itself). */
      choiceStage: 'options' as 'options' | 'confirm',
      /** The cursor stands on the OPTIONAL REFUSAL beneath the step's commit
       *  (a server-framed offer only) — one more ↓ past the confirm. */
      choiceSkipFocus: false,
      /** The player has moved the cursor BY HAND inside the current decision
       *  revision — that revision never re-seats them again (state-driven
       *  focus, not a watcher that keeps calling `.focus()`). */
      focusMoved: false,
      /** The next `pickDecisionKey` change is the player's OWN track walk —
       *  armed inside `selectPosition` (past its no-op guard, so a clamped
       *  walk can never leave it latched), consumed by the watcher's flush,
       *  so an external revision can never ride it. */
      selfKeyChange: false,
      /** The deck-pick flow, mirrored for reactivity (module reactive). */
      flowDeck: deckPickState,
      /** The target step's cursor (pos 9). */
      targetFocus: undefined as PlayedTargetFocus | undefined,
      targetZoneW: 0,
      targetZoneH: 0,
      /**
       * THE CURSOR'S INITIAL SEAT IS OWED, not decided at setup.
       *
       * «Does this stage owe a pick?» is answered by the track PREVIEW, and the
       * preview is fetched in `mounted()` — so at setup the answer is always
       * «no» and the cursor parked on a confirm that cannot fire, beside a
       * pre-select row nobody was pointed at. The seat is therefore CLAIMED
       * here and applied by the first frame that can actually answer.
       */
      seatOwed: false,
      /** One-shot: the ceremony has been started for this commit. */
      cereStarted: false,
      cereHandle: undefined as HydroCeremonyHandle | undefined,
    };
  },
  computed: {
    markerGliding(): boolean {
      return this.hydroMarkerState.active;
    },
    markerFrom(): number {
      return this.hydroMarkerState.fromPosition;
    },
    markerSettled(): number {
      return this.hydroMarkerState.settledPosition;
    },
    viewerColor(): Color {
      return this.playerView.thisPlayer.color;
    },
    preview(): DeltaTrackPreviewModel | undefined {
      return hydroNetworkState.previewColor === this.viewerColor ? hydroNetworkState.preview : undefined;
    },
    rewardChoice(): number | undefined {
      return hydroNetworkState.rewardChoice;
    },
    model(): HydroModel {
      const players = this.playerView.players.map((p) => ({
        color: p.color,
        name: p.name,
        position: p.deltaProject?.position ?? 0,
        isViewer: p.color === this.viewerColor,
        isMarsBot: p.isMarsBot === true,
        stops: p.deltaProject?.stops ?? [],
      }));
      return buildHydroModel({
        preview: this.preview,
        players,
        viewerColor: this.viewerColor,
        selectedPosition: hydroNetworkState.selectedPosition,
        rewardChoice: hydroNetworkState.rewardChoice,
        selectedCard: hydroNetworkState.selectedCard,
        actionAvailable: this.actionAvailable,
      });
    },
    snapshot(): HydroPlayerSnapshot {
      const p = this.playerView.thisPlayer;
      return {
        steel: p.steel, plants: p.plants, titanium: p.titanium, energy: p.energy, heat: p.heat, megacredits: p.megacredits,
        prod: {
          megacredits: p.megacreditProduction, steel: p.steelProduction, titanium: p.titaniumProduction,
          plants: p.plantProduction, energy: p.energyProduction, heat: p.heatProduction,
        },
        plantTags: p.tags[Tag.PLANT] ?? 0,
        jovianTags: p.tags[Tag.JOVIAN] ?? 0,
      };
    },
    /** Candidate cards for the pos 7/9 pick (name + live animal count). */
    eligibleCards(): ReadonlyArray<{name: CardName; current?: number}> {
      const names = this.model.eligibleCardNames;
      if (names.length === 0) {
        return [];
      }
      const byName = new Map(this.playerView.thisPlayer.tableau.map((c) => [c.name, c]));
      const animalMode = this.model.needsCardSelect === 'animal-target';
      return names.map((n) => animalMode ? {name: n, current: byName.get(n)?.resources ?? 0} : {name: n});
    },
    selectedAnimalCurrent(): number | undefined {
      if (this.model.needsCardSelect !== 'animal-target' || this.model.selectedCard === undefined) {
        return undefined;
      }
      return this.eligibleCards.find((c) => c.name === this.model.selectedCard)?.current;
    },
    /** The COMPOSED stage-7 repeat pick, honoured only while its chosen card
     *  still matches the plan's card. */
    chosenRepeat(): ConsoleRepeatPickResult | undefined {
      const r = consoleHydroUi.repeatResult;
      return r !== undefined && r.chosenCard === this.model.selectedCard ? r : undefined;
    },
    repeatNode(): GroupNode | undefined {
      const r = this.chosenRepeat;
      if (r === undefined) {
        return undefined;
      }
      const group = playerActionGroups([{name: r.chosenCard} as CardModel])[0];
      const node = group?.nodes[r.nodeIndex] ?? group?.nodes[0];
      return node !== undefined ? stripNodeOr(node) : undefined;
    },
    rewardView(): HydroRewardView {
      return buildRewardView({
        stage: this.model.targetStage,
        snapshot: this.snapshot,
        rewardChoice: this.rewardChoice,
        animalTargetCurrent: this.selectedAnimalCurrent,
        animalTargetCardName: this.model.selectedCard,
      });
    },
    reasons(): ReadonlyArray<HydroReason> {
      return hydroPlanReasons({
        model: this.model,
        preview: this.preview,
        actionAvailable: this.actionAvailable,
        turnState: this.turnState,
        rewardChoice: this.rewardChoice,
        occupantName: this.occupantName,
      });
    },
    turnState(): HydroTurnState {
      const wf = this.playerView.waitingFor;
      return hydroTurnStateOf({
        waiting: wf !== undefined,
        actionMenu: wf?.type === 'or' && ACTION_MENU_TITLES.has(titleText(wf.title)),
        // The prompt on the wire is THIS screen's own — the player is standing
        // where it sent them, not busy somewhere else.
        ownsPrompt: this.ownsPrompt,
      });
    },
    /**
     * The WINNING blocker of the selected plan — a real Delta-track rule
     * outranks the turn gate, so «Сейчас не ваш ход» can never mask «не хватает
     * энергии». `undefined` = nothing blocks the advance.
     */
    planBlocker(): AvailabilityBlocker | undefined {
      return hydroPrimaryBlocker(this.reasons);
    },
    requirementsUnmet(): boolean {
      return this.reasons.some((r) => REQUIREMENT_REASON_KINDS.has(r.kind));
    },
    ctaReasons(): ReadonlyArray<HydroReason> {
      // The choose-* to-dos are the CTA itself now (its label IS the next
      // step), so listing them again under it would be a duplicate.
      return this.reasons.filter((r) =>
        !REQUIREMENT_REASON_KINDS.has(r.kind) && r.kind !== 'choose-bonus' && r.kind !== 'choose-card');
    },
    occupantName(): string | undefined {
      const pos = this.model.selectedPosition;
      const occupant = this.playerView.players.find((p) =>
        p.color !== this.viewerColor && (p.deltaProject?.position ?? 0) === pos);
      return occupant !== undefined ? participantDisplayName(occupant) : undefined;
    },
    globallyActable(): boolean {
      return this.actionAvailable && !this.model.usedThisGeneration && this.preview !== undefined;
    },
    statusKind(): 'ready' | 'used' | 'waiting' | 'end' | 'busy' | 'offer' | 'blocked' {
      // A prompt this workspace OWNS outranks every other status: the chip
      // must describe the screen the player is looking at, and «уже
      // использовано в этом поколении» over a live bonus offer is the whole
      // header contradicting the whole scene. (The bonus move is precisely
      // the one that does NOT spend the generation.)
      if (this.advanceOffer !== undefined || this.turnState === 'own-prompt') {
        return 'offer';
      }
      if (this.model.usedThisGeneration) {
        return 'used';
      }
      if (this.model.atEndOfTrack) {
        return 'end';
      }
      if (this.actionAvailable) {
        return 'ready';
      }
      switch (this.turnState) {
      case 'not-your-turn': return 'waiting';
      case 'busy': return 'busy';
      default: return 'blocked';
      }
    },
    statusLabel(): string {
      switch (this.statusKind) {
      case 'used': return 'Already used this generation';
      case 'end': return 'End of the track reached';
      case 'waiting': return 'Not your turn';
      // ⚠️ NEVER reachable from a prompt this screen serves — that was the
      // false «Сначала завершите текущее действие» printed over the very
      // decision it was telling the player to go and finish.
      case 'busy': return 'Finish your current action first';
      case 'offer': return this.offerOrigin === 'card-entry' ? 'Extra advance offered' : 'Bonus step offered';
      case 'blocked': return 'Unavailable right now';
      default: return 'Reinforcement available';
      }
    },
    stops(): ReadonlyArray<RailStop> {
      return this.model.stages.map((vm): RailStop => {
        const d = destinationAt(this.preview, vm.position);
        const grade = d !== undefined ? gradeDestination(d) : undefined;
        let gradeGlyph = '';
        if (vm.position > this.model.currentPosition && grade !== undefined) {
          gradeGlyph = grade === 'blocked' ? '✕' : grade === 'occupied' ? '⛔' : grade === 'needs-energy' ? '⚡' : '';
        }
        const linkKind: RailStop['linkKind'] =
          vm.position <= this.model.currentPosition ? 'done' :
            (vm.state === 'route' || vm.state === 'target') ? 'route' : 'dim';
        return {position: vm.position, vm, grade, gradeGlyph, linkKind};
      });
    },
    selectedStage(): HydroStage {
      return this.model.stages[this.model.selectedPosition].stage;
    },
    stageOfText(): string {
      return translateTextWithParams('Stage ${0} of ${1}', [String(this.model.selectedPosition), '11']);
    },
    stageBadge(): {kind: string; text: string} {
      if (this.model.mode === 'plan') {
        const blocking = this.reasons.some((r) => r.blocking);
        if (this.model.canConfirm) {
          return {kind: 'ready', text: $t('Available now')};
        }
        if (!blocking && this.reasons.length > 0) {
          return {kind: 'todo', text: $t('Selection is required')};
        }
        // ONLY the turn stands in the way → the stage is legal and merely out
        // of reach this moment. «Сейчас недоступно» in red would be a verdict
        // on a stage whose every requirement is met (the ✓ ticks are right
        // above it) — the calm «НЕ СЕЙЧАС» is the honest state.
        if (this.planBlocker?.tone === 'warning') {
          return {kind: 'notnow', text: $t('Not now')};
        }
        return {kind: 'blocked', text: $t('Unavailable right now')};
      }
      const pos = this.model.selectedPosition;
      if (pos === this.model.currentPosition) {
        return {kind: 'current', text: $t('Current position')};
      }
      const vmStop = this.model.stages[pos];
      if (vmStop.rewardedByViewer) {
        return {kind: 'built', text: $t('Took the reward')};
      }
      if (vmStop.skippedByViewer) {
        return {kind: 'passed', text: $t('Passed through — no reward')};
      }
      return {kind: 'passed', text: $t('Track start')};
    },
    requiredTags(): ReadonlyArray<Tag> {
      return (this.model.destination?.requiredTags ?? []) as ReadonlyArray<Tag>;
    },
    jumpedOverVp2(): boolean {
      return this.model.destination?.jumpedOverVp2 === true;
    },
    startSelected(): boolean {
      return this.model.mode === 'details' && this.model.selectedPosition === 0;
    },
    detailsStatusText(): string {
      switch (this.model.viewerStatusAtDetails) {
      case 'current': return $t('Here now');
      case 'rewarded': return $t('Took the reward');
      case 'passed': return $t(this.startSelected ? 'Advanced through' : 'Passed through — no reward');
      default: return $t('Not reached yet');
      }
    },
    fizzleNote(): string {
      if (this.model.needsCardSelect === undefined || this.model.eligibleCardNames.length > 0) {
        return '';
      }
      return this.model.needsCardSelect === 'reuse-action' ?
        'No used actions to repeat' : 'No card can receive the animals';
    },

    // ── the FLOW ────────────────────────────────────────────────────────────
    commitRec(): HydroCommitRecord {
      // Only read by the commit/result layers, which render iff it stands.
      return this.flow.commit as HydroCommitRecord;
    },
    sceneKey(): SceneKey {
      // The WORKING ZONE's states are mutually exclusive by construction, and
      // their precedence is the pure module's contract — what is already
      // RUNNING outranks what is merely offered, so a second ocean's offer can
      // never paint over the move in flight.
      const c = this.flow.commit;
      const zone = hydroZoneState({
        offerLive: this.advanceOffer !== undefined,
        committing: c !== undefined && c.phase !== 'result',
        resolving: c?.phase === 'result',
      });
      if (zone === 'resolving') {
        return 'result';
      }
      if (zone === 'committing') {
        return 'commit';
      }
      // The reward step is HOW the offer is answered, not a competing state:
      // it is opened by the offer's own confirm and submits the whole move as
      // one batch. So it outranks the offer while it stands.
      if (this.flow.step === 'reward') {
        return 'choice';
      }
      if (this.flow.step === 'target') {
        return 'target';
      }
      // The COMPOSITION step — the plan's confirm routed here because the
      // server model admits more than one energy/steel mix. Same substep
      // family as the pre-selects: state-driven, B walks back to the plan.
      if (this.flow.step === 'payment') {
        return 'payment';
      }
      if (zone === 'bonus-offer') {
        return 'bonus';
      }
      return 'preview';
    },
    /** Which action-column body stands — the crossfade key. `quiet` is a
     *  substate whose verbs live on the ONE bottom bar (the commit beat, the
     *  target grid): the column stands as composed air, never unmounts. */
    actKey(): string {
      switch (this.sceneKey) {
      case 'preview': return this.model.mode === 'plan' ? 'plan' : 'details';
      case 'choice': return 'choice';
      case 'payment': return 'payment';
      case 'bonus': return 'bonus';
      case 'commit':
      case 'target': return 'quiet';
      default: return 'result';
      }
    },
    /** The context column — see {@link HydroCtxView}. */
    ctxView(): HydroCtxView {
      const c = this.flow.commit;
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
        const stage = HYDRO_STAGES[c.toPosition];
        return {
          kind: 'stage', tag: stage?.tag, vp: stage?.vp,
          nameKey: c.stageNameKey,
          posText: translateTextWithParams('Stage ${0} of ${1}', [String(c.toPosition), '11']),
          badge, route,
        };
      }
      const offer = this.advanceOffer;
      if (offer !== undefined) {
        return {
          kind: 'source', source: offer.source,
          route: {
            from: offer.fromPosition, to: offer.toPosition,
            energy: offer.energyCost, steel: 0, free: offer.energyCost === 0,
          },
        };
      }
      const s = this.selectedStage;
      return {
        kind: 'stage', tag: s.tag, vp: s.vp, nameKey: s.nameKey,
        posText: this.stageOfText,
        badge: this.stageBadge,
        route: this.model.mode === 'plan' ? {
          from: this.model.currentPosition, to: this.model.selectedPosition,
          energy: this.model.selectedSpend, steel: 0, free: false,
        } : undefined,
      };
    },
    /** The ctx source card in the console's ONE source-view shape. */
    ctxSourceView(): ReturnType<typeof choiceSourceView> {
      const card = this.ctxView.source;
      return card === undefined ? undefined : choiceSourceView({kind: 'card', card});
    },
    /** The movement plan's DECISIONS — today always length 1 (this stage's
     *  binary reward); the strip renders whatever the list holds. */
    planDecisions(): ReadonlyArray<HydroPlanDecision> {
      const stage = this.choiceStageModel;
      if (stage === undefined) {
        return [];
      }
      const pos = this.advanceOffer?.toPosition ?? this.model.selectedPosition;
      return [{
        id: 'reward:' + pos,
        stagePosition: pos,
        stageNameKey: stage.nameKey,
        options: this.choiceOptions,
        chosen: this.rewardChoice,
      }];
    },
    /** The chosen stage reward, kept visible through the payment substep —
     *  the walk into the composition may not orphan the choice it pays for. */
    paymentChosenReward(): HydroStage['rewardOptions'][number] | undefined {
      if (!this.model.targetNeedsChoice || this.rewardChoice === undefined) {
        return undefined;
      }
      return this.selectedStage.rewardOptions[this.rewardChoice];
    },
    /** The skipped-reward POLICY, compact: a count, never the raw roster. */
    skippedSummary(): string {
      return translateTextWithParams('Intermediate rewards are skipped · ${0}',
        [String(this.model.skippedStages.length)]);
    },
    resultSkippedText(): string {
      return translateTextWithParams('Intermediate rewards are skipped · ${0}',
        [String(this.commitRec.skippedCount ?? 0)]);
    },
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
    advanceOffer(): DeltaAdvanceOffer | undefined {
      return this.bonusOffer ?? this.cardOffer;
    },
    /** How the player got here — the ONE axis the scene branches on. */
    offerOrigin(): DeltaOfferOrigin | undefined {
      if (this.bonusOffer !== undefined) {
        return 'prompt';
      }
      return this.cardOffer !== undefined ? 'card-entry' : undefined;
    },
    /** Is there a refusal to offer at all? Only a standing prompt has one. */
    bonusSkipOffered(): boolean {
      return this.offerOrigin === 'prompt';
    },
    /** The offer's copy — i18n KEYS from the pure module, never coined here. */
    bonusCopy(): ReturnType<typeof hydroAdvanceCopy> {
      return hydroAdvanceCopy(this.advanceOffer ?? {
        source: CardName.DELTA_PROJECT, steps: 1, fromPosition: 0, toPosition: 1,
        energyCost: 0, waivesTag: false,
      }, this.offerOrigin ?? 'prompt');
    },
    /** The body sentence with the source card's TRANSLATED name folded in. */
    bonusBodyText(): string {
      return translateTextWithParams(this.bonusCopy.bodyKey,
        this.bonusCopy.bodyParams.map((n) => translateCardName(n as CardName)));
    },
    /** The stage name the zone hands UP to the crumb (it never draws one). */
    bonusStageKey(): string {
      return this.advanceOffer === undefined ? '' : this.bonusCopy.stageKey;
    },
    /** The offer's IDENTITY — a new offer is a new decision. */
    bonusIdentity(): string {
      const o = this.advanceOffer;
      return o === undefined ? '' : [this.offerOrigin, o.source, o.fromPosition, o.toPosition, o.energyCost].join('|');
    },
    /** The landing stage itself — the ONE object the facts are read from. */
    bonusStage(): HydroStage | undefined {
      return this.advanceOffer === undefined ? undefined : HYDRO_STAGES[this.advanceOffer.toPosition];
    },
    /**
     * THE PRICE as a «сейчас → станет» line, not a bare chip. The server's own
     * `energyCost` (0 for a plain bonus step, 1 for the tag waiver) against the
     * viewer's live stock — the same shape `buildRewardView` produces, so it
     * renders through the very same row.
     */
    bonusCostLine(): HydroDeltaLine | undefined {
      const cost = this.advanceOffer?.energyCost ?? 0;
      if (cost <= 0) {
        return undefined;
      }
      const have = this.snapshot.energy;
      return {resource: Resource.ENERGY, labelKey: 'Energy', before: have, after: have - cost, delta: -cost};
    },
    /** The landing stage's reward ALTERNATIVES (two ⇒ the pick is a step). */
    bonusRewardOptions(): HydroStage['rewardOptions'] {
      return this.bonusNeedsReward ? (this.bonusStage?.rewardOptions ?? []) : [];
    },
    /** Has the landing stage anything to state as a gain? */
    bonusGainPresent(): boolean {
      if (this.bonusNeedsReward) {
        return true; // the two alternatives are the statement
      }
      const v = this.bonusRewardView;
      return v.lines.length > 0 || v.rawChips.length > 0 || v.vp !== undefined;
    },
    /** The optional refusal is reachable INSIDE the reward step too — the
     *  rules still allow declining until the commit (a server-framed offer
     *  only; a card entry's way out is B). */
    choiceSkipOffered(): boolean {
      return this.advanceOffer !== undefined && this.bonusSkipOffered;
    },
    /** Does the offer's LANDING stage ask which reward to take (pos 1/2)? */
    bonusNeedsReward(): boolean {
      const offer = this.advanceOffer;
      if (offer === undefined) {
        return false;
      }
      const stage = HYDRO_STAGES[offer.toPosition];
      return stage !== undefined && hydroStageNeedsChoice(stage);
    },
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
    bonusNeedsCard(): boolean {
      return this.advanceOffer !== undefined && this.model.mustSelectCard;
    },
    /** …and it has not been made yet. */
    bonusPickMissing(): boolean {
      return this.bonusNeedsCard && this.model.selectedCard === undefined;
    },
    /**
     * THE PICK ROW'S IDENTITY — which question the landed stage asks, or
     * undefined when it asks none. ONE derivation for both scenes.
     */
    pickKind(): HydroPickKind | undefined {
      const k = this.model.needsCardSelect;
      return k === 'reuse-action' || k === 'animal-target' ? k : undefined;
    },
    /** The stage asks, but the SERVER offered no candidate — the reward simply
     *  fizzles. Nothing is owed, so nothing may warn about it. */
    pickFizzled(): boolean {
      return this.pickKind !== undefined && !this.model.mustSelectCard;
    },
    /** WHAT IS MISSING, named — AND what the second press will do with it.
     *  Never a bare «нельзя», and never an instruction the player cannot follow
     *  (a fizzled stage has nothing to choose). The two doors that CAN carry a
     *  waive promise a forfeit; the prompt door, which cannot, promises the
     *  postponed question it will actually raise. */
    pickWarningKey(): string {
      if (this.pickKind === undefined) {
        return '';
      }
      const copy = HYDRO_PICK_COPY[this.pickKind];
      return this.offerOrigin === 'prompt' ? copy.warn : copy.warnWaive;
    },
    /** The forfeit, named on the RESULT stage — a declined reward may never
     *  read as a silent nothing (the console-wide «no silent loss»). Keyed on
     *  the COMMIT's own landing, never on the live model, which has moved on. */
    waivedNoteKey(): string {
      const c = this.flow.commit;
      if (c === undefined) {
        return '';
      }
      return c.toPosition === 7 ? 'Action copy declined' : 'Animal placement declined';
    },
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
    bonusPrimary(): {verb: HydroNextInteraction, label: string, pending: boolean} {
      const verb = hydroNextInteraction({
        needsChoice: this.bonusNeedsReward,
        choiceMade: this.rewardChoice !== undefined,
      });
      return {verb, label: HYDRO_PRIMARY_KEY[verb], pending: verb === 'reinforce' && this.bonusPickMissing};
    },
    /**
     * THE CARD SCENE OWNS THE FRAME. While the landed stage's embedded deck
     * pick is live inside this workspace, the cards are the undisputed primary
     * content: the identity/action columns and the commit line dissolve, the
     * embed zone takes the whole surface, and everything returns when the
     * selection is over. Keyed on the deck-pick flow's own phase — never on a
     * mount or a visibility flag.
     */
    immersive(): boolean {
      return this.flowDeck.phase !== 'idle' &&
        this.flow.commit !== undefined &&
        workspaceOutcomeState.host === 'hydro';
    },
    bonusConfirmLabel(): string {
      if (railIdOf(this.sceneFocus) !== undefined) {
        return this.pickVerbKey;
      }
      if (this.sceneFocus === 'bonus-source') {
        return 'Inspect';
      }
      return this.sceneFocus === 'bonus-skip' ? this.bonusCopy.skipKey : this.bonusPrimary.label;
    },
    /** The verb the ONE command bar shows while the cursor is on the row. */
    pickVerbKey(): string {
      if (this.pickKind === undefined) {
        return '';
      }
      const copy = HYDRO_PICK_COPY[this.pickKind];
      return this.model.selectedCard === undefined ? copy.choose : copy.change;
    },
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
    planPickOffered(): boolean {
      return this.advanceOffer === undefined && this.model.mode === 'plan' &&
        this.pickKind !== undefined && !hydroRuleBlocked(this.reasons);
    },
    /** The PLAYER'S OWN advance is missing the landed stage's pick. Same
     *  omission, same warning — asked of the plan layer rather than the offer. */
    planPickMissing(): boolean {
      return this.planPickOffered && this.model.mustSelectCard && this.model.selectedCard === undefined;
    },
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
    waiveTargetNow(): boolean {
      return this.model.mustSelectCard && this.model.selectedCard === undefined;
    },
    /** Is the offer answerable right now (not already submitted)? */
    bonusAnswerable(): boolean {
      return this.advanceOffer !== undefined && !this.bonusSubmitting;
    },
    /**
     * THE LANDING STAGE'S REWARD, in the SAME view the standard advance builds
     * its own from — so the commit record, the reward wave and the result stage
     * of a bonus move are assembled by one function, not by a second, similar
     * one. (That was the whole defect: the bonus path had no reward view, so it
     * had no transfers, so nothing flew and the workspace had nothing to wait
     * for and closed on the spot.)
     */
    bonusRewardView(): HydroRewardView {
      return buildRewardView({
        stage: this.advanceOffer === undefined ? undefined : HYDRO_STAGES[this.advanceOffer.toPosition],
        snapshot: this.snapshot,
        rewardChoice: this.rewardChoice,
        // …including the pos-9 target, so the facts row states the animals'
        // own «сейчас → станет» the moment the card is picked — identical to
        // what the plan panel shows for the player's own advance.
        animalTargetCurrent: this.selectedAnimalCurrent,
        animalTargetCardName: this.model.selectedCard,
      });
    },
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
    backVerb(): WorkspaceBackVerb {
      return backVerbWithOwedPrompt(hydroWorkspacePhase(this.followUpLive), this.ownsPrompt);
    },
    backLabel(): string | undefined {
      // A card ENTRY is one logical level inside «ДЕЙСТВИЯ КАРТ», and B walks
      // back onto the variant the player chose — never «закрыть», which would
      // describe leaving a workspace they did not open.
      if (this.offerOrigin === 'card-entry' && this.backVerb === 'close') {
        return 'Back to the action';
      }
      return backLabelForVerb(this.backVerb);
    },
    flowKind(): string {
      return hydroWorkspacePhase(this.followUpLive);
    },
    ceremonyDim(): boolean {
      return this.flow.ceremonyActive;
    },
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
    railDecisions(): Array<HydroRailDecision> {
      const offer = this.advanceOffer !== undefined;
      return buildHydroDecisions({
        offered: offer ?
          (this.pickKind !== undefined && (this.bonusNeedsCard || this.pickFizzled)) :
          this.planPickOffered,
        kind: this.pickKind,
        mustSelectCard: this.model.mustSelectCard,
        chosen: this.model.selectedCard,
        // The prompt door postpones instead of waiving — its decision is not
        // optional in the rail sense (the server will re-ask).
        optional: this.offerOrigin !== 'prompt',
      });
    },
    /** The rail decision the cursor stands on (undefined off the rail). */
    railFocusedDecision(): HydroRailDecision | undefined {
      const id = railIdOf(this.sceneFocus);
      return id === undefined ? undefined : this.railDecisions.find((d) => d.id === id);
    },
    /** Does the rail hold any FOCUSABLE decision (the ↑/↓ hint's gate)? */
    railHasDecisions(): boolean {
      return this.railDecisions.some((d) => d.state !== 'unavailable');
    },
    /** What A means on the preview layer (the CTA and the bar agree). */
    primaryVerb(): 'reinforce' | 'choose-reward' | 'blocked' {
      const m = this.model;
      if (m.mode !== 'plan') {
        return 'blocked';
      }
      // A choice stage ALWAYS routes into its step — the commit lives there
      // (never «reinforce» out here off a reward the player configured in a
      // previous visit and cannot see).
      if (m.targetNeedsChoice && this.reasons.every((r) => !r.blocking)) {
        return 'choose-reward';
      }
      // ⚠️ The pos 7/9 PICK is NOT a CTA state. The row above owns that
      // question (and the cursor starts on it); relabelling the commit button
      // «Выбрать действие» made it a SECOND picker opener — and, with the
      // pick also gating the commit, left no way to advance at all.
      return m.canConfirm ? 'reinforce' : 'blocked';
    },
    primaryLabel(): string {
      if (this.primaryVerb === 'choose-reward') {
        return 'Choose a reward';
      }
      // With several valid mixes the plan's confirm is a GATEWAY, not the
      // final commit — the label must not promise a reinforce it will not
      // perform. The final verb lives on the payment substep.
      return this.mixAdjustable ? 'Continue to payment' : 'Reinforce the hydronetwork';
    },
    /** The reward step's commit verb: a GATEWAY while several mixes exist on
     *  the player's own advance (a card-granted move pays its energy toll and
     *  never mixes, so its verb stays final). */
    choiceCommitLabel(): string {
      return this.advanceOffer === undefined && this.mixAdjustable ?
        'Continue to payment' : 'Reinforce the hydronetwork';
    },
    /** Is the COMMIT what A would press right now? On the plan layer the cursor
     *  stands either on a rail decision or on everything else (track/cta), and
     *  only the focused affordance may wear the cap (the quick wheel's rule). */
    ctaFocused(): boolean {
      return railIdOf(this.sceneFocus) === undefined;
    },
    commitCaption(): string {
      const c = this.flow.commit;
      if (c === undefined) {
        return '';
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
    },
    /** The frame hosting this one, or undefined when the track IS the root. */
    crumbHost(): WorkspaceFrameKind | undefined {
      return workspaceFrameHost('hydro');
    },
    crumbRoot(): string {
      return this.crumbHost === undefined ? 'Mars Hydronetwork' : workspaceFrameRoot(this.crumbHost);
    },
    crumbEmblem(): {emblem?: string, wheelAnchor?: string} {
      return workspaceFrameEmblem(this.crumbHost ?? 'hydro');
    },
    /**
     * THE SUBJECT THE HEADER DRAWS — the DEEPEST carried object of the whole
     * stack, which for a hosted step is the host's (the card the player is
     * acting with). Published separately from {@link crumbSubject}, which is
     * what this FRAME contributes to that same stack: a hosted step
     * contributes nothing, so the card never restarts.
     */
    headSubject(): string {
      return this.crumbHost === undefined ?
        this.crumbSubject :
        (workspaceStackCrumb()?.subject?.text ?? '');
    },
    crumbSubject(): string {
      // HOSTED: the SUBJECT belongs to the host (the card the player is
      // acting with) and must never restart. What this screen would have
      // called a subject is a STAGE of that card's flow, and `crumbStage`
      // already says it.
      if (this.crumbHost !== undefined) {
        return '';
      }
      const c = this.flow.commit;
      if (c !== undefined) {
        return c.stageNameKey;
      }
      if (this.flow.step !== undefined || this.flow.repeatBridge) {
        return this.model.targetStage?.nameKey ?? '';
      }
      return '';
    },
    crumbStage(): string {
      // The offer NEVER titles itself inside the frame — the crumb's tail is
      // where it names itself, so the workspace name and the source stay put
      // and only the stage segment advances.
      if (this.sceneKey === 'bonus') {
        return this.bonusStageKey;
      }
      const c = this.flow.commit;
      if (c !== undefined) {
        if (c.phase === 'result') {
          return 'Result';
        }
        if (c.phase === 'moving') {
          return 'Movement';
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
      switch (this.flow.step) {
      case 'reward': return 'Reward choice';
      case 'target': return 'Target card';
      // The composition substep names itself in the crumb tail exactly as its
      // sibling steps do — «ГИДРОСЕТЬ МАРСА › <этап> › ОПЛАТА». A step whose
      // tail stayed empty read as the header losing the walk.
      case 'payment': return 'Payment';
      default: return this.flow.repeatBridge ? 'Repeat action' : '';
      }
    },
    crumbCommitted(): boolean {
      return this.flow.commit !== undefined;
    },

    // ── the reward CHOICE layer (pos 1/2) ──────────────────────────────────
    /** Each option carries its OWN honest delta (`line`) — the one object the
     *  card renders. `chips` stays as the fallback for a reward with no
     *  concrete reading. */
    /** The stage the reward step is about: the OFFER's landing stage while one
     *  is live, else the player's own planned target. */
    choiceStageModel(): HydroStage | undefined {
      const offer = this.advanceOffer;
      return offer !== undefined ? HYDRO_STAGES[offer.toPosition] : this.model.targetStage;
    },
    choiceOptions(): ReadonlyArray<{
      chips: HydroStage['rewardOptions'][number],
      line: HydroDeltaLine | undefined,
    }> {
      const stage = this.choiceStageModel;
      if (stage === undefined) {
        return [];
      }
      return stage.rewardOptions.map((chips, i) => ({
        chips,
        line: buildRewardView({stage, snapshot: this.snapshot, rewardChoice: i}).lines[0],
      }));
    },

    // ── the TARGET step (pos 9) ────────────────────────────────────────────
    targetStepModel(): PlayedTargetModel | undefined {
      if (this.model.needsCardSelect !== 'animal-target' || this.model.eligibleCardNames.length === 0) {
        return undefined;
      }
      return buildHydroTargetModel({
        eligible: this.model.eligibleCardNames,
        tableau: this.playerView.thisPlayer.tableau,
        players: this.playerView.players.map((p) => ({name: p.name, color: p.color, tableau: p.tableau})),
        viewerColor: this.viewerColor,
        ask: translateText('Choose a card to receive the animals'),
        typeOf: (name) => getCard(name)?.type,
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetStepModel?.owners ?? [],
        availW: this.targetZoneW > 0 ? this.targetZoneW : 900,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    targetBandH(): number {
      return Math.max(0, this.targetZoneH);
    },
    targetLockedCard(): string {
      return this.model.selectedCard ?? '';
    },

    // ── the COMMIT scene (pos 9 presented target) ──────────────────────────
    presentedTargetCard(): CardName | undefined {
      const c = this.flow.commit;
      if (c === undefined || c.phase === 'result' || c.kind !== 'card-resource') {
        return undefined;
      }
      return c.selectedCard;
    },
    presentedLanded(): number {
      const card = this.presentedTargetCard;
      return card !== undefined ? (this.landings.by[card] ?? 0) : 0;
    },
    presentedModel(): CardModel {
      const c = this.flow.commit;
      const card = this.presentedTargetCard as CardName;
      const live = this.playerView.thisPlayer.tableau.find((t) => t.name === card);
      return hydroPresentedTargetModel(card, c?.targetBefore ?? 0, live, this.presentedLanded);
    },

    /** The command contract of the current step — published to the shell. */
    // ── Delta Works payment mix (steel 1:1 for energy) ────────────────────
    /** The substitution is live (the card in the tableau, steel on hand). */
    mixRowVisible(): boolean {
      return this.model.mode === 'plan' && this.model.selectedSpend > 0 &&
        this.model.availableSteelSubstitute > 0;
    },
    /** More than one valid mix — the bumpers become a dial; else a summary. */
    mixAdjustable(): boolean {
      return this.mixRowVisible && this.model.maxSteelForSpend > this.model.minSteelForSpend;
    },
    /** The EFFECTIVE steel share — THE canonical draft value. The preference
     *  is clamped by the ONE shared rule (never a private copy of the bounds
     *  arithmetic); the panel, the command bar, the commit record and the
     *  submit payload all read THIS number. */
    mixSteel(): number {
      if (!this.mixRowVisible) {
        return 0;
      }
      return clampEnergyMixSteel(this.steelPreference,
        {minSteel: this.model.minSteelForSpend, maxSteel: this.model.maxSteelForSpend});
    },
    /** The whole payment as the SHARED PaymentView — the same rows / captions /
     *  verdict grammar the card-play selector renders, over the same draft. */
    mixPaymentView(): PaymentView {
      return buildEnergyMixView({
        cost: this.model.selectedSpend,
        energyAvailable: this.model.availableEnergy,
        steelAvailable: this.model.availableSteelSubstitute,
        minSteel: this.model.minSteelForSpend,
        maxSteel: this.model.maxSteelForSpend,
        steelUsed: this.mixSteel,
      });
    },
    /** The substitution's source card (English name IS the i18n key) — the
     *  panel's secondary badge, present only while the mix is live. */
    mixSourceCard(): string | undefined {
      return this.mixRowVisible ? this.model.steelSubstituteCard : undefined;
    },
    footCommands(): ReadonlyArray<ConsoleCommand> {
      const c = this.flow.commit;
      if (c !== undefined) {
        if (c.phase === 'result') {
          return [{control: 'confirm', label: 'Continue'}];
        }
        if (this.followUpLive) {
          // The embedded follow-up surface publishes its own contract; the
          // shell's ladder routes there — this slot stays honest and empty
          // except the collapse verb.
          return [{control: 'back', label: 'Minimize'}];
        }
        return [{control: 'confirm', label: 'Executing', enabled: false}];
      }
      if (this.flow.step === 'reward') {
        // The step confirms ITSELF: A on an option arms the commit right
        // under it, A again reinforces. ↑ (or ←/→) goes back to the options
        // — a change of mind never leaves the step either. The bar follows
        // the cursor onto the optional refusal, exactly as the offer's does.
        if (this.choiceStage === 'confirm') {
          return [
            {control: 'dpadU', control2: 'dpadD', label: 'Change selection', priority: 2},
            {control: 'confirm', label: this.choiceSkipFocus ? this.bonusCopy.skipKey : this.choiceCommitLabel},
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
      if (this.flow.step === 'payment') {
        return [
          {control: 'bumperL', control2: 'bumperR', label: 'Payment mix', priority: 2},
          {control: 'confirm', label: 'Reinforce the hydronetwork'},
          {control: 'back', label: 'Back'},
        ];
      }
      if (this.sceneKey === 'bonus') {
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
          {control: 'confirm', label: this.bonusConfirmLabel, enabled: this.bonusAnswerable},
          {control: 'secondary', label: 'Inspect', enabled: this.bonusAnswerable},
          {control: 'back', label: this.backLabel ?? 'Minimize'},
        ];
      }
      if (this.flow.step === 'target') {
        const cmds: Array<ConsoleCommand> = [{control: 'dpad', label: 'Navigate', priority: 2}];
        if (this.targetLayout.mode === 'tabs' && (this.targetStepModel?.owners.length ?? 0) > 1) {
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
      if (this.railHasDecisions) {
        cmds.push({control: 'dpadU', control2: 'dpadD', label: 'Selection', priority: 3});
      }
      cmds.push({control: 'triggerR', label: 'Farthest stage'});
      // (No LB/RB mix hint on Configure — the dial belongs to the payment
      // substep; the CTA's own «Продолжить к оплате» names the way there.)
      if (this.model.mode === 'details') {
        cmds.push({control: 'confirm', label: 'Back to plan'});
      } else if (this.railFocusedDecision !== undefined) {
        // The decision's own verb — «Выбрать» while the question stands,
        // «Сменить» once it is answered. A generic «Изменить выбор» over an
        // unanswered row promises there is a selection to change.
        cmds.push({control: 'confirm', label: this.pickVerbKey, enabled: this.railFocusedDecision.state !== 'unavailable'});
      } else {
        cmds.push({control: 'confirm', label: this.primaryLabel, enabled: this.primaryVerb !== 'blocked'});
      }
      // «К полю» closes; under an OWED prompt the same press collapses instead
      // (the browse layer is standing over a live decision — see `backVerb`).
      cmds.push({control: 'back',
        label: this.backVerb === 'collapse' ? 'Minimize' :
          this.offerOrigin === 'card-entry' ? 'Back to the action' : 'To the board'});
      return cmds;
    },
    /**
     * The pre-select decision's IDENTITY: which door, which stage, which pick
     * kind, and whether it is currently ANSWERABLE. One derivation for every
     * pre-select family this track has (repeat action, animal target, and any
     * future stage decision of the same shape) — never a stage/card literal.
     */
    pickDecisionKey(): string {
      return [
        this.offerOrigin ?? 'plan',
        this.advanceOffer?.toPosition ?? this.model.selectedPosition,
        this.pickKind ?? '-',
        this.model.mustSelectCard ? 'open' : 'closed',
      ].join('|');
    },
    /** The draft's world-version fingerprint (for RESUME ≠ FRESH decisions). */
    draftFingerprint(): string {
      return [
        hydroNetworkState.selectedPosition,
        hydroNetworkState.rewardChoice,
        hydroNetworkState.selectedCard,
        consoleHydroUi.repeatResult?.chosenCard,
      ].join('|');
    },
  },
  watch: {
    cacheKey(): void {
      this.fetchPreview();
    },
    viewerColor(): void {
      this.fetchPreview();
    },
    /**
     * A NEW offer seats the cursor on its CONFIRM and clears the in-flight
     * latch. Keyed on the offer's identity, so a second ocean's offer arriving
     * after the first is answered starts clean — and the latch can never
     * survive into a state where both CTAs would stay dead.
     */
    bonusIdentity: {
      immediate: true,
      handler(now: string): void {
        this.bonusSubmitting = false;
        this.pickWarned = false;
        if (now !== '' && this.seatPlanOnOffer()) {
          // THE CURSOR STARTS ON THE QUESTION — but only the PREVIEW knows
          // whether there is one, so claim the seat and let the first frame
          // that can answer place it (`applyOwedSeat`).
          this.sceneFocus = 'bonus-confirm';
          this.seatOwed = true;
          this.applyOwedSeat();
        } else if (this.sceneFocus.startsWith('bonus-')) {
          this.sceneFocus = 'track';
        }
      },
    },
    /**
     * THE SERVER REFUSED — the move did not happen (`rollbackHydroCommit`), so
     * the answer's in-flight latch must die with it or BOTH answers stay inert
     * and the zone becomes a dead end. The falling edge of the commit record is
     * the ONE honest signal: a rejected batch and a network failure unwind
     * through the same battery.
     */
    'flow.commit'(now: unknown, prev: unknown): void {
      if (now === undefined && prev !== undefined && this.advanceOffer !== undefined) {
        this.bonusSubmitting = false;
      }
    },
    /** The preview landed (or the stage changed under it) — the owed seat can
     *  finally be placed. */
    pickKind(): void {
      this.applyOwedSeat();
    },
    'model.mustSelectCard'(): void {
      this.applyOwedSeat();
    },
    footCommands: {
      immediate: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        consoleHydroUi.commands = [...cmds];
      },
    },
    draftFingerprint(): void {
      if (this.flow.commit === undefined) {
        noteHydroDraftTouched(this.cacheKey);
      }
    },
    // The crumb mirrors onto the FRAME (the collapsed chip and every other
    // stack reader see the same tail the header draws).
    crumbSubject: {
      immediate: true,
      handler(subject: string): void {
        setWorkspaceFrameSubject('hydro', subject);
      },
    },
    crumbStage: {
      immediate: true,
      handler(stage: string): void {
        setWorkspaceFrameStage('hydro', stage);
      },
    },
    // THE EMBED ZONE — published while the commit scene stands. `flush:
    // 'post'`: the zone must exist before the teleport looks for it.
    sceneKey: {
      flush: 'post',
      handler(key: SceneKey, prev: SceneKey | undefined): void {
        if (key === 'commit') {
          this.publishEmbedZone();
        } else if (prev === 'commit') {
          this.retractEmbedZone();
        }
        if (key !== 'preview') {
          this.sceneFocus = 'track';
        }
      },
    },
    // The ceremony fires once the marker has LOCKED on the finish stop —
    // never concurrently with the glide.
    markerSettled(pos: number): void {
      this.maybeStartCeremony(pos);
    },
    'flow.commit.phase'(): void {
      this.maybeStartCeremony(this.markerSettled);
    },
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
    'flow.repeatBridge'(on: boolean): void {
      if (!on) {
        void this.$nextTick(() => {
          const root = this.$refs.rootEl as HTMLElement | undefined;
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
          playHydroBridgeReturn(root, this.reducedMotion === true);
        });
      }
    },
    // Stepping between stops RETUNES the standing panel body (a soft
    // dip-and-rise under the change) instead of hard-swapping its rows —
    // `overwrite: 'auto'` makes a held d-pad read as one continuous shimmer,
    // never a pile of restarts.
    'model.selectedPosition'(next: number, prev: number | undefined): void {
      if (prev !== undefined && next !== prev && this.sceneKey === 'preview') {
        this.retunePanel();
      }
    },
    // A stale pre-selected card silently left the model (the preview moved) —
    // tell the player instead of letting the CTA flip wordlessly.
    'model.selectedCard'(card: CardName | undefined, prev: CardName | undefined): void {
      // The warning describes a STATE, never a press, so it dies with the
      // state it named — a pick made (or dropped) re-arms the gate honestly.
      this.pickWarned = false;
      // AN ANSWER MOVES THE CURSOR ON: the resolved decision shows its
      // summary and the seat goes to the NEXT open decision in game order —
      // or to the final CTA when nothing is left open. Only when the cursor
      // was ON the rail (the return from the child selector); a player
      // standing elsewhere is never yanked. The press that confirmed the
      // child selector cannot land on the new seat: button intents exist
      // only on the press EDGE (pad edge-detect, `keyboardConsoleIntent`
      // drops key repeat), so the CTA takes a fresh, deliberate A.
      if (card !== undefined && prev === undefined) {
        const answered = this.railDecisions.find((d) => d.chosen === card) ?? this.railDecisions[0];
        if (answered !== undefined && railIdOf(this.sceneFocus) !== undefined) {
          this.seatRailFocus(nextRailFocus(this.railDecisions, answered.id));
        }
      }
      if (card === undefined && prev !== undefined &&
          hydroNetworkState.selectedCard === prev && this.flow.commit === undefined) {
        this.$emit('notice', translateText('The selected card is no longer available'));
        hydroNetworkState.selectedCard = undefined;
        consoleHydroUi.repeatResult = undefined;
      }
    },
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
    pickDecisionKey(now: string, prev: string | undefined): void {
      if (now === prev) {
        return;
      }
      if (this.selfKeyChange) {
        this.selfKeyChange = false;
        return;
      }
      this.focusMoved = false;
      this.seatOnOwedPick();
    },
  },
  mounted(): void {
    // A CARRIED OBJECT MAY NOT PAINT BEFORE ITS TRAVEL STARTS. When this screen
    // is the next stage of a flow the player began elsewhere, the source card
    // is FLIPping in from that flow's hero slot — and this component paints
    // before the enter hook can pose it. Held here, released by the FLIP (or by
    // its own bounded safety).
    holdCarriedAnchors(this.$refs.rootEl as HTMLElement | undefined);
    // RESUME ≠ FRESH-OPEN: decide ONCE, host-scoped, what this mount can
    // honestly rebuild (the actionWorkspaceRestorePlan idiom).
    const plan = hydroWorkspaceRestorePlan({
      commit: this.flow.commit,
      claimHost: workspaceOutcomeState.host,
      followUpInteractive: this.followUpLive,
    });
    if (plan === 'fold') {
      resetHydroFlow();
      resetHydroPlan();
      consoleHydroUi.repeatResult = undefined;
    } else if (plan === 'none') {
      closeHydroStep();
      // THE REWARD CHOICE IS STEP-SCOPED, so a mount with no live step has
      // nothing to carry: without this it survived a trip to the board and
      // the CTA then committed a reward the player could no longer see.
      hydroNetworkState.rewardChoice = undefined;
      this.choiceStage = 'options';
      if (!hydroDraftFresh(this.cacheKey)) {
        resetHydroPlan();
        consoleHydroUi.repeatResult = undefined;
      }
    }
    // A host must republish its zones from mounted() — a change-watcher
    // cannot fire true→true across a park.
    if (this.sceneKey === 'commit') {
      this.publishEmbedZone();
    }
    // THE MOUNT EDGE of the seating — after the restore plan, whose fresh-open
    // branch resets the very field the offer needs seated.
    this.seatPlanOnOffer();
    if (this.flow.step === 'target') {
      void this.$nextTick(() => this.seatTargetStep());
    }
    // …and the plan layer seats its cursor the same way: the pick is the act,
    // so the cursor starts on it rather than on a CTA that cannot fire. Claimed,
    // not decided — `fetchPreview()` below is what makes the question answerable.
    this.seatOwed = true;
    this.applyOwedSeat();
    this.syncFrameCrumb();
    this.fetchPreview();
  },
  beforeUnmount(): void {
    this.cereHandle?.kill();
    this.cereHandle = undefined;
    setHydroCeremonyActive(false);
    this.retractEmbedZone();
    consoleHydroUi.commands = [];
    setWorkspaceFrameSubject('hydro', '');
    setWorkspaceFrameStage('hydro', '');
  },
  methods: {
    $t,
    fetchPreview(): void {
      fetchHydroPreview(this.playerView.id, this.viewerColor, this.cacheKey + ':' + this.viewerColor);
    },
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
     * ⚠️ ASKED ON BOTH EDGES. The offer watcher runs at SETUP, and `mounted()`
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
    applyOwedSeat(): void {
      if (!this.seatOwed || this.preview === undefined) {
        return;
      }
      this.seatOwed = false;
      // THE MATRIX, computed from decision STATE alone: the first open
      // decision in game order, else the final CTA. A resolved pick never
      // retakes the automatic seat; an unavailable slot never counts.
      this.seatRailFocus(initialRailFocus(this.railDecisions));
    },
    /** Seat a rail node, mapping the CTA stop onto the scene's own confirm
     *  (the offer's answer plate, or the plan's commit). ONE mapper, so no
     *  caller re-guesses which button is «the CTA» in which scene. */
    seatRailFocus(node: string): void {
      if (node !== HYDRO_RAIL_CTA) {
        this.sceneFocus = node as HydroSceneFocus;
        return;
      }
      this.sceneFocus = this.advanceOffer !== undefined ? 'bonus-confirm' : 'cta';
    },
    /**
     * RE-SEAT ON A NEW DECISION REVISION (`pickDecisionKey` changed). Runs the
     * ordinary owed-seat machinery — same priority, same one-shot — but only
     * while the browse stage is what the player is looking at, and never over
     * a cursor they have already moved by hand inside this revision.
     */
    seatOnOwedPick(): void {
      // Only the two BROWSE-shaped scenes hold a seatable pre-select; a step
      // (choice/target/payment) and the commit own their own cursor.
      if ((this.sceneKey !== 'preview' && this.sceneKey !== 'bonus') || this.focusMoved) {
        return;
      }
      this.seatOwed = true;
      this.applyOwedSeat();
    },
    seatPlanOnOffer(): boolean {
      const offer = this.advanceOffer;
      if (offer === undefined) {
        return false;
      }
      hydroNetworkState.selectedPosition = offer.toPosition;
      return true;
    },
    syncFrameCrumb(): void {
      setWorkspaceFrameSubject('hydro', this.crumbSubject);
      setWorkspaceFrameStage('hydro', this.crumbStage);
    },
    publishEmbedZone(): void {
      setWorkspaceFrameSlot('hydro', HYDRO_EMBED_SLOT);
      if (workspaceOutcomeState.host === 'hydro') {
        setWorkspaceOutcomeSlot(HYDRO_EMBED_SLOT);
      }
    },
    retractEmbedZone(): void {
      setWorkspaceFrameSlot('hydro', '');
      if (workspaceOutcomeState.host === 'hydro') {
        setWorkspaceOutcomeSlot('');
      }
    },
    reasonText(r: HydroReason): string {
      // …through the SHARED rule (`reasonParams`) — one sentence, one name for
      // the missing tag, on every surface that states a refusal.
      const params = reasonParams(r.params, r.tag as Tag | undefined);
      return params.length > 0 ?
        translateTextWithParams(r.textKey, params) :
        translateText(r.textKey);
    },
    /** The reason's visual register — data, never a per-row colour choice. */
    reasonTone(r: HydroReason): 'warning' | 'danger' {
      return hydroReasonBlocker(r).tone;
    },
    tagStatus(tag: Tag): 'have' | 'wild' | 'missing' {
      const dest = this.model.destination;
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
    },
    deltaIconClass(l: HydroDeltaLine): string {
      if (l.special === 'jovian-tag') {
        return 'resource-tag tag-jovian';
      }
      if (l.special === 'animals') {
        return 'card-resource card-resource-animal';
      }
      return l.resource !== undefined ? iconClassFor(l.resource) : '';
    },
    /** The panel-body RETUNE — the content breathes through a stop change
     *  while the frame stands still. The persistent context column rides the
     *  SAME tween (its identity changed with the stop), so the two zones read
     *  as one instrument re-tuning, never two blinks. GSAP owns the overlap
     *  semantics: a rapid re-step overwrites the running dip from its CURRENT
     *  pose. */
    retunePanel(): void {
      if (this.reducedMotion === true) {
        return;
      }
      const targets = [this.$refs.panelBody, this.$refs.ctxEl]
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
    },
    // ── the SCENE transition hooks (the workspace-descend phrase) ──────────
    sceneEnter(el: Element, done: () => void): void {
      hydroSceneEnterHook(el, done);
    },
    sceneLeave(el: Element, done: () => void): void {
      hydroSceneLeaveHook(el, done);
    },
    sceneCancelled(el: Element): void {
      hydroSceneCancelledHook(el);
    },
    // ── PREVIEW: track navigation + the smart primary ──────────────────────
    onStopClick(position: number): void {
      if (this.flow.commit !== undefined) {
        return;
      }
      closeHydroStep();
      // A pointer walk is the player's own move too — same contract as the
      // d-pad: their revision, their cursor.
      this.focusMoved = true;
      this.selectPosition(position);
    },
    /** One bumper press = one unit of the price moved between energy and
     *  Delta Works steel. The dial lives ONLY on the payment substep — on
     *  Configure the selector is not active and a hidden LB/RB would be a
     *  control the screen never advertised. Past the commit boundary the
     *  draft is frozen — the guard also kills a held repeat. */
    adjustMix(delta: number): void {
      if (this.flow.step !== 'payment' || !this.mixAdjustable || this.flow.commit !== undefined) {
        return;
      }
      const next = clampEnergyMixSteel(this.mixSteel + delta,
        {minSteel: this.model.minSteelForSpend, maxSteel: this.model.maxSteelForSpend});
      if (next === this.mixSteel) {
        return;
      }
      this.steelPreference = next;
      // Re-keys the one-shot pulse on the steel row — the same acknowledgement
      // every other payment surface plays on a dial press.
      this.mixFlashNonce += 1;
    },
    /**
     * CONFIGURE → PAYMENT: the plan is complete (the same gate the direct
     * reinforce passes) and the server model admits at least two mixes — the
     * working area hands over to the composition step. Nothing is submitted,
     * nothing is spent; the focus seat is remembered for the walk back.
     */
    openPaymentStep(): void {
      this.paymentReturnFocus = railIdOf(this.sceneFocus) !== undefined ? this.sceneFocus : 'track';
      // The composition UNFOLDS from the gateway press (the same descend
      // phrase every other step enters with — a bare fade read as a swap).
      this.armSceneFromCta();
      openHydroStep('payment');
    },
    /** PAYMENT → CONFIGURE: B — draft, destination and pre-selects intact.
     *  The remembered rail seat is honoured only while that node is still in
     *  the focus graph (the decision may have gone unavailable meanwhile). */
    closePaymentStep(): void {
      closeHydroStep();
      const back = this.paymentReturnFocus;
      this.sceneFocus = railIdOf(back) !== undefined &&
        railFocusNodes(this.railDecisions).includes(back) ? back : 'track';
    },
    /** The FINAL act of the payment substep — the same server-authoritative
     *  reinforce the single-allocation path fires from Configure. */
    onPaymentConfirm(): void {
      this.armSceneFromCta();
      this.emitConfirm();
    },
    selectPosition(position: number): void {
      const last = this.model.stages.length - 1;
      const next = Math.min(last, Math.max(0, position));
      if (next === this.model.selectedPosition) {
        return;
      }
      // The player's own walk flips `pickDecisionKey` too — armed HERE, past
      // the no-op guard (armed at a call site, a clamped/no-op walk would
      // leave the latch set and swallow the NEXT real external revision).
      this.selfKeyChange = true;
      hydroNetworkState.selectedPosition = next;
      // NO SILENT DEFAULTS: a choice stage starts unconfigured — the player
      // sees both options and picks one deliberately, inside its own step.
      hydroNetworkState.rewardChoice = undefined;
      this.choiceStage = 'options';
      hydroNetworkState.selectedCard = undefined;
      consoleHydroUi.repeatResult = undefined;
      // THE CURSOR LANDS ON THE QUESTION. A stage that owes a target pick
      // (pos 7/9 with live candidates) seats it on the rail's first open
      // decision, so the default A OPENS THE PICKER: advancing without a
      // target then takes a deliberate walk plus the warned second press, and
      // can never be a stray A on a stage the player has only just stepped
      // onto. Stepping on with ←/→ re-takes the track first (see
      // `handleIntent`), so the walk itself is untouched — only where the
      // cursor RESTS changes.
      this.sceneFocus = this.planPickMissing ?
        initialRailFocus(this.railDecisions) as HydroSceneFocus : 'track';
    },
    /** A — the smart primary: open the pending pre-select, else commit. */
    onPrimary(): void {
      if (this.model.mode !== 'plan') {
        this.selectPosition(this.model.currentPosition + Math.max(1, this.model.defaultSpend));
        return;
      }
      const blocking = this.reasons.filter((r) => r.blocking);
      if (blocking.length > 0) {
        this.$emit('notice', this.reasonText(blocking[0]));
        return;
      }
      switch (this.primaryVerb) {
      case 'choose-reward':
        this.openChoiceStep();
        return;
      case 'reinforce':
        // THE SAME GATE THE OFFER USES: the landed stage's pick is still
        // unchosen, so the FIRST press names that and the SECOND advances
        // anyway. A HEADS-UP, never a lock — advancing without stopping to
        // configure the reward is a legal move (see `hydroNetworkModel`).
        if (this.planPickMissing && !this.pickWarned) {
          this.pickWarned = true;
          return;
        }
        // CONFIGURE → PAYMENT, only while the server model admits at least
        // two valid mixes (`minSteelForSpend < maxSteelForSpend`). A single
        // valid allocation goes straight to Resolve — no extra step.
        if (this.mixAdjustable) {
          this.openPaymentStep();
          return;
        }
        this.emitConfirm();
        return;
      default:
        return;
      }
    },
    /**
     * A on a rail decision (or a click on its card) — open its OWN existing
     * selector: choose while it is open, change once it is resolved. ONE door
     * for both scenes; each routes into the machinery it already had (the
     * repeat browser bridge / the embedded target step) — nothing here is a
     * second implementation.
     */
    openRailDecision(): void {
      if (this.advanceOffer !== undefined) {
        this.openBonusPick();
        return;
      }
      this.onChangeSelection();
    },
    /** A CLICK on a decision card = point + press: seat the cursor on that
     *  node, then open its selector — the same two facts the pad expresses
     *  as ↑/↓ + A. Unavailable slots take no press (out of the graph). */
    focusAndOpenRail(d: HydroRailDecision): void {
      if (d.state === 'unavailable') {
        return;
      }
      this.focusMoved = true;
      this.seatRailFocus(railNodeOf(d));
      this.openRailDecision();
    },
    /** The plan scene's door (see `openRailDecision`). */
    onChangeSelection(): void {
      const m = this.model;
      if (m.mode !== 'plan') {
        return;
      }
      this.armSceneFromSummary();
      if (m.needsCardSelect === 'reuse-action') {
        this.$emit('pick');
        return;
      }
      if (m.needsCardSelect === 'animal-target') {
        this.openTargetStep();
      }
    },
    armSceneFromSummary(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__summary--focused') ??
        root?.querySelector<HTMLElement>('.con-hydro__pickrow') ??
        root?.querySelector<HTMLElement>('.con-hydro__ctazone'));
    },
    armSceneFromCta(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__ctazone') ??
        root?.querySelector<HTMLElement>('.con-hydro__panel'));
    },
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
    inspectBonusSource(): void {
      if (this.advanceOffer === undefined) {
        return;
      }
      openConsoleCardZoom([{name: this.advanceOffer.source} as CardModel], 0, undefined, undefined, {
        statusLabel: 'Source',
        // The SHARED slot origin — the same one the hand, the reveal and the
        // action browser pass. It resolves the WRAPPER, which is what lets the
        // zoom machinery empty the whole slot (`:has(.con-zoom-hold)`) rather
        // than only zeroing the face and leaving its focus ring behind.
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          () => this.advanceOffer?.source ?? ''),
      });
    },
    /**
     * THE CURSOR WALKS THE LAYOUT IT SEES. The two answers are a horizontal
     * pair under the statement, with the source card in the column beside
     * them, so ←/→ step between the answers and reach the source, and ↑/↓ keep
     * working for a player whose thumb is already on that axis. An EDGE HOLDS
     * — never a wrap: a decision's cursor that loops turns «Пропустить» into
     * whatever is one press past «Продвинуться».
     */
    navBonus(dir: 'up' | 'down' | 'left' | 'right'): void {
      // A deliberate move: this decision revision may not re-seat the cursor.
      this.focusMoved = true;
      // The zone's focusables, top-to-bottom, exactly as they are laid out:
      // the source card, then the DECISION RAIL's own order (its CTA stop is
      // this scene's confirm plate). An edge HOLDS — never a wrap: a
      // decision's cursor that loops turns «Пропустить» into whatever is one
      // press past «Продвинуться».
      const column: Array<typeof this.sceneFocus> = [];
      if (this.ctxSourceView !== undefined) {
        column.push('bonus-source');
      }
      for (const node of railFocusNodes(this.railDecisions)) {
        column.push(node === HYDRO_RAIL_CTA ? 'bonus-confirm' : node as HydroSceneFocus);
      }
      // A card ENTRY has no refusal, so «one press past the confirm» must be
      // the confirm itself — a ring that can land on an unrendered button is a
      // dead cursor stop, which is the same defect as a wrapping one.
      const skip = this.bonusSkipOffered;
      const at = Math.max(0, column.indexOf(this.sceneFocus === 'bonus-skip' ? 'bonus-confirm' : this.sceneFocus));
      switch (dir) {
      case 'left':
        // The two ANSWERS sit side by side; everything above them is a column.
        this.sceneFocus = this.sceneFocus === 'bonus-skip' ? 'bonus-confirm' : column[Math.max(0, at - 1)];
        return;
      case 'right':
        this.sceneFocus = skip && this.sceneFocus === 'bonus-confirm' ? 'bonus-skip' :
          this.sceneFocus === 'bonus-skip' ? 'bonus-skip' : column[Math.min(column.length - 1, at + 1)];
        return;
      case 'up':
        this.sceneFocus = this.sceneFocus === 'bonus-skip' ? 'bonus-confirm' : column[Math.max(0, at - 1)];
        return;
      case 'down':
        this.sceneFocus = skip && this.sceneFocus === 'bonus-confirm' ? 'bonus-skip' :
          this.sceneFocus === 'bonus-skip' ? 'bonus-skip' : column[Math.min(column.length - 1, at + 1)];
        return;
      }
    },
    /**
     * ANSWER the offer. The index comes from the SERVER's marker — never from
     * the option order this component happens to see — and the in-flight latch
     * makes a second press impossible by state rather than by a guard.
     */
    /**
     * OPEN THE LANDED STAGE'S PRE-SELECT — the very same step the player's own
     * advance opens for the same stage. `$emit('pick')` is the shell's repeat
     * browser bridge; `openTargetStep` is the embedded target step. Neither is
     * re-implemented here, and neither knows it was reached from an offer.
     */
    openBonusPick(): void {
      if (!this.bonusNeedsCard) {
        return;
      }
      this.pickWarned = false;
      if (this.model.needsCardSelect === 'reuse-action') {
        this.$emit('pick');
        return;
      }
      this.openTargetStep();
    },
    answerBonus(take: boolean): void {
      const offer = this.advanceOffer;
      if (offer === undefined || this.bonusSubmitting) {
        return;
      }
      // A card ENTRY has no refusal — B is its way out — so a `false` here can
      // only be a stray press on a button that is not rendered.
      if (!take && !this.bonusSkipOffered) {
        return;
      }
      // THE PICK IS STILL UNCHOSEN — say so ONCE, then take the second press
      // at face value. ⚠️ The cursor STAYS on the confirm: moving it to the
      // row made the second press open the picker instead, so the player
      // could never advance at all. A warning is a heads-up, not a lock.
      if (take && this.bonusPickMissing && !this.pickWarned) {
        this.pickWarned = true;
        return;
      }
      if (take && this.bonusNeedsReward) {
        // The landing stage asks WHICH reward. That question belongs to this
        // workspace's own reward step — never to a second modal on top of it —
        // and both halves then submit as ONE batch, exactly like the standard
        // advance does. Seat the plan on the destination so the step describes
        // the stage the move actually lands on.
        hydroNetworkState.selectedPosition = offer.toPosition;
        this.openChoiceStep();
        return;
      }
      if (this.offerOrigin === 'card-entry') {
        this.submitCardAdvance(undefined);
        return;
      }
      const meta = this.bonusOffer as DeltaBonusPromptMeta;
      this.submitBonus(take, take ? meta.advanceIndex : meta.skipIndex, undefined);
    },
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
    submitBonus(take: boolean, index: number, rewardChoice: number | undefined): void {
      const offer = this.bonusOffer;
      if (offer === undefined || this.bonusSubmitting) {
        return;
      }
      this.bonusSubmitting = true;
      this.armSceneFromCta();
      if (!take) {
        this.$emit('bonus-answer', {take: false, index, rewardChoice: undefined});
        return;
      }
      const view = this.bonusRewardView;
      // The landed stage's own answers ride the SAME batch the standard
      // advance sends (`hydroAdvanceTail`) — pre-collected here, never asked
      // again after the commit.
      const repeat = this.model.needsCardSelect === 'reuse-action' ? this.chosenRepeat : undefined;
      this.$emit('bonus-answer', {
        take: true,
        index,
        rewardChoice,
        selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
        repeat,
        fromPosition: offer.fromPosition,
        toPosition: offer.toPosition,
        // The server's own verdict on the price (0 for a plain bonus step, 1
        // for the tag waiver) — never the standard action's per-step cost.
        spend: offer.energyCost,
        rewards: hydroRewardTransfers(view),
        resultLines: view.lines,
        vp: view.vp,
        stageNameKey: HYDRO_STAGES[offer.toPosition]?.nameKey ?? '',
        // The GRANTING CARD — the context column keeps showing it through the
        // commit and the result, so the origin never blinks away mid-flow.
        sourceCard: offer.source,
        // The pos-9 presented target freezes its pre-commit count here, exactly
        // as `emitConfirm` does for the player's own advance.
        targetBefore: this.selectedAnimalCurrent,
      });
    },
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
    submitCardAdvance(rewardChoice: number | undefined): void {
      const offer = this.cardOffer;
      if (offer === undefined || this.bonusSubmitting || this.flow.commit !== undefined) {
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
      if (offer.fromPosition !== this.model.currentPosition) {
        this.$emit('notice', translateText('The track position has changed — reopen the action'));
        return;
      }
      this.bonusSubmitting = true;
      this.armSceneFromCta();
      const view = this.bonusRewardView;
      const repeat = this.model.needsCardSelect === 'reuse-action' ? this.chosenRepeat : undefined;
      this.$emit('card-advance', {
        rewardChoice,
        selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
        // Same contract as the player's own advance: the warned confirm with
        // no pick FORFEITS the reward rather than postponing it.
        waiveTarget: this.waiveTargetNow ? true : undefined,
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
        stageNameKey: HYDRO_STAGES[offer.toPosition]?.nameKey ?? '',
        sourceCard: offer.source,
        targetBefore: this.selectedAnimalCurrent,
      });
    },
    emitConfirm(): void {
      if (!this.model.canConfirm || this.flow.commit !== undefined) {
        return;
      }
      this.armSceneFromCta();
      const repeat = this.model.needsCardSelect === 'reuse-action' ? this.chosenRepeat : undefined;
      this.$emit('confirm', {
        spend: this.model.selectedSpend,
        // The chosen Delta Works mix — the ONE linked steel value (energy is
        // the remainder). Omitted at 0 so the batch stays byte-identical.
        steelSpend: this.mixSteel > 0 ? this.mixSteel : undefined,
        rewardChoice: this.model.targetNeedsChoice ? hydroNetworkState.rewardChoice : undefined,
        selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
        // The warned confirm with no pick is a CONSCIOUS decline — the server
        // defers no follow-up ask for it (see `waiveTargetNow`).
        waiveTarget: this.waiveTargetNow ? true : undefined,
        repeat,
        fromPosition: this.model.currentPosition,
        toPosition: this.model.selectedPosition,
        rewards: hydroRewardTransfers(this.rewardView),
        // The result stage's frozen truth (the live model moves on with the
        // commit and would describe the NEXT advance).
        resultLines: this.rewardView.lines,
        vp: this.rewardView.vp,
        stageNameKey: this.model.targetStage?.nameKey ?? '',
        kind: resolutionKindFor(this.model.selectedPosition, {
          composedRepeat: repeat !== undefined,
          selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
        }),
        // The standing track rule, counted at the decision: the result stage
        // names how many intermediate rewards this jump passed over.
        skippedCount: this.model.skippedStages.length,
        targetBefore: this.selectedAnimalCurrent,
      });
    },
    // ── the REWARD CHOICE step (pos 1/2) — pick AND confirm, in place ─────
    openChoiceStep(): void {
      if (this.choiceStageModel === undefined || this.flow.step === 'reward') {
        return;
      }
      this.armSceneFromCta();
      // The choice is SCOPED TO THE STEP: entering always asks again, so a
      // reward can never be silently carried in from an earlier visit (and
      // «no auto-select» holds by construction — nothing is chosen yet).
      hydroNetworkState.rewardChoice = undefined;
      this.choiceFocus = 0;
      this.choiceStage = 'options';
      this.choiceSkipFocus = false;
      openHydroStep('reward');
    },
    /** A on an option — hold it and arm the commit right underneath. */
    pickChoice(index: number): void {
      hydroNetworkState.rewardChoice = index;
      this.choiceFocus = index;
      this.choiceStage = 'confirm';
      this.choiceSkipFocus = false;
    },
    /** A on the step's own CTA — the advance commits from HERE. */
    confirmChoiceStep(): void {
      if (this.rewardChoice === undefined) {
        return;
      }
      // Answering a CARD'S move: the step is that move's second half, so it
      // commits THAT — never the player's own planned advance. Both
      // provenances land here; only the submit differs.
      if (this.advanceOffer !== undefined) {
        // The reward view must be read BEFORE the step closes — `sceneKey`
        // swaps on the same tick and the offer's landing stage is what the
        // transfers are measured from.
        const choice = this.rewardChoice;
        if (this.offerOrigin === 'card-entry') {
          this.submitCardAdvance(choice);
        } else {
          this.submitBonus(true, (this.bonusOffer as DeltaBonusPromptMeta).advanceIndex, choice);
        }
        closeHydroStep();
        return;
      }
      const blocking = this.reasons.filter((r) => r.blocking);
      if (blocking.length > 0) {
        this.$emit('notice', this.reasonText(blocking[0]));
        return;
      }
      // CONFIGURE → PAYMENT, the same gateway the plan's own confirm takes:
      // the chosen reward is captured (it survives in hydroNetworkState), and
      // the composition step is the LAST stop before Resolve.
      if (this.mixAdjustable) {
        this.openPaymentStep();
        return;
      }
      this.emitConfirm();
    },
    /** B — leave the step with NOTHING configured behind it. (Under an offer
     *  that lands the player back on the offer itself, undecided.) */
    closeChoiceStep(): void {
      hydroNetworkState.rewardChoice = undefined;
      this.choiceStage = 'options';
      this.choiceSkipFocus = false;
      closeHydroStep();
      this.sceneFocus = 'track';
    },
    // ── the TARGET step (pos 9) ────────────────────────────────────────────
    openTargetStep(): void {
      const owners = this.targetStepModel?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      if (railIdOf(this.sceneFocus) === undefined) {
        this.armSceneFromCta();
      }
      this.targetFocus = findPlayedTargetFocus(this.targetLockedCard, owners) ??
        reseatPlayedTargetFocus(undefined, owners);
      if (this.targetFocus === undefined) {
        return;
      }
      openHydroStep('target');
      void this.$nextTick(() => this.seatTargetStep());
    },
    seatTargetStep(): void {
      this.measureTargetZone();
      const owners = this.targetStepModel?.owners ?? [];
      if (this.targetFocus === undefined && owners.length > 0) {
        this.targetFocus = reseatPlayedTargetFocus(undefined, owners);
      }
    },
    measureTargetZone(): void {
      const zone = this.$refs.targetZone as HTMLElement | undefined;
      if (zone === undefined || zone === null) {
        return;
      }
      const cs = getComputedStyle(zone);
      this.targetZoneW = Math.max(0, zone.clientWidth -
        (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      this.targetZoneH = Math.max(0, zone.clientHeight -
        (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    },
    targetNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || owners.length === 0) {
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(focus, dir as PlayedTargetNavDir, cells) :
        stepPlayedTargetFocus(focus, dir as PlayedTargetNavDir, owners, this.targetLayout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent owner change
      }
      this.targetFocus = next;
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    cycleTargetOwner(delta: number): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || this.targetLayout.mode !== 'tabs' || owners.length < 2) {
        return;
      }
      const ownerId = stepPlayedTargetOwner(focus.ownerId, delta, owners);
      if (ownerId !== focus.ownerId) {
        this.targetFocus = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focus;
      }
    },
    targetConfirm(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      if (candidate === undefined) {
        return;
      }
      hydroNetworkState.selectedCard = candidate.cardName;
      closeHydroStep();
      this.sceneFocus = 'track';
    },
    targetInspect(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      if (candidate === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === candidate.cardName));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        origin: playedTargetZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          ''),
      });
    },
    // ── the CEREMONY (pos 10/11) ───────────────────────────────────────────
    maybeStartCeremony(settledPos: number): void {
      const c = this.flow.commit;
      if (c === undefined || c.kind !== 'ceremony' || c.phase !== 'resolving' ||
          this.cereStarted || settledPos !== c.toPosition) {
        return;
      }
      this.cereStarted = true;
      void this.$nextTick(() => {
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const seat = this.$refs.cereSeat as HTMLElement | undefined;
        const sceneEl = this.$refs.sceneEl as HTMLElement | undefined;
        if (root === undefined || seat === undefined || seat === null || sceneEl === undefined) {
          this.$emit('result-done');
          return;
        }
        setHydroCeremonyActive(true);
        this.cereHandle = runHydroCeremony({
          sceneEl,
          stopEl: root.querySelector<HTMLElement>(`[data-hydro-stop="${c.toPosition}"]`) ?? undefined,
          seatEl: seat,
          valueEl: (this.$refs.cereValue as HTMLElement | undefined) ?? undefined,
          dressEls: Array.from(root.querySelectorAll<HTMLElement>('[data-hydro-cere-line]')),
          reduced: this.reducedMotion === true,
          onCulmination: () => {
            seat.classList.add('con-hydro__cere-seat--peak');
          },
          onDone: () => {
            this.cereHandle = undefined;
            setHydroCeremonyActive(false);
            this.$emit('result-done');
          },
        });
      });
    },
    // ── input ──────────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      const c = this.flow.commit;
      if (c !== undefined) {
        if (c.phase === 'result') {
          const a = consoleActionOf(intent);
          if (a === 'primary' || a === 'back') {
            this.$emit('result-done');
          }
          return;
        }
        // A transient beat / a standing follow-up: B may only collapse; the
        // embedded surface's own input is routed by the shell before us.
        if (consoleActionOf(intent) === 'back' && this.followUpLive) {
          this.$emit('collapse');
        }
        return;
      }
      if (this.flow.step === 'reward') {
        if (intent.kind === 'nav') {
          const n = this.choiceOptions.length;
          if ((intent.dir === 'left' || intent.dir === 'right') && n > 0) {
            // Sideways always means «the options» — from the armed CTA it
            // steps back up into them AND moves, one gesture.
            this.choiceStage = 'options';
            this.choiceSkipFocus = false;
            this.choiceFocus = (this.choiceFocus + (intent.dir === 'right' ? 1 : n - 1)) % n;
          } else if (intent.dir === 'down') {
            // ↓ walks the act column: options → the armed commit → the
            // optional refusal beneath it (a server-framed offer only).
            if (this.choiceStage === 'confirm' && this.choiceSkipOffered) {
              this.choiceSkipFocus = true;
            } else if (this.rewardChoice !== undefined) {
              this.choiceStage = 'confirm';
            }
          } else if (intent.dir === 'up') {
            if (this.choiceSkipFocus) {
              this.choiceSkipFocus = false;
            } else {
              this.choiceStage = 'options';
            }
          }
          return;
        }
        switch (consoleActionOf(intent)) {
        case 'primary':
          if (this.choiceSkipFocus) {
            this.answerBonus(false);
          } else if (this.choiceStage === 'confirm') {
            this.confirmChoiceStep();
          } else {
            this.pickChoice(this.choiceFocus);
          }
          return;
        case 'back':
          this.closeChoiceStep();
          return;
        default:
          return;
        }
      }
      if (this.flow.step === 'target') {
        if (intent.kind === 'nav') {
          this.targetNav(intent.dir);
          return;
        }
        switch (consoleActionOf(intent)) {
        case 'primary':
          this.targetConfirm();
          return;
        case 'inspect':
          this.targetInspect();
          return;
        case 'prevSection':
          this.cycleTargetOwner(-1);
          return;
        case 'nextSection':
          this.cycleTargetOwner(1);
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
      if (this.flow.step === 'payment') {
        if (intent.kind === 'nav') {
          return;
        }
        switch (consoleActionOf(intent)) {
        case 'prevSection':
          this.adjustMix(-1);
          return;
        case 'nextSection':
          this.adjustMix(1);
          return;
        case 'primary':
          this.onPaymentConfirm();
          return;
        case 'back':
          this.closePaymentStep();
          return;
        default:
          return;
        }
      }
      // BONUS — a decision, not a browse layer: the d-pad moves between the
      // two answers and nothing else, so the track never scrolls under a
      // question the player is being asked.
      if (this.sceneKey === 'bonus') {
        if (intent.kind === 'nav') {
          this.navBonus(intent.dir);
          return;
        }
        switch (consoleActionOf(intent)) {
        case 'primary':
          if (this.sceneFocus === 'bonus-source') {
            this.inspectBonusSource();
          } else if (railIdOf(this.sceneFocus) !== undefined) {
            this.openRailDecision();
          } else {
            this.answerBonus(this.sceneFocus !== 'bonus-skip');
          }
          return;
        case 'inspect':
          this.inspectBonusSource();
          return;
        case 'back':
          // СВЕРНУТЬ — never «Пропустить». The offer stays on the wire,
          // unanswered; the workspace parks at full depth and the board-home
          // mandatory card brings the player back to this very prompt.
          this.emitBack();
          return;
        default:
          return;
        }
      }
      // PREVIEW.
      if (intent.kind === 'nav') {
        // A deliberate move: this decision revision may not re-seat the cursor.
        this.focusMoved = true;
        if (intent.dir === 'left' || intent.dir === 'right') {
          this.sceneFocus = 'track';
          this.selectPosition(this.model.selectedPosition + (intent.dir === 'right' ? 1 : -1));
        } else if (intent.dir === 'down') {
          // ↓ walks the SPATIAL column: track → the rail's decisions, top to
          // bottom, → the final CTA. The bottom edge HOLDS (no wrap — the
          // scene-wide convention).
          const to = railStep(this.railDecisions, this.sceneFocus, 1);
          if (to !== 'out-bottom' && to !== 'out-top') {
            this.seatRailFocus(to);
          }
        } else if (intent.dir === 'up') {
          if (this.sceneFocus === 'track') {
            return;
          }
          const to = railStep(this.railDecisions, this.sceneFocus, -1);
          if (to === 'out-top') {
            this.sceneFocus = 'track';
          } else if (to !== 'out-bottom') {
            this.seatRailFocus(to);
          }
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'nextTab': { // RT — jump to the FURTHEST legal+affordable stage.
        const max = this.preview?.maxLegalSteps ?? 0;
        if (max > 0) {
          this.sceneFocus = 'track';
          this.focusMoved = true;
          this.selectPosition(this.model.currentPosition + max);
        }
        return;
      }
      // (No LB/RB here: the composition dial belongs to the PAYMENT substep
      // alone — a hidden control on Configure is the forbidden shape.)
      case 'primary':
        if (railIdOf(this.sceneFocus) !== undefined) {
          this.openRailDecision();
        } else {
          this.onPrimary();
        }
        return;
      case 'back':
        this.emitBack();
        return;
      default:
        return;
      }
    },
    /** B on a layer whose verb is close-or-collapse. ONE door, so the button
     *  can never do one thing and the bar say another. */
    emitBack(): void {
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
      if (this.backVerb !== 'collapse' && this.crumbHost !== undefined) {
        captureSurfaceDeparture('section', this.$refs.rootEl as HTMLElement | undefined ?? null);
      }
      this.$emit(this.backVerb === 'collapse' ? 'collapse' : 'close');
    },
  },
});
</script>
