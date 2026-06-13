import { api } from '@core/api.js';

export async function toggleEndpoint(url, currently) {
  if (currently) {
    await api.delete(url);
  } else {
    await api.post(url);
  }
}
