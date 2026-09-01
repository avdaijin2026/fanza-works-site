import { NextResponse, type NextRequest } from "next/server";
import { validatePage } from "@/lib/seo";

const idPattern = /^\d+$/;
const redirectTargets = {
  actress: "/actresses",
  genre: "/genres",
  series: "/series",
  maker: "/makers",
  label: "/labels",
} as const;

type RedirectKey = keyof typeof redirectTargets;

function hasOnlyAllowedQueries(
  searchParams: URLSearchParams,
  redirectKey: RedirectKey
) {
  const allowedKeys = new Set([redirectKey, `${redirectKey}_name`, "page", "sort"]);

  for (const key of searchParams.keys()) {
    if (!allowedKeys.has(key)) {
      return false;
    }

    if (searchParams.getAll(key).length > 1) {
      return false;
    }
  }

  return true;
}

export function proxy(request: NextRequest) {
  const { nextUrl } = request;

  if (nextUrl.pathname !== "/") {
    return NextResponse.next();
  }

  const searchParams = nextUrl.searchParams;
  const presentRedirectKeys = Object.keys(redirectTargets).filter((key) =>
    searchParams.has(key)
  ) as RedirectKey[];

  if (presentRedirectKeys.length !== 1) {
    return NextResponse.next();
  }

  const redirectKey = presentRedirectKeys[0];
  const id = searchParams.get(redirectKey) || "";

  if (!idPattern.test(id) || !hasOnlyAllowedQueries(searchParams, redirectKey)) {
    return NextResponse.next();
  }

  const pageValidation = validatePage(searchParams.get("page") ?? undefined);
  if (pageValidation.status !== "valid") {
    return NextResponse.next();
  }

  const destination = nextUrl.clone();
  destination.pathname = `${redirectTargets[redirectKey]}/${encodeURIComponent(id)}`;
  destination.search = "";

  const page = searchParams.get("page");
  const sort = searchParams.get("sort");

  if (pageValidation.page > 1) {
    destination.searchParams.set("page", String(pageValidation.page));
  }

  if (sort) {
    destination.searchParams.set("sort", sort);
  }

  return NextResponse.redirect(destination, 301);
}

export const config = {
  matcher: "/",
};
