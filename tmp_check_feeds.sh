#!/bin/bash
urls=(
  "https://www.9ll.uk/rss.xml"
  "https://www.zhyok.cn/feed/"
  "https://hxy.cc/feed/"
  "https://wang618.cn/rss.php"
  "https://fengcblog.880200.xyz/feed/"
  "https://ink.tino.im/feed/"
  "https://my1981.cn/feed"
)
for u in "${urls[@]}"; do
  echo "===== $u ====="
  xml=$(curl -s -L --max-time 10 -A "Mozilla/5.0" "$u")
  echo "-- newest dates:"
  echo "$xml" | grep -oiE "<(pubdate|published|updated|dc:date)[^>]*>[^<]{0,60}" | head -3
  echo "-- item/entry count:"
  echo "$xml" | grep -cE "<item>|<entry>"
done