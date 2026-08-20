import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";

export default function MaterialEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<LbPhonePublishToggle mode="article" /></>;
}
