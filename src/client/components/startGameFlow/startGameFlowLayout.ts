/*
 * Pure client-side layout budget for StartGameFlowOverlay.
 *
 * The overlay changes state several times during setup: prelude cards resolve,
 * Merger can add corporation cards, draw/copy prelude prompts can add another
 * card row, then waiting and the final CTA appear. This helper centralizes the
 * reserved window size so new cases can be added without rewriting the Vue
 * layout or CSS.
 */

export type StartGameFlowLayoutInput = {
  preludeCount: number;
  corporationCount: number;
  mergerReserveActive: boolean;
  extraCardReserveActive: boolean;
  corporationSelectCount: number;
  drawCandidateCount: number;
  resolvedDrawCounts: ReadonlyArray<number>;
  copyCandidateCount: number;
  waiting: boolean;
  allDone: boolean;
  viewportWidth: number;
  viewportHeight: number;
};

export type StartGameFlowLayoutBudget = {
  preludeZoom: number;
  corporationZoom: number;
  gridGapX: number;
  gridGapY: number;
  windowWidth: number;
  windowMinHeight: number;
  bodyMinHeight: number;
  headerStatusWidth: number;
  headerStatusHeight: number;
  mainGapX: number;
  mainGapY: number;
  corporationColumnWidth: number;
  preludeColumnWidth: number;
  modalOffsetY: number;
};

const CARD_NATURAL_W = 300;
const CARD_NATURAL_H = 420;
const CARD_CHROME_H = 58; // status/action area under the card
const SECTION_LABEL_H = 24;
const SECTION_GAP_H = 18;
const HEADER_H = 122;
const FRAME_V = 78;
const HEADER_STATUS_W = 330;
const HEADER_STATUS_H = 58;

function columnsFor(count: number): number {
  if (count <= 0) {
    return 0;
  }
  if (count <= 2) {
    return count;
  }
  if (count <= 4) {
    return count;
  }
  if (count <= 6) {
    return 3;
  }
  return 4;
}

function rowsFor(count: number): number {
  const cols = columnsFor(count);
  return cols === 0 ? 0 : Math.ceil(count / cols);
}

function sectionHeight(count: number, zoom: number, gapY: number): number {
  const rows = rowsFor(count);
  if (rows === 0) {
    return 0;
  }
  const cardColumnH = CARD_NATURAL_H * zoom + CARD_CHROME_H;
  return SECTION_LABEL_H + rows * cardColumnH + Math.max(0, rows - 1) * gapY;
}

function sectionWidth(count: number, zoom: number, gapX: number): number {
  const cols = columnsFor(count);
  if (cols === 0) {
    return 0;
  }
  return cols * CARD_NATURAL_W * zoom + Math.max(0, cols - 1) * gapX;
}

export function startGameFlowLayoutBudget(input: StartGameFlowLayoutInput): StartGameFlowLayoutBudget {
  const resolvedDrawMax = input.resolvedDrawCounts.reduce((max, count) => Math.max(max, count), 0);
  const corporationReserveCount = input.mergerReserveActive ? Math.max(2, input.corporationCount) : input.corporationCount;
  let maxCardGrid = Math.max(input.preludeCount, corporationReserveCount);
  let extraSectionCount = 0;

  // Merger: the live corp-selection prompt adds a temporary bottom grid.
  if (input.corporationSelectCount > 0) {
    maxCardGrid = Math.max(maxCardGrid, input.corporationSelectCount);
    extraSectionCount++;
  }

  // New Partner / Valley Trust: drew-N-choose-one needs a bottom row.
  if (input.drawCandidateCount > 0) {
    maxCardGrid = Math.max(maxCardGrid, input.drawCandidateCount);
    extraSectionCount++;
  }

  // Resolved draw choices remain visible as played/discarded cards.
  if (resolvedDrawMax > 0) {
    maxCardGrid = Math.max(maxCardGrid, resolvedDrawMax);
    extraSectionCount += input.resolvedDrawCounts.length;
  }

  // Double Down and similar copy-prompt cards: another bottom row.
  if (input.copyCandidateCount > 0) {
    maxCardGrid = Math.max(maxCardGrid, input.copyCandidateCount);
    extraSectionCount++;
  }

  let preludeZoom = 0.64;
  if (maxCardGrid >= 9) {
    preludeZoom = 0.46;
  } else if (maxCardGrid >= 7) {
    preludeZoom = 0.50;
  } else if (maxCardGrid >= 5) {
    preludeZoom = 0.54;
  } else if (maxCardGrid <= 2) {
    preludeZoom = 0.68;
  }

  let corporationZoom = corporationReserveCount > 1 ? 0.60 : 0.70;
  if (extraSectionCount >= 1) {
    preludeZoom = Math.max(0.44, preludeZoom - 0.04);
    corporationZoom = Math.max(0.56, corporationZoom - 0.04);
  }

  const compactViewport = input.viewportHeight > 0 && input.viewportHeight < 820;
  if (compactViewport) {
    preludeZoom = Math.max(0.42, preludeZoom - 0.04);
    corporationZoom = Math.max(0.52, corporationZoom - 0.04);
  }

  const gridGapX = maxCardGrid >= 7 ? 16 : 24;
  const gridGapY = maxCardGrid >= 7 || compactViewport ? 10 : 16;
  const mainGapX = 42;
  const mainGapY = 18;

  const corporationH = sectionHeight(corporationReserveCount, corporationZoom, gridGapY);
  const preludeH = sectionHeight(input.preludeCount, preludeZoom, gridGapY);
  const mainRowH = Math.max(corporationH, preludeH);
  const extraSections = [
    sectionHeight(input.corporationSelectCount, preludeZoom, gridGapY),
    sectionHeight(input.drawCandidateCount, preludeZoom, gridGapY),
    ...input.resolvedDrawCounts.map((count) => sectionHeight(count, preludeZoom, gridGapY)),
    sectionHeight(input.copyCandidateCount, preludeZoom, gridGapY),
  ].filter((height) => height > 0);
  const extraH =
    extraSections.reduce((sum, height) => sum + height, 0) +
    Math.max(0, extraSections.length - 1) * SECTION_GAP_H;
  const hasExtraCards = extraSections.length > 0;
  const needsExtraCardReserve = hasExtraCards || input.mergerReserveActive || input.extraCardReserveActive;
  const bodyMinHeight = mainRowH + (extraH > 0 ? mainGapY + extraH : 0);
  const corporationColumnWidth = Math.max(sectionWidth(corporationReserveCount, corporationZoom, gridGapX), 260);
  const preludeColumnWidth = Math.max(sectionWidth(input.preludeCount, preludeZoom, gridGapX) + 32, 380);
  const mainRowWidth =
    (corporationColumnWidth > 0 && preludeColumnWidth > 0) ?
      corporationColumnWidth + mainGapX + preludeColumnWidth :
      Math.max(corporationColumnWidth, preludeColumnWidth);

  const gridWidth = Math.max(
    mainRowWidth,
    sectionWidth(input.corporationSelectCount, preludeZoom, gridGapX),
    sectionWidth(input.drawCandidateCount, preludeZoom, gridGapX),
    sectionWidth(resolvedDrawMax, preludeZoom, gridGapX),
    sectionWidth(input.copyCandidateCount, preludeZoom, gridGapX),
    input.waiting || input.allDone ? HEADER_STATUS_W : 0,
  );

  const viewportW = input.viewportWidth || 1280;
  const viewportH = input.viewportHeight || 860;
  const windowWidth = Math.min(
    Math.max(720, Math.ceil(gridWidth + 96)),
    Math.max(680, viewportW - 72),
    1240,
  );
  const naturalWindowH = Math.ceil(FRAME_V + HEADER_H + bodyMinHeight);
  const windowMinHeight = Math.max(340, Math.min(
    naturalWindowH,
    Math.max(560, viewportH - 72),
  ));

  return {
    preludeZoom,
    corporationZoom,
    gridGapX,
    gridGapY,
    windowWidth,
    windowMinHeight,
    bodyMinHeight: Math.ceil(bodyMinHeight),
    headerStatusWidth: HEADER_STATUS_W,
    headerStatusHeight: HEADER_STATUS_H,
    mainGapX,
    mainGapY,
    corporationColumnWidth: Math.ceil(corporationColumnWidth),
    preludeColumnWidth: Math.ceil(preludeColumnWidth),
    modalOffsetY: needsExtraCardReserve ? -34 : 0,
  };
}
