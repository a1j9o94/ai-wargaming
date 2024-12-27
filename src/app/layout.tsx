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
      <body className={`font-sans ${inter.variable} bg-[#030712]`}>
        <Header />
        {children}
      </body>
    </html>
  );
}
