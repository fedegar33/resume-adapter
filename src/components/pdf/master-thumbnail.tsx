"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import * as Dialog from "@radix-ui/react-dialog";
import type { MasterSummary } from "@/lib/resumes/master";

const MasterPdfPages = lazy(() => import("@/components/pdf/master-pdf-pages"));
/* SHARED PDF STORYBOARD
 * 0ms click: expand the first-page image from its thumbnail; fade overlay in.
 * 350ms: settle, crossfade to rendered PDF when ready; vertical scroll stays local.
 * close: reverse to the stationary thumbnail; reduced motion uses opacity only.
 */
const VIEWER = { layout: { type: "spring" as const, duration: .35, bounce: 0.2 }, fade: { duration: .16 }, prefetchDelay: 150 };

export function MasterThumbnail({ master, localFile }: { master: MasterSummary; localFile: File | null }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [portal, setPortal] = useState<HTMLElement | undefined>(undefined);
  const [pdfReady, setPdfReady] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pending = useRef<Promise<File> | null>(null);
  const controller = useRef<AbortController | null>(null);
  const reduced = useReducedMotion();
  const markPdfReady = useCallback(() => setPdfReady(true), []);
  const getFile = useCallback((): Promise<File> => {
    if (localFile) return Promise.resolve(localFile);
    if (!pending.current) {
      if (!controller.current || controller.current.signal.aborted) controller.current = new AbortController();
      pending.current = fetch(master.pdfUrl, { headers: { "X-Resume-Reader": "1" }, signal: controller.current.signal })
        .then(async response => {
          if (!response.ok) throw new Error("PDF unavailable.");
          return new File([await response.blob()], master.filename, { type: "application/pdf" });
        }).catch(error => { pending.current = null; throw error; });
    }
    return pending.current;
  }, [localFile, master.pdfUrl, master.filename]);
  useEffect(() => {
    if (imageRef.current?.complete && imageRef.current.naturalWidth) setLoaded(true);
    return () => { controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!loaded) return;
    // Image first; PDF is intentionally lower priority, cached by HTTP and this promise.
    const idle = window.requestIdleCallback?.(() => { void getFile().catch(() => {}); }, { timeout: 1500 });
    const timer = idle === undefined ? setTimeout(() => { void getFile().catch(() => {}); }, VIEWER.prefetchDelay) : undefined;
    return () => { if (idle !== undefined) window.cancelIdleCallback(idle); clearTimeout(timer); };
  }, [loaded, getFile]);
  const sharedId = reduced ? undefined : `paper-${master.id}`;
  const ratio = master.preview.width / master.preview.height;
  return <LayoutGroup id={`master-${master.id}`}><Dialog.Root open={open} onOpenChange={next => { if (next) { setPortal(triggerRef.current?.closest(".wizard-root") as HTMLElement | undefined); setPdfReady(false); } setOpen(next); }}>
    <figure className="relative m-0 [&_figcaption]:mt-4 [&_figcaption]:flex [&_figcaption]:items-center [&_figcaption]:justify-center [&_figcaption]:gap-[7px] [&_figcaption]:text-[10px] [&_figcaption]:tracking-[.01em] [&_figcaption]:text-wizard-muted wizard-thumbnail" data-state={loaded ? "ready" : failed ? "error" : "loading"}>
      <div className="wizard-thumbnail-preview"><div className="wizard-thumbnail-hover"><div className="wizard-thumbnail-pop">
        <Dialog.Trigger asChild><motion.button ref={triggerRef} type="button" layoutId={sharedId} transition={{ layout: VIEWER.layout }} className="relative aspect-[612/792] overflow-hidden rounded-2xl bg-white shadow-[0_1px_3px_#00000006,0_12px_30px_#0000000c,0_0_0_1px_#00000008] block w-full cursor-zoom-in select-none border-0 p-0 [-webkit-touch-callout:none]" onDragStart={event => event.preventDefault()} style={{ aspectRatio: 612 / 792, borderRadius: 16 }} aria-label={`Open PDF: ${master.filename}`}>
          {!loaded && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-wizard-muted">{failed ? "Open PDF" : "Loading preview…"}</span>}
          {/* A plain img preserves the private same-origin URL and browser HTTP cache. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imageRef} draggable={false} src={master.preview.url} width={master.preview.width} height={master.preview.height} alt={`First page of ${master.filename}`} fetchPriority="high" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className={`pointer-events-none block size-full object-contain [-webkit-user-drag:none] ${loaded ? "opacity-100" : "opacity-0"}`} />
        </motion.button></Dialog.Trigger>
      </div></div></div>
      <figcaption><span className="truncate" title={master.filename}>{master.filename}</span></figcaption>
    </figure>
    <Dialog.Portal forceMount container={portal}><AnimatePresence>
      {open && <Dialog.Overlay key="overlay" forceMount asChild><motion.div className="fixed inset-0 z-50 bg-[rgb(24_23_21_/_0.35)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={VIEWER.fade} /></Dialog.Overlay>}
      {open && <Dialog.Content key="document" forceMount asChild aria-describedby={undefined} onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
        <motion.div layoutRoot className="fixed inset-0 z-[51] m-auto w-(--viewer-width) h-[min(calc(var(--viewer-width)/var(--pdf-ratio)),calc(100svh-80px))] outline-none [--viewer-width:min(1003.2px,calc((100svh-80px)*var(--pdf-ratio)*1.32),calc(100vw-48px))] max-[740px]:[--viewer-width:min(1003.2px,calc((100svh-80px)*var(--pdf-ratio)*1.32),calc(100vw-24px))]" style={{ "--pdf-ratio": ratio } as CSSProperties} data-pdf-dialog="" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={VIEWER.fade}>
          <Dialog.Title className="sr-only">{master.filename}</Dialog.Title>
          <Dialog.Close className="absolute top-3 right-3 z-2 grid size-10 cursor-pointer place-items-center rounded-full bg-[#faf9f6ed] text-wizard-ink shadow-[0_1px_6px_#00000012] [&_svg]:size-[18px]" aria-label="Close PDF"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></Dialog.Close>
          <motion.div layoutId={sharedId} className="relative size-full overflow-hidden bg-white shadow-[0_20px_70px_#00000026]" style={{ borderRadius: 16 }} transition={{ layout: VIEWER.layout }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={master.preview.url} alt="" width={master.preview.width} height={master.preview.height} className={`pointer-events-none absolute inset-0 size-full object-cover object-top transition-opacity duration-140 ease-[ease] motion-reduce:duration-100 ${pdfReady ? "opacity-0" : "opacity-100"}`} />
            <div className={`absolute inset-0 transition-opacity duration-140 ease-[ease] has-[[role=alert]]:opacity-100 motion-reduce:duration-100 ${pdfReady ? "opacity-100" : "opacity-0"}`}><Suspense fallback={null}><MasterPdfPages getFile={getFile} onReady={markPdfReady} /></Suspense></div>
          </motion.div>
        </motion.div>
      </Dialog.Content>}
    </AnimatePresence></Dialog.Portal>
  </Dialog.Root></LayoutGroup>;
}
