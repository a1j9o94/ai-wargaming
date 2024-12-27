import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { Header } from "./_components/header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Galactic Diplomacy",
  description: "Navigate interstellar politics, forge alliances, and shape the destiny of civilizations",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable} min-h-screen bg-[#030712] relative`}>
        {/* Fixed Background Elements */}
        <div className="fixed inset-0 bg-gradient-to-b from-[#0A0F1C] to-transparent pointer-events-none" />
        <div className="fixed inset-0 bg-[url('/grid.svg')] opacity-10 pointer-events-none" />
        
        {/* Content */}
        <div className="relative">
          <Header />
          <main className="pt-16">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
