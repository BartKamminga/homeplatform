export function daySummary(hours) {
  const temps = hours.map(h => h.temp)
  const winds = hours.map(h => h.wind_kmh)
  const rainMm = hours.reduce((sum, h) => sum + (h.rain_mm || 0), 0)

  // Gemiddelde windrichting via vector-som (voorkomt vertekening rond de 0/360-overgang)
  const sinSum = hours.reduce((s, h) => s + Math.sin(h.wind_dir * Math.PI / 180), 0)
  const cosSum = hours.reduce((s, h) => s + Math.cos(h.wind_dir * Math.PI / 180), 0)
  const windDir = (Math.atan2(sinSum, cosSum) * 180 / Math.PI + 360) % 360

  // 's Nachts is er geen zon, ongeacht bewolking — anders lijkt een heldere
  // nacht (lage cloud_cover) ten onrechte op een hoog zon-percentage. Zelfde
  // regel als de Zon-tab-grafiek (SmoothChart.jsx sun_pct), anders wijkt de
  // samenvatting op een kort tijdvak dat deels in het donker valt duidelijk af.
  const sunPct = Math.round(
    hours.reduce((sum, h) => sum + (h.is_daytime ? 100 - (h.cloud_cover ?? 0) : 0), 0) / hours.length
  )

  return {
    tempMin: Math.round(Math.min(...temps)),
    tempMax: Math.round(Math.max(...temps)),
    windAvg: Math.round(winds.reduce((a, b) => a + b, 0) / winds.length),
    windDir,
    rainMm: Math.round(rainMm * 10) / 10,
    sunPct,
  }
}
