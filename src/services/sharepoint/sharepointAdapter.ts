/**
 * SharePoint Adapter Interface — Phase T21
 *
 * Defines the contract that all SharePoint backend implementations must satisfy.
 * Consumers depend only on this interface — never on a concrete adapter.
 *
 * Implementations:
 *   - LocalSharePointAdapter  (LOCAL mode) — reads/writes from /mock-sharepoint/
 *   - GraphSharePointAdapter  (GRAPH mode) — Microsoft Graph API (stub, not yet implemented)
 *
 * Governance:
 *   - Pure async I/O contract. No business logic, no state.
 *   - All paths use forward slashes and are relative to the adapter's configured root.
 *   - Buffer is the canonical transport type for file content.
 *   - Implementations must be stateless and deterministic given the same inputs.
 */
export interface SharePointAdapter {
  /**
   * Retrieve a file at the given path.
   * Throws if the file does not exist or cannot be read.
   *
   * @param path - Relative path within the SharePoint root (e.g. "EMIP/Drawings/doc.pdf")
   */
  getFile(path: string): Promise<Buffer>;

  /**
   * List file names (not full paths) within a folder.
   * Returns an empty array if the folder is empty or does not exist.
   *
   * @param folder - Relative folder path (e.g. "EMIP/Tooling")
   */
  listFiles(folder: string): Promise<string[]>;

  /**
   * Upload (create or overwrite) a file at the given path.
   * Creates any missing parent directories automatically.
   *
   * @param path    - Relative path within the SharePoint root (e.g. "EMIP/Exports/report.csv")
   * @param content - Raw file content as a Buffer
   */
  uploadFile(path: string, content: Buffer): Promise<void>;
}
