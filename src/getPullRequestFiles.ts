import type {prFilesParametersType, prFilesResponseType} from './types'
import constants from './constants'
const {octokit} = constants

interface PatchEntry {
  additions: number
  patch?: string
  filename: string
}

interface LineDictionary {
  [filename: string]: string[][]
}

function parsePatchData(patchData: PatchEntry[]): LineDictionary {
  const finalDict: LineDictionary = {}
  for (const entry of patchData) {
    if (entry.additions !== 0 && entry.patch) {
      // console.log('entry', entry)
      let patchArray = entry.patch.split('\n')
      // clean patch array
      patchArray = patchArray.filter((i) => i)
      const lineArray: string[][] = []
      let sublist: string[] = []
      for (const item of patchArray) {
        // Grabs hunk annotation and strips out added lines
        if (item.startsWith('@@ -')) {
          if (sublist.length > 0) {
            lineArray.push(sublist)
          }
          sublist = [item.split('+')[1].replace(/@@.*/, '').trim()]
          // We don't need removed lines ('-')
        } else if (!item.startsWith('-') && item !== '\\ No newline at end of file') {
          sublist.push(item)
        }
      }
      if (sublist.length > 0) {
        lineArray.push(sublist)
        finalDict[entry.filename] = lineArray
      }
    }
  }
  return finalDict
}

interface LineNumberDictionary {
  [filename: string]: number[]
}

function getLines(lineDict: LineDictionary): LineNumberDictionary {
  const finalDict: LineNumberDictionary = {}
  for (const [file_name, sublist] of Object.entries(lineDict)) {
    const lineArray: number[] = []
    for (const array of sublist) {
      let line_number = 0
      if (!array[0].includes(',')) {
        line_number = parseInt(array[0], 10) - 1
      } else {
        line_number = parseInt(array[0].split(',')[0], 10) - 1
      }
      for (const line of array) {
        if (line.startsWith('+')) {
          lineArray.push(line_number)
        }
        line_number++
      }
    }
    // Remove deleted/renamed files (which appear as empty arrays)
    if (lineArray.length > 0) {
      finalDict[file_name] = lineArray
    }
  }
  return finalDict
}

/**
 * Get an array of files changed in a pull request
 * @param options the parameters for octokit.pulls.listFiles
 */
export default async function getPullRequestFiles(options: prFilesParametersType): Promise<LineNumberDictionary> {
  try {
    // https://developer.github.com/v3/pulls/#list-pull-requests-files
    // https://octokit.github.io/rest.js/v18#pulls-list-files
    // https://octokit.github.io/rest.js/v18#pagination
    const prFiles: prFilesResponseType['data'] = await octokit.paginate(
      'GET /repos/:owner/:repo/pulls/:pull_number/files',
      options,
    )
    const addedLineData = parsePatchData(prFiles)
    const addedLines = getLines(addedLineData)
    return Promise.resolve(addedLines)
  } catch (error) {
    return Promise.reject(error)
  }
}
