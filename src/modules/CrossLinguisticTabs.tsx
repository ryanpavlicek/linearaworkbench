import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import CrossLinguistic from "./CrossLinguistic";
import WordlistManager from "./WordlistManager";

export default function CrossLinguisticTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "wlm" || moduleIntent?.tab === "wlm" ? "wlm" : "comp";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "comp", label: "Comparator", Component: CrossLinguistic },
        { key: "wlm", label: "Wordlist Manager", Component: WordlistManager },
      ]}
    />
  );
}
