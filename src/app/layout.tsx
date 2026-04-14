import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";

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
            <body style={{ fontFeatureSettings: "'tnum' 1, 'cv11' 1" }}>
                <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false}>
                    <Navbar />
                    {children}
                </ThemeProvider>
            </body>
        </html>
    );
}
