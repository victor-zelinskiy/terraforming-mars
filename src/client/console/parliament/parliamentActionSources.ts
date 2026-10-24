/**
 * THE PARLIAMENT'S ACTIONS AS SOURCES OF «ДЕЙСТВИЯ КАРТ» (Turmoil Redux «один фреймворк», 2026-10-24) — ONE builder for
 * every host of the action tiles: the live workspace (the viewer's seat, the execution gate from the live prompt) and
 * the read-only galleries of Information (any seat). Before this the live workspace had its own builder and the
 * gallery passed none — the Parliament's actions simply did not exist on another surface of the same grid.
 *
 * WHAT is held is `politicalSources` (the one answer, its order); the VERDICT is the server's — the viewer's own
 * `ParliamentModel.viewer.partyActions` / `.resolutionAction` (access, uses, the action's gate with its reason); another
 * seat's is only what is public (its uses this generation) and reads like another seat's card: shown, never
 * activatable (`foreign`). The execution gate is the option's PRESENCE in the live action menu (the prompt bridge) —
 * never re-derived.
 */
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {PARTY_ACTION_USES_PER_GENERATION} from '@/common/parliament/ParliamentTypes';
import {actionUsesFor} from '@/common/parliament/actionUses';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {isResolutionActionSource, type ParliamentActionSource} from '@/client/console/consoleCardActions';
import type {DossierPoliticalAction} from '@/client/console/infoDossierModel';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {translateMessage} from '@/client/directives/i18n';
import {actionRowsOf} from '@/client/console/parliament/actionRows';
import {parliamentPromptBridge} from '@/client/console/parliament/consoleParliamentModel';
import {politicalSources} from '@/client/console/parliament/politicalSources';
import {findTradeColonyContext} from '@/client/console/turnIntents';

export type ParliamentActionSourcesInput = {
  parliament: ParliamentModel | undefined;
  /** Whose actions. */
  color: Color | string | undefined;
  /** The viewer — only the viewer's own seat carries the server's verdicts. */
  viewerColor: Color | string | undefined;
  /** The LIVE prompt (the execution gate) — absent: nothing is offered (a read-only host). */
  waitingFor?: PlayerInputModel;
};

export function parliamentActionSources(input: ParliamentActionSourcesInput): Array<ParliamentActionSource> {
  const {parliament, color} = input;
  if (parliament === undefined) {
    return [];
  }
  const seat = parliament.players.find((p) => p.color === color);
  const own = color !== undefined && color === input.viewerColor && parliament.viewer !== undefined;
  const awaitingInput = input.waitingFor !== undefined;
  const bridge = parliamentPromptBridge(input.waitingFor);
  // The Unity trade rides the colony TRADE action, never a menu branch of its own: it is offered exactly when the live
  // trade prompt carries the payment path marked with the Unity party (`metadata.party`).
  const trade = findTradeColonyContext(input.waitingFor);
  const unityOffered = trade !== undefined && trade.paymentOptions.some((o) => o.metadata?.party === PartyName.UNITY);
  const out: Array<ParliamentActionSource> = [];
  for (const source of politicalSources(parliament, color)) {
    if (!source.hasAction) {
      continue;
    }
    if (source.source.kind === 'party') {
      const party = source.source.party;
      const effect = getPartyEffect(party);
      const actionId = effect?.actionId;
      if (effect === undefined || actionId === undefined) {
        continue;
      }
      const base = {
        party,
        actionId,
        ...(source.allyVia !== undefined ? {allyVia: source.allyVia} : {}),
        renderRoot: effect.actionRenderData ?? effect.passiveRenderData,
        rule: effect.text.action ?? effect.text.rule,
      };
      if (own) {
        const verdict = parliament.viewer?.partyActions.find((a) => a.party === party);
        if (verdict === undefined || !verdict.hasAccess) {
          continue;
        }
        out.push({
          ...base,
          usesLeft: verdict.usesLeft,
          usesPerGeneration: verdict.usesPerGeneration,
          available: verdict.available,
          reason: verdict.reason,
          offered: actionId === 'unity-trade' ? unityOffered : bridge.actions[actionId] !== undefined,
          awaitingInput,
          preview: verdict.preview,
        });
      } else {
        const per = effect.usesPerGeneration ?? PARTY_ACTION_USES_PER_GENERATION;
        out.push({...base, ...foreignVerdict(per, seat?.partyActionUses[party] ?? 0)});
      }
      continue;
    }
    const resolution = getResolution(source.source.resolution);
    if (resolution === undefined) {
      continue;
    }
    const base = {
      resolution: resolution.id,
      party: resolution.party,
      name: resolution.text.name,
      renderRoot: actionRowsOf(resolution.renderData),
      rule: resolution.text.action ?? '',
      ...(resolution.actionBill === undefined ? {} : {bill: resolution.actionBill}),
    };
    if (own) {
      const law = parliament.viewer?.resolutionAction;
      if (law === undefined || !law.hasAccess || law.resolution !== resolution.id) {
        continue;
      }
      out.push({
        ...base,
        usesLeft: law.usesLeft,
        usesPerGeneration: law.usesPerGeneration,
        available: law.available,
        reason: law.reason,
        offered: bridge.resolutionAction !== undefined && bridge.resolutionAction.resolution === resolution.id,
        awaitingInput,
        preview: law.preview,
        ...(law.futile === undefined ? {} : {futile: law.futile}),
      });
    } else {
      const per = actionUsesFor(resolution.actionUses, seat?.influence ?? 0);
      out.push({...base, ...foreignVerdict(per, seat?.resolutionActionUses ?? 0)});
    }
  }
  return out;
}

/** Another seat's action: only its public uses — shown like another seat's card, never activatable. */
function foreignVerdict(per: number, used: number): Pick<ParliamentActionSource, 'usesLeft' | 'usesPerGeneration' | 'available' | 'reason' | 'offered' | 'awaitingInput' | 'preview' | 'foreign'> {
  return {
    usesLeft: Math.max(0, per - used),
    usesPerGeneration: per,
    available: true,
    reason: '',
    offered: false,
    awaitingInput: false,
    preview: [],
    foreign: true,
  };
}


/** The dossier's reading of the same sources (the summary plate and the gallery's legend count them like cards). */
export function dossierPoliticalActions(sources: ReadonlyArray<ParliamentActionSource>): Array<DossierPoliticalAction> {
  return sources.map((source) => {
    const law = isResolutionActionSource(source);
    return {
      key: law ? `law:${source.resolution}` : `party:${source.party}`,
      party: source.party,
      title: law ? source.name : partyNameKey(source.party),
      usesLeft: source.usesLeft,
      available: source.available,
      reason: typeof source.reason === 'string' ? source.reason : translateMessage(source.reason),
      foreign: source.foreign === true,
    };
  });
}
