"use client";

import { wizardStyles } from "@/components/wizard-styles";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { MasterThumbnail } from "@/components/pdf/master-thumbnail";
import { processResumeFile, type UploadedResume, type ProcessingPhase } from "@/lib/resumes/process.client";
import { masterSummarySchema, type MasterSummary } from "@/lib/resumes/master";

type Step = "boot" | "welcome" | "processing" | "sections" | "ready";
function Arrow({ back = false }: { back?: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={back ? "size-4 shrink-0 rotate-180" : "size-4 shrink-0"}><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Check() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 10 3.2 3.2L15 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function DocumentMark() {
  return <svg aria-hidden="true" viewBox="0 0 32 36" fill="none"><path d="M7 2h13l7 7v24H7V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M20 2v8h7M12 17h10M12 22h10M12 27h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function message(error: unknown) {
  return error instanceof Error && error.message !== "Failed to fetch" ? error.message : "Connection lost. Please try again.";
}

export function ResumeWizard({ enabled, initialMaster, initialError = "" }: { enabled: boolean; initialMaster: MasterSummary | null; initialError?: string }) {
  const [step, setStep] = useState<Step>(initialError ? "boot" : initialMaster ? "ready" : "welcome");
  const [master, setMaster] = useState<MasterSummary | null>(initialMaster);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<UploadedResume | null>(null);
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  const [phase, setPhase] = useState<ProcessingPhase>("uploading");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selected = Object.values(choices).filter(Boolean).length;

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [step]);

  function goTo(next: Step) {
    clearTimeout(timer.current);
    setLeaving(true);
    setNotice("");
    timer.current = setTimeout(() => { setStep(next); setLeaving(false); }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 70 : 130);
  }
  function cancel() {
    setDraft(null); setError(""); setChoices({}); goTo(master ? "ready" : "welcome");
  }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setPhase("uploading"); goTo("processing");
    try {
      const resume = await processResumeFile(file, setPhase);
      setDraft(resume);
      setChoices(Object.fromEntries(resume.metadata.sections.map(section => [section.id, true])));
      goTo("sections");
    } catch (error) { setError(message(error)); goTo(master ? "ready" : "welcome"); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!draft || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    const content = { metadata: draft.metadata, html: draft.html, permissions: draft.metadata.sections.map(section => ({ sectionId: section.id, adaptable: choices[section.id] === true })) };
    try {
      const response = await fetch("/api/master-resume/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, expectedActiveId: master?.id ?? null }) });
      const result = await response.json();
      if (!response.ok || result.confirmed !== true) throw new Error(result.error || "Your master could not be confirmed.");
      setMaster(masterSummarySchema.parse(result.master));
      setLocalFile(draft.file);
      setDraft(null); goTo("ready");
    } catch (error) { setError(message(error)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const stepNumber = step === "sections" ? "02" : step === "ready" ? "03" : "01";
  const processing = phase === "uploading" ? 0 : phase === "analyzing" ? 1 : 2;
  const labels = ["Uploading PDF", "Reading sections", "Preparing preview"];
  const saved = master;
  const count = saved?.adaptableCount ?? 0;
  return <div className={wizardStyles.shell}>
    <header className={wizardStyles.header}><span className={wizardStyles.wordmark}><DocumentMark />Resume Adapter</span><span className="flex items-center gap-[11px] text-[10px] tracking-[.06em] text-[#8b8881] tabular-nums [&>span:first-child]:text-wizard-accent" aria-label={`Step ${Number(stepNumber)} of 3`}><span>{stepNumber}</span><span className="h-px w-7 bg-[#d8d5cd]" />03</span></header>
    <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" aria-label="Choose master resume PDF" onChange={upload} disabled={!enabled || busy || leaving || step === "boot"} />
    <main className={wizardStyles.main} aria-busy={busy || leaving}>
      <div key={step} className={`wizard-scene w-full ${step === "sections" ? "wizard-sections max-w-[460px]" : ""}${leaving ? " is-leaving" : ""}`} inert={leaving}>
        {step === "boot" && <section className="mx-auto max-w-[480px] text-center [&>button]:mt-[26px] ">
          <h1 ref={headingRef} tabIndex={-1}>Your master resume</h1>
          <p className="mt-3.5 text-xs leading-[1.6] wrap-anywhere text-wizard-muted" role="status">{error ? "Master unavailable." : "Opening…"}</p>
          {error && <button className={wizardStyles.button} onClick={() => window.location.reload()}>Retry<Arrow /></button>}
        </section>}

        {step === "welcome" && <section className="mx-auto max-w-[480px] text-center [&>button]:mt-[26px]">
          <h1 ref={headingRef} tabIndex={-1}>Your master resume</h1>
          <button className={wizardStyles.button} disabled={!enabled || busy} onClick={() => inputRef.current?.click()}>Add resume<Arrow /></button>
          <p className="mt-3.5 text-xs leading-[1.6] wrap-anywhere text-wizard-muted">{enabled ? "PDF · Up to 10 MB" : "Available in local development."}</p>
        </section>}

        {step === "processing" && <section className="mx-auto max-w-[300px] [&>h1]:text-4xl">
          <h1 ref={headingRef} tabIndex={-1}>Preparing your resume</h1>
          <ol className="mt-[26px] list-none p-0 [&_li]:flex [&_li]:min-h-[34px] [&_li]:items-center [&_li]:gap-3 [&_li]:text-xs [&_li]:text-[#8b8881] [&_li]:transition-colors [&_li]:duration-180 motion-reduce:[&_li]:duration-100 [&_li.is-current]:text-[#46453f] [&_li.is-complete]:text-[#46453f]" aria-label="Resume preparation">
            {labels.map((label, index) => <li key={label} className={index < processing ? "is-complete" : index === processing ? "is-current" : ""}>
              <span className="inline-flex size-[17px] items-center justify-center rounded-full border border-[#d9d6ce] in-[.is-current]:border-[#77746b] in-[.is-current]:bg-[#77746b] in-[.is-current]:shadow-[inset_0_0_0_4px_#faf9f6] in-[.is-complete]:border-[#e2dfd7] in-[.is-complete]:bg-[#eeece5] [&_svg]:size-[15px]">{index < processing && <Check />}</span>{label}
            </li>)}
          </ol>
          <span className="sr-only" role="status">{labels[processing]}</span>
        </section>}

        {step === "sections" && draft && <section className="mx-auto max-w-[460px] [&>h1]:text-[34px] max-[740px]:[&>h1]:text-[32px]">
          <button className="mb-6 inline-flex min-h-11 items-center gap-[7px] text-xs text-wizard-muted hover:text-wizard-ink" onClick={cancel} disabled={busy}><Arrow back />Cancel{master ? " replacement" : ""}</button>
          <h1 ref={headingRef} tabIndex={-1}>Choose adaptable sections</h1>
          <p className="mt-[18px] mb-[26px] text-[13px] leading-[1.6] wrap-anywhere [&>span]:mt-0.5 [&>span]:block [&>span]:text-xs [&>span]:text-wizard-muted">{draft.metadata.candidate.name ?? "Name not identified"}<span>{draft.metadata.candidate.role ?? "Role not identified"}</span></p>
          <fieldset className="m-0 min-w-0 border-0 p-0" disabled={busy}>
            <legend className="sr-only">Adaptable sections</legend>
            <div className="border-t border-wizard-rule">
              {draft.metadata.sections.map(section => <label key={section.id} className={`group/section flex min-h-14 cursor-pointer items-center justify-between gap-5 border-b border-wizard-rule py-[9px] pr-3${choices[section.id] ? " is-selected" : ""}`}>
                <span className="flex min-w-0 flex-col gap-1 wrap-anywhere"><span className="text-[13px] text-wizard-muted transition-colors duration-150 group-[.is-selected]/section:text-wizard-ink motion-reduce:duration-100">{section.title}</span></span>
                <span className="relative size-[18px] shrink-0 [&_svg]:size-4 [&_input]:absolute [&_input]:-inset-3 [&_input]:m-0 [&_input]:size-[42px] [&_input]:cursor-pointer [&_input]:opacity-0 [&>span]:pointer-events-none [&>span]:block [&>span]:size-[18px] [&>span]:rounded-[5px] [&>span]:border [&>span]:border-[#cecbc2] [&>span]:text-transparent [&>span]:transition-colors [&>span]:duration-130 motion-reduce:[&>span]:duration-100 group-hover/section:[&>span]:border-[#838076] [&_input:checked+span]:border-wizard-accent [&_input:checked+span]:bg-wizard-accent [&_input:checked+span]:text-white [&_input:focus-visible+span]:outline-2 [&_input:focus-visible+span]:outline-offset-4 [&_input:focus-visible+span]:outline-[#6d6b64]"><input type="checkbox" checked={choices[section.id] ?? false} onChange={event => setChoices({ ...choices, [section.id]: event.target.checked })} aria-label={`${section.title} adaptable`} /><span aria-hidden="true"><Check /></span></span>
              </label>)}
            </div>
            {!draft.metadata.sections.length && <p className="mt-3.5 text-xs leading-[1.6] wrap-anywhere text-wizard-muted">No sections found. You can still confirm this resume.</p>}
          </fieldset>
          <div className="mt-6 flex items-center justify-between gap-4"><span className="text-[11px] text-wizard-muted tabular-nums" aria-live="polite">{selected} of {draft.metadata.sections.length} selected</span><button className={wizardStyles.button} onClick={confirm} disabled={busy}>{busy ? "Confirming…" : "Confirm master"}<Arrow /></button></div>
        </section>}

        {step === "ready" && saved && <section className={wizardStyles.ready}>
          <div className={wizardStyles.documentArea}>
            <MasterThumbnail key={saved.id} master={saved} localFile={localFile} />
            <div className="mt-2.5 flex flex-wrap justify-center gap-x-[26px] gap-y-2 [&_button]:min-h-11 [&_button]:text-xs [&_button]:text-[#66645d] [&_button:hover]:text-wizard-ink"><button onClick={() => inputRef.current?.click()} disabled={busy}>Replace</button></div>
          </div>
          <div className={wizardStyles.readyCopy}>
            <h1 ref={headingRef} tabIndex={-1}>{saved.candidate.name ?? "Your master resume"}</h1>
            {saved.candidate.role && <p className="mt-[7px] text-[13px] leading-[1.6] wrap-anywhere text-wizard-muted">{saved.candidate.role}</p>}
            <p className="mt-[11px] text-[11px] text-wizard-muted tabular-nums">{count} {count === 1 ? "section" : "sections"} adaptable</p>
            <section className={wizardStyles.adaptations} aria-labelledby="adaptations-title">
              <h2 id="adaptations-title">Create your first adaptation</h2>
              <button className={wizardStyles.button} onClick={() => setNotice("Adaptations are coming next.")}>Create adaptation<Arrow /></button>
              <p className="mt-2 min-h-[18px] max-w-[300px] text-[11px] leading-[1.8] text-wizard-muted max-[740px]:mx-auto" role="status">{notice}</p>
            </section>
          </div>
        </section>}

        {error && <p className="mx-auto mt-6 max-w-[460px] rounded-[9px] bg-[#f6ece7] px-4 py-3 text-xs leading-[1.7] wrap-anywhere text-[#843e32]" role="alert">{error}</p>}
      </div>
    </main>
  </div>;
}
