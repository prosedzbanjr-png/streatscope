export function sanitizeArticleHtml(value: string) {
  if (typeof window === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  template.content.querySelectorAll("script,style,iframe,object,embed,form,input,button").forEach(node => node.remove());
  template.content.querySelectorAll("*").forEach(element => {
    [...element.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase(); const value = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || name === "srcdoc" || (name === "href" && value.startsWith("javascript:")) || (name === "src" && value.startsWith("javascript:"))) element.removeAttribute(attribute.name);
    });
  });
  return template.innerHTML;
}

function normalizeReaderText(element: HTMLElement) {
  return (element.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

function hasReaderMedia(element: HTMLElement) {
  return Boolean(element.querySelector("img,video,iframe,svg,hr"));
}

/**
 * contentEditable is inconsistent between Chromium/CEF builds. A single Enter
 * may be saved as <div>next line</div>, while another build saves <br>. Wrapping
 * that raw markup in a reader <p> creates nested flow blocks and LB Phone can
 * render one paragraph break as two. Flatten only editor-generated DIV/P line
 * containers to <br>, preserving inline formatting such as spans, links, bold
 * and custom font styles.
 */
function normalizeFreeTextHtml(element: HTMLElement): string {
  const lineContainers = new Set(["DIV", "P"]);
  const lines: string[] = [];
  const inline = document.createElement("div");

  const flushInline = () => {
    if (!inline.childNodes.length) return;
    const text = normalizeReaderText(inline);
    lines.push(text || hasReaderMedia(inline) ? inline.innerHTML : "");
    inline.replaceChildren();
  };

  Array.from(element.childNodes).forEach(node => {
    if (node instanceof HTMLElement && lineContainers.has(node.tagName)) {
      flushInline();
      const text = normalizeReaderText(node);
      lines.push(text || hasReaderMedia(node) ? normalizeFreeTextHtml(node) : "");
      return;
    }
    inline.append(node.cloneNode(true));
  });

  flushInline();
  return lines.length ? lines.join("<br>") : element.innerHTML;
}

function removeEmptyReaderParagraphs(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("p").forEach(paragraph => {
    if (normalizeReaderText(paragraph) || hasReaderMedia(paragraph)) return;
    paragraph.remove();
  });
}

/**
 * Older editor saves can contain the same visible section twice: once as
 * freely-positioned canvas blocks and once as ordinary document-flow nodes.
 * Desktop styling can make those copies overlap, while LB Phone lays them out
 * one after another. Remove only substantial, immediately repeated runs so a
 * deliberate short repeated phrase is left untouched.
 */
function removeAdjacentDuplicateRuns(root: HTMLElement) {
  let removedSomething = true;

  while (removedSomething) {
    removedSomething = false;
    const nodes = Array.from(root.children) as HTMLElement[];
    const fingerprints = nodes.map(normalizeReaderText);

    duplicateSearch:
    for (let start = 0; start < nodes.length; start += 1) {
      const maxLength = Math.floor((nodes.length - start) / 2);

      for (let length = maxLength; length >= 1; length -= 1) {
        const first = fingerprints.slice(start, start + length);
        const second = fingerprints.slice(start + length, start + length * 2);
        if (!first.length || first.some(value => !value)) continue;
        if (!first.every((value, index) => value === second[index])) continue;

        const combinedLength = first.join(" ").length;
        if (length === 1 && combinedLength < 120) continue;
        if (length > 1 && combinedLength < 80) continue;

        nodes.slice(start + length, start + length * 2).forEach(node => node.remove());
        removedSomething = true;
        break duplicateSearch;
      }
    }
  }
}

/**
 * The editor canvas stores drag coordinates to make writing convenient. Those
 * coordinates are not an article layout system and must never be applied to
 * a published story. Convert the canvas markup into a stable reader document.
 */
export function toReaderArticleHtml(value: string) {
  if (typeof window === "undefined") return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  const canvas = template.content.querySelector<HTMLElement>(".article-layout") || template.content;
  canvas.querySelectorAll("[data-page-sheet],.text-handle,.media-handle").forEach(node => node.remove());

  const clearLayout = (element: HTMLElement) => {
    element.removeAttribute("data-reader-x"); element.removeAttribute("data-reader-y");
    element.removeAttribute("data-reader-width"); element.removeAttribute("data-reader-height");
    element.removeAttribute("data-layout");
    ["position", "left", "right", "top", "bottom", "width", "height", "min-height", "max-height", "margin", "margin-left", "margin-right", "margin-top", "margin-bottom", "float", "clear", "transform", "z-index"].forEach(property => element.style.removeProperty(property));
  };

  const children = Array.from(canvas.children) as HTMLElement[];
  const ordered = children.map((node, index) => ({ node, index, y: Number(node.dataset.readerY) })).sort((a, b) => {
    const aY = Number.isFinite(a.y) ? a.y : Number.MAX_SAFE_INTEGER;
    const bY = Number.isFinite(b.y) ? b.y : Number.MAX_SAFE_INTEGER;
    return aY === bY ? a.index - b.index : aY - bY;
  });
  const output = document.createElement("div");
  ordered.forEach(({ node }) => {
    if (node.classList.contains("text-block")) {
      const text = node.querySelector<HTMLElement>(".free-text");
      if (!text || !text.textContent?.trim()) return;
      const paragraph = document.createElement("p");
      paragraph.innerHTML = normalizeFreeTextHtml(text);
      clearLayout(paragraph);
      output.append(paragraph);
      return;
    }
    const copy = node.cloneNode(true) as HTMLElement;
    clearLayout(copy);
    copy.querySelectorAll<HTMLElement>("*").forEach(clearLayout);
    output.append(copy);
  });

  removeEmptyReaderParagraphs(output);
  removeAdjacentDuplicateRuns(output);
  return sanitizeArticleHtml(output.innerHTML);
}
