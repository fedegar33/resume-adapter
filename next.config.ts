import type { NextConfig } from "next";
import { wrapNextjsConfigWithBraintrust } from "braintrust/next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["braintrust"],
};

export default wrapNextjsConfigWithBraintrust(nextConfig);
