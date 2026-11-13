<template>
  <div class="card-list-container" :class="getLanguageCssClass()">
    <h1 v-i18n>Cards List</h1>

      <!-- start filters -->

      <div class="search-container">
        <input ref="filter" class="filter" :placeholder="$t('filter')" v-model="filterText">
        <button id="namesOnlyToggle" name="namesOnly" v-on:click="toggleNamesOnly()">
            <span v-if="namesOnly === true" v-i18n>Names only</span>
            <span v-else v-i18n>Full text</span>
        </button>

        <button id="sort-order" v-on:click="toggleSortOrder()" style="width: 85px;">
            <span v-if="sortOrder === 'a'" v-i18n>A-Z</span>
            <span v-else v-i18n>0-9</span>
            &#x2195;
        </button>

        <button id="show-vps-only" v-on:click="toggleVps()" style="width: 63px;">
            <span v-if="vps === 0" v-i18n>all</span>
            <span v-if="vps === 1" v-i18n>+VPs</span>
            <span v-if="vps === 2" v-i18n>-VPs</span>
        </button>

        <button id="show-metadata" v-on:click="toggleShowMetadata()" style="width: 60px;" title="Show/hide colony metadata">
            <span v-if="showMetadata === true">🛰️■</span>
            <span v-else>🛰️□</span>
        </button>

        <button id="tall-cards" v-on:click="toggleTallCards()" style="width: 90px;" title="Show tall / short cards">
            <span v-if="tallCards === true">🂠→<span class="small-card">🂠</span></span>
              <span v-else><span class="small-card">🂠</span>→🂠</span>
        </button>

        <button id="advanced-search-collapser" v-on:click="toggleAdvancedSearch()">
            <span v-if="showAdvanced === true" v-i18n>Advanced «</span>
            <span v-else v-i18n>Advanced »</span>
        </button>
      </div>

      <div id="selections" v-show="showAdvanced">
        <!-- expansions -->
        <div class="selection-row">
          <button id="toggle-checkbox" v-on:click="invertExpansions()">-</button>

          <span v-for="expansion in allModules" :key="expansion">
            <input type="checkbox" :name="expansion" :id="`${expansion}-checkbox`" v-model="expansions[expansion]">
            <label :for="`${expansion}-checkbox`" class="expansion-button">
              <div class='expansion-icon' :class="expansionIconClass(expansion)"></div>
            </label>
          </span>
        </div>

        <!-- types -->
        <div class="selection-row">
          <button id="toggle-checkbox" v-on:click="invertTypes()">
              <span v-i18n>-</span>
          </button>

          <span v-for="type in allTypes" :key="type">
            <input type="checkbox" :name="`${type}-cardType`" :id="`${type}-cardType-checkbox`" v-model="types[type]">
            <label :for="`${type}-cardType-checkbox`" class="expansion-button">
                <span v-if="type === 'colonyTiles'" v-i18n>Colony Tiles</span>
                <span v-else-if="type === 'globalEvents'" v-i18n>Global Events</span>
                <span v-else v-i18n>{{type}}</span>
            </label>
          </span>
        </div>

        <!-- tags -->
        <div class="selection-row">
          <button id="toggle-checkbox" v-on:click="invertTags()">
              <span v-i18n>-</span>
          </button>
          <span v-for="tag in allTags" :key="tag">
            <input v-if="tag === 'event'" type="checkbox" :name="`${tag}-cardType`" :id="`${tag}-tag-checkbox`" v-model="types.event">
            <input v-else type="checkbox" :name="`${tag}-cardType`" :id="`${tag}-tag-checkbox`" v-model="tags[tag]">
            <label :for="`${tag}-tag-checkbox`" class="expansion-button">
              <!-- a terrible hack, using expansion-icon because card-tag isn't enough to show the tag.-->
              <div :class="`expansion-icon card-tag tag-${tag}`"></div>
            </label>
          </span>
        </div>

        <!-- card resources -->
        <div class="selection-row">
          <button id="toggle-checkbox" v-on:click="invertResources()">
              <span v-i18n>-</span>
          </button>
          <span v-for="resource in allResources" :key="resource">
            <input type="checkbox" :name="`${resource}-cardType`" :id="`${resource}-resource-checkbox`" v-model="resources[resource]">
            <label :for="`${resource}-resource-checkbox`" class="expansion-button">
              <!-- a terrible hack, using expansion-icon because card-resource isn't enough to show the resource.-->
              <div v-if="resource !== 'none'" class="expansion-icon card-resource" :class="cardResourceCSS[resource]"></div>
              <div v-else class="expansion-icon card-tag tag-none"></div>
            </label>
          </span>
        </div>

      </div>
      <!-- start cards -->

      <section v-show="visibleProjectCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Project Cards</h2>
          <div class="cardbox" v-for="card in visibleProjectCards" :key="card">
              <Card :card="{'name': card}" :autoTall="tallCards" />
          </div>
          <br>
      </section>
      <section v-show="visibleCorporationCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Corporations</h2>
          <div class="cardbox" v-for="card in visibleCorporationCards" :key="card">
              <Card :card="{'name': card}" :autoTall="tallCards"/>
          </div>
          <br>
      </section>
      <section v-show="visiblePreludeCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>Preludes</h2>
          <div class="cardbox" v-for="card in visiblePreludeCards" :key="card">
              <Card :card="{'name': card}" :autoTall="tallCards"/>
          </div>
          <br>
      </section>
      <section v-show="visibleCeoCards.length > 0" class="card-list-cards-list">
          <h2 v-i18n>CEOs</h2>
          <div class="cardbox" v-for="card in visibleCeoCards" :key="card">
              <Card :card="{'name': card}" :autoTall="tallCards" />
          </div>
          <br>
      </section>
      <section v-show="visibleStandardProjectCards.length > 0" class="card-list-cards-list">
        <h2 v-i18n>Standard Projects</h2>
        <div class="cardbox" v-for="card in visibleStandardProjectCards" :key="card">
            <Card :card="{'name': card}" :autoTall="tallCards" />
        </div>
      </section>

      <section v-show="visibleGlobalEvents.length > 0" class="card-list-cards-list">
        <h2 v-i18n>Global Events</h2>
        <div class="cardbox" v-for="globalEventName in visibleGlobalEvents" :key="globalEventName">
          <global-event :globalEventName="globalEventName" type="distant"></global-event>
        </div>
      </section>

      <section v-show="visibleColonyNames.length > 0">
        <h2 v-i18n>Colonies</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="colonyName in visibleColonyNames" :key="colonyName">
            <colony :colony="colonyModel(colonyName)"></colony>
          </div>
        </div>
      </section>

      <section v-show="visibleMilestoneNames.length > 0">
        <h2 v-i18n>Milestones</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="milestoneName in visibleMilestoneNames" :key="milestoneName">
            <div class="milestones"> <!-- This div is necessary for the CSS. Perhaps find a way to remove that?-->
              <milestone :milestone="milestoneModel(milestoneName)" :showDescription="true"></milestone>
            </div>
          </div>
        </div>
      </section>

      <section v-show="visibleAwardNames.length > 0">
        <h2 v-i18n>Awards</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="awardName in visibleAwardNames" :key="awardName">
            <div class="awards"> <!-- This div is necessary for the CSS. Perhaps find a way to remove that?-->
              <award :award="awardModel(awardName)" :showDescription="true"></award>
            </div>
          </div>
        </div>
      </section>

      <section v-show="visibleAgendaIds.length > 0">
        <h2 v-i18n>Agendas</h2>
        <div class="player_home_colony_cont">
          <div class="player_home_colony" v-for="id in visibleAgendaIds" :key="id">
            <TurmoilAgendaContainer :agendaId="id" />
          </div>
        </div>
      </section>

      <div class="free-floating-preferences-icon">
        <preferences-icon></preferences-icon>
      </div>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, onMounted, reactive, toRefs, useTemplateRef} from 'vue';
import {CardType} from '@/common/cards/CardType';
import {CardName} from '@/common/cards/CardName';
import {getEnumStringValues, partition, toName} from '@/common/utils/utils';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {GlobalEventName} from '@/common/turmoil/globalEvents/GlobalEventName';
import {allGlobalEventNames, getGlobalEvent} from '@/client/turmoil/ClientGlobalEventManifest';
import {byType, getCard, getCardOrThrow, getCards} from '@/client/cards/ClientCardManifest';
import {COMMUNITY_COLONY_NAMES, OFFICIAL_COLONY_NAMES, PATHFINDERS_COLONY_NAMES, TURMOIL_REDUX_COLONY_NAMES} from '@/common/colonies/AllColonies';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Expansion, GameModule, GAME_MODULES} from '@/common/cards/GameModule';
import {Tag} from '@/common/cards/Tag';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {ClientCard} from '@/common/cards/ClientCard';
import {$t, translateText} from '@/client/directives/i18n';
import {MilestoneName, milestoneNames} from '@/common/ma/MilestoneName';
import {AwardName, awardNames} from '@/common/ma/AwardName';
import {ClaimedMilestoneModel} from '@/common/models/ClaimedMilestoneModel';
import {FundedAwardModel} from '@/common/models/FundedAwardModel';
import {TypeOption, CardListModel, hashToModel, modelToHash, ResourceOption, TagOption} from '@/client/components/cardlist/CardListModel';
import {getAward, getMilestone} from '@/client/MilestoneAwardManifest';
import {BonusId, BONUS_IDS, PolicyId, POLICY_IDS} from '@/common/turmoil/Types';
import Card from '@/client/components/card/CardFace.vue';
import Colony from '@/client/components/colonies/Colony.vue';
import GlobalEvent from '@/client/components/turmoil/GlobalEvent.vue';
import PreferencesIcon from '@/client/components/PreferencesIcon.vue';
import Milestone from '@/client/components/Milestone.vue';
import Award from '@/client/components/Award.vue';
import TurmoilAgendaContainer from '@/client/components/cardlist/TurmoilAgendaContainer.vue';
import {CardResource} from '@/common/CardResource';
import {cardResourceCSS} from '../common/cardResources';
import {setDocumentTitle} from '@/client/utils/documentTitle';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'card-list'});

// The filters are ONE model, read off the location hash and written back to it whole (`modelToHash`); the
// template and the script read its fields by name.
const model = reactive(hashToModel(window.location.hash));
const {filterText, expansions, types, tags, resources, searchIndex, namesOnly, showAdvanced, sortOrder, showMetadata, tallCards, vps} = toRefs(model);
const flow = useFlowScope('card-list');
const filter = useTemplateRef<HTMLInputElement>('filter');

const allModules = GAME_MODULES;
const allTypes = computed((): Array<TypeOption> => {
  return [
    CardType.EVENT,
    CardType.ACTIVE,
    CardType.AUTOMATED,
    CardType.PRELUDE,
    CardType.CORPORATION,
    CardType.STANDARD_PROJECT,
    CardType.CEO,
    'colonyTiles',
    'globalEvents',
    'milestones',
    'awards',
    'agendas',
  ];
});
const allTags = computed((): Array<TagOption> => {
  const results: Array<TagOption> = [];
  for (const tag in Tag) {
    if (Object.prototype.hasOwnProperty.call(Tag, tag)) {
      results.push((<any>Tag)[tag]);
    }
  }
  return results.concat('none');
});
const allResources = computed((): Array<ResourceOption> => {
  return [...getEnumStringValues(CardResource), 'none'];
});
const allMilestoneNames = computed((): ReadonlyArray<MilestoneName> => {
  return [...milestoneNames].sort();
});
const allAwardNames = computed((): ReadonlyArray<AwardName> => {
  return [...awardNames].sort();
});
const allAgendaIds = computed((): ReadonlyArray<PolicyId | BonusId> => {
  const ids = (POLICY_IDS as ReadonlyArray<PolicyId | BonusId>).concat(BONUS_IDS);
  const [official, expansion] = partition(ids, (id) => id.endsWith('01'));
  official.sort(); // This puts matching party content together.
  expansion.sort();
  return [...official, ...expansion];
});
const visibleProjectCards = computed((): Array<CardName> => {
  return getAllProjectCards().filter((c) => showCard(c));
});
const visibleCorporationCards = computed((): Array<CardName> => {
  return getAllCorporationCards().filter((c) => showCard(c));
});
const visiblePreludeCards = computed((): Array<CardName> => {
  return getAllPreludeCards().filter((c) => showCard(c));
});
const visibleCeoCards = computed((): Array<CardName> => {
  return getAllCeoCards().filter((c) => showCard(c));
});
const visibleStandardProjectCards = computed((): Array<CardName> => {
  return getAllStandardProjectCards().filter((c) => showCard(c));
});
const visibleGlobalEvents = computed((): Array<GlobalEventName> => {
  if (!types.value.globalEvents) {
    return [];
  }
  return getAllGlobalEvents().filter((e) => showGlobalEvent(e));
});
const visibleColonyNames = computed((): Array<ColonyName> => {
  if (!types.value.colonyTiles) {
    return [];
  }
  return getAllColonyNames().filter((c) => showColony(c));
});
const visibleMilestoneNames = computed((): Array<MilestoneName> => {
  if (!types.value.milestones) {
    return [];
  }
  return allMilestoneNames.value.filter((m) => showMilestone(m));
});
const visibleAwardNames = computed((): Array<AwardName> => {
  if (!types.value.awards) {
    return [];
  }
  return allAwardNames.value.filter((a) => showAward(a));
});
const visibleAgendaIds = computed((): Array<PolicyId | BonusId> => {
  if (!types.value.agendas) {
    return [];
  }
  return allAgendaIds.value.filter((id) => include(id, 'agenda'));
});

function delayedSetLocationHash(delayms: number = 200) {
  // An owned timer of the list (flow kernel — PLAN §10 · C1): the self-re-arming sync ends with the screen.
  flow.after(delayms, 'the card list\'s next hash sync', () => {
    const changed = setLocationHash();
    delayedSetLocationHash(changed ? 10 : 100);
  });
}
function setLocationHash(): boolean {
  // (the cast: the reactive view of the model types its `searchIndex` by the class's public members only)
  const hash = modelToHash(model as CardListModel);
  const changed = hash !== window.location.hash;
  window.location.hash = hash;
  return changed;
}
function invertExpansions() {
  GAME_MODULES.forEach((module) => expansions.value[module] = !expansions.value[module]);
}
function invertTags() {
  allTags.value.forEach((tag) => tags.value[tag] = !tags.value[tag]);
}
function invertResources() {
  allResources.value.forEach((resource) => resources.value[resource] = !resources.value[resource]);
}
function invertTypes() {
  allTypes.value.forEach((type) => types.value[type] = !types.value[type]);
}
function sort<T extends string>(names: Array<T>): Array<T> {
  if (sortOrder.value === 'a') {
    const translated = names.map((name) => ({name: name, text: translateText(name)}));
    translated.sort((a, b) => a.text.localeCompare(b.text));
    return translated.map((e) => e.name);
  } else {
    const numbered = names.map((name) => ({name: name, number: getCardOrThrow(name as CardName).metadata.cardNumber ?? ''}));
    numbered.sort((a, b) => a.number.localeCompare(b.number));
    return numbered.map((e) => e.name);
  }
}
function getAllStandardProjectCards() {
  const names = getCards(byType(CardType.STANDARD_PROJECT)).map(toName);
  return sort(names);
}
function getAllProjectCards() {
  const names: Array<CardName> = [];
  names.push(...getCards(byType(CardType.AUTOMATED)).map(toName));
  names.push(...getCards(byType(CardType.ACTIVE)).map(toName));
  names.push(...getCards(byType(CardType.EVENT)).map(toName));
  return sort(names);
}
function getAllCorporationCards() {
  const names = getCards(byType(CardType.CORPORATION)).map(toName);
  return sort(names);
}
function getAllPreludeCards() {
  const names = getCards(byType(CardType.PRELUDE)).map(toName);
  return sort(names);
}
function getAllCeoCards() {
  const names = getCards(byType(CardType.CEO)).map(toName);
  return sort(names);
}
function getAllGlobalEvents() {
  if (sortOrder.value === 'a') {
    return sort(Array.from(allGlobalEventNames()));
  } else {
    return Array.from(allGlobalEventNames());
  }
}
function getAllColonyNames() {
  return OFFICIAL_COLONY_NAMES.concat(COMMUNITY_COLONY_NAMES).concat(PATHFINDERS_COLONY_NAMES).concat(TURMOIL_REDUX_COLONY_NAMES);
}
function include(name: string, type: 'card' | 'globalEvent' | 'colony' | 'ma' | 'agenda') {
  const normalized = filterText.value.toLocaleUpperCase();
  if (normalized.length === 0) {
    return true;
  }
  if (namesOnly.value) {
    return name.toLocaleUpperCase().includes(normalized);
  } else {
    return searchIndex.value.matches(filterText.value, type, name);
  }
}
function expansionIconClass(expansion: GameModule): string {
  switch (expansion) {
  case 'base': return 'expansion-icon-base';
  case 'corpera': return 'expansion-icon-CE';
  case 'colonies': return 'expansion-icon-colony';
  case 'moon': return 'expansion-icon-themoon';
  default: return `expansion-icon-${expansion}`;
  }
}
function filterByTags(card: ClientCard): boolean {
  if (card.tags.length === 0) {
    return tags.value['none'] === true;
  }

  let matches = false;
  for (const tag of card.tags) {
    if (tags.value[tag]) {
      matches = true;
    }
  }
  return matches;
}
function showCard(cardName: CardName): boolean {
  if (!include(cardName, 'card')) {
    return false;
  }

  const card = getCard(cardName);
  if (card === undefined) {
    return false;
  }

  if (!filterByTags(card)) {
    return false;
  }
  if (!types.value[card.type]) {
    return false;
  }
  if (card.resourceType === undefined) {
    if (resources.value.none === false) {
      return false;
    }
  } else {
    if (!resources.value[card.resourceType]) {
      return false;
    }
  }
  switch (vps.value) {
  case 1:
    if (card.victoryPoints === undefined) {
      return false;
    }
    break;
  case 2:
    if (card.victoryPoints !== undefined) {
      return false;
    }
    break;
  }
  return expansions.value[card.module] === true;
}
function showGlobalEvent(name: GlobalEventName): boolean {
  if (!include(name, 'globalEvent')) {
    return false;
  }
  const globalEvent = getGlobalEvent(name);
  return globalEvent !== undefined && expansions.value[globalEvent.module] === true;
}
function showColony(name: ColonyName): boolean {
  if (!include(name, 'colony')) {
    return false;
  }
  const colony = getColony(name);
  return colony !== undefined && expansions.value[colony.module ?? 'base'] === true;
}
function showMilestone(name: MilestoneName): boolean {
  if (!include(name, 'ma')) {
    return false;
  }
  return requirementsMet(getMilestone(name).requirements);
}
function showAward(name: AwardName): boolean {
  if (!include(name, 'ma')) {
    return false;
  }
  return requirementsMet(getAward(name).requirements);
}
/** A milestone / award shows when ANY of the modules it needs is selected (none = base). */
function requirementsMet(requirements: Expansion | ReadonlyArray<Expansion> | undefined): boolean {
  if (requirements === undefined) {
    return expansions.value.base === true;
  }
  const anyOf: ReadonlyArray<Expansion> = typeof requirements === 'string' ? [requirements] : requirements;
  return anyOf.some((m) => expansions.value[m] === true);
}
function getLanguageCssClass() {
  const language = getPreferences().lang;
  return 'language-' + language;
}
function colonyModel(colonyName: ColonyName): ColonyModel {
  return {
    colonies: showMetadata.value ? ['red', 'blue'] : [],
    isActive: showMetadata.value,
    name: colonyName,
    trackPosition: 3,
    visitor: undefined,
  };
}
function milestoneModel(name: MilestoneName): ClaimedMilestoneModel {
  return {name, playerName: undefined, color: undefined, scores: []};
}
function awardModel(name: AwardName): FundedAwardModel {
  return {name, playerName: undefined, color: undefined, scores: []};
}
function toggleNamesOnly(): void {
  namesOnly.value = !namesOnly.value;
}
function toggleAdvancedSearch(): void {
  showAdvanced.value = !showAdvanced.value;
}
function toggleSortOrder(): void {
  sortOrder.value = sortOrder.value === 'a' ? '1' : 'a';
}
function toggleVps(): void {
  vps.value = (vps.value + 1) % 3;
}
function toggleShowMetadata(): void {
  showMetadata.value = !showMetadata.value;
}
function toggleTallCards(): void {
  tallCards.value = !tallCards.value;
}

onMounted(() => {
  setDocumentTitle('Cards List');
  filter.value?.focus();
  delayedSetLocationHash();
});
</script>
