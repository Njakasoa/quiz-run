export type El = HTMLElement;

/** Tiny hyperscript helper (same shape as warzone-games). */
export function h(tag: string, props: Record<string, unknown> = {}, ...kids: (El | string)[]): El {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = String(v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === "html") e.innerHTML = String(v);
    else if (v !== false && v != null) e.setAttribute(k, String(v));
  }
  for (const c of kids) e.append(c);
  return e;
}
