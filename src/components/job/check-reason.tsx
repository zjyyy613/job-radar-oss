import type { QualificationResult } from "@/lib/domain/qualification-engine";
import type { QualificationProfile } from "@/lib/domain/profile";
import { checkReason, FIELD_LABELS } from "@/lib/radar/presentation";
export function CheckReason({
  result,
  profile,
}: {
  result: QualificationResult;
  profile: QualificationProfile;
}) {
  return (
    <ul className="check-reasons">
      {result.reasons.map((reason, i) => (
        <li key={i}>
          {reason.gate ? `${FIELD_LABELS[reason.gate.field]}：` : ""}
          {checkReason(reason, profile)}
        </li>
      ))}
    </ul>
  );
}
