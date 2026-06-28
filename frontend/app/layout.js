import "./globals.css";

export const metadata = {
  title: "CABO Online - Multiplayer Card Game",
  description: "Play the CABO card game online with up to 6 friends. Features real-time play, card actions, matching, and score tracking with a beautiful dark glassmorphic design.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
