import { Metadata } from "next";
import EditMomRoute from "@/components/mom/EditMomRoute";

export const metadata: Metadata = {
  title: "Edit MOM",
};

export default function EditMomRoutePage() {
  return <EditMomRoute />;
}
