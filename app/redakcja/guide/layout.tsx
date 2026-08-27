import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";
import ReviewDiscordNotifier from "../review-discord-notifier";

export default function GuideEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<ReviewDiscordNotifier mode="guide" /><LbPhonePublishToggle mode="guide" /></>;
}
