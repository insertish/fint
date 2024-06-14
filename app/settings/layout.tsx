import Link from "next/link";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-row p-8 gap-8">
      <div>
        <ul className="menu bg-base-200 w-56 rounded-box">
          <h2 className="menu-title">Settings</h2>
          <li>
            <Link href="/settings">My Accounts</Link>
          </li>
          <li>
            <Link href="/settings/link">Link Bank Accounts</Link>
          </li>
          <li>
            <Link href="/settings/import">Manual Import</Link>
          </li>
        </ul>
      </div>

      <div className="flex-grow">{children}</div>
    </div>
  );
}
