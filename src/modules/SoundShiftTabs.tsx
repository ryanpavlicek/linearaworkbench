import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import SoundShift from "./SoundShift";
import HypothesisWorkspace from "./HypothesisWorkspace";

export default function SoundShiftTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);
  const initialKey =
    activeModule === "hypws" || moduleIntent?.tab === "workspace"
      ? "workspace"
      : "editor";
  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const target = key === "workspace" ? "hypws" : "hyp";
        if (target !== activeModule) setActive(target);
      }}
      tabs={[
        { key: "editor", label: "Editor", Component: SoundShift },
        {
          key: "workspace",
          label: "Workspace",
          Component: HypothesisWorkspace,
        },
      ]}
    />
  );
}
