import fetch from 'node-fetch';
import { config } from 'dotenv';

config(); // Load environment variables

const API_URL = process.env.API_URL || 'http://localhost:3000';

(async () => {
  try {
    console.log('Starting backfill process via API...');
    const response = await fetch(`${API_URL}/api/backfill-tokens`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Backfill process completed successfully:', result);
  } catch (error) {
    console.error('Error during backfill process:', error);
  }
})();