const FANZA_API_URL_PATTERN =
  /https?:\/\/api\.dmm\.com\/affiliate\/v3\/[^\s"'<>]*/gi;
const FANZA_CREDENTIAL_PATTERN =
  /(?:api_id|affiliate_id)\s*=\s*[^\s&"'<>]*/gi;

export function sanitizeFanzaLogValue(value: unknown): unknown {
  const sensitiveValues = [
    process.env.DMM_API_ID,
    process.env.DMM_AFFILIATE_ID,
  ].filter((sensitiveValue): sensitiveValue is string => !!sensitiveValue);

  if (typeof value === "string") {
    const withoutUrls = value.replaceAll(
      FANZA_API_URL_PATTERN,
      "[FANZA_API_URL_REDACTED]"
    );
    const withoutCredentials = withoutUrls.replaceAll(
      FANZA_CREDENTIAL_PATTERN,
      "[FANZA_API_CREDENTIAL_REDACTED]"
    );

    return sensitiveValues.reduce(
      (sanitizedValue, sensitiveValue) =>
        sanitizedValue.replaceAll(sensitiveValue, "[REDACTED]"),
      withoutCredentials
    );
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeFanzaLogValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) => key !== "api_id" && key !== "affiliate_id"
        )
        .map(([key, nestedValue]) => [
          key,
          sanitizeFanzaLogValue(nestedValue),
        ])
    );
  }

  return value;
}

export function getSafeFanzaError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: sanitizeFanzaLogValue(
      error instanceof Error ? error.message : String(error)
    ),
  };
}

type FanzaSearchFailure = {
  api: "GenreSearch" | "SeriesSearch" | "MakerSearch";
  error?: unknown;
  initial?: string;
  offset?: number;
  status: number | null;
};

export function logFanzaSearchFailure({
  api,
  error,
  initial,
  offset,
  status,
}: FanzaSearchFailure) {
  console.error(`${api} failed:`, {
    api,
    status,
    initial,
    offset,
    ...(error === undefined ? {} : { error: getSafeFanzaError(error) }),
  });
}
