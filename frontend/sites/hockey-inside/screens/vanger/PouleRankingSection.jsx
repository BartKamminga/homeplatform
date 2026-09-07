import { useState, useEffect } from 'react'
import { getPouleRanking } from '../../api.js'
import RankingBarChart from './charts/RankingBarChart.jsx'

// item 1104: vergelijk hoeveel scans elke poule kreeg over een rollend
// venster - los onderwerp van 1108 (dat is het systeembrede scanschema-
// overzicht), hier specifiek de poule-vergelijking.
export default function PouleRankingSection({ section }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    getPouleRanking(7, 20).then(setData).catch(() => {})
  }, [])

  if (!data || data.rows.length === 0) return null

  return (
    <div>
      {section(`Scans per poule (${data.days}d)`)}
      <RankingBarChart rows={data.rows} limit={20} />
    </div>
  )
}
