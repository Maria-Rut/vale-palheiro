import type { Reservation, ResortEvent } from "./types.ts";
import { reservations as mockReservations, events as mockEvents } from "./mockData.ts";

/**
 * Connector seams for live data.
 *
 * The system needs two feeds:
 *   1. Reservations — guest, email, language, dates, villa/unit, party size,
 *      occasion. Vale Palheiro treats Host (the PMS) as its single source of
 *      truth: direct bookings are entered there, and Booking.com / Expedia /
 *      website bookings flow in via GuestCentric. So the live connector reads
 *      from Host, not from GuestCentric's reporting (which misses manual edits).
 *   2. Events — the resort's calendar of Fado nights, guest chefs, yoga,
 *      weddings/buy-outs (a buy-out matters: no invites for dates that are
 *      closed to the public).
 *
 * Today both are served from mock data. Going live means implementing these
 * two interfaces (e.g. a Host API/export reader and a Google Calendar reader)
 * and passing them to the Scheduler — nothing else changes.
 */

export interface BookingSource {
  /** All reservations the system should know about, including past stays (history). */
  listReservations(): Promise<Reservation[]>;
}

export interface EventSource {
  listEvents(): Promise<ResortEvent[]>;
  addEvent(e: Omit<ResortEvent, "id">): Promise<ResortEvent>;
  removeEvent(id: string): Promise<boolean>;
}

export class MockBookingSource implements BookingSource {
  async listReservations(): Promise<Reservation[]> {
    return mockReservations;
  }
}

/** In-memory calendar, seeded with mock events; staff can add/remove in the dashboard. */
export class InMemoryEventSource implements EventSource {
  private events: ResortEvent[];
  private seq = 100;
  constructor(seed: ResortEvent[] = mockEvents) {
    this.events = [...seed];
  }
  async listEvents(): Promise<ResortEvent[]> {
    return [...this.events].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }
  async addEvent(e: Omit<ResortEvent, "id">): Promise<ResortEvent> {
    const ev = { ...e, id: `evt_${++this.seq}` };
    this.events.push(ev);
    return ev;
  }
  async removeEvent(id: string): Promise<boolean> {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.id !== id);
    return this.events.length !== before;
  }
}
