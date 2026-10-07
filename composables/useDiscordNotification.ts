export const useDiscordNotification = () => {
    const isSending = ref(false)
    const lastError = ref<string | null>(null)

    /**
     * Send live stream notification to Discord
     */
    const sendStreamAlert = async (scheduleId: string, options?: { message?: string; pingEveryone?: boolean }) => {
        isSending.value = true
        lastError.value = null
        try {
            const res = await $fetch<{ success: boolean; message: string }>("/api/discord/stream-alert", {
                method: "POST",
                body: {
                    scheduleId,
                    message: options?.message,
                    pingEveryone: options?.pingEveryone
                }
            })
            return res
        } catch (err: any) {
            const msg = err?.data?.statusMessage || err?.message || "Failed to send stream alert"
            lastError.value = msg
            throw new Error(msg)
        } finally {
            isSending.value = false
        }
    }

    /**
     * Send official race results notification to Discord
     */
    const sendRaceResults = async (scheduleId: string, sessionType: string = "race") => {
        isSending.value = true
        lastError.value = null
        try {
            const res = await $fetch<{ success: boolean; message: string }>("/api/discord/race-results", {
                method: "POST",
                body: {
                    scheduleId,
                    sessionType
                }
            })
            return res
        } catch (err: any) {
            const msg = err?.data?.statusMessage || err?.message || "Failed to send race results"
            lastError.value = msg
            throw new Error(msg)
        } finally {
            isSending.value = false
        }
    }

    /**
     * Post this week's race schedule digest to Discord
     */
    const sendWeeklySchedule = async (options?: { startDate?: string; endDate?: string }) => {
        isSending.value = true
        lastError.value = null
        try {
            const res = await $fetch<{ success: boolean; count: number; message: string }>("/api/discord/weekly-schedule", {
                method: "POST",
                body: options
            })
            return res
        } catch (err: any) {
            const msg = err?.data?.statusMessage || err?.message || "Failed to post weekly schedule"
            lastError.value = msg
            throw new Error(msg)
        } finally {
            isSending.value = false
        }
    }

    /**
     * Test Discord webhook connection
     */
    const testDiscordConnection = async () => {
        isSending.value = true
        lastError.value = null
        try {
            const res = await $fetch<{ success: boolean; message: string }>("/api/discord/test", {
                method: "POST"
            })
            return res
        } catch (err: any) {
            const msg = err?.data?.statusMessage || err?.message || "Failed to connect to Discord"
            lastError.value = msg
            throw new Error(msg)
        } finally {
            isSending.value = false
        }
    }

    return {
        isSending,
        lastError,
        sendStreamAlert,
        sendRaceResults,
        sendWeeklySchedule,
        testDiscordConnection
    }
}
