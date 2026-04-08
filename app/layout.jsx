import "./globals.css";

export const metadata = {
  title: "Fresh Takes — Pocket FM",
  description: "Weekly releases, POD output, and production at a glance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
