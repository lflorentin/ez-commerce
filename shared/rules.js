export const TERMS_VERSION = 'demo-2026-11-23';
export const categories = ['Tech', 'Maison', 'Bien-être', 'Loisirs', 'Épicerie'];
export const shippingMethods = {
  home: { label: 'À domicile', cents: 549, extraDays: 0 },
  pickup: { label: 'Point relais de démonstration', cents: 479, extraDays: 1 },
};
export const pickupPoints = [
  { id: 'paris', address: '10 place de la République, 75011 Paris' },
  { id: 'lyon', address: 'Place Bellecour, 69002 Lyon' },
  { id: 'bordeaux', address: 'Place de la Bourse, 33000 Bordeaux' },
];
export const events = [
  { id: 'black-friday', title: 'Black Friday', subtitle: 'La sélection qui vaut le détour', from: 1120, to: 1130 },
  { id: 'noel', title: 'Noël', subtitle: 'Des cadeaux qui font plaisir.', from: 1101, to: 1231 },
  { id: 'printemps', title: 'Printemps', subtitle: 'Un air de renouveau.', from: 301, to: 531 },
  { id: 'ete', title: 'Été', subtitle: 'Prêt pour les beaux jours.', from: 601, to: 815 },
  { id: 'rentree', title: 'Rentrée', subtitle: 'Tout pour bien repartir.', from: 816, to: 930 },
  { id: 'halloween', title: 'Halloween', subtitle: 'Une sélection à faire frissonner.', from: 1001, to: 1031 },
];
export function activeEvents(date = new Date()) {
  const [month, day] = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', month: 'numeric', day: 'numeric',
  }).format(date).split('/').map(Number);
  return events.filter(event => month * 100 + day >= event.from && month * 100 + day <= event.to);
}
export function totals(lines, method = 'home', reward = 0) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const base = subtotal ? shippingMethods[method].cents : 0;
  const shipping = subtotal > 2000 ? Math.round(base * 0.75) : base;
  const discount = Math.min(reward, subtotal);
  return { subtotal, shipping, shippingDiscount: base - shipping, discount, total: subtotal - discount + shipping };
}
export const money = cents => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
