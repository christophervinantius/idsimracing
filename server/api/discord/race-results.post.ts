export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const scheduleId = body?.scheduleId
    const targetSessionType = (body?.sessionType || "race").toLowerCase()

    if (!scheduleId) {
        throw createError({
            statusCode: 400,
            statusMessage: "scheduleId is required"
        })
    }

    const supabase = useServerSupabase()
    const config = useRuntimeConfig()
    const siteUrl = (config.siteUrl || "https://idsimracing.com").replace(/\/$/, "")

    // 1. Fetch Schedule & Event metadata
    const { data: schedule, error: schedErr } = await supabase
        .from("schedule")
        .select(`
            id,
            round,
            season,
            date,
            circuit,
            country,
            country_2,
            custom_session_names,
            events (
                id,
                name,
                games (
                    name,
                    abbreviation
                ),
                organizers (
                    name,
                    abbreviation
                )
            )
        `)
        .eq("id", scheduleId)
        .single()

    if (schedErr || !schedule) {
        throw createError({
            statusCode: 404,
            statusMessage: `Schedule ${scheduleId} not found`
        })
    }

    // Helpers for team and driver naming
    const cleanTeamName = (rawTeam?: string | null): string => {
        if (!rawTeam) return ""
        let trimmed = rawTeam.trim()
        const m1 = trimmed.match(/^([A-Za-z0-9\+\-]+)\s+(\d+)\s*\|\s*(.+)$/)
        if (m1) return m1[3].trim()
        const mClassPipe = trimmed.match(/^([A-Za-z0-9\+\-]+)\s*\|\s*(.+)$/)
        if (mClassPipe) return mClassPipe[2].trim()
        const m2 = trimmed.match(/^(\d+)\s*\|\s*(.+)$/)
        if (m2) return m2[2].trim()
        trimmed = trimmed.replace(/^#?\d+\s*[-|:]?\s*/, "")
        trimmed = trimmed.replace(/\s*#\d+$/, "").replace(/\s*\(\d+\)$/, "")
        return trimmed.trim()
    }

    const extractCarNumber = (rawNumber: any, rawTeamName?: string | null): string => {
        if (rawNumber !== null && rawNumber !== undefined && String(rawNumber).trim() !== "") {
            return String(rawNumber).trim().replace(/^#/, "")
        }
        if (!rawTeamName) return ""
        const trimmed = rawTeamName.trim()
        const m1 = trimmed.match(/^([A-Za-z0-9\+\-]+)\s+(\d+)\s*\|\s*(.+)$/)
        if (m1) return m1[2].trim()
        const m2 = trimmed.match(/^(\d+)\s*\|\s*(.+)$/)
        if (m2) return m2[1].trim()
        const mHash = trimmed.match(/^#(\d+)\s+(.+)$/)
        if (mHash) return mHash[1].trim()
        const mEndHash = trimmed.match(/^(.+?)\s+#(\d+)$/)
        if (mEndHash) return mEndHash[2].trim()
        return ""
    }

    const cleanSessionSuffix = (text?: string | null): string => {
        if (!text) return ""
        return text
            .replace(/\s*-\s*(Qualifying|Quali|Race(?:\s*\d+)?)\b/gi, "")
            .trim()
    }

    const getDriverCountryCode = (driver: any): string => {
        if (!driver) return ""
        if (driver.countries?.code) return String(driver.countries.code).trim().toLowerCase()
        if (driver.country_code) return String(driver.country_code).trim().toLowerCase()
        if (driver.country && String(driver.country).length === 2 && isNaN(Number(driver.country))) {
            return String(driver.country).trim().toLowerCase()
        }
        return ""
    }

    // 2. Fetch event entries with results, drivers, teams, entry_type, and car_number
    const { data: entries, error: entriesErr } = await supabase
        .from("event_entries")
        .select(`
            id,
            schedule_id,
            class_id,
            entry_type,
            driver_id,
            team_id,
            car_number,
            drivers (
                id,
                name,
                country,
                countries (
                    code,
                    name
                )
            ),
            teams (
                id,
                name
            ),
            results (
                id,
                session_type,
                classified_position,
                scoring_position,
                status,
                best_lap_ms,
                fastest_lap,
                is_provisional
            )
        `)
        .eq("schedule_id", scheduleId)

    if (entriesErr) {
        throw createError({
            statusCode: 500,
            statusMessage: "Failed to fetch event entries: " + entriesErr.message
        })
    }

    // 2b. Fetch classes for this event (to display class names for multiclass races)
    const eventId = schedule.events?.id
    let eventClasses: Array<{ id: string; name: string }> = []
    if (eventId) {
        const { data: clsData } = await supabase
            .from("classes")
            .select("id, name")
            .eq("event_id", eventId)
        eventClasses = clsData || []
    }

    const classMap = new Map<string, string>()
    for (const c of eventClasses) {
        if (c.id && c.name) {
            classMap.set(String(c.id), c.name)
        }
    }

    // 3. Flatten entries into session results
    const isTeamEvent = (entries || []).some((e: any) => e.entry_type === "team" || (!e.driver_id && e.team_id))

    const sessionResults: Array<{
        displayName: string
        driverName: string
        teamName?: string
        position: number
        scoringPosition?: number
        status: string
        sessionType: string
        classId?: string
        isTeam: boolean
        isProvisional: boolean
    }> = []

    for (const entry of entries || []) {
        const isEntryTeam = isTeamEvent || entry.entry_type === "team" || (!entry.driver_id && entry.team_id)
        const rawTeamName = (entry.teams as any)?.name
        const cleanedTeam = cleanTeamName(rawTeamName)
        const teamName = cleanedTeam || rawTeamName || ""
        const carNum = extractCarNumber(entry.car_number, rawTeamName)

        let displayName = ""
        let driverName = ""

        if (isEntryTeam) {
            displayName = carNum ? `${carNum} - ${teamName || "Team"}` : (teamName || "Team")
            driverName = teamName || "Team"
        } else {
            const rawDriver = entry.drivers as any
            driverName = rawDriver?.name || "Unknown Driver"
            const countryCode = getDriverCountryCode(rawDriver)
            const flagEmoji = countryCode ? getCountryFlagEmoji(countryCode) : ""
            const driverWithFlag = flagEmoji ? `${flagEmoji} ${driverName}` : driverName
            displayName = teamName ? `${driverWithFlag} (${teamName})` : driverWithFlag
        }

        const classId = entry.class_id ? String(entry.class_id) : undefined

        for (const res of entry.results || []) {
            const sType = (res.session_type || "race").toLowerCase()
            const pos = res.classified_position || 999
            sessionResults.push({
                displayName,
                driverName,
                teamName: teamName || undefined,
                position: pos,
                scoringPosition: res.scoring_position,
                status: (res.status || "finished").toUpperCase(),
                sessionType: sType,
                classId,
                isTeam: isEntryTeam,
                isProvisional: Boolean(res.is_provisional)
            })
        }
    }

    if (sessionResults.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "No results found for this event schedule."
        })
    }

    // Detect multiclass: distinct class IDs used among results
    const usedClassIds = Array.from(new Set(sessionResults.map(r => r.classId).filter(Boolean))) as string[]
    const isMulticlass = usedClassIds.length > 1

    // Header metadata formatting
    const organizerAbbr = schedule.events?.organizers?.abbreviation?.trim() || schedule.events?.organizers?.name?.trim() || ""
    const rawEventName = cleanSessionSuffix(schedule.events?.name?.trim()) || "Championship"

    let eventFull = rawEventName
    if (organizerAbbr && !rawEventName.toLowerCase().startsWith(organizerAbbr.toLowerCase())) {
        eventFull = `${organizerAbbr} ${rawEventName}`.trim()
    }

    const rawSeason = schedule.season
    let seasonPart = ""
    if (rawSeason !== null && rawSeason !== undefined && String(rawSeason).trim() !== "") {
        const s = String(rawSeason).trim()
        if (s.toLowerCase().startsWith("season") || s.toLowerCase().startsWith("s")) {
            seasonPart = s.startsWith("(") ? s : `(${s})`
        } else {
            seasonPart = `(S${s})`
        }
    }

    const eventWithSeason = seasonPart ? `${eventFull} ${seasonPart}` : eventFull

    const rawRound = schedule.round
    let roundPart = ""
    if (rawRound !== null && rawRound !== undefined && String(rawRound).trim() !== "") {
        const r = String(rawRound).trim()
        roundPart = r.toLowerCase().startsWith("round") ? r : `Round ${r}`
    } else {
        roundPart = "-"
    }

    const circuitName = cleanSessionSuffix(schedule.circuit?.trim()) || "Circuit"
    const flagEmojis = [
        getCountryFlagEmoji(schedule.country),
        getCountryFlagEmoji(schedule.country_2)
    ].filter(Boolean).join(" ")
    const circuitWithFlag = flagEmojis ? `${flagEmojis} ${circuitName}` : circuitName

    // (organizer abbreviation) (event name) (season) - (round) (circuit)
    const eventCore = `${eventWithSeason} - ${roundPart} (${circuitWithFlag})`

    const customNames = (schedule.custom_session_names as Record<string, string>) || {}

    // Helper to format a single podium block for a given set of session results
    const formatPodiumBlock = (sessionLabel: string, results: typeof sessionResults) => {
        const sorted = [...results].sort((a, b) => {
            if (a.scoringPosition && b.scoringPosition && a.scoringPosition !== b.scoringPosition) {
                return a.scoringPosition - b.scoringPosition
            }
            return a.position - b.position
        })
        const p1 = sorted[0]
        const p2 = sorted[1]
        const p3 = sorted[2]

        const lines = [
            `P1: ${p1 ? p1.displayName : "-"}`,
            `P2: ${p2 ? p2.displayName : "-"}`,
            `P3: ${p3 ? p3.displayName : "-"}`
        ]

        return [
            `**Podium Finishers (${sessionLabel})**`,
            lines.join("\n")
        ].join("\n")
    }

    // Helper to build podium blocks for a session (per-class if multiclass, single block otherwise)
    const buildSessionPodiums = (sessionLabel: string, results: typeof sessionResults) => {
        if (!isMulticlass) {
            return [formatPodiumBlock(sessionLabel, results)]
        }

        const blocks: string[] = []
        // Preserve defined event classes order
        const orderedClassIds = eventClasses.map(c => String(c.id)).filter(id => usedClassIds.includes(id))
        const remainingClassIds = usedClassIds.filter(id => !orderedClassIds.includes(id))
        const finalClassIds = [...orderedClassIds, ...remainingClassIds]

        for (const cId of finalClassIds) {
            const classResults = results.filter(r => r.classId === cId)
            if (classResults.length === 0) continue
            const className = classMap.get(cId) || "Class"
            const title = `${sessionLabel} - ${className}`
            blocks.push(formatPodiumBlock(title, classResults))
        }

        if (blocks.length === 0) {
            blocks.push(formatPodiumBlock(sessionLabel, results))
        }

        return blocks
    }

    const podiumBlocks: string[] = []

    // Detect if this schedule has multiple races (e.g. race_1 and race_2)
    const hasRace1 = sessionResults.some(r => r.sessionType === "race_1" || r.sessionType === "race1" || r.sessionType === "r1")
    const hasRace2 = sessionResults.some(r => r.sessionType === "race_2" || r.sessionType === "race2" || r.sessionType === "r2")
    const hasMultipleRaces = hasRace1 || hasRace2

    if (targetSessionType.includes("qual")) {
        // Specific Qualifying request
        const qualiResults = sessionResults.filter(r => r.sessionType.includes("qual") || r.sessionType === "q")
        const label = customNames.qualifying || "Qualifying"
        podiumBlocks.push(...buildSessionPodiums(label, qualiResults.length > 0 ? qualiResults : sessionResults))
    } else if (hasMultipleRaces) {
        // Multiple races: show Race 1, followed by Race 2 below
        const r1Results = sessionResults.filter(r => r.sessionType === "race_1" || r.sessionType === "race1" || r.sessionType === "r1" || r.sessionType === "race")
        const r2Results = sessionResults.filter(r => r.sessionType === "race_2" || r.sessionType === "race2" || r.sessionType === "r2")

        if (r1Results.length > 0) {
            const label1 = customNames.race_1 || "Race 1"
            podiumBlocks.push(...buildSessionPodiums(label1, r1Results))
        }
        if (r2Results.length > 0) {
            const label2 = customNames.race_2 || "Race 2"
            podiumBlocks.push(...buildSessionPodiums(label2, r2Results))
        }
    } else {
        // Single race
        const singleRaceResults = sessionResults.filter(r => r.sessionType.includes("race"))
        const label = customNames.race || "Race"
        podiumBlocks.push(...buildSessionPodiums(label, singleRaceResults.length > 0 ? singleRaceResults : sessionResults))
    }

    const resultPageUrl = `${siteUrl}/results/${scheduleId}`

    // Formatted caption matching:
    // Race results for (organizer abbreviation) (event name) (season) - (round) (circuit) are now finalized!
    //
    // Podium Finishers (Race - Class)
    // P1:
    // P2:
    // P3:
    //
    // View full results on idsimracing.com
    // Check if the posted results are provisional
    let activeResults = sessionResults
    if (targetSessionType.includes("qual")) {
        const q = sessionResults.filter(r => r.sessionType.includes("qual") || r.sessionType === "q")
        if (q.length > 0) activeResults = q
    } else {
        const r = sessionResults.filter(r => r.sessionType.includes("race") || r.sessionType.startsWith("r"))
        if (r.length > 0) activeResults = r
    }
    const isProvisional = activeResults.some(r => r.isProvisional)

    const headline = isProvisional
        ? `Race results for **${eventCore}** are published. **Note that these results are not final yet - subject to post-race investigations.**`
        : `Race results for **${eventCore}** are now finalized!`

    const caption = [
        headline,
        "",
        podiumBlocks.join("\n\n"),
        "",
        `[View full results on idsimracing.com](${resultPageUrl})`
    ].join("\n")

    const embed: DiscordEmbed = {
        title: isProvisional
            ? `⚠️ PROVISIONAL RESULTS: ${eventWithSeason} - ${roundPart}`
            : `🏆 FINAL RESULTS: ${eventWithSeason} - ${roundPart}`,
        url: resultPageUrl,
        description: caption,
        color: BRAND_GOLD,
        footer: {
            text: `idsimracing.com`,
            icon_url: `${siteUrl}/pwa-192x192.png`
        },
        timestamp: new Date().toISOString()
    }

    const result = await sendDiscordWebhook("results", {
        embeds: [embed]
    })

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: result.message
        })
    }

    return result
})
