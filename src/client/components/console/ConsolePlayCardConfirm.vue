<template>
  <div ref="rootEl" class="con-composer con-composer--play"
       :class="{
         'con-composer--submitting': submitting,
         'con-composer--embed': embedded,
         'con-ws': !embedded,
         'con-composer--ptsel': playedTargetStepOpen,
         'con-composer--landing': landingUp,
         'con-composer--restored': restored,
       }"
       role="dialog" :aria-label="titleText"
       :data-cursor-pending="lateCursor.pending ? '' : undefined"
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
          <Card v-if="heroCard !== undefined" :card="heroCard" :key="heroCard.name" />
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
        <div class="con-composer__playright" ref="playRight" :style="sheetStyle">
          <!-- (No summary line above the work surface. It carried the price and
               a «МОЖНО РАЗЫГРАТЬ» badge — both already stated by the blocks
               below it: the payment head owns the price (after discounts), and
               an active commit rail owns «can be played». Its real cost was
               structural: a fixed strip at the top of the column pinned the
               whole scene to the ceiling, so a short card left a well of empty
               band under the CTA while the hero card sat centred beside it.) -->
          <!-- THE SHEET (P81 · DJ — the action setup's grammar, DC / DF, carried over): a sheet AS TALL AS THE CARD
               beside it (its floor is the hero face's MEASURED height, `--con-setup-face-h`), in three zones that mirror
               the card's anatomy — the RESULT at the top (the title's line), the body in the middle (the art's zone: the
               table's answer, the next steps, the decisions, the card's roles — centred when short, the ONLY part that
               scrolls), the PAYMENT and the COMMIT docked on the bottom line (the mechanics box). Its box stands still
               while the player decides: content below the floor never grows it (PL-1228).
               data-forecast-browse: the WORK COLUMN the R3 «Эффекты» layer parks in place (consoleForecastFocusMotion) —
               every capture, the payment and the cursor survive underneath by construction. -->
          <div class="con-composer__playsheet" ref="sheet" data-forecast-browse
               :class="{'con-composer__playsheet--review': reviewShown}" :data-sheet-expanded="sheetExpanded ? '' : undefined">
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
                                     :lockedCard="playedTargetLockedCard"
                                     :decline="subDecline" />

            <!-- ── THE VENUS BONUS'S INNER STEP (P89 · EM): a level of this workspace in the review's place — the
                 30 % wild's OR, its card, the 2 × 3 standard grid; its own confirm comes back to the review. ── -->
            <ConsoleVenusBonusStep v-else-if="sub !== undefined && sub.kind === 'venus' && venusSubChoice !== undefined"
                                   ref="venusStep"
                                   :viewer="{name: playerView.thisPlayer.name, color: playerView.thisPlayer.color}"
                                   :input="venusSubChoice.input" :parts="venusPartsOf(venusSubChoice)"
                                   :focus="sub.focus" :stock="venusStock" />

            <!-- ── SUB-STATE: a PREMIUM pick list (card / player / or w/ metadata
                 chips / nested-input target / tabbed target). ─────────── -->
            <template v-else-if="sub !== undefined && (sub.kind === 'list' || sub.kind === 'orNested' || sub.kind === 'tabbed')">
              <!-- THE QUESTION LINE: the ask, and an optional choice's DECLINE plate — the refusal is a button (RT),
                   never one more row among the answers (2026-10-13). -->
              <div class="con-composer__sub-head" data-unfold-item>
                <div class="con-composer__sub-title">{{ subTitle }}</div>
                <ConsoleDeclinePlate v-if="subDecline !== undefined" class="con-composer__sub-decline"
                                     :label="subDecline.label" :forgone="subDecline.forgone" />
              </div>
              <!-- THE PICK LIST — the variant grammar's LIST layout (`ConsoleVariantChoice`, TR51): the cursor a cold lift,
                   the answer the ONE seal, a refused row its reason on its own plate; a door (a nested pick) its ›. -->
              <ConsoleVariantChoice class="con-composer__sublist" layout="list" :exclusive="false"
                                    :options="listOptions" :label="subTitle">
                <template #body="{index}">
                  <template v-for="item in [listItems[index]]" :key="item.key">
                    <span v-if="item.tab !== undefined" class="con-composer__opt-tab" :class="'con-composer__opt-tab--' + item.tab">{{ $t(item.tab === 'animal' ? 'Animals' : 'Plants') }}</span>
                    <!-- WHOSE card this is — an attribute of the name, a quiet apposition. -->
                    <span v-if="item.owner !== undefined" class="con-composer__opt-owner">{{ item.owner }}</span>
                    <span v-for="(eff, k) in (item.chips ?? [])" :key="'ch' + k" class="con-composer__opt-chip"><ActionEffectChip :effect="eff" /></span>
                    <span v-if="item.impact" class="con-composer__opt-impact">
                      <i v-if="item.impactIcon" class="con-composer__opt-impact-icon" :class="iconClass(item.impactIcon)" aria-hidden="true"></i>{{ item.impact }}
                    </span>
                    <span v-if="item.meta !== ''" class="con-composer__opt-meta">{{ item.meta }}</span>
                    <!-- The engine's own caution, in words — on the row itself, before any press. -->
                    <span v-for="(w, k) in (item.warnings ?? [])" :key="'wn' + k" class="con-composer__opt-warn">⚠ {{ $t(w) }}</span>
                    <!-- «Это вы» on a PLAYER row; the same caution on a CARD row the viewer owns (Virus). -->
                    <span v-if="item.selfHarm" class="con-composer__opt-warn">⚠ {{ $t('This is you') }}</span>
                    <span v-if="item.selfCard" class="con-composer__opt-warn">⚠ {{ $t('This is your card') }}</span>
                  </template>
                </template>
              </ConsoleVariantChoice>
            </template>

            <!-- ── REVIEW (and the EXPANDED payment editor, which is the SAME
                 screen with the payment block promoted — never a separate
                 form: the card, the header, the result and the CTA all keep
                 their place, only emphasis moves). ──────────────────────── -->
            <template v-else>
              <!-- THE BODY'S BLOCK (P81 · DJ): the result and everything under it, ONE in-flow block — centred in the
                   body for the opening composition, PINNED where it stands by the player's first press (the settled
                   column): a chosen variant's section grows it downward, nothing re-centres it under the cursor. -->
              <div class="con-composer__playblock" ref="playBlock">
              <!-- RESULT HERO: the decision-carrying data (what you get) is the
                   dominant, glance-readable block — not the CTA. While the
                   payment editor is open it steps back (dimmed, NOT unmounted,
                   so the column's geometry is untouched). -->
              <div class="con-composer__resulthero"
                   data-unfold-item
                   :class="{'con-composer__resulthero--muted': payExpanded}">
              <!-- RESULT: variants (selectable) — their heading on top; a plain result's heading stands over its row (below). -->
              <div v-if="hasVariants" class="con-composer__sub-title con-composer__sub-title--result">{{ $t(resultHeading) }}</div>
              <!-- THE ИЛИ CHOICE — a COMPARISON, so the options stand side by
                   side while the width allows it and fall into a column when it
                   does not (intrinsic: `flex-basis: auto` = each card's own
                   content). Three states, three different things on screen:
                   the CURSOR (cyan ring, no mark), the CHOICE (green plate +
                   ✓, and it stays while the cursor walks away) and the COMMIT
                   (the rail below, unreachable until the choice is made). -->
              <!-- `variantsEl` is MEASURED (the options' offsetTop) to learn the
                   group's live AXIS — side by side (←→ switch, ↑↓ leave) or a
                   column (↑↓ walk, ←→ inert) — never a JS copy of the
                   container query's threshold; re-measured on resize. -->
              <!-- THE KEYS BESIDE THE CHOICE (TR43 — the production every branch states first): ONCE, above the row, so each
                   option tile says only what differs (`sharedLeadingEffects`). -->
              <div v-if="hasVariants && sharedVariantEffects.length > 0" class="con-composer__hero-chips con-composer__result-chips" data-variants-shared>
                <!-- A shared head that is all PRICE (TR54's «also pay 3 energy») says so — the action composer's own word
                     for its price (PL-074), never a bare «5 → 2» the eye has to decode. -->
                <span v-if="sharedVariantIsPrice" class="con-composer__shared-label" data-variants-price>{{ $t('Will be spent') }}</span>
                <ActionEffectChip v-for="(eff, k) in sharedVariantEffects" :key="k" :effect="eff" :basisInStrip="basisReadByStrip(eff)" />
              </div>
              <!-- PL-196: the shared keys' «why» stands right under them — read off the SHARED chips, so it is there before
                   the choice and never re-flows the «ИЛИ» row when an option is chosen. -->
              <ConsoleCountedWhy v-if="hasVariants && countWhy !== undefined" class="con-composer__countwhy" :why="countWhy" />
              <!-- THE ИЛИ CHOICE — the ONE variant grammar (`ConsoleVariantChoice`, TR51): each option leads with the card's
                   OWN printed row of that branch, then its own chips and the table's answer to it; the seal marks the
                   answer, the cursor is a cold lift, a refused option is a faded print with its reason. -->
              <!-- A PALETTE (TR54): every option a gain of a different standard resource — one row of equal tiles, the
                   resource's own sprite and number leading each, the printed «?» on the group's kicker. -->
              <ConsoleVariantChoice v-if="hasVariants"
                                    ref="variantsEl"
                                    class="con-composer__variants"
                                    :data-variant-axis="variantAxis"
                                    :layout="variantPalette ? 'palette' : 'compare'"
                                    :kicker="variantPalette ? paletteKicker : ''"
                                    :emblem="variantPalette ? 'wild' : 'none'"
                                    :options="variantOptions"
                                    :label="$t(resultHeading)"
                                    @pick="clickVariantAt($event)">
                <template #body="{index}">
                  <div class="con-composer__variant-chips">
                    <ActionEffectChip v-for="(eff, k2) in variantTileEffects(variantRows[index].pos)" :key="k2" :effect="eff" :basisInStrip="variantPalette" />
                    <!-- «⚡ сработает» — the reactions tied to THIS branch (the forecast's `byBranch`): what the TABLE adds if
                         the player picks this option, on the option's own chip line past a thin seam. -->
                    <ConsoleForecastReactions :reaction="variantReactions(variantRows[index].pos)" />
                  </div>
                </template>
              </ConsoleVariantChoice>
              <!-- THE RESULT ROW (P81 · the owner 2026-11-01): EVERYTHING the play brings is the result — the resources
                   (`current → resulting`), a NEW EFFECT, a NEW ACTION, the VP — as chips of ONE row on one chassis, under ONE
                   «РЕЗУЛЬТАТ» heading. The card's own graphic is never printed a second time (the face beside the sheet
                   carries it); the chip says only that the card brings it. The set is the CARD's (one card always reads
                   the same); only «Сработает» — the table's answer — depends on the table, on its own line below. -->
              <template v-if="!hasVariants && (immediateEffects.length > 0 || resultGains.length > 0 || vpCell !== undefined)">
                <div class="con-composer__sub-title con-composer__sub-title--result">{{ $t(resultHeading) }}</div>
                <div class="con-composer__hero-chips con-composer__result-chips">
                  <!-- A chip that opens a PHASE of the result («THEN» — TR47's fall after its raise; «Net» — the rating the
                       whole swing leaves) is preceded by the card's own printed divider word: the row reads in the face's
                       order (the raise · ЗАТЕМ · the fall · ИТОГ), never one undivided list of ups and downs. -->
                  <template v-for="(eff, k) in immediateEffects" :key="k">
                    <span v-if="eff.phase !== undefined" class="con-composer__phase" :data-phase="eff.phase">{{ $t(eff.phase) }}</span>
                    <ActionEffectChip :effect="eff" :basisInStrip="basisReadByStrip(eff)" />
                  </template>
                  <ConsolePlayResultGains :gains="resultGains" :vp="vpCell" />
                </div>
              </template>
              <!-- …and under an «ИЛИ» choice the card's other gains stand ONCE below the options (they come with every one). -->
              <div v-else-if="hasVariants && (resultGains.length > 0 || vpCell !== undefined)" class="con-composer__hero-chips con-composer__result-chips">
                <ConsolePlayResultGains :gains="resultGains" :vp="vpCell" />
              </div>
              <!-- WHOM THE PLAY HITS (P59 class — every opponent, no choice): the victims under the result, each with the
                   server's `current → resulting` through the ONE row renderer; a spared part named. Read-only — part of
                   the РЕЗУЛЬТАТ block, never a stage (the crumb does not move). -->
              <ConsoleTableImpact v-if="tableImpact !== undefined" class="con-composer__tblimpact" :view="tableImpact" />
              <!-- «ПОЧЕМУ» (PL-156, the owner's M1 2026-10-11): a walk whose length the card COUNTS (TR42) explains its
                   number as a READING of the result, at the chips' scale, right under them — never as a «ДАЛЕЕ» row (the
                   zero read «ДАЛЕЕ: маркер не двинется», a result told as a next step). Every number is the server's
                   breakdown (`AgendaWalkModel.basis`), read, never divided here. -->
              <div v-if="walkWhy !== undefined" class="con-composer__why" :class="{'con-composer__why--zero': walkWhy.zero}"
                   data-walk-why :data-walk-why-sets="walkWhy.sets">
                <span class="con-composer__why-kicker">{{ whyKicker }}</span>
                <span v-if="walkWhy.zero" class="con-composer__why-stays">
                  <span class="resource_icon resource_icon--agenda-step con-composer__why-ico" aria-hidden="true"></span>{{ $t('The marker stays') }}
                </span>
                <span class="resource_icon resource_icon--rating con-composer__why-ico" aria-hidden="true"></span>
                <b class="con-composer__why-num">{{ walkWhy.value }}</b>
                <span class="con-composer__why-text">{{ whyOver }}</span>
                <span class="con-composer__why-arrow" aria-hidden="true">→</span>
                <span class="con-composer__why-text con-composer__why-text--sets">{{ whySets }}</span>
                <template v-if="!walkWhy.zero">
                  <span class="con-composer__why-arrow" aria-hidden="true">→</span>
                  <span class="resource_icon resource_icon--agenda-step con-composer__why-ico" aria-hidden="true"></span>
                  <b class="con-composer__why-num">{{ walkWhy.sets }}</b>
                </template>
                <span class="con-composer__why-next">{{ whyNext }}</span>
              </div>
              <!-- «ПОЧЕМУ» OF A COUNTED PLAY — the block's SECOND reader (TR45): the census's composition behind the number,
                   the ONE strip the board peek's HUD shows too (`ConsoleCountedWhy`). -->
              <ConsoleCountedWhy v-else-if="countWhy !== undefined && !hasVariants" class="con-composer__countwhy" :why="countWhy" />

              <!-- THE REQUIREMENT UNDER A MODIFIER (TR49 class): each printed global requirement an effect bends — the
                   printed bound (struck when ignored), the effective one, the scale now, the verdict and who bends it.
                   Every number is the server's reading (`ArmedPlayForecast.easings`); one fixed line per requirement. -->
              <div v-for="r in requirementViews" :key="'req' + r.key" class="con-composer__reqrow"
                   :class="{'con-composer__reqrow--waived': r.waived, 'con-composer__reqrow--allied': r.viaAlly, 'con-composer__reqrow--decisive': r.decisive, 'con-composer__reqrow--short': !r.met, 'con-composer__reqrow--stacked': r.stacked}"
                   data-composer-req :data-req-state="r.waived ? 'waived' : (r.viaAlly ? 'allied' : (r.decisive ? 'decisive' : (r.met ? 'eased' : 'short')))">
                <span class="con-composer__reqrow-kicker">{{ $t('Requirement') }}</span>
                <i class="con-composer__reqrow-ico" :class="r.iconClass" :style="r.emblem !== undefined ? {backgroundImage: `url(${r.emblem})`} : undefined" aria-hidden="true"></i>
                <span class="con-composer__reqrow-printed">{{ r.printed }}</span>
                <template v-if="r.effective !== undefined">
                  <span class="con-composer__reqrow-arrow" aria-hidden="true">→</span>
                  <b class="con-composer__reqrow-eff">{{ r.effective }}</b>
                </template>
                <span v-if="r.now !== ''" class="con-composer__reqrow-now">{{ $t('now') }} {{ r.now }}</span>
                <span class="con-composer__reqrow-state">{{ requirementStateText(r) }}</span>
                <!-- WHO bent it, each with its share. Several modifiers: the composition takes a line of its own and
                     reads as the SUM that moved the bound above («… + … = ±6»). -->
                <span class="con-composer__reqrow-src">
                  <span v-for="sh in r.shares" :key="sh.source.key" class="con-composer__reqrow-share" data-composer-req-share>
                    <PremiumModifierMarks :sources="[sh.source]" />{{ sh.text }}
                  </span>
                  <span v-if="r.total !== undefined" class="con-composer__reqrow-total" data-composer-req-total>= {{ r.total }}</span>
                </span>
              </div>

              <!-- ⚡ «СРАБОТАЕТ» — what the TABLE answers to this play, over and above the card's own result: one
                   more unit of the result (the R3 layer names the sources), right under the number it adds to — never
                   one of the card's roles. Absent while the forecast is empty; not a focus stop. -->
              <ConsoleForecastRow v-if="forecastRowShown"
                                  class="con-composer__resforecast"
                                  :class="{'con-forecast--descend': forecastPulse}"
                                  :forecast="forecastAnswered"
                                  @open="openForecastLayer()" />
              </div><!-- /__resulthero -->

              <!-- THE BODY — the sheet's middle zone: centred when it is short, the scroll's only reason when it is not. -->
              <div class="con-composer__playmid">

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

              <!-- THE CONSUME NOTE (TR49 class, the owner's decision 7): an armed one-play effect this card does not need is
                   still SPENT by the play — said in the info tone, never a block and never a second press. A USED one is
                   named where it acts (the requirement row above, the price head's discount). -->
              <div v-for="c in wastedConsumes" :key="'cons' + c.source" class="con-composer__warn con-composer__warn--info" data-unfold-item data-composer-consume>
                <span class="con-composer__warn-glyph" aria-hidden="true">⚡</span>
                <span class="con-composer__warn-body"><span class="con-composer__warn-text">{{ c.text }}</span></span>
              </div>

              <!-- Honest post-confirm follow-up (board placement / notes). ONE
                   fixed-height line each: tile icon, the «ДАЛЕЕ» context label,
                   then the sentence. Only the muted constraint tail may clip. -->
              <div v-for="(n, i) in followUpNotes" :key="'n' + i" class="con-composer__next" data-unfold-item :aria-label="n.full">
                <span v-if="n.tileType !== undefined" class="con-composer__next-tile" :class="{'con-composer__next-tile--over': n.over !== undefined}" :style="tileIconStyle(n.tileType, n.over)" aria-hidden="true"></span>
                <span v-else class="con-composer__next-glyph" aria-hidden="true">›</span>
                <span class="con-composer__next-label">{{ $t('Next') }}</span>
                <span class="con-composer__next-text">{{ n.text }}</span>
                <ConsoleDrawSearchRule v-if="n.search !== undefined" class="con-composer__next-search" :search="n.search" size="line" />
                <span v-if="n.constraint !== ''" class="con-composer__next-tail">{{ n.constraint }}</span>
              </div>

              <!-- DECISIONS: the pre-collected step + tabbed-target rows. -->
              <div v-if="decisionRows.length > 0" class="con-composer__sub-title con-composer__sub-title--spaced" data-unfold-item>{{ $t('Choose before playing') }}</div>
              <div v-for="row in decisionRows" :key="row.id"
                   class="con-composer__row" data-unfold-item
                   :class="{'con-composer__row--focused': focusIdx === row.i, 'con-composer__row--missing': rowMissing(row),
                            'con-composer__row--reaction': row.kind === 'step' && row.choice.reaction !== undefined,
                            'con-composer__row--locked': row.kind === 'step' && tableRowView(row.choice)?.state.kind === 'locked',
                            'con-composer__row--deferred': row.kind === 'step' && tableRowView(row.choice)?.state.kind === 'deferred'}"
                   :data-reaction-card="row.kind === 'step' ? row.choice.reaction?.card : undefined"
                   :data-series-index="row.kind === 'step' ? choiceSeriesOf(row.choice.input)?.index : undefined"
                   :data-tq-state="row.kind === 'step' ? tableRowView(row.choice)?.state.kind : undefined"
                   :data-seeded="row.kind === 'step' && soleMark(row.choice) !== undefined ? (seeded[row.choice.id] ?? 'sole') : undefined"
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
                <!-- THE LAYOUT ROW (TR78 Arwind Inc. — «РАСКЛАДКА»): ONE question for the whole walk — N units over the
                     holders, laid out IN PLACE: a lane per holder (its miniature — a flight end, `data-composer-card` —
                     its name, its count «current → resulting», the units placed on it), the focused lane marked by a
                     kant, ←→ between the lanes, LB/RB one unit on the focused one, RT the rest; what is still to place
                     on the row's edge. The row holds the commit until the sum is exact (the layout opens EMPTY — a
                     filled default would be an auto-select); a complete layout is captured as the ONE `and` answer. -->
                <!-- THE VENUS BONUS, PRE-SELECTED (P89 · ledgers EL / EM): ONE row — the raise and the answer in chips; A
                     opens the INNER step (`sub` venus) where the 30 % wild, its card and the standard spread are laid out. -->
                <template v-else-if="row.choice.kind === 'venusBonus'">
                  <ConsoleVenusBonusRow :input="row.choice.input" :parts="venusPartsOf(row.choice)" />
                </template>
                <template v-else-if="row.choice.kind === 'distribute'">
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__lanes" data-composer-lanes :data-lanes-amount="laneAmountOf(row.choice)" :data-lanes-left="laneRemaining(row.choice)">
                    <div v-for="(card, li) in laneCards(row.choice)" :key="card.name" class="con-composer__lane"
                         :class="{'con-composer__lane--focused': focusIdx === row.i && laneIndexFor(row.choice.id) === li,
                                  'con-composer__lane--filled': laneAmount(row.choice, card.name) > 0}"
                         :data-lane-card="card.name" :data-lane-amount="laneAmount(row.choice, card.name)">
                      <span class="con-composer__lane-mini" :data-composer-card="card.name" aria-hidden="true">
                        <ConsoleCardFaceLite :name="card.name" :card="card" lightweight />
                      </span>
                      <span class="con-composer__lane-body">
                        <span class="con-composer__lane-name">{{ $t(card.name) }}</span>
                        <span class="con-composer__lane-count">
                          <i class="con-composer__lane-icon" :class="iconClass(laneIcon(row.choice, card.name))" aria-hidden="true"></i>
                          <span>{{ card.resources ?? 0 }}</span>
                          <span class="con-composer__lane-arrow" aria-hidden="true">→</span>
                          <b>{{ (card.resources ?? 0) + laneAmount(row.choice, card.name) }}</b>
                        </span>
                      </span>
                      <span class="con-composer__lane-amount" :class="{'con-composer__lane-amount--zero': laneAmount(row.choice, card.name) === 0}">+{{ laneAmount(row.choice, card.name) }}</span>
                    </div>
                    <span class="con-composer__lane-left" :class="{'con-composer__lane-left--done': laneRemaining(row.choice) === 0}" data-lanes-status>
                      <template v-if="laneRemaining(row.choice) > 0">{{ $t('Left') }}: <b>{{ laneRemaining(row.choice) }}</b></template>
                      <template v-else>{{ $t('Laid out') }}: <b>{{ laneAmountOf(row.choice) }}</b></template>
                    </span>
                  </div>
                </template>
                <!-- THE TARGET ROW (TR56 «КУДА ЛЯЖЕТ», П2) — ONE row with the action composer (`ConsoleComposerTargetRow`):
                     the question «КУДА: [печать]» never changes; unanswered, the server's candidates as a strip of live
                     faces; answered, a LINK to the card still lying in its owner's tableau — its miniature, origin and
                     the step's own tag. Both values in ONE cell at ONE height: answering, or a change of variant taking
                     the answer away (П5), moves nothing below. A MERGED multi pick (Astra) keeps its own row. -->
                <template v-else-if="(choiceMode(row.choice) === 'playedTarget' && !isMergedPickChoice(row.choice)) || orAnsweredOnTable(row.choice)">
                  <ConsoleComposerTargetRow :label="targetRowLabel(row.choice)"
                                            :payload="payloadFor(row.choice)"
                                            :candidates="targetRowCandidates(row.choice)"
                                            :sourceCard="cardName"
                                            :result="playedTargetResult(row.choice)"
                                            :resultModel="targetRowModel(row.choice)"
                                            :tag="targetRowTag(row.choice)"
                                            :impacts="targetSummaryImpacts(row.choice)"
                                            :sole="soleMark(row.choice)"
                                            :focused="focusIdx === row.i" />
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
                <!-- A TABLE QUESTION THAT COULD WAIT FOR A DRAW (the owner's decision 2026-10-15 — «Конференция на
                     Олимпе» × «Марсианский университет»): THREE lines in every state, so a change of state re-flows
                     nothing — the asker («Сработает · <карта> · ваш выбор», + «МОЖНО ПОЗЖЕ» while it waits), the value
                     («Ждёт ответа: …» → «Спросят после добора» / the answer), the note (why it waits, or what waiting
                     buys: who draws first, the cards chip, «сбросить можно будет и новую карту»). The value and the
                     note cross-fade in ONE grid cell on a change of state (a v-if swap blinks). -->
                <template v-else-if="tableRowView(row.choice) !== undefined">
                  <template v-for="tq in [tableRowView(row.choice)]" :key="row.id + '#tq'">
                    <template v-if="tq !== undefined">
                      <div class="con-composer__row-label con-composer__tq-head">
                        <span class="con-composer__tq-title">{{ choiceTitle(row.choice) }}</span>
                        <span class="con-composer__tq-badge" :class="{'con-composer__tq-badge--on': tq.state.kind === 'deferred'}"
                              data-tq-badge aria-hidden="true">{{ $t('Can wait') }}</span>
                      </div>
                      <div class="con-composer__tq-cell">
                        <transition name="con-tq-swap">
                          <div :key="tq.state.kind" class="con-composer__tq-body">
                            <div class="con-composer__row-value con-composer__tq-value" :class="'con-composer__tq-value--' + tq.state.kind" data-tq-value>
                              <span v-if="tq.state.kind === 'locked'" class="con-composer__tq-glyph" aria-hidden="true">◷</span>
                              <span v-else-if="tq.state.kind === 'deferred'" class="con-composer__tq-glyph" aria-hidden="true">↷</span>
                              <span class="con-composer__tq-text" :class="{'con-composer__row-empty': tq.state.kind === 'plain' && chosenLabel(row.choice) === ''}">{{ tq.value }}</span>
                              <!-- «Ⓐ Выбрать сейчас» — drawn ONLY while the cursor is here (one button, one verb at a time),
                                   its slot reserved either way so gaining the cursor moves nothing. -->
                              <span v-if="tq.state.kind === 'deferred'" class="con-composer__target-change con-composer__tq-now"
                                    :class="{'con-composer__target-change--on': focusIdx === row.i}">
                                <GamepadGlyph control="confirm" />
                                <span>{{ $t('Choose now') }}</span>
                              </span>
                            </div>
                            <div v-if="tq.lead !== ''" class="con-composer__tq-note" data-tq-note>
                              <span class="con-composer__tq-lead">{{ tq.lead }}</span>
                              <ActionEffectChip v-if="tq.drawn !== undefined" class="con-composer__tq-chip" :effect="tq.drawn" />
                              <span v-if="tq.tail !== ''" class="con-composer__tq-tail">— {{ tq.tail }}</span>
                            </div>
                          </div>
                        </transition>
                      </div>
                    </template>
                  </template>
                </template>
                <template v-else>
                  <div class="con-composer__row-label">{{ choiceTitle(row.choice) }}</div>
                  <div class="con-composer__row-value">
                    <span v-if="chosenLabel(row.choice) !== ''">{{ chosenLabel(row.choice) }}</span>
                    <span v-else class="con-composer__row-empty">{{ pickPlaceholder(row.choice) }}…</span>
                    <!-- THE SOLE CANDIDATE'S MARK (T14 · CC): the row was answered by the composer because there is
                         nothing to choose — said once, quietly, at the row's tail; the hint names why. -->
                    <template v-for="m in [soleMark(row.choice)]" :key="row.id + '#sole'">
                      <span v-if="m !== undefined" class="con-composer__sole" data-seeded-mark :data-hint="$t(m.hint)">{{ $t(m.mark) }}</span>
                    </template>
                    <span v-if="chosenImpact(row.choice) !== ''" class="con-composer__row-impact">
                      <i v-if="chosenImpactIcon(row.choice)" class="con-composer__row-impact-icon" :class="iconClass(chosenImpactIcon(row.choice))" aria-hidden="true"></i>{{ chosenImpact(row.choice) }}
                    </span>
                    <!-- The SECOND payout of a multi pick, in cards (Strategic Shift) — its own icon, the same arithmetic. -->
                    <span v-if="chosenImpactDraw(row.choice) !== ''" class="con-composer__row-impact" data-impact-draw>
                      <i class="con-composer__row-impact-icon" :class="iconClass('cards')" aria-hidden="true"></i>{{ chosenImpactDraw(row.choice) }}
                    </span>
                  </div>
                  <!-- A MERGED GAIN pick answered (P78 «3 different cards», ledger CU): EVERY target named with what lands
                       on it — its own resource, `N → N+1` — and the points that move; never «+3» over three kinds. -->
                  <div v-if="mergedGainTargets(row.choice).length > 0" class="con-composer__row-note con-composer__gain-targets" data-gain-targets>
                    <span v-for="t in mergedGainTargets(row.choice)" :key="t.name" class="con-composer__gain-target" :data-gain-target="t.name">
                      <i class="con-composer__row-impact-icon" :class="iconClass(t.icon)" aria-hidden="true"></i>
                      <span class="con-composer__gain-target-name">{{ t.label }}</span>
                      <span class="con-composer__row-impact">{{ t.from }} → {{ t.to }}</span>
                      <span v-if="t.vp !== undefined" class="con-composer__row-impact">· {{ $t('VP') }} {{ t.vp.from }} → {{ t.vp.to }}</span>
                    </span>
                  </div>
                </template>
              </div>

                <!-- ── THE CARD'S ROLES — what the card IS once it is on the table (a new action, an ongoing effect,
                     endgame points, the tags it carries): ONE quiet line under the body (P81 · DJ — never a row of
                     pills with emoji: a role is a fact the face already prints, read at the caption's weight). Membership
                     is data-driven — no card and no count is named here. -->
                <div v-if="repeatChoice !== undefined || roleSections.length > 0" class="con-composer__rescats" data-composer-roles>
                  <!-- ProjectInspection: the result IS repeating a played action. -->
                  <div v-if="repeatChoice !== undefined" class="con-composer__rescat con-composer__rescat--action">
                    <span class="con-composer__rescat-text">{{ $t('Repeats a played card action') }}</span>
                  </div>


                  <!-- Derived result categories. A tag row is "label: [inline chips]"; a VP row is "label: +N". A card with no
                       role on the table renders nothing here (an empty line says nothing). -->
                  <div v-for="(sec, i) in roleSections" :key="'r' + i" class="con-composer__rescat" :data-rescat="sec.kind"
                       :class="[sec.penalty ? 'con-composer__rescat--penalty' : 'con-composer__rescat--' + sec.kind,
                                {'con-composer__rescat--event-tags': sec.eventTags,
                                 'con-composer__rescat--vpformula': sec.formula !== undefined}]">
                    <span v-if="sec.penalty" class="con-composer__rescat-glyph" aria-hidden="true">⚠</span>
                    <span class="con-composer__rescat-text"
                    >{{ $t(sec.text) }}<template v-if="sec.kind === 'vp'">: <b>{{ vpDetail(sec) }}</b></template
                    ><template v-else-if="sec.kind === 'tags'">:</template
                    ><span v-if="sec.formula !== undefined" class="con-composer__rescat-qual">&nbsp;{{ $t('now') }}</span></span>
                    <!-- THE SERVER'S VP PROJECTION («per tags» cards): the formula
                         behind the number, through the score explorer's own
                         formatter — the number is printed ONCE (above), the
                         formula carries its operands only. One line; a long
                         localization cuts by an ellipsis in this box. -->
                    <span v-if="sec.formula !== undefined" class="con-composer__rescat-formula" data-vp-formula
                    >· <img v-if="formulaTagIcon(sec.formula) !== undefined" class="con-composer__rescat-vptag"
                            :src="formulaTagIcon(sec.formula)" alt="" aria-hidden="true"
                    ><PremiumCountGlyph v-for="(glyph, gi) in formulaCountGlyphs(sec.formula)" :key="'vg' + gi"
                                        class="con-composer__rescat-vpglyph" :glyph="glyph" data-vp-glyph
                    />{{ formulaOperandsText(sec.formula) }}<template v-if="shortfallText(sec.formula) !== ''"
                    > · {{ shortfallText(sec.formula) }}</template></span>
                    <!-- WHAT THE PLAY ARMS (TR49 class): the effect's badge — the waiver's struck plate — and its formula. -->
                    <span v-if="sec.kind === 'armed' && sec.arms !== undefined" class="con-composer__rescat-arms" data-composer-arms>
                      <template v-for="(arm, ai) in sec.arms" :key="'arm' + ai">
                        <span v-if="arm.kind === 'requirementWaiver'" class="con-armed__struck" aria-hidden="true">{{ $t('Global requirements') }}</span>
                        <!-- the PARTY family (TR70): the printed party plate, struck — the face's own glyph of the waiver -->
                        <PremiumPartyRequirementGlyph v-else-if="arm.kind === 'partyWaiver'" class="pprq--waived con-armed__pprq" />
                        <span v-else class="con-armed__badge" aria-hidden="true">{{ armedEffectBadge(arm) }}</span>
                        <span class="con-composer__rescat-armtext" :data-armed-kind="arm.kind">{{ armedEffectFormula(arm) }}</span>
                      </template>
                    </span>
                    <!-- THIS PLAY PASSES (class CT): what the pass leaves unused — the pass confirm's own lines, one reading. -->
                    <span v-if="sec.kind === 'pass' && (sec.passLines?.length ?? 0) > 0" class="con-composer__rescat-passlist" data-composer-pass-left>
                      <span v-for="(line, li) in sec.passLines" :key="'pl' + li" class="con-composer__rescat-passline" data-pass-line
                      >{{ passLineText(line) }}</span>
                    </span>
                    <span v-if="sec.kind === 'pass' && sec.passQuiet !== undefined" class="con-composer__rescat-passquiet" data-pass-quiet
                    >{{ passLineText(sec.passQuiet) }}</span>
                    <span v-if="sec.kind === 'tags' && sec.tags !== undefined" class="con-composer__rescat-tags">
                      <span v-for="(tag, t) in sec.tags" :key="t" class="resource-tag con-composer__rescat-tag" :class="'tag-' + tag" aria-hidden="true"></span>
                    </span>
                    <span v-if="sec.note !== undefined" class="con-composer__rescat-note">{{ $t(sec.note) }}</span>
                  </div>
                </div>

                <!-- THE PAYMENT LEDGER — several lanes (steel, titanium, heat, card resources) or a shortfall: a decision
                     zone of the body, read after the result and the choices, scrolled with them (P81 · DJ, the owner's
                     4K review: a ledger of five lanes pinned to the sheet's foot would eat the result's room or be cut).
                     ONE shared panel, `compact` summary (LB/RB the single alt lane, LT the editor) or `expanded`
                     editor — same rows, same geometry; the host owns all input. The one-lane LINE stands in the dock. -->
                <ConsolePaymentPanel v-if="!payInDock"
                                     class="con-composer__payledger"
                                     :view="paymentView"
                                     :mode="payMode"
                                     :focus-unit="payFocusUnit"
                                     :flash-nonce="payFlashNonce"
                                     :discount="forecastDiscount"
                                     :free="payFree"
                                     data-unfold-item />
              </div><!-- /__playmid -->
              </div><!-- /__playblock -->
            </template>
          </ConsoleScrollArea>
          <!-- THE DOCK — the sheet's bottom line: the commit, and the price beside it when it is ONE line (one lane, or
               free). Mounted with the review (a pick list or the target step owns the whole sheet, as it always owned the
               whole column). -->
          <div v-if="reviewShown" class="con-composer__playdock">
            <ConsolePaymentPanel v-if="payInDock"
                                 :view="paymentView"
                                 :mode="payMode"
                                 :focus-unit="payFocusUnit"
                                 :flash-nonce="payFlashNonce"
                                 :discount="forecastDiscount"
                                 :free="payFree"
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
                 :data-composer-armed="commitArrival.armed && ctaFocused ? '' : undefined"
                 :ref="ctaFocused && !payExpanded ? 'focusedEl' : undefined"
                 @animationend="onCommitBreathEnd"
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
              <span class="con-composer__cta-label">{{ ctaSeriesLeft !== '' ? ctaSeriesLeft : $t(ctaDisplayLabel) }}</span>
            </div>
          </div>
          </div><!-- /__playsheet -->
          <!-- THE CARD'S FOOT (P81 · DJ, the owner's decision for the extreme payment): the room under the hero face's
               bottom line. The column stands the sheet ON it, so the sheet's bottom — the commit — is the card's bottom;
               a sheet taller than the card (a ledger of many lanes) grows UPWARD past the card's top (the same sheet,
               expanded — the result above the card's line, the payment taking the room), and only once it meets the
               band's top does this foot give way, then the body scrolls. Inert, out of the tab and the pad. -->
          <div class="con-composer__playfoot" aria-hidden="true"></div>

          <!-- ── THE «ЭФФЕКТЫ» LAYER (R3) — a LEVEL of this composer, never a
               surface of its own: the work column above PARKS in place, the
               effects explorer (forecast mode) UNFOLDS out of the «Сработает»
               row (consoleForecastFocusMotion — the descend phrase), and B /
               R3 fold it back with the payment, the chosen branch and the
               cursor exactly as they were. The crumb gains «· ЭФФЕКТЫ». ── -->
          <transition :css="false"
                      @enter="forecastFocusEnterHook"
                      @leave="forecastFocusLeaveHook"
                      @enter-cancelled="forecastFocusEnterCancelledHook"
                      @leave-cancelled="forecastFocusLeaveCancelledHook">
            <div v-if="fxOpen" key="fx" class="con-composer__fxlayer" data-forecast-layer>
              <div class="con-composer__fxpanel" data-forecast-surface>
                <ConsoleEffectsExplorer ref="forecastExplorer"
                                        mode="forecast"
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

<script setup lang="ts">
/*
 * data-motion-*: the surface-motion contract — no own backdrop (the
 *       shared `.con-shade` dims); the panel is the animated unit. The
 *       CONFIRM path is untouched: the played-hero scene owns that beat
 *       (armed → flight → landing), our leave only plays on the eventual
 *       unmount / cancel.
 *
 * EMBEDDED (`con-composer--embed`): the SAME instance, re-homed into the
 *       hand workspace's stage zone by `<Teleport>`. It drops the band geometry,
 *       its plate, the `con-ws` marker and its `data-motion-surface` id (an
 *       absent id is the director's documented pass-through — the workspace
 *       already owns the entrance), and it stops titling itself: the kicker and
 *       the card name are handed UP to the workspace breadcrumb
 *       (`setWorkspaceStageName`). A surface that announces itself inside someone
 *       else's frame is exactly how a stage starts reading as a modal.
 *
 * ref="rootEl": this template HAD leading comments (this block), so a DEV build compiled
 *       it to a ROOT FRAGMENT and `$el` was a Text node — `$el.querySelector` was
 *       then `undefined` and every DOM lookup through it silently resolved
 *       nothing. A production build stripped the comments and the same code worked,
 *       which is the worst possible shape for a bug. Anything that needs this
 *       component's root element takes the ref (`composerRootEl()`).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

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
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {RootElHolder, rootElOf} from '@/client/components/rootEl';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {SettledColumn} from '@/client/console/settledColumn';
import Card from '@/client/components/card/CardFace.vue';
import {Color} from '@/common/Color';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
// ConsoleCardFaceLite — the answered target row's miniature (PL-269: the template used it while the Options form never
// registered it, so the row rendered an unknown <consolecardfacelite> tag — no miniature, ever; the import is the binding now).
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import {heroOfEffect, paletteOf, printedVariantRows, variantDestinationsOf, VariantChoiceOption, VariantHero} from '@/client/console/variantChoiceModel';
import {reactionDeferral, ReactionDeferral} from '@/common/models/tableQuestionDeferral';
import {
  TableQuestionRowState, cardsHeldByOtherDiscards, deferPlateOf, tableQuestionCanWait, tableQuestionNote, tableQuestionRowFocusable,
  tableQuestionRowMissing, tableQuestionRowOffered, tableQuestionRowState, tableQuestionValue,
} from '@/client/console/tableQuestionRow';
import {armDeferredDiscards, deferredDiscardKey} from '@/client/console/deferredDiscardFresh';
import {armPostCommitWitness, HonestFollowUp} from '@/client/console/preselectWitness';
import {AddressableInput, roleOf} from '@/common/inputs/preselectAddress';
import type {ItemType} from '@/common/cards/render/Types';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleForecastRow from '@/client/components/console/ConsoleForecastRow.vue';
import ConsoleDrawSearchRule from '@/client/components/console/foundation/ConsoleDrawSearchRule.vue';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {EffectForecast, forecastSourceIsCardless} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {
  DiscountTail, ForecastBranchInfo, VariantReaction,
  discountTail, forecastForFixedBranch, forecastLayerAvailable, forecastRowPresent, variantReactionChips,
} from '@/client/console/effectForecastModel';
import {
  closeEffectForecastLayer, effectForecastOpen, forecastExplorerUi, openEffectForecastLayer,
} from '@/client/console/consoleEffectForecast';
import {
  armForecastRow, armForecastInstantFold,
  forecastFocusEnterHook, forecastFocusLeaveHook, forecastFocusEnterCancelledHook, forecastFocusLeaveCancelledHook,
} from '@/client/console/consoleForecastFocusMotion';
import {effectStatsFor, ensureEffectStats} from '@/client/console/effectStatsStore';
import {descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import {arriveCursor, createCursorArrival, gateCursorDuringEntry, holdCursor, releaseCursor} from '@/client/console/cursorArrival';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {preloadResolutionArt} from '@/client/console/parliament/parliamentArtTier';
import {CardType} from '@/common/cards/CardType';
import {Message} from '@/common/logs/Message';
import {SelectProjectCardToPlayModel, SelectAmountModel, SelectCardModel, SelectPlayerModel, OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {ActionPreview, ActionPreviewBranch, ActionEffect, StagedPlacementModel, AgendaWalkModel, NeutralRallyModel} from '@/common/models/ActionPreviewModel';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {PARLIAMENT_MAX_POPULAR_SUPPORT} from '@/common/parliament/ParliamentTypes';
import {extractPlayRewards} from '@/client/console/resourceTransfer/resourceTransferModel';
import {actionKnownRailMoves, playAlloyPriceReward, playRailReward, playSpendReward, playTargetSpendSpecs, withRailAnswerTags} from '@/client/console/consoleActionCommit';
import {preselectedDiscardsOf} from '@/client/console/cardDiscard/preselectedDiscards';
import {reactionRailSpecs} from '@/client/console/colonyTrade/fleetDockModel';
import {playCardReactions, railAnswerTags, ratingAnswerSpecs} from '@/client/console/played/receivingStageModel';
import {Tag} from '@/common/cards/Tag';
import {SpendableResource} from '@/common/inputs/Spendable';
import {Payment} from '@/common/inputs/Payment';
import {getCard} from '@/client/cards/ClientCardManifest';
import {cardHasAction, playerActionGroups, ActionGroup} from '@/client/components/actions/actionExtraction';
import {stripNodeOr} from '@/client/components/actions/actionBranchView';
import {skippedEffectViews} from '@/client/components/actions/skippedEffectView';
import {divertedTileWarnings} from '@/client/components/actions/divertedTileWarning';
import {cardHasPassiveEffect} from '@/client/components/effects/effectExtraction';
import ConsolePlayResultGains, {ResultGain, ResultVp} from '@/client/components/console/ConsolePlayResultGains.vue';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {enterConsoleHandPick} from '@/client/console/consoleHandPick';
import {orOptionDoor} from '@/client/console/handPickRouting';
import {DeclineModel, declineIsButton, declineResponse, optionalChoiceOf, optionalPickInputOf} from '@/client/console/optionalChoice';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
import {enterConsoleRepeatPick, ConsoleRepeatPickResult} from '@/client/console/consoleRepeatPick';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';
import ConsoleVenusBonusRow from '@/client/components/console/foundation/ConsoleVenusBonusRow.vue';
import ConsoleVenusBonusStep, {VenusBonusStepApi} from '@/client/components/console/foundation/ConsoleVenusBonusStep.vue';
import {
  VENUS_SPREAD_LANES, VenusBonusParts, venusBonusMetaOf, venusPreselectArm, venusPreselectResponse, venusWhenHolds,
} from '@/client/console/venusBonus/venusBonusPreselect';
import {
  VenusInnerFocus, venusInnerBar, venusInnerClamp, venusInnerFootHints, venusInnerNav, venusInnerOpen, venusInnerPress, venusInnerStageKey,
} from '@/client/console/venusBonus/venusBonusInner';
import {armVenusBonusCell} from '@/client/console/scaleStepReward/venusBonusCellBeat';
import {amountOperationVm, ConversionPromptVm} from '@/client/console/conversionPromptModel';
import {targetImpactRows, targetImpactText, targetImpactIsLoss} from '@/client/components/modalInputs/targetImpactRows';
import {playedTargetSelfState} from '@/client/console/played/consolePlayedTargetSelf';
import {TargetImpactChange} from '@/common/models/TargetImpactModel';
import {$t, translateMessage, translateText, translateCardName, translateTextWithParams} from '@/client/directives/i18n';
import {choiceSeriesCount, choiceSeriesOf} from '@/client/console/promptSeries';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {
  ComposerChoice, preChoices, branchChoices,
  spendHeatPlan, spendHeatStock, spendHeatResponse, spendHeatValid,
  orderedPreResponses, orderedStepResponses, tabbedStepsOf, cardPickAskKey, cardPickRoleKey, keepPlayAnswers,
  soleCandidateOf, soleMarkKeys, soleSeedPick, soleSeedResponse, allCandidatesSeed, ALL_SEED_MARK,
  soleSeedViewerOf, SoleSeed, SoleSeedViewer,
} from '@/client/console/consoleActionComposer';
import {distributionLanesOf, DistributionLanes} from '@/client/console/consoleActionComposer';
import {pourRemaining, spreadOn, spreadRemaining, SpreadState, spreadTotal, stepSpread} from '@/client/console/cardResourceDistribution';
import {cardResourceDistributionResponse} from '@/client/console/taskResponses';
import {buildOrItems, orItemResponse, buildTabbedTargets, nestedPickHostable, ConsoleOrItem, ConsoleTabbedTarget, TabbedCardOwner} from '@/client/console/consoleOrChoice';
import {TableTargetStand, isTableTargetStand, tableTargetBotStand, tableTargetCardPick, tableTargetOf, tabbedTargetZone} from '@/client/console/played/tableTargetZone';
import {
  enterDeltaEspionagePick, deltaEspionageStepResponse, deltaEspionageResponseOf,
} from '@/client/console/hydroFlow/deltaEspionageEntry';
import {enterDeltaRewardPick, type DeltaRewardDraft} from '@/client/console/hydroFlow/deltaRewardEntry';
import type {DeltaEspionageProjectionModel} from '@/common/models/DeltaEspionageModel';
import type {DeltaEspionageInputModel} from '@/common/models/PlayerInputModel';
import type {DeltaEspionageResponse, DeltaStageAnswer, InputResponse} from '@/common/inputs/InputResponse';
import {espionageOutcomeView} from '@/client/console/hydroFlow/espionageOutcomeView';
import {repeatComposedResponses} from '@/client/console/consoleHydroAdvance';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';
import {ActionPreviewStep, TabbedTargetsStep} from '@/common/models/ActionPreviewModel';
import {CardResource} from '@/common/CardResource';
import {isGeneralBranch, sharedLeadingEffects,
  playComposerFootHints, FootHint, PlayFocusKind,
  computePrimaryAction, PrimaryActionState, initialVariantSelection,
  playPrimaryVerb, PlayFocusTarget, PlayDoor, playDoorOf, playCommitVerb, playDoorNextStepKey, heroRewardEffectsOf, agendaWalkNextRows, delegateGrantFollowUpRow, nextRowText, playWarmsParliamentArt, RowTranslator, branchHostsParliamentStep, agendaWalkWhy, AgendaWalkWhy,
  playChoiceMode, PlayChoiceMode, foldCopiedProductionEffects, samePreviewShape,
  variantGroupNav, VariantAxis,
} from '@/client/console/consolePlayCardComposer';
import {useResizeObserver} from '@vueuse/core';
import {gameStateVersion} from '@/client/console/gameStateVersion';
import {
  buildPaymentView, PaymentDensity, PaymentView, PaymentSourceRow, editableRows, quickAdjustRow, paymentLineEligible,
  initialCounts, dialLaneCount, megacreditsAvailable,
  paymentCovers, paymentFromCounts, PaymentLane, paymentLanes, projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {consolePlayCardUi, setConsolePlayCardCommands, resetConsolePlayCardUi, setPlayComposerHostedStep, takePlayComposerStagedDraft} from '@/client/console/consolePlayCardUi';
import type {PlayComposerDraft} from '@/client/console/stagedPlay';
import {setWorkspaceFrameStage} from '@/client/console/consoleWorkspaceStack';
import {handStageReveal} from '@/client/console/consoleHandStageMotion';
import {takeHandPlayPreview, storeHandPlayPreview, playPreviewUrl} from '@/client/console/consoleHandPlayPrewarm';
import {activePlayPickReserve} from '@/client/console/consolePlayPick';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsolePlayedTargetLink from '@/client/components/console/played/ConsolePlayedTargetLink.vue';
import ConsoleComposerTargetRow from '@/client/components/console/played/ConsoleComposerTargetRow.vue';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, findPlayedTargetFocus, reseatPlayedTargetFocus,
  stepPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia, stepPlayedTargetOwner, playedTargetAt,
  playedTargetResultOf, playedTargetResultLive, playedTargetReadingImpacts,
  PLAYED_TARGET_SUMMARY_IMPACT_CAP,
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetNavDir, PlayedTargetCell,
  PlayedTargetPreviewSection, PlayedTargetResult, PlayedTargetQuickImpact, PlayedTargetSelection,
  PlayedTargetResourceContext,
  togglePlayedTargetPick, playedTargetPicksValid, prunePlayedTargetPicks, playedTargetShortfalls, playedTargetPayloadOf,
  playedTargetTagOfPreview, PlayedTargetPayload, PlayedTargetTag,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {armPayloadCarry, armPayloadReturn, playPayloadCarry, playPayloadReturn} from '@/client/console/played/payloadCarry';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {
  computeCommitGate, commitAllowed, commitAcceptsCursor, commitRedirectTarget, CommitGate, CommitRequirement, CursorLanding,
  nextCursorAfterAnswer,
} from '@/client/console/consoleCommitGate';
import {arriveAtCommit, commitArrivalAbsorbs, createCommitArrival, endCommitBreath, leaveCommit} from '@/client/console/commitArrival';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {gsap} from 'gsap';
import {MOTION_EASE, motionMs} from '@/client/components/motion/motionTokens';
import {playedHeroLandingPrewarm} from '@/client/console/played/consolePlayedHero';
import {composerReArms} from '@/client/console/played/playComposerLifetime';
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
import {PassLine, PassWarnings} from '@/client/console/passWarnings';
// The VP projection's formula — the score explorer's ONE formatter (`formulaTagIcon` · `formulaOperandsText` · `shortfallText`).
import {ScoreFormula, formulaGlyph, formulaOperandsText, formulaTagIcon, shortfallText} from '@/client/console/scoreExplorerModel';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import ConsoleCountedWhy from '@/client/components/console/ConsoleCountedWhy.vue';
import ConsoleTableImpact from '@/client/components/console/foundation/ConsoleTableImpact.vue';
import {TableImpactView, tableImpactStepOf, tableImpactView} from '@/client/console/tableImpact/tableImpactModel';
import PremiumModifierMarks from '@/client/components/premiumCard/PremiumModifierMarks.vue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';
import {ComposerConsumeNote, ComposerRequirementView, composerConsumeNotes, composerRequirementViews, requirementStateText} from '@/client/console/composerRequirementRow';
import {armedEffectBadge, armedEffectFormula} from '@/client/console/requirementEasingText';
import {RequirementEasingModel} from '@/common/models/ArmedPlayEffectModel';
import {CountedWhy, countedWhyOf} from '@/client/console/countedPlay';
import {boardPeekState, closeBoardPeek, openBoardPeek, peekable} from '@/client/console/boardPeek';
import {CountedObjectGlyph} from '@/client/components/premiumCard/premiumCardIcons';
import {NextStepRow, noteRow, placementRow, searchRows} from '@/client/console/consolePlacementNextStep';
import {consoleTranslate} from '@/client/console/consoleTranslate';
// The «ДАЛЕЕ» row's inline tile pictogram (the same art as the card face).
import {tileIconStyle} from '@/client/console/consoleTileIcon';
import {probeTick} from '@/client/console/probeTick';
import {vI18n, vStripActionPrefix} from '@/client/directives/vDirectives';

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
/**
 * Where the answer of an `or` option's OWN question is kept for the row's label (`picks[nestedPickKey(id)]`, beside
 * `picks[id]` = the option's index) — a key of `picks`, so the staged-play draft carries it for free, like `tabbed#N`.
 * Several cards are joined by `NESTED_PICK_SEP`.
 */
const nestedPickKey = (choiceId: string): string => choiceId + '#nested';
const NESTED_PICK_SEP = '|';
/** A tabbed removal's `picks` value when it was DECLINED (RT) — never a target key (those are `a…` / `p…`). */
const TABBED_DECLINE_KEY = 'decline';
type SubState =
  /** THE EMBEDDED PLAYED-TARGET STEP — a level of this workspace, not a modal
   *  over it: the same `sub` slot every other in-place step uses, so B is one
   *  logical level and the payment / captures below it are never touched. */
  | {kind: 'playedTarget', choiceId: string, focus: PlayedTargetFocus, picked: ReadonlyArray<string>,
     /** The step is answering an OR-OPTION (`orItem`), not the choice itself — a removal that also offers MarsBot
      *  (TR52 «Научный прорыв»: [cards…, the bot]) points at the cards in this same step, the action composer's door. */
     orItem?: ConsoleOrItem,
     /** The step is a TABBED removal's one zone (Virus — `tabbedTargetZone`): the step index it answers. `choiceId` is then
      *  the row's `tabbed#N`, which no `ComposerChoice` carries. */
     tabbed?: number}
  | {kind: 'list', choiceId: string, index: number}
  | {kind: 'orNested', choiceId: string, item: ConsoleOrItem, index: number}
  | {kind: 'tabbed', stepIndex: number, index: number}
  | {kind: 'payment', index: number}
  /** THE VENUS BONUS'S INNER STEP (P89 · EM) — the 30 % wild, its card and the 2 × 3 standard grid (`venusBonusInner.ts`). */
  | {kind: 'venus', choiceId: string, focus: VenusInnerFocus};
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
/** The composer's translator for the pure row helpers (`nextRowText`). */
const ROW_TRANSLATOR: RowTranslator = {text: translateText, params: translateTextWithParams};
/** The same card names as a set (an «all of them» seed against the held answer — ledger CU). */
function sameCardNames(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  return a.length === b.length && a.every((n) => b.includes(n));
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

defineOptions({name: 'ConsolePlayCardConfirm'});
const props = defineProps({
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
  /**
   * WHAT A PASS WOULD LEAVE UNUSED — the shell's ONE reading (`passLeftBehind`, the pass confirm's own `passWarnings`
   * over the same facts). Read only when this play counts as a pass (`ActionPreview.passes`, class CT).
   */
  passReading: {type: Object as PropType<PassWarnings>, default: undefined},
});
const emit = defineEmits(['confirm', 'cancel']);

const flow = useFlowScope('console-play-card-confirm');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const variantsEl = useTemplateRef<RootElHolder | HTMLElement>('variantsEl');
const forecastExplorer = useTemplateRef<InstanceType<typeof ConsoleEffectsExplorer>>('forecastExplorer');
const playstage = useTemplateRef<HTMLElement>('playstage');
const venusStep = useTemplateRef<VenusBonusStepApi>('venusStep');
const scroll = useTemplateRef<{scrollByPx?: (d: number) => void} & {rootEl?: HTMLElement | null, ensureVisible?: (el: Element | null | undefined) => void}>('scroll');
const targetStep = useTemplateRef<{rootEl?: HTMLElement | null, payloadEl?: () => HTMLElement | undefined} & {cells?: () => ReadonlyArray<PlayedTargetCell>} & {ensureFocusVisible?: () => void}>('targetStep');
const focusedEl = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedEl');
const playBlock = useTemplateRef<HTMLElement>('playBlock');
const playRight = useTemplateRef<HTMLElement>('playRight');
const sheet = useTemplateRef<HTMLElement>('sheet');
const playCard = useTemplateRef<HTMLElement>('playCard');
/** The decision column that stops re-centring once the player presses (`settledColumn.ts`). */
const settled = ref<SettledColumn | undefined>(undefined);
/** …and the SHEET in its column: pinned by the same press, so a sheet that grows mid-decision grows DOWNWARD. */
const settledSheet = ref<SettledColumn | undefined>(undefined);
/** The hero face's layout height (px, the sheet's own coordinate space) — the sheet's floor (P81 · DJ). */
const heroFaceHeight = ref(0);
/** The sheet stands taller than the hero face (the EXPANDED composition — a ledger of many lanes). */
const sheetExpanded = ref(false);
let stopSheetObs: (() => void) | undefined;
let stopHeroFaceObs: (() => void) | undefined;
const boardPeekUi = boardPeekState;
const preview = ref<ActionPreview | undefined>(undefined);
const loading = ref(true);
/**
 * A SLOW PREVIEW'S CONTENT ARRIVES (PL-510): on a cache miss the entry cascade played over «Загрузка…», and the
 * review, its rows and the commit row then appeared in ONE flush with the cursor already posed on them. The
 * late content now enters as a cascade of its own, and the cursor's pose waits (`data-cursor-pending` on the
 * root) until it has — then ARRIVES, its own beat. A press in the window releases it at once.
 */
const lateCursor = ref(createCursorArrival('play composer (a late preview)'));
let lateCascade: Array<Animation> = [];
/**
 * THE COMMIT ARRIVES (T14, ledger CC — `commitArrival.ts`): the cursor the ONE rule lands on the commit row because
 * nothing is left to ask ARRIVES there — a press before its pose paints (or inside the ring's clock after) is the
 * arrival, never the play — and the row takes one breath («взведено»).
 */
const commitArrival = ref(createCommitArrival('play composer'));
/** The rows the composer SEEDED with their sole candidate (`soleCandidateOf`) — answered, shown, marked. */
const seeded = ref<Record<string, 'sole' | 'all'>>({});
/** This mount is the RETURN from a staged step (its draft is waiting to be applied): the card was on
 *  screen a moment ago, so its face skips the first-load fade. A peek — `applyPreview` consumes the draft. */
const restored = ref(consolePlayCardUi.stagedDraft?.cardName === props.cardName);
const selectedPos = ref<number | undefined>(undefined);
const capturedPre = ref<Record<number, unknown>>({});
const capturedOption = ref<unknown>(undefined);
const captured = ref<Record<number, unknown>>({});
const amounts = ref<Record<string, number>>({});
const floaters = ref<Record<string, number>>({});
/** THE LAYOUTS (TR78): per layout row, the units placed on each holder; and the lane the cursor stands on. */
const spreads = ref<Record<string, SpreadState>>({});
/** The pre-selected Venus bonus per step index — its two parts (P89 · EL); the step's answer is composed from them. */
const venusParts = ref<Record<number, VenusBonusParts>>({});
const laneFocus = ref<Record<string, number>>({});
const picks = ref<Record<string, string>>({});
/** The RICH result of each answered played-target choice — owner, category,
 *  physical slot key and preview snapshot. The batch still submits the
 *  plain card capture; this is presentation + future-animation context. */
const playedTargetResults = ref<Record<string, PlayedTargetResult>>({});
/** Per-owner cursor memory for the tabbed mode (a tab you return to
 *  should be where you left it). */
const playedTargetOwnerFocus = ref<Record<string, number>>({});
/** The step's measured content width — the split/tabs decision reads it. */
const playedTargetWidth = ref(0);
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
const playedTargetHeight = ref(0);
/** Multi-select hand picks by choice id (display; the capture is the truth). */
const multiPicks = ref<Record<string, ReadonlyArray<string>>>({});
/**
 * The hand album this composer has open for one of its choices (the bridge — the composer waits underneath,
 * hidden): which choice it answers and whether it is a DISCARD, so the crumb's tail names that stage
 * («СБРОС КАРТЫ» / «ВЫБОР КАРТ») for as long as the album stands.
 */
const handPickOpen = ref<{choiceId: string, discard: boolean} | undefined>(undefined);
const payCounts = ref<Partial<Record<SpendableResource, number>>>({});
/** The composed repeat-action pick (ProjectInspection): the chosen
 *  already-used action + its own composed responses. Filled by
 *  `consoleRepeatPick`; carried as `repeat` in the confirm payload. */
const repeatResult = ref<ConsoleRepeatPickResult | undefined>(undefined);
const focusIdx = ref(0);
/**
 * The table questions the cursor has been OFFERED and has left (2026-10-15): a question that may wait for a draw
 * holds nothing up, but the walk sends the cursor to it once, as to the next question — after that the walk goes
 * on to the commit (`tableQuestionRowOffered`).
 */
const offeredSeen = ref<Record<string, true>>({});
const sub = ref<SubState | undefined>(undefined);
const submitting = ref(false);
/** The serial of the prompt the commit ANSWERED — a view past it never re-arms the commit (`composerReArms`). */
const answeredFor = ref<number | undefined>(undefined);
/** Bumped on each quick-adjust to re-trigger the one-shot chip pulse. */
const payFlashNonce = ref(0);
/** The «Сработает» row's one-shot COMMIT pulse (the descend's first beat). */
const forecastPulse = ref(false);
/** The forecast explorer's own cursors (never the Information workspace's). */
const forecastUi = ref(forecastExplorerUi('play'));
/**
 * The «ИЛИ» radiogroup's LIVE axis — measured off the option cards'
 * `offsetTop` (all equal ⇒ one row), re-measured on resize. `row`: ←→
 * switch options with wrap, ↑↓ leave the group; `column` (the Deck):
 * ↑↓ walk the options, ←→ are inert. Never a JS copy of the CSS
 * container-query threshold.
 */
const variantAxis = ref('row' as VariantAxis);
/** A folded palette's row per option (`grid` only — measured with the axis). */
const variantGridRows = ref<Array<number>>([]);
/** The last option the cursor stood on — where ↑ from the payment /
 *  rail re-enters the group. */
const variantReturnIdx = ref(0);
let stopVariantObs: (() => void) | undefined;

/** A hosted step that owns the whole work column (the played-target step) lifts the settled pin while it stands. */
const settleSuspended = computed((): boolean => {
  return sub.value?.kind === 'playedTarget';
});
// ── THE EFFECT FORECAST (rides inside the preview) ──────────────────
const forecast = computed((): EffectForecast | undefined => {
  return preview.value?.forecast;
});
/**
 * THE ROW AFTER THE ANSWER (TR51): a table question answered in this composer is no longer a question — its chip
 * stops asking («?») and states the outcome the player chose (the fact's own outcomes: option 0 = `effects`, option
 * i = `alternatives[i − 1]`, the live prompt's order). The R3 layer keeps the whole fact — every outcome, why.
 */
const forecastAnswered = computed((): EffectForecast | undefined => {
  const forecastNow = forecast.value;
  if (forecastNow === undefined) {
    return undefined;
  }
  const answers = new Map<string, number>();
  for (const c of allChoices.value) {
    const answer = c.scope === 'pre' && c.reaction !== undefined ? capturedPre.value[c.index] as {type?: string, index?: number} | undefined : undefined;
    if (c.reaction !== undefined && answer?.type === 'or' && answer.index !== undefined) {
      answers.set(c.reaction.fact, answer.index);
    }
  }
  if (answers.size === 0) {
    return forecastNow;
  }
  return {...forecastNow, facts: forecastNow.facts.map((fact) => {
    const index = answers.get(fact.id);
    if (fact.certainty !== 'asks' || index === undefined) {
      return fact;
    }
    const effects = index === 0 ? fact.effects : fact.alternatives?.[index - 1]?.effects;
    return effects === undefined ? fact : {...fact, certainty: 'exact', effects, alternatives: undefined};
  })};
});
/** The server's own change counter — the ONE key a preview is fresh by. */
const stateVersion = computed((): string => {
  return gameStateVersion(props.playerView);
});
/** The compact «Сработает» row exists iff it has a chip. */
const forecastRowShown = computed((): boolean => {
  return !loading.value && forecastRowPresent(forecast.value);
});
/** The R3 layer exists iff the forecast has anything to show (a
 *  discount-only forecast keeps the layer, draws no row). */
const forecastAvailable = computed((): boolean => {
  return !loading.value && forecastLayerAvailable(forecast.value);
});
/** R3 is the REVIEW level's verb: silent inside a pick, the payment
 *  editor, a submit in flight or the landing scene. */
const forecastCanOpen = computed((): boolean => {
  return forecastAvailable.value && sub.value === undefined && !submitting.value && !landingUp.value;
});
const fxOpen = computed((): boolean => {
  return effectForecastOpen('play');
});
const forecastDiscount = computed((): DiscountTail | undefined => {
  return discountTail(forecast.value);
});
const forecastBranches = computed((): ReadonlyArray<ForecastBranchInfo> => {
  return hasVariants.value ?
    branches.value.map((b, pos) => ({pos, title: b.title, available: b.available})) : [];
});
/** The play's OWN steps the «ПОРЯДОК» band interleaves with the reactions. */
const forecastOrderFlags = computed((): {cardChoices: boolean, placesTile: boolean} => {
  return {
    cardChoices: hasVariants.value || stepChoices.value.length > 0,
    placesTile: selectedBranch.value?.steps.some((s) => s.kind === 'boardPlacement') === true,
  };
});
/** Every fact owner's stats (undefined per seat until they arrive; a bot
 *  seat has none) — the layer's quiet «За партию» line. */
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
const thisPlayer = computed(() => {
  return props.playerView.thisPlayer;
});
/** Who a lone target would be «yourself» for — an attack on yourself is never seeded (`soleCandidateOf`). */
const soleViewer = computed((): SoleSeedViewer => {
  return soleSeedViewerOf(thisPlayer.value);
});
const card = computed((): CardModel | undefined => {
  return props.input.cards.find((c) => c.name === props.cardName);
});
/**
 * THE HERO AS THE PLAYER READS IT (TR49 class): the prompt's card model carries no requirement reading (it is the
 * prompt's, not the hand's), so the hero's requirement cassette would print the bare bound beside a row saying it
 * is lifted. The server's reading rides in: the face shows eased / lifted / decisive exactly as the hand tile does.
 */
const heroCard = computed((): CardModel | undefined => {
  const cardNow = card.value;
  const easings = requirementEasings.value;
  return cardNow === undefined || easings.length === 0 ? cardNow : {...cardNow, requirementEasing: [...easings]};
});
const titleText = computed((): string => {
  return translateCardName(props.cardName);
});
const cost = computed((): number => {
  return card.value?.calculatedCost ?? 0;
});
// ── payment (the desktop project-card rules, via paymentPlan) ────────
const paymentPrompt = computed(() => {
  let tags: ReadonlyArray<Tag> = [];
  try {
    tags = getCard(props.cardName)?.tags ?? [];
  } catch (err) {
    tags = [];
  }
  return projectCardPaymentPrompt(cost.value, tags, props.input.paymentOptions ?? {}, thisPlayer.value.lastCardPlayed, card.value?.reserveUnits);
});
const payLanes = computed((): Array<PaymentLane> => {
  return paymentLanes(paymentPrompt.value, thisPlayer.value);
});
const megacreditsOnHand = computed((): number => {
  // A play THROUGH A LAW (RX36 — the play pick bridge): the law's bill is paid out of the same M€ FIRST, so the
  // card's payment reads the rail less it (the bill asks no payment of its own here — the promise says so).
  return Math.max(0, megacreditsAvailable(thisPlayer.value) - activePlayPickReserve());
});
/**
 * FREE — the server's price is ZERO (a printed zero, or discounts that ate
 * the whole cost): the payment block collapses to its head + «БЕСПЛАТНО»,
 * nothing is dialed, no editor opens, and the commit is ready without a
 * single press. Reactive on the live card model, so a state change that
 * re-prices the card above zero unfolds the block again — the ONE
 * layout shift this block allows.
 */
const payFree = computed((): boolean => {
  return cost.value === 0;
});
const paymentReady = computed((): boolean => {
  return payFree.value || paymentCovers(cost.value, payLanes.value, payCounts.value, megacreditsOnHand.value);
});
/** The full payment view-model — source rows + verdict + editability. The
 *  UI renders + calls actions; ALL rules stay in `buildPaymentView`. */
const paymentView = computed((): PaymentView => {
  return buildPaymentView({
    cost: cost.value,
    lanes: payLanes.value,
    counts: payCounts.value,
    mcAvailable: megacreditsOnHand.value,
  });
});
/** The single row LB/RB (and RT МАКС.) drive on the COMPACT screen. */
const quickAdjustChip = computed((): PaymentSourceRow | undefined => {
  // A free play has nothing to dial — the bumpers stay silent.
  return payFree.value ? undefined : quickAdjustRow(paymentView.value);
});
/**
 * Is the EXPANDED editor a place worth going? Only with two or more
 * alternative sources — with one the compact block already is the editor
 * (same rows, same numbers, and the bumpers drive that very lane), so LT
 * would open a second copy of the screen the player is looking at. The rule
 * lives in the pure view (`editorEligible`); the host only obeys it — here,
 * in the CTA's shortfall fallback and in the footer.
 */
const payEditorAvailable = computed((): boolean => {
  // …and never for a FREE play: there is no mix to shape.
  return !payFree.value && paymentView.value.editorEligible;
});
/** The EXPANDED payment editor is open — the SAME screen with the payment
 *  block promoted (result dimmed, cursor inside the panel), never a
 *  separate form and never a different geometry. */
const payExpanded = computed((): boolean => {
  return sub.value?.kind === 'payment';
});
/**
 * The payment's DENSITY: the editor while it is open; ONE line when there is nothing to shape (one lane, the mix
 * exact — P81 · DJ: «ОПЛАТА · 11 [M€] · 15 → 4», the price said once); the compact ledger otherwise. A free play
 * keeps its own one-word composition (`free`).
 */
const payMode = computed((): PaymentDensity => {
  if (payExpanded.value) {
    return 'expanded';
  }
  return !payFree.value && paymentLineEligible(paymentView.value) ? 'line' : 'compact';
});
/**
 * WHAT THE PLAY ADDS BEYOND ITS RESOURCES (the owner, 2026-11-01): a NEW EFFECT, a NEW ACTION — chips of the result
 * row (`ConsolePlayResultGains`), the glyphs of the «Эффекты» / «Действия карт» screens; never the card's graphic a
 * second time. A card property (`cardHasPassiveEffect` / `cardHasAction`): one card always reads the same.
 */
const resultGains = computed((): ReadonlyArray<ResultGain> => {
  const gains: Array<ResultGain> = [];
  if (cardHasPassiveEffect(props.cardName)) {
    gains.push({kind: 'effect', icon: 'effects', label: 'Effect'});
  }
  if (cardHasAction(props.cardName)) {
    gains.push({kind: 'action', icon: 'actions', label: 'Action'});
  }
  return gains;
});
/**
 * THE VP CELL (one language for every kind of points): a fixed print («1», a penalty «-1»), a «per X» card's
 * projection — what it scores NOW, the server's number, with its formula — or a value the play cannot know yet
 * («по условию»). Read off the result's `vp` section (`derivePlayResultSections` — the server's projection).
 */
const vpCell = computed((): ResultVp | undefined => {
  const sec = resultSections.value.find((s) => s.kind === 'vp');
  if (sec === undefined) {
    return undefined;
  }
  if (sec.variable === true) {
    return {kind: 'variable', value: translateText('by condition')};
  }
  // A gain reads signed («+1», a penalty «-1») — the result row's own voice; the server's projection as given.
  const value = sec.detail ?? '';
  return sec.formula !== undefined ? {kind: 'formula', value, formula: sec.formula} : {kind: 'fixed', value};
});
/** The payment stands in the DOCK only as ONE line (one lane, nothing to shape) or as FREE; a ledger is the body's. */
const payInDock = computed((): boolean => {
  return payMode.value === 'line' || payFree.value;
});
/**
 * THE CARD'S ROLES THE FACE CANNOT PRINT (P81 · DJ — the owner's 4K review: «Метки» in the middle of the sheet is
 * help the card already shows). The play's tags, its new action, its ongoing effect and a printed VP stand ON the
 * face beside the sheet, so the sheet does not repeat them (the status-line law) — an EVENT's tags included (the
 * table's answer to them is «Сработает», already under the result); what stays is what only the play knows: the VP
 * a «per X» card scores NOW, what the play arms for the next card, a play that passes, the honest fallback.
 */
const roleSections = computed((): ReadonlyArray<PlayResultSection> => {
  return resultSections.value.filter((s) => s.kind === 'armed' || s.kind === 'pass' || s.kind === 'fallback');
});
/** The REVIEW stands (the sheet's three zones): not loading, and no pick list / target step owning the sheet. */
const reviewShown = computed((): boolean => {
  if (loading.value) {
    return false;
  }
  const subNow = sub.value;
  if (subNow?.kind === 'playedTarget' && playedTargetModel.value !== undefined) {
    return false;
  }
  return !(subNow !== undefined && (subNow.kind === 'list' || subNow.kind === 'orNested' || subNow.kind === 'tabbed' || subNow.kind === 'venus'));
});
/** The bonus row the inner step answers. */
const venusSubChoice = computed((): ComposerChoice | undefined => {
  const subNow = sub.value;
  return subNow?.kind === 'venus' ? allChoices.value.find((c) => c.id === subNow.choiceId) : undefined;
});
/** THE SHEET IS AS TALL AS THE CARD (P81 · DJ — the setup's DC mechanism): the hero face's measured height — the sheet's
 *  floor and the card's foot beside it (`__playfoot`), published on the column so both read it. */
const sheetStyle = computed((): Record<string, string> => {
  return heroFaceHeight.value > 0 ? {'--con-setup-face-h': `${heroFaceHeight.value}px`} : {};
});
/**
 * THE STAGE'S OWN NAME (i18n key), handed UP to the workspace breadcrumb.
 * One word wherever possible, and never an echo of the root's noun («КАРТЫ
 * В РУКЕ › ЦЕНТР ИИ › РОЗЫГРЫШ», not «… › РОЗЫГРЫШ КАРТЫ»).
 */
const stageName = computed((): string => {
  // Past the commit the workspace is at its FINAL stage: the card is
  // being laid into «Разыграно» — the tail says so, in one word.
  if (landingUp.value) {
    return 'Played';
  }
  // The HAND ALBUM answers one of this composer's choices — the stage the player stands on is that pick.
  if (handPickOpen.value !== undefined) {
    return handPickOpen.value.discard ? 'Discarding a card' : 'Card selection';
  }
  if (sub.value?.kind === 'payment') {
    return 'Payment';
  }
  // The Venus bonus's inner step names itself in the crumb's tail («… › БОНУС ВЕНЕРЫ»), never on its own plate.
  if (sub.value?.kind === 'venus') {
    return venusInnerStageKey(sub.value.focus);
  }
  // A gain pick asks WHERE its payload lands — the stage is the TARGET (TR56, decision 6: «… › ЦЕЛЬ»).
  if (sub.value?.kind === 'playedTarget' && playedTargetModel.value?.contract.payload !== undefined) {
    return 'Target';
  }
  if (sub.value !== undefined) {
    return 'Selection';
  }
  return 'Playing';
});
// ── THE LANDING STAGE (the workspace's «РАЗЫГРАНО» final step) ───────
/** The scene HOLDS the stage — the raw fact, without its exit. The watcher
 *  below turns its falling edge into a dissolve. */
const landingHolding = computed((): boolean => {
  return props.embedded && playLandingHolding();
});
/** The stage is ON SCREEN — the review has released, the tableau owns the
 *  zone, the card is being laid onto its pile… and it stays until the deck
 *  BEGINS DEALING what the play drew, then dissolves off (the exit is part
 *  of «on screen», or the `v-if` below would cut it mid-fade). */
const landingUp = computed((): boolean => {
  return props.embedded && playLandingShowing();
});
/** The stage layer is MOUNTED — includes the hidden PREWARM window (the
 *  submit round trip), so after A nothing heavy happens for the first
 *  time: layout done, peek faces painted, arts decoding. */
const landingMounted = computed((): boolean => {
  return landingUp.value || (props.embedded && playedHeroLandingPrewarm());
});
/** The hand-editable rows, in panel order — the editor's focus ring. */
const payEditableRows = computed((): ReadonlyArray<PaymentSourceRow> => {
  return editableRows(paymentView.value);
});
/** The unit the editor's cursor sits on (LB/RB + ←→ drive it). */
const payFocusUnit = computed((): string | undefined => {
  if (sub.value?.kind !== 'payment') {
    return undefined;
  }
  return payEditableRows.value[sub.value.index]?.unit;
});
// ── branches / choices ──────────────────────────────────────────────
const branches = computed((): ReadonlyArray<ActionPreviewBranch> => {
  return preview.value?.branches ?? [];
});
const hasVariants = computed((): boolean => {
  return branches.value.length > 1;
});
/** The chips every branch opens with (the keys beside the choice) — stated once above the «ИЛИ» row. */
const sharedVariantEffects = computed((): ReadonlyArray<ActionEffect> => {
  return sharedLeadingEffects(branches.value);
});
/** The shared head is the play's PRICE — every chip of it a cost. */
const sharedVariantIsPrice = computed((): boolean => {
  return sharedVariantEffects.value.length > 0 && sharedVariantEffects.value.every((e) => e.direction === 'cost');
});
/**
 * THE CARD ASKS A REAL «ИЛИ» QUESTION — two or more branches the rules
 * actually allow. One playable branch among several is NOT a question (the
 * others are shown greyed with their reason, and `initialVariantSelection`
 * seeds it), so nothing on this screen may demand a choice there.
 * Stable for the life of the preview, which is why the heading can key on
 * it without ever re-flowing.
 */
const hasVariantChoice = computed((): boolean => {
  return branches.value.filter((b) => b.available).length > 1;
});
/** The question is asked and NOT yet answered — the screen's first state. */
const variantChoicePending = computed((): boolean => {
  return hasVariantChoice.value && selectedPos.value === undefined;
});
/**
 * THE HEADING. «ВЫБЕРИТЕ РЕЗУЛЬТАТ» while the card asks, «РЕЗУЛЬТАТ» when it
 * only reports — and it never changes at the moment of choosing (the
 * predicate is the card's shape, not the player's progress), so answering
 * cannot re-flow the block under the cursor.
 */
/** PL-156 — the counted walk's «why», read off the server's breakdown (`agendaWalkWhy` — pure, spec'd). */
const walkWhy = computed((): AgendaWalkWhy | undefined => {
  return agendaWalkWhy(agendaWalkOf(selectedBranch.value));
});
/**
 * TR45 — the counted play's «why» (the census's composition; PL-196 — a single counted term too), read off the
 * play's own chips: a card with an «ИЛИ» reads the keys every option shares (TR43's production — stated once above
 * the row, so the reading is there before the choice and the choice re-flows nothing), any other the branch.
 */
const countWhy = computed((): CountedWhy | undefined => {
  if (walkWhy.value !== undefined) {
    return undefined;
  }
  return countedWhyOf(hasVariants.value ? sharedVariantEffects.value : selectedBranch.value?.effects);
});
/** «РАСЧЁТ» — the strip's name, the counted play's word (`ConsoleCountedWhy`); the steps stand once, at its end. */
const whyKicker = computed((): string => {
  return walkWhy.value === undefined ? '' : translateText('Calculation');
});
const whyOver = computed((): string => {
  return walkWhy.value === undefined ? '' : translateTextWithParams('over ${0}', [String(walkWhy.value.over)]);
});
const whySets = computed((): string => {
  const why = walkWhy.value;
  if (why === undefined) {
    return '';
  }
  return why.zero ? translateTextWithParams('no complete set of ${0}', [String(why.step)]) :
    translateTextWithParams('${0} complete set(s) of ${1}', [String(why.sets), String(why.step)]);
});
const whyNext = computed((): string => {
  const why = walkWhy.value;
  if (why === undefined) {
    return '';
  }
  return translateTextWithParams(why.zero ? '${0} more TR to the first set' : '${0} more TR to the next set', [String(why.toNext)]);
});
const resultHeading = computed((): string => {
  if (variantPalette.value) {
    return 'Choose a resource';
  }
  return hasVariantChoice.value ? 'Choose the result' : 'Result';
});
/**
 * Each option's HERO — the standard resource its own first chip gains (`heroOfEffect`, the server's number); a
 * group whose every option has one, all of one kind, is a PALETTE (TR54 — «which standard resource»).
 */
const variantHeroes = computed((): ReadonlyArray<VariantHero | undefined> => {
  return variantRows.value.map((row) => heroOfEffect(variantOwnEffects(row.pos)[0]));
});
const variantPalette = computed((): boolean => {
  return variantPrinted.value === undefined && paletteOf(variantHeroes.value.map((hero) => ({hero})));
});
/**
 * The palette's kicker — the exclusion («one of six») and, when every option counts the same thing, WHAT it counts
 * (TR54: «your production») — the one «why» of the row, never six repeats of it under the tiles.
 */
const paletteKicker = computed((): string => {
  const one = translateTextWithParams('One of ${0}', [String(variantRows.value.length)]);
  const labels = new Set(variantRows.value.map((row) => variantOwnEffects(row.pos)[0]?.basis?.[0]?.label));
  const label = labels.size === 1 ? [...labels][0] : undefined;
  return label === undefined ? one : one + ' · ' + translateText(label);
});
/**
 * THE PLAY WILL HOST A PARLIAMENT STEP (PL-127): the chosen branch's SHOW step — a walk of the Agenda track
 * (TR04 / TR37) or a rally of neutral delegates (TR31) — read off the server's preview, published to the shell
 * (`consolePlayCardUi.hostedStepDeclared`) so the Parliament's surface is warmed while the player reads this
 * composer, never in the frame of the press. The card's name while declared, '' otherwise.
 */
const hostedStepDeclared = computed((): string => {
  const b = selectedBranch.value;
  return branchHostsParliamentStep(b) ? props.cardName : '';
});
/** The victims of a play that hits every opponent without a choice (the server's read-only `tableImpact` step). */
const tableImpact = computed((): TableImpactView | undefined => {
  const players = props.playerView.players;
  return tableImpactView(tableImpactStepOf(selectedBranch.value ?? preview.value?.branches?.[0]), (color) => displayNameForColor(players, color));
});
const selectedBranch = computed((): ActionPreviewBranch | undefined => {
  if (selectedPos.value !== undefined) {
    return branches.value[selectedPos.value];
  }
  if (branches.value.length === 1) {
    // A single-branch card has no variant pick — the lone branch is it.
    return branches.value[0];
  }
  // No branches (no on-play choice, or a failed/absent preview) → the card
  // still plays; the implicit branch carries the bare submit.
  return branches.value.length === 0 ? IMPLICIT_BRANCH : undefined;
});
const immediateEffects = computed((): ReadonlyArray<ActionEffect> => {
  const b = selectedBranch.value;
  if (b === undefined) {
    return [];
  }
  // Copy-the-production steps (Cyberia / Robotic Workforce): once a target
  // is picked, its server-computed production box FOLDS into the result —
  // the player sees EXACTLY what is copied, live as they re-pick.
  const folded = foldCopiedProductionEffects(
    b,
    (i) => capturedCardNameAt(i),
    (res) => playerProduction(res),
  );
  const out: Array<ActionEffect> = folded !== undefined ? [...folded] : [...b.effects];
  if (b.reveal !== undefined) {
    out.push(b.reveal.reward);
  }
  return out;
});
/**
 * The cards the player's OWN multi picks decide to draw (Strategic Shift: one per card thrown) — the part of the
 * play's draw no fixed chip states; summed into the outcome claim so the embedded draw stage expects the real count.
 */
const multiPickDraws = computed((): number => {
  return allChoices.value.reduce((n, c) => {
    const draw = c.multiSelect?.drawPerCard;
    const picked = multiPicks.value[c.id];
    return draw !== undefined && draw > 0 && picked !== undefined ? n + picked.length * draw : n;
  }, 0);
});
const allChoices = computed((): ReadonlyArray<ComposerChoice> => {
  // A conditional Venus bonus (PL-1505) stands only while its option is the `or` step's answer — the captures decide.
  return [...preChoices(preview.value), ...branchChoices(selectedBranch.value, captured.value), ...espOwnerChoices.value];
});
// ── the ESPIONAGE ask (Corporate Espionage, DP10) ─────────────────────
/** The play's espionage step, when the card carries one. */
const espionageChoice = computed((): ComposerChoice | undefined => {
  return allChoices.value.find((c) => c.input.type === 'deltaEspionage');
});
/** THE server-authored projection — every espionage row/summary reads this
 *  one payload; nothing is re-derived from a cell number. */
const espionageProjection = computed((): DeltaEspionageProjectionModel | undefined => {
  const c = espionageChoice.value;
  return c === undefined ? undefined : (c.input as DeltaEspionageInputModel).projection;
});
/** The captured espionage response — the ONE source of the chosen target
 *  (the summary row and the re-open's prior both read it back). */
const espionageCapture = computed((): DeltaEspionageResponse | undefined => {
  const c = espionageChoice.value;
  return c === undefined ? undefined : deltaEspionageResponseOf(captured.value[c.index]);
});
/** The chosen target's projection entry (for the summary row). */
const espionageChosenTarget = computed(() => {
  const target = espionageCapture.value?.target;
  if (target === undefined) {
    return undefined;
  }
  return espionageProjection.value?.targets.find((t) => t.color === target);
});
const espionageChosenView = computed(() => {
  const t = espionageChosenTarget.value;
  return t === undefined ? undefined : espionageOutcomeView(t.reward, t.rewardSkipped);
});
const espionageTargetName = computed((): string => {
  const t = espionageChosenTarget.value;
  return t === undefined ? '' : displayNameForColor(props.playerView.players, t.color);
});
const espionageOwnerView = computed(() => {
  const proj = espionageProjection.value;
  return proj === undefined ? undefined : espionageOutcomeView(proj.owner.reward);
});
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
const espOwnerChoices = computed((): ReadonlyArray<ComposerChoice> => {
  const proj = espionageProjectionRaw.value;
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
    const byName = new Map(props.playerView.thisPlayer.tableau.map((c) => [c.name, c]));
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
});
/** The projection read WITHOUT the synthesized rows — `espOwnerChoices`
 *  may not read a computed that includes itself (`allChoices`). */
const espionageProjectionRaw = computed((): DeltaEspionageProjectionModel | undefined => {
  const steps = [...(preview.value?.preSteps ?? []), ...(selectedBranch.value?.steps ?? [])];
  for (const s of steps) {
    if (s.kind === 'input' && s.input.type === 'deltaEspionage') {
      return (s.input as DeltaEspionageInputModel).projection;
    }
  }
  return undefined;
});
/** The owner's landing answer, folded from the synthetic rows' captures —
 *  rides INSIDE the espionage response, never as its own batch entry. */
const espionageOwnerAnswer = computed((): DeltaStageAnswer | undefined => {
  const proj = espionageProjectionRaw.value;
  if (proj === undefined || !proj.owner.legal) {
    return undefined;
  }
  const position = proj.owner.toPosition;
  const reward = proj.owner.reward;
  if (reward.kind === 'choice') {
    const capturedNow = captured.value[ESP_OWNER_CHOICE_INDEX] as {type?: string, index?: number} | undefined;
    return capturedNow?.type === 'or' && typeof capturedNow.index === 'number' ?
      {position, rewardChoice: capturedNow.index} : undefined;
  }
  if (reward.kind === 'repeat-action' && repeatResult.value !== undefined && espOwnerChoices.value.some((c) => c.id === 'esp-owner-repeat')) {
    const composed = repeatComposedResponses(repeatResult.value.composed) as ReadonlyArray<InputResponse>;
    return {
      position,
      selectedCard: repeatResult.value.chosenCard,
      ...(composed.length > 0 ? {repeatResponses: composed} : {}),
    };
  }
  if (reward.kind === 'card-resource') {
    const capturedNow = captured.value[ESP_OWNER_ANIMAL_INDEX] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
    return capturedNow?.type === 'card' && capturedNow.cards !== undefined && capturedNow.cards.length > 0 ?
      {position, selectedCard: capturedNow.cards[0]} : undefined;
  }
  return undefined;
});
// (The old multi-card-branch follow-up carve-out is GONE: merge slots
// host as ONE multi tableau pick, dedupe steps as sequential picks.)
/** Card names in the player's hand — hand-card picks route to the hand
 *  section's pick mode instead of an inline text list. */
const handNamesSet = computed((): ReadonlySet<string> => {
  return new Set(props.playerView.cardsInHand.map((c) => c.name));
});
/** Card names on ANY player's table — those picks route to the EMBEDDED
 *  played-target step (the surface that shows whose card it is, where it
 *  sits, and what choosing it would do). */
const playedNamesSet = computed((): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const player of props.playerView.players) {
    for (const c of player.tableau) {
      names.add(c.name);
    }
  }
  return names;
});
/**
 * THE EMBEDDED SELECTOR'S MODEL — built only while the step is open (or
 * warmed for the focused row), so a play with no played-card choice never
 * pays for it. Eligibility is the SERVER's candidate set, verbatim; the
 * preview is built from the server's own step data below.
 */
const playedTargetModel = computed((): PlayedTargetModel | undefined => {
  if (sub.value?.kind === 'playedTarget' && sub.value.tabbed !== undefined) {
    return tabbedZoneModelFor(sub.value.tabbed);
  }
  const choice = playedTargetChoice.value;
  return choice === undefined ? undefined : playedTargetModelFor(choice);
});
/**
 * The SELECTED variant's printed graphic — the tile's hero, when the branch has exactly ONE gain-to-a-card pick
 * (then the print IS that pick's payload: «3 [мех]*»). A branch with several picks keeps the words.
 */
const selectedVariantPrint = computed((): ReadonlyArray<ItemType> | undefined => {
  const pos = selectedPos.value;
  if (pos === undefined || !hasVariants.value) {
    return undefined;
  }
  const k = variantRows.value.findIndex((row) => row.pos === pos);
  const gainPicks = (branches.value[pos]?.steps ?? []).filter((st) => st.kind === 'input' && st.input.type === 'card' && (st.amount ?? 0) > 0);
  return k >= 0 && gainPicks.length === 1 ? variantPrinted.value?.[k] : undefined;
});
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
const selfTargetPresent = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.present;
});
const selfTargetFocused = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.focused;
});
/** …and stays lit once it is the chosen target. */
const selfTargetLocked = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetSelfState.locked;
});
const playedTargetStepOpen = computed((): boolean => {
  return sub.value?.kind === 'playedTarget' && playedTargetModel.value !== undefined;
});
/** The open step's ANSWERED target (a card's name / a stand key) — it lies locked in its owner's group. */
const playedTargetLockedCard = computed((): string => {
  const subNow = sub.value;
  if (subNow?.kind !== 'playedTarget') {
    return '';
  }
  if (subNow.tabbed !== undefined) {
    return tabbedZoneKeyOf(subNow.tabbed, picks.value['tabbed#' + subNow.tabbed]) ?? '';
  }
  return playedTargetResults.value[subNow.choiceId]?.cardName ?? '';
});
/**
 * THE STEP'S CARDS, WARMED WHILE THE CURSOR STANDS ON ITS ROW (PL-473): the step draws its candidates at the FULL
 * art tier (the row's strip draws thumbs), and decoding them in the press's own frames was the «empty glass» —
 * ≈ 180 ms of a 4K step painted without its cards. The names of the row's candidates while the cursor is on it.
 */
/**
 * THE LIVE GRANT'S FACES, warmed while the composer stands (PL-1168): the voting area's resolutions this play's
 * vote will open on — '' when the preview carries no live grant. A key, so the watcher fires once per table.
 */
const grantWarmIds = computed((): string => {
  if (!playWarmsParliamentArt(branches.value)) {
    return '';
  }
  return (props.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution).join('|');
});
const targetWarmNames = computed((): string => {
  const row = focusedRow.value;
  const choice = row?.kind === 'step' ? row.choice : undefined;
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
/**
 * The FIRST decision row this step owns — used to render its summary and
 * to warm the model before the player presses A.
 *
 * Returns the CHOICE id, not the ROW id. The row's own id is prefixed
 * (`step#<choiceId>`), so returning it made the lookup in
 * `playedTargetChoice` miss every time: the model came out undefined and
 * A on the row did nothing at all.
 */
const playedTargetRowId = computed((): string | undefined => {
  const row = decisionRows.value
    .find((r) => r.kind === 'step' && choiceMode(r.choice) === 'playedTarget');
  return row !== undefined && row.kind === 'step' ? row.choice.id : undefined;
});
const playedTargetLayout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: playedTargetModel.value?.owners ?? [],
    availW: playedTargetWidth.value,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
/** The live ask of the OPEN step (the component's `selection` prop). A
 *  COMPUTED, not a method: the template binds it and the input handlers
 *  read it every press, so it must track `sub.picked` reactively. */
const playedTargetSelection = computed((): PlayedTargetSelection => {
  const choice = playedTargetChoice.value;
  return choice === undefined ? {mode: 'single'} : playedTargetSelectionFor(choice);
});
/** The game-state version a selection is only valid under. */
const playedTargetVersion = computed((): string => {
  return `${props.playerView.game.gameAge}|${props.playerView.game.undoCount ?? 0}`;
});
/** The selected branch is a MERGED-slot pick (Astra: its card steps are
 *  slots of one "up to N" SelectCard → hosted as ONE multi tableau pick
 *  on the FIRST card step; the later card steps collapse into it). */
const mergeBranchActive = computed((): boolean => {
  return selectedBranch.value?.mergeCardSteps !== undefined;
});
/** The FIRST card step's index of a merge branch (the pick host). */
const firstMergeCardStepIndex = computed((): number => {
  const b = selectedBranch.value;
  if (b === undefined || b.mergeCardSteps === undefined) {
    return -1;
  }
  return b.steps.findIndex((s) => s.kind === 'input' && s.input.type === 'card');
});
/** Card-step slots of the merge branch (the multi pick's max). */
const mergeCardStepCount = computed((): number => {
  const b = selectedBranch.value;
  if (b === undefined || b.mergeCardSteps === undefined) {
    return 0;
  }
  return b.steps.reduce((n, s) => n + (s.kind === 'input' && s.input.type === 'card' ? 1 : 0), 0);
});
const stepChoices = computed((): ReadonlyArray<ComposerChoice> => {
  return allChoices.value.filter((c) =>
    choiceMode(c) !== 'followup' && choiceMode(c) !== 'repeat' && !isCollapsedMergeStep(c));
});
/** The play's TABLE questions (TR51 — card-level pre-steps a reaction asks), in the live queue's order. */
const tableQuestionChoices = computed((): ReadonlyArray<ComposerChoice> => {
  return allChoices.value.filter((c) => c.scope === 'pre' && c.reaction !== undefined);
});
/**
 * The table questions LEFT FOR AFTER THE DRAW right now — deferrable and unanswered: the batch posts nothing for
 * them, the server asks them live once the draw has landed (the commit witness counts them handed on).
 */
const deferredTableChoices = computed((): ReadonlyArray<ComposerChoice> => {
  return tableQuestionChoices.value.filter((c) => tableRowState(c).kind === 'deferred');
});
/**
 * Every DISCARD this composer has answered before the press, by choice: the card's own discard step, a table
 * question's discard option (Mars University). Two of them must never name one card — the album of each refuses the
 * cards the others hold.
 */
const discardAnswers = computed((): ReadonlyArray<{id: string, cards: ReadonlyArray<string>}> => {
  const out: Array<{id: string, cards: ReadonlyArray<string>}> = [];
  for (const c of allChoices.value) {
    if (c.input.type === 'or') {
      const pick = picks.value[c.id];
      const opt = pick !== undefined ? (c.input as OrOptionsModel).options[Number(pick)] : undefined;
      const nested = picks.value[nestedPickKey(c.id)];
      if (opt !== undefined && (opt as SelectCardModel).discardPrompt !== undefined && nested !== undefined && nested !== '') {
        out.push({id: c.id, cards: nested.split(NESTED_PICK_SEP)});
      }
    } else if (c.input.type === 'card' && (c.input as SelectCardModel).discardPrompt !== undefined) {
      const multi = multiPicks.value[c.id];
      const single = picks.value[c.id];
      const cards = multi !== undefined ? multi : (single !== undefined ? [single] : []);
      if (cards.length > 0) {
        out.push({id: c.id, cards});
      }
    }
  }
  return out;
});
const followUpChoices = computed((): ReadonlyArray<ComposerChoice> => {
  // The repeat choice is its OWN dedicated row (never a follow-up note).
  return allChoices.value.filter((c) => !stepChoices.value.includes(c) && choiceMode(c) !== 'repeat');
});
/** The "repeat an already-used action" choice (ProjectInspection), if any. */
const repeatChoice = computed((): ComposerChoice | undefined => {
  return allChoices.value.find((c) => choiceMode(c) === 'repeat');
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
const rows = computed((): ReadonlyArray<PlayRow> => {
  const out: Array<PlayRow> = [];
  if (hasVariants.value) {
    // The general branch of an optional choice is the play itself — never a row of the «ИЛИ» group.
    branches.value.forEach((b, pos) => {
      if (!isGeneralBranch(b, branches.value)) {
        out.push({i: 0, id: 'variant#' + pos, kind: 'variant', pos});
      }
    });
  }
  if (repeatChoice.value !== undefined) {
    out.push({i: 0, id: 'repeat', kind: 'repeat', choice: repeatChoice.value});
  }
  // The card's own questions first, then the TABLE's (TR51 — «Сработает · <карта> · ваш выбор»): the table answers
  // the play the card makes, so it reads after it.
  for (const c of stepChoices.value.filter((x) => x.reaction === undefined)) {
    out.push({i: 0, id: 'step#' + c.id, kind: 'step', choice: c});
  }
  for (const c of stepChoices.value.filter((x) => x.reaction !== undefined)) {
    out.push({i: 0, id: 'step#' + c.id, kind: 'step', choice: c});
  }
  for (const t of tabbedSteps.value) {
    out.push({i: 0, id: 'tabbed#' + t.index, kind: 'tabbed', stepIndex: t.index});
  }
  // The terminal «Разыграть» CTA is always the last focusable row.
  out.push({i: 0, id: 'cta', kind: 'cta'});
  return out.map((r, i) => ({...r, i}));
});
const ctaIndex = computed((): number => {
  return rows.value.findIndex((r) => r.kind === 'cta');
});
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
/** Every decision row in cursor order — what the gate and the cursor rule read. */
const commitRequirements = computed((): ReadonlyArray<CommitRequirement> => {
  return rows.value
    .filter((r): r is PlayRow => r.kind !== 'cta')
    .map((r) => ({index: r.i, verb: rowVerb(r), satisfied: !rowMissing(r)}));
});
const commitGate = computed((): CommitGate => {
  const st = primaryActionState.value;
  return computeCommitGate({
    requirements: commitRequirements.value,
    submitting: submitting.value,
    unavailable: st.kind === 'blocked-requirement' ?
      st.reason :
      (st.kind === 'blocked-payment' ? 'Not enough resources' : undefined),
  });
});
/** May A actually PLAY the card right now? */
const commitReady = computed((): boolean => {
  return commitAllowed(commitGate.value) && !payExpanded.value;
});
/**
 * Does pressing A on the commit row DO something? That — not «is the play
 * ready» — is what earns the active ring and the live glyph: a payment
 * shortfall opens the editor (WHERE there is one — with a single alt lane
 * the fix is the bumpers under the player's thumbs, and A does nothing),
 * and the expanded editor confirms the payment.
 */
const ctaPressMeaningful = computed((): boolean => {
  return commitReady.value || payExpanded.value ||
    (primaryActionState.value.kind === 'blocked-payment' && payEditorAvailable.value);
});
/** The last cursor stop — the commit row drops out only when a real ROW is
 *  waiting for the player (the gate's `incomplete` / `stale`). */
const navMaxIndex = computed((): number => {
  const last = rows.value.length - 1;
  return commitAcceptsCursor(commitGate.value) ? last : Math.max(0, Math.min(last, ctaIndex.value - 1));
});
const ctaFocused = computed((): boolean => {
  return focusedRow.value?.kind === 'cta';
});
const variantRows = computed((): ReadonlyArray<PlayRow & {kind: 'variant'}> => {
  return rows.value.filter((r): r is PlayRow & {kind: 'variant'} => r.kind === 'variant');
});
/** The card's PRINTED row of each variant, in the printed order — the face's own nodes (`printedVariantRows`). */
const variantPrinted = computed((): ReadonlyArray<ReadonlyArray<ItemType>> | undefined => {
  return printedVariantRows(getCard(props.cardName)?.metadata.renderData, variantRows.value.length);
});
/** The pick list in the variant grammar — one option per row of `listItems`. */
const listOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  const subNow = sub.value;
  const at = subNow !== undefined && (subNow.kind === 'list' || subNow.kind === 'orNested' || subNow.kind === 'tabbed') ? subNow.index : undefined;
  return listItems.value.map((item, i): VariantChoiceOption => ({
    key: item.key,
    state: {focused: at === i, selected: item.chosen === true, off: item.disabled === true},
    title: item.label,
    reason: item.disabled && item.reason !== '' ? item.reason : undefined,
    door: item.orItem?.nested !== undefined,
    color: item.color,
  }));
});
/** The variant grammar's options — the three facts per option (cursor · answer · rules), the words, the print. */
const variantOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  const printed = variantPrinted.value;
  return variantRows.value.map((row, k): VariantChoiceOption => {
    const branch = branches.value[row.pos];
    const hero = variantPalette.value ? variantHeroes.value[k] : undefined;
    // «КУДА ЛЯЖЕТ» (TR56, П1): a «put N on ANY card» option names its ADDRESSES — the server's holders for it.
    const destinations = variantDestinationsOf(branch);
    return {
      key: row.id,
      state: {focused: focusIdx.value === row.i, selected: selectedPos.value === row.pos, off: !branch.available},
      // A palette tile speaks with its hero and its number — the words would only repeat them; a printed payload
      // with its addresses says WHAT and WHERE, and its sentence would be the print read aloud (TR56, П1).
      title: hero !== undefined || (destinations !== undefined && printed?.[k] !== undefined) ? '' : branchTitle(branch),
      destinations,
      // ONE LOSS, ONE VOICE (PL-171): with the strip naming every option's loss, the tile carries no second reason.
      reason: !branch.available && !variantLossesInStrip.value ? branchReasonText(branch) : undefined,
      // NO EFFECT (the server's verdict — TR54's «production 0»): the tile quiets and names it, never hidden.
      quiet: branch.available && branch.futile !== undefined ? translateTextWithParams(branch.futile.reason, [...(branch.futile.reasonParams ?? [])]) : undefined,
      printed: printed?.[k],
      hero,
      attrs: hero !== undefined ? {'data-palette-resource': hero.icon} : undefined,
    };
  });
});
/** The pre-collectable decision rows (repeat slot + step picks + tabbed-target picks). */
const decisionRows = computed((): ReadonlyArray<PlayRow & {kind: 'step' | 'tabbed' | 'repeat'}> => {
  return rows.value.filter((r): r is PlayRow & {kind: 'step' | 'tabbed' | 'repeat'} =>
    r.kind === 'step' || r.kind === 'tabbed' || r.kind === 'repeat');
});
const focusedRow = computed((): PlayRow | undefined => {
  return focusIdx.value >= 0 ? rows.value[focusIdx.value] : undefined;
});
/** The ONE smart primary action — see computePrimaryAction. Focus-independent. */
const primaryActionState = computed((): PrimaryActionState => {
  const b = selectedBranch.value;
  const branchSelectable = b !== undefined && b.available;
  // The variant rows are requirements too, so they must not ALSO be counted
  // as an unresolved STEP — «выберите результат» and «сделайте выбор перед
  // розыгрышем» are different sentences about different rows.
  const firstMissing = rows.value.findIndex((r) => r.kind !== 'variant' && rowMissing(r));
  const firstVariant = rows.value.findIndex((r) => r.kind === 'variant' && rowMissing(r));
  return computePrimaryAction({
    variantPending: variantChoicePending.value && firstVariant >= 0 ? {rowIndex: firstVariant} : undefined,
    branchSelectable,
    paymentReady: paymentReady.value,
    firstUnresolvedStepRowIndex: firstMissing >= 0 ? firstMissing : undefined,
    // The blocked CTA carries the SERVER's own reason — the same string the
    // variant row already shows. Without it the biggest control on the
    // screen was labelled «Сейчас недоступно» while the real explanation
    // sat two rows above it. (Mirrors ConsoleActionComposer.commitGate.)
    requirementReason: b !== undefined && !b.available ? branchReasonText(b) : undefined,
  });
});
// ── result sections (never empty) ───────────────────────────────────
const resultSections = computed((): ReadonlyArray<PlayResultSection> => {
  const meta = getCard(props.cardName);
  return derivePlayResultSections(
    {
      tags: meta?.tags ?? [],
      hasAction: cardHasAction(props.cardName),
      hasEffect: cardHasPassiveEffect(props.cardName),
      victoryPoints: meta?.victoryPoints,
      // The server's VP projection rides the preview (a «per tags» card
      // only) — rendered as given, never counted here.
      vpProjection: preview.value?.cardVictoryPoints,
      isEvent: meta?.type === CardType.EVENT,
      // Odyssey makes an event's tags count like any other card's.
      eventTagsCounted: thisPlayer.value.tableau.some((c) => c.name === CardName.ODYSSEY),
      // What the play arms for the next card (TR49 class) — the server's reading, named before the press.
      arms: preview.value?.arms,
      // A play that IS a pass (class CT): the pass confirm's own reading, named before the press.
      passes: playPasses.value ? (props.passReading ?? {lines: []}) : undefined,
    },
    // The repeat slot IS the meaningful result for ProjectInspection — count
    // it so the block is never the misleading "applied after confirming".
    // A skipped-effect WARNING counts too: when the card's only on-play
    // content is an effect that will be lost, the fallback would promise
    // «применится после подтверждения» directly beside the warning saying
    // it will not — the block contradicting itself in two adjacent lines.
    {hasImmediate: hasImmediateResult.value, hasFollowUp: hasFollowUpResult.value},
  );
});
const hasImmediateResult = computed((): boolean => {
  return branches.value.some((b) => b.effects.length > 0 || b.reveal !== undefined);
});
/** Everything the block states about what happens AFTER the confirm —
 *  placement notes, the repeat slot, and the warnings that name a skipped
 *  effect. All three make the "applied after confirming" fallback a lie. */
const hasFollowUpResult = computed((): boolean => {
  return followUpNotes.value.length > 0 || repeatChoice.value !== undefined || warningSteps.value.length > 0;
});
// Skipped-effect warnings: WHICH effect is lost (title + muted chip) and why.
// Derived by the SAME shared helper the desktop modal uses, then translated —
// the two surfaces can never say different things about the same warning.
/** The optional choice's general branch is the play and its skips are named in the strip (PL-171). */
const variantLossesInStrip = computed((): boolean => {
  const sel = selectedBranch.value;
  return sel !== undefined && isGeneralBranch(sel, branches.value) && warningSteps.value.length > 0;
});
/** The card's printed global requirements under the player's modifiers (TR49 class) — the server's reading:
 *  the play preview's own (`forecast.modifiers`, versioned with the answer), else the hand card's. */
const requirementEasings = computed((): ReadonlyArray<RequirementEasingModel> => {
  return forecast.value?.modifiers?.easings ??
    props.playerView.cardsInHand.find((c) => c.name === props.cardName)?.requirementEasing ?? [];
});
const requirementViews = computed((): ReadonlyArray<ComposerRequirementView> => {
  return composerRequirementViews(requirementEasings.value);
});
/** The armed one-play effects this play spends FOR NOTHING (decision 7) — named, never blocking. */
const wastedConsumes = computed((): ReadonlyArray<ComposerConsumeNote> => {
  return composerConsumeNotes(forecast.value?.modifiers).filter((c) => !c.used);
});
const warningSteps = computed((): Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> => {
  const out: Array<{title: string, reason: string, effect?: ActionEffect, icon: string}> = [];
  for (const b of branches.value) {
    if (!b.available && b !== selectedBranch.value) {
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
    // A tile the standing law REPLACES (RX35) is NOT placed — said in words, never by the strike alone.
    out.push(...divertedTileWarnings(b.effects));
  }
  // The merged up-to-N pick (Astra) explicitly answered EMPTY: legal
  // (min 0) but easy to do by accident — the branch's emptyWarning makes
  // it a conscious choice BEFORE submit (the desktop popup, console-shaped).
  const sel = selectedBranch.value;
  const emptyWarning = sel?.mergeCardSteps?.emptyWarning;
  if (emptyWarning !== undefined) {
    const host = stepChoices.value.find((c) => isMergedPickChoice(c));
    if (host !== undefined && multiPicks.value[host.id]?.length === 0) {
      out.push({title: '', reason: textOf(emptyWarning), icon: ''});
    }
  }
  // (The TABLE's skipped reactions are NOT this strip's business: this
  // strip names the CARD's own lost effects. A reaction of yours that has
  // nowhere to apply stands in the «Сработает» row as a struck chip with
  // a «⚠» badge; a foreign seat's non-event is only the layer's
  // «Пропустится». The amber block here once carried an opponent's
  // Neptunian «cannot afford 5 M€» — a different surface's language for
  // something that was not even the viewer's loss.)
  return out;
});
const followUpNotes = computed((): Array<NextStepRow> => {
  const b = selectedBranch.value;
  if (b === undefined) {
    // A table question handed on is the PLAY's, not a variant's (TR51 — card-level pre-steps): it is named before
    // any variant is chosen too.
    return followUpChoices.value.flatMap((c) => c.reaction !== undefined ? [reactionFollowUpRow(c)] : []);
  }
  const out: Array<NextStepRow> = [];
  if (b.reveal !== undefined) {
    out.push(noteRow(translateText('Reveal a card')));
  }
  // A FILTERED DRAW's process (TR32): «Добор — колода вскрывается, пока не наберётся совпадений: 3 · без меток …» —
  // the rule from the chip's own server descriptor, first: the search runs in the press's own answer.
  out.push(...searchRows(immediateEffects.value, (key, params) => translateTextWithParams(key, [...params])));
  for (const s of b.steps) {
    if (s.kind === 'boardPlacement') {
      // WHICH tile — named, and «особый тайл» first when it is one. The
      // wording lives in `consolePlacementNextStep`, never here.
      out.push(placementRow(s, consoleTranslate, textOf));
    } else if (s.kind === 'note' && s.noteKind !== 'warning') {
      out.push(noteRow(s.text !== undefined ? textOf(s.text) : translateText('Choose a target')));
    } else if (s.kind === 'delegateGrant') {
      // THE DOOR's own row: the name of the step («Резолюция — выбор в Парламенте»), never a guess
      // about what it will pay — the support of a party depends on the resolution not yet chosen.
      const key = playDoorNextStepKey({kind: 'parliament', staged: s.staged, mode: 'vote'});
      if (key !== undefined) {
        out.push(noteRow(translateText(key)));
      }
    } else if (s.kind === 'delegateGrantFollowUp') {
      // THEN — the LIVE grant after the commit (T03): «Затем: 2 делегата на одну резолюцию — выбор в Парламенте»,
      // the count the server's, the resolution chosen where its forecast reads.
      out.push(noteRow(nextRowText(delegateGrantFollowUpRow(s), ROW_TRANSLATOR)));
    } else if (s.kind === 'supportDiscard') {
      // THE SUPPORT-AREA DOOR's own row (TR12): «Область поддержки — выбор в Парламенте» — what leaves which
      // area is read on each plaque in the Parliament («3 → 0»), never guessed here before the area is chosen.
      const key = playDoorNextStepKey({kind: 'parliament', staged: s.staged, mode: 'support'});
      if (key !== undefined) {
        out.push(noteRow(translateText(key)));
      }
    } else if (s.kind === 'delegateRemoval') {
      // THE DELEGATE DOOR's own row (TR72): «Делегат — выбор в Парламенте» — whose figure leaves and what it
      // changes is read on the figure in the Parliament, never guessed here before it is chosen.
      const key = playDoorNextStepKey({kind: 'parliament', staged: s.staged, mode: 'delegate'});
      if (key !== undefined) {
        out.push(noteRow(translateText(key)));
      }
    } else if (s.kind === 'colonyPick') {
      // THE COLONY DOOR's own row (TR07): «Трек колонии — выбор в «Колониях»» — where the marker lands is
      // read on each tile of the grid, never guessed here before the tile is chosen.
      const key = playDoorNextStepKey({kind: 'colonies', staged: s.staged});
      if (key !== undefined) {
        out.push(noteRow(translateText(key)));
      }
    } else if (s.kind === 'agendaWalk') {
      // THE SHOW STEP's own rows (TR04): the name of the coming stage and what the marker will do there — from
      // the server's own reading of the walk, the cut at the track's end named («1 из 2 · конец трека»); at the
      // end itself (TR37, walked 0) only the cut; a COUNTED walk (TR42) its WHY first — the threshold
      // breakdown in the Parliament's own words (`agendaWalkNextRows` — pure, spec'd).
      for (const row of agendaWalkNextRows(s.walk)) {
        out.push(noteRow(nextRowText(row, ROW_TRANSLATOR)));
      }
    } else if (s.kind === 'neutralRally') {
      // THE SHOW STEP's own rows (TR31): the coming stage, then EVERYTHING the server's plan says, one row per
      // object — each resolution with its votes and the political consequence, each party's area with its room
      // (a named zero in the quiet register), the neutral delegates in use before → after. Rows, not one prose
      // line: six parts never fit one band on fhd, and a cut sentence is a lie by omission.
      out.push(...rallyRows(s.rally));
    }
    // `tabbedTargets` is now PRE-COLLECTED inline (a decision row) — no note.
  }
  for (const c of followUpChoices.value) {
    // A collapsed merge slot is HOSTED by the first slot's multi pick —
    // never a bogus "after confirming" note.
    if (isCollapsedMergeStep(c)) {
      continue;
    }
    // A table question handed on says so in its asker's name.
    if (c.reaction !== undefined) {
      out.push(reactionFollowUpRow(c));
      continue;
    }
    const t = textOf(c.input.title);
    out.push(noteRow(t !== '' ? t : translateText('Choose a target')));
  }
  return out;
});
// ── confirm gating ──────────────────────────────────────────────────
const canConfirm = computed((): boolean => {
  if (loading.value) {
    return false;
  }
  const b = selectedBranch.value;
  if (b === undefined || !b.available || !paymentReady.value) {
    return false;
  }
  // The repeat-action slot (ProjectInspection) must be filled first.
  if (repeatChoice.value !== undefined && repeatResult.value === undefined) {
    return false;
  }
  // EVERY pre-collectable choice (inline sub / hand pick — incl. a
  // multi-select hand pick, where even an "empty" answer is an explicit
  // visit) must be captured; follow-up choices ride the native flow.
  if (stepChoices.value.some((c) => stepMissing(c))) {
    return false;
  }
  // A tabbedTargets step (Virus) is pre-collected — require its capture.
  return b.steps.every((step, i) => step.kind !== 'tabbedTargets' || captured.value[i] !== undefined);
});
const ctaReady = computed((): boolean => {
  return primaryActionState.value.kind === 'ready';
});
/**
 * THE DOOR of the chosen branch (`playDoorOf` — the one classification): a
 * staged board placement, or the Parliament's vote mode for a card that
 * places a delegate by being played. The CTA, the bar, the «next step» row
 * and the confirm payload all read this.
 */
const playDoor = computed((): PlayDoor | undefined => {
  return playDoorOf(selectedBranch.value);
});
/** This play counts as a pass (the server's structural mark — class CT): the verb and the «ЭТО ПАС» row read it. */
const playPasses = computed((): boolean => {
  return preview.value?.passes === true;
});
/** The big CTA strip label — the primary action in words. */
const ctaLabel = computed((): string => {
  const st = primaryActionState.value;
  switch (st.kind) {
  case 'ready': return playCommitVerb(playDoor.value, playPasses.value);
  // Calm INSTRUCTION, not a refusal: the rail says what the screen is
  // waiting for instead of dangling a live «Разыграть карту» over a result
  // the player has not chosen.
  case 'need-variant': return 'Choose the result first';
  // The rail names the FIRST question still open in the words its own row uses («Выберите
  // карту-получатель»), never the generic «Choose an option» — whose RU «Выберите вариант» on a screen
  // with an «ИЛИ» row read as «choose the variant» over a variant already chosen (TR43).
  case 'need-preselect': {
    const open = decisionRows.value.find((row) => rowMissing(row));
    return open !== undefined ? rowVerb(open) : 'Choose an option';
  }
  case 'blocked-payment': return 'Not enough resources';
  case 'blocked-requirement': return st.reason;
  }
});
/**
 * The CTA strip while the payment EDITOR is open: the same row, same place,
 * but it now confirms the payment («Готово») instead of the play — so the
 * expanded state always shows the player the way back into the main flow,
 * and the strip never has to unmount (which would move the column).
 */
/**
 * THE COMMIT NAMES WHAT IS LEFT OF A SERIES (PC04 · GS): while the open question is a member of a series, the plate
 * reads the number of answers still owed («Осталось ответов: 2»), never the first row's verb alone — '' otherwise.
 */
const ctaSeriesLeft = computed((): string => {
  if (payExpanded.value || primaryActionState.value.kind !== 'need-preselect') {
    return '';
  }
  const missing = decisionRows.value.filter((row) => rowMissing(row));
  const open = missing[0];
  if (open === undefined || open.kind !== 'step' || choiceSeriesOf(open.choice.input) === undefined || missing.length < 2) {
    return '';
  }
  return translateTextWithParams('Answers left: ${0}', [String(missing.length)]);
});
const ctaDisplayLabel = computed((): string => {
  if (payExpanded.value) {
    return paymentReady.value ? 'Done' : 'Not enough resources';
  }
  return ctaLabel.value;
});
const ctaDisplayReady = computed((): boolean => {
  return payExpanded.value ? paymentReady.value : ctaReady.value;
});
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
const ctaBlockedReason = computed((): string => {
  if (payExpanded.value || submitting.value) {
    return '';
  }
  const st = primaryActionState.value;
  // A rules-blocked branch offers NO choice — the server's own reason is
  // the only honest thing to say (the same string the variant row shows).
  return st.kind === 'blocked-requirement' ?
    st.reason :
    (st.kind === 'blocked-payment' ? 'Not enough resources' : '');
});
const focusedKind = computed((): PlayFocusKind => {
  const row = focusedRow.value;
  if (row === undefined || row.kind !== 'step') {
    return row?.kind === 'variant' ? 'variant' : 'none';
  }
  if (row.choice.kind === 'amount') {
    return 'amount';
  }
  if (row.choice.kind === 'spendHeat') {
    return 'spendHeat';
  }
  if (row.choice.kind === 'distribute') {
    return 'distribute';
  }
  return 'pick';
});
/**
 * The A-button verb for the FOCUSED row. The decision itself is
 * `playPrimaryVerb` (pure, unit-tested); this only reports which row the
 * cursor is on. The ROW's own affordance reads the same focus, so the
 * command bar and the row can never advertise different verbs.
 */
const primaryFooter = computed((): {label: string, enabled: boolean} => {
  const row = focusedRow.value;
  const focused: PlayFocusTarget = row === undefined ?
    'none' :
    // A VARIANT is its own target: A there says «ВЫБРАТЬ» and does exactly
    // that. It used to fall through to «ДАЛЕЕ», which named neither the
    // press's effect nor its consequence.
    (row.kind === 'cta' ? 'cta' : (row.kind === 'variant' ? 'variant' : (focusedOpensPicker.value ? 'picker' : 'other')));
  return playPrimaryVerb({
    focused,
    // ANSWERED, not «not missing»: a table question left for after the draw holds nothing up and has no answer.
    pickAnswered: row !== undefined && !rowMissing(row) && !(row.kind === 'step' && stepUnanswered(row.choice)),
    pickDeferred: row?.kind === 'step' && row.choice.reaction !== undefined && tableRowState(row.choice).kind === 'deferred',
    primary: primaryActionState.value,
    // ONE verb for the rail and the bar (T14 · CC): the press names itself in the bar exactly as on the rail —
    // «Разыграть карту», «Разыграть на поле», «Выбрать резолюцию» — never a shorter second promise beside it.
    doorVerb: playCommitVerb(playDoor.value, playPasses.value),
  });
});
/** The focused row opens a sub-picker on A (card/player/or step or tabbed) —
 *  A = «Выбрать»/«Изменить» there, never «Разыграть». */
/** THE INNER STEP'S BAR (P89 · EM): D-pad · A (choose / +1 here / confirm) · LB/RB one unit · RT the rest · B back. */
const venusFootHints = computed((): Array<FootHint> => {
  const subNow = sub.value;
  const c = venusSubChoice.value;
  const meta = c === undefined ? undefined : venusBonusMetaOf(c.input);
  if (subNow?.kind !== 'venus' || c === undefined || meta === undefined) {
    return [];
  }
  return venusInnerFootHints(venusInnerBar(meta, venusPartsOf(c), subNow.focus));
});
/** The viewer's stock per standard resource — the Venus spread's «current → resulting» (P89 · EL). */
const venusStock = computed((): Partial<Record<string, number>> => {
  return Object.fromEntries(VENUS_SPREAD_LANES.map((key) => [key, playerResourceValue(thisPlayer.value, key, 'stock') ?? 0]));
});
const focusedOpensPicker = computed((): boolean => {
  const row = focusedRow.value;
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
  // The Venus bonus's row is a DOOR into its inner step (P89 · EM) — A «Выбрать» / «Изменить».
  return row.kind === 'step' &&
    (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or' || row.choice.kind === 'venusBonus');
});
const footHints = computed((): Array<FootHint> => {
  // THE VENUS BONUS'S INNER STEP owns the bar — the pure model's reading (P89 · EM).
  if (sub.value?.kind === 'venus') {
    return venusFootHints.value;
  }
  // The R3 «Эффекты» LAYER owns the bar while it is open — the explorer's
  // own contract, verbatim (the same way the Information workspace
  // republishes it). Nothing of the review's verbs applies underneath.
  if (fxOpen.value) {
    return (forecastUi.value.barCommands ?? []).map((c) => ({
      control: c.control, control2: c.control2, label: c.label, enabled: c.enabled, spread: c.spread,
    }));
  }
  // A focused amount/spend-heat stepper OWNS LB/RB; otherwise the inline
  // payment quick-adjust does (when eligible).
  const focusedStepper = focusedKind.value === 'amount' || focusedKind.value === 'spendHeat' || focusedKind.value === 'distribute';
  const row = quickAdjustChip.value;
  const quickAdjust = (!focusedStepper && row !== undefined) ?
    {canDecrease: row.canDecrease, canIncrease: row.canIncrease} : undefined;
  return playComposerFootHints({
    // Every list-like sub (list / orNested / tabbed) shares the pick contract;
    // the embedded played-target step has its own (D-pad + owner tabs).
    sub: sub.value === undefined ?
      'none' :
      (sub.value.kind === 'payment' ? 'payment' : (sub.value.kind === 'playedTarget' ? 'playedTarget' : 'list')),
    targetOwnerTabs: (playedTargetLayout.value.mode === 'tabs' || playedTargetLayout.value.mode === 'board') && (playedTargetModel.value?.owners.length ?? 0) > 1,
    targetBlocked: sub.value?.kind === 'playedTarget' &&
      playedTargetAt(sub.value.focus, playedTargetModel.value?.owners ?? [])?.blocked !== undefined,
    targetNoInspect: sub.value?.kind === 'playedTarget' &&
      playedTargetAt(sub.value.focus, playedTargetModel.value?.owners ?? [])?.stand !== undefined,
    targetMulti: playedTargetSelection.value.mode === 'multi' ? {
      count: playedTargetSelection.value.picked.length,
      valid: playedTargetPicksValid(playedTargetSelection.value),
      verb: (playedTargetChoice.value?.input as SelectCardModel | undefined)?.buttonLabel || 'Select',
    } : undefined,
    subIsCardList: subChoice.value?.input.type === 'card' || sub.value?.kind === 'orNested' || sub.value?.kind === 'tabbed',
    // The open choice's DECLINE — RT, with the refusal's own words.
    decline: subDecline.value !== undefined ? textOf(subDecline.value.label) : undefined,
    // More than the lone CTA row → there's something to navigate between.
    hasRows: rows.value.length > 1,
    focusedKind: focusedKind.value,
    paymentEditor: payEditorAvailable.value,
    paymentReady: paymentReady.value,
    primaryLabel: primaryFooter.value.label,
    primaryEnabled: primaryFooter.value.enabled,
    quickAdjust,
    distributeLeft: focusedRow.value?.kind === 'step' && focusedRow.value.choice.kind === 'distribute' ?
      laneRemaining(focusedRow.value.choice) : undefined,
    forecast: forecastCanOpen.value,
    boardPeek: sub.value === undefined && peekable(countWhy.value),
    boardPeekOpen: boardPeekUi.peek !== undefined,
    // The radiogroup's live axis — «◄► Вариант» while the cursor stands in
    // a side-by-side group.
    variantAxis: focusedKind.value === 'variant' ? variantAxis.value : undefined,
    variantPalette: variantPalette.value,
  });
});
// ── sub-state derived views ─────────────────────────────────────────
const subChoice = computed((): ComposerChoice | undefined => {
  if (sub.value === undefined || (sub.value.kind !== 'list' && sub.value.kind !== 'orNested')) {
    return undefined;
  }
  return stepChoices.value.find((c) => c.id === (sub.value as {choiceId: string}).choiceId);
});
const subTitle = computed((): string => {
  if (sub.value?.kind === 'tabbed') {
    return translateText('Choose a target');
  }
  if (sub.value?.kind === 'orNested') {
    return textOf(sub.value.item.label);
  }
  const c = subChoice.value;
  return c !== undefined ? choiceTitle(c) : '';
});
/** The pre-collectable tabbedTargets steps (Virus) of the selected branch. */
const tabbedSteps = computed((): Array<{index: number, step: TabbedTargetsStep}> => {
  return tabbedStepsOf(selectedBranch.value);
});
const listItems = computed((): ReadonlyArray<ListItem> => {
  const subNow = sub.value;
  if (subNow === undefined) {
    return [];
  }
  // TABBED targets (Virus: remove ≤2 animals OR ≤5 plants) — a flat list.
  if (subNow.kind === 'tabbed') {
    const ts = tabbedSteps.value.find((t) => t.index === subNow.stepIndex);
    if (ts === undefined) {
      return [];
    }
    const chosenKey = picks.value['tabbed#' + subNow.stepIndex];
    const targets = tabbedTargets(ts.step);
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
  if (subNow.kind === 'orNested') {
    return nestedItems(subNow.item);
  }
  const c = subChoice.value;
  if (c === undefined) {
    return [];
  }
  if (c.input.type === 'card') {
    const model = c.input as SelectCardModel;
    const chosenName = picks.value[c.id];
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
    return playerItems(c.input as SelectPlayerModel, picks.value[c.id]);
  }
  // PREMIUM or list — each option's metadata chips + player + nested indicator. An OPTIONAL choice's decline is
  // not one of them: it is the button (RT) and the plate in the question line (`subDecline`).
  if (c.input.type === 'or') {
    const chosen = picks.value[c.id];
    const declineAt = choiceDecline(c)?.index;
    return buildOrItems(c.input as OrOptionsModel).filter((it) => it.optionIndex !== declineAt).map((it): ListItem => ({
      key: it.key, label: textOf(it.label), meta: '', disabled: it.disabled, reason: textOf(it.reason),
      chosen: chosen === String(it.optionIndex), color: it.playerColor, chips: it.chips,
      warnings: it.warnings, orItem: it,
    }));
  }
  return [];
});
/**
 * THE DECLINE of the open sub-surface's optional choice (`optionalChoice.ts`): the plate in its question line and
 * RT. A nested list carries it only when that list IS the choice's one answer (the pick opened directly).
 */
const subDecline = computed((): DeclineModel | undefined => {
  const subNow = sub.value;
  if (subNow?.kind === 'tabbed') {
    // A tabbed removal (Virus) declares its own refusal on the step.
    const decline = tabbedSteps.value.find((t) => t.index === subNow.stepIndex)?.step.decline;
    return decline !== undefined ? {index: decline.optionIndex, label: decline.label, forgone: []} : undefined;
  }
  // A played-target step carries it only on a SINGLE pick answering an or-option (a merged up-to-N ask spends RT
  // on its own submit) — the action composer's rule, one grammar for both.
  if (subNow?.kind === 'playedTarget' && subNow.tabbed !== undefined) {
    // Virus's one zone: the step declares its own refusal.
    const decline = tabbedSteps.value.find((t) => t.index === subNow.tabbed)?.step.decline;
    return decline !== undefined ? {index: decline.optionIndex, label: decline.label, forgone: []} : undefined;
  }
  if (subNow?.kind === 'playedTarget') {
    const pc = playedTargetChoice.value;
    return pc !== undefined && subNow.orItem !== undefined && playedTargetSelection.value.mode !== 'multi' ? choiceDecline(pc) : undefined;
  }
  const c = subChoice.value;
  if (subNow === undefined || c === undefined || (subNow.kind !== 'list' && subNow.kind !== 'orNested')) {
    return undefined;
  }
  return choiceDecline(c);
});

/**
 * The composer's root element — what the shell's controllers fade when a staged play lets the composer go
 * (`outcomeController` · `playCardController`). An EXPOSED FUNCTION, not a reach into this component's own refs from
 * outside: a parent's ref of a `<script setup>` component carries only what the component exposes (`defineExpose`
 * below — `docs/claude/vapor/ROADMAP.md` §1.1).
 */
function composerRootEl(): HTMLElement | undefined {
  return rootEl.value ?? undefined;
}
/** The chip whose basis the «ПОЧЕМУ» strip reads (TR45): the same pool — the strip, not the chip, says why. */
function basisReadByStrip(eff: ActionEffect): boolean {
  const chip = countWhy.value?.chip;
  return chip !== undefined && eff.basis !== undefined && eff.icon === chip.icon && eff.note === chip.note && eff.direction === chip.direction;
}
/** The «⚡ сработает» chips drawn INSIDE a variant card (the pure model). */
function variantReactions(pos: number): VariantReaction {
  return variantReactionChips(forecast.value, pos);
}
/**
 * The radiogroup's AXIS, read off the rendered geometry: every option card
 * at the same `offsetTop` ⇒ one row (←→ switch), else the container query
 * has stacked them ⇒ a column (↑↓ walk). Measured, never a duplicated
 * breakpoint — the cluster's width depends on the profile, the hand dock
 * and the nesting depth, which no JS constant knows.
 */
/** The radiogroup's root element (the ref is a component). */
function variantsRoot(): HTMLElement | undefined {
  return rootElOf(variantsEl.value);
}
function measureVariantAxis(): void {
  const el = variantsRoot();
  if (el === undefined || el === null) {
    variantAxis.value = 'row';
    return;
  }
  const cards = Array.from(el.querySelectorAll<HTMLElement>('.con-vchoice__opt'));
  const tops = [...new Set(cards.map((card) => Math.round(card.offsetTop)))].sort((a, b) => a - b);
  // A PALETTE folded into rows (3 + 3) is a GRID — ←→ in a row, ↑↓ between rows; any other stacked group a column.
  variantGridRows.value = variantPalette.value && tops.length > 1 ? cards.map((card) => tops.indexOf(Math.round(card.offsetTop))) : [];
  variantAxis.value = tops.length <= 1 ? 'row' : variantGridRows.value.length > 0 ? 'grid' : 'column';
}
/** Re-measure on every resize of the group's box (a profile switch, the
 *  rail lifting, a font settling) — the responsive path, never a window
 *  listener. Re-armed whenever a preview lands (the group may mount). */
function armVariantObserver(): void {
  stopVariantObs?.();
  stopVariantObs = undefined;
  const el = variantsRoot();
  if (el === undefined || el === null) {
    variantAxis.value = 'row';
    return;
  }
  stopVariantObs = useResizeObserver(el, () => measureVariantAxis()).stop;
  measureVariantAxis();
}
/**
 * R3 / a click on the «Сработает» row — the WORKSPACE DESCEND into the
 * layer. The row's rect is armed SYNCHRONOUSLY here (armed rects expire in
 * 1 s), the row pulses its commit, and the seats' stats are asked for the
 * layer's quiet «За партию» line (version-keyed — a repeat costs nothing).
 */
function openForecastLayer(): void {
  if (!forecastCanOpen.value || fxOpen.value) {
    return;
  }
  const root = composerRootEl();
  armForecastRow(descendRectOf(root?.querySelector<HTMLElement>('[data-forecast-row]')));
  forecastPulse.value = true;
  flow.after(320, 'the forecast row\'s commit pulse ends', () => {
    forecastPulse.value = false;
  });
  for (const color of forecastOwnerColors.value) {
    ensureEffectStats(props.playerView, color as Color);
  }
  openEffectForecastLayer('play');
}
function closeForecastLayer(): void {
  if (fxOpen.value) {
    closeEffectForecastLayer('play');
  }
}
/** Input while the layer is open: B folds one level (the explorer's own
 *  dossier first), R3 closes the whole layer, everything else is the
 *  explorer's (d-pad, LT/RT sections, A, X, LB/RB, RS). */
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
/**
 * Re-arm the confirm CTA after a REFUSED submit (the played-card hero
 * transaction keeps this composer open through the server round-trip;
 * on error the shell calls this so the player can retry or cancel —
 * a successful play unmounts the composer instead).
 */
function resetSubmitting(): void {
  submitting.value = false;
  answeredFor.value = undefined;
}
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
function runPlaystageRelease(): void {
  const el = playstage.value ?? undefined;
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
}
function iconClass(icon: string | undefined): string {
  return icon !== undefined ? iconClassFor(icon) : '';
}
/** One line of the pass reading, exactly as the pass confirm prints it («key: N»). */
function passLineText(line: PassLine): string {
  return line.count !== undefined ? `${translateText(line.key)}: ${line.count}` : translateText(line.key);
}
/** The VP projection formula's counted OBJECT when the unit is no tag (a space city — TR22): the score explorer's own glyph, 0 or 1. */
function formulaCountGlyphs(formula: ScoreFormula): Array<CountedObjectGlyph> {
  const glyph = formulaGlyph(formula);
  return glyph?.kind === 'counted' ? [glyph.glyph] : [];
}
function vpDetail(sec: PlayResultSection): string {
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
}
/** The version-change re-ask (see the `stateVersion` watcher): same URL,
 *  same cache feed, but the answer lands WITHOUT `applyPreview` — nothing
 *  the player has done is reset — and only when its shape matches. */
function refreshPreview(): void {
  const cardName = props.cardName;
  fetch(playPreviewUrl(props.playerView.id, cardName))
    .then((r) => (r.ok ? r.json() : undefined))
    .then((p) => {
      const next = p as ActionPreview | undefined;
      if (next === undefined || props.cardName !== cardName || submitting.value) {
        return;
      }
      storeHandPlayPreview(props.playerView, cardName, next);
      if (samePreviewShape(preview.value, next)) {
        preview.value = next;
        reseatSeeds();
      }
    })
    .catch(() => { /* the standing preview stays — nothing to roll back */ });
}
/**
 * A refetched preview of the SAME shape keeps every answer — but a SEED is a reading of the server's candidate set
 * (T14 · CC), and the set may have moved: a seed whose candidate left, or is no longer alone, lets go (the row is
 * open again and holds the commit — the cursor goes to it by the ONE rule); a row that has just become a sole
 * candidate is seeded. Never touches an answer the player gave.
 */
function reseatSeeds(): void {
  let changed = false;
  for (const c of stepChoices.value) {
    // A row seeded with ALL its candidates (ledger CU) holds while the same set is still the whole answer.
    if (seeded.value[c.id] === 'all') {
      const all = allSeedOf(c);
      if (all !== undefined && sameCardNames(all, multiPicks.value[c.id] ?? [])) {
        continue;
      }
      captureFor(c, undefined);
      const {[c.id]: _pick, ...picksNow} = picks.value;
      const {[c.id]: _multi, ...multiPicksNow} = multiPicks.value;
      const {[c.id]: _seed, ...seededNow} = seeded.value;
      picks.value = picksNow;
      multiPicks.value = multiPicksNow;
      seeded.value = seededNow;
      changed = true;
      continue;
    }
    if (seeded.value[c.id] !== 'sole') {
      continue;
    }
    const seed = soleCandidateOf(c, soleViewer.value);
    if (seed !== undefined && seedHolds(c, seed)) {
      continue;
    }
    captureFor(c, undefined);
    const {[c.id]: _pick, [nestedPickKey(c.id)]: _nested, ...picksNow} = picks.value;
    const {[c.id]: _result, ...results} = playedTargetResults.value;
    const {[c.id]: _seed, ...seededNow} = seeded.value;
    picks.value = picksNow;
    playedTargetResults.value = results;
    seeded.value = seededNow;
    changed = true;
  }
  const before = Object.keys(seeded.value).length;
  for (const c of stepChoices.value) {
    seedSole(c);
  }
  if (changed || Object.keys(seeded.value).length !== before) {
    landCursor();
    scrollFocused();
  }
}
/**
 * THE LATE CONTENT ENTERS (PL-510) — called a tick after the preview landed on a cache miss, before that patch can
 * paint: every group of the review (`[data-unfold-item]` — the result hero, the rows, the payment, the commit row)
 * rises in reading order — opacity + a small rise, the workspace descend's own figure — and the cursor ARRIVES once
 * the last has. Web Animations, never a main-thread tween: the late content lands exactly when the main thread is
 * busiest (the review's first layout at 4K), and a JS-driven cascade there advanced in ~110 ms jumps — its last
 * group, on a front-loaded curve, appeared in ONE frame. Compositor-driven, the rise keeps the display's cadence;
 * `fill: backwards` paints the first frame at the from-state. A hand stage still ARMING owns its entry (its own
 * cascade takes the groups and its entry gate holds the cursor) — the hold is simply handed back.
 */
function arriveLateContent(): void {
  const root = composerRootEl();
  if (root === undefined || consoleReducedMotionActive() || root.closest('.con-hand__stage--arming') !== null ||
      typeof root.animate !== 'function') {
    arriveCursor(lateCursor.value);
    return;
  }
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-unfold-item]'))
    .filter((el) => el.closest('.con-composer') === root && el.getClientRects().length > 0);
  if (items.length === 0) {
    arriveCursor(lateCursor.value);
    return;
  }
  lateCascade.forEach((a) => a.cancel());
  const rise = 9 * conUiScale();
  const duration = motionMs(260);
  const stagger = motionMs(45);
  lateCascade = items.map((el, i) => el.animate(
    [{opacity: 0, transform: `translateY(${rise}px)`}, {opacity: 1, transform: 'none'}],
    {duration, delay: i * stagger, easing: MOTION_EASE.standard, fill: 'backwards'}));
  const last = lateCascade[lateCascade.length - 1];
  const arrive = () => {
    lateCascade = [];
    arriveCursor(lateCursor.value);
  };
  last.onfinish = arrive;
  last.oncancel = arrive;
}
function fetchPreview(): void {
  const cardName = props.cardName;
  // ONE URL builder with the prewarm — the warmed request and the live
  // request can never drift apart.
  fetch(playPreviewUrl(props.playerView.id, cardName))
    .then((r) => (r.ok ? r.json() : undefined))
    .then((p) => {
      // Feed the prewarm cache too: a pick-bridge return or a re-open in
      // the same game state remounts content-complete.
      storeHandPlayPreview(props.playerView, cardName, p as ActionPreview | undefined);
      if (props.cardName === cardName) {
        // The content mounts in THIS flush — the cursor's pose is held before it can paint with it (PL-510).
        const late = loading.value;
        if (late) {
          holdCursor(lateCursor.value);
        }
        preview.value = p as ActionPreview | undefined;
        loading.value = false;
        applyPreview();
        if (late) {
          nextTick(() => arriveLateContent());
        }
      }
    })
    .catch(() => {
      if (props.cardName === cardName) {
        loading.value = false;
        applyPreview();
      }
    });
}
function resetCaptures(): void {
  selectedPos.value = undefined;
  capturedPre.value = {};
  capturedOption.value = undefined;
  captured.value = {};
  venusParts.value = {};
  amounts.value = {};
  floaters.value = {};
  picks.value = {};
  multiPicks.value = {};
  repeatResult.value = undefined;
  sub.value = undefined;
  handPickOpen.value = undefined;
  submitting.value = false;
  answeredFor.value = undefined;
}
function applyPreview(): void {
  // NO auto-select where there is a real ИЛИ choice (`initialVariantSelection`
  // — pure, and the ONE place the rule lives). The screen used to open with a
  // branch already selected, the commit rail already live, and one A played
  // the card on a result the player had never chosen. A seeded selection is
  // an answer nobody gave.
  selectedPos.value = initialVariantSelection(branches.value);
  seeded.value = {};
  seedChoiceDefaults();
  // The ONE cursor rule, at the open: a screen with nothing to ask opens ON the commit — an ARRIVAL with the
  // decision's first settle under it (the A that opened the composer never plays the card).
  landCursor({opening: true});
  // The radiogroup (if any) renders in the next patch — learn its axis then.
  void nextTick(() => armVariantObserver());
  // STAGED PLAY return (B from the board): the player's own captures beat
  // the fresh seeding — the round trip must land them exactly where they
  // left. One-shot by contract; nothing was submitted in between, so the
  // preview (version-cached) and the step indexes are the same shape.
  const draft = takePlayComposerStagedDraft(props.cardName);
  if (draft !== undefined) {
    selectedPos.value = draft.selectedPos;
    capturedPre.value = {...draft.capturedPre};
    capturedOption.value = draft.capturedOption;
    captured.value = {...draft.captured};
    amounts.value = {...draft.amounts};
    floaters.value = {...draft.floaters};
    picks.value = {...draft.picks};
    multiPicks.value = {...draft.multiPicks};
    payCounts.value = {...draft.payCounts} as Partial<Record<SpendableResource, number>>;
    playedTargetResults.value = {...draft.playedTargetResults} as Record<string, PlayedTargetResult>;
    seeded.value = {...(draft.seeded ?? {})};
    focusIdx.value = draft.focusIdx;
    // The round trip lands the player where they left; back on the commit row it is an arrival again (the press
    // that brought them back is not the play).
    if (focusIdx.value === ctaIndex.value && commitAllowed(commitGate.value)) {
      arriveAtCommitRow(true);
    } else {
      leaveCommit(commitArrival.value);
    }
  }
  // Dev audit: a genuine preview gap (no immediate result, no follow-up) —
  // surface it once per load so it can be found and closed (audit contract).
  if (isFallbackOnlyResult(resultSections.value, {hasImmediate: hasImmediateResult.value, hasFollowUp: hasFollowUpResult.value})) {
    console.warn(`[console play] no computable preview for ${props.cardName} — showing fallback result`);
  }
}
/**
 * WHERE THE CURSOR GOES — the ONE rule (`nextCursorAfterAnswer`, T14 · ledger CC), asked on open and after EVERY
 * answer: the first row that holds the commit, else a table question that may wait for a draw and was not visited
 * yet (2026-10-15 — «and this one: now, or after the draw?» — it holds nothing up, but it IS the next question),
 * else the commit row. The questions outrank a payment that does not cover yet: a shortfall is fixed ON the commit
 * row (A opens the editor), so it is the commit row's reading only once nothing is left to ask.
 */
function cursorLanding(): CursorLanding | undefined {
  const offered = rows.value.findIndex((r) => r.kind === 'step' && r.choice.reaction !== undefined &&
    tableQuestionRowOffered(tableRowState(r.choice), offeredSeen.value[r.choice.id] === true));
  const questions = computeCommitGate({requirements: commitRequirements.value, submitting: submitting.value});
  return nextCursorAfterAnswer(questions.kind === 'ready' ? commitGate.value : questions, ctaIndex.value, offered);
}
/** The row the rule lands on (the current one while a press is in flight). */
function firstActionableIndex(): number {
  return cursorLanding()?.index ?? focusIdx.value;
}
/**
 * LAND THE CURSOR by the rule — the ONE call every answer ends with (a pick, a variant, «Далее», the payment's
 * «Готово», a decline, a bridge's answer) and the open's. A landing on a commit that RUNS is an ARRIVAL: the pose
 * arrives, the row breathes once and a press inside its window is the arrival, not the play (`commitArrival.ts`);
 * `opening` (the screen opened with nothing to ask) adds the decision family's first settle under it, so the A
 * that opened the composer never plays the card.
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
  arriveAtCommit(commitArrival.value, () => composerRootEl(), {opening});
}
/** The commit row's one breath ended (its layer's `animationend` — never a child's animation bubbling up). */
function onCommitBreathEnd(e: AnimationEvent): void {
  if (e.animationName === 'con-commit-armed') {
    endCommitBreath(commitArrival.value);
  }
}
/** The first row that holds up the commit (-1 = none). */
function firstMissingIndex(): number {
  return rows.value.findIndex((r) => rowMissing(r));
}
/** The A-verb a row publishes while it holds the cursor and is unanswered
 *  — the next real step, not the screen's eventual purpose. */
function rowVerb(row: PlayRow): string {
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
  case 'card': return row.kind === 'step' && (row.choice.input as SelectCardModel).discardPrompt !== undefined ?
    'Select a card to discard' : cardPickAskKey(row.kind === 'step' ? row.choice.amount : undefined);
  case 'player': return 'Choose a player';
  // An optional choice whose one answer is a pick IS that pick — its kind's verb, never «Choose an option».
  case 'or': return row.kind === 'step' ? optionalPickVerb(row.choice) : 'Choose an option';
  case 'spendHeat': return 'Heat sources';
  default: return 'Select';
  }
}
/** Whether a decision row is still unresolved. */
function rowMissing(row: PlayRow): boolean {
  if (row.kind === 'step') {
    return stepMissing(row.choice);
  }
  if (row.kind === 'tabbed') {
    return captured.value[row.stepIndex] === undefined;
  }
  if (row.kind === 'repeat') {
    return repeatResult.value === undefined;
  }
  if (row.kind === 'variant') {
    // THE ИЛИ CHOICE IS A REQUIREMENT. While it is unmade every CHOOSABLE
    // variant is outstanding, which is what makes the commit gate withhold
    // the cursor from the commit rail — the structural reason a second A
    // (a repeat, a held button) cannot reach the play. An unavailable
    // branch is NOT a requirement: there is nothing to answer there, and it
    // must not catch the opening cursor either.
    return variantChoicePending.value && branches.value[row.pos]?.available === true;
  }
  return false;
}
/** The tabbed targets (Virus) WITH each animal card's owner resolved — the
 *  ONE build point, so the rows, the folded answer and the pick can't
 *  disagree about what the player chose. */
function tabbedTargets(step: TabbedTargetsStep): ReadonlyArray<ConsoleTabbedTarget> {
  return buildTabbedTargets(step, (name) => cardOwner(name));
}
/**
 * WHO holds a played card, by name (cards are unique in a game). The server
 * models a card pick as bare names, so an attack on a CARD can only name its
 * victim from the live view — the same resolution the played-target picker
 * uses. Not on anyone's tableau ⇒ it is the viewer's (a hand / SRR-hosted
 * card), never a misleading "neutral".
 */
function cardOwner(name: string): TabbedCardOwner | undefined {
  const me = thisPlayer.value.color;
  const owner = props.playerView.players.find((p) => p.tableau.some((c) => c.name === name)) ??
    props.playerView.players.find((p) => p.color === me);
  return owner === undefined ?
    undefined :
    {color: owner.color, name: participantDisplayName(owner), self: owner.color === me};
}
/** The chosen tabbed-target's label (Virus) for the row, or '' when none.
 *  A CARD target carries its owner into the folded answer too — «from whom»
 *  is half the decision and must survive the sub-picker closing. */
function tabbedChosenLabel(stepIndex: number): string {
  const ts = tabbedSteps.value.find((t) => t.index === stepIndex);
  const key = picks.value['tabbed#' + stepIndex];
  if (ts === undefined || key === undefined) {
    return '';
  }
  if (key === TABBED_DECLINE_KEY) {
    return textOf(ts.step.decline?.label);
  }
  const target = tabbedTargets(ts.step).find((t) => t.key === key);
  if (target === undefined) {
    return '';
  }
  const label = translateText(target.label);
  return target.ownerName !== undefined ? `${label} · ${target.ownerName}` : label;
}
/** Premium player rows (with a per-target `current → resulting` impact). */
function playerItems(model: SelectPlayerModel, chosen: string | undefined): Array<ListItem> {
  const items: Array<ListItem> = model.players.map((color): ListItem => ({
    key: color, label: playerName(color), meta: '', disabled: false, reason: '', chosen: chosen === color, color,
    impact: playerImpact(model, color), impactIcon: model.icon,
    // «Это вы» — only when it is a LOSS and somebody else could have taken
    // it instead. Alone in the list it is forced, not a mistake.
    selfHarm: color === thisPlayer.value.color && model.players.length > 1 &&
      targetImpactIsLoss(playerImpactRows(model, color)),
  }));
  for (const d of model.disabledPlayers ?? []) {
    items.push({key: 'd' + d.color, label: playerName(d.color), meta: '', disabled: true, reason: textOf(d.reason), chosen: false, color: d.color});
  }
  return items;
}
/** The shared per-target rows — ONE derivation for the text and the verdict. */
function playerImpactRows(model: SelectPlayerModel, color: string): ReadonlyArray<TargetImpactChange> {
  return targetImpactRows(color as Color, {
    impacts: model.targetImpacts,
    icon: model.icon,
    amount: model.amount,
    scope: model.scope,
    player: props.playerView.players.find((p) => p.color === color),
  });
}
function playerImpact(model: SelectPlayerModel, color: string): string | undefined {
  // SERVER impacts first, then the shared derivation — hand-rolling the
  // field name here printed NOTHING for M€ / plants production (the model's
  // fields are singular) and the wrong numbers for a MarsBot target.
  const text = targetImpactText(targetImpactRows(color as Color, {
    impacts: model.targetImpacts,
    icon: model.icon,
    amount: model.amount,
    scope: model.scope,
    player: props.playerView.players.find((p) => p.color === color),
  }));
  return text !== '' ? text : undefined;
}
/** Candidate rows of a NESTED-input or option (Comet for Venus's SelectPlayer). */
function nestedItems(item: ConsoleOrItem): Array<ListItem> {
  const nested = item.nested;
  if (nested === undefined) {
    return [];
  }
  if (nested.type === 'player') {
    return playerItems(nested as SelectPlayerModel, undefined);
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
}
function seedChoiceDefaults(): void {
  for (const c of stepChoices.value) {
    seedChoice(c);
  }
}
function seedChoice(c: ComposerChoice): void {
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
  }
  // A card / player TARGET with ONE enabled candidate is SEEDED with it (T14 · CC, `soleCandidateOf`): shown
  // answered — where the resource goes, its `current → resulting` — and marked; A on the row still opens the
  // choice. A real choice (two candidates, an optional one, a range, a disabled lone one) opens unanswered.
  seedSole(c);
}
/**
 * SEED a sole candidate — the same capture a press would write (`confirmPlayedTarget` / `pickListItem` / the
 * album's answer), plus the `seeded` mark. Never over an answer already given (a staged draft, a variant switch
 * keeping the play's own `pre#` answers).
 */
function seedSole(c: ComposerChoice): void {
  // The bot alone in the table's one zone — its branch answered, the row marked «единственная цель».
  const tableSeed = stepUnanswered(c) ? soleCandidateOf(c, soleViewer.value) : undefined;
  if (tableSeed?.kind === 'tableBot') {
    picks.value = {...picks.value, [c.id]: soleSeedPick(tableSeed)};
    captureFor(c, soleSeedResponse(tableSeed));
    seeded.value = {...seeded.value, [c.id]: 'sole'};
    return;
  }
  // «You MAY also add 1 data to ANY card» with ONE holder of your own: the pick branch answered with it — the same
  // capture the target step's A writes; RT still declines.
  if (tableSeed?.kind === 'optionalCard') {
    if (seedOptionalCard(c, tableSeed)) {
      seeded.value = {...seeded.value, [c.id]: 'sole'};
    }
    return;
  }
  // A MERGED gain pick with no more candidates than seats, each a gain (P78, ledger CU): ALL of them — the same
  // capture «3 из 3» + RT would write — shown, marked «все цели»; A on the row opens the zone with them ticked.
  if (isMergedPickChoice(c)) {
    const all = stepUnanswered(c) ? allSeedOf(c) : undefined;
    if (all !== undefined) {
      multiPicks.value = {...multiPicks.value, [c.id]: all};
      picks.value = {...picks.value, [c.id]: String(all.length)};
      captureFor(c, {type: 'card', cards: [...all]});
      seeded.value = {...seeded.value, [c.id]: 'all'};
    }
    return;
  }
  const mode = choiceMode(c);
  // The espionage's synthetic owner rows (`esp-owner-*`) answer on the Hydronetwork's own stage and are folded into
  // ONE wire entry at the commit — never a capture of their own, so never a seed.
  if ((mode !== 'inline' && mode !== 'handPick' && mode !== 'playedTarget') || isMergedPickChoice(c) ||
      c.input.type === 'deltaEspionage' || c.id.startsWith('esp-owner') || !stepUnanswered(c)) {
    return;
  }
  const seed = soleCandidateOf(c, soleViewer.value);
  if (seed === undefined || seed.kind === 'tableBot' || seed.kind === 'optionalCard') {
    return;
  }
  if (seed.kind === 'player') {
    picks.value = {...picks.value, [c.id]: seed.color};
    captureFor(c, {type: 'player', player: seed.color});
  } else {
    if (mode === 'handPick') {
      // Two discards never name one card (`cardsHeldByOtherDiscards`): a card another row already holds is no seed.
      const model = c.input as SelectCardModel;
      if (model.discardPrompt !== undefined && cardsHeldByOtherDiscards(discardAnswers.value, c.id).has(seed.name)) {
        return;
      }
    }
    if (mode === 'playedTarget') {
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
 * ALL the candidates of a MERGED gain pick, when there is nothing to decide (`allCandidatesSeed` — P78, ledger CU):
 * no more of them than seats, none disabled, none the gain hurts (a falling VP reading, a PENALTY face). `undefined`
 * for «ask».
 */
function allSeedOf(c: ComposerChoice): ReadonlyArray<CardName> | undefined {
  if (!isMergedPickChoice(c)) {
    return undefined;
  }
  const model = c.input as SelectCardModel;
  const step = selectedBranch.value?.steps[c.index];
  return allCandidatesSeed({
    candidates: model.cards,
    max: mergeCardStepCount.value,
    amount: c.amount,
    vpBox: (step !== undefined && step.kind === 'input' ? step.vpBox : undefined) ?? model.resourceGainPrompt?.vpBox,
    penalty: (name) => getCard(name)?.victoryPointsSign === 'negative',
    declinable: choiceDecline(c) !== undefined,
  });
}
/**
 * The answered targets of a MERGED GAIN pick, each with what lands on it (P78, ledger CU): its own resource (the
 * server's per-candidate kind), `N → N+amount`, and the VP reading when the points move. Empty for any other row.
 */
function mergedGainTargets(c: ComposerChoice): ReadonlyArray<{name: string, label: string, icon: string, from: number, to: number, vp?: {from: number, to: number}}> {
  const picked = multiPicks.value[c.id];
  const amount = c.amount ?? 0;
  if (picked === undefined || picked.length === 0 || amount <= 0 || !isMergedPickChoice(c)) {
    return [];
  }
  const model = c.input as SelectCardModel;
  const step = selectedBranch.value?.steps[c.index];
  const vpBox = (step !== undefined && step.kind === 'input' ? step.vpBox : undefined) ?? model.resourceGainPrompt?.vpBox;
  return picked.map((name) => {
    const card = model.cards.find((cd) => cd.name === name);
    const from = card?.resources ?? 0;
    const vp = vpBox?.[name as CardName];
    return {
      name,
      label: translateCardName(name as CardName),
      icon: c.cardResource ?? model.resourceGainPrompt?.cardResourceByCard?.[name as CardName] ?? 'resource',
      from,
      to: from + amount,
      ...(vp !== undefined && vp.from !== vp.to ? {vp: {from: vp.from, to: vp.to}} : {}),
    };
  });
}
/**
 * The optional pick's seed — the nested branch answered with the lone holder (`picks` + its nested key, the target
 * result read off the SAME step model the target step draws for that branch). `false` = the branch is not drawable
 * here or the candidate stands refused — nothing is written.
 */
function seedOptionalCard(c: ComposerChoice, seed: Extract<SoleSeed, {kind: 'optionalCard'}>): boolean {
  const item = optionalPickItem(c);
  if (item === undefined || item.optionIndex !== seed.branch) {
    return false;
  }
  const owners = playedTargetModelFor(c, item)?.owners ?? [];
  const focus = findPlayedTargetFocus(seed.name, owners);
  const candidate = focus === undefined ? undefined : playedTargetAt(focus, owners);
  if (candidate?.blocked !== undefined) {
    return false;
  }
  if (candidate !== undefined) {
    playedTargetResults.value = {...playedTargetResults.value, [c.id]: playedTargetResultOf(candidate, owners, playedTargetVersion.value)};
  }
  picks.value = {...picks.value, [c.id]: soleSeedPick(seed), [nestedPickKey(c.id)]: seed.name};
  captureFor(c, soleSeedResponse(seed));
  return true;
}
/** Does the row still hold exactly what its seed wrote? (An optional pick names its card under the nested key.) */
function seedHolds(c: ComposerChoice, seed: SoleSeed): boolean {
  return soleSeedPick(seed) === picks.value[c.id] && (seed.kind !== 'optionalCard' || picks.value[nestedPickKey(c.id)] === seed.name);
}
/** The mark of a seeded row (i18n keys) — `undefined` when the row was not seeded or no longer holds its seed. */
function soleMark(c: ComposerChoice): {mark: string, hint: string} | undefined {
  if (seeded.value[c.id] === 'all') {
    const all = stepUnanswered(c) ? undefined : allSeedOf(c);
    return all !== undefined && sameCardNames(all, multiPicks.value[c.id] ?? []) ? ALL_SEED_MARK : undefined;
  }
  if (seeded.value[c.id] !== 'sole' || stepUnanswered(c)) {
    return undefined;
  }
  const seed = soleCandidateOf(c, soleViewer.value);
  return seed === undefined || !seedHolds(c, seed) ? undefined : soleMarkKeys(seed, choiceMode(c) === 'handPick');
}
function captureFor(c: ComposerChoice, response: unknown | undefined): void {
  if (c.scope === 'pre') {
    if (response === undefined) {
      delete capturedPre.value[c.index];
    } else {
      capturedPre.value[c.index] = response;
    }
  } else if (c.scope === 'option') {
    capturedOption.value = response;
  } else if (response === undefined) {
    delete captured.value[c.index];
  } else {
    captured.value[c.index] = response;
  }
}
function stepMissing(c: ComposerChoice): boolean {
  // A table question that WAITS (for the answer above it, or — deferrable — for a draw) holds nothing up.
  if (c.reaction !== undefined && c.scope === 'pre') {
    return tableQuestionRowMissing(tableRowState(c), !stepUnanswered(c));
  }
  return stepUnanswered(c);
}
/** Has this choice no answer captured? (Not «does it hold up the commit» — that is `stepMissing`.) */
function stepUnanswered(c: ComposerChoice): boolean {
  if (c.kind === 'venusBonus') {
    const meta = venusBonusMetaOf(c.input);
    return meta === undefined || venusPreselectResponse(meta, venusPartsOf(c)) === undefined;
  }
  if (c.scope === 'option') {
    return capturedOption.value === undefined;
  }
  return c.scope === 'pre' ? capturedPre.value[c.index] === undefined : captured.value[c.index] === undefined;
}
/**
 * MAY THIS TABLE QUESTION WAIT — the shared rule (`common/models/tableQuestionDeferral.ts`, 2026-10-15) over the
 * play's table questions and this composer's answers: `locked` (an earlier answer that may draw is still unanswered),
 * `deferrable` (a draw lands first — answer now or after it), `none`.
 */
function tableDeferral(c: ComposerChoice): ReactionDeferral {
  if (c.reaction === undefined || c.scope !== 'pre') {
    return {state: 'none'};
  }
  return reactionDeferral(c, tableQuestionChoices.value, (q) => capturedPre.value[(q as ComposerChoice).index]);
}
/** The ROW of a table question: plain · locked · deferred · early (`tableQuestionRow.ts`). */
function tableRowState(c: ComposerChoice): TableQuestionRowState {
  return tableQuestionRowState(tableDeferral(c), !stepUnanswered(c));
}
/**
 * THE ROW OF A TABLE QUESTION THAT COULD WAIT FOR A DRAW (2026-10-15) — its three lines, translated: the value
 * («Ждёт ответа: …» / «Спросят после добора» / the answer), the note (why it waits, or what waiting buys) and the
 * drawn-cards chip. `undefined` for any other row (the generic row draws it).
 */
function tableRowView(c: ComposerChoice): {state: TableQuestionRowState, value: string, lead: string, drawn?: ActionEffect, tail: string} | undefined {
  if (c.reaction === undefined || c.scope !== 'pre' || !tableQuestionCanWait(c.reaction)) {
    return undefined;
  }
  const state = tableRowState(c);
  const say = (line: {key: string, params: ReadonlyArray<string>} | undefined): string =>
    line === undefined ? '' : (line.params.length > 0 ? translateTextWithParams(line.key, [...line.params]) : translateText(line.key));
  const fixed = tableQuestionValue(state, translateCardName);
  const chosen = chosenLabel(c);
  const value = fixed !== undefined ? say(fixed) : (chosen !== '' ? chosen : `${pickPlaceholder(c)}…`);
  const note = tableQuestionNote(state, translateCardName, true);
  return {
    state,
    value,
    lead: say(note?.lead),
    drawn: note?.drawn !== undefined ? {direction: 'gain', icon: 'cards', amount: note.drawn} : undefined,
    tail: say(note?.tail),
  };
}
/** May the cursor stop on this row? A table question waiting for the one above it has nothing to do yet. */
function rowFocusable(row: PlayRow | undefined): boolean {
  return row !== undefined && (row.kind !== 'step' || row.choice.reaction === undefined || tableQuestionRowFocusable(tableRowState(row.choice)));
}
// ── the LAYOUT row (TR78) ───────────────────────────────────────────
function lanesOf(c: ComposerChoice): DistributionLanes | undefined {
  return distributionLanesOf(c.input);
}
function laneCards(c: ComposerChoice): ReadonlyArray<CardModel> {
  return lanesOf(c)?.cards ?? [];
}
function laneAmount(c: ComposerChoice, card: string): number {
  return spreadOn(spreads.value[c.id] ?? {}, card);
}
function laneAmountOf(c: ComposerChoice): number {
  return spreadTotal(spreads.value[c.id] ?? {});
}
function laneRemaining(c: ComposerChoice): number {
  const lanes = lanesOf(c);
  return lanes === undefined ? 0 : spreadRemaining(lanes.amount, spreads.value[c.id] ?? {});
}
/** The kind THIS holder takes (its own over several kinds), as an icon key. */
function laneIcon(c: ComposerChoice, card: string): string {
  const lanes = lanesOf(c);
  return lanes?.resourceByCard?.[card as CardName] ?? lanes?.resource ?? 'resources';
}
function laneIndexFor(id: string): number {
  return laneFocus.value[id] ?? 0;
}
/** ←→: the cursor walks the lanes (clamped — the row is a line, not a ring). */
function moveLane(c: ComposerChoice, dir: -1 | 1): void {
  const n = laneCards(c).length;
  if (n === 0) {
    return;
  }
  laneFocus.value[c.id] = Math.max(0, Math.min(n - 1, laneIndexFor(c.id) + dir));
}
/** LB/RB: one unit off / onto the focused lane — bounded by zero and by what is left to place. */
function adjustLane(c: ComposerChoice, delta: number): void {
  const lanes = lanesOf(c);
  const card = lanes?.cards[laneIndexFor(c.id)]?.name;
  if (lanes === undefined || card === undefined) {
    return;
  }
  setSpread(c, stepSpread(spreads.value[c.id] ?? {}, card, delta, lanes.amount));
}
/** RT: everything still unplaced onto the focused lane. */
function pourLane(c: ComposerChoice): void {
  const lanes = lanesOf(c);
  const card = lanes?.cards[laneIndexFor(c.id)]?.name;
  if (lanes === undefined || card === undefined) {
    return;
  }
  setSpread(c, pourRemaining(spreads.value[c.id] ?? {}, card, lanes.amount));
}
/** The layout's capture: the ONE `and` answer once the sum is exact — nothing before (the row holds the commit). */
function setSpread(c: ComposerChoice, next: SpreadState): void {
  const lanes = lanesOf(c);
  if (lanes === undefined) {
    return;
  }
  spreads.value[c.id] = next;
  captureFor(c, cardResourceDistributionResponse(lanes.cards.map((card) => card.name), next, lanes.amount));
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
  if (response === undefined) {
    delete captured.value[c.index];
  } else {
    captured.value[c.index] = response;
  }
}
/** A on the bonus row: the INNER step opens on the first open question (the wild, its card, then the grid). */
function openVenusStep(c: ComposerChoice): void {
  const meta = venusBonusMetaOf(c.input);
  if (meta !== undefined) {
    sub.value = {kind: 'venus', choiceId: c.id, focus: venusInnerOpen(meta, venusPartsOf(c))};
  }
}
/** A verb inside the inner step — the pure model decides; a confirm comes back to the review on the next question. */
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
function armVenusPreselects(): void {
  for (const [index, parts] of Object.entries(venusParts.value)) {
    const step = selectedBranch.value?.steps[Number(index)];
    const meta = step?.kind === 'venusBonus' && venusWhenHolds(step.when, captured.value) ? venusBonusMetaOf(step.input) : undefined;
    if (meta !== undefined && venusPreselectResponse(meta, parts) !== undefined) {
      armVenusBonusCell(venusPreselectArm(meta, parts));
    }
  }
}
// ── amount / spendHeat helpers ──────────────────────────────────────
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
  return '';
}
/**
 * The premium two-sided OPERATION for this dial — the SHARED derivation
 * (conversionPromptModel) the action composer and the standalone prompt
 * use. Play-time dials touch the viewer's own stocks/production
 * (Insulation's heat→M€ production), so the public-player read is the
 * whole pool story here.
 */
function amountOperation(c: ComposerChoice): ConversionPromptVm | undefined {
  return amountOperationVm(amountModel(c), amountFor(c.id),
    (icon, scope) => playerResourceValue(thisPlayer.value, icon, scope));
}
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
// ── pick rows ───────────────────────────────────────────────────────
function choiceTitle(c: ComposerChoice): string {
  // A QUESTION OF THE TABLE (TR51): the row names its asker — «Сработает · <карта> · ваш выбор» — never the
  // prompt's own title («Select an option for Olympus Conference»), which reads as one more step of THIS card.
  if (c.reaction !== undefined) {
    // A SERIES (PC04 · GS — the question's own `choiceContext.series`): the rows of one asker stand as a GROUP — the
    // first names the asker and its count, every next one only its count («Метка 2 / 3»), never N equal rows.
    const series = choiceSeriesOf(c.input);
    if (series !== undefined) {
      const count = choiceSeriesCount(series);
      const counted = translateTextWithParams(count.key, [...count.params]);
      return series.index > 1 ? counted : `${translateText('Will trigger')} · ${translateCardName(c.reaction.card)} · ${counted}`;
    }
    return `${translateText('Will trigger')} · ${translateCardName(c.reaction.card)} · ${translateText('your choice')}`;
  }
  // A MERGED pick (Astra) is ONE multi-select here — its per-slot titles
  // («Выберите ПЕРВОЕ событие…») would promise a sequence the console
  // never shows. The branch's own merged prompt is the honest ask.
  const merged = mergedPickTitle(c);
  if (merged !== '') {
    return merged;
  }
  // AN OPTIONAL CHOICE WHOSE ONE ANSWER IS A PICK IS THAT PICK (`optionalPickInputOf`): its row carries the
  // pick's own title, ahead of the `or` input's own generic «Select one option».
  const pick = optionalPickInputOf(c.input);
  const pickTitle = pick !== undefined ? textOf(pick.title) : '';
  if (pickTitle !== '') {
    return pickTitle;
  }
  const t = textOf(c.input.title);
  if (t !== '') {
    return t;
  }
  switch (c.kind) {
  case 'card': return translateText(cardPickAskKey(c.amount));
  case 'player': return translateText('Choose a player');
  case 'or': return translateText(optionalPickVerb(c));
  default: return '';
  }
}
/** The verb of an `or` choice: its one pick's ask when the choice IS a pick, else «Choose an option». */
function optionalPickVerb(c: ComposerChoice): string {
  const pick = optionalPickInputOf(c.input);
  if (pick?.type === 'card') {
    // A DISCARD asks for the card to give up — «Выберите себе карту» read as a card GAINED (2026-10-15).
    return (pick as SelectCardModel).discardPrompt !== undefined ? 'Select a card to discard' : cardPickAskKey(c.amount);
  }
  if (pick?.type === 'player') {
    return 'Choose a player';
  }
  return 'Choose an option';
}
function pickPlaceholder(c: ComposerChoice): string {
  // The merged pick answers N slots at once ON THE TABLE — the generic
  // «Выберите себе карту» promises one card from the wrong place.
  if (isMergedPickChoice(c)) {
    return translateText('Pick cards on the table');
  }
  switch (c.kind) {
  case 'card': return translateText(isMultiCardChoice(c) ? 'Pick cards from hand' :
    ((c.input as SelectCardModel).discardPrompt !== undefined ? 'Select a card to discard' : cardPickAskKey(c.amount)));
  case 'player': return translateText('Choose a player');
  case 'or': return translateText(optionalPickVerb(c));
  default: return translateText('Choose an option');
  }
}
function isMultiCardChoice(c: ComposerChoice): boolean {
  // A step the server DECLARES as a multi pick (`multiSelect` — its count label, its per-card payouts) is one at any
  // `max`: with a single candidate (Strategic Shift with one requirement card in hand, Public Plans with one other card)
  // `max` is 1 and the answer is still «how many» — the album stays multi, the row reads the picks and both payouts.
  return c.input.type === 'card' && (((c.input as SelectCardModel).max ?? 1) > 1 || c.multiSelect !== undefined);
}
function chosenLabel(c: ComposerChoice): string {
  // A resolved MULTI-select (hand multi OR the merged tableau pick) shows
  // the picked cards themselves (first two names + «+N»), so the
  // selection stays VISIBLE in the composer — an explicit empty answer
  // reads honestly as «Выбрано: 0».
  const multi = multiPicks.value[c.id];
  if (multi !== undefined && c.input.type === 'card') {
    // A merged GAIN pick names its targets on its own line, each with its reading (`mergedGainTargets`).
    if (multi.length > 0 && mergedGainTargets(c).length > 0) {
      return `${translateText('Selected')}: ${multi.length}`;
    }
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
    const opt = (c.input as OrOptionsModel).options[Number(pick)];
    // The DECLINE reads as the refusal's own words («Не сбрасывать»), never the server's generic «Ничего не делать».
    const decline = choiceDecline(c);
    if (decline !== undefined && Number(pick) === decline.index) {
      return textOf(decline.label);
    }
    // A branch answered through its OWN question (the card Mars University discards, the player Comet for Venus
    // hits) reads as its ANSWER — the option's title IS the question, and a row restating it looks unanswered.
    const nested = picks.value[nestedPickKey(c.id)];
    if (opt !== undefined && nested !== undefined) {
      if (opt.type === 'player') {
        return playerName(nested);
      }
      const names = nested.split(NESTED_PICK_SEP).map((n) => translateCardName(n as CardName)).join(', ');
      // A DISCARD says so — a bare card name under «Сработает · <карта> · ваш выбор» reads as a card GAINED.
      return (opt as SelectCardModel).discardPrompt !== undefined ? `${translateText(opt.buttonLabel || 'Discard')}: ${names}` : names;
    }
    return opt !== undefined ? textOf(opt.title) : '';
  }
  return pick;
}
function chosenImpact(c: ComposerChoice): string {
  // Multi-select payout (Public Plans): the LIVE gain of the picked count.
  const multi = multiPicks.value[c.id];
  const gain = c.multiSelect?.revealGain;
  if (multi !== undefined && gain !== undefined && isMultiCardChoice(c)) {
    return `+${multi.length * gain.amount}`;
  }
  // The merged tableau pick (Astra): +N cards return to hand. A merged GAIN (P78) reads per target instead.
  if (multi !== undefined && isMergedPickChoice(c) && multi.length > 0 && (c.amount ?? 0) <= 0) {
    return `+${multi.length}`;
  }
  // An ANSWERED PLAYER target keeps the reading the list showed — who loses what, `current → resulting` (PL-899:
  // the collapsed row printed the name alone, so a seeded sole target — T14 · CC — would have hidden its change).
  if (c.input.type === 'player') {
    const color = picks.value[c.id];
    return color === undefined ? '' : playerImpact(c.input as SelectPlayerModel, color) ?? '';
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
/**
 * The multi-pick's SECOND payout, in cards («+N» beside the cards icon — Strategic Shift's draw per card thrown):
 * the same live arithmetic as the M€, its own icon; '' when the pick pays no cards.
 */
function chosenImpactDraw(c: ComposerChoice): string {
  const multi = multiPicks.value[c.id];
  const draw = c.multiSelect?.drawPerCard;
  if (multi === undefined || draw === undefined || draw <= 0 || !isMultiCardChoice(c)) {
    return '';
  }
  return `+${multi.length * draw}`;
}
/** The icon beside the impact — the step's card resource, the multi
 *  payout's resource (M€ for Public Plans), or the merged pick's cards. */
function chosenImpactIcon(c: ComposerChoice): string | undefined {
  if (c.cardResource !== undefined) {
    return c.cardResource;
  }
  if (c.input.type === 'player' && picks.value[c.id] !== undefined) {
    return (c.input as SelectPlayerModel).icon;
  }
  const gain = c.multiSelect?.revealGain;
  if (multiPicks.value[c.id] !== undefined && gain !== undefined) {
    return gain.resource;
  }
  return multiPicks.value[c.id] !== undefined && isMergedPickChoice(c) ? 'cards' : undefined;
}
function playerName(color: string): string {
  return displayNameForColor(props.playerView.players, color as Color);
}
/** The viewer's CURRENT production for a standard resource — the `current`
 *  base of a copied-production chip on a resource the base effects don't
 *  already carry (desktop `playerProduction` mirror). */
function playerProduction(res: string): number {
  const p = thisPlayer.value;
  switch (res) {
  case 'megacredits': return p.megacreditProduction;
  case 'steel': return p.steelProduction;
  case 'titanium': return p.titaniumProduction;
  case 'plants': return p.plantProduction;
  case 'energy': return p.energyProduction;
  case 'heat': return p.heatProduction;
  default: return 0;
  }
}
/** An option tile's OWN chips — what it adds beyond the shared head stated above the row. */
function variantOwnEffects(pos: number): ReadonlyArray<ActionEffect> {
  return (branches.value[pos]?.effects ?? []).slice(sharedVariantEffects.value.length);
}
/**
 * The chips a tile READS under its print / hero. A palette tile whose branch changes nothing (`futile`) reads its
 * quiet line instead — «20 → 20 · нет эффекта» under a «0» would say the same thing a third time.
 */
function variantTileEffects(pos: number): ReadonlyArray<ActionEffect> {
  if (variantPalette.value && branches.value[pos]?.futile !== undefined) {
    return [];
  }
  // A printed payload with its addresses: the «+N на карту» chip would be the print's third telling (TR56, П1).
  const k = variantRows.value.findIndex((row) => row.pos === pos);
  if (variantPrinted.value?.[k] !== undefined && variantDestinationsOf(branches.value[pos]) !== undefined) {
    return variantOwnEffects(pos).filter((e) => !(e.note === 'to a card' && e.direction === 'gain'));
  }
  return variantOwnEffects(pos);
}
function branchTitle(b: ActionPreviewBranch): string {
  const t = textOf(b.title);
  return t !== '' ? t : translateText('Play card');
}
function branchReasonText(b: ActionPreviewBranch): string {
  return b.unavailableReason !== undefined ? textOf(b.unavailableReason) : translateText('Unavailable right now');
}
function payCount(unit: SpendableResource): number {
  return payCounts.value[unit] ?? 0;
}
// ── input routing (foundation: SEMANTIC actions, no raw button names) ──
function handleIntent(intent: GamepadIntent): void {
  // A press while the late content arrives: the step IS the cursor's arrival (input is never delayed — PL-510).
  if (lateCursor.value.pending) {
    releaseCursor(lateCursor.value);
  }
  // The player's press pins the work column where it stands (centred) — nothing it causes re-centres it — and
  // whatever it moves inside the column slides into place.
  settledSheet.value?.around();
  settled.value?.around();
  // THE «ЭФФЕКТЫ» LAYER owns the pad while it is open («the player drives
  // the surface they see»); R3 at the review level opens it. Both are
  // resolved BEFORE the semantic map, which has no default verb for R3.
  if (fxOpen.value) {
    onForecastIntent(intent);
    return;
  }
  // THE BOARD PEEK (TR45) owns the pad while it is open: L3 and B bring the composer back, everything else is
  // absorbed — the peek is a reading, the board under it takes no input. L3 at the review level opens it.
  if (boardPeekUi.peek !== undefined) {
    if (intent.kind === 'press' && (intent.button === 'stickL' || consoleActionOf(intent) === 'back')) {
      closeBoardPeek();
    }
    return;
  }
  const why = countWhy.value;
  if (intent.kind === 'press' && intent.button === 'stickL' && sub.value === undefined && why !== undefined && peekable(why)) {
    openBoardPeek(why);
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickR') {
    openForecastLayer();
    return;
  }
  if (intent.kind === 'scroll') {
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
  onReviewPress(action);
}
function onNav(dir: NavDirection): void {
  if (loading.value) {
    return;
  }
  // The embedded step owns SPATIAL navigation — it crosses owner groups by
  // geometry in split view, which a shared index walk cannot express.
  if (sub.value?.kind === 'playedTarget') {
    movePlayedTarget(dir);
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
    if (dir === 'up' || dir === 'down') {
      sub.value.index = Math.min(len - 1, Math.max(0, sub.value.index + (dir === 'down' ? 1 : -1)));
      scrollFocused();
    } else if (sub.value.kind === 'payment') {
      adjustPayRow(sub.value.index, dir === 'right' ? 1 : -1);
    }
    return;
  }
  if (rows.value.length === 0) {
    return;
  }
  // THE «ИЛИ» RADIOGROUP MOVES BY ITS GEOMETRY. Side by side, ←→ switch
  // the options (with wrap) and ↑↓ leave the group — up to the previous
  // stop of the ring, down to the next (a pick row, else the commit
  // rail); ↑ from just below re-enters on the option the cursor left.
  // In a column (the Deck) the pure model declines and the ordinary walk
  // below applies. Selection stays a PRESS — none of this chooses.
  const grouped = variantGroupNav({
    dir,
    axis: variantAxis.value,
    focusIdx: focusIdx.value,
    variantIdx: variantRows.value.map((r) => r.i),
    returnIdx: variantReturnIdx.value,
    navMaxIndex: navMaxIndex.value,
    rows: variantGridRows.value,
  });
  if (grouped !== undefined) {
    focusIdx.value = grouped;
    scrollFocused();
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
    // A table question WAITING for the one above it is no stop (nothing to do there yet) — the walk steps over it.
    const step = dir === 'down' ? 1 : -1;
    let next = focusIdx.value + step;
    while (next >= 0 && next <= navMaxIndex.value && !rowFocusable(rows.value[next])) {
      next += step;
    }
    if (next >= 0 && next <= navMaxIndex.value) {
      focusIdx.value = next;
    }
    scrollFocused();
    return;
  }
  // Left/right adjust a focused inline stepper — or walk a LAYOUT's lanes (the bumpers move the units).
  const row = focusedRow.value;
  if (row?.kind === 'step' && row.choice.kind === 'amount') {
    setAmount(row.choice, amountFor(row.choice.id) + (dir === 'left' ? -1 : 1));
  } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
    adjustFloaters(row.choice, dir === 'left' ? -1 : 1);
  } else if (row?.kind === 'step' && row.choice.kind === 'distribute') {
    moveLane(row.choice, dir === 'left' ? -1 : 1);
  }
}
// REVIEW state: A(primary) play/lead-to-choice, LT(prevTab) enter payment
// lanes, X(inspect) zoom the card, B back, LB/RB(prev/nextSection) step, RT max.
function onReviewPress(action: ConsoleAction): void {
  if (loading.value) {
    // Only Cancel is honoured while the preview is still loading.
    if (action === 'back') {
      emit('cancel');
    }
    return;
  }
  const row = focusedRow.value;
  switch (action) {
  case 'primary':
    // THE COMMIT ARRIVES (T14 · CC): a press inside the arrival window — before the commit's pose paints, or within
    // the ring's clock after — is the ARRIVAL (the input observer has already posed the cursor), never the play.
    if (row?.kind === 'cta' && commitArrivalAbsorbs(commitArrival.value)) {
      return;
    }
    primaryAction();
    return;
  case 'prevTab':
    // LT = EXPAND the payment block in place (secondary — never A). Only
    // where the editor is a real stage: a pure-AUTO M€ payment has nothing
    // to configure, and a single alternative is already being dialed on
    // this screen. Nothing about the block relocates.
    openPaymentEditor();
    return;
  case 'inspect':
    if (heroCard.value !== undefined) {
      // "One physical card": the composer's mini card PHYSICALLY lifts
      // into fullscreen and returns into the SAME slot on close (its
      // slot is held empty meanwhile — the card is never in two places).
      openConsoleCardZoom([heroCard.value], 0, undefined, undefined, {
        origin: {
          kind: 'physical',
          resolve: () => (composerRootEl())?.querySelector<HTMLElement>('.con-composer__playcard') ?? null,
        },
      });
    }
    return;
  case 'back':
    emit('cancel');
    return;
  case 'prevSection':
  case 'nextSection': {
    const step = action === 'prevSection' ? -1 : 1;
    // A focused amount/spend-heat stepper takes priority; otherwise LB/RB do
    // the global inline payment quick-adjust (no focus on payment needed).
    if (row?.kind === 'step' && row.choice.kind === 'amount') {
      setAmount(row.choice, amountFor(row.choice.id) + step);
    } else if (row?.kind === 'step' && row.choice.kind === 'spendHeat') {
      adjustFloaters(row.choice, step);
    } else if (row?.kind === 'step' && row.choice.kind === 'distribute') {
      adjustLane(row.choice, step);
    } else {
      adjustQuickPayment(step);
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
      setAmount(row.choice, amountModel(row.choice).max);
    } else if (row?.kind === 'step' && row.choice.kind === 'distribute') {
      // RT on a LAYOUT's lane: everything still unplaced goes here.
      pourLane(row.choice);
    } else if (!(row?.kind === 'step' && row.choice.kind === 'spendHeat')) {
      adjustQuickPayment(1, true);
    }
    return;
  default:
    return;
  }
}
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
function primaryAction(): void {
  const row = focusedRow.value;
  if (row === undefined) {
    return;
  }
  if (row.kind === 'cta') {
    if (ctaReady.value) {
      submit();
      return;
    }
    // Payment shortfall → expand the payment block (the actionable fix).
    // Only where the editor exists: a single-alt shortfall is fixed by the
    // bumpers on the block itself, so A stays silent rather than opening a
    // screen that would offer the same two buttons.
    if (primaryActionState.value.kind === 'blocked-payment' && payEditorAvailable.value) {
      openPaymentEditor();
      return;
    }
    // Otherwise lead the player to the first unresolved choice (+ open it) — a question that holds the commit up,
    // never one that may wait for a draw (it is not why the rail refused).
    const missing = firstMissingIndex();
    focusIdx.value = missing >= 0 ? missing : firstActionableIndex();
    const target = focusedRow.value;
    if (missing >= 0 && target !== undefined && target.kind !== 'cta') {
      openRow(target);
    }
    scrollFocused();
    return;
  }
  // A VARIANT: the press SELECTS — an answer like any other, so the ONE rule lands the cursor on the next
  // question, or on the commit when nothing is left (T14 · CC, decision 3). «Выбрать» and «разыграть» stay two
  // presses by construction: the commit ARRIVES, and a press inside its arrival window (a held button, a fast
  // double press) is the arrival, never the play (`commitArrival.ts`).
  if (row.kind === 'variant') {
    selectVariant(row.pos);
    landCursor();
    scrollFocused();
    return;
  }
  if (focusedOpensPicker.value) {
    openRow(row);
    return;
  }
  // An amount / spend-heat row → proceed toward the play CTA.
  landCursor();
  scrollFocused();
}
/**
 * SELECT a variant — the ONE mutation both the pad and the mouse go through.
 * Idempotent: pressing A on the variant already selected re-affirms it
 * (never a toggle — a choice that can be un-made by repeating the press has
 * no stable state to commit).
 */
function selectVariant(pos: number): void {
  if (branches.value[pos]?.available !== true) {
    return;
  }
  setSelectedVariant(pos);
}
/**
 * The MOUSE half of the same grammar: a click on a variant SELECTS it (it
 * never plays, so a double click cannot commit), and the cursor follows the
 * pointer so the pad picks up where the mouse left off.
 */
/**
 * «STRICTLY PRE-SELECT» — the commit's witness (TR51, `preselectWitness.armPostCommitWitness`): after the press no
 * choice of this card or of a table card that asks (the forecast's `asks`) may be raised unless this composer
 * HANDED IT ON with its reason — a forecast question with no pre-select (its note says why), a choice the play
 * composer routes on as a follow-up, a follow-up the server declared (a «ДАЛЕЕ» note).
 */
function armCommitWitness(): void {
  const pos = selectedPos.value;
  const facts = [...(forecast.value?.facts ?? []), ...(pos !== undefined ? forecast.value?.byBranch?.[pos] ?? [] : [])];
  const asks = facts.filter((f) => f.certainty === 'asks');
  const honest: Array<HonestFollowUp> = asks.filter((f) => f.preselect === undefined).map((f) => ({card: f.source.name, role: '*'}));
  for (const c of followUpChoices.value) {
    honest.push(c.reaction !== undefined ? {card: c.reaction.card, role: '*'} : {card: props.cardName, role: roleOf(c.input as unknown as AddressableInput)});
  }
  // A table question LEFT FOR AFTER THE DRAW (2026-10-15) is the player's own choice to be asked live — handed on by
  // the press itself; its album will mark the card the draw brought (`deferredDiscardFresh`).
  const deferred = deferredTableChoices.value.flatMap((c) => c.reaction !== undefined ? [c.reaction.card] : []);
  for (const card of deferred) {
    honest.push({card, role: '*'});
  }
  armDeferredDiscards(deferred, props.playerView.cardsInHand.map((cd) => cd.name).filter((n) => n !== props.cardName),
    deferredDiscardKey(props.playerView.game.generation, thisPlayer.value.actionsTakenThisGame));
  if ((selectedBranch.value?.steps ?? []).some((st) => st.kind === 'note' && st.noteKind !== 'warning')) {
    honest.push({card: props.cardName, role: '*'});
  }
  armPostCommitWitness(props.cardName, asks.map((f) => f.source.name), honest);
}
/** A table question the composer cannot host (a shape it does not draw) — handed on in its asker's name. */
function reactionFollowUpRow(c: ComposerChoice): NextStepRow {
  const title = textOf(c.input.title);
  return noteRow(`${translateCardName(c.reaction?.card ?? props.cardName)}: ${title !== '' ? title : translateText('Choose a target')}`);
}
function clickVariantAt(index: number): void {
  settledSheet.value?.around();
  settled.value?.around();
  const row = variantRows.value[index];
  if (row !== undefined) {
    clickVariant(row);
  }
}
function clickVariant(row: PlayRow & {kind: 'variant'}): void {
  if (loading.value || sub.value !== undefined) {
    return;
  }
  focusIdx.value = row.i;
  selectVariant(row.pos);
  // The mouse speaks the pad's grammar: an answer lands the cursor by the ONE rule.
  landCursor();
  scrollFocused();
}
/** The pointer moved the cursor onto a row (a click) — the player's own placement, never a rule's landing. */
function pointCursorAt(index: number): void {
  focusIdx.value = index;
}
/** …and a click on the commit rail COMMITS — the second, separate press. */
function clickCta(): void {
  if (loading.value || sub.value !== undefined) {
    return;
  }
  // The POINTER placed the cursor (the pad picks up where the mouse left off) — a player's placement, not a landing.
  pointCursorAt(ctaIndex.value);
  // The gate's own backstop for input that did not come through the cursor:
  // an unmet requirement redirects instead of running (never a silent no-op).
  const redirect = commitRedirectTarget(commitGate.value);
  if (redirect !== undefined) {
    focusIdx.value = redirect;
    scrollFocused();
    return;
  }
  primaryAction();
}
/** HOW a choice is served: inline sub / the hand pick / the tableau pick /
 *  an honest post-submit follow-up (the PURE classification). */
function choiceMode(c: ComposerChoice): PlayChoiceMode {
  // (A table question behind a draw is no follow-up since 2026-10-15: it stays a row — answerable now, or left for
  // after the draw — `tableRowState`.)
  return playChoiceMode(c, handNamesSet.value, playedNamesSet.value, props.cardName);
}
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
function playedTargetPreview(choice: ComposerChoice, name: CardName): ReadonlyArray<PlayedTargetPreviewSection> {
  const step = choice.scope === 'step' ? selectedBranch.value?.steps[choice.index] : undefined;
  const input = playedTargetInputFor(choice);
  return input === undefined ? [] : playedTargetPreviewFor(step, input, name, selectedBranch.value?.effects, selectedBranch.value?.vpBox);
}
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
function playedTargetResourceContext(c: ComposerChoice, card: CardModel): PlayedTargetResourceContext | undefined {
  // A pick of ANY kind (P43's «a resource on any card with a resource») names no kind of its own — each candidate
  // takes ITS OWN, the server's per-card marker (`cardResourceByCard`); a bare «resource» key drew no sprite.
  const byCard = (c.input as {resourceGainPrompt?: {cardResourceByCard?: Partial<Record<string, string>>}}).resourceGainPrompt?.cardResourceByCard;
  return playedTargetResourceFor(c.amount, c.cardResource ?? byCard?.[card.name], card);
}
/** A LATER card step of a merge branch — collapsed into the first one's
 *  multi pick (never its own row, never a follow-up note). */
function isCollapsedMergeStep(c: ComposerChoice): boolean {
  return mergeBranchActive.value && c.scope === 'step' &&
    c.input.type === 'card' && c.index !== firstMergeCardStepIndex.value;
}
/** The choice hosts the merge branch's ONE multi tableau pick. */
function isMergedPickChoice(c: ComposerChoice): boolean {
  return mergeBranchActive.value && c.scope === 'step' &&
    c.input.type === 'card' && c.index === firstMergeCardStepIndex.value;
}
/** The merged pick's ONE prompt (the branch's `mergeCardSteps.title`) —
 *  '' when this choice is not the merge host / the branch declares none. */
function mergedPickTitle(c: ComposerChoice): string {
  if (!isMergedPickChoice(c)) {
    return '';
  }
  const t = selectedBranch.value?.mergeCardSteps?.title;
  return t !== undefined ? textOf(t) : '';
}
/** Open the pick surface a decision row needs (a list / tabbed picker /
 *  the hand or tableau pick). An amount / spend-heat row adjusts inline,
 *  so opening it is a no-op. */
function openRow(row: PlayRow): void {
  // EVERY owner pre-select of the espionage advance (the landing choice,
  // the stage-7 repeat, the stage-9 animal target) descends into the
  // HYDRONETWORK first — the same seamless descent the target pick makes.
  // The player sees THE MOVE the pick belongs to (from → to, the ghost,
  // the arrow) and answers inside the track's own stage surface, which is
  // what makes «почему я сейчас это выбираю» readable; the stage then
  // reuses the workspace's existing seamless steps (the choice selector,
  // the embedded target grid, the hydro→repeat frame handoff). A repeat
  // browser raised STRAIGHT over the play composer was the contract
  // violation this replaced.
  if ((row.kind === 'repeat' || row.kind === 'step') &&
      (row.choice.id === 'esp-owner-choice' || row.choice.id === 'esp-owner-repeat' || row.choice.id === 'esp-owner-animal')) {
    openEspOwnerRewardPick(row.choice);
    return;
  }
  if (row.kind === 'step' && row.choice.kind === 'venusBonus') {
    openVenusStep(row.choice);
  } else if (row.kind === 'repeat') {
    openRepeatPick(row.choice);
  } else if (row.kind === 'step' && row.choice.input.type === 'deltaEspionage') {
    openEspionagePick(row.choice);
  } else if (row.kind === 'step' && choiceMode(row.choice) === 'handPick') {
    openHandPick(row.choice);
  } else if (row.kind === 'step' && choiceMode(row.choice) === 'playedTarget') {
    openPlayedTargetStep(row.choice);
  } else if (row.kind === 'step' && row.choice.kind === 'or' && tableTargetOf(row.choice.input) !== undefined && openTableTargetZone(row.choice)) {
    // «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА»: the players' cards and the bot on ONE screen, no list «карты / бот» before them.
  } else if (row.kind === 'step' && row.choice.kind === 'or' && openOptionalPick(row.choice)) {
    // An optional choice whose one answer is a pick: no list — the pick itself, the decline inside it.
  } else if (row.kind === 'step' && (row.choice.kind === 'card' || row.choice.kind === 'player' || row.choice.kind === 'or')) {
    sub.value = {kind: 'list', choiceId: row.choice.id, index: 0};
  } else if (row.kind === 'tabbed' && !openTabbedZone(row.stepIndex)) {
    // Virus's targets are ONE zone (`tabbedTargetZone`); the flat list only when the zone has nothing to point at.
    sub.value = {kind: 'tabbed', stepIndex: row.stepIndex, index: 0};
  }
}
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
function openEspOwnerRewardPick(c: ComposerChoice): void {
  const proj = espionageProjectionRaw.value;
  if (proj === undefined || !proj.owner.legal) {
    return;
  }
  const kind = proj.owner.reward.kind;
  if (kind !== 'choice' && kind !== 'repeat-action' && kind !== 'card-resource') {
    return;
  }
  const pos = proj.owner.toPosition;
  // The prior draft per ask family — a «change» re-open restores the
  // standing answer (the reward-pick seat re-seeds the per-position
  // drafts and the repeat composition from it).
  let prior: DeltaRewardDraft | undefined;
  if (kind === 'choice') {
    const cap = captured.value[ESP_OWNER_CHOICE_INDEX] as {type?: string, index?: number} | undefined;
    if (cap?.type === 'or' && typeof cap.index === 'number') {
      prior = {position: pos, rewardChoice: cap.index};
    }
  } else if (kind === 'repeat-action') {
    if (repeatResult.value !== undefined) {
      prior = {position: pos, selectedCard: repeatResult.value.chosenCard, repeat: repeatResult.value};
    }
  } else {
    const cap = captured.value[ESP_OWNER_ANIMAL_INDEX] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
    if (cap?.type === 'card' && cap.cards !== undefined && cap.cards.length > 0) {
      prior = {position: pos, selectedCard: cap.cards[0]};
    }
  }
  enterDeltaRewardPick({
    source: props.cardName,
    claimable: [pos],
    advanceFrom: proj.owner.fromPosition,
    prior,
  }, (draft) => {
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    if (kind === 'choice') {
      if (draft.rewardChoice === undefined) {
        return; // an unanswered ask cannot resolve (the scene's own gate)
      }
      picks.value[cur.id] = String(draft.rewardChoice);
      captureFor(cur, {type: 'or', index: draft.rewardChoice, response: {type: 'option'}});
    } else if (kind === 'repeat-action') {
      // The hydro flow's own repeat frame composed the pick; a re-open
      // that resolved without recomposing keeps the standing result.
      if (draft.repeat !== undefined && draft.repeat.chosenCard === draft.selectedCard) {
        repeatResult.value = draft.repeat;
      } else if (draft.selectedCard === undefined || repeatResult.value?.chosenCard !== draft.selectedCard) {
        return;
      }
    } else {
      if (draft.selectedCard === undefined) {
        return;
      }
      picks.value[cur.id] = draft.selectedCard;
      captureFor(cur, {type: 'card', cards: [draft.selectedCard]});
    }
    landCursor();
    scrollFocused();
  });
}
function openEspionagePick(c: ComposerChoice): void {
  const projection = (c.input as DeltaEspionageInputModel).projection;
  if (!projection.hasLegalTarget) {
    // The system outcome «Нет доступной цели» — an empty selector must
    // never open (there is nothing to choose); the row already reads it.
    return;
  }
  enterDeltaEspionagePick({
    source: props.cardName,
    projection,
    prior: espionageCapture.value?.target,
  }, (draft) => {
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    captureFor(cur, deltaEspionageStepResponse(projection, draft.target, espionageOwnerAnswer.value));
    landCursor();
    scrollFocused();
  });
}
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
    source: {kicker: 'Play card', card: props.cardName},
    prior: repeatResult.value !== undefined ?
      {chosenCard: repeatResult.value.chosenCard, nodeIndex: repeatResult.value.nodeIndex} : undefined,
  }, (result) => {
    repeatResult.value = result;
    landCursor();
    scrollFocused();
  });
}
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
/**
 * Measure the band ONCE, before the step is visible, and measure it where
 * the layout is STRETCHED rather than content-sized — see
 * `playedTargetHeight`. The width comes from the work column (`flex: 1`
 * with a max cap, so it is stretched too); the height comes from the row
 * above it, which is the only box here whose size the cards cannot move.
 */
function measurePlayedTargetBand(): void {
  const root = composerRootEl();
  const zone = root?.querySelector<HTMLElement>('.con-composer__playright');
  if (zone !== null && zone !== undefined) {
    playedTargetWidth.value = zone.clientWidth;
  }
  const band = root?.querySelector<HTMLElement>('.con-composer__playmain');
  if (band !== null && band !== undefined) {
    playedTargetHeight.value = band.clientHeight;
  }
}
/**
 * VIRUS AS ONE ZONE («ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА», `tableTargetZone.tabbedTargetZone`): A on the tabbed row opens the
 * embedded target step — the animal cards in their owners' groups, every player-target a stand-in tile (the bot's
 * animals, each player's plants; a protected one shown refused), LB/RB between the groups, RT the decline. The
 * answer is the step's own target key and response (`buildTabbedTargets`), so the draft and the batch are the
 * historical ones. False: nothing to point at — the caller keeps the flat list.
 */
function openTabbedZone(stepIndex: number): boolean {
  measurePlayedTargetBand();
  const owners = tabbedZoneModelFor(stepIndex)?.owners ?? [];
  if (owners.length === 0) {
    return false;
  }
  const chosen = tabbedZoneKeyOf(stepIndex, picks.value['tabbed#' + stepIndex]);
  const focus = findPlayedTargetFocus(chosen, owners) ?? reseatPlayedTargetFocus(undefined, owners);
  if (focus === undefined) {
    return false;
  }
  sub.value = {kind: 'playedTarget', choiceId: 'tabbed#' + stepIndex, focus, picked: [], tabbed: stepIndex};
  return true;
}
/** The zone candidate (a card's name / a stand key) the step's answered target key stands for. */
function tabbedZoneKeyOf(stepIndex: number, pickKey: string | undefined): string | undefined {
  const step = tabbedSteps.value.find((t) => t.index === stepIndex)?.step;
  if (step === undefined || pickKey === undefined) {
    return undefined;
  }
  for (const [zoneKey, key] of tabbedTargetZone(step).pickKeys) {
    if (key === pickKey) {
      return zoneKey;
    }
  }
  return undefined;
}
/** The one zone of a tabbed removal — the cards by owner, the players' stand-ins in their groups. */
function tabbedZoneModelFor(stepIndex: number): PlayedTargetModel | undefined {
  const step = tabbedSteps.value.find((t) => t.index === stepIndex)?.step;
  if (step === undefined) {
    return undefined;
  }
  const zone = tabbedTargetZone(step);
  if (zone.cards.length === 0 && zone.stands.length === 0) {
    return undefined;
  }
  const animal = step.animal;
  const input = animal?.input;
  // A card's reading is the removal's own «current → resulting» of its animals (the reader every target step uses).
  const removal: ActionPreviewStep | undefined = input === undefined || animal === undefined ? undefined :
    {kind: 'input', input, amount: -animal.amount, cardResource: CardResource.ANIMAL};
  return buildPlayedTargetModel({
    candidates: zone.cards,
    stands: zone.stands.map((stand) => ({stand, ownerName: playerName(stand.color)})),
    players: props.playerView.players,
    viewerColor: thisPlayer.value.color,
    // The step's own contract line already asks for a target at the table — an ask under it would say it twice.
    ask: '',
    sourceCardName: props.cardName,
    typeOf: (name) => getCard(name)?.type,
    direction: 'remove',
    preview: (name) => input === undefined ? [] : playedTargetPreviewFor(removal, input, name),
  });
}
function openPlayedTargetStep(c: ComposerChoice, orItem?: ConsoleOrItem): void {
  measurePlayedTargetBand();
  // An OR-OPTION's step reads the option's own `SelectCard` (`playedTargetInputFor`), which is a function of the
  // sub-state itself — so the step is opened FIRST and its owners read after (the action composer's order).
  const before = sub.value;
  if (orItem !== undefined || tableTargetOf(c.input) !== undefined) {
    sub.value = {kind: 'playedTarget', choiceId: c.id, focus: {ownerId: '', index: 0}, picked: [], orItem};
  }
  const owners = playedTargetModel.value?.owners ?? [];
  if (owners.length === 0) {
    sub.value = before;
    return;
  }
  // Re-entry restores the previous answer: a single target puts the cursor
  // ON that card, a multi ask brings its whole accumulation back (pruned of
  // anything that left the table since).
  const multi = playedTargetSelectionFor(c);
  const picked = multi.mode === 'multi' ?
    prunePlayedTargetPicks((multiPicks.value[c.id] ?? []) as ReadonlyArray<string>, owners) :
    [];
  const chosen = playedTargetResults.value[c.id];
  // A bot answered in the table's one zone re-enters ON the bot's tile.
  const table = orItem === undefined ? tableTargetOf(c.input) : undefined;
  const botChosen = table !== undefined && picks.value[c.id] === String(table.botBranch) ? tableTargetBotStand(c.input)?.key : undefined;
  const focus = findPlayedTargetFocus(chosen?.cardName ?? botChosen ?? picked[0], owners) ??
    reseatPlayedTargetFocus(undefined, owners);
  if (focus === undefined) {
    sub.value = before;
    return;
  }
  sub.value = {kind: 'playedTarget', choiceId: c.id, focus, picked, orItem};
}
/**
 * The `SelectCard` a choice's embedded step is serving: the choice's own input, or the one NESTED in the or-option
 * being answered — open now (`sub.orItem`) or answered earlier through the step (`orTableAnswerItem`). Everything
 * that reads the step's candidates goes through here, so a nested descent can never render one set of cards and
 * validate against another (the action composer's `playedTargetInputFor`).
 */
function playedTargetInputFor(c: ComposerChoice, seedItem?: ConsoleOrItem): SelectCardModel | undefined {
  const open = seedItem ?? (sub.value?.kind === 'playedTarget' && sub.value.choiceId === c.id ? sub.value.orItem : undefined);
  // The table's one zone serves the players' card pick of the `or` (absent with a lone bot).
  if (open === undefined && tableTargetOf(c.input) !== undefined) {
    return tableTargetCardPick(c.input);
  }
  const input = (open ?? orTableAnswerItem(c))?.nested ?? c.input;
  return input.type === 'card' ? (input as SelectCardModel) : undefined;
}
/** The or-option an `or` choice was answered with THROUGH the embedded step (a card on the table), if any. */
function orTableAnswerItem(c: ComposerChoice): ConsoleOrItem | undefined {
  if (c.input.type !== 'or' || playedTargetResults.value[c.id] === undefined) {
    return undefined;
  }
  const nested = picks.value[nestedPickKey(c.id)];
  const pick = picks.value[c.id];
  if (nested === undefined || nested === '' || pick === undefined) {
    return undefined;
  }
  const item = buildOrItems(c.input as OrOptionsModel).find((it) => String(it.optionIndex) === pick);
  return item !== undefined && orOptionDoor(item.nested, handNamesSet.value, playedNamesSet.value, props.cardName) === 'table' ?
    item : undefined;
}
/** B out of a nested descent → the OR LIST it came from (ONE logical level), the cursor on the option it opened. */
function orListSub(choiceId: string, item: ConsoleOrItem): SubState | undefined {
  const c = allChoices.value.find((x: ComposerChoice) => x.id === choiceId);
  if (c === undefined || c.input.type !== 'or') {
    return undefined;
  }
  // A pick opened straight from its row (an optional choice's one answer) has no list above it — B is the row.
  if (optionalPickItem(c)?.optionIndex === item.optionIndex) {
    return undefined;
  }
  const declineAt = choiceDecline(c)?.index;
  const at = buildOrItems(c.input as OrOptionsModel).filter((it) => it.optionIndex !== declineAt)
    .findIndex((it) => it.optionIndex === item.optionIndex);
  return {kind: 'list', choiceId, index: Math.max(0, at)};
}
/**
 * The step's ASK — read from the server's own prompt, never from a card.
 * A branch that declares `mergeCardSteps` is ONE up-to-N question whose
 * slots the composer collapses into this choice; everything else is a
 * single «point at one card».
 */
function playedTargetSelectionFor(c: ComposerChoice): PlayedTargetSelection {
  if (!isMergedPickChoice(c)) {
    return {mode: 'single'};
  }
  const merge = selectedBranch.value?.mergeCardSteps;
  return {
    mode: 'multi',
    min: merge?.min ?? 0,
    max: Math.max(1, mergeCardStepCount.value),
    picked: sub.value?.kind === 'playedTarget' && sub.value.choiceId === c.id ?
      sub.value.picked :
      ((multiPicks.value[c.id] ?? []) as ReadonlyArray<string>),
  };
}
/** A in a MULTI ask toggles instead of choosing — the cap is stated, never
 *  silently enforced (the contract line says «снимите выбор с другой»). */
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
/** RT — submit a MULTI ask. The response is the ONE merged
 *  `{type:'card', cards:[…]}` the server's `mergeCardSteps` expects. */
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
  // The player's own answer is never a seed: a set that is no longer «all of them» drops the mark (ledger CU).
  if (seeded.value[choice.id] === 'all' && !sameCardNames(allSeedOf(choice) ?? [], cards)) {
    const {[choice.id]: _seed, ...seededNow} = seeded.value;
    seeded.value = seededNow;
  }
  multiPicks.value = {...multiPicks.value, [choice.id]: cards};
  picks.value = {...picks.value, [choice.id]: String(cards.length)};
  captureFor(choice, {type: 'card', cards});
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
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
/** Keep the cursored candidate inside the STEP's own candidate viewport.
 *  The step owns that scroller — the contract and the status rail live
 *  outside it, so a cursor move can never carry the rail off screen. */
function scrollPlayedTargetFocused(): void {
  targetStep.value?.ensureFocusVisible?.();
}
/** LB/RB — the owner axis, tabbed mode only (in split the groups are both
 *  on screen and the d-pad crosses between them spatially). */
function cyclePlayedTargetOwner(delta: number): void {
  // A PAGED band (the owner, 2026-11-02): LB/RB turn its page where they walk nothing else (one band / the split).
  if (sub.value?.kind === 'playedTarget') {
    const turned = turnPlayedTargetPageVia(targetStep.value, sub.value.focus, delta);
    if (turned !== undefined) {
      sub.value = {...sub.value, focus: turned};
      targetStep.value?.ensureFocusVisible?.();
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
  // `board` («ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА»): every band is on screen — LB/RB JUMP to the next band's first card.
  if (playedTargetLayout.value.mode === 'board') {
    sub.value = {...sub.value, focus: reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? sub.value.focus};
    targetStep.value?.ensureFocusVisible?.();
    return;
  }
  // Restore this owner's last cursor — a tab the player returns to should
  // be where they left it, not reset to its first card.
  const remembered = playedTargetOwnerFocus.value[ownerId] ?? 0;
  playedTargetOwnerFocus.value = {...playedTargetOwnerFocus.value, [sub.value.focus.ownerId]: sub.value.focus.index};
  sub.value = {...sub.value, focus: reseatPlayedTargetFocus({ownerId, index: remembered}, owners) ?? sub.value.focus};
}
/** A — lock the focused candidate in as this choice's target. */
function confirmPlayedTarget(): void {
  if (sub.value?.kind !== 'playedTarget') {
    return;
  }
  const owners = playedTargetModel.value?.owners ?? [];
  const candidate = playedTargetAt(sub.value.focus, owners);
  // VIRUS'S ONE ZONE: the candidate answers through the step's own target key — its response verbatim.
  const tabbed = sub.value.tabbed;
  if (tabbed !== undefined) {
    const step = tabbedSteps.value.find((t) => t.index === tabbed)?.step;
    const pickKey = candidate === undefined || candidate.blocked !== undefined || step === undefined ?
      undefined : tabbedTargetZone(step).pickKeys.get(candidate.cardName);
    const target = pickKey === undefined || step === undefined ? undefined : tabbedTargets(step).find((t) => t.key === pickKey);
    if (target === undefined) {
      return;
    }
    picks.value['tabbed#' + tabbed] = target.key;
    captured.value[tabbed] = target.response;
    sub.value = undefined;
    landCursor();
    scrollFocused();
    return;
  }
  const choice = playedTargetChoice.value;
  // A shown near miss is never chosen — the rail reads why, the bar's A is dim.
  if (candidate === undefined || choice === undefined || candidate.blocked !== undefined) {
    return;
  }
  // THE TABLE'S ONE ZONE: the bot's tile answers the bot branch (the bare option, as the list sent it); a card answers
  // the players' card branch below, nested as every or-option's card pick is.
  const table = sub.value.orItem === undefined ? tableTargetOf(choice.input) : undefined;
  if (table !== undefined && isTableTargetStand(candidate.cardName)) {
    const botItem = buildOrItems(choice.input as OrOptionsModel).find((it) => it.optionIndex === table.botBranch);
    if (botItem === undefined) {
      return;
    }
    const results = {...playedTargetResults.value};
    delete results[choice.id];
    playedTargetResults.value = results;
    const picksNow = {...picks.value, [choice.id]: String(table.botBranch)};
    delete picksNow[nestedPickKey(choice.id)];
    picks.value = picksNow;
    captureFor(choice, orItemResponse(botItem));
    sub.value = undefined;
    landCursor();
    scrollFocused();
    return;
  }
  const result = playedTargetResultOf(candidate, owners, playedTargetVersion.value);
  playedTargetResults.value = {...playedTargetResults.value, [choice.id]: result};
  // The capture the batch submits is the same shape every card pick uses —
  // the rich result is presentation + future-animation context, never a
  // second source of truth for what was answered… and when the step is
  // answering an OR-OPTION, that same shape nests into the option.
  const orItem = sub.value.orItem ?? (table !== undefined ?
    buildOrItems(choice.input as OrOptionsModel).find((it) => it.optionIndex === table.cardBranch) : undefined);
  if (orItem !== undefined) {
    picks.value = {...picks.value, [choice.id]: String(orItem.optionIndex), [nestedPickKey(choice.id)]: candidate.cardName};
    captureFor(choice, orItemResponse(orItem, {type: 'card', cards: [candidate.cardName]}));
  } else {
    captureFor(choice, {type: 'card', cards: [candidate.cardName]});
    picks.value = {...picks.value, [choice.id]: candidate.cardName};
  }
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
/**
 * THE EMBEDDED SELECTOR'S MODEL for ONE choice — the open step's, a seed's (T14 · CC: a sole candidate is read off
 * the same model the step would draw) and every answered row's liveness. Per CHOICE, never «the» step: a play with
 * two played-card picks judged the second against the first one's owners.
 */
function playedTargetModelFor(choice: ComposerChoice, seedItem?: ConsoleOrItem): PlayedTargetModel | undefined {
  const model = playedTargetInputFor(choice, seedItem);
  const bot = tableTargetBotFor(choice);
  if (model === undefined) {
    // A lone bot in the table's one zone: its group alone.
    return bot === undefined ? undefined : buildPlayedTargetModel({
      candidates: [], stands: bot, players: props.playerView.players, viewerColor: thisPlayer.value.color, ask: '',
      typeOf: (name) => getCard(name)?.type, takesFromTarget: true, preview: () => [],
    });
  }
  // DEDUPE (Cyberia Systems' sequential copy steps): a card an EARLIER
  // step already holds is not a candidate here. The rule lived only in the
  // old tableau-pick branch; it moves with the flow rather than being left
  // behind — the step's contract is «only selectable candidates», and a
  // card that cannot be chosen twice is not selectable a second time.
  const taken = new Set<string>();
  const step = choice.scope === 'step' ? selectedBranch.value?.steps[choice.index] : undefined;
  for (const si of (step !== undefined && step.kind === 'input' ? step.dedupeFromSteps ?? [] : [])) {
    const name = capturedCardNameAt(si);
    if (name !== undefined) {
      taken.add(name);
    }
  }
  return buildPlayedTargetModel({
    candidates: taken.size === 0 ? model.cards : model.cards.filter((c) => !taken.has(c.name)),
    ...(bot !== undefined ? {stands: bot} : {}),
    players: props.playerView.players,
    viewerColor: thisPlayer.value.color,
    // The composer printed the rule and the gain chip: the step's own generic ask would be the third telling.
    ask: model.resourceGainPrompt?.genericTitle === true ? '' : textOf(model.title),
    // The card being PLAYED, which CAN be a candidate for its own on-play
    // effect: Titan Floating Launch-pad adds two floaters to any Jovian card
    // and is itself Jovian, so with no other Jovian card in play it is the
    // only legal target the rules offer. It has no tableau row yet, so the
    // model seats it with the viewer, and it renders as the SAME handle the
    // blue actions use — an arrow pointing at the card already standing in
    // the hero slot, never a second full-size copy of one physical object.
    sourceCardName: props.cardName,
    typeOf: (name) => getCard(name)?.type,
    // A NEGATIVE delta means the step takes FROM the chosen card, which is
    // what makes «your own card» a warning rather than the ordinary target.
    takesFromTarget: (choice.amount ?? 0) < 0,
    // The near misses of a step taking more than one (TR52: a card with 1 data) — shown with the server's reason.
    blocked: playedTargetShortfalls(model.disabledCards, choice.amount, (c) => textOf(c.disabledReason), model.resourceGainPrompt?.holdsAtLeast),
    preview: (name) => playedTargetPreview(choice, name),
    resourceContext: (_name, card) => playedTargetResourceContext(choice, card),
    // «КУДА: 3 [мех]» (TR56, П3) — what lands, carried from the tile it was chosen on.
    payload: payloadFor(choice),
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
/** A — open the table's one zone for a marked `or` (false: nothing to point at, the list stays the door). */
function openTableTargetZone(c: ComposerChoice): boolean {
  openPlayedTargetStep(c);
  return sub.value?.kind === 'playedTarget';
}
/** The summary of an answered played-target choice (undefined = unanswered
 *  or gone stale — a target whose card left the table is never shown as
 *  chosen, and never submitted). */
function playedTargetResult(c: ComposerChoice): PlayedTargetResult | undefined {
  const result = playedTargetResults.value[c.id];
  if (result === undefined) {
    return undefined;
  }
  const owners = (playedTargetChoice.value?.id === c.id ? playedTargetModel.value : playedTargetModelFor(c))?.owners ?? [];
  return playedTargetResultLive(result, owners, playedTargetVersion.value) ? result : undefined;
}
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
function targetSummaryImpacts(c: ComposerChoice): ReadonlyArray<PlayedTargetQuickImpact> {
  const result = playedTargetResult(c);
  if (result === undefined) {
    return [];
  }
  return playedTargetReadingImpacts(result.preview).slice(0, PLAYED_TARGET_SUMMARY_IMPACT_CAP);
}
/**
 * WHAT LANDS on the card a pick chooses (TR56 «КУДА ЛЯЖЕТ») — the step's header and the row's label read the same:
 * the branch's own print when the pick IS the selected branch's one gain pick, else its amount and resource.
 */
function payloadFor(c: ComposerChoice): PlayedTargetPayload | undefined {
  const model = playedTargetInputFor(c);
  return playedTargetPayloadOf({amount: c.amount, cardResource: c.cardResource}, model?.resourceGainPrompt,
    c.scope === 'step' ? selectedVariantPrint.value : undefined);
}
/** The target row's label when it carries no payload — the role once answered, the server's ask before. */
function targetRowLabel(c: ComposerChoice): string {
  if (playedTargetResult(c) !== undefined) {
    return translateText(cardPickRoleKey(c.amount));
  }
  // A spend's SOURCE asks by its direction (PL-056 — «Выберите карту-источник», never «выберите себе карту»).
  return (c.amount ?? 0) < 0 ? translateText(cardPickAskKey(c.amount)) : choiceTitle(c);
}
/** The server's candidates of a target pick — the unanswered row's strip. */
function targetRowCandidates(c: ComposerChoice): ReadonlyArray<CardModel> {
  return playedTargetInputFor(c)?.cards ?? [];
}
/** The chosen card's model as the server sent it — the miniature's capsule reads its count. */
function targetRowModel(c: ComposerChoice): CardModel | undefined {
  const name = playedTargetResult(c)?.cardName;
  return name === undefined ? undefined : playedTargetInputFor(c)?.cards.find((card) => card.name === name);
}
/** An `or` choice answered THROUGH the embedded step reads as the target row too (the action composer's rule). */
function orAnsweredOnTable(c: ComposerChoice): boolean {
  return orTableAnswerItem(c) !== undefined && playedTargetResult(c) !== undefined;
}
/** The chosen candidate's outcome tag — the step's own line under that card (PL-219), read again on the row. */
function targetRowTag(c: ComposerChoice): PlayedTargetTag | undefined {
  const result = playedTargetResult(c);
  return result === undefined ? undefined : playedTargetTagOfPreview(result.preview);
}
// (`openTableauPick` is gone. Every played-card pick this flow has — the
// single «point at one card» ask AND the server's merged up-to-N ask —
// is hosted by the EMBEDDED played-target step, so the old lift-out-of-
// the-tableau surface is unreachable from card play. The «Разыграно»
// view keeps it for the blue-action composer until that flow migrates,
// after which it becomes a browsing surface only.)
function capturedCardNameAt(stepIndex: number): CardName | undefined {
  const resp = captured.value[stepIndex] as {type?: string, cards?: ReadonlyArray<CardName>} | undefined;
  return resp?.type === 'card' ? resp.cards?.[0] : undefined;
}
/**
 * Hand a hand-card pick (single OR multi-select — Public Plans) to the HAND
 * SECTION's premium pick mode (consoleHandPick bridge): the shell hides
 * this composer (v-show — every capture survives), the player picks on the
 * real cards, and the result lands back here as the step's capture. A
 * re-open (A = «Изменить») pre-seeds the previous selection.
 *
 * …at EVERY depth: `orItem` is an option of an `or` choice whose own
 * question is that pick (Mars University's «discard a card to draw one»
 * beside «do nothing» — a table question, TR51). The album answers it and
 * the answer is wrapped back into THAT option (`orItemResponse`); B in the
 * album returns to the option list it was opened from (one level). The
 * owner's hard rule (2026-10-13): a card from the hand is chosen IN the
 * hand, never from a list of names.
 *
 * An OPTIONAL choice (`optionalChoice.ts`) carries its DECLINE into the
 * album (the plate in its question line, RT answers it); an album opened
 * straight from the choice's row (its one answer is this pick —
 * `optionalPickItem`, no list stood before it) returns B to the row.
 */
function openHandPick(c: ComposerChoice, orItem?: ConsoleOrItem): void {
  const model = (orItem?.nested ?? c.input) as SelectCardModel;
  const reasons: Record<string, string> = {};
  for (const d of model.disabledCards ?? []) {
    reasons[d.name] = d.disabledReason !== undefined ? textOf(d.disabledReason) : '';
  }
  // TWO DISCARDS ANSWERED BEFORE THE PRESS NEVER NAME ONE CARD (the card's own discard and Mars University's, two
  // university questions): the second would meet a hand without it. A card another discard holds is refused here,
  // with its reason — shown, never hidden.
  const held = model.discardPrompt !== undefined ? cardsHeldByOtherDiscards(discardAnswers.value, c.id) : new Set<string>();
  for (const name of held) {
    reasons[name] = translateText('Already chosen for another discard');
  }
  // A table question that MAY WAIT FOR A DRAW (2026-10-15): the album carries the way back to «after the draw» —
  // R3 «Решить после добора», its plate beside the decline's.
  const defer = c.reaction !== undefined ? deferPlateOf(tableRowState(c)) : undefined;
  if (c.reaction !== undefined) {
    offeredSeen.value[c.id] = true;
  }
  const multi = isMultiCardChoice(c);
  const answered = orItem !== undefined && picks.value[c.id] === String(orItem.optionIndex) ?
    (picks.value[nestedPickKey(c.id)]?.split(NESTED_PICK_SEP) ?? []) : [];
  const prior = orItem !== undefined ?
    answered as Array<CardName> :
    (multi ?
      [...(multiPicks.value[c.id] ?? [])] as Array<CardName> :
      (picks.value[c.id] !== undefined ? [picks.value[c.id] as CardName] : []));
  const gain = c.multiSelect?.revealGain;
  const discard = model.discardPrompt;
  handPickOpen.value = {choiceId: c.id, discard: discard !== undefined};
  enterConsoleHandPick({
    title: model.title,
    buttonLabel: model.buttonLabel || 'Select',
    selectable: model.cards.map((cd) => cd.name).filter((name) => !held.has(name)),
    reasons,
    min: model.min ?? 1,
    max: model.max ?? 1,
    selected: prior,
    // …and its SECOND payout in cards (Strategic Shift: «+1 M€ AND draw a card» per card thrown) — the album's
    // running summary reads both.
    gainPerCard: gain !== undefined ? {icon: gain.resource, amount: gain.amount, cards: c.multiSelect?.drawPerCard} : undefined,
    // The pick names WHY it is asked: the card whose question it answers — the reacting card for a table
    // question (L3 «Источник» lifts it), else the card being played.
    source: {kicker: 'Play card', card: c.reaction?.card ?? props.cardName},
    // The server's own DISCARD marker, raw — the album wears the discard's skin (copy, verb, what it buys)…
    discard,
    // …and nothing leaves: this is a PRE-SELECT, the card goes only when the play's ONE POST is answered.
    leaving: 'none',
    // An optional choice's refusal — a button inside the album, never a row before it.
    decline: orItem !== undefined ? choiceDecline(c) : undefined,
    // …and a question that may wait for a draw: the way back to «after the draw».
    defer,
  }, (cards) => {
    handPickOpen.value = undefined;
    // Re-locate the choice by id — the preview may have refreshed under
    // the pick (a poll landed) and the captured index must stay honest.
    const cur = allChoices.value.find((x) => x.id === c.id) ?? c;
    if (orItem !== undefined) {
      if (cards.length === 0 && (model.min ?? 1) > 0) {
        return;
      }
      picks.value[cur.id] = String(orItem.optionIndex);
      picks.value[nestedPickKey(cur.id)] = cards.join(NESTED_PICK_SEP);
      captureFor(cur, orItemResponse(orItem, {type: 'card', cards: [...cards]}));
      sub.value = undefined;
    } else if (multi) {
      multiPicks.value[cur.id] = [...cards];
      picks.value[cur.id] = String(cards.length);
      captureFor(cur, {type: 'card', cards: [...cards]});
    } else if (cards.length > 0) {
      picks.value[cur.id] = cards[0];
      captureFor(cur, {type: 'card', cards: [cards[0]]});
    }
    landCursor();
    scrollFocused();
  }, () => {
    handPickOpen.value = undefined;
    // B in the album is ONE level: an option's pick goes back to the option list it was opened from, the
    // cursor on that option; a pick opened straight from its row (or a step's own pick) goes back to the row.
    if (orItem !== undefined && optionalPickItem(c)?.optionIndex !== orItem.optionIndex) {
      // …in the list as it is drawn — without the decline, which is no row (`listItems`).
      const declineAt = choiceDecline(c)?.index;
      const at = buildOrItems(c.input as OrOptionsModel).filter((it) => it.optionIndex !== declineAt)
        .findIndex((it) => it.optionIndex === orItem.optionIndex);
      sub.value = {kind: 'list', choiceId: c.id, index: Math.max(0, at)};
    }
  }, () => {
    // RT in the album — the DECLINE: the choice is answered with its refusal, the composer takes the row back.
    handPickOpen.value = undefined;
    answerDecline(allChoices.value.find((x) => x.id === c.id) ?? c);
  }, defer === undefined ? undefined : () => {
    // R3 in the album — DECIDE AFTER THE DRAW: whatever was chosen before is let go, the row reads «Спросят после
    // добора» again, the batch will post nothing for it.
    handPickOpen.value = undefined;
    deferTableQuestion(allChoices.value.find((x) => x.id === c.id) ?? c);
  });
}
/** Leave a table question for after the draw: its early answer (if any) is cleared; the walk goes on. */
function deferTableQuestion(c: ComposerChoice): void {
  delete picks.value[c.id];
  delete picks.value[nestedPickKey(c.id)];
  captureFor(c, undefined);
  offeredSeen.value[c.id] = true;
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
/**
 * DESCEND into an `or` option whose own answer is a question. WHERE it is answered is ONE verdict
 * (`handPickRouting.orOptionDoor`): a pick FROM THE HAND opens the hand album — the list of names it used to open is
 * what the owner's photo of Mars University showed; a pick over cards ON THE TABLE opens the SAME embedded target
 * step a bare card pick opens (grouped by owner — «Научный прорыв» beside a MarsBot option, exactly as the action
 * composer serves Predators); anything else stays the composer's own list.
 */
function descendOrOption(c: ComposerChoice, item: ConsoleOrItem): void {
  const door = orOptionDoor(item.nested, handNamesSet.value, playedNamesSet.value, props.cardName);
  if (door === 'hand') {
    // The option list STAYS the composer's level while the album answers (the stage lets go of exactly what the
    // player was looking at — closing it here re-rendered the review for the length of the release); the answer
    // closes it, B in the album returns to it.
    openHandPick(c, item);
    return;
  }
  if (door === 'table') {
    openPlayedTargetStep(c, item);
    // …and a descent ALWAYS lands somewhere: a step with nothing to point at closes again, the list stays.
    if (sub.value?.kind === 'playedTarget') {
      return;
    }
  }
  sub.value = {kind: 'orNested', choiceId: c.id, item, index: 0};
}
// SUB state (pick list / payment lanes): A(primary) pick/close, X(inspect)
// zoom the list card, B back, LB/RB(prev/nextSection) adjust lane, RT max.
function onSubPress(action: ConsoleAction): void {
  const subNow = sub.value;
  if (subNow === undefined) {
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
  switch (action) {
  case 'primary':
    if (subNow.kind === 'playedTarget') {
      // SINGLE: A chooses and the step closes. MULTI: A toggles — the
      // merged ask is submitted with RT, so a stray A can never send a
      // half-built selection.
      if (playedTargetSelection.value.mode === 'multi') {
        togglePlayedTarget();
      } else {
        confirmPlayedTarget();
      }
      return;
    }
    if (subNow.kind === 'payment') {
      // «Готово» — fold the editor back into the compact summary. The mix
      // is KEPT (payCounts is the single source of truth for both modes).
      if (paymentReady.value) {
        closePaymentEditor();
      }
      return;
    }
    pickListItem(subNow.index);
    return;
  case 'inspect':
    // X lifts the FOCUSED candidate through the one fullscreen viewer; the
    // step stays mounted underneath, so closing it returns to the same
    // owner, the same slot and the same rail reading.
    if (subNow.kind === 'playedTarget') {
      inspectPlayedTarget();
      return;
    }
    if (subNow.kind !== 'payment') {
      inspectListItem(subNow.index);
    }
    return;
  case 'back':
    // B is ONE logical level: back to the play step, with the payment and
    // every other capture exactly as they were — and a descent INTO an
    // or-option (its list of names, or its embedded target step) folds back
    // to the option list it opened from, never straight out to the review.
    if (subNow.kind === 'orNested') {
      sub.value = orListSub(subNow.choiceId, subNow.item);
    } else if (subNow.kind === 'playedTarget' && subNow.orItem !== undefined) {
      sub.value = orListSub(subNow.choiceId, subNow.orItem);
    } else {
      sub.value = undefined;
    }
    return;
  case 'prevTab':
    // LT toggles the density back — the same button that expanded it.
    if (subNow.kind === 'payment') {
      closePaymentEditor();
    }
    return;
  case 'prevSection':
  case 'nextSection':
    // LB/RB own the OWNER axis in the embedded step's tabbed mode (in
    // split view both groups are on screen and the d-pad crosses between
    // them spatially, so the bumpers would only duplicate it).
    if (subNow.kind === 'playedTarget') {
      cyclePlayedTargetOwner(action === 'prevSection' ? -1 : 1);
      return;
    }
    if (subNow.kind === 'payment') {
      adjustPayRow(subNow.index, action === 'prevSection' ? -1 : 1);
    }
    return;
  case 'nextTab':
    // RT — submit the merged up-to-N ask (the same button the hand's
    // multi pick and the patent sale confirm with); on a single pick that
    // answers an OPTIONAL choice it is the DECLINE.
    if (subNow.kind === 'playedTarget') {
      if (subNow.tabbed !== undefined) {
        if (subDecline.value !== undefined) {
          answerTabbedDecline(subNow.tabbed, subDecline.value);
        }
      } else if (playedTargetSelection.value.mode === 'multi') {
        confirmPlayedTargetPicks();
      } else if (subDecline.value !== undefined && playedTargetChoice.value !== undefined) {
        answerDecline(playedTargetChoice.value);
      }
      return;
    }
    if (subNow.kind === 'payment') {
      adjustPayRow(subNow.index, 0, true);
      return;
    }
    // …and on an OPTIONAL choice RT is its DECLINE (the refusal is a button, never a row, never B).
    if (subNow.kind === 'tabbed' && subDecline.value !== undefined) {
      answerTabbedDecline(subNow.stepIndex, subDecline.value);
    } else if (subDecline.value !== undefined && subChoice.value !== undefined) {
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
/** A tabbed removal answered with its DECLINE — the step's top-level skip, captured like any target. */
function answerTabbedDecline(stepIndex: number, decline: DeclineModel): void {
  picks.value['tabbed#' + stepIndex] = TABBED_DECLINE_KEY;
  captured.value[stepIndex] = {type: 'or', index: decline.index, response: {type: 'option'}};
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
/** The choice is answered with its DECLINE — the same capture a picked decline row once made. */
function answerDecline(c: ComposerChoice): void {
  const oc = optionalChoiceOf(c.input);
  if (!declineIsButton(oc)) {
    return;
  }
  picks.value[c.id] = String(oc.decline.index);
  delete picks.value[nestedPickKey(c.id)];
  captureFor(c, declineResponse(oc));
  // A decline is the player's own answer — a seed it replaces lets go (or the reseat would put it back).
  if (seeded.value[c.id] !== undefined) {
    const {[c.id]: _seed, ...seededNow} = seeded.value;
    const {[c.id]: _result, ...results} = playedTargetResults.value;
    seeded.value = seededNow;
    playedTargetResults.value = results;
  }
  sub.value = undefined;
  landCursor();
  scrollFocused();
}
/**
 * An optional choice whose ONE answer is a pick (Mars University's discard) has no list: A on its row opens that
 * pick directly — the hand album, or the pick's own list — with the decline inside it. `false` = not this shape.
 */
function openOptionalPick(c: ComposerChoice): boolean {
  const item = optionalPickItem(c);
  if (item === undefined) {
    return false;
  }
  // Through the ONE door a descent takes (`descendOrOption` — the hand album or the pick's own list).
  descendOrOption(c, item);
  return true;
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
 * LT — EXPAND the payment block in place: the same rows in the same place,
 * now with a cursor. Only reachable when there is MORE than one alternative
 * source (a single one is dialed inline — the editor would be this very
 * screen again), so the cursor opens on the first editable row.
 */
function openPaymentEditor(): void {
  if (!payEditorAvailable.value) {
    return;
  }
  sub.value = {kind: 'payment', index: 0};
}
/**
 * Fold the editor back to the compact summary, keeping the chosen mix.
 * Deliberately does NOT scroll: the column's content is identical in both
 * densities, so the view is already exactly where the player left it —
 * calling `scrollFocused` here nudged the scroll offset on a tall (4K)
 * composer and moved the CTA, which is precisely what this whole rework
 * removes (caught by tests/e2e/console-payment-panel.spec.ts at 4K).
 */
function closePaymentEditor(): void {
  sub.value = undefined;
  landCursor();
}
/** Select a variant (from navigation) — resets the branch-specific captures
 *  and re-seeds defaults. Focus is owned by the caller (nav), not changed here. */
function setSelectedVariant(pos: number): void {
  const branch = branches.value[pos];
  if (branch === undefined || !branch.available || selectedPos.value === pos) {
    return;
  }
  selectedPos.value = pos;
  // Branch-specific captures reset (desktop selectBranch parity). The card-level answers (`pre#…` — the table's
  // questions, TR51) are the PLAY's, not the variant's: their captures (`capturedPre`) and their labels survive.
  captured.value = {};
  venusParts.value = {};
  capturedOption.value = undefined;
  picks.value = keepPlayAnswers(picks.value);
  multiPicks.value = keepPlayAnswers(multiPicks.value);
  // …the variant's TARGET answer too (TR56, П5): its row lets go by a phrase back to the NEW kind's candidates.
  playedTargetResults.value = keepPlayAnswers(playedTargetResults.value);
  seeded.value = keepPlayAnswers(seeded.value);
  amounts.value = {};
  floaters.value = {};
  repeatResult.value = undefined;
  seedChoiceDefaults();
}
function pickListItem(index: number): void {
  const subNow = sub.value;
  const item = listItems.value[index];
  if (subNow === undefined || item === undefined || item.disabled) {
    return;
  }
  // TABBED target (Virus) — captures the top-level or-response into its step.
  if (subNow.kind === 'tabbed') {
    const ts = tabbedSteps.value.find((t) => t.index === subNow.stepIndex);
    const target = ts !== undefined ? tabbedTargets(ts.step).find((t) => t.key === item.key) : undefined;
    if (target === undefined) {
      return;
    }
    picks.value['tabbed#' + subNow.stepIndex] = target.key;
    captured.value[subNow.stepIndex] = target.response;
    sub.value = undefined;
    landCursor();
    return;
  }
  const c = subChoice.value;
  if (c === undefined) {
    return;
  }
  // NESTED-input or option target (Comet for Venus) → nest the response.
  if (subNow.kind === 'orNested') {
    const nested = subNow.item.nested;
    let nestedResp: unknown;
    if (nested?.type === 'player' && item.color !== undefined) {
      nestedResp = {type: 'player', player: item.color};
    } else if (nested?.type === 'card' && item.card !== undefined) {
      nestedResp = {type: 'card', cards: [item.card.name]};
    } else {
      return;
    }
    picks.value[c.id] = String(subNow.item.optionIndex);
    picks.value[nestedPickKey(c.id)] = nested?.type === 'player' ? String(item.color) : String(item.card?.name);
    captureFor(c, orItemResponse(subNow.item, nestedResp));
    sub.value = undefined;
    landCursor();
    return;
  }
  // sub.kind === 'list'
  if (c.input.type === 'card' && item.card !== undefined) {
    picks.value[c.id] = item.card.name;
    captureFor(c, {type: 'card', cards: [item.card.name]});
  } else if (c.input.type === 'player' && item.color !== undefined) {
    picks.value[c.id] = item.color;
    captureFor(c, {type: 'player', player: item.color});
  } else if (c.input.type === 'or') {
    const it = item.orItem;
    if (it === undefined) {
      return;
    }
    // A NESTED-input option is not an answer — it is the next question, asked where it belongs (don't submit yet).
    if (it.nested !== undefined) {
      descendOrOption(c, it);
      return;
    }
    picks.value[c.id] = String(it.optionIndex);
    delete picks.value[nestedPickKey(c.id)];
    delete playedTargetResults.value[c.id];
    captureFor(c, orItemResponse(it));
  } else {
    return;
  }
  sub.value = undefined;
  landCursor();
}
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
  // THE ONE DOOR — with the TARGET DOSSIER. The REF, never `$el` — see the note on the root element.
  if (playedTargetModel.value !== undefined) {
    openPlayedTargetZoom({model: playedTargetModel.value, cardName: candidate.cardName, getRoot: () => composerRootEl()});
  }
}
function inspectListItem(index: number): void {
  const item = listItems.value[index];
  if (item?.card === undefined) {
    return;
  }
  const cards = listItems.value.filter((it) => it.card !== undefined).map((it) => it.card as CardModel);
  // The target options render as TEXT rows (not card tiles), so the
  // fullscreen is a TEXTUAL inspector — no fake lift out of a text line.
  openConsoleCardZoom(cards, Math.max(0, cards.findIndex((cd) => cd.name === item.card?.name)), undefined, undefined, {origin: {kind: 'textual'}});
}
/**
 * Dial ONE payment source — the single mutation both densities go through
 * (the compact quick-adjust below delegates here), so the mix a player
 * builds in the editor and the one the bumpers build on the main screen are
 * literally the same state. The value comes from the pure `dialLaneCount`,
 * which enforces the AGGREGATE anti-overpay limit here rather than only in
 * the row's paint — a fast repeat can fire twice between two renders, and
 * `RT МАКС.` must read what the other sources already pay.
 */
function adjustPayRow(idx: number, step: number, toMax = false): void {
  const row = payEditableRows.value[idx];
  const lane = row !== undefined ? payLanes.value.find((l) => l.unit === row.unit) : undefined;
  if (lane === undefined) {
    return;
  }
  const cur = payCount(lane.unit);
  const next = dialLaneCount(cost.value, lane, payLanes.value, payCounts.value, toMax ? 'max' : step);
  if (next === cur) {
    return;
  }
  payCounts.value = {...payCounts.value, [lane.unit]: next};
  payFlashNonce.value += 1;
}
/** The compact quick-adjust: LB (−1) / RB (+1) / RT (MAX) on the SINGLE alt
 *  source; M€ auto-rebalances. Guarded by the row's own canDecrease/
 *  canIncrease so a dead press is a no-op (never an invalid mix). */
function adjustQuickPayment(step: number, toMax = false): void {
  const row = quickAdjustChip.value;
  if (row === undefined) {
    return;
  }
  if ((step > 0 && !row.canIncrease) || (step < 0 && !row.canDecrease)) {
    return;
  }
  adjustPayRow(payEditableRows.value.findIndex((r) => r.unit === row.unit), step, toMax);
}
function submit(): void {
  const b = selectedBranch.value;
  if (b === undefined || !canConfirm.value || submitting.value) {
    return;
  }
  submitting.value = true;
  // The prompt this commit answers — once the server holds another, the answer was taken (`composerReArms`).
  answeredFor.value = props.playerView.waitingFor?.promptId;
  leaveCommit(commitArrival.value);
  const payment: Payment = paymentFromCounts(cost.value, payLanes.value, payCounts.value, megacreditsOnHand.value);
  // The espionage response is ASSEMBLED at the commit: the captured target
  // plus the owner's landing answer folded from the synthetic rows — the
  // one wire entry; the synthetic rows themselves never reach the batch.
  let capturedNow = captured.value;
  // A table question handed on as a follow-up (a draw above it) posts no answer — it is asked for real.
  const capturedPreNow: Record<number, unknown> = Object.fromEntries(Object.entries(capturedPre.value).filter(([i]) =>
    !followUpChoices.value.some((c) => c.scope === 'pre' && c.reaction !== undefined && c.index === Number(i))));
  const esp = espionageChoice.value;
  if (esp !== undefined) {
    const projection = (esp.input as DeltaEspionageInputModel).projection;
    capturedNow = {...capturedNow, [esp.index]: deltaEspionageStepResponse(projection, espionageCapture.value?.target, espionageOwnerAnswer.value)};
  }
  armCommitWitness();
  // The Venus bonus this play pre-selected flies off its cell once the board tells the step (P89 · EL, PL-1437).
  armVenusPreselects();
  emit('confirm', {
    branchIndex: b.index,
    // The branch slot's pre-select address — the server's (`ActionPreviewBranch.for`).
    branchFor: b.for,
    preResponses: preview.value !== undefined ? orderedPreResponses(preview.value, capturedPreNow) : [],
    optionResponse: capturedOption.value,
    stepResponses: orderedStepResponses(b, capturedNow),
    payment,
    // The IMMEDIATE resource gains of this play (stock / production /
    // card-resources with their pre-selected hosts), extracted from the
    // server-computed preview — the hero scene's reward beat carries
    // them from the landed card onto the left panel.
    // …minus what a WALK of the Agenda track pays on its own (TR04): those chips are the walk's, delivered off
    // the track's node when the marker lands — the landing scene must not tick them from the card.
    rewards: extractPlayRewards({
      cardName: props.cardName,
      effects: heroRewardEffectsOf(b),
      steps: b.steps,
      stepResponses: captured.value,
    }),
    // HOW MANY CARDS this play PROMISES — the same structural read every
    // other workspace uses (a `cards` gain in the chosen branch). A HINT
    // for the arrival's size, never a gate: the workspace claims its
    // follow-up either way, because a triggered effect (Point Luna's Earth
    // tag) draws cards no preview can advertise.
    // …and its RAIL HALF (PL-001 for plays): the branch's direct TR, flown by the same beat from the landed
    // card's printed TR AFTER the gains above, the rating ticking on the touchdown; the table's answer to it
    // (an exact forecast fact for this seat — the ruling Greens' M€) a beat after. The play's own price rides
    // along for the diff check the seed makes against the two views.
    // …with the printed TAG each card answer was woken by (T06 GMO Contract): the landing scene births that answer's
    // token on the landed card's tag, the row ticking on its touchdown — never a number changing a beat later.
    // …and the rating's CARD answers (TR81 Lotus Innovations' data on itself) ride the same half, after the TR.
    rail: withRailAnswerTags(playRailReward(b, heroRewardEffectsOf(b), captured.value, payment, [
      ...reactionRailSpecs(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts),
      ...ratingAnswerSpecs(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts),
    ]),
    railAnswerTags(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts)),
    // …and THE TABLE'S ANSWER ON THE CARDS (К-S1 — PL-124): the holders of this seat the play wakes (an EXACT
    // forecast fact addressed to «you» whose source is a card — TR05's science data, Decomposers' microbe), with
    // the printed tag that woke each: the landing scene verifies them against the two views and flies each as
    // its own EFFECT RESOLUTION group after the card's own gains. A question or an unknown is never promised.
    reactions: playCardReactions(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts),
    // …and THE PRICE THE PLAY TAKES OFF THE RAIL (the rail-spend law at the play door — PL-107): the branch's
    // stock cost chips (X87's plants and steel), flown by the landing scene INTO the standing card before it
    // lifts, each row ticking on its token's departure. Never the card's own price (the payment panel's).
    spends: playSpendReward(props.cardName, b, captured.value, payment),
    // …and THE CARD'S OWN PRICE IN ALLOYS (PL-1841 ①): the steel / titanium of the payment, a token off the row into
    // the standing card's printed cost before the lift — the table's answer on the same row a known move (Palladin).
    alloyPrice: playAlloyPriceReward(b, captured.value, payment, reactionRailSpecs(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts)),
    // …and THE PLAY'S OWN MOVES on the rail's rows (its price, its chips) — a law that plays this card for a price of
    // its own (RX36's bill, PL-725) checks its token against them: the bill departs first, this price at the landing.
    known: actionKnownRailMoves(b, captured.value, payment),
    // …and the price taken off a card THIS composer's own step chose (PL-268 — TR52's 2 data off a rival's census):
    // born on the answered target row, absorbed into the standing card's printed icons before the lift.
    targetSpends: playTargetSpendSpecs(props.cardName, b, captured.value),
    // …and THE PLAY'S CARD PRICE out of the hand (P86 · PL-1128): the discards this composer pre-selected in the
    // album (nothing left the hand at the pick). The shell arms the ONE discard scene at the submit — the cards
    // leave from the DOCK as the hero's fourth shipment, before the lift (`shipPlayDiscard`).
    discards: preselectedDiscardsOf(b.steps, captured.value),
    // …plus the draw the player's OWN multi pick decides (Strategic Shift: a card per card thrown) — the fixed
    // chips alone would claim nothing for it and the embedded draw stage would wait on the wrong count.
    draws: heroRewardEffectsOf(b).reduce((n, e) =>
      (e.direction === 'gain' && e.icon === 'cards' ? n + Math.max(1, Math.round(e.amount)) : n), 0) + multiPickDraws.value,
    // ProjectInspection: the chosen already-used action + its composed
    // responses (+ nodeIndex / reveal for the in-frame reveal handoff),
    // appended after the play as `[play, {card}, ...composed]`.
    // NEVER for the espionage owner's repeat — that one rides INSIDE the
    // espionage response (`ownerAnswer.repeatResponses`), consumed by the
    // server's own reward resolution at the owner's landing.
    repeat: esp !== undefined ? undefined : repeatResult.value,
    // CORPORATE ESPIONAGE: the shell's execution choreography (the hydro
    // re-entry, the two-actor marker plan) reads the SAME projection +
    // picks the batch carries — one derivation, promise = presentation.
    espionage: esp !== undefined ? {
      projection: (esp.input as DeltaEspionageInputModel).projection,
      target: espionageCapture.value?.target,
      ownerAnswer: espionageOwnerAnswer.value,
    } : undefined,
    // STAGED PLAY: the chosen branch's FIRST Mars placement, when the
    // server's preview marked it stage-able (StagedPlacementModel). The
    // shell then parks the batch and runs the cell pick BEFORE submitting
    // — the cell is the play's last reversible step.
    staged: stagedPlacementOf(b),
    // STAGED VOTE (Turmoil Redux TR03): the branch's `delegateGrant` door —
    // the shell parks the batch and opens the Parliament's vote mode inside
    // this workspace; the resolution confirmed there is the play's one submit.
    stagedVote: playDoor.value?.kind === 'parliament' ? playDoor.value.staged : undefined,
    // STAGED COLONY (Turmoil Redux TR07): the branch's `colonyPick` door — the shell parks the batch and
    // opens the colony grid inside this workspace; the tile confirmed on its stage is the play's one submit.
    stagedColony: playDoor.value?.kind === 'colonies' ? playDoor.value.staged : undefined,
    // «КАРЬЕРА» (Turmoil Redux TR04): the branch's SHOW step — the marker's walk the play will produce. Not a
    // door (nothing is chosen, the play submits here as any other): the shell reads it to owe the hosted
    // outcome to this workspace from the press on.
    agendaWalk: agendaWalkOf(b),
    // …and THE TABLE'S ANSWER to the walk's TR step (PL-002): the forecast's reaction specs (the ruling Greens'
    // M€ for a rating step — the same reading the landing scene's rail half makes) with the play's own price as
    // the rail's known move. The walk's seed checks them against the two views and holds the answer until the
    // step's chip has touched the rail — a reaction never ticks before its reason.
    agendaWalkRail: agendaWalkOf(b) === undefined ? undefined : {
      reactions: reactionRailSpecs(forecastForFixedBranch(forecast.value, selectedPos.value ?? -1)?.facts),
      known: actionKnownRailMoves(b, captured.value, payment),
    },
    // «ДЕЛЕГАТЫ» (Turmoil Redux TR31): the branch's SHOW step — the rally of neutral delegates the play will
    // produce, with the play's own price as the rail's known move (the M€ row moves by the recount AND the
    // price in one answer; the seed's diff check tells them apart). Not a door: the play submits here.
    neutralRally: neutralRallyOf(b, payment),
    // A reward the CELL decides (Arboretum): the card its units will land on — the board's dossier prints
    // that card's «before → after» per cell. The pick itself rides the batch like any other.
    stagedCardTarget: stagedCardTargetOf(),
    // THE ONE-PLAY CLASS (TR49): the armed effects this play SPENDS (the server's forecast) — a STAGED play's
    // landing ritual draws them out of the dock into the card before the board, the answer not being known yet.
    armedSpends: (forecast.value?.modifiers?.consumes ?? []).map((c) => c.armed),
    // …and the raw capture snapshot that restores this very screen when
    // the player comes back from the board with B. Opaque to the shell.
    composerDraft: composerDraftSnapshot(),
  });
}
/**
 * The card picked by a step whose amount the CELL decides (`resourceGainPrompt.amountBasis`, no
 * `amount` — Arboretum's «1 data for each adjacent city»), if one was picked. Structural: the server's
 * marker, never the step's title.
 */
function stagedCardTargetOf(): CardName | undefined {
  for (const choice of stepChoices.value) {
    const meta = choice.input.type === 'card' ? (choice.input as SelectCardModel).resourceGainPrompt : undefined;
    if (meta?.amountBasis !== undefined && meta.amount === undefined) {
      const pick = picks.value[choice.id];
      return pick !== undefined ? pick as CardName : undefined;
    }
  }
  return undefined;
}
/** The walk of the Agenda track the CHOSEN branch promises (TR04's SHOW step), if any. */
function agendaWalkOf(branch: ActionPreviewBranch | undefined): AgendaWalkModel | undefined {
  const step = branch?.steps.find((s) => s.kind === 'agendaWalk');
  return step !== undefined && step.kind === 'agendaWalk' ? step.walk : undefined;
}
/** The rally of neutral delegates the CHOSEN branch promises (TR31's SHOW step), with the play's price as the rail's known move. */
function neutralRallyOf(branch: ActionPreviewBranch | undefined, payment: Payment): {rally: NeutralRallyModel, known: Readonly<Record<string, number>>} | undefined {
  const step = branch?.steps.find((s) => s.kind === 'neutralRally');
  if (step === undefined || step.kind !== 'neutralRally' || branch === undefined) {
    return undefined;
  }
  // The KNOWN moves are the response's OTHER moves on the rail — the price, the branch's other chips — never the
  // recount's own M€ (that is the held cause itself): the step's chips are taken out before the branch is read.
  return {rally: step.rally, known: actionKnownRailMoves({...branch, effects: heroRewardEffectsOf(branch)}, captured.value, payment)};
}
/**
 * THE RALLY'S ROWS (TR31), from the server's plan alone: the stage's lead («Делегаты — нейтральные делегаты в
 * Парламенте»); per named party its resolution — the votes before → after and what that does to the vote
 * (the composer's own winner vocabulary: becomes / stays / still not the winning one, the tie to the slot), a
 * vote the empty supply cut («+0 · нейтральных не осталось»), or the NAMED ZERO of a party with no resolution
 * up for a vote; per area «party · 1 → 2 из 3» or its named zero in the quiet register; then the count the M€
 * stands on («В игре 11 → 14»). Nothing here is computed: every number is the plan's.
 */
function rallyRows(rally: NeutralRallyModel): Array<NextStepRow> {
  const rows: Array<NextStepRow> = [noteRow(translateText('Delegates — neutral delegates in the Parliament'))];
  const resolutionName = (id: string) => translateText(getResolution(id)?.text.name ?? id);
  const partyName = (party: string) => translateText(partyNameKey(party));
  for (const party of rally.parties) {
    const votes = rally.votes.filter((v) => v.party === party);
    if (votes.length === 0) {
      if (rally.missing.includes(party)) {
        rows.push(noteRow(translateTextWithParams('${0} — no resolution up for a vote', [partyName(party)])));
      }
      continue;
    }
    for (const vote of votes) {
      if (!vote.placed) {
        rows.push(noteRow(`${resolutionName(vote.resolution)} · +0 · ${translateText('no neutral delegates left')}`));
        continue;
      }
      const verdict = vote.winningAfter ?
        (vote.winningBefore ? 'Stays the leading resolution' :
          vote.tieNote === 'slot-priority' ? 'Becomes the leading resolution — the tie goes to the slot closer to Enacted' : 'Becomes the leading resolution') :
        'Still not the leading resolution';
      rows.push(noteRow(`${resolutionName(vote.resolution)} · ${vote.votesBefore} → ${vote.votesAfter} · ${translateText(verdict)}`));
    }
  }
  for (const area of rally.support) {
    const name = partyName(area.party);
    if (area.gained > 0) {
      rows.push(noteRow(`${name} · ${translateTextWithParams('${0} → ${1} of ${2}', [String(area.current), String(area.resulting), String(PARLIAMENT_MAX_POPULAR_SUPPORT)])}`));
    } else {
      rows.push(noteRow(`${name} · +0 · ${translateText(area.limit === 'supply' ? 'no neutral delegates left' : 'area is full')}`));
    }
  }
  // The count of neutral delegates in use is TR31's basis for its M€ — a rally that pays no recount does not print it.
  if (rally.recount) {
    rows.push(noteRow(translateTextWithParams('In use ${0} → ${1}', [String(rally.inUse.before), String(rally.inUse.after)])));
  }
  return rows;
}
/** The staged payload of the CHOSEN branch — first Mars boardPlacement
 *  step carrying `staged` (D2: only the first placement ever carries it). */
function stagedPlacementOf(b: ActionPreviewBranch): StagedPlacementModel | undefined {
  for (const step of b.steps) {
    if (step.kind === 'boardPlacement' && step.staged !== undefined) {
      return step.staged;
    }
  }
  return undefined;
}
function composerDraftSnapshot(): PlayComposerDraft {
  return {
    cardName: props.cardName,
    selectedPos: selectedPos.value,
    capturedPre: {...capturedPre.value},
    capturedOption: capturedOption.value,
    captured: {...captured.value},
    amounts: {...amounts.value},
    floaters: {...floaters.value},
    picks: {...picks.value},
    multiPicks: {...multiPicks.value},
    payCounts: {...payCounts.value} as Record<string, number>,
    playedTargetResults: {...playedTargetResults.value},
    seeded: {...seeded.value},
    focusIdx: focusIdx.value,
  };
}
function scrollFocused(): void {
  void nextTick(() => {
    // The payment editor's cursor lives INSIDE the shared panel (a child
    // component), so it is located by its rendered focus class instead of
    // a template ref — the panel stays purely presentational.
    // THE DOCK (P81 · DJ): the payment and the commit stand on the sheet's bottom line, outside the scroll — there
    // is nothing to bring into view (and asking the scroller to reach them would scroll the result away).
    const scrollNow = scroll.value ?? undefined;
    const inScroll = (el: Element | null | undefined): boolean => el !== null && el !== undefined && scrollNow?.rootEl?.contains(el) === true;
    if (payExpanded.value) {
      const row = (composerRootEl())?.querySelector('.con-payrow--focused');
      if (inScroll(row)) {
        scrollNow?.ensureVisible?.(row);
      }
      return;
    }
    const el = focusedEl.value ?? undefined;
    // The variant grammar's focused option has no template ref here (it is the component's own DOM).
    const node = (Array.isArray(el) ? el[0] : el) ??
      (composerRootEl())?.querySelector('.con-vchoice__opt--focused') ?? undefined;
    // Foundation: bounded to the ConsoleScrollArea viewport (never scrollIntoView).
    if (inScroll(node)) {
      scrollNow?.ensureVisible?.(node);
    }
  });
}

watch(() => settleSuspended.value, (now: boolean) => {
  settled.value?.suspend(now);
  settledSheet.value?.suspend(now);
});
/**
 * THE PAYLOAD IS CARRIED, both ways (TR56 «КУДА ЛЯЖЕТ», П3) — a `pre` watcher, so the level that is LEAVING is still
 * in the DOM: in, the selected tile's print is measured before the review unmounts and the step's header print flies
 * in from it; back (A answered, B), the header's print is measured before the step unmounts and the tile's print flies
 * home from it while the review surfaces from inside. The carried object is the one thing that moves between levels.
 */
watch(() => grantWarmIds.value, (ids: string): void => {
  if (ids !== '') {
    preloadResolutionArt((props.playerView.game.parliament?.slots ?? []).map((slot) => slot.resolution));
  }
}, {immediate: true});
watch(() => targetWarmNames.value, (names: string): void => {
  if (names !== '') {
    preloadPremiumCardArt(names.split('|') as Array<CardName>);
  }
});
watch(() => playedTargetStepOpen.value, (now: boolean, was: boolean) => {
  const root = composerRootEl();
  if (root === undefined || now === was) {
    return;
  }
  if (now) {
    const carry = armPayloadCarry(root.querySelector('.con-composer__variants'));
    void nextTick(() => {
      const step = targetStep.value ?? undefined;
      playPayloadCarry(step?.rootEl ?? undefined, step?.payloadEl?.(), carry);
    });
    return;
  }
  const from = armPayloadReturn(root.querySelector('.con-ptsel'));
  // The review RETURNS: the cursor the answer landed (the next question, or the commit — T14 · CC) ARRIVES once it
  // stands — its pose is gated on the root for the phrase (`gateCursorDuringEntry`; a press releases it at once).
  const arrived = gateCursorDuringEntry(root, () => undefined);
  void nextTick(() => playPayloadReturn(composerRootEl(), from, arrived));
});
/** PL-127: the hosted-step declaration, handed to the shell as it changes (cleared with the composer by `resetConsolePlayCardUi`). */
watch(() => hostedStepDeclared.value, (card: string): void => {
  setPlayComposerHostedStep(card);
}, {immediate: true});
/**
 * The SYSTEM OUTCOME of an espionage play with NO legal target: the pick
 * is captured as the explicit no-target response the moment the
 * projection says so — an empty selector must never open, the row reads
 * «атака пропущена», and the CTA stays reachable. A projection WITH a
 * legal target never auto-captures (the pick is mandatory and conscious).
 */
watch(() => espionageProjectionRaw.value, (proj: DeltaEspionageProjectionModel | undefined): void => {
  if (proj === undefined || proj.hasLegalTarget) {
    return;
  }
  const c = espionageChoice.value;
  if (c !== undefined && captured.value[c.index] === undefined) {
    captureFor(c, deltaEspionageStepResponse(proj, undefined, espionageOwnerAnswer.value));
  }
}, {immediate: true});
watch(() => props.cardName, () => {
  // A card change folds the R3 «Эффекты» layer instantly (the surface
  // underneath is being replaced — no fold plays).
  if (fxOpen.value) {
    armForecastInstantFold();
    closeEffectForecastLayer('play');
  }
  closeBoardPeek(true);
  resetCaptures();
  payCounts.value = initialCounts(cost.value, payLanes.value, megacreditsOnHand.value);
  focusIdx.value = 0;
  // The FOCUS PREWARM's synchronous read: a hit means this exact card's
  // preview was fetched under this exact game-state version while the
  // player was still considering it — the composer mounts CONTENT-
  // COMPLETE, so the entry transition never contains a «Загрузка…» row
  // or the layout swap its replacement used to cause. A miss (fast A
  // before the dwell, changed game state) falls back to the live fetch.
  const warmed = takeHandPlayPreview(props.playerView, props.cardName);
  if (warmed.hit) {
    preview.value = warmed.preview;
    loading.value = false;
    applyPreview();
    return;
  }
  preview.value = undefined;
  loading.value = true;
  fetchPreview();
}, {immediate: true});
watch(() => props.playerView, () => {
  // A view past the prompt this commit answered means the play was TAKEN: the composer never fires it again (it
  // may still stand as the play's scene — the espionage's Hydronetwork over it, a landing handing off). A refusal
  // re-arms through `resetSubmitting`, never through a view.
  if (composerReArms({answeredFor: answeredFor.value, live: props.playerView.waitingFor?.promptId})) {
    submitting.value = false;
  }
});
// Publish the CONTEXTUAL footer controls to the shell's ONE bottom command
// bar (hints live only there — never inline). Replaces the old hard-coded,
// diverged command list in the shell.
watch(() => footHints.value, (hints: Array<FootHint>) => {
  setConsolePlayCardCommands(hints);
}, {immediate: true});
/**
 * Hand the STAGE NAME up to the workspace breadcrumb. The tail advances
 * with the sub-state («РОЗЫГРЫШ» → «ОПЛАТА» → «ВЫБОР») because that is the
 * only segment allowed to change: root and subject are the same vnodes for
 * the whole flow, so the line proves continuity by construction while
 * still telling the player which step they are on.
 */
watch(() => stageName.value, (key: string) => {
  if (props.embedded) {
    setWorkspaceFrameStage('hand', key);
  }
}, {immediate: true});
/**
 * THE TABLE MOVED UNDER AN OPEN COMPOSER (an opponent's move, a WS push):
 * re-ask the preview — the forecast's «30 → 26», an opponent's M€, a
 * discount are the server's verdicts about a state that just changed.
 * The old preview keeps painting while the new one is on the wire, and
 * the answer replaces it IN PLACE only when it has the same shape
 * (`samePreviewShape`) — captures, the chosen branch, the cursor and an
 * open «Эффекты» layer all survive; a re-shaped answer is left alone.
 * Never while the play is being submitted / landing (the response that
 * moves the version there is this play's own).
 */
watch(() => stateVersion.value, (now: string, was: string): void => {
  if (was === undefined || now === was || loading.value || submitting.value || landingUp.value) {
    return;
  }
  refreshPreview();
});
/**
 * The «Эффекты» layer lives ONLY on the review level: a pick, the payment
 * editor, a submit in flight, the landing scene or a card change fold it
 * instantly (the surface underneath is leaving, so no fold plays).
 */
watch(() => forecastCanOpen.value, (can: boolean): void => {
  if (!can && fxOpen.value) {
    armForecastInstantFold();
    closeEffectForecastLayer('play');
  }
});
/** The radiogroup's memory: the option the cursor last stood on, so ↑
 *  from the payment / rail re-enters the group there (whatever moved
 *  the cursor — the pad, a click, the opening focus). */
watch(() => focusIdx.value, (idx: number, was: number): void => {
  if (rows.value[idx]?.kind === 'variant') {
    variantReturnIdx.value = idx;
  }
  // The cursor left the commit row: its arrival (and the window it opened) is over.
  if (rows.value[idx]?.kind !== 'cta') {
    leaveCommit(commitArrival.value);
  }
  // A table question OFFERED to the cursor is seen once the cursor leaves it — the walk then goes on to the commit.
  const left = rows.value[was];
  if (left?.kind === 'step' && left.choice.reaction !== undefined && idx !== was) {
    offeredSeen.value[left.choice.id] = true;
  }
});
/**
 * THE SETUP RELEASE of the commit: the WHOLE setup layer — the work
 * column AND the anchored card column (its card is already blanked under
 * the independent hero) — lets go in place, so no empty source column
 * ever remains and the receiving stage above becomes the zone's only
 * content. A REFUSED submit reverses it: the setup returns with the same
 * materialize cascade it entered with, captures intact.
 */
watch(() => landingHolding.value, (now: boolean, was: boolean) => {
  // THE EXIT, not a rollback: the play's outcome has taken the stage (the
  // deck began dealing what it drew, or its decision surface is standing in
  // the workspace's zone), so the tableau dissolves off and the released
  // setup STAYS released — the play happened. (A refusal falls through to
  // the rollback below; the two are told apart by the positive fact, never
  // by the absence of the other.)
  if (!now && was && playLandingYieldedToOutcome()) {
    beginPlayLandingRelease();
    runPlaystageRelease();
    return;
  }
  const right = playRight.value ?? undefined;
  const card = playCard.value ?? undefined;
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
  handStageReveal(composerRootEl());
});

// THE SETTLED COLUMN: the sheet's body composes its block centred, the player's first press pins it — a chosen
// variant's step section grows the block DOWNWARD and every group below slides into place (`settledColumn.ts`). The
// column is the scroll's content (it grows with the block), so its frame is the band's (P81 · DJ).
settled.value = markRaw(new SettledColumn({
  column: () => playBlock.value?.parentElement ?? undefined,
  block: () => playBlock.value ?? undefined,
  active: () => !submitting.value && !loading.value,
  // The FRAME is the band (the column the sheet stands in), never the body's viewport: the sheet legitimately grows
  // under the pin (a section a press adds) and its viewport with it — that is the same composition, not a new one.
  room: () => playRight.value?.clientHeight ?? 0,
}));
// The SHEET stands on the card's foot and grows UPWARD at its opening (the expanded composition); from the player's
// first press it is pinned too — a section a press adds grows the sheet DOWNWARD, nothing moves under the cursor.
settledSheet.value = markRaw(new SettledColumn({
  column: () => playRight.value ?? undefined,
  block: () => sheet.value ?? undefined,
  active: () => !submitting.value && !loading.value,
}));

onMounted(() => {
  // THE SHEET IS AS TALL AS THE CARD (P81 · DJ): the hero slot carries its own `zoom`, so its height is read as
  // painted and brought into the sheet's coordinate space by the column's own ratio (layout ÷ painted) — any
  // transform the band rides (the descend, a clip) cancels out. The card's OWN transform (the zoom hand-off's flight)
  // would not, so a frame where it moves is skipped and read again on the next one; an empty frame of the face's
  // keyed swap (0) keeps the last height.
  const card = playCard.value ?? undefined;
  if (card !== undefined) {
    let retries = 0;
    const measure = (): void => {
      const slot = playCard.value ?? undefined;
      const column = playRight.value ?? undefined;
      if (slot === undefined || column === undefined || typeof getComputedStyle !== 'function') {
        return;
      }
      const transform = getComputedStyle(slot).transform;
      if (transform !== '' && transform !== 'none') {
        if (retries++ < 90 && typeof requestAnimationFrame === 'function') {
          probeTick(measure);
        }
        return;
      }
      retries = 0;
      const painted = slot.getBoundingClientRect().height;
      const columnPainted = column.getBoundingClientRect().height;
      if (painted <= 0 || columnPainted <= 0 || column.offsetHeight <= 0) {
        return;
      }
      heroFaceHeight.value = Math.round(painted * column.offsetHeight / columnPainted);
      judgeExpanded();
    };
    // THE EXPANDED SHEET: taller than the face — read off the sheet's own layout box, re-judged as it grows.
    const judgeExpanded = (): void => {
      const sheetNow = sheet.value ?? undefined;
      sheetExpanded.value = sheetNow !== undefined && heroFaceHeight.value > 0 && sheetNow.offsetHeight > heroFaceHeight.value + 2;
    };
    const sheetNow = sheet.value ?? undefined;
    if (sheetNow !== undefined) {
      stopSheetObs = useResizeObserver(sheetNow, judgeExpanded).stop;
    }
    stopHeroFaceObs = useResizeObserver(card, measure).stop;
    measure();
  }
  // THE SECOND REVEAL. The zone opened a flush ago (it must exist before the
  // teleport resolves, or the content is dropped), so its own enter hook had
  // nothing to cascade. Without this the controls would simply appear inside
  // an already-open box — the same blink the descent exists to remove.
  if (props.embedded) {
    void nextTick(() => handStageReveal(composerRootEl()));
  }
});
onBeforeUnmount(() => {
  lateCascade.forEach((a) => a.cancel());
  releaseCursor(lateCursor.value);
  leaveCommit(commitArrival.value);
  settled.value?.stop();
  settledSheet.value?.stop();
  stopHeroFaceObs?.();
  stopSheetObs?.();
  resetConsolePlayCardUi();
  closeEffectForecastLayer('play');
  closeBoardPeek(true);
  stopVariantObs?.();
  stopVariantObs = undefined;
});
defineExpose({composerRootEl, resetSubmitting, handleIntent});
</script>
