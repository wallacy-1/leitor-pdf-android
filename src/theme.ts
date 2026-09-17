import { useColorScheme } from 'react-native';

/**
 * Tokens do design system "Organic" (paleta quente, pílulas, Caprasimo + Figtree).
 * O tema escuro é derivado: mesmos acentos, rampa neutra invertida.
 */
export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  text: string;
  divider: string;
  accent: string;
  accent2: string;
  neutral: Ramp;
  accentRamp: Ramp;
  accent2Ramp: Ramp;
  /** Fundo atrás das páginas do leitor. */
  readerBg: string;
  /** Cor de texto sobre o accent (botão primário). */
  onAccent: string;
  shadow: string;
};

type Ramp = {
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const fonts = {
  heading: 'Caprasimo-Regular',
  body: 'Figtree-Regular',
  bodySemi: 'Figtree-SemiBold',
  bodyBold: 'Figtree-Bold',
};

export const radius = { sm: 8, md: 16, lg: 28, pill: 999 };

const accentRamp: Ramp = {
  100: '#fff2eb',
  200: '#ffe1d0',
  300: '#ffc6a5',
  400: '#f6a06b',
  500: '#d67f48',
  600: '#b2622d',
  700: '#8c491a',
  800: '#643312',
  900: '#402310',
};

const accent2Ramp: Ramp = {
  100: '#f0fae1',
  200: '#e1eecc',
  300: '#ccdbb2',
  400: '#aebf92',
  500: '#8fa073',
  600: '#728157',
  700: '#56633f',
  800: '#3d472b',
  900: '#272e1b',
};

const light: Theme = {
  dark: false,
  bg: '#f5ead8',
  surface: '#ebddc5',
  text: '#201e1d',
  divider: 'rgba(32,30,29,0.16)',
  accent: '#c67139',
  accent2: '#7a8a5e',
  neutral: {
    100: '#f9f4ed',
    200: '#eee7db',
    300: '#dcd3c4',
    400: '#c0b6a5',
    500: '#a19786',
    600: '#82796a',
    700: '#645c50',
    800: '#474238',
    900: '#2e2b25',
  },
  accentRamp,
  accent2Ramp,
  readerBg: '#c0b6a5',
  onAccent: '#f5ead8',
  shadow: '#2e2b25',
};

const dark: Theme = {
  dark: true,
  bg: '#1c1a17',
  surface: '#2a2722',
  text: '#f5ead8',
  divider: 'rgba(245,234,216,0.16)',
  accent: '#d67f48',
  accent2: '#8fa073',
  neutral: {
    100: '#26231f',
    200: '#2e2b25',
    300: '#3b3730',
    400: '#4d483f',
    500: '#6b6456',
    600: '#8f8676',
    700: '#b3a998',
    800: '#d5cbb9',
    900: '#f0e6d4',
  },
  accentRamp: {
    100: '#3a2416',
    200: '#4d2e19',
    300: '#643312',
    400: '#8c491a',
    500: '#b2622d',
    600: '#d67f48',
    700: '#f6a06b',
    800: '#ffc6a5',
    900: '#ffe1d0',
  },
  accent2Ramp: {
    100: '#232a18',
    200: '#2d3620',
    300: '#3d472b',
    400: '#56633f',
    500: '#728157',
    600: '#8fa073',
    700: '#aebf92',
    800: '#ccdbb2',
    900: '#e1eecc',
  },
  readerBg: '#141311',
  onAccent: '#1c1a17',
  shadow: '#000000',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
