# FHIR R4 validation

The app's FHIR R4 output passes the official HL7 FHIR validator with 0 errors.

- Validator: `validator_cli.jar` 7.0.5 (Git# 17db3661806b, built 2026-11-05), from https://github.com/hapifhir/org.hl7.fhir.core/releases/tag/7.0.5. SHA-256 `9dfe9f305b0f9389eceade2a4a1c9a2740d7b0e614066fdf07a78b571c76d92f`.
- Run on: 2026-11-14, Java 17.
- FHIR version: 4.0.1 (packages `hl7.fhir.r4.core#4.0.1`, `hl7.terminology.r4#6.2.0`).
- Terminology: checked live against https://tx.fhir.org, so the SNOMED CT codes were validated too. `-tx n/a` was not used.

## How to run it

```
mkdir -p external/fhir-validator
curl -L -o external/fhir-validator/validator_cli.jar \
  https://github.com/hapifhir/org.hl7.fhir.core/releases/download/7.0.5/validator_cli.jar
npx tsx scripts/fhir-validate.ts
```

`scripts/fhir-validate.ts` builds the resources with the app's own builders in `src/engine/fhir.ts` and the synthetic personas in `src/engine/histories.ts`, writes them to a temp folder and runs:

```
java -jar external/fhir-validator/validator_cli.jar <files> -version 4.0.1
```

Pass `--no-tx` to add `-tx n/a` when offline; SNOMED codes are then not checked. The script exits non-zero if any file has an error.

## Resources checked

| File | Built from | Errors | Warnings |
|---|---|---|---|
| observation-scored.json | `checkObservation`, persona A, a scored check | 0 | 2 |
| observation-scored-parts.json | the same check with three part scores as components | 0 | 5 |
| observation-off-day.json | persona A, check on a reported bad night | 0 | 2 |
| observation-missed.json | persona A, missed check (no value) | 0 | 2 |
| observation-held-hearing.json | persona D, check held after a failed sound check | 0 | 2 |
| servicerequest-neurology.json | `referralRequest`, Neurology 394591006 | 0 | 0 |
| servicerequest-geriatrics.json | `referralRequest`, Geriatric medicine 394811001 | 0 | 0 |
| servicerequest-ent.json | `referralRequest`, Otolaryngology 418960008, urgent | 0 | 0 |
| familymemberhistory-mother.json | `familyHistory`, persona C's mother with dementia (SNOMED CT 52448006) at 74; sent only if the person agreed to share family history | 0 | 0 |
| observation-apoe.json | `apoeObservation`, persona C's APOE e4 copies from a genome programme result; sent only if the person agreed to share it | 0 | 3 |
| bundle-decline.json | `bundle` of persona C's 8 checks, family history, APOE result and a neurology referral, built as the clinician screen builds its download | 0 | 19 |
| bundle-hearing.json | `bundle` of persona D's 9 checks and an ENT referral | 0 | 18 |
| Total | 12 files (15 Nov 2026) | 0 | 53 |

The three SNOMED CT specialty codes and the dementia code are valid; tx.fhir.org raised nothing on them.

## Before and after

Before the fixes: 59 errors and 74 warnings. All 59 errors were in the two Bundles:

- Every entry lacked `fullUrl`. A collection Bundle needs one on each entry (reported twice per entry).
- Each relative reference (`subject`, `requester`) sat inside an entry with no `fullUrl`, so it could not be resolved.

Changes in `src/engine/fhir.ts`:

- `bundle()` gives every entry a `fullUrl` of `urn:uuid:<random UUID>` and sets `Bundle.timestamp`. An optional second argument supplies the ids, so output can be made repeatable. Existing calls are unchanged.
- Each Observation and ServiceRequest carries a generated XHTML narrative (`text`), which clears the dom-6 warning on every resource.
- Score ranges use UCUM units: `unit: "points"`, `system: "http://unitsofmeasure.org"`, `code: "1"`. Part-score components now have units too. The annotation `{score}` was tried first; the validator warns on annotations because unit comparison ignores them.
- A check held for hearing now says so in `dataAbsentReason.text` instead of reading as missed. Codings carry their display text.

The `referralRequest(patientRef, practitionerRef, authoredOn, dueBy, specialty, priority)` signature is unchanged, so `src/pages/Clinician.tsx` needs no edit. Unit tests for these shapes are in `src/engine/fhir.test.ts`.

## Warnings left, and why

There are 53 warnings, nearly all of two kinds:

1. "A definition for CodeSystem 'urn:spoken-memory-check:codes' could not be found" (25: one per Observation code, plus 3 components). No LOINC or SNOMED CT code exists for this spoken check's total or part scores, so they use a local code system, as FHIR allows. The validator cannot look up a local system it has never seen. Publishing a CodeSystem resource for it, or getting a LOINC code, would clear this.
2. "In general, all observations should have a performer" (22: one per Observation). This is a best-practice note. The person takes the check alone at home and software scores it; no clinician vouches for the value. Naming the person or a practitioner as performer would claim something that did not happen, so the field is left empty. A deployment that registers the scoring software as a Device could reference it here.

Nothing else is reported. Inside the Bundles, references to `Patient/synthetic-*` and `Practitioner/ordering` point to resources held by the receiving system and produce no warning.
