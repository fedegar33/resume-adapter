import { spawn } from "node:child_process";

const image = "pdf2htmlex/pdf2htmlex@sha256:83899e54f842fda9ca531aea6f30342b0cab4933a246dfc336d63b3e696c9990";
const child = spawn(process.env.PDF2HTMLEX_DOCKER_PATH || "docker", ["pull", "--platform", "linux/amd64", image], { stdio: "inherit" });
child.on("error", () => { console.error("Install/start Docker Desktop and ensure docker is on PATH."); process.exitCode = 1; });
child.on("close", (code) => { process.exitCode = code ?? 1; });
