export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig()
    const siteUrl = (config.siteUrl || "https://idsimracing.com").replace(/\/$/, "")

    const embed: DiscordEmbed = {
        title: "✅ Discord Webhook Connected",
        description: "Your ID Sim Racing website is successfully configured to send notifications to this channel!",
        color: BRAND_COLOR,
        fields: [
            {
                name: "Website URL",
                value: `[${siteUrl}](${siteUrl})`,
                inline: true
            },
            {
                name: "Notification Capabilities",
                value: "• 🏁 Weekly Race Schedules\n• 🔴 Live Stream Alerts\n• 🏆 Official Race Results",
                inline: false
            }
        ],
        footer: {
            text: "ID Sim Racing Notification System"
        },
        timestamp: new Date().toISOString()
    }

    const res = await sendDiscordWebhook("default", {
        embeds: [embed]
    })

    if (!res.success) {
        throw createError({
            statusCode: 400,
            statusMessage: res.message
        })
    }

    return res
})
