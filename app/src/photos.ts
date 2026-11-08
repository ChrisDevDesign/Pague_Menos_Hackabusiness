// Fotos do Unsplash usadas fora dos produtos (#16, #17, #18 da auditoria). Licença Unsplash, uso gratuito.
const UTM = "utm_source=pague_menos_prototipo&utm_medium=referral";
export interface SmallPhoto { file: string; id: string; by: string; user: string }
export const photoUrl = (p: SmallPhoto, w: number, h = w, extra = "") => `https://images.unsplash.com/${p.file}?auto=format&fit=crop&w=${w}&h=${h}&q=70${extra}`;
export const photoCredit = (p: SmallPhoto) => ({
  source: "Unsplash" as const,
  photographer: p.by,
  photographerUrl: `https://unsplash.com/@${p.user}?${UTM}`,
  pageUrl: `https://unsplash.com/photos/${p.id}?${UTM}`,
});

/** Retrato usado como foto de perfil da persona fictícia Renata (#18). */
export const PROFILE_PHOTO: SmallPhoto = { file: "photo-1543430720-fa600c67e423", id: "nCGl8FrGHb0", by: "Luis Machado", user: "luismachadodirector" };

/** Fotos dos círculos de categoria na Home (#16) e do atalho de kit (#17). */
export const CATEGORY_PHOTOS: Record<string, SmallPhoto> = {
  saude: { file: "photo-1584308666744-24d5c474f2ae", id: "jwWtZrm67VI", by: "Christine Sandu", user: "lenscapewithme" },
  dermo: { file: "photo-1768235146463-328c98e7234d", id: "IWuc9YiChSI", by: "Tiffany Oakley", user: "toakley91" },
  "vida-saudavel": { file: "photo-1664956618021-73c47736845e", id: "UTPZnnEVW4E", by: "Supliful - Supplements On Demand", user: "supliful" },
  higiene: { file: "photo-1771535626784-7de36a960c1a", id: "gr6Rp3Rjfw8", by: "andrew davies", user: "arny231104" },
};
export const KIT_PROMO_PHOTO: SmallPhoto = { file: "photo-1649005203762-8bbd673468dc", id: "sBjbXysTN5I", by: "Sufyan", user: "blenderdesigner" };
