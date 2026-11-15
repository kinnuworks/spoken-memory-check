// Which design direction is being shown (?direction=a|b|c), while they are compared.
export type Dir = 'a' | 'b' | 'c'

export function direction(): Dir | null {
  if (typeof document === 'undefined') return null
  const d = document.documentElement.dataset.direction
  return d === 'a' || d === 'b' || d === 'c' ? d : null
}
