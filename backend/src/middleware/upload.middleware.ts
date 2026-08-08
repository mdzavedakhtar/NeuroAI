import multer, { FileFilterCallback } from "multer"
import path from "path"
import fs from "fs"
import { Request } from "express"

// -----------------------------------------------------
// Upload directory
// -----------------------------------------------------

const uploadDirectory = path.join(
  process.cwd(),
  "uploads",
  "knowledge"
)

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, {
    recursive: true,
  })
}

// -----------------------------------------------------
// Storage configuration
// -----------------------------------------------------

const storage = multer.diskStorage({
  destination: (
    _req,
    _file,
    callback
  ) => {
    callback(null, uploadDirectory)
  },

  filename: (
    _req,
    file,
    callback
  ) => {
    const extension = path.extname(
      file.originalname
    )

    const safeBaseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 80)

    const uniqueName =
      `${Date.now()}-${Math.round(
        Math.random() * 1e9
      )}-${safeBaseName}${extension}`

    callback(null, uniqueName)
  },
})

// -----------------------------------------------------
// Allowed file types
// -----------------------------------------------------

const allowedMimeTypes = new Set([
  // PDF
  "application/pdf",

  // DOCX
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // PowerPoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

// -----------------------------------------------------
// File filter
// -----------------------------------------------------

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback
) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    callback(
      new Error(
        "Unsupported file type. Only PDF, DOCX, PPTX and XLSX files are allowed."
      )
    )

    return
  }

  callback(null, true)
}

// -----------------------------------------------------
// Multer configuration
// -----------------------------------------------------

export const knowledgeUpload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },

  fileFilter,
})