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
- Words outside the accepted list are reported for review and never scored.

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
- Two checks in a row well below baseline raise a flag; the first of them alone is only "lower once".
- The two checks are judged by their average: two checks 8 points down stay at "lower once" (the previous rule flagged them), while one check 15 points down and one 5 points down raise a flag.
- A missed check neither breaks nor fakes "two in a row".
- Two checks whose average sits exactly on the two-check line raise a flag; a hair above does not.
- The two-check test counts both checks, the width of each range and the baseline error they share, checked against the formula.
- With the previous rule, the first check after the baseline can never count as the second low check.
- A day reported as an off day does not count towards a flag.
- A very large fall since the last check asks for urgent assessment.
- A slow decline goes through the routine flag, never the urgent route.
- The slow-decline route raises a packet the first time the line falls far enough; the previous rule waited for a second check.
- Against the previous rule, on simulated people: more slow decline caught at a similar false-alarm rate, and sudden lasting drops of 6, 8 and 10 points caught no later.
- An improvement never raises a flag.
- A wider range from the recognisers makes the rule less sure.
- The expected practice gain is taken off later checks.
- A score equal to baseline gives a probability of one half.
- The same checks always give the same answer.

## Wrong settings the benchmark must notice
- The rule no longer asking for two checks in a row.
- A loosened threshold (the two-check cut-off, or the trend cut-off).
- A practice adjustment that is far too large.

## Hand-off
- A scored check is written as a FHIR range; an unscored one carries a reason and no value.
- A referral carries its due date.
- Ten of fourteen risk factors map to a screening field.
- Working days are counted Monday to Friday.

## Hearing check (`src/engine/din.test.ts`)
- Triplets are three different digits and never seven.
- A triplet counts only when all three digits are right and in order.
- The level goes down after a right answer and up after a wrong one, within limits.
- The threshold is the mean of the counted sets and the next level; there is no result before enough sets.
- Refer only above the provisional cut-off.
- A simulated listener with a worse threshold gets a worse result and is referred.

## Blind re-scoring (`src/engine/rescore.test.ts`)
- About one check in ten is picked, the same one every time.
- Items are split into heard by both, the person only and the machine only; agreement is both over either.
- Two empty sides count as full agreement.
- A running figure is kept per language.
