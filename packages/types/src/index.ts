// Shared types across apps
export type AppEnvironment = "development" | "demo" | "production";

export interface BaseUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}
