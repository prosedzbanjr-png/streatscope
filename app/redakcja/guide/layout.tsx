import type { ReactNode } from "react";
import LbPhonePublishToggle from "../lb-phone-publish-toggle";
import ReviewDiscordNotifier from "../review-discord-notifier";
import HiddenPreviewButton from "../hidden-preview-button";

export default function GuideEditorLayout({ children }: { children: ReactNode }) {
  return <>{children}<HiddenPreviewButton mode="guide" /><ReviewDiscordNotifier mode="guide" /><LbPhonePublishToggle mode="guide" /></>;
}
