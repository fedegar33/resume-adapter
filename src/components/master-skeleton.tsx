import { wizardStyles } from "@/components/wizard-styles";
export function MasterSkeleton() {
  return <div className={wizardStyles.shell} aria-busy="true" aria-label="Loading master resume">
    <header className={wizardStyles.header}><span className={wizardStyles.wordmark}><svg aria-hidden="true" viewBox="0 0 32 36" fill="none"><path d="M7 2h13l7 7v24H7V2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M20 2v8h7M12 17h10M12 22h10M12 27h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>Resume Adapter</span></header>
    <main className={wizardStyles.main}><section className={wizardStyles.ready}>
      <div className={wizardStyles.documentArea}><div className="relative aspect-[612/792] overflow-hidden rounded-2xl bg-[#f0efea]" /><div className="rounded bg-[#eeece6] mx-auto mt-4 h-[15px] w-20" /><div className="rounded bg-[#eeece6] mx-auto mt-[26px] mb-4 h-3 w-[42px]" /></div>
      <div className={wizardStyles.readyCopy}><div className="rounded bg-[#eeece6] h-[42px] w-[78%] max-[740px]:mx-auto max-[740px]:h-[38px]" /><div className="rounded bg-[#eeece6] mt-2 h-5 w-3/5 max-[740px]:mx-auto" /><div className="rounded bg-[#eeece6] mt-[11px] h-[17px] w-[110px] max-[740px]:mx-auto" /><div className={wizardStyles.adaptations}><div className="rounded bg-[#eeece6] h-8 w-[78%] max-[740px]:mx-auto max-[740px]:h-[30px]" /><div className="rounded bg-[#eeece6] mt-5 mb-[26px] h-11 w-[177px] max-[740px]:mx-auto" /></div></div>
    </section></main>
  </div>;
}
