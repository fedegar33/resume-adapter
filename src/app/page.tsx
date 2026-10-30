import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { DesignFrame } from "@/app/design-frame";
import { ResumeWizard } from "@/components/resume-wizard";
import { MasterSkeleton } from "@/components/master-skeleton";
import { assertLocalPageRequest } from "@/lib/resumes/request.server";
import { readActiveMasterId, getMasterSummary } from "@/lib/resumes/presentation.server";
import { ResumeUploadError } from "@/lib/resumes/upload";
import "./wizard.css";

async function MasterWorkspace() {
  await connection();
  if (process.env.NODE_ENV !== "development") return <ResumeWizard enabled={false} initialMaster={null} />;
  try {
    assertLocalPageRequest(new Headers(await headers()));
  } catch { return <ResumeWizard enabled={false} initialMaster={null} />; }
  let master = null;
  let initialError = "";
  try {
    const id = await readActiveMasterId();
    master = id ? await getMasterSummary(id) : null;
  } catch (error) {
    initialError = error instanceof ResumeUploadError ? error.message : "Your master could not be loaded. Check the local Supabase configuration.";
  }
  return <ResumeWizard enabled initialMaster={master} initialError={initialError} />;
}
export default function Home() {
  return <DesignFrame className="wizard-root"><Suspense fallback={<MasterSkeleton />}><MasterWorkspace /></Suspense></DesignFrame>;
}
