<template>
  <!-- THE ACTION FOCUS STAGE — the in-frame focus state of the Action
       Browser (NOT a floating modal): the browse layer yields underneath and
       this stage recomposes the SAME frame around the chosen action. Its
       identity line (kicker · card name · variant) lives in the frame's
       header, owned by ConsoleCardActions.
       data-motion-*: the surface-motion contract — no own backdrop (the
       action center owns the shared `.con-shade`); the panel is the captured
       unit of the AWAITING handoff; the source card is the ANCHOR that FLIPs
       into the reveal result's «Источник» slot on the phase handoff. -->
  <div ref="rootEl" class="con-composer con-composer--stage"
       :class="{'con-composer--ptsel': playedTargetStepOpen, 'con-composer--colonystep': colonyStepOn}"
       role="region" :aria-label="$t('Action setup')" data-motion-surface="action-composer">
    <div class="con-composer__panel con-composer__panel--act con-composer__panel--stage" data-motion-panel>
      <!-- ── Two columns: the SOURCE CARD (the hero anchor — it physically
           arrives from the browser's inspector thumbnail, X inspects it
           fullscreen from this very slot) · the decision/summary column. -->
      <!-- data-ws-band: THE STRETCHED BAND. The embedded played-target step
           measures its own vertical budget as «this band's bottom minus my own
           top» — acyclic by construction (the band's height is fixed by the
           layout, the step's top by whatever sits above it), which is what lets
           the step cap itself and scroll only its cards. -->
      <div class="con-composer__actmain con-composer__actmain--stage" data-ws-band>
      <div class="con-composer__actside">
        <!-- The UNZOOMED wrap is the FLIP / zoom / anchor target (transform
             px stay 1:1) and the positioned host of the resource counter —
             the badge must sit OUTSIDE the card's `zoom:` context or the TV
             profile would scale it twice. -->
        <!-- `--committed` (bound to the submitting lock): the quiet COMMITTED
             accent — a calm ring, geometry-free, auto-clearing on rollback. -->
        <div class="con-composer__actcardwrap" aria-hidden="true"
             :class="{
               'con-composer__actcardwrap--committed': submitting,
               'con-composer__actcardwrap--targetfocus': selfTargetFocused,
               'con-composer__actcardwrap--targetlock': selfTargetLocked,
             }"
             :data-motion-anchor="'card:' + entry.cardName"
             :data-zoom-slot="entry.cardName"
             data-ptsel-source
             data-action-focus-card>
          <div class="con-composer__actcard con-composer__actcard--stage">
            <!-- Keyed micro-swap: a Viron repeat handoff re-points the stage to
                 the inner action's card without a remount — the face crossfades
                 while the slot (the FLIP/zoom target) stays stable. -->
            <!-- THE LIVE MODEL: the face's own capsule (bottom-left, beside
                 the expansion stamp) carries the stored count. It replaces
                 three readings that all said the same thing — a gold disc with
                 a bare number, a full-width «N на этой карте» plate below the
                 hero, and a printed «0» on the face itself. -->
            <transition name="con-actfocus-card" mode="out-in">
              <ConsoleCardFaceLite :key="entry.cardName" :name="entry.cardName" :card="heroCardModel" />
            </transition>
          </div>
        </div>
        <!-- (No stage-specific caption under the hero — deliberately. A local
             «L3 ИСТОЧНИК» line shipped once and participated in the column's
             layout, so the source card SHIFTED between setup and result — the
             one thing this slot must never do. The L3 verb lives in the ONE
             command bar; the hero column's children are identical in every
             phase, which is what makes its geometry stable by construction.) -->
      </div>
      <!-- THE SELF-TARGET CONNECTOR — the wire from the embedded step's
           «ИСТОЧНИК · ЭТА КАРТА» proxy to the hero card beside it. It sits on
           the BAND because that is the only element containing both ends, and
           only while there IS a self-target: out of flow (so this grid gains no
           track), but an always-mounted overlay would still run a
           ResizeObserver through every band animation of every card action. -->
      <ConsolePlayedTargetLink v-if="selfTargetPresent" />
      <div class="con-composer__actright">

      <!-- (No carried action graphic here: the pressed slot's schema stays in
           the browser where it serves comparison. This layer already says the
           same thing better — the source card, «Будет списано / Вы получите»
           and the live amount controls. What IS carried is the card; what
           unfolds is the pressed slot's own SURFACE, below.) -->

      <!-- ── THE OUTCOME STAGE ────────────────────────────────────────────
           A confirmed action stays IN THIS STAGE: the decision column yields
           to what the action PRODUCED, while the hero column (the source
           card) never moves — the operation reads as one scene from setup to
           result, not as a modal that replaced another modal.
           · deck-check («Результат вскрытия») — the slot the deck flight
             lands in + the status line below it («Вскрываем карту» → the ✓/✕
             outcome the moment the face is first visible);
           · draw («Добор карт») — the embedded reveal, below. -->
      <!-- ── THE COLONIES STEP — the colony workspace stands HERE, as a step
           of this action (`card-actions ⊃ colonies`, one teleported instance).
           It is the FIRST branch of this fork on purpose: a colony step is not
           an OUTCOME of a committed action. The trade-for-free branch commits
           nothing here — it walks the player to the trade the server already
           offers — so `outcome` is undefined all the way through, and hanging
           the zone off it meant the section mounted with nowhere to render.
           The section wears no shell of its own (rule 1); the crumb above
           carries the whole context — «ДЕЙСТВИЯ КАРТ › <карта> › ГАНИМЕД ·
           ТОРГОВЛЯ» — which is why nothing below repeats the source. -->
      <div v-if="colonyStepOn"
           class="con-composer__revealzone con-composer__colonyzone"
           data-outcome-zone
           data-embed-slot="action-colonies"></div>

      <template v-else-if="outcome !== undefined">

      <!-- ── DRAW — the action pulled cards off the deck. This zone is the
           TELEPORT TARGET the shell's ONE ConsoleRevealOverlay re-homes into
           (consoleWorkspaceOutcome): the very same instance that would have
           stood as the full-bleed band now renders HERE, in embedded dress —
           the same strip, take flights, hand intake and input handler, and
           the shell keeps owning its lifecycle, command bar and zoom routing.
           Nesting a second instance would have meant a second mount point and
           a second contract to keep in sync (and `Card.vue`'s split chunk
           makes it unimportable from a unit-tested component besides).
           The deck→slot cinematic needs no adaptation at all — it targets
           `.con-reveal [data-zoom-slot]` document-wide and those slots are now
           HERE, so the cards physically fly from the HUD pile into this column.
           The target is rendered from SUBMIT time (not from the batch's
           arrival) so it always exists before the teleport looks for it; until
           the cards land it shows the beat. -->
      <div v-if="drawOutcomeOn"
           ref="outcomeZone"
           class="con-composer__revealzone con-composer__revealzone--draw"
           data-outcome-zone
           data-embed-slot="workspace-reveal">
        <!-- THE EXECUTION BEAT is an ANIMATION, not a wait. The card peels off
             the HUD pile FACE-DOWN the instant the action is confirmed (a card
             back needs no data), travels here, and turns over only once the
             server's answer has landed. That buys the time the stage needs to
             be read — and hides the latency inside a beat the player wanted to
             watch anyway. A slow server simply leaves the card lying face-down
             on this slot: an honest "being drawn" state, never a fake face and
             never a dead screen. -->
        <!-- THE PREPARED STAGE. Not a placeholder: it is the SAME chassis the
             arriving surface wears (`con-ws-stage-frame / -head / -row /
             -status`) laid out by the SAME engine (consoleWsStageLayout), with
             one empty slot per promised card. That is what lets the batch fly
             straight into its FINAL rects — the handoff to the real cards is a
             zero-distance cross-over instead of a jump — and it is why the
             header, the count and the geometry do not move when the surface
             takes over. -->
        <div v-if="outcomePendingBeat" class="con-composer__beatstage con-ws-stage-frame"
             data-outcome-item aria-hidden="true">
          <ConsoleWsStageHead class="con-composer__beathead" :title="$t(beatTitleKey)">
            <template v-if="beatCount > 1" #badges>
              <span class="con-ws-stage-badge">
                <span class="con-ws-stage-badge__icon resource_icon resource_icon--cards"></span>
                <span class="con-ws-stage-badge__label">{{ $t('Received') }}</span>
                <b class="con-ws-stage-badge__num">{{ beatCount }}</b>
              </span>
            </template>
          </ConsoleWsStageHead>
          <div class="con-cards__strip con-ws-stage-row con-composer__beatrow"
               ref="beatRow" :style="beatRowStyle">
            <div v-for="i in beatCount" :key="i" ref="beatSlots"
                 class="con-cards__slot con-composer__beatslot"></div>
          </div>
          <div class="con-composer__beatstatus con-ws-stage-status" role="status">
            <span v-if="beatStalled" class="con-composer__revealstatus-spin" aria-hidden="true"></span>
            <span>{{ $t(beatStalled ? 'Drawing cards…' : 'Card draw') }}</span>
          </div>
        </div>
      </div>

      <!-- ── DECK-CHECK — the revealed card BESIDE its verdict, the reading
           order of the whole flow: the source card stands to the left (the hero
           column, unmoved since setup), the deck's answer next to it, and what
           that answer MEANS beside that. The verdict slot reserves its width
           from the phase's first frame, so the landing rect the flight was
           aimed at never moves under the arriving card. -->
      <div v-else class="con-composer__revealzone con-composer__revealzone--check" data-outcome-zone>
          <div class="con-composer__revealslot" ref="revealSlot" data-outcome-item
               :class="{
                 'con-composer__revealslot--met': revealOutcomeOn && revealPayload !== undefined && revealPayload.conditionMet,
                 'con-composer__revealslot--miss': revealOutcomeOn && revealPayload !== undefined && !revealPayload.conditionMet,
               }"
               :data-zoom-slot="revealPayload !== undefined ? 'revealed:' + revealPayload.revealed.name : undefined">
            <!-- The REAL revealed card — hidden (layout kept: the slot is the
                 flight's landing rect) until the flip settles; the swap with
                 the landed proxy happens in ONE flush (pixel-true). -->
            <ConsoleCardFaceLite v-if="revealPayload !== undefined"
                                 :name="revealPayload.revealed.name"
                                 :style="{visibility: revealStage === 'settled' ? 'visible' : 'hidden'}" />
          </div>
          <!-- The verdict SLOT — reserved width, so the swap «Вскрываем карту»
               → the full breakdown moves nothing. The breakdown itself is the
               SHARED panel (ConsoleRevealVerdict): the embedded stage and the
               legacy overlay render the same component, so the embedded flow
               can never again say less about the same event. -->
          <div class="con-composer__verdictslot">
            <transition name="con-actfocus-outcome" mode="out-in">
              <div v-if="!revealOutcomeOn || revealPayload === undefined" key="status" class="con-composer__revealstatus" role="status">
                <span class="con-composer__revealstatus-spin" aria-hidden="true"></span>
                <span>{{ $t('Revealing the card') }}</span>
              </div>
              <ConsoleRevealVerdict v-else key="outcome" :reveal="revealPayload" />
            </transition>
          </div>
        </div>
      </template>
      <template v-else>

      <!-- ── THE CONFIGURATION SURFACE — the deeper state of the pressed
           action slot. It is not a new modal that arrived: the slot's own
           surface UNFOLDS into it (workspaceDescend: the panel is clipped
           down to the button's rect and opens from there), and B folds it
           back. Everything the operation needs — the live formula, the
           decisions, the CTA — lives INSIDE it, and surfaces from inside it
           (`data-unfold-item`). The hero card stands beside it, carried. -->
      <div class="con-composer__surface" data-unfold-surface>

      <!-- ── WHAT THIS ACTION DOES — the operation's own sentence, and the
           surface's semantic lead: the player reads the RULE, then what it
           will cost/give, then commits. It is resolved for the SELECTED
           VARIANT (actionDescription: the curated information block of this
           very action node, else its printed DSL rule), so an «или» card
           never shows its other half's text. Same label vocabulary as the
           fullscreen ПРАВИЛА tab — one system, not a second reference. -->
      <div v-if="rules !== undefined" class="con-composer__rules" data-unfold-item>
        <div v-for="(line, k) in rules.lines" :key="k" class="con-composer__rule"
             :class="'con-composer__rule--' + line.kind">
          <span class="con-composer__rule-label">{{ $t(ruleLabel(line.kind)) }}</span>
          <p class="con-composer__rule-text">{{ ruleText(line.text) }}</p>
        </div>
      </div>

      <!-- ── Hero: the LIVE cost → reward formula of the ACTIVE branch.
           Shown once a branch is chosen (or a single-branch card); the
           multi-branch option cards below carry their own chips. ─────── -->
      <div v-if="showHero" class="con-composer__hero" data-unfold-item>
        <div v-if="heroCost.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('Will be spent') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroCost" :key="'c' + k" :effect="eff" />
          </div>
        </div>
        <span v-if="heroCost.length > 0 && heroGain.length > 0" class="con-composer__hero-arrow" aria-hidden="true">→</span>
        <div v-if="heroGain.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroGain" :key="'g' + k" :effect="eff" />
          </div>
        </div>
        <div v-if="heroChoice.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('You choose') }}</div>
          <div class="con-composer__hero-chips">
            <span v-for="(vc, k) in heroChoice" :key="'v' + k" class="con-composer__varchip">
              <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
              <b>{{ amountFor(vc.id) }}</b>
              <em>{{ $t('your choice') }}</em>
            </span>
          </div>
        </div>
      </div>
      <div v-else-if="!hasDecisions" class="con-composer__hero con-composer__hero--plain" data-unfold-item>{{ $t('Confirm to perform this action.') }}</div>

      <!-- ── The decision surface ─────────────────────────────────────── -->
      <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll" data-unfold-item>
        <!-- ── THE EMBEDDED PLAYED-TARGET STEP — a LEVEL of this workspace, the
             SAME component the card-play workspace uses. It replaces the
             decision column in place while the source card keeps its anchor to
             the left and the frame, header and bars never move. Not a modal, no
             backdrop, and no trip out to the «Разыграно» surface to answer a
             question this action asked. ────────────────────────────────────── -->
        <ConsolePlayedTargetStep v-if="sub !== undefined && sub.kind === 'playedTarget' && playedTargetModel !== undefined"
                                 ref="targetStep"
                                 :model="playedTargetModel"
                                 :layout="playedTargetLayout"
                                 :focus="sub.focus"
                                 :selection="playedTargetSelection"
                                 :bandHeight="playedTargetHeight"
                                 :lockedCard="playedTargetResults[sub.choiceId]?.cardName ?? ''" />

        <!-- SUB-STATE: a premium pick list (card / player / or). -->
        <template v-else-if="sub !== undefined && sub.kind === 'list'">
          <div class="con-composer__sub-title">{{ subTitle }}</div>
          <div v-for="(item, i) in listItems" :key="item.key"
               class="con-composer__opt"
               :class="{
                 'con-composer__opt--focused': sub.index === i,
                 'con-composer__opt--disabled': item.disabled,
                 'con-composer__opt--chosen': item.chosen,
               }"
               :ref="sub.index === i ? 'focusedEl' : undefined">
            <span v-if="item.color !== undefined" class="con-composer__opt-dot" :class="'player_bg_color_' + item.color" aria-hidden="true"></span>
            <span class="con-composer__opt-name">{{ item.label }}</span>
            <span v-if="item.resIcon !== ''" class="con-composer__opt-res">
              <i class="con-composer__opt-res-icon" :class="iconClass(item.resIcon)" aria-hidden="true"></i>
              <b>{{ item.resCount }}</b>
            </span>
            <span v-if="item.impact !== ''" class="con-composer__opt-impact">{{ item.impact }}</span>
            <!-- An or-option's own premium chips — the SAME `ActionEffectChip`
                 the branch formula and the play screen use, so «получить титан»
                 reads as `[титан] +1 · 10 → 11` and never as a bare word. -->
            <span v-for="(eff, k) in (item.chips ?? [])" :key="'ch' + k" class="con-composer__opt-chip"><ActionEffectChip :effect="eff" /></span>
            <span v-for="(w, k) in (item.warnings ?? [])" :key="'w' + k" class="con-composer__opt-warn">⚠ {{ $t(w) }}</span>
            <!-- «Это вы» on a PLAYER row: the rules allow hitting your own
                 production and we may not remove the option, so the job is to
                 make it impossible to pick by accident. Only when it COSTS you
                 and another target was selectable. -->
            <span v-if="item.selfHarm" class="con-composer__opt-warn">⚠ {{ $t('This is you') }}</span>
            <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
            <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
          </div>
        </template>

        <!-- MAIN (and the EXPANDED payment editor, which is this SAME screen
             with the payment block promoted — see the ConsolePaymentPanel
             mount below; the rows, the CTA and the source card never move). -->
        <template v-else>
          <template v-for="item in items" :key="item.id">
            <!-- A branch OPTION CARD (premium chips, like the desktop radiogroup). -->
            <div v-if="item.kind === 'branch'"
                 class="con-composer__branch"
                 :class="{
                   'con-composer__branch--focused': isFocused(item),
                   'con-composer__branch--selected': selectedPos === item.pos,
                   'con-composer__branch--disabled': !branchAt(item.pos).available,
                 }"
                 :data-branch-pos="item.pos"
                 :data-branch-nav="branchNavKind(item.pos)"
                 :ref="isFocused(item) ? 'focusedEl' : undefined">
              <span v-if="selectedPos === item.pos" class="con-composer__branch-check" aria-hidden="true">◉</span>
              <span v-else class="con-composer__branch-check con-composer__branch-check--off" aria-hidden="true">○</span>
              <div class="con-composer__branch-body">
                <div class="con-composer__branch-formula">
                  <template v-for="(eff, k) in branchView(item.pos).cost" :key="'c' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableCost" :key="'vc' + k" class="con-composer__varchip con-composer__varchip--spend">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-if="branchHasBothSides(item.pos)" class="con-composer__branch-arrow" aria-hidden="true">→</span>
                  <template v-for="(eff, k) in branchView(item.pos).gain" :key="'g' + k">
                    <ActionEffectChip :effect="eff" />
                  </template>
                  <span v-for="(vc, k) in branchView(item.pos).variableGain" :key="'vg' + k" class="con-composer__varchip con-composer__varchip--result">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b>
                  </span>
                  <span v-for="(vc, k) in branchView(item.pos).variableChoice" :key="'vx' + k" class="con-composer__varchip">
                    <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                    <b>{{ rangeText(vc) }}</b><em>{{ $t('your choice') }}</em>
                  </span>
                  <span v-if="branchView(item.pos).empty" class="con-composer__branch-title">{{ branchTitle(branchAt(item.pos)) }}</span>
                </div>
                <div v-if="branchView(item.pos).needs !== ''" class="con-composer__branch-needs">◈ {{ branchView(item.pos).needs }}</div>
                <div v-if="!branchAt(item.pos).available" class="con-composer__branch-reason">✕ {{ branchReason(branchAt(item.pos)) }}</div>
              </div>
            </div>

            <!-- A choice input row (amount inline / picker / spend-heat).
                 PAYMENT is NOT here — it's a persistent panel below, edited by
                 the dedicated LT + inline LB/RB, never a focus row. -->
            <div v-else-if="item.choice !== undefined"
                 class="con-composer__row"
                 :class="{
                   'con-composer__row--focused': isFocused(item),
                   'con-composer__row--missing': choiceMissing(item.choice),
                   'con-composer__row--dial': item.choice.id === focusFreeDialId,
                 }"
                 :ref="isFocused(item) ? 'focusedEl' : undefined">
              <!-- A refused commit lands HERE, and says so: one short local
                   pulse on the row that is holding it. Never a toast detached
                   from the problem, never a shake of the whole surface. The
                   `key` is what re-runs it — a repeated refusal must be
                   visible, not swallowed because the class was already on. -->
              <span v-if="blockFlashNonce > 0 && isBlockingRow(item)"
                    :key="'blk' + blockFlashNonce"
                    class="con-composer__row-flash" aria-hidden="true"></span>
              <!-- The REPEAT slot (Viron): empty → a prompt; filled → the chosen
                   action drawn as a button with its own action graphic. -->
              <template v-if="item.choice.repeatAction === true">
                <div class="con-composer__row-label">{{ $t('Action to repeat') }}</div>
                <!-- NESTED slot (composing an action that is itself a repeat
                     source, inside the repeat pick surface): read-only — the
                     server asks for this pick as the NEXT native task. -->
                <div v-if="repeatPickDisabled" class="con-composer__row-value">
                  <span class="con-composer__row-empty">↳ {{ $t('The action to repeat is chosen after confirming') }}</span>
                </div>
                <div v-else-if="repeatResult !== undefined" class="con-composer__repeatpick">
                  <div class="con-composer__repeatpick-graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="repeatNode !== undefined && repeatNode.actionNode !== undefined" :effectData="repeatNode.actionNode" />
                    <CardRenderData v-else-if="repeatNode !== undefined && repeatNode.renderRoot !== undefined" :renderData="repeatNode.renderRoot" />
                    <span v-else class="con-composer__graphic-text">{{ repeatNode !== undefined ? repeatNode.text : '' }}</span>
                  </div>
                  <span class="con-composer__repeatpick-name">{{ $t(repeatResult.chosenCard) }}</span>
                </div>
                <div v-else class="con-composer__row-value">
                  <span class="con-composer__row-empty">{{ $t('Choose an action to repeat') }}…</span>
                </div>
              </template>
              <template v-else-if="item.choice.kind === 'amount'">
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__stepper">
                  <i v-if="amountIcon(item.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(item.choice))" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ amountFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ amountModel(item.choice).min }} – {{ amountModel(item.choice).max }}</span>
                  <!-- A FOCUS-FREE dial advertises its own controls (the cursor
                       never visits it, so the pills are how the player learns it
                       is live) — the same affordance the payment chip wears. -->
                  <span v-if="item.choice.id === focusFreeDialId" class="con-composer__dial-pills">
                    <span class="con-composer__dial-pill" :class="{'con-composer__dial-pill--off': amountFor(item.choice.id) <= amountModel(item.choice).min}"><GamepadGlyph control="bumperL" /><span>−1</span></span>
                    <span class="con-composer__dial-pill" :class="{'con-composer__dial-pill--off': amountFor(item.choice.id) >= amountModel(item.choice).max}"><GamepadGlyph control="bumperR" /><span>+1</span></span>
                  </span>
                </div>
                <!-- The OPERATION preview — both sides' current→after for the
                     dialed value (the SHARED component the standalone prompt
                     renders; conversionPromptModel is the one derivation).
                     The old one-line notes stay only as the fallback for a
                     hint shape the VM cannot state honestly. (The one-element
                     v-for is the template-narrowing idiom — a method call
                     cannot be narrowed by v-if.) -->
                <template v-for="op in [amountOperation(item.choice)]" :key="item.choice.id + '#op'">
                  <ConsoleAmountOperation v-if="op !== undefined" :vm="op" compact />
                  <template v-else>
                    <div v-if="amountResultLine(item.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(item.choice) }}</div>
                    <div v-else-if="amountStockLine(item.choice) !== ''" class="con-composer__row-note">{{ amountStockLine(item.choice) }}</div>
                  </template>
                </template>
              </template>

              <template v-else-if="item.choice.kind === 'spendHeat'">
                <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                <div class="con-composer__stepper">
                  <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                  <span class="con-composer__stepper-value">{{ floatersFor(item.choice.id) }}</span>
                  <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                  <span v-if="item.choice.id === focusFreeDialId" class="con-composer__dial-pills">
                    <span class="con-composer__dial-pill"><GamepadGlyph control="bumperL" /><span>−1</span></span>
                    <span class="con-composer__dial-pill"><GamepadGlyph control="bumperR" /><span>+1</span></span>
                  </span>
                </div>
                <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(item.choice) }} · {{ $t('Floaters') }}: {{ floatersFor(item.choice.id) }}</div>
              </template>

              <!-- SELECTED TARGET SUMMARY — an answered played-target choice is
                   a LINK to a card still lying in its owner's tableau: a
                   thumbnail, its origin and the one contextual fact, never a
                   second full-size copy. The CHANGE affordance is drawn ONLY
                   under the cursor — a dimmed Ⓐ beside a focused commit row is
                   still a promise the button will not keep. -->
              <template v-else-if="playedTargetResult(item.choice) !== undefined">
                <div class="con-composer__row-label">{{ $t('Selected card') }}</div>
                <div class="con-composer__target" v-for="tgt in targetSummaryOf(item.choice)" :key="tgt.cardName">
                  <!-- A SOURCE-CARD target draws no thumbnail: the real card is
                       still in the hero slot to the left. -->
                  <div v-if="tgt.relation !== 'source-card'" class="con-composer__target-thumb" aria-hidden="true">
                    <ConsoleCardFaceLite :name="tgt.cardName" />
                  </div>
                  <span v-else class="con-composer__target-selflink" aria-hidden="true">↰</span>
                  <div class="con-composer__target-body">
                    <span class="con-composer__target-name">{{ $t(tgt.cardName) }}</span>
                    <span class="con-composer__target-dot" :class="'player_bg_color_' + tgt.ownerColor" aria-hidden="true"></span>
                    <span class="con-composer__target-origin" :class="'player_color_' + tgt.ownerColor">{{ tgt.ownerName }}</span>
                    <span v-for="imp in targetSummaryImpacts(item.choice)" :key="imp.key" class="con-ptsel__imp">
                      <i v-if="imp.icon" class="con-ptsel__imp-icon" :class="iconClass(imp.icon)" aria-hidden="true"></i>
                      <span class="con-ptsel__imp-label">{{ imp.translate === false ? imp.label : $t(imp.label) }}</span>
                      <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">{{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}</b>
                      <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
                    </span>
                  </div>
                  <span class="con-composer__target-change" :class="{'con-composer__target-change--on': isFocused(item)}">
                    <GamepadGlyph control="confirm" />
                    <span>{{ $t('Change selection') }}</span>
                  </span>
                </div>
              </template>
              <!-- The STAGE-REWARD slot (Dutch Mountains): empty → a prompt to
                   walk the track; filled → the claimed stage + its picks, with
                   the change affordance under the cursor (the target-summary
                   grammar). Structural off the input's own type. -->
              <template v-else-if="item.choice.input.type === 'deltaStageReward'">
                <div class="con-composer__row-label">{{ $t('Stage reward') }}</div>
                <div v-if="stageRewardSummary(item.choice) !== ''" class="con-composer__row-value">
                  <span>{{ stageRewardSummary(item.choice) }}</span>
                  <span class="con-composer__target-change" :class="{'con-composer__target-change--on': isFocused(item)}">
                    <GamepadGlyph control="confirm" />
                    <span>{{ $t('Change selection') }}</span>
                  </span>
                </div>
                <div v-else class="con-composer__row-value">
                  <span class="con-composer__row-empty">{{ $t('Choose a stage reward on the Hydronetwork') }}…</span>
                </div>
                <!-- THE EXACT RESULT of the claimed stage — the ONE hydro
                     reward view every landing renders (icons, honest
                     before → after, the draw's «посмотреть 4 / взять 2»
                     chips). The player confirms a stated outcome, never a
                     stage name; the position note stays the secondary line. -->
                <ConsoleHydroGains v-if="stageRewardPreview(item.choice) !== undefined"
                                   class="con-composer__stagegains"
                                   :view="stageRewardPreview(item.choice)!"
                                   :compact="true" />
                <div class="con-composer__row-note">{{ $t('Your Hydronetwork position will not change.') }}</div>
              </template>
              <template v-else>
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__row-value">
                  <span v-if="chosenLabel(item.choice) !== ''">{{ chosenLabel(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ pickPlaceholder(item.choice) }}…</span>
                  <span v-if="chosenImpact(item.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(item.choice) }}</span>
                </div>
              </template>
            </div>
          </template>

          <!-- Warnings (no-effect gains at cap). -->
          <div v-for="(w, i) in warnings" :key="'w' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">!</span><span class="con-composer__warn-text">{{ $t(w) }}</span>
          </div>

          <!-- SKIPPED effects (no valid target) — NAME which effect is lost + the
               magnitude, then why. Was folded into the "after confirming" list as a
               bare "⚠ <reason>" line, which said nothing about WHICH effect. -->
          <div v-for="(w, i) in skippedWarnings" :key="'sw' + i" class="con-composer__warn">
            <span class="con-composer__warn-glyph" aria-hidden="true">⚠</span>
            <span class="con-composer__warn-body">
              <span class="con-composer__warn-head">
                <span v-if="w.title !== ''" class="con-composer__warn-title">{{ w.title }}</span>
                <ActionEffectChip v-if="w.effect !== undefined" :effect="w.effect" :skipped="true" />
                <i v-else-if="w.icon !== ''" class="con-composer__warn-res" :class="w.icon" aria-hidden="true"></i>
              </span>
              <span class="con-composer__warn-text">{{ w.reason }}</span>
            </span>
          </div>

          <!-- Honest "after confirming" (board placement / reveal / notes).
               Same fixed-height «ДАЛЕЕ» row as the play composer. -->
          <div v-for="(n, i) in afterNotes" :key="'n' + i" class="con-composer__next" :aria-label="n.full">
            <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :style="tileIconStyle(n.tileType)" aria-hidden="true"></span>
            <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
            <span class="con-composer__next-label">{{ $t('Next') }}</span>
            <span class="con-composer__next-text">{{ n.text }}</span>
            <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
          </div>

          <!-- PAYMENT — the ONE shared panel, identical to the play-card flow.
               A persistent INFO block, NOT a focus row: the dedicated trigger +
               LB/RB reach it so it never competes with the decision rows / the
               CTA. The SAME panel becomes the EXPANDED editor in place (cursor
               inside, every source dialable) — never a separate screen. Usually
               0 or 1 panel. -->
          <!-- The panel mounts when a PRICED branch is selected — a soft rise
               (`con-composer__pay-in`) instead of the old one-frame pop into a
               standing column. -->
          <ConsolePaymentPanel v-for="pc in paymentChoices" :key="'pay' + pc.id"
                               class="con-composer__pay-in"
                               :view="paymentPanelView(pc)"
                               :mode="payModeFor(pc)"
                               :focus-unit="payFocusUnitFor(pc)"
                               :flash-nonce="payFlashFor(pc)" />

        </template>
      </ConsoleScrollArea>

      <!-- ── The CTA DOCK — pinned OUTSIDE the scroll so the confirm is
           always on screen (couch rule: the operation's exit is never hidden
           behind a scrollbar). Still a FOCUSABLE row drawing the Ⓐ glyph
           (mirrors the play composer): what A does is never ambiguous, and
           the confirm is a deliberate, visible press target. After the press
           the composer HOLDS the stage (awaiting the server's answer) — the
           CTA relabels to the in-flight state so the held beat reads as
           processing, never as an ignored press. -->
      <!-- The dock STAYS mounted while the payment editor is open (it just
           relabels to «Готово») — unmounting it there would move the whole
           column, which is exactly the jump this rework removes. -->
      <div v-if="sub === undefined || sub.kind === 'payment'" class="con-composer__ctadock" data-unfold-item>
        <!-- The honest readiness line: names the FIRST missing decision. -->
        <div v-if="ctaDockHint !== ''" class="con-composer__cta-hint">
          <span aria-hidden="true">◈</span>
          <span>{{ ctaDockHint }}</span>
        </div>
        <!-- THE COMMIT ROW. It stays in place whatever the gate says — the flow
             must keep its shape — but it only wears the ACTIVE treatment (ring,
             live Ⓐ) when the gate would actually run it. `--held` is the honest
             third state: readable, clearly not pressable, and never mistakable
             for «selected». `aria-disabled` carries the same fact to anything
             that is not looking at the pixels. -->
        <div class="con-composer__cta"
             :class="{
               'con-composer__cta--off': !ctaDockReady && !submitting,
               'con-composer__cta--ready': ctaDockReady && !submitting,
               'con-composer__cta--focused': ctaFocused && commitReady && !submitting,
               'con-composer__cta--held': !commitReady && !submitting,
               'con-composer__cta--waiting': submitting,
             }"
             :aria-disabled="!commitReady || submitting ? 'true' : 'false'"
             :ref="ctaFocused && commitReady ? 'focusedEl' : undefined"
             @click="submit">
          <!-- The glyph appears only with the press it stands for. -->
          <GamepadGlyph v-if="!submitting && commitReady" control="confirm" class="con-composer__cta-glyph" />
          <span v-else-if="submitting" class="con-composer__cta-wait" aria-hidden="true"></span>
          <span class="con-composer__cta-label">{{ $t(submitting ? 'Performing…' : ctaDockLabel) }}</span>
        </div>
      </div>

      </div><!-- /__surface -->
      </template><!-- /decision column (non-reveal) -->

      </div><!-- /__actright -->
      </div><!-- /__actmain -->

      <!-- ── The reveal FLIGHT layer: the face-down card pulled off the HUD
           deck pile, travelling into the reveal slot (fixed-position proxy —
           the shared deal chassis; the director owns every transform). ── -->
      <div v-if="revealFlightOn || beatFlightOn" class="con-composer__revealfly" aria-hidden="true">
        <!-- DECK-CHECK (Search For Life & co): ONE card, deliberately turned
             over AFTER it lands — the opening IS the game event there, and
             that beat is unchanged. -->
        <div v-if="revealFlightOn" class="con-deal-proxy" ref="revealProxy">
          <div class="con-deal-proxy__flip" ref="revealFlip">
            <div class="con-deal-proxy__face">
              <ConsoleCardFaceLite v-if="revealPayload !== undefined" :name="revealPayload.revealed.name" />
            </div>
            <div class="con-deal-proxy__back">
              <div class="con-card-back con-card-back--flyer"></div>
            </div>
          </div>
        </div>
        <!-- THE BATCH: one physical card object per drawn card, from the pile
             onward. The face is EMPTY until the answer names that card — which
             is precisely why the flight can start at confirm instead of waiting
             on the server, and why a late answer opens these very same cards
             instead of conjuring new ones. -->
        <template v-else>
          <div v-for="(face, i) in beatFaces" :key="'bp' + i" class="con-deal-proxy" ref="batchProxies">
            <div class="con-deal-proxy__flip" ref="batchFlips">
              <div class="con-deal-proxy__face">
                <ConsoleCardFaceLite v-if="face !== ''" :name="(face as CardName)" />
              </div>
              <div class="con-deal-proxy__back">
                <div class="con-card-back con-card-back--flyer"></div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- The GAIN beat: on a met condition the earned resource icon flies
           from the revealed card into the source card's counter — the player
           reads «открыл → условие выполнено → ресурс лёг на карту → счётчик
           обновился» as one continuous sentence. -->
      <i v-if="revealGainFlying" class="con-composer__gainfly" ref="gainFly"
         :class="revealRewardIconClass" aria-hidden="true"></i>

      <!-- The command contract (composer context) lives in the global
           command bar (CONSOLE_TV_PREMIUM_PLAN §3.2). -->
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleActionComposer — the console-native PRE-SUBMIT composer for a
 * blue-card / corporation action (iteration 2b). Desktop-parity with
 * CardActionConfirmContent + submitCardActionBatch: EVERY interactive choice
 * is made HERE, before the one final submit, AND rendered in the SAME premium
 * language — a multi-branch action shows its branches as OPTION CARDS with
 * per-branch cost→reward chips (`current → resulting`), exactly like the
 * desktop radiogroup (never a bare text list). The selected branch's inputs
 * (amount stepper / card / player / payment / or) are hosted inline; card &
 * player picks open a premium sub-list with resource icons + impact lines.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` builders;
 * the parent assembles the byte-identical batch. A Viron repeat-action step
 * hands off via `repeat-pick`.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {setConsoleActionComposerCommands, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {focusCommandRun, FocusRowKind} from '@/client/console/consoleActionFlow';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {DeltaStageRewardInputModel, SelectAmountModel, SelectCardModel, SelectPaymentModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionEntry} from '@/client/components/actions/actionModel';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {branchPositionsForNode, branchSetAvailability, branchTitleText, stripNodeOr} from '@/client/components/actions/actionBranchView';
import {ActionRules, ACTION_RULE_LABEL, actionRuleText, actionRules} from '@/client/components/actions/actionDescription';
import {
  ComposerChoice,
  branchChoices,
  preChoices,
  firstMissingChoice,
  spendHeatPlan,
  spendHeatStock,
  spendHeatResponse,
  spendHeatValid,
  orderedPreResponses,
  orderedStepResponses,
  focusFreeDialId,
  InlineDial,
  // The ONE «may a choice be seeded» rule — shared with the play composer.
  initialVariantSelection,
  // A branch that LEADS somewhere instead of asking for something.
  runtimeNavigationSteps,
} from '@/client/console/consoleActionComposer';
import {variablePartsForBranch, ConsoleVariableChip} from '@/client/console/consoleCardActions';
import {buildOrItems, orItemResponse, ConsoleOrItem} from '@/client/console/consoleOrChoice';
import {paymentLanes, megacreditsAvailable, paymentCovers, paymentFromCounts, initialCounts, dialLaneCount, buildPaymentView, PaymentView, PaymentSourceRow, editableRows, quickAdjustRow} from '@/client/console/paymentPlan';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeArrivalFlown, markWorkspaceOutcomeBeatDone, setWorkspaceOutcomeSlot, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {setWorkspaceFrameSlot, setWorkspaceFrameSourceCard, workspaceFrameHost} from '@/client/console/consoleWorkspaceStack';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {actionCommitState, armActionCommit, commitKindForBranch, commitRewardSpecs, markActionCommitSettled} from '@/client/console/consoleActionCommit';
import {ActionCommitMotionHandle, COMMIT_HANDOFF_AT_MS, pulseDeckPile, resolveActionCommitAnchors, resolveGainIconOrigins, runActionCommitMotion} from '@/client/console/consoleActionCommitMotion';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import type {ICardRenderEffect} from '@/common/cards/render/Types';
import {holdDeckDisplay, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {armOutcomeOrigin, playConfigRelease, playOutcomeContent, playOutcomePhase, resetOutcomeOrigin} from '@/client/console/consoleActionOutcomeMotion';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {TradeColonyContext, findTradeColonyContext} from '@/client/console/turnIntents';
import {lockedTradePaymentIndex, lockedTradePaymentReason} from '@/client/console/colonyTrade/colonyTradeEntry';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {reasonParams} from '@/client/cards/tagLabel';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {isBoilerplateTitle} from '@/client/console/consoleTaskSummary';
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import {targetImpactRows, targetImpactText, targetImpactIsLoss} from '@/client/components/modalInputs/targetImpactRows';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {runActionRevealFlight, runRevealGainFlight, ActionRevealFlightHandle, RevealGainFlightHandle} from '@/client/console/consoleActionRevealMotion';
import {BatchArrivalHandle, runBatchArrival, settleBatchProxiesOnto} from '@/client/console/consoleBatchArrivalMotion';
import {resolveCardArrivalMode} from '@/client/console/consoleCardArrival';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';
import {amountOperationVm, ConversionPromptVm} from '@/client/console/conversionPromptModel';
import ConsoleRevealVerdict from '@/client/components/console/foundation/ConsoleRevealVerdict.vue';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {enterConsoleHandPick, isHandCardSelection, isCardSelectionWithin} from '@/client/console/consoleHandPick';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {
  DeltaRewardDraft, deltaRewardCommitSpecs, deltaRewardDraftOf, deltaRewardPreviewView,
  deltaRewardStepResponse, enterDeltaRewardPick,
} from '@/client/console/hydroFlow/deltaRewardEntry';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import type {HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import ConsoleHydroGains from '@/client/components/console/hydroFlow/ConsoleHydroGains.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsolePlayedTargetLink from '@/client/components/console/played/ConsolePlayedTargetLink.vue';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, findPlayedTargetFocus, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner, playedTargetAt,
  playedTargetResultOf, playedTargetResultLive, playedTargetQuickImpacts, playedTargetSourceCardName,
  PLAYED_TARGET_SUMMARY_IMPACT_CAP,
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetNavDir, PlayedTargetCell,
  PlayedTargetResult, PlayedTargetQuickImpact, PlayedTargetSelection,
  togglePlayedTargetPick, playedTargetPicksValid, prunePlayedTargetPicks,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {
  computeCommitGate, commitAllowed, commitAcceptsCursor, commitCursorTarget,
  commitRedirectTarget, CommitGate, CommitRequirement,
} from '@/client/console/consoleCommitGate';

/**
 * A `v-for` string ref → a dense element array. Vue hands back an array, a
 * single node or nothing depending on which template branch rendered, and the
 * batch arrival needs the three parallel ref lists to line up by index; a duck
 * check rather than `instanceof` because the test runner's DOM is a different
 * realm.
 */
function asElements(ref: unknown): Array<HTMLElement> {
  const isEl = (el: unknown): el is HTMLElement =>
    el !== null && typeof el === 'object' &&
    typeof (el as HTMLElement).getBoundingClientRect === 'function';
  if (Array.isArray(ref)) {
    return ref.filter(isEl);
  }
  return isEl(ref) ? [ref] : [];
}

type GroupNode = ActionGroup['nodes'][number];
type Item = {id: string, kind: 'branch', pos: number} | {id: string, kind: 'choice', choice: ComposerChoice};
type SubState =
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'payment', choiceId: string, index: number}
  /**
   * The EMBEDDED played-card target step — the same component and the same
   * grammar the card-play workspace uses. It replaced the hand-off to the
   * «Разыграно» view's pick mode, which took the player OUT of the action
   * workspace to point at a card and gave them a full tableau to do it in.
   */
  | {kind: 'playedTarget', choiceId: string, focus: PlayedTargetFocus, picked: ReadonlyArray<string>};

type ListItem = {
  /** This row is the VIEWER, the move costs them, and another target existed. */
  selfHarm?: boolean;
  key: string,
  label: string,
  resIcon: string,
  resCount: number,
  impact: string,
  disabled: boolean,
  reason: string,
  chosen: boolean,
  color?: string,
  card?: CardModel,
  /** An or-option's premium chips (icon + `current → resulting`). */
  chips?: ReadonlyArray<ActionEffect>,
  /** The engine's own per-option cautions, already resolved to sentences. */
  warnings?: ReadonlyArray<string>,
  /** The source row of an or-option (its index IS the submitted response). */
  orItem?: ConsoleOrItem,
};

/** A branch's premium formula view (static chips + variable ranges). */
type BranchView = {
  cost: ReadonlyArray<ActionEffect>,
  gain: ReadonlyArray<ActionEffect>,
  variableCost: ReadonlyArray<ConsoleVariableChip>,
  variableGain: ReadonlyArray<ConsoleVariableChip>,
  variableChoice: ReadonlyArray<ConsoleVariableChip>,
  /** True when the branch has no chips at all (show its title). */
  empty: boolean,
  /** A named non-chip requirement (card / player pick) — never a mute variant. */
  needs: string,
};

const CHOICE_KIND_LABEL: Record<string, string> = {
  card: 'Choose a card', player: 'Choose a player', or: 'Choose an option', payment: 'Payment',
};

function textOf(v: string | Message | undefined, params?: ReadonlyArray<string>): string {
  if (v === undefined) {
    return '';
  }
  if (typeof v !== 'string') {
    return translateMessage(v);
  }
  // A reason template («Need ${0} more M€») is nothing without its params — the
  // slot renders literally, and the player is told a number-shaped non-answer.
  return params === undefined || params.length === 0 ?
    translateText(v) :
    translateTextWithParams(v, [...params]);
}

/**
 * WHAT THE CONFIRMED ACTION PRODUCES — the in-frame outcome stage's flavour.
 *
 * `deck-check` is the original: the top card is turned over and a condition is
 * checked, so the whole outcome IS a verdict and the composer draws it itself.
 * The other two are not the composer's to draw — a drawn batch and a card pick
 * already have premium standalone surfaces, and duplicating them here is how a
 * second, drifting implementation is born. They name the presenter instead and
 * the zone hosts it EMBEDDED.
 */
export type ComposerOutcome =
  /** Search For Life / Asteroid Deflection — `payload` lands with the answer. */
  | {kind: 'deck-check', payload?: RevealResultModel}
  /**
   * COMMITTED, cards promised, nothing back yet. A real stage of its own, not
   * a loading spinner: it holds the geometry (and the teleport target) that
   * the arriving outcome drops into, so the column never jumps between the
   * press and the cards.
   */
  | {kind: 'pending'}
  /**
   * The action produced CARDS and the zone is showing them. Deliberately one
   * kind for both a drawn batch and a follow-up pick (buy / keep-some): from
   * the stage's side they are the same phase — the same zone, the same name,
   * the same input gate — and which presenter the shell re-homed into it is
   * the shell's business, not a second state for the workspace to track.
   */
  | {kind: 'draw'};

export default defineComponent({
  name: 'ConsoleActionComposer',
  components: {ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, ConsoleScrollArea, ConsolePaymentPanel, ConsoleCardFaceLite, ConsoleWsStageHead, ConsoleRevealVerdict, ConsoleHydroGains, GamepadGlyph, ConsolePlayedTargetStep, ConsolePlayedTargetLink, ConsoleAmountOperation},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    entry: {type: Object as PropType<ActionEntry>, required: true},
    preview: {type: Object as PropType<ActionPreview | undefined>, default: undefined},
    nodeIndex: {type: Number, required: true},
    /**
     * The SELECTED variant's render node — the ACTION COMMIT's content-token
     * address into the hero card's printed graphic (data-graphic-node).
     * Optional by design: a collapse-restore rebuilds the stage from the
     * claim (no node), and the commit degrades to the mechanical beat over
     * the whole mechanics plate — the safe fallback, never a requirement.
     */
    actionGraphicNode: {type: Object as PropType<ICardRenderEffect | undefined>, default: undefined},
    /**
     * THE IN-FRAME OUTCOME STAGE. Set by the parent at confirm time from the
     * branch preview, it is what the confirmed action PRODUCES — and while it
     * is set the decision column yields to it, the hero card standing still.
     *
     * One prop, not one per flavour: «настройка → выполнение → результат» is a
     * single phase of a single surface, and the flavours differ only in which
     * presenter fills the zone. That is also why `pick`/`draw` reuse the real
     * standalone components in embedded mode instead of getting composer-local
     * copies — see consoleWorkspaceOutcome for the principle.
     */
    outcome: {type: Object as PropType<ComposerOutcome | undefined>, default: undefined},
    /** The commit-CTA label (i18n key). Default «Confirm action»; the repeat
     *  pick surface hosts this composer to COMPOSE a chosen action and reads
     *  «Выбрать это действие» (it captures, it doesn't submit to the server). */
    commitLabel: {type: String, default: 'Confirm action'},
    /**
     * Whether to publish the command contract to the SHARED `consoleActionComposerUi`
     * store (true = the normal Action Center stage). The repeat pick hosts a SECOND
     * composer instance nested under the outer (Viron) one; to avoid the two racing
     * on the shared store (and the inner's unmount clobbering the outer's state), the
     * inner sets this FALSE and receives the contract via `@commands` instead.
     */
    publishCommands: {type: Boolean, default: true},
    /**
     * A NESTED repeat slot is read-only: the repeat pick surface hosts this
     * composer to compose an already-CHOSEN action, and that action may itself
     * be a repeat source (Viron picked from the Hydronetwork's stage 7 / from
     * ProjectInspection). The `consoleRepeatPick` bridge is a singleton — a
     * second `enterConsoleRepeatPick` would clobber the outer pick's callbacks.
     * With this TRUE the slot renders as an honest «выбирается после
     * подтверждения» note, confirm doesn't require it, and the server's own
     * SelectCard arrives as the next native task (the sequential contract).
     */
    repeatPickDisabled: {type: Boolean, default: false},
  },
  emits: ['confirm', 'colony-trade', 'delta-advance', 'cancel', 'inspect-source', 'reveal-ack', 'commands'],
  data() {
    return {
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      /** The live ACTION COMMIT episode (killed on unmount / rollback). */
      commitHandle: undefined as ActionCommitMotionHandle | undefined,
      /** The draw beat's commit-handoff delay (cleared on abort/unmount). */
      beatDelayTimer: undefined as number | undefined,
      /** Path-watcher mirror of the commit lifecycle (the abort rollback). */
      actionCommitState,
      /** The composed repeat-action pick (Viron): the chosen already-used
       *  action + its own composed responses. Filled by `consoleRepeatPick`;
       *  the confirm carries it as `repeat` (NOT a plain step response). */
      repeatResult: undefined as ConsoleRepeatPickResult | undefined,
      /** The composed stage-reward claim (Dutch Mountains): the FULL draft —
       *  its wire response is the ordinary captured step, but the composed
       *  repeat inside it cannot be read back off the wire, so the claim /
       *  commit-wave derivations keep the draft beside the capture. */
      stageRewardDraft: undefined as DeltaRewardDraft | undefined,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      payCounts: {} as Record<string, Partial<Record<SpendableResource, number>>>,
      /** Re-keyed PER PAYMENT CHOICE on each adjust so the dialed row's one-shot
       *  pulse replays — a single shared counter flashed every mounted panel. */
      payFlash: {} as Record<string, number>,
      picks: {} as Record<string, string>,
      /** Multi-select hand picks by choice id (display; the capture is the truth). */
      multiPicks: {} as Record<string, ReadonlyArray<string>>,
      focusIdx: 0,
      /** Bumped when a refused commit redirects — the blocking row pulses once. */
      blockFlashNonce: 0,
      sub: undefined as SubState | undefined,
      /** The rich answered targets by choice id — identity, origin and the
       *  preview snapshot the summary renders. The capture stays the truth. */
      playedTargetResults: {} as Record<string, PlayedTargetResult>,
      /** Per-owner cursor memory for the tabbed mode. */
      playedTargetOwnerFocus: {} as Record<string, number>,
      /** The step's measured band — width from the work column, height from the
       *  STRETCHED row (`.con-composer__actmain`). Never from anything the
       *  cards themselves size, or the budget would be a function of its own
       *  answer (that inverted the card size for a single candidate once). */
      playedTargetWidth: 0,
      playedTargetHeight: 0,
      submitting: false,
      /** The reveal phase's visual stage: face down → face first shown
       *  (mid-flip; the status yields to the outcome) → settled (the REAL
       *  card owns the slot). */
      revealStage: 'pending' as 'pending' | 'face' | 'settled',
      /** The deck-flight proxy layer is mounted. */
      revealFlightOn: false,
      /** Path watchers need the module reactive mirrored in data(). */
      workspaceOutcomeState,
      /** The EXECUTION BEAT's own deck flight (face-down until the answer). */
      beatFlightOn: false,
      beatHandle: undefined as BatchArrivalHandle | undefined,
      /** The beat proxies touched down (a still-silent server now shows loading). */
      beatLanded: false,
      /**
       * THE BATCH — one entry per card that is physically coming off the deck,
       * FROZEN at launch. `''` is an honest unknown face (the card is on its
       * way, the server has not named it yet); the answer fills the entries in
       * place, so the very same objects open. Its LENGTH is the batch size and
       * never changes once the flight has begun — that invariant is what makes
       * «one card arrived and then multiplied» unrepresentable.
       */
      beatFaces: [] as Array<string>,
      /** The prepared stage's solved geometry (published onto the row). */
      beatRowStyle: {} as Record<string, string>,
      /** Bounded re-measure attempts while the stage is still laying out. */
      beatFitRetries: 0,
      /** The surface took the zone while cards were still opening — hand over
       *  the moment the arrival settles (never cut a turn mid-way). */
      beatHandoffPending: false,
      /** The live flight handle (payload release + abort). */
      revealHandle: undefined as ActionRevealFlightHandle | undefined,
      /** The stored-resource count CAPTURED when the reveal phase opened —
       *  the live tableau already carries the reward when the answer lands,
       *  so the counters hold the BEFORE value until the gain beat plays
       *  (the increment must be SEEN, never leaked early). */
      revealResBaseline: undefined as number | undefined,
      /** The gain beat delivered — the counters show the live value. */
      revealGainApplied: false,
      /** The flying reward icon (revealed card → the source counter). */
      revealGainFlying: false,
      revealGainHandle: undefined as RevealGainFlightHandle | undefined,
      /** One-shot pop on the counter + the «на этой карте» chip. */
      revealGainPop: false,
      revealGainPopTimer: undefined as number | undefined,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    /** Card names in the player's hand — a pick whose every candidate is a
     *  hand card routes to the hand section's pick mode. */
    handNamesSet(): ReadonlySet<string> {
      return new Set(this.playerView.cardsInHand.map((c) => c.name));
    },
    /**
     * Card names on ANY player's table — a pick whose every candidate lies on
     * some tableau routes to the EMBEDDED played-target step.
     *
     * ANY player, not the viewer's own: the boundary is the CAPABILITY (point
     * at a played card), never the owner. The previous rule read the viewer's
     * tableau alone, so a pick that could reach an opponent's card fell through
     * to a flat name list — the same misrouting that sent Robotic Workforce to
     * the wrong surface on the play side.
     */
    playedNamesSet(): ReadonlySet<string> {
      const names = new Set<string>();
      for (const player of this.playerView.players) {
        for (const c of player.tableau) {
          names.add(c.name);
        }
      }
      return names;
    },
    /** The embedded selector holds the surface right now. */
    playedTargetStepOpen(): boolean {
      return this.sub?.kind === 'playedTarget' && this.playedTargetModel !== undefined;
    },
    /** The choice the open (or pending) played-target step serves. */
    playedTargetChoice(): ComposerChoice | undefined {
      const id = this.sub?.kind === 'playedTarget' ? this.sub.choiceId : this.playedTargetRowId;
      return id === undefined ? undefined : this.allChoices.find((c: ComposerChoice) => c.id === id);
    },
    /** The FIRST decision row this step owns — used to render its summary and
     *  to warm the model before the player presses A. (The CHOICE id, never the
     *  row's own key: the two are different vocabularies.) */
    playedTargetRowId(): string | undefined {
      return this.allChoices.find((c: ComposerChoice) => this.isPlayedTargetChoice(c))?.id;
    },
    /**
     * THE EMBEDDED SELECTOR'S MODEL — built only while the step is open (or
     * warmed for the answered row), so an action with no played-card choice
     * never pays for it. Eligibility is the SERVER's candidate set, verbatim.
     */
    playedTargetModel(): PlayedTargetModel | undefined {
      const choice = this.playedTargetChoice;
      if (choice === undefined) {
        return undefined;
      }
      const model = choice.input as SelectCardModel;
      return buildPlayedTargetModel({
        candidates: model.cards,
        players: this.playerView.players,
        viewerColor: this.thisPlayer.color,
        // ONE selection instruction. The step's own contract line already says
        // «ВЫБЕРИТЕ РАЗЫГРАННУЮ КАРТУ · Доступных целей: N»; a boilerplate
        // server title under it just restates the effect the rule and the gain
        // chip have already stated. A title that names a real CONSTRAINT is not
        // boilerplate and keeps its line.
        ask: isBoilerplateTitle(model.title) ? '' : textOf(model.title),
        // The card whose action this is — «Обстрел кометами» adds its asteroid
        // to ANY card, and it is one. That candidate becomes a HANDLE pointing
        // at the hero slot instead of a second full-size copy of the same card.
        sourceCardName: this.entry.cardName,
        typeOf: (name) => getCard(name)?.type,
        // A NEGATIVE delta means the step takes FROM the chosen card, which is
        // what makes «your own card» a warning rather than the ordinary target.
        takesFromTarget: (choice.amount ?? 0) < 0,
        preview: (name) => this.playedTargetPreview(choice, name),
        resourceContext: (_name, card) => this.playedTargetResourceContext(choice, card),
      });
    },
    playedTargetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.playedTargetModel?.owners ?? [],
        availW: this.playedTargetWidth,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The live ask of the OPEN step. A COMPUTED, not a method: the template
     *  binds it and the input handlers read it every press. */
    playedTargetSelection(): PlayedTargetSelection {
      const choice = this.playedTargetChoice;
      return choice === undefined ? {mode: 'single'} : this.playedTargetSelectionFor(choice);
    },
    /** The game-state version a selection is only valid under. */
    playedTargetVersion(): string {
      return `${this.playerView.game.gameAge}|${this.playerView.game.undoCount ?? 0}`;
    },
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    positions(): ReadonlyArray<number> {
      if (this.nodeIndex < 0) {
        return this.branches.map((_b, i) => i);
      }
      return branchPositionsForNode(this.entry.group, this.branches, this.nodeIndex);
    },
    /** Show the branch radiogroup (a combined node maps to >1 branch). */
    needBranchRow(): boolean {
      return this.positions.length > 1;
    },
    /**
     * EVERY option this variant offers is refused — the SAME rule the browse grid
     * blocks the row with (`nodeAvailability`), asked again here because the state
     * can move between the press and this screen (another action spent the
     * resource, a server response landed). Nothing on this screen can fix it:
     * there is no legal branch to select, so «Выберите вариант» would be an
     * instruction the player cannot follow — the gate states the reason instead.
     */
    variantBlockedReason(): string | undefined {
      const verdict = branchSetAvailability(this.positions.map((p) => this.branches[p]).filter((b) => b !== undefined));
      if (!verdict.allBlocked) {
        return undefined;
      }
      const first = verdict.reasons[0];
      return first === undefined ?
        translateText('Unavailable right now') :
        textOf(first.message, first.params);
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      return this.selectedPos !== undefined ? this.branches[this.selectedPos] : undefined;
    },
    preChoiceList(): ReadonlyArray<ComposerChoice> {
      return preChoices(this.preview);
    },
    branchChoiceList(): ReadonlyArray<ComposerChoice> {
      return branchChoices(this.selectedBranch);
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...this.preChoiceList, ...this.branchChoiceList];
    },
    /**
     * The RENDER list, in reading order: preSteps · branch option cards · branch
     * inputs. PAYMENT is not here (it's a persistent panel of its own, below);
     * a FOCUS-FREE dial IS here — it renders in place, it just isn't navigable.
     */
    items(): ReadonlyArray<Item> {
      const out: Array<Item> = [];
      for (const c of this.preChoiceList) {
        if (c.kind !== 'payment') {
          out.push({id: c.id, kind: 'choice', choice: c});
        }
      }
      if (this.needBranchRow) {
        for (const pos of this.positions) {
          out.push({id: 'branch#' + pos, kind: 'branch', pos});
        }
      }
      for (const c of this.branchChoiceList) {
        if (c.kind !== 'payment') {
          out.push({id: c.id, kind: 'choice', choice: c});
        }
      }
      return out;
    },
    /**
     * The NAV list — what the cursor actually walks: the render rows MINUS the
     * focus-free dial. A dial you can drive globally with LB/RB must not eat a
     * cursor stop (and an extra A to leave it): with a lone stepper the cursor
     * starts on the CTA, so «покрутил LB/RB → A» is the whole interaction.
     */
    navItems(): ReadonlyArray<Item> {
      const free = this.focusFreeDialId;
      return this.items.filter((it) => {
        if (it.kind !== 'choice') {
          return true;
        }
        // The focus-free dial is driven globally with LB/RB — no cursor stop.
        if (free !== undefined && it.choice.id === free) {
          return false;
        }
        // The read-only NESTED repeat slot is a note, not a control.
        return !(it.choice.repeatAction === true && this.repeatPickDisabled);
      });
    },
    /** Every payment choice (pre + branch) — rendered as persistent panels,
     *  NOT nav rows. Normally 0 or 1; a card with several SelectPayment steps
     *  shows one panel each (the dedicated LT / LB/RB target the FIRST). */
    paymentChoices(): ReadonlyArray<ComposerChoice> {
      return this.allChoices.filter((c) => c.kind === 'payment');
    },
    /** The payment the dedicated LT button / inline LB/RB act on. */
    primaryPaymentChoice(): ComposerChoice | undefined {
      return this.paymentChoices[0];
    },
    /** Every INLINE DIAL on screen (steppers + the single-alt payment quick-adjust). */
    inlineDials(): ReadonlyArray<InlineDial> {
      const out: Array<InlineDial> = [];
      for (const c of this.allChoices) {
        if (c.kind === 'amount' || c.kind === 'spendHeat') {
          out.push({id: c.id, kind: c.kind});
        }
      }
      const pay = this.primaryPaymentChoice;
      // A payment counts as a dial only when it OFFERS the inline quick-adjust
      // (exactly one alt lane); a complex / pure-M€ payment is LT-only.
      if (pay !== undefined && this.paymentPanelView(pay).quickAdjustEligible) {
        out.push({id: pay.id, kind: 'payment'});
      }
      return out;
    },
    /** The stepper that leaves the focus list (the sole non-payment dial). */
    focusFreeDialId(): string | undefined {
      return focusFreeDialId(this.inlineDials);
    },
    /** That stepper's choice — the global LB/RB / RT target. */
    focusFreeDialChoice(): ComposerChoice | undefined {
      const id = this.focusFreeDialId;
      return id === undefined ? undefined : this.allChoices.find((c) => c.id === id);
    },
    /**
     * Is there anything to SET UP (drives the «Настройка действия» kicker + the
     * bare-confirm plain line)? Counts the NON-focusable surfaces too — the
     * payment panel and a focus-free dial are decisions even though the cursor
     * never stops on them; without this a payment-only / stepper-only action
     * would mislabel itself as a bare confirmation.
     */
    hasDecisions(): boolean {
      return this.items.length > 0 || this.paymentChoices.length > 0;
    },
    /** The hero is the selected/single branch's live formula (multi-branch
     *  option cards carry their own chips → no hero until one is chosen). */
    showHero(): boolean {
      return this.selectedBranch !== undefined &&
        (this.heroCost.length + this.heroGain.length + this.heroChoice.length > 0);
    },
    /** The repeat-action choice (Viron) — a SelectCard of already-used actions
     *  filled by the repeat pick surface, not captured like a normal step. */
    repeatChoice(): ComposerChoice | undefined {
      return this.branchChoiceList.find((c) => c.repeatAction === true);
    },
    /**
     * The RULE TEXT of the action being composed — resolved for THIS variant
     * (`nodeIndex`), never for the card. A combined whole-card draft
     * (nodeIndex < 0, the Viron handoff) has no single rule and shows none.
     * The selected branch's title is the last-resort wording for a card that
     * carries neither a curated information block nor a printed description.
     */
    rules(): ActionRules | undefined {
      const branch = this.selectedBranch;
      return actionRules(this.entry.group, this.nodeIndex, branch === undefined ? undefined : branchTitleText(branch));
    },
    /** The chosen action's render node — the graphic drawn in the filled slot. */
    repeatNode(): GroupNode | undefined {
      const r = this.repeatResult;
      if (r === undefined) {
        return undefined;
      }
      const group = playerActionGroups([{name: r.chosenCard} as CardModel])[0];
      const node = group?.nodes[r.nodeIndex] ?? group?.nodes[0];
      return node !== undefined ? stripNodeOr(node) : undefined;
    },
    canConfirm(): boolean {
      const branch = this.selectedBranch;
      if (this.preview === undefined || branch === undefined || !branch.available) {
        return false;
      }
      // The repeat slot (Viron) must be filled before confirming — unless the
      // slot is the read-only NESTED one (resolved post-submit by the server).
      if (!this.repeatPickDisabled && this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return false;
      }
      if (!this.preChoiceList.every((c) => this.capturedPre[c.index] !== undefined)) {
        return false;
      }
      if (branch.optionInput !== undefined && this.capturedOption === undefined) {
        return false;
      }
      // Every NON-repeat input step must be captured (the repeat step rides the
      // `repeat` payload, so it is never a plain captured step).
      return branch.steps.every((step, i) =>
        step.kind !== 'input' || step.repeatAction === true || this.captured[i] !== undefined);
    },
    /**
     * The hero card's LIVE model, carrying the count the player should SEE.
     *
     * The premium face owns the counter (its carved capsule beside the
     * expansion stamp); handing it only a NAME made it print a permanent «0»,
     * which is why the real number used to be told again by a badge and a
     * plate. Handing it the tableau model straight would lose the gain BEAT:
     * during a deck-check the count is deliberately frozen at the pre-reveal
     * value until the reward lands, so the model is passed with
     * `displayedStoredCount` — the one value that already encodes that pause.
     */
    heroCardModel(): CardModel | undefined {
      const model = this.thisPlayer.tableau.find((c) => c.name === this.entry.cardName);
      if (model === undefined || this.storedResource === undefined) {
        return model;
      }
      return {...model, resources: this.displayedStoredCount};
    },
    /** The live stored resource on the SOURCE card (the pool most spend-branches
     *  consume) — the gain beat's baseline and the flight's subject. */
    storedResource(): {icon: string, count: number} | undefined {
      const model = this.thisPlayer.tableau.find((c) => c.name === this.entry.cardName);
      const type = getCard(this.entry.cardName)?.resourceType;
      if (model?.resources === undefined || type === undefined) {
        return undefined;
      }
      return {icon: String(type), count: model.resources};
    },
    /** The honest disabled-CTA reason: names the FIRST missing decision so a
     *  dimmed confirm is never mute about WHY. Empty when ready / in flight. */
    ctaHint(): string {
      if (this.submitting || this.canConfirm) {
        return '';
      }
      // The GATE outranks every field: when it says the action itself cannot be
      // performed, the honest line is its reason — never «Выберите вариант» over
      // options that are all refused (the state the dimmed CTA sat above).
      const gate = this.commitGate;
      if (gate.kind === 'blocked') {
        return gate.reason;
      }
      if (!this.repeatPickDisabled && this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return translateText('Choose an action to repeat');
      }
      if (this.selectedBranch === undefined && this.needBranchRow) {
        return translateText('Choose an option');
      }
      const missing = firstMissingChoice(this.preview, this.selectedBranch, {
        pre: this.capturedPre, option: this.capturedOption, steps: this.captured,
      });
      if (missing === undefined) {
        return '';
      }
      switch (missing.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      case 'payment': return translateText('Configure payment');
      case 'spendHeat': return translateText('Heat sources');
      default: return '';
      }
    },
    // ── the outcome stage ────────────────────────────────────────────────
    /** The DECK-CHECK flavour is live — the composer draws the verdict itself. */
    deckCheckOn(): boolean {
      return this.outcome?.kind === 'deck-check';
    },
    /**
     * The post-commit CARD phase is live — the column belongs to the outcome.
     * `pending` and `draw` are one phase to everything outside the zone: the
     * geometry, the kicker and the input gate must not change when the cards
     * happen to land.
     */
    drawOutcomeOn(): boolean {
      return this.outcome?.kind === 'draw' || this.outcome?.kind === 'pending';
    },
    /** A SelectColony this activation raised is HOSTED here — the colonies
     *  section teleports into the outcome column (workspace-embed). */
    colonyStepOn(): boolean {
      return workspaceFrameHost('colonies') === 'card-actions';
    },
    /** Still waiting: the zone is standing but nothing has been re-homed yet. */
    outcomePendingBeat(): boolean {
      return this.drawOutcomeOn && workspaceOutcomeState.stage !== 'presenting';
    },
    /**
     * The card has LANDED but the server still has not answered — the genuine
     * lag case. Only here does a loading affordance appear; before it, the
     * flight itself is the state and a spinner would be noise over a card that
     * is visibly travelling.
     */
    beatStalled(): boolean {
      return this.beatLanded && !workspaceOutcomeState.answerIn;
    },
    /**
     * THE CARDS THAT WERE ACTUALLY DRAWN — read off the arriving artifact,
     * never off `entry.cardName` (that is the ACTING card, and painting it in
     * flight made the deck hand the player a second copy of «Союз
     * изобретателей», with the real face only appearing after landing).
     *
     * Two shapes, because two artifacts can answer a draw:
     *  · a card PICK (buy / keep-some) — the prompt's candidates ARE the cards
     *    the deck turned over;
     *  · a drawn BATCH — the reveal event carries them.
     * Empty until the answer lands, which is exactly when the faces are allowed
     * to exist (the batch flies face-down until then).
     */
    beatRevealedNames(): ReadonlyArray<string> {
      const wf = this.playerView.waitingFor as {cards?: ReadonlyArray<{name: string}>} | undefined;
      const fromPrompt = (wf?.cards ?? []).map((c) => c.name).filter((n) => n !== '');
      if (fromPrompt.length > 0) {
        return fromPrompt;
      }
      return (currentRevealEvent()?.cards ?? []).map((c) => c.name);
    },
    /** How many physical cards the prepared stage reserves a slot for. */
    beatCount(): number {
      return this.beatFaces.length;
    },
    /**
     * The prepared stage's own sentence. It is the DRAW's heading, not the
     * arriving surface's — the surface may turn out to be a buy pick, and
     * promising «Купить» before the server has said so would be a lie. The
     * plural follows the count, which is known from the claim.
     */
    beatTitleKey(): string {
      return this.beatCount > 1 ? 'Cards received' : 'Card received';
    },
    /** The outcome stage owns the column (any flavour) — drives the phrase. */
    outcomeStageOn(): boolean {
      return this.outcome !== undefined;
    },
    /** A re-homed surface has landed in the zone (drives the REVEAL half). */
    outcomeContentIn(): boolean {
      return this.drawOutcomeOn && workspaceOutcomeState.stage === 'presenting';
    },
    revealPayload(): RevealResultModel | undefined {
      return this.outcome?.kind === 'deck-check' ? this.outcome.payload : undefined;
    },
    /** The outcome replaces the «Вскрываем карту» status the moment the face
     *  is FIRST visible (mid-flip) — never before. */
    revealOutcomeOn(): boolean {
      return this.revealStage !== 'pending' && this.revealPayload !== undefined;
    },
    /* (No `revealVpGain` here any more: the VP delta is one row of the SHARED
       verdict panel, which derives it from the same payload — one reading of
       one fact, in the one place that renders it.) */
    /** The counter value the player SEES: the pre-reveal baseline until the
     *  gain beat lands, the live tableau value everywhere else. */
    displayedStoredCount(): number {
      const live = this.storedResource?.count ?? 0;
      if (this.deckCheckOn && !this.revealGainApplied && this.revealResBaseline !== undefined) {
        return this.revealResBaseline;
      }
      return live;
    },
    revealRewardIconClass(): string {
      const icon = this.revealPayload?.reward?.icon;
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    /** What kind of row the focus cursor is on — drives the A-verb of the
     *  command contract (the bar always names exactly what A will do). */
    focusedRowKind(): FocusRowKind {
      if (this.navItems.length === 0) {
        return 'none';
      }
      if (this.ctaFocused) {
        return 'cta';
      }
      const item = this.focusedItem;
      if (item === undefined) {
        return 'cta';
      }
      if (item.kind === 'branch') {
        return 'branch';
      }
      if (item.choice.kind === 'amount') {
        return 'amount';
      }
      if (item.choice.kind === 'spendHeat') {
        return 'spendHeat';
      }
      return 'pick';
    },
    /** The composer's live command contract, published to the ONE shell bar
     *  (consolePanelUi 'actionComposer' — plan §3.2; the old in-panel footer
     *  is gone). Built by the PURE stage builder (consoleActionFlow), so the
     *  bar can never disagree with the flow stage: X is always «Осмотреть»
     *  (the source card / a card list's focused row), the confirm is ONLY the
     *  A press on the CTA row, and the committed hold reads as «Выполняется…». */
    footCommands(): Array<ConsoleCommand> {
      if (this.drawOutcomeOn) {
        // Only the PENDING beat is the stage's to narrate. Once the reveal has
        // teleported in, the shell publishes ITS contract (the shared
        // `drawnRevealCommandRun`) — the component that owns the cards owns
        // their buttons, so there is nothing to paraphrase here.
        return focusCommandRun({state: 'draw-pending'});
      }
      if (this.deckCheckOn) {
        return focusCommandRun(this.revealStage === 'settled' && this.revealPayload !== undefined ?
          {state: 'reveal-shown'} : {state: 'reveal-pending'});
      }
      if (this.submitting) {
        return focusCommandRun({state: 'awaiting'});
      }
      if (this.sub !== undefined) {
        if (this.sub.kind === 'payment') {
          return focusCommandRun({state: 'sub-payment', covers: this.paymentView?.status.ok === true});
        }
        if (this.sub.kind === 'playedTarget') {
          const sel = this.playedTargetSelection;
          return focusCommandRun({
            state: 'sub-played-target',
            ownerTabs: this.playedTargetLayout.mode === 'tabs' && (this.playedTargetModel?.owners.length ?? 0) > 1,
            multi: sel.mode === 'multi' ? {
              count: sel.picked.length,
              valid: playedTargetPicksValid(sel),
              verb: (this.playedTargetChoice?.input as SelectCardModel | undefined)?.buttonLabel || 'Select',
            } : undefined,
          });
        }
        return focusCommandRun({state: 'sub-list', cardList: this.subChoice?.input.type === 'card'});
      }
      const kind = this.focusedRowKind;
      const item = this.focusedItem;
      const resolved = kind === 'pick' && item?.kind === 'choice' && !this.choiceMissing(item.choice);
      const pay = this.primaryPaymentChoice;
      const payView = pay !== undefined ? this.paymentPanelView(pay) : undefined;
      return focusCommandRun({
        state: 'main', focused: kind, resolved,
        // ONE answer drives the bar and the row alike — the bar can never
        // advertise a confirm the gate has already refused.
        canConfirm: this.commitReady,
        pickVerb: item?.kind === 'choice' ? this.requirementVerb(item.choice) : undefined,
        // ONE verb for the row and the bar. They used to be resolved
        // separately, so the row could read «Выбрать колонию» while the bar
        // under it still promised «Подтвердить» — two answers to «what does A
        // do», on one screen, at the same time.
        commitLabel: this.commitVerbKey !== 'Confirm action' ? this.commitVerbKey : undefined,
        // LB/RB follow the ACTIVE dial (the same resolution the input uses), and
        // LT is the payment editor's dedicated, focus-independent entry.
        dial: this.activeDialHint,
        paymentEditor: payView?.editorEligible === true,
      });
    },
    /**
     * WHICH dial LB/RB drive right now — the SINGLE resolution shared by the
     * command bar and `onMainPress`, so the bar can never promise a dial the
     * input doesn't move: a FOCUSED stepper first (it's the one the cursor is
     * on), else the focus-free sole stepper, else the payment quick-adjust.
     */
    activeDialChoice(): ComposerChoice | undefined {
      const item = this.focusedItem;
      if (item?.kind === 'choice' && (item.choice.kind === 'amount' || item.choice.kind === 'spendHeat')) {
        return item.choice;
      }
      if (this.focusFreeDialChoice !== undefined) {
        return this.focusFreeDialChoice;
      }
      const pay = this.primaryPaymentChoice;
      return pay !== undefined && this.paymentPanelView(pay).quickAdjustEligible ? pay : undefined;
    },
    /** The active dial as the command bar's hint (payment reports its limits). */
    activeDialHint(): {kind: 'amount' | 'spendHeat' | 'payment', canDecrease?: boolean, canIncrease?: boolean} | undefined {
      const c = this.activeDialChoice;
      if (c === undefined) {
        return undefined;
      }
      if (c.kind === 'amount' || c.kind === 'spendHeat') {
        return {kind: c.kind};
      }
      const row = quickAdjustRow(this.paymentPanelView(c));
      return {kind: 'payment', canDecrease: row?.canDecrease === true, canIncrease: row?.canIncrease === true};
    },
    heroCost(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticCost(c));
      }
      return out;
    },
    heroGain(): ReadonlyArray<ActionEffect> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const variable = variablePartsForBranch(branch);
      const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      for (const c of this.allChoices) {
        out.push(...this.syntheticGain(c));
      }
      if (branch.reveal !== undefined) {
        out.push(branch.reveal.reward);
      }
      return out;
    },
    heroChoice(): ReadonlyArray<{id: string, icon?: string}> {
      const out: Array<{id: string, icon?: string}> = [];
      for (const c of this.allChoices) {
        if (c.kind !== 'amount') {
          continue;
        }
        const m = this.amountModel(c);
        // Only a dial with NO structural direction hint belongs here — one that
        // states its result / conversion / price is already a cost+gain pair in
        // the hero, and listing it again as a bare «ваш выбор» would say less
        // than the chips beside it.
        if (m.amountResult === undefined && m.conversion === undefined && m.amountCost === undefined) {
          out.push({id: c.id, icon: m.icon});
        }
      }
      return out;
    },
    warnings(): Array<string> {
      return this.heroGain.some((e) => e.current !== undefined && e.current === e.resulting) ?
        ['One of the gains has no effect — the value is already at maximum.'] : [];
    },
    // Skipped-effect warnings for the selected branch, via the SAME shared
    // derivation the desktop modal + the play composer use.
    skippedWarnings(): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> {
      return skippedEffectViews(this.selectedBranch?.steps).map((w) => ({
        title: w.title !== '' ? translateText(w.title) : '',
        reason: translateText(w.reason),
        effect: w.effect,
        // Only a chip-less warning needs the bare fallback sprite.
        icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
      }));
    },
    afterNotes(): Array<NextStepRow> {
      const branch = this.selectedBranch;
      if (branch === undefined) {
        return [];
      }
      const out: Array<NextStepRow> = [];
      if (branch.reveal !== undefined) {
        out.push(noteRow(translateText('Reveal a card')));
      }
      for (const step of branch.steps) {
        if (step.kind === 'boardPlacement') {
          // NAMES the tile (Aquifer Pumping → «разместите тайл океана»), through
          // the same presenter the play composer uses.
          out.push(placementRow(step, consoleTranslate, textOf));
        } else if (step.kind === 'deltaAdvance') {
          // This branch does not move the marker — it OPENS the track, and the
          // energy is charged by the confirm there. Say so: the whole point of
          // the flow is that A here costs the player nothing yet.
          out.push(noteRow(translateText('The destination and the confirmation are on the Hydronetwork.')));
        } else if (step.kind === 'colonyTrade') {
          // This branch does not perform a trade — it ENTERS the one trade,
          // and the fee is charged there. Say so: the whole point of the flow
          // is that A here costs the player nothing yet.
          out.push(noteRow(translateText('Payment and confirmation happen on the chosen colony.')));
        } else if (step.kind === 'note' && step.noteKind !== 'warning') {
          out.push(noteRow(step.text !== undefined ? textOf(step.text) : translateText('An additional choice')));
        }
        // A `warning` is NOT an "after confirming" step (nothing happens) — it has
        // its own block above (`skippedWarnings`), which names the lost effect.
      }
      return out;
    },
    // ── sub-state ────────────────────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      return this.sub === undefined ? undefined : this.allChoices.find((c) => c.id === this.sub?.choiceId);
    },
    subTitle(): string {
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    listItems(): ReadonlyArray<ListItem> {
      const c = this.subChoice;
      if (this.sub === undefined || this.sub.kind !== 'list' || c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => this.cardListItem(c, card, chosenName === card.name, false));
        for (const card of model.disabledCards ?? []) {
          items.push(this.cardListItem(c, card, false, true));
        }
        return items;
      }
      if (c.input.type === 'player') {
        const model = c.input as SelectPlayerModel;
        const chosen = this.picks[c.id];
        const items: Array<ListItem> = model.players.map((color): ListItem => this.playerListItem(model, color, chosen === color, false, undefined));
        for (const d of model.disabledPlayers ?? []) {
          items.push(this.playerListItem(model, d.color, false, true, d.reason));
        }
        return items;
      }
      if (c.input.type === 'or') {
        // The SHARED premium or-row builder (`buildOrItems`) — the same one the
        // PLAY composer stands on. This list used to map options to bare titles,
        // so a «which standard resource» pick read as six words with no icon and
        // no before→after, while the identical pick on the play screen rendered
        // chips. One builder, one vocabulary: the option's own `OptionMetadata`
        // becomes `ActionEffectChip`s exactly as everywhere else.
        const chosen = this.picks[c.id];
        return buildOrItems(c.input as OrOptionsModel).map((it): ListItem => ({
          key: it.key,
          label: textOf(it.label),
          resIcon: '', resCount: 0, impact: '',
          // A NESTED-input option (an OrOptions branch that is itself a
          // SelectPlayer/SelectCard) has no host on this screen — it stays
          // unpickable, but says WHY rather than claiming the rules forbid it.
          disabled: it.disabled || it.nested !== undefined,
          reason: it.nested !== undefined ? translateText('Not available on this screen') : textOf(it.reason),
          chosen: chosen === String(it.optionIndex),
          color: it.playerColor,
          chips: it.chips,
          warnings: it.warnings,
          orItem: it,
        }));
      }
      return [];
    },
    /** The payment view of the choice whose EDITOR is open (the SAME model the
     *  panel renders — there is no second, ad-hoc editor model any more). */
    paymentView(): PaymentView | undefined {
      const c = this.subChoice;
      return c === undefined || c.kind !== 'payment' ? undefined : this.paymentPanelView(c);
    },
    /** The editor is open — the main screen stays mounted underneath it. */
    payExpanded(): boolean {
      return this.sub?.kind === 'payment';
    },
    /** The hand-editable rows of the open editor (its focus ring). */
    payEditableRows(): ReadonlyArray<PaymentSourceRow> {
      const v = this.paymentView;
      return v === undefined ? [] : editableRows(v);
    },
    focusedItem(): Item | undefined {
      return this.navItems[this.focusIdx];
    },
    /** The CTA row's virtual focus index — one past the navigable rows. */
    /**
     * THE REQUIREMENTS, in cursor order — what the commit gate reads.
     *
     * Satisfaction is asked of the DOMAIN (`choiceMissing`), never re-derived
     * here: whether `1/2 выбрано` answers an ask is a rule, not a count. Each
     * requirement carries its OWN A-verb, so the command bar can name the next
     * real step instead of the screen's eventual purpose.
     */
    commitRequirements(): ReadonlyArray<CommitRequirement> {
      const out: Array<CommitRequirement> = [];
      this.navItems.forEach((item, index) => {
        if (item.kind === 'branch') {
          // A branch row is a requirement only while nothing is selected — and
          // then it is THE first one (nothing below it is even decided yet).
          if (this.selectedPos === undefined) {
            out.push({index, verb: 'Choose an option', satisfied: false});
          }
          return;
        }
        if (item.choice.repeatAction === true) {
          out.push({
            index, verb: 'Choose an action to repeat',
            satisfied: !this.choiceMissing(item.choice),
          });
          return;
        }
        out.push({
          index,
          verb: this.requirementVerb(item.choice),
          satisfied: !this.choiceMissing(item.choice),
        });
      });
      return out;
    },
    /**
     * THE ONE ANSWER to «may this be confirmed yet». Everything that has to
     * agree — the cursor ring, the Ⓐ glyph, the command bar's verb, the click
     * handler — reads THIS, so the screen cannot advertise an action it has
     * already decided to refuse.
     */
    commitGate(): CommitGate {
      return computeCommitGate({
        requirements: this.commitRequirements,
        submitting: this.submitting,
        // An unavailable branch is not a requirement: filling the fields under
        // it would change nothing, so the commit row carries the reason itself.
        // Same for a variant whose EVERY branch is refused — then there is not
        // even a branch to select, so the unanswered pick must not speak.
        unavailable: this.selectedBranch !== undefined && !this.selectedBranch.available ?
          this.branchReason(this.selectedBranch) :
          (this.variantBlockedReason ?? this.tradeEntryBlockedReason),
      });
    },
    /**
     * THIS BRANCH IS A COLONY TRADE — the card name whose payment path it
     * enters, from the server's own `colonyTrade` step. Structural: a note's
     * prose could never say WHICH path, and its text is translated in place.
     */
    tradeEntryCard(): CardName | undefined {
      const step = this.selectedBranch?.steps.find((s) => s.kind === 'colonyTrade');
      return step?.kind === 'colonyTrade' ? step.card : undefined;
    },
    /**
     * ── A PLAN DOES NOT WALK THROUGH DOORS ────────────────────────────────
     *
     * `colonyTrade` / `deltaAdvance` / `boardPlacement` are RUNTIME NAVIGATION
     * (`consoleActionComposer.ts` § RUNTIME-NAVIGATION STEPS): the confirm
     * hands the player to another surface and the real commit is there. That is
     * the whole shape of the second door — and it exists only when this
     * composer is ACTIVATING.
     *
     * In REPEAT-PICK mode it is composing a PLAN: no action is being taken, so
     * there is no live trade to enter and no board to place on. Deferring is
     * not a degradation — the server parks a repeat's composed responses and
     * raises whatever the plan did not answer as its own follow-up, so the
     * colony is asked for at the moment the copy actually runs, inside the
     * workspace that copied it.
     *
     * Read by all three sites that would otherwise treat the door as a
     * requirement: the commit gate's reason, the CTA verb, and `submit()`.
     */
    navigationDeferred(): boolean {
      return this.repeatPickDisabled;
    },
    /** The door this confirm walks through, or none (plan / no such branch). */
    tradeEntryDoor(): CardName | undefined {
      return this.navigationDeferred ? undefined : this.tradeEntryCard;
    },
    deltaEntryDoor(): DeltaAdvanceOffer | undefined {
      return this.navigationDeferred ? undefined : this.deltaEntryOffer;
    },
    /** The live trade prompt this branch would enter (server-authoritative). */
    tradeEntryContext(): TradeColonyContext | undefined {
      return this.tradeEntryCard === undefined ?
        undefined : findTradeColonyContext(this.playerView.waitingFor);
    },
    /**
     * Why the walk cannot start — always the SERVER's own words. The branch may
     * be available while the payment path itself is refused (the card's action
     * spent, no floaters left), and the trade prompt states that per option; a
     * missing prompt entirely means the trade is not on the table at all.
     */
    tradeEntryBlockedReason(): string | undefined {
      // A DEFERRED door is not a requirement: there is nothing to be blocked
      // ON. Asking the live `waitingFor` for a trade while planning a repeat
      // is asking about a prompt that cannot exist yet, and its honest «no»
      // then refused the plan's own confirm — the «Летающая платформа» dead end.
      const card = this.tradeEntryDoor;
      if (card === undefined) {
        return undefined;
      }
      const ctx = this.tradeEntryContext;
      if (ctx === undefined) {
        return translateText('Trading is not available right now');
      }
      if (lockedTradePaymentIndex(ctx.paymentOptions, card) >= 0) {
        return undefined;
      }
      const reason = lockedTradePaymentReason(ctx.disabledPayments, card);
      return reason !== undefined ? textOf(reason) : translateText('Trading is not available right now');
    },
    /**
     * THIS BRANCH IS A HYDRONETWORK MOVE — the server's own description of it,
     * from the branch's `deltaAdvance` step. Structural, exactly like
     * `tradeEntryCard`: a note's prose could never carry the destination, and
     * its text is translated in place.
     */
    deltaEntryOffer(): DeltaAdvanceOffer | undefined {
      const step = this.selectedBranch?.steps.find((s) => s.kind === 'deltaAdvance');
      return step?.kind === 'deltaAdvance' ? step.offer : undefined;
    },
    ctaIndex(): number {
      return this.navItems.length;
    },
    /** The last cursor stop. The commit row DROPS OUT of the ring while a
     *  requirement is waiting — that is what keeps focus off a row whose A
     *  would do nothing. */
    navMaxIndex(): number {
      return commitAcceptsCursor(this.commitGate) ? this.ctaIndex : Math.max(0, this.ctaIndex - 1);
    },
    ctaFocused(): boolean {
      return this.sub === undefined && this.focusIdx >= this.ctaIndex;
    },
    /** The «Эта карта» handle holds the cursor — the REAL source card in the
     *  hero slot answers, so the link is visible on the object it names. */
    /**
     * THE SELF-TARGET LINK, as this host sees it — all three gated on «MY step
     * is the open one». `playedTargetSelfState` is a singleton and carries no
     * owner, so a second composer parked at its own played-target step publishes
     * into the same fact; without the gate this host would light its hero, and
     * mount its connector, for a step standing inside a different workspace.
     * `present` additionally keeps an always-mounted overlay (and its
     * ResizeObserver) off the band for every prompt with no self-target.
     */
    selfTargetPresent(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.present;
    },
    selfTargetFocused(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.focused;
    },
    /** The source card is the CONFIRMED target. */
    selfTargetLocked(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.locked;
    },
    /** May A run the commit right now? The ONE execution guard. */
    commitReady(): boolean {
      return commitAllowed(this.commitGate);
    },
    /** The gate's WORD alone — the watcher re-seats the cursor on transitions
     *  (a branch switch, a target going stale), not on every recompute. */
    commitGateKind(): string {
      return this.commitGate.kind;
    },
    /**
     * The dock while the payment EDITOR is open: the same strip in the same
     * place, now confirming the PAYMENT («Готово») instead of the action — so
     * the expanded state always shows the way back into the main flow and the
     * dock never unmounts (which would move the column).
     */
    /**
     * WHAT A DOES — the ONE verb, read by the commit row AND the command bar.
     *
     * A trade branch does not COMMIT here: the button walks the player to the
     * colony, and the real confirm is on it. A verb promising «выполнить»
     * before anything is spent would be the false half of the old flow — the
     * floater was already gone by the time the colony was asked for, so B had
     * nothing to undo.
     */
    commitVerbKey(): string {
      if (this.tradeEntryDoor !== undefined) {
        return 'Choose a colony';
      }
      // Nor does an advance branch: the destination, its requirements and its
      // reward are studied ON the track, and the one confirm is there.
      return this.deltaEntryDoor !== undefined ? 'Open the Hydronetwork' : this.commitLabel;
    },
    ctaDockLabel(): string {
      if (!this.payExpanded) {
        return this.commitVerbKey;
      }
      return this.paymentView?.status.ok === true ? 'Done' : 'Not enough resources';
    },
    ctaDockReady(): boolean {
      return this.payExpanded ? this.paymentView?.status.ok === true : this.canConfirm;
    },
    ctaDockHint(): string {
      return this.payExpanded ? '' : this.ctaHint;
    },
  },
  watch: {
    /**
     * A NEW PREVIEW RE-SEATS THE DRAFT — but never past the COMMIT BOUNDARY.
     *
     * The answer to a submitted action moves every ingredient of the preview
     * cache's availability fingerprint, so the store refetches while the commit
     * beat is still playing. Re-seating there wiped the captures the batch was
     * built from, dropped the `submitting` lock (the hero's committed ring and
     * the «Выполняется…» CTA blinked back to an editable, un-answered screen)
     * and painted the amber «выберите…» line over a target that had already
     * been chosen AND sent. The host freezes the prop for exactly this window
     * (`ConsoleCardActions.committedPreview`); this is the same rule stated
     * where the draft lives, so no future preview source can reopen it. A
     * REFUSAL rolls `submitting` back (abortNonce) and the next preview re-seats
     * normally.
     */
    preview: {immediate: true, handler() {
      if (this.submitting) {
        return;
      }
      this.resetFromPreview();
    }},
    // The parent opens the outcome stage at confirm time (identity change
    // {} → {payload} must NOT relaunch the flight — only ENTER/EXIT do).
    // IMMEDIATE on purpose: a REPEATED reveal (ProjectInspection / Viron) mounts
    // this composer with `outcome` ALREADY set (the parent points it at the
    // chosen action + opens the phase in one tick). A non-immediate watcher would
    // miss that initial value → `beginRevealFlight` never runs → the phase hangs on
    // «Вскрываем карту» (no handle, stage stuck 'pending'). Immediate fires on
    // mount with `prev === undefined`, launching the flight; the plain undefined
    // mount (a normal action) is a harmless no-op.
    //
    // Only the DECK-CHECK flavour owns a flight here. The DRAW flavour's cards
    // are flown by the app-level deck-draw cinematic straight into the embedded
    // reveal's own slots, so the composer must not launch a second, competing
    // proxy for the same cards.
    // Publish / retract the TELEPORT TARGET as the outcome zone comes and
    // goes. The shell's re-homed reveal depends on this value, so it must be
    // reactive and it must be retracted on the way out — a stale selector
    // would teleport the NEXT batch into a detached node (invisible cards, an
    // un-takeable prompt) instead of falling back to the band.
    // ⚠️ ONLY THE OWNER WRITES THE SHARED SLOT — the same law as the command
    // store below, and for the same reason. `repeat-pick` mounts a SECOND
    // composer over this one (`publishCommands: false`; the registry says that
    // frame never hosts and never serves), and this watcher is `immediate`, so
    // the nested instance mounted with `on === false` and wiped the zone the
    // OUTER composer — or the hand workspace hosting the play — had published.
    // A wipe is not a stale selector, it is worse: the publisher's own watcher
    // has nothing to fire on afterwards, so the zone never comes back and the
    // artifact re-homes nowhere.
    drawOutcomeOn: {
      immediate: true,
      handler(on: boolean) {
        if (!this.publishCommands) {
          return;
        }
        setWorkspaceOutcomeSlot(on ? '[data-embed-slot="workspace-reveal"]' : '');
      },
    },
    // The COLONIES STEP zone — same discipline (embed rule 4: `flush:'post'`
    // so the element genuinely stands before the teleport looks for it,
    // retract on the way out).
    colonyStepOn: {
      flush: 'post' as const,
      handler(on: boolean) {
        setWorkspaceFrameSlot('card-actions', on ? '[data-embed-slot="action-colonies"]' : '');
        // …AND THE CARD THE STEP IS BEING DONE FOR. This host keeps its card in
        // the outcome CLAIM rather than in the crumb subject (the composer owns
        // the activation, not the browse frame), which is exactly why the
        // guest used to carve out a special case for it. Published here, the
        // guest asks one question of every host — see `workspaceStepSourceCard`.
        setWorkspaceFrameSourceCard('card-actions', on ? this.entry.cardName : '');
      },
    },
    /**
     * SETUP → OUTCOME, played as the SAME phrase that opened the action, one
     * level deeper (consoleActionOutcomeMotion). The configuration content
     * lets go on the spot; the outcome zone UNFOLDS from the rect that surface
     * just occupied. The frame, the band, the rail and the hero card do not
     * move at all — the player reads ONE surface advancing, not a screen
     * replacing another. A `v-if` swap here is what read as a blink and made
     * the stage feel like a modal that had arrived.
     */
    /**
     * THE EXECUTION BEAT — launched at CONFIRM, not at the answer. The proxy
     * leaves the HUD pile face-down (a card back needs no data), so the beat
     * covers the round-trip instead of following it. `notifyPayload()` is what
     * releases the turn-over, and that is driven by `answerIn` below.
     *
     * The launch is DELAYED by the ACTION COMMIT's handoff window: the pull
     * starts as the commit impulse lands on the printed card-draw icon (and
     * the pile answers with its pulse) — the deck reacts to the activated
     * symbol, never in the same frame as the press. The beat still covers the
     * round-trip: the delay is a fraction of the flight it precedes.
     */
    outcomePendingBeat(on: boolean) {
      if (on) {
        this.clearBeatDelay();
        // ARM THE BATCH NOW, not at launch: the prepared stage has to stand
        // with its N slots from the moment the zone opens, so the layout is
        // solved and the landing rects exist before anything moves. The launch
        // re-arms, because the answer may firm the count up in the meantime —
        // but only ever BEFORE the first frame of flight.
        this.armBeatBatch();
        this.beatDelayTimer = window.setTimeout(() => {
          this.beatDelayTimer = undefined;
          void this.$nextTick(() => this.beginBeatFlight());
        }, consoleMotionMs(COMMIT_HANDOFF_AT_MS));
      } else {
        this.clearBeatDelay();
        // NOT an abort: the beat is leaving because the real surface has taken
        // the zone, so the landed cards hand over rather than blink out.
        this.handOffBeatBatch();
      }
    },
    /**
     * The submitted action was REJECTED (server error) — the premium
     * rollback: the commit visuals tear down, the CTA unlocks, the captures
     * stay. The workspace returns to the exact editable state before A.
     */
    'actionCommitState.abortNonce'() {
      this.commitHandle?.kill();
      this.commitHandle = undefined;
      this.submitting = false;
    },
    /**
     * THE PREPARED STAGE RE-SOLVES THE MOMENT ITS SIZE CHANGES. The batch is
     * armed when the zone opens and re-armed at launch (the answer can firm the
     * count up in between), and a row that keeps a zoom solved for a different
     * card count visibly resizes under the player — the «contour that jumps»
     * before anything has even flown. Only ever BEFORE the first frame of
     * flight: once the batch is airborne its length is frozen.
     */
    beatCount(n: number) {
      if (n > 0 && this.outcomePendingBeat) {
        void this.$nextTick(() => this.fitBeatStage());
      }
    },
    /** The answer landed — the cards may turn over (mid-flight or on the slot). */
    'workspaceOutcomeState.answerIn'(arrived: boolean) {
      if (arrived) {
        this.syncBeatFaces();
        // The faces have to EXIST in the DOM before the turn shows them, or
        // the first readable frame is an empty proxy face.
        void this.$nextTick(() => this.beatHandle?.notifyPayload());
      }
    },
    outcomeStageOn(on: boolean) {
      if (!on) {
        return;
      }
      playConfigRelease(this.$refs.rootEl as HTMLElement | undefined);
      void this.$nextTick(() => {
        playOutcomePhase(this.$refs.rootEl as HTMLElement | undefined, () => { /* settled */ });
      });
    },
    /**
     * …and again when the re-homed surface actually LANDS in the zone. The
     * teleport arrives a round-trip after the zone opened, so without this the
     * content would simply appear inside an already-open box — the same blink,
     * one level in. It surfaces from inside the zone instead, which is the
     * REVEAL half of the phrase arriving with its content.
     */
    outcomeContentIn(landed: boolean) {
      if (landed) {
        void this.$nextTick(() => {
          playOutcomeContent(this.$refs.rootEl as HTMLElement | undefined);
        });
      }
    },
    outcome: {
      immediate: true,
      handler(next: ComposerOutcome | undefined, prev: ComposerOutcome | undefined) {
        const isCheck = (o: ComposerOutcome | undefined) => o?.kind === 'deck-check';
        if (isCheck(next) && !isCheck(prev)) {
          // Freeze the visible counter at its PRE-reveal value: the answer's
          // commit already carries the reward, and the increment must be a
          // SEEN beat, never a leaked spoiler.
          this.revealResBaseline = this.storedResource?.count;
          this.revealGainApplied = false;
          this.beginRevealFlight();
        } else if (!isCheck(next) && isCheck(prev)) {
          this.abortRevealFlight();
        }
      },
    },
    // The server's answer landed — the face exists, the flip may run. On the
    // degraded no-flight path (no stage DOM — the test runner, a torn-down
    // layout) the phase is already 'settled' with NO handle: the gain beat
    // must still fire here, or a late payload would leave the counters
    // frozen at the baseline forever.
    revealPayload(payload: RevealResultModel | undefined) {
      if (payload === undefined) {
        return;
      }
      void this.$nextTick(() => {
        if (this.revealHandle !== undefined) {
          this.revealHandle.notifyPayload();
        } else if (this.revealStage === 'settled' && !this.revealGainApplied) {
          this.maybeRunGainBeat();
        }
      });
    },
    playerView() {
      // Keep the in-flight CTA while the COMMITTED submit is still awaiting
      // its answer (a poll can deliver an unchanged view mid-flight; the
      // shell's resolve closes the composer when the answer lands). Any
      // other fresh view means the prompt moved on — re-arm the CTA.
      if (!isSurfaceAwaitingHandoff()) {
        this.submitting = false;
      }
    },
    /**
     * THE GATE RE-SEATS THE CURSOR. Switching a variant, a target going stale
     * or a pick returning can all put a requirement back in the way — and if
     * the cursor was sitting on the commit row it is now parked on something
     * that will refuse it. Watching the gate's KIND (not the whole object)
     * keeps this to the transitions that actually matter.
     */
    commitGateKind() {
      if (this.sub === undefined && !this.submitting) {
        this.syncCommitFocus();
      }
    },
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        // The nested (repeat-pick) instance reports UP via `@commands` instead of
        // touching the shared store the outer composer owns.
        if (this.publishCommands) {
          setConsoleActionComposerCommands(cmds);
        }
        this.$emit('commands', cmds);
      },
    },
    // (The frame header no longer asks this component what to call itself:
    // the stage's name follows its PHASE — «Настройка действия» while the
    // action is being prepared, «Результат вскрытия» in the reveal phase.
    // Deriving it from `hasDecisions` made the title depend on the ASYNC
    // preview, so it changed under the entering animation.)
  },
  mounted() {
    // A RESTORED stage mounts with the colonies step ALREADY hosted (the
    // parked second-door chain coming back): `colonyStepOn` was true before
    // this component existed, so its change-watcher never fires — republish
    // the zone here, after the first render has stood the element up (the
    // same post-DOM timing the `flush: 'post'` watcher gives a live change).
    // Without this the restored colonies frame has no teleport target and the
    // whole chain below it renders nowhere (embed rule 4's gap, permanent).
    if (this.colonyStepOn) {
      setWorkspaceFrameSlot('card-actions', '[data-embed-slot="action-colonies"]');
      setWorkspaceFrameSourceCard('card-actions', this.entry.cardName);
    }
  },
  beforeUnmount() {
    this.clearBeatDelay();
    this.commitHandle?.kill();
    this.commitHandle = undefined;
    this.abortRevealFlight();
    this.abortBeatFlight();
    // The zone dies with the stage — retract the teleport target so a re-homed
    // presenter falls back to its band instead of into a detached node. The
    // watcher does not fire on unmount, so this cannot be left to it. OWNER
    // ONLY, exactly as in the watcher above: the nested repeat-pick instance
    // leaving must not retract somebody else's live zone.
    if (this.publishCommands) {
      setWorkspaceOutcomeSlot('');
    }
    // Same for the colonies-step zone (embed rule 4, the retract half).
    if (this.colonyStepOn) {
      setWorkspaceFrameSlot('card-actions', '');
      setWorkspaceFrameSourceCard('card-actions', '');
    }
    resetOutcomeOrigin();
    if (this.revealGainPopTimer !== undefined) {
      window.clearTimeout(this.revealGainPopTimer);
    }
    // Only the OWNER of the shared store resets it — the nested repeat-pick
    // instance must not clobber the outer composer's contract on unmount.
    if (this.publishCommands) {
      resetConsoleActionComposerUi();
    }
  },
  methods: {
    /** The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face). */
    tileIconStyle,
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    /** The rule chip's label + the shared sentence formatter — ONE wording
     *  source with the browser and the fullscreen rules tab. */
    ruleLabel(kind: 'rule' | 'note'): string {
      return ACTION_RULE_LABEL[kind];
    },
    ruleText(key: string): string {
      return actionRuleText(key);
    },
    branchAt(pos: number): ActionPreviewBranch {
      return this.branches[pos];
    },
    branchTitle(b: ActionPreviewBranch): string {
      const raw = branchTitleText(b);
      return raw !== '' ? translateText(raw) : '';
    },
    branchReason(b: ActionPreviewBranch): string {
      if (b.unavailableReason === undefined) {
        return translateText('Unavailable right now');
      }
      // …through the SHARED rule, so this surface, its browse tile and the
      // Hydronetwork plan panel can never name the missing tag differently.
      return textOf(b.unavailableReason,
        reasonParams(b.unavailableReasonParams, b.unavailableReasonTag));
    },
    rangeText(vc: ConsoleVariableChip): string {
      const unit = vc.unit ?? '';
      return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
    },
    /** The premium view of ONE branch (chips + variable ranges + a named
     *  non-chip requirement) — never a mute variant. */
    branchView(pos: number): BranchView {
      const b = this.branches[pos];
      const variable = variablePartsForBranch(b);
      const cost = b.effects.filter((e) => e.direction === 'cost' && !variable.suppressCostIcons.has(e.icon));
      const gain = b.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon));
      const hasChips = cost.length + gain.length + variable.cost.length + variable.gain.length + variable.choice.length > 0;
      // A branch with no chips still names its non-chip requirement (card/player
      // pick / reveal), so it's never a bare title.
      let needs = '';
      if (!hasChips) {
        if (b.reveal !== undefined) {
          needs = translateText('Next: reveal a card');
        } else if (b.optionInput?.type === 'card' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'card')) {
          needs = translateText('Choose a card');
        } else if (b.optionInput?.type === 'player' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'player')) {
          needs = translateText('Choose a player');
        }
      }
      return {cost, gain, variableCost: variable.cost, variableGain: variable.gain, variableChoice: variable.choice, empty: !hasChips && needs === '', needs};
    },
    branchHasBothSides(pos: number): boolean {
      const v = this.branchView(pos);
      const c = v.cost.length + v.variableCost.length > 0;
      const g = v.gain.length + v.variableGain.length > 0;
      return c && g;
    },
    playerName(color: string): string {
      // The Automa seat localizes to «Бот»; never leak the raw «MarsBot» name.
      return displayNameForColor(this.playerView.players, color as Color);
    },
    choiceTitle(c: ComposerChoice): string {
      const t = textOf(c.input.title);
      return t !== '' ? t : translateText(CHOICE_KIND_LABEL[c.kind] ?? 'Choose an option');
    },
    pickPlaceholder(c: ComposerChoice): string {
      if (c.repeatAction === true) {
        return translateText('Choose an action to repeat');
      }
      if (c.kind === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        return translateText('Pick cards from hand');
      }
      return translateText(c.kind === 'card' ? 'Choose a card' : c.kind === 'player' ? 'Choose a player' : 'Choose an option');
    },
    choiceMissing(c: ComposerChoice): boolean {
      if (c.repeatAction === true) {
        // The nested read-only slot is never «missing» — it resolves post-submit.
        return !this.repeatPickDisabled && this.repeatResult === undefined;
      }
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── premium sub-list items ──────────────────────────────────────────
    cardListItem(c: ComposerChoice, card: CardModel, chosen: boolean, disabled: boolean): ListItem {
      const from = card.resources ?? 0;
      const impact = (!disabled && c.amount !== undefined && c.cardResource !== undefined) ?
        `${from} → ${Math.max(0, from + c.amount)}` : '';
      return {
        key: (disabled ? 'd' : '') + card.name,
        label: translateCardName(card.name),
        resIcon: c.cardResource ?? '',
        resCount: from,
        impact,
        disabled: disabled || card.isDisabled === true,
        reason: (disabled || card.isDisabled === true) ? textOf(card.disabledReason) : '',
        chosen,
        card,
      };
    },
    playerListItem(model: SelectPlayerModel, color: string, chosen: boolean, disabled: boolean, reason: string | Message | undefined): ListItem {
      // SERVER impacts first, then the shared derivation — hand-rolling the
      // field name here printed NOTHING for M€ / plants production (the model's
      // fields are singular) and the wrong numbers for a MarsBot target.
      const rows = targetImpactRows(color as Color, {
        impacts: model.targetImpacts,
        icon: model.icon,
        amount: model.amount,
        scope: model.scope,
        player: this.playerView.players.find((pl) => pl.color === color),
      });
      const impact = targetImpactText(rows);
      return {
        // «Это вы» — a warning only when it is a LOSS and somebody else could
        // have taken it instead. Alone in the list it is a forced move, not a
        // mistake, and the card already warns about that case before play.
        selfHarm: color === this.thisPlayer.color && !disabled &&
          targetImpactIsLoss(rows) && model.players.length > 1,
        key: (disabled ? 'd' : '') + color,
        label: this.playerName(color),
        resIcon: disabled ? '' : (model.icon ?? ''),
        resCount: 0,
        impact,
        disabled,
        reason: textOf(reason),
        chosen,
        color,
      };
    },
    // ── reset / defaults ────────────────────────────────────────────────
    resetFromPreview(): void {
      this.capturedPre = {};
      this.captured = {};
      this.capturedOption = undefined;
      this.amounts = {};
      this.floaters = {};
      this.payCounts = {};
      this.picks = {};
      this.multiPicks = {};
      this.repeatResult = undefined;
      this.sub = undefined;
      this.focusIdx = 0;
      this.submitting = false;
      // MAY a choice be seeded at all — ONE rule, shared with the play composer
      // (`initialVariantSelection`): a single option, or exactly one the RULES
      // allow; a real question opens unanswered. This screen and the play
      // screen had the same rule written twice, and «two copies of one rule»
      // is how the payment unit labels drifted apart before them.
      const positions = this.positions;
      const seed = initialVariantSelection(positions.map((p) => this.branches[p] ?? {available: false}));
      this.selectedPos = seed === undefined ? undefined : positions[seed];
      // Focus the first AVAILABLE branch (or the first item) so the player
      // starts on a meaningful choice, not the top of a list.
      if (this.needBranchRow) {
        const firstAvail = this.navItems.findIndex((it) => it.kind === 'branch' && this.branches[it.pos]?.available === true);
        this.focusIdx = firstAvail >= 0 ? firstAvail : 0;
      }
      this.seedDefaults();
      // …and then let the GATE have the last word: if a requirement is already
      // waiting, the cursor starts ON it. A screen that opens on a commit row
      // it will refuse is the defect this whole model exists to remove.
      void this.$nextTick(() => this.syncCommitFocus());
    },
    seedDefaults(): void {
      for (const c of this.allChoices) {
        this.seedChoice(c);
      }
    },
    seedChoice(c: ComposerChoice): void {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const def = m.maxByDefault ? m.max : m.min;
        this.amounts[c.id] = def;
        this.captureFor(c, {type: 'amount', amount: def});
      } else if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan !== undefined) {
          this.floaters[c.id] = plan.minFloaters;
          this.captureFor(c, spendHeatResponse(plan, plan.minFloaters));
        }
      } else if (c.kind === 'payment') {
        const model = c.input as SelectPaymentModel;
        const lanes = paymentLanes(model, this.thisPlayer);
        const mc = megacreditsAvailable(this.thisPlayer);
        const counts = initialCounts(model.amount, lanes, mc);
        this.payCounts[c.id] = counts;
        if (paymentCovers(model.amount, lanes, counts, mc)) {
          this.captureFor(c, {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mc)});
        }
      }
      // A card/player/or TARGET is NEVER auto-selected — not even a lone
      // candidate (the fork's non-negotiable no-auto-select rule): the player
      // must consciously pick the target, so a single-target choice is never
      // silently skipped. Only amount/heat/payment get a visible, editable default.
    },
    /** Is this RENDERED row the focused one? Identity-based, because the render
     *  list and the nav list differ (a focus-free dial renders but never focuses). */
    isFocused(item: Item): boolean {
      return this.sub === undefined && this.focusedItem?.id === item.id;
    },
    captureFor(c: ComposerChoice, response: unknown | undefined): void {
      if (c.scope === 'pre') {
        if (response === undefined) {
          delete this.capturedPre[c.index];
        } else {
          this.capturedPre[c.index] = response;
        }
      } else if (c.scope === 'option') {
        this.capturedOption = response;
      } else if (response === undefined) {
        delete this.captured[c.index];
      } else {
        this.captured[c.index] = response;
      }
    },
    // ── live synthetic hero chips ───────────────────────────────────────
    syntheticCost(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind === 'amount') {
        const m = this.amountModel(c);
        const chosen = this.amountFor(c.id);
        // The INVERSE dial (it counts what is RECEIVED — Energy Market's energy):
        // the price is `perUnit` of ANOTHER pool, and it is the only statement of
        // what confirming costs, so it wins over the dial's own icon.
        if (m.amountCost !== undefined) {
          const spent = chosen * (m.amountCost.perUnit ?? 1);
          const pool = this.poolOf(m.amountCost.icon, m.amountCost.scope);
          return [{
            direction: 'cost',
            icon: m.amountCost.icon,
            amount: spent,
            current: pool,
            resulting: pool !== undefined ? pool - spent : undefined,
            note: m.amountCost.scope === 'production' ? 'production' : undefined,
          }];
        }
        const icon = m.icon ?? m.conversion?.from;
        if ((m.amountResult !== undefined || m.conversion !== undefined) && icon !== undefined) {
          const stock = this.poolOf(icon, m.conversion?.fromScope);
          return [{direction: 'cost', icon, amount: chosen, current: stock, resulting: stock !== undefined ? stock - chosen : undefined,
            note: m.conversion?.fromScope === 'production' ? 'production' : undefined}];
        }
        return [];
      }
      if (c.kind === 'spendHeat') {
        const plan = spendHeatPlan(c.input);
        if (plan === undefined) {
          return [];
        }
        const floaters = this.floatersFor(c.id);
        const stock = spendHeatStock(plan, floaters);
        const heat = this.poolOf('heat');
        const out: Array<ActionEffect> = [{direction: 'cost', icon: 'heat', amount: stock, current: heat, resulting: heat !== undefined ? heat - stock : undefined}];
        if (floaters > 0) {
          out.push({direction: 'cost', icon: 'floater', amount: floaters});
        }
        return out;
      }
      // Payment is NOT synthesized into the «БУДЕТ СПИСАНО» hero anymore — the
      // premium payment PANEL below shows the exact mix (M€ + alt resource, было →
      // стало) with inline adjust, so folding it into the hero would DOUBLE it.
      // The hero now carries only genuine NON-payment costs (spent card resources,
      // energy, an asteroid, …); a payment-only action shows an empty cost side.
      return [];
    },
    syntheticGain(c: ComposerChoice): Array<ActionEffect> {
      if (c.kind !== 'amount') {
        return [];
      }
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        return [{direction: 'gain', icon: m.amountResult.icon, amount: chosen * per}];
      }
      if (m.conversion !== undefined) {
        const ratio = m.conversion.ratio ?? 1;
        return [{direction: 'gain', icon: m.conversion.to, amount: chosen * ratio}];
      }
      // An inverse dial IS the gain — its own icon, its own value.
      if (m.amountCost !== undefined && m.icon !== undefined) {
        const pool = this.poolOf(m.icon);
        return [{direction: 'gain', icon: m.icon, amount: chosen, current: pool, resulting: pool !== undefined ? pool + chosen : undefined, unit: m.unit}];
      }
      return [];
    },
    // ── amount helpers ──────────────────────────────────────────────────
    amountModel(c: ComposerChoice): SelectAmountModel {
      return c.input as SelectAmountModel;
    },
    amountFor(id: string): number {
      return this.amounts[id] ?? 0;
    },
    amountIcon(c: ComposerChoice): string | undefined {
      const m = this.amountModel(c);
      return m.icon ?? m.conversion?.from;
    },
    setAmount(c: ComposerChoice, value: number): void {
      const m = this.amountModel(c);
      const clamped = Math.min(m.max, Math.max(m.min, value));
      this.amounts[c.id] = clamped;
      this.captureFor(c, {type: 'amount', amount: clamped});
    },
    amountResultLine(c: ComposerChoice): string {
      const m = this.amountModel(c);
      const chosen = this.amountFor(c.id);
      if (m.amountResult !== undefined) {
        const per = m.amountResult.perUnit ?? 1;
        const label = m.amountResult.label !== undefined ? translateText(m.amountResult.label) : '';
        return `→ ${label !== '' ? label + ': ' : ''}${chosen * per}`;
      }
      if (m.conversion !== undefined) {
        return `→ ${chosen * (m.conversion.ratio ?? 1)}`;
      }
      // An inverse dial states its PRICE on the row (the hero chip beside it
      // carries the icon + before→after) — never a bare "In stock" line, which
      // says nothing about what the dial costs.
      if (m.amountCost !== undefined) {
        return `${translateText('Cost')}: ${chosen * (m.amountCost.perUnit ?? 1)}`;
      }
      return '';
    },
    amountStockLine(c: ComposerChoice): string {
      const stock = this.poolOf(this.amountIcon(c));
      return stock !== undefined ? `${translateText('In stock')}: ${stock}` : '';
    },
    /**
     * The premium two-sided OPERATION for this dial (spend → receive with
     * `current → after` on both sides) — the SHARED derivation the standalone
     * prompt uses. The pool reader is this composer's own `poolOf`, so a dial
     * spending the source card's stored floaters/microbes (Titan Shuttles,
     * Sulphur Eating Bacteria) previews the card's own count.
     */
    amountOperation(c: ComposerChoice): ConversionPromptVm | undefined {
      return amountOperationVm(this.amountModel(c), this.amountFor(c.id),
        (icon, scope) => this.poolOf(icon, scope));
    },
    /**
     * The CURRENT value of the pool an amount chip touches — the viewer's stock or
     * production for a standard resource, and the SOURCE CARD's own count for a
     * card resource (floaters/microbes stored here), which is where a "remove X
     * from this card" dial takes them from. `undefined` = no single pool to show,
     * and the chip degrades to a bare magnitude.
     */
    poolOf(icon: string | undefined, scope?: 'stock' | 'production'): number | undefined {
      if (icon === undefined) {
        return undefined;
      }
      const standard = playerResourceValue(this.thisPlayer, icon, scope ?? 'stock');
      if (standard !== undefined) {
        return standard;
      }
      const onCard = this.preview?.cardResource;
      // Both sides normalized: a hook may pass the raw `CardResource` value
      // ('Floater') or the already-normalised icon key ('floater').
      if (scope !== 'production' && onCard !== undefined && cardResourceKey(String(onCard.type)) === cardResourceKey(icon)) {
        return onCard.count;
      }
      return undefined;
    },
    // ── spend-heat helpers ──────────────────────────────────────────────
    heatStockFor(c: ComposerChoice): number {
      const plan = spendHeatPlan(c.input);
      return plan !== undefined ? spendHeatStock(plan, this.floatersFor(c.id)) : 0;
    },
    floatersFor(id: string): number {
      return this.floaters[id] ?? 0;
    },
    adjustFloaters(c: ComposerChoice, step: number): void {
      const plan = spendHeatPlan(c.input);
      if (plan === undefined) {
        return;
      }
      const next = Math.min(plan.floaterMax, Math.max(plan.minFloaters, this.floatersFor(c.id) + step));
      if (!spendHeatValid(plan, next)) {
        return;
      }
      this.floaters[c.id] = next;
      this.captureFor(c, spendHeatResponse(plan, next));
    },
    // ── payment helpers ─────────────────────────────────────────────────
    /** The payment PRESENTATION model for a payment choice — the SAME
     *  `buildPaymentView` the play composer and the standalone payment task
     *  use, so every payment surface in the game renders one language. */
    paymentPanelView(c: ComposerChoice): PaymentView {
      const model = c.input as SelectPaymentModel;
      return buildPaymentView({
        cost: model.amount,
        lanes: paymentLanes(model, this.thisPlayer),
        counts: this.payCounts[c.id] ?? {},
        mcAvailable: megacreditsAvailable(this.thisPlayer),
      });
    },
    paymentCostOf(c: ComposerChoice): number {
      return (c.input as SelectPaymentModel).amount;
    },
    /** Density for THIS choice's panel: only the choice whose editor is open
     *  expands — a second payment panel stays a compact summary. */
    payModeFor(c: ComposerChoice): 'compact' | 'expanded' {
      return this.sub?.kind === 'payment' && this.sub.choiceId === c.id ? 'expanded' : 'compact';
    },
    /** The unit the editor's cursor sits on (undefined outside the editor). */
    payFocusUnitFor(c: ComposerChoice): string | undefined {
      const sub = this.sub;
      if (sub?.kind !== 'payment' || sub.choiceId !== c.id) {
        return undefined;
      }
      return editableRows(this.paymentPanelView(c))[sub.index]?.unit;
    },
    /** The pulse nonce is PER CHOICE — a shared counter made every mounted
     *  panel flash when only one of them was dialed. */
    payFlashFor(c: ComposerChoice): number {
      return this.payFlash[c.id] ?? 0;
    },
    /** Quick-adjust of the SINGLE alt source on the main screen (M€ auto-fills
     *  the rest) — delegates to the ONE mutation both densities share. */
    adjustQuickPayment(c: ComposerChoice, step: number): void {
      const row = quickAdjustRow(this.paymentPanelView(c));
      if (row === undefined) {
        return;
      }
      if ((step > 0 && !row.canIncrease) || (step < 0 && !row.canDecrease)) {
        return;
      }
      this.adjustPayment(c, 0, step);
    },
    /** RT МАКС. on that same single alt source (the quick-adjust's own MAX). */
    maxQuickPayment(c: ComposerChoice): void {
      const row = quickAdjustRow(this.paymentPanelView(c));
      if (row === undefined || !row.canIncrease) {
        return;
      }
      this.adjustPayment(c, 0, 0, true);
    },
    /**
     * EXPAND the payment block in place — only where the editor is a REAL second
     * stage (two or more alternative sources). A pure-AUTO M€ payment has nothing
     * to configure, and a single alternative is already dialed inline by the
     * bumpers on this very screen, so LT there would re-open the block the player
     * is looking at, with a cursor that has nowhere to go.
     */
    openPaymentEditor(c: ComposerChoice): void {
      const view = this.paymentPanelView(c);
      if (!view.editorEligible) {
        return;
      }
      this.sub = {kind: 'payment', choiceId: c.id, index: 0};
    },
    /** Fold the editor back into the compact summary, keeping the chosen mix. */
    closePaymentEditor(): void {
      this.sub = undefined;
    },
    /**
     * Dial ONE payment source — the single mutation both densities go through.
     * The capture follows coverage: an uncovered mix un-captures the choice, so
     * the CTA blocks and says why (never a silently invalid submit).
     */
    adjustPayment(c: ComposerChoice, laneIdx: number, step: number, toMax = false): void {
      const model = c.input as SelectPaymentModel;
      const lanes = paymentLanes(model, this.thisPlayer);
      const lane = lanes[laneIdx];
      if (lane === undefined) {
        return;
      }
      const counts = {...(this.payCounts[c.id] ?? {})};
      const before = counts[lane.unit] ?? 0;
      // The AGGREGATE anti-overpay limit lives in the pure `dialLaneCount`, so
      // «+» and «МАКС.» both read what the OTHER alternatives already pay.
      const next = dialLaneCount(model.amount, lane, lanes, counts, toMax ? 'max' : step);
      if (next === before) {
        return;
      }
      counts[lane.unit] = next;
      this.payCounts[c.id] = counts;
      this.payFlash[c.id] = (this.payFlash[c.id] ?? 0) + 1;
      const mcAvail = megacreditsAvailable(this.thisPlayer);
      this.captureFor(c, paymentCovers(model.amount, lanes, counts, mcAvail) ?
        {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mcAvail)} : undefined);
    },
    // ── pick rows ───────────────────────────────────────────────────────
    chosenLabel(c: ComposerChoice): string {
      // A resolved MULTI-select hand pick shows the picked cards (first two
      // names + «+N»; an explicit empty answer reads «Выбрано: 0»).
      const multi = this.multiPicks[c.id];
      if (multi !== undefined && c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
        if (multi.length === 0) {
          return `${translateText('Selected')}: 0`;
        }
        const names = multi.slice(0, 2).map((n) => translateCardName(n as CardName)).join(', ');
        return multi.length > 2 ? `${names} +${multi.length - 2}` : names;
      }
      const pick = this.picks[c.id];
      if (pick === undefined) {
        return '';
      }
      if (c.input.type === 'card') {
        return translateText(pick);
      }
      if (c.input.type === 'player') {
        return this.playerName(pick);
      }
      if (c.input.type === 'or') {
        const opt = (c.input as OrOptionsModel).options[Number(pick)];
        return opt !== undefined ? textOf(opt.title) : '';
      }
      return pick;
    },
    chosenImpact(c: ComposerChoice): string {
      // Multi-select payout (generic revealGain metadata).
      const multi = this.multiPicks[c.id];
      const gain = c.multiSelect?.revealGain;
      if (multi !== undefined && gain !== undefined) {
        return `+${multi.length * gain.amount}`;
      }
      // A captured or-option keeps its before→after on the COLLAPSED row too —
      // the reading the player chose by must survive the sub-list closing, or
      // the summary falls back to a bare resource name and the decision reads
      // as un-made again.
      if (c.input.type === 'or') {
        const item = buildOrItems(c.input as OrOptionsModel)
          .find((it) => String(it.optionIndex) === this.picks[c.id]);
        const chip = item?.chips.find((e) => e.current !== undefined && e.resulting !== undefined);
        return chip === undefined ? '' : `${chip.current} → ${chip.resulting}`;
      }
      if (c.input.type !== 'card' || c.amount === undefined) {
        return '';
      }
      const card = (c.input as SelectCardModel).cards.find((cd) => cd.name === this.picks[c.id]);
      if (card === undefined) {
        return '';
      }
      const from = card.resources ?? 0;
      return `${from} → ${Math.max(0, from + c.amount)}`;
    },
    // ── input routing (foundation: SEMANTIC actions, no raw button names) ──
    handleIntent(intent: GamepadIntent): void {
      // THE DRAW PHASE never sees the pad: while it is pending the action is
      // already committed (nothing to fire, nothing to cancel), and once the
      // reveal has teleported in the SHELL routes intents straight to it —
      // the same path the standalone band uses. Swallow either way, so a
      // press can never leak back into the configuration rows underneath.
      if (this.drawOutcomeOn) {
        return;
      }
      // THE DECK-CHECK PHASE owns the pad: post-commit, nothing can re-fire or
      // cancel. While the card is still face down every press is swallowed
      // (the beat is short and self-explaining); once settled A acknowledges,
      // X inspects the revealed card and L3 lifts the source.
      //
      // B never arrives here at all — the verdict is the flow's TERMINAL phase
      // and the host swallows the back verb above us (consoleWorkspaceFlow
      // 'verdict'). It used to ALSO ack here, which was two buttons for one
      // meaning and, once the workspace model took B, plain dead code.
      if (this.deckCheckOn) {
        if (this.revealStage !== 'settled' || this.revealPayload === undefined) {
          return;
        }
        // L3 = the SOURCE card fullscreen (the console-wide source verb —
        // mirrors the single-card reveal's L3 received ⇄ source flip).
        if (intent.kind === 'press' && intent.button === 'stickL') {
          this.$emit('inspect-source');
          return;
        }
        const action = consoleActionOf(intent);
        if (action === 'primary') {
          this.ackReveal();
        } else if (action === 'inspect') {
          this.inspectRevealed();
        }
        return;
      }
      if (intent.kind === 'scroll') {
        const step = this.sub?.kind === 'playedTarget' ?
          this.$refs.targetStep as {scrollBy?: (d: number) => void} | undefined : undefined;
        if (step?.scrollBy !== undefined) {
          // The step owns the only scroller on screen while it is open.
          step.scrollBy(Math.sign(intent.dy) * 40);
          return;
        }
        (this.$refs.scroll as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(Math.sign(intent.dy) * 40);
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action === undefined) {
        return;
      }
      if (this.sub !== undefined) {
        this.onSubPress(action);
        return;
      }
      this.onMainPress(action);
    },
    onNav(dir: NavDirection): void {
      if (this.sub?.kind === 'playedTarget') {
        this.movePlayedTarget(dir);
        return;
      }
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? this.payEditableRows.length : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'up' ? -1 : 1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          const c = this.subChoice;
          if (c !== undefined) {
            this.adjustPayment(c, this.sub.index, dir === 'left' ? -1 : 1);
          }
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        // The walk ends at the COMMIT row only while the commit can actually
        // run — a row that would refuse A is not a place the cursor may stop.
        this.focusIdx = Math.min(this.navMaxIndex, Math.max(0, this.focusIdx + (dir === 'up' ? -1 : 1)));
        this.scrollFocused();
        return;
      }
      // d-pad ←→ mirrors LB/RB on the active dial (a lone stepper is adjustable
      // straight from the CTA — the cursor never has to visit it).
      this.dialActive(dir === 'left' ? -1 : 1);
    },
    /** Nudge the ACTIVE dial by `step` (the one `activeDialChoice` resolved). */
    dialActive(step: number): void {
      const c = this.activeDialChoice;
      if (c === undefined) {
        return;
      }
      if (c.kind === 'amount') {
        this.setAmount(c, this.amountFor(c.id) + step);
      } else if (c.kind === 'spendHeat') {
        this.adjustFloaters(c, step);
      } else {
        this.adjustQuickPayment(c, step);
      }
    },
    // MAIN state: A(primary) acts on the FOCUSED row (select a branch / open
    // a pick / advance past a stepper — «Далее») and confirms ONLY on the CTA
    // row; X(inspect) inspects the SOURCE card fullscreen (the ONE console
    // X-verb — the quick-confirm X was retired for grammar consistency);
    // B back, LB/RB(prev/nextSection) step amount/floaters, RT(nextTab) = max.
    onMainPress(action: ConsoleAction): void {
      const item = this.focusedItem;
      switch (action) {
      case 'primary':
        if (this.ctaFocused || item === undefined) {
          this.submit();
        } else if (item.kind === 'branch') {
          this.selectBranch(item.pos);
        } else if (item.choice.kind === 'amount' || item.choice.kind === 'spendHeat') {
          // A stepper adjusts via LB/RB — A ADVANCES toward the CTA («Далее»),
          // mirroring the play composer's grammar (the visible, editable
          // default is already captured).
          this.focusIdx = Math.min(this.navMaxIndex, this.focusIdx + 1);
          this.scrollFocused();
        } else {
          this.openChoice(item.choice);
        }
        return;
      case 'inspect':
        this.$emit('inspect-source');
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'prevSection':
      case 'nextSection':
        // LB/RB drive the ACTIVE DIAL — a focused stepper, else the focus-free
        // sole stepper, else the payment quick-adjust. No focus needed for the
        // lone dial: «покрутил и подтвердил».
        this.dialActive(action === 'prevSection' ? -1 : 1);
        return;
      case 'prevTab':
        // LT = the DEDICATED entry to the detailed payment lane editor (never A,
        // never a focus row) — the user's «вход строго через отдельную кнопку LT».
        if (this.primaryPaymentChoice !== undefined) {
          this.openPaymentEditor(this.primaryPaymentChoice);
        }
        return;
      case 'nextTab': {
        // RT = MAX on the ACTIVE dial: an amount stepper (focused or focus-free),
        // or the inline payment quick-adjust — the single alt lane has no editor
        // to enter, so this is the only «fill it up» it gets.
        const dial = this.activeDialChoice;
        if (dial === undefined) {
          return;
        }
        if (dial.kind === 'amount') {
          this.setAmount(dial, this.amountModel(dial).max);
        } else if (dial.kind === 'payment') {
          this.maxQuickPayment(dial);
        }
        return;
      }
      default:
        return;
      }
    },
    openChoice(c: ComposerChoice): void {
      // Viron's "repeat an already-used action" pick → the ДЕЙСТВИЯ КАРТ list
      // surface ADAPTED for repeat mode (`consoleRepeatPick`): the player picks
      // the action AND composes it there, returning the composed responses.
      if (c.repeatAction === true) {
        // NESTED slot (this composer already lives inside the repeat pick
        // surface): the bridge is busy — the slot is a read-only note.
        if (!this.repeatPickDisabled) {
          this.openRepeatPick(c);
        }
        return;
      }
      // A Hydronetwork STAGE-REWARD claim (Dutch Mountains) → the REAL track
      // as the selection surface: the bridge hands the screen to the hydro
      // workspace in reward-select mode and the composed draft returns as
      // this step's ordinary captured response. Structural, off the input's
      // own type — never a card name.
      if (c.input.type === 'deltaStageReward') {
        this.openStageRewardPick(c);
        return;
      }
      // A hand-card pick (Self-Replicating Robots' link branch: every candidate
      // — eligible AND greyed-with-reason — is a card in hand) routes to the
      // HAND SECTION's premium pick mode; a PLAYED-CARD pick descends into the
      // embedded target step, INSIDE this workspace. Only the hosted-cards pick
      // (SRR targetCards — in neither zone) keeps the inline sub-list.
      if (c.kind === 'card' &&
          isHandCardSelection(c.input as SelectCardModel, this.handNamesSet)) {
        this.openHandPick(c);
        return;
      }
      if (this.isPlayedTargetChoice(c)) {
        this.openPlayedTargetStep(c);
        return;
      }
      if (c.kind === 'card' || c.kind === 'player' || c.kind === 'or') {
        this.sub = {kind: 'list', choiceId: c.id, index: 0};
      }
      // amount / spendHeat / payment adjust inline (A advances; payment's detailed
      // lane editor is LT → `openPaymentEditor`, never A).
    },
    /**
     * Hand Viron's repeat pick to the ДЕЙСТВИЯ КАРТ surface in repeat mode: the
     * player chooses ONE already-used action (A = «Выбрать») and composes it
     * there; the result (chosen action + its composed responses) lands back
     * here and rides the confirm as `repeat`. The composer stays MOUNTED
     * (v-show hidden) so this callback survives (mirrors the hand pick).
     */
    openRepeatPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const disabled = (model.disabledCards ?? []).map((d) => ({
        name: d.name,
        reason: d.disabledReason !== undefined ? textOf(d.disabledReason) : '',
      }));
      enterConsoleRepeatPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Take action',
        candidates: model.cards.map((cd) => cd.name),
        disabled,
        source: {kicker: 'Repeat action', card: this.entry.cardName},
        prior: this.repeatResult !== undefined ?
          {chosenCard: this.repeatResult.chosenCard, nodeIndex: this.repeatResult.nodeIndex} : undefined,
      }, (result) => {
        this.repeatResult = result;
        // Land on the CTA — the slot is filled, the action is ready to perform.
        this.focusIdx = this.ctaIndex;
        this.scrollFocused();
      });
    },
    /**
     * Hand the stage-reward claim to the Hydronetwork workspace in
     * reward-select mode (the pick bridge idiom: this composer stays mounted
     * underneath with its captures intact, the resolve captures the step's
     * wire response and re-locates the choice by ID — the preview may have
     * refreshed during the round trip). The full repeat composition is kept
     * beside the capture (`stageRewardDraft`) for the claim/specs the wire
     * response cannot carry back out.
     */
    openStageRewardPick(c: ComposerChoice): void {
      const model = c.input as DeltaStageRewardInputModel;
      enterDeltaRewardPick({
        source: this.entry.cardName,
        claimable: model.claimable,
        prior: this.stageRewardDraft ?? deltaRewardDraftOf(this.captured[c.index]),
      }, (draft) => {
        this.stageRewardDraft = draft;
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        this.captureFor(cur, deltaRewardStepResponse(draft));
        this.focusIdx = this.ctaIndex;
        this.scrollFocused();
      });
    },
    /** The claimed stage's EXACT outcome for the row — the shared hydro
     *  reward view over the LIVE snapshot (a stage change re-derives it on
     *  the spot; server-authored lines, never a UI re-computation). */
    stageRewardPreview(c: ComposerChoice): HydroRewardView | undefined {
      const draft = deltaRewardDraftOf(this.captured[c.index]);
      if (draft === undefined) {
        return undefined;
      }
      return deltaRewardPreviewView(this.stageRewardDraft ?? draft, this.playerView);
    },
    /** The captured claim, summarized for its row (stage name + the picks). */
    stageRewardSummary(c: ComposerChoice): string {
      const draft = deltaRewardDraftOf(this.captured[c.index]);
      if (draft === undefined) {
        return '';
      }
      const stage = HYDRO_STAGES[draft.position];
      const parts: Array<string> = [
        translateTextWithParams('Stage ${0}', [String(draft.position)]) +
          (stage !== undefined ? ' · ' + translateText(stage.nameKey) : ''),
      ];
      if (draft.selectedCard !== undefined) {
        parts.push(translateCardName(draft.selectedCard));
      }
      return parts.join(' — ');
    },
    /** The A-verb a requirement publishes while it holds the cursor. The keys
     *  are the ones the held line already uses — ONE vocabulary, not two. */
    requirementVerb(c: ComposerChoice): string {
      switch (c.kind) {
      case 'card': return 'Choose a card';
      case 'player': return 'Choose a player';
      case 'or': return 'Choose an option';
      case 'payment': return 'Configure payment';
      case 'spendHeat': return 'Heat sources';
      default: return 'Select';
      }
    },
    /**
     * Put the cursor where the gate says it belongs. Called on open and after
     * anything that can re-block the screen (a pick returning, a branch switch,
     * a target going stale) — a focus seeded once and left alone is exactly how
     * the cursor ends up parked on a row that has since stopped working.
     */
    syncCommitFocus(): void {
      const target = commitCursorTarget(this.commitGate, this.ctaIndex);
      if (target !== undefined && target !== this.focusIdx) {
        this.focusIdx = target;
        this.scrollFocused();
      }
    },
    /** A short LOCAL pulse on the row that is holding the commit — never a
     *  toast detached from the problem, never a shake of the whole surface. */
    flashBlockingRequirement(): void {
      this.blockFlashNonce++;
    },
    /** Is this row the one the gate is waiting on? */
    isBlockingRow(item: Item): boolean {
      const gate = this.commitGate;
      if (gate.kind !== 'incomplete' && gate.kind !== 'stale') {
        return false;
      }
      return this.navItems.indexOf(item) === gate.blocking.index;
    },
    /** Does this choice belong to the embedded played-target step? The boundary
     *  is the CAPABILITY (every candidate lies on some tableau), never the
     *  owner — an opponent's card is the same kind of pick as your own. */
    isPlayedTargetChoice(c: ComposerChoice): boolean {
      return c.kind === 'card' && c.repeatAction !== true &&
        !isHandCardSelection(c.input as SelectCardModel, this.handNamesSet) &&
        isCardSelectionWithin(c.input as SelectCardModel, this.playedNamesSet);
    },
    /**
     * DESCEND into the embedded played-target step — the same level the card-play
     * workspace opens, in the same component.
     *
     * It replaced a hand-off to the «Разыграно» view's pick mode. That surface
     * lifted the real table cards, which was physical and pretty, but it took
     * the player OUT of the action workspace to answer a question the action
     * asked, and it gave them a whole tableau to find two legal targets in. The
     * step costs what the CHOICES cost.
     */
    openPlayedTargetStep(c: ComposerChoice): void {
      // Measure the band ONCE, before the step is visible, and measure it where
      // the layout is STRETCHED: the work column's width is the band's, and the
      // row above it is the only box here whose height the cards cannot move.
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const zone = root?.querySelector<HTMLElement>('.con-composer__actright');
      if (zone !== null && zone !== undefined) {
        this.playedTargetWidth = zone.clientWidth;
      }
      const band = root?.querySelector<HTMLElement>('.con-composer__actmain');
      if (band !== null && band !== undefined) {
        this.playedTargetHeight = band.clientHeight;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      // Re-entry restores the previous answer: the cursor lands ON that card,
      // already target-locked (a multi ask brings its whole accumulation back,
      // pruned of anything that left the table since).
      const selection = this.playedTargetSelectionFor(c);
      const picked = selection.mode === 'multi' ?
        prunePlayedTargetPicks((this.multiPicks[c.id] ?? []) as ReadonlyArray<string>, owners) :
        [];
      const chosen = this.playedTargetResults[c.id];
      const focus = findPlayedTargetFocus(chosen?.cardName ?? picked[0], owners) ??
        reseatPlayedTargetFocus(undefined, owners);
      if (focus === undefined) {
        return;
      }
      this.sub = {kind: 'playedTarget', choiceId: c.id, focus, picked};
    },
    /** The step's ASK, read from the server's own prompt: one card, or the
     *  up-to-N the input declares. */
    playedTargetSelectionFor(c: ComposerChoice): PlayedTargetSelection {
      const model = c.input as SelectCardModel;
      const max = model.max ?? 1;
      if (max <= 1) {
        return {mode: 'single'};
      }
      return {
        mode: 'multi',
        min: model.min ?? 0,
        max,
        picked: this.sub?.kind === 'playedTarget' && this.sub.choiceId === c.id ?
          this.sub.picked :
          ((this.multiPicks[c.id] ?? []) as ReadonlyArray<string>),
      };
    },
    /** The contextual preview for a candidate — the ONE shared builder. */
    playedTargetPreview(choice: ComposerChoice, name: CardName) {
      const step = choice.scope === 'step' ? this.selectedBranch?.steps[choice.index] : undefined;
      return playedTargetPreviewFor(step, choice.input as SelectCardModel, name, this.selectedBranch?.effects, this.selectedBranch?.vpBox);
    },
    playedTargetResourceContext(c: ComposerChoice, card: CardModel) {
      return playedTargetResourceFor(c.amount, c.cardResource, card);
    },
    /** Move the cursor inside the step — BY WHERE THE CARDS ARE (the index walk
     *  survives only as the answer for a step that has not measured yet). */
    movePlayedTarget(dir: NavDirection): void {
      if (this.sub?.kind !== 'playedTarget') {
        return;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      const map: Record<string, PlayedTargetNavDir | undefined> = {
        left: 'left', right: 'right', up: 'up', down: 'down',
      };
      const d = map[dir as string];
      if (d === undefined) {
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(this.sub.focus, d, cells) :
        stepPlayedTargetFocus(this.sub.focus, d, owners, this.playedTargetLayout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent owner change
      }
      this.sub = {...this.sub, focus: next};
      this.scrollPlayedTargetFocused();
    },
    /** The STEP owns its candidate viewport — the rail and the contract sit
     *  outside it, so this never moves them. */
    scrollPlayedTargetFocused(): void {
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** LB/RB — the owner axis, tabbed mode only (in split both groups are on
     *  screen and the d-pad crosses between them spatially). */
    cyclePlayedTargetOwner(delta: number): void {
      if (this.sub?.kind !== 'playedTarget' || this.playedTargetLayout.mode !== 'tabs') {
        return;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      const ownerId = stepPlayedTargetOwner(this.sub.focus.ownerId, delta, owners);
      if (ownerId === this.sub.focus.ownerId) {
        return;
      }
      const remembered = this.playedTargetOwnerFocus[ownerId] ?? 0;
      this.playedTargetOwnerFocus = {...this.playedTargetOwnerFocus, [this.sub.focus.ownerId]: this.sub.focus.index};
      this.sub = {...this.sub, focus: reseatPlayedTargetFocus({ownerId, index: remembered}, owners) ?? this.sub.focus};
    },
    /** A in a MULTI ask toggles instead of choosing. */
    togglePlayedTarget(): void {
      if (this.sub?.kind !== 'playedTarget') {
        return;
      }
      const selection = this.playedTargetSelection;
      if (selection.mode !== 'multi') {
        return;
      }
      const candidate = playedTargetAt(this.sub.focus, this.playedTargetModel?.owners ?? []);
      if (candidate === undefined) {
        return;
      }
      this.sub = {
        ...this.sub,
        picked: togglePlayedTargetPick(this.sub.picked, candidate.cardName, selection.max),
      };
    },
    /** RT — submit a MULTI ask. */
    confirmPlayedTargetPicks(): void {
      if (this.sub?.kind !== 'playedTarget') {
        return;
      }
      const choice = this.playedTargetChoice;
      const selection = this.playedTargetSelection;
      if (choice === undefined || selection.mode !== 'multi' || !playedTargetPicksValid(selection)) {
        return;
      }
      const cards = [...this.sub.picked] as Array<CardName>;
      this.multiPicks[choice.id] = cards;
      this.picks[choice.id] = String(cards.length);
      this.captureFor(choice, {type: 'card', cards});
      this.sub = undefined;
      this.scrollFocused();
    },
    /** A — lock the focused candidate in as this choice's target. */
    confirmPlayedTarget(): void {
      if (this.sub?.kind !== 'playedTarget') {
        return;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      const candidate = playedTargetAt(this.sub.focus, owners);
      const choice = this.playedTargetChoice;
      if (candidate === undefined || choice === undefined) {
        return;
      }
      this.playedTargetResults = {
        ...this.playedTargetResults,
        [choice.id]: playedTargetResultOf(candidate, owners, this.playedTargetVersion),
      };
      // The capture is the same shape every card pick uses — the rich result is
      // presentation context, never a second source of truth.
      this.captureFor(choice, {type: 'card', cards: [candidate.cardName]});
      this.picks[choice.id] = candidate.cardName;
      this.sub = undefined;
      this.scrollFocused();
    },
    /** X inside the step — the FOCUSED candidate fullscreen, lifting from its
     *  own slot (the console-wide «X inspects the current object»). */
    inspectPlayedTarget(): void {
      if (this.sub?.kind !== 'playedTarget') {
        return;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      const candidate = playedTargetAt(this.sub.focus, owners);
      if (candidate === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === candidate.cardName));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        // The SELF-TARGET resolves to the hero card this action is composed on,
        // never to the proxy that points at it — one card on screen, always.
        // Scoped to this composer's own root, never `document`.
        origin: playedTargetZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          playedTargetSourceCardName(owners)),
      });
    },
    /** The summary of an answered played-target choice (undefined = unanswered
     *  or gone stale — a target whose card left the table is never shown as
     *  chosen, and never submitted). */
    playedTargetResult(c: ComposerChoice): PlayedTargetResult | undefined {
      const result = this.playedTargetResults[c.id];
      const owners = this.playedTargetModel?.owners ?? [];
      return playedTargetResultLive(result, owners, this.playedTargetVersion) ? result : undefined;
    },
    /** The answered target as a ONE-ELEMENT list — a template alias. */
    targetSummaryOf(c: ComposerChoice): ReadonlyArray<PlayedTargetResult> {
      const result = this.playedTargetResult(c);
      return result === undefined ? [] : [result];
    },
    /** The summary's compact impacts — the SAME derivation the focus rail uses,
     *  capped shorter. Comparison is over; the summary is not a smaller rail. */
    targetSummaryImpacts(c: ComposerChoice): ReadonlyArray<PlayedTargetQuickImpact> {
      const result = this.playedTargetResult(c);
      if (result === undefined) {
        return [];
      }
      return playedTargetQuickImpacts(result.preview).slice(0, PLAYED_TARGET_SUMMARY_IMPACT_CAP);
    },
    /** Hand a hand-card pick to the HAND SECTION (consoleHandPick bridge): the
     *  shell hides the Action Center (v-show — every capture survives), the
     *  player picks on the real cards, the result captures back here. A re-open
     *  (A = «Изменить») pre-seeds the previous selection. */
    openHandPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const multi = (model.max ?? 1) > 1;
      const prior = multi ?
        [...(this.multiPicks[c.id] ?? [])] as Array<CardName> :
        (this.picks[c.id] !== undefined ? [this.picks[c.id] as CardName] : []);
      const gain = c.multiSelect?.revealGain;
      enterConsoleHandPick({
        title: model.title,
        buttonLabel: model.buttonLabel || 'Select',
        selectable: model.cards.map((cd) => cd.name),
        reasons,
        min: model.min ?? 1,
        max: model.max ?? 1,
        selected: prior,
        gainPerCard: gain !== undefined ? {icon: gain.resource, amount: gain.amount} : undefined,
        // The pick surface names the operation it serves — the player keeps
        // the WHY while the focus stage waits hidden underneath.
        source: {kicker: 'Action setup', card: this.entry.cardName},
      }, (cards) => {
        // Re-locate by id — the preview may have refreshed under the pick.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (multi) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        }
        this.scrollFocused();
      });
    },
    selectBranch(pos: number): void {
      if (this.selectedPos === pos || !this.branches[pos]?.available) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity); the
      // preSteps stay captured (branch-independent).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.multiPicks = {};
      this.amounts = {};
      this.repeatResult = undefined;
      for (const c of this.branchChoiceList) {
        this.seedChoice(c);
      }
    },
    // SUB state (a pick list / payment): A(primary) pick/close, X(inspect) zoom
    // the list card, B back, LB/RB(prev/nextSection) adjust payment, RT max.
    onSubPress(action: ConsoleAction): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      // The EMBEDDED played-target step owns its own grammar: A chooses (or
      // toggles in a multi ask, with RT to submit), X inspects the FOCUSED
      // candidate, LB/RB walk the owner tabs, B is one level back into the
      // action's own decision column.
      if (sub.kind === 'playedTarget') {
        switch (action) {
        case 'primary':
          if (this.playedTargetSelection.mode === 'multi') {
            this.togglePlayedTarget();
          } else {
            this.confirmPlayedTarget();
          }
          return;
        case 'nextTab':
          this.confirmPlayedTargetPicks();
          return;
        case 'inspect':
          this.inspectPlayedTarget();
          return;
        case 'prevSection':
        case 'nextSection':
          this.cyclePlayedTargetOwner(action === 'prevSection' ? -1 : 1);
          return;
        case 'back':
          this.sub = undefined;
          this.scrollFocused();
          return;
        default:
          return;
        }
      }
      switch (action) {
      case 'primary':
        if (sub.kind === 'payment') {
          // «Готово» — fold the editor back; the mix is KEPT (payCounts is the
          // single source of truth shared by both densities).
          if (this.paymentView?.status.ok === true) {
            this.closePaymentEditor();
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'inspect':
        if (sub.kind === 'list') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        this.sub = undefined;
        return;
      case 'prevTab':
        // The trigger that expanded the block folds it back — a toggle, so the
        // density switch can never trap the player.
        if (sub.kind === 'payment') {
          this.closePaymentEditor();
        }
        return;
      case 'prevSection':
      case 'nextSection':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, action === 'prevSection' ? -1 : 1);
        }
        return;
      case 'nextTab':
        if (sub.kind === 'payment' && this.subChoice !== undefined) {
          this.adjustPayment(this.subChoice, sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      const c = this.subChoice;
      if (sub === undefined || sub.kind !== 'list' || c === undefined) {
        return;
      }
      const item = this.listItems[index];
      if (item === undefined || item.disabled) {
        return;
      }
      if (c.input.type === 'card' && item.card !== undefined) {
        this.picks[c.id] = item.card.name;
        this.captureFor(c, {type: 'card', cards: [item.card.name]});
      } else if (c.input.type === 'player' && item.color !== undefined) {
        this.picks[c.id] = item.color;
        this.captureFor(c, {type: 'player', player: item.color});
      } else if (c.input.type === 'or' && item.orItem !== undefined) {
        // `orItemResponse` — the shared byte-parity builder, not a hand-rolled
        // literal: the index it submits is the option's OWN index, so a list
        // that ever grows informational `disabledOptions` rows cannot shift it.
        this.picks[c.id] = String(item.orItem.optionIndex);
        this.captureFor(c, orItemResponse(item.orItem));
      }
      this.sub = undefined;
    },
    /**
     * WHERE THIS BRANCH LEADS, if anywhere — the branch's own runtime-navigation
     * step kind, published on the row.
     *
     * It is what the row IS, so it belongs on the row: a branch that ends on a
     * colony reads differently from one that ends here, and until now the only
     * evidence was a translated sentence. It also gives a driver (and a reader
     * of the DOM) the structural handle the contract forbids taking from text.
     */
    branchNavKind(pos: number): string | undefined {
      return runtimeNavigationSteps(this.branchAt(pos))[0]?.kind;
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      const at = cards.findIndex((cd) => cd.name === item.card?.name);
      // Target options are TEXT rows, not card tiles → TEXTUAL inspector.
      openConsoleCardZoom(cards, Math.max(0, at), undefined, undefined, {contextLabel: 'Card actions', origin: {kind: 'textual'}});
    },
    submit(): void {
      const branch = this.selectedBranch;
      // THE BACKSTOP. The cursor rule is the real protection — the commit row
      // is not a stop while a requirement is waiting — but a mouse click, a
      // press that crossed a state change, or a repeat during a transition can
      // still arrive here. A refusal must never be silent: send the player TO
      // the thing that needs them, and flash it so the redirect is visible.
      const redirect = commitRedirectTarget(this.commitGate);
      if (redirect !== undefined) {
        this.focusIdx = redirect;
        this.scrollFocused();
        this.flashBlockingRequirement();
        return;
      }
      if (branch === undefined || !this.commitReady || this.submitting || this.preview === undefined) {
        return;
      }
      // ── THE SECOND DOOR. A colony-trade branch commits NOTHING here: no
      //    floater spent, no card marked used, no action consumed, no request.
      //    It hands the player to the trade the server is already offering,
      //    with this card's payment path locked — the one confirm is on the
      //    colony. That is what makes B a real way back, and what makes the
      //    two entry points one action instead of two implementations.
      //    No commit ceremony either: the beat exists to fix the boundary
      //    «настраивал → активировал», and this press crosses no boundary.
      if (this.tradeEntryDoor !== undefined) {
        this.$emit('colony-trade', {card: this.tradeEntryDoor});
        return;
      }
      // ── THE SAME DOOR, onto the Hydronetwork. Nothing is spent, nothing is
      //    marked used, nothing goes on the wire: the branch's runtime index
      //    travels with the offer so the workspace's own confirm can assemble
      //    the ONE batch that activates the card and makes the move together.
      if (this.deltaEntryDoor !== undefined) {
        this.$emit('delta-advance', {offer: this.deltaEntryOffer, branchIndex: branch.index});
        return;
      }
      this.submitting = true;
      // Capture the configuration surface's box NOW — the outcome unfolds from
      // it, and by the time that zone mounts this surface is already gone.
      armOutcomeOrigin(this.$refs.rootEl as HTMLElement | undefined);
      // ── ACTION COMMIT — the universal activation beat. Armed and MEASURED
      //    synchronously at the press (the reward-wave origins are the live
      //    icon rects; the flight must never depend on this stage outliving
      //    the answer). The nested repeat-pick composer only CAPTURES a
      //    choice — no server activation, no commit beat there.
      if (this.publishCommands) {
        // BOTH read the captures: a branch whose result is chosen in a step
        // («любой стандартный ресурс») has no chips of its own, so the category
        // and the reward wave are only knowable once the answer is in hand.
        // A captured STAGE-REWARD claim (Dutch Mountains) contributes the
        // claimed stage's own transfers/category the same way — through the
        // one reward view every hydro landing uses, structural off the track.
        const stageDraft = this.stageRewardDraft;
        const stageSpecs = stageDraft !== undefined ?
          deltaRewardCommitSpecs(stageDraft, this.playerView) : [];
        const stageFollowUp = stageDraft !== undefined ? HYDRO_STAGES[stageDraft.position]?.followUp : undefined;
        const baseKind = commitKindForBranch(branch, this.captured);
        const kind = stageFollowUp === 'draw' || stageFollowUp === 'reuse-action' ? 'draw' :
          (baseKind === 'generic' && stageSpecs.length > 0 ? 'resources' : baseKind);
        const specs = [...commitRewardSpecs(this.entry.cardName, branch, this.captured), ...stageSpecs];
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const wrap = root?.querySelector<HTMLElement>('.con-composer__actcardwrap') ?? undefined;
        const anchors = wrap !== undefined ? resolveActionCommitAnchors(wrap, this.actionGraphicNode) : undefined;
        const origins = anchors !== undefined ? resolveGainIconOrigins(anchors, specs) : specs.map(() => undefined);
        const srcRect = wrap?.getBoundingClientRect();
        armActionCommit({
          sourceCard: this.entry.cardName,
          kind,
          specs,
          origins,
          sourcePoint: srcRect !== undefined && srcRect.width > 4 ?
            {x: srcRect.left + srcRect.width / 2, y: srcRect.top + srcRect.height * 0.72} : undefined,
        });
        this.commitHandle = runActionCommitMotion({
          cardWrapEl: wrap,
          ctaEl: root?.querySelector<HTMLElement>('.con-composer__cta') ?? undefined,
          actionNode: this.actionGraphicNode,
          kind,
          firstResource: specs[0]?.resource,
          // The draw's causality: the impulse lands on the printed card-draw
          // icon and the HUD deck ANSWERS — right before the physical pull.
          onHandoff: kind === 'draw' || kind === 'deck-check' ? pulseDeckPile : undefined,
          onSettled: markActionCommitSettled,
        });
      }
      this.$emit('confirm', {
        branchIndex: branch.index,
        preResponses: orderedPreResponses(this.preview, this.capturedPre),
        optionResponse: this.capturedOption,
        // The repeat step (Viron) is NEVER a plain captured step — it rides the
        // `repeat` payload (the chosen action + its own composed responses). A
        // read-only NESTED slot never composed one — the server asks next.
        stepResponses: orderedStepResponses(branch, this.captured),
        repeat: this.repeatPickDisabled ? undefined : this.repeatResult,
        // The captured stage-reward claim WITH its composed repeat (the wire
        // response cannot carry the composition back out) — the confirm's
        // claim derivation reads it structurally.
        stageReward: this.stageRewardDraft,
      });
    },
    // ── the reveal phase ─────────────────────────────────────────────────
    /** Launch the deck-pull flight (the phase just opened; the payload may
     *  not exist yet — the flip waits for it). */
    beginRevealFlight(): void {
      this.revealStage = 'pending';
      this.revealFlightOn = true;
      void this.$nextTick(() => {
        const proxy = this.$refs.revealProxy as HTMLElement | undefined;
        const flip = this.$refs.revealFlip as HTMLElement | undefined;
        const slot = this.$refs.revealSlot as HTMLElement | undefined;
        if (proxy === undefined || flip === undefined || slot === undefined) {
          // No stage to fly on (test runner / torn-down DOM): degrade to the
          // instant path — the outcome shows the moment the payload lands.
          this.revealStage = 'settled';
          this.revealFlightOn = false;
          return;
        }
        this.revealHandle = runActionRevealFlight({
          proxy, flip, slot,
          onFaceShown: () => {
            if (this.revealStage === 'pending') {
              this.revealStage = 'face';
            }
          },
          onSettled: () => {
            // ONE flush: the proxy unmounts and the real card becomes visible
            // together — the swap is invisible (the proxy landed on the slot).
            this.revealStage = 'settled';
            this.revealFlightOn = false;
            this.revealHandle = undefined;
            this.maybeRunGainBeat();
          },
        });
        if (this.revealPayload !== undefined) {
          this.revealHandle.notifyPayload();
        }
      });
    },
    /**
     * The GAIN beat (condition met, the reward lives on the source card):
     * the earned resource icon flies from the revealed card into the source
     * counter; on arrival BOTH counters (the card badge + «на этой карте»)
     * tick to the live value with a one-shot pop. Cosmetic and non-blocking
     * — OK / X / L3 work throughout.
     */
    maybeRunGainBeat(): void {
      const payload = this.revealPayload;
      const live = this.storedResource?.count;
      if (payload === undefined || !payload.conditionMet || payload.reward === undefined ||
          live === undefined || this.revealResBaseline === undefined || live === this.revealResBaseline) {
        // Nothing landed on the source card — show the live truth directly.
        this.revealGainApplied = true;
        return;
      }
      this.revealGainFlying = true;
      void this.$nextTick(() => {
        const el = this.$refs.gainFly as HTMLElement | undefined;
        const from = this.$refs.revealSlot as HTMLElement | undefined;
        // The explicit root ref — NEVER $el (a dev-build root comment makes
        // the template a fragment, whose $el is a Comment node).
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const to = root?.querySelector<HTMLElement>('.con-composer__actcard .pcard__res');
        if (el === undefined || from === undefined || to === null || to === undefined) {
          this.applyRevealGain();
          return;
        }
        this.revealGainHandle = runRevealGainFlight({
          el, fromEl: from, toEl: to,
          onArrive: () => this.applyRevealGain(),
        });
      });
    },
    applyRevealGain(): void {
      this.revealGainHandle = undefined;
      this.revealGainFlying = false;
      this.revealGainApplied = true;
      this.revealGainPop = true;
      if (this.revealGainPopTimer !== undefined) {
        window.clearTimeout(this.revealGainPopTimer);
      }
      this.revealGainPopTimer = window.setTimeout(() => {
        this.revealGainPop = false;
      }, 750);
    },
    abortRevealFlight(): void {
      this.revealHandle?.kill();
      this.revealHandle = undefined;
      this.revealGainHandle?.kill();
      this.revealGainHandle = undefined;
      this.revealFlightOn = false;
      this.revealGainFlying = false;
      this.revealGainPop = false;
      this.revealStage = 'pending';
    },
    /**
     * ARM THE BATCH — freeze, before anything moves, HOW MANY physical cards
     * are coming and whatever is already known about their faces.
     *
     * The count comes from the answer when it is already in (the common case —
     * the beat is handed off ~460 ms after the confirm, so a healthy server has
     * usually replied), and otherwise from the claim's `expectedCards`, i.e.
     * the branch preview's server-computed «gain N cards». Either way it is
     * fixed HERE: the batch's length is what the slots, the layout and the
     * focus target are computed from, and nothing may add a card to a flight
     * that has already begun.
     */
    armBeatBatch(): void {
      // ⚠️ Only trust the artifact once the answer for THIS claim has landed.
      // Arming happens at SUBMIT time, when `playerView` still describes the
      // world before the action — a leftover reveal event or a previous
      // prompt's candidates would otherwise decide this batch's size.
      const named = workspaceOutcomeState.answerIn ? this.beatRevealedNames : [];
      const count = named.length > 0 ?
        named.length :
        Math.max(1, workspaceOutcomeState.expectedCards);
      this.beatFaces = Array.from({length: count}, (_, i) => named[i] ?? '');
    },
    /**
     * The answer named the cards — fill the faces of the objects ALREADY in
     * flight. The array's LENGTH never changes: these are the same physical
     * cards that left the pile, now with identities, which is exactly why a
     * late answer opens them instead of producing new ones.
     */
    syncBeatFaces(): void {
      const named = this.beatRevealedNames;
      if (named.length === 0) {
        return;
      }
      // Not yet in flight (the answer beat the commit handoff): the batch is
      // still free to take the REAL size, which is always better than the
      // promise. Once it is flying the length is frozen — the objects that
      // left the pile are the objects that land.
      if (!this.beatFlightOn) {
        this.beatFaces = named.slice();
        return;
      }
      this.beatFaces = this.beatFaces.map((face, i) => named[i] ?? face);
    },
    /**
     * SOLVE THE PREPARED STAGE — the same geometry engine, over the same kind
     * of measurement, that the arriving surface will use (`wsStageLayout`), so
     * the empty slots the batch flies into ARE the rects the real cards will
     * occupy. Without this the landing would be a guess and the handoff a
     * visible jump; with it the swap is a zero-distance cross-over.
     */
    fitBeatStage(): void {
      const row = this.$refs.beatRow as HTMLElement | undefined;
      const probe = row?.querySelector<HTMLElement>('.con-cards__slot');
      if (row === undefined || row === null || probe === null || probe === undefined ||
          typeof window === 'undefined') {
        return;
      }
      // Probe protocol (the buy host's, byte for byte): force zoom 1 with a
      // DIRECT style write, measure the natural slot box synchronously (no
      // paint happens inside one JS turn), then publish the solved numbers.
      // ⚠️ RESET THE ENGINE'S OWN OUTPUTS BEFORE MEASURING. The wrap cap is a
      // `max-width` on this very row, so a second fit would measure the width
      // the FIRST fit chose — narrower room, more rows, a narrower cap, and so
      // on. Same rule as the zoom reset beside it: an engine never reads its
      // own output.
      row.style.setProperty('--con-cards-zoom', '1');
      row.style.setProperty('--con-ws-stage-rowmax', '100%');
      const slotW = probe.offsetWidth;
      const slotH = probe.offsetHeight;
      const stage = row.closest('.con-composer__beatstage') as HTMLElement | null;
      if (slotW <= 0 || slotH <= 0 || stage === null) {
        row.style.removeProperty('--con-cards-zoom');
        if (this.beatFitRetries < 20) {
          this.beatFitRetries++;
          requestAnimationFrame(() => this.fitBeatStage());
        }
        return;
      }
      this.beatFitRetries = 0;
      const cs = window.getComputedStyle(row);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const ui = conUiScale();
      // THE BUDGET IS THE ROW'S OWN BOX — identical discipline to the arriving
      // surface's own fit (`fitEmbeddedStrip`). The prepared stage wears the
      // same strict flex column, so the row it hands the batch is measured the
      // same way the real cards' row will be, and the landing rects are the
      // rects the real cards take.
      const layout = wsStageLayout({
        availW: row.clientWidth - padX,
        availH: Math.max(200 * ui, row.clientHeight - padY),
        slotW, slotH, n: Math.max(1, this.beatCount), ui, padXPx: padX,
      });
      const style = wsStageLayoutStyle(layout);
      Object.entries(style).forEach(([k, v]) => row.style.setProperty(k, v));
      this.beatRowStyle = style;
    },
    /**
     * THE BATCH ARRIVAL — N cards physically leave the HUD pile, each on its
     * own trajectory, each into its own prepared slot, opening as they travel.
     *
     * The one-card version of this used to fly a single proxy into a single
     * slot and then let the arriving surface render the whole batch, which is
     * what read as «one card came and then multiplied». The count, the slots
     * and the layout are all decided BEFORE the first frame now, so a batch of
     * N is N objects from the pile onward.
     */
    beginBeatFlight(): void {
      if (this.beatFlightOn) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        // No stage to fly on (JSDOM / torn-down layout): never withhold the
        // outcome behind an animation that cannot run.
        markWorkspaceOutcomeBeatDone();
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      this.armBeatBatch();
      this.beatFlightOn = true;
      this.beatLanded = false;
      this.beatHandoffPending = false;
      // FREEZE the HUD deck counter at its pre-draw value. The server's answer
      // decrements it the moment it lands, so without this the «−N» chip fires
      // while the cards are still sitting on the pile — the number changes
      // before anything has physically left, which is the opposite of the
      // causal story the whole beat exists to tell. Released as the first card
      // visibly separates, so the tick lands ON the separation.
      holdDeckDisplay(this.playerView.game.deckSize);
      void this.$nextTick(() => {
        // The stage must be SOLVED before the slots are measured, or the batch
        // would aim at a pre-fit geometry and land off its own targets.
        this.fitBeatStage();
        void this.$nextTick(() => this.launchBeatBatch());
      });
    },
    /** Measure the prepared slots and hand the batch to the director. */
    launchBeatBatch(): void {
      if (!this.beatFlightOn || this.beatHandle !== undefined) {
        return;
      }
      const proxies = asElements(this.$refs.batchProxies);
      const flips = asElements(this.$refs.batchFlips);
      const slots = asElements(this.$refs.beatSlots);
      const cards = proxies
        .map((proxy, i) => ({proxy, flip: flips[i]}))
        .filter((c): c is {proxy: HTMLElement, flip: HTMLElement} => c.flip !== undefined);
      if (cards.length === 0 || slots.length === 0) {
        releaseDeckDisplay();
        markWorkspaceOutcomeBeatDone();
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      // THE MODE IS SEMANTIC (consoleCardArrival): a deck CHECK is the
      // deliberate face-down reveal and never comes here; everything else opens
      // in flight when the faces exist, and waits honestly when they do not.
      const mode = resolveCardArrivalMode({
        kinds: workspaceOutcomeState.kinds,
        dataReady: workspaceOutcomeState.answerIn && this.beatFaces.every((f) => f !== ''),
      });
      // THESE CARDS ARE NOW PHYSICALLY OFF THE PILE — published HERE, at the
      // one point where the flight is genuinely committed (past every degrade
      // branch above), so an arriving surface that would otherwise deal its own
      // batch off the same pile adopts these instead of doubling them.
      markWorkspaceOutcomeArrivalFlown();
      this.beatHandle = runBatchArrival({
        cards, slots, mode,
        // The first card is visibly out of the pile — the counter may now tell
        // the truth, and the tick lands ON the separation.
        onDeparted: () => releaseDeckDisplay(),
        // Every card has touched down. Only from here may a still-silent
        // server show a loading affordance: before it, the flight IS the state
        // and a spinner over travelling cards is noise.
        onLanded: () => {
          this.beatLanded = true;
        },
        onSettled: () => {
          this.beatHandle = undefined;
          // The landed proxies STAY. Clearing them here would unmount the
          // cards the moment they finished turning over, leaving the stage
          // empty for the frame or two before the real surface teleports in.
          // They are released by the handoff, i.e. once that surface is
          // actually there to replace them.
          markWorkspaceOutcomeBeatDone();
          if (this.beatHandoffPending) {
            this.handOffBeatBatch();
          }
        },
      });
      // A server that already answered (the common local case) releases the
      // turn immediately — the cards then open on their own trajectories.
      if (workspaceOutcomeState.answerIn) {
        this.syncBeatFaces();
        this.beatHandle.notifyPayload();
      }
    },
    /** Cancel a scheduled commit-delayed beat launch (abort / unmount). */
    clearBeatDelay(): void {
      if (this.beatDelayTimer !== undefined) {
        window.clearTimeout(this.beatDelayTimer);
        this.beatDelayTimer = undefined;
      }
    },
    /**
     * THE HANDOFF — the real surface has taken the zone, so the landed proxies
     * give way to the real cards.
     *
     * It waits for the arrival to have SETTLED. The beat's own safety backstop
     * can release the gate while a late answer's reveal cascade is still
     * turning cards over, and cutting a proxy mid-turn would leave a card
     * edge-on for a frame — the one artefact a card turn may never show.
     */
    handOffBeatBatch(): void {
      if (!this.beatFlightOn) {
        // NOTHING EVER FLEW — the beat's own safety backstop released the gate
        // before the flight could launch (a heavy 4K first frame, a torn-down
        // stage, JSDOM). The player must still be let in: an arrival gate that
        // only opens on a successful flight turns a missed animation into a
        // permanently dead stage — no focus ring, no verbs, every press
        // swallowed. The gate is a courtesy to the animation, never its hostage.
        markWorkspaceOutcomeArrivalDone();
        return;
      }
      if (this.beatHandle !== undefined) {
        this.beatHandoffPending = true;
        return;
      }
      this.beatHandoffPending = false;
      const clear = () => {
        this.beatFlightOn = false;
        this.beatLanded = false;
        this.beatFaces = [];
        this.beatRowStyle = {};
        // The player may act only now: the real cards own their slots, so a
        // focus ring finally points at something that is there.
        //
        // TWO FRAMES LATER, though: the proxies unmount in this flush, and
        // opening the gate in the same one puts the card's removal and the
        // focus emphasis (a scale + lift) in a single frame — the landing then
        // ends on a visible kick instead of a settle. One frame to paint the
        // real cards unfocused, one for the transition to have a `from` state,
        // and the ring eases in on top of a card that is already still.
        const open = () => markWorkspaceOutcomeArrivalDone();
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => requestAnimationFrame(open));
        } else {
          open();
        }
      };
      const proxies = asElements(this.$refs.batchProxies);
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (proxies.length === 0 || root === undefined || typeof window === 'undefined') {
        clear();
        return;
      }
      // WAIT FOR THE SURFACE. The gate opens the moment the beat is marked
      // done, but the re-homed presenter is teleported in on a later flush —
      // querying its cards in this tick finds nothing and the proxies would
      // simply vanish, which is the blink the whole handoff exists to remove.
      // The landed proxies cover their own rects meanwhile, so the wait is
      // invisible; it is bounded so a surface that never comes cannot strand
      // the flight layer.
      let frames = 0;
      const seek = (): void => {
        if (!this.beatFlightOn) {
          return;
        }
        // The re-homed surface's own cards, in ITS layout order — the batch's
        // order is the server's order, and both surfaces render it verbatim,
        // so index i is the same card on both sides.
        const targets = Array.from(root.querySelectorAll<HTMLElement>(
          '[data-outcome-zone] :is(.con-cards__slot, .con-reveal__bonus-slot) :is(.card-container, .pcard)'));
        if (targets.length === 0 && frames < 40) {
          frames++;
          requestAnimationFrame(seek);
          return;
        }
        settleBatchProxiesOnto({
          pairs: proxies.map((proxy, i) => ({proxy, target: targets[i]})),
          onDone: clear,
        });
      };
      seek();
    },
    /** Tear the beat down for good (cancel / unmount / phase abort). */
    abortBeatFlight(): void {
      // Never leave the HUD counter frozen on a beat that ended early.
      releaseDeckDisplay();
      this.beatHandle?.kill();
      this.beatHandle = undefined;
      this.beatHandoffPending = false;
      this.beatFlightOn = false;
      this.beatLanded = false;
      this.beatFaces = [];
      this.beatRowStyle = {};
      markWorkspaceOutcomeArrivalDone();
    },
    /** OK on the shown outcome: the parent marks the reveal seen and returns
     *  the flow to the (refreshed) browse grid. */
    ackReveal(): void {
      this.$emit('reveal-ack');
    },
    /** X on the shown outcome: the revealed card lifts out of ITS slot into
     *  the fullscreen viewer and returns there on close. */
    inspectRevealed(): void {
      const payload = this.revealPayload;
      if (payload === undefined) {
        return;
      }
      openConsoleCardZoom([payload.revealed], 0, undefined, undefined, {
        contextLabel: 'Reveal result',
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          () => 'revealed:' + payload.revealed.name),
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        // The CTA lives in the pinned dock OUTSIDE the scroll viewport — it is
        // always visible, and feeding an outside node to the scroll math
        // would walk the viewport to a bogus offset.
        if (this.ctaFocused) {
          return;
        }
        // The payment editor's cursor lives INSIDE the shared panel (a child
        // component), so it is located by its rendered focus class instead of a
        // template ref — the panel stays purely presentational.
        if (this.payExpanded) {
          const row = (this.$el as HTMLElement | undefined)?.querySelector('.con-payrow--focused');
          (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(row);
          return;
        }
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: keep the focused row visible via the ConsoleScrollArea's
        // own viewport math (never scrollIntoView — it can walk outer scroll
        // ancestors).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
  },
});
</script>
