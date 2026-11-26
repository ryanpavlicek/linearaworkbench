import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import ScribeComparison from "./ScribeComparison";
import ScribeNetwork from "./ScribeNetwork";

export default function Scribes() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);
  const initialKey =
    activeModule === "scribenet" || moduleIntent?.tab === "network"
      ? "network"
      : "comparison";
  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const target = key === "network" ? "scribenet" : "scribes";
        if (target !== activeModule) setActive(target);
      }}
      tabs={[
        { key: "comparison", label: "Comparison", Component: ScribeComparison },
        { key: "network", label: "Network", Component: ScribeNetwork },
      ]}
    />
  );
}
