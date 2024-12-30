"use client";

import { signIn } from "next-auth/react";
import { FaDiscord } from "react-icons/fa";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <div className="w-full max-w-md space-y-8 rounded-lg bg-[#0A0F1C]/80 p-8 shadow-xl backdrop-blur-sm border border-[#1E3A8A]/30">
      <div className="text-center space-y-2">
        <div className="mx-auto h-16 w-16 rounded bg-[#1E3A8A]/20 flex items-center justify-center border border-[#1E3A8A]/30 mb-6">
          <span className="text-2xl font-bold text-[#60A5FA]">GD</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#60A5FA] to-[#F3F4F6]">
          Command Center Access
        </h2>
        <p className="text-sm text-gray-400">
          Authenticate your credentials to begin your diplomatic mission
        </p>
      </div>

      <div className="space-y-4">
        <Button
          onClick={() => signIn("discord", { callbackUrl })}
          variant="outline"
          className="relative w-full h-12 border-[#1E3A8A]/30 bg-[#1E3A8A]/10 hover:bg-[#1E3A8A]/20 text-[#60A5FA] group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#1E3A8A]/0 via-[#1E3A8A]/5 to-[#1E3A8A]/0 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex items-center justify-center gap-3">
            <FaDiscord className="h-5 w-5" />
            <span>Access via Discord Protocol</span>
          </div>
        </Button>
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">
        By accessing the system, you acknowledge and accept the{" "}
        <a href="/terms" className="text-[#60A5FA] hover:text-[#60A5FA]/80">
          Galactic Code of Conduct
        </a>{" "}
        and{" "}
        <a href="/privacy" className="text-[#60A5FA] hover:text-[#60A5FA]/80">
          Data Protection Protocols
        </a>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center">
      <Suspense fallback={
        <div className="relative w-full max-w-md space-y-8 rounded-lg bg-[#0A0F1C]/80 p-8 text-center shadow-xl backdrop-blur-sm border border-[#1E3A8A]/30">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-t-[#60A5FA] border-[#1E3A8A]/30 animate-spin" />
          <p className="text-[#60A5FA]">Initializing Authentication Protocols...</p>
        </div>
      }>
        <div className="relative">
          <LoginContent />
        </div>
      </Suspense>
    </div>
  );
}
