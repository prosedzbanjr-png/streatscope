"use client";

import { useEffect } from "react";

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

function collapseRepeatedVisibleText(element: HTMLElement) {
  if (mediaInside(element)) return;
  const visible = (element.innerText || element.textContent || "").replace(/\r\n?/g, "\n").trim();
  if (visible.length < 120) return;

  const lines = visible.split(/\n+/).map(line => line.trim()).filter(Boolean);
  if (lines.length >= 2 && lines.length % 2 === 0) {
    const half = lines.length / 2;
    const first = lines.slice(0, half).map(normalizeVisibleText);
    const second = lines.slice(half).map(normalizeVisibleText);
    if (first.every((line, index) => line === second[index]) && first.join(" ").length >= 80) {
      element.textContent = lines.slice(0, half).join("\n");
      return;
    }
  }

  const words = visible.split(/\s+/).filter(Boolean);
  if (words.length < 20 || words.length % 2 !== 0) return;
  const half = words.length / 2;
  const first = words.slice(0, half);
  const second = words.slice(half);
  const equal = first.every((word, index) => normalizeVisibleText(word) === normalizeVisibleText(second[index] || ""));
  if (equal && normalizeVisibleText(first.join(" ")).length >= 80) {
    element.textContent = first.join(" ");
  }
}

function readerLeafBlocks(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("p,h2,h3,blockquote,div")).filter(element => {
    if (element.tagName !== "DIV") return true;
    return !element.querySelector(":scope > p,:scope > h2,:scope > h3,:scope > blockquote,:scope > div");
  });
}

function repairReaderDom() {
  const root = document.querySelector<HTMLElement>(".article-rich");
  if (!root) return;

  readerLeafBlocks(root).forEach(collapseRepeatedVisibleText);

  const blocks = readerLeafBlocks(root);
  const seen = new Map<string, HTMLElement>();
  let previousFingerprint = "";

  blocks.forEach(block => {
    if (!block.isConnected || mediaInside(block)) return;
    const fingerprint = normalizeVisibleText(block.innerText || block.textContent || "");
    if (!fingerprint) return;

    // Short labels/headings are allowed to repeat. Long editorial blocks are not.
    if (fingerprint.length >= 70 && fingerprint === previousFingerprint) {
      block.remove();
      return;
    }

    if (fingerprint.length >= 110) {
      const earlier = seen.get(fingerprint);
      if (earlier?.isConnected) {
        block.remove();
        return;
      }
      seen.set(fingerprint, block);
    }

    previousFingerprint = fingerprint;
  });

  root.querySelectorAll<HTMLElement>("p,div").forEach(element => {
    if (!element.textContent?.trim() && !mediaInside(element)) element.remove();
  });

  document.documentElement.dataset.ssReaderRepair = "20260830-2";
}

export default function ReaderDomRepair() {
  useEffect(() => {
    const timers = [0, 40, 150, 500, 1200, 2500].map(delay => window.setTimeout(repairReaderDom, delay));
    let framePending = false;
    const observer = new MutationObserver(() => {
      if (framePending) return;
      framePending = true;
      window.requestAnimationFrame(() => {
        framePending = false;
        repairReaderDom();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const stopObserver = window.setTimeout(() => observer.disconnect(), 5000);
    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
      window.clearTimeout(stopObserver);
      observer.disconnect();
    };
  }, []);

  return null;
}
