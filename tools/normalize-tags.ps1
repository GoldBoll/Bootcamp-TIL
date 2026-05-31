# _posts/*.md 의 tags: 줄을 통제 어휘(_data/tag_vocab.yml)로 정규화한다.
# - 기본: 미등록 태그를 리포트하고 정규화 변경분을 기록 (가드레일)
# - -Apply: 실제 파일에 정규화된 태그를 다시 쓴다
# - -Strict: 미등록 태그가 하나라도 있으면 exit 1 (CI lint 용)
# 사용: .\tools\normalize-tags.ps1 [-Apply] [-Strict]
[CmdletBinding()]
param(
  [string]$Root = "C:\GitHub\Bootcamp-TIL",
  [switch]$Apply,
  [switch]$Strict
)
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "tag-vocab.ps1")
$vocab = Get-TagVocab (Join-Path $Root "_data" "tag_vocab.yml")

$unknownAll = [System.Collections.Generic.List[string]]::new()
$changed = 0
Get-ChildItem (Join-Path $Root "_posts") -Filter "*.md" | ForEach-Object {
  $lines = Get-Content $_.FullName -Encoding UTF8
  $idx = ($lines | Select-String -Pattern '^tags:\s*\[' | Select-Object -First 1).LineNumber
  if (-not $idx) { return }
  $line = $lines[$idx - 1]
  $inner = ([regex]::Match($line, '^\s*tags:\s*\[(.*)\]\s*$')).Groups[1].Value
  if ($inner.Trim() -eq '') { return }
  $tags = $inner -split ',' | ForEach-Object { $_.Trim().Trim('"').Trim("'") } | Where-Object { $_ }
  $unk = [System.Collections.Generic.List[string]]::new()
  $norm = ConvertTo-CanonicalTags -Tags $tags -Vocab $vocab -Unknown ([ref]$unk)
  foreach ($u in $unk) { $unknownAll.Add($u) }
  $newLine = 'tags: [' + (($norm | ForEach-Object { "`"$_`"" }) -join ', ') + ']'
  if ($newLine -ne $line.TrimEnd()) {
    Write-Host ("~ {0}" -f $_.Name)
    Write-Host ("    - {0}" -f $line.Trim())
    Write-Host ("    + {0}" -f $newLine)
    $changed++
    if ($Apply) {
      $lines[$idx - 1] = $newLine
      Set-Content -Path $_.FullName -Value $lines -Encoding UTF8
    }
  }
}

Write-Host ""
Write-Host ("정규화 대상 {0}개 파일" -f $changed)
$uniqUnknown = $unknownAll | Sort-Object -Unique
if ($uniqUnknown.Count) {
  Write-Warning ("미등록 태그 {0}종: {1}" -f $uniqUnknown.Count, ($uniqUnknown -join ", "))
}
if ($Strict -and $uniqUnknown.Count) { exit 1 }
