# รัน migration QR VPS บน PostgreSQL ใน container `db`
# ใช้จากโฟลเดอร์ pos_backend (PowerShell):  .\scripts\apply-migration-009.ps1
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$SqlPath = Join-Path $Root 'migrations\009_qr_vps.sql'
if (-not (Test-Path $SqlPath)) { throw "ไม่พบไฟล์: $SqlPath" }

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  Write-Host ""
  Write-Host "ไม่พบคำสั่ง docker บนเครื่องนี้ (ยังไม่ติดตั้ง Docker หรือยังไม่อยู่ใน PATH)" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "ทำได้อย่างใดอย่างหนึ่ง:"
  Write-Host "  1) ติดตั้ง Docker Desktop for Windows แล้วเปิดแอป Docker รอให้พร้อม แล้วรันสคริปต์นี้ใหม่"
  Write-Host "  2) SSH เข้า VPS ที่รัน container อยู่ แล้วในโฟลเดอร์ pos_backend รัน:  bash scripts/apply-migration-009.sh"
  Write-Host "  3) ถ้ามี psql ต่อ PostgreSQL ได้ (เช่น DB บนเซิร์ฟเวอร์):"
  Write-Host "     psql -h HOST -U USER -d DBNAME -v ON_ERROR_STOP=1 -f migrations\009_qr_vps.sql"
  Write-Host ""
  exit 1
}

$ErrorActionPreference = 'Stop'
$dc = $null
docker compose version 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) { $dc = 'docker compose' }
if (-not $dc) {
  docker-compose version 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $dc = 'docker-compose' }
}
if (-not $dc) {
  Write-Host "พบ docker แต่ไม่พบ docker compose / docker-compose ให้ติดตั้ง Docker Desktop เวอร์ชันล่าสุด" -ForegroundColor Yellow
  exit 1
}

$sql = Get-Content -Path $SqlPath -Raw -Encoding UTF8
if ($dc -eq 'docker compose') {
  $sql | docker compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -'
} else {
  $sql | docker-compose exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -'
}
Write-Host "OK: 009_qr_vps.sql ใช้กับฐานข้อมูลแล้ว — รีสตาร์ท backend: $dc restart backend"
