import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0A0F1C] to-[#1F2937] text-[#F3F4F6]">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Galactic Diplomacy
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-300">
            Navigate interstellar politics, forge alliances, and shape the destiny of civilizations
          </p>
          <Link href="/game/new">
            <Button 
              className="bg-[#1E3A8A] px-8 py-6 text-lg font-semibold hover:bg-[#2B4C9F] hover:shadow-lg transition-all duration-200"
            >
              Begin Your Diplomatic Mission
            </Button>
          </Link>
        </div>

        {/* Game Rules */}
        <div className="grid gap-8 md:grid-cols-2">
          <Card className="bg-[#0A0F1C]/50 p-6 backdrop-blur border-[#1E3A8A]/30">
            <h2 className="mb-4 text-2xl font-semibold text-[#60A5FA]">Game Overview</h2>
            <ul className="space-y-3 text-gray-300">
              <li>• You are a planetary diplomat with a unique secret objective</li>
              <li>• Compete and cooperate with 4 AI-controlled civilizations</li>
              <li>• Each civilization has Military Might and Economic Output ratings</li>
              <li>• Your decisions and alliances shape these crucial metrics each round</li>
            </ul>
          </Card>

          <Card className="bg-[#0A0F1C]/50 p-6 backdrop-blur border-[#1E3A8A]/30">
            <h2 className="mb-4 text-2xl font-semibold text-[#60A5FA]">How to Play</h2>
            <ul className="space-y-3 text-gray-300">
              <li>• Each round, engage in diplomatic discussions with any AI civilization</li>
              <li>• Make proposals to form trade agreements, military pacts, or other alliances</li>
              <li>• Gather support from relevant parties to pass your proposals</li>
              <li>• Watch how your decisions affect the galactic balance of power</li>
            </ul>
          </Card>
        </div>

        {/* Feature Highlights */}
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <h3 className="mb-2 text-xl font-semibold text-[#60A5FA]">Dynamic AI</h3>
            <p className="text-gray-300">Each AI civilization has unique personalities and objectives</p>
          </div>
          <div className="text-center">
            <h3 className="mb-2 text-xl font-semibold text-[#60A5FA]">Real-time Strategy</h3>
            <p className="text-gray-300">Your choices have immediate impacts on the galactic landscape</p>
          </div>
          <div className="text-center">
            <h3 className="mb-2 text-xl font-semibold text-[#60A5FA]">Complex Diplomacy</h3>
            <p className="text-gray-300">Navigate intricate negotiations and alliance networks</p>
          </div>
        </div>
      </div>
    </main>
  );
}
