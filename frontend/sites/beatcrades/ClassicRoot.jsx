import App from './App.jsx'

// Lazy entry van de classic-variant (item 1338); App.jsx importeert zelf App.css, dus die laadt alleen hier.
export default function ClassicRoot() {
  return <App />
}
