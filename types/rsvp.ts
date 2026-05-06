export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
}

export interface RsvpEntry {
  docId: string;
  id: string;
  firstName: string;
  lastName: string;
  attending: boolean;
  guests: Guest[];
  submittedAt: string | null;
}
