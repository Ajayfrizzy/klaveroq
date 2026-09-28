import type { APIRequestContext } from "@playwright/test";

// Production cookies are Secure. Browser loopback requests support them, but
// Playwright's API client needs an explicit Cookie header on the HTTP harness.
export function sessionRequest(request: APIRequestContext): APIRequestContext {
  return new Proxy(request, {
    get(target, property) {
      if (["get", "post", "patch", "delete"].includes(String(property))) {
        return async (url: string, options: Parameters<APIRequestContext["get"]>[1] = {}) => {
          const cookie = (await target.storageState()).cookies
            .map((item) => item.name + "=" + item.value)
            .join("; ");
          return target[property as "get"](url, {
            ...options,
            headers: { ...options.headers, Cookie: cookie },
          });
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
