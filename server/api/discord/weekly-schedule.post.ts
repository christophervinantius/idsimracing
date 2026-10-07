export default defineEventHandler(async (event) => {
    const body = await readBody(event).catch(() => ({}))
    const config = useRuntimeConfig()
    const siteUrl = (config.siteUrl || "https://idsimracing.com").replace(/\/$/, "")

    // Optional cron secret authorization check if sent via automated webhook
    const authHeader = getHeader(event, "authorization") || getHeader(event, "x-cron-secret")
    const providedSecret = body?.secret || (authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null)

    if (config.discordCronSecret && providedSecret && providedSecret !== config.discordCronSecret) {
        throw createError({
            statusCode: 401,
            statusMessage: "Unauthorized cron token"
        })
    }

    const supabase = useServerSupabase()

    // Determine target week dates (Monday 00:00:00 to Sunday 23:59:59)
    const now = new Date()
    const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, ...
    const distanceToMonday = (currentDay + 6) % 7 // Days since Monday

    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - distanceToMonday)
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const startIso = body?.startDate || startOfWeek.toISOString()
    const endIso = body?.endDate || endOfWeek.toISOString()

    const { data: schedules, error } = await supabase
        .from("schedule")
        .select(`
            id,
            round,
            season,
            date,
            finish_date,
            circuit,
            country,
            country_2,
            stream_link,
            is_postponed,
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
        .gte("date", startIso)
        .lte("date", endIso)
        .order("date", { ascending: true })

    if (error) {
        throw createError({
            statusCode: 500,
            statusMessage: "Failed to fetch schedules: " + error.message
        })
    }

    const startFormatted = startOfWeek.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    const endFormatted = endOfWeek.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    if (!schedules || schedules.length === 0) {
        const emptyEmbed: DiscordEmbed = {
            title: `🏁 THIS WEEK ON idsimracing.com (${startFormatted} - ${endFormatted})`,
            description: "No races are scheduled for this week. Practice hard and see you next round!",
            color: BRAND_COLOR,
            footer: {
                text: "idsimracing.com",
                icon_url: `${siteUrl}/pwa-192x192.png`
            },
            timestamp: new Date().toISOString()
        }

        const res = await sendDiscordWebhook("schedule", { embeds: [emptyEmbed] })
        return {
            success: res.success,
            count: 0,
            message: "No races found. Posted empty weekly notice."
        }
    }

    const fields: DiscordEmbedField[] = schedules.map((item: any) => {
        const organizerAbbr = item.events?.organizers?.abbreviation?.trim() || item.events?.organizers?.name?.trim() || ""
        const rawEventName = item.events?.name?.trim() || "Championship"

        let eventFull = rawEventName
        if (organizerAbbr && !rawEventName.toLowerCase().startsWith(organizerAbbr.toLowerCase())) {
            eventFull = `${organizerAbbr} ${rawEventName}`.trim()
        }

        const rawSeason = item.season
        let seasonPart = ""
        if (rawSeason !== null && rawSeason !== undefined && String(rawSeason).trim() !== "") {
            const s = String(rawSeason).trim()
            if (s.toLowerCase().startsWith("season") || s.toLowerCase().startsWith("s")) {
                seasonPart = s.startsWith("(") ? s : `(${s})`
            } else {
                seasonPart = `(S${s})`
            }
        }

        const eventHeader = seasonPart ? `${eventFull} ${seasonPart}` : eventFull

        const rawRound = item.round
        let roundNum = ""
        if (rawRound !== null && rawRound !== undefined && String(rawRound).trim() !== "") {
            const r = String(rawRound).trim()
            roundNum = r.toLowerCase().startsWith("round") ? r.replace(/^round\s*/i, "") : r
        } else {
            roundNum = "-"
        }

        const circuitName = item.circuit?.trim() || "Circuit"
        const flagEmojis = [
            getCountryFlagEmoji(item.country),
            getCountryFlagEmoji(item.country_2)
        ].filter(Boolean).join(" ")
        const circuitWithFlag = flagEmojis ? `${flagEmojis} ${circuitName}` : circuitName

        const postponedBadge = item.is_postponed ? "**[POSTPONED]**" : ""
        const scheduleLine = `${formatDiscordTimestamp(item.date, "F")} (${formatDiscordTimestamp(item.date, "R")})${postponedBadge}`

        const details = [
            `Round ${roundNum}: ${circuitWithFlag}`,
            scheduleLine
        ]

        return {
            name: eventHeader,
            value: details.join("\n"),
            inline: false
        }
    })

    const embed: DiscordEmbed = {
        title: `🏁 THIS WEEK ON idsimracing.com (${startFormatted} - ${endFormatted})`,
        url: `${siteUrl}/`,
        color: BRAND_COLOR,
        fields,
        footer: {
            text: `idsimracing.com`,
            icon_url: `${siteUrl}/pwa-192x192.png`
        },
        timestamp: new Date().toISOString()
    }

    const result = await sendDiscordWebhook("schedule", {
        embeds: [embed]
    })

    if (!result.success) {
        throw createError({
            statusCode: 400,
            statusMessage: result.message
        })
    }

    return {
        ...result,
        count: schedules.length
    }
})
