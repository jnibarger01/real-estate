import type { Property } from '../types';

export function propertyPlaceholder(property: Pick<Property, 'address' | 'propertyType'>): string {
  const seed = Array.from(`${property.propertyType}:${property.address.street}`).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 0);
  const hue = seed % 360;
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="hsl(${hue} 45% 35%)"/><stop offset="1" stop-color="hsl(${(hue + 45) % 360} 55% 62%)"/></linearGradient></defs><rect width="800" height="450" fill="url(#g)"/><path d="M210 330v-110l190-125 190 125v110h-95v-80h-190v80z" fill="white" fill-opacity=".85"/><text x="400" y="405" text-anchor="middle" font-family="Arial" font-size="24" fill="white">Listing photo unavailable</text></svg>`)}`;
}
