// Foto's & filmpjes bij een NIEUW bericht in het ReportForm: nog te uploaden
// bestanden (bestaand bericht: PhotoGrid + PhotoManager, item 1258).
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 700, margin: '0 0 6px' }
const removeBtn = {
  position: 'absolute', top: 2, right: 2, border: 'none', borderRadius: '50%',
  width: 18, height: 18, fontSize: 11, lineHeight: '18px', padding: 0,
  background: 'rgba(0,0,0,.6)', color: 'white', cursor: 'pointer',
}
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6, marginBottom: 8 }
const tile = { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8, display: 'block' }
const videoTile = fontSize => ({ ...tile, background: '#12203c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize })

export default function ReportPhotosField({ photoFiles, onAddFiles, onRemoveFile }) {
  return (
    <>
      <label style={labelStyle}>Foto&rsquo;s &amp; filmpjes (optioneel)</label>
      <input type="file" accept="image/*,video/mp4,video/quicktime,video/webm" multiple
        onChange={e => { onAddFiles(Array.from(e.target.files || [])); e.target.value = '' }}
        style={{ display: 'block', marginBottom: 6, fontSize: 14 }} />
      {photoFiles.length > 0 && (
        <div style={grid}>
          {photoFiles.map((f, i) => (
            <div key={i} style={{ position: 'relative' }}>
              {f.type.startsWith('video/')
                ? <div style={videoTile(24)}>▶️</div>
                : <img src={URL.createObjectURL(f)} alt="" style={tile} />}
              <button onClick={() => onRemoveFile(i)} style={removeBtn}>&times;</button>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 14px' }}>
        Toegevoegde fotos/filmpjes worden opgeslagen zodra je op Opslaan klikt. Filmpjes tot 200MB (mp4/mov/webm).
      </p>
    </>
  )
}
