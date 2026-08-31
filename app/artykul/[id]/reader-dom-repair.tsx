"use client";

import { useEffect } from "react";
import { dedupeArticleTextBlocks } from "../../../lib/dedupe-article-body";

const BUILD = "R10-GLOBAL-DEDUPE";

export default function ReaderDomRepair() {
  useEffect(() => {
    document.documentElement.dataset.ssReaderRepair = BUILD;

    let scheduled = false;
    const repair = () => {
      scheduled = false;
      document.querySelectorAll<HTMLElement>(".article-rich").forEach(root => {
        const before = root.innerHTML;
        const after = dedupeArticleTextBlocks(before);
        if (after !== before) root.innerHTML = after;
      });
    };

    const scheduleRepair = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(repair);
    };

    scheduleRepair();
    const observer = new MutationObserver(scheduleRepair);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
