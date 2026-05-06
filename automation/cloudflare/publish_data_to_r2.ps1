param(
  [string]$DataDir = "web/data",
  [string]$Bucket = $env:BMR_R2_BUCKET,
  [string]$Prefix = "data",
  [switch]$DryRun
)

if ([string]::IsNullOrWhiteSpace($Bucket)) { $Bucket = "bmr-private-data" }
if (-not (Test-Path $DataDir)) { throw "DATA_DIR no existe: $DataDir" }

$files = Get-ChildItem -Path $DataDir -Recurse -File -Filter *.json | Sort-Object FullName
foreach ($file in $files) {
  $rel = $file.FullName.Substring((Resolve-Path $DataDir).Path.Length).TrimStart('\','/') -replace '\\','/'
  $key = "$Prefix/$rel"
  if ($DryRun) {
    Write-Host "DRY_RUN npx wrangler r2 object put $Bucket/$key --file $($file.FullName) --remote"
  } else {
    npx wrangler r2 object put "$Bucket/$key" --file "$($file.FullName)" --remote
    if ($LASTEXITCODE -ne 0) { throw "Fallo subida R2: $key" }
  }
}
Write-Host "R2 publish terminado. Archivos procesados: $($files.Count)"
