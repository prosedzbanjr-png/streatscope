"use client";

import { useEffect } from "react";

const BUILD = "R9";

/*
 * This component intentionally does not rewrite article text anymore.
 * Paragraph cleanup now happens deterministically while building reader HTML.
 * Mutating the hydrated DOM caused valid paragraphs to disappear after load.
 */
export default function ReaderDomRepair() {
  useEffect(() => {
    document.documentElement.dataset.ssReaderRepair = BUILD;
  }, []);

  return null;
}
