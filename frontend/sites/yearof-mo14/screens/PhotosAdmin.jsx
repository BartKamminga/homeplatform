import PhotoManager from '../features/photos/PhotoManager.jsx'

// Tab Foto's: de fotobeheer-werkbak over alle foto's (item 1213). Hetzelfde
// component staat op de wedstrijdpagina, daar vast op 1 wedstrijd.
export default function PhotosAdmin() {
  return (
    <div>
      <h3 style={{ fontSize: 15, margin: '0 0 10px' }}>Foto&rsquo;s</h3>
      <PhotoManager />
    </div>
  )
}
