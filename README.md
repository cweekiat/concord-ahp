# Concord: AHP decisions, AI-assisted

**Live demo:** https://cweekiat.github.io/concord-ahp/

Concord runs a team **Analytic Hierarchy Process (AHP)** evaluation for complex acquisitions, following DoD source selection practice. The AI drafts and checks. People make every judgment, and the Source Selection Authority (SSA) signs the decision.

## What's inside

- **8-step workflow**: set up → criteria → evidence → judgments → group view → scoring → results → decision.
- **Management dashboard** with:
  - progress KPIs and the outstanding actions for each owner
  - an AHP hierarchy diagram (link width shows each criterion's contribution)
  - a radar comparison of the proposals
  - ranking, group weights, evaluator consistency, evidence status and disagreement charts
  - AI oversight counts
- **Demo scenario**: an EO/IR sensor for a maritime patrol UAS. Four fictional proposals and a nine-person team.
- **Resources-saved model**: illustrative and editable.
- **Audit log**: every AI suggestion and every human decision.

All scores and weights come from a deterministic, unit-tested engine (`src/ahp/engine.ts`). The AI only explains numbers the engine has already computed.

## Use your own LLM

Open **Settings → AI provider**, then pick a provider, model and key. **Test connection** checks the setup.

| Provider | Endpoint | Key |
|---|---|---|
| Demo (default) | none, offline scripted responses | — |
| Anthropic Claude | `https://api.anthropic.com` | required |
| OpenAI | `https://api.openai.com/v1` | required |
| Google Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` | required |
| Ollama (local) | `http://localhost:11434/v1` | none |
| LM Studio (local) | `http://localhost:1234/v1` | none |
| Other OpenAI-compatible | any (vLLM, OpenRouter, an in-house gateway…) | optional |

- Calls go straight from your browser to the endpoint you choose. There is no Concord server.
- **API key:** kept in memory by default. "Remember key on this device" stores it in this browser only.
- **Not exported:** AI settings and keys are never included in evaluation exports.
- **Untrusted output:** every live response is checked against a schema and coerced to the expected shape, because small models sometimes return malformed JSON.

**Local models:** Ollama must allow browser requests:

```bash
OLLAMA_ORIGINS="*" ollama serve
```

In LM Studio, enable CORS in the server settings.

## Run on your own laptop

Requires Node 20+.

```bash
git clone https://github.com/cweekiat/concord-ahp.git
```

```bash
cd concord-ahp && npm install
```

```bash
npm run dev
```

Then open http://localhost:5173/concord-ahp/.

To preset a provider, for example a local Ollama model, copy `.env.example` to `.env.local` and edit it:

```bash
cp .env.example .env.local
```

```
VITE_LLM_PROVIDER=ollama
VITE_LLM_BASE_URL=http://localhost:11434/v1
VITE_LLM_MODEL=qwen2.5:7b
VITE_LLM_API_KEY=            # local use only; never deploy a build containing a key
```

Other commands: `npm test` runs the engine and output-hardening tests, and `npm run build` builds a static site into `dist/`. You can host that folder anywhere, including an air-gapped intranet server next to a local model.

## Deploy

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

## Design

Concord follows Apple's Human Interface Guidelines:

- system font and semantic colours
- light, dark and increased-contrast modes
- 44 px touch targets
- support for reduced motion and reduced transparency

Charts use a validated colour-blind-safe palette with legends, direct labels and a data table under each chart. See [docs/HIG-REVIEW.md](docs/HIG-REVIEW.md).

## Limitations

- Concord runs in a single browser. Team members share an evaluation by exporting and importing a JSON file.
- A real deployment needs accounts, access control, CUI accreditation and an approved model host.
- All demo data is fictional.
