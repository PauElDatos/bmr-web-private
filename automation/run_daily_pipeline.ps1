param(
  [string]$EnvFile = "exporter/.env.local",
  [string]$OutDir = "web/data",
  [string]$Branch = "main",
  [string]$MaxPoints = "8000",
  [string]$MaxIndicators = "0",
  [string]$MaxAssets = "500",
  [string]$MaxSeries = "0",
  [string]$MaxCrypto = "100",
  [string]$MaxRuns = "150",
  [switch]$NoPush,
  [switch]$SkipGit,
  [switch]$DryRun,
  [switch]$NoClean,
  [switch]$NoVenvUpdate,
  [switch]$StrictValidation
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RepoRoot

$LogDir = "automation/logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$RunId = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$LogFile = Join-Path $LogDir "bmr-web-export-$RunId.log"
Start-Transcript -Path $LogFile -Append | Out-Null

try {
  Write-Host "== BMR Web daily pipeline Windows =="
  Write-Host "repo=$RepoRoot"
  Write-Host "env_file=$EnvFile"
  Write-Host "out_dir=$OutDir"

  if (!(Test-Path $EnvFile)) {
    throw "No existe EnvFile=$EnvFile. Crea uno desde exporter/.env.example."
  }

  if (!(Test-Path ".venv-exporter")) {
    py -m venv .venv-exporter
  }
  . .\.venv-exporter\Scripts\Activate.ps1
  if (-not $NoVenvUpdate) {
    python -m pip install --upgrade pip
    python -m pip install -r exporter/requirements.txt
  }

  $exportArgs = @(
    "exporter/export_web_json.py",
    "--env-file", $EnvFile,
    "--out-dir", $OutDir,
    "--max-points", $MaxPoints,
    "--max-indicators", $MaxIndicators,
    "--max-assets", $MaxAssets,
    "--max-series", $MaxSeries,
    "--max-crypto", $MaxCrypto,
    "--max-runs", $MaxRuns
  )
  if (-not $NoClean) { $exportArgs += "--clean" }
  python @exportArgs

  $validateArgs = @("exporter/validate_web_json.py", "--data-dir", $OutDir)
  if ($StrictValidation) { $validateArgs += "--strict" }
  python @validateArgs

  python automation/make_snapshot_status.py --repo-root . --data-dir $OutDir --stage validated --validation-status ok --message "snapshot validado correctamente" --log-file $LogFile --branch $Branch

  if ($SkipGit -or $DryRun) {
    python automation/make_snapshot_status.py --repo-root . --data-dir $OutDir --stage dry-run --validation-status ok --message "exportación validada sin publicación" --log-file $LogFile --branch $Branch | Out-Null
    Write-Host "OK: exportación validada. Sin commit/push."
    exit 0
  }

  git add $OutDir
  git diff --cached --quiet
  if ($LASTEXITCODE -eq 0) {
    Write-Host "No hay cambios en JSON; no se crea commit."
  } else {
    git commit -m "data: update BMR web snapshot $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    python automation/make_snapshot_status.py --repo-root . --data-dir $OutDir --stage committed --validation-status ok --message "commit creado" --log-file $LogFile --branch $Branch | Out-Null
    git add "$OutDir/status/publish.json" "$OutDir/status/automation.json" "$OutDir/status/file_index.json"
    git diff --cached --quiet
    if ($LASTEXITCODE -ne 0) {
      git commit -m "data: update snapshot status $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    }
  }

  if ($NoPush) {
    Write-Host "NoPush activo: no se hace git push."
  } else {
    git push origin $Branch
    python automation/make_snapshot_status.py --repo-root . --data-dir $OutDir --stage pushed --validation-status ok --message "push completado; GitHub Actions desplegará Pages" --log-file $LogFile --branch $Branch | Out-Null
  }
  Write-Host "OK: pipeline finalizado. Log: $LogFile"
}
catch {
  Write-Error $_
  try {
    python automation/make_snapshot_status.py --repo-root . --data-dir $OutDir --stage failed --validation-status error --message "pipeline falló" --log-file $LogFile --branch $Branch | Out-Null
  } catch {}
  exit 1
}
finally {
  Stop-Transcript | Out-Null
}
