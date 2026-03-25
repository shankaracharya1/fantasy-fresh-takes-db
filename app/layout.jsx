import { Manrope, Sora } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

export const metadata = {
  title: "Fresh takes dashboard",
  description: "Pocket FM fresh takes planning and production dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable}`}>{children}</body>
    </html>
  );
}
