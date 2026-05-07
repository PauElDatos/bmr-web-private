param(
  [string]$DataDir = "web/data",
  [string]$Bucket = $env:BMR_R2_BUCKET,
  [string]$Prefix = "data",
  [int]$MaxAttempts = 5,
  [switch]$DryRun
)

if ([string]::IsNullOrWhiteSpace($Bucket)) { $Bucket = "bmr-private-data" }
if (-not (Test-Path $DataDir)) { throw "DATA_DIR no existe: $DataDir" }
if ($MaxAttempts -lt 1) { throw "MaxAttempts debe ser >= 1" }

$files = Get-ChildItem -Path $DataDir -Recurse -File -Filter *.json | Sort-Object FullName
foreach ($file in $files) {
  $rel = $file.FullName.Substring((Resolve-Path $DataDir).Path.Length).TrimStart('\','/') -replace '\\','/'
  $key = "$Prefix/$rel"
  if ($DryRun) {
    Write-Host "DRY_RUN npx wrangler r2 object put $Bucket/$key --file $($file.FullName) --remote"
  } else {
    $uploaded = $false
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
      npx wrangler r2 object put "$Bucket/$key" --file "$($file.FullName)" --remote
      if ($LASTEXITCODE -eq 0) {
        $uploaded = $true
        break
      }

      if ($attempt -lt $MaxAttempts) {
        $sleepSeconds = [Math]::Min(30, [Math]::Pow(2, $attempt))
        Write-Warning "Subida fallida ($attempt/$MaxAttempts): $key. Reintentando en $sleepSeconds s..."
        Start-Sleep -Seconds $sleepSeconds
      }
    }

    if (-not $uploaded) {
      throw "Fallo subida R2 tras $MaxAttempts intentos: $key"
    }
  }
}
Write-Host "R2 publish terminado. Archivos procesados: $($files.Count)"
