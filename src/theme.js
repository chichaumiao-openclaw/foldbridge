const COMMON = {
  light: {
    surface: '#FFFFFF',
    surfaceAlt: '#EEF3EE',
    background: '#F4F7F2',
    backgroundStrong: '#E8EFE8',
    textPrimary: '#14221C',
    textSecondary: '#5D6C64',
    textMuted: '#7B8A82',
    onPrimary: '#F4F7F2',
    shadow: '0 18px 50px rgba(20, 34, 28, 0.08)',
    shadowSoft: '0 10px 28px rgba(20, 34, 28, 0.06)',
    radiusCard: '22px',
    radiusPanel: '16px'
  },
  dark: {
    surface: '#111a17',
    surfaceAlt: '#182320',
    background: '#08110e',
    backgroundStrong: '#0d1714',
    textPrimary: '#edf4ef',
    textSecondary: '#b8c8bf',
    textMuted: '#8ea196',
    onPrimary: '#08110e',
    shadow: '0 18px 50px rgba(0, 0, 0, 0.34)',
    shadowSoft: '0 10px 28px rgba(0, 0, 0, 0.28)',
    radiusCard: '22px',
    radiusPanel: '16px'
  }
};

export const themeTokens = {
  blue: {
    label: 'Scientific Green',
    light: {
      primary: '#174B3A',
      primaryHover: '#123B2E',
      primarySoft: '#E4EFE8',
      accent: '#2F8F6B',
      accentSoft: '#C7E36B',
      border: '#D6E0D8'
    },
    dark: {
      primary: '#7dd4aa',
      primaryHover: '#99e0bd',
      primarySoft: 'rgba(125, 212, 170, 0.14)',
      accent: '#63cfa0',
      accentSoft: '#d9e99d',
      border: '#2c3a34'
    },
  },
  ribocentre: {
    label: 'RiboCentre Teal',
    light: {
      primary: '#0F766E',
      primaryHover: '#115E59',
      primarySoft: '#F0FDFA',
      accent: '#0D9488',
      accentSoft: '#99F6E4',
      border: '#CCFBF1'
    },
    dark: {
      primary: '#2DD4BF',
      primaryHover: '#5EEAD4',
      primarySoft: 'rgba(45, 212, 191, 0.14)',
      accent: '#14B8A6',
      accentSoft: '#99F6E4',
      border: '#115E59'
    }
  },
  riboswitch: {
    label: 'Riboswitch Purple',
    light: {
      primary: '#6D28D9',
      primaryHover: '#5B21B6',
      primarySoft: '#F5F3FF',
      accent: '#7C3AED',
      accentSoft: '#DDD6FE',
      border: '#EDE9FE'
    },
    dark: {
      primary: '#A78BFA',
      primaryHover: '#C4B5FD',
      primarySoft: 'rgba(167, 139, 250, 0.14)',
      accent: '#8B5CF6',
      accentSoft: '#DDD6FE',
      border: '#4C1D95'
    }
  },
  aptamer: {
    label: 'Aptamer Amber',
    light: {
      primary: '#B45309',
      primaryHover: '#92400E',
      primarySoft: '#FFFBEB',
      accent: '#D97706',
      accentSoft: '#FDE68A',
      border: '#FEF3C7'
    },
    dark: {
      primary: '#FBBF24',
      primaryHover: '#FCD34D',
      primarySoft: 'rgba(251, 191, 36, 0.14)',
      accent: '#F59E0B',
      accentSoft: '#FDE68A',
      border: '#78350F'
    }
  }
};

export function cssVarsFor(themeKey, mode = 'light') {
  const theme = themeTokens[themeKey] ?? themeTokens.blue;
  const safeMode = mode === 'dark' ? 'dark' : 'light';
  const merged = { ...COMMON[safeMode], ...theme[safeMode] };
  const entries = Object.entries(merged).map(([k, v]) => `--${k}: ${v};`);
  entries.push(`--mode: ${safeMode};`);
  return entries.join('\n');
}
