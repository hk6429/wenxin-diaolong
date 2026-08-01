#!/usr/bin/env bash
# 文心雕龍立繪：10 位文心大師＋文心四靈，潑墨×Q版國風。
# 雙線並行：各 lane 自己的 CODEX_HOME＋最新 auth.json。可重跑（已落盤即 SKIP）。
# 用法：generate-portraits.sh <lane-name> <key1> <key2> ...
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
lane="${1:?需要 lane 名稱}"; shift
codex_home="$root/.codex-art-$lane"
generated_dir="$codex_home/generated_images"
out_dir="$root/assets/img"
timeout_seconds=${IMAGE_TIMEOUT_SECONDS:-260}
model=${CODEX_IMAGE_MODEL:-gpt-5.5}

mkdir -p "$out_dir" "$codex_home"
cp -f /Users/naichengchen/.codex/auth.json "$codex_home/auth.json"

STYLE="Chinese ink-wash splash painting (潑墨) mixed with cute chibi Q-version character design, traditional guofeng scholar-fantasy aesthetic, expressive black ink brush strokes with selective warm color accents (cinnabar red, antique gold, indigo), character centered as a bust/upper-body portrait on a plain warm rice-paper (宣紙) cream background with subtle ink splatter, soft edges, charming and friendly for students, NO text or letters or numbers anywhere, square composition 1024x1024"

desc_for() {
  case "$1" in
    asong) echo "a cute chibi Chinese schoolboy scholar apprentice around 10 years old, round cheerful face, traditional Ming-style student robe in indigo, holding an open thread-bound book, reciting happily with sparkling eyes";;
    jixiaolan) echo "a witty cute chibi Qing-dynasty scholar Ji Xiaolan with a queue braid and mandarin robe, holding a long smoking pipe and a paper couplet scroll, mischievous clever grin";;
    libai) echo "a cute chibi Tang-dynasty poet Li Bai in flowing white robe, raising a wine cup toward the moon, carefree ecstatic expression, ink-splash moon and swirling clouds behind";;
    dufu) echo "a cute chibi Tang-dynasty poet Du Fu in a plain dark scholar robe and small black futou hat, slightly worried gentle expression, holding a brush and a poem scroll, autumn leaves drifting";;
    hanyu) echo "a dignified cute chibi Tang-dynasty master Han Yu in a red-brown official robe, stern but warm teacher expression, one hand raised as if lecturing, ancient bronze tripod in ink wash behind";;
    liqingzhao) echo "an elegant cute chibi Song-dynasty female poet Li Qingzhao in a pale green and white ruqun dress with hair ornament, holding a lyric scroll beside a tiny wine cup and chrysanthemum, gentle melancholy smile";;
    sushi) echo "a jovial cute chibi Song-dynasty poet Su Shi (Su Dongpo) with a full beard and iconic tall dongpo hat, holding a brush in one hand and a braised pork bowl hinted in ink wash aside, hearty laughing expression";;
    ouyangxiu) echo "a relaxed cute chibi Song-dynasty scholar Ouyang Xiu (the Drunken Old Man) with a grey beard, leaning on a wine gourd beside a tiny pavilion in ink wash, serene tipsy smile";;
    zhuangzi) echo "a dreamy cute chibi Daoist sage Zhuangzi in loose flowing robes with unkempt hair, eyes half closed in a blissful dream, a large ink-wash butterfly hovering above his head";;
    liuxie) echo "a wise cute chibi Six-Dynasties monk-scholar Liu Xie in simple grey-brown robes, holding an ancient scroll titled with no visible text, a majestic golden ink-splash dragon coiling behind him";;
    diaolong) echo "a cute chibi eastern dragon spirit made of living black ink and gold light, long whiskers, holding a giant writing brush in its claws, playful wise expression, ink splashes forming clouds";;
    mingfeng) echo "a cute chibi Chinese phoenix (fenghuang) spirit with flowing ink-wash tail feathers in cinnabar red and gold, perched on a wutong branch, singing with little musical ink ripples around";;
    xuangui) echo "a cute chibi ancient black tortoise spirit carrying a stack of thread-bound classic books and a tiny stone stele on its shell, slow steady kind expression, ink-wash water ripples";;
    qilin) echo "a cute chibi qilin spirit with ink-wash scales in indigo and gold, small antlers and flame-like mane, radiant gentle aura, standing proudly among auspicious ink clouds";;
    *) echo "";;
  esac
}

for key in "$@"; do
  desc=$(desc_for "$key")
  [[ -z $desc ]] && { echo "未知 key: $key" >&2; continue; }
  final="$out_dir/$key.webp"
  if [[ -f $final && $(stat -f%z "$final") -gt 20000 ]]; then
    echo "SKIP $key（已存在）"; continue
  fi
  marker="$root/.art-marker-$lane-$key"
  prompt_file="$root/.art-prompt-$lane-$key.txt"
  touch "$marker"
  cat >"$prompt_file" <<EOF
Please generate one image with the built-in image generation tool.

Subject: $desc

Style requirements: $STYLE

不要嘗試寫入 /tmp。圖片生成後保留在 \$CODEX_HOME/generated_images。完成前必須用 shell 找到本次新生成的 PNG，實際驗證檔案已落盤且檔案大小 > 500KB；若未落盤，必須重生，不能只用文字宣稱完成。
EOF
  echo "GENERATE [$lane] $key"
  set +e
  perl -e 'alarm shift; exec @ARGV' "$timeout_seconds" \
    env CODEX_HOME="$codex_home" codex exec --ignore-user-config \
    -c 'features.code_mode_host=false' \
    -m "$model" -s workspace-write -C "$root" - \
    <"$prompt_file" >"$root/.art-$lane-$key.log" 2>&1
  status=$?
  set -e
  (( status != 0 )) && echo "codex 失敗/逾時 $key (status=$status)，查是否已落盤" >&2
  source_png=$(find "$generated_dir" -type f -name '*.png' -newer "$marker" -size +500000c \
    -print 2>/dev/null | while IFS= read -r p; do printf '%s\t%s\n' "$(stat -f%m "$p")" "$p"; done \
    | sort -nr | head -1 | cut -f2-)
  if [[ -z $source_png ]]; then
    echo "找不到 $key 的新 PNG" >&2; tail -15 "$root/.art-$lane-$key.log" >&2; continue
  fi
  cwebp -quiet -q 85 -resize 512 512 "$source_png" -o "$final"
  /bin/rm -f "$marker" "$prompt_file"
  echo "OK $key $(stat -f%z "$final") bytes (webp)"
done
echo "[$lane] 完成"
