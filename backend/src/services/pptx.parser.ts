import AdmZip from "adm-zip"

function decodeXmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

export async function parsePptx(filePath: string): Promise<{ slideNumber: number; text: string }[]> {
  const zip = new AdmZip(filePath)
  const zipEntries = zip.getEntries()

  const slides: { slideNumber: number; xmlContent: string }[] = []

  for (const entry of zipEntries) {
    const match = entry.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/)
    if (match) {
      const slideNumber = parseInt(match[1], 10)
      const xmlContent = entry.getData().toString("utf8")
      slides.push({ slideNumber, xmlContent })
    }
  }

  // Sort slides numerically by slide number
  slides.sort((a, b) => a.slideNumber - b.slideNumber)

  const parsedSlides = slides.map((slide) => {
    const paragraphRegex = /<a:p\b[^>]*>(.*?)<\/a:p>/gs
    let match: RegExpExecArray | null
    const paragraphs: string[] = []

    while ((match = paragraphRegex.exec(slide.xmlContent)) !== null) {
      const paragraphXml = match[1]
      const textRegex = /<a:t\b[^>]*>(.*?)<\/a:t>/gs
      let textMatch: RegExpExecArray | null
      let paragraphText = ""

      while ((textMatch = textRegex.exec(paragraphXml)) !== null) {
        paragraphText += decodeXmlEntities(textMatch[1])
      }

      if (paragraphText.trim()) {
        paragraphs.push(paragraphText.trim())
      }
    }

    return {
      slideNumber: slide.slideNumber,
      text: paragraphs.join("\n"),
    }
  })

  return parsedSlides
}
