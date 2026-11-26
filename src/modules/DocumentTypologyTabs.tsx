import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import DocumentTypes from "./DocumentTypes";
import TabletStructure from "./TabletStructure";

export default function DocumentTypologyTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "doctypes" || moduleIntent?.tab === "doctypes"
      ? "doctypes"
      : "struct";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "struct", label: "Tablet Structure", Component: TabletStructure },
        { key: "doctypes", label: "Physical Supports", Component: DocumentTypes },
      ]}
    />
  );
}
