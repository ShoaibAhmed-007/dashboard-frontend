import UniversityLayoutClient from "./UniversityLayoutClient";
import React from "react";

export default function UniversityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <UniversityLayoutClient>{children}</UniversityLayoutClient>;
}
