// Current dubbing sheet: Dr William Morel, not the archived Valmont recording.
export const MOREL_NOTES = [
  { id: 'MOR_D01', text: 'Note du douze octobre. Patient vingt-sept, admis en chambre cent quatre. Il affirme ne pas être malade. Classique.' },
  { id: 'MOR_D02', text: 'Il refuse son traitement. Il parle de « sortir », la nuit. Surveillance renforcée. Le cadenas, comme pour les autres.' },
  { id: 'MOR_D03', text: 'Il réclame une petite fille. Léa. […] Je n’ai pas jugé utile de le contredire.' },
  { id: 'MOR_D04', text: 'Note du vingt-huit octobre. Le patient appelle depuis la cabine, la nuit. Toujours vers minuit. Il ne s’en souvient pas le lendemain.' },
  { id: 'MOR_D05', text: 'Lucas voudrait faire couper les téléphones. […] Non. Laissez-les. Je veux voir jusqu’où il va.' },
  { id: 'MOR_D06', text: 'Note du trois novembre. Retrouvé cette nuit devant le portique. Il dit qu’il était dehors. […] Augmenter la dose.' },
];
export const MOREL_WHISPERS = [
  { id: 'MOR_H01', text: 'Augmentez la dose.', from: 0.65 },
  { id: 'MOR_H02', text: 'Tu es malade. Et c’est normal.', from: 0.5 },
  { id: 'MOR_H03', text: 'On veut ton bien. Tu le sais, ça.', from: 0.5 },
  { id: 'MOR_H04', text: 'Elle te va bien, ma blouse.', from: 0.5, coat: true },
  { id: 'MOR_H05', text: 'Retourne te coucher. Allez.', from: 0.6 },
  { id: 'MOR_H06', text: 'Tu n’as jamais eu de fille.', from: 0.85 },
];
export const morelWhispers = (loss, blouse) => MOREL_WHISPERS.filter(line => loss >= line.from && (!line.coat || blouse));
