import "./globals.css";

export const metadata = {
  title: "Split-or-Steal Protocol Tools",
  description: "LSL marker dashboard and decision tasks for EEG sessions.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  );
}
