import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import DataExport from "./DataExport";
import PythonToolkit from "./PythonToolkit";

export default function ExportTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "pyaegean" || moduleIntent?.tab === "pyaegean"
      ? "pyaegean"
      : "export";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "export", label: "Data Export & Backup", Component: DataExport },
        { key: "pyaegean", label: "Python Toolkit (pyaegean)", Component: PythonToolkit },
      ]}
    />
  );
}
