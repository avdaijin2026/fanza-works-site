const SITE_URL = "https://avdizin.com";
export const MAX_PUBLIC_PAGE = 100;

export type PageParam = string | string[] | undefined;

export type PageValidation =
  | { status: "valid"; page: number }
  | { status: "invalid" }
  | { status: "out-of-range" };

/** Strictly validates a public pagination parameter without numeric coercion. */
export function validatePage(value: PageParam): PageValidation {
  if (value === undefined) {
    return { status: "valid", page: 1 };
  }

  if (Array.isArray(value) || typeof value !== "string" || value.length === 0) {
    return { status: "invalid" };
  }

  if (!/^[1-9][0-9]*$/.test(value)) {
    return { status: "invalid" };
  }

  if (value.length > 3 || Number(value) > MAX_PUBLIC_PAGE) {
    return { status: "out-of-range" };
  }

  return { status: "valid", page: Number(value) };
}

type CanonicalOptions = {
  page?: PageParam;
  filters?: Record<string, string | undefined>;
};

export function normalizePage(value?: string) {
  const validation = validatePage(value);
  const page = validation.status === "valid" ? validation.page : 1;

  return page > 1 ? page : 1;
}

export function createCanonicalUrl(
  pathname: string,
  { page, filters = {} }: CanonicalOptions = {}
) {
  const url = new URL(pathname, SITE_URL);

  for (const [name, value] of Object.entries(filters)) {
    const normalizedValue = value?.trim();

    if (normalizedValue) {
      url.searchParams.set(name, normalizedValue);
    }
  }

  const pageValidation = validatePage(page);
  const normalizedPage =
    pageValidation.status === "valid" ? pageValidation.page : 1;

  if (normalizedPage > 1) {
    url.searchParams.set("page", String(normalizedPage));
  }

  return url.toString();
}
