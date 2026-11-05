import AccountingRouteGuard from "@/components/accounts/AccountingRouteGuard";
import React from "react";

export default function AccountsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AccountingRouteGuard>{children}</AccountingRouteGuard>;
}
