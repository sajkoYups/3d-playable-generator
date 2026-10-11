export const UPCOMING_GAMES = [
  {
    id: "racing-lap",
    name: "Racing Lap",
    blurb: "Steer with the joystick. Stay on the oval. Finish the laps.",
  },
  {
    id: "top-down-shooter",
    name: "Top-down Shooter",
    blurb: "Move with the stick. Auto-fire clears each wave.",
  },
  {
    id: "zombie-apocalypse",
    name: "Zombie Apocalypse",
    blurb: "Survive the horde. Last until dawn.",
  },
] as const;

export type UpcomingGameId = (typeof UPCOMING_GAMES)[number]["id"];
export type UpcomingGame = (typeof UPCOMING_GAMES)[number];

export function isUpcomingGameId(id: string): boolean {
  return UPCOMING_GAMES.some((game) => game.id === id);
}
