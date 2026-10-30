import type { ReactNode } from "react";
import localFont from "next/font/local";

const garamond = localFont({
  src: [
    { path: "./fonts/eb-garamond.ttf", style: "normal", weight: "400 800" },
  ],
  variable: "--resume-serif",
  display: "swap",
});
const instrument = localFont({ src: "./fonts/instrument-sans.ttf", weight: "400 700", variable: "--resume-sans", display: "swap" });

export function DesignFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div lang="en" className={`${garamond.variable} ${instrument.variable} bg-wizard-bg text-wizard-ink font-ui antialiased [&_button]:cursor-pointer [&_button:disabled]:cursor-default [&_button:disabled]:opacity-50 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-[5px] [&_button:focus-visible]:outline-[#6d6b64] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-[5px] [&_a:focus-visible]:outline-[#6d6b64] [&_h1]:m-0 [&_h1]:font-display [&_h1]:text-[38px] [&_h1]:leading-[1.12] [&_h1]:font-normal [&_h1]:tracking-[-.025em] [&_h1]:text-balance [&_h1]:wrap-anywhere [&_h1:focus]:outline-none max-[740px]:[&_h1]:text-[34px] ${className}`}>{children}</div>;
}
