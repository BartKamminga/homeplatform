// Strava-knoppen: koppelen (OAuth via HomePlatform), de laatste rit uploaden en de status tonen.
// Zonder VBT.strava (losse versie zonder server) blijft de knop uitgeschakeld.
VBT.stravaUi = (function () {
  const $ = id => document.getElementById(id);
  const PENDING = 'vbt.pendingStrava';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let status = { configured: false, connected: false };
  let busy = false;

  function toast(text, ms = 4000) {
    const el = $('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function render() {
    const btn = $('btnStrava'), plan = $('planStrava');
    const ride = VBT.game.lastRide;
    let label, enabled = !!VBT.strava && status.configured && !busy;
    if (!VBT.strava || !status.configured) label = '&#8679; STRAVA <em>not set up</em>';
    else if (!status.connected) label = '&#8679; CONNECT STRAVA';
    else if (ride && ride.stravaActivityId) { label = '&#10003; ON STRAVA'; enabled = true; }
    else label = '&#8679; UPLOAD TO STRAVA';
    if (busy) label = '&#8679; UPLOADING&hellip;';
    if (ride && !ride.serverId && status.connected) enabled = false;    // nog aan het opslaan
    btn.innerHTML = label;
    btn.disabled = !enabled;
    if (plan) {
      plan.hidden = !VBT.strava || !status.configured;
      plan.innerHTML = status.connected ? '&#10003; STRAVA ' + (status.athleteName || '').toUpperCase() : '&#8679; CONNECT STRAVA';
    }
  }

  async function refresh() {
    if (!VBT.strava) return render();
    try { status = await VBT.strava.status(); } catch (e) { /* geen server: knop blijft uit */ }
    render();
  }

  async function connect(pendingRideId) {
    if (pendingRideId) sessionStorage.setItem(PENDING, pendingRideId);
    window.location.href = await VBT.strava.connectUrl();
  }

  async function upload(ride) {
    busy = true;
    render();
    try {
      let r = await VBT.strava.upload(ride.serverId, VBT.fit.encode(ride), VBT.fit.fileName(ride));
      for (let i = 0; i < 20 && r.stravaStatus === 'uploading'; i++) {
        await sleep(2500);
        r = await VBT.strava.uploadStatus(ride.serverId);
      }
      if (r.stravaActivityId) {
        ride.stravaActivityId = r.stravaActivityId;
        toast('UPLOADED TO STRAVA ✓');
      } else if (r.stravaStatus === 'error') {
        toast('STRAVA: ' + (r.stravaError || 'upload failed'), 7000);
      } else {
        toast('STRAVA IS STILL PROCESSING - CHECK YOUR FEED IN A MINUTE');
      }
    } catch (e) {
      toast('STRAVA: ' + e.message, 7000);
    }
    busy = false;
    render();
  }

  async function onRideButton() {
    const ride = VBT.game.lastRide;
    if (!ride) return;
    if (ride.stravaActivityId) { window.open('https://www.strava.com/activities/' + ride.stravaActivityId, '_blank'); return; }
    if (!status.connected) return connect(ride.serverId);
    if (ride.serverId) upload(ride);
  }

  async function onPlanButton() {
    if (!status.connected) return connect();
    if (window.confirm('Disconnect Strava?')) {
      await VBT.strava.disconnect();
      await refresh();
    }
  }

  // Terug van Strava (?strava=connected|denied|scope): openstaande upload alsnog doen
  async function handleReturn() {
    const result = new URLSearchParams(window.location.search).get('strava');
    if (!result) return;
    history.replaceState(null, '', window.location.pathname);
    await refresh();
    if (result !== 'connected') {
      toast(result === 'scope' ? 'STRAVA: PLEASE ALLOW UPLOADING ACTIVITIES' : 'STRAVA NOT CONNECTED', 6000);
      return;
    }
    toast('STRAVA CONNECTED ✓');
    const pending = sessionStorage.getItem(PENDING);
    sessionStorage.removeItem(PENDING);
    if (!pending) return;
    const ride = await VBT.storage.getRide(pending);
    if (ride && !ride.stravaActivityId) {
      ride.serverId = ride.id;
      VBT.game.lastRide = ride;
      upload(ride);
    }
  }

  function init() {
    $('btnStrava').onclick = onRideButton;
    const plan = $('planStrava');
    if (plan) plan.onclick = onPlanButton;
    refresh().then(handleReturn);
  }

  VBT.toast = toast;
  return { init, render, refresh };
})();
