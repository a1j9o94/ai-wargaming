'use client';

import { type User } from "next-auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface UserNavProps {
  user: User;
}

export function UserNav({ user }: UserNavProps) {
  const initials = user.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase() ?? '?';

  return (
    <div className="flex items-center gap-4">
      <Link href="/game">
        <Button variant="ghost" className="text-sm font-medium text-[#60A5FA] hover:text-[#60A5FA]/80 hover:bg-[#1E3A8A]/20">
          Current Mission
        </Button>
      </Link>
      <Link href="/settings">
        <Button variant="ghost" className="text-sm font-medium text-[#60A5FA] hover:text-[#60A5FA]/80 hover:bg-[#1E3A8A]/20">
          Command Settings
        </Button>
      </Link>
      <Link href="/logout">
        <Button variant="ghost" className="text-sm font-medium text-[#60A5FA] hover:text-[#60A5FA]/80 hover:bg-[#1E3A8A]/20">
          Logout
        </Button>
      </Link>
      <div className="h-8 w-8 rounded-full bg-[#1E3A8A]/50 flex items-center justify-center text-[#60A5FA] border border-[#1E3A8A]">
        {initials}
      </div>
    </div>
  );
} 