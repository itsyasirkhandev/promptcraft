// Clerk JWT issuer URL — hardcoded because it's a public, static value (the
// Clerk instance domain, not a secret). Using process.env here would force
// every preview deployment to have this env var set at deploy time, which
// creates a chicken-and-egg problem (preview deployments don't exist yet
// when env vars need to be set).
const clerkUrl = "https://brave-dory-72.clerk.accounts.dev";

const authConfig = {
  providers: [
    {
      domain: clerkUrl,
      applicationID: "convex",
    },
  ],
};
export default authConfig;
