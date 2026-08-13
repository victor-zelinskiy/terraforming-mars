<template>
  <section class="con-hydro con-ws"
           ref="rootEl"
           role="region"
           :aria-label="$t('Mars Hydronetwork')"
           :data-flow="flowKind"
           :class="{'con-hydro--cere': ceremonyDim}">
    <!-- ── THE WORKSPACE HEADER — the shared ConsoleWsHead: root «ГИДРОСЕТЬ
         МАРСА» + the live chips as the aux browse layer; a configuring or
         committed flow grows the crumb tail «› <этап> › <шаг>». The old
         two-line lore paragraph is gone: a standing game workspace explains
         itself through its stages, not a header essay. -->
    <ConsoleWsHead class="con-hydro__head"
                   root="Mars Hydronetwork"
                   emblem="hydronetwork"
                   wheelAnchor="hydro"
                   :subject="crumbSubject"
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

    <!-- ── THE SCENE — the transformable lower zone. ONE region whose layers
         (preview → picker → commit → result) advance IN PLACE via the
         workspace-descend phrase; the track above never moves. ───────────── -->
    <div class="con-hydro__scene" ref="sceneEl">
      <transition :css="false"
                  @enter="sceneEnter" @leave="sceneLeave"
                  @enter-cancelled="sceneCancelled" @leave-cancelled="sceneCancelled">
        <!-- ═══ PREVIEW — the compact plan/details panel. ═══ -->
        <div v-if="sceneKey === 'preview'" key="preview" class="con-hydro__layer con-hydro__layer--preview">
          <div class="con-hydro__panel" :class="{'con-hydro__panel--details': model.mode === 'details'}">
            <!-- ONE body element: stepping between stops RETUNES it (a soft
                 GSAP dip-and-rise) instead of hard-swapping rows — the panel
                 frame itself never moves, rows reserve their lines, and the
                 content breathes through the change. -->
            <div class="con-hydro__panelbody" ref="panelBody">
            <!-- Identity row: stage glyph + name + status + route. -->
            <div class="con-hydro__ident" data-unfold-item>
              <span v-if="selectedStage.tag !== undefined" class="con-hydro__stage-tag resource-tag" :class="'tag-' + selectedStage.tag" aria-hidden="true"></span>
              <span v-else-if="selectedStage.vp !== undefined" class="con-hydro__stage-vp">{{ selectedStage.vp }} {{ $t('VP') }}</span>
              <span v-else class="con-hydro__stage-flag" aria-hidden="true">⚑</span>
              <div class="con-hydro__stage-titles">
                <div class="con-hydro__stage-name">{{ $t(selectedStage.nameKey) }}</div>
                <div class="con-hydro__stage-pos">{{ stageOfText }}</div>
              </div>
              <span class="con-hydro__stage-badge" :class="'con-hydro__stage-badge--' + stageBadge.kind">
                <span class="con-hydro__chip-dot" aria-hidden="true"></span>
                <span>{{ stageBadge.text }}</span>
              </span>
              <span v-if="model.mode === 'plan'" class="con-hydro__route">
                <span>{{ model.currentPosition }}</span>
                <span aria-hidden="true">→</span>
                <b>{{ model.selectedPosition }}</b>
                <span class="con-hydro__route-cost">
                  −{{ model.selectedSpend }}
                  <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
                </span>
              </span>
            </div>

            <template v-if="model.mode === 'plan'">
              <!-- Requirements row: path tags + energy, one compact line. -->
              <div class="con-hydro__reqline" data-unfold-item>
                <span class="con-hydro__section-label">{{ $t('Requirements') }}</span>
                <span v-for="(t, i) in requiredTags" :key="i"
                      class="con-hydro__req-tag"
                      :class="'con-hydro__req-tag--' + tagStatus(t)">
                  <span class="resource-tag" :class="'tag-' + t" aria-hidden="true"></span>
                  <span class="con-hydro__req-mark" aria-hidden="true">{{ tagStatus(t) === 'missing' ? '✕' : '✓' }}</span>
                  <span v-if="tagStatus(t) === 'wild'" class="con-hydro__req-wild" aria-hidden="true">✱</span>
                </span>
                <span class="con-hydro__req-energy" :class="{'con-hydro__req-energy--short': !targetAffordable}">
                  <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
                  <b>{{ model.selectedSpend }}</b>
                  <span class="con-hydro__req-have">{{ $t('You have') }}: {{ model.availableEnergy }}</span>
                  <span class="con-hydro__req-mark" aria-hidden="true">{{ targetAffordable ? '✓' : '✕' }}</span>
                </span>
              </div>
              <!-- Route notes: skipped rewards + the 2VP leap — tied to the
                   track (the amber route stops), one quiet line each. The
                   STRIP is always in layout (a reserved line, the settings
                   idiom) — appearing text may never re-flow the rows below. -->
              <div class="con-hydro__routenotes" data-unfold-item>
                <span v-if="model.skippedStages.length > 0" class="con-hydro__routenote">
                  ↷ {{ $t('Skipped rewards') }}: {{ skippedNames }}
                </span>
                <span v-if="jumpedOverVp2" class="con-hydro__routenote">
                  ⤴ {{ $t('The occupied 2 VP position is leapt over to reach the 5 VP slot.') }}
                </span>
              </div>

              <!-- Outcome row: the honest «сейчас → станет» deltas. -->
              <div class="con-hydro__gains" data-unfold-item>
                <span class="con-hydro__section-label">{{ $t('You will gain') }}</span>
                <template v-if="model.targetNeedsChoice && rewardChoice === undefined">
                  <span class="con-hydro__gains-choice">
                    <HydroReward :chips="selectedStage.rewardOptions[0]" :compact="true" />
                    <span class="con-hydro__stop-or">{{ $t('or') }}</span>
                    <HydroReward :chips="selectedStage.rewardOptions[1]" :compact="true" />
                  </span>
                </template>
                <template v-else>
                  <span v-for="(l, i) in rewardView.lines" :key="i" class="con-hydro__delta" :class="{'con-hydro__delta--zero': l.delta === 0}">
                    <span class="con-hydro__delta-ico" :class="{'con-hydro__delta-ico--prod': l.production}">
                      <span class="con-hydro__delta-img" :class="deltaIconClass(l)" aria-hidden="true"></span>
                    </span>
                    <span class="con-hydro__beforeafter"><b>{{ l.before }}</b> <span aria-hidden="true">→</span> <b class="con-hydro__after">{{ l.after }}</b></span>
                    <span v-if="l.delta !== 0" class="con-hydro__plus">+{{ l.delta }}</span>
                  </span>
                  <HydroReward v-if="rewardView.lines.length === 0 && rewardView.rawChips.length > 0" :chips="rewardView.rawChips" />
                  <span v-if="rewardView.vp !== undefined" class="con-hydro__vpline">
                    <span class="con-hydro__stage-vp">{{ rewardView.vp }} {{ $t('VP') }}</span>
                    <span>{{ $t('VP at game end') }}</span>
                  </span>
                </template>
                <span v-if="fizzleNote !== ''" class="con-hydro__routenote con-hydro__routenote--warn">
                  ⚑ {{ $t('This reward will be skipped') }} — {{ $t(fizzleNote) }}
                </span>
              </div>

              <!-- The PRE-SELECT SUMMARY — the configured decision, focusable
                   («A Изменить» when the cursor stands here). -->
              <div v-if="summaryPresent"
                   class="con-hydro__summary"
                   :class="{'con-hydro__summary--focused': sceneFocus === 'summary'}"
                   data-unfold-item
                   role="button"
                   @click="onChangeSelection">
                <span class="con-hydro__section-label">{{ $t('Your selection') }}</span>
                <!-- (pos 1/2 has NO summary row: the reward is chosen and
                     CONFIRMED inside its own step, so nothing about it is
                     ever configured out here — see openChoiceStep.) -->
                <!-- pos 7: the chosen action — the SAME premium button graphic
                     the composers draw in their filled repeat slot. -->
                <span v-if="model.needsCardSelect === 'reuse-action' && model.selectedCard !== undefined && repeatNode !== undefined"
                      class="con-composer__repeatpick con-hydro__pick-action">
                  <span class="con-composer__repeatpick-graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="repeatNode.actionNode !== undefined" :effectData="repeatNode.actionNode" />
                    <CardRenderData v-else-if="repeatNode.renderRoot !== undefined" :renderData="repeatNode.renderRoot" />
                    <span v-else class="con-composer__graphic-text">{{ repeatNode.text }}</span>
                  </span>
                  <span class="con-composer__repeatpick-name">{{ $t(model.selectedCard) }}</span>
                  <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
                </span>
                <!-- pos 9: the chosen target card + the honest count. -->
                <span v-else-if="model.selectedCard !== undefined" class="con-hydro__summary-body">
                  <b>{{ $t(model.selectedCard) }}</b>
                  <span v-if="selectedAnimalCurrent !== undefined" class="con-hydro__pick-cur">
                    <span class="card-resource card-resource-animal" aria-hidden="true"></span>
                    {{ selectedAnimalCurrent }} → {{ selectedAnimalCurrent + 2 }}
                  </span>
                  <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
                </span>
              </div>

              <!-- CTA / the specific reasons — never a bare «недоступно». -->
              <div class="con-hydro__ctazone" data-unfold-item>
                <button v-if="primaryVerb !== 'blocked'" type="button"
                        class="con-hydro__cta"
                        :class="{'con-hydro__cta--configure': primaryVerb !== 'reinforce'}"
                        @click="onPrimary">
                  <GamepadGlyph control="confirm" />
                  <span>{{ $t(primaryLabel) }}</span>
                </button>
                <template v-else>
                  <div class="con-hydro__cta con-hydro__cta--disabled" aria-disabled="true">
                    <GamepadGlyph control="confirm" />
                    <span>{{ $t('Reinforce the hydronetwork') }}</span>
                  </div>
                  <div class="con-hydro__reasons">
                    <div v-if="requirementsUnmet" class="con-hydro__reason">
                      <span class="con-hydro__reason-glyph" aria-hidden="true">✕</span>
                      <span>{{ $t('Stage requirements are not met') }}</span>
                    </div>
                    <div v-for="(r, i) in ctaReasons" :key="i" class="con-hydro__reason" :class="{'con-hydro__reason--todo': !r.blocking}">
                      <span class="con-hydro__reason-glyph" aria-hidden="true">{{ r.blocking ? '✕' : '→' }}</span>
                      <span>{{ reasonText(r) }}</span>
                    </div>
                  </div>
                </template>
              </div>
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
        </div>

        <!-- ═══ REWARD CHOICE (pos 1/2) — a physical D-pad row of the two
             options AND the commit that follows them. The step is the WHOLE
             decision: pick → the CTA right underneath arms → confirm. The
             flow never walks BACKWARDS to be confirmed somewhere else (that
             was one press of pure delay), and because the choice belongs to
             the step it can never be left configured behind the player's
             back — leaving asks again next time. ═══ -->
        <div v-else-if="sceneKey === 'choice'" key="choice" class="con-hydro__layer con-hydro__layer--choice">
          <div class="con-hydro__panel con-hydro__panel--choice">
            <div class="con-hydro__choice-ask" data-unfold-item>{{ $t('Choose the stage reward') }}</div>
            <!-- ONE object per option: the reward's own icon is the HERO of
                 the card (it used to be printed twice — once as the abstract
                 chip, once inside the delta line — and both were small). The
                 name and the `сейчас → станет` reading stand beside it, so
                 the card reads as one statement instead of two stacked
                 renderings of the same thing. -->
            <div class="con-hydro__choice-row" data-unfold-item>
              <template v-for="(opt, i) in choiceOptions" :key="i">
                <span v-if="i > 0" class="con-hydro__choice-or" aria-hidden="true">{{ $t('or') }}</span>
                <button type="button"
                        class="con-hydro__choice-card"
                        :class="{
                          'con-hydro__choice-card--focused': choiceStage === 'options' && choiceFocus === i,
                          'con-hydro__choice-card--selected': rewardChoice === i,
                          'con-hydro__choice-card--muted': choiceStage === 'confirm' && rewardChoice !== i,
                        }"
                        @click="pickChoice(i)">
                  <template v-if="opt.line !== undefined">
                    <span class="con-hydro__choice-socket"
                          :class="{'con-hydro__choice-socket--prod': opt.line.production}">
                      <span class="con-hydro__choice-img" :class="deltaIconClass(opt.line)" aria-hidden="true"></span>
                    </span>
                    <span class="con-hydro__choice-read">
                      <span v-if="opt.line.labelKey" class="con-hydro__choice-name">{{ $t(opt.line.labelKey) }}</span>
                      <span class="con-hydro__choice-values">
                        <b>{{ opt.line.before }}</b>
                        <i class="con-hydro__choice-arrow" aria-hidden="true">→</i>
                        <b class="con-hydro__choice-after">{{ opt.line.after }}</b>
                        <em v-if="opt.line.delta !== 0" class="con-hydro__plus">+{{ opt.line.delta }}</em>
                      </span>
                    </span>
                  </template>
                  <!-- A reward with no concrete delta (never a pos 1/2 stage
                       today) still renders honestly through the shared chip. -->
                  <HydroReward v-else :chips="opt.chips" />
                  <span class="con-hydro__choice-mark" :class="{'con-hydro__choice-mark--on': rewardChoice === i}" aria-hidden="true">✓</span>
                </button>
              </template>
            </div>
            <!-- The step's OWN commit. Always in layout (it is what comes
                 next, and a row that appears would re-seat the cards under
                 the cursor); live only once an option is actually held. -->
            <div class="con-hydro__choice-cta" data-unfold-item>
              <button type="button"
                      class="con-hydro__cta"
                      :class="{
                        'con-hydro__cta--disabled': rewardChoice === undefined,
                        'con-hydro__cta--armed': choiceStage === 'confirm',
                      }"
                      :aria-disabled="rewardChoice === undefined ? 'true' : undefined"
                      @click="confirmChoiceStep">
                <GamepadGlyph control="confirm" />
                <span>{{ $t('Reinforce the hydronetwork') }}</span>
              </button>
            </div>
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

        <!-- ═══ COMMIT — the marker is travelling / the landed stage pays. ═══ -->
        <div v-else-if="sceneKey === 'commit'" key="commit" class="con-hydro__layer con-hydro__layer--commit">
          <div class="con-hydro__commitline" data-unfold-item>
            <span class="con-hydro__route">
              <span>{{ commitRec.fromPosition }}</span>
              <span aria-hidden="true">→</span>
              <b>{{ commitRec.toPosition }}</b>
              <span class="con-hydro__route-cost">
                −{{ commitRec.spend }}
                <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
              </span>
            </span>
            <b class="con-hydro__commit-stage">{{ $t(commitRec.stageNameKey) }}</b>
            <span class="con-hydro__commit-caption">{{ $t(commitCaption) }}<i class="con-hydro__commit-spin" aria-hidden="true"></i></span>
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

        <!-- ═══ RESULT — the compact read-hold summary. ═══ -->
        <div v-else key="result" class="con-hydro__layer con-hydro__layer--result">
          <div class="con-hydro__panel con-hydro__panel--result">
            <div class="con-hydro__result-head" data-unfold-item>
              <span class="con-hydro__bonus-tick" aria-hidden="true">✓</span>
              <b>{{ $t('Reinforcement complete') }}</b>
              <span class="con-hydro__result-stage">{{ $t(commitRec.stageNameKey) }}</span>
            </div>
            <div class="con-hydro__result-rows" data-unfold-item>
              <span class="con-hydro__route">
                <span>{{ commitRec.fromPosition }}</span>
                <span aria-hidden="true">→</span>
                <b>{{ commitRec.toPosition }}</b>
                <span class="con-hydro__route-cost">
                  −{{ commitRec.spend }}
                  <i class="con-hydro__chip-ico resource_icon resource_icon--energy" aria-hidden="true"></i>
                </span>
              </span>
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
            </div>
            <div class="con-hydro__result-hint" data-unfold-item>
              <GamepadGlyph control="confirm" />
              <span>{{ $t('Continue') }}</span>
            </div>
          </div>
        </div>
      </transition>
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
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {DeltaTrackPreviewModel} from '@/common/models/DeltaTrackPreviewModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {buildHydroModel, HydroModel, HydroStageVM} from '@/client/components/hydronetwork/hydroNetworkModel';
import {HydroStage} from '@/client/components/hydronetwork/hydroStages';
import {buildRewardView, HydroDeltaLine, HydroPlayerSnapshot, HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {destinationAt, gradeDestination, HydroReason, hydroPlanReasons, HydroStopGrade, HydroTurnState} from '@/client/components/hydronetwork/hydroReasons';
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
  hydroSceneLeaveHook, playHydroBridgeRelease, playHydroBridgeReturn, runHydroCeremony,
} from '@/client/console/hydroFlow/consoleHydroFlowMotion';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {getCard} from '@/client/cards/ClientCardManifest';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {motionMs} from '@/client/components/motion/motionTokens';
import {cardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {
  setWorkspaceFrameSlot, setWorkspaceFrameStage, setWorkspaceFrameSubject,
} from '@/client/console/consoleWorkspaceStack';
import {setWorkspaceOutcomeSlot, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
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

type SceneKey = 'preview' | 'choice' | 'target' | 'commit' | 'result';

export default defineComponent({
  name: 'ConsoleHydroSection',
  components: {
    GamepadGlyph, HydroReward, ConsoleWsHead, ConsolePlayedTargetStep, ConsoleCardFaceLite,
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
  },
  emits: ['close', 'confirm', 'pick', 'notice', 'collapse', 'result-done'],
  setup() {
    const {reduced} = useConsoleReducedMotion();
    return {reducedMotion: reduced};
  },
  data() {
    return {
      flow: hydroFlowState,
      hydroMarkerState,
      landings: cardResourceLandings,
      /** Scene focus: the track (A = primary) or the pre-select summary. */
      sceneFocus: 'track' as 'track' | 'summary',
      /** The reward picker's focused option (pos 1/2). */
      choiceFocus: 0,
      /** Where the cursor stands INSIDE the reward step: on the options, or
       *  on the commit that follows them (the step confirms itself). */
      choiceStage: 'options' as 'options' | 'confirm',
      /** The target step's cursor (pos 9). */
      targetFocus: undefined as PlayedTargetFocus | undefined,
      targetZoneW: 0,
      targetZoneH: 0,
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
      if (wf === undefined) {
        return 'not-your-turn';
      }
      return wf.type === 'or' && ACTION_MENU_TITLES.has(titleText(wf.title)) ? 'action-menu' : 'busy';
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
    statusKind(): 'ready' | 'used' | 'waiting' | 'end' | 'busy' | 'blocked' {
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
      case 'busy': return 'Finish your current action first';
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
    targetAffordable(): boolean {
      return this.model.destination?.affordable ?? false;
    },
    jumpedOverVp2(): boolean {
      return this.model.destination?.jumpedOverVp2 === true;
    },
    skippedNames(): string {
      return this.model.skippedStages.map((s) => translateText(s.nameKey)).join(', ');
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
      const c = this.flow.commit;
      if (c !== undefined) {
        return c.phase === 'result' ? 'result' : 'commit';
      }
      if (this.flow.step === 'reward') {
        return 'choice';
      }
      if (this.flow.step === 'target') {
        return 'target';
      }
      return 'preview';
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
    summaryPresent(): boolean {
      const m = this.model;
      if (m.mode !== 'plan') {
        return false;
      }
      return m.needsCardSelect !== undefined && m.selectedCard !== undefined;
    },
    /** What A means on the preview layer (the CTA and the bar agree). */
    primaryVerb(): 'reinforce' | 'choose-reward' | 'choose-action' | 'choose-card' | 'blocked' {
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
      if (m.mustSelectCard && m.selectedCard === undefined && this.reasons.every((r) => !r.blocking)) {
        return m.needsCardSelect === 'reuse-action' ? 'choose-action' : 'choose-card';
      }
      return m.canConfirm ? 'reinforce' : 'blocked';
    },
    primaryLabel(): string {
      switch (this.primaryVerb) {
      case 'choose-reward': return 'Choose a reward';
      case 'choose-action': return 'Choose an action';
      case 'choose-card': return 'Choose a card';
      default: return 'Reinforce the hydronetwork';
      }
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
    crumbSubject(): string {
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
    choiceOptions(): ReadonlyArray<{
      chips: HydroStage['rewardOptions'][number],
      line: HydroDeltaLine | undefined,
    }> {
      const stage = this.model.targetStage;
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
        // — a change of mind never leaves the step either.
        if (this.choiceStage === 'confirm') {
          return [
            {control: 'dpadU', control2: 'dpadD', label: 'Change selection', priority: 2},
            {control: 'confirm', label: 'Reinforce the hydronetwork'},
            {control: 'back', label: 'Cancel'},
          ];
        }
        return [
          {control: 'dpadH', label: 'Reward options', priority: 2},
          {control: 'confirm', label: 'Select'},
          {control: 'back', label: 'Cancel'},
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
      if (this.summaryPresent) {
        cmds.push({control: 'dpadU', control2: 'dpadD', label: 'Selection', priority: 3});
      }
      cmds.push({control: 'triggerR', label: 'Farthest stage'});
      if (this.model.mode === 'details') {
        cmds.push({control: 'confirm', label: 'Back to plan'});
      } else if (this.sceneFocus === 'summary') {
        cmds.push({control: 'confirm', label: 'Change selection'});
      } else {
        cmds.push({control: 'confirm', label: this.primaryLabel, enabled: this.primaryVerb !== 'blocked'});
      }
      cmds.push({control: 'back', label: 'To the board'});
      return cmds;
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
    // whole band, so this workspace hands the screen over and TAKES IT BACK
    // — never sits lit underneath. The release runs before the bridge opens
    // (see playBridgeHandoff); this is the return half, one tick after the
    // host has made us visible again (a tween on a hidden element lands as
    // a pop).
    'flow.repeatBridge'(on: boolean): void {
      if (!on) {
        void this.$nextTick(() => {
          playHydroBridgeReturn(this.$refs.rootEl as HTMLElement | undefined, this.reducedMotion === true);
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
      if (card === undefined && prev !== undefined &&
          hydroNetworkState.selectedCard === prev && this.flow.commit === undefined) {
        this.$emit('notice', translateText('The selected card is no longer available'));
        hydroNetworkState.selectedCard = undefined;
        consoleHydroUi.repeatResult = undefined;
      }
    },
  },
  mounted(): void {
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
    if (this.flow.step === 'target') {
      void this.$nextTick(() => this.seatTargetStep());
    }
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
      return r.params !== undefined ?
        translateTextWithParams(r.textKey, r.params.map(String)) :
        translateText(r.textKey);
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
    /**
     * HAND THE SCREEN to a nested full-scene step (the shell calls this
     * before opening the repeat browser). The workspace releases, and the
     * bridge opens on the settle — so the two surfaces are never both lit.
     */
    playBridgeHandoff(open: () => void): void {
      if (this.reducedMotion === true) {
        open();
        return;
      }
      playHydroBridgeRelease(this.$refs.rootEl as HTMLElement | undefined, open);
    },
    /** The panel-body RETUNE — the content breathes through a stop change
     *  while the panel frame stands still. GSAP owns the overlap semantics:
     *  a rapid re-step overwrites the running dip from its CURRENT pose. */
    retunePanel(): void {
      if (this.reducedMotion === true) {
        return;
      }
      const body = this.$refs.panelBody as HTMLElement | undefined;
      if (body === undefined || body === null) {
        return;
      }
      gsap.fromTo(body,
        {opacity: 0.45, y: 5 * conUiScale()},
        {
          opacity: 1, y: 0,
          duration: motionMs(230) / 1000,
          ease: 'power2.out',
          overwrite: 'auto',
          onComplete: () => gsap.set(body, {clearProps: 'opacity,transform'}),
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
      this.selectPosition(position);
    },
    selectPosition(position: number): void {
      const last = this.model.stages.length - 1;
      const next = Math.min(last, Math.max(0, position));
      if (next === this.model.selectedPosition) {
        return;
      }
      hydroNetworkState.selectedPosition = next;
      // NO SILENT DEFAULTS: a choice stage starts unconfigured — the player
      // sees both options and picks one deliberately, inside its own step.
      hydroNetworkState.rewardChoice = undefined;
      this.choiceStage = 'options';
      hydroNetworkState.selectedCard = undefined;
      consoleHydroUi.repeatResult = undefined;
      this.sceneFocus = 'track';
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
      case 'choose-action':
        this.$emit('pick');
        return;
      case 'choose-card':
        this.openTargetStep();
        return;
      case 'reinforce':
        this.emitConfirm();
        return;
      default:
        return;
      }
    },
    /** A on the summary / a click on it — revisit the configured pre-select.
     *  (Only the card picks have one: the reward is chosen and confirmed
     *  inside its own step, so it is never configured out here.) */
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
      armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__summary') ??
        root?.querySelector<HTMLElement>('.con-hydro__ctazone'));
    },
    armSceneFromCta(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armHydroSceneOrigin(root?.querySelector<HTMLElement>('.con-hydro__ctazone') ??
        root?.querySelector<HTMLElement>('.con-hydro__choice-cta') ??
        root?.querySelector<HTMLElement>('.con-hydro__panel'));
    },
    emitConfirm(): void {
      if (!this.model.canConfirm || this.flow.commit !== undefined) {
        return;
      }
      this.armSceneFromCta();
      const repeat = this.model.needsCardSelect === 'reuse-action' ? this.chosenRepeat : undefined;
      this.$emit('confirm', {
        spend: this.model.selectedSpend,
        rewardChoice: this.model.targetNeedsChoice ? hydroNetworkState.rewardChoice : undefined,
        selectedCard: this.model.mustSelectCard ? this.model.selectedCard : undefined,
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
        targetBefore: this.selectedAnimalCurrent,
      });
    },
    // ── the REWARD CHOICE step (pos 1/2) — pick AND confirm, in place ─────
    openChoiceStep(): void {
      if (this.model.targetStage === undefined || this.flow.step === 'reward') {
        return;
      }
      this.armSceneFromCta();
      // The choice is SCOPED TO THE STEP: entering always asks again, so a
      // reward can never be silently carried in from an earlier visit (and
      // «no auto-select» holds by construction — nothing is chosen yet).
      hydroNetworkState.rewardChoice = undefined;
      this.choiceFocus = 0;
      this.choiceStage = 'options';
      openHydroStep('reward');
    },
    /** A on an option — hold it and arm the commit right underneath. */
    pickChoice(index: number): void {
      hydroNetworkState.rewardChoice = index;
      this.choiceFocus = index;
      this.choiceStage = 'confirm';
    },
    /** A on the step's own CTA — the advance commits from HERE. */
    confirmChoiceStep(): void {
      if (this.rewardChoice === undefined) {
        return;
      }
      const blocking = this.reasons.filter((r) => r.blocking);
      if (blocking.length > 0) {
        this.$emit('notice', this.reasonText(blocking[0]));
        return;
      }
      this.emitConfirm();
    },
    /** B — leave the step with NOTHING configured behind it. */
    closeChoiceStep(): void {
      hydroNetworkState.rewardChoice = undefined;
      this.choiceStage = 'options';
      closeHydroStep();
      this.sceneFocus = 'track';
    },
    // ── the TARGET step (pos 9) ────────────────────────────────────────────
    openTargetStep(): void {
      const owners = this.targetStepModel?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      if (this.sceneFocus !== 'summary') {
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
            this.choiceFocus = (this.choiceFocus + (intent.dir === 'right' ? 1 : n - 1)) % n;
          } else if (intent.dir === 'down' && this.rewardChoice !== undefined) {
            this.choiceStage = 'confirm';
          } else if (intent.dir === 'up') {
            this.choiceStage = 'options';
          }
          return;
        }
        switch (consoleActionOf(intent)) {
        case 'primary':
          if (this.choiceStage === 'confirm') {
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
      // PREVIEW.
      if (intent.kind === 'nav') {
        if (intent.dir === 'left' || intent.dir === 'right') {
          this.sceneFocus = 'track';
          this.selectPosition(this.model.selectedPosition + (intent.dir === 'right' ? 1 : -1));
        } else if (intent.dir === 'down' && this.summaryPresent) {
          this.sceneFocus = 'summary';
        } else if (intent.dir === 'up') {
          this.sceneFocus = 'track';
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'nextTab': { // RT — jump to the FURTHEST legal+affordable stage.
        const max = this.preview?.maxLegalSteps ?? 0;
        if (max > 0) {
          this.sceneFocus = 'track';
          this.selectPosition(this.model.currentPosition + max);
        }
        return;
      }
      case 'primary':
        if (this.sceneFocus === 'summary') {
          this.onChangeSelection();
        } else {
          this.onPrimary();
        }
        return;
      case 'back':
        this.$emit('close');
        return;
      default:
        return;
      }
    },
  },
});
</script>
