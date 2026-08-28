import Advertisement from "@/components/Advertisement";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Advertisement position="top" />
      <main>{children}</main>
      <Advertisement position="bottom" />
    </>
  );
}
