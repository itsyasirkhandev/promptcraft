const clerkUrl = process.env.CLERK_FRONTEND_API_URL || process.env.CLERK_JWT_ISSUER_DOMAIN;

if (!clerkUrl) {
  throw new Error("Missing CLERK_FRONTEND_API_URL or CLERK_JWT_ISSUER_DOMAIN environment variable");
}

const authConfig = {
  providers: [
    {
      domain: clerkUrl,
      applicationID: "convex",
    },
  ],
};
export default authConfig;
