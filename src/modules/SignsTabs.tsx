import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import SignConcordance from "./SignConcordance";
import SignInventory from "./SignInventory";
import SignPatterns from "./SignPatterns";
import SignTransitions from "./SignTransitions";

export default function SignsTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "signs" || moduleIntent?.tab === "signs"
      ? "signs"
      : activeModule === "signtrans" || moduleIntent?.tab === "signtrans"
        ? "signtrans"
        : activeModule === "signpat" || moduleIntent?.tab === "signpat"
          ? "signpat"
          : "signref";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "signref", label: "Sign Inventory", Component: SignInventory },
        { key: "signs", label: "Sign Concordance", Component: SignConcordance },
        { key: "signtrans", label: "Sign Transitions", Component: SignTransitions },
        { key: "signpat", label: "Sign Patterns", Component: SignPatterns },
      ]}
    />
  );
}
