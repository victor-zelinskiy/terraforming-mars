<template>
  <div ref="rootEl" class="con-composer con-composer--stage"
       :class="{'con-composer--ptsel': playedTargetStepOpen, 'con-composer--colonystep': colonyStepOn,
                'con-composer--parlrise': stageStepOn, 'con-composer--parlstep': parliamentSetupParked,
                'con-composer--ledgerflow': ledgerPaying || politicalEntry !== undefined, 'con-composer--ledgerstep': ledgerStepOn,
                'con-composer--ledgerresumed': ledgerPaying && ledgerResumed}"
       :data-colony-ledger-flow="ledgerPaying ? ledgerFlowStage : undefined"
       :data-colony-ledger-degraded="ledgerDegraded ? '' : undefined"
       :data-composer-source="politicalEntry !== undefined ? (politicalEntry.source.kind === 'party' ? 'party:' + politicalEntry.source.party : 'law:' + politicalEntry.source.resolution) : undefined"
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
             :data-motion-anchor="'card:' + sourceKey"
             :data-zoom-slot="zoomSlotKey"
             :data-commit-link="commitRailLink"
             data-ptsel-source
             data-action-focus-card>
          <!-- `data-reaction-home` («СРАБАТЫВАНИЕ КАРТЫ», iteration 3): the hero IS the card on this surface — a
               reaction of its own printed effect (Martian Fiber's «+1 data here» waking its «data added: +1 M€»)
               LIFTS this face in place and births its tokens on its effect row; never a second instance beside the
               rail. The lift is a transform on this inner body (`data-reaction-lift`), never on the un-zoomed wrap. -->
          <div class="con-composer__actcard con-composer__actcard--stage" :data-reaction-home="heroCardName" data-reaction-lift>
            <!-- Keyed micro-swap: a Viron repeat handoff re-points the stage to
                 the inner action's card without a remount — the face crossfades
                 while the slot (the FLIP/zoom target) stays stable. -->
            <!-- THE LIVE MODEL: the face's own capsule (bottom-left, beside
                 the expansion stamp) carries the stored count. It replaces
                 three readings that all said the same thing — a gold disc with
                 a bare number, a full-width «N на этой карте» plate below the
                 hero, and a printed «0» on the face itself. -->
            <transition name="con-actfocus-card" mode="out-in">
              <ConsoleCardFaceLite v-if="heroCardName !== undefined" :key="heroCardName" :name="heroCardName" :card="heroCardModel" />
              <!-- A POLITICAL source (Turmoil Redux «один фреймворк»): the law's FACE, or the party drawn as a CARD (the
                   owner's decision Р2 — `partyPremiumVm`: the project anatomy with the party's seal) — the hero slot's
                   box, the hero's place, every phase. Its printed mechanics carry the `data-graphic-node` anchors the
                   ACTION COMMIT's impulse runs over, exactly as a card face does. -->
              <div v-else-if="politicalEntry !== undefined && politicalEntry.source.kind === 'law'" :key="'law|' + sourceKey" class="con-composer__actlaw" :data-reaction-home="politicalEntry.source.resolution">
                <PremiumCard v-if="lawFaceVm !== undefined" :vmOverride="lawFaceVm" :inert="true" />
              </div>
              <div v-else-if="politicalEntry !== undefined" :key="'party|' + sourceKey" class="con-composer__actparty" :data-party-face="politicalEntry.party" :data-reaction-home="politicalEntry.party">
                <PremiumCard v-if="partyFaceVm !== undefined" :vmOverride="partyFaceVm" :inert="true" />
              </div>
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
      <div class="con-composer__actright" ref="actRight">

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

      <!-- (A LEDGER outcome — «all your colony bonuses», TR23 — is NOT a swap of this column: the configuration
           surface below STAYS and its ledger pays row by row; the flow's steps stand as LAYERS above it, in the
           ledger zone at the foot of this column.) -->
      <template v-else-if="outcome !== undefined && outcome.kind !== 'ledger' && outcome.kind !== 'law-play'">

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
           v-embed-zone
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
                <span class="con-ws-stage-badge__label">{{ $t(beatLanded && !beatLook ? 'Received' : 'Cards') }}</span>
                <b class="con-ws-stage-badge__num">{{ beatCount }}</b>
              </span>
            </template>
          </ConsoleWsStageHead>
          <div class="con-cards__strip con-ws-stage-row con-composer__beatrow"
               :class="{'con-composer__beatrow--fit': Object.keys(beatRowStyle).length > 0}"
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
          <div class="con-composer__verdictslot" ref="verdictSlot">
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
      <!-- data-forecast-browse: the surface the R3 «Эффекты» layer parks in
           place (consoleForecastFocusMotion) — every capture survives. -->
      <div class="con-composer__surface" data-unfold-surface data-forecast-browse ref="surfaceEl" :style="ledgerSurfaceStyle">

      <!-- ── WHAT THIS ACTION DOES — the operation's own sentence, and the
           surface's semantic lead: the player reads the RULE, then what it
           will cost/give, then commits. It is resolved for the SELECTED
           VARIANT (actionDescription: the curated information block of this
           very action node, else its printed DSL rule), so an «или» card
           never shows its other half's text. Same label vocabulary as the
           fullscreen ПРАВИЛА tab — one system, not a second reference. -->
      <div v-if="rules !== undefined" v-show="!venusStepOpen" class="con-composer__rules" data-unfold-item>
        <div v-for="(line, k) in rules.lines" :key="k" class="con-composer__rule"
             :class="'con-composer__rule--' + line.kind">
          <!-- The sheet never titles itself (P73 · DC — «… › НАСТРОЙКА» is the crumb's): the plain RULE line wears no
               «ДЕЙСТВИЕ» chip; only a NOTE keeps its tag, the one that tells it apart from the rule beside it. -->
          <span v-if="line.kind !== 'rule'" class="con-composer__rule-label">{{ $t(ruleLabel(line.kind)) }}</span>
          <p class="con-composer__rule-text">{{ ruleText(line.text) }}</p>
        </div>
      </div>

      <!-- ── THE BODY OF THE SHEET (P73 · DC, iteration 2 — the owner: «простое действие — информация сверху, всё
           остальное пустое»). The sheet mirrors the card beside it: the rule above is its TITLE plate, this body is
           its ART zone, the commit dock below is its MECHANICS box. The body takes the room between them and CENTRES
           its block when the block fits (a simple action's statement stands at the card's mid-height, beside the art
           — air above and below by design, never a form pinned to the top); a block taller than the room starts at
           the top and scrolls only its decision list (`safe center`). -->
      <div class="con-composer__body" data-setup-body ref="bodyEl" :style="ledgerBodyStyle">
      <!-- ── Hero: the LIVE cost → reward formula of the ACTIVE branch.
           Shown once a branch is chosen (or a single-branch card); the
           multi-branch option cards below carry their own chips. ─────── -->
      <div v-if="showHero" v-show="!venusStepOpen" class="con-composer__hero" data-unfold-item>
        <div v-if="heroCost.length > 0" class="con-composer__hero-side">
          <div class="con-composer__hero-label">{{ $t('Will be spent') }}</div>
          <div class="con-composer__hero-chips">
            <ActionEffectChip v-for="(eff, k) in heroCost" :key="'c' + k" :effect="eff" :basis-in-strip="heroCountWhy !== undefined && heroCountWhy.chip === eff" />
          </div>
        </div>
        <!-- THE RESERVED PRICE (TR58 — the mirror of the reserved «Вы получите»): the variants are PRICES of one good,
             so the good stands from the first frame and the price side is the slot the chosen tile fills. -->
        <div v-else-if="heroPricePending" class="con-composer__hero-side con-composer__hero-side--pending" data-hero-pending="price">
          <div class="con-composer__hero-label">{{ $t('Will be spent') }}</div>
          <div class="con-composer__hero-chips">
            <span class="con-composer__hero-slot" aria-hidden="true"></span>
          </div>
        </div>
        <!-- The arrow LEADS the consequence (it rides inside the «Вы получите» side): when the line wraps on the couch,
             «→ Вы получите» opens the second row — never an arrow stranded at the end of the first. -->
        <div v-if="heroGain.length > 0 || heroTimeline !== undefined" class="con-composer__hero-side">
          <span v-if="heroCost.length > 0 || heroPricePending" class="con-composer__hero-arrow" aria-hidden="true">→</span>
          <div class="con-composer__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-composer__hero-chips">
            <!-- A TIMELINE on the card's own capsule (TR28): ONE chip, start → end, its two movements in order. -->
            <ActionEffectChip v-if="heroTimeline !== undefined" :effect="heroTimeline.effect" :moves="heroTimeline.moves" data-capsule-timeline />
            <ActionEffectChip v-for="(eff, k) in heroGain" :key="'g' + k" :effect="eff" :basis-in-strip="heroCountWhy !== undefined && heroCountWhy.chip === eff" />
          </div>
        </div>
        <!-- THE RESERVED SIDE (2026-10-14 — the owner's «the workspace jumps after a choice»): while the variant is
             unchosen the formula already HAS its «Вы получите» side — an empty slot the answer will fill — so choosing
             fills a place that stood there, it never grows the line (the formula grew a second row and slid the tiles
             126 px down under the cursor that had just pressed them). -->
        <div v-else-if="heroPending" class="con-composer__hero-side con-composer__hero-side--pending" data-hero-pending>
          <span v-if="heroCost.length > 0" class="con-composer__hero-arrow" aria-hidden="true">→</span>
          <div class="con-composer__hero-label">{{ $t('You will receive') }}</div>
          <div class="con-composer__hero-chips">
            <span class="con-composer__hero-slot" aria-hidden="true"></span>
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
        <!-- ⚡ «СРАБОТАЕТ» — the formula's FOURTH side: what the TABLE adds to
             this action (chips only; the R3 layer names the sources). -->
        <div v-if="forecastRowShown" class="con-composer__hero-side con-composer__hero-side--forecast">
          <div class="con-composer__hero-label">{{ $t('Will trigger') }}</div>
          <ConsoleForecastRow class="con-composer__hero-forecast"
                              :class="{'con-forecast--descend': forecastPulse}"
                              :forecast="forecast" :caption="false"
                              @open="openForecastLayer()" />
        </div>
      </div>
      <!-- «РАСЧЁТ» OF A PARLIAMENT COUNT (TRP0 Corridors of Power): the resolutions the result counts, each its emblem
           and «own / all» delegates, the ones short of the threshold named — the play composer's ONE strip
           (`ConsoleCountedWhy`), under the formula; the chip above stops restating the basis. -->
      <ConsoleCountedWhy v-if="showHero && heroCountWhy !== undefined" v-show="!venusStepOpen" class="con-composer__countwhy" :why="heroCountWhy" data-unfold-item />
      <!-- No formula (a branch not yet chosen / a decision-less action): the
           plain line, and the «Сработает» row as ONE line under the rule —
           never a new vertical section. The condition is SPELLED OUT (never a `v-else-if` behind the formula): the
           «РАСЧЁТ» strip inserted between them silently turned this into «whenever there is no count» — the sentence
           «Подтвердите…» stood under every formula, restating the commit plate. -->
      <div v-if="!showHero && (!hasDecisions || forecastRowShown)" v-show="!venusStepOpen" class="con-composer__hero con-composer__hero--plain" data-unfold-item>
        <span v-if="!hasDecisions">{{ $t('Confirm to perform this action.') }}</span>
        <ConsoleForecastRow v-if="forecastRowShown" class="con-composer__hero-forecast con-composer__hero-forecast--line"
                            :class="{'con-forecast--descend': forecastPulse}"
                            :forecast="forecast"
                            @open="openForecastLayer()" />
      </div>
      <!-- ── WHAT THE RESOURCE HERE BUYS, AFTER THE MOVE (P73 · DC, iteration 2) — the one line the statement owes
           and the face cannot print: the hero's own stored resource moves («+1 floater here», «−2 from here»), and
           its ROLE on this card (the satellite's own model — `holderRoleOf`) says what that is worth once it has
           landed: the action it opens («Действие откроется: 2 / 2»), the money it pays as tender, the delegate or
           trade it reaches. A VP role says nothing here — the VP chip above already reads the points; plain storage
           has nothing to say; a move on ANOTHER card is that step's own reading. -->
      <div v-if="setupContext !== undefined" v-show="!venusStepOpen" class="con-composer__context" data-unfold-item data-setup-context>
        <div class="con-composer__context-kicker">{{ $t('After the action') }}</div>
        <div class="con-composer__context-line">
          <i v-for="(icon, k) in setupContext.icons" :key="k" class="con-composer__context-icon" :class="iconClass(icon)" aria-hidden="true"></i>
          <span class="con-composer__context-text">{{ setupContext.text }}</span>
        </div>
      </div>

      <!-- ── THE LEDGER — «all your colony bonuses» as the BODY of this action's result (TR23 Habitat Science).
           The chips above answer «how much» (one parameter — one vector); the ledger answers «from where»: a row
           per colony the player owns, in the order the engine pays them — the planet, its printed bonus, «× N» for
           a tile with several cubes, the word of the step a row will raise, the refusal of a row that cannot land.
           THE SAME DOM pays after the press: the rows go from «promised» to «paying» to «received» where they
           stand, each wave born on its own row's printed bonus (`data-colony-bonus`) — never remounted, never
           re-ordered. The flow's steps (the take, the discard) stand as layers ABOVE it and it comes back after
           each (`con-composer--ledgerstep`). `data-colony-ledger-scope` is the wave's lookup scope. ── -->
      <div v-if="ledgerReading !== undefined" v-show="!venusStepOpen" class="con-composer__ledger" data-unfold-item data-colony-ledger-scope="card">
        <ConsoleColonyLedger :reading="ledgerReading"
                             size="normal"
                             :kicker="ledgerKicker"
                             :activeColony="ledgerActiveColony"
                             :landedColonies="ledgerLanded" />
      </div>

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
                                 :lockedCard="playedTargetResults[sub.choiceId]?.cardName ?? ''"
                                 :decline="subDecline" />

        <!-- THE VENUS BONUS'S INNER STEP (P89 · EM): a level of the setup in the decision column's place — the 30 % wild's
             OR, its card, the 2 × 3 standard grid; its own confirm comes back to the column on the next question. -->
        <ConsoleVenusBonusStep v-else-if="sub !== undefined && sub.kind === 'venus' && venusSubChoice !== undefined"
                               ref="venusStep"
                               class="con-composer__venusstep"
                               :viewer="{name: playerView.thisPlayer.name, color: playerView.thisPlayer.color}"
                               :input="venusSubChoice.input" :parts="venusPartsOf(venusSubChoice)"
                               :focus="sub.focus" :stock="venusStock" />

        <!-- THE WILD-RESOURCE CHOICE (P43 · EN / EO): the printed «?» row's inner step — the SHARED component, exclusive:
             the OR is the branch, its slot the branch's own answer (the candidates · the six as a radio). -->
        <ConsoleWildChoiceStep v-else-if="sub !== undefined && sub.kind === 'wild' && wildSpec !== undefined"
                               class="con-composer__venusstep"
                               :spec="wildSpec" :parts="wildParts" :focus="sub.focus" :stock="venusStock"
                               :head="{title: wildHeadTitle, reading: ''}"
                               :titles="{asStandard: 'Standard resource'}"
                               :descs="{onCard: 'A card that already has a resource', asStandard: 'Any of the six, your choice'}"
                               :candidates="wildCandidateModels" :vp-box="wildVpBox" :resource-by-card="wildResourceByCard">
          <!-- «НА КАРТУ» IS THE CONSOLE'S ONE TARGET SELECTOR (the owner, 2026-11-02): the same step every «where does it
               go» of this composer walks — its rows solved off the slot's box (a row cap, then rows), the near misses, the
               outcome tags, the rail under the cursor, X with the target dossier. Built off the card branch's own step
               (`playedTargetModelFor`), so the slot and the live pick read ONE set. -->
          <template #cards="{width, height}">
            <ConsolePlayedTargetStep v-if="wildTargetModel !== undefined"
                                     ref="wildTargetStep"
                                     :model="wildTargetModel"
                                     :layout="wildTargetLayoutFor(width)"
                                     :focus="wildTargetFocusShown"
                                     :selection="{mode: 'single'}"
                                     :bandHeight="height"
                                     :lockedCard="wildParts.wild?.card ?? ''"
                                     hostStatesAsk />
          </template>
        </ConsoleWildChoiceStep>

        <!-- SUB-STATE: a premium pick list (card / player / or), and the SAME
             list one level deeper when the chosen or-branch is itself an input
             («выберите карту» inside a removal that also offers the bot). -->
        <template v-else-if="sub !== undefined && (sub.kind === 'list' || sub.kind === 'orNested')">
          <!-- THE QUESTION LINE: the ask, and an optional choice's DECLINE plate — the refusal is a button (RT), never
               one more row among the answers (2026-10-13). -->
          <div class="con-composer__sub-head">
            <div class="con-composer__sub-title">{{ subTitle }}</div>
            <ConsoleDeclinePlate v-if="subDecline !== undefined" class="con-composer__sub-decline"
                                 :label="subDecline.label" :forgone="subDecline.forgone" />
          </div>
          <!-- THE PICK LIST — the variant grammar's LIST layout (`ConsoleVariantChoice`, TR51); a pick of ONE standard
               resource among several (Astrodrill's «any standard resource») is its PALETTE (TR54): one row of equal
               tiles, the resource's own sprite and number leading each, the printed «?» on the kicker, ←→ along it. -->
          <ConsoleVariantChoice class="con-composer__sublist" :layout="subPalette ? 'palette' : 'list'" :exclusive="false"
                                :kicker="subPalette ? paletteKicker : ''" :emblem="subPalette ? 'wild' : 'none'"
                                :data-variant-axis="subPalette ? 'row' : undefined"
                                :options="listOptions" :label="subTitle">
            <template #body="{index}">
              <template v-for="item in [listItems[index]]" :key="item.key">
                <span v-if="item.resIcon !== ''" class="con-composer__opt-res">
                  <i class="con-composer__opt-res-icon" :class="iconClass(item.resIcon)" aria-hidden="true"></i>
                  <b>{{ item.resCount }}</b>
                </span>
                <span v-if="item.impact !== ''" class="con-composer__opt-impact">{{ item.impact }}</span>
                <!-- An or-option's own premium chips — the SAME `ActionEffectChip` the formula and the play screen use. -->
                <span v-for="(eff, k) in (item.chips ?? [])" :key="'ch' + k" class="con-composer__opt-chip"><ActionEffectChip :effect="eff" /></span>
                <span v-for="(w, k) in (item.warnings ?? [])" :key="'w' + k" class="con-composer__opt-warn">⚠ {{ $t(w) }}</span>
                <!-- «Это вы» on a PLAYER row: only when it COSTS you and another target was selectable. -->
                <span v-if="item.selfHarm" class="con-composer__opt-warn">⚠ {{ $t('This is you') }}</span>
              </template>
            </template>
          </ConsoleVariantChoice>
        </template>

        <!-- MAIN (and the EXPANDED payment editor, which is this SAME screen
             with the payment block promoted — see the ConsolePaymentPanel
             mount below; the rows, the CTA and the source card never move). -->
        <template v-else>
          <template v-for="item in items" :key="item.id">
            <!-- THE VARIANTS — the variant grammar (`ConsoleVariantChoice`, TR51), one group at the first branch row: each
                 OUTCOME TILE leads with the card's printed graphic of THAT variant (a row the server splits into
                 several branches is sliced at its printed «/» / «ИЛИ» — `BranchView.printed`), then its formula
                 «цена → выигрыш», the table's answer to it and what it still needs; the seal marks the answer.
                 The tiles stand SIDE BY SIDE (`compare`), and the d-pad follows the geometry the way the play
                 composer's «ИЛИ» does: ←→ switch the tiles while the cursor stands in a row, ↑↓ leave the group;
                 stacked (the cluster too narrow), ↑↓ walk them as rows (`variantGroupNav`, the measured
                 `data-variant-axis`). -->
            <!-- THE WILD-RESOURCE ROW (P43 · EN): the card's ONE printed «?» over its two branches — a DOOR into the shared
                 inner step; answered, it reads the answer in chips («[сталь] +1» · «[животное] +1 · Птицы»). The price
                 stands once, in the formula above (a row never repeats what the screen already prints). -->
            <!-- A STANDALONE «?» (P50 · FC) is the same row, ONE per step, its verb printed first («Потратить» · «Получить»)
                 and its answer signed by its role («[растения] −1» · «[тепло] +1»). -->
            <div v-if="item.kind === 'wild'"
                 class="con-composer__row con-composer__wildrow"
                 :class="{'con-composer__row--focused': isFocused(item), 'con-composer__row--missing': wildRowAnswerOf(item) === undefined}"
                 data-choice-kind="wild" data-wild-row :data-wild-answered="wildRowAnswerOf(item) !== undefined ? '' : undefined"
                 :data-wild-row-mode="wildRowMode(item)"
                 :ref="isFocused(item) ? 'focusedEl' : undefined">
              <span class="con-composer__wildrow-print">
                <i class="con-composer__wildrow-wild" :class="iconClass('wild')" aria-hidden="true" data-wild-row-glyph></i>
              </span>
              <span v-if="wildRowMode(item) !== undefined" class="con-composer__wildrow-verb">{{ $t(wildRowMode(item) === 'spend' ? 'Spend' : 'Gain') }}</span>
              <span v-if="wildRowAnswerOf(item) === undefined" class="con-composer__wildrow-ask">{{ $t(wildRowAsk(item)) }}</span>
              <span v-else-if="wildRowAnswerOf(item)?.kind === 'standard'" class="con-composer__wildrow-answer" data-wild-row-answer="standard">
                <i class="con-composer__wildrow-icon" :class="iconClass(wildRowStandard(item))" aria-hidden="true"></i><b>{{ wildRowAnswerOf(item)?.mode === 'spend' ? '−' : '+' }}{{ wildRowAnswerOf(item)?.amount }}</b>
              </span>
              <span v-else-if="wildAnswer !== undefined && wildAnswer.kind === 'card'" class="con-composer__wildrow-answer" data-wild-row-answer="card" :data-wild-row-card="wildAnswer.card">
                <i v-if="wildResourceByCard[wildAnswer.card] !== undefined" class="con-composer__wildrow-icon" :class="iconClass(wildResourceByCard[wildAnswer.card] ?? '')" aria-hidden="true"></i><b>+{{ wildAnswer.amount }}</b>
                <span class="con-composer__wildrow-card">{{ $t(wildAnswer.card) }}</span>
              </span>
              <span class="con-composer__wildrow-door" aria-hidden="true">›</span>
            </div>
            <ConsoleVariantChoice v-else-if="item.kind === 'branch' && item.pos === branchItemPositions[0]"
                                  ref="branchesEl"
                                  class="con-composer__branches"
                                  :layout="branchPalette ? 'palette' : 'compare'"
                                  :kicker="branchPalette ? branchPaletteKicker : ''"
                                  :emblem="branchPalette ? 'wild' : 'none'"
                                  :data-variant-axis="branchAxis"
                                  :options="branchOptions"
                                  :shared="variantShared"
                                  :label="$t('Choose an option')"
                                  @pick="pickBranchAt($event)">
              <template #body="{index}">
                <template v-for="pos in [branchItemPositions[index]]" :key="pos">
                  <div class="con-composer__branch-formula">
                    <!-- A price every variant shares is the action's, not this card's: printed once, in the formula above. -->
                    <template v-for="(eff, k) in branchCostShown(pos)" :key="'c' + k">
                      <ActionEffectChip :effect="eff" />
                    </template>
                    <span v-for="(vc, k) in branchView(pos).variableCost" :key="'vc' + k" class="con-composer__varchip con-composer__varchip--spend">
                      <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                      <b>{{ rangeText(vc) }}</b>
                    </span>
                    <span v-if="branchHasBothSides(pos)" class="con-composer__branch-arrow" aria-hidden="true">→</span>
                    <!-- A good every variant buys is the group's, not this tile's: printed once, after the tiles (TR58). -->
                    <template v-for="(eff, k) in branchGainShown(pos)" :key="'g' + k">
                      <ActionEffectChip :effect="eff" />
                    </template>
                    <span v-for="(vc, k) in branchView(pos).variableGain" :key="'vg' + k" class="con-composer__varchip con-composer__varchip--result">
                      <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                      <b>{{ rangeText(vc) }}</b>
                    </span>
                    <span v-for="(vc, k) in branchView(pos).variableChoice" :key="'vx' + k" class="con-composer__varchip">
                      <i v-if="vc.icon" class="con-composer__varchip-icon" :class="iconClass(vc.icon)" aria-hidden="true"></i>
                      <b>{{ rangeText(vc) }}</b><em>{{ $t('your choice') }}</em>
                    </span>
                    <!-- «⚡ сработает» — the reactions tied to THIS variant (the forecast's `byBranch`). -->
                    <ConsoleForecastReactions :reaction="variantReactions(pos)" />
                  </div>
                  <div v-if="branchView(pos).needs !== ''" class="con-composer__branch-needs">◈ {{ branchView(pos).needs }}</div>
                  <!-- THE SOLE LIVE VARIANT'S MARK (T14 · CC for a variant, R33): the rules left one — it opens chosen,
                       SHOWN and quietly named, never applied in silence. -->
                  <span v-if="soleVariantPos === pos" class="con-composer__sole" data-seeded-mark
                        :data-hint="$t('No other options')">{{ $t('The only option') }}</span>
                </template>
              </template>
            </ConsoleVariantChoice>

            <!-- A choice input row (amount inline / picker / spend-heat).
                 PAYMENT is NOT here — it's a persistent panel below, edited by
                 the dedicated LT + inline LB/RB, never a focus row. -->
            <div v-else-if="item.kind === 'choice'"
                 class="con-composer__row"
                 :class="{
                   'con-composer__row--focused': isFocused(item),
                   'con-composer__row--missing': choiceMissing(item.choice),
                   'con-composer__row--dial': item.choice.id === focusFreeDialId,
                 }"
                 :data-choice-kind="item.choice.kind"
                 :data-seeded="soleMark(item.choice) !== undefined ? 'sole' : undefined"
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
                <div v-else-if="repeatResult !== undefined" class="con-composer__repeatpick" data-composer-repeat-slot>
                  <div class="con-composer__repeatpick-graphic card-container" v-i18n v-strip-action-prefix>
                    <CardRenderEffectBoxComponent v-if="repeatNode !== undefined && repeatNode.actionNode !== undefined" :effectData="repeatNode.actionNode" />
                    <CardRenderData v-else-if="repeatNode !== undefined && repeatNode.renderRoot !== undefined" :renderData="repeatNode.renderRoot" />
                    <span v-else class="con-composer__graphic-text">{{ repeatNode !== undefined ? repeatNode.text : '' }}</span>
                  </div>
                  <span class="con-composer__repeatpick-name" data-composer-repeat-name>{{ $t(repeatResult.chosenCard) }}</span>
                </div>
                <div v-else class="con-composer__row-value" data-composer-repeat-slot>
                  <span class="con-composer__row-empty">{{ $t('Choose an action to repeat') }}…</span>
                </div>
              </template>
              <!-- A LAW THAT PLAYS A CARD (RX36 Live Experiments): the decision is a SLOT — «which card, and how» is
                   answered by the hand album with the play composer one level deeper (`consolePlayPick`), hosted as a
                   step of this stage; the composed card stands here with its price and rides THIS commit. -->
              <template v-else-if="item.choice.kind === 'lawPlay'">
                <div class="con-composer__row-label">{{ $t('Card') }}</div>
                <div class="con-composer__playslot" :class="{'con-composer__playslot--filled': lawPlayResultOf(item.choice) !== undefined}"
                     data-law-play-slot :data-law-play-card="lawPlayResultOf(item.choice)?.cardName">
                  <template v-if="lawPlayResultOf(item.choice) !== undefined">
                    <span class="con-composer__playslot-face" data-law-play-face :data-zoom-slot="lawPlayResultOf(item.choice)?.cardName">
                      <ConsoleCardFaceLite :name="lawPlayResultOf(item.choice)!.cardName" :card="lawPlayCardModel(item.choice)" :lightweight="true" />
                    </span>
                    <span class="con-composer__playslot-read">
                      <b class="con-composer__playslot-name" data-law-play-name>{{ $t(lawPlayResultOf(item.choice)!.cardName) }}</b>
                      <span class="con-composer__playslot-cost"><ActionEffectChip :effect="lawPlayCostChip(item.choice)" /></span>
                      <span v-if="lawPlayOpenedByLaw(item.choice)" class="con-composer__playslot-eased" data-law-play-eased>✓ {{ lawPlayThanksText }}</span>
                      <span class="con-composer__playslot-total" data-law-play-total>{{ lawPlayTotalLine(item.choice) }}</span>
                    </span>
                  </template>
                  <!-- EMPTY: the card's PLACE already stands (a card-shaped socket at the face's own size), so filling
                       the slot swaps what stands in it and moves nothing. -->
                  <template v-else>
                    <span class="con-composer__playslot-socket" aria-hidden="true">
                      <span class="con-composer__playslot-socket-icon resource_icon resource_icon--cards"></span>
                    </span>
                    <span class="con-composer__playslot-read">
                      <span class="con-composer__row-empty">{{ $t('Choose a card from your hand to play') }}…</span>
                    </span>
                  </template>
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

              <!-- THE VENUS BONUS, PRE-SELECTED (P89 · ledgers EL / EM): ONE row with the play composer — the raise and the
                   answer in chips; A opens the INNER step (`sub` venus): the 30 % wild, its card, the 2 × 3 standard grid. -->
              <template v-else-if="item.choice.kind === 'venusBonus'">
                <ConsoleVenusBonusRow :input="item.choice.input" :parts="venusPartsOf(item.choice)" />
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

              <!-- THE TARGET ROW (TR56 «КУДА ЛЯЖЕТ», П2) — ONE row with the play composer (`ConsoleComposerTargetRow`): the
                   question «КУДА: [печать]» never changes; unanswered, the server's candidates as a strip of live faces;
                   answered, a LINK to the card still lying in its owner's tableau — its miniature (a flight end of the
                   commit's rail half, `data-composer-card`), origin and the step's own tag. The CHANGE affordance is drawn
                   ONLY under the cursor. -->
              <template v-else-if="isPlayedTargetChoice(item.choice) || playedTargetResult(item.choice) !== undefined">
                <ConsoleComposerTargetRow :label="targetRowLabel(item.choice)"
                                          :asker="colonyAskerOf(item.choice)"
                                          :payload="targetRowPayload(item.choice)"
                                          :candidates="playedTargetInputFor(item.choice)?.cards ?? []"
                                          :sourceCard="heroCardName"
                                          :result="playedTargetResult(item.choice)"
                                          :resultModel="targetRowModel(item.choice)"
                                          :tag="targetRowTag(item.choice)"
                                          :impacts="targetSummaryImpacts(item.choice)"
                                          :sole="soleMark(item.choice)"
                                          :focused="isFocused(item)" />
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
              <!-- The BLOCKADE TARGET slot (Modular Floodgates): empty → a
                   prompt to walk the track; filled → who is blocked and for
                   how long, with the change affordance under the cursor.
                   Structural off the input's own type. -->
              <template v-else-if="item.choice.input.type === 'deltaBlockade'">
                <div class="con-composer__row-label">{{ $t('Blockade target') }}</div>
                <div v-if="blockadeSummary(item.choice) !== ''" class="con-composer__row-value">
                  <span>{{ blockadeSummary(item.choice) }}</span>
                  <span class="con-composer__target-change" :class="{'con-composer__target-change--on': isFocused(item)}">
                    <GamepadGlyph control="confirm" />
                    <span>{{ $t('Change selection') }}</span>
                  </span>
                </div>
                <div v-else class="con-composer__row-value">
                  <span class="con-composer__row-empty">{{ $t('Choose a player to block on the Hydronetwork') }}…</span>
                </div>
              </template>
              <!-- The PLAN's LANDING pre-select (a deferred deltaAdvance door
                   whose destination stage asks a choice): empty → a prompt to
                   walk the track; filled → the landed stage + its pick. The
                   answer is only ever given ON the track (the reward-pick in
                   its advance-landing form) — the player sees the move the
                   choice belongs to before choosing. -->
              <template v-else-if="item.choice.deltaLanding !== undefined">
                <div class="con-composer__row-label">{{ $t('Destination stage reward') }}</div>
                <div v-if="deltaLandingSummary(item.choice) !== ''" class="con-composer__row-value">
                  <span>{{ deltaLandingSummary(item.choice) }}</span>
                  <span class="con-composer__target-change" :class="{'con-composer__target-change--on': isFocused(item)}">
                    <GamepadGlyph control="confirm" />
                    <span>{{ $t('Change selection') }}</span>
                  </span>
                </div>
                <div v-else class="con-composer__row-value">
                  <span class="con-composer__row-empty">{{ $t('Choose a stage reward on the Hydronetwork') }}…</span>
                </div>
                <ConsoleHydroGains v-if="deltaLandingPreview(item.choice) !== undefined"
                                   class="con-composer__stagegains"
                                   :view="deltaLandingPreview(item.choice)!"
                                   :compact="true" />
              </template>
              <template v-else>
                <div class="con-composer__row-label">{{ choiceTitle(item.choice) }}</div>
                <div class="con-composer__row-value">
                  <span v-if="chosenLabel(item.choice) !== ''">{{ chosenLabel(item.choice) }}</span>
                  <span v-else class="con-composer__row-empty">{{ pickPlaceholder(item.choice) }}…</span>
                  <!-- THE SOLE CANDIDATE'S MARK (T14 · CC) — the composer answered this row: nothing to choose. -->
                  <template v-for="m in [soleMark(item.choice)]" :key="item.id + '#sole'">
                    <span v-if="m !== undefined" class="con-composer__sole" data-seeded-mark :data-hint="$t(m.hint)">{{ $t(m.mark) }}</span>
                  </template>
                  <span v-if="chosenImpact(item.choice) !== ''" class="con-composer__row-impact">{{ chosenImpact(item.choice) }}</span>
                </div>
              </template>
            </div>
          </template>

          <!-- The action changes NOTHING right now (the server's proven verdict): one calm line, never a warning —
               the press stays a full commit (the player may take it to stall). -->
          <div v-if="futileVerdict !== undefined" class="con-composer__warn con-composer__warn--futile" data-composer-futile>
            <span class="con-composer__warn-glyph" aria-hidden="true">○</span>
            <span class="con-composer__warn-text">{{ $t(futileVerdict.reason) }} · {{ $t('the action will change nothing') }}</span>
          </div>

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
            <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :class="{'con-composer__next-tile--over': n.over !== undefined}" :style="tileIconStyle(n.tileType, n.over)" aria-hidden="true"></span>
            <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
            <span class="con-composer__next-label">{{ $t('Next') }}</span>
            <span class="con-composer__next-text">{{ n.text }}</span>
            <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
          </div>

          <!-- THE DECK CHECK'S «ДО» — what the revealed card will be checked FOR,
               drawn with the SAME glyph the card face prints (a tag, or the
               any-party requirement plate) — and, when the descriptor carries
               it, the COMPOSITION behind the odds: how many such cards this game
               holds at all (open information; never the hidden deck's count,
               never a probability). Zero is warned in the amber register above
               — the action stays available, revealing and discarding is legal. -->
          <div v-if="revealPreview !== undefined" class="con-composer__next con-composer__next--check" data-reveal-check>
            <span class="con-composer__next-check" aria-hidden="true">
              <PremiumPartyRequirementGlyph v-if="revealPreview.check.glyph.kind === 'party-requirement'" class="con-composer__next-plate" />
              <i v-else-if="revealPreview.check.glyph.kind === 'tag'" class="con-composer__next-tag"
                 :style="{backgroundImage: 'url(' + revealPreview.check.glyph.url + ')'}"></i>
            </span>
            <span class="con-composer__next-label">{{ $t('Checked') }}</span>
            <span class="con-composer__next-text">{{ revealCheckLabel }}</span>
          </div>
          <div v-if="revealPreview !== undefined && revealPreview.pool !== undefined"
               class="con-composer__next con-composer__next--pool"
               :class="{'con-composer__next--pool-empty': revealPreview.pool.empty}"
               :data-reveal-pool="revealPreview.pool.count">
            <span class="con-composer__next-glyph" aria-hidden="true">#</span>
            <span class="con-composer__next-text">{{ poolLine(revealPreview.pool) }}</span>
          </div>
          <!-- A SPLIT REVEAL'S «ДО» (P88 — `revealSplit`): what leaves the deck, and where each kind of card
               goes — the check's own printed glyph, the price of the rest, how many of them the wallet can
               take, and the open deck size. Structure only: every number is the server's descriptor. -->
          <template v-if="revealSplitRows.length > 0">
            <div v-for="row in revealSplitRows" :key="row.key" class="con-composer__next con-composer__next--split"
                 :data-reveal-split="row.key">
              <span v-if="row.tagUrl !== undefined" class="con-composer__next-check" aria-hidden="true">
                <i class="con-composer__next-tag" :style="{backgroundImage: 'url(' + row.tagUrl + ')'}"></i>
              </span>
              <i v-else-if="row.iconClass !== undefined" class="con-composer__next-res" :class="row.iconClass" aria-hidden="true"></i>
              <span class="con-composer__next-text">{{ row.text }}</span>
              <span v-if="row.tail !== ''" class="con-composer__next-tail">{{ row.tail }}</span>
            </div>
          </template>

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
      </div><!-- /__body -->

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
        <!-- The honest readiness line: names the FIRST missing decision. It rides the dock's own LANE above the rail
             (absolute — zero layout): answering the last question takes the line away without moving the rail. -->
        <transition name="con-ctahint">
          <div v-if="ctaDockHint !== ''" class="con-composer__cta-hint">
            <span aria-hidden="true">◈</span>
            <span>{{ ctaDockHint }}</span>
          </div>
        </transition>
        <!-- THE COMMIT ROW. It stays in place whatever the gate says — the flow
             must keep its shape — but it only wears the ACTIVE treatment (ring,
             live Ⓐ) when the gate would actually run it. `--held` is the honest
             third state: readable, clearly not pressable, and never mistakable
             for «selected». `aria-disabled` carries the same fact to anything
             that is not looking at the pixels. -->
        <div class="con-composer__cta"
             :class="{
               'con-composer__cta--off': !ctaDockReady && !ctaBusy,
               'con-composer__cta--ready': ctaDockReady && !ctaBusy,
               'con-composer__cta--focused': ctaFocused && commitReady && !ctaBusy,
               'con-composer__cta--held': !commitReady && !ctaBusy,
               'con-composer__cta--waiting': ctaBusy,
               'con-composer__cta--done': ledgerSettled,
             }"
             :aria-disabled="!commitReady || ctaBusy ? 'true' : 'false'"
             :data-composer-armed="commitArrival.armed && ctaFocused ? '' : undefined"
             :ref="ctaFocused && commitReady ? 'focusedEl' : undefined"
             @animationend="onCommitBreathEnd"
             @click="submit">
          <!-- The glyph appears only with the press it stands for. -->
          <GamepadGlyph v-if="!ctaBusy && commitReady" control="confirm" class="con-composer__cta-glyph" />
          <span v-else-if="ctaBusy && !ledgerSettled" class="con-composer__cta-wait" aria-hidden="true"></span>
          <span class="con-composer__cta-label">{{ $t(ledgerSettled ? 'Completed' : ctaBusy ? 'Performing…' : ctaDockLabel) }}</span>
        </div>
      </div>

      </div><!-- /__surface -->

      <!-- ── THE «ЭФФЕКТЫ» LAYER (R3) — a LEVEL of this composer: the surface
           above PARKS in place, the effects explorer (forecast mode) UNFOLDS
           out of the «Сработает» row, B / R3 fold it back with every capture
           intact. The crumb gains «· ЭФФЕКТЫ». ── -->
      <transition :css="false"
                  @enter="forecastFocusEnterHook"
                  @leave="forecastFocusLeaveHook"
                  @enter-cancelled="forecastFocusEnterCancelledHook"
                  @leave-cancelled="forecastFocusLeaveCancelledHook">
        <div v-if="fxOpen" key="fx" class="con-composer__fxlayer" data-forecast-layer>
          <div class="con-composer__fxpanel" data-forecast-surface>
            <ConsoleEffectsExplorer ref="forecastExplorer"
                                    mode="forecast"
                                    operation="action"
                                    :explorerUi="forecastUi"
                                    :forecast="forecast"
                                    :cards="thisPlayer.tableau"
                                    :color="thisPlayer.color"
                                    :players="playerView.players"
                                    :branches="forecastBranches"
                                    :selectedBranchPos="selectedPos"
                                    :statsByColor="forecastStatsByColor"
                                    :orderFlags="forecastOrderFlags" />
          </div>
        </div>
      </transition>
      </template><!-- /decision column (non-reveal) -->

      <!-- ── THE LEDGER FLOW'S STEPS (TR23 — «the ledger pays»): the take of a row's drawn card and the hand's
           discard (Pluto's pair) stand HERE, as LAYERS of the decision column over the parked ledger — one
           teleported instance each (the shell's reveal into `workspace-reveal`, the hand frame into
           `action-hand`), never a swap of the column. A layer stack in ONE cell: a departing step paints through
           its leave beside the returning ledger. Always rendered (empty and inert outside a step), so a step always
           has its zone before its teleport looks for it. ── -->
      <!-- ── A LAW'S CARD LANDS IN THIS STAGE (RX36, PL-726): past the commit the decision column IS the receiving
           tableau — the hand composer's own stage (`ConsolePlayedReceivingStage`) as a LAYER over the column, mounted
           in the hidden prewarm window and shown from the card's lift to the workspace's leave. ── -->
      <div v-if="lawLandingMounted" ref="lawPlaystage" class="con-composer__playstage" :class="{'con-composer__playstage--up': lawLandingUp}" data-law-landing>
        <ConsolePlayedReceivingStage :playerView="playerView" />
      </div>
      <div class="con-composer__ledgerzone" :class="{'con-composer__ledgerzone--on': ledgerStepOn || lawOutcomeIn}" data-colony-ledger-zone>
        <div v-if="ledgerPaying" v-embed-zone class="con-composer__ledgerlayer con-composer__revealzone con-composer__revealzone--draw"
             data-outcome-zone data-embed-slot="workspace-reveal"></div>
        <!-- ── WHAT A LAW'S CARD SETS OFF (RX36): its draw, its keep-some pick, a woken card's question, a repeated
             action's verdict — the shell's ONE presenter teleported HERE, a layer over the landed tableau (which
             dissolves as it rises), never a band over the board after the workspace left. Rendered from the press. -->
        <div v-if="lawOutcomeZoneOn" v-embed-zone class="con-composer__ledgerlayer con-composer__revealzone con-composer__revealzone--draw"
             data-outcome-zone data-embed-slot="law-outcome" data-law-outcome></div>
      </div>

      </div><!-- /__actright -->
      </div><!-- /__actmain -->

      <!-- ── THE PARLIAMENT STEP — the vote mode stands HERE, as a step of this
           action (`card-actions ⊃ parliament`, one teleported instance): a blue
           card's action that places a delegate (Turmoil Redux TR15 «3 data →
           a delegate on a resolution» — a STAGED ACTION VOTE: nothing is sent
           before the mode's confirm), or the live grant the answer raised. The
           Parliament is a FULL workspace (the table, the government, the bench,
           the Career), never a panel that fits beside a card: so its zone is a
           LAYER OVER THE WHOLE STAGE — the hero column AND the setup let go IN
           PLACE (one release, neither re-lays out) while the Parliament rises
           out of the rect they occupied, the colony trade's second door's rule
           (the owner, 2026-10-24). The source card is not lost: the crumb names
           it and L3 «Источник» opens it over the step; the price it pays leaves
           the vote's own locked receipt (`[data-parl-vote-receipt-icon]` — the
           card's price as the player sees it there). B lets the hero and the
           setup come back to the very variant the player left — this composer
           never unmounts. Always rendered (empty and inert outside the step), so
           a leaving Parliament always has its zone to dissolve in — at the same
           geometry it stood in. -->
      <div class="con-composer__parlzone" :class="{'con-composer__parlzone--on': parliamentStepOn}"
           data-embed-slot="action-parliament"></div>
      <!-- ── THE HAND STEP — a pick FROM THE HAND (a party's mandatory discard — the Reds; a ledger row's discard —
           TR23's Pluto; a law's card pick) is the hand ALBUM, and the album takes the WHOLE STAGE the way the
           Parliament does (the owner, 2026-10-24: «сброс — это выбор карт с руки, всегда берёт всю сцену, карт может
           быть много»): the hero and the setup let go in place and are parked; the crumb names the card, L3 opens it;
           when the step leaves they come back where they stood (the Reds' payout flies off the plaque's printed icon,
           the ledger resumes its walk). Always rendered, empty and inert outside the step. -->
      <div class="con-composer__handzone" :class="{'con-composer__handzone--on': handStageStepOn}"
           data-embed-slot="action-hand"></div>

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
          <!-- THE TRIGGER CARDS of a merged batch («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»): the card that answered the press
               SURFACES beside the prepared row (a real lite face) and deals its card from its printed draw icon. -->
          <div v-for="face in beatTriggers" :key="'bt' + face.key" class="con-deckdraw__trigger"
               :data-dd-trigger="face.name" :ref="(el) => setBeatTriggerRef(el, face.run)">
            <ConsoleCardFaceLite :name="face.name" />
          </div>
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

<script setup lang="ts">
/*
 * THE ACTION FOCUS STAGE — the in-frame focus state of the Action
 *       Browser (NOT a floating modal): the browse layer yields underneath and
 *       this stage recomposes the SAME frame around the chosen action. Its
 *       identity line (kicker · card name · variant) lives in the frame's
 *       header, owned by ConsoleCardActions.
 *       data-motion-*: the surface-motion contract — no own backdrop (the
 *       action center owns the shared `.con-shade`); the panel is the captured
 *       unit of the AWAITING handoff; the source card is the ANCHOR that FLIPs
 *       into the reveal result's «Источник» slot on the phase handoff.
 *
 * (This comment opened the template; the template starts with its root now.)
 */


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
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {RootElHolder, rootElOf} from '@/client/components/rootEl';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {setConsoleActionComposerCommands, resetConsoleActionComposerUi} from '@/client/console/consoleActionComposerUi';
import {focusCommandRun, FocusRowKind} from '@/client/console/consoleActionFlow';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {ActionPreview, ActionPreviewBranch, ActionEffect, PoliticalActionPreview, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '@/common/models/ActionFutilityModel';
import {gainAtParameterLimit} from '@/client/components/actions/actionEffectReading';
import {DELEGATE_ICON} from '@/common/parliament/ParliamentTypes';
import {delegateGrantFollowUpRow, nextRowText, playCommitVerb, playDoorNextStepKey, playDoorOf, samePreviewShape, variantGroupNav, VariantAxis} from '@/client/console/consolePlayCardComposer';
import {useResizeObserver} from '@vueuse/core';
import {SettledColumn} from '@/client/console/settledColumn';
import {STAGED_STEP_RELEASE_MS, StagedReceipt, stagedPlayState, stagedVoteOf} from '@/client/console/stagedPlay';
import {syncReleaseToStepEntry} from '@/client/console/stepEntryClock';
import {parliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {preloadResolutionArt} from '@/client/console/parliament/parliamentArtTier';
import {DeltaBlockadeInputModel, DeltaStageRewardInputModel, PlayerInputModel, SelectAmountModel, SelectCardModel, SelectPaymentModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ComposerEntry, PoliticalActionEntry, isPoliticalActionEntry} from '@/client/components/actions/actionModel';
import {partyEffectZoomEntry, resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import {bannerCubesOn} from '@/client/console/parliament/consoleParliamentModel';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {ResolutionId} from '@/common/parliament/ParliamentTypes';
import {PartyName} from '@/common/turmoil/PartyName';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {discardExchangeCommitSpecs, discardExchangeRailKey} from '@/client/console/cardDiscard/discardExchangeBeat';
import {armPreselectedDiscard} from '@/client/console/cardDiscard/consoleCardDiscard';
import {preselectedDiscardsOf} from '@/client/console/cardDiscard/preselectedDiscards';
import {flyRailReward, railRewardPending} from '@/client/console/resourceTransfer/railReward';
import {ActionGroup, playerActionGroups} from '@/client/components/actions/actionExtraction';
import {BranchView as PrintedBranchView, branchPositionsForNode, branchSetAvailability, branchTitleText, buildBranchViews, stripNodeOr} from '@/client/components/actions/actionBranchView';
import {ActionRules, ACTION_RULE_LABEL, actionRuleText, actionRules} from '@/client/components/actions/actionDescription';
import {
  ComposerChoice,
  branchChoices,
  composeAndResponse,
  formulaFollowingParts,
  optionPickAsStep,
  perCardTotals,
  preChoices,
  firstMissingChoice,
  spendHeatPlan,
  spendHeatStock,
  spendHeatResponse,
  spendHeatValid,
  orderedPreResponses,
  orderedStepResponses,
  plannedStepResponses,
  planLandingChoice,
  // Aliased: the computed `focusFreeDialId` keeps the name the template reads.
  focusFreeDialId as focusFreeDialIdOf,
  InlineDial,
  // The ONE «may a choice be seeded» rule — shared with the play composer.
  initialVariantSelection,
  // A branch that LEADS somewhere instead of asking for something.
  runtimeNavigationSteps,
  afterConfirmSteps,
  // The step a choice answers (a card-level one too) and the ask of a card pick by its direction.
  stepOfChoice,
  cardPickAskKey,
  cardPickRoleKey, keepPlayAnswers,
  // THE SOLE CANDIDATE (T14 · CC) — a target with ONE enabled candidate is seeded, shown and marked.
  soleCandidateOf, soleMarkKeys, soleSeedPick, soleSeedResponse, soleSeedViewerOf, SoleSeed, SoleSeedViewer,
  // The price every variant shares — printed once, on the price side.
  commonVariantCost,
  // The good every variant buys — printed once, after the price tiles (TR58).
  commonVariantGain,
} from '@/client/console/consoleActionComposer';
import {variablePartsForBranch, ConsoleVariableChip, takeStagedActionComposerDraft, railFocusKeysOf, consoleCardActionsUi} from '@/client/console/consoleCardActions';
import {buildOrItems, orItemResponse, nestedPickHostable, ConsoleOrItem} from '@/client/console/consoleOrChoice';
import {TableTargetStand, isTableTargetStand, tableTargetBotStand, tableTargetCardPick, tableTargetOf} from '@/client/console/played/tableTargetZone';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {DeclineModel, declineIsButton, declineResponse, optionalChoiceOf, optionalPickInputOf} from '@/client/console/optionalChoice';
import {paymentLanes, megacreditsAvailable, paymentCovers, paymentFromCounts, initialCounts, dialLaneCount, buildPaymentView, PaymentView, PaymentSourceRow, editableRows, quickAdjustRow} from '@/client/console/paymentPlan';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import {CountedWhy, countedWhyOf, discountWhyOf} from '@/client/console/countedPlay';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
import {branchesArePalette, variantDestinationsOf, heroOfEffect, paletteOf, sharedVariantDestinations, VariantChoiceOption, VariantHero, VariantSharedResult} from '@/client/console/variantChoiceModel';
import {armPostCommitWitness, HonestFollowUp} from '@/client/console/preselectWitness';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {EffectForecast, forecastSourceIsCardless} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {
  ForecastBranchInfo, VariantReaction, forecastForFixedBranch, forecastLayerAvailable, forecastRowPresent, variantReactionChips,
} from '@/client/console/effectForecastModel';
import {
  closeEffectForecastLayer, effectForecastOpen, forecastExplorerUi, openEffectForecastLayer,
} from '@/client/console/consoleEffectForecast';
import {
  armForecastRow, armForecastInstantFold,
  // The composer ⇄ «Эффекты» layer transition hooks (the descend phrase) — the template's `<transition>` binds them.
  forecastFocusEnterHook, forecastFocusLeaveHook, forecastFocusEnterCancelledHook, forecastFocusLeaveCancelledHook,
} from '@/client/console/consoleForecastFocusMotion';
import {effectStatsFor, ensureEffectStats} from '@/client/console/effectStatsStore';
import {descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {markWorkspaceOutcomeArrivalDone, markWorkspaceOutcomeArrivalFlown, markWorkspaceOutcomeBeatDone, rearmWorkspaceOutcomeBeat, retractWorkspaceOutcomeSlot, setWorkspaceOutcomeSlot, workspaceClaimOwnsArrival, workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {requestDiscardStream} from '@/client/console/deckDraw/consoleDeckDraw';
import {setWorkspaceFrameSlot, setWorkspaceFrameSourceCard, workspaceFrameHost, workspaceFrameKnown, workspaceStackRootKind} from '@/client/console/consoleWorkspaceStack';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {ActionCommitSource, actionCommitState, armActionCommit, capsuleTimelineReading, commitKindForBranch, commitRailPlan, commitRewardSpecs, commitWaveSpecs, markActionCommitSettled} from '@/client/console/consoleActionCommit';
import {actionCommitRailHoldsCapsule, actionCommitRailState} from '@/client/console/consoleActionCommitRail';
import {reactionRailSpecs} from '@/client/console/colonyTrade/fleetDockModel';
import {ActionCommitMotionHandle, COMMIT_HANDOFF_AT_MS, centreEndOf, pulseDeckPile, resolveActionCommitAnchors, resolveGainIconEnds, resolveResultIcon, resolveSpendIconEnds, runActionCommitMotion} from '@/client/console/consoleActionCommitMotion';
import {consoleMotionMs, consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import ConsoleColonyLedger from '@/client/components/console/parliament/ConsoleColonyLedger.vue';
import {cardColonyLedgerOf, COLONY_LEDGER_KICKER, ColonyLedgerReading} from '@/client/console/parliament/colonyLedgerModel';
import {AllColonyBonusesModel} from '@/common/models/ColonyBonusLedgerModel';
import {flyLedgerRows, LEDGER_READ_MS, LEDGER_ROW_GAP_MS} from '@/client/console/colonyLedger/colonyLedgerWave';
import {
  colonyBonusPayout, colonyBonusPayoutOf, finishColonyBonusPayout, markPayoutRowLanded, nextPayoutRow, PayoutFacts,
  PayoutRow, payoutRowSettled, payoutServerOwes, payoutUntaken,
} from '@/client/console/colonyLedger/colonyBonusPayout';
import {heldCardCapsule, releasePanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {choiceSourceView} from '@/client/console/promptSource';
import type {ICardRenderEffect, ItemType} from '@/common/cards/render/Types';
import {adoptDeckSeed, holdDeckDisplay, isDeckDisplayHeld, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {currentRevealEvent, DrawnCardEntry} from '@/client/components/drawnCards/drawnCardsState';
import {armOutcomeOrigin, playConfigRelease, playOutcomeContent, playOutcomePhase, resetOutcomeOrigin} from '@/client/console/consoleActionOutcomeMotion';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {TradeColonyContext, findTradeColonyContext} from '@/client/console/turnIntents';
import {lockedTradePaymentIndex, lockedTradePaymentReason} from '@/client/console/colonyTrade/colonyTradeEntry';
import type {DeltaAdvanceOffer} from '@/common/models/DeltaBonusPromptModel';
import {reasonParams} from '@/client/cards/tagLabel';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {isBoilerplateTitle} from '@/client/console/consoleTaskSummary';
// The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face).
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {holderGainOutcome, holderGainOutcomeReading, holderLossOutcome, holderLossOutcomeReading, holderRoleIcons, holderRoleOf} from '@/client/console/holderRoles';
import {readingLineText} from '@/client/console/readingText';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import {targetImpactRows, targetImpactText, targetImpactIsLoss} from '@/client/components/modalInputs/targetImpactRows';
import {RATING_RAIL_KEY, cardResourceKey, isStandardResource} from '@/client/console/resourceTransfer/resourceTransferModel';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {divertedTileWarnings} from '@/client/components/actions/divertedTileWarning';
import {$t, translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {armPayloadCarry, armPayloadReturn, playPayloadCarry, playPayloadReturn} from '@/client/console/played/payloadCarry';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {runActionRevealFlight, runRevealGainFlight, ActionRevealFlightHandle, RevealGainFlightHandle} from '@/client/console/consoleActionRevealMotion';
import {BatchArrivalHandle, runBatchArrival, settleBatchProxiesOnto} from '@/client/console/consoleBatchArrivalMotion';
import {intakeAssemblyOwnsBatch} from '@/client/console/cardIntake/intakeAssemblyPlan';
import {IntakeTriggerFace, planAssemblyFor} from '@/client/console/cardIntake/intakeAssemblyDirector';

// The merged batch's assembly in flight is module state (one handle per page) — it lives beside the component.
import {composerAssemblyInFlight, killComposerAssembly, playComposerAssembly} from '@/client/components/console/consoleActionComposerState';
import {probeTick} from '@/client/console/probeTick';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {motionAfter} from '@/client/console/session/sessionWaits';
import {resolveCardArrivalMode} from '@/client/console/consoleCardArrival';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';
import ConsoleVenusBonusRow from '@/client/components/console/foundation/ConsoleVenusBonusRow.vue';
import ConsoleVenusBonusStep, {VenusBonusStepApi} from '@/client/components/console/foundation/ConsoleVenusBonusStep.vue';
import ConsoleWildChoiceStep from '@/client/components/console/foundation/ConsoleWildChoiceStep.vue';
import {WildChoiceSpec, WildFocus, WildParts, wildBar, wildClamp, wildComplete, wildFootHints, wildNav, wildOpen, wildPress} from '@/client/console/wildChoice/wildChoiceInner';
import {
  WildBranchPlan, WildDialPlan, WildRowAnswer, wildBranchPlan, wildCandidates, wildCardPick, wildComposerSpec, wildDialAmount,
  wildDialAnswer, wildDialParts, wildDialPlan, wildDialSpec, wildPartsFrom, wildPosOf, wildRowAnswer, withDialCommitEffects,
  WildStepPlan, wildStepAnswer, wildStepIncluded, wildStepParts, wildStepPlans, wildStepSpec, withWildStepCommitEffects,
} from '@/client/console/wildChoice/wildChoiceComposer';
import {
  VENUS_SPREAD_LANES, VenusBonusParts, venusBonusMetaOf, venusPreselectArm, venusPreselectResponse, venusWhenHolds,
} from '@/client/console/venusBonus/venusBonusPreselect';
import {
  VenusInnerFocus, venusInnerBar, venusInnerClamp, venusInnerFootHints, venusInnerNav, venusInnerOpen, venusInnerPress, venusInnerStageKey,
} from '@/client/console/venusBonus/venusBonusInner';
import {armVenusBonusCell} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {amountOperationVm, ConversionPromptVm} from '@/client/console/conversionPromptModel';
import ConsoleRevealVerdict from '@/client/components/console/foundation/ConsoleRevealVerdict.vue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';
import {REVEAL_POOL_EMPTY_WARNING, RevealPreviewReading, revealCheckGlyph, revealPreviewReading} from '@/client/console/revealReading';
import {runRevealHandoff} from '@/client/console/revealHandoff';
import {isSurfaceAwaitingHandoff} from '@/client/console/surfaceMotion/surfaceMotionState';
import {enterConsoleHandPick, isHandCardSelection, isCardSelectionWithin} from '@/client/console/consoleHandPick';
import {orOptionDoor} from '@/client/console/handPickRouting';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {ConsolePlayPickResult, enterConsolePlayPick, lawPlayDraftOf, lawPlayLandingOf, lawPlayStagedDoor, rememberLawPlay} from '@/client/console/consolePlayPick';
import {playedHeroHoldsCapsule, playedHeroLandingPrewarm, playedHeroLandingUp, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {LAW_PLAY_OUTCOME_ZONE, beginPlayLandingRelease, lawPlayOutcomeLive, markPlayLandingReleased, playLandingYieldedToOutcome} from '@/client/console/played/consolePlayOutcomeClaim';
import ConsolePlayedReceivingStage from '@/client/components/console/played/ConsolePlayedReceivingStage.vue';
import {EASING_KEYS} from '@/client/console/requirementEasingText';
import type {SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {
  DeltaRewardDraft, deltaRewardCommitSpecs, deltaRewardDraftOf, deltaRewardPreviewView,
  deltaRewardStepResponse, enterDeltaRewardPick,
} from '@/client/console/hydroFlow/deltaRewardEntry';
import {deltaAdvancePlanDraftOf, deltaAdvancePlanResponse} from '@/client/console/hydroFlow/deltaAdvanceEntry';
import {deltaBlockadeResponseOf, deltaBlockadeStepResponse, enterDeltaBlockadePick} from '@/client/console/hydroFlow/deltaBlockadeEntry';
import {HYDRO_STAGES} from '@/client/components/hydronetwork/hydroStages';
import type {HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import ConsoleHydroGains from '@/client/components/console/hydroFlow/ConsoleHydroGains.vue';
import {getCard} from '@/client/cards/ClientCardManifest';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsolePlayedTargetLink from '@/client/components/console/played/ConsolePlayedTargetLink.vue';
import ConsoleComposerTargetRow from '@/client/components/console/played/ConsoleComposerTargetRow.vue';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, findPlayedTargetFocus, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia, stepPlayedTargetOwner, playedTargetAt,
  playedTargetResultOf, playedTargetResultLive, playedTargetReadingImpacts,
  PLAYED_TARGET_SUMMARY_IMPACT_CAP,
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetNavDir, PlayedTargetCell,
  PlayedTargetResult, PlayedTargetQuickImpact, PlayedTargetSelection,
  togglePlayedTargetPick, playedTargetPicksValid, prunePlayedTargetPicks, playedTargetShortfalls, playedTargetPayloadOf,
  playedTargetTagOfPreview, PlayedTargetPayload, PlayedTargetTag,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {
  computeCommitGate, commitAllowed, commitAcceptsCursor,
  commitRedirectTarget, CommitGate, CommitRequirement, CursorLanding, nextCursorAfterAnswer,
} from '@/client/console/consoleCommitGate';
import {arriveAtCommit, commitArrivalAbsorbs, createCommitArrival, endCommitBreath, leaveCommit} from '@/client/console/commitArrival';
import {gateCursorDuringEntry} from '@/client/console/cursorArrival';
import {vEmbedZone, vI18n, vStripActionPrefix} from '@/client/directives/vDirectives';
import {useAppRoot} from '@/client/components/appRoot';

// (An exported type stands with the imports, above the script's first statement: the body of a Vapor script-setup block
// is a function body to the type checker, and an `export` below a statement is not at a module's top level there.)
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
   * COMMITTED, and the press owes a STEP that is not a card (P89 · ledger EE — the alternative Venus board's bonus):
   * the zone stands for the shell's re-homed surface and shows no card beat of its own. A claim of that kind opens
   * THIS stage, never the draw-only `pending` one — the claim and the stage that presents it are decided together
   * (the R&D Funding freeze of 2026-10-31).
   */
  | {kind: 'step'}
  /**
   * The action produced CARDS and the zone is showing them. Deliberately one
   * kind for both a drawn batch and a follow-up pick (buy / keep-some): from
   * the stage's side they are the same phase — the same zone, the same name,
   * the same input gate — and which presenter the shell re-homed into it is
   * the shell's business, not a second state for the workspace to track.
   */
  | {kind: 'draw'}
  /**
   * «THE LEDGER PAYS» (TR23 Habitat Science — «gain all your colony bonuses»):
   * the action is committed and its ledger pays row by row. The ONE outcome
   * that does not replace the decision column: the configuration surface
   * stays (its ledger is the very DOM the player read before the press) and
   * the steps of the payout stand as layers above it.
   */
  | {kind: 'ledger'}
  /**
   * A CARD PLAYED THROUGH A LAW (RX36 Live Experiments): the card has landed in this stage (the receiving tableau,
   * PL-726) and what it SETS OFF — its draw, its keep-some pick, a woken card's question, a repeated action's
   * verdict — is the stage's next beat. Like the ledger it does not swap the decision column: the outcome stands as a
   * LAYER over the tableau (`[data-embed-slot="law-outcome"]`), which dissolves the moment the outcome takes the
   * stage — the hand composer's own handoff, read through the same play-landing facts.
   */
  | {kind: 'law-play'};

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

/**
 * The room the body's `safe center` leaves above its block, as the padding that keeps the block there once the body is
 * top-aligned ('' — nothing to pin). Layout offsets, never rects: the press can land inside the surface's unfold
 * transform, and the pin must be the block's place in the layout, not in that frame's paint.
 */
function bodyBlockPin(body: HTMLElement | undefined): string {
  const first = body?.firstElementChild as HTMLElement | null | undefined;
  if (body === undefined || first === null || first === undefined || typeof getComputedStyle !== 'function') {
    return '';
  }
  const cs = getComputedStyle(body);
  const padTop = parseFloat(cs.paddingTop) || 0;
  const marginTop = parseFloat(getComputedStyle(first).marginTop) || 0;
  // A positioned body IS the child's offsetParent (offsets from its padding edge); otherwise both share one, and the
  // body's own border sits between its box and its content.
  const fromContent = first.offsetParent === body ?
    first.offsetTop :
    first.offsetTop - body.offsetTop - (parseFloat(cs.borderTopWidth) || 0);
  const offset = fromContent - padTop - marginTop;
  return `${padTop + Math.max(0, offset)}px`;
}

type GroupNode = ActionGroup['nodes'][number];

/** A `wild` item with a `step` is a STANDALONE «?» row (P50 · FC — a spend or a gain), one per step; without it the P43 pair / the P49 dial. */
type Item = {id: string, kind: 'branch', pos: number} | {id: string, kind: 'choice', choice: ComposerChoice} | {id: string, kind: 'wild', step?: number};

/** The wild-resource choice's two «still open» reasons (P43 · EO) — its own words. */
const WILD_BLOCK_KEYS = {chooseWild: 'Choose: on a card or a standard resource', chooseCard: 'Choose a card'};

/** Several cards answered in the hand album for one `or` option, kept as ONE `orDescents` pick. */
const NESTED_PICK_SEP = '|';
type SubState =
  | {kind: 'list', choiceId: string, index: number}
  /**
   * ONE LEVEL DEEPER INSIDE AN OR-PICK — the chosen branch is not a leaf option
   * but an INPUT of its own (a `SelectCard` / `SelectPlayer` sitting directly in
   * the `OrOptions`), so answering it is a second, nested pick whose value nests
   * into `{type:'or', index, response:<nested>}`.
   *
   * Until it existed the row was rendered DISABLED with «недоступно на этом
   * экране»: the server offered a target and the screen refused to reach it.
   * «Хищники» against a MarsBot is exactly that shape — [«выберите карту»,
   * «удалить 1 Животное у Бот»] — so the card's whole point (take the animal
   * from an OPPONENT) was unreachable while the bot row stayed pickable.
   */
  | {kind: 'orNested', choiceId: string, item: ConsoleOrItem, index: number}
  | {kind: 'payment', choiceId: string, index: number}
  /**
   * The EMBEDDED played-card target step — the same component and the same
   * grammar the card-play workspace uses. It replaced the hand-off to the
   * «Разыграно» view's pick mode, which took the player OUT of the action
   * workspace to point at a card and gave them a full tableau to do it in.
   */
  | {kind: 'playedTarget', choiceId: string, focus: PlayedTargetFocus, picked: ReadonlyArray<string>,
     /** The step is answering an OR-BRANCH (`orItem`), not the choice itself —
      *  the pick nests into that branch's or-response. Pointing at a card must
      *  feel the same whether or not a bot row sits above it in the list. */
     orItem?: ConsoleOrItem}
  /** THE VENUS BONUS'S INNER STEP (P89 · EM) — the 30 % wild, its card and the 2 × 3 standard grid (`venusBonusInner.ts`). */
  | {kind: 'venus', choiceId: string, focus: VenusInnerFocus}
  /** THE WILD-RESOURCE CHOICE (P43 · EN / EO) — the printed «?» row's inner step (`wildChoiceInner.ts`, exclusive). */
  | {kind: 'wild', choiceId: string, focus: WildFocus};

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
  /** This row opens a pick of its own (a nested-input or-branch) — it is a
   *  door, not an answer, so it draws the descent chevron. */
  nested?: boolean,
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

/** A card pick the server marks a DISCARD (`discardPrompt` — structural, never the title). */
function isDiscardPick(input: PlayerInputModel | undefined): boolean {
  return input?.type === 'card' && (input as SelectCardModel).discardPrompt !== undefined;
}

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

/** The law's landed tableau dissolving under its card's outcome (RX36) — the hand composer's release beat. */
const LAW_PLAYSTAGE_RELEASE_MS = 220;

/** How long the release waits for its step to be inserted before it keeps its own clock (a mount, never a motion). */
const STEP_ENTRY_BIND_MAX_MS = 4000;

/** Where the action composer's ledger stands — the scope the shared wave looks its rows up under. */
const CARD_LEDGER_SCOPE = '[data-colony-ledger-scope="card"]';

/** A walk that has not moved for this long while the SERVER owes it nothing is ended, named (the stall net). */
const LEDGER_STALL_MS = 9000;

/** How long a SEARCH's draw beat waits for the server to say which cards it threw away (PL-261) — past it the find
 *  flies as before and the pile reads the server's count through the reveal. */
const BEAT_SEARCH_ANSWER_NET_MS = 2500;

/**
 * A STAGED ACTION VOTE's locked receipt — what the commit charges for the card: the branch's own COST chip on the
 * card (TR15: «3 data from here»), never the delegate leaving the reserve (that is the vote's, not the card's
 * price). Undefined when the branch costs nothing of its own.
 */
function stagedVoteReceiptOf(branch: ActionPreviewBranch): StagedReceipt | undefined {
  const cost = branch.effects.find((e) => e.direction === 'cost' && e.icon !== DELEGATE_ICON);
  return cost === undefined ? undefined : {amount: cost.amount, icon: cost.icon};
}

/** The draw / ledger outcome zone this composer publishes (the shell's reveal re-homes into it). */
const WORKSPACE_REVEAL_ZONE = '[data-embed-slot="workspace-reveal"]';

defineOptions({name: 'ConsoleActionComposer'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /** A card's action, or a POLITICAL source's (a party / the enacted law — Turmoil Redux «один фреймворк»). */
  entry: {type: Object as PropType<ComposerEntry>, required: true},
  preview: {type: Object as PropType<ActionPreview | PoliticalActionPreview | undefined>, default: undefined},
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
});
const emit = defineEmits(['confirm', 'committing', 'staged-placement', 'staged-vote', 'staged-law-play', 'colony-trade', 'delta-advance', 'cancel', 'inspect-source', 'reveal-ack', 'commands', 'ledger-done']);

const root = useAppRoot();
const flow = useFlowScope('action-composer');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const forecastExplorer = useTemplateRef<ExposedOf<typeof ConsoleEffectsExplorer>>('forecastExplorer');
const targetStep = useTemplateRef<{rootEl?: HTMLElement | null, payloadEl?: () => HTMLElement | undefined} & {scrollBy?: (d: number) => void} & {cells?: () => ReadonlyArray<PlayedTargetCell>} & {ensureFocusVisible?: () => void}>('targetStep');
const scroll = useTemplateRef<{scrollByPx?: (d: number) => void} & {ensureVisible?: (el: Element | null | undefined) => void}>('scroll');
const venusStep = useTemplateRef<VenusBonusStepApi>('venusStep');
const wildTargetStep = useTemplateRef<{cells?: () => ReadonlyArray<PlayedTargetCell>, ensureFocusVisible?: () => void}>('wildTargetStep');
const surfaceEl = useTemplateRef<HTMLElement>('surfaceEl');
const bodyEl = useTemplateRef<HTMLElement>('bodyEl');
const revealProxy = useTemplateRef<HTMLElement>('revealProxy');
const revealFlip = useTemplateRef<HTMLElement>('revealFlip');
const revealSlot = useTemplateRef<HTMLElement>('revealSlot');
const gainFly = useTemplateRef<HTMLElement>('gainFly');
const beatRow = useTemplateRef<HTMLElement>('beatRow');
const batchProxies = useTemplateRef('batchProxies');
const batchFlips = useTemplateRef('batchFlips');
const beatSlots = useTemplateRef('beatSlots');
const verdictSlot = useTemplateRef<HTMLElement>('verdictSlot');
const focusedEl = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedEl');
const branchesEl = useTemplateRef<RootElHolder | HTMLElement>('branchesEl');
const actRight = useTemplateRef<HTMLElement>('actRight');
const lawPlaystage = useTemplateRef<HTMLElement>('lawPlaystage');
/** The decision column that stops re-centring once the player presses (`settledColumn.ts`). */
const settled = ref<SettledColumn | undefined>(undefined);
/** THE COMMIT ARRIVES (T14 · CC, `commitArrival.ts`) — the arrival the ONE cursor rule makes on the commit row. */
const commitArrival = ref(createCommitArrival('action composer'));
/** The rows the composer SEEDED with their sole candidate (`soleCandidateOf`) — answered, shown, marked. */
const seeded = ref<Record<string, 'sole'>>({});
/** The open re-seated a STAGED snapshot (B from the board): the player's own focus stands, the rule waits. */
const stagedRestored = ref(false);
/**
 * The variant group's live AXIS, measured off the rendered tiles (all at one `offsetTop` ⇒ a row, ←→ switch
 * them; stacked ⇒ a column, the ordinary ↑↓ walk) — never a duplicated breakpoint.
 */
const branchAxis = ref('row' as VariantAxis);
/** The palette's row of each tile (`grid` only), in `branchNavIndices` order. */
const branchGridRows = ref<Array<number>>([]);
/** The variant tile the cursor last stood on — ↑ from the row below re-enters the group there. */
const branchReturnIdx = ref(-1);
let stopBranchObs: (() => void) | undefined;
/** The hero face's layout height (px) — the setup sheet's floor (P73 · DC); 0 until measured. */
const heroFaceHeight = ref(0);
let stopHeroFaceObs: (() => void) | undefined;
/** The «Сработает» row's one-shot COMMIT pulse (the descend's first beat). */
const forecastPulse = ref(false);
/** The forecast explorer's own cursors (never the Information workspace's). */
const forecastUi = ref(forecastExplorerUi('action'));
const selectedPos = ref<number | undefined>(undefined);
const capturedPre = ref<Record<number, unknown>>({});
const capturedOption = ref<unknown>(undefined);
/** A TWO-PART option's answered parts, by part index — `capturedOption` is their composed `and` once all stand. */
const capturedOptionParts = ref<Record<number, unknown>>({});
/** The pre-selected Venus bonus per step index — its two parts — and each spread's lane cursor (P89 · EL). */
const venusParts = ref<Record<number, VenusBonusParts>>({});
/** A LAW's card landing in this stage rose (RX36): the receiving stage stays standing to the workspace's leave. */
const lawLandingLatched = ref(false);
const captured = ref<Record<number, unknown>>({});
/** The live ACTION COMMIT episode (killed on unmount / rollback). */
let commitHandle: ActionCommitMotionHandle | undefined;
/** The draw beat's commit-handoff delay — its cancel (called on abort; the composer's scope takes it back on unmount). */
let beatDelayTimer: (() => void) | undefined;
/** A SEARCH's beat waiting for the server's answer — its bounded net's cancel (PL-261; cleared with the delay). */
let beatAnswerNet: (() => void) | undefined;
/** The net fired: the beat goes on without the answer (the find as before). Reset with the delay. */
const beatSearchNetSpent = ref(false);
/** The composed repeat-action pick (Viron): the chosen already-used
 *  action + its own composed responses. Filled by `consoleRepeatPick`;
 *  the confirm carries it as `repeat` (NOT a plain step response). */
const repeatResult = ref<ConsoleRepeatPickResult | undefined>(undefined);
/** The composed stage-reward claim (Dutch Mountains): the FULL draft —
 *  its wire response is the ordinary captured step, but the composed
 *  repeat inside it cannot be read back off the wire, so the claim /
 *  commit-wave derivations keep the draft beside the capture. */
const stageRewardDraft = ref<DeltaRewardDraft | undefined>(undefined);
const amounts = ref<Record<string, number>>({});
const floaters = ref<Record<string, number>>({});
const payCounts = ref<Record<string, Partial<Record<SpendableResource, number>>>>({});
/** Re-keyed PER PAYMENT CHOICE on each adjust so the dialed row's one-shot
 *  pulse replays — a single shared counter flashed every mounted panel. */
const payFlash = ref<Record<string, number>>({});
const picks = ref<Record<string, string>>({});
/** Multi-select hand picks by choice id (display; the capture is the truth). */
const multiPicks = ref<Record<string, ReadonlyArray<string>>>({});
/** An or-choice ANSWERED through a nested branch: the branch that was
 *  descended into + the value picked inside it (a card name / a player
 *  colour). `picks` holds the option INDEX, which alone can only name the
 *  question («выберите карту…»); this is what makes the collapsed row say
 *  WHICH card, and what tells the embedded target step which input it is
 *  still serving after it closed. */
const orDescents = ref<Record<string, {item: ConsoleOrItem, pick: string}>>({});
const focusIdx = ref(0);
/** Bumped when a refused commit redirects — the blocking row pulses once. */
const blockFlashNonce = ref(0);
const sub = ref<SubState | undefined>(undefined);
/** The rich answered targets by choice id — identity, origin and the
 *  preview snapshot the summary renders. The capture stays the truth. */
const playedTargetResults = ref<Record<string, PlayedTargetResult>>({});
/** Per-owner cursor memory for the tabbed mode. */
const playedTargetOwnerFocus = ref<Record<string, number>>({});
/** The step's measured band — width from the work column, height from the
 *  STRETCHED row (`.con-composer__actmain`). Never from anything the
 *  cards themselves size, or the budget would be a function of its own
 *  answer (that inverted the card size for a single candidate once). */
const playedTargetWidth = ref(0);
const playedTargetHeight = ref(0);
/** The cursor of the target selector inside the wild step's «на карту» slot (P43). */
const wildTargetFocusRaw = ref<PlayedTargetFocus | undefined>(undefined);
const submitting = ref(false);
/**
 * THE ACTION WAS SENT — past the commit boundary for real. `submitting` alone cannot say it: a staged board
 * placement locks the CTA too and sends NOTHING (the board's cell is the one submit, B walks back here). Raised
 * at the press that hands the batch to the server, it falls with `submitting` (a refusal, a fresh view the
 * transport no longer awaits) — and the host's crumb reads it: «… › ВЫПОЛНЕНИЕ», amber past the commit (PL-062).
 */
const commitSent = ref(false);
/** THE LEDGER as the player read it at the press — frozen, so the paying rows can never re-order under a refetched preview. */
const ledgerFrozen = ref<AllColonyBonusesModel | undefined>(undefined);
/** The surface's height AT THE PRESS (its own used value) — the box the paying ledger keeps ('' — not pinned). */
const ledgerSurfaceHeight = ref('');
/** The body's block offset AT THE PRESS (the room `safe center` left above it, as a padding) — '' — not pinned. */
const ledgerBodyPin = ref('');
/** This stage MOUNTED into a payout already running (a restored park): the decisions the press carried are not
 *  this instance's to show — its rows are put away, the ledger and the dock speak. */
const ledgerResumed = ref(false);
/** The walk's clocks — on GSAP's own time (the row gap, the stall net), each the CANCEL of a beat owned by the
 *  composer's scope (taken back on unmount). The ledger's one READ is a beat of the same scope that nothing ever
 *  cancels by hand, so its cancel is not kept. */
let ledgerGap: (() => void) | undefined;
let ledgerStall: (() => void) | undefined;
/** The setup column is PARKED under a hosted Parliament step (released in place, hidden — never unmounted). */
const parliamentSetupParked = ref(false);
/** The release / return fades of the setup column (cancelled by the opposite edge). */
let parliamentSetupFades: Array<Animation> = [];
/** The running release's identity — a later edge (B, the end) voids a release still waiting for the rise. */
const parliamentReleaseToken = ref(0);
/**
 * THE CARD'S RESOURCE COUNT AS THE PLAYER PRESSED A (a staged action vote — TR15's data, TR34's mechs: whatever
 * the card stores): the hero's capsule reads it until the cube LIFTS OFF the reserve — the price is paid with
 * the delegate, so the count drops on that motion, never on the packet. Undefined outside such a commit.
 */
const stagedVoteCapsuleHeld = ref<number | undefined>(undefined);
/** A staged action vote of THIS card has been confirmed in the Parliament (its step leaves with the workspace). */
const stagedVoteSent = ref(false);
/** The reveal phase's visual stage: face down → face first shown
 *  (mid-flip; the status yields to the outcome) → settled (the REAL
 *  card owns the slot). */
const revealStage = ref('pending' as 'pending' | 'face' | 'settled');
/** The deck-flight proxy layer is mounted. */
const revealFlightOn = ref(false);
/** The EXECUTION BEAT's own deck flight (face-down until the answer). */
const beatFlightOn = ref(false);
let beatHandle: BatchArrivalHandle | undefined;
/** The beat proxies touched down (a still-silent server now shows loading). */
const beatLanded = ref(false);
/**
 * THE BATCH — one entry per card that is physically coming off the deck,
 * FROZEN at launch. `''` is an honest unknown face (the card is on its
 * way, the server has not named it yet); the answer fills the entries in
 * place, so the very same objects open. Its LENGTH is the batch size and
 * never changes once the flight has begun — that invariant is what makes
 * «one card arrived and then multiplied» unrepresentable.
 */
const beatFaces = ref<Array<string>>([]);
/** The prepared stage's solved geometry (published onto the row). */
const beatRowStyle = ref<Record<string, string>>({});
/** Bounded re-measure attempts while the stage is still laying out. */
const beatFitRetries = ref(0);
/** The surface took the zone while cards were still opening — hand over
 *  the moment the arrival settles (never cut a turn mid-way). */
const beatHandoffPending = ref(false);
/** The assembly scene's trigger faces (one per `card`-origin run of a MERGED batch) and their elements. */
const beatTriggers = ref<Array<IntakeTriggerFace>>([]);
const beatTriggerRefs = ref<Record<number, HTMLElement | null>>({});
/** The live flight handle (payload release + abort). */
let revealHandle: ActionRevealFlightHandle | undefined;
/** The stored-resource count CAPTURED when the reveal phase opened —
 *  the live tableau already carries the reward when the answer lands,
 *  so the counters hold the BEFORE value until the gain beat plays
 *  (the increment must be SEEN, never leaked early). */
const revealResBaseline = ref<number | undefined>(undefined);
/** The gain beat delivered — the counters show the live value. */
const revealGainApplied = ref(false);
/** The flying reward icon (revealed card → the source counter). */
const revealGainFlying = ref(false);
let revealGainHandle: RevealGainFlightHandle | undefined;
/** One-shot pop on the counter + the «на этой карте» chip. */
const revealGainPop = ref(false);
let revealGainPopTimer: (() => void) | undefined;
/** «OK» was pressed and the revealed card is being handed over (the
 *  workspace concludes on the handoff's own seam) — further presses are
 *  swallowed, so one verdict can never hand its card over twice. */
const revealHandingOff = ref(false);

/** The viewer's stock per standard resource — the Venus spread's «current → resulting» (P89 · EL). */
const venusStock = computed((): Partial<Record<string, number>> => {
  return Object.fromEntries(VENUS_SPREAD_LANES.map((key) => [key, playerResourceValue(thisPlayer.value, key, 'stock') ?? 0]));
});
const thisPlayer = computed(() => {
  return props.playerView.thisPlayer;
});
/** Who a lone target would be «yourself» for — an attack on yourself is never seeded (`soleCandidateOf`). */
const soleViewer = computed((): SoleSeedViewer => {
  return soleSeedViewerOf(thisPlayer.value);
});
// ── THE EFFECT FORECAST (rides inside the action preview) ───────────
const forecast = computed((): EffectForecast | undefined => {
  const forecast = props.preview?.forecast;
  // A variant FIXED at entry (one option of several, no branch row): that option IS this operation,
  // so its reactions join the «Сработает» row and the layer instead of «depends on your choice».
  return branches.value.length > 1 && positions.value.length === 1 ? forecastForFixedBranch(forecast, positions.value[0]) : forecast;
});
const forecastRowShown = computed((): boolean => {
  return forecastRowPresent(forecast.value);
});
const forecastAvailable = computed((): boolean => {
  return forecastLayerAvailable(forecast.value);
});
/** R3 is the SETUP level's verb — silent in a pick, the payment editor,
 *  past the commit (the outcome / reveal / draw phases) and in the nested
 *  repeat-pick instance (the OWNER composer publishes; a guest does not). */
const forecastCanOpen = computed((): boolean => {
  return forecastAvailable.value && props.publishCommands && sub.value === undefined && !submitting.value &&
    props.outcome === undefined && !drawOutcomeOn.value && !deckCheckOn.value;
});
const fxOpen = computed((): boolean => {
  return props.publishCommands && effectForecastOpen('action');
});
const forecastBranches = computed((): ReadonlyArray<ForecastBranchInfo> => {
  if (!needBranchRow.value) {
    return [];
  }
  return positions.value
    .filter((pos) => branches.value[pos] !== undefined)
    .map((pos) => ({pos, title: branches.value[pos].title, available: branches.value[pos].available}));
});
const forecastOrderFlags = computed((): {cardChoices: boolean, placesTile: boolean} => {
  return {
    cardChoices: hasDecisions.value,
    placesTile: selectedBranch.value?.steps.some((s) => s.kind === 'boardPlacement') === true,
  };
});
const forecastStatsByColor = computed((): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> => {
  const out: Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> = {};
  for (const color of forecastOwnerColors.value) {
    out[color] = effectStatsFor(color as Color);
  }
  return out;
});
const forecastOwnerColors = computed((): ReadonlyArray<string> => {
  const f = forecast.value;
  if (f === undefined) {
    return [];
  }
  const bots = new Set(props.playerView.players.filter((p) => p.isMarsBot === true).map((p) => p.color));
  const colors = new Set<string>();
  for (const fact of [...f.facts, ...Object.values(f.byBranch ?? {}).flat()]) {
    if (!forecastSourceIsCardless(fact.source) && fact.source.kind !== 'automa-corporation' && !bots.has(fact.source.owner)) {
      colors.add(fact.source.owner);
    }
  }
  return [...colors];
});
/** Card names in the player's hand — a pick whose every candidate is a
 *  hand card routes to the hand section's pick mode. */
const handNamesSet = computed((): ReadonlySet<string> => {
  return new Set(props.playerView.cardsInHand.map((c) => c.name));
});
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
const playedNamesSet = computed((): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const player of props.playerView.players) {
    for (const c of player.tableau) {
      names.add(c.name);
    }
  }
  return names;
});
/** The embedded selector holds the surface right now. */
const playedTargetStepOpen = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetModel.value !== undefined;
});
/**
 * THE STEP'S CARDS, WARMED WHILE THE CURSOR STANDS ON ITS ROW (PL-473): the step draws its candidates at the FULL
 * art tier (the row's strip draws thumbs), and decoding them in the press's own frames was the «empty glass» —
 * ≈ 180 ms of a 4K step painted without its cards. The names of the row's candidates while the cursor is on it.
 */
const targetWarmNames = computed((): string => {
  const item = focusedItem.value;
  const choice = item?.kind === 'choice' ? item.choice : undefined;
  if (choice === undefined || sub.value !== undefined || choice.id !== playedTargetChoice.value?.id) {
    return '';
  }
  return (playedTargetModel.value?.owners ?? []).flatMap((o) => o.candidates.map((c) => c.cardName)).join('|');
});
/** The choice the open (or pending) played-target step serves. */
const playedTargetChoice = computed((): ComposerChoice | undefined => {
  const id = sub.value?.kind === 'playedTarget' ? sub.value.choiceId : playedTargetRowId.value;
  return id === undefined ? undefined : allChoices.value.find((c: ComposerChoice) => c.id === id);
});
/** The FIRST decision row this step owns — used to render its summary and
 *  to warm the model before the player presses A. (The CHOICE id, never the
 *  row's own key: the two are different vocabularies.) */
const playedTargetRowId = computed((): string | undefined => {
  return allChoices.value.find((c: ComposerChoice) =>
    isPlayedTargetChoice(c) ||
    // …or an OR-choice whose nested branch was answered in that same step:
    // the row it fills is the same row, so it earns the same summary
    // (thumbnail + owner + impacts) instead of a bare option title.
    (orDescents.value[c.id] !== undefined && playedTargetResults.value[c.id] !== undefined))?.id;
});
/**
 * THE INPUT THE EMBEDDED STEP IS ACTUALLY SERVING — a choice's own
 * `SelectCard`, or the `SelectCard` NESTED in the or-branch the player
 * descended into (open now, or answered earlier). Everything that reads the
 * step's candidates goes through here, so a nested descent can never render
 * one set of cards and validate against another.
 */
const playedTargetInput = computed((): SelectCardModel | undefined => {
  const choice = playedTargetChoice.value;
  return choice === undefined ? undefined : playedTargetInputFor(choice);
});
/**
 * THE EMBEDDED SELECTOR'S MODEL — built only while the step is open (or
 * warmed for the answered row), so an action with no played-card choice
 * never pays for it. Eligibility is the SERVER's candidate set, verbatim.
 */
const playedTargetModel = computed((): PlayedTargetModel | undefined => {
  const choice = playedTargetChoice.value;
  return choice === undefined ? undefined : playedTargetModelFor(choice);
});
const playedTargetLayout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: playedTargetModel.value?.owners ?? [],
    availW: playedTargetWidth.value,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
/** The live ask of the OPEN step. A COMPUTED, not a method: the template
 *  binds it and the input handlers read it every press. */
const playedTargetSelection = computed((): PlayedTargetSelection => {
  const choice = playedTargetChoice.value;
  return choice === undefined ? {mode: 'single'} : playedTargetSelectionFor(choice);
});
/** The game-state version a selection is only valid under. */
const playedTargetVersion = computed((): string => {
  return `${props.playerView.game.gameAge}|${props.playerView.game.undoCount ?? 0}`;
});
const branches = computed((): ReadonlyArray<ActionPreviewBranch> => {
  return props.preview?.branches ?? [];
});
const positions = computed((): ReadonlyArray<number> => {
  if (props.nodeIndex < 0) {
    return branches.value.map((_b, i) => i);
  }
  return branchPositionsForNode(props.entry.group, branches.value, props.nodeIndex);
});
/** Show the branch radiogroup (a combined node maps to >1 branch). */
const needBranchRow = computed((): boolean => {
  return positions.value.length > 1;
});
/**
 * EVERY option this variant offers is refused — the SAME rule the browse grid
 * blocks the row with (`nodeAvailability`), asked again here because the state
 * can move between the press and this screen (another action spent the
 * resource, a server response landed). Nothing on this screen can fix it:
 * there is no legal branch to select, so «Выберите вариант» would be an
 * instruction the player cannot follow — the gate states the reason instead.
 */
const variantBlockedReason = computed((): string | undefined => {
  const verdict = branchSetAvailability(positions.value.map((p) => branches.value[p]).filter((b) => b !== undefined));
  if (!verdict.allBlocked) {
    return undefined;
  }
  const first = verdict.reasons[0];
  return first === undefined ?
    translateText('Unavailable right now') :
    textOf(first.message, first.params);
});
const selectedBranch = computed((): ActionPreviewBranch | undefined => {
  return selectedPos.value !== undefined ? branches.value[selectedPos.value] : undefined;
});
/** The selected branch's own «N on a card» gain — the payload of a target its OPTION asks (no step carries it). */
const branchOnCardGain = computed((): {amount: number, cardResource: string} | undefined => {
  const gain = selectedBranch.value?.effects.find((e) => e.note === 'to a card' && e.direction === 'gain' && e.amount > 0);
  return gain === undefined ? undefined : {amount: gain.amount, cardResource: gain.icon};
});
const preChoiceList = computed((): ReadonlyArray<ComposerChoice> => {
  return preChoices(props.preview);
});
/**
 * THE VENUS BONUS'S INNER STEP stands (P89 · EM): the setup's body — the rule, the formula, «Сработает», the
 * reckoning — steps aside (`v-show`, kept mounted: B brings it back as it was) and the step takes its place, the
 * card and the crumb standing still; the whole 2 × 3 grid fits without a scroll.
 */
const venusStepOpen = computed((): boolean => {
  // The wild-resource choice's inner step takes the body's place the same way (P43 · EO).
  return sub.value?.kind === 'venus' || sub.value?.kind === 'wild';
});
/** The card branch's own target step as a composer choice — whether or not that branch is selected yet. */
const wildCardChoice = computed((): ComposerChoice | undefined => {
  const plan = wildPlan.value;
  if (plan === undefined || plan.cardStep === undefined) {
    return undefined;
  }
  return branchChoices(branches.value[plan.cardPos]).find((c) => c.scope === 'step' && c.index === plan.cardStep);
});
/** The target selector's model for «на карту» — the composer's ONE builder for a card step. */
const wildTargetModel = computed((): PlayedTargetModel | undefined => {
  const choice = wildCardChoice.value;
  return choice === undefined ? undefined : playedTargetModelFor(choice);
});
/** The selector's cursor — shown only while the inner step's cursor stands in the candidates. */
const wildTargetFocusShown = computed((): PlayedTargetFocus => {
  const owners = wildTargetModel.value?.owners ?? [];
  const live = reseatPlayedTargetFocus(wildTargetFocusRaw.value, owners);
  return sub.value?.kind === 'wild' && sub.value.focus.zone === 'card' && live !== undefined ? live : {ownerId: '', index: -1};
});
/** THE WILD-RESOURCE CHOICE (P43 · EN): the plan of the server-stamped pair of branches, or undefined. */
const wildPlan = computed((): WildBranchPlan | undefined => {
  return wildBranchPlan(branches.value, positions.value);
});
/**
 * THE DIAL'S RESOURCE (P49 · FA): the selected branch's amount dial raises a `dialBound` resource prompt — the same
 * inner step answers it, a radio whose budget is the dial's X. Never beside a P43 pair.
 */
const wildDial = computed((): WildDialPlan | undefined => {
  return wildPlan.value === undefined ? wildDialPlan(selectedBranch.value, selectedPos.value) : undefined;
});
/** The dial's live X (its captured answer). */
const wildDialX = computed((): number => {
  return wildDialAmount(capturedOption.value);
});
/**
 * THE STANDALONE «?» STEPS (P50 · FC): every `resource` step of the selected branch no pair / dial answers — a SPEND
 * and a GAIN told apart by the server's marker, each its own row and its own inner step.
 */
const wildStepList = computed((): ReadonlyArray<WildStepPlan> => {
  return wildPlan.value !== undefined ? [] : wildStepPlans(selectedBranch.value);
});
/** The standalone «?» step the inner step stands on now (its row's id is `wild#<step>`). */
const wildStepOpen = computed((): WildStepPlan | undefined => {
  const subNow = sub.value;
  return subNow?.kind === 'wild' ? wildStepList.value.find((p) => 'wild#' + p.resourceStep === subNow.choiceId) : undefined;
});
/** The open standalone step's head: the server's own question («Какой ресурс потратить?» / «…получить?»). */
const wildHeadTitle = computed((): string => {
  const plan = wildStepOpen.value;
  const step = plan === undefined ? undefined : selectedBranch.value?.steps[plan.resourceStep];
  const title = step?.kind === 'input' ? step.input.title : undefined;
  return title === undefined ? 'Resource of your choice' : textOf(title);
});
const wildSpec = computed((): WildChoiceSpec | undefined => {
  const stepPlan = wildStepOpen.value;
  if (stepPlan !== undefined) {
    return wildStepSpec(stepPlan, wildStepIncluded(selectedBranch.value, stepPlan), (resource) => venusStock.value[resource] ?? 0);
  }
  if (wildPlan.value !== undefined) {
    return wildComposerSpec(wildPlan.value, branches.value);
  }
  // The budget is READ at every use — the dial turns, the lanes' «+X» follow without a remount.
  return wildDial.value === undefined ? undefined : wildDialSpec(() => wildDialX.value);
});
/** The step's draft READ BACK from the composer's own state (the branch + the step answers) — never a second draft. */
const wildParts = computed((): WildParts => {
  if (wildStepOpen.value !== undefined) {
    return wildStepParts(wildStepOpen.value, captured.value);
  }
  if (wildPlan.value !== undefined) {
    return wildPartsFrom(wildPlan.value, selectedPos.value, captured.value);
  }
  return wildDial.value === undefined ? {} : wildDialParts(wildDial.value, captured.value, wildDialX.value);
});
const wildAnswer = computed((): WildRowAnswer | undefined => {
  if (wildPlan.value !== undefined) {
    return wildRowAnswer(wildPlan.value, branches.value, wildParts.value);
  }
  return wildDial.value === undefined ? undefined : wildDialAnswer(wildDial.value, captured.value, wildDialX.value);
});
const wildCandidateModels = computed((): ReadonlyArray<CardModel> => {
  return wildPlan.value === undefined ? [] : wildCandidates(wildPlan.value, branches.value);
});
const wildVpBox = computed((): Partial<Record<string, {from: number, to: number}>> => {
  return (wildPlan.value === undefined ? undefined : wildCardPick(wildPlan.value, branches.value)?.vpBox) ?? {};
});
const wildResourceByCard = computed((): Partial<Record<string, string>> => {
  return (wildPlan.value === undefined ? undefined : wildCardPick(wildPlan.value, branches.value)?.input.resourceGainPrompt?.cardResourceByCard) ?? {};
});
/** The bonus row the Venus inner step answers (P89 · EM). */
const venusSubChoice = computed((): ComposerChoice | undefined => {
  const subNow = sub.value;
  return subNow?.kind === 'venus' ? allChoices.value.find((c) => c.id === subNow.choiceId) : undefined;
});
const branchChoiceList = computed((): ReadonlyArray<ComposerChoice> => {
  // A conditional Venus bonus (PL-1505) stands only while its option is the `or` step's answer — the captures decide.
  const out = [...branchChoices(selectedBranch.value, captured.value)];
  // A PLAN whose deferred deltaAdvance door lands on an ASKING stage draws
  // the landing pre-select as a row of its own — answered by descending
  // into the Hydronetwork's reward-pick (the player must SEE the track
  // before choosing, the Corporate Espionage owner-pick precedent). Never
  // inside a standing hydro flow: the workspace-stack law forbids a second
  // hydro entry, and the reward-pick's open would reset the OUTER plan —
  // there the landing ask stays the server's own next prompt.
  if (navigationDeferred.value && !workspaceFrameKnown('hydro')) {
    const landing = planLandingChoice(selectedBranch.value);
    if (landing !== undefined) {
      out.push(landing);
    }
  }
  return out;
});
/** The plan's landing pre-select row, when this branch draws one. */
const deltaLandingChoice = computed((): ComposerChoice | undefined => {
  return branchChoiceList.value.find((c) => c.deltaLanding !== undefined);
});
const allChoices = computed((): ReadonlyArray<ComposerChoice> => {
  return [...preChoiceList.value, ...branchChoiceList.value];
});
/**
 * The RENDER list, in reading order: preSteps · branch option cards · branch
 * inputs. PAYMENT is not here (it's a persistent panel of its own, below);
 * a FOCUS-FREE dial IS here — it renders in place, it just isn't navigable.
 */
const items = computed((): ReadonlyArray<Item> => {
  const out: Array<Item> = [];
  for (const c of preChoiceList.value) {
    if (c.kind !== 'payment') {
      out.push({id: c.id, kind: 'choice', choice: c});
    }
  }
  // THE WILD-RESOURCE ROW (P43): ONE printed row stands for both branches AND their own steps (answered inside it).
  const wild = wildPlan.value;
  if (wild !== undefined) {
    out.push({id: 'wild', kind: 'wild'});
  } else if (needBranchRow.value) {
    for (const pos of positions.value) {
      out.push({id: 'branch#' + pos, kind: 'branch', pos});
    }
  }
  for (const c of branchChoiceList.value) {
    if (c.kind === 'payment') {
      continue;
    }
    if (wild !== undefined && c.scope === 'step' &&
        ((selectedPos.value === wild.standardPos && c.index === wild.resourceStep) || (selectedPos.value === wild.cardPos && c.index === wild.cardStep))) {
      continue;
    }
    // THE DIAL'S RESOURCE (P49): the step stands as the «?» row in its own place, under the dial that budgets it.
    if (wildDial.value !== undefined && c.scope === 'step' && c.index === wildDial.value.resourceStep) {
      out.push({id: 'wild', kind: 'wild'});
      continue;
    }
    // A STANDALONE «?» (P50 · FC — a spend, a gain): its own row, in the executed order, a door into the shared step.
    if (c.scope === 'step' && wildStepList.value.some((p) => p.resourceStep === c.index)) {
      out.push({id: 'wild#' + c.index, kind: 'wild', step: c.index});
      continue;
    }
    out.push({id: c.id, kind: 'choice', choice: c});
  }
  return out;
});
/**
 * The NAV list — what the cursor actually walks: the render rows MINUS the
 * focus-free dial. A dial you can drive globally with LB/RB must not eat a
 * cursor stop (and an extra A to leave it): with a lone stepper the cursor
 * starts on the CTA, so «покрутил LB/RB → A» is the whole interaction.
 */
const navItems = computed((): ReadonlyArray<Item> => {
  const free = focusFreeDialId.value;
  return items.value.filter((it) => {
    if (it.kind !== 'choice') {
      return true;
    }
    // The focus-free dial is driven globally with LB/RB — no cursor stop.
    if (free !== undefined && it.choice.id === free) {
      return false;
    }
    // The read-only NESTED repeat slot is a note, not a control.
    return !(it.choice.repeatAction === true && props.repeatPickDisabled);
  });
});
/** Every payment choice (pre + branch) — rendered as persistent panels,
 *  NOT nav rows. Normally 0 or 1; a card with several SelectPayment steps
 *  shows one panel each (the dedicated LT / LB/RB target the FIRST). */
const paymentChoices = computed((): ReadonlyArray<ComposerChoice> => {
  return allChoices.value.filter((c) => c.kind === 'payment');
});
/** The payment the dedicated LT button / inline LB/RB act on. */
const primaryPaymentChoice = computed((): ComposerChoice | undefined => {
  return paymentChoices.value[0];
});
/** Every INLINE DIAL on screen (steppers + the single-alt payment quick-adjust). */
const inlineDials = computed((): ReadonlyArray<InlineDial> => {
  const out: Array<InlineDial> = [];
  for (const c of allChoices.value) {
    if (c.kind === 'amount' || c.kind === 'spendHeat') {
      out.push({id: c.id, kind: c.kind});
    }
  }
  const pay = primaryPaymentChoice.value;
  // A payment counts as a dial only when it OFFERS the inline quick-adjust
  // (exactly one alt lane); a complex / pure-M€ payment is LT-only.
  if (pay !== undefined && paymentPanelView(pay).quickAdjustEligible) {
    out.push({id: pay.id, kind: 'payment'});
  }
  return out;
});
/** The stepper that leaves the focus list (the sole non-payment dial). */
const focusFreeDialId = computed((): string | undefined => {
  return focusFreeDialIdOf(inlineDials.value);
});
/** That stepper's choice — the global LB/RB / RT target. */
const focusFreeDialChoice = computed((): ComposerChoice | undefined => {
  const id = focusFreeDialId.value;
  return id === undefined ? undefined : allChoices.value.find((c) => c.id === id);
});
/**
 * Is there anything to SET UP (drives the «Настройка действия» kicker + the
 * bare-confirm plain line)? Counts the NON-focusable surfaces too — the
 * payment panel and a focus-free dial are decisions even though the cursor
 * never stops on them; without this a payment-only / stepper-only action
 * would mislabel itself as a bare confirmation.
 */
const hasDecisions = computed((): boolean => {
  return items.value.length > 0 || paymentChoices.value.length > 0;
});
/** The hero is the selected/single branch's live formula (multi-branch
 *  option cards carry their own chips → no hero until one is chosen). */
const showHero = computed((): boolean => {
  if (selectedBranch.value === undefined) {
    // The variants' COMMON price is the action's: «Будет списано» states it before a variant is chosen (PL-074) —
    // and the formula stands from the first frame whenever a variant will fill it (`heroPending`).
    return commonCost.value.length > 0 || heroPending.value;
  }
  return heroCost.value.length + heroGain.value.length + heroChoice.value.length > 0 || heroTimeline.value !== undefined;
});
/**
 * WHAT THE RESOURCE HERE BUYS once this action's move on the hero's own capsule has landed (P73 · DC, iteration 2):
 * the role of the stored resource (`holderRoleOf` — the satellite's model, never a second reading) applied to the
 * capsule's `current → resulting` — a gain through `holderGainOutcome`, a spend through `holderLossOutcome`. `undefined`
 * when the hero's capsule does not move, when the role is VP (the chip reads it) or plain storage, and while a
 * hosted target step owns the column.
 */
const setupContext = computed((): {icons: ReadonlyArray<string>, text: string} | undefined => {
  const name = heroCardName.value;
  if (name === undefined || sub.value?.kind === 'playedTarget') {
    return undefined;
  }
  const role = holderRoleOf(name);
  if (role.kind === 'store' || role.kind === 'vp') {
    return undefined;
  }
  const move = heroTimeline.value?.effect ??
    [...heroGain.value, ...heroCost.value].find((e) => e.note === 'on this card' && e.current !== undefined && e.resulting !== undefined);
  if (move === undefined || move.current === undefined || move.resulting === undefined || move.current === move.resulting) {
    return undefined;
  }
  const reading = move.resulting > move.current ?
    (() => {
      const outcome = holderGainOutcome(role, move.current, move.resulting);
      return outcome === undefined ? undefined : holderGainOutcomeReading(outcome);
    })() :
    (() => {
      const outcome = holderLossOutcome(role, move.current, move.resulting);
      return outcome === undefined ? undefined : holderLossOutcomeReading(outcome);
    })();
  if (reading === undefined) {
    return undefined;
  }
  return {icons: holderRoleIcons(role), text: readingLineText(reading)};
});
/** The formula's «Вы получите» side is RESERVED — a variant is still to be chosen (the slot the answer fills). */
const heroPending = computed((): boolean => {
  return needBranchRow.value && selectedBranch.value === undefined;
});
/** The formula's PRICE side is the reserved one — the variants are prices of ONE good (`commonGain`, TR58). */
const heroPricePending = computed((): boolean => {
  return heroPending.value && commonCost.value.length === 0 && commonGain.value.length > 0;
});
/** A hosted step that owns the whole decision column lifts the settled pin while it stands. */
const settleSuspended = computed((): boolean => {
  return sub.value?.kind === 'playedTarget';
});
/**
 * THE PRICE EVERY OFFERED VARIANT SHARES (PL-074 — `commonVariantCost`): printed once, on the formula's price
 * side, and taken off the variant cards, which then read only what each GIVES. `[]` — no common price.
 */
const commonCost = computed((): ReadonlyArray<ActionEffect> => {
  if (!needBranchRow.value) {
    return [];
  }
  return commonVariantCost(positions.value.map((pos) => {
    const v = branchView(pos);
    return {cost: v.cost, variableCost: v.variableCost.length, rest: v.gain.length + v.variableGain.length + v.variableChoice.length};
  }));
});
/** The repeat-action choice (Viron) — a SelectCard of already-used actions
 *  filled by the repeat pick surface, not captured like a normal step. */
const repeatChoice = computed((): ComposerChoice | undefined => {
  return branchChoiceList.value.find((c) => c.repeatAction === true);
});
/**
 * The RULE TEXT of the action being composed — resolved for THIS variant
 * (`nodeIndex`), never for the card. A combined whole-card draft
 * (nodeIndex < 0, the Viron handoff) has no single rule and shows none.
 * The selected branch's title is the last-resort wording for a card that
 * carries neither a curated information block nor a printed description.
 */
const rules = computed((): ActionRules | undefined => {
  const branch = selectedBranch.value;
  return actionRules(props.entry.group, props.nodeIndex, branch === undefined ? undefined : branchTitleText(branch));
});
/** The chosen action's render node — the graphic drawn in the filled slot. */
const repeatNode = computed((): GroupNode | undefined => {
  const r = repeatResult.value;
  if (r === undefined) {
    return undefined;
  }
  const group = playerActionGroups([{name: r.chosenCard} as CardModel])[0];
  const node = group?.nodes[r.nodeIndex] ?? group?.nodes[0];
  return node !== undefined ? stripNodeOr(node) : undefined;
});
const canConfirm = computed((): boolean => {
  const branch = selectedBranch.value;
  if (props.preview === undefined || branch === undefined || !branch.available) {
    return false;
  }
  // The repeat slot (Viron) must be filled before confirming — unless the
  // slot is the read-only NESTED one (resolved post-submit by the server).
  if (!props.repeatPickDisabled && repeatChoice.value !== undefined && repeatResult.value === undefined) {
    return false;
  }
  // A plan's landing pre-select must be answered ON the track first.
  if (deltaLandingChoice.value !== undefined && choiceMissing(deltaLandingChoice.value)) {
    return false;
  }
  if (!preChoiceList.value.every((c) => capturedPre.value[c.index] !== undefined)) {
    return false;
  }
  if (branch.optionInput !== undefined && capturedOption.value === undefined) {
    return false;
  }
  // Every NON-repeat input step must be captured (the repeat step rides the
  // `repeat` payload, so it is never a plain captured step).
  return branch.steps.every((step, i) =>
    (step.kind !== 'input' && step.kind !== 'lawPlay') || (step.kind === 'input' && step.repeatAction === true) || captured.value[i] !== undefined);
});
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
/** The POLITICAL source this composer composes (a party's / the law's action), else undefined. */
const politicalEntry = computed((): PoliticalActionEntry | undefined => {
  return isPoliticalActionEntry(props.entry) ? props.entry : undefined;
});
/**
 * The action's SOURCE KEY — the card's name, or the party's / the law's tile key: the DOM address, the claim key,
 * the rail key, the staged arm's key. Never looked up as a card.
 */
const sourceKey = computed((): string => {
  return isPoliticalActionEntry(props.entry) ? props.entry.key : props.entry.cardName;
});
/** The hero CARD — undefined for a political source (no card face, no live model, no resource on it). */
const heroCardName = computed((): CardName | undefined => {
  return isPoliticalActionEntry(props.entry) ? undefined : props.entry.cardName;
});
/** Who the ACTION COMMIT belongs to: a card (its holder too), or a political source's key (holds nothing). */
const commitSource = computed((): ActionCommitSource => {
  return isPoliticalActionEntry(props.entry) ? {key: props.entry.key} : props.entry.cardName;
});
/** The hero's zoom-slot key — the card's name, the party's effect / the law's zoom entry name (L3 lifts THIS slot). */
const zoomSlotKey = computed((): string => {
  const political = politicalEntry.value;
  if (political === undefined) {
    return sourceKey.value;
  }
  return political.source.kind === 'law' ? resolutionZoomEntry(political.source.resolution).name : partyEffectZoomEntry(political.party).name;
});
/** The enacted law's face (the hero of a law's action). */
/** The party's CARD face (decision Р2) — a party source's hero. */
const partyFaceVm = computed((): PremiumCardVM | undefined => {
  const political = politicalEntry.value;
  if (political?.source.kind !== 'party') {
    return undefined;
  }
  const party = political.source.party;
  return partyPremiumVm(party, {bannerCubes: bannerCubesOn(props.playerView.game.parliament, party)});
});
const lawFaceVm = computed((): PremiumCardVM | undefined => {
  const political = politicalEntry.value;
  const law = political?.source.kind === 'law' ? getResolution(political.source.resolution) : undefined;
  return law === undefined ? undefined : resolutionPremiumVm(law);
});
/** The law's printed name (an i18n key) — a political source that is a LAW names itself by it; `undefined` otherwise. */
const lawNameKey = computed((): string | undefined => {
  const political = politicalEntry.value;
  return political?.source.kind === 'law' ? getResolution(political.source.resolution)?.text.name : undefined;
});
/** A LAW's card is landing in THIS stage (RX36, PL-726) — the shell armed the scene's `workspace` host. */
const lawLanding = computed((): boolean => {
  const law = politicalEntry.value?.source.kind === 'law' ? politicalEntry.value.source.resolution : undefined;
  return law !== undefined && lawPlayLandingOf(law) !== undefined && playedHeroState.host === 'workspace';
});
/** The receiving stage is MOUNTED — the hidden prewarm window included (after A nothing heavy happens first). */
const lawLandingMounted = computed((): boolean => {
  return lawLandingLatched.value || (lawLanding.value && (playedHeroLandingPrewarm() || playedHeroLandingUp()));
});
/** The receiving stage is ON SCREEN — from the card's lift to the workspace's leave. */
const lawLandingUp = computed((): boolean => {
  return lawLandingLatched.value || (lawLanding.value && playedHeroLandingUp());
});
/** A LAW'S PLAY was committed here (RX36): its outcome zone stands from the press (the teleport finds it ready). */
const lawOutcomeZoneOn = computed((): boolean => {
  return props.outcome?.kind === 'law-play';
});
/** …and what the card set off has TAKEN the stage — the layer takes the pad's surface, the tableau dissolves. */
const lawOutcomeIn = computed((): boolean => {
  return lawOutcomeZoneOn.value && lawPlayOutcomeLive() && workspaceOutcomeState.stage === 'presenting';
});
/** The tableau let go because the OUTCOME arrived (the deal began, or a surface stands in the zone) — never a refusal. */
const lawLandingYielded = computed((): boolean => {
  return lawOutcomeZoneOn.value && lawLandingLatched.value && playLandingYieldedToOutcome();
});
/** A STAGED door of THIS law's play stands as a step INSIDE this stage — the Parliament (a delegate) or the colonies. */
const lawStepHosted = computed((): boolean => {
  return lawNameKey.value !== undefined && props.publishCommands &&
    (workspaceFrameHost('parliament') === 'card-actions' || workspaceFrameHost('colonies') === 'card-actions');
});
/** «✓ благодаря: <закон>» — the law's printed name through the class's one key. */
const lawPlayThanksText = computed((): string => {
  return lawNameKey.value === undefined ? '' : translateTextWithParams(EASING_KEYS.thanksTo, [translateText(lawNameKey.value)]);
});
/** The composed play standing in the selected branch's law play slot (RX36), or `undefined`. */
const lawPlayCaptured = computed((): ConsolePlayPickResult | undefined => {
  const branch = selectedBranch.value;
  const at = branch?.steps.findIndex((s) => s.kind === 'lawPlay') ?? -1;
  return at < 0 ? undefined : captured.value[at] as ConsolePlayPickResult | undefined;
});
const heroCardModel = computed((): CardModel | undefined => {
  const model = heroCardName.value === undefined ? undefined : thisPlayer.value.tableau.find((c) => c.name === heroCardName.value);
  if (model === undefined || storedResource.value === undefined) {
    return model;
  }
  return {...model, resources: displayedStoredCount.value};
});
/** The live stored resource on the SOURCE card (the pool most spend-branches
 *  consume) — the gain beat's baseline and the flight's subject. */
const storedResource = computed((): {icon: string, count: number} | undefined => {
  const name = heroCardName.value;
  if (name === undefined) {
    return undefined; // a political source holds no resource
  }
  const model = thisPlayer.value.tableau.find((c) => c.name === name);
  const type = getCard(name)?.resourceType;
  if (model?.resources === undefined || type === undefined) {
    return undefined;
  }
  return {icon: String(type), count: model.resources};
});
/** The honest disabled-CTA reason: names the FIRST missing decision so a
 *  dimmed confirm is never mute about WHY. Empty when ready / in flight. */
const ctaHint = computed((): string => {
  if (submitting.value || canConfirm.value) {
    return '';
  }
  // The GATE outranks every field: when it says the action itself cannot be
  // performed, the honest line is its reason — never «Выберите вариант» over
  // options that are all refused (the state the dimmed CTA sat above).
  const gate = commitGate.value;
  if (gate.kind === 'blocked') {
    return gate.reason;
  }
  if (!props.repeatPickDisabled && repeatChoice.value !== undefined && repeatResult.value === undefined) {
    return translateText('Choose an action to repeat');
  }
  if (deltaLandingChoice.value !== undefined && choiceMissing(deltaLandingChoice.value)) {
    return translateText('Choose a stage reward on the Hydronetwork');
  }
  if (selectedBranch.value === undefined && needBranchRow.value) {
    return translateText('Choose an option');
  }
  const missing = firstMissingChoice(props.preview, selectedBranch.value, {
    pre: capturedPre.value, option: capturedOption.value, optionParts: capturedOptionParts.value, steps: captured.value,
  });
  if (missing === undefined) {
    return '';
  }
  switch (missing.kind) {
  case 'card': return translateText(cardPickAskKey(missing.amount, isDiscardPick(missing.input)));
  case 'player': return translateText('Choose a player');
  // An optional choice whose one answer is a pick IS that pick — its kind's verb, never «Choose an option».
  case 'or': return translateText(optionalPickVerb(missing));
  case 'payment': return translateText('Configure payment');
  case 'spendHeat': return translateText('Heat sources');
  default: return '';
  }
});
// ── the outcome stage ────────────────────────────────────────────────
/** The DECK-CHECK flavour is live — the composer draws the verdict itself. */
const deckCheckOn = computed((): boolean => {
  return props.outcome?.kind === 'deck-check';
});
/**
 * The post-commit CARD phase is live — the column belongs to the outcome.
 * `pending` and `draw` are one phase to everything outside the zone: the
 * geometry, the kicker and the input gate must not change when the cards
 * happen to land.
 */
const drawOutcomeOn = computed((): boolean => {
  return props.outcome?.kind === 'draw' || props.outcome?.kind === 'pending' || props.outcome?.kind === 'step';
});
/** A SelectColony this activation raised is HOSTED here — the colonies
 *  section teleports into the outcome column (workspace-embed). */
const colonyStepOn = computed((): boolean => {
  return workspaceFrameHost('colonies') === 'card-actions';
});
/** Still waiting: the zone is standing but nothing has been re-homed yet. */
const outcomePendingBeat = computed((): boolean => {
  // AWAITING, never «not presenting»: a RELEASED claim reads `idle`, and while the workspace concluded around a
  // still-set draw flow that re-opened the prepared stage for a frame — an empty «Вскрываем карту» over the
  // leaving zone, with a beat flight scheduled behind it (the TR46 probe's last sample, 2026-10-14).
  // A STEP stage has no card beat (P89 · EE): it hosts the shell's re-homed surface and nothing else.
  return drawOutcomeOn.value && props.outcome?.kind !== 'step' && workspaceOutcomeState.stage === 'awaiting';
});
/**
 * The card has LANDED but the server still has not answered — the genuine
 * lag case. Only here does a loading affordance appear; before it, the
 * flight itself is the state and a spinner would be noise over a card that
 * is visibly travelling.
 */
const beatStalled = computed((): boolean => {
  return beatLanded.value && !workspaceOutcomeState.answerIn;
});
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
 *
 * A HAND DISCARD is never the draw (the server's `discardPrompt` marker): the Reds' «draw 2, then discard 2»
 * answers with the batch AND the discard of the whole hand — read as candidates, the hand's nine cards became
 * nine sockets of the prepared stage while two cards landed (ONE FRAMEWORK П3 caught it).
 */
const beatRevealedNames = computed((): ReadonlyArray<string> => {
  const wf = props.playerView.waitingFor as {cards?: ReadonlyArray<{name: string}>, discardPrompt?: unknown, deckPickPrompt?: {order?: ReadonlyArray<string>}} | undefined;
  // A SPLIT REVEAL (P88): the prompt offers only the cards still to decide, but the deck turned
  // over the WHOLE reveal — the marker names it in deck order (the free companions included), so
  // the objects in flight are exactly the cards that left the pile, in the order they came up.
  const order = wf?.deckPickPrompt?.order;
  if (order !== undefined && order.length > 0) {
    return order;
  }
  const fromPrompt = wf?.discardPrompt !== undefined ? [] : (wf?.cards ?? []).map((c) => c.name).filter((n) => n !== '');
  if (fromPrompt.length > 0) {
    return fromPrompt;
  }
  return (currentRevealEvent()?.cards ?? []).map((c) => c.name);
});
/** How many physical cards the prepared stage reserves a slot for. */
const beatCount = computed((): number => {
  return beatFaces.value.length;
});
/**
 * A LOOK («X cards off the deck, keep 1» — the branch's draw chip carries `look`) does not RECEIVE the cards it
 * turns over: four of five go to the discard, and «Получены карты» over them promised the hand five (PL-205).
 * The head and the count badge read it alike.
 */
const beatLook = computed((): boolean => {
  return (selectedBranch.value?.effects ?? []).some((e) => e.look !== undefined);
});
/**
 * The prepared stage's own sentence. It is the DRAW's heading, not the
 * arriving surface's — the surface may turn out to be a buy pick, and
 * promising «Купить» before the server has said so would be a lie. The
 * plural follows the count, which is known from the claim.
 */
const beatTitleKey = computed((): string => {
  const look = beatLook.value;
  // THE PROCESS UNTIL THE CARDS ARE HERE (PL-206, the owner's decision 2026-10-12): «Получена карта» over an empty
  // socket announced a result ~0.6 s before the card left the deck. Until the last card touches down the head says
  // what is happening — «Берём карту из колоды» / «Вскрываем карты» — and turns into the result in place, on the
  // landing; the arriving surface then wears the very same result line, so the handoff changes nothing.
  if (!beatLanded.value) {
    if (look) {
      return beatCount.value > 1 ? 'Revealing the cards' : 'Revealing the card';
    }
    return beatCount.value > 1 ? 'Drawing cards from the deck' : 'Drawing a card from the deck';
  }
  if (look) {
    return beatCount.value > 1 ? 'Cards turned over' : 'Card turned over';
  }
  return beatCount.value > 1 ? 'Cards received' : 'Card received';
});
/** The outcome stage owns the column (any flavour) — drives the phrase. */
const outcomeStageOn = computed((): boolean => {
  // (A LEDGER outcome keeps the configuration surface — its ledger IS the stage; nothing is released.)
  // (…nor a LAW'S PLAY: the receiving stage already released it — the outcome rises as a layer over the tableau.)
  return props.outcome !== undefined && props.outcome.kind !== 'ledger' && props.outcome.kind !== 'law-play';
});
/** A re-homed surface has landed in the zone (drives the REVEAL half). */
const outcomeContentIn = computed((): boolean => {
  return drawOutcomeOn.value && workspaceOutcomeState.stage === 'presenting';
});
const revealPayload = computed((): RevealResultModel | undefined => {
  return props.outcome?.kind === 'deck-check' ? props.outcome.payload : undefined;
});
/** The outcome replaces the «Вскрываем карту» status the moment the face
 *  is FIRST visible (mid-flip) — never before. */
const revealOutcomeOn = computed((): boolean => {
  return revealStage.value !== 'pending' && revealPayload.value !== undefined;
});
/* (No `revealVpGain` here any more: the VP delta is one row of the SHARED
   verdict panel, which derives it from the same payload — one reading of
   one fact, in the one place that renders it.) */
/** The counter value the player SEES: the pre-reveal baseline until the
 *  gain beat lands, the live tableau value everywhere else. */
const displayedStoredCount = computed((): number => {
  const live = storedResource.value?.count ?? 0;
  if (stagedVoteCapsuleHeld.value !== undefined) {
    return stagedVoteCapsuleHeld.value;
  }
  if (deckCheckOn.value && !revealGainApplied.value && revealResBaseline.value !== undefined) {
    return revealResBaseline.value;
  }
  // A CAPSULE TIMELINE in the air (TR28): the model already holds the result (c − 1); the capsule reads what
  // has physically happened — c until the fighter lands, c + 1 until two leave, then c − 1. Never below zero.
  // …and a PRICE paid before a played card (P45's director, the hero's bill): the capsule ticks on its token's departure.
  if (actionCommitRailHoldsCapsule(sourceKey.value) || playedHeroHoldsCapsule(sourceKey.value)) {
    return Math.max(0, live - heldCardCapsule(sourceKey.value));
  }
  return live;
});
const revealRewardIconClass = computed((): string => {
  const icon = revealPayload.value?.reward?.icon;
  return icon !== undefined ? iconClassFor(icon) : '';
});
/** What kind of row the focus cursor is on — drives the A-verb of the
 *  command contract (the bar always names exactly what A will do). */
const focusedRowKind = computed((): FocusRowKind => {
  if (navItems.value.length === 0) {
    return 'none';
  }
  if (ctaFocused.value) {
    return 'cta';
  }
  const item = focusedItem.value;
  if (item === undefined) {
    return 'cta';
  }
  if (item.kind === 'branch') {
    return 'branch';
  }
  if (item.kind === 'wild') {
    return 'pick';
  }
  if (item.choice.kind === 'amount') {
    return 'amount';
  }
  if (item.choice.kind === 'spendHeat') {
    return 'spendHeat';
  }
  return 'pick';
});
/** The composer's live command contract, published to the ONE shell bar
 *  (consolePanelUi 'actionComposer' — plan §3.2; the old in-panel footer
 *  is gone). Built by the PURE stage builder (consoleActionFlow), so the
 *  bar can never disagree with the flow stage: X is always «Осмотреть»
 *  (the source card / a card list's focused row), the confirm is ONLY the
 *  A press on the CTA row, and the committed hold reads as «Выполняется…». */
const footCommands = computed((): Array<ConsoleCommand> => {
  // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's
  // own contract, verbatim.
  if (fxOpen.value) {
    return [...(forecastUi.value.barCommands ?? [])];
  }
  if (drawOutcomeOn.value) {
    // Only the PENDING beat is the stage's to narrate. Once the reveal has
    // teleported in, the shell publishes ITS contract (the shared
    // `drawnRevealCommandRun`) — the component that owns the cards owns
    // their buttons, so there is nothing to paraphrase here.
    return focusCommandRun({state: 'draw-pending'});
  }
  if (deckCheckOn.value) {
    return focusCommandRun(revealStage.value === 'settled' && revealPayload.value !== undefined ?
      {state: 'reveal-shown'} : {state: 'reveal-pending'});
  }
  if (ledgerPaying.value) {
    // «THE LEDGER PAYS»: the rows pay by themselves — nothing to press between the steps (a step publishes
    // its own contract while it has the column), and the bar says which beat this is.
    return [{control: 'confirm', label: ledgerSettled.value ? 'Completed' : 'Performing…', enabled: false}];
  }
  if (submitting.value) {
    return focusCommandRun({state: 'awaiting'});
  }
  if (sub.value !== undefined) {
    // THE VENUS BONUS'S INNER STEP owns the bar — the pure model's reading (P89 · EM).
    if (sub.value.kind === 'venus') {
      const c = venusSubChoice.value;
      const meta = c === undefined ? undefined : venusBonusMetaOf(c.input);
      return c === undefined || meta === undefined ? [] : venusInnerFootHints(venusInnerBar(meta, venusPartsOf(c), sub.value.focus));
    }
    if (sub.value.kind === 'wild') {
      const spec = wildSpec.value;
      if (spec === undefined) {
        return [];
      }
      const hints: Array<ConsoleCommand> = wildFootHints(wildBar(spec, wildParts.value, sub.value.focus, WILD_BLOCK_KEYS));
      if (sub.value.focus.zone === 'card' && wildTargetModel.value !== undefined) {
        // A near miss refuses A (its reason is on the rail); X inspects the card AS A TARGET (the dossier).
        const focused = playedTargetAt(wildTargetFocusShown.value, wildTargetModel.value.owners);
        const at = hints.findIndex((h) => h.control === 'confirm');
        if (at >= 0) {
          hints[at] = {...hints[at], enabled: focused !== undefined && focused.blocked === undefined};
        }
        hints.splice(at + 1, 0, {control: 'secondary', label: 'Inspect'});
      }
      return hints;
    }
    if (sub.value.kind === 'payment') {
      return focusCommandRun({state: 'sub-payment', covers: paymentView.value?.status.ok === true});
    }
    if (sub.value.kind === 'playedTarget') {
      const sel = playedTargetSelection.value;
      return focusCommandRun({
        state: 'sub-played-target',
        ownerTabs: (playedTargetLayout.value.mode === 'tabs' || playedTargetLayout.value.mode === 'board') && (playedTargetModel.value?.owners.length ?? 0) > 1,
        multi: sel.mode === 'multi' ? {
          count: sel.picked.length,
          valid: playedTargetPicksValid(sel),
          verb: playedTargetInput.value?.buttonLabel || 'Select',
        } : undefined,
        decline: subDecline.value !== undefined ? textOf(subDecline.value.label) : undefined,
        blocked: playedTargetAt(sub.value.focus, playedTargetModel.value?.owners ?? [])?.blocked !== undefined,
        noInspect: playedTargetAt(sub.value.focus, playedTargetModel.value?.owners ?? [])?.stand !== undefined,
      });
    }
    // A palette is a row — «◄► Ресурс» while the cursor stands in it (the variant group's «◄► Вариант»).
    const paletteHint: Array<ConsoleCommand> = subPalette.value ? [{control: 'dpadH', label: 'Resource'}] : [];
    return [...paletteHint, ...focusCommandRun({
      state: 'sub-list', cardList: subListIsCards.value,
      decline: subDecline.value !== undefined ? textOf(subDecline.value.label) : undefined,
    })];
  }
  const kind = focusedRowKind.value;
  const item = focusedItem.value;
  const resolved = kind === 'pick' && item?.kind === 'choice' && !choiceMissing(item.choice);
  const pay = primaryPaymentChoice.value;
  const payView = pay !== undefined ? paymentPanelView(pay) : undefined;
  // The side-by-side variant group: ←→ are the option switch — said in the bar while the cursor stands in it
  // (the play composer's «◄► Вариант»).
  const groupHint: Array<ConsoleCommand> = kind === 'branch' && (branchAxis.value === 'row' || branchAxis.value === 'grid') && branchNavIndices.value.length > 1 ?
    [{control: 'dpadH', label: 'Option'}] : [];
  return [...groupHint, ...focusCommandRun({
    state: 'main', focused: kind, resolved,
    // ONE answer drives the bar and the row alike — the bar can never
    // advertise a confirm the gate has already refused.
    canConfirm: commitReady.value,
    pickVerb: item?.kind === 'choice' ? requirementVerb(item.choice) : undefined,
    // ONE verb for the row and the bar. They used to be resolved
    // separately, so the row could read «Выбрать колонию» while the bar
    // under it still promised «Подтвердить» — two answers to «what does A
    // do», on one screen, at the same time. The plain action too (T14 · CC):
    // the row read «Подтвердить выполнение» over a bar's «Подтвердить».
    commitLabel: commitVerbKey.value,
    // LB/RB follow the ACTIVE dial (the same resolution the input uses), and
    // LT is the payment editor's dedicated, focus-independent entry.
    dial: activeDialHint.value,
    paymentEditor: payView?.editorEligible === true,
    forecast: forecastCanOpen.value,
  })];
});
/**
 * WHICH dial LB/RB drive right now — the SINGLE resolution shared by the
 * command bar and `onMainPress`, so the bar can never promise a dial the
 * input doesn't move: a FOCUSED stepper first (it's the one the cursor is
 * on), else the focus-free sole stepper, else the payment quick-adjust.
 */
const activeDialChoice = computed((): ComposerChoice | undefined => {
  const item = focusedItem.value;
  if (item?.kind === 'choice' && (item.choice.kind === 'amount' || item.choice.kind === 'spendHeat')) {
    return item.choice;
  }
  if (focusFreeDialChoice.value !== undefined) {
    return focusFreeDialChoice.value;
  }
  const pay = primaryPaymentChoice.value;
  return pay !== undefined && paymentPanelView(pay).quickAdjustEligible ? pay : undefined;
});
/** The active dial as the command bar's hint (payment reports its limits). */
const activeDialHint = computed((): {kind: 'amount' | 'spendHeat' | 'payment', canDecrease?: boolean, canIncrease?: boolean} | undefined => {
  const c = activeDialChoice.value;
  if (c === undefined) {
    return undefined;
  }
  if (c.kind === 'amount' || c.kind === 'spendHeat') {
    return {kind: c.kind};
  }
  const row = quickAdjustRow(paymentPanelView(c));
  return {kind: 'payment', canDecrease: row?.canDecrease === true, canIncrease: row?.canIncrease === true};
});
/** The branch's capsule TIMELINE read as one chip (TR28) — its two chips leave the cost / gain lists. */
const heroTimeline = computed((): {effect: ActionEffect, moves: ReadonlyArray<number>, parts: ReadonlyArray<ActionEffect>} | undefined => {
  return capsuleTimelineReading(selectedBranch.value);
});
/** The selected branch as the formula and the commit read it — a RATE «per card» summed over the pick (RX24). */
const totalsBranch = computed((): ActionPreviewBranch | undefined => {
  const branch = selectedBranch.value;
  return branch === undefined ? undefined : perCardTotals(branch, capturedOption.value);
});
const heroCost = computed((): ReadonlyArray<ActionEffect> => {
  const branch = totalsBranch.value;
  if (branch === undefined) {
    return commonCost.value;
  }
  const variable = variablePartsForBranch(branch);
  const timeline = heroTimeline.value?.parts ?? [];
  // A heat price split over Stormcraft's floaters is stated by the split's own chips (`syntheticCost` — `1 → 0`
  // heat, `−2` floaters): the branch's bare «−5 heat» beside them would count the heat twice (TR58).
  const heatSplit = allChoices.value.some((c) => c.kind === 'spendHeat');
  // A cost of NOTHING is no price («Будет списано −0» — Unity's free trade): never printed as one.
  // …except a DISCOUNTED price that reached zero (P89 at 12+ Venus tags): «12 → 0 · −12» is the reading.
  const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'cost' && (e.amount !== 0 || e.printed !== undefined) && !variable.suppressCostIcons.has(e.icon) &&
    !timeline.includes(e) && !(heatSplit && e.icon === 'heat'));
  for (const c of allChoices.value) {
    out.push(...syntheticCost(c));
  }
  return formulaFollowingParts(out, answeredPartChips.value, 'cost');
});
/**
 * TRP0 — the «РАСЧЁТ» of a PARLIAMENT count (`ActionEffectBasis.resolutions`): the play composer's strip read off
 * the formula's own gain chips. Only that class here — every other counted action keeps its chip's basis pill.
 */
const heroCountWhy = computed((): CountedWhy | undefined => {
  const why = countedWhyOf(heroGain.value);
  if (why !== undefined && why.resolutions.length > 0) {
    return why;
  }
  // …and a DISCOUNTED PRICE (P89 Venus Shuttles): «12 − [V] 3 → 9 [M€]» — the standard projects' discount, read.
  return discountWhyOf(heroCost.value);
});
const heroGain = computed((): ReadonlyArray<ActionEffect> => {
  const branch = totalsBranch.value;
  if (branch === undefined) {
    // The good every price buys is the action's: «Вы получите» states it before a price is chosen (TR58).
    return commonGain.value;
  }
  const variable = variablePartsForBranch(branch);
  const timeline = heroTimeline.value?.parts ?? [];
  const out: Array<ActionEffect> = branch.effects.filter((e) => e.direction === 'gain' && !variable.suppressGainIcons.has(e.icon) && !timeline.includes(e));
  for (const c of allChoices.value) {
    out.push(...syntheticGain(c));
  }
  out.splice(0, out.length, ...formulaFollowingParts(out, answeredPartChips.value, 'gain'));
  if (branch.reveal !== undefined) {
    // The kept card (TR13) first, then the printed reward — the SAME
    // reading the verdict states after the reveal.
    out.push(...revealPreviewReading(branch.reveal).gains);
  }
  return out;
});
/** The chips of every ANSWERED part of a two-part pick — the option the player chose, read by the server. */
const answeredPartChips = computed((): ReadonlyArray<ActionEffect> => {
  const out: Array<ActionEffect> = [];
  for (const c of allChoices.value) {
    if (c.scope !== 'option' || c.index < 0 || c.input.type !== 'or') {
      continue;
    }
    const answer = capturedOptionParts.value[c.index] as {type?: string, index?: number} | undefined;
    if (answer?.type !== 'or' || answer.index === undefined) {
      continue;
    }
    const item = buildOrItems(c.input as OrOptionsModel).find((it) => it.optionIndex === answer.index);
    out.push(...(item?.chips ?? []));
  }
  return out;
});
/** The rail rows this formula touches (PL-139) — published to the rail while the stage stands. */
const railFocusKeys = computed((): ReadonlyArray<string> => {
  const timeline = heroTimeline.value?.parts ?? [];
  return railFocusKeysOf([...heroCost.value, ...timeline], heroGain.value, forecast.value);
});
/** The selected branch's deck check, read for the composer's «до» (undefined off a reveal). */
const revealPreview = computed((): RevealPreviewReading | undefined => {
  const reveal = selectedBranch.value?.reveal;
  return reveal !== undefined ? revealPreviewReading(reveal) : undefined;
});
/**
 * A SPLIT REVEAL (P88 — `revealSplit`) as the setup stage's rows: the deal, the match's verdict,
 * the miss's price. Read off the server's descriptor only — the client counts nothing.
 */
const revealSplitRows = computed((): ReadonlyArray<{key: string, text: string, tail: string, tagUrl?: string, iconClass?: string}> => {
  // A VERDICT REVEAL over the PRELUDE deck (P45 — `revealVerdict`) reads on the same rows: what leaves which deck,
  // the decision AFTER the reveal with its price, and whether the wallet opens the play. The server's numbers only.
  const verdict = selectedBranch.value?.revealVerdict;
  if (verdict !== undefined) {
    const here = verdict.play.resourcesHere;
    return [
      {key: 'deal', text: translateText('Draw 1 card from the prelude deck'),
        tail: translateTextWithParams('In the deck: ${0}', [String(verdict.deckSize)]), iconClass: 'resource_icon resource_icon--cards'},
      {key: 'decide', text: translateTextWithParams('After the reveal: discard it, or pay ${0} M€ and 1 director to play it', [String(verdict.play.megacredits)]),
        tail: here === undefined ? '' : translateTextWithParams('Directors: ${0} → ${1}', [String(here.have), String(Math.max(0, here.have - here.count))])},
      {key: 'money', text: verdict.play.affordable ?
        translateText('Enough M€ to play it') :
        translateTextWithParams('Need ${0} more M€ — only the discard is open', [String(verdict.play.deficit ?? 1)]),
      tail: '', iconClass: 'resource_icon resource_icon--megacredits'},
    ];
  }
  const split = selectedBranch.value?.revealSplit;
  if (split === undefined) {
    return [];
  }
  const glyph = revealCheckGlyph(split.check);
  return [
    {key: 'deal', text: translateTextWithParams('Reveal the top ${0} cards', [String(split.count)]),
      tail: translateTextWithParams('In the deck: ${0}', [String(split.deckSize)]), iconClass: 'resource_icon resource_icon--cards'},
    {key: 'match', text: translateText(split.check.tag === Tag.VENUS ? 'Venus cards — to your hand for free' : 'To your hand for free'),
      tail: '', tagUrl: glyph.kind === 'tag' ? glyph.url : undefined},
    {key: 'miss', text: translateTextWithParams('Other cards — buy for ${0} M€ or discard', [String(split.miss.cardCost)]),
      tail: translateTextWithParams('Enough M€ for ${0}', [String(Math.min(split.miss.affordable, split.count))]),
      iconClass: 'resource_icon resource_icon--megacredits'},
  ];
});
/** The check's name, translated («Требование партии», «Бактерия»). */
const revealCheckLabel = computed((): string => {
  const label = revealPreview.value?.check.label;
  return label === undefined ? '' : textOf(label);
});
const heroChoice = computed((): ReadonlyArray<{id: string, icon?: string}> => {
  const out: Array<{id: string, icon?: string}> = [];
  for (const c of allChoices.value) {
    if (c.kind !== 'amount') {
      continue;
    }
    const m = amountModel(c);
    // Only a dial with NO structural direction hint belongs here — one that
    // states its result / conversion / price is already a cost+gain pair in
    // the hero, and listing it again as a bare «ваш выбор» would say less
    // than the chips beside it.
    if (m.amountResult === undefined && m.conversion === undefined && m.amountCost === undefined) {
      out.push({id: c.id, icon: m.icon});
    }
  }
  return out;
});
/**
 * The chosen action would change nothing right now — the server's PROVEN verdict for the selected branch (or the
 * whole card when it has a single action): said before the press, in the calm register, never a block.
 */
const futileVerdict = computed((): ActionFutilityVerdict | undefined => {
  const branch = selectedBranch.value;
  if (branch?.futile !== undefined) {
    return branch.futile;
  }
  return branches.value.length <= 1 ? props.entry.futility?.verdict : undefined;
});
const warnings = computed((): Array<string> => {
  // A gain that lands at its cap is the client's reading of ONE chip; the server's verdict on the whole action
  // supersedes it (it says more, and the two must never stand together).
  // Only a PARAMETER can be «already at maximum»: a VP reading short of its next point (the resource still lands)
  // and a zero count are not maxima, and saying so in amber was a false alarm (`actionEffectReading.ts`).
  const out: Array<string> = futileVerdict.value === undefined && heroGain.value.some((e) => gainAtParameterLimit(e)) ?
    ['One of the gains has no effect — the value is already at maximum.'] : [];
  // The check is unwinnable in THIS game (no card of its kind exists) — said
  // before the press, in the amber register; the action itself stays legal.
  if (revealPreview.value?.pool?.empty === true) {
    out.push(REVEAL_POOL_EMPTY_WARNING);
  }
  return out;
});
// Skipped-effect warnings for the selected branch, via the SAME shared
// derivation the desktop modal + the play composer use.
const skippedWarnings = computed((): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> => {
  return [...skippedEffectViews(selectedBranch.value?.steps).map((w) => ({
    title: w.title !== '' ? translateText(w.title) : '',
    reason: translateText(w.reason),
    effect: w.effect,
    // Only a chip-less warning needs the bare fallback sprite.
    icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
  })),
  // …and a tile the standing law REPLACES (RX35) is NOT placed — said in words, never by the strike alone.
  ...divertedTileWarnings(selectedBranch.value?.effects)];
});
const afterNotes = computed((): Array<NextStepRow> => {
  const branch = selectedBranch.value;
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
    } else if (step.kind === 'delegateGrant') {
      // The resolution is chosen in the Parliament (TR15 — the play door's own row, one key for both doors):
      // the step's NAME, never a guess about its result.
      out.push(noteRow(translateText(playDoorNextStepKey({kind: 'parliament', staged: step.staged, mode: 'vote'}) ?? '')));
    } else if (step.kind === 'delegateGrantFollowUp') {
      // THEN — a LIVE grant after the activation (a declarative `turmoil.sendDelegates` action — Martian Media
      // Center on a Redux table): the play composer's own row (T03).
      out.push(noteRow(nextRowText(delegateGrantFollowUpRow(step), {text: translateText, params: translateTextWithParams})));
    } else if (step.kind === 'note' && step.noteKind !== 'warning') {
      out.push(noteRow(step.text !== undefined ? textOf(step.text) : translateText('An additional choice')));
    }
    // A `warning` is NOT an "after confirming" step (nothing happens) — it has
    // its own block above (`skippedWarnings`), which names the lost effect.
  }
  return out;
});
// ── sub-state ────────────────────────────────────────────────────────
const subChoice = computed((): ComposerChoice | undefined => {
  return sub.value === undefined ? undefined : allChoices.value.find((c) => c.id === sub.value?.choiceId);
});
/** The branch rows' positions in render order (the variant group renders them as ONE block at the first). */
const branchItemPositions = computed((): ReadonlyArray<number> => {
  return items.value.filter((it): it is Item & {kind: 'branch'} => it.kind === 'branch').map((it) => it.pos);
});
/**
 * The card's printed graphic of each branch — the face's own nodes (`BranchView.printed`), by branch position: a
 * row of its own whole, a row shared with sibling branches sliced to THIS branch's outcome.
 */
const branchPrinted = computed((): ReadonlyArray<ReadonlyArray<ItemType> | undefined> => {
  return branchViews.value.map((v) => v.printed);
});
const branchViews = computed((): ReadonlyArray<PrintedBranchView> => {
  return buildBranchViews(sourceKey.value, props.entry.group, branches.value);
});
/**
 * THE GOOD EVERY PRICE BUYS (TR58 — «3 [plant] OR 5 [heat] → 3 [floater]*»): the card's «OR» stands on the price
 * side, so the tiles are the PRICES and the good is ONE — printed once after them (the face's own result nodes) with
 * its addresses once, when every variant offers the same holders (the TR56 law: never one fan per tile for one set).
 */
const variantShared = computed((): VariantSharedResult | undefined => {
  const printed = branchItemPositions.value.map((pos) => branchViews.value[pos]?.printedShared).find((p) => p !== undefined);
  if (printed === undefined) {
    return undefined;
  }
  const destinations = sharedVariantDestinations(branchItemPositions.value.map((pos) => variantDestinationsOf(branchAt(pos))));
  return destinations !== undefined ? {printed, destinations} : {printed};
});
/** The good every offered variant buys (`commonVariantGain`) — printed once after the tiles; `[]` otherwise. */
const commonGain = computed((): ReadonlyArray<ActionEffect> => {
  if (!needBranchRow.value) {
    return [];
  }
  return commonVariantGain(positions.value.map((pos) => {
    const v = branchView(pos);
    return {gain: v.gain, variableGain: v.variableGain.length, cost: v.cost.length + v.variableCost.length};
  }));
});
/** The variant grammar's options for the branch rows — cursor · answer · rules, the printed row, the reason. */
const branchOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  return branchItemPositions.value.map((pos): VariantChoiceOption => {
    const branch = branchAt(pos);
    const printed = branchPrinted.value[pos];
    return {
      key: 'branch#' + pos,
      state: {focused: isFocused({id: 'branch#' + pos, kind: 'branch', pos}), selected: selectedPos.value === pos, off: !branch.available},
      // The words speak only where nothing else does — no printed row and an empty formula.
      title: printed === undefined && branchView(pos).empty ? branchTitle(branch) : '',
      reason: branch.available ? undefined : branchReason(branch),
      // The server proved this live branch changes nothing right now — said on the tile, before the choice.
      ...(branch.available && branch.futile !== undefined ? {quiet: translateText(branch.futile.reason)} : {}),
      printed,
      // THE PALETTE (R33 Utopia Invest): the variant IS a kind of standard resource — its hero leads the tile.
      ...(branchPalette.value ? {hero: branchHeroes.value[pos]} : {}),
      // «КУДА ЛЯЖЕТ» (TR56, П1): a variant that puts N on ANY card names its ADDRESSES — the server's holders for it;
      // a set every variant shares stands ONCE, beside the good they all buy (`variantShared`, TR58).
      destinations: variantShared.value?.destinations !== undefined ? undefined : variantDestinationsOf(branch),
      attrs: {
        'data-branch-pos': String(pos), 'data-branch-nav': branchNavKind(pos),
        'data-seeded': soleVariantPos.value === pos ? 'sole' : undefined,
        'data-palette-resource': branchPalette.value ? branchHeroes.value[pos]?.icon : undefined,
      },
    };
  });
});
/**
 * Each variant's HERO — the standard resource its own first GAIN chip puts in the stock (`heroOfEffect`, the
 * server's number); `undefined` for a variant that gains no single standard resource.
 */
const branchHeroes = computed((): ReadonlyArray<VariantHero | undefined> => {
  return branches.value.map((_b, pos) => heroOfEffect(branchView(pos).gain[0]));
});
/**
 * THE VARIANTS ARE A PALETTE (R33 Utopia Invest — «lower ANY production: gain 4 of that kind», six variants):
 * the face prints ONE row for every variant («[?-prod] → 4 [?]» — no seam to slice, `KNOWN_UNSLICED`), no price
 * every variant shares, and each variant buys ONE standard resource of one kind — «which resource» asked as ONE
 * group of equal tiles (TR54's palette, the play composer's and the or-pick's), folded 3 + 3, never six sentences in
 * a row of compare tiles. Each tile's hero is the resource and its number; its reading keeps BOTH axes (the
 * variant's own price chip — a production's `current → resulting` — and the stock's).
 */
const branchPalette = computed((): boolean => {
  return branchesArePalette(branchItemPositions.value.map((pos) => ({hero: branchHeroes.value[pos], printed: branchPrinted.value[pos]})),
    variantShared.value !== undefined);
});
/**
 * The ONE live variant among several (`initialVariantSelection` — the rules left one): it opens selected, and the
 * tile says so («Единственный вариант»). `undefined` for a real choice and for a lone variant (no group at all).
 */
const soleVariantPos = computed((): number | undefined => {
  const positions = branchItemPositions.value;
  if (positions.length < 2) {
    return undefined;
  }
  const seed = initialVariantSelection(positions.map((p) => branches.value[p] ?? {available: false}));
  return seed === undefined ? undefined : positions[seed];
});
const branchPaletteKicker = computed((): string => {
  return translateTextWithParams('One of ${0}', [String(branchItemPositions.value.length)]);
});
/** The nav-row indices of the variant tiles, in order — what `variantGroupNav` walks. */
const branchNavIndices = computed((): ReadonlyArray<number> => {
  return navItems.value.map((it, i) => (it.kind === 'branch' ? i : -1)).filter((i) => i >= 0);
});
/** The pick list in the variant grammar — one option per row of `listItems`. */
const listOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  const at = sub.value?.kind === 'list' || sub.value?.kind === 'orNested' ? sub.value.index : undefined;
  const palette = subPalette.value;
  return listItems.value.map((item, i): VariantChoiceOption => {
    const hero = palette ? listHeroes.value[i] : undefined;
    return {
      key: item.key,
      state: {focused: at === i, selected: item.chosen, off: item.disabled},
      // A palette tile speaks with its hero and its number — the words would only repeat them.
      title: hero !== undefined ? '' : item.label,
      reason: item.disabled && item.reason !== '' ? item.reason : undefined,
      door: item.nested === true && !item.chosen && !item.disabled,
      color: item.color,
      hero,
      attrs: hero !== undefined ? {'data-palette-resource': hero.icon} : undefined,
    };
  });
});
/** Each pick row's hero — the standard resource its own first chip gains (`heroOfEffect`, the server's number). */
const listHeroes = computed((): ReadonlyArray<VariantHero | undefined> => {
  return listItems.value.map((item) => heroOfEffect(item.chips?.[0]));
});
/**
 * The open pick is a PALETTE (TR54): an or-pick (never a card / player list) whose every option gains a different
 * standard resource — «which resource» asked as ONE row of six tiles, not six sentences.
 */
const subPalette = computed((): boolean => {
  // A PART of a two-part pick (the Industrialists' «which production») is a palette BY CONSTRUCTION — the host's own
  // floor (`paletteOf` § min): one decreasable production is still «which production», not a sentence.
  const part = subChoice.value?.scope === 'option' && subChoice.value.index >= 0;
  return sub.value?.kind === 'list' && paletteOf(listHeroes.value.map((hero) => ({hero})), part ? 1 : 3);
});
const paletteKicker = computed((): string => {
  return translateTextWithParams('One of ${0}', [String(listItems.value.length)]);
});
const subTitle = computed((): string => {
  const c = subChoice.value;
  if (sub.value?.kind === 'orNested') {
    // The BRANCH's own ask («выберите карту, чтобы удалить 1 Животное»),
    // not the or-pick's — the player has already answered that one.
    const t = textOf(sub.value.item.nested?.title ?? sub.value.item.label);
    return t !== '' ? t : (c !== undefined ? choiceTitle(c) : '');
  }
  return c !== undefined ? choiceTitle(c) : '';
});
/** The open sub-list points at CARDS (an X press has something to inspect). */
const subListIsCards = computed((): boolean => {
  if (sub.value?.kind === 'orNested') {
    return sub.value.item.nested?.type === 'card';
  }
  return subChoice.value?.input.type === 'card';
});
const listItems = computed((): ReadonlyArray<ListItem> => {
  const c = subChoice.value;
  if (sub.value === undefined || c === undefined) {
    return [];
  }
  if (sub.value.kind === 'orNested') {
    return nestedListItems(c, sub.value.item);
  }
  if (sub.value.kind !== 'list') {
    return [];
  }
  if (c.input.type === 'card') {
    const model = c.input as SelectCardModel;
    const chosenName = picks.value[c.id];
    const items: Array<ListItem> = model.cards.map((card): ListItem => cardListItem(c, card, chosenName === card.name, false));
    for (const card of model.disabledCards ?? []) {
      items.push(cardListItem(c, card, false, true));
    }
    return items;
  }
  if (c.input.type === 'player') {
    const model = c.input as SelectPlayerModel;
    const chosen = picks.value[c.id];
    const items: Array<ListItem> = model.players.map((color): ListItem => playerListItem(model, color, chosen === color, false, undefined));
    for (const d of model.disabledPlayers ?? []) {
      items.push(playerListItem(model, d.color, false, true, d.reason));
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
    const chosen = picks.value[c.id];
    // An OPTIONAL choice's decline is no row: it is the button (RT) and the plate in the question line.
    const declineAt = choiceDecline(c)?.index;
    return buildOrItems(c.input as OrOptionsModel).filter((it) => it.optionIndex !== declineAt).map((it): ListItem => ({
      key: it.key,
      label: textOf(it.label),
      resIcon: '', resCount: 0, impact: '',
      // A NESTED-input option (an OrOptions branch that is itself a
      // SelectCard/SelectPlayer) is a DOOR: A descends into its own pick and
      // the answer nests into this branch's response. It used to render
      // disabled with «недоступно на этом экране» — a screen refusing a
      // target the server offered, which is how «Хищники» lost every card
      // target the moment a MarsBot joined the game. A shape this screen
      // genuinely cannot draw keeps that honest refusal.
      disabled: it.disabled || !nestedPickHostable(it),
      reason: !nestedPickHostable(it) ? translateText('Not available on this screen') : textOf(it.reason),
      nested: it.nested !== undefined && nestedPickHostable(it),
      chosen: chosen === String(it.optionIndex),
      color: it.playerColor,
      chips: it.chips,
      warnings: it.warnings,
      orItem: it,
    }));
  }
  return [];
});
/**
 * THE DECLINE of the open sub-surface's optional choice (`optionalChoice.ts`): the plate in its question line and
 * RT. A played-target step carries it only on a SINGLE pick (a merged up-to-N ask spends RT on its own submit).
 */
const subDecline = computed((): DeclineModel | undefined => {
  const subNow = sub.value;
  if (subNow === undefined || subNow.kind === 'payment' || subNow.kind === 'venus') {
    return undefined;
  }
  if (subNow.kind === 'playedTarget') {
    const c = playedTargetChoice.value;
    return c !== undefined && subNow.orItem !== undefined && playedTargetSelection.value.mode !== 'multi' ? choiceDecline(c) : undefined;
  }
  const c = subChoice.value;
  return c !== undefined ? choiceDecline(c) : undefined;
});
/** The payment view of the choice whose EDITOR is open (the SAME model the
 *  panel renders — there is no second, ad-hoc editor model any more). */
const paymentView = computed((): PaymentView | undefined => {
  const c = subChoice.value;
  return c === undefined || c.kind !== 'payment' ? undefined : paymentPanelView(c);
});
/** The editor is open — the main screen stays mounted underneath it. */
const payExpanded = computed((): boolean => {
  return sub.value?.kind === 'payment';
});
/** The hand-editable rows of the open editor (its focus ring). */
const payEditableRows = computed((): ReadonlyArray<PaymentSourceRow> => {
  const v = paymentView.value;
  return v === undefined ? [] : editableRows(v);
});
const focusedItem = computed((): Item | undefined => {
  return navItems.value[focusIdx.value];
});
/** The CTA row's virtual focus index — one past the navigable rows. */
/**
 * THE REQUIREMENTS, in cursor order — what the commit gate reads.
 *
 * Satisfaction is asked of the DOMAIN (`choiceMissing`), never re-derived
 * here: whether `1/2 выбрано` answers an ask is a rule, not a count. Each
 * requirement carries its OWN A-verb, so the command bar can name the next
 * real step instead of the screen's eventual purpose.
 */
const commitRequirements = computed((): ReadonlyArray<CommitRequirement> => {
  const out: Array<CommitRequirement> = [];
  navItems.value.forEach((item, index) => {
    if (item.kind === 'branch') {
      // A branch row is a requirement only while nothing is selected — and
      // then it is THE first one (nothing below it is even decided yet).
      // A REFUSED branch is no question (nothing to answer there — the play
      // composer's rule): the cursor's first landing is a tile it can press.
      if (selectedPos.value === undefined && branches.value[item.pos]?.available === true) {
        out.push({index, verb: 'Choose an option', satisfied: false});
      }
      return;
    }
    if (item.kind === 'wild') {
      if (item.step !== undefined) {
        // A standalone «?» — answered once its own step captured a resource.
        out.push({index, verb: 'Choose a resource', satisfied: wildRowAnswerOf(item) !== undefined});
        return;
      }
      // The wild row is ONE requirement: the branch AND its answer, both chosen in its inner step.
      out.push({index, verb: 'Choose an option', satisfied: wildSpec.value !== undefined && wildComplete(wildSpec.value, wildParts.value)});
      return;
    }
    if (item.choice.repeatAction === true) {
      out.push({
        index, verb: 'Choose an action to repeat',
        satisfied: !choiceMissing(item.choice),
      });
      return;
    }
    out.push({
      index,
      verb: requirementVerb(item.choice),
      satisfied: !choiceMissing(item.choice),
    });
  });
  return out;
});
/**
 * THE ONE ANSWER to «may this be confirmed yet». Everything that has to
 * agree — the cursor ring, the Ⓐ glyph, the command bar's verb, the click
 * handler — reads THIS, so the screen cannot advertise an action it has
 * already decided to refuse.
 */
const commitGate = computed((): CommitGate => {
  return computeCommitGate({
    requirements: commitRequirements.value,
    submitting: submitting.value,
    // An unavailable branch is not a requirement: filling the fields under
    // it would change nothing, so the commit row carries the reason itself.
    // Same for a variant whose EVERY branch is refused — then there is not
    // even a branch to select, so the unanswered pick must not speak.
    unavailable: selectedBranch.value !== undefined && !selectedBranch.value.available ?
      branchReason(selectedBranch.value) :
      (variantBlockedReason.value ?? tradeEntryBlockedReason.value),
  });
});
/**
 * THIS BRANCH IS A COLONY TRADE — the card name whose payment path it
 * enters, from the server's own `colonyTrade` step. Structural: a note's
 * prose could never say WHICH path, and its text is translated in place.
 */
const tradeEntryCard = computed((): CardName | undefined => {
  return tradeEntryStep.value?.card || undefined;
});
/**
 * …the whole door: the payment path a CARD or a PARTY powers (Unity's free trade — «один фреймворк»), from the
 * server's own `colonyTrade` step. Exactly one of the two is set.
 */
const tradeEntryStep = computed((): {card: CardName | '', party: PartyName | ''} | undefined => {
  const step = selectedBranch.value?.steps.find((s) => s.kind === 'colonyTrade');
  if (step?.kind !== 'colonyTrade') {
    return undefined;
  }
  return step.party !== undefined ? {card: '', party: step.party} : {card: step.card, party: ''};
});
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
const navigationDeferred = computed((): boolean => {
  return props.repeatPickDisabled;
});
/** The door this confirm walks through, or none (plan / no such branch). */
const tradeEntryDoor = computed((): {card: CardName | '', party: PartyName | ''} | undefined => {
  return navigationDeferred.value ? undefined : tradeEntryStep.value;
});
const deltaEntryDoor = computed((): DeltaAdvanceOffer | undefined => {
  return navigationDeferred.value ? undefined : deltaEntryOffer.value;
});
/**
 * THIS BRANCH PLACES A DELEGATE — the server's own `delegateGrant` door (TR15 Martian Census: «3 data from
 * here → a delegate on a resolution»), classified by the ONE door reader the play composer uses
 * (`playDoorOf`). A plan does not walk through it (a repeat's copy is asked the resolution live).
 */
const voteEntryDoor = computed((): StagedVoteModel | undefined => {
  const door = navigationDeferred.value ? undefined : playDoorOf(selectedBranch.value);
  return door?.kind === 'parliament' ? door.staged : undefined;
});
// ── «THE LEDGER PAYS» (TR23 Habitat Science — «gain all your colony bonuses») ─────────────────────────────
/** The server's ledger of this branch — the frozen one past the press. */
const ledgerModel = computed((): AllColonyBonusesModel | undefined => {
  // A stage RESTORED mid-payout has no press of its own: the module record kept the ledger the player read
  // (a refetched preview of an action already performed is not that ledger).
  return ledgerFrozen.value ?? (ledgerPaying.value ? colonyBonusPayout.model : undefined) ?? selectedBranch.value?.colonyBonuses;
});
/** THIS composer's action is being paid (the module record names its card). OWNER only. */
const ledgerPaying = computed((): boolean => {
  return props.publishCommands && colonyBonusPayoutOf(sourceKey.value);
});
/**
 * THE SURFACE KEEPS ITS BOX WHILE THE LEDGER PAYS. The press folds the chosen target's card block into its
 * one-line receipt, and a plate that hugs its content would shrink and re-centre — moving the ledger, the very
 * rows the wave leaves from, in the frame the first chip is born. The height the surface had at the press is
 * its floor for the flow's life; the room the receipt gave back stays as air above the dock.
 */
const ledgerSurfaceStyle = computed((): Record<string, string> | undefined => {
  // THE SHEET IS AS TALL AS THE CARD (P73 · DC): the hero face's MEASURED height is published for the sheet's
  // floor (`console.less` § the configuration surface) — a number from the layout, never one written in CSS.
  const face: Record<string, string> = heroFaceHeight.value > 0 ? {'--con-setup-face-h': `${heroFaceHeight.value}px`} : {};
  return ledgerPaying.value && ledgerSurfaceHeight.value !== '' ? {...face, minHeight: ledgerSurfaceHeight.value} : face;
});
/**
 * …AND THE BODY KEEPS ITS BLOCK WHERE IT STOOD. The body centres a block that fits (P73 · DC iteration 2), so the
 * moment the press folds the chosen target into its one-line receipt the decision list shrinks and the CENTRED
 * block re-centres — the ledger (the wave's source) slid down 21 px at 4K in the frame the first chip was born
 * (CI 2026-11-01, `console-habitat-science`). The offset `safe center` gave the block at the press becomes a
 * padding, the alignment the top: the same picture, frozen for the flow's life.
 */
const ledgerBodyStyle = computed((): Record<string, string> | undefined => {
  return ledgerPaying.value && ledgerBodyPin.value !== '' ? {justifyContent: 'flex-start', paddingTop: ledgerBodyPin.value} : undefined;
});
/** Every row has paid (the read beat and after) — the dock reads «Выполнено». */
const ledgerSettled = computed((): boolean => {
  return ledgerPaying.value && (colonyBonusPayout.reading || colonyBonusPayout.done);
});
/**
 * THE COMMIT DOCK IS BUSY — the submit is in flight, or this action's ledger is paying. Past the press the
 * surface keeps EVERY block where it stood (the ledger is the wave's source and may not move a pixel; the
 * chosen target stays as its receipt), and the dock, in place, reads the flow: «Выполняется…» → «Выполнено».
 */
const ctaBusy = computed((): boolean => {
  return submitting.value || ledgerPaying.value;
});
/** `paying` (rows in turn) · `reading` (the receipt) · `done` — published on the root for the probes. */
const ledgerFlowStage = computed((): string => {
  return colonyBonusPayout.done ? 'done' : colonyBonusPayout.reading ? 'reading' : colonyBonusPayout.answered ? 'paying' : 'sent';
});
const ledgerDegraded = computed((): boolean => {
  return ledgerPaying.value && colonyBonusPayout.degraded;
});
const ledgerReading = computed((): ColonyLedgerReading | undefined => {
  const model = ledgerModel.value;
  if (model === undefined) {
    return undefined;
  }
  const context = !ledgerPaying.value ? 'preview' : (colonyBonusPayout.reading || colonyBonusPayout.done ? 'paid' : 'paying');
  return cardColonyLedgerOf(model, context);
});
const ledgerKicker = COLONY_LEDGER_KICKER;
/** The rows whose payout has LANDED — what a row reads «received» off (the touchdown, never the answer). */
const ledgerLanded = computed((): ReadonlySet<string> | undefined => {
  return ledgerPaying.value ? new Set(colonyBonusPayout.landed) : undefined;
});
const ledgerActiveColony = computed((): string | undefined => {
  return ledgerPaying.value && colonyBonusPayout.active !== '' ? colonyBonusPayout.active : undefined;
});
/** The walk stands on a row that hands cards over — its batch may present in this composer's draw layer. */
const ledgerDrawTurn = computed((): boolean => {
  if (!ledgerPaying.value) {
    return false;
  }
  const row = colonyBonusPayout.rows.find((r) => r.colony === colonyBonusPayout.active);
  return row !== undefined && (row.kind === 'draw' || row.kind === 'pairs') && row.state === 'paying';
});
/** The embedded take is ON SCREEN in the draw layer (the claim presents). */
const ledgerDrawOn = computed((): boolean => {
  return ledgerPaying.value && workspaceOutcomeState.host === 'card-actions' && workspaceOutcomeState.stage === 'presenting';
});
/**
 * The hand stands in the hand layer — Pluto's discard (`card-actions ⊃ hand`), or a PARTY action's mandatory
 * discard (Turmoil Redux «один фреймворк» — the Reds' «then discard 2»): the same layer of the decision column,
 * the same release of the surface under it.
 */
const ledgerHandOn = computed((): boolean => {
  return (ledgerPaying.value || politicalEntry.value !== undefined) && workspaceFrameHost('hand') === 'card-actions';
});
/** A STEP of the payout has the column: the ledger is parked under it (and comes back after it). */
const ledgerStepOn = computed((): boolean => {
  return ledgerDrawOn.value || ledgerHandOn.value;
});
/** A request is in flight — the next fact of the walk is on its way. */
const ledgerRequestInFlight = computed((): boolean => {
  return root?.isServerSideRequestInProgress === true;
});
/** Every fact the walk moves on, as ONE change key (its watcher needs a value, not an identity). */
const ledgerTick = computed((): string => {
  if (!ledgerPaying.value) {
    return '';
  }
  const rows = colonyBonusPayout.rows.map((r) => `${r.colony}:${r.state}:${r.ready ? 1 : 0}:${colonyBonusPayout.drawn[r.colony] ?? 0}:${ledgerUntaken(r.colony)}`).join(',');
  const wf = props.playerView.waitingFor;
  return [
    colonyBonusPayout.answered ? 'a' : '-', colonyBonusPayout.flying ? 'f' : '-', colonyBonusPayout.reading ? 'r' : '-',
    colonyBonusPayout.done ? 'd' : '-', ledgerStepOn.value ? 's' : '-', ledgerRequestInFlight.value ? 'q' : '-',
    wf?.type ?? '', wf?.discardPrompt?.colonyRepeat?.index ?? '', props.playerView.game.gameAge, rows,
  ].join('|');
});
/**
 * THE PARLIAMENT STANDS IN THIS COMPOSER — a vote step of THIS action, hosted in the decision column's own
 * layer (`[data-embed-slot="action-parliament"]`): the staged door's vote mode, or the live grant the server
 * raised for this card. OWNER only: the nested repeat-pick instance never hosts.
 */
const parliamentStepOn = computed((): boolean => {
  return props.publishCommands && workspaceFrameHost('parliament') === 'card-actions';
});
/** A pick from the HAND stands as a step of this workspace — the album, on the whole stage (`__handzone`). */
const handStageStepOn = computed((): boolean => {
  return props.publishCommands && workspaceFrameHost('hand') === 'card-actions';
});
/** A FULL-STAGE step stands (the Parliament, the hand): the hero and the setup let go and park under it. */
const stageStepOn = computed((): boolean => {
  return parliamentStepOn.value || handStageStepOn.value;
});
/** The staged ACTION vote of THIS card is past its commit (the mode's A was pressed, the batch is on the wire). */
const stagedVoteCommitMine = computed((): boolean => {
  const arm = stagedPlayState.arm;
  return stagedPlayState.committing && arm?.flow === 'action' && arm.cardName === sourceKey.value &&
    stagedVoteOf(arm) !== undefined;
});
/**
 * THE DELEGATE HAS LEFT THE RESERVE — the vote mode's landing has started and the cube is no longer standing
 * on the bench (`sourceLeavingCount` falls on the flight's departure, or at once when nothing can fly). The
 * card's data are the price paid WITH that cube, so the capsule drops on this edge.
 */
const stagedVoteCubeGone = computed((): boolean => {
  return parliamentFlow.stage === 'landed' && parliamentFlow.sourceLeavingCount === 0;
});
/**
 * THE PRICE HAS LEFT THE CARD — the frame the capsule's count may drop (PL-100): the price token's visible
 * departure from the capsule when the Parliament flies one (a card-resource receipt — data, a mech, a fighter),
 * else the cube's lift-off as before (a play's M€ door, reduced motion, nothing measurable).
 */
const stagedVotePriceGone = computed((): boolean => {
  const stage = parliamentFlow.priceStage;
  if (stage !== 'none') {
    return stage === 'departed' || stage === 'landed';
  }
  return stagedVoteCubeGone.value;
});
/** The live trade prompt this branch would enter (server-authoritative). */
const tradeEntryContext = computed((): TradeColonyContext | undefined => {
  return tradeEntryStep.value === undefined ?
    undefined : findTradeColonyContext(props.playerView.waitingFor);
});
/**
 * Why the walk cannot start — always the SERVER's own words. The branch may
 * be available while the payment path itself is refused (the card's action
 * spent, no floaters left), and the trade prompt states that per option; a
 * missing prompt entirely means the trade is not on the table at all.
 */
const tradeEntryBlockedReason = computed((): string | undefined => {
  // A DEFERRED door is not a requirement: there is nothing to be blocked
  // ON. Asking the live `waitingFor` for a trade while planning a repeat
  // is asking about a prompt that cannot exist yet, and its honest «no»
  // then refused the plan's own confirm — the «Летающая платформа» dead end.
  const door = tradeEntryDoor.value;
  if (door === undefined) {
    return undefined;
  }
  const ctx = tradeEntryContext.value;
  if (ctx === undefined) {
    return translateText('Trading is not available right now');
  }
  if (lockedTradePaymentIndex(ctx.paymentOptions, door.card, door.party) >= 0) {
    return undefined;
  }
  const reason = lockedTradePaymentReason(ctx.disabledPayments, door.card, door.party);
  return reason !== undefined ? textOf(reason) : translateText('Trading is not available right now');
});
/**
 * THIS BRANCH IS A HYDRONETWORK MOVE — the server's own description of it,
 * from the branch's `deltaAdvance` step. Structural, exactly like
 * `tradeEntryCard`: a note's prose could never carry the destination, and
 * its text is translated in place.
 */
const deltaEntryOffer = computed((): DeltaAdvanceOffer | undefined => {
  const step = selectedBranch.value?.steps.find((s) => s.kind === 'deltaAdvance');
  return step?.kind === 'deltaAdvance' ? step.offer : undefined;
});
const ctaIndex = computed((): number => {
  return navItems.value.length;
});
/** The last cursor stop. The commit row DROPS OUT of the ring while a
 *  requirement is waiting — that is what keeps focus off a row whose A
 *  would do nothing. */
const navMaxIndex = computed((): number => {
  return commitAcceptsCursor(commitGate.value) ? ctaIndex.value : Math.max(0, ctaIndex.value - 1);
});
const ctaFocused = computed((): boolean => {
  return sub.value === undefined && focusIdx.value >= ctaIndex.value;
});
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
const selfTargetPresent = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.present;
});
const selfTargetFocused = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.focused;
});
/** The source card is the CONFIRMED target. */
/**
 * The commit's rail half in the air for THIS card — the link flying now («0» the landing, «1» the two leaving,
 * «2» the TR for TR28; the phase — «seeded» / «flying» — before and between links) — a reading for the probe,
 * undefined when no half stands.
 */
const commitRailLink = computed((): string | undefined => {
  if (actionCommitRailState.card !== sourceKey.value || actionCommitRailState.phase === 'idle') {
    return undefined;
  }
  return actionCommitRailState.link >= 0 ? String(actionCommitRailState.link) : actionCommitRailState.phase;
});
const selfTargetLocked = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.locked;
});
/** May A run the commit right now? The ONE execution guard. */
const commitReady = computed((): boolean => {
  return commitAllowed(commitGate.value);
});
/** The gate's WORD alone — the watcher re-seats the cursor on transitions
 *  (a branch switch, a target going stale), not on every recompute. */
const commitGateKind = computed((): string => {
  return commitGate.value.kind;
});
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
const commitVerbKey = computed((): string => {
  if (tradeEntryDoor.value !== undefined) {
    return 'Choose a colony';
  }
  // A VOTE door (TR15): «Выбрать резолюцию» — the play door's own verb (`playCommitVerb`), one classification.
  if (voteEntryDoor.value !== undefined) {
    return playCommitVerb({kind: 'parliament', staged: voteEntryDoor.value, mode: 'vote'});
  }
  // Nor does an advance branch: the destination, its requirements and its
  // reward are studied ON the track, and the one confirm is there.
  return deltaEntryDoor.value !== undefined ? 'Open the Hydronetwork' : props.commitLabel;
});
const ctaDockLabel = computed((): string => {
  if (!payExpanded.value) {
    return commitVerbKey.value;
  }
  return paymentView.value?.status.ok === true ? 'Done' : 'Not enough resources';
});
const ctaDockReady = computed((): boolean => {
  return payExpanded.value ? paymentView.value?.status.ok === true : canConfirm.value;
});
const ctaDockHint = computed((): string => {
  return payExpanded.value ? '' : ctaHint.value;
});

/**
 * The hero CARD where only a card can stand (the repeat pick's / a Hydronetwork pick's / the hand album's source):
 * those steps are a card's alone — a political source's preview never asks them — so reaching one without a card
 * is a broken invariant, said out loud, never a stand-in name.
 */
/**
 * The OPERATION a hand pick belongs to (the album names it): a card's action — the card; an enacted LAW's (Open IP
 * Trade's «sell any number of cards») — the law's printed name with its resolution (L3 opens the law's inspector);
 * a party's — nothing to name (no party action picks from the hand). Never `cardOrThrow`: a law has no card, and the
 * throw swallowed A on the law's pick row whole (the box's openip probe).
 */
function handPickSource(): {kicker: string, card: CardName, resolution?: ResolutionId} | undefined {
  const name = heroCardName.value;
  if (name !== undefined) {
    return {kicker: 'Action setup', card: name};
  }
  const law = politicalEntry.value?.source.kind === 'law' ? politicalEntry.value.source.resolution : undefined;
  return law === undefined ? undefined : {kicker: 'Action setup', card: (lawNameKey.value ?? law) as CardName, resolution: law};
}
function cardOrThrow(): CardName {
  const name = heroCardName.value;
  if (name === undefined) {
    throw new Error(`${sourceKey.value}: a political action asked a step only a card has`);
  }
  return name;
}
/**
 * THE PAYOUT OF A PARTY DISCARD (Turmoil Redux «один фреймворк» — the Reds' «2 M€ per plant, microbe and animal
 * tag»): every token the transport held (`discardExchangeBeat.ts`, the rate × the thrown cards' printed tags,
 * checked against the views) is born on the PRINTED M€ icon of the plaque standing in the hero slot and lands on
 * its rail row, the row ticking on the touchdown. Resolves once every row has ticked — at once when nothing was
 * held (no paying tag: the server's journal names the skip).
 */
function flyDiscardExchange(): Promise<void> {
  const key = discardExchangeRailKey(sourceKey.value);
  if (!railRewardPending(key)) {
    return Promise.resolve();
  }
  const root = rootEl.value ?? undefined;
  const wrap = root?.querySelector<HTMLElement>('.con-composer__actcardwrap') ?? undefined;
  const anchors = wrap !== undefined ? resolveActionCommitAnchors(wrap, props.actionGraphicNode) : undefined;
  return flyRailReward(key, (spec) => (anchors === undefined ? undefined : resolveGainIconEnds(anchors, [spec])[0])).then(() => undefined);
}
/** The «↳» reaction chips drawn INSIDE a branch option card. */
function variantReactions(pos: number): VariantReaction {
  return variantReactionChips(forecast.value, pos);
}
/** R3 / a click on the «Сработает» row — the WORKSPACE DESCEND into the
 *  layer (the row's rect armed SYNCHRONOUSLY; the seats' stats asked). */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  const root = rootEl.value ?? undefined;
  armForecastRow(descendRectOf(root?.querySelector<HTMLElement>('[data-forecast-row]')));
  forecastPulse.value = true;
  flow.after(320, 'the forecast row\'s commit pulse ends', () => {
    forecastPulse.value = false;
  });
  for (const color of forecastOwnerColors.value) {
    ensureEffectStats(props.playerView, color as Color);
  }
  openEffectForecastLayer('action');
}
function closeForecastLayer(): void {
  if (fxOpen.value) {
    closeEffectForecastLayer('action');
  }
}
/** Input while the layer is open: B folds one level (the explorer's
 *  dossier first), R3 closes the whole layer, the rest is the explorer's. */
function onForecastIntent(intent: GamepadIntent): void {
  const explorer = forecastExplorer.value ?? undefined;
  if (intent.kind === 'press' && intent.button === 'stickR') {
    closeForecastLayer();
    return;
  }
  if (intent.kind === 'press' && consoleActionOf(intent) === 'back') {
    if (explorer?.consumeEffectsBack() !== true) {
      closeForecastLayer();
    }
    return;
  }
  explorer?.handleIntent(intent);
}
function iconClass(icon: string | undefined): string {
  return icon !== undefined ? iconClassFor(icon) : '';
}
/** The rule chip's label + the shared sentence formatter — ONE wording
 *  source with the browser and the fullscreen rules tab. */
function ruleLabel(kind: 'rule' | 'note'): string {
  return ACTION_RULE_LABEL[kind];
}
function ruleText(key: string): string {
  // The branch TITLE standing in as the rule (a political source has no card information — RX36's «Pay ${0} M€ to
  // play a card…»): a Message carries its params, so it is printed WITH them (PL-160), never as its bare key.
  const title = selectedBranch.value?.title;
  if (title !== undefined && typeof title !== 'string' && title.message === key) {
    return translateMessage(title);
  }
  return actionRuleText(key);
}
function branchAt(pos: number): ActionPreviewBranch {
  return branches.value[pos];
}
function branchTitle(b: ActionPreviewBranch): string {
  // A title carrying its params (a Message — «Add ${0} ${1} to a card») is rendered WITH them (PL-160).
  if (typeof b.title !== 'string') {
    return textOf(b.title);
  }
  const raw = branchTitleText(b);
  return raw !== '' ? translateText(raw) : '';
}
function branchReason(b: ActionPreviewBranch): string {
  if (b.unavailableReason === undefined) {
    return translateText('Unavailable right now');
  }
  // …through the SHARED rule, so this surface, its browse tile and the
  // Hydronetwork plan panel can never name the missing tag differently.
  return textOf(b.unavailableReason,
    reasonParams(b.unavailableReasonParams, b.unavailableReasonTag));
}
function rangeText(vc: ConsoleVariableChip): string {
  const unit = vc.unit ?? '';
  return vc.min === vc.max ? `${vc.min}${unit}` : `${vc.min}–${vc.max}${unit}`;
}
/** The premium view of ONE branch (chips + variable ranges + a named
 *  non-chip requirement) — never a mute variant. */
function branchView(pos: number): BranchView {
  const b = branches.value[pos];
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
      const pick = b.steps.find((s) => s.kind === 'input' && s.input.type === 'card');
      needs = translateText(cardPickAskKey(pick?.kind === 'input' ? pick.amount : undefined, pick?.kind === 'input' && isDiscardPick(pick.input)));
    } else if (b.optionInput?.type === 'player' || b.steps.some((s) => s.kind === 'input' && s.input.type === 'player')) {
      needs = translateText('Choose a player');
    }
  }
  return {cost, gain, variableCost: variable.cost, variableGain: variable.gain, variableChoice: variable.choice, empty: !hasChips && needs === '', needs};
}
/** The price chips THIS variant card prints — none when the price is every variant's (`commonCost`). */
function branchCostShown(pos: number): ReadonlyArray<ActionEffect> {
  return commonCost.value.length > 0 ? [] : branchView(pos).cost;
}
/** The good THIS variant card prints — none when the good is every variant's (`commonGain`, TR58). */
function branchGainShown(pos: number): ReadonlyArray<ActionEffect> {
  return commonGain.value.length > 0 ? [] : branchView(pos).gain;
}
function branchHasBothSides(pos: number): boolean {
  const v = branchView(pos);
  const c = branchCostShown(pos).length + v.variableCost.length > 0;
  const g = branchGainShown(pos).length + v.variableGain.length > 0;
  return c && g;
}
function playerName(color: string): string {
  // The Automa seat localizes to «Бот»; never leak the raw «MarsBot» name.
  return displayNameForColor(props.playerView.players, color as Color);
}
function choiceTitle(c: ComposerChoice): string {
  // A step asked BY A COLONY (a card paying «all your colony bonuses» — one pick per cube) names its TILE,
  // «КОЛОНИЯ · Титан»: the prompt's title («Add resource to this card») is the same sentence for every tile,
  // and the ledger above lists them by name. The source is the step's own structural marker
  // (`choiceContext`, the one the live question would carry) — read through the ONE source model.
  const colony = colonyAskerOf(c);
  if (colony !== '') {
    return colony;
  }
  // AN OPTIONAL CHOICE WHOSE ONE ANSWER IS A PICK IS THAT PICK (`optionalPickInputOf`): its row carries the
  // pick's own title, ahead of the `or` input's own (an `OrOptions` always carries the generic «Select one
  // option») — TR44's «may add 1 data to any card» printed «Выберите вариант» over a row that is a card pick.
  const pick = optionalPickInputOf(c.input);
  const pickTitle = pick !== undefined ? textOf(pick.title) : '';
  if (pickTitle !== '') {
    return pickTitle;
  }
  const t = textOf(c.input.title);
  if (t !== '') {
    return t;
  }
  return translateText(c.kind === 'or' ? optionalPickVerb(c) : (CHOICE_KIND_LABEL[c.kind] ?? 'Choose an option'));
}
/** «Колония · Титан» — a step asked BY A COLONY (its `choiceContext` source), else ''. */
function colonyAskerOf(c: ComposerChoice): string {
  const source = choiceSourceView(c.input.choiceContext?.source);
  if (source !== undefined && source.kindKey === 'Colony' && typeof source.name === 'string' && source.name !== '') {
    return `${translateText(source.kindKey)} · ${translateText(source.name)}`;
  }
  return '';
}
/** The verb of an `or` choice: its one pick's ask when the choice IS a pick, else «Choose an option». */
function optionalPickVerb(c: ComposerChoice): string {
  const pick = optionalPickInputOf(c.input);
  if (pick?.type === 'card') {
    return cardPickAskKey(c.amount, isDiscardPick(pick));
  }
  if (pick?.type === 'player') {
    return 'Choose a player';
  }
  return 'Choose an option';
}
function pickPlaceholder(c: ComposerChoice): string {
  if (c.repeatAction === true) {
    return translateText('Choose an action to repeat');
  }
  if (c.kind === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
    return translateText('Pick cards from hand');
  }
  return translateText(c.kind === 'card' ? cardPickAskKey(c.amount, isDiscardPick(c.input)) : c.kind === 'player' ? 'Choose a player' : optionalPickVerb(c));
}
function choiceMissing(c: ComposerChoice): boolean {
  // The pre-selected Venus bonus (P89 · EL / EM): answered once its ONE answer exists (wild, card, the spread exact).
  if (c.kind === 'venusBonus') {
    const meta = venusBonusMetaOf(c.input);
    return meta === undefined || venusPreselectResponse(meta, venusPartsOf(c)) === undefined;
  }
  if (c.repeatAction === true) {
    // The nested read-only slot is never «missing» — it resolves post-submit.
    return !props.repeatPickDisabled && repeatResult.value === undefined;
  }
  if (c.scope === 'option') {
    return c.index >= 0 ? capturedOptionParts.value[c.index] === undefined : capturedOption.value === undefined;
  }
  return c.scope === 'pre' ? capturedPre.value[c.index] === undefined : captured.value[c.index] === undefined;
}
// ── premium sub-list items ──────────────────────────────────────────
function cardListItem(c: ComposerChoice, card: CardModel, chosen: boolean, disabled: boolean): ListItem {
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
}
function playerListItem(model: SelectPlayerModel, color: string, chosen: boolean, disabled: boolean, reason: string | Message | undefined): ListItem {
  // SERVER impacts first, then the shared derivation — hand-rolling the
  // field name here printed NOTHING for M€ / plants production (the model's
  // fields are singular) and the wrong numbers for a MarsBot target.
  const rows = targetImpactRows(color as Color, {
    impacts: model.targetImpacts,
    icon: model.icon,
    amount: model.amount,
    scope: model.scope,
    player: props.playerView.players.find((pl) => pl.color === color),
  });
  const impact = targetImpactText(rows);
  return {
    // «Это вы» — a warning only when it is a LOSS and somebody else could
    // have taken it instead. Alone in the list it is a forced move, not a
    // mistake, and the card already warns about that case before play.
    selfHarm: color === thisPlayer.value.color && !disabled &&
      targetImpactIsLoss(rows) && model.players.length > 1,
    key: (disabled ? 'd' : '') + color,
    label: playerName(color),
    resIcon: disabled ? '' : (model.icon ?? ''),
    resCount: 0,
    impact,
    disabled,
    reason: textOf(reason),
    chosen,
    color,
  };
}
// ── reset / defaults ────────────────────────────────────────────────
function resetFromPreview(): void {
  capturedPre.value = {};
  captured.value = {};
  venusParts.value = {};
  capturedOption.value = undefined;
  capturedOptionParts.value = {};
  amounts.value = {};
  floaters.value = {};
  payCounts.value = {};
  picks.value = {};
  multiPicks.value = {};
  orDescents.value = {};
  repeatResult.value = undefined;
  sub.value = undefined;
  focusIdx.value = 0;
  submitting.value = false;
  seeded.value = {};
  // MAY a choice be seeded at all — ONE rule, shared with the play composer
  // (`initialVariantSelection`): a single option, or exactly one the RULES
  // allow; a real question opens unanswered. This screen and the play
  // screen had the same rule written twice, and «two copies of one rule»
  // is how the payment unit labels drifted apart before them.
  const positionsNow = positions.value;
  const seed = initialVariantSelection(positionsNow.map((p) => branches.value[p] ?? {available: false}));
  selectedPos.value = seed === undefined ? undefined : positionsNow[seed];
  // Focus the first AVAILABLE branch (or the first item) so the player
  // starts on a meaningful choice, not the top of a list.
  if (needBranchRow.value) {
    const firstAvail = navItems.value.findIndex((it) => it.kind === 'branch' && branches.value[it.pos]?.available === true);
    focusIdx.value = firstAvail >= 0 ? firstAvail : 0;
  }
  seedDefaults();
  // STAGED return (B from the board): the player's own captures beat the
  // fresh seeding — same card, same variant, same answers, same focus.
  // One-shot by contract; nothing was submitted in between, so the preview
  // (version-cached) and the choice ids are the same shape.
  applyStagedComposerSnapshot();
  // …and then the ONE cursor rule has the last word (T14 · CC — `nextCursorAfterAnswer`): a requirement already
  // waiting holds the cursor; a screen with nothing left to ask opens ON the commit — an ARRIVAL with the
  // decision's first settle under it (the A that opened the composer never runs the action). Decided NOW, before
  // the first render (TR58): re-seated a tick later, the cursor stood on one row and moved to another while the
  // composer entered. The tick only scrolls to it (and re-asks — idempotent). A staged return lands where the
  // player left (its snapshot), and arrives again only when that is the commit row.
  if (stagedRestored.value) {
    stagedRestored.value = false;
    if (focusIdx.value >= ctaIndex.value && commitAllowed(commitGate.value)) {
      arriveAtCommitRow(true);
    }
  } else {
    landCursor({opening: true});
  }
  void nextTick(() => syncCommitFocus());
}
/**
 * WHERE THE CURSOR GOES — the ONE rule (`nextCursorAfterAnswer`, T14 · ledger CC), asked on open and after EVERY
 * answer: the first row that holds the commit, else the commit row (a refused action keeps its reason there).
 */
function cursorLanding(): CursorLanding | undefined {
  return nextCursorAfterAnswer(commitGate.value, ctaIndex.value);
}
/**
 * LAND THE CURSOR by the rule — the ONE call every answer ends with (a pick from a list, the album or the table, a
 * variant, «Далее», the payment's «Готово», a decline, a bridge's answer) and the open's. A landing on a commit
 * that RUNS is an ARRIVAL (`commitArrival.ts`): the pose arrives, the row breathes once, a press inside its window
 * is the arrival, not the action. Never `focusIdx = ctaIndex` by hand.
 */
function landCursor(opts: {opening?: boolean} = {}): void {
  const landing = cursorLanding();
  if (landing === undefined) {
    return;
  }
  const from = focusIdx.value;
  focusIdx.value = landing.index;
  if (landing.kind !== 'commit') {
    leaveCommit(commitArrival.value);
  } else if (opts.opening === true || from !== landing.index || commitArrival.value.arrival === undefined) {
    arriveAtCommitRow(opts.opening === true);
  }
}
/** The commit row's arrival, measured against the root the gate may stand on once it has rendered. */
function arriveAtCommitRow(opening: boolean): void {
  arriveAtCommit(commitArrival.value, () => rootEl.value ?? undefined, {opening});
}
/** The commit row's one breath ended (its layer's `animationend` — never a child's animation bubbling up). */
function onCommitBreathEnd(e: AnimationEvent): void {
  if (e.animationName === 'con-commit-armed') {
    endCommitBreath(commitArrival.value);
  }
}
/** The staged-return capture snapshot — written at the staged confirm,
 *  applied back by `applyStagedComposerSnapshot`. Opaque outside this
 *  component (no inverse wire mapping exists to drift). */
function stagedComposerSnapshot(): unknown {
  return {
    selectedPos: selectedPos.value,
    capturedPre: {...capturedPre.value},
    capturedOption: capturedOption.value,
    capturedOptionParts: {...capturedOptionParts.value},
    captured: {...captured.value},
    amounts: {...amounts.value},
    floaters: {...floaters.value},
    payCounts: JSON.parse(JSON.stringify(payCounts.value)) as Record<string, Partial<Record<SpendableResource, number>>>,
    picks: {...picks.value},
    multiPicks: {...multiPicks.value},
    orDescents: {...orDescents.value},
    seeded: {...seeded.value},
    focusIdx: focusIdx.value,
  };
}
function applyStagedComposerSnapshot(): void {
  const snap = takeStagedActionComposerDraft(sourceKey.value, props.nodeIndex) as {
    selectedPos: number | undefined,
    capturedPre: Record<number, unknown>,
    capturedOption: unknown,
    capturedOptionParts?: Record<number, unknown>,
    captured: Record<number, unknown>,
    amounts: Record<string, number>,
    floaters: Record<string, number>,
    payCounts: Record<string, Partial<Record<SpendableResource, number>>>,
    picks: Record<string, string>,
    multiPicks: Record<string, ReadonlyArray<string>>,
    orDescents: Record<string, {item: ConsoleOrItem, pick: string}>,
    seeded?: Record<string, 'sole'>,
    focusIdx: number,
  } | undefined;
  if (snap === undefined) {
    return;
  }
  selectedPos.value = snap.selectedPos;
  capturedPre.value = {...snap.capturedPre};
  capturedOption.value = snap.capturedOption;
  capturedOptionParts.value = {...(snap.capturedOptionParts ?? {})};
  captured.value = {...snap.captured};
  amounts.value = {...snap.amounts};
  floaters.value = {...snap.floaters};
  payCounts.value = {...snap.payCounts};
  picks.value = {...snap.picks};
  multiPicks.value = {...snap.multiPicks};
  orDescents.value = {...snap.orDescents};
  seeded.value = {...(snap.seeded ?? {})};
  focusIdx.value = snap.focusIdx;
  stagedRestored.value = true;
}
function seedDefaults(): void {
  for (const c of allChoices.value) {
    seedChoice(c);
  }
}
function seedChoice(c: ComposerChoice): void {
  // A LAW'S PLAY SLOT comes back with its stage (RX36 — a remount after B out of a staged cell, a park): the play
  // the player composed is kept OUTSIDE the stage (`rememberLawPlay`) and re-seated here.
  if (c.kind === 'lawPlay') {
    const step = selectedBranch.value?.steps[c.index];
    const kept = step?.kind === 'lawPlay' ? lawPlayDraftOf(step.resolution) : undefined;
    if (kept !== undefined && captured.value[c.index] === undefined) {
      captureFor(c, kept);
    }
    return;
  }
  if (c.kind === 'amount') {
    const m = amountModel(c);
    const def = m.maxByDefault ? m.max : m.min;
    amounts.value[c.id] = def;
    captureFor(c, {type: 'amount', amount: def});
  } else if (c.kind === 'spendHeat') {
    const plan = spendHeatPlan(c.input);
    if (plan !== undefined) {
      floaters.value[c.id] = plan.minFloaters;
      captureFor(c, spendHeatResponse(plan, plan.minFloaters));
    }
  } else if (c.kind === 'payment') {
    const model = c.input as SelectPaymentModel;
    const lanes = paymentLanes(model, thisPlayer.value);
    const mc = megacreditsAvailable(thisPlayer.value);
    const counts = initialCounts(model.amount, lanes, mc);
    payCounts.value[c.id] = counts;
    if (paymentCovers(model.amount, lanes, counts, mc)) {
      captureFor(c, {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mc)});
    }
  }
  // A card / player TARGET with ONE enabled candidate is SEEDED with it (T14 · CC, `soleCandidateOf`): shown
  // answered — where the resource goes, its `current → resulting` — and marked; A on the row still opens the
  // choice. A real choice (two candidates, an optional one, a range, a disabled lone one) opens unanswered.
  seedSole(c);
}
/**
 * SEED a sole candidate — the same capture a press would write (`confirmPlayedTarget` / `pickListItem` / the
 * album's answer), plus the `seeded` mark. Never over an answer already given.
 */
function seedSole(c: ComposerChoice): void {
  if (!choiceMissing(c) || (c.input.type !== 'card' && c.input.type !== 'player' && c.input.type !== 'or')) {
    return;
  }
  const seed = soleCandidateOf(c, soleViewer.value);
  if (seed === undefined) {
    return;
  }
  if (seed.kind === 'tableBot') {
    // The bot alone in the table's one zone — its branch answered, the row marked «единственная цель».
    picks.value = {...picks.value, [c.id]: soleSeedPick(seed)};
    captureFor(c, soleSeedResponse(seed));
  } else if (seed.kind === 'optionalCard') {
    // «You MAY also add 1 data to ANY card» with ONE holder: the pick branch answered with it — the same capture the
    // target step's A writes (`confirmPlayedTarget` → `answerNestedOr`); RT still declines.
    if (!seedOptionalCard(c, seed)) {
      return;
    }
  } else if (seed.kind === 'player') {
    picks.value = {...picks.value, [c.id]: seed.color};
    captureFor(c, {type: 'player', player: seed.color});
  } else {
    if (isPlayedTargetChoice(c)) {
      const owners = playedTargetModelFor(c)?.owners ?? [];
      const focus = findPlayedTargetFocus(seed.name, owners);
      const candidate = focus === undefined ? undefined : playedTargetAt(focus, owners);
      if (candidate === undefined || candidate.blocked !== undefined) {
        return;
      }
      playedTargetResults.value = {...playedTargetResults.value, [c.id]: playedTargetResultOf(candidate, owners, playedTargetVersion.value)};
    }
    picks.value = {...picks.value, [c.id]: seed.name};
    captureFor(c, {type: 'card', cards: [seed.name]});
  }
  seeded.value = {...seeded.value, [c.id]: 'sole'};
}
/**
 * The optional pick's seed — the nested branch answered with the lone holder, its target result read off the SAME
 * step model the target step draws (the descent is recorded first: the model reads the branch's own input). `false`
 * = the candidate is not drawable or stands refused — nothing is written.
 */
function seedOptionalCard(c: ComposerChoice, seed: Extract<SoleSeed, {kind: 'optionalCard'}>): boolean {
  const item = optionalPickItem(c);
  if (item === undefined || item.optionIndex !== seed.branch) {
    return false;
  }
  const before = orDescents.value;
  orDescents.value = {...orDescents.value, [c.id]: {item, pick: seed.name}};
  const owners = playedTargetModelFor(c)?.owners ?? [];
  const focus = findPlayedTargetFocus(seed.name, owners);
  const candidate = focus === undefined ? undefined : playedTargetAt(focus, owners);
  if (candidate?.blocked !== undefined) {
    orDescents.value = before;
    return false;
  }
  if (candidate !== undefined) {
    playedTargetResults.value = {...playedTargetResults.value, [c.id]: playedTargetResultOf(candidate, owners, playedTargetVersion.value)};
  }
  picks.value = {...picks.value, [c.id]: soleSeedPick(seed)};
  captureFor(c, soleSeedResponse(seed));
  return true;
}
/** Does the row still hold exactly what its seed wrote? (An optional pick names its card in the descent.) */
function seedHolds(c: ComposerChoice, seed: SoleSeed): boolean {
  return soleSeedPick(seed) === picks.value[c.id] && (seed.kind !== 'optionalCard' || orDescents.value[c.id]?.pick === seed.name);
}
/** The mark of a seeded row (i18n keys) — `undefined` when the row was not seeded or no longer holds its seed. */
function soleMark(c: ComposerChoice): {mark: string, hint: string} | undefined {
  if (seeded.value[c.id] !== 'sole' || choiceMissing(c)) {
    return undefined;
  }
  const seed = soleCandidateOf(c, soleViewer.value);
  return seed === undefined || !seedHolds(c, seed) ? undefined : soleMarkKeys(seed, isHandPickChoice(c));
}
/**
 * A refetched preview of the SAME shape keeps every answer — but a SEED is a reading of the server's candidate set
 * (T14 · CC): a seed whose candidate left, or is no longer alone, lets go (the row is open again and holds the
 * commit — the ONE rule sends the cursor to it); a row that has just become a sole candidate is seeded. Never
 * touches an answer the player gave.
 */
function reseatSeeds(): void {
  let changed = false;
  for (const c of allChoices.value) {
    if (seeded.value[c.id] !== 'sole') {
      continue;
    }
    const seed = soleCandidateOf(c, soleViewer.value);
    if (seed !== undefined && seedHolds(c, seed)) {
      continue;
    }
    captureFor(c, undefined);
    const {[c.id]: _descent, ...descents} = orDescents.value;
    orDescents.value = descents;
    const {[c.id]: _pick, ...picksNow} = picks.value;
    const {[c.id]: _result, ...results} = playedTargetResults.value;
    const {[c.id]: _seed, ...seededNow} = seeded.value;
    picks.value = picksNow;
    playedTargetResults.value = results;
    seeded.value = seededNow;
    changed = true;
  }
  const before = Object.keys(seeded.value).length;
  for (const c of allChoices.value) {
    seedSole(c);
  }
  if (changed || Object.keys(seeded.value).length !== before) {
    landCursor();
    scrollFocused();
  }
}
/** Is this RENDERED row the focused one? Identity-based, because the render
 *  list and the nav list differ (a focus-free dial renders but never focuses). */
function isFocused(item: Item): boolean {
  return sub.value === undefined && focusedItem.value?.id === item.id;
}
function captureFor(c: ComposerChoice, response: unknown | undefined): void {
  if (c.scope === 'pre') {
    if (response === undefined) {
      delete capturedPre.value[c.index];
    } else {
      capturedPre.value[c.index] = response;
    }
  } else if (c.scope === 'option' && c.index >= 0) {
    // One PART of a two-part option: the branch's answer is the composed `and`, standing only once every part does.
    const parts = {...capturedOptionParts.value};
    if (response === undefined) {
      delete parts[c.index];
    } else {
      parts[c.index] = response;
    }
    capturedOptionParts.value = parts;
    capturedOption.value = composeAndResponse(selectedBranch.value?.optionInput, parts);
  } else if (c.scope === 'option') {
    capturedOption.value = response;
  } else if (response === undefined) {
    delete captured.value[c.index];
  } else {
    captured.value[c.index] = response;
  }
}
// ── live synthetic hero chips ───────────────────────────────────────
function syntheticCost(c: ComposerChoice): Array<ActionEffect> {
  if (c.kind === 'amount') {
    const m = amountModel(c);
    const chosen = amountFor(c.id);
    // The INVERSE dial (it counts what is RECEIVED — Energy Market's energy):
    // the price is `perUnit` of ANOTHER pool, and it is the only statement of
    // what confirming costs, so it wins over the dial's own icon.
    if (m.amountCost !== undefined) {
      const spent = chosen * (m.amountCost.perUnit ?? 1);
      const pool = poolOf(m.amountCost.icon, m.amountCost.scope);
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
      const stock = poolOf(icon, m.conversion?.fromScope);
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
    const floaters = floatersFor(c.id);
    const stock = spendHeatStock(plan, floaters);
    const heat = poolOf('heat');
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
}
function syntheticGain(c: ComposerChoice): Array<ActionEffect> {
  if (c.kind !== 'amount') {
    return [];
  }
  const m = amountModel(c);
  const chosen = amountFor(c.id);
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
    const pool = poolOf(m.icon);
    return [{direction: 'gain', icon: m.icon, amount: chosen, current: pool, resulting: pool !== undefined ? pool + chosen : undefined, unit: m.unit}];
  }
  return [];
}
// ── amount helpers ──────────────────────────────────────────────────
function amountModel(c: ComposerChoice): SelectAmountModel {
  return c.input as SelectAmountModel;
}
function amountFor(id: string): number {
  return amounts.value[id] ?? 0;
}
function amountIcon(c: ComposerChoice): string | undefined {
  const m = amountModel(c);
  return m.icon ?? m.conversion?.from;
}
function setAmount(c: ComposerChoice, value: number): void {
  const m = amountModel(c);
  const clamped = Math.min(m.max, Math.max(m.min, value));
  amounts.value[c.id] = clamped;
  captureFor(c, {type: 'amount', amount: clamped});
}
function amountResultLine(c: ComposerChoice): string {
  const m = amountModel(c);
  const chosen = amountFor(c.id);
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
}
function amountStockLine(c: ComposerChoice): string {
  const stock = poolOf(amountIcon(c));
  return stock !== undefined ? `${translateText('In stock')}: ${stock}` : '';
}
/**
 * The premium two-sided OPERATION for this dial (spend → receive with
 * `current → after` on both sides) — the SHARED derivation the standalone
 * prompt uses. The pool reader is this composer's own `poolOf`, so a dial
 * spending the source card's stored floaters/microbes (Titan Shuttles,
 * Sulphur Eating Bacteria) previews the card's own count.
 */
function amountOperation(c: ComposerChoice): ConversionPromptVm | undefined {
  return amountOperationVm(amountModel(c), amountFor(c.id),
    (icon, scope) => poolOf(icon, scope));
}
/**
 * The CURRENT value of the pool an amount chip touches — the viewer's stock or
 * production for a standard resource, and the SOURCE CARD's own count for a
 * card resource (floaters/microbes stored here), which is where a "remove X
 * from this card" dial takes them from. `undefined` = no single pool to show,
 * and the chip degrades to a bare magnitude.
 */
function poolOf(icon: string | undefined, scope?: 'stock' | 'production'): number | undefined {
  if (icon === undefined) {
    return undefined;
  }
  const standard = playerResourceValue(thisPlayer.value, icon, scope ?? 'stock');
  if (standard !== undefined) {
    return standard;
  }
  const onCard = props.preview !== undefined && 'cardResource' in props.preview ? props.preview.cardResource : undefined;
  // Both sides normalized: a hook may pass the raw `CardResource` value
  // ('Floater') or the already-normalised icon key ('floater').
  if (scope !== 'production' && onCard !== undefined && cardResourceKey(String(onCard.type)) === cardResourceKey(icon)) {
    return onCard.count;
  }
  return undefined;
}
// ── spend-heat helpers ──────────────────────────────────────────────
function heatStockFor(c: ComposerChoice): number {
  const plan = spendHeatPlan(c.input);
  return plan !== undefined ? spendHeatStock(plan, floatersFor(c.id)) : 0;
}
function floatersFor(id: string): number {
  return floaters.value[id] ?? 0;
}
function adjustFloaters(c: ComposerChoice, step: number): void {
  const plan = spendHeatPlan(c.input);
  if (plan === undefined) {
    return;
  }
  const next = Math.min(plan.floaterMax, Math.max(plan.minFloaters, floatersFor(c.id) + step));
  if (!spendHeatValid(plan, next)) {
    return;
  }
  floaters.value[c.id] = next;
  captureFor(c, spendHeatResponse(plan, next));
}
// ── payment helpers ─────────────────────────────────────────────────
/** The payment PRESENTATION model for a payment choice — the SAME
 *  `buildPaymentView` the play composer and the standalone payment task
 *  use, so every payment surface in the game renders one language. */
function paymentPanelView(c: ComposerChoice): PaymentView {
  const model = c.input as SelectPaymentModel;
  return buildPaymentView({
    cost: model.amount,
    lanes: paymentLanes(model, thisPlayer.value),
    counts: payCounts.value[c.id] ?? {},
    mcAvailable: megacreditsAvailable(thisPlayer.value),
  });
}
/** Density for THIS choice's panel: only the choice whose editor is open
 *  expands — a second payment panel stays a compact summary. */
function payModeFor(c: ComposerChoice): 'compact' | 'expanded' {
  return sub.value?.kind === 'payment' && sub.value.choiceId === c.id ? 'expanded' : 'compact';
}
/** The unit the editor's cursor sits on (undefined outside the editor). */
function payFocusUnitFor(c: ComposerChoice): string | undefined {
  const subNow = sub.value;
  if (subNow?.kind !== 'payment' || subNow.choiceId !== c.id) {
    return undefined;
  }
  return editableRows(paymentPanelView(c))[subNow.index]?.unit;
}
/** The pulse nonce is PER CHOICE — a shared counter made every mounted
 *  panel flash when only one of them was dialed. */
function payFlashFor(c: ComposerChoice): number {
  return payFlash.value[c.id] ?? 0;
}
/** Quick-adjust of the SINGLE alt source on the main screen (M€ auto-fills
 *  the rest) — delegates to the ONE mutation both densities share. */
function adjustQuickPayment(c: ComposerChoice, step: number): void {
  const row = quickAdjustRow(paymentPanelView(c));
  if (row === undefined) {
    return;
  }
  if ((step > 0 && !row.canIncrease) || (step < 0 && !row.canDecrease)) {
    return;
  }
  adjustPayment(c, 0, step);
}
/** RT МАКС. on that same single alt source (the quick-adjust's own MAX). */
function maxQuickPayment(c: ComposerChoice): void {
  const row = quickAdjustRow(paymentPanelView(c));
  if (row === undefined || !row.canIncrease) {
    return;
  }
  adjustPayment(c, 0, 0, true);
}
/**
 * EXPAND the payment block in place — only where the editor is a REAL second
 * stage (two or more alternative sources). A pure-AUTO M€ payment has nothing
 * to configure, and a single alternative is already dialed inline by the
 * bumpers on this very screen, so LT there would re-open the block the player
 * is looking at, with a cursor that has nowhere to go.
 */
function openPaymentEditor(c: ComposerChoice): void {
  const view = paymentPanelView(c);
  if (!view.editorEligible) {
    return;
  }
  sub.value = {kind: 'payment', choiceId: c.id, index: 0};
}
/** Fold the editor back into the compact summary, keeping the chosen mix. */
function closePaymentEditor(): void {
  sub.value = undefined;
  // «Готово» is an answer: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/**
 * Dial ONE payment source — the single mutation both densities go through.
 * The capture follows coverage: an uncovered mix un-captures the choice, so
 * the CTA blocks and says why (never a silently invalid submit).
 */
function adjustPayment(c: ComposerChoice, laneIdx: number, step: number, toMax = false): void {
  const model = c.input as SelectPaymentModel;
  const lanes = paymentLanes(model, thisPlayer.value);
  const lane = lanes[laneIdx];
  if (lane === undefined) {
    return;
  }
  const counts = {...(payCounts.value[c.id] ?? {})};
  const before = counts[lane.unit] ?? 0;
  // The AGGREGATE anti-overpay limit lives in the pure `dialLaneCount`, so
  // «+» and «МАКС.» both read what the OTHER alternatives already pay.
  const next = dialLaneCount(model.amount, lane, lanes, counts, toMax ? 'max' : step);
  if (next === before) {
    return;
  }
  counts[lane.unit] = next;
  payCounts.value[c.id] = counts;
  payFlash.value[c.id] = (payFlash.value[c.id] ?? 0) + 1;
  const mcAvail = megacreditsAvailable(thisPlayer.value);
  captureFor(c, paymentCovers(model.amount, lanes, counts, mcAvail) ?
    {type: 'payment', payment: paymentFromCounts(model.amount, lanes, counts, mcAvail)} : undefined);
}
// ── pick rows ───────────────────────────────────────────────────────
function chosenLabel(c: ComposerChoice): string {
  // A resolved MULTI-select hand pick shows the picked cards (first two
  // names + «+N»; an explicit empty answer reads «Выбрано: 0»).
  const multi = multiPicks.value[c.id];
  if (multi !== undefined && c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1) {
    if (multi.length === 0) {
      return `${translateText('Selected')}: 0`;
    }
    const names = multi.slice(0, 2).map((n) => translateCardName(n as CardName)).join(', ');
    return multi.length > 2 ? `${names} +${multi.length - 2}` : names;
  }
  const pick = picks.value[c.id];
  if (pick === undefined) {
    return '';
  }
  if (c.input.type === 'card') {
    return translateText(pick);
  }
  if (c.input.type === 'player') {
    return playerName(pick);
  }
  if (c.input.type === 'or') {
    // A branch answered through a NESTED pick reads as its ANSWER — the
    // option's own title is the question («выберите карту, чтобы удалить 1
    // Животное»), and a row that restates the question looks unanswered.
    const nestedPick = nestedAnswerOf(c);
    if (nestedPick !== undefined) {
      if (nestedPick.input?.type === 'player') {
        return playerName(nestedPick.pick);
      }
      const names = nestedPick.pick.split(NESTED_PICK_SEP).map((n) => translateCardName(n as CardName)).join(', ');
      // A DISCARD says so — a bare card name reads as a card GAINED (or a target), never as one thrown away.
      const discardOf = nestedPick.input as SelectCardModel | undefined;
      return discardOf?.discardPrompt !== undefined ? `${translateText(discardOf.buttonLabel || 'Discard')}: ${names}` : names;
    }
    // The DECLINE reads as the refusal's own words («Не сбрасывать»), never the server's generic «Ничего не делать».
    const decline = choiceDecline(c);
    if (decline !== undefined && Number(pick) === decline.index) {
      return textOf(decline.label);
    }
    const opt = (c.input as OrOptionsModel).options[Number(pick)];
    return opt !== undefined ? textOf(opt.title) : '';
  }
  return pick;
}
/** The value picked INSIDE the answered or-branch (with the input it came
 *  from), or `undefined` when the branch answered was a plain option. */
function nestedAnswerOf(c: ComposerChoice): {pick: string, input: PlayerInputModel | undefined} | undefined {
  const answered = orDescents.value[c.id];
  return answered !== undefined && picks.value[c.id] === String(answered.item.optionIndex) ?
    {pick: answered.pick, input: answered.item.nested} : undefined;
}
function chosenImpact(c: ComposerChoice): string {
  // Multi-select payout (generic revealGain metadata).
  const multi = multiPicks.value[c.id];
  const gain = c.multiSelect?.revealGain;
  if (multi !== undefined && gain !== undefined) {
    return `+${multi.length * gain.amount}`;
  }
  // A captured or-option keeps its before→after on the COLLAPSED row too —
  // the reading the player chose by must survive the sub-list closing, or
  // the summary falls back to a bare resource name and the decision reads
  // as un-made again.
  if (c.input.type === 'or') {
    // A nested CARD answer keeps the same `N → M` the bot row shows: the
    // two branches of one removal must read in one vocabulary.
    const nested = nestedAnswerOf(c);
    if (nested?.input?.type === 'card' && c.amount !== undefined) {
      const target = (nested.input as SelectCardModel).cards.find((cd) => cd.name === nested.pick);
      const from = target?.resources ?? 0;
      return target === undefined ? '' : `${from} → ${Math.max(0, from + c.amount)}`;
    }
    const item = buildOrItems(c.input as OrOptionsModel)
      .find((it) => String(it.optionIndex) === picks.value[c.id]);
    const chip = item?.chips.find((e) => e.current !== undefined && e.resulting !== undefined);
    return chip === undefined ? '' : `${chip.current} → ${chip.resulting}`;
  }
  // An ANSWERED PLAYER target keeps the reading the list showed — who loses what (PL-899; T14 · CC).
  if (c.input.type === 'player') {
    const color = picks.value[c.id];
    return color === undefined ? '' : playerListItem(c.input as SelectPlayerModel, color, true, false, undefined).impact;
  }
  if (c.input.type !== 'card' || c.amount === undefined) {
    return '';
  }
  const card = (c.input as SelectCardModel).cards.find((cd) => cd.name === picks.value[c.id]);
  if (card === undefined) {
    return '';
  }
  const from = card.resources ?? 0;
  return `${from} → ${Math.max(0, from + c.amount)}`;
}
// ── input routing (foundation: SEMANTIC actions, no raw button names) ──
function handleIntent(intent: GamepadIntent): void {
  // The player's press pins the decision column where it stands (centred) — nothing it causes re-centres it — and
  // whatever it moves inside the column slides into place.
  settled.value?.around();
  // THE DRAW PHASE never sees the pad: while it is pending the action is
  // already committed (nothing to fire, nothing to cancel), and once the
  // reveal has teleported in the SHELL routes intents straight to it —
  // the same path the standalone band uses. Swallow either way, so a
  // press can never leak back into the configuration rows underneath.
  if (drawOutcomeOn.value) {
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
  if (deckCheckOn.value) {
    if (revealStage.value !== 'settled' || revealPayload.value === undefined) {
      return;
    }
    // L3 = the SOURCE card fullscreen (the console-wide source verb —
    // mirrors the single-card reveal's L3 received ⇄ source flip).
    if (intent.kind === 'press' && intent.button === 'stickL') {
      emit('inspect-source');
      return;
    }
    const action = consoleActionOf(intent);
    if (action === 'primary') {
      ackReveal();
    } else if (action === 'inspect') {
      inspectRevealed();
    }
    return;
  }
  // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open; R3 at the setup
  // level opens it. Both resolved BEFORE the semantic map (no default R3).
  if (fxOpen.value) {
    onForecastIntent(intent);
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR') {
    openForecastLayer();
    return;
  }
  if (intent.kind === 'scroll') {
    const step = sub.value?.kind === 'playedTarget' ?
      (targetStep.value ?? undefined) : undefined;
    if (step?.scrollBy !== undefined) {
      // The step owns the only scroller on screen while it is open.
      step.scrollBy(Math.sign(intent.dy) * 40);
      return;
    }
    scroll.value?.scrollByPx?.(Math.sign(intent.dy) * 40);
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  const action = consoleActionOf(intent);
  if (action === undefined) {
    return;
  }
  if (sub.value !== undefined) {
    onSubPress(action);
    return;
  }
  onMainPress(action);
}
function onNav(dir: NavDirection): void {
  if (sub.value?.kind === 'playedTarget') {
    movePlayedTarget(dir);
    return;
  }
  // The wild-resource choice walks the same 2-D grid (P43 · EO); inside «на карту» the TARGET SELECTOR walks its own
  // cards by their real boxes, and its top edge hands the cursor back to the OR.
  if (sub.value?.kind === 'wild' && sub.value.focus.zone === 'card' && wildTargetModel.value !== undefined) {
    wildTargetNav(dir);
    return;
  }
  if (sub.value?.kind === 'wild') {
    if (wildSpec.value !== undefined) {
      const next = wildNav(wildSpec.value, wildParts.value, sub.value.focus, dir);
      if (next.zone === 'card' && sub.value.focus.zone !== 'card') {
        seatWildTarget();
      }
      sub.value = {...sub.value, focus: next};
    }
    return;
  }
  // The Venus bonus's inner step walks its own 2-D grid (the wild's OR · its cards · 2 × 3 resources).
  if (sub.value?.kind === 'venus') {
    // THE NESTED CARD PICK walks the selector's own boxes (`ConsoleVenusBonusStep.pickNav`).
    if (sub.value.focus.zone === 'pick') {
      venusStep.value?.pickNav(dir as PlayedTargetNavDir);
      return;
    }
    const c = venusSubChoice.value;
    const meta = c === undefined ? undefined : venusBonusMetaOf(c.input);
    if (c !== undefined && meta !== undefined) {
      sub.value = {...sub.value, focus: venusInnerNav(meta, venusPartsOf(c), sub.value.focus, dir)};
    }
    return;
  }
  if (sub.value !== undefined) {
    const len = sub.value.kind === 'payment' ? payEditableRows.value.length : listItems.value.length;
    // A PALETTE is a row: ←→ walk it (wrapping, the side-by-side group's rule); ↑↓ keep their list walk.
    if (subPalette.value && (dir === 'left' || dir === 'right') && len > 0) {
      sub.value.index = (sub.value.index + (dir === 'left' ? -1 : 1) + len) % len;
      return;
    }
    if (dir === 'up' || dir === 'down') {
      sub.value.index = Math.min(len - 1, Math.max(0, sub.value.index + (dir === 'up' ? -1 : 1)));
      scrollFocused();
    } else if (sub.value.kind === 'payment') {
      const c = subChoice.value;
      if (c !== undefined) {
        adjustPayment(c, sub.value.index, dir === 'left' ? -1 : 1);
      }
    }
    return;
  }
  // THE VARIANT GROUP MOVES THE WAY IT LOOKS (the play composer's rule, `variantGroupNav`): tiles side by side
  // switch with ←→, ↑↓ leave the group; stacked tiles are rows of the ordinary walk. Selection is never touched.
  // The group's memory is written at the moment of LEAVING (the seeded first focus never passes a watcher): ↑
  // from the row below re-enters on the tile the cursor stood on.
  if (focusedItem.value?.kind === 'branch') {
    branchReturnIdx.value = focusIdx.value;
  }
  const inGroup = variantGroupNav({
    dir, axis: branchAxis.value, focusIdx: focusIdx.value, variantIdx: branchNavIndices.value,
    returnIdx: branchReturnIdx.value, navMaxIndex: navMaxIndex.value, rows: branchGridRows.value,
  });
  if (inGroup !== undefined) {
    focusIdx.value = inGroup;
    scrollFocused();
    return;
  }
  if (dir === 'up' || dir === 'down') {
    // The walk ends at the COMMIT row only while the commit can actually
    // run — a row that would refuse A is not a place the cursor may stop.
    focusIdx.value = Math.min(navMaxIndex.value, Math.max(0, focusIdx.value + (dir === 'up' ? -1 : 1)));
    scrollFocused();
    return;
  }
  // d-pad ←→ mirrors LB/RB on the active dial (a lone stepper is adjustable
  // straight from the CTA — the cursor never has to visit it).
  dialActive(dir === 'left' ? -1 : 1);
}
/** Nudge the ACTIVE dial by `step` (the one `activeDialChoice` resolved). */
function dialActive(step: number): void {
  const c = activeDialChoice.value;
  if (c === undefined) {
    return;
  }
  if (c.kind === 'amount') {
    setAmount(c, amountFor(c.id) + step);
  } else if (c.kind === 'spendHeat') {
    adjustFloaters(c, step);
  } else {
    adjustQuickPayment(c, step);
  }
}
// ── the Venus bonus, PRE-SELECTED (P89 · EL) ────────────────────────
function venusPartsOf(c: ComposerChoice): VenusBonusParts {
  return venusParts.value[c.index] ?? {};
}
/** The step's own prompt (both parts read it — the wild row's input is the synthesised pick). */
function venusStepInput(c: ComposerChoice): PlayerInputModel | undefined {
  const step = selectedBranch.value?.steps[c.index];
  return step?.kind === 'venusBonus' ? step.input : undefined;
}
/** One write for both parts: the parts, then the step's ONE answer (or none — the commit is held). */
function setVenusParts(c: ComposerChoice, parts: VenusBonusParts): void {
  venusParts.value = {...venusParts.value, [c.index]: parts};
  const meta = venusBonusMetaOf(venusStepInput(c));
  const response = meta === undefined ? undefined : venusPreselectResponse(meta, parts);
  const next = {...captured.value};
  if (response === undefined) {
    delete next[c.index];
  } else {
    next[c.index] = response;
  }
  captured.value = next;
}
/** A on the bonus row: the INNER step opens on the first open question (the wild, its card, then the grid). */
// ── THE WILD-RESOURCE CHOICE (P43 · EN / EO) ────────────────────────
function wildTargetLayoutFor(width: number): PlayedTargetLayout {
  return planPlayedTargetLayout({
    owners: wildTargetModel.value?.owners ?? [],
    availW: width,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
}
/** Seat the selector's cursor: on the chosen card, else the first candidate that is no near miss. */
function seatWildTarget(): void {
  const owners = wildTargetModel.value?.owners ?? [];
  const chosen = wildParts.value.wild?.card;
  const first = owners.flatMap((o) => o.candidates.map((c, index) => ({o, c, index}))).find((x) => x.c.blocked === undefined);
  wildTargetFocusRaw.value = (chosen !== undefined ? findPlayedTargetFocus(chosen, owners) : undefined) ??
    (first !== undefined ? {ownerId: first.o.id, index: first.index} : reseatPlayedTargetFocus(wildTargetFocusRaw.value, owners));
}
function wildTargetNav(dir: NavDirection): void {
  const subNow = sub.value;
  const owners = wildTargetModel.value?.owners ?? [];
  const focus = reseatPlayedTargetFocus(wildTargetFocusRaw.value, owners);
  const d = ({left: 'left', right: 'right', up: 'up', down: 'down'} as Record<string, PlayedTargetNavDir | undefined>)[dir as string];
  if (subNow?.kind !== 'wild' || focus === undefined || d === undefined) {
    return;
  }
  const step = wildTargetStep.value ?? undefined;
  const cells = step?.cells?.() ?? [];
  const next = cells.length > 0 ? stepPlayedTargetFocusVia(step, focus, d, cells) : undefined;
  if (next === undefined) {
    if (d === 'up') {
      // The selector's top edge: the cursor goes back to the OR, on «на карту».
      sub.value = {...subNow, focus: {zone: 'wild', index: 0}};
    }
    return; // any other edge HOLDS — never a wrap
  }
  wildTargetFocusRaw.value = next;
  step?.ensureFocusVisible?.();
}
/** A on a candidate: the card branch (selected if it was not), its step answered — the step leaves. */
function wildTargetChoose(): void {
  const plan = wildPlan.value;
  const owners = wildTargetModel.value?.owners ?? [];
  const candidate = playedTargetAt(wildTargetFocusShown.value, owners);
  if (plan === undefined || plan.cardStep === undefined || candidate === undefined || candidate.blocked !== undefined || candidate.stand !== undefined) {
    return;
  }
  if (selectedPos.value !== plan.cardPos) {
    selectBranch(plan.cardPos);
  }
  const c = branchChoiceList.value.find((x) => x.scope === 'step' && x.index === plan.cardStep);
  if (c === undefined) {
    return;
  }
  captureFor(c, {type: 'card', cards: [candidate.cardName]});
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
/** X on a candidate: the card fullscreen, its TARGET DOSSIER beside it (what lies on it, what this move does). */
function wildTargetInspect(): void {
  const model = wildTargetModel.value;
  const candidate = model === undefined ? undefined : playedTargetAt(wildTargetFocusShown.value, model.owners);
  if (model === undefined || candidate === undefined || candidate.stand !== undefined) {
    return;
  }
  openPlayedTargetZoom({model, cardName: candidate.cardName, getRoot: () => rootEl.value ?? undefined});
}
function openWildStep(item?: {id: string, step?: number}): void {
  if (item?.step !== undefined) {
    // A standalone «?»: the sub names its row first, so the spec / parts computeds read THAT step.
    const plan = wildStepList.value.find((p) => p.resourceStep === item.step);
    if (plan !== undefined) {
      const spec = wildStepSpec(plan, wildStepIncluded(selectedBranch.value, plan), (resource) => venusStock.value[resource] ?? 0);
      sub.value = {kind: 'wild', choiceId: item.id, focus: wildOpen(spec, wildStepParts(plan, captured.value))};
    }
    return;
  }
  const spec = wildSpec.value;
  if (spec !== undefined) {
    sub.value = {kind: 'wild', choiceId: 'wild', focus: wildOpen(spec, wildParts.value)};
  }
}
/** A row's answer — a standalone «?» reads its own step's capture; the pair / the dial read the shared one. */
function wildRowAnswerOf(item: {step?: number}): (WildRowAnswer & {mode?: 'spend' | 'gain'}) | undefined {
  if (item.step === undefined) {
    return wildAnswer.value;
  }
  const plan = wildStepList.value.find((p) => p.resourceStep === item.step);
  return plan === undefined ? undefined : wildStepAnswer(plan, captured.value);
}
/** A standalone «?» row's role — `spend` / `gain`; undefined for the pair / the dial. */
function wildRowMode(item: {step?: number}): 'spend' | 'gain' | undefined {
  return item.step === undefined ? undefined : wildStepList.value.find((p) => p.resourceStep === item.step)?.mode;
}
/** The row's open question in its own words. */
function wildRowAsk(item: {step?: number}): string {
  const mode = wildRowMode(item);
  if (mode !== undefined) {
    return mode === 'spend' ? 'Choose a resource to spend' : 'Choose a resource to gain';
  }
  return wildDial.value !== undefined ? 'Choose a standard resource' : 'Choose: on a card or a standard resource';
}
/** The standard resource a row's answer names (its icon). */
function wildRowStandard(item: {step?: number}): string {
  const answer = wildRowAnswerOf(item);
  return answer?.kind === 'standard' ? answer.resource : '';
}
/**
 * A press of the inner step: the pure model answers, and its draft is WRITTEN INTO the composer's own state — a
 * plate selects its branch (`selectBranch` — the branch's captures reset, a sole holder seeded, T14), the slot
 * captures the branch step's answer. `confirm` / `back` leave the step; the row reads the answer.
 */
function wildStepPress(verb: 'primary' | 'back' | 'prevSection' | 'nextSection' | 'nextTab'): void {
  const subNow = sub.value;
  const plan = wildPlan.value;
  const dial = wildDial.value;
  const spec = wildSpec.value;
  const stepPlan = wildStepOpen.value;
  if (subNow?.kind !== 'wild' || (plan === undefined && dial === undefined && stepPlan === undefined) || spec === undefined) {
    return;
  }
  const before = wildParts.value;
  if (stepPlan !== undefined) {
    // A STANDALONE «?» (P50 · FC): a radio — A on a live lane captures it at the step's own index and leaves.
    const pressed = wildPress(spec, before, subNow.focus, verb);
    const chosen = Object.entries(pressed.parts.spread ?? {}).find(([, n]) => n > 0)?.[0];
    const c = branchChoiceList.value.find((x) => x.scope === 'step' && x.index === stepPlan.resourceStep);
    if (pressed.exit === 'confirm' && chosen !== undefined && c !== undefined) {
      captureFor(c, {type: 'resource', resource: chosen});
    }
    if (pressed.exit !== undefined) {
      sub.value = undefined;
      landCursor();
      scrollFocused();
      return;
    }
    sub.value = {...subNow, focus: wildClamp(spec, before, pressed.focus)};
    return;
  }
  const result = wildPress(spec, before, subNow.focus, verb);
  const wild = result.parts.wild;
  if (plan !== undefined && wild !== undefined && wild.wild !== before.wild?.wild) {
    selectBranch(wildPosOf(plan, wild.wild));
  }
  const choices = branchChoiceList.value;
  if (plan !== undefined && wild?.wild === 'onCard' && wild.card !== undefined && plan.cardStep !== undefined) {
    const c = choices.find((x) => x.scope === 'step' && x.index === plan.cardStep);
    if (c !== undefined) {
      captureFor(c, {type: 'card', cards: [wild.card]});
    }
  }
  const unit = Object.entries(result.parts.spread ?? {}).find(([, n]) => n > 0)?.[0];
  const resourceStep = plan !== undefined ? plan.resourceStep : dial?.resourceStep;
  if (wild?.wild === 'asStandard' && unit !== undefined && resourceStep !== undefined) {
    const c = choices.find((x) => x.scope === 'step' && x.index === resourceStep);
    if (c !== undefined) {
      captureFor(c, {type: 'resource', resource: unit});
    }
  }
  if (result.exit !== undefined) {
    sub.value = undefined;
    landCursor();
    scrollFocused();
    return;
  }
  const nextFocus = wildClamp(spec, wildParts.value, result.focus);
  if (nextFocus.zone === 'card' && subNow.focus.zone !== 'card') {
    seatWildTarget();
  }
  sub.value = {...subNow, focus: nextFocus};
}
function openVenusStep(c: ComposerChoice): void {
  const meta = venusBonusMetaOf(c.input);
  if (meta !== undefined) {
    sub.value = {kind: 'venus', choiceId: c.id, focus: venusInnerOpen(meta, venusPartsOf(c))};
  }
}
/** A verb inside the inner step — the pure model decides; a confirm comes back to the column on the next question. */
function venusStepPress(verb: 'primary' | 'back' | 'prevSection' | 'nextSection' | 'nextTab'): void {
  const subNow = sub.value;
  const c = venusSubChoice.value;
  const meta = c === undefined ? undefined : venusBonusMetaOf(c.input);
  if (subNow?.kind !== 'venus' || c === undefined || meta === undefined) {
    sub.value = undefined;
    return;
  }
  const before = venusPartsOf(c);
  // THE NESTED CARD PICK: LB/RB turn its page, A answers with the selector's focused card.
  const step = venusStep.value ?? undefined;
  if (subNow.focus.zone === 'pick' && (verb === 'prevSection' || verb === 'nextSection')) {
    step?.pickTurn(verb === 'nextSection' ? 1 : -1);
    return;
  }
  const picked = subNow.focus.zone === 'pick' && verb === 'primary' ? step?.pickFocused() : undefined;
  const result = venusInnerPress(meta, before, subNow.focus, verb, picked);
  if (result.parts !== before) {
    setVenusParts(c, result.parts);
  }
  if (result.exit !== undefined) {
    sub.value = undefined;
    if (result.exit === 'confirm') {
      landCursor();
    }
    scrollFocused();
    return;
  }
  sub.value = {...subNow, focus: venusInnerClamp(meta, result.parts, result.focus)};
}
/** THE CELL BEAT'S PROMISE (PL-1437) for every pre-selected bonus the commit carries — armed at the press. */
function armVenusPreselects(branch: ActionPreviewBranch): void {
  for (const [index, parts] of Object.entries(venusParts.value)) {
    const step = branch.steps[Number(index)];
    const meta = step?.kind === 'venusBonus' && venusWhenHolds(step.when, captured.value) ? venusBonusMetaOf(step.input) : undefined;
    if (meta !== undefined && venusPreselectResponse(meta, parts) !== undefined) {
      armVenusBonusCell(venusPreselectArm(meta, parts));
    }
  }
}
// MAIN state: A(primary) acts on the FOCUSED row (select a branch / open
// a pick / advance past a stepper — «Далее») and confirms ONLY on the CTA
// row; X(inspect) inspects the SOURCE card fullscreen (the ONE console
// X-verb — the quick-confirm X was retired for grammar consistency);
// B back, LB/RB(prev/nextSection) step amount/floaters, RT(nextTab) = max.
function onMainPress(action: ConsoleAction): void {
  const item = focusedItem.value;
  switch (action) {
  case 'primary':
    if (ctaFocused.value || item === undefined) {
      // THE COMMIT ARRIVES (T14 · CC): a press inside the arrival window — before the commit's pose paints, or
      // within the ring's clock after — is the ARRIVAL (the input observer has already posed it), never the action.
      if (commitArrivalAbsorbs(commitArrival.value)) {
        return;
      }
      submit();
    } else if (item.kind === 'branch') {
      selectBranch(item.pos);
      // A variant is an answer: the ONE rule lands the cursor on the next question, or arrives on the commit.
      landCursor();
      scrollFocused();
    } else if (item.kind === 'wild') {
      // The wild row is a DOOR into the shared inner step (P43 · EO; a standalone «?» — P50 · FC — opens its own).
      openWildStep(item);
    } else if (item.choice.kind === 'venusBonus') {
      // The Venus bonus's row is a DOOR into its inner step (P89 · EM).
      openVenusStep(item.choice);
    } else if (item.choice.kind === 'amount' || item.choice.kind === 'spendHeat') {
      // A stepper adjusts via LB/RB — A is «Далее»: the dial's visible, editable default is already captured, so
      // the ONE rule lands the cursor on the next question or the commit (the play composer's grammar).
      landCursor();
      scrollFocused();
    } else {
      openChoice(item.choice);
    }
    return;
  case 'inspect':
    emit('inspect-source');
    return;
  case 'back':
    emit('cancel');
    return;
  case 'prevSection':
  case 'nextSection':
    // LB/RB drive the ACTIVE DIAL — a focused stepper, else the focus-free
    // sole stepper, else the payment quick-adjust. No focus needed for the
    // lone dial: «покрутил и подтвердил».
    dialActive(action === 'prevSection' ? -1 : 1);
    return;
  case 'prevTab':
    // LT = the DEDICATED entry to the detailed payment lane editor (never A,
    // never a focus row) — the user's «вход строго через отдельную кнопку LT».
    if (primaryPaymentChoice.value !== undefined) {
      openPaymentEditor(primaryPaymentChoice.value);
    }
    return;
  case 'nextTab': {
    // RT = MAX on the ACTIVE dial: an amount stepper (focused or focus-free),
    // or the inline payment quick-adjust — the single alt lane has no editor
    // to enter, so this is the only «fill it up» it gets.
    const dial = activeDialChoice.value;
    if (dial === undefined) {
      return;
    }
    if (dial.kind === 'amount') {
      setAmount(dial, amountModel(dial).max);
    } else if (dial.kind === 'payment') {
      maxQuickPayment(dial);
    }
    return;
  }
  default:
    return;
  }
}
function openChoice(c: ComposerChoice): void {
  // A LAW'S PLAY SLOT (RX36) → the hand album + the play composer (`consolePlayPick`), hosted as a step here.
  if (c.kind === 'lawPlay') {
    openLawPlayPick(c);
    return;
  }
  // Viron's "repeat an already-used action" pick → the ДЕЙСТВИЯ КАРТ list
  // surface ADAPTED for repeat mode (`consoleRepeatPick`): the player picks
  // the action AND composes it there, returning the composed responses.
  if (c.repeatAction === true) {
    // NESTED slot (this composer already lives inside the repeat pick
    // surface): the bridge is busy — the slot is a read-only note.
    if (!props.repeatPickDisabled) {
      openRepeatPick(c);
    }
    return;
  }
  // A Hydronetwork STAGE-REWARD claim (Dutch Mountains) → the REAL track
  // as the selection surface: the bridge hands the screen to the hydro
  // workspace in reward-select mode and the composed draft returns as
  // this step's ordinary captured response. Structural, off the input's
  // own type — never a card name.
  if (c.input.type === 'deltaStageReward') {
    openStageRewardPick(c);
    return;
  }
  // A Hydronetwork BLOCKADE target (Modular Floodgates, DP11) → the REAL
  // track as the selection surface: candidates at their live positions,
  // the ghost gate following the cursor. Structural, off the input's own
  // type — never a card name. Under a STANDING hydro workspace the pick
  // NESTS (`enterDelta*Pick` suspends the outer role and stacks a
  // `nest: true` frame) — a second descent is an ordinary door now, never
  // a truncation and never a deferral.
  if (c.input.type === 'deltaBlockade') {
    openBlockadePick(c);
    return;
  }
  // A PLAN's landing pre-select (a deferred deltaAdvance door whose
  // destination asks a choice) → the SAME track surface, in its
  // advance-landing form: the player sees the move (from → to, the
  // forward ghost) and answers ON the stage it belongs to.
  if (c.deltaLanding !== undefined) {
    openDeltaLandingPick(c);
    return;
  }
  // A hand-card pick (Self-Replicating Robots' link branch: every candidate
  // — eligible AND greyed-with-reason — is a card in hand) routes to the
  // HAND SECTION's premium pick mode; a PLAYED-CARD pick descends into the
  // embedded target step, INSIDE this workspace. Only the hosted-cards pick
  // (SRR targetCards — in neither zone) keeps the inline sub-list.
  if (c.kind === 'card' &&
      isHandCardSelection(c.input as SelectCardModel, handNamesSet.value)) {
    openHandPick(c);
    return;
  }
  if (isPlayedTargetChoice(c)) {
    openPlayedTargetStep(c);
    return;
  }
  // «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28): a removal whose targets are the players' cards AND the bot
  // (the server's `tableTargetPrompt`) is answered on ONE screen — no list «карты / бот» before the cards.
  if (c.kind === 'or' && tableTargetOf(c.input) !== undefined) {
    openPlayedTargetStep(c);
    if (sub.value?.kind === 'playedTarget') {
      return;
    }
  }
  // An OPTIONAL choice whose one answer is a pick (a discard from the hand) has no list: the pick opens directly,
  // its decline inside it (RT + the plate).
  if (c.kind === 'or' && openOptionalPick(c)) {
    return;
  }
  if (c.kind === 'card' || c.kind === 'player' || c.kind === 'or') {
    sub.value = {kind: 'list', choiceId: c.id, index: 0};
  }
  // amount / spendHeat / payment adjust inline (A advances; payment's detailed
  // lane editor is LT → `openPaymentEditor`, never A).
}
/**
 * Hand Viron's repeat pick to the ДЕЙСТВИЯ КАРТ surface in repeat mode: the
 * player chooses ONE already-used action (A = «Выбрать») and composes it
 * there; the result (chosen action + its composed responses) lands back
 * here and rides the confirm as `repeat`. The composer stays MOUNTED
 * (v-show hidden) so this callback survives (mirrors the hand pick).
 */
function openRepeatPick(c: ComposerChoice): void {
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
    // A LAW (R&D Funding RX26) is in nobody's tableau: it states itself through its printed name (the crumb of a
    // hosted pick comes from the stack — the label is only the standalone fallback).
    source: heroCardName.value !== undefined ? {kicker: 'Repeat action', card: heroCardName.value} :
      {kicker: 'Resolution action', label: lawNameKey.value ?? sourceKey.value},
    prior: repeatResult.value !== undefined ?
      {chosenCard: repeatResult.value.chosenCard, nodeIndex: repeatResult.value.nodeIndex} : undefined,
  }, (result) => {
    repeatResult.value = result;
    // The slot is filled: the ONE rule lands the cursor (the commit, when nothing else is left to ask — T14 · CC;
    // a jump to the commit by hand stood the cursor past the last row while another question still waited).
    landCursor();
    scrollFocused();
  });
}
/**
 * Hand the stage-reward claim to the Hydronetwork workspace in
 * reward-select mode (the pick bridge idiom: this composer stays mounted
 * underneath with its captures intact, the resolve captures the step's
 * wire response and re-locates the choice by ID — the preview may have
 * refreshed during the round trip). The full repeat composition is kept
 * beside the capture (`stageRewardDraft`) for the claim/specs the wire
 * response cannot carry back out.
 */
/** The law's SETUP stands again (a refused scene, B out of a staged step): the slot as it was, nothing latched. */
function restoreLawSetup(): void {
  lawLandingLatched.value = false;
  const surface = surfaceEl.value ?? undefined;
  if (surface !== undefined) {
    gsap.killTweensOf(surface);
    gsap.set(surface, {clearProps: 'opacity,visibility'});
  }
  landCursor();
}
/** The composed play standing in a law's play slot, or `undefined` (its capture is the result itself). */
function lawPlayResultOf(c: ComposerChoice): ConsolePlayPickResult | undefined {
  return c.kind === 'lawPlay' ? captured.value[c.index] as ConsolePlayPickResult | undefined : undefined;
}
/** The chosen card as the LAW reads it — the promised pick's model (its requirement under the law's waiver). */
function lawPlayCardModel(c: ComposerChoice): CardModel | undefined {
  const name = lawPlayResultOf(c)?.cardName;
  return name === undefined ? undefined : (c.input as SelectProjectCardToPlayModel).cards.find((card) => card.name === name);
}
/** The law is what lets the chosen card through (a global requirement met ONLY thanks to the waiver). */
function lawPlayOpenedByLaw(c: ComposerChoice): boolean {
  return lawPlayCardModel(c)?.requirementEasing?.some((e) => e.decisive) === true;
}
function lawPlayCostChip(c: ComposerChoice): ActionEffect {
  return {direction: 'cost', icon: 'megacredits', amount: lawPlayResultOf(c)?.cost ?? 0};
}
/** «6 M€ for the law + 4 M€ for the card = 10 M€» — the law's bill (its preview chip) and the card's charged price. */
function lawPlayTotalLine(c: ComposerChoice): string {
  const result = lawPlayResultOf(c);
  const bill = selectedBranch.value?.effects.find((e) => e.direction === 'cost' && e.icon === 'megacredits')?.amount ?? 0;
  const card = result?.cost ?? 0;
  return translateTextWithParams('${0} M€ for the law + ${1} M€ for the card = ${2} M€', [String(bill), String(card), String(bill + card)]);
}
/**
 * Hand «which card, and how» to the album + the play composer (`consolePlayPick`) — a STEP of this stage
 * (`card-actions ⊃ hand`); the composed play lands back in the slot and rides THIS commit. This composer stays
 * MOUNTED behind the step, so the callback survives.
 */
function openLawPlayPick(c: ComposerChoice): void {
  const step = selectedBranch.value?.steps[c.index];
  if (step?.kind !== 'lawPlay' || submitting.value) {
    return;
  }
  enterConsolePlayPick({input: step.play.input, reserve: step.play.reserve, resolution: step.resolution, stage: 'Selection'}, (result) => {
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    captureFor(cur, result);
    // Kept OUTSIDE the stage too: a staged door yields the stage away and a park remounts it — the slot comes back.
    rememberLawPlay(step.resolution, result);
    landCursor();
    scrollFocused();
  });
}
function openStageRewardPick(c: ComposerChoice): void {
  const model = c.input as DeltaStageRewardInputModel;
  enterDeltaRewardPick({
    source: cardOrThrow(),
    claimable: model.claimable,
    prior: stageRewardDraft.value ?? deltaRewardDraftOf(captured.value[c.index]),
  }, (draft) => {
    stageRewardDraft.value = draft;
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    captureFor(cur, deltaRewardStepResponse(draft));
    landCursor();
    scrollFocused();
  });
}
/**
 * Hand the blockade target pick to the Hydronetwork workspace in
 * blockade-selection mode (the pick bridge idiom: this composer stays
 * mounted underneath with its captures intact; the resolve captures the
 * step's wire response and re-locates the choice by ID — the preview may
 * have refreshed during the round trip). B keeps the previous answer.
 */
function openBlockadePick(c: ComposerChoice): void {
  const model = c.input as DeltaBlockadeInputModel;
  enterDeltaBlockadePick({
    source: cardOrThrow(),
    projection: model.projection,
    prior: deltaBlockadeResponseOf(captured.value[c.index])?.target,
  }, (draft) => {
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    captureFor(cur, deltaBlockadeStepResponse(model.projection, draft.target));
    landCursor();
    scrollFocused();
  });
}
/** The captured blockade target, summarized for its row: who is blocked
 *  and for how long — the summary the CTA's promise is read against. */
function blockadeSummary(c: ComposerChoice): string {
  const target = deltaBlockadeResponseOf(captured.value[c.index])?.target;
  if (target === undefined) {
    return '';
  }
  const name = displayNameForColor(props.playerView.players, target);
  return `${name} — ${translateText('Advancement will be blocked')} · ${translateText('Until the start of the next generation')}`;
}
/**
 * DESCEND into the Hydronetwork's stage-reward surface for a PLAN's
 * landing choice (the reward-pick in its advance-landing shape — the
 * Corporate Espionage owner-pick precedent): the destination cell focused
 * with the forward ghost, «ВАШЕ ПРОДВИЖЕНИЕ from → to», the stage's honest
 * gains + options through the one shared block. The resolved draft is
 * captured at the deltaAdvance step's own index as the FULL
 * `{deltaProject, amount, answers}` response — which is what the plan's
 * batch then carries (`plannedStepResponses` prefers the capture).
 * B keeps the previous answer.
 */
function openDeltaLandingPick(c: ComposerChoice): void {
  const offer = c.deltaLanding;
  if (offer === undefined) {
    return;
  }
  enterDeltaRewardPick({
    source: cardOrThrow(),
    claimable: [offer.toPosition],
    advanceFrom: offer.fromPosition,
    prior: deltaAdvancePlanDraftOf(captured.value[c.index]),
  }, (draft) => {
    const response = deltaAdvancePlanResponse(offer, draft);
    if (response === undefined) {
      return; // an unanswered ask cannot resolve (the scene's own gate)
    }
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    captureFor(cur, response);
    landCursor();
    scrollFocused();
  });
}
/** The captured landing pick, summarized for its row (stage + the pick). */
function deltaLandingSummary(c: ComposerChoice): string {
  const draft = deltaAdvancePlanDraftOf(captured.value[c.index]);
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
}
/** The landing stage's EXACT outcome for the picked answer — the ONE hydro
 *  reward view every landing renders (server-authored lines). */
function deltaLandingPreview(c: ComposerChoice): HydroRewardView | undefined {
  const draft = deltaAdvancePlanDraftOf(captured.value[c.index]);
  if (draft === undefined) {
    return undefined;
  }
  return deltaRewardPreviewView(draft, props.playerView);
}
/** The claimed stage's EXACT outcome for the row — the shared hydro
 *  reward view over the LIVE snapshot (a stage change re-derives it on
 *  the spot; server-authored lines, never a UI re-computation). */
function stageRewardPreview(c: ComposerChoice): HydroRewardView | undefined {
  const draft = deltaRewardDraftOf(captured.value[c.index]);
  if (draft === undefined) {
    return undefined;
  }
  return deltaRewardPreviewView(stageRewardDraft.value ?? draft, props.playerView);
}
/** The captured claim, summarized for its row (stage name + the picks). */
function stageRewardSummary(c: ComposerChoice): string {
  const draft = deltaRewardDraftOf(captured.value[c.index]);
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
}
/** The A-verb a requirement publishes while it holds the cursor. The keys
 *  are the ones the held line already uses — ONE vocabulary, not two. */
function requirementVerb(c: ComposerChoice): string {
  switch (c.kind) {
  case 'card': return cardPickAskKey(c.amount, isDiscardPick(c.input));
  case 'player': return 'Choose a player';
  case 'or': return optionalPickVerb(c);
  case 'payment': return 'Configure payment';
  case 'spendHeat': return 'Heat sources';
  default: return 'Select';
  }
}
/**
 * Put the cursor where the gate says it belongs. Called on open and after
 * anything that can re-block the screen (a pick returning, a branch switch,
 * a target going stale) — a focus seeded once and left alone is exactly how
 * the cursor ends up parked on a row that has since stopped working.
 */
function syncCommitFocus(): void {
  // The gate's word changed under the cursor (a variant switch, a target gone): the ONE rule re-lands it — but a
  // REFUSED action leaves the cursor where it stands (nothing on the screen moved it; the commit row says why).
  const landing = cursorLanding();
  if (landing !== undefined && landing.kind !== 'held' && landing.index !== focusIdx.value) {
    landCursor();
    scrollFocused();
  }
}
/** A short LOCAL pulse on the row that is holding the commit — never a
 *  toast detached from the problem, never a shake of the whole surface. */
function flashBlockingRequirement(): void {
  blockFlashNonce.value++;
}
/** Is this row the one the gate is waiting on? */
function isBlockingRow(item: Item): boolean {
  const gate = commitGate.value;
  if (gate.kind !== 'incomplete' && gate.kind !== 'stale') {
    return false;
  }
  return navItems.value.indexOf(item) === gate.blocking.index;
}
/** Does this choice belong to the embedded played-target step? The boundary
 *  is the CAPABILITY (every candidate lies on some tableau), never the
 *  owner — an opponent's card is the same kind of pick as your own. */
function isPlayedTargetChoice(c: ComposerChoice): boolean {
  return c.kind === 'card' && c.repeatAction !== true &&
    !isHandCardSelection(c.input as SelectCardModel, handNamesSet.value) &&
    isCardSelectionWithin(c.input as SelectCardModel, playedNamesSet.value);
}
/** Is this choice answered in the hand album (every candidate a card in hand)? */
function isHandPickChoice(c: ComposerChoice): boolean {
  return c.kind === 'card' && isHandCardSelection(c.input as SelectCardModel, handNamesSet.value);
}
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
function openPlayedTargetStep(c: ComposerChoice, orItem?: ConsoleOrItem): void {
  // Measure the band ONCE, before the step is visible, and measure it where
  // the layout is STRETCHED: the work column's width is the band's, and the
  // row above it is the only box here whose height the cards cannot move.
  const root = rootEl.value ?? undefined;
  const zone = root?.querySelector<HTMLElement>('.con-composer__actright');
  if (zone !== null && zone !== undefined) {
    playedTargetWidth.value = zone.clientWidth;
  }
  const band = root?.querySelector<HTMLElement>('.con-composer__actmain');
  if (band !== null && band !== undefined) {
    playedTargetHeight.value = band.clientHeight;
  }
  // OPEN FIRST, then seat the cursor. The model this step renders is a
  // function of the sub-state itself (a nested descent serves the BRANCH's
  // `SelectCard`, not the choice's own input), so asking for the owners
  // before the state exists would answer for the wrong input — or, on the
  // first descent into an or-branch, for no input at all. One builder, one
  // source of truth; a step with nothing to point at closes again below.
  sub.value = {kind: 'playedTarget', choiceId: c.id, focus: {ownerId: '', index: 0}, picked: [], orItem};
  const owners = playedTargetModel.value?.owners ?? [];
  // Re-entry restores the previous answer: the cursor lands ON that card,
  // already target-locked (a multi ask brings its whole accumulation back,
  // pruned of anything that left the table since).
  const picked = playedTargetSelection.value.mode === 'multi' ?
    prunePlayedTargetPicks((multiPicks.value[c.id] ?? []) as ReadonlyArray<string>, owners) :
    [];
  const chosen = playedTargetResults.value[c.id];
  // A bot answered in the table's one zone re-enters ON the bot's tile.
  const table = orItem === undefined ? tableTargetOf(c.input) : undefined;
  const botChosen = table !== undefined && picks.value[c.id] === String(table.botBranch) ? tableTargetBotStand(c.input)?.key : undefined;
  const focus = owners.length === 0 ? undefined :
    (findPlayedTargetFocus(chosen?.cardName ?? botChosen ?? picked[0], owners) ?? reseatPlayedTargetFocus(undefined, owners));
  if (focus === undefined) {
    sub.value = undefined;
    return;
  }
  sub.value = {kind: 'playedTarget', choiceId: c.id, focus, picked, orItem};
}
/** The step's ASK, read from the server's own prompt: one card, or the
 *  up-to-N the input declares. */
function playedTargetSelectionFor(c: ComposerChoice): PlayedTargetSelection {
  const model = playedTargetInputFor(c);
  const max = model?.max ?? 1;
  if (max <= 1) {
    return {mode: 'single'};
  }
  return {
    mode: 'multi',
    min: model?.min ?? 0,
    max,
    picked: sub.value?.kind === 'playedTarget' && sub.value.choiceId === c.id ?
      sub.value.picked :
      ((multiPicks.value[c.id] ?? []) as ReadonlyArray<string>),
  };
}
/** The contextual preview for a candidate — the ONE shared builder. */
function playedTargetPreview(choice: ComposerChoice, model: SelectCardModel, name: CardName) {
  // A card-level step (TR29's source) reads its own delta and VP exactly like a branch step.
  const step = stepOfChoice(props.preview, selectedBranch.value, choice);
  return playedTargetPreviewFor(step, model, name, selectedBranch.value?.effects, selectedBranch.value?.vpBox);
}
/**
 * The `SelectCard` a choice's embedded step is serving: the choice's own
 * input, or the one NESTED in the or-branch being answered — open now
 * (`sub.orItem`) or answered earlier (`orDescents`). A METHOD, because the
 * summary row asks it for a choice that is not the open one.
 */
/**
 * THE EMBEDDED SELECTOR'S MODEL for ONE choice — built for the open step
 * and for each answered row's summary. Per CHOICE, never «the» step: a
 * composer may host TWO played-card picks (a spend's SOURCE before the
 * variant and a reward's TARGET after it — TR29), and a summary checked
 * against the other pick's candidates reads as a stale answer. Eligibility
 * is the SERVER's candidate set, verbatim.
 */
function playedTargetModelFor(choice: ComposerChoice): PlayedTargetModel | undefined {
  const model = playedTargetInputFor(choice);
  const bot = tableTargetBotFor(choice);
  if (model === undefined && bot === undefined) {
    return undefined;
  }
  return buildPlayedTargetModel({
    candidates: model?.cards ?? [],
    ...(bot !== undefined ? {stands: bot} : {}),
    players: props.playerView.players,
    viewerColor: thisPlayer.value.color,
    // ONE selection instruction. The step's own contract line already says
    // «ВЫБЕРИТЕ РАЗЫГРАННУЮ КАРТУ · Доступных целей: N»; a boilerplate
    // server title under it just restates the effect the rule and the gain
    // chip have already stated. A title that names a real CONSTRAINT is not
    // boilerplate and keeps its line.
    ask: model === undefined || isBoilerplateTitle(model.title) || model.resourceGainPrompt?.genericTitle === true ? '' : textOf(model.title),
    // The card whose action this is — «Обстрел кометами» adds its asteroid
    // to ANY card, and it is one. That candidate becomes a HANDLE pointing
    // at the hero slot instead of a second full-size copy of the same card.
    sourceCardName: heroCardName.value,
    typeOf: (name) => getCard(name)?.type,
    // A NEGATIVE delta means the step takes FROM the chosen card, which is
    // what makes «your own card» a warning rather than the ordinary target.
    takesFromTarget: (choice.amount ?? 0) < 0,
    // The near misses of a step taking more than one — shown with the server's reason, never chosen.
    blocked: model === undefined ? [] : playedTargetShortfalls(model.disabledCards, choice.amount, (c) => textOf(c.disabledReason), model.resourceGainPrompt?.holdsAtLeast),
    preview: (name) => model === undefined ? [] : playedTargetPreview(choice, model, name),
    resourceContext: (_name, card) => playedTargetResourceContext(choice, card),
    // «КУДА: 1 [аэростат]» (TR56, П3) — the step's own amount, or (an option's target) the branch's «to a card» gain.
    payload: playedTargetPayloadOf(
      choice.amount !== undefined ? {amount: choice.amount, cardResource: choice.cardResource} : branchOnCardGain.value,
      model?.resourceGainPrompt),
  });
}
/** MarsBot beside the players in the table's one zone — its stand-in, read off its option's metadata. */
function tableTargetBotFor(choice: ComposerChoice): ReadonlyArray<{stand: TableTargetStand, ownerName: string}> | undefined {
  if (sub.value?.kind === 'playedTarget' && sub.value.choiceId === choice.id && sub.value.orItem !== undefined) {
    return undefined;
  }
  const stand = tableTargetBotStand(choice.input);
  if (stand === undefined) {
    return undefined;
  }
  const bot = props.playerView.players.find((p) => p.color === stand.color);
  return [{stand, ownerName: bot === undefined ? '' : participantDisplayName(bot)}];
}
function playedTargetInputFor(c: ComposerChoice): SelectCardModel | undefined {
  const open = sub.value?.kind === 'playedTarget' && sub.value.choiceId === c.id ? sub.value.orItem : undefined;
  // The table's one zone serves the players' card pick of the `or` (absent with a lone bot).
  if (open === undefined && tableTargetOf(c.input) !== undefined) {
    return tableTargetCardPick(c.input);
  }
  const input = (open ?? orDescents.value[c.id]?.item)?.nested ?? c.input;
  return input.type === 'card' ? (input as SelectCardModel) : undefined;
}
function playedTargetResourceContext(c: ComposerChoice, card: CardModel) {
  // A pick of ANY kind (P43's «a resource on any card with a resource») names no kind of its own — each candidate
  // takes ITS OWN, the server's per-card marker (`cardResourceByCard`); a bare «resource» key drew no sprite.
  const byCard = (c.input as {resourceGainPrompt?: {cardResourceByCard?: Partial<Record<string, string>>}}).resourceGainPrompt?.cardResourceByCard;
  return playedTargetResourceFor(c.amount, c.cardResource ?? byCard?.[card.name], card);
}
/** Move the cursor inside the step — BY WHERE THE CARDS ARE (the index walk
 *  survives only as the answer for a step that has not measured yet). */
function movePlayedTarget(dir: NavDirection): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const owners = playedTargetModel.value?.owners ?? [];
  const map: Record<string, PlayedTargetNavDir | undefined> = {
    left: 'left', right: 'right', up: 'up', down: 'down',
  };
  const d = map[dir as string];
  if (d === undefined) {
    return;
  }
  const step = targetStep.value ?? undefined;
  const cells = step?.cells?.() ?? [];
  const next = cells.length > 0 ?
    stepPlayedTargetFocusVia(step, sub.value.focus, d, cells) :
    stepPlayedTargetFocus(sub.value.focus, d, owners, playedTargetLayout.value);
  if (next === undefined) {
    return; // an edge HOLDS — never a wrap, never a silent owner change
  }
  sub.value = {...sub.value, focus: next};
  scrollPlayedTargetFocused();
}
/** The STEP owns its candidate viewport — the rail and the contract sit
 *  outside it, so this never moves them. */
function scrollPlayedTargetFocused(): void {
  targetStep.value?.ensureFocusVisible?.();
}
/** LB/RB — the owner axis, tabbed mode only (in split both groups are on
 *  screen and the d-pad crosses between them spatially). */
function cyclePlayedTargetOwner(delta: number): void {
  // A PAGED band (the owner, 2026-11-02): LB/RB turn its page where they walk nothing else (one band / the split).
  if (sub.value?.kind === 'playedTarget') {
    const turned = turnPlayedTargetPageVia(targetStep.value, sub.value.focus, delta);
    if (turned !== undefined) {
      sub.value = {...sub.value, focus: turned};
      scrollPlayedTargetFocused();
      return;
    }
  }
  if (sub.value?.kind !== 'playedTarget' || (playedTargetLayout.value.mode !== 'tabs' && playedTargetLayout.value.mode !== 'board')) {
    return;
  }
  const owners = playedTargetModel.value?.owners ?? [];
  const ownerId = stepPlayedTargetOwner(sub.value.focus.ownerId, delta, owners);
  if (ownerId === sub.value.focus.ownerId) {
    return;
  }
  // `board` (the table's one zone): every band is on screen — LB/RB JUMP to the next band's first card, in frame.
  if (playedTargetLayout.value.mode === 'board') {
    sub.value = {...sub.value, focus: reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? sub.value.focus};
    scrollPlayedTargetFocused();
    return;
  }
  const remembered = playedTargetOwnerFocus.value[ownerId] ?? 0;
  playedTargetOwnerFocus.value = {...playedTargetOwnerFocus.value, [sub.value.focus.ownerId]: sub.value.focus.index};
  sub.value = {...sub.value, focus: reseatPlayedTargetFocus({ownerId, index: remembered}, owners) ?? sub.value.focus};
  // The remembered card of the new tab may stand below the fold.
  scrollPlayedTargetFocused();
}
/** A in a MULTI ask toggles instead of choosing. */
function togglePlayedTarget(): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const selection = playedTargetSelection.value;
  if (selection.mode !== 'multi') {
    return;
  }
  const candidate = playedTargetAt(sub.value.focus, playedTargetModel.value?.owners ?? []);
  if (candidate === undefined || candidate.blocked !== undefined) {
    return;
  }
  sub.value = {
    ...sub.value,
    picked: togglePlayedTargetPick(sub.value.picked, candidate.cardName, selection.max),
  };
}
/** RT — submit a MULTI ask. */
function confirmPlayedTargetPicks(): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const choice = playedTargetChoice.value;
  const selection = playedTargetSelection.value;
  if (choice === undefined || selection.mode !== 'multi' || !playedTargetPicksValid(selection)) {
    return;
  }
  const cards = [...sub.value.picked] as Array<CardName>;
  multiPicks.value[choice.id] = cards;
  const orItem = sub.value.orItem;
  if (orItem !== undefined) {
    answerNestedOr(choice, orItem, String(cards.length), {type: 'card', cards});
    return;
  }
  picks.value[choice.id] = String(cards.length);
  captureFor(choice, {type: 'card', cards});
  sub.value = undefined;
  // The answer is in: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/** A — lock the focused candidate in as this choice's target. */
function confirmPlayedTarget(): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const owners = playedTargetModel.value?.owners ?? [];
  const candidate = playedTargetAt(sub.value.focus, owners);
  const choice = playedTargetChoice.value;
  // A shown near miss is never chosen — the rail reads why, the bar's A is dim.
  if (candidate === undefined || choice === undefined || candidate.blocked !== undefined) {
    return;
  }
  // THE TABLE'S ONE ZONE: the answer goes into its branch — the bot's option, or the players' card pick — byte for
  // byte the response the old list sent.
  const table = sub.value.orItem === undefined ? tableTargetOf(choice.input) : undefined;
  if (table !== undefined && isTableTargetStand(candidate.cardName)) {
    const botItem = buildOrItems(choice.input as OrOptionsModel).find((it) => it.optionIndex === table.botBranch);
    if (botItem === undefined) {
      return;
    }
    delete orDescents.value[choice.id];
    const results = {...playedTargetResults.value};
    delete results[choice.id];
    playedTargetResults.value = results;
    picks.value[choice.id] = String(table.botBranch);
    captureFor(choice, orItemResponse(botItem));
    sub.value = undefined;
    landCursor();
    scrollFocused();
    return;
  }
  playedTargetResults.value = {
    ...playedTargetResults.value,
    [choice.id]: playedTargetResultOf(candidate, owners, playedTargetVersion.value),
  };
  // The capture is the same shape every card pick uses — the rich result is
  // presentation context, never a second source of truth… and when the step
  // is answering an OR-BRANCH, that same shape nests into the branch.
  const orItem = sub.value.orItem ?? (table !== undefined ?
    buildOrItems(choice.input as OrOptionsModel).find((it) => it.optionIndex === table.cardBranch) : undefined);
  if (orItem !== undefined) {
    answerNestedOr(choice, orItem, candidate.cardName, {type: 'card', cards: [candidate.cardName]});
    return;
  }
  captureFor(choice, {type: 'card', cards: [candidate.cardName]});
  picks.value[choice.id] = candidate.cardName;
  sub.value = undefined;
  // The answer is in: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/** X inside the step — the FOCUSED candidate fullscreen, lifting from its
 *  own slot (the console-wide «X inspects the current object»). */
function inspectPlayedTarget(): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const owners = playedTargetModel.value?.owners ?? [];
  const candidate = playedTargetAt(sub.value.focus, owners);
  // The bot's stand-in is no card — X has nothing to lift there.
  if (candidate === undefined || candidate.stand !== undefined) {
    return;
  }
  // THE ONE DOOR (`openPlayedTargetZoom`): the self-target resolves to the hero card this action is composed on,
  // every card carries its TARGET DOSSIER (what lies on it, what this move does to it). Scoped to this composer's own
  // root, never `document`.
  if (playedTargetModel.value !== undefined) {
    openPlayedTargetZoom({model: playedTargetModel.value, cardName: candidate.cardName, getRoot: () => rootEl.value ?? undefined});
  }
}
/** The summary of an answered played-target choice (undefined = unanswered
 *  or gone stale — a target whose card left the table is never shown as
 *  chosen, and never submitted). */
function playedTargetResult(c: ComposerChoice): PlayedTargetResult | undefined {
  const result = playedTargetResults.value[c.id];
  // PAST THE PRESS an answer is a RECEIPT, not a live pick: it is what the batch SENT. The response moves the
  // game version (and the chosen card's own count) while the commit's phrase still plays on this very screen —
  // judged «stale» there, the row painted the amber «выберите…» over a card already chosen and sent. …and it
  // stays a receipt while THIS commit's rail half is still in the air (PL-430, TR53): the answer clears
  // `submitting`, and the row whose miniature the unit lands on vanished one link before the landing.
  if (result !== undefined && (submitting.value ||
      (actionCommitRailState.card === sourceKey.value && actionCommitRailState.phase !== 'idle'))) {
    return result;
  }
  // Judged against ITS OWN choice's candidates — a second played-card pick of the same composer has others.
  const owners = playedTargetModelFor(c)?.owners ?? [];
  return playedTargetResultLive(result, owners, playedTargetVersion.value) ? result : undefined;
}
/**
 * A row miniature's LIVE card — the viewer's own tableau model, its capsule read as the player should see it:
 * while the commit's rail half still has a token to take off (or bring to) this card, the count it had before
 * that token moved (`heldCardCapsule`). Undefined for a card of another seat: the printed face.
 */
function summaryCardModel(name: CardName): CardModel | undefined {
  const model = thisPlayer.value.tableau.find((c) => c.name === name);
  if (model === undefined || !actionCommitRailHoldsCapsule(name)) {
    return model;
  }
  return {...model, resources: Math.max(0, (model.resources ?? 0) - heldCardCapsule(name))};
}
/** The target row's label when it carries no payload — the role once answered, the server's ask before. */
function targetRowLabel(c: ComposerChoice): string {
  if (playedTargetResult(c) !== undefined) {
    return translateText(cardPickRoleKey(c.amount));
  }
  // A spend's SOURCE asks by its direction (PL-056 — «Выберите карту-источник», never «выберите себе карту»).
  return (c.amount ?? 0) < 0 ? translateText(cardPickAskKey(c.amount)) : choiceTitle(c);
}
/** WHAT LANDS on the card the row chooses (TR56) — the same payload the open step's header reads. */
function targetRowPayload(c: ComposerChoice): PlayedTargetPayload | undefined {
  return playedTargetPayloadOf(
    c.amount !== undefined ? {amount: c.amount, cardResource: c.cardResource} : branchOnCardGain.value,
    playedTargetInputFor(c)?.resourceGainPrompt);
}
/** The chosen card's LIVE model — its capsule held while a token of the commit still has to reach it. */
function targetRowModel(c: ComposerChoice): CardModel | undefined {
  const name = playedTargetResult(c)?.cardName;
  return name === undefined ? undefined : summaryCardModel(name);
}
/** The chosen candidate's outcome tag — the step's own line under that card (PL-219), read again on the row. */
function targetRowTag(c: ComposerChoice): PlayedTargetTag | undefined {
  const result = playedTargetResult(c);
  return result === undefined ? undefined : playedTargetTagOfPreview(result.preview);
}
/** The summary's compact impacts — the SAME derivation the focus rail uses,
 *  capped shorter. Comparison is over; the summary is not a smaller rail. */
function targetSummaryImpacts(c: ComposerChoice): ReadonlyArray<PlayedTargetQuickImpact> {
  const result = playedTargetResult(c);
  if (result === undefined) {
    return [];
  }
  return playedTargetReadingImpacts(result.preview).slice(0, PLAYED_TARGET_SUMMARY_IMPACT_CAP);
}
/** Hand a hand-card pick to the HAND SECTION (consoleHandPick bridge): the
 *  shell hides the Action Center (v-show — every capture survives), the
 *  player picks on the real cards, the result captures back here. A re-open
 *  (A = «Изменить») pre-seeds the previous selection.
 *
 *  …at EVERY depth: `orItem` is an option of an `or` choice whose own
 *  question is that pick — the album answers it, the answer is wrapped back
 *  into that option (`answerNestedOr`), and B in the album returns to the
 *  option list (one level). Nothing leaves the hand here: it is a
 *  PRE-SELECT, the card goes when the action's ONE POST is answered. */
function openHandPick(c: ComposerChoice, orItem?: ConsoleOrItem): void {
  const model = (orItem?.nested ?? c.input) as SelectCardModel;
  const reasons: Record<string, string> = {};
  for (const d of model.disabledCards ?? []) {
    reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
  }
  const multi = (model.max ?? 1) > 1;
  const answered = orItem !== undefined ? nestedAnswerOf(c) : undefined;
  const prior = orItem !== undefined ?
    (answered !== undefined && orDescents.value[c.id]?.item.optionIndex === orItem.optionIndex ? answered.pick.split(NESTED_PICK_SEP) : []) as Array<CardName> :
    (multi ?
      [...(multiPicks.value[c.id] ?? [])] as Array<CardName> :
      (picks.value[c.id] !== undefined ? [picks.value[c.id] as CardName] : []));
  const gain = c.multiSelect?.revealGain;
  // A per-CARD exchange the server declares on the discard (Open IP Trade: «per card discarded: +3 M€ AND draw a
  // card») drives the album's running sum, the server's own rate — never a per-TAG one (the Reds' recycle counts
  // the thrown cards' tags; the album's header counts it on its own).
  const exchange = model.discardPrompt?.exchange;
  const perCard = exchange !== undefined && exchange.perTag === undefined ?
    {icon: exchange.icon, amount: exchange.amount, ...(exchange.draw !== undefined ? {cards: exchange.draw} : {})} : undefined;
  enterConsoleHandPick({
    title: model.title,
    buttonLabel: model.buttonLabel || 'Select',
    selectable: model.cards.map((cd) => cd.name),
    reasons,
    min: model.min ?? 1,
    max: model.max ?? 1,
    selected: prior,
    gainPerCard: gain !== undefined ? {icon: gain.resource, amount: gain.amount} : perCard,
    // The pick surface names the operation it serves — the player keeps
    // the WHY while the focus stage waits hidden underneath.
    source: handPickSource(),
    // The server's own DISCARD marker, raw (the album's discard skin), and a pre-select leaves nothing.
    discard: model.discardPrompt,
    leaving: 'none',
    // An optional choice's refusal — a button inside the album, never a row before it.
    decline: orItem !== undefined ? choiceDecline(c) : undefined,
  }, (cards) => {
    // Re-locate by id — the preview may have refreshed under the pick.
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    if (orItem !== undefined) {
      if (cards.length > 0 || (model.min ?? 1) === 0) {
        answerNestedOr(cur, orItem, cards.join(NESTED_PICK_SEP), {type: 'card', cards: [...cards]});
      }
      return;
    }
    if (multi) {
      multiPicks.value[cur.id] = [...cards];
      picks.value[cur.id] = String(cards.length);
      captureFor(cur, {type: 'card', cards: [...cards]});
    } else if (cards.length > 0) {
      picks.value[cur.id] = cards[0];
      captureFor(cur, {type: 'card', cards: [cards[0]]});
    }
    // The album answered: the ONE rule lands the cursor (T14 · CC).
    landCursor();
    scrollFocused();
  }, () => {
    // B in the album: an option's pick returns to the option list it was opened from, cursor on that option (a
    // pick opened straight from its row returns to the row — `orListSub`).
    if (orItem !== undefined) {
      sub.value = orListSub(c.id, orItem);
    }
  }, () => {
    // RT in the album — the DECLINE: the choice is answered with its refusal, the composer takes the row back.
    answerDecline(allChoices.value.find((x) => x.id === c.id) ?? c);
  });
}
/**
 * The commit's witness (`preselectWitness.armPostCommitWitness`): the forecast's askers, and what this composer
 * hands on with its reason — a forecast question with no pre-select, a follow-up the server declared («ДАЛЕЕ»).
 */
function armCommitWitness(branch: ActionPreviewBranch): void {
  const forecast = props.preview?.forecast;
  const pos = selectedPos.value;
  const facts = [...(forecast?.facts ?? []), ...(pos !== undefined ? forecast?.byBranch?.[pos] ?? [] : [])];
  const asks = facts.filter((f) => f.certainty === 'asks');
  const honest: Array<HonestFollowUp> = asks.filter((f) => f.preselect === undefined).map((f) => ({card: f.source.name, role: '*'}));
  if (afterConfirmSteps(branch).length > 0) {
    honest.push({card: sourceKey.value, role: '*'});
  }
  armPostCommitWitness(sourceKey.value, asks.map((f) => f.source.name), honest);
}
/** A click on a variant tile — the same SELECT as A on it (never a commit). */
function pickBranchAt(index: number): void {
  settled.value?.around();
  const pos = branchItemPositions.value[index];
  if (pos !== undefined && sub.value === undefined) {
    selectBranch(pos);
    // The mouse speaks the pad's grammar: an answer lands the cursor by the ONE rule.
    landCursor();
    scrollFocused();
  }
}
function selectBranch(pos: number): void {
  if (selectedPos.value === pos || !branches.value[pos]?.available) {
    return;
  }
  selectedPos.value = pos;
  // Branch-specific captures reset (desktop selectBranch parity); the
  // preSteps stay captured (branch-independent).
  captured.value = {};
  venusParts.value = {};
  capturedOption.value = undefined;
  capturedOptionParts.value = {};
  picks.value = {};
  multiPicks.value = {};
  orDescents.value = {};
  // …and the variant's TARGET answer (TR56, П5) — `step#0` names every branch's first step alike.
  playedTargetResults.value = keepPlayAnswers(playedTargetResults.value);
  seeded.value = keepPlayAnswers(seeded.value);
  amounts.value = {};
  repeatResult.value = undefined;
  for (const c of branchChoiceList.value) {
    seedChoice(c);
  }
}
// SUB state (a pick list / payment): A(primary) pick/close, X(inspect) zoom
// the list card, B back, LB/RB(prev/nextSection) adjust payment, RT max.
function onSubPress(action: ConsoleAction): void {
  const subNow = sub.value;
  if (subNow === undefined) {
    return;
  }
  if (subNow.kind === 'wild') {
    if (subNow.focus.zone === 'card' && wildTargetModel.value !== undefined) {
      if (action === 'primary') {
        wildTargetChoose();
        return;
      }
      if (action === 'prevSection' || action === 'nextSection') {
        const turned = turnPlayedTargetPageVia(wildTargetStep.value, wildTargetFocusShown.value, action === 'nextSection' ? 1 : -1);
        if (turned !== undefined) {
          wildTargetFocusRaw.value = turned;
          wildTargetStep.value?.ensureFocusVisible?.();
        }
        return;
      }
      if (action === 'inspect') {
        wildTargetInspect();
        return;
      }
    }
    if (action === 'primary' || action === 'back' || action === 'prevSection' || action === 'nextSection' || action === 'nextTab') {
      wildStepPress(action);
    }
    return;
  }
  if (subNow.kind === 'venus') {
    if (action === 'inspect' && subNow.focus.zone === 'pick') {
      venusStep.value?.pickInspect();
      return;
    }
    if (action === 'primary' || action === 'back' || action === 'prevSection' || action === 'nextSection' || action === 'nextTab') {
      venusStepPress(action);
    }
    return;
  }
  // The EMBEDDED played-target step owns its own grammar: A chooses (or
  // toggles in a multi ask, with RT to submit), X inspects the FOCUSED
  // candidate, LB/RB walk the owner tabs, B is one level back into the
  // action's own decision column.
  if (subNow.kind === 'playedTarget') {
    switch (action) {
    case 'primary':
      if (playedTargetSelection.value.mode === 'multi') {
        togglePlayedTarget();
      } else {
        confirmPlayedTarget();
      }
      return;
    case 'nextTab':
      // RT submits a merged up-to-N ask; on a single pick that answers an OPTIONAL choice it is the DECLINE.
      if (playedTargetSelection.value.mode === 'multi') {
        confirmPlayedTargetPicks();
      } else if (subDecline.value !== undefined && playedTargetChoice.value !== undefined) {
        answerDecline(playedTargetChoice.value);
      }
      return;
    case 'inspect':
      inspectPlayedTarget();
      return;
    case 'prevSection':
    case 'nextSection':
      cyclePlayedTargetOwner(action === 'prevSection' ? -1 : 1);
      return;
    case 'back':
      // ONE LOGICAL LEVEL: a step that is answering an or-branch folds back
      // to the branch list it opened from, never straight out to the
      // decision column — the player would lose the pick they just made.
      sub.value = subNow.orItem !== undefined ? orListSub(subNow.choiceId, subNow.orItem) : undefined;
      scrollFocused();
      return;
    default:
      return;
    }
  }
  switch (action) {
  case 'primary':
    if (subNow.kind === 'payment') {
      // «Готово» — fold the editor back; the mix is KEPT (payCounts is the
      // single source of truth shared by both densities).
      if (paymentView.value?.status.ok === true) {
        closePaymentEditor();
      }
      return;
    }
    pickListItem(subNow.index);
    return;
  case 'inspect':
    if (subNow.kind === 'list' || subNow.kind === 'orNested') {
      inspectListItem(subNow.index);
    }
    return;
  case 'back':
    sub.value = subNow.kind === 'orNested' ? orListSub(subNow.choiceId, subNow.item) : undefined;
    return;
  case 'prevTab':
    // The trigger that expanded the block folds it back — a toggle, so the
    // density switch can never trap the player.
    if (subNow.kind === 'payment') {
      closePaymentEditor();
    }
    return;
  case 'prevSection':
  case 'nextSection':
    if (subNow.kind === 'payment' && subChoice.value !== undefined) {
      adjustPayment(subChoice.value, subNow.index, action === 'prevSection' ? -1 : 1);
    }
    return;
  case 'nextTab':
    if (subNow.kind === 'payment' && subChoice.value !== undefined) {
      adjustPayment(subChoice.value, subNow.index, 0, true);
      return;
    }
    // …and on an OPTIONAL choice RT is its DECLINE (the refusal is a button, never a row, never B).
    if (subDecline.value !== undefined && subChoice.value !== undefined) {
      answerDecline(subChoice.value);
    }
    return;
  default:
    return;
  }
}
/** The DECLINE of a choice that is an optional choice whose refusal is a button (a yes / no keeps its two cards). */
function choiceDecline(c: ComposerChoice): DeclineModel | undefined {
  const oc = optionalChoiceOf(c.input);
  return declineIsButton(oc) ? oc.decline : undefined;
}
/** The choice is answered with its DECLINE — the same capture a picked decline row once made. */
function answerDecline(c: ComposerChoice): void {
  const oc = optionalChoiceOf(c.input);
  if (!declineIsButton(oc)) {
    return;
  }
  delete orDescents.value[c.id];
  picks.value[c.id] = String(oc.decline.index);
  captureFor(c, declineResponse(oc));
  // A decline is the player's own answer — a seed it replaces lets go (or the reseat would put it back).
  dropSeed(c);
  sub.value = undefined;
  // A decline is an answer like any other: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/** Forget a row's seed mark and the target result it wrote — the row now holds the player's own answer. */
function dropSeed(c: ComposerChoice): void {
  if (seeded.value[c.id] === undefined) {
    return;
  }
  const {[c.id]: _seed, ...seededNow} = seeded.value;
  const {[c.id]: _result, ...results} = playedTargetResults.value;
  seeded.value = seededNow;
  playedTargetResults.value = results;
}
/** The ONE pick an optional choice offers beside its decline (`undefined` = not that shape, or not drawable here). */
function optionalPickItem(c: ComposerChoice): ConsoleOrItem | undefined {
  const oc = optionalChoiceOf(c.input);
  if (!declineIsButton(oc) || oc.pick === undefined) {
    return undefined;
  }
  const item = buildOrItems(c.input as OrOptionsModel).find((it) => it.optionIndex === oc.pick);
  return item !== undefined && nestedPickHostable(item) ? item : undefined;
}
/**
 * An optional choice whose ONE answer is a pick (Mars University's discard) has no list: A on its row opens that
 * pick directly through the same door a descent takes (`descendOrBranch`), the decline inside it. `false` = not
 * this shape.
 */
function openOptionalPick(c: ComposerChoice): boolean {
  const item = optionalPickItem(c);
  if (item === undefined) {
    return false;
  }
  descendOrBranch(c, item);
  return true;
}
function pickListItem(index: number): void {
  const subNow = sub.value;
  const c = subChoice.value;
  if (subNow === undefined || (subNow.kind !== 'list' && subNow.kind !== 'orNested') || c === undefined) {
    return;
  }
  const item = listItems.value[index];
  if (item === undefined || item.disabled) {
    return;
  }
  // ONE LEVEL DEEPER — the branch's own answer, nested into its or-response.
  if (subNow.kind === 'orNested') {
    const nested = subNow.item.nested;
    if (nested?.type === 'card' && item.card !== undefined) {
      answerNestedOr(c, subNow.item, item.card.name, {type: 'card', cards: [item.card.name]});
    } else if (nested?.type === 'player' && item.color !== undefined) {
      answerNestedOr(c, subNow.item, item.color, {type: 'player', player: item.color});
    }
    return;
  }
  if (c.input.type === 'card' && item.card !== undefined) {
    picks.value[c.id] = item.card.name;
    captureFor(c, {type: 'card', cards: [item.card.name]});
  } else if (c.input.type === 'player' && item.color !== undefined) {
    picks.value[c.id] = item.color;
    captureFor(c, {type: 'player', player: item.color});
  } else if (c.input.type === 'or' && item.orItem !== undefined) {
    // A NESTED-input branch is not an answer — it is the next question.
    if (item.orItem.nested !== undefined) {
      descendOrBranch(c, item.orItem);
      return;
    }
    // `orItemResponse` — the shared byte-parity builder, not a hand-rolled
    // literal: the index it submits is the option's OWN index, so a list
    // that ever grows informational `disabledOptions` rows cannot shift it.
    delete orDescents.value[c.id];
    picks.value[c.id] = String(item.orItem.optionIndex);
    captureFor(c, orItemResponse(item.orItem));
  }
  sub.value = undefined;
  // The answer is in: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/**
 * DESCEND into an or-branch that is itself an input — WHERE it is answered
 * is ONE verdict (`handPickRouting.orOptionDoor`), shared with the play
 * composer.
 *
 * A pick FROM THE HAND opens the hand album (the owner's hard rule
 * 2026-10-13 — a card from the hand is chosen IN the hand at every depth;
 * this branch used to give it «the flat premium list», a column of names).
 * A nested card pick that lands ENTIRELY on played tableaux opens the SAME
 * embedded target step a bare card pick opens: it is the same decision
 * («у какой карты забрать животное»), and a bot option sitting above it in
 * the list is no reason for pointing at a card to feel different. Anything
 * else (a player pick, cards the console has no shelf for) gets the list.
 */
function descendOrBranch(c: ComposerChoice, item: ConsoleOrItem): void {
  const door = orOptionDoor(item.nested, handNamesSet.value, playedNamesSet.value);
  if (door === 'hand') {
    // The option list stays this composer's level while the album answers; the answer (`answerNestedOr`) closes
    // it, B in the album returns to it.
    openHandPick(c, item);
    return;
  }
  if (door === 'table') {
    openPlayedTargetStep(c, item);
    // …and a descent ALWAYS lands somewhere. The step closes itself when it
    // finds nothing to point at, and dropping the player out of the pick
    // entirely there would lose the branch list they were standing in.
    if (sub.value?.kind === 'playedTarget') {
      return;
    }
  }
  sub.value = {kind: 'orNested', choiceId: c.id, item, index: 0};
}
/** The nested branch answered: ONE capture (`{type:'or', index, response}`),
 *  and the branch + its value remembered so the collapsed row can say WHICH
 *  card was chosen rather than repeating the question. */
function answerNestedOr(c: ComposerChoice, item: ConsoleOrItem, pick: string, response: unknown): void {
  orDescents.value = {...orDescents.value, [c.id]: {item, pick}};
  picks.value[c.id] = String(item.optionIndex);
  captureFor(c, orItemResponse(item, response));
  sub.value = undefined;
  // The answer is in: the ONE rule lands the cursor (T14 · CC).
  landCursor();
  scrollFocused();
}
/** B out of a nested descent → the OR LIST it came from (ONE logical level),
 *  cursor on the branch row it opened. */
function orListSub(choiceId: string, item: ConsoleOrItem): SubState | undefined {
  const c = allChoices.value.find((x: ComposerChoice) => x.id === choiceId);
  if (c === undefined || c.input.type !== 'or') {
    return undefined;
  }
  // A pick opened straight from its row (an optional choice's one answer) has no list above it — B is the row.
  if (optionalPickItem(c)?.optionIndex === item.optionIndex) {
    return undefined;
  }
  // The list the player came from — without the decline, which is no row (`listItems`).
  const declineAt = choiceDecline(c)?.index;
  const at = buildOrItems(c.input as OrOptionsModel).filter((it) => it.optionIndex !== declineAt)
    .findIndex((it) => it.optionIndex === item.optionIndex);
  return {kind: 'list', choiceId, index: Math.max(0, at)};
}
/** Candidate rows of a NESTED-input or-branch (its own `SelectCard` /
 *  `SelectPlayer`), in the SAME premium vocabulary the flat lists use. */
function nestedListItems(c: ComposerChoice, item: ConsoleOrItem): ReadonlyArray<ListItem> {
  const nested = item.nested;
  const answered = orDescents.value[c.id];
  const chosen = answered?.item.optionIndex === item.optionIndex ? answered.pick : undefined;
  if (nested?.type === 'card') {
    const model = nested as SelectCardModel;
    const items: Array<ListItem> = model.cards.map((card): ListItem => cardListItem(c, card, chosen === card.name, false));
    for (const card of model.disabledCards ?? []) {
      items.push(cardListItem(c, card, false, true));
    }
    return items;
  }
  if (nested?.type === 'player') {
    const model = nested as SelectPlayerModel;
    const items: Array<ListItem> = model.players.map((color): ListItem => playerListItem(model, color, chosen === color, false, undefined));
    for (const d of model.disabledPlayers ?? []) {
      items.push(playerListItem(model, d.color, false, true, d.reason));
    }
    return items;
  }
  return [];
}
/** What the Parliament takes the stage from — the hero column and the decision column together (its zone is their sibling). */
function setupLayers(): Array<HTMLElement> {
  const root = rootEl.value ?? undefined;
  return Array.from(root?.querySelectorAll<HTMLElement>('.con-composer__actmain') ?? []);
}
function cancelSetupFades(): void {
  parliamentSetupFades.forEach((fade) => fade.cancel());
  parliamentSetupFades = [];
}
/**
 * RELEASE — the setup lets go ON THE SPOT while the Parliament rises out of the same rect: one surface advancing,
 * never a swap. Once let go, the setup is PARKED (`visibility: hidden` — it keeps its box, its state and its
 * captures), so nothing of it can surface again under the step or under the workspace's leave.
 *
 * ⚠️ THE TWO MOTIONS ARE ONE STYLE CHANGE, NOT A SCRIPTED CHASE. The step rises by its CSS entry
 * (`.con-parl--embedded`, a compositor animation that sits pending until the heavy mount yields its first
 * frame — measured 200+ ms on a cold table). Every scripted follower lagged it: a fade started at the push
 * left the column EMPTY for that window; one started on a `probeTick` poll or from the root's own
 * `animationstart` still waited a main-thread frame or two to commit, and on a loaded 4K runner the whole
 * Parliament stood over a fully lit setup for 50–250 ms (`console-martian-census` § the setup never shows
 * under a standing Parliament). So the release is CSS too — `con-composer--parlrise` (the same
 * `parliamentStepOn` that publishes the zone) — and both entries are committed in the SAME frame, pending
 * together, starting together. The script only PARKS the setup on its own `animationend`.
 */
function releaseSetupForParliament(): void {
  cancelSetupFades();
  const token = ++parliamentReleaseToken.value;
  const root = rootEl.value ?? undefined;
  if (consoleReducedMotionActive() || root === undefined) {
    parliamentSetupParked.value = true;
    return;
  }
  const onEnd = (event: AnimationEvent): void => {
    if (event.animationName !== 'con-composer-setup-release') {
      return;
    }
    root.removeEventListener('animationend', onEnd);
    if (token === parliamentReleaseToken.value && stageStepOn.value) {
      parliamentSetupParked.value = true;
    }
  };
  root.addEventListener('animationend', onEnd);
  // …and COMMITTED together is not STARTED together: the step's entry is a compositor animation on a cold layer,
  // the release a main-thread one — on a software renderer the release ran out a frame before the step rose (an
  // empty stage, CI 2026-11-05 `console-martian-census` § gaps). The release takes the entry's own start time
  // (`stepEntryClock.ts`), bound in the task the step is inserted in.
  syncReleaseToStepEntry({
    zones: Array.from(root.querySelectorAll('.con-composer__parlzone, .con-composer__handzone')),
    followers: () => Array.from(root.querySelectorAll('.con-composer__actmain'))
      .flatMap((el) => typeof el.getAnimations === 'function' ? el.getAnimations() : [])
      .filter((a) => (a as CSSAnimation).animationName === 'con-composer-setup-release'),
    alive: () => token === parliamentReleaseToken.value,
    maxMs: STEP_ENTRY_BIND_MAX_MS,
  });
}
/** RETURN — B out of the vote: the setup un-parks and surfaces where it stood, the cursor on the variant left. */
function restoreSetupFromParliament(): void {
  parliamentReleaseToken.value++;
  cancelSetupFades();
  parliamentSetupParked.value = false;
  if (consoleReducedMotionActive()) {
    return;
  }
  void nextTick(() => {
    const layers = setupLayers();
    if (layers.length === 0 || typeof layers[0].animate !== 'function') {
      return;
    }
    parliamentSetupFades = markRaw(layers.map((el) => el.animate([{opacity: 0}, {opacity: 1}],
      {duration: consoleMotionMs(STAGED_STEP_RELEASE_MS), easing: 'ease-out'})));
  });
}
// ── «THE LEDGER PAYS» — the walk (the plan and the state are `colonyLedger/colonyBonusPayout.ts`) ─────────
/** Untaken cards of the payout's own batches for `colony` (the reveal queue's truth). */
function ledgerUntaken(colony: string): number {
  return payoutUntaken(colony);
}
function ledgerFacts(): PayoutFacts {
  return {
    waitingFor: props.playerView.waitingFor,
    untaken: (colony: string) => ledgerUntaken(colony),
    inFlight: ledgerRequestInFlight.value,
  };
}
/** The next step, one row gap later — on the animation clock, never a wall clock. */
function queueLedgerAdvance(): void {
  ledgerGap?.();
  ledgerGap = motionAfter(consoleMotionMs(LEDGER_ROW_GAP_MS), 'the ledger walk\'s next row', () => {
    ledgerGap = undefined;
    advanceLedgerPayout();
  }, flow);
}
/**
 * THE STALL NET: the walk is waiting on something only the server can bring (a resource parked behind a
 * discard, a batch on its way). Bounded and honest — if nothing moved for the whole window AND the server owes
 * the walk nothing (no prompt of the payout's, no untaken batch, no request in flight), the walk ends where it
 * stands: every hold released, the flow free to leave, the confession on the root. A player reading a card is
 * never a stall (the server owes → the net re-arms).
 */
function armLedgerStall(): void {
  ledgerStall?.();
  ledgerStall = motionAfter(LEDGER_STALL_MS, 'the ledger walk\'s stall net', () => {
    ledgerStall = undefined;
    if (!ledgerPaying.value || colonyBonusPayout.done) {
      return;
    }
    if (payoutServerOwes(ledgerFacts()) || ledgerStepOn.value) {
      armLedgerStall();
      return;
    }
    console.warn('[colony-ledger] the payout stalled with nothing owed — ended', JSON.stringify(colonyBonusPayout.rows.map((r) => `${r.colony}:${r.kind}:${r.state}`)));
    finishColonyBonusPayout(true);
    emit('ledger-done');
  }, flow);
}
/**
 * ONE STEP OF THE WALK. The rows pay strictly in the ledger's order (the engine's own): a chips row flies its
 * wave from its printed bonus once the server has applied it; a draw / pairs row is paid by its STEP (the take,
 * the discard) and settles on server facts; then one read of the whole ledger, and the flow leaves.
 */
function advanceLedgerPayout(): void {
  if (!ledgerPaying.value || !colonyBonusPayout.answered || colonyBonusPayout.flying ||
      colonyBonusPayout.reading || ledgerGap !== undefined) {
    return;
  }
  if (colonyBonusPayout.done) {
    // A payout that ended while this stage was away (a restored park): the flow leaves.
    emit('ledger-done');
    return;
  }
  // A step has the column: the ledger is parked under it — nothing is born on a row nobody can see.
  if (ledgerStepOn.value) {
    return;
  }
  const row = nextPayoutRow();
  if (row === undefined) {
    beginLedgerRead();
    return;
  }
  if (row.kind === 'chips') {
    if (!row.ready) {
      // Not on the server yet (a resource onto a card lands behind Pluto's discard): the seeder re-asks.
      colonyBonusPayout.active = '';
      armLedgerStall();
      return;
    }
    flyLedgerRow(row);
    return;
  }
  if (row.kind === 'draw' || row.kind === 'pairs') {
    row.state = 'paying';
    colonyBonusPayout.active = row.colony;
    if (payoutRowSettled(row, ledgerFacts())) {
      row.state = 'paid';
      markPayoutRowLanded(row.colony);
      colonyBonusPayout.active = '';
      queueLedgerAdvance();
      return;
    }
    armLedgerStall();
    return;
  }
  // A benefit with no chip and no step of this flow (a discount, a loss): paid with the answer.
  row.state = 'paid';
  markPayoutRowLanded(row.colony);
  queueLedgerAdvance();
}
/** A chips row's wave: born on the row's printed bonus, landing on the rail — the counter ticks on the touchdown. */
function flyLedgerRow(row: PayoutRow): void {
  const root = rootEl.value ?? undefined;
  const card = sourceKey.value;
  const landed = (): void => {
    row.state = 'paid';
    markPayoutRowLanded(row.colony);
    colonyBonusPayout.flying = false;
    colonyBonusPayout.active = '';
    queueLedgerAdvance();
  };
  row.state = 'paying';
  ledgerStall?.();
  ledgerStall = undefined;
  if (consoleReducedMotionActive() || root === undefined) {
    // No flights: the counters and «received» at once.
    row.specs.forEach((spec) => releasePanelRewardHold(spec));
    landed();
    return;
  }
  colonyBonusPayout.flying = true;
  flyLedgerRows({
    root,
    scope: CARD_LEDGER_SCOPE,
    rows: [{colony: row.colony, specs: row.specs}],
    // The composer LEAVES after the walk: a resource onto a card this ledger does not show (Titan → a floater
    // holder) is born on its row, waits for the composer to go and lands on the uncovered satellite (PL-165).
    detachCovered: true,
    finished: () => !colonyBonusPayoutOf(card),
    onRow: (colony) => {
      if (colony !== '') {
        colonyBonusPayout.active = colony;
      }
    },
    onArrive: (spec) => releasePanelRewardHold(spec),
    onRelease: (r) => {
      // The ledger could not be measured: the counters tick honestly, and the stage confesses it.
      r.specs.forEach((spec) => releasePanelRewardHold(spec));
      colonyBonusPayout.degraded = true;
    },
  }, landed);
}
/** Every row has paid: the ledger stands for ONE read (RX07's own beat), then the flow leaves. */
function beginLedgerRead(): void {
  ledgerStall?.();
  ledgerStall = undefined;
  colonyBonusPayout.active = '';
  colonyBonusPayout.reading = true;
  motionAfter(consoleMotionMs(LEDGER_READ_MS), 'the ledger stands for its one read', () => {
    colonyBonusPayout.reading = false;
    colonyBonusPayout.done = true;
    emit('ledger-done');
  }, flow);
}
/**
 * ── ACTION COMMIT — the universal activation beat, for THIS branch. Armed and MEASURED synchronously at the
 *    press (the reward-wave origins are the live icon rects; the flight must never depend on this stage
 *    outliving the answer). Played by the composer's own confirm — and by a STAGED ACTION VOTE's confirm in
 *    the Parliament standing in this composer (TR15): the press is the mode's A, the beat is this card's.
 *    `heroParked` — the press is made on a step that took the WHOLE stage (the Parliament): the hero card stands
 *    under it, unseen, so nothing of the beat may be measured on it (the impulse would play over the step, a token
 *    would be born on a card nobody sees). The motion is skipped (its latch lands at once) and a price paid off the
 *    rail is absorbed at `price` — the step's own stand-in for the card's printed cost.
 */
function playCommitBeat(pressed: ActionPreviewBranch, opts: {spendDepartsElsewhere?: boolean, resultElsewhere?: boolean, heroParked?: {price: Element | undefined}} = {}): void {
  // A RATE «per card» is flown as the pick's TOTAL (Open IP Trade RX24 — 3 M€ per card discarded): the rail checks
  // the sum against the views, never the rate.
  // …and a political branch's card pick IS its option (the Scientists' / Manufacturing Run's «onto a card»): the
  // commit reads it as the step it is, so the token lands on the card the row shows — never the satellite.
  const asStep = optionPickAsStep(perCardTotals(pressed, capturedOption.value), captured.value, capturedOption.value);
  // A DIAL-BOUND branch (P49 · FA) prints no chips — its price and its result are the dial's X and the lane chosen:
  // read as chips here, the price leaves the hero's capsule first and the result is born after it.
  const dial = wildDial.value;
  const dialed = dial === undefined ? asStep.branch :
    withDialCommitEffects(asStep.branch, dial, asStep.captured, wildDialX.value, heroCardModel.value?.resources ?? 0,
      (resource) => venusStock.value[resource] ?? 0);
  // STANDALONE «?» STEPS (P50 · FC): «−1 ?» / «+1 ?» read as the resources their steps chose — the price leaves its row
  // first, the gain is born after it on the printed second «?».
  const branch = withWildStepCommitEffects(dialed, wildStepList.value, asStep.captured, (resource) => venusStock.value[resource] ?? 0);
  const stepAnswers = asStep.captured;
  // BOTH read the captures: a branch whose result is chosen in a step
  // («любой стандартный ресурс») has no chips of its own, so the category
  // and the reward wave are only knowable once the answer is in hand.
  // A captured STAGE-REWARD claim (Dutch Mountains) contributes the
  // claimed stage's own transfers/category the same way — through the
  // one reward view every hydro landing uses, structural off the track.
  const stageDraft = stageRewardDraft.value;
  const stageSpecs = stageDraft !== undefined ?
    deltaRewardCommitSpecs(stageDraft, props.playerView) : [];
  const stageFollowUp = stageDraft !== undefined ? HYDRO_STAGES[stageDraft.position]?.followUp : undefined;
  // «ALL YOUR COLONY BONUSES» (TR23): the result is printed as TEXT and is paid by the LEDGER below — row by
  // row, each from its own printed bonus. The commit carries NO reward of its own (a wave «from the card»
  // would fly the very gains the rows are about to pay, from the wrong place, and hold the rail twice) and
  // it answers no deck (a draw is a row's step, several beats away): the impulse runs the printed row, lands
  // on the result's own text, and the ledger's first row takes the weight.
  const ledgerBranch = branch.colonyBonuses !== undefined;
  const baseKind = ledgerBranch ? 'generic' : commitKindForBranch(branch, stepAnswers);
  // A DISCARD that BUYS a stock resource, answered in this composer's own step (P68 — «−X [card] → 2x [M€]»): ONE
  // token carrying the exchange's TOTAL, born on the printed icon, the row ticking once on its touchdown — the class
  // «a discard's payout is ONE wave for any source» (`discardExchangeBeat.ts`, ledgers CS · FD: the number that
  // flies is the number the header promised, never the rate N times).
  const discardSpecs = ledgerBranch ? [] : discardExchangeCommitSpecs(branch, stepAnswers);
  const kind = ledgerBranch ? 'generic' : stageFollowUp === 'draw' || stageFollowUp === 'reuse-action' ? 'draw' :
    (baseKind === 'generic' && (stageSpecs.length > 0 || discardSpecs.length > 0) ? 'resources' : baseKind);
  // THE RAIL HALF (PL-001 for actions): a direct TR, a capsule timeline's two movements, the table's answer —
  // held through `railReward` against the views, never by the shell's own wave (`consoleActionCommitRail.ts`).
  // A draw / a stage's own follow-up hosts its result in the workspace: no rail half there.
  // A SPEND taken off a card before the result (PL-064 in general — TR29's fighter from a CHOSEN card) rides the
  // half as its own link: the context it needs is the card-level source step with its answer, and which cards
  // are the viewer's own (only those counters stand on this surface and in the views the half is checked against).
  // …and a DRAW's own SPEND off the card (PL-201 — TR46's «all the data», TR02's 3 data, Aerial Mappers' floater) rides
  // it too, with no result link: the capsule's token leaves on its own beat, the deck answers the result.
  const railPlan = ledgerBranch ? undefined :
    commitRailPlan(commitSource.value, branch, stepAnswers,
      kind === 'draw' ? [] : reactionRailSpecs(forecastForFixedBranch(props.preview?.forecast, selectedPos.value ?? -1)?.facts), {
        preSteps: props.preview?.preSteps,
        preResponses: capturedPre.value,
        ownCard: (name) => thisPlayer.value.tableau.some((c) => c.name === name),
        departsElsewhere: opts.spendDepartsElsewhere === true,
        resultElsewhere: kind === 'draw' || opts.resultElsewhere === true,
        stockBesideDraw: kind === 'draw',
      });
  const specs = ledgerBranch ? [] : [
    ...(railPlan !== undefined ? commitWaveSpecs(commitSource.value, branch, stepAnswers, railPlan) : commitRewardSpecs(commitSource.value, branch, stepAnswers)),
    ...stageSpecs,
    ...(kind === 'draw' ? [] : discardSpecs),
  ];
  const root = rootEl.value ?? undefined;
  const wrap = opts.heroParked !== undefined ? undefined : root?.querySelector<HTMLElement>('.con-composer__actcardwrap') ?? undefined;
  const anchors = wrap !== undefined ? resolveActionCommitAnchors(wrap, props.actionGraphicNode) : undefined;
  // The ORIGINS ARE OBJECTS (T06 «оба конца живые»): each printed icon is re-measured at its token's birth — the
  // answer may land after the composer moved or folded, and a point cached here would birth a token where the
  // card no longer is.
  const origins = anchors !== undefined ? resolveGainIconEnds(anchors, specs) : specs.map(() => undefined);
  const srcRect = wrap?.getBoundingClientRect();
  // THE RESULT the impulse lands on: the wave's first gain, else the chain's (a spend's result rides the half).
  // A replaced unit's data (RX35) lands on — and is born on — the STRUCK printed icon (`bornOn`), never a data icon.
  const firstGain = specs[0] ?? railPlan?.reward.cause.find((spec) => spec.direction !== 'loss');
  const resultResource = firstGain?.bornOn ?? firstGain?.resource;
  // A spend is ABSORBED at the selected variant's printed result icon — the icon its result is then born on.
  const absorbEl = railPlan?.spendLinks !== undefined && anchors !== undefined ? resolveResultIcon(anchors, kind, resultResource) : undefined;
  const absorbRect = absorbEl?.getBoundingClientRect();
  const absorb = absorbRect !== undefined && absorbRect.width > 2 ? centreEndOf(absorbEl) : undefined;
  // A later link is born under a ring: the TR's (a timeline, a spend before a TR), else the spend's result.
  const ringRect = railPlan !== undefined && railPlan.links.length > 1 && anchors !== undefined ?
    (railPlan.reward.cause.some((spec) => spec.resource === RATING_RAIL_KEY) ? resolveResultIcon(anchors, 'rating')?.getBoundingClientRect() : absorbRect) :
    undefined;
  const spendLinks = new Set(railPlan?.spendLinks ?? []);
  // A CARD's spend is absorbed at the result icon (TR29); a PRICE off the RAIL lands on the printed icon of
  // that very cost in the variant's cost cluster (the rail-spend law) — «the plant goes in there».
  const costPoints = railPlan !== undefined && anchors !== undefined ? resolveSpendIconEnds(anchors, railPlan.reward.cause) : [];
  // …with the hero parked, a rail price is drawn into the step's stand-in for the printed cost (a card's own spend
  // is the step's flight, never a link here — `spendDepartsElsewhere`).
  const parkedPrice = opts.heroParked !== undefined ? centreEndOf(opts.heroParked.price) : undefined;
  const railOrigins = railPlan === undefined ? [] : anchors !== undefined ?
    resolveGainIconEnds(anchors, railPlan.reward.cause).map((origin, i) =>
      (spendLinks.has(i) ? (railPlan.reward.cause[i].channel === 'card-resource' ? absorb : (costPoints[i] ?? absorb)) : origin)) :
    railPlan.reward.cause.map((spec, i) => (spendLinks.has(i) && spec.channel !== 'card-resource' ? parkedPrice : undefined));
  armActionCommit({
    sourceCard: sourceKey.value,
    kind,
    specs,
    origins,
    // The hero's spawn band as an OBJECT (re-measured at the birth), and its point once for a caller without one.
    ...(wrap !== undefined && srcRect !== undefined && srcRect.width > 4 ? {source: {el: wrap, fx: 0.5, fy: 0.72}} : {}),
    sourcePoint: srcRect !== undefined && srcRect.width > 4 ?
      {x: srcRect.left + srcRect.width / 2, y: srcRect.top + srcRect.height * 0.72} : undefined,
    rail: railPlan === undefined ? undefined : {
      ...railPlan,
      origins: railOrigins,
      ring: ringRect !== undefined && ringRect.width > 2 ? {x: ringRect.left, y: ringRect.top, w: ringRect.width, h: ringRect.height} : undefined,
    },
  });
  commitHandle = runActionCommitMotion({
    cardWrapEl: wrap,
    ctaEl: root?.querySelector<HTMLElement>('.con-composer__cta') ?? undefined,
    actionNode: props.actionGraphicNode,
    kind,
    firstResource: resultResource,
    divertedSeal: firstGain?.bornOn !== undefined,
    // A RATING the law REFUSES (RX42): the printed TR icon takes the Reds' seal, apart from the landing.
    vetoSeal: (branch?.effects ?? []).some((e) => e.vetoed !== undefined),
    // The draw's causality: the impulse lands on the printed card-draw
    // icon and the HUD deck ANSWERS — right before the physical pull.
    onHandoff: kind === 'draw' || kind === 'deck-check' ? pulseDeckPile : undefined,
    onSettled: markActionCommitSettled,
  });
}
/**
 * WHERE THIS BRANCH LEADS, if anywhere — the branch's own runtime-navigation
 * step kind, published on the row.
 *
 * It is what the row IS, so it belongs on the row: a branch that ends on a
 * colony reads differently from one that ends here, and until now the only
 * evidence was a translated sentence. It also gives a driver (and a reader
 * of the DOM) the structural handle the contract forbids taking from text.
 */
function branchNavKind(pos: number): string | undefined {
  return runtimeNavigationSteps(branchAt(pos))[0]?.kind;
}
function inspectListItem(index: number): void {
  const item = listItems.value[index];
  if (item?.card === undefined) {
    return;
  }
  const cards = listItems.value.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
  const at = cards.findIndex((cd) => cd.name === item.card?.name);
  // Target options are TEXT rows, not card tiles → TEXTUAL inspector.
  openConsoleCardZoom(cards, Math.max(0, at), undefined, undefined, {contextLabel: 'Card actions', origin: {kind: 'textual'}});
}
/**
 * THE CARDS LEAVE AT THE COMMIT (P68): a discard this composer answered in its own step was a PRE-SELECT (nothing
 * left the hand at the pick), so the shared discard scene is armed HERE, synchronously at the press — the cards
 * leave from the dock, the transport holds the view until they have landed on the pile, and the commit's payout
 * wave (`discardExchangeCommitSpecs`) flies after it: the cause before the effect. Read off the step's SERVER
 * marker, never a title; an empty answer arms nothing.
 */
function armPreselectedDiscards(branch: ActionPreviewBranch): void {
  for (const d of preselectedDiscardsOf(branch.steps, captured.value)) {
    armPreselectedDiscard(d.names, d.meta);
  }
}
function submit(): void {
  const branch = selectedBranch.value;
  // THE BACKSTOP. The cursor rule is the real protection — the commit row
  // is not a stop while a requirement is waiting — but a mouse click, a
  // press that crossed a state change, or a repeat during a transition can
  // still arrive here. A refusal must never be silent: send the player TO
  // the thing that needs them, and flash it so the redirect is visible.
  const redirect = commitRedirectTarget(commitGate.value);
  if (redirect !== undefined) {
    focusIdx.value = redirect;
    scrollFocused();
    flashBlockingRequirement();
    return;
  }
  if (branch === undefined || !commitReady.value || ctaBusy.value || props.preview === undefined) {
    return;
  }
  // The press went: the commit's arrival (and its breath) is over.
  leaveCommit(commitArrival.value);
  // ── THE SECOND DOOR. A colony-trade branch commits NOTHING here: no
  //    floater spent, no card marked used, no action consumed, no request.
  //    It hands the player to the trade the server is already offering,
  //    with this card's payment path locked — the one confirm is on the
  //    colony. That is what makes B a real way back, and what makes the
  //    two entry points one action instead of two implementations.
  //    No commit ceremony either: the beat exists to fix the boundary
  //    «настраивал → активировал», and this press crosses no boundary.
  if (tradeEntryDoor.value !== undefined) {
    const door = tradeEntryDoor.value;
    emit('colony-trade', door.party !== '' ? {party: door.party} : {card: door.card});
    return;
  }
  // ── THE SAME DOOR, onto the Hydronetwork. Nothing is spent, nothing is
  //    marked used, nothing goes on the wire: the branch's runtime index
  //    travels with the offer so the workspace's own confirm can assemble
  //    the ONE batch that activates the card and makes the move together.
  if (deltaEntryDoor.value !== undefined) {
    emit('delta-advance', {offer: deltaEntryOffer.value, branchIndex: branch.index});
    return;
  }
  // ── THE VOTE'S FOURTH DOOR (Turmoil Redux TR15 — a blue card's ACTION places the delegate). The branch
  //    commits NOTHING here: no data spent, no card marked used, no request. The Parliament's vote mode stands
  //    up INSIDE this composer (a staged step of the action) and its confirm is the action's ONE POST — this
  //    batch with the resolution as its ADDRESSED tail. B there walks back to this very variant, every capture
  //    intact (this composer never unmounts). No commit beat here — it plays on the mode's A. The SAME v1
  //    boundary as the staged cell: a card-actions-ROOTED flow; anywhere else the action commits as usual
  //    and the grant is met LIVE, hosted by the nearest live step.
  if (voteEntryDoor.value !== undefined && props.publishCommands && repeatResult.value === undefined &&
      stageRewardDraft.value === undefined && workspaceStackRootKind() === 'card-actions') {
    emit('staged-vote', {
      branchIndex: branch.index,
      branchFor: branch.for,
      preResponses: orderedPreResponses(props.preview, capturedPre.value),
      optionResponse: capturedOption.value,
      stepResponses: orderedStepResponses(branch, captured.value),
      staged: voteEntryDoor.value,
      receipt: stagedVoteReceiptOf(branch),
    });
    return;
  }
  // ── A LAW'S PLAY WITH A REVERSIBLE DOOR (RX36 — the design rule of 2026-10-20): the composed card carries a
  //    cell / a delegate / a colony of its own. Nothing is sent and no commit beat plays: the shell plays the
  //    landing ritual in this stage and opens the door; THAT door's confirm is the one POST, B returns here.
  const lawPlay = lawPlayCaptured.value;
  if (lawPlay !== undefined && lawPlayStagedDoor(lawPlay) !== undefined && props.publishCommands) {
    emit('staged-law-play', {
      branchIndex: branch.index,
      optionResponse: capturedOption.value,
      stepResponses: orderedStepResponses(branch, captured.value),
      lawPlay,
    });
    return;
  }
  submitting.value = true;
  // STAGED PLACEMENT (docs/TILE_PLAY_STAGED_COMMIT.md): a branch whose Mars
  // placement the SERVER marked stage-able hands the screen to the BOARD
  // instead of committing — nothing is submitted here, the cell confirm on
  // the board is the action's one submit, and B there returns to this very
  // composer with every capture intact (the snapshot below). Only the
  // ACTING composer forks (`publishCommands` — the repeat-pick instance
  // captures a choice and must keep resolving through the bridge), and a
  // composed repeat / stage-reward keeps today's flow (the placement there
  // belongs to the copied action, a follow-up by design). No commit beat
  // plays — the action has not run yet.
  // BOUNDARY (v1): only a card-actions-ROOTED flow — the wheel's Action
  // Center. A composer standing inside another phase root (a start-flow
  // bonus window) keeps today's committed flow: the staged success
  // DISCARDS the yielded frames, and a phase root must survive its inner
  // flows.
  if (props.publishCommands && repeatResult.value === undefined && stageRewardDraft.value === undefined &&
      workspaceStackRootKind() === 'card-actions') {
    const stagedStep = branch.steps.find((s) => s.kind === 'boardPlacement' && s.staged !== undefined);
    if (stagedStep !== undefined && stagedStep.kind === 'boardPlacement' && stagedStep.staged !== undefined) {
      emit('staged-placement', {
        branchIndex: branch.index,
        branchFor: branch.for,
        preResponses: orderedPreResponses(props.preview, capturedPre.value),
        optionResponse: capturedOption.value,
        stepResponses: navigationDeferred.value ?
          plannedStepResponses(branch, captured.value) :
          orderedStepResponses(branch, captured.value),
        staged: stagedStep.staged,
        composerDraft: stagedComposerSnapshot(),
      });
      return;
    }
  }
  // «ALL YOUR COLONY BONUSES»: the ledger is FROZEN as the player read it — the rows that pay are these rows,
  // and so is the surface's box (measured NOW, in the layout the player pressed in).
  ledgerFrozen.value = branch.colonyBonuses;
  const surface = surfaceEl.value ?? undefined;
  ledgerSurfaceHeight.value = branch.colonyBonuses !== undefined && surface !== undefined && typeof getComputedStyle === 'function' ?
    getComputedStyle(surface).height : '';
  ledgerBodyPin.value = branch.colonyBonuses !== undefined ? bodyBlockPin(bodyEl.value ?? undefined) : '';
  // Capture the configuration surface's box NOW — the outcome unfolds from
  // it, and by the time that zone mounts this surface is already gone.
  armOutcomeOrigin(rootEl.value ?? undefined);
  // ── ACTION COMMIT — the universal activation beat. Armed and MEASURED
  //    synchronously at the press (the reward-wave origins are the live
  //    icon rects; the flight must never depend on this stage outliving
  //    the answer). The nested repeat-pick composer only CAPTURES a
  //    choice — no server activation, no commit beat there.
  if (props.publishCommands) {
    playCommitBeat(branch);
    armPreselectedDiscards(branch);
    commitSent.value = true;
    // «STRICTLY PRE-SELECT» (TR51): no choice of this card after the press that this composer did not collect or
    // hand on. A DOOR (a trade, the Hydronetwork, a vote) and a repeat run other prompts by design — not watched.
    if (repeatResult.value === undefined && runtimeNavigationSteps(branch).length === 0) {
      armCommitWitness(branch);
    }
  }
  // The Venus bonus this composer pre-selected flies off its cell once the board tells the step (P89 · EL) — armed
  // here for a nested repeat composer too (Viron, Project Inspection, R&D Funding, the Hydronetwork's stage 7): its
  // answer rides the copier's commit, and the promise waits for the response in which the scale reaches the cell.
  armVenusPreselects(branch);
  emit('confirm', {
    branchIndex: branch.index,
    // The branch slot's pre-select address — the server's (`ActionPreviewBranch.for`).
    branchFor: branch.for,
    preResponses: orderedPreResponses(props.preview, capturedPre.value),
    optionResponse: capturedOption.value,
    // The repeat step (Viron) is NEVER a plain captured step — it rides the
    // `repeat` payload (the chosen action + its own composed responses). A
    // read-only NESTED slot never composed one — the server asks next.
    // A PLAN answers its forced deltaAdvance door itself (the offer fully
    // determines the move), so the copy raises no divergence stepper.
    stepResponses: navigationDeferred.value ?
      plannedStepResponses(branch, captured.value) :
      orderedStepResponses(branch, captured.value),
    repeat: props.repeatPickDisabled ? undefined : repeatResult.value,
    // A LAW'S PLAY (RX36): the composed card — it rides behind every other step.
    lawPlay: lawPlayCaptured.value,
    // The captured stage-reward claim WITH its composed repeat (the wire
    // response cannot carry the composition back out) — the confirm's
    // claim derivation reads it structurally.
    stageReward: stageRewardDraft.value,
  });
}
// ── the reveal phase ─────────────────────────────────────────────────
/** Launch the deck-pull flight (the phase just opened; the payload may
 *  not exist yet — the flip waits for it). */
function beginRevealFlight(): void {
  revealHandingOff.value = false;
  revealStage.value = 'pending';
  revealFlightOn.value = true;
  void nextTick(() => {
    const proxy = revealProxy.value ?? undefined;
    const flip = revealFlip.value ?? undefined;
    const slot = revealSlot.value ?? undefined;
    if (proxy === undefined || flip === undefined || slot === undefined) {
      // No stage to fly on (test runner / torn-down DOM): degrade to the
      // instant path — the outcome shows the moment the payload lands.
      revealStage.value = 'settled';
      revealFlightOn.value = false;
      return;
    }
    revealHandle = runActionRevealFlight({
      proxy, flip, slot,
      onFaceShown: () => {
        if (revealStage.value === 'pending') {
          revealStage.value = 'face';
        }
      },
      onSettled: () => {
        // ONE flush: the proxy unmounts and the real card becomes visible
        // together — the swap is invisible (the proxy landed on the slot).
        revealStage.value = 'settled';
        revealFlightOn.value = false;
        revealHandle = undefined;
        maybeRunGainBeat();
      },
    });
    if (revealPayload.value !== undefined) {
      revealHandle.notifyPayload();
    }
  });
}
/**
 * The GAIN beat (condition met, the reward lives on the source card):
 * the earned resource icon flies from the revealed card into the source
 * counter; on arrival BOTH counters (the card badge + «на этой карте»)
 * tick to the live value with a one-shot pop. Cosmetic and non-blocking
 * — OK / X / L3 work throughout.
 */
function maybeRunGainBeat(): void {
  const payload = revealPayload.value;
  const live = storedResource.value?.count;
  if (payload === undefined || !payload.conditionMet || payload.reward === undefined ||
      live === undefined || revealResBaseline.value === undefined || live === revealResBaseline.value) {
    // Nothing landed on the source card — show the live truth directly.
    revealGainApplied.value = true;
    return;
  }
  revealGainFlying.value = true;
  void nextTick(() => {
    const el = gainFly.value ?? undefined;
    const from = revealSlot.value ?? undefined;
    // The stage's own root, through its template ref (`null` once the stage is gone — the guard below).
    const root = rootEl.value ?? undefined;
    const to = root?.querySelector<HTMLElement>('.con-composer__actcard .pcard__res');
    if (el === undefined || from === undefined || to === null || to === undefined) {
      applyRevealGain();
      return;
    }
    revealGainHandle = runRevealGainFlight({
      el, fromEl: from, toEl: to,
      onArrive: () => applyRevealGain(),
    });
  });
}
function applyRevealGain(): void {
  revealGainHandle = undefined;
  revealGainFlying.value = false;
  revealGainApplied.value = true;
  revealGainPop.value = true;
  if (revealGainPopTimer !== undefined) {
    revealGainPopTimer();
  }
  revealGainPopTimer = flow.after(750, 'the reveal gain\'s pop ends', () => {
    revealGainPop.value = false;
  });
}
function abortRevealFlight(): void {
  revealHandingOff.value = false;
  revealHandle?.kill();
  revealHandle = undefined;
  revealGainHandle?.kill();
  revealGainHandle = undefined;
  revealFlightOn.value = false;
  revealGainFlying.value = false;
  revealGainPop.value = false;
  revealStage.value = 'pending';
}
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
function armBeatBatch(): void {
  // ⚠️ Only trust the artifact once the answer for THIS claim has landed.
  // Arming happens at SUBMIT time, when `playerView` still describes the
  // world before the action — a leftover reveal event or a previous
  // prompt's candidates would otherwise decide this batch's size.
  const named = workspaceOutcomeState.answerIn ? beatRevealedNames.value : [];
  const count = named.length > 0 ?
    named.length :
    Math.max(1, workspaceOutcomeState.expectedCards);
  beatFaces.value = Array.from({length: count}, (_, i) => named[i] ?? '');
}
/**
 * The answer named the cards — fill the faces of the objects ALREADY in
 * flight. The array's LENGTH never changes: these are the same physical
 * cards that left the pile, now with identities, which is exactly why a
 * late answer opens them instead of producing new ones.
 */
function syncBeatFaces(): void {
  const named = beatRevealedNames.value;
  if (named.length === 0) {
    return;
  }
  // Not yet in flight (the answer beat the commit handoff): the batch is
  // still free to take the REAL size, which is always better than the
  // promise. Once it is flying the length is frozen — the objects that
  // left the pile are the objects that land.
  if (!beatFlightOn.value) {
    beatFaces.value = named.slice();
    return;
  }
  beatFaces.value = beatFaces.value.map((face, i) => named[i] ?? face);
}
/**
 * SOLVE THE PREPARED STAGE — the same geometry engine, over the same kind
 * of measurement, that the arriving surface will use (`wsStageLayout`), so
 * the empty slots the batch flies into ARE the rects the real cards will
 * occupy. Without this the landing would be a guess and the handoff a
 * visible jump; with it the swap is a zero-distance cross-over.
 */
function fitBeatStage(): void {
  const row = beatRow.value ?? undefined;
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
    if (beatFitRetries.value < 20) {
      beatFitRetries.value++;
      probeTick(() => fitBeatStage());
    }
    return;
  }
  beatFitRetries.value = 0;
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
    slotW, slotH, n: Math.max(1, beatCount.value), ui, padXPx: padX,
  });
  const style = wsStageLayoutStyle(layout);
  Object.entries(style).forEach(([k, v]) => row.style.setProperty(k, v));
  beatRowStyle.value = style;
}
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
function beginBeatFlight(): void {
  if (beatFlightOn.value) {
    return;
  }
  // NEVER A DEAL ONTO A STAGE THAT ALREADY PRESENTS (the duplicate card — `rearmWorkspaceOutcomeBeat`): once the
  // claim presents, the REAL cards stand in the zone, and a proxy launched now (a late net, a late answer, a
  // queued tick) flies the same card from the deck onto its own double. The beat's moment is over — the stage's
  // falling edge already handed off (`outcomePendingBeat` watcher).
  if (!outcomePendingBeat.value) {
    return;
  }
  // A SEARCH waits for its answer (PL-261): until the server has turned the cards over nobody knows which ones it
  // threw away, and they leave the deck BEFORE the found ones — a beat launched on the round-trip flew the find
  // first and the rejects never (the e2e under load: the pile then just «knew» 2). Bounded: past the net the find
  // goes as before and the pile still says the server's count through the reveal.
  if (beatAwaitsSearchAnswer()) {
    // The deck's counter is HELD at its pre-answer size NOW (PL-281): held after the answer it read the answered
    // size, the stream ticked it two further down, and the release flipped it back UP by two (reduced motion).
    holdBeatDeck();
    if (beatAnswerNet === undefined) {
      // The deal is DEFERRED by this wait: its backstop counts from here (the net, 2.5 s, fires before it), or it
      // runs out before the launch and a late answer presents the cards with no deal at all.
      rearmWorkspaceOutcomeBeat();
      // A NET, not a motion: never scaled (reduced motion caps motions at 160 ms).
      beatAnswerNet = flow.after(BEAT_SEARCH_ANSWER_NET_MS, 'the search beat\'s answer net', () => {
        beatAnswerNet = undefined;
        beatSearchNetSpent.value = true;
        beginBeatFlight();
      });
    }
    return;
  }
  clearBeatAnswerNet();
  const root = rootEl.value ?? undefined;
  if (root === undefined) {
    // No stage to fly on (JSDOM / torn-down layout): never withhold the
    // outcome behind an animation that cannot run.
    markWorkspaceOutcomeBeatDone();
    markWorkspaceOutcomeArrivalDone();
    return;
  }
  armBeatBatch();
  beatFlightOn.value = true;
  beatLanded.value = false;
  beatHandoffPending.value = false;
  // THE BEAT IS COMMITTED TO FLY: its backstop counts from here — a search's thrown-away cards stream off the deck
  // first, and a clock started at the press could run out before the found cards leave (the launch re-arms again).
  rearmWorkspaceOutcomeBeat();
  // FREEZE the HUD deck counter at its pre-draw value. The server's answer
  // decrements it the moment it lands, so without this the «−N» chip fires
  // while the cards are still sitting on the pile — the number changes
  // before anything has physically left, which is the opposite of the
  // causal story the whole beat exists to tell. Released as the first card
  // visibly separates, so the tick lands ON the separation.
  holdBeatDeck();
  // THE THROWN-AWAY CARDS LEAVE FIRST (TR52, PL-261): a search this beat
  // deals turned cards over and threw them away BEFORE the found ones came
  // off the deck — the scene's layer deals them aside onto the table's
  // discard pile (the counter ticking per card under this hold), and the
  // found cards start once the last one has left the deck. No answer yet
  // (the beat covers the round-trip) → the found cards go as before and
  // the pile still says the server's count through the reveal.
  const stream = beatDiscardStream();
  let launched = false;
  const launch = () => {
    if (launched) {
      return;
    }
    launched = true;
    void nextTick(() => launchBeatBatch());
  };
  void nextTick(() => {
    // The stage must be SOLVED before the slots are measured, or the batch
    // would aim at a pre-fit geometry and land off its own targets.
    fitBeatStage();
    if (stream === undefined ||
        !requestDiscardStream({eventId: stream.id, cards: stream.cards, onAllPeeled: launch})) {
      launch();
    }
  });
}
/**
 * The deck's hold for this beat (PL-281) — the apply block's seed adopted when the answer is already in, else the
 * PRE-ANSWER size, taken once: a counter the answer has already moved is never held back (that would flip it UP
 * again — PL-088), and a standing hold is never overwritten with a later value.
 */
function holdBeatDeck(): void {
  // The answer is in and the apply block kept the pre-draw count for this very batch (PL-088): take it over.
  if (adoptDeckSeed()) {
    return;
  }
  // A hold already stands (this beat's own, from an earlier entry): never re-held at a later value.
  if (isDeckDisplayHeld()) {
    return;
  }
  // Before the answer the live count IS the pre-draw count; after it, with no seed, the counter has already
  // moved — holding it back would flip it UP again (PL-088), so it is left alone and the beat ticks nothing.
  if (!workspaceOutcomeState.answerIn) {
    holdDeckDisplay(props.playerView.game.deckSize);
  }
}
/**
 * The beat's draw is a SEARCH (its chip carries the server's rule) and the answer is not in yet — or THE TABLE
 * MAY ANSWER THE PRESS WITH A DRAW («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»: the forecast promises the viewer cards from a
 * hook), so the batch may be MERGED and its size and causes are known only with the answer; the beat then waits
 * (the same bounded net) and plays the assembly scene — the trigger cards surfacing beside the row — instead of
 * flying the promised count alone and letting the rest appear at the handoff.
 */
function beatAwaitsSearchAnswer(): boolean {
  if (workspaceOutcomeState.answerIn || beatSearchNetSpent.value) {
    return false;
  }
  return (selectedBranch.value?.effects ?? []).some((e) => e.search !== undefined) || forecastPromisesDraw();
}
/** The forecast names a hook that will draw the viewer cards on this press (exact or asked — either may add a run). */
function forecastPromisesDraw(): boolean {
  const f = forecast.value;
  if (f === undefined) {
    return false;
  }
  const position = positions.value.length === 1 ? positions.value[0] : undefined;
  const facts = [...f.facts, ...(position !== undefined ? (f.byBranch?.[position] ?? []) : [])];
  return facts.some((fact) => fact.recipient.kind === 'you' &&
    (fact.certainty === 'exact' || fact.certainty === 'asks') &&
    fact.effects.some((e) => e.direction === 'gain' && e.icon === 'cards'));
}
function setBeatTriggerRef(el: unknown, run: number): void {
  beatTriggerRefs.value[run] = (el as HTMLElement | null) ?? null;
}
function clearBeatAnswerNet(): void {
  if (beatAnswerNet !== undefined) {
    beatAnswerNet();
    beatAnswerNet = undefined;
  }
}
/**
 * The batch this beat deals, when the server has answered and its search threw cards away — the thrown-away
 * cards, in the server's order. `undefined` = nothing to stream (no answer yet, a plain draw, not this beat's).
 */
function beatDiscardStream(): {id: number, cards: Array<CardName>} | undefined {
  const e = currentRevealEvent();
  if (!workspaceOutcomeState.answerIn || e === undefined || !workspaceClaimOwnsArrival(e)) {
    return undefined;
  }
  const cards = (e.sequence ?? []).filter((step) => !step.matched).map((step) => step.card.name);
  return cards.length > 0 ? {id: e.id, cards} : undefined;
}
/** Measure the prepared slots and hand the batch to the director. */
function launchBeatBatch(): void {
  if (!beatFlightOn.value || beatHandle !== undefined) {
    return;
  }
  // The launch waited (a stream of thrown-away cards, a tick) and the claim PRESENTED meanwhile: the real cards
  // already stand in the zone — never fly their doubles onto them (`beginBeatFlight`). The handoff the stage's
  // falling edge started owns the proxies; the deck's counter is let go so it tells the truth.
  if (!outcomePendingBeat.value) {
    releaseDeckDisplay();
    return;
  }
  const proxies = asElements(batchProxies.value);
  const flips = asElements(batchFlips.value);
  const slots = asElements(beatSlots.value);
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
    dataReady: workspaceOutcomeState.answerIn && beatFaces.value.every((f) => f !== ''),
  });
  // THESE CARDS ARE NOW PHYSICALLY OFF THE PILE — published HERE, at the
  // one point where the flight is genuinely committed (past every degrade
  // branch above), so an arriving surface that would otherwise deal its own
  // batch off the same pile adopts these instead of doubling them.
  markWorkspaceOutcomeArrivalFlown();
  // A MERGED batch («ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР»): the answer is in (the beat waited for it), every card has a
  // slot — the ONE assembly director deals it run by run: this card's own run off the deck, every hook's run
  // from its own face surfacing beside the row.
  const merged = currentRevealEvent();
  if (workspaceOutcomeState.answerIn && merged !== undefined && intakeAssemblyOwnsBatch(merged) &&
      workspaceClaimOwnsArrival(merged) && cards.length === merged.cards.length && mode === 'in-flight-reveal') {
    launchBeatAssembly(merged, cards, slots);
    return;
  }
  beatHandle = runBatchArrival({
    cards, slots, mode,
    // The first card is visibly out of the pile — the counter may now tell
    // the truth, and the tick lands ON the separation.
    onDeparted: () => releaseDeckDisplay(),
    // Every card has touched down. Only from here may a still-silent
    // server show a loading affordance: before it, the flight IS the state
    // and a spinner over travelling cards is noise.
    onLanded: () => {
      beatLanded.value = true;
    },
    onSettled: () => {
      beatHandle = undefined;
      // The landed proxies STAY. Clearing them here would unmount the
      // cards the moment they finished turning over, leaving the stage
      // empty for the frame or two before the real surface teleports in.
      // They are released by the handoff, i.e. once that surface is
      // actually there to replace them.
      markWorkspaceOutcomeBeatDone();
      if (beatHandoffPending.value) {
        handOffBeatBatch();
      }
    },
  });
  // A server that already answered (the common local case) releases the
  // turn immediately — the cards then open on their own trajectories.
  if (workspaceOutcomeState.answerIn) {
    syncBeatFaces();
    beatHandle.notifyPayload();
  }
}
/** The merged batch's assembly on the prepared stage (the composer is the host: its proxies, its slots, its triggers). */
function launchBeatAssembly(e: DrawnCardEntry, cards: ReadonlyArray<{proxy: HTMLElement, flip: HTMLElement}>, slots: ReadonlyArray<HTMLElement>): void {
  const root = rootEl.value ?? undefined;
  const host = {
    stageRect: () => {
      const r = (root?.closest('.con-ws') ?? root)?.getBoundingClientRect();
      return r !== undefined && r.width > 200 ? {left: r.left, top: r.top, width: r.width, height: r.height} :
        {left: 0, top: 0, width: window.innerWidth, height: window.innerHeight};
    },
    triggerEl: (run: number) => beatTriggerRefs.value[run] ?? null,
    // The board is under this workspace — a cell's run comes off the deck (named `board-covered`).
    cellIconRect: () => undefined,
  };
  const {plan, triggers} = planAssemblyFor(e.segments, host, workspaceOutcomeState.sourceCard);
  beatTriggers.value = triggers;
  preloadPremiumCardArt(triggers.map((f) => f.name));
  void nextTick(() => {
    if (!beatFlightOn.value) {
      return;
    }
    playComposerAssembly({
      plan, pairs: cards, slots, host,
      alive: () => beatFlightOn.value,
      onDeckDeparted: () => releaseDeckDisplay(),
      onDone: () => {
        beatLanded.value = true;
        beatTriggers.value = [];
        markWorkspaceOutcomeBeatDone();
        if (beatHandoffPending.value) {
          handOffBeatBatch();
        }
      },
    });
  });
}
/** Cancel a scheduled commit-delayed beat launch (abort / unmount). */
function clearBeatDelay(): void {
  if (beatDelayTimer !== undefined) {
    beatDelayTimer();
    beatDelayTimer = undefined;
  }
  clearBeatAnswerNet();
  beatSearchNetSpent.value = false;
}
/**
 * THE HANDOFF — the real surface has taken the zone, so the landed proxies
 * give way to the real cards.
 *
 * It waits for the arrival to have SETTLED. The beat's own safety backstop
 * can release the gate while a late answer's reveal cascade is still
 * turning cards over, and cutting a proxy mid-turn would leave a card
 * edge-on for a frame — the one artefact a card turn may never show.
 */
function handOffBeatBatch(): void {
  if (!beatFlightOn.value) {
    // NOTHING EVER FLEW — the beat's own safety backstop released the gate
    // before the flight could launch (a heavy 4K first frame, a torn-down
    // stage, JSDOM). The player must still be let in: an arrival gate that
    // only opens on a successful flight turns a missed animation into a
    // permanently dead stage — no focus ring, no verbs, every press
    // swallowed. The gate is a courtesy to the animation, never its hostage.
    markWorkspaceOutcomeArrivalDone();
    return;
  }
  if (beatHandle !== undefined || composerAssemblyInFlight()) {
    beatHandoffPending.value = true;
    return;
  }
  beatHandoffPending.value = false;
  const clear = () => {
    beatFlightOn.value = false;
    beatLanded.value = false;
    beatFaces.value = [];
    beatRowStyle.value = {};
    // The player may act only now: the real cards own their slots, so a
    // focus ring finally points at something that is there.
    //
    // TWO FRAMES LATER, though: the proxies unmount in this flush, and
    // opening the gate in the same one puts the card's removal and the
    // focus emphasis (a scale + lift) in a single frame — the landing then
    // ends on a visible kick instead of a settle. One frame to paint the
    // real cards unfocused, one for the transition to have a `from` state,
    // and the ring eases in on top of a card that is already still.
    // ⚠ ON THE PROBE CLOCK, never bare rAF (PL-294): rAF is the COMPOSITOR's clock, and under a 4K commit
    // stall one frame took 1.6 s — the double rAF alone held the purchase stage DEAD (cards on screen, every
    // press swallowed, the bar on its fallback) for over three seconds. `probeTick` keeps the frame
    // alignment while frames run and stops being a liveness dependency when they do not.
    probeTick(() => probeTick(() => markWorkspaceOutcomeArrivalDone()));
  };
  const proxies = asElements(batchProxies.value);
  const root = rootEl.value ?? undefined;
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
    if (!beatFlightOn.value) {
      return;
    }
    // The re-homed surface's own cards, in ITS layout order — the batch's
    // order is the server's order, and both surfaces render it verbatim,
    // so index i is the same card on both sides.
    const targets = Array.from(root.querySelectorAll<HTMLElement>(
      '[data-outcome-zone] :is(.con-cards__slot, .con-reveal__bonus-slot) :is(.card-container, .pcard)'));
    if (targets.length === 0 && frames < 40) {
      frames++;
      probeTick(seek); // the same clock as the gate below (PL-294) — 40 ticks ≤ 2 s on a starved compositor
      return;
    }
    settleBatchProxiesOnto({
      pairs: proxies.map((proxy, i) => ({proxy, target: targets[i]})),
      onDone: clear,
    });
  };
  seek();
}
/** Tear the beat down for good (cancel / unmount / phase abort). */
function abortBeatFlight(): void {
  // Never leave the HUD counter frozen on a beat that ended early.
  releaseDeckDisplay();
  beatHandle?.kill();
  beatHandle = undefined;
  killComposerAssembly();
  beatTriggers.value = [];
  beatHandoffPending.value = false;
  beatFlightOn.value = false;
  beatLanded.value = false;
  beatFaces.value = [];
  beatRowStyle.value = {};
  markWorkspaceOutcomeArrivalDone();
}
/** The composition line «В этой партии карт с требованием партии: N». */
function poolLine(pool: {count: number, key: string}): string {
  return translateTextWithParams(pool.key, [String(pool.count)]);
}
/** OK on the shown outcome: the parent marks the reveal seen and returns
 *  the flow to the (refreshed) browse grid. */
function ackReveal(): void {
  const payload = revealPayload.value;
  if (revealHandingOff.value) {
    return;
  }
  if (payload === undefined) {
    emit('reveal-ack');
    return;
  }
  // THE VERDICT HANDS THE CARD OVER: the revealed card leaves its slot for
  // where the server sent it (the hand dock / the discard pile), and the
  // acknowledgement — which concludes this workspace — fires in the frame
  // the card has detached, so the workspace folds UNDER the lifted card.
  // One press: a second A while the handoff is staging is swallowed.
  revealHandingOff.value = true;
  runRevealHandoff({
    reveal: payload,
    slot: revealSlot.value ?? undefined,
    verdict: verdictSlot.value ?? undefined,
    onDetached: () => emit('reveal-ack'),
  });
}
/** X on the shown outcome: the revealed card lifts out of ITS slot into
 *  the fullscreen viewer and returns there on close. */
function inspectRevealed(): void {
  const payload = revealPayload.value;
  if (payload === undefined) {
    return;
  }
  openConsoleCardZoom([payload.revealed], 0, undefined, undefined, {
    contextLabel: 'Reveal result',
    origin: slotZoomOrigin(
      () => rootEl.value ?? undefined,
      () => 'revealed:' + payload.revealed.name),
  });
}
function scrollFocused(): void {
  void nextTick(() => {
    // The CTA lives in the pinned dock OUTSIDE the scroll viewport — it is
    // always visible, and feeding an outside node to the scroll math
    // would walk the viewport to a bogus offset.
    if (ctaFocused.value) {
      return;
    }
    // The payment editor's cursor lives INSIDE the shared panel (a child
    // component), so it is located by its rendered focus class instead of a
    // template ref — the panel stays purely presentational.
    if (payExpanded.value) {
      const row = rootEl.value?.querySelector('.con-payrow--focused');
      scroll.value?.ensureVisible?.(row);
      return;
    }
    // A variant tile carries no template ref (the group renders them) — it is located by its rendered focus class.
    if (focusedItem.value?.kind === 'branch') {
      const tile = branchesRoot()?.querySelector('.con-vchoice__opt--focused');
      scroll.value?.ensureVisible?.(tile);
      return;
    }
    // A NESTED LIST (a pick / an `or` step's options) replaces the main
    // items — their `focusedEl` ref is unmounted with them, so the list's
    // cursored option is found by its rendered focus class.
    if (sub.value?.kind === 'list' || sub.value?.kind === 'orNested') {
      const opt = rootEl.value?.querySelector('.con-composer__sublist .con-vchoice__opt--focused');
      scroll.value?.ensureVisible?.(opt);
      return;
    }
    const el = focusedEl.value ?? undefined;
    const node = Array.isArray(el) ? el[0] : el;
    // Foundation: keep the focused row visible via the ConsoleScrollArea's
    // own viewport math (never scrollIntoView — it can walk outer scroll
    // ancestors).
    scroll.value?.ensureVisible?.(node);
  });
}
/** The variant group's root element (the ref is a component). */
function branchesRoot(): HTMLElement | undefined {
  return rootElOf(branchesEl.value);
}
/**
 * The group's AXIS, read off the rendered geometry: every tile at the same `offsetTop` ⇒ one row (←→ switch),
 * else the container query has stacked them ⇒ a column (↑↓ walk). Measured, never a duplicated breakpoint — the
 * cluster's width depends on the profile, the dock and the nesting depth, which no JS constant knows.
 */
function measureBranchAxis(): void {
  const el = branchesRoot();
  if (el === undefined) {
    branchAxis.value = 'row';
    return;
  }
  const tiles = Array.from(el.querySelectorAll<HTMLElement>('.con-vchoice__opt'));
  const tops = [...new Set(tiles.map((tile) => Math.round(tile.offsetTop)))].sort((a, b) => a - b);
  // A PALETTE folded into rows (3 + 3) is a GRID — ←→ in a row, ↑↓ between rows (the play composer's rule).
  branchGridRows.value = branchPalette.value && tops.length > 1 ? tiles.map((tile) => tops.indexOf(Math.round(tile.offsetTop))) : [];
  branchAxis.value = tops.length <= 1 ? 'row' : branchGridRows.value.length > 0 ? 'grid' : 'column';
}
/** Re-measure on every resize of the group's box (a profile switch, the rail lifting, a font settling) — the
 *  responsive path, never a window listener. Re-armed whenever the group (re)mounts. */
function armBranchObserver(): void {
  stopBranchObs?.();
  stopBranchObs = undefined;
  const el = branchesRoot();
  if (el === undefined) {
    branchAxis.value = 'row';
    return;
  }
  stopBranchObs = useResizeObserver(el, () => measureBranchAxis()).stop;
  measureBranchAxis();
}

/**
 * THE LAW'S CARD SET SOMETHING OFF (RX36): the tableau that told the CAUSE makes room for the CONSEQUENCE — a
 * dissolve that sinks a hair (the hand composer's `runPlaystageRelease`, the same release flag), never a cut. The
 * layer stays mounted, faded, until the workspace leaves.
 */
watch(() => lawLandingYielded.value, (now: boolean): void => {
  if (!now) {
    return;
  }
  beginPlayLandingRelease();
  const el = lawPlaystage.value ?? undefined;
  if (el === undefined || el === null || consoleReducedMotionActive()) {
    if (el !== undefined && el !== null) {
      gsap.set(el, {autoAlpha: 0});
    }
    markPlayLandingReleased();
    return;
  }
  gsap.killTweensOf(el);
  gsap.to(el, {
    autoAlpha: 0,
    scale: 0.985,
    transformOrigin: '50% 45%',
    duration: motionMs(LAW_PLAYSTAGE_RELEASE_MS) / 1000,
    ease: 'power2.in',
    onComplete: () => markPlayLandingReleased(),
  });
});
/** THE LAW'S CARD ROSE (RX36): the decision column lets go in place under the receiving stage — the stage stands. */
watch(() => lawLandingUp.value, (now: boolean): void => {
  if (!now || lawLandingLatched.value) {
    return;
  }
  lawLandingLatched.value = true;
  const surface = surfaceEl.value ?? undefined;
  if (surface !== undefined) {
    gsap.killTweensOf(surface);
    gsap.to(surface, {autoAlpha: 0, duration: motionMs(110) / 1000, ease: 'power1.in'});
  }
});
/** The scene was refused before it ever rose (the shell drops the landing on `failed`): the setup stands again. */
watch(() => lawLanding.value, (now: boolean, was: boolean): void => {
  if (was && !now && playedHeroState.phase === 'failed') {
    restoreLawSetup();
  }
});
/** B out of a law's STAGED step (nothing was sent): the slot comes back as it was — the card in it, the commit armed. */
watch(() => lawStepHosted.value, (now: boolean, was: boolean): void => {
  const arm = stagedPlayState.arm;
  if (was && !now && !stagedPlayState.committing && arm?.flow !== 'law') {
    restoreLawSetup();
  }
});
/** PL-473: the step's full-tier art is decoded while the cursor stands on its row, never in the press's frames. */
watch(() => targetWarmNames.value, (names: string): void => {
  if (names !== '') {
    preloadPremiumCardArt(names.split('|') as Array<CardName>);
  }
});
/**
 * THE STEP ENTERS ONE LEVEL DEEPER — the play composer's phrase (TR56 П3), now the action composer's too (PL-473:
 * its step appeared in ONE frame, with no entry at all): the carried print — the shared result of a price-side
 * «ИЛИ» (TR58), else the answered tile's — flies into the step's contract line while its groups surface from
 * inside; back, the print flies home and the review returns the same way.
 */
watch(() => playedTargetStepOpen.value, (now: boolean, was: boolean) => {
  const root = rootEl.value ?? undefined;
  if (root === undefined || typeof root.querySelector !== 'function' || now === was) {
    return;
  }
  if (now) {
    const carry = armPayloadCarry(root.querySelector('.con-composer__branches'));
    void nextTick(() => {
      const step = targetStep.value ?? undefined;
      playPayloadCarry(step?.rootEl ?? undefined, step?.payloadEl?.(), carry);
    });
    return;
  }
  const from = armPayloadReturn(root.querySelector('.con-ptsel'));
  // The review RETURNS: the cursor the answer landed ARRIVES once it stands (T14 · CC — the TR58 grammar).
  const arrived = gateCursorDuringEntry(root, () => undefined);
  void nextTick(() => playPayloadReturn(rootEl.value ?? undefined, from, arrived));
});
watch(() => settleSuspended.value, (now: boolean) => {
  settled.value?.suspend(now);
});
/**
 * The group's memory: the tile the cursor last stood on (↑ from the row below re-enters there). Written on every
 * ARRIVAL here (a ←→ switch, a walk back in) and at the moment of LEAVING in `onNav` — the seeded first focus
 * never passes this watcher, and A on a tile leaves for the commit row without a nav press.
 */
watch(() => focusIdx.value, (now: number) => {
  if (navItems.value[now]?.kind === 'branch') {
    branchReturnIdx.value = now;
  }
  // The cursor left the commit row: its arrival (and the window it opened) is over.
  if (now < ctaIndex.value) {
    leaveCommit(commitArrival.value);
  }
});
/** The group (re)mounts with the preview — re-arm the axis measurement on its new root. */
watch(() => branchItemPositions.value, () => {
  void nextTick(() => armBranchObserver());
}, {flush: 'post'});
/** The sent action stops being in flight the moment the lock falls — whichever road dropped it. */
watch(() => submitting.value, (now: boolean) => {
  if (!now) {
    commitSent.value = false;
  }
});
watch(() => commitSent.value, (now: boolean) => {
  emit('committing', now);
});
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
watch(() => props.preview, (now: ActionPreview | PoliticalActionPreview | undefined, was: ActionPreview | PoliticalActionPreview | undefined) => {
  if (submitting.value) {
    return;
  }
  // THE TABLE MOVED UNDER AN OPEN COMPOSER (an opponent's move, a WS push — the store re-asks on every server
  // version): an answer of the SAME SHAPE replaces the old one IN PLACE — the captures, the chosen variant and the
  // CURSOR survive (TR58: every refetch used to re-seat the draft, so the cursor jumped back to the first variant
  // mid-decision). The play composer's rule (`samePreviewShape`), one rule for both.
  if (was !== undefined && now !== undefined && samePreviewShape(was, now)) {
    // …but a SEED reads the candidate set, which may have moved (T14 · CC).
    reseatSeeds();
    return;
  }
  resetFromPreview();
}, {immediate: true});
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
watch(() => drawOutcomeOn.value, (on: boolean) => {
  if (!props.publishCommands) {
    return;
  }
  // …and «off» retracts only OUR selector: at mount `on` is false and a
  // blind clear wiped a zone the hand (a play host) had just published.
  if (on) {
    setWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
  } else {
    retractWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
  }
}, {immediate: true});
// The COLONIES STEP zone — same discipline (embed rule 4: `flush:'post'`
// so the element genuinely stands before the teleport looks for it,
// retract on the way out).
// THE PARLIAMENT STEP's zone — the colony step's discipline (embed rule 4: `flush: 'post'`, so the layer
// genuinely stands before the teleport looks for it; retracted on the way out) — plus the SETUP's own phrase:
// it lets go IN PLACE as the Parliament rises out of the same rect, and comes back the same way on B.
// THE DOOR IS OPEN: warm the voting area's art while the player configures, so the vote mode rises with its
// pictures in (the play door warms it during its landing ritual — an action has no ritual).
watch(() => voteEntryDoor.value, (door: StagedVoteModel | undefined): void => {
  if (door !== undefined) {
    preloadResolutionArt((props.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution));
  }
});
// «THE LEDGER PAYS»: the draw layer is the claim's zone ONLY while the walk stands on a row that hands cards
// over — published post-flush (the layer genuinely stands before the teleport looks for it), retracted the
// moment the row settles. Until then the claim holds the batch with NO zone: it renders nowhere (the embed
// contract's «claimed but not ready»), never as a band over the ledger. OWNER only.
watch(() => ledgerDrawTurn.value, (on: boolean, was: boolean) => {
  if (!props.publishCommands || (!on && !was)) {
    return;
  }
  if (on) {
    setWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
  } else {
    retractWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
  }
}, {flush: 'post' as const});
// …and every fact the walk moves on re-asks it (post-flush: a row's wave measures the ledger's own cells).
watch(() => ledgerTick.value, (key: string) => {
  if (key !== '') {
    advanceLedgerPayout();
  }
}, {flush: 'post' as const});
watch(() => handStageStepOn.value, (on: boolean, was: boolean) => {
  if (on) {
    releaseSetupForParliament();
  } else if (was && !parliamentStepOn.value) {
    // The album leaves (answered, or B on a reversible pick): the hero and the setup come back where they stood —
    // a party's payout is born on the plaque's printed icon, a ledger resumes its walk.
    restoreSetupFromParliament();
  }
}, {flush: 'post' as const});
watch(() => parliamentStepOn.value, (on: boolean, was: boolean) => {
  setWorkspaceFrameSlot('card-actions', on ? '[data-embed-slot="action-parliament"]' : '');
  setWorkspaceFrameSourceCard('card-actions', on ? sourceKey.value : '');
  if (on) {
    releaseSetupForParliament();
  } else if (was && !stagedVoteSent.value) {
    // B out of the vote (nothing was sent): the setup returns to the variant the player left. A SENT vote's
    // step ends WITH this workspace — the setup stays parked under its leave.
    restoreSetupFromParliament();
  }
}, {flush: 'post' as const});
// THE MODE'S A FOR THIS CARD (a staged action vote): the commit is this card's — the CTA locks, and the capsule
// keeps the count the player pressed with until the cube lifts off the reserve. A refusal (the transport's abort
// battery cleared `committing` with the arm standing) gives everything back; the flow's end releases the hold.
// The watcher is keyed by the STEP'S KIND (the arm's target is a resolution — `stagedVoteOf`), never by the
// price's icon: data, mechs and fighters take the same road.
watch(() => stagedVoteCommitMine.value, (now: boolean, was: boolean): void => {
  if (now && !was) {
    stagedVoteSent.value = true;
    stagedVoteCapsuleHeld.value = storedResource.value?.count;
    submitting.value = true;
    const branch = selectedBranch.value;
    if (branch !== undefined) {
      // A price off the CARD (TR15's data, TR34's mech) leaves WITH the cube — the Parliament's own flight, never a
      // rail link of this commit. A price off the RAIL (T07's 3 M€) IS this commit's: its token leaves the row into
      // the price as it stands on screen (PL-104), seeded with the answer and flown by the vote's landing BEFORE
      // the cube (`flyStagedVotePrice`); the delegate is the vote's result, never a link here.
      // THE HERO IS PARKED under the step (the Parliament took the whole stage): no impulse runs over a card the
      // player cannot see, and the price stands on the vote's locked RECEIPT — the visible double of the card's
      // printed cost, which is where a rail price is absorbed.
      const receipt = stagedVoteReceiptOf(branch);
      const railPrice = receipt !== undefined && isStandardResource(receipt.icon);
      const standIn = rootEl.value?.querySelector('[data-parl-vote-receipt-icon]') ?? undefined;
      playCommitBeat(branch, {...(railPrice ? {resultElsewhere: true} : {spendDepartsElsewhere: true}), heroParked: {price: standIn}});
    }
    return;
  }
  if (was && !now) {
    stagedVoteCapsuleHeld.value = undefined;
    const arm = stagedPlayState.arm;
    if (stagedVoteOf(arm) !== undefined && arm?.cardName === sourceKey.value) {
      stagedVoteSent.value = false;
      submitting.value = false;
    }
  }
});
watch(() => stagedVotePriceGone.value, (gone: boolean): void => {
  if (gone && stagedVoteSent.value) {
    stagedVoteCapsuleHeld.value = undefined;
  }
});
watch(() => colonyStepOn.value, (on: boolean) => {
  setWorkspaceFrameSlot('card-actions', on ? '[data-embed-slot="action-colonies"]' : '');
  // …AND THE CARD THE STEP IS BEING DONE FOR. This host keeps its card in
  // the outcome CLAIM rather than in the crumb subject (the composer owns
  // the activation, not the browse frame), which is exactly why the
  // guest used to carve out a special case for it. Published here, the
  // guest asks one question of every host — see `workspaceStepSourceCard`.
  setWorkspaceFrameSourceCard('card-actions', on ? sourceKey.value : '');
}, {flush: 'post' as const});
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
watch(() => outcomePendingBeat.value, (on: boolean) => {
  if (on) {
    clearBeatDelay();
    // ARM THE BATCH NOW, not at launch: the prepared stage has to stand
    // with its N slots from the moment the zone opens, so the layout is
    // solved and the landing rects exist before anything moves. The launch
    // re-arms, because the answer may firm the count up in the meantime —
    // but only ever BEFORE the first frame of flight.
    armBeatBatch();
    beatDelayTimer = flow.after(consoleMotionMs(COMMIT_HANDOFF_AT_MS), 'the draw beat follows the commit\'s handoff', () => {
      beatDelayTimer = undefined;
      void nextTick(() => beginBeatFlight());
    });
  } else {
    clearBeatDelay();
    // NOT an abort: the beat is leaving because the real surface has taken
    // the zone, so the landed cards hand over rather than blink out.
    handOffBeatBatch();
  }
});
/**
 * The submitted action was REJECTED (server error) — the premium
 * rollback: the commit visuals tear down, the CTA unlocks, the captures
 * stay. The workspace returns to the exact editable state before A.
 */
watch(() => actionCommitState.abortNonce, () => {
  commitHandle?.kill();
  commitHandle = undefined;
  submitting.value = false;
});
/**
 * THE PREPARED STAGE RE-SOLVES THE MOMENT ITS SIZE CHANGES. The batch is
 * armed when the zone opens and re-armed at launch (the answer can firm the
 * count up in between), and a row that keeps a zoom solved for a different
 * card count visibly resizes under the player — the «contour that jumps»
 * before anything has even flown. Only ever BEFORE the first frame of
 * flight: once the batch is airborne its length is frozen.
 */
watch(() => beatCount.value, (n: number) => {
  if (n > 0 && outcomePendingBeat.value) {
    void nextTick(() => fitBeatStage());
  }
});
/** The answer landed — the cards may turn over (mid-flight or on the slot). */
watch(() => workspaceOutcomeState.answerIn, (arrived: boolean) => {
  if (arrived && beatAnswerNet !== undefined) {
    // A search's beat was waiting for exactly this (`beatAwaitsSearchAnswer`).
    void nextTick(() => beginBeatFlight());
  }
  if (arrived) {
    syncBeatFaces();
    // The faces have to EXIST in the DOM before the turn shows them, or
    // the first readable frame is an empty proxy face.
    void nextTick(() => beatHandle?.notifyPayload());
  }
});
watch(() => outcomeStageOn.value, (on: boolean) => {
  if (!on) {
    return;
  }
  playConfigRelease(rootEl.value ?? undefined);
  void nextTick(() => {
    playOutcomePhase(rootEl.value ?? undefined, () => { /* settled */ });
  });
});
/**
 * …and again when the re-homed surface actually LANDS in the zone. The
 * teleport arrives a round-trip after the zone opened, so without this the
 * content would simply appear inside an already-open box — the same blink,
 * one level in. It surfaces from inside the zone instead, which is the
 * REVEAL half of the phrase arriving with its content.
 */
watch(() => outcomeContentIn.value, (landed: boolean) => {
  if (landed) {
    void nextTick(() => {
      playOutcomeContent(rootEl.value ?? undefined);
    });
  }
});
watch(() => props.outcome, (next: ComposerOutcome | undefined, prev: ComposerOutcome | undefined) => {
  const isCheck = (o: ComposerOutcome | undefined) => o?.kind === 'deck-check';
  if (isCheck(next) && !isCheck(prev)) {
    // Freeze the visible counter at its PRE-reveal value: the answer's
    // commit already carries the reward, and the increment must be a
    // SEEN beat, never a leaked spoiler.
    revealResBaseline.value = storedResource.value?.count;
    revealGainApplied.value = false;
    beginRevealFlight();
  } else if (!isCheck(next) && isCheck(prev)) {
    abortRevealFlight();
  }
}, {immediate: true});
// The server's answer landed — the face exists, the flip may run. On the
// degraded no-flight path (no stage DOM — the test runner, a torn-down
// layout) the phase is already 'settled' with NO handle: the gain beat
// must still fire here, or a late payload would leave the counters
// frozen at the baseline forever.
watch(() => revealPayload.value, (payload: RevealResultModel | undefined) => {
  if (payload === undefined) {
    return;
  }
  void nextTick(() => {
    if (revealHandle !== undefined) {
      revealHandle.notifyPayload();
    } else if (revealStage.value === 'settled' && !revealGainApplied.value) {
      maybeRunGainBeat();
    }
  });
});
watch(() => props.playerView, () => {
  // Keep the in-flight CTA while the COMMITTED submit is still awaiting
  // its answer (a poll can deliver an unchanged view mid-flight; the
  // shell's resolve closes the composer when the answer lands). Any
  // other fresh view means the prompt moved on — re-arm the CTA.
  if (!isSurfaceAwaitingHandoff()) {
    submitting.value = false;
  }
});
/**
 * THE GATE RE-SEATS THE CURSOR. Switching a variant, a target going stale
 * or a pick returning can all put a requirement back in the way — and if
 * the cursor was sitting on the commit row it is now parked on something
 * that will refuse it. Watching the gate's KIND (not the whole object)
 * keeps this to the transitions that actually matter.
 */
watch(() => commitGateKind.value, () => {
  if (sub.value === undefined && !submitting.value) {
    syncCommitFocus();
  }
});
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  // The nested (repeat-pick) instance reports UP via `@commands` instead of
  // touching the shared store the outer composer owns.
  if (props.publishCommands) {
    setConsoleActionComposerCommands(cmds);
  }
  emit('commands', cmds);
}, {immediate: true, deep: true});
/** The «Эффекты» layer lives ONLY on the setup level — a pick, the
 *  payment editor, the commit and its phases fold it instantly. */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  if (!can && fxOpen.value) {
    armForecastInstantFold();
    closeEffectForecastLayer('action');
  }
});
// (The frame header no longer asks this component what to call itself:
// the stage's name follows its PHASE — «Настройка действия» while the
// action is being prepared, «Результат вскрытия» in the reveal phase.
// Deriving it from `hasDecisions` made the title depend on the ASYNC
// preview, so it changed under the entering animation.)

// THE SETTLED COLUMN: centred for the opening composition, pinned from the player's first press — every later change
// grows downward and slides into place (`settledColumn.ts`; the owner's 4K report of 2026-10-14).
settled.value = markRaw(new SettledColumn({
  column: () => actRight.value ?? undefined,
  block: () => surfaceEl.value ?? undefined,
  active: () => !submitting.value,
}));

onMounted(() => {
  // THE RAIL RECEDES BEHIND THE FORMULA (PL-139): the OWNER composer publishes the rows its formula touches for as
  // long as it stands; a guest instance (the repeat pick's, `publishCommands: false`) publishes nothing — one
  // writer, as for the zone and the commands.
  if (props.publishCommands) {
    watch(() => railFocusKeys.value, (keys: ReadonlyArray<string>) => {
      consoleCardActionsUi.railFocus = keys;
    }, {immediate: true});
    // …and the TARGET step of a gain pick names its stage in the crumb (TR56, decision 6: «… › ЦЕЛЬ»).
    watch(() => playedTargetStepOpen.value && playedTargetModel.value?.contract.payload !== undefined, (on: boolean) => {
      consoleCardActionsUi.targetStage = on;
    }, {immediate: true});
    // …and the Venus bonus's INNER step names itself there too («… › БОНУС ВЕНЕРЫ», P89 · EM).
    watch(() => sub.value?.kind === 'venus' ? venusInnerStageKey(sub.value.focus) : false, (stage: string | false) => {
      consoleCardActionsUi.venusStage = stage;
    }, {immediate: true});
  }
  // The variant group's axis is read off its rendered geometry from the first frame on.
  void nextTick(() => armBranchObserver());
  // THE SHEET IS AS TALL AS THE CARD (P73 · DC): the hero wrap's LAYOUT height (offsetHeight — a FLIP / zoom transform
  // never changes it) is the sheet's floor; an empty frame of the face's keyed swap (0) keeps the last height.
  const heroWrap = rootEl.value?.querySelector?.<HTMLElement>('.con-composer__actcardwrap');
  if (heroWrap !== null && heroWrap !== undefined) {
    const measure = () => {
      const h = heroWrap.offsetHeight;
      if (h > 0) {
        heroFaceHeight.value = h;
      }
    };
    stopHeroFaceObs = useResizeObserver(heroWrap, measure).stop;
    measure();
  }
  // A RESTORED stage mounts with the colonies step ALREADY hosted (the
  // parked second-door chain coming back): `colonyStepOn` was true before
  // this component existed, so its change-watcher never fires — republish
  // the zone here, after the first render has stood the element up (the
  // same post-DOM timing the `flush: 'post'` watcher gives a live change).
  // Without this the restored colonies frame has no teleport target and the
  // whole chain below it renders nowhere (embed rule 4's gap, permanent).
  if (colonyStepOn.value) {
    setWorkspaceFrameSlot('card-actions', '[data-embed-slot="action-colonies"]');
    setWorkspaceFrameSourceCard('card-actions', sourceKey.value);
  }
  // …and a LEDGER PAYOUT already running for this card (a restored park): the frozen ledger is the record's own
  // rows' order, the draw layer's zone is republished if the walk stands on a draw row, and the walk is re-asked.
  if (ledgerPaying.value) {
    submitting.value = true;
    ledgerResumed.value = true;
    // The walk stands where it stood: a row waiting on its step (a take, a discard) is the row paying NOW — the
    // unmount put the mark away with the stage.
    const standing = nextPayoutRow();
    if (standing !== undefined && standing.state === 'paying' && (standing.kind === 'draw' || standing.kind === 'pairs')) {
      colonyBonusPayout.active = standing.colony;
    }
    if (ledgerDrawTurn.value) {
      setWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
    }
    void nextTick(() => advanceLedgerPayout());
  }
  // …and the same for a Parliament step already standing (a restored park): the zone is republished and the
  // setup comes back already parked — there is no release to replay.
  if (parliamentStepOn.value) {
    setWorkspaceFrameSlot('card-actions', '[data-embed-slot="action-parliament"]');
    setWorkspaceFrameSourceCard('card-actions', sourceKey.value);
    parliamentSetupParked.value = true;
  }
  // …and a hand step already standing (a restore mid-discard): the album keeps the whole stage, the setup parked.
  if (handStageStepOn.value) {
    parliamentSetupParked.value = true;
  }
});
onBeforeUnmount(() => {
  settled.value?.stop();
  leaveCommit(commitArrival.value);
  // The rail lights every row again the moment the owner's formula leaves the screen (PL-139).
  if (props.publishCommands) {
    consoleCardActionsUi.railFocus = undefined;
    consoleCardActionsUi.targetStage = false;
  }
  stopBranchObs?.();
  stopBranchObs = undefined;
  stopHeroFaceObs?.();
  stopHeroFaceObs = undefined;
  // THE LEDGER LEAVES THE SCREEN with this stage (a collapse, the flow's end): a row whose chips could only be
  // born on it is released honestly — the counter ticks now, late, never lost. The rows the SERVER still owes
  // an answer for (a take, a discard) keep waiting in the module record.
  if (ledgerPaying.value && !colonyBonusPayout.done) {
    for (const row of colonyBonusPayout.rows) {
      if (row.kind === 'chips' && row.ready && row.state !== 'paid') {
        row.specs.forEach((spec) => releasePanelRewardHold(spec));
        row.state = 'paid';
        markPayoutRowLanded(row.colony);
      }
    }
    colonyBonusPayout.flying = false;
    colonyBonusPayout.active = '';
  }
  commitHandle?.kill();
  commitHandle = undefined;
  abortRevealFlight();
  abortBeatFlight();
  // The zone dies with the stage — retract the teleport target so a re-homed
  // presenter falls back to its band instead of into a detached node. The
  // watcher does not fire on unmount, so this cannot be left to it. OWNER
  // ONLY, exactly as in the watcher above: the nested repeat-pick instance
  // leaving must not retract somebody else's live zone.
  if (props.publishCommands) {
    retractWorkspaceOutcomeSlot(WORKSPACE_REVEAL_ZONE);
    retractWorkspaceOutcomeSlot(LAW_PLAY_OUTCOME_ZONE);
  }
  // Same for the colonies-step zone (embed rule 4, the retract half) — and the Parliament step's.
  if (colonyStepOn.value || parliamentStepOn.value) {
    setWorkspaceFrameSlot('card-actions', '');
    setWorkspaceFrameSourceCard('card-actions', '');
  }
  cancelSetupFades();
  resetOutcomeOrigin();
  // Only the OWNER of the shared store resets it — the nested repeat-pick
  // instance must not clobber the outer composer's contract on unmount.
  if (props.publishCommands) {
    resetConsoleActionComposerUi();
    closeEffectForecastLayer('action');
  }
});
// What ConsoleCardActions reaches through its `composerRef` — and `tradeEntryCard`, which no parent reads: the
// composer's own specs assert the declared trade through it, and nothing in this file names it.
defineExpose({flyDiscardExchange, handleIntent, tradeEntryCard});
</script>
