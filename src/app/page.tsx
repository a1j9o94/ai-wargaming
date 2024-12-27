import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030712] text-[#F3F4F6]">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A0F1C] to-transparent" />
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      
      <div className="relative container mx-auto px-4 py-24">
        {/* Hero Section */}
        <div className="mb-24 text-center">
          <div className="inline-block mb-6">
            <span className="px-3 py-1 text-sm font-medium rounded-full bg-[#1E3A8A]/20 text-[#60A5FA] border border-[#1E3A8A]/30">
              v1.0 Beta Release
            </span>
          </div>
          <h1 className="mb-6 text-6xl font-bold tracking-tight sm:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-[#60A5FA] to-[#F3F4F6]">
            Galactic Diplomacy
          </h1>
          <p className="mx-auto mb-12 max-w-2xl text-xl text-gray-400 leading-relaxed">
            Navigate interstellar politics, forge alliances, and shape the destiny of civilizations in this AI-driven diplomatic simulation
          </p>
          <Link href="/game/new">
            <Button 
              className="group relative px-8 py-6 text-lg font-semibold bg-[#1E3A8A] hover:bg-[#2B4C9F] transition-all duration-300"
            >
              <span className="relative z-10">Begin Your Diplomatic Mission</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-0 bg-gradient-to-r from-[#60A5FA]/20 to-transparent" />
              </div>
            </Button>
          </Link>
        </div>

        {/* Game Rules */}
        <div className="grid gap-8 md:grid-cols-2 mb-24">
          <Card className="group relative overflow-hidden bg-[#0A0F1C]/80 p-8 backdrop-blur-sm border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <h2 className="relative mb-6 text-2xl font-semibold text-[#60A5FA]">Game Overview</h2>
            <ul className="relative space-y-4 text-gray-300">
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>You are a planetary diplomat with a unique secret objective</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Compete and cooperate with 4 AI-controlled civilizations</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Each civilization has Military Might and Economic Output ratings</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Your decisions and alliances shape these crucial metrics each round</span>
              </li>
            </ul>
          </Card>

          <Card className="group relative overflow-hidden bg-[#0A0F1C]/80 p-8 backdrop-blur-sm border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <h2 className="relative mb-6 text-2xl font-semibold text-[#60A5FA]">How to Play</h2>
            <ul className="relative space-y-4 text-gray-300">
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Each round, engage in diplomatic discussions with any AI civilization</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Make proposals to form trade agreements, military pacts, or other alliances</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Gather support from relevant parties to pass your proposals</span>
              </li>
              <li className="flex items-start">
                <span className="mr-3 text-[#60A5FA]">•</span>
                <span>Watch how your decisions affect the galactic balance of power</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="grid gap-8 md:grid-cols-3">
          <div className="group relative p-6 rounded-lg bg-[#0A0F1C]/50 border border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
            <h3 className="relative mb-3 text-xl font-semibold text-[#60A5FA]">Dynamic AI</h3>
            <p className="relative text-gray-400">Each AI civilization has unique personalities and objectives that evolve with your interactions</p>
          </div>
          <div className="group relative p-6 rounded-lg bg-[#0A0F1C]/50 border border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
            <h3 className="relative mb-3 text-xl font-semibold text-[#60A5FA]">Real-time Strategy</h3>
            <p className="relative text-gray-400">Your choices have immediate impacts on the galactic landscape, requiring careful tactical thinking</p>
          </div>
          <div className="group relative p-6 rounded-lg bg-[#0A0F1C]/50 border border-[#1E3A8A]/20 hover:border-[#1E3A8A]/40 transition-colors duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg" />
            <h3 className="relative mb-3 text-xl font-semibold text-[#60A5FA]">Complex Diplomacy</h3>
            <p className="relative text-gray-400">Navigate intricate negotiations and alliance networks in your quest for galactic influence</p>
          </div>
        </div>
      </div>
    </main>
  );
}
