import { jest } from '@jest/globals'

const mockPaginate = jest.fn()
const mockListFiles = jest.fn()

jest.unstable_mockModule('../constants.js', () => ({
  default: {
    GITHUB_WORKSPACE: '',
    OWNER: 'ataylorme',
    REPO: 'eslint-annotate-github-action',
    pullRequest: { number: 3, head: { sha: '8e80ec28fec6ef9763aacbabb452bcb5d92315ca' } },
    onlyChangedFiles: true,
    failOnWarning: false,
    unusedDirectiveMessagePrefix: 'Unused eslint-disable directive',
    core: { info: jest.fn(), setFailed: jest.fn() },
    checkName: 'ESLint Report Analysis',
  },
  octokit: {
    paginate: mockPaginate,
    rest: { pulls: { listFiles: mockListFiles } },
  },
}))

const { default: getPullRequestFiles } = await import('../getPullRequestFiles.js')

describe('getPullRequestFiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns changed line numbers from the GitHub API response', async () => {
    const mockFiles = [
      {
        filename: 'src/app.ts',
        additions: 3,
        patch: '@@ -1,3 +1,4 @@\n line 1\n-line 2\n+line 2 changed\n line 3\n+line 4',
      },
      {
        filename: 'src/utils.ts',
        additions: 1,
        patch: '@@ -10,2 +10,3 @@\n line 10\n+line 11\n line 12',
      },
      { filename: 'README.md', additions: 0 },
    ]
    mockPaginate.mockResolvedValue(mockFiles)

    const result = await getPullRequestFiles('ataylorme', 'eslint-annotate-github-action', 3)

    expect(result).toEqual({
      'src/app.ts': [2, 4],
      'src/utils.ts': [11],
    })
    expect(mockPaginate).toHaveBeenCalledWith(mockListFiles, {
      owner: 'ataylorme',
      repo: 'eslint-annotate-github-action',
      pull_number: 3,
    })
  })

  it('returns an empty object when the PR has no changed files with patches', async () => {
    mockPaginate.mockResolvedValue([])

    const result = await getPullRequestFiles('ataylorme', 'eslint-annotate-github-action', 99)
    expect(result).toEqual({})
  })

  it('propagates API errors', async () => {
    mockPaginate.mockRejectedValue(new Error('Not Found'))

    await expect(getPullRequestFiles('ataylorme', 'eslint-annotate-github-action', 999)).rejects.toThrow('Not Found')
  })
})
