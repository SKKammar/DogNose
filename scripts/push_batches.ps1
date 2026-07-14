$folders = Get-ChildItem -Path dataset -Directory
$batchSize = 10
for ($i = 0; $i -lt $folders.Count; $i += $batchSize) {
    $batch = $folders | Select-Object -Skip $i -First $batchSize
    foreach ($folder in $batch) {
        $path = $folder.FullName
        git add $path
    }
    
    $status = git status --porcelain
    if ($status) {
        $startIndex = $i + 1
        $endIndex = [Math]::Min($i + $batchSize, $folders.Count)
        Write-Host "Committing and pushing folders $startIndex to $endIndex..."
        git commit -m "Add dataset folders $startIndex to $endIndex"
        git push origin main
        
        $retry = 0
        while ($LASTEXITCODE -ne 0 -and $retry -lt 5) {
            Write-Host "Push failed, retrying..."
            Start-Sleep -Seconds 5
            git push origin main
            $retry++
        }
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Push failed after retries. Exiting."
            exit $LASTEXITCODE
        }
    } else {
        Write-Host "No changes for batch starting at index $($i + 1)"
    }
}
Write-Host "All done!"
