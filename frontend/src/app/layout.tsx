import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers/providers"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: "NeuroStack AI",
    template: "%s | NeuroStack AI",
  },
  description: "AI Chat powered by NeuroStack.",
  keywords: ["NeuroStack AI", "AI Chat", "Knowledge AI", "RAG", "Document AI"],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}