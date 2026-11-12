import { jest } from '@jest/globals'
import type { CheckAnnotation, CheckUpdateParams } from '../types.js'

const mockUpdate = jest.fn<(options: CheckUpdateParams) => Promise<{ data: { id: number } }>>()
const mockDelay = jest.fn<(milliseconds: number) => Promise<void>>()

jest.unstable_mockModule('node:timers/promises', () => ({ setTimeout: mockDelay }))
jest.unstable_mockModule('../constants.js', () => ({
  default: {
    OWNER: 'jparkrr',
    REPO: 'eslint-annotate-action',
    core: { info: jest.fn() },
    checkName: 'ESLint Report Analysis',
  },
  octokit: { rest: { checks: { update: mockUpdate } } },
}))

const { default: updateStatusCheck } = await import('../updateStatusCheck.js')
const { default: addAnnotationsToStatusCheck } = await import('../addAnnotationsToStatusCheck.js')

const options: CheckUpdateParams = {
  owner: 'jparkrr',
  repo: 'eslint-annotate-action',
  check_run_id: 123,
  status: 'in_progress',
}

describe('updateStatusCheck', () => {
  beforeEach(() => {
    mockUpdate.mockReset()
    mockUpdate.mockResolvedValue({ data: { id: 123 } })
    mockDelay.mockReset()
    mockDelay.mockResolvedValue(undefined)
  })

  it('updates an available check without a delay', async () => {
    await expect(updateStatusCheck(options)).resolves.toEqual({ id: 123 })

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockDelay).not.toHaveBeenCalled()
  })

  it('retries transient 404s with increasing delays', async () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 })
    mockUpdate.mockRejectedValueOnce(error).mockRejectedValueOnce(error)

    await expect(updateStatusCheck(options)).resolves.toEqual({ id: 123 })

    expect(mockUpdate.mock.calls).toEqual([[options], [options], [options]])
    expect(mockDelay.mock.calls).toEqual([[500], [1000]])
  })

  it('returns the original error after three retries', async () => {
    const error = Object.assign(new Error('Not Found'), { status: 404 })
    mockUpdate.mockRejectedValue(error)

    await expect(updateStatusCheck(options)).rejects.toBe(error)

    expect(mockUpdate).toHaveBeenCalledTimes(4)
    expect(mockDelay.mock.calls).toEqual([[500], [1000], [2000]])
  })

  it('does not retry permission failures or ambiguous server failures', async () => {
    for (const status of [403, 500, 503]) {
      const error = Object.assign(new Error('Request failed'), { status })
      mockUpdate.mockRejectedValueOnce(error)

      await expect(updateStatusCheck(options)).rejects.toBe(error)
    }

    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockDelay).not.toHaveBeenCalled()
  })

  it('does not retry errors without an HTTP status', async () => {
    const error = new Error('Connection lost')
    mockUpdate.mockRejectedValueOnce(error)

    await expect(updateStatusCheck(options)).rejects.toBe(error)

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    expect(mockDelay).not.toHaveBeenCalled()
  })

  it('retries only the failed annotation batch', async () => {
    const annotation: CheckAnnotation = {
      path: 'src/index.ts',
      start_line: 1,
      end_line: 1,
      annotation_level: 'warning',
      message: 'Example lint warning',
    }
    const annotations = Array.from({ length: 51 }, () => annotation)
    mockUpdate
      .mockResolvedValueOnce({ data: { id: 123 } })
      .mockRejectedValueOnce(Object.assign(new Error('Not Found'), { status: 404 }))

    await addAnnotationsToStatusCheck(annotations, 123)

    expect(mockUpdate).toHaveBeenCalledTimes(3)
    expect(mockUpdate.mock.calls[0][0].output?.annotations).toHaveLength(50)
    expect(mockUpdate.mock.calls[1][0].output?.annotations).toHaveLength(1)
    expect(mockUpdate.mock.calls[2]).toEqual(mockUpdate.mock.calls[1])
    expect(mockDelay.mock.calls).toEqual([[500]])
    expect(annotations).toHaveLength(51)
  })
})
