// Accent presets + font choices exposed in Settings (color & font only).

export type AccentPreset = 'default' | 'cyan' | 'purple' | 'blue' | 'orange' | 'gray';

export interface Accent {
  id: AccentPreset;
  label: string;
  main: string;
  light: string;
  dark: string;
  ink: string; // contrast text on the accent
}

export const ACCENTS: Accent[] = [
  { id: 'default', label: 'Green', main: '#00A76F', light: '#2CCF8E', dark: '#087055', ink: '#06251A' },
  { id: 'cyan', label: 'Cyan', main: '#078DEE', light: '#68CDF9', dark: '#0351AB', ink: '#FFFFFF' },
  { id: 'purple', label: 'Purple', main: '#7635DC', light: '#B985F4', dark: '#431A9E', ink: '#FFFFFF' },
  { id: 'blue', label: 'Blue', main: '#2065D1', light: '#76B0F1', dark: '#103996', ink: '#FFFFFF' },
  { id: 'orange', label: 'Orange', main: '#FDA92D', light: '#FED680', dark: '#B66816', ink: '#212B36' },
  { id: 'gray', label: 'Gray', main: '#A4AAB3', light: '#CED1D7', dark: '#63686C', ink: '#FFFFFF' },
];

export const accentByMain = (main: string): Accent | undefined => ACCENTS.find((a) => a.main.toLowerCase() === main.toLowerCase());

export const FONT_FALLBACK = "-apple-system, 'Segoe UI', system-ui, sans-serif";

export interface FontChoice {
  id: string; // stored in settings.ui.fontFamily
  label: string;
  stack: string; // resolved CSS font-family value
}

export const FONTS: FontChoice[] = [
  { id: 'Inter Tight', label: 'Inter Tight', stack: `'Inter Tight', ${FONT_FALLBACK}` },
  { id: 'Public Sans', label: 'Public Sans', stack: `'Public Sans', ${FONT_FALLBACK}` },
  { id: 'system-ui', label: 'System UI', stack: `system-ui, ${FONT_FALLBACK}` },
  { id: 'Georgia', label: 'Georgia (serif)', stack: `Georgia, 'Times New Roman', serif` },
];

export const fontStack = (id: string): string => FONTS.find((f) => f.id === id)?.stack ?? `'${id}', ${FONT_FALLBACK}`;
