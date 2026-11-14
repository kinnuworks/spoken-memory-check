// Yearly running cost for one screening provider, from docs/COMMERCIAL.md. Every input is
// listed with its basis there; most are assumptions until a pilot measures them.

export const AED_PER_USD = 3.6725

export interface CostInputs {
  /** Members aged 50 and over that the provider screens. */
  eligible: number
  /** Share who take part. ASSUMPTION. */
  uptake: number
  /** Checks per active member per year. ASSUMPTION. */
  checksPerYear: number
  /** Audio minutes sent to a UAE cloud listener per check (a ceiling; the on-device listener sends none). */
  cloudMinutesPerCheck: number
  /** Azure speech to text, UAE North, US$ per audio hour (S1). */
  speechUsdPerHour: number
  /** Hosting in a UAE region, US$ a year (two app servers, a database, storage). */
  hostingUsdYear: number
  /** Share of active members with a packet for physician review in a year. */
  packetRate: number
  physicianMinutesPerPacket: number
  physicianAedPerHour: number
  /** Care coordinator, AED a year. */
  coordinatorAedYear: number
  /** Software upkeep, support, security and compliance, AED a year. */
  upkeepAedYear: number
}

export const COST_DEFAULTS: CostInputs = {
  eligible: 10000,
  uptake: 0.4,
  checksPerYear: 4,
  cloudMinutesPerCheck: 5,
  speechUsdPerHour: 1,
  hostingUsdYear: 0.191 * 2 * 8760 + 0.217 * 8760 + 600,
  packetRate: 0.08,
  physicianMinutesPerPacket: 10,
  physicianAedPerHour: 450,
  coordinatorAedYear: 0.25 * 240000,
  upkeepAedYear: 150000,
}

export interface CostResult {
  users: number
  checks: number
  packets: number
  physicianHours: number
  lines: { name: string; aed: number }[]
  totalAed: number
  perEligibleAed: number
  perUserAed: number
  perCheckAed: number
}

export function yearlyCost(i: CostInputs = COST_DEFAULTS): CostResult {
  const users = Math.round(i.eligible * i.uptake)
  const checks = users * i.checksPerYear
  const packets = Math.round(users * i.packetRate)
  const physicianHours = (packets * i.physicianMinutesPerPacket) / 60
  const lines = [
    { name: 'Cloud speech in a UAE region', aed: ((checks * i.cloudMinutesPerCheck) / 60) * i.speechUsdPerHour * AED_PER_USD },
    { name: 'Hosting in a UAE region', aed: i.hostingUsdYear * AED_PER_USD },
    { name: 'Physician packet review', aed: physicianHours * i.physicianAedPerHour },
    { name: 'Care coordinator', aed: i.coordinatorAedYear },
    { name: 'Upkeep, support, security, compliance', aed: i.upkeepAedYear },
  ]
  const totalAed = lines.reduce((a, l) => a + l.aed, 0)
  return {
    users, checks, packets, physicianHours, lines, totalAed,
    perEligibleAed: totalAed / i.eligible,
    perUserAed: users ? totalAed / users : 0,
    perCheckAed: checks ? totalAed / checks : 0,
  }
}
