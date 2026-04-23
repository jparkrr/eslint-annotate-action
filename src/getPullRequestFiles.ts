import { octokit } from './constants.js'

interface PullRequestFile {
  filename: string
  additions?: number
  patch?: string
}

export type PullRequestChangedLines = Record<string, number[]>

function parsePatch(patch: string): number[] {
  const changedLines: number[] = []
  const lines = patch.split('\n')
  let currentLine = 0

  for (const line of lines) {
    if (line.startsWith('@@')) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
      if (!match) {
        continue
      }
      currentLine = Number.parseInt(match[1], 10)
      continue
    }

    if (!currentLine) {
      continue
    }

    if (line.startsWith('+')) {
      changedLines.push(currentLine)
      currentLine += 1
      continue
    }

    if (line.startsWith('-') || line === '\\ No newline at end of file') {
      continue
    }

    currentLine += 1
  }

  return changedLines
}

/**
 * Returns a map of changed filenames to changed line numbers in a pull request.
 */
export default async function getPullRequestFiles(
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<PullRequestChangedLines> {
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
  })

  return files.reduce<PullRequestChangedLines>((acc, file) => {
    const pullRequestFile = file as PullRequestFile
    if (!pullRequestFile.patch || !pullRequestFile.additions) {
      return acc
    }

    const changedLines = parsePatch(pullRequestFile.patch)
    if (changedLines.length > 0) {
      acc[pullRequestFile.filename] = changedLines
    }

    return acc
  }, {})
}
