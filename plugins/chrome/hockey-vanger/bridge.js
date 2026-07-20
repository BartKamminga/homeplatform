// bridge.js — ISOLATED world: relays MAIN-world capture events naar de popup
window.addEventListener('__hw_captured', function() {
  chrome.runtime.sendMessage({ type: 'hw_data_updated' }).catch(function() {});
});
