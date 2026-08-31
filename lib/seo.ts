const SITE_URL = "https://avdizin.com";

type CanonicalOptions = {
  page?: string;
  filters?: Record<string, string | undefined>;
};

export function normalizePage(value?: string) {
  const page = Number.parseInt(value || "1", 10);

  return Number.isFinite(page) && page > 1 ? page : 1;
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

  const normalizedPage = normalizePage(page);

  if (normalizedPage > 1) {
    url.searchParams.set("page", String(normalizedPage));
  }

  return url.toString();
}
