import { ALTERNATIVES, CRITERIA, EXPERTS, PROGRAMME } from '../data/scenario';
import { Avatar, Badge, Button, Pager, Section, StepHeader } from '../components/ui';
import { useStore } from '../state/store';

export default function Setup() {
  const { state, update, log } = useStore();
  return (
    <>
      <StepHeader
        eyebrow="Step 1 of 8"
        title="Set up the evaluation"
        lede={`${PROGRAMME.name}: ${PROGRAMME.context}`}
        human={['The Program Manager sets the goal and confirms which proposals are in play.', 'Each evaluator owns the criteria in their specialty.']}
      />

      <Section title="Decision goal" subtitle="The question every judgment answers.">
        <div className="card pad">
          <label className="sr-only" htmlFor="goal">Decision goal</label>
          <textarea
            id="goal"
            className="input"
            style={{ minHeight: 84 }}
            value={state.goal}
            onChange={(e) => update((s) => ({ ...s, goal: e.target.value }))}
            onBlur={() => log('edit', 'setup', 'Edited the decision goal.')}
          />
        </div>
      </Section>

      <Section title="Proposals" subtitle="Four received. All fictional.">
        <div className="grid-2">
          {ALTERNATIVES.map((a) => (
            <div className="card pad" key={a.id}>
              <div className="hstack" style={{ justifyContent: 'space-between' }}>
                <span className="hstack">
                  <i className="dot" style={{ background: a.color, width: 12, height: 12, borderRadius: 6 }} />
                  <span className="headline">{a.vendor} {a.name}</span>
                </span>
                <Badge>Proposal {a.id}</Badge>
              </div>
              <p className="subhead secondary" style={{ margin: '6px 0 0' }}>{a.summary}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Evaluation team" subtitle="Switch persona in the toolbar to act as any of them. Each person can only change what they own." footer="Only the Source Selection Authority signs the decision. The SSA doesn’t weigh criteria, which keeps the decision separate from the evaluation.">
        <div className="card">
          {EXPERTS.map((e) => (
            <div className="row" key={e.id}>
              <Avatar initials={e.initials} />
              <div className="grow">
                <div className="headline" style={{ fontSize: '0.9375rem' }}>
                  {e.name} <span className="secondary" style={{ fontWeight: 400 }}>· {e.role}</span>
                </div>
                <div className="footnote secondary">{e.focus}</div>
              </div>
              <div className="hstack" style={{ justifyContent: 'flex-end' }}>
                {e.owns.map((c) => (
                  <Badge key={c} tone="blue">Owns {CRITERIA.find((x) => x.id === c)!.short}</Badge>
                ))}
                {e.id === 'ssa' && <Badge tone="green">Decides</Badge>}
                {state.persona === e.id ? (
                  <Badge tone="indigo">You</Badge>
                ) : (
                  <Button small variant="plain" onClick={() => update((s) => ({ ...s, persona: e.id }))} aria-label={`Act as ${e.name}`}>
                    Act as
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Pager here="setup" />
    </>
  );
}
