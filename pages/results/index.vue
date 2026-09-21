<script setup>
    import { cleanTeamName, parseTeamInfo } from "~/composables/useRaceResult"

    const { t, locale } = useI18n()

    useHead({
        htmlAttrs: {
            lang: locale.value === "en" ? "en" : "id"
        },
        title: t("resultsTitle"),
        meta: [
            {
                name: "description",
                content: locale.value === "en" ? "Indonesia Sim Racing Race Results" : "Hasil Balapan Sim Racing Indonesia"
            }
        ]
    })

    useSeoMeta({
        title: "ID Sim Racing - Hasil Balapan",
        ogTitle: "ID Sim Racing - Hasil Balapan",
        twitterTitle: "ID Sim Racing - Hasil Balapan",
        description: "Hasil Balapan Sim Racing Indonesia",
        ogDescription: "Hasil Balapan Sim Racing Indonesia",
        twitterDescription: "Hasil Balapan Sim Racing Indonesia",
        ogImage: "https://idsimracing.pages.dev/images/1.png",
        twitterImage: "https://idsimracing.pages.dev/images/1.png",
        ogUrl: "https://idsimracing.pages.dev/results",
        twitterCard: "summary_large_image",
    })

    const COUNTRY_MAP = {
        "ina": { code: "id", abbr: "IDN" },
        "idn": { code: "id", abbr: "IDN" },
        "indonesia": { code: "id", abbr: "IDN" },
        "mys": { code: "my", abbr: "MAS" },
        "mas": { code: "my", abbr: "MAS" },
        "malaysia": { code: "my", abbr: "MAS" },
        "sgp": { code: "sg", abbr: "SGP" },
        "sin": { code: "sg", abbr: "SGP" },
        "singapore": { code: "sg", abbr: "SGP" },
        "tha": { code: "th", abbr: "THA" },
        "thailand": { code: "th", abbr: "THA" },
        "gbr": { code: "gb", abbr: "GBR" },
        "uk":  { code: "gb", abbr: "GBR" },
        "great britain": { code: "gb", abbr: "GBR" },
        "usa": { code: "us", abbr: "USA" },
        "united states": { code: "us", abbr: "USA" },
        "aus": { code: "au", abbr: "AUS" },
        "australia": { code: "au", abbr: "AUS" },
        "jpn": { code: "jp", abbr: "JPN" },
        "japan": { code: "jp", abbr: "JPN" },
        "fra": { code: "fr", abbr: "FRA" },
        "france": { code: "fr", abbr: "FRA" },
        "deu": { code: "de", abbr: "GER" },
        "ger": { code: "de", abbr: "GER" },
        "germany": { code: "de", abbr: "GER" },
        "ita": { code: "it", abbr: "ITA" },
        "italy": { code: "it", abbr: "ITA" },
        "esp": { code: "es", abbr: "ESP" },
        "spa": { code: "es", abbr: "ESP" },
        "spain": { code: "es", abbr: "ESP" },
        "ned": { code: "nl", abbr: "NED" },
        "nld": { code: "nl", abbr: "NED" },
        "netherlands": { code: "nl", abbr: "NED" },
        "bel": { code: "be", abbr: "BEL" },
        "belgium": { code: "be", abbr: "BEL" },
        "bra": { code: "br", abbr: "BRA" },
        "brazil": { code: "br", abbr: "BRA" },
        "can": { code: "ca", abbr: "CAN" },
        "canada": { code: "ca", abbr: "CAN" },
        "nzl": { code: "nz", abbr: "NZL" },
        "new zealand": { code: "nz", abbr: "NZL" },
        "kor": { code: "kr", abbr: "KOR" },
        "korea": { code: "kr", abbr: "KOR" },
        "mex": { code: "mx", abbr: "MEX" },
        "mexico": { code: "mx", abbr: "MEX" },
        "mon": { code: "mc", abbr: "MON" },
        "monaco": { code: "mc", abbr: "MON" },
        "por": { code: "pt", abbr: "POR" },
        "prt": { code: "pt", abbr: "POR" },
        "portugal": { code: "pt", abbr: "POR" },
        "zaf": { code: "za", abbr: "RSA" },
        "rsa": { code: "za", abbr: "RSA" },
        "south africa": { code: "za", abbr: "RSA" },
        "tur": { code: "tr", abbr: "TUR" },
        "turkey": { code: "tr", abbr: "TUR" },
        "vie": { code: "vn", abbr: "VIE" },
        "vnm": { code: "vn", abbr: "VIE" },
        "vietnam": { code: "vn", abbr: "VIE" },
        "phl": { code: "ph", abbr: "PHI" },
        "phi": { code: "ph", abbr: "PHI" },
        "philippines": { code: "ph", abbr: "PHI" }
    }

    const getDriverCountryCode = (driverOrCountry) => {
        if (!driverOrCountry) return null
        if (typeof driverOrCountry === "object") {
            if (driverOrCountry.countries?.code) return String(driverOrCountry.countries.code).toLowerCase()
            if (driverOrCountry.country_code) return String(driverOrCountry.country_code).toLowerCase()
            if (driverOrCountry.country && String(driverOrCountry.country).length === 2 && isNaN(Number(driverOrCountry.country))) {
                return String(driverOrCountry.country).toLowerCase()
            }
            if (driverOrCountry.nation) return getDriverCountryCode(driverOrCountry.nation)
            const name = driverOrCountry.country_name || (typeof driverOrCountry.country === 'string' && isNaN(Number(driverOrCountry.country)) ? driverOrCountry.country : null)
            if (name) {
                const clean = String(name).toLowerCase().trim()
                if (COUNTRY_MAP[clean]) return COUNTRY_MAP[clean].code
            }
            return null
        }
        const str = String(driverOrCountry).trim()
        if (str.length === 2 && isNaN(Number(str))) return str.toLowerCase()
        const clean = str.toLowerCase()
        if (COUNTRY_MAP[clean]) return COUNTRY_MAP[clean].code
        return null
    }

    const { $supabase } = useNuxtApp()

    // Fetch schedules, classes, seasons, and season driver classes with results
    const { data: resultsData, pending: loading } = await useAsyncData("race-results-list", async () => {
        try {
            const fetchSchedule = async () => {
                const res = await $supabase
                    .from("schedule")
                    .select(`
                        id,
                        round,
                        date,
                        finish_date,
                        circuit,
                        country,
                        country_2,
                        season,
                        is_postponed,
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
                        ),
                        event_entries (
                            id,
                            entry_type,
                            driver_id,
                            team_id,
                            car_number,
                            car_model,
                            class_id,
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
                                is_provisional
                            )
                        )
                    `)
                    .order("date", { ascending: false })
                return res.data || []
            }

            const fetchClasses = async () => {
                try {
                    const res = await $supabase.from("classes").select("id, name, event_id")
                    return res.data || []
                } catch {
                    return []
                }
            }

            const fetchSeasons = async () => {
                try {
                    const res = await $supabase.from("seasons").select("id, event_id, season_number")
                    return res.data || []
                } catch {
                    return []
                }
            }

            const fetchSdc = async () => {
                try {
                    const res = await $supabase.from("season_driver_classes").select("driver_id, class_id, season_id")
                    if (res?.data && !res.error) return res.data
                    const retry = await $supabase.from("season_driver_classes").select("driver_id, class_id")
                    return retry?.data || []
                } catch {
                    return []
                }
            }

            const [schedules, classes, seasons, seasonDriverClasses] = await Promise.all([
                fetchSchedule(),
                fetchClasses(),
                fetchSeasons(),
                fetchSdc()
            ])

            return {
                schedules: schedules || [],
                classes: classes || [],
                seasons: seasons || [],
                seasonDriverClasses: seasonDriverClasses || []
            }
        } catch (err) {
            console.error("Results list error:", err)
            return { schedules: [], classes: [], seasons: [], seasonDriverClasses: [] }
        }
    })

    // Classes lookup map by ID
    const classMap = computed(() => {
        const map = new Map()
        for (const c of resultsData.value?.classes || []) {
            if (c.id) {
                map.set(String(c.id), c.name)
            }
        }
        return map
    })

    // Classes grouped by event_id
    const eventClassesMap = computed(() => {
        const map = new Map()
        for (const c of resultsData.value?.classes || []) {
            if (c.event_id) {
                const evId = String(c.event_id)
                if (!map.has(evId)) map.set(evId, [])
                map.get(evId).push({ id: String(c.id), name: c.name })
            }
        }
        return map
    })

    // Seasons lookup map: `${event_id}::${season_number}` -> season_id
    const seasonMap = computed(() => {
        const map = new Map()
        for (const s of resultsData.value?.seasons || []) {
            if (s.event_id && s.season_number !== undefined && s.season_number !== null) {
                map.set(`${s.event_id}::${s.season_number}`, String(s.id))
            }
        }
        return map
    })

    // Season driver classes lookup map: `${driver_id}::${season_id}` -> class_id
    const sdcBySeasonMap = computed(() => {
        const map = new Map()
        for (const sdc of resultsData.value?.seasonDriverClasses || []) {
            if (sdc.driver_id && sdc.season_id && sdc.class_id) {
                map.set(`${sdc.driver_id}::${sdc.season_id}`, String(sdc.class_id))
            }
        }
        return map
    })

    // Helper to resolve an entry's class (strictly scoped to THIS event's classes)
    const resolveEntryClass = (entry, sched) => {
        if (!entry) return { classId: null, className: null }
        const evId = sched.events?.id || sched.event_id || null
        if (!evId) return { classId: null, className: null }

        const evClasses = eventClassesMap.value.get(String(evId)) || []
        // If this event has 0 or 1 class configured, it is a single-class event
        if (evClasses.length <= 1) {
            return { classId: null, className: null }
        }

        const seasonNum = sched.season

        // 1. Direct class_id on entry (must match one of THIS event's classes)
        if (entry.class_id) {
            const matched = evClasses.find(c => String(c.id) === String(entry.class_id))
            if (matched) return { classId: matched.id, className: matched.name }
        }

        // 2. Lookup in season_driver_classes for THIS event's specific season
        if (entry.driver_id && seasonNum !== undefined && seasonNum !== null) {
            const seasonUuid = seasonMap.value.get(`${evId}::${seasonNum}`)
            if (seasonUuid) {
                const sdcClassId = sdcBySeasonMap.value.get(`${entry.driver_id}::${seasonUuid}`)
                if (sdcClassId) {
                    const matched = evClasses.find(c => String(c.id) === String(sdcClassId))
                    if (matched) return { classId: matched.id, className: matched.name }
                }
            }
        }

        // 3. parseTeamInfo from entry.teams.name (strictly matching one of THIS event's classes)
        const teamNameRaw = entry.teams?.name
        if (teamNameRaw) {
            const teamParsed = parseTeamInfo(teamNameRaw)
            if (teamParsed.teamClass) {
                const tClass = teamParsed.teamClass.toLowerCase().trim()
                const matchedCls = evClasses.find(c => {
                    const cName = c.name.toLowerCase().trim()
                    return cName === tClass || cName.startsWith(tClass) || tClass.startsWith(cName)
                })
                if (matchedCls) {
                    return { classId: matchedCls.id, className: matchedCls.name }
                }
            }

            // 4. Regex match event class name in team name
            const tLower = teamNameRaw.toLowerCase()
            const matchedCls = evClasses.find(c => {
                const cName = c.name.toLowerCase().trim()
                const regex = new RegExp(`\\b${cName}\\b`, 'i')
                return regex.test(tLower)
            })
            if (matchedCls) {
                return { classId: matchedCls.id, className: matchedCls.name }
            }
        }

        // 5. Match car_model with this event's classes
        if (entry.car_model) {
            const cmLower = String(entry.car_model).toLowerCase().trim()
            const matchedCls = evClasses.find(c => {
                const cName = c.name.toLowerCase().trim()
                return String(c.id) === String(entry.car_model) ||
                    cName === cmLower ||
                    cmLower.includes(cName) ||
                    cName.includes(cmLower)
            })
            if (matchedCls) {
                return { classId: matchedCls.id, className: matchedCls.name }
            }
        }

        return { classId: null, className: null }
    }

    // Transform schedules into distinct race sessions (race, race 1, race 2 sessions only)
    const allRaces = computed(() => {
        const schedules = resultsData.value?.schedules || []
        if (schedules.length === 0) return []

        const items = []

        for (const sched of schedules) {
            const entries = sched.event_entries || []
            const allResults = entries.flatMap(e => (e.results || []).map(r => ({ result: r, entry: e })))
            if (allResults.length === 0) continue

            // Determine if this event is a team event
            const isTeamEvent = entries.some(e => e.entry_type === 'team' || (!e.driver_id && e.team_id))

            // Check which race session types exist (race, race 1, race 2 ONLY)
            const hasRace1 = allResults.some(({ result: r }) => {
                const st = String(r.session_type || '').toLowerCase().trim()
                return st === 'race_1' || st === 'race1' || st === 'r1'
            })
            const hasRace2 = allResults.some(({ result: r }) => {
                const st = String(r.session_type || '').toLowerCase().trim()
                return st === 'race_2' || st === 'race2' || st === 'r2'
            })
            const hasDefaultRace = allResults.some(({ result: r }) => {
                const st = String(r.session_type || '').toLowerCase().trim()
                return st === 'race' || !r.session_type
            })

            // Sessions to process for this schedule
            const sessionsToProcess = []
            if (hasRace2) {
                sessionsToProcess.push({
                    type: 'race_2',
                    queryParam: 'race_2',
                    labelKey: 'race2',
                    fallbackLabel: 'Race 2',
                    orderWeight: 2
                })
            }
            if (hasRace1) {
                sessionsToProcess.push({
                    type: 'race_1',
                    queryParam: 'race_1',
                    labelKey: hasRace2 ? 'race1' : 'race',
                    fallbackLabel: hasRace2 ? 'Race 1' : 'Race',
                    orderWeight: 1
                })
            }
            if (hasDefaultRace && !hasRace1 && !hasRace2) {
                sessionsToProcess.push({
                    type: 'race',
                    queryParam: 'race',
                    labelKey: 'race',
                    fallbackLabel: 'Race',
                    orderWeight: 1
                })
            }

            for (const sess of sessionsToProcess) {
                // Find all results matching this session type
                const sessionEntries = allResults.filter(({ result: r }) => {
                    const st = String(r.session_type || 'race').toLowerCase().trim()
                    if (sess.type === 'race_2') {
                        return st === 'race_2' || st === 'race2' || st === 'r2'
                    }
                    if (sess.type === 'race_1') {
                        return st === 'race_1' || st === 'race1' || st === 'r1'
                    }
                    if (sess.type === 'race') {
                        return st === 'race' || !r.session_type
                    }
                    return false
                })

                if (sessionEntries.length === 0) continue

                // Check if session has provisional results
                const isProvisional = sessionEntries.some(({ result: r }) => Boolean(r.is_provisional))

                // Group session entries by resolved class
                const entriesByClass = new Map()
                for (const item of sessionEntries) {
                    const entry = item.entry
                    const { classId, className } = resolveEntryClass(entry, sched)
                    const classKey = className || (classId ? `class_${classId}` : '__overall__')

                    if (!entriesByClass.has(classKey)) {
                        entriesByClass.set(classKey, {
                            classKey,
                            className: className || null,
                            classId: classId || null,
                            entries: []
                        })
                    }
                    entriesByClass.get(classKey).entries.push(item)
                }

                // Check if multiclass (event itself must have multiple classes AND at least 2 distinct classes raced)
                const evId = sched.events?.id || sched.event_id || null
                const evClasses = evId ? (eventClassesMap.value.get(String(evId)) || []) : []
                const namedClasses = [...entriesByClass.values()].filter(g => g.classKey !== '__overall__')
                const isMultiClass = evClasses.length > 1 && namedClasses.length > 1

                const winners = []

                if (isMultiClass) {
                    // Extract winner per class
                    for (const group of namedClasses) {
                        const classEntries = group.entries
                        let winnerEntry = classEntries.find(({ result: r }) => Number(r.scoring_position) === 1)
                        if (!winnerEntry) {
                            winnerEntry = classEntries.find(({ result: r }) => Number(r.classified_position) === 1)
                        }
                        if (!winnerEntry) {
                            const sortedByPos = [...classEntries]
                                .filter(({ result: r }) => r.classified_position !== null && r.classified_position !== undefined && Number(r.classified_position) > 0)
                                .sort((a, b) => Number(a.result.classified_position) - Number(b.result.classified_position))
                            if (sortedByPos.length > 0) {
                                winnerEntry = sortedByPos[0]
                            } else {
                                winnerEntry = classEntries[0]
                            }
                        }

                        if (winnerEntry) {
                            const entry = winnerEntry.entry
                            const isThisEntryTeam = isTeamEvent || entry.entry_type === 'team' || (!entry.driver_id && entry.team_id)

                            if (isThisEntryTeam) {
                                const parsed = parseTeamInfo(entry.teams?.name)
                                const teamClean = cleanTeamName(entry.teams?.name)
                                const teamName = (teamClean && teamClean !== '-') ? teamClean : (entry.teams?.name || '')
                                const carNum = entry.car_number || parsed.carNumber
                                const hasCarNum = carNum !== null && carNum !== undefined && String(carNum).trim() !== ''
                                let displayName = "-"
                                if (hasCarNum && teamName) {
                                    displayName = `${String(carNum).trim()} - ${teamName}`
                                } else if (teamName) {
                                    displayName = teamName
                                } else if (hasCarNum) {
                                    displayName = String(carNum).trim()
                                }
                                winners.push({
                                    isTeam: true,
                                    displayName,
                                    className: group.className,
                                    bestPos: Number(winnerEntry.result.classified_position) || 9999
                                })
                            } else if (entry.drivers) {
                                winners.push({
                                    isTeam: false,
                                    id: entry.drivers.id || null,
                                    name: entry.drivers.name || "-",
                                    countryCode: getDriverCountryCode(entry.drivers),
                                    className: group.className,
                                    bestPos: Number(winnerEntry.result.classified_position) || 9999
                                })
                            }
                        }
                    }

                    // Sort class winners by overall finish position
                    winners.sort((a, b) => a.bestPos - b.bestPos)
                } else {
                    // Single overall winner
                    let winnerEntry = sessionEntries.find(({ result: r }) => Number(r.classified_position) === 1)
                    if (!winnerEntry) {
                        winnerEntry = sessionEntries.find(({ result: r }) => Number(r.scoring_position) === 1)
                    }
                    if (!winnerEntry) {
                        const sortedByPos = [...sessionEntries]
                            .filter(({ result: r }) => r.classified_position !== null && r.classified_position !== undefined && Number(r.classified_position) > 0)
                            .sort((a, b) => Number(a.result.classified_position) - Number(b.result.classified_position))
                        if (sortedByPos.length > 0) {
                            winnerEntry = sortedByPos[0]
                        } else {
                            winnerEntry = sessionEntries[0]
                        }
                    }

                    if (winnerEntry) {
                        const entry = winnerEntry.entry
                        const isThisEntryTeam = isTeamEvent || entry.entry_type === 'team' || (!entry.driver_id && entry.team_id)

                        if (isThisEntryTeam) {
                            const parsed = parseTeamInfo(entry.teams?.name)
                            const teamClean = cleanTeamName(entry.teams?.name)
                            const teamName = (teamClean && teamClean !== '-') ? teamClean : (entry.teams?.name || '')
                            const carNum = entry.car_number || parsed.carNumber
                            const hasCarNum = carNum !== null && carNum !== undefined && String(carNum).trim() !== ''
                            let displayName = "-"
                            if (hasCarNum && teamName) {
                                displayName = `${String(carNum).trim()} - ${teamName}`
                            } else if (teamName) {
                                displayName = teamName
                            } else if (hasCarNum) {
                                displayName = String(carNum).trim()
                            }
                            winners.push({
                                isTeam: true,
                                displayName,
                                className: null,
                                bestPos: Number(winnerEntry.result.classified_position) || 1
                            })
                        } else if (entry.drivers) {
                            winners.push({
                                isTeam: false,
                                id: entry.drivers.id || null,
                                name: entry.drivers.name || "-",
                                countryCode: getDriverCountryCode(entry.drivers),
                                className: null,
                                bestPos: Number(winnerEntry.result.classified_position) || 1
                            })
                        }
                    }
                }

                items.push({
                    key: `${sched.id}_${sess.type}`,
                    scheduleId: sched.id,
                    sessionType: sess.type,
                    sessionQuery: sess.queryParam,
                    sessionLabelKey: sess.labelKey,
                    fallbackLabel: sess.fallbackLabel,
                    orderWeight: sess.orderWeight,
                    date: sched.date,
                    circuit: sched.circuit,
                    country: sched.country,
                    country_2: sched.country_2,
                    round: sched.round,
                    season: sched.season,
                    eventName: sched.events?.name || "-",
                    organizerAbbr: sched.events?.organizers?.abbreviation || "",
                    organizerName: sched.events?.organizers?.name || "",
                    gameAbbr: sched.events?.games?.abbreviation || "",
                    isProvisional,
                    isMultiClass,
                    winners,
                    resultUrl: `/results/${sched.id}?session=${sess.queryParam}`
                })
            }
        }

        // Sort by date descending; if same date, race_2 comes before race_1
        items.sort((a, b) => {
            const timeA = new Date(a.date).getTime() || 0
            const timeB = new Date(b.date).getTime() || 0
            if (timeA !== timeB) {
                return timeB - timeA
            }
            return b.orderWeight - a.orderWeight
        })

        return items
    })

    // Organizers list for filter dropdown
    const organizersList = computed(() => {
        const orgs = allRaces.value.map(r => r.organizerName).filter(Boolean)
        const unique = [...new Set(orgs)].sort()
        return [t("all"), ...unique]
    })

    const selectedOrganizer = ref(t("all"))

    // Status filter options: All, Final, Provisional
    const statusOptions = computed(() => [
        { value: "all", label: t("all") },
        { value: "final", label: t("final") },
        { value: "provisional", label: t("provisional") }
    ])
    const selectedStatus = ref("all")
    const selectedStatusOption = computed({
        get() {
            return statusOptions.value.find(o => o.value === selectedStatus.value) || statusOptions.value[0]
        },
        set(val) {
            if (!val) {
                selectedStatus.value = "all"
            } else if (typeof val === "object" && "value" in val) {
                selectedStatus.value = val.value || "all"
            } else {
                selectedStatus.value = String(val)
            }
        }
    })

    // Sort options: Most Recent, Oldest
    const sortOptions = computed(() => [
        { value: "recent", label: t("mostRecent") },
        { value: "oldest", label: t("oldest") }
    ])
    const sortBy = ref("recent")
    const selectedSortBy = computed({
        get() {
            return sortOptions.value.find(o => o.value === sortBy.value) || sortOptions.value[0]
        },
        set(val) {
            if (!val) {
                sortBy.value = "recent"
            } else if (typeof val === "object" && "value" in val) {
                sortBy.value = val.value || "recent"
            } else {
                sortBy.value = String(val)
            }
        }
    })

    const searchQuery = ref("")

    const isAllOrganizerSelected = computed(() => {
        return !selectedOrganizer.value ||
            selectedOrganizer.value === t("all") ||
            selectedOrganizer.value === "all" ||
            selectedOrganizer.value === "All" ||
            selectedOrganizer.value === "Semua"
    })

    // Pagination
    const currentPage = ref(1)
    const itemsPerPage = 50

    watch([searchQuery, selectedOrganizer, selectedStatus, sortBy], () => {
        currentPage.value = 1
    })

    // Filtered races computed
    const filteredRaces = computed(() => {
        const q = (searchQuery.value || "").toLowerCase().trim()

        const list = allRaces.value.filter(race => {
            // Organizer filter
            if (!isAllOrganizerSelected.value && race.organizerName !== selectedOrganizer.value) {
                return false
            }
            // Status filter
            if (selectedStatus.value === "final" && race.isProvisional) {
                return false
            }
            if (selectedStatus.value === "provisional" && !race.isProvisional) {
                return false
            }
            // Search query (Event, Circuit, Winners, Organizer)
            if (q) {
                const matchEvent = (race.eventName || "").toLowerCase().includes(q)
                const matchCircuit = (race.circuit || "").toLowerCase().includes(q)
                const matchWinner = (race.winners || []).some(w => {
                    const str = w.isTeam ? (w.displayName || "") : (w.name || "")
                    const cls = w.className || ""
                    return str.toLowerCase().includes(q) || cls.toLowerCase().includes(q)
                })
                const matchOrg = (race.organizerAbbr || "").toLowerCase().includes(q) || (race.organizerName || "").toLowerCase().includes(q)
                if (!matchEvent && !matchCircuit && !matchWinner && !matchOrg) {
                    return false
                }
            }
            return true
        })

        // Apply sort
        return list.sort((a, b) => {
            const timeA = new Date(a.date).getTime() || 0
            const timeB = new Date(b.date).getTime() || 0
            if (sortBy.value === "recent") {
                if (timeA !== timeB) return timeB - timeA
                return b.orderWeight - a.orderWeight
            } else {
                if (timeA !== timeB) return timeA - timeB
                return a.orderWeight - b.orderWeight
            }
        })
    })

    const paginatedRaces = computed(() => {
        const start = (currentPage.value - 1) * itemsPerPage
        return filteredRaces.value.slice(start, start + itemsPerPage)
    })

    const totalPages = computed(() => Math.ceil(filteredRaces.value.length / itemsPerPage) || 1)

    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages.value) {
            currentPage.value = page
        }
    }

    // Clear specific filter
    const clearFilterField = (type) => {
        if (type === "organizer") {
            selectedOrganizer.value = t("all")
        } else if (type === "status") {
            selectedStatus.value = "all"
        }
        currentPage.value = 1
    }

    // Reset all filters
    const resetFilter = () => {
        searchQuery.value = ""
        selectedOrganizer.value = t("all")
        selectedStatus.value = "all"
        sortBy.value = "recent"
        currentPage.value = 1
    }

    // Check if any filter is active
    const isFilterActive = computed(() => {
        return (
            (searchQuery.value && searchQuery.value.trim() !== "") ||
            !isAllOrganizerSelected.value ||
            selectedStatus.value !== "all" ||
            sortBy.value !== "recent"
        )
    })

    // Scroll to top
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

    // Date formatting
    const formatDate = (dateStr) => {
        if (!dateStr) return "-"
        const date = new Date(dateStr)
        if (isNaN(date.getTime())) return "-"
        return date.toLocaleDateString(locale.value === "en" ? "en-US" : "id-ID", {
            year: "numeric",
            month: "short",
            day: "numeric"
        })
    }

    // Badges styling
    const getAdminOrganizerStyle = (organizer) => {
        let style = 'px-1.5 py-0.5 font-bold rounded text-xs shrink-0 '
        if (organizer === 'ACI') {
            style += 'bg-red-500 text-white'
        } else if (organizer === '97SRC') {
            style += 'bg-white text-black border border-gray-300'
        } else if (organizer === 'CRC') {
            style += 'bg-yellow-500 text-black'
        } else if (organizer === 'BRM') {
            style += 'bg-sky-500 text-black'
        } else if (organizer === 'JRC') {
            style += 'bg-indigo-500 text-black'
        } else if (organizer === 'ERGP') {
            style += 'bg-white text-red-600 border border-gray-300'
        } else if (organizer === 'SRC') {
            style += 'bg-blue-500 text-white'
        } else if (organizer === 'ISL') {
            style += 'bg-pink-800 text-white'
        } else {
            style += 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200'
        }
        return style
    }

    const getAdminGameStyle = (game) => {
        let style = 'px-1.5 py-0.5 font-bold rounded text-xs shrink-0 '
        if (game === 'AC') {
            style += 'bg-red-500 text-white'
        } else if (game === 'ACC') {
            style += 'bg-white text-red-600 border border-gray-300'
        } else if (game === 'RBR') {
            style += 'bg-black text-white'
        } else if (game === 'LMU') {
            style += 'bg-amber-500 text-black'
        } else {
            style += 'bg-gray-200 text-gray-800 dark:bg-slate-700 dark:text-gray-200'
        }
        return style
    }
</script>

<template>
    <div class="bg-white dark:bg-slate-900 px-8 lg:px-32 py-8 flex flex-col gap-6">
        <!-- Title -->
        <div class="text-black dark:text-white text-center text-lg lg:text-2xl font-bold leading-6">
            {{ $t('resultsTitle') }}
        </div>

        <!-- Filter Section (Identical styling and centering to database.vue) -->
        <div class="mx-auto flex flex-col justify-center items-center gap-4">
            <!-- Row 1: Organizer & Search -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('organizer') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedOrganizer"
                            :items="organizersList"
                        />
                        <button
                            @click="clearFilterField('organizer')"
                            :disabled="isAllOrganizerSelected"
                            class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>

                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('name') }} / Event / {{ $t('winner') }}</label>
                    <div class="flex items-center gap-2">
                        <input
                            v-model="searchQuery"
                            type="text"
                            :placeholder="$t('searchRace')"
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                        />
                        <button
                            class="invisible text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Row 2: Status & Sort By -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('status') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedStatusOption"
                            :items="statusOptions"
                            value-attribute="value"
                            option-attribute="label"
                        />
                        <button
                            @click="clearFilterField('status')"
                            :disabled="selectedStatus === 'all'"
                            class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>

                <div class="flex flex-col gap-1 items-start text-sm lg:text-base">
                    <label class="text-black dark:text-white font-bold">{{ $t('sortBy') }}</label>
                    <div class="flex items-center gap-2">
                        <USelectMenu
                            class="text-sm lg:text-base w-75 border-2 border-red-900 dark:border-red-900 rounded-md p-2 bg-red-50 dark:bg-slate-950 text-black dark:text-white"
                            v-model="selectedSortBy"
                            :items="sortOptions"
                            value-attribute="value"
                            option-attribute="label"
                        />
                        <button
                            class="invisible text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold p-2 rounded-lg cursor-pointer disabled:opacity-50"
                        >
                            <Icon name="mdi:filter-off" mode="svg" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Reset Filter Button -->
            <div
                v-if="isFilterActive"
                @click="resetFilter"
                class="text-white bg-red-900 dark:bg-red-900 text-sm lg:text-base font-bold px-4 py-2 rounded-lg cursor-pointer transition hover:bg-red-800"
            >
                {{ $t('resetFilter') }}
            </div>
        </div>

        <!-- Table Container (Identical styling to database.vue) -->
        <div v-if="filteredRaces.length" class="mx-auto w-full flex flex-col gap-6 lg:gap-8">
            <!-- Total Count -->
            <!-- <div class="flex flex-col sm:flex-row sm:items-center justify-center gap-3 text-black dark:text-white">
                <div class="text-base lg:text-lg">
                    {{ $t('totalResults', { total: filteredRaces.length }) }}
                </div>
            </div> -->

            <!-- Table: Date - Event - Season - Round - Circuit - Session - Winner - Status -->
            <div class="overflow-x-auto w-full">
                <table class="w-full">
                    <thead class="bg-red-900 dark:bg-red-900 text-white">
                        <tr>
                            <th class="w-[9%] px-2 lg:px-4 py-2 text-sm lg:text-base text-left whitespace-nowrap">{{ $t('date') }}</th>
                            <th class="w-[31%] px-2 lg:px-4 py-2 text-sm lg:text-base text-left">{{ $t('events') }}</th>
                            <th class="w-[5%] px-2 lg:px-4 py-2 text-sm lg:text-base text-center whitespace-nowrap">{{ $t('season') }}</th>
                            <th class="w-[5%] px-2 lg:px-4 py-2 text-sm lg:text-base text-center whitespace-nowrap">{{ $t('round') }}</th>
                            <th class="w-[23%] px-2 lg:px-4 py-2 text-sm lg:text-base text-left">{{ $t('circuit') }}</th>
                            <th class="w-[7%] px-2 lg:px-4 py-2 text-sm lg:text-base text-center whitespace-nowrap">{{ $t('session') }}</th>
                            <th class="w-[15%] px-2 lg:px-4 py-2 text-sm lg:text-base text-left">{{ $t('winner') }}</th>
                            <th class="w-[5%] px-2 lg:px-4 py-2 text-sm lg:text-base text-center whitespace-nowrap">{{ $t('status') }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="race in paginatedRaces"
                            :key="race.key"
                            @click="navigateTo(race.resultUrl)"
                            class="text-center border-b border-slate-300 dark:border-slate-700 bg-red-50 dark:bg-slate-950 hover:bg-red-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                            <!-- 1. Date (Regular font weight) -->
                            <td class="w-[9%] px-2 lg:px-4 py-2 text-left text-sm lg:text-base font-normal whitespace-nowrap text-black dark:text-white">
                                {{ formatDate(race.date) }}
                            </td>

                            <!-- 2. Event (font-bold) -->
                            <td class="w-[31%] px-2 lg:px-4 py-2 text-left text-sm lg:text-base font-bold text-black dark:text-white">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span v-if="race.organizerAbbr" :class="getAdminOrganizerStyle(race.organizerAbbr)">
                                        {{ race.organizerAbbr }}
                                    </span>
                                    <span v-if="race.gameAbbr" :class="getAdminGameStyle(race.gameAbbr)">
                                        {{ race.gameAbbr }}
                                    </span>
                                    <span class="hover:text-red-700 dark:hover:text-red-400 hover:underline">
                                        {{ race.eventName }}
                                    </span>
                                </div>
                            </td>

                            <!-- 3. Season (Regular font weight) -->
                            <td class="w-[5%] px-2 lg:px-4 py-2 text-center text-sm lg:text-base font-normal whitespace-nowrap text-black dark:text-white">
                                {{ race.season || '-' }}
                            </td>

                            <!-- 4. Round (Regular font weight) -->
                            <td class="w-[5%] px-2 lg:px-4 py-2 text-center text-sm lg:text-base font-normal whitespace-nowrap text-black dark:text-white">
                                {{ race.round || '-' }}
                            </td>

                            <!-- 5. Circuit (Regular font weight) -->
                            <td class="w-[23%] px-2 lg:px-4 py-2 text-left text-sm lg:text-base font-normal text-black dark:text-white">
                                <div class="flex items-center gap-1.5">
                                    <Icon
                                        v-if="race.country"
                                        :name="`flag-${race.country.toLowerCase()}-4x3`"
                                        mode="svg"
                                        class="rounded-sm shrink-0"
                                    />
                                    <Icon
                                        v-if="race.country_2"
                                        :name="`flag-${race.country_2.toLowerCase()}-4x3`"
                                        mode="svg"
                                        class="rounded-sm shrink-0"
                                    />
                                    <span>{{ race.circuit || '-' }}</span>
                                </div>
                            </td>

                            <!-- 6. Session (Regular font weight) -->
                            <td class="w-[7%] px-2 lg:px-4 py-2 text-center text-sm lg:text-base font-normal whitespace-nowrap text-black dark:text-white">
                                {{ $te(race.sessionLabelKey) ? $t(race.sessionLabelKey) : race.fallbackLabel }}
                            </td>

                            <!-- 7. Winner (font-bold, multiple classes separated by enter) -->
                            <td class="w-[15%] px-2 lg:px-4 py-2 text-left text-sm lg:text-base font-bold text-black dark:text-white">
                                <div v-if="race.winners && race.winners.length > 0" class="flex flex-col gap-1">
                                    <div
                                        v-for="(w, wIdx) in race.winners"
                                        :key="wIdx"
                                        class="flex items-center gap-1.5 min-w-0 truncate"
                                        :title="w.isTeam ? (w.className ? `${w.className}: ${w.displayName}` : w.displayName) : (w.className ? `${w.className}: ${w.name}` : w.name)"
                                    >
                                        <!-- Class Name in regular font weight: "Class: " -->
                                        <span
                                            v-if="race.isMultiClass && w.className"
                                            class="font-normal shrink-0"
                                        >
                                            {{ w.className }}:
                                        </span>

                                        <!-- Team Winner: "3 - Red Bull Racing" -->
                                        <div v-if="w.isTeam" class="truncate">
                                            {{ w.displayName }}
                                        </div>

                                        <!-- Individual Winner: Flag + Name -->
                                        <div v-else class="flex items-center gap-1.5 truncate">
                                            <Icon
                                                v-if="w.countryCode"
                                                :name="`flag-${w.countryCode.toLowerCase()}-4x3`"
                                                mode="svg"
                                                class="rounded-sm shrink-0"
                                            />
                                            <NuxtLink
                                                v-if="w.id || w.name"
                                                :to="`/drivers/${w.id || encodeURIComponent(w.name)}`"
                                                @click.stop
                                                class="hover:text-red-700 dark:hover:text-red-400 hover:underline cursor-pointer truncate"
                                            >
                                                {{ w.name }}
                                            </NuxtLink>
                                            <span v-else>{{ w.name }}</span>
                                        </div>
                                    </div>
                                </div>
                                <span v-else class="text-gray-400 font-normal">-</span>
                            </td>

                            <!-- 8. Status (Plain text, regular font weight) -->
                            <td class="w-[5%] px-2 lg:px-4 py-2 text-center text-sm lg:text-base font-normal whitespace-nowrap text-black dark:text-white">
                                {{ race.isProvisional ? $t('provisional') : $t('final') }}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- No Data Found Message -->
        <div v-else class="text-center text-black dark:text-white text-base lg:text-lg leading-6 py-12">
            <div v-if="loading">{{ $t('loading') }}</div>
            <div v-else>{{ $t('noResultsFound') }}</div>
        </div>

        <!-- Pagination (Identical to database.vue) -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-2 mt-4 text-black dark:text-white">
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
            <span class="px-3 py-1 font-bold text-sm lg:text-base">{{ currentPage }} / {{ totalPages }}</span>
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

        <!-- Floating Scroll To Top Button -->
        <button
            v-if="showTopButton"
            @click="scrollToTop"
            class="fixed bottom-12 right-8 bg-red-900 dark:bg-red-900 text-white p-2 lg:p-4 font-bold rounded-full cursor-pointer shadow-lg hover:bg-red-800 transition"
            aria-label="Scroll to top"
        >
            <Icon name="mi:arrow-up" size="2.5em" mode="svg" />
        </button>
    </div>
</template>
