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
