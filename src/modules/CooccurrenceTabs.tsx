import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import Cooccurrence from "./Cooccurrence";
import Network from "./Network";

export default function CooccurrenceTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);
  const initialKey =
    activeModule === "network" || moduleIntent?.tab === "graph"
      ? "graph"
      : "table";
  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const target = key === "graph" ? "network" : "cooc";
        if (target !== activeModule) setActive(target);
      }}
      tabs={[
        { key: "table", label: "Table", Component: Cooccurrence },
        { key: "graph", label: "Network graph", Component: Network },
      ]}
    />
  );
}
