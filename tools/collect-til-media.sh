#!/usr/bin/env bash
# collect-til-media.sh — UE 프로젝트 캡처(스크린샷/영상)를 오늘 TIL 자산으로 수집
# 사용: bash tools/collect-til-media.sh [YYYY-MM-DD]  (기본: 오늘)
#   1) $UE_PROJECT/Saved/{Screenshots/WindowsEditor,VideoCaptures,MovieRenders} 에서
#      대상 날짜에 수정된 파일 수집
#   2) assets/img/til/YYYY-MM-DD/ 로 복사 (영상은 ffmpeg로 webm 변환)
#   3) 같은 폴더에 snippets.md 생성 — til-agent가 발행본에 삽입할 마크다운 조각
set -euo pipefail

UE_PROJECT="${UE_PROJECT:-/d/Unreal/8th-Team8-CH4-Project}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATE="${1:-$(date +%F)}"
DEST="$REPO/assets/img/til/$DATE"
SNIP="$DEST/snippets.md"

SRC_DIRS=(
  "$UE_PROJECT/Saved/Screenshots/WindowsEditor"
  "$UE_PROJECT/Saved/VideoCaptures"
  "$UE_PROJECT/Saved/MovieRenders"
)

mapfile -t FILES < <(for d in "${SRC_DIRS[@]}"; do
  [ -d "$d" ] && find "$d" -maxdepth 1 -type f \
    \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.avi" -o -iname "*.mp4" \) \
    -newermt "$DATE 00:00" ! -newermt "$DATE 23:59:59" 2>/dev/null
done)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "수집할 캡처 없음 ($DATE, $UE_PROJECT)"; exit 0
fi

mkdir -p "$DEST"
{
  echo "<!-- til-agent용 미디어 스니펫 — 관련 섹션에 골라 삽입하고 alt/캡션을 내용에 맞게 수정 -->"
  echo
} > "$SNIP"

for f in "${FILES[@]}"; do
  base="$(basename "$f")"; name="${base%.*}"; ext="${base##*.}"
  case "${ext,,}" in
    png|jpg)
      cp -n "$f" "$DEST/$base"
      echo "![${name}](/assets/img/til/$DATE/$base)" >> "$SNIP"
      echo "_캡션: ${name}_" >> "$SNIP"; echo >> "$SNIP"
      echo "이미지: $base" ;;
    avi|mp4)
      out="$DEST/$name.webm"
      if [ ! -f "$out" ]; then
        ffmpeg -loglevel error -y -i "$f" -c:v libvpx-vp9 -crf 34 -b:v 0 -an "$out"
      fi
      { echo "<video controls muted loop width=\"100%\">"
        echo "  <source src=\"/assets/img/til/$DATE/$name.webm\" type=\"video/webm\">"
        echo "</video>"
        echo "_캡션: ${name}_"; echo; } >> "$SNIP"
      echo "영상 변환: $base → $name.webm" ;;
  esac
done

echo "완료 → $DEST (snippets.md 포함, $(ls "$DEST" | wc -l)개 파일)"
