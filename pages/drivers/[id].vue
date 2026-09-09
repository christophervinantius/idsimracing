<script setup>
    import { calculateResultPoints } from "~/composables/useStandings"
    import { formatLapTime, parseTeamInfo } from "~/composables/useRaceResult"

    const route = useRoute()
    const router = useRouter()
    const { t } = useI18n()
    const { $supabase } = useNuxtApp()

    const driverParam = computed(() => route.params.id)

    // Check if parameter is a UUID
    const isUUID = (val) => {
        if (!val || typeof val !== "string") return false
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim())
    }

    // 1. Fetch Driver Profile
    const { data: driver, pending: loadingDriver } = await useAsyncData(`driver-profile-${driverParam.value}`, async () => {
        if (!driverParam.value) return null
        try {
            const rawParam = String(driverParam.value).trim()
            let query = $supabase
                .from("drivers")
                .select(`
                    id,
                    name,
                    rating,
                    country,
                    team,
                    organizer,
                    countries (
                        id,
                        name,
                        code
                    ),
                    teams (
                        id,
                        name
                    ),
                    organizers (
                        id,
                        abbreviation,
                        name
                    )
                `)

            if (isUUID(rawParam)) {
                const { data, error } = await query.eq("id", rawParam).maybeSingle()
                if (data) return data
                if (error) console.warn("Driver fetch error by ID:", error)
            }

            // Fallback: search by name
            const decoded = decodeURIComponent(rawParam)
            const { data: byName, error: nameErr } = await $supabase
                .from("drivers")
                .select(`
                    id,
                    name,
                    rating,
                    country,
                    team,
                    organizer,
                    countries (
                        id,
                        name,
                        code
                    ),
                    teams (
                        id,
                        name
                    ),
                    organizers (
                        id,
                        abbreviation,
                        name
                    )
                `)
                .ilike("name", decoded)
                .limit(1)
                .maybeSingle()

            if (nameErr) {
                console.warn("Driver fetch error by name:", nameErr)
                return null
            }
            return byName
        } catch (e) {
            console.error("Driver fetch error:", e)
            return null
        }
    })

    const driverId = computed(() => driver.value?.id)

    // 2. Fetch Driver Event Entries & Results
    const { data: driverEntries, pending: loadingEntries } = await useAsyncData(
        `driver-entries-${driverId.value}`,
        async () => {
            if (!driverId.value) return []
            try {
                let { data, error } = await $supabase
                    .from("event_entries")
                    .select(`
                        id,
                        schedule_id,
                        car_number,
                        car_model,
                        class_id,
                        classes (
                            id,
                            name
                        ),
                        teams (
                            id,
                            name
                        ),
                        schedule (
                            id,
                            round,
                            date,
                            finish_date,
                            circuit,
                            country,
                            country_2,
                            season,
                            events (
                                id,
                                name,
                                games (
                                    abbreviation,
                                    name
                                ),
                                organizers (
                                    abbreviation,
                                    name
                                )
                            )
                        ),
                        results (
                            id,
                            session_type,
                            classified_position,
                            scoring_position,
                            status,
                            grid_position,
                            num_laps,
                            best_lap_ms,
                            total_time_ms,
                            has_penalty,
                            penalty_time_ns,
                            fastest_lap,
                            is_provisional,
                            no_points
                        )
                    `)
                    .eq("driver_id", driverId.value)

                if (error && (error.message?.includes("classes") || error.code === "PGRST204" || error.code === "42703")) {
                    const res = await $supabase
                        .from("event_entries")
                        .select(`
                            id,
                            schedule_id,
                            car_number,
                            car_model,
                            class_id,
                            teams (
                                id,
                                name
                            ),
                            schedule (
                                id,
                                round,
                                date,
                                finish_date,
                                circuit,
                                country,
                                country_2,
                                season,
                                events (
                                    id,
                                    name,
                                    games (
                                        abbreviation,
                                        name
                                    ),
                                    organizers (
                                        abbreviation,
                                        name
                                    )
                                )
                            ),
                            results (
                                id,
                                session_type,
                                classified_position,
                                scoring_position,
                                status,
                                grid_position,
                                num_laps,
                                best_lap_ms,
                                total_time_ms,
                                has_penalty,
                                penalty_time_ns,
                                fastest_lap,
                                is_provisional,
                                no_points
                            )
                        `)
                        .eq("driver_id", driverId.value)
                    data = res.data
                    error = res.error
                }

                if (error) {
                    console.warn("Error fetching driver entries:", error)
                    return []
                }
                return data || []
            } catch (err) {
                console.error("Error fetching driver entries:", err)
                return []
            }
        },
        { watch: [driverId] }
    )

    // 3. Fetch Championship Events & Points Systems for these schedules
    const scheduleIds = computed(() => {
        if (!driverEntries.value) return []
        return [...new Set(driverEntries.value.map(e => e.schedule_id).filter(Boolean))]
    })

    const eventIds = computed(() => {
        if (!driverEntries.value) return []
        return [...new Set(driverEntries.value.map(e => e.schedule?.events?.id).filter(Boolean))]
    })

    const { data: allEventClasses } = await useAsyncData(
        `driver-event-classes-${driverId.value}`,
        async () => {
            if (!eventIds.value || eventIds.value.length === 0) return []
            try {
                const { data, error } = await $supabase
                    .from("classes")
                    .select("id, name, event_id")
                    .in("event_id", eventIds.value)
                if (error) return []
                return data || []
            } catch {
                return []
            }
        },
        { watch: [eventIds] }
    )

    const multiclassEventIds = computed(() => {
        const counts = new Map()
        for (const c of (allEventClasses.value || [])) {
            if (c.event_id) {
                counts.set(c.event_id, (counts.get(c.event_id) || 0) + 1)
            }
        }
        const set = new Set()
        for (const [eventId, count] of counts.entries()) {
            if (count > 1) {
                set.add(eventId)
            }
        }
        return set
    })

    const { data: champEvents } = await useAsyncData(
        `driver-champ-events-${driverId.value}`,
        async () => {
            if (!scheduleIds.value || scheduleIds.value.length === 0) return []
            try {
                let { data, error } = await $supabase
                    .from("championship_events")
                    .select(`
                        id,
                        championship_id,
                        schedule_id,
                        session_type,
                        points_system_id,
                        points_multiplier,
                        scoring_mode,
                        points_system:points_systems (
                            id,
                            name,
                            points_system_rules (
                                position,
                                points
                            ),
                            points_bonuses (
                                bonus_type,
                                points,
                                requires_classification
                            )
                        )
                    `)
                    .in("schedule_id", scheduleIds.value)

                if (error && (error.message?.includes("scoring_mode") || error.code === "PGRST204" || error.code === "42703")) {
                    const retry = await $supabase
                        .from("championship_events")
                        .select(`
                            id,
                            championship_id,
                            schedule_id,
                            session_type,
                            points_system_id,
                            points_multiplier,
                            points_system:points_systems (
                                id,
                                name,
                                points_system_rules (
                                    position,
                                    points
                                ),
                                points_bonuses (
                                    bonus_type,
                                    points,
                                    requires_classification
                                )
                            )
                        `)
                        .in("schedule_id", scheduleIds.value)
                    data = retry.data
                    error = retry.error
                }

                if (error) {
                    console.warn("Error fetching champ events:", error)
                    return []
                }
                return data || []
            } catch (e) {
                console.error("Champ events error:", e)
                return []
            }
        },
        { watch: [scheduleIds] }
    )

    // Map schedule_id + session_type to Points System / Champ Event
    const pointsMap = computed(() => {
        const map = new Map()
        for (const ce of (champEvents.value || [])) {
            const sess = ce.session_type || "race"
            map.set(`${ce.schedule_id}::${sess}`, ce)
            // also index without session as fallback
            if (!map.has(ce.schedule_id)) {
                map.set(ce.schedule_id, ce)
            }
        }
        return map
    })

    // 4. Fetch Driver Standings & Championships
    const { data: driverStandings } = await useAsyncData(
        `driver-standings-${driverId.value}`,
        async () => {
            if (!driverId.value) return []
            try {
                const { data, error } = await $supabase
                    .from("standings")
                    .select(`
                        id,
                        championship_id,
                        position,
                        points,
                        wins,
                        podiums,
                        entity_type,
                        championships (
                            id,
                            standings_type,
                            classes (
                                id,
                                name
                            ),
                            seasons (
                                id,
                                season_number,
                                events (
                                    id,
                                    name,
                                    games (
                                        abbreviation,
                                        name
                                    ),
                                    organizers (
                                        abbreviation,
                                        name
                                    )
                                )
                            ),
                            championship_events (
                                id,
                                schedule_id,
                                schedule (
                                    id,
                                    date,
                                    finish_date,
                                    is_postponed
                                )
                            )
                        )
                    `)
                    .eq("driver_id", driverId.value)

                if (error) {
                    console.warn("Driver standings fetch error:", error)
                    return []
                }
                return data || []
            } catch (e) {
                console.error("Driver standings fetch error:", e)
                return []
            }
        },
        { watch: [driverId] }
    )

    // Country Mapping Helpers
    const COUNTRY_MAP = {
        "australia": { code: "au", abbr: "AUS" },
        "austria": { code: "at", abbr: "AUT" },
        "azerbaijan": { code: "az", abbr: "AZE" },
        "bahrain": { code: "bh", abbr: "BHR" },
        "belgium": { code: "be", abbr: "BEL" },
        "brazil": { code: "br", abbr: "BRA" },
        "canada": { code: "ca", abbr: "CAN" },
        "china": { code: "cn", abbr: "CHN" },
        "france": { code: "fr", abbr: "FRA" },
        "germany": { code: "de", abbr: "GER" },
        "great britain": { code: "gb", abbr: "GBR" },
        "united kingdom": { code: "gb", abbr: "GBR" },
        "hungary": { code: "hu", abbr: "HUN" },
        "indonesia": { code: "id", abbr: "INA" },
        "italy": { code: "it", abbr: "ITA" },
        "japan": { code: "jp", abbr: "JPN" },
        "malaysia": { code: "my", abbr: "MAS" },
        "mexico": { code: "mx", abbr: "MEX" },
        "monaco": { code: "mc", abbr: "MON" },
        "netherlands": { code: "nl", abbr: "NED" },
        "qatar": { code: "qa", abbr: "QAT" },
        "saudi arabia": { code: "sa", abbr: "KSA" },
        "singapore": { code: "sg", abbr: "SGP" },
        "spain": { code: "es", abbr: "ESP" },
        "united states": { code: "us", abbr: "USA" },
        "usa": { code: "us", abbr: "USA" },
        "uae": { code: "ae", abbr: "UAE" },
        "abu dhabi": { code: "ae", abbr: "ABU" },
        "portugal": { code: "pt", abbr: "POR" },
        "turkey": { code: "tr", abbr: "TUR" },
        "thailand": { code: "th", abbr: "THA" },
        "south africa": { code: "za", abbr: "RSA" },
        "new zealand": { code: "nz", abbr: "NZL" },
        "vietnam": { code: "vn", abbr: "VIE" },
        "ina": { code: "id", abbr: "INA" },
        "idn": { code: "id", abbr: "INA" },
        "gbr": { code: "gb", abbr: "GBR" },
        "uk": { code: "gb", abbr: "GBR" },
        "ger": { code: "de", abbr: "GER" },
        "fra": { code: "fr", abbr: "FRA" },
        "ita": { code: "it", abbr: "ITA" },
        "esp": { code: "es", abbr: "ESP" },
        "jpn": { code: "jp", abbr: "JPN" },
        "mas": { code: "my", abbr: "MAS" },
        "mys": { code: "my", abbr: "MAS" },
        "sgp": { code: "sg", abbr: "SGP" },
        "tha": { code: "th", abbr: "THA" },
        "aus": { code: "au", abbr: "AUS" },
        "aut": { code: "at", abbr: "AUT" },
        "ned": { code: "nl", abbr: "NED" },
        "nld": { code: "nl", abbr: "NED" },
        "bel": { code: "be", abbr: "BEL" },
        "bra": { code: "br", abbr: "BRA" },
        "can": { code: "ca", abbr: "CAN" },
        "nzl": { code: "nz", abbr: "NZL" },
        "kor": { code: "kr", abbr: "KOR" },
        "mex": { code: "mx", abbr: "MEX" },
        "mon": { code: "mc", abbr: "MON" },
        "por": { code: "pt", abbr: "POR" },
        "prt": { code: "pt", abbr: "POR" },
        "zaf": { code: "za", abbr: "RSA" },
        "rsa": { code: "za", abbr: "RSA" },
        "tur": { code: "tr", abbr: "TUR" },
        "vie": { code: "vn", abbr: "VIE" },
        "vnm": { code: "vn", abbr: "VIE" },
        "phl": { code: "ph", abbr: "PHI" },
        "phi": { code: "ph", abbr: "PHI" }
    }

    const countryCode = computed(() => {
        if (!driver.value) return null
        if (driver.value.countries?.code) return String(driver.value.countries.code).toLowerCase()
        if (driver.value.country && String(driver.value.country).length === 2 && isNaN(Number(driver.value.country))) {
            return String(driver.value.country).toLowerCase()
        }
        const name = driver.value.countries?.name || (typeof driver.value.country === "string" ? driver.value.country : null)
        if (name) {
            const clean = String(name).toLowerCase().trim()
            if (COUNTRY_MAP[clean]) return COUNTRY_MAP[clean].code
        }
        return null
    })

    const countryName = computed(() => {
        if (!driver.value) return ""
        return driver.value.countries?.name || driver.value.country || ""
    })

    // Card background & border matching driver rating from database.vue
    const getDriverCardStyle = (rating) => {
        let style = "rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 shadow-sm transition "
        if (rating === "Platinum") {
            style += "bg-slate-700 text-white border-slate-900 dark:border-slate-500"
        } else if (rating === "Gold") {
            style += "bg-yellow-500 text-black border-yellow-700 dark:border-yellow-600"
        } else if (rating === "Silver") {
            style += "bg-zinc-500 text-white border-zinc-700 dark:border-zinc-400"
        } else if (rating === "Bronze") {
            style += "bg-amber-700 text-white border-amber-900 dark:border-amber-500"
        } else if (rating === "Copper") {
            style += "bg-red-700 text-white border-red-900 dark:border-red-500"
        } else if (rating === "Iron") {
            style += "bg-black text-white border-neutral-800 dark:border-neutral-600"
        } else {
            style += "bg-red-50 dark:bg-slate-950 text-black dark:text-white border-red-700 dark:border-red-600"
        }
        return style
    }

    // const getRatingBadgeStyle = (rating) => {
    //     if (!rating) return ""
    //     if (rating === "Gold") {
    //         return "bg-black text-yellow-400 font-bold border border-black/20"
    //     }
    //     return "bg-black/30 text-white font-bold border border-white/20"
    // }

    const getOrganizerStyle = (organizer) => {
        let style = "px-2 py-0.5 font-bold rounded-md text-xs lg:text-sm "
        if (organizer === "ACI") {
            style += "bg-red-500 text-white"
        } else if (organizer === "97SRC") {
            style += "bg-white text-black"
        } else if (organizer === "CRC") {
            style += "bg-yellow-500 text-black"
        } else if (organizer === "BRM") {
            style += "bg-sky-500 text-black"
        } else if (organizer === "JRC") {
            style += "bg-indigo-500 text-black"
        } else if (organizer === "ERGP") {
            style += "bg-white text-red-600"
        } else if (organizer === "SRC") {
            style += "bg-blue-500 text-white"
        } else if (organizer === "ISL") {
            style += "bg-pink-800 text-white"
        } else {
            style += "bg-gray-700 text-white"
        }
        return style
    }

    const getGameStyle = (game) => {
        let style = "px-2 py-0.5 font-bold rounded-md text-xs lg:text-sm "
        if (game === "AC") {
            style += "bg-red-500 text-white"
        } else if (game === "ACC") {
            style += "bg-white text-red-600"
        } else if (game === "RBR") {
            style += "bg-slate-800 text-white"
        } else if (game === "LMU") {
            style += "bg-blue-500 text-white"
        } else {
            style += "bg-gray-700 text-white"
        }
        return style
    }

    // Helper to format date
    const formatDate = (dateString) => {
        if (!dateString) return "-"
        const date = new Date(dateString)
        return date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric"
        })
    }

    // 5. Flatten and process all driver session results
    const processedResults = computed(() => {
        if (!driverEntries.value || driverEntries.value.length === 0) return []

        // Check if qualifying sessions had pole position for any schedules
        const qualifyingPoleSchedules = new Set()
        for (const entry of driverEntries.value) {
            for (const res of (entry.results || [])) {
                const sType = String(res.session_type || "").toLowerCase().trim()
                if ((sType === "qualifying" || sType === "q") && (Number(res.classified_position) === 1 || Number(res.scoring_position) === 1)) {
                    qualifyingPoleSchedules.add(entry.schedule_id)
                }
            }
        }

        const list = []
        for (const entry of driverEntries.value) {
            const sched = entry.schedule
            const event = sched?.events
            const results = entry.results || []

            for (const res of results) {
                const sessType = res.session_type || "race"
                const isQuali = sessType === "qualifying" || sessType === "q"

                // Look up championship event / points system
                const ce = pointsMap.value.get(`${entry.schedule_id}::${sessType}`) ||
                    pointsMap.value.get(entry.schedule_id)
                const ptsSystem = ce?.points_system
                const multiplier = Number(ce?.points_multiplier) || 1.0

                // Pole calculation for this session
                const isFirstRace = (sessType === "race_1" || sessType === "r1" || sessType === "race")
                const hasGridPos = Number(res.grid_position) > 0
                const isPole = (isQuali && (Number(res.classified_position) === 1 || Number(res.scoring_position) === 1)) ||
                    (!isQuali && (hasGridPos ? Number(res.grid_position) === 1 : (isFirstRace && qualifyingPoleSchedules.has(entry.schedule_id))))

                // Calculate points
                const pts = ptsSystem
                    ? calculateResultPoints(ptsSystem, {
                        driver_id: entry.driver_id,
                        team_id: entry.team_id,
                        car_number: entry.car_number,
                        scoring_position: res.scoring_position,
                        classified_position: res.classified_position,
                        status: res.status,
                        fastest_lap: Boolean(res.fastest_lap),
                        grid_position: Number(res.grid_position) || null,
                        no_points: Boolean(res.no_points)
                    }, {
                        isPole,
                        multiplier
                    })
                    : 0

                const pos = res.classified_position ?? res.scoring_position
                const status = String(res.status || "finished").toLowerCase().trim()
                const isFinished = status === "finished" || (!status.includes("dnf") && !status.includes("dns") && !status.includes("dsq") && !status.includes("disqualified"))
                const isWin = !isQuali && isFinished && pos === 1
                const isPodium = !isQuali && isFinished && pos >= 1 && pos <= 3

                // Progression (+/-)
                const gridPos = Number(res.grid_position) || 0
                const finishPos = Number(pos) || 0
                const posDiff = (gridPos > 0 && finishPos > 0) ? (gridPos - finishPos) : null

                // Resolve Multiclass & Class
                const evId = event?.id
                const isMulticlass = evId ? multiclassEventIds.value.has(evId) : false
                let resolvedClass = entry.classes?.name || null
                if (!resolvedClass && entry.class_id && allEventClasses.value) {
                    resolvedClass = allEventClasses.value.find(c => c.id === entry.class_id)?.name || null
                }
                if (!resolvedClass && entry.teams?.name) {
                    const teamParsed = parseTeamInfo(entry.teams.name)
                    if (teamParsed?.teamClass) {
                        resolvedClass = teamParsed.teamClass
                    }
                }
                const raceClass = isMulticlass ? (resolvedClass || "-") : "-"

                list.push({
                    id: res.id,
                    entryId: entry.id,
                    scheduleId: entry.schedule_id,
                    date: sched?.date,
                    finishDate: sched?.finish_date,
                    eventName: event?.name || "-",
                    season: sched?.season,
                    round: sched?.round,
                    circuit: sched?.circuit || "-",
                    country: sched?.country,
                    country_2: sched?.country_2,
                    className: raceClass,
                    isMulticlass,
                    gameAbbr: event?.games?.abbreviation,
                    organizerAbbr: event?.organizers?.abbreviation,
                    sessionType: sessType,
                    sessionLabel: sessType === "qualifying" ? t("qualifying") : (sessType === "race_1" ? t("race1") : (sessType === "race_2" ? t("race2") : t("race"))),
                    carNumber: entry.car_number,
                    carModel: entry.car_model || "-",
                    teamName: entry.teams?.name || "-",
                    gridPosition: gridPos,
                    finishPosition: finishPos,
                    posDiff,
                    status,
                    isDnf: status === "dnf",
                    isDns: status === "dns",
                    isDsq: status === "dsq" || status === "disqualified",
                    bestLapMs: Number(res.best_lap_ms) || 0,
                    bestLap: (Number(res.best_lap_ms) > 0) ? formatLapTime(Number(res.best_lap_ms)) : "-",
                    isFastestLap: Boolean(res.fastest_lap),
                    isPole,
                    isWin,
                    isPodium,
                    points: pts,
                    noPoints: Boolean(res.no_points)
                })
            }
        }

        const getSessionOrder = (sType) => {
            const s = String(sType || "").toLowerCase().trim()
            if (s === "race_2" || s === "r2") return 3
            if (s === "race_1" || s === "r1" || s === "race") return 2
            if (s === "qualifying" || s === "q") return 1
            return 0
        }

        // Sort chronologically (newest first: newest date first, and Race 2 before Race 1 on the same day)
        list.sort((a, b) => {
            const dayA = a.date ? new Date(a.date).toISOString().slice(0, 10) : ""
            const dayB = b.date ? new Date(b.date).toISOString().slice(0, 10) : ""
            if (dayA && dayB && dayA === dayB) {
                const orderA = getSessionOrder(a.sessionType)
                const orderB = getSessionOrder(b.sessionType)
                if (orderB !== orderA) return orderB - orderA
            }

            const dateA = new Date(a.date || 0).getTime()
            const dateB = new Date(b.date || 0).getTime()
            if (dateB !== dateA) return dateB - dateA

            const orderA = getSessionOrder(a.sessionType)
            const orderB = getSessionOrder(b.sessionType)
            if (orderB !== orderA) return orderB - orderA

            return b.sessionType.localeCompare(a.sessionType)
        })

        return list
    })

    // 6. Calculate the 7 requested statistics
    const stats = computed(() => {
        const results = processedResults.value
        const raceResults = results.filter(r => r.sessionType !== "qualifying" && r.sessionType !== "q")

        // 1. Race Starts: race sessions where status is not DNS
        const raceStarts = raceResults.filter(r => !r.isDns).length

        // 2. Pole Position: poles in qualifying or starting P1 in race, counted once per schedule
        const poleSchedules = new Set()
        results.forEach(r => {
            if (r.isPole) {
                poleSchedules.add(r.scheduleId)
            }
        })
        const polePositions = poleSchedules.size

        // 3. Fastest Lap: in race sessions where fastest_lap is true
        const fastestLaps = raceResults.filter(r => r.isFastestLap).length

        // 4. Win: classified P1 in race session
        const wins = raceResults.filter(r => r.isWin).length

        // 5. Podium: classified P1-P3 in race session
        const podiums = raceResults.filter(r => r.isPodium).length

        // 6. Points Finishes: race sessions where points > 0
        const pointsFinishes = raceResults.filter(r => !r.noPoints && r.points > 0).length

        // 7. Championships Won: only defined as won if 1st in standings AND all races in championship have finished
        const now = new Date()
        let champWonCount = 0
        const championshipsWonList = []

        for (const st of (driverStandings.value || [])) {
            if (Number(st.position) === 1 && (!st.entity_type || st.entity_type === "driver")) {
                const champ = st.championships
                const schedList = (champ?.championship_events || [])
                    .map(ce => ce.schedule)
                    .filter(Boolean)

                // Deduplicate schedules by ID
                const uniqueSchedules = []
                const seenSched = new Set()
                for (const s of schedList) {
                    if (s.id && !seenSched.has(s.id)) {
                        seenSched.add(s.id)
                        uniqueSchedules.push(s)
                    }
                }

                // Championship must have at least one schedule and ALL schedules must be finished (past finish_date/date and not postponed)
                const hasSchedules = uniqueSchedules.length > 0
                const allFinished = hasSchedules && uniqueSchedules.every(s => {
                    if (s.is_postponed) return false
                    const d = s.finish_date || s.date
                    if (!d) return false
                    return new Date(d) < now
                })

                // Only define as won if all races have been finished
                if (allFinished) {
                    const ev = champ?.seasons?.events
                    const org = ev?.organizers?.abbreviation || (Array.isArray(ev?.organizers) ? ev?.organizers[0]?.abbreviation : null)
                    const gm = ev?.games?.abbreviation || (Array.isArray(ev?.games) ? ev?.games[0]?.abbreviation : null)

                    champWonCount += 1
                    championshipsWonList.push({
                        id: st.id,
                        championshipId: st.championship_id,
                        points: st.points,
                        eventName: ev?.name || "-",
                        seasonNumber: champ?.seasons?.season_number,
                        className: champ?.classes?.name,
                        organizer: org,
                        game: gm,
                        isConcluded: true
                    })
                }
            }
        }

        return {
            raceStarts,
            polePositions,
            fastestLaps,
            wins,
            podiums,
            pointsFinishes,
            championshipsWon: champWonCount,
            championshipsWonList
        }
    })

    // 7. Results Table Filter & Navigation (Only Races)
    const filteredResults = computed(() => {
        return processedResults.value.filter(r => r.sessionType !== "qualifying" && r.sessionType !== "q")
    })

    const getChampPositionCellClass = (pos) => {
        const p = Number(pos)
        if (p === 1) return "bg-yellow-200 dark:bg-yellow-500/80 text-yellow-950 dark:text-black font-bold"
        if (p === 2) return "bg-slate-300 dark:bg-slate-400 text-slate-950 dark:text-black font-bold"
        if (p === 3) return "bg-amber-200 dark:bg-amber-500/80 text-amber-950 dark:text-black font-bold"
        if (p > 0) return "text-black dark:text-white font-medium"
        return "text-gray-400 font-normal"
    }

    // 8. Statistics Per Event & Per Season
    const seasonStatistics = computed(() => {
        const raceList = processedResults.value.filter(r => r.sessionType !== "qualifying" && r.sessionType !== "q")
        const attributedResultIds = new Set()
        const list = []

        // 1. Process from driver standings
        for (const st of (driverStandings.value || [])) {
            if (st.entity_type && st.entity_type !== "driver") continue

            const champ = st.championships
            const ev = champ?.seasons?.events
            const eventName = ev?.name || "-"
            const seasonNum = champ?.seasons?.season_number
            const className = champ?.classes?.name
            const orgAbbr = ev?.organizers?.abbreviation || (Array.isArray(ev?.organizers) ? ev?.organizers[0]?.abbreviation : null)
            const gameAbbr = ev?.games?.abbreviation || (Array.isArray(ev?.games) ? ev?.games[0]?.abbreviation : null)

            // Schedules belonging to this championship
            const champSchedIds = new Set(
                (champ?.championship_events || [])
                    .map(ce => ce.schedule?.id || ce.schedule_id)
                    .filter(Boolean)
            )

            // Match race results for this championship
            const matchedRaces = raceList.filter(r => {
                if (champSchedIds.has(r.scheduleId)) return true
                if (champSchedIds.size === 0 && r.eventName === eventName && (r.season === seasonNum || String(r.season) === String(seasonNum))) {
                    return true
                }
                return false
            })

            matchedRaces.forEach(r => attributedResultIds.add(r.id))

            const starts = matchedRaces.filter(r => !r.isDns).length
            const wins = Math.max(matchedRaces.filter(r => r.isWin).length, Number(st.wins) || 0)
            const poles = matchedRaces.filter(r => r.isPole).length
            const fls = matchedRaces.filter(r => r.isFastestLap).length
            const podiums = Math.max(matchedRaces.filter(r => r.isPodium).length, Number(st.podiums) || 0)
            const totalRacePts = matchedRaces.reduce((sum, r) => sum + (Number(r.points) || 0), 0)
            const points = (st.points !== null && st.points !== undefined) ? Number(st.points) : totalRacePts

            const posNum = (st.position !== null && st.position !== undefined) ? Number(st.position) : null

            // Omit if completely empty
            if (starts === 0 && points === 0 && posNum === null) continue

            const sortSeason = Number(seasonNum) || 0
            const latestDate = matchedRaces.reduce((max, r) => {
                const t = r.date ? new Date(r.date).getTime() : 0
                return t > max ? t : max
            }, 0)

            // Check if championship is concluded or still ongoing
            const now = new Date()
            const schedList = (champ?.championship_events || [])
                .map(ce => ce.schedule)
                .filter(Boolean)

            const uniqueSchedules = []
            const seenSched = new Set()
            for (const s of schedList) {
                if (s.id && !seenSched.has(s.id)) {
                    seenSched.add(s.id)
                    uniqueSchedules.push(s)
                }
            }

            const hasSchedules = uniqueSchedules.length > 0
            const allFinished = hasSchedules && uniqueSchedules.every(s => {
                if (s.is_postponed) return false
                const d = s.finish_date || s.date
                if (!d) return false
                return new Date(d) < now
            })

            const isOngoing = !allFinished

            list.push({
                id: `st-${st.id}`,
                eventName,
                className: (className && className !== "-") ? className : null,
                season: (seasonNum !== null && seasonNum !== undefined) ? `${seasonNum}` : "-",
                seasonRaw: sortSeason,
                organizerAbbr: orgAbbr,
                gameAbbr: gameAbbr,
                starts,
                wins,
                poles,
                fls,
                podiums,
                points,
                position: posNum,
                isOngoing,
                latestDate
            })
        }

        // 2. Add any race sessions not matched to standings
        const unattributedRaces = raceList.filter(r => !attributedResultIds.has(r.id))
        const groupMap = new Map()

        for (const r of unattributedRaces) {
            const key = `${r.eventName}::${r.season || '-'}`
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    eventName: r.eventName,
                    season: r.season,
                    organizerAbbr: r.organizerAbbr,
                    gameAbbr: r.gameAbbr,
                    races: []
                })
            }
            groupMap.get(key).races.push(r)
        }

        for (const [key, grp] of groupMap.entries()) {
            const rList = grp.races
            const starts = rList.filter(r => !r.isDns).length
            const wins = rList.filter(r => r.isWin).length
            const poles = rList.filter(r => r.isPole).length
            const fls = rList.filter(r => r.isFastestLap).length
            const podiums = rList.filter(r => r.isPodium).length
            const points = rList.reduce((sum, r) => sum + (Number(r.points) || 0), 0)
            const sortSeason = Number(grp.season) || 0
            const latestDate = rList.reduce((max, r) => {
                const t = r.date ? new Date(r.date).getTime() : 0
                return t > max ? t : max
            }, 0)

            const isOngoing = rList.some(r => {
                const d = r.finishDate || r.date
                return d ? new Date(d) >= now : false
            })

            list.push({
                id: `race-grp-${key}`,
                eventName: grp.eventName,
                className: null,
                season: grp.season ? String(grp.season).replace(/^S/i, "") : "-",
                seasonRaw: sortSeason,
                organizerAbbr: grp.organizerAbbr,
                gameAbbr: grp.gameAbbr,
                starts,
                wins,
                poles,
                fls,
                podiums,
                points,
                position: null,
                isOngoing,
                latestDate
            })
        }

        // Sort descending: latest date first, then highest season number
        list.sort((a, b) => {
            if (b.latestDate !== a.latestDate) return b.latestDate - a.latestDate
            return b.seasonRaw - a.seasonRaw
        })

        return list
    })

    const getPositionBadge = (row) => {
        if (row.isDsq) return { label: "DSQ", class: "text-black dark:text-white font-bold" }
        if (row.isDnf) return { label: "DNF", class: "text-red-600 dark:text-red-400 font-bold" }
        if (row.isDns) return { label: "DNS", class: "text-gray-500 dark:text-gray-400 font-bold" }
        const pos = Number(row.finishPosition)
        if (pos === 1) return { label: "1", class: "text-yellow-500 dark:text-yellow-400 font-extrabold" }
        if (pos === 2) return { label: "2", class: "text-slate-400 dark:text-slate-300 font-extrabold" }
        if (pos === 3) return { label: "3", class: "text-amber-700 dark:text-amber-500 font-extrabold" }
        if (pos > 0) return { label: `${pos}`, class: "text-black dark:text-white font-medium" }
        return { label: "-", class: "text-gray-400" }
    }

    const getCircuitCountryCode = (country) => {
        if (!country) return null
        const str = String(country).trim().toLowerCase()
        if (str.length === 2 && isNaN(Number(str))) return str
        if (COUNTRY_MAP[str]) return COUNTRY_MAP[str].code
        return null
    }

    const getSessionLabel = (sessType) => {
        if (sessType === "qualifying" || sessType === "q") return t("qualifying")
        if (sessType === "race_1" || sessType === "r1") return t("race1")
        if (sessType === "race_2" || sessType === "r2") return t("race2")
        return t("race")
    }

    const navigateToResult = (scheduleId) => {
        if (scheduleId) {
            window.open(`/results/${scheduleId}`, '_blank')
        }
    }

    useHead(() => ({
        title: driver.value ? `${driver.value.name} - ID Sim Racing` : "Driver Profile - ID Sim Racing",
        meta: [
            {
                name: "description",
                content: driver.value ? `Statistik dan riwayat balapan ${driver.value.name} di ID Sim Racing` : "Driver Statistics & Results"
            }
        ]
    }))
</script>

<template>
    <div class="min-h-screen bg-gray-50 dark:bg-slate-950 text-black dark:text-white px-4 lg:px-24 py-8">
        <!-- Loading State -->
        <div v-if="loadingDriver || loadingEntries" class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-gray-500 dark:text-gray-400 text-sm lg:text-base">{{ $t('loading') }}</p>
        </div>

        <!-- Not Found State -->
        <div v-else-if="!driver" class="text-center py-20">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-950 text-red-600 mb-4">
                <Icon name="mdi:account-off" size="2em" />
            </div>
            <h2 class="text-xl lg:text-2xl font-bold mb-2">{{ $t('driverNotFound') }}</h2>
            <p class="text-gray-500 dark:text-gray-400 mb-6">{{ $t('noDriversFound') }}</p>
            <NuxtLink to="/database" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-900 text-white font-bold hover:bg-red-800 transition">
                <span>{{ $t('backToDatabase') }}</span>
            </NuxtLink>
        </div>

        <!-- Driver Profile Content -->
        <div v-else class="space-y-8">
            <div :class="getDriverCardStyle(driver.rating)">
                <div class="flex items-center justify-between gap-4">
                    <h1 class="text-2xl lg:text-4xl font-black">
                        {{ driver.name }}
                    </h1>
                    <div v-if="countryCode" class="text-2xl lg:text-3xl shrink-0">
                        <Icon :name="`flag-${countryCode}-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
                    </div>
                </div>

                <div class="flex flex-col gap-1 mt-2">
                    <div v-if="driver.teams?.name || driver.team" class="text-base lg:text-lg">
                        <span>{{ driver.teams?.name || driver.team }}</span>
                    </div>

                    <div v-if="driver.rating" class="text-base lg:text-lg">
                        <span>{{ driver.rating }}</span>
                    </div>
                </div>
            </div>

            <!-- Accolades / Titles Won (if any) -->
            <div v-if="stats.championshipsWon > 0" class="rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 bg-amber-50 dark:bg-amber-950/30 border-amber-600 dark:border-amber-500 shadow-sm flex flex-col gap-2">
                <div class="flex items-center gap-2 font-extrabold text-black dark:text-white text-xl lg:text-2xl">
                    <span>{{ stats.championshipsWon === 1 ? $t('championshipSingle', { count: stats.championshipsWon }) : $t('championshipPlural', { count: stats.championshipsWon }) }}</span>
                </div>
                <div class="flex flex-wrap gap-2">
                    <div
                        v-for="ch in stats.championshipsWonList"
                        :key="ch.id"
                        class="inline-flex items-center gap-1 text-base lg:text-lg font-bold text-black dark:text-white flex-wrap"
                    >
                        <span v-if="ch.organizer" :class="getOrganizerStyle(ch.organizer)" class="text-[10px] lg:text-xs">
                            {{ ch.organizer }}
                        </span>
                        <span v-if="ch.game" :class="getGameStyle(ch.game)" class="text-[10px] lg:text-xs">
                            {{ ch.game }}
                        </span>
                        <span>{{ ch.eventName }} (S{{ ch.seasonNumber }}){{ ch.className ? ` - ${ch.className}` : '' }}</span>
                    </div>
                </div>
            </div>

            <!-- Statistics Section -->
            <div class="w-full">
                <!-- 6 Metric Cards Grid (Full Width) -->
                <div class="w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
                    <!-- 1. Race Starts -->
                    <div class="bg-white dark:bg-slate-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 border-red-700 dark:border-red-600 p-4 text-center shadow-xs">
                        <div class="text-base lg:text-lg text-black dark:text-white">
                            {{ $t('raceStarts') }}
                        </div>
                        <div class="text-2xl lg:text-3xl font-black text-black dark:text-white">
                            {{ stats.raceStarts }}
                        </div>
                    </div>

                    <!-- 4. Win -->
                    <div class="bg-white dark:bg-slate-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 border-red-700 dark:border-red-600 p-4 text-center shadow-xs">
                        <div class="text-base lg:text-lg text-black dark:text-white">
                            {{ $t('wins') }}
                        </div>
                        <div class="text-2xl lg:text-3xl font-black text-black dark:text-white">
                            {{ stats.wins }}
                        </div>
                    </div>

                    <!-- 2. Pole Position -->
                    <div class="bg-white dark:bg-slate-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 border-red-700 dark:border-red-600 p-4 text-center shadow-xs">
                        <div class="text-base lg:text-lg text-black dark:text-white">
                            {{ $t('polePositions') }}
                        </div>
                        <div class="text-2xl lg:text-3xl font-black text-black dark:text-white">
                            {{ stats.polePositions }}
                        </div>
                    </div>

                    <!-- 3. Fastest Lap -->
                    <div class="bg-white dark:bg-slate-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 border-red-700 dark:border-red-600 p-4 text-center shadow-xs">
                        <div class="text-base lg:text-lg text-black dark:text-white">
                            {{ $t('fastestLaps') }}
                        </div>
                        <div class="text-2xl lg:text-3xl font-black text-black dark:text-white">
                            {{ stats.fastestLaps }}
                        </div>
                    </div>

                    <!-- 5. Podium -->
                    <div class="bg-white dark:bg-slate-900 rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 border-red-700 dark:border-red-600 p-4 text-center shadow-xs">
                        <div class="text-base lg:text-lg text-black dark:text-white">
                            {{ $t('podiums') }}
                        </div>
                        <div class="text-2xl lg:text-3xl font-black text-black dark:text-white">
                            {{ stats.podiums }}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Season & Event Statistics Section -->
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-lg lg:text-xl font-extrabold text-black dark:text-white flex items-center gap-2">
                            <span>{{ $t('seasonStatistics') }}</span>
                        </h2>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="seasonStatistics.length === 0" class="text-center py-12 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <p class="text-gray-500 dark:text-gray-400 text-sm lg:text-base">{{ $t('noSeasonStatistics') }}</p>
                </div>

                <!-- Season Statistics Table -->
                <div v-else class="border border-gray-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-red-900 dark:bg-red-900 text-white text-sm lg:text-base select-none font-bold">
                                <tr>
                                    <th class="py-3 px-3 lg:px-4 text-center whitespace-nowrap">{{ $t('events') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('class') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('season') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('starts') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('wins') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('poles') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('fls') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('podiums') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('points') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('championshipPosition') }}</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm lg:text-base divide-y divide-gray-200 dark:divide-slate-800">
                                <tr
                                    v-for="item in seasonStatistics"
                                    :key="item.id"
                                    class="border-b border-gray-100 dark:border-slate-900 hover:bg-red-50/40 dark:hover:bg-red-950/20 transition-colors"
                                >
                                    <!-- Event Name -->
                                    <td class="py-3 px-3 lg:px-4 whitespace-nowrap font-bold">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span v-if="item.organizerAbbr" :class="getOrganizerStyle(item.organizerAbbr)" class="text-[10px] lg:text-xs">
                                                {{ item.organizerAbbr }}
                                            </span>
                                            <span v-if="item.gameAbbr" :class="getGameStyle(item.gameAbbr)" class="text-[10px] lg:text-xs">
                                                {{ item.gameAbbr }}
                                            </span>
                                            <span>{{ item.eventName }}</span>
                                        </div>
                                    </td>

                                    <!-- Class -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        <span v-if="item.className && item.className !== '-'">{{ item.className }}</span>
                                        <span v-else></span>
                                    </td>

                                    <!-- Season -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        <span>{{ item.season }}</span>
                                    </td>

                                    <!-- Starts -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.starts }}
                                    </td>

                                    <!-- Wins -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.wins }}
                                    </td>

                                    <!-- Poles -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.poles }}
                                    </td>

                                    <!-- FLs -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.fls }}
                                    </td>

                                    <!-- Podiums -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.podiums }}
                                    </td>

                                    <!-- Points -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ item.points }}
                                    </td>

                                    <!-- Championship Position -->
                                    <td
                                        class="py-3 px-3 text-center whitespace-nowrap"
                                        :class="getChampPositionCellClass(item.position)"
                                    >
                                        <span v-if="item.position !== null && item.position !== undefined" class="relative inline-flex items-center justify-center">
                                            <span>{{ item.position }}</span>
                                            <sup v-if="item.isOngoing" class="font-bold text-[10px] lg:text-xs ml-0.5">*</sup>
                                        </span>
                                        <span v-else class="text-gray-400 font-normal">-</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Results Section -->
            <div class="space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-lg lg:text-xl font-extrabold text-black dark:text-white flex items-center gap-2">
                            <span>{{ $t('driverResults') }}</span>
                        </h2>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="filteredResults.length === 0" class="text-center py-12 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <p class="text-gray-500 dark:text-gray-400 text-sm lg:text-base">{{ $t('noDriverResults') }}</p>
                </div>

                <!-- Results History Table -->
                <div v-else class="border border-gray-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-red-900 dark:bg-red-900 text-white text-sm lg:text-base select-none font-bold">
                                <tr>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('date') }}</th>
                                    <th class="py-3 px-3 lg:px-4 text-center whitespace-nowrap">{{ $t('events') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('class') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('season') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('round') }}</th>
                                    <th class="py-3 px-3 lg:px-4 text-center whitespace-nowrap">{{ $t('circuit') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('session') }}</th>
                                    <!-- <th class="py-3 px-2 text-center whitespace-nowrap">{{ $t('grid') }}</th> -->
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('position') }}</th>
                                    <th class="py-3 px-3 text-center whitespace-nowrap">{{ $t('points') }}</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm lg:text-base divide-y divide-gray-200 dark:divide-slate-800">
                                <tr
                                    v-for="item in filteredResults"
                                    :key="item.id"
                                    @click="navigateToResult(item.scheduleId)"
                                    :title="item.scheduleId ? $t('viewEventResults') : ''"
                                    :class="item.scheduleId ? 'cursor-pointer hover:bg-red-50/80 dark:hover:bg-red-950/40' : ''"
                                    class="border-b border-gray-100 dark:border-slate-900 transition-colors"
                                >
                                    <!-- Date -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap text-black dark:text-white font-medium">
                                        {{ formatDate(item.date) }}
                                    </td>

                                    <!-- Event -->
                                    <td class="py-3 px-3 lg:px-4 whitespace-nowrap font-bold">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span v-if="item.organizerAbbr" :class="getOrganizerStyle(item.organizerAbbr)" class="text-[10px] lg:text-xs">
                                                {{ item.organizerAbbr }}
                                            </span>
                                            <span v-if="item.gameAbbr" :class="getGameStyle(item.gameAbbr)" class="text-[10px] lg:text-xs">
                                                {{ item.gameAbbr }}
                                            </span>
                                            <span>{{ item.eventName }}</span>
                                        </div>
                                    </td>

                                    <!-- Class (filled if multiclass) -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium">
                                        <span v-if="item.className && item.className !== '-'" class="text-black dark:text-white">
                                            {{ item.className }}
                                        </span>
                                        <span v-else></span>
                                    </td>

                                    <!-- Season -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium">
                                        <span v-if="item.season">{{ item.season }}</span>
                                        <span v-else class="text-gray-400">-</span>
                                    </td>

                                    <!-- Round -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium">
                                        <span v-if="item.round !== null && item.round !== undefined">{{ item.round }}</span>
                                        <span v-else class="text-gray-400">-</span>
                                    </td>

                                    <!-- Circuit -->
                                    <td class="py-3 px-3 lg:px-4 whitespace-nowrap">
                                        <div class="flex items-center gap-1.5">
                                            <Icon
                                                v-if="getCircuitCountryCode(item.country)"
                                                :name="`flag-${getCircuitCountryCode(item.country)}-4x3`"
                                                mode="svg"
                                                class="w-4 h-3 rounded-xs shrink-0"
                                            />
                                            <Icon
                                                v-if="getCircuitCountryCode(item.country_2)"
                                                :name="`flag-${getCircuitCountryCode(item.country_2)}-4x3`"
                                                mode="svg"
                                                class="w-4 h-3 rounded-xs shrink-0"
                                            />
                                            <span class="font-medium text-black dark:text-white">
                                                {{ item.circuit }}
                                            </span>
                                        </div>
                                    </td>

                                    <!-- Session Type -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                        {{ getSessionLabel(item.sessionType) }}
                                    </td>

                                    <!-- Grid Position -->
                                    <!-- <td class="py-3 px-2 text-center whitespace-nowrap font-medium text-gray-600 dark:text-gray-400">
                                        <span v-if="item.gridPosition > 0">
                                            P{{ item.gridPosition }}
                                        </span>
                                        <span v-else>-</span>
                                    </td> -->

                                    <!-- Finish Position (with Pole Position 'P' and Fastest Lap 'F' superscripts) -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-bold">
                                        <span :class="getPositionBadge(item).class" class="relative inline-flex items-center justify-center">
                                            <span>{{ getPositionBadge(item).label }}</span>
                                            <sup v-if="item.isPole" class="font-medium text-[10px] lg:text-xs ml-0.5">P</sup>
                                            <sup v-if="item.isFastestLap" class="font-medium text-[10px] lg:text-xs ml-0.5">F</sup>
                                        </span>
                                    </td>

                                    <!-- Points -->
                                    <td class="py-3 px-3 text-center whitespace-nowrap font-bold">
                                        <span v-if="item.points > 0" class="text-emerald-700 dark:text-emerald-400">
                                            +{{ item.points }}
                                        </span>
                                        <span v-else></span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
