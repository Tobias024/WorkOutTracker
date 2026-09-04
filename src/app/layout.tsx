// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WOLF — WorkOut, Logs & Friends",
  description: "Creá rutinas, registrá tus entrenamientos y competí con amigos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WOLF",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica la paleta elegida (localStorage) antes del primer paint,
            para evitar el flash del tema oscuro al recargar. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("wot-theme")==="girly"){document.documentElement.dataset.theme="girly";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#f6ebe1")}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
