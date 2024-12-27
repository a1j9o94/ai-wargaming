import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function GamePage() {
  // Server-side auth check
  const session = await auth();
  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Placeholder data - will be replaced with real game state
  const opponents = [
    { id: 1, name: "Centauri Republic", avatar: "/avatars/centauri.jpg", status: "Active", might: 85, economy: 92 },
    { id: 2, name: "Sirius Confederation", avatar: "/avatars/sirius.jpg", status: "Active", might: 78, economy: 88 },
    { id: 3, name: "Proxima Alliance", avatar: "/avatars/proxima.jpg", status: "Active", might: 95, economy: 75 },
    { id: 4, name: "Vega Dominion", avatar: "/avatars/vega.jpg", status: "Active", might: 89, economy: 83 },
  ];

  const gameLog = [
    { time: "08:45:23", event: "Centauri Republic proposes trade agreement with Sirius Confederation" },
    { time: "08:43:12", event: "Vega Dominion increases military presence in neutral zone" },
    { time: "08:40:00", event: "Your proposal for joint research initiative accepted by Proxima Alliance" },
    // Add more log entries as needed
  ];

  return (
    <div className="fixed inset-0 bg-[#030712]">
      <main className="h-screen overflow-hidden text-[#F3F4F6]">
        <div className="h-full grid grid-cols-4 gap-4 p-4">
          {/* Left Panel - Opponent Grid */}
          <div className="col-span-2 flex flex-col space-y-4 h-full overflow-hidden">
            <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto">
              {opponents.map((opponent) => (
                <Card key={opponent.id} className="relative bg-[#0A0F1C]/80 border-[#1E3A8A]/20 overflow-hidden group min-h-[200px] flex flex-col">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  
                  {/* Status Indicator */}
                  <div className="absolute top-2 right-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>

                  {/* Avatar and Info */}
                  <div className="p-3 relative flex flex-col flex-1">
                    <div className="w-full aspect-[16/9] bg-[#1E3A8A]/20 rounded-lg mb-2 flex items-center justify-center">
                      <div className="text-3xl text-[#60A5FA]/30">👤</div>
                    </div>
                    <h3 className="text-base font-semibold text-[#60A5FA] mb-1 truncate">{opponent.name}</h3>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Might:</span>
                        <span className="text-[#60A5FA]">{opponent.might}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Econ:</span>
                        <span className="text-[#60A5FA]">{opponent.economy}</span>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex space-x-2 mt-auto">
                      <Button variant="outline" size="sm" className="flex-1 h-7 px-2 text-xs bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20">
                        Discuss
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 h-7 px-2 text-xs bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20">
                        Propose
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Your Status Panel */}
            <Card className="bg-[#0A0F1C]/80 border-[#1E3A8A]/20 p-6 flex-shrink-0">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#60A5FA] mb-1">Earth Alliance</h2>
                  <p className="text-sm text-gray-400">High Commander</p>
                </div>
                <Button variant="outline" className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20">
                  View Objectives
                </Button>
              </div>

              {/* Status Metrics */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="text-sm text-gray-400 mb-1">Military Might</div>
                  <div className="h-2 bg-[#1E3A8A]/20 rounded-full">
                    <div className="h-full w-4/5 bg-gradient-to-r from-[#60A5FA] to-[#1E3A8A] rounded-full" />
                  </div>
                  <div className="text-right text-sm text-[#60A5FA] mt-1">80</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400 mb-1">Economic Output</div>
                  <div className="h-2 bg-[#1E3A8A]/20 rounded-full">
                    <div className="h-full w-3/4 bg-gradient-to-r from-[#60A5FA] to-[#1E3A8A] rounded-full" />
                  </div>
                  <div className="text-right text-sm text-[#60A5FA] mt-1">75</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Game Log */}
          <Card className="col-span-2 bg-[#0A0F1C]/80 border-[#1E3A8A]/20 p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h2 className="text-xl font-semibold text-[#60A5FA]">Diplomatic Log</h2>
              <div className="flex items-center space-x-2">
                <div className="text-sm text-gray-400">Galactic Time:</div>
                <div className="font-mono text-[#60A5FA]">08:45:23</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
              {gameLog.map((log, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-[#1E3A8A]/5 border border-[#1E3A8A]/10">
                  <div className="text-sm font-mono text-[#60A5FA]/70">{log.time}</div>
                  <div className="flex-1 text-gray-300">{log.event}</div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex space-x-4 flex-shrink-0">
              <Button className="flex-1 bg-[#1E3A8A] hover:bg-[#2B4C9F]">New Proposal</Button>
              <Button variant="outline" className="flex-1 bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20">
                View History
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
} 