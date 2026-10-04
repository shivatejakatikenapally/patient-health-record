import type { Metadata, Viewport } from "next";
import "./styles/globals.css";

export const metadata: Metadata = {
  title: "PS3 Health Record",
  description: "Patient-held health records with explicit, time-limited consent.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f7f4",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
