import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { validateResumePdf } from "@/lib/pdf/validate.server";
import { assertLocalUploadRequest, readResumeFile } from "@/lib/resumes/request.server";
import { storeResume } from "@/lib/resumes/store.server";
import { MAX_RESUME_BYTES } from "@/lib/resumes/upload";
import { POST } from "@/app/api/master-resume/route";

// A synthetic, single-page PDF with a real cross-reference table.
function pdfBytes({ encrypted = false, brokenPage = false } = {}) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    brokenPage ? "null" : "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
  ];
  if (encrypted) objects.push(`<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${"00".repeat(32)}> /U <${"00".repeat(32)}> /P -4 >>`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${encrypted ? ` /Encrypt 5 0 R /ID [<${"00".repeat(16)}> <${"00".repeat(16)}>]` : ""} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

const fileFrom = (bytes = pdfBytes(), name = "resume.pdf", type = "application/pdf") => new File([bytes], name, { type });

test("valid PDF opens and original bytes survive PDF.js validation", async () => {
  const bytes = pdfBytes();
  assert.deepEqual(await validateResumePdf(fileFrom(bytes)), bytes);
  // Browser MIME is untrusted and may be absent; real format is authoritative.
  assert.deepEqual(await validateResumePdf(fileFrom(bytes, "CV.PDF", "")), bytes);
});

test("reject empty, oversized, wrong extension, forged PDF, corrupt page, and encrypted PDF", async () => {
  for (const file of [fileFrom(new Uint8Array()), fileFrom(new Uint8Array(MAX_RESUME_BYTES + 1)), fileFrom(pdfBytes(), "cv.txt"), fileFrom(new TextEncoder().encode("plain text")), fileFrom(new TextEncoder().encode("%PDF-1.4\nbroken")), fileFrom(pdfBytes({ brokenPage: true }))]) {
    await assert.rejects(validateResumePdf(file), { name: "ResumeUploadError" });
  }
  await assert.rejects(validateResumePdf(fileFrom(pdfBytes({ encrypted: true }))), /Password-protected/);
});

function localRequest({ url = "http://127.0.0.1:3000/api/master-resume", headers = {}, body } = {}) {
  return new Request(url, { method: "POST", headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", ...headers }, body });
}

test("local gate rejects production, remote hosts, cross-origin and remote forwarded addresses", () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "development";
    assert.doesNotThrow(() => assertLocalUploadRequest(localRequest()));
    for (const request of [localRequest({ url: "https://example.com/api/master-resume" }), localRequest({ headers: { origin: "https://example.com" } }), localRequest({ headers: { host: "example.com" } }), localRequest({ headers: { "x-forwarded-for": "203.0.113.1" } }), localRequest({ headers: { "sec-fetch-site": "cross-site" } })]) {
      assert.throws(() => assertLocalUploadRequest(request), { status: 403 });
    }
    process.env.NODE_ENV = "production";
    assert.throws(() => assertLocalUploadRequest(localRequest()), { status: 403 });
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("multipart parser accepts exactly one file and rejects malformed or oversized bodies", async () => {
  const body = new FormData();
  body.set("file", fileFrom());
  assert.equal((await readResumeFile(localRequest({ body }))).name, "resume.pdf");
  body.append("file", fileFrom());
  await assert.rejects(readResumeFile(localRequest({ body })), /exactly one/);
  const textForm = new FormData();
  textForm.set("file", "not a File");
  await assert.rejects(readResumeFile(localRequest({ body: textForm })), /exactly one/);
  await assert.rejects(readResumeFile(localRequest({ body: "invalid", headers: { "content-type": "multipart/form-data; boundary=missing" } })), /could not be read/);
  await assert.rejects(readResumeFile(localRequest({ body: new Uint8Array(MAX_RESUME_BYTES + 65537), headers: { "content-type": "multipart/form-data; boundary=x" } })), { status: 413 });
});

function supabaseMock({ publicBucket = false, uploadFails = false, insertFails = false, cleanupFails = false, ambiguousInsert = false } = {}) {
  const calls = [];
  const rows = [];
  const client = createClient("https://supabase.invalid", "test-secret", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ url, method, body: init?.body, headers: init?.headers });
      if (url.endsWith("/bucket/resumes")) return Response.json({ id: "resumes", name: "resumes", public: publicBucket });
      if (url.includes("/rest/v1/master_resume_uploads")) {
        if (ambiguousInsert) return Response.json({ message: "response lost" }, { status: 503 });
        if (insertFails) return Response.json({ message: "database unavailable", code: "42501" }, { status: 403 });
        rows.push(JSON.parse(init.body));
        return new Response(null, { status: 201 });
      }
      if (method === "DELETE") return Response.json(cleanupFails ? { message: "failed", statusCode: "500" } : [], { status: cleanupFails ? 500 : 200 });
      if (url.includes("/object/resumes/masters/")) return Response.json(uploadFails ? { message: "failed", statusCode: "400" } : { Key: "stored" }, { status: uploadFails ? 400 : 200 });
      throw new Error(`Unexpected mock request: ${method} ${url}`);
    } },
  });
  return { client, calls, rows };
}

test("successful uploads preserve metadata and same-named files get separate paths", async () => {
  const { client, calls, rows } = supabaseMock();
  const file = fileFrom();
  const first = await storeResume(client, "resumes", file, pdfBytes());
  const second = await storeResume(client, "resumes", file, pdfBytes());
  assert.equal(first.filename, file.name);
  assert.notEqual(first.id, second.id);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].storage_path, rows[1].storage_path);
  assert.equal(rows[0].original_filename, file.name);
  assert.equal(rows[0].size_bytes, file.size);
  assert.equal(rows[0].mime_type, "application/pdf");
  assert.equal(rows[0].storage_path, `masters/${first.id}.pdf`);
  assert.equal(calls.some((call) => call.method === "DELETE"), false);
});

test("refuse a public bucket and do not insert after a Storage failure", async () => {
  for (const options of [{ publicBucket: true }, { uploadFails: true }]) {
    const { client, calls, rows } = supabaseMock(options);
    await assert.rejects(storeResume(client, "resumes", fileFrom(), pdfBytes()));
    assert.equal(rows.length, 0);
    assert.equal(calls.some((call) => call.url.includes("/rest/v1/")), false);
    if (options.publicBucket) assert.equal(calls.length, 1);
  }
});

test("failed DB insert removes only its uploaded object; failed cleanup is surfaced", async (context) => {
  const log = context.mock.method(console, "error", () => {});
  for (const cleanupFails of [false, true]) {
    const { client, calls } = supabaseMock({ insertFails: true, cleanupFails });
    await assert.rejects(storeResume(client, "resumes", fileFrom(), pdfBytes()), cleanupFails ? /cleanup failed/ : /file was removed/);
    const upload = calls.find((call) => call.url.includes("/object/resumes/masters/"));
    const deletion = calls.find((call) => call.method === "DELETE");
    const { prefixes } = JSON.parse(deletion.body);
    assert.deepEqual(prefixes, [upload.url.split("/object/resumes/")[1]]);
  }
  assert.equal(log.mock.calls.length, 1);
});

test("an ambiguous insert response never deletes a potentially referenced PDF", async () => {
  const { client, calls } = supabaseMock({ ambiguousInsert: true });
  await assert.rejects(storeResume(client, "resumes", fileFrom(), pdfBytes()), /could not be confirmed/);
  assert.equal(calls.some((call) => call.method === "DELETE"), false);
});

test("POST validates before external access and reports success only after both writes", async (context) => {
  const envNames = ["NODE_ENV", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_STORAGE_BUCKET"];
  const previous = envNames.map((key) => process.env[key]);
  const { client, rows, calls } = supabaseMock();
  // Reuse the mock client's HTTP transport: no real HTTP calls are permitted.
  context.mock.method(globalThis, "fetch", client.fetch);
  try {
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "https://supabase.invalid";
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    process.env.SUPABASE_STORAGE_BUCKET = "resumes";
    const invalid = new FormData();
    invalid.set("file", fileFrom(new TextEncoder().encode("renamed text")));
    assert.equal((await POST(localRequest({ body: invalid }))).status, 400);
    assert.equal(calls.length, 0);

    const valid = new FormData();
    valid.set("file", fileFrom());
    const response = await POST(localRequest({ body: valid }));
    assert.equal(response.status, 201);
    assert.equal((await response.json()).filename, "resume.pdf");
    assert.equal(rows.length, 1);

    process.env.NODE_ENV = "production";
    const before = calls.length;
    assert.equal((await POST(localRequest({ body: valid }))).status, 403);
    assert.equal(calls.length, before);
  } finally {
    envNames.forEach((key, i) => {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    });
  }
});
