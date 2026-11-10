# Cases tested

Run them with `npm test`. Each line is one automated test.

## Hearing the words
- An animal said several times counts once.
- Different names for one animal count once (camel, dromedary; in Arabic: جمل, ناقة, بعير).
- "Polar bear" counts as a polar bear, not also as a bear.
- Words that are not animals are ignored.
- Plurals and punctuation do not change the count.
- Arabic with or without the article, vowel marks or hamza forms matches the same word.
- Silence scores zero and is not an error.
- No word in a recall list is also an animal name.
- No animal name appears under two different animals.

## Scoring as a range
- Two recognisers that agree give a single number.
- A word heard by one recogniser widens the range and is marked.
- Too much disagreement means the session is not scored.
- A word neither recogniser heard is never added.

## The rule
- Nothing is judged before three scored checks.
- The baseline is the mean of the first three scored checks, skipping missed ones.
- A stable person stays in the usual range.
- One low check does not raise a flag.
- Two low checks in a row raise a flag.
- A missed check neither breaks nor fakes "two in a row".
- A day reported as an off day does not count towards a flag.
- A very large fall since the last check asks for urgent assessment.
- A slow decline goes through the routine flag, never the urgent route.
- An improvement never raises a flag.
- A wider range from the recognisers makes the rule less sure.
- The expected practice gain is taken off later checks.
- A score equal to baseline gives a probability of one half.
- The same checks always give the same answer.

## Wrong settings the benchmark must notice
- The rule no longer asking for two checks in a row.
- A loosened threshold.
- A practice adjustment that is far too large.

## Hand-off
- A scored check is written as a FHIR range; an unscored one carries a reason and no value.
- A referral carries its due date.
- Ten of fourteen risk factors map to a screening field.
- Working days are counted Monday to Friday.
