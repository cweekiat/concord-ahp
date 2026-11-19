import { Section, StepHeader } from '../components/ui';

export default function Method() {
  return (
    <>
      <StepHeader eyebrow="Reference" title="Method and guardrails"  />

      <Section title="The maths (no AI involved)">
        <div className="card pad doc">
          <ul>
            <li><strong>Pairwise comparisons</strong> use Saaty’s 1–9 scale. A judgment a<sub>ij</sub> = 5 means “i is strongly more important than j”, and a<sub>ji</sub> = 1/5.</li>
            <li><strong>Priorities</strong> are the principal eigenvector of each comparison matrix, found by power iteration and normalised to sum to 1.</li>
            <li><strong>Consistency ratio</strong> CR = CI / RI, where CI = (λ<sub>max</sub> − n)/(n − 1) and RI is Saaty’s random index. CR ≤ 0.10 is the usual limit.</li>
            <li><strong>Group aggregation</strong> uses the element-wise geometric mean of individual matrices (AIJ), which keeps the reciprocal property. Every evaluator counts equally.</li>
            <li><strong>Measured criteria</strong> are scored with a value function: threshold → 0.1, objective → 1.0, linear in between, with no extra credit past the objective. Scores within each criterion are then normalised (distributive mode).</li>
            <li><strong>Screening</strong>: a proposal that misses a KPP threshold is removed before scoring, as in a DoD source selection.</li>
            <li><strong>Sensitivity</strong> varies one criterion’s weight from 0 to 1 and rescales the others proportionally. Scores are linear in that weight, so tie points are exact.</li>
            <li><strong>The consistency coach</strong> tries every Saaty value on every pair and reports the pair whose revision lowers CR the most. It also gives the smallest change that would pass.</li>
          </ul>
          <p className="footnote secondary">All of this is in <code>src/ahp/engine.ts</code> with unit tests. The AI only ever explains numbers the engine has already computed.</p>
        </div>
      </Section>

      <Section title="Guardrails on the AI">
        <div className="card pad doc">
          <ul>
            <li>The AI <strong>never sets a judgment</strong> and is never counted as an evaluator.</li>
            <li>Every AI output appears as a labelled <strong>suggestion</strong>. A named person accepts, edits or rejects it, and both steps go in the audit log.</li>
            <li>Extracted evidence carries its <strong>source quote, location and confidence</strong>. The criterion owner has to verify each value before it can be scored.</li>
            <li>Role permissions mirror the source selection: owners verify their own evidence, the PM approves the hierarchy and screening, and <strong>only the SSA signs</strong>.</li>
            <li>The decision document leaves the decision section blank for the SSA. The SSA may depart from the ranking with a written rationale.</li>
            <li>Live mode sends prompts with a system instruction that forbids recommending a selection or inventing numbers.</li>
          </ul>
        </div>
      </Section>

      <Section title="Limitations">
        <div className="card pad doc">
          <ul>
            <li>AHP assumes criteria are reasonably independent. The hierarchy step is where that is protected, which is why the AI flags double-counting.</li>
            <li>Adding or removing a proposal can change the order of the others (rank reversal) under distributive normalisation. That’s one reason to confirm screening before scoring.</li>
            <li>One-at-a-time sensitivity misses combined shifts. Treat it as a first check.</li>
            <li>This demo runs in one browser. A real deployment would need accounts, access control, accreditation for controlled unclassified information (CUI), and an approved model-hosting environment.</li>
            <li>The resource-savings figures are an illustrative model, not measured data.</li>
          </ul>
        </div>
      </Section>

      <Section title="Live AI and your API key">
        <div className="card pad doc">
          <p>Concord is a static site with no server. In live mode your browser calls the Claude API directly with your own key. The key stays in memory for this tab only: it is never saved, exported or sent anywhere else. Don’t paste real programme data into a public demo.</p>
        </div>
      </Section>

      <Section title="Further reading">
        <div className="card pad doc">
          <ul>
            <li>Saaty, T. L. (1980). <em>The Analytic Hierarchy Process</em>. McGraw-Hill.</li>
            <li>Forman, E. &amp; Peniwati, K. (1998). Aggregating individual judgments and priorities with the AHP. <em>European Journal of Operational Research</em>, 108(1).</li>
            <li>Federal Acquisition Regulation, Part 15.3: Source Selection.</li>
            <li>DoD Source Selection Procedures (DFARS PGI 215.300).</li>
            <li>DoD Instruction 5000.85, Major Capability Acquisition.</li>
          </ul>
        </div>
      </Section>
    </>
  );
}
