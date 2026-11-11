// Inline icons in a 24px grid, 1.75 stroke, round caps.
type P = { className?: string }
const S = ({ children, className }: P & { children: React.ReactNode }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)
export const Mic = (p: P) => <S {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>
export const Play = (p: P) => <S {...p}><path d="M7 5l12 7-12 7z" /></S>
export const Stethoscope = (p: P) => <S {...p}><path d="M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2" /><circle cx="21" cy="12" r="0.01" /><circle cx="21" cy="11" r="2" /></S>
export const Ear = (p: P) => <S {...p}><path d="M6 8.5a6 6 0 1 1 12 0c0 3.5-3 4.5-3 7a3 3 0 0 1-6 0" /><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3" /></S>
export const Moon = (p: P) => <S {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></S>
export const List = (p: P) => <S {...p}><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" /></S>
export const Alert = (p: P) => <S {...p}><path d="M12 3l9.5 16.5h-19z" /><path d="M12 10v4M12 17.5v.01" /></S>
export const EyeOff = (p: P) => <S {...p}><path d="M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3 3.6M6.6 6.6A17 17 0 0 0 2.5 12S6 18 12 18a9.6 9.6 0 0 0 4.4-1.1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></S>
export const Code = (p: P) => <S {...p}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" /></S>
export const Check = (p: P) => <S {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></S>
export const Arrow = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>
export const Clock = (p: P) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>
export const Waves = (p: P) => <S {...p}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 11v2" /></S>
