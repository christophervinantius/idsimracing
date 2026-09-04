<script setup>
    useHead({
        htmlAttrs: {
            lang: "id"
        },
        title: "Klasemen | ID Sim Racing",
        meta: [
            {
                name: "description",
                content: "Klasemen pembalap dan tim sim racing Indonesia"
            }
        ]
    })

    useSeoMeta({
        title: "Klasemen | ID Sim Racing",
        ogTitle: "Klasemen | ID Sim Racing",
        twitterTitle: "Klasemen | ID Sim Racing",
        description: "Klasemen pembalap dan tim sim racing Indonesia",
        ogDescription: "Klasemen pembalap dan tim sim racing Indonesia",
        twitterDescription: "Klasemen pembalap dan tim sim racing Indonesia",
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev/standings",
        twitterCard: "summary_large_image"
    })

    const { t } = useI18n()
    const { $supabase } = useNuxtApp()

    // All championships that already have standings worth showing.
    const { data: championships, pending: loadingChampionships } = await useAsyncData("standings-championships", async () => {
        try {
            const { data, error } = await $supabase
                .from("championships")
                .select(`
                    id,
                    standings_type,
                    class_id,
                    season_id,
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
                            organizers (
                                abbreviation,
                                name
                            )
                        )
                    ),
                    championship_events (
                        id
                    )
                `)
            if (error) {
                console.warn("Championships fetch error:", error)
                return []
            }
            const rows = data || []
            // Latest season number first, then class / type.
            rows.sort((a, b) => {
                const sa = a.seasons?.season_number || 0
                const sb = b.seasons?.season_number || 0
                if (sb !== sa) return sb - sa
                const nameA = a.classes?.name || "Overall"
                const nameB = b.classes?.name || "Overall"
                return nameA.localeCompare(nameB)
            })
            return rows
        } catch (e) {
            console.error("Championships fetch error:", e)
            return []
        }
    })

    // 4 separate filter state fields: Event, Season, Class, Standings Type
    const selectedEventId = ref(null)
    const selectedSeasonId = ref(null)
    const selectedClassKey = ref("overall")
    const selectedType = ref("driver")

    const getSeasonLabel = (season) => {
        if (!season) return ""
        const eventName = season.events?.name || "Event"
        return `${eventName} S${season.season_number}`
    }

    // Available Events
    const availableEvents = computed(() => {
        const map = new Map()
        for (const champ of championships.value || []) {
            const ev = champ.seasons?.events
            if (ev && !map.has(ev.id)) map.set(ev.id, ev)
        }
        return [...map.values()].sort((a, b) => {
            const orgA = a.organizers?.abbreviation || a.organizers?.name || ""
            const orgB = b.organizers?.abbreviation || b.organizers?.name || ""
            const fullA = `${orgA} ${a.name}`.trim()
            const fullB = `${orgB} ${b.name}`.trim()
            return fullA.localeCompare(fullB)
        })
    })

    // Available Seasons for the selected event
    const availableSeasons = computed(() => {
        const map = new Map()
        for (const champ of championships.value || []) {
            if (selectedEventId.value && champ.seasons?.events?.id !== selectedEventId.value) continue
            const s = champ.seasons
            if (s && !map.has(s.id)) map.set(s.id, s)
        }
        return [...map.values()].sort((a, b) => (b.season_number || 0) - (a.season_number || 0))
    })

    // Available Classes for selected event + season
    const availableClasses = computed(() => {
        const map = new Map()
        for (const champ of championships.value || []) {
            if (selectedEventId.value && champ.seasons?.events?.id !== selectedEventId.value) continue
            if (selectedSeasonId.value && champ.season_id !== selectedSeasonId.value) continue
            const key = champ.class_id ? String(champ.class_id) : "overall"
            const label = champ.classes?.name || "Overall"
            if (!map.has(key)) map.set(key, { value: key, label })
        }
        return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
    })

    // Available Standings Types for selected event + season + class
    const availableTypes = computed(() => {
        const set = new Set()
        for (const champ of championships.value || []) {
            if (selectedEventId.value && champ.seasons?.events?.id !== selectedEventId.value) continue
            if (selectedSeasonId.value && champ.season_id !== selectedSeasonId.value) continue
            const key = champ.class_id ? String(champ.class_id) : "overall"
            if (selectedClassKey.value && key !== selectedClassKey.value) continue
            if (champ.standings_type) set.add(champ.standings_type)
        }
        return [...set]
    })

    // Automatic cascade of filters
    watchEffect(() => {
        if (availableEvents.value.length > 0) {
            if (!selectedEventId.value || !availableEvents.value.some(e => e.id === selectedEventId.value)) {
                selectedEventId.value = availableEvents.value[0].id
            }
        } else {
            selectedEventId.value = null
        }
    })

    watchEffect(() => {
        if (availableSeasons.value.length > 0) {
            if (!selectedSeasonId.value || !availableSeasons.value.some(s => s.id === selectedSeasonId.value)) {
                selectedSeasonId.value = availableSeasons.value[0].id
            }
        } else {
            selectedSeasonId.value = null
        }
    })

    watchEffect(() => {
        if (availableClasses.value.length > 0) {
            if (!selectedClassKey.value || !availableClasses.value.some(c => c.value === selectedClassKey.value)) {
                selectedClassKey.value = availableClasses.value[0].value
            }
        } else {
            selectedClassKey.value = "overall"
        }
    })

    watchEffect(() => {
        if (availableTypes.value.length > 0) {
            if (!selectedType.value || !availableTypes.value.includes(selectedType.value)) {
                selectedType.value = availableTypes.value[0]
            }
        } else {
            selectedType.value = "driver"
        }
    })

    const selectedChampionship = computed(() => {
        return (championships.value || []).find(c => {
            const matchesEvent = !selectedEventId.value || c.seasons?.events?.id === selectedEventId.value
            const matchesSeason = !selectedSeasonId.value || c.season_id === selectedSeasonId.value
            const key = c.class_id ? String(c.class_id) : "overall"
            const matchesClass = key === selectedClassKey.value
            const matchesType = c.standings_type === selectedType.value
            return matchesEvent && matchesSeason && matchesClass && matchesType
        }) || null
    })

    const selectedChampionshipId = computed(() => selectedChampionship.value?.id || "")

    const standings = ref([])
    const loadingStandings = ref(false)
    const championshipRounds = ref([])
    const progressionMap = ref(new Map())
    const allPointsSystemsMap = ref(new Map())
    const seasonDriverClasses = ref(new Map())

    const currentPointsSystem = computed(() => {
        const psId = championshipRounds.value[0]?.points_system_id
        if (!psId) return null
        return allPointsSystemsMap.value.get(psId) || null
    })

    const currentPointsRules = computed(() => {
        if (!currentPointsSystem.value) return []
        const rules = [...(currentPointsSystem.value.points_system_rules || [])]
        rules.sort((a, b) => Number(a.position) - Number(b.position))
        return rules
    })

    const currentPointsBonuses = computed(() => {
        if (!currentPointsSystem.value) return []
        return currentPointsSystem.value.points_bonuses || []
    })

    const maxPointsPosition = computed(() => {
        if (currentPointsRules.value.length === 0) return 10
        const positions = currentPointsRules.value
            .filter(r => Number(r.points) > 0)
            .map(r => Number(r.position))
        return positions.length > 0 ? Math.max(...positions) : 10
    })

    const pointsFinishText = computed(() => {
        const max = maxPointsPosition.value
        if (max <= 3) return null
        return max === 4 ? "4" : `4-${max}`
    })

    const nonPointsFinishText = computed(() => {
        const max = maxPointsPosition.value
        return `${max + 1}+`
    })

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
        "vietnam": { code: "vn", abbr: "VIE" }
    }

    const getCountryInfo = (countryName, fallbackRound) => {
        if (!countryName) {
            return {
                abbr: fallbackRound ? `R${fallbackRound}` : "-",
                code: ""
            }
        }
        const clean = String(countryName).toLowerCase().trim()
        if (COUNTRY_MAP[clean]) {
            return COUNTRY_MAP[clean]
        }
        if (clean.length === 2) {
            return {
                code: clean,
                abbr: clean.toUpperCase()
            }
        }
        return {
            abbr: clean.slice(0, 3).toUpperCase(),
            code: ""
        }
    }

    const getDriverCountryCode = (driver) => {
        if (!driver) return null
        if (driver.countries?.code) return driver.countries.code.toLowerCase()
        if (driver.country && String(driver.country).length === 2 && isNaN(Number(driver.country))) {
            return String(driver.country).toLowerCase()
        }
        const name = driver.country_name || (typeof driver.country === 'string' && isNaN(Number(driver.country)) ? driver.country : null)
        if (name) {
            const info = getCountryInfo(name)
            if (info?.code) return info.code.toLowerCase()
        }
        return null
    }

    const sortedRounds = computed(() => {
        const list = [...(championshipRounds.value || [])]
        list.sort((a, b) => {
            const da = a.schedule?.date ? new Date(a.schedule.date).getTime() : 0
            const db = b.schedule?.date ? new Date(b.schedule.date).getTime() : 0
            if (da !== db) return da - db
            const ra = Number(a.schedule?.round) || 0
            const rb = Number(b.schedule?.round) || 0
            if (ra !== rb) return ra - rb
            return String(a.session_type || "").localeCompare(String(b.session_type || ""))
        })
        return list
    })

    const fetchStandings = async () => {
        if (!selectedChampionshipId.value) {
            standings.value = []
            championshipRounds.value = []
            progressionMap.value = new Map()
            return
        }
        loadingStandings.value = true
        try {
            // 0. Fetch season_driver_classes for the current season
            const seasonId = selectedSeasonId.value || selectedChampionship.value?.season_id
            if (seasonId) {
                const { data: sdcData } = await $supabase
                    .from("season_driver_classes")
                    .select("driver_id, class_id")
                    .eq("season_id", seasonId)

                const sdcMap = new Map()
                for (const sdc of sdcData || []) {
                    if (sdc.driver_id && sdc.class_id) {
                        sdcMap.set(String(sdc.driver_id), String(sdc.class_id))
                    }
                }
                seasonDriverClasses.value = sdcMap
            } else {
                seasonDriverClasses.value = new Map()
            }

            // 1. Fetch Standings
            let { data, error } = await $supabase
                .from("standings")
                .select(`
                    id,
                    entity_type,
                    driver_id,
                    team_id,
                    car_number,
                    points,
                    wins,
                    podiums,
                    position,
                    updated_at,
                    drivers (
                        id,
                        name,
                        rating,
                        country_name,
                        countries (
                            code,
                            name
                        ),
                        teams (
                            id,
                            name
                        )
                    ),
                    teams (
                        id,
                        name
                    )
                `)
                .eq("championship_id", selectedChampionshipId.value)
                .order("position", { ascending: true })

            if (error && (error.message?.includes("car_number") || error.code === "PGRST204" || error.code === "42703")) {
                const res = await $supabase
                    .from("standings")
                    .select(`
                        id,
                        entity_type,
                        driver_id,
                        team_id,
                        points,
                        wins,
                        podiums,
                        position,
                        updated_at,
                        drivers (
                            id,
                            name,
                            rating,
                            country_name,
                            countries (
                                code,
                                name
                            ),
                            teams (
                                id,
                                name
                            )
                        ),
                        teams (
                            id,
                            name
                        )
                    `)
                    .eq("championship_id", selectedChampionshipId.value)
                    .order("position", { ascending: true })
                data = res.data
                error = res.error
            }

            if (error) {
                console.warn("Standings fetch error:", error)
                standings.value = []
            } else {
                standings.value = data || []
            }

            // 2. Fetch Championship Rounds
            const { data: roundsData, error: roundsErr } = await $supabase
                .from("championship_events")
                .select(`
                    id,
                    championship_id,
                    schedule_id,
                    session_type,
                    points_system_id,
                    points_multiplier,
                    schedule (
                        id,
                        round,
                        circuit,
                        date,
                        season,
                        country,
                        country_2
                    )
                `)
                .eq("championship_id", selectedChampionshipId.value)

            if (roundsErr) {
                console.warn("Rounds fetch error:", roundsErr)
                championshipRounds.value = []
                progressionMap.value = new Map()
                return
            }

            championshipRounds.value = roundsData || []

            // 3. Fetch Points Systems & Entries to build results matrix
            const scheduleIds = [...new Set((roundsData || []).map(r => r.schedule_id).filter(Boolean))]
            if (scheduleIds.length === 0) {
                progressionMap.value = new Map()
                return
            }

            const [systemsMap, sessions] = await Promise.all([
                fetchPointsSystemsMap($supabase).catch(() => new Map()),
                fetchSessionsForScoring($supabase, scheduleIds).catch(() => [])
            ])

            allPointsSystemsMap.value = systemsMap

            // Build progression mapping per round & entity
            const newMap = new Map()

            const matchSession = (roundType, sessType) => {
                const rt = String(roundType || "race").toLowerCase().trim()
                const st = String(sessType || "race").toLowerCase().trim()
                if (rt === st) return true
                if ((rt === "race" || rt === "race_1" || rt === "race1") && (st === "race" || st === "race_1" || st === "race1")) return true
                return false
            }

            for (const round of roundsData || []) {
                const system = systemsMap.get(round.points_system_id) || null
                const multiplier = Number(round.points_multiplier) || 1

                const isClassChampionship = Boolean(selectedChampionship.value?.class_id)
                const targetClassId = selectedChampionship.value?.class_id ? String(selectedChampionship.value.class_id) : null

                const session = sessions.find(
                    s => s.schedule_id === round.schedule_id && matchSession(round.session_type, s.session_type)
                )

                const qualifyingSession = sessions.find(
                    s => s.schedule_id === round.schedule_id && String(s.session_type || "").toLowerCase().trim() === "qualifying"
                )

                const poleKeys = new Set()
                if (qualifyingSession) {
                    for (const qr of qualifyingSession.results || []) {
                        if (targetClassId && qr.class_id && String(qr.class_id) !== targetClassId) continue
                        const qpos = isClassChampionship ? (qr.scoring_position ?? qr.classified_position) : (qr.classified_position ?? qr.scoring_position)
                        if (qpos === 1) {
                            if (qr.driver_ids && qr.driver_ids.length > 0) {
                                qr.driver_ids.forEach(id => { if (id) poleKeys.add(String(id)) })
                            } else if (qr.driver_id) {
                                poleKeys.add(String(qr.driver_id))
                            }
                            if (qr.team_id !== null && qr.team_id !== undefined) {
                                const teamKey = (qr.car_number !== null && qr.car_number !== undefined)
                                    ? `${qr.team_id}::${qr.car_number}`
                                    : String(qr.team_id)
                                poleKeys.add(teamKey)
                            }
                        }
                    }
                }

                const hasResults = Boolean(session && session.results && session.results.length > 0)
                const entriesMap = new Map()

                if (session && session.results) {
                    for (const r of session.results) {
                        if (targetClassId && r.class_id && String(r.class_id) !== targetClassId) continue

                        const entityKeys = []
                        if (entityType.value === "driver") {
                            const dIds = r.driver_ids && r.driver_ids.length > 0 ? r.driver_ids : (r.driver_id ? [r.driver_id] : [])
                            dIds.forEach(id => {
                                if (id && !entityKeys.includes(String(id))) entityKeys.push(String(id))
                            })
                        } else {
                            if (r.team_id !== null && r.team_id !== undefined) {
                                const teamKey = (r.car_number !== null && r.car_number !== undefined)
                                    ? `${r.team_id}::${r.car_number}`
                                    : String(r.team_id)
                                entityKeys.push(teamKey)
                            }
                        }

                        for (const key of entityKeys) {
                            const isPole = poleKeys.has(key) || (isClassChampionship ? Number(r.grid_position) === 1 : (Number(r.grid_position) === 1 && Number(r.classified_position) === 1))
                            const pts = calculateResultPoints(system, r, {
                                isPole,
                                multiplier
                            })

                            entriesMap.set(key, {
                                scoring_position: r.scoring_position,
                                classified_position: r.classified_position,
                                status: r.status,
                                isPole,
                                fastest_lap: Boolean(r.fastest_lap),
                                points: pts,
                                driver_id: r.driver_id,
                                driver_ids: r.driver_ids,
                                class_id: r.class_id
                            })
                        }
                    }
                }

                const roundKey = `${round.schedule_id}::${round.session_type || 'race'}`
                newMap.set(round.id, { hasResults, entries: entriesMap })
                newMap.set(roundKey, { hasResults, entries: entriesMap })
                newMap.set(String(round.schedule_id), { hasResults, entries: entriesMap })
            }

            progressionMap.value = newMap
        } catch (e) {
            console.error("Standings fetch error:", e)
            standings.value = []
            championshipRounds.value = []
            progressionMap.value = new Map()
        } finally {
            loadingStandings.value = false
        }
    }

    const getMatrixCellData = (row, rnd) => {
        const key = entityType.value === "driver"
            ? String(row.driver_id)
            : (row.car_number !== null && row.car_number !== undefined
                ? `${row.team_id}::${row.car_number}`
                : String(row.team_id))

        const sessionData = progressionMap.value.get(rnd.id) ||
            progressionMap.value.get(`${rnd.schedule_id}::${rnd.session_type || 'race'}`) ||
            progressionMap.value.get(String(rnd.schedule_id))

        if (!sessionData || !sessionData.hasResults) {
            return { text: "", isBlank: true, bgClass: "bg-transparent" }
        }

        const entry = sessionData.entries.get(key)
        if (!entry) {
            return { text: "", isBlank: true, bgClass: "bg-transparent" }
        }

        const status = String(entry.status || "finished").toLowerCase().trim()

        if (status === "dsq" || status === "disqualified") {
            return {
                text: "DSQ",
                pos: null,
                isPole: Boolean(entry.isPole),
                fastestLap: Boolean(entry.fastest_lap),
                bgClass: "bg-black text-white font-medium"
            }
        }

        if (status === "dns") {
            return {
                text: "DNS",
                pos: null,
                isPole: Boolean(entry.isPole),
                fastestLap: Boolean(entry.fastest_lap),
                bgClass: "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-medium"
            }
        }

        if (status === "dnf" || status === "retired") {
            return {
                text: "DNF",
                pos: null,
                isPole: Boolean(entry.isPole),
                fastestLap: Boolean(entry.fastest_lap),
                bgClass: "bg-purple-200 dark:bg-purple-900/60 text-purple-950 dark:text-purple-200 font-medium"
            }
        }

        const isClassChampionship = Boolean(selectedChampionship.value?.class_id)
        const pos = isClassChampionship
            ? (entry.scoring_position ?? entry.classified_position)
            : (entry.classified_position ?? entry.scoring_position)

        if (pos === null || pos === undefined) {
            return { text: "-", bgClass: "bg-transparent text-gray-400" }
        }

        let bgClass = "bg-blue-100 dark:bg-blue-900/40 text-blue-950 dark:text-blue-200 font-medium" // Non-points

        if (pos === 1) {
            bgClass = "bg-yellow-200 dark:bg-yellow-500/80 text-yellow-950 dark:text-black font-medium"
        } else if (pos === 2) {
            bgClass = "bg-slate-300 dark:bg-slate-400 text-slate-950 dark:text-black font-medium"
        } else if (pos === 3) {
            bgClass = "bg-amber-200 dark:bg-amber-500/80 text-amber-950 dark:text-black font-medium"
        } else if (entry.points > 0) {
            bgClass = "bg-emerald-100 dark:bg-emerald-800/60 text-emerald-950 dark:text-emerald-100 font-medium"
        }

        return {
            text: String(pos),
            pos,
            isPole: Boolean(entry.isPole),
            fastestLap: Boolean(entry.fastest_lap),
            bgClass
        }
    }

    const hasRoundResults = (rnd) => {
        if (!rnd) return false
        const sessionData = progressionMap.value.get(rnd.id) || progressionMap.value.get(String(rnd.schedule_id))
        return Boolean(sessionData && sessionData.hasResults && (rnd.schedule_id || rnd.schedule?.id))
    }

    watch(selectedChampionshipId, fetchStandings, { immediate: true })

    // Championships store one standings type, so the table follows it.
    const entityType = computed(() => selectedChampionship.value?.standings_type || selectedType.value || "driver")

    // Countback comparison helper
    const compareFinishPositions = (posA, posB) => {
        if (!posA.length && !posB.length) return 0
        const allPos = [...posA, ...posB]
        const maxPos = allPos.length > 0 ? Math.max(...allPos) : 100
        for (let p = 1; p <= maxPos; p++) {
            const countA = posA.filter(pos => pos === p).length
            const countB = posB.filter(pos => pos === p).length
            if (countB !== countA) {
                return countB - countA
            }
        }
        return 0
    }

    const getRowFinishPositions = (row) => {
        const positions = []
        for (const rnd of sortedRounds.value || []) {
            const cell = getMatrixCellData(row, rnd)
            if (!cell.isBlank && cell.pos && typeof cell.pos === "number") {
                positions.push(cell.pos)
            }
        }
        return positions
    }

    const isTeamInClass = (teamRow, targetClassStr) => {
        // If the championship is already configured for this class, all its standings rows belong to it
        if (selectedChampionship.value?.class_id && String(selectedChampionship.value.class_id) === targetClassStr) {
            return true
        }
        if (teamRow.driver_id && seasonDriverClasses.value.get(String(teamRow.driver_id)) === targetClassStr) {
            return true
        }
        const targetTeamId = Number(teamRow.team_id)
        const targetCarNumber = teamRow.car_number !== null && teamRow.car_number !== undefined ? Number(teamRow.car_number) : null

        for (const [rndKey, sessionData] of progressionMap.value.entries()) {
            if (!sessionData?.entries) continue
            for (const [key, entry] of sessionData.entries.entries()) {
                let match = false
                if (targetCarNumber !== null) {
                    if (key === `${targetTeamId}::${targetCarNumber}`) match = true
                } else {
                    if (key === String(targetTeamId) || key.startsWith(`${targetTeamId}::`)) match = true
                }
                if (match) {
                    if (entry.class_id && String(entry.class_id) === targetClassStr) {
                        return true
                    }
                    const dIds = entry.driver_ids && entry.driver_ids.length > 0 ? entry.driver_ids : (entry.driver_id ? [entry.driver_id] : [])
                    if (dIds.some(id => id && seasonDriverClasses.value.get(String(id)) === targetClassStr)) {
                        return true
                    }
                }
            }
        }
        return false
    }

    const visibleStandings = computed(() => {
        let list = standings.value.filter(r => r.entity_type === entityType.value)
        if (list.length === 0) return []

        // If the championship itself is already scoped to a specific class, all its standings rows belong to that class.
        // We only filter if an overall championship is being viewed with a class filter.
        const activeClassId = selectedChampionship.value?.class_id
        if (!activeClassId && selectedClassKey.value !== "overall") {
            const targetClassStr = String(selectedClassKey.value)
            list = list.filter(row => {
                if (entityType.value === "driver") {
                    const dClass = seasonDriverClasses.value.get(String(row.driver_id))
                    return dClass === targetClassStr
                } else {
                    return isTeamInClass(row, targetClassStr)
                }
            })
        }
        if (list.length === 0) return []

        // Sort by points desc, then countback of best finish positions
        const sorted = [...list].sort((a, b) => {
            const ptsA = Number(a.points) || 0
            const ptsB = Number(b.points) || 0
            if (ptsB !== ptsA) return ptsB - ptsA

            const finishA = getRowFinishPositions(a)
            const finishB = getRowFinishPositions(b)
            const countback = compareFinishPositions(finishA, finishB)
            if (countback !== 0) return countback

            const winsA = Number(a.wins) || 0
            const winsB = Number(b.wins) || 0
            if (winsB !== winsA) return winsB - winsA

            return (Number(a.position) || 999) - (Number(b.position) || 999)
        })

        // Reassign position accounting for dead heats
        let lastPos = 0
        sorted.forEach((row, idx) => {
            const prev = idx > 0 ? sorted[idx - 1] : null
            let tied = false
            if (prev && Number(prev.points) === Number(row.points)) {
                const finishRow = getRowFinishPositions(row)
                const finishPrev = getRowFinishPositions(prev)
                tied = compareFinishPositions(finishRow, finishPrev) === 0
            }
            lastPos = tied ? lastPos : idx + 1
            row.position = lastPos
        })

        return sorted
    })

    // Leader is position 1
    const leader = computed(() => {
        return visibleStandings.value.find(r => r.position === 1) || visibleStandings.value[0] || null
    })

    const lastUpdated = computed(() => {
        const stamps = visibleStandings.value
            .map(r => (r.updated_at ? new Date(r.updated_at).getTime() : 0))
            .filter(n => n > 0)
        if (stamps.length === 0) return null
        return new Date(Math.max(...stamps))
    })

    const eventSelectOptions = computed(() => {
        return availableEvents.value.map(ev => {
            const org = ev.organizers?.abbreviation || ev.organizers?.name || ""
            const label = org ? `${org} ${ev.name}` : ev.name
            return { value: ev.id, label }
        })
    })

    const selectedEventOption = computed({
        get() {
            return eventSelectOptions.value.find(o => o.value === selectedEventId.value) || eventSelectOptions.value[0] || null
        },
        set(val) {
            selectedEventId.value = val ? val.value : null
        }
    })

    const seasonSelectOptions = computed(() => {
        return availableSeasons.value.map(s => ({
            value: s.id,
            label: `Season ${s.season_number}`
        }))
    })

    const selectedSeasonOption = computed({
        get() {
            return seasonSelectOptions.value.find(o => o.value === selectedSeasonId.value) || seasonSelectOptions.value[0] || null
        },
        set(val) {
            selectedSeasonId.value = val ? val.value : null
        }
    })

    const classSelectOptions = computed(() => availableClasses.value)

    const selectedClassOption = computed({
        get() {
            return classSelectOptions.value.find(o => o.value === selectedClassKey.value) || classSelectOptions.value[0] || null
        },
        set(val) {
            selectedClassKey.value = val ? val.value : "overall"
        }
    })

    const typeSelectOptions = computed(() => {
        return availableTypes.value.map(type => ({
            value: type,
            label: type === "driver" ? t("driverStandings") : t("teamStandings")
        }))
    })

    const selectedTypeOption = computed({
        get() {
            return typeSelectOptions.value.find(o => o.value === selectedType.value) || typeSelectOptions.value[0] || null
        },
        set(val) {
            selectedType.value = val ? val.value : "driver"
        }
    })

    const formatDateTime = (date) => {
        if (!date) return "-"
        return new Intl.DateTimeFormat("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(date)
    }

    const getRowStyle = (position) => {
        if (position === 1) {
            return "bg-yellow-200/90 dark:bg-yellow-950/60 hover:bg-yellow-300/90 dark:hover:bg-yellow-900/60 text-yellow-700 dark:text-yellow-400 font-extrabold"
        } else if (position === 2) {
            return "bg-slate-200/90 dark:bg-slate-800/80 hover:bg-slate-300/90 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 font-extrabold"
        } else if (position === 3) {
            return "bg-amber-200/80 dark:bg-amber-950/50 hover:bg-amber-300/80 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-500 font-extrabold"
        }
        return "text-black dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800/50"
    }

    const getEntityName = (row) => {
        if (entityType.value === "driver") return row.drivers?.name || "-"
        const baseTeam = row.teams?.name || "-"
        return row.car_number ? `${baseTeam} #${row.car_number}` : baseTeam
    }

    // Gap to the championship leader, the number fans actually look for.
    const getGapToLeader = (row) => {
        if (!leader.value || row.id === leader.value.id) return null
        const diff = Number(leader.value.points) - Number(row.points)
        if (diff <= 0) return null
        return diff
    }

    // Gap to the previous position (position ahead).
    const getGapToPrevious = (row, index) => {
        if (index === 0) return null
        const prev = visibleStandings.value[index - 1]
        if (!prev) return null
        const diff = Number(prev.points) - Number(row.points)
        return Math.max(0, diff)
    }

    const showTopButton = ref(false)

    const handleScrollTop = () => {
        showTopButton.value = window.scrollY > 100
    }

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        })
    }

    onMounted(() => {
        window.addEventListener("scroll", handleScrollTop)
    })

    onUnmounted(() => {
        window.removeEventListener("scroll", handleScrollTop)
    })
</script>

<template>
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6">
        <!-- Page Title -->
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('standingsTitle') }}
        </div>

        <!-- Filters Section -->
        <div class="mx-auto flex flex-col justify-center items-center gap-4">
            <!-- Row 1: Event and Season -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- Event Filter -->
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('events') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedEventOption"
                            :items="eventSelectOptions"
                            option-attribute="label"
                        />
                    </div>
                </div>

                <!-- Season Filter -->
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('season') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedSeasonOption"
                            :items="seasonSelectOptions"
                            option-attribute="label"
                        />
                    </div>
                </div>
            </div>

            <!-- Row 2: Class and Standings Type -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- Class Filter -->
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('class') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedClassOption"
                            :items="classSelectOptions"
                            option-attribute="label"
                        />
                    </div>
                </div>

                <!-- Type Filter -->
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('standingsType') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedTypeOption"
                            :items="typeSelectOptions"
                            option-attribute="label"
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Loading championships / standings -->
        <div v-if="loadingChampionships || loadingStandings" class="py-20 flex flex-col items-center justify-center gap-3">
            <Icon name="material-symbols:refresh" class="animate-spin text-4xl text-red-700" />
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ $t('loading') }}</p>
        </div>

        <!-- Content Area -->
        <div v-else-if="visibleStandings.length" class="w-full flex flex-col gap-6 lg:gap-8">
            <!-- Unified Standings & Results Table -->
            <div class="overflow-x-auto bg-white dark:bg-slate-950">
                <table class="w-full text-sm lg:text-base border-collapse">
                    <thead class="bg-red-900 dark:bg-red-900 text-white">
                        <tr>
                            <th class="w-1/12 px-2 lg:px-4 py-2 text-center font-bold min-w-[36px]">
                                {{ $t('position') }}
                            </th>
                            <th class="px-2 lg:px-4 py-2 text-center font-bold min-w-[150px] lg:min-w-[180px]">
                                {{ entityType === 'driver' ? $t('driver') : $t('carNumber') }}
                            </th>
                            <th class="px-2 lg:px-4 py-2 text-center font-bold min-w-[120px] lg:min-w-[150px]">
                                {{ $t('team') }}
                            </th>
                            <th
                                v-for="(rnd, idx) in sortedRounds"
                                :key="rnd.id"
                                class="px-2 lg:px-3 py-2 text-center font-bold min-w-[52px] lg:min-w-[58px]"
                            >
                                <div class="flex flex-col items-center justify-center gap-1">
                                    <NuxtLink
                                        v-if="hasRoundResults(rnd)"
                                        :to="`/results/${rnd.schedule_id || rnd.schedule?.id}`"
                                        target="_blank"
                                        class="hover:underline hover:text-yellow-300 transition cursor-pointer flex flex-col items-center justify-center gap-1"
                                        :title="rnd.schedule?.circuit ? `${rnd.schedule.circuit} - ${$t('viewResults')}` : $t('viewResults')"
                                    >
                                        <span class="leading-tight">R{{ rnd.schedule?.round || (idx + 1) }}</span>
                                        <div v-if="rnd.schedule?.country" class="flex items-center justify-center gap-1">
                                            <Icon
                                                :name="`flag-${rnd.schedule.country.toLowerCase()}-4x3`"
                                                mode="svg"
                                                class="w-6 h-4.5 lg:w-7 lg:h-5 rounded-xs shadow-sm hover:scale-110 transition-transform"
                                            />
                                            <Icon
                                                v-if="rnd.schedule?.country_2"
                                                :name="`flag-${rnd.schedule.country_2.toLowerCase()}-4x3`"
                                                mode="svg"
                                                class="w-6 h-4.5 lg:w-7 lg:h-5 rounded-xs shadow-sm hover:scale-110 transition-transform"
                                            />
                                        </div>
                                    </NuxtLink>
                                    <template v-else>
                                        <span class="leading-tight">R{{ rnd.schedule?.round || (idx + 1) }}</span>
                                        <div v-if="rnd.schedule?.country" class="flex items-center justify-center gap-1" :title="rnd.schedule?.circuit || ''">
                                            <Icon
                                                :name="`flag-${rnd.schedule.country.toLowerCase()}-4x3`"
                                                mode="svg"
                                                class="w-6 h-4.5 lg:w-7 lg:h-5 rounded-xs shadow-sm"
                                            />
                                            <Icon
                                                v-if="rnd.schedule?.country_2"
                                                :name="`flag-${rnd.schedule.country_2.toLowerCase()}-4x3`"
                                                mode="svg"
                                                class="w-6 h-4.5 lg:w-7 lg:h-5 rounded-xs shadow-sm"
                                            />
                                        </div>
                                    </template>
                                </div>
                            </th>
                            <th class="w-1/12 px-2 lg:px-4 py-2 text-center font-bold min-w-[50px]">
                                {{ $t('points') }}
                            </th>
                            <th class="w-1/12 px-2 lg:px-4 py-2 text-center font-bold min-w-[50px]">
                                {{ $t('gapLeader') }}
                            </th>
                            <th class="w-1/12 px-2 lg:px-4 py-2 text-center font-bold min-w-[50px]">
                                {{ $t('gapPrevious') }}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(row, rowIndex) in visibleStandings"
                            :key="row.id"
                            class="border-b border-slate-300 dark:border-slate-700 text-center hover:opacity-95 text-black dark:text-white bg-red-50 dark:bg-slate-950"
                        >
                            <td class="px-2 lg:px-4 py-2 font-medium">
                                {{ row.position || '-' }}
                            </td>
                            <td class="px-2 lg:px-4 py-2 font-medium whitespace-nowrap" :class="entityType === 'driver' ? 'text-left' : 'text-center'">
                                <div v-if="entityType === 'driver'" class="flex items-center gap-1.5">
                                    <Icon
                                        v-if="getDriverCountryCode(row.drivers)"
                                        :name="`flag-${getDriverCountryCode(row.drivers)}-4x3`"
                                        mode="svg"
                                        class="w-4 h-3 lg:w-4.5 lg:h-3.5 rounded-xs shadow-xs shrink-0"
                                    />
                                    <span>{{ row.drivers?.name || '-' }}</span>
                                </div>
                                <span v-else>{{ row.car_number ? `${row.car_number}` : '-' }}</span>
                            </td>
                            <td class="px-2 lg:px-4 py-2 font-medium whitespace-nowrap text-left">
                                <span v-if="entityType === 'driver'">{{ row.drivers?.teams?.name || '-' }}</span>
                                <span v-else>{{ row.teams?.name || '-' }}</span>
                            </td>
                            <td
                                v-for="rnd in sortedRounds"
                                :key="rnd.id"
                                class="p-0"
                            >
                                <div
                                    class="w-full h-full min-h-[36px] flex items-center justify-center font-medium px-1 select-none"
                                    :class="getMatrixCellData(row, rnd).bgClass"
                                >
                                    <span v-if="!getMatrixCellData(row, rnd).isBlank" class="relative inline-flex items-center">
                                        <span>{{ getMatrixCellData(row, rnd).text }}</span>
                                        <sup v-if="getMatrixCellData(row, rnd).isPole" class="font-medium text-[10px] lg:text-xs ml-0.5">P</sup>
                                        <sup v-if="getMatrixCellData(row, rnd).fastestLap" class="font-medium text-[10px] lg:text-xs ml-0.5">F</sup>
                                    </span>
                                </div>
                            </td>
                            <td class="px-2 lg:px-4 py-2 font-medium text-black dark:text-white">
                                {{ formatPoints(row.points) }}
                            </td>
                            <td class="px-2 lg:px-4 py-2 font-medium text-black dark:text-white">
                                <span v-if="getGapToLeader(row) !== null">-{{ formatPoints(getGapToLeader(row)) }}</span>
                                <span v-else></span>
                            </td>
                            <td class="px-2 lg:px-4 py-2 font-medium text-black dark:text-white">
                                <span v-if="getGapToPrevious(row, rowIndex) !== null">
                                    {{ getGapToPrevious(row, rowIndex) === 0 ? '' : `-${formatPoints(getGapToPrevious(row, rowIndex))}` }}
                                </span>
                                <span v-else></span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- No standings found -->
        <div v-else class="text-center text-black dark:text-white text-base lg:text-lg leading-6 py-12">
            {{ $t('noStandingsYet') }}
        </div>

        <button v-if="showTopButton" @click="scrollToTop" class="fixed bottom-12 right-8 bg-red-900 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer">
            <Icon name="mi:arrow-up" size="2.5em" mode="svg" />
        </button>
    </div>
</template>
