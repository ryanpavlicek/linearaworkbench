import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import Annotations from "./Annotations";
import Collections from "./Collections";
import Findings from "./Findings";
import MyLexicon from "./MyLexicon";
import Notes from "./Notes";
import ResearchReport from "./ResearchReport";

const TAB_TO_MODULE: Partial<Record<string, ModuleId>> = {
  notes: "annot",
  notebook: "annot",
  lexicon: "lexicon",
  collections: "collections",
  findings: "annot",
  report: "report",
};

export default function ResearchHub() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey =
    activeModule === "lexicon" || moduleIntent?.tab === "lexicon"
      ? "lexicon"
      : activeModule === "collections" || moduleIntent?.tab === "collections"
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
      onSelect={(key) => {
        const mod = TAB_TO_MODULE[key];
        if (mod && mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "notes", label: "Notes", Component: Notes },
        { key: "notebook", label: "Annotations", Component: Annotations },
        { key: "lexicon", label: "My Lexicon", Component: MyLexicon },
        { key: "collections", label: "Collections", Component: Collections },
        { key: "findings", label: "Findings", Component: Findings },
        { key: "report", label: "Research report", Component: ResearchReport },
      ]}
    />
  );
}
