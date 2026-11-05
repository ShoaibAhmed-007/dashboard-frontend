import { Metadata } from "next";
import DepartmentsPage from "@/components/departments/DepartmentsPage";

export const metadata: Metadata = {
  title: "Departments",
};

export default function DepartmentsRoutePage() {
  return <DepartmentsPage />;
}
