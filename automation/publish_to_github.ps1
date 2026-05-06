param(
  [string]$EnvFile = "exporter/.env.local",
  [string]$Branch = "main",
  [switch]$NoPush
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $ScriptDir "run_daily_pipeline.ps1") -EnvFile $EnvFile -Branch $Branch -NoPush:$NoPush
