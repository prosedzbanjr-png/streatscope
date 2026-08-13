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
      paragraph.innerHTML = text.innerHTML;
      clearLayout(paragraph);
      output.append(paragraph);
      return;
    }
    const copy = node.cloneNode(true) as HTMLElement;
    clearLayout(copy);
    copy.querySelectorAll<HTMLElement>("*").forEach(clearLayout);
    output.append(copy);
  });
  return sanitizeArticleHtml(output.innerHTML);
}
