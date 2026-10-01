import type { Gate } from "@/lib/domain/gate";
import type { JobReadModel } from "@/lib/data/job-read-model";
import { gateLabel } from "@/lib/radar/presentation";
import { EvidenceDisclosure } from "./evidence-disclosure";
export function GateRow({
  gate,
  job,
  reason,
}: {
  gate: Gate;
  job: JobReadModel;
  reason?: string;
}) {
  return (
    <li className="gate-row">
      <div className="gate-heading">
        <h3>{gateLabel(gate)}</h3>
        <span className="meta">
          {gate.scope === "program" ? "项目范围" : "岗位条件"}
        </span>
      </div>
      {reason && <p className="gate-reason">{reason}</p>}
      {gate.note && <p className="meta">{gate.note}</p>}
      {gate.evidence.map((e, i) => (
        <EvidenceDisclosure key={i} evidence={e} job={job} />
      ))}
    </li>
  );
}
