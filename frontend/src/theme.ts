import { create } from 'zustand'

export type Theme = 'light' | 'dark'

function initial(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: initial(),
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem('th-theme', next)
    } catch { /* private mode: theme still applies for this visit */ }
    set({ theme: next })
  },
}))

/** Colours the 3D scene needs in JS (CSS variables do not reach WebGL). */
export const SCENE_COLORS: Record<Theme, { bg: string; floor: string }> = {
  // bg matches the viewport card (--surface) so the fogged floor melts into it
  dark: { bg: '#11141b', floor: '#181d27' },
  light: { bg: '#ffffff', floor: '#ebe9e1' },
}
