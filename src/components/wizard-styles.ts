// Shared Tailwind recipes keep the SSR skeleton and hydrated layout aligned.
export const wizardStyles = {
  shell: "flex min-h-svh flex-col px-10 max-[740px]:px-6",
  header: "mx-auto flex h-[88px] w-full max-w-[1040px] shrink-0 items-center justify-between max-[740px]:h-[76px]",
  wordmark: "inline-flex items-center gap-[9px] text-sm font-medium tracking-[-.4px] [&_svg]:h-[22px] [&_svg]:w-[18px] [&_svg]:text-[#77756e]",
  ready: "mx-auto grid max-w-[720px] grid-cols-[210px_minmax(0,1fr)] items-center gap-[88px] text-left max-[740px]:flex max-[740px]:max-w-[420px] max-[740px]:flex-col max-[740px]:gap-0 max-[740px]:text-center",
  documentArea: "m-0 w-[210px] shrink-0 p-0 max-[740px]:w-[180px]",
  readyCopy: "m-0 w-full min-w-0 max-[740px]:mt-[26px]",

  main: "mx-auto flex w-full max-w-[1040px] flex-1 items-center justify-center pt-11 pb-24 has-[.wizard-sections]:pt-8 has-[.wizard-sections]:pb-16 max-[740px]:pt-10 max-[740px]:pb-16 max-[740px]:has-[.wizard-sections]:pt-6 max-[740px]:has-[.wizard-sections]:pb-12",
  button: "inline-flex min-h-11 items-center justify-center gap-[22px] rounded-[9px] border border-transparent bg-wizard-accent px-[18px] text-xs leading-[1.2] font-medium text-white transition-[background-color,transform] duration-150 hover:bg-[#41413d] active:scale-96 motion-reduce:transition-colors motion-reduce:duration-100 motion-reduce:active:scale-100",
  adaptations: "mt-[22px] border-t border-wizard-rule pt-[26px] max-[740px]:mt-[18px] max-[740px]:pt-6 [&>h2]:font-display [&>h2]:text-[28px] [&>h2]:leading-[1.15] [&>h2]:font-normal [&>h2]:tracking-[-.02em] [&>h2]:text-balance max-[740px]:[&>h2]:text-[26px] [&>button]:mt-5",
} as const;
