import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import FindspotMap from "./FindspotMap";
import SiteDistribution from "./SiteDistribution";

export default function Geography() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);
  const initialKey =
    activeModule === "geo" || moduleIntent?.tab === "distribution"
      ? "dist"
      : "map";
  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const target = key === "dist" ? "geo" : "map";
        if (target !== activeModule) setActive(target);
      }}
      tabs={[
        { key: "map", label: "Map", Component: FindspotMap },
        { key: "dist", label: "Site distribution", Component: SiteDistribution },
      ]}
    />
  );
}
