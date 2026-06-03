"use client";

import { ReactNode, useEffect } from "react";
import { ConvexProviderWithAuth, ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import useFirebaseAuth from "@/hooks/useFirebaseAuth";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function UserSyncTrigger() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const syncUser = useMutation(api.authed.users.getOrCreateUser);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      void syncUser().catch((err) => {
        console.error("Failed to sync user to Convex:", err);
      });
    }
  }, [isAuthenticated, isLoading, syncUser]);

  return null;
}

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useFirebaseAuth}>
      <UserSyncTrigger />
      {children}
    </ConvexProviderWithAuth>
  );
}

