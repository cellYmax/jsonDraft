import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { JsonMode } from "../lib/jsonTools";

type HealthPanelProps = {
  isValid: boolean;
  issueCount: number;
  mode: JsonMode;
};

export function HealthPanel({ isValid, issueCount, mode }: HealthPanelProps) {
  return (
    <section className={`health ${isValid ? "valid" : "invalid"}`}>
      {isValid ? (
        <CheckCircle2 size={22} aria-hidden="true" />
      ) : (
        <AlertCircle size={22} aria-hidden="true" />
      )}
      <div>
        <strong>{isValid ? "校验通过" : `发现 ${issueCount} 个错误`}</strong>
        <span>{mode === "json" ? "严格 JSON" : "JSONC"}</span>
      </div>
    </section>
  );
}
