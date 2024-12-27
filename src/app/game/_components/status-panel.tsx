import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface StatusPanelProps {
  name: string;
  title: string;
  might: number;
  economy: number;
}

export function StatusPanel({ name, title, might, economy }: StatusPanelProps) {
  return (
    <Card className="bg-[#0A0F1C]/80 border-[#1E3A8A]/20 p-6 flex-shrink-0">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#60A5FA] mb-1">{name}</h2>
          <p className="text-sm text-gray-400">{title}</p>
        </div>
        <Button 
          variant="outline" 
          className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA] hover:text-[#60A5FA]"
        >
          View Objectives
        </Button>
      </div>

      {/* Status Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-sm text-gray-400 mb-1">Military Might</div>
          <div className="h-2 bg-[#1E3A8A]/20 rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-[#60A5FA] to-[#1E3A8A] rounded-full" 
              style={{ width: `${might}%` }}
            />
          </div>
          <div className="text-right text-sm text-[#60A5FA] mt-1">{might}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400 mb-1">Economic Output</div>
          <div className="h-2 bg-[#1E3A8A]/20 rounded-full">
            <div 
              className="h-full bg-gradient-to-r from-[#60A5FA] to-[#1E3A8A] rounded-full" 
              style={{ width: `${economy}%` }}
            />
          </div>
          <div className="text-right text-sm text-[#60A5FA] mt-1">{economy}</div>
        </div>
      </div>
    </Card>
  );
} 