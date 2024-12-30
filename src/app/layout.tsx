import "~/styles/globals.css";

import { Inter } from "next/font/google";
import { TRPCReactProvider } from "~/trpc/react";
import { SessionProvider } from "next-auth/react"
import { Header } from "~/app/_components/header";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "AI Wargame",
  description: "A futuristic military strategy game with AI opponents",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`font-sans ${inter.variable}`}>
        <TRPCReactProvider>
          <SessionProvider>
            <Header />
            {children}
          </SessionProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
