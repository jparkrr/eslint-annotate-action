import { setTimeout as delay } from 'node:timers/promises'
import constants, { octokit } from './constants.js'
import type { CheckUpdateParams, CheckUpdateData } from './types.js'

const RETRY_DELAYS_MS = [500, 1000, 2000]

/**
 * GitHub can briefly return 404 when updating the check this action just created.
 * Give it time to become available, while still surfacing persistent failures.
 */
const updateStatusCheck = async (options: CheckUpdateParams): Promise<CheckUpdateData> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await octokit.rest.checks.update(options)
      return response.data
    } catch (error) {
      const retryDelay = RETRY_DELAYS_MS[attempt]
      if (
        typeof error !== 'object' ||
        error === null ||
        !('status' in error) ||
        error.status !== 404 ||
        retryDelay === undefined
      ) {
        throw error
      }

      constants.core.info(
        `GitHub has not made check ${options.check_run_id} available yet; retrying in ${retryDelay}ms.`,
      )
      await delay(retryDelay)
    }
  }
}

export default updateStatusCheck
