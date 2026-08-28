const advertisementIds = {
  top: "1275",
  bottom: "1276",
} as const;

type AdvertisementPosition = keyof typeof advertisementIds;

function isAdvertisementPosition(
  position: string
): position is AdvertisementPosition {
  return Object.hasOwn(advertisementIds, position);
}

function createAdvertisementDocument(id: string) {
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=300, initial-scale=1">
    <style>html,body{width:300px;height:250px;margin:0;padding:0;overflow:hidden;background:transparent}</style>
  </head>
  <body>
    <script language="JavaScript" type="text/javascript" charset="UTF-8">
      noCacheParam=Math.random()*10000000000;
      document.write('<scr'+'ipt type="text/javascript" charset="UTF-8" src="//adone.yicha.jp/adv_tags/?id=${id}&ord=' + noCacheParam + '"></scr'+'ipt>');
    </script>
  </body>
</html>`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ position: string }> }
) {
  const { position } = await context.params;

  if (!isAdvertisementPosition(position)) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(createAdvertisementDocument(advertisementIds[position]), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
