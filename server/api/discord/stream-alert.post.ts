export default defineEventHandler(async (event) => {
    const body = await readBody(event)
    const scheduleId = body?.scheduleId
    const customMessage = body?.message

    if (!scheduleId && !body?.streamLink) {
        throw createError({
            statusCode: 400,
            statusMessage: "scheduleId or streamLink is required"
        })
    }

    const supabase = useServerSupabase()
    const config = useRuntimeConfig()
    const siteUrl = (config.siteUrl || "https://idsimracing.com").replace(/\/$/, "")

    let schedule = body.schedule

    if (scheduleId && !schedule) {
        const { data, error } = await supabase
            .from("schedule")
            .select(`
                id,
                round,
                season,
                date,
                finish_date,
                circuit,
                stream_link,
                country,
                country_2,
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

        if (error || !data) {
            throw createError({
                statusCode: 404,
                statusMessage: `Schedule with ID ${scheduleId} not found`
            })
        }
        schedule = data
    }

    const streamLink = body.streamLink || schedule?.stream_link
    if (!streamLink) {
        throw createError({
            statusCode: 400,
            statusMessage: "This event does not have a stream_link URL set."
        })
    }

    const organizerAbbr = schedule?.events?.organizers?.abbreviation?.trim() || schedule?.events?.organizers?.name?.trim() || ""
    const rawEventName = schedule?.events?.name?.trim() || "Championship"

    // Avoid duplicating organizer abbreviation if event name already starts with it
    let eventTitle = rawEventName
    if (organizerAbbr && !rawEventName.toLowerCase().startsWith(organizerAbbr.toLowerCase())) {
        eventTitle = `${organizerAbbr} ${rawEventName}`.trim()
    }

    // Format Season (e.g., "Season 1" or "S1")
    const rawSeason = schedule?.season
    let seasonPart = ""
    if (rawSeason !== null && rawSeason !== undefined && String(rawSeason).trim() !== "") {
        const s = String(rawSeason).trim()
        seasonPart = s.toLowerCase().startsWith("season") || s.toLowerCase().startsWith("s") ? s : `(S${s})`
    }

    // Format Round (e.g., "Round 1")
    const rawRound = schedule?.round
    let roundPart = ""
    if (rawRound !== null && rawRound !== undefined && String(rawRound).trim() !== "") {
        const r = String(rawRound).trim()
        roundPart = r.toLowerCase().startsWith("round") ? r : `Round ${r}`
    }

    // Combine: (Organizer abbreviation) (Event name) (Season) - (Round)
    let eventCore = eventTitle
    if (seasonPart) {
        eventCore += ` ${seasonPart}`
    }
    if (roundPart) {
        eventCore += ` - ${roundPart}`
    }

    const circuitName = schedule?.circuit?.trim() || "Circuit"
    const flagEmojis = [
        getCountryFlagEmoji(schedule?.country),
        getCountryFlagEmoji(schedule?.country_2)
    ].filter(Boolean).join(" ")

    const circuitWithFlag = flagEmojis ? `${flagEmojis} ${circuitName}` : circuitName
    const gameName = schedule?.events?.games?.name || schedule?.events?.games?.abbreviation || "Sim Racing"

    const videoId = extractYouTubeVideoId(streamLink)
    const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined

    // Formatted caption matching:
    // The live stream for (Organizer abbreviation) (Event name) (Season) - (Round) at (Circuit) is available!
    //
    // Event starts at (Date, time)
    //
    // Click to watch live on YouTube
    const caption = [
        `The live stream for **${eventCore}** (**${circuitWithFlag}**) is available!`,
        "",
        `**Event starts at** ${formatDiscordTimestamp(schedule?.date, "F")} (${formatDiscordTimestamp(schedule?.date, "R")})`,
        "",
        `[Click to watch live on YouTube](${streamLink})`
    ].join("\n")

    const embed: DiscordEmbed = {
        title: `🔴 LIVE STREAM: ${eventCore}`,
        url: streamLink,
        description: customMessage || caption,
        color: 0xEF4444, // YouTube Red
        ...(thumbnailUrl ? { image: { url: thumbnailUrl } } : {}),
        footer: {
            text: `idsimracing.com`,
            icon_url: `${siteUrl}/pwa-192x192.png`
        },
        timestamp: new Date().toISOString()
    }

    const result = await sendDiscordWebhook("stream", {
        content: body?.pingEveryone ? "@everyone 🔴 Live broadcast is starting!" : undefined,
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
