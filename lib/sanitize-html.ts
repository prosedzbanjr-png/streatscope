export function sanitizeArticleHtml(value: string) {
  if (typeof window === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach(node => node.remove());
  template.content.querySelectorAll("*").forEach(element => {
    [...element.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const attributeValue = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        (name === "href" && attributeValue.startsWith("javascript:")) ||
        (name === "src" && attributeValue.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
    });
  });
  return template.innerHTML;
}

function normalizeComparableText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

function normalizeReaderText(element: HTMLElement) {
  return normalizeComparableText(element.textContent || "");
}

function hasReaderMedia(element: HTMLElement) {
  return Boolean(element.querySelector("img,video,iframe,svg,hr"));
}

/*
 * Free-text fields are normalized only for layout. We deliberately do NOT
 * deduplicate their text here. The editor is the source of truth: if a
 * paragraph exists there, the reader must render it instead of guessing that
 * it is an accidental copy.
 */
function normalizeFreeTextHtml(element: HTMLElement): string {
  const working = element.cloneNode(true) as HTMLElement;
  working.querySelectorAll(".text-handle,.media-handle,[data-page-sheet]").forEach(node => node.remove());
  working.querySelectorAll<HTMLElement>("[contenteditable]").forEach(node => node.removeAttribute("contenteditable"));

  const lineContainers = new Set(["DIV", "P"]);
  const lines: string[] = [];
  const inline = document.createElement("div");

  const flushInline = () => {
    if (!inline.childNodes.length) return;
    const text = normalizeReaderText(inline);
    lines.push(text || hasReaderMedia(inline) ? inline.innerHTML : "");
    inline.replaceChildren();
  };

  Array.from(working.childNodes).forEach(node => {
    if (node instanceof HTMLElement && lineContainers.has(node.tagName)) {
      flushInline();
      const text = normalizeReaderText(node);
      lines.push(text || hasReaderMedia(node) ? normalizeFreeTextHtml(node) : "");
      return;
    }
    inline.append(node.cloneNode(true));
  });

  flushInline();
  return lines.length ? lines.join("<br>") : working.innerHTML;
}

function removeEmptyReaderParagraphs(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p").forEach(paragraph => {
    if (normalizeReaderText(paragraph) || hasReaderMedia(paragraph)) return;
    paragraph.remove();
  });
}

function containsBlockMarkup(html: string) {
  const holder = document.createElement("div");
  holder.innerHTML = html;
  return Boolean(holder.querySelector("h1,h2,h3,h4,h5,h6,p,div,blockquote,ul,ol,pre,figure,table"));
}

function storedRect(node: HTMLElement) {
  const x = Number(node.dataset.readerX);
  const y = Number(node.dataset.readerY);
  const width = Number(node.dataset.readerWidth);
  const height = Number(node.dataset.readerHeight);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
  };
}

function isStoredOverlappingDuplicate(node: HTMLElement, previous: HTMLElement) {
  if (!node.classList.contains("text-block") || !previous.classList.contains("text-block")) return false;

  const nodeText = node.querySelector<HTMLElement>(".free-text");
  const previousText = previous.querySelector<HTMLElement>(".free-text");
  const fingerprint = normalizeComparableText(nodeText?.textContent || "");
  const previousFingerprint = normalizeComparableText(previousText?.textContent || "");
  if (fingerprint.length < 40 || fingerprint !== previousFingerprint) return false;

  const first = storedRect(node);
  const second = storedRect(previous);
  if (!first || !second) return false;

  if (Math.abs(first.x - second.x) <= 12 && Math.abs(first.y - second.y) <= 12) return true;
  if (first.width === null || first.height === null || second.width === null || second.height === null) return false;

  const overlapWidth = Math.max(0, Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x));
  const overlapHeight = Math.max(0, Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y));
  const overlapArea = overlapWidth * overlapHeight;
  const smallerArea = Math.max(1, Math.min(first.width * first.height, second.width * second.height));
  return overlapArea / smallerArea >= 0.8;
}

export function toReaderArticleHtml(value: string) {
  if (typeof window === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  const canvas = template.content.querySelector<HTMLElement>(".article-layout") || template.content;
  canvas.querySelectorAll("[data-page-sheet],.text-handle,.media-handle").forEach(node => node.remove());

  const clearLayout = (element: HTMLElement) => {
    element.removeAttribute("data-reader-x");
    element.removeAttribute("data-reader-y");
    element.removeAttribute("data-reader-width");
    element.removeAttribute("data-reader-height");
    element.removeAttribute("data-layout");
    [
      "position", "left", "right", "top", "bottom", "width", "height", "min-height", "max-height",
      "margin", "margin-left", "margin-right", "margin-top", "margin-bottom", "float", "clear", "transform", "z-index",
    ].forEach(property => element.style.removeProperty(property));
  };

  const children = Array.from(canvas.children) as HTMLElement[];
  const ordered = children
    .map((node, index) => ({ node, index, y: Number(node.dataset.readerY) }))
    .sort((a, b) => {
      const aY = Number.isFinite(a.y) ? a.y : Number.MAX_SAFE_INTEGER;
      const bY = Number.isFinite(b.y) ? b.y : Number.MAX_SAFE_INTEGER;
      return aY === bY ? a.index - b.index : aY - bY;
    });

  const output = document.createElement("div");
  const keptTextBlocks: HTMLElement[] = [];

  ordered.forEach(({ node }) => {
    if (node.classList.contains("text-block")) {
      /*
       * Legacy drafts may contain two identical draggable fields literally on
       * top of each other. Remove only that measurable case. Never remove a
       * paragraph merely because the same text appears somewhere else.
       */
      if (keptTextBlocks.some(previous => isStoredOverlappingDuplicate(node, previous))) return;
      keptTextBlocks.push(node);

      const text = node.querySelector<HTMLElement>(".free-text");
      if (!text || (!text.textContent?.trim() && !hasReaderMedia(text))) return;

      const normalizedHtml = normalizeFreeTextHtml(text);
      if (containsBlockMarkup(normalizedHtml)) {
        const block = document.createElement("div");
        block.className = "reader-text-block";
        block.innerHTML = normalizedHtml;
        clearLayout(block);
        block.querySelectorAll<HTMLElement>("*").forEach(clearLayout);
        output.append(block);
      } else {
        const paragraph = document.createElement("p");
        paragraph.innerHTML = normalizedHtml;
        clearLayout(paragraph);
        output.append(paragraph);
      }
      return;
    }

    const copy = node.cloneNode(true) as HTMLElement;
    clearLayout(copy);
    copy.querySelectorAll<HTMLElement>("*").forEach(clearLayout);
    output.append(copy);
  });

  removeEmptyReaderParagraphs(output);
  return sanitizeArticleHtml(output.innerHTML);
}
