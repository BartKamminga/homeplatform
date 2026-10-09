import {
  HandCoins, PiggyBank, HeartHandshake, Euro, Gift, Star, Sparkles, Newspaper, Megaphone, Heart,
  Users, UsersRound, Shirt, Contact, CalendarDays, CalendarClock, Swords, Timer, ListOrdered, Table2,
  ChartColumn, Trophy, Medal, Award, Crown, Camera, Image, Images, Plane, MapPin, Luggage, Tent, Bus,
  Flag, Goal, Target, House, PartyPopper, Music, Info,
} from 'lucide-react'

// Lucide-iconen voor menu en paginakoppen (09-10). Opgeslagen als naam
// (bv. 'calendar-days') in de pagina-instellingen; oude waarden kunnen nog
// een emoji zijn (bv. 🗼) - die tonen we gewoon als tekst.
export const ICONS = {
  'hand-coins': HandCoins, 'piggy-bank': PiggyBank, 'heart-handshake': HeartHandshake, euro: Euro, gift: Gift,
  star: Star, sparkles: Sparkles, newspaper: Newspaper, megaphone: Megaphone, heart: Heart,
  users: Users, 'users-round': UsersRound, shirt: Shirt, contact: Contact,
  'calendar-days': CalendarDays, 'calendar-clock': CalendarClock, swords: Swords, timer: Timer,
  'list-ordered': ListOrdered, 'table-2': Table2, 'chart-column': ChartColumn,
  trophy: Trophy, medal: Medal, award: Award, crown: Crown,
  camera: Camera, image: Image, images: Images,
  plane: Plane, 'map-pin': MapPin, luggage: Luggage, tent: Tent, bus: Bus,
  flag: Flag, goal: Goal, target: Target, house: House, 'party-popper': PartyPopper, music: Music, info: Info,
}

// Standaardiconen per vaste pagina (Bart, 09-10)
export const DEFAULT_PAGE_ICONS = {
  action: 'hand-coins', spotlight: 'star', team: 'users', timeline: 'calendar-days',
  competition: 'list-ordered', topklasse: 'trophy', upload: 'camera',
}

// Icoon tonen: Lucide als de naam bekend is, anders als tekst (emoji), anders fallback.
export function PageIcon({ value, fallback = 'flag', size = 16, ...rest }) {
  const Icon = ICONS[value] || (!value ? ICONS[fallback] : null)
  if (Icon) return <Icon width={size} height={size} aria-hidden="true" {...rest} />
  return <span aria-hidden="true" style={{ fontSize: size, lineHeight: 1 }}>{value}</span>
}
