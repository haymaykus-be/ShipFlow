import * as turf from "@turf/turf";

export function haversineDistance(
  p1: [number, number],
  p2: [number, number]
): number {
  return turf.distance(turf.point(p1), turf.point(p2), "kilometres");
}

export function estimateETA(distanceKm: number, avgSpeedKmh = 40): number {
  // return ETA in minutes with buffer
  const minutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.ceil(minutes * 1.2); // +20% buffer
}
