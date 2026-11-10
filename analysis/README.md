# Survey analysis

`survey_analysis.py` reproduces the schooling result shown in the app.

Data: NHANES 2011 to 2012 and 2013 to 2014, published by the US Centers for Disease Control and Prevention. Public domain. Files: CFQ (cognitive functioning), DEMO (demographics), MCQ (medical conditions), PFQ (physical functioning), cycles G and H. No personal identifiers. Nothing from these files is stored in this repository.

Download the eight `.xpt` files into an empty folder:

```bash
for f in 2011/DataFiles/CFQ_G 2013/DataFiles/CFQ_H 2011/DataFiles/DEMO_G 2013/DataFiles/DEMO_H 2011/DataFiles/MCQ_G 2013/DataFiles/MCQ_H 2011/DataFiles/PFQ_G 2013/DataFiles/PFQ_H; do curl -sLO "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/$f.xpt"; done
```

Run:

```bash
uv run --no-project --with pandas --with numpy python analysis/survey_analysis.py <folder>
```

What it found, in adults aged 60 and over (3,110 with an animal-naming score):

- Among 2,619 adults who reported no worsening memory and no difficulty managing money, a cutoff of 14 animals in a minute flags 47.9% of those with under 9 years of school (n = 265) and 15.8% of college graduates (n = 569).
- Norms adjusted for age, sex and schooling bring those shares close together, but they pick out people with worsening memory slightly less well (AUC 0.605 before adjustment, 0.575 after), and sensitivity in the lowest-schooling group falls from 0.60 to 0.39.

Limits: a US sample, not a Gulf one. Survey weights are not applied, so the figures describe the sample. The outcomes are self-reported. The survey is a single visit, so it says nothing about change over time.
