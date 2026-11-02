/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE TARGET DOSSIER — X on a candidate of «where does it go» reads the CARD AS A TARGET (the owner, 2026-11-02: «X —
 * осмотреть каждую target карту с контекстом именно по ресурсам на ней, а не только описание правил»). The fullscreen
 * viewer lifts the face; beside it, before the card's rules, ONE panel says what the rules alone cannot: whose card it
 * is, what lies on it now, what THIS move does to it (the very impacts the step's rail reads under the cursor — never a
 * second derivation), and why a near miss cannot take it.
 *
 * Pure: built off the step's own model (`PlayedTargetModel`), read by the viewer through `consoleCardZoom.targetAt`.
 * Every host of the target step opens the viewer through ONE door (`openPlayedTargetZoom`), so the dossier reaches all
 * of them at once: the action composer, the play sheet, the trade's target step, the Hydronetwork, the live Venus bonus.
 */
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {
  PlayedTargetCandidate, PlayedTargetImpact, PlayedTargetModel, PlayedTargetOwner, PlayedTargetPayload,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetSourceCardName} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';

/** One section of the dossier — a preview section's title and its impacts, verbatim. */
export type PlayedTargetDossierSection = {
  key: string;
  /** i18n key. */
  title: string;
  impacts: ReadonlyArray<PlayedTargetImpact>;
  note?: string;
};

export type PlayedTargetDossier = {
  cardName: CardName;
  /** Whose table the card lies on — the seat's name and colour; `self` the viewer's own. */
  owner: {name: string, color: string, self: boolean};
  /** What lies on it NOW — the card's own resource and its count (absent: a card that holds nothing of the kind). */
  holding?: {icon: string, count: number};
  /** What the move lands on it — the step's payload («+1 [?]»), when the step names one. */
  payload?: PlayedTargetPayload;
  /** What this move does to it — the step's own preview sections (the rail's words), in their order. */
  sections: ReadonlyArray<PlayedTargetDossierSection>;
  /** A near miss: the server's reason and the «have / need» — the card is shown, never chosen. */
  blocked?: {reason: string, have: number, need: number};
  /** This step takes FROM the card and it is the viewer's own while another target existed. */
  selfHarm: boolean;
};

function holdingOf(candidate: PlayedTargetCandidate): PlayedTargetDossier['holding'] {
  const ctx = candidate.resourceContext;
  if (ctx !== undefined && ctx.icon !== '') {
    return {icon: ctx.icon, count: ctx.count};
  }
  return undefined;
}

/** The dossier of `cardName` in the step's model — undefined for a stand-in (no card) or a name the model lacks. */
export function playedTargetDossierOf(model: PlayedTargetModel, cardName: CardName): PlayedTargetDossier | undefined {
  let owner: PlayedTargetOwner | undefined;
  let candidate: PlayedTargetCandidate | undefined;
  for (const o of model.owners) {
    const c = o.candidates.find((x) => x.cardName === cardName);
    if (c !== undefined) {
      owner = o;
      candidate = c;
      break;
    }
  }
  if (owner === undefined || candidate === undefined || candidate.stand !== undefined) {
    return undefined;
  }
  const sections = candidate.preview
    .filter((s) => s.impacts.length > 0 || s.note !== undefined)
    .map((s) => ({key: s.key, title: s.title, impacts: s.impacts, ...(s.note !== undefined ? {note: s.note} : {})}));
  const holding = holdingOf(candidate);
  return {
    cardName,
    owner: {name: owner.name, color: owner.color, self: owner.self},
    ...(holding !== undefined ? {holding} : {}),
    ...(model.contract.payload !== undefined ? {payload: model.contract.payload} : {}),
    sections,
    ...(candidate.blocked !== undefined ? {blocked: candidate.blocked} : {}),
    selfHarm: owner.selfHarm,
  };
}

/** The real cards of the step, in its order — the viewer's browse list (a stand-in is no card). */
export function playedTargetZoomCards(model: PlayedTargetModel): ReadonlyArray<CardModel> {
  return model.owners.flatMap((o) => o.candidates.filter((c) => c.stand === undefined).map((c) => c.model));
}

/**
 * THE ONE DOOR from a target step into the viewer: the focused candidate lifts out of its own slot (the self-target
 * resolves to the hero — `playedTargetZoomOrigin`), LB/RB browse the step's cards, and every card carries its DOSSIER.
 * `getRoot` is the HOST's root (never `document`); `onBrowse` keeps the host's cursor in lockstep.
 */
export function openPlayedTargetZoom(o: {
  model: PlayedTargetModel,
  cardName: CardName,
  getRoot: () => HTMLElement | null | undefined,
  onBrowse?: (index: number) => void,
}): boolean {
  const cards = playedTargetZoomCards(o.model);
  const at = cards.findIndex((c) => c.name === o.cardName);
  if (at < 0) {
    return false;
  }
  openConsoleCardZoom(cards, at, undefined, undefined, {
    origin: playedTargetZoomOrigin(o.getRoot, (i) => cards[i]?.name ?? '', playedTargetSourceCardName(o.model.owners), o.onBrowse),
    target: (i) => {
      const name = cards[i]?.name;
      return name === undefined ? undefined : playedTargetDossierOf(o.model, name);
    },
  });
  return true;
}
