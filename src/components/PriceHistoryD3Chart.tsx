/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Property, PriceHistoryEntry } from '../types';
import { TrendingDown, TrendingUp, DollarSign, Calendar, Sparkles } from 'lucide-react';

interface PriceHistoryD3ChartProps {
  property: Property;
}

interface ProcessedDataPoint {
  date: Date;
  dateStr: string;
  price: number;
  event: string;
  priceChange?: number;
  priceChangePct?: number;
  source?: string;
}

export const PriceHistoryD3Chart: React.FC<PriceHistoryD3ChartProps> = ({ property }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [hoveredPoint, setHoveredPoint] = useState<ProcessedDataPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Prepare and normalize chronological data points
  const getChronologicalData = (): ProcessedDataPoint[] => {
    let rawHistory: PriceHistoryEntry[] = [...(property.priceHistory || [])];

    // If history is empty or has only 1 entry, synthesize chronological points from property metadata
    if (rawHistory.length <= 1) {
      const now = new Date();
      const listedDate = property.dateListed ? new Date(property.dateListed) : new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const origPrice = property.originalPrice || property.price * 1.05;

      rawHistory = [
        {
          date: listedDate.toISOString().split('T')[0],
          event: 'Listed',
          price: origPrice,
          source: property.sourceAttribution || 'Zillow MCP',
        },
      ];

      if (property.priceReduced && property.priceReductionAmount) {
        const midDate = new Date(listedDate.getTime() + (now.getTime() - listedDate.getTime()) / 2);
        rawHistory.push({
          date: midDate.toISOString().split('T')[0],
          event: 'Price Change',
          price: origPrice - property.priceReductionAmount,
          priceChange: -property.priceReductionAmount,
          priceChangePct: Number((-((property.priceReductionAmount / origPrice) * 100)).toFixed(1)),
          source: property.sourceAttribution || 'Zillow MCP',
        });
      }

      rawHistory.push({
        date: now.toISOString().split('T')[0],
        event: property.status === 'recently_sold' ? 'Sold' : 'Price Change',
        price: property.price,
        source: property.sourceAttribution || 'Zillow MCP',
      });
    }

    // Convert raw history into ProcessedDataPoint items
    const parsed: ProcessedDataPoint[] = rawHistory
      .map((entry) => {
        const d = new Date(entry.date);
        const validDate = isNaN(d.getTime()) ? new Date() : d;
        return {
          date: validDate,
          dateStr: entry.date,
          price: Number(entry.price) || property.price,
          event: entry.event || 'Price Update',
          priceChange: entry.priceChange,
          priceChangePct: entry.priceChangePct,
          source: entry.source || 'Zillow MCP',
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Deduplicate identical timestamps if needed by slightly offsetting time
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i].date.getTime() <= parsed[i - 1].date.getTime()) {
        parsed[i].date = new Date(parsed[i - 1].date.getTime() + 24 * 3600 * 1000);
      }
    }

    return parsed;
  };

  const dataPoints = getChronologicalData();

  // Summary Metrics
  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  const overallPriceDiff = lastPoint.price - firstPoint.price;
  const overallPctDiff = firstPoint.price > 0 ? ((overallPriceDiff / firstPoint.price) * 100).toFixed(1) : '0.0';

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || dataPoints.length === 0) return;

    // Render D3 SVG Chart
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean previous render

    const containerWidth = containerRef.current.clientWidth || 500;
    const height = 220;
    const margin = { top: 20, right: 25, bottom: 35, left: 55 };
    const width = containerWidth;

    svg.attr('width', width).attr('height', height).attr('viewBox', `0 0 ${width} ${height}`);

    // Scales
    const xMin = d3.min(dataPoints, (d) => d.date) || new Date();
    const xMax = d3.max(dataPoints, (d) => d.date) || new Date();

    const xScale = d3
      .scaleTime()
      .domain([xMin, xMax])
      .range([margin.left, width - margin.right]);

    const yMinRaw = d3.min(dataPoints, (d) => d.price) || 100000;
    const yMaxRaw = d3.max(dataPoints, (d) => d.price) || 500000;
    const padding = (yMaxRaw - yMinRaw) * 0.15 || yMaxRaw * 0.05 || 10000;

    const yScale = d3
      .scaleLinear()
      .domain([Math.max(0, yMinRaw - padding), yMaxRaw + padding])
      .range([height - margin.bottom, margin.top]);

    // Defs for Linear Gradient under line
    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', `price-gradient-${property.id}`)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#7e22ce')
      .attr('stop-opacity', 0.35);

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#7e22ce')
      .attr('stop-opacity', 0.02);

    // Gridlines (Horizontal)
    const yTicks = yScale.ticks(4);
    svg
      .append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#f1f5f9')
      .attr('stroke-dasharray', '3,3');

    // Axes
    const xAxis = d3
      .axisBottom<Date>(xScale)
      .ticks(Math.min(dataPoints.length, 5))
      .tickFormat((d) => d3.timeFormat("%b '%y")(d as Date))
      .tickSizeOuter(0);

    const yAxis = d3
      .axisLeft<number>(yScale)
      .ticks(4)
      .tickFormat((d) => {
        const val = d as number;
        return val >= 1000000
          ? `$${(val / 1000000).toFixed(1)}M`
          : `$${Math.round(val / 1000)}k`;
      })
      .tickSizeOuter(0);

    // Append X Axis
    svg
      .append('g')
      .attr('transform', `translate(0, ${height - margin.bottom})`)
      .call(xAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '500');

    // Append Y Axis
    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis)
      .attr('color', '#94a3b8')
      .selectAll('text')
      .attr('font-size', '10px')
      .attr('font-weight', '500');

    // Remove domain axis lines for cleaner look
    svg.selectAll('.domain').attr('stroke', '#e2e8f0');

    // Area Generator
    const areaGenerator = d3
      .area<ProcessedDataPoint>()
      .x((d) => xScale(d.date))
      .y0(height - margin.bottom)
      .y1((d) => yScale(d.price))
      .curve(dataPoints.length > 2 ? d3.curveMonotoneX : d3.curveLinear);

    // Line Generator
    const lineGenerator = d3
      .line<ProcessedDataPoint>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.price))
      .curve(dataPoints.length > 2 ? d3.curveMonotoneX : d3.curveLinear);

    // Draw Gradient Area Fill
    svg
      .append('path')
      .datum(dataPoints)
      .attr('fill', `url(#price-gradient-${property.id})`)
      .attr('d', areaGenerator);

    // Draw Main Trend Line
    const path = svg
      .append('path')
      .datum(dataPoints)
      .attr('fill', 'none')
      .attr('stroke', '#7e22ce')
      .attr('stroke-width', 2.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', lineGenerator);

    // Animated path drawing
    const totalLength = path.node()?.getTotalLength() || 0;
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(750)
      .ease(d3.easeCubicOut)
      .attr('stroke-dashoffset', 0);

    // Draw Data Point Circles
    const circlesGroup = svg.append('g').attr('class', 'data-points');

    dataPoints.forEach((pt) => {
      const cx = xScale(pt.date);
      const cy = yScale(pt.price);

      // Outer halo
      circlesGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 6)
        .attr('fill', '#ffffff')
        .attr('stroke', '#7e22ce')
        .attr('stroke-width', 2);

      // Inner dot
      circlesGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 3)
        .attr('fill', '#7e22ce');
    });

    // Crosshair & Interaction Overlay
    const focusGroup = svg.append('g').style('display', 'none');

    const focusLine = focusGroup
      .append('line')
      .attr('stroke', '#a855f7')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3,3')
      .attr('y1', margin.top)
      .attr('y2', height - margin.bottom);

    const focusCircle = focusGroup
      .append('circle')
      .attr('r', 6)
      .attr('fill', '#a855f7')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 2);

    // Overlay Rect for Pointer Events
    svg
      .append('rect')
      .attr('width', width - margin.left - margin.right)
      .attr('height', height - margin.top - margin.bottom)
      .attr('transform', `translate(${margin.left}, ${margin.top})`)
      .attr('fill', 'transparent')
      .on('mouseenter', () => focusGroup.style('display', null))
      .on('mouseleave', () => {
        focusGroup.style('display', 'none');
        setHoveredPoint(null);
        setTooltipPos(null);
      })
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, svgRef.current);
        const xDate = xScale.invert(mx);

        // Find nearest datapoint using bisect
        const bisect = d3.bisector<ProcessedDataPoint, Date>((d) => d.date).left;
        const index = bisect(dataPoints, xDate, 1);
        const d0 = dataPoints[index - 1];
        const d1 = dataPoints[index];

        let closest = d0;
        if (d1 && d0) {
          closest = xDate.getTime() - d0.date.getTime() > d1.date.getTime() - xDate.getTime() ? d1 : d0;
        } else if (d1) {
          closest = d1;
        }

        if (closest) {
          const cx = xScale(closest.date);
          const cy = yScale(closest.price);

          focusLine.attr('x1', cx).attr('x2', cx);
          focusCircle.attr('cx', cx).attr('cy', cy);

          setHoveredPoint(closest);
          setTooltipPos({ x: cx, y: cy });
        }
      });
  }, [property, dataPoints]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 relative">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 text-[#7e22ce] border border-purple-100">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              Price History Trend (D3 Chart)
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Historical pricing trajectory & listing activity
            </p>
          </div>
        </div>

        {/* Overall Trend Badge */}
        <div className="flex items-center gap-1 text-xs font-bold">
          {overallPriceDiff < 0 ? (
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>-${Math.abs(overallPriceDiff).toLocaleString()} ({overallPctDiff}%)</span>
            </span>
          ) : overallPriceDiff > 0 ? (
            <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+${overallPriceDiff.toLocaleString()} (+{overallPctDiff}%)</span>
            </span>
          ) : (
            <span className="text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
              Stable
            </span>
          )}
        </div>
      </div>

      {/* Responsive D3 Container */}
      <div ref={containerRef} className="relative w-full overflow-hidden min-h-[220px]">
        <svg ref={svgRef} className="w-full h-auto overflow-visible cursor-crosshair" />

        {/* Dynamic Hover Tooltip Popup */}
        {hoveredPoint && tooltipPos && (
          <div
            className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 bg-slate-900 text-white text-xs rounded-xl p-2.5 shadow-xl border border-slate-700 transition-all duration-75 space-y-1 min-w-[150px]"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
            }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-1">
              <span className="font-bold text-purple-300 text-[11px]">
                {hoveredPoint.event}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {hoveredPoint.dateStr}
              </span>
            </div>
            <div className="text-sm font-extrabold text-white">
              ${hoveredPoint.price.toLocaleString()}
            </div>
            {hoveredPoint.priceChange !== undefined && (
              <div
                className={`text-[10px] font-semibold flex items-center gap-1 ${
                  hoveredPoint.priceChange < 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                <span>
                  {hoveredPoint.priceChange < 0 ? '' : '+'}${hoveredPoint.priceChange.toLocaleString()}
                </span>
                {hoveredPoint.priceChangePct && (
                  <span>({hoveredPoint.priceChangePct}%)</span>
                )}
              </div>
            )}
            <div className="text-[9px] text-slate-400 pt-0.5">
              Source: {hoveredPoint.source}
            </div>
          </div>
        )}
      </div>

      {/* Legend / Footer details */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7e22ce]" />
            List Price Trend
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <Calendar className="w-3 h-3" />
            {dataPoints[0]?.dateStr} to {dataPoints[dataPoints.length - 1]?.dateStr}
          </span>
        </div>
        <span>Interactive D3.js chart • Hover points for details</span>
      </div>
    </div>
  );
};
