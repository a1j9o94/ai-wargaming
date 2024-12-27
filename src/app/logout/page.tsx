"use client";

import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

function LogoutContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  return (
    <div className="w-full max-w-md space-y-8 rounded-lg bg-[#0A0F1C]/80 p-8 text-center shadow-xl backdrop-blur-sm border border-[#1E3A8A]/30">
      <div className="mb-8">
        <div className="mx-auto h-12 w-12 rounded bg-[#1E3A8A]/20 flex items-center justify-center border border-[#1E3A8A]/30">
          <span className="text-xl font-bold text-[#60A5FA]">!</span>
        </div>
      </div>
      
      <h2 className="text-2xl font-bold text-[#60A5FA]">End Mission</h2>
      <p className="text-gray-400">Confirm mission termination and return to command center?</p>
      
      <div className="mt-8 flex flex-col gap-4">
        <Button
          onClick={() => signOut({ callbackUrl })}
          className="w-full bg-[#DC2626] hover:bg-[#DC2626]/90 text-white"
        >
          Confirm Exit
        </Button>
        
        <Button
          onClick={() => window.location.href = callbackUrl}
          variant="outline"
          className="w-full border-[#1E3A8A]/30 bg-[#1E3A8A]/10 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
        >
          Return to Mission
        </Button>
      </div>
    </div>
  );
}

export default function LogoutPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center bg-[#030712]">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1C] to-transparent" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      
      <Suspense fallback={
        <div className="relative w-full max-w-md space-y-8 rounded-lg bg-[#0A0F1C]/80 p-8 text-center shadow-xl backdrop-blur-sm border border-[#1E3A8A]/30">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-t-[#60A5FA] border-[#1E3A8A]/30 animate-spin" />
          <p className="text-[#60A5FA]">Initializing...</p>
        </div>
      }>
        <div className="relative">
          <LogoutContent />
        </div>
      </Suspense>
    </div>
  );
}
