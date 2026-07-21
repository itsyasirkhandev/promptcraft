// Use CLERK_FRONTEND_API_URL from env if set, otherwise fall back to the Clerk
// JWT issuer URL (a public, static value per Clerk instance). The fallback is
// necessary because preview deployments created in CI don't inherit project-level
// env defaults during the deploy step's auth config validation.
const clerkUrl = process.env.CLERK_FRONTEND_API_URL;
const domain = clerkUrl || "https://brave-dory-72.clerk.accounts.dev";

const authConfig = {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
export default authConfig;
