/** Source documents for the demo. All FICTIONAL. These are what the AI reads. */
import type { AltId } from './scenario';

export const REQUIREMENTS_DOC = `CAPABILITY DEVELOPMENT DOCUMENT — EXCERPT (FICTIONAL, FOR DEMONSTRATION)
Project TERN — Maritime Patrol UAS, EO/IR Sensor Turret

3.1  KPP-1 Detection. The sensor shall detect a 30 m vessel in Sea State 3 at a range of at least 20 km (Threshold), 35 km (Objective), with 90% probability of detection.
3.2  KPP-2 Size, Weight and Power. Installed turret weight shall not exceed 45 kg (T), 30 kg (O). Peak power shall not exceed 400 W (T), 250 W (O).
3.3  KSA-1 Identification. The MWIR channel shall support identification of a 7 m small craft at 5 km (T), 10 km (O), per Johnson criteria.
3.4  KSA-2 Stabilisation. Line-of-sight jitter shall not exceed 25 µrad RMS (T), 10 µrad RMS (O) under the reference vibration profile.
4.1  Reliability. Demonstrated MTBF of at least 1,500 h (T), 4,000 h (O). Predicted values are not acceptable evidence.
4.2  Maintainability. O-level MTTR of 60 min (T), 20 min (O) for any line-replaceable unit.
5.1  Affordability. 20-year life-cycle cost per unit of $9.0M (T), $5.0M (O), per the government cost estimate.
6.1  Interoperability. Comply with the Modular Open Systems Approach (MOSA). Motion imagery per STANAG 4609. SOSA-aligned interfaces preferred.
6.2  Cybersecurity. The system shall be capable of achieving an Authority to Operate under the Risk Management Framework. Provide an SBOM and secure update path.
7.1  Programme. A production-representative article shall be at TRL 7 or higher at Milestone C, with first deliveries within 18 months of award.`;

export const DATASHEETS: Record<AltId, { title: string; text: string }> = {
  A: {
    title: 'Alpha Optronics AX-400 — Product Datasheet Rev C (fictional)',
    text: `AX-400 Maritime EO/IR Turret — Rev C
p.2  Fielded on three maritime platforms since 2021. TRL 9.
p.4  Table 2 — Range performance (SS3, Pd 0.9): Detection, 30 m vessel: 38 km. Identification, 7 m craft (MWIR): 11 km.
p.4  Stabilisation: 8 µrad RMS (reference profile).
p.6  Physical: 41 kg installed incl. mount. Peak power 380 W (heaters on).
p.7  Reliability: demonstrated MTBF 2,200 h (fleet data, 2023–2025). MTTR 45 min O-level.
p.9  Interfaces: proprietary control bus; STANAG 4609 video via external encoder.`,
  },
  B: {
    title: 'Bravo Systems Sentinel-9 — Technical Description v2.1 (fictional)',
    text: `Sentinel-9 — Technical Description v2.1
§1   SOSA-aligned architecture. Native STANAG 4609 output. TRL 8 (qualification complete).
§3   Detection, 30 m vessel, SS3: 32 km. Identification, 7 m craft, MWIR: 9.5 km.
§3   LOS stabilisation: 12 µrad RMS.
§4   Mass 36 kg installed. Power 300 W peak.
§5   Reliability: predicted MTBF 5,200 h (MIL-HDBK-217F). Demonstrated MTBF 3,100 h (qualification test, 2025).
§5   MTTR 30 min, tool-less LRU swap.
§7   Cyber: secure boot, signed updates, SBOM delivered.`,
  },
  C: {
    title: 'Charlie Photonics Kestrel EO — Brochure (fictional)',
    text: `KESTREL EO — Lightweight Maritime Turret
Range: detects 30 m vessels at 26 km; identifies 7 m craft at 7 km (MWIR).
Stabilisation 18 µrad RMS.
Weight: 68.3 lb installed. Power: 260 W peak.
Reliability: demonstrated MTBF 3,800 h (accelerated life test). MTTR 25 min.
Status: TRL 7, first production lot planned.`,
  },
  D: {
    title: 'Delta Vision DV-2 — Proposal Volume II extract (fictional)',
    text: `DV-2 Proposal, Volume II — Technical
2.3  Detection of 30 m vessel at 34 km; identification of 7 m craft at 8.5 km.
2.4  Stabilisation 14 µrad RMS.
2.6  Installed weight 52 kg; peak power 420 W.
2.8  Demonstrated MTBF 2,600 h; MTTR 40 min.`,
  },
};

/** Government cost estimate (owned by the Cost Analyst; not in vendor datasheets). */
export const COST_ESTIMATE_NOTE = 'Life-cycle cost comes from the government cost estimate (GCE v1.3), not from vendors.';
