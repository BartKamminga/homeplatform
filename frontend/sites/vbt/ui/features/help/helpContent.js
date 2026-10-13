// Helpteksten (Engels, zelfde regime als de UI). HTML is statisch en van onszelf; COPY-knoppen via data-copy.
export const FLAG_CHROME = 'chrome://flags/#enable-web-bluetooth-new-permissions-backend';
export const FLAG_EDGE = 'edge://flags/#enable-web-bluetooth-new-permissions-backend';

const copy = text => '<code>' + text + '</code><button class="ghostbtn copybtn" data-copy="' + text + '">COPY</button>';

export const SECTIONS = [
    { id: 'start', title: 'Getting started', html: `
      <p>VBT is an arcade bike trainer for your smart trainer. Use <b>Chrome or Edge</b> on Windows, Mac or Android
      (not iPhone/iPad - Safari has no Web Bluetooth).</p>
      <ul><li><b>SPACE</b> free ride · <b>T</b> training plan · <b>R</b> my rides · <b>K</b> devices · <b>H</b> help</li>
      <li>Without a trainer you can still ride with the keyboard (simulated power).</li></ul>` },
    { id: 'bluetooth', title: 'Connecting your KICKR and heart rate strap', html: `
      <ol><li>Close the Wahoo app, Zwift and other training apps - the KICKR can only be controlled by one app at a time.</li>
      <li>Press <b>K</b> (or CONNECT KICKR), click CONNECT at Trainer and pick your KICKR. Do the same for your heart rate strap.</li>
      <li>Use <b>ERG TEST 100 W</b> to check that the trainer takes control: you should feel the resistance and see ~100 W.</li></ol>
      <h4>Remember devices after reloading the page</h4>
      <p>Chrome only lets a site reconnect to a previously chosen Bluetooth device without asking again when this setting is on.
      Open it in the address bar, set it to <b>Enabled</b> and restart the browser:</p>
      <p class="flag">Chrome: ${copy(FLAG_CHROME)}</p>
      <p class="flag">Edge: ${copy(FLAG_EDGE)}</p>
      <p>After that, VBT reconnects your KICKR and strap by itself when you open it (the DEVICES log shows <i>found remembered …</i>).
      Without it you click CONNECT once per visit. During a ride VBT always reconnects automatically.</p>` },
    { id: 'riding', title: 'Riding', html: `
      <ul><li><b>Free ride</b>: the hills set the resistance on your trainer (SIM). Ride in the middle lane to draft the bunch.</li>
      <li><b>Workout</b>: the trainer holds the target power (ERG); you choose your cadence. Click a block in the workout chart to jump to that interval.</li>
      <li><b>ESC</b> asks <i>Stop ride?</i> - YES stops, NO keeps riding. Your ride is always saved.</li>
      <li>Lost the trainer signal? The ride and workout timer pause automatically and continue when the KICKR is back.</li></ul>` },
    { id: 'plan', title: 'Training plan and library', html: `
      <ul><li><b>T</b> opens the plan (FTP Builder, 6 weeks). Set your <b>FTP</b> and <b>start date</b> at the top; all targets scale with your FTP.</li>
      <li><b>LIBRARY</b> lists all workouts. Import Zwift workouts with <b>IMPORT .ZWO</b> or by dropping .zwo files on the screen.</li></ul>` },
    { id: 'data', title: 'My rides and your data', html: `
      <ul><li>Every ride is saved, however short, and can be found under <b>MY RIDES</b> (R).</li>
      <li>During a ride VBT keeps a backup <b>on this device every second</b> and <b>on the server every 10 seconds</b>.
      The HUD shows <i>SERVER BACKUP: UP TO DATE / +N S BEHIND / OFFLINE</i>.</li>
      <li>Browser crashed or tab closed? Open VBT again - the ride is recovered (<i>RECOVERED</i>).</li>
      <li>No internet at the finish? The ride waits on this device (<i>NOT SYNCED</i>) and is sent as soon as you are online.</li>
      <li>Device gone completely? The ride is on the server up to the last backup (<i>INTERRUPTED</i>) - use <b>CONTINUE RIDE</b> to pick it up where you left off.</li>
      <li>Every ride can be downloaded as a <b>.FIT</b> file (works with Strava, Garmin Connect, intervals.icu).</li></ul>` },
    { id: 'trouble', title: 'Something not working?', html: `
      <ul><li>No devices in the picker: is Bluetooth on in Windows, and is the KICKR awake (pedal a few strokes)?</li>
      <li>Connected but no ERG: close other apps that use the KICKR, then disconnect and connect again.</li>
      <li>Open <b>DEVICES</b> (K) and click <b>COPY LOG</b> - paste the log when you report a problem.</li></ul>` },
  ];

