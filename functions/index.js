const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

function todayKey(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(date);
}

// Deletes every /days/{date} node whose date is before today (Europe/London),
// so each day's waypoints and tracks are gone by 03:00.
exports.dailyWipe = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('Europe/London')
  .onRun(async () => {
    const today = todayKey(new Date());
    const rootRef = admin.database().ref('days');
    const snapshot = await rootRef.once('value');

    const deletions = {};
    snapshot.forEach((child) => {
      if (child.key && child.key < today) deletions[child.key] = null;
    });

    const keys = Object.keys(deletions);
    if (keys.length > 0) {
      await rootRef.update(deletions);
      console.log(`Wiped ${keys.join(', ')}`);
    }
    return null;
  });
