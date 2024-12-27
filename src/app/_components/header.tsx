import Link from "next/link";
import { auth } from "~/server/auth";
import { UserNav } from "./user-nav";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1E3A8A]/30 bg-[#030712]/80 backdrop-blur supports-[backdrop-filter]:bg-[#030712]/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2"
          >
            <div className="h-8 w-8 rounded bg-[#1E3A8A] flex items-center justify-center">
              <span className="text-lg font-bold text-[#60A5FA]">GD</span>
            </div>
            <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#60A5FA] to-[#F3F4F6]">
              Galactic Diplomacy
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {session ? (
              <UserNav user={session.user} />
            ) : (
              <Link href="/api/auth/signin">
                <Button 
                  className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                >
                  Begin Mission
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
} 