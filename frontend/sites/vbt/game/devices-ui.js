// Verbindingsscherm (toets K of knop CONNECT KICKR): trainer + hartslagband koppelen, live waarden,
// ERG-test en het Bluetooth-log (met kopieerknop, om problemen met de echte Kickr te kunnen delen).
VBT.devicesUi = (function () {
  const ble = VBT.ble;
  const $ = id => document.getElementById(id);
  const LABEL = { idle: 'NOT CONNECTED', connecting: 'CONNECTING…', reconnecting: 'RECONNECTING…', connected: 'CONNECTED' };
  let ergTest = false, onClose = null;

  function row(kind) {
    const l = ble.links[kind], el = $('dev-' + kind);
    el.querySelector('.devname').textContent = l.device ? l.name + (l.protocol ? ' · ' + l.protocol : '') : (kind === 'trainer' ? 'Wahoo KICKR (FTMS)' : 'Heart rate strap');
    const st = el.querySelector('.devstatus');
    st.textContent = LABEL[l.status] || l.status;
    st.dataset.status = l.status;
    el.querySelector('.devbtn').textContent = l.wanted ? 'DISCONNECT' : 'CONNECT';
  }

  function render() {
    if (!$('devices')) return;
    row('trainer');
    row('hr');
    const box = $('bleLog');
    const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
    box.textContent = ble.log.join('\n');
    if (atBottom) box.scrollTop = box.scrollHeight;
    $('btnErgTest').disabled = !ble.ergCapable();
    $('btnErgTest').textContent = ergTest ? 'STOP ERG TEST' : 'ERG TEST 100 W';
    chips();
  }

  // live waarden een paar keer per seconde verversen
  function tick() {
    const L = ble.live;
    $('devLiveTrainer').textContent = ble.trainerOk() ? L.power + ' W · ' + Math.round(L.cadence) + ' RPM · ' + L.speed.toFixed(1) + ' KM/H' : '—';
    $('devLiveHr').textContent = ble.hrOk() ? L.hr + ' BPM' : '—';
    chips();
  }

  // statuslampjes in de HUD
  function chips() {
    const t = $('chipTrainer'), h = $('chipHr');
    if (!t) return;
    t.hidden = !ble.trainerActive();
    t.dataset.status = ble.trainerOk() ? 'ok' : ble.links.trainer.status === 'connected' ? 'stale' : 'lost';
    h.hidden = !ble.links.hr.wanted;
    h.dataset.status = ble.hrOk() ? 'ok' : 'lost';
  }

  async function toggle(kind) {
    if (ble.links[kind].wanted) { ble.disconnect(kind); return; }
    try { await ble.pick(kind); } catch (e) { ble.note(kind + ': ' + e.message); }
  }

  function toggleErgTest() {
    ergTest = !ergTest;
    ble.resetTargets();
    if (ergTest) ble.setErg(100);
    else ble.setGrade(0);   // weerstand los: vlakke weg
    render();
  }

  async function copyLog() {
    const text = ble.log.join('\n');
    try { await navigator.clipboard.writeText(text); VBT.toast && VBT.toast('LOG COPIED'); } catch (e) {
      const ta = document.createElement('textarea');   // terugval zonder clipboard-API
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      VBT.toast && VBT.toast('LOG COPIED');
    }
  }

  function open(closeHandler) { onClose = closeHandler; render(); }
  function close() { if (ergTest) toggleErgTest(); onClose && onClose(); }

  function init() {
    $('dev-trainer').querySelector('.devbtn').onclick = () => toggle('trainer');
    $('dev-hr').querySelector('.devbtn').onclick = () => toggle('hr');
    $('btnErgTest').onclick = toggleErgTest;
    $('btnCopyLog').onclick = copyLog;
    $('devClose').onclick = close;
    if (!navigator.bluetooth && !(VBT.bleMock && VBT.bleMock.enabled)) {
      ble.note('Web Bluetooth not available in this browser - use Chrome or Edge on Windows/Mac/Android');
    }
    ble.on(render);
    setInterval(tick, 400);
    ble.restore();
    render();
  }

  return { init, open, close };
})();
