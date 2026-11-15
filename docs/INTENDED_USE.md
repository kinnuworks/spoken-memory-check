# Intended use

## Statement

The spoken memory check is software that an adult uses at home, by voice, to take a short memory check between clinic visits. It compares each result with that person's own earlier results. When scores stay below the person's usual range on two checks in a row, or when the person reports that everyday tasks have become harder, it prepares a packet for the ordering physician. The physician decides what happens next. The software does not diagnose any condition.

## Users

- The person checked: an adult member of Abu Dhabi's adult screening programme, IFHAS, aged 50 to 64, between three-yearly clinic memory tests. IFHAS 3.0 bills "comprehensive hearing and dementia screening" every three years at 50 to 64 (code 52-45) and every year at 65 to 75 (code 52-46) ([DoH Addendum 06](https://www.doh.gov.ae/-/media/Feature/shafifya/Prices/Adjudication-Rules/Addendum-06-to-DOH-Claims-Adjudication-Rules-v20251IFHAS-30-Update.ashx)). People aged 65 to 75 already have a yearly clinic test and are not in the first pilot (`docs/PILOT.md`).
- The ordering physician at the screening provider, who reads the packet and approves, edits or dismisses it.
- Programme staff at the public health centre, who see counts by facility and re-score a sample of checks blind.

## Setting

At home, on the person's own phone or laptop, in a browser with a microphone (Chrome, Edge or Safari). The person enrols and consents at their screening visit. Results that need action are given in person at a clinic visit, never in the app.

Languages: English and Gulf Arabic. The Arabic word lists and prompts are drafts that no native Gulf Arabic speaker has reviewed yet, and the app says so.

## What it does

- A sound check, then ten words said back, one minute naming animals, counting backwards, the ten words again, and one question about everyday tasks. About four minutes.
- A digits-in-noise hearing check, answered by tapping, run before the memory check. A fail is a suggested audiology referral.
- Scores each task as a range from two listeners, then applies a fixed rule against the person's own baseline (`src/engine/change.ts`). No language model is used anywhere.
- Prepares a physician's packet: the trajectory, treatable contributors to check first, and risk factors already in the screening record. After approval it sends only an invitation to a visit.

## What it does not do

- It does not diagnose dementia, mild cognitive impairment or any other condition. It reports a change from the person's own earlier scores.
- It is not for people with a known diagnosis of dementia or mild cognitive impairment.
- It cannot detect impairment that was already present when the person enrolled, because the baseline would already be low. The clinic memory test at the screening visit covers that.
- It does not replace the clinic memory test or the clinic audiogram.
- It is not a monitoring or emergency tool. A sudden change such as a stroke or delirium may be found days late, at the next scheduled check.
- It does not give the person a result at home. In the patient version the person sees "Check received" and their trend. The demo shows scores to testers, labelled as such.

## Contraindications and limits

- Hearing loss that is not corrected: the check is spoken, so a failed sound check holds the check instead of scoring it, and the hearing check comes first.
- Speech or language disorders, such as aphasia or a stammer, can lower scores for reasons other than memory. ASSUMPTION: these people should not use the check; this has not been studied.
- Not fluent in English or Arabic: only those two languages exist.
- Cannot do the check alone: someone in the room can prompt the person, and the check cannot tell.
- Acute illness or a bad night: the person can mark an off day, and that check does not count towards a flag.
- Not validated in patients anywhere. Recognition has not been measured on older adults doing this check or on Emirati speakers; a public-data comparison of older and adult Gulf speakers is in `docs/OLDER_SPEAKERS_BENCH.md`. The measurement error in the rule comes from published studies of similar tasks, not from this check (`docs/LIMITS.md`).
- The hearing check's refer cut-off is a provisional setting, not validated (`src/engine/din.ts`).
- Risk fields in the packet exist only for programme members who attended a screening visit.

## Likely device classification

ASSUMPTION. Since 2 January 2025 the Emirates Drug Establishment (EDE) regulates medical devices under Decree-Law 38/2024, and only EDE decides whether software is a device ([RegDesk](https://www.regdesk.co/blog/uae-medical-device-regulatory-update-transfer-of-services-from-mohap-to-ede)). We expect EDE to treat a cognitive screening aid that raises a referral flag as software as a medical device, probably in a middle risk class; sources disagree on whether EDE uses classes I to IV or A to D, so the class is unconfirmed until EDE's own product-classification service rules on it. The nearest precedent is the US FDA's "computerized cognitive assessment aid", 21 CFR 882.1470, Class II (Cognivue De Novo, 2015; [product code PKQ](https://fda.innolitics.com/productcode/PKQ)). The pilot runs as research under ethics approval, and we would ask EDE for a classification letter before any use outside research.
