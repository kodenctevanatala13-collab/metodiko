$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir ".env"
$promptFile = Join-Path $scriptDir "prompt_niche.txt"

$apiKey = ""
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile -Encoding UTF8) {
        $line = $line.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $parts = $line.Split("=", 2)
            if ($parts[0].Trim() -eq "GEMINI_API_KEY") {
                $apiKey = $parts[1].Trim().Trim("'").Trim('"')
                break
            }
        }
    }
}

$dateStamp = (Get-Date).ToString("yyyy-MM-dd")
$prompt = [System.IO.File]::ReadAllText($promptFile, [System.Text.Encoding]::UTF8)
$escaped = $prompt.Replace('\', '\\').Replace('"', '\"').Replace("`r", "").Replace("`n", "\n")

$uri = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=$apiKey"
$payload = '{"contents":[{"role":"user","parts":[{"text":"' + $escaped + '"}]}]}'

Write-Host "Running market research (last 3 months) via gemini-3-flash-preview..." -ForegroundColor Cyan

try {
    $resp = Invoke-RestMethod -Uri $uri -Method Post -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 180
} catch {
    $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "API Error: $($sr.ReadToEnd())" -ForegroundColor Red
    exit 1
}

$textParts = @()
foreach ($part in $resp.candidates[0].content.parts) {
    if ($part.text) { $textParts += $part.text }
}
$resultText = $textParts -join "`n"

$outFile = Join-Path $scriptDir "niche_map_$dateStamp.md"
$header = "---`ntitle: `"Market Research Report ($dateStamp)`"`ntype: project`nstatus: active`npriority: p1`nupdated: $dateStamp`n---`n`n"

[System.IO.File]::WriteAllText($outFile, ($header + $resultText), [System.Text.Encoding]::UTF8)
Write-Host "Done! Saved to: $outFile" -ForegroundColor Green
