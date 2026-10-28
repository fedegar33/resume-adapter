import { ResumeWorkspace } from "@/components/resume-workspace";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-screen-2xl px-5 py-12 sm:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Resume Adapter</h1>
      <p className="mt-4 max-w-lg text-pretty text-slate-600">
        Upload your master resume, then review its content alongside the original PDF.
      </p>
      <ResumeWorkspace enabled={process.env.NODE_ENV === "development"} />
    </main>
  );
}
