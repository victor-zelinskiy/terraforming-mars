<template>
  <!-- THE EMBEDDED PLAYED-TARGET STEP — a level of the Card Play Workspace,
       not a surface over it. No band geometry, no plate, no backdrop, no
       `con-ws` marker: the workspace it stands in already owns all of those,
       and the source card stays visible to its left throughout. -->
  <div class="con-ptsel"
       :data-mode="layout.mode"
       :data-owners="visibleOwners.length"
       :data-tag-lines="tagLines"
       :data-flow="sizing.sectionFlow"
       :data-direction="model.contract.direction"
       :data-overflow="sizing.overflows ? '1' : undefined"
       :style="sizeVars">
    <!-- ── THE SELECTION CONTRACT — one question, answered once. The count
         rides the SAME line as the title: it is a property of the ask, not a
         third statement of it (the owner bar and the category rails used to
         repeat the very same number twice more).

         A host that has ALREADY stated the ask in its own header (the MarsBot
         attack modal, whose whole top half is «кто, чем и что вы потеряете»)
         passes `hostStatesAsk` and this line does not render — a second, more
         generic instruction under a specific one is how a screen teaches the
         player to stop reading its headers. ── -->
    <header v-if="!hostStatesAsk" class="con-ptsel__contract" data-unfold-item ref="contract">
      <div class="con-ptsel__contract-head">
        <span class="con-ptsel__contract-mark" aria-hidden="true">◈</span>
        <!-- «КУДА ЛЯЖЕТ» (TR56, П3): a GAIN pick names its PAYLOAD — the very print the variant tile led with, carried one
             level deeper (`data-motion-anchor`: the host FLIPs it in from the tile) — then the count. The player chose
             WHAT one level up; this level asks WHERE. A pick with no known payload (a taking step, an attack) keeps a
             plain ask in the table's own words. -->
        <template v-if="payload !== undefined">
          <span class="con-ptsel__contract-title con-ptsel__contract-title--where" data-ptsel-where>{{ $t('Where to') }}:</span>
          <span class="con-ptsel__payload" data-ptsel-payload data-motion-anchor="payload" ref="payload"
                :data-ptsel-payload-icon="payload.icon">
            <span v-if="payload.printed !== undefined" class="con-ptsel__payload-ink">
              <PremiumMechNode v-for="(node, n) in payload.printed" :key="n" :node="node" />
            </span>
            <template v-else>
              <b class="con-ptsel__payload-num">{{ payload.amount }}</b>
              <!-- One unit of one of SEVERAL kinds (TRP8): every kind, joined by «/» — the chosen card decides which. -->
              <template v-if="payload.icons !== undefined">
                <template v-for="(kind, i) in payload.icons" :key="kind">
                  <span v-if="i > 0" class="con-ptsel__tag-sep" aria-hidden="true">/</span>
                  <i class="con-ptsel__payload-icon" :class="iconClass(kind)" :data-ptsel-payload-kind="kind" aria-hidden="true"></i>
                </template>
              </template>
              <i v-else class="con-ptsel__payload-icon" :class="iconClass(payload.icon)" aria-hidden="true"></i>
            </template>
          </span>
        </template>
        <span v-else class="con-ptsel__contract-title">{{ $t('Choose a card on the table') }}</span>
        <span class="con-ptsel__contract-sep" aria-hidden="true">·</span>
        <span class="con-ptsel__scope-count">{{ scopeLine }}</span>
        <!-- MULTI: the live accumulation, so «сколько ещё можно» is never a
             guess. At the cap it says so instead of silently ignoring A. -->
        <template v-if="selection.mode === 'multi'">
          <span class="con-ptsel__contract-sep" aria-hidden="true">·</span>
          <span class="con-ptsel__scope-picked"
                :class="{'con-ptsel__scope-picked--full': atCap}">{{ pickedLine }}</span>
          <span v-if="atCap" class="con-ptsel__scope-note">{{ $t('Deselect another card first') }}</span>
        </template>
        <span v-else-if="model.contract.selfAllowed && model.contract.opponentsInvolved"
              class="con-ptsel__scope-note">{{ $t('Your own card or another player\'s') }}</span>
        <!-- An OPTIONAL choice's DECLINE — the button (RT) repeated in the question line, never a candidate. -->
        <ConsoleDeclinePlate v-if="decline !== undefined" class="con-ptsel__decline"
                             :label="decline.label" :forgone="decline.forgone" />
      </div>
      <!-- The server's ask, and only when it says something the head above it
           does not. Empty = boilerplate («добавить ресурс на эту карту» under
           an action rule that already reads «Добавьте 1 аэростат на любую
           карту»), and a second instruction that repeats the first is how a
           screen teaches the player to stop reading it. -->
      <div v-if="model.contract.ask !== ''" class="con-ptsel__contract-ask">{{ model.contract.ask }}</div>
    </header>

    <!-- ── OWNER TABS — only in tabbed mode, and only over owners that HAVE
         targets (which, by construction of the model, is all of them). ── -->
    <div v-if="layout.mode === 'tabs' && model.owners.length > 1" class="con-ptsel__tabs" data-unfold-item ref="tabs">
      <GamepadGlyph control="bumperL" />
      <span v-for="owner in model.owners" :key="owner.id"
            class="con-ptsel__tab"
            :class="['player_color_' + owner.color, {'con-ptsel__tab--active': owner.id === activeOwnerId}]">
        <span class="con-ptsel__tab-dot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
        <span class="con-ptsel__tab-name">{{ owner.name }}</span>
        <b>{{ selectableIn(owner.candidates) }}</b>
      </span>
      <GamepadGlyph control="bumperR" />
    </div>

    <!-- ── THE CANDIDATE VIEWPORT — the ONLY scrollable zone of this step.
         Everything outside it is FIXED: the contract above, the owner tabs, and
         the status rail below. With a large table the cards genuinely have to
         scroll (they may not be shrunk to unreadable), and when they do the
         rail must not travel with them — it is the reading of the card under
         the cursor, so it has to stay where the eye already is.
         The step caps its own height against the band (see `budgetPx`), which
         is what turns `flex: 1; min-height: 0` here into a real scroll
         container rather than an ever-growing column. ── -->
    <ConsoleScrollArea class="con-ptsel__viewport" content-class="con-ptsel__viewport-body" ref="viewport">
    <!-- ── OWNER GROUPS. Each owner is a SPATIAL group with its own rail —
         candidates are never mixed into one grid with small badges, because
         whose card this is must read from where it sits. ── -->
    <div class="con-ptsel__zone" ref="zone">
      <section v-for="owner in visibleOwners" :key="owner.id"
               class="con-ptsel__owner"
               :class="{'con-ptsel__owner--self': owner.self, 'con-ptsel__owner--focused': owner.id === focus.ownerId}"
               data-unfold-item>
        <header v-if="showsOwnerBar" class="con-ptsel__ownerbar">
          <span class="con-ptsel__ownerdot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
          <span class="con-ptsel__ownername" :class="'player_color_' + owner.color">{{ owner.name }}</span>
          <!-- SELF-HARM, once per GROUP. The rules allow taking from your own
               table and we may not forbid what the printed rules permit — but
               the player must never do it by accident. One marker on the block
               header, not one per card: the fact is «everything under here is
               yours», and repeating it on every face would be noise the eye
               learns to skip. Only shown when an opponent's card was available
               instead (`selfHarm`), so it never fires on a card whose own
               resource IS the cost. -->
          <span v-if="owner.selfHarm" class="con-ptsel__ownerwarn">⚠ {{ $t('Your own cards') }}</span>
          <!-- NO «РАЗЫГРАНО N». It counts the player's WHOLE table, and this
               surface shows only the ELIGIBLE cards — «разыграно 3» over one
               visible candidate reads as two cards that failed to render. The
               only count this step owes is «сколько целей», which the contract
               line already states once. The eligible-per-owner count survives
               ONLY with several owners, where it answers «where are they»
               instead of repeating the contract's total. -->
          <span v-if="showsOwnerTargets" class="con-ptsel__ownercount">
            <i>{{ $t('Selectable') }}</i><b class="con-ptsel__ownercount-live">{{ selectableIn(owner.candidates) }}</b>
          </span>
        </header>

        <div class="con-ptsel__sections">
          <div v-for="section in sectionsOf(owner)" :key="section.key" class="con-ptsel__section" :style="sectionStyle(section)">
            <!-- The SELF block draws no rail of its own (the proxy is a handle,
                 not a card family) — but while the neighbours wear rails it
                 keeps an EMPTY one, so every cards row starts on one baseline. -->
            <div v-if="showsRails(owner)" class="con-ptsel__catrail" :class="{'con-ptsel__catrail--blank': section.self}">
              <template v-if="!section.self">
                <span class="con-ptsel__catname">{{ $t(section.label) }}</span>
                <span class="con-ptsel__catcount">{{ selectableIn(section.candidates) }}</span>
              </template>
            </div>
            <div class="con-ptsel__cards">
              <!-- The CELL is the measured, never-transformed box: focus lifts
                   the slot INSIDE it, so the geometry the navigation reads can
                   never be the emphasis it is applying. -->
              <div v-for="cand in section.candidates" :key="cand.cardName"
                   class="con-ptsel__cell"
                   data-ptsel-cell
                   :data-owner="owner.id"
                   :data-index="indexOf(owner, cand.cardName)"
                   :data-focused="isFocused(owner.id, cand.cardName) ? '1' : undefined">
                <!-- THE SELF-TARGET PROXY. The source card is already standing
                     in the workspace's hero slot; drawing it AGAIN at full size
                     would put two copies of one physical object on one screen.
                     So this candidate is a NAVIGATION PROXY that points at the
                     real card — a full navigation stop with its own focus, its
                     own A and its own lock, standing in the SAME horizontal row
                     as the physical targets beside it.
                     `data-ptsel-self` is the connector's right-hand anchor (the
                     wire to the hero card is measured off this box), and it is
                     deliberately NOT a `data-zoom-slot`: X on this proxy must
                     lift the REAL card, so the origin resolves to the hero (see
                     `playedTargetZoomOrigin`). A slot key here is what made the
                     viewer rise out of the chip while the card it names stayed
                     lying on the left — two copies again, by another route.
                     ITS BOX IS FIXED (`--con-ptsel-slot-w`, the same solved
                     card width every cell gets) and every state marker below is
                     out of flow, so focus / select / deselect cannot change the
                     row's shape. That is the whole reflow fix: the width used to
                     be intrinsic, so the ✓ badge alone pushed the proxy past a
                     card width and the flex row broke to a second line — the
                     "horizontal turns vertical when I choose this card" bug. -->
                <div v-if="cand.relation === 'source-card'"
                     class="con-ptsel__self"
                     data-ptsel-self
                     :class="{
                       'con-ptsel__self--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__self--locked': isChosen(cand.cardName),
                     }">
                  <span class="con-ptsel__self-body">
                    <!-- «ЭТА КАРТА», and nothing before it. «ИСТОЧНИК» is the
                         console's word for the card that PRODUCED what you are
                         looking at (`L3 Источник`), and this proxy is not that
                         — it is one of the targets. Two roles under one word on
                         one screen is how a vocabulary stops meaning anything.
                         The resource reading is the column's THIRD line (PL-218): beside
                         the name it took half the box («Суперкомпьютер» read «Супер ком…»
                         on the TV), beside the kicker it cut «ЭТА КА…» — nothing shares a
                         width with anything now. -->
                    <span class="con-ptsel__self-kicker">{{ $t('This card') }}</span>
                    <span class="con-ptsel__self-name">{{ $t(cand.cardName) }}</span>
                    <ConsoleCardResourceChip v-if="showsResource(cand)"
                                             class="con-ptsel__self-res"
                                             variant="proxy"
                                             :icon="cand.resourceContext?.icon ?? ''"
                                             :count="cand.resourceContext?.count ?? 0" />
                  </span>
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__self-check" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
                <!-- THE BOT'S STAND-IN («ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА», `tableTargetZone.ts`). MarsBot holds no card, so
                     its candidate is a TILE on the slot's own chassis (the same box, the same cursor, the same lock) —
                     never a card face, which would lie that the bot has a card. It reads WHOSE (the seat's dot and
                     name), WHAT (the unit's icon, `current → resulting` — the server's metadata, verbatim) and,
                     only when it is honest, WHERE the first unit comes from (a colony storage area by name, the
                     floater counter, the M€ proxy). State is a kant and a fill (invariant 15), the focus the cursor. -->
                <div v-else-if="cand.bot !== undefined"
                     class="con-ptsel__slot con-ptsel__slot--bot"
                     data-ptsel-bot
                     :class="{
                       'con-ptsel__slot--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__slot--locked': isChosen(cand.cardName),
                     }">
                  <div class="con-ptsel__bot" :class="'con-ptsel__bot--' + owner.color">
                    <span class="con-ptsel__bot-kicker">{{ $t('Target without a card') }}</span>
                    <span class="con-ptsel__bot-name">
                      <span class="con-ptsel__ownerdot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
                      <span :class="'player_color_' + owner.color">{{ owner.name }}</span>
                    </span>
                    <!-- The pool the FIRST unit leaves (the storage row of the server's reading — «2 → 1» microbes on
                         Enceladus; the M€ row when the storage is empty), its icon with it — never the sum of the pool
                         and the M€ proxy the metadata's own `current` carries. -->
                    <template v-for="(change, i) in botChanges(cand.bot).slice(0, 1)" :key="'d' + i">
                      <i class="con-ptsel__bot-icon" :class="iconClass(change.icon)" :data-ptsel-bot-icon="change.icon" aria-hidden="true"></i>
                      <b class="con-ptsel__bot-delta" data-ptsel-bot-delta>{{ change.from }}<span aria-hidden="true"> → </span>{{ change.to }}</b>
                    </template>
                    <span class="con-ptsel__bot-storage" :data-ptsel-bot-storage="cand.bot.storage">{{ botStorageText(cand.bot) }}</span>
                  </div>
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__lock" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
                <div v-else
                     class="con-ptsel__slot"
                     :class="{
                       'con-ptsel__slot--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__slot--locked': isChosen(cand.cardName),
                       'con-ptsel__slot--blocked': cand.blocked !== undefined,
                     }"
                     :data-ptsel-blocked="cand.blocked !== undefined ? '1' : undefined"
                     :data-zoom-slot="cand.slotKey">
                  <!-- THE LIVE MODEL, so the card's OWN capsule (bottom-left,
                       beside the expansion stamp — the premium face's service
                       anchor) states the real count. It used to receive only a
                       name, so every candidate printed a permanent «0» there
                       and the true number had to be repeated by a second chip
                       somewhere else on the same card. One counter, one place,
                       on every surface. -->
                  <ConsoleCardFaceLite :name="cand.cardName" :card="cand.model" />
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__lock" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                  <!-- A SHOWN NEAR MISS (TR52): its refusal stands ON the card — «✕ 1 / 2» in the rules' own register,
                       absolute (zero layout); the face beneath recedes under a scrim, never into see-through. -->
                  <span v-if="cand.blocked !== undefined" class="con-ptsel__blocked" aria-hidden="true">
                    <span class="con-ptsel__blocked-x">✕</span>
                    <b class="con-ptsel__blocked-num">{{ cand.blocked.have }} / {{ cand.blocked.need }}</b>
                  </span>
                </div>
                <!-- THE OUTCOME TAG (PL-219): what the N do on THIS candidate, under every card at once — «where do the
                     N go» answered by looking. Glyphs and digits only (the rail under the cursor keeps the sentence);
                     its row is RESERVED by the solver for every cell, so a candidate without a tag keeps the row
                     empty and the cards stand on one line. -->
                <div v-if="tagsOn" class="con-ptsel__tag"
                     :class="tagOf(cand) === undefined ? 'con-ptsel__tag--none' : 'con-ptsel__tag--' + tagOf(cand)?.tone"
                     :data-ptsel-tag="tagOf(cand)?.tone ?? 'none'">
                  <!-- ONE renderer for the tag (`ConsolePlayedTargetTag`) — the answered composer row reads the same line. -->
                  <ConsolePlayedTargetTag v-for="tag in tagList(cand)" :key="'tag'" :tag="tag" :stacked="tagLines === 2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    </ConsoleScrollArea>

    <!-- ── THE CONTEXTUAL STATUS RAIL — ONE line, permanently present, whose
         only job is «what does the card under the cursor give me, here».
         It states the identity and the contextual impacts, and nothing else:
         no card type (the group says it), no availability reason (everything
         shown is available), no section titles, no clarifying notes, no second
         wording of the same delta. Its height is a fixed row, so moving the
         cursor cannot move the cards. ── -->
    <footer class="con-ptsel__rail" data-unfold-item ref="rail">
      <template v-if="focused !== undefined">
        <!-- The card's NAME leads the rail only when it is not already obvious:
             with several candidates it says WHICH one is being read. With ONE
             candidate under a host that states the ask itself, «ТИХОХОДКИ →
             Ресурсы на этой карте 1 → 0» is the card's own name, an arrow and a
             qualifier for a card that is the only thing on screen — it reads as
             debug output rather than a result. -->
        <span v-if="showsRailCard" class="con-ptsel__railcard">{{ focused.bot !== undefined ? focusedOwnerName : $t(focused.cardName) }}</span>
        <!-- The bot's stand-in reads its own loss — the server's per-pool rows when it gives them, else the one delta. -->
        <template v-if="focused.bot !== undefined">
          <span class="con-ptsel__railarrow" aria-hidden="true">→</span>
          <span class="con-ptsel__railimpacts" data-ptsel-rail-bot>
            <span v-for="(change, i) in botChanges(focused.bot)" :key="'b' + i" class="con-ptsel__imp con-ptsel__imp--down">
              <i class="con-ptsel__imp-icon" :class="iconClass(change.icon)" aria-hidden="true"></i>
              <b class="con-ptsel__imp-delta">{{ change.from }}<span aria-hidden="true"> → </span>{{ change.to }}</b>
            </span>
            <span class="con-ptsel__imp con-ptsel__imp--static">
              <span class="con-ptsel__imp-label">{{ botStorageText(focused.bot) }}</span>
            </span>
          </span>
        </template>
        <!-- The owner marker is dropped when there is only one group: it would
             repeat the header two lines above it. -->
        <template v-if="showsOwnerTargets && focused.bot === undefined">
          <span class="con-ptsel__railsep" aria-hidden="true">·</span>
          <span class="con-ptsel__railowner" :class="'player_color_' + focusedOwnerColor">{{ focusedOwnerName }}</span>
        </template>
        <!-- …and at the moment of decision, on the focused candidate. The rail
             already names WHOSE card this is one segment to the left, so this
             adds the judgement, not the fact. -->
        <span v-if="focusedSelfHarm" class="con-ptsel__railwarn">⚠ {{ $t('This is your own card') }}</span>
        <!-- …and a near miss reads WHY it cannot be taken (the server's own reason) — the whole payload of the line. -->
        <span v-if="focused.blocked !== undefined" class="con-ptsel__railblock" data-ptsel-rail-blocked>✕ {{ focused.blocked.reason }}</span>
        <template v-if="railImpacts.length > 0">
          <!-- The arrow SEPARATES the identity from its consequences; with the
               identity suppressed (see `showsRailCard`) it would open the line
               with a bare glyph. -->
          <span v-if="showsRailCard" class="con-ptsel__railarrow" aria-hidden="true">→</span>
          <span class="con-ptsel__railimpacts">
            <span v-for="imp in railImpacts" :key="imp.key" class="con-ptsel__imp"
                  :class="['con-ptsel__imp--' + imp.entity, {'con-ptsel__imp--static': imp.static, 'con-ptsel__imp--value': imp.value},
                           imp.outcome !== undefined ? 'con-ptsel__imp--' + imp.outcome : '', {'con-ptsel__imp--down': imp.from !== undefined && imp.to !== undefined && imp.to < imp.from && imp.static !== true}]"
                  :data-impact-outcome="imp.outcome">
              <!-- A CHOICE of goods at one price (PL-484): every good's icon, joined by the choice's «/». -->
              <template v-if="imp.icons !== undefined">
                <template v-for="(icon, i) in imp.icons" :key="'c' + i">
                  <span v-if="i > 0" class="con-ptsel__tag-sep" aria-hidden="true">{{ imp.join === 'and' ? '+' : '/' }}</span>
                  <i class="con-ptsel__imp-icon" :class="[iconClass(icon), {'con-ptsel__imp-icon--production': (imp.plates?.[i] ?? imp.plate) === 'production'}]"
                     :data-impact-plate="imp.plate" :data-impact-choice-icon="icon" aria-hidden="true"></i>
                </template>
              </template>
              <i v-else-if="imp.icon" class="con-ptsel__imp-icon" :class="[iconClass(imp.icon), {'con-ptsel__imp-icon--production': imp.plate === 'production'}]"
                 :data-impact-plate="imp.plate" aria-hidden="true"></i>
              <span class="con-ptsel__imp-label">{{ impactLabel(imp) }}</span>
              <span v-if="imp.tail !== undefined" class="con-ptsel__imp-tail">{{ impactTail(imp) }}</span>
              <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">
                {{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}
              </b>
              <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
              <template v-else-if="imp.per !== undefined"><b class="con-ptsel__imp-delta con-ptsel__imp-count">{{ imp.from }}</b><span class="con-ptsel__imp-per">· {{ $t(imp.per) }}</span></template>
            </span>
            <span v-if="railOverflow > 0" class="con-ptsel__imp con-ptsel__imp--more">+{{ railOverflow }}</span>
          </span>
        </template>
      </template>
    </footer>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAYED-TARGET STEP — the reusable embedded step for «point at a card
 * that is already on the table».
 *
 * It renders a MODEL and reports focus + selection upward; it contains no game rules
 * and no card names. Eligibility arrives from the server's own candidate set,
 * the contextual preview arrives pre-built from the host (which owns the game
 * knowledge), and the layout decision arrives from the pure planner. That is
 * what makes the same component serve Industrial Robots today, Predators next,
 * and the Blue Actions Workspace after that — the only thing a new host writes
 * is a preview builder.
 *
 * IT IS NOT A TABLEAU. Only eligible candidates render, so a thirty-card table
 * with two legal targets mounts two faces. The heavy «Разыграно» surfaces keep
 * their own architecture for their own (very different) job.
 *
 * TWO THINGS THIS COMPONENT OWNS, because only it can:
 *
 *  · THE SIZE. Card size is not a per-profile CSS constant — it is what the
 *    candidate count and the measured zone jointly allow (`planPlayedTargetSizing`).
 *    Two candidates on a 4K band get two big faces; ten get a grid. Measured
 *    once at mount and on real layout changes, published as `--con-ptsel-zoom`
 *    BEFORE the first painted frame, so the entrance never re-lays out.
 *  · THE GEOMETRY. Directional navigation is resolved against the cards' real
 *    boxes (`stepPlayedTargetFocusAt`), pulled by the host through `cells()`
 *    and cached until the layout genuinely changes. Index arithmetic cannot
 *    describe a layout it does not own — that is why Down did nothing while two
 *    candidates sat visibly one above the other.
 *
 * PHYSICALITY, with the RIGHT semantics. A card chosen from hand is TAKEN; a
 * played card being targeted is NOT — it stays in its owner's tableau. So the
 * focused candidate lifts a little inside its own group and takes a ring; it
 * never leaves, never flies to the source card, and confirming locks it in
 * place rather than carrying it away.
 *
 * Control grammar (published by the host to the ONE command bar): D-pad = move
 * (crossing between owner groups in split view) · LB/RB = owner tabs (tabbed
 * view only) · A = choose · X = inspect · B = back to the play step.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleCardResourceChip from '@/client/components/console/played/ConsoleCardResourceChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
import type {DeclineModel} from '@/client/console/optionalChoice';
import ConsolePlayedTargetTag from '@/client/components/console/played/ConsolePlayedTargetTag.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {readingTailText, readingText} from '@/client/console/readingText';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {setPlayedTargetSelfLink, bumpPlayedTargetSelfGeometry, resetPlayedTargetSelf} from '@/client/console/played/consolePlayedTargetSelf';
import {TableTargetBotStand, tableTargetBotStorageKey} from '@/client/console/played/tableTargetZone';
import {
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetOwner,
  PlayedTargetCandidate, PlayedTargetSection, PlayedTargetSelection,
  PlayedTargetSizing, PlayedTargetCell, PlayedTargetQuickImpact, PlayedTargetTag, PlayedTargetPayload, playedTargetTagOfPreview, playedTargetTagStacked,
  PLAYED_TARGET_RAIL_IMPACT_CAP, PLAYED_TARGET_FOCUS_SCALE, playedTargetSelfBox,
  playedTargetSections, playedTargetShowsCategoryRails, playedTargetAt,
  playedTargetShowsOwnerTargetCount, playedTargetShowsResource,
  playedTargetReadingImpacts, planPlayedTargetSizing,
} from '@/client/console/played/consolePlayedTargetModel';

/** The sizing used until the first measurement lands (one frame, at most). */
/** The premium face's unzoomed width — the section span is counted in these. */
const SLOT_W_PX = 320;
/** `.con-ptsel { gap: .55rem }` at the 20 px rem base — mirrored here so the
 *  budget subtracts the gaps the column will actually draw. */
const PTSEL_COLUMN_GAP_PX = 11;

const UNMEASURED: PlayedTargetSizing =
  {cardZoom: 0.58, gapPx: 11, headroomPx: 6, sectionFlow: 'rows', sectionColumns: 1, rows: 1, perRow: 3, overflows: false};

export default defineComponent({
  name: 'ConsolePlayedTargetStep',
  components: {ConsoleDeclinePlate, ConsoleCardFaceLite, ConsoleCardResourceChip, GamepadGlyph, ConsoleScrollArea, ConsolePlayedTargetTag, PremiumMechNode},
  props: {
    model: {type: Object as PropType<PlayedTargetModel>, required: true},
    layout: {type: Object as PropType<PlayedTargetLayout>, required: true},
    focus: {type: Object as PropType<PlayedTargetFocus>, required: true},
    /**
     * HOW MANY the step asks for. `single` (A chooses and closes) or the
     * server's merged up-to-N ask (A toggles, RT confirms) — the shape follows
     * the prompt, never a per-card rule here.
     */
    selection: {type: Object as PropType<PlayedTargetSelection>, default: () => ({mode: 'single'} as PlayedTargetSelection)},
    /**
     * THE VERTICAL BUDGET, measured by the host on a STRETCHED box before this
     * step was visible.
     *
     * It is a prop and not a self-measurement on purpose. Everything between
     * this component and the workspace band is content-sized, so any height
     * this component could read is a height its own cards produced — a cycle
     * whose fixpoint depends on the unmeasured first render. It settled LOWER
     * for one candidate than for two (one stacked block is a shorter column
     * than two), which is exactly why a lone target came out smaller than each
     * of a pair. The host owns the band; the step owns what goes in it.
     */
    bandHeight: {type: Number, default: 0},
    /** The already-confirmed target of a SINGLE step (a re-entry from «Изменить
     *  выбор»); in multi the picks live in `selection.picked`. */
    lockedCard: {type: String, default: ''},
    /** An optional choice's refusal (`optionalChoice.ts`) — its plate rides the contract line. */
    decline: {type: Object as PropType<DeclineModel | undefined>, default: undefined},
    /**
     * The HOST's own header already states the ask, so this step must not
     * restate it (see the contract header in the template). Additive and
     * default-false: the two composer hosts keep their contract line untouched.
     */
    hostStatesAsk: {type: Boolean, default: false},
  },
  data() {
    return {
      sizing: UNMEASURED as PlayedTargetSizing,
      /** The measured cells, rebuilt only when the layout genuinely changed. */
      cellCache: undefined as ReadonlyArray<PlayedTargetCell> | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
      /** The step's own vertical CAP, measured against the stretched band. */
      budgetPx: 0,
    };
  },
  computed: {
    /** SPLIT shows every owner side by side; TABS shows the active one. */
    visibleOwners(): ReadonlyArray<PlayedTargetOwner> {
      // `board` (the owner's «одна зона») and `split` stand EVERY group on screen; only `tabs` shows one at a time.
      return this.layout.mode === 'split' || this.layout.mode === 'board' ?
        this.model.owners :
        this.model.owners.filter((o) => o.id === this.activeOwnerId);
    },
    activeOwnerId(): string {
      return this.focus.ownerId;
    },
    focused(): PlayedTargetCandidate | undefined {
      return playedTargetAt(this.focus, this.model.owners);
    },
    focusedOwner(): PlayedTargetOwner | undefined {
      return this.model.owners.find((o) => o.id === this.focus.ownerId);
    },
    focusedOwnerName(): string {
      return this.focusedOwner?.name ?? '';
    },
    focusedOwnerColor(): string {
      return this.focusedOwner?.color ?? 'neutral';
    },
    /**
     * WHOSE cards these are — a real question with two tableaux on screen, and
     * pure noise with one when the HOST has already said it («выберите одну из
     * СВОИХ карт»). Scoped to `hostStatesAsk` on purpose: in the composers the
     * bar earns its line even for a lone owner, because nothing above it says
     * whose table is being pointed at.
     */
    showsOwnerBar(): boolean {
      return !(this.hostStatesAsk && this.model.owners.length === 1);
    },
    /** …and the same rule for the rail's leading card name (see the template). */
    showsRailCard(): boolean {
      return !(this.hostStatesAsk && this.model.contract.targetCount === 1);
    },
    /** Several owners → the per-owner and per-focus markers earn their place. */
    showsOwnerTargets(): boolean {
      return playedTargetShowsOwnerTargetCount(this.model.owners);
    },
    /** WHAT lands on the chosen card (TR56, П3) — the contract's «КУДА: [печать]»; undefined = the generic ask. */
    payload(): PlayedTargetPayload | undefined {
      return this.model.contract.payload;
    },
    /** «3 доступные цели у 2 игроков» — the scope, in one honest line. */
    scopeLine(): string {
      const {targetCount, ownerCount} = this.model.contract;
      // A pick that takes FROM the viewer's own cards is a SOURCE of a price they chose (TR29: «spend 1 fighter from
      // ANY of your cards»), never a target — the word «цель» belongs to an attack and to a reward (PL-056).
      if (this.model.contract.direction === 'remove' && this.model.owners.every((owner) => owner.self)) {
        return translateTextWithParams('${0} available sources', [String(targetCount)]);
      }
      return ownerCount > 1 ?
        translateTextWithParams('${0} targets across ${1} players', [String(targetCount), String(ownerCount)]) :
        translateTextWithParams('${0} available targets', [String(targetCount)]);
    },
    /** The focused candidate's contextual effect — the rail's whole payload. */
    /** Some candidate wears an outcome tag (PL-219) — then EVERY cell reserves the tag's row. */
    tagsOn(): boolean {
      return this.model.owners.some((o) => o.candidates.some((c) => playedTargetTagOfPreview(c.preview) !== undefined));
    },
    /** Two lines when some tag says the count AND its consequence (`playedTargetTagStacked`) — every cell reserves them. */
    tagLines(): 1 | 2 {
      return this.model.owners.some((o) => o.candidates.some((c) => playedTargetTagStacked(playedTargetTagOfPreview(c.preview)))) ? 2 : 1;
    },
    railQuick(): ReadonlyArray<PlayedTargetQuickImpact> {
      // The rail keeps the WORDS; the digits the tag under the card prints are the tag's (TR56, П4).
      return this.focused === undefined ? [] : playedTargetReadingImpacts(this.focused.preview);
    },
    /** The focused candidate belongs to the viewer AND this step takes from it. */
    focusedSelfHarm(): boolean {
      return this.model.owners.some((o) => o.id === this.focus.ownerId && o.selfHarm);
    },
    railImpacts(): ReadonlyArray<PlayedTargetQuickImpact> {
      return this.railQuick.slice(0, PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    railOverflow(): number {
      return Math.max(0, this.railQuick.length - PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    /**
     * THE SOLVED CELL WIDTH — derived ONCE.
     *
     * Two consumers must agree on it exactly or the reflow fix comes undone:
     * the section's inline SPAN (`cols × this + gaps`, which is where the flex
     * row wraps) and the proxy's CSS bound (`--con-ptsel-slot-w`). Two hand-
     * written copies of `SLOT_W_PX * cardZoom` is precisely how a rounding step
     * added to one of them would let the proxy exceed a card width again — with
     * the stylesheet guard still green, because it asserts the CSS rather than
     * the agreement between two derivations.
     */
    cardWidthPx(): number {
      return SLOT_W_PX * this.sizing.cardZoom;
    },
    /** Is a PHYSICAL card standing in the row beside the proxy? That, and only
     *  that, is what makes the solved cell width binding on it: with no card
     *  there is no shared column and nothing the row could wrap on. */
    hasCardCandidates(): boolean {
      return (this.model?.owners ?? []).some((o) =>
        o.candidates.some((c) => c.relation !== 'source-card'));
    },
    /** The proxy's box — one derivation, shared by the tokens and the guards. */
    selfBox(): {w: number, h: number} {
      return playedTargetSelfBox({
        cardWidthPx: this.cardWidthPx,
        hasCardCandidates: this.hasCardCandidates,
        ui: conUiScale(),
      });
    },
    /** The measured size, handed to CSS. One writer, so the cards, the gaps and
     *  the badge de-zoom can never disagree about how big a candidate is. */
    sizeVars(): Record<string, string> {
      return {
        '--con-ptsel-zoom': this.sizing.cardZoom.toFixed(3),
        '--con-ptsel-gap': `${this.sizing.gapPx.toFixed(2)}px`,
        // The focus-safe room above the first row — the gap's twin upward (PL-170).
        '--con-ptsel-headroom': `${this.sizing.headroomPx.toFixed(2)}px`,
        '--con-ptsel-focus-scale': String(PLAYED_TARGET_FOCUS_SCALE),
        // THE SOLVED CELL WIDTH, in the layout's own px. Every cell of the
        // candidate row is exactly this wide — the section's inline span is
        // `cols × this + gaps`, so anything that renders WIDER than it wraps the
        // row. The self-target proxy is the one cell whose content is text, so
        // it is the one cell that has to be TOLD the number instead of getting
        // it from a card face. Published here because this is the only place
        // that knows it: the size is solved, never a CSS constant.
        '--con-ptsel-slot-w': `${this.cardWidthPx.toFixed(2)}px`,
        // THE PROXY'S OWN BOX — a slot in the same grid, solved by the one
        // module that owns this layout's numbers. It is NOT the card fit: that
        // fit is height-bound, so a lone proxy in a short band inherited a
        // small card's width and collapsed to a text-sized pill with hundreds
        // of px free beside it.
        '--con-ptsel-self-w': `${this.selfBox.w.toFixed(2)}px`,
        '--con-ptsel-self-h': `${this.selfBox.h.toFixed(2)}px`,
        // The CAP, not a fixed height: a short step still hugs its cards (the
        // rail sits right under them, exactly as before), and a tall one stops
        // growing and hands the excess to the candidate viewport's scroll.
        ...(this.budgetPx > 0 ? {'--con-ptsel-max-h': `${Math.round(this.budgetPx)}px`} : {}),
      };
    },
    /** «Выбрано 1 из 2» — the live accumulation of a multi ask. */
    pickedLine(): string {
      if (this.selection.mode !== 'multi') {
        return '';
      }
      return translateTextWithParams('Selected ${0} of ${1}',
        [String(this.selection.picked.length), String(this.selection.max)]);
    },
    atCap(): boolean {
      return this.selection.mode === 'multi' && this.selection.picked.length >= this.selection.max;
    },
    /** The state of the SELF-TARGET link, as one value the watcher can publish
     *  to the composer that owns the real source card. */
    selfLink(): {present: boolean, focused: boolean, locked: boolean} {
      const self = this.model.owners
        .flatMap((o) => o.candidates)
        .find((c) => c.relation === 'source-card');
      if (self === undefined) {
        return {present: false, focused: false, locked: false};
      }
      return {
        present: true,
        focused: this.focused?.cardName === self.cardName,
        locked: this.isChosen(self.cardName),
      };
    },
  },
  watch: {
    // The four events that genuinely change the geometry — and nothing else.
    // (A focus move does not: the cell boxes are what focus moves BETWEEN.)
    model() {
      this.invalidateGeometry();
      this.measureSizing();
    },
    'layout.mode'() {
      this.invalidateGeometry();
      this.measureSizing();
    },
    bandHeight() {
      this.measureSizing();
    },
    /**
     * THE SELF LINK. The handle cannot reach the source card (it lives one
     * level up, in the composer's hero slot), so the fact is published and the
     * composer lights the REAL card. Immediate: the very first frame of a
     * self-target-only step must already show the link.
     */
    selfLink: {
      immediate: true,
      handler(v: {present: boolean, focused: boolean, locked: boolean}) {
        setPlayedTargetSelfLink(v);
      },
    },
    activeOwnerId() {
      this.invalidateGeometry();
    },
    'sizing.cardZoom'() {
      this.invalidateGeometry();
    },
    'sizing.sectionFlow'() {
      this.invalidateGeometry();
    },
  },
  mounted() {
    // BEFORE the first painted frame: the host's entrance cascade builds its
    // 0-state from `[data-unfold-item]` a frame later, so the size it captures
    // is already final and the surface never re-lays out mid-reveal.
    this.measureSizing();
    // The RESPONSIVE path — the band itself changing (a profile switch, the
    // rail lifting). Never a manual window listener: the observer answers for
    // the element that actually carries the budget.
    const zone = this.$refs.zone as HTMLElement | undefined;
    if (zone !== undefined) {
      this.stopResizeObs = useResizeObserver(zone, () => {
        this.measureSizing();
        this.invalidateGeometry();
      }).stop;
    }
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResizeObs = undefined;
    resetPlayedTargetSelf();
  },
  methods: {
    /** The impact's label — a resolved name as is, an i18n key with its params: ONE renderer (`readingText`, PL-160). */
    /** The candidate's outcome tag (PL-219), or none. */
    tagOf(cand: PlayedTargetCandidate): PlayedTargetTag | undefined {
      return playedTargetTagOfPreview(cand.preview);
    },
    /** The candidate's tag as a list of none or one — the template binds it once, without a cast. */
    tagList(cand: PlayedTargetCandidate): ReadonlyArray<PlayedTargetTag> {
      const tag = playedTargetTagOfPreview(cand.preview);
      return tag === undefined ? [] : [tag];
    },
    impactLabel(imp: PlayedTargetQuickImpact): string {
      return readingText(imp);
    },
    /** The impact's tail phrase, through the same renderer (its own params — «card with the ${0} tag»). */
    impactTail(imp: PlayedTargetQuickImpact): string {
      return readingTailText(imp) ?? '';
    },
    /**
     * THIS STEP'S ROOT ELEMENT — resolved, never cast.
     *
     * `$el` is the root ELEMENT only when the compiler stripped this template's
     * leading comment: it does in a production build and does NOT in a
     * development one, where the root becomes a fragment and `$el` is an anchor
     * node with no `closest` / `querySelector` / `querySelectorAll` at all. All
     * three of this file's DOM readers depended on that difference — the
     * geometry pull THREW, and the size solver silently returned its unmeasured
     * default, so a dev build laid every host's candidates out at the fallback
     * zoom. The zone ref is a real element in both, and its `.con-ptsel`
     * ancestor is this component's root by construction.
     */
    rootEl(): HTMLElement | undefined {
      const zone = this.$refs.zone as HTMLElement | undefined;
      const viaZone = typeof zone?.closest === 'function' ?
        zone.closest<HTMLElement>('.con-ptsel') :
        null;
      if (viaZone !== null && viaZone !== undefined) {
        return viaZone;
      }
      const el = this.$el as HTMLElement | undefined;
      return typeof el?.querySelectorAll === 'function' ? el : undefined;
    },
    /**
     * THE HOST'S GEOMETRY PULL. Cached: rebuilt only after a mount, a real
     * layout change, an owner-tab switch or a candidate-set change — never per
     * input press.
     */
    cells(): ReadonlyArray<PlayedTargetCell> {
      if (this.cellCache !== undefined) {
        return this.cellCache;
      }
      const root = this.rootEl();
      const out: Array<PlayedTargetCell> = [];
      for (const el of Array.from(root?.querySelectorAll<HTMLElement>('[data-ptsel-cell]') ?? [])) {
        const ownerId = el.dataset.owner;
        const index = Number(el.dataset.index);
        if (ownerId === undefined || !Number.isFinite(index)) {
          continue;
        }
        const r = el.getBoundingClientRect();
        out.push({ownerId, index, left: r.left, top: r.top, width: r.width, height: r.height});
      }
      this.cellCache = markRaw(out);
      return this.cellCache;
    },
    /**
     * The measured boxes expired.
     *
     * The self-target CONNECTOR measures real elements across two columns, so
     * it is invalidated by exactly the same four events as the navigation cells
     * — a new model, a re-solved size, an owner-tab switch, a resize. Focus and
     * selection are deliberately not among them: they may not move anything,
     * and a re-measure per cursor press would be a measurement the layout never
     * asked for.
     */
    invalidateGeometry(): void {
      this.cellCache = undefined;
      bumpPlayedTargetSelfGeometry();
    },
    /**
     * Keep the cursored candidate inside the CANDIDATE VIEWPORT — the step's
     * own scroller, not the composer's. The host calls this after a move; with
     * the rail and the contract fixed outside, this is the only thing a cursor
     * move may ever scroll.
     */
    ensureFocusVisible(): void {
      void this.$nextTick(() => {
        const area = this.$refs.viewport as {ensureVisible?: (el: Element | null | undefined) => void} | undefined;
        const el = this.rootEl()?.querySelector('[data-ptsel-cell][data-focused]');
        area?.ensureVisible?.(el);
      });
    },
    /** The header's payload (the carried print) — the host FLIPs it in from the variant tile it was chosen on. */
    payloadEl(): HTMLElement | undefined {
      return this.$refs.payload as HTMLElement | undefined;
    },
    /** Right-stick scroll, routed by the host while the step owns the screen. */
    scrollBy(dy: number): void {
      (this.$refs.viewport as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(dy);
    },
    /**
     * Solve the card size against the real box.
     *
     * WIDTH is measured here (the zone is stretched, so its width is the band's
     * and no card can move it). HEIGHT arrives from the host — see `bandHeight`.
     *
     * The step's OWN chrome is measured and subtracted: a contract line, the
     * owner tabs and the status rail. All three are text at a fixed size, so
     * none of them depends on how big the cards turned out — which is what
     * keeps this acyclic even though it reads the live DOM.
     */
    measureSizing(): void {
      const zone = this.$refs.zone as HTMLElement | undefined;
      const root = this.rootEl();
      if (zone === undefined || root === undefined) {
        return;
      }
      // THE ROOM THE CARDS ACTUALLY GET (PL-224, the TR50 walk). The cards' row does not sit on the zone: the owner
      // group draws its accent rule and its inset, the sections their own padding — ≈ 38 px at 4K. Solved against
      // `zone.clientWidth`, seven mech holders came out as ONE row 39 px wider than the box that holds it, and the
      // composer's scroller cut the last card (TR50 itself) together with its focus ring. Same rule as the height
      // below: PADDINGS AND BORDERS ONLY — fixed by the layout, never a function of the size being solved.
      let insetX = 0;
      const zoneStyle = getComputedStyle(zone);
      insetX += (parseFloat(zoneStyle.paddingLeft) || 0) + (parseFloat(zoneStyle.paddingRight) || 0);
      const rowBox = zone.querySelector<HTMLElement>('.con-ptsel__sections');
      for (let el = rowBox; el !== null && el !== zone; el = el.parentElement) {
        const cs = getComputedStyle(el);
        insetX += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
          (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
      }
      const availW = zone.clientWidth - insetX;
      // No band, no honest budget: a bare unit mount keeps the default rather
      // than sizing itself from a box it produced.
      if (availW <= 0 || this.bandHeight <= 0) {
        return;
      }
      /**
       * THE STEP'S OWN CAP — «the bottom of whatever will actually clip me,
       * minus where I start», and never taller than that box itself.
       *
       * ⚠️ IT USED TO BE THE BAND'S BOTTOM, and the step does not live on the
       * band. In the action host it sits FOUR boxes deeper, inside the stage
       * plate's own scroll area, whose viewport ends `.6rem` above the band
       * (the plate's bottom padding). Sizing against the band therefore
       * licensed the step to grow PAST its own container: the outer scroller
       * gained ~12–24 px of travel — a SECOND vertical rail beside this step's
       * own, with only two target cards on screen — and what it clipped was the
       * last element of this column: the status rail, i.e. the Result line.
       *
       * The clip box is the honest reference precisely because it is the thing
       * that decides whether anything scrolls. The band stays in the `min` for
       * the host that stretches its scroller to the band (the play path), where
       * the two agree anyway.
       *
       * ACYCLIC, and the clamp is what makes it so. `root.top` is read while
       * this step sits INSIDE that scroller, so a scrolled viewport would hand
       * back a LARGER budget → a taller step → more to scroll → larger still.
       * Bounding the budget by the clip box's own height breaks that loop by
       * construction, at every scroll position.
       */
      const band = root.closest<HTMLElement>('[data-ws-band]');
      // EVERY BOTTOM EDGE BETWEEN THIS STEP AND THE BAND. The band's bottom is
      // the honest floor, but the step does not sit ON it: in the action host
      // the stage plate wraps it and keeps `.6rem` of padding below, so a step
      // sized to the band's bottom ends `.6rem` past the box that clips it. The
      // outer scroller then gained travel — a SECOND rail with two cards on
      // screen — and cut the last element of this column, the Result line.
      //
      // ⚠️ PADDINGS AND BORDERS ONLY, and that is the whole reason this is safe:
      // they are fixed by the layout, so none of them is a function of the size
      // this measurement is about to produce. (Reading the scroll VIEWPORT's own
      // height instead is the tempting version and it is circular — that box is
      // `flex: 0 1 auto`, i.e. content-sized, so it reports back whatever the
      // cards last came out as. It collapsed the budget until a two-card row
      // stacked vertically.)
      let inset = 0;
      for (let el = root.parentElement; el !== null && el !== band; el = el.parentElement) {
        const cs = getComputedStyle(el);
        inset += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
      const budget = Math.max(160, band !== null ?
        band.getBoundingClientRect().bottom - root.getBoundingClientRect().top - inset :
        this.bandHeight);
      this.budgetPx = budget;
      const chrome = (this.$refs.contract as HTMLElement | undefined)?.offsetHeight ?? 0;
      const tabs = (this.$refs.tabs as HTMLElement | undefined)?.offsetHeight ?? 0;
      const rail = (this.$refs.rail as HTMLElement | undefined)?.offsetHeight ?? 0;
      // The column gaps of `.con-ptsel` — one FEWER than its children, and the
      // owner-tabs row is conditional. It was hardcoded to 3, which handed back
      // 11 px of phantom room on every single-owner step (the common case).
      const gaps = (tabs > 0 ? 3 : 2) * PTSEL_COLUMN_GAP_PX * conUiScale();
      // The RAIL IS RESERVED FIRST. Its height comes out of the budget before a
      // single card is sized — the cards get what is left, never the other way
      // round. That ordering is what stops an oversized candidate from pushing
      // the reading of it off the screen.
      const availH = Math.max(120, budget - chrome - tabs - rail - gaps);
      this.sizing = planPlayedTargetSizing({
        owners: this.model.owners,
        mode: this.layout.mode,
        availW,
        availH,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
        tags: this.tagsOn,
        tagLines: this.tagLines,
      });
    },
    /** Chosen = the confirmed single target, or a member of the multi pick. */
    isChosen(cardName: string): boolean {
      return this.selection.mode === 'multi' ?
        this.selection.picked.includes(cardName) :
        cardName === this.lockedCard;
    },
    /** In a multi ask the badge carries the ORDER — «первое / второе событие»
     *  is what the server's own slots mean, so the player can see which is
     *  which without reading the prompt again. A single ask just ticks. */
    pickOrdinal(cardName: string): string {
      if (this.selection.mode !== 'multi') {
        return '✓';
      }
      const at = this.selection.picked.indexOf(cardName);
      return at < 0 ? '✓' : String(at + 1);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    showsResource(cand: PlayedTargetCandidate): boolean {
      return playedTargetShowsResource(cand.resourceContext);
    },
    sectionsOf(owner: PlayedTargetOwner): ReadonlyArray<PlayedTargetSection> {
      return playedTargetSections(owner);
    },
    /**
     * A category's WIDTH IS ITS SPAN — the columns its own cards need at the
     * solved row count, not an equal share of the band.
     *
     * This is the visual half of the layout fix. A two-card category gets two
     * card widths; a one-card category gets one. Bounding the section to
     * exactly that width is what makes the flex row inside it wrap at the right
     * place, so the cards land in the grid the solver actually planned.
     */
    sectionStyle(section: PlayedTargetSection): Record<string, string> {
      const cols = Math.max(1, Math.ceil(section.candidates.length / Math.max(1, this.sizing.rows)));
      const cardW = this.cardWidthPx;
      // CEIL plus a pixel of slack: the cards row wraps at exactly this
      // width, so a half-pixel of rounding the other way would push the last
      // card of a span onto a second line — the very stack this span exists
      // to prevent.
      return {width: `${Math.ceil(cols * cardW + (cols - 1) * this.sizing.gapPx) + 1}px`};
    },
    showsRails(owner: PlayedTargetOwner): boolean {
      return playedTargetShowsCategoryRails(playedTargetSections(owner));
    },
    /** The candidate's index in its OWNER's list — the focus vocabulary. The
     *  cards render grouped by category, so a section-local index would name a
     *  different card than the one the host is pointing at. */
    indexOf(owner: PlayedTargetOwner, cardName: string): number {
      return owner.candidates.findIndex((c) => c.cardName === cardName);
    },
    /** «ДОСТУПНО N» counts what can be CHOSEN — a shown near miss (`blocked`) stands in the row, never in the count. */
    selectableIn(candidates: ReadonlyArray<PlayedTargetCandidate>): number {
      return candidates.filter((c) => c.blocked === undefined).length;
    },
    isFocused(ownerId: string, cardName: string): boolean {
      return this.focus.ownerId === ownerId && this.focused?.cardName === cardName;
    },
    /** WHERE the bot's first unit comes from — a colony area by its name, the floater counter, the M€ proxy. */
    botStorageText(bot: TableTargetBotStand): string {
      const key = tableTargetBotStorageKey(bot);
      return bot.colony !== undefined ? translateTextWithParams(key, [translateText(bot.colony)]) : translateTextWithParams(key, []);
    },
    /** The bot's loss as the server reads it, pool by pool — else the one delta of the unit. */
    botChanges(bot: TableTargetBotStand): ReadonlyArray<{icon: string, from: number, to: number}> {
      const moving = bot.changes.filter((c) => c.from !== c.to);
      if (moving.length > 0) {
        return moving;
      }
      return bot.current !== undefined && bot.resulting !== undefined ? [{icon: bot.icon, from: bot.current, to: bot.resulting}] : [];
    },
  },
});
</script>
