import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";
import ReviewDiscordNotifier from "../review-discord-notifier";

export default function CultureEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<ReviewDiscordNotifier mode="culture" /><LbPhonePublishToggle mode="culture" /></>;
}
