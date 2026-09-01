<template>
  <!-- data-motion-*: the surface-motion contract — no own backdrop (the
       shared `.con-shade` dims); the panel is the animated unit. The
       CONFIRM path is untouched: the played-hero scene owns that beat
       (armed → flight → landing), our leave only plays on the eventual
       unmount / cancel. -->
  <!-- EMBEDDED (`con-composer--embed`): the SAME instance, re-homed into the
       hand workspace's stage zone by `<Teleport>`. It drops the band geometry,
       its plate, the `con-ws` marker and its `data-motion-surface` id (an
       absent id is the director's documented pass-through — the workspace
       already owns the entrance), and it stops titling itself: the kicker and
       the card name are handed UP to the workspace breadcrumb
       (`setWorkspaceStageName`). A surface that announces itself inside someone
       else's frame is exactly how a stage starts reading as a modal. -->
  <!-- ref="rootEl": this template has leading comments, so a DEV build compiles
       it to a ROOT FRAGMENT and `$el` is a Text node — `$el.querySelector` is
       then `undefined` and every DOM lookup through it silently resolves
       nothing. A production build strips the comments and the same code works,
       which is the worst possible shape for a bug. Anything that needs this
       component's root element takes the ref. -->
  <div ref="rootEl" class="con-composer con-composer--play"
       :class="{
         'con-composer--submitting': submitting,
         'con-composer--embed': embedded,
         'con-ws': !embedded,
         'con-composer--ptsel': playedTargetStepOpen,
         'con-composer--landing': landingUp,
       }"
       role="dialog" :aria-label="titleText"
       :data-motion-surface="embedded ? undefined : 'play-composer'">
    <div class="con-composer__panel con-composer__panel--play" data-motion-panel>
      <!-- ── Header — standalone only (see the EMBEDDED note above) ───
           NO price/verdict line here: the price is stated once, in the head of
           the payment block that meets it («ОПЛАТА · ЦЕНА 12»), and «можно
           разыграть» is what an ACTIVE commit rail already says. A badge
           announcing a green state beside a green button is one restatement;
           a badge repeating the payment's own arithmetic above it is two. The
           blocking case keeps its words — the reason IS the commit rail's
           label (see `ctaLabel` / `ctaBlockedReason`). -->
      <template v-if="!embedded">
        <div class="con-composer__kicker">
          <span class="con-composer__kicker-mark" aria-hidden="true">◈</span>
          <span>{{ $t('Play project card') }}</span>
        </div>
        <div class="con-composer__name">{{ titleText }}</div>
      </template>

      <!-- ── Two columns: card · composer ──────────────────────────── -->
      <!-- data-ws-band: THE STRETCHED BAND. The embedded played-target step
           measures its own vertical budget as «this band's bottom minus my own
           top» — acyclic by construction (the band's height is fixed by the
           layout, the step's top by whatever sits above it), which is what lets
           the step cap itself and scroll only its cards. -->
      <div class="con-composer__playmain" data-ws-band>
        <!-- data-zoom-handoff: the fullscreen inspector's «Разыграть» flies
             the card INTO this slot (consoleZoomMotion.playZoomHandoff).
             NO cascade marker on the card — the occlusion bridge's sweep
             reveals it already standing on the anchor; a fade on top of that
             would be a second, contradictory entrance for the carried object. -->
        <!-- …and when the embedded step's «ИСТОЧНИК · ЭТА КАРТА» proxy is under
             the cursor, THIS is the card it points at. The same accents the
             blue-action workspace uses, for the same reason: the proxy is a
             pointer, so the thing it points at has to answer, or the player is
             asked to trust a line into empty space.
             `data-ptsel-source` is that contract in one attribute — the
             connector measures its right edge, and X on the proxy resolves the
             zoom origin to it so the REAL card is what rises. -->
        <div class="con-composer__playcard" data-zoom-handoff="play-card" data-ptsel-source ref="playCard"
             :class="{
               'con-composer__playcard--targetfocus': selfTargetFocused,
               'con-composer__playcard--targetlock': selfTargetLocked,
             }">
          <Card v-if="card !== undefined" :card="card" :key="card.name" />
        </div>

        <!-- THE SELF-TARGET CONNECTOR — the wire from the selector's proxy to
             the hero card above. It lives HERE, on the band, because the band is
             the only element that contains both ends, and only while there IS a
             self-target: out of flow, but an always-mounted overlay would still
             run a ResizeObserver through every band animation of every play. -->
        <ConsolePlayedTargetLink v-if="selfTargetPresent" />

        <!-- `data-unfold-item` marks the WORK-SURFACE GROUPS (summary line,
             result strip, payment, commit rail, …): they materialize with a
             short stagger just behind the bridge's sweep, so the surface
             assembles in reading order instead of arriving in one frame. -->
        <div class="con-composer__playright" ref="playRight">
          <!-- (No summary line above the work surface. It carried the price and
               a «МОЖНО РАЗЫГРАТЬ» badge — both already stated by the blocks
               below it: the payment head owns the price (after discounts), and
               an active commit rail owns «can be played». Its real cost was
               structural: a fixed strip at the top of the column pinned the
               whole scene to the ceiling, so a short card left a well of empty
               band under the CTA while the hero card sat centred beside it.) -->
          <ConsoleScrollArea class="con-composer__scroll" content-class="con-composer__scroll-body" ref="scroll">
            <div v-if="loading" class="con-composer__loading" data-unfold-item>{{ $t('Loading') }}…</div>

            <!-- ── THE EMBEDDED PLAYED-TARGET STEP — a LEVEL of this
                 workspace: it replaces the review content in place, while the
                 source card keeps its anchor to the left and the header, bars
                 and rail never move. Not a modal, no backdrop, no new
                 container — and every capture below it (the payment above
                 all) is untouched because nothing is unmounted but these
                 review groups. ───────────────────────────────────────────── -->
            <ConsolePlayedTargetStep v-else-if="sub !== undefined && sub.kind === 'playedTarget' && playedTargetModel !== undefined"
                                     ref="targetStep"
                                     :model="playedTargetModel"
                                     :layout="playedTargetLayout"
                                     :focus="sub.focus"
                                     :selection="playedTargetSelection"
                                     :bandHeight="playedTargetHeight"
                                     :lockedCard="playedTargetResults[sub.choiceId]?.cardName ?? ''" />

            <!-- ── SUB-STATE: a PREMIUM pick list (card / player / or w/ metadata
                 chips / nested-input target / tabbed target). ─────────── -->
            <template v-else-if="sub !== undefined && (sub.kind === 'list' || sub.kind === 'orNested' || sub.kind === 'tabbed')">
              <div class="con-composer__sub-title" data-unfold-item>{{ subTitle }}</div>
              <div v-for="(item, i) in listItems" :key="item.key"
                   class="con-composer__opt"
                   :class="{
                     'con-composer__opt--focused': sub.index === i,
                     'con-composer__opt--disabled': item.disabled,
                     'con-composer__opt--chosen': item.chosen,
                   }"
                   :ref="sub.index === i ? 'focusedEl' : undefined">
                <span v-if="item.tab !== undefined" class="con-composer__opt-tab" :class="'con-composer__opt-tab--' + item.tab">{{ $t(item.tab === 'animal' ? 'Animals' : 'Plants') }}</span>
                <span v-if="item.color !== undefined" class="con-composer__opt-dot" :class="'player_bg_color_' + item.color" aria-hidden="true"></span>
                <span class="con-composer__opt-name">{{ item.label
                  }}<!-- WHOSE card this is. A player row IS its owner; a CARD row
                       names a card, so without this the animal targets of an
                       attack said nothing about the victim while every plant row
                       beside them did. Attached to the name (not a column of its
                       own), because it is an attribute of that name. -->
                  <span v-if="item.owner !== undefined" class="con-composer__opt-owner">{{ item.owner }}</span>
                </span>
                <span v-if="item.orItem !== undefined && item.orItem.nested !== undefined" class="con-composer__opt-chevron" aria-hidden="true">›</span>
                <span v-for="(eff, k) in (item.chips ?? [])" :key="'ch' + k" class="con-composer__opt-chip"><ActionEffectChip :effect="eff" /></span>
                <span v-if="item.impact" class="con-composer__opt-impact">
                  <i v-if="item.impactIcon" class="con-composer__opt-impact-icon" :class="iconClass(item.impactIcon)" aria-hidden="true"></i>{{ item.impact }}
                </span>
                <span v-if="item.meta !== ''" class="con-composer__opt-meta">{{ item.meta }}</span>
                <!-- The engine's own caution, in words: «это ваши растения». It
                     reads on the row itself, before any press — a warning that
                     only appears after committing is a receipt, not a warning. -->
                <span v-for="(w, k) in (item.warnings ?? [])" :key="'wn' + k" class="con-composer__opt-warn">⚠ {{ $t(w) }}</span>
                <!-- «Это вы» on a PLAYER row. Same voice as the card version and
                     the same rule: only when it costs you and somebody else was
                     selectable — a forced self-hit is not a mistake to prevent. -->
                <span v-if="item.selfHarm" class="con-composer__opt-warn">⚠ {{ $t('This is you') }}</span>
                <!-- …and the same caution on a CARD row the viewer owns. Virus
                     removes «from any player», so the target list mixes an
                     opponent's card with one of your own — the row that reads
                     most like a clean attack is the one that costs you. -->
                <span v-if="item.selfCard" class="con-composer__opt-warn">⚠ {{ $t('This is your card') }}</span>
                <span v-if="item.disabled && item.reason !== ''" class="con-composer__opt-reason">✕ {{ item.reason }}</span>
                <span v-else-if="item.chosen" class="con-composer__opt-check" aria-hidden="true">✓</span>
              </div>
            </template>

            <!-- ── REVIEW (and the EXPANDED payment editor, which is the SAME
                 screen with the payment block promoted — never a separate
                 form: the card, the header, the result and the CTA all keep
                 their place, only emphasis moves). ──────────────────────── -->
            <template v-else>
              <!-- RESULT HERO: the decision-carrying data (what you get) is the
                   dominant, glance-readable block — not the CTA. While the
                   payment editor is open it steps back (dimmed, NOT unmounted,
                   so the column's geometry is untouched). -->
              <div class="con-composer__resulthero"
                   data-unfold-item
                   :class="{'con-composer__resulthero--muted': payExpanded}">
              <!-- RESULT: variants (selectable) or the single immediate effect. -->
              <div class="con-composer__sub-title con-composer__sub-title--result">{{ $t(resultHeading) }}</div>
              <!-- THE ИЛИ CHOICE — a COMPARISON, so the options stand side by
                   side while the width allows it and fall into a column when it
                   does not (intrinsic: `flex-basis: auto` = each card's own
                   content). Three states, three different things on screen:
                   the CURSOR (cyan ring, no mark), the CHOICE (green plate +
                   ✓, and it stays while the cursor walks away) and the COMMIT
                   (the rail below, unreachable until the choice is made). -->
              <div v-if="hasVariants" class="con-composer__variants" role="radiogroup" :aria-label="$t(resultHeading)">
                <template v-for="(row, k) in variantRows" :key="row.id">
                  <!-- The exclusion, said once between the options: two results
                       that both look possible are otherwise indistinguishable
                       from two results that both happen. -->
                  <div v-if="k > 0" class="con-composer__variants-or" aria-hidden="true">{{ $t('or') }}</div>
                  <div class="con-composer__variant"
                       :class="{
                         'con-composer__variant--focused': focusIdx === row.i,
                         'con-composer__variant--selected': selectedPos === row.pos,
                         'con-composer__variant--off': !branches[row.pos].available,
                       }"
                       role="radio"
                       :aria-checked="selectedPos === row.pos"
                       :aria-disabled="!branches[row.pos].available"
                       :ref="focusIdx === row.i ? 'focusedEl' : undefined"
                       @click="clickVariant(row)">
                    <div class="con-composer__variant-head">
                      <span class="con-composer__variant-title">{{ branchTitle(branches[row.pos]) }}</span>
                      <!-- The ✓ slot is RESERVED (visibility, not v-if): choosing
                           must not re-wrap the title it sits beside. -->
                      <span class="con-composer__variant-check"
                            :class="{'con-composer__variant-check--on': selectedPos === row.pos}"
                            aria-hidden="true">✓</span>
                    </div>
                    <div class="con-composer__variant-chips">
                      <ActionEffectChip v-for="(eff, k2) in branches[row.pos].effects" :key="k2" :effect="eff" />
                    </div>
                    <div v-if="!branches[row.pos].available" class="con-composer__variant-reason">
                      ✕ {{ branchReasonText(branches[row.pos]) }}
                    </div>
                  </div>
                </template>
              </div>
              <div v-else-if="immediateEffects.length > 0" class="con-composer__hero-chips con-composer__result-chips">
                <ActionEffectChip v-for="(eff, k) in immediateEffects" :key="k" :effect="eff" />
              </div>

              <!-- ── THE SECOND LEVEL — what the card IS once it is on the
                   table (a new action, an ongoing effect, endgame points, the
                   tags it carries), under the immediate state change above it.
                   They share ONE container so they lay out as an even grid
                   rather than as chips that happened to wrap: same rhythm,
                   several columns where there is width, a natural wrap where
                   there is not. Membership is data-driven — no card and no
                   count is named here. -->
              <div v-if="repeatChoice !== undefined || resultSections.length > 0" class="con-composer__rescats">
                <!-- ProjectInspection: the result IS repeating a played action. -->
                <div v-if="repeatChoice !== undefined" class="con-composer__rescat con-composer__rescat--action">
                  <span class="con-composer__rescat-glyph" aria-hidden="true">⟳</span>
                  <span class="con-composer__rescat-text">{{ $t('Repeats a played card action') }}</span>
                </div>

                <!-- Derived result categories — the block is NEVER empty. A tag
                     row is "label: [inline chips]"; a VP row is "label: +N". -->
                <div v-for="(sec, i) in resultSections" :key="'r' + i" class="con-composer__rescat"
                     :class="[sec.penalty ? 'con-composer__rescat--penalty' : 'con-composer__rescat--' + sec.kind,
                              {'con-composer__rescat--event-tags': sec.eventTags}]">
                  <span class="con-composer__rescat-glyph" aria-hidden="true">{{ sec.penalty ? '⚠' : rescatGlyph(sec.kind) }}</span>
                  <span class="con-composer__rescat-text"
                  >{{ $t(sec.text) }}<template v-if="sec.kind === 'vp'">: <b>{{ vpDetail(sec) }}</b></template
                  ><template v-else-if="sec.kind === 'tags'">:</template></span>
                  <span v-if="sec.kind === 'tags' && sec.tags !== undefined" class="con-composer__rescat-tags">
                    <span v-for="(tag, t) in sec.tags" :key="t" class="resource-tag con-composer__rescat-tag" :class="'tag-' + tag" aria-hidden="true"></span>
                  </span>
                  <span v-if="sec.note !== undefined" class="con-composer__rescat-note">{{ $t(sec.note) }}</span>
                </div>
              </div>
              </div><!-- /__resulthero -->

              <!-- SILENT-LOSS warnings (verbatim desktop parity): NAME the skipped
                   effect + the magnitude lost, then the reason. -->
              <div v-for="(w, i) in warningSteps" :key="'w' + i" class="con-composer__warn" data-unfold-item>
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

              <!-- Honest post-confirm follow-up (board placement / notes). ONE
                   fixed-height line each: tile icon, the «ДАЛЕЕ» context label,
                   then the sentence. Only the muted constraint tail may clip. -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next" data-unfold-item :aria-label="n.full">
                <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :style="tileIconStyle(n.tileType)" aria-hidden="true"></span>
                <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
                <span class="con-composer__next-label">{{ $t('Next') }}</span>
                <span class="con-composer__next-text">{{ n.text }}</span>
                <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
              </div>

              <!-- DECISIONS: the pre-collected step + tabbed-target rows. -->
              <div v-if="decisionRows.length > 0" class="con-composer__sub-title con-composer__sub-title--spaced" data-unfold-item>{{ $t('Choose before playing') }}</div>
              <div v-for="row in decisionRows" :key="row.id"
                   class="con-composer__row" data-unfold-item
                   :class="{'con-composer__row--focused': focusIdx === row.i, 'con-composer__row--missing': rowMissing(row)}"
                   :ref="focusIdx === row.i ? 'focusedEl' : undefined">
                <!-- A tabbedTargets row (Virus) — the chosen target or a prompt. -->
                <template v-if="row.kind === 'tabbed'">
                  <div class="con-composer__row-label">{{ $t('Choose a target') }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="tabbedChosenLabel(row.stepIndex) !== ''">{{ tabbedChosenLabel(row.stepIndex) }}</span>
                    <span v-else class="con-composer__row-empty">{{ $t('Choose a target') }}…</span>
                  </div>
                </template>
                <!-- The REPEAT slot (ProjectInspection): empty → a prompt; filled →
                     the chosen action drawn as a button with its own action graphic. -->
                <template v-else-if="row.kind === 'repeat'">
                  <div class="con-composer__row-label">{{ $t('Action to repeat') }}</div>
                  <div v-if="repeatResult !== undefined" class="con-composer__repeatpick">
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
                <template v-else-if="row.choice.kind === 'amount'">
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__stepper">
                    <i v-if="amountIcon(row.choice)" class="con-composer__stepper-icon" :class="iconClass(amountIcon(row.choice))" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ amountFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ amountModel(row.choice).min }} – {{ amountModel(row.choice).max }}</span>
                  </div>
                  <!-- The OPERATION preview — both sides' current→after for the
                       dialed value (the SHARED component; one derivation with
                       the action composer and the standalone prompt — this
                       copy of the row had already fallen behind once). The
                       one-element v-for is the template-narrowing idiom. -->
                  <template v-for="op in [amountOperation(row.choice)]" :key="row.choice.id + '#op'">
                    <ConsoleAmountOperation v-if="op !== undefined" :vm="op" compact />
                    <div v-else-if="amountResultLine(row.choice) !== ''" class="con-composer__row-note">{{ amountResultLine(row.choice) }}</div>
                  </template>
                </template>
                <template v-else-if="row.choice.kind === 'spendHeat'">
                  <div class="con-composer__row-label">{{ $t('Heat sources') }}</div>
                  <div class="con-composer__stepper">
                    <i class="con-composer__stepper-icon" :class="iconClass('floater')" aria-hidden="true"></i>
                    <span class="con-composer__stepper-value">{{ floatersFor(row.choice.id) }}</span>
                    <span class="con-composer__stepper-range">{{ $t('Floaters (2 heat each)') }}</span>
                  </div>
                  <div class="con-composer__row-note">{{ $t('Heat') }}: {{ heatStockFor(row.choice) }}</div>
                </template>
                <!-- SELECTED TARGET SUMMARY — an answered played-target choice
                     is a LINK to a card still lying in its owner's tableau, so
                     it shows a thumbnail with its origin and the contextual
                     result, never a second full-size copy of the card. -->
                <template v-else-if="playedTargetResult(row.choice) !== undefined">
                  <div class="con-composer__row-label">{{ $t('Selected card') }}</div>
                  <div class="con-composer__target" v-for="tgt in targetSummaryOf(row.choice)" :key="tgt.cardName">
                    <!-- A SOURCE-CARD target draws no thumbnail: the real card is
                         still standing in the hero slot to the left, and a second
                         copy of it here would be the duplication the selector
                         itself just stopped making. -->
                    <div v-if="tgt.relation !== 'source-card'" class="con-composer__target-thumb" aria-hidden="true">
                      <ConsoleCardFaceLite :name="tgt.cardName" />
                    </div>
                    <span v-else class="con-composer__target-selflink" aria-hidden="true">↰</span>
                    <!-- ONE line: what was chosen, whose it is, and the fact
                         that links it to the Result strip above. The full
                         before→after lives THERE — repeating it here would be
                         the same number twice on one screen. -->
                    <div class="con-composer__target-body">
                      <span class="con-composer__target-name">{{ $t(tgt.cardName) }}</span>
                      <span class="con-composer__target-dot" :class="'player_bg_color_' + tgt.ownerColor" aria-hidden="true"></span>
                      <span class="con-composer__target-origin" :class="'player_color_' + tgt.ownerColor">{{ tgt.ownerName }}</span>
                      <span v-for="imp in targetSummaryImpacts(row.choice)" :key="imp.key" class="con-ptsel__imp">
                        <i v-if="imp.icon" class="con-ptsel__imp-icon" :class="iconClass(imp.icon)" aria-hidden="true"></i>
                        <span class="con-ptsel__imp-label">{{ imp.translate === false ? imp.label : $t(imp.label) }}</span>
                        <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">{{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}</b>
                        <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
                      </span>
                    </div>
                    <!-- The CHANGE affordance — drawn ONLY while this row holds
                         the cursor. A dimmed Ⓐ here was still an Ⓐ: with the
                         focus on the commit rail the screen promised «изменить»
                         next to a button that would have played the card. One
                         physical button may advertise exactly one verb at a
                         time, so this is presence, not emphasis.
                         The slot is RESERVED either way (`visibility`), so
                         gaining the cursor cannot move the row, the thumbnail
                         or anything below it. -->
                    <span class="con-composer__target-change" :class="{'con-composer__target-change--on': focusIdx === row.i}">
                      <GamepadGlyph control="confirm" />
                      <span>{{ $t('Change selection') }}</span>
                    </span>
                  </div>
                </template>
                <!-- THE ESPIONAGE TARGET (Corporate Espionage) — the pick row
                     whose picker is the Hydronetwork workspace itself. The
                     resolved state is the SETUP SUMMARY's attack half: who,
                     their exact `from → to`, and what THEY will receive (or
                     the named skip); the owner's half renders right under it,
                     so the whole causally-ordered outcome reads before the
                     CTA. «Изменить» = A re-opens the same projection mode. -->
                <template v-else-if="row.choice.input.type === 'deltaEspionage'">
                  <div class="con-composer__row-label">{{ $t('Target of the attack') }}</div>
                  <div class="con-composer__row-value">
                    <template v-if="espionageCapture !== undefined && espionageChosenTarget !== undefined">
                      <span class="con-composer__target-dot" :class="'player_bg_color_' + espionageChosenTarget.color" aria-hidden="true"></span>
                      <span>{{ espionageTargetName }}</span>
                      <span class="con-composer__row-impact">{{ espionageChosenTarget.fromPosition }} → {{ espionageChosenTarget.toPosition }}</span>
                      <span v-if="espionageChosenView !== undefined && espionageChosenView.skippedKey !== undefined" class="con-composer__esp-skip">↷ {{ $t(espionageChosenView.skippedKey) }}</span>
                      <template v-else-if="espionageChosenView !== undefined && espionageChosenView.chipOptions.length > 0">
                        <span class="con-composer__esp-chips">
                          <template v-for="(opt, oi) in espionageChosenView.chipOptions" :key="oi">
                            <span v-if="oi > 0" class="con-composer__esp-or">{{ $t('or') }}</span>
                            <HydroReward :chips="opt" :compact="true" />
                          </template>
                        </span>
                        <span v-if="espionageChosenView.isChoice" class="con-composer__esp-note">{{ $t('their own choice') }}</span>
                      </template>
                    </template>
                    <template v-else-if="espionageCapture !== undefined">
                      <span class="con-composer__esp-skip">↷ {{ $t('No player can be pushed back — the attack will be skipped') }}</span>
                    </template>
                    <span v-else class="con-composer__row-empty">{{ $t('Choose a player to push back on the Hydronetwork') }}…</span>
                  </div>
                  <!-- The OWNER'S half of the summary — «Вы получите» for the
                       mandatory own advance, the waiver named when consumed. -->
                  <div v-if="espionageProjection !== undefined" class="con-composer__row-note con-composer__esp-own">
                    <span>{{ $t('You') }}: {{ espionageProjection.owner.fromPosition }} → {{ espionageProjection.owner.toPosition }}</span>
                    <span v-if="espionageProjection.owner.waivedTag !== undefined" class="con-composer__esp-waiver">
                      {{ $t('Ignored tag') }}
                      <span class="resource-tag con-composer__esp-tag" :class="'tag-' + espionageProjection.owner.waivedTag" aria-hidden="true"></span>
                    </span>
                    <span v-if="espionageOwnerView !== undefined && espionageOwnerView.chipOptions.length > 0" class="con-composer__esp-chips">
                      <template v-for="(opt, oi) in espionageOwnerView.chipOptions" :key="'own' + oi">
                        <span v-if="oi > 0" class="con-composer__esp-or">{{ $t('or') }}</span>
                        <HydroReward :chips="opt" :compact="true" />
                      </template>
                    </span>
                    <span v-else-if="espionageOwnerView !== undefined && espionageOwnerView.vpAmount !== undefined">{{ espionageOwnerView.vpAmount }} {{ $t('VP') }}</span>
                    <span v-for="mb in espionageProjection.owner.movementBonuses ?? []" :key="mb.card" class="con-composer__esp-extra">
                      +{{ mb.amount }} <i class="con-composer__row-impact-icon" :class="iconClass(mb.resource)" aria-hidden="true"></i> · {{ $t(mb.card) }}
                    </span>
                  </div>
                </template>
                <template v-else>
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="chosenLabel(row.choice) !== ''">{{ chosenLabel(row.choice) }}</span>
                    <span v-else class="con-composer__row-empty">{{ pickPlaceholder(row.choice) }}…</span>
                    <span v-if="chosenImpact(row.choice) !== ''" class="con-composer__row-impact">
                      <i v-if="chosenImpactIcon(row.choice)" class="con-composer__row-impact-icon" :class="iconClass(chosenImpactIcon(row.choice))" aria-hidden="true"></i>{{ chosenImpact(row.choice) }}
                    </span>
                  </div>
                </template>
              </div>

              <!-- PAYMENT — the ONE shared panel, in the density the state asks
                   for: `compact` summary (LB/RB drive the single alt lane, LT
                   opens the editor) or `expanded` editor (cursor + every lane
                   dialable). Same rows, same order, same geometry — the host
                   owns all input, the panel only renders `paymentView`. -->
              <ConsolePaymentPanel :view="paymentView"
                                   :mode="payMode"
                                   :focus-unit="payFocusUnit"
                                   :flash-nonce="payFlashNonce"
                                   data-unfold-item />

              <!-- The explicit «Разыграть» CTA — a FOCUSABLE row that draws the Ⓐ
                   glyph, so what A does is never ambiguous: A plays ONLY when this
                   row is focused (a pick row's A opens/changes that pick instead). -->
              <div class="con-composer__cta"
                   data-unfold-item
                   :class="{
                     'con-composer__cta--off': !ctaDisplayReady,
                     'con-composer__cta--ready': ctaDisplayReady,
                     'con-composer__cta--focused': ctaFocused && !payExpanded && ctaPressMeaningful,
                     'con-composer__cta--held': !ctaPressMeaningful && !submitting,
                     'con-composer__cta--blocked': ctaBlockedReason !== '',
                   }"
                   :ref="ctaFocused && !payExpanded ? 'focusedEl' : undefined"
                   @click="clickCta()">
                <!-- A REFUSED rail does not advertise Ⓐ. It swaps the glyph for
                     the amber blocker mark this UI uses everywhere else, and
                     its LABEL is the reason itself — so the concrete «почему
                     нельзя» that used to live in the removed header badge is
                     still on screen, now attached to the control it explains
                     instead of floating two blocks above it. -->
                <span v-if="ctaBlockedReason !== ''" class="con-composer__cta-block" aria-hidden="true">⚠</span>
                <!-- …and a rail that cannot RUN advertises no Ⓐ at all: while
                     the result is unchosen this is the first thing on screen,
                     and a glyph there invites exactly the accidental press the
                     pre-select removes. `visibility` keeps its box, so the
                     label never moves when the play becomes possible. -->
                <GamepadGlyph v-else control="confirm" class="con-composer__cta-glyph"
                              :class="{'con-composer__cta-glyph--mute': !ctaPressMeaningful && !submitting}" />
                <span class="con-composer__cta-label">{{ $t(ctaDisplayLabel) }}</span>
              </div>
            </template>
          </ConsoleScrollArea>
          <!-- No inline footer: the CONTEXTUAL controls are published to the
               shell's ONE bottom command bar (consolePlayCardUi) — hints live
               only there. -->
        </div>

        <!-- ── THE RECEIVING STAGE — «… › РАЗЫГРАНО», the workspace's FINAL
             step (played-hero host 'workspace'). An OVERLAY LAYER of the
             WHOLE band zone: absolute by design, so engaging it can never
             re-flow the frame — the two states are stacked layers of ONE
             zone, never a v-if swap (the descend precondition). The setup
             (card column + work surface) releases IN PLACE underneath, so no
             empty source column ever remains; the stage composes around the
             DESTINATION STACK and lays the card onto it inside this same
             frame. Mounted HIDDEN from the submit's arm: layout, stack
             geometry, effect-target anchors and arts all prepare during the
             server round trip — the commit reveals a finished scene. -->
        <div v-if="landingMounted"
             ref="playstage"
             class="con-composer__playstage"
             :class="{'con-composer__playstage--up': landingUp}">
          <ConsolePlayedReceivingStage :playerView="playerView" />
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAY-CARD CONFIRM — the console-native PRE-SUBMIT composer for
 * playing a project card from hand. Desktop-parity contract with
 * HandCardPaymentContent + PlayerHome.submitPlayCardBatch: EVERY interactive
 * choice is made HERE, before the one final submit — the card's PAYMENT, the
 * on-play BRANCH variant (a `behavior.or` like Artificial Photosynthesis), the
 * branch's direct optionInput, and every input step (card / player / amount /
 * or) — a hand-card pick via the hand section, a PLAYED-card pick (single,
 * the Astra merged up-to-N, the Cyberia deduped sequential) via the
 * «Разыграно» tableau pick. Board placements / notes stay a post-submit
 * native follow-up — the documented exception, shown honestly.
 *
 * The captured responses feed the PURE `consoleActionComposer.ts` /
 * `consolePlayCardComposer.ts` builders; the parent assembles the byte-
 * identical batch (`buildPlayCardBatch`). The «РЕЗУЛЬТАТ» block is guaranteed
 * non-empty by `consolePlayCardResult.ts` (immediate effects → new action →
 * permanent effect → VP → tags → honest fallback).
 *
 * Control grammar (hints ONLY in the bottom bar): ↑↓ = navigate variants +
 * step picks + the terminal «Разыграть» CTA (moving onto a variant SELECTS it) ·
 * ←→ = adjust a focused amount · LB/RB = a focused amount stepper, ELSE the
 * inline payment quick-adjust (the simple one-alt-resource case — M€
 * auto-rebalances) · RT = MAX · **A acts on the FOCUSED row** — it PLAYS only on
 * the explicit CTA row (which draws the Ⓐ glyph), opens/re-opens a pick on a
 * card/player/or/tabbed row, advances toward the CTA on a variant/stepper — so A
 * can never be mistaken for "change" and silently play · LT = open the full
 * payment editor · X = inspect the card fullscreen · B = cancel · Y is NOT bound
 * (globally reserved for the information panel). CTA state = `computePrimaryAction`;
 * payment = `buildPaymentView` (all rules there — the component never re-derives
 * payment math).
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {Color} from '@/common/Color';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Message} from '@/common/logs/Message';
import {SelectProjectCardToPlayModel, SelectAmountModel, SelectCardModel, SelectPlayerModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionEffect} from '@/common/models/ActionPreviewModel';
import {extractPlayRewards} from '@/client/console/resourceTransfer/resourceTransferModel';
import {Tag} from '@/common/cards/Tag';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Payment} from '@/common/inputs/Payment';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardHasAction, playerActionGroups, ActionGroup} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {cardHasPassiveEffect} from '@/client/components/effects/effectExtraction';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {enterConsoleHandPick} from '@/client/console/consoleHandPick';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';
import {amountOperationVm, ConversionPromptVm} from '@/client/console/conversionPromptModel';
import {targetImpactRows, targetImpactText, targetImpactIsLoss} from '@/client/components/modalInputs/targetImpactRows';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';
import {translateMessage, translateText, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {
  ComposerChoice, preChoices, branchChoices,
  spendHeatPlan, spendHeatStock, spendHeatResponse, spendHeatValid,
  orderedPreResponses, orderedStepResponses, tabbedStepsOf,
} from '@/client/console/consoleActionComposer';
import {buildOrItems, orItemResponse, buildTabbedTargets, ConsoleOrItem, ConsoleTabbedTarget, TabbedCardOwner} from '@/client/console/consoleOrChoice';
import {
  enterDeltaEspionagePick, deltaEspionageStepResponse, deltaEspionageResponseOf,
} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {enterDeltaRewardPick} from '@/client/console/hydroFlow/deltaRewardEntry';
import type {DeltaEspionageProjectionModel} from '@/common/models/DeltaEspionageModel';
import type {DeltaEspionageInputModel} from '@/common/models/PlayerInputModel';
import type {DeltaEspionageResponse, DeltaStageAnswer, InputResponse} from '@/common/inputs/InputResponse';
import {espionageOutcomeView} from '@/client/console/hydroFlow/espionageOutcomeView';
import {repeatComposedResponses} from '@/client/console/consoleHydroAdvance';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {
  playComposerFootHints, FootHint, PlayFocusKind,
  computePrimaryAction, PrimaryActionState, initialVariantSelection,
  playPrimaryVerb, PlayFocusTarget,
  playChoiceMode, PlayChoiceMode, foldCopiedProductionEffects,
} from '@/client/console/consolePlayCardComposer';
import {
  buildPaymentView, PaymentView, PaymentSourceRow, editableRows, quickAdjustRow,
  initialCounts, dialLaneCount, megacreditsAvailable,
  paymentCovers, paymentFromCounts, PaymentLane, paymentLanes, projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {setConsolePlayCardCommands, resetConsolePlayCardUi} from '@/client/console/consolePlayCardUi';
import {setWorkspaceFrameStage} from '@/client/console/consoleWorkspaceStack';
import {handStageReveal} from '@/client/console/consoleHandStageMotion';
import {takeHandPlayPreview, storeHandPlayPreview, playPreviewUrl} from '@/client/console/consoleHandPlayPrewarm';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsolePlayedTargetLink from '@/client/components/console/played/ConsolePlayedTargetLink.vue';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, findPlayedTargetFocus, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner, playedTargetAt,
  playedTargetResultOf, playedTargetResultLive, playedTargetQuickImpacts, playedTargetSourceCardName,
  PLAYED_TARGET_SUMMARY_IMPACT_CAP,
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetNavDir, PlayedTargetCell,
  PlayedTargetPreviewSection, PlayedTargetResult, PlayedTargetQuickImpact, PlayedTargetSelection,
  PlayedTargetResourceContext,
  togglePlayedTargetPick, playedTargetPicksValid, prunePlayedTargetPicks,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {computeCommitGate, commitAllowed, commitAcceptsCursor, commitRedirectTarget, CommitGate} from '@/client/console/consoleCommitGate';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {gsap} from 'gsap';
import {motionMs} from '@/client/components/motion/motionTokens';
import {playedHeroLandingPrewarm} from '@/client/console/played/consolePlayedHero';
import {
  beginPlayLandingRelease, markPlayLandingReleased, playLandingHolding, playLandingShowing,
  playLandingYieldedToOutcome,
} from '@/client/console/played/consolePlayOutcomeClaim';
import ConsolePlayedReceivingStage from '@/client/components/console/played/ConsolePlayedReceivingStage.vue';

// (The contextual preview + the resource badge live in the ONE shared builder —
//  `consolePlayedTargetPreview`. Two hosts render this selector now, and a
//  builder written twice explains the same mechanic two ways the first time a
//  step shape changes.)
import {derivePlayResultSections, isFallbackOnlyResult, PlayResultSection} from '@/client/console/consolePlayCardResult';
import {NextStepRow, noteRow, placementRow} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
import {tileIconStyle} from '@/client/console/consoleTileIcon';

/**
 * The NAVIGABLE pre-select rows — variants + collectable step picks ONLY. Payment
 * and the play CTA are NOT rows: A is a smart global primary action (it plays /
 * advances / opens payment from anywhere) and LT opens the payment lanes, so
 * neither needs to be a focus target competing with the CTA.
 */
type GroupNode = ActionGroup['nodes'][number];

type PlayRow =
  | {i: number, id: string, kind: 'variant', pos: number}
  | {i: number, id: string, kind: 'step', choice: ComposerChoice}
  | {i: number, id: string, kind: 'tabbed', stepIndex: number}
  // The "repeat an already-used action" slot (ProjectInspection) — a FOCUSABLE
  // row whose A opens the ДЕЙСТВИЯ КАРТ pick surface; once filled it draws the
  // chosen action as a button with its graphic.
  | {i: number, id: string, kind: 'repeat', choice: ComposerChoice}
  // The explicit «Разыграть» call-to-action — a FOCUSABLE terminal row, so A
  // plays ONLY when the player is on it (never from a pick row). It draws the Ⓐ
  // glyph, so what A does is always unambiguous.
  | {i: number, id: string, kind: 'cta'};

type SubState =
  /** THE EMBEDDED PLAYED-TARGET STEP — a level of this workspace, not a modal
   *  over it: the same `sub` slot every other in-place step uses, so B is one
   *  logical level and the payment / captures below it are never touched. */
  | {kind: 'playedTarget', choiceId: string, focus: PlayedTargetFocus, picked: ReadonlyArray<string>}
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'orNested', choiceId: string, item: ConsoleOrItem, index: number}
  | {kind: 'tabbed', stepIndex: number, index: number}
  | {kind: 'payment', index: number};

type ListItem = {
  key: string, label: string, meta: string, disabled: boolean, reason: string, chosen: boolean,
  color?: string, card?: CardModel,
  /** Premium metadata chips (an OrOptions option's steal/gain preview). */
  chips?: ReadonlyArray<ActionEffect>,
  /** `current → resulting` impact (a card / player / tabbed target). */
  impact?: string,
  /** The resource icon for the impact (so "0 → 2" names WHICH resource). */
  impactIcon?: string,
  /** Tab badge for a tabbed target ('animal' | 'plant'). */
  tab?: string,
  /** The engine's own cautions for this option, already sentences (i18n keys). */
  warnings?: ReadonlyArray<string>,
  /** WHO the row takes from, when the row's own label names a CARD instead of a
   *  player (a tabbed animal target). */
  owner?: string,
  /** This row is the VIEWER, the move costs them, and another target existed. */
  selfHarm?: boolean,
  /** …the same, for a CARD row standing in the viewer's own tableau. */
  selfCard?: boolean,
  /** The whole or-item, when this row is an OrOptions option (leaf or nested). */
  orItem?: ConsoleOrItem,
};

/**
 * The implicit "just play it" branch used when the preview has NO branches (a
 * card with no on-play choice, or a preview fetch that failed) — so the card is
 * always playable with a bare `{type:'projectCard'}` submit, exactly the old
 * graceful fallback. Any real on-play choice arrives as a native follow-up.
 */
const IMPLICIT_BRANCH: ActionPreviewBranch = {index: -1, title: '', available: true, renderKeys: [], effects: [], steps: []};

/**
 * The landing scene's EXIT (ms @ motion scale 1). Short by design: the deck is
 * already dealing, so this is a surface stepping aside, not a beat of its own.
 */
const PLAYSTAGE_RELEASE_MS = 220;

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

// Pre-collect classification lives in the PURE `playChoiceMode` (inline sub /
// hand-section pick / «Разыграно» tableau pick / honest follow-up) — see
// consolePlayCardComposer.ts.

/** Synthetic-step capture indices for the espionage owner's landing asks —
 *  far past any real branch step, so a capture can never collide with one,
 *  and `orderedStepResponses` (which walks the branch's own steps) never
 *  emits them into the batch: they FOLD into the espionage response. */
const ESP_OWNER_CHOICE_INDEX = 901;
const ESP_OWNER_REPEAT_INDEX = 902;
const ESP_OWNER_ANIMAL_INDEX = 903;

/**
 * A choice-stage alternative → the SERVER's exact option key (the very
 * strings `DeltaProjectExpansion.resolveReward`'s own OrOptions prints, so
 * every locale already translates them). The option INDEX is the wire
 * answer; the title is presentation only — a projection shape this map does
 * not know falls back to a structural line rather than a wrong promise.
 */
function espOwnerOptionTitle(o: {resource: string, amount: number, production?: true}): string {
  if (o.production === true) {
    if (o.resource === 'energy' && o.amount === 1) {
      return 'Increase energy production 1 step';
    }
    if (o.resource === 'heat' && o.amount === 1) {
      return 'Increase heat production 1 step';
    }
    return `Increase ${o.resource} production ${o.amount} step`;
  }
  if (o.resource === 'steel' && o.amount === 2) {
    return 'Gain 2 steel';
  }
  if (o.resource === 'plants' && o.amount === 2) {
    return 'Gain 2 plants';
  }
  return `Gain ${o.amount} ${o.resource}`;
}

export default defineComponent({
  name: 'ConsolePlayCardConfirm',
  components: {Card, ConsoleScrollArea, GamepadGlyph, ActionEffectChip, ConsolePaymentPanel, CardRenderEffectBoxComponent, CardRenderData, ConsolePlayedTargetStep, ConsolePlayedTargetLink, ConsolePlayedReceivingStage, ConsoleAmountOperation, HydroReward},
  directives: {stripActionPrefix},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    cardName: {type: String as PropType<CardName>, required: true},
    input: {type: Object as PropType<SelectProjectCardToPlayModel>, required: true},
    /**
     * RE-HOMED into a workspace's own zone (`consoleWorkspaceStack`). Mirrors
     * `ConsoleTaskHost.embedded` / `ConsolePlayedOverlay.embedded`: the band
     * geometry, the plate, the own header and the motion-surface id come off;
     * the logic, the captures, the payment, the command contract and the input
     * path are NOT touched. One prop, not one per flavour — «настройка → выбор
     * → оплата» is one phase of one surface.
     */
    embedded: {type: Boolean, default: false},
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      preview: undefined as ActionPreview | undefined,
      loading: true,
      selectedPos: undefined as number | undefined,
      capturedPre: {} as Record<number, unknown>,
      capturedOption: undefined as unknown,
      captured: {} as Record<number, unknown>,
      amounts: {} as Record<string, number>,
      floaters: {} as Record<string, number>,
      picks: {} as Record<string, string>,
      /** The RICH result of each answered played-target choice — owner, category,
       *  physical slot key and preview snapshot. The batch still submits the
       *  plain card capture; this is presentation + future-animation context. */
      playedTargetResults: {} as Record<string, PlayedTargetResult>,
      /** Per-owner cursor memory for the tabbed mode (a tab you return to
       *  should be where you left it). */
      playedTargetOwnerFocus: {} as Record<string, number>,
      /** The step's measured content width — the split/tabs decision reads it. */
      playedTargetWidth: 0,
      /**
       * THE STEP'S VERTICAL BUDGET, measured from the STRETCHED band
       * (`.con-composer__playmain`, `flex: 1` of the panel) and never from
       * anything inside it.
       *
       * This is not a detail. The right column and its scroll area are BOTH
       * content-sized here (`align-self: center` + `max-height: 100%`), so a
       * budget read from either is a function of the very cards it is about to
       * size — a cycle whose fixpoint depends on nothing but what the unmeasured
       * first render happened to produce. That is what drew a LONE candidate
       * smaller than each of two: one card in one stacked block made a shorter
       * column than two blocks did, so it measured itself a smaller room and
       * settled there.
       */
      playedTargetHeight: 0,
      /** Multi-select hand picks by choice id (display; the capture is the truth). */
      multiPicks: {} as Record<string, ReadonlyArray<string>>,
      payCounts: {} as Partial<Record<SpendableResource, number>>,
      /** The composed repeat-action pick (ProjectInspection): the chosen
       *  already-used action + its own composed responses. Filled by
       *  `consoleRepeatPick`; carried as `repeat` in the confirm payload. */
      repeatResult: undefined as ConsoleRepeatPickResult | undefined,
      focusIdx: 0,
      sub: undefined as SubState | undefined,
      submitting: false,
      /** Bumped on each quick-adjust to re-trigger the one-shot chip pulse. */
      payFlashNonce: 0,
    };
  },
  computed: {
    thisPlayer() {
      return this.playerView.thisPlayer;
    },
    card(): CardModel | undefined {
      return this.input.cards.find((c) => c.name === this.cardName);
    },
    titleText(): string {
      return translateCardName(this.cardName);
    },
    cost(): number {
      return this.card?.calculatedCost ?? 0;
    },
    // ── payment (the desktop project-card rules, via paymentPlan) ────────
    paymentPrompt() {
      let tags: ReadonlyArray<Tag> = [];
      try {
        tags = getCard(this.cardName)?.tags ?? [];
      } catch (err) {
        tags = [];
      }
      return projectCardPaymentPrompt(this.cost, tags, this.input.paymentOptions ?? {}, this.thisPlayer.lastCardPlayed, this.card?.reserveUnits);
    },
    payLanes(): Array<PaymentLane> {
      return paymentLanes(this.paymentPrompt, this.thisPlayer);
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.thisPlayer);
    },
    paymentReady(): boolean {
      return paymentCovers(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    /** The full payment view-model — source rows + verdict + editability. The
     *  UI renders + calls actions; ALL rules stay in `buildPaymentView`. */
    paymentView(): PaymentView {
      return buildPaymentView({
        cost: this.cost,
        lanes: this.payLanes,
        counts: this.payCounts,
        mcAvailable: this.megacreditsOnHand,
      });
    },
    /** The single row LB/RB (and RT МАКС.) drive on the COMPACT screen. */
    quickAdjustChip(): PaymentSourceRow | undefined {
      return quickAdjustRow(this.paymentView);
    },
    /**
     * Is the EXPANDED editor a place worth going? Only with two or more
     * alternative sources — with one the compact block already is the editor
     * (same rows, same numbers, and the bumpers drive that very lane), so LT
     * would open a second copy of the screen the player is looking at. The rule
     * lives in the pure view (`editorEligible`); the host only obeys it — here,
     * in the CTA's shortfall fallback and in the footer.
     */
    payEditorAvailable(): boolean {
      return this.paymentView.editorEligible;
    },
    /** The EXPANDED payment editor is open — the SAME screen with the payment
     *  block promoted (result dimmed, cursor inside the panel), never a
     *  separate form and never a different geometry. */
    payExpanded(): boolean {
      return this.sub?.kind === 'payment';
    },
    payMode(): 'compact' | 'expanded' {
      return this.payExpanded ? 'expanded' : 'compact';
    },
    /**
     * THE STAGE'S OWN NAME (i18n key), handed UP to the workspace breadcrumb.
     * One word wherever possible, and never an echo of the root's noun («КАРТЫ
     * В РУКЕ › ЦЕНТР ИИ › РОЗЫГРЫШ», not «… › РОЗЫГРЫШ КАРТЫ»).
     */
    stageName(): string {
      // Past the commit the workspace is at its FINAL stage: the card is
      // being laid into «Разыграно» — the tail says so, in one word.
      if (this.landingUp) {
        return 'Played';
      }
      if (this.sub?.kind === 'payment') {
        return 'Payment';
      }
      if (this.sub !== undefined) {
        return 'Selection';
      }
      return 'Playing';
    },
    // ── THE LANDING STAGE (the workspace's «РАЗЫГРАНО» final step) ───────
    /** The scene HOLDS the stage — the raw fact, without its exit. The watcher
     *  below turns its falling edge into a dissolve. */
    landingHolding(): boolean {
      return this.embedded && playLandingHolding();
    },
    /** The stage is ON SCREEN — the review has released, the tableau owns the
     *  zone, the card is being laid onto its pile… and it stays until the deck
     *  BEGINS DEALING what the play drew, then dissolves off (the exit is part
     *  of «on screen», or the `v-if` below would cut it mid-fade). */
    landingUp(): boolean {
      return this.embedded && playLandingShowing();
    },
    /** The stage layer is MOUNTED — includes the hidden PREWARM window (the
     *  submit round trip), so after A nothing heavy happens for the first
     *  time: layout done, peek faces painted, arts decoding. */
    landingMounted(): boolean {
      return this.landingUp || (this.embedded && playedHeroLandingPrewarm());
    },
    /** The hand-editable rows, in panel order — the editor's focus ring. */
    payEditableRows(): ReadonlyArray<PaymentSourceRow> {
      return editableRows(this.paymentView);
    },
    /** The unit the editor's cursor sits on (LB/RB + ←→ drive it). */
    payFocusUnit(): string | undefined {
      if (this.sub?.kind !== 'payment') {
        return undefined;
      }
      return this.payEditableRows[this.sub.index]?.unit;
    },
    // ── branches / choices ──────────────────────────────────────────────
    branches(): ReadonlyArray<ActionPreviewBranch> {
      return this.preview?.branches ?? [];
    },
    hasVariants(): boolean {
      return this.branches.length > 1;
    },
    /**
     * THE CARD ASKS A REAL «ИЛИ» QUESTION — two or more branches the rules
     * actually allow. One playable branch among several is NOT a question (the
     * others are shown greyed with their reason, and `initialVariantSelection`
     * seeds it), so nothing on this screen may demand a choice there.
     * Stable for the life of the preview, which is why the heading can key on
     * it without ever re-flowing.
     */
    hasVariantChoice(): boolean {
      return this.branches.filter((b) => b.available).length > 1;
    },
    /** The question is asked and NOT yet answered — the screen's first state. */
    variantChoicePending(): boolean {
      return this.hasVariantChoice && this.selectedPos === undefined;
    },
    /**
     * THE HEADING. «ВЫБЕРИТЕ РЕЗУЛЬТАТ» while the card asks, «РЕЗУЛЬТАТ» when it
     * only reports — and it never changes at the moment of choosing (the
     * predicate is the card's shape, not the player's progress), so answering
     * cannot re-flow the block under the cursor.
     */
    resultHeading(): string {
      return this.hasVariantChoice ? 'Choose the result' : 'Result';
    },
    selectedBranch(): ActionPreviewBranch | undefined {
      if (this.selectedPos !== undefined) {
        return this.branches[this.selectedPos];
      }
      if (this.branches.length === 1) {
        // A single-branch card has no variant pick — the lone branch is it.
        return this.branches[0];
      }
      // No branches (no on-play choice, or a failed/absent preview) → the card
      // still plays; the implicit branch carries the bare submit.
      return this.branches.length === 0 ? IMPLICIT_BRANCH : undefined;
    },
    immediateEffects(): ReadonlyArray<ActionEffect> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      // Copy-the-production steps (Cyberia / Robotic Workforce): once a target
      // is picked, its server-computed production box FOLDS into the result —
      // the player sees EXACTLY what is copied, live as they re-pick.
      const folded = foldCopiedProductionEffects(
        b,
        (i) => this.capturedCardNameAt(i),
        (res) => this.playerProduction(res),
      );
      const out: Array<ActionEffect> = folded !== undefined ? [...folded] : [...b.effects];
      if (b.reveal !== undefined) {
        out.push(b.reveal.reward);
      }
      return out;
    },
    allChoices(): ReadonlyArray<ComposerChoice> {
      return [...preChoices(this.preview), ...branchChoices(this.selectedBranch), ...this.espOwnerChoices];
    },
    // ── the ESPIONAGE ask (Corporate Espionage, DP10) ─────────────────────
    /** The play's espionage step, when the card carries one. */
    espionageChoice(): ComposerChoice | undefined {
      return this.allChoices.find((c) => c.input.type === 'deltaEspionage');
    },
    /** THE server-authored projection — every espionage row/summary reads this
     *  one payload; nothing is re-derived from a cell number. */
    espionageProjection(): DeltaEspionageProjectionModel | undefined {
      const c = this.espionageChoice;
      return c === undefined ? undefined : (c.input as DeltaEspionageInputModel).projection;
    },
    /** The captured espionage response — the ONE source of the chosen target
     *  (the summary row and the re-open's prior both read it back). */
    espionageCapture(): DeltaEspionageResponse | undefined {
      const c = this.espionageChoice;
      return c === undefined ? undefined : deltaEspionageResponseOf(this.captured[c.index]);
    },
    /** The chosen target's projection entry (for the summary row). */
    espionageChosenTarget() {
      const target = this.espionageCapture?.target;
      if (target === undefined) {
        return undefined;
      }
      return this.espionageProjection?.targets.find((t) => t.color === target);
    },
    espionageChosenView() {
      const t = this.espionageChosenTarget;
      return t === undefined ? undefined : espionageOutcomeView(t.reward, t.rewardSkipped);
    },
    espionageTargetName(): string {
      const t = this.espionageChosenTarget;
      return t === undefined ? '' : displayNameForColor(this.playerView.players, t.color);
    },
    espionageOwnerView() {
      const proj = this.espionageProjection;
      return proj === undefined ? undefined : espionageOutcomeView(proj.owner.reward);
    },
    /**
     * The OWNER'S OWN landing asks as ORDINARY composer choices, synthesized
     * from the projection so the whole established machinery (rows, subs,
     * captures, the commit gate) serves them with no special cases:
     *  - a CHOICE stage (1/2) → an `or` choice over the server's exact
     *    alternative keys (the same strings its own OrOptions prints);
     *  - the repeat stage (7) → a `repeatAction` card choice (the premium
     *    repeat browser composes the nested inputs);
     *  - the animal stage (9) → a `card` choice over the tableau candidates
     *    (the embedded played-target step).
     * Indices live far past any real branch step, so the captures can never
     * collide — and `orderedStepResponses` naturally never emits them into
     * the batch (they FOLD into the espionage response at submit).
     */
    espOwnerChoices(): ReadonlyArray<ComposerChoice> {
      const proj = this.espionageProjectionRaw;
      if (proj === undefined || !proj.owner.legal) {
        return [];
      }
      const reward = proj.owner.reward;
      if (reward.kind === 'choice') {
        const orModel: OrOptionsModel = {
          title: 'Choose your Hydronetwork reward',
          buttonLabel: 'Confirm',
          type: 'or',
          options: reward.options.map((o) => ({
            title: espOwnerOptionTitle(o),
            buttonLabel: 'Select',
            type: 'option' as const,
          })),
        };
        return [{id: 'esp-owner-choice', scope: 'step', index: ESP_OWNER_CHOICE_INDEX, kind: 'or', input: orModel}];
      }
      if (reward.kind === 'repeat-action' && (reward.candidateCards?.length ?? 0) > 0) {
        const model: SelectCardModel = {
          title: 'Use a blue card action that has already been used this generation',
          buttonLabel: 'Take action',
          type: 'card',
          cards: (reward.candidateCards ?? []).map((name) => ({name} as CardModel)),
          max: 1, min: 1, showOnlyInLearnerMode: false, selectBlueCardAction: true, showOwner: false, showSelectAll: false,
        };
        return [{id: 'esp-owner-repeat', scope: 'step', index: ESP_OWNER_REPEAT_INDEX, kind: 'card', input: model, repeatAction: true}];
      }
      if (reward.kind === 'card-resource' && (reward.candidateCards?.length ?? 0) > 0) {
        const byName = new Map(this.playerView.thisPlayer.tableau.map((c) => [c.name, c]));
        const model: SelectCardModel = {
          title: 'Select card to add 2 animals',
          buttonLabel: 'Select',
          type: 'card',
          cards: (reward.candidateCards ?? []).map((name) => byName.get(name) ?? ({name} as CardModel)),
          max: 1, min: 1, showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
        };
        return [{id: 'esp-owner-animal', scope: 'step', index: ESP_OWNER_ANIMAL_INDEX, kind: 'card', input: model, amount: 2, cardResource: 'animal'}];
      }
      return [];
    },
    /** The projection read WITHOUT the synthesized rows — `espOwnerChoices`
     *  may not read a computed that includes itself (`allChoices`). */
    espionageProjectionRaw(): DeltaEspionageProjectionModel | undefined {
      const steps = [...(this.preview?.preSteps ?? []), ...(this.selectedBranch?.steps ?? [])];
      for (const s of steps) {
        if (s.kind === 'input' && s.input.type === 'deltaEspionage') {
          return (s.input as DeltaEspionageInputModel).projection;
        }
      }
      return undefined;
    },
    /** The owner's landing answer, folded from the synthetic rows' captures —
     *  rides INSIDE the espionage response, never as its own batch entry. */
    espionageOwnerAnswer(): DeltaStageAnswer | undefined {
      const proj = this.espionageProjectionRaw;
      if (proj === undefined || !proj.owner.legal) {
        return undefined;
      }
      const position = proj.owner.toPosition;
      const reward = proj.owner.reward;
      if (reward.kind === 'choice') {
        const captured = this.captured[ESP_OWNER_CHOICE_INDEX] as {type?: string, index?: number} | undefined;
        return captured?.type === 'or' && typeof captured.index === 'number' ?
          {position, rewardChoice: captured.index} : undefined;
      }
      if (reward.kind === 'repeat-action' && this.repeatResult !== undefined && this.espOwnerChoices.some((c) => c.id === 'esp-owner-repeat')) {
        const composed = repeatComposedResponses(this.repeatResult.composed) as ReadonlyArray<InputResponse>;
        return {
          position,
          selectedCard: this.repeatResult.chosenCard,
          ...(composed.length > 0 ? {repeatResponses: composed} : {}),
        };
      }
      if (reward.kind === 'card-resource') {
        const captured = this.captured[ESP_OWNER_ANIMAL_INDEX] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
        return captured?.type === 'card' && captured.cards !== undefined && captured.cards.length > 0 ?
          {position, selectedCard: captured.cards[0]} : undefined;
      }
      return undefined;
    },
    // (The old multi-card-branch follow-up carve-out is GONE: merge slots
    // host as ONE multi tableau pick, dedupe steps as sequential picks.)
    /** Card names in the player's hand — hand-card picks route to the hand
     *  section's pick mode instead of an inline text list. */
    handNamesSet(): ReadonlySet<string> {
      return new Set(this.playerView.cardsInHand.map((c) => c.name));
    },
    /** Card names on ANY player's table — those picks route to the EMBEDDED
     *  played-target step (the surface that shows whose card it is, where it
     *  sits, and what choosing it would do). */
    playedNamesSet(): ReadonlySet<string> {
      const names = new Set<string>();
      for (const player of this.playerView.players) {
        for (const c of player.tableau) {
          names.add(c.name);
        }
      }
      return names;
    },
    /**
     * THE EMBEDDED SELECTOR'S MODEL — built only while the step is open (or
     * warmed for the focused row), so a play with no played-card choice never
     * pays for it. Eligibility is the SERVER's candidate set, verbatim; the
     * preview is built from the server's own step data below.
     */
    playedTargetModel(): PlayedTargetModel | undefined {
      const choice = this.playedTargetChoice;
      if (choice === undefined) {
        return undefined;
      }
      const model = choice.input as SelectCardModel;
      // DEDUPE (Cyberia Systems' sequential copy steps): a card an EARLIER
      // step already holds is not a candidate here. The rule lived only in the
      // old tableau-pick branch; it moves with the flow rather than being left
      // behind — the step's contract is «only selectable candidates», and a
      // card that cannot be chosen twice is not selectable a second time.
      const taken = new Set<string>();
      const step = choice.scope === 'step' ? this.selectedBranch?.steps[choice.index] : undefined;
      for (const si of (step !== undefined && step.kind === 'input' ? step.dedupeFromSteps ?? [] : [])) {
        const name = this.capturedCardNameAt(si);
        if (name !== undefined) {
          taken.add(name);
        }
      }
      return buildPlayedTargetModel({
        candidates: taken.size === 0 ? model.cards : model.cards.filter((c) => !taken.has(c.name)),
        players: this.playerView.players,
        viewerColor: this.thisPlayer.color,
        ask: textOf(model.title),
        // The card being PLAYED, which CAN be a candidate for its own on-play
        // effect: Titan Floating Launch-pad adds two floaters to any Jovian card
        // and is itself Jovian, so with no other Jovian card in play it is the
        // only legal target the rules offer. It has no tableau row yet, so the
        // model seats it with the viewer, and it renders as the SAME handle the
        // blue actions use — an arrow pointing at the card already standing in
        // the hero slot, never a second full-size copy of one physical object.
        sourceCardName: this.cardName,
        typeOf: (name) => getCard(name)?.type,
        // A NEGATIVE delta means the step takes FROM the chosen card, which is
        // what makes «your own card» a warning rather than the ordinary target.
        takesFromTarget: (choice.amount ?? 0) < 0,
        preview: (name) => this.playedTargetPreview(choice, name),
        resourceContext: (_name, card) => this.playedTargetResourceContext(choice, card),
      });
    },
    /** The embedded selector holds the surface right now. */
    /** The embedded step's self-handle is focused — the played card answers. */
    /**
     * THE SELF-TARGET LINK, as this host sees it — all three gated on «MY step
     * is the open one».
     *
     * `playedTargetSelfState` is a singleton and carries no owner: a second
     * composer parked at its own played-target step publishes into the same
     * fact. Without the gate this host would light its hero, and mount its
     * connector, for a step standing inside a different workspace.
     *
     * `present` additionally keeps the band free of an always-mounted overlay
     * (and its ResizeObserver) for the overwhelming majority of prompts, which
     * offer no self-target at all.
     */
    selfTargetPresent(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.present;
    },
    selfTargetFocused(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.focused;
    },
    /** …and stays lit once it is the chosen target. */
    selfTargetLocked(): boolean {
      return this.sub?.kind === 'playedTarget' && playedTargetSelfState.locked;
    },
    playedTargetStepOpen(): boolean {
      return this.sub?.kind === 'playedTarget' && this.playedTargetModel !== undefined;
    },
    /** The choice the open (or pending) played-target step serves. */
    playedTargetChoice(): ComposerChoice | undefined {
      const id = this.sub?.kind === 'playedTarget' ? this.sub.choiceId : this.playedTargetRowId;
      return id === undefined ? undefined : this.allChoices.find((c: ComposerChoice) => c.id === id);
    },
    /**
     * The FIRST decision row this step owns — used to render its summary and
     * to warm the model before the player presses A.
     *
     * Returns the CHOICE id, not the ROW id. The row's own id is prefixed
     * (`step#<choiceId>`), so returning it made the lookup in
     * `playedTargetChoice` miss every time: the model came out undefined and
     * A on the row did nothing at all.
     */
    playedTargetRowId(): string | undefined {
      const row = this.decisionRows
        .find((r) => r.kind === 'step' && this.choiceMode(r.choice) === 'playedTarget');
      return row !== undefined && row.kind === 'step' ? row.choice.id : undefined;
    },
    playedTargetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.playedTargetModel?.owners ?? [],
        availW: this.playedTargetWidth,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The live ask of the OPEN step (the component's `selection` prop). A
     *  COMPUTED, not a method: the template binds it and the input handlers
     *  read it every press, so it must track `sub.picked` reactively. */
    playedTargetSelection(): PlayedTargetSelection {
      const choice = this.playedTargetChoice;
      return choice === undefined ? {mode: 'single'} : this.playedTargetSelectionFor(choice);
    },
    /** The game-state version a selection is only valid under. */
    playedTargetVersion(): string {
      return `${this.playerView.game.gameAge}|${this.playerView.game.undoCount ?? 0}`;
    },
    /** The selected branch is a MERGED-slot pick (Astra: its card steps are
     *  slots of one "up to N" SelectCard → hosted as ONE multi tableau pick
     *  on the FIRST card step; the later card steps collapse into it). */
    mergeBranchActive(): boolean {
      return this.selectedBranch?.mergeCardSteps !== undefined;
    },
    /** The FIRST card step's index of a merge branch (the pick host). */
    firstMergeCardStepIndex(): number {
      const b = this.selectedBranch;
      if (b === undefined || b.mergeCardSteps === undefined) {
        return -1;
      }
      return b.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'card');
    },
    /** Card-step slots of the merge branch (the multi pick's max). */
    mergeCardStepCount(): number {
      const b = this.selectedBranch;
      if (b === undefined || b.mergeCardSteps === undefined) {
        return 0;
      }
      return b.steps.reduce((n, s) => n + (s.kind === 'input' && s.input.type === 'card' ? 1 : 0), 0);
    },
    stepChoices(): ReadonlyArray<ComposerChoice> {
      return this.allChoices.filter((c) =>
        this.choiceMode(c) !== 'followup' && this.choiceMode(c) !== 'repeat' && !this.isCollapsedMergeStep(c));
    },
    followUpChoices(): ReadonlyArray<ComposerChoice> {
      // The repeat choice is its OWN dedicated row (never a follow-up note).
      return this.allChoices.filter((c) => !this.stepChoices.includes(c) && this.choiceMode(c) !== 'repeat');
    },
    /** The "repeat an already-used action" choice (ProjectInspection), if any. */
    repeatChoice(): ComposerChoice | undefined {
      return this.allChoices.find((c) => this.choiceMode(c) === 'repeat');
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
    rows(): ReadonlyArray<PlayRow> {
      const out: Array<PlayRow> = [];
      if (this.hasVariants) {
        this.branches.forEach((_b, pos) => out.push({i: 0, id: 'variant#' + pos, kind: 'variant', pos}));
      }
      if (this.repeatChoice !== undefined) {
        out.push({i: 0, id: 'repeat', kind: 'repeat', choice: this.repeatChoice});
      }
      for (const c of this.stepChoices) {
        out.push({i: 0, id: 'step#' + c.id, kind: 'step', choice: c});
      }
      for (const t of this.tabbedSteps) {
        out.push({i: 0, id: 'tabbed#' + t.index, kind: 'tabbed', stepIndex: t.index});
      }
      // The terminal «Разыграть» CTA is always the last focusable row.
      out.push({i: 0, id: 'cta', kind: 'cta'});
      return out.map((r, i) => ({...r, i}));
    },
    ctaIndex(): number {
      return this.rows.findIndex((r) => r.kind === 'cta');
    },
    /**
     * THE COMMIT GATE — the same shared model the action composer reads, so
     * both screens answer «may this be confirmed yet» the same way.
     *
     * Satisfaction is `rowMissing` (the domain's own verdict, never a count).
     * An UNPLAYABLE card is the un-fillable case: the reason belongs on the
     * commit row, and there is no requirement to send the cursor to.
     *
     * A PAYMENT SHORTFALL is deliberately NOT modelled as a blocking
     * requirement here. On this screen the commit row stays reachable — with a
     * multi-lane payment its A even fixes the shortfall (it opens the editor) —
     * so hiding the row from the cursor would remove a working affordance,
     * which is the opposite of the problem this model exists to fix. The gate
     * still refuses the COMMIT; `ctaPressMeaningful` is what decides the ring
     * and the glyph.
     */
    commitGate(): CommitGate {
      const st = this.primaryActionState;
      return computeCommitGate({
        requirements: this.rows
          .filter((r): r is PlayRow => r.kind !== 'cta')
          .map((r) => ({index: r.i, verb: this.rowVerb(r), satisfied: !this.rowMissing(r)})),
        submitting: this.submitting,
        unavailable: st.kind === 'blocked-requirement' ?
          st.reason :
          (st.kind === 'blocked-payment' ? 'Not enough resources' : undefined),
      });
    },
    /** May A actually PLAY the card right now? */
    commitReady(): boolean {
      return commitAllowed(this.commitGate) && !this.payExpanded;
    },
    /**
     * Does pressing A on the commit row DO something? That — not «is the play
     * ready» — is what earns the active ring and the live glyph: a payment
     * shortfall opens the editor (WHERE there is one — with a single alt lane
     * the fix is the bumpers under the player's thumbs, and A does nothing),
     * and the expanded editor confirms the payment.
     */
    ctaPressMeaningful(): boolean {
      return this.commitReady || this.payExpanded ||
        (this.primaryActionState.kind === 'blocked-payment' && this.payEditorAvailable);
    },
    /** The last cursor stop — the commit row drops out only when a real ROW is
     *  waiting for the player (the gate's `incomplete` / `stale`). */
    navMaxIndex(): number {
      const last = this.rows.length - 1;
      return commitAcceptsCursor(this.commitGate) ? last : Math.max(0, Math.min(last, this.ctaIndex - 1));
    },
    ctaFocused(): boolean {
      return this.focusedRow?.kind === 'cta';
    },
    variantRows(): ReadonlyArray<PlayRow & {kind: 'variant'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'variant'} => r.kind === 'variant');
    },
    /** The pre-collectable decision rows (repeat slot + step picks + tabbed-target picks). */
    decisionRows(): ReadonlyArray<PlayRow & {kind: 'step' | 'tabbed' | 'repeat'}> {
      return this.rows.filter((r): r is PlayRow & {kind: 'step' | 'tabbed' | 'repeat'} =>
        r.kind === 'step' || r.kind === 'tabbed' || r.kind === 'repeat');
    },
    focusedRow(): PlayRow | undefined {
      return this.focusIdx >= 0 ? this.rows[this.focusIdx] : undefined;
    },
    /** The ONE smart primary action — see computePrimaryAction. Focus-independent. */
    primaryActionState(): PrimaryActionState {
      const b = this.selectedBranch;
      const branchSelectable = b !== undefined && b.available;
      // The variant rows are requirements too, so they must not ALSO be counted
      // as an unresolved STEP — «выберите результат» and «сделайте выбор перед
      // розыгрышем» are different sentences about different rows.
      const firstMissing = this.rows.findIndex((r) => r.kind !== 'variant' && this.rowMissing(r));
      const firstVariant = this.rows.findIndex((r) => r.kind === 'variant' && this.rowMissing(r));
      return computePrimaryAction({
        variantPending: this.variantChoicePending && firstVariant >= 0 ? {rowIndex: firstVariant} : undefined,
        branchSelectable,
        paymentReady: this.paymentReady,
        firstUnresolvedStepRowIndex: firstMissing >= 0 ? firstMissing : undefined,
        // The blocked CTA carries the SERVER's own reason — the same string the
        // variant row already shows. Without it the biggest control on the
        // screen was labelled «Сейчас недоступно» while the real explanation
        // sat two rows above it. (Mirrors ConsoleActionComposer.commitGate.)
        requirementReason: b !== undefined && !b.available ? this.branchReasonText(b) : undefined,
      });
    },
    // ── result sections (never empty) ───────────────────────────────────
    resultSections(): ReadonlyArray<PlayResultSection> {
      const meta = getCard(this.cardName);
      return derivePlayResultSections(
        {
          tags: meta?.tags ?? [],
          hasAction: cardHasAction(this.cardName),
          hasEffect: cardHasPassiveEffect(this.cardName),
          victoryPoints: meta?.victoryPoints,
          isEvent: meta?.type === CardType.EVENT,
          // Odyssey makes an event's tags count like any other card's.
          eventTagsCounted: this.thisPlayer.tableau.some((c) => c.name === CardName.ODYSSEY),
        },
        // The repeat slot IS the meaningful result for ProjectInspection — count
        // it so the block is never the misleading "applied after confirming".
        // A skipped-effect WARNING counts too: when the card's only on-play
        // content is an effect that will be lost, the fallback would promise
        // «применится после подтверждения» directly beside the warning saying
        // it will not — the block contradicting itself in two adjacent lines.
        {hasImmediate: this.hasImmediateResult, hasFollowUp: this.hasFollowUpResult},
      );
    },
    hasImmediateResult(): boolean {
      return this.branches.some((b) => b.effects.length > 0 || b.reveal !== undefined);
    },
    /** Everything the block states about what happens AFTER the confirm —
     *  placement notes, the repeat slot, and the warnings that name a skipped
     *  effect. All three make the "applied after confirming" fallback a lie. */
    hasFollowUpResult(): boolean {
      return this.followUpNotes.length > 0 || this.repeatChoice !== undefined || this.warningSteps.length > 0;
    },
    // Skipped-effect warnings: WHICH effect is lost (title + muted chip) and why.
    // Derived by the SAME shared helper the desktop modal uses, then translated —
    // the two surfaces can never say different things about the same warning.
    warningSteps(): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> {
      const out: Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> = [];
      for (const b of this.branches) {
        if (!b.available && b !== this.selectedBranch) {
          continue;
        }
        for (const w of skippedEffectViews(b.steps)) {
          out.push({
            title: w.title !== '' ? translateText(w.title) : '',
            reason: translateText(w.reason),
            effect: w.effect,
            // Only a chip-less warning needs the bare fallback sprite (the chip
            // renders its own icon).
            icon: w.effect === undefined && w.icon !== '' ? iconClassFor(w.icon) : '',
          });
        }
      }
      // The merged up-to-N pick (Astra) explicitly answered EMPTY: legal
      // (min 0) but easy to do by accident — the branch's emptyWarning makes
      // it a conscious choice BEFORE submit (the desktop popup, console-shaped).
      const sel = this.selectedBranch;
      const emptyWarning = sel?.mergeCardSteps?.emptyWarning;
      if (emptyWarning !== undefined) {
        const host = this.stepChoices.find((c) => this.isMergedPickChoice(c));
        if (host !== undefined && this.multiPicks[host.id]?.length === 0) {
          out.push({title: '', reason: textOf(emptyWarning), icon: ''});
        }
      }
      return out;
    },
    followUpNotes(): Array<NextStepRow> {
      const b = this.selectedBranch;
      if (b === undefined) {
        return [];
      }
      const out: Array<NextStepRow> = [];
      if (b.reveal !== undefined) {
        out.push(noteRow(translateText('Reveal a card')));
      }
      for (const s of b.steps) {
        if (s.kind === 'boardPlacement') {
          // WHICH tile — named, and «особый тайл» first when it is one. The
          // wording lives in `consolePlacementNextStep`, never here.
          out.push(placementRow(s, consoleTranslate, textOf));
        } else if (s.kind === 'note' && s.noteKind !== 'warning') {
          out.push(noteRow(s.text !== undefined ? textOf(s.text) : translateText('Choose a target')));
        }
        // `tabbedTargets` is now PRE-COLLECTED inline (a decision row) — no note.
      }
      for (const c of this.followUpChoices) {
        // A collapsed merge slot is HOSTED by the first slot's multi pick —
        // never a bogus "after confirming" note.
        if (this.isCollapsedMergeStep(c)) {
          continue;
        }
        const t = textOf(c.input.title);
        out.push(noteRow(t !== '' ? t : translateText('Choose a target')));
      }
      return out;
    },
    // ── confirm gating ──────────────────────────────────────────────────
    canConfirm(): boolean {
      if (this.loading) {
        return false;
      }
      const b = this.selectedBranch;
      if (b === undefined || !b.available || !this.paymentReady) {
        return false;
      }
      // The repeat-action slot (ProjectInspection) must be filled first.
      if (this.repeatChoice !== undefined && this.repeatResult === undefined) {
        return false;
      }
      // EVERY pre-collectable choice (inline sub / hand pick — incl. a
      // multi-select hand pick, where even an "empty" answer is an explicit
      // visit) must be captured; follow-up choices ride the native flow.
      if (this.stepChoices.some((c) => this.stepMissing(c))) {
        return false;
      }
      // A tabbedTargets step (Virus) is pre-collected — require its capture.
      return b.steps.every((step, i) => step.kind !== 'tabbedTargets' || this.captured[i] !== undefined);
    },
    ctaReady(): boolean {
      return this.primaryActionState.kind === 'ready';
    },
    /** The big CTA strip label — the primary action in words. */
    ctaLabel(): string {
      const st = this.primaryActionState;
      switch (st.kind) {
      case 'ready': return 'Play card';
      // Calm INSTRUCTION, not a refusal: the rail says what the screen is
      // waiting for instead of dangling a live «Разыграть карту» over a result
      // the player has not chosen.
      case 'need-variant': return 'Choose the result first';
      case 'need-preselect': return 'Choose an option';
      case 'blocked-payment': return 'Not enough resources';
      case 'blocked-requirement': return st.reason;
      }
    },
    /**
     * The CTA strip while the payment EDITOR is open: the same row, same place,
     * but it now confirms the payment («Готово») instead of the play — so the
     * expanded state always shows the player the way back into the main flow,
     * and the strip never has to unmount (which would move the column).
     */
    ctaDisplayLabel(): string {
      if (this.payExpanded) {
        return this.paymentReady ? 'Done' : 'Not enough resources';
      }
      return this.ctaLabel;
    },
    ctaDisplayReady(): boolean {
      return this.payExpanded ? this.paymentReady : this.ctaReady;
    },
    /**
     * WHY the card cannot be played right now — '' when nothing blocks it.
     *
     * This is the surviving half of the removed header badge: the positive
     * state needs no words (an active commit rail says it), the blocking one
     * needs the CONCRETE reason, so it is stated where the refusal is felt.
     * The rail's own label already IS that reason (`ctaLabel`); this computed
     * decides whether the rail wears the blocker mark instead of the Ⓐ glyph.
     *
     * Deliberately NOT «is the CTA disabled»: `need-preselect` is an
     * INSTRUCTION («выберите вариант») and a submit in flight is a wait —
     * neither is a blocker, and marking them as one would cry wolf.
     */
    ctaBlockedReason(): string {
      if (this.payExpanded || this.submitting) {
        return '';
      }
      const st = this.primaryActionState;
      // A rules-blocked branch offers NO choice — the server's own reason is
      // the only honest thing to say (the same string the variant row shows).
      return st.kind === 'blocked-requirement' ?
        st.reason :
        (st.kind === 'blocked-payment' ? 'Not enough resources' : '');
    },
    focusedKind(): PlayFocusKind {
      const row = this.focusedRow;
      if (row === undefined || row.kind !== 'step') {
        return row?.kind === 'variant' ? 'variant' : 'none';
      }
      if (row.choice.kind === 'amount') {
        return 'amount';
      }
      if (row.choice.kind === 'spendHeat') {
        return 'spendHeat';
      }
      return 'pick';
    },
    /**
     * The A-button verb for the FOCUSED row. The decision itself is
     * `playPrimaryVerb` (pure, unit-tested); this only reports which row the
     * cursor is on. The ROW's own affordance reads the same focus, so the
     * command bar and the row can never advertise different verbs.
     */
    primaryFooter(): {label: string, enabled: boolean} {
      const row = this.focusedRow;
      const focused: PlayFocusTarget = row === undefined ?
        'none' :
        // A VARIANT is its own target: A there says «ВЫБРАТЬ» and does exactly
        // that. It used to fall through to «ДАЛЕЕ», which named neither the
        // press's effect nor its consequence.
        (row.kind === 'cta' ? 'cta' : (row.kind === 'variant' ? 'variant' : (this.focusedOpensPicker ? 'picker' : 'other')));
      return playPrimaryVerb({
        focused,
        pickAnswered: row !== undefined && !this.rowMissing(row),
        primary: this.primaryActionState,
      });
    },
    /** The focused row opens a sub-picker on A (card/player/or step or tabbed) —
     *  A = «Выбрать»/«Изменить» there, never «Разыграть». */
    focusedOpensPicker(): boolean {
      const row = this.focusedRow;
      if (row === undefined) {
        return false;
      }
      if (row.kind === 'tabbed' || row.kind === 'repeat') {
        return true;
      }
      if (row.kind === 'step' && row.choice.input.type === 'deltaEspionage') {
        // The system-resolved no-target outcome is not re-openable — there is
        // nothing to change, and the verb must not promise otherwise.
        return (row.choice.input as DeltaEspionageInputModel).projection.hasLegalTarget;
      }
      return row.kind === 'step' &&
        (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or');
    },
    footHints(): Array<FootHint> {
      // A focused amount/spend-heat stepper OWNS LB/RB; otherwise the inline
      // payment quick-adjust does (when eligible).
      const focusedStepper = this.focusedKind === 'amount' || this.focusedKind === 'spendHeat';
      const row = this.quickAdjustChip;
      const quickAdjust = (!focusedStepper && row !== undefined) ?
        {canDecrease: row.canDecrease, canIncrease: row.canIncrease} : undefined;
      return playComposerFootHints({
        // Every list-like sub (list / orNested / tabbed) shares the pick contract;
        // the embedded played-target step has its own (D-pad + owner tabs).
        sub: this.sub === undefined ?
          'none' :
          (this.sub.kind === 'payment' ? 'payment' : (this.sub.kind === 'playedTarget' ? 'playedTarget' : 'list')),
        targetOwnerTabs: this.playedTargetLayout.mode === 'tabs' && (this.playedTargetModel?.owners.length ?? 0) > 1,
        targetMulti: this.playedTargetSelection.mode === 'multi' ? {
          count: this.playedTargetSelection.picked.length,
          valid: playedTargetPicksValid(this.playedTargetSelection),
          verb: (this.playedTargetChoice?.input as SelectCardModel | undefined)?.buttonLabel || 'Select',
        } : undefined,
        subIsCardList: this.subChoice?.input.type === 'card' || this.sub?.kind === 'orNested' || this.sub?.kind === 'tabbed',
        // More than the lone CTA row → there's something to navigate between.
        hasRows: this.rows.length > 1,
        focusedKind: this.focusedKind,
        paymentEditor: this.payEditorAvailable,
        paymentReady: this.paymentReady,
        primaryLabel: this.primaryFooter.label,
        primaryEnabled: this.primaryFooter.enabled,
        quickAdjust,
      });
    },
    // ── sub-state derived views ─────────────────────────────────────────
    subChoice(): ComposerChoice | undefined {
      if (this.sub === undefined || (this.sub.kind !== 'list' && this.sub.kind !== 'orNested')) {
        return undefined;
      }
      return this.stepChoices.find((c) => c.id === (this.sub as {choiceId: string}).choiceId);
    },
    subTitle(): string {
      if (this.sub?.kind === 'tabbed') {
        return translateText('Choose a target');
      }
      if (this.sub?.kind === 'orNested') {
        return textOf(this.sub.item.label);
      }
      const c = this.subChoice;
      return c !== undefined ? this.choiceTitle(c) : '';
    },
    /** The pre-collectable tabbedTargets steps (Virus) of the selected branch. */
    tabbedSteps(): Array<{index: number, step: TabbedTargetsStep}> {
      return tabbedStepsOf(this.selectedBranch);
    },
    listItems(): ReadonlyArray<ListItem> {
      const sub = this.sub;
      if (sub === undefined) {
        return [];
      }
      // TABBED targets (Virus: remove ≤2 animals OR ≤5 plants) — a flat list.
      if (sub.kind === 'tabbed') {
        const ts = this.tabbedSteps.find((t) => t.index === sub.stepIndex);
        if (ts === undefined) {
          return [];
        }
        const chosenKey = this.picks['tabbed#' + sub.stepIndex];
        const targets = this.tabbedTargets(ts.step);
        // The self-caution follows the PLAYER-row rule exactly: it fires only
        // when another target was selectable — a forced self-hit is not a
        // mistake to prevent.
        const hasAlternative = targets.filter((t) => !t.disabled).length > 1;
        return targets.map((t): ListItem => ({
          key: t.key, label: translateText(t.label), meta: '', disabled: t.disabled,
          reason: textOf(t.reason), chosen: chosenKey === t.key, color: t.playerColor, impact: t.impact, impactIcon: t.icon, tab: t.tab,
          // The sub-list already advertises «ОСМОТРЕТЬ»; carrying the model is
          // what makes that press do anything on a card row.
          card: t.card,
          owner: t.ownerName,
          selfCard: t.ownerSelf === true && !t.disabled && hasAlternative,
        }));
      }
      // NESTED-input or option (Comet for Venus's SelectPlayer sitting in the or).
      if (sub.kind === 'orNested') {
        return this.nestedItems(sub.item);
      }
      const c = this.subChoice;
      if (c === undefined) {
        return [];
      }
      if (c.input.type === 'card') {
        const model = c.input as SelectCardModel;
        const chosenName = this.picks[c.id];
        const items: Array<ListItem> = model.cards.map((card): ListItem => ({
          key: card.name,
          label: translateCardName(card.name),
          meta: card.resources !== undefined && card.resources > 0 ? `${card.resources}` : '',
          disabled: card.isDisabled === true,
          reason: card.isDisabled === true ? textOf(card.disabledReason) : '',
          chosen: chosenName === card.name,
          card,
          impact: (c.amount !== undefined && card.isDisabled !== true) ? `${card.resources ?? 0} → ${Math.max(0, (card.resources ?? 0) + c.amount)}` : undefined,
          impactIcon: c.cardResource,
        }));
        for (const card of model.disabledCards ?? []) {
          items.push({key: 'd' + card.name, label: translateCardName(card.name), meta: '', disabled: true, reason: textOf(card.disabledReason), chosen: false, card});
        }
        return items;
      }
      if (c.input.type === 'player') {
        return this.playerItems(c.input as SelectPlayerModel, this.picks[c.id]);
      }
      // PREMIUM or list — each option's metadata chips + player + nested indicator.
      if (c.input.type === 'or') {
        const chosen = this.picks[c.id];
        return buildOrItems(c.input as OrOptionsModel).map((it): ListItem => ({
          key: it.key, label: textOf(it.label), meta: '', disabled: it.disabled, reason: textOf(it.reason),
          chosen: chosen === String(it.optionIndex), color: it.playerColor, chips: it.chips,
          warnings: it.warnings, orItem: it,
        }));
      }
      return [];
    },
  },
  watch: {
    /**
     * The SYSTEM OUTCOME of an espionage play with NO legal target: the pick
     * is captured as the explicit no-target response the moment the
     * projection says so — an empty selector must never open, the row reads
     * «атака пропущена», and the CTA stays reachable. A projection WITH a
     * legal target never auto-captures (the pick is mandatory and conscious).
     */
    espionageProjectionRaw: {
      immediate: true,
      handler(proj: DeltaEspionageProjectionModel | undefined): void {
        if (proj === undefined || proj.hasLegalTarget) {
          return;
        }
        const c = this.espionageChoice;
        if (c !== undefined && this.captured[c.index] === undefined) {
          this.captureFor(c, deltaEspionageStepResponse(proj, undefined, this.espionageOwnerAnswer));
        }
      },
    },
    cardName: {
      immediate: true,
      handler() {
        this.resetCaptures();
        this.payCounts = initialCounts(this.cost, this.payLanes, this.megacreditsOnHand);
        this.focusIdx = 0;
        // The FOCUS PREWARM's synchronous read: a hit means this exact card's
        // preview was fetched under this exact game-state version while the
        // player was still considering it — the composer mounts CONTENT-
        // COMPLETE, so the entry transition never contains a «Загрузка…» row
        // or the layout swap its replacement used to cause. A miss (fast A
        // before the dwell, changed game state) falls back to the live fetch.
        const warmed = takeHandPlayPreview(this.playerView, this.cardName);
        if (warmed.hit) {
          this.preview = warmed.preview;
          this.loading = false;
          this.applyPreview();
          return;
        }
        this.preview = undefined;
        this.loading = true;
        this.fetchPreview();
      },
    },
    playerView() {
      this.submitting = false;
    },
    // Publish the CONTEXTUAL footer controls to the shell's ONE bottom command
    // bar (hints live only there — never inline). Replaces the old hard-coded,
    // diverged command list in the shell.
    footHints: {
      immediate: true,
      handler(hints: Array<FootHint>) {
        setConsolePlayCardCommands(hints);
      },
    },
    /**
     * Hand the STAGE NAME up to the workspace breadcrumb. The tail advances
     * with the sub-state («РОЗЫГРЫШ» → «ОПЛАТА» → «ВЫБОР») because that is the
     * only segment allowed to change: root and subject are the same vnodes for
     * the whole flow, so the line proves continuity by construction while
     * still telling the player which step they are on.
     */
    stageName: {
      immediate: true,
      handler(key: string) {
        if (this.embedded) {
          setWorkspaceFrameStage('hand', key);
        }
      },
    },
    /**
     * THE SETUP RELEASE of the commit: the WHOLE setup layer — the work
     * column AND the anchored card column (its card is already blanked under
     * the independent hero) — lets go in place, so no empty source column
     * ever remains and the receiving stage above becomes the zone's only
     * content. A REFUSED submit reverses it: the setup returns with the same
     * materialize cascade it entered with, captures intact.
     */
    landingHolding(now: boolean, was: boolean) {
      // THE EXIT, not a rollback: the play's outcome has taken the stage (the
      // deck began dealing what it drew, or its decision surface is standing in
      // the workspace's zone), so the tableau dissolves off and the released
      // setup STAYS released — the play happened. (A refusal falls through to
      // the rollback below; the two are told apart by the positive fact, never
      // by the absence of the other.)
      if (!now && was && playLandingYieldedToOutcome()) {
        beginPlayLandingRelease();
        this.runPlaystageRelease();
        return;
      }
      const right = this.$refs.playRight as HTMLElement | undefined;
      const card = this.$refs.playCard as HTMLElement | undefined;
      const layers = [right, card].filter((el): el is HTMLElement => el !== undefined);
      if (layers.length === 0) {
        return;
      }
      gsap.killTweensOf(layers);
      if (now) {
        gsap.to(layers, {autoAlpha: 0, duration: motionMs(110) / 1000, ease: 'power1.in'});
        return;
      }
      // Rollback (server refusal): the setup comes back to full strength and
      // its groups re-materialize — the player retries or cancels from the
      // exact configuration they submitted.
      gsap.set(layers, {clearProps: 'opacity,visibility'});
      handStageReveal(this.$refs.rootEl as HTMLElement | undefined);
    },
  },
  mounted() {
    // THE SECOND REVEAL. The zone opened a flush ago (it must exist before the
    // teleport resolves, or the content is dropped), so its own enter hook had
    // nothing to cascade. Without this the controls would simply appear inside
    // an already-open box — the same blink the descent exists to remove.
    if (this.embedded) {
      void this.$nextTick(() => handStageReveal(this.$refs.rootEl as HTMLElement | undefined));
    }
  },
  beforeUnmount() {
    resetConsolePlayCardUi();
  },
  methods: {
    /**
     * Re-arm the confirm CTA after a REFUSED submit (the played-card hero
     * transaction keeps this composer open through the server round-trip;
     * on error the shell calls this so the player can retry or cancel —
     * a successful play unmounts the composer instead).
     */
    resetSubmitting(): void {
      this.submitting = false;
    },
    /**
     * THE LANDING SCENE LEAVES THE STAGE — the deck has begun dealing what this
     * play drew, and what is arriving needs the room.
     *
     * A DISSOLVE, never the class flip that used to end this scene: the tableau
     * simply stopped existing between two frames while the cards it produced
     * were still on their way, which reads as the interface losing its place.
     * It sinks a hair as it goes (the same `power2.in` recede every console
     * surface leaves with), and the flag it clears is what lets the element
     * unmount — so the exit can never be cut short by its own `v-if`.
     */
    runPlaystageRelease(): void {
      const el = this.$refs.playstage as HTMLElement | undefined;
      if (el === undefined || el === null || consoleReducedMotionActive()) {
        markPlayLandingReleased(); // no element / reduced motion: it is simply gone
        return;
      }
      gsap.killTweensOf(el);
      gsap.to(el, {
        autoAlpha: 0,
        scale: 0.985,
        transformOrigin: '50% 45%',
        duration: motionMs(PLAYSTAGE_RELEASE_MS) / 1000,
        ease: 'power2.in',
        onComplete: () => markPlayLandingReleased(),
      });
    },
    iconClass(icon: string | undefined): string {
      return icon !== undefined ? iconClassFor(icon) : '';
    },
    rescatGlyph(kind: string): string {
      switch (kind) {
      case 'action': return '⟳';
      case 'effect': return '✦';
      case 'vp': return '★';
      case 'tags': return '#';
      default: return '›';
      }
    },
    /** The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face). */
    tileIconStyle,
    vpDetail(sec: PlayResultSection): string {
      if (sec.variable === true) {
        // «по условию» — the same fact as «зависит от условий» in a third of
        // the width, which is what lets the unit sit in a column beside its
        // siblings instead of stretching the row it lives in.
        return translateText('by condition');
      }
      // A penalty spells the unit out — "-2 ПО" — so the negative reads clearly.
      if (sec.penalty === true) {
        return `${sec.detail ?? ''} ${translateText('VP')}`;
      }
      return sec.detail ?? '';
    },
    fetchPreview(): void {
      const cardName = this.cardName;
      // ONE URL builder with the prewarm — the warmed request and the live
      // request can never drift apart.
      fetch(playPreviewUrl(this.playerView.id, cardName))
        .then((r) => (r.ok ? r.json() : undefined))
        .then((p) => {
          // Feed the prewarm cache too: a pick-bridge return or a re-open in
          // the same game state remounts content-complete.
          storeHandPlayPreview(this.playerView, cardName, p as ActionPreview | undefined);
          if (this.cardName === cardName) {
            this.preview = p as ActionPreview | undefined;
            this.loading = false;
            this.applyPreview();
          }
        })
        .catch(() => {
          if (this.cardName === cardName) {
            this.loading = false;
            this.applyPreview();
          }
        });
    },
    resetCaptures(): void {
      this.selectedPos = undefined;
      this.capturedPre = {};
      this.capturedOption = undefined;
      this.captured = {};
      this.amounts = {};
      this.floaters = {};
      this.picks = {};
      this.multiPicks = {};
      this.repeatResult = undefined;
      this.sub = undefined;
      this.submitting = false;
    },
    applyPreview(): void {
      // NO auto-select where there is a real ИЛИ choice (`initialVariantSelection`
      // — pure, and the ONE place the rule lives). The screen used to open with a
      // branch already selected, the commit rail already live, and one A played
      // the card on a result the player had never chosen. A seeded selection is
      // an answer nobody gave.
      this.selectedPos = initialVariantSelection(this.branches);
      this.seedChoiceDefaults();
      this.focusIdx = this.firstActionableIndex();
      // Dev audit: a genuine preview gap (no immediate result, no follow-up) —
      // surface it once per load so it can be found and closed (audit contract).
      if (isFallbackOnlyResult(this.resultSections, {hasImmediate: this.hasImmediateResult, hasFollowUp: this.hasFollowUpResult})) {
        console.warn(`[console play] no computable preview for ${this.cardName} — showing fallback result`);
      }
    },
    /** The row to focus on open / after a pick: the first UNRESOLVED choice,
     *  else the «Разыграть» CTA (so a ready card lands the player on the explicit
     *  play button showing Ⓐ — never on a pick row where A might read as "play"). */
    firstActionableIndex(): number {
      const missing = this.rows.findIndex((r) => this.rowMissing(r));
      return missing >= 0 ? missing : this.ctaIndex;
    },
    /** The A-verb a row publishes while it holds the cursor and is unanswered
     *  — the next real step, not the screen's eventual purpose. */
    rowVerb(row: PlayRow): string {
      if (row.kind === 'tabbed') {
        return 'Choose a target';
      }
      if (row.kind === 'repeat') {
        return 'Choose an action to repeat';
      }
      if (row.kind === 'variant') {
        return 'Choose an option';
      }
      if (row.kind === 'step' && row.choice.input.type === 'deltaEspionage') {
        return 'Choose a player';
      }
      switch (row.kind === 'step' ? row.choice.kind : undefined) {
      case 'card': return 'Choose a card';
      case 'player': return 'Choose a player';
      case 'or': return 'Choose an option';
      case 'spendHeat': return 'Heat sources';
      default: return 'Select';
      }
    },
    /** Whether a decision row is still unresolved. */
    rowMissing(row: PlayRow): boolean {
      if (row.kind === 'step') {
        return this.stepMissing(row.choice);
      }
      if (row.kind === 'tabbed') {
        return this.captured[row.stepIndex] === undefined;
      }
      if (row.kind === 'repeat') {
        return this.repeatResult === undefined;
      }
      if (row.kind === 'variant') {
        // THE ИЛИ CHOICE IS A REQUIREMENT. While it is unmade every CHOOSABLE
        // variant is outstanding, which is what makes the commit gate withhold
        // the cursor from the commit rail — the structural reason a second A
        // (a repeat, a held button) cannot reach the play. An unavailable
        // branch is NOT a requirement: there is nothing to answer there, and it
        // must not catch the opening cursor either.
        return this.variantChoicePending && this.branches[row.pos]?.available === true;
      }
      return false;
    },
    /** The tabbed targets (Virus) WITH each animal card's owner resolved — the
     *  ONE build point, so the rows, the folded answer and the pick can't
     *  disagree about what the player chose. */
    tabbedTargets(step: TabbedTargetsStep): ReadonlyArray<ConsoleTabbedTarget> {
      return buildTabbedTargets(step, (name) => this.cardOwner(name));
    },
    /**
     * WHO holds a played card, by name (cards are unique in a game). The server
     * models a card pick as bare names, so an attack on a CARD can only name its
     * victim from the live view — the same resolution the played-target picker
     * uses. Not on anyone's tableau ⇒ it is the viewer's (a hand / SRR-hosted
     * card), never a misleading "neutral".
     */
    cardOwner(name: string): TabbedCardOwner | undefined {
      const me = this.thisPlayer.color;
      const owner = this.playerView.players.find((p) => p.tableau.some((c) => c.name === name)) ??
        this.playerView.players.find((p) => p.color === me);
      return owner === undefined ?
        undefined :
        {color: owner.color, name: participantDisplayName(owner), self: owner.color === me};
    },
    /** The chosen tabbed-target's label (Virus) for the row, or '' when none.
     *  A CARD target carries its owner into the folded answer too — «from whom»
     *  is half the decision and must survive the sub-picker closing. */
    tabbedChosenLabel(stepIndex: number): string {
      const ts = this.tabbedSteps.find((t) => t.index === stepIndex);
      const key = this.picks['tabbed#' + stepIndex];
      if (ts === undefined || key === undefined) {
        return '';
      }
      const target = this.tabbedTargets(ts.step).find((t) => t.key === key);
      if (target === undefined) {
        return '';
      }
      const label = translateText(target.label);
      return target.ownerName !== undefined ? `${label} · ${target.ownerName}` : label;
    },
    /** Premium player rows (with a per-target `current → resulting` impact). */
    playerItems(model: SelectPlayerModel, chosen: string | undefined): Array<ListItem> {
      const items: Array<ListItem> = model.players.map((color): ListItem => ({
        key: color, label: this.playerName(color), meta: '', disabled: false, reason: '', chosen: chosen === color, color,
        impact: this.playerImpact(model, color), impactIcon: model.icon,
        // «Это вы» — only when it is a LOSS and somebody else could have taken
        // it instead. Alone in the list it is forced, not a mistake.
        selfHarm: color === this.thisPlayer.color && model.players.length > 1 &&
          targetImpactIsLoss(this.playerImpactRows(model, color)),
      }));
      for (const d of model.disabledPlayers ?? []) {
        items.push({key: 'd' + d.color, label: this.playerName(d.color), meta: '', disabled: true, reason: textOf(d.reason), chosen: false, color: d.color});
      }
      return items;
    },
    /** The shared per-target rows — ONE derivation for the text and the verdict. */
    playerImpactRows(model: SelectPlayerModel, color: string): ReadonlyArray<TargetImpactChange> {
      return targetImpactRows(color as Color, {
        impacts: model.targetImpacts,
        icon: model.icon,
        amount: model.amount,
        scope: model.scope,
        player: this.playerView.players.find((p) => p.color === color),
      });
    },
    playerImpact(model: SelectPlayerModel, color: string): string | undefined {
      // SERVER impacts first, then the shared derivation — hand-rolling the
      // field name here printed NOTHING for M€ / plants production (the model's
      // fields are singular) and the wrong numbers for a MarsBot target.
      const text = targetImpactText(targetImpactRows(color as Color, {
        impacts: model.targetImpacts,
        icon: model.icon,
        amount: model.amount,
        scope: model.scope,
        player: this.playerView.players.find((p) => p.color === color),
      }));
      return text !== '' ? text : undefined;
    },
    /** Candidate rows of a NESTED-input or option (Comet for Venus's SelectPlayer). */
    nestedItems(item: ConsoleOrItem): Array<ListItem> {
      const nested = item.nested;
      if (nested === undefined) {
        return [];
      }
      if (nested.type === 'player') {
        return this.playerItems(nested as SelectPlayerModel, undefined);
      }
      if (nested.type === 'card') {
        const model = nested as SelectCardModel;
        return model.cards.map((card): ListItem => ({
          key: card.name, label: translateCardName(card.name),
          meta: card.resources !== undefined && card.resources > 0 ? `${card.resources}` : '',
          disabled: card.isDisabled === true, reason: card.isDisabled === true ? textOf(card.disabledReason) : '', chosen: false, card,
        }));
      }
      return [];
    },
    seedChoiceDefaults(): void {
      for (const c of this.stepChoices) {
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
      }
      // A card/player/or TARGET is NEVER auto-selected — not even a lone
      // candidate (the fork's non-negotiable no-auto-select rule): the player
      // must consciously pick WHERE the resource goes, so a single-target choice
      // is never silently skipped. The row starts unresolved, focus lands on it,
      // and A opens the picker («Выбрать»). Only amount/heat get a visible,
      // adjustable default above.
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
    stepMissing(c: ComposerChoice): boolean {
      if (c.scope === 'option') {
        return this.capturedOption === undefined;
      }
      return c.scope === 'pre' ? this.capturedPre[c.index] === undefined : this.captured[c.index] === undefined;
    },
    // ── amount / spendHeat helpers ──────────────────────────────────────
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
      return '';
    },
    /**
     * The premium two-sided OPERATION for this dial — the SHARED derivation
     * (conversionPromptModel) the action composer and the standalone prompt
     * use. Play-time dials touch the viewer's own stocks/production
     * (Insulation's heat→M€ production), so the public-player read is the
     * whole pool story here.
     */
    amountOperation(c: ComposerChoice): ConversionPromptVm | undefined {
      return amountOperationVm(this.amountModel(c), this.amountFor(c.id),
        (icon, scope) => playerResourceValue(this.thisPlayer, icon, scope));
    },
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
    // ── pick rows ───────────────────────────────────────────────────────
    choiceTitle(c: ComposerChoice): string {
      // A MERGED pick (Astra) is ONE multi-select here — its per-slot titles
      // («Выберите ПЕРВОЕ событие…») would promise a sequence the console
      // never shows. The branch's own merged prompt is the honest ask.
      const merged = this.mergedPickTitle(c);
      if (merged !== '') {
        return merged;
      }
      const t = textOf(c.input.title);
      if (t !== '') {
        return t;
      }
      switch (c.kind) {
      case 'card': return translateText('Choose a card');
      case 'player': return translateText('Choose a player');
      case 'or': return translateText('Choose an option');
      default: return '';
      }
    },
    pickPlaceholder(c: ComposerChoice): string {
      // The merged pick answers N slots at once ON THE TABLE — the generic
      // «Выберите себе карту» promises one card from the wrong place.
      if (this.isMergedPickChoice(c)) {
        return translateText('Pick cards on the table');
      }
      switch (c.kind) {
      case 'card': return translateText(this.isMultiCardChoice(c) ? 'Pick cards from hand' : 'Choose a card');
      case 'player': return translateText('Choose a player');
      default: return translateText('Choose an option');
      }
    },
    isMultiCardChoice(c: ComposerChoice): boolean {
      return c.input.type === 'card' && ((c.input as SelectCardModel).max ?? 1) > 1;
    },
    chosenLabel(c: ComposerChoice): string {
      // A resolved MULTI-select (hand multi OR the merged tableau pick) shows
      // the picked cards themselves (first two names + «+N»), so the
      // selection stays VISIBLE in the composer — an explicit empty answer
      // reads honestly as «Выбрано: 0».
      const multi = this.multiPicks[c.id];
      if (multi !== undefined && c.input.type === 'card') {
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
      // Multi-select payout (Public Plans): the LIVE gain of the picked count.
      const multi = this.multiPicks[c.id];
      const gain = c.multiSelect?.revealGain;
      if (multi !== undefined && gain !== undefined && this.isMultiCardChoice(c)) {
        return `+${multi.length * gain.amount}`;
      }
      // The merged tableau pick (Astra): +N cards return to hand.
      if (multi !== undefined && this.isMergedPickChoice(c) && multi.length > 0) {
        return `+${multi.length}`;
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
    /** The icon beside the impact — the step's card resource, the multi
     *  payout's resource (M€ for Public Plans), or the merged pick's cards. */
    chosenImpactIcon(c: ComposerChoice): string | undefined {
      if (c.cardResource !== undefined) {
        return c.cardResource;
      }
      const gain = c.multiSelect?.revealGain;
      if (this.multiPicks[c.id] !== undefined && gain !== undefined) {
        return gain.resource;
      }
      return this.multiPicks[c.id] !== undefined && this.isMergedPickChoice(c) ? 'cards' : undefined;
    },
    playerName(color: string): string {
      return displayNameForColor(this.playerView.players, color as Color);
    },
    /** The viewer's CURRENT production for a standard resource — the `current`
     *  base of a copied-production chip on a resource the base effects don't
     *  already carry (desktop `playerProduction` mirror). */
    playerProduction(res: string): number {
      const p = this.thisPlayer;
      switch (res) {
      case 'megacredits': return p.megacreditProduction;
      case 'steel': return p.steelProduction;
      case 'titanium': return p.titaniumProduction;
      case 'plants': return p.plantProduction;
      case 'energy': return p.energyProduction;
      case 'heat': return p.heatProduction;
      default: return 0;
      }
    },
    branchTitle(b: ActionPreviewBranch): string {
      const t = textOf(b.title);
      return t !== '' ? t : translateText('Play card');
    },
    branchReasonText(b: ActionPreviewBranch): string {
      return b.unavailableReason !== undefined ? textOf(b.unavailableReason) : translateText('Unavailable right now');
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    // ── input routing (foundation: SEMANTIC actions, no raw button names) ──
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
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
      this.onReviewPress(action);
    },
    onNav(dir: NavDirection): void {
      if (this.loading) {
        return;
      }
      // The embedded step owns SPATIAL navigation — it crosses owner groups by
      // geometry in split view, which a shared index walk cannot express.
      if (this.sub?.kind === 'playedTarget') {
        this.movePlayedTarget(dir);
        return;
      }
      if (this.sub !== undefined) {
        const len = this.sub.kind === 'payment' ? this.payEditableRows.length : this.listItems.length;
        if (dir === 'up' || dir === 'down') {
          this.sub.index = Math.min(len - 1, Math.max(0, this.sub.index + (dir === 'down' ? 1 : -1)));
          this.scrollFocused();
        } else if (this.sub.kind === 'payment') {
          this.adjustPayRow(this.sub.index, dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.rows.length === 0) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        // The walk ends at the «Разыграть» row only while the play can actually
        // run — the SAME commit-gate rule the action composer uses. A row whose
        // A would be refused is not a place the cursor may stop.
        // NAVIGATION MOVES THE CURSOR AND NOTHING ELSE. Walking onto a variant
        // used to SELECT it, which is why «where I am» and «what I chose» were
        // one thing on screen and the player could commit a result they had only
        // scrolled past. Selection is a press (A / a click), never a move.
        this.focusIdx = Math.min(this.navMaxIndex, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        this.scrollFocused();
        return;
      }
      // Left/right adjust a focused inline stepper.
      const row = this.focusedRow;
      if (row?.kind === 'step' && row.choice.kind === 'amount') {
        this.setAmount(row.choice, this.amountFor(row.choice.id) + (dir === 'left' ? -1 : 1));
      } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
        this.adjustFloaters(row.choice, dir === 'left' ? -1 : 1);
      }
    },
    // REVIEW state: A(primary) play/lead-to-choice, LT(prevTab) enter payment
    // lanes, X(inspect) zoom the card, B back, LB/RB(prev/nextSection) step, RT max.
    onReviewPress(action: ConsoleAction): void {
      if (this.loading) {
        // Only Cancel is honoured while the preview is still loading.
        if (action === 'back') {
          this.$emit('cancel');
        }
        return;
      }
      const row = this.focusedRow;
      switch (action) {
      case 'primary':
        this.primaryAction();
        return;
      case 'prevTab':
        // LT = EXPAND the payment block in place (secondary — never A). Only
        // where the editor is a real stage: a pure-AUTO M€ payment has nothing
        // to configure, and a single alternative is already being dialed on
        // this screen. Nothing about the block relocates.
        this.openPaymentEditor();
        return;
      case 'inspect':
        if (this.card !== undefined) {
          // "One physical card": the composer's mini card PHYSICALLY lifts
          // into fullscreen and returns into the SAME slot on close (its
          // slot is held empty meanwhile — the card is never in two places).
          openConsoleCardZoom([this.card], 0, undefined, undefined, {
            origin: {
              kind: 'physical',
              resolve: () => (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-composer__playcard') ?? null,
            },
          });
        }
        return;
      case 'back':
        this.$emit('cancel');
        return;
      case 'prevSection':
      case 'nextSection': {
        const step = action === 'prevSection' ? -1 : 1;
        // A focused amount/spend-heat stepper takes priority; otherwise LB/RB do
        // the global inline payment quick-adjust (no focus on payment needed).
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountFor(row.choice.id) + step);
        } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
          this.adjustFloaters(row.choice, step);
        } else {
          this.adjustQuickPayment(step);
        }
        return;
      }
      case 'nextTab':
        // RT = MAX on whatever LB/RB are driving, and by the SAME precedence a
        // focused stepper owns them: an amount row takes its own max, a
        // spend-heat row has no MAX at all, and otherwise it is the inline
        // payment quick-adjust — whose single lane has no editor to enter, so
        // this is the only «fill it up» it gets. Any other split here would let
        // RT move something the command bar does not advertise.
        if (row?.kind === 'step' && row.choice.kind === 'amount') {
          this.setAmount(row.choice, this.amountModel(row.choice).max);
        } else if (!(row?.kind === 'step' && row.choice.kind === 'spendHeat')) {
          this.adjustQuickPayment(1, true);
        }
        return;
      default:
        return;
      }
    },
    /**
     * The A button ALWAYS acts on the FOCUSED row (never a focus-independent
     * "smart play") — so what A does is exactly what the focused row + the
     * bottom bar say:
     *  - the «Разыграть» CTA → PLAY (when ready), else lead to the first
     *    unresolved choice;
     *  - a card/player/or/tabbed pick → open/re-open its picker (change);
     *  - a variant / amount / spend-heat row → advance toward the CTA.
     * A can therefore never be mistaken for "change" and silently play.
     */
    primaryAction(): void {
      const row = this.focusedRow;
      if (row === undefined) {
        return;
      }
      if (row.kind === 'cta') {
        if (this.ctaReady) {
          this.submit();
          return;
        }
        // Payment shortfall → expand the payment block (the actionable fix).
        // Only where the editor exists: a single-alt shortfall is fixed by the
        // bumpers on the block itself, so A stays silent rather than opening a
        // screen that would offer the same two buttons.
        if (this.primaryActionState.kind === 'blocked-payment' && this.payEditorAvailable) {
          this.openPaymentEditor();
          return;
        }
        // Otherwise lead the player to the first unresolved choice (+ open it).
        this.focusIdx = this.firstActionableIndex();
        const target = this.focusedRow;
        if (target !== undefined && target.kind !== 'cta') {
          this.openRow(target);
        }
        this.scrollFocused();
        return;
      }
      // A VARIANT: the press SELECTS, and that is the whole of it. The cursor
      // does not travel to the commit rail afterwards — «выбрать» and
      // «разыграть» must be two separate, deliberate presses, so one held
      // button or a fast double press can never do both.
      if (row.kind === 'variant') {
        this.selectVariant(row.pos);
        return;
      }
      if (this.focusedOpensPicker) {
        this.openRow(row);
        return;
      }
      // An amount / spend-heat row → proceed toward the play CTA.
      this.focusIdx = this.firstActionableIndex();
      this.scrollFocused();
    },
    /**
     * SELECT a variant — the ONE mutation both the pad and the mouse go through.
     * Idempotent: pressing A on the variant already selected re-affirms it
     * (never a toggle — a choice that can be un-made by repeating the press has
     * no stable state to commit).
     */
    selectVariant(pos: number): void {
      if (this.branches[pos]?.available !== true) {
        return;
      }
      this.setSelectedVariant(pos);
    },
    /**
     * The MOUSE half of the same grammar: a click on a variant SELECTS it (it
     * never plays, so a double click cannot commit), and the cursor follows the
     * pointer so the pad picks up where the mouse left off.
     */
    clickVariant(row: PlayRow & {kind: 'variant'}): void {
      if (this.loading || this.sub !== undefined) {
        return;
      }
      this.focusIdx = row.i;
      this.selectVariant(row.pos);
    },
    /** …and a click on the commit rail COMMITS — the second, separate press. */
    clickCta(): void {
      if (this.loading || this.sub !== undefined) {
        return;
      }
      this.focusIdx = this.ctaIndex;
      // The gate's own backstop for input that did not come through the cursor:
      // an unmet requirement redirects instead of running (never a silent no-op).
      const redirect = commitRedirectTarget(this.commitGate);
      if (redirect !== undefined) {
        this.focusIdx = redirect;
        this.scrollFocused();
        return;
      }
      this.primaryAction();
    },
    /** HOW a choice is served: inline sub / the hand pick / the tableau pick /
     *  an honest post-submit follow-up (the PURE classification). */
    choiceMode(c: ComposerChoice): PlayChoiceMode {
      return playChoiceMode(c, this.handNamesSet, this.playedNamesSet, this.cardName);
    },
    /**
     * THE CONTEXTUAL PREVIEW for one candidate — the ONE place this flow's
     * game knowledge lives, and it reads the SERVER's own step data rather
     * than re-deriving anything:
     *
     *  · `copyProductionBox[card]` — what a copy-production step would copy
     *    (Industrial Robots, Robotic Workforce, Cyberia Systems);
     *  · the step's resource delta over the card's live count — what an
     *    add/remove-resource step would do to the target (Predators and its
     *    whole family), shown as the honest `current → resulting`.
     *
     * A card the console has no data for yields no sections; the rail then
     * shows the candidate's identity alone rather than inventing a claim.
     * NOTHING here keys on a card NAME — a new card producing either shape is
     * covered the day the server sends it.
     */
    playedTargetPreview(choice: ComposerChoice, name: CardName): ReadonlyArray<PlayedTargetPreviewSection> {
      const step = choice.scope === 'step' ? this.selectedBranch?.steps[choice.index] : undefined;
      return playedTargetPreviewFor(step, choice.input as SelectCardModel, name, this.selectedBranch?.effects, this.selectedBranch?.vpBox);
    },
    /**
     * The resource badge a candidate face earns — EXPLICIT, and only when the
     * card's resource is what the step moves.
     *
     * The condition is the same one that produces the `current → resulting`
     * section above, deliberately: a badge that appears without that reading, or
     * a reading without that badge, would be two different claims about whether
     * the resource matters here. For a copy-production step (Industrial Robots)
     * there is no resource delta, so there is no badge — which is how the gold
     * «0» on every building card disappears without a card-specific rule.
     */
    playedTargetResourceContext(c: ComposerChoice, card: CardModel): PlayedTargetResourceContext | undefined {
      return playedTargetResourceFor(c.amount, c.cardResource, card);
    },
    /** A LATER card step of a merge branch — collapsed into the first one's
     *  multi pick (never its own row, never a follow-up note). */
    isCollapsedMergeStep(c: ComposerChoice): boolean {
      return this.mergeBranchActive && c.scope === 'step' &&
        c.input.type === 'card' && c.index !== this.firstMergeCardStepIndex;
    },
    /** The choice hosts the merge branch's ONE multi tableau pick. */
    isMergedPickChoice(c: ComposerChoice): boolean {
      return this.mergeBranchActive && c.scope === 'step' &&
        c.input.type === 'card' && c.index === this.firstMergeCardStepIndex;
    },
    /** The merged pick's ONE prompt (the branch's `mergeCardSteps.title`) —
     *  '' when this choice is not the merge host / the branch declares none. */
    mergedPickTitle(c: ComposerChoice): string {
      if (!this.isMergedPickChoice(c)) {
        return '';
      }
      const t = this.selectedBranch?.mergeCardSteps?.title;
      return t !== undefined ? textOf(t) : '';
    },
    /** Open the pick surface a decision row needs (a list / tabbed picker /
     *  the hand or tableau pick). An amount / spend-heat row adjusts inline,
     *  so opening it is a no-op. */
    openRow(row: PlayRow): void {
      if (row.kind === 'repeat') {
        this.openRepeatPick(row.choice);
      } else if (row.kind === 'step' && row.choice.input.type === 'deltaEspionage') {
        this.openEspionagePick(row.choice);
      } else if (row.kind === 'step' && row.choice.id === 'esp-owner-choice') {
        // The owner's own landing reward is chosen on the HYDRONETWORK — the
        // same seamless descent the target pick makes, into the track's ONE
        // stage-reward surface (never a bare option list about a stage the
        // player cannot see).
        this.openEspOwnerRewardPick(row.choice);
      } else if (row.kind === 'step' && this.choiceMode(row.choice) === 'handPick') {
        this.openHandPick(row.choice);
      } else if (row.kind === 'step' && this.choiceMode(row.choice) === 'playedTarget') {
        this.openPlayedTargetStep(row.choice);
      } else if (row.kind === 'step' && (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or')) {
        this.sub = {kind: 'list', choiceId: row.choice.id, index: 0};
      } else if (row.kind === 'tabbed') {
        this.sub = {kind: 'tabbed', stepIndex: row.stepIndex, index: 0};
      }
    },
    /**
     * Hand ProjectInspection's repeat pick to the ДЕЙСТВИЯ КАРТ surface in
     * repeat mode: the player chooses ONE already-used action (A = «Выбрать»)
     * and composes it there; the result (chosen action + composed responses)
     * lands back here and rides the play submit as `repeat`. The composer stays
     * MOUNTED (v-show hidden) so this callback survives (mirrors the hand pick).
     */
    /**
     * DESCEND into the Hydronetwork workspace's espionage target-selection
     * mode (the DP08 reward-pick bridge idiom): the composer waits underneath
     * with its captures intact, the section presents every candidate off the
     * SERVER's projection, and the resolve captures the pick as the step's
     * wire response. B returns with the previous pick untouched.
     */
    /**
     * DESCEND into the Hydronetwork's stage-reward surface for the OWNER'S OWN
     * landing choice (the DP08 pick reused in its advance-landing shape): the
     * destination cell focused with the forward ghost, the stage's honest
     * gains + options through the one shared block, A→choice→A resolves the
     * draft back here as the ordinary or-capture. B keeps the previous answer.
     */
    openEspOwnerRewardPick(c: ComposerChoice): void {
      const proj = this.espionageProjectionRaw;
      if (proj === undefined || !proj.owner.legal || proj.owner.reward.kind !== 'choice') {
        return;
      }
      const prior = this.captured[ESP_OWNER_CHOICE_INDEX] as {type?: string, index?: number} | undefined;
      enterDeltaRewardPick({
        source: this.cardName,
        claimable: [proj.owner.toPosition],
        advanceFrom: proj.owner.fromPosition,
        prior: prior?.type === 'or' && typeof prior.index === 'number' ?
          {position: proj.owner.toPosition, rewardChoice: prior.index} : undefined,
      }, (draft) => {
        if (draft.rewardChoice === undefined) {
          return; // an unanswered choice cannot resolve (the scene's own gate)
        }
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        this.picks[cur.id] = String(draft.rewardChoice);
        this.captureFor(cur, {type: 'or', index: draft.rewardChoice, response: {type: 'option'}});
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    openEspionagePick(c: ComposerChoice): void {
      const projection = (c.input as DeltaEspionageInputModel).projection;
      if (!projection.hasLegalTarget) {
        // The system outcome «Нет доступной цели» — an empty selector must
        // never open (there is nothing to choose); the row already reads it.
        return;
      }
      enterDeltaEspionagePick({
        source: this.cardName,
        projection,
        prior: this.espionageCapture?.target,
      }, (draft) => {
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        this.captureFor(cur, deltaEspionageStepResponse(projection, draft.target, this.espionageOwnerAnswer));
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
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
        source: {kicker: 'Play card', card: this.cardName},
        prior: this.repeatResult !== undefined ?
          {chosenCard: this.repeatResult.chosenCard, nodeIndex: this.repeatResult.nodeIndex} : undefined,
      }, (result) => {
        this.repeatResult = result;
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    /**
     * Hand a TABLEAU card pick (single / merged multi / deduped sequential) to
     * the «Разыграно» view's pick mode: the candidates physically lift off
     * their real table slots (face-down events off the pile, flipping open),
     * the player picks on the real cards, the cards fly home and the capture
     * lands back here. A re-open pre-seeds the previous selection.
     */
    /**
     * DESCEND into the embedded played-target step. It replaces the review
     * content in place — the source card keeps its anchor to the left, the
     * header and the bars never move, and every capture (payment above all)
     * simply stays where it is because nothing is unmounted but the review
     * groups. Re-entering restores the previously chosen target: its owner,
     * its group and the cursor on the card itself, already target-locked.
     */
    openPlayedTargetStep(c: ComposerChoice): void {
      // Measure the band ONCE, before the step is visible, and measure it where
      // the layout is STRETCHED rather than content-sized — see
      // `playedTargetHeight`. The width comes from the work column (`flex: 1`
      // with a max cap, so it is stretched too); the height comes from the row
      // above it, which is the only box here whose size the cards cannot move.
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const zone = root?.querySelector<HTMLElement>('.con-composer__playright');
      if (zone !== null && zone !== undefined) {
        this.playedTargetWidth = zone.clientWidth;
      }
      const band = root?.querySelector<HTMLElement>('.con-composer__playmain');
      if (band !== null && band !== undefined) {
        this.playedTargetHeight = band.clientHeight;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      // Re-entry restores the previous answer: a single target puts the cursor
      // ON that card, a multi ask brings its whole accumulation back (pruned of
      // anything that left the table since).
      const multi = this.playedTargetSelectionFor(c);
      const picked = multi.mode === 'multi' ?
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
    /**
     * The step's ASK — read from the server's own prompt, never from a card.
     * A branch that declares `mergeCardSteps` is ONE up-to-N question whose
     * slots the composer collapses into this choice; everything else is a
     * single «point at one card».
     */
    playedTargetSelectionFor(c: ComposerChoice): PlayedTargetSelection {
      if (!this.isMergedPickChoice(c)) {
        return {mode: 'single'};
      }
      const merge = this.selectedBranch?.mergeCardSteps;
      return {
        mode: 'multi',
        min: merge?.min ?? 0,
        max: Math.max(1, this.mergeCardStepCount),
        picked: this.sub?.kind === 'playedTarget' && this.sub.choiceId === c.id ?
          this.sub.picked :
          ((this.multiPicks[c.id] ?? []) as ReadonlyArray<string>),
      };
    },

    /** A in a MULTI ask toggles instead of choosing — the cap is stated, never
     *  silently enforced (the contract line says «снимите выбор с другой»). */
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
    /** RT — submit a MULTI ask. The response is the ONE merged
     *  `{type:'card', cards:[…]}` the server's `mergeCardSteps` expects. */
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
      this.multiPicks = {...this.multiPicks, [choice.id]: cards};
      this.picks = {...this.picks, [choice.id]: String(cards.length)};
      this.captureFor(choice, {type: 'card', cards});
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
      this.scrollFocused();
    },
    /**
     * Move the cursor inside the step — BY WHERE THE CARDS ARE.
     *
     * The step's own measured cells decide, so Down goes to the card that is
     * visually below whether that is the next row of one grid, the next
     * category block, or the other owner's group across the gap. The index walk
     * survives only as the answer for a step that has not measured yet (the
     * very first frame, and unit tests) — it assumes ONE uniform grid, which is
     * exactly the assumption that made Up/Down dead while two candidates sat
     * one above the other in two category blocks.
     */
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
    /** Keep the cursored candidate inside the STEP's own candidate viewport.
     *  The step owns that scroller — the contract and the status rail live
     *  outside it, so a cursor move can never carry the rail off screen. */
    scrollPlayedTargetFocused(): void {
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** LB/RB — the owner axis, tabbed mode only (in split the groups are both
     *  on screen and the d-pad crosses between them spatially). */
    cyclePlayedTargetOwner(delta: number): void {
      if (this.sub?.kind !== 'playedTarget' || this.playedTargetLayout.mode !== 'tabs') {
        return;
      }
      const owners = this.playedTargetModel?.owners ?? [];
      const ownerId = stepPlayedTargetOwner(this.sub.focus.ownerId, delta, owners);
      if (ownerId === this.sub.focus.ownerId) {
        return;
      }
      // Restore this owner's last cursor — a tab the player returns to should
      // be where they left it, not reset to its first card.
      const remembered = this.playedTargetOwnerFocus[ownerId] ?? 0;
      this.playedTargetOwnerFocus = {...this.playedTargetOwnerFocus, [this.sub.focus.ownerId]: this.sub.focus.index};
      this.sub = {...this.sub, focus: reseatPlayedTargetFocus({ownerId, index: remembered}, owners) ?? this.sub.focus};
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
      const result = playedTargetResultOf(candidate, owners, this.playedTargetVersion);
      this.playedTargetResults = {...this.playedTargetResults, [choice.id]: result};
      // The capture the batch submits is the same shape every card pick uses —
      // the rich result is presentation + future-animation context, never a
      // second source of truth for what was answered.
      this.captureFor(choice, {type: 'card', cards: [candidate.cardName]});
      this.picks = {...this.picks, [choice.id]: candidate.cardName};
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
      this.scrollFocused();
    },
    /** The summary of an answered played-target choice (undefined = unanswered
     *  or gone stale — a target whose card left the table is never shown as
     *  chosen, and never submitted). */
    playedTargetResult(c: ComposerChoice): PlayedTargetResult | undefined {
      const result = this.playedTargetResults[c.id];
      const owners = this.playedTargetModel?.owners ?? [];
      return playedTargetResultLive(result, owners, this.playedTargetVersion) ? result : undefined;
    },
    /** The answered target as a ONE-ELEMENT list — a template alias that lets
     *  the summary bind it once instead of calling the lookup six times (and
     *  keeps it non-nullable for the type checker). */
    targetSummaryOf(c: ComposerChoice): ReadonlyArray<PlayedTargetResult> {
      const result = this.playedTargetResult(c);
      return result === undefined ? [] : [result];
    },
    /**
     * The summary's compact impact chips — the SAME derivation the focus rail
     * uses, capped shorter.
     *
     * The division of labour is deliberate and is why nothing is said twice:
     * the RESULT strip above carries the full authoritative `current →
     * resulting` (the copied production folds into it through the branch's own
     * effects), and this row carries identity, origin and the one fact that
     * links the two — «this card is why that number moved». Comparison is over;
     * the summary is not a smaller rail.
     */
    targetSummaryImpacts(c: ComposerChoice): ReadonlyArray<PlayedTargetQuickImpact> {
      const result = this.playedTargetResult(c);
      if (result === undefined) {
        return [];
      }
      return playedTargetQuickImpacts(result.preview).slice(0, PLAYED_TARGET_SUMMARY_IMPACT_CAP);
    },
    // (`openTableauPick` is gone. Every played-card pick this flow has — the
    // single «point at one card» ask AND the server's merged up-to-N ask —
    // is hosted by the EMBEDDED played-target step, so the old lift-out-of-
    // the-tableau surface is unreachable from card play. The «Разыграно»
    // view keeps it for the blue-action composer until that flow migrates,
    // after which it becomes a browsing surface only.)
    /** The ActionPreviewStep behind a branch-step choice (dedupe metadata). */
    previewStepOf(c: ComposerChoice): {dedupeFromSteps?: ReadonlyArray<number>} | undefined {
      if (c.scope !== 'step') {
        return undefined;
      }
      const s = this.selectedBranch?.steps[c.index];
      return s !== undefined && s.kind === 'input' ? s : undefined;
    },
    capturedCardNameAt(stepIndex: number): CardName | undefined {
      const resp = this.captured[stepIndex] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
      return resp?.type === 'card' ? resp.cards?.[0] : undefined;
    },
    /** Re-picking an EARLIER step to a card a LATER deduped step already
     *  holds clears that later pick (the same card can never be chosen twice
     *  — the desktop captureStep mirror). */
    clearDedupeConflicts(changed: ComposerChoice, name: CardName): void {
      const b = this.selectedBranch;
      if (b === undefined || changed.scope !== 'step') {
        return;
      }
      b.steps.forEach((s, i) => {
        if (s.kind !== 'input' || !(s.dedupeFromSteps ?? []).includes(changed.index)) {
          return;
        }
        if (this.capturedCardNameAt(i) === name) {
          delete this.captured[i];
          const later = this.allChoices.find((x) => x.scope === 'step' && x.index === i);
          if (later !== undefined) {
            delete this.picks[later.id];
          }
        }
      });
    },
    /**
     * Hand a hand-card pick (single OR multi-select — Public Plans) to the HAND
     * SECTION's premium pick mode (consoleHandPick bridge): the shell hides
     * this composer (v-show — every capture survives), the player picks on the
     * real cards, and the result lands back here as the step's capture. A
     * re-open (A = «Изменить») pre-seeds the previous selection.
     */
    openHandPick(c: ComposerChoice): void {
      const model = c.input as SelectCardModel;
      const reasons: Record<string, string> = {};
      for (const d of model.disabledCards ?? []) {
        reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
      }
      const multi = model.max > 1;
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
      }, (cards) => {
        // Re-locate the choice by id — the preview may have refreshed under
        // the pick (a poll landed) and the captured index must stay honest.
        const cur = this.allChoices.find((x) => x.id === c.id) ?? c;
        if (multi) {
          this.multiPicks[cur.id] = [...cards];
          this.picks[cur.id] = String(cards.length);
          this.captureFor(cur, {type: 'card', cards: [...cards]});
        } else if (cards.length > 0) {
          this.picks[cur.id] = cards[0];
          this.captureFor(cur, {type: 'card', cards: [cards[0]]});
        }
        this.focusIdx = this.firstActionableIndex();
        this.scrollFocused();
      });
    },
    // SUB state (pick list / payment lanes): A(primary) pick/close, X(inspect)
    // zoom the list card, B back, LB/RB(prev/nextSection) adjust lane, RT max.
    onSubPress(action: ConsoleAction): void {
      const sub = this.sub;
      if (sub === undefined) {
        return;
      }
      switch (action) {
      case 'primary':
        if (sub.kind === 'playedTarget') {
          // SINGLE: A chooses and the step closes. MULTI: A toggles — the
          // merged ask is submitted with RT, so a stray A can never send a
          // half-built selection.
          if (this.playedTargetSelection.mode === 'multi') {
            this.togglePlayedTarget();
          } else {
            this.confirmPlayedTarget();
          }
          return;
        }
        if (sub.kind === 'payment') {
          // «Готово» — fold the editor back into the compact summary. The mix
          // is KEPT (payCounts is the single source of truth for both modes).
          if (this.paymentReady) {
            this.closePaymentEditor();
          }
          return;
        }
        this.pickListItem(sub.index);
        return;
      case 'inspect':
        // X lifts the FOCUSED candidate through the one fullscreen viewer; the
        // step stays mounted underneath, so closing it returns to the same
        // owner, the same slot and the same rail reading.
        if (sub.kind === 'playedTarget') {
          this.inspectPlayedTarget();
          return;
        }
        if (sub.kind !== 'payment') {
          this.inspectListItem(sub.index);
        }
        return;
      case 'back':
        // B is ONE logical level: back to the play step, with the payment and
        // every other capture exactly as they were.
        this.sub = undefined;
        return;
      case 'prevTab':
        // LT toggles the density back — the same button that expanded it.
        if (sub.kind === 'payment') {
          this.closePaymentEditor();
        }
        return;
      case 'prevSection':
      case 'nextSection':
        // LB/RB own the OWNER axis in the embedded step's tabbed mode (in
        // split view both groups are on screen and the d-pad crosses between
        // them spatially, so the bumpers would only duplicate it).
        if (sub.kind === 'playedTarget') {
          this.cyclePlayedTargetOwner(action === 'prevSection' ? -1 : 1);
          return;
        }
        if (sub.kind === 'payment') {
          this.adjustPayRow(sub.index, action === 'prevSection' ? -1 : 1);
        }
        return;
      case 'nextTab':
        // RT — submit the merged up-to-N ask (the same button the hand's
        // multi pick and the patent sale confirm with).
        if (sub.kind === 'playedTarget') {
          this.confirmPlayedTargetPicks();
          return;
        }
        if (sub.kind === 'payment') {
          this.adjustPayRow(sub.index, 0, true);
        }
        return;
      default:
        return;
      }
    },
    /**
     * LT — EXPAND the payment block in place: the same rows in the same place,
     * now with a cursor. Only reachable when there is MORE than one alternative
     * source (a single one is dialed inline — the editor would be this very
     * screen again), so the cursor opens on the first editable row.
     */
    openPaymentEditor(): void {
      if (!this.payEditorAvailable) {
        return;
      }
      this.sub = {kind: 'payment', index: 0};
    },
    /**
     * Fold the editor back to the compact summary, keeping the chosen mix.
     * Deliberately does NOT scroll: the column's content is identical in both
     * densities, so the view is already exactly where the player left it —
     * calling `scrollFocused` here nudged the scroll offset on a tall (4K)
     * composer and moved the CTA, which is precisely what this whole rework
     * removes (caught by tests/e2e/console-payment-panel.spec.ts at 4K).
     */
    closePaymentEditor(): void {
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
    },
    /** Select a variant (from navigation) — resets the branch-specific captures
     *  and re-seeds defaults. Focus is owned by the caller (nav), not changed here. */
    setSelectedVariant(pos: number): void {
      const branch = this.branches[pos];
      if (branch === undefined || !branch.available || this.selectedPos === pos) {
        return;
      }
      this.selectedPos = pos;
      // Branch-specific captures reset (desktop selectBranch parity).
      this.captured = {};
      this.capturedOption = undefined;
      this.picks = {};
      this.multiPicks = {};
      this.amounts = {};
      this.floaters = {};
      this.repeatResult = undefined;
      this.seedChoiceDefaults();
    },
    pickListItem(index: number): void {
      const sub = this.sub;
      const item = this.listItems[index];
      if (sub === undefined || item === undefined || item.disabled) {
        return;
      }
      // TABBED target (Virus) — captures the top-level or-response into its step.
      if (sub.kind === 'tabbed') {
        const ts = this.tabbedSteps.find((t) => t.index === sub.stepIndex);
        const target = ts !== undefined ? this.tabbedTargets(ts.step).find((t) => t.key === item.key) : undefined;
        if (target === undefined) {
          return;
        }
        this.picks['tabbed#' + sub.stepIndex] = target.key;
        this.captured[sub.stepIndex] = target.response;
        this.sub = undefined;
        this.focusIdx = this.firstActionableIndex();
        return;
      }
      const c = this.subChoice;
      if (c === undefined) {
        return;
      }
      // NESTED-input or option target (Comet for Venus) → nest the response.
      if (sub.kind === 'orNested') {
        const nested = sub.item.nested;
        let nestedResp: unknown;
        if (nested?.type === 'player' && item.color !== undefined) {
          nestedResp = {type: 'player', player: item.color};
        } else if (nested?.type === 'card' && item.card !== undefined) {
          nestedResp = {type: 'card', cards: [item.card.name]};
        } else {
          return;
        }
        this.picks[c.id] = String(sub.item.optionIndex);
        this.captureFor(c, orItemResponse(sub.item, nestedResp));
        this.sub = undefined;
        this.focusIdx = this.firstActionableIndex();
        return;
      }
      // sub.kind === 'list'
      if (c.input.type === 'card' && item.card !== undefined) {
        this.picks[c.id] = item.card.name;
        this.captureFor(c, {type: 'card', cards: [item.card.name]});
      } else if (c.input.type === 'player' && item.color !== undefined) {
        this.picks[c.id] = item.color;
        this.captureFor(c, {type: 'player', player: item.color});
      } else if (c.input.type === 'or') {
        const it = item.orItem;
        if (it === undefined) {
          return;
        }
        // A NESTED-input option opens its own target sub-pick (don't submit yet).
        if (it.nested !== undefined) {
          this.sub = {kind: 'orNested', choiceId: c.id, item: it, index: 0};
          return;
        }
        this.picks[c.id] = String(it.optionIndex);
        this.captureFor(c, orItemResponse(it));
      } else {
        return;
      }
      this.sub = undefined;
      this.focusIdx = this.firstActionableIndex();
    },
    /**
     * X on the embedded step — the focused candidate rises through the ONE
     * existing fullscreen viewer, PHYSICALLY out of its own slot in the owner
     * group (a `data-zoom-slot` origin, the same contract the hand and the
     * blue-action hero use). The step stays mounted underneath, so closing the
     * viewer returns to the same owner, the same card and the same rail.
     *
     * …and for the SELF-TARGET the physical object is the hero card standing to
     * the left, not the proxy that points at it — see `playedTargetZoomOrigin`.
     * Scoped to this component's own root, never `document`: a second, hidden
     * composer would shadow the live step with a zero-rect slot.
     */
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
        origin: playedTargetZoomOrigin(
          // The REF, never `$el` — see the note on the root element.
          () => this.$refs.rootEl as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          playedTargetSourceCardName(owners)),
      });
    },
    inspectListItem(index: number): void {
      const item = this.listItems[index];
      if (item?.card === undefined) {
        return;
      }
      const cards = this.listItems.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
      // The target options render as TEXT rows (not card tiles), so the
      // fullscreen is a TEXTUAL inspector — no fake lift out of a text line.
      openConsoleCardZoom(cards, Math.max(0, cards.findIndex((cd) => cd.name === item.card?.name)), undefined, undefined, {origin: {kind: 'textual'}});
    },
    /**
     * Dial ONE payment source — the single mutation both densities go through
     * (the compact quick-adjust below delegates here), so the mix a player
     * builds in the editor and the one the bumpers build on the main screen are
     * literally the same state. The value comes from the pure `dialLaneCount`,
     * which enforces the AGGREGATE anti-overpay limit here rather than only in
     * the row's paint — a fast repeat can fire twice between two renders, and
     * `RT МАКС.` must read what the other sources already pay.
     */
    adjustPayRow(idx: number, step: number, toMax = false): void {
      const row = this.payEditableRows[idx];
      const lane = row !== undefined ? this.payLanes.find((l) => l.unit === row.unit) : undefined;
      if (lane === undefined) {
        return;
      }
      const cur = this.payCount(lane.unit);
      const next = dialLaneCount(this.cost, lane, this.payLanes, this.payCounts, toMax ? 'max' : step);
      if (next === cur) {
        return;
      }
      this.payCounts = {...this.payCounts, [lane.unit]: next};
      this.payFlashNonce += 1;
    },
    /** The compact quick-adjust: LB (−1) / RB (+1) / RT (MAX) on the SINGLE alt
     *  source; M€ auto-rebalances. Guarded by the row's own canDecrease/
     *  canIncrease so a dead press is a no-op (never an invalid mix). */
    adjustQuickPayment(step: number, toMax = false): void {
      const row = this.quickAdjustChip;
      if (row === undefined) {
        return;
      }
      if ((step > 0 && !row.canIncrease) || (step < 0 && !row.canDecrease)) {
        return;
      }
      this.adjustPayRow(this.payEditableRows.findIndex((r) => r.unit === row.unit), step, toMax);
    },
    submit(): void {
      const b = this.selectedBranch;
      if (b === undefined || !this.canConfirm || this.submitting) {
        return;
      }
      this.submitting = true;
      const payment: Payment = paymentFromCounts(this.cost, this.payLanes, this.payCounts, this.megacreditsOnHand);
      // The espionage response is ASSEMBLED at the commit: the captured target
      // plus the owner's landing answer folded from the synthetic rows — the
      // one wire entry; the synthetic rows themselves never reach the batch.
      let captured = this.captured;
      const esp = this.espionageChoice;
      if (esp !== undefined) {
        const projection = (esp.input as DeltaEspionageInputModel).projection;
        captured = {...captured, [esp.index]: deltaEspionageStepResponse(projection, this.espionageCapture?.target, this.espionageOwnerAnswer)};
      }
      this.$emit('confirm', {
        branchIndex: b.index,
        preResponses: this.preview !== undefined ? orderedPreResponses(this.preview, this.capturedPre) : [],
        optionResponse: this.capturedOption,
        stepResponses: orderedStepResponses(b, captured),
        payment,
        // The IMMEDIATE resource gains of this play (stock / production /
        // card-resources with their pre-selected hosts), extracted from the
        // server-computed preview — the hero scene's reward beat carries
        // them from the landed card onto the left panel.
        rewards: extractPlayRewards({
          cardName: this.cardName,
          effects: b.effects,
          steps: b.steps,
          stepResponses: this.captured,
        }),
        // HOW MANY CARDS this play PROMISES — the same structural read every
        // other workspace uses (a `cards` gain in the chosen branch). A HINT
        // for the arrival's size, never a gate: the workspace claims its
        // follow-up either way, because a triggered effect (Point Luna's Earth
        // tag) draws cards no preview can advertise.
        draws: (b.effects ?? []).reduce((n, e) =>
          (e.direction === 'gain' && e.icon === 'cards' ? n + Math.max(1, Math.round(e.amount)) : n), 0),
        // ProjectInspection: the chosen already-used action + its composed
        // responses (+ nodeIndex / reveal for the in-frame reveal handoff),
        // appended after the play as `[play, {card}, ...composed]`.
        // NEVER for the espionage owner's repeat — that one rides INSIDE the
        // espionage response (`ownerAnswer.repeatResponses`), consumed by the
        // server's own reward resolution at the owner's landing.
        repeat: esp !== undefined ? undefined : this.repeatResult,
        // CORPORATE ESPIONAGE: the shell's execution choreography (the hydro
        // re-entry, the two-actor marker plan) reads the SAME projection +
        // picks the batch carries — one derivation, promise = presentation.
        espionage: esp !== undefined ? {
          projection: (esp.input as DeltaEspionageInputModel).projection,
          target: this.espionageCapture?.target,
          ownerAnswer: this.espionageOwnerAnswer,
        } : undefined,
      });
    },
    scrollFocused(): void {
      void this.$nextTick(() => {
        // The payment editor's cursor lives INSIDE the shared panel (a child
        // component), so it is located by its rendered focus class instead of
        // a template ref — the panel stays purely presentational.
        if (this.payExpanded) {
          const row = (this.$refs.rootEl as HTMLElement | undefined)?.querySelector('.con-payrow--focused');
          (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(row);
          return;
        }
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
  },
});
</script>
