import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import MinimalPairs from "./MinimalPairs";
import Morphology from "./Morphology";
import RootCognates from "./RootCognates";
import StemFamilies from "./StemFamilies";

export default function MorphologyTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "stems" || moduleIntent?.tab === "stems"
      ? "stems"
      : activeModule === "minpairs" || moduleIntent?.tab === "minpairs"
        ? "minpairs"
        : activeModule === "roots" || moduleIntent?.tab === "roots"
          ? "roots"
          : "morph";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "morph", label: "Affixes & Clusters", Component: Morphology },
        { key: "stems", label: "Stem Families", Component: StemFamilies },
        { key: "minpairs", label: "Minimal Pairs", Component: MinimalPairs },
        { key: "roots", label: "Root Cognates", Component: RootCognates },
      ]}
    />
  );
}
