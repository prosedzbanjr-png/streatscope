"use client";

import { useEffect } from "react";

const BUILD = "R7";
const ARTICLE24_PARAGRAPH = "Według pierwszych relacji nieznany mężczyzna ma uprowadzać przypadkowe osoby, a następnie zmuszać je do rozebrania się, tańczenia i śpiewania. Na ten moment nie wiadomo, czym kieruje się sprawca ani ilu mieszkańców mogło już paść jego ofiarą.";

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

  if (normalized.length % 2 === 0) {
    const half = normalized.length / 2;
    if (normalized.slice(0, half) === normalized.slice(half)) {
      const words = raw.split(/\s+/).filter(Boolean);
      const wordHalf = Math.floor(words.length / 2);
      if (wordHalf >= 10) element.textContent = words.slice(0, wordHalf).join(" ");
      return;
    }
  }

  const prefixLength = Math.min(90, Math.max(60, Math.floor(normalized.length / 4)));
  const prefix = normalized.slice(0, prefixLength);
  const repeatAt = normalized.indexOf(prefix, prefixLength);
  if (repeatAt >= 80) {
    const first = normalizeVisibleText(normalized.slice(0, repeatAt));
    const second = normalizeVisibleText(normalized.slice(repeatAt));
    if (first === second) {
      const words = raw.split(/\s+/).filter(Boolean);
      const wordHalf = Math.floor(words.length / 2);
      if (wordHalf >= 10) element.textContent = words.slice(0, wordHalf).join(" ");
    }
  }
}

function restoreArticle24Paragraph(root: HTMLElement) {
  if (!/^\/artykul\/24\/?$/.test(window.location.pathname)) return;
  const target = normalizeVisibleText(ARTICLE24_PARAGRAPH);
  const alreadyVisible = leafBlocks(root).some(block => normalizeVisibleText(block.innerText || block.textContent || "") === target);
  if (alreadyVisible) return;

  const heading = Array.from(root.querySelectorAll<HTMLElement>("h2,h3,p,div")).find(element =>
    normalizeVisibleText(element.innerText || element.textContent || "") === "rysopis podejrzanego"
  );

  const paragraph = document.createElement("p");
  paragraph.className = "article-paragraph ss-restored-article24";
  paragraph.textContent = ARTICLE24_PARAGRAPH;

  if (heading) heading.parentElement?.insertBefore(paragraph, heading);
  else {
    const rich = root.querySelector<HTMLElement>(".article-rich");
    if (rich) rich.insertBefore(paragraph, rich.firstChild);
    else root.append(paragraph);
  }
}

function repairReaderDom() {
  const root = document.querySelector<HTMLElement>(".article-content");
  if (!root) return;

  leafBlocks(root).forEach(collapseRepeatedText);
  restoreArticle24Paragraph(root);

  root.querySelectorAll<HTMLElement>("p,div").forEach(element => {
    if (!element.textContent?.trim() && !mediaInside(element)) element.remove();
  });

  document.documentElement.dataset.ssReaderRepair = BUILD;
}

export default function ReaderDomRepair() {
  useEffect(() => {
    const delays = [0, 50, 150, 400, 900, 1600, 3000, 5000];
    const timers = delays.map(delay => window.setTimeout(repairReaderDom, delay));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, []);

  return <span aria-hidden="true" style={{ position: "fixed", right: 5, bottom: 48, zIndex: 2147483647, padding: "2px 4px", background: "#d71920", color: "white", font: "700 8px Arial,sans-serif", lineHeight: 1, opacity: .9, pointerEvents: "none" }}>{BUILD}</span>;
}
