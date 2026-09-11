import {reactive} from 'vue';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/**
 * CAMPAIGN OVERVIEW UI — the module-level mirror of the in-game campaign
 * overview (the Information workspace's «Кампания» route), following the
 * `consolePlayedUi` pattern: the overview component owns the state, the
 * Information host reads the COMMAND CONTRACT from here (a computed must
 * never reach into another component's $refs), and cursors live at module
 * level so they survive the route's out-in swaps and seat switches.
 *
 * LEVELS — the overview is one surface with nested read-only layers:
 *   'route'   — the mission route + participant rows (the base layer);
 *   'mission' — «Осмотр миссии» of ANY mission `missionSlot` (the hero
 *               board + state-appropriate detail: results for a committed
 *               one, live facts for the active one, the known features for
 *               a future one);
 *   'legacy'  — «Наследие участника» of seat `legacySeat`.
 * B walks exactly one level; the base layer's B returns to the summary
 * (owned by the host through `infoBack`).
 */

export type CampaignOverviewLevel = 'route' | 'mission' | 'legacy';
export type CampaignOverviewZone = 'route' | 'seats';

type CampaignOverviewUi = {
  level: CampaignOverviewLevel;
  zone: CampaignOverviewZone;
  routeIndex: number;
  seatIndex: number;
  /** The mission the inspect layer shows (any state). */
  missionSlot: number;
  /** The seat the legacy layer shows. */
  legacySeat: number;
  /** Cursor over the legacy layer's inspectable cards (corps + carried). */
  legacyCursor: number;
  /** The command contract the Information host publishes verbatim. */
  barCommands: ReadonlyArray<ConsoleCommand> | undefined;
};

export const campaignOverviewUi: CampaignOverviewUi = reactive({
  level: 'route',
  zone: 'route',
  routeIndex: 0,
  seatIndex: 0,
  missionSlot: 0,
  legacySeat: 0,
  legacyCursor: 0,
  barCommands: undefined,
});

/** Fresh entry into the campaign route (A on the summary zone). */
export function resetCampaignOverview(currentSlot: number): void {
  campaignOverviewUi.level = 'route';
  campaignOverviewUi.zone = 'route';
  campaignOverviewUi.routeIndex = currentSlot;
  campaignOverviewUi.seatIndex = 0;
  campaignOverviewUi.legacyCursor = 0;
}

/**
 * The crumb tail of the campaign route (already TRANSLATED — the host maps
 * translateText over it, which is identity for a resolved string). The
 * stable «Кампания» comes first; only the nested layer's word advances.
 */
export function campaignStagePath(): ReadonlyArray<string> {
  const base = translateText('Campaign');
  if (campaignOverviewUi.level === 'mission') {
    return [base, translateTextWithParams('Mission ${0}', [String(campaignOverviewUi.missionSlot + 1)])];
  }
  if (campaignOverviewUi.level === 'legacy') {
    return [base, translateText('Legacy')];
  }
  return [base];
}
