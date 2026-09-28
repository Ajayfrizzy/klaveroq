export function emailAppUrl(environment: Record<string, string | undefined> = process.env) {
  const url = new URL(
    environment.APP_URL ?? (environment.NODE_ENV === "production" ? "" : "http://127.0.0.1:3000"),
  );
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Invalid APP_URL.");
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("APP_URL requires HTTPS.");
  return url.origin;
}

export function emailDestination(path: string) {
  const origin = emailAppUrl();
  const url = new URL(path, origin);
  if (url.origin !== origin || url.username || url.password)
    throw new Error("Email link must use APP_URL.");
  return url.toString();
}

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function validEmailSender(value: string | undefined) {
  return Boolean(
    value && !/[\r\n]/.test(value) && /^(?:[^<>]+ <)?[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>?$/.test(value),
  );
}

export function emailTemplate(title: string, body: string, href: string, action = "Open Klaveroq") {
  const url = emailDestination(href);
  return {
    subject: title.replace(/[\r\n]/g, " ").slice(0, 200),
    text: `Klaveroq\n\n${title}\n\n${body}\n\n${action}: ${url}\n\nThis is an account notification from Klaveroq.`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f8fafc;color:#182230;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:560px;margin:24px auto;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px"><p style="color:#4338ca;font-size:22px;font-weight:bold">Klaveroq</p><h1 style="font-size:24px">${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><p><a style="display:inline-block;padding:12px 20px;background:#4338ca;color:#fff;border-radius:6px" href="${escapeHtml(url)}">${escapeHtml(action)}</a></p><p style="font-size:14px">If the button does not work, open <a href="${escapeHtml(url)}">this Klaveroq link</a>.</p><p style="font-size:12px;color:#475467">This is an account notification from Klaveroq.</p></main></body></html>`,
  };
}
