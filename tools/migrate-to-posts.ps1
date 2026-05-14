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
    [string[]]$Tags
  )
  $datePart = $DateTime.Substring(0,10)
  $dst = Join-Path $PostsDir "$datePart-$Slug.md"
  $body = Get-Content $Src -Raw -Encoding UTF8
  # 기존 frontmatter 제거
  if ($body -match "^---") {
    $body = [Regex]::Replace($body, "^---\r?\n.*?\r?\n---\r?\n","", "Singleline")
  }
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

# === 1. 월별 TIL (2월/, 3월/, 4월/, 5월/) ===
Write-Host "[1/4] 월별 TIL..."
Get-ChildItem -Path "$Root\2월","$Root\3월","$Root\4월","$Root\5월" -Filter "*.md" -ErrorAction SilentlyContinue |
  ForEach-Object {
    $m = [regex]::Match($_.Name, "^(\d{4}-\d{2}-\d{2})")
    if (-not $m.Success) { return }
    $date = $m.Groups[1].Value
    $ym = $date.Substring(0,7)
    $title = "TIL $date"
    $slug = "til-$date"
    Write-Post -Src $_.FullName -DateTime "$date 09:00:00" -Title $title -Slug $slug `
      -Categories @("TIL", $ym) -Tags @("daily","til")
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
Write-Host "============================="
