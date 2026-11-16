# How animal naming is scored

One written rule, applied the same way by the code and by a human listener.

- Each animal counts once, however many times it is said.
- Different names for the same animal count once (camel and dromedary; جمل and بعير).
- Male, female and young of one animal count once (horse, mare, foal; جمل, ناقة, حوار).
- A category word counts, and so do its members (bird, then falcon and pigeon, is three).
- Birds, fish, reptiles and insects count.
- Words that are not animals, and animals that do not exist, do not count.
- The category is always animals. Published phone retest work found reliability fell sharply when the category changed between sessions.

Why the third point: the main clinical conventions disagree. The US dementia research centres' manual credits male, female and infant names separately; the Addenbrooke's examination scores them once. Gulf Arabic has many words for one animal by age and sex, above all for camels, so crediting each would raise scores for speakers who know them. Counting them once avoids that. No published guidance covers this case, and a native reviewer has not yet checked our accepted names.

Words the recognisers hear that are not on the accepted list are never scored. They are kept so the list can be reviewed and extended, because no published list exists of the animals Arabic speakers name most.

# How a change is judged

The code is `src/engine/change.ts`. It is deterministic: the same checks always give the same answer.

**Baseline.** The mean of the first three scored checks. Missed and held checks are skipped, never scored as zero.

**Route 1, a drop.** Each later check is compared with the baseline after taking off the expected practice gain:

- change = score − baseline − (expected practice at this check − mean expected practice over the baseline checks)
- error = √( sem² × (1 + 1/3) + range² / 12 ), with sem 4.0 points
- z = change ÷ error

A check with z ≤ −1.645 is low and shown as `watch`; one low check is never sent on by itself.

**Route 1, a lasting drop.** At each scored check after the first post-baseline one, the change of this check and of the previous scored check (off days left out) are averaged and set against their joint error:

- pair z = ((change now + change before) ÷ 2) ÷ √( sem² ÷ 2 + (range now² + range before²) ÷ 48 + sem² ÷ 3 )

The last term is the baseline's own error, which both checks share. If pair z ≤ −2.6, a packet is raised (`flag`, shown as "Lower across two checks"). Before this version the route asked instead for each of the two checks to have z ≤ −1.645. Averaging uses how far each check fell: two checks 8 points down no longer raise a packet on their own (together they are within what error explains), while one check 15 points down followed by one 5 points down now does.

**Route 2, slow decline.** At each scored check from the eighth on (baseline included, off days left out), a straight line is fitted by least squares through every scored check so far: the practice-adjusted score against the check's place in the schedule. The slope's error comes from the known variation of one check (sem² plus range² / 12 for each point), not from the scatter around the line. If slope ÷ error ≤ −2.1, a packet is raised (`trend`, shown as "Slowly falling"). Before this version the cut-off was −1.9 and had to hold on two scored checks in a row. The packet says: the practice-adjusted score has fallen steadily across all scored checks, by more than measurement error explains, though no single check fell far enough to be flagged.

The cut-offs (pair z −2.6; slope −2.1 from the eighth check, on one check) were fixed on simulated people from one seed (1, 20,000 per group) and then reported on another (20261110). Among the settings that kept false alarms in stable people at or under 5% a year in the as-assumed world (4.9% on the tuning seed) and caught sudden lasting drops of 6, 8 and 10 points no later than the rule they replaced, they caught the most people losing one point a check. On the report seed false alarms came out at 5.2% a year; that is reported as it is, not tuned away. The search script and its output are described in `src/engine/change.ts` (`basis`).

**Other routes.** A fall of 3.5 errors or more since the previous scored check goes to urgent assessment (`urgent`). A reported change in everyday tasks goes to the physician whatever the scores say (`review`). A failed sound check holds the check. Off days are kept and shown but count towards neither route.

**Order.** Urgent, then flag, then trend, then review.
