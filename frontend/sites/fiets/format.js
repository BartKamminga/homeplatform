export function daySummary(hours) {
  const temps = hours.map(h => h.temp)
  const winds = hours.map(h => h.wind_kmh)
  const rainProbs = hours.map(h => h.rain_prob)
  const rainMm = hours.reduce((sum, h) => sum + (h.rain_mm || 0), 0)

  // Gemiddelde windrichting via vector-som (voorkomt vertekening rond de 0/360-overgang)
  const sinSum = hours.reduce((s, h) => s + Math.sin(h.wind_dir * Math.PI / 180), 0)
  const cosSum = hours.reduce((s, h) => s + Math.cos(h.wind_dir * Math.PI / 180), 0)
  const windDir = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360

  return {
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    windAvg: Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
    windDir,
    rainProbMax: Math.max(...rainProbs),
    rainMm: Math.round(rainMm * 10) / 10,
  }
}
