param(
  [string]$Branch = "main",
  [string]$DataDir = "web/data",
  [string]$Bucket = $env:BMR_R2_BUCKET,
  [string]$R2Prefix = "data",
  [string]$CommitMessage = "",
  [switch]$SkipPull,
  [switch]$SkipPushCode,
  [switch]$SkipR2,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

if ([string]::IsNullOrWhiteSpace($Bucket)) { $Bucket = "bmr-private-data" }
if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
  $CommitMessage = "web: update frontend $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

Write-Host "== Deploy web code + R2 data =="
Write-Host "repo=$RepoRoot"
Write-Host "branch=$Branch"
Write-Host "data_dir=$DataDir"
Write-Host "bucket=$Bucket"

git rev-parse --is-inside-work-tree | Out-Null

if (-not $SkipPull) {
  if ($DryRun) {
    Write-Host "DRY_RUN git pull --rebase origin $Branch"
  } else {
    git pull --rebase origin $Branch
  }
}

if (-not $SkipPushCode) {
  if ($DryRun) {
    Write-Host "DRY_RUN git add -A -- . :(exclude)web/data/**"
    Write-Host "DRY_RUN git commit -m ""$CommitMessage"""
    Write-Host "DRY_RUN git push origin $Branch"
  } else {
    # Stage all repo changes except web/data (JSON privados).
    git add -A -- . ":(exclude)web/data/**"

    # Safety guard: if anything from web/data is staged, abort.
    $stagedData = git diff --cached --name-only -- "web/data/**"
    if (-not [string]::IsNullOrWhiteSpace(($stagedData -join ""))) {
      throw "Abortado: hay archivos staged dentro de web/data. Revísalos con: git diff --cached --name-only"
    }

    git diff --cached --quiet
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Sin cambios de código para commit (web/data excluido)."
    } else {
      git commit -m $CommitMessage
      git push origin $Branch
      Write-Host "OK: código web subido a GitHub."
    }
  }
}

if (-not $SkipR2) {
  $r2Script = Join-Path $RepoRoot "automation/cloudflare/publish_data_to_r2.ps1"
  if (-not (Test-Path $r2Script)) {
    throw "No existe script R2: $r2Script"
  }

  if ($DryRun) {
    & $r2Script -DataDir $DataDir -Bucket $Bucket -Prefix $R2Prefix -DryRun
  } else {
    & $r2Script -DataDir $DataDir -Bucket $Bucket -Prefix $R2Prefix
  }
}

Write-Host "OK: deploy finalizado."
