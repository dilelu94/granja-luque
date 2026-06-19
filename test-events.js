import { CalendarEvent } from './backend/models/CalendarEvent.js';
async function test() {
  const events = await CalendarEvent.getAll();
  console.log(JSON.stringify(events.slice(0, 5), null, 2));
}
test();
