// bridge.js — ISOLATED world: relays MAIN-world events naar de popup
window.addEventListener('__hw_captured', function() {
  chrome.runtime.sendMessage({ type: 'hw_data_updated' }).catch(function() {});
});
window.addEventListener('__hw_log_updated', function() {
  chrome.runtime.sendMessage({ type: 'hw_log_updated' }).catch(function() {});
});
window.addEventListener('__hw_clubs_discovered', function() {
  chrome.runtime.sendMessage({ type: 'hw_clubs_captured' }).catch(function() {});
});
window.addEventListener('__hw_club_detail_captured', function() {
  chrome.runtime.sendMessage({ type: 'hw_club_detail_captured' }).catch(function() {});
});
