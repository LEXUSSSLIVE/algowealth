// AlgoWealth design tokens — colors sampled from the design mockups.
export const colors = {
  primary: '#2C67FF',
  primaryPressed: '#2257E0',
  logoBlue: '#0072CE',
  logoBlack: '#000000',
  headerLight: '#8CACF5',
  textDark: '#323232',
  textGray: '#787878',
  green: '#25A64E',
  red: '#EB3945',
  bg: '#FFFFFF',
  fieldBorder: '#E2E8F0',
  fieldIcon: '#808DA1',
  segmentBg: '#F3F3F3',
  tabInactive: '#898989',
  overlay: 'rgba(0,0,0,0.4)',
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const radius = {
  card: 20,
  field: 26,
  button: 28,
  sheet: 24,
} as const;

export const spacing = (n: number) => n * 4;
