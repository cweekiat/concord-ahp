# Concord: AHP decisions, AI-assisted

**Live demo:** https://cweekiat.github.io/concord-ahp/

Concord pairs the **Analytic Hierarchy Process (AHP)** with AI to help an acquisition team choose between complex engineering systems. The team might include performance engineers, reliability and logistics specialists, cost analysts, cyber leads and operators. The process follows DoD source selection practice.

> **The AI drafts and checks. People judge and decide.**

The AI never casts a judgment, never counts as an evaluator, and never selects a winner. Every AI output is a labelled suggestion that a named person accepts, edits or rejects, and every step is written to an audit log.

## The demo: an EO/IR sensor for a maritime patrol UAS

Four fictional proposals are evaluated against a fictional requirements document by a nine-person team (eight evaluators plus the Source Selection Authority):

| Step | AI prepares | People decide |
|---|---|---|
| 1 Set up | — | Goal, proposals, team and criterion owners |
| 2 Criteria | Drafts the criteria tree from the CDD and flags gaps and double counting | PM approves the hierarchy |
| 3 Evidence | Extracts 32 values from datasheets, converts units, quotes sources, flags conflicts | Owners verify each value; PM confirms KPP screening |
| 4 Judgments | Finds the judgment behind an inconsistency (CR > 0.10) and explains it | Every pairwise judgment |
| 5 Group view | Measures disagreement and drafts neutral discussion prompts | The team discusses; evaluators revise if persuaded |
| 6 Scoring | — | Owners compare proposals on the criteria that have no numbers |
| 7 Results | Finds the weights at which first place changes and explains them | Is the margin enough? |
| 8 Decision | Drafts the Source Selection Decision Document | The SSA selects, writes the rationale and signs |

The scenario includes a deliberately inconsistent evaluator, two evaluators who disagree, a datasheet that gives both predicted and demonstrated MTBF, a weight quoted in pounds, and a proposal that fails a KPP. Each AI step has real work to do.

**Resources saved:** an editable, clearly labelled *illustrative* model puts the default scenario at about 122 → 44 person-hours (−64%) and 33 → 16 working days. Expert judgment time is kept the same on purpose.

## How it works

- `src/ahp/engine.ts` contains the deterministic AHP maths: principal eigenvector, consistency ratio, AIJ geometric-mean aggregation, consistency-fix search, threshold/objective value functions, and exact sensitivity crossovers. It has unit tests in `engine.test.ts`. **No number in the app comes from a language model.** The AI only explains numbers the engine computed.
- `src/ai/tasks.ts` defines each AI task with a guardrailed system prompt and a strict JSON schema (forced tool use).
  - **Demo mode** (default) uses scripted responses filled in with the live numbers.
  - **Live mode** calls the Claude API from the browser with your own key. The key is held in memory only and never saved.
- `src/data/` holds the fictional scenario, source documents and the savings model.
- The design follows Apple's Human Interface Guidelines: system font stack, semantic colours in light, dark and increased contrast, grouped lists, sheets, segmented controls and 44 px targets. It honours reduced motion and reduced transparency. See [docs/HIG-REVIEW.md](docs/HIG-REVIEW.md).

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173/concord-ahp/
npm test        # engine unit tests
npm run build
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Limitations

This is a single-browser demonstration. A real deployment would need accounts and access control, accreditation for CUI, and an approved model-hosting environment. Everything in the demo is fictional: the programme, vendors, products, people and figures.
