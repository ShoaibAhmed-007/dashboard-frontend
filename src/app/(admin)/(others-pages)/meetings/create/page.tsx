import { Metadata } from "next";
import CreateMomPage from "@/components/mom/CreateMomPage";

export const metadata: Metadata = {
  title: "Create MOM",
};

export default function CreateMomRoutePage() {
  return <CreateMomPage />;
}
