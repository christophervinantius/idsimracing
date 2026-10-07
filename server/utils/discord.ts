export type DiscordWebhookType = "default" | "stream" | "results" | "schedule"

export interface DiscordEmbedField {
    name: string
    value: string
    inline?: boolean
}

export interface DiscordEmbed {
    title?: string
    url?: string
    description?: string
    color?: number
    fields?: DiscordEmbedField[]
    thumbnail?: { url: string }
    image?: { url: string }
    footer?: { text: string; icon_url?: string }
    timestamp?: string
}

export interface DiscordPayload {
    content?: string
    username?: string
    avatar_url?: string
    embeds?: DiscordEmbed[]
}

// Brand color: Crimson Red (HEX #DC2626 = DEC 14427686)
export const BRAND_COLOR = 0xDC2626
export const BRAND_GOLD = 0xF59E0B
export const BRAND_BLUE = 0x2563EB

/**
 * Resolves the appropriate Discord webhook URL based on the notification type.
 */
export const getDiscordWebhookUrl = (type: DiscordWebhookType = "default"): string | null => {
    const config = useRuntimeConfig()
    
    if (type === "stream" && config.discordWebhookStreamUrl) {
        return config.discordWebhookStreamUrl
    }
    if (type === "results" && config.discordWebhookResultsUrl) {
        return config.discordWebhookResultsUrl
    }
    if (type === "schedule" && config.discordWebhookScheduleUrl) {
        return config.discordWebhookScheduleUrl
    }

    return config.discordWebhookUrl || null
}

/**
 * Sends a message payload to Discord via Webhook.
 */
export const sendDiscordWebhook = async (
    type: DiscordWebhookType,
    payload: DiscordPayload
): Promise<{ success: boolean; message: string }> => {
    const webhookUrl = getDiscordWebhookUrl(type)

    if (!webhookUrl) {
        return {
            success: false,
            message: `Discord Webhook URL for "${type}" is not configured. Please set DISCORD_WEBHOOK_URL in environment variables.`
        }
    }

    const config = useRuntimeConfig()
    const siteUrl = (config.siteUrl || "https://idsimracing.com").replace(/\/$/, "")

    // Inject default bot identity if not provided
    const finalPayload: DiscordPayload = {
        username: payload.username || "idsimracing.com",
        avatar_url: payload.avatar_url || `${siteUrl}/pwa-192x192.png`,
        ...payload
    }

    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(finalPayload)
        })

        if (!response.ok) {
            const errText = await response.text()
            console.error("[Discord Webhook Error]:", response.status, errText)
            return {
                success: false,
                message: `Discord rejected webhook: ${response.status} ${response.statusText}`
            }
        }

        return {
            success: true,
            message: "Discord notification sent successfully!"
        }
    } catch (err: any) {
        console.error("[Discord Webhook Exception]:", err)
        return {
            success: false,
            message: err.message || "Failed to reach Discord webhook endpoint"
        }
    }
}

/**
 * Extracts a YouTube Video ID from common YouTube URL variants.
 */
export const extractYouTubeVideoId = (url?: string | null): string | null => {
    if (!url) return null
    try {
        const parsed = new URL(url)
        if (parsed.hostname.includes("youtu.be")) {
            return parsed.pathname.slice(1).split("?")[0]
        }
        if (parsed.hostname.includes("youtube.com")) {
            if (parsed.pathname.startsWith("/live/")) {
                return parsed.pathname.replace("/live/", "").split("?")[0]
            }
            return parsed.searchParams.get("v")
        }
    } catch {
        return null
    }
    return null
}

/**
 * Formats a date into a Discord timestamp string (e.g., <t:1700000000:F>).
 */
export const formatDiscordTimestamp = (dateStr?: string | null, style: "F" | "R" | "d" | "t" = "F"): string => {
    if (!dateStr) return "TBA"
    const timestamp = Math.floor(new Date(dateStr).getTime() / 1000)
    if (isNaN(timestamp)) return dateStr
    return `<t:${timestamp}:${style}>`
}

/**
 * Milliseconds to lap time format (e.g. 1:42.318).
 */
export const formatLapTime = (ms?: number | null): string => {
    if (!ms || isNaN(ms)) return "-"
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const millis = ms % 1000
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(3, "0")}`
}

/**
 * Converts a 2-letter ISO country code into a native Discord/Unicode flag emoji.
 * e.g., "id" -> "🇮🇩", "jp" -> "🇯🇵", "us" -> "🇺🇸"
 */
export const getCountryFlagEmoji = (countryCode?: string | null): string => {
    if (!countryCode) return ""
    const clean = countryCode.trim().toUpperCase()
    if (clean.length !== 2) return ""
    const first = clean.charCodeAt(0)
    const second = clean.charCodeAt(1)
    if (first < 65 || first > 90 || second < 65 || second > 90) return ""
    return String.fromCodePoint(0x1F1E6 + (first - 65), 0x1F1E6 + (second - 65))
}

