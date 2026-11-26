import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import CorpusBrowser from "./CorpusBrowser";
import PlateWorkbench from "./PlateWorkbench";

export default function CorpusExplorerTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "plates" || moduleIntent?.tab === "plates"
      ? "plates"
      : "browse";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "browse", label: "Corpus Browser", Component: CorpusBrowser },
        { key: "plates", label: "Plate Workbench", Component: PlateWorkbench },
      ]}
    />
  );
}
