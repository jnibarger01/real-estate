import { jsPDF } from 'jspdf';
import type { MarketSummary, Property } from '../types';

function download(data: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
const date = () => new Date().toISOString().slice(0, 10);
export function exportPropertiesCSV(properties: Property[]) {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const headers = ['ZPID', 'Street Address', 'City', 'State', 'Zip Code', 'Price', 'Bedrooms', 'Bathrooms', 'SqFt', 'Price/SqFt', 'Status', 'Property Type', 'Latitude', 'Longitude'];
  const rows = properties.map(p => [p.zpid, p.address.street, p.address.city, p.address.state, p.address.zipCode, p.price, p.bedrooms, p.bathrooms, p.livingAreaSqFt, p.pricePerSqFt, p.status, p.propertyType, p.address.lat, p.address.lng].map(quote).join(','));
  download([headers.join(','), ...rows].join('\n'), 'text/csv;charset=utf-8', `kansas_city_properties_${date()}.csv`);
}
export function exportPropertiesJSON(properties: Property[]) { download(JSON.stringify(properties, null, 2), 'application/json', `kansas_city_properties_${date()}.json`); }
export function exportMarketSummary(properties: Property[], summary: MarketSummary) {
  const pdf = new jsPDF(); pdf.setFontSize(18); pdf.text('KC Real Estate Explorer', 14, 20); pdf.setFontSize(11);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, 14, 29); pdf.text(`Properties: ${properties.length}  Median listing price: $${summary.medianListingPrice.toLocaleString()}`, 14, 37);
  properties.slice(0, 25).forEach((p, index) => pdf.text(`${index + 1}. ${p.address.street} — $${p.price.toLocaleString()} · ${p.bedrooms} bd · ${p.bathrooms} ba`, 14, 48 + index * 7));
  pdf.save(`kansas_city_market_summary_${date()}.pdf`);
}
