import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";
import ReviewDiscordNotifier from "../review-discord-notifier";
import HiddenPreviewButton from "../hidden-preview-button";

export default function CultureEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<HiddenPreviewButton mode="culture" /><ReviewDiscordNotifier mode="culture" /><LbPhonePublishToggle mode="culture" /></>;
}
