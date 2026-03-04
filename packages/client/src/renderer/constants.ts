export const HEX_SIZE = 32; // pixels from center to corner (flat-top)
export const GRID_WIDTH = 16;
export const GRID_HEIGHT = 12;

export const TERRAIN_COLORS: Record<string, string> = {
  plains: '#5a9a50',
  forest: '#2d6030',
  mountain: '#7a7a7a',
  city: '#a09070',
};

export const TERRAIN_BORDER_COLORS: Record<string, string> = {
  plains: '#4a8840',
  forest: '#204a24',
  mountain: '#606060',
  city: '#887860',
};

export const GRID_LINE_COLOR = '#2a2a3e';
export const FOG_COLOR = 'rgba(0, 0, 0, 0.6)';

export const PLAYER_COLORS = {
  player1: { fill: '#4488cc', stroke: '#2266aa', light: '#66aaee' },
  player2: { fill: '#cc4444', stroke: '#aa2222', light: '#ee6666' },
} as const;

export const UNIT_LABELS: Record<string, string> = {
  infantry: 'I',
  tank: 'T',
  artillery: 'A',
  recon: 'R',
};
