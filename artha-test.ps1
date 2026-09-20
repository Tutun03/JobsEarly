$ApiKey = "ak_live_d8de924724c02ad38d57d680abbd784ec2f59afd5539625d"

$BaseUrl = "https://api-india.artha.link/api/v1/jobs"

$Iterations = 10
$WaitMinutes = 5

$Results = @()

$PreviousJobIds = @()

Write-Host ""
Write-Host "============================================="
Write-Host "       ARTHA API CONSISTENCY TEST"
Write-Host "============================================="
Write-Host "Iterations : $Iterations"
Write-Host "Interval    : $WaitMinutes minutes"
Write-Host "============================================="
Write-Host ""

for ($i = 1; $i -le $Iterations; $i++) {

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

    Write-Host ""
    Write-Host "---------------------------------------------"
    Write-Host "TEST #$i - $Timestamp"
    Write-Host "---------------------------------------------"

    try {

        # ============================================================
        # REQUEST 1
        # offset = 0
        # ============================================================

        $Url1 = "$BaseUrl`?limit=100&offset=0&location=IN"

        Write-Host "Request 1:"
        Write-Host $Url1

        $Response1 = Invoke-RestMethod `
            -Uri $Url1 `
            -Method GET `
            -Headers @{
                "Accept" = "application/json"
                "x-api-key" = $ApiKey
            }

        # ------------------------------------------------------------
        # Extract jobs
        # ------------------------------------------------------------

        if ($Response1.jobs -is [System.Array]) {
            $Jobs1 = $Response1.jobs
        }
        elseif ($Response1.data -is [System.Array]) {
            $Jobs1 = $Response1.data
        }
        elseif ($Response1.results -is [System.Array]) {
            $Jobs1 = $Response1.results
        }
        elseif ($Response1.data.jobs -is [System.Array]) {
            $Jobs1 = $Response1.data.jobs
        }
        elseif ($Response1.data.results -is [System.Array]) {
            $Jobs1 = $Response1.data.results
        }
        else {
            $Jobs1 = @()
        }

        $Total1 = $Response1.total

        if ($null -eq $Total1) {
            $Total1 = $Response1.data.total
        }

        if ($null -eq $Total1) {
            $Total1 = $Response1.pagination.total
        }

        $HasMore1 = $Response1.has_more

        if ($null -eq $HasMore1) {
            $HasMore1 = $Response1.data.has_more
        }

        if ($null -eq $HasMore1) {
            $HasMore1 = $Response1.pagination.has_more
        }

        $JobIds1 = @(
            $Jobs1 | ForEach-Object {
                if ($null -ne $_.id) {
                    [string]$_.id
                }
                elseif ($null -ne $_.slug) {
                    [string]$_.slug
                }
            }
        )

        Write-Host ""
        Write-Host "Total jobs    : $Total1"
        Write-Host "Returned jobs : $($Jobs1.Count)"
        Write-Host "Has more      : $HasMore1"

        if ($JobIds1.Count -gt 0) {
            Write-Host "First job ID  : $($JobIds1[0])"
            Write-Host "Last job ID   : $($JobIds1[-1])"
        }

        # ============================================================
        # CHECK CHANGES
        # ============================================================

        $Changed = $false
        $Added = @()
        $Removed = @()

        if ($PreviousJobIds.Count -gt 0) {

            $Added = @(
                $JobIds1 | Where-Object {
                    $_ -notin $PreviousJobIds
                }
            )

            $Removed = @(
                $PreviousJobIds | Where-Object {
                    $_ -notin $JobIds1
                }
            )

            if (
                $Added.Count -gt 0 -or
                $Removed.Count -gt 0
            ) {
                $Changed = $true
            }
        }

        if ($Changed) {

            Write-Host ""
            Write-Host "!!! JOB SET CHANGED !!!"

            if ($Added.Count -gt 0) {
                Write-Host ""
                Write-Host "Added jobs:"
                $Added | ForEach-Object {
                    Write-Host "  + $_"
                }
            }

            if ($Removed.Count -gt 0) {
                Write-Host ""
                Write-Host "Removed jobs:"
                $Removed | ForEach-Object {
                    Write-Host "  - $_"
                }
            }

        }
        else {
            Write-Host "Job set      : No change"
        }

        # ============================================================
        # REQUEST 2
        # offset = 100
        # ============================================================

        $Url2 = "$BaseUrl`?limit=100&offset=100&location=IN"

        Write-Host ""
        Write-Host "Request 2:"
        Write-Host $Url2

        $Response2 = Invoke-RestMethod `
            -Uri $Url2 `
            -Method GET `
            -Headers @{
                "Accept" = "application/json"
                "x-api-key" = $ApiKey
            }

        if ($Response2.jobs -is [System.Array]) {
            $Jobs2 = $Response2.jobs
        }
        elseif ($Response2.data -is [System.Array]) {
            $Jobs2 = $Response2.data
        }
        elseif ($Response2.results -is [System.Array]) {
            $Jobs2 = $Response2.results
        }
        elseif ($Response2.data.jobs -is [System.Array]) {
            $Jobs2 = $Response2.data.jobs
        }
        elseif ($Response2.data.results -is [System.Array]) {
            $Jobs2 = $Response2.data.results
        }
        else {
            $Jobs2 = @()
        }

        Write-Host ""
        Write-Host "Offset 100 returned : $($Jobs2.Count)"

        $JobIds2 = @(
            $Jobs2 | ForEach-Object {
                if ($null -ne $_.id) {
                    [string]$_.id
                }
                elseif ($null -ne $_.slug) {
                    [string]$_.slug
                }
            }
        )

        if ($JobIds2.Count -gt 0) {
            Write-Host "First offset-100 ID : $($JobIds2[0])"
            Write-Host "Last offset-100 ID  : $($JobIds2[-1])"
        }

        # ============================================================
        # SAVE RESULT
        # ============================================================

        $Results += [PSCustomObject]@{
            TestNumber        = $i
            Timestamp         = $Timestamp
            Total             = $Total1
            ReturnedOffset0   = $Jobs1.Count
            ReturnedOffset100 = $Jobs2.Count
            HasMore           = $HasMore1
            JobSetChanged     = $Changed
            AddedCount        = $Added.Count
            RemovedCount      = $Removed.Count
            FirstJobId        = if ($JobIds1.Count -gt 0) {
                                    $JobIds1[0]
                                } else {
                                    ""
                                }
            LastJobId         = if ($JobIds1.Count -gt 0) {
                                    $JobIds1[-1]
                                } else {
                                    ""
                                }
        }

        $PreviousJobIds = $JobIds1

        Write-Host ""
        Write-Host "Test #$i completed."

    }
    catch {

        Write-Host ""
        Write-Host "ERROR:"
        Write-Host $_.Exception.Message

        $Results += [PSCustomObject]@{
            TestNumber        = $i
            Timestamp         = $Timestamp
            Total             = "ERROR"
            ReturnedOffset0   = "ERROR"
            ReturnedOffset100 = "ERROR"
            HasMore           = "ERROR"
            JobSetChanged     = "ERROR"
            AddedCount        = "ERROR"
            RemovedCount      = "ERROR"
            FirstJobId        = ""
            LastJobId         = ""
        }
    }

    # ================================================================
    # WAIT
    # ================================================================

    if ($i -lt $Iterations) {

        Write-Host ""
        Write-Host "Waiting $WaitMinutes minutes..."
        Write-Host "Next test at:"
        Write-Host (Get-Date).AddMinutes($WaitMinutes).ToString(
            "yyyy-MM-dd HH:mm:ss"
        )

        Start-Sleep -Seconds ($WaitMinutes * 60)
    }
}

# ====================================================================
# FINAL REPORT
# ====================================================================

Write-Host ""
Write-Host ""
Write-Host "============================================="
Write-Host "             FINAL REPORT"
Write-Host "============================================="

$Results | Format-Table -AutoSize

$CsvPath = Join-Path `
    (Get-Location) `
    "artha-consistency-report.csv"

$Results | Export-Csv `
    -Path $CsvPath `
    -NoTypeInformation

Write-Host ""
Write-Host "Report saved to:"
Write-Host $CsvPath

Write-Host ""
Write-Host "============================================="
Write-Host "          TEST COMPLETED"
Write-Host "============================================="