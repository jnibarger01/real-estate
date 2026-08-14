/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Property } from '../types';
import { PriceHistoryD3Chart } from './PriceHistoryD3Chart';
import { 
  X, 
  MapPin, 
  Bed, 
  Bath, 
  Maximize2, 
  Calendar, 
  Clock, 
  DollarSign, 
  Calculator, 
  GraduationCap, 
  Building2, 
  ShieldCheck, 
  Share2, 
  Heart,
  TrendingDown,
  Info
} from 'lucide-react';

interface PropertyDetailDrawerProps {
  isOpen: boolean;
  property: Property | null;
  onClose: () => void;
}

export const PropertyDetailDrawer: React.FC<PropertyDetailDrawerProps> = ({
  isOpen,
  property,
  onClose,
}) => {
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  // Mortgage Calculator State
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [interestRatePct, setInterestRatePct] = useState(6.8);
  const [loanTermYears, setLoanTermYears] = useState(30);

  if (!isOpen || !property) return null;

  // Calculate Payment
  const principal = property.price * (1 - downPaymentPct / 100);
  const monthlyInterestRate = interestRatePct / 100 / 12;
  const totalPayments = loanTermYears * 12;

  const monthlyPrincipalAndInterest =
    monthlyInterestRate > 0
      ? Math.round((principal * (monthlyInterestRate * Math.pow(1 + monthlyInterestRate, totalPayments))) / (Math.pow(1 + monthlyInterestRate, totalPayments) - 1))
      : Math.round(principal / totalPayments);

  const estimatedPropertyTaxMonthly = Math.round((property.price * 0.012) / 12);
  const estimatedInsuranceMonthly = Math.round((property.price * 0.0035) / 12);
  const hoaMonthly = property.hoaFee || 0;
  const totalMonthlyPayment = monthlyPrincipalAndInterest + estimatedPropertyTaxMonthly + estimatedInsuranceMonthly + hoaMonthly;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity overflow-hidden">
      <div className="bg-[#f8f7f2] w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-[#d6d1c4] overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header Bar */}
        <div className="bg-[#2d3748] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#d69e2e]" />
            <div>
              <h2 className="font-semibold text-sm line-clamp-1">{property.address.street}</h2>
              <p className="text-[11px] text-gray-300">{property.address.city}, {property.address.state} {property.address.zipCode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs text-[#2d3748]">
          {/* Main Image Gallery */}
          <div className="space-y-2">
            <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 shadow-sm relative">
              <img
                src={property.images[activeImageIdx] || property.images[0]}
                alt={property.address.street}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-3 left-3 bg-[#2d3748]/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/20">
                {property.status.replace('_', ' ').toUpperCase()}
              </span>
              {property.priceReduced && (
                <span className="absolute top-3 right-3 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Price Reduced by ${property.priceReductionAmount?.toLocaleString()}
                </span>
              )}
            </div>

            {/* Thumbnail Row */}
            {property.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {property.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIdx(idx)}
                    className={`w-16 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                      activeImageIdx === idx ? 'border-[#2b6cb0] ring-2 ring-[#2b6cb0]/20' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumb" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pricing & Zestimates */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold text-[#1a202c]">
                ${property.price.toLocaleString()}
              </div>
              <div className="text-[#718096] text-xs mt-0.5">
                ${property.pricePerSqFt} / sq ft • Listed {property.dateListed}
              </div>
            </div>

            <div className="flex gap-4 border-l pl-4 border-gray-200">
              {property.zestimate && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">Zestimate®</div>
                  <div className="font-bold text-gray-800 text-sm">${property.zestimate.toLocaleString()}</div>
                </div>
              )}
              {property.rentZestimate && (
                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400">Rent Zestimate®</div>
                  <div className="font-bold text-gray-800 text-sm">${property.rentZestimate.toLocaleString()}/mo</div>
                </div>
              )}
            </div>
          </div>

          {/* Key Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white p-3 rounded-xl border border-[#e5e2d9]">
              <div className="font-bold text-base text-[#1a202c]">{property.bedrooms}</div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">Bedrooms</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e5e2d9]">
              <div className="font-bold text-base text-[#1a202c]">{property.bathrooms}</div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">Bathrooms</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e5e2d9]">
              <div className="font-bold text-base text-[#1a202c]">{property.livingAreaSqFt.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">Living SqFt</div>
            </div>
            <div className="bg-white p-3 rounded-xl border border-[#e5e2d9]">
              <div className="font-bold text-base text-[#1a202c]">{property.yearBuilt}</div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold mt-0.5">Year Built</div>
            </div>
          </div>

          {/* Detailed Features & Characteristics */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] space-y-3">
            <h3 className="font-semibold text-xs text-[#1a202c] uppercase tracking-wider">
              Property Overview & Features
            </h3>
            <p className="text-gray-600 text-xs leading-relaxed">{property.description}</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">Property Type:</span> {property.propertyType}
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">Days on Zillow:</span> {property.daysOnMarket} days
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">HOA Fee:</span> ${property.hoaFee || 0}/mo
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">Garage:</span> {property.features.garage ? 'Yes' : 'No'}
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">Pool:</span> {property.features.pool ? 'Yes' : 'No'}
              </div>
              <div className="flex items-center gap-1.5 text-gray-700">
                <span className="font-semibold">Waterfront:</span> {property.features.waterfront ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {/* Mortgage Payment Calculator */}
          <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs text-[#1a202c] uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-[#2b6cb0]" />
                Estimated Monthly Payment
              </h3>
              <div className="text-base font-bold text-[#2b6cb0]">${totalMonthlyPayment.toLocaleString()}/mo</div>
            </div>

            <div className="space-y-3 bg-[#f8f7f2] p-3 rounded-xl border border-[#e5e2d9]">
              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>Down Payment ({downPaymentPct}%)</span>
                  <span className="font-semibold text-gray-800">${(property.price * downPaymentPct / 100).toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={downPaymentPct}
                  onChange={(e) => setDownPaymentPct(Number(e.target.value))}
                  className="w-full accent-[#2b6cb0]"
                />
              </div>

              <div>
                <div className="flex justify-between text-gray-600 mb-1">
                  <span>Interest Rate ({interestRatePct}%)</span>
                  <span className="font-semibold text-gray-800">30-Year Fixed</span>
                </div>
                <input
                  type="range"
                  min="3.0"
                  max="10.0"
                  step="0.1"
                  value={interestRatePct}
                  onChange={(e) => setInterestRatePct(Number(e.target.value))}
                  className="w-full accent-[#2b6cb0]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] border-t border-[#e5e2d9]">
                <div>
                  <span className="text-gray-500 block">Principal & Int.</span>
                  <span className="font-bold text-gray-800">${monthlyPrincipalAndInterest.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Property Tax</span>
                  <span className="font-bold text-gray-800">${estimatedPropertyTaxMonthly.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Home Insurance</span>
                  <span className="font-bold text-gray-800">${estimatedInsuranceMonthly.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">HOA Fees</span>
                  <span className="font-bold text-gray-800">${hoaMonthly.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* D3 Price History Chart */}
          <PriceHistoryD3Chart property={property} />

          {/* Price History Table */}
          {property.priceHistory && property.priceHistory.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] space-y-3">
              <h3 className="font-semibold text-xs text-[#1a202c] uppercase tracking-wider">
                Price & Sale History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                      <th className="py-2 px-1">Date</th>
                      <th className="py-2 px-1">Event</th>
                      <th className="py-2 px-1">Price</th>
                      <th className="py-2 px-1">Change</th>
                      <th className="py-2 px-1">Source</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {property.priceHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium">{item.date}</td>
                        <td className="py-2 px-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.event === 'Sold' ? 'bg-blue-100 text-blue-800' :
                            item.event === 'Price Change' ? 'bg-amber-100 text-amber-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.event}
                          </span>
                        </td>
                        <td className="py-2 px-1 font-bold text-gray-900">${item.price.toLocaleString()}</td>
                        <td className="py-2 px-1">
                          {item.priceChange ? (
                            <span className={item.priceChange < 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                              {item.priceChange < 0 ? '' : '+'}${item.priceChange.toLocaleString()} ({item.priceChangePct}%)
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2 px-1 text-gray-400 text-[11px]">{item.source || 'Zillow MCP'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tax History Table */}
          {property.taxHistory && property.taxHistory.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] space-y-3">
              <h3 className="font-semibold text-xs text-[#1a202c] uppercase tracking-wider">
                Public Tax History
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500 text-[10px] uppercase">
                      <th className="py-2 px-1">Year</th>
                      <th className="py-2 px-1">Property Taxes</th>
                      <th className="py-2 px-1">Tax Assessment Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {property.taxHistory.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-1 font-medium">{item.year}</td>
                        <td className="py-2 px-1 font-semibold text-gray-800">${item.propertyTaxes.toLocaleString()}</td>
                        <td className="py-2 px-1 font-bold text-gray-900">${item.taxAssessmentValue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Nearby Schools */}
          {property.nearbySchools && property.nearbySchools.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-[#e5e2d9] space-y-3">
              <h3 className="font-semibold text-xs text-[#1a202c] uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#2b6cb0]" />
                Nearby Schools
              </h3>
              <div className="space-y-2">
                {property.nearbySchools.map((school, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-[#f8f7f2] rounded-xl border border-[#e5e2d9]">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                        {school.rating}
                      </span>
                      <div>
                        <div className="font-bold text-[#1a202c] text-xs">{school.name}</div>
                        <div className="text-[10px] text-gray-500">Grades {school.grades} • {school.schoolType}</div>
                      </div>
                    </div>
                    <div className="text-gray-600 font-medium text-xs">
                      {school.distanceMiles} mi away
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Source Attribution Footer */}
          <div className="bg-[#efece1] p-3 rounded-xl border border-[#d6d1c4] flex items-center justify-between text-[11px] text-gray-600">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Data Source: <strong className="text-gray-800">{property.sourceAttribution}</strong></span>
            </div>
            <span className="text-gray-500">Fetched: {new Date(property.retrievedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
