// Máscaras dos campos da ficha (Brunner 14/10: "os campos de preenchimento tem que ter mascara").
// Cada uma recebe o que a pessoa digitou e devolve já formatado; as funções "paraX" convertem pro que o servidor guarda.
const dig = (s) => String(s || '').replace(/\D/g, '');

// (32) 99999-4355 · fixo: (32) 3215-4355
export function telefone(v) {
  let d = dig(v);
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2); // colou com +55
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  const ddd = d.slice(0, 2); const r = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return r.length <= corte ? `(${ddd}) ${r}` : `(${ddd}) ${r.slice(0, corte)}-${r.slice(corte)}`;
}
export const telefoneCompleto = (v) => dig(v).length >= 10;

// 07/03/1988
export function data(v) {
  const d = dig(v).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
// DD/MM/AAAA -> AAAA-MM-DD; '' se vazio; null se inválida (dia 31/02, ano fora de 1930..hoje-10)
export function dataParaISO(v) {
  const d = dig(v);
  if (!d) return '';
  if (d.length !== 8) return null;
  const dia = +d.slice(0, 2); const mes = +d.slice(2, 4); const ano = +d.slice(4);
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (dt.getUTCFullYear() !== ano || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return null;
  if (ano < 1930 || ano > new Date().getFullYear() - 10) return null;
  return `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
}
export const isoParaData = (iso) => (iso ? data(String(iso).slice(0, 10).split('-').reverse().join('')) : '');

// peso: até 3 dígitos + 1 casa decimal com vírgula (82,5)
export function peso(v) {
  const s = String(v || '').replace('.', ',').replace(/[^\d,]/g, '');
  const [int, ...resto] = s.split(',');
  const dec = resto.join('').slice(0, 1);
  return s.includes(',') ? `${int.slice(0, 3)},${dec}` : int.slice(0, 3);
}
// altura em cm, 3 dígitos; se digitar 1,75 vira 175
export function altura(v) {
  const s = String(v || '');
  if (/^\d[.,]\d{1,2}$/.test(s.trim())) return String(Math.round(parseFloat(s.replace(',', '.')) * 100));
  return dig(s).slice(0, 3);
}

// instagram: sem @, sem espaço, só o que o Instagram aceita
export const instagram = (v) => String(v || '').trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  .replace(/[/?].*$/, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);
