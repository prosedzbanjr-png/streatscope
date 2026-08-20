import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";

export default function CultureEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<LbPhonePublishToggle mode="culture" /></>;
}
