// Commando-façade voor React: de UI schrijft alleen via deze functies, nooit rechtstreeks in de engine.
// Dunne laag over bestaande functies (session, ble, storage, safety, calendar, library, rides, fit).
VBT.actions = (function () {
  const S = () => VBT.session;
  const riding = () => VBT.game.isRiding();

  return {
    riding,
    // ritten
    startFreeRide: () => S().startRide(null),
    startWorkout: (wo, step) => S().startRide(wo, step),
    resumeRide: ride => S().resumeRide(ride),
    jumpTo: index => S().jumpTo(index),
    currentWorkout: () => (VBT.game.run ? VBT.game.run.wo : null),
    stepAt: (wo, frac) => VBT.workout.stepAtFraction(wo, frac),
    setFtp: watts => VBT.ftp.setFtp(watts, 'manual'),
    saveSettings: patch => VBT.settings.save(patch),
    setAllDisplay: on => VBT.settings.setAll(on),
    openPlan: () => S().toMenu('plan'),
    openRides: () => S().openRides(),
    stop: () => S().stop(),
    confirmStop: () => S().confirmStop(),
    cancelStop: () => S().cancelStop(),
    pause: () => { if (VBT.game.state === 'ride') { VBT.bleBridge.pausedText('PAUSED'); VBT.game.setState('paused'); } },
    resume: () => { if (VBT.game.state === 'paused' && !VBT.game.autoPaused) VBT.game.setState('ride'); },
    toMenu: state => S().toMenu(state),
    finishDone: () => S().finishDone(),
    downloadFit: ride => VBT.fit.download(ride || VBT.game.lastRide),

    // apparaten
    connect: kind => VBT.ble.pick(kind),
    disconnect: kind => VBT.ble.disconnect(kind),
    ergTest: watts => { VBT.ble.resetTargets(); if (watts) VBT.ble.setErg(watts); else VBT.ble.release(); },
    bleLog: () => VBT.ble.log.slice(),

    // opslag en backup
    listRides: () => VBT.storage.listRides(),
    getRide: id => VBT.storage.getRide(id),
    deleteRide: id => VBT.storage.deleteRide(id),
    listWorkouts: () => VBT.storage.listWorkouts ? VBT.storage.listWorkouts() : Promise.resolve([]),
    importZwo: files => VBT.storage.importZwo(files),
    deleteWorkout: id => VBT.storage.deleteWorkout(id),
    syncNow: () => { VBT.safety.liveSync(VBT.recorder.current(), true); return VBT.safety.flush(); },
    pendingRides: () => VBT.safety.pending(),

    // logs (voor COPY/DOWNLOAD LOGS in het live-paneel)
    exportLogs: () => JSON.stringify({
      at: new Date().toISOString(), snapshot: VBT.store.getSnapshot(),
      events: VBT.store.getEvents(), ble: VBT.ble.log, telemetry: VBT.store.getTelemetry(),
    }, null, 1),
  };
})();
