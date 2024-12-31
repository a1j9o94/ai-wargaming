"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  console.log(session, status);

  useEffect(() => {
    // Only redirect if we're sure there's no session and loading is complete
    if (status === "unauthenticated") {
      // Add a small delay to prevent immediate redirects during hydration
      const redirectTimer = setTimeout(() => {
        const currentPath = window.location.pathname;
        const callbackUrl = encodeURIComponent(`${window.location.origin}${currentPath}`);
        router.replace(`/login?callbackUrl=${callbackUrl}`);
      }, 100);

      return () => clearTimeout(redirectTimer);
    }
  }, [status, router]);

  // Show loading state while checking session
  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-t-[#60A5FA] border-[#1E3A8A]/30 animate-spin" />
          <p className="text-[#60A5FA]">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // If we have a session, render children
  if (status === "authenticated") {
    return <>{children}</>;
  }

  // If no session and not loading, render nothing (redirect will happen)
  return null;
} 