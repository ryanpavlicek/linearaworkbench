import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import ScribeComparison from "./ScribeComparison";
import ScribeNetwork from "./ScribeNetwork";

export default function Scribes() {
  const { activeModule, moduleIntent } = useWorkbench.getState();
  const initialKey =
    activeModule === "scribenet" || moduleIntent?.tab === "network"
      ? "network"
      : "comparison";
  return (
    <TabbedModule
      initialKey={initialKey}
      tabs={[
        { key: "comparison", label: "Comparison", Component: ScribeComparison },
        { key: "network", label: "Network", Component: ScribeNetwork },
      ]}
    />
  );
}
