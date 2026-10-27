import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Water Utility Data Hub",
  description:
    "A governed water-district workspace for quality, leak response and water balance.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
