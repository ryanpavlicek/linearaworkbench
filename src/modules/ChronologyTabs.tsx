import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import Diachronic from "./Diachronic";
import Timeline from "./Timeline";

export default function ChronologyTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "diachronic" || moduleIntent?.tab === "diachronic"
      ? "diachronic"
      : "timeline";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "timeline", label: "Timeline", Component: Timeline },
        { key: "diachronic", label: "Diachronic (MM/LM)", Component: Diachronic },
      ]}
    />
  );
}
