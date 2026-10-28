import { UploadMasterResume } from "@/components/upload-master-resume";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Resume Adapter</h1>
      <p className="mt-4 max-w-lg text-pretty text-slate-600">
        Start with your master resume. Upload the original PDF to keep it ready for the next steps.
      </p>
      <UploadMasterResume enabled={process.env.NODE_ENV === "development"} />
    </main>
  );
}
