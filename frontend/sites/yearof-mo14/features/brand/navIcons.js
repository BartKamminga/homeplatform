import { HandCoins, Star, Users, CalendarDays, ListOrdered, Trophy, Camera, Plane, Flag } from 'lucide-react'

// Lucide-iconen in het menu (gekozen door Bart, 09-10). Eigen pagina's:
// Parijs weekend een vliegtuig, andere eigen pagina's een vlag.
export const NAV_ICONS = {
  action: HandCoins,
  spotlight: Star,
  team: Users,
  timeline: CalendarDays,
  competition: ListOrdered,
  topklasse: Trophy,
  upload: Camera,
}

export const customPageIcon = id => (id === 'pinksterweekend' ? Plane : Flag)
