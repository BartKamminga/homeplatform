import React from 'react'

export default function Popup({ title, onClose, maxWidth, children }) {
  return <>
    <div className="version-overlay" onClick={onClose}></div>
    <div className="version-popup" style={maxWidth ? { maxWidth } : {}}>
      <div className="version-popup-header"><span>{title}</span><button className="version-close" onClick={onClose}>✕</button></div>
      <div className="version-popup-body">{children}</div>
    </div>
  </>
}
