import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { ClientRoot } from "@/components/layout/client-root";

export const metadata: Metadata = {
  title: "NFS Manager v3",
  description: "NFS share management",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");var d=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");document.documentElement.classList.toggle("dark",d==="dark");}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script src="/env.js" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans`}>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
