import React from 'react'

export default function EasterEgg() {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        animation: 'flyAcross 3s ease-in-out forwards',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        <img src={`${import.meta.env.BASE_URL}easter.jpg`} alt="" style={{
          width: 180, height: 180, borderRadius: '50%', objectFit: 'cover',
          boxShadow: '0 0 40px rgba(255,50,50,.6)',
          animation: 'spin 1s linear infinite',
        }} />
        <div style={{
          fontSize: 24, fontWeight: 800, color: '#fff',
          textShadow: '0 0 20px rgba(255,50,50,.8), 0 2px 4px rgba(0,0,0,.5)',
          fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
        }}>BACKHANDJE KRUISING! 🏑</div>
      </div>
      <style>{`
        @keyframes flyAcross {
          0% { top: 110%; left: -200px; transform: rotate(-20deg) scale(0.3); opacity: 0; }
          20% { opacity: 1; }
          50% { top: 30%; left: 50%; transform: translateX(-50%) rotate(0deg) scale(1.2); }
          70% { top: 30%; left: 50%; transform: translateX(-50%) rotate(0deg) scale(1.2); }
          100% { top: -200px; left: 110%; transform: rotate(20deg) scale(0.3); opacity: 0; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
