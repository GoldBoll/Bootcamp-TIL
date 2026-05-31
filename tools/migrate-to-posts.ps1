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
Write-Host "[1/4] 월별 TIL..."
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
Write-Host "[2/4] CS 면접 준비..."
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

# === 3. 언리얼 마스터 노트 ===
Write-Host "[3/4] Unreal 마스터..."
Get-ChildItem "$Root\scrum\unrealc++\언리얼-마스터" -Filter "*.md" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "README.md" } |
  ForEach-Object {
    $m = [regex]::Match($_.Name, "^(\d+)")
    if (-not $m.Success) { return }
    $num = [int]$m.Groups[1].Value
    $date = "2026-05-{0:D2}" -f $num
    $titleRaw = ($_.BaseName -replace "^\d+_","" -replace "_"," ")
    $title = "Unreal Master — $titleRaw"
    $slug = "ue-master-" + (New-Slug $_.BaseName)
    Write-Post -Src $_.FullName -DateTime "$date 11:00:00" -Title $title -Slug $slug `
      -Categories @("Unreal C++","강의 노트") -Tags @("ue5","cpp")
  }

# === 4. 스크럼 구현계획 ===
Write-Host "[4/4] 구현계획..."
Get-ChildItem "$Root\scrum" -Filter "*구현계획.md" -ErrorAction SilentlyContinue | ForEach-Object {
  # 파일 작성일 — 본문 안의 "작성일: YYYY-MM-DD" 추출, 없으면 파일 LastWriteTime
  $body = Get-Content $_.FullName -Raw -Encoding UTF8
  if ($body -match "작성일:\s*(\d{4}-\d{2}-\d{2})") {
    $date = $matches[1]
  } else {
    $date = $_.LastWriteTime.ToString("yyyy-MM-dd")
  }
  $title = "구현계획 — " + ($_.BaseName -replace "_?구현계획","")
  $slug = "plan-" + (New-Slug ($_.BaseName -replace "_?구현계획",""))
  Write-Post -Src $_.FullName -DateTime "$date 12:00:00" -Title $title -Slug $slug `
    -Categories @("스크럼 회고","구현계획") -Tags @("scrum","plan")
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
