import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import FindspotMap from "./FindspotMap";
import SiteDistribution from "./SiteDistribution";

export default function Geography() {
  const { activeModule, moduleIntent } = useWorkbench.getState();
  const initialKey =
    activeModule === "geo" || moduleIntent?.tab === "distribution"
      ? "dist"
      : "map";
  return (
    <TabbedModule
      initialKey={initialKey}
      tabs={[
        { key: "map", label: "Map", Component: FindspotMap },
        { key: "dist", label: "Site distribution", Component: SiteDistribution },
      ]}
    />
  );
}
