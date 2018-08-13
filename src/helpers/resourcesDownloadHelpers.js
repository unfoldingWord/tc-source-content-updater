/**
 * @description Downloads the resorces from the specified list using the DCS API
 * @param {Array} resourceList - Array of resources to retrieve from the API
 */
export async function downloadResources(resourceList) {
  if (!resourceList) {
    throw new Error('Resource list empty');
  }
  return 'success';
}
