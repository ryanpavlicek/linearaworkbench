import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import Cooccurrence from "./Cooccurrence";
import Network from "./Network";

export default function CooccurrenceTabs() {
  const { activeModule, moduleIntent } = useWorkbench.getState();
  const initialKey =
    activeModule === "network" || moduleIntent?.tab === "graph"
      ? "graph"
      : "table";
  return (
    <TabbedModule
      initialKey={initialKey}
      tabs={[
        { key: "table", label: "Table", Component: Cooccurrence },
        { key: "graph", label: "Network graph", Component: Network },
      ]}
    />
  );
}
