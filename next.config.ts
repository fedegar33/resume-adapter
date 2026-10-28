import type { NextConfig } from "next";
import { wrapNextjsConfigWithBraintrust } from "braintrust/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["braintrust", "pdfjs-dist"],
};

export default wrapNextjsConfigWithBraintrust(nextConfig);
