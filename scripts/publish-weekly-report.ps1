param(
  [string]$WeekEnding = (Get-Date -Format 'yyyy-MM-dd'),
  [string]$RepoRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

function Resolve-CommandPath {
  param(
    [string]$Name,
    [string]$Fallback
  )
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  if (Test-Path -LiteralPath $Fallback) { return $Fallback }
  throw "Required command not found: $Name"
}

if ($WeekEnding -notmatch '^\d{4}-\d{2}-\d{2}$') {
  throw 'WeekEnding must use yyyy-MM-dd.'
}

$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$downloads = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
$input = Join-Path $downloads "mrcharm-weekly-public-$WeekEnding.json"
if (-not (Test-Path -LiteralPath $input)) {
  throw "Weekly public export not found: $input"
}

$node = Resolve-CommandPath 'node' 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$pnpm = Resolve-CommandPath 'pnpm' 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'
$git = Resolve-CommandPath 'git' 'C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe'

Push-Location $repo
try {
  $branch = (& $git branch --show-current).Trim()
  if ($branch -ne 'main') {
    throw "Weekly publishing requires main branch; current branch is $branch."
  }

  $dirty = (& $git status --porcelain)
  if ($dirty) {
    throw 'Repository has uncommitted changes. Weekly publishing stopped without modifying files.'
  }

  & $node scripts/generate-weekly-report.mjs $input
  if ($LASTEXITCODE -ne 0) { throw 'Weekly report generation failed.' }

  & $pnpm check
  if ($LASTEXITCODE -ne 0) { throw 'Site checks failed. Weekly report was not committed or pushed.' }

  $slug = "weekly-$WeekEnding"
  $paths = @(
    "content/posts/$slug.md",
    'index.html',
    'writing/index.html',
    "writing/$slug/index.html"
  )
  & $git add -- $paths
  if ($LASTEXITCODE -ne 0) { throw 'Could not stage weekly report files.' }

  & $git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Output "No weekly report changes for $WeekEnding."
    exit 0
  }

  & $git commit -m "content: publish weekly report $WeekEnding"
  if ($LASTEXITCODE -ne 0) { throw 'Weekly report commit failed.' }

  & $git push origin main
  if ($LASTEXITCODE -ne 0) { throw 'Weekly report push failed.' }

  Write-Output "Published: https://mrcharm.github.io/cat-grok-website/writing/$slug/"
}
finally {
  Pop-Location
}
