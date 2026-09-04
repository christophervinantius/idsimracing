// ==========================================
// CHAMPIONSHIP STANDINGS CALCULATION
// ==========================================
// Pure calculation helpers for turning race results into championship points.
// Kept free of Supabase calls so the logic can be reused and reasoned about
// on both the admin page (recalculation) and the public standings page.

export type StandingsEntityType = "driver" | "team"
export type BonusType = "fastest_lap" | "pole"
export type ResultStatus = "finished" | "dnf" | "dns" | "dsq"

export interface PointsSystemRule {
    position: number
    points: number
}

export interface PointsBonus {
    bonus_type: BonusType
    points: number
    requires_classification: boolean
}

export interface PointsSystem {
    id: string
    name: string
    description?: string | null
    points_system_rules?: PointsSystemRule[]
    points_bonuses?: PointsBonus[]
}

export interface ChampionshipEventConfig {
    id: string
    schedule_id: string
    session_type: string
    points_system_id: string
    points_multiplier: number
}

// One driver/team result within a single session, as needed for scoring
export interface ScoringResult {
    driver_id: string | null
    driver_ids?: string[] // All drivers assigned to this car entry
    team_id: number | null
    car_number?: number | null // Subteam / car number (e.g. 50, 51)
    class_id?: string | null
    scoring_position: number | null
    classified_position: number | null
    status: ResultStatus
    fastest_lap: boolean
    grid_position: number | null
    no_points?: boolean
}

export interface StandingsRow {
    entity_type: StandingsEntityType
    driver_id: string | null
    team_id: number | null
    car_number?: number | null
    points: number
    wins: number
    podiums: number
    position: number | null
}

// A status only scores if the driver finished and was classified.
// DNF, DNS, and DSQ never score position points.
export const isScoringStatus = (status?: ResultStatus | string | null): boolean => {
    if (!status) return true
    const normalized = String(status).toLowerCase().trim()
    return normalized === "finished"
}

export const isClassified = (result: ScoringResult): boolean => {
    if (!result) return false
    const status = String(result.status || "").toLowerCase().trim()
    if (status === "dnf" || status === "dns" || status === "dsq") return false
    return result.classified_position !== null && result.classified_position !== undefined
}

// Points for a finishing position from the system's rule table.
// Positions outside the table score nothing.
export const getPositionPoints = (system: PointsSystem | null | undefined, position: number | null): number => {
    if (!system || !position || position < 1) return 0
    const rules = system.points_system_rules || []
    const rule = rules.find(r => Number(r.position) === Number(position))
    return rule ? Number(rule.points) || 0 : 0
}

// Bonus points (fastest lap / pole) for a single result.
export const getBonusPoints = (
    system: PointsSystem | null | undefined,
    result: ScoringResult,
    isPole: boolean
): number => {
    if (!system) return 0
    const bonuses = system.points_bonuses || []
    if (bonuses.length === 0) return 0

    let total = 0

    for (const bonus of bonuses) {
        if (bonus.bonus_type === "fastest_lap" && result.fastest_lap) {
            total += Number(bonus.points) || 0
        } else if (bonus.bonus_type === "pole" && isPole) {
            total += Number(bonus.points) || 0
        }
    }

    return total
}

// Total points a single result earns in one session, multiplier applied.
// The multiplier scales position and bonus points together, which is how
// double-points finales are normally run.
export const calculateResultPoints = (
    system: PointsSystem | null | undefined,
    result: ScoringResult,
    options: { isPole?: boolean; multiplier?: number } = {}
): number => {
    if (result.no_points) return 0

    const multiplier = options.multiplier === undefined || options.multiplier === null
        ? 1
        : Number(options.multiplier) || 0

    // Position finish points require finishing and classification. DNF/DNS/DSQ earn 0 position points.
    const canScorePosition = isScoringStatus(result.status) && isClassified(result)
    const scoringPos = result.scoring_position ?? result.classified_position
    const base = canScorePosition ? getPositionPoints(system, scoringPos) : 0

    // Bonus points (pole position and fastest lap) are awarded even if a driver DNFs or gets DSQ
    const bonus = getBonusPoints(system, result, Boolean(options.isPole))

    return (base + bonus) * multiplier
}

// Pole is grid position 1 within a session. Derived rather than stored so it
// stays correct when grid positions are edited.
export const findPoleEntityKeys = (results: ScoringResult[], entityType: StandingsEntityType): Set<string> => {
    const keys = new Set<string>()
    for (const r of results) {
        if (Number(r.grid_position) === 1) {
            if (entityType === "driver") {
                const dIds = r.driver_ids && r.driver_ids.length > 0 ? r.driver_ids : (r.driver_id ? [r.driver_id] : [])
                dIds.forEach(id => {
                    if (id) keys.add(String(id))
                })
            } else {
                if (r.team_id !== null && r.team_id !== undefined) {
                    const teamKey = (r.car_number !== null && r.car_number !== undefined)
                        ? `${r.team_id}::${r.car_number}`
                        : String(r.team_id)
                    keys.add(teamKey)
                }
            }
        }
    }
    return keys
}

export interface SessionForScoring {
    schedule_id: string
    session_type: string
    results: ScoringResult[]
}

// Full championship recalculation: walks every configured round, applies that
// round's points system and multiplier, and aggregates into standings rows.
//
// For endurance multi-driver cars, every driver registered to the car entry
// receives the points earned by the car in that session.
// For team standings, subteams/cars with distinct car numbers (e.g. Ferrari AF Corse #50
// vs Ferrari AF Corse #51) compete as distinct standings entities with their own points and positions.
export const calculateStandings = (
    entityType: StandingsEntityType,
    championshipEvents: ChampionshipEventConfig[],
    sessions: SessionForScoring[],
    pointsSystems: Map<string, PointsSystem>,
    options: { allowedDriverIds?: Set<string> | null; allowedClassId?: string | null } = {}
): StandingsRow[] => {
    // key -> aggregate
    const agg = new Map<string, { points: number; wins: number; podiums: number; finishPositions: number[] }>()

    const bump = (key: string, points: number, bestPos: number | null, win: boolean, podium: boolean) => {
        const cur = agg.get(key) || { points: 0, wins: 0, podiums: 0, finishPositions: [] }
        cur.points += points
        if (win) cur.wins += 1
        if (podium) cur.podiums += 1
        if (bestPos !== null && bestPos !== undefined) {
            cur.finishPositions.push(bestPos)
        }
        agg.set(key, cur)
    }

    for (const champEvent of championshipEvents) {
        const session = sessions.find(
            s => s.schedule_id === champEvent.schedule_id && s.session_type === champEvent.session_type
        )
        if (!session || session.results.length === 0) continue

        const system = pointsSystems.get(champEvent.points_system_id) || null
        const multiplier = champEvent.points_multiplier
        const poleKeys = findPoleEntityKeys(session.results, entityType)

        const sessionAgg = new Map<string, { points: number; bestPos: number | null }>()

        for (const result of session.results) {
            const entityKeys: string[] = []
            if (entityType === "driver") {
                const dIds = result.driver_ids && result.driver_ids.length > 0 ? result.driver_ids : (result.driver_id ? [result.driver_id] : [])
                dIds.forEach(id => {
                    if (id) {
                        if (!options.allowedDriverIds || options.allowedDriverIds.has(String(id))) {
                            entityKeys.push(String(id))
                        }
                    }
                })
            } else {
                if (result.team_id !== null && result.team_id !== undefined) {
                    const dIds = result.driver_ids && result.driver_ids.length > 0 ? result.driver_ids : (result.driver_id ? [result.driver_id] : [])
                    const belongsToDriverClass = !options.allowedDriverIds || dIds.length === 0 || dIds.some(id => id && options.allowedDriverIds!.has(String(id)))
                    const belongsToEntryClass = !options.allowedClassId || !result.class_id || result.class_id === options.allowedClassId
                    const belongsToClass = belongsToDriverClass && belongsToEntryClass
                    if (belongsToClass) {
                        const teamKey = (result.car_number !== null && result.car_number !== undefined)
                            ? `${result.team_id}::${result.car_number}`
                            : String(result.team_id)
                        entityKeys.push(teamKey)
                    }
                }
            }

            for (const key of entityKeys) {
                const points = calculateResultPoints(system, result, {
                    isPole: poleKeys.has(key),
                    multiplier
                })

                const cur = sessionAgg.get(key) || { points: 0, bestPos: null }
                cur.points += points

                // Only a classified, scoring finish counts toward wins/podiums and countback.
                if (isScoringStatus(result.status) && isClassified(result)) {
                    const pos = result.scoring_position ?? result.classified_position
                    if (pos !== null && pos !== undefined) {
                        if (cur.bestPos === null || Number(pos) < cur.bestPos) cur.bestPos = Number(pos)
                    }
                }
                sessionAgg.set(key, cur)
            }
        }

        for (const [key, val] of sessionAgg) {
            const win = val.bestPos === 1
            const podium = val.bestPos !== null && val.bestPos <= 3
            bump(key, val.points, val.bestPos, win, podium)
        }
    }

    // Helper to compare finish positions for countback (most 1sts, then 2nds, 3rds, 4ths, etc.)
    const compareFinishPositions = (posA: number[], posB: number[]): number => {
        if (!posA.length && !posB.length) return 0
        const allPos = [...posA, ...posB]
        const maxPos = allPos.length > 0 ? Math.max(...allPos) : 100
        for (let p = 1; p <= maxPos; p++) {
            const countA = posA.filter(pos => pos === p).length
            const countB = posB.filter(pos => pos === p).length
            if (countB !== countA) {
                return countB - countA // Higher count of position p ranks higher
            }
        }
        return 0
    }

    // Rank: points desc, then countback of best finish positions, then wins/podiums.
    const rows: StandingsRow[] = [...agg.entries()].map(([key, val]) => {
        let driverId: string | null = null
        let teamId: number | null = null
        let carNumber: number | null = null

        if (entityType === "driver") {
            driverId = key
        } else {
            if (key.includes("::")) {
                const [tIdStr, numStr] = key.split("::")
                teamId = Number(tIdStr)
                carNumber = Number(numStr)
            } else {
                teamId = Number(key)
            }
        }

        return {
            entity_type: entityType,
            driver_id: driverId,
            team_id: teamId,
            car_number: carNumber,
            points: Number(val.points.toFixed(2)),
            wins: val.wins,
            podiums: val.podiums,
            position: null
        }
    })

    rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const keyA = a.entity_type === "driver" ? a.driver_id! : (a.car_number !== null && a.car_number !== undefined ? `${a.team_id}::${a.car_number}` : String(a.team_id))
        const keyB = b.entity_type === "driver" ? b.driver_id! : (b.car_number !== null && b.car_number !== undefined ? `${b.team_id}::${b.car_number}` : String(b.team_id))
        const finishA = agg.get(keyA)?.finishPositions || []
        const finishB = agg.get(keyB)?.finishPositions || []
        const countback = compareFinishPositions(finishA, finishB)
        if (countback !== 0) return countback
        if (b.wins !== a.wins) return b.wins - a.wins
        return b.podiums - a.podiums
    })

    // Equal points and identical finishing records share a position (dead heat).
    let lastPos = 0
    rows.forEach((row, idx) => {
        const prev = idx > 0 ? rows[idx - 1] : null
        let tied = false
        if (prev && prev.points === row.points) {
            const keyRow = row.entity_type === "driver" ? row.driver_id! : (row.car_number !== null && row.car_number !== undefined ? `${row.team_id}::${row.car_number}` : String(row.team_id))
            const keyPrev = prev.entity_type === "driver" ? prev.driver_id! : (prev.car_number !== null && prev.car_number !== undefined ? `${prev.team_id}::${prev.car_number}` : String(prev.team_id))
            const finishRow = agg.get(keyRow)?.finishPositions || []
            const finishPrev = agg.get(keyPrev)?.finishPositions || []
            tied = compareFinishPositions(finishRow, finishPrev) === 0
        }
        lastPos = tied ? lastPos : idx + 1
        row.position = lastPos
    })

    return rows
}

// Formats points for display: integers stay integers, halves keep one decimal.
export const formatPoints = (points?: number | null): string => {
    const n = Number(points) || 0
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

// Preset rule tables offered when creating a new points system.
export const POINTS_SYSTEM_PRESETS: { name: string; description: string; rules: number[] }[] = [
    {
        name: "F1 Modern (25-18-15)",
        description: "Formula 1 2010-present, top 10 score",
        rules: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]
    },
    {
        name: "F1 Classic (10-6-4)",
        description: "Formula 1 1991-2002, top 6 score",
        rules: [10, 6, 4, 3, 2, 1]
    },
    {
        name: "Sprint (8-7-6)",
        description: "F1 sprint style, top 8 score",
        rules: [8, 7, 6, 5, 4, 3, 2, 1]
    },
    {
        name: "GT World Challenge (25-18-15)",
        description: "Top 15 score, endurance style",
        rules: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1, 0.5, 0.5, 0.5, 0.5, 0.5]
    },
    {
        name: "Top 20 Linear",
        description: "20 down to 1, every finisher in top 20 scores",
        rules: [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
    }
]
