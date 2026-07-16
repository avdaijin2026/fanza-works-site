# FANZAサイト 復旧手順

## ① PM2確認

```bash
pm2 status
```

onlineならOK。

---

## ② PM2復元

```bash
pm2 resurrect
```

---

## ③ サイト再起動

```bash
pm2 restart fanza-site
```

---

## ④ ホビーサイトも起動

```bash
pm2 restart hobby-finder
```

---

## ⑤ Health確認

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3002/health
```

---

## ⑥ 外部確認

```
https://avdizin.com
https://hobby.avdizin.com
```

---

## ⑦ ダメならログ確認

```bash
pm2 logs fanza-site --lines 100
```

または

```bash
pm2 describe fanza-site
```
