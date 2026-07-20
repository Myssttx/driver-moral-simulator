import "./globals.css";

export const metadata = {
  title: "Driver Moral Simulator",
  description: "Standardized driver moral decision task for EEG sessions.",
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
