/**
 * Graph SharePoint Adapter — Phase T21 (STUB)
 *
 * Future implementation using the Microsoft Graph API.
 * Currently throws on every call — active when SHAREPOINT_MODE=GRAPH.
 *
 * Implementation checklist (for when this is activated):
 *   - Register an Azure AD application and grant Sites.ReadWrite.All scope.
 *   - Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET in environment.
 *   - Set SHAREPOINT_SITE_URL to the target SharePoint site.
 *   - Replace the throw stubs below with @microsoft/microsoft-graph-client calls.
 *
 * Governance:
 *   - Do NOT implement Graph API calls until the Azure AD app is registered.
 *   - Do NOT store credentials in code — use environment variables only.
 *   - All throws must use the exact message prefix "[GraphSharePointAdapter]" for
 *     easy grep and log filtering.
 */

import type { SharePointAdapter } from './sharepointAdapter';

export class GraphSharePointAdapter implements SharePointAdapter {
  async getFile(_path: string): Promise<Buffer> {
    throw new Error('[GraphSharePointAdapter] Graph adapter not implemented yet');
  }

  async listFiles(_folder: string): Promise<string[]> {
    throw new Error('[GraphSharePointAdapter] Graph adapter not implemented yet');
  }

  async uploadFile(_path: string, _content: Buffer): Promise<void> {
    throw new Error('[GraphSharePointAdapter] Graph adapter not implemented yet');
  }
}
