const clerkUrl = process.env.CLERK_FRONTEND_API_URL;

if (!clerkUrl) {
  throw new Error("Missing CLERK_FRONTEND_API_URL environment variable");
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
