# 마이그레이션: 원본 콘텐츠 → _posts/ (chirpy frontmatter 자동 삽입)
# 사용: .\tools\migrate-to-posts.ps1 [-DryRun]
[CmdletBinding()]
param(
  [string]$Root = "C:\GitHub\Bootcamp-TIL",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PostsDir = Join-Path $Root "_posts"
if (-not (Test-Path $PostsDir)) { New-Item -ItemType Directory $PostsDir | Out-Null }

. "$PSScriptRoot\tag-vocab.ps1"
$script:Vocab = Get-TagVocab (Join-Path $Root "_data\tag_vocab.yml")
$script:UnknownTags = [System.Collections.Generic.List[string]]::new()

$script:Total = 0
$script:DoDry = $DryRun.IsPresent

function New-Slug([string]$s) {
  $s = $s -replace "[^a-zA-Z0-9가-힣\-]+","-"
  $s = $s -replace "^-+|-+$",""
  return $s.ToLower()
}

function Write-Post {
  param(
    [string]$Src,
    [string]$DateTime,
    [string]$Title,
    [string]$Slug,
    [string[]]$Categories,
    [string[]]$Tags,
    [string]$BodyOverride   # 분할 모드: 본문을 직접 전달 (지정 시 $Src 무시)
  )
  $datePart = $DateTime.Substring(0,10)
  $dst = Join-Path $PostsDir "$datePart-$Slug.md"
  if ($PSBoundParameters.ContainsKey('BodyOverride')) {
    $body = $BodyOverride
  } else {
    $body = Get-Content $Src -Raw -Encoding UTF8
  }
  # 기존 frontmatter 제거
  if ($body -match "^---") {
    $body = [Regex]::Replace($body, "^---\r?\n.*?\r?\n---\r?\n","", "Singleline")
  }
  # 태그 정규화 (통제 어휘)
  $Tags = ConvertTo-CanonicalTags -Tags $Tags -Vocab $script:Vocab -Unknown ([ref]$script:UnknownTags)
  $cats = ($Categories | ForEach-Object { "`"$_`"" }) -join ", "
  $tagsStr = ($Tags | ForEach-Object { "`"$_`"" }) -join ", "
  $fm = "---`ntitle: `"$Title`"`ndate: $DateTime +0900`ncategories: [$cats]`ntags: [$tagsStr]`nrender_with_liquid: false`n---`n`n"
  if ($script:DoDry) {
    Write-Host "[DRY] $dst"
  } else {
    Set-Content -Path $dst -Value ($fm + $body) -Encoding UTF8
  }
  $script:Total++
}

# 인라인 part 마커 파싱: <!--part cat="상위,하위" tags="t1,t2" slug="..."-->
function Get-PartMarkers {
  param([string]$Body)
  $rx = [regex]'<!--\s*part\s+([^>]*?)-->'
  $parts = [System.Collections.Generic.List[object]]::new()
  foreach ($m in $rx.Matches($Body)) {
    $attrs = $m.Groups[1].Value
    $cat  = ([regex]::Match($attrs, 'cat\s*=\s*"([^"]*)"')).Groups[1].Value
    $tags = ([regex]::Match($attrs, 'tags\s*=\s*"([^"]*)"')).Groups[1].Value
    $slug = ([regex]::Match($attrs, 'slug\s*=\s*"([^"]*)"')).Groups[1].Value
    $parts.Add([pscustomobject]@{
      Start    = $m.Index
      BodyFrom = $m.Index + $m.Length
      Cat      = @($cat  -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
      Tags     = @($tags -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
      Slug     = $slug.Trim()
    })
  }
  return $parts
}

# === 1. 월별 TIL (2월/, 3월/, 4월/, 5월/) — 인라인 마커가 있으면 주제별 분할 ===
Write-Host "[1/3] 월별 TIL..."
Get-ChildItem -Path "$Root\2월","$Root\3월","$Root\4월","$Root\5월" -Filter "*.md" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $m = [regex]::Match($_.Name, "^(\d{4}-\d{2}-\d{2})")
    if (-not $m.Success) { return }
    $date = $m.Groups[1].Value
    $raw  = Get-Content $_.FullName -Raw -Encoding UTF8
    $parts = Get-PartMarkers $raw

    if ($parts.Count -eq 0) {
      # fallback: 통합 단일 포스트 (월 카테고리 제거)
      Write-Post -Src $_.FullName -DateTime "$date 09:00:00" -Title "TIL $date" -Slug "til-$date" `
        -Categories @("TIL") -Tags @("daily","til")
      return
    }

    # 분할 모드: 마커별로 본문 슬라이스 → 포스트 1개
    for ($i = 0; $i -lt $parts.Count; $i++) {
      $p = $parts[$i]
      $end = if ($i + 1 -lt $parts.Count) { $parts[$i+1].Start } else { $raw.Length }
      $section = $raw.Substring($p.BodyFrom, $end - $p.BodyFrom).Trim()
      # 첫 H2 헤딩에서 제목/슬러그 보강
      $h = [regex]::Match($section, '^#{1,3}\s+(.+)$', 'Multiline')
      $heading = if ($h.Success) { $h.Groups[1].Value.Trim() } else { "TIL $date" }
      $slugBase = if ($p.Slug) { $p.Slug } else { (New-Slug $heading) }
      $slug = "til-$slugBase"
      $hh = "{0:D2}:00:00" -f (9 + $i)
      $cats = if ($p.Cat.Count) { $p.Cat } else { @("TIL") }
      $tags = if ($p.Tags.Count) { $p.Tags } else { @("til") }
      Write-Post -DateTime "$date $hh" -Title $heading -Slug $slug `
        -Categories $cats -Tags $tags -BodyOverride $section
    }
  }

# === 2. CS 면접 준비 (raw/cs-notion/) ===
Write-Host "[2/3] CS 면접 준비..."
$csMap = @{
  "01" = @{cat="C++"; tags=@("runtime")}
  "02" = @{cat="C++"; tags=@("class","struct")}
  "03" = @{cat="C++"; tags=@("new","malloc","memory")}
  "04" = @{cat="C++"; tags=@("oop")}
  "05" = @{cat="C++"; tags=@("vtable")}
  "06" = @{cat="C++"; tags=@("virtual","destructor")}
  "07" = @{cat="C++"; tags=@("pointer","reference")}
  "08" = @{cat="C++"; tags=@("vtable")}
  "09" = @{cat="C++"; tags=@("rtti","raii")}
  "10" = @{cat="C++"; tags=@("pointer")}
  "11" = @{cat="C++"; tags=@("smart-pointer")}
  "12" = @{cat="C++"; tags=@("copy")}
  "13" = @{cat="자료구조"; tags=@("vector","list")}
  "14" = @{cat="자료구조"; tags=@("map","stl")}
  "15" = @{cat="자료구조"; tags=@("vector","hash")}
  "16" = @{cat="자료구조"; tags=@("stl")}
  "17" = @{cat="알고리즘"; tags=@("find","binary-search")}
  "18" = @{cat="알고리즘"; tags=@("sort","list")}
  "19" = @{cat="OS"; tags=@("process","thread")}
  "20" = @{cat="OS"; tags=@("stack-overflow")}
  "21" = @{cat="OS"; tags=@("context-switching")}
  "22" = @{cat="OS"; tags=@("ipc")}
  "23" = @{cat="OS"; tags=@("race-condition","concurrency")}
}
$baseDate = [DateTime]"2026-04-01"
# 같은 번호의 followup·변종은 시간 오프셋으로 충돌 방지
$timeSlots = @{}   # 번호별 사용 시간 추적
Get-ChildItem "$Root\raw\cs-notion" -Filter "*.md" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "00_index.md" } |
  Sort-Object Name | ForEach-Object {
    $m = [regex]::Match($_.Name, "^(\d{2})")
    if (-not $m.Success) { return }
    $num = $m.Groups[1].Value
    $info = $csMap[$num]
    if (-not $info) { Write-Warning "csMap에 $num 누락: $($_.Name)"; return }
    $date = $baseDate.AddDays([int]$num).ToString("yyyy-MM-dd")
    if (-not $timeSlots.ContainsKey($num)) { $timeSlots[$num] = 10 }
    $hour = $timeSlots[$num]
    $timeSlots[$num] = $hour + 2
    $dateTime = "$date {0:D2}:00:00" -f $hour
    $titleRaw = ($_.BaseName -replace "^\d+_","" -replace "_"," ")
    $title = "CS — $titleRaw"
    $slug = "cs-" + (New-Slug $_.BaseName)
    Write-Post -Src $_.FullName -DateTime $dateTime -Title $title -Slug $slug `
      -Categories @("CS 면접 준비", $info.cat) -Tags $info.tags
  }

# 강의 노트(언리얼 마스터)·스크럼 구현계획은 블로그 카테고리에서 제외한다.
# 발행 카테고리는 TIL·CS 면접 준비, 알고리즘 작업물, 그리고 TIL에서 마커로
# 떼어내는 팀프로젝트/개인 R&D 글로 한정한다. (2026-05-31 결정)

# === 3. 알고리즘 작업물 (CodeKata=프로그래머스, 100zun=LeetCode) ===
Write-Host "[3/3] 알고리즘 작업물..."

function Get-GitAddDate {
  param([string]$FilePath)
  $d = (& git -C $Root log --diff-filter=A --format="%ad" --date=short -- "$FilePath" 2>$null | Select-Object -Last 1)
  if (-not $d) { $d = (Get-Item $FilePath).LastWriteTime.ToString("yyyy-MM-dd") }
  return ([string]$d).Trim()
}

# 코드 시작(#include) 전, URL이 아닌 첫 주석 줄을 제목으로
function Get-CodeTitle {
  param([string]$Body, [string]$Fallback)
  foreach ($line in ($Body -split "`n")) {
    if ($line -match '^\s*#include') { break }
    $m = [regex]::Match($line, '^\s*//\s*(.+)$')
    if ($m.Success) {
      $t = $m.Groups[1].Value.Trim()
      if ($t -notmatch '^https?://') { return $t }
    }
  }
  return $Fallback
}

function Write-CodePost {
  param([System.IO.FileInfo]$File, [string[]]$Cats, [string]$DateOverride, [string]$SlugPrefix, [string]$Fallback)
  $raw = Get-Content $File.FullName -Raw -Encoding UTF8
  $date = if ($DateOverride) { $DateOverride } else { Get-GitAddDate $File.FullName }
  $title = Get-CodeTitle $raw $Fallback
  $slug = "$SlugPrefix-" + (New-Slug $File.BaseName)
  $url = ([regex]::Match($raw, 'https?://\S+')).Value
  $post = ""
  if ($url) { $post += "> 출처: <$url>`n`n" }
  $post += "``````cpp`n" + $raw.TrimEnd() + "`n```````n"
  Write-Post -DateTime "$date 13:00:00" -Title $title -Slug $slug `
    -Categories $Cats -Tags @("algorithm") -BodyOverride $post
}

Get-ChildItem "$Root\CodeingTest\CodingTest\CodeKata" -Filter "*.cpp" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $fallback = "프로그래머스 — " + ($_.BaseName -replace "_"," ")
    Write-CodePost -File $_ -Cats @("알고리즘","프로그래머스") -SlugPrefix "kata" -Fallback $fallback
  }

Get-ChildItem "$Root\CodeingTest\CodingTest\100zun" -Filter "*.cpp" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $dm = [regex]::Match($_.Name, '^(\d{4}-\d{2}-\d{2})')
    $d = if ($dm.Success) { $dm.Groups[1].Value } else { $null }
    Write-CodePost -File $_ -Cats @("알고리즘","LeetCode") -DateOverride $d -SlugPrefix "algo" -Fallback $_.BaseName
  }

Write-Host ""
Write-Host "============================="
Write-Host ("✓ 마이그레이션 완료: {0}개 포스트" -f $script:Total)
if ($script:UnknownTags.Count) {
  $uniq = $script:UnknownTags | Sort-Object -Unique
  Write-Warning ("통제 어휘 미등록 태그 {0}종: {1}" -f $uniq.Count, ($uniq -join ", "))
  Write-Host "  → _data/tag_vocab.yml 에 canonical 또는 별칭으로 추가하세요."
}
Write-Host "============================="
