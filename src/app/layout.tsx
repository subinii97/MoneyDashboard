import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";

const interInput = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Money Dashboard",
    description: "Personal Asset Management Dashboard",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={interInput.className}>
                <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
                    <Navbar />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
