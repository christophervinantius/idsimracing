import * as XLSX from 'xlsx'

export const useExportDriversExcel = () => {
    const exportDriversToExcel = (drivers: any[], filename = "Database_Pembalap_IDSimRacing.xlsx") => {
        if (!drivers || drivers.length === 0) return

        const rows = drivers.map((driver, idx) => ({
            "No": idx + 1,
            "Nama Pembalap": driver.name || "-",
            "Tim": driver.teams?.name || (typeof driver.team === 'string' ? driver.team : "-"),
            "Kewarganegaraan": driver.countries?.name || "-",
            "Rating": driver.rating || "-"
        }))

        const worksheet = XLSX.utils.json_to_sheet(rows)
        
        // Auto column widths
        worksheet["!cols"] = [
            { wch: 6 },
            { wch: 30 },
            { wch: 25 },
            { wch: 20 },
            { wch: 12 }
        ]

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pembalap")
        XLSX.writeFile(workbook, filename)
    }

    const downloadDriverTemplate = (filename = "Template_Import_Pembalap.xlsx") => {
        const sampleRows = [
            {
                "No": 1,
                "Nama Pembalap": "Nama Contoh 1",
                "Tim": "ALP01 Sim Racing Team",
                "Kewarganegaraan": "Indonesia",
                "Rating": "Gold"
            },
            {
                "No": 2,
                "Nama Pembalap": "Nama Contoh 2",
                "Tim": "Independent",
                "Kewarganegaraan": "Malaysia",
                "Rating": "Silver"
            }
        ]

        const worksheet = XLSX.utils.json_to_sheet(sampleRows)
        worksheet["!cols"] = [
            { wch: 6 },
            { wch: 30 },
            { wch: 25 },
            { wch: 20 },
            { wch: 12 }
        ]

        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, "Pembalap")
        XLSX.writeFile(workbook, filename)
    }

    const parseDriversFromExcel = async (file: File): Promise<any[]> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer)
                    const workbook = XLSX.read(data, { type: 'array' })
                    const firstSheetName = workbook.SheetNames[0]
                    const worksheet = workbook.Sheets[firstSheetName]
                    const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet)

                    const validRatings = ["Platinum", "Gold", "Silver", "Bronze", "Copper", "Iron"]

                    const parsedList = rawJson.map((row) => {
                        // Find values by possible header aliases
                        const name = row["Nama Pembalap"] || row["Nama"] || row["Name"] || row["Driver"] || row["Pembalap"] || ""
                        const team = row["Tim"] || row["Team"] || row["Nama Tim"] || ""
                        const country = row["Kewarganegaraan"] || row["Negara"] || row["Country"] || row["Nationality"] || "Indonesia"
                        let ratingRaw = row["Rating"] || row["Kelas"] || row["Class"] || "Silver"
                        
                        // Normalize rating
                        let normalizedRating = "Silver"
                        const matchRating = validRatings.find(r => r.toLowerCase() === String(ratingRaw).trim().toLowerCase())
                        if (matchRating) {
                            normalizedRating = matchRating
                        }

                        return {
                            name: String(name).trim(),
                            team: String(team).trim(),
                            country: String(country).trim(),
                            rating: normalizedRating
                        }
                    }).filter(item => Boolean(item.name))

                    resolve(parsedList)
                } catch (err) {
                    reject(err)
                }
            }
            reader.onerror = (err) => reject(err)
            reader.readAsArrayBuffer(file)
        })
    }

    return {
        exportDriversToExcel,
        downloadDriverTemplate,
        parseDriversFromExcel
    }
}
