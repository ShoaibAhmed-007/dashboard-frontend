import MyLearning from "@/components/university/MyLearning";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Learning | Dashboard University",
};

export default function MyLearningPage() {
  return <MyLearning />;
}
