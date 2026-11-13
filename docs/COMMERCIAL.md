# Commercial case

Figures were researched on 14 Nov 2026. Anything without a source is marked ASSUMPTION. US dollars are converted at the 3.6725 AED peg.

## Who pays: the IFHAS screening package

IFHAS 3.0 took effect on 1 September 2026. Its claims addendum lists two packages named "Comprehensive hearing and dementia screening", billed under encounter type 7, "Nationals Screening" ([DoH Addendum 06, V2025.1](https://www.doh.gov.ae/-/media/Feature/shafifya/Prices/Adjudication-Rules/Addendum-06-to-DOH-Claims-Adjudication-Rules-v20251IFHAS-30-Update.ashx)):

- 52-45: ages 50 to 64, every three years. It bundles 99211 and 92551 (screening audiometry).
- 52-46: ages 65 to 75, every year, with the same contents.

The addendum names no cognitive tool and gives no price. The prices sit in the Mandatory Tariff behind a Shafafiya login, which we have not seen. The IFHAS standard itself names the MoCA as the dementia screen ([DoH IFHAS standard](https://www.doh.gov.ae/-/media/EE758C3B77314BC394F2479AEF803AA2.ashx)). IFHAS covers Thiqa (national) members aged 18 and over and runs at more than 150 facilities ([WAM](https://wam.ae/en/article/b1ryawb-more-than-150-healthcare-facilities-across-abu)).

Physician review of a packet could also be billed as a remote service. DoH's telemedicine addendum lists telephone E/M 99441 to 99443, remote data review 99091 and interprofessional e-consults 99446 to 99448 ([Addendum 30](https://www.doh.gov.ae/-/media/Feature/shafifya/Prices/Adjudication-Rules/addendum-29-non-emergency-ambulance-transfers/addendum-30-to-doh-claims-adjudication-rules-telemedicine-services.ashx)). ASSUMPTION: packet review qualifies under one of these codes; the partner's billing team must confirm.

Procurement for government buyers, DoH and ADPHC included, runs through the Abu Dhabi Government Procurement Gate ([DoH tenders](https://www.doh.gov.ae/en/about/tenders-and-grants)).

## Market figures

| Item | Figure | Source |
|---|---|---|
| Abu Dhabi population, 2024 | 4,135,985 | [SCAD](https://scad.gov.ae/w/abu-dhabi-population-in-2024-grows-7-5-to-reach-4-14m) |
| Abu Dhabi, aged 50 to 64 | 398,820 (derived from SCAD age bands) | [citypopulation.de](https://www.citypopulation.de/en/uae/abudhabi/admin) |
| Abu Dhabi, aged 65 and over | 78,095 | same |
| IFHAS enrolment | More than 195,000 citizens (May 2025). No count of memory screens found | [WAM](https://www.wam.ae/en/article/bjnjvuu-global-health-leaders-converge-abu-dhabi-iuhpe) |
| Emirati share by age | Not published. GLMM estimates 87% of UAE residents are non-nationals (2022) | [GLMM](https://gulfmigration.grc.net/wp-content/uploads/2022/10/GLMM-FS1-Imbalance-Final-2022-10.24.pdf) |
| Dementia, UAE | 1.33% at 50 and over, 4.09% at 60 and over (2021) | [Qassem et al. 2023](https://www.cambridge.org/core/product/C609F7D51D0CCEDEBD205D58880AB9E4/core-reader) |
| Direct cost of dementia, UAE | About US$2,371 per person (2021) | same |
| Delay to diagnosis, Al Ain | 34.6 months from first symptoms, at a mean age of 78 (n=825) | [PMC11738900](https://pmc.ncbi.nlm.nih.gov/articles/PMC11738900/) |
| Disabling hearing loss, 60 and over | More than 25% (global) | [WHO](https://www.who.int/news-room/fact-sheets/detail/deafness-and-hearing-loss) |
| Hearing loss as a dementia risk | 7% of preventable dementia risk | [Lancet Commission 2024](https://www.alzheimer-europe.org/news/2024-lancet-commission-underscores-potential-dementia-risk-reduction-identifying-14-modifiable) |

No audiometric hearing study and no MCI prevalence figure exist for the UAE.

## Cost model per eligible member

One screening provider with 10,000 eligible members aged 50 and over, for one year. It models a pilot at scale, with a backend in a UAE region. The current build has no backend and runs from a static site outside the UAE, so the hosting line is for an architecture not yet built.

| Input | Value | Basis |
|---|---|---|
| Uptake | 40%, so 4,000 users | ASSUMPTION |
| Checks per user per year | 4 | ASSUMPTION |
| Audio sent to the cloud per check | 5 minutes | ASSUMPTION, a ceiling. The build sends at most three clips to the cloud listener, capped at 45, 60 and 45 seconds, so 2.5 minutes (`src/pages/Check.tsx`). The on-device listener sends none |
| Azure speech to text, UAE North | US$1.00 per audio hour (S1, pay as you go) | [Azure Retail Prices API](https://prices.azure.com/api/retail/prices?$filter=armRegionName%20eq%20%27uaenorth%27%20and%20meterName%20eq%20%27S1%20Speech%20To%20Text%27) |
| Hosting, UAE North | 2 App Service P1v3 Linux at US$0.191 an hour, PostgreSQL Flexible 2 vCore at US$0.217 an hour, plus US$600 storage and backup | Hourly rates from the same API. Storage and backup: ASSUMPTION |
| Users with a packet for physician review | 8% a year | ASSUMPTION. Our simulation gives about 50 packets per 1,000 members a year at an assumed 2% in real decline (`docs/PILOT.md`) |
| Physician minutes per packet | 10 | ASSUMPTION |
| Physician cost | AED 450 an hour | ASSUMPTION |
| Care coordinator | 0.25 FTE at AED 240,000 a year | ASSUMPTION |
| Software upkeep, support, security, DoH compliance | AED 150,000 a year | ASSUMPTION |

Arithmetic at 40% uptake:

- Checks: 4,000 × 4 = 16,000
- Speech: 16,000 × 5 min = 80,000 min = 1,333 h × US$1.00 = US$1,333 = AED 4,897
- Hosting: (0.191 × 2 × 8,760 = US$3,346) + (0.217 × 8,760 = US$1,901) + US$600 = US$5,847 = AED 21,474
- Physician: 4,000 × 8% = 320 packets × 10 min = 53.3 h × AED 450 = AED 24,000
- Coordinator: 0.25 × 240,000 = AED 60,000
- Upkeep: AED 150,000
- Total: AED 260,371 (US$70,897)

| Uptake | Users | Total cost (AED) | Per eligible member a year | Per active user a year | Per check |
|---|---|---|---|---|---|
| 20% | 2,000 | 245,922 | 24.59 | 122.96 | 30.74 |
| 40% | 4,000 | 260,371 | 26.04 | 65.09 | 16.27 |
| 60% | 6,000 | 274,819 | 27.48 | 45.80 | 11.45 |

So the modelled cost is about AED 26 per eligible member a year at 40% uptake. This is a cost estimate from assumptions, not a price. `docs/PILOT.md` sets the price only after the pilot measures these cost lines. Fixed costs dominate; cloud speech is under 2% of the total.

For comparison, published prices of other digital cognitive tools: Cognivue clinics charged patients about US$40 a test ([MDDI](https://www.mddionline.com/business/can-cognitive-assessment-become-routine-part-checkups)); BrainCheck lists US$299 a month for up to 10 patients ([braincheck.com/pricing](https://braincheck.com/pricing)); BrainTest eSAGE was about US$25 a test in 2022 ([Cayman Compass](https://www.caymancompass.com/2022/03/04/first-digital-self-administered-alzheimers-test-by-braintest-sezc/)).

## Pilot partners

1. ADPHC, which runs IFHAS. Its indicators count participation, abnormal findings and referral within 15 days, and nothing tracks change within a person between clinic visits three years apart at 50 to 64 ([DoH IFHAS standard](https://www.doh.gov.ae/-/media/EE758C3B77314BC394F2479AEF803AA2.ashx)). The check fills that gap inside packages 52-45 and 52-46, which already exist.
2. SEHA and PureHealth: Sheikh Shakhbout Medical City's memory clinic with Sakina, plus SEHA's ambulatory clinics. The memory clinic opened in March 2025 and said it would explore "AI-powered screening tools" ([Abu Dhabi Media Office](https://www.mediaoffice.abudhabi/en/health/sheikh-shakhbout-medical-city-partners-with-sakina-to-launch-multidisciplinary-memory-clinic-to-enhance-early-detection-for-dementia/)). SEHA clinics deliver IFHAS, so the check would send the memory clinic referrals that already carry a trajectory and treatable contributors.
3. M42: Cleveland Clinic Abu Dhabi, Healthpoint and NRL with Neurocode. NRL offers blood-based Alzheimer's testing from age 40 ([Abu Dhabi Media Office](https://www.mediaoffice.abudhabi/en/health/m42s-nrl-and-neurocode-international-launch-center-for-advanced-neuro-biochemical-diagnostics-in-a-region-first/)). A low-cost home check could help decide who is offered a costly blood test or neuropsychology slot (ASSUMPTION). Healthpoint also reaches privately insured expatriates, who are outside IFHAS.

## The pilot ask

We have built a prototype of a home memory check, spoken in English or Gulf Arabic, that compares each person with their own baseline and runs a hearing check first. A physician approves every packet before the person is told anything, and results are given in person. We would like a 12-month pilot at one of your IFHAS clinics, after ethics approval: members aged 50 to 64 who agree at their screening visit, 250 with home checks about every six weeks and 250 with usual care. It is a feasibility pilot. We would measure how many people complete a baseline, how many approved packets reach a specialist within 15 working days, physician minutes per packet, and agreement between the machine and a human listener by language. We need a clinical lead, ethics sponsorship and a few hours a week of a family physician. Before the pilot starts, the check must be hosted in a UAE region and use only the on-device and UAE listeners, and a native Gulf Arabic speaker must review the Arabic wording. You keep the data and receive the report. Could we have 30 minutes in the next two weeks?
