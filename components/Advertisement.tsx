type AdvertisementPosition = "top" | "bottom";

type AdvertisementProps = {
  position: AdvertisementPosition;
};

const advertisementIds: Record<AdvertisementPosition, string> = {
  top: "1275",
  bottom: "1276",
};

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

export default function Advertisement({ position }: AdvertisementProps) {
  const id = advertisementIds[position];

  return (
    <aside
      className={`advertisement advertisement-${position}`}
      aria-label="広告"
      data-ad-id={id}
    >
      <span className="advertisement-label">広告</span>
      <iframe
        className="advertisement-frame"
        title={`${position === "top" ? "上部" : "下部"}広告`}
        srcDoc={createAdvertisementDocument(id)}
        width="300"
        height="250"
        scrolling="no"
        loading={position === "bottom" ? "lazy" : "eager"}
      />
    </aside>
  );
}
