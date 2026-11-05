import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | Dashboard",
  description: "Create your Dashboard account",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
