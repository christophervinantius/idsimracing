export interface AcsmResultRow {
    position: number
    classPosition: number
    isTeamEntry?: boolean
    driverName: string
    driverNames: string[]
    carModel: string
    carId: number
    team: string
    teamClass: string | null
    carNumber: string | null
    teamName: string
    hasFormattedTeam: boolean
    nation: string
    numLaps: number
    bestLapMs: number
    bestLap: string
    totalTime: number
    totalTimeFormatted: string
    isFastestLap: boolean
    isPole?: boolean
    gap: string
    classId: string | null
    raceClass: string | null
    disqualified: boolean
    hasPenalty: boolean
    penaltyTime: number
    gridPosition: number
}

export interface ParsedTeamInfo {
    teamClass: string | null
    carNumber: string | null
    teamName: string
    hasFormattedTeam: boolean
}

export interface ParsedTimeBreakdown {
    hours: number
    minutes: number
    seconds: number
    formatted: string
}

export const cleanTeamName = (rawTeam?: string | null): string => {
    if (!rawTeam) return "-"
    let trimmed = rawTeam.trim()
    // 1. If format: (Class) (Number) | (Name) e.g. "HY 12 | Red Bull"
    const m1 = trimmed.match(/^([A-Za-z0-9\+\-]+)\s+(\d+)\s*\|\s*(.+)$/)
    if (m1) return m1[3].trim()

    // 2. If format: (Class) | (Name) e.g. "HY | Red Bull"
    const mClassPipe = trimmed.match(/^([A-Za-z0-9\+\-]+)\s*\|\s*(.+)$/)
    if (mClassPipe) return mClassPipe[2].trim()

    // 3. If format: (Number) | (Name) e.g. "12 | Red Bull"
    const m2 = trimmed.match(/^(\d+)\s*\|\s*(.+)$/)
    if (m2) return m2[2].trim()

    // 4. Strip leading #number or number- e.g. "#12 Red Bull", "12 - Red Bull", "12 | Red Bull"
    trimmed = trimmed.replace(/^#?\d+\s*[-|:]?\s*/, "")

    // 5. Strip trailing #number or (number) e.g. "Red Bull #12", "Red Bull (12)"
    trimmed = trimmed.replace(/\s*#\d+$/, "").replace(/\s*\(\d+\)$/, "")

    return trimmed.trim() || "-"
}

export const parseTeamInfo = (rawTeam?: string | null): ParsedTeamInfo => {
    if (!rawTeam) {
        return {
            teamClass: null,
            carNumber: null,
            teamName: "-",
            hasFormattedTeam: false
        }
    }
    const trimmed = rawTeam.trim()
    // Match format: (Class) (Number) | (Name) e.g. "HY 123 | Red Bull" or "HY 69 | B.E.G.O. Racing Division"
    const match = trimmed.match(/^([A-Za-z0-9\+\-]+)\s+(\d+)\s*\|\s*(.+)$/)
    if (match) {
        return {
            teamClass: match[1].trim(),
            carNumber: match[2].trim(),
            teamName: cleanTeamName(match[3].trim()),
            hasFormattedTeam: true
        }
    }
    // Match format: (Number) | (Name) e.g. "12 | Red Bull"
    const matchNumPipe = trimmed.match(/^(\d+)\s*\|\s*(.+)$/)
    if (matchNumPipe) {
        return {
            teamClass: null,
            carNumber: matchNumPipe[1].trim(),
            teamName: cleanTeamName(matchNumPipe[2].trim()),
            hasFormattedTeam: true
        }
    }
    // Match format: (Class) | (Name) e.g. "HY | Red Bull"
    const matchClassPipe = trimmed.match(/^([A-Za-z0-9\+\-]+)\s*\|\s*(.+)$/)
    if (matchClassPipe) {
        return {
            teamClass: matchClassPipe[1].trim(),
            carNumber: null,
            teamName: cleanTeamName(matchClassPipe[2].trim()),
            hasFormattedTeam: true
        }
    }
    // Match format: #(\d+) (Name) e.g. "#12 Red Bull"
    const matchHash = trimmed.match(/^#(\d+)\s+(.+)$/)
    if (matchHash) {
        return {
            teamClass: null,
            carNumber: matchHash[1].trim(),
            teamName: cleanTeamName(matchHash[2].trim()),
            hasFormattedTeam: true
        }
    }
    // Match format: (Name) #(\d+) e.g. "Red Bull #12"
    const matchEndHash = trimmed.match(/^(.+?)\s+#(\d+)$/)
    if (matchEndHash) {
        return {
            teamClass: null,
            carNumber: matchEndHash[2].trim(),
            teamName: cleanTeamName(matchEndHash[1].trim()),
            hasFormattedTeam: true
        }
    }
    return {
        teamClass: null,
        carNumber: null,
        teamName: cleanTeamName(trimmed),
        hasFormattedTeam: false
    }
}

export const cleanDriverName = (rawName?: string | null): string[] => {
    if (!rawName) return []
    return rawName
        .split(",")
        .map(name => {
            // Trim whitespace and remove leading numbers (e.g. "56 Ahmed Mido" -> "Ahmed Mido", "#33 Max" -> "Max")
            return name.trim().replace(/^#?\d+\s+/, "").trim()
        })
        .filter(name => name.length > 0)
}

export const formatLapTime = (timeMs?: number | null): string => {
    if (!timeMs || timeMs <= 0) return "-"
    const totalSeconds = timeMs / 1000
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = (totalSeconds % 60).toFixed(3).padStart(6, "0")
    return minutes > 0 ? `${minutes}:${seconds}` : `${seconds}`
}

export const breakdownTotalTime = (timeMs?: number | null): ParsedTimeBreakdown => {
    if (!timeMs || timeMs <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, formatted: "-" }
    }
    // Determine hours, minutes, and seconds by dividing TotalTime by 60000 first
    const totalMinutes = timeMs / 60000
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)
    const seconds = (timeMs % 60000) / 1000

    const secFormatted = seconds.toFixed(3).padStart(6, "0")
    let formatted = ""
    if (hours > 0) {
        const minFormatted = String(minutes).padStart(2, "0")
        formatted = `${hours}:${minFormatted}:${secFormatted}`
    } else if (minutes > 0) {
        formatted = `${minutes}:${secFormatted}`
    } else {
        formatted = `${secFormatted}`
    }

    return { hours, minutes, seconds, formatted }
}

export const formatTotalTime = (timeMs?: number | null): string => {
    return breakdownTotalTime(timeMs).formatted
}

export const formatGapTime = (gapMs: number): string => {
    if (gapMs <= 0) return "-"
    const totalMinutes = gapMs / 60000
    const hours = Math.floor(totalMinutes / 60)
    const minutes = Math.floor(totalMinutes % 60)
    const seconds = (gapMs % 60000) / 1000

    if (hours > 0) {
        const minFormatted = String(minutes).padStart(2, "0")
        const secPad = seconds.toFixed(3).padStart(6, "0")
        return `+${hours}:${minFormatted}:${secPad}`
    }
    if (minutes > 0) {
        const secPad = seconds.toFixed(3).padStart(6, "0")
        return `+${minutes}:${secPad}`
    }
    return `+${seconds.toFixed(3)}`
}

export const parseAcsmResult = (jsonData: any): AcsmResultRow[] => {
    if (!jsonData) return []

    // Handle case where result might be wrapped or already an array
    const rawResults = Array.isArray(jsonData) ? jsonData : jsonData.Result || jsonData.results || []
    if (!Array.isArray(rawResults) || rawResults.length === 0) return []

    // Map cars for fast metadata lookup (Team, Nation, Model, Class)
    const carMap = new Map<number, any>()
    const rawCars = jsonData.Cars || jsonData.cars || []
    if (Array.isArray(rawCars)) {
        rawCars.forEach((car: any) => {
            if (car && typeof car.CarId !== "undefined") {
                carMap.set(car.CarId, car)
            }
        })
    }

    // Find the overall fastest valid lap time
    const validLaps = rawResults
        .map((r: any) => Number(r.BestLap) || 0)
        .filter((lap: number) => lap > 0)
    const fastestLapInRace = validLaps.length > 0 ? Math.min(...validLaps) : 0

    // Reference leader for gap calculations
    const leader = rawResults[0]
    const leaderLaps = Number(leader?.NumLaps) || 0
    const leaderTotalTime = Number(leader?.TotalTime) || 0
    const leaderBestLapMs = Number(leader?.BestLap) || 0
    const sessionType = String(jsonData.Type || jsonData.type || jsonData.SessionType || jsonData.sessionType || "").toUpperCase()
    const isQualifying = sessionType.includes("QUAL")

    const classPositions = new Map<string, number>()
    const classLeaderMap = new Map<string, { totalTime: number; bestLapMs: number; laps: number }>()

    // Pre-calculate in-class grid positions and fastest lap per class
    const classGridEntries = new Map<string, any[]>()
    const fastestLapByClass = new Map<string, number>()
    let hasAnyMultipleDrivers = false

    rawResults.forEach((row: any) => {
        const carId = Number(row.CarId)
        const car = carMap.get(carId) || {}
        const rawTeam = car.Driver?.Team || row.Team || "-"
        const parsedTeam = parseTeamInfo(rawTeam)
        const classId = row.ClassID || car.ClassID || car.Driver?.ClassID || null
        const raceClass = parsedTeam.teamClass || (classId && classId !== "00000000-0000-0000-0000-000000000000" ? classId : null)
        const clsKey = raceClass || "__OVERALL__"
        if (!classGridEntries.has(clsKey)) classGridEntries.set(clsKey, [])
        classGridEntries.get(clsKey)!.push(row)

        const lapMs = Number(row.BestLap) || 0
        if (lapMs > 0) {
            const cur = fastestLapByClass.get(clsKey) || Infinity
            if (lapMs < cur) fastestLapByClass.set(clsKey, lapMs)
        }

        const rawDriverName = row.DriverName || car.Driver?.Name || ""
        const dNames = cleanDriverName(rawDriverName)
        if (parsedTeam.hasFormattedTeam || dNames.length > 1 || (car.Drivers && car.Drivers.length > 1)) {
            hasAnyMultipleDrivers = true
        }
    })

    const totalQualifyingCars = rawResults.filter(r => Number(r.GridPosition) > 0).length
    let nextOverallGrid = totalQualifyingCars

    const inClassGridMap = new Map<any, number>()
    classGridEntries.forEach((items) => {
        const withGrid = items.filter(r => Number(r.GridPosition) > 0)
        withGrid.sort((a, b) => Number(a.GridPosition) - Number(b.GridPosition))
        withGrid.forEach((r, rank) => {
            inClassGridMap.set(r, rank + 1)
        })

        if (withGrid.length > 0) {
            let nextInClassGrid = withGrid.length
            const withoutGrid = items.filter(r => !Number(r.GridPosition) || Number(r.GridPosition) <= 0)
            withoutGrid.forEach(r => {
                nextInClassGrid += 1
                inClassGridMap.set(r, nextInClassGrid)
            })
        }
    })

    return rawResults.map((row: any, index: number) => {
        const carId = Number(row.CarId)
        const car = carMap.get(carId) || {}
        const bestLapMs = Number(row.BestLap) || 0
        const numLaps = Number(row.NumLaps) || 0
        const totalTime = Number(row.TotalTime) || 0
        const rawPenalty = Number(row.PenaltyTime) || 0
        // PenaltyTime in ACSM is in nanoseconds: divide by 1,000,000,000 to get seconds
        const penaltyTime = rawPenalty > 0 ? rawPenalty / 1000000000 : 0
        const hasPenalty = Boolean(row.HasPenalty || penaltyTime > 0)

        // Clean driver name (if car driver object exists fallback to that)
        const rawDriverName = row.DriverName || car.Driver?.Name || "Unknown Driver"
        const driverNames = cleanDriverName(rawDriverName)
        const driverName = driverNames.join(", ")
        const rawTeam = car.Driver?.Team || row.Team || "-"
        const parsedTeam = parseTeamInfo(rawTeam)
        const nation = car.Driver?.Nation || ""
        const classId = row.ClassID || car.ClassID || car.Driver?.ClassID || null
        const raceClass = parsedTeam.teamClass || (classId && classId !== "00000000-0000-0000-0000-000000000000" ? classId : null)

        // Class position
        const clsKey = raceClass || "__OVERALL__"
        const classPosition = (classPositions.get(clsKey) || 0) + 1
        classPositions.set(clsKey, classPosition)
        const isClassWinner = classPosition === 1

        if (isClassWinner || !classLeaderMap.has(clsKey)) {
            classLeaderMap.set(clsKey, { totalTime, bestLapMs, laps: numLaps })
        }
        const classLeader = classLeaderMap.get(clsKey)

        // Determine gap from class winner
        let gap = "-"
        if (isClassWinner) {
            if (isQualifying) {
                gap = bestLapMs > 0 ? formatLapTime(bestLapMs) : (totalTime > 0 ? formatLapTime(totalTime) : "-")
            } else {
                gap = totalTime > 0 ? formatTotalTime(totalTime) : (bestLapMs > 0 ? formatLapTime(bestLapMs) : "-")
            }
        } else if (classLeader) {
            if (isQualifying) {
                if (bestLapMs > 0 && classLeader.bestLapMs > 0 && bestLapMs > classLeader.bestLapMs) {
                    const gapMs = bestLapMs - classLeader.bestLapMs
                    gap = formatGapTime(gapMs)
                } else if (totalTime > 0) {
                    gap = formatGapTime(totalTime)
                }
            } else if (classLeader.laps > numLaps && classLeader.laps > 0) {
                const lapsDown = classLeader.laps - numLaps
                gap = `+${lapsDown} ${lapsDown === 1 ? "Lap" : "Laps"}`
            } else if (totalTime > 0 && classLeader.totalTime > 0 && totalTime > classLeader.totalTime && totalTime > 60000 && classLeader.totalTime > 60000) {
                const gapMs = totalTime - classLeader.totalTime
                gap = formatGapTime(gapMs)
            } else if (totalTime > 0) {
                gap = formatGapTime(totalTime)
            } else if (bestLapMs > 0 && classLeader.bestLapMs > 0 && bestLapMs > classLeader.bestLapMs) {
                const gapMs = bestLapMs - classLeader.bestLapMs
                gap = formatGapTime(gapMs)
            }
        }

        let overallGridPos = Number(row.GridPosition) || 0
        if (overallGridPos <= 0 && totalQualifyingCars > 0) {
            nextOverallGrid += 1
            overallGridPos = nextOverallGrid
        }
        const inClassGridPos = inClassGridMap.get(row) || 0
        const effectiveGridPos = inClassGridPos || overallGridPos
        const posDiff = inClassGridPos > 0 ? (inClassGridPos - classPosition) : (overallGridPos > 0 ? (overallGridPos - (index + 1)) : null)

        const isTeamEntry = hasAnyMultipleDrivers || Boolean(parsedTeam.hasFormattedTeam || (driverNames && driverNames.length > 1) || (car.Drivers && car.Drivers.length > 1))
        const classFastestLap = fastestLapByClass.get(clsKey) || fastestLapInRace
        const isFastestLap = bestLapMs > 0 && (bestLapMs === classFastestLap || bestLapMs === fastestLapInRace)

        return {
            position: index + 1,
            classPosition,
            isTeamEntry,
            driverName: isTeamEntry ? (cleanTeamName(parsedTeam.teamName || rawTeam)) : driverName,
            driverNames,
            carModel: row.CarModel || car.Model || "-",
            carId,
            team: rawTeam,
            teamClass: parsedTeam.teamClass,
            carNumber: parsedTeam.carNumber,
            teamName: cleanTeamName(parsedTeam.teamName || rawTeam),
            hasFormattedTeam: parsedTeam.hasFormattedTeam,
            nation,
            numLaps,
            bestLapMs,
            bestLap: formatLapTime(bestLapMs),
            totalTime,
            totalTimeFormatted: formatTotalTime(totalTime),
            isFastestLap,
            isPole: effectiveGridPos === 1,
            gap,
            classId,
            raceClass,
            disqualified: Boolean(row.Disqualified),
            hasPenalty,
            penaltyTime,
            gridPosition: effectiveGridPos || 0,
            posDiff
        }
    })
}
