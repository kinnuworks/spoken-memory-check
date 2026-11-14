// Every screen of the app, for the accessibility audit and the live end-to-end check.
export const ROUTES = [
  '/', '/try', '/recorded', '/check', '/hearing', '/rescore', '/year',
  ...['stable', 'practice', 'decline', 'hearing', 'function', 'urgent'].map((id) => `/year/${id}`),
  '/clinician/decline', '/clinician/function', '/me/decline', '/me/urgent',
  '/benchmark', '/programme', '/how',
]
