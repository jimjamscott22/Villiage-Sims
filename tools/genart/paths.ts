import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Where generated art is written. Imported by the CLI and the drift test. */
export const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'art');
