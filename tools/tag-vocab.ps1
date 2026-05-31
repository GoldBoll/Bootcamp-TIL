# 통제 태그 어휘 로더/정규화 — _data/tag_vocab.yml 파싱 (powershell-yaml 의존성 없음)
# dot-source 해서 사용: . "$PSScriptRoot\tag-vocab.ps1"

function Get-TagVocab {
  param([string]$Path)
  if (-not (Test-Path $Path)) { throw "tag_vocab.yml 없음: $Path" }
  $alias = @{}                     # 별칭(소문자) -> canonical
  $canon = [System.Collections.Generic.HashSet[string]]::new()
  $inCanonical = $false
  foreach ($line in (Get-Content $Path -Encoding UTF8)) {
    if ($line -match '^\s*#') { continue }
    if ($line -match '^canonical\s*:') { $inCanonical = $true; continue }
    if ($line -match '^\S' -and $line -notmatch '^canonical\s*:') { $inCanonical = $false }
    if (-not $inCanonical) { continue }
    $m = [regex]::Match($line, '^\s+([A-Za-z0-9가-힣\-\+]+)\s*:\s*\[(.*)\]\s*$')
    if (-not $m.Success) { continue }
    $key = $m.Groups[1].Value.Trim().ToLower()
    [void]$canon.Add($key)
    $alias[$key] = $key
    $rest = $m.Groups[2].Value
    if ($rest.Trim()) {
      foreach ($a in $rest -split ',') {
        $a = $a.Trim().Trim('"').Trim("'").ToLower()
        if ($a) { $alias[$a] = $key }
      }
    }
  }
  return [pscustomobject]@{ Alias = $alias; Canonical = $canon }
}

# 태그 배열을 canonical로 변환. 미등록 태그는 그대로 두고 $Unknown(ref)에 수집.
function ConvertTo-CanonicalTags {
  param(
    [string[]]$Tags,
    [pscustomobject]$Vocab,
    [ref]$Unknown
  )
  $out = [System.Collections.Generic.List[string]]::new()
  foreach ($t in $Tags) {
    $key = $t.Trim().ToLower()
    if ($key -eq '') { continue }
    if ($Vocab.Alias.ContainsKey($key)) {
      $c = $Vocab.Alias[$key]
    } else {
      $c = $key
      if ($Unknown) { [void]$Unknown.Value.Add($t) }
    }
    if (-not $out.Contains($c)) { [void]$out.Add($c) }
  }
  return $out.ToArray()
}
