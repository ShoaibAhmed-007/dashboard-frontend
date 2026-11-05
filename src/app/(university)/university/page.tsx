import UniversityDashboard from "@/components/university/UniversityDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Dashboard University",
};

export default function UniversityDashboardPage() {
  return <UniversityDashboard />;
}
