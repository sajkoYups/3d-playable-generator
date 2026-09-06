export const UPCOMING_GAMES = [
  {
    id: "tower-defense",
    name: "Tower Defense",
    blurb: "Place towers, stop the waves.",
  },
  {
    id: "zombie-apocalypse",
    name: "Zombie Apocalypse",
    blurb: "Survive the horde. Last until dawn.",
  },
] as const;

export type UpcomingGameId = (typeof UPCOMING_GAMES)[number]["id"];
export type UpcomingGame = (typeof UPCOMING_GAMES)[number];
