// This service provides platform-specific functionalities.
// FIX: Dynamically import 'invoke' to prevent module loading errors in web browsers.
// The static import 'import { invoke } from '@tauri-apps/api/tauri';' is removed from the top level.


// Augment the Window interface to include the API exposed by Tauri.
// declare global {
//   interface Window {
//     __TAURI__: object;
//   }
// }

/**
 * Checks if the application is running inside Tauri.
 * @returns {boolean} True if in Tauri, false otherwise.
 */
export const isDesktop = (): boolean => {
  // @ts-ignore
  return typeof window !== 'undefined' && typeof window.__TAURI__ !== 'undefined';
};

/**
 * Saves a file using the best method for the current platform.
 * In Tauri, it opens a native "Save As..." dialog.
 * In the browser, it triggers a standard download link.
 * @param {string} fileName - The default name for the file.
 * @param {Uint8Array} fileBuffer - The content of the file as a buffer.
 */
export const saveFile = async (fileName: string, fileBuffer: Uint8Array): Promise<void> => {
  if (isDesktop()) {
    // Use Tauri's native save dialog by invoking the Rust command
    try {
      // Dynamically import 'invoke' only when needed in the Tauri context.
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      // NOTE: We must convert the Uint8Array to a regular array of numbers
      // because the data needs to be JSON-serializable to pass to the Rust backend.
      const bufferAsArray = Array.from(fileBuffer);
      
      await invoke('save_file', {
        fileName,
        fileBuffer: bufferAsArray,
      });
    } catch (error) {
       console.error('Failed to save file on desktop:', error);
       alert(`Error saving file: ${error}`);
    }
  } else {
    // Use the standard web download method
    const blob = new Blob([fileBuffer as any]);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }
};