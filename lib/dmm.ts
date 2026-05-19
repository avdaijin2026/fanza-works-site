export async function getWorks(
  page = 1,
  genreId?: string,
  seriesId?: string,
  makerId?: string,
  actressId?: string,
  labelId?: string,
  keyword?: string
) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = 20;
  const offset = (page - 1) * hits + 1;

  let articleParam = "";

  if (labelId) {
    articleParam = `&article=label&article_id=${labelId}`;
  } else if (actressId) {
    articleParam = `&article=actress&article_id=${actressId}`;
  } else if (makerId) {
    articleParam = `&article=maker&article_id=${makerId}`;
  } else if (seriesId) {
    articleParam = `&article=series&article_id=${seriesId}`;
  } else if (genreId) {
    articleParam = `&article=genre&article_id=${genreId}`;
  }

  const keywordParam = keyword
    ? `&keyword=${encodeURIComponent(keyword)}`
    : "";

  const url =
    `https://api.dmm.com/affiliate/v3/ItemList` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&site=FANZA` +
    `&service=digital` +
    `&floor=videoa` +
    `&hits=${hits}` +
    `&offset=${offset}` +
    `${articleParam}` +
    `${keywordParam}` +
    `&output=json`;

  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error("作品データの取得に失敗しました");
  }

  const json = await res.json();

  const items = json?.result?.items ?? [];
  const totalCount = Number(json?.result?.total_count ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / hits));

  return {
    items,
    totalPages,
    totalCount,
  };
}

export async function getGenres(initial = "あ") {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const url =
    `https://api.dmm.com/affiliate/v3/GenreSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=100` +
    `&offset=1` +
    `&output=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("GenreSearch failed:", initial, res.status, url);
      return [];
    }

    const json = await res.json();
    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.genre)) {
      list = result.genre;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    return list.map((g: any) => ({
      id: String(g.genre_id ?? g.id ?? ""),
      name: String(g.name ?? ""),
    }));
  } catch (error) {
    console.error("GenreSearch error:", initial, error);
    return [];
  }
}

export async function getActresses(page = 1, keyword?: string) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const pageSize = 24;
  const fetchHits = 24;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const keywordParam = keyword
    ? `&keyword=${encodeURIComponent(keyword)}`
    : "";

  const hasImage = (actress: any) => {
    return !!(
      actress?.imageURL?.large ||
      actress?.imageURL?.small ||
      actress?.imageURL?.list
    );
  };

  let offset = 1;
  let rawTotalCount = 0;
  let visibleSeen = 0;
  let actresses: any[] = [];

  const maxLoops = Math.max(20, page * 8);

  try {
    for (let loop = 0; loop < maxLoops; loop++) {
      const url =
        `https://api.dmm.com/affiliate/v3/ActressSearch` +
        `?api_id=${apiId}` +
        `&affiliate_id=${affiliateId}` +
        `&hits=${fetchHits}` +
        `&offset=${offset}` +
        `${keywordParam}` +
        `&output=json`;

      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        console.error("ActressSearch failed:", res.status, url);
        break;
      }

      const json = await res.json();
      const result = json?.result;

      const batch = result?.actress ?? result?.items ?? [];

      rawTotalCount = Number(result?.total_count ?? rawTotalCount ?? 0);

      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      const visibleBatch = batch.filter(hasImage);

      const sliceStart = Math.max(0, startIndex - visibleSeen);
      const sliceEnd = Math.max(0, endIndex - visibleSeen);

      if (sliceStart < visibleBatch.length) {
        actresses.push(...visibleBatch.slice(sliceStart, sliceEnd));
      }

      visibleSeen += visibleBatch.length;

      if (actresses.length >= pageSize) {
        actresses = actresses.slice(0, pageSize);
        break;
      }

      if (rawTotalCount > 0 && offset + fetchHits > rawTotalCount) {
        break;
      }

      offset += fetchHits;
    }

    const totalPages = Math.max(1, Math.ceil(rawTotalCount / fetchHits));

    return {
      actresses,
      totalPages,
      totalCount: rawTotalCount,
    };
  } catch (error) {
    console.error("ActressSearch error:", error);
    return {
      actresses: [],
      totalPages: 1,
      totalCount: 0,
    };
  }
}

export async function getSeries(initial = "あ", page = 1) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = 100;
  const offset = (page - 1) * hits + 1;

  const url =
    `https://api.dmm.com/affiliate/v3/SeriesSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=${hits}` +
    `&offset=${offset}` +
    `&output=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("SeriesSearch failed:", initial, res.status, url);
      return {
        series: [],
        totalCount: 0,
        totalPages: 1,
      };
    }

    const json = await res.json();
    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.series)) {
      list = result.series;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    const series = list.map((s: any) => ({
      id: String(s.series_id ?? s.id ?? ""),
      name: String(s.name ?? ""),
      ruby: String(s.ruby ?? ""),
      listUrl: String(s.list_url ?? s.listURL ?? ""),
    }));

    const totalCount = Number(result?.total_count ?? series.length ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / hits));

    return {
      series,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("SeriesSearch error:", initial, error);
    return {
      series: [],
      totalCount: 0,
      totalPages: 1,
    };
  }
}

export async function getMakers(initial = "あ", page = 1) {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  const hits = 100;
  const offset = (page - 1) * hits + 1;

  const url =
    `https://api.dmm.com/affiliate/v3/MakerSearch` +
    `?api_id=${apiId}` +
    `&affiliate_id=${affiliateId}` +
    `&floor_id=43` +
    `&initial=${encodeURIComponent(initial)}` +
    `&hits=${hits}` +
    `&offset=${offset}` +
    `&output=json`;

  try {
    const res = await fetch(url, { cache: "no-store" });

    if (!res.ok) {
      console.error("MakerSearch failed:", initial, res.status, url);
      return {
        makers: [],
        totalCount: 0,
        totalPages: 1,
      };
    }

    const json = await res.json();
    const result = json?.result;

    let list: any[] = [];

    if (Array.isArray(result)) {
      list = result;
    } else if (Array.isArray(result?.maker)) {
      list = result.maker;
    } else if (Array.isArray(result?.items)) {
      list = result.items;
    }

    const makers = list.map((m: any) => ({
      id: String(m.maker_id ?? m.id ?? ""),
      name: String(m.name ?? ""),
      ruby: String(m.ruby ?? ""),
      listUrl: String(m.list_url ?? m.listURL ?? ""),
    }));

    const totalCount = Number(result?.total_count ?? makers.length ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalCount / hits));

    return {
      makers,
      totalCount,
      totalPages,
    };
  } catch (error) {
    console.error("MakerSearch error:", error);
    return {
      makers: [],
      totalCount: 0,
      totalPages: 1,
    };
  }
}