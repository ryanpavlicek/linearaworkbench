import { TabbedModule } from "../components/TabbedModule";
import { useWorkbench } from "../store/workbench";
import type { ModuleId } from "../lib/types";
import AccountDossiers from "./AccountDossiers";
import ArithmeticCheck from "./ArithmeticCheck";
import MetrologyLab from "./MetrologyLab";

export default function AccountingTabs() {
  const activeModule = useWorkbench((s) => s.activeModule);
  const moduleIntent = useWorkbench((s) => s.moduleIntent);
  const setActive = useWorkbench((s) => s.setActiveModule);

  const initialKey: ModuleId =
    activeModule === "metrology" || moduleIntent?.tab === "metrology"
      ? "metrology"
      : activeModule === "dossiers" || moduleIntent?.tab === "dossiers"
        ? "dossiers"
        : "arith";

  return (
    <TabbedModule
      initialKey={initialKey}
      onSelect={(key) => {
        const mod = key as ModuleId;
        if (mod !== activeModule) setActive(mod);
      }}
      tabs={[
        { key: "arith", label: "Balance Check", Component: ArithmeticCheck },
        { key: "metrology", label: "Metrology Lab", Component: MetrologyLab },
        { key: "dossiers", label: "Account Dossiers", Component: AccountDossiers },
      ]}
    />
  );
}
