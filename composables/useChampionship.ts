// ==========================================
// CHAMPIONSHIP DATA ACCESS & RECALCULATION
// ==========================================
// Supabase-facing helpers shared by the admin points/standings tabs and the
// public standings page. Calculation itself lives in useStandings.ts.

import type {
    ChampionshipEventConfig,
    PointsSystem,
    ScoringResult,
    SessionForScoring,
    StandingsEntityType
} from "./useStandings"

export interface ChampionshipRecalcSummary {
    championshipId: string
    championshipName: string
    entityType: StandingsEntityType
    rowsWritten: number
    roundsScored: number
}

// Loads every points system with its rules and bonuses, keyed by id.
export const fetchPointsSystemsMap = async (supabase: any): Promise<Map<string, PointsSystem>> => {
    const { data, error } = await supabase
        .from("points_systems")
        .select(`
            id,
            name,
            description,
            points_system_rules (
                position,
                points
            ),
            points_bonuses (
                bonus_type,
                points,
                requires_classification
            )
        `)

    if (error) throw error

    const map = new Map<string, PointsSystem>()
    for (const sys of data || []) {
        map.set(sys.id, sys)
    }
    return map
}

// Loads the results needed to score a set of schedules, grouped per session.
export const fetchSessionsForScoring = async (
    supabase: any,
    scheduleIds: string[]
): Promise<SessionForScoring[]> => {
    if (scheduleIds.length === 0) return []

    let { data, error } = await supabase
        .from("event_entries")
        .select(`
            id,
            schedule_id,
            driver_id,
            team_id,
            car_number,
            class_id,
            results (
                session_type,
                classified_position,
                scoring_position,
                status,
                grid_position,
                fastest_lap,
                no_points
            )
        `)
        .in("schedule_id", scheduleIds)

    if (error && (error.message?.includes("class_id") || error.message?.includes("car_number") || error.message?.includes("no_points") || error.code === "PGRST204" || error.code === "42703")) {
        const res = await supabase
            .from("event_entries")
            .select(`
                id,
                schedule_id,
                driver_id,
                team_id,
                results (
                    session_type,
                    classified_position,
                    scoring_position,
                    status,
                    grid_position,
                    fastest_lap
                )
            `)
            .in("schedule_id", scheduleIds)
        data = res.data
        error = res.error
    }

    if (error) throw error

    // schedule_id + session_type -> results
    const sessionMap = new Map<string, SessionForScoring>()

    for (const entry of data || []) {
        const dIds: string[] = []
        if (entry.driver_id && !dIds.includes(entry.driver_id)) {
            dIds.push(entry.driver_id)
        }

        for (const res of entry.results || []) {
            const sessionType = res.session_type || "race"
            const key = `${entry.schedule_id}::${sessionType}`
            let session = sessionMap.get(key)
            if (!session) {
                session = {
                    schedule_id: entry.schedule_id,
                    session_type: sessionType,
                    results: []
                }
                sessionMap.set(key, session)
            }
            const scoring: ScoringResult = {
                driver_id: entry.driver_id || (dIds[0] || null),
                driver_ids: dIds,
                team_id: entry.team_id ?? null,
                car_number: entry.car_number ?? null,
                class_id: entry.class_id ?? null,
                scoring_position: res.scoring_position ?? null,
                classified_position: res.classified_position ?? null,
                status: res.status || "finished",
                fastest_lap: Boolean(res.fastest_lap),
                grid_position: res.grid_position ?? null,
                no_points: Boolean(res.no_points)
            }
            session.results.push(scoring)
        }
    }

    return [...sessionMap.values()]
}

// Loads a championship's configured rounds.
export const fetchChampionshipEvents = async (
    supabase: any,
    championshipId: string
): Promise<ChampionshipEventConfig[]> => {
    const { data, error } = await supabase
        .from("championship_events")
        .select("id, schedule_id, session_type, points_system_id, points_multiplier")
        .eq("championship_id", championshipId)

    if (error) throw error
    return (data || []) as ChampionshipEventConfig[]
}

// Recalculates one championship from scratch and rewrites its standings rows.
//
// Full recalculation (rather than incremental) keeps standings self-healing:
// editing an old round's results, changing a points system, or deleting a
// session all produce a correct table on the next run.
export const recalculateChampionship = async (
    supabase: any,
    championship: { id: string; name?: string; standings_type: StandingsEntityType; class_id?: string | null; season_id?: string | null; classes?: { name: string } | null },
    pointsSystems?: Map<string, PointsSystem>
): Promise<ChampionshipRecalcSummary> => {
    const systems = pointsSystems || (await fetchPointsSystemsMap(supabase))
    const champEvents = await fetchChampionshipEvents(supabase, championship.id)

    const scheduleIds = [...new Set(champEvents.map(e => e.schedule_id))]
    const sessions = await fetchSessionsForScoring(supabase, scheduleIds)

    let classId = championship.class_id
    let seasonId = championship.season_id

    if (classId === undefined || seasonId === undefined) {
        const { data: cData } = await supabase
            .from("championships")
            .select("class_id, season_id")
            .eq("id", championship.id)
            .single()
        if (cData) {
            classId = cData.class_id
            seasonId = cData.season_id
        }
    }

    let allowedDriverIds: Set<string> | null = null
    if (classId) {
        let q = supabase.from("season_driver_classes").select("driver_id, class_id").eq("class_id", classId)
        if (seasonId) {
            q = q.eq("season_id", seasonId)
        }
        const { data: sdcList } = await q
        if (sdcList && sdcList.length > 0) {
            allowedDriverIds = new Set(sdcList.map((s: any) => String(s.driver_id)))
        } else {
            allowedDriverIds = new Set()
        }
    }

    const rows = calculateStandings(
        championship.standings_type,
        champEvents,
        sessions,
        systems,
        { allowedDriverIds, allowedClassId: classId || null }
    )

    // Replace the championship's standings wholesale so entities that no
    // longer score are removed rather than left stale.
    const { error: delError } = await supabase
        .from("standings")
        .delete()
        .eq("championship_id", championship.id)
    if (delError) throw delError

    if (rows.length > 0) {
        const payloadWithCarNumber = rows.map(r => ({
            championship_id: championship.id,
            entity_type: r.entity_type,
            driver_id: r.driver_id,
            team_id: r.team_id,
            car_number: r.car_number ?? null,
            points: r.points,
            wins: r.wins,
            podiums: r.podiums,
            position: r.position,
            updated_at: new Date().toISOString()
        }))

        const { error: insError } = await supabase.from("standings").insert(payloadWithCarNumber)
        if (insError) {
            // Fallback if car_number column is not yet present in the standings schema
            if (insError.message?.includes("car_number") || insError.code === "PGRST204" || insError.code === "42703") {
                const payloadWithoutCarNumber = rows.map(r => ({
                    championship_id: championship.id,
                    entity_type: r.entity_type,
                    driver_id: r.driver_id,
                    team_id: r.team_id,
                    points: r.points,
                    wins: r.wins,
                    podiums: r.podiums,
                    position: r.position,
                    updated_at: new Date().toISOString()
                }))
                const { error: fallbackErr } = await supabase.from("standings").insert(payloadWithoutCarNumber)
                if (fallbackErr) throw fallbackErr
            } else {
                throw insError
            }
        }
    }

    const roundsScored = champEvents.filter(e =>
        sessions.some(s => s.schedule_id === e.schedule_id && s.session_type === e.session_type)
    ).length

    const champName = championship.name || championship.classes?.name || "Overall"

    return {
        championshipId: championship.id,
        championshipName: champName,
        entityType: championship.standings_type,
        rowsWritten: rows.length,
        roundsScored
    }
}

// Recalculates every championship that scores a given schedule. Called after
// race results are saved or deleted so standings never go stale.
export const recalculateChampionshipsForSchedule = async (
    supabase: any,
    scheduleId: string
): Promise<ChampionshipRecalcSummary[]> => {
    const { data: champEvents, error } = await supabase
        .from("championship_events")
        .select(`
            championship_id,
            championships (
                id,
                standings_type,
                class_id,
                season_id,
                classes (
                    name
                )
            )
        `)
        .eq("schedule_id", scheduleId)

    if (error) throw error

    const unique = new Map<string, { id: string; name: string; standings_type: StandingsEntityType; class_id?: string | null; season_id?: string | null }>()
    for (const row of champEvents || []) {
        const champ = row.championships
        if (champ && !unique.has(champ.id)) {
            const champName = (champ.classes?.name || "Overall") + ` (${champ.standings_type === "driver" ? "Pembalap" : "Tim"})`
            unique.set(champ.id, {
                id: champ.id,
                name: champName,
                standings_type: champ.standings_type,
                class_id: champ.class_id,
                season_id: champ.season_id
            })
        }
    }

    if (unique.size === 0) return []

    // One shared points-system load for all affected championships.
    const systems = await fetchPointsSystemsMap(supabase)

    const summaries: ChampionshipRecalcSummary[] = []
    for (const champ of unique.values()) {
        summaries.push(await recalculateChampionship(supabase, champ, systems))
    }
    return summaries
}
