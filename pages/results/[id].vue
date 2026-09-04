<script setup>
    import { calculateResultPoints } from "~/composables/useStandings"
    import { cleanTeamName, parseTeamInfo, formatLapTime } from "~/composables/useRaceResult"

    const route = useRoute()
    const router = useRouter()
    const { t, locale } = useI18n()
    const { $supabase } = useNuxtApp()

    const scheduleId = computed(() => route.params.id)

    // 1. Fetch schedule and event details from Supabase
    const { data: scheduleItem, pending: loadingSchedule } = await useAsyncData(`schedule-item-${scheduleId.value}`, async () => {
        if (!scheduleId.value) return null
        try {
            const { data, error } = await $supabase
                .from("schedule")
                .select(`
                    id,
                    round,
                    date,
                    finish_date,
                    circuit,
                    stream_link,
                    country,
                    country_2,
                    season,
                    event_id,
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
                    )
                `)
                .eq("id", scheduleId.value)
                .single()

            if (error) {
                console.warn("Supabase fetch error:", error)
                return null
            }
            return data
        } catch (e) {
            console.error("Fetch error:", e)
            return null
        }
    })

    // 2. Fetch event_entries and results from Supabase database
    const { data: dbEntries, pending: loadingEntries } = await useAsyncData(`schedule-entries-${scheduleId.value}`, async () => {
        if (!scheduleId.value) return []
        try {
            const { data, error } = await $supabase
                .from("event_entries")
                .select(`
                    id,
                    schedule_id,
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
                        ),
                        rating
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
                .eq("schedule_id", scheduleId.value)

            if (error && (error.message?.includes("no_points") || error.code === "PGRST204" || error.code === "42703")) {
                const res = await $supabase
                    .from("event_entries")
                    .select(`
                        id,
                        schedule_id,
                        driver_id,
                        team_id,
                        car_number,
                        class_id,
                        entry_type,
                        car_model,
                        drivers (
                            id,
                            name,
                            country,
                            countries (
                                code,
                                name
                            ),
                            rating
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
                            grid_position,
                            num_laps,
                            best_lap_ms,
                            total_time_ms,
                            has_penalty,
                            penalty_time_ns,
                            fastest_lap,
                            is_provisional
                        )
                    `)
                    .eq("schedule_id", scheduleId.value)
                data = res.data
                error = res.error
            }

            if (error) {
                console.warn("Supabase entries fetch error:", error)
                return []
            }

            return data || []
        } catch (e) {
            console.error("Fetch entries error:", e)
            return []
        }
    })

    // 2b. Fetch championship_events and points system for this schedule
    const { data: champEvents } = await useAsyncData(`schedule-champ-events-${scheduleId.value}`, async () => {
        if (!scheduleId.value) return []
        try {
            const { data, error } = await $supabase
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
                .eq("schedule_id", scheduleId.value)

            if (error) {
                console.warn("Supabase champ events fetch error:", error)
                return []
            }
            return data || []
        } catch (e) {
            console.error("Fetch champ events error:", e)
            return []
        }
    })

    // 2c. Fetch classes for this event
    const { data: eventClasses } = await useAsyncData(`event-classes-${scheduleId.value}`, async () => {
        const evId = scheduleItem.value?.event_id || scheduleItem.value?.events?.id
        if (!evId) return []
        try {
            const { data, error } = await $supabase
                .from("classes")
                .select("id, name")
                .eq("event_id", evId)
            if (error) return []
            return data || []
        } catch {
            return []
        }
    })

    // 2d. Fetch season driver classes for this schedule's season
    const { data: seasonDriverClassesList } = await useAsyncData(`schedule-classes-${scheduleId.value}`, async () => {
        try {
            const evId = scheduleItem.value?.event_id || scheduleItem.value?.events?.id
            const seasonNum = scheduleItem.value?.season

            let seasonUuid = null
            if (evId && seasonNum !== undefined && seasonNum !== null) {
                const { data: sData } = await $supabase
                    .from("seasons")
                    .select("id")
                    .eq("event_id", evId)
                    .eq("season_number", seasonNum)
                    .maybeSingle()
                if (sData?.id) seasonUuid = sData.id
            }

            const driverIds = (dbEntries.value || []).map(e => e.driver_id).filter(Boolean)

            let query = $supabase
                .from("season_driver_classes")
                .select(`
                    driver_id,
                    class_id,
                    classes (
                        id,
                        name
                    )
                `)

            if (seasonUuid) {
                query = query.eq("season_id", seasonUuid)
            } else if (driverIds.length > 0) {
                query = query.in("driver_id", driverIds)
            } else {
                return []
            }

            const { data, error } = await query
            if (error) {
                console.warn("Supabase season_driver_classes fetch error:", error)
                return []
            }
            return data || []
        } catch (e) {
            console.error("Fetch classes error:", e)
            return []
        }
    })

    const driverClassMap = computed(() => {
        const map = new Map()
        for (const sdc of seasonDriverClassesList.value || []) {
            if (sdc.driver_id && sdc.class_id) {
                const resolvedName = sdc.classes?.name || eventClasses.value?.find(c => c.id === sdc.class_id)?.name || null
                map.set(String(sdc.driver_id), {
                    classId: sdc.class_id,
                    className: resolvedName
                })
            }
        }
        return map
    })

    const currentChampEvent = computed(() => {
        if (!champEvents.value || champEvents.value.length === 0) return null
        const currentTab = activeSessionTab.value
        let targetType = 'race'
        if (currentTab === 'qualifying' || currentTab === 'q') {
            targetType = 'qualifying'
        } else if (currentTab === 'race_2' || currentTab === 'r2') {
            targetType = 'race_2'
        } else if (currentTab === 'race_1' || currentTab === 'r1') {
            targetType = champEvents.value.some(e => e.session_type === 'race_1') ? 'race_1' : 'race'
        }
        return champEvents.value.find(e => e.session_type === targetType) || champEvents.value[0] || null
    })

    const currentPointsSystem = computed(() => {
        return currentChampEvent.value?.points_system || null
    })

    // 3. Raw result fallback for legacy JSONs
    const rawResultDataQ = ref(null)
    const rawResultData1 = ref(null)
    const rawResultData2 = ref(null)
    const activeSessionTab = ref('r1')
    const loadingResult = ref(true)

    onMounted(async () => {
        if (!dbEntries.value || dbEntries.value.length === 0) {
            try {
                const staticData = await $fetch(`/results/${scheduleId.value}.json`)
                rawResultData1.value = staticData
            } catch (err) {
                rawResultData1.value = null
            }
        }

        loadingResult.value = false
    })

    // Check whether results exist in relational DB
    const hasDbResults = computed(() => {
        return Boolean(dbEntries.value && dbEntries.value.some(e => e.results && e.results.length > 0))
    })

    // Provisional status of current session
    const isSessionProvisional = computed(() => {
        if (!hasDbResults.value) return false
        const targetSessionType = activeSessionTab.value === 'q' ? 'qualifying' : (activeSessionTab.value === 'r2' ? 'race_2' : (activeSessionTab.value === 'r1' && availableSessions.value.some(s => s.id === 'r2') ? 'race_1' : 'race'))
        for (const entry of dbEntries.value || []) {
            const res = (entry.results || []).find(r => r.session_type === targetSessionType || (!r.session_type && (targetSessionType === 'race' || targetSessionType === 'race_1')))
            if (res && res.is_provisional) {
                return true
            }
        }
        return false
    })

    // 4. Available session tabs
    const availableSessions = computed(() => {
        const list = []
        if (hasDbResults.value) {
            const allResults = dbEntries.value.flatMap(e => e.results || [])
            const sessionTypes = new Set(allResults.map(r => r.session_type || 'race'))

            if (sessionTypes.has('qualifying')) {
                list.push({ id: 'qualifying', label: t('qualifying') })
            }
            if (sessionTypes.has('race_1')) {
                list.push({ id: 'race_1', label: sessionTypes.has('race_2') ? t('race1') : t('race') })
            }
            if (sessionTypes.has('race_2')) {
                list.push({ id: 'race_2', label: t('race2') })
            }
            if (sessionTypes.has('race') && !sessionTypes.has('race_1')) {
                list.push({ id: 'race', label: t('race') })
            }
        } else {
            if (rawResultDataQ.value) {
                list.push({ id: 'q', label: t('qualifying') })
            }
            if (rawResultData1.value) {
                list.push({
                    id: 'r1',
                    label: rawResultData2.value ? t('race1') : (rawResultDataQ.value ? t('race') : t('race1'))
                })
            }
            if (rawResultData2.value) {
                list.push({ id: 'r2', label: t('race2') })
            }
        }
        return list
    })

    const hasMultipleSessions = computed(() => {
        return availableSessions.value.length > 1
    })

    // Auto-select first session if current active tab is not available
    watch(availableSessions, (sessions) => {
        if (sessions.length > 0 && !sessions.some(s => s.id === activeSessionTab.value)) {
            activeSessionTab.value = sessions[0].id
        }
    }, { immediate: true })

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

    // 5. Parse DB results for active session
    const rowsFromDb = computed(() => {
        if (!hasDbResults.value) return []

        const currentTab = activeSessionTab.value
        const validEntries = []
        dbEntries.value.forEach(entry => {
            if (!entry.results || !Array.isArray(entry.results)) return
            const res = entry.results.find(r => {
                const sType = r.session_type || 'race'
                if (currentTab === 'race' || currentTab === 'r1' || currentTab === 'race_1') {
                    return sType === 'race' || sType === 'race_1'
                }
                if (currentTab === 'race_2' || currentTab === 'r2') {
                    return sType === 'race_2'
                }
                if (currentTab === 'qualifying' || currentTab === 'q') {
                    return sType === 'qualifying'
                }
                return sType === currentTab
            })
            if (res) {
                validEntries.push({
                    entry,
                    result: res
                })
            }
        })

        if (validEntries.length === 0) return []

        validEntries.sort((a, b) => (a.result.classified_position || 999) - (b.result.classified_position || 999))

        const validLaps = validEntries.map(v => Number(v.result.best_lap_ms) || 0).filter(l => l > 0)
        const fastestLapInRace = validLaps.length > 0 ? Math.min(...validLaps) : 0
        const isQualifying = currentTab === 'qualifying' || currentTab === 'q'

        const currentPointsSys = currentPointsSystem.value
        const multiplier = Number(currentChampEvent.value?.points_multiplier) || 1.0

        const resolveEntryClass = (entry) => {
            if (entry.class_id) {
                const matchedCls = eventClasses.value?.find(c => c.id === entry.class_id)
                return {
                    classId: entry.class_id,
                    raceClass: matchedCls?.name || null
                }
            }

            const dClassInfo = entry.driver_id ? driverClassMap.value.get(String(entry.driver_id)) : null
            let classId = dClassInfo?.classId || null
            let raceClass = dClassInfo?.className || null

            if (!classId && !raceClass) {
                const teamParsed = parseTeamInfo(entry.teams?.name)
                if (teamParsed.teamClass) {
                    raceClass = teamParsed.teamClass
                    const matchedCls = eventClasses.value?.find(c => {
                        const cName = c.name.toLowerCase().trim()
                        const tClass = teamParsed.teamClass.toLowerCase().trim()
                        return cName === tClass || cName.startsWith(tClass) || tClass.startsWith(cName)
                    })
                    if (matchedCls) {
                        classId = matchedCls.id
                        raceClass = matchedCls.name
                    }
                }

                if (!raceClass && entry.car_model) {
                    const matchedCls = eventClasses.value?.find(c =>
                        c.id === entry.car_model ||
                        c.name.toLowerCase().trim() === entry.car_model.toLowerCase().trim() ||
                        entry.car_model.toLowerCase().includes(c.name.toLowerCase().trim()) ||
                        c.name.toLowerCase().trim().includes(entry.car_model.toLowerCase().trim())
                    )
                    if (matchedCls) {
                        classId = matchedCls.id
                        raceClass = matchedCls.name
                    }
                }

                if (!raceClass && entry.teams?.name && eventClasses.value?.length) {
                    const tNameLower = entry.teams.name.toLowerCase()
                    const matchedCls = eventClasses.value.find(c => {
                        const cName = c.name.toLowerCase().trim()
                        const regex = new RegExp(`\\b${cName}\\b`, 'i')
                        return regex.test(tNameLower)
                    })
                    if (matchedCls) {
                        classId = matchedCls.id
                        raceClass = matchedCls.name
                    }
                }

                if (!raceClass && eventClasses.value?.length === 1) {
                    classId = eventClasses.value[0].id
                    raceClass = eventClasses.value[0].name
                }
            }

            return { classId, raceClass }
        }

        // Pre-calculate fastest lap per class
        const fastestLapByClass = new Map()
        validEntries.forEach(({ entry, result }) => {
            const lapMs = Number(result.best_lap_ms) || 0
            if (lapMs > 0) {
                const { classId, raceClass } = resolveEntryClass(entry)
                if (classId) {
                    const cur = fastestLapByClass.get(classId) || Infinity
                    if (lapMs < cur) fastestLapByClass.set(classId, lapMs)
                }
                if (raceClass) {
                    const cur = fastestLapByClass.get(raceClass) || Infinity
                    if (lapMs < cur) fastestLapByClass.set(raceClass, lapMs)
                }
                const clsKey = classId || raceClass || '__overall__'
                const currentFastest = fastestLapByClass.get(clsKey) || Infinity
                if (lapMs < currentFastest) {
                    fastestLapByClass.set(clsKey, lapMs)
                }
            }
        })

        // Pre-calculate in-class start positions for each entry
        const entriesByClass = new Map()
        validEntries.forEach((item, idx) => {
            const { classId, raceClass } = resolveEntryClass(item.entry)
            const classKey = classId || raceClass || '__overall__'
            if (!entriesByClass.has(classKey)) {
                entriesByClass.set(classKey, [])
            }
            entriesByClass.get(classKey).push({ item, idx })
        })

        const inClassGridMap = new Map() // item -> inClassGridPosition
        entriesByClass.forEach((classItems) => {
            const itemsWithStart = classItems.map(({ item, idx }) => {
                const qRes = item.entry.results?.find(r => r.session_type === 'qualifying')
                const qScoring = qRes ? Number(qRes.scoring_position) : null
                const qClassified = qRes ? Number(qRes.classified_position) : null
                const rawGrid = Number(item.result.grid_position) || null
                return {
                    item,
                    idx,
                    qScoring: qScoring && qScoring > 0 ? qScoring : null,
                    rawGrid: rawGrid && rawGrid > 0 ? rawGrid : null,
                    qClassified: qClassified && qClassified > 0 ? qClassified : null
                }
            })

            const startRanking = [...itemsWithStart].filter(x => x.qScoring || x.rawGrid || x.qClassified)
            startRanking.sort((a, b) => {
                const valA = a.qScoring || a.rawGrid || a.qClassified || 999
                const valB = b.qScoring || b.rawGrid || b.qClassified || 999
                return valA - valB
            })

            startRanking.forEach((entryInfo, rankIdx) => {
                let inClassGrid = entryInfo.qScoring
                if (!inClassGrid) {
                    if (entryInfo.rawGrid && entryInfo.rawGrid <= classItems.length && !startRanking.some(o => o !== entryInfo && o.rawGrid === entryInfo.rawGrid)) {
                        inClassGrid = entryInfo.rawGrid
                    } else {
                        inClassGrid = rankIdx + 1
                    }
                }
                inClassGridMap.set(entryInfo.item, inClassGrid)
            })

            // Drivers in this class who didn't participate in qualifying:
            // Assume they started below the last driver in qualifying
            const itemsWithoutStart = itemsWithStart.filter(x => !x.qScoring && !x.rawGrid && !x.qClassified)
            if (startRanking.length > 0 && itemsWithoutStart.length > 0) {
                let nextGrid = startRanking.length
                itemsWithoutStart.forEach(entryInfo => {
                    nextGrid += 1
                    inClassGridMap.set(entryInfo.item, nextGrid)
                })
            }
        })

        // Track qualifying entries count overall
        const qualifyingEntriesCount = validEntries.filter(item => {
            const qRes = item.entry.results?.find(r => r.session_type === 'qualifying')
            return Boolean((qRes && (Number(qRes.classified_position) > 0 || Number(qRes.scoring_position) > 0)) || Number(item.result.grid_position) > 0)
        }).length
        let nextOverallNonQualifyingGrid = qualifyingEntriesCount

        const classLeaderMap = new Map()
        const classPositionsMap = new Map()

        return validEntries.map((item, index) => {
            const { entry, result } = item
            const bestLapMs = Number(result.best_lap_ms) || 0
            const numLaps = Number(result.num_laps) || null
            const totalTime = Number(result.total_time_ms) || 0
            const status = (result.status || 'finished').toLowerCase()
            const penSec = result.penalty_time_ns ? (Number(result.penalty_time_ns) / 1000000000) : 0

            const { classId, raceClass } = resolveEntryClass(entry)
            const classKey = classId || raceClass || '__overall__'
            const classFastestMs = fastestLapByClass.get(classKey) || fastestLapInRace
            const isFastest = Boolean(result.fastest_lap) || (bestLapMs > 0 && (bestLapMs === classFastestMs || bestLapMs === fastestLapInRace))
            const isPole = Number(result.grid_position) === 1

            const classPos = (classPositionsMap.get(classKey) || 0) + 1
            classPositionsMap.set(classKey, classPos)

            const isClassWinner = classPos === 1 || Number(result.scoring_position) === 1
            if (!classLeaderMap.has(classKey) || isClassWinner) {
                classLeaderMap.set(classKey, {
                    laps: numLaps || 0,
                    totalTime,
                    bestLapMs
                })
            }
            const classLeader = classLeaderMap.get(classKey)

            let gap = ""
            if (status === "dnf") {
                gap = "DNF"
            } else if (status === "dns") {
                gap = "DNS"
            } else if (status === "dsq") {
                gap = "DSQ"
            } else if (isQualifying) {
                if (isClassWinner) {
                    if (bestLapMs > 0) {
                        gap = formatLapTime(bestLapMs)
                    } else if (totalTime > 0) {
                        gap = totalTime < 600000 ? formatLapTime(totalTime) : formatTotalTime(totalTime)
                    } else {
                        gap = "-"
                    }
                } else if (classLeader) {
                    if (bestLapMs > 0 && classLeader.bestLapMs > 0 && bestLapMs > classLeader.bestLapMs) {
                        const gapMs = bestLapMs - classLeader.bestLapMs
                        gap = formatGapTime(gapMs)
                    } else if (totalTime > 0 && totalTime < 60000) {
                        gap = formatGapTime(totalTime)
                    } else if (bestLapMs > 0) {
                        gap = formatLapTime(bestLapMs)
                    } else {
                        gap = "-"
                    }
                }
            } else if (isClassWinner) {
                if (totalTime > 0) {
                    gap = formatTotalTime(totalTime)
                } else if (bestLapMs > 0) {
                    gap = formatLapTime(bestLapMs)
                } else {
                    gap = "-"
                }
            } else if (classLeader) {
                if (classLeader.laps > 0 && numLaps !== null && classLeader.laps > numLaps) {
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
                } else {
                    gap = "-"
                }
            }

            const pts = currentPointsSys
                ? calculateResultPoints(currentPointsSys, {
                    driver_id: entry.driver_id,
                    team_id: entry.team_id,
                    car_number: entry.car_number,
                    scoring_position: result.scoring_position,
                    classified_position: result.classified_position,
                    status,
                    fastest_lap: isFastest,
                    grid_position: Number(result.grid_position) || null,
                    no_points: Boolean(result.no_points)
                }, {
                    isPole,
                    multiplier
                })
                : 0

            const isTeamEntry = entry.entry_type === 'team' || (!entry.driver_id && entry.team_id)
            const primaryDriver = entry.drivers || null
            const rawTeamName = entry.teams?.name || "-"
            const teamParsed = parseTeamInfo(rawTeamName)
            const teamName = cleanTeamName(rawTeamName)
            const driverName = isTeamEntry
                ? teamName
                : (primaryDriver?.name || "Unknown Driver")
            const driverNames = [driverName]
            const driverNationCode = isTeamEntry ? "" : (getDriverCountryCode(primaryDriver) || "")
            const allDriversList = (isTeamEntry || !primaryDriver) ? [] : [{
                ...primaryDriver,
                country: driverNationCode
            }]

            const qResult = entry.results?.find(r => r.session_type === 'qualifying')
            const qPos = qResult ? Number(qResult.classified_position) : null
            const qBestMs = qResult ? Number(qResult.best_lap_ms) : null
            const qualifyingLapTime = qBestMs && qBestMs > 0 ? formatLapTime(qBestMs) : null
            let overallGridPos = Number(result.grid_position) || qPos || 0
            if (overallGridPos <= 0 && qualifyingEntriesCount > 0) {
                nextOverallNonQualifyingGrid += 1
                overallGridPos = nextOverallNonQualifyingGrid
            }

            const inClassGridPos = inClassGridMap.get(item) || null
            const classFinishPos = result.scoring_position ?? classPos
            const finishPos = result.classified_position || index + 1
            const effectiveGridPos = inClassGridPos || overallGridPos
            const effectiveFinishPos = entriesByClass.size > 1 ? classFinishPos : finishPos
            const posDiff = (effectiveGridPos && effectiveGridPos > 0 && effectiveFinishPos > 0)
                ? (effectiveGridPos - effectiveFinishPos)
                : null

            return {
                position: finishPos,
                classPosition: classFinishPos,
                isTeamEntry,
                driverName,
                driverNames: driverNames.length > 0 ? driverNames : [driverName],
                driversList: allDriversList,
                driverCountry: driverNationCode || null,
                driverRating: isTeamEntry ? null : primaryDriver?.rating,
                carModel: entry.car_model || "-",
                carId: 0,
                team: teamName,
                teamClass: raceClass,
                carNumber: entry.car_number ? String(entry.car_number) : (teamParsed.carNumber || null),
                teamName,
                hasFormattedTeam: false,
                nation: driverNationCode,
                numLaps: numLaps !== null ? numLaps : "-",
                bestLapMs,
                bestLap: bestLapMs > 0 ? formatLapTime(bestLapMs) : "-",
                isFastestLap: isFastest,
                isPole: (effectiveGridPos === 1) || Number(result.grid_position) === 1,
                qualifyingLapTime,
                gap,
                classId,
                raceClass,
                status,
                points: pts,
                noPoints: Boolean(result.no_points),
                disqualified: status === "dsq",
                hasPenalty: Boolean(result.has_penalty),
                penaltyTime: penSec,
                gridPosition: effectiveGridPos || 0,
                posDiff
            }
        })
    })

    // Active raw ACSM JSON (fallback)
    const activeRawResultData = computed(() => {
        if (activeSessionTab.value === 'q' || activeSessionTab.value === 'qualifying') {
            return rawResultDataQ.value
        }
        if (activeSessionTab.value === 'r2' || activeSessionTab.value === 'race_2') {
            return rawResultData2.value
        }
        return rawResultData1.value
    })

    // 6. Unified parsed result rows
    const parsedRows = computed(() => {
        let rows = []
        if (rowsFromDb.value.length > 0) {
            rows = rowsFromDb.value
        } else if (activeRawResultData.value) {
            rows = parseAcsmResult(activeRawResultData.value)
        }
        if (!rows || rows.length === 0) return []

        const isTeam = (dbEntries.value && dbEntries.value.some(e => e.entry_type === 'team' || (!e.driver_id && e.team_id))) ||
            rows.some(r => r.isTeamEntry || (r.driverNames && r.driverNames.length > 1) || r.hasFormattedTeam)

        if (isTeam) {
            return rows.map(r => ({
                ...r,
                isTeamEntry: true,
                teamName: cleanTeamName(r.teamName || r.team || "-")
            }))
        }
        return rows
    })

    const isQualifyingSession = computed(() => {
        return activeSessionTab.value === 'q' || activeSessionTab.value === 'qualifying'
    })

    const hasPointsColumn = computed(() => {
        if (isQualifyingSession.value) return false
        if (isTeamSession.value) return true
        return Boolean(currentPointsSystem.value || parsedRows.value.some(r => r.points !== null && r.points !== undefined && r.points > 0))
    })

    const formatPoints = (pts) => {
        if (pts === null || pts === undefined) return "0"
        const num = Number(pts)
        if (isNaN(num)) return "0"
        return Number.isInteger(num) ? String(num) : num.toFixed(1)
    }

    // 7. Multi-class handling
    const selectedClass = ref("")
    const availableClasses = computed(() => {
        const classes = new Set()
        if (!parsedRows.value || !Array.isArray(parsedRows.value)) return []
        parsedRows.value.forEach(row => {
            if (!row) return
            if (row.raceClass) {
                classes.add(row.raceClass)
            } else if (row.teamClass) {
                classes.add(row.teamClass)
            } else if (row.classId && row.classId !== "00000000-0000-0000-0000-000000000000") {
                const resolved = eventClasses.value?.find(c => c.id === row.classId)?.name || row.classId
                classes.add(resolved)
            }
        })
        if (eventClasses.value && eventClasses.value.length > 0) {
            eventClasses.value.forEach(c => {
                if (parsedRows.value.some(r => r.classId === c.id || r.raceClass === c.name || r.teamClass === c.name)) {
                    classes.add(c.name)
                }
            })
        }
        return Array.from(classes).sort()
    })

    const hasMulticlass = computed(() => {
        return (availableClasses.value?.length || 0) > 1
    })

    const hasNumberColumn = computed(() => {
        return parsedRows.value?.some(r => r && r.carNumber) || false
    })

    watch(availableClasses, (classes) => {
        if (classes && classes.length > 0) {
            if (!selectedClass.value || !classes.includes(selectedClass.value)) {
                selectedClass.value = classes[0]
            }
        } else {
            selectedClass.value = ""
        }
    }, { immediate: true })

    watch(activeSessionTab, () => {
        const classes = availableClasses.value || []
        if (classes.length > 0) {
            if (!classes.includes(selectedClass.value)) {
                selectedClass.value = classes[0]
            }
        } else {
            selectedClass.value = ""
        }
    })

    const filteredRows = computed(() => {
        if (availableClasses.value.length <= 1) {
            return parsedRows.value
        }
        const activeCls = selectedClass.value || availableClasses.value[0]
        return parsedRows.value.filter(row => {
            if (row.raceClass === activeCls || row.teamClass === activeCls || row.classId === activeCls) {
                return true
            }
            const matchingClassId = eventClasses.value?.find(c => c.name === activeCls)?.id
            if (matchingClassId && row.classId === matchingClassId) {
                return true
            }
            return false
        })
    })

    const sessionPolePosition = computed(() => {
        const rows = filteredRows.value
        if (!rows || rows.length === 0) return null

        let pole = rows.find(r => Number(r.gridPosition) === 1 || r.isPole)
        if (!pole && rows.length > 0) {
            if (isQualifyingSession.value) {
                pole = rows[0]
            } else {
                const withGrid = rows.filter(r => Number(r.gridPosition) > 0)
                if (withGrid.length > 0) {
                    withGrid.sort((a, b) => Number(a.gridPosition) - Number(b.gridPosition))
                    pole = withGrid[0]
                }
            }
        }

        if (!pole) return null

        const teamNameOnly = cleanTeamName(pole.teamName || pole.team || 'Team')
        const name = pole.isTeamEntry
            ? (pole.carNumber ? `${teamNameOnly} (#${pole.carNumber})` : teamNameOnly)
            : pole.driverName

        const time = isQualifyingSession.value
            ? (pole.bestLap && pole.bestLap !== "-" ? pole.bestLap : null)
            : (pole.qualifyingLapTime || null)

        return {
            driverName: name,
            time
        }
    })

    const sessionFastestLap = computed(() => {
        if (isQualifyingSession.value) return null
        const rows = filteredRows.value
        if (!rows || rows.length === 0) return null

        let fastest = rows.find(r => r.isFastestLap && r.bestLap && r.bestLap !== "-" && r.bestLapMs > 0)
        if (!fastest) {
            const valid = rows.filter(r => r.bestLapMs && r.bestLapMs > 0 && r.bestLap && r.bestLap !== "-")
            if (valid.length > 0) {
                valid.sort((a, b) => a.bestLapMs - b.bestLapMs)
                fastest = valid[0]
            }
        }

        if (!fastest || !fastest.bestLap || fastest.bestLap === "-") return null
        const teamNameOnly = cleanTeamName(fastest.teamName || fastest.team || 'Team')
        return {
            driverName: fastest.isTeamEntry
                ? (fastest.carNumber ? `${fastest.carNumber} - ${teamNameOnly}` : teamNameOnly)
                : fastest.driverName,
            time: fastest.bestLap
        }
    })

    const isTeamSession = computed(() => {
        if (dbEntries.value && dbEntries.value.some(e => e.entry_type === 'team' || (!e.driver_id && e.team_id))) {
            return true
        }
        return parsedRows.value.length > 0 && parsedRows.value.some(r => r.isTeamEntry)
    })

    useHead({
        title: "ID Sim Racing",
        meta: [
            {
                name: "description",
                content: "ID Sim Racing"
            }
        ]
    })

    const formatDate = (date) => {
        if (!date) return ""
        let newDate = new Date(date)
        let dateOptions = {
            month: "long",
            day: "numeric",
            weekday: "long",
            year: "numeric"
        }
        return newDate.toLocaleDateString(locale.value === "en" ? "en-US" : "id-ID", dateOptions)
    }

    const formatTime = (date) => {
        if (!date) return ""
        let newTime = new Date(date)
        let timeOptions = {
            hour: "2-digit",
            minute: "2-digit"
        }
        return newTime.toLocaleTimeString(locale.value === "en" ? "en-US" : "id-ID", timeOptions)
    }

    const formatPenalty = (sec) => {
        const val = Math.abs(Number(sec) || 0)
        if (val < 60) {
            return `+${val.toFixed(3)}`
        }
        const hours = Math.floor(val / 3600)
        const minutes = Math.floor((val % 3600) / 60)
        const seconds = val % 60
        const secPad = seconds.toFixed(3).padStart(6, "0")
        const minPad = String(minutes).padStart(1, "0")

        if (hours > 0) {
            return `+${hours}:${minPad}:${secPad}`
        }
        return `+${minPad}:${secPad}`
    }

    const getStatus = (date, finish_date, is_postponed) => {
        if (is_postponed) {
            return t("postponed")
        }
        let eventDate = new Date(date)
        let todayDate = new Date()
        let finishDate = new Date(finish_date)
        let remainingEventDays = Math.floor((eventDate - todayDate) / (1000 * 60 * 60 * 24))
        let remainingFinishDays = Math.floor((finishDate - todayDate) / (1000 * 60 * 60 * 24))
        if (remainingEventDays < 0 && remainingFinishDays < 0) {
            return t("finished")
        } else if (remainingEventDays < 0 && remainingFinishDays >= 0) {
            return t("started")
        } else if (remainingEventDays <= 1) {
            let remainingHours = Math.ceil((eventDate - todayDate) / (1000 * 60 * 60))
            if (remainingHours > 24) {
                remainingHours -= 24
                return t("oneDayAndHoursLeft", { count: remainingHours })
            } else {
                let remainingMinutes = Math.ceil((eventDate - todayDate) / (1000 * 60))
                if (remainingMinutes < 60) {
                    return t("minutesLeft", { count: remainingMinutes })
                } else {
                    return t("hoursLeft", { count: remainingHours })
                }
            }
        } else {
            return t("daysLeft", { days: remainingEventDays })
        }
    }

    const getStatusStyle = (status) => {
        let style = "w-fit px-2 py-1 font-bold rounded-md text-sm lg:text-base border "
        if (status === t("postponed")) {
            style += "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800"
        } else if (status === t("finished")) {
            style += "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-gray-300 border-gray-300 dark:border-slate-700"
        } else {
            style += "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
        }
        return style
    }

    const getCardStyle = (event) => {
        let style = "rounded-tr-3xl border-r-4 lg:border-r-6 border-t-4 lg:border-t-6 p-4 lg:p-6 mb-8 text-black dark:text-white "
        if (!event) return style + "bg-red-50 dark:bg-slate-950"
        if(event.startsWith("MX-5 Cup Asia")){
            style += "border-red-500 bg-red-200/80 dark:bg-red-900/60"
        }else if(event.startsWith("1 Hour Series")){
            style += "border-emerald-500 bg-emerald-200/80 dark:bg-emerald-900/60"
        }else if(event === "Open Wheel Series"){
            style += "border-cyan-500 bg-cyan-200/80 dark:bg-cyan-900/60"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            style += "border-yellow-500 bg-yellow-200/80 dark:bg-yellow-900/60"
        }else if(event === "Endurance Championship"){
            style += "border-pink-500 bg-pink-200/80 dark:bg-pink-900/60"
        }else if(event === "Masters League" || event === "Praga Cup"){
            style += "border-blue-500 bg-blue-200/80 dark:bg-blue-900/60"
        }else if(event === "Juniors"){
            style += "border-lime-500 bg-lime-200/80 dark:bg-lime-900/60"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "border-orange-500 bg-orange-200/80 dark:bg-orange-900/60"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            style += "border-purple-500 bg-purple-200/80 dark:bg-purple-900/60"
        }else if(event.startsWith("Speedway Master Series")){
            style += "border-fuchsia-500 bg-fuchsia-200/80 dark:bg-fuchsia-900/60"
        }else if(event === "Javahosting Rental Cup"){
            style += "border-indigo-500 bg-indigo-200/80 dark:bg-indigo-900/60"
        }else if(event === "Indorance"){
            style += "border-sky-500 bg-sky-200/80 dark:bg-sky-900/60"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "border-rose-500 bg-rose-200/80 dark:bg-rose-900/60"
        }else if(event.startsWith("LMU Championship")){
            style += "border-amber-500 bg-amber-200/80 dark:bg-amber-900/60"
        }else if(event === "LMU Solo Endurance"){
            style += "border-pink-800 bg-pink-300/80 dark:bg-pink-800/60"
        }else{
            style += "bg-red-50 dark:bg-slate-950"
        }
        return style
    }

    const getOrganizerStyle = (organizer) => {
        let style = "px-2 py-1 font-bold rounded-md text-sm lg:text-base "
        if(organizer === "ACI"){
            style += "bg-red-500 text-white"
        }else if(organizer === "97SRC"){
            style += "bg-white text-black"
        }else if(organizer === "CRC"){
            style += "bg-yellow-500 text-black"
        }else if(organizer === "BRM"){
            style += "bg-sky-500 text-black"
        }else if(organizer === "JRC"){
            style += "bg-indigo-500 text-black"
        }else if(organizer === "ERGP"){
            style += "bg-white text-red-600"
        }else if(organizer === "SRC"){
            style += "bg-blue-500 text-white"
        }else if(organizer === "ISL"){
            style += "bg-pink-800 text-white"
        }
        return style
    }

    const getGameStyle = (game) => {
        let style = "px-2 py-1 font-bold rounded-md text-sm lg:text-base "
        if(game === "AC"){
            style += "bg-red-500 text-white"
        }else if(game === "ACC"){
            style += "bg-white text-red-600"
        }else if(game === "RBR"){
            style += "bg-black text-white"
        }else if(game === "LMU"){
            style += "bg-amber-500 text-black"
        }
        return style
    }

    const getTextStyle = (event) => {
        let style = " "
        if(!event) return style
        if(event.startsWith("MX-5 Cup Asia")){
            style += "text-red-500"
        }else if(event.startsWith("1 Hour Series")){
            style += "text-emerald-500"
        }else if(event === "Open Wheel Series"){
            style += "text-cyan-500"
        }else if(event.startsWith("Sprint Series") || event.startsWith("Porsche Supercup") || event.startsWith("GT3 Open") || event.startsWith("Asri Motor Slalom Cup")){
            style += "text-yellow-500"
        }else if(event === "Endurance Championship"){
            style += "border-pink-500 text-pink-500"
        }else if(event === "Masters League" || event === "Praga Cup"){
            style += "text-blue-500"
        }else if(event === "Juniors"){
            style += "text-lime-500"
        }else if(event === "B.E.G.O. Balap Cup"){
            style += "text-orange-500"
        }else if(event === "Sprint Rally Challenge" || event === "Rally Championship"){
            style += "text-purple-500"
        }else if(event.startsWith("Speedway Master Series")){
            style += "text-fuchsia-500"
        }else if(event === "Javahosting Rental Cup"){
            style += "text-indigo-500"
        }else if(event === "Indorance"){
            style += "text-sky-500"
        }else if(event === "Endurance Edition" || event === "Global Edition"){
            style += "text-rose-500"
        }else if(event.startsWith("LMU Championship")){
            style += "text-amber-500"
        }else if(event === "LMU Solo Endurance"){
            style += "text-pink-800"
        }
        return style
    }

    const getRowStyle = (item) => {
        return "border-b border-slate-300 dark:border-slate-700 text-black dark:text-white bg-red-50 dark:bg-slate-950 hover:bg-red-100/70 dark:hover:bg-slate-800/80 font-medium"
    }

    const getTeamPodiumColor = (item) => {
        if (isQualifyingSession.value || item.disqualified || item.status === 'dnf' || item.status === 'dns') {
            return "text-black dark:text-white"
        }

        const pos = selectedClass.value !== 'ALL'
            ? (item.classPosition || (filteredRows.value.indexOf(item) + 1))
            : (hasMulticlass.value && item.classPosition ? item.classPosition : item.position)

        if (pos === 1) {
            return "text-yellow-600 dark:text-yellow-400"
        } else if (pos === 2) {
            return "text-slate-500 dark:text-slate-400"
        } else if (pos === 3) {
            return "text-amber-700 dark:text-amber-500"
        }
        return "text-black dark:text-white"
    }
</script>

<template>
    <div class="min-h-screen bg-gray-50 dark:bg-slate-950 text-black dark:text-white px-4 lg:px-24 py-8">
        <!-- Back Navigation & Breadcrumb -->
        <!-- <div class="mb-6 flex items-center justify-between">
            <button
                @click="router.back()"
                class="flex items-center gap-2 text-sm lg:text-base font-semibold text-red-700 dark:text-red-400 hover:underline cursor-pointer"
            >
                <Icon name="mi:chevron-left" size="1.2em" />
                {{ $t('backToSchedule') }}
            </button>
        </div> -->

        <!-- Event Header Card (matches CardSchedule) -->
        <div v-if="scheduleItem" :class="getCardStyle(scheduleItem.events?.name)">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-1.5 flex-wrap">
                    <span v-if="scheduleItem.events?.organizers?.abbreviation" :class="getOrganizerStyle(scheduleItem.events.organizers.abbreviation)">
                        {{ scheduleItem.events.organizers.abbreviation }}
                    </span>
                    <span v-if="scheduleItem.events?.games?.abbreviation" :class="getGameStyle(scheduleItem.events.games.abbreviation)">
                        {{ scheduleItem.events.games.abbreviation }}
                    </span>
                </div>
                <div v-if="scheduleItem.country_2" class="flex items-center gap-1 text-2xl lg:text-3xl">
                    <Icon :name="`flag-${ scheduleItem.country }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
                    <Icon :name="`flag-${ scheduleItem.country_2 }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
                </div>
                <div v-else-if="scheduleItem.country" class="text-2xl lg:text-3xl">
                    <Icon :name="`flag-${ scheduleItem.country }-4x3`" mode="svg" class="rounded-sm lg:rounded-md" />
                </div>
            </div>
            <div class="text-base lg:text-xl">
                {{ formatDate(scheduleItem.date) }}
            </div>
            <div :class="getTextStyle(scheduleItem.events?.name)">
                <span class="font-bold text-base lg:text-xl">{{ scheduleItem.events?.name }} {{ scheduleItem.season && "(S" + scheduleItem.season + ")"}}</span>
            </div>
            <div class="text-sm lg:text-base">
                <div v-if="scheduleItem.round === 'Invitation' || scheduleItem.round === 'Prologue'">
                    {{ scheduleItem.round }} Round: {{ scheduleItem.circuit }}
                </div>
                <div v-else-if="scheduleItem.round !== null">
                    Round {{ scheduleItem.round }}: {{ scheduleItem.circuit }}
                </div>
                <div v-else-if="scheduleItem.circuit !== null">
                    {{ scheduleItem.circuit }}
                </div>
            </div>
            <div class="flex flex-wrap gap-1 lg:gap-2 items-center mt-2">
                <NuxtLink v-if="scheduleItem.stream_link" :to="scheduleItem.stream_link" target="_blank" class="text-sm lg:text-base text-white bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded-md font-bold cursor-pointer">
                    <div v-if="getStatus(scheduleItem.date, scheduleItem.finish_date, scheduleItem.is_postponed) === t('finished')">
                        <span class="text-sm lg:text-base">{{ $t("watchReplay") }}</span>
                    </div>
                    <div v-else>
                        <span class="text-sm lg:text-base">{{ $t("watchLive") }}</span>
                    </div>
                </NuxtLink>
            </div>
        </div>

        <!-- Loading State -->
        <div v-if="loadingResult || loadingSchedule || loadingEntries" class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-gray-500 dark:text-gray-400 text-sm lg:text-base">Memuat hasil balapan...</p>
        </div>

        <!-- Results Content -->
        <div v-else class="space-y-6">
            <!-- Results Title & Race Tabs -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div class="flex flex-col gap-1">
                    <h1 class="text-xl lg:text-2xl font-extrabold text-black dark:text-white">
                        <span v-if="!filteredRows.length">
                            {{ $t('noResultsYet') }}
                        </span>
                        <span v-else-if="hasDbResults">
                            {{ isSessionProvisional ? $t('provisionalRaceResults') : $t('finalRaceResults') }}
                        </span>
                        <span v-else>
                            {{ $t('raceResults') }}
                        </span>
                    </h1>
                    <p v-if="filteredRows.length && hasDbResults && isSessionProvisional" class="text-sm lg:text-base text-black dark:text-white">
                        {{ $t('subjectToInvestigation') }}
                    </p>
                </div>

                <!-- Session Navigation Tabs (Qualifying, Race 1, Race 2) -->
                <div v-if="hasMultipleSessions" class="flex flex-wrap items-center gap-2">
                    <button
                        v-for="session in availableSessions"
                        :key="session.id"
                        @click="activeSessionTab = session.id"
                        :class="activeSessionTab === session.id
                            ? 'bg-red-900 text-white font-bold shadow'
                            : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold'"
                        class="px-5 py-2 rounded-xl text-sm lg:text-base transition cursor-pointer flex items-center gap-2"
                    >
                        <span>{{ session.label }}</span>
                    </button>
                </div>
            </div>

            <template v-if="filteredRows.length">

            <!-- Class Navigation Tabs -->
            <div v-if="availableClasses && availableClasses.length > 1" class="flex flex-wrap items-center gap-2">
                <button
                    v-for="cls in availableClasses"
                    :key="cls"
                    @click="selectedClass = cls"
                    :class="selectedClass === cls
                        ? 'bg-red-900 text-white font-bold shadow'
                        : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800 font-semibold'"
                    class="px-5 py-2 rounded-xl text-sm lg:text-base transition cursor-pointer flex items-center gap-2"
                >
                    <span>{{ cls }}</span>
                </button>
            </div>

            <!-- Pole Position & Fastest Lap Info (Per Class) -->
            <div v-if="(!isQualifyingSession && sessionFastestLap)" class="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm lg:text-base text-gray-700 dark:text-gray-300">
                <!-- Fastest Lap (Per Class) -->
                <div v-if="!isQualifyingSession && sessionFastestLap" class="flex items-center gap-2">
                    <span class="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                        <span>{{ $t('fastestLap') || 'Fastest Lap' }}:</span>
                    </span>
                    <span class="font-bold text-black dark:text-white">{{ sessionFastestLap.driverName }}</span>
                    <!-- <span class="font-bold text-black dark:text-white">—</span> -->
                    <span class="font-bold text-black dark:text-white">({{ sessionFastestLap.time }})</span>
                </div>
            </div>

            <!-- Full Leaderboard Table -->
            <div class="border border-gray-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-950">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm lg:text-base border-collapse">
                        <thead class="bg-red-900 dark:bg-red-900 text-white font-bold text-sm lg:text-base">
                            <!-- Team Event Header: Pos - Num - Team - Progression - Lap - Time/Gap - Penalty - Points -->
                            <tr v-if="isTeamSession">
                                <th class="py-2.5 px-2 lg:px-4 text-center w-11 min-w-[44px] max-w-[44px]">{{ $t('position') }}</th>
                                <th class="py-2.5 px-2 lg:px-3 text-center w-14 min-w-[52px] max-w-[52px]">{{ $t('carNumber') || 'No.' }}</th>
                                <th class="py-2.5 px-3 lg:px-4 min-w-[160px]">{{ $t('team') || 'Tim' }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-2 text-center min-w-[50px]" :title="$t('progressionTooltip') || 'Perubahan Posisi (Start vs Finish)'">{{ $t('progression') }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('laps') }}</th>
                                <th class="py-2.5 px-3 lg:px-4 text-center min-w-[90px]" :class="isQualifyingSession ? 'whitespace-nowrap' : ''">{{ isQualifyingSession ? $t('fastestLapGap') : $t('timeGap') }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('penalty') }}</th>
                                <th v-if="hasPointsColumn && !isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('points') }}</th>
                            </tr>
                            <!-- Individual Event Header -->
                            <tr v-else>
                                <th class="py-2.5 px-2 lg:px-4 text-center w-11 min-w-[44px] max-w-[44px]">{{ $t('position') }}</th>
                                <th class="py-2.5 px-3 lg:px-4 text-left min-w-[150px] lg:min-w-[180px]">{{ $t('driver') }}</th>
                                <th v-if="hasNumberColumn" class="py-2.5 px-3 lg:px-4 text-center min-w-[50px] hidden md:table-cell">{{ $t('carNumber') }}</th>
                                <th class="py-2.5 px-3 lg:px-4 min-w-[120px] lg:min-w-[150px]">{{ $t('team') }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-2 text-center min-w-[50px]" :title="$t('progressionTooltip') || 'Perubahan Posisi (Start vs Finish)'">{{ $t('progression') }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('laps') }}</th>
                                <th class="py-2.5 px-3 lg:px-4 text-center min-w-[90px]" :class="isQualifyingSession ? 'whitespace-nowrap' : ''">{{ isQualifyingSession ? $t('fastestLapGap') : $t('timeGap') }}</th>
                                <th v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('penalty') }}</th>
                                <th v-if="hasPointsColumn && !isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center min-w-[60px]">{{ $t('points') }}</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm lg:text-base">
                            <!-- Team Event Rows -->
                            <template v-if="isTeamSession">
                                <tr
                                     v-for="(item, rowIdx) in filteredRows"
                                     :key="item.position"
                                     :class="getRowStyle(item)"
                                     class="transition"
                                >
                                     <!-- Pos -->
                                     <td class="py-2.5 px-2 lg:px-4 text-center text-sm lg:text-base font-bold">
                                         {{ hasMulticlass ? (item.classPosition || (rowIdx + 1)) : (item.classPosition || item.position || (rowIdx + 1)) }}
                                     </td>

                                     <!-- Num -->
                                     <td class="py-2.5 px-2 lg:px-3 text-center text-sm lg:text-base font-bold whitespace-nowrap">
                                         {{ item.carNumber || '-' }}
                                     </td>

                                     <!-- Team (name only, without icon and number) -->
                                     <td
                                         class="py-2.5 px-3 lg:px-4 text-sm lg:text-base font-bold whitespace-nowrap"
                                         :class="getTeamPodiumColor(item)"
                                     >
                                         {{ cleanTeamName(item.teamName || item.team || '-') }}
                                     </td>

                                     <!-- Progression (+/-) -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-2 text-center text-xs lg:text-sm">
                                         <div
                                             v-if="item.posDiff !== null && item.gridPosition > 0"
                                             class="inline-flex items-center justify-center gap-0.5 font-bold"
                                             :title="`Start P${item.gridPosition} → Finish P${hasMulticlass ? (item.classPosition || (rowIdx + 1)) : item.position} (${item.posDiff > 0 ? '+' + item.posDiff : (item.posDiff < 0 ? item.posDiff : '=')})`"
                                         >
                                             <span
                                                 v-if="item.posDiff > 0"
                                                 class="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold"
                                             >
                                                 <Icon name="material-symbols:arrow-drop-up" class="text-base lg:text-lg -mr-0.5" />
                                                 <span>{{ item.posDiff }}</span>
                                             </span>
                                             <span
                                                 v-else-if="item.posDiff < 0"
                                                 class="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold"
                                             >
                                                 <Icon name="material-symbols:arrow-drop-down" class="text-base lg:text-lg -mr-0.5" />
                                                 <span>{{ Math.abs(item.posDiff) }}</span>
                                             </span>
                                             <span
                                                 v-else
                                                 class="inline-flex items-center text-gray-400 dark:text-gray-500 font-bold"
                                             >
                                                 <Icon name="material-symbols:remove" class="text-xs lg:text-sm" />
                                             </span>
                                         </div>
                                         <span v-else class="text-gray-400 text-xs">-</span>
                                     </td>

                                     <!-- Laps -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base">
                                         {{ item.numLaps }}
                                     </td>

                                     <!-- Gap / Fastest Lap / Gap -->
                                     <td class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base whitespace-nowrap">
                                         <span v-if="item.disqualified" class="font-bold text-red-500">DSQ</span>
                                         <span v-else-if="item.status === 'dnf'" class="font-bold text-red-500">DNF</span>
                                         <span v-else-if="item.status === 'dns'" class="font-bold text-red-500">DNS</span>
                                         <span v-else-if="isQualifyingSession">
                                             <span class="font-medium">{{ item.gap || item.bestLap || '-' }}</span>
                                         </span>
                                         <span v-else>{{ item.gap }}</span>
                                     </td>

                                     <!-- Penalty -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base">
                                         <span
                                             v-if="item.hasPenalty"
                                             class="inline-flex items-center justify-center text-sm lg:text-base font-bold text-red-500"
                                             :title="`Penalti ${formatPenalty(item.penaltyTime)}`"
                                         >
                                             {{ formatPenalty(item.penaltyTime) }}
                                         </span>
                                         <span v-else></span>
                                     </td>

                                     <!-- Points -->
                                     <td v-if="hasPointsColumn && !isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center font-bold text-sm lg:text-base">
                                         <span v-if="item.points > 0">{{ formatPoints(item.points) }}</span>
                                         <span v-else-if="item.disqualified || item.status === 'dns' || item.status === 'dnf'"></span>
                                         <span v-else-if="item.noPoints" class="text-xs text-gray-400 font-normal" title="Tanpa Poin (Excluded from points)">0</span>
                                         <span v-else>{{ formatPoints(item.points) }}</span>
                                     </td>
                                </tr>
                            </template>

                            <!-- Individual Event Rows -->
                            <template v-else>
                                <tr
                                     v-for="(item, rowIdx) in filteredRows"
                                     :key="item.position"
                                     :class="getRowStyle(item)"
                                     class="transition"
                                >
                                     <!-- Position -->
                                     <td class="py-2.5 px-2 lg:px-4 text-center text-sm lg:text-base font-bold">
                                         {{ hasMulticlass ? (item.classPosition || (rowIdx + 1)) : item.position }}
                                     </td>

                                     <!-- Driver / Team -->
                                     <td class="py-2.5 px-3 lg:px-4 whitespace-nowrap">
                                         <div class="text-sm lg:text-base flex flex-col leading-snug">
                                             <div class="flex items-center gap-1.5 flex-nowrap">
                                                 <template v-if="item.driversList && item.driversList.length > 0">
                                                     <div v-for="(d, dIdx) in item.driversList" :key="d.id || dIdx" class="flex items-center gap-1.5 shrink-0">
                                                         <Icon
                                                             v-if="getDriverCountryCode(d.country || d)"
                                                             :name="`flag-${getDriverCountryCode(d.country || d)}-4x3`"
                                                             mode="svg"
                                                             class="w-4 h-3 lg:w-4.5 lg:h-3.5 rounded-xs shadow-xs shrink-0"
                                                         />
                                                         <span class="font-bold">{{ d.name }}</span>
                                                         <span v-if="dIdx < item.driversList.length - 1" class="text-gray-400 font-normal">/</span>
                                                     </div>
                                                 </template>
                                                 <template v-else>
                                                     <Icon
                                                         v-if="getDriverCountryCode(item.nation || item.driverCountry)"
                                                         :name="`flag-${getDriverCountryCode(item.nation || item.driverCountry)}-4x3`"
                                                         mode="svg"
                                                         class="w-4 h-3 lg:w-4.5 lg:h-3.5 rounded-xs shadow-xs shrink-0"
                                                     />
                                                     <span v-for="(name, nIdx) in (item.driverNames && item.driverNames.length ? item.driverNames : [item.driverName])" :key="nIdx" class="font-bold shrink-0">
                                                         {{ name }}
                                                         <span v-if="nIdx < (item.driverNames?.length || 1) - 1" class="text-gray-400 font-normal">/</span>
                                                     </span>
                                                 </template>
                                             </div>
                                         </div>
                                     </td>

                                     <!-- Number -->
                                     <td v-if="hasNumberColumn" class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base hidden md:table-cell">
                                         {{ item.carNumber || '-' }}
                                     </td>

                                     <!-- Team -->
                                     <td class="py-2.5 px-3 lg:px-4 text-sm lg:text-base whitespace-nowrap">
                                         {{ item.teamName || item.team }}
                                     </td>

                                     <!-- Progression (+/-) -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-2 text-center text-xs lg:text-sm">
                                         <div
                                             v-if="item.posDiff !== null && item.gridPosition > 0"
                                             class="inline-flex items-center justify-center gap-0.5 font-bold"
                                             :title="`Start P${item.gridPosition} → Finish P${hasMulticlass ? (item.classPosition || (rowIdx + 1)) : item.position} (${item.posDiff > 0 ? '+' + item.posDiff : (item.posDiff < 0 ? item.posDiff : '=')})`"
                                         >
                                             <span
                                                 v-if="item.posDiff > 0"
                                                 class="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold"
                                             >
                                                 <Icon name="material-symbols:arrow-drop-up" class="text-base lg:text-lg -mr-0.5" />
                                                 <span>{{ item.posDiff }}</span>
                                             </span>
                                             <span
                                                 v-else-if="item.posDiff < 0"
                                                 class="inline-flex items-center text-rose-600 dark:text-rose-400 font-bold"
                                             >
                                                 <Icon name="material-symbols:arrow-drop-down" class="text-base lg:text-lg -mr-0.5" />
                                                 <span>{{ Math.abs(item.posDiff) }}</span>
                                             </span>
                                             <span
                                                 v-else
                                                 class="inline-flex items-center text-gray-400 dark:text-gray-500 font-bold"
                                             >
                                                 <Icon name="material-symbols:remove" class="text-xs lg:text-sm" />
                                             </span>
                                         </div>
                                         <span v-else class="text-gray-400 text-xs">-</span>
                                     </td>

                                     <!-- Laps -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base">
                                         {{ item.numLaps }}
                                     </td>

                                     <!-- Gap / Fastest Lap / Gap -->
                                     <td class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base whitespace-nowrap">
                                         <span v-if="item.disqualified" class="font-bold text-red-500">DSQ</span>
                                         <span v-else-if="item.status === 'dnf'" class="font-bold text-red-500">DNF</span>
                                         <span v-else-if="item.status === 'dns'" class="font-bold text-red-500">DNS</span>
                                         <span v-else-if="isQualifyingSession">
                                             <span class="font-medium">{{ item.gap || item.bestLap || '-' }}</span>
                                         </span>
                                         <span v-else>{{ item.gap }}</span>
                                     </td>

                                     <!-- Penalty -->
                                     <td v-if="!isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center text-sm lg:text-base">
                                         <span
                                             v-if="item.hasPenalty"
                                             class="inline-flex items-center justify-center text-sm lg:text-base font-bold text-red-500"
                                             :title="`Penalti ${formatPenalty(item.penaltyTime)}`"
                                         >
                                             {{ formatPenalty(item.penaltyTime) }}
                                         </span>
                                         <span v-else></span>
                                     </td>

                                     <!-- Points -->
                                     <td v-if="hasPointsColumn && !isQualifyingSession" class="py-2.5 px-3 lg:px-4 text-center font-bold text-sm lg:text-base">
                                         <span v-if="item.points > 0">{{ formatPoints(item.points) }}</span>
                                         <span v-else-if="item.disqualified || item.status === 'dns' || item.status === 'dnf'"></span>
                                         <span v-else-if="item.noPoints" class="text-xs text-gray-400 font-normal" title="Tanpa Poin (Excluded from points)">0</span>
                                         <span v-else>{{ formatPoints(item.points) }}</span>
                                     </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
            </template>
        </div>
    </div>
</template>
