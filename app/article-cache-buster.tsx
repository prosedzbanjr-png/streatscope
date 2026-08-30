"use client";

import { useEffect } from "react";

const BUILD = "C6";

export function ArticleCacheBuster() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      let url: URL;
      try {
        url = new URL(target.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin || !/^\/artykul\/\d+\/?$/.test(url.pathname)) return;

      event.preventDefault();
      url.searchParams.set("ssfresh", `${BUILD}-${Date.now()}`);
      window.location.assign(url.toString());
    };

    document.addEventListener("click", onClick, true);
    document.documentElement.dataset.ssCacheBuster = BUILD;
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <span
      aria-hidden="true"
      style={{
        position: "fixed",
        right: 4,
        bottom: 82,
        zIndex: 2147483647,
        padding: "2px 4px",
        background: "#111",
        border: "1px solid #d71920",
        color: "#fff",
        font: "700 8px Arial,sans-serif",
        lineHeight: 1,
        opacity: 0.92,
        pointerEvents: "none",
      }}
    >
      {BUILD}
    </span>
  );
}
