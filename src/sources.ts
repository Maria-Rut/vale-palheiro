import type { Reservation, ResortEvent } from "./types.ts";
import { reservations as mockReservations, events as mockEvents } from "./mockData.ts";

/**
 * Connector seams for live data.
 *
 * The system needs two feeds:
 *   1. Reservations — guest, email, language, dates, villa/unit, party size,
 *      occasion. Bookings reach Vale Palheiro through GuestCentric
 *      (website, Booking.com, Expedia…). How we read them — API, webhook or
 *      export — is still to be confirmed (see GuestcentricBookingSource and
 *      ARCHITECTURE.md).
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
  updateEvent(id: string, patch: Omit<ResortEvent, "id">): Promise<ResortEvent | undefined>;
  removeEvent(id: string): Promise<boolean>;
}

/**
 * GuestCentric (planned). Vale Palheiro's booking engine / channel manager.
 * We don't assume API access yet — Carmine to confirm whether GuestCentric
 * offers an API, a webhook or a scheduled export (CSV / e-mail report), and
 * which fields it carries (guest email, phone, language, marketing consent,
 * villa, arrival time, special requests). Whichever it is, it only has to
 * implement BookingSource; the rest of the system stays the same.
 */
export class GuestcentricBookingSource implements BookingSource {
  async listReservations(): Promise<Reservation[]> {
    throw new Error("GuestCentric connection not set up yet — waiting on access details.");
  }
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
  async updateEvent(id: string, patch: Omit<ResortEvent, "id">): Promise<ResortEvent | undefined> {
    const i = this.events.findIndex((e) => e.id === id);
    if (i < 0) return undefined;
    this.events[i] = { ...patch, id };
    return this.events[i];
  }
  async removeEvent(id: string): Promise<boolean> {
    const before = this.events.length;
    this.events = this.events.filter((e) => e.id !== id);
    return this.events.length !== before;
  }
}
