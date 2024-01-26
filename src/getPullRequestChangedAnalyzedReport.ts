import getPullRequestFiles from './getPullRequestFiles'
import getAnalyzedReport from './getAnalyzedReport'
import type {ESLintReport, AnalyzedESLintReport} from './types'
import constants from './constants'
const {GITHUB_WORKSPACE, OWNER, REPO, pullRequest} = constants

/**
 * Analyzes an ESLint report, separating pull request changed files
 * @param reportJS a JavaScript representation of an ESLint JSON report
 */
export default async function getPullRequestChangedAnalyzedReport(
  reportJS: ESLintReport,
): Promise<AnalyzedESLintReport> {
  const changed = await getPullRequestFiles({
    owner: OWNER,
    repo: REPO,
    pull_number: pullRequest.number,
  })

  const changedFiles = Object.keys(changed)
  // Separate lint reports for PR and non-PR files
  const pullRequestFilesReportJS: ESLintReport = reportJS.reduce((acc, file) => {
    file.filePath = file.filePath.replace(GITHUB_WORKSPACE + '/', '')
    if (changedFiles.includes(file.filePath)) {
      acc.push({
        ...file,
        messages: file.messages.filter((message) => {
          return changed[file.filePath].includes(message.line)
        }),
      })
    }
    return acc
  }, [] as ESLintReport)
  const analyzedPullRequestReport = getAnalyzedReport(pullRequestFilesReportJS)
  const combinedSummary = `
${analyzedPullRequestReport.summary} in pull request changed files.
`
  const combinedMarkdown = `
# Pull Request Changed Lines ESLint Results:
**${analyzedPullRequestReport.summary}**
${analyzedPullRequestReport.markdown}
`
  return {
    errorCount: analyzedPullRequestReport.errorCount,
    warningCount: analyzedPullRequestReport.warningCount,
    markdown: combinedMarkdown,
    success: analyzedPullRequestReport.success,
    summary: combinedSummary,
    annotations: analyzedPullRequestReport.annotations,
  }
}
