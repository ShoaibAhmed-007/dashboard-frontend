import { Metadata } from "next";
import MomPage from "@/components/mom/MomPage";

export const metadata: Metadata = {
  title: "Meetings & MOM",
};

/**
 * Minutes of Meeting. At `/meetings` rather than `/mom` so the URL reads as
 * the thing rather than the acronym.
 */
export default function MeetingsRoutePage() {
  return <MomPage />;
}
