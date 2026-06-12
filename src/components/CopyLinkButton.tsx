import { useWorkbench } from "../store/workbench";

// Copies the current address — the hash permalink already reflects the open
// view (see store/urlSync.ts) — so "send this tablet to a colleague" is one
// click. Clipboard access needs a secure context; failures surface as a
// toast rather than silently doing nothing.
export function CopyLinkButton() {
  const toast = useWorkbench((s) => s.toast_show);
  return (
    <button
      className="modal-close"
      aria-label="Copy link to this view"
      title="Copy link to this view"
      onClick={() => {
        const url = window.location.href;
        if (!navigator.clipboard) {
          toast("Copying needs a secure (https) context", "error");
          return;
        }
        navigator.clipboard.writeText(url).then(
          () => toast("Link copied"),
          () => toast("Couldn't copy the link", "error"),
        );
      }}
    >
      🔗
    </button>
  );
}
