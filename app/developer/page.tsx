import { redirect } from "next/navigation";

/** The Profile dropdown links to /developer; PIT Key is the section landing page. */
export default function DeveloperPage() {
    redirect("/developer/api-key");
}
