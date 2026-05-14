---
title: "구현계획 — github_blog_migration"
date: 2026-05-12 12:00:00 +0900
categories: ["스크럼 회고", "구현계획"]
tags: ["scrum", "plan"]
render_with_liquid: false
---

# GitHub Pages 블로그 전환 구현 계획 — Bootcamp-TIL → GoldBoll.github.io (chirpy)

*작성일: 2026-05-12*
*마감: 미정 (부트캠프 진행과 병행, 단계별 1~2시간 슬롯으로 분할)*
*기반: 현 레포 `C:\GitHub\Bootcamp-TIL` (remote: `GoldBoll/Bootcamp-TIL`) → `GoldBoll/GoldBoll.github.io` 리네임*
*테마: [jekyll-theme-chirpy](https://github.com/cotes2020/jekyll-theme-chirpy) (chirpy-starter 의존 방식 권장)*

## 변경 이력

| 날짜 | 변경 내용 | 사유 |
|---|---|---|
| 2026-05-12 | 초안 작성 | GitHub Pages 블로그 전환 착수 |

---

## 1. 개요

| 항목 | 내용 |
|---|---|
| **GitHub User** | `GoldBoll` (현 remote URL `https://github.com/GoldBoll/Bootcamp-TIL.git`에서 확인) |
| **신규 레포명** | `GoldBoll.github.io` (사용자/조직 페이지 — `https://goldboll.github.io/` 루트 발행) |
| **이전 방식** | 현 `Bootcamp-TIL` 레포를 **그대로 rename** (git history·issues·stars·remote URL 자동 리다이렉트 보존) |
| **테마** | jekyll-theme-chirpy v7.x — 다크모드·카테고리 트리·태그 클라우드·검색 내장 |
| **설치 방식** | **chirpy-starter** 기반 (gem 의존성만 가져옴, 테마 코어는 업그레이드 시 `bundle update` 1줄) |
| **빌드 환경** | 로컬 Windows 11 + Ruby 3.3.x + Bundler. CI는 chirpy 공식 GitHub Actions (`pages-deploy.yml`) |
| **빌드 제외** | `graphify-out/`, `scrum/unrealc++/graphify-out/`, `.claude/`, `CLAUDE.md`, 메모리 파일, `과제/`, `CodeingTest/`, `node_modules/`, mp4·zip 대용량 자산 |
| **폐기 레포** | `goldball1012.github.io` — 콘텐츠 이전(있다면) 후 archive |

### 1-1. 현황 분석 (2026-05-12 실측)

| 항목 | 수치 | 비고 |
|---|---|---|
| 전체 .md 파일 (`.git` 제외) | **141개** | 워킹 디렉터리 기준 |
| **git tracked .md** | **49개** | `2월/`, `3월/`, `4월/`, `5월/`, `README.md`, `과제/` 일부 |
| `raw/cs-notion/` .md | **22개** (`00_index.md` 포함 24개 — `14_std_map_followup.md`, `15_1_vector_vs_hash_concepts.md` 포함) | **현재 .gitignore에 등록됨 — 블로그 전환 시 ignore 해제 필요** |
| `scrum/` .md | **30+개** | **현재 .gitignore에 등록됨 — 일부만 선별 노출 (구현계획·코드리뷰 등)** |
| `scrum/unrealc++/` | 1.1GB (대부분 `ArtResource.zip` 1GB + mp4 11개) | **블로그에서 완전히 제외** — 강의 노트 .md만 별도 추출 |
| `scrum/unrealc++/언리얼-마스터/` | 2개 .md (`01_uproperty_gc_cdo.md`, `02_containers_smart_pointers.md`) | **선별 노출 후보** |
| `graphify-out/` | 1.0MB (HTML·JSON) | 빌드 제외 (요구사항) |
| `.git` 크기 | 91MB | 보존 (history) |
| 워킹 디렉터리 총 크기 | 1.2GB | 무시 파일 포함, git 푸시에는 영향 없음 |

### 1-2. Definition of Done (DoD)

다음 5개를 모두 충족하면 "완료":

1. **`https://goldboll.github.io/`가 200 OK로 첫 페이지 렌더** (chirpy 기본 레이아웃)
2. **좌측 사이드바에 카테고리 트리** 표시 (TIL / CS 면접 준비 / Unreal C++ / 알고리즘 / 스크럼 회고 5개 1차 카테고리)
3. **최소 50개 이상 포스트가 카테고리·태그와 함께 발행** (49개 TIL + cs-notion 22개 = 71개 목표)
4. **GitHub Actions로 자동 빌드 성공** (master 푸시 → 5분 내 사이트 갱신)
5. **`graphify-out`, `.claude`, `CLAUDE.md`, 메모리, mp4, zip이 빌드에서 완전 제외** 확인 (`_site/` 검색 0건)

---

## 2. 핵심 결정 사항

### 결정 #1 — 레포 rename vs 신규 레포

**선택: rename**

- 이유: git history 보존, 기존 49개 .md를 그대로 활용, remote URL 자동 리다이렉트
- GitHub Settings → Repository name 변경 한 줄로 완료. 기존 push/clone URL은 GitHub가 자동 redirect

### 결정 #2 — chirpy 설치 방식

**선택: (c) chirpy-starter 의존성 방식**

| 옵션 | 장점 | 단점 | 채택 |
|---|---|---|---|
| (a) chirpy-starter **fork** | UI 커스터마이즈 자유도 최대 | 테마 업데이트 수동 머지 | X |
| (b) **gem-based** (`jekyll-theme-chirpy` gem + 수동 `_config.yml`) | 가벼움 | starter가 제공하는 `_tabs/`, `assets/`, workflow 파일 직접 작성 필요 | X |
| (c) **chirpy-starter clone + 콘텐츠 이식** | 공식 권장. `Gemfile`에 `gem "jekyll-theme-chirpy"` 1줄, 업데이트는 `bundle update` 1줄. workflow·tabs 기본 포함 | starter 디렉터리 구조를 따라야 함 | **O** |

### 결정 #3 — 콘텐츠 디렉터리 전략

**선택: 기존 폴더 보존 + `_posts/`에 변환 복사본 생성 (마이그레이션 스크립트)**

- 기존 `2월/` ~ `5월/`, `raw/cs-notion/`은 **삭제하지 않고 그대로 유지** (사용자가 로컬에서 계속 참조)
- `_posts/`에 `YYYY-MM-DD-카테고리-슬러그.md` 형태로 **복사 + frontmatter 자동 삽입**
- 심볼릭 링크는 Windows 권한 문제로 미채택 (관리자 권한·개발자 모드 필요)
- 마이그레이션은 **PowerShell 스크립트 1회 실행 + git commit**으로 멱등성 확보 (기존 _posts 덮어쓰기)

### 결정 #4 — 게시일(date) 결정 규칙

| 원본 위치 | date 결정 |
|---|---|
| `4월/2026-04-23.md` 등 날짜 명시 파일 | **파일명에서 추출** (`2026-04-23 09:00:00 +0900`) |
| `raw/cs-notion/21_context_switching.md` (날짜 없음) | **git log first commit date** (`git log --diff-filter=A --follow --format=%aI -- 파일경로 | tail -1`). git에 없으면 **2026-05-12** (오늘) 또는 번호순 균등 분배 (01번=2026-04-01, 22번=2026-05-12) |
| `scrum/*.md` (날짜 명시) | 파일명 날짜 |
| `scrum/unrealc++/언리얼-마스터/01_*.md` | 균등 분배 또는 git first commit |

---

## 3. 카테고리 트리 설계

**chirpy의 categories는 `[parent, child]` 최대 2-depth 배열.** 좌측 사이드바에 트리 형태로 자동 렌더.

```
TIL
├── 2026-02
├── 2026-03
├── 2026-04
└── 2026-05
CS 면접 준비
├── C++
├── 자료구조
├── OS
└── 알고리즘
Unreal C++
├── 강의 노트
├── 챕터 1 (개발 환경)
├── 챕터 2 (Character/Input)
├── 챕터 3 (Item/Spawn)
└── 챕터 4 (UI/이펙트)
알고리즘
├── 코드카타
└── LeetCode
스크럼 회고
├── 구현계획
└── 코드리뷰
```

### 3-1. 폴더 → 카테고리 매핑 규칙

| 원본 경로 패턴 | categories | tags (자동) |
|---|---|---|
| `2월/YYYY-MM-DD.md` ~ `5월/YYYY-MM-DD.md` | `[TIL, YYYY-MM]` | `daily`, `til` |
| `raw/cs-notion/01_runtime.md` ~ `13_*.md` | `[CS 면접 준비, C++]` | 파일명에서 키워드 추출 |
| `raw/cs-notion/14_*` ~ `18_*` (STL) | `[CS 면접 준비, 자료구조]` | `stl`, 키워드 |
| `raw/cs-notion/19_*` ~ `22_*` (OS) | `[CS 면접 준비, OS]` | `process`, `thread`, `ipc` |
| `scrum/unrealc++/언리얼-마스터/*.md` | `[Unreal C++, 강의 노트]` | `uproperty`, `smart-pointer` |
| `scrum/*_구현계획.md` | `[스크럼 회고, 구현계획]` | 과제 키워드 |
| `scrum/*_코드리뷰.md` | `[스크럼 회고, 코드리뷰]` | |
| `과제/`, `CodeingTest/` | **블로그 미게시** (소스코드 — gist or 별도 레포로) | - |

---

## 4. 구현 단계 (마일스톤 7개)

각 단계 종료 시 **git commit 1개**. 단계당 예상 시간은 **최소~최대** 범위.

### STEP 0 — 사전 점검 (10~20분)

- [ ] GitHub 계정 username 확정: `GoldBoll` (소문자 `goldboll`로 URL 발행)
- [ ] 기존 `goldball1012.github.io` 레포 콘텐츠 백업 필요 여부 확인
  ```powershell
  gh repo view goldball1012/goldball1012.github.io --json description,defaultBranch,pushedAt
  gh repo clone goldball1012/goldball1012.github.io C:\Backup\goldball1012-old
  ```
- [ ] 현 레포 백업 (안전망)
  ```powershell
  Copy-Item -Recurse C:\GitHub\Bootcamp-TIL C:\Backup\Bootcamp-TIL-pre-blog-2026-05-12
  ```
- [ ] 브랜치 생성: `git switch -c feat/blog-migration`

**Rollback**: 백업 폴더 복원 + `git switch main` + `git branch -D feat/blog-migration`

---

### STEP 1 — 레포 rename + 로컬 remote 갱신 (5~10분)

- [ ] GitHub 웹 UI: `https://github.com/GoldBoll/Bootcamp-TIL/settings` → Repository name → `GoldBoll.github.io` → **Rename**
- [ ] 로컬 remote URL 갱신
  ```powershell
  cd C:\GitHub\Bootcamp-TIL
  git remote set-url origin https://github.com/GoldBoll/GoldBoll.github.io.git
  git remote -v   # 확인
  ```
- [ ] 로컬 폴더명도 변경 (선택)
  ```powershell
  cd C:\GitHub
  Rename-Item Bootcamp-TIL GoldBoll.github.io
  ```
- [ ] `git fetch` 정상 동작 확인

**Rollback**: GitHub Settings에서 다시 `Bootcamp-TIL`로 rename. remote URL 원복.

---

### STEP 2 — chirpy-starter 적용 + 디렉터리 구조 정비 (30~60분)

- [ ] 별도 폴더에 chirpy-starter clone
  ```powershell
  git clone https://github.com/cotes2020/chirpy-starter.git C:\Temp\chirpy-starter
  ```
- [ ] 필수 파일을 현 레포로 복사 (콘텐츠는 건드리지 않음)
  ```powershell
  $src = "C:\Temp\chirpy-starter"
  $dst = "C:\GitHub\GoldBoll.github.io"
  Copy-Item "$src\_config.yml"        $dst\
  Copy-Item "$src\Gemfile"            $dst\
  Copy-Item "$src\Gemfile.lock"       $dst\ -ErrorAction SilentlyContinue
  Copy-Item "$src\index.html"         $dst\
  Copy-Item "$src\404.html"           $dst\
  Copy-Item "$src\_tabs"              $dst\ -Recurse
  Copy-Item "$src\_plugins"           $dst\ -Recurse -ErrorAction SilentlyContinue
  Copy-Item "$src\assets"             $dst\ -Recurse
  Copy-Item "$src\.github"            $dst\ -Recurse
  Copy-Item "$src\tools"              $dst\ -Recurse -ErrorAction SilentlyContinue
  ```
- [ ] `_posts/` 빈 폴더 생성
  ```powershell
  New-Item -ItemType Directory -Force "$dst\_posts"
  ```
- [ ] `_config.yml` 핵심 항목 수정 (Read/Edit 도구로):
  ```yaml
  url: "https://goldboll.github.io"
  baseurl: ""
  title: "GoldBoll TIL"
  tagline: "부트캠프 학습 기록 — UE5 · CS · 알고리즘"
  github:
    username: GoldBoll
  social:
    name: GoldBoll
    email: goldball1012@gmail.com
    links:
      - https://github.com/GoldBoll
  timezone: Asia/Seoul
  lang: ko-KR
  ```
- [ ] `_config.yml`의 `exclude:` 섹션에 추가:
  ```yaml
  exclude:
    - "*.gem"
    - "*.gemspec"
    - tools
    - README.md
    - LICENSE
    - "*.config.js"
    - package*.json
    # 콘텐츠 원본 (변환된 사본이 _posts에 있음)
    - "2월/"
    - "3월/"
    - "4월/"
    - "5월/"
    - "raw/"
    - "scrum/"
    # 학습 산출물 (블로그 미게시)
    - graphify-out/
    - 과제/
    - CodeingTest/
    - compile_commands.json
    # Claude Code 하네스
    - .claude/
    - CLAUDE.md
    - "**/MEMORY.md"
    - "*.memory.md"
    # 대용량 자산
    - "**/*.mp4"
    - "**/*.zip"
    # 백업/임시
    - "C:/Backup/**"
  ```
- [ ] commit: `feat(blog): apply chirpy-starter scaffolding`

**Rollback**: 추가된 chirpy 파일·폴더 제거 (`git clean -fd` 후 `git restore .`)

---

### STEP 3 — 로컬 빌드 환경 셋업 + 첫 서브 확인 (30~90분, Windows 첫 설치 시 가장 오래 걸림)

- [ ] **Ruby 3.3.x + DevKit 설치** (chocolatey 권장)
  ```powershell
  # 관리자 PowerShell
  choco install ruby --version=3.3.5 -y
  # 새 PowerShell 세션 열어서:
  ruby --version    # ruby 3.3.5
  ridk install      # MSYS2 + DevKit (옵션 3 선택)
  ```
  - chocolatey 미설치 시: https://rubyinstaller.org/downloads/ 에서 `Ruby+Devkit 3.3.x (x64)` 다운로드
- [ ] Bundler 설치
  ```powershell
  gem install bundler jekyll
  bundler --version
  ```
- [ ] 프로젝트 의존성 설치
  ```powershell
  cd C:\GitHub\GoldBoll.github.io
  bundle install
  ```
- [ ] **빈 콘텐츠로 첫 빌드 확인** (이 시점에는 _posts가 비어있어도 chirpy 데모는 작동)
  ```powershell
  bundle exec jekyll serve --livereload
  # http://127.0.0.1:4000 접속 → chirpy 기본 UI 확인
  ```
- [ ] 빌드 워닝/에러 0건 확인 (특히 `Liquid Exception`, `Conversion error`)
- [ ] commit: `chore(blog): verify local jekyll build`

**Rollback**: Ruby 제거 후 재설치. `Gemfile.lock` 삭제 후 `bundle install` 재시도.

---

### STEP 4 — 마이그레이션 스크립트 작성·실행 (60~120분)

`tools/migrate-to-posts.ps1` 작성. 다음 규칙으로 `_posts/`에 변환 복사.

**스크립트 골격:**

```powershell
# tools/migrate-to-posts.ps1
[CmdletBinding()]
param(
  [string]$Root = "C:\GitHub\GoldBoll.github.io",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$PostsDir = Join-Path $Root "_posts"
if (-not (Test-Path $PostsDir)) { New-Item -ItemType Directory $PostsDir | Out-Null }

function New-Slug([string]$s) {
  # 한글 → 영문 매핑 부족 시 원문 유지(chirpy는 한글 슬러그 허용)
  $s = $s -replace "[^a-zA-Z0-9가-힣\-]+","-"
  $s = $s -replace "^-+|-+$",""
  return $s.ToLower()
}

function Add-Frontmatter {
  param([string]$Src, [string]$Dst, [string]$Title, [string]$Date, [string[]]$Categories, [string[]]$Tags)
  $body = Get-Content $Src -Raw -Encoding UTF8
  # 기존 frontmatter 제거 (--- ~ ---)
  $body = [Regex]::Replace($body, "^---\r?\n.*?\r?\n---\r?\n","", "Singleline")
  $cats = ($Categories | ForEach-Object { "`"$_`"" }) -join ", "
  $tagsStr = ($Tags | ForEach-Object { "`"$_`"" }) -join ", "
  $fm = @"
---
title: "$Title"
date: $Date
categories: [$cats]
tags: [$tagsStr]
---

"@
  if ($DryRun) {
    Write-Host "[DRY] $Dst"
  } else {
    Set-Content -Path $Dst -Value ($fm + $body) -Encoding UTF8
  }
}

# === 1. 월별 TIL ===
Get-ChildItem -Path "$Root\2월","$Root\3월","$Root\4월","$Root\5월" -Filter "*.md" -Recurse |
  Where-Object { $_.Name -match "^(\d{4}-\d{2}-\d{2})" } |
  ForEach-Object {
    $date = $matches[1]
    $ym = $date.Substring(0,7)
    $title = "TIL $date"
    $slug = "til-$date"
    $dst = Join-Path $PostsDir "$date-$slug.md"
    Add-Frontmatter -Src $_.FullName -Dst $dst -Title $title -Date "$date 09:00:00 +0900" `
      -Categories @("TIL", $ym) -Tags @("daily","til")
  }

# === 2. CS 면접 준비 ===
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
}
# 게시일: 01번=2026-04-01부터 1일 간격 + 동일 카테고리는 1일 균등 분배 (필요 시 git log first commit으로 교체)
$baseDate = [DateTime]"2026-04-01"
Get-ChildItem "$Root\raw\cs-notion" -Filter "*.md" |
  Where-Object { $_.Name -match "^(\d{2})_" -and $_.Name -ne "00_index.md" } |
  Sort-Object Name | ForEach-Object {
    $num = $matches[1]
    $info = $csMap[$num]
    if (-not $info) { return }
    $date = $baseDate.AddDays([int]$num).ToString("yyyy-MM-dd")
    $titleRaw = ($_.BaseName -replace "^\d+_","" -replace "_"," ")
    $title = "CS $num — $titleRaw"
    $slug = "cs-$num-" + (New-Slug $titleRaw)
    $dst = Join-Path $PostsDir "$date-$slug.md"
    Add-Frontmatter -Src $_.FullName -Dst $dst -Title $title -Date "$date 10:00:00 +0900" `
      -Categories @("CS 면접 준비", $info.cat) -Tags $info.tags
  }

# === 3. Unreal 마스터 노트 ===
Get-ChildItem "$Root\scrum\unrealc++\언리얼-마스터" -Filter "*.md" -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -ne "README.md" } | ForEach-Object {
    $date = "2026-05-{0:D2}" -f ([int]([regex]::Match($_.Name,"^(\d+)").Value))
    $title = "Unreal Master — " + ($_.BaseName -replace "^\d+_","" -replace "_"," ")
    $slug = "ue-master-" + (New-Slug $_.BaseName)
    $dst = Join-Path $PostsDir "$date-$slug.md"
    Add-Frontmatter -Src $_.FullName -Dst $dst -Title $title -Date "$date 11:00:00 +0900" `
      -Categories @("Unreal C++","강의 노트") -Tags @("ue5","cpp")
  }

# === 4. 스크럼 구현계획·코드리뷰 ===
Get-ChildItem "$Root\scrum" -Filter "*_구현계획.md" | ForEach-Object {
  $date = (Get-Date).ToString("yyyy-MM-dd")
  if ($_.Name -match "(\d{4}-\d{2}-\d{2})") { $date = $matches[1] }
  $title = "구현계획 — " + ($_.BaseName -replace "_구현계획","")
  $slug = "plan-" + (New-Slug ($_.BaseName -replace "_구현계획",""))
  $dst = Join-Path $PostsDir "$date-$slug.md"
  Add-Frontmatter -Src $_.FullName -Dst $dst -Title $title -Date "$date 12:00:00 +0900" `
    -Categories @("스크럼 회고","구현계획") -Tags @("scrum","plan")
}

Write-Host "✓ 마이그레이션 완료 — _posts에 변환 결과 확인"
```

- [ ] 스크립트 저장: `tools/migrate-to-posts.ps1`
- [ ] **DryRun으로 먼저 실행**
  ```powershell
  cd C:\GitHub\GoldBoll.github.io
  .\tools\migrate-to-posts.ps1 -DryRun
  ```
- [ ] 출력 파일 수 검증 (예상: TIL 49개 + CS 22개 + UE 마스터 2개 + 구현계획 5~8개 ≈ **78개 전후**)
- [ ] 실제 실행
  ```powershell
  .\tools\migrate-to-posts.ps1
  ```
- [ ] **`raw/cs-notion/`을 .gitignore에서 제거** (소스로 노출시키지 않더라도 변환 결과가 `_posts/`에 있으므로 원본은 ignore 유지 가능 — 사용자 결정. 권장: 원본은 계속 ignore)
- [ ] 빌드 재실행 + 한국어 파일명·frontmatter 한글 정상 렌더링 확인
  ```powershell
  bundle exec jekyll serve --livereload
  ```
- [ ] 좌측 사이드바에 카테고리 트리 노출 확인
- [ ] commit: `feat(blog): migrate 70+ posts into _posts with frontmatter`

**Rollback**: `Remove-Item _posts\* -Recurse -Force` 후 `git restore .`

---

### STEP 5 — _tabs/categories + 5개 1차 카테고리 페이지 보강 (15~30분)

chirpy는 기본적으로 `_tabs/categories.md`·`_tabs/tags.md`·`_tabs/archives.md`·`_tabs/about.md`를 제공. **추가 작업 거의 없음** — 단지 `about.md`만 편집.

- [ ] `_tabs/about.md` 수정 — 프로필·부트캠프 정보·이메일
- [ ] `_data/contact.yml` (chirpy starter에 있음) 수정 — GitHub·이메일 링크
- [ ] favicon 교체 (선택): `assets/img/favicons/` 폴더 파일 교체. chirpy 공식 가이드: https://chirpy.cotes.page/posts/customize-the-favicon/
- [ ] commit: `chore(blog): personalize about/contact/favicon`

---

### STEP 6 — GitHub Actions 배포 + 첫 발행 (15~30분)

chirpy-starter는 이미 `.github/workflows/pages-deploy.yml`을 포함. **별도 작성 불필요.**

- [ ] GitHub 웹 UI: `Settings → Pages → Build and deployment → Source: GitHub Actions` 선택 (Branch 방식 X)
- [ ] 푸시
  ```powershell
  git push -u origin feat/blog-migration
  # PR 머지 또는 직접 main에:
  git switch main
  git merge feat/blog-migration
  git push
  ```
- [ ] Actions 탭에서 `pages-deploy` 워크플로우 성공 확인 (3~5분)
- [ ] `https://goldboll.github.io/` 접속 → DoD 5개 항목 검증
- [ ] commit: (자동 — workflow 실행)

**Rollback**: 워크플로우 실패 시 Actions 로그 확인. 일반 원인:
- `_config.yml` YAML 오류 → 들여쓰기 점검
- `_posts/` 파일명이 `YYYY-MM-DD-title.md` 형식 위반 → 스크립트로 재생성
- 의존성 잠금 충돌 → `Gemfile.lock` 삭제 후 재커밋

---

### STEP 7 — 이전 블로그 폐기 + 마무리 (10~20분)

- [ ] `goldball1012.github.io` 콘텐츠가 있다면 가치 있는 글만 추출 → 신규 `_posts/`로 이전
- [ ] `goldball1012.github.io` 레포 archive
  ```powershell
  gh repo archive goldball1012/goldball1012.github.io --yes
  ```
- [ ] 옵션: `goldball1012.github.io`의 `index.html`에 새 블로그로 redirect 메타 태그 1줄 추가 (archive 전에)
  ```html
  <meta http-equiv="refresh" content="0; url=https://goldboll.github.io/">
  ```
- [ ] 외부 링크(이력서·Notion·LinkedIn)에서 구 URL → 신 URL 갱신
- [ ] commit: `chore(blog): retire goldball1012.github.io`

---

## 5. _config.yml 핵심 설정 전체본 (참고)

```yaml
# Site
title: GoldBoll TIL
tagline: 부트캠프 학습 기록 — UE5 · CS · 알고리즘
description: >-
  Unreal Engine 5 C++, 자료구조·OS 면접 준비, 알고리즘 풀이를 매일 정리합니다.
url: "https://goldboll.github.io"
baseurl: ""

# Author
github:
  username: GoldBoll
social:
  name: GoldBoll
  email: goldball1012@gmail.com
  links:
    - https://github.com/GoldBoll

# Localization
timezone: Asia/Seoul
lang: ko-KR

# Theme
theme: jekyll-theme-chirpy
avatar: "/assets/img/avatar.png"

# Pagination
paginate: 10

# Build
markdown: kramdown
highlighter: rouge
permalink: /posts/:title/

defaults:
  - scope:
      path: ""
      type: posts
    values:
      layout: post
      comments: false
      toc: true

exclude:
  - "*.gem"
  - "*.gemspec"
  - tools
  - README.md
  - LICENSE
  - package*.json
  # 원본 콘텐츠 (변환본이 _posts에 있음)
  - "2월/"
  - "3월/"
  - "4월/"
  - "5월/"
  - "raw/"
  - "scrum/"
  # 학습 산출물
  - graphify-out/
  - 과제/
  - CodeingTest/
  - compile_commands.json
  # 하네스
  - .claude/
  - CLAUDE.md
  - "**/MEMORY.md"
  # 대용량 자산
  - "**/*.mp4"
  - "**/*.zip"

keep_files:
  - .git
  - .github
```

---

## 6. 디버깅 예상 포인트

| 증상 | 원인 | 해결 |
|---|---|---|
| `bundle install` 실패 (`nokogiri`, `eventmachine`) | Windows DevKit 미설치 | `ridk install` 옵션 3 실행 |
| 한글 파일명 빌드 실패 | UTF-8 인코딩 깨짐 | PowerShell `-Encoding UTF8` 명시. 또는 슬러그를 영문화 |
| `_posts/` 파일이 사이트에 안 보임 | 파일명이 `YYYY-MM-DD-` 형식 위반 / `date` frontmatter가 미래 | 형식·날짜 확인. `future: false` 기본값 |
| 카테고리가 좌측에 안 뜸 | `_tabs/categories.md`가 누락 | chirpy-starter `_tabs/` 전체 복사했는지 확인 |
| Actions 빌드 시간 초과 | mp4/zip 인덱싱 | `exclude:`에 `**/*.mp4`, `**/*.zip` 누락 확인 |
| `Liquid Exception: Liquid syntax error` | 본문에 `{{`, `{%` 문자가 있음 | 해당 영역을 ``{% raw %} ... {% endraw %}``로 감싸기 |
| 카테고리 깊이 3단 이상 표시 안됨 | chirpy는 2-depth 한계 | 트리 재설계 (3-1절 따름) |
| GitHub Actions가 `main` 외 브랜치에서 안 돌아감 | workflow trigger 확인 | `.github/workflows/pages-deploy.yml`의 `on.push.branches`에 `main` 명시 확인 |
| 빌드 시 한글 폴더가 처리됨 (원본 노출) | `exclude:` 패턴이 폴더 한글명을 못 잡음 | 정확한 폴더명 그대로 (`"2월/"`) 인용부호 포함. 의심 시 `_site\` 직접 확인 |

---

## 7. 위험·리스크

| 리스크 | 영향도 | 완화 |
|---|---|---|
| **레포 rename 후 외부 링크 깨짐** | 중 | GitHub가 자동 redirect 1년 보장. 단 README의 raw URL은 수동 갱신 |
| **chirpy 빌드 실패로 발행 지연** | 중 | 별도 브랜치 `feat/blog-migration`에서 검증 후 main 머지 |
| **frontmatter 누락 시 카테고리 무분류** | 저 | 스크립트가 모든 파일에 frontmatter 강제 삽입. DryRun으로 사전 검증 |
| **한글 슬러그 URL이 인코딩되어 가독성↓** | 저 | 핵심 글만 영문 슬러그 수동 지정. 일반 TIL은 한글 허용 |
| **goldball1012.github.io 폐기 시 외부 인입 트래픽 손실** | 저 | redirect 메타 태그 1줄 추가 후 archive |
| **`.gitignore`된 cs-notion/scrum이 git에 없음 → 변환본만 git에 들어감** | 저 (정상 동작) | 원본은 로컬에만 존재하는 게 의도. 변환본(`_posts/`)만 git tracked |
| **Windows에서 Ruby native gem 컴파일 실패** | 중 | DevKit MSYS2 설치 누락이 주원인. `ridk install` 3번 옵션 |
| **GitHub Actions `pages` 권한 부족** | 저 | Settings → Pages → Source: GitHub Actions 선택. Actions 권한은 자동 부여 |

---

## 8. 예상 소요 시간 요약

| 단계 | 최소 | 최대 |
|---|---|---|
| STEP 0 사전 점검 | 10분 | 20분 |
| STEP 1 레포 rename | 5분 | 10분 |
| STEP 2 chirpy-starter 적용 | 30분 | 60분 |
| STEP 3 Ruby/Jekyll 환경 셋업 (Windows 첫 설치) | 30분 | 90분 |
| STEP 4 마이그레이션 스크립트 | 60분 | 120분 |
| STEP 5 _tabs/about 보강 | 15분 | 30분 |
| STEP 6 GitHub Actions 배포 | 15분 | 30분 |
| STEP 7 이전 블로그 폐기 | 10분 | 20분 |
| **합계** | **2.9시간** | **6.3시간** |

부트캠프 진행과 병행 가능하도록 **STEP 0~2 = 1일, STEP 3 = 1일(Ruby 설치 분리), STEP 4 = 1일, STEP 5~7 = 1일** 4일 분할 권장.

---

## 9. 참고 링크

- chirpy 공식 데모: https://chirpy.cotes.page/
- chirpy-starter: https://github.com/cotes2020/chirpy-starter
- chirpy 테마 본체: https://github.com/cotes2020/jekyll-theme-chirpy
- chirpy 글 작성 가이드: https://chirpy.cotes.page/posts/write-a-new-post/
- chirpy 카테고리·태그 가이드: https://chirpy.cotes.page/posts/customize-the-favicon/
- Jekyll 공식 frontmatter: https://jekyllrb.com/docs/front-matter/
- GitHub Pages: https://docs.github.com/en/pages
- RubyInstaller for Windows: https://rubyinstaller.org/
- 레퍼런스 디자인 (minimal-mistakes 카테고리 트리): https://ansohxxn.github.io/page148/

---

## 10. 디버깅 기록 (작업 중 추가)

*(이 섹션은 실제 작업 진행 중 발생한 이슈·해결 방법을 누적 기록한다.)*

