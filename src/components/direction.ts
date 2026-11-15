// Which design direction is being shown (?direction=a|b|c|d), while they are compared.
export type Dir = 'a' | 'b' | 'c' | 'd'

export function direction(): Dir | null {
  if (typeof document === 'undefined') return null
  const d = document.documentElement.dataset.direction
  return d === 'a' || d === 'b' || d === 'c' || d === 'd' ? d : null
}
