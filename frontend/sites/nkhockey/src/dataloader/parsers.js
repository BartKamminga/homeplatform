import { POULE_ORDER_14, POULE_ORDER_16 } from '../constants'

const clean14 = n => n.replace(/ [A-Z]?O?\d+-\d+/g, '').trim()
const clean16 = n => n.replace(/ [MJ]O\d+-\d+/g, '').trim()

export function parseO14(raw) {
  const parsed = JSON.parse(raw)
  const comps = {}
  for (const [key, val] of Object.entries(parsed)) {
    const ld = key.replace(/_.*/, '')
    if (POULE_ORDER_14.includes(ld) && val.teams) {
      const comp = val.competition || ''
      const type = comp.includes('Jongens') ? 'JO14' : 'MO14'
      if (!comps[type]) comps[type] = {}
      comps[type][ld] = {
        teams: val.teams, pts: val.pts, ds: val.ds, remaining: val.remaining,
        played_count: val.played_count || 0, standings: val.standings || [],
        matches_played: val.matches_played || [], poule_id: val.poule_id,
        competition: val.competition || ''
      }
      continue
    }
    if (val.data && val.data.data && val.data.data.poule) {
      const d = val.data.data
      const pn = (d.poule.name || '').replace('Poule ', '')
      if (!POULE_ORDER_14.includes(pn)) continue
      const comp = val.competition || (d.poule.competition && d.poule.competition.name) || ''
      const cls = val.class_name || (d.poule.competition && d.poule.competition.class_name) || ''
      if (!comp.includes('O14') || cls !== 'Super') continue
      const type = comp.includes('Jongens') ? 'JO14' : 'MO14'
      const st = d.poule.standings || [], ma = d.poule.matches || []
      const pl = ma.filter(m => m.status === 'final'), re = ma.filter(m => m.status === 'scheduled' || m.status === 'announced')
      if (!comps[type]) comps[type] = {}
      comps[type][pn] = {
        teams: st.map(s => clean14(s.team.name)),
        pts: st.map(s => s.points),
        ds: st.map(s => s.goals_for - s.goals_against),
        remaining: re.map(m => [clean14(m.home.name), clean14(m.away.name), m.date || '']),
        played_count: pl.length,
        standings: st.map(s => ({ rank: s.rank, team: clean14(s.team.name), team_id: s.team.id, points: s.points, wins: s.wins, draws: s.draws, losses: s.losses, gf: s.goals_for, ga: s.goals_against, gd: s.goals_for - s.goals_against })),
        matches_played: pl.map(m => ({ round: m.round, home: clean14(m.home.name), away: clean14(m.away.name), score: `${m.score.home}-${m.score.away}`, date: m.date || '' })),
        poule_id: parseInt(key),
        competition: `${comp} · ${cls}`
      }
    }
  }
  return comps
}

export function parseO16(raw) {
  const parsed = JSON.parse(raw)
  let d = parsed
  if (parsed.data && parsed.data.poules) d = parsed
  else {
    const k = Object.keys(parsed)[0]
    if (parsed[k] && parsed[k].data && parsed[k].data.data) d = parsed[k].data
    else if (parsed[k] && parsed[k].data && parsed[k].data.poules) d = parsed[k].data
    else return {}
  }
  if (!(d && d.data && d.data.poules) && !(d && d.poules)) return {}
  const root = d.data || d
  const name = root.name || ''
  const type = name.includes('Jongens') ? 'JO16' : name.includes('Meisjes') ? 'MO16' : 'O16'
  const poules = root.poules || []
  const result = {}
  for (const p of poules) {
    const cls = (p.competition && p.competition.class_name) || ''
    if (cls !== 'Landelijk') continue
    const letter = (p.name || '').replace('Poule ', '')
    if (!POULE_ORDER_16.includes(letter)) continue
    const st = p.standings || [], ma = p.matches || []
    const pl = ma.filter(m => m.status === 'final'), re = ma.filter(m => m.status === 'scheduled' || m.status === 'announced')
    result[letter] = {
      teams: st.map(s => clean16(s.team.name)),
      pts: st.map(s => s.points),
      ds: st.map(s => s.goals_for - s.goals_against),
      remaining: re.map(m => [clean16(m.home.name), clean16(m.away.name), m.date || '']),
      played_count: pl.length,
      standings: st.map(s => ({ rank: s.rank, team: clean16(s.team.name), team_id: s.team.id, points: s.points, wins: s.wins, draws: s.draws, losses: s.losses, gf: s.goals_for, ga: s.goals_against, gd: s.goals_for - s.goals_against })),
      matches_played: pl.map(m => ({ round: m.round, home: clean16(m.home.name), away: clean16(m.away.name), score: `${m.score.home}-${m.score.away}`, date: m.date || '' })),
      competition: name
    }
  }
  return { [type]: result }
}

export function findMyTeam(comps, name) {
  for (const [t, d] of Object.entries(comps)) {
    for (const [p, poule] of Object.entries(d)) {
      const i = poule.teams.indexOf(name)
      if (i >= 0) return { type: t, pouleId: p, rank: i + 1, poule }
    }
  }
  return null
}

export function getAllClubs(comps) {
  const clubs = {}
  for (const t in comps) {
    for (const p in comps[t]) {
      const teams = comps[t][p].teams || []
      for (const team of teams) clubs[team] = true
    }
  }
  return Object.keys(clubs).sort()
}
