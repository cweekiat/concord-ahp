import { valueScore } from '../ahp/engine';
import { CRITERIA, altById, expertById } from '../data/scenario';
import { Badge, Gate, Pager, Section, StepHeader, pct } from '../components/ui';
import { useStore } from '../state/store';
import { cellKey } from '../state/types';
import { CRBadge } from './Judgments';

export default function Scoring() {
  const { state, model } = useStore();
  if (!model.ready) {
    return (
      <>
        <StepHeader eyebrow="Step 6 of 8" title="Score the proposals" lede="Scoring needs approved criteria, verified evidence and confirmed screening." />
        <Gate blockers={model.blockers} />
        <Pager here="scoring" />
      </>
    );
  }
  return (
    <>
      <StepHeader
        eyebrow="Step 6 of 8"
        title="Score the proposals"
        lede="Measured criteria use a value function: a proposal at the threshold scores 0.1 and one at the objective scores 1.0, with no extra credit past the objective. Judged criteria use the owners’ head-to-head comparisons. Each criterion’s scores add up to 100%."
        human={['Owners set threshold and objective values (from the requirements document)', 'Owners make the head-to-head comparisons on judged criteria']}
      />
      {CRITERIA.map((c) => (
        <Section key={c.id} title={<span className="hstack"><i className="dot" style={{ background: c.color }} />{c.name}</span>} subtitle={`Owner: ${expertById(c.owner).role}`}>
          <div className="card table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th scope="col">Sub-criterion</th>
                  <th scope="col" className="r">Local weight</th>
                  {model.active.map((a) => <th scope="col" className="r" key={a}>{altById(a).name}</th>)}
                </tr>
              </thead>
              <tbody>
                {c.leaves.map((l, li) => (
                  <tr key={l.id}>
                    <th scope="row" style={{ fontWeight: 400 }}>
                      {l.short}
                      <div className="caption tertiary">
                        {l.kind === 'quant' ? `T ${l.threshold} → O ${l.objective} ${l.unit}` : <span className="hstack">Owner judgments <CRBadge cr={model.qualCR[l.id]} /></span>}
                      </div>
                    </th>
                    <td className="r">{pct(model.localWeights[c.id][li])}</td>
                    {model.active.map((a, ai) => {
                      const v = state.evidence[cellKey(a, l.id)]?.value;
                      return (
                        <td className="r" key={a}>
                          <div style={{ fontWeight: 600 }}>{pct(model.leafPriorities[l.id][ai], 1)}</div>
                          {l.kind === 'quant' && v != null && (
                            <div className="caption tertiary">{v} {l.unit} → {valueScore(v, l.threshold!, l.objective!).toFixed(2)}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <th scope="row">Criterion score</th>
                  <td />
                  {model.active.map((a, ai) => {
                    const ci = CRITERIA.indexOf(c);
                    const best = Math.max(...model.S[ci]);
                    return (
                      <td className="r" key={a} style={{ fontWeight: 700 }}>
                        {pct(model.S[ci][ai], 1)} {model.S[ci][ai] === best && <Badge tone="green">Best</Badge>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      ))}
      <Pager here="scoring" />
    </>
  );
}
