/** What the client needs to know about a theme (the questions live server-side). */
export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
  minAge: number;
}

/** Themes offered in the menu. Only "Classique" for now; more come later. */
export const THEMES: ThemeInfo[] = [
  {
    id: "classic-family-school",
    name: "Classique",
    description: "Famille, amis & école — simple et fun, dès 7 ans.",
    minAge: 7,
  },
];
