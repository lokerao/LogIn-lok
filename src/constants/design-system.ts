export const colors = {
  ink: '#172235', muted: '#627087', canvas: '#F6F8FC', primary: '#2F5BEA', primaryPressed: '#2447BD', accent: '#DFF7E9', success: '#18794E', white: '#FFFFFF',
} as const;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 10, md: 16, pill: 999 } as const;
export const typography = {
  eyebrow: { fontSize: 13, fontWeight: '700' as const, letterSpacing: 1.2 },
  title: { fontSize: 38, fontWeight: '700' as const, letterSpacing: -1 },
  subtitle: { fontSize: 17, fontWeight: '400' as const, lineHeight: 25 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  button: { fontSize: 16, fontWeight: '700' as const },
} as const;
