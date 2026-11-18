// Shirts: every runner picks a shirt TYPE (cut) and a SIZE. The type is the shirt's cut, not the
// runner's gender (anyone may pick either). Used for kit preparation counts everywhere.
const SHIRT_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SHIRT_TYPES = ['male', 'female'];
const SHIRT_TYPE_LABEL = { male: 'Male', female: 'Female' };

// Accepts what people type in a CSV / form: male/female, m/f, men/women, lelaki/perempuan…
const TYPE_ALIASES = {
  // (No single-letter L/P for lelaki/perempuan: "L" is also a shirt size.)
  male: 'male', m: 'male', men: 'male', man: 'male', mens: 'male', "men's": 'male', lelaki: 'male',
  female: 'female', f: 'female', women: 'female', woman: 'female', womens: 'female', "women's": 'female',
  ladies: 'female', lady: 'female', perempuan: 'female', wanita: 'female',
};
const normalizeShirtType = (v) => TYPE_ALIASES[String(v || '').trim().toLowerCase()] || null;

const zeroSizes = () => Object.fromEntries(SHIRT_SIZES.map((s) => [s, 0]));

// { male: {XS..XXL}, female: {XS..XXL} } plus totals per size (shirt_sizes, unchanged shape).
// Runners from before shirt types existed (no type) count in the totals only.
function shirtCounts(participants) {
  const sizes = zeroSizes();
  const byType = { male: zeroSizes(), female: zeroSizes() };
  participants.forEach((p) => {
    if (sizes[p.shirt_size] === undefined) return;
    sizes[p.shirt_size] += 1;
    if (byType[p.shirt_type]) byType[p.shirt_type][p.shirt_size] += 1;
  });
  return { shirt_sizes: sizes, shirt_breakdown: byType };
}

module.exports = { SHIRT_SIZES, SHIRT_TYPES, SHIRT_TYPE_LABEL, normalizeShirtType, shirtCounts };
