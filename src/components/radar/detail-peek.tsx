"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
function subscribeMedia(listener: () => void) {
  const media = window.matchMedia("(min-width: 1280px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
function DesktopSplit({
  list,
  detail,
  onClose,
}: {
  list: ReactNode;
  detail: ReactNode;
  onClose: () => void;
}) {
  const [width] = useState(() => {
    try {
      const n = Number(localStorage.getItem("job-radar:detail-width"));
      return n >= 520 && n <= 760 ? n : "40%";
    } catch {
      return "40%";
    }
  });
  const size = useRef(520);
  const pane = useRef<HTMLElement>(null);
  useEffect(() => {
    pane.current
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
  }, []);
  return (
    <ResizablePanelGroup
      orientation="horizontal"
      className="radar-split"
      style={{ height: "calc(100dvh - 285px)", minHeight: 440 }}
      onLayoutChanged={() => {
        try {
          localStorage.setItem(
            "job-radar:detail-width",
            String(Math.round(size.current)),
          );
        } catch {
          /* Optional UI preference; browsing stays available. */
        }
      }}
    >
      <ResizablePanel id="list" minSize={300}>
        {list}
      </ResizablePanel>
      <ResizableHandle className="split-handle" aria-label="调整详情宽度" />
      <ResizablePanel
        id="detail"
        minSize={520}
        maxSize={760}
        defaultSize={width}
        onResize={(s) => {
          size.current = s.inPixels;
        }}
      >
        <aside
          ref={pane}
          tabIndex={-1}
          className="detail-pane"
          aria-label="岗位预览"
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        >
          <div className="peek-toolbar">
            <span>岗位预览</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="收起详情"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {detail}
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
export function DetailPeek({
  list,
  detail,
  title,
  selected,
  onClose,
}: {
  list: ReactNode;
  detail: ReactNode;
  title: string;
  selected: string;
  onClose: () => void;
}) {
  const desktop = useSyncExternalStore(
    subscribeMedia,
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => false,
  );
  const restoreFocus = () => {
    requestAnimationFrame(() =>
      document.getElementById(`job-${selected}`)?.focus(),
    );
  };
  const close = () => {
    onClose();
    restoreFocus();
  };
  if (!selected) return <div className="browse-list">{list}</div>;
  if (desktop)
    return <DesktopSplit list={list} detail={detail} onClose={close} />;
  return (
    <>
      <div className="browse-list">{list}</div>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="peek-overlay"
          showCloseButton={false}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            restoreFocus();
          }}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <DialogDescription className="sr-only">
            岗位资格与原文证据预览
          </DialogDescription>
          <div className="peek-toolbar">
            <span>岗位预览</span>
            <Button variant="ghost" onClick={close} aria-label="返回岗位列表">
              <X aria-hidden="true" />
              返回列表
            </Button>
          </div>
          {detail}
        </DialogContent>
      </Dialog>
    </>
  );
}
