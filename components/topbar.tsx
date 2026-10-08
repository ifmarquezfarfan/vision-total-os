import { AccountMenu } from "@/components/account-menu";

export function Topbar({ title }: { title: string }) {
  return (
    <header className="topbar">
      <strong>{title}</strong>
      <AccountMenu />
    </header>
  );
}
