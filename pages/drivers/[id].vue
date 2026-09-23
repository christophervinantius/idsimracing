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
                            no_points,
                            is_wildcard
                        )
                    `)
                    .eq("driver_id", driverId.value)

                if (error && (error.message?.includes("classes") || error.message?.includes("is_wildcard") || error.code === "PGRST204" || error.code === "42703")) {
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
        const classesByEvent = new Map()
        for (const c of (allEventClasses.value || [])) {
            if (c.event_id) {
                if (!classesByEvent.has(c.event_id)) classesByEvent.set(c.event_id, new Set())
                classesByEvent.get(c.event_id).add(c.name || c.id)
            }
        }
        for (const st of (driverStandings.value || [])) {
            const evId = st.championships?.seasons?.events?.id
            const clsName = st.championships?.classes?.name
            if (evId && clsName) {
                if (!classesByEvent.has(evId)) classesByEvent.set(evId, new Set())
                classesByEvent.get(evId).add(clsName)
            }
        }
        const set = new Set()
        for (const [eventId, classSet] of classesByEvent.entries()) {
            if (classSet.size > 1) {
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

    // 5. Fetch Organizers & Games for detail popups
    const { data: allOrganizers } = await useAsyncData("all-organizers", async () => {
        try {
            const { data } = await $supabase
                .from("organizers")
                .select("abbreviation, name, description_en, description_id, discord, youtube, instagram, twitter, facebook, tiktok")
            return data || []
        } catch {
            return []
        }
    })

    const { data: allGames } = await useAsyncData("all-games", async () => {
        try {
            const { data } = await $supabase
                .from("games")
                .select("abbreviation, name, description_en, description_id, steam_link, other_link")
            return data || []
        } catch {
            return []
        }
    })

    const organizationData = reactive({
        organizer: "",
        name: "",
        description_en: "",
        description_id: "",
        youtube: "",
        discord: "",
        instagram: "",
        twitter: "",
        facebook: "",
        tiktok: ""
    })

    const setOrganizationByAbbr = (abbr) => {
        const org = (allOrganizers.value || []).find(o => o.abbreviation === abbr)
        if (org) {
            organizationData.organizer = org.abbreviation || ""
            organizationData.name = org.name || ""
            organizationData.description_en = org.description_en || ""
            organizationData.description_id = org.description_id || ""
            organizationData.youtube = org.youtube || ""
            organizationData.discord = org.discord || ""
            organizationData.instagram = org.instagram || ""
            organizationData.twitter = org.twitter || ""
            organizationData.facebook = org.facebook || ""
            organizationData.tiktok = org.tiktok || ""
        } else {
            organizationData.organizer = abbr || ""
            organizationData.name = abbr || ""
            organizationData.description_en = ""
            organizationData.description_id = ""
            organizationData.youtube = ""
            organizationData.discord = ""
            organizationData.instagram = ""
            organizationData.twitter = ""
            organizationData.facebook = ""
            organizationData.tiktok = ""
        }
    }

    provide("organizationData", organizationData)

    const gameData = reactive({
        game: "",
        name: "",
        description_en: "",
        description_id: "",
        steam_link: "",
        other_link: ""
    })

    const setGameByAbbr = (abbr) => {
        const gm = (allGames.value || []).find(g => g.abbreviation === abbr)
        if (gm) {
            gameData.game = gm.abbreviation || ""
            gameData.name = gm.name || ""
            gameData.description_en = gm.description_en || ""
            gameData.description_id = gm.description_id || ""
            gameData.steam_link = gm.steam_link || ""
            gameData.other_link = gm.other_link || ""
        } else {
            gameData.game = abbr || ""
            gameData.name = abbr || ""
            gameData.description_en = ""
            gameData.description_id = ""
            gameData.steam_link = ""
            gameData.other_link = ""
        }
    }

    provide("gameData", gameData)

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
        if (driver.value.countries?.name) return driver.value.countries.name
        const raw = driver.value.country
        if (!raw || typeof raw !== "string") return ""
        const clean = raw.toLowerCase().trim()
        for (const [key, val] of Object.entries(COUNTRY_MAP)) {
            if (val.code === clean || val.abbr?.toLowerCase() === clean || key === clean) {
                return key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
            }
        }
        return raw
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
        let style = "px-2 py-0.5 font-bold rounded-md text-xs lg:text-sm cursor-pointer transition-colors "
        if (organizer === "ACI") {
            style += "bg-red-500 hover:bg-red-600 text-white"
        } else if (organizer === "97SRC") {
            style += "bg-white hover:bg-neutral-300 text-black"
        } else if (organizer === "CRC") {
            style += "bg-yellow-500 hover:bg-yellow-600 text-black"
        } else if (organizer === "BRM") {
            style += "bg-sky-500 hover:bg-sky-600 text-black"
        } else if (organizer === "JRC") {
            style += "bg-indigo-500 hover:bg-indigo-600 text-black"
        } else if (organizer === "ERGP") {
            style += "bg-white hover:bg-neutral-300 text-red-600"
        } else if (organizer === "SRC") {
            style += "bg-blue-500 hover:bg-blue-600 text-white"
        } else if (organizer === "ISL") {
            style += "bg-pink-800 hover:bg-pink-900 text-white"
        } else {
            style += "bg-gray-700 hover:bg-gray-600 text-white"
        }
        return style
    }

    const getGameStyle = (game) => {
        let style = "px-2 py-0.5 font-bold rounded-md text-xs lg:text-sm cursor-pointer transition-colors "
        if (game === "AC") {
            style += "bg-red-500 hover:bg-red-600 text-white"
        } else if (game === "ACC") {
            style += "bg-white hover:bg-neutral-300 text-red-600"
        } else if (game === "RBR") {
            style += "bg-slate-800 hover:bg-slate-700 text-white"
        } else if (game === "LMU") {
            style += "bg-amber-500 hover:bg-amber-600 text-black"
        } else {
            style += "bg-gray-700 hover:bg-gray-600 text-white"
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
                        no_points: Boolean(res.no_points),
                        is_wildcard: Boolean(res.is_wildcard)
                    }, {
                        isPole,
                        multiplier,
                        scoringMode: ce?.scoring_mode === 'overall_strict' ? 'overall_strict' : (ce?.scoring_mode === 'overall' ? 'overall' : 'in_class')
                    })
                    : 0

                // Resolve Multiclass & Class
                const evId = event?.id
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
                const hasDifferentScoringPos = Number(res.scoring_position) > 0 &&
                    Number(res.classified_position) > 0 &&
                    Number(res.scoring_position) !== Number(res.classified_position)
                const isMulticlass = (evId ? multiclassEventIds.value.has(evId) : false) || hasDifferentScoringPos
                const raceClass = isMulticlass ? (resolvedClass || "-") : "-"

                // In multiclass races, position refers to that class only (scoring_position)
                const pos = isMulticlass
                    ? (Number(res.scoring_position) > 0 ? Number(res.scoring_position) : Number(res.classified_position))
                    : (Number(res.classified_position) > 0 ? Number(res.classified_position) : Number(res.scoring_position))
                const status = String(res.status || "finished").toLowerCase().trim()
                const isFinished = status === "finished" || (!status.includes("dnf") && !status.includes("dns") && !status.includes("dsq") && !status.includes("disqualified"))
                const isWin = !isQuali && isFinished && pos === 1
                const isPodium = !isQuali && isFinished && pos >= 1 && pos <= 3

                // Progression (+/-)
                const gridPos = Number(res.grid_position) || 0
                const finishPos = Number(pos) || 0
                const posDiff = (gridPos > 0 && finishPos > 0) ? (gridPos - finishPos) : null

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
                    gameAbbr: event?.games?.abbreviation || (Array.isArray(event?.games) ? event?.games[0]?.abbreviation : null),
                    organizerAbbr: event?.organizers?.abbreviation || (Array.isArray(event?.organizers) ? event?.organizers[0]?.abbreviation : null),
                    sessionType: sessType,
                    sessionLabel: sessType === "qualifying" ? t("qualifying") : (sessType === "race_1" ? t("race1") : (sessType === "race_2" ? t("race2") : t("race"))),
                    carNumber: entry.car_number,
                    carModel: entry.car_model || "-",
                    teamName: entry.teams?.name || "-",
                    gridPosition: gridPos,
                    finishPosition: finishPos,
                    overallPosition: Number(res.classified_position) || null,
                    classPosition: Number(res.scoring_position) || null,
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
                    noPoints: Boolean(res.no_points),
                    isWildcard: Boolean(res.is_wildcard)
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
        const pointsFinishes = raceResults.filter(r => !r.noPoints && !r.isWildcard && r.points > 0).length

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
    const allRaces = computed(() => {
        return processedResults.value.filter(r => r.sessionType !== "qualifying" && r.sessionType !== "q")
    })

    // Organizer filter options from driver's races
    const selectedOrganizer = ref("all")
    const organizerOptions = computed(() => {
        const list = [{ value: "all", label: t("all") }]
        const foundOrgs = new Set()
        for (const r of allRaces.value) {
            if (r.organizerAbbr) {
                foundOrgs.add(r.organizerAbbr)
            }
        }
        const sorted = [...foundOrgs].sort()
        for (const val of sorted) {
            list.push({ value: val, label: val })
        }
        return list
    })

    const selectedOrganizerOption = computed({
        get() {
            return organizerOptions.value.find(o => o.value === selectedOrganizer.value) || organizerOptions.value[0]
        },
        set(val) {
            if (!val) {
                selectedOrganizer.value = "all"
            } else if (typeof val === "object" && "value" in val) {
                selectedOrganizer.value = val.value || "all"
            } else {
                selectedOrganizer.value = String(val)
            }
        }
    })

    // Game filter options from driver's races
    const selectedGame = ref("all")
    const gameOptions = computed(() => {
        const list = [{ value: "all", label: t("all") }]
        const foundGames = new Set()
        for (const r of allRaces.value) {
            if (r.gameAbbr) {
                foundGames.add(r.gameAbbr)
            }
        }
        const sorted = [...foundGames].sort()
        for (const val of sorted) {
            list.push({ value: val, label: val })
        }
        return list
    })

    const selectedGameOption = computed({
        get() {
            return gameOptions.value.find(o => o.value === selectedGame.value) || gameOptions.value[0]
        },
        set(val) {
            if (!val) {
                selectedGame.value = "all"
            } else if (typeof val === "object" && "value" in val) {
                selectedGame.value = val.value || "all"
            } else {
                selectedGame.value = String(val)
            }
        }
    })

    const resetResultsFilter = () => {
        selectedOrganizer.value = "all"
        selectedGame.value = "all"
        currentPage.value = 1
    }

    const filteredResults = computed(() => {
        return allRaces.value.filter(r => {
            if (selectedOrganizer.value !== "all" && r.organizerAbbr !== selectedOrganizer.value) {
                return false
            }
            if (selectedGame.value !== "all" && r.gameAbbr !== selectedGame.value) {
                return false
            }
            return true
        })
    })

    // Pagination for race results table (default 10 results per page)
    const currentPage = ref(1)
    const itemsPerPage = ref(10)

    watch([selectedOrganizer, selectedGame, itemsPerPage], () => {
        currentPage.value = 1
    })

    const paginatedResults = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage.value
        return filteredResults.value.slice(start, start + itemsPerPage.value)
    })

    const totalPages = computed(() => Math.ceil(filteredResults.value.length / itemsPerPage.value) || 1)

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages.value) {
            currentPage.value = page
        }
    }

    const hasNoteColumn = computed(() => {
        return (filteredResults.value || []).some(r => r.isWildcard || r.noPoints)
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
        const now = new Date()

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
            navigateTo(`/results/${scheduleId}`)
        }
    }

    useHead(() => ({
        title: driver.value ? `${driver.value.name} | ID Sim Racing` : "Driver Profile | ID Sim Racing",
        meta: [
            {
                name: "description",
                content: driver.value ? `Statistik dan riwayat balapan ${driver.value.name} di ID Sim Racing` : "Driver Statistics & Results"
            }
        ]
    }))

    // Share Page
    const isCopied = ref(false)
    let copyTimeout = null

    const sharePage = async () => {
        const url = typeof window !== "undefined" ? window.location.href : ""
        const title = driver.value ? `${driver.value.name} | ID Sim Racing` : "ID Sim Racing"

        if (typeof navigator !== "undefined" && navigator.share) {
            try {
                await navigator.share({
                    title,
                    url
                })
                return
            } catch (err) {
                if (err.name === "AbortError") return
            }
        }

        if (typeof navigator !== "undefined" && navigator.clipboard) {
            try {
                await navigator.clipboard.writeText(url)
                isCopied.value = true
                if (copyTimeout) clearTimeout(copyTimeout)
                copyTimeout = setTimeout(() => {
                    isCopied.value = false
                }, 2000)
            } catch (e) {
                console.error("Clipboard copy failed:", e)
            }
        }
    }
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
                    <div v-if="countryName" class="text-base lg:text-lg">
                        <span>{{ countryName }}</span>
                    </div>

                    <div v-if="driver.teams?.name || driver.team" class="text-base lg:text-lg">
                        <span>{{ driver.teams?.name || driver.team }}</span>
                    </div>

                    <div v-if="driver.rating" class="text-base lg:text-lg">
                        <span>{{ driver.rating }}</span>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 items-center mt-3">
                    <button
                        type="button"
                        @click="sharePage"
                        class="text-sm lg:text-base text-white bg-red-900 hover:bg-red-800 px-3 py-1 rounded-md font-bold cursor-pointer transition"
                    >
                        {{ isCopied ? $t('copied') : $t('share') }}
                    </button>
                </div>
            </div>

            <!-- Accolades / Titles Won (if any) -->
            <div v-if="stats.championshipsWon > 0" class="rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 bg-amber-50 dark:bg-amber-950/30 border-amber-600 dark:border-amber-500 shadow-sm flex flex-col gap-2">
                <div class="flex items-center gap-2 font-extrabold text-black dark:text-white text-xl lg:text-2xl">
                    <span>{{ stats.championshipsWon === 1 ? $t('championshipSingle', { count: stats.championshipsWon }) : $t('championshipPlural', { count: stats.championshipsWon }) }}</span>
                </div>
                <div :class="stats.championshipsWon > 1 ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2'">
                    <div
                        v-for="ch in stats.championshipsWonList"
                        :key="ch.id"
                        class="inline-flex items-center gap-1.5 text-base lg:text-lg font-bold text-black dark:text-white flex-wrap"
                    >
                        <UModal v-if="ch.organizer" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                            <button
                                type="button"
                                :class="getOrganizerStyle(ch.organizer)"
                                class="text-[10px] lg:text-xs"
                                @click="setOrganizationByAbbr(ch.organizer)"
                            >
                                {{ ch.organizer }}
                            </button>
                            <template #content>
                                <ModalOrganization />
                            </template>
                        </UModal>
                        <UModal v-if="ch.game" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                            <button
                                type="button"
                                :class="getGameStyle(ch.game)"
                                class="text-[10px] lg:text-xs"
                                @click="setGameByAbbr(ch.game)"
                            >
                                {{ ch.game }}
                            </button>
                            <template #content>
                                <ModalGame />
                            </template>
                        </UModal>
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
                                            <UModal v-if="item.organizerAbbr" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                                                <button
                                                    type="button"
                                                    :class="getOrganizerStyle(item.organizerAbbr)"
                                                    class="text-[10px] lg:text-xs"
                                                    @click="setOrganizationByAbbr(item.organizerAbbr)"
                                                >
                                                    {{ item.organizerAbbr }}
                                                </button>
                                                <template #content>
                                                    <ModalOrganization />
                                                </template>
                                            </UModal>
                                            <UModal v-if="item.gameAbbr" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                                                <button
                                                    type="button"
                                                    :class="getGameStyle(item.gameAbbr)"
                                                    class="text-[10px] lg:text-xs"
                                                    @click="setGameByAbbr(item.gameAbbr)"
                                                >
                                                    {{ item.gameAbbr }}
                                                </button>
                                                <template #content>
                                                    <ModalGame />
                                                </template>
                                            </UModal>
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
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h2 class="text-lg lg:text-xl font-extrabold text-black dark:text-white flex items-center gap-2">
                            <span>{{ $t('driverResults') }}</span>
                        </h2>
                    </div>

                    <!-- Filters for Organizer and Game -->
                    <div v-if="allRaces.length > 0" class="flex flex-wrap items-center gap-3">
                        <!-- Organizer Filter -->
                        <div class="flex items-center gap-2 text-sm lg:text-base">
                            <label class="text-black dark:text-white font-bold whitespace-nowrap">{{ $t('organizer') }}:</label>
                            <USelectMenu
                                class="text-sm lg:text-base w-36 sm:w-44 border-2 border-red-900 dark:border-red-900 rounded-md p-1.5 sm:p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="selectedOrganizerOption"
                                :items="organizerOptions"
                                option-attribute="label"
                            />
                            <button
                                v-if="selectedOrganizer !== 'all'"
                                @click="selectedOrganizer = 'all'"
                                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                :title="$t('resetFilter')"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>

                        <!-- Game Filter -->
                        <div class="flex items-center gap-2 text-sm lg:text-base">
                            <label class="text-black dark:text-white font-bold whitespace-nowrap">{{ $t('game') }}:</label>
                            <USelectMenu
                                class="text-sm lg:text-base w-36 sm:w-44 border-2 border-red-900 dark:border-red-900 rounded-md p-1.5 sm:p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                                v-model="selectedGameOption"
                                :items="gameOptions"
                                option-attribute="label"
                            />
                            <button
                                v-if="selectedGame !== 'all'"
                                @click="selectedGame = 'all'"
                                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                :title="$t('resetFilter')"
                            >
                                <Icon name="mdi:filter-off" mode="svg" />
                            </button>
                        </div>

                        <!-- Reset Filter Button -->
                        <button
                            v-if="selectedOrganizer !== 'all' || selectedGame !== 'all'"
                            @click="resetResultsFilter"
                            class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold px-3 py-2 rounded-lg cursor-pointer whitespace-nowrap"
                        >
                            {{ $t('resetFilter') }}
                        </button>
                    </div>
                </div>

                <!-- Empty State -->
                <div v-if="filteredResults.length === 0" class="text-center py-12 border border-dashed border-gray-300 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
                    <p class="text-gray-500 dark:text-gray-400 text-sm lg:text-base">{{ allRaces.length === 0 ? $t('noDriverResults') : $t('noResultsFound') }}</p>
                </div>

                <!-- Results History Table -->
                <div v-else class="space-y-4">
                    <div class="border border-gray-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950">
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
                                        <th v-if="hasNoteColumn" class="py-3 px-3 text-center whitespace-nowrap">{{ $t('note') || 'Catatan' }}</th>
                                    </tr>
                                </thead>
                                <tbody class="text-sm lg:text-base divide-y divide-gray-200 dark:divide-slate-800">
                                    <tr
                                        v-for="item in paginatedResults"
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
                                                <UModal v-if="item.organizerAbbr" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                                                    <button
                                                        type="button"
                                                        :class="getOrganizerStyle(item.organizerAbbr)"
                                                        class="text-[10px] lg:text-xs"
                                                        @click.stop="setOrganizationByAbbr(item.organizerAbbr)"
                                                    >
                                                        {{ item.organizerAbbr }}
                                                    </button>
                                                    <template #content>
                                                        <ModalOrganization />
                                                    </template>
                                                </UModal>
                                                <UModal v-if="item.gameAbbr" :ui="{ content: 'sm:max-w-2xl lg:max-w-3xl' }">
                                                    <button
                                                        type="button"
                                                        :class="getGameStyle(item.gameAbbr)"
                                                        class="text-[10px] lg:text-xs"
                                                        @click.stop="setGameByAbbr(item.gameAbbr)"
                                                    >
                                                        {{ item.gameAbbr }}
                                                    </button>
                                                    <template #content>
                                                        <ModalGame />
                                                    </template>
                                                </UModal>
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
                                            <span v-if="!item.isWildcard && !item.noPoints && item.points > 0" class="text-emerald-700 dark:text-emerald-400">
                                                +{{ item.points }}
                                            </span>
                                            <span v-else></span>
                                        </td>

                                        <!-- Note (Catatan) -->
                                        <td v-if="hasNoteColumn" class="py-3 px-3 text-center whitespace-nowrap font-medium text-black dark:text-white">
                                            <span v-if="item.isWildcard">{{ $t('wildcard') || 'Wildcard' }}</span>
                                            <span v-else-if="item.noPoints">{{ $t('noPoints') || 'No Pts' }}</span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Pagination Controls -->
                    <div v-if="totalPages > 1 || filteredResults.length > 10" class="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <div class="flex items-center gap-2 text-sm lg:text-base text-black dark:text-white">
                            <span class="font-bold">{{ $t('perPage') }}:</span>
                            <select
                                v-model.number="itemsPerPage"
                                class="border border-red-900/50 dark:border-red-900 rounded-md px-2 py-1 bg-red-50 dark:bg-slate-950 text-black dark:text-white cursor-pointer text-sm lg:text-base font-bold"
                            >
                                <option :value="10">10</option>
                                <option :value="25">25</option>
                                <option :value="50">50</option>
                            </select>
                        </div>
                        <div v-if="totalPages > 1" class="flex justify-center items-center gap-2">
                            <div class="flex gap-2">
                                <button 
                                    @click="goToPage(1)" 
                                    :disabled="currentPage === 1"
                                    class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="material-symbols:first-page" mode="svg" />
                                </button>
                                <button 
                                    @click="goToPage(currentPage - 1)" 
                                    :disabled="currentPage === 1"
                                    class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="material-symbols:arrow-back-ios" mode="svg" />
                                </button>
                            </div>
                            <span class="px-3 py-1 font-bold text-sm lg:text-base text-black dark:text-white">{{ currentPage }} / {{ totalPages }}</span>
                            <div class="flex gap-2">
                                <button 
                                    @click="goToPage(currentPage + 1)" 
                                    :disabled="currentPage === totalPages"
                                    class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="material-symbols:arrow-forward-ios" mode="svg" />
                                </button>
                                <button 
                                    @click="goToPage(totalPages)" 
                                    :disabled="currentPage === totalPages"
                                    class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                    <Icon name="material-symbols:last-page" mode="svg" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
