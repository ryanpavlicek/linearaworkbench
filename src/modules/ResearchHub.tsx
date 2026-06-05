import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import Annotations from "./Annotations";
import Collections from "./Collections";
import Findings from "./Findings";
import Notes from "./Notes";
import ResearchReport from "./ResearchReport";

export default function ResearchHub() {
  const { activeModule, moduleIntent } = useWorkbench.getState();
  const initialKey =
    activeModule === "collections" || moduleIntent?.tab === "collections"
      ? "collections"
      : activeModule === "report" || moduleIntent?.tab === "report"
        ? "report"
        : moduleIntent?.tab === "findings"
          ? "findings"
          : moduleIntent?.tab === "notebook"
            ? "notebook"
            : "notes";
  return (
    <TabbedModule
      initialKey={initialKey}
      tabs={[
        { key: "notes", label: "Notes", Component: Notes },
        { key: "notebook", label: "Annotations", Component: Annotations },
        { key: "collections", label: "Collections", Component: Collections },
        { key: "findings", label: "Findings", Component: Findings },
        { key: "report", label: "Research report", Component: ResearchReport },
      ]}
    />
  );
}
