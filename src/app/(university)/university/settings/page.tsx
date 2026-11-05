import UniversitySettings from "@/components/university/UniversitySettings";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Dashboard University",
};

export default function UniversitySettingsPage() {
  return <UniversitySettings />;
}
