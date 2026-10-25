import { useMemo } from "react";
import { collectWarnings, runRules } from "@/model/rules";
import { useEditor } from "./store";

export function useRuleState() {
  const project = useEditor((s) => s.project);
  return useMemo(() => {
    const results = runRules(project);
    return { results, warnings: collectWarnings(project, results) };
  }, [project]);
}
