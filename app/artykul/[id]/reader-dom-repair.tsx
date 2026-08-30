"use client";

import { useEffect } from "react";

const BUILD = "R5";

function normalizeVisibleText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

function mediaInside(element: HTMLElement) {
  return Boolean(element.querySelector("img,video,iframe,svg"));
}

function hasDirectTextBlockChild(element: HTMLElement) {
  return Array.from(element.children).some(child => {
    const tag = child.tagName;
    return tag === "P" || tag === "H1" || tag === "H2" || tag === "H3" || tag === "BLOCKQUOTE" || tag === "LI" || tag === "DIV";
  });
}

function leafBlocks(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("p,h1,h2,h3,blockquote,li,div")).filter(element => {
    if (element.tagName !== "DIV") return true;
    return !hasDirectTextBlockChild(element);
  });
}

function collapseRepeatedText(element: HTMLElement) {
  if (mediaInside(element)) return;
  const raw = (element.innerText || element.textContent || "").replace(/\r\n?/g, "\n").trim();
  const normalized = normalizeVisibleText(raw);
  if (normalized.length < 120) return;

  // Exact A+A repetition after whitespace/zero-width normalization.
  if (normalized.length % 2 === 0) {
    const half = normalized.length / 2;
    if (normalized.slice(0, half) === normalized.slice(half)) {
      const words = raw.split(/\s+/).filter(Boolean);
      const wordHalf = Math.floor(words.length / 2);
      if (wordHalf >= 10) element.textContent = words.slice(0, wordHalf).join(" ");
      return;
    }
  }

  // CEF may insert a slightly different separator between both copies. Find
  // the second occurrence by a substantial prefix instead of trusting markup.
  const prefixLength = Math.min(90, Math.max(60, Math.floor(normalized.length / 4)));
  const prefix = normalized.slice(0, prefixLength);
  const repeatAt = normalized.indexOf(prefix, prefixLength);
  if (repeatAt >= 80) {
    const first = normalizeVisibleText(normalized.slice(0, repeatAt));
    const second = normalizeVisibleText(normalized.slice(repeatAt));
    if (first === second) {
      const visiblePrefix = raw.slice(0, Math.max(0, Math.floor(raw.length / 2))).trim();
      element.textContent = visiblePrefix;
    }
  }
}

function repairReaderDom() {
  const root = document.querySelector<HTMLElement>(".article-content");
  if (!root) return;

  const blocks = leafBlocks(root);
  blocks.forEach(collapseRepeatedText);

  // Compare the final text that CEF actually paints. This intentionally works
  // outside .article-rich too, so a malformed block moved by the WebView is
  // still caught.
  const seen = new Map<string, HTMLElement>();
  leafBlocks(root).forEach(block => {
    if (!block.isConnected || mediaInside(block)) return;
    const fingerprint = normalizeVisibleText(block.innerText || block.textContent || "");
    if (fingerprint.length < 100) return;
    const previous = seen.get(fingerprint);
    if (previous?.isConnected) {
      block.remove();
      return;
    }
    seen.set(fingerprint, block);
  });

  root.querySelectorAll<HTMLElement>("p,div").forEach(element => {
    if (!element.textContent?.trim() && !mediaInside(element)) element.remove();
  });

  document.documentElement.dataset.ssReaderRepair = BUILD;
}

export default function ReaderDomRepair() {
  useEffect(() => {
    // Re-run after hydration and after the async view-counter state update.
    const delays = [0, 50, 150, 400, 900, 1600, 3000, 5000];
    const timers = delays.map(delay => window.setTimeout(repairReaderDom, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, []);

  return <span aria-hidden="true" style={{ position: "fixed", right: 5, bottom: 48, zIndex: 2147483647, padding: "2px 4px", background: "#d71920", color: "white", font: "700 8px Arial,sans-serif", lineHeight: 1, opacity: .9, pointerEvents: "none" }}>{BUILD}</span>;
}
