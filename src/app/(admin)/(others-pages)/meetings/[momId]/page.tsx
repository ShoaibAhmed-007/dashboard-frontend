import { Metadata } from "next";
import MomDetailRoute from "@/components/mom/MomDetailRoute";

export const metadata: Metadata = {
  title: "Meeting",
};

export default function MomDetailRoutePage() {
  return <MomDetailRoute />;
}
