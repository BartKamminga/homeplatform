// Hockey Vanger — background service worker
// Opent het zijpaneel bij klik op het extensie-icoon.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Relay capture-events van content script naar de side panel
chrome.runtime.onMessage.addListener(function(msg) {
  if (msg.type === 'hw_data_updated') {
    chrome.runtime.sendMessage({ type: 'hw_data_updated' }).catch(function() {});
  }
});
