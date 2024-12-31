import { EventEmitter } from "events";

// Create event emitter for game events
export const ee = new EventEmitter();
ee.setMaxListeners(20); // Increase max listeners to prevent warnings

// Debug logging for event emitter
ee.on('newListener', (event) => {
  console.log(`[DEBUG] New listener added for event: ${event}`);
});

ee.on('removeListener', (event) => {
  console.log(`[DEBUG] Listener removed for event: ${event}`);
});

// Keep track of last emitted events per game to prevent duplicates
const lastEmittedEvents = new Map<string, { id: string; timestamp: number }>();

// Helper function to emit game events with deduplication
export function emitGameEvent(gameId: string, event: unknown) {
  if (!event || typeof event !== 'object') return;

  const eventId = 'id' in event ? (event as { id: string }).id : undefined;
  const now = Date.now();
  
  console.log(`[DEBUG] Attempting to emit event for game ${gameId}:`, {
    eventId,
    eventType: event && typeof event === 'object' && 'type' in event ? (event as { type: string }).type : 'unknown',
    timestamp: now
  });
  
  // If this is a log entry with an ID, check for duplicates
  if (eventId) {
    const lastEvent = lastEmittedEvents.get(gameId);
    // Prevent duplicate events within 1000ms and batch rapid updates
    if (lastEvent?.id === eventId && (now - lastEvent.timestamp) < 1000) {
      console.log(`[DEBUG] Skipping duplicate event ${eventId} (last emission was ${now - lastEvent.timestamp}ms ago)`);
      return;
    }
    lastEmittedEvents.set(gameId, { id: eventId, timestamp: now });

    // Use a longer debounce time for updates
    const debounceTime = 250;
    console.log(`[DEBUG] Scheduling debounced event emission for ${eventId} in ${debounceTime}ms`);
    setTimeout(() => {
      // Check again if this event is still relevant
      const currentLastEvent = lastEmittedEvents.get(gameId);
      if (currentLastEvent?.id === eventId) {
        console.log(`[DEBUG] Emitting debounced event ${eventId}`);
        ee.emit(`game:${gameId}`, event);
      } else {
        console.log(`[DEBUG] Skipping outdated debounced event ${eventId}`);
      }
    }, debounceTime);
  } else {
    console.log(`[DEBUG] Emitting non-tracked event for game ${gameId}`);
    ee.emit(`game:${gameId}`, event);
  }
} 