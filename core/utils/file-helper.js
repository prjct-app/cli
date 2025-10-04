const fs = require('fs').promises
const path = require('path')

/**
 * File Helper - Centralized file operations with error handling
 *
 * Eliminates duplicated fs operations across:
 * - 101 fs.readFile/writeFile calls in 18 files
 * - Consistent error handling
 * - JSON read/write patterns
 *
 * @module file-helper
 */

/**
 * Read JSON file and parse
 *
 * @param {string} filePath - Path to JSON file
 * @param {*} defaultValue - Default value if file doesn't exist (default: null)
 * @returns {Promise<Object|*>} - Parsed JSON or default value
 */
async function readJson(filePath, defaultValue = null) {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue
    }
    throw error
  }
}

/**
 * Write object to JSON file (pretty-printed)
 *
 * @param {string} filePath - Path to JSON file
 * @param {Object} data - Data to write
 * @param {number} indent - Indentation spaces (default: 2)
 * @returns {Promise<void>}
 */
async function writeJson(filePath, data, indent = 2) {
  const content = JSON.stringify(data, null, indent)
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Read text file
 *
 * @param {string} filePath - Path to file
 * @param {string} defaultValue - Default value if file doesn't exist (default: '')
 * @returns {Promise<string>} - File content or default value
 */
async function readFile(filePath, defaultValue = '') {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      return defaultValue
    }
    throw error
  }
}

/**
 * Write text file
 *
 * @param {string} filePath - Path to file
 * @param {string} content - Content to write
 * @returns {Promise<void>}
 */
async function writeFile(filePath, content) {
  await fs.writeFile(filePath, content, 'utf-8')
}

/**
 * Append to text file
 *
 * @param {string} filePath - Path to file
 * @param {string} content - Content to append
 * @returns {Promise<void>}
 */
async function appendToFile(filePath, content) {
  await fs.appendFile(filePath, content, 'utf-8')
}

/**
 * Prepend to text file (adds content at beginning)
 *
 * @param {string} filePath - Path to file
 * @param {string} content - Content to prepend
 * @returns {Promise<void>}
 */
async function prependToFile(filePath, content) {
  try {
    const existing = await fs.readFile(filePath, 'utf-8')
    await fs.writeFile(filePath, content + existing, 'utf-8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, content, 'utf-8')
    } else {
      throw error
    }
  }
}

/**
 * Check if file exists
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} - True if file exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Check if directory exists
 *
 * @param {string} dirPath - Path to directory
 * @returns {Promise<boolean>} - True if directory exists
 */
async function dirExists(dirPath) {
  try {
    const stats = await fs.stat(dirPath)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * Ensure directory exists (create if not)
 *
 * @param {string} dirPath - Path to directory
 * @returns {Promise<void>}
 */
async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

/**
 * Delete file if it exists
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} - True if file was deleted
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false // File didn't exist
    }
    throw error
  }
}

/**
 * Delete directory and all contents
 *
 * @param {string} dirPath - Path to directory
 * @returns {Promise<boolean>} - True if directory was deleted
 */
async function deleteDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
    return true
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}

/**
 * List files in directory
 *
 * @param {string} dirPath - Path to directory
 * @param {Object} options - Options
 * @param {boolean} options.filesOnly - Only return files (not directories)
 * @param {boolean} options.dirsOnly - Only return directories
 * @param {string} options.extension - Filter by file extension (e.g., '.md')
 * @returns {Promise<Array<string>>} - Array of filenames
 */
async function listFiles(dirPath, options = {}) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    let files = entries

    if (options.filesOnly) {
      files = files.filter((entry) => entry.isFile())
    }

    if (options.dirsOnly) {
      files = files.filter((entry) => entry.isDirectory())
    }

    if (options.extension) {
      files = files.filter((entry) => entry.name.endsWith(options.extension))
    }

    return files.map((entry) => entry.name)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }
}

/**
 * Get file size in bytes
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<number>} - File size in bytes
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath)
  return stats.size
}

/**
 * Get file modification time
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<Date>} - Last modification time
 */
async function getFileModifiedTime(filePath) {
  const stats = await fs.stat(filePath)
  return stats.mtime
}

/**
 * Copy file
 *
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {Promise<void>}
 */
async function copyFile(sourcePath, destPath) {
  await fs.copyFile(sourcePath, destPath)
}

/**
 * Move/rename file
 *
 * @param {string} oldPath - Current file path
 * @param {string} newPath - New file path
 * @returns {Promise<void>}
 */
async function moveFile(oldPath, newPath) {
  await fs.rename(oldPath, newPath)
}

/**
 * Read file and split into lines
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<Array<string>>} - Array of lines
 */
async function readLines(filePath) {
  const content = await readFile(filePath, '')
  return content.split('\n')
}

/**
 * Write lines to file
 *
 * @param {string} filePath - Path to file
 * @param {Array<string>} lines - Array of lines
 * @returns {Promise<void>}
 */
async function writeLines(filePath, lines) {
  const content = lines.join('\n')
  await writeFile(filePath, content)
}

/**
 * Get file extension
 *
 * @param {string} filePath - Path to file
 * @returns {string} - File extension (e.g., '.md')
 */
function getFileExtension(filePath) {
  return path.extname(filePath)
}

/**
 * Get filename without extension
 *
 * @param {string} filePath - Path to file
 * @returns {string} - Filename without extension
 */
function getFileNameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath))
}

module.exports = {
  readJson,
  writeJson,
  readFile,
  writeFile,
  appendToFile,
  prependToFile,
  fileExists,
  dirExists,
  ensureDir,
  deleteFile,
  deleteDir,
  listFiles,
  getFileSize,
  getFileModifiedTime,
  copyFile,
  moveFile,
  readLines,
  writeLines,
  getFileExtension,
  getFileNameWithoutExtension,
}
