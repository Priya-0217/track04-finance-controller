# ==============================================================================
#  Razorpay AI Finance Controller OS — Windows PowerShell 1-Click Setup
# ==============================================================================

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  🚀 Starting Razorpay AI Finance Controller OS One-Click Windows Setup" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Detect Python
$pythonCmd = (Get-Command python -ErrorAction SilentlyContinue)
if (-not $pythonCmd) {
    Write-Host "❌ Error: Python 3.10+ is required but was not found in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "✓ Found Python: $(python --version)" -ForegroundColor Green

# 2. Virtual Environment
if (-not (Test-Path ".venv")) {
    Write-Host "📦 Creating virtual environment in .venv/..." -ForegroundColor Yellow
    python -m venv .venv
}

if (Test-Path ".venv\Scripts\activate.ps1") {
    & ".venv\Scripts\Activate.ps1"
    Write-Host "✓ Virtual environment activated." -ForegroundColor Green
}

# 3. Python Dependencies
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
pip install --upgrade pip --quiet
pip install -r requirements.txt --quiet
Write-Host "✓ Python dependencies installed." -ForegroundColor Green

# 4. Build Frontend (if npm available)
$npmCmd = (Get-Command npm -ErrorAction SilentlyContinue)
if ($npmCmd) {
    Write-Host "🎨 Building React UI frontend..." -ForegroundColor Yellow
    Push-Location frontend
    if (-not (Test-Path "node_modules")) {
        npm install --silent
    }
    npm run build --silent
    Pop-Location
    Write-Host "✓ Frontend compiled into static_dist/." -ForegroundColor Green
} else {
    Write-Host "⚠️  Node.js/npm not detected. Using pre-built static_dist/ assets." -ForegroundColor Gray
}

# 5. Verify Sample Data
if (-not (Test-Path "data\ledger.csv") -or -not (Test-Path "data\settlement.csv")) {
    Write-Host "📊 Generating initial benchmark financial dataset in data/..." -ForegroundColor Yellow
    python -c "from data.generate_synthetic_data import save_csv_and_json; from pathlib import Path; save_csv_and_json(Path('data'))"
    Write-Host "✓ Initial financial dataset ready." -ForegroundColor Green
} else {
    Write-Host "✓ Sample CSV files verified in data/ (ledger.csv & settlement.csv)." -ForegroundColor Green
}

# 6. Run Unit Tests
Write-Host "🧪 Running self-check test suite..." -ForegroundColor Yellow
pytest tests/ -q

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  ✅ Setup Complete! Starting Server on http://localhost:8010" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 Web Dashboard:    http://localhost:8010" -ForegroundColor White
Write-Host "  💬 AI Copilot Chat:  http://localhost:8010/chat" -ForegroundColor White
Write-Host "  🔍 4-Tier Matches:   http://localhost:8010/reconcile" -ForegroundColor White
Write-Host "  💻 CLI Tool:         python cli/financectl.py --help" -ForegroundColor White
Write-Host ""
Write-Host "Press CTRL+C to terminate the server." -ForegroundColor Gray
Write-Host ""

python -m uvicorn app:app --port 8010 --host 0.0.0.0
